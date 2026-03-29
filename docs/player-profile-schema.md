# PlayerProfile Schema

This document defines the grounded boundary for `state.playerProfile`.

## Classification rule

Only place a field in canonical shared player truth when it is both:

1. a real CIFI account or progression concept, and
2. useful to the MVP surfaces currently shipped in this repo.

If a field fails either test, it must be moved under a labeled non-canonical namespace or removed from the active form.

## Canonical shared truth

These fields are the active shared PlayerProfile surface:

| Field | Path | Classification | Notes |
|---|---|---|---|
| Profile name | `meta.profileName` | metadata | App label, not gameplay state. |
| Data confidence | `meta.dataConfidence` | metadata | Tracks how trustworthy the entered values are. |
| Current LR | `player.loop.loopReset` | canonical in-game state | Grounded loop-reset context for shard and warning flows. |
| Diamonds | `player.resources.diamonds` | canonical in-game state | Legacy `gems` values migrate here. |
| Tokens | `player.resources.tokens` | canonical in-game state | Kept for MVP spend planning. |
| Academy relics | `player.resources.academyRelics` | canonical in-game state | Legacy `relics` values migrate here. |
| Current shards | `player.resources.shards` | canonical in-game state | Grounded shard workflow input. |
| Profile notes | `notes.profile` | metadata | Manual context and import notes. |

## Planner-only inputs

These fields may be stored in `state.playerProfile`, but they are not canonical game truth:

| Field | Path | Classification | Notes |
|---|---|---|---|
| Shard income / hour | `planning.shards.ratePerHour` | planner-only input | Manual helper for descriptive shard planning. |
| Total shard milestone levels | `planning.shards.totalMilestoneLevels` | planner-only input | Manual helper for grounded unlock-watch cards, not canonical account truth. |

## External-model implementation state

These fields stay isolated from canonical truth, but still belong to a canonical system implementation surface:

| Field | Path | Classification | Notes |
|---|---|---|---|
| Ship planner summary | `externalModels.shipPlanner.summary.*` | external-model implementation state | Current ship-planner summary values for a canonical system, pending grounded terminology/data remap. |
| Ship planner calibration | `externalModels.shipPlanner.communityToolState` | external-model implementation state | Current ship-planner calibration payload, kept separate from shared PlayerProfile truth. |

## Experimental support-surface helpers

These fields stay isolated from canonical truth and should not be presented as active MVP profile truth:

| Field | Path | Classification | Notes |
|---|---|---|---|
| Gem node budget | `externalModels.experimental.gemNodes.budget` | planner-only / experimental | Experimental gem-node helper, not shared account truth. |
| Primary farming focus | `externalModels.experimental.profileHints.primaryFarmingFocus` | planner-only / experimental | Old prototype focus toggle, not canonical game state. |
| Research hours | `externalModels.experimental.profileHints.researchHours` | planner-only / experimental | App-side planning helper, not a real CIFI field. |

## Unresolved compatibility fields

These values are preserved only for migration compatibility:

| Legacy field | Path | Classification | Why not canonical |
|---|---|---|---|
| Gem dust | `compatibility.unresolvedProfileFields.gemDust` | unresolved | Current research baseline does not verify it as active shared MVP profile truth. |
| Hunter level | `compatibility.unresolvedProfileFields.hunterLevel` | unresolved | Hunter terms are real, but this exact shared field is not yet grounded enough for MVP schema truth. |
| Trait spheres unlocked | `compatibility.unresolvedProfileFields.traitSphereCount` | unresolved | Real term, unresolved shared-profile role. |
| Mech parts | `compatibility.unresolvedProfileFields.mechParts` | unresolved | Real term family remains research-track territory. |
| Highest ship unlocked / manual phase | `compatibility.legacyStage.*` | unresolved | Preserved from earlier schema drafts, but not active grounded profile truth. |
| Unmapped system state blobs | `compatibility.unmappedSystemState.*` | unresolved / quarantined | Preserved imported objects for real-but-unmapped systems such as shard milestones, TokenShop, or MultiverseMarket. These blobs must not be treated as canonical fields or planner-ready state until system mapping is completed. |

## Migration policy

- Legacy flat profile fields migrate into the version 2 schema.
- Old nested prototype fields also migrate into version 2.
- Canonical renames:
  - `gems` -> `player.resources.diamonds`
  - `relics` -> `player.resources.academyRelics`
- Existing planner-helper aliases also migrate into the labeled shard-planning namespace:
  - `shardRatePerHour` or `systems.shards.ratePerHour` -> `planning.shards.ratePerHour`
  - `totalShardMilestoneLevels` or `systems.shards.totalMilestoneLevels` -> `planning.shards.totalMilestoneLevels`
  - `shardFocusMilestoneId` or `systems.shards.focusMilestoneId` -> `planning.shards.focusMilestoneId`
  - `shardFocusMilestoneLevel` or `systems.shards.focusMilestoneLevel` -> `planning.shards.focusMilestoneLevel`
- Removed visible fields are not discarded; they move into `externalModels` or `compatibility`.
- `externalModels.shipPlanner.communityToolState` is always preserved during migration.
- Imported objects for real-but-unmapped systems should be preserved under `compatibility.unmappedSystemState` instead of being collapsed into canonical or planner namespaces.
- Invalid numeric planner-helper values normalize to `null` instead of silently becoming canonical state.

## UI rule

The active Profile form should show:

- canonical shared truth
- metadata
- clearly labeled planner-only helpers

It should not present external-model or unresolved compatibility fields as raw CIFI account state.

External-model calibration should stay with the module implementation that uses it.
In the current app, ship-planner calibration belongs on the Ship Planner page, not on the shared Profile page, even though the underlying ship system is canonical.

Experimental support-surface helpers should remain visibly separate from both canonical shared truth and canonical-system implementation state.
