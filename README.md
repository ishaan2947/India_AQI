# AQI India Intelligence

A full-stack, production-quality platform for monitoring and forecasting air
quality across 30 major Indian cities. Real-time AQI is ingested from
WAQI, persisted to a local SQLite database, surfaced through a typed REST API,
and visualised on an interactive Leaflet map plus a Recharts dashboard. A
Random-Forest model retrained nightly produces 24-hour AQI forecasts.

![Tech](https://img.shields.io/badge/python-3.11+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688) ![React](https://img.shields.io/badge/React-18-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![Vite](https://img.shields.io/badge/Vite-6-646cff) ![scikit--learn](https://img.shields.io/badge/scikit--learn-1.6-f7931e)

> _Screenshots placeholder_ — drop PNGs of the map, the city-detail page and
> the forecasts page into `docs/` and link them here once you've taken them.

---

## Architecture

```
                       ┌─────────────────────────┐
                       │   WAQI / OpenAQ APIs    │
                       └────────────┬────────────┘
                                    │ httpx (async, retry+backoff)
                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  FastAPI backend (Python 3.11)                                   │
│                                                                  │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│   │ APScheduler  │ →  │  fetcher.py  │ →  │  SQLAlchemy ORM  │   │
│   │ hourly job   │    │ + synth fb   │    │  SQLite          │   │
│   └──────────────┘    └──────────────┘    └────────┬─────────┘   │
│                                                    │             │
│                                                    ▼             │
│                                            ┌──────────────┐      │
│                                            │  ml_model.py │      │
│                                            │  RandomForest│      │
│                                            └──────┬───────┘      │
│                                                   │              │
│   /api/cities  /api/aqi/*  /api/predictions/*  /api/stats/*      │
└──────────────────────────┬───────────────────────────────────────┘
                           │ JSON (Pydantic v2)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  React + Vite frontend (TypeScript, Tailwind)                    │
│                                                                  │
│   Leaflet map  ◀──▶  Recharts dashboard  ◀──▶  Forecast panel    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer        | Tools                                                              |
|--------------|--------------------------------------------------------------------|
| Backend      | FastAPI · SQLAlchemy 2 · Pydantic v2 · APScheduler · httpx         |
| ML           | scikit-learn (Random Forest) · pandas · numpy · joblib             |
| Database     | SQLite (default) · Postgres-ready via `DATABASE_URL`               |
| Frontend     | React 18 · TypeScript · Vite · Tailwind CSS                        |
| Visualisation| Leaflet + React-Leaflet · Recharts                                 |
| HTTP client  | Axios                                                              |

---

## Getting started

### 1. Backend

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate     # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env          # edit if you have a real WAQI token

# From the repo root:
cd ..
uvicorn backend.main:app --reload --port 8000
```

On first run the app will:

1. create the SQLite schema,
2. seed `data/indian_cities.json` (30 cities),
3. backfill 72 h of synthetic readings,
4. train the Random Forest,
5. start the scheduler (hourly fetch · daily retrain).

Open <http://localhost:8000/docs> for the interactive Swagger UI.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

### 3. Docker (both at once)

```bash
docker-compose up --build
```

---

## API documentation

| Method | Path                              | Description                                |
|--------|-----------------------------------|--------------------------------------------|
| GET    | `/api/cities`                     | All cities with their latest AQI reading   |
| GET    | `/api/cities/{city_id}`           | One city with its latest reading           |
| GET    | `/api/aqi/current`                | Latest AQI for every city                  |
| GET    | `/api/aqi/{city_id}/history?hours=24` | Historical readings (1 ≤ hours ≤ 720) |
| GET    | `/api/aqi/{city_id}/latest`       | Most recent single reading                 |
| GET    | `/api/predictions/{city_id}`      | 24-hour forecast for a city                |
| GET    | `/api/predictions/all`            | 24-hour forecasts for every city           |
| POST   | `/api/admin/refresh`              | Trigger an immediate data refresh          |
| GET    | `/api/stats/worst`                | Top 10 most polluted cities right now      |
| GET    | `/api/stats/best`                 | Top 10 cleanest cities right now           |
| GET    | `/healthz`                        | Liveness probe                             |

All responses are typed via Pydantic v2 and serialised with stable field
names — the TypeScript types in `frontend/src/types/index.ts` mirror them
1-for-1.

---

## ML model

* **Algorithm** — `RandomForestRegressor` (120 trees, depth 14). Chosen over
  gradient boosting because it trains in seconds on this dataset, requires
  no feature scaling, and provides a cheap pseudo-confidence interval from
  per-tree variance.
* **Features** — `hour`, `day_of_week`, `month`, `lag_1/2/3`, rolling 6 h and
  24 h means, and `city_id` (a sparse identifier so the forest can learn
  per-city baselines).
* **Target** — AQI one hour ahead. To produce a 24-hour forecast the model is
  iterated 24 times, feeding its own previous prediction back into the lag
  features (multi-step prediction by recursion).
* **Confidence** — `1 − std(per_tree_predictions) / mean(per_tree_predictions)`,
  clipped to `[0, 1]`. Surfaced to the UI as a shaded interval band.
* **Warm start** — when the DB has fewer than 100 real readings the model is
  trained on a synthetic frame so the dashboard works on a fresh install.
* **Retraining** — every 24 hours via APScheduler. Saved to `model.joblib`.

---

## Folder map

```
aqi-india/
├── backend/
│   ├── data/indian_cities.json
│   ├── routers/        # aqi.py, cities.py, predictions.py
│   ├── services/       # fetcher.py, ml_model.py, scheduler.py
│   ├── database.py, models.py, schemas.py, crud.py
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/ # Map · Dashboard · Layout
│       ├── pages/      # Home, CityDetail, Predictions
│       ├── hooks/      # useAQIData, usePredictions
│       ├── api/        # axios client
│       └── utils/      # aqiHelpers
├── docker-compose.yml
└── README.md
```

---

## Future improvements

* Replace WAQI fallback with a real OpenAQ v3 pull (the v3 endpoint requires
  city → station resolution which is non-trivial; left as a follow-up).
* Swap Random Forest for an LSTM / Prophet hybrid for longer horizons.
* Add user accounts + saved city watchlists.
* Push real-time updates over WebSockets instead of polling.
* Helm chart + GitHub Actions deploy to Fly.io or Render.
* Persistent Postgres in compose with Alembic-managed migrations.

---

## License

MIT.
