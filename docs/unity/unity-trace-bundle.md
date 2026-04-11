# Unity Trace Bundle

- Target: `token-shop-atu3-cells`
- Label: TokenShop ATU3 cells split
- Anchors: `ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Join goal: Recover one checked ATU3Button or path id 15810 bridge to one exact prefab identity or final player-facing title.

## Planner resolution

- Selection mode: `query-planner`
- Matched family: `token-shop` (TokenShop)
- Run mode: `compare`
- Requested queries: `Cells`
- Requested anchors: `none`
- Expanded anchor kinds: `ATU3Button (class), 15810 (path id), Cells (class), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method), CellsBoost (class), CellsPerChestBooster (class), UltimaCells (class)`
- Decision note: Matched Cells to TokenShop through cells-domain and chose the bounded token-shop-atu3-vs-atu1 compare run because this query is better grounded as one checked solved-vs-blocked family trace.

## Execution anchors

- Typed execution anchors: `ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]`
- Direct example: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Planner example: `node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>`
- Accepted anchor kinds: `class, method, string, path id`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.
- Registry target: `token-shop-atu3-cells` from `token-shop` via [`data/unity-trace-target-registry.json`](data/unity-trace-target-registry.json)

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
  - Preserves UABEA or CifiAssetProbe object and type output such as named prefab identities or typed field tables.
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

- Search terms: `ATU3Button, CellBoost, BuyCellBoost, 15810, SetAllTokenShopTexts`
- Typed anchors: `ATU3Button (class), CellBoost (class), BuyCellBoost (method), 15810 (path id), SetAllTokenShopTexts (method)`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (7 hits)
  - Signal summary: 0 high-signal, 3 supporting, 4 incidental, 0 suppressed-noise
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Action hook lane

- Search terms: `StartCellBostHold, StopCellBostHold, BuyCellBoost, ATU3Button, 15810, CellBoost, SetAllTokenShopTexts`
- Typed anchors: `StartCellBostHold (method), StopCellBostHold (method), BuyCellBoost (method), ATU3Button (class), 15810 (path id), CellBoost (class), SetAllTokenShopTexts (method)`
- Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (16 hits)
  - Signal summary: 16 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `StartCellBostHold` at `$[0].matches[101].byte_context[30].value` [high-signal, score 100, exact-structured]
  - `StopCellBostHold` at `$[0].matches[101].byte_context[33].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value` [high-signal, score 100, exact-structured]
  - `StartCellBostHold` at `$[0].matches[101].entry_context[17].value` [high-signal, score 100, exact-structured]
  - `StopCellBostHold` at `$[0].matches[101].entry_context[20].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `StartCellBostHold` at `$[0].matches[102].byte_context[29].value` [high-signal, score 100, exact-structured]
  - `StopCellBostHold` at `$[0].matches[102].byte_context[32].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].byte_context[40].value` [high-signal, score 100, exact-structured]
  - `StartCellBostHold` at `$[0].matches[102].entry_context[14].value` [high-signal, score 100, exact-structured]
  - `StopCellBostHold` at `$[0].matches[102].entry_context[17].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].byte_context[118].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].entry_context[16].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[313].entry_context[4].value` [high-signal, score 100, exact-structured]

### Diamond-special prefab or title lane

- Search terms: `NewDiamondUPGPrefab.Specials.CellsBoost, >Diamond Upgrade 10 - CellsBoost, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `NewDiamondUPGPrefab.Specials.CellsBoost (string), >Diamond Upgrade 10 - CellsBoost (string), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `SetAllTokenShopTexts` at `$[0].matches[225].byte_context[48].value` [supporting, score 95, exact-structured]
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$[0].matches[23].byte_context[89].value` [supporting, score 95, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (4 hits)
  - Signal summary: 0 high-signal, 4 supporting, 0 incidental, 0 suppressed-noise
  - `>Diamond Upgrade 10 - CellsBoost` at `$.apk_results[0].keyword_hits.diamond[45]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$.apk_results[7].keyword_hits.diamond[16]` [supporting, score 95, exact-structured]
  - `>Diamond Upgrade 10 - CellsBoost` at `$.file_results[0].keyword_hits.diamond[45]` [supporting, score 95, exact-structured]
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (1 hits)
  - Signal summary: 1 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$.namedObjectHits[10352].name` [high-signal, score 100, exact-structured]

### Token prefab or title lane

- Search terms: `NewTokenUPGPrefab.T1.CellsPerChestBooster, NewTokenUPGPrefab.T5.UltimaCells, Token Ultima: Cells, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `NewTokenUPGPrefab.T1.CellsPerChestBooster (string), NewTokenUPGPrefab.T5.UltimaCells (string), Token Ultima: Cells (string), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (2 hits)
  - Signal summary: 2 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.namedObjectHits[10371].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.namedObjectHits[10395].name` [high-signal, score 100, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (6 hits)
  - Signal summary: 0 high-signal, 6 supporting, 0 incidental, 0 suppressed-noise
  - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.token[25]` [supporting, score 95, exact-structured]
  - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.ultima[5]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.apk_results[7].keyword_hits.token[38]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.apk_results[7].keyword_hits.token[4]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.apk_results[7].keyword_hits.ultima[2]` [supporting, score 95, exact-structured]

### Generic TokenShop text-hook lane

- Search terms: `SetAllTokenShopTexts, SetTokenTexts, ATU3Button, 15810, CellBoost, BuyCellBoost`
- Typed anchors: `SetAllTokenShopTexts (method), SetTokenTexts (method), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method)`
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `SetTokenTexts` at `$.apk_results[32].keyword_hits.token[7]` [supporting, score 95, exact-structured]

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
  - `dailyTokeniumLaneProbe` at `$[0].matches[101].byte_context[41].value` proves `BuyCellBoost`
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

## Decision summary

- Verdict: `keep researching`
- Summary: The trace still preserves only split cells-domain clues, so keep researching and do not wire or quarantine product behavior from this join.
- Proved edges: `8`
- Negative edges: `4`
- Baseline gap: `exact-shell-to-action-hook, exact-shell-to-prefab, exact-shell-to-title`

## Current loss

- The shell-side owner window survives only in the TokenShop extract, where ATU3Button path id 15810 stays adjacent to the CellBoost owner block.
- The metadata neighborhood still proves ATU3Button and CellBoost live in one raw declaration area, but it does not keep one checked prefab identity or final title in the same local container.
- The action lane survives only as a generic named buy cluster in the daily-tokenium lane probe, with StartCellBostHold, StopCellBostHold, and BuyCellBoost but no shell-side path id.
- Prefab identities survive as detached UABEA, targeted-string, or unity-probe hits, and final titles survive as separate unity-probe buckets, so the current extraction still loses the direct cross-surface join back to 15810.

## Conclusion

- The ATU3Button or 15810 trace stays negative. The trace workflow now preserves shell, metadata, action-hook, prefab, title, and text-hook surfaces in one checked bundle, but no committed source carries one exact ATU3Button or path id 15810 bridge together with one exact prefab identity or final player-facing title.
