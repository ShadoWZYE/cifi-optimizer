# MVP Plan

## Goal

Move from prototype-era grounding work to a stable, grounded MVP through small shippable slices.

## Product direction

Build a local-first CIFI assistant that answers:

> What should I do next, and why?

The MVP is an explainable recommendation tool, not a full simulator.

## MVP scope

Core inputs:

- manual or guided player profile entry
- bundled grounded datasets
- labeled planner-only helper inputs where needed
- optional clearly labeled external/community-derived inputs

Core outputs:

- upgrades
- warnings
- tradeoffs
- assumptions
- confidence

Core modules:

1. shard workflow
2. token/diamond spend planning
3. loop-reset guardrails
4. unified recommendation feed

## Working rules

- stay inside MVP
- keep `state.playerProfile` as the shared source of truth
- do not introduce invented formulas or fake precision
- keep external/community data visibly labeled
- prefer shippable slices over broad refactors
- treat research as intake, not silent scope expansion

## Source priority

Use this order:

1. committed repo docs and shipped datasets
2. committed APK/Unity artifacts and extraction outputs
3. official/public corroboration
4. community or labeled external-model support

If the APK/Unity path has not been checked for an unresolved mechanic, it should not leave research status.

## Sequence

1. Lock boundaries
   - clarify canonical player state, planning helpers, external models, and compatibility sinks
2. Make bundled data trustworthy
   - validate shipped datasets and keep classifications truthful
3. Map systems before planner slices
   - confirm owner, labels, currencies, and player-owned inputs
4. Land MVP-safe planner slices
   - only on systems that passed the integration gate
5. Harden delivery
   - expand tests and make dataset drift fail fast

## PR order

### PR 1 — Data contracts and PlayerProfile boundary

Goals:
- lock state boundaries
- make shipped datasets trustworthy

Outputs:
- stable dataset boundary
- stable profile boundary

### PR 2 — Shard workflow and loop guardrails

Goals:
- strengthen grounded shard guidance
- add warning-first loop guidance

Outputs:
- grounded shard recommendations
- trust-building warning layer

### PR 3 — Unified recommendation feed

Goals:
- converge active MVP-safe outputs into one explainable feed

Outputs:
- one recommendation surface
- clearer ranking and rendering contract

### PR 4 — Spend planner foundation

Goals:
- ship first MVP-safe token/diamond planning once spend systems pass mapping gates

Outputs:
- practical spend-planner foundation

### PR 5 — Test and delivery hardening

Goals:
- catch dataset drift and contract regressions early

Outputs:
- safer future feature work
- clearer verification path

## Module rules

### Shards
- keep descriptive until numeric truth is grounded
- keep provenance and uncertainty visible

### Spend
- separate verified extracted values from heuristics
- do not pretend partial extraction is complete planner truth

### Loop guardrails
- warning-first, not simulator-first
- no fake ROI or prestige certainty

### Unified feed
- use one recommendation contract
- clearly distinguish upgrades from warnings

## Research-track rule

`docs/roadmap/research-tracks.md` is the intake and staging lane for unresolved work.

A track can move into roadmap or implementation only when:

- terminology is grounded
- source quality is documented
- APK/Unity path was checked
- confidence and uncertainty are explicit
- classification is clear
- MVP value is clear
- the work can be cut into a shippable slice

## Definition of done

The next milestone is complete when the app has:

- one unambiguous `PlayerProfile`
- grounded shard workflow
- MVP-safe token/diamond planning
- loop-reset warnings
- one unified recommendation feed
- explainable outputs with assumptions and confidence
- stable local validation flow