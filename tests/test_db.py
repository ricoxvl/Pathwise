import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from pathwise.db import Base, builtin_catalog, load_catalog, seed_catalog


def test_seed_idempotent_and_rules_roundtrip(session):
    original = builtin_catalog()
    reloaded = load_catalog(session, original.id)
    assert reloaded == original
    assert seed_catalog(session, original) is False
    assert len(reloaded.courses) >= 8


def test_mutating_existing_version_requires_new_id(session):
    original = builtin_catalog()
    mutated = original.model_copy(deep=True)
    mutated.courses[0].title = "Changed"
    with pytest.raises(ValueError, match="bump"):
        seed_catalog(session, mutated)
    assert load_catalog(session, original.id) == original


def test_catalogs_are_isolated_across_versions():
    engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(engine)
    first = builtin_catalog()
    second = first.model_copy(deep=True)
    second.id = "utdallas-cist-2026-poc-v2"
    second.rules_version = 2
    with Session(engine) as session:
        seed_catalog(session, first)
        seed_catalog(session, second)
        assert load_catalog(session, first.id).rules_version == 1
        assert load_catalog(session, second.id).rules_version == 2
    engine.dispose()
