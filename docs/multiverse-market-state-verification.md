# Multiverse Market State Verification

This document records what the repo can currently say about the saved-state side of the `MultiverseMarket` track.

It does not claim the exact saved field for `Inscryptions Done`. The current goal is narrower: identify which repo-local evidence meaningfully narrows the search, and record what still remains unresolved.

## Saved-state narrowing from this pass

Repo-local metadata already shows a concrete persistence family outside the raw Emporium owner:

- `Assets\Scripts\Data&Saving\Nakama\PlayerProfile\PlayerProfileData.cs`
- `FillPlayerProfileData`
- `GetPlayerProfileData`
- `CloudSavePlayerProfile`

Current grounded conclusion:

- saved player-owned progression is likely serialized through the broader `PlayerProfileData` family rather than being owned directly by `MultiverseMarket`
- this is enough to narrow future saved-state recovery toward the profile/save path instead of continuing to treat the Emporium owner object as the only place to search
- this is not enough to name the exact field for current `Inscryptions Done` balance or owned inscription levels

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

- the exact saved-state field for current `Inscryptions Done`
- the exact saved-state field or list for owned inscription levels
- whether those values are stored as direct profile fields, nested achievement/progression records, or another serialized sub-structure inside `PlayerProfileData`

## Current app implication

- It is still not safe to add canonical `Inscryptions Done` or inscription-level fields to `state.playerProfile`.
- It is now safe to treat the save-side search as narrowed to the player-profile persistence family instead of the raw Emporium owner alone.
- The next spend-track slice should inspect `PlayerProfileData`-side field neighborhoods before any planner UI is added.
