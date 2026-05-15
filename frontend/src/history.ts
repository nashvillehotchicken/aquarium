/**
 * history.ts — persistent watch history using localStorage.
 * Stores up to MAX_ITEMS entries, most recent first.
 */

const KEY = "aquarium_history";
const MAX_ITEMS = 50;

export interface HistoryEntry {
  anilistId: number;
  title: string;
  cover: string;
  episodeId: string;
  episodeNumber: number;
  provider: string;
  category: string;        // sub | dub
  progress: number;        // seconds watched
  duration: number;        // total duration in seconds
  updatedAt: number;       // unix ms
}

function load(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
}

export function upsert(entry: Omit<HistoryEntry, "updatedAt">): void {
  const entries = load().filter(
    (e) => !(e.anilistId === entry.anilistId && e.episodeId === entry.episodeId)
  );
  entries.unshift({ ...entry, updatedAt: Date.now() });
  save(entries);
}

export function getAll(): HistoryEntry[] {
  return load();
}

export function getByAnime(anilistId: number): HistoryEntry[] {
  return load().filter((e) => e.anilistId === anilistId);
}

export function getLastForAnime(anilistId: number): HistoryEntry | null {
  return getByAnime(anilistId).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export function remove(anilistId: number, episodeId: string): void {
  save(load().filter((e) => !(e.anilistId === anilistId && e.episodeId === episodeId)));
}

export function clear(): void {
  localStorage.removeItem(KEY);
}

/** Returns progress as 0–1 percentage */
export function progressFraction(entry: HistoryEntry): number {
  if (!entry.duration || entry.duration === 0) return 0;
  return Math.min(entry.progress / entry.duration, 1);
}
