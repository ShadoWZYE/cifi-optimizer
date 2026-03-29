# Shard System Verification Gate

This document records what is currently verified about the shard workflow and what remains unmapped enough that the app must stay descriptive.

It exists because the current shard workflow uses a repo dataset, but that dataset is primarily grounded from community references rather than from shipped-game owner mapping.

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

- shipped-game owner mapping for shard milestones themselves
- asset-grounded shard milestone labels and bonus tables
- asset-grounded milestone unlock list
- asset-grounded per-level shard costs
- a single authoritative milestone list across conflicting community snapshots

## Current app implication

- The shard page can remain in descriptive mode.
- The shard dataset should be labeled as community-grounded descriptive data, not as fully game-side-grounded mechanics.
- The app should not imply that shard milestone names, unlock tables, or effect lists are extracted from Unity/APK assets unless that mapping is actually completed.

## Next allowed shard slice

Before expanding shard planner behavior, the repo should:

1. locate the shipped-game shard milestone owner or owner family in the available assets
2. verify whether milestone names, unlocks, and bonus labels can be extracted directly
3. compare extracted results against the current community-grounded dataset
4. then decide which current shard workflow claims can remain in MVP copy
