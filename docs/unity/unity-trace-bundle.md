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
- `tokenShopRowRemapBoundary`: [`data/token-shop-row-remap-boundary.json`](data/token-shop-row-remap-boundary.json)
  - Preserves one already-cleared TokenShop row bridge and the checked blocked ATU3 comparison notes used for solved-vs-blocked diffing.
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

## Trace graph

- Present typed edges: `8`
- Negative typed edges: `4`

### Proved joins

- `serialized-adjacency`: The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract. [direct]
  - `tokenShopExtract` at `$.fields` proves `ATU3Button path_id 15810`
- `declaration-neighborhood`: The metadata neighborhood keeps ATU3Button and the CellBoost declaration block in one raw declaration area. [contextual]
  - `metadata` at `metadata offset 662261` proves `CellBoostStartCost`
  - `metadata` at `metadata offset 662349` proves `ATU3Button`
- `family-action-cluster`: The cells-domain action lane preserves BuyCellBoost as the nearest named buy hook for the same family, but only as a generic cluster. [supporting]
  - `dailyTokeniumLaneProbe` at `$[0].matches[101].entry_context[28].value` proves `BuyCellBoost`
- `candidate-prefab-surface`: A separate diamond-special CellsBoost prefab candidate is preserved on committed probe surfaces. [direct]
  - `unityProbe` at `$.apk_results[7].keyword_hits.diamond[16]` proves `NewDiamondUPGPrefab.Specials.CellsBoost`
  - `lm244TargetedProbe` at `$[0].matches[23].byte_context[89].value` proves `NewDiamondUPGPrefab.Specials.CellsBoost`
- `candidate-title-surface`: The same detached diamond-special surface also preserves one final title candidate. [direct]
  - `unityProbe` at `$.apk_results[0].keyword_hits.diamond[45]` proves `>Diamond Upgrade 10 - CellsBoost`
- `candidate-prefab-surface`: Separate token-side prefab identities for cells-domain upgrades are preserved, but not joined back to the target shell. [direct]
  - `uabeaProbe` at `$.namedObjectHits[10371].name` proves `NewTokenUPGPrefab.T1.CellsPerChestBooster`
  - `unityProbe` at `$.apk_results[7].keyword_hits.token[38]` proves `NewTokenUPGPrefab.T5.UltimaCells`
- `candidate-title-surface`: The token-side candidate surface also preserves one detached title clue. [direct]
  - `unityProbe` at `$.apk_results[23].keyword_hits.token[25]` proves `Token Ultima: Cells`
- `generic-text-hook-cluster`: The generic TokenShop text hooks are preserved as a separate surface, but they do not close the ATU3 join. [supporting]
  - `unityProbe` at `$.apk_results[32].keyword_hits.token[6]` proves `SetAllTokenShopTexts`
  - `unityProbe` at `$.apk_results[32].keyword_hits.token[7]` proves `SetTokenTexts`

### Missing joins

- `exact-shell-to-action-hook`: No committed source proves one ATU3-specific direct buy or effect hook; the nearest named action surface stays the generic BuyCellBoost cluster. [negative]
  - `tokenShopRowRemapBoundary` at `$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]` records `No checked repo artifact in this lane currently preserves an ATU3-specific effect hook.`
  - `tokenShopRowRemapBoundary` at `$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]` records `No checked repo artifact in this lane currently preserves an ATU3-specific direct buy hook.`
- `exact-shell-to-prefab`: No committed source proves that the ATU3 shell or path id 15810 crosses directly into the detached diamond-special CellsBoost prefab candidate. [negative]
  - `tokenShopRowRemapBoundary` at `$.atu3CellsDisambiguationPass.testedSurfaces[1].missingJoin` records `The checked diamond-special surface still preserves a separate CellsBoost prefab and title lane, but it does not preserve any ATU3 shell, path id 15810, or exact bridge from the ATU3 owner block into that diamond-special identity surface.`
- `exact-shell-to-prefab`: No committed source proves that the ATU3 shell or path id 15810 crosses directly into one exact token-side prefab identity. [negative]
  - `tokenShopRowRemapBoundary` at `$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]` records `No checked repo artifact in this lane currently joins ATU3Button directly to one exact NewTokenUPGPrefab.* object identity.`
  - `tokenShopRowRemapBoundary` at `$.atu3CellsDisambiguationPass.testedSurfaces[2].missingJoin` records `The checked token-side surface still preserves separate token prefab and title clues for cells-domain upgrades, but it does not preserve any direct ATU3 shell join or one concrete object or title bridge back to path id 15810.`
- `exact-shell-to-title`: No committed source proves one exact ATU3 shell-to-final-title join across either the diamond-special or token-side title candidates. [negative]
  - `tokenShopRowRemapBoundary` at `$.atu3CellsDisambiguationPass.groundedConclusion` records `The bounded ATU3 cells-domain disambiguation pass stays negative. Across the exact BuyCellBoost, diamond-special CellsBoost, and token-side CellsPerChestBooster or Token Ultima: Cells search surfaces, the repo still preserves only separate cells-domain clusters rather than one checked object-or-title join back to ATU3Button path id 15810.`

## Solved vs blocked

- Baseline: `ATU1Button` path id `15839` stays cleared as the comparison shape.
- Blocked target: `ATU3Button` path id `15810` stays blocked.
- Shared present edge types: `serialized-adjacency`
- Baseline-only present edge types: `exact-shell-to-action-hook, exact-shell-to-prefab, supporting-effect-hook`
- Blocked missing edge types: `exact-shell-to-action-hook, exact-shell-to-prefab, exact-shell-to-title`

- Both rows preserve the direct serialized shell-to-owner-block adjacency.
- The solved ATU1 baseline also preserves one exact row-specific effect hook, one checked row-specific buy hook, and one exact prefab identity.
- The blocked ATU3 target stays missing the exact shell-to-action-hook, shell-to-prefab, and shell-to-title joins, so the cells-domain clues remain split instead of forming one checked bridge.

## Current loss

- The shell-side owner window survives only in the TokenShop extract, where ATU3Button path id 15810 stays adjacent to the CellBoost owner block.
- The metadata neighborhood still proves ATU3Button and CellBoost live in one raw declaration area, but it does not keep one checked prefab identity or final title in the same local container.
- The action lane survives only as a generic named buy cluster in the daily-tokenium lane probe, with StartCellBostHold, StopCellBostHold, and BuyCellBoost but no shell-side path id.
- Prefab identities survive as detached UABEA, targeted-string, or unity-probe hits, and final titles survive as separate unity-probe buckets, so the current extraction still loses the direct cross-surface join back to 15810.

## Conclusion

- The ATU3Button or 15810 trace stays negative. The trace workflow now preserves shell, metadata, action-hook, prefab, title, and text-hook surfaces in one checked bundle, but no committed source carries one exact ATU3Button or path id 15810 bridge together with one exact prefab identity or final player-facing title.
