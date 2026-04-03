# PlayerProfile Import Aliases

This document is generated from `PLAYER_PROFILE_IMPORT_ALIASES` in `player-profile.js`.

## Metadata

Classification: `metadata`

Shared profile metadata accepted by the normalizer.

Accepted alias paths: 6

| Field | Target path | Accepted aliases |
|---|---|---|
| `profileName` | `meta.profileName` | `meta.profileName`, `profileName` |
| `updatedAt` | `meta.updatedAt` | `meta.updatedAt` |
| `dataConfidence` | `meta.dataConfidence` | `meta.dataConfidence`, `confidence`, `automationConfidence` |

## Canonical Shared Truth

Classification: `canonical`

Grounded MVP profile inputs that belong in shared PlayerProfile truth.

Accepted alias paths: 19

| Field | Target path | Accepted aliases |
|---|---|---|
| `loopReset` | `player.loop.loopReset` | `player.loop.loopReset`, `systems.loop.loopReset`, `loopReset` |
| `diamonds` | `player.resources.diamonds` | `player.resources.diamonds`, `resources.diamonds`, `resources.gems`, `gems` |
| `tokens` | `player.resources.tokens` | `player.resources.tokens`, `resources.tokens`, `tokens` |
| `academyRelics` | `player.resources.academyRelics` | `player.resources.academyRelics`, `resources.academyRelics`, `resources.relics`, `relics` |
| `shards` | `player.resources.shards` | `player.resources.shards`, `resources.shards`, `shards` |
| `notes` | `notes.profile` | `notes.profile`, `notes` |

## Planner-only Helpers

Classification: `planner`

Descriptive helper inputs that stay outside canonical account truth.

Accepted alias paths: 14

| Field | Target path | Accepted aliases |
|---|---|---|
| `shardRatePerHour` | `planning.shards.ratePerHour` | `planning.shards.ratePerHour`, `systems.shards.ratePerHour`, `shardRatePerHour` |
| `totalShardMilestoneLevels` | `planning.shards.totalMilestoneLevels` | `planning.shards.totalMilestoneLevels`, `systems.shards.totalMilestoneLevels`, `totalShardMilestoneLevels` |
| `shardFocusMilestoneId` | `planning.shards.focusMilestoneId` | `planning.shards.focusMilestoneId`, `systems.shards.focusMilestoneId`, `planning.shardFocusMilestoneId`, `shardFocusMilestoneId` |
| `shardFocusMilestoneLevel` | `planning.shards.focusMilestoneLevel` | `planning.shards.focusMilestoneLevel`, `systems.shards.focusMilestoneLevel`, `planning.shardFocusMilestoneLevel`, `shardFocusMilestoneLevel` |

## External-model Implementation State

Classification: `external-model`

Canonical-system implementation state kept separate from shared truth.

Accepted alias paths: 6

| Field | Target path | Accepted aliases |
|---|---|---|
| `shipPower` | `externalModels.shipPlanner.summary.power` | `externalModels.shipPlanner.summary.power`, `systems.ship.power` |
| `shipSpeed` | `externalModels.shipPlanner.summary.speed` | `externalModels.shipPlanner.summary.speed`, `systems.ship.speed` |
| `shipCargo` | `externalModels.shipPlanner.summary.cargo` | `externalModels.shipPlanner.summary.cargo`, `systems.ship.cargo` |

## Experimental Support Helpers

Classification: `experimental`

Non-MVP support-surface helpers preserved as labeled imports only.

Accepted alias paths: 3

| Field | Target path | Accepted aliases |
|---|---|---|
| `gemNodeBudget` | `externalModels.experimental.gemNodes.budget` | `externalModels.experimental.gemNodes.budget` |
| `primaryFarmingFocus` | `externalModels.experimental.profileHints.primaryFarmingFocus` | `externalModels.experimental.profileHints.primaryFarmingFocus` |
| `researchHours` | `externalModels.experimental.profileHints.researchHours` | `externalModels.experimental.profileHints.researchHours` |

## Compatibility-only Migration Sinks

Classification: `compatibility`

Legacy or unmapped values preserved for migration safety only.

Accepted alias paths: 31

| Field | Target path | Accepted aliases |
|---|---|---|
| `highestShipUnlocked` | `compatibility.legacyStage.highestShipUnlocked` | `compatibility.legacyStage.highestShipUnlocked`, `stage.highestShipUnlocked` |
| `manualPhase` | `compatibility.legacyStage.manualPhase` | `compatibility.legacyStage.manualPhase`, `stage.manualPhase` |
| `gemDust` | `compatibility.unresolvedProfileFields.gemDust` | `compatibility.unresolvedProfileFields.gemDust`, `resources.gemDust` |
| `hunterLevel` | `compatibility.unresolvedProfileFields.hunterLevel` | `compatibility.unresolvedProfileFields.hunterLevel`, `systems.metaProgression.hunterLevel` |
| `traitSphereCount` | `compatibility.unresolvedProfileFields.traitSphereCount` | `compatibility.unresolvedProfileFields.traitSphereCount`, `systems.metaProgression.traitSphereCount` |
| `mechParts` | `compatibility.unresolvedProfileFields.mechParts` | `compatibility.unresolvedProfileFields.mechParts`, `systems.metaProgression.mechParts` |
| `shardMilestones` | `compatibility.unmappedSystemState.shardMilestones` | `compatibility.unmappedSystemState.shardMilestones`, `systems.shardMilestones` |
| `tokenShop` | `compatibility.unmappedSystemState.tokenShop` | `compatibility.unmappedSystemState.tokenShop`, `systems.tokenShop`, `systems.tokenBank`, `tokenShop`, `tokenBank` |
| `multiverseMarket` | `compatibility.unmappedSystemState.multiverseMarket` | `compatibility.unmappedSystemState.multiverseMarket`, `systems.multiverseMarket`, `multiverseMarket` |
| `tokenShopStateClues` | `compatibility.unmappedSystemState.tokenShop` | `TokenBankCap`, `ClaimableBankTokens`, `BankedTokens`, `DailyTokenium`, `DailyTokeniumCap`, `FinalTokenBankCap`, `FinalTokenBankFillSpeed`, `FinalDailyTokenBonus` |
| `multiverseMarketStateClues` | `compatibility.unmappedSystemState.multiverseMarket` | `InscryptionsDone` |

## Ship Calibration Preservation

Classification: `external-model`

Community-tool ship payloads preserved alongside the ship implementation surface.

Accepted alias paths: 2

| Field | Target path | Accepted aliases |
|---|---|---|
| `communityToolState` | `externalModels.shipPlanner.communityToolState` | `externalModels.shipPlanner.communityToolState` |
| `legacyShipPlayerState` | `externalModels.shipPlanner.communityToolState` | `systems.ship.playerState` |

