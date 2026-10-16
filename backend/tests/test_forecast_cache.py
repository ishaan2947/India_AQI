"""
Tests for the whole-country forecast cache.

The thing being protected here is a production outage, not a nicety: the
uncached endpoint took over two minutes on Render's free tier, which is past
the frontend's HTTP timeout, so the forecasts page failed rather than loaded.
The three properties that keep that fixed are "compute once", "an empty
database is never cached", and "clear() means clear".
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from backend.services import forecast_cache, ml_model


@pytest.fixture(name="counted_predict")
def counted_predict_fixture(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """Replace the expensive prediction with a counter."""
    calls: list[int] = []

    def fake_predict_all(db: Session) -> list[ml_model.CityForecast]:
        calls.append(1)
        return [
            (1, "Delhi", [(datetime(2026, 1, 1, 12), 210.0, 0.9)]),
        ]

    monkeypatch.setattr(ml_model, "predict_all", fake_predict_all)
    return calls


def test_the_forecast_is_computed_once_and_then_served_from_memory(
    db_session: Session, counted_predict: list[int]
) -> None:
    first_at, first = forecast_cache.get(db_session)
    second_at, second = forecast_cache.get(db_session)

    assert len(counted_predict) == 1
    assert second is first
    assert second_at == first_at


def test_clear_forces_a_recompute(
    db_session: Session, counted_predict: list[int]
) -> None:
    forecast_cache.get(db_session)
    forecast_cache.clear()
    forecast_cache.get(db_session)

    assert len(counted_predict) == 2


def test_an_expired_entry_is_recomputed(
    db_session: Session, counted_predict: list[int], monkeypatch: pytest.MonkeyPatch
) -> None:
    """The TTL is a backstop for a scheduler that stopped refreshing."""
    monkeypatch.setattr(forecast_cache, "TTL", timedelta(seconds=0))

    forecast_cache.get(db_session)
    forecast_cache.get(db_session)

    assert len(counted_predict) == 2


def test_an_empty_database_is_never_cached(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    """
    No cities yet is a state that changes a second later while the seeder
    runs. Caching it would turn a cold start into a lasting bug.
    """
    calls: list[int] = []

    def empty_predict_all(db: Session) -> list[ml_model.CityForecast]:
        calls.append(1)
        return []

    monkeypatch.setattr(ml_model, "predict_all", empty_predict_all)

    forecast_cache.get(db_session)
    forecast_cache.get(db_session)

    assert len(calls) == 2
    assert forecast_cache.peek() is None


def test_refresh_reports_when_it_computed_not_when_it_was_asked(
    db_session: Session, counted_predict: list[int]
) -> None:
    """
    `generated_at` travels with the bundle, so a cached forecast tells the UI
    how old it really is instead of claiming to be fresh on every request.
    """
    computed_at, _ = forecast_cache.refresh(db_session)
    later_at, _ = forecast_cache.get(db_session)

    assert later_at == computed_at
    assert len(counted_predict) == 1


def test_the_api_serves_the_cached_bundle(
    client, cities, counted_predict: list[int]
) -> None:
    """The endpoint itself must not recompute per request."""
    first = client.get("/api/predictions/all")
    second = client.get("/api/predictions/all")

    assert first.status_code == 200
    assert second.status_code == 200
    assert len(counted_predict) == 1
    assert first.json()["generated_at"] == second.json()["generated_at"]
