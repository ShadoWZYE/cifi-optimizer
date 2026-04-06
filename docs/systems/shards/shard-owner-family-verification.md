# Shard Owner-Family Verification

This note records the strongest repo-local owner-family evidence for the shard milestone screen from committed Unity artifacts.

Inputs:

- [data/shard-owner-family-probe.v1.json](data/shard-owner-family-probe.v1.json)
- [data/shard-vs-construction-owner-probe.v1.json](data/shard-vs-construction-owner-probe.v1.json)
- [data/shardmining-metadata-neighborhood.v1.json](data/shardmining-metadata-neighborhood.v1.json)
- [data/shardupgradeinfo-metadata-neighborhood.v1.json](data/shardupgradeinfo-metadata-neighborhood.v1.json)
- [data/shard-metadata-neighborhood.v1.json](data/shard-metadata-neighborhood.v1.json)
- [workbench/unity/joined/level0](workbench/unity/joined/level0)
- [workbench/apk/base/global-metadata.dat](workbench/apk/base/global-metadata.dat)

## Current conclusion

The shard milestone trail is no longer best described as a fully unknown owner.

The strongest shard-specific repo-local evidence currently points to:

- `ShardMining, Assembly-CSharp` as the shard milestone screen controller family
- `ShardMining|ShardUpgradeInfo` as the strongest current shard-specific data carrier candidate

This is stronger than the earlier `ConstructionMilestones` lead because it is shard-specific in both scene and metadata naming.

## Strongest shard-specific evidence

### `ShardMining, Assembly-CSharp`

The committed probe output places `ShardMining, Assembly-CSharp` directly beside shard milestone UI and fast-buy control hooks in `level0`.

Recovered adjacent strings include:

- `CheckFirstTimeShardMilestoneOpened`
- `AttachFastBuyButton`
- `FastBuyButtonMethodShards`
- `StartFastBuyButtonHold`
- `UnlockMilestone17` through `UnlockMilestone29`
- `BuyMilestone0`
- `Milestone0TextChecker` through `Milestone12TextChecker`

This is the strongest current repo-local evidence for the shard milestone screen controller family.

### `ShardMining|ShardUpgradeInfo`

The committed metadata neighborhoods tie `ShardUpgradeInfo` directly to the `ShardMining` family.

Recovered metadata clues include:

- `ShardMining|ShardUpgradeInfo`
- `TotalMilestoneLevels`
- `get_IsUnlocked`
- `set_IsUnlocked`
- `<IsUnlocked>k__BackingField`
- `get_SU1FinalUnlockReq` through at least `get_SU29FinalUnlockReq`
- `FinalSU1Bonus1`
- `FinalSU1Bonus2`
- `FinalSU2Bonus1`
- `FinalSU29Bonus2`
- `FinalSU29Bonus3`
- `OverLevel100Exponent` through `OverLevel400Exponent`
- `<FastBuyEnum>d__1429`

This is the strongest current repo-local evidence that shard milestone or shard-upgrade state and bonus fields likely live under a shard-specific data object, not only under generic milestone handlers.

## Why `ConstructionMilestones` was downgraded

`ConstructionMilestones, Assembly-CSharp` is still present in the repo-local evidence, but it is now treated as a parallel generic or academy-side milestone family, not the current best shard owner claim.

Why it was downgraded:

- the metadata path is explicitly `Assets\Scripts\Upgrades\AcademyData\ConstructionMilestones.cs`
- the class naming is academy-side rather than shard-specific
- the side-by-side owner probe places `ConstructionMilestones, Assembly-CSharp` around blueprint hold strings rather than shard-specific owner labels
- its milestone buy and bonus fields may describe a broader or different milestone family

It still matters as a cautionary nearby lead because it carries:

- `InitializeMilestones`
- `BuyMilestone1` through `BuyMilestone57`
- `SubtractMilestone1`
- `StartMilestone*Hold` and `StopMilestone*Hold`
- `ConstructionMilestonesSum`
- `get_MilestoneMaxLevel`
- `ClaimDiamondMilestone`
- `FinalMilestone*Bonus*`

But the repo should not currently treat that family as the shard milestone owner without stronger shard-specific linkage.

## Boundary impact

What is safe to say now:

- the shard milestone screen is tied to a recovered `ShardMining` family
- shard-specific milestone or upgrade data likely passes through `ShardUpgradeInfo`
- the app's current descriptive shard workflow is grounded against real shard-specific owner-family clues, not only loose shell strings

What still stays blocked:

- exact mapping between `ShardUpgradeInfo` fields and player-facing shard milestone rows
- planner-style shard ranking
- milestone affordability or ETA claims
- owner-grounded milestone import
- canonical shard milestone fields in `state.playerProfile`

## Current implication

This pass narrows the owner trail further, but it does not close the remaining shard extraction gap.

Future shard planner work still depends on a later extraction pass that recovers:

- which `SU*` rows correspond to the current descriptive shard milestone set
- player-owned shard milestone or shard-upgrade state
- verified player-facing labels for the recovered `FinalSU*Bonus*` fields
- the exact serialized row payload or save-side owner behind the current `get_TotalMilestoneLevels`, `UpdateShardCostList`, `GetShardCostList`, and `CheckMilestone*ProgressFill` cluster

## Shipped boundary artifact

This narrowed owner-family result is now also preserved as:

- [data/shard-owner-family-boundary.v1.json](data/shard-owner-family-boundary.v1.json)

That bundle is the fail-fast repo contract for the current shard-specific owner trail. It is safe for validation and truthful UI boundary copy, but not for canonical shard milestone imports or planner math.

The next shard-local fail-fast bundle is now also preserved as:

- [data/shard-milestone-payload-boundary.v1.json](data/shard-milestone-payload-boundary.v1.json)
- [data/shard-milestone-row-shell-boundary.v1.json](data/shard-milestone-row-shell-boundary.v1.json)
- [data/shard-milestone-row-alignment-boundary.v1.json](data/shard-milestone-row-alignment-boundary.v1.json)
- [data/shard-milestone-handoff-boundary.v1.json](data/shard-milestone-handoff-boundary.v1.json)
- [data/shard-save-boundary.v1.json](data/shard-save-boundary.v1.json)

That payload boundary keeps the current milestone-total, cost-list, progress-fill, and phase-tick hooks attached to the shard-specific carrier trail, but it still does not recover player-owned row payloads.

The row-shell boundary separately keeps the first partial `UnlockMilestone*`, `BuyMilestone*`, and `Milestone*TextChecker` shell attached to `ShardMining`, but it still does not identify the declaring row owner or a complete row table.

The row-alignment boundary makes the next blocker explicit: the current controller-side shell splits into `UnlockMilestone17-29`, `Milestone0-12TextChecker`, and `BuyMilestone0` rather than one shared row-number family, so the repo should not infer one-to-one row mapping from those symbols alone.

The handoff boundary narrows the next blocker one step further: `ShardMining` still owns the shard-local row shell, while `ConstructionMilestones` still owns the dense `BuyMilestone1-57` generic buy family and milestone text helpers, so the remaining declaring-owner question is now the exact handoff seam between those two families rather than a fully open-ended shard-owner search.

The shard save boundary separately keeps the narrowed shard-local owner trail and the broader `PlayerProfileData` / `CloudSavePlayerProfile` save-family path from being treated as the same recovered context.

