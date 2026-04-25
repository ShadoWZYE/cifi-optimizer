# DB-Native Reconstruction Framework

This document records the active reconstruction architecture on the current branch.

It exists to keep future work inside the DB-native loop that now owns TokenShop subject identity, seam state, contract projection, and evidence acquisition. New work should extend this framework rather than reintroducing target-shaped Python policy or treating generated system-unit rows as the primary runtime model.

## Core idea

The active reconstruction cycle is:

1. app or tool asks the DB what is known, missing, blocked, or nonblocking for a canonical subject
2. the DB chooses the next seam or evidence-acquisition run
3. trace executes only that DB-planned work
4. reducers/materializers update normalized subject facts, subject state, and subject contracts
5. app/tool read surfaces update from canonical DB views
6. generated system units and bundle-shaped exports remain compatibility, debug, or distribution artifacts

The primary runtime model is no longer:

- hardcoded target ids
- target-shaped bundle payloads
- `data/system-units/token-shop.v1.json`
- compatibility boundary rows

Those still exist, but only as:

- adapter inputs
- fallback surfaces when the DB cannot yet ground a lane honestly
- export/debug artifacts

## Canonical DB subjects

### Row-local subjects

Canonical row-local identity is DB-discovered from row shell evidence, not authored target ids.

Example:

- compatibility target id: `token-shop-atu7-mk3-bridge`
- canonical subject id: `row:ATU7Button`
- subject kind: `row-local`

The DB now derives row-local identity from reusable evidence sources such as:

- reconstruction row shell
- semantic-scope row shell
- resolver/support-row shell evidence
- row-local graph support

Legacy target ids remain in `targetAliases` and are still accepted as execution-scope adapters.

### Range/family subjects

Canonical family identity is also DB-owned.

Examples:

- compatibility target id: `token-shop-daily-tokenium-family`
- canonical subject id: `range:token-shop:ATU14Button-ATU19Button`
- subject kind: `range-family`

- compatibility target id: `token-shop-late-atu-family`
- canonical subject id: `range:token-shop:ATU24Button-ATU28Button`
- subject kind: `range-family`

These subjects are derived from support-row windows, canonical reconstruction state, and current normalized subject facts.

## Compatibility target aliases

Target ids are now compatibility handles, not the canonical reconstruction identity.

They still matter for:

- explicit `--target` execution
- old app/tool adapter inputs
- continuity while consumers migrate

They should not be the app-facing data model or the primary identity in new reducers.

If a new TokenShop object seems to require another hand-authored target id, the default question is:

- which DB subject-identity rule is missing?

not:

- which Python dict entry should be added?

## Normalized seam facts

### `materialized_subject_edge_facts`

This is the normalized per-subject seam-fact layer.

It records reusable facts like:

- known positive edges
- missing seams
- blocked seams
- bounded nonblocking closures

Current TokenShop examples:

- `row:ATU7Button`
  - known:
    - `exact-shell-to-action-hook`
    - `exact-shell-to-prefab`
    - `exact-shell-to-title`
  - missing:
    - `exact-display-update-path`
    - `runtime-model-gap`

- `range:token-shop:ATU14Button-ATU19Button`
  - known:
    - `exact-shell-to-title`
    - `exact-display-update-path`
  - nonblocking:
    - `exact-shell-to-action-hook`
    - `runtime-model-gap`

- `range:token-shop:ATU24Button-ATU28Button`
  - blocked:
    - `exact-shell-to-title`
    - `exact-shell-to-prefab`
    - `exact-effect-to-shell-join`

These facts are derived by reusable DB rules over:

- canonical fragments
- reconstruction/assessment materialized state
- graph links
- materialized term views
- resolver-target state
- evidence payload hits

The goal is to replace target-shaped Python seam logic with subject-class rules.

## Subject state

### `materialized_subject_state_views`

This is the canonical seam-state layer for runtime use.

It aggregates normalized facts into:

- `knownEdges`
- `missingEdges`
- `blockedEdges`
- `nonblockingEdges`
- `nextSeam`
- proof snippets

All normal runtime seam selection should come from subject state, not from:

- `decisionSummary`
- `baselineGap`
- bundle payload summaries
- target-specific Python branches

### Monotonic selection

Subject-state selection is monotonic by quality, not by raw recency.

Why this matters:

- evidence acquisition or partial reruns can produce a newer but weaker projection
- the selector must not replace a stronger grounded state with that weaker rerun

Protected TokenShop example:

- canonical subject: `range:token-shop:ATU14Button-ATU19Button`
- preserved stronger state:
  - `blockedEdges=[]`
  - `nonblockingEdges=['exact-shell-to-action-hook', 'runtime-model-gap']`
  - `nextSeam.status='clear'`

This prevents the Daily Tokenium drift where a repeated acquisition run produced a newer repeated-gap projection that was weaker than the already-grounded clear state.

## Subject contracts

### `materialized_subject_contract_views`

This is the first stable app/tool-facing DB contract layer.

It exposes:

- `subjectId`
- `subjectKind`
- `subjectKey`
- `subjectLabel`
- `targetAliases`
- `knownEdges`
- `missingEdges`
- `blockedEdges`
- `nonblockingEdges`
- `nextSeam`
- safe grounded row fields
- support summary
- provenance summary
- `blockedInputReason`
- lane-specific grounded fields and blocked reasons

Current TokenShop grounded fields include:

- row shell fields/path ids
- action methods
- prefab candidates
- display update hooks
- literal title recovery
- token-bank controller shell
- token-bank state shell
- tokenium naming
- token-bank formula

These contracts are what app/tool consumers should read by default.

## Resolver projection

### `materialized_resolver_target_views`

Resolver-target rows are now projection layers over canonical subject/state/contract data.

They still expose useful adapter fields like:

- aliases
- support rows
- support surfaces
- routine/profile hints
- planner-facing target metadata

But they should not become the place where canonical seam state is rebuilt.

Their role is:

- help request resolution
- project current DB knowledge into runnable execution directives
- preserve compatibility inputs while consumers migrate

## Evidence acquisition diagnostics

### `materialized_acquisition_diagnostics_views`

Missing exact term evidence should now go through DB-native acquisition planning, not human target guessing.

For each acquisition term, diagnostics persist:

- selected scope
- expected coverage
- status/outcome
- timeout/wait-cap behavior when known
- evidence hits found
- evidence sources checked
- next recommended narrower scope/term

The planner should classify failures as one of:

- routing failure
- execution compatibility failure
- native/shell timeout
- true missing evidence

### Current TokenShop example

The remaining Daily Tokenium lane gap is still:

- `BuyLM244`
- `The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu`

Current status:

- dry-run planner routes both to `token-shop-atu4-mod`
- full acquisition attempts hit the shell wait cap
- exact DB evidence is still missing for both terms
- the lane therefore stays blocked honestly

This is an evidence/materializer gap, not an app migration problem.

## Consumer migration rules

Consumers should migrate in this order:

1. canonical subject contracts
2. canonical subject state
3. legacy system-unit or boundary payloads only as fallback

Do not migrate a consumer just because a field is convenient to expose.

Only migrate when the contract fields are fully grounded.

Current examples:

- migrated:
  - checked-row editor
  - TokenShop coverage summary
  - owner-shell summary
  - save-boundary summary
  - action-lane summary
  - tokenium naming summary
  - token-bank controller shell summary
  - token-bank state summary
  - token-bank formula summary

- not migrated yet:
  - Daily Tokenium lane summary

Reason:

- `dailyTokeniumLane` still reports `missing-db-term-evidence` for the two exact terms above

## Generated system units and bundles

The following are no longer the primary runtime model:

- `data/system-units/token-shop.v1.json`
- `data/system-units/trace.v1.json`
- target-shaped bundle/system-unit compatibility rows

They remain useful as:

- exports
- debug snapshots
- compatibility artifacts
- historical provenance

They should not be treated as the first source of truth when DB-native subject/state/contract rows already exist.

## TokenShop examples

### `row:ATU7Button`

Canonical row-local subject for the old `token-shop-atu7-mk3-bridge` target.

Current dry-run convergence:

- `--query "mk3 title"`
- `--target token-shop-atu7-mk3-bridge`

Both resolve to:

- subject: `row:ATU7Button`
- known edges:
  - `exact-shell-to-action-hook`
  - `exact-shell-to-prefab`
  - `exact-shell-to-title`
- next seam:
  - `exact-display-update-path`

### `range:token-shop:ATU14Button-ATU19Button`

Canonical range-family subject for the old `token-shop-daily-tokenium-family` target.

Current dry-run convergence:

- `--query "daily tokens title"`
- `--target token-shop-daily-tokenium-family`

Both resolve to:

- subject: `range:token-shop:ATU14Button-ATU19Button`
- `traceDirective=reuse-materialized`
- blocked edges: none
- next seam: none
- nonblocking closures:
  - `exact-shell-to-action-hook`
  - `runtime-model-gap`

Its contract also now accumulates grounded tokenium naming and token-bank formula fields without regressing the stronger clear state.

## What to do next

When working in this framework:

- prefer adding or tightening DB fact/materializer rules
- prefer consumer migration only after contract fields clear honestly
- prefer deleting superseded Python target/support/reconstruction logic over adding new compatibility layers

Do not:

- add new target-shaped Python branches for TokenShop
- ask a human to guess a trace target for exact missing terms
- migrate `dailyTokeniumLane` consumers while the exact DB evidence gap remains open

## Immediate next task

Stay in the Daily Tokenium DB evidence lane:

1. acquire exact DB evidence for `BuyLM244`
2. acquire exact DB evidence for `The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu`
3. rematerialize `materialized_subject_contract_views`
4. migrate `getDailyTokeniumLaneSummary` only if `blockedInputReasons.dailyTokeniumLane` clears honestly

