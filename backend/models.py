"""
SQLAlchemy ORM models for the AQI India Intelligence platform.

Three tables are defined:
    * City        – the 30 Indian cities tracked by the platform.
    * AQIReading  – one row per fetched reading (hourly snapshots).
    * Prediction  – ML-generated forecasts for a future hour.
"""

from __future__ import annotations

from datetime import datetime
from typing import List

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, relationship

from .database import Base


class City(Base):
    """A monitored Indian city with geographic coordinates."""

    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    state = Column(String(100), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

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

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)

    aqi_value = Column(Float, nullable=False)
    pm25 = Column(Float, nullable=True)
    pm10 = Column(Float, nullable=True)
    o3 = Column(Float, nullable=True)
    no2 = Column(Float, nullable=True)
    so2 = Column(Float, nullable=True)
    co = Column(Float, nullable=True)

    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    # "waqi" | "openaq" | "synthetic"
    source = Column(String(50), nullable=False, default="waqi")

    city: Mapped[City] = relationship("City", back_populates="readings")

    __table_args__ = (
        Index("ix_readings_city_time", "city_id", "timestamp"),
    )


class Prediction(Base):
    """A model-generated AQI forecast for a future timestamp."""

    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id", ondelete="CASCADE"), nullable=False)

    predicted_aqi = Column(Float, nullable=False)
    confidence_score = Column(Float, nullable=False)
    prediction_for = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    city: Mapped[City] = relationship("City", back_populates="predictions")

    __table_args__ = (
        Index("ix_predictions_city_for", "city_id", "prediction_for"),
    )
