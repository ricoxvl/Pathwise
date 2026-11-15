"""Phase 1 API: catalog discovery and source-traceable prerequisite assessments."""
from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from pathwise.db import CatalogRow, get_session, load_catalog
from pathwise.engine import evaluate
from pathwise.schemas import AssessmentRequest, AssessmentResponse

app = FastAPI(
    title="Pathwise Rules API",
    version="0.1.0",
    description="Unofficial proof of concept; not a degree audit or enrollment authorization.",
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/catalogs")
def list_catalogs(session: Session = Depends(get_session)) -> list[dict]:
    records = session.scalars(
        select(CatalogRow).order_by(CatalogRow.catalog_year, CatalogRow.id)
    ).all()
    return [
        {
            "id": record.id,
            "university": record.university,
            "program": record.program,
            "catalog_year": record.catalog_year,
            "rules_version": record.rules_version,
            "source_url": record.source_url,
            "limitations": record.limitations,
        }
        for record in records
    ]


@app.get("/v1/catalogs/{catalog_id}/courses")
def list_course_rules(catalog_id: str, session: Session = Depends(get_session)) -> dict:
    catalog = load_catalog(session, catalog_id)
    if catalog is None:
        raise HTTPException(404, "Unsupported catalog or version")
    return {
        "catalog_id": catalog.id,
        "rules_version": catalog.rules_version,
        "courses": [course.model_dump(mode="json") for course in catalog.courses],
    }


@app.post("/v1/assess", response_model=AssessmentResponse)
def assess(
    request: AssessmentRequest,
    session: Session = Depends(get_session),
) -> AssessmentResponse:
    catalog = load_catalog(session, request.catalog_id)
    if catalog is None:
        raise HTTPException(404, "Unsupported catalog or version")
    return evaluate(catalog, request)
