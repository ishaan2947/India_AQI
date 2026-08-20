"""
Tests for the leaderboard endpoints.

`/api/stats/worst` and `/api/stats/best` share one helper that differs
only by its `reverse=` flag, which makes an inverted sort the most likely
regression here — and the least visible one, since a reversed leaderboard
still renders perfectly.
"""

from __future__ import annotations

import pytest

from backend import crud
from backend.services.fetcher import AQISample


@pytest.fixture(name="ranked_cities")
def ranked_cities_fixture(db_session, anchor_hour):
    """
    Twelve cities with one reading each, AQI 50 through 380.

    Twelve rather than ten so the `[:limit]` slice is actually exercised.
    """

    def _reading(city, value: float) -> None:
        crud.create_reading(
            db_session,
            city_id=city.id,
            sample=AQISample(
                aqi_value=value,
                pm25=value * 0.6,
                pm10=value * 0.9,
                o3=20.0,
                no2=30.0,
                so2=10.0,
                co=1.0,
                source="synthetic",
            ),
            timestamp=anchor_hour,
        )

    created = {}
    for i in range(12):
        value = 50.0 + i * 30.0
        city = crud.create_city(
            db_session, name=f"City{i:02d}", state=f"State{i:02d}", lat=float(i), lng=float(i)
        )
        _reading(city, value)
        created[city.name] = value
    return created


def test_worst_ranks_most_polluted_first(client, ranked_cities):
    payload = client.get("/api/stats/worst").json()

    values = [entry["aqi_value"] for entry in payload["entries"]]
    assert values == sorted(values, reverse=True)
    assert values[0] == max(ranked_cities.values())


def test_best_ranks_cleanest_first(client, ranked_cities):
    payload = client.get("/api/stats/best").json()

    values = [entry["aqi_value"] for entry in payload["entries"]]
    assert values == sorted(values)
    assert values[0] == min(ranked_cities.values())


def test_worst_and_best_are_actually_opposite(client, cities, make_readings):
    """
    The two endpoints differ by a single `reverse=` flag. Asserting each is
    sorted would pass even if both were wired the same way, so compare them
    against each other.

    Uses three cities rather than the twelve-city fixture: with more than
    ten, each leaderboard truncates a *different* pair, so the two lists are
    genuinely not reverses of one another.
    """
    for offset, city in enumerate(cities):
        make_readings(city, hours=2, start=100.0 + offset * 50.0, step=0.0)

    worst = [e["city_name"] for e in client.get("/api/stats/worst").json()["entries"]]
    best = [e["city_name"] for e in client.get("/api/stats/best").json()["entries"]]

    assert len(worst) == len(cities)
    assert worst[0] != best[0]
    assert worst == list(reversed(best))


def test_leaderboards_are_capped_at_ten(client, ranked_cities):
    """Twelve cities exist; the UI only has room for ten."""
    assert len(ranked_cities) == 12
    assert len(client.get("/api/stats/worst").json()["entries"]) == 10
    assert len(client.get("/api/stats/best").json()["entries"]) == 10


def test_cities_without_readings_are_omitted(client, cities, make_readings):
    """
    A leaderboard row needs an AQI. Cities we haven't polled yet are skipped
    rather than shown with a null, which would sort unpredictably.
    """
    make_readings(cities[0], hours=2)

    payload = client.get("/api/stats/worst").json()

    assert len(payload["entries"]) == 1
    assert payload["entries"][0]["city_name"] == cities[0].name


def test_leaderboards_carry_a_human_label(client, ranked_cities):
    """The frontend renders `label` as the card heading."""
    assert client.get("/api/stats/worst").json()["label"] == "Most polluted cities"
    assert client.get("/api/stats/best").json()["label"] == "Cleanest cities"


def test_entries_carry_the_fields_the_leaderboard_renders(client, ranked_cities):
    entry = client.get("/api/stats/worst").json()["entries"][0]

    assert set(entry) == {"city_id", "city_name", "state", "aqi_value", "pm25", "timestamp"}
    assert entry["pm25"] == pytest.approx(entry["aqi_value"] * 0.6)


def test_empty_database_returns_empty_leaderboards(client):
    """No cities at all is a valid state on a cold start, not an error."""
    payload = client.get("/api/stats/worst").json()

    assert payload["entries"] == []
