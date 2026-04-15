# CIFI Optimization Suite

Local-first CIFI toolkit in active development.

## North star

Build a grounded local-first toolkit that gradually replaces fragmented external CiFi tools by shipping small tool slices tied to real player questions.

## Current phase

Build the grounded MVP core that makes later consolidation credible.

Current repo bias:

- start from a real player question
- prefer the largest coherent adjacent slice that answers it honestly and stays reviewable
- treat Codex as the owner of the active lane, not as a one-task finisher
- continue in the same lane by default after a clean successful run
- choose the next highest-value adjacent step automatically when the current slice closes
- realign tools, probes, or evidence paths when the current instrument cannot resolve the blocker
- stop only when human input, human validation, or a real cross-lane choice is needed
- use research, extraction, and decompilation to unblock that slice instead of letting them silently become the product
- keep recommendation math and broad gameplay modeling behind grounded MVP needs
- do not confuse tiny scope with disciplined scope
- recover whole related families together when they share the same implementation path, validation path, and evidence shape
- split work only when the boundary is real: different owner families, runtime systems, validation paths, blocker states, or unrelated review risk

Current MVP focus:

- canonical `state.playerProfile`
- guided/manual import
- grounded shard workflow
- MVP-safe token/diamond planning
- loop-reset guardrails
- explainable recommendation/planning outputs

This repo is not trying to force all systems into one UI or one recommendation surface up front. Surfaces should converge only where that clearly improves player value, reduces fragmentation, or replaces a real external-tool workflow.

## Slice contract

Every active lane should state:

- the user-facing question it is trying to answer
- the minimum required inputs
- the explicit non-blockers
- the current true blocker
- the largest coherent adjacent slice that is still shippable, reviewable, and validation-safe
- the default next adjacent step if the current slice lands cleanly

Adjacent lanes should only block a slice when they are actual consumed inputs for that slice.

## Lane-owner default

Codex should keep moving inside the current lane by default.

When one slice lands cleanly, the next move should be the highest-value adjacent step that still fits the lane contract and does not cross a real lane boundary. If the current tool, probe, or evidence path cannot resolve the blocker, the default move is to realign instrumentation before treating the lane as stalled.

Work should stop only when the next honest move needs human input, human validation, or a real cross-lane product choice.

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
- `docs/contracts/lane-handoff-template.md` = minimal lane handoff/result format with default next-step carry-forward
- `docs/tools/ocr.md` = optional tooling notes for OCR setup and troubleshooting

## Commands

- `npm run dev`
- `npm run ci:local`
- `npm run verify:data`
- `npm test`
- `npm run test:unit`
- `npm run check:syntax`
