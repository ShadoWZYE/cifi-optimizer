# Multiverse Market Nearby Identity-Binding Pattern

This note records the smallest checked positive pattern for how nearby inscription rows become player-facing labels, without reopening the settled negative result for rows `71-74`.

## Checked positive bindings

- Row `78`
  - ordered/save field: `IS78Level`
  - serialized-id field: `IS78ID`
  - buy hook: `BuyIS78`
  - text owner: `TextHandlerMarkets`
  - prefab: `ChrystosEmporiumUpgrade78-ID78`
  - player-facing label: `Inscryption 78: Ouroboros Orbs`
- Row `83`
  - ordered/save field: `IS83Level`
  - serialized-id field: `IS83ID`
  - buy hook: `BuyIS83`
  - text owner: `TextHandlerMarkets`
  - prefab: `ChrystosEmporiumUpgrade83-ID83`
  - player-facing label: `Inscryption 83: Fast-Loop ML`

## Recovered pattern

- The nearest checked positive identity binding is a same-number join:
  - `ISNLevel`
  - `ISNID`
  - `BuyISN`
  - `ChrystosEmporiumUpgradeN-IDN`
  - `Inscryption N: ...`
- Repo-local evidence ties those pieces together in the `TextHandlerMarkets` neighborhood, including the checked source-path anchor `9\Assets\Scripts\Text\Text Ouroboros\TextHandlerMarkets.cs`.

## What this does not prove

- This pattern does not promote rows `71-74` to player-facing identity.
- Rows `71-74` still stop at ordered mapping plus UI access hooks:
  - `IS71Level` -> row `71`
  - `IS72Level` -> row `72`
  - `IS73Level` -> row `73`
  - `IS74Level` -> row `74`
- The direct prefab join is broken there because the visible shell is remapped:
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
- No checked player-facing string currently names `Inscryption 71`, `Inscryption 72`, `Inscryption 73`, or `Inscryption 74`.

Current grounded conclusion:

- ordered row mapping and player-facing identity binding stay separate
- rows `78` and `83` show the nearest checked positive binding pattern
- rows `71-74` remain unresolved for player-facing identity
- the canonical import-safe subset stays empty
