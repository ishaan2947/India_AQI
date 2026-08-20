"""
Tests for the supervised feature engineering in `services.ml_model`.

This is the part of the codebase where a bug is least likely to announce
itself. A broken lag or an off-by-one rolling window does not raise; it
produces a model that scores well offline and forecasts badly in
production. So the assertions here are deliberately arithmetic — the
fixtures write a linear AQI ramp, which makes every expected lag and mean
something a reviewer can verify by hand rather than a number copied out
of a failing run.

Frames are built directly with fixed calendar dates instead of going
through the DB, because none of this code touches a session and the
temporal assertions need dates that never move.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import pytest

from backend.services.ml_model import (
    FEATURE_COLUMNS,
    ROLLING_LONG_HOURS,
    ROLLING_SHORT_HOURS,
    _build_features,
    _readings_to_dataframe,
)

# 2024-01-01 was a Monday, so `dayofweek` reads 0 here and the day/year
# rollover cases below stay easy to reason about.
MONDAY = datetime(2024, 1, 1, 0, 0, 0)


def ramp_frame(
    *,
    hours: int,
    city_id: int = 1,
    start_at: datetime = MONDAY,
    start: float = 100.0,
    step: float = 10.0,
) -> pd.DataFrame:
    """One city, `hours` consecutive hourly rows, AQI rising by `step`."""
    return pd.DataFrame(
        [
            {
                "city_id": city_id,
                "timestamp": start_at + timedelta(hours=i),
                "aqi_value": start + step * i,
            }
            for i in range(hours)
        ]
    )


# ---------------------------------------------------------------------------
# Frame construction
# ---------------------------------------------------------------------------


def test_readings_to_dataframe_sorts_by_city_then_time(db_session, cities, make_readings):
    """Rows must come back grouped by city and chronological within a city."""
    for city in cities:
        make_readings(city, hours=3)

    from backend import crud

    df = _readings_to_dataframe(crud.all_readings(db_session))

    assert list(df.columns) == ["city_id", "timestamp", "aqi_value"]
    assert df["city_id"].is_monotonic_increasing
    for _, group in df.groupby("city_id"):
        assert group["timestamp"].is_monotonic_increasing


def test_readings_to_dataframe_handles_no_readings():
    """An empty DB must produce an empty frame with the right shape, not raise."""
    df = _readings_to_dataframe([])

    assert df.empty
    assert list(df.columns) == ["city_id", "timestamp", "aqi_value"]


# ---------------------------------------------------------------------------
# Lag features
# ---------------------------------------------------------------------------


def test_lags_reference_the_three_preceding_hours():
    """lag_1/2/3 are the previous three readings, in that order."""
    features = _build_features(ramp_frame(hours=8))

    # Rows 0-2 lack a full set of lags and the final row lacks a target,
    # so an 8-row ramp yields rows for original positions 3..6.
    first = features.iloc[0]
    assert first["aqi_value"] == 130.0  # position 3 of the ramp
    assert first["lag_1"] == 120.0
    assert first["lag_2"] == 110.0
    assert first["lag_3"] == 100.0


def test_rows_without_a_full_lag_window_are_dropped():
    """The first three rows per city can't have lag_3 and must not survive."""
    features = _build_features(ramp_frame(hours=8))

    assert len(features) == 4
    assert features["aqi_value"].tolist() == [130.0, 140.0, 150.0, 160.0]
    assert not features[FEATURE_COLUMNS].isna().any().any()


def test_lags_do_not_leak_across_cities():
    """
    The groupby is the only thing stopping city B's first rows from taking
    city A's values as their history. Interleave the two cities so the test
    fails if the grouping is ever dropped or replaced with a plain shift.
    """
    quiet = ramp_frame(hours=8, city_id=1, start=100.0, step=0.0)  # constant 100
    filthy = ramp_frame(hours=8, city_id=2, start=400.0, step=0.0)  # constant 400
    interleaved = (
        pd.concat([quiet, filthy]).sort_values("timestamp").reset_index(drop=True)
    )

    features = _build_features(interleaved)

    for city_id, expected in ((1, 100.0), (2, 400.0)):
        rows = features[features["city_id"] == city_id]
        assert not rows.empty
        for column in ("lag_1", "lag_2", "lag_3", "rolling_6h", "rolling_24h"):
            assert (rows[column] == expected).all(), (
                f"city {city_id} {column} picked up another city's readings"
            )


# ---------------------------------------------------------------------------
# Rolling features
# ---------------------------------------------------------------------------


def test_rolling_means_exclude_the_current_reading():
    """
    Both rolling windows are built on `.shift(1)`.

    If that shift is ever lost, each row's mean would include its own AQI —
    the model would be trained on a feature containing its own answer, and
    it would look excellent in validation and fail in production. This is
    the single most important assertion in the file.
    """
    features = _build_features(ramp_frame(hours=12))
    row = features[features["aqi_value"] == 200.0].iloc[0]  # ramp position 10

    # Positions 4..9 — the six readings strictly before this one.
    assert row["rolling_6h"] == pytest.approx(165.0)
    # Including the current reading would give mean(150..200) = 175.0.
    assert row["rolling_6h"] != pytest.approx(175.0)


def test_rolling_windows_use_their_configured_lengths():
    """
    The 6h and 24h means must actually differ.

    On a rising ramp a short window sits higher than a long one; if both
    constants were wired to the same value this would collapse to equality.
    """
    features = _build_features(ramp_frame(hours=12))
    row = features[features["aqi_value"] == 200.0].iloc[0]

    assert ROLLING_SHORT_HOURS != ROLLING_LONG_HOURS
    # 6h  -> mean of positions 4..9  = 165.0
    # 24h -> window longer than the data, so mean of positions 0..9 = 145.0
    assert row["rolling_6h"] == pytest.approx(165.0)
    assert row["rolling_24h"] == pytest.approx(145.0)
    assert row["rolling_6h"] > row["rolling_24h"]


def test_rolling_means_backfill_from_a_partial_window():
    """
    `min_periods=1` means an early row averages however much history exists
    rather than going NaN and being dropped. Position 3 has only three
    prior readings, and must survive with their mean.
    """
    features = _build_features(ramp_frame(hours=8))
    first = features.iloc[0]

    assert first["rolling_6h"] == pytest.approx(110.0)  # mean(100, 110, 120)
    assert first["rolling_24h"] == pytest.approx(110.0)


# ---------------------------------------------------------------------------
# Temporal features
# ---------------------------------------------------------------------------


def test_temporal_features_decode_the_timestamp():
    """hour/dow/month are read off the reading's own timestamp."""
    features = _build_features(ramp_frame(hours=8, start_at=MONDAY))
    first = features.iloc[0]

    assert first["hour"] == 3  # MONDAY + 3h
    assert first["dow"] == 0  # Monday
    assert first["month"] == 1


def test_temporal_features_roll_over_midnight_and_new_year():
    """
    Hour must wrap to 0 rather than continue to 24, and the calendar fields
    must follow it across a year boundary.
    """
    # 2023-12-31 20:00 (a Sunday) through 2024-01-01 03:00.
    features = _build_features(ramp_frame(hours=8, start_at=datetime(2023, 12, 31, 20, 0)))

    assert features["hour"].tolist() == [23, 0, 1, 2]
    assert features["dow"].tolist() == [6, 0, 0, 0]  # Sunday -> Monday
    assert features["month"].tolist() == [12, 1, 1, 1]


# ---------------------------------------------------------------------------
# Target
# ---------------------------------------------------------------------------


def test_target_is_the_next_hours_reading():
    """Supervised target is t+1, which is what the forecaster assumes."""
    features = _build_features(ramp_frame(hours=8))

    for _, row in features.iterrows():
        assert row["target"] == pytest.approx(row["aqi_value"] + 10.0)


def test_final_reading_per_city_is_dropped_for_having_no_target():
    """The newest reading has nothing to predict, so it can't be a sample."""
    features = _build_features(ramp_frame(hours=8))

    assert 170.0 not in features["aqi_value"].tolist()  # the last ramp value
    assert features["aqi_value"].max() == 160.0


def test_target_does_not_leak_across_cities():
    """City A's last row must not take city B's first reading as its target."""
    a = ramp_frame(hours=6, city_id=1, start=100.0, step=10.0)
    b = ramp_frame(hours=6, city_id=2, start=900.0, step=10.0)

    features = _build_features(pd.concat([a, b]).reset_index(drop=True))

    city_a = features[features["city_id"] == 1]
    assert city_a["target"].max() < 900.0


# ---------------------------------------------------------------------------
# Degenerate input
# ---------------------------------------------------------------------------


def test_empty_frame_produces_empty_features_without_raising():
    """
    Called on a fresh DB via `train_model`, so it must not explode — the
    caller checks `.empty` and raises a clear error of its own.
    """
    empty = pd.DataFrame(columns=["city_id", "timestamp", "aqi_value"])

    features = _build_features(empty)

    assert features.empty


def test_city_with_too_little_history_contributes_nothing():
    """Three readings can't produce a row with lag_3 and a target."""
    features = _build_features(ramp_frame(hours=3))

    assert features.empty


# ---------------------------------------------------------------------------
# Feature contract
# ---------------------------------------------------------------------------


def test_feature_column_order_is_pinned():
    """
    `train_model` fits on `features[FEATURE_COLUMNS]` while `predict_city`
    hand-builds a positional numpy row. Nothing at runtime checks the two
    agree, so reordering this list would silently feed the model an hour
    where it expects a lag. Pin the order here instead.
    """
    assert FEATURE_COLUMNS == [
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


def test_built_features_cover_every_declared_feature_column():
    """Every column the model trains on is actually produced."""
    features = _build_features(ramp_frame(hours=8))

    assert set(FEATURE_COLUMNS).issubset(features.columns)
    assert "target" in features.columns
