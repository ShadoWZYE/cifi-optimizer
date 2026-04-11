# Unity Trace Bundle

- Target: `token-shop-atu4-mod`
- Label: TokenShop ATU4 mod bridge
- Anchors: `ATU4Button, 15796, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Join goal: Recover one checked ATU4Button or path id 15796 bridge to one exact prefab identity, and keep the missing title join explicit if it still stays detached.

## Planner resolution

- Selection mode: `explicit-target`
- Matched family: `token-shop` (TokenShop)
- Run mode: `trace`
- Requested queries: `none`
- Requested anchors: `none`
- Expanded anchor kinds: `ATU4Button (class), 15796 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Decision note: Used explicit target token-shop-atu4-mod in the TokenShop family and kept family-aware anchor expansion so the backend records the same checked synonym surface deterministically.

## Execution anchors

- Typed execution anchors: `ATU4Button (class), 15796 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]`
- Direct example: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Planner example: `node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>`
- Accepted anchor kinds: `class, method, string, path id`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.
- Registry target: `token-shop-atu4-mod` from `token-shop` via [`data/unity-trace-target-registry.json`](data/unity-trace-target-registry.json)

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

- Shell field: `ATU4Button`
- Shell path id: `15796`
- Owner field block: `ModBoostStartCost, ModBoostAdditiveCost, ModBoostBonus, ModBoostMaxLevel, ModBoostFill`

## Surface traces

### Metadata neighborhood

- Search terms: `ATU4Button, ModBoost, BuyModBoost, 15796, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `ATU4Button (class), ModBoost (class), BuyModBoost (method), 15796 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (12 hits)
  - Signal summary: 0 high-signal, 5 supporting, 7 incidental, 0 suppressed-noise
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `BuyModBoost` at metadata offset `659767` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `ATU4Button` at metadata offset `662458` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `get_FinalModBoostMaxLevel` at metadata offset `657205` [incidental, score 45, bounded-containment]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `ModBoostStartCost` at metadata offset `662375` [incidental, score 45, bounded-containment]
  - `ModBoostAdditiveCost` at metadata offset `662393` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Action hook lane

- Search terms: `BuyModBoost, ATU4Button, 15796, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `BuyModBoost (method), ATU4Button (class), 15796 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (12 hits)
  - Signal summary: 12 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].byte_context[40].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].byte_context[118].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].entry_context[16].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[313].entry_context[4].value` [high-signal, score 100, exact-structured]
  - `BuyModBoost` at `$[0].matches[68].byte_context[52].value` [high-signal, score 100, exact-structured]
  - `BuyModBoost` at `$[0].matches[68].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyModBoost` at `$[0].matches[69].byte_context[52].value` [high-signal, score 100, exact-structured]
  - `BuyModBoost` at `$[0].matches[69].entry_context[25].value` [high-signal, score 100, exact-structured]

### Prefab identity lane

- Search terms: `NewTokenUPGPrefab.T1.ModPointsBooster, ATU4Button, 15796, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `NewTokenUPGPrefab.T1.ModPointsBooster (string), ATU4Button (class), 15796 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (2 hits)
  - Signal summary: 2 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `15796` at `$.directTargetTypeMetadata[6].fields[3106].fieldOffset` [high-signal, score 145, exact-structured]
  - `NewTokenUPGPrefab.T1.ModPointsBooster` at `$.namedObjectHits[10353].name` [high-signal, score 100, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.ModPointsBooster` at `$.apk_results[7].keyword_hits.token[14]` [supporting, score 95, exact-structured]
- Source: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `SetAllTokenShopTexts` at `$[0].matches[225].byte_context[48].value` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.ModPointsBooster` at `$[0].matches[23].byte_context[90].value` [supporting, score 95, exact-structured]

### Mod title lane

- Search terms: `Token Ultima: MP, :Diamond Upgrade 11 - ModBoost, ATU4Button, 15796, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `Token Ultima: MP (string), :Diamond Upgrade 11 - ModBoost (string), ATU4Button (class), 15796 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (5 hits)
  - Signal summary: 0 high-signal, 5 supporting, 0 incidental, 0 suppressed-noise
  - `:Diamond Upgrade 11 - ModBoost` at `$.apk_results[0].keyword_hits.diamond[22]` [supporting, score 95, exact-structured]
  - `Token Ultima: MP` at `$.apk_results[23].keyword_hits.token[26]` [supporting, score 95, exact-structured]
  - `Token Ultima: MP` at `$.apk_results[23].keyword_hits.ultima[6]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `:Diamond Upgrade 11 - ModBoost` at `$.file_results[0].keyword_hits.diamond[22]` [supporting, score 95, exact-structured]

## Bridge check

- Result: `checked object bridge recovered`

## Trace graph

- Present typed edges: `5`
- Negative typed edges: `1`

### Proved joins

- `serialized-adjacency`: The target shell still sits directly beside the ModBoost owner-field block in the committed TokenShop extract. [direct]
  - `tokenShopExtract` at `$.fields` proves `ATU4Button path_id 15796`
- `declaration-neighborhood`: The metadata neighborhood keeps ATU4Button and the ModBoost declaration block in one raw declaration area. [contextual]
  - `metadata` at `metadata offset 662458` proves `ATU4Button`
  - `metadata` at `metadata offset 662375` proves `ModBoostStartCost`
- `exact-shell-to-action-hook`: The checked action lane preserves the matching direct buy hook BuyModBoost for the same ModBoost row family. [supporting]
  - `tokenShopRowRemapBoundary` at `$.traceFollowUp.recoveredBridge.supportingActionHook` proves `BuyModBoost`
  - `dailyTokeniumLaneProbe` at `$[0].matches[68].byte_context[52].value` proves `BuyModBoost`
- `exact-shell-to-prefab`: The checked prefab roster preserves the exact ModPointsBooster identity on the same traced row family. [direct]
  - `tokenShopRowRemapBoundary` at `$.traceFollowUp.recoveredBridge.prefabIdentity` proves `NewTokenUPGPrefab.T1.ModPointsBooster`
  - `uabeaProbe` at `$.namedObjectHits[10353].name` proves `NewTokenUPGPrefab.T1.ModPointsBooster`
- `title-candidate-surface`: A separate mod-domain title candidate is still preserved, but only as a detached title surface. [supporting]
  - `unityProbe` at `$.apk_results[23].keyword_hits.token[26]` proves `Token Ultima: MP`

### Missing joins

- `exact-shell-to-title`: No committed source proves one exact ATU4 shell-to-final-title join; the surviving Token Ultima: MP title remains detached from the shell-side row neighborhood. [negative]
  - `tokenShopRowRemapBoundary` at `$.traceFollowUp.blockedTitleJoin.missingJoin` records `No committed source currently ties ATU4Button directly to one final player-facing TokenShop row title; the surviving Token Ultima: MP title clue stays detached from the traced ATU4 shell neighborhood.`
  - `unityProbe` at `$.apk_results[23].keyword_hits.token[26]` records `Token Ultima: MP`

## Solved vs blocked

- Baseline: `ATU4Button` path id `15796` stays cleared as the comparison shape.
- Blocked target: `ATU3Button` path id `15810` stays blocked.
- Shared present edge types: `serialized-adjacency`
- Baseline-only present edge types: `exact-shell-to-action-hook, exact-shell-to-prefab`
- Blocked missing edge types: `exact-shell-to-action-hook, exact-shell-to-prefab, exact-shell-to-title`

- Both rows preserve the direct serialized shell-to-owner-block adjacency.
- The solved ATU4 trace now preserves one checked row-specific buy hook and one exact ModPointsBooster prefab identity.
- ATU4 still lacks a final title join, but ATU3 remains narrower and more blocked because its action, prefab, and title clues still do not converge on one exact shell join.

## Decision summary

- Verdict: `quarantine`
- Summary: The trace now preserves one exact shell-to-prefab bridge, but the missing title join still keeps this ATU4 row quarantined to remap evidence.
- Proved edges: `5`
- Negative edges: `1`
- Baseline gap: `exact-shell-to-action-hook, exact-shell-to-prefab, exact-shell-to-title`

## Current loss

- The shell-side owner window survives only in the TokenShop extract, where ATU4Button path id 15796 stays adjacent to the ModBoost owner block.
- The exact BuyModBoost action hook and NewTokenUPGPrefab.T1.ModPointsBooster prefab now converge on the same traced row family, but the final player-facing title still survives only as a detached mod-domain title surface.
- Because the title-side join is still missing, the recovered ATU4 bridge is safe for row-remap evidence only and should not widen into canonical or planner behavior.

## Conclusion

- The ATU4Button or 15796 trace now preserves one checked shell-to-action-hook-to-prefab bridge to NewTokenUPGPrefab.T1.ModPointsBooster, but the final player-facing title join is still unresolved and must stay quarantined.
