# Multiverse Market State Verification

This document records what the repo can currently say about the saved-state side of the `MultiverseMarket` track.

It now includes exact metadata field strings that sit around the Emporium state lane, but it still does not claim the exact declaring save model for the current `Inscryptions Done` balance. The current goal is narrower: identify which repo-local evidence meaningfully narrows the search, and record what still remains unresolved.

## Saved-state narrowing from this pass

Repo-local metadata already shows a concrete persistence family outside the raw Emporium owner:

- `Assets\Scripts\Data&Saving\Nakama\PlayerProfile\PlayerProfileData.cs`
- `FillPlayerProfileData`
- `GetPlayerProfileData`
- `CloudSavePlayerProfile`

Current grounded conclusion:

- saved player-owned progression is likely serialized through the broader `PlayerProfileData` family rather than being owned directly by `MultiverseMarket`
- this is enough to narrow future saved-state recovery toward the profile/save path instead of continuing to treat the Emporium owner object as the only place to search
- this is not enough to name the exact declaring save model for current `Inscryptions Done` balance or owned inscription levels

## Exact metadata field cluster recovered from this pass

Repo-local metadata probing now recovers exact Emporium-adjacent field strings and nearby UI hooks:

- state-field clues:
  - `InscryptionsDone`
  - `IS1Level`
  - `IS50Level`
  - `IS51Level`
  - `IS64Level`
  - `IS73Level`
  - `IS110Level`
  - `EsotericR1Trades`
- UI/text-side neighbors:
  - `InscryptionsDoneText`
  - `SetInscryptionsDoneText`
  - `SetAllChrystosEmporiumTexts`
- generated outputs from this pass:
  - [`scripts/metadata_neighborhood_probe.py`](C:\Users\Shadow\Desktop\CiFi\scripts\metadata_neighborhood_probe.py)
  - [`docs/multiverse-market-metadata-neighborhood.md`](C:\Users\Shadow\Desktop\CiFi\docs\multiverse-market-metadata-neighborhood.md)
  - [`data/multiverse-market-metadata-neighborhood.json`](C:\Users\Shadow\Desktop\CiFi\data\multiverse-market-metadata-neighborhood.json)

Current grounded conclusion:

- `InscryptionsDone` is now grounded as an exact metadata field string, not just as a UI label
- nearby `IS*Level` strings make it credible that player-owned inscription levels are persisted somewhere in the same broader save-side neighborhood
- the repo still does not have the exact declaring type or serialized object layout that owns those fields at runtime

## Broader progression-field block recovered from this pass

The repo-local metadata neighborhood around `InscryptionsDone` now shows a longer contiguous field run rather than only isolated Emporium strings:

- preceding inscription-level block:
  - `IS25Level` through `IS110Level`
- immediate trade counters:
  - `EsotericR1Trades` through `EsotericR9Trades`
  - `NecrumR1Trades` through `NecrumR9Trades`
- immediately following progression fields:
  - `Mech1Unlocked`
  - `Mech1Units`
  - `Mech1Upg1Level`
  - `Mech1Upg2Level`
  - `Mech1MissionsProgress`
  - `Mech1MissionsCompleted`
  - `Mech2Unlocked`

Current grounded conclusion:

- `InscryptionsDone` sits inside a broader player-progression field cluster rather than beside the separate `AchievementInscryptionsReward` or `FinalIS*` reward/effect symbols
- this is stronger evidence that the Emporium lane belongs to a saved progression model or sub-structure, not to a UI-only text path
- this still does not identify whether the containing save structure is `PlayerProfileData` directly or a nested progression object serialized through that family

## Adjacent non-save signals that should not be mistaken for saved-state recovery

Repo-local metadata also exposes Inscryptions-adjacent symbols such as:

- `AchievementInscryptionsReward`
- `<FinalISShardsBonus>k__BackingField`
- `Assets\Scripts\Upgrades\Ouroboros\MultiverseMarket.cs`

Current grounded conclusion:

- these confirm the system has separate reward/effect outputs and upgrade-side handlers
- they do not, by themselves, recover the saved player-owned amount for the Emporium spend lane
- future work should avoid collapsing effect outputs like `FinalIS*` fields into claimed saved-state ownership

## What is now grounded

- Emporium mechanics owner:
  - `MultiverseMarket`
- Emporium purchase shell:
  - `CostBox-InscryptionsDone`
  - `AchievementBar-Inscryptions`
  - `BuyIS*` handlers
- likely persistence search family:
  - `PlayerProfileData` / `FillPlayerProfileData` / `GetPlayerProfileData`

## What remains unresolved

- the exact declaring save model that owns `InscryptionsDone`
- the authoritative saved-state field range or list for owned inscription levels
- whether the contiguous `IS*Level` / `EsotericR*Trades` / `NecrumR*Trades` / `Mech*` run belongs directly to `PlayerProfileData` or to a nested progression payload
- whether the nearby `IS*Level` and `EsotericR*Trades` strings belong to direct profile fields, nested achievement/progression records, or another serialized sub-structure inside `PlayerProfileData`

## Current app implication

- It is still not safe to add canonical `Inscryptions Done` or inscription-level fields to `state.playerProfile`.
- It is now safe to treat `InscryptionsDone` and nearby `IS*Level` strings as grounded metadata field clues for future save-side mapping work.
- It is now safe to treat the surrounding trade and mech fields as evidence that this lane lives in a broader saved progression block rather than in the separate reward/effect families.
- It is now safe to treat the save-side search as narrowed to the player-profile persistence family instead of the raw Emporium owner alone.
- The next spend-track slice should determine which save model actually declares `InscryptionsDone` and the nearby `IS*Level` cluster before any planner UI is added.
