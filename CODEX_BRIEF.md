# CODEX_BRIEF.md

Work in this repo with grounded, focused changes.

## Goal

Help build the grounded MVP core of a local-first CIFI toolkit that can later absorb fragmented external-tool workflows.

## Rules

- keep diffs focused
- preserve local-first browser behavior
- prefer extraction, mapping, validation, or small implementation slices over redesign
- do not invent formulas, labels, or player-state fields
- treat `state.playerProfile` as the shared state boundary
- keep grounded truth separate from planner helpers and external/community inputs
- prefer APK/Unity evidence when game truth is missing
- do not force systems into one UI or one recommendation surface unless that clearly improves user value

## MVP focus

- player profile
- guided/manual import
- shard workflow
- token/diamond planning
- loop-reset guardrails
- explainable recommendation/planning outputs

## Blocker rule

If a system does not yet have grounded owner, labels, currencies, player inputs, and clear user value, keep it in extraction, mapping, validation, or descriptive-mode work.

## Verify

Run relevant checks when touched:
- `npm run verify:data`
- `npm test`
- `node --check app.js`