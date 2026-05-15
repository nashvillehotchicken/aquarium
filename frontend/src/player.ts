/**
 * player.ts — Video.js initialisation and helpers.
 * Video.js is loaded from CDN in index.html.
 * Customisation hooks are exported so watch.ts can configure them.
 */

declare const videojs: typeof import("video.js").default;

export interface PlayerOptions {
  hlsUrl: string;
  subtitles?: { src: string; label: string; default?: boolean }[];
  startTime?: number;
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

let player: ReturnType<typeof videojs> | null = null;
let skipIntroBtn: HTMLButtonElement | null = null;
let skipOutroBtn: HTMLButtonElement | null = null;

export function initPlayer(containerId: string, opts: PlayerOptions): ReturnType<typeof videojs> {
  // Destroy existing player
  if (player) {
    player.dispose();
    player = null;
  }

  const el = document.getElementById(containerId) as HTMLVideoElement;
  if (!el) throw new Error(`Element #${containerId} not found`);

  player = videojs(el, {
    controls: true,
    autoplay: false,
    preload: "auto",
    fluid: true,
    playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
    html5: {
      vhs: {
        overrideNative: true,
        enableLowInitialPlaylist: true,
      },
    },
    controlBar: {
      children: [
        "playToggle",
        "volumePanel",
        "currentTimeDisplay",
        "timeDivider",
        "durationDisplay",
        "progressControl",
        "playbackRateMenuButton",
        "subsCapsButton",
        "fullscreenToggle",
      ],
    },
  });

  // Source
  player.src({ src: opts.hlsUrl, type: "application/x-mpegURL" });

  // Subtitles
  if (opts.subtitles?.length) {
    for (const sub of opts.subtitles) {
      player.addRemoteTextTrack({
        kind: "subtitles",
        src: sub.src,
        label: sub.label,
        default: sub.default ?? false,
      }, false);
    }
  }

  // Start time
  if (opts.startTime && opts.startTime > 0) {
    player.one("loadedmetadata", () => { player?.currentTime(opts.startTime!); });
  }

  // Skip intro/outro buttons
  const container = player.el();
  skipIntroBtn = createSkipBtn("Skip Intro");
  skipOutroBtn = createSkipBtn("Skip Outro");
  container.appendChild(skipIntroBtn);
  container.appendChild(skipOutroBtn);

  // Time update
  player.on("timeupdate", () => {
    const t = player!.currentTime() ?? 0;
    const dur = player!.duration() ?? 0;

    if (opts.intro) {
      const visible = t >= opts.intro.start && t < opts.intro.end;
      skipIntroBtn!.style.display = visible ? "block" : "none";
    }
    if (opts.outro) {
      const visible = t >= opts.outro.start && t < opts.outro.end;
      skipOutroBtn!.style.display = visible ? "block" : "none";
    }

    opts.onTimeUpdate?.(t, dur);
  });

  // Skip button actions
  skipIntroBtn.addEventListener("click", () => {
    if (opts.intro) player?.currentTime(opts.intro.end);
  });
  skipOutroBtn.addEventListener("click", () => {
    if (opts.outro) player?.currentTime(opts.outro.end);
  });

  player.on("ended", () => opts.onEnded?.());

  return player;
}

function createSkipBtn(label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.className = "vjs-skip-btn";
  btn.style.display = "none";
  return btn;
}

export function destroyPlayer(): void {
  player?.dispose();
  player = null;
}

export function getPlayer() { return player; }
