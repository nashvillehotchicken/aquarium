export function renderNav(): void {
  let nav = document.getElementById("nav");
  if (!nav) {
    nav = document.createElement("nav");
    nav.id = "nav";
    document.body.prepend(nav);
  }

  if (!document.getElementById("page")) {
    const page = document.createElement("div");
    page.id = "page";
    document.body.appendChild(page);
  }

  nav.innerHTML = `
    <a class="logo" href="#/">Aquarium</a>
    <div class="nav-links">
      <a href="#/" id="nav-home">Home</a>
      <a href="#/search?q=" id="nav-browse">Browse</a>
    </div>
    <form id="search-form">
      <input type="search" id="search-input" placeholder="Search anime…" autocomplete="off" />
      <button type="submit" aria-label="Search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </button>
    </form>
  `;

  const h = location.hash;
  if (h === "#/" || h === "") document.getElementById("nav-home")?.classList.add("active");
  if (h.startsWith("#/search")) document.getElementById("nav-browse")?.classList.add("active");

  document.getElementById("search-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (document.getElementById("search-input") as HTMLInputElement).value.trim();
    if (q) location.hash = `#/search?q=${encodeURIComponent(q)}`;
  });
}
