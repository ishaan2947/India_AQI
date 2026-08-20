"""
Tests for the WAQI fetcher and its synthetic fallback.

Nothing here touches the network. The retry loop is driven through
`httpx.MockTransport`, which means the *real* `_fetch_waqi` runs — its
status-code branching, its backoff, its exception handling — against
scripted responses. That is worth considerably more than mocking
`_fetch_waqi` itself, because the branching is the part with bugs in it.

`asyncio.sleep` is patched out in the retry tests so a three-attempt
backoff costs no wall-clock time; the recorded delays are asserted
instead, since "does it actually back off" is part of being polite to a
free API tier.
"""

from __future__ import annotations

import random
from datetime import datetime

import httpx
import pytest

from backend import crud
from backend.services import fetcher
from backend.services.fetcher import (
    INITIAL_BACKOFF_SECONDS,
    MAX_RETRIES,
    AQISample,
    _fetch_waqi,
    _parse_waqi_response,
    _synthetic_sample,
    backfill_synthetic_history,
    fetch_all_cities,
    fetch_city_reading,
    seed_cities_from_json,
)


def waqi_payload(aqi: object = 168, **iaqi: float) -> dict:
    """A WAQI `/feed` response trimmed to the fields the parser reads."""
    return {
        "status": "ok",
        "data": {
            "aqi": aqi,
            "idx": 1451,
            "city": {"name": "Delhi"},
            "iaqi": {key: {"v": value} for key, value in iaqi.items()},
        },
    }


@pytest.fixture(name="no_backoff")
def no_backoff_fixture(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    """Replace `asyncio.sleep` with a recorder so retries cost nothing."""
    slept: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        slept.append(seconds)

    monkeypatch.setattr(fetcher.asyncio, "sleep", fake_sleep)
    return slept


def client_returning(*responses: httpx.Response | Exception) -> tuple[httpx.AsyncClient, list]:
    """
    An AsyncClient whose transport replays `responses` in order.

    The last entry repeats once exhausted, so a test can script "always
    503" with a single response.
    """
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        item = responses[min(len(seen) - 1, len(responses) - 1)]
        if isinstance(item, Exception):
            raise item
        return item

    return httpx.AsyncClient(transport=httpx.MockTransport(handler)), seen


# ---------------------------------------------------------------------------
# Response parsing
# ---------------------------------------------------------------------------


def test_parses_a_complete_waqi_payload():
    sample = _parse_waqi_response(waqi_payload(168, pm25=99.0, pm10=143.0, o3=12.0))

    assert sample is not None
    assert sample.aqi_value == 168.0
    assert sample.pm25 == 99.0
    assert sample.pm10 == 143.0
    assert sample.o3 == 12.0
    assert sample.source == "waqi"


def test_missing_pollutants_become_none_not_zero():
    """
    A missing pollutant is unknown, not clean. Defaulting to 0.0 would
    quietly plot a flat line at the bottom of the pollutant chart.
    """
    sample = _parse_waqi_response(waqi_payload(168, pm25=99.0))

    assert sample is not None
    assert sample.pm25 == 99.0
    assert sample.pm10 is None
    assert sample.no2 is None


def test_rejects_a_non_ok_status():
    assert _parse_waqi_response({"status": "error", "data": "Invalid key"}) is None


def test_rejects_the_placeholder_aqi_waqi_sends_for_offline_stations():
    """WAQI returns a literal '-' when a station has no current data."""
    assert _parse_waqi_response(waqi_payload("-")) is None


def test_rejects_a_missing_or_unparseable_aqi():
    assert _parse_waqi_response(waqi_payload(None)) is None
    assert _parse_waqi_response(waqi_payload("not-a-number")) is None
    assert _parse_waqi_response({"status": "ok", "data": {}}) is None


def test_survives_a_malformed_pollutant_node():
    """`iaqi` values are meant to be `{"v": float}`; tolerate junk."""
    payload = waqi_payload(120)
    payload["data"]["iaqi"]["pm25"] = "unexpected string"
    payload["data"]["iaqi"]["pm10"] = {"v": None}

    sample = _parse_waqi_response(payload)

    assert sample is not None
    assert sample.pm25 is None
    assert sample.pm10 is None


# ---------------------------------------------------------------------------
# The retry loop
# ---------------------------------------------------------------------------


async def test_successful_fetch_makes_a_single_request(no_backoff):
    client, seen = client_returning(httpx.Response(200, json=waqi_payload(150, pm25=88.0)))

    async with client:
        sample = await _fetch_waqi(client, "Delhi")

    assert sample is not None
    assert sample.aqi_value == 150.0
    assert len(seen) == 1
    assert no_backoff == []


async def test_rate_limit_is_retried(no_backoff):
    client, seen = client_returning(
        httpx.Response(429),
        httpx.Response(200, json=waqi_payload(140)),
    )

    async with client:
        sample = await _fetch_waqi(client, "Delhi")

    assert sample is not None
    assert sample.aqi_value == 140.0
    assert len(seen) == 2


async def test_server_errors_are_retried_then_give_up(no_backoff):
    client, seen = client_returning(httpx.Response(503))

    async with client:
        sample = await _fetch_waqi(client, "Delhi")

    assert sample is None
    assert len(seen) == MAX_RETRIES


async def test_backoff_doubles_between_attempts(no_backoff):
    """
    Politeness to WAQI's free tier is the whole point of the backoff, and
    a flat retry loop would look identical from the outside.
    """
    client, _ = client_returning(httpx.Response(503))

    async with client:
        await _fetch_waqi(client, "Delhi")

    # One sleep fewer than attempts — we don't wait after the final failure.
    assert no_backoff == [INITIAL_BACKOFF_SECONDS, INITIAL_BACKOFF_SECONDS * 2]


async def test_transport_errors_are_caught_and_retried(no_backoff):
    """A DNS or connection failure must not propagate out of the fetcher."""
    client, seen = client_returning(httpx.ConnectError("name resolution failed"))

    async with client:
        sample = await _fetch_waqi(client, "Delhi")

    assert sample is None
    assert len(seen) == MAX_RETRIES


async def test_malformed_json_is_treated_as_a_failed_attempt(no_backoff):
    client, _ = client_returning(httpx.Response(200, content=b"<html>not json</html>"))

    async with client:
        sample = await _fetch_waqi(client, "Delhi")

    assert sample is None


async def test_a_valid_response_with_no_usable_data_is_not_retried(no_backoff):
    """
    An offline station is a definitive answer, not a transient failure.
    Retrying it twice more just burns quota for a result that won't change.
    """
    client, seen = client_returning(httpx.Response(200, json=waqi_payload("-")))

    async with client:
        sample = await _fetch_waqi(client, "Delhi")

    assert sample is None
    assert len(seen) == 1


# ---------------------------------------------------------------------------
# Fallback
# ---------------------------------------------------------------------------


async def test_upstream_reading_is_preferred_when_available(no_backoff):
    client, _ = client_returning(httpx.Response(200, json=waqi_payload(210, pm25=130.0)))

    async with client:
        sample = await fetch_city_reading(client, "Delhi")

    assert sample.source == "waqi"
    assert sample.aqi_value == 210.0


async def test_synthetic_data_fills_in_when_upstream_is_down(no_backoff):
    """
    The dashboard stays alive when WAQI is unavailable — and the reading is
    labelled `synthetic` so the UI can be honest about where it came from.
    """
    client, _ = client_returning(httpx.Response(503))

    async with client:
        sample = await fetch_city_reading(client, "Delhi")

    assert sample.source == "synthetic"
    assert sample.aqi_value > 0


# ---------------------------------------------------------------------------
# Synthetic generation
# ---------------------------------------------------------------------------


def test_synthetic_readings_follow_the_indian_diurnal_curve():
    """
    Morning and evening rush hours peak; the small hours trough. The gap is
    ~80 AQI against +/-15 of noise, so this is not a flaky comparison.
    """
    random.seed(0)
    morning = _synthetic_sample("Delhi", now=datetime(2024, 6, 1, 8, 0))
    night = _synthetic_sample("Delhi", now=datetime(2024, 6, 1, 3, 0))
    evening = _synthetic_sample("Delhi", now=datetime(2024, 6, 1, 20, 0))

    assert morning.aqi_value > night.aqi_value
    assert evening.aqi_value > night.aqi_value


def test_synthetic_readings_stay_in_a_plausible_range():
    random.seed(1)
    for hour in range(24):
        sample = _synthetic_sample("Delhi", now=datetime(2024, 6, 1, hour, 0))
        assert 20.0 <= sample.aqi_value <= 420.0
        assert sample.pm25 is not None and sample.pm25 >= 5.0
        assert sample.pm10 is not None and sample.pm10 >= 10.0


def test_each_city_gets_its_own_baseline():
    """
    The baseline is hashed from the city name, so cities stay distinguishable
    on the map instead of all drifting around the same number.
    """
    random.seed(2)
    at = datetime(2024, 6, 1, 12, 0)
    values = {name: _synthetic_sample(name, now=at).aqi_value for name in ("Delhi", "Kochi")}

    assert values["Delhi"] != values["Kochi"]


def test_synthetic_samples_are_labelled_as_such():
    """`source` is what the UI uses to caption estimated data."""
    assert _synthetic_sample("Delhi").source == "synthetic"


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------


async def test_fetch_all_cities_stores_one_reading_each(db_session, cities, monkeypatch):
    """The fetch loop itself, with the per-city call stubbed out."""

    async def fake_reading(client, city_name):
        return AQISample(
            aqi_value=123.0,
            pm25=70.0,
            pm10=110.0,
            o3=20.0,
            no2=30.0,
            so2=10.0,
            co=1.0,
            source="waqi",
        )

    monkeypatch.setattr(fetcher, "fetch_city_reading", fake_reading)

    stored = await fetch_all_cities(db_session)

    assert stored == len(cities)
    for city in cities:
        assert crud.count_readings(db_session, city.id) == 1


async def test_fetch_all_cities_is_a_no_op_on_an_empty_database(db_session):
    """No cities seeded yet — return 0 rather than opening a client."""
    assert await fetch_all_cities(db_session) == 0


def test_seeding_loads_the_bundled_cities(db_session):
    inserted = seed_cities_from_json(db_session)

    assert inserted == 30
    assert crud.get_city_by_name(db_session, "Delhi") is not None


def test_seeding_twice_inserts_nothing_the_second_time(db_session):
    """Runs on every boot, so it has to be idempotent."""
    seed_cities_from_json(db_session)

    assert seed_cities_from_json(db_session) == 0
    assert len(crud.list_cities(db_session)) == 30


def test_backfill_creates_one_reading_per_city_hour(db_session, cities):
    written = backfill_synthetic_history(db_session, hours=12)

    assert written == 12 * len(cities)
    for city in cities:
        assert crud.count_readings(db_session, city.id) == 12


def test_backfill_skips_cities_that_already_have_history(db_session, cities, make_readings):
    """
    Guards against a restart doubling up a city's chart. Only the untouched
    cities get backfilled.
    """
    make_readings(cities[0], hours=4)

    written = backfill_synthetic_history(db_session, hours=10)

    assert written == 10 * (len(cities) - 1)
    assert crud.count_readings(db_session, cities[0].id) == 4


def test_backfill_on_an_empty_database_writes_nothing(db_session):
    assert backfill_synthetic_history(db_session, hours=10) == 0
