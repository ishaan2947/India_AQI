"""
SQLAlchemy database setup for the AQI India Intelligence platform.

Uses SQLite for local persistence. The engine is created with
`check_same_thread=False` so that FastAPI's thread-based request
handling can share the connection safely.
"""

from __future__ import annotations

import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./aqi_india.db")

# SQLite-specific connect args. Other databases ignore this.
_connect_args: dict[str, object] = (
    {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

engine: Engine = create_engine(DATABASE_URL, connect_args=_connect_args, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a SQLAlchemy session and ensures
    it is closed after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Create all tables defined on the `Base` metadata.

    Called from `main.py` on application startup so the schema is
    guaranteed to exist before any request is served.
    """
    # Import models so SQLAlchemy registers them on `Base.metadata`.
    from . import models  # noqa: F401  (import-for-side-effects)

    Base.metadata.create_all(bind=engine)
