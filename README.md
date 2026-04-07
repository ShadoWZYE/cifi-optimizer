# CIFI Optimization Suite

Local-first CIFI toolkit in active development.

## North star

Build one centralized system that can gradually replace fragmented external CiFi tools by unifying player state, grounded data, planning workflows, and recommendations.

## Current phase

Build the grounded MVP core that makes later consolidation credible.

Current MVP focus:
- canonical `state.playerProfile`
- guided/manual import
- grounded shard workflow
- MVP-safe token/diamond planning
- loop-reset guardrails
- explainable recommendation/planning outputs

This repo is not trying to force all systems into one UI or one recommendation surface up front. Surfaces should converge only where that clearly improves player value, reduces fragmentation, or replaces a real external-tool workflow.

## Local-first

Local-first means the core app works from locally controlled player state and shipped repo data by default.

Player state may be:
- entered manually
- guided through the UI
- imported from helper flows
- later assisted by OCR or similar tooling

The requirement is that canonical state lands in the app’s local model and remains user-controlled.

## Grounding rule

Do not treat a mechanic, field, or formula as canonical CIFI truth unless it is:
1. a grounded in-game concept, or
2. a clearly labeled external/community-derived input

Prefer descriptive behavior and visible uncertainty over invented precision.

## Source priority

1. committed repo docs and shipped datasets
2. committed APK/Unity artifacts and extraction outputs
3. official/public corroboration
4. community or labeled external-model support

If the APK/Unity path has not been checked for an unresolved mechanic, it should not leave research status.

## Doc map

- `README.md` = project entrypoint
- `AGENTS.md` = repo working rules
- `CODEX_BRIEF.md` = compact Codex context
- `docs/roadmap/mvp-plan.md` = current roadmap and phase rules
- `docs/roadmap/research-tracks.md` = active research/extraction queue
- `docs/roadmap/active-grounding-boundaries.md` = compact handoff for active grounding lanes
- `docs/roadmap/known-false-paths.md` = ruled-out interpretations to keep closed
- `docs/contracts/lane-handoff-template.md` = minimal lane handoff/result format
- `docs/tools/ocr.md` = optional tooling notes for OCR setup and troubleshooting

## Commands

- `npm run dev`
- `npm run verify:data`
- `npm test`
