"""Deterministic prerequisite checker; generative models NEVER determine eligibility."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pathwise.schemas import (
    GRADE_ORDER,
    AssessmentRequest,
    AssessmentResponse,
    CatalogSpec,
    CourseAssessment,
    RuleNode,
)

Check = Literal["met", "conditional", "missing", "unknown"]


@dataclass(frozen=True)
class Result:
    state: Check
    detail: str = ""


def describe(node: RuleNode) -> str:
    if node.kind == "course":
        requirement = node.code or "unknown"
        if node.min_grade:
            requirement += f" (minimum grade {node.min_grade})"
        if node.concurrent_allowed:
            requirement += " (prior or concurrent enrollment)"
        return requirement
    token = " and " if node.kind == "all" else " or "
    return "(" + token.join(describe(child) for child in node.items) + ")"


def combine(kind: str, results: list[Result], node: RuleNode) -> Result:
    states = [r.state for r in results]
    if kind == "all":
        state: Check = (
            "missing" if "missing" in states else
            "unknown" if "unknown" in states else
            "conditional" if "conditional" in states else "met"
        )
        if state == "met":
            return Result("met")
        notes = [r.detail for r in results if r.state != "met" and r.detail]
        return Result(state, "; ".join(notes))
    if "met" in states:
        return Result("met")
    if "conditional" in states:
        return Result("conditional", "One alternative depends on a future course completion: " +
                      ", ".join(r.detail for r in results if r.state == "conditional"))
    if "unknown" in states:
        return Result("unknown", "At least one alternative is uncertain: " +
                      ", ".join(r.detail for r in results if r.state == "unknown"))
    return Result("missing", "Complete one of " + describe(node))


def evaluate(catalog: CatalogSpec, request: AssessmentRequest) -> AssessmentResponse:
    """Return prerequisite *planning* risks, never a degree audit or registration approval."""
    if request.catalog_id != catalog.id:
        raise ValueError("Catalog ID mismatch")

    rules = {course.code: course for course in catalog.courses}
    completed = {course.code: course.grade for course in request.completed}
    proposed = {
        code: (index, term.term)
        for index, term in enumerate(request.planned_terms)
        for code in term.courses
    }
    cache: dict[str, CourseAssessment] = {}
    checking: set[str] = set()

    def verify_requirement(node: RuleNode, target: str, target_index: int) -> Result:
        if node.kind != "course":
            return combine(
                node.kind,
                [verify_requirement(child, target, target_index) for child in node.items],
                node,
            )

        code = node.code
        assert code is not None
        if code in completed:
            grade = completed[code]
            if grade in {"F", "W", "I"}:
                return Result("missing", f"{code} is not recorded as passed (grade {grade})")
            if node.min_grade:
                if grade is None or grade == "P":
                    return Result("unknown", f"Cannot verify {node.min_grade} minimum for {code}")
                if GRADE_ORDER[grade] < GRADE_ORDER[node.min_grade]:
                    return Result("missing", f"{code} grade {grade} is below {node.min_grade}")
            return Result("met")

        position = proposed.get(code)
        if position:
            prior = position[0] < target_index
            concurrent = position[0] == target_index and node.concurrent_allowed
            if prior or concurrent:
                if node.min_grade:
                    # A planned course has no known final grade, even if completed earlier in plan.
                    return Result("unknown", f"Future grade for {code} cannot be verified")
                dependency = check_course(code)
                if dependency.status == "blocked":
                    return Result("missing", f"{code} is itself blocked in {position[1]}")
                if dependency.status in {"uncertain", "unsupported"}:
                    return Result("unknown", f"{code} has unverified eligibility in {position[1]}")
                return Result(
                    "conditional",
                    f"{code} must be successfully completed/enrolled in {position[1]}",
                )
        return Result("missing", f"Missing prerequisite {describe(node)} for {target}")

    def check_course(code: str) -> CourseAssessment:
        if code in cache:
            return cache[code]
        index, term = proposed[code]
        rule = rules.get(code)
        if rule is None:
            result = CourseAssessment(
                course=code, term=term, status="unsupported", severity="unknown",
                explanation="No verified prerequisite rule for this course in the POC catalog. "
                            "Do not interpret this as no prerequisites.",
                supporting_rule=None, source_url=None, source_section=None,
            )
        elif code in checking:
            result = CourseAssessment(
                course=code, term=term, status="uncertain", severity="unknown",
                explanation="Circular dependency detected; manual review required.",
                supporting_rule=describe(rule.rule),
                source_url=rule.source_url, source_section=rule.source_section,
            )
        else:
            checking.add(code)
            try:
                checked = verify_requirement(rule.rule, code, index)
            finally:
                checking.remove(code)
            status_map = {"met": "clear", "conditional": "conditional",
                          "missing": "blocked", "unknown": "uncertain"}
            severity_map = {"met": "none", "conditional": "medium",
                            "missing": "high", "unknown": "unknown"}
            explanation = {
                "met": "All modeled prerequisites are satisfied by recorded completed coursework.",
                "conditional": "The plan depends on future coursework. " + checked.detail,
                "missing": "Potential prerequisite sequencing conflict. " + checked.detail,
                "unknown": "Cannot verify all prerequisites. " + checked.detail,
            }[checked.state]
            result = CourseAssessment(
                course=code, term=term,
                status=status_map[checked.state], severity=severity_map[checked.state],
                explanation=explanation, supporting_rule=describe(rule.rule),
                source_url=rule.source_url, source_section=rule.source_section,
            )
        cache[code] = result
        return result

    evaluations = [
        check_course(code)
        for semester in request.planned_terms
        for code in semester.courses
    ]
    return AssessmentResponse(
        catalog_id=catalog.id,
        rules_version=catalog.rules_version,
        evaluations=evaluations,
        disclaimers=[
            "Unofficial technical proof of concept; not affiliated with UT Dallas.",
            "Prerequisite checks are not a degree audit, enrollment approval, "
            "or graduation prediction.",
            "Only the explicitly modeled 2026 catalog rules are checked. "
            "Standing, transfer equivalencies, waivers, full degree requirements, "
            "offering schedules, and capacity are not assessed.",
            "Completed courses and grades are self-reported; verify with an academic advisor.",
            catalog.limitations,
        ],
    )
