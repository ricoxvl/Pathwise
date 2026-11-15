# Pathwise — AI Degree Risk Navigator

**Phase 1: Technical proof of concept.** Pathwise aims to help students identify potential prerequisite and course-sequencing risks before committing to a semester plan. This repository currently implements a **deterministic, source-traceable prerequisites checker**, not an AI advisor, a degree audit, or a graduation predictor.

> **Unofficial research project.** Not affiliated with or endorsed by UT Dallas. Course rules are transcribed from a limited selection of the **official 2026 Undergraduate Catalog**. Results are for exploration and must be checked with an academic advisor before registration. Do not submit real student records to this proof of concept.

## Phase 1 capabilities

- Supports a narrow selection of **10 ITSS course prerequisite rules** relevant to UT Dallas's BS Computer Information Systems and Technology program, **2026 catalog only**.
- Represents **AND/OR prerequisite groups, prior-or-concurrent enrollment, and stated minimum grades** as structured, testable rules.
- Produces `clear`, `conditional`, `blocked`, `uncertain`, or `unsupported` results for proposed courses; each modeled result provides the official catalog URL and a human-readable supporting rule.
- Detects invalid input: duplicate courses, chronological term errors, unsupported grade formats.
- Evaluates downstream plans so blocked upstream courses do not silently count as valid.
- Uses **immutable versioned catalog releases** in PostgreSQL (SQLite can be used for local tests/development).
- Includes automated unit, persistence, and API tests; no LLM is used to determine prerequisites.

A `clear` result means only that **the specifically modeled prerequisite expression** is satisfied by student-reported courses. It does **not** mean the student is eligible to register, that the course will be offered, or that all degree requirements are satisfied.

## Official sources and coverage

- [UT Dallas 2026 BS CIST degree requirements](https://catalog.utdallas.edu/2026/undergraduate/programs/jsom/computer-information-systems-and-technology)
- [UT Dallas 2026 ITSS course descriptions and prerequisites](https://catalog.utdallas.edu/2026/undergraduate/courses/itss)

The transcribed rules are stored in [`src/pathwise/data/utdallas_cist_2026_poc_v1.json`](src/pathwise/data/utdallas_cist_2026_poc_v1.json) with source citations. Supported targets: ITSS 3312, 4381, 4300, 4330, 4370, 4312, 4380, 4351, 4301, and 4371. **ITSS 4301 is included only to test minimum-grade rules; the CIST degree page explicitly excludes it from BS CIST major credit.** Target courses absent from this fixture are reported as `unsupported`, not assumed to have no requirements.

**Not supported yet:** overall degree audit/credit totals; full program requirements; catalog migration; transfer-credit equivalencies; course restrictions/standing; advisor-approved overrides; retakes; course offerings/seats; tuition impact; validated graduation projections; student accounts; and AI explanations.

## Run locally

Requires Python 3.11+. To use PostgreSQL locally, also install Docker.

```bash
python -m venv .venv
source .venv/bin/activate   # Windows PowerShell: .venv\\Scripts\\Activate.ps1
python -m pip install -e ".[dev]"
docker compose up -d db
# PowerShell: $env:DATABASE_URL="postgresql+psycopg://pathwise:local_only_change_me@localhost:5432/pathwise"
export DATABASE_URL="postgresql+psycopg://pathwise:local_only_change_me@localhost:5432/pathwise"
python -m pathwise.seed
uvicorn pathwise.api:app --reload
```

For a lightweight development-only SQLite database, omit Docker and `DATABASE_URL`. Run `python -m pathwise.seed`, then start the server as above.

API documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

```bash
curl http://localhost:8000/v1/catalogs
curl http://localhost:8000/v1/catalogs/utdallas-cist-2026-poc-v1/courses
curl -X POST http://localhost:8000/v1/assess \
  -H 'Content-Type: application/json' \
  --data-binary @examples/assessment_request.json
```

Run tests and lint:

```bash
pytest -q
ruff check .
```

## Architecture

```text
Catalog 2026 source citations
            |
            v
  Versioned JSON fixture -- seed_catalog --> PostgreSQL/SQLite
                                                |
       Manual/synthetic plan --> FastAPI --> deterministic rules engine
                                                |
                           cited statuses + uncertainty + disclaimers
```

- `src/pathwise/schemas.py`: typed, validated inputs and nested prerequisite expressions.
- `src/pathwise/engine.py`: deterministic, dependency-aware evaluator.
- `src/pathwise/db.py`: normalized catalog/version index and structured rule JSON storage.
- `src/pathwise/api.py`: read-only catalog endpoints and assessment endpoint.
- `src/pathwise/seed.py`: idempotent catalog creation; rejects same-ID rule mutations.
- `tests/`: reproducible scenarios, API tests, and storage/versioning tests.

## Phase 1 exit criteria and next steps

**Demonstrate:** real catalog traceability, reliable AND/OR/corequisite/grade checks, coverage warnings, and passing automated scenario tests. **Not demonstrated:** advising accuracy across a full degree, verified user outcomes, or any achieved pilot metric.

Next is independent review of transcribed rules and edge cases, evaluation against advisor-labeled scenarios, then Phase 2 grounded explanations and plan comparisons. Neither course-availability forecasts nor official graduation dates will be invented.

## Privacy and responsible use

Use synthetic or consented, minimized example plans only. The proof of concept has no authentication or record-retention controls suitable for storing real student data. Do not deploy a public service accepting identifiable student records until authentication, rate-limits, data handling, and security reviews are complete.
