import { anilist, anime } from "../api";
import { getLastForAnime } from "../history";
import type { Episode } from "../api";

export async function renderAnime(page: HTMLElement, id: number): Promise<void> {
  page.innerHTML = '<div class="spinner"></div>';

  const [media, episodes] = await Promise.allSettled([
    anilist.media(id),
    anime.episodes(id),
  ]);

  if (media.status === "rejected") {
    page.innerHTML = '<p class="error-msg">Failed to load anime.</p>'; return;
  }

  const m = media.value;
  const title = m.title.english ?? m.title.romaji;
  const lastWatched = getLastForAnime(id);

  page.innerHTML = "";

  if (m.bannerImage) {
    const banner = document.createElement("div");
    banner.id = "anime-banner";
    banner.innerHTML = `<img src="${m.bannerImage}" alt="" loading="lazy" />`;
    page.appendChild(banner);
  }

  const score = m.averageScore ? (m.averageScore / 10).toFixed(1) : "—";
  const info = document.createElement("div");
  info.id = "anime-info";
  info.innerHTML = `
    <div id="anime-cover">
      <img src="${m.coverImage.extraLarge ?? m.coverImage.large}" alt="${title}" loading="lazy" />
    </div>
    <div id="anime-meta">
      <h1>${title}</h1>
      <div class="meta-row">
        <span class="badge accent">${m.status}</span>
        <span class="badge">${m.format ?? "—"}</span>
        <span class="badge">${m.season ?? ""} ${m.seasonYear ?? ""}</span>
        <span class="badge">★ ${score}</span>
        ${m.episodes ? `<span class="badge">${m.episodes} eps</span>` : ""}
      </div>
      <div class="meta-row">
        ${(m.genres ?? []).slice(0, 5).map((g: string) => `<span class="badge">${g}</span>`).join("")}
      </div>
      <p id="anime-desc">${m.description?.replace(/<[^>]+>/g, "") ?? ""}</p>
      <button id="desc-toggle" style="font-size:12px;color:var(--text-muted);margin-top:6px;cursor:pointer;">Show more</button>
    </div>
  `;
  page.appendChild(info);

  document.getElementById("desc-toggle")?.addEventListener("click", () => {
    const d = document.getElementById("anime-desc")!;
    d.classList.toggle("expanded");
    (document.getElementById("desc-toggle") as HTMLButtonElement).textContent =
      d.classList.contains("expanded") ? "Show less" : "Show more";
  });

  const epSection = document.createElement("div");
  epSection.className = "section";

  if (episodes.status === "rejected") {
    epSection.innerHTML = '<p class="error-msg">Failed to load episodes.</p>';
    page.appendChild(epSection);
    return;
  }

  const epData = episodes.value;
  const providers = Object.keys(epData.providers ?? {});

  if (!providers.length) {
    epSection.innerHTML = '<p class="error-msg">No episodes found.</p>';
    page.appendChild(epSection);
    return;
  }

  let activeProvider = providers[0];
  let activeCategory = "sub";

  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = "<h2>Episodes</h2>";
  epSection.appendChild(header);

  const controls = document.createElement("div");
  controls.id = "ep-controls";
  epSection.appendChild(controls);

  const grid = document.createElement("div");
  grid.className = "ep-grid";
  epSection.appendChild(grid);
  page.appendChild(epSection);

  function renderEpGrid() {
    grid.innerHTML = "";
    const providerData = epData.providers[activeProvider];
    const epList: Episode[] = providerData?.episodes?.[activeCategory] ?? [];

    controls.innerHTML = `
      <label>Provider:</label>
      <select id="provider-select">
        ${providers.map(p => `<option value="${p}" ${p === activeProvider ? "selected" : ""}>${p}</option>`).join("")}
      </select>
      <label>Type:</label>
      <select id="cat-select">
        ${Object.keys(providerData?.episodes ?? {}).map(cat =>
          `<option value="${cat}" ${cat === activeCategory ? "selected" : ""}>${cat.toUpperCase()}</option>`
        ).join("")}
      </select>
      ${lastWatched ? `<button id="resume-btn" class="src-btn">▶ Resume EP ${lastWatched.episodeNumber}</button>` : ""}
    `;

    document.getElementById("provider-select")?.addEventListener("change", (e) => {
      activeProvider = (e.target as HTMLSelectElement).value;
      activeCategory = "sub";
      renderEpGrid();
    });
    document.getElementById("cat-select")?.addEventListener("change", (e) => {
      activeCategory = (e.target as HTMLSelectElement).value;
      renderEpGrid();
    });
    document.getElementById("resume-btn")?.addEventListener("click", () => {
      if (lastWatched) location.hash = `#/watch/${id}/${lastWatched.provider}/${lastWatched.category}/${encodeURIComponent(lastWatched.episodeId)}`;
    });

    if (!epList.length) {
      grid.innerHTML = '<p class="error-msg">No episodes for this selection.</p>'; return;
    }

    for (const ep of epList) {
      const btn = document.createElement("button");
      btn.className = "ep-btn";
      if (lastWatched?.episodeId === ep.id) btn.classList.add("active");
      btn.innerHTML = `
        <div>EP ${ep.number}</div>
        ${ep.title ? `<div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${ep.title}</div>` : ""}
      `;
      btn.addEventListener("click", () => {
        location.hash = `#/watch/${id}/${activeProvider}/${activeCategory}/${encodeURIComponent(ep.id)}`;
      });
      grid.appendChild(btn);
    }
  }

  renderEpGrid();
}
