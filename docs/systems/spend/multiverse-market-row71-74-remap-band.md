# Multiverse Market Row 71-74 Remap Band

This note records the smallest checked explanation for why rows `71-74` break the nearby same-number prefab pattern without replacing the live player-facing row numbers.

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

## Checked live UI comparison

- The supplied screenshots show the neighboring live UI rows directly:
  - `INSCRYPTION #68`
  - `INSCRYPTION #71`
  - `INSCRYPTION #72`
  - `INSCRYPTION #73`
  - `INSCRYPTION #74`
  - `INSCRYPTION #75`
- The visible order still follows player-facing rows `71-74`, not a remapped `59-62` presentation band.
- The displayed bonus texts for rows `71-74` are row-local:
  - row `71`: `KDIOS RESEARCH EQUIPMENT BONUS`
  - row `72`: `TICKS PER TICK-LOOP REDUCTION`
  - row `73`: `LEVEL POINTS (LP) GAINED`
  - row `74`: `LOOP REQUIREMENT REDUCTION`

## Grounded conclusion

- Ordered row number and serialized-id field number stay aligned for rows `71-74`.
- Prefab numbering does not stay aligned in that band; prefab numbers `71-74` are reused as shells for serialized ids `59-62`.
- The supplied live UI screenshots falsify that shell swap as the player-facing row-identity model for rows `71-74`.
- The `59-62` relation therefore stays bounded as internal shell metadata only.
- This does not widen the narrower player-facing text/effect lane; the root import and planner gate is already clear.
