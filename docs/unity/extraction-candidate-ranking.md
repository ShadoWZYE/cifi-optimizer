# Extraction Candidate Ranking

This note records the repo-wide default ranking for unresolved extraction targets across the current extracted-data surface.

Inputs:

- [data/extraction-candidate-families.v1.json](C:\Users\Shadow\Desktop\CiFi\data\extraction-candidate-families.v1.json)
- [data/extraction-candidate-ranking.v1.json](C:\Users\Shadow\Desktop\CiFi\data\extraction-candidate-ranking.v1.json)
- [scripts/unity/score_extraction_candidates.py](C:\Users\Shadow\Desktop\CiFi\scripts\unity\score_extraction_candidates.py)

## Default behavior

Without filters, the scorer looks across:

- committed Unity and metadata artifacts
- extracted-data verification docs
- shipped research-track status notes

It ranks candidate families by unresolved mention density plus binary anchor strength.

## Current repo-wide top unknown

The current default top unknown extraction target is:

1. `spend.multiverse-market-owner-family`

Why:

- it is the most repeatedly unresolved candidate in the current extracted-data notes
- it also has strong grounded binary anchors such as `MultiverseMarket, Assembly-CSharp`, `BuyIS47`, and `CostBox-InscryptionsDone`

## Targeted use

For roadmap-scoped follow-up, filter by track or family id instead of blindly taking the repo-wide top result.

Current PR2-local shard follow-up is documented in:

- [shard-extraction-candidates.md](C:\Users\Shadow\Desktop\CiFi\docs\systems\shards\shard-extraction-candidates.md)
