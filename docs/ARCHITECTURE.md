# Pathwise architecture and trust boundaries

```
React + Tailwind UI
   |
   +-- src/lib/demo.ts: version-labeled fictional course rules and demo profile
   +-- src/lib/engine.ts: pure prerequisite checks, requirements progress,
   |                      workload constraints and conditional term projections
   +-- What-if scenario solver: respects fixed coursework, prerequisite order,
   |                            and configurable term load/summer options
   +-- Guided explanation layer: templates based only on engine evaluations and
   |                              local demo source IDs; **no LLM calls**
   +-- localStorage: only explicit browser state, no account or network sync
   +-- export/import: explicit JSON file validation and no silent uploads
```

This is **not** an institutional audit. The solver cannot infer that a course is offered, that an exception is approved, that credits transfer, or that a university will certify graduation. Unsupported claims must remain unknown, not be inferred from the LLM or a green progress bar.

No third-party service or user academic record is transmitted. Users should not import personal records until a future privacy/security review supports that use case. `localStorage` is not encrypted and may be lost through clearing browser data; exports can be stored elsewhere. All personal data is local and manually entered in this demo.

## Planned, not implemented

- Verified catalog ingestion, provenance and source-grounded retrieval
- PDF transcript parsing
- WebLLM / Transformers.js on-device optional AI explanations
- Formal academic equivalency modeling, minimum grade and overlap/credit allocations
- Advisor approval integration or live course availability
- Cross-device sync, encryption, authentication and production observability
