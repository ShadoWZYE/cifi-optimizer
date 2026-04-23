# DB-First Tooling Audit (2026-04-21)

## Purpose

Classify the current extraction/tooling surface after the DB-first trace pipeline landed.

This audit focuses on whether a tool is:

- ACTIVE PIPELINE
- EXPORT BRIDGE
- LEGACY COMPAT
- HISTORICAL / DEFERRED
- STALE / REMOVABLE

## Active Pipeline

These are the real current owners of extraction and reconstruction work.

### `scripts/unity/ghidra_headless.py`

Status:

- ACTIVE PIPELINE

Why:

- owns the persistent-project native pipeline
- writes into SQLite-backed evidence/materializer state
- now also owns lifecycle audit/purge commands

### `scripts/unity/ghidra_cache_db.py`

Status:

- ACTIVE PIPELINE

Why:

- canonical reducer/materializer owner
- duplicate supersession/lifecycle owner
- canonical resolution-subject owner

### `scripts/unity/unity_trace_bundle.py`

Status:

- ACTIVE PIPELINE

Why:

- orchestration layer for cross-source trace collection
- still an important compatibility execution bridge
- no longer the canonical owner for verdict/narrative/bridge state

## Export Bridge

### `scripts/contracts/generate-system-units.mjs`

Status:

- EXPORT BRIDGE

Why:

- still needed because the app and static fallback consume exported system units
- but it remains a hybrid repacker of DB-backed trace slices plus old committed datasets

Current problem:

- too many sections are still copied from old datasets instead of derived from DB canonical fragments

Update after the token-shop export migration:

- token-shop sections such as cost lanes, action-lane clues, token-bank controller/owner shell,
  tokenium naming clues, token-bank state clues, and daily-tokenium lane clues are now derived
  from DB/raw evidence in `data/system-units/token-shop.v1.json`
- those older token-shop JSON support files are now historical-only packaging artifacts, not live
  export inputs

### `support/system-unit-provider.js`

Status:

- EXPORT BRIDGE

Why:

- runtime adapter between DB API and static `data/system-units/*.json`

## Legacy Compatibility

### Removed in this pass

- `scripts/unity/run_probe.mjs`
- `probe:*` npm aliases in `package.json`

Reason:

- they were pure compatibility surface over `run_extract.mjs`
- they no longer owned any DB-first behavior

### `extract:*` npm aliases in `package.json`

Status:

- ACTIVE OPERATOR ENTRYPOINT

Why:

- these are the maintained human-facing wrappers over the active extraction pipeline

## Transitional/Questionable Tools

### `scripts/contracts/generate-trace-support-datasets.mjs`

Status:

- REMOVED

Why:

- it only regenerated `data/archive/token-shop-trace-support.v1.json` before archival
- that snapshot no longer feeds any live export/runtime path
- the remaining file is now archived under `data/archive/`

### `scripts/contracts/generate-dataset-index.mjs`

Status:

- LEGACY COMPAT / OPS

Why:

- inventories old dataset contracts
- still useful for documentation while dataset-era files remain
- not a DB-first architecture tool

### `scripts/unity/score_extraction_candidates.py`

Status:

- REMOVED

Why:

- the committed ranking snapshot and its scorer have been retired from the supported DB-first tool surface
- best-gap selection and DB-owned missing-seam state now cover the active follow-up path

Recommended successor:

- if ranking returns, rebuild it as a DB-native evidence-gap query instead of a committed snapshot

## Historical / Deferred Extractors

These are not the current primary pipeline, even if some still generate committed files.

### Token shop / multiverse parsers

- `scripts/unity/token_shop_parse.py`
- `scripts/unity/multiverse_market_parse.py`

Status:

- REMOVED

Why:

- their record extraction logic now lives directly in `scripts/contracts/generate-system-units.mjs`
- the committed JSON snapshots were demoted to archived snapshots rather than live owners

### Shard probe scripts

Status:

- REMOVED

Why:

- the probe-era shard script cluster is no longer reachable from supported commands
- active shard reconstruction now runs through DB-backed trace/materializer state instead

### `shard_bonus_slot_probe.py`

Status:

- REMOVED

Why:

- shard bonus-slot support is now derived through DB/materialized shard unit state
- the old support extractor no longer sits on any supported command or export path

## Tooling Problems Still Causing Architecture Drift

1. Export-first intermediate scripts still produce committed JSONs that are treated as active architecture.
2. Validation and smoke still enforce many old dataset artifacts and older dataset-era assumptions.
3. Some docs still present probe/extract scripts as first-class workflow instead of compatibility-only workflow.

## Smallest Next Tooling Cleanup Seam

Best next narrow cut:

- keep active:
  - `ghidra_headless.py`
  - `ghidra_cache_db.py`
  - `unity_trace_bundle.py`
  - `generate-system-units.mjs`
- downgrade explicitly:
  - retired extraction-candidate ranking/scoring
- remove only after consumer migration:
  - parser/probe scripts whose outputs are no longer read by app/export/validation

## Bottom Line

The repo no longer needs a broad zoo of extraction tools as equal citizens.

The real pipeline is:

1. native/metadata/asset collection
2. DB evidence + trace fragments
3. reducer/materializer canonical state
4. optional export/system-unit projection

Any tool that exists only to maintain a committed intermediate JSON for old app/export/test surfaces should now be treated as transitional at best.
