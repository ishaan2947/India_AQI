"""
Tests for the forecasting half of `services.ml_model`.

Most of these drive a stub estimator rather than a real `RandomForest`.
That is a deliberate choice: the behaviour worth protecting here is *our*
code — the recursive 24-step loop, the output clamp, the confidence
formula, the history padding — not sklearn's, which has its own suite.
Stubbing also makes each assertion exact instead of "roughly 140", and
keeps the file fast enough to stay in the pre-commit loop.

The stub itself lives in `conftest.py` as the `make_forest` /
`stub_model` fixtures, since the prediction endpoint tests need it too.

Two tests do fit a real forest, to prove `train_model` wires the pieces
together and persists what it produces.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np
import pytest
from sklearn.ensemble import RandomForestRegressor

from backend import crud
from backend.services import ml_model
from backend.services.ml_model import (
    HORIZON_HOURS,
    ROLLING_LONG_HOURS,
    _predict_with_confidence,
    _seed_history_for_city,
    predict_city,
    train_model,
)

# ---------------------------------------------------------------------------
# Confidence
# ---------------------------------------------------------------------------


def test_unanimous_trees_give_full_confidence(make_forest):
    """Zero spread across the ensemble is maximum confidence."""
    forest = make_forest(150.0, 150.0, 150.0)

    mean, confidence = _predict_with_confidence(forest, np.zeros((1, 9)))

    assert mean == pytest.approx(150.0)
    assert confidence == pytest.approx(1.0)


def test_disagreeing_trees_reduce_confidence(make_forest):
    """Confidence is 1 - (stddev / mean), so spread costs exactly that."""
    forest = make_forest(100.0, 200.0)

    mean, confidence = _predict_with_confidence(forest, np.zeros((1, 9)))

    assert mean == pytest.approx(150.0)
    # stddev 50 over mean 150 -> relative spread 1/3.
    assert confidence == pytest.approx(1.0 - 50.0 / 150.0)


def test_confidence_never_goes_negative(make_forest):
    """
    Spread can exceed the mean, which would make `1 - relative` negative.
    The result has to stay a valid [0, 1] score because the API publishes
    it directly as `confidence_score`.
    """
    forest = make_forest(0.0, 0.0, 1000.0)

    _, confidence = _predict_with_confidence(forest, np.zeros((1, 9)))

    assert confidence == 0.0


def test_non_positive_mean_falls_back_to_neutral_confidence(make_forest):
    """A zero or negative mean can't be normalised against, so 0.5 is used."""
    forest = make_forest(0.0, 0.0)

    mean, confidence = _predict_with_confidence(forest, np.zeros((1, 9)))

    assert mean == pytest.approx(0.0)
    assert confidence == pytest.approx(0.5)


# ---------------------------------------------------------------------------
# History seeding
# ---------------------------------------------------------------------------


def test_seed_history_returns_real_values_when_history_is_long_enough(
    db_session, city, make_readings
):
    written = make_readings(city, hours=30)

    history = _seed_history_for_city(db_session, city)

    assert history == written
    assert len(history) == 30


def test_short_history_is_left_padded_to_the_long_window(db_session, city, make_readings):
    """
    `predict_city` indexes `history[-24:]`, so anything shorter than 24
    would silently produce a rolling mean over fewer hours. Padding keeps
    the window length honest.
    """
    written = make_readings(city, hours=3)  # 100, 110, 120

    history = _seed_history_for_city(db_session, city)

    assert len(history) == ROLLING_LONG_HOURS
    assert history[-3:] == written
    # Padding is the mean of what we do have, not a zero that would drag
    # the rolling features down.
    assert history[:-3] == [pytest.approx(110.0)] * (ROLLING_LONG_HOURS - 3)


def test_city_with_no_history_gets_a_neutral_default(db_session, city):
    """A brand-new city still has to be forecastable."""
    history = _seed_history_for_city(db_session, city)

    assert len(history) == ROLLING_LONG_HOURS
    assert set(history) == {120.0}


# ---------------------------------------------------------------------------
# The forecast loop
# ---------------------------------------------------------------------------


def test_forecast_covers_the_full_horizon_at_hourly_steps(
    db_session, city, make_readings, stub_model
):
    stub_model(150.0)
    make_readings(city, hours=30)

    points = predict_city(db_session, city)

    assert len(points) == HORIZON_HOURS
    timestamps = [ts for ts, _, _ in points]
    gaps = {b - a for a, b in zip(timestamps, timestamps[1:], strict=False)}
    assert gaps == {timedelta(hours=1)}
    assert timestamps[0] > datetime.utcnow()


def test_forecast_feeds_its_own_output_back_as_the_next_lag(
    db_session, city, make_readings, stub_model
):
    """
    The loop is recursive — step N+1's lag_1 is step N's prediction. If that
    append were dropped, every step would forecast from the same stale
    history and the 24h curve would flatten into a straight line.
    """
    forest = stub_model(210.0)
    make_readings(city, hours=30)

    points = predict_city(db_session, city)

    # lag_1 sits at index 3 of the feature row (see FEATURE_COLUMNS).
    lag_1_of_second_step = forest.rows_seen[1][3]
    assert lag_1_of_second_step == pytest.approx(points[0][1])


def test_forecast_is_clamped_to_a_plausible_aqi_range(
    db_session, city, make_readings, stub_model
):
    """
    A model asked to extrapolate can return absurd values. The API contract
    is a real-world AQI, so the loop clamps to [10, 500].
    """
    stub_model(99_999.0)
    make_readings(city, hours=30)

    high = predict_city(db_session, city)
    assert {aqi for _, aqi, _ in high} == {500.0}

    stub_model(-4_000.0)
    low = predict_city(db_session, city)
    assert {aqi for _, aqi, _ in low} == {10.0}


def test_forecast_rounds_for_a_stable_api_payload(db_session, city, make_readings, stub_model):
    """AQI to 1dp and confidence to 3dp — asserted so the shape can't drift."""
    stub_model(123.456_789, 130.0)
    make_readings(city, hours=30)

    points = predict_city(db_session, city)

    for _, aqi, confidence in points:
        assert aqi == round(aqi, 1)
        assert confidence == round(confidence, 3)
        assert 0.0 <= confidence <= 1.0


def test_forecast_is_persisted_for_later_reads(db_session, city, make_readings, stub_model):
    stub_model(150.0)
    make_readings(city, hours=30)

    points = predict_city(db_session, city)
    stored = crud.get_predictions(db_session, city.id)

    assert len(stored) == len(points)
    assert [p.prediction_for for p in stored] == [ts for ts, _, _ in points]


def test_rerunning_a_forecast_replaces_rather_than_accumulates(
    db_session, city, make_readings, stub_model
):
    """
    `replace_predictions` deletes before inserting. Without that, every
    `/predictions` request would add another 24 rows and the endpoint would
    start returning a growing pile of stale forecasts.
    """
    stub_model(150.0)
    make_readings(city, hours=30)

    predict_city(db_session, city)
    predict_city(db_session, city)

    assert len(crud.get_predictions(db_session, city.id)) == HORIZON_HOURS


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def test_training_on_real_history_produces_a_usable_forest(db_session, cities, make_readings):
    """End-to-end over the real estimator: 3 cities x 40h clears the
    100-row threshold, so no synthetic warm-start is involved."""
    for city in cities:
        make_readings(city, hours=40)

    model = train_model(db_session)

    assert isinstance(model, RandomForestRegressor)
    prediction = model.predict(np.array([[12, 2, 6, 150.0, 140.0, 130.0, 140.0, 135.0, 1]]))
    assert prediction.shape == (1,)
    assert np.isfinite(prediction[0])


def test_training_persists_the_model_and_caches_it(db_session, cities, make_readings):
    """A restart must not have to retrain, and a second call must not refit."""
    for city in cities:
        make_readings(city, hours=40)

    model = train_model(db_session)

    assert ml_model.MODEL_PATH.exists()
    assert ml_model._loaded_model is model


def test_training_refuses_to_run_with_no_usable_rows(db_session, monkeypatch):
    """
    A fresh DB normally falls back to synthetic warm-start data. If that
    fallback ever yields nothing either, failing loudly beats fitting on an
    empty matrix and serving whatever comes out.
    """
    import pandas as pd

    monkeypatch.setattr(
        ml_model,
        "_synthetic_training_frame",
        lambda *a, **k: pd.DataFrame(columns=["city_id", "timestamp", "aqi_value"]),
    )

    with pytest.raises(RuntimeError, match="No usable rows"):
        train_model(db_session)
