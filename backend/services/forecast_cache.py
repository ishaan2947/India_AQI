"""
The whole-country forecast, computed off the request path.

Why this module exists: `/api/predictions/all` is thirty cities x twenty-four
recursive steps, and every step polls all 120 trees for a variance estimate.
That is ~18s on a developer laptop and over two minutes on Render's free tier
— past the frontend's 90s HTTP timeout, so the forecasts page didn't just feel
slow in production, it failed.

Nothing underneath it moves at that speed. Readings land hourly and the model
retrains daily, so a forecast computed after the last fetch is *the* forecast
until the next one. The expensive work therefore belongs to the scheduler, not
to whoever happens to load the page first:

    startup            -> warm in a background thread (never blocks the health
                          check, so Render's deploy still goes green fast)
    after each fetch   -> refresh, because new readings change every forecast
    after each retrain -> refresh, because a new model changes every forecast
    a request          -> serve what is in memory

The TTL is a backstop, not the mechanism. If every scheduled refresh somehow
failed, a request would eventually recompute rather than serve a day-old
forecast forever. Whatever is served carries its own `generated_at`, which the
UI prints as "model run N min ago" — staleness is disclosed, never hidden.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from . import ml_model

logger = logging.getLogger(__name__)

# One entry, so a plain lock and a module global beat pulling in a cache
# library.
#
# Two locks, doing different jobs. `_LOCK` guards the slot itself and is held
# for microseconds. `_COMPUTE_LOCK` guards the *computation*, and is the one
# that matters: without it, a request arriving while the startup warm-up is
# still running starts a second identical multi-minute computation on a box
# with half a CPU. Observed, not theoretical — that is exactly what the first
# run of this module did.
_LOCK = threading.Lock()
# Reentrant, because `get()` takes it and then calls `refresh()`, which takes
# it again on the same thread.
_COMPUTE_LOCK = threading.RLock()

CacheEntry = Tuple[datetime, List[ml_model.CityForecast]]

_cache: Optional[CacheEntry] = None

TTL = timedelta(seconds=int(os.getenv("PREDICTION_CACHE_TTL_SECONDS", "10800")))


def clear() -> None:
    """Drop the cached forecast. Used by tests and by /admin/refresh."""
    global _cache
    with _LOCK:
        _cache = None


def peek() -> Optional[CacheEntry]:
    """Whatever is cached and still inside its TTL, or None."""
    with _LOCK:
        if _cache is None:
            return None
        computed_at, bundle = _cache
        if datetime.utcnow() - computed_at >= TTL:
            return None
        return computed_at, bundle


def refresh(db: Session) -> CacheEntry:
    """
    Recompute the bundle and store it. Blocking and expensive — call me from
    the scheduler, not from a request handler.

    Holds the compute lock for the duration so that a request arriving during
    the startup warm-up queues behind it and is served its result, rather than
    starting a second copy of the same computation. (Before this, that is
    precisely what happened: two identical forecasts computed side by side,
    each slowing the other down.)
    """
    global _cache
    with _COMPUTE_LOCK:
        started = datetime.utcnow()
        bundle = ml_model.predict_all(db)
    # An empty database is a state that changes a second later while the
    # seeder runs; caching "no cities yet" would turn a cold start into a
    # lasting bug.
        if bundle:
            with _LOCK:
                _cache = (started, bundle)
        logger.info(
            "Forecast cache refreshed: %d cities in %.1fs",
            len(bundle),
            (datetime.utcnow() - started).total_seconds(),
        )
        return started, bundle


def get(db: Session) -> CacheEntry:
    """
    Cached forecast if there is one, otherwise compute it now.

    Double-checked: a caller that loses the race to the compute lock waits for
    the winner's result instead of duplicating the work, which is why the
    second check after acquiring the lock is not redundant.
    """
    cached = peek()
    if cached is not None:
        return cached

    with _COMPUTE_LOCK:
        cached = peek()
        if cached is not None:
            logger.info("Forecast was computed while this request waited")
            return cached
        logger.info("Forecast cache cold — computing on the request path")
        return refresh(db)
