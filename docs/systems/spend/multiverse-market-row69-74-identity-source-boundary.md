# Multiverse Market Row 69-74 Identity-Source Boundary

This note now records the checked player-facing text-provenance boundary for the broken prefab band at rows `69-74`.

## Settled row facts carried into this boundary

- `ISNLevel`, `ISNID`, and `BuyISN` stay same-number through the checked `69-110` run.
- Prefab numbering is stable through row `68`, broken at rows `69-74`, and resumes same-number at row `75`.
- The broken prefab shells are:
  - `ChrystosEmporiumUpgrade69-ID57`
  - `ChrystosEmporiumUpgrade70-ID58`
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`

## Checked repo-local evidence that stays structural only

- Text/localization coverage:
  - `TextHandlerMarkets`
  - `SetIS69CostText`
  - `SetIS70CostText`
  - `SetIS71CostText`
  - `SetIS72CostText`
  - `SetIS73CostText`
  - `SetIS74CostText`
- Adjacent market-view action shell:
  - `BuyIS69`
  - `BuyIS70`
  - `BuyIS71`
  - `BuyIS72`
  - `BuyIS73`
  - `BuyIS74`
- Alternate metadata joins:
  - `THMarkets: TextHandlerMarkets`
  - `InscryptionsList: List<GameObject>`
- Checked negative repo-local boundary:
  - the checked repo-local probe artifacts do not recover direct player-facing strings `Inscryption 69` through `Inscryption 74`
  - earlier direct prefab shells `ChrystosEmporiumUpgrade57` through `ChrystosEmporiumUpgrade62` are preserved repo-locally, but still do not recover direct player-facing strings `Inscryption 57` through `Inscryption 62`
  - `tmp-multiverse-row-text-probe.json` stays negative-only:
    - `SetIS69BaseBonusText` stays inside a bonus or effect-presentation family
    - `ClearISObjects`, `ClearISMaxLevelObjects`, `SetISMaxLevelObjects`, `THMarkets`, and `InscryptionsList` stay structural UI-shell hooks
    - no row-title, localization-key, `StringId`, `Label`, `Name`, or direct player-facing `Inscryption 69` through `Inscryption 74` anchor is recovered repo-locally

## Checked live UI evidence

- The supplied in-game screenshots show the player-facing row labels directly:
  - row `68`: `INSCRYPTION #68` with `FREE KDIOS CREW`
  - row `69`: `INSCRYPTION #69` with `CELLS GAINED`
  - row `70`: `INSCRYPTION #70` with `SCIENTISTS COST REDUCTION`
  - row `71`: `INSCRYPTION #71` with `KDIOS RESEARCH EQUIPMENT BONUS`
  - row `72`: `INSCRYPTION #72` with `TICKS PER TICK-LOOP REDUCTION`
  - row `73`: `INSCRYPTION #73` with `LEVEL POINTS (LP) GAINED`
  - row `74`: `INSCRYPTION #74` with `LOOP REQUIREMENT REDUCTION`
  - row `75`: `INSCRYPTION #75` with `TO MAX LV OF ALL ACCUMULATIVE LEVEL GROWTH MODULES (LOOP MODS)`
- This matters because the visible neighboring order stays `68 -> 69 -> 70 -> 71 -> 72 -> 73 -> 74 -> 75`.
- That live UI ordering and labeling does not reproduce a player-facing `57-62` row band.

Current grounded conclusion:

- save numbering, serialized-id numbering, prefab numbering, and player-facing text provenance must stay separated
- row identity for rows `69-74` is already carried by the same-number chain `SaveData.ISNLevel -> ISNID -> BuyISN/SetISNCostText -> row payload ID/Level/ISObject`
- the supplied live UI screenshots validate that row identity directly, but do not by themselves become canonical text provenance
- remapped serialized ids `57-62` still fail to recover a checked player-facing text or label source, so following the prefab remap does not narrow the missing text source any further
- the `69-74 -> 57-62` relation is therefore bounded as internal shell metadata only, not as the live player-facing remap model
- the actual missing source class is the game-side player-facing effect or label text path for Emporium rows, likely in the `TextHandlerMarkets` / bonus-text / localization layer beyond the recovered cost hooks and row payload carriers
- canonical Emporium import remains blocked for separate reasons, so the canonical import-safe subset stays empty
