"""
APScheduler-driven background jobs.

Two recurring jobs run in the FastAPI process:

* `fetch_job` — every 60 minutes, hit the upstream APIs and store one new
  reading per city.
* `retrain_job` — every 24 hours, retrain the ML model on the up-to-date
  history.

Both jobs are wrapped to (a) build their own DB session and (b) log any
exception without killing the scheduler thread.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..database import SessionLocal
from . import fetcher, ml_model

logger = logging.getLogger(__name__)

FETCH_INTERVAL_MINUTES: int = 60
RETRAIN_INTERVAL_HOURS: int = 24

_scheduler: Optional[AsyncIOScheduler] = None


async def _fetch_job() -> None:
    logger.info("Scheduler: starting fetch job")
    db = SessionLocal()
    try:
        stored = await fetcher.fetch_all_cities(db)
        logger.info("Scheduler: fetch job stored %d readings", stored)
    except Exception:  # pragma: no cover
        logger.exception("Scheduler: fetch job failed")
    finally:
        db.close()


def _retrain_job_sync() -> None:
    logger.info("Scheduler: starting retrain job")
    db = SessionLocal()
    try:
        ml_model.train_model(db)
        logger.info("Scheduler: retrain job complete")
    except Exception:  # pragma: no cover
        logger.exception("Scheduler: retrain job failed")
    finally:
        db.close()


async def _retrain_job() -> None:
    # sklearn fit is CPU-bound — push it off the event loop.
    await asyncio.to_thread(_retrain_job_sync)


def start_scheduler() -> AsyncIOScheduler:
    """Spin up the scheduler with both recurring jobs registered."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _fetch_job,
        trigger=IntervalTrigger(minutes=FETCH_INTERVAL_MINUTES),
        id="fetch_aqi",
        name="Fetch AQI for all cities",
        replace_existing=True,
    )
    scheduler.add_job(
        _retrain_job,
        trigger=IntervalTrigger(hours=RETRAIN_INTERVAL_HOURS),
        id="retrain_ml",
        name="Retrain ML model",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started: fetch every %d min, retrain every %d hr",
        FETCH_INTERVAL_MINUTES,
        RETRAIN_INTERVAL_HOURS,
    )
    _scheduler = scheduler
    return scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler stopped")
