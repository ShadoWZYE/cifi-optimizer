# Shard Grounding Boundary

This note separates what the repo can currently say about shards from repo-local APK or Unity evidence versus what still comes from descriptive community sources.

Use it with:

- [shard-system-verification.md](C:\Users\Shadow\Desktop\CiFi\docs\systems\shards\shard-system-verification.md)
- [unity-mechanics-pass.md](C:\Users\Shadow\Desktop\CiFi\docs\unity\unity-mechanics-pass.md)
- [unity-owner-map.md](C:\Users\Shadow\Desktop\CiFi\docs\unity\unity-owner-map.md)
- [data/shard-asset-grounding.v1.json](C:\Users\Shadow\Desktop\CiFi\data\shard-asset-grounding.v1.json)
- [shard-extraction-candidates.md](C:\Users\Shadow\Desktop\CiFi\docs\systems\shards\shard-extraction-candidates.md)

## Integration status

The shard track does not yet pass the full system-integration gate for planner behavior.

What passes now:

- system existence
- shard and loop shell presence in shipped assets
- system-level shard anchors that support descriptive warnings

What still fails:

- shard milestone owner recovery
- asset-grounded milestone labels and row mapping
- asset-grounded bonus tables and per-level costs
- player-owned milestone save-state inputs for truthful planner logic

## APK or Unity-grounded now

Repo-local Unity evidence already supports these facts:

- loop-reset stages exist in shipped assets:
  - `LoopResetStage1` through `LoopResetStage5`
- shard milestone shell content exists in shipped assets:
  - `ShardMilestones-64`
  - `ShardMilestones-256`
  - `MilestoneBonusesPerLevel`
  - `Milestone1` through at least `Milestone57`
  - `Milestones, Assembly-CSharp`
- shard progression is connected to the Demeter and shard-mining family in shipped assets:
  - `SpaceShip-ShardMining-LV1` through `SpaceShip-ShardMining-LV4`
- loop-mod and shard-growth families exist in shipped assets:
  - `LM-ShardGain-128`
  - `LM-ShardsPerOperation-128`
  - `LM-LoopModsGrowth`
  - `LM-ResetGrowth`

These are enough to support app claims such as:

- shards are a real game system
- shard progression interacts with loop-reset systems
- the current app can show warning-oriented shard and loop guidance

They are not enough to claim:

- the bundled milestone names are extracted from the game
- the bundled unlock rows are owner-grounded game data
- the app knows true shard cost math or best spend order

## Descriptive-only for now

The current bundled shard datasets remain community-grounded descriptive inputs:

- [data/shard-milestones.grounded.v1.json](C:\Users\Shadow\Desktop\CiFi\data\shard-milestones.grounded.v1.json)
- [data/shard-observed-behaviors.grounded.v1.json](C:\Users\Shadow\Desktop\CiFi\data\shard-observed-behaviors.grounded.v1.json)
- [data/shard-milestones-provenance.grounded.v1.json](C:\Users\Shadow\Desktop\CiFi\data\shard-milestones-provenance.grounded.v1.json)

That descriptive layer currently supplies:

- milestone names
- milestone rarity labels
- milestone unlock requirements
- bonus text rows
- observed shard and loop pacing examples
- source conflicts and uncertainty notes

The repo can display those as:

- watch cards
- threshold references
- source-linked caution notes
- provenance and uncertainty UI

The repo should not promote them to stronger planner truth until the owner mapping is completed.

## Current app-safe boundary

Safe in the app now:

- descriptive unlock-watch cards
- descriptive threshold-watch cards
- descriptive cost-bump watch cards
- loop-reset warnings tied to current LR and tracked shards
- visible provenance and uncertainty copy

Still blocked:

- shard milestone ranking
- shard ROI or ETA math
- milestone affordability estimates
- best-upgrade recommendations
- owner-grounded milestone import logic

In short: ranking, ROI, ETA, affordability, and best-upgrade claims remain blocked until shard owner mapping is completed.

## Next allowed shard step

The next shard pass should recover the concrete shipped-game milestone owner or owner family behind the `ShardMilestones-*` / `Milestones, Assembly-CSharp` shell and compare that extracted layer against the current descriptive dataset before any planner expansion.

Current heuristic ranking for that work:

- first target: milestone owner family
- second target: loop-reset stage family

Reference:

- [data/extraction-candidate-ranking.v1.json](C:\Users\Shadow\Desktop\CiFi\data\extraction-candidate-ranking.v1.json)
