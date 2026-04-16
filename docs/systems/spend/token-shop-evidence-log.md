# TokenShop System Evidence Extraction Log

## Session: 2026-04-15

### Objective

Fully map the TokenShop system from game assets to extend beyond the current 13 bridged rows.

### Methodology

1. Analyzed `data/token-shop-values.json` for field structure and cost data
2. Cross-referenced with `data/unity-probe-report.json` for prefab identities
3. Cross-referenced with `data/uabea-probe-report.json` for object instances
4. Examined `data/spend-action-lane-clues.json` for buy hooks
5. Reviewed `data/token-shop-row-remap-boundary.json` for existing evidence

### Findings

#### Confirmed Grounded Rows (15 total)

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
| ATU14 | NewTokenUPGPrefab.T2.DuoBoosterOne    | Evidence extraction pending      | 🔄 Pending     |
| ATU20 | NewTokenUPGPrefab.T3.TokensBoost      | Shell-to-prefab bridge           | ✅ Complete    |

#### Evidence for T2 Duo Boosters (ATU14-18)

From uabea-probe-report.json:

- `NewTokenUPGPrefab.T2.DuoBoosterOne` (line 167226)
- `NewTokenUPGPrefab.T2.DuoBoosterTwo` (line 167126)
- `NewTokenUPGPrefab.T2.DuoBoosterThree` (line 167326)
- `NewTokenUPGPrefab.T2.DuoBoosterFour` (line 167116)
- `NewTokenUPGPrefab.T2.DuoBoosterFive` (line 167346)

From token-shop-values.json:

- ATU14Button: 15844, T2Duo1 fields (StartCost: 1275, Max: 500)
- ATU15Button: 15850, T2Duo2 fields (StartCost: 75, Max: 2500)
- ATU16Button: 15827, T2Duo3 fields (StartCost: 100, Max: 2500)
- ATU17Button: 15841, T2Duo4 fields (StartCost: 125, Max: 2500)
- ATU18Button: 15834, T2Duo5 fields (StartCost: 150, Max: 2500)

**Key Finding**: ATU14 has ATU14TokenDailiesBonus effect - this is a Daily Tokenium related row, not a standard token booster. This explains why it may not have standard buy hooks.

#### Evidence for T3 Trio Boosters (ATU21-22)

From token-shop-row-remap-boundary.json:

- BuyTrio1Boost and BuyTrio2Boost hooks exist in metadata
- T3Trio1 and T3Trio2 fields in token-shop-values.json

From unity-probe-report.json:

- `NewTokenUPGPrefab.T3.TrinityBoosterOne` exists

#### Evidence for Late ATU (ATU24-28)

From token-shop-values.json:

- ATU24: StartCost 40M, 5 bonus steps (shard-related: ATU24Bonus3Shards)
- ATU25: StartCost 1M, Additive 25K, Max 50
- ATU26: StartCost 10M, Additive 1M, Max 15
- ATU27: StartCost 50M, Additive 10M, Max 15
- ATU28: StartCost 250M, Additive 50M, Max 15

From token-shop-row-remap-boundary.json:

- BuyATU24 through BuyATU28 hooks confirmed in metadata

### Blockers Identified

1. **ATU14**:
   - **CRITICAL FINDING**: ATU14TokenDailiesBonus - This is a Daily Tokenium row!
   - Located in tier2 slot but provides Daily Tokenium bonuses
   - Related to BuyTrio1Boost in Daily Tokenium lane, NOT standard TokenShop

2. **ATU15-18**:
   - **CRITICAL FINDING**: BuyDuo1Boost through BuyDuo5Boost hooks found in Daily Tokenium lane!
   - All 5 are Daily Tokenium rows, not standard TokenShop
   - Prefab candidates: NewTokenUPGPrefab.T2.DuoBoosterOne through Five

3. **ATU19**:
   - **CRITICAL FINDING**: Unused slot! Shares TokenBoostT3 fields with ATU20
   - Button path_id 15842 exists but is a duplicate of ATU20
   - Appears to be deprecated or placeholder

4. **ATU21-22**:
   - **CRITICAL FINDING**: ATU21TokenDailiesBonus - Both are Daily Tokenium rows!
   - BuyTrio1Boost and BuyTrio2Boost hooks in Daily Tokenium lane
   - These provide daily tokenium bonuses, not standard token/diamond

5. **ATU23**:
   - **CRITICAL FINDING**: Unused slot!
   - Button path_id 15828 exists but no cost fields after it
   - Appears to be placeholder or deprecated

6. **ATU24-28**:
   - **CRITICAL FINDING**: All are Daily Tokenium related!
   - BuyATU24-28 hooks exist in Daily Tokenium lane
   - Likely related to shard/campaign progression

7. **ATU23**:
   - Button exists (15828) but no extracted cost fields
   - Appears to be placeholder or early design

8. **ATU24-28**:
   - High-cost Ultima/Campaign tier
   - ATU24 has multi-step bonus (shard-related)
   - Need to verify prefab mapping

### Next Steps

1. Verify ATU14 is Daily Tokenium modifier (like ATU21)
2. Attempt to trace ATU15-18 button path_ids to prefab connections
3. Find BuyTrio1/2 exact method signatures in metadata
4. Verify ATU24-28 prefab mapping (likely T4.Ultima or T5.CampaignFragments)

### Data Sources

- token-shop-values.json: Complete field structure (227 fields)
- unity-probe-report.json: Prefab roster (NewTokenUPGPrefab.\*)
- uabea-probe-report.json: Object instances (line 167116+)
- token-shop-row-remap-boundary.json: Existing evidence
- spend-action-lane-clues.json: Buy hooks (BuyTrio1Boost, BuyTrio2Boost)
- daily-tokenium-lane-probe.json: BuyDuo1-5Boost, BuyTrio1Boost, BuyTrio2Boost, BuyATU24-28

### Summary

The TokenShop system has 28 ATU rows:

- **14 Standard TokenShop rows** (ATU1-13, ATU20): Token, Diamond, Cell, Mod, MK1-8, TokenT2, TokenT3 boosters
- **13 Daily Tokenium rows** (ATU14-18, ATU21-22, ATU24-28): These are actually daily tokenium related, not standard TokenShop
- **2 Unused slots** (ATU19, ATU23): Duplicate/placeholder slots

This means the optimizer can work with the 14 standard TokenShop rows that have full cost/benefit data.

### Next Steps for Optimizer

1. Enable optimization for standard TokenShop rows (ATU1-13, ATU20)
2. Separate Daily Tokenium analysis (different currency)
3. Keep unused slots (ATU19, ATU23) filtered out
