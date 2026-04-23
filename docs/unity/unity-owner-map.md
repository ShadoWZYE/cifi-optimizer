# Unity Owner Map

Current grounded mechanic owners recovered from the shipped CIFI Unity build:

- `TokenShop`
  - system: token bank / token upgrades
  - source owner: [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
  - active owner: `db:derived:token-shop-values` via [`scripts/contracts/generate-system-units.mjs`](../../scripts/contracts/generate-system-units.mjs)
  - outputs: [`docs/systems/spend/token-shop-values.md`](docs/systems/spend/token-shop-values.md), [`docs/systems/spend/token-bank-state-verification.md`](docs/systems/spend/token-bank-state-verification.md), [`data/archive/token-shop-values.json`](data/archive/token-shop-values.json)
  - integration status: owner and serialized constants verified; token-bank state lane verified at the controller level; exact `SaveData.BankedTokens` now grounds the current stored token-bank amount without expanding planner behavior; the base spend lane is now grounded as token or tokenium spending through token-bank labels and resource icons; the Daily Tokenium lane is now better grounded as an Academy or Farm Mission reward family that TokenShop modifies, with exact `SaveData.DailyTokenium` plus its adjacent mission-persistence neighborhood now narrowing the save-side wrapper beyond a family-only surface; the checked `PlayerProfileHandler.saveInfoCache` plus `ConvertSaveDataToProfileData(...) -> PlayerProfileData` bridge only exposes generic `PlayerProfileData.Tokens` and `PlayerProfileData.Tokenium` wrapper strings in this lane; exact `SaveData.ClaimableTokenium` is now also checked as a broader generic Tokenium-cluster claimable field, while direct target-type recovery still does not surface `CloudSavePlayerProfile` as a narrower typed wrapper; `OR_TokenBankCap` and `OR_TokensFromChests` narrowed to asset-label clues rather than proven formula owners; token-bank cap and claimable or ready save-state owners plus final player-facing row remap still remain unresolved before planner UI
  - recovered adjacent handlers:
    - `ClaimBankedTokens` -> `TokenShop, Assembly-CSharp`
    - token-bank cap display -> `BigStatisticPrefab.TokenBankCap`
    - daily-tokenium mission text path -> `TextHandlerLoopMods.SetLM244BonusText`
  - recovered currency-shell evidence:
    - `resourceicons/resource_tokenium`
    - `resourceicons/resource_tokenium_cap`
    - `TokenBankDescriptionText`
    - `FinalTokenBankCap`
  - recovered owner-family split:
    - underlying Daily Tokenium lane -> `SpaceAcademy` / `FarmMissions` family in `level0`
    - narrowest checked save wrapper -> `SaveData` mission-persistence neighborhood around `MissionsCompletedAllTime`, `MissionsSinceTR1`, `WastaMissionActive`, `CrytonMissionActive`, `EgetuarMissionActive`, `SekhurMissionActive`, `WastaCampaignProgress`, and `WastaFarmActiveCount`
    - TokenShop -> modifier family on that lane through Daily Tokenium cap upgrade text
    - Collector pack -> premium modifier family on that lane through Academy-menu Daily Tokenium cap text
  - ruled-out owner shortcut:
    - `LM244` is currently grounded as a text-handler path, not as the recovered gameplay owner of daily tokenium
  - adjacent systems still to map:
    - token-bank cap and claimable or ready save-state inputs
    - any distinct token-bank fill owner beyond `SaveData.BankedTokens`
    - Daily Tokenium cap and Daily Tokenium-specific ready or claimable inputs inside that narrowed mission-persistence neighborhood
    - `DiamondBoost` relation to the wider diamond-upgrade domain
    - Meltdown-linked tier gating objects
    - `NewTokenUPGPrefab.*` identity remap
    - notification / overlay shell logic around `ATU*` rows
    - downstream effect owners for generators, token chests, diamond chests, cells, mod points, shards, research points, academy points, hunt loot, campaign fragments, and Ouroboros orbs

- `MultiverseMarket`
  - system: Chrystos Emporium / Inscryptions
  - source owner: [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
  - active owner: `db:derived:multiverse-market-values` via [`scripts/contracts/generate-system-units.mjs`](../../scripts/contracts/generate-system-units.mjs)
  - outputs: [`docs/systems/spend/multiverse-market-values.md`](docs/systems/spend/multiverse-market-values.md), [`docs/systems/spend/multiverse-market-verification.md`](docs/systems/spend/multiverse-market-verification.md), [`docs/systems/spend/multiverse-market-state-verification.md`](docs/systems/spend/multiverse-market-state-verification.md), [`data/archive/multiverse-market-values.json`](data/archive/multiverse-market-values.json)
  - integration status: owner, partial row constants, and `Inscryptions Done` spend-lane shell verified; saved-state recovery now includes a checked `PlayerProfileHandler.get_Market -> MultiverseMarket` accessor bridge, exact dual declaration of `InscryptionsDone` on `PlayerProfileData` and `SaveData`, and exact `SaveData` ownership for the checked `IS*Level` / trade-counter / mech cluster, but player-owned current levels, a bounded import-safe Emporium surface, and full row coverage still remain unresolved before planner UI
  - recovered adjacent handlers:
    - `BuyIS47` -> `MultiverseMarket, Assembly-CSharp`
    - `BuyIS64` -> `MultiverseMarket, Assembly-CSharp`
    - `BuyIS73` -> `MultiverseMarket, Assembly-CSharp`
  - recovered currency-shell evidence:
    - `CostBox-InscryptionsDone`
    - `AchievementBar-Inscryptions`
  - recovered persistence-family clues:
    - `Assets\Scripts\Data&Saving\Nakama\PlayerProfile\PlayerProfileData.cs`
    - `FillPlayerProfileData`
    - `GetPlayerProfileData`
  - recovered state-field clues:
    - `InscryptionsDone`
    - `IS1Level`
    - `IS50Level`
    - `IS51Level`
    - `IS64Level`
    - `IS73Level`
    - `IS110Level`
    - `EsotericR1Trades`
  - recovered broader progression-field neighborhood:
    - `IS1Level` through `IS110Level`
    - `EsotericR1Trades` through `EsotericR9Trades`
    - `NecrumR1Trades` through `NecrumR9Trades`
    - `Mech1Unlocked`
    - `Mech1Upg1Level`

Next likely targets should follow the same pattern: find the real owner object first, then parse the serialized payload directly when typetree tooling fails.

Narrowed but not yet planner-ready owner families:

- shard milestones / loop-reset shell
  - system: shard workflow and loop-reset progression shell
  - current source evidence:
    - [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
    - [`workbench/unity/joined/sharedassets0.assets`](workbench/unity/joined/sharedassets0.assets)
    - [`docs/unity/unity-mechanics-pass.md`](docs/unity/unity-mechanics-pass.md)
    - [`docs/systems/shards/shard-owner-family-verification.md`](docs/systems/shards/shard-owner-family-verification.md)
  - recovered shell identifiers:
    - `LoopResetStage1` through `LoopResetStage5`
    - `ShardMilestones-64`
    - `ShardMilestones-256`
    - `MilestoneBonusesPerLevel`
    - `Milestone1` through at least `Milestone57`
    - `Milestones, Assembly-CSharp`
    - `SpaceShip-ShardMining-LV1` through `SpaceShip-ShardMining-LV4`
  - narrowed shard-specific trail:
    - shard milestone screen controller or fast-buy flow -> `ShardMining, Assembly-CSharp`
    - shard data carrier candidate -> `ShardMining|ShardUpgradeInfo`
  - recovered shard metadata clues:
    - `TotalMilestoneLevels`
    - `get_IsUnlocked`
    - `get_SU1FinalUnlockReq`
    - `get_SU29FinalUnlockReq`
    - `FinalSU1Bonus1`
    - `FinalSU1Bonus2`
    - `FinalSU29Bonus2`
    - `FinalSU29Bonus3`
  - current save-boundary result:
    - the narrowed shard-local contexts currently preserve zero checked overlap with `PlayerProfileData`, `GetPlayerProfileData`, `FillPlayerProfileData`, or `CloudSavePlayerProfile`
  - downgraded parallel lead:
    - `ConstructionMilestones, Assembly-CSharp` remains a generic or academy-side milestone family and should not currently be treated as the shard owner without stronger shard-specific linkage
  - integration status: shard-specific controller and bonus-field clues are grounded enough for truthful shard workflow copy, but the exact serialized milestone payload, player-owned milestone state, and player-facing milestone label mapping are still unresolved; keep planner behavior blocked
  - next extraction target:
    - recover the exact serialized milestone row or save-side state from the narrowed `ShardMining` / `ShardUpgradeInfo` trail before promoting milestone rows, labels, or costs as game-side truth



