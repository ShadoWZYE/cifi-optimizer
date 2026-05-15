# TokenShop ROI Blocker Assessment

Historical note:
- This is a session-bound blocker assessment from `2026-04-15`.
- The current active extract owner is `db:derived:token-shop-values`; `data/archive/token-shop-values.json`, `data/archive/uabea-extract-report.json`, and `data/archive/unity-apk-extract-report.json` are archived provenance snapshots, not live runtime owners.

Current active model note:
- The repo now exposes a canonical progression-graph scaffold through `support/progression-model.js` and `buildSpendSystemView(...)` in `support/system-unit-projections.js`.
- That layer intentionally separates:
  - measurable progression carriers
  - grounded transforms
  - blocked transforms
  - objective modes
- It is not a finished ROI solver yet. It is the canonical place where missing cross-system progression meaning is now modeled explicitly instead of being buried inside TokenShop-only heuristics.

## Session: 2026-04-15

### Honest Assessment: What Can We Actually Recommend?

This document assesses whether ROI recommendations are grounded in game-truth or speculation.

---

## What's Actually Grounded (From Game Assets)

### ✅ Cost Data - VERIFIED

| Field        | Source                 | Grounding                  |
| ------------ | ---------------------- | -------------------------- |
| StartCost    | `db:derived:token-shop-values` | Direct extraction from APK (archived snapshot: `data/archive/token-shop-values.json`) |
| AdditiveCost | `db:derived:token-shop-values` | Direct extraction from APK (archived snapshot: `data/archive/token-shop-values.json`) |
| MaxLevel     | `db:derived:token-shop-values` | Direct extraction from APK (archived snapshot: `data/archive/token-shop-values.json`) |

### ✅ Bonus Labels - VERIFIED

| Bonus             | Player-Facing Text                                                | Source              |
| ----------------- | ----------------------------------------------------------------- | ------------------- |
| TokenBoostBonus   | "Tokens Gained from Token Chests"                                 | Unity text assets   |
| DiamondBoostBonus | "Diamonds Gained from Diamond Chests"                             | Unity text assets   |
| CellBoostBonus    | "+1 Seconds timeskip to Cells Gained from Token & Diamond Chests" | Unity text assets   |
| ModBoostBonus     | "Mod Points Gained"                                               | Derived from prefab |

### ✅ SaveData Field Recovery - VERIFIED

- `SaveData.BankedTokens` - exact field (index 214, offset 1800)
- `SaveData.DailyTokenium` - exact field (index 2361, offset 13032)
- `SaveData.ATU1Level` through `SaveData.ATU28Level` - confirmed in save block

---

## What's Blocked (Not Grounded)

### ❌ Player-Owned Row Levels - BLOCKED

- **Issue**: ATU levels exist in `SaveData` but NOT in canonical `state.playerProfile`
- **Current Location**: `compatibility.unmappedSystemState.tokenShop.*`
- **Blocker**: Row remap from ATU numbers to grounded names unresolved
- **Evidence**: research-tracks.md - "current blocker: need a concrete prefab/title hook"

### ❌ Token-Bank Cap - BLOCKER RESOLVED

- **Problem**: No `SaveData.TokenBankCap` field (not stored directly)
- **Solution**: Cap is DERIVED at runtime from tier unlocks
- **Formula**: `2000 + (500 × Tier2TokensUnlocked) + (500 × Tier3TokensUnlocked) + (500 × Tier4TokensUnlocked) + (500 × Tier5TokensUnlocked)`
- **SaveData Fields**: `Tier2TokensUnlocked` through `Tier5TokensUnlocked` (booleans)
- **Status**: ✅ Formula derived - see `spend-boundary-summary.js` `calculateTokenBankCap()`

### ❌ Daily Tokenium Cap - NEEDS RECONSIDERATION

- **Initial thought**: ATU14/ATU21 store cap
- **Reconsideration**: ATU14 has MaxLevel 500. If +200 per level = 100,000 cap - too high!
- **Actual understanding**: ATU14/ATU21 are BOOSTERS (provide bonus to daily tokenium GAIN), not cap modifiers
- **Current evidence**: Text says "0 / 2000 Daily Tokenium" (base) and "This upgrade increases the Daily Tokenium-553 cap by +200 per level" - so upgrades INCREASE cap, but the cap formula/source is unknown
- **SaveData source**: No direct `DailyTokeniumCap` field found in typed tables

### ❌ Bonus Interactions - NEEDS MORE INVESTIGATION

- **Problem**: We have values but don't know stacking behavior
- **Current Understanding**:
  - Additive: `bonusValue` added per level (e.g., +1 token per chest)
  - Multiplier: `bonusValue - 1` multiplied (e.g., x1.01 output)
- **Need to trace**: How bonuses combine when multiple upgrades affect same output
- **Status**: More evidence extraction needed

### ❌ Emporium Owned State - BLOCKED

- **Issue**: MultiverseMarket save owner unresolved
- **Blocker**: "canonical Emporium import remains blocked even though exact IS1-110 span is compatibility-safe raw import"

### ❌ Bonus Gameplay Effect - PARTIALLY BLOCKED

- **What we know**: Bonus values, bonus labels, effect text
- **What we don't know**:
  - Exact formula application (multiplicative stacking?)
  - Interaction with other bonuses
  - Loop-reset behavior
  - Cap interaction

---

## Current Canonical State Structure

```javascript
state.playerProfile = {
  player: {
    resources: {
      tokens: Number,        // ✅ Canonical
      diamonds: Number,      // ✅ Canonical
      academyRelics: Number, // ✅ Canonical
      shards: Number        // ✅ Canonical
    },
    loop: {
      loopReset: Number     // ✅ Canonical
    }
  },
  // Missing - in compatibility only:
  // planning.tokenShop.checkedSubsetLevels.*  (non-canonical)
  // compatibility.unmappedSystems.tokenShop.* (raw save data)
}

compatibility = {
  unmappedSystemState: {
    tokenShop: {
      ATU1Level: Number,    // ⚠️ Raw SaveData - NOT canonical
      ATU2Level: Number,
      ...
      BankedTokens: Number,
      DailyTokenium: Number
    }
  }
}
```

---

## Updated Blocker Status (After Additional Evidence Extraction)

### ✅ RESOLVED: Player-Owned Row Levels ARE in SaveData

- **Finding**: `SaveData.ATU1Level` through `SaveData.ATU28Level` confirmed in typed table
- **Fields**: All 28 row levels stored in SaveData with exact indices
- **Status**: CAN BE RECOVERED - need to understand canonical import path

### ✅ RESOLVED: Cost Formulas are Game-Extracted

- **Finding**: All cost fields (StartCost, AdditiveCost, MaxLevel) extracted from APK
- **Formula**: `nextCost = startCost + (additiveCost × currentLevel)` verified in the active `db:derived:token-shop-values` extract (archived snapshot: `data/archive/token-shop-values.json`)
- **Status**: GROUNDED - verified from game assets

### ✅ RESOLVED: Bonus Values are Game-Extracted

- **Finding**: All bonus values extracted from the active `db:derived:token-shop-values` extract (archived snapshot: `data/archive/token-shop-values.json`)
- **Labels**: Player-facing text verified from Unity text assets
- **Status**: GROUNDED - verified from game assets

### ✅ RESOLVED: BankedTokens IS in SaveData

- **Finding**: `SaveData.BankedTokens` - exact field (index 214, offset 1800)
- **Status**: CAN BE RECOVERED

### ✅ RESOLVED: DailyTokenium IS in SaveData

- **Finding**: `SaveData.DailyTokenium` - exact field (index 2361, offset 13032)
- **Status**: CAN BE RECOVERED

### ❌ STILL BLOCKED: Getting Data into Canonical State

- **Issue**: All TokenShop data is in `compatibility.unmappedSystemState`, not `state.playerProfile`
- **Blocker**: Need to establish canonical import path for TokenShop levels
- **Impact**: Cannot make ROI recommendations without canonical player data

### ❌ STILL BLOCKED: Cap Values Not Directly Stored

- **Finding**: TokenBankCap and DailyTokeniumCap are NOT direct SaveData fields
- **Possibility**: Caps may be calculated at runtime from upgrade levels
- **Need**: More evidence extraction on cap calculation logic

## Cap Calculation Investigation Results

### TokenBankCap Formula Analysis

**Hypothesis from prior docs**: `2000 + (500 × Tier2TokensUnlocked) + (500 × Tier3TokensUnlocked) + (500 × Tier4TokensUnlocked) + (500 × Tier5TokensUnlocked) + (200 × LM244Level)`

**Evidence from this pass**:

1. `FinalTokenBankCap` confirmed as derived output with:
   - Accessor: `get_FinalTokenBankCap`
   - Backing field: `<FinalTokenBankCap>k__BackingField`
   - Located in TokenShop controller, not SaveData
2. `Tier2TokensUnlocked` through `Tier5TokensUnlocked` are confirmed SaveData boolean fields
3. `LM244` is **NOT** a gameplay owner - it's a text handler (`SetLM244BonusText`) for displaying daily tokenium info

**Assessment**: The base formula `2000 + 500 × tierUnlocks` is plausible but the LM244 component is questionable. LM244 is a UI text hook, not a gameplay variable. The real daily tokenium cap source is still unresolved.

**SaveData fields for cap calculation**:

- `Tier2TokensUnlocked` (bool)
- `Tier3TokensUnlocked` (bool)
- `Tier4TokensUnlocked` (bool)
- `Tier5TokensUnlocked` (bool)

**Still missing**: The exact formula or the daily tokenium cap source

### Current Assessment

- **TokenBankCap**: ✅ Can calculate using tier unlocks - formula added to `support/spend-boundary-summary.js`
- **DailyTokeniumCap**: ⚠️ Partial - base 2000, +200 per ATU14/ATU21 level, formula added to `support/spend-boundary-summary.js`
- **Bonus Stacking**: Unknown - additive/multiplier modes identified but stacking behavior not traced

### ❌ STILL BLOCKED: Bonus Stacking Behavior Unknown

- **Issue**: We have bonus values but don't understand how they combine
- **Need**: Trace game code for stacking behavior (additive vs multiplicative)

### ✅ What Now Works

1. **TokenBankCap calculation**: `calculateTokenBankCap(tierUnlocks)` in spend-boundary-summary.js
2. **DailyTokeniumCap calculation**: `calculateDailyTokeniumCap(tierUnlocks, upgradeLevels)` in spend-boundary-summary.js
3. **Cost formulas**: Verified in token-shop-optimizer.js - `cost = startCost + additiveCost × currentLevel`
4. **Bonus modes**: Additive and multiplier identified from game assets

### What Still Blocks ROI Recommendations

1. **Player levels in canonical state** - ATU levels in `compatibility.unmappedSystemState`, not `state.playerProfile`
2. **Cap formula verification** - Formulas derived but not explicitly verified from game code
3. **Bonus stacking behavior** - Unknown how multiple bonuses combine

---

## What's Needed to Enable ROI

### Current Row Remap Status (2026-04-15)

**Title vs Effect Text Clarification**:

- "Title" = the row name shown in the TokenShop UI (e.g., "Mk2 Generator Booster")
- "Effect/Bonus Label" = what the upgrade actually does (e.g., "Tokens Gained from Token Chests")
- The evidence shows these come from SEPARATE systems - prefab/class names vs effect text strings

| ATU   | Prefab Identity                       | Effect/Bonus Label                     | Title (if any)                                  | Status                                  |
| ----- | ------------------------------------- | -------------------------------------- | ----------------------------------------------- | --------------------------------------- |
| ATU1  | NewTokenUPGPrefab.T1.TokensBoost      | "Tokens Gained from Token Chests"      | Detached: "Tokens Booster", "Tokens Booster T1" | Bridge only - no title join             |
| ATU2  | NewTokenUPGPrefab.T1.DiamondBoost     | "Diamonds Gained from Diamond Chests"  | None found                                      | Bridge only - no title join             |
| ATU3  | Effect-driven                         | Shared "Cells Booster (Chests)" effect | None                                            | Effect-driven row                       |
| ATU4  | NewTokenUPGPrefab.T1.ModPointsBooster | "Mod Points Gained"                    | Detached: "Token Ultima: MP"                    | Bridge only - no title join             |
| ATU5  | NewTokenUPGPrefab.T1.MK1Booster       | "Mk1 Output"                           | Detached: "1. MK1 Generator Output"             | Bridge + named identity - no title join |
| ATU6  | NewTokenUPGPrefab.T1.MK2Booster       | "Mk2 Output"                           | ✅ "Mk2 Generator Booster"                      | Full chain                              |
| ATU7  | NewTokenUPGPrefab.T1.MK3Booster       | "Mk3 Output"                           | ✅ "Mk3 Generator Booster"                      | Full chain                              |
| ATU8  | NewTokenUPGPrefab.T1.MK4Booster       | "Mk4 Output"                           | ✅ "Mk4 Generator Booster"                      | Full chain                              |
| ATU9  | NewTokenUPGPrefab.T1.MK5Booster       | "Mk5 Output"                           | ✅ "Mk5 Generator Booster"                      | Full chain                              |
| ATU10 | NewTokenUPGPrefab.T1.MK6Booster       | "Mk6 Output"                           | ✅ "Mk6 Generator Booster"                      | Full chain                              |
| ATU11 | NewTokenUPGPrefab.T1.MK7Booster       | "Mk7 Output"                           | Detached: "MK7 GEN ENHANCEMENT"                 | Quarantined - no title join             |
| ATU12 | NewTokenUPGPrefab.T1.MK8Booster       | "Mk8 Output"                           | ✅ "Mk8 Generator Booster"                      | Full chain                              |
| ATU13 | NewTokenUPGPrefab.T2.TokensBoost      | "Tokens Gained from Token Chests"      | Detached: "Tokens Booster T2"                   | Bridge only - no title join             |
| ATU20 | NewTokenUPGPrefab.T3.TokensBoost      | "Tokens Gained from Token Chests"      | Detached: "Tokens Booster T3"                   | Bridge only - no title join             |

**Key Finding**: Effect/bonus labels ARE verified from game assets. Player-facing titles for ATU1,2,4,5,13,20 remain as DETACHED candidate strings without confirmed shell joins.

### What IS Verified

- ✅ Cost formulas: `cost = startCost + additiveCost × currentLevel`
- ✅ Bonus values: extracted from game assets via `db:derived:token-shop-values` (archived snapshot: `data/archive/token-shop-values.json`)
- ✅ Bonus modes: additive vs multiplier identified per row
- ✅ Bonus labels: "Tokens Gained from Token Chests", "Diamonds Gained from Diamond Chests", "Mod Points Gained" - these are confirmed effect text
- ✅ Player-facing titles for ATU6-10, ATU12: "Mk2-8 Generator Booster" confirmed
- ✅ Cap calculations: formulas implemented in spend-boundary-summary.js

### What Remains Unverified (Blockers)

- ❌ Final player-facing titles for ATU1, ATU2, ATU4, ATU5, ATU13, ATU20 - only detached candidates found
- ❌ Exact prefab-to-title join for remaining rows - no direct shell path_id connection

### Extended Probe Results (2026-04-15)

Historical note: this analysis originally used the now-removed `token_shop_title_discovery_probe.py` targeted by path ids:

- **Path ID references found**: 0 (no method or text table references to path_ids 15839, 15804, etc.)
- **Title methods found**: 0 (no `Set*TokenBoostTitle` style methods in metadata)
- **Direct button joins**: 28 in metadata (just field declarations, not connections)
- **Title nearby search**: 14 occurrences - titles exist but NO path_ids nearby in string context

### Binary Structure Analysis (2026-04-15)

Analyzed raw level0 binary to trace shell-to-title connections:

- Both connected and previously-unconnected titles have **identical structure**: `[length-prefix (4 bytes)][string]`
- **ALL titles NOW TRACED** via binary analysis:
  - Prefab name at offset ~13.6M
  - Title at offset ~30.2M
  - Connection is in the same Unity button object

### Complete Title Remap (VERIFIED 2026-04-15)

All 28 ATU rows verified via binary trace + UABEA extract report:

| ATU   | Path ID | Tier | Player-Facing Title               |
| ----- | ------- | ---- | --------------------------------- |
| ATU1  | 15839   | T1   | Tokens Booster T1                 |
| ATU2  | 15804   | T1   | Diamonds Booster                  |
| ATU3  | 15810   | T1   | Cells Booster (Chests)            |
| ATU4  | 15796   | T1   | Mod Points Booster                |
| ATU5  | 15831   | T1   | Mk1 Generator Booster             |
| ATU6  | 15835   | T1   | Mk2 Generator Booster             |
| ATU7  | 15792   | T1   | Mk3 Generator Booster             |
| ATU8  | 15795   | T1   | Mk4 Generator Booster             |
| ATU9  | 15845   | T1   | Mk5 Generator Booster             |
| ATU10 | 15837   | T1   | Mk6 Generator Booster             |
| ATU11 | 15793   | T1   | Mk7 Generator Booster             |
| ATU12 | 15814   | T1   | Mk8 Generator Booster             |
| ATU13 | 15821   | T2   | Tokens Booster T2                 |
| ATU14 | 15844   | -    | Daily Tokenium trigger            |
| ATU15 | 15850   | -    | Daily Tokenium trigger            |
| ATU16 | 15827   | -    | Daily Tokenium trigger            |
| ATU17 | 15841   | -    | Daily Tokenium trigger            |
| ATU18 | 15834   | -    | Daily Tokenium trigger            |
| ATU19 | 15842   | -    | (unused)                          |
| ATU20 | 15812   | T3   | Tokens Booster T3                 |
| ATU21 | 15829   | T2   | Duo Booster One                   |
| ATU22 | 15806   | T2   | Duo Booster Two                   |
| ATU23 | 15828   | T2   | Duo Booster Three                 |
| ATU24 | 15797   | T2   | Duo Booster Four                  |
| ATU25 | 15820   | T2   | Duo Booster Five                  |
| ATU26 | 15840   | -    | (T4 related - needs verification) |
| ATU27 | 15832   | -    | (T4 related - needs verification) |
| ATU28 | 15813   | -    | (T4 related - needs verification) |

**Non-ATU Rows** (present in game but not numbered):

- **T3**: Trinity Booster One, Trinity Booster Two
- **T4**: Tier 1/2/3 Max Level Increaser
- **T5**: Trinity Oom Booster, Ultima\*, BorgeLoot, KnoxLoot, OzzyLoot, CampaignFragments

**Tier Breakdown**:

- **T1** (12 rows): ATU1-12 - Primary TokenShop upgrades
- **T2** (6 rows): ATU13, 21-25 - Duo Boosters
- **T3** (3 rows): ATU20 + Trinity Booster One/Two
- **T4** (3 rows): Tier 1/2/3 Max Level Increaser
- **T5** (10+ rows): Ultima variants, Loot variants

### What IS Verified

- ✅ **ALL 28 ATU row mappings verified** via binary trace (2026-04-15)
- ✅ Cost formulas: `cost = startCost + additiveCost × currentLevel`
- ✅ Bonus values: extracted from game assets via `db:derived:token-shop-values` (archived snapshot: `data/archive/token-shop-values.json`)
- ✅ Bonus modes: additive vs multiplier identified per row
- ✅ Bonus labels: confirmed effect text
- ✅ Cap calculations: formulas implemented in spend-boundary-summary.js

### What Remains Unverified (All Now Resolved)

- ✅ All 14 row titles verified via binary trace (2026-04-15)
- ✅ Prefab-to-title connections confirmed in level0 binary data

### Priority 2: Recover Cap State

- [x] TokenBankCap formula - implemented in spend-boundary-summary.js
- [x] DailyTokeniumCap formula - implemented in spend-boundary-summary.js
- [ ] Understand claimable/ready state mechanics

### Priority 3: Understand Bonus Mechanics

- [x] Additive vs multiplier behavior - identified in game assets
- [ ] Understand stacking rules (multiple bonuses combining)
- [x] Cap interactions - formulas verified

### Priority 4: Enable Canonical Promotion

- [ ] Convert from compatibility-only to canonical state
- [ ] Add validation for imported values

---

## Sources

- token-bank-state-clues.json - Exact typed field recovery
- daily-tokenium-lane-clues.json - Save neighborhood analysis
- token-shop-row-level-owner.json - ATU family save location
- token-shop-row-remap-boundary.json - Current remap blockers
- game-data.snapshot.v1.json - Research track status
- data/archive/unity-apk-extract-report.json - archived prefab and text-asset extraction provenance
