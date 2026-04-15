# Unity Trace Bundle

- Target: `shard-owned-state-upgradeinfolist-population`
- Label: Shard owned-state population boundary
- Anchors: `upgradeInfoList, ShardMining+ShardUpgradeInfo, IsUnlocked, MaxLevel, InitializeShards, UpdateUnlockedMilestonesList, UpdateMaxedMilestonesList`
- Join goal: Trace the owned-state population path behind ShardMining.upgradeInfoList end to end and distinguish whether reachable shard row state is filled by a local runtime bridge, a deeper wrapper handoff, or a still-negative non-local injection seam.

## Planner resolution

- Selection mode: `explicit-target`
- Matched family: `shard-owned-state` (Shard owned state)
- Run mode: `trace`
- Requested queries: `none`
- Requested anchors: `none`
- Expanded anchor kinds: `upgradeInfoList (string), ShardMining+ShardUpgradeInfo (string), IsUnlocked (class), MaxLevel (class), InitializeShards (method), UpdateUnlockedMilestonesList (method), UpdateMaxedMilestonesList (method)`
- Decision note: Used explicit target shard-owned-state-upgradeinfolist-population in the Shard owned state family and kept family-aware anchor expansion so the backend records the same checked synonym surface deterministically.

## Execution anchors

- Typed execution anchors: `upgradeInfoList (string), ShardMining+ShardUpgradeInfo (string), IsUnlocked (class), MaxLevel (class), InitializeShards (method), UpdateUnlockedMilestonesList (method), UpdateMaxedMilestonesList (method)`

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]`
- Direct example: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Planner example: `node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>`
- Accepted anchor kinds: `class, method, field, dataset`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.
- Registry target: `shard-owned-state-upgradeinfolist-population` from `shard-owned-state` via [`data/unity-trace-target-registry.json`](data/unity-trace-target-registry.json)

## Outcome

- Kind: `non-local-injection-seam`
- Label: Non-local injection seam
- Summary: The trace rules out a local upgradeInfoList population bridge and still cannot name a deeper wrapper handoff, so owned-state values remain bounded as a non-local injection seam.

## Source reads

- `shardSaveBoundary`: [`data/shard-save-boundary.v1.json`](data/shard-save-boundary.v1.json)
  - Preserves the split between direct ShardMining row-definition payload and the still-unresolved owned-state path behind upgradeInfoList.
- `shardMilestonePayloadBoundary`: [`data/shard-milestone-payload-boundary.v1.json`](data/shard-milestone-payload-boundary.v1.json)
  - Preserves the shard-local watcher hooks and payload-watch clusters without promoting them into a recovered owned-state source.
- `shardMilestoneHandoffBoundary`: [`data/shard-milestone-handoff-boundary.v1.json`](data/shard-milestone-handoff-boundary.v1.json)
  - Preserves the current shard-local versus academy-side handoff narrowing around upgradeInfoList and generic ConstructionMilestones helpers.
- `shardTypeMetadataProbe`: [`data/shard-type-metadata-probe.v1.json`](data/shard-type-metadata-probe.v1.json)
  - Preserves typed shard owner-list fields plus ShardMining+ShardUpgradeInfo row-state fields recovered from direct type reflection.
- `shardSceneMonoBehaviourProbe`: [`data/shard-scene-monobehaviour-probe.v1.json`](data/shard-scene-monobehaviour-probe.v1.json)
  - Preserves the exact level0 ShardMining MonoBehaviour object that holds the direct shard definition payload.
- `shardMilestoneSaveOwnerCandidates`: [`data/shard-milestone-save-owner-candidates.v1.json`](data/shard-milestone-save-owner-candidates.v1.json)
  - Preserves the still-blocked shard save-owner candidate narrowing used to keep structural cost work separate from save-side promotion.

## Shell window

- Shell field: `upgradeInfoList`
- Shell path id: `5216`
- Owner field block: `<Cost>k__BackingField, <MaxLevel>k__BackingField, <IsUnlocked>k__BackingField`

## Surface traces

### Direct scene owner

- Search terms: `ShardMining, ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo, upgradeInfoList, ShardMining+ShardUpgradeInfo, IsUnlocked, MaxLevel, InitializeShards, UpdateUnlockedMilestonesList, UpdateMaxedMilestonesList`
- Typed anchors: `ShardMining (class), ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo (string), upgradeInfoList (string), ShardMining+ShardUpgradeInfo (string), IsUnlocked (class), MaxLevel (class), InitializeShards (method), UpdateUnlockedMilestonesList (method), UpdateMaxedMilestonesList (method)`
- Source: [`data/shard-scene-monobehaviour-probe.v1.json`](data/shard-scene-monobehaviour-probe.v1.json) (2 hits)
  - Signal summary: 2 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `ShardMining` at `$.monoBehaviours[1].scriptName` [high-signal, score 100, exact-structured]
  - `290724` at `$.monoBehaviours[1].pathId` [high-signal, score 100, exact-structured]
- Source: [`data/shard-save-boundary.v1.json`](data/shard-save-boundary.v1.json) (2 hits)
  - Signal summary: 2 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `ShardMining` at `$.recoveredDirectRowDefinitionPayload.ownerType` [high-signal, score 100, exact-structured]
  - `upgradeInfoList` at `$.recoveredDeclaringRowModel.declaringField.name` [high-signal, score 100, exact-structured]

### upgradeInfoList runtime shell

- Search terms: `ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo, <Cost>k__BackingField, <MaxLevel>k__BackingField, <IsUnlocked>k__BackingField, upgradeInfoList, ShardMining+ShardUpgradeInfo, IsUnlocked, MaxLevel, InitializeShards, UpdateUnlockedMilestonesList, UpdateMaxedMilestonesList`
- Typed anchors: `ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo (string), <Cost>k__BackingField (method), <MaxLevel>k__BackingField (method), <IsUnlocked>k__BackingField (method), upgradeInfoList (string), ShardMining+ShardUpgradeInfo (string), IsUnlocked (class), MaxLevel (class), InitializeShards (method), UpdateUnlockedMilestonesList (method), UpdateMaxedMilestonesList (method)`
- Source: [`data/shard-save-boundary.v1.json`](data/shard-save-boundary.v1.json) (5 hits)
  - Signal summary: 5 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `upgradeInfoList` at `$.recoveredDeclaringRowModel.declaringField.name` [high-signal, score 100, exact-structured]
  - `ShardMining+ShardUpgradeInfo` at `$.recoveredDeclaringRowModel.rowModelType.fullName` [high-signal, score 100, exact-structured]
  - `<Cost>k__BackingField` at `$.recoveredDeclaringRowModel.rowStateFields` [high-signal, score 100, exact-structured]
  - `<MaxLevel>k__BackingField` at `$.recoveredDeclaringRowModel.rowStateFields` [high-signal, score 100, exact-structured]
  - `<IsUnlocked>k__BackingField` at `$.recoveredDeclaringRowModel.rowStateFields` [high-signal, score 100, exact-structured]
- Source: [`data/shard-type-metadata-probe.v1.json`](data/shard-type-metadata-probe.v1.json) (4 hits)
  - Signal summary: 4 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `upgradeInfoList` at `$.targets.shardMining.ownerListFields` [high-signal, score 100, exact-structured]
  - `<Cost>k__BackingField` at `$.targets.shardUpgradeInfo.fields` [high-signal, score 100, exact-structured]
  - `<MaxLevel>k__BackingField` at `$.targets.shardUpgradeInfo.fields` [high-signal, score 100, exact-structured]
  - `<IsUnlocked>k__BackingField` at `$.targets.shardUpgradeInfo.fields` [high-signal, score 100, exact-structured]

### Shard-local watcher and list shells

- Search terms: `InitializeShards, InitializeMaxLevelBools, UpdateUnlockedMilestonesList, UpdateMaxedMilestonesList, CheckAllMilestoneLevelFills, MaxedMilestonesList, UnlockedMilestonesList, MilestoneCostList, upgradeInfoList, upgradeInfoList, ShardMining+ShardUpgradeInfo, IsUnlocked, MaxLevel, InitializeShards, UpdateUnlockedMilestonesList, UpdateMaxedMilestonesList`
- Typed anchors: `InitializeShards (method), InitializeMaxLevelBools (method), UpdateUnlockedMilestonesList (method), UpdateMaxedMilestonesList (method), CheckAllMilestoneLevelFills (method), MaxedMilestonesList (class), UnlockedMilestonesList (class), MilestoneCostList (class), upgradeInfoList (string), ShardMining+ShardUpgradeInfo (string), IsUnlocked (class), MaxLevel (class)`
- Source: [`data/shard-milestone-payload-boundary.v1.json`](data/shard-milestone-payload-boundary.v1.json) (6 hits)
  - Signal summary: 6 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `get_TotalMilestoneLevels` at `$.costAndListHooks` [high-signal, score 100, exact-structured]
  - `InitializeMaxLevelBools` at `$.costAndListHooks` [high-signal, score 100, exact-structured]
  - `UpdateMaxedMilestonesList` at `$.costAndListHooks` [high-signal, score 100, exact-structured]
  - `UpdateUnlockedMilestonesList` at `$.costAndListHooks` [high-signal, score 100, exact-structured]
  - `CheckAllMilestoneLevelFills` at `$.progressFillHooks` [high-signal, score 100, exact-structured]
  - `CheckMilestone0ProgressFill` at `$.progressFillHooks` [high-signal, score 100, exact-structured]
- Source: [`data/shard-type-metadata-probe.v1.json`](data/shard-type-metadata-probe.v1.json) (4 hits)
  - Signal summary: 4 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `MaxedMilestonesList` at `$.targets.shardMining.ownerListFields` [high-signal, score 100, exact-structured]
  - `UnlockedMilestonesList` at `$.targets.shardMining.ownerListFields` [high-signal, score 100, exact-structured]
  - `MilestoneCostList` at `$.targets.shardMining.ownerListFields` [high-signal, score 100, exact-structured]
  - `upgradeInfoList` at `$.targets.shardMining.ownerListFields` [high-signal, score 100, exact-structured]

### Controller versus wrapper handoff boundary

- Search terms: `ConstructionMilestones, Assembly-CSharp, ConstructionMilestones, upgradeInfoList, ShardMining+ShardUpgradeInfo, IsUnlocked, MaxLevel, InitializeShards, UpdateUnlockedMilestonesList, UpdateMaxedMilestonesList`
- Typed anchors: `ConstructionMilestones, Assembly-CSharp (string), ConstructionMilestones (class), upgradeInfoList (string), ShardMining+ShardUpgradeInfo (string), IsUnlocked (class), MaxLevel (class), InitializeShards (method), UpdateUnlockedMilestonesList (method), UpdateMaxedMilestonesList (method)`
- Source: [`data/shard-milestone-handoff-boundary.v1.json`](data/shard-milestone-handoff-boundary.v1.json) (3 hits)
  - Signal summary: 3 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `ShardMining` at `$.shardControllerFamily` [high-signal, score 100, exact-structured]
  - `ConstructionMilestones, Assembly-CSharp` at `$.genericMilestoneLead.family` [high-signal, score 100, exact-structured]
  - `upgradeInfoList` at `$.handoffFindings[3]` [high-signal, score 100, exact-structured]

### Save-side blocker

- Search terms: `PlayerProfile-side shard member shell, PlayerProfileData, CloudSavePlayerProfile, upgradeInfoList, ShardMining+ShardUpgradeInfo, IsUnlocked, MaxLevel, InitializeShards, UpdateUnlockedMilestonesList, UpdateMaxedMilestonesList`
- Typed anchors: `PlayerProfile-side shard member shell (string), PlayerProfileData (class), CloudSavePlayerProfile (class), upgradeInfoList (string), ShardMining+ShardUpgradeInfo (string), IsUnlocked (class), MaxLevel (class), InitializeShards (method), UpdateUnlockedMilestonesList (method), UpdateMaxedMilestonesList (method)`
- Source: [`data/shard-milestone-save-owner-candidates.v1.json`](data/shard-milestone-save-owner-candidates.v1.json) (3 hits)
  - Signal summary: 3 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `PlayerProfile-side shard member shell` at `$.remainingSaveOwnerCandidates[0].label` [high-signal, score 100, exact-structured]
  - `PlayerProfileData` at `$.remainingSaveOwnerCandidates[0].candidateFieldClusters` [high-signal, score 100, exact-structured]
  - `CloudSavePlayerProfile` at `$.remainingSaveOwnerCandidates[0].candidateFieldClusters` [high-signal, score 100, exact-structured]
- Source: [`data/shard-save-boundary.v1.json`](data/shard-save-boundary.v1.json) (2 hits)
  - Signal summary: 2 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `PlayerProfileData` at `$.saveFamilyTermsChecked` [high-signal, score 100, exact-structured]
  - `CloudSavePlayerProfile` at `$.saveFamilyTermsChecked` [high-signal, score 100, exact-structured]

## Bridge check

- Result: `checked non-local injection seam preserved`

## Trace graph

- Present typed edges: `5`
- Negative typed edges: `2`

### Proved joins

- `direct-scene-definition-payload`: The direct level0 ShardMining MonoBehaviour object still holds the reachable shard definition family locally. [direct]
  - `shardSceneMonoBehaviourProbe` at `$.monoBehaviours[1].pathId` proves `290724`
  - `shardSaveBoundary` at `$.recoveredDirectRowDefinitionPayload.ownerType` proves `ShardMining`
- `definition-to-runtime-shell`: The same ShardMining owner that carries direct row definitions also declares upgradeInfoList -> ShardMining+ShardUpgradeInfo as the recovered runtime row shell. [direct]
  - `shardSaveBoundary` at `$.recoveredDeclaringRowModel.declaringField.name` proves `upgradeInfoList`
  - `shardSaveBoundary` at `$.recoveredDeclaringRowModel.rowModelType.fullName` proves `ShardMining+ShardUpgradeInfo`
- `runtime-shell-to-owner-lists`: Type reflection preserves upgradeInfoList beside MaxedMilestonesList, UnlockedMilestonesList, and MilestoneCostList on ShardMining. [direct]
  - `shardTypeMetadataProbe` at `$.targets.shardMining.ownerListFields` proves `MaxedMilestonesList, UnlockedMilestonesList, MilestoneCostList, upgradeInfoList`
- `runtime-shell-to-local-hooks`: The shard payload-watch boundary keeps InitializeShards, list refresh hooks, and milestone progress-fill hooks attached to the same shard-local runtime shell. [supporting]
  - `shardMilestonePayloadBoundary` at `$.costAndListHooks` proves `get_TotalMilestoneLevels, InitializeMaxLevelBools, UpdateMaxedMilestonesList, UpdateUnlockedMilestonesList, SortCostAndBools`
  - `shardMilestonePayloadBoundary` at `$.progressFillHooks` proves `CheckAllMilestoneLevelFills, CheckMilestone0ProgressFill, CheckMilestone1ProgressFill, CheckMilestone9ProgressFill`
- `non-local-injection-seam`: The committed shard boundary set now narrows the owned-state path to a non-local seam: direct definitions and the runtime shell are recovered locally, but owned-state values still arrive from a source the repo cannot yet name. [derived]
  - `shardSaveBoundary` at `$.currentBoundary[2]` proves `This is enough to keep direct row-definition payload recovery separate from unresolved player-owned row-state ownership, and it tightens the blocker further: the current repo can now preserve one exact non-local injection seam result for owned-state values whose save-side source it still cannot name.`
  - `shardMilestoneSaveOwnerCandidates` at `$.confidenceNotes[1]` proves `The current evidence still separates player-owned shard ownership from save-family anchors, and the shard-owned-state trace now rules out both a local population bridge and a recovered deeper wrapper handoff for upgradeInfoList owned-state values, so confidence remains intentionally bounded.`

### Missing joins

- `local-runtime-population-bridge`: The checked shard-local watcher hooks still do not recover any exact write, constructor, or setup path that populates upgradeInfoList owned-state values locally. [negative]
  - `shardSaveBoundary` at `$.runtimeConstructionBoundary.traceResult[1]` records `That target rules out a local runtime population bridge for upgradeInfoList, IsUnlocked, MaxLevel, and adjacent row-owned state because the shard-local watcher hooks still do not recover an exact write, constructor, or setup path.`
  - `shardMilestonePayloadBoundary` at `$.currentBoundary[1]` records `Use it to keep milestone-total, affordability-list, progress-fill, and phase-tick hooks attached to the shard-specific carrier trail while keeping InitializeShards, InitializeMaxLevelBools, UpdateUnlockedMilestonesList, and UpdateMaxedMilestonesList framed as local watcher hooks rather than a recovered owned-state source.`
- `deeper-wrapper-handoff-recovery`: The repo still does not recover an exact deeper wrapper or save-side owner behind upgradeInfoList even though a PlayerProfile-side shard member shell remains the leading unresolved candidate. [negative]
  - `shardMilestoneSaveOwnerCandidates` at `$.remainingSaveOwnerCandidates[0].label` records `PlayerProfile-side shard member shell`
  - `shardMilestoneSaveOwnerCandidates` at `$.currentBoundary[0]` records `Treat this dataset as one recovered direct row-definition payload, one recovered shard-local runtime row shell, and one remaining non-local save-owner gap, not as recovered player-owned shard milestone state or a verified save owner.`

## Solved vs blocked

- Baseline: `upgradeInfoList` path id `5216` stays cleared as the comparison shape.
- Blocked target: `upgradeInfoList` path id `owned-state-bridge` stays blocked.
- Shared present edge types: `direct-scene-definition-payload, definition-to-runtime-shell, runtime-shell-to-owner-lists, runtime-shell-to-local-hooks`
- Baseline-only present edge types: `non-local-injection-seam`
- Blocked missing edge types: `local-runtime-population-bridge, deeper-wrapper-handoff-recovery`

- The current shard trace preserves one direct scene owner, one direct row-definition family, one recovered runtime row shell, and one shard-local watcher/list cluster.
- The trace rules out a local upgradeInfoList population bridge and still cannot name a deeper wrapper handoff, so owned-state values remain bounded as a non-local injection seam.
- Player-owned shard import stays blocked until a real local producer or exact deeper wrapper handoff is recovered.

## Decision summary

- Verdict: `quarantine`
- Summary: The shard owned-state trace is grounded enough to preserve one exact boundary verdict, but the result must stay quarantined to blocker evidence until a local bridge or deeper wrapper handoff is recovered.
- Proved edges: `5`
- Negative edges: `2`
- Baseline gap: `local-runtime-population-bridge, deeper-wrapper-handoff-recovery`

## Current loss

- Shard-local watcher hooks still sit beside upgradeInfoList, UnlockedMilestonesList, MaxedMilestonesList, and MilestoneCostList without one committed write path into IsUnlocked, MaxLevel, or current milestone progress.
- The leading PlayerProfile-side shard member shell remains an unresolved candidate rather than a recovered declaring wrapper or serialized payload owner.
- Keep the owned-state result quarantined to blocker evidence only; it does not reopen planner math, affordability, ROI, ETA, or canonical state.playerProfile promotion.

## Conclusion

- The trace rules out a local upgradeInfoList population bridge and still cannot name a deeper wrapper handoff, so owned-state values remain bounded as a non-local injection seam.
