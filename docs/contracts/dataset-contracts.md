# Dataset Contracts

Defines the minimum contract for bundled JSON assets the app can treat as shipped input.

## Sources of truth

- `data/bundled-dataset-contract.v1.json` — checked-in contract manifest
- `docs/contracts/dataset-refresh-checklist.md` — operator checklist for dataset promotion or refresh

## Why this exists

Prevent:

- silent schema drift
- accidental promotion of speculative data
- app logic depending on undocumented file shapes

## Classifications

- `canonical-app-snapshot` — app-owned defaults and research-track status
- `grounded-descriptive` — grounded CIFI data safe for descriptive workflows, not full optimizer math
- `extracted-mechanics` — direct APK/Unity extraction outputs useful for future planner work
- `community-derived` — intentionally sourced from a named community tool or sheet

## Shipped dataset groups

### App snapshot

- file: `data/game-data.snapshot.v1.json`
- classification: `canonical-app-snapshot`
- must contain snapshot version, capture date, ship loadouts, validation cases, and research tracks
- `shardMilestones` stays empty until a verified-safe import shape is approved

### Grounded shard bundle

- files:
  - `data/shard-milestones.grounded.v1.json`
  - `data/shard-observed-behaviors.grounded.v1.json`
  - `data/shard-milestones-provenance.grounded.v1.json`
- classification: `grounded-descriptive`
- must contain generated date, source report, grounded mechanics notes, descriptive milestones, observed behaviors, and provenance/uncertainty
- safe for descriptive shard guidance, not shard cost simulation or ROI ranking

### Shard asset grounding

- file: `data/shard-asset-grounding.v1.json`
- classification: `extracted-mechanics`
- must contain source artifact references, recovered shard or loop shell identifiers, app-safe uses, blocked uses, unresolved gaps, and the current integration status
- useful for APK-grounding validation and truthful shard-boundary UI, not itself a milestone planner

### Extraction candidate families

- file: `data/extraction-candidate-families.v1.json`
- classification: `extracted-mechanics`
- must contain the configured family ids, track ids, search terms, anchor terms, and repo-local source-file lists used by the scorer
- useful for repeatable targeted probes and filtered follow-up, not itself a claim that the ranked families are integrated mechanics

### Extraction candidate ranking

- file: `data/extraction-candidate-ranking.v1.json`
- classification: `extracted-mechanics`
- must contain the repo-wide default unknown-target ranking, source-file lists, and per-family heuristic summaries
- useful for choosing the next extraction target from existing repo-local evidence; roadmap work should still filter it to the active track instead of blindly following the global top result

### Token shop extract

- file: `data/token-shop-values.json`
- classification: `extracted-mechanics`
- must contain extraction source metadata, raw extracted fields, and normalized numeric tables
- useful for planner foundation work, not itself a recommendation model

### Multiverse market extract

- file: `data/multiverse-market-values.json`
- classification: `extracted-mechanics`
- must contain extraction source metadata, validated inscription ids, and extracted records
- useful for planner foundation work, but partial extraction must stay labeled as partial

## Source-priority metadata

Every grounded data note or dataset promotion should keep this order explicit:

1. APK/Unity artifacts and repo extraction outputs first
2. official/public corroboration second
3. community gap-filling last

If a note or refresh cannot point back to that order, it is not ready to become shipped repo truth.

## Validation path

Run:

- `npm run verify:data`

This validates the manifest plus the shipped snapshot, shard, shard-asset-grounding, extraction-candidate-families, extraction-candidate-ranking, token-shop, and multiverse-market datasets. Run it before promoting new grounded data, changing shipped dataset shapes, or editing `data/bundled-dataset-contract.v1.json`.

