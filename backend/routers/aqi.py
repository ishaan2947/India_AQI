"""AQI reading endpoints + admin/refresh + stats."""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..services.fetcher import fetch_all_cities

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["aqi"])


@router.get("/aqi/current", response_model=List[schemas.CityWithLatest])
def current_aqi(db: Session = Depends(get_db)) -> List[schemas.CityWithLatest]:
    """Latest AQI reading for every city (one row per city)."""
    latest = crud.latest_reading_per_city(db)
    out: List[schemas.CityWithLatest] = []
    for city in crud.list_cities(db):
        reading = latest.get(city.id)
        out.append(
            schemas.CityWithLatest(
                id=city.id,
                name=city.name,
                state=city.state,
                lat=city.lat,
                lng=city.lng,
                created_at=city.created_at,
                latest_aqi=reading.aqi_value if reading else None,
                latest_pm25=reading.pm25 if reading else None,
                latest_timestamp=reading.timestamp if reading else None,
                latest_source=reading.source if reading else None,
            )
        )
    return out


@router.get("/aqi/{city_id}/history", response_model=List[schemas.AQIReadingRead])
def city_history(
    city_id: int,
    hours: int = Query(24, ge=1, le=720),
    db: Session = Depends(get_db),
) -> List[schemas.AQIReadingRead]:
    """Historical readings for a city within the last `hours` hours."""
    if crud.get_city(db, city_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")
    return crud.readings_in_window(db, city_id, hours=hours)  # type: ignore[return-value]


@router.get("/aqi/{city_id}/latest", response_model=schemas.AQIReadingRead)
def city_latest(city_id: int, db: Session = Depends(get_db)) -> schemas.AQIReadingRead:
    """Most-recent reading for a single city."""
    if crud.get_city(db, city_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

    reading = crud.latest_reading(db, city_id)
    if reading is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No readings recorded for this city yet",
        )
    return reading  # type: ignore[return-value]


@router.post("/admin/refresh", response_model=schemas.RefreshResponse)
async def admin_refresh(db: Session = Depends(get_db)) -> schemas.RefreshResponse:
    """Force an immediate fetch of new AQI data for all cities."""
    stored = await fetch_all_cities(db)
    return schemas.RefreshResponse(
        stored_readings=stored,
        message=f"Stored {stored} new readings",
    )


def _stats_response(db: Session, *, label: str, worst: bool, limit: int = 10) -> schemas.StatsResponse:
    latest = crud.latest_reading_per_city(db)
    entries: List[schemas.StatsCityEntry] = []
    for city in crud.list_cities(db):
        reading = latest.get(city.id)
        if reading is None:
            continue
        entries.append(
            schemas.StatsCityEntry(
                city_id=city.id,
                city_name=city.name,
                state=city.state,
                aqi_value=reading.aqi_value,
                pm25=reading.pm25,
                timestamp=reading.timestamp,
            )
        )
    entries.sort(key=lambda e: e.aqi_value, reverse=worst)
    return schemas.StatsResponse(label=label, entries=entries[:limit])


@router.get("/stats/worst", response_model=schemas.StatsResponse)
def stats_worst(db: Session = Depends(get_db)) -> schemas.StatsResponse:
    """Top 10 most polluted cities right now."""
    return _stats_response(db, label="Most polluted cities", worst=True)


@router.get("/stats/best", response_model=schemas.StatsResponse)
def stats_best(db: Session = Depends(get_db)) -> schemas.StatsResponse:
    """Top 10 cleanest cities right now."""
    return _stats_response(db, label="Cleanest cities", worst=False)
