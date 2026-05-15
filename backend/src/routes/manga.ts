/**
 * AllManga scraper — ported from allmangascraper.py
 * Uses AllManga's GraphQL API at allanime.day
 */
import { Hono } from "hono";
import type { Env } from "../types";

const ALLANIME_API = "https://api.allanime.day/api";
const ALLANIME_SITE = "https://allanime.to";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Referer": ALLANIME_SITE,
  "Origin": ALLANIME_SITE,
};

async function gqlQuery(query: string, variables: Record<string, unknown>): Promise<unknown> {
  const params = new URLSearchParams({
    query,
    variables: JSON.stringify(variables),
  });
  const res = await fetch(`${ALLANIME_API}?${params}`, {
    headers: { ...HEADERS, "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`AllManga API error: ${res.status}`);
  const json = await res.json() as { data: unknown };
  return json.data;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const mangaRouter = new Hono<{ Bindings: Env }>();

// GET /manga/search?q=...&page=1&limit=26&sortBy=Latest_Update&type=&translationType=&countryOrigin=
mangaRouter.get("/search", async (c) => {
  const q = c.req.query("q") ?? "";
  const page = Number(c.req.query("page") ?? 1);
  const limit = Math.min(Number(c.req.query("limit") ?? 26), 100);
  const sortBy = c.req.query("sortBy") ?? "Latest_Update";
  const type = c.req.query("type") || null;
  const translationType = c.req.query("translationType") || null;
  const countryOrigin = c.req.query("countryOrigin") || null;

  const query = `
    query(
      $search: SearchInput
      $limit: Int
      $page: Int
      $translationType: VaildTranslationTypeEnumType
      $countryOrigin: VaildCountryOriginEnumType
    ) {
      shows(
        search: $search
        limit: $limit
        page: $page
        translationType: $translationType
        countryOrigin: $countryOrigin
      ) {
        edges {
          _id name englishName nativeName thumbnail
          score type status season year
          availableEpisodesDetail
          lastEpisodeTimestamp
        }
      }
    }
  `;

  const searchInput: Record<string, unknown> = { sortBy, query: q };
  if (type) searchInput.types = [type];

  try {
    const data = await gqlQuery(query, {
      search: searchInput,
      limit,
      page,
      translationType: translationType || undefined,
      countryOrigin: countryOrigin || undefined,
    }) as { shows: unknown };
    return c.json(data.shows);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /manga/show/:id
mangaRouter.get("/show/:id", async (c) => {
  const id = c.req.param("id");
  const query = `
    query($id: String!) {
      show(_id: $id) {
        _id name englishName nativeName
        description thumbnail bannerImage
        score type status season year genres tags
        availableEpisodesDetail
        studios characters
        lastEpisodeTimestamp
      }
    }
  `;
  try {
    const data = await gqlQuery(query, { id }) as { show: unknown };
    return c.json(data.show);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /manga/episodes/:showId?episodeStart=1&episodeEnd=9999&includeStreams=false
mangaRouter.get("/episodes/:showId", async (c) => {
  const showId = c.req.param("showId");
  const episodeStart = Number(c.req.query("episodeStart") ?? 1);
  const episodeEnd = Number(c.req.query("episodeEnd") ?? 9999);
  const includeStreams = c.req.query("includeStreams") === "true";

  const query = `
    query($showId: String!, $episodeNumStart: Float!, $episodeNumEnd: Float!) {
      show(_id: $showId) {
        _id
        availableEpisodesDetail
        episodes(
          episodeNumStart: $episodeNumStart
          episodeNumEnd: $episodeNumEnd
        ) {
          _id episodeNum
          ${includeStreams ? "sourceUrls" : ""}
          thumbnailUrl
          uploadDates
          vidInforssub vidInforsdub vidInforsraw
        }
      }
    }
  `;
  try {
    const data = await gqlQuery(query, {
      showId,
      episodeNumStart: episodeStart,
      episodeNumEnd: episodeEnd,
    }) as { show: unknown };
    return c.json(data.show);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /manga/sources?showId=...&episode=1&translationType=sub
// Option A: AllAnime CDN (no cookies needed)
mangaRouter.get("/sources", async (c) => {
  const showId = c.req.query("showId");
  const episode = c.req.query("episode");
  const translationType = c.req.query("translationType") ?? "sub";

  if (!showId || !episode) return c.json({ error: "showId and episode required" }, 400);

  const query = `
    query($showId: String!, $translationType: VaildTranslationTypeEnumType!, $episodeString: String!) {
      episode(showId: $showId, translationType: $translationType, episodeString: $episodeString) {
        _id episodeNum
        sourceUrls
        vidInforssub vidInforsdub vidInforsraw
      }
    }
  `;
  try {
    const data = await gqlQuery(query, {
      showId,
      translationType,
      episodeString: episode,
    }) as { episode: unknown };
    return c.json(data.episode);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /manga/trending?page=1
mangaRouter.get("/trending", async (c) => {
  const page = Number(c.req.query("page") ?? 1);
  const query = `
    query($page: Int) {
      shows(
        search: { sortBy: Trending }
        limit: 20
        page: $page
      ) {
        edges {
          _id name englishName thumbnail score type
          availableEpisodesDetail lastEpisodeTimestamp
        }
      }
    }
  `;
  try {
    const data = await gqlQuery(query, { page }) as { shows: unknown };
    return c.json(data.shows);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /manga/recent?translationType=sub&page=1
mangaRouter.get("/recent", async (c) => {
  const translationType = c.req.query("translationType") ?? "sub";
  const page = Number(c.req.query("page") ?? 1);
  const countryOrigin = c.req.query("countryOrigin") ?? "JP";
  const query = `
    query($translationType: VaildTranslationTypeEnumType!, $countryOrigin: VaildCountryOriginEnumType, $page: Int) {
      shows(
        search: { sortBy: Latest_Update }
        translationType: $translationType
        countryOrigin: $countryOrigin
        limit: 20
        page: $page
      ) {
        edges {
          _id name englishName thumbnail score type
          availableEpisodesDetail lastEpisodeTimestamp
        }
      }
    }
  `;
  try {
    const data = await gqlQuery(query, { translationType, countryOrigin, page }) as { shows: unknown };
    return c.json(data.shows);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});
