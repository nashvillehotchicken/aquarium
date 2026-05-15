export interface Env {
  ALLOWED_ORIGIN: string;
  API_KEY?: string;
}

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
}

export interface EpisodeSource {
  url: string;
  type: "hls" | "mp4";
  quality?: string;
}

export interface StreamResponse {
  streams: EpisodeSource[];
  subtitles: { file: string; label: string; kind?: string }[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}
