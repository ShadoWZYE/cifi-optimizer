# Multiverse Market Nearby Identity-Binding Pattern

This note records the smallest checked partial repo-local control pattern for how nearby inscription rows sit beside text-side anchors, without treating those anchors as completed live effect-text bindings.

## Checked partial controls

- Row `78`
  - ordered/save field: `IS78Level`
  - serialized-id field: `IS78ID`
  - buy hook: `BuyIS78`
  - text owner: `TextHandlerMarkets`
  - prefab: `ChrystosEmporiumUpgrade78-ID78`
  - sparse Unity anchor: `Inscryption 78: Ouroboros Orbs`
- Row `83`
  - ordered/save field: `IS83Level`
  - serialized-id field: `IS83ID`
  - buy hook: `BuyIS83`
  - text owner: `TextHandlerMarkets`
  - prefab: `ChrystosEmporiumUpgrade83-ID83`
  - sparse Unity anchor: `Inscryption 83: Fast-Loop ML`

## Recovered pattern

- The nearest checked partial text-adjacent control is a same-number join:
  - `ISNLevel`
  - `ISNID`
  - `BuyISN`
  - `ChrystosEmporiumUpgradeN-IDN`
  - `Inscryption N: ...`
- Repo-local evidence ties those pieces together in the `TextHandlerMarkets` neighborhood, including the checked source-path anchor `9\Assets\Scripts\Text\Text Ouroboros\TextHandlerMarkets.cs`.
- The new row `78` screenshot mismatch shows this is not a completed live effect-text binding:
  - sparse anchor: `Inscryption 78: Ouroboros Orbs`
  - live screenshot text: `OUROBOROS POINTS GAINED`

## What this does not prove

- This pattern is not the source that recovers the missing player-facing text provenance for rows `69-74`.
- Rows `69-74` still stop at ordered mapping plus same-number `ISNID` fields and UI access hooks:
  - `IS69Level` -> row `69`, with `IS69ID`, `BuyIS69`, `SetIS69CostText`
  - `IS70Level` -> row `70`, with `IS70ID`, `BuyIS70`, `SetIS70CostText`
  - `IS71Level` -> row `71`, with `IS71ID`, `BuyIS71`, `SetIS71CostText`
  - `IS72Level` -> row `72`, with `IS72ID`, `BuyIS72`, `SetIS72CostText`
  - `IS73Level` -> row `73`, with `IS73ID`, `BuyIS73`, `SetIS73CostText`
  - `IS74Level` -> row `74`, with `IS74ID`, `BuyIS74`, `SetIS74CostText`
- The direct prefab join is broken there because the visible shell is remapped:
  - `ChrystosEmporiumUpgrade69-ID57`
  - `ChrystosEmporiumUpgrade70-ID58`
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
- The smallest recovered explanation is a remap band:
  - ordered row number and `ISNID` stay on `69-74`
  - prefab numbers `69-74` are reused as shells for serialized ids `57-62`
- No checked repo-local player-facing string currently names `Inscryption 69`, `Inscryption 70`, `Inscryption 71`, `Inscryption 72`, `Inscryption 73`, or `Inscryption 74`.

Current grounded conclusion:

- ordered row mapping, sparse Unity anchors, and live effect text stay separate
- rows `78` and `83` now only show the nearest checked partial text-adjacent controls
- rows `69-74` now have their ordered identity carried by the same-number chain, but not their repo-local player-facing text provenance via this same-number binding pattern
- the root import gate is already clear; this nearby same-number pattern still does not close the narrower player-facing text-provenance lane
