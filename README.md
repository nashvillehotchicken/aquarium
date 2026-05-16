# Aquarium

A clean, dark-themed anime streaming web app powered by the AllAnime API scraper.

## Project Structure

```
aquarium/
├── frontend/         → Deploy to Cloudflare Pages
│   ├── index.html
│   └── _redirects
└── backend/          → Deploy to Railway / Render / any Python host
    ├── main.py
    ├── requirements.txt
    ├── Procfile
    └── runtime.txt
```

---

## Deploying the Backend

The backend is a FastAPI app that scrapes allmanga.to. You need to host it somewhere — it cannot run on Cloudflare (Python is not supported there).

### Option A — Railway (recommended, free tier available)

1. Push the `backend/` folder to a GitHub repo (or the whole project)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select the repo. Railway auto-detects Python via `Procfile`
4. It will give you a public URL like `https://your-project.up.railway.app`

### Option B — Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Set **Build Command**: `pip install -r requirements.txt`
4. Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Root directory: `backend/`

### Option C — Local / VPS

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## Deploying the Frontend to Cloudflare Pages

1. Push the whole repo to GitHub
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) → Create a project
3. Connect your GitHub repo
4. Set **Build output directory** to `frontend`
5. Leave the build command blank (it's a static site)
6. Deploy

---

## Connecting Frontend to Backend

1. Open your deployed Aquarium site
2. Click **config** in the top right
3. Paste your backend URL (e.g. `https://your-project.up.railway.app`)
4. Click **save & connect**

The URL is saved to localStorage — you only need to do this once per browser.

---

## How it Works

The frontend follows the no-cookie flow from the README:

1. **Search** — `GET /anime/search?q=...` to find anime
2. **Episodes** — `GET /anime/episodes/{id}?includeStreams=true` to get episodes + direct CDN MP4 URLs
3. **Play** — the video player uses the CDN URL with the correct `Referer` header

> Note: The browser video player may not work for all streams due to CORS/Referer restrictions on the CDN. If a stream doesn't play in-browser, use the **↗ VLC** button to open it in VLC (which properly sends the Referer header).

---

## Notes

- No cookies required for the main CDN streams
- Sub/Dub toggle on the episode screen
- Stream quality selector when multiple streams are available
- VLC link for streams that won't play in the browser
