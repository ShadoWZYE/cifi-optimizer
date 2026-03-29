# PR Roadmap (CIFI MVP)

## Goal

Move from prototype-era grounding work to a stable MVP roadmap without large rewrites.

References:

- `AGENTS.md`
- `docs/mvp-direction.md`
- `docs/research-followup-execution-plan.md`

## Current position

Already on `main`:

- `state.playerProfile`
- profile normalization/migration
- grounded descriptive shard workflow
- smoke syntax check for `app.js`

The next work is boundary hardening and controlled MVP slices, not "fix the broken app."

## Principles

- each PR must be shippable
- prefer extraction and cleanup over redesign
- keep `state.playerProfile` as the single source of truth
- do not present speculative formulas as grounded truth
- keep external/community-tool data labeled
- use the Research tab for intake, not silent scope expansion

## PR 1: Data Contracts and Profile Boundary

Goals:

- lock the boundary between canonical state, planning inputs, and external models
- make shipped datasets trustworthy inputs

Changes:

- document the dataset contract for shipped JSON assets
- ship a checked-in bundled-dataset manifest
- validate snapshot, shard, token-shop, and multiverse-market datasets against that manifest
- tighten `PlayerProfile` and import mapping docs
- expand tests around normalization and contract shape

Output:

- stable data boundary
- stable profile boundary

## PR 2: Shard Workflow and Loop Guardrails

Goals:

- strengthen grounded shard guidance
- add warning-oriented loop guidance without speculative simulation

Changes:

- improve shard explainability and uncertainty labeling
- ensure shard outputs follow the shared recommendation contract
- add loop reset warning rules

Output:

- grounded shard recommendations
- trust-building warning layer

## PR 3: Unified Feed for Active MVP Guidance

Goals:

- converge active shard and loop outputs into one recommendation feed
- make feed ranking explicit without pretending scores are optimizer math

Changes:

- normalize shard and loop priority into one visible feed
- improve rendering and validation around mixed-module recommendation output
- keep spend blocked until its integration gate passes

Output:

- one explainable recommendation surface

## PR 4: Spend Planner Foundation

Goals:

- ship the first MVP-safe spend planner once spend systems are mapped enough for app use

Changes:

- normalize token-shop and multiverse-market data only after their integration gates pass
- add first-pass token/diamond planning logic
- harden recommendation-contract tests

Output:

- practical spend-planner foundation

## PR 5: Test and Delivery Hardening

Goals:

- catch dataset drift and contract regressions early
- make future feature work safer

Changes:

- extend smoke coverage toward executable contract checks
- keep a local dataset verification path
- optionally add lightweight CI after local commands stabilize
- document dataset refresh expectations

## Research-tab intake rule

Future feature candidates should enter through the Research tab and `docs/research-tracks.md` before becoming roadmap work.

Promotion requires:

- grounded CIFI terminology
- documented source quality
- clear classification: canonical, planner-only, external-model, or speculative
- clear MVP impact
- a shippable slice

## Exit condition

MVP is complete when the app has:

- one unambiguous `PlayerProfile`
- grounded shard workflow
- MVP-safe token/diamond spend planning
- loop-reset warnings
- one unified recommendation feed
- explainable outputs with assumptions and confidence
- local import/export and stable validation flow
