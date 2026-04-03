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

### Shard owner-family boundary

- file: `data/shard-owner-family-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain source paths, the narrowed shard screen-controller family, shard-specific data-carrier candidates, the downgraded generic milestone lead, and explicit blocked-use framing
- useful for shard owner-mapping prep and fail-fast validation, not itself a player-owned milestone payload

### Shard FinalSU bonus boundary

- file: `data/shard-finalsu-bonus-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the shard-specific FinalSU bonus-field family, SU final-unlock accessor anchors, adjacent ShardUpgradeInfo fields, and explicit blocked-use framing
- useful for shard row-mapping prep and fail-fast validation, not itself a verified player-facing milestone table

### Shard milestone payload boundary

- file: `data/shard-milestone-payload-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the current shard-specific payload-watch cluster around milestone totals, cost-list hooks, progress-fill hooks, and phase-tick fields tied to `ShardUpgradeInfo`
- useful for narrowing the exact serialized shard payload search and fail-fast validation, not itself a recovered player-owned milestone row payload

### Shard milestone row-shell boundary

- file: `data/shard-milestone-row-shell-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the narrowed `ShardMining` row-shell anchors around `UnlockMilestone*`, `BuyMilestone*`, and `Milestone*TextChecker` samples plus explicit blocked-use framing
- useful for future shard row verification and fail-fast validation, not itself a recovered row owner, full row table, or player-facing label map

### Shard milestone row-alignment boundary

- file: `data/shard-milestone-row-alignment-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the currently recovered unlock-hook, buy-hook, and text-checker ranges plus the explicit overlap result between those partial row-shell families
- useful for blocking naive one-to-one shard row-number mapping and narrowing future row-verification probes, not itself a recovered row owner or verified row-label map

### Shard save boundary

- file: `data/shard-save-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the narrowed shard-specific owner-shell terms, the checked save-family terms, and an explicit zero-overlap result across the current shard-local contexts
- useful for keeping shard owner-family evidence separate from save-side recovery, not itself a recovered shard save model

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

### Spend boundary bundles

- files:
  - `data/multiverse-market-metadata-neighborhood.json`
  - `data/multiverse-market-range-boundary.json`
  - `data/multiverse-market-row-text-coverage.json`
  - `data/multiverse-market-prefab-remap-boundary.json`
  - `data/multiverse-market-action-shell.json`
  - `data/multiverse-market-owner-family.json`
  - `data/multiverse-market-save-boundary.json`
  - `data/tokenium-naming-clues.json`
  - `data/token-bank-state-clues.json`
  - `data/daily-tokenium-lane-clues.json`
  - `data/token-bank-formula-boundary.json`
  - `data/token-shop-cost-lanes.json`
  - `data/spend-action-lane-clues.json`
  - `data/token-shop-owner-shell.json`
  - `data/token-shop-save-boundary.json`
  - `data/token-bank-controller-shell.json`
- classification: `extracted-mechanics`
- must contain source paths, explicit grounded boundaries, and unresolved-gap-safe framing
- useful for planner-prep and validation surfaces, not themselves planner-ready owned-state truth

## Source-priority metadata

Every grounded data note or dataset promotion should keep this order explicit:

1. APK/Unity artifacts and repo extraction outputs first
2. official/public corroboration second
3. community gap-filling last

If a note or refresh cannot point back to that order, it is not ready to become shipped repo truth.

## Validation path

Run:

- `npm run verify:data`

This validates the manifest plus the shipped snapshot, shard, shard-asset-grounding, shard-owner-family-boundary, shard-finalsu-bonus-boundary, shard-milestone-payload-boundary, shard-milestone-row-shell-boundary, shard-milestone-row-alignment-boundary, shard-save-boundary, extraction-candidate-families, extraction-candidate-ranking, token-shop, multiverse-market, and spend-boundary datasets. Run it before promoting new grounded data, changing shipped dataset shapes, or editing `data/bundled-dataset-contract.v1.json`.

