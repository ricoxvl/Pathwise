from fastapi.testclient import TestClient

from pathwise.api import app
from pathwise.db import get_session


def test_health():
    assert TestClient(app).get("/health").json() == {"status": "ok"}


def test_catalog_and_assessment_api(session):
    app.dependency_overrides[get_session] = lambda: session
    try:
        with TestClient(app) as client:
            catalogs = client.get("/v1/catalogs")
            assert catalogs.status_code == 200
            assert catalogs.json()[0]["catalog_year"] == 2026
            catalog_id = catalogs.json()[0]["id"]
            courses = client.get(f"/v1/catalogs/{catalog_id}/courses")
            assert courses.status_code == 200
            assert any(c["code"] == "ITSS 4330" for c in courses.json()["courses"])
            result = client.post("/v1/assess", json={
                "catalog_id": catalog_id,
                "completed": [
                    {"code": "ITSS 3300"}, {"code": "ITSS 3311"},
                    {"code": "MATH 1325"}, {"code": "OPRE 3333"},
                ],
                "planned_terms": [{"term": "2027-spring", "courses": ["ITSS 4300"]}],
            })
            assert result.status_code == 200
            assert result.json()["evaluations"][0]["status"] == "clear"
    finally:
        app.dependency_overrides.clear()


def test_unsupported_catalog_returns_404(session):
    app.dependency_overrides[get_session] = lambda: session
    try:
        response = TestClient(app).post("/v1/assess", json={
            "catalog_id": "utdallas-cist-2025",
            "planned_terms": [{"term": "2027-spring", "courses": ["ITSS 4300"]}],
        })
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_duplicate_completed_and_planned_fails_422(session):
    app.dependency_overrides[get_session] = lambda: session
    try:
        response = TestClient(app).post("/v1/assess", json={
            "catalog_id": "utdallas-cist-2026-poc-v1",
            "completed": [{"code": "ITSS 4300"}],
            "planned_terms": [{"term": "2027-spring", "courses": ["ITSS 4300"]}],
        })
        assert response.status_code == 422
    finally:
        app.dependency_overrides.clear()
