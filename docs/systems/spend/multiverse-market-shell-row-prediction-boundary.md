# Multiverse Market Shell-Row Prediction Boundary

This note records which recovered Multiverse Market layer actually predicts live displayed row identity, and where shell metadata diverges from the displayed Emporium rows.

## Rows checked in this pass

- live-output validation targets from the supplied screenshots:
  - rows `69-74`
  - visible neighbors `68` and `75`
- same-number control row from repo-local evidence:
  - row `78`

## Strongest recoverable chain

- PlayerProfile-side runtime shell:
  - `PlayerProfileHandler.get_Market -> MultiverseMarket`
- declaring saved owner:
  - `SaveData.ISNLevel`
- ordered same-number row carriers:
  - `ISNID`
  - `BuyISN`
  - `SetISNCostText`
- nested row payload carriers:
  - `MultiverseMarket|Inscryption`
  - `MultiverseMarket|InscryptionTupleObject`
  - `ID`
  - `Level`
  - `ISObject`
- shell or object metadata:
  - `ChrystosEmporiumUpgradeN-ID...`

## What predicts the live row number

- For rows `69-74`, the same-number owner and carrier chain predicts the displayed row number:
  - `SaveData.IS69Level` through `SaveData.IS74Level`
  - `IS69ID` through `IS74ID`
  - `BuyIS69` through `BuyIS74`
  - `SetIS69CostText` through `SetIS74CostText`
- The validated row payloads also keep that same numbering:
  - `inscription_id 69`
  - `inscription_id 70`
  - `inscription_id 71`
  - `inscription_id 72`
  - `inscription_id 73`
  - `inscription_id 74`
- The supplied screenshots then validate that live UI still displays:
  - `INSCRYPTION #69`
  - `INSCRYPTION #70`
  - `INSCRYPTION #71`
  - `INSCRYPTION #72`
  - `INSCRYPTION #73`
  - `INSCRYPTION #74`

## What does not predict the live row number

- The prefab shell layer fails in the broken band:
  - `ChrystosEmporiumUpgrade69-ID57`
  - `ChrystosEmporiumUpgrade70-ID58`
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
- Those names preserve a real shell anomaly, but they do not match the displayed row numbers in the supplied screenshots.
- Control row `78` shows the non-divergent case:
  - `IS78Level`
  - `IS78ID`
  - `BuyIS78`
  - `ChrystosEmporiumUpgrade78-ID78`
  - `Inscryption 78: Ouroboros Orbs`

## What predicts live bonus output

- The validated row payload values predict the live bonus magnitudes for rows `69-74`:
  - row `69`: bonus value `5000000136282112.0` aligns with `x5.00qa`
  - row `70`: bonus value `10000000000.0` aligns with `/10.00b`
  - row `71`: bonus value `0.019999999552965164` aligns with `+0.02x`
  - row `72`: bonus value `0.05999999865889549` aligns with `-0.06`
  - row `73`: bonus value `10.0` aligns with `+10`
  - row `74`: bonus value `40.0` aligns with `-40`
- The remapped shell ids do not explain those live magnitudes where comparison is possible:
  - id `57` carries `0.05`, not row `69`'s `5qa`
  - id `58` carries `5`, not row `70`'s `10b`
  - id `59` carries `5`, not row `71`'s `0.02`

## What is still unresolved

- For rows `69-74`, the repo still does not recover the game-side player-facing bonus-text phrases from shell or payload data alone.
- The screenshots are only validation targets for those phrases in this lane, not canonical row-label promotion.
- The `57-62` relation is therefore not pure noise, but it is only shell-local anomaly metadata rather than the recovered structure that links displayed row identity through to `SaveData`.
- The next missing source class is the final `TextHandlerMarkets`-side binding step that resolves the recovered `SetAllBaseBonusTexts` / `SetISNBaseBonusText` family into concrete player-facing effect text or localization payloads beyond the recovered `SetISNCostText` hooks and row payload carriers.

Current grounded conclusion:

- displayed row number follows the ordered same-number `SaveData` and row-carrier chain, not the prefab shell suffix
- displayed bonus magnitude follows the validated row payload keyed by `inscription_id`, not the remapped shell ids
- the shell layer diverges specifically at the `ISObject` or prefab-object boundary in rows `69-74`
- root MultiverseMarket import and planner-safe gating now clear through the DB-backed save-owner boundary model
- `InscryptionsDone` still stays wrapper-only on the narrower child text/effect explanation lane
