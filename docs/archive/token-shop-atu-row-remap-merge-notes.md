# TokenShop ATU Row Remap Merge Notes

This branch should merge with the following intentional groupings preserved.
Review it in three buckets: shipped TokenShop subset expansion, required companion fixes, and intentional branch-local support work.

## Required companions

- TokenShop shipped-surface work:
  - extends the checked non-canonical subset to `ATU10Level` and `ATU12Level` on Overview and Progression
  - keeps `ATU11Level` explicitly quarantined because it still lacks a final title join
  - keeps `ATU3Level` effect-driven rather than prefab-promoted
- TokenShop grounding artifacts and tests:
  - preserve the bounded ATU9-ATU12 bridge and title-side results
  - preserve the closed ATU3 AdManager bonus-aggregation negative result
  - keep dataset, smoke, and contract validation aligned with the shipped subset
- Shard runtime regression fix:
  - `app.js` restores use of `getShardUnlockRequirement` and `getShardFormulaApplicationProfile`
  - `support/shard-evidence-support.js` returns `getShardFormulaApplicationProfile`
  - these are required for green runtime behavior and test stability
- Player-profile checked-subset contract alignment:
  - `planning.tokenShop.checkedSubsetPlayerState.*` and `planning.tokenShop.checkedSubsetLevels.*` now include `ATU10Level` and `ATU12Level`
  - docs were updated so the shipped subset description matches the live app surface

## Intentional but lane-adjacent branch noise

- Repo line-ending policy cleanup:
  - `.gitattributes`
  - `.prettierrc.json`
  - this is not part of TokenShop grounding logic, but it was kept because it fixes repo-level formatting consistency and supports green validation on this branch

## Not promoted on this branch

- `ATU11Level` remains out of the shipped checked subset
- unresolved TokenShop rows remain quarantined
- token-bank, Daily Tokenium, Emporium, and optimizer behavior remain outside this branch
