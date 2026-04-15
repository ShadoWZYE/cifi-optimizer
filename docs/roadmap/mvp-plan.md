# MVP Plan

## Goal

Build a grounded MVP core that can expand into a unified replacement for fragmented external CiFi tools.

## North star

Build one grounded local-first CIFI toolkit that gradually absorbs external tools by shipping coherent, high-value slices tied to real player questions.

## Current phase

The current phase is not full tool replacement. It is to build the grounded MVP core that makes later consolidation credible:

- one canonical `state.playerProfile`
- grounded shard workflow
- MVP-safe token/diamond planning
- loop-reset guardrails
- explainable recommendation/planning outputs
- clear separation between game truth, planner helpers, and external/community compatibility inputs

## Product direction

Build a local-first CIFI toolkit whose first product surfaces help players answer:

> What should I do next, and why?

The MVP is not a full simulator and does not assume all systems should converge into one surface up front.

Default bias:
- start from the narrow player question
- identify the minimum grounded inputs needed to answer it
- prefer the largest coherent adjacent slice that can answer it honestly without exceeding review or validation safety
- treat research, extraction, and decompilation as intake that supports that slice
- recover whole related families together when they share implementation shape
- do not confuse tiny scope with disciplined scope

## Local-first meaning

Local-first means the core app works from locally controlled player state and shipped repo data by default.

Player state may be:
- entered manually
- guided through the UI
- imported from helper flows
- later assisted by OCR or similar tooling

The requirement is that canonical state lands in the app’s local model and remains user-controlled.

## MVP scope

Core inputs:
- manual or guided player profile entry
- bundled grounded datasets
- planner-only helper inputs where needed
- clearly labeled external/community-derived inputs where needed

Core outputs:
- upgrades
- warnings
- tradeoffs
- assumptions
- confidence

Core MVP modules:
1. shard workflow
2. token/diamond planning
3. loop-reset guardrails
4. explainable recommendation/planning outputs

## Working rules

- stay inside MVP
- keep `state.playerProfile` as the shared source of truth
- do not introduce invented formulas or fake precision
- keep external/community data visibly labeled
- prefer shippable slices over broad refactors
- treat research as intake, not silent scope expansion
- do not let broader decompilation or adjacent lane recovery become an implicit blocker unless the current slice actually consumes that input
- do not split work into row-by-row, field-by-field, symbol-by-symbol, or tiny evidence-fragment tasks when the surrounding family can be recovered through the same path honestly
- only split when the boundary is real: different owner families, runtime systems, validation paths, blocker states, or unrelated review risk

## Lane contract

Every active lane should declare:
- the user-facing question it is trying to answer
- the minimum required inputs
- the explicit non-blockers
- the current true blocker
- the largest coherent adjacent slice that is still shippable, reviewable, and validation-safe

This contract is how work gets chosen, handed off, and promoted from research into implementation.

## Source priority

1. committed repo docs and shipped datasets
2. committed APK/Unity artifacts and extraction outputs
3. official/public corroboration
4. community or labeled external-model support

If the APK/Unity path has not been checked for an unresolved mechanic, it should not leave research status.

## Expansion rule

A system should move from research into implementation only when it has:
- grounded terminology
- verified owner and currencies
- mapped player-owned inputs
- a clear boundary into `state.playerProfile`, `planning`, `externalModels`, or `compatibility`
- a meaningful path toward improving a real player painpoint or replacing part of an external-tool workflow

## Product test

Prioritize roadmap work that does at least one of:
- strengthens the shared player-state backbone
- improves a major player painpoint better than current community tooling
- replaces a repeated external-tool workflow
- increases grounded recommendation or planning coverage
- reduces fragmentation without forcing premature UI unification
- can ship as one coherent adjacent slice with a clear user-facing question

## Sequence

1. Lock boundaries
   - clarify canonical player state, planning helpers, external models, and compatibility sinks
2. Make bundled data trustworthy
   - validate shipped datasets and keep classifications truthful
3. Map systems before planner slices
   - confirm owner, labels, currencies, and player-owned inputs
4. Land MVP-safe slices
   - implement grounded improvements that solve real player painpoints
   - keep the slice scoped to the largest coherent adjacent family supported by the inputs it actually consumes
5. Harden delivery
   - expand tests and make dataset drift fail fast

## Current milestone priorities

### 1. Data contracts and PlayerProfile boundary
Goals:
- lock state boundaries
- make shipped datasets trustworthy

### 2. Shard workflow and loop guardrails
Goals:
- strengthen grounded shard guidance
- add warning-first loop guidance

### 3. Spend planner foundation
Goals:
- ship the first MVP-safe spend tool slice against an explicit lane contract
- evaluate TokenShop, token-bank, Daily Tokenium, and Emporium work as separate blockers unless one slice directly consumes another lane's inputs

### 4. Explainability and delivery hardening
Goals:
- improve clarity of outputs
- catch dataset drift and contract regressions early

## Surface rule

Recommendation and planning surfaces should converge only where that clearly improves user value, reduces fragmentation, or absorbs an external-tool workflow more cleanly than keeping a separate surface.

## Research-track rule

`docs/roadmap/research-tracks.md` is the staging lane for unresolved extraction, mapping, validation, and implementation-prep work.

A track can move into implementation only when:
- terminology is grounded
- source quality is documented
- APK/Unity path was checked
- confidence and uncertainty are explicit
- classification is clear
- MVP value is clear
- the work can be cut into a shippable slice
- the work is framed as the largest coherent adjacent slice rather than the smallest local artifact
- the lane contract makes the true blocker and explicit non-blockers visible

## Definition of done

The next milestone is complete when the app has:
- one unambiguous `PlayerProfile`
- grounded shard workflow
- MVP-safe token/diamond planning
- loop-reset warnings
- explainable decision-support outputs
- stable local validation flow

## After MVP

After the grounded MVP core is stable, expand by absorbing the highest-value external-tool workflows first, prioritizing those that:
- reuse the canonical player-state backbone
- have grounded data paths
- solve major player painpoints
- reduce fragmentation
- fit the local-first model without requiring a hosted backend
