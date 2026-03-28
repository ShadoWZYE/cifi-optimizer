# CIFI Optimization Suite

A local-first web app for consolidating CIFI player calibration, planning inputs, and future optimizer modules into one place.

Important: this repository currently contains a mix of:
- grounded structure that is useful for MVP work
- prototype-era assumptions that still need correction
- community-tool style modeling that must be clearly labeled when used

Do not treat an output as game-accurate unless the module explicitly identifies its data source and confidence.

## MVP scope

Per `AGENTS.md`, the MVP focuses on:

- PlayerProfile as the single source of truth
- Guided/manual player import
- Shard milestone workflow
- Diamond/token spend planning
- Loop-reset guardrails and warnings
- Unified recommendation feed
- Explainable recommendations

## Grounding rule

No new mechanic, formula, recommendation, or player field should be treated as real CIFI truth unless it is:

1. a known in-game concept, or
2. imported from a named external/community tool and clearly labeled as such

If a system is incomplete, the app should prefer:
- descriptive mode
- placeholders
- explicit uncertainty

over fabricated precision.

## Run locally

This app can still be opened directly in a browser, but it also includes a tiny Node-based local workflow.

### Commands

- `npm run dev` — starts a local static server on `http://localhost:4173`
- `npm test` — runs the smoke tests
- `node --check app.js` — validates app syntax
- `launch-cifi.vbs` — Windows launcher for normal local use
- `launch-cifi.bat` — visible debug launcher

## Windows launch flow

Use `launch-cifi.vbs` for normal desktop use.

- If the local server is already running, it is reused.
- If the local server is not running, the launcher starts it and waits for readiness.
- The launcher opens the default browser to `http://localhost:4173/?launch=1`.

## Developer flow

- Use `npm run dev` when you want the local server in a terminal session.
- Use `launch-cifi.bat` when you want visible Windows debug output.
- Use `npm test` to run the smoke suite.

## Node requirement

- CIFI requires Node.js 18+.
- Best case: `node` and `npm` are available on PATH.
- If Node is not found, the launcher should fail clearly rather than silently.

## Large-number input support

The app accepts:
- suffix notation like `28.38k`
- scientific notation like `2e5795`

Numeric UX should follow CIFI-style conventions where possible, while keeping parsing explicit and predictable.

## Structure

- `index.html` — app shell and module layout
- `styles.css` — visual system and layout
- `app.js` — state, rendering, recommendation logic, persistence
- `data/game-data.snapshot.v1.json` — app-owned snapshot data
- `docs/ingest-process.md` — ingest and snapshot workflow
- `docs/import-mapping.md` — supported import shapes
- `docs/cifi_verified_spec.md` — grounding spec
- `docs/cifi_grounding_plan.md` — grounding migration plan
- `docs/cifi_sources.md` — public source list

## Current repo status

This repo is in a grounding phase.

That means the immediate priority is:
- make terminology correct
- make defaults truthful
- remove or label fictional mechanics
- create a safe base for future optimizer work

It is not currently the priority to expand feature count.