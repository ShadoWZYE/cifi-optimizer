# Materialization Speed Upgrade Plan

## Goal

Reduce productive trace-run wall time by making DB persist/materialization incremental enough that `--best-gap` only rebuilds artifacts whose dependency content actually changed.

## Current bottleneck

The dominant cost is not planner selection or native extraction. It is downstream rebuild work after a productive run:

1. trace fragments are upserted
2. canonical/materialized scope views are rebuilt
3. subject-state / resolver / contract views are refreshed
4. cluster backfills and planner eligibility are rewritten

The active code already scopes rebuilds by `trace_scope` and already short-circuits unchanged target bundles by dependency proof. The next work is extending that discipline to downstream subject-state and contract layers and removing duplicated refresh work.

## Upgrade phases

### Phase 1: Remove duplicated downstream refresh work

- Stop recomputing subject-state/resolver inputs multiple times inside one scope refresh.
- Allow contract materialization to reuse already-computed subject-state and resolver-target payloads.
- Keep planner eligibility writes hash-aware.

Expected result:
- lower constant cost for every productive scoped refresh
- less repeated JSON decode / dependency signature work

### Phase 2: Extend hash-based short-circuiting downstream

- Reuse existing dependency signatures / payload hashes for:
  - subject-state
  - subject-contract
  - planner eligibility
- Skip downstream writes when payload hash is unchanged, not just when target-bundle dependency proof is unchanged.

Expected result:
- productive runs still rebuild touched semantics, but unchanged downstream layers stop rewriting

### Phase 3: Dependency-aware downstream narrowing

- Persist explicit dependency keys between:
  - target bundle -> subject state
  - subject state -> subject contract
  - subject/contract -> planner eligibility / shared cluster backfills
- Refresh only impacted downstream artifacts after a scoped target-bundle change.

Expected result:
- large family/productive runs only refresh the specific downstream subject/contract graph they actually affect

### Phase 4: Frontier-grade materialization mode

- Add a lighter post-run path for acquisition/best-gap execution that updates only:
  - acquisition diagnostics
  - minimal term/seam frontier state
  - rerank-critical subject summaries
- Defer full rich app-facing bundle rebuild when not required for the next planning step.

Expected result:
- `--best-gap` can keep advancing evidence without paying the full rich materialization tax every iteration

### Phase 5: Hot payload normalization

- Normalize frequently-read planner/materializer fields out of large JSON payloads into typed rows/columns:
  - dependency keys
  - selected/requested terms
  - seam coverage rows
  - lightweight subject summary fields

Expected result:
- less Python JSON churn
- cheaper comparison and grouping
- better indexed reads

## Implementation order

1. Phase 1
2. Phase 2
3. Measure again
4. Phase 3 if DB writes remain dominant
5. Phase 4 only after the dependency graph is stable
6. Phase 5 if JSON churn is still material

## Non-goals

- swapping SQLite for another engine first
- broad app/runtime redesign before rebuild granularity is fixed
- target-specific special cases as the primary optimization path
