# Spend System Verification Gate

This document records what is currently verified about the spend-planner track and what must still be verified before any spend recommendations are added to the app.

It exists to enforce the repo rule that systems must be understood in-game and in the extracted assets before they are integrated into recommendations.

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

### Current app implication

- It is safe to treat TokenShop as a real system with grounded extracted constants.
- It is not yet safe to generate next-buy recommendations from player token budgets alone.

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
2. verify the multiverse-market spend currency and owned-state inputs
3. remap serialized ids to grounded player-facing labels
4. only then add spend recommendations with explicit assumptions
