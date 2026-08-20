"""
Shared pytest fixtures for the backend suite.

Three isolation problems have to be solved before any test can be trusted,
and each one is a fixture below:

1. **The database.** Tests must never touch `aqi_india.db`. Every test gets
   a fresh in-memory SQLite database, and `get_db` is overridden so request
   handlers use it too.

2. **The application lifespan.** `backend.main.app` has a `lifespan` that
   seeds 30 cities, backfills 24h of history, and starts an APScheduler
   thread. `TestClient` only runs that when used as a context manager, so
   the `client` fixture deliberately does *not* use `with`. Tests declare
   their own data instead of inheriting a bootstrap.

3. **The trained model on disk.** `ml_model` caches a fitted estimator in a
   module-level global and persists it to `backend/model.joblib`. Without
   intervention a test would load the committed real model, and a test that
   trains would overwrite it. `isolated_model` is autouse for that reason.

Time handling: `crud.readings_in_window` filters against `datetime.utcnow()`,
so DB-backed fixtures anchor their timestamps to the current hour. Tests for
pure feature engineering build their own frames with fixed calendar dates
instead — see `test_features.py`.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend import crud, models
from backend.database import Base, get_db
from backend.main import app
from backend.services import ml_model
from backend.services.fetcher import AQISample


@pytest.fixture(name="engine")
def engine_fixture() -> Iterator[Engine]:
    """
    An in-memory SQLite engine with the full schema created.

    `StaticPool` plus `check_same_thread=False` keeps every connection
    pointed at the *same* in-memory database. Without it, SQLite hands out
    a brand-new empty database per connection and the rows a fixture just
    inserted are invisible to the request handler under test.
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture(name="db_session")
def db_session_fixture(engine: Engine) -> Iterator[Session]:
    """A session bound to the throwaway engine."""
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False, future=True)
    session = factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(name="client")
def client_fixture(db_session: Session) -> Iterator[TestClient]:
    """
    A `TestClient` whose request handlers share the test's own session.

    Sharing one session (rather than a new one per request) means a test can
    insert rows, call the API, and then assert against the same identity map
    without committing and re-querying.
    """

    def override_get_db() -> Iterator[Session]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        # Intentionally not `with TestClient(app)` — that would run the
        # lifespan and start the scheduler. See this module's docstring.
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def isolated_model(tmp_path: object, monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Point the ML layer at a scratch model path and clear its cached estimator.

    Autouse because forgetting it in a single test is enough to make the
    suite read or clobber the real `backend/model.joblib`, and the symptom
    (a test that passes alone but fails in a full run) is expensive to chase.
    """
    monkeypatch.setattr(ml_model, "MODEL_PATH", tmp_path / "model.joblib")  # type: ignore[attr-defined]
    monkeypatch.setattr(ml_model, "_loaded_model", None)


@pytest.fixture(name="anchor_hour")
def anchor_hour_fixture() -> datetime:
    """
    The current hour, truncated.

    Used as `t0` for DB fixtures so their rows fall inside the windows that
    `crud.readings_in_window` computes from `utcnow()`.
    """
    return datetime.utcnow().replace(minute=0, second=0, microsecond=0)


@pytest.fixture(name="city")
def city_fixture(db_session: Session) -> models.City:
    """A single persisted city."""
    return crud.create_city(db_session, name="Delhi", state="Delhi", lat=28.61, lng=77.21)


@pytest.fixture(name="cities")
def cities_fixture(db_session: Session) -> list[models.City]:
    """
    Three cities, deliberately not in alphabetical order.

    `crud.list_cities` sorts by name, so inserting out of order lets tests
    assert the ordering is the query's doing rather than an accident of
    insertion sequence.
    """
    return [
        crud.create_city(db_session, name="Mumbai", state="Maharashtra", lat=19.08, lng=72.88),
        crud.create_city(db_session, name="Delhi", state="Delhi", lat=28.61, lng=77.21),
        crud.create_city(db_session, name="Chennai", state="Tamil Nadu", lat=13.08, lng=80.27),
    ]


@pytest.fixture(name="make_readings")
def make_readings_fixture(db_session: Session, anchor_hour: datetime):
    """
    Factory writing a deterministic hourly AQI ramp for a city.

    Values follow `start + step * i` on exact hour boundaries ending at
    `anchor_hour`, so a test can state the expected lag or rolling mean as
    arithmetic instead of copying a magic number out of a failure message.

    Returns the values written, oldest first.
    """

    def _make(
        city: models.City,
        *,
        hours: int,
        start: float = 100.0,
        step: float = 10.0,
        source: str = "synthetic",
    ) -> list[float]:
        values: list[float] = []
        for i in range(hours):
            value = start + step * i
            timestamp = anchor_hour - timedelta(hours=hours - 1 - i)
            sample = AQISample(
                aqi_value=value,
                pm25=value * 0.6,
                pm10=value * 0.9,
                o3=20.0,
                no2=30.0,
                so2=10.0,
                co=1.0,
                source=source,
            )
            crud.create_reading(db_session, city_id=city.id, sample=sample, timestamp=timestamp)
            values.append(value)
        return values

    return _make
