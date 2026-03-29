# Unity Formula Probe

Date: 2026-03-28

## Goal

Determine whether the strongest mechanic-bearing identifiers recovered from the joined Unity assets contain actual numeric formulas or whether they are still only names/resource references.

Primary targets:

- `OR_MechMaxLevels`
- `LM-GeneratorCost-128`
- `LM-MultipleGeneratorCost-128`
- `LM-LoopModsGrowth`
- `ShardMilestones-64`
- `ShardMilestones-256`
- `OR_TokenBankCap`
- `OR_TokensFromChests`
- `BonusPerUpgrade`
- `TextHandlerShardMilestoneBonusesPerLevel`

## Finding 1: many `LM-*` / `OR_*` / `ShardMilestones-*` entries in `sharedassets0.assets` look like resource assets, not formula tables

The raw byte windows around these names consistently contain:

- a null-terminated asset name
- two repeated 32-bit dimensions immediately after the name
- a third size-like integer

Examples:

- `LM-GeneratorCost-128`
  - width-like field: `0x80`
  - height-like field: `0x80`
  - payload-like field: `0x1e40`
- `LM-MultipleGeneratorCost-128`
  - width-like field: `0x80`
  - height-like field: `0x80`
  - payload-like field: `0x1e40`
- `ShardMilestones-64`
  - width-like field: `0x40`
  - height-like field: `0x40`
  - payload-like field: `0x790`
- `OR_MechMaxLevels`
  - width-like field: `0x1f4`
  - height-like field: `0x1f4`
  - payload-like field: `0x1b900`
- `OR_TokenBankCap`
  - width-like field: `0x1f4`
  - height-like field: `0x1f4`
  - payload-like field: `0x1b900`

This strongly suggests these are texture/sprite-style assets or closely related resource objects named after mechanics, not the mechanic formulas themselves.

## Finding 2: `BonusPerUpgrade` in `level0` is probably scene/UI wiring, not the formula payload

`BonusPerUpgrade` appears many times in a repeated structure alongside:

- `CostBox`
- `DescText`
- `LevelAreaMaxed`
- `BottomMenuButton.GeneratorView`
- `BottomMenuButton.NavConsole`
- `BottomMenuButton.FleetConsole`

The surrounding bytes look like repeated object-entry metadata rather than a compact numeric table. That points to:

- scene object names
- text handler bindings
- prefab child objects

not the actual bonus-per-level numeric values.

## Finding 3: the best remaining grounded leads are the scene handlers, not the resource names

`level0` contains milestone-related scene wiring with higher-value names such as:

- `TextHandlerShardMilestoneBonusesPerLevel`
- `ShardMilestones`
- `PlayLoopResetStage1` through `PlayLoopResetStage5`

Those are more promising because they look like gameplay/UI logic anchors rather than texture/resource labels.

## Practical conclusion

The current pass did **not** recover exact upgrade costs or formulas yet.

It did, however, narrow the search:

- `sharedassets0.assets`
  - contains many mechanic-named resources
  - useful for grounded naming and feature inventory
  - currently not proven to contain the numeric formulas we want
- `level0`
  - contains scene/UI bindings and logic-facing names
  - more promising for locating formula-bearing MonoBehaviours or serialized data references

## Best next step

Stop treating `LM-*` / `OR_*` / `ShardMilestones-*` names in `sharedassets0.assets` as likely formulas by default.

Instead, target:

1. `level0` MonoBehaviour / scene object records around:
   - `TextHandlerShardMilestoneBonusesPerLevel`
   - `ShardMilestones`
   - `BonusPerUpgrade`
   - `PlayLoopResetStage*`
2. IL2CPP metadata/code paths that reference:
   - `GetMilestoneDiamondValue`
   - `GetMilestoneTokenValue`
   - `FinalTier*Tokens`
   - `FinalTier*Diamonds`
   - `FinalShardBonus`
   - `DiamondUltimaBonus`

That is the most credible route to actual formulas from the game build.
