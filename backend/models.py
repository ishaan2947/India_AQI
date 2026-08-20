"""
SQLAlchemy ORM models for the AQI India Intelligence platform.

Three tables are defined:
    * City        – the 30 Indian cities tracked by the platform.
    * AQIReading  – one row per fetched reading (hourly snapshots).
    * Prediction  – ML-generated forecasts for a future hour.

Columns use SQLAlchemy 2.0's `Mapped[...]` / `mapped_column()` style. The
practical difference over the legacy `Column()` form is that an attribute
reads back as its Python type (`city.id` is an `int`) instead of
`Column[int]`, so type checkers can see through the ORM into the router
and service layers. Nullability is still stated explicitly rather than
inferred from `Optional[...]`, to keep the emitted DDL obvious.
"""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class City(Base):
    """A monitored Indian city with geographic coordinates."""

    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    readings: Mapped[List["AQIReading"]] = relationship(
        "AQIReading",
        back_populates="city",
        cascade="all, delete-orphan",
        order_by="AQIReading.timestamp.desc()",
    )
    predictions: Mapped[List["Prediction"]] = relationship(
        "Prediction",
        back_populates="city",
        cascade="all, delete-orphan",
        order_by="Prediction.prediction_for.asc()",
    )


class AQIReading(Base):
    """A single AQI reading for a city at a given timestamp."""

    __tablename__ = "aqi_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    city_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=False
    )

    aqi_value: Mapped[float] = mapped_column(Float, nullable=False)
    pm25: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pm10: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    o3: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    no2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    so2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    co: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, index=True
    )
    # "waqi" | "openaq" | "synthetic"
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="waqi")

    city: Mapped[City] = relationship("City", back_populates="readings")

    __table_args__ = (
        Index("ix_readings_city_time", "city_id", "timestamp"),
    )


class Prediction(Base):
    """A model-generated AQI forecast for a future timestamp."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    city_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=False
    )

    predicted_aqi: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    prediction_for: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    city: Mapped[City] = relationship("City", back_populates="predictions")

    __table_args__ = (
        Index("ix_predictions_city_for", "city_id", "prediction_for"),
    )
