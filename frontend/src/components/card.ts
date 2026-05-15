import type { AniListMedia } from "../api";

export function makeCard(m: AniListMedia): HTMLElement {
  const card = document.createElement("div");
  card.className = "card";
  const title = m.title.english ?? m.title.romaji;
  const meta = [m.format, m.seasonYear].filter(Boolean).join(" · ");
  const score = m.averageScore ? (m.averageScore / 10).toFixed(1) : null;
  const badge = m.nextAiringEpisode ? `EP ${m.nextAiringEpisode.episode}` : null;

  card.innerHTML = `
    <div class="card-thumb">
      <img src="${m.coverImage.large}" alt="${title}" loading="lazy" width="160" height="224" />
      ${badge ? `<span class="card-badge">${badge}</span>` : ""}
      ${score ? `<span class="card-score">★ ${score}</span>` : ""}
    </div>
    <div class="card-title">${title}</div>
    <div class="card-meta">${meta}</div>
  `;

  card.addEventListener("click", () => { location.hash = `#/anime/${m.id}`; });
  return card;
}
