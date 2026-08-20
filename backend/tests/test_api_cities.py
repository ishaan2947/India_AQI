"""
Tests for the city and AQI-reading endpoints.

These go through a real `TestClient`, so routing, dependency injection,
Pydantic response validation, and status codes are all exercised together.
A response-model mismatch is otherwise a 500 that only shows up in a
browser.

No external service is contacted anywhere in this file — the only reading
data is what the fixtures write.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------


def test_healthz_reports_ok(client):
    """The Render keep-warm workflow pings this every 10 minutes."""
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_advertises_the_docs(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


# ---------------------------------------------------------------------------
# GET /api/cities
# ---------------------------------------------------------------------------


def test_list_cities_returns_every_city_alphabetically(client, cities):
    """Cities are inserted out of order; the query is what sorts them."""
    response = client.get("/api/cities")

    assert response.status_code == 200
    assert [c["name"] for c in response.json()] == ["Chennai", "Delhi", "Mumbai"]


def test_list_cities_annotates_the_latest_reading(client, city, make_readings):
    """The dashboard reads AQI straight off this payload."""
    written = make_readings(city, hours=5)

    payload = client.get("/api/cities").json()

    assert payload[0]["latest_aqi"] == written[-1]
    assert payload[0]["latest_pm25"] == written[-1] * 0.6
    assert payload[0]["latest_source"] == "synthetic"


def test_city_without_readings_still_appears_with_nulls(client, city):
    """
    A city with no readings must not be dropped from the list — the map
    would lose a marker — and must not 500 on the missing reading either.
    """
    payload = client.get("/api/cities").json()

    assert len(payload) == 1
    assert payload[0]["name"] == "Delhi"
    assert payload[0]["latest_aqi"] is None
    assert payload[0]["latest_timestamp"] is None


def test_list_cities_is_empty_before_seeding(client):
    """An unseeded database returns an empty list, not an error."""
    response = client.get("/api/cities")

    assert response.status_code == 200
    assert response.json() == []


def test_get_city_returns_coordinates_for_the_map(client, city, make_readings):
    make_readings(city, hours=2)

    payload = client.get(f"/api/cities/{city.id}").json()

    assert payload["name"] == "Delhi"
    assert payload["state"] == "Delhi"
    assert payload["lat"] == 28.61
    assert payload["lng"] == 77.21
    assert payload["latest_aqi"] == 110.0


def test_get_unknown_city_is_404(client):
    response = client.get("/api/cities/9999")

    assert response.status_code == 404
    assert response.json()["detail"] == "City not found"


# ---------------------------------------------------------------------------
# GET /api/aqi/current
# ---------------------------------------------------------------------------


def test_current_aqi_returns_one_row_per_city(client, cities, make_readings):
    """
    One row per city, not one per reading. `latest_reading_per_city` folds
    the history down; if that ever regressed, the map would draw duplicate
    markers on top of each other.
    """
    for city in cities:
        make_readings(city, hours=6)

    payload = client.get("/api/aqi/current").json()

    assert len(payload) == len(cities)
    assert len({row["id"] for row in payload}) == len(cities)


def test_current_aqi_reports_the_newest_reading(client, city, make_readings):
    written = make_readings(city, hours=10)

    payload = client.get("/api/aqi/current").json()

    assert payload[0]["latest_aqi"] == written[-1]
    assert payload[0]["latest_aqi"] == max(written)


# ---------------------------------------------------------------------------
# GET /api/aqi/{city_id}/history
# ---------------------------------------------------------------------------


def test_history_returns_readings_oldest_first(client, city, make_readings):
    """Chart libraries plot in array order, so ordering is part of the contract."""
    written = make_readings(city, hours=8)

    payload = client.get(f"/api/aqi/{city.id}/history").json()

    assert [row["aqi_value"] for row in payload] == written
    timestamps = [row["timestamp"] for row in payload]
    assert timestamps == sorted(timestamps)


def test_history_window_excludes_older_readings(client, city, make_readings):
    """
    `hours` is a real filter, not decoration. Write 30h of history and ask
    for 6 — only readings inside the window come back.
    """
    make_readings(city, hours=30)

    payload = client.get(f"/api/aqi/{city.id}/history", params={"hours": 6}).json()

    assert 0 < len(payload) <= 7  # inclusive cutoff can admit the boundary row
    assert len(payload) < 30


def test_history_defaults_to_twenty_four_hours(client, city, make_readings):
    make_readings(city, hours=40)

    payload = client.get(f"/api/aqi/{city.id}/history").json()

    assert len(payload) <= 25
    assert len(payload) >= 24


def test_history_rejects_an_out_of_range_window(client, city):
    """`hours` is declared ge=1, le=720 — FastAPI should 422 outside that."""
    assert client.get(f"/api/aqi/{city.id}/history", params={"hours": 0}).status_code == 422
    assert client.get(f"/api/aqi/{city.id}/history", params={"hours": 721}).status_code == 422
    assert client.get(f"/api/aqi/{city.id}/history", params={"hours": 720}).status_code == 200


def test_history_for_unknown_city_is_404(client):
    """404 rather than an empty list, so the frontend can tell the two apart."""
    response = client.get("/api/aqi/9999/history")

    assert response.status_code == 404
    assert response.json()["detail"] == "City not found"


def test_history_for_city_without_readings_is_an_empty_list(client, city):
    """The city exists, so this is a 200 with nothing in it — not a 404."""
    response = client.get(f"/api/aqi/{city.id}/history")

    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# GET /api/aqi/{city_id}/latest
# ---------------------------------------------------------------------------


def test_latest_returns_the_most_recent_reading(client, city, make_readings, anchor_hour):
    written = make_readings(city, hours=12)

    payload = client.get(f"/api/aqi/{city.id}/latest").json()

    assert payload["aqi_value"] == written[-1]
    assert payload["city_id"] == city.id
    assert payload["timestamp"].startswith(anchor_hour.strftime("%Y-%m-%dT%H"))


def test_latest_distinguishes_missing_city_from_missing_readings(client, city):
    """
    Both are 404, but the `detail` differs and that difference is the only
    way a caller can tell "no such city" from "city we haven't polled yet".
    """
    unknown = client.get("/api/aqi/9999/latest")
    empty = client.get(f"/api/aqi/{city.id}/latest")

    assert unknown.status_code == 404
    assert unknown.json()["detail"] == "City not found"

    assert empty.status_code == 404
    assert empty.json()["detail"] == "No readings recorded for this city yet"


def test_latest_ignores_other_cities_readings(client, cities, make_readings):
    """Per-city filtering — the newest row overall may belong to someone else."""
    chennai, delhi, mumbai = sorted(cities, key=lambda c: c.name)
    make_readings(delhi, hours=4, start=100.0)
    make_readings(mumbai, hours=4, start=900.0)

    payload = client.get(f"/api/aqi/{delhi.id}/latest").json()

    assert payload["city_id"] == delhi.id
    assert payload["aqi_value"] == 130.0
