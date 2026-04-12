# PlayerProfile Schema

Defines the grounded boundary for `state.playerProfile`.

References:

- `PLAYER_PROFILE_IMPORT_ALIASES` in [`player-profile.js`](player-profile.js)
- checked-in audit artifacts:
  - [`docs/contracts/player-profile-import-aliases.md`](docs/contracts/player-profile-import-aliases.md)
  - [`data/player-profile-import-aliases.v1.json`](data/player-profile-import-aliases.v1.json)

## Classification rule

Only place a field in canonical shared truth when it is both:

1. a real CIFI account or progression concept
2. useful to shipped MVP surfaces

Otherwise move it under a labeled non-canonical namespace or remove it from the active form.

## Active form rule

The active manual Profile form should only show values a typical player can quickly provide from the game without deriving or summing them first.

That means:

- direct visible values such as current LR, diamonds, tokens, and current shards belong in the active form
- aggregated or derived values such as total academy relic levels or shard income per hour do not belong in the active form, even if they may still exist as import-only or helper state

## Canonical shared truth

Active shared fields:

| Field | Path | Notes |
|---|---|---|
| Profile name | `meta.profileName` | metadata, not gameplay state |
| Data confidence | `meta.dataConfidence` | import trust label |
| Current LR | `player.loop.loopReset` | loop guardrail and shard context |
| Diamonds | `player.resources.diamonds` | legacy `gems` migrate here |
| Tokens | `player.resources.tokens` | spend-planner input |
| Current shards | `player.resources.shards` | shard workflow input |
| Profile notes | `notes.profile` | manual context |

Import-only or currently hidden canonical aggregates:

| Field | Path | Notes |
|---|---|---|
| Academy relics | `player.resources.academyRelics` | real profile aggregate, but not a direct active-form input because the game shows multiple relic levels instead of one fast total |

## Planner-only inputs

Stored in `state.playerProfile`, but not canonical truth:

| Field | Path | Notes |
|---|---|---|
| Total shard milestone levels | `planning.shards.totalMilestoneLevels` | unlock-watch helper |
| Focus milestone | `planning.shards.focusMilestoneId` | manual target |
| Focus milestone level | `planning.shards.focusMilestoneLevel` | manual target |
| Checked TokenShop subset player-state seam | `planning.tokenShop.checkedSubsetPlayerState.ATU1Level`, `ATU2Level`, `ATU3Level`, `ATU4Level`, `ATU5Level`, `ATU6Level`, and `ATU7Level` checked subset | truthful saved/player-state-backed levels for the grounded TokenShop subset only; still non-canonical, subset-bound, and allowed to mix prefab-driven plus effect-driven checked rows |
| Checked TokenShop subset editor levels | `planning.tokenShop.checkedSubsetLevels.ATU1Level`, `ATU2Level`, `ATU3Level`, `ATU4Level`, `ATU5Level`, `ATU6Level`, and `ATU7Level` checked subset | non-canonical local progression editor state for the grounded TokenShop subset only, including the ATU3 effect-driven row without promoting it into canonical identity |

Import-only or retired active helpers:

| Field | Path | Notes |
|---|---|---|
| Shard income / hour | `planning.shards.ratePerHour` | descriptive derived helper, not directly visible in game, so removed from the active form |

Planner rule:

- checked TokenShop editor levels stay under `planning.tokenShop.checkedSubsetLevels.*` and remain non-canonical until broader row remap and planner gates clear
- checked TokenShop player-state-backed subset levels stay under `planning.tokenShop.checkedSubsetPlayerState.*` for the already cleared four-row seam only and do not promote the wider raw `ATU*Level` family into canonical state

## External-model implementation state

Canonical-system implementation state kept separate from shared truth:

| Field | Path | Notes |
|---|---|---|
| Ship planner summary | `externalModels.shipPlanner.summary.*` | provisional implementation state |
| Ship planner calibration | `externalModels.shipPlanner.communityToolState` | preserved community-tool payload |

Import rule:

- use explicit `systems.ship.*` or `externalModels.shipPlanner.*`
- top-level `power`, `speed`, and `cargo` no longer migrate

## Experimental support-surface helpers

Non-MVP support helpers:

| Field | Path | Notes |
|---|---|---|
| Gem node budget | `externalModels.experimental.gemNodes.budget` | experimental only |
| Primary farming focus | `externalModels.experimental.profileHints.primaryFarmingFocus` | prototype helper |
| Research hours | `externalModels.experimental.profileHints.researchHours` | app-side helper |

Import rule:

- use explicit `externalModels.experimental.*`
- `planning.gemNodeBudget`, `planning.resourceFocus`, `planning.researchHours`, and their flat helper forms are retired

## Compatibility and quarantined state

Migration-only values:

| Field | Path | Notes |
|---|---|---|
| Gem dust | `compatibility.unresolvedProfileFields.gemDust` | unresolved MVP role |
| Hunter level | `compatibility.unresolvedProfileFields.hunterLevel` | real term, unresolved shared-profile role |
| Trait sphere count | `compatibility.unresolvedProfileFields.traitSphereCount` | unresolved shared-profile role |
| Mech parts | `compatibility.unresolvedProfileFields.mechParts` | research-track territory |
| Legacy stage fields | `compatibility.legacyStage.*` | old schema compatibility only |
| Quarantined shard milestone state | `compatibility.unmappedSystemState.shardMilestoneState` | preferred quarantine location for imported shard milestone blobs; never canonical without a verified save-owner and grounded field mapping |
| Legacy shard milestone mirror | `compatibility.unmappedSystemState.shardMilestones` | compatibility mirror of the quarantined shard milestone blob for older consumers |
| Unmapped system blobs | `compatibility.unmappedSystemState.*` | TokenShop, MultiverseMarket, and other non-canonical system state |

Import rule:

- prefer explicit `compatibility.*` paths or namespaced legacy sources such as `stage.*` and `systems.metaProgression.*`
- flat `gemDust`, `hunterLevel`, `traitSphereCount`, and `mechParts` no longer migrate automatically
- imported `systems.shardMilestones` or `compatibility.unmappedSystemState.shardMilestoneState` payloads must remain quarantined under `compatibility.unmappedSystemState.*` until the save owner, field mapping, and planner-safe recommendation gate are verified
- flat spend-state clues such as `BankedTokens`, `DailyTokenium`, `ClaimableTokenium`, `TokenBankCap`, `ClaimableBankTokens`, `FinalTokenBankCap`, `FinalTokenBankFillSpeed`, `DailyTokeniumCap`, `InscryptionsDone`, exact typed SaveData-backed Emporium levels `IS1Level` through `IS110Level`, exact typed Emporium-adjacent trade counters `EsotericR1Trades` through `EsotericR9Trades` and `NecrumR1Trades` through `NecrumR9Trades`, and the bounded early-mech quarantine window `Mech1Unlocked` through `Mech2Unlocked` may be quarantined under `compatibility.unmappedSystemState.*`
- quarantine for `ClaimableTokenium` is compatibility-only and descriptive; it must not be read as token-bank claimable ownership, Daily Tokenium-specific ready state, or canonical `player.*` truth

Mapping gate before canonical promotion:

1. verify the concrete shard milestone save owner or declaring save model
2. recover grounded field-to-label mapping for player-owned shard milestone state
3. prove planner-safe use before any recommendation or canonical `player.*` promotion

## Migration policy

Still accepted:

- canonical renames:
  - `gems` -> `player.resources.diamonds`
  - `relics` -> `player.resources.academyRelics`
- shard helper aliases:
  - `shardRatePerHour` or `systems.shards.ratePerHour`
  - `totalShardMilestoneLevels` or `systems.shards.totalMilestoneLevels`
  - `shardFocusMilestoneId` or `systems.shards.focusMilestoneId`
  - `shardFocusMilestoneLevel` or `systems.shards.focusMilestoneLevel`
- compatibility migration sinks:
  - `stage.highestShipUnlocked`
  - `stage.manualPhase`
  - `systems.metaProgression.hunterLevel`
  - `systems.metaProgression.traitSphereCount`
  - `systems.metaProgression.mechParts`
  - `resources.gemDust`

Always true:

- removed visible fields move into `externalModels` or `compatibility`, not silent deletion
- `externalModels.shipPlanner.communityToolState` is always preserved
- imported objects for real-but-unmapped systems belong under `compatibility.unmappedSystemState`
- invalid numeric planner helpers normalize to `null`

## UI rule

The active Profile form should show:

- canonical shared truth
- metadata
- only directly visible in-game planner helpers

It should not present external-model or compatibility fields as raw CIFI account state. Ship calibration belongs on the Ship Planner page, not the shared Profile page.


