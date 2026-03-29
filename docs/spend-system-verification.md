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
  - [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
  - [`_cifi_apk/global-metadata.dat`](C:\Users\Shadow\Desktop\CiFi\_cifi_apk\global-metadata.dat)
- Grounded outputs:
  - [`docs/token-shop-values.md`](C:\Users\Shadow\Desktop\CiFi\docs\token-shop-values.md)
  - [`docs/token-bank-state-verification.md`](C:\Users\Shadow\Desktop\CiFi\docs\token-bank-state-verification.md)
  - [`docs/daily-tokenium-mission-lane-verification.md`](C:\Users\Shadow\Desktop\CiFi\docs\daily-tokenium-mission-lane-verification.md)
  - [`data/token-shop-values.json`](C:\Users\Shadow\Desktop\CiFi\data\token-shop-values.json)
- Verified extracted fields include:
  - `StartCost`
  - `AdditiveCost`
  - `Bonus`
  - `MaxLevel`
  - `FillMaxLevel`

### Not yet verified enough for app recommendations

- direct player-owned current levels for token-shop upgrades
- final remap from serialized ids like `TokenBoost` or `ATU24` to grounded player-facing labels
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
- It is not yet safe to generate next-buy recommendations from player token budgets alone.
- TokenShop-connected token-bank cap, fill, claim, and daily tokenium state should remain `available but unmapped` until saved-state owners are recovered.
- `OR_TokenBankCap` and `OR_TokensFromChests` should currently be treated as grounded asset labels, not as recovered formula sources.
- One key split is now grounded: claim actions resolve through `TokenShop`, token-bank cap display resolves through `BigStatisticPrefab.TokenBankCap`, and at least one daily-tokenium text path resolves through `TextHandlerLoopMods.SetLM244BonusText`.
- `LM244` should currently be treated as a loop-mod text or explanation hook for daily tokenium, not as the recovered gameplay owner of that lane.
- Daily Tokenium is now better grounded as an Academy or Farm Mission reward lane that `TokenShop`, `LoopModifiers`, and the Collector pack all touch, not as a TokenShop-only mechanic.

## MultiverseMarket

### Verified now

- In-game system family: Chrystos Emporium / Inscryptions
- Unity owner: `MultiverseMarket`
- Extracted source:
  - [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
- Grounded outputs:
  - [`docs/multiverse-market-values.md`](C:\Users\Shadow\Desktop\CiFi\docs\multiverse-market-values.md)
  - [`data/multiverse-market-values.json`](C:\Users\Shadow\Desktop\CiFi\data\multiverse-market-values.json)
- Verified extracted fields in the validated late block include:
  - `ID`
  - `StartCost`
  - `CostExponent`
  - `Bonus`
  - `MaxLevel`

### Not yet verified enough for app recommendations

- the actual spend currency lane for these market purchases
- player-owned current inscription levels or equivalent ownership state
- full row coverage beyond the currently validated late block
- final remap from ids like `IS51` to grounded player-facing labels

### Current app implication

- It is safe to treat MultiverseMarket as a real system with partially grounded extracted constants.
- It is not safe to map its spend lane to diamonds, tokens, or any other player resource without direct evidence.

## Next allowed slice

The next spend-track slice should verify missing integration inputs, not produce planner cards.

Priority order:

1. verify the token-shop spend lane and player-owned current-level inputs
2. map the TokenShop-connected token-bank cap, fill, claim, and Academy or Farm Mission Daily Tokenium lane strongly enough to identify their saved-state inputs
3. verify the multiverse-market spend currency and owned-state inputs
4. remap serialized ids to grounded player-facing labels
5. only then add spend recommendations with explicit assumptions
