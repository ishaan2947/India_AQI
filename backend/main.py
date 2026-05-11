"""
FastAPI application entry point for the AQI India Intelligence platform.

Run locally with:

    uvicorn backend.main:app --reload --port 8000

On startup we:
  1. Create the SQLite schema.
  2. Seed the 30 Indian cities from `data/indian_cities.json`.
  3. Backfill 72h of synthetic history so charts are non-empty on first run.
  4. Train the ML model.
  5. Start APScheduler.

On shutdown the scheduler is stopped cleanly.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import SessionLocal, init_db
from .routers import aqi, cities, predictions
from .services import fetcher, ml_model, scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


def _bootstrap() -> None:
    """Synchronous bootstrap: schema, cities, history, model."""
    init_db()
    db = SessionLocal()
    try:
        fetcher.seed_cities_from_json(db)
        # 24h is plenty for the dashboard's "last 24h" chart and keeps
        # the cold-start under Render's free-tier health-check timeout.
        fetcher.backfill_synthetic_history(db, hours=24)
        try:
            ml_model.train_model(db)
        except Exception:  # pragma: no cover
            logger.exception("Initial ML training failed — endpoints will retrain on demand")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Bootstrapping AQI India Intelligence platform…")
    _bootstrap()
    scheduler.start_scheduler()
    try:
        yield
    finally:
        scheduler.shutdown_scheduler()


app = FastAPI(
    title="AQI India Intelligence API",
    description=(
        "Real-time + historical AQI data, geospatial visualisation, "
        "and 24-hour ML forecasts for 30 Indian cities."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — locked down to the Vite dev server by default. Override via env.
_cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cities.router)
app.include_router(aqi.router)
app.include_router(predictions.router)


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {
        "service": "AQI India Intelligence API",
        "version": app.version,
        "docs": "/docs",
    }


@app.get("/healthz", tags=["meta"])
def healthz() -> dict[str, str]:
    return {"status": "ok"}
