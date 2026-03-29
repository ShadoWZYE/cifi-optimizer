# CIFI Optimization Suite

Local-first CIFI planning app. The repo mixes grounded MVP work, extracted mechanics, and labeled external-model support surfaces.

Do not treat output as game-accurate unless the module identifies its source and confidence.

## MVP

- `state.playerProfile` as the single source of truth
- guided/manual player import
- shard milestone workflow
- diamond/token spend planning
- loop-reset guardrails
- unified recommendation feed
- explainable recommendations

Core references:

- `AGENTS.md`
- `docs/roadmap/pr-roadmap.md`
- `docs/roadmap/research-followup-execution-plan.md`
- `docs/roadmap/research-tracks.md`

## Grounding rules

- Only treat a mechanic, field, or formula as CIFI truth if it is a known in-game concept or a clearly labeled external/community import.
- Prefer descriptive mode, placeholders, and explicit uncertainty over invented precision.

Source priority:

1. repo-local APK/Unity artifacts and extraction outputs
2. official/public corroboration
3. community gap-filling or labeled external-model support

If a feature enters research, the APK/Unity path should be checked first and documented before implementation.

## Commands

- `npm run dev` — local static server on `http://localhost:4173`
- `npm run verify:data` — validates shipped dataset contracts
- `npm test` — smoke tests
- `node --check app.js` — app syntax check
- `launch-cifi.vbs` — normal Windows launcher
- `launch-cifi.bat` — visible debug launcher

## Launch flow

- The launcher reuses the server if it is already running.
- Otherwise it starts a hidden detached Node server and waits for readiness.
- Launcher-owned server sessions exit after the last connected app tab closes.
- The launcher opens `http://localhost:4173/?launch=1` so the app can enforce single-tab behavior.

## Requirements

- Node.js 18+
- Git LFS for checked-in APK/Unity artifacts
- Python 3.11+ for Unity helper scripts

Optional tooling:

- `.NET 6 Runtime` for `tools/unity/UABEA/UABEAvalonia.exe`
- `.NET 8 SDK` if rebuilding `tools/unity/CifiAssetProbe`
- LDPlayer only when recreating emulator-side extracts

## Key files

- `app.js` — app state, rendering, recommendations, persistence
- `player-profile.js` — PlayerProfile schema and normalization
- `data/game-data.snapshot.v1.json` — app-owned snapshot and research track status
- `data/bundled-dataset-contract.v1.json` — shipped dataset manifest
- `docs/contracts/dataset-contracts.md` — dataset contract
- `docs/contracts/dataset-refresh-checklist.md` — dataset promotion checklist
- `docs/contracts/research-note-template.md` — APK-first note template
- `docs/contracts/player-profile-schema.md` — PlayerProfile boundary
- `docs/contracts/import-mapping.md` — supported import shapes
- `docs/roadmap/` — roadmap, execution plan, and Research-tab intake docs
- `docs/systems/` — system-specific verification and extracted-mechanics notes
- `docs/unity/unity-audit-playbook.md` — repeatable Unity extraction workflow
- `docs/unity/unity-owner-map.md` — grounded mechanic owner index
- `workbench/` — cloned APK, Unity, extract, and emulator workbench artifacts
- `tools/unity/` — Unity desktop tooling
- `.deps/` — checked-in Python dependency bundle for Unity helpers

## Unity extraction resume

Start with:

- [`docs/unity/unity-audit-playbook.md`](C:\Users\Shadow\Desktop\CiFi\docs\unity\unity-audit-playbook.md)
- [`docs/unity/unity-owner-map.md`](C:\Users\Shadow\Desktop\CiFi\docs\unity\unity-owner-map.md)

Re-run:

- `python scripts/unity/token_shop_parse.py`
- `python scripts/unity/multiverse_market_parse.py`

Those scripts assume the local Unity inputs exist under `workbench/apk/base` and `workbench/unity/joined`.

## Current status

Immediate priorities:

- keep terminology correct
- keep defaults truthful
- keep compatibility surfaces visibly quarantined
- build only on grounded or clearly labeled inputs

Current non-MVP or quarantined surfaces:

- shard recommendations remain descriptive
- Gem Nodes and OCR are non-MVP support surfaces
- ship planner calibration is community-tool state, not raw in-game state

## PlayerProfile boundary

`state.playerProfile` is split into:

- `player` for grounded shared truth
- `planning` for planner-only helpers
- `externalModels` for implementation/external-model state
- `compatibility` for migration safety and unmapped system blobs

Current canonical shared fields:

- current LR
- diamonds
- tokens
- Academy relics
- current shards

Reference:

- `docs/contracts/player-profile-schema.md`

