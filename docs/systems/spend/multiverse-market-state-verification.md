# Multiverse Market State Verification

This document records what the repo can currently say about the saved-state side of the `MultiverseMarket` track.

It now includes exact metadata field strings that sit around the Emporium state lane, exact typed bridge recovery for the direct `get_Market` accessor, and an exact negative result for typed `Market` field recovery on the checked PlayerProfile-side owners. The current goal is narrower than import support: keep the checked accessor bridge, the metadata-only `Market` shell, and the wider save-owner recovery separated so the repo does not silently treat `Market` as a typed declaring field without evidence.

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
- this does not, by itself, recover a typed `Market` field anywhere on the checked PlayerProfile persistence path

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
- this keeps the typed `Market` field question open at the metadata layer, but not resolved enough to treat `Market` as a recovered typed member on the checked save path

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
- exact typed bridge recovery:
  - `PlayerProfileHandler.get_Market -> MultiverseMarket`
- direct `PlayerProfileData` field samples recovered exactly:
  - `InscryptionsDone`
  - `MechsOwned`
  - `GadgetLevels`
- first nested `MultiverseMarket` payloads recovered exactly:
  - `MultiverseMarket|Inscryption`
  - `MultiverseMarket|InscryptionTupleObject`

Current grounded conclusion:

- the strongest current repo-local handoff is no longer just "PlayerProfile family somewhere"
- exact typed recovery now confirms that `PlayerProfileHandler.get_Market` returns `MultiverseMarket`, so the direct handoff itself is checked rather than inferred only from nearby strings
- the same exact typed probe also confirms that `PlayerProfileHandler` only exposes `saveInfoCache: PlayerProfileData` as a typed save-side field in the checked target, and it does not recover a typed `Market` field on `PlayerProfileHandler` itself
- exact typed recovery separately confirms that `PlayerProfileData` directly declares `InscryptionsDone`, `MechsOwned`, and `GadgetLevels` as string fields, while the same probe does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileData`
- exact typed recovery now also confirms that the checked `PlayerProfileData` field table has `89` direct fields and `1` method, and none of those direct fields are named `IS71Level`, `IS110Level`, `EsotericR1Trades`, `NecrumR1Trades`, `Mech1Unlocked`, or `Mech1MissionsCompleted`
- the same exact typed `PlayerProfileData` probe only recovers `PlayerProfileData+GemData` as a nested typed child in the checked field table, so the wider Emporium progression run is not recovered as a direct typed `PlayerProfileData` child beside the flat `InscryptionsDone`, `MechsOwned`, and `GadgetLevels` wrappers
- exact typed recovery now also confirms that `SaveData` declares `4461` fields and `1` method, and that same save table directly carries `IS71Level` through `IS110Level`, `InscryptionsDone`, `EsotericR*Trades`, `NecrumR*Trades`, and early `Mech1*` progression fields such as `Mech1Unlocked` and `Mech1MissionsCompleted`
- that makes `SaveData` the exact declaring save owner for the wider Emporium progression run, while `PlayerProfileData` remains a flatter export-wrapper surface for nearby summary fields
- exact typed recovery also confirms that the first nested `MultiverseMarket` payloads are `MultiverseMarket|Inscryption` and `MultiverseMarket|InscryptionTupleObject`, and those payloads are row-local carriers rather than the broader progression block
- the same bridge still preserves sibling market-side accessors `get_BM`, `get_ZN`, and `get_TU`, which keeps `Market` broader than one Emporium-only field family even though the direct member handoff is now narrower than the older generic wrapper guess
- the recovered wider progression field run still sits in a broader cluster that spans `IS*Level`, Inscryptions, Necrum trade counters, and early mech progression, and the current checked typed recovery does not place that wider run directly on `MultiverseMarket` or on the first recovered nested market payloads
- the checked boundary therefore separates three things explicitly: `PlayerProfileHandler.get_Market -> MultiverseMarket` is the checked accessor bridge, `Market` is still only a metadata/member-shell clue, and no typed `Market`-named field is recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
- `SaveData` remains the exact wider progression owner for the broader `IS*Level` / trade-counter / mech run, but that wider owner recovery does not convert the metadata-only `Market` shell into a checked typed field or resolve a deeper typed `Market`-named save-path owner
- this is useful because it closes the checked save-owner question for the broader run without pretending the Emporium state is already import-ready or that `Market` has been recovered as a typed declaring field

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
- exact typed recovery now also shows that `InscryptionsDone` is directly declared on `PlayerProfileData`, while the wider `IS*Level` / trade-counter / mech cluster still does not have an exact declaring type or serialized object layout recovered at runtime

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
- exact typed recovery now rules out the direct checked `MultiverseMarket` owner, its first recovered nested row-local payloads, and flat direct `PlayerProfileData` fields for that wider run, and now also identifies `SaveData` as the declaring save structure that carries that broader progression block

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
  - `SaveData` / `PlayerProfileData` / `FillPlayerProfileData` / `GetPlayerProfileData` / `get_Market` / `Market`

## What remains unresolved

- the authoritative saved-state field range or list for owned inscription levels
- whether the metadata-only `Market` shell corresponds to a real typed field anywhere on the checked save path, or only to accessor/property naming around the checked bridge
- whether downstream import work should read the wider `SaveData` declaration block directly, or continue using narrower wrapper-specific import surfaces for MVP safety

## Current app implication

- It is still not safe to add canonical `Inscryptions Done` or inscription-level fields to `state.playerProfile`.
- It is now safe to treat `InscryptionsDone` and nearby `IS*Level` strings as grounded metadata field clues for future save-side mapping work.
- It is now safe to treat `PlayerProfileHandler.get_Market -> MultiverseMarket` as a checked typed bridge, `PlayerProfileHandler.saveInfoCache` as a checked `PlayerProfileData` field, and the first nested `MultiverseMarket` payloads as row-local only.
- It is now safe to treat flat direct `PlayerProfileData` ownership of the wider `IS*Level` / trade-counter / mech run as ruled out in the checked field table, even though `PlayerProfileData` still exposes flat wrappers such as `InscryptionsDone`, `MechsOwned`, and `GadgetLevels`.
- It is now safe to treat `SaveData` as the exact declaring save owner for the wider `IS*Level` / trade-counter / mech progression cluster.
- It is now safe to treat the surrounding trade and mech fields as evidence that this lane lives in a broader saved progression block rather than in the separate reward/effect families.
- It is now safe to treat the save-side search as narrowed to `SaveData` behind the PlayerProfile persistence family and a checked `PlayerProfileHandler.get_Market -> MultiverseMarket` accessor bridge, while explicitly not claiming that a typed `Market` field has been recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`.
- It is now safe to treat validated Emporium rows `71-74` as the first row block that has both checked row recovery and direct save-side `IS*Level` overlap, while keeping row remap and canonical import promotion downstream.
- The next spend-track slice should fork from this save-owner recovery and decide how much of the recovered `SaveData` declaration block can be used for bounded import support without reopening row remap or planner integration.


