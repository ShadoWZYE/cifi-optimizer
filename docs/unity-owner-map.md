# Unity Owner Map

Current grounded mechanic owners recovered from the shipped CIFI Unity build:

- `TokenShop`
  - system: token bank / token upgrades
  - source owner: [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
  - parser: [`scripts/token_shop_parse.py`](C:\Users\Shadow\Desktop\CiFi\scripts\token_shop_parse.py)
  - outputs: [`docs/token-shop-values.md`](C:\Users\Shadow\Desktop\CiFi\docs\token-shop-values.md), [`docs/token-bank-state-verification.md`](C:\Users\Shadow\Desktop\CiFi\docs\token-bank-state-verification.md), [`data/token-shop-values.json`](C:\Users\Shadow\Desktop\CiFi\data\token-shop-values.json)
  - integration status: owner and serialized constants verified; token-bank state lane verified at the controller level; the Daily Tokenium lane is now better grounded as an Academy or Farm Mission reward family that TokenShop modifies; `OR_TokenBankCap` and `OR_TokensFromChests` narrowed to asset-label clues rather than proven formula owners; player-owned current levels and final player-facing label remap still required before planner UI
  - recovered adjacent handlers:
    - `ClaimBankedTokens` -> `TokenShop, Assembly-CSharp`
    - token-bank cap display -> `BigStatisticPrefab.TokenBankCap`
    - daily-tokenium mission text path -> `TextHandlerLoopMods.SetLM244BonusText`
  - recovered owner-family split:
    - underlying Daily Tokenium lane -> `SpaceAcademy` / `FarmMissions` family in `level0`
    - TokenShop -> modifier family on that lane through Daily Tokenium cap upgrade text
    - Collector pack -> premium modifier family on that lane through Academy-menu Daily Tokenium cap text
  - ruled-out owner shortcut:
    - `LM244` is currently grounded as a text-handler path, not as the recovered gameplay owner of daily tokenium
  - adjacent systems still to map:
    - token-bank cap / fill / claim owner and save-state inputs
    - Academy or Farm Mission gameplay owner and saved-state inputs for Daily Tokenium
    - `DiamondBoost` relation to the wider diamond-upgrade domain
    - Meltdown-linked tier gating objects
    - `NewTokenUPGPrefab.*` identity remap
    - notification / overlay shell logic around `ATU*` rows
    - downstream effect owners for generators, token chests, diamond chests, cells, mod points, shards, research points, academy points, hunt loot, campaign fragments, and Ouroboros orbs

- `MultiverseMarket`
  - system: Chrystos Emporium / Inscryptions
  - source owner: [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
  - parser: [`scripts/multiverse_market_parse.py`](C:\Users\Shadow\Desktop\CiFi\scripts\multiverse_market_parse.py)
  - outputs: [`docs/multiverse-market-values.md`](C:\Users\Shadow\Desktop\CiFi\docs\multiverse-market-values.md), [`docs/multiverse-market-verification.md`](C:\Users\Shadow\Desktop\CiFi\docs\multiverse-market-verification.md), [`docs/multiverse-market-state-verification.md`](C:\Users\Shadow\Desktop\CiFi\docs\multiverse-market-state-verification.md), [`data/multiverse-market-values.json`](C:\Users\Shadow\Desktop\CiFi\data\multiverse-market-values.json)
  - integration status: owner, partial row constants, and `Inscryptions Done` spend-lane shell verified; saved-state search now narrowed toward `PlayerProfileData`, and exact metadata field clues now include `InscryptionsDone` plus nearby `IS*Level` entries, but the exact declaring save model, player-owned current levels, and full row coverage still remain unresolved before planner UI
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

Next likely targets should follow the same pattern: find the real owner object first, then parse the serialized payload directly when typetree tooling fails.
