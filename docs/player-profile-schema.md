# PlayerProfile Schema Audit

## Purpose

`state.playerProfile` is the canonical shared backbone for MVP-safe player/account data.

The schema is intentionally split into explicit buckets so the app does not silently mix:
- canonical in-game state
- planning inputs
- deferred compatibility data
- external/community-tool calibration

## Classification rules

- Canonical player state: direct CIFI account, resource, progression, or ship-state values the user can enter as current truth.
- Planning input: user-entered values that help a planner or warning flow, but are not raw account truth.
- Deferred compatibility: values preserved from older shapes or non-MVP inputs that should not be shown as first-class shared profile fields.
- External model state: community-tool or calculator calibration that must remain labeled and isolated from canonical truth.

## Current schema

```js
state.playerProfile = {
  meta: {
    schemaVersion: 2,
    profileName: string | null,
    updatedAt: string | null,
    dataConfidence: "manual" | "mixed" | "verified"
  },
  player: {
    resources: {
      gems: number | null,
      tokens: number | null,
      relics: number | null,
      gemDust: number | null,
      shards: number | null
    },
    loop: {
      loopReset: number | null
    },
    ship: {
      power: number | null,
      speed: number | null,
      cargo: number | null
    },
    deferred: {
      stage: {
        highestShipUnlocked: string | null,
        manualPhase: string | null
      },
      metaProgression: {
        hunterLevel: number | null,
        traitSphereCount: number | null,
        mechParts: number | null
      }
    }
  },
  planning: {
    resourceFocus: string | null,
    gemNodeBudget: number | null,
    shardRatePerHour: number | null,
    compatibility: {
      researchHours: number | null
    }
  },
  notes: {
    profile: string | null
  },
  externalModels: {
    shipPlanner: {
      communityToolState: {}
    }
  }
}
```

## Field map

| Field path | Classification | Written by | Read by | Notes |
| --- | --- | --- | --- | --- |
| `meta.profileName` | metadata | Profile form save/reset, migration | Profile form | User label only. |
| `meta.updatedAt` | metadata | `persistPlayerProfile()` | not user-facing | Persistence audit stamp. |
| `meta.dataConfidence` | metadata | Profile form save/reset, migration | Profile form | Labels trust level of entered data. |
| `player.resources.gems` | canonical | Profile form save/reset, migration | current profile persistence only | Kept because gem/token spend planning is MVP scope. |
| `player.resources.tokens` | canonical | Profile form save/reset, migration | current profile persistence only | MVP-relevant spend resource. |
| `player.resources.relics` | canonical | Profile form save/reset, migration | current profile persistence only | Real CIFI resource, retained as canonical. |
| `player.resources.gemDust` | canonical | Profile form save/reset, migration | Gem planner compatibility fallback | Real CIFI resource; current reader is experimental. |
| `player.resources.shards` | canonical | Profile form save/reset, migration | shard descriptive workflow copy | Real CIFI resource. |
| `player.loop.loopReset` | canonical | Profile form save/reset, migration | LR snapshot save flow | Real progression state. |
| `player.ship.power` | canonical | Profile form save/reset, migration | ship optimizer | Shared ship stats still drive existing planner behavior. |
| `player.ship.speed` | canonical | Profile form save/reset, migration | ship optimizer | Shared ship stats still drive existing planner behavior. |
| `player.ship.cargo` | canonical | Profile form save/reset, migration | ship optimizer | Shared ship stats still drive existing planner behavior. |
| `player.deferred.stage.*` | deferred compatibility | migration only | none | Preserved from older schema, not shown as active MVP profile data. |
| `player.deferred.metaProgression.*` | deferred compatibility | migration only | none | Real mechanics, but not active MVP/shared-planner inputs today. |
| `planning.resourceFocus` | planning input | Profile form save/reset, migration | current persistence only | Kept as explicit planning intent, not canonical state. |
| `planning.gemNodeBudget` | planning input | Profile form save/reset, migration | gem planner | Experimental planner compatibility input. |
| `planning.shardRatePerHour` | planning input | Profile form save/reset, migration | shard descriptive workflow copy | User-entered run/planning metric, not raw account truth. |
| `planning.compatibility.researchHours` | deferred compatibility | migration only | none | Old app-only field kept only so migration does not discard it. |
| `notes.profile` | metadata | Profile form save/reset, migration | Profile form | Free-form user note. |
| `externalModels.shipPlanner.communityToolState` | external model | ship calibration editor, migration | ship planner formulas | Explicitly quarantined community-tool state. |

## Persistence boundary

- `localStorage[cifi-suite.player-profile]` stores only `state.playerProfile`.
- `localStorage[cifi-suite.ship-config]` stores ship planner working/editor state such as loadouts, weights, active slot, and tap settings.
- `playerProfile.externalModels.shipPlanner.communityToolState` stores ship calibration values that the formulas need.
- `shipConfig` stores planner UI/editor choices. It must not become canonical player truth.

## Migration policy

- Legacy flat profile fields like `loopReset`, `power`, `gems`, `shardRatePerHour`, and `automationConfidence` are migrated into schema version 2.
- Previous version-1 shapes using `resources`, `systems`, `stage`, and top-level string `notes` are migrated forward.
- Old `systems.ship.playerState` is folded into `externalModels.shipPlanner.communityToolState`.
- Deferred/non-MVP fields are preserved under `player.deferred` or `planning.compatibility` instead of being dropped silently.
