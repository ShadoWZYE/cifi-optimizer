# Unity Trace Bundle

- Target: `token-shop-family-structure`
- Label: TokenShop family structure audit
- Anchors: `ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU3Button, ATU24Button, SetAllTokenShopTexts, 15810, CellBoost, BuyCellBoost`
- Join goal: Audit the whole TokenShop ATU shell family for repeated proved joins and repeated missing joins across shell ids, bridge-proxy hooks, prefab identities, and title or text surfaces without promoting any new remaps.

## Planner resolution

- Selection mode: `explicit-target`
- Matched family: `token-shop` (TokenShop)
- Run mode: `trace`
- Requested queries: `none`
- Requested anchors: `none`
- Expanded anchor kinds: `ATU1Button (class), ATU2Button (class), ATU4Button (class), ATU5Button (class), ATU6Button (class), ATU3Button (class), ATU24Button (class), SetAllTokenShopTexts (method), 15810 (path id), CellBoost (class), BuyCellBoost (method)`
- Decision note: Used explicit target token-shop-family-structure in the TokenShop family and kept family-aware anchor expansion so the backend records the same checked synonym surface deterministically.

## Execution anchors

- Typed execution anchors: `ATU1Button (class), ATU2Button (class), ATU4Button (class), ATU5Button (class), ATU6Button (class), ATU3Button (class), ATU24Button (class), SetAllTokenShopTexts (method), 15810 (path id), CellBoost (class), BuyCellBoost (method)`

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]`
- Direct example: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Planner example: `node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>`
- Accepted anchor kinds: `class, method, string, path id`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.
- Registry target: `token-shop-family-structure` from `token-shop` via [`data/unity-trace-target-registry.json`](data/unity-trace-target-registry.json)

## Source reads

- `metadata`: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat)
  - Preserves raw declaration-side string neighborhoods from global-metadata.dat.
- `tokenShopExtract`: [`data/token-shop-values.json`](data/token-shop-values.json)
  - Preserves exact owner-payload shell windows and path ids recovered from the TokenShop parser.
- `tokenShopRowRemapBoundary`: [`data/token-shop-row-remap-boundary.json`](data/token-shop-row-remap-boundary.json)
  - Preserves one already-cleared TokenShop row bridge and the checked blocked ATU3 comparison notes used for solved-vs-blocked diffing.
- `tokenShopLateAtuBoundary`: [`data/token-shop-late-atu-boundary.json`](data/token-shop-late-atu-boundary.json)
  - Preserves the checked late ATU24-ATU28 shell neighborhood and its bounded negative title or prefab join result.
- `dailyTokeniumLaneProbe`: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json)
  - Preserves named action-hook neighborhoods from the committed targeted string probe outputs.
- `dailyTokeniumOwnerProbe`: [`data/daily-tokenium-owner-probe.json`](data/daily-tokenium-owner-probe.json)
  - Preserves committed owner-side TokenShop title and support-text neighborhoods from the local level0 probe lane.
- `uabeaProbe`: [`data/uabea-probe-report.json`](data/uabea-probe-report.json)
  - Preserves UABEA or CifiAssetProbe object and type output such as named prefab identities or typed field tables.
- `unityProbe`: [`data/unity-probe-report.json`](data/unity-probe-report.json)
  - Preserves broader committed unity string buckets including title or text-hook surfaces.
- `lm244TargetedProbe`: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json)
  - Preserves targeted string-hit neighborhoods from the local lm244 follow-up probe lane.

## Shell window

- Shell field: `ATU1Button through ATU28Button`
- Shell path id: `family-range`
- Owner field block: `TokenBoost / DiamondBoost / ModBoost / MK1TokenBoost / MK2TokenBoost solved-row windows, ATU3 cells-domain split window, ATU24Button through ATU28Button late shell neighborhood`

## Surface traces

### Family shell range

- Search terms: `ATU1Button, ATU2Button, ATU3Button, ATU4Button, ATU5Button, ATU6Button, ATU24Button, ATU28Button, SetAllTokenShopTexts, 15810, CellBoost, BuyCellBoost`
- Typed anchors: `ATU1Button (class), ATU2Button (class), ATU3Button (class), ATU4Button (class), ATU5Button (class), ATU6Button (class), ATU24Button (class), ATU28Button (class), SetAllTokenShopTexts (method), 15810 (path id), CellBoost (class), BuyCellBoost (method)`
- Source: [`data/token-shop-values.json`](data/token-shop-values.json) (9 hits)
  - Signal summary: 9 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `15810` at `$.fields[26].path_id` [high-signal, score 125, exact-structured]
  - `ATU1Button` at `$.fields[12].field` [high-signal, score 110, exact-structured]
  - `ATU24Button` at `$.fields[193].field` [high-signal, score 110, exact-structured]
  - `ATU2Button` at `$.fields[19].field` [high-signal, score 110, exact-structured]
  - `ATU28Button` at `$.fields[221].field` [high-signal, score 110, exact-structured]
  - `ATU3Button` at `$.fields[26].field` [high-signal, score 110, exact-structured]
  - `ATU4Button` at `$.fields[33].field` [high-signal, score 110, exact-structured]
  - `ATU5Button` at `$.fields[42].field` [high-signal, score 110, exact-structured]
  - `ATU6Button` at `$.fields[51].field` [high-signal, score 110, exact-structured]
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (14 hits)
  - Signal summary: 0 high-signal, 10 supporting, 4 incidental, 0 suppressed-noise
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `ATU1Button` at metadata offset `662106` [supporting, score 90, exact-string]
  - `ATU2Button` at metadata offset `662235` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `ATU4Button` at metadata offset `662458` [supporting, score 90, exact-string]
  - `ATU5Button` at metadata offset `662620` [supporting, score 90, exact-string]
  - `ATU6Button` at metadata offset `662782` [supporting, score 90, exact-string]
  - `ATU24Button` at metadata offset `665162` [supporting, score 90, exact-string]
  - `ATU28Button` at metadata offset `665546` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Bridge-proxy lane

- Search terms: `BuyTokenBoost, ATU2DiamondsBonus, BuyModBoost, BuyMK1TokenBoost, BuyMK2TokenBoost, BuyCellBoost, BuyATU24, ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU3Button, ATU24Button, SetAllTokenShopTexts, 15810, CellBoost`
- Typed anchors: `BuyTokenBoost (method), ATU2DiamondsBonus (class), BuyModBoost (method), BuyMK1TokenBoost (method), BuyMK2TokenBoost (method), BuyCellBoost (method), BuyATU24 (method), ATU1Button (class), ATU2Button (class), ATU4Button (class), ATU5Button (class), ATU6Button (class), ATU3Button (class), ATU24Button (class), SetAllTokenShopTexts (method), 15810 (path id), CellBoost (class)`
- Source: [`data/token-shop-row-remap-boundary.json`](data/token-shop-row-remap-boundary.json) (28 hits)
  - Signal summary: 2 high-signal, 26 supporting, 0 incidental, 0 suppressed-noise
  - `15810` at `$.adjacentFollowUp.blockedAdjacentShell.shellPathId` [high-signal, score 110, exact-structured]
  - `15810` at `$.atu3CellsDisambiguationPass.shellPathId` [high-signal, score 110, exact-structured]
  - `BuyCellBoost` at `$.adjacentFollowUp.blockedAdjacentShell.nearestNamedActionHook` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.adjacentFollowUp.blockedAdjacentShell.shellField` [supporting, score 95, exact-structured]
  - `ATU1Button` at `$.adjacentFollowUp.recoveredAdditionalBridge.shellField` [supporting, score 95, exact-structured]
  - `BuyTokenBoost` at `$.adjacentFollowUp.recoveredAdditionalBridge.supportingActionHook` [supporting, score 95, exact-structured]
  - `ATU1Button` at `$.adjacentFollowUp.testedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.adjacentFollowUp.testedNeighbors[1]` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.atu3CellsDisambiguationPass.shellField` [supporting, score 95, exact-structured]
  - `BuyCellBoost` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].preservedNeighbors[2]` [supporting, score 95, exact-structured]
  - `BuyCellBoost` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].surface` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU5Button` at `$.atu5TitleFollowUp.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `BuyMK1TokenBoost` at `$.atu5TitleFollowUp.recoveredBridge.supportingActionHook` [supporting, score 95, exact-structured]
  - `ATU5Button` at `$.boundedRecoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `BuyMK1TokenBoost` at `$.boundedRecoveredBridge.supportingActionHook` [supporting, score 95, exact-structured]
  - `ATU6Button` at `$.boundedRecoveredBridgeFollowUp.shellField` [supporting, score 95, exact-structured]
  - `BuyMK2TokenBoost` at `$.boundedRecoveredBridgeFollowUp.supportingActionHook` [supporting, score 95, exact-structured]
  - `BuyATU24` at `$.groundedNonLabelClues.directBuyHookSamples[0]` [supporting, score 95, exact-structured]
  - `ATU2DiamondsBonus` at `$.groundedNonLabelClues.effectHookSamples[1]` [supporting, score 95, exact-structured]
  - `ATU2Button` at `$.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU2DiamondsBonus` at `$.recoveredBridge.supportingEffectHook` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.textHookFollowUp.testedHooks[0]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.traceFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU4Button` at `$.traceFollowUp.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `BuyModBoost` at `$.traceFollowUp.recoveredBridge.supportingActionHook` [supporting, score 95, exact-structured]
  - `ATU6Button` at `$.verifiedTitleJoin.shellField` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.verifiedTitleJoin.textHandlerSearchSurface[0]` [supporting, score 95, exact-structured]
- Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (28 hits)
  - Signal summary: 28 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].byte_context[40].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `BuyMK2TokenBoost` at `$[0].matches[192].byte_context[32].value` [high-signal, score 100, exact-structured]
  - `BuyMK2TokenBoost` at `$[0].matches[192].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyMK2TokenBoost` at `$[0].matches[193].byte_context[32].value` [high-signal, score 100, exact-structured]
  - `BuyMK2TokenBoost` at `$[0].matches[193].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `BuyTokenBoost` at `$[0].matches[197].byte_context[64].value` [high-signal, score 100, exact-structured]
  - `BuyTokenBoost` at `$[0].matches[197].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyTokenBoost` at `$[0].matches[198].byte_context[61].value` [high-signal, score 100, exact-structured]
  - `BuyTokenBoost` at `$[0].matches[198].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `BuyMK1TokenBoost` at `$[0].matches[200].byte_context[30].value` [high-signal, score 100, exact-structured]
  - `BuyMK1TokenBoost` at `$[0].matches[200].entry_context[31].value` [high-signal, score 100, exact-structured]
  - `BuyMK1TokenBoost` at `$[0].matches[201].byte_context[27].value` [high-signal, score 100, exact-structured]
  - `BuyMK1TokenBoost` at `$[0].matches[201].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].byte_context[118].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].entry_context[16].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[313].entry_context[4].value` [high-signal, score 100, exact-structured]
  - `BuyModBoost` at `$[0].matches[68].byte_context[52].value` [high-signal, score 100, exact-structured]
  - `BuyModBoost` at `$[0].matches[68].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyModBoost` at `$[0].matches[69].byte_context[52].value` [high-signal, score 100, exact-structured]
  - `BuyModBoost` at `$[0].matches[69].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `BuyATU24` at `$[0].matches[71].byte_context[37].value` [high-signal, score 100, exact-structured]
  - `BuyATU24` at `$[0].matches[72].byte_context[35].value` [high-signal, score 100, exact-structured]
  - `BuyATU24` at `$[0].matches[72].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyATU24` at `$[0].matches[73].entry_context[25].value` [high-signal, score 100, exact-structured]

### Prefab identity roster

- Search terms: `NewTokenUPGPrefab.T1.TokensBoost, NewTokenUPGPrefab.T1.DiamondBoost, NewTokenUPGPrefab.T1.ModPointsBooster, NewTokenUPGPrefab.T1.MK1Booster, NewTokenUPGPrefab.T1.MK2Booster, NewTokenUPGPrefab.T1.CellsPerChestBooster, NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser, ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU3Button, ATU24Button, SetAllTokenShopTexts, 15810, CellBoost, BuyCellBoost`
- Typed anchors: `NewTokenUPGPrefab.T1.TokensBoost (string), NewTokenUPGPrefab.T1.DiamondBoost (string), NewTokenUPGPrefab.T1.ModPointsBooster (string), NewTokenUPGPrefab.T1.MK1Booster (string), NewTokenUPGPrefab.T1.MK2Booster (string), NewTokenUPGPrefab.T1.CellsPerChestBooster (string), NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser (string), ATU1Button (class), ATU2Button (class), ATU4Button (class), ATU5Button (class), ATU6Button (class), ATU3Button (class), ATU24Button (class), SetAllTokenShopTexts (method), 15810 (path id), CellBoost (class), BuyCellBoost (method)`
- Source: [`data/token-shop-row-remap-boundary.json`](data/token-shop-row-remap-boundary.json) (31 hits)
  - Signal summary: 2 high-signal, 29 supporting, 0 incidental, 0 suppressed-noise
  - `15810` at `$.adjacentFollowUp.blockedAdjacentShell.shellPathId` [high-signal, score 110, exact-structured]
  - `15810` at `$.atu3CellsDisambiguationPass.shellPathId` [high-signal, score 110, exact-structured]
  - `BuyCellBoost` at `$.adjacentFollowUp.blockedAdjacentShell.nearestNamedActionHook` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.adjacentFollowUp.blockedAdjacentShell.shellField` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.adjacentFollowUp.blockedAdjacentShell.splitCellIdentitySurfaces.tokenPrefabCandidates[0]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.TokensBoost` at `$.adjacentFollowUp.recoveredAdditionalBridge.prefabIdentity` [supporting, score 95, exact-structured]
  - `ATU1Button` at `$.adjacentFollowUp.recoveredAdditionalBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU1Button` at `$.adjacentFollowUp.testedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.adjacentFollowUp.testedNeighbors[1]` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.atu3CellsDisambiguationPass.shellField` [supporting, score 95, exact-structured]
  - `BuyCellBoost` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].preservedNeighbors[2]` [supporting, score 95, exact-structured]
  - `BuyCellBoost` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].surface` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.atu3CellsDisambiguationPass.testedSurfaces[2].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.MK1Booster` at `$.atu5TitleFollowUp.recoveredBridge.prefabIdentity` [supporting, score 95, exact-structured]
  - `ATU5Button` at `$.atu5TitleFollowUp.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.MK1Booster` at `$.boundedRecoveredBridge.prefabIdentity` [supporting, score 95, exact-structured]
  - `ATU5Button` at `$.boundedRecoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.MK2Booster` at `$.boundedRecoveredBridgeFollowUp.prefabIdentity` [supporting, score 95, exact-structured]
  - `ATU6Button` at `$.boundedRecoveredBridgeFollowUp.shellField` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.TokensBoost` at `$.groundedNonLabelClues.prefabRosterSamples[0]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.DiamondBoost` at `$.recoveredBridge.prefabIdentity` [supporting, score 95, exact-structured]
  - `ATU2Button` at `$.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.textHookFollowUp.separatePrefabClusterSamples[0]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.textHookFollowUp.testedHooks[0]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.traceFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.ModPointsBooster` at `$.traceFollowUp.recoveredBridge.prefabIdentity` [supporting, score 95, exact-structured]
  - `ATU4Button` at `$.traceFollowUp.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.MK2Booster` at `$.verifiedTitleJoin.prefabIdentity` [supporting, score 95, exact-structured]
  - `ATU6Button` at `$.verifiedTitleJoin.shellField` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.verifiedTitleJoin.textHandlerSearchSurface[0]` [supporting, score 95, exact-structured]
- Source: [`data/token-shop-late-atu-boundary.json`](data/token-shop-late-atu-boundary.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `ATU24Button` at `$.lateRows[0].shellField` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser` at `$.prefabRosterBoundary.localPrefabCluster[1].identity` [supporting, score 95, exact-structured]
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (7 hits)
  - Signal summary: 7 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `NewTokenUPGPrefab.T1.DiamondBoost` at `$.namedObjectHits[10350].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T1.ModPointsBooster` at `$.namedObjectHits[10353].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.namedObjectHits[10371].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser` at `$.namedObjectHits[10373].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T1.MK1Booster` at `$.namedObjectHits[10379].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T1.TokensBoost` at `$.namedObjectHits[10405].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T1.MK2Booster` at `$.namedObjectHits[10409].name` [high-signal, score 100, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (9 hits)
  - Signal summary: 0 high-signal, 9 supporting, 0 incidental, 0 suppressed-noise
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.DiamondBoost` at `$.apk_results[7].keyword_hits.diamond[25]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.ModPointsBooster` at `$.apk_results[7].keyword_hits.token[14]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.TokensBoost` at `$.apk_results[7].keyword_hits.token[15]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser` at `$.apk_results[7].keyword_hits.token[30]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.apk_results[7].keyword_hits.token[4]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.DiamondBoost` at `$.apk_results[7].keyword_hits.token[5]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.MK1Booster` at `$.apk_results[7].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.MK2Booster` at `$.apk_results[7].keyword_hits.token[7]` [supporting, score 95, exact-structured]

### Title and text surfaces

- Search terms: `SetAllTokenShopTexts, SetTokenTexts, Mk2 Generator Booster, Token Ultima: MP, 1. MK1 Generator Output,, Token Ultima: Cells, Academy Booster, ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU3Button, ATU24Button, 15810, CellBoost, BuyCellBoost`
- Typed anchors: `SetAllTokenShopTexts (method), SetTokenTexts (method), Mk2 Generator Booster (string), Token Ultima: MP (string), 1. MK1 Generator Output, (string), Token Ultima: Cells (string), Academy Booster (string), ATU1Button (class), ATU2Button (class), ATU4Button (class), ATU5Button (class), ATU6Button (class), ATU3Button (class), ATU24Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method)`
- Source: [`data/token-shop-row-remap-boundary.json`](data/token-shop-row-remap-boundary.json) (35 hits)
  - Signal summary: 2 high-signal, 33 supporting, 0 incidental, 0 suppressed-noise
  - `15810` at `$.adjacentFollowUp.blockedAdjacentShell.shellPathId` [high-signal, score 110, exact-structured]
  - `15810` at `$.atu3CellsDisambiguationPass.shellPathId` [high-signal, score 110, exact-structured]
  - `BuyCellBoost` at `$.adjacentFollowUp.blockedAdjacentShell.nearestNamedActionHook` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.adjacentFollowUp.blockedAdjacentShell.shellField` [supporting, score 95, exact-structured]
  - `Token Ultima: Cells` at `$.adjacentFollowUp.blockedAdjacentShell.splitCellIdentitySurfaces.tokenTitleCandidate` [supporting, score 95, exact-structured]
  - `ATU1Button` at `$.adjacentFollowUp.recoveredAdditionalBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU1Button` at `$.adjacentFollowUp.testedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.adjacentFollowUp.testedNeighbors[1]` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.atu3CellsDisambiguationPass.shellField` [supporting, score 95, exact-structured]
  - `BuyCellBoost` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].preservedNeighbors[2]` [supporting, score 95, exact-structured]
  - `BuyCellBoost` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].surface` [supporting, score 95, exact-structured]
  - `Token Ultima: Cells` at `$.atu3CellsDisambiguationPass.testedSurfaces[2].preservedNeighbors[2]` [supporting, score 95, exact-structured]
  - `1. MK1 Generator Output,` at `$.atu5TitleFollowUp.blockedTitleJoin.supportTextCandidate` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `SetTokenTexts` at `$.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[1]` [supporting, score 95, exact-structured]
  - `1. MK1 Generator Output,` at `$.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces[1].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `Mk2 Generator Booster` at `$.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces[2].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU5Button` at `$.atu5TitleFollowUp.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU5Button` at `$.boundedRecoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU6Button` at `$.boundedRecoveredBridgeFollowUp.shellField` [supporting, score 95, exact-structured]
  - `Academy Booster` at `$.groundedNonLabelClues.playerFacingStringSamples[3]` [supporting, score 95, exact-structured]
  - `ATU2Button` at `$.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `Token Ultima: Cells` at `$.textHookFollowUp.separateTitleClusterSamples[0]` [supporting, score 95, exact-structured]
  - `Academy Booster` at `$.textHookFollowUp.separateTitleClusterSamples[4]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.textHookFollowUp.testedHooks[0]` [supporting, score 95, exact-structured]
  - `SetTokenTexts` at `$.textHookFollowUp.testedHooks[1]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.traceFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `SetTokenTexts` at `$.traceFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[1]` [supporting, score 95, exact-structured]
  - `Token Ultima: MP` at `$.traceFollowUp.blockedTitleJoin.testedSurfaces[1].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `Token Ultima: MP` at `$.traceFollowUp.blockedTitleJoin.titleCandidate` [supporting, score 95, exact-structured]
  - `ATU4Button` at `$.traceFollowUp.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU6Button` at `$.verifiedTitleJoin.shellField` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.verifiedTitleJoin.textHandlerSearchSurface[0]` [supporting, score 95, exact-structured]
  - `SetTokenTexts` at `$.verifiedTitleJoin.textHandlerSearchSurface[1]` [supporting, score 95, exact-structured]
  - `Mk2 Generator Booster` at `$.verifiedTitleJoin.titleProbeTitle` [supporting, score 95, exact-structured]
- Source: [`data/token-shop-late-atu-boundary.json`](data/token-shop-late-atu-boundary.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `ATU24Button` at `$.lateRows[0].shellField` [supporting, score 95, exact-structured]
  - `Academy Booster` at `$.titleRosterBoundary.localTitleCluster[2].title` [supporting, score 95, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (6 hits)
  - Signal summary: 0 high-signal, 6 supporting, 0 incidental, 0 suppressed-noise
  - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.token[25]` [supporting, score 95, exact-structured]
  - `Token Ultima: MP` at `$.apk_results[23].keyword_hits.token[26]` [supporting, score 95, exact-structured]
  - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.ultima[5]` [supporting, score 95, exact-structured]
  - `Token Ultima: MP` at `$.apk_results[23].keyword_hits.ultima[6]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `SetTokenTexts` at `$.apk_results[32].keyword_hits.token[7]` [supporting, score 95, exact-structured]
- Source: [`data/daily-tokenium-owner-probe.json`](data/daily-tokenium-owner-probe.json) (10 hits)
  - Signal summary: 0 high-signal, 10 supporting, 0 incidental, 0 suppressed-noise
  - `Mk2 Generator Booster` at `$[0].matches[19].byte_context[17].value` [supporting, score 95, exact-structured]
  - `Academy Booster` at `$[0].matches[19].byte_context[27].value` [supporting, score 95, exact-structured]
  - `Mk2 Generator Booster` at `$[0].matches[19].entry_context[12].value` [supporting, score 95, exact-structured]
  - `Academy Booster` at `$[0].matches[20].byte_context[15].value` [supporting, score 95, exact-structured]
  - `Mk2 Generator Booster` at `$[0].matches[20].byte_context[5].value` [supporting, score 95, exact-structured]
  - `Mk2 Generator Booster` at `$[0].matches[20].entry_context[0].value` [supporting, score 95, exact-structured]
  - `Academy Booster` at `$[0].matches[20].entry_context[10].value` [supporting, score 95, exact-structured]
  - `Academy Booster` at `$[0].matches[20].value` [supporting, score 95, exact-structured]
  - `1. MK1 Generator Output,` at `$[0].matches[46].byte_context[29].value` [supporting, score 95, exact-structured]
  - `1. MK1 Generator Output,` at `$[0].matches[46].entry_context[5].value` [supporting, score 95, exact-structured]

### Bounded unresolved neighborhoods

- Search terms: `ATU3Button, BuyCellBoost, ATU24Button, BuyATU24, StartCellBostHold, ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, SetAllTokenShopTexts, 15810, CellBoost`
- Typed anchors: `ATU3Button (class), BuyCellBoost (method), ATU24Button (class), BuyATU24 (method), StartCellBostHold (method), ATU1Button (class), ATU2Button (class), ATU4Button (class), ATU5Button (class), ATU6Button (class), SetAllTokenShopTexts (method), 15810 (path id), CellBoost (class)`
- Source: [`data/token-shop-row-remap-boundary.json`](data/token-shop-row-remap-boundary.json) (22 hits)
  - Signal summary: 2 high-signal, 20 supporting, 0 incidental, 0 suppressed-noise
  - `15810` at `$.adjacentFollowUp.blockedAdjacentShell.shellPathId` [high-signal, score 110, exact-structured]
  - `15810` at `$.atu3CellsDisambiguationPass.shellPathId` [high-signal, score 110, exact-structured]
  - `BuyCellBoost` at `$.adjacentFollowUp.blockedAdjacentShell.nearestNamedActionHook` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.adjacentFollowUp.blockedAdjacentShell.shellField` [supporting, score 95, exact-structured]
  - `ATU1Button` at `$.adjacentFollowUp.recoveredAdditionalBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU1Button` at `$.adjacentFollowUp.testedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.adjacentFollowUp.testedNeighbors[1]` [supporting, score 95, exact-structured]
  - `ATU3Button` at `$.atu3CellsDisambiguationPass.shellField` [supporting, score 95, exact-structured]
  - `StartCellBostHold` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `BuyCellBoost` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].preservedNeighbors[2]` [supporting, score 95, exact-structured]
  - `BuyCellBoost` at `$.atu3CellsDisambiguationPass.testedSurfaces[0].surface` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU5Button` at `$.atu5TitleFollowUp.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU5Button` at `$.boundedRecoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU6Button` at `$.boundedRecoveredBridgeFollowUp.shellField` [supporting, score 95, exact-structured]
  - `BuyATU24` at `$.groundedNonLabelClues.directBuyHookSamples[0]` [supporting, score 95, exact-structured]
  - `ATU2Button` at `$.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.textHookFollowUp.testedHooks[0]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.traceFollowUp.blockedTitleJoin.testedSurfaces[0].preservedNeighbors[0]` [supporting, score 95, exact-structured]
  - `ATU4Button` at `$.traceFollowUp.recoveredBridge.shellField` [supporting, score 95, exact-structured]
  - `ATU6Button` at `$.verifiedTitleJoin.shellField` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.verifiedTitleJoin.textHandlerSearchSurface[0]` [supporting, score 95, exact-structured]
- Source: [`data/token-shop-late-atu-boundary.json`](data/token-shop-late-atu-boundary.json) (3 hits)
  - Signal summary: 0 high-signal, 3 supporting, 0 incidental, 0 suppressed-noise
  - `BuyATU24` at `$.actionNeighborhood.preservedLateHooks[0]` [supporting, score 95, exact-structured]
  - `BuyATU24` at `$.lateRows[0].buyHook` [supporting, score 95, exact-structured]
  - `ATU24Button` at `$.lateRows[0].shellField` [supporting, score 95, exact-structured]
- Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (16 hits)
  - Signal summary: 16 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `StartCellBostHold` at `$[0].matches[101].byte_context[30].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value` [high-signal, score 100, exact-structured]
  - `StartCellBostHold` at `$[0].matches[101].entry_context[17].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `StartCellBostHold` at `$[0].matches[102].byte_context[29].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].byte_context[40].value` [high-signal, score 100, exact-structured]
  - `StartCellBostHold` at `$[0].matches[102].entry_context[14].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].byte_context[118].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].entry_context[16].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[313].entry_context[4].value` [high-signal, score 100, exact-structured]
  - `BuyATU24` at `$[0].matches[71].byte_context[37].value` [high-signal, score 100, exact-structured]
  - `BuyATU24` at `$[0].matches[72].byte_context[35].value` [high-signal, score 100, exact-structured]
  - `BuyATU24` at `$[0].matches[72].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyATU24` at `$[0].matches[73].entry_context[25].value` [high-signal, score 100, exact-structured]

## Bridge check

- Result: `checked family structure audit recovered`

## Trace graph

- Present typed edges: `6`
- Negative typed edges: `2`

### Proved joins

- `repeated-serialized-shell-adjacency`: The committed TokenShop payload repeatedly preserves exact ATU shell ids and adjacent owner neighborhoods across both solved and still-unresolved rows. [direct]
  - `tokenShopExtract` at `$.fields[12].field` proves `ATU1Button`
  - `tokenShopExtract` at `$.fields[51].field` proves `ATU6Button`
  - `tokenShopExtract` at `$.fields[193].field` proves `ATU24Button`
  - `tokenShopLateAtuBoundary` at `$.targetNeighborhood.shellFieldRange` proves `ATU24Button through ATU28Button`
- `repeated-row-family-proxy-lane`: The strongest solved subset repeatedly preserves one row-family proxy lane through buy hooks or effect hooks rather than raw row-order similarity. [supporting]
  - `tokenShopRowRemapBoundary` at `$.adjacentFollowUp.recoveredAdditionalBridge.supportingActionHook` proves `BuyTokenBoost`
  - `tokenShopRowRemapBoundary` at `$.recoveredBridge.supportingEffectHook` proves `ATU2DiamondsBonus`
  - `tokenShopRowRemapBoundary` at `$.traceFollowUp.recoveredBridge.supportingActionHook` proves `BuyModBoost`
  - `tokenShopRowRemapBoundary` at `$.atu5TitleFollowUp.recoveredBridge.supportingActionHook` proves `BuyMK1TokenBoost`
  - `tokenShopRowRemapBoundary` at `$.boundedRecoveredBridgeFollowUp.supportingActionHook` proves `BuyMK2TokenBoost`
  - `dailyTokeniumLaneProbe` at `$[0].matches[197].byte_context[64].value` proves `BuyTokenBoost`
  - `dailyTokeniumLaneProbe` at `$[0].matches[68].byte_context[52].value` proves `BuyModBoost`
  - `dailyTokeniumLaneProbe` at `$[0].matches[200].byte_context[30].value` proves `BuyMK1TokenBoost`
  - `dailyTokeniumLaneProbe` at `$[0].matches[192].byte_context[32].value` proves `BuyMK2TokenBoost`
- `repeated-shell-to-prefab-subset`: The same solved subset repeatedly reaches exact prefab identities on committed sources, even when final titles still do not localize. [direct]
  - `tokenShopRowRemapBoundary` at `$.adjacentFollowUp.recoveredAdditionalBridge.prefabIdentity` proves `NewTokenUPGPrefab.T1.TokensBoost`
  - `tokenShopRowRemapBoundary` at `$.recoveredBridge.prefabIdentity` proves `NewTokenUPGPrefab.T1.DiamondBoost`
  - `tokenShopRowRemapBoundary` at `$.traceFollowUp.recoveredBridge.prefabIdentity` proves `NewTokenUPGPrefab.T1.ModPointsBooster`
  - `tokenShopRowRemapBoundary` at `$.atu5TitleFollowUp.recoveredBridge.prefabIdentity` proves `NewTokenUPGPrefab.T1.MK1Booster`
  - `tokenShopRowRemapBoundary` at `$.boundedRecoveredBridgeFollowUp.prefabIdentity` proves `NewTokenUPGPrefab.T1.MK2Booster`
  - `uabeaProbe` at `$.namedObjectHits[10405].name` proves `NewTokenUPGPrefab.T1.TokensBoost`
  - `uabeaProbe` at `$.namedObjectHits[10409].name` proves `NewTokenUPGPrefab.T1.MK2Booster`
- `repeated-title-text-surface`: Generic TokenShop text hooks and row-adjacent title or support-text surfaces repeatedly survive, but they usually remain detached from exact shell ids. [supporting]
  - `unityProbe` at `$.apk_results[32].keyword_hits.token[6]` proves `SetAllTokenShopTexts`
  - `unityProbe` at `$.apk_results[23].keyword_hits.token[26]` proves `Token Ultima: MP`
  - `dailyTokeniumOwnerProbe` at `$[0].matches[46].byte_context[29].value` proves `1. MK1 Generator Output,`
  - `tokenShopLateAtuBoundary` at `$.titleRosterBoundary.localTitleCluster[2].title` proves `Academy Booster`
- `exact-shell-to-title-exemplar`: ATU6 remains the standout strongest row neighborhood because the repo preserves one exact shell-to-prefab-to-title chain there. [direct]
  - `tokenShopRowRemapBoundary` at `$.verifiedTitleJoin.titleProbeTitle` proves `Mk2 Generator Booster`
  - `dailyTokeniumOwnerProbe` at `$[0].matches[19].byte_context[17].value` proves `Mk2 Generator Booster`
  - `tokenShopRowRemapBoundary` at `$.verifiedTitleJoin.prefabIdentity` proves `NewTokenUPGPrefab.T1.MK2Booster`
- `bounded-unresolved-neighborhood-coverage`: The still-unresolved neighborhoods are already checked as bounded negatives rather than open-ended unknowns. [supporting]
  - `tokenShopRowRemapBoundary` at `$.atu3CellsDisambiguationPass.groundedConclusion` proves `The bounded ATU3 cells-domain disambiguation pass stays negative. Across the exact BuyCellBoost, diamond-special CellsBoost, and token-side CellsPerChestBooster or Token Ultima: Cells search surfaces, the repo still preserves only separate cells-domain clusters rather than one checked object-or-title join back to ATU3Button path id 15810.`
  - `tokenShopLateAtuBoundary` at `$.groundedConclusion` proves `The ATU24-ATU28 late shell neighborhood now has a tighter bounded negative result. The repo preserves exact SaveData row levels, exact TokenShop shell path ids, direct BuyATU24 through BuyATU28 hooks, one local late title roster, one local late prefab roster, and separate Campaign Fragments or Academy effect-side strings, but no committed artifact crosses those surfaces back to one exact ATU24Button through ATU28Button shell. This neighborhood therefore narrows the unresolved late tier4plus seam without recovering one new checked shell-to-prefab or shell-to-title bridge.`
  - `dailyTokeniumLaneProbe` at `$[0].matches[71].byte_context[37].value` proves `BuyATU24`

### Missing joins

- `repeated-shell-to-title-localization-gap`: Outside ATU6, the solved shell subset still does not repeatedly localize final player-facing row titles: ATU1, ATU2, ATU4, and ATU5 all stop short of one exact shell-to-title join. [negative]
  - `tokenShopRowRemapBoundary` at `$.blockedIdentityJoin.missingLinks[1]` records `No checked repo artifact currently ties ATU1Button, ATU2Button, ATU4Button, or ATU5Button directly to a final player-facing TokenShop row title string.`
  - `tokenShopRowRemapBoundary` at `$.traceFollowUp.blockedTitleJoin.missingJoin` records `No committed source currently ties ATU4Button directly to one final player-facing TokenShop row title; the surviving generic text hooks plus the Token Ultima: MP and :Diamond Upgrade 11 - ModBoost title clues stay detached from the traced ATU4 shell neighborhood.`
  - `tokenShopRowRemapBoundary` at `$.atu5TitleFollowUp.blockedTitleJoin.missingJoin` records `No committed source currently ties ATU5Button directly to one final player-facing TokenShop row title; the surviving generic text hooks, the detached MK1 generator support-text cluster, and the neighboring generator title roster all stay detached from the traced ATU5 shell neighborhood.`
- `repeated-unresolved-shell-identity-gap`: The unresolved ATU3 and late ATU24-ATU28 neighborhoods still fail the exact shell-to-prefab or shell-to-title localization step entirely, even though shell-side serialization and nearby hooks survive. [negative]
  - `tokenShopRowRemapBoundary` at `$.atu3CellsDisambiguationPass.groundedConclusion` records `The bounded ATU3 cells-domain disambiguation pass stays negative. Across the exact BuyCellBoost, diamond-special CellsBoost, and token-side CellsPerChestBooster or Token Ultima: Cells search surfaces, the repo still preserves only separate cells-domain clusters rather than one checked object-or-title join back to ATU3Button path id 15810.`
  - `tokenShopLateAtuBoundary` at `$.result` records `no concrete late-row object-or-title join cleared`
  - `tokenShopLateAtuBoundary` at `$.groundedConclusion` records `The ATU24-ATU28 late shell neighborhood now has a tighter bounded negative result. The repo preserves exact SaveData row levels, exact TokenShop shell path ids, direct BuyATU24 through BuyATU28 hooks, one local late title roster, one local late prefab roster, and separate Campaign Fragments or Academy effect-side strings, but no committed artifact crosses those surfaces back to one exact ATU24Button through ATU28Button shell. This neighborhood therefore narrows the unresolved late tier4plus seam without recovering one new checked shell-to-prefab or shell-to-title bridge.`

## Solved vs blocked

- Baseline: `ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button` path id `solved-subset` stays cleared as the comparison shape.
- Blocked target: `ATU3Button plus ATU24Button through ATU28Button` path id `bounded-unresolved-neighborhoods` stays blocked.
- Shared present edge types: `repeated-row-family-proxy-lane, repeated-serialized-shell-adjacency`
- Baseline-only present edge types: `exact-shell-to-title-exemplar, repeated-shell-to-prefab-subset`
- Blocked missing edge types: `repeated-shell-to-prefab-subset, exact-shell-to-title-exemplar`

- Both the solved and unresolved neighborhoods still preserve shell-side ATU serialization.
- The strongest solved subset adds repeated row-family proxy hooks and exact prefab identities, while ATU6 alone adds one exact title-chain exemplar.
- The unresolved neighborhoods still stop before exact prefab or final-title localization, so the family audit remains descriptive rather than promotive.

## Decision summary

- Verdict: `quarantine`
- Summary: The family audit preserves a repeated shell-to-proxy-to-prefab pattern and one standout ATU6 title-chain exemplar, but repeated title-localization gaps still quarantine the broader family.
- Proved edges: `6`
- Negative edges: `2`
- Baseline gap: `repeated-shell-to-prefab-subset, exact-shell-to-title-exemplar`

## Current loss

- The family audit confirms that shell-side ATU serialization survives much more often than row-local title localization does.
- The strongest repeated solved pattern is shell adjacency plus one row-family proxy hook and one exact prefab identity, but the title-side surfaces usually remain detached into generic text hooks, support text, or loose title rosters.
- ATU6 remains the standout strongest neighborhood because it is still the only row that carries one checked shell-to-prefab-to-title chain; ATU4 and ATU5 stay structurally stronger than ATU3 and the late ATU24-ATU28 block, but still stop short of final title localization.

## Conclusion

- The TokenShop family audit is structurally informative but still quarantined. The repo repeatedly preserves shell-side ATU neighborhoods plus row-family proxy hooks and prefab identities on the solved subset, but repeated title-localization gaps remain for ATU1, ATU2, ATU4, and ATU5, while ATU3 and the late ATU24-ATU28 block still fail the exact identity join entirely. ATU6 remains the strongest standout row neighborhood.
