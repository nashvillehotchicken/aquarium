import { anime, anilist, proxyHlsUrl, proxySubUrl } from "../api";
import { initPlayer, destroyPlayer } from "../player";
import { upsert } from "../history";

interface WatchParams {
  anilistId: number;
  provider: string;
  category: string;
  episodeId: string;
}

export async function renderWatch(page: HTMLElement, params: WatchParams): Promise<void> {
  page.innerHTML = '<div class="spinner"></div>';
  destroyPlayer();

  const { anilistId, provider, category, episodeId } = params;

  const [mediaRes, epDataRes, sourcesRes] = await Promise.allSettled([
    anilist.media(anilistId),
    anime.episodes(anilistId),
    anime.sources({ episodeId, provider, anilistId, category }),
  ]);

  if (sourcesRes.status === "rejected") {
    page.innerHTML = '<p class="error-msg">Failed to load stream. The episode may be unavailable.</p>'; return;
  }

  const sources = sourcesRes.value;
  const media = mediaRes.status === "fulfilled" ? mediaRes.value : null;
  const epData = epDataRes.status === "fulfilled" ? epDataRes.value : null;

  const title = media?.title.english ?? media?.title.romaji ?? "Aquarium";
  const allEps: { id: string; number: number; title?: string }[] =
    epData?.providers?.[provider]?.episodes?.[category] ?? [];
  const currentEp = allEps.find(e => e.id === episodeId);
  const epNumber = currentEp?.number ?? 0;

  page.innerHTML = `
    <div style="margin-bottom:12px;">
      <a href="#/anime/${anilistId}" style="font-size:12px;color:var(--text-muted);">← ${title}</a>
      <span style="font-size:13px;font-weight:600;margin-left:12px;">
        Episode ${epNumber}${currentEp?.title ? " — " + currentEp.title : ""}
      </span>
    </div>
    <div id="watch-layout">
      <div>
        <div id="player-wrap">
          <video id="main-player" class="video-js vjs-default-skin" playsinline></video>
        </div>
        <div id="source-controls"></div>
      </div>
      <div id="ep-sidebar">
        <h3>Episodes</h3>
        <div id="ep-sidebar-list"></div>
      </div>
    </div>
  `;

  // Sidebar
  const sidebarList = document.getElementById("ep-sidebar-list")!;
  for (const ep of allEps.slice(0, 100)) {
    const item = document.createElement("div");
    item.className = `ep-sidebar-item${ep.id === episodeId ? " active" : ""}`;
    item.innerHTML = `
      <div class="ep-num">EP ${ep.number}</div>
      ${ep.title ? `<div class="ep-name">${ep.title}</div>` : ""}
    `;
    item.addEventListener("click", () => {
      location.hash = `#/watch/${anilistId}/${provider}/${category}/${encodeURIComponent(ep.id)}`;
    });
    sidebarList.appendChild(item);
  }

  // Scroll active ep into view
  sidebarList.querySelector(".active")?.scrollIntoView({ block: "nearest" });

  const streams: { url: string; type: string; quality?: string }[] = sources.streams ?? [];
  let activeStreamIdx = 0;
  const srcControls = document.getElementById("source-controls")!;

  function renderSourceBtns() {
    srcControls.innerHTML = streams
      .map((s, i) =>
        `<button class="src-btn${i === activeStreamIdx ? " active" : ""}" data-idx="${i}">
          ${s.quality ?? s.type ?? `Stream ${i + 1}`}
        </button>`
      ).join("");
    srcControls.querySelectorAll(".src-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeStreamIdx = Number((btn as HTMLElement).dataset.idx);
        renderSourceBtns();
        loadStream();
      });
    });
  }

  function loadStream() {
    const stream = streams[activeStreamIdx];
    if (!stream) { srcControls.innerHTML = '<p class="error-msg">No streams available.</p>'; return; }

    const isHls = stream.type === "hls" || stream.url.includes(".m3u8");
    const proxiedUrl = isHls ? proxyHlsUrl(stream.url, "https://www.miruro.tv/") : stream.url;

    const subs = (sources.subtitles ?? []).map((sub: { file: string; label: string }) => ({
      src: proxySubUrl(sub.file),
      label: sub.label,
      default: sub.label.toLowerCase().includes("english"),
    }));

    const cover = media?.coverImage?.large ?? "";

    initPlayer("main-player", {
      hlsUrl: proxiedUrl,
      subtitles: subs,
      intro: sources.intro,
      outro: sources.outro,
      onTimeUpdate: (t, dur) => {
        if (dur > 10) {
          upsert({ anilistId, title, cover, episodeId, episodeNumber: epNumber, provider, category, progress: t, duration: dur });
        }
      },
      onEnded: () => {
        const idx = allEps.findIndex(e => e.id === episodeId);
        const next = allEps[idx + 1];
        if (next) location.hash = `#/watch/${anilistId}/${provider}/${category}/${encodeURIComponent(next.id)}`;
      },
    });
  }

  renderSourceBtns();
  loadStream();
}
