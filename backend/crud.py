"""
Database CRUD helpers.

All persistence logic for cities, readings, and predictions lives here so
that routers and services stay thin and easy to test.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING, List, Optional, Sequence

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from . import models

if TYPE_CHECKING:
    from .services.fetcher import AQISample


# ---------------------------------------------------------------------------
# Cities
# ---------------------------------------------------------------------------


def create_city(
    db: Session,
    *,
    name: str,
    state: str,
    lat: float,
    lng: float,
) -> models.City:
    city = models.City(name=name, state=state, lat=lat, lng=lng)
    db.add(city)
    db.commit()
    db.refresh(city)
    return city


def get_city(db: Session, city_id: int) -> Optional[models.City]:
    return db.get(models.City, city_id)


def get_city_by_name(db: Session, name: str) -> Optional[models.City]:
    return db.query(models.City).filter(models.City.name == name).first()


def list_cities(db: Session) -> List[models.City]:
    return db.query(models.City).order_by(models.City.name.asc()).all()


# ---------------------------------------------------------------------------
# Readings
# ---------------------------------------------------------------------------


def create_reading(
    db: Session,
    *,
    city_id: int,
    sample: "AQISample",
    timestamp: Optional[datetime] = None,
) -> models.AQIReading:
    reading = models.AQIReading(
        city_id=city_id,
        aqi_value=sample.aqi_value,
        pm25=sample.pm25,
        pm10=sample.pm10,
        o3=sample.o3,
        no2=sample.no2,
        so2=sample.so2,
        co=sample.co,
        source=sample.source,
        timestamp=timestamp or datetime.utcnow(),
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


def latest_reading(db: Session, city_id: int) -> Optional[models.AQIReading]:
    return (
        db.query(models.AQIReading)
        .filter(models.AQIReading.city_id == city_id)
        .order_by(desc(models.AQIReading.timestamp))
        .first()
    )


def readings_in_window(
    db: Session, city_id: int, *, hours: int
) -> List[models.AQIReading]:
    """Return readings for `city_id` within the last `hours` hours, oldest first."""
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    return (
        db.query(models.AQIReading)
        .filter(
            models.AQIReading.city_id == city_id,
            models.AQIReading.timestamp >= cutoff,
        )
        .order_by(models.AQIReading.timestamp.asc())
        .all()
    )


def all_readings(db: Session) -> List[models.AQIReading]:
    """All readings across all cities, ordered chronologically. Used by ML training."""
    return (
        db.query(models.AQIReading)
        .order_by(models.AQIReading.city_id.asc(), models.AQIReading.timestamp.asc())
        .all()
    )


def count_readings(db: Session, city_id: Optional[int] = None) -> int:
    q = db.query(func.count(models.AQIReading.id))
    if city_id is not None:
        q = q.filter(models.AQIReading.city_id == city_id)
    return int(q.scalar() or 0)


def latest_reading_per_city(db: Session) -> dict[int, models.AQIReading]:
    """
    Return a {city_id: latest AQIReading} dict.

    Implemented as a Python-side scan over the most recent N readings to keep
    the query simple and database-agnostic. For 30 cities at hourly cadence
    this is trivial.
    """
    rows = (
        db.query(models.AQIReading)
        .order_by(desc(models.AQIReading.timestamp))
        .limit(2000)
        .all()
    )
    out: dict[int, models.AQIReading] = {}
    for r in rows:
        if r.city_id not in out:
            out[r.city_id] = r
    return out


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------


def create_prediction(
    db: Session,
    *,
    city_id: int,
    predicted_aqi: float,
    confidence_score: float,
    prediction_for: datetime,
) -> models.Prediction:
    pred = models.Prediction(
        city_id=city_id,
        predicted_aqi=predicted_aqi,
        confidence_score=confidence_score,
        prediction_for=prediction_for,
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)
    return pred


def replace_predictions(
    db: Session, *, city_id: int, points: Sequence[tuple[datetime, float, float]]
) -> List[models.Prediction]:
    """
    Delete existing forecasts for `city_id` and insert the new ones atomically.

    `points` is a sequence of `(prediction_for, predicted_aqi, confidence_score)`.
    """
    db.query(models.Prediction).filter(models.Prediction.city_id == city_id).delete()
    created: List[models.Prediction] = []
    for prediction_for, aqi, conf in points:
        pred = models.Prediction(
            city_id=city_id,
            predicted_aqi=aqi,
            confidence_score=conf,
            prediction_for=prediction_for,
        )
        db.add(pred)
        created.append(pred)
    db.commit()
    for p in created:
        db.refresh(p)
    return created


def get_predictions(db: Session, city_id: int) -> List[models.Prediction]:
    return (
        db.query(models.Prediction)
        .filter(models.Prediction.city_id == city_id)
        .order_by(models.Prediction.prediction_for.asc())
        .all()
    )
