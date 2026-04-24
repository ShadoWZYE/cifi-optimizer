# TokenShop System Evidence Extraction Log

## Session: 2026-04-15

### Objective

Fully map the TokenShop system from game assets to extend beyond the current 13 bridged rows.

### Methodology

1. Analyzed the archived TokenShop value snapshot `data/archive/token-shop-values.json` as provenance for the now-active `db:derived:token-shop-values` extract
2. Cross-referenced with archived raw APK extraction `data/archive/unity-apk-extract-report.json` for prefab identities
3. Cross-referenced with archived typed extraction `data/archive/uabea-extract-report.json` for object instances
4. Examined `data/spend-action-lane-clues.json` for buy hooks
5. Reviewed `data/token-shop-row-remap-boundary.json` for existing evidence

### Findings

#### Confirmed Grounded Rows (20 bounded rows or shells)

| ATU   | Prefab Identity                       | Evidence Type                    | Status         |
| ----- | ------------------------------------- | -------------------------------- | -------------- |
| ATU1  | NewTokenUPGPrefab.T1.TokensBoost      | Shell-to-prefab bridge           | ✅ Complete    |
| ATU2  | NewTokenUPGPrefab.T1.DiamondBoost     | Shell-to-prefab bridge           | ✅ Complete    |
| ATU3  | (Effect-driven via CellBoost)         | Effect chain                     | ✅ Complete    |
| ATU4  | NewTokenUPGPrefab.T1.ModPointsBooster | Shell-to-prefab bridge           | ✅ Complete    |
| ATU5  | NewTokenUPGPrefab.T1.MK1Booster       | Shell-to-prefab + named identity | ✅ Complete    |
| ATU6  | NewTokenUPGPrefab.T1.MK2Booster       | Full prefab + title chain        | ✅ Complete    |
| ATU7  | NewTokenUPGPrefab.T1.MK3Booster       | Prefab + title text chain        | ✅ Complete    |
| ATU8  | NewTokenUPGPrefab.T1.MK4Booster       | Prefab + title text chain        | ✅ Complete    |
| ATU9  | NewTokenUPGPrefab.T1.MK5Booster       | Prefab + title text chain        | ✅ Complete    |
| ATU10 | NewTokenUPGPrefab.T1.MK6Booster       | Prefab + title text chain        | ✅ Complete    |
| ATU11 | NewTokenUPGPrefab.T1.MK7Booster       | Prefab bridge only (no title)    | ⚠️ Quarantined |
| ATU12 | NewTokenUPGPrefab.T1.MK8Booster       | Prefab + title text chain        | ✅ Complete    |
| ATU13 | NewTokenUPGPrefab.T2.TokensBoost      | Shell-to-prefab bridge           | ✅ Complete    |
| ATU14 | NewTokenUPGPrefab.T2.DailyTokens      | DB-backed owner-order family     | ⚠️ Quarantined |
| ATU15 | NewTokenUPGPrefab.T2.DuoBoosterOne    | DB-backed owner-order family     | ⚠️ Quarantined |
| ATU16 | NewTokenUPGPrefab.T2.DuoBoosterTwo    | DB-backed owner-order family     | ⚠️ Quarantined |
| ATU17 | NewTokenUPGPrefab.T2.DuoBoosterThree  | DB-backed owner-order family     | ⚠️ Quarantined |
| ATU18 | NewTokenUPGPrefab.T2.DuoBoosterFour   | DB-backed owner-order family     | ⚠️ Quarantined |
| ATU19 | NewTokenUPGPrefab.T2.DuoBoosterFive   | DB-backed owner-order check only | ⚠️ Quarantined |
| ATU20 | NewTokenUPGPrefab.T3.TokensBoost      | Shell-to-prefab bridge           | ✅ Complete    |

#### Evidence for T2 Duo Boosters (ATU14-18)

From `data/archive/uabea-extract-report.json`:

- `NewTokenUPGPrefab.T2.DuoBoosterOne` (line 167226)
- `NewTokenUPGPrefab.T2.DuoBoosterTwo` (line 167126)
- `NewTokenUPGPrefab.T2.DuoBoosterThree` (line 167326)
- `NewTokenUPGPrefab.T2.DuoBoosterFour` (line 167116)
- `NewTokenUPGPrefab.T2.DuoBoosterFive` (line 167346)

From `data/archive/token-shop-values.json`:

- ATU14Button: 15844, TokenDailiesT2 fields (StartCost: 1000, Max: 10)
- ATU15Button: 15850, T2Duo1 fields (StartCost: 1275, Max: 500)
- ATU16Button: 15827, T2Duo2 fields (StartCost: 75, Max: 2500)
- ATU17Button: 15841, T2Duo3 fields (StartCost: 100, Max: 2500)
- ATU18Button: 15834, T2Duo4 fields (StartCost: 125, Max: 2500)
- ATU19Button: 15842, T2Duo5 fields (StartCost: 150, Max: 2500)

**Key Finding**: ATU14 has `ATU14TokenDailiesBonus` and sits directly on `TokenDailiesT2`, so it anchors the whole ATU14-19 shell run as one Daily Tokenium-family sequence instead of the older off-by-one duo or trinity mapping. The active DB-backed target now closes the ATU14 shell-to-title and display seams, while the rest of the family stays bounded to owner-order compatibility and the ATU19 placeholder or duplicate check.

#### Evidence for T3 Trio Family (ATU21-23)

From `data/archive/token-shop-values.json`:

- `ATU21Button` sits on `T3Trio1*`
- `ATU22Button` sits on `T3Trio2*`
- `ATU23Button` is followed directly by `ATU24StartCost`, with no surviving `T3Trio3*` owner block

From `data/archive/unity-apk-extract-report.json`:

- `NewTokenUPGPrefab.T3.TrinityBoosterOne`
- `NewTokenUPGPrefab.T3.TrinityBoosterTwo`

From the active `token-shop-t3-trio-family` DB target:

- `BuyTrio1Boost` and `BuyTrio2Boost` survive as named trio-family buy hooks
- the target clears `exact-shell-to-title` and preserves one bounded `ATU21` title-side join while leaving only `exact-display-update-path` open
- the same target preserves one explicit `ATU23` placeholder-shell check instead of widening into a guessed live third trio row

#### Evidence for Late ATU (ATU24-28)

From `data/archive/token-shop-values.json`:

- ATU24: StartCost 40M, 5 bonus steps (shard-related: ATU24Bonus3Shards)
- ATU25: StartCost 1M, Additive 25K, Max 50
- ATU26: StartCost 10M, Additive 1M, Max 15
- ATU27: StartCost 50M, Additive 10M, Max 15
- ATU28: StartCost 250M, Additive 50M, Max 15

From token-shop-row-remap-boundary.json:

- BuyATU24 through BuyATU28 hooks confirmed in metadata

### Blockers Identified

1. **ATU14-19**:
   - The DB-backed owner-side shell order now clears as one coherent Daily Tokenium-family run: `ATU14 -> TokenDailiesT2`, then `ATU15 -> T2Duo1`, `ATU16 -> T2Duo2`, `ATU17 -> T2Duo3`, `ATU18 -> T2Duo4`, and `ATU19 -> T2Duo5`
   - Matching prefab identities survive in committed UABEA object names: `NewTokenUPGPrefab.T2.DailyTokens` plus `NewTokenUPGPrefab.T2.DuoBoosterOne` through `Five`
   - The active family target is no longer blocked on ATU14 title or display recovery; it now stays bounded because `ATU15-18` remain owner-order or prefab-family rows only and `ATU19` still lacks one final player-facing or runtime-local join

2. **ATU19**:
   - The old `ATU19 == ATU20` duplicate claim no longer survives the checked owner-field order
   - `ATU19Button` sits on `T2Duo5*`, and only the next shell advances into `TokenBoostT3`
   - Placeholder or deprecated status is still unresolved, so this row remains quarantined instead of being promoted

3. **ATU21-23**:
   - The new bounded `token-shop-t3-trio-family` target now materializes cleanly in DB and preserves one coherent T3 trio shell run: `ATU21 -> T3Trio1`, `ATU22 -> T3Trio2`, and `ATU23` as the shell-only edge before `ATU24StartCost`
   - The same target preserves `BuyTrio1Boost`, `BuyTrio2Boost`, and matching `NewTokenUPGPrefab.T3.TrinityBoosterOne/Two` prefab-family candidates
   - The ATU21 row now clears one exact shell-to-title join, and the family target is blocked only on `exact-display-update-path`

4. **ATU23**:
   - Button exists (15828) but no extracted cost fields
   - The active T3 trio-family target now preserves that gap as one explicit placeholder-shell check instead of a guessed hidden third trio row

5. **ATU24-28**:
   - High-cost Ultima/Campaign tier
   - ATU24 has multi-step bonus (shard-related)
   - This is now the next largest coherent adjacent family slice, not a consumed input for the bounded T2/T3 family targets

### Next Steps

1. Keep the grounded `ATU14-19` and `ATU21-23` family targets as bounded endpoints unless a later family pass directly consumes one of their remaining display-side seams
2. Move into the adjacent `ATU24-28` late TokenShop shell family as the next coherent family audit
3. Do not reopen the trace-performance lane unless a newly resumed grounding pass proves one instrument seam is again the true blocker

### Data Sources

- data/archive/token-shop-values.json: archived snapshot of the extracted field structure (227 fields)
- data/archive/unity-apk-extract-report.json: archived prefab roster provenance (NewTokenUPGPrefab.\*)
- data/archive/uabea-extract-report.json: archived typed object-instance provenance (line 167116+)
- token-shop-row-remap-boundary.json: Existing evidence
- spend-action-lane-clues.json: Buy hooks (BuyTrio1Boost, BuyTrio2Boost)
- token-shop-row-remap-boundary.json / token-shop-late-atu-boundary.json: preserved embedded Daily Tokenium buy-family evidence for BuyDuo1-5Boost, BuyTrio1Boost, BuyTrio2Boost, and BuyATU24-28

### Summary

The TokenShop system currently has:

- **14 standard TokenShop rows** (ATU1-13, ATU20): Token, Diamond, Cell, Mod, MK1-8, TokenT2, TokenT3 boosters
- **2 bounded adjacent family targets** (`ATU14-19` and `ATU21-23`): both now materialize as DB-backed family audits instead of archive-only clue bundles
- **2 quarantined shell-local rows** (ATU19, ATU23): one still lacks a final live row-local join, and one now carries an explicit placeholder-shell check
- **1 remaining large unresolved family** (`ATU24-28`): still the next coherent late-family slice

This means the optimizer can work with the 14 standard TokenShop rows that have full cost/benefit data.

### Next Steps for Optimizer

1. Enable optimization only for the standard TokenShop rows (ATU1-13, ATU20)
2. Keep the bounded T2/T3 family targets on their separate compatibility or descriptive lane
3. Keep ATU19 and ATU23 quarantined until one row-specific display join or stronger placeholder verdict clears
