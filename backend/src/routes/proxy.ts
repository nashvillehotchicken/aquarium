/**
 * HLS Proxy — rewrites .m3u8 manifests so all segment URLs route through
 * this worker, masking the upstream source from clients and preventing
 * other sites from directly embedding the stream.
 *
 * Inspired by node-HLS-Proxy (warren-bank) adapted for Cloudflare Workers.
 *
 * Routes:
 *   GET /proxy/hls?url=<encoded-m3u8-url>&referer=<optional>
 *   GET /proxy/seg?url=<encoded-segment-url>&referer=<optional>
 *   GET /proxy/sub?url=<encoded-subtitle-url>
 */
import { Hono } from "hono";
import type { Env } from "../types";

export const proxyRouter = new Hono<{ Bindings: Env }>();

const SPOOF_HEADERS = (referer?: string): HeadersInit => ({
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  ...(referer ? { "Referer": referer, "Origin": new URL(referer).origin } : {}),
});

function workerUrl(c: { req: { url: string } }, path: string, params: Record<string, string>): string {
  const base = new URL(c.req.url).origin;
  const u = new URL(`${base}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

function rewriteM3u8(manifest: string, c: { req: { url: string } }, upstreamBase: string, referer?: string): string {
  return manifest
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        // Rewrite URIs inside EXT-X tags e.g. #EXT-X-MAP:URI="init.mp4"
        return line.replace(/URI="([^"]+)"/g, (_m, uri) => {
          const abs = resolveUrl(uri, upstreamBase);
          const isM3u8 = abs.includes(".m3u8") || abs.includes("m3u8");
          const proxyPath = isM3u8 ? "/proxy/hls" : "/proxy/seg";
          return `URI="${workerUrl(c, proxyPath, { url: abs, ...(referer ? { referer } : {}) })}"`;
        });
      }
      const abs = resolveUrl(trimmed, upstreamBase);
      const isM3u8 = abs.includes(".m3u8") || abs.includes("m3u8");
      const proxyPath = isM3u8 ? "/proxy/hls" : "/proxy/seg";
      return workerUrl(c, proxyPath, { url: abs, ...(referer ? { referer } : {}) });
    })
    .join("\n");
}

function resolveUrl(uri: string, base: string): string {
  if (uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  if (uri.startsWith("//")) return "https:" + uri;
  try {
    return new URL(uri, base).toString();
  } catch {
    return uri;
  }
}

// ─── HLS manifest proxy ───────────────────────────────────────────────────────

proxyRouter.get("/hls", async (c) => {
  const rawUrl = c.req.query("url");
  const referer = c.req.query("referer");
  if (!rawUrl) return c.json({ error: "url required" }, 400);

  let targetUrl: string;
  try { targetUrl = decodeURIComponent(rawUrl); } catch { targetUrl = rawUrl; }

  try {
    const upstream = await fetch(targetUrl, { headers: SPOOF_HEADERS(referer) });
    if (!upstream.ok) return c.json({ error: `Upstream ${upstream.status}` }, upstream.status as 400 | 500);

    const text = await upstream.text();
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf("/") + 1);
    const rewritten = rewriteM3u8(text, c, baseUrl, referer);

    return new Response(rewritten, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": c.env.ALLOWED_ORIGIN || "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// ─── Segment proxy ────────────────────────────────────────────────────────────

proxyRouter.get("/seg", async (c) => {
  const rawUrl = c.req.query("url");
  const referer = c.req.query("referer");
  if (!rawUrl) return c.json({ error: "url required" }, 400);

  let targetUrl: string;
  try { targetUrl = decodeURIComponent(rawUrl); } catch { targetUrl = rawUrl; }

  try {
    const upstream = await fetch(targetUrl, { headers: SPOOF_HEADERS(referer) });
    if (!upstream.ok) return c.json({ error: `Upstream ${upstream.status}` }, upstream.status as 400 | 500);

    const contentType = upstream.headers.get("content-type") ?? "video/mp2t";
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": c.env.ALLOWED_ORIGIN || "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

// ─── Subtitle proxy ───────────────────────────────────────────────────────────

proxyRouter.get("/sub", async (c) => {
  const rawUrl = c.req.query("url");
  if (!rawUrl) return c.json({ error: "url required" }, 400);

  let targetUrl: string;
  try { targetUrl = decodeURIComponent(rawUrl); } catch { targetUrl = rawUrl; }

  try {
    const upstream = await fetch(targetUrl, { headers: SPOOF_HEADERS() });
    if (!upstream.ok) return c.json({ error: `Upstream ${upstream.status}` }, upstream.status as 400 | 500);

    const contentType = upstream.headers.get("content-type") ?? "text/vtt";
    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": c.env.ALLOWED_ORIGIN || "*",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});
