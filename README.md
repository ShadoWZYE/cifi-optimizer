# CIFI Optimization Suite

A local-first web app for consolidating grounded CIFI player state, labeled planning inputs, and future optimizer modules into one place.

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

Execution references:

- `docs/research-followup-execution-plan.md` — current staged implementation plan
- `docs/pr-roadmap.md` — PR-sized roadmap view
- `docs/research-tracks.md` — backlog and intake rules for the in-app Research tab

## Grounding rule

No new mechanic, formula, recommendation, or player field should be treated as real CIFI truth unless it is:

1. a known in-game concept, or
2. imported from a named external/community tool and clearly labeled as such

If a system is incomplete, the app should prefer:
- descriptive mode
- placeholders
- explicit uncertainty

over fabricated precision.

## Source priority

Grounded data work should prefer the committed APK and Unity package artifacts in this repo as the primary source path.

Use source priority in this order:

1. repo-local APK/Unity packages and extraction outputs
2. official/public sources for terminology and corroboration
3. community sources only for documented gap-filling or clearly labeled external-model support

If a future feature is being considered through the Research tab, the APK/Unity path should be checked first and documented before the feature is promoted into implementation work.

## Run locally

This app can still be opened directly in a browser, but it also includes a tiny Node-based local workflow.

### Commands

- `npm run dev` — starts a local static server on `http://localhost:4173`
- `npm run verify:data` — validates bundled dataset contracts for snapshot, shard, token-shop, and multiverse-market assets
- `npm test` — runs the smoke tests
- `node --check app.js` — validates app syntax
- `launch-cifi.vbs` — Windows launcher for normal local use
- `launch-cifi.bat` — visible debug launcher

## Windows launch flow

Use `launch-cifi.vbs` for normal desktop use.

- If the local server is already running, it is reused.
- If the launcher can see an active CIFI browser tab, it signals that tab instead of opening another one.
- If the local server is not running, the launcher starts it and waits for readiness.
- When the launcher starts the hidden local server, that launcher-owned server exits after the last connected app tab closes.
- The launcher opens the default browser to `http://localhost:4173/` only when a new tab is actually needed.

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
- `docs/dataset-contracts.md` — bundled dataset contract and validation path
- `docs/unity-audit-playbook.md` — repeatable Unity/IL2CPP mechanic extraction workflow
- `docs/unity-owner-map.md` — grounded mechanic owner index
- `docs/token-shop-values.md` — extracted token mechanic constants
- `docs/multiverse-market-values.md` — extracted Chrystos Emporium constants

## Reverse-engineering resume

The current mechanic-extraction work is resumable from checked-in scripts and documentation.

- Start with [`docs/unity-audit-playbook.md`](C:\Users\Shadow\Desktop\CiFi\docs\unity-audit-playbook.md)
- Use [`docs/unity-owner-map.md`](C:\Users\Shadow\Desktop\CiFi\docs\unity-owner-map.md) for the current grounded owner list
- Re-run:
  - `python scripts/token_shop_parse.py`
  - `python scripts/multiverse_market_parse.py`

These scripts assume the machine-local extracted Unity inputs exist under `_cifi_apk` and `_unity_joined`.

## Unity audit dependencies

To resume the checked-in Unity extraction workflow from a fresh clone:

- Git LFS is required.
- Python 3.11+ is required.
- Node.js 18+ is still required for the app itself.
- The vendored Python packages under `.deps` are used by the Unity helper scripts.
- The vendored Windows binaries under `tools` are used for manual asset inspection.

Required for the checked-in parser scripts:

- `git lfs clone` or `git lfs pull` so `_cifi_apk`, `_cifi_apk_merged`, `_unity_joined`, and large tool binaries are restored
- Python on PATH

Required only for specific optional tools:

- `.NET 6 Runtime` for `tools/UABEA/UABEAvalonia.exe`
- `.NET 8 SDK` plus NuGet restore if rebuilding `tools/CifiAssetProbe`
- LDPlayer only if you need to recreate emulator-side extracts instead of using the committed inputs

Current portability note:

- `scripts/uabea_probe.ps1` is repo-relative and can run from any clone location.
- `scripts/token_shop_parse.py` and `scripts/multiverse_market_parse.py` are also repo-relative and can run from any clone location.

## Current repo status

This repo is in a grounding phase.

That means the immediate priority is:
- make terminology correct
- make defaults truthful
- remove or label fictional mechanics
- create a safe base for future optimizer work

The app may still expose some compatibility surfaces from prototype-era work, but these should be treated as quarantined unless they are part of the MVP scope. In particular:
- shard recommendations remain in descriptive fallback mode
- Gem Nodes and OCR are non-MVP support surfaces
- ship planner calibration should be treated as community-tool state, not raw in-game state

## Research tab workflow

The in-app Research tab is now the intake lane for future feature work.

Use it to:

- review grounded findings already in the repo
- collect candidate systems before they become roadmap work
- decide which feature should be promoted next

Do not use it as proof that a feature is already committed. A research item should only move into implementation after it meets the promotion rules in `docs/research-tracks.md`.

## PlayerProfile boundary

`state.playerProfile` is split into explicit namespaces:

- `player` for grounded shared CIFI truth
- `planning` for labeled planner-only helper inputs
- `externalModels` for community-tool or experimental state
- `compatibility` for unresolved legacy fields kept only for migration safety

The active shared profile surface currently treats these as canonical:

- current LR
- diamonds
- tokens
- Academy relics
- current shards

Reference:
- `docs/player-profile-schema.md`

It is not currently the priority to expand feature count.
