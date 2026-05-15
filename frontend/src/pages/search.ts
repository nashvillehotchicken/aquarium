import { anilist } from "../api";
import { makeCard } from "../components/card";

export async function renderSearch(page: HTMLElement, q: string): Promise<void> {
  page.innerHTML = "";

  const heading = document.createElement("div");
  heading.className = "section-header";
  heading.innerHTML = `<h2>${q ? `Results for "${q}"` : "Browse"}</h2>`;
  page.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "cards-grid";
  grid.innerHTML = '<div class="spinner"></div>';
  page.appendChild(grid);

  try {
    const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
    const res = await anilist.search({
      q: q || undefined,
      sort: params.get("sort") ?? (q ? "SEARCH_MATCH" : "POPULARITY_DESC"),
      status: params.get("status") ?? undefined,
      page: 1,
      perPage: 40,
    });
    grid.innerHTML = "";
    if (!res.media.length) {
      grid.innerHTML = '<p class="error-msg">No results.</p>'; return;
    }
    for (const m of res.media) grid.appendChild(makeCard(m));
  } catch {
    grid.innerHTML = '<p class="error-msg">Search failed.</p>';
  }
}
