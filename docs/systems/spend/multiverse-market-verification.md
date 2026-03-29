# Multiverse Market Verification Gate

This document records what is currently grounded about the `MultiverseMarket` spend-planner track and what still blocks app integration.

It exists because the repo had already proven the `MultiverseMarket` owner and late-block constants, but the spend lane and label state were still treated too loosely in the spend-planner docs.

## Verified now

- In-game system family:
  - Chrystos Emporium / Inscryptions
- Unity owner:
  - `MultiverseMarket`
- Repo-local owner evidence:
  - [`workbench/unity/joined/level0`](C:\Users\Shadow\Desktop\CiFi\workbench\unity\joined\level0)
  - [`data/multiverse-market-values.json`](C:\Users\Shadow\Desktop\CiFi\data\multiverse-market-values.json)
  - [`data/lm244-targeted-probe.json`](C:\Users\Shadow\Desktop\CiFi\data\lm244-targeted-probe.json)
  - [`docs/systems/spend/multiverse-market-state-verification.md`](C:\Users\Shadow\Desktop\CiFi\docs\multiverse-market-state-verification.md)
  - [`docs/unity/unity-audit-playbook.md`](C:\Users\Shadow\Desktop\CiFi\docs\unity-audit-playbook.md)

## Spend-lane shell recovered from this pass

- The validated `MultiverseMarket` late block stores a concrete `CurrencyBox` pointer beside each recovered inscription row.
- Existing targeted string probes recover Emporium-side UI shell names:
  - `CostBox-InscryptionsDone`
  - `AchievementBar-Inscryptions`
- Existing targeted string probes also recover direct purchase handlers adjacent to the owner name:
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS47`
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS64`
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS13`
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS73`
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS105`

Current grounded conclusion:

- the Emporium purchase flow is wired through a player-facing cost lane labeled around `Inscryptions Done`
- this is strong enough to stop treating the MultiverseMarket spend lane as completely unknown
- this is not yet strong enough to claim the saved runtime balance field or import-ready player-state shape

## Partial label anchors recovered from repo-local probes

These labels are useful grounding anchors, but they do not yet fully remap all serialized rows:

- `Inscryption 25: Shard Gains`
- `Inscryption 46: Shards Gained`
- `Inscryption 78: Ouroboros Orbs`
- `Inscryption 83: Fast-Loop ML`
- `ChrystosEmporiumUpgrade51`
- `ChrystosEmporiumUpgrade64`
- `ChrystosEmporiumUpgrade73`

Current grounded conclusion:

- the system exposes real inscription-number labels and prefab identities in the shipped assets
- the late serialized block is still not stored in plain inscription-ID order
- label remap remains partial until the row-order and ID mapping are closed more completely

## Still unresolved

- the saved-state field or owner that stores the current `Inscryptions Done` balance
- player-owned current inscription levels or equivalent owned-state inputs for next-buy logic
- full row coverage outside the currently validated late block
- exact row-by-row remap from serialized `IS*` ids and prefab identities to final in-game labels

## Saved-state narrowing from this pass

- Repo-local metadata now narrows the persistence search toward `PlayerProfileData`, `FillPlayerProfileData`, and `GetPlayerProfileData`.
- Repo-local metadata now also exposes exact Emporium-adjacent field strings including `InscryptionsDone`, nearby `IS*Level` entries such as `IS50Level`, `IS64Level`, `IS73Level`, and nearby trade fields such as `EsotericR1Trades`.
- The broader field run around `InscryptionsDone` now includes `IS25Level` through `IS110Level`, `EsotericR1Trades` through `EsotericR9Trades`, `NecrumR1Trades` through `NecrumR9Trades`, and early `Mech*` fields such as `Mech1Unlocked` and `Mech1Upg1Level`.
- Repo-local metadata also shows Inscryptions-adjacent reward/effect symbols such as `AchievementInscryptionsReward` and `<FinalISShardsBonus>k__BackingField`.
- Current grounded conclusion:
  - `MultiverseMarket` remains the mechanic owner
  - the likely saved-state search path now runs through the broader player-profile persistence family
  - `InscryptionsDone` is an exact metadata field string, not just a UI label inferred from `CostBox-InscryptionsDone`
  - the Emporium balance and owned-level fields appear to live in a broader progression-state field block rather than in the separate reward/effect symbol families
  - effect/reward symbols should not be treated as recovered saved-balance fields

## Current app implication

- It is safe to treat `MultiverseMarket` as a real Emporium owner with a grounded `Inscryptions Done` cost-lane shell.
- It is not safe to generate spend recommendations yet.
- The spend-planner track should stop inferring this lane from diamonds or tokens.
- `MultiverseMarket` remains `available but unmapped` until the owned-state and saved-balance inputs are recovered.

## Next allowed slice

1. determine which save model actually declares `InscryptionsDone` and the nearby `IS*Level` fields
2. recover player-owned inscription levels or equivalent next-purchase state from that same save-side neighborhood
3. extend parsing past the current validated late block
4. finish the inscription-number and prefab-to-label remap
5. only then add spend-planner recommendations

