# DB Runtime Endgame Migration

## Goal

Move the repo to one runtime owner:

- SQLite-backed DB state owns truth
- reducer/materializer views own structure
- app reads DB-backed views through a thin provider/API layer
- generated JSON files become fallback/export snapshots only

This document is the working migration target until the repo can resume normal feature work on top of the DB-first architecture.

## End State

### Runtime ownership

1. Raw DB inputs
- evidence
- trace fragments
- extracted record fragments

2. Canonical DB ownership
- semantic fragments
- family graph fragments
- row/local graph fragments
- assessment/narrative fragments
- reducer-owned record tables

3. Materialized DB projections
- app-facing system views
- lane-specific research/debug views
- trace/launcher subject views

4. Optional exports
- `data/system-units/*.json`
- dataset snapshots for review/diffing
- historical committed JSON artifacts

### App contract

The app should read:

- DB-backed provider/API first
- static exported snapshots only as explicit offline/static fallback

The app should not treat committed data files as live runtime truth.

### Trace contract

The trace pipeline should resolve:

- DB-native subjects
- DB-native missing seams
- DB-native family/row/graph identity

The registry and old target ids should remain compatibility metadata only until removed.

## Architectural rules

1. DB truth is authoritative whenever the local server/API is available.
2. Silent fallback from DB/API to static files is transitional-only and should be removed lane by lane.
3. Committed JSON files should only survive as:
- export snapshots
- historical archives
- intentionally versioned external fixtures
4. If a JSON file is still live, the burden is on that file to justify why its contents are not already derivable from DB fragments/views.

## Migration sequence

### Stage 1. Runtime authority

- App consumes provider/API only.
- Provider treats DB-backed system views as authoritative when the local server advertises them.
- Static file fallback remains only for true static/offline mode.

### Stage 2. Export demotion

- `generate-system-units.mjs` stops reading legacy support/boundary summaries as live inputs.
- system-unit exports are regenerated from DB-backed fragments/views or direct raw extracted record tables that are in the process of moving into DB ownership.

### Stage 3. Record-table migration

Move remaining committed “values/canonical/neighborhood” tables into DB-native extracted record ownership:

- token-shop values/canonical
- multiverse validated values
- metadata neighborhood tables where they are just frozen record projections
- shard family/cost record slices that are still committed as source tables

After that, exports can read those record tables from DB instead of committed JSON.

### Stage 4. Validation cleanup

- validators and smoke stop requiring historical dataset files as current architecture
- validate DB-backed views and generated exports instead

### Stage 5. Dataset/archive cleanup

- old committed support/boundary/probe datasets become archive-only
- generated exports remain optional snapshots

## Current state

### Already aligned

- trace resolution is DB-first
- canonical trace semantics/verdicts/narratives live in DB reducers/materializers
- app core systems already load through `support/system-unit-provider.js`
- active family identity now comes from DB family/row subjects, not registry target ids

### Still transitional

- app provider can still silently fall back to static system-unit files during local-server runs
- `generate-system-units.mjs` still uses some committed record tables as live inputs
- validators/smoke still validate some committed datasets directly
- static `data/system-units/*.json` are still treated as normal runtime inputs in some paths

## Immediate priorities

1. Make DB/API authority explicit at runtime.
2. Move the remaining live record tables into DB-owned extracted-record/materializer classes.
3. Demote `data/system-units/*.json` to explicit fallback/export status everywhere.
4. Remove remaining validators/tests that imply shipped JSON is runtime truth.

## Non-goals for this migration

- do not redesign every presentation model at once
- do not widen token-shop/multiverse/shard semantics beyond what DB-backed evidence already supports
- do not delete historical datasets before all live consumers are gone

## Working definition of done

This migration is complete when:

- the app can run entirely from DB-backed views under the local server
- static JSON is only used in intentional offline/static mode
- remaining committed datasets are either DB-regenerated exports or historical archives
- feature work can proceed without carrying dataset-era compatibility assumptions
