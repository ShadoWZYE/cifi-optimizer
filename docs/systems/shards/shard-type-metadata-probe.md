# Shard Type Metadata Probe

This probe reduces the direct `LibCpp2IL` shard type reflection into a compact typed schema artifact.

## Key findings

- Direct LibCpp2IL metadata reflection now exposes typed ShardMining row fields instead of only string-shell clues.
- ShardMining keeps row-local SU0-29 UnlockReq, StartCost, CostExponent, GrowthExponent, and Bonus field families directly on the MonoBehaviour type.
- ShardMining also keeps an upgradeInfoList typed as List<ShardMining+ShardUpgradeInfo>, and the nested ShardUpgradeInfo type currently exposes Cost, MaxLevel, and IsUnlocked fields.
- ShardMining also preserves typed OverLevel100Base, OverLevel200Base, OverLevel300Base, and OverLevel400Base BigDouble field shells on the owner MonoBehaviour.
- The current UABEA asset probe does not recover concrete serialized OverLevel*Base values: default values stay null and direct shard MonoBehaviour field hits remain empty.
- ShardPerLevelTextHandler keeps row-local SM*B*Text fields for shard bonus text slots, which is a stronger typed UI-text lead than generic milestone writers.

## Typed owner/state fields

- `ShardMining` field count: `618`
- `ShardUpgradeInfo` field count: `3`
- `ShardMining` list/state hooks:
  - `MaxedMilestonesList`: `System.Collections.Generic.List`1<System.Boolean>` @ `5144`
  - `UnlockedMilestonesList`: `System.Collections.Generic.List`1<System.Boolean>` @ `5152`
  - `MilestoneCostList`: `System.Collections.Generic.List`1<BreakInfinity.BigDouble>` @ `5160`
  - `upgradeInfoList`: `System.Collections.Generic.List`1<ShardMining+ShardUpgradeInfo>` @ `5216`
- `ShardMining` over-level base field shells:
  - `OverLevel100Base`: `BreakInfinity.BigDouble` @ `5080`; `defaultValue=None`
  - `OverLevel200Base`: `BreakInfinity.BigDouble` @ `5096`; `defaultValue=None`
  - `OverLevel300Base`: `BreakInfinity.BigDouble` @ `5112`; `defaultValue=None`
  - `OverLevel400Base`: `BreakInfinity.BigDouble` @ `5128`; `defaultValue=None`
- `ShardUpgradeInfo` fields:
  - `<Cost>k__BackingField`: `BreakInfinity.BigDouble` @ `16`
  - `<MaxLevel>k__BackingField`: `System.Boolean` @ `32`
  - `<IsUnlocked>k__BackingField`: `System.Boolean` @ `33`

## Row examples

- Row `0`: `5` cost fields, `8` bonus fields, `0` typed text slots
- Row `18`: `3` cost fields, `6` bonus fields, `6` typed text slots
- Row `27`: `3` cost fields, `3` bonus fields, `3` typed text slots

## Current boundary

- Treat this as a typed shard schema probe, not as final serialized row values.
- The field table proves where typed shard cost, bonus, and runtime state fields live, but it does not yet decode concrete serialized values from level0.
- Treat OverLevel*Base as typed owner-field shells only until a future asset probe or direct serialized parser can recover concrete payload values.
- Do not claim a verified get_SU*Cost formula or a row-complete player-facing effect-text table from the type schema alone.
