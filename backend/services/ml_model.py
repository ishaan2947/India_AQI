"""
Machine-learning forecaster for AQI.

Pipeline
--------
1. **Feature engineering** — for each historical reading we build a feature
   vector of (hour, day-of-week, month, lag-1, lag-2, lag-3, rolling 6h mean,
   rolling 24h mean, city_id) and the supervised target is the AQI one hour
   ahead.
2. **Model** — :class:`sklearn.ensemble.RandomForestRegressor`. RF was chosen
   over GBM/XGB because it trains in seconds on 30 cities × a few weeks of
   hourly data, requires no scaling, and the per-tree variance gives us a
   cheap pseudo-confidence-interval without a separate quantile model.
3. **Persistence** — `joblib.dump` to `model.joblib` so the trained estimator
   survives process restarts.

If there isn't enough real history to train on (< 100 readings) we fall back
to a synthetic warm-start dataset, then continue retraining as real data
flows in.
"""

from __future__ import annotations

import logging
import math
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sqlalchemy.orm import Session

from .. import crud, models

logger = logging.getLogger(__name__)

MODEL_PATH: Path = Path(__file__).resolve().parent.parent / "model.joblib"
MIN_TRAINING_ROWS: int = 100
HORIZON_HOURS: int = 24
ROLLING_SHORT_HOURS: int = 6
ROLLING_LONG_HOURS: int = 24

FEATURE_COLUMNS: list[str] = [
    "hour",
    "dow",
    "month",
    "lag_1",
    "lag_2",
    "lag_3",
    "rolling_6h",
    "rolling_24h",
    "city_id",
]


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------


def _readings_to_dataframe(readings: list[models.AQIReading]) -> pd.DataFrame:
    if not readings:
        return pd.DataFrame(
            columns=["city_id", "timestamp", "aqi_value"]
        )
    rows = [
        {"city_id": r.city_id, "timestamp": r.timestamp, "aqi_value": r.aqi_value}
        for r in readings
    ]
    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df.sort_values(["city_id", "timestamp"]).reset_index(drop=True)


def _build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Build feature matrix + `target` column. Rows with NaN features are dropped."""
    if df.empty:
        return df.assign(
            hour=[], dow=[], month=[],
            lag_1=[], lag_2=[], lag_3=[],
            rolling_6h=[], rolling_24h=[], target=[],
        )

    df = df.copy()
    df["hour"] = df["timestamp"].dt.hour
    df["dow"] = df["timestamp"].dt.dayofweek
    df["month"] = df["timestamp"].dt.month

    grouped = df.groupby("city_id", group_keys=False)
    df["lag_1"] = grouped["aqi_value"].shift(1)
    df["lag_2"] = grouped["aqi_value"].shift(2)
    df["lag_3"] = grouped["aqi_value"].shift(3)
    df["rolling_6h"] = grouped["aqi_value"].transform(
        lambda s: s.shift(1).rolling(ROLLING_SHORT_HOURS, min_periods=1).mean()
    )
    df["rolling_24h"] = grouped["aqi_value"].transform(
        lambda s: s.shift(1).rolling(ROLLING_LONG_HOURS, min_periods=1).mean()
    )
    df["target"] = grouped["aqi_value"].shift(-1)

    return df.dropna(subset=FEATURE_COLUMNS + ["target"]).reset_index(drop=True)


# ---------------------------------------------------------------------------
# Synthetic warm-start
# ---------------------------------------------------------------------------


def _synthetic_training_frame(n_cities: int = 5, hours: int = 30 * 24) -> pd.DataFrame:
    """Generate a fake history to warm-start the model on a fresh DB."""
    base_time = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    rows: list[dict[str, object]] = []
    for city_id in range(1, n_cities + 1):
        seed = city_id * 17
        for h in range(hours, 0, -1):
            ts = base_time - timedelta(hours=h)
            hr = ts.hour
            morning = math.exp(-((hr - 8.0) ** 2) / 6.0)
            evening = math.exp(-((hr - 20.0) ** 2) / 6.0)
            diurnal = 0.55 * morning + 0.45 * evening
            aqi = 80 + seed + 140 * diurnal + random.uniform(-20, 20)
            rows.append(
                {"city_id": city_id, "timestamp": ts, "aqi_value": max(20.0, aqi)}
            )
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Training / loading
# ---------------------------------------------------------------------------


_loaded_model: Optional[RandomForestRegressor] = None


def _save_model(model: RandomForestRegressor) -> None:
    joblib.dump(model, MODEL_PATH)
    global _loaded_model
    _loaded_model = model


def _load_model() -> Optional[RandomForestRegressor]:
    global _loaded_model
    if _loaded_model is not None:
        return _loaded_model
    if MODEL_PATH.exists():
        try:
            _loaded_model = joblib.load(MODEL_PATH)
            return _loaded_model
        except Exception as exc:  # pragma: no cover - corrupted model file
            logger.warning("Failed to load model at %s: %s", MODEL_PATH, exc)
    return None


def train_model(db: Session) -> RandomForestRegressor:
    """
    Train a fresh Random Forest on whatever data the DB currently holds.

    Falls back to synthetic data if we don't yet have enough real readings.
    Saves the trained model to disk and returns it.
    """
    readings = crud.all_readings(db)
    df = _readings_to_dataframe(readings)

    if len(df) < MIN_TRAINING_ROWS:
        logger.info(
            "Only %d real readings — augmenting with synthetic warm-start data",
            len(df),
        )
        df = pd.concat([_synthetic_training_frame(), df], ignore_index=True)

    features = _build_features(df)
    if features.empty:
        raise RuntimeError("No usable rows for ML training")

    X = features[FEATURE_COLUMNS].values
    y = features["target"].values

    model = RandomForestRegressor(
        n_estimators=120,
        max_depth=14,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X, y)
    _save_model(model)
    logger.info("Trained Random Forest on %d rows (features: %s)", len(features), FEATURE_COLUMNS)
    return model


def _predict_with_confidence(
    model: RandomForestRegressor, feature_row: np.ndarray
) -> Tuple[float, float]:
    """
    Run an ensemble prediction and derive a confidence score in [0, 1].

    Confidence is `1 - normalised_stddev` of the per-tree predictions.
    """
    per_tree = np.array([tree.predict(feature_row)[0] for tree in model.estimators_])
    mean_pred = float(per_tree.mean())
    std_pred = float(per_tree.std())

    # Normalise std by mean to get a relative spread, then squash into [0,1].
    if mean_pred <= 0:
        confidence = 0.5
    else:
        relative = std_pred / mean_pred
        confidence = float(max(0.0, min(1.0, 1.0 - relative)))
    return mean_pred, confidence


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------


def _seed_history_for_city(db: Session, city: models.City) -> list[float]:
    """Return the last few AQI values for `city`, oldest first, padded if needed."""
    readings = crud.readings_in_window(db, city.id, hours=72)
    values = [r.aqi_value for r in readings]
    if len(values) < ROLLING_LONG_HOURS:
        # Pad on the left with the mean of what we have, or a sensible default.
        mean = float(np.mean(values)) if values else 120.0
        values = [mean] * (ROLLING_LONG_HOURS - len(values)) + values
    return values


def predict_city(
    db: Session, city: models.City
) -> list[tuple[datetime, float, float]]:
    """
    Generate a `HORIZON_HOURS`-step ahead forecast for one city.

    Returns a list of `(prediction_for_ts, predicted_aqi, confidence)`.
    """
    model = _load_model() or train_model(db)
    history = _seed_history_for_city(db, city)

    now = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    out: list[tuple[datetime, float, float]] = []

    for step in range(1, HORIZON_HOURS + 1):
        forecast_ts = now + timedelta(hours=step)
        lag_1 = history[-1]
        lag_2 = history[-2]
        lag_3 = history[-3]
        rolling_6h = float(np.mean(history[-ROLLING_SHORT_HOURS:]))
        rolling_24h = float(np.mean(history[-ROLLING_LONG_HOURS:]))

        row = np.array(
            [[
                forecast_ts.hour,
                forecast_ts.weekday(),
                forecast_ts.month,
                lag_1,
                lag_2,
                lag_3,
                rolling_6h,
                rolling_24h,
                city.id,
            ]]
        )
        predicted, confidence = _predict_with_confidence(model, row)
        predicted = float(max(10.0, min(500.0, predicted)))
        out.append((forecast_ts, round(predicted, 1), round(confidence, 3)))
        history.append(predicted)

    # Persist so the /predictions endpoints can be served quickly even when
    # the model isn't loaded yet.
    crud.replace_predictions(db, city_id=city.id, points=out)
    return out


def predict_all(db: Session) -> list[tuple[int, str, list[tuple[datetime, float, float]]]]:
    """Forecast every city. Returns `(city_id, city_name, points)` triples."""
    out: list[tuple[int, str, list[tuple[datetime, float, float]]]] = []
    for city in crud.list_cities(db):
        try:
            points = predict_city(db, city)
            out.append((city.id, city.name, points))
        except Exception as exc:  # pragma: no cover - keep one bad city from breaking the batch
            logger.exception("Prediction failed for %s: %s", city.name, exc)
    return out
