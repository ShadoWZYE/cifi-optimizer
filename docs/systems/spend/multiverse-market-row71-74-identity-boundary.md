# Multiverse Market Row 71-74 Identity Boundary

This note records the narrow player-facing identity boundary for validated rows `71-74`.

## Settled ordered mapping

- keep fixed:
  - `IS71Level` -> ordered row `71`
  - `IS72Level` -> ordered row `72`
  - `IS73Level` -> ordered row `73`
  - `IS74Level` -> ordered row `74`

This document does not reopen that ordered mapping.

## Checked player-facing identity boundary

- row-order evidence that is real but insufficient for final identity:
  - `IS71ID` through `IS74ID`
  - `BuyIS71` through `BuyIS74`
  - `SetIS71CostText` through `SetIS74CostText`
  - validated serialized rows `71` through `74`
- prefab-number shell that cannot be reused as row identity:
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
  - these prove the visible `71-74` prefab names are remapped to serialized ids `59-62`, not to validated rows `71-74`
- nearest checked player-facing label anchors:
  - `Inscryption 78: Ouroboros Orbs`
  - `Inscryption 83: Fast-Loop ML`
  - these are outside the target `71-74` slice and therefore do not identify rows `71-74`

## Grounded conclusion

- A stable row-identity chain is now grounded for rows `71-74`:
  - ordered mapping is checked for rows `71-74`
  - same-number `IS71ID` through `IS74ID` is also checked for rows `71-74`
  - the remapped prefab band `ChrystosEmporiumUpgrade71-ID59` through `ChrystosEmporiumUpgrade74-ID62` stays preserved only as shell-local anomaly metadata
- Ordered row identity and prefab-shell numbering must still stay separated:
  - the root save-owner runtime gate now clears through the same-number row-owner chain
  - the broken prefab suffix band does not rewrite that grounded row identity
- What is still unresolved here is narrower:
  - the exact game-side player-facing effect or label text source for rows `71-74`
  - not the root row identity or root canonical import gate
