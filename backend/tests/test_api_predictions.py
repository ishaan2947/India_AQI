"""
Tests for the prediction endpoints and the admin refresh hook.

Both of these reach outward in production — one into sklearn, one into
WAQI over the network. Neither is allowed to do so here: predictions run
against the stub ensemble from `conftest`, and `/admin/refresh` has its
fetcher replaced. A test that quietly made a real HTTP call would be slow,
flaky, and dependent on someone else's rate limit.
"""

from __future__ import annotations

from datetime import datetime

import pytest

from backend.routers import aqi as aqi_router
from backend.services.ml_model import HORIZON_HOURS

# ---------------------------------------------------------------------------
# GET /api/predictions/{city_id}
# ---------------------------------------------------------------------------


def test_prediction_returns_the_full_horizon(client, city, make_readings, stub_model):
    stub_model(180.0)
    make_readings(city, hours=30)

    payload = client.get(f"/api/predictions/{city.id}").json()

    assert payload["city_id"] == city.id
    assert payload["city_name"] == "Delhi"
    assert payload["horizon_hours"] == HORIZON_HOURS
    assert len(payload["points"]) == HORIZON_HOURS


def test_prediction_points_are_chronological_and_in_the_future(
    client, city, make_readings, stub_model
):
    """The forecast chart plots these in array order, starting from now."""
    stub_model(180.0)
    make_readings(city, hours=30)

    points = client.get(f"/api/predictions/{city.id}").json()["points"]

    stamps = [p["prediction_for"] for p in points]
    assert stamps == sorted(stamps)
    assert datetime.fromisoformat(stamps[0]) > datetime.utcnow()


def test_prediction_publishes_a_normalised_confidence(client, city, make_readings, stub_model):
    """`confidence_score` is rendered as a percentage, so it must be 0..1."""
    stub_model(100.0, 140.0)
    make_readings(city, hours=30)

    points = client.get(f"/api/predictions/{city.id}").json()["points"]

    for point in points:
        assert 0.0 <= point["confidence_score"] <= 1.0
        assert 10.0 <= point["predicted_aqi"] <= 500.0


def test_prediction_for_unknown_city_is_404(client):
    response = client.get("/api/predictions/9999")

    assert response.status_code == 404
    assert response.json()["detail"] == "City not found"


def test_prediction_works_for_a_city_with_no_history(client, city, stub_model):
    """
    A newly-seeded city has no readings yet, but the map still links to its
    forecast. `_seed_history_for_city` pads, so this must be a 200.
    """
    stub_model(150.0)

    response = client.get(f"/api/predictions/{city.id}")

    assert response.status_code == 200
    assert len(response.json()["points"]) == HORIZON_HOURS


# ---------------------------------------------------------------------------
# GET /api/predictions/all
# ---------------------------------------------------------------------------


def test_all_predictions_covers_every_city(client, cities, make_readings, stub_model):
    stub_model(160.0)
    for city in cities:
        make_readings(city, hours=30)

    payload = client.get("/api/predictions/all").json()

    assert len(payload["predictions"]) == len(cities)
    assert {p["city_name"] for p in payload["predictions"]} == {c.name for c in cities}
    for prediction in payload["predictions"]:
        assert len(prediction["points"]) == HORIZON_HOURS


def test_all_predictions_on_an_empty_database(client, stub_model):
    """Cold start before seeding — an empty list, not a 500."""
    stub_model(150.0)

    payload = client.get("/api/predictions/all").json()

    assert payload["predictions"] == []


def test_one_failing_city_does_not_sink_the_batch(
    client, cities, make_readings, stub_model, monkeypatch
):
    """
    `predict_all` deliberately swallows per-city failures so a single bad
    city can't blank the whole dashboard. Force one to raise and check the
    others still come back.
    """
    stub_model(160.0)
    for city in cities:
        make_readings(city, hours=30)

    from backend.services import ml_model

    real_predict_city = ml_model.predict_city
    doomed = sorted(cities, key=lambda c: c.name)[0]

    def flaky(db, city):
        if city.id == doomed.id:
            raise RuntimeError("simulated model failure")
        return real_predict_city(db, city)

    monkeypatch.setattr(ml_model, "predict_city", flaky)

    payload = client.get("/api/predictions/all").json()

    names = {p["city_name"] for p in payload["predictions"]}
    assert doomed.name not in names
    assert len(names) == len(cities) - 1


# ---------------------------------------------------------------------------
# POST /api/admin/refresh
# ---------------------------------------------------------------------------


def test_refresh_reports_how_many_readings_were_stored(client, monkeypatch):
    """
    The real handler calls out to WAQI. Replace the fetcher at the router's
    own namespace — that is where the name was bound by the `from ... import`
    at module load, so patching `services.fetcher` would not take effect.
    """

    async def fake_fetch_all_cities(db):
        return 7

    monkeypatch.setattr(aqi_router, "fetch_all_cities", fake_fetch_all_cities)

    response = client.post("/api/admin/refresh")

    assert response.status_code == 200
    assert response.json() == {
        "stored_readings": 7,
        "message": "Stored 7 new readings",
    }


def test_refresh_passes_the_request_session_to_the_fetcher(client, db_session, monkeypatch):
    """The fetcher must write through the same session the request is using."""
    seen = {}

    async def fake_fetch_all_cities(db):
        seen["db"] = db
        return 0

    monkeypatch.setattr(aqi_router, "fetch_all_cities", fake_fetch_all_cities)

    client.post("/api/admin/refresh")

    assert seen["db"] is db_session


def test_refresh_on_an_empty_database_stores_nothing(client, monkeypatch):
    async def fake_fetch_all_cities(db):
        return 0

    monkeypatch.setattr(aqi_router, "fetch_all_cities", fake_fetch_all_cities)

    payload = client.post("/api/admin/refresh").json()

    assert payload["stored_readings"] == 0
    assert payload["message"] == "Stored 0 new readings"


def test_refresh_is_not_reachable_by_get(client):
    """It mutates state, so it has to stay a POST."""
    assert client.get("/api/admin/refresh").status_code == 405


@pytest.mark.parametrize(
    "path",
    [
        "/api/predictions/1",
        "/api/predictions/all",
        "/api/aqi/current",
        "/api/cities",
    ],
)
def test_read_endpoints_never_touch_the_network(path, client, city, stub_model, monkeypatch):
    """
    A guard rather than a behaviour test: fail loudly if anyone later wires
    an outbound HTTP call into a read path. Recruiter-facing demo or not, a
    GET that blocks on someone else's API is a cold-start hazard.

    The patch goes on httpx's *real* transports rather than on the client.
    `TestClient` is itself an `httpx.Client`, so patching `Client.send`
    would trip on the test's own request; `ASGITransport` is what carries
    that one, and it is left alone deliberately.
    """
    stub_model(150.0)

    import httpx

    def explode(*args, **kwargs):
        raise AssertionError(f"{path} attempted an outbound HTTP request")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", explode)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", explode)

    assert client.get(path).status_code == 200
