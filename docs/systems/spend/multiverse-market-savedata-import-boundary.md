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
    - `IS1Level` through `IS110Level`
- checked ordered overlap:
  - `IS71Level` -> ordered row `71`
  - `IS72Level` -> ordered row `72`
  - `IS73Level` -> ordered row `73`
  - `IS74Level` -> ordered row `74`
- exact typed hard boundaries on that run:
  - lower edge:
    - `SaveData` directly declares `IS1Level`
    - the checked typed probe does not recover `IS0Level`
  - upper edge:
    - `SaveData` directly declares `IS110Level`
    - the checked typed probe does not recover `IS111Level`
    - `InscryptionsDone` is the next checked typed `SaveData` neighbor after `IS110Level`
- what this does and does not ground:
  - this grounds ordered row position inside the wider inscription set
  - this does not yet ground final player-facing row labels for rows `71-74`
  - this does not yet ground any broader `IS*Level` remap outside `71-74`

## Bounded import classification

- `safe_import_candidate`
  - `IS1Level` through `IS110Level`
    - this exact SaveData-owned `IS*Level` span is now safe to preserve as compatibility-only raw Emporium import truth under `compatibility.unmappedSystemState.multiverseMarket`
    - the checked rows `71-74` overlap anchors that wider run to validated Emporium rows without claiming final player-facing row identity
  - `EsotericR1Trades` through `EsotericR9Trades`
  - `NecrumR1Trades` through `NecrumR9Trades`
    - these exact typed trade-counter ranges sit immediately after the dual-declared `InscryptionsDone` boundary on `SaveData`, so they belong in the same compatibility envelope but as separate bounded quarantine ranges rather than as an extension of the `IS*Level` span
  - `Mech1Unlocked` through `Mech2Unlocked`
    - this exact typed early-mech window continues immediately after `NecrumR9Trades` and stays bounded before the broader `Mech2*` continuation, so it is safe to preserve as a separate quarantined range under the same compatibility envelope
- `wrapper_or_export_only`
  - `InscryptionsDone`
    - `PlayerProfileData` already exposes `InscryptionsDone` as a flat wrapper/export field, so importing it from the wider `SaveData` block would widen the owner surface without adding a new bounded canonical Emporium import
- `verified_but_blocked`
  - `IS71Level` through `IS74Level`
    - these now have a checked ordered row-position mapping to validated rows `71-74`, but final row labels and canonical import targets are still not grounded
- `unresolved`
  - none

## Grounded conclusion

- The smallest checked mapping is ordered only: `IS71Level -> row 71`, `IS72Level -> row 72`, `IS73Level -> row 73`, and `IS74Level -> row 74`.
- The exact SaveData-owned `IS*Level` span that is safe to import as raw Emporium truth is `IS1Level` through `IS110Level`.
- That import-safe span is compatibility-only and should stay under `compatibility.unmappedSystemState.multiverseMarket`.
- In normalized PlayerProfile storage, that compatibility path should stay explicitly wrapped as raw/unmapped state and preserve the exact SaveData span under `compatibility.unmappedSystemState.multiverseMarket.importedState`.
- The adjacent `EsotericR*Trades`, `NecrumR*Trades`, and early-mech window belong in that same compatibility envelope only as separate bounded quarantine ranges after the dual-declared `InscryptionsDone` boundary.
- `InscryptionsDone` remains explicitly dual-declared and wrapper/export-only rather than part of the promoted `IS*Level` import span.
- Exact typed recovery currently sets hard boundaries on that compatibility span: no checked `IS0Level` below it and no checked `IS111Level` above it.
- Rows `71-74` remain ordered overlap only for identity work, not an import-admissible canonical subset.
- If stronger identity evidence does not appear, the canonical import-safe subset stays explicitly empty.

## Track implication

- This artifact is the bounded successor to the archived `spend-multiverse-save-model-recovery` lane.
- Keep row identity/remap work separate from this import-surface decision unless a future artifact grounds both in one checked slice.
