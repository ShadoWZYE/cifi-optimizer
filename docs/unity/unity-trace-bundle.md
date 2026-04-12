# Unity Trace Bundle

- Target: `token-shop-atu7-mk3-bridge`
- Label: TokenShop ATU7 MK3 bridge pass
- Anchors: `ATU7Button, 15792, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Join goal: Recover one checked shell-to-prefab bridge for the unresolved ATU7Button or path id 15792 row without widening into title-side promotion or broader family remap claims.

## Planner resolution

- Selection mode: `explicit-target`
- Matched family: `token-shop` (TokenShop)
- Run mode: `trace`
- Requested queries: `none`
- Requested anchors: `none`
- Expanded anchor kinds: `ATU7Button (class), 15792 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Decision note: Used explicit target token-shop-atu7-mk3-bridge in the TokenShop family and kept family-aware anchor expansion so the backend records the same checked synonym surface deterministically.

## Execution anchors

- Typed execution anchors: `ATU7Button (class), 15792 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]`
- Direct example: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Planner example: `node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>`
- Accepted anchor kinds: `class, method, string, path id`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.
- Registry target: `token-shop-atu7-mk3-bridge` from `token-shop` via [`data/unity-trace-target-registry.json`](data/unity-trace-target-registry.json)

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

- Shell field: `ATU7Button`
- Shell path id: `15792`
- Owner field block: `MK3TokenBoostStartCost, MK3TokenBoostAdditiveCost, MK3TokenBoostBonus, MK3TokenBoostFillMaxLevel, MK3TokenBoostFill`

## Surface traces

### Metadata neighborhood

- Search terms: `ATU7Button, MK3TokenBoost, BuyMK3TokenBoost, 15792, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `ATU7Button (class), MK3TokenBoost (class), BuyMK3TokenBoost (method), 15792 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat) (12 hits)
  - Signal summary: 0 high-signal, 5 supporting, 7 incidental, 0 suppressed-noise
  - `BuyCellBoost` at metadata offset `659754` [supporting, score 90, exact-string]
  - `BuyMK3TokenBoost` at metadata offset `659813` [supporting, score 90, exact-string]
  - `ATU3Button` at metadata offset `662349` [supporting, score 90, exact-string]
  - `ATU7Button` at metadata offset `662944` [supporting, score 90, exact-string]
  - `SetAllTokenShopTexts` at metadata offset `979315` [supporting, score 90, exact-string]
  - `get_FinalMK3TokenBoostFillMaxLevel` at metadata offset `657301` [incidental, score 45, bounded-containment]
  - `BuyCellBoostEnum` at metadata offset `661133` [incidental, score 45, bounded-containment]
  - `CellBoostStartCost` at metadata offset `662261` [incidental, score 45, bounded-containment]
  - `CellBoostAdditiveCost` at metadata offset `662280` [incidental, score 45, bounded-containment]
  - `MK3TokenBoostStartCost` at metadata offset `662832` [incidental, score 45, bounded-containment]
  - `MK3TokenBoostAdditiveCost` at metadata offset `662855` [incidental, score 45, bounded-containment]
  - `<BuyCellBoostEnum>d__630` at metadata offset `668194` [incidental, score 45, bounded-containment]

### Action hook lane

- Search terms: `BuyMK3TokenBoost, ATU7Button, 15792, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `BuyMK3TokenBoost (method), ATU7Button (class), 15792 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
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
  - `BuyMK3TokenBoost` at `$[0].matches[96].byte_context[82].value` [high-signal, score 100, exact-structured]
  - `BuyMK3TokenBoost` at `$[0].matches[97].byte_context[60].value` [high-signal, score 100, exact-structured]
  - `BuyMK3TokenBoost` at `$[0].matches[97].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyMK3TokenBoost` at `$[0].matches[98].entry_context[25].value` [high-signal, score 100, exact-structured]

### Prefab identity lane

- Search terms: `NewTokenUPGPrefab.T1.MK3Booster, ATU7Button, 15792, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `NewTokenUPGPrefab.T1.MK3Booster (string), ATU7Button (class), 15792 (path id), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (2 hits)
  - Signal summary: 2 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `15792` at `$.directTargetTypeMetadata[6].fields[3105].fieldOffset` [high-signal, score 145, exact-structured]
  - `NewTokenUPGPrefab.T1.MK3Booster` at `$.namedObjectHits[10362].name` [high-signal, score 100, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.MK3Booster` at `$.apk_results[7].keyword_hits.token[8]` [supporting, score 95, exact-structured]
- Source: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `SetAllTokenShopTexts` at `$[0].matches[225].byte_context[48].value` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.MK3Booster` at `$[0].matches[23].byte_context[99].value` [supporting, score 95, exact-structured]

## Bridge check

- Result: `checked object bridge recovered`

## Trace graph

- Present typed edges: `5`
- Negative typed edges: `0`

### Proved joins

- `serialized-adjacency`: The target shell still sits directly beside the MK3TokenBoost owner-field block in the committed TokenShop extract. [direct]
  - `tokenShopExtract` at `$.fields` proves `ATU7Button path_id 15792`
- `declaration-neighborhood`: The metadata neighborhood keeps ATU7Button and the MK3TokenBoost declaration block in one raw declaration area. [contextual]
  - `metadata` at `metadata offset 662944` proves `ATU7Button`
  - `metadata` at `metadata offset 662832` proves `MK3TokenBoostStartCost`
- `exact-shell-to-action-hook`: The checked action lane preserves the matching direct buy hook BuyMK3TokenBoost for the same MK3 row family. [supporting]
  - `tokenShopRowRemapBoundary` at `$.atu7BridgeFollowUp.recoveredBridge.supportingActionHook` proves `BuyMK3TokenBoost`
  - `dailyTokeniumLaneProbe` at `$[0].matches[96].byte_context[82].value` proves `BuyMK3TokenBoost`
- `exact-shell-to-prefab`: The checked prefab roster preserves the exact MK3Booster identity on the same traced row family. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu7BridgeFollowUp.recoveredBridge.prefabIdentity` proves `NewTokenUPGPrefab.T1.MK3Booster`
  - `uabeaProbe` at `$.namedObjectHits[10362].name` proves `NewTokenUPGPrefab.T1.MK3Booster`
- `multi-probe-prefab-corroboration`: Independent unity-probe and LM244-targeted surfaces preserve the same MK3Booster prefab identity, strengthening the bounded shell-to-prefab join without opening title-side inference. [supporting]
  - `unityProbe` at `$.apk_results[7].keyword_hits.token[8]` proves `NewTokenUPGPrefab.T1.MK3Booster`
  - `lm244TargetedProbe` at `$[0].matches[23].byte_context[99].value` proves `NewTokenUPGPrefab.T1.MK3Booster`

### Missing joins


## Solved vs blocked

- Baseline: `ATU7Button` path id `15792` stays cleared as the comparison shape.
- Blocked target: `ATU3Button` path id `15810` stays blocked.
- Shared present edge types: `serialized-adjacency`
- Baseline-only present edge types: `exact-shell-to-action-hook, exact-shell-to-prefab, multi-probe-prefab-corroboration`
- Blocked missing edge types: `exact-shell-to-action-hook, exact-shell-to-prefab, exact-shell-to-title`

- Both rows preserve the direct serialized shell-to-owner-block adjacency.
- The solved ATU7 trace now preserves one checked row-specific buy hook, one exact MK3Booster prefab identity, and multi-probe prefab corroboration.
- ATU3 remains narrower and more blocked because its action, prefab, and title clues still do not converge on one exact shell join.

## Decision summary

- Verdict: `wire`
- Summary: One exact shell-to-prefab bridge cleared cleanly enough to preserve the ATU7 row as checked remap evidence.
- Proved edges: `5`
- Negative edges: `0`
- Baseline gap: `exact-shell-to-action-hook, exact-shell-to-prefab, exact-shell-to-title`

## Current loss

- The shell-side owner window still survives only in the TokenShop extract, where ATU7Button path id 15792 stays adjacent to the MK3TokenBoost owner block.
- This pass checks only the shell-to-action-hook-to-prefab bridge and does not promote any final player-facing title join for ATU7.
- Because the rest of the MK-family shells still lack their own checked joins, keep ATU7 as one bounded remap bridge and leave the neighboring unresolved rows quarantined.

## Conclusion

- The ATU7Button or 15792 bridge clears as one exact shell-to-action-hook-to-prefab join. The row preserves direct shell adjacency to the MK3TokenBoost owner block, the checked action lane preserves BuyMK3TokenBoost, and checked prefab surfaces preserve NewTokenUPGPrefab.T1.MK3Booster, but this pass does not promote any title-side identity claim.
