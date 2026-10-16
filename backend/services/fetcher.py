"""
External-API fetcher for AQI data.

Primary source: WAQI (https://aqicn.org/api/). The `demo` token is used by
default; replace with a real token in `.env` for production-grade quotas.

Be aware of what the demo token actually does: it ignores the city in the
URL and answers *every* request with one fixed station in Shanghai. Taken at
face value that writes a Chinese reading into thirty Indian cities, labelled
`waqi`, which is worse than having no data at all — the dashboard looks
healthy and is lying. So every upstream reading is checked against the city
it was requested for before it is trusted (see `_station_matches_city`), and
anything that fails the check falls through to the synthetic series, where it
is labelled `synthetic` and the UI says so.

If WAQI is unavailable or rate-limits the request, this module synthesises a
realistic reading that follows the typical Indian diurnal pollution pattern
(morning + evening peaks, overnight troughs). That keeps the dashboard alive
even when external services are down — critical for a portfolio demo.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import random
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import httpx
from sqlalchemy.orm import Session

from .. import crud

logger = logging.getLogger(__name__)

WAQI_TOKEN: str = os.getenv("WAQI_TOKEN", "demo")
WAQI_BASE_URL: str = "https://api.waqi.info/feed"

# How far a reporting station may sit from the city it is meant to represent.
# 150km is generous for metro-area stations and nowhere near far enough to let
# another country's air through.
MAX_STATION_DISTANCE_KM: float = 150.0

# Networking knobs — kept conservative to play nicely with WAQI's free tier.
HTTP_TIMEOUT_SECONDS: float = 10.0
MAX_RETRIES: int = 3
INITIAL_BACKOFF_SECONDS: float = 1.0


@dataclass
class AQISample:
    """Normalised pollutant sample returned by the fetcher."""

    aqi_value: float
    pm25: Optional[float]
    pm10: Optional[float]
    o3: Optional[float]
    no2: Optional[float]
    so2: Optional[float]
    co: Optional[float]
    source: str


def _parse_waqi_response(payload: dict[str, Any]) -> Optional[AQISample]:
    """Map a WAQI JSON payload into an :class:`AQISample`."""
    if payload.get("status") != "ok":
        return None

    data = payload.get("data") or {}
    aqi = data.get("aqi")
    if aqi is None or aqi == "-":
        return None

    iaqi: dict[str, dict[str, float]] = data.get("iaqi") or {}

    def _val(key: str) -> Optional[float]:
        node = iaqi.get(key)
        if not isinstance(node, dict):
            return None
        v = node.get("v")
        return float(v) if isinstance(v, (int, float)) else None

    try:
        aqi_value = float(aqi)
    except (TypeError, ValueError):
        return None

    return AQISample(
        aqi_value=aqi_value,
        pm25=_val("pm25"),
        pm10=_val("pm10"),
        o3=_val("o3"),
        no2=_val("no2"),
        so2=_val("so2"),
        co=_val("co"),
        source="waqi",
    )


_CITY_COORDS: Optional[dict[str, tuple[float, float]]] = None


def _city_coords() -> dict[str, tuple[float, float]]:
    """
    Lazily load the bundled city list as name -> (lat, lng).

    Read from the same JSON the database is seeded from, so the validator
    cannot drift out of step with the cities we actually monitor.
    """
    global _CITY_COORDS
    if _CITY_COORDS is None:
        path = Path(__file__).resolve().parent.parent / "data" / "indian_cities.json"
        try:
            with path.open("r", encoding="utf-8") as f:
                entries = json.load(f)
            _CITY_COORDS = {
                str(e["name"]).strip().lower(): (float(e["lat"]), float(e["lng"]))
                for e in entries
            }
        except (OSError, ValueError, KeyError) as exc:  # pragma: no cover
            logger.warning("Could not load city coordinates for validation: %s", exc)
            _CITY_COORDS = {}
    return _CITY_COORDS


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in kilometres."""
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


def _station_matches_city(payload: dict[str, Any], city_name: str) -> bool:
    """
    Is this reading actually about the city we asked for?

    Coordinates settle it when both sides have them — a station's `geo` is
    hard evidence and a station's name is not. Failing that, fall back to the
    name: WAQI station names normally carry the city ("Punjabi Bagh, Delhi"),
    and the demo token's "Shanghai (上海)" fails both tests, which is the
    point.
    """
    city = (payload.get("data") or {}).get("city") or {}
    known = _city_coords().get(city_name.strip().lower())
    geo = city.get("geo")

    if known and isinstance(geo, (list, tuple)) and len(geo) == 2:
        try:
            distance = _haversine_km(known[0], known[1], float(geo[0]), float(geo[1]))
        except (TypeError, ValueError):
            distance = None
        if distance is not None:
            if distance > MAX_STATION_DISTANCE_KM:
                logger.warning(
                    "WAQI returned a station %.0fkm from %s (%s) — ignoring it",
                    distance,
                    city_name,
                    city.get("name") or "unnamed station",
                )
                return False
            return True

    station_name = str(city.get("name") or "")
    if city_name.strip().lower() in station_name.lower():
        return True

    logger.warning(
        "WAQI returned station %r for %s — ignoring it",
        station_name or "<unnamed>",
        city_name,
    )
    return False


async def _fetch_waqi(client: httpx.AsyncClient, city_name: str) -> Optional[AQISample]:
    """
    Hit WAQI for `city_name`, retrying with exponential backoff.

    Returns None when the upstream consistently refuses to give us a usable
    reading, so callers can decide whether to fall back to synthetic data.
    """
    url = f"{WAQI_BASE_URL}/{city_name}/?token={WAQI_TOKEN}"
    delay = INITIAL_BACKOFF_SECONDS

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.get(url, timeout=HTTP_TIMEOUT_SECONDS)
            if response.status_code == 429:
                logger.warning("WAQI rate-limited for %s (attempt %d)", city_name, attempt)
            elif response.status_code >= 500:
                logger.warning(
                    "WAQI %d for %s (attempt %d)", response.status_code, city_name, attempt
                )
            else:
                response.raise_for_status()
                payload = response.json()
                sample = _parse_waqi_response(payload)
                if sample is not None:
                    # A reading for the wrong place is a definitive wrong
                    # answer, not a transient failure: don't retry it, fall
                    # through to the synthetic series instead.
                    if not _station_matches_city(payload, city_name):
                        return None
                    return sample
                logger.info("WAQI returned no usable data for %s", city_name)
                return None
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("WAQI request failed for %s: %s", city_name, exc)

        if attempt < MAX_RETRIES:
            await asyncio.sleep(delay)
            delay *= 2

    return None


def _synthetic_sample(city_name: str, now: Optional[datetime] = None) -> AQISample:
    """
    Build a plausible synthetic reading.

    The Indian diurnal pattern is reproduced with two cosine bumps centred on
    08:00 and 20:00 local time. A per-city offset keeps each city's values
    deterministic-ish across consecutive ticks while still drifting.
    """
    now = now or datetime.utcnow()
    hour = now.hour + now.minute / 60.0

    morning_peak = math.exp(-((hour - 8.0) ** 2) / 6.0)
    evening_peak = math.exp(-((hour - 20.0) ** 2) / 6.0)
    diurnal = 0.55 * morning_peak + 0.45 * evening_peak  # 0..1

    # Per-city baseline based on a hash of the name — keeps Delhi consistently
    # nastier than Kochi without us having to special-case anything.
    seed = sum(ord(c) for c in city_name) % 100
    baseline = 70 + seed * 1.7  # 70..240
    noise = random.uniform(-15, 15)
    aqi = max(20.0, min(420.0, baseline + 150.0 * diurnal + noise))

    pm25 = max(5.0, aqi * 0.6 + random.uniform(-10, 10))
    pm10 = max(10.0, aqi * 0.9 + random.uniform(-15, 15))

    return AQISample(
        aqi_value=round(aqi, 1),
        pm25=round(pm25, 1),
        pm10=round(pm10, 1),
        o3=round(random.uniform(10, 60), 1),
        no2=round(random.uniform(10, 80), 1),
        so2=round(random.uniform(2, 30), 1),
        co=round(random.uniform(0.3, 2.5), 2),
        source="synthetic",
    )


async def fetch_city_reading(
    client: httpx.AsyncClient, city_name: str
) -> AQISample:
    """Fetch a single city's reading, falling back to synthetic on failure."""
    sample = await _fetch_waqi(client, city_name)
    if sample is not None:
        return sample
    logger.info("Falling back to synthetic data for %s", city_name)
    return _synthetic_sample(city_name)


async def fetch_all_cities(db: Session) -> int:
    """
    Fetch + persist a reading for every city in the DB.

    Returns the number of readings successfully stored.
    """
    cities = crud.list_cities(db)
    if not cities:
        logger.warning("No cities in database — nothing to fetch")
        return 0

    if WAQI_TOKEN in {"", "demo"}:
        logger.warning(
            "WAQI_TOKEN is %r — the demo token answers every city with one "
            "fixed foreign station, so these readings will be rejected and "
            "the synthetic series used instead. Set a free token from "
            "https://aqicn.org/data-platform/token/ for live data.",
            WAQI_TOKEN,
        )

    stored = 0
    timeout = httpx.Timeout(HTTP_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        # Sequential to be polite to the free WAQI tier; for paid keys swap
        # to asyncio.gather with a Semaphore.
        for city in cities:
            sample = await fetch_city_reading(client, city.name)
            crud.create_reading(db, city_id=city.id, sample=sample)
            stored += 1
            logger.info(
                "Stored %s reading for %s (AQI=%.1f, source=%s)",
                sample.source, city.name, sample.aqi_value, sample.source,
            )

    return stored


def seed_cities_from_json(db: Session) -> int:
    """
    Idempotently load the bundled `data/indian_cities.json` into the DB.

    Returns the number of new cities inserted on this call.
    """
    json_path = Path(__file__).resolve().parent.parent / "data" / "indian_cities.json"
    with json_path.open("r", encoding="utf-8") as f:
        cities = json.load(f)

    inserted = 0
    for entry in cities:
        existing = crud.get_city_by_name(db, entry["name"])
        if existing is not None:
            continue
        crud.create_city(
            db,
            name=entry["name"],
            state=entry["state"],
            lat=float(entry["lat"]),
            lng=float(entry["lng"]),
        )
        inserted += 1

    if inserted:
        logger.info("Seeded %d cities into the database", inserted)
    return inserted


def backfill_synthetic_history(db: Session, hours: int = 72) -> int:
    """
    Generate `hours` of synthetic hourly history for every city.

    Useful on a fresh install so the trend chart has something to plot
    before the scheduler has run for a few days.

    Performs a single bulk-insert + commit (vs. one commit per row in the
    original implementation) — ~15× faster on Render's free-tier disk and
    crucial for keeping the cold-start under the health-check window.
    """
    from datetime import timedelta

    from ..models import AQIReading

    cities = crud.list_cities(db)
    if not cities:
        return 0

    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    rows: list[AQIReading] = []

    for city in cities:
        if crud.count_readings(db, city.id) > 0:
            continue
        for h in range(hours, 0, -1):
            ts = now - timedelta(hours=h)
            sample = _synthetic_sample(city.name, now=ts)
            rows.append(
                AQIReading(
                    city_id=city.id,
                    aqi_value=sample.aqi_value,
                    pm25=sample.pm25,
                    pm10=sample.pm10,
                    o3=sample.o3,
                    no2=sample.no2,
                    so2=sample.so2,
                    co=sample.co,
                    source=sample.source,
                    timestamp=ts,
                )
            )

    if rows:
        db.bulk_save_objects(rows)
        db.commit()
        logger.info("Backfilled %d synthetic readings across %d cities", len(rows), len(cities))
    return len(rows)
