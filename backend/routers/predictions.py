"""ML prediction endpoints."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta
from typing import Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..services import ml_model

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/predictions", tags=["predictions"])

# ---------------------------------------------------------------------------
# /all is expensive and nearly static, so it is cached.
#
# The whole-country forecast is 30 cities x 24 recursive steps, and every step
# polls 120 trees for a variance estimate: ~20s on a developer laptop and
# worse on Render's free tier, which made the forecasts page look broken for
# the first twenty seconds of every visit.
#
# Nothing underneath it moves anywhere near that fast. Readings arrive hourly
# and the model retrains daily, so a forecast computed ten minutes ago is the
# same forecast. A single-slot TTL cache turns every visit after the first
# into a sub-millisecond response, and the staleness it can introduce is
# bounded by TTL and reported in `generated_at`, which the UI already shows as
# "model run N min ago".
#
# Deliberately a plain module global rather than a cache library: there is one
# entry, one writer, and one process. The test suite clears it between tests
# (see conftest), because a cache that outlives a test is a test that passes
# for the wrong reason.
# ---------------------------------------------------------------------------
PREDICTION_CACHE_TTL = timedelta(
    seconds=int(os.getenv("PREDICTION_CACHE_TTL_SECONDS", "600"))
)
_all_cache: Optional[Tuple[datetime, schemas.AllPredictionsResponse]] = None


def clear_prediction_cache() -> None:
    """Drop the cached whole-country forecast. Used by tests and /admin."""
    global _all_cache
    _all_cache = None


def _to_response(
    *, city_id: int, city_name: str, points: list[tuple[datetime, float, float]]
) -> schemas.PredictionResponse:
    return schemas.PredictionResponse(
        city_id=city_id,
        city_name=city_name,
        generated_at=datetime.utcnow(),
        horizon_hours=len(points),
        points=[
            schemas.PredictionPoint(
                prediction_for=ts,
                predicted_aqi=aqi,
                confidence_score=conf,
            )
            for ts, aqi, conf in points
        ],
    )


@router.get("/all", response_model=schemas.AllPredictionsResponse)
def predictions_for_all(db: Session = Depends(get_db)) -> schemas.AllPredictionsResponse:
    """Next-24-hour forecast for every city."""
    global _all_cache

    now = datetime.utcnow()
    if _all_cache is not None:
        computed_at, cached = _all_cache
        if now - computed_at < PREDICTION_CACHE_TTL:
            return cached
        logger.info("Whole-country forecast cache expired; recomputing")

    bundle = ml_model.predict_all(db)
    payload = [
        _to_response(city_id=city_id, city_name=name, points=points)
        for city_id, name, points in bundle
    ]
    response = schemas.AllPredictionsResponse(
        generated_at=now,
        predictions=payload,
    )
    # Only cache a real answer: an empty database is a state that can change
    # in the next second (the seeder is still running), and caching "no cities
    # yet" for ten minutes would be a cold-start bug.
    if payload:
        _all_cache = (now, response)
    return response


@router.get("/{city_id}", response_model=schemas.PredictionResponse)
def predictions_for_city(
    city_id: int, db: Session = Depends(get_db)
) -> schemas.PredictionResponse:
    """Next-24-hour forecast for a single city."""
    city = crud.get_city(db, city_id)
    if city is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

    points = ml_model.predict_city(db, city)
    return _to_response(city_id=city.id, city_name=city.name, points=points)
