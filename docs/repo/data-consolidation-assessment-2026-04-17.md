# Data Consolidation Assessment

Date: 2026-04-17

## Current shape

The `data/` directory is still dominated by historical extraction and probe artifacts.

Rough counts from the current tree:

- `probe`: 34
- `boundary`: 26
- `grounded_or_canonical`: 4
- `structured_support`: 15
- `other`: 32

This means the repo is not yet close to a fully consolidated canonical-data layout. It is closer to a mixed state:

- a small canonical/grounded core
- a medium layer of reusable blocker or model datasets
- a large historical probe archive still living beside live data

## What is already close to the desired model

These categories are already meaningful and should stay:

- canonical or grounded datasets
  - example: `tokenshop-canonical-v1.json`
  - example: `shard-milestones.grounded.v1.json`
- bounded blocker datasets
  - example: `token-shop-row-remap-boundary.json`
  - example: `shard-save-boundary.v1.json`
  - example: `multiverse-market-savedata-import-boundary.json`
- reusable structural models
  - example: `shard-cost-formula-model.v1.json`
  - example: `tokenshop-cost-model.json`
- registry and contract files
  - example: `unity-trace-target-registry.json`
  - example: `bundled-dataset-contract.v1.json`

## What is still the main consolidation problem

The largest remaining weight is probe output that is no longer part of the live trace product path.

Examples:

- `daily-tokenium-lane-probe.json`
- `daily-tokenium-owner-probe.json`
- `lm244-targeted-probe.json`
- `unity-probe-report.json`
- `uabea-probe-report.json`
- `shard-owner-family-probe.v1.json`
- `multiverse-market-row78-83-assignment-site-probe.json`

These are useful as research history, but they are not good canonical state.

## Recommended end-state categories

The directory should move toward four explicit classes:

1. Canonical datasets
   - planner-safe or app-consumed truth
   - grounded and versioned

2. Boundary datasets
   - blocker-preserving checked negatives
   - bounded compatibility-only or quarantine conclusions

3. Structural support datasets
   - formula models
   - alias maps
   - stable extracted indices

4. Historical probes
   - not part of live product flow
   - either archived outside the main `data/` root or clearly segregated

## Practical assessment

The repo is far enough along to start a real `data/` rework, but not far enough to do it in one pass without churn.

A safe next sequence is:

1. Tag live-used datasets from the app and trace bundle
2. Tag boundary datasets still required for blocker framing
3. Tag true canonical datasets consumed by UI or planning
4. Move all remaining probe-only artifacts into a separate archive lane
5. Replace any remaining app or trace reads that still point at archive-only probe files

## Immediate next candidates

High-confidence archive candidates are the older probe families already removed from live trace use:

- old TokenShop lane probes
- old Unity or UABEA one-off probe reports
- old shard ownership probes replaced by metadata or level0-backed traces

Before moving them, verify:

- `app.js` does not read them
- `bundled-dataset-contract.v1.json` does not require them
- `tests/smoke.mjs` does not still assert them as live shipped datasets

## Recommendation

Do not try to collapse all `data/` files directly into one database-shaped file.

The better move is:

- keep canonical, boundary, and model datasets explicit
- remove live dependency on historical probes
- physically segregate probe history once no app, contract, or live trace path still reads it

That gets the repo much closer to a database-like structure without flattening away provenance.

## Current manifest

The repo now records the intended replacement structure in:

- `data/data-framework.v1.json`

Supporting documentation:

- `docs/contracts/data-framework.md`

That manifest does not delete or replace existing files yet. It classifies the current datasets
into centralized system units so later cleanup can move one game system at a time instead of
deleting probe-era files opportunistically.

The current intended unit set is:

- `player-state`
- `shards`
- `token-shop`
- `multiverse-market`
- `trace`
