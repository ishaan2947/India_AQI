"""ML prediction endpoints."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..services import ml_model

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/predictions", tags=["predictions"])


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
    bundle = ml_model.predict_all(db)
    payload = [
        _to_response(city_id=city_id, city_name=name, points=points)
        for city_id, name, points in bundle
    ]
    return schemas.AllPredictionsResponse(
        generated_at=datetime.utcnow(),
        predictions=payload,
    )


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
