import { anilist, type AniListMedia } from "../api";
import { getAll, progressFraction } from "../history";
import { makeCard } from "../components/card";

export async function renderHome(page: HTMLElement): Promise<void> {
  page.innerHTML = "";

  const history = getAll();
  if (history.length) {
    const section = makeSection("Continue Watching");
    const row = document.createElement("div");
    row.className = "cards-row";
    for (const entry of history.slice(0, 20)) {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-thumb">
          <img src="${entry.cover}" alt="${entry.title}" loading="lazy" />
          <span class="card-badge">EP ${entry.episodeNumber}</span>
        </div>
        <div class="card-title">${entry.title}</div>
        <div class="card-progress-bar">
          <div class="card-progress-fill" style="width:${Math.round(progressFraction(entry) * 100)}%"></div>
        </div>
      `;
      card.addEventListener("click", () => {
        location.hash = `#/watch/${entry.anilistId}/${entry.provider}/${entry.category}/${encodeURIComponent(entry.episodeId)}`;
      });
      row.appendChild(card);
    }
    section.appendChild(row);
    page.appendChild(section);
  }

  const trendingSection = makeSection("Trending", "#/search?sort=TRENDING_DESC");
  const trendingRow = document.createElement("div");
  trendingRow.className = "cards-row";
  trendingRow.innerHTML = '<div class="spinner"></div>';
  trendingSection.appendChild(trendingRow);
  page.appendChild(trendingSection);

  const airingSection = makeSection("Currently Airing", "#/search?status=RELEASING");
  const airingRow = document.createElement("div");
  airingRow.className = "cards-row";
  airingRow.innerHTML = '<div class="spinner"></div>';
  airingSection.appendChild(airingRow);
  page.appendChild(airingSection);

  const [trending, airing] = await Promise.allSettled([
    anilist.trending(1, 24),
    anilist.airing(1, 24),
  ]);

  if (trending.status === "fulfilled") {
    trendingRow.innerHTML = "";
    for (const m of trending.value.media) trendingRow.appendChild(makeCard(m));
  } else {
    trendingRow.innerHTML = `<p class="error-msg">Failed to load trending.</p>`;
  }

  if (airing.status === "fulfilled") {
    airingRow.innerHTML = "";
    for (const m of airing.value.media) airingRow.appendChild(makeCard(m));
  } else {
    airingRow.innerHTML = `<p class="error-msg">Failed to load airing.</p>`;
  }
}

function makeSection(title: string, link?: string): HTMLElement {
  const sec = document.createElement("div");
  sec.className = "section";
  const header = document.createElement("div");
  header.className = "section-header";
  header.innerHTML = `<h2>${title}</h2>${link ? `<a href="${link}">See all</a>` : ""}`;
  sec.appendChild(header);
  return sec;
}
