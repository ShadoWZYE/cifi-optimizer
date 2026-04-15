# Codex Handoff: CIFI Grounding Pass

## Situation

The repo currently contains structural work that is useful, but some of the shard and profile logic is not grounded in verified CIFI mechanics.

The goal of this pass is not to expand features.

The goal is to:
- save the grounding research in the repo
- standardize terminology to CIFI
- make defaults non-fictional
- neutralize misleading shard logic
- prepare a safe base for future optimizer work

## Immediate rules

- Do not invent mechanics
- Do not preserve fake precision
- Prefer grounded placeholder behavior over fabricated scoring
- Keep diffs focused and incremental
- Treat the active grounding lane as owned work, not a one-off task
- Continue in the same lane by default after each successful pass
- Realign tools, probes, or evidence paths when the current instrument cannot clear the blocker
- Stop only when human input, human validation, or a real cross-lane choice is needed
- Preserve local-first behavior
- Do not commit directly to main

## Priority files

- docs/cifi_verified_spec.md
- docs/cifi_grounding_plan.md
- docs/cifi_sources.md

Then review:
- README.md
- AGENTS.md
- docs/contracts/import-mapping.md
- docs/ingest-process.md
- app.js
- index.html
- tests/smoke.mjs

## What to change first

1. Add the new docs
2. Standardize CIFI casing in docs and safe UI text
3. Make default PlayerProfile blank instead of fictional
4. Remove, quarantine, or disable unsourced shard recommendation logic
5. Update tests away from fictional expected outcomes

## What not to do yet

- do not rebuild the full shard optimizer unless verified tables are present
- do not expand non-MVP systems
- do not add new speculative formulas

## Continuation note

If this archived handoff is ever used to restart work, treat it as lane carry-forward rather than a closed task list. The next move should stay inside the same grounding lane unless a real lane split or human decision is required.
