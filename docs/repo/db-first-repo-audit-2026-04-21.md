# DB-First Repo Audit (2026-04-21)

Related target-state plan:

- [DB Runtime Endgame Migration](db-runtime-endgame-migration.md)

## Scope

This audit covers the post-DB-framework repo state with a narrow question:

- what still reads committed datasets directly instead of DB-backed canonical state or system-unit materialization
- what still republishes probe-era or boundary-era shapes into the app/runtime
- what has to move before old datasets can be deleted safely

This is an audit, not a redesign.

## Executive Summary

The app is only partially migrated to the DB-first architecture.

The good state:

- core system/runtime surfaces already go through `loadSystemUnits(...)`
- trace resolution is DB-first
- canonical trace semantics, verdicts, narratives, bridge/comparison fragments, and family subjects now live in SQLite-backed reducers/materializers

The incomplete state:

- `app.js` still bootstraps several committed JSON datasets directly
- `generate-system-units.mjs` still rebuilds major system units by reading old committed boundary/support/probe datasets directly
- `validate-datasets.mjs` and `tests/smoke.mjs` still enforce large parts of that legacy dataset surface as active architecture
- some support scripts still generate intermediate JSONs that only exist to feed the old export layer

So the repo is not yet in a state where "delete every old dataset" is safe.

The real blocker is not missing DB evidence. The blocker is that export, validation, and some app research surfaces still treat old datasets as current source-of-truth inputs.

## Current Runtime Ownership

### Clean-enough

- `support/system-unit-provider.js`
  - prefers `/api/system-units` when available
  - otherwise falls back to static `data/system-units/*.v1.json`
- `app.js`
  - core system state is already consumed through:
    - `state.systemUnits.playerState`
    - `state.systemUnits.shards`
    - `state.systemUnits.tokenShop`
    - `state.systemUnits.multiverseMarket`
- `support/system-unit-projections.js`
  - app-facing projections are already built from system units, not from direct per-dataset reads

### Still bypassing DB/system units

`app.js` still fetches these directly at bootstrap:

- `data/game-data.snapshot.v1.json`
- `data/bundled-dataset-contract.v1.json`
- `data/ship-optimizer.desmos-baseline.v1.json`

These are not all the same kind of problem:

- `game-data.snapshot.v1.json`
  - mostly research/progress/dashboard content, not core app system state
- `bundled-dataset-contract.v1.json`
  - contract/inventory metadata, not user runtime truth
- `ship-optimizer.desmos-baseline.v1.json`
  - ship lane planner seed/model input
Conclusion:

- the app runtime is already DB/system-unit-backed for player-state, shards, token-shop, and multiverse
- the app research/ops surfaces are not
- deleting those direct datasets now would break bootstrap and smoke expectations

## Export Layer Audit

### Main issue

`scripts/contracts/generate-system-units.mjs` is still a legacy repacker.

It does pull DB-backed materialized target bundles for trace-backed sections, but it also reads many committed datasets directly and embeds them into system units as live sections.

Examples:

- token-shop unit still reads:
  - `data/archive/token-shop-values.json`
  - `data/token-shop-save-boundary.v2.json`
  - `data/token-shop-row-level-owner.json`
  - `data/token-shop-row-remap-boundary.json`
  - `data/token-shop-late-atu-boundary.json`
  - `data/token-bank-formula-boundary.json`

Update after the token-shop DB-first export migration:

- these historical support files are no longer live token-shop export inputs:
  - `data/tokenshop-canonical-v1.json` as verified canonical truth
  - `data/tokenium-naming-clues.json`
  - `data/token-bank-state-clues.json`
  - `data/daily-tokenium-lane-clues.json`
  - `data/archive/token-shop-trace-support.v1.json`
  - `data/spend-action-lane-clues.json`
  - `data/token-shop-owner-shell.json`
  - `data/token-bank-controller-shell.json`
- verified token-shop records now live in DB/raw-derived sections inside `data/system-units/token-shop.v1.json`
- `data/tokenshop-canonical-v1.json` survives only as the explicit heuristic source for `db:policy:token-shop-tier-unlocks`

- shards unit still reads:
  - `data/shard-owner-family-boundary.v1.json`
  - `data/shard-finalsu-bonus-boundary.v1.json`
  - `data/shard-milestone-payload-boundary.v1.json`
  - `data/shard-milestone-row-model-boundary.v1.json`
  - `data/shard-milestone-title-effect-boundary.v1.json`
  - `data/shard-effect-text-handler-boundary.v1.json`
  - `data/shard-milestone-row-shell-boundary.v1.json`
  - `data/shard-milestone-row-alignment-boundary.v1.json`
  - `data/shard-milestone-handoff-boundary.v2.json`
  - `data/shard-save-boundary.v2.json`
  - `data/shard-milestone-save-owner-candidates.v2.json`
  - `data/shard-bonus-slot-probe.v1.json`

- multiverse unit still reads:
  - `data/multiverse-market-save-boundary.v2.json`
  - `data/multiverse-market-market-member-boundary.json`
  - `data/multiverse-market-range-boundary.json`
  - `data/multiverse-market-prefab-remap-boundary.json`
  - `data/multiverse-market-savedata-import-boundary.json`
  - `data/multiverse-market-row69-74-identity-source-boundary.json`
  - `data/multiverse-market-serialized-label-source-boundary.json`
  - `data/multiverse-market-row71-74-identity-boundary.json`
  - `data/multiverse-market-inscription-numbering-stability-boundary.json`
  - `data/multiverse-market-shell-row-prediction-boundary.json`
  - `data/multiverse-market-text-provenance-path-boundary.json`

### What this means

The system-unit files are not yet "DB-owned export views".

They are still hybrid bundles:

- DB-backed trace slices
- plus copied committed dataset slices
- plus provenance pointers to probe-era artifacts

That is the main reason old datasets cannot be removed yet.

## Validation/Test Surface Audit

The validation and smoke layer still treats many committed datasets as required active architecture.

### `scripts/contracts/validate-datasets.mjs`

This file still:

- reads the direct boundary/support/probe datasets itself
- validates their structure directly
- checks that system units still embed or reference them

This is the strongest current deletion blocker.

### `tests/smoke.mjs`

Smoke still enforces:

- bootstrap fetch order in `app.js`
- presence of direct dataset files
- references to old datasets in docs
- presence of legacy extract/probe aliases

So even if runtime behavior is safe, repo expectations are still pinned to old dataset-era architecture.

## Registry Status

The registry is no longer the primary resolver for active trace routing, but it still survives as:

- compatibility target metadata
- strategy shell/input hints for builder execution
- compare-era/preset-era metadata in some legacy areas

This is no longer the main blocker for app migration.

The bigger remaining blocker is the export/validation layer still assuming dataset-era ownership.

## Tooling Audit Summary

See also:

- `docs/tools/db-first-tooling-audit-2026-04-21.md`

High-level state:

- active pipeline owner:
  - `scripts/unity/ghidra_headless.py`
  - `scripts/unity/ghidra_cache_db.py`
  - `scripts/unity/unity_trace_bundle.py`
- active export bridge:
  - `scripts/contracts/generate-system-units.mjs`
- legacy compatibility:
  - registry `defaultTargetId` / comparison metadata
- likely obsolete or transitional:
  - trace-support dataset generators
  - direct dataset index generation as an architectural inventory
  - several old extractors that only exist to maintain committed intermediate JSONs

## Dependency Classification

### Canonical-owner now

- SQLite-backed evidence
- SQLite-backed trace fragments
- reducer-owned canonical semantic fragments
- reducer-owned materialized target bundle views
- reducer-owned materialized system-unit views

### Active compatibility bridge

- static `data/system-units/*.v1.json`
- `support/system-unit-provider.js` static-export fallback
- `generate-system-units.mjs`

### Legacy-compat only

- registry `defaultTargetId` / comparison metadata
- many docs describing old boundary/probe dataset flows

### Stale/removable after migration

- direct app bootstrap read of `bundled-dataset-contract.v1.json`
- system-unit sections whose content is just copied old dataset payload instead of DB-derived fragment projection
- validators/smoke expectations that force old dataset presence after the export surfaces have been migrated

## Smallest Next Cleanup Seam

The best next seam is not deleting files. It is cutting one export/app path completely off direct dataset ownership.

Recommended next slice:

1. Introduce a DB-owned or system-unit-owned app meta surface for:
   - snapshot/research dashboard metadata
   - dataset contract/inventory metadata
2. Stop `app.js` bootstrap from directly fetching:
   - `game-data.snapshot.v1.json`
   - `bundled-dataset-contract.v1.json`
3. Keep `ship-optimizer.desmos-baseline.v1.json` separate until the ship lane has its own DB-first decision.

Why this seam first:

- it is visible in the app immediately
- it removes direct runtime dependence on old datasets
- it does not require deleting the exporter or all legacy validation in one shot

## Removal Sequence

Safe deletion cannot happen until this sequence is complete:

1. App runtime
   - no direct committed dataset fetches except temporary compatibility exports

2. System-unit export
   - stop reading old datasets as live inputs
   - derive sections from DB canonical fragments/materializations instead

3. Validation and smoke
   - stop asserting old dataset files as active architecture
   - validate DB/system-unit outputs instead

4. Toolchain
   - downgrade or remove scripts that exist only to maintain deleted intermediate JSONs

5. Dataset purge
   - remove old committed datasets only after all live consumers are gone

## Bottom Line

The DB framework is strong enough now that the repo can move off dataset-era runtime ownership.

But the current repo still has three active dependency shells:

- app bootstrap metadata datasets
- hybrid system-unit generation from old files
- validators/tests that enforce the old files as current truth

Until those three are cleaned, deleting old datasets would be cosmetic and dangerous.

