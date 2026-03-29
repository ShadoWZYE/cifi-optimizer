# Shard System Verification Gate

This document records what is currently verified about the shard workflow and what remains unmapped enough that the app must stay descriptive.

It exists because the current shard workflow uses a repo dataset, but that dataset is primarily grounded from community references rather than from shipped-game owner mapping.

Boundary reference:

- [shard-grounding-boundary.md](C:\Users\Shadow\Desktop\CiFi\docs\systems\shards\shard-grounding-boundary.md)
- [shard-owner-family-verification.md](C:\Users\Shadow\Desktop\CiFi\docs\systems\shards\shard-owner-family-verification.md)

## Current status

The shard system is a real CIFI system, but the current milestone layer should be treated as:

- real system, partially understood
- community-grounded descriptive data
- not yet mapped enough from shipped-game assets for stronger planner claims

## Verified now

### System-level shard anchors

The following are currently safe repo truths:

- Shards are a real CIFI resource.
- Shards are tied to Operations and the Shard Mining Menu.
- Shards reset on Loop Prestige.
- The shard workflow can safely show descriptive warnings and planning helpers around those anchors.

### Asset-grounded shell evidence

Repo-local Unity evidence also confirms that shipped assets contain shard and loop milestone shell content, including:

- `LoopResetStage1` through `LoopResetStage5`
- `ShardMilestones-64`
- `ShardMilestones-256`
- `MilestoneBonusesPerLevel`
- `Milestone1` through at least `Milestone57`
- `Milestones, Assembly-CSharp`
- `SpaceShip-ShardMining-LV1` through `SpaceShip-ShardMining-LV4`

This is enough to say the shard and loop milestone families are present in shipped assets.

It is not enough to treat the current milestone list as extracted game data.

### Owner-family evidence

Repo-local owner-family evidence now narrows the milestone shell further:

- `ShardMining, Assembly-CSharp` sits beside `CheckFirstTimeShardMilestoneOpened`, `AttachFastBuyButton`, `FastBuyButtonMethodShards`, and `StartFastBuyButtonHold`
- metadata ties `ShardMining` to `ShardUpgradeInfo`
- `ShardUpgradeInfo` sits beside `TotalMilestoneLevels`, `get_IsUnlocked`, `get_SU*FinalUnlockReq`, `FinalSU*Bonus*`, and over-level exponent fields
- `ConstructionMilestones` still exists as a parallel generic milestone family, but it is no longer the preferred shard-owner interpretation because its metadata path is academy-side

This is enough to stop treating the shard milestone owner as wholly unknown for descriptive workflow work.

It is still not enough to promote milestone rows, labels, or costs as extracted gameplay truth.

### Current milestone dataset status

The bundled shard milestone dataset in:

- [`data/shard-milestones.grounded.v1.json`](C:\Users\Shadow\Desktop\CiFi\data\shard-milestones.grounded.v1.json)
- [`data/shard-observed-behaviors.grounded.v1.json`](C:\Users\Shadow\Desktop\CiFi\data\shard-observed-behaviors.grounded.v1.json)
- [`data/shard-milestones-provenance.grounded.v1.json`](C:\Users\Shadow\Desktop\CiFi\data\shard-milestones-provenance.grounded.v1.json)

is grounded from named community sources and preserves uncertainty/provenance correctly.

That makes it suitable for:

- descriptive unlock-watch cards
- descriptive threshold-watch cards
- loop-reset warnings
- provenance and uncertainty display

## Not yet verified enough for stronger app behavior

- exact serialized shard milestone row owner or payload
- asset-grounded shard milestone labels and bonus tables
- asset-grounded milestone row order and milestone-number mapping
- asset-grounded milestone unlock list
- exact mapping between recovered `FinalSU*Bonus*` fields and player-facing shard milestone rows
- asset-grounded per-level shard costs
- a single authoritative milestone list across conflicting community snapshots
- player-owned milestone levels or comparable save-side inputs for truthful planner logic

## Current app implication

- The shard page can remain in descriptive mode.
- The shard dataset should be labeled as community-grounded descriptive data, not as fully game-side-grounded mechanics.
- The app should not imply that shard milestone names, unlock tables, or effect lists are extracted from Unity/APK assets unless that mapping is actually completed.
- The app may reference the asset-grounded shard shell only to justify warning-oriented shard and loop surfaces, not stronger planner claims.

## Next allowed shard slice

Before expanding shard planner behavior, the repo should:

1. recover the exact serialized shard milestone row payload or save-side owner from the narrowed `ShardMining` / `ShardUpgradeInfo` trail
2. verify whether milestone names, unlocks, and bonus labels can be extracted directly
3. compare extracted results against the current community-grounded dataset
4. then decide which future shard planner claims can be promoted beyond descriptive mode
