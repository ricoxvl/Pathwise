"""SQLAlchemy persistence for versioned, source-traceable academic rule records."""
from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Generator
from importlib.resources import files

from sqlalchemy import JSON, ForeignKey, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from pathwise.schemas import CatalogSpec, CourseRule


class Base(DeclarativeBase):
    pass


class CatalogRow(Base):
    __tablename__ = "catalog_releases"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    university: Mapped[str] = mapped_column(String(160))
    program: Mapped[str] = mapped_column(String(240))
    catalog_year: Mapped[int] = mapped_column(Integer)
    rules_version: Mapped[int] = mapped_column(Integer)
    source_url: Mapped[str] = mapped_column(String(500))
    limitations: Mapped[str] = mapped_column(String(1000))
    content_hash: Mapped[str] = mapped_column(String(64))


class RuleRow(Base):
    __tablename__ = "course_rules"

    catalog_id: Mapped[str] = mapped_column(
        String(120), ForeignKey("catalog_releases.id"), primary_key=True
    )
    code: Mapped[str] = mapped_column(String(20), primary_key=True)
    position: Mapped[int] = mapped_column(Integer)
    rule_payload: Mapped[dict] = mapped_column(JSON)


def make_engine(url: str | None = None):
    url = url or os.getenv("DATABASE_URL", "sqlite:///./pathwise.db")
    kw = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
    return create_engine(url, pool_pre_ping=True, **kw)


engine = make_engine()


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def initialize_schema(db_engine=None) -> None:
    Base.metadata.create_all(db_engine or engine)


def builtin_catalog() -> CatalogSpec:
    with files("pathwise").joinpath("data/utdallas_cist_2026_poc_v1.json").open(
        "r", encoding="utf-8"
    ) as stream:
        return CatalogSpec.model_validate(json.load(stream))


def catalog_digest(catalog: CatalogSpec) -> str:
    canonical = json.dumps(catalog.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def seed_catalog(session: Session, catalog: CatalogSpec) -> bool:
    """Insert immutable catalog version. Changing rules requires a new catalog ID/version."""
    digest = catalog_digest(catalog)
    existing = session.get(CatalogRow, catalog.id)
    if existing:
        if existing.content_hash != digest:
            raise ValueError("Existing catalog ID has different content: bump its ID and version")
        return False
    session.add(CatalogRow(
        id=catalog.id, university=catalog.university, program=catalog.program,
        catalog_year=catalog.catalog_year, rules_version=catalog.rules_version,
        source_url=catalog.source_url, limitations=catalog.limitations,
        content_hash=digest,
    ))
    for position, rule in enumerate(catalog.courses):
        session.add(RuleRow(
            catalog_id=catalog.id, code=rule.code, position=position,
            rule_payload=rule.model_dump(mode="json"),
        ))
    session.commit()
    return True


def load_catalog(session: Session, catalog_id: str) -> CatalogSpec | None:
    record = session.get(CatalogRow, catalog_id)
    if not record:
        return None
    items = session.scalars(
        select(RuleRow).where(RuleRow.catalog_id == catalog_id).order_by(RuleRow.position)
    ).all()
    return CatalogSpec(
        id=record.id, university=record.university, program=record.program,
        catalog_year=record.catalog_year, rules_version=record.rules_version,
        source_url=record.source_url, limitations=record.limitations,
        courses=[CourseRule.model_validate(item.rule_payload) for item in items],
    )
