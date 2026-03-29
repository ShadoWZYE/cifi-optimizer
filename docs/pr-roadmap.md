# PR Roadmap (CIFI MVP)

## Goal

Move from prototype-era grounding work to a stable MVP roadmap without large rewrites.

This roadmap is the short execution view of:

- `AGENTS.md`
- `docs/mvp-direction.md`
- `docs/research-followup-execution-plan.md`

---

## Current position

The foundation work that used to be the first blocker is already on `main`:

- `state.playerProfile` exists
- profile normalization/migration exists
- shard workflow is in grounded descriptive mode
- smoke tests already include syntax checking for `app.js`

The next work is not "fix the broken app." The next work is to tighten contracts and ship the MVP modules in controlled slices.

---

## Roadmap principles

- Each PR must be shippable.
- Prefer extraction and cleanup over redesign.
- Keep `state.playerProfile` as the single source of truth.
- Do not present speculative formulas as grounded game truth.
- Keep external/community-tool data labeled.
- Use the Research tab to queue and select future feature work, not to silently expand product scope.

---

## Phase 1: Contract-first stabilization

## PR 1: Data Contracts and Profile Boundary

### Goals

- lock the boundary between canonical state, planning inputs, and external models
- make shipped datasets trustworthy inputs
- reduce ambiguity before more planner logic lands

### Changes

- document the dataset contract for shipped JSON assets
- validate snapshot, shard, token-shop, and multiverse-market datasets
- tighten `PlayerProfile` and import mapping docs
- expand tests around normalization and contract shape

### Output

- stable data boundary
- stable profile boundary
- safer base for planner work

---

## Phase 2: MVP-safe guidance modules

## PR 2: Shard Workflow and Loop Guardrails

### Goals

- strengthen grounded shard guidance
- add warning-oriented loop guidance without speculative simulation

### Changes

- improve shard explainability and uncertainty labeling
- ensure shard outputs follow the shared recommendation contract
- add loop reset warning rules
- surface warnings clearly in recommendation output

### Output

- grounded shard recommendations
- trust-building warning layer

---

## Phase 3: Feed convergence and spend planning

## PR 3: Unified Feed for Active MVP Guidance

### Goals

- converge active shard and loop outputs into one recommendation feed
- make feed ranking explicit without pretending the scores are optimizer math

### Changes

- normalize shard and loop warning priority into one visible feed
- improve rendering and validation around mixed-module recommendation output
- keep spend-planner work blocked until its integration gate is satisfied

### Output

- one explainable recommendation surface for active MVP-safe guidance modules
- clearer feed-priority semantics for warning-first behavior

---

## Phase 4: Spend planner foundation

## PR 4: Spend Planner Foundation

### Goals

- ship the first MVP-safe spend planner once the spend systems are mapped enough for app use

### Changes

- normalize token-shop and multiverse-market data into planner-ready structures only after their integration gates pass
- add first-pass token/diamond planning logic
- harden tests around recommendation contract shape

### Output

- practical spend-planner foundation

---

## Phase 5: Release hardening

## PR 5: Test and Delivery Hardening

### Goals

- catch dataset drift and contract regressions early
- make future feature work safer

### Changes

- extend smoke coverage toward executable contract checks
- add a local dataset verification path
- optionally add lightweight CI once local commands are stable
- document release/update expectations for dataset refreshes

### Output

- faster regression detection
- safer iteration on new mechanics

---

## Research-tab intake rule

Future feature candidates should be introduced through the Research tab and tracked in `docs/research-tracks.md` before they become roadmap work.

A feature can move from Research tab to roadmap only when:

- the CIFI terminology is grounded
- the source quality is documented
- the feature is classified as canonical, planner-only, external-model, or speculative
- the MVP impact is clear
- the work can be sliced into a shippable chunk

This keeps "interesting findings" from becoming unplanned product commitments.

---

## Exit condition

MVP is complete when the app has:

- one unambiguous `PlayerProfile`
- grounded shard workflow
- MVP-safe token/diamond spend planning
- loop-reset warnings
- one unified recommendation feed
- explainable outputs with assumptions and confidence
- local import/export and stable local validation flow

At that point, the Research tab becomes the controlled intake lane for post-MVP expansion.
