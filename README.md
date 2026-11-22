# Pathwise — understand your degree, see the risks, plan your next move

**Working local-first prototype** built with React, TypeScript, Vite and Tailwind CSS. Pathwise helps students explore degree requirements, prerequisite chains, and alternate semester plans with a deterministic rules engine and a guided, source-labeled explainer.

> **Essential scope:** The bundled program, course identifiers, prerequisites, student, dates and rules are **fictional demonstration data**. This is **not** a UT Dallas catalog, live degree audit, admissions system, or substitute for official academic advising. Future course availability is not verified.

## Start locally

Requires Node.js 22+ and npm:

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (usually http://127.0.0.1:5173).

```bash
npm test
npm run build
npm run preview
```

## What works now

- **Degree health:** requirements progress, completed vs planned credit distinction, prioritized risks and catalog/source IDs.
- **Requirements explorer:** all fictional requirements, prerequisites and completion labels.
- **Semester planner:** move a course between supported terms, mark courses complete/in progress/unplanned, and immediately recalculate risk.
- **What-if Studio:** compare current, 12-credit constrained and summer-accelerated schedules, preview changes and apply a scenario. All outputs are conditional.
- **Ask Pathwise:** deterministic explanations grounded in rule IDs (not generative AI). It cannot invent academic advice or policies.
- **Advisor brief:** printable/shareable browser report and plain-text copy, with explicit outstanding questions.
- **Privacy:** localStorage only; export, validate and import a JSON plan; reset and delete local data. No sign-in, backend, API keys, or personal transcript uploads.

## Free deployment

Static build outputs to `dist/`. Cloudflare Pages (free) can connect this repository and use build command `npm run build` and output directory `dist`. GitHub Pages also works with a configured Vite base path. The `public/_redirects` file supports SPA fallback on Cloudflare Pages.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DEMO_RULES.md](docs/DEMO_RULES.md) and [docs/EVALUATION.md](docs/EVALUATION.md).

The requirement engine is deliberately deterministic. Its task is to identify **known constraints in the demonstration dataset**, not predict real university eligibility. Only student-entered data is held locally. No third-party AI model or university account connection is used.

## Next iteration

Integrate a verified, permissioned versioned catalog for a narrow real-world program; add reviewed transfer equivalencies and minima; verify future offerings; build source-linked local document retrieval; run independent tests with human-reviewed cases and a student usability pilot. Do not claim accuracy, adoption or outcomes until those evaluations are executed and recorded.
