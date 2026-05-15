import { renderHome } from "./pages/home";
import { renderAnime } from "./pages/anime";
import { renderWatch } from "./pages/watch";
import { renderSearch } from "./pages/search";
import { renderNav } from "./components/nav";

export function router(): void {
  renderNav();

  const hash = location.hash || "#/";
  const page = document.getElementById("page")!;
  page.innerHTML = '<div class="spinner"></div>';

  if (hash === "#/" || hash === "") {
    renderHome(page);
  } else if (hash.startsWith("#/anime/")) {
    const id = Number(hash.split("/")[2]);
    renderAnime(page, id);
  } else if (hash.startsWith("#/watch/")) {
    // #/watch/:anilistId/:provider/:category/:episodeId
    const parts = hash.split("/");
    renderWatch(page, {
      anilistId: Number(parts[2]),
      provider: parts[3],
      category: parts[4],
      episodeId: decodeURIComponent(parts.slice(5).join("/")),
    });
  } else if (hash.startsWith("#/search")) {
    const q = new URLSearchParams(hash.split("?")[1] ?? "").get("q") ?? "";
    renderSearch(page, q);
  } else {
    page.innerHTML = '<p class="error-msg">Page not found.</p>';
  }
}
