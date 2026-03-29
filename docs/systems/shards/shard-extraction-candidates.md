# Shard Extraction Candidates

This note records the current repo-local ranking for the next shard-owner extraction target.

Inputs:

- [data/extraction-candidate-families.v1.json](C:\Users\Shadow\Desktop\CiFi\data\extraction-candidate-families.v1.json)
- [data/extraction-candidate-ranking.v1.json](C:\Users\Shadow\Desktop\CiFi\data\extraction-candidate-ranking.v1.json)
- [scripts/unity/score_extraction_candidates.py](C:\Users\Shadow\Desktop\CiFi\scripts\unity\score_extraction_candidates.py)

## Method

The ranking is heuristic, not mechanic truth.

By default the script scores all configured extraction families across the current extracted-data surface, then you can filter by track or family id for targeted follow-up.

Inputs used by default:

- binary artifacts:
  - `workbench/unity/joined/level0`
  - `workbench/unity/joined/sharedassets0.assets`
  - `workbench/apk/base/global-metadata.dat`
- extracted-data docs and shipped repo notes:
  - shard verification docs
  - spend verification docs
  - Unity owner and audit docs
  - shipped research-track status

The score is based on:

- how often a family is mentioned in extracted-data notes
- how often those mentions occur in unresolved or blocked contexts
- how many specific anchor terms are found in committed binary artifacts
- how many binary files contain those anchors
- how many nearby context terms appear around those anchors
- whether the anchors appear in both scene assets and metadata

Broad generic anchors should be avoided because they can over-rank noisy families.

## Repo-wide default top candidate

The current repo-wide default top unknown extraction candidate is:

1. `spend.multiverse-market-owner-family`
   - it is the most repeatedly unresolved family across the current extracted-data docs
   - it also has strong grounded binary anchors in the committed Unity and metadata artifacts

That result does not override current roadmap scope. It is the default cross-track unknown, not the forced next PR2 task.

## Current PR2-local ranking

1. `shards.milestone-owner-family`
   - heuristic score: `560`
   - why it wins:
     - strongest shard-family anchor density across all three binary files
     - multiple unresolved mentions in the shard verification and owner-mapping surfaces
     - cross-file presence in both scene assets and metadata
     - nearby context terms include `shard`, `milestone`, `operation`, `loopreset`, `mining`, and `demeter`
   - next action:
     - target the owner behind `Milestones, Assembly-CSharp`, `MilestoneBonusesPerLevel`, and the `ShardMilestones-*` shell first

2. `shards.loop-reset-stage-family`
   - heuristic score: `522`
   - useful for loop-reset shell verification, but less likely than the milestone-owner family to unlock shard-row mapping directly

3. `shards.shard-mining-ship-family`
   - heuristic score: `298`
   - confirms Demeter-side shard progression presence, but currently looks more like adjacent progression content than the milestone owner itself

4. `shards.shard-text-handlers`
   - heuristic score: `82`
   - good for UI-label follow-up, but too thin to be the primary owner target

## Current conclusion

The best next shard-planner extraction candidate is still the milestone payload behind the narrowed shard-specific trail:

- `Milestones, Assembly-CSharp`
- `MilestoneBonusesPerLevel`
- `ShardMilestones-64`
- `ShardMilestones-256`
- `ShardMining|ShardUpgradeInfo`

The loop-reset stage family remains the best secondary path if the milestone payload trail stalls.
