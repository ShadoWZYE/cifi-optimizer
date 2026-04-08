# Spend System Verification Gate

This document records what is currently verified about the spend-planner track and what must still be verified before any spend recommendations are added to the app.

It exists to enforce the repo rule that systems must be understood in-game and in the extracted assets before they are integrated into recommendations.

Data being present in the repo is not enough. These systems should be treated as available but unmapped until their currencies, owned-state inputs, and player-facing labels are verified well enough for app integration.

## Integration rule

Do not add spend-planner UI or recommendation logic until each system below has:

1. verified in-game placement
2. verified Unity/APK owner
3. verified spend currency lane
4. verified player-owned state inputs needed for next-purchase logic
5. verified or clearly labeled naming

If any item is missing, the allowed work stays in docs, parser scripts, owner maps, or descriptive placeholders.

## TokenShop

### Verified now

- In-game system family: token bank / token upgrades
- Unity owner: `TokenShop`
- Extracted source:
  - [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
  - [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat)
- Grounded outputs:
  - [`docs/systems/spend/token-shop-values.md`](docs/systems/spend/token-shop-values.md)
  - [`docs/systems/spend/token-shop-row-remap-verification.md`](docs/systems/spend/token-shop-row-remap-verification.md)
  - [`docs/systems/spend/token-bank-state-verification.md`](docs/systems/spend/token-bank-state-verification.md)
  - [`docs/systems/spend/daily-tokenium-mission-lane-verification.md`](docs/systems/spend/daily-tokenium-mission-lane-verification.md)
  - [`data/token-shop-values.json`](data/token-shop-values.json)
  - [`data/token-shop-row-level-owner.json`](data/token-shop-row-level-owner.json)
  - [`data/token-shop-row-remap-boundary.json`](data/token-shop-row-remap-boundary.json)
- Verified extracted fields include:
  - `StartCost`
  - `AdditiveCost`
  - `Bonus`
  - `MaxLevel`
  - `FillMaxLevel`
- Verified save-side row-level owner evidence now includes:
  - exact `SaveData` fields `ATU1Level` through `ATU28Level`
  - adjacent exact `SaveData` fields `Tier2TokensUnlocked` through `Tier5TokensUnlocked`
  - the same grounded `ATU` numbering family on the TokenShop owner payload
- Verified currency-shell evidence now includes:
  - `resourceicons/resource_tokenium`
  - `resourceicons/resource_tokenium_cap`
  - token-bank controller labels such as `TokenBankDescriptionText` and `FinalTokenBankCap`

### Not yet verified enough for app recommendations

- final remap from raw `ATU*Level` save fields to grounded player-facing TokenShop row labels
- checked object or title joins from `ATU`-numbered row shells to specific prefab identities or final row titles
- full rule set for moving from first-buy facts to true next-purchase planning

### Adjacent systems this signals

TokenShop mapping also points at future system-mapping work outside the raw cost table itself:

- token-bank cap / fill state and related final-stat outputs
- the `DiamondBoost` lane inside TokenShop and how it relates to the broader diamond-upgrade domain
- Meltdown-linked gating objects that appear to control tier activation or visibility
- prefab / label remap work for `NewTokenUPGPrefab.*` families
- notification and unlock shell logic around `ATU*Button`, overlays, and nav badges
- downstream effect domains touched by TokenShop upgrades, including generators, cells, mod points, shards, research points, academy points, loot, missions, and Ouroboros orbs

These are not yet planner-ready integrations. They are dependency notes so future mapping work can recover the right owners and player-state inputs instead of forcing TokenShop into a fake standalone model.

### Current app implication

- It is safe to treat TokenShop as a real system with grounded extracted constants.
- It is safe to describe its cost lane as token-bank token or tokenium spending, rather than as an unnamed generic spend pool.
- It is safe to preserve raw `ATU1Level` through `ATU28Level` and `Tier2TokensUnlocked` through `Tier5TokensUnlocked` under `compatibility.unmappedSystemState.tokenShop`.
- It is safe to say the repo now has grounded non-label clues around some `ATU` rows, including token, diamond, daily-token, shard, and late direct-buy hook evidence.
- It is not yet safe to generate next-buy recommendations from player token budgets alone.
- It is not yet safe to promote raw `ATU*Level` save fields into canonical `state.playerProfile` fields until the row-by-row remap is grounded.
- TokenShop-connected token-bank cap, fill, claim, and daily tokenium state should remain `available but unmapped` until saved-state owners are recovered.
- `OR_TokenBankCap` and `OR_TokensFromChests` should currently be treated as grounded asset labels, not as recovered formula sources.
- One key split is now grounded: claim actions resolve through `TokenShop`, token-bank cap display resolves through `BigStatisticPrefab.TokenBankCap`, and at least one daily-tokenium text path resolves through `TextHandlerLoopMods.SetLM244BonusText`.
- `LM244` should currently be treated as a loop-mod text or explanation hook for daily tokenium, not as the recovered gameplay owner of that lane.
- The current repo-local owner narrowing is still negative rather than positive: `TokenShop`, `BigStatisticPrefab.TokenBankCap`, and the `FinalTokenBank*` derived-output cluster are not yet recovered saved-state owners, so the remaining search should stay on the broader `PlayerProfileData` / `CloudSavePlayerProfile` persistence-family boundary.
- Daily Tokenium is now better grounded as an Academy or Farm Mission reward lane that `TokenShop`, `LoopModifiers`, and the Collector pack all touch, not as a TokenShop-only mechanic.

## MultiverseMarket

### Verified now

- In-game system family: Chrystos Emporium / Inscryptions
- Unity owner: `MultiverseMarket`
- Extracted source:
  - [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
- Grounded outputs:
  - [`docs/systems/spend/multiverse-market-values.md`](docs/systems/spend/multiverse-market-values.md)
  - [`docs/systems/spend/multiverse-market-verification.md`](docs/systems/spend/multiverse-market-verification.md)
  - [`docs/systems/spend/multiverse-market-state-verification.md`](docs/systems/spend/multiverse-market-state-verification.md)
  - [`data/multiverse-market-values.json`](data/multiverse-market-values.json)
- Verified extracted fields in the validated late block include:
  - `ID`
  - `StartCost`
  - `CostExponent`
  - `Bonus`
  - `MaxLevel`
- Verified spend-lane shell evidence now includes:
  - `CurrencyBox` pointers beside validated inscription rows in the serialized owner payload
  - `CostBox-InscryptionsDone`
  - `AchievementBar-Inscryptions`
  - `MultiverseMarket, Assembly-CSharp` buy handlers such as `BuyIS47`, `BuyIS64`, `BuyIS73`, `BuyIS13`, and `BuyIS105`
- Verified saved-state narrowing now includes:
  - `Assets\Scripts\Data&Saving\Nakama\PlayerProfile\PlayerProfileData.cs`
  - `FillPlayerProfileData`
  - `GetPlayerProfileData`
  - `CloudSavePlayerProfile`
  - exact Emporium-adjacent metadata field clues such as `InscryptionsDone`, `IS1Level`, `IS50Level`, `IS51Level`, `IS64Level`, `IS73Level`, `IS110Level`, and `EsotericR1Trades`
  - a broader progression-style field block around `InscryptionsDone` that also includes `EsotericR*Trades`, `NecrumR*Trades`, and early `Mech*` fields

### Not yet verified enough for app recommendations

- the saved-state owner or runtime balance field behind the `Inscryptions Done` spend lane
- player-owned current inscription levels or equivalent ownership state
- full row coverage beyond the currently validated late block
- final remap from ids like `IS51` to grounded player-facing labels

### Current app implication

- It is safe to treat MultiverseMarket as a real system with partially grounded extracted constants.
- It is safe to stop inferring its spend lane from diamonds, tokens, or other unrelated player resources.
- It is not yet safe to treat `Inscryptions Done` as an import-ready player field even though the wider declaring owner is now recovered as `SaveData`; the bounded import surface and current owned row levels are still unresolved.
- The current best repo-local saved-state path is the broader `PlayerProfileData` persistence family, not the raw `MultiverseMarket` owner object by itself.
- The repo now has exact metadata field names for this lane, but not the import-ready save contract for `state.playerProfile`.
- The recovered neighborhood now behaves like a wider progression-state field block, which further rules out treating nearby `AchievementInscryptionsReward` or `FinalIS*` symbols as the saved balance owner.

## Next allowed slice

The next spend-track slice should verify missing integration inputs, not produce planner cards.

Priority order:

1. use the recovered `InscryptionsDone` and `IS*Level` metadata cluster plus the exact `PlayerProfileData` field table to determine which deeper serialized payload owns the multiverse-market lane after flat direct `PlayerProfileData` fields are ruled out
2. if that save owner is recovered, map which owned `IS*Level` range actually covers the currently validated Emporium rows before promoting any import-ready state shape
3. recover player-owned current-level inputs for TokenShop upgrade rows now that the cost lane is grounded as token or tokenium spending
4. recover the saved-state owners behind token-bank cap, fill, claim, and the Academy or Farm Mission Daily Tokenium lane
5. remap serialized ids to grounded player-facing labels
6. only then add spend recommendations with explicit assumptions


