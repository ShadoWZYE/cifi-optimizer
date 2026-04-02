# CIFI Optimization Suite

Local-first CIFI planning app focused on grounded, explainable next-step guidance.

The app is not a full simulator. It should only present mechanics, fields, and recommendations that are grounded in-game or clearly labeled as external/community-derived.

## MVP

- `state.playerProfile` as the shared source of truth
- guided/manual player import
- grounded shard milestone workflow
- token/diamond spend planning
- loop-reset guardrails
- unified recommendation feed
- explainable recommendations

## Repo rules

- keep diffs small and focused
- preserve local-first browser behavior
- do not present speculative mechanics as grounded truth
- keep external/community-tool inputs visibly labeled
- prefer APK/Unity-grounded repo-local evidence before external sourcing

See:
- `AGENTS.md`
- `CODEX_BRIEF.md`
- `docs/roadmap/mvp-plan.md`
- `docs/roadmap/research-tracks.md`

## Commands

- `npm run dev`
- `npm run verify:data`
- `npm test`
- `node --check app.js`

## Key files

- `app.js` — app state, rendering, recommendations
- `player-profile.js` — PlayerProfile schema and normalization
- `data/` — shipped datasets and manifests
- `docs/contracts/` — dataset/profile/import contracts
- `docs/roadmap/` — MVP plan and research queue
- `docs/unity/` — APK/Unity extraction workflow
- `workbench/` — committed APK/Unity artifacts
- `tools/unity/` — Unity tooling

## Current status

Immediate priority is boundary hardening and grounded MVP slices, not broad rewrites.

Non-MVP or quarantined surfaces stay out of core planner behavior until their integration gate passes.