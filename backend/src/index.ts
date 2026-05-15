import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { anilistRouter } from "./routes/anilist";
import { animeRouter } from "./routes/anime";
import { mangaRouter } from "./routes/manga";
import { proxyRouter } from "./routes/proxy";

const app = new Hono<{ Bindings: Env }>();

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use("*", async (c, next) => {
  const allowedOrigin = c.env.ALLOWED_ORIGIN || "*";
  return cors({
    origin: allowedOrigin,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type", "x-api-key"],
    maxAge: 86400,
  })(c, next);
});

// ─── API Key guard (skip proxy routes — they need open access for the player) 
app.use("/anilist/*", apiKeyGuard);
app.use("/anime/*", apiKeyGuard);
app.use("/manga/*", apiKeyGuard);

async function apiKeyGuard(
  c: Parameters<Parameters<typeof app.use>[1]>[0],
  next: Parameters<Parameters<typeof app.use>[1]>[1]
) {
  const validKey = c.env.API_KEY;
  if (!validKey) return next(); // no key configured → open

  const provided = c.req.header("x-api-key");
  const origin = c.req.header("origin") ?? "";
  const referer = c.req.header("referer") ?? "";
  const allowed = c.env.ALLOWED_ORIGIN;

  if (provided === validKey) return next();
  if (allowed && (origin.startsWith(allowed) || referer.startsWith(allowed))) return next();

  return c.json({ error: "Forbidden" }, 403);
}

// ─── Routes ────────────────────────────────────────────────────────────────
app.route("/anilist", anilistRouter);
app.route("/anime", animeRouter);
app.route("/manga", mangaRouter);
app.route("/proxy", proxyRouter);

app.get("/", (c) => c.json({
  name: "Aquarium API",
  version: "1.0.0",
  routes: [
    "GET /anilist/trending",
    "GET /anilist/airing",
    "GET /anilist/search",
    "GET /anilist/media/:id",
    "GET /anime/episodes/:anilistId",
    "GET /anime/sources",
    "GET /anime/search",
    "GET /manga/search",
    "GET /manga/show/:id",
    "GET /manga/episodes/:showId",
    "GET /manga/sources",
    "GET /manga/trending",
    "GET /manga/recent",
    "GET /proxy/hls",
    "GET /proxy/seg",
    "GET /proxy/sub",
  ],
}));

export default app;
