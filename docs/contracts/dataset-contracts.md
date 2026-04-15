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

- file: `data/shard-milestone-handoff-boundary.v1.json`
- classification: `extracted-mechanics`
- must contain the narrowed `ShardMining` row-shell ranges, the academy-side `ConstructionMilestones` numbered buy-family range, and explicit boundary framing for the unresolved handoff between them
- useful for narrowing the remaining declaring-owner seam and future shard row-owner probes, not itself a recovered player-owned row model or planner-safe numbering map

### Shard save boundary

- file: `data/shard-save-boundary.v1.json`
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

### Shard cost screenshot calibration

- file: `data/shard-cost-screenshot-calibration.v1.json`
- classification: `extracted-mechanics`
- must contain player-supplied in-game shard cost checkpoints with row ids, observed levels, and visible cost labels
- must contain blocked-use framing against treating screenshot checkpoints as final formula proof
- useful for calibrating candidate shard formulas against real in-game magnitudes while the runtime equation is still unresolved

### Shard cost list-path probe

- file: `data/shard-cost-list-path-probe.v1.json`
- classification: `extracted-mechanics`
- must contain the checked `GetShardCostList` call order through `get_SU0Cost` to `get_SU29Cost`
- must contain the owner-side `MilestoneCostList` cache tie-in plus downstream `UpdateShardCostList`, `SortCostAndBools`, and `CountAffordableShard` framing
- must contain blocked-use framing against treating the list-builder path as proof of a separate shard cost formula
- useful for proving that the remaining formula work still lives inside `get_SU*Cost` instead of a hidden cache-builder path

### Shard cost formula model

- file: `data/shard-cost-formula-model.v1.json`
- classification: `extracted-mechanics`
- must contain one canonical row-class and stage-rule model derived from the checked shard-cost evidence bundle
- must contain verified serialized parameter anchors, derived staged rule families, provenance notes, and explicit bounded-uncertainty flags
- must contain blocked-use framing against claiming a completed deterministic evaluator, exact next-cost output, or planner-safe optimizer behavior
- useful for converging shard cost evidence into one versioned evaluator-model dataset without loosening any existing grounding gate

### Shard bonus slot probe

- file: `data/shard-bonus-slot-probe.v1.json`
- classification: `extracted-mechanics`
- must contain exact `SU0-29` `Bonus*` slot-count coverage plus row-0 mismatch framing where grounded descriptive bonuses still undershoot metadata
- useful for nailing row-local bonus arity without pretending the player-facing effect text or formulas are fully recovered

### Shard milestone family evidence

- file: `data/shard-milestone-family-evidence.v1.json`
- classification: `extracted-mechanics`
- must contain the reachable shard family row table for `SU0-29`, plus shared row-model, row-shell, payload-watch, and save-boundary framing
- must classify rows as `verified`, `partial`, or `blocked`
- must migrate the checked `SU1` and `SU2` verified packages into that shared table
- useful for the descriptive Shard Mining family surface, not itself a planner-safe cost model, affordability surface, or save import map

### Shard type metadata probe

- file: `data/shard-type-metadata-probe.v1.json`
- classification: `extracted-mechanics`
- must contain the direct `LibCpp2IL` typed shard schema for `ShardMining`, `ShardPerLevelTextHandler`, and nested `ShardUpgradeInfo`, plus the `upgradeInfoList` and `MilestoneCostList` owner hooks
- useful for source-port validation and future typed shard value recovery, not itself a decoded serialized value table or verified cost formula

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
  - `data/multiverse-market-market-member-boundary.json`
  - `data/multiverse-market-69-74-anomaly-provenance.json`
  - `data/tokenium-naming-clues.json`
  - `data/token-bank-state-clues.json`
  - `data/daily-tokenium-lane-clues.json`
  - `data/token-bank-formula-boundary.json`
  - `data/token-shop-cost-lanes.json`
  - `data/spend-action-lane-clues.json`
  - `data/token-shop-owner-shell.json`
  - `data/token-shop-save-boundary.json`
  - `data/unity-trace-bundle.json`
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

This validates the manifest plus the shipped snapshot, shard, shard-asset-grounding, shard-owner-family-boundary, shard-finalsu-bonus-boundary, shard-milestone-payload-boundary, shard-milestone-row-shell-boundary, shard-milestone-row-alignment-boundary, shard-milestone-handoff-boundary, shard-save-boundary, shard-scene-monobehaviour-probe, shard-cost-parameter-probe, shard-cost-method-probe, shard-cost-native-probe, shard-cost-screenshot-calibration, shard-cost-list-path-probe, shard-cost-formula-model, shard-bonus-slot-probe, shard-type-metadata-probe, extraction-candidate-families, extraction-candidate-ranking, token-shop, multiverse-market, and spend-boundary datasets. Run it before promoting new grounded data, changing shipped dataset shapes, or editing `data/bundled-dataset-contract.v1.json`.

