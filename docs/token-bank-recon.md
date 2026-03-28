# Token Bank Recon

Date: 2026-03-28

## Summary

The joined Unity scene file [`level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0) contains a real token-bank upgrade title block and a nearby effect-description block.

This is useful because it confirms the game data includes:

- real upgrade titles
- real rendered effect text
- tier/max-level/token-chest terminology

It does **not** yet expose exact token costs or cost formulas.

## Confirmed upgrade title block

The following titles appear in a contiguous string cluster around byte offsets `30196316` through `30212604` in [`level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0):

- `All Gens Booster`
- `Token Ultima: MP`
- `Daily Tokens T2`
- `Mk5 Generator Booster`
- `Duo Booster One`
- `Token Ultima: Cells`
- `Generator Amplifier`
- `Borge Loot`
- `Mk6 Generator Booster`
- `Mk2 Generator Booster`
- `Mk11 Generator Booster`
- `Tier 1 Max Level Increaser`
- `Duo Booster Three`
- `Tokens Booster T1`
- `Duo Booster Five`
- `Duo Booster Two`
- `Trinity Booster Two`
- `Daily Tokens T3`
- `Mk1 Generator Booster`
- `Tier 2 Max Level Increaser`
- `Hunter Loot Booster`
- `Mk7 Generator Booster`
- `Duo Booster Four`
- `Tokens Booster T2`
- `Ozzy Loot`
- `Daily Tokens T4`
- `Mk3 Generator Booster`
- `Shards Booster`

## Confirmed effect-description block

A nearby string cluster around byte offsets `30133836` through `30164908` contains real effect text for token-bank style upgrades:

- `x1.02 to Mk1 Output & Mk2 Output`
- `x1.02 to Mk3 Output & Mk4 Output`
- `x1.02 to Mk5 Output & Mk6 Output`
- `x1.02 to Mk7 Output & Mk8 Output`
- `x1.01 to Mk1 Output`
- `x1.01 to Mk2 Output`
- `x1.01 to Mk3 Output`
- `x1.01 to Mk4 Output`
- `x1.01 to Mk5 Output`
- `x1.01 to Mk6 Output`
- `x1.01 to Mk7 Output`
- `x1.01 to Mk11 Output`
- `+0.2 Tokens Gained from Token Chests`
- `+0.5 Tokens Gained from Token Chests`
- `+1 Tokens Gained from Token Chests`
- `+20% Tokens Gained from Daily Rewards & Events`
- `+50% Tokens Gained from Daily Rewards & Events`
- `+500 Max Levels to Tier 2 Upgrades`
- `+500 Max Levels to Tier 3 Upgrades`
- `+1000 Max Levels to Tier 1 Upgrades`
- `x1.07 to Shards Gained`
- `x1.03 to All Generators Output, Shards Gained & AP Gained`
- `x1.15 to All Generators Output (All Gens)`
- `x1.1 to Research Points Gained (RP)`
- `x1.02 to MP Gained & Shards Gained`
- `x1.01 to MP Gained`
- `x10 to MP Gained, Shards Gained & RP Gained`
- `x1.25 to Cells Gained`
- `x1.0018 to Cells Gained for every level in any token upgrade`
- `x1.0008 to MP Gained for every level in any token upgrade`
- `x1.0008 to Shards Gained for every level in any token upgrade`
- `x1.0008 to RP Gained for every level in any token upgrade`
- `x1.0008 to AP Gained for every level in any token upgrade`
- `-3 seconds to Hunter Revive Time`
- `+2.5% to Hunter Loot Gained`
- `x1.01 Loot Gained on Planet Exon-12 (Borge)`
- `x1.01 Loot Gained on Planet Endo-Prime (Ozzy)`
- `x1.01 Loot Gained on Planet Sirene-6 (Knox)`
- `+1 Diamonds Gained from Diamond Chests`
- `+1 Seconds timeskip to Cells Gained from Token & Diamond Chests`
- `+1% to Ouroboros Orbs Gained`
- `x1.02 to Fragments Gained from Campaign Missions`

## High-confidence title/effect matches

Based on exact string content and proximity, these matches are high confidence:

- `Duo Booster Two`
  - `x1.02 to Mk1 Output & Mk2 Output`
- `Duo Booster Three`
  - `x1.02 to Mk3 Output & Mk4 Output`
- `Tier 1 Max Level Increaser`
  - `+1000 Max Levels to Tier 1 Upgrades`
- `Tier 2 Max Level Increaser`
  - `+500 Max Levels to Tier 2 Upgrades`
- `Hunter Loot Booster`
  - `+2.5% to Hunter Loot Gained`
- `Borge Loot`
  - `x1.01 Loot Gained on Planet Exon-12 (Borge)`
- `Ozzy Loot`
  - `x1.01 Loot Gained on Planet Endo-Prime (Ozzy)`
- `Shards Booster`
  - `x1.07 to Shards Gained`
- `All Gens Booster`
  - `x1.15 to All Generators Output (All Gens)`

## Strong but not fully proven matches

These pairings are strongly suggested by naming and available description text, but should still be treated as provisional until we decode the owning object structure:

- `Duo Booster Four`
  - likely `x1.02 to Mk5 Output & Mk6 Output`
- `Duo Booster Five`
  - likely `x1.02 to Mk7 Output & Mk8 Output`
- `Mk1 Generator Booster`
  - likely `x1.01 to Mk1 Output`
- `Mk2 Generator Booster`
  - likely `x1.01 to Mk2 Output`
- `Mk3 Generator Booster`
  - likely `x1.01 to Mk3 Output`
- `Mk5 Generator Booster`
  - likely `x1.01 to Mk5 Output`
- `Mk6 Generator Booster`
  - likely `x1.01 to Mk6 Output`
- `Mk7 Generator Booster`
  - likely `x1.01 to Mk7 Output`
- `Mk11 Generator Booster`
  - likely `x1.01 to Mk11 Output`
- `Tokens Booster T1`
  - likely `+0.2 Tokens Gained from Token Chests`
- `Tokens Booster T2`
  - likely `+0.5 Tokens Gained from Token Chests` or `+1 Tokens Gained from Token Chests`
- `Daily Tokens T2`
  - likely `+20% Tokens Gained from Daily Rewards & Events`
- `Daily Tokens T3`
  - likely `+50% Tokens Gained from Daily Rewards & Events`

## What is still missing

- exact token cost values per level
- max level values for each upgrade family beyond what is visible in UI/screenshots
- direct machine-readable linkage between each title and its effect text
- the object/table that owns token-bank balance data

## Record-structure findings

The token-bank title block and the effect-description block both behave like localization-style record tables:

- title records carry stable small IDs in the `32748` to `32779` range
- description records carry stable IDs in the `67585` to `67646` range
- the records around those strings are structurally uniform and mostly contain:
  - record-local IDs
  - repeated constants
  - default `1.0f`-style float values

That means:

- the title/effect text itself is real numeric payload from the game data
- but the surrounding string records do not appear to be the owning cost/formula objects

In other words, this pass found verified token-upgrade effect values, but not token-upgrade cost values.

## UI-composition join table

There is a fixed-width table around byte offset `25975756` in [`level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0) that joins token-upgrade-localized records together.

Observed properties:

- records are `192` bytes apart
- the first field is a description companion ID like `195860`
- the fourth field is a title companion ID like `207303`
- the record also carries several more object IDs, including groups like:
  - `211553` / `211550` / `211551`...
  - `202888` / `202887` / `202886`...
  - `233597` / `233594` / `233595`...
  - `208475` / `208474` / `208473`...
  - `256451` / `256449` / `256448`...
- the float tail is mostly constant across records and looks like layout/default state:
  - `1.0`
  - `0.0001220703125`
  - `0.488525390625`
  - `0.611907958984375`
  - `0.5`

This table is important because it proves the title/effect string records are linked into a single per-upgrade scene record. It still does **not** look like the balance owner.

## What the joined references resolve to

Following the token-bank join table into the next reference layers shows scene-widget and prefab wiring, not cost tables.

Examples:

- title companion payloads resolve into UI widget names like:
  - `TitleText`
  - `CostBox`
  - `DescText`
  - `BuyButton`
  - `PurchasedOverlay`
  - `IconBox`
- description companion payloads resolve into scene-node names like:
  - `StatisticBox`
  - `Row`
  - `Image (1)`
  - `NameText`
  - `AttributeNode-PathOfMephisto0`
- another joined-ID family resolves to UI/prefab names like:
  - `BonusLayout`
  - `CircularProgressBar`
  - `TimeBar`
  - `OGUPLine`
  - `UpgradeButton8`
  - `ShardMilestoneBonus3`

That makes this branch useful as a scene-map, but it is not yet exposing token upgrade level-cost data.

## Prefab anchors recovered

The joined scene data also contains explicit token-upgrade prefab instance names around byte offsets `13672148` through `13677188` in [`level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0).

Recovered families include:

- `NewTokenUPGPrefab.T1.DiamondBoost`
- `NewTokenUPGPrefab.T1.ModPointsBooster`
- `NewTokenUPGPrefab.T1.MK1Booster`
- `NewTokenUPGPrefab.T1.MK2Booster`
- `NewTokenUPGPrefab.T1.MK3Booster`
- `NewTokenUPGPrefab.T1.MK4Booster`
- `NewTokenUPGPrefab.T1.MK5Booster`
- `NewTokenUPGPrefab.T1.MK6Booster`
- `NewTokenUPGPrefab.T1.MK7Booster`
- `NewTokenUPGPrefab.T1.MK8Booster`
- `NewTokenUPGPrefab.T1.CellsPerChestBooster`
- `NewTokenUPGPrefab.T1.TokensBoost`
- `NewTokenUPGPrefab.T2.DuoBoosterOne`
- `NewTokenUPGPrefab.T2.DuoBoosterTwo`
- `NewTokenUPGPrefab.T2.DuoBoosterThree`
- `NewTokenUPGPrefab.T2.DuoBoosterFour`
- `NewTokenUPGPrefab.T2.DuoBoosterFive`
- `NewTokenUPGPrefab.T2.TokensBoost`
- `NewTokenUPGPrefab.T2.DailyTokens`
- `NewTokenUPGPrefab.T3.TokensBoost`
- `NewTokenUPGPrefab.T3.TrinityBoosterOne`
- `NewTokenUPGPrefab.T3.TrinityBoosterTwo`
- `NewTokenUPGPrefab.T3.DailyTokens`
- `NewTokenUPGPrefab.T4.Ultima`
- `NewTokenUPGPrefab.T4.Tier1MaxLevelIncreaser`
- `NewTokenUPGPrefab.T4.Tier2MaxLevelIncreaser`
- `NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser`
- `NewTokenUPGPrefab.T4.DailyTokens`
- `NewTokenUPGPrefab.T5.BorgeLoot`
- `NewTokenUPGPrefab.T5.OzzyLoot`
- `NewTokenUPGPrefab.T5.KnoxLoot`
- `NewTokenUPGPrefab.T5.CampaignFragments`
- `NewTokenUPGPrefab.T5.TrinityOomBooster`
- `NewTokenUPGPrefab.T5.UltimaAP`
- `NewTokenUPGPrefab.T5.UltimaCells`
- `NewTokenUPGPrefab.T5.UltimaMP`
- `NewTokenUPGPrefab.T5.UltimaRP`
- `NewTokenUPGPrefab.T5.UltimaShards`

This is the strongest token-bank anchor found so far, because it moves the search from localized UI strings to concrete token-upgrade prefab identities in the shipped build.

## Code-side token-shop model

The APK metadata file [`global-metadata.dat`](C:\Users\Shadow\Desktop\CiFi\_cifi_apk\global-metadata.dat) contains a concrete `TokenShop` code cluster. This is the first strong evidence that the token shop is backed by explicit named cost/bonus/max-level fields, not just opaque UI data.

Confirmed `TokenShop` method/property names include:

- `get_TokenBankCap`
- `get_ClaimableBankTokens`
- `get_TotalT1TokenLevels`
- `get_TotalT2TokenLevels`
- `get_TotalT3TokenLevels`
- `get_TotalT4TokenLevels`
- `get_TotalT5TokenLevels`
- `get_TotalTokenLevels`
- `InitializeTokenShop`
- `CheckAllOverlays`
- `CheckTokenClaimNotification`
- `ClaimBankedTokens`
- `IncreaseBankedTokens`
- `SetBankFill`
- `UnlockTier2`
- `UnlockTier3`
- `UnlockTier4`
- `UnlockTier5`

The same cluster also exposes per-upgrade data fields for the early token tiers:

- `TokenBoostStartCost`
- `TokenBoostAdditiveCost`
- `TokenBoostBonus`
- `TokenBoostMaxLevel`
- `DiamondBoostStartCost`
- `DiamondBoostAdditiveCost`
- `DiamondBoostBonus`
- `DiamondBoostMaxLevel`
- `CellBoostStartCost`
- `CellBoostAdditiveCost`
- `CellBoostBonus`
- `CellBoostMaxLevel`
- `ModBoostStartCost`
- `ModBoostAdditiveCost`
- `ModBoostBonus`
- `ModBoostMaxLevel`
- `MK1TokenBoostStartCost` through `MK8TokenBoostStartCost`
- `MK1TokenBoostAdditiveCost` through `MK8TokenBoostAdditiveCost`
- `MK1TokenBoostBonus` through `MK8TokenBoostBonus`
- `MK1TokenBoostFillMaxLevel` through `MK8TokenBoostFillMaxLevel`
- `TokenBoostT2StartCost`
- `TokenBoostT2AdditiveCost`
- `TokenBoostT2Bonus`
- `TokenBoostT2MaxLevel`
- `TokenDailiesT2StartCost`
- `TokenDailiesT2AdditiveCost`
- `TokenDailiesT2Bonus`
- `TokenDailiesT2MaxLevel`
- `T2Duo1StartCost` through `T2Duo5StartCost`
- `T2Duo1AdditiveCost` through `T2Duo5AdditiveCost`
- `T2Duo1Bonus` through `T2Duo5Bonus`
- `T2Duo1MaxLevel` through `T2Duo5MaxLevel`
- `TokenBoostT3StartCost`
- `TokenBoostT3AdditiveCost`
- `TokenBoostT3Bonus`
- `TokenBoostT3MaxLevel`
- `TokenDailiesT3StartCost`
- `TokenDailiesT3AdditiveCost`
- `TokenDailiesT3Bonus`
- `TokenDailiesT3MaxLevel`
- `T3Trio1StartCost`
- `T3Trio1AdditiveCost`
- `T3Trio1Bonus`
- `T3Trio1MaxLevel`
- `T3Trio2StartCost`
- `T3Trio2AdditiveCost`
- `T3Trio2Bonus`
- `T3Trio2MaxLevel`

This matters for the optimiser because it narrows the cost model substantially:

- token-shop upgrade costs are explicitly represented as `StartCost` plus `AdditiveCost` fields for many upgrades
- token-shop effects are explicitly represented as `Bonus` fields
- progression caps are explicitly represented as `MaxLevel` or `FillMaxLevel` fields
- tier unlocks are explicitly represented as `Tier4Requirement` and `Tier5T1Requirement` through `Tier5T4Requirement`

## Grounded upgrade-family mapping

The metadata names line up cleanly with the scene/prefab anchors for the early token tiers:

- `TokenBoost*`
  - aligns with `NewTokenUPGPrefab.T1.TokensBoost`
- `DiamondBoost*`
  - aligns with `NewTokenUPGPrefab.T1.DiamondBoost`
- `CellBoost*`
  - aligns with `NewTokenUPGPrefab.T1.CellsPerChestBooster`
- `ModBoost*`
  - aligns with `NewTokenUPGPrefab.T1.ModPointsBooster`
- `MK1TokenBoost*` through `MK8TokenBoost*`
  - align with `NewTokenUPGPrefab.T1.MK1Booster` through `NewTokenUPGPrefab.T1.MK8Booster`
- `TokenBoostT2*`
  - aligns with `NewTokenUPGPrefab.T2.TokensBoost`
- `TokenDailiesT2*`
  - aligns with `NewTokenUPGPrefab.T2.DailyTokens`
- `T2Duo1*` through `T2Duo5*`
  - align with `NewTokenUPGPrefab.T2.DuoBoosterOne` through `NewTokenUPGPrefab.T2.DuoBoosterFive`
- `TokenBoostT3*`
  - aligns with `NewTokenUPGPrefab.T3.TokensBoost`
- `TokenDailiesT3*`
  - aligns with `NewTokenUPGPrefab.T3.DailyTokens`
- `T3Trio1*` and `T3Trio2*`
  - align with `NewTokenUPGPrefab.T3.TrinityBoosterOne` and `NewTokenUPGPrefab.T3.TrinityBoosterTwo`

The later token tiers are only partially resolved from metadata so far:

- `ATU24StartCost` plus `ATU24Bonus1..5`
  - likely a multi-effect token upgrade, but the exact prefab match is still unresolved
- `ATU25StartCost` through `ATU28StartCost`
  - likely correspond to later token-tier upgrades, but the exact title/prefab mapping is still unresolved

## Direct mechanic conclusions

The token-shop path now supports several grounded statements that were not secure before:

- the token shop is not driven only by display strings; it has an explicit gameplay/controller model in code
- many token upgrades use a named `StartCost` + `AdditiveCost` cost model rather than a generic unlabeled cost table
- the game tracks explicit per-upgrade `Bonus` and `MaxLevel` fields for the token tiers we can currently see
- the game tracks derived/final caps like `FinalT2Duo3MaxLevel`, `FinalMK3TokenBoostFillMaxLevel`, and `FinalModBoostMaxLevel`
- token-bank systems also connect to broader final-stat fields like `FinalTokenBankCap`, `FinalTokenBankFillSpeed`, and `FinalDailyTokenBonus`

What is still missing is the numeric payload behind those fields. The metadata proves the model shape, but not the literal values.

## Best next step

The most promising next move is now to connect the explicit `TokenShop` field names from [`global-metadata.dat`](C:\Users\Shadow\Desktop\CiFi\_cifi_apk\global-metadata.dat) back into the Unity scene/object data in [`level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0).

The next pass should try to connect:

1. title string
2. description string
3. `NewTokenUPGPrefab.*` identity
4. `TokenShop` field-family name like `T2Duo3StartCost` or `TokenDailiesT2Bonus`
5. the numeric constant owner or runtime formula owner

## TokenShop value source found

The source of the token values is now grounded.

The real owner is the serialized `TokenShop` MonoBehaviour at path ID `283631` in [`level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0). Its GameObject is `TokenShop`, and the object payload is `2480` bytes long.

The critical step was aligning that raw payload with the declaration-order field names recovered from [`global-metadata.dat`](C:\Users\Shadow\Desktop\CiFi\_cifi_apk\global-metadata.dat). The field sequence lines up exactly:

- `TokenBoostStartCost`
- `TokenBoostAdditiveCost`
- `TokenBoostBonus`
- `TokenBoostMaxLevel`
- `TokenBoostFill`
- `ATU1Button`
- `ATU1MaxOverlay`
- `DiamondBoostStartCost`
- `DiamondBoostAdditiveCost`
- `DiamondBoostBonus`
- `DiamondBoostMaxLevel`
- and so on through `T2Duo*`, `T3Trio*`, and `ATU24`..`ATU28`

This is no longer just a naming hypothesis. The offsets and values were extracted into:

- [docs/token-shop-values.md](C:\Users\Shadow\Desktop\CiFi\docs\token-shop-values.md)
- [data/token-shop-values.json](C:\Users\Shadow\Desktop\CiFi\data\token-shop-values.json)
- [scripts/token_shop_parse.py](C:\Users\Shadow\Desktop\CiFi\scripts\token_shop_parse.py)

## Direct extracted values

Selected grounded values from the serialized `TokenShop` object:

- `TokenBoost`: `StartCost=20`, `AdditiveCost=5`, `Bonus=0.2`, `MaxLevel=20`
- `DiamondBoost`: `StartCost=200`, `AdditiveCost=300`, `Bonus=1`, `MaxLevel=2`
- `CellBoost`: `StartCost=1`, `AdditiveCost=0.25`, `Bonus=1`, `MaxLevel=60`
- `ModBoost`: `StartCost=10`, `AdditiveCost=2`, `Bonus=1.01`, `MaxLevel=200`
- `MK1TokenBoost`: `StartCost=1`, `AdditiveCost=0.1`, `Bonus=1.01`, `FillMaxLevel=5000`
- `MK2TokenBoost`: `StartCost=2`, `AdditiveCost=0.12`, `Bonus=1.01`, `FillMaxLevel=5000`
- `MK3TokenBoost`: `StartCost=3`, `AdditiveCost=0.13`, `Bonus=1.01`, `FillMaxLevel=5000`
- `TokenBoostT2`: `StartCost=1000`, `AdditiveCost=500`, `Bonus=0.5`, `MaxLevel=10`
- `TokenDailiesT2`: `StartCost=1000`, `AdditiveCost=800`, `Bonus=0.2`, `MaxLevel=10`
- `T2Duo3`: `StartCost=100`, `AdditiveCost=3`, `Bonus=1.02`, `MaxLevel=2500`
- `TokenBoostT3`: `StartCost=2500`, `AdditiveCost=750`, `Bonus=1`, `MaxLevel=25`
- `T3Trio1`: `StartCost=7000`, `AdditiveCost=100`, `Bonus=1.03`, `MaxLevel=2000`
- `ATU24`: `StartCost=40000000`, `Bonus1=1.001`, `Bonus2=1.0005`, `Bonus3=1.0003`, `Bonus4=1.0002`, `Bonus5=1.0001`
- `ATU25`: `StartCost=1000000`, `AdditiveCost=25000`, `Bonus=0.5`, `MaxLevel=50`
- `ATU26`: `StartCost=10000000`, `AdditiveCost=1000000`, `Bonus=1000`, `MaxLevel=15`
- `ATU27`: `StartCost=50000000`, `AdditiveCost=10000000`, `Bonus=500`, `MaxLevel=15`
- `ATU28`: `StartCost=250000000`, `AdditiveCost=50000000`, `Bonus=500`, `MaxLevel=15`

## Formula confirmation

The `T2Duo3` extraction is strong enough to validate the cost model directly against the live UI:

- extracted values: `StartCost=100`, `AdditiveCost=3`, `Bonus=1.02`, `MaxLevel=2500`
- screenshot sample: `Duo Booster Three` at level `1722` shows cost `5.27k`
- `100 + 3 * 1722 = 5266`, which rounds to `5.27k`

That confirms the token-shop path now exposes real, usable mechanics rather than just labels or approximations.
