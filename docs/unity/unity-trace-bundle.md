# Unity Trace Bundle

- Target: `token-shop-atu3-cells-effect`
- Label: TokenShop ATU3 cells effect trace
- Anchors: `ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Join goal: Recover one checked ATU3Button or path id 15810 chain from the TokenShop shell through BuyCellBoost into the shared cells-from-chests effect surface, and keep any remaining typed effect-owner gap bounded if it still does not clear.

## Planner resolution

- Selection mode: `explicit-target`
- Matched family: `token-shop` (TokenShop)
- Run mode: `trace`
- Requested queries: `none`
- Requested anchors: `none`
- Expanded anchor kinds: `ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Decision note: Used explicit target token-shop-atu3-cells-effect in the TokenShop family and kept family-aware anchor expansion so the backend records the same checked synonym surface deterministically.

## Execution anchors

- Typed execution anchors: `ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`

## Workflow

- Command: `node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]`
- Direct example: `node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>`
- Planner example: `node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>`
- Accepted anchor kinds: `class, method, string, path id`
- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.
- Registry target: `token-shop-atu3-cells-effect` from `token-shop` via [`data/unity-trace-target-registry.json`](data/unity-trace-target-registry.json)

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

### Shared effect title lane

- Search terms: `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size> (string), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/daily-tokenium-owner-probe.json`](data/daily-tokenium-owner-probe.json) (2 hits)
  - Signal summary: 0 high-signal, 2 supporting, 0 incidental, 0 suppressed-noise
  - `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>` at `$[0].matches[20].byte_context[19].value` [supporting, score 95, exact-structured]
  - `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>` at `$[0].matches[20].entry_context[14].value` [supporting, score 95, exact-structured]

### Shared effect text lane

- Search terms: `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>., ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>. (method), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/daily-tokenium-lane-probe.json`](data/daily-tokenium-lane-probe.json) (9 hits)
  - Signal summary: 9 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `BuyCellBoost` at `$[0].matches[101].byte_context[41].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[101].entry_context[28].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].byte_context[40].value` [high-signal, score 100, exact-structured]
  - `BuyCellBoost` at `$[0].matches[102].entry_context[25].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].byte_context[118].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].entry_context[16].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[312].value` [high-signal, score 100, exact-structured]
  - `SetAllTokenShopTexts` at `$[0].matches[313].entry_context[4].value` [high-signal, score 100, exact-structured]
  - `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.` at `$[0].matches[46].byte_context[1].value` [high-signal, score 100, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (3 hits)
  - Signal summary: 0 high-signal, 3 supporting, 0 incidental, 0 suppressed-noise
  - `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.` at `$.apk_results[23].keyword_hits.diamond[6]` [supporting, score 95, exact-structured]
  - `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.` at `$.apk_results[23].keyword_hits.token[14]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]

### Detached cells identity surfaces

- Search terms: `BuyCellsBoost, NewDiamondUPGPrefab.Specials.CellsBoost, >Diamond Upgrade 10 - CellsBoost, NewTokenUPGPrefab.T1.CellsPerChestBooster, NewTokenUPGPrefab.T5.UltimaCells, Token Ultima: Cells, ATU3Button, 15810, CellBoost, BuyCellBoost, SetAllTokenShopTexts`
- Typed anchors: `BuyCellsBoost (method), NewDiamondUPGPrefab.Specials.CellsBoost (string), >Diamond Upgrade 10 - CellsBoost (string), NewTokenUPGPrefab.T1.CellsPerChestBooster (string), NewTokenUPGPrefab.T5.UltimaCells (string), Token Ultima: Cells (string), ATU3Button (class), 15810 (path id), CellBoost (class), BuyCellBoost (method), SetAllTokenShopTexts (method)`
- Source: [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json) (3 hits)
  - Signal summary: 0 high-signal, 3 supporting, 0 incidental, 0 suppressed-noise
  - `SetAllTokenShopTexts` at `$[0].matches[225].byte_context[48].value` [supporting, score 95, exact-structured]
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$[0].matches[23].byte_context[89].value` [supporting, score 95, exact-structured]
  - `BuyCellsBoost` at `$[0].matches[61].byte_context[60].value` [supporting, score 95, exact-structured]
- Source: [`data/unity-probe-report.json`](data/unity-probe-report.json) (9 hits)
  - Signal summary: 0 high-signal, 9 supporting, 0 incidental, 0 suppressed-noise
  - `>Diamond Upgrade 10 - CellsBoost` at `$.apk_results[0].keyword_hits.diamond[45]` [supporting, score 95, exact-structured]
  - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.token[25]` [supporting, score 95, exact-structured]
  - `Token Ultima: Cells` at `$.apk_results[23].keyword_hits.ultima[5]` [supporting, score 95, exact-structured]
  - `SetAllTokenShopTexts` at `$.apk_results[32].keyword_hits.token[6]` [supporting, score 95, exact-structured]
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$.apk_results[7].keyword_hits.diamond[16]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.apk_results[7].keyword_hits.token[38]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.apk_results[7].keyword_hits.token[4]` [supporting, score 95, exact-structured]
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.apk_results[7].keyword_hits.ultima[2]` [supporting, score 95, exact-structured]
  - `>Diamond Upgrade 10 - CellsBoost` at `$.file_results[0].keyword_hits.diamond[45]` [supporting, score 95, exact-structured]
- Source: [`data/uabea-probe-report.json`](data/uabea-probe-report.json) (3 hits)
  - Signal summary: 3 high-signal, 0 supporting, 0 incidental, 0 suppressed-noise
  - `NewDiamondUPGPrefab.Specials.CellsBoost` at `$.namedObjectHits[10352].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster` at `$.namedObjectHits[10371].name` [high-signal, score 100, exact-structured]
  - `NewTokenUPGPrefab.T5.UltimaCells` at `$.namedObjectHits[10395].name` [high-signal, score 100, exact-structured]

## Bridge check

- Result: `checked action-to-shared-effect chain recovered`

## Trace graph

- Present typed edges: `6`
- Negative typed edges: `1`

### Proved joins

- `serialized-adjacency`: The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract. [direct]
  - `tokenShopExtract` at `$.fields` proves `ATU3Button path_id 15810`
- `exact-shell-to-action-hook`: The metadata neighborhood and checked lane probe preserve BuyCellBoost as the exact named action hook for the same CellBoost family. [supporting]
  - `metadata` at `metadata offset 662349` proves `ATU3Button`
  - `metadata` at `metadata offset 662261` proves `CellBoostStartCost`
  - `tokenShopRowRemapBoundary` at `$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.supportingActionHook` proves `BuyCellBoost`
  - `dailyTokeniumLaneProbe` at `$[0].matches[101].byte_context[41].value` proves `BuyCellBoost`
- `shared-effect-system`: The checked cross-system effect surface preserves the shared Cells Booster (Chests) title for the same cells-from-chests gameplay lane. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectTitle` proves `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>`
  - `dailyTokeniumOwnerProbe` at `$[0].matches[20].byte_context[19].value` proves `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>`
- `derived-player-effect-surface`: The same shared effect lane preserves one exact player-facing effect string for cells gained from Token and Diamond chests. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectText` proves `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.`
  - `dailyTokeniumLaneProbe` at `$[0].matches[46].byte_context[1].value` proves `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.`
  - `unityProbe` at `$.apk_results[23].keyword_hits.diamond[6]` proves `<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.`
- `parameter-surface`: The raw CellBoost parameter surface preserves the bonus value and max-level cap that bound the shared chest-effect lane. [direct]
  - `tokenShopRowRemapBoundary` at `$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.derivedReading` proves `The raw CellBoost bonus field preserves a value of 1, which is consistent with the surviving player-facing +1-second timeskip effect text for the shared Token & Diamond chest cells-gain lane, while CellBoostMaxLevel preserves the bounded 60-level cap for the same upgrade family.`
  - `tokenShopRowRemapBoundary` at `$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.field` proves `CellBoostBonus`
  - `tokenShopRowRemapBoundary` at `$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.supportingField` proves `CellBoostMaxLevel`
- `detached-identity-contrast`: The older diamond-side and token-side Cells identity surfaces still survive as detached contrast evidence, but they are no longer the main success criterion for this ATU3 pass. [supporting]
  - `tokenShopRowRemapBoundary` at `$.atu3CrossSystemEffectTrace.detachedIdentitySurfaces.groundedConclusion` proves `The older diamond-side CellsBoost and token-side CellsPerChestBooster or Token Ultima: Cells surfaces still survive as detached identity clues, but this effect-driven pass does not force them back into the ATU3 row as a standard shell-to-prefab-to-title remap.`
  - `lm244TargetedProbe` at `$[0].matches[61].byte_context[60].value` proves `BuyCellsBoost`
  - `unityProbe` at `$.apk_results[7].keyword_hits.diamond[16]` proves `NewDiamondUPGPrefab.Specials.CellsBoost`
  - `unityProbe` at `$.apk_results[0].keyword_hits.diamond[45]` proves `>Diamond Upgrade 10 - CellsBoost`
  - `uabeaProbe` at `$.namedObjectHits[10371].name` proves `NewTokenUPGPrefab.T1.CellsPerChestBooster`
  - `unityProbe` at `$.apk_results[7].keyword_hits.token[38]` proves `NewTokenUPGPrefab.T5.UltimaCells`
  - `unityProbe` at `$.apk_results[23].keyword_hits.token[25]` proves `Token Ultima: Cells`

### Missing joins

- `typed-shared-effect-owner`: No committed source currently names the exact runtime chest-reward applier or typed gameplay owner that consumes CellBoostBonus inside the shared Token and Diamond chest cells-gain system. [negative]
  - `tokenShopRowRemapBoundary` at `$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin` records `No committed source currently names the exact runtime chest-reward applier or typed gameplay owner that consumes CellBoostBonus inside the shared Token & Diamond chest cells-gain system, so the checked ATU3 trace currently terminates at the shared effect title and text surface rather than a typed effect-owner method.`

## Solved vs blocked

- Baseline: `ATU3Button` path id `15810` stays cleared as the comparison shape.
- Blocked target: `ATU3Button` path id `15810` stays blocked.
- Shared present edge types: `serialized-adjacency`
- Baseline-only present edge types: `derived-player-effect-surface, exact-shell-to-action-hook, parameter-surface, shared-effect-system`
- Blocked missing edge types: `exact-shell-to-action-hook, shared-effect-system, derived-player-effect-surface`

- Both ATU3 traces preserve the direct serialized shell-to-owner-block adjacency.
- The new effect-driven trace adds one checked BuyCellBoost-to-shared-cells-effect chain plus a bounded parameter surface.
- The older split trace still remains useful as detached identity contrast, but it does not clear the shared chest-effect lane or the derived player-facing effect surface.

## Decision summary

- Verdict: `quarantine`
- Summary: The trace preserves one ATU3 shell-to-action-hook-to-shared-effect chain, but the exact typed gameplay owner for the chest-effect applier still stays unresolved so this row remains quarantined to descriptive remap evidence.
- Proved edges: `6`
- Negative edges: `1`
- Baseline gap: `exact-shell-to-action-hook, shared-effect-system, derived-player-effect-surface`

## Current loss

- The shell-side owner window survives only in the TokenShop extract, where ATU3Button path id 15810 stays adjacent to the CellBoost owner block.
- The shared effect chain now reaches the Cells Booster (Chests) title and the +1 Seconds timeskip to Cells Gained from Token & Diamond Chests text, but no committed source yet names the exact typed gameplay owner that consumes CellBoostBonus inside that chest-effect system.
- The older diamond-side CellsBoost and token-side CellsPerChestBooster or Token Ultima: Cells surfaces still survive as detached identity clues, so this pass must stay effect-driven rather than pretending the row is a standard shell-to-prefab-to-title remap.

## Conclusion

- The ATU3Button or 15810 cross-system trace clears one checked shell-to-action-hook-to-shared-effect chain. The row preserves direct shell adjacency to the CellBoost owner block, the checked action lane preserves BuyCellBoost, the shared title and effect-text surfaces preserve the Cells Booster (Chests) chest-effect lane, and the raw CellBoostBonus value of 1 is consistent with the surviving +1-second player-facing effect text. The remaining break is the exact typed gameplay owner or chest-reward applier that consumes that parameter.
