# CODEX_BRIEF.md

Work in this repo with small, grounded changes.

## Goal

Help ship the local-first CIFI MVP without speculative mechanics, broad rewrites, or fake optimizer precision.

## Rules

- keep diffs small and focused
- preserve existing local-first browser behavior
- prefer extraction/cleanup over redesign
- do not invent formulas, labels, or player-state fields
- keep external/community-tool data clearly labeled
- treat `state.playerProfile` as the shared state boundary
- keep recommendation outputs explainable
- use repo-local APK/Unity evidence before external sources when docs are unclear

## MVP focus

- player profile
- guided/manual import
- shard workflow
- token/diamond planning
- loop-reset warnings
- unified recommendation feed

## Blockers

If a system does not have grounded owner, labels, currencies, and player-owned inputs, do not wire it into recommendation logic. Keep it descriptive, documented, or quarantined instead.

## Verify

Run relevant checks when touched:

- `npm run verify:data`
- `npm test`
- `node --check app.js`

## Key refs

- `AGENTS.md`
- `docs/roadmap/mvp-plan.md`
- `docs/roadmap/research-tracks.md`
- `docs/contracts/`
- `docs/unity/unity-audit-playbook.md`