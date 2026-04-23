# Trace Materializer / Reducer Audit

Date: 2026-04-21

## Scope

Audit of the current DB-backed trace lane after:

- DB-first free-text resolution
- reducer-owned assessment fragments
- reducer-owned narrative fragments
- reducer-owned bridge/comparison fragments for bounded shard/multiverse slices
- token-shop reconstruction moved off bundle-era template shape and onto canonical fragments

This is an ownership audit, not a redesign.

## Classification

- `canonical-owner`: current DB-owned source of truth for live semantics
- `fallback-only`: presentation or compatibility layer that should not steer canonical reconstruction
- `legacy-compat`: still exported or retained to avoid breaking old shapes, but should not own live semantics
- `stale/removable`: should be removed once the adjacent canonical owner is in place

## Current Classes

### `assessment_fragment`

- Class: `canonical-owner`
- Scope:
  - target verdict state
  - summary verdict payload
  - blocked/supporting edge types
- Notes:
  - target bundles now read `decisionSummary` from `target-assessment:<trace-scope>`
  - bundle-local verdict preview is no longer the live owner

### `execution_context_fragment`

- Class: `canonical-owner`
- Scope:
  - target label / family metadata for active trace runs
  - accepted anchors
  - solved/block target ids
  - join goal
  - summary-rule policy payload
- Notes:
  - live trace datasets and materialized bundles can now read execution/render context from canonical fragment
  - compatibility target envelopes remain present, but no longer need to be the only owner of active target metadata
  - when no canonical fragment exists yet, DB bootstrap now synthesizes `joinGoal` and `outputSummaryRules` for active scopes from subject/family context rather than taking those fields directly from the registry target payload
  - operator-facing dry-run/completed-run identity is now subject + execution scope first; legacy target ids are compatibility-only output
  - normal request planning now uses a DB/bootstrap catalog only; the trace registry file is no longer part of the active trace request path
  - active builder code no longer reads registry `strategyConfig` directly; active DB bootstrap now uses canonical/bootstrap fragments only and no longer falls back to the registry file inside SQLite

### `target_narrative_fragment`

- Class: `canonical-owner`
- Scope:
  - `groundedConclusion`
  - `currentBoundary`
- Notes:
  - target bundles now read narrative from canonical fragment
  - live trace datasets now also surface `currentBoundary` from canonical fragment first for active lanes
  - active family builders no longer author live `groundedConclusion` / `currentBoundary` prose; bundle carries seed/reference only, with explicit missing-canonical narrative state instead of silently trusting builder prose

### `bridge_comparison_fragment`

- Class: `canonical-owner` for bounded migrated slices
- Scope:
  - shard owned-state
  - multiverse save-owner boundary
- Notes:
  - for these slices, `bridgeCheck` and `solvedVsBlockedDiff` are DB-owned
  - token-shop compare builders were intentionally not promoted and remain presentation/fallback only

### `token_shop_reconstruction_fragment`

- Class: `canonical-owner`
- Scope:
  - token-shop row/family reconstruction surface
  - row shell
  - presentation slot graph summary
  - formula/runtime summary
  - canonical status for token-shop target bundles
- Notes:
  - now reconstructed from:
    - canonical row semantic scope
    - canonical UI-binding fragments
    - canonical owner-controller fragments
    - canonical formula/runtime fragments
    - canonical assessment fragment
  - no longer depends on `system_scope_fragment` / top-level `closureStatus` as owner
- explicit family selection now resolves to a DB-owned family subject; if none exists the trace degrades to flat exploration instead of falling back to a registry `defaultTargetId`
- projected/materialized trace bundles now expose subject identity plus `executionTraceScope`; `selectedTargetId` and compatibility-target carriage are no longer part of the normal outward traceRegistry identity in the DB-backed projection layer
- `system_scope_fragment` is no longer part of the active canonical/system fragment set during trace rebuilds, and target-bundle projection no longer reloads `closureStatus` through that legacy fragment path

### `family_graph_fragment`

- Class: `canonical-owner` for bounded migrated family identity
- Scope:
  - token-shop family/system subject identity
  - shard-cost family subject identity
  - shard-owned-state family subject identity
  - multiverse-market/save-owner family subject identity
  - family label and bounded family shell/core-term surface
- Notes:
  - `Token Shop`, `Shard cost`, `Shard owned state`, and `Multiverse` now resolve to DB-owned `family-graph:*` subjects
  - old target ids remain compatibility execution metadata only
  - token-shop has the richest family graph because it already owns row/family reconstruction
  - shard and multiverse family graphs are intentionally lighter and derive from assessment/narrative/dependency/support fragments rather than fake row graphs
  - execution-time source selection now also prefers DB-owned source projection from the latest materialized target bundle for the resolved trace scope; registry source-family lists are fallback-only when no DB source projection exists yet
  - active shard and multiverse builders now also reuse DB-owned surface and graph plans before rebuilding local shell/surface/graph assembly
  - subject-derived execution routines now dispatch active lanes directly; the old target-strategy catalog is no longer the routing bridge from DB subjects to builders

### `semantic_scope_fragment`

- Class: mixed
- Shard owned-state scope:
  - `canonical-owner`
- Token-shop row scopes:
  - `canonical-owner` for row-local graph and missing-seam state
  - `legacy-compat` for embedded `closureStatus` / literal recovery payload carriage
- Notes:
  - active row-status/runtime consumers now read graph-native seam state first (`rowLocalGraph`, `missingSeams`, reducer-owned status projections)
  - token-shop row scopes still carry a derived compatibility status view, but no longer duplicate bulky literal recovery blobs in persisted DB/export shapes
  - the normal live dataset path no longer duplicates token-shop `closureStatus` as a top-level field, and current DB-backed target-bundle projections no longer re-expose a top-level `closureStatus` compatibility field
  - canonical trace-fragment rebuild now normalizes legacy `rowRecovery` payloads as well, so old valid trace rows do not keep pushing `closureStatus` / bulky literal recovery blobs back into current canonical materializations
  - rebuild-time maintenance now also normalizes live raw `trace_fragments.rowRecovery` payloads in place, so the active raw fragment layer converges on the same compact shape (`literalRecoverySummary`, no top-level `closureStatus`, no bulky literal recovery blobs)
  - dead raw `closureStatus` fragments are now invalidated during rebuild, and live raw `traceRegistry` fragments are rewritten in place to drop `selectedTargetId` / compare-era compatibility carriage
  - persisted `rowRecovery` now keeps `literalRecoverySummary` instead of the full `literalSchemaRecovery` / `literalTextRecovery` candidate blobs
  - exported system-unit trace views now scrub those token-shop compatibility blobs from nested dependency/scope projections, so the file-layer read models no longer revive them as active structure

### `ui_binding_fragment`

- Class: `canonical-owner`
- Scope:
  - role-local slot values
  - presentation update path
  - shell window hints
- Notes:
  - now participates directly in token-shop reconstruction
  - still includes some role-local duplication across `title` / `cost` / `description` fragments

### `owner_controller_fragment`

- Class: `canonical-owner`
- Scope:
  - owner blob rows
  - runtime evaluator/instance recoveries
  - owner/controller shell adjacency
- Notes:
  - now participates directly in token-shop reconstruction
  - still keyed by owner identity, which is acceptable, but target-local filtering remains important

### `formula_fragment`

- Class: `canonical-owner`
- Scope:
  - grounded constants
  - runtime cost model
- Notes:
  - cleanest reducer class right now

### `runtime_table_fragment`

- Class: `canonical-owner`, but brittle
- Scope:
  - native reconstruction summary
- Notes:
  - improved by family-aware native pruning
  - still the most likely place for over-broad owner promotion if request planning regresses

### `system_scope_fragment`

- Class: `legacy-compat`
- Scope:
  - old bundle-era closure/status carrier
- Notes:
  - token-shop target bundles no longer export it in `systemViews`
  - top-level token-shop bundle status no longer depends on it
  - still present in other lanes and internal system views
  - strong candidate for removal after each remaining lane gains a canonical status owner

### `reconstruction_note_fragment`

- Class: `legacy-compat`
- Scope:
  - seed/reference holder
  - semantic-key references
- Notes:
  - no longer owns verdict or narrative
  - still carries bridge-related compatibility payload in some lanes

### `progression_fragment`

- Class: mixed
- Scope:
  - bounded runtime/progression summary
- Notes:
  - partly canonical
  - still close to legacy runtime-summary carryover in token-shop lanes

### `systemViews` export envelope

- Class: mixed
- Token-shop:
  - `legacy-compat` and now narrowed
  - `system_scope_fragment` removed
- Shard / multiverse:
  - still exports `system_scope_fragment`
- Notes:
- target-bundle envelope is no longer the canonical owner for status in token-shop
- other lanes still need the same cut

### `materialized_target_bundle_views`

- Class: `fallback-only`
- Scope:
  - export/system-view projection
  - bundle snapshots for app/export consumers
- Notes:
- free-text DB resolution no longer depends on materialized target bundles
- resolver now ranks canonical semantic fragments/scopes first
- canonical subject-candidate assembly now lives in `ghidra_cache_db.py`; `unity_trace_bundle.py` scores DB-owned candidates instead of rebuilding the fragment catalog itself
- bundles should be treated as projections, not the primary reconstruction catalog
- explicit `--target` now selects a DB trace scope directly; free-text resolution remains DB-first and no longer has a separate probe-era target mode

## Lane Audit

### Token-shop

- Improved:
  - `tokenShopReconstruction` is now fragment-driven
  - top-level token-shop bundle status is canonical
  - top-level token-shop `closureStatus` removed
  - `system_scope_fragment` removed from token-shop `systemViews`
- Remaining:
  - token-shop row scopes still embed `closureStatus`-shaped payloads
  - token-shop builder-local comparison/presentation prose remains fallback-only

### Shards

- Improved:
  - verdict and outcome are DB-owned
  - active scope contamination is clean apart from registry/target catalog
- Remaining:
  - shard bundle envelope still exports `system_scope_fragment`
  - shard row/bridge supporting shapes are still partly bundle-seeded before reducer normalization

### Multiverse

- Improved:
  - active boundary JSON cluster removed from live scope
  - bridge/comparison semantics migrated for save-owner slice
- Remaining:
  - bundle envelope still exports `system_scope_fragment`
  - save-owner lane still uses compatibility/policy labels seeded through target config

## Highest-Value Next Seams

1. `semantic_scope_fragment` normalization for token-shop rows

- Status:
  - partially completed
- Current owner model:
  - token-shop row semantic scopes now carry:
    - `rowLocalGraph`
    - `missingSeams`
    - `compatibilityStatus`
  - top-level `closureStatus` on row scopes is now a derived compatibility view, not the canonical owner
- Remaining issue:
  - row scopes still preserve `literalSchemaRecovery` and `literalTextRecovery` blobs directly
  - some bundle consumers still read `closureStatus` for convenience rather than reading `missingSeams` / graph state directly

2. `system_scope_fragment` removal for shard and multiverse target bundles

- Why:
  - token-shop no longer needs it at bundle surface
  - shard and multiverse still export it even though verdict/narrative are canonical

3. `runtime_table_fragment` request-hygiene audit across non-token lanes

- Why:
  - token-shop showed how bad family drift can poison materializers
  - the same risk likely exists anywhere native summaries are merged too early

## Smallest Safe Next Step

The next narrow cleanup seam is:

- completed: `system_scope_fragment` is no longer exported in token-shop, shard, or multiverse target-bundle `systemViews`
- completed: new trace runs no longer persist fresh `system_scope_fragment` rows; only legacy rows remain for rebuild compatibility
- remaining: scrub legacy `system_scope_fragment` rows from canonical/system rebuild inputs once no compatibility consumer still expects them
- only if their exported top-level status/verdict/narrative surfaces are already canonical-owned and validated

That is narrower than a row-scope redesign and broader than token-shop-only, so it is the best next cross-lane migration seam.
