# Unity Mechanics Pass

Date: 2026-03-28

## Scope

This pass reconstructed Unity split asset containers from the CIFI Android build and ran string extraction against the joined files:

- `workbench/unity/joined/globalgamemanagers.assets`
- `workbench/unity/joined/level0`
- `workbench/unity/joined/sharedassets0.assets`

The goal was to recover grounded mechanic/config identifiers even though full IL2CPP field deserialization is still blocked by tooling performance and parser compatibility.

## Strong Findings

The joined assets contain direct mechanic/config names that look like real balancing hooks rather than just UI labels.

### Cost / growth / level hooks

- `BonusPerUpgrade`
- `OR_MechMaxLevels`
- `LM-GeneratorCost-128`
- `LM-MultipleGeneratorCost-128`
- `LM-LoopModsGrowth`
- `LM-LoopModGoalGrowth-128`
- `LM-CellLoopExponent-128`
- `LM-ShardGain-128`
- `LM-ShardsPerOperation-128`
- `LM-ShipRankBonus-128`
- `LM-ShipRankBonus-256`
- `LM-OutputPerPlayerLevel-128`
- `OR_TokenBankCap`
- `OR_TokensFromChests`

These are not formulas yet, but they are strong evidence that the joined assets contain the balance layer we want.

The wider `LM-*` family recovered from `sharedassets0.assets` also includes:

- `LM-CellGain-128`
- `LM-CellsPerOperation-256`
- `LM-CellsPerTick`
- `LM-CellsPerTick-256`
- `LM-DuoOutput-128`
- `LM-GeneratorAmount-128`
- `LM-GeneratorOutput-128`
- `LM-LoopMods-128`
- `LM-LoopModSGained-128`
- `LM-LoopModSpecial1-128`
- `LM-MiningHeadquarters-128`
- `LM-MPConnection-128`
- `LM-NewGenerator-128`
- `LM-NewGenerator-256`
- `LM-QuadOutput-128`
- `LM-ResearchPointsPerOperation-128`
- `LM-ResetGrowth`
- `LM-RobotAmount-128`
- `LM-RobotAmountMultiplicative-128`
- `LM-RoboticMiner-128`
- `LM-Ruleof7-128`
- `LM-ShipRankPoint-256`
- `LM-TechSoftwareScaler-128`
- `LM-TickTime-128`

Some `LM-*` strings are obvious noise (`LM--`, `LM-9`, `LM-y`, `LM-Special1128`) and should not be treated as verified mechanic names yet.

### Loop / shard / milestone systems

- `LoopResetStage1`
- `LoopResetStage2`
- `LoopResetStage3`
- `LoopResetStage4`
- `LoopResetStage5`
- `ShardMilestones-64`
- `ShardMilestones-256`
- `MilestoneBonusesPerLevel`
- `Milestone1` through at least `Milestone57`
- `Milestones, Assembly-CSharp`

This grounds the existence of serialized milestone and loop-reset content in scene/shared assets, not just metadata strings.

### Upgrade / progression families

- `BorgeUpgrade1-MaxHP`
- `BorgeUpgrade2-ATKPower`
- `BorgeUpgrade3-HPRegen`
- `BorgeUpgrade4-DMGReduction`
- `BorgeUpgrade5-EvadeChance`
- `BorgeUpgrade6-EffectChance`
- `BorgeUpgrade7-CritChance`
- `BorgeUpgrade7-MultiStrikeChance`
- `BorgeUpgrade8-CritPower`
- `BorgeUpgrade8-MultistrikePower`
- `BorgeUpgrade9-ATKSpeed`
- `BorgeUpgrades`
- `BorgeUpgradeButton`
- `SpaceShip-ShardMining-LV1`
- `SpaceShip-ShardMining-LV2`
- `SpaceShip-ShardMining-LV3`
- `SpaceShip-ShardMining-LV4`
- `SpaceShip-LoopMods-LV1`
- `SpaceShip-LoopMods-LV2`
- `SpaceShip-LoopMods-LV3`
- `SpaceShip-LoopMods-LV4`
- `SpaceShip-LoopMods-LV5`

These are useful for grounding upgrade families and naming in the optimiser/import schema.

There is also a structured resource-family pattern in `sharedassets0.assets`:

- `RU-Loop1-128` through `RU-Loop11-256`
- `RU-Shard1-128` through `RU-Shard11-256`
- `RU-Ouro1-512` through `RU-Ouro6-512`

Those look like asset family identifiers rather than formulas, but they further confirm that loop, shard, and ouro progression each have explicit serialized content groups in the joined shared assets.

### Ouro systems

- `OuroGem.Power`
- `OuroGem.Attraction`
- `OuroGem.Creation`
- `OuroGem.Innovation`
- `OuroGem.Temporal`
- `OuroGem.Exodus`
- `OuroGem.Evolution`
- `OuroborosTrait.001` through at least `OuroborosTrait.034`
- `OuroborosPoints-64`
- `OuroborosPoints-128`
- `OuroborosPoints-256`

This confirms the joined assets contain real Ouro trait/gem content names, not only UI shell terms.

### Resource / reward labels

- `ResourceDiamond-64`
- `ResourceDiamond-128`
- `ResourceDiamond-256`
- `Resource_Tokenium`
- `Resource_Tokenium_Cap`
- `Shards-64`
- `Shards-128`
- `Shards-256`
- `AdTokens-64`
- `AdTokens-128`
- `AdTokens-256`
- `BattleRewards`
- `DailyReward-64`
- `DailyReward-128`

These are likely sprite/config/resource names rather than complete balance tables, but they are still grounded game concepts.

## What This Means

- The split-file reconstruction worked well enough to expose mechanic-bearing strings from the real Unity scene/shared asset payloads.
- The balance layer is very likely present in `level0` and `sharedassets0.assets`.
- We now have grounded identifiers for costs, max levels, growth hooks, shard milestones, loop reset stages, ship upgrade families, and Ouro trait/gem systems.
- `level0` appears to hold scene wiring and UI bindings for milestone and loop-reset systems.
- `sharedassets0.assets` appears to hold reusable balance/config assets such as max-level, cost-growth, and reward/resource family objects.
- We still do not have exact numeric formulas or serialized field values for these systems.

## Recommended Next Step

Use a targeted extractor instead of a full asset walk:

1. focus only on `level0` and `sharedassets0.assets`
2. pull object names and nearby serialized string tables for the identifiers above
3. try to isolate specific balance-bearing objects such as:
   - `BonusPerUpgrade`
   - `OR_MechMaxLevels`
   - `LM-GeneratorCost-*`
   - `LM-LoopModsGrowth`
   - `MilestoneBonusesPerLevel`
   - `ShardMilestones-*`

If field deserialization remains too slow, the fallback is to locate these objects by offset/name first and then inspect only those objects with a narrower tool path.

