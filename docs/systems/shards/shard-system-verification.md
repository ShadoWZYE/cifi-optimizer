# Shard System Verification Gate

This document records what is currently verified about the shard workflow and what remains unmapped enough that the app must stay descriptive.

It exists because the current shard workflow uses a repo dataset, but that dataset is primarily grounded from community references rather than from shipped-game owner mapping.

Boundary reference:

- [shard-cost-pr23-audit.md](docs/systems/shards/shard-cost-pr23-audit.md)
- [shard-grounding-boundary.md](docs/systems/shards/shard-grounding-boundary.md)
- [shard-owner-family-verification.md](docs/systems/shards/shard-owner-family-verification.md)
- [data/shard-finalsu-bonus-boundary.v1.json](data/shard-finalsu-bonus-boundary.v1.json)
- [data/shard-milestone-payload-boundary.v1.json](data/shard-milestone-payload-boundary.v1.json)
- [data/shard-cost-model-boundary.v1.json](data/shard-cost-model-boundary.v1.json)
- [data/shard-milestone-row-model-boundary.v1.json](data/shard-milestone-row-model-boundary.v1.json)
- [data/shard-milestone-title-effect-boundary.v1.json](data/shard-milestone-title-effect-boundary.v1.json)
- [data/shard-effect-text-handler-boundary.v1.json](data/shard-effect-text-handler-boundary.v1.json)
- [data/shard-milestone-row-shell-boundary.v1.json](data/shard-milestone-row-shell-boundary.v1.json)
- [data/shard-milestone-row-alignment-boundary.v1.json](data/shard-milestone-row-alignment-boundary.v1.json)
- [data/shard-milestone-handoff-boundary.v1.json](data/shard-milestone-handoff-boundary.v1.json)
- [data/shard-save-boundary.v1.json](data/shard-save-boundary.v1.json)
- [data/shard-scene-monobehaviour-probe.v1.json](data/shard-scene-monobehaviour-probe.v1.json)
- [data/shard-cost-parameter-probe.v1.json](data/shard-cost-parameter-probe.v1.json)
- [data/shard-cost-method-probe.v1.json](data/shard-cost-method-probe.v1.json)
- [data/shard-cost-native-probe.v1.json](data/shard-cost-native-probe.v1.json)
- [data/shard-bonus-slot-probe.v1.json](data/shard-bonus-slot-probe.v1.json)
- [data/shard-type-metadata-probe.v1.json](data/shard-type-metadata-probe.v1.json)

## Current status

The shard system is a real CIFI system, but the current milestone layer should be treated as:

- real system, partially understood
- community-grounded descriptive data
- not yet mapped enough from shipped-game assets for stronger planner claims

## Verified now

### System-level shard anchors

The following are currently safe repo truths:

- Shards are a real CIFI resource.
- Shards are tied to Operations and the Shard Mining Menu.
- Shards reset on Loop Prestige.
- The shard workflow can safely show descriptive warnings and planning helpers around those anchors.

### Asset-grounded shell evidence

Repo-local Unity evidence also confirms that shipped assets contain shard and loop milestone shell content, including:

- `LoopResetStage1` through `LoopResetStage5`
- `ShardMilestones-64`
- `ShardMilestones-256`
- `MilestoneBonusesPerLevel`
- `Milestone1` through at least `Milestone57`
- `Milestones, Assembly-CSharp`
- `SpaceShip-ShardMining-LV1` through `SpaceShip-ShardMining-LV4`

This is enough to say the shard and loop milestone families are present in shipped assets.

It is not enough to treat the current milestone list as extracted game data.

### Owner-family evidence

Repo-local owner-family evidence now narrows the milestone shell further:

- `ShardMining, Assembly-CSharp` sits beside `CheckFirstTimeShardMilestoneOpened`, `AttachFastBuyButton`, `FastBuyButtonMethodShards`, and `StartFastBuyButtonHold`
- metadata ties `ShardMining` to `ShardUpgradeInfo`
- `ShardUpgradeInfo` sits beside `TotalMilestoneLevels`, `get_IsUnlocked`, `get_SU*FinalUnlockReq`, `FinalSU*Bonus*`, and over-level exponent fields
- the same shard-specific trail now also preserves a checked payload-watch cluster around `get_TotalMilestoneLevels`, `InitializeShards`, `UpdateShardCostList`, `GetShardCostList`, `CheckAllMilestoneLevelFills`, `CheckMilestone*ProgressFill`, `Phase1Tick` through `Phase6Tick`, and `CooldownTick`
- the same shard-specific trail now also preserves a checked cost-model boundary with sampled `get_SU0Cost` through `get_SU9Cost` and `get_SU23Cost` through `get_SU29Cost` accessors plus a row-local `SU0StartCost`, `SU0CostExponent`, `SU0GrowthExponent*` shell
- the direct `ShardMining` payload now also preserves an exact serialized `SU0-29UnlockReq` int lane plus exact row-local `StartCost`, `CostExponent`, `GrowthExponent`, and `bonusPerLevel` values for rows `1-29`, with an exact five-field row-0 cost shell candidate
- the native `libil2cpp.so` path now also preserves a verified `get_SU0-29Cost()` getter family with direct RVAs plus the neighboring `UpdateShardCostList`, `GetShardCostList`, `SortCostAndBools`, `CountAffordableShard`, and `get_OverLevel*Exponent` helper neighborhood
- the disassembled native getter entry path now also preserves row-local operand offsets and early call-pattern lanes, which is the strongest current bridge between `get_SU*Cost` and the exact `ShardMining` serialized cost operands
- the same shard-specific trail now also preserves a checked row-model boundary with contiguous `Milestone0TextChecker` through `Milestone29TextChecker` and `SU0UnlockReq` through `SU29UnlockReq`
- shipped Unity assets now preserve explicit shard milestone title assets `SMilestone-0` through `SMilestone-30`, plus a generic `ShardMilestoneBonus1` through `ShardMilestoneBonus8` effect presentation family
- `ShardUpgradeInfo` metadata now also preserves sampled row-local bonus calc accessors such as `get_SU1Bonus1Calc` through `get_SU5Bonus2Calc`
- the strongest current repo-local shard bonus text handler clue is now preserved as `TextHandlerShardMilestoneBonusesPerLevel/N`, and it leads over the generic `SetAllMilestoneTexts` writer for shard effect-text recovery work
- direct `LibCpp2IL` type reflection now also preserves the typed `ShardMining` field table, including row-local `SU0-29` unlock, cost, and bonus fields plus `MilestoneCostList` and `upgradeInfoList`
- the nested `ShardMining+ShardUpgradeInfo` type now preserves a typed runtime-state shell with `Cost`, `MaxLevel`, and `IsUnlocked`
- `ShardPerLevelTextHandler` now preserves row-local typed `SM*B*Text` slot fields, which is a stronger shard bonus-text anchor than a pure string-shell clue
- the narrowed `ShardMining` controller shell also preserves a checked partial row shell around `UnlockMilestone17` through `UnlockMilestone29`, `BuyMilestone0`, and `Milestone0TextChecker` through `Milestone12TextChecker`
- the checked row-alignment boundary now makes the current mismatch explicit: unlock hooks sit at `17-29`, text-checker hooks sit at `0-12`, and buy hooks currently only reach `0`
- the checked handoff boundary now narrows the remaining seam further: `ShardMining` already preserves the direct row-definition family while `ConstructionMilestones` remains only a nearby generic `BuyMilestone1-57` buy family, so the unresolved handoff is no longer row-definition ownership
- the checked shard-owned-state trace now preserves one direct scene-owner to runtime-shell boundary and narrows the blocker further: no local `upgradeInfoList` owned-state population bridge is recovered, no deeper wrapper handoff is recovered, and the current owned-state result stays at a non-local injection seam
- the current narrowed shard-local contexts still preserve zero checked overlap with `PlayerProfileData`, `GetPlayerProfileData`, `FillPlayerProfileData`, or `CloudSavePlayerProfile`
- `level0` now also preserves a direct `ShardMining` MonoBehaviour parser target at path `290724` and byte start `34088352`, plus a separate `ShardPerLevelTextHandler` target at path `286629`
- `ConstructionMilestones` still exists as a parallel generic milestone family, but it is no longer the preferred shard-owner interpretation because its metadata path is academy-side
- the recovered `FinalSU*Bonus*` plus `get_SU*FinalUnlockReq` family is now preserved in a checked shard boundary bundle tied to `ShardUpgradeInfo`

This is enough to stop treating the shard milestone owner as wholly unknown for descriptive workflow work.

It is still not enough to promote a fully conflict-free title map, row-complete effect text, numeric shard cost tables, exact formulas, or saved player-owned shard milestone state as extracted gameplay truth.

### Current milestone dataset status

The bundled shard milestone dataset in:

- [`data/shard-milestones.grounded.v1.json`](data/shard-milestones.grounded.v1.json)
- [`data/shard-observed-behaviors.grounded.v1.json`](data/shard-observed-behaviors.grounded.v1.json)
- [`data/shard-milestones-provenance.grounded.v1.json`](data/shard-milestones-provenance.grounded.v1.json)

is grounded from named community sources and preserves uncertainty/provenance correctly.

That makes it suitable for:

- descriptive unlock-watch cards
- descriptive threshold-watch cards
- loop-reset warnings
- provenance and uncertainty display

## Not yet verified enough for stronger app behavior

- exact serialized or rebuilt player-owned shard milestone owner path behind the recovered runtime shell
- asset-grounded shard milestone labels and bonus tables
- exact row-complete text-handler mapping from recovered row ids to final player-facing bonus text lines
- asset-grounded milestone row order and milestone-number mapping
- recovered declaring owner behind the partial `UnlockMilestone*` / `BuyMilestone*` / `Milestone*TextChecker` row shell
- recovered save-side owner behind the `ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo` runtime shell
- a clean one-to-one shard row-number family inside the current controller shell
- asset-grounded milestone unlock list
- exact mapping between recovered `FinalSU*Bonus*` fields and player-facing shard milestone rows
- verified runtime shard cost formulas, current-cost list semantics, and planner-safe next-cost output
- conflict-free title mapping for rows where shipped asset names still disagree, such as row `28`
- a single authoritative milestone list across conflicting community snapshots
- player-owned milestone levels or comparable save-side inputs for truthful planner logic

## Current app implication

- The shard page can remain in descriptive mode.
- The shard dataset should be labeled as community-grounded descriptive data, not as fully game-side-grounded mechanics.
- The app should not imply that shard milestone names, unlock tables, or effect lists are extracted from Unity/APK assets unless that mapping is actually completed.
- The app may reference the asset-grounded shard shell only to justify warning-oriented shard and loop surfaces, not stronger planner claims.

## Next allowed shard slice

Before expanding shard planner behavior, the repo should:

1. determine whether player-owned shard milestone rows are serialized directly, rebuilt from a deeper save model, or stop at a runtime-only shell behind the narrowed `ShardMining` / `ShardUpgradeInfo` trail
2. verify whether milestone names, unlocks, and bonus labels can be extracted directly
3. recover numeric shard cost parameter values across enough rows to verify the real cost curve
4. compare extracted results against the current community-grounded dataset
5. then decide which future shard planner claims can be promoted beyond descriptive mode
