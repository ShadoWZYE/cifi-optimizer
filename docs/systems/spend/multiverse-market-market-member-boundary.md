# Multiverse Market Market-Member Boundary

This note records the current repo-local boundary around the `get_Market` handoff recovered inside the `PlayerProfile` persistence neighborhood.

## Boundary split

- checked accessor bridge:
  - `PlayerProfileHandler.get_Market -> MultiverseMarket`
- metadata/member-shell clue:
  - `Market`
- checked typed-`Market` field result:
  - no typed `Market` or `MultiverseMarket` field is recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
- deeper typed `Market`-named owner status:
  - the declaring owner for the checked `InscryptionsDone` / `IS*Level` cluster is already closed on `SaveData`; only a typed `Market`-wrapper recovery beyond the checked accessor bridge remains unresolved

## What is now preserved

- PlayerProfile-side accessor clues:
  - `get_Market`
  - `get_BM`
  - `get_ZN`
  - `get_TU`
  - `get_ShardData`
  - `get_ResearchPointData`
  - `get_AcademyPointData`
- PlayerProfile-side member-shell clues:
  - `Market`
  - `Relics`
  - `CellData`
  - `ModPointData`
  - `ShardData`
  - `ResearchPointData`
  - `AcademyPointData`
  - `BlueprintsThisTR`
- PlayerProfileHandler bridge clues:
  - `PlayerProfileHandler`
  - `playerData`
  - `GetPlayerProfileData`
  - `FillPlayerProfileData`
  - `ConvertSaveDataToProfileData`
- direct member-handoff clues:
  - `get_Market`
  - `Market`
  - `GetPlayerProfileData`
  - `FillPlayerProfileData`
  - `<FillPlayerProfileData>d__45`
- typed sibling contrast clues:
  - `PlayerProfileData|GemData`
  - `PlayerProfileData|GemNodeCombo`
- cloud-save bridge clues:
  - `CloudSavePlayerProfile`
  - `GetCurrentSaveFileInfo`
  - `GetPlayerProfileInfo`
  - `CloudLoad`
- missing direct type-map clues:
  - `PlayerProfileData|Market`
  - `PlayerProfileData|Inscryption`
  - `PlayerProfileData|MultiverseMarket`
- nearby market-wrapper type clues:
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
- broader progression-payload field clues:
  - `IS71Level`
  - `IS110Level`
  - `InscryptionsDone`
  - `EsotericR1Trades`
  - `NecrumR1Trades`
  - `Mech1Unlocked`
  - `Mech1MissionsCompleted`
- exact typed bridge recovery:
  - `PlayerProfileHandler.get_Market -> MultiverseMarket`
- exact typed PlayerProfileHandler field recovery:
  - `saveInfoCache: PlayerProfileData`
- exact typed save-to-profile conversion recovery:
  - `PlayerProfileHandler.ConvertSaveDataToProfileData(SaveData saveData, System.DateTime lastCloudSaveDate) -> PlayerProfileData`
- exact typed `PlayerProfileData` field-table recovery:
  - `89` direct fields
  - `1` method
- exact typed `SaveData` field-table recovery:
  - `4461` direct fields
  - `1` method
- direct `PlayerProfileData` field samples recovered exactly:
  - `InscryptionsDone`
  - `MechsOwned`
  - `GadgetLevels`
- exact typed `InscryptionsDone` dual declaration:
  - `PlayerProfileData.InscryptionsDone: System.String`
  - `SaveData.InscryptionsDone: System.Int32`
- direct `SaveData` progression-owner samples recovered exactly:
  - `IS71Level`
  - `IS110Level`
  - `InscryptionsDone`
  - `EsotericR1Trades`
  - `NecrumR1Trades`
  - `Mech1Unlocked`
  - `Mech1MissionsCompleted`
- exact typed nested `PlayerProfileData` child checks:
  - `PlayerProfileData+GemData`
- first nested `MultiverseMarket` payloads recovered exactly:
  - `MultiverseMarket|Inscryption`
  - `MultiverseMarket|InscryptionTupleObject`
- first nested row-local field samples:
  - `<ID>k__BackingField`
  - `<Cost>k__BackingField`
  - `<Level>k__BackingField`
  - `<MaxLevel>k__BackingField`
  - `<ISObject>k__BackingField`
  - `transform`

## Current grounded conclusion

- exact typed recovery now confirms `PlayerProfileHandler.get_Market -> MultiverseMarket`, so the checked bridge is no longer just a metadata-neighborhood clue
- the same exact typed probe also confirms `PlayerProfileHandler` only exposes `saveInfoCache: PlayerProfileData` as a typed save-side field in the checked target, and it does not recover a typed `Market` field on `PlayerProfileHandler` itself
- exact typed recovery now also confirms `PlayerProfileHandler.ConvertSaveDataToProfileData(SaveData saveData, System.DateTime lastCloudSaveDate) -> PlayerProfileData`, which gives the broader `SaveData` owner a checked conversion bridge back into the flatter `PlayerProfileData` wrapper/export surface without recovering a typed `Market` field
- exact typed recovery also separately confirms that `PlayerProfileData` directly declares `InscryptionsDone`, `MechsOwned`, and `GadgetLevels` as string fields, while the same checked probe still does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileData`
- exact typed recovery also now fixes the dual declaration on concrete types: `PlayerProfileData.InscryptionsDone` is `System.String` while `SaveData.InscryptionsDone` is `System.Int32`, which further narrows the `PlayerProfileData` copy to a flatter wrapper/export surface rather than a deeper typed Market-owned progression host
- exact typed recovery now also confirms that the checked `PlayerProfileData` field table has `89` direct fields and `1` method, and none of those direct fields are named `IS71Level`, `IS110Level`, `EsotericR1Trades`, `NecrumR1Trades`, `Mech1Unlocked`, or `Mech1MissionsCompleted`
- the same exact typed `PlayerProfileData` probe only recovers `PlayerProfileData+GemData` as a nested typed child in the checked field table, so the wider Emporium progression run is not recovered as a direct typed `PlayerProfileData` child beside the flat `InscryptionsDone`, `MechsOwned`, and `GadgetLevels` wrappers
- exact typed recovery now also confirms that `SaveData` declares `4461` fields and `1` method, and that same save table directly carries `IS71Level` through `IS110Level`, `InscryptionsDone`, `EsotericR*Trades`, `NecrumR*Trades`, and early `Mech1*` progression fields such as `Mech1Unlocked` and `Mech1MissionsCompleted`
- that makes `SaveData` the exact declaring save owner for the checked `IS*Level` / trade-counter / early `Mech*` portion of the wider Emporium progression run, while `InscryptionsDone` is exactly declared on both `SaveData` and `PlayerProfileData` and `PlayerProfileData` remains a flatter export-wrapper surface for nearby summary fields such as `InscryptionsDone`, `MechsOwned`, and `GadgetLevels`
- the same `PlayerProfileData` neighborhood still preserves a bare `Market` member-shell clue beside the same kind of profile-side substructure names used for `Relics`, `CellData`, `ShardData`, `ResearchPointData`, and `AcademyPointData`, but that `Market` clue remains metadata-shell evidence rather than an exact typed member recovery on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
- the first recovered nested `MultiverseMarket` payloads are `MultiverseMarket|Inscryption` and `MultiverseMarket|InscryptionTupleObject`, and their exact fields are row-local `ID`, `Cost`, `Level`, `MaxLevel`, `ISObject`, and `transform` carriers rather than the broader save-side progression block
- the same checked typed probe does not place that wider run directly on `MultiverseMarket` or on those first nested row-local payloads, so `MultiverseMarket` stays grounded as the accessor-returned Emporium owner shell rather than the declaring save owner for the broader progression run
- the checked boundary therefore separates three things explicitly: the typed accessor bridge is `PlayerProfileHandler.get_Market -> MultiverseMarket`, the bare `Market` symbol is still only a metadata/member-shell clue, and no typed `Market`-named field is recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
- `SaveData` remains the separately recovered declaring owner for the wider `IS*Level` / trade-counter / mech progression run, and the exact `InscryptionsDone` type split now closes that declaring-owner question for the checked cluster without converting the metadata-only `Market` shell into a checked typed field
- that same bridge still preserves sibling market-side accessors `get_BM`, `get_ZN`, and `get_TU`, which keeps the metadata-side `Market` clue broader than a single Emporium-only field family even though the typed save-side owner is now already closed on `SaveData` for the checked cluster
- the same metadata still exposes typed nested `PlayerProfileData` siblings such as `PlayerProfileData|GemData` and `PlayerProfileData|GemNodeCombo` without exposing an equivalent `PlayerProfileData|Market` or `PlayerProfileData|Inscryption` clue, which keeps the recovered `SaveData` owner separate from any exact typed `Market`-wrapper recovery on `PlayerProfileData`
- the cloud-save neighborhood still points through `CloudSavePlayerProfile` and `GetPlayerProfileInfo`, which keeps this lane attached to repo-local player-profile recovery rather than to UI-only Emporium text handlers, but the checked direct type probe still does not recover `CloudSavePlayerProfile` itself as one of the queried declaring types on this path
- the checked grounded stop point now cleanly distinguishes the save path: `PlayerProfileHandler.get_Market` returns `MultiverseMarket`, `PlayerProfileHandler.ConvertSaveDataToProfileData` gives `SaveData` a checked typed bridge into `PlayerProfileData`, the metadata-only `Market` shell still is not recovered as a typed save-path field, `MultiverseMarket` itself and its first nested row-local payloads are ruled out for the broader progression run, `PlayerProfileData` separately carries flat wrappers such as `InscryptionsDone`, `MechsOwned`, and `GadgetLevels`, `SaveData` exactly declares the checked `IS*Level` / trade-counter / mech cluster, the exact `InscryptionsDone` type split further narrows `PlayerProfileData` to a wrapper/export copy, and the only remaining unresolved seam is whether any typed `Market` wrapper exists beyond the checked bridge

## Safe use

- safe for save-model narrowing and fail-fast validation
- safe for naming `SaveData` as the current exact declaring save owner for the checked `IS*Level` / trade-counter / mech cluster while keeping `InscryptionsDone` split out as an exact dual declaration on `SaveData` and `PlayerProfileData`
- safe for treating `PlayerProfileData.InscryptionsDone` as a flatter typed string wrapper/export copy and `SaveData.InscryptionsDone` as the checked integer-side declaration inside the broader recovered cluster
- not safe for adding canonical Emporium fields to `state.playerProfile`
- not safe for claiming that `MultiverseMarket` is itself the serialized PlayerProfile member just because `get_Market` returns it
- not safe for claiming that a typed `Market` field has been recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
- not safe for claiming that the wider `IS*Level` / trade-counter / mech run is directly declared as flat fields on `PlayerProfileData`
- not safe for claiming that `MultiverseMarket` or its first nested `Inscryption` payloads directly declare the broader `IS*Level`, trade-counter, or mech cluster
- not safe for claiming that the metadata-only `Market` shell has been recovered as a real typed field anywhere on the checked save path
