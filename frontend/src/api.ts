/**
 * api.ts — all backend calls in one place.
 * Set VITE_API_BASE in .env (e.g. https://api.your-domain.com)
 * Falls back to /api in dev (proxied by Vite to wrangler dev on :8787).
 */

const BASE = (import.meta as { env: { VITE_API_BASE?: string } }).env.VITE_API_BASE ?? "/api";
const API_KEY = (import.meta as { env: { VITE_API_KEY?: string } }).env.VITE_API_KEY ?? "";

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(`${BASE}${path}`, location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  const headers: HeadersInit = {};
  if (API_KEY) headers["x-api-key"] = API_KEY;

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ─── AniList ─────────────────────────────────────────────────────────────────

export interface AniListMedia {
  id: number;
  title: { romaji: string; english: string | null; native: string };
  coverImage: { large: string; extraLarge: string };
  bannerImage: string | null;
  format: string;
  status: string;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  genres: string[];
  season: string | null;
  seasonYear: number | null;
  nextAiringEpisode: { episode: number; airingAt: number } | null;
  startDate: { year: number; month: number; day: number };
  description?: string;
  meanScore?: number;
  popularity?: number;
}

export interface PageResult<T> {
  media: T[];
  pageInfo: { total: number; currentPage: number; lastPage: number; hasNextPage: boolean };
}

export const anilist = {
  trending: (page = 1, perPage = 20) =>
    get<PageResult<AniListMedia>>("/anilist/trending", { page, perPage }),

  airing: (page = 1, perPage = 20) =>
    get<PageResult<AniListMedia>>("/anilist/airing", { page, perPage }),

  search: (params: {
    q?: string; page?: number; perPage?: number; genre?: string;
    year?: number; season?: string; format?: string; status?: string; sort?: string;
  }) => get<PageResult<AniListMedia>>("/anilist/search", params as Record<string, string | number | boolean | undefined>),

  media: (id: number) => get<AniListMedia & {
    description: string; tags: { name: string; rank: number }[];
    relations: { edges: { relationType: string; node: AniListMedia }[] };
    recommendations: { nodes: { rating: number; mediaRecommendation: AniListMedia }[] };
    studios: { nodes: { id: number; name: string; isAnimationStudio: boolean }[] };
  }>(`/anilist/media/${id}`),
};

// ─── Anime (Miruro) ───────────────────────────────────────────────────────────

export interface Episode {
  id: string;
  number: number;
  title: string | null;
  image: string | null;
  airDate: string | null;
  duration: number | null;
  description: string | null;
  filler: boolean;
}

export interface EpisodeData {
  mappings: { anilistId: number; malId?: number };
  providers: Record<string, {
    episodes: Record<string, Episode[]>;
  }>;
}

export interface StreamSource {
  url: string;
  type: "hls" | "mp4";
  quality?: string;
}

export interface StreamData {
  streams: StreamSource[];
  subtitles: { file: string; label: string; kind?: string }[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}

export const anime = {
  episodes: (anilistId: number) =>
    get<EpisodeData>(`/anime/episodes/${anilistId}`),

  sources: (params: { episodeId: string; provider?: string; anilistId?: number; category?: string }) =>
    get<StreamData>("/anime/sources", params as Record<string, string | number | boolean | undefined>),

  search: (q: string, page = 1, translationType = "sub") =>
    get<{ results: AniListMedia[] }>("/anime/search", { q, page, translationType }),
};

// ─── Manga (AllManga) ─────────────────────────────────────────────────────────

export interface MangaShow {
  _id: string;
  name: string;
  englishName: string | null;
  thumbnail: string;
  score: number | null;
  type: string;
  availableEpisodesDetail: Record<string, number>;
  lastEpisodeTimestamp: Record<string, string>;
}

export const manga = {
  search: (q: string, params?: { page?: number; limit?: number; sortBy?: string; type?: string; translationType?: string }) =>
    get<{ edges: MangaShow[] }>("/manga/search", { q, ...params } as Record<string, string | number | boolean | undefined>),

  show: (id: string) =>
    get<MangaShow & { description: string; genres: string[]; tags: string[] }>(`/manga/show/${id}`),

  episodes: (showId: string, params?: { episodeStart?: number; episodeEnd?: number; includeStreams?: boolean }) =>
    get<{ _id: string; availableEpisodesDetail: Record<string, number>; episodes: unknown[] }>(`/manga/episodes/${showId}`, params as Record<string, string | number | boolean | undefined>),

  sources: (showId: string, episode: string, translationType = "sub") =>
    get<unknown>("/manga/sources", { showId, episode, translationType }),

  trending: (page = 1) =>
    get<{ edges: MangaShow[] }>("/manga/trending", { page }),

  recent: (translationType = "sub", page = 1) =>
    get<{ edges: MangaShow[] }>("/manga/recent", { translationType, page }),
};

// ─── HLS Proxy helper ─────────────────────────────────────────────────────────

export function proxyHlsUrl(upstreamM3u8: string, referer?: string): string {
  const url = new URL(`${BASE}/proxy/hls`, location.origin);
  url.searchParams.set("url", encodeURIComponent(upstreamM3u8));
  if (referer) url.searchParams.set("referer", encodeURIComponent(referer));
  return url.toString();
}

export function proxySubUrl(upstreamSub: string): string {
  const url = new URL(`${BASE}/proxy/sub`, location.origin);
  url.searchParams.set("url", encodeURIComponent(upstreamSub));
  return url.toString();
}

