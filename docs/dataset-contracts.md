# Dataset Contracts

This document defines the minimum contract for bundled JSON assets that the app is allowed to treat as shipped input.

## Purpose

The repo is in a grounding phase. Bundled datasets need a stable contract before new planner work builds on them.

The contract exists to prevent:

- silent schema drift
- accidental promotion of speculative data
- app logic depending on undocumented file shapes

The checked-in source of truth for this contract is:

- `data/bundled-dataset-contract.v1.json`

Use the manifest when adding, removing, or reclassifying bundled datasets. The prose below explains the intent of that manifest and the minimum expectations for each shipped dataset group.

For the operator path that goes with this contract, use:

- `docs/dataset-refresh-checklist.md`

## Classification labels

Use one of these labels when describing a bundled dataset:

- `canonical-app-snapshot` for app-owned local defaults and research-track content
- `grounded-descriptive` for grounded CIFI data that is safe for descriptive workflows but not full optimizer math
- `extracted-mechanics` for direct APK or Unity extraction outputs that are useful inputs for future planner work
- `community-derived` only when the dataset is intentionally sourced from a named community tool or sheet

## Current bundled datasets

### App snapshot

- File: `data/game-data.snapshot.v1.json`
- Classification: `canonical-app-snapshot`
- Must contain:
  - snapshot version and capture date
  - ship loadouts
  - validation cases
  - research tracks
- Current grounding rule:
  - `shardMilestones` stays empty until a verified-safe import shape is approved

### Grounded shard bundle

- Files:
  - `data/shard-milestones.grounded.v1.json`
  - `data/shard-observed-behaviors.grounded.v1.json`
  - `data/shard-milestones-provenance.grounded.v1.json`
- Classification: `grounded-descriptive`
- Must contain:
  - generated date and source report
  - grounded mechanics notes
  - descriptive milestone records
  - observed behavior examples
  - source registry and uncertainty log
- Current grounding rule:
  - safe for descriptive shard guidance
  - not safe for shard cost simulation or ROI ranking

### Token shop extract

- File: `data/token-shop-values.json`
- Classification: `extracted-mechanics`
- Must contain:
  - extraction source metadata
  - raw extracted field list
  - normalized numeric table for known token-shop constants
- Current grounding rule:
  - useful for planner foundation work
  - not itself a recommendation model

### Multiverse market extract

- File: `data/multiverse-market-values.json`
- Classification: `extracted-mechanics`
- Must contain:
  - extraction source metadata
  - validated inscription row ids
  - extracted record list with direct serialized values
- Current grounding rule:
  - useful for planner foundation work
  - partial extraction remains partial and must stay labeled that way

## Source-priority metadata

The bundled dataset contract manifest also records the repo's source-priority rule. Every new grounded data note or bundled dataset promotion should keep this order explicit:

1. APK/Unity artifacts and the repo's extraction outputs first
2. official/public game-facing corroboration second
3. community gap-filling last

If a future dataset refresh or research note cannot point back to that priority order, it is not ready to be promoted as shipped repo truth.

## Local validation path

Run:

- `npm run verify:data`

This command validates the checked-in manifest plus the current bundled contracts for:

- app snapshot
- grounded shard bundle
- token shop extract
- multiverse market extract

Use it before promoting new grounded data, changing shipped dataset shapes, or editing `data/bundled-dataset-contract.v1.json`.
