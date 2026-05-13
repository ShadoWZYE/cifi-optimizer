# DB-Native Reconstruction Framework

This document records the active reconstruction architecture on the current branch.

It exists to keep future work inside the DB-native loop that now owns subject identity, seam state, metadata projection, and evidence acquisition. TokenShop is the most advanced migrated system today, but new work should extend this framework for other systems as well, rather than reintroducing target-shaped Python policy or treating generated system-unit rows as the primary runtime model.

## Core idea

The active reconstruction cycle is:

1. app or tool asks the DB what is known, missing, blocked, or nonblocking for a canonical subject
2. the DB chooses the next seam or evidence-acquisition run
3. trace executes only that DB-planned work
4. reducers/materializers update normalized subject facts, subject state, subject metadata, and generic mechanics views
5. app/tool read surfaces update from canonical DB views
6. generated system units and bundle-shaped exports remain compatibility, debug, or distribution artifacts

Grounding rule for live behavior:
- When a subject already has DB-backed materialized views, target bundles, subject-state, or system-unit projections, use those DB surfaces as the source of truth for app wiring and UI display behavior.
- Do not re-ground runtime titles, formulas, or row mappings from stored fixed JSON files under `data/` if the DB-native lane already exists.

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

## Execution plans

### `canonical_semantic_fragments.execution_plan_fragment`

Execution plans are the DB-backed routing layer for follow-up work.

They should carry:

- `joinGoal`
- `claimStages`
- `depthPlan`
- `traceRoutineHint`
- `relationSeamContracts`

`relationSeamContracts` is the DB-native replacement for planner-side seam registries. It is the place where seam-specific follow-up routing, expected terms, anchors, and preferred relation scopes should live once derived.

Runtime planners should prefer the execution-plan fragment first and treat Python seam registries only as temporary compatibility fallback while old rows are being backfilled.

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

## Subject metadata

### `materialized_subject_contract_views`

This is the current stable app/tool-facing DB metadata layer.

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

These rows are still stored in `materialized_subject_contract_views`, but active runtime code should treat them as DB subject metadata rather than as the conceptual center of the model.

Current runtime naming:

- transport bundle field: `subjectMetadata`
- app/runtime enrichment label: `db-subject-metadata`
- active transport capability: `systemDbBundleApi`
- legacy compatibility aliases may still expose `subjectContracts`

`subjectMetadata` may still be present inside the DB bundle as transitional enrichment, but it is no longer treated as a separately advertised active browser/runtime transport capability.

The storage name has not been fully renamed yet, but active consumers should not build new runtime code around the old `subject-contract` terminology.

## Generic mechanics

### `materialized_entity_views`
### `materialized_fact_views`
### `materialized_relation_views`
### `materialized_gap_views`

This is the generic mechanics layer that new system migrations should target first.

It exposes:

- entity-level recovered objects
- atomic grounded facts
- reusable relations between grounded entities
- explicit gaps and blockers

Active TokenShop runtime behavior is now generic-first:

- row identity reads prefer generic mechanics
- DB subject metadata only enriches or fills gaps
- coverage and lane summaries should only attribute DB subject metadata when it was the actual fallback used to answer the lane

Future systems should follow the same pattern.

## Per-system DB bundle pattern

The app/runtime migration target is a per-system DB bundle with this neutral shape:

```js
{
  subjectMetadata,
  genericMechanics,
  boundaries,
  hasAny
}
```

Where:

- `subjectMetadata` is a transient compact per-subject grounded synthesis bridge
- `genericMechanics` is the reusable entity/fact/relation/gap surface
- `boundaries` is the inferred boundary projection derived from DB-backed subject state plus generic fragments
- `hasAny` means the DB owns some active runtime truth for that system

Coverage-source rule:

- when `genericMechanics` and/or `boundaries` already answer a lane, do not credit `subjectMetadata` in the active coverage source label
- only surface `db-subject-metadata` in coverage labels when it was actually required as the fallback truth surface
- the active transport contract is `systemDbBundleApi`; split capability bits like `tokenShopDbApi` and `genericMechanicsApi` are compatibility-era leftovers and should not be treated as active runtime requirements

Current implementation status:

- TokenShop: active
- Shards: generic fact/gap plus inferred boundary active for owner-family, cost, and owned-state coverage
- Multiverse Market: generic fact/gap plus DB subject metadata slice active for save-owner boundary

The current helper stack is intentionally generic enough to support those future migrations:

- `support/db-system-bundle.js`
- `support/system-unit-provider.js`
- `support/system-unit-projections.js`

On the DB producer side, the active multiverse migration now also relies on shared reconstruction specs instead of inline one-off curation:

- shared seam contract registry
- shared bounded-edge relation rules
- shared relation bundle specs
- shared multiverse candidate-term pools
- shared regex/group extraction specs for live fragment inputs

New systems should adopt the bundle pattern instead of inventing new ad hoc DB transport shapes.

That shared bundle layer now also owns:

- aggregate DB coverage summaries per system
- per-subject generic mechanics lookup
- per-subject DB subject-metadata lookup
- per-subject inferred boundary lookup
- coverage source / next-seam rollups for app/runtime consumers

The preferred transport for that bundle is now the neutral server route:

- `/api/system-db?systemId=...&scopes=...&mode=core`

Legacy compatibility routes such as `/api/token-shop-db` still exist, but new migrations should target the neutral per-system bundle path first.

## Runtime container pattern

At the app/runtime boundary, per-system bundles should sit inside a neutral `systemDb` container:

```js
{
  tokenShop: { subjectMetadata, genericMechanics, boundaries, hasAny },
  shards: { subjectMetadata, genericMechanics, boundaries, hasAny },
  multiverseMarket: { subjectMetadata, genericMechanics, boundaries, hasAny }
}
```

Current implementation status:

- `systemDb.tokenShop`: active
- `systemDb.shards`: generic mechanics and inferred boundaries active for owner-family, cost, and owned-state coverage, with DB subject metadata still enriching cost and owned-state
- `systemDb.multiverseMarket`: generic fact/gap and DB subject metadata save-owner slice active

## Consumer migration order

For any system, migrate in this order:

1. generic mechanics
2. DB subject metadata
3. static system-unit / boundary / export fallback only when DB truth is absent

Do not treat subject metadata as the first-class model when generic mechanics already exposes enough grounded truth to drive the consumer safely.

## Cross-system migration guidance

### TokenShop

TokenShop is the reference implementation.

It already has:

- combined DB transport
- generic-first row reads
- DB subject metadata enrichment
- neutral runtime bundle naming

### Shards

Shards have now started adopting the same bundle pattern through generic mechanics plus DB subject metadata for:

- cost boundary
- owned-state / save-population boundary

Those slices are no longer backend-only. The active shard app UI now reads them through the shared `systemDb.shards` runtime bundle and surfaces current `subjectId`, explicit generic fact/gap coverage, and next-seam state in the shard grounding and workflow views.

The current shard generic surface now includes small grounded fact bundles such as:

- `owner-type`
- `cost-accessor`
- `parameter-shell-field`
- `scene-owner`
- `runtime-shell`

Next DB-native slices should extend that same runtime bundle for:

- milestone owner family
- milestone row model
- richer shard facts/relations beyond the current generic gap-first boundary reads

Until then, the system-unit/static path remains valid.

### Multiverse Market

Multiverse Market is now on the same DB-first migration path as the other active systems.

The current DB-backed multiverse bundle includes:

- root save-owner subject state
- typed-owner boundary
- canonical-import boundary
- broad-row-remap boundary
- row-text boundary
- action-shell boundary
- owner-family boundary
- prefab-remap boundary
- metadata-neighborhood boundary

The active generic mechanics surface now carries:

- typed owner claim candidates and promoted claim hits
- candidate/support/bounded canonical-import relations
- candidate/support/bounded row-remap relations
- checked ordered-overlap rows
- checked grounded text-lane bundles
- compatibility-import target path and safe-subset labels

The active app/runtime now uses that DB-backed multiverse surface for:

- save-owner / member-host summaries
- compatibility-import messaging
- preview pills and next-seam notes
- row-text / action-shell / owner-family migration slices

The root multiverse save-owner subject is now fully wired:

- no root blocked edges remain
- `typed-market-field-recovery`, `canonical-import-admissibility`, and `broad-row-identity-remap` are all carried as cleared root coverage
- bounded child progress still remains visible through `nonblockingEdges` for explanatory/runtime reporting

Explicit seam reruns now degrade automatically when the requested seam is already cleared:

- dry-run planning resolves to `traceDirective=reuse-materialized`
- live no-force reruns reuse DB/materialized state instead of re-entering native trace
- boundary-shaped no-op reruns keep diagnostics current without re-promoting old exact evidence rows

So future work should keep extending the DB-native producer truth around that seam rather than widening back into static export ownership.

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
- prefer consumer migration only after generic mechanics or DB subject metadata clear honestly
- prefer deleting superseded Python target/support/reconstruction logic over adding new compatibility layers

Do not:

- add new target-shaped Python branches for any system
- ask a human to guess a trace target for exact missing terms
- invent a new DB transport shape when the per-system bundle pattern is sufficient

## Current migration status

### Runtime path

- TokenShop: DB bundle active, generic-first
- Shards: DB bundle active for owner-family, FinalSU, milestone payload, milestone row-model, milestone title/effect, milestone effect-text handler, milestone row-shell, milestone row-alignment, cost, and owned-state boundaries, with generic coverage plus DB subject metadata enrichment where available
- Multiverse Market: DB bundle active for save-owner, metadata-neighborhood, row-text, action-shell, owner-family, and bounded prefab-remap slices, with generic multiverse facts plus DB subject metadata enrichment on the save-owner lane

### Inferred boundary model

- `materialized_boundary_views` is now the generic DB boundary projection surface.
- Boundary rows are inferred from DB-backed subject edge state plus generic fact/gap fragments, not from old boundary snapshot files.
- The active bundle may expose `boundaries` alongside `subjectMetadata` and `genericMechanics`.
- Treat `subjectMetadata` as transitional enrichment, not the long-term primary truth surface. New consumer work should prefer `genericMechanics` and `boundaries` first, using `subjectMetadata` only when the stronger surfaces do not yet clear honestly.
- Current shard and multiverse boundary rows are already materialized for:
  - `shard-owner-family-boundary`
  - `shard-finalsu-bonus-boundary`
  - `shard-milestone-payload-boundary`
  - `shard-milestone-row-model-boundary`
  - `shard-milestone-title-effect-boundary`
  - `shard-effect-text-handler-boundary`
  - `shard-milestone-row-shell-boundary`
  - `shard-milestone-row-alignment-boundary`
  - `shard-cost-su0-structure`
  - `shard-owned-state-upgradeinfolist-population`
  - `multiverse-market-save-owner-boundary`
  - `multiverse-market-metadata-neighborhood`
  - `multiverse-market-typed-owner-boundary`
  - `multiverse-market-row-text-boundary`
  - `multiverse-market-action-shell-boundary`
  - `multiverse-market-owner-family-boundary`
  - `multiverse-market-prefab-remap-boundary`
  - `multiverse-market-canonical-import-boundary`
  - `multiverse-market-broad-row-remap-boundary`
- Current limitation:
  - shard owner-family is now DB-backed from live shard semantic, family-graph, and execution-plan fragments, with the owned-state boundary only carrying the current blocker seam.
  - when that DB owner-family coverage is present, the shard system view keeps the older embedded owner-family boundary only as a compatibility fallback, not as an active boundary surface.
  - shard milestone payload and shard milestone row-model are now DB-backed from live owner-family, owned-state, and cost generic facts; their static exports are compatibility-only once those derived DB scopes are present.
  - shard FinalSU, title/effect, and effect-text handler are now DB-backed from live shard native-trace and cost-surface fragments, with missing presentation and exact-handler seams kept explicit in the inferred boundary rows instead of delegated to archived exports.
  - shard milestone row-shell and shard milestone row-alignment now follow the same derived DB path, using live owner-family, owned-state, and cost generic facts rather than archived export ownership.
  - shard owned-state save-boundary and shard cost-model exports now follow the same rule: once DB coverage is present, those static boundary payloads remain available only under compatibility fallbacks instead of staying on the active runtime path.
  - the same DB-first / compatibility-only rule now applies to the Multiverse Market save-owner, metadata-neighborhood, typed-owner, row-text, action-shell, owner-family, bounded prefab-remap, canonical-import, and broader-row-remap slices: when DB generic mechanics and inferred boundaries are present, the embedded row/UI shell exports stay compatibility-only instead of remaining active runtime surfaces.
  - the new multiverse metadata-neighborhood, typed-owner, row-text, action-shell, owner-family, prefab-remap, canonical-import, and broader-row-remap scopes are derived from live save-owner trace fragments and preserve only the recovered persistence anchors, typed host/conversion/field samples, progression-field cluster, cloud-save path anchors, buy-hook, cost-text, owner-anchor, wrapper/resource, prefab-sample, serialized-id, exact bounded override-pair facts, canonical import target path, safe-subset label, and broader remap status that are actually present in the live cache.
  - the metadata-neighborhood scope now clears `cloud-save-path-recovery` directly from DB-backed evidence because the live fragment lane recovers `CloudSavePlayerProfile` and `GetPlayerProfileInfo` in the same multiverse trace family.
  - canonical import admissibility and broader row remap are now first-class DB-backed boundary scopes instead of being only implicit missing edges on the base save-owner boundary; the root save-owner subject now carries both as cleared coverage while preserving bounded child progress for explanation/debug.
- broader multiverse row-identity now clears at the root save-owner subject through the DB-backed boundary model and contract-driven seam promotion path. The typed multiverse owner lane still preserves grounded typed hosts, conversion anchors, typed field samples, structured claim candidates, and candidate owner-field relations on its DB-backed child boundary surface; the root save-owner subject carries `typed-market-field-recovery` as cleared coverage, while the child typed-owner boundary remains a bounded negative for explanation/debug because the live fragments still do not promote one exact typed `Market` or `MultiverseMarket` field host honestly enough to collapse that child boundary itself.
  - exact prefab-override mapping outside the bounded 71-74 / 59-62 overlap is still compatibility-owned for the child prefab/typed-owner explanation lane, not for the root save-owner runtime gate.
  - that is now a bounded child-scope producer-depth gap, not a root runtime blocker and not a reason to go back to file-owned boundary truth.

### Compatibility still present

- `materialized_subject_contract_views`
- row-level `contract*` aliases
- a few compatibility wrapper modules still bridge older subject-contract naming into neutral metadata names

These exist for compatibility only and should shrink over time as more systems adopt the neutral DB bundle pattern.

`subjectMetadata` is part of that shrink plan. The intended end state is:
- `genericMechanics` for normalized evidence facts, relations, and gaps
- `boundaries` for inferred lane verdicts and next seams
- no active runtime dependence on `subjectMetadata` where the first two surfaces already clear the same question

The multiverse compatibility preview now reads its wrapper-only boundary field and grounded/quarantined text-lane model from generic save-owner facts when available, and the spend-side runtime now reads metadata-neighborhood, row-text, action-shell, owner-family, and bounded prefab-remap summaries from dedicated DB-backed multiverse scopes before falling back to archived exports.

## Immediate next tasks

1. Continue shrinking compatibility aliases on the active runtime path where no live consumer still needs them.
2. Deepen multiverse producer coverage into exact typed market-field ownership and broader row-identity lanes when checked live fragments clear those slices.
3. Keep generated system units and archived export artifacts as fallback-only surfaces unless the DB bundle for that system is still missing.
