import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from pathwise.db import Base, builtin_catalog, seed_catalog


@pytest.fixture
def catalog():
    return builtin_catalog()


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        seed_catalog(db, builtin_catalog())
        yield db
    engine.dispose()
