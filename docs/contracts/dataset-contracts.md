# Dataset Contracts

Defines the minimum contract for bundled JSON assets the app can treat as shipped input.

## Sources of truth

- `data/bundled-dataset-contract.v1.json` — checked-in contract manifest
- `data/data-framework.v1.json` — central manifest for mapping canonical inputs and exported system-unit views in the DB-first architecture
- `docs/contracts/dataset-refresh-checklist.md` — operator checklist for dataset promotion or refresh
- `docs/contracts/data-framework.md` — guide for the centralized data migration model

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

### Central system units

- files:
  - `data/system-units/player-state.v1.json`
  - `data/system-units/shards.v1.json`
  - `data/system-units/token-shop.v1.json`
  - `data/system-units/multiverse-market.v1.json`
  - `data/system-units/trace.v1.json`
- classification: `extracted-mechanics`
- must contain the generated centralized system views, live-consumer metadata, provenance records,
  and embedded sections that the app and trace now consume
- must also absorb system-local boundary and support slices once they are fully represented inside
  the generated unit contract; current examples include the TokenShop row owner/remap slices, the
  Multiverse `69-74` row-identity anomaly cluster, and the Shard cost-support calibration/list-path/type-metadata slices
- this is the preferred home for embedded row-identity and cost-support slices that no longer need
  to remain first-class shipped contract artifacts
- useful as the permanent repo-facing contract surface while older flat datasets are progressively
  demoted to archive-only inputs

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

### Shard cost-model boundary

- file: `data/shard-cost-model-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the sampled `get_SU*Cost` accessor windows, the recovered `SU0StartCost` or exponent field shell, and explicit blocked-use framing for exact formulas and optimizer claims
- useful for shard cost-model recovery and optimizer gating, not itself a recovered numeric cost table or planner-safe buy order

### Shard milestone row-model boundary

- file: `data/shard-milestone-row-model-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the contiguous shard-local `Milestone*TextChecker` and `SU*UnlockReq` row ranges plus explicit buy-family seam framing
- useful for shard row recovery and title/effect mapping, not itself a recovered save owner or effect-text table

### Shard milestone title/effect boundary

- file: `data/shard-milestone-title-effect-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain shipped `SMilestone-*` title assets, the `ShardMilestoneBonus*` presentation family, sampled `get_SU*Bonus*Calc` accessors, and explicit conflict/blocking notes
- useful for grounding in-game milestone names and effect-family existence, not itself a fully conflict-free title map or row-complete effect-text table

### Shard effect-text handler boundary

- file: `data/shard-effect-text-handler-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the strongest current shard-side effect-text handler clue, the `ShardMilestoneBonus*` presentation family, sampled `get_SU*Bonus*Calc` accessors, nearby UI text anchors, and explicit blocked-use framing
- useful for narrowing the shard bonus text path away from generic milestone writers, not itself a recovered row-complete effect-text table

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

### Shard milestone handoff boundary

- canonical file: `data/shard-milestone-handoff-boundary.v2.json`
- historical/raw predecessor: `data/shard-milestone-handoff-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the narrowed `ShardMining` row-shell ranges, the academy-side `ConstructionMilestones` numbered buy-family range, and explicit boundary framing for the unresolved handoff between them
- useful for narrowing the remaining declaring-owner seam and future shard row-owner probes, not itself a recovered player-owned row model or planner-safe numbering map

### Shard save boundary

- canonical file: `data/shard-save-boundary.v2.json`
- historical/raw predecessor: `data/shard-save-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the narrowed shard-specific owner-shell terms, the checked save-family terms, and an explicit zero-overlap result across the current shard-local contexts

### Shard scene MonoBehaviour probe

- file: `data/shard-scene-monobehaviour-probe.v1.json`
- classification: `extracted-mechanics`
- must contain direct `level0` MonoBehaviour targets for `ShardMining`, `ShardPerLevelTextHandler`, and `ConstructionMilestones`, plus blocked-use framing against claiming typed shard values from the probe alone
- useful for keeping shard owner-family evidence separate from save-side recovery, not itself a recovered shard save model

### Shard cost parameter probe

- file: `data/shard-cost-parameter-probe.v1.json`
- classification: `extracted-mechanics`
- must contain row-complete `SU0-29` StartCost and CostExponent metadata families plus direct ShardMining numeric candidate tuples, with blocked-use framing against claiming final per-row costs or a verified formula
- useful for narrowing the next typed shard parser and surfacing direct numeric evidence without pretending the row mapping is solved

### Shard cost method probe

- file: `data/shard-cost-method-probe.v1.json`
- classification: `extracted-mechanics`
- must contain the verified `ShardMining.get_SU0-29Cost()` runtime getter family with direct libil2cpp RVAs
- must contain the native helper neighborhood around `UpdateShardCostList`, `GetShardCostList`, `SortCostAndBools`, `CountAffordableShard`, and `get_OverLevel*Exponent`
- must contain tracked getter body-size clustering as code-shape evidence, with blocked-use framing against claiming a final mathematical formula
- useful for keeping the native shard-cost hunt checkable while the repo still lacks decoded method bodies

### Shard cost native probe

- file: `data/shard-cost-native-probe.v1.json`
- classification: `extracted-mechanics`
- must contain disassembled `get_SU*Cost` entry operand reads and early native call-target clusters
- must contain the row-local field-offset bridge from native getters back to `ShardMining` serialized cost operands
- must contain blocked-use framing against claiming a final BigDouble equation before the helper calls are typed
- useful for narrowing the exact getter inputs and native lane splits behind future shard next-cost recovery

### Shard cost formula model

- file: `data/shard-cost-formula-model.v1.json`
- classification: `extracted-mechanics`
- must contain one canonical row-class and stage-rule model derived from the checked shard-cost evidence bundle
- must contain verified serialized parameter anchors, derived staged rule families, provenance notes, and explicit bounded-uncertainty flags
- must contain blocked-use framing against claiming a completed deterministic evaluator, exact next-cost output, or planner-safe optimizer behavior
- useful for converging shard cost evidence into one versioned evaluator-model dataset without loosening any existing grounding gate

Historical note: shard cost formula model is no longer a shipped dataset group. Its live planner/runtime role now derives from the DB-backed shard system materialization (`db:derived:shard-cost-formula-model`), while the committed file remains a historical snapshot/export artifact.

Historical note: shard bonus-slot support is no longer a shipped dataset group. Its live export/runtime role now derives from reducer-owned shard family evidence inside `data/system-units/shards.v1.json`, while the former standalone probe remains historical-only.

Historical note: shard milestone family evidence is no longer a shipped dataset group. Its live export/runtime role now derives inside `data/system-units/shards.v1.json` from grounded shard milestones plus the current row, title, effect, cost, and save boundaries, while the former standalone summary remains historical-only.

### Extraction candidate families

- file: `data/extraction-candidate-families.v1.json`
- classification: `extracted-mechanics`
- must contain the configured family ids, track ids, search terms, anchor terms, and repo-local source-file lists used by the scorer
- useful for repeatable targeted probes and filtered follow-up, not itself a claim that the ranked families are integrated mechanics

### Token shop extract

- live owner: `db:derived:token-shop-values`
- historical snapshot: `data/archive/token-shop-values.json`
- classification: `extracted-mechanics`
- must contain extraction source metadata, raw extracted fields, and normalized numeric tables
- useful for planner foundation work, not itself a recommendation model

### Token shop canonical records

- live owner: `db:derived:token-shop-canonical-records`
- heuristic policy: `db:policy:token-shop-tier-unlocks`
- historical snapshot: `data/tokenshop-canonical-v1.json`
- classification: `extracted-mechanics`
- must keep verified formulas and `SaveData` ATU ownership separate from unverified tier-threshold policy
- useful for grounded runtime/export records while leaving unlock-threshold assumptions explicitly labeled

### Multiverse market extract

- live owner: `db:derived:multiverse-market-values`
- historical snapshot: `data/archive/multiverse-market-values.json`
- classification: `extracted-mechanics`
- must contain extraction source metadata, validated inscription ids, and extracted records
- useful for planner foundation work, but partial extraction must stay labeled as partial

### Spend boundary bundles

- files:
  - `data/multiverse-market-range-boundary.json`
  - `data/multiverse-market-prefab-remap-boundary.json`
  - canonical: `data/multiverse-market-save-boundary.v2.json`
  - historical/raw predecessor: `data/multiverse-market-save-boundary.json`
  - `data/multiverse-market-market-member-boundary.json`
  - `data/token-bank-formula-boundary.json`
  - canonical: `data/token-shop-save-boundary.v2.json`
  - historical/raw predecessor: `data/token-shop-save-boundary.json`
- classification: `extracted-mechanics`
- must contain source paths, explicit grounded boundaries, and unresolved-gap-safe framing
- db-derived support slices now replace several old committed support owners:
  - `db:derived:multiverse-market-metadata-neighborhood`
  - `db:derived:multiverse-market-action-shell`
  - `db:derived:multiverse-market-owner-family`
- useful for planner-prep and validation surfaces, not themselves planner-ready owned-state truth

Historical note: validated multiverse row-text coverage is no longer a shipped dataset group. Its live export/runtime role now derives inside `data/system-units/multiverse-market.v1.json` from current multiverse values, while the former standalone summary remains historical-only.

Historical-only token-shop support files such as `tokenium-naming-clues`, `token-bank-state-clues`,
`daily-tokenium-lane-clues`, `token-shop-trace-support`, `spend-action-lane-clues`,
`token-shop-owner-shell`, and `token-bank-controller-shell` are no longer shipped dataset groups.
Their live export/runtime role has moved into DB/raw-derived sections inside `data/system-units/token-shop.v1.json`.

## Source-priority metadata

Every grounded data note or dataset promotion should keep this order explicit:

1. APK/Unity artifacts and repo extraction outputs first
2. official/public corroboration second
3. community gap-filling last

If a note or refresh cannot point back to that order, it is not ready to become shipped repo truth.

## Contract lifecycle

- current canonical contract versions drive runtime helpers, generators, validators, and system-unit exports
- older versions remain readable only through explicit compatibility or import layers
- historical datasets are provenance, not active schema truth

## Validation path

Run:

- `npm run verify:data`

This validates the manifest plus the shipped snapshot, the generated system units, the grounded shard datasets, the remaining standalone shard/model datasets, extraction-candidate datasets, TokenShop and Multiverse extracts, and the standalone spend-boundary datasets that still remain first-class shipped inputs. Run it before promoting new grounded data, changing shipped dataset shapes, or editing `data/bundled-dataset-contract.v1.json`.

