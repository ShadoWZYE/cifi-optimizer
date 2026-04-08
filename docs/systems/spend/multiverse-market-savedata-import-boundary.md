# Multiverse Market SaveData Import Boundary

This note records the active follow-up lane after save-owner recovery closed: one bounded admissibility decision for the recovered `SaveData` Emporium-adjacent block, kept separate from downstream row identity/remap work.

## Canonical split

- checked accessor bridge:
  - `PlayerProfileHandler.get_Market -> MultiverseMarket`
- metadata/member-shell clue:
  - `Market`
- wider checked save owner:
  - `SaveData`

## Checked `IS*Level` to inscription-row boundary

- wider ordered inscription set preserved in repo-local evidence:
  - action shell:
    - `BuyIS1` through `BuyIS110`
    - `SetIS1CostText` through `SetIS110CostText`
  - validated late-block row ranges:
    - `50-59`
    - `63-74`
  - recovered `SaveData` field run:
    - `IS25Level` through `IS110Level`
- checked ordered overlap:
  - `IS71Level` -> ordered row `71`
  - `IS72Level` -> ordered row `72`
  - `IS73Level` -> ordered row `73`
  - `IS74Level` -> ordered row `74`
- what this does and does not ground:
  - this grounds ordered row position inside the wider inscription set
  - this does not yet ground final player-facing row labels for rows `71-74`
  - this does not yet ground any broader `IS*Level` remap outside `71-74`

## Bounded import classification

- `safe_import_candidate`
  - none
- `wrapper_or_export_only`
  - `InscryptionsDone`
    - `PlayerProfileData` already exposes `InscryptionsDone` as a flat wrapper/export field, so importing it from the wider `SaveData` block would widen the owner surface without adding a new bounded canonical Emporium import
- `verified_but_blocked`
  - `IS71Level` through `IS74Level`
    - these now have a checked ordered row-position mapping to validated rows `71-74`, but final row labels and canonical import targets are still not grounded
  - `IS25Level` through `IS70Level` and `IS75Level` through `IS110Level`
    - these are directly recovered on `SaveData`, but the checked repo-local evidence still does not ground their row positions against validated rows
  - `EsotericR1Trades` through `EsotericR9Trades`
  - `NecrumR1Trades` through `NecrumR9Trades`
    - these counters are directly recovered in the same `SaveData` block, but the current slice does not ground them as canonical Emporium import targets
  - `Mech1Unlocked`, `Mech1Units`, `Mech1Upg1Level`, `Mech1Upg2Level`, `Mech1MissionsProgress`, `Mech1MissionsCompleted`, and `Mech2Unlocked`
    - these fields are directly recovered in the same `SaveData` block, but they belong to the adjacent mech progression cluster rather than the narrow Emporium row-order boundary
- `unresolved`
  - none

## Grounded conclusion

- The smallest checked mapping is ordered only: `IS71Level -> row 71`, `IS72Level -> row 72`, `IS73Level -> row 73`, and `IS74Level -> row 74`.
- The wider `IS*Level` run must be treated as part of a larger ordered inscription set, not as isolated import candidates.
- The active admissibility result is `none`: no recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import.
- No recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import.
- Rows `71-74` remain ordered overlap only, not an import-admissible canonical subset.
- If stronger identity evidence does not appear, the canonical import-safe subset stays explicitly empty.

## Track implication

- This artifact is the bounded successor to the archived `spend-multiverse-save-model-recovery` lane.
- Keep row identity/remap work separate from this import-surface decision unless a future artifact grounds both in one checked slice.
