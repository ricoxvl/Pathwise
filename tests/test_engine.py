import pytest
from pydantic import ValidationError

from pathwise.engine import evaluate
from pathwise.schemas import AssessmentRequest


def assess(catalog, completed, planned):
    request = AssessmentRequest.model_validate({
        "catalog_id": catalog.id,
        "completed": [
            {"code": c} if isinstance(c, str) else c
            for c in completed
        ],
        "planned_terms": planned,
    })
    return evaluate(catalog, request)


BASE = ["ITSS 3300", "ITSS 3311", "MATH 1325", "OPRE 3333"]


def test_direct_prerequisites_clear(catalog):
    result = assess(catalog, BASE, [{"term": "2027-spring", "courses": ["ITSS 4300"]}])
    assert result.evaluations[0].status == "clear"
    assert "catalog.utdallas.edu/2026" in result.evaluations[0].source_url
    assert "ITSS 3311" in result.evaluations[0].supporting_rule


def test_missing_prerequisite_is_blocked(catalog):
    result = assess(catalog, BASE[:-1], [{"term": "2027-spring", "courses": ["ITSS 4300"]}])
    evaluation = result.evaluations[0]
    assert evaluation.status == "blocked"
    assert evaluation.severity == "high"
    assert "OPRE 3333" in evaluation.explanation


def test_math_and_quant_alternatives(catalog):
    completed = ["ITSS 3300", "ITSS 3311", "MATH 2417", "CS 2305"]
    result = assess(catalog, completed, [{"term": "2027-spring", "courses": ["ITSS 4300"]}])
    assert result.evaluations[0].status == "clear"


def test_or_prerequisite_accepts_either(catalog):
    for prerequisite in ["ITSS 3312", "ITSS 4381"]:
        result = assess(catalog, [prerequisite], [
            {"term": "2027-spring", "courses": ["ITSS 4312"]}
        ])
        assert result.evaluations[0].status == "clear"


def test_or_prerequisite_rejects_neither(catalog):
    result = assess(catalog, [], [{"term": "2027-spring", "courses": ["ITSS 4312"]}])
    assert result.evaluations[0].status == "blocked"


def test_corequisite_allowed_in_same_semester(catalog):
    completed = BASE + ["ITSS 4381"]
    result = assess(catalog, completed, [{
        "term": "2027-spring",
        "courses": ["ITSS 4330", "ITSS 4300"],
    }])
    statuses = {e.course: e.status for e in result.evaluations}
    assert statuses == {"ITSS 4330": "conditional", "ITSS 4300": "clear"}


def test_prerequisite_not_corequisite(catalog):
    result = assess(catalog, BASE, [{
        "term": "2027-spring", "courses": ["ITSS 4300", "ITSS 4380"]
    }])
    assert {e.course: e.status for e in result.evaluations} == {
        "ITSS 4300": "clear", "ITSS 4380": "blocked"
    }


def test_future_course_makes_plan_conditional(catalog):
    result = assess(catalog, BASE + ["ITSS 4381"], [
        {"term": "2027-spring", "courses": ["ITSS 4300"]},
        {"term": "2027-fall", "courses": ["ITSS 4330"]},
    ])
    assert result.evaluations[1].status == "conditional"


def test_failed_upstream_course_blocks_downstream(catalog):
    result = assess(catalog, ["ITSS 3300", "MATH 1325", "OPRE 3333", "ITSS 4381"], [
        {"term": "2027-spring", "courses": ["ITSS 4300"]},
        {"term": "2027-fall", "courses": ["ITSS 4330"]},
    ])
    assert [e.status for e in result.evaluations] == ["blocked", "blocked"]


def test_unknown_planned_upstream_cannot_clear_downstream(catalog):
    result = assess(catalog, [], [
        {"term": "2027-spring", "courses": ["ITSS 3300"]},
        {"term": "2027-fall", "courses": ["ITSS 4371"]},
    ])
    assert [e.status for e in result.evaluations] == ["unsupported", "uncertain"]


def test_unknown_course_is_not_treated_as_prerequisite_free(catalog):
    result = assess(catalog, BASE, [
        {"term": "2027-spring", "courses": ["ITSS 9999"]}
    ])
    assert result.evaluations[0].status == "unsupported"
    assert result.evaluations[0].source_url is None


def test_minimum_grade_and_unknown_grades(catalog):
    courses = [
        {"code": "ACCT 2301", "grade": "C"},
        {"code": "ACCT 2302", "grade": "B"},
        {"code": "ITSS 3300"},
        {"code": "MATH 1325"},
    ]
    terms = [{"term": "2027-spring", "courses": ["ITSS 4301"]}]
    assert assess(catalog, courses, terms).evaluations[0].status == "clear"
    courses[0]["grade"] = "D"
    assert assess(catalog, courses, terms).evaluations[0].status == "blocked"
    courses[0]["grade"] = "P"
    assert assess(catalog, courses, terms).evaluations[0].status == "uncertain"
    courses[0].pop("grade")
    assert assess(catalog, courses, terms).evaluations[0].status == "uncertain"


def test_failed_completed_course_does_not_satisfy_prerequisite(catalog):
    courses = [
        {"code": "ITSS 3300", "grade": "F"}, "ITSS 3311", "MATH 1325", "OPRE 3333"
    ]
    assert assess(catalog, courses, [
        {"term": "2027-spring", "courses": ["ITSS 4300"]}
    ]).evaluations[0].status == "blocked"


@pytest.mark.parametrize("payload", [
    {"completed": [{"code": "ITSS 3300"}],
     "planned_terms": [{"term": "2027-spring", "courses": ["ITSS 3300"]}]},
    {"completed": [], "planned_terms": [
        {"term": "2027-fall", "courses": ["ITSS 4300"]},
        {"term": "2027-spring", "courses": ["ITSS 4330"]},
    ]},
    {"completed": [], "planned_terms": [
        {"term": "2027-spring", "courses": ["ITSS 4300", "ITSS 4300"]}
    ]},
    {"completed": [{"code": "ITSS 4300", "grade": "Z"}],
     "planned_terms": [{"term": "2027-spring", "courses": ["ITSS 4330"]}]},
    {"completed": [],
     "planned_terms": [{"term": "spring 2027", "courses": ["ITSS 4300"]}]},
])
def test_contradictory_or_invalid_input_rejected(payload):
    with pytest.raises(ValidationError):
        AssessmentRequest.model_validate({"catalog_id": "utdallas-cist-2026-poc-v1", **payload})


def test_disclaimers_make_scope_explicit(catalog):
    result = assess(catalog, BASE, [{"term": "2027-spring", "courses": ["ITSS 4300"]}])
    assert any("not a degree audit" in warning.lower() for warning in result.disclaimers)
    assert any("unofficial" in warning.lower() for warning in result.disclaimers)
