# AQI India Intelligence

> Full-stack geospatial dashboard for **real-time air-quality monitoring and ML
> forecasting** across 30 major Indian cities. An interactive Leaflet map, a
> Recharts analytics dashboard, a typed REST API, and a Random-Forest
> forecaster that predicts AQI 24 hours into the future — all in one
> portable repo.

**🌐 [Live demo →](https://india-aqi-three.vercel.app)** &nbsp;·&nbsp; **[API docs →](https://aqi-india-api.onrender.com/docs)**

> Free-tier hosting: frontend on Vercel, backend on Render. First request after
> 15 min of idle takes ~30–60 s to wake the backend up — just open the link
> while you're talking. Subsequent requests are fast.

![Python](https://img.shields.io/badge/python-3.11+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)
![Vite](https://img.shields.io/badge/Vite-6-646cff)
![scikit--learn](https://img.shields.io/badge/scikit--learn-1.6-f7931e)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38bdf8)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Screenshots

### Home page — interactive map of India

The full Leaflet map of India with all 30 cities rendered as colour-coded
circular markers (size scales with AQI severity), plus the live "most
polluted" leaderboard in the right-hand sidebar.

![Home map](docs/screenshots/01-home-map.jpg)

### Marker interaction

Clicking a city marker flies the map to centre on it and opens a popup
with the current AQI, category description, last-updated time, and a
direct link to that city's detail page. Deliberately doesn't auto-navigate
so you can keep exploring without losing your place.

![Marker popup](docs/screenshots/02-marker-popup.jpg)

### City detail — Delhi

Drill into any city for its current AQI snapshot, 24-hour trend (with the
orange dashed reference line at AQI = 100), and the ML-generated 24-hour
forecast with a delta arrow vs. the current reading.

![City detail – Delhi](docs/screenshots/03-city-detail.jpg)

### Forecasts page

A horizontal bar chart of the top-15 most polluted cities right now,
colour-coded by AQI band, followed by a grid of every monitored city with
its 24-hour predicted trend arrow.

![Forecasts page](docs/screenshots/04-predictions.jpg)

---

## What this project demonstrates

| Skill area               | Where it shows up                                                                            |
|--------------------------|----------------------------------------------------------------------------------------------|
| Backend API design       | FastAPI routers, dependency injection, Pydantic v2 schemas, typed responses                  |
| Data modelling           | SQLAlchemy 2 ORM, indexed FKs, cascade deletes, time-series schema                           |
| Async I/O                | `httpx.AsyncClient`, retry+exponential backoff, fallback strategies                          |
| Background jobs          | APScheduler in-process with `AsyncIOScheduler`, lifespan-managed startup/shutdown            |
| Machine learning         | Random Forest regression, feature engineering (lags + rolling stats), recursive multi-step   |
| Frontend architecture    | React 18 + TypeScript + Vite, custom hooks, polling, route-based code splitting              |
| Geospatial visualisation | Leaflet (via React-Leaflet), custom `CircleMarker`s sized + coloured by AQI category         |
| Charting                 | Recharts line/area/bar with reference lines and confidence bands                             |
| Styling                  | Tailwind CSS with a custom dark theme + skeleton loaders                                     |
| DX & deployment          | docker-compose with hot reload for backend + frontend                                        |

---

## Architecture

```
                        ┌─────────────────────────┐
                        │   WAQI / OpenAQ APIs    │
                        └────────────┬────────────┘
                                     │ httpx (async, retry+backoff,
                                     │        synthetic fallback)
                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│  FastAPI backend (Python 3.11+)                                    │
│                                                                    │
│   ┌──────────────┐    ┌──────────────┐    ┌────────────────────┐   │
│   │ APScheduler  │ →  │  fetcher.py  │ →  │  SQLAlchemy ORM    │   │
│   │ • hourly     │    │              │    │  SQLite (default)  │   │
│   │ • daily      │    │              │    │  Postgres-ready    │   │
│   └──────────────┘    └──────────────┘    └─────────┬──────────┘   │
│                                                     │              │
│                                                     ▼              │
│                                             ┌──────────────┐       │
│                                             │  ml_model.py │       │
│                                             │ RandomForest │       │
│                                             └──────┬───────┘       │
│                                                    │               │
│  Routers:  /api/cities  /api/aqi/*  /api/predictions/*  /api/stats │
└──────────────────────────┬─────────────────────────────────────────┘
                           │  JSON  (Pydantic v2 response models)
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  React + Vite frontend (TypeScript, Tailwind)                      │
│                                                                    │
│   Leaflet map  ◀──▶  Recharts dashboard  ◀──▶  Forecast panel      │
│         ▲                    ▲                       ▲             │
│         │                    │                       │             │
│        useCurrentAQI    useCityHistory         useCityPrediction   │
│         (polled)          (polled)                (polled)         │
└────────────────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer         | Tools                                                                  |
|---------------|------------------------------------------------------------------------|
| Backend       | FastAPI · SQLAlchemy 2 · Pydantic v2 · APScheduler · httpx             |
| ML            | scikit-learn (Random Forest) · pandas · numpy · joblib                 |
| Database      | SQLite (default) · Postgres-ready via `DATABASE_URL`                   |
| Frontend      | React 18 · TypeScript · Vite · Tailwind CSS · React Router 6           |
| Visualisation | Leaflet + React-Leaflet · Recharts                                     |
| HTTP client   | Axios (frontend) · httpx (backend, async)                              |
| Dev tooling   | docker-compose, `uvicorn --reload`, `vite dev`                         |

---

## Getting started

### Option A — local processes (recommended for development)

#### 1. Backend

```powershell
# from the repo root
python -m venv .venv
.venv\Scripts\Activate.ps1                 # macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
copy backend\.env.example backend\.env     # then edit if you have a real WAQI token

uvicorn backend.main:app --reload --port 8000
```

On first run the app will, in this order:

1. create the SQLite schema (`aqi_india.db` in the repo root),
2. seed `backend/data/indian_cities.json` (30 cities),
3. backfill **72 h of synthetic readings** so charts work immediately,
4. train the Random Forest and save it to `backend/model.joblib`,
5. start APScheduler (hourly fetch · daily retrain).

Open <http://localhost:8000/docs> for the interactive Swagger UI.

#### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

The Vite dev server proxies `/api/*` to `http://localhost:8000` (see
`vite.config.ts`) so there's nothing to configure for CORS during development.

### Option B — Docker (one command)

```bash
docker-compose up --build
```

Brings up the backend on `:8000` and the frontend on `:5173` with hot reload
for both.

---

## Deploy

The repo ships with a [`render.yaml`](render.yaml) blueprint for the backend
and a [`frontend/vercel.json`](frontend/vercel.json) config for the frontend.
Free tier on both providers; total cost: **$0/month**.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ishaan2947/India_AQI)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fishaan2947%2FIndia_AQI&root-directory=frontend)

### Step-by-step

1. **Backend → Render**
   - Click the "Deploy to Render" button above (or New → Blueprint → pick this repo).
   - In the blueprint review screen Render will prompt for two env vars:
     - `WAQI_TOKEN` — get a free one at <https://aqicn.org/data-platform/token/>
     - `CORS_ORIGINS` — leave as a placeholder for now, e.g. `https://placeholder.vercel.app`
   - Click **Apply**. First build takes ~3 min. Note your service URL —
     it'll look like `https://aqi-india-api.onrender.com`.

2. **Frontend → Vercel**
   - Click the "Deploy with Vercel" button above.
   - In the import step, the root directory is already set to `frontend/`.
   - Add one env var: `VITE_API_BASE_URL` = `https://aqi-india-api.onrender.com/api`
     (use *your* Render URL from step 1).
   - Click **Deploy**. First build takes ~1 min.

3. **Wire CORS back to Render**
   - Copy your Vercel production URL (e.g. `https://india-aqi.vercel.app`).
   - On Render → your service → Environment → set `CORS_ORIGINS` to that URL.
   - Render redeploys automatically. You're live.

4. **(Optional) Keep the backend warm**
   - Render's free tier sleeps after 15 min of inactivity; first request after sleep
     takes ~30 s.
   - For interview demos, just open the live URL while you're talking.
   - For always-on: ping `/healthz` every 10 min from
     [uptimerobot.com](https://uptimerobot.com) (free) or [cron-job.org](https://cron-job.org).

### Production notes

- The SQLite database lives on Render's ephemeral disk — it's recreated and
  re-seeded with 24 h of synthetic history every cold start (takes ~20 s).
  For persistent data across restarts, attach a Render Disk (1 GB ~ $1/mo)
  or swap `DATABASE_URL` for a managed Postgres.
- CORS is locked to whatever you set in `CORS_ORIGINS` — for multiple frontends
  (e.g. a preview deploy + production), comma-separate them.

---

## API documentation

| Method | Path                                  | Description                                |
|--------|---------------------------------------|--------------------------------------------|
| GET    | `/api/cities`                         | All cities with their latest AQI reading   |
| GET    | `/api/cities/{city_id}`               | One city with its latest reading           |
| GET    | `/api/aqi/current`                    | Latest AQI for every city                  |
| GET    | `/api/aqi/{city_id}/history?hours=24` | Historical readings (1 ≤ hours ≤ 720)      |
| GET    | `/api/aqi/{city_id}/latest`           | Most recent single reading                 |
| GET    | `/api/predictions/{city_id}`          | 24-hour forecast for a city                |
| GET    | `/api/predictions/all`                | 24-hour forecasts for every city           |
| POST   | `/api/admin/refresh`                  | Trigger an immediate data refresh          |
| GET    | `/api/stats/worst`                    | Top 10 most polluted cities right now      |
| GET    | `/api/stats/best`                     | Top 10 cleanest cities right now           |
| GET    | `/healthz`                            | Liveness probe                             |

All responses are typed via Pydantic v2 and serialised with stable field
names — the TypeScript types in `frontend/src/types/index.ts` mirror them
1-for-1, so end-to-end you have a fully typed contract.

### Example responses

`GET /api/cities`

```json
[
  {
    "id": 1,
    "name": "Delhi",
    "state": "Delhi",
    "lat": 28.6139,
    "lng": 77.209,
    "created_at": "2026-04-11T10:23:00",
    "latest_aqi": 312.5,
    "latest_pm25": 187.4,
    "latest_timestamp": "2026-05-10T09:00:00",
    "latest_source": "waqi"
  }
]
```

`GET /api/predictions/1`

```json
{
  "city_id": 1,
  "city_name": "Delhi",
  "generated_at": "2026-05-10T10:01:14",
  "horizon_hours": 24,
  "points": [
    {
      "prediction_for": "2026-05-10T11:00:00",
      "predicted_aqi": 298.7,
      "confidence_score": 0.84
    }
  ]
}
```

---

## Machine-learning model

### Algorithm

`sklearn.ensemble.RandomForestRegressor` with 120 trees, max depth 14,
min-leaf 2, parallelised across all cores (`n_jobs=-1`). Chosen over
gradient-boosted alternatives because it:

* trains in seconds on this dataset size,
* requires no feature scaling or imputation,
* gives a **free pseudo-confidence interval** from per-tree variance, so we
  don't need a separate quantile regressor.

### Features

| Feature        | What it captures                                  |
|----------------|---------------------------------------------------|
| `hour`         | Diurnal pollution pattern (rush hours, overnight) |
| `day_of_week`  | Weekend vs. weekday traffic differences           |
| `month`        | Seasonal effects (winter inversions, monsoon)     |
| `lag_1/2/3`    | Short-term autocorrelation                        |
| `rolling_6h`   | Smoothed short-term trend                         |
| `rolling_24h`  | Smoothed daily baseline                           |
| `city_id`      | Per-city baseline (lets the forest learn that Delhi ≠ Kochi) |

### Target & forecasting strategy

Target is AQI **one hour ahead**. For the 24-hour horizon the model is
applied **recursively**: each prediction is appended to the lag features
before the next step. This is simpler than training 24 separate horizon
models and gives smoother forecasts.

### Confidence score

```
confidence = clip(1 − std(tree_preds) / mean(tree_preds), 0, 1)
```

Surfaced in the UI as a shaded band around the prediction line — wider band
= lower model confidence.

### Warm start

When the DB has fewer than 100 real readings, the trainer concatenates a
synthetic frame (5 cities × 30 days of plausible diurnal data) so the
dashboard works the moment you `uvicorn` for the first time.

### Retraining cadence

Every 24 hours via APScheduler. The new model overwrites
`backend/model.joblib` and is hot-loaded by subsequent requests.

---

## Folder map

```
aqi-india/
├── backend/
│   ├── data/
│   │   └── indian_cities.json        # 30-city seed list
│   ├── routers/
│   │   ├── aqi.py                    # /api/aqi/*  /api/stats/*  /api/admin/*
│   │   ├── cities.py                 # /api/cities/*
│   │   └── predictions.py            # /api/predictions/*
│   ├── services/
│   │   ├── fetcher.py                # WAQI client + synthetic fallback
│   │   ├── ml_model.py               # Random Forest train + predict
│   │   └── scheduler.py              # APScheduler jobs
│   ├── database.py                   # SQLAlchemy engine + Base
│   ├── models.py                     # City · AQIReading · Prediction
│   ├── schemas.py                    # Pydantic response models
│   ├── crud.py                       # DB helpers
│   ├── main.py                       # FastAPI app + lifespan
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/client.ts             # Axios wrappers, one per endpoint
│   │   ├── components/
│   │   │   ├── Map/                  # AQIMap, AQIMarker
│   │   │   ├── Dashboard/            # CityCard, TrendChart, CityRanking,
│   │   │   │                         # PredictionPanel
│   │   │   └── Layout/               # Navbar, Sidebar
│   │   ├── hooks/                    # useAQIData, usePredictions
│   │   ├── pages/                    # Home, CityDetail, Predictions
│   │   ├── types/index.ts            # Mirrors backend Pydantic models
│   │   ├── utils/aqiHelpers.ts       # Color / category / time helpers
│   │   ├── App.tsx, main.tsx, index.css
│   │   └── vite-env.d.ts
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js · postcss.config.js
│   └── vite.config.ts · tsconfig.json
├── docker-compose.yml
└── README.md
```

---

## AQI colour scale

The UI follows the standard US-EPA colour bands:

| AQI       | Category                       | Colour    | Hex      |
|-----------|--------------------------------|-----------|----------|
| 0–50      | Good                           | Green     | `#00E400` |
| 51–100    | Moderate                       | Yellow    | `#FFFF00` |
| 101–150   | Unhealthy for Sensitive Groups | Orange    | `#FF7E00` |
| 151–200   | Unhealthy                      | Red       | `#FF0000` |
| 201–300   | Very Unhealthy                 | Purple    | `#8F3F97` |
| 301+      | Hazardous                      | Maroon    | `#7E0023` |

---

## Future improvements

* Swap WAQI fallback for a real OpenAQ v3 pull (the v3 endpoint requires
  city → station resolution which is non-trivial; left as a follow-up).
* Replace Random Forest with an LSTM or Prophet hybrid for longer horizons.
* Add user accounts + saved city watchlists with session auth.
* Push real-time updates over WebSockets instead of polling.
* Helm chart + GitHub Actions deploy to Fly.io or Render.
* Persistent Postgres in compose with Alembic-managed migrations.
* Unit tests + GitHub Actions CI (pytest + Vitest).

---

## License

MIT — feel free to fork, extend, and reuse.
