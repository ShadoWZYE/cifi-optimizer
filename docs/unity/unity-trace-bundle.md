# Unity Trace Bundle

- Target: `token-shop-atu3-chest-consumer-read`
- Label: TokenShop ATU3 chest consumer internal read seam
- Anchors: `ATU3Button, 15810, get_SmallAdCellGains, SetBoosterAdBonus, get_FinalBoosterAdBonus, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Join goal: Recover one checked internal handoff from the ATU3 shared Cells Booster (Chests) effect lane into the concrete chest consumer bonus-aggregation shell, and keep the exact CellBoostBonus read site bounded if it still does not clear.

## Planner resolution

- Selection mode: `explicit-target`
- Matched family: `token-shop` (TokenShop)
- Run mode: `trace`
- Requested queries: `none`
- Requested anchors: `none`
- Expanded anchor kinds: `ATU3Button (class), 15810 (path id), get_SmallAdCellGains (method), SetBoosterAdBonus (method), get_FinalBoosterAdBonus (method), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Decision note: Used explicit target token-shop-atu3-chest-consumer-read in the TokenShop family and kept family-aware anchor expansion so the backend records the same checked synonym surface deterministically.

## Execution anchors

- Typed execution anchors: `ATU3Button (class), 15810 (path id), get_SmallAdCellGains (method), SetBoosterAdBonus (method), get_FinalBoosterAdBonus (method), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]`
- Direct example: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Planner example: `node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>`
- Accepted anchor kinds: `class, method, string, path id`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.
- Registry target: `token-shop-atu3-chest-consumer-read` from `token-shop` via [`data/unity-trace-target-registry.json`](data/unity-trace-target-registry.json)

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

- Shell field: `ATU3Button`
- Shell path id: `15810`
- Owner field block: `CellBoostStartCost, CellBoostAdditiveCost, CellBoostBonus, CellBoostMaxLevel, CellBoostFill`

## Surface traces

### Metadata neighborhood

- Search terms: `ATU3Button, CellBoost, BuyCellBoost, 15810, get_SmallAdCellGains, SetBoosterAdBonus, get_FinalBoosterAdBonus, SetAllTokenShopTexts`
- Typed anchors: `ATU3Button (class), CellBoost (class), BuyCellBoost (method), 15810 (path id), get_SmallAdCellGains (method), SetBoosterAdBonus (method), get_FinalBoosterAdBonus (method), SetAllTokenShopTexts (method)`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (10 hits)
  - Signal summary: 0 high-signal, 6 supporting, 4 incidental, 0 suppressed-noise
  - `get_SmallAdCellGains` at metadata offset `615771` [supporting, score 90, exact-string]
  - `SetBoosterAdBonus` at metadata offset `615811` [supporting, score 90, exact-string]
  - `get_FinalBoosterAdBonus` at metadata offset `615829` [supporting, score 90, exact-string]
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Chest consumer family

- Search terms: `AdManager, Assembly-CSharp, SetAdChestTexts, OfflineManager, Assembly-CSharp, DailyAndAdCounterChecker, ATU3Button, 15810, get_SmallAdCellGains, SetBoosterAdBonus, get_FinalBoosterAdBonus, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `AdManager, Assembly-CSharp (string), SetAdChestTexts (method), OfflineManager, Assembly-CSharp (string), DailyAndAdCounterChecker (class), ATU3Button (class), 15810 (path id), get_SmallAdCellGains (method), SetBoosterAdBonus (method), get_FinalBoosterAdBonus (method), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (22 hits)
  - Signal summary: 22 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].byte_context[40].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `SetAdChestTexts` at `$[0].matches[195].byte_context[73].value` [high-signal, score 100, exact-structured]
  - `OfflineManager, Assembly-CSharp` at `$[0].matches[195].byte_context[75].value` [high-signal, score 100, exact-structured]
  - `DailyAndAdCounterChecker` at `$[0].matches[195].byte_context[76].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].byte_context[118].value` [high-signal, score 100, exact-structured]
  - `OfflineManager, Assembly-CSharp` at `$[0].matches[312].byte_context[43].value` [high-signal, score 100, exact-structured]
  - `OfflineManager, Assembly-CSharp` at `$[0].matches[312].byte_context[88].value` [high-signal, score 100, exact-structured]
  - `DailyAndAdCounterChecker` at `$[0].matches[312].byte_context[89].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].entry_context[16].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].value` [high-signal, score 100, exact-structured]
  - `DailyAndAdCounterChecker` at `$[0].matches[313].byte_context[77].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[313].entry_context[4].value` [high-signal, score 100, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[76].byte_context[58].value` [high-signal, score 100, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[76].byte_context[64].value` [high-signal, score 100, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[76].byte_context[67].value` [high-signal, score 100, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[76].byte_context[70].value` [high-signal, score 100, exact-structured]
  - `SetAdChestTexts` at `$[0].matches[76].byte_context[74].value` [high-signal, score 100, exact-structured]
  - `OfflineManager, Assembly-CSharp` at `$[0].matches[76].byte_context[76].value` [high-signal, score 100, exact-structured]
  - `DailyAndAdCounterChecker` at `$[0].matches[76].byte_context[77].value` [high-signal, score 100, exact-structured]
- Source: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json) (16 hits)
  - Signal summary: 0 high-signal, 16 supporting, 0 incidental, 0 suppressed-noise
  - `SetAdChestTexts` at `$[0].matches[174].byte_context[19].value` [supporting, score 95, exact-structured]
  - `OfflineManager, Assembly-CSharp` at `$[0].matches[174].byte_context[21].value` [supporting, score 95, exact-structured]
  - `DailyAndAdCounterChecker` at `$[0].matches[174].byte_context[22].value` [supporting, score 95, exact-structured]
  - `OfflineManager, Assembly-CSharp` at `$[0].matches[205].byte_context[10].value` [supporting, score 95, exact-structured]
  - `DailyAndAdCounterChecker` at `$[0].matches[205].byte_context[11].value` [supporting, score 95, exact-structured]
  - `SetAdChestTexts` at `$[0].matches[205].byte_context[8].value` [supporting, score 95, exact-structured]
  - `OfflineManager, Assembly-CSharp` at `$[0].matches[225].byte_context[18].value` [supporting, score 95, exact-structured]
  - `DailyAndAdCounterChecker` at `$[0].matches[225].byte_context[19].value` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[225].byte_context[48].value` [supporting, score 95, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[87].byte_context[43].value` [supporting, score 95, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[87].byte_context[49].value` [supporting, score 95, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[87].byte_context[52].value` [supporting, score 95, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[87].byte_context[55].value` [supporting, score 95, exact-structured]
  - `SetAdChestTexts` at `$[0].matches[87].byte_context[59].value` [supporting, score 95, exact-structured]
  - `OfflineManager, Assembly-CSharp` at `$[0].matches[87].byte_context[61].value` [supporting, score 95, exact-structured]
  - `DailyAndAdCounterChecker` at `$[0].matches[87].byte_context[62].value` [supporting, score 95, exact-structured]

### Chest consumer routines

- Search terms: `StartTokenRoutine, <TokenChestRoutine>d__149, GoToClosedTokenChest, StartDiamondRoutine, <DiamondChestRoutine>d__155, GoToClosedDiamondChest, ATU3Button, 15810, get_SmallAdCellGains, SetBoosterAdBonus, get_FinalBoosterAdBonus, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `StartTokenRoutine (method), <TokenChestRoutine>d__149 (method), GoToClosedTokenChest (class), StartDiamondRoutine (method), <DiamondChestRoutine>d__155 (method), GoToClosedDiamondChest (class), ATU3Button (class), 15810 (path id), get_SmallAdCellGains (method), SetBoosterAdBonus (method), get_FinalBoosterAdBonus (method), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (16 hits)
  - Signal summary: 0 high-signal, 12 supporting, 4 incidental, 0 suppressed-noise
  - `StartTokenRoutine` at metadata offset `615527` [supporting, score 90, exact-string]
  - `StartDiamondRoutine` at metadata offset `615579` [supporting, score 90, exact-string]
  - `GoToClosedTokenChest` at metadata offset `615670` [supporting, score 90, exact-string]
  - `GoToClosedDiamondChest` at metadata offset `615712` [supporting, score 90, exact-string]
  - `get_SmallAdCellGains` at metadata offset `615771` [supporting, score 90, exact-string]
  - `SetBoosterAdBonus` at metadata offset `615811` [supporting, score 90, exact-string]
  - `get_FinalBoosterAdBonus` at metadata offset `615829` [supporting, score 90, exact-string]
  - `<DiamondChestRoutine>d__155` at metadata offset `618397` [supporting, score 90, exact-string]
  - `<TokenChestRoutine>d__149` at metadata offset `618447` [supporting, score 90, exact-string]
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (11 hits)
  - Signal summary: 0 high-signal, 11 supporting, 0 incidental, 0 suppressed-noise
  - `<DiamondChestRoutine>d__155` at `$.apk_results[0].keyword_hits.diamond[32]` [supporting, score 95, exact-structured]
  - `<TokenChestRoutine>d__149` at `$.apk_results[0].keyword_hits.token[64]` [supporting, score 95, exact-structured]
  - `GoToClosedDiamondChest` at `$.apk_results[24].keyword_hits.diamond[17]` [supporting, score 95, exact-structured]
  - `GoToClosedTokenChest` at `$.apk_results[24].keyword_hits.token[7]` [supporting, score 95, exact-structured]
  - `GoToClosedDiamondChest` at `$.apk_results[26].keyword_hits.diamond[14]` [supporting, score 95, exact-structured]
  - `GoToClosedDiamondChest` at `$.apk_results[27].keyword_hits.diamond[8]` [supporting, score 95, exact-structured]
  - `GoToClosedTokenChest` at `$.apk_results[27].keyword_hits.token[9]` [supporting, score 95, exact-structured]
  - `GoToClosedTokenChest` at `$.apk_results[28].keyword_hits.token[18]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `<DiamondChestRoutine>d__155` at `$.file_results[0].keyword_hits.diamond[32]` [supporting, score 95, exact-structured]
  - `<TokenChestRoutine>d__149` at `$.file_results[0].keyword_hits.token[64]` [supporting, score 95, exact-structured]

### Chest cell-gain getter shell

- Search terms: `get_SmallAdCellGains, get_BigAdCellGains, ATU3Button, 15810, SetBoosterAdBonus, get_FinalBoosterAdBonus, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `get_SmallAdCellGains (method), get_BigAdCellGains (method), ATU3Button (class), 15810 (path id), SetBoosterAdBonus (method), get_FinalBoosterAdBonus (method), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (11 hits)
  - Signal summary: 0 high-signal, 7 supporting, 4 incidental, 0 suppressed-noise
  - `get_SmallAdCellGains` at metadata offset `615771` [supporting, score 90, exact-string]
  - `get_BigAdCellGains` at metadata offset `615792` [supporting, score 90, exact-string]
  - `SetBoosterAdBonus` at metadata offset `615811` [supporting, score 90, exact-string]
  - `get_FinalBoosterAdBonus` at metadata offset `615829` [supporting, score 90, exact-string]
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Booster bonus aggregation shell

- Search terms: `SetBoosterAdBonus, get_FinalBoosterAdBonus, SmallAdCellGains, BigAdCellGains, FinalBoosterAdBonus, <BoosterAdRoutine>d__158, ATU3Button, 15810, get_SmallAdCellGains, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `SetBoosterAdBonus (method), get_FinalBoosterAdBonus (method), SmallAdCellGains (class), BigAdCellGains (class), FinalBoosterAdBonus (class), <BoosterAdRoutine>d__158 (method), ATU3Button (class), 15810 (path id), get_SmallAdCellGains (method), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (17 hits)
  - Signal summary: 0 high-signal, 10 supporting, 7 incidental, 0 suppressed-noise
  - `get_SmallAdCellGains` at metadata offset `615771` [supporting, score 90, exact-string]
  - `SetBoosterAdBonus` at metadata offset `615811` [supporting, score 90, exact-string]
  - `get_FinalBoosterAdBonus` at metadata offset `615829` [supporting, score 90, exact-string]
  - `SmallAdCellGains` at metadata offset `618320` [supporting, score 90, exact-string]
  - `BigAdCellGains` at metadata offset `618337` [supporting, score 90, exact-string]
  - `FinalBoosterAdBonus` at metadata offset `618352` [supporting, score 90, exact-string]
  - `<BoosterAdRoutine>d__158` at metadata offset `618372` [supporting, score 90, exact-string]
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `get_BigAdCellGains` at metadata offset `615792` [incidental, score 45, bounded-containment]
  - `set_FinalBoosterAdBonus` at metadata offset `615853` [incidental, score 45, bounded-containment]
  - `<FinalBoosterAdBonus>k__BackingField` at metadata offset `617854` [incidental, score 45, bounded-containment]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Final chest bonus shell

- Search terms: `<FinalAdTokenChestBonus>k__BackingField, <FinalDiamondChestBonus>k__BackingField, ATU3Button, 15810, get_SmallAdCellGains, SetBoosterAdBonus, get_FinalBoosterAdBonus, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `<FinalAdTokenChestBonus>k__BackingField (method), <FinalDiamondChestBonus>k__BackingField (method), ATU3Button (class), 15810 (path id), get_SmallAdCellGains (method), SetBoosterAdBonus (method), get_FinalBoosterAdBonus (method), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (5 hits)
  - Signal summary: 0 high-signal, 5 supporting, 0 incidental, 0 suppressed-noise
  - `<FinalDiamondChestBonus>k__BackingField` at `$.apk_results[0].keyword_hits.diamond[38]` [supporting, score 95, exact-structured]
  - `<FinalAdTokenChestBonus>k__BackingField` at `$.apk_results[0].keyword_hits.token[46]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `<FinalDiamondChestBonus>k__BackingField` at `$.file_results[0].keyword_hits.diamond[38]` [supporting, score 95, exact-structured]
  - `<FinalAdTokenChestBonus>k__BackingField` at `$.file_results[0].keyword_hits.token[46]` [supporting, score 95, exact-structured]

## Bridge check

- Result: `checked consumer-internal bonus shell recovered`

## Trace graph

- Present typed edges: `6`
- Negative typed edges: `1`

### Proved joins

- `serialized-adjacency`: The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract. [direct]
  - `tokenShopExtract` at `$.fields` proves `ATU3Button path_id 15810`
- `shared-effect-to-consumer-family`: The already checked ATU3 effect-driven lane remains grounded inside the AdManager chest consumer family. [derived]
  - `metadata` at `metadata offset 662349` proves `ATU3Button`
  - `metadata` at `metadata offset 662261` proves `CellBoostStartCost`
  - `dailyTokeniumLaneProbe` at `$[0].matches[76].byte_context[58].value` proves `AdManager, Assembly-CSharp`
  - `dailyTokeniumLaneProbe` at `$[0].matches[195].byte_context[73].value` proves `SetAdChestTexts`
  - `lm244TargetedProbe` at `$[0].matches[174].byte_context[21].value` proves `OfflineManager, Assembly-CSharp`
  - `lm244TargetedProbe` at `$[0].matches[174].byte_context[22].value` proves `DailyAndAdCounterChecker`
- `consumer-family-to-chest-routines`: The consumer family still preserves the token and diamond chest routine neighborhood. [direct]
  - `metadata` at `metadata offset 615527` proves `StartTokenRoutine`
  - `unityProbe` at `$.apk_results[0].keyword_hits.token[64]` proves `<TokenChestRoutine>d__149`
  - `metadata` at `metadata offset 615579` proves `StartDiamondRoutine`
  - `unityProbe` at `$.apk_results[0].keyword_hits.diamond[32]` proves `<DiamondChestRoutine>d__155`
- `consumer-family-to-cell-gain-getters`: The same internal runtime neighborhood preserves both chest cell-gain getters. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.cellGainGetterFamily` proves `get_SmallAdCellGains, get_BigAdCellGains`
  - `metadata` at `metadata offset 615771` proves `get_SmallAdCellGains`
  - `metadata` at `metadata offset 615792` proves `get_BigAdCellGains`
- `cell-gain-getters-to-booster-bonus-shell`: Committed metadata preserves the cell-gain getters beside the booster bonus aggregation shell. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.boosterAdBonusShell` proves `SetBoosterAdBonus, get_FinalBoosterAdBonus, SmallAdCellGains, BigAdCellGains, FinalBoosterAdBonus, <BoosterAdRoutine>d__158`
  - `metadata` at `metadata offset 615811` proves `SetBoosterAdBonus`
  - `metadata` at `metadata offset 615829` proves `get_FinalBoosterAdBonus`
  - `metadata` at `metadata offset 615771` proves `get_SmallAdCellGains`
  - `metadata` at `metadata offset 618337` proves `BigAdCellGains`
  - `metadata` at `metadata offset 615829` proves `get_FinalBoosterAdBonus`
  - `metadata` at `metadata offset 618372` proves `<BoosterAdRoutine>d__158`
- `booster-bonus-shell-to-final-chest-bonus-shell`: The booster bonus aggregation shell remains adjacent to the final token and diamond chest bonus backing-field shell preserved in probe output. [derived]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.finalChestBonusShell` proves `<FinalAdTokenChestBonus>k__BackingField, <FinalDiamondChestBonus>k__BackingField`
  - `unityProbe` at `$.apk_results[0].keyword_hits.token[46]` proves `<FinalAdTokenChestBonus>k__BackingField`
  - `unityProbe` at `$.apk_results[0].keyword_hits.diamond[38]` proves `<FinalDiamondChestBonus>k__BackingField`

### Missing joins

- `exact-cellboost-to-booster-bonus-handoff`: No committed source yet shows one exact CellBoostBonus read or typed field handoff into the internal AdManager bonus-aggregation shell that contains get_SmallAdCellGains, get_BigAdCellGains, SetBoosterAdBonus, get_FinalBoosterAdBonus, SmallAdCellGains, BigAdCellGains, FinalBoosterAdBonus, and <BoosterAdRoutine>d__158. The checked trace now makes both sides of that seam explicit in committed metadata, rules out a direct handoff at the outer chest routines, rules out the final token-or-diamond chest bonus backing fields, and also rules out the remaining internal getter-or-booster aggregation family plus FinalBoosterAdBonus setter-or-backing-field surfaces because every committed hit for those targets stays in the separate AdManager bonus neighborhood instead of the owner-side CellBoostBonus neighborhood. [negative]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerReadTrace.missingExactReadSiteSeam.missingJoin` records `No committed source yet shows one exact CellBoostBonus read or typed field handoff into the internal AdManager bonus-aggregation shell that contains get_SmallAdCellGains, get_BigAdCellGains, SetBoosterAdBonus, get_FinalBoosterAdBonus, SmallAdCellGains, BigAdCellGains, FinalBoosterAdBonus, and <BoosterAdRoutine>d__158. The checked trace now makes both sides of that seam explicit in committed metadata, rules out a direct handoff at the outer chest routines, rules out the final token-or-diamond chest bonus backing fields, and also rules out the remaining internal getter-or-booster aggregation family plus FinalBoosterAdBonus setter-or-backing-field surfaces because every committed hit for those targets stays in the separate AdManager bonus neighborhood instead of the owner-side CellBoostBonus neighborhood.`
  - `metadata` at `metadata offset 615771` records `get_SmallAdCellGains`
  - `metadata` at `metadata offset 615792` records `get_BigAdCellGains`
  - `metadata` at `metadata offset 615811` records `SetBoosterAdBonus`
  - `metadata` at `metadata offset 615829` records `get_FinalBoosterAdBonus`
  - `metadata` at `metadata offset 615853` records `set_FinalBoosterAdBonus`
  - `metadata` at `metadata offset 617854` records `<FinalBoosterAdBonus>k__BackingField`

## Solved vs blocked

- Baseline: `ATU3Button` path id `15810` stays cleared as the comparison shape.
- Blocked target: `ATU3Button` path id `15810` stays blocked.
- Shared present edge types: `serialized-adjacency, shared-effect-to-consumer-family, consumer-family-to-chest-routines`
- Baseline-only present edge types: `consumer-family-to-cell-gain-getters, cell-gain-getters-to-booster-bonus-shell, booster-bonus-shell-to-final-chest-bonus-shell`
- Blocked missing edge types: `exact-cellboost-to-booster-bonus-handoff`

- Both ATU3 consumer traces preserve the direct serialized shell-to-owner-block adjacency and the shared effect-to-consumer-family handoff.
- The new internal read trace adds one checked getter-to-booster bonus aggregation shell inside the AdManager chest consumer family.
- The remaining bounded break is no longer a live search inside the AdManager bonus-aggregation family: the outer chest routine family, the final token-or-diamond chest bonus backing-field shell, and the remaining internal getter-or-booster aggregation family plus the FinalBoosterAdBonus setter-or-backing-field surfaces are now all bounded negative for one exact CellBoostBonus handoff.

## Decision summary

- Verdict: `quarantine`
- Summary: The trace now preserves the internal ATU3 chest bonus-aggregation shell and closes the whole checked AdManager bonus-aggregation family as a bounded negative result for one exact CellBoostBonus handoff.
- Proved edges: `6`
- Negative edges: `1`
- Baseline gap: `exact-cellboost-to-booster-bonus-handoff`

## Current loss

- The checked ATU3 chain now reaches the concrete AdManager consumer family and one tighter internal bonus-aggregation shell, but no committed source yet shows the exact CellBoostBonus read-site or typed-field handoff anywhere inside the checked outer chest routines, final token-or-diamond chest bonus backing fields, remaining getter-or-booster aggregation family, or FinalBoosterAdBonus setter-or-backing-field surfaces.
- The getter family and the booster bonus aggregation shell survive together in committed metadata, while the final token and diamond chest bonus backing fields survive in committed probe output, so the remaining runtime seam is narrow enough to stay quarantined to one exact internal handoff break.
- Because the exact CellBoostBonus runtime read is still missing, this trace should stay as effect-chain completion evidence only and should not widen into prefab, title, or planner promotion.

## Conclusion

- The ATU3 consumer-internal read trace now preserves one checked internal bonus-aggregation shell inside the AdManager chest consumer family, but no committed source yet shows the exact CellBoostBonus read or typed field handoff anywhere inside that checked bonus-aggregation family.
