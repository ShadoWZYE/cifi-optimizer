# TokenShop Remap Join Probe

This probe preserves unresolved TokenShop remap join attempts in one generated artifact family.

## Source reads

- `tokenShopExtract`: [`data/token-shop-values.json`](data/token-shop-values.json)
  - Preserves the shell-local TokenShop owner window and exact shell path ids from the raw serialized extract.
- `dailyTokeniumLaneProbe`: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json)
  - Preserves named buy-hook neighborhoods such as BuyCellBoost with nearby start or stop hold actions.
- `uabeaProbe`: [`data/uabea-probe-report.json`](data/uabea-probe-report.json)
  - Preserves direct type or object-name hits such as prefab identities without pretending they already join back to one shell.
- `unityProbe`: [`data/unity-probe-report.json`](data/unity-probe-report.json)
  - Preserves level0-side title, text-hook, and prefab string surfaces that can be compared against shell-local owners.
- `lm244TargetedProbe`: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json)
  - Preserves targeted level0 string-hit neighborhoods for specific unresolved TokenShop follow-up terms.

## Probe contract

- Command: `node scripts/unity/run_probe.mjs token-shop:remap-joins`
- Purpose: Preserve unresolved TokenShop remap shell neighborhoods and their split action, prefab, and title surfaces in one repeatable artifact family before any boundary promotion.
- Promotion rule: only advance a remap boundary when one committed artifact preserves an exact shell id together with one exact prefab identity or final title in the same local container.

## ATU3 cells-domain neighborhood

- Join goal: Recover one checked ATU3Button or path id 15810 bridge to one exact prefab identity or final player-facing title.
- Shell source: [`data/token-shop-values.json`](data/token-shop-values.json)
- Shell field: `ATU3Button`
- Shell path id: `15810`
- Owner field block: `CellBoostStartCost, CellBoostAdditiveCost, CellBoostBonus, CellBoostMaxLevel, CellBoostFill`
- Shell window:
  - `CellBoostBonus` value `1`
  - `CellBoostMaxLevel` value `60`
  - `CellBoostFill` path `294990`
  - `ATU3Button` path `15810`
  - `ATU3MaxOverlay` path `49488`
  - `ModBoostStartCost` value `10.0`
  - `ModBoostAdditiveCost` value `2.0`

### Preserved split surfaces

- `Action hook lane`
  - Search terms: `StartCellBostHold, StopCellBostHold, BuyCellBoost`
  - Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (9 hits)
    - `StartCellBostHold` at `$[0].matches[101].entry_context[17].value`
    - `StopCellBostHold` at `$[0].matches[101].entry_context[20].value`
    - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value`
    - `StartCellBostHold` at `$[0].matches[101].byte_context[30].value`
    - `StopCellBostHold` at `$[0].matches[101].byte_context[33].value`
    - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value`
    - `StartCellBostHold` at `$[0].matches[102].entry_context[14].value`
    - `StopCellBostHold` at `$[0].matches[102].entry_context[17].value`
    - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value`
- `Diamond-special prefab or title lane`
  - Search terms: `NewDiamondUPGPrefab.Specials.CellsBoost, >Diamond Upgrade 10 - CellsBoost`
  - Source: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json) (1 hits)
    - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$[0].matches[23].byte_context[89].value`
  - Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (3 hits)
    - `>Diamond Upgrade 10 - CellsBoost` at `$.apk_results[0].keyword_hits.diamond[45]`
    - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$.apk_results[7].keyword_hits.diamond[16]`
    - `>Diamond Upgrade 10 - CellsBoost` at `$.file_results[0].keyword_hits.diamond[45]`
  - Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (1 hits)
    - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$.namedObjectHits[10352].name`
- `Token prefab or title lane`
  - Search terms: `NewTokenUPGPrefab.T1.CellsPerChestBooster, NewTokenUPGPrefab.T5.UltimaCells, Token Ultima: Cells`
  - Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (2 hits)
    - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.namedObjectHits[10371].name`
    - `NewTokenUPGPrefab.T5.UltimaCells` at `$.namedObjectHits[10395].name`
  - Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (5 hits)
    - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.apk_results[7].keyword_hits.token[4]`
    - `NewTokenUPGPrefab.T5.UltimaCells` at `$.apk_results[7].keyword_hits.token[38]`
    - `NewTokenUPGPrefab.T5.UltimaCells` at `$.apk_results[7].keyword_hits.ultima[2]`
    - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.token[25]`
    - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.ultima[5]`
- `Generic TokenShop text-hook lane`
  - Search terms: `SetAllTokenShopTexts, SetTokenTexts`
  - Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (2 hits)
    - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]`
    - `SetTokenTexts` at `$.apk_results[32].keyword_hits.token[7]`

### Bridge check

- Result: `no checked object-or-title bridge recovered`
- No source currently keeps the shell-side identity and one exact prefab or title candidate in the same local container.

### Current loss

- The shell-side owner window survives only in the TokenShop extract, where ATU3Button path id 15810 is still adjacent to the CellBoost owner block.
- The action lane survives only as a generic named buy cluster in the daily-tokenium lane probe, with StartCellBostHold, StopCellBostHold, and BuyCellBoost but no ATU3 shell reference.
- Prefab identities survive as detached probe hits in lm244-targeted or UABEA outputs, not as one checked object that still carries the ATU3 shell or path id.
- Final titles and generic text hooks survive as separate unity-probe string buckets, not as one checked title object that still carries the shell-side owner identity.

### Conclusion

- The upgraded ATU3 remap join probe stays negative. It now preserves the shell owner window, the BuyCellBoost action cluster, the diamond-special CellsBoost lane, the token-side CellsPerChestBooster or Token Ultima: Cells lane, and the generic TokenShop text-hook lane in one artifact family, but no committed source carries one exact ATU3Button or path id 15810 bridge together with one exact prefab identity or final player-facing title.
