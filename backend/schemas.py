"""
Pydantic schemas used by FastAPI for request/response serialisation.

We use Pydantic v2 (`model_config = ConfigDict(from_attributes=True)`) so
that ORM objects can be returned directly from path operations.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# City
# ---------------------------------------------------------------------------


class CityBase(BaseModel):
    name: str
    state: str
    lat: float
    lng: float


class CityRead(CityBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CityWithLatest(CityRead):
    """City row plus its most-recent AQI reading (if any)."""

    latest_aqi: Optional[float] = None
    latest_pm25: Optional[float] = None
    latest_timestamp: Optional[datetime] = None
    latest_source: Optional[str] = None


# ---------------------------------------------------------------------------
# AQI readings
# ---------------------------------------------------------------------------


class AQIReadingRead(BaseModel):
    id: int
    city_id: int
    aqi_value: float
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    o3: Optional[float] = None
    no2: Optional[float] = None
    so2: Optional[float] = None
    co: Optional[float] = None
    timestamp: datetime
    source: str

    model_config = ConfigDict(from_attributes=True)


class CityWithHistory(CityRead):
    readings: List[AQIReadingRead] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Predictions
# ---------------------------------------------------------------------------


class PredictionPoint(BaseModel):
    prediction_for: datetime
    predicted_aqi: float
    confidence_score: float


class PredictionResponse(BaseModel):
    city_id: int
    city_name: str
    generated_at: datetime
    horizon_hours: int
    points: List[PredictionPoint]


class AllPredictionsResponse(BaseModel):
    generated_at: datetime
    predictions: List[PredictionResponse]


# ---------------------------------------------------------------------------
# Misc / admin
# ---------------------------------------------------------------------------


class RefreshResponse(BaseModel):
    stored_readings: int
    message: str


class StatsCityEntry(BaseModel):
    city_id: int
    city_name: str
    state: str
    aqi_value: float
    pm25: Optional[float] = None
    timestamp: datetime


class StatsResponse(BaseModel):
    label: str
    entries: List[StatsCityEntry]
