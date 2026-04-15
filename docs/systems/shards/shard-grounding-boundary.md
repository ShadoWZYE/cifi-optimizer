# Shard Grounding Boundary

This note separates what the repo can currently say about shards from repo-local APK or Unity evidence versus what still comes from descriptive community sources.

Use it with:

- [shard-player-facing-evidence.md](docs/systems/shards/shard-player-facing-evidence.md)
- [shard-system-verification.md](docs/systems/shards/shard-system-verification.md)
- [unity-mechanics-pass.md](docs/unity/unity-mechanics-pass.md)
- [unity-owner-map.md](docs/unity/unity-owner-map.md)
- [data/shard-asset-grounding.v1.json](data/shard-asset-grounding.v1.json)
- [shard-extraction-candidates.md](docs/systems/shards/shard-extraction-candidates.md)
- [shard-owner-family-verification.md](docs/systems/shards/shard-owner-family-verification.md)

## Integration status

The shard track does not yet pass the full system-integration gate for planner behavior.

What passes now:

- system existence
- shard and loop shell presence in shipped assets
- shard milestone owner-family split
- system-level shard anchors that support descriptive warnings

What still fails:

- exact milestone row payload recovery
- conflict-free asset-grounded milestone labels and full row mapping
- asset-grounded row-complete bonus tables and per-level costs
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

- [data/shard-milestones.grounded.v1.json](data/shard-milestones.grounded.v1.json)
- [data/shard-observed-behaviors.grounded.v1.json](data/shard-observed-behaviors.grounded.v1.json)
- [data/shard-milestones-provenance.grounded.v1.json](data/shard-milestones-provenance.grounded.v1.json)

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

## Owner-family split recovered now

The current repo-local evidence is strong enough to narrow the shard milestone owner path into a shard-specific controller/data trail plus one parallel generic milestone lead:

- `ShardMining, Assembly-CSharp`
  - current role evidence: `CheckFirstTimeShardMilestoneOpened`, `AttachFastBuyButton`, `FastBuyButtonMethodShards`, `StartFastBuyButtonHold`
  - partial row-shell evidence: `UnlockMilestone17` through `UnlockMilestone29`, `BuyMilestone0`, `Milestone0TextChecker` through `Milestone12TextChecker`
  - current row-alignment result: unlock hooks and text-checker hooks do not yet share one clean row-number range
  - current handoff result: the shard-local row shell still stops short of the academy-side `ConstructionMilestones` numbered buy family instead of naming the declaring shard row model directly
  - metadata tie-in: `ShardMining|ShardUpgradeInfo`
- `ShardUpgradeInfo`
  - current role evidence: `TotalMilestoneLevels`, `get_IsUnlocked`, `get_SU*FinalUnlockReq`, `FinalSU*Bonus*`, over-level exponent fields, and `<FastBuyEnum>d__1429`
  - current row-model evidence: `SU0UnlockReq` through `SU29UnlockReq`
  - current effect-model evidence: sampled `get_SU1Bonus1Calc` through `get_SU5Bonus2Calc`
- shard bonus text handler
  - current strongest handler clue: `TextHandlerShardMilestoneBonusesPerLevel/N`
  - nearby UI text anchors: `LevelText`, `DescText`, `ValueText`, and `DescriptionText`
  - current interpretation: shard-specific effect-text path leading over the generic `SetAllMilestoneTexts` writer
- shipped shard title assets
  - current title evidence: `SMilestone-0-Eternal(OURO)` through `SMilestone-30-Illuminating`
  - current conflict note: row `28` still has competing shipped title candidates, `Studying` and `Sly`
- shipped shard bonus presentation family
  - current effect-shell evidence: `ShardMilestoneBonus1` through `ShardMilestoneBonus8`
- `ConstructionMilestones, Assembly-CSharp`
  - current role evidence: `InitializeMilestones`, `BuyMilestone1` through `BuyMilestone57`, `ConstructionMilestonesSum`, `get_MilestoneMaxLevel`, and `FinalMilestone*Bonus*`
  - current interpretation: generic or academy-side milestone family, not the preferred shard-specific owner claim

This is enough to treat the shard workflow as a real shipped-game owner-family split for descriptive MVP work.

It is not enough to claim a full extracted milestone planner, because the recovered `FinalSU*Bonus*` family is still not mapped back to verified player-facing shard rows.

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
- fully conflict-free milestone title import
- row-complete player-facing effect text import
- owner-grounded milestone import logic

In short: ranking, ROI, ETA, affordability, and best-upgrade claims remain blocked until shard owner mapping is completed.

## Shared family evidence table

The shipped shard surface now expands from one shared family evidence table:

- `data/shard-milestone-family-evidence.v1.json`
- reachable family: rows `0-29` inside `ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo`
- current row classes:
  - `verified`: `SU1`, `SU2`
  - `blocked`: `SU0`, `SU7`, `SU28`
  - `partial`: all other reachable rows

That table is the current player-facing handoff surface for shard row evidence. Future shard follow-up should upgrade rows inside that shared table instead of reopening standalone row-by-row artifacts for the UI.

## Next allowed shard step

The next shard pass should recover the player-owned milestone ownership or exact serialized payload path behind the narrowed `ShardMining` / `ShardUpgradeInfo` runtime shell, use that result to upgrade rows inside the shared shard-family evidence table, and compare that extracted layer against the current descriptive dataset before any planner expansion.

Current heuristic ranking for that work:

- first target: milestone owner family
- second target: loop-reset stage family

Reference:

- [data/extraction-candidate-ranking.v1.json](data/extraction-candidate-ranking.v1.json)

