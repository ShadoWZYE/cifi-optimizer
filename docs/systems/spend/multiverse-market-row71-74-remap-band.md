# Multiverse Market Row 71-74 Remap Band

This note records the smallest checked explanation for why rows `71-74` break the nearby same-number identity-binding pattern.

## Checked remap relationship

- Rows `71-74` keep same-number ordered/save and serialized-id field clues:
  - `IS71Level`, `IS71ID`, `BuyIS71`, `SetIS71CostText`
  - `IS72Level`, `IS72ID`, `BuyIS72`, `SetIS72CostText`
  - `IS73Level`, `IS73ID`, `BuyIS73`, `SetIS73CostText`
  - `IS74Level`, `IS74ID`, `BuyIS74`, `SetIS74CostText`
- The visible prefab shell diverges inside the same band:
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
- Repo-local probes also preserve earlier direct prefab shells for those remapped ids:
  - `ChrystosEmporiumUpgrade59`
  - `ChrystosEmporiumUpgrade60`
  - `ChrystosEmporiumUpgrade61`
  - `ChrystosEmporiumUpgrade62`

## Grounded conclusion

- Ordered row number and serialized-id field number stay aligned for rows `71-74`.
- Prefab numbering does not stay aligned in that band; prefab numbers `71-74` are reused as shells for serialized ids `59-62`.
- Nearby `TextHandlerMarkets` evidence only closes the same-number player-facing chain at rows `78` and `83`, not at rows `71-74`.
- This explains why the nearby same-number identity-binding pattern breaks in the `71-74` remap band.
- It does not recover player-facing identity for rows `71-74`, so the canonical import-safe subset stays empty.
