import { Hono } from "hono";
import type { Env } from "../types";

const ANILIST_URL = "https://graphql.anilist.co";

const MEDIA_LIST_FIELDS = `
  id
  title { romaji english native }
  coverImage { large extraLarge }
  bannerImage
  format season seasonYear episodes duration status
  averageScore popularity genres
  nextAiringEpisode { episode airingAt timeUntilAiring }
  startDate { year month day }
`;

async function anilistQuery(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const json = await res.json() as { data: unknown; errors?: unknown[] };
  if (json.errors) throw new Error("AniList GraphQL error");
  return json.data;
}

export const anilistRouter = new Hono<{ Bindings: Env }>();

// GET /anilist/trending?page=1&perPage=20
anilistRouter.get("/trending", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const perPage = Math.min(Number(c.req.query("perPage") ?? 20), 50);

  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
          ${MEDIA_LIST_FIELDS}
        }
        pageInfo { total currentPage lastPage hasNextPage }
      }
    }
  `;
  try {
    const data = await anilistQuery(query, { page, perPage }) as { Page: unknown };
    return c.json(data.Page);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /anilist/airing?page=1&perPage=20
anilistRouter.get("/airing", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const perPage = Math.min(Number(c.req.query("perPage") ?? 20), 50);

  const query = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) {
          ${MEDIA_LIST_FIELDS}
        }
        pageInfo { total currentPage lastPage hasNextPage }
      }
    }
  `;
  try {
    const data = await anilistQuery(query, { page, perPage }) as { Page: unknown };
    return c.json(data.Page);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /anilist/search?q=...&page=1&perPage=20&genre=...&year=...&season=...&format=...&status=...&sort=...
anilistRouter.get("/search", async (c) => {
  const q = c.req.query("q");
  const page = Number(c.req.query("page") ?? 1);
  const perPage = Math.min(Number(c.req.query("perPage") ?? 20), 50);
  const genre = c.req.query("genre");
  const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
  const season = c.req.query("season");
  const format = c.req.query("format");
  const status = c.req.query("status");
  const sort = c.req.query("sort") ?? "SEARCH_MATCH";

  const query = `
    query ($search: String, $page: Int, $perPage: Int, $genre: String, $seasonYear: Int, $season: MediaSeason, $format: MediaFormat, $status: MediaStatus, $sort: [MediaSort]) {
      Page(page: $page, perPage: $perPage) {
        media(type: ANIME, search: $search, genre: $genre, seasonYear: $seasonYear, season: $season, format: $format, status: $status, sort: $sort, isAdult: false) {
          ${MEDIA_LIST_FIELDS}
        }
        pageInfo { total currentPage lastPage hasNextPage }
      }
    }
  `;
  try {
    const data = await anilistQuery(query, {
      search: q || undefined,
      page, perPage,
      genre: genre || undefined,
      seasonYear: year,
      season: season || undefined,
      format: format || undefined,
      status: status || undefined,
      sort: [sort],
    }) as { Page: unknown };
    return c.json(data.Page);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /anilist/media/:id
anilistRouter.get("/media/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id idMal
        title { romaji english native }
        description(asHtml: false)
        coverImage { large extraLarge color }
        bannerImage format season seasonYear episodes duration status
        averageScore meanScore popularity favourites trending
        genres tags { name rank }
        source countryOfOrigin isAdult
        studios { nodes { id name isAnimationStudio } }
        nextAiringEpisode { episode airingAt timeUntilAiring }
        startDate { year month day }
        endDate { year month day }
        relations {
          edges {
            relationType(version: 2)
            node { id title { romaji english } coverImage { large } format type status episodes meanScore }
          }
        }
        recommendations(sort: RATING_DESC, perPage: 8) {
          nodes {
            rating
            mediaRecommendation { id title { romaji english } coverImage { large } format episodes status meanScore }
          }
        }
        streamingEpisodes { title thumbnail url site }
      }
    }
  `;
  try {
    const data = await anilistQuery(query, { id }) as { Media: unknown };
    return c.json(data.Media);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});
