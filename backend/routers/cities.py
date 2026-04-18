"""City-level endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db

router = APIRouter(prefix="/api/cities", tags=["cities"])


@router.get("", response_model=List[schemas.CityWithLatest])
def list_cities(db: Session = Depends(get_db)) -> List[schemas.CityWithLatest]:
    """All monitored cities, each annotated with its most-recent reading."""
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


@router.get("/{city_id}", response_model=schemas.CityWithLatest)
def get_city(city_id: int, db: Session = Depends(get_db)) -> schemas.CityWithLatest:
    """Single city, annotated with its most-recent reading."""
    city = crud.get_city(db, city_id)
    if city is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")

    reading = crud.latest_reading(db, city_id)
    return schemas.CityWithLatest(
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
