# Multiverse Market State Verification

This document records what the repo can currently say about the saved-state side of the `MultiverseMarket` track.

It now includes exact metadata field strings that sit around the Emporium state lane, but it still does not claim the exact declaring save model for the current `Inscryptions Done` balance. The current goal is narrower: identify which repo-local evidence meaningfully narrows the search, and record what still remains unresolved.

## Saved-state narrowing from this pass

Repo-local metadata already shows a concrete persistence family outside the raw Emporium owner:

- `Assets\Scripts\Data&Saving\Nakama\PlayerProfile\PlayerProfileData.cs`
- `FillPlayerProfileData`
- `GetPlayerProfileData`
- `CloudSavePlayerProfile`
- `get_Market`

Current grounded conclusion:

- saved player-owned progression is likely serialized through the broader `PlayerProfileData` family rather than being owned directly by `MultiverseMarket`
- this is enough to narrow future saved-state recovery toward the profile/save path instead of continuing to treat the Emporium owner object as the only place to search
- this is not enough to name the exact declaring save model for current `Inscryptions Done` balance or owned inscription levels

## PlayerProfile market-member clue recovered from this pass

The deeper repo-local metadata probe now preserves one stronger clue inside the same PlayerProfile persistence neighborhood:

- `get_Market`

The same probe also still preserves type-map style strings such as:

- `|PlayerProfileData`
- `PlayerProfileData|GemData`
- `PlayerProfileData|GemNodeCombo`
- `|MultiverseMarket`
- `MultiverseMarket|InscryptionTupleObject`
- `MultiverseMarket|Inscryption`

Current grounded conclusion:

- the PlayerProfile persistence family now exposes a direct `get_Market` accessor clue beside other profile-side accessors such as `get_ShardData`, `get_ResearchPointData`, and `get_AcademyPointData`
- this is stronger than the earlier broad `PlayerProfileData` family narrowing because it suggests the Emporium lane may hang off a profile-side `Market` member or related sub-structure
- the current repo-local metadata still does not expose a direct `PlayerProfileData|Market` or `PlayerProfileData|Inscryption` type-map clue
- this keeps the declaring owner unresolved, but it narrows the remaining question from "somewhere in the PlayerProfile family" toward "likely a profile-side market member or nested progression payload"

## Market-member versus wrapper boundary

The checked boundary artifact for this handoff now preserves the stronger repo-local split:

- PlayerProfile-side member clue:
  - `get_Market`
- PlayerProfile-side member-shell clues:
  - `Market`
  - `Relics`
  - `CellData`
  - `ModPointData`
  - `ShardData`
  - `ResearchPointData`
  - `AcademyPointData`
  - `BlueprintsThisTR`
- cloud-save bridge clues:
  - `CloudSavePlayerProfile`
  - `GetCurrentSaveFileInfo`
  - `GetPlayerProfileInfo`
  - `CloudLoad`
- still-missing direct type-map clues:
  - `PlayerProfileData|Market`
  - `PlayerProfileData|Inscryption`
  - `PlayerProfileData|MultiverseMarket`
- nearest recovered market-wrapper family:
  - `MultiverseMarket`
  - `MultiverseMarket|InscryptionTupleObject`
  - `MultiverseMarket|Inscryption`
  - `NecrumExchange`
  - `OuroborosResetter`
  - `TraitSpheres`
  - `ZeimarrNautallium`
  - `ResearchLaboratory`
  - `ResearchUltimas`
  - `RewardLanes`
  - `ShardMining`

Current grounded conclusion:

- the strongest current repo-local handoff is no longer just "PlayerProfile family somewhere"
- the stronger boundary is now a `PlayerProfileHandler`-mediated `playerData -> get_Market -> Market` wrapper path rather than direct `MultiverseMarket` ownership on `PlayerProfileData` or loose top-level `PlayerProfileData` fields
- the same bridge also preserves sibling market-side accessors `get_BM`, `get_ZN`, and `get_TU`, which makes `Market` look more like an intermediate wrapper hub than a direct Emporium-only declaring owner
- the recovered `InscryptionsDone` field run still sits in a broader progression cluster that spans Inscryptions, Necrum trade counters, and early mech progression, which is wider than the wrapper-side `Market` shell itself
- this is useful because it narrows the next recovery step from "which Market wrapper?" toward "which deeper progression payload under that wrapper?" without pretending the Emporium state is already import-ready

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
  - [`scripts/unity/metadata_neighborhood_probe.py`](scripts/unity/metadata_neighborhood_probe.py)
  - [`docs/systems/spend/multiverse-market-metadata-neighborhood.md`](docs/multiverse-market-metadata-neighborhood.md)
  - [`data/multiverse-market-metadata-neighborhood.json`](data/multiverse-market-metadata-neighborhood.json)

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
- the recovered `IS*Level` run now directly overlaps the validated Emporium row block at ids `71-74`, which creates a grounded bridge between save-side level clues and checked market rows
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
  - `PlayerProfileData` / `FillPlayerProfileData` / `GetPlayerProfileData` / `get_Market` / `Market`

## What remains unresolved

- the exact declaring save model that owns `InscryptionsDone` inside the narrowed `PlayerProfileHandler`-mediated `playerData -> get_Market -> Market` bridge path
- the authoritative saved-state field range or list for owned inscription levels
- whether the `get_Market` accessor resolves directly to the declaring Emporium state owner or only to an intermediate market wrapper that still hands off to a deeper progression object
- which deeper progression payload under that bridge owns the contiguous `IS*Level` / `EsotericR*Trades` / `NecrumR*Trades` / `Mech*` run if `Market` itself is only the wrapper
- whether the nearby `IS*Level` and `EsotericR*Trades` strings belong to direct wrapper fields, nested achievement/progression records, or another serialized sub-structure under the same PlayerProfile-side market bridge

## Current app implication

- It is still not safe to add canonical `Inscryptions Done` or inscription-level fields to `state.playerProfile`.
- It is now safe to treat `InscryptionsDone` and nearby `IS*Level` strings as grounded metadata field clues for future save-side mapping work.
- It is now safe to treat the surrounding trade and mech fields as evidence that this lane lives in a broader saved progression block rather than in the separate reward/effect families.
- It is now safe to treat the save-side search as narrowed to the PlayerProfile persistence family and a `PlayerProfileHandler`-mediated `playerData -> get_Market -> Market` wrapper path that most likely hands off to a deeper progression payload instead of the raw Emporium owner alone.
- It is now safe to treat validated Emporium rows `71-74` as the first row block that has both checked row recovery and direct save-side `IS*Level` overlap, while keeping the declaring owner unresolved.
- The next spend-track slice should determine which deeper save model actually declares `InscryptionsDone` and the nearby `IS*Level` cluster under that narrowed bridge before any planner UI is added.


