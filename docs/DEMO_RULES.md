# Fictional demo requirement source

Pathwise's initial data is **fabricated solely for demonstrating the interface and deterministic rules engine**. Its course codes, names and prerequisites should never be attributed to a real university or a real catalog.

The authoritative source of demo rules inside this repository is `src/lib/demo.ts`; each `COURSES` item has a stable `DEMO-...` rule ID.

- A requirement counts as complete only when explicitly marked completed.
- A course with prerequisites must follow them in a strictly later academic term, unless the prerequisite is already completed.
- The planner counts completed and planned credit totals separately.
- Student-defined workload preference is a soft planning warning.
- A schedule extending beyond the selected target receives a timing warning.
- Projections are conditional and assume future course offerings and other approvals can be verified.
- No externally sourced degree facts, course availability, transfer equivalencies, or student outcomes are represented in the synthetic dataset.

Before supporting a real university, add reviewed catalog artifacts, version applicability, minimum grades, alternative prerequisites and exception handling, provenance, tests and an explicit advisor review policy.
