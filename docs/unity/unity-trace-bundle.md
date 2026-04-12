# Unity Trace Bundle

- Target: `token-shop-atu3-chest-consumer`
- Label: TokenShop ATU3 chest consumer seam
- Anchors: `ATU3Button, 15810, BuyCellBoost, AdManager, Assembly-CSharp, CellBoost, SetAllTokenShopTexts`
- Join goal: Recover one checked handoff from the ATU3 shared Cells Booster (Chests) effect lane into the concrete chest-reward consumer family, and keep the exact CellBoostBonus read or typed field handoff bounded if it still does not clear.

## Planner resolution

- Selection mode: `explicit-target`
- Matched family: `token-shop` (TokenShop)
- Run mode: `trace`
- Requested queries: `none`
- Requested anchors: `none`
- Expanded anchor kinds: `ATU3Button (class), 15810 (path id), BuyCellBoost (method), AdManager, Assembly-CSharp (string), CellBoost (class), SetAllTokenShopTexts (method)`
- Decision note: Used explicit target token-shop-atu3-chest-consumer in the TokenShop family and kept family-aware anchor expansion so the backend records the same checked synonym surface deterministically.

## Execution anchors

- Typed execution anchors: `ATU3Button (class), 15810 (path id), BuyCellBoost (method), AdManager, Assembly-CSharp (string), CellBoost (class), SetAllTokenShopTexts (method)`

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]`
- Direct example: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Planner example: `node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>`
- Accepted anchor kinds: `class, method, string, path id`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.
- Registry target: `token-shop-atu3-chest-consumer` from `token-shop` via [`data/unity-trace-target-registry.json`](data/unity-trace-target-registry.json)

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

- Search terms: `ATU3Button, CellBoost, BuyCellBoost, 15810, AdManager, Assembly-CSharp, SetAllTokenShopTexts`
- Typed anchors: `ATU3Button (class), CellBoost (class), BuyCellBoost (method), 15810 (path id), AdManager, Assembly-CSharp (string), SetAllTokenShopTexts (method)`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (7 hits)
  - Signal summary: 0 high-signal, 3 supporting, 4 incidental, 0 suppressed-noise
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Shared effect title lane

- Search terms: `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>, ATU3Button, 15810, BuyCellBoost, AdManager, Assembly-CSharp, CellBoost, SetAllTokenShopTexts`
- Typed anchors: `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size> (string), ATU3Button (class), 15810 (path id), BuyCellBoost (method), AdManager, Assembly-CSharp (string), CellBoost (class), SetAllTokenShopTexts (method)`
- Source: [`data/daily-tokenium-owner-probe.json`](data/daily-tokenium-owner-probe.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>` at `$[0].matches[20].byte_context[19].value` [supporting, score 95, exact-structured]
  - `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>` at `$[0].matches[20].entry_context[14].value` [supporting, score 95, exact-structured]

### Shared effect text lane

- Search terms: `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>., ATU3Button, 15810, BuyCellBoost, AdManager, Assembly-CSharp, CellBoost, SetAllTokenShopTexts`
- Typed anchors: `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>. (method), ATU3Button (class), 15810 (path id), BuyCellBoost (method), AdManager, Assembly-CSharp (string), CellBoost (class), SetAllTokenShopTexts (method)`
- Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (13 hits)
  - Signal summary: 13 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].byte_context[40].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].byte_context[118].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].entry_context[16].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[313].entry_context[4].value` [high-signal, score 100, exact-structured]
  - `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.` at `$[0].matches[46].byte_context[1].value` [high-signal, score 100, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[76].byte_context[58].value` [high-signal, score 100, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[76].byte_context[64].value` [high-signal, score 100, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[76].byte_context[67].value` [high-signal, score 100, exact-structured]
  - `AdManager, Assembly-CSharp` at `$[0].matches[76].byte_context[70].value` [high-signal, score 100, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (3 hits)
  - Signal summary: 0 high-signal, 3 supporting, 0 incidental, 0 suppressed-noise
  - `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.` at `$.apk_results[23].keyword_hits.diamond[6]` [supporting, score 95, exact-structured]
  - `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.` at `$.apk_results[23].keyword_hits.token[14]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]

### Chest consumer family

- Search terms: `AdManager, Assembly-CSharp, SetAdChestTexts, OfflineManager, Assembly-CSharp, DailyAndAdCounterChecker, ATU3Button, 15810, BuyCellBoost, CellBoost, SetAllTokenShopTexts`
- Typed anchors: `AdManager, Assembly-CSharp (string), SetAdChestTexts (method), OfflineManager, Assembly-CSharp (string), DailyAndAdCounterChecker (class), ATU3Button (class), 15810 (path id), BuyCellBoost (method), CellBoost (class), SetAllTokenShopTexts (method)`
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

### Chest routine and bonus shell

- Search terms: `StartTokenRoutine, <TokenChestRoutine>d__149, GoToClosedTokenChest, StartDiamondRoutine, <DiamondChestRoutine>d__155, GoToClosedDiamondChest, get_SmallAdCellGains, get_BigAdCellGains, <FinalAdTokenChestBonus>k__BackingField, <FinalDiamondChestBonus>k__BackingField, ATU3Button, 15810, BuyCellBoost, AdManager, Assembly-CSharp, CellBoost, SetAllTokenShopTexts`
- Typed anchors: `StartTokenRoutine (method), <TokenChestRoutine>d__149 (method), GoToClosedTokenChest (class), StartDiamondRoutine (method), <DiamondChestRoutine>d__155 (method), GoToClosedDiamondChest (class), get_SmallAdCellGains (method), get_BigAdCellGains (method), <FinalAdTokenChestBonus>k__BackingField (method), <FinalDiamondChestBonus>k__BackingField (method), ATU3Button (class), 15810 (path id), BuyCellBoost (method), AdManager, Assembly-CSharp (string), CellBoost (class), SetAllTokenShopTexts (method)`
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (15 hits)
  - Signal summary: 0 high-signal, 15 supporting, 0 incidental, 0 suppressed-noise
  - `<DiamondChestRoutine>d__155` at `$.apk_results[0].keyword_hits.diamond[32]` [supporting, score 95, exact-structured]
  - `<FinalDiamondChestBonus>k__BackingField` at `$.apk_results[0].keyword_hits.diamond[38]` [supporting, score 95, exact-structured]
  - `<FinalAdTokenChestBonus>k__BackingField` at `$.apk_results[0].keyword_hits.token[46]` [supporting, score 95, exact-structured]
  - `<TokenChestRoutine>d__149` at `$.apk_results[0].keyword_hits.token[64]` [supporting, score 95, exact-structured]
  - `GoToClosedDiamondChest` at `$.apk_results[24].keyword_hits.diamond[17]` [supporting, score 95, exact-structured]
  - `GoToClosedTokenChest` at `$.apk_results[24].keyword_hits.token[7]` [supporting, score 95, exact-structured]
  - `GoToClosedDiamondChest` at `$.apk_results[26].keyword_hits.diamond[14]` [supporting, score 95, exact-structured]
  - `GoToClosedDiamondChest` at `$.apk_results[27].keyword_hits.diamond[8]` [supporting, score 95, exact-structured]
  - `GoToClosedTokenChest` at `$.apk_results[27].keyword_hits.token[9]` [supporting, score 95, exact-structured]
  - `GoToClosedTokenChest` at `$.apk_results[28].keyword_hits.token[18]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `<DiamondChestRoutine>d__155` at `$.file_results[0].keyword_hits.diamond[32]` [supporting, score 95, exact-structured]
  - `<FinalDiamondChestBonus>k__BackingField` at `$.file_results[0].keyword_hits.diamond[38]` [supporting, score 95, exact-structured]
  - `<FinalAdTokenChestBonus>k__BackingField` at `$.file_results[0].keyword_hits.token[46]` [supporting, score 95, exact-structured]
  - `<TokenChestRoutine>d__149` at `$.file_results[0].keyword_hits.token[64]` [supporting, score 95, exact-structured]
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (17 hits)
  - Signal summary: 0 high-signal, 13 supporting, 4 incidental, 0 suppressed-noise
  - `StartTokenRoutine` at metadata offset `615527` [supporting, score 90, exact-string]
  - `StartDiamondRoutine` at metadata offset `615579` [supporting, score 90, exact-string]
  - `GoToClosedTokenChest` at metadata offset `615670` [supporting, score 90, exact-string]
  - `GoToClosedDiamondChest` at metadata offset `615712` [supporting, score 90, exact-string]
  - `get_SmallAdCellGains` at metadata offset `615771` [supporting, score 90, exact-string]
  - `get_BigAdCellGains` at metadata offset `615792` [supporting, score 90, exact-string]
  - `<DiamondChestRoutine>d__155` at metadata offset `618397` [supporting, score 90, exact-string]
  - `<TokenChestRoutine>d__149` at metadata offset `618447` [supporting, score 90, exact-string]
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `<FinalAdTokenChestBonus>k__BackingField` at metadata offset `1847394` [supporting, score 90, exact-string]
  - `<FinalDiamondChestBonus>k__BackingField` at metadata offset `1847553` [supporting, score 90, exact-string]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Concrete chest objects

- Search terms: `TokenChest, DiamondChest, ATU3Button, 15810, BuyCellBoost, AdManager, Assembly-CSharp, CellBoost, SetAllTokenShopTexts`
- Typed anchors: `TokenChest (class), DiamondChest (class), ATU3Button (class), 15810 (path id), BuyCellBoost (method), AdManager, Assembly-CSharp (string), CellBoost (class), SetAllTokenShopTexts (method)`
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (2 hits)
  - Signal summary: 2 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `DiamondChest` at `$.namedObjectHits[247].name` [high-signal, score 100, exact-structured]
  - `TokenChest` at `$.namedObjectHits[408].name` [high-signal, score 100, exact-structured]

## Bridge check

- Result: `checked shared-effect-to-consumer-family handoff recovered`

## Trace graph

- Present typed edges: `7`
- Negative typed edges: `1`

### Proved joins

- `serialized-adjacency`: The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract. [direct]
  - `tokenShopExtract` at `$.fields` proves `ATU3Button path_id 15810`
- `shared-effect-system`: The already-grounded ATU3 effect lane preserves the shared Cells Booster (Chests) title and player-facing chest-effect text. [direct]
  - `metadata` at `metadata offset 662349` proves `ATU3Button`
  - `metadata` at `metadata offset 662261` proves `CellBoostStartCost`
  - `dailyTokeniumOwnerProbe` at `$[0].matches[20].byte_context[19].value` proves `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>`
  - `dailyTokeniumLaneProbe` at `$[0].matches[46].byte_context[1].value` proves `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.`
  - `unityProbe` at `$.apk_results[23].keyword_hits.diamond[6]` proves `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.`
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerTrace.recoveredConsumerHandoff.sharedEffectTitle` proves `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>`
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerTrace.recoveredConsumerHandoff.sharedEffectText` proves `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.`
- `shared-effect-to-consumer-family`: The ATU3 shared chest-effect lane now hands off into the concrete AdManager chest consumer family. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerSystem` proves `AdManager, Assembly-CSharp`
  - `dailyTokeniumLaneProbe` at `$[0].matches[76].byte_context[58].value` proves `AdManager, Assembly-CSharp`
  - `dailyTokeniumLaneProbe` at `$[0].matches[195].byte_context[73].value` proves `SetAdChestTexts`
  - `lm244TargetedProbe` at `$[0].matches[174].byte_context[21].value` proves `OfflineManager, Assembly-CSharp`
  - `lm244TargetedProbe` at `$[0].matches[174].byte_context[22].value` proves `DailyAndAdCounterChecker`
- `consumer-family-to-chest-routines`: The same consumer family preserves the token and diamond chest routine neighborhood. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerMethodFamily` proves `StartTokenRoutine, <TokenChestRoutine>d__149, GoToClosedTokenChest, StartDiamondRoutine, <DiamondChestRoutine>d__155, GoToClosedDiamondChest`
  - `metadata` at `metadata offset 615527` proves `StartTokenRoutine`
  - `unityProbe` at `$.apk_results[0].keyword_hits.token[64]` proves `<TokenChestRoutine>d__149`
  - `metadata` at `metadata offset 615670` proves `GoToClosedTokenChest`
  - `metadata` at `metadata offset 615579` proves `StartDiamondRoutine`
  - `unityProbe` at `$.apk_results[0].keyword_hits.diamond[32]` proves `<DiamondChestRoutine>d__155`
  - `metadata` at `metadata offset 615712` proves `GoToClosedDiamondChest`
- `consumer-family-to-bonus-shell`: The same runtime shell preserves the chest-reward bonus and cell-gain shell adjacent to the ATU3 consumer family. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerBonusShell` proves `get_SmallAdCellGains, get_BigAdCellGains, <FinalAdTokenChestBonus>k__BackingField, <FinalDiamondChestBonus>k__BackingField`
  - `metadata` at `metadata offset 615771` proves `get_SmallAdCellGains`
  - `metadata` at `metadata offset 615792` proves `get_BigAdCellGains`
  - `unityProbe` at `$.apk_results[0].keyword_hits.token[46]` proves `<FinalAdTokenChestBonus>k__BackingField`
  - `unityProbe` at `$.apk_results[0].keyword_hits.diamond[38]` proves `<FinalDiamondChestBonus>k__BackingField`
- `consumer-family-to-chest-objects`: Committed object output preserves the concrete token and diamond chest objects used by the same consumer family. [supporting]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerTrace.recoveredConsumerHandoff.supportingChestObjects` proves `TokenChest, DiamondChest`
  - `uabeaProbe` at `$.namedObjectHits[408].name` proves `TokenChest`
  - `uabeaProbe` at `$.namedObjectHits[247].name` proves `DiamondChest`
- `derived-player-effect-surface`: The preserved +1 seconds cells-from-chests effect surface now narrows onto the same token and diamond chest routine family rather than floating as detached text. [supporting]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerTrace.recoveredConsumerHandoff.groundedConclusion` proves `The ATU3 shared Cells Booster (Chests) lane now has one checked handoff into the chest-reward consumer family because committed metadata preserves StartTokenRoutine, TokenChestRoutine, StartDiamondRoutine, DiamondChestRoutine, and the closed-chest route methods in one chest-handling neighborhood, committed probe output preserves the same route beside AdManager, SetAdChestTexts, OfflineManager, and DailyAndAdCounterChecker, the same runtime shell also preserves get_SmallAdCellGains, get_BigAdCellGains, FinalAdTokenChestBonus, and FinalDiamondChestBonus, and committed level0 object output preserves the concrete TokenChest and DiamondChest game objects. That is enough to narrow the consumer seam to the AdManager chest routine family rather than a generic shared-effect text surface.`
  - `dailyTokeniumOwnerProbe` at `$[0].matches[20].byte_context[19].value` proves `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>`
  - `unityProbe` at `$.apk_results[0].keyword_hits.token[64]` proves `<TokenChestRoutine>d__149`
  - `unityProbe` at `$.apk_results[0].keyword_hits.diamond[32]` proves `<DiamondChestRoutine>d__155`

### Missing joins

- `exact-cellboost-consumer-method`: No committed source yet shows the exact CellBoostBonus read or typed field handoff inside the AdManager chest routine family that applies the ATU3 cells-from-chests timeskip effect. [negative]
  - `tokenShopRowRemapBoundary` at `$.atu3ChestConsumerTrace.missingParameterConsumerSeam.missingJoin` records `No committed source yet shows the exact CellBoostBonus read or typed field handoff inside the AdManager chest routine family that applies the ATU3 cells-from-chests timeskip effect. The checked trace now reaches the concrete chest consumer family, its token and diamond chest routine methods, and the final chest-bonus shell, but still stops short of one exact CellBoostBonus -> TokenChestRoutine, DiamondChestRoutine, FinalAdTokenChestBonus, or FinalDiamondChestBonus handoff.`

## Solved vs blocked

- Baseline: `ATU3Button` path id `15810` stays cleared as the comparison shape.
- Blocked target: `ATU3Button` path id `15810` stays blocked.
- Shared present edge types: `serialized-adjacency, shared-effect-system`
- Baseline-only present edge types: `consumer-family-to-bonus-shell, consumer-family-to-chest-objects, consumer-family-to-chest-routines, shared-effect-to-consumer-family`
- Blocked missing edge types: `shared-effect-to-consumer-family, consumer-family-to-chest-routines, consumer-family-to-bonus-shell, consumer-family-to-chest-objects`

- Both ATU3 traces preserve the direct serialized shell-to-owner-block adjacency and the shared Cells Booster (Chests) effect lane.
- The new consumer-seam trace adds one checked handoff into the AdManager chest consumer family, its chest-routine neighborhood, the final chest-bonus shell, and the concrete chest objects.
- The remaining honest blocker is now only the exact CellBoostBonus read or typed field handoff inside that consumer family.

## Decision summary

- Verdict: `quarantine`
- Summary: The trace now preserves one checked ATU3 shared-effect-to-consumer-family handoff into the AdManager chest routine neighborhood, but the exact CellBoostBonus read or typed field handoff still stays bounded negative.
- Proved edges: `7`
- Negative edges: `1`
- Baseline gap: `shared-effect-to-consumer-family, consumer-family-to-chest-routines, consumer-family-to-bonus-shell, consumer-family-to-chest-objects`

## Current loss

- The shell-side owner window still survives only in the TokenShop extract, where ATU3Button path id 15810 stays adjacent to the CellBoost owner block.
- The upgraded cross-system trace now reaches the concrete AdManager chest routine family through StartTokenRoutine, TokenChestRoutine, StartDiamondRoutine, DiamondChestRoutine, the closed-chest route methods, and the final chest-bonus shell, but no committed source yet shows the exact CellBoostBonus read or typed field handoff inside that family.
- Because the exact CellBoostBonus consumer seam is still missing, keep ATU3 quarantined as an effect-driven row and do not convert this target into a standard prefab-or-title TokenShop remap claim.

## Conclusion

- The ATU3Button or 15810 consumer-seam trace now clears one checked shared-effect-to-consumer-family handoff. The row preserves direct shell adjacency to the CellBoost owner block, the already-grounded shared Cells Booster (Chests) effect lane, the concrete AdManager chest routine family, the final chest-bonus shell, and the TokenChest or DiamondChest objects, but the exact CellBoostBonus read or typed field handoff inside that consumer family still remains unresolved.
