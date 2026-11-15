"""Validated academic inputs and versioned catalog rule schemas."""
from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

COURSE_PATTERN = re.compile(r"^[A-Z]{2,5} [0-9]{4}[A-Z]?$")
TERM_PATTERN = re.compile(r"^(20[0-9]{2})-(spring|summer|fall)$")
GRADE_ORDER = {"A": 4, "B": 3, "C": 2, "D": 1}
GRADES = set(GRADE_ORDER) | {"P", "F", "W", "I"}


def normalize_course(value: str) -> str:
    normalized = " ".join(value.upper().split())
    if not COURSE_PATTERN.fullmatch(normalized):
        raise ValueError("Course must look like 'ITSS 4300'")
    return normalized


def term_sort_key(term: str) -> tuple[int, int]:
    match = TERM_PATTERN.fullmatch(term)
    if match is None:
        raise ValueError("Term must look like '2027-spring'")
    return int(match.group(1)), {"spring": 0, "summer": 1, "fall": 2}[match.group(2)]


class RuleNode(BaseModel):
    kind: Literal["course", "all", "any"]
    code: str | None = None
    min_grade: Literal["A", "B", "C", "D"] | None = None
    concurrent_allowed: bool = False
    items: list[RuleNode] = Field(default_factory=list)

    @field_validator("code")
    @classmethod
    def check_code(cls, code: str | None) -> str | None:
        return normalize_course(code) if code is not None else None

    @model_validator(mode="after")
    def valid_shape(self) -> RuleNode:
        if self.kind == "course":
            if self.code is None or self.items:
                raise ValueError("Course node requires code, not child items")
        elif (
            self.code is not None
            or self.min_grade is not None
            or self.concurrent_allowed
            or not self.items
        ):
            raise ValueError("Grouping node requires nonempty items and no course attributes")
        return self


class CourseRule(BaseModel):
    code: str
    title: str = Field(min_length=1)
    rule: RuleNode
    source_url: str = Field(pattern=r"^https://catalog\.utdallas\.edu/2026/")
    source_section: str = Field(min_length=1)
    scope_note: str = ""

    @field_validator("code")
    @classmethod
    def check_code(cls, code: str) -> str:
        return normalize_course(code)


class CatalogSpec(BaseModel):
    id: str
    university: str
    program: str
    catalog_year: int
    rules_version: int = Field(ge=1)
    source_url: str
    limitations: str
    courses: list[CourseRule]

    @model_validator(mode="after")
    def unique_courses(self) -> CatalogSpec:
        codes = [course.code for course in self.courses]
        if len(codes) != len(set(codes)):
            raise ValueError("Duplicate rules in catalog")
        return self


class CompletedCourse(BaseModel):
    code: str
    grade: str | None = None

    @field_validator("code")
    @classmethod
    def check_code(cls, code: str) -> str:
        return normalize_course(code)

    @field_validator("grade")
    @classmethod
    def check_grade(cls, grade: str | None) -> str | None:
        if grade is None:
            return None
        value = grade.upper().strip()
        if value not in GRADES:
            raise ValueError("Supported grades: A, B, C, D, F, P, W, I")
        return value


class PlannedTerm(BaseModel):
    term: str
    courses: list[str] = Field(min_length=1)

    @field_validator("term")
    @classmethod
    def check_term(cls, term: str) -> str:
        term_sort_key(term)
        return term

    @field_validator("courses")
    @classmethod
    def check_courses(cls, courses: list[str]) -> list[str]:
        return [normalize_course(course) for course in courses]


class AssessmentRequest(BaseModel):
    catalog_id: str
    completed: list[CompletedCourse] = Field(default_factory=list)
    planned_terms: list[PlannedTerm] = Field(min_length=1)

    @model_validator(mode="after")
    def consistent_plan(self) -> AssessmentRequest:
        terms = [term_sort_key(entry.term) for entry in self.planned_terms]
        if terms != sorted(set(terms)):
            raise ValueError("Planned terms must be unique and in ascending chronological order")
        completed = [course.code for course in self.completed]
        planned = [code for entry in self.planned_terms for code in entry.courses]
        all_courses = completed + planned
        if len(all_courses) != len(set(all_courses)):
            raise ValueError(
                "A course cannot appear more than once or in both completed and planned"
            )
        return self


class CourseAssessment(BaseModel):
    course: str
    term: str
    status: Literal["clear", "conditional", "blocked", "uncertain", "unsupported"]
    severity: Literal["none", "medium", "high", "unknown"]
    explanation: str
    supporting_rule: str | None
    source_url: str | None
    source_section: str | None


class AssessmentResponse(BaseModel):
    catalog_id: str
    rules_version: int
    evaluations: list[CourseAssessment]
    disclaimers: list[str]
