# Multiverse Market Market-Member Boundary

This note records the current repo-local boundary around the `get_Market` handoff recovered inside the `PlayerProfile` persistence neighborhood.

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
- direct `PlayerProfileData` field samples recovered exactly:
  - `InscryptionsDone`
  - `MechsOwned`
  - `GadgetLevels`
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
- exact typed recovery also separately confirms that `PlayerProfileData` directly declares `InscryptionsDone`, `MechsOwned`, and `GadgetLevels` as string fields, while the same checked probe still does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileData`
- the same `PlayerProfileData` neighborhood still preserves a bare `Market` member-shell clue beside the same kind of profile-side substructure names used for `Relics`, `CellData`, `ShardData`, `ResearchPointData`, and `AcademyPointData`, but that `Market` clue remains metadata-shell evidence rather than an exact typed member recovery
- the first recovered nested `MultiverseMarket` payloads are `MultiverseMarket|Inscryption` and `MultiverseMarket|InscryptionTupleObject`, and their exact fields are row-local `ID`, `Cost`, `Level`, `MaxLevel`, `ISObject`, and `transform` carriers rather than the broader save-side progression block
- the recovered wider progression field run still spans `IS71Level` through `IS110Level`, `EsotericR*Trades`, `NecrumR*Trades`, and early `Mech1*` fields, and current checked typed recovery does not place that wider run directly on `MultiverseMarket` or on those first nested row-local payloads
- that means the direct PlayerProfile-side market type recovered through `get_Market` is ruled out as the declaring type for the combined progression run, even though the metadata shell still preserves `Market`-side clue strings
- that same bridge still preserves sibling market-side accessors `get_BM`, `get_ZN`, and `get_TU`, which keeps the metadata-side `Market` clue broader than a single Emporium-only field family even though `MultiverseMarket` itself is now recovered exactly
- the same metadata still exposes typed nested `PlayerProfileData` siblings such as `PlayerProfileData|GemData` and `PlayerProfileData|GemNodeCombo` without exposing an equivalent `PlayerProfileData|Market` or `PlayerProfileData|Inscryption` clue, so the exact declaring type for the wider `IS*Level` / trade-counter / mech run remains unresolved
- the cloud-save neighborhood still points through `CloudSavePlayerProfile` and `GetPlayerProfileInfo`, which keeps this lane attached to repo-local player-profile recovery rather than to UI-only Emporium text handlers
- the narrowest checked grounded stop point is now accessor versus deeper owner: `PlayerProfileHandler.get_Market` returns `MultiverseMarket`, `MultiverseMarket` itself and its first nested row-local payloads are ruled out for the broader progression run, `PlayerProfileData` separately carries `InscryptionsDone`, and the broader `IS*Level` / trade-counter / mech owner still is not recovered exactly

## Safe use

- safe for save-model narrowing and fail-fast validation
- not safe for adding canonical Emporium fields to `state.playerProfile`
- not safe for claiming that `MultiverseMarket` is itself the serialized PlayerProfile member just because `get_Market` returns it
- not safe for claiming that a typed `Market` field has been recovered on `PlayerProfileHandler` or `PlayerProfileData`
- not safe for claiming that `MultiverseMarket` or its first nested `Inscryption` payloads directly declare the broader `IS*Level`, trade-counter, or mech cluster
- not safe for claiming that the wider progression run is fully solved just because `PlayerProfileData` directly declares `InscryptionsDone`
