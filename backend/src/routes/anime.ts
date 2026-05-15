/**
 * Miruro scraper — ported from miruroscraper.py
 * Uses the Miruro pipe endpoint with base64+gzip encoding/decoding.
 */
import { Hono } from "hono";
import type { Env } from "../types";

const MIRURO_PIPE_URL = "https://www.miruro.tv/api/secure/pipe";
const SCRAPER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Referer": "https://www.miruro.tv/",
};

// ─── Pipe encode/decode (mirrors Python implementation) ──────────────────────

function encodePipeRequest(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  // base64url encode without padding
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function decodePipeResponse(encoded: string): Promise<unknown> {
  // Restore base64url padding
  const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));

  // Decompress gzip using DecompressionStream
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(bytes);
  writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { buf.set(chunk, offset); offset += chunk.length; }

  return JSON.parse(new TextDecoder().decode(buf));
}

function translateId(encoded: string): string {
  try {
    const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4);
    const decoded = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
    return decoded.includes(":") ? decoded : encoded;
  } catch {
    return encoded;
  }
}

function deepTranslate(obj: unknown): void {
  if (Array.isArray(obj)) {
    obj.forEach(deepTranslate);
  } else if (obj && typeof obj === "object") {
    const rec = obj as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (key === "id" && typeof rec[key] === "string") {
        rec[key] = translateId(rec[key] as string);
      } else {
        deepTranslate(rec[key]);
      }
    }
  }
}

async function pipeFetch(path: string, query: Record<string, unknown>): Promise<unknown> {
  const payload = { path, method: "GET", query, body: null, version: "0.1.0" };
  const encoded = encodePipeRequest(payload);
  const url = `${MIRURO_PIPE_URL}?e=${encoded}`;
  const res = await fetch(url, { headers: SCRAPER_HEADERS });
  if (!res.ok) throw new Error(`Miruro pipe error: ${res.status}`);
  const text = (await res.text()).trim();
  const data = await decodePipeResponse(text);
  deepTranslate(data);
  return data;
}

function injectSourceSlugs(data: Record<string, unknown>, anilistId: number): void {
  const providers = data.providers as Record<string, Record<string, unknown>> | undefined;
  if (!providers) return;
  for (const [providerName, providerData] of Object.entries(providers)) {
    if (!providerData || typeof providerData !== "object") continue;
    let episodes = providerData.episodes as Record<string, unknown[]> | unknown[];
    if (Array.isArray(episodes)) {
      providerData.episodes = { sub: episodes };
      episodes = providerData.episodes as Record<string, unknown[]>;
    }
    if (!episodes || typeof episodes !== "object") continue;
    for (const [category, epList] of Object.entries(episodes as Record<string, unknown[]>)) {
      if (!Array.isArray(epList)) continue;
      for (const ep of epList) {
        const e = ep as Record<string, unknown>;
        if (typeof e.id === "string" && e.number !== undefined) {
          const prefix = e.id.includes(":") ? e.id.split(":")[0] : e.id;
          e.id = `watch/${providerName}/${anilistId}/${category}/${prefix}-${e.number}`;
        }
      }
    }
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const animeRouter = new Hono<{ Bindings: Env }>();

// GET /anime/episodes/:anilistId?provider=kiwi&category=sub
animeRouter.get("/episodes/:anilistId", async (c) => {
  const anilistId = Number(c.req.param("anilistId"));
  try {
    const data = await pipeFetch("episodes", { anilistId }) as Record<string, unknown>;
    injectSourceSlugs(data, anilistId);
    return c.json(data);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /anime/sources?episodeId=...&provider=kiwi&anilistId=...&category=sub
animeRouter.get("/sources", async (c) => {
  const episodeId = c.req.query("episodeId");
  const provider = c.req.query("provider") ?? "kiwi";
  const anilistId = c.req.query("anilistId");
  const category = c.req.query("category") ?? "sub";

  if (!episodeId) return c.json({ error: "episodeId required" }, 400);

  try {
    const data = await pipeFetch("sources", { episodeId, provider, anilistId, category });
    return c.json(data);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// GET /anime/search?q=...&page=1&translationType=sub
animeRouter.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "q required" }, 400);
  const page = Number(c.req.query("page") ?? 1);
  const translationType = c.req.query("translationType") ?? "sub";
  try {
    const data = await pipeFetch("search", { query: q, page, translationType });
    return c.json(data);
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});
