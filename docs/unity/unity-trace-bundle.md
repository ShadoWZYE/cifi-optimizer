# Unity Trace Bundle

- Target: `token-shop-atu3-cells`
- Label: TokenShop ATU3 cells split
- Anchors: `ATU3Button, 15810`
- Join goal: Recover one checked ATU3Button or path id 15810 bridge to one exact prefab identity or final player-facing title.

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Accepted anchor kinds: `class`, `method`, `string`, `path id`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.

## Source reads

- `metadata`: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat)
  - Preserves raw declaration-side string neighborhoods from global-metadata.dat.
- `tokenShopExtract`: [`data/token-shop-values.json`](data/token-shop-values.json)
  - Preserves exact owner-payload shell windows and path ids recovered from the TokenShop parser.
- `dailyTokeniumLaneProbe`: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json)
  - Preserves named action-hook neighborhoods from the committed targeted string probe outputs.
- `uabeaProbe`: [`data/uabea-probe-report.json`](data/uabea-probe-report.json)
  - Preserves UABEA or CifiAssetProbe object and type output such as named prefab identities.
- `unityProbe`: [`data/unity-probe-report.json`](data/unity-probe-report.json)
  - Preserves broader committed unity string buckets including title or text-hook surfaces.
- `lm244TargetedProbe`: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json)
  - Preserves targeted string-hit neighborhoods from the local lm244 follow-up probe lane.

## Shell window

- Shell field: `ATU3Button`
- Shell path id: `15810`
- Owner field block: `CellBoostStartCost, CellBoostAdditiveCost, CellBoostBonus, CellBoostMaxLevel, CellBoostFill`

## Surface traces

### Metadata neighborhood

- Search terms: `ATU3Button, CellBoost, BuyCellBoost, 15810`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (8 hits)
  - `BuyCellBoost` at metadata offset `659754`
  - `BuyCellBoostEnum` at metadata offset `661133`
  - `CellBoostStartCost` at metadata offset `662261`
  - `CellBoostAdditiveCost` at metadata offset `662280`
  - `CellBoostBonus` at metadata offset `662302`
  - `CellBoostMaxLevel` at metadata offset `662317`
  - `CellBoostFill` at metadata offset `662335`
  - `ATU3Button` at metadata offset `662349`

### Action hook lane

- Search terms: `StartCellBostHold, StopCellBostHold, BuyCellBoost, ATU3Button, 15810`
- Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (12 hits)
  - `StartCellBostHold` at `$[0].matches[101].entry_context[17].value`
  - `StopCellBostHold` at `$[0].matches[101].entry_context[20].value`
  - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value`
  - `StartCellBostHold` at `$[0].matches[101].byte_context[30].value`
  - `StopCellBostHold` at `$[0].matches[101].byte_context[33].value`
  - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value`
  - `StartCellBostHold` at `$[0].matches[102].entry_context[14].value`
  - `StopCellBostHold` at `$[0].matches[102].entry_context[17].value`
  - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value`
  - `StartCellBostHold` at `$[0].matches[102].byte_context[29].value`
  - `StopCellBostHold` at `$[0].matches[102].byte_context[32].value`
  - `BuyCellBoost` at `$[0].matches[102].byte_context[40].value`

### Diamond-special prefab or title lane

- Search terms: `NewDiamondUPGPrefab.Specials.CellsBoost, >Diamond Upgrade 10 - CellsBoost, ATU3Button, 15810`
- Source: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json) (1 hits)
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$[0].matches[23].byte_context[89].value`
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (3 hits)
  - `>Diamond Upgrade 10 - CellsBoost` at `$.apk_results[0].keyword_hits.diamond[45]`
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$.apk_results[7].keyword_hits.diamond[16]`
  - `>Diamond Upgrade 10 - CellsBoost` at `$.file_results[0].keyword_hits.diamond[45]`
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (1 hits)
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$.namedObjectHits[10352].name`

### Token prefab or title lane

- Search terms: `NewTokenUPGPrefab.T1.CellsPerChestBooster, NewTokenUPGPrefab.T5.UltimaCells, Token Ultima: Cells, ATU3Button, 15810`
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (2 hits)
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.namedObjectHits[10371].name`
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.namedObjectHits[10395].name`
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (5 hits)
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.apk_results[7].keyword_hits.token[4]`
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.apk_results[7].keyword_hits.token[38]`
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.apk_results[7].keyword_hits.ultima[2]`
  - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.token[25]`
  - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.ultima[5]`

### Generic TokenShop text-hook lane

- Search terms: `SetAllTokenShopTexts, SetTokenTexts, ATU3Button, 15810`
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (2 hits)
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]`
  - `SetTokenTexts` at `$.apk_results[32].keyword_hits.token[7]`

## Bridge check

- Result: `no checked object-or-title bridge recovered`
- No committed source keeps the shell-side anchor and one exact prefab or title in the same local container.

## Current loss

- The shell-side owner window survives only in the TokenShop extract, where ATU3Button path id 15810 stays adjacent to the CellBoost owner block.
- The metadata neighborhood still proves ATU3Button and CellBoost live in one raw declaration area, but it does not keep one checked prefab identity or final title in the same local container.
- The action lane survives only as a generic named buy cluster in the daily-tokenium lane probe, with StartCellBostHold, StopCellBostHold, and BuyCellBoost but no shell-side path id.
- Prefab identities survive as detached UABEA, targeted-string, or unity-probe hits, and final titles survive as separate unity-probe buckets, so the current extraction still loses the direct cross-surface join back to 15810.

## Conclusion

- The ATU3Button or 15810 trace stays negative. The trace workflow now preserves shell, metadata, action-hook, prefab, title, and text-hook surfaces in one checked bundle, but no committed source carries one exact ATU3Button or path id 15810 bridge together with one exact prefab identity or final player-facing title.
