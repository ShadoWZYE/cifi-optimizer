# Multiverse Market Market-Member Boundary

This note records the current repo-local boundary around the `get_Market` accessor clue recovered inside the `PlayerProfile` persistence neighborhood.

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

## Current grounded conclusion

- the PlayerProfile persistence family now has a real `get_Market` accessor clue, so the remaining save-side search is narrower than a generic "`PlayerProfileData` somewhere" hypothesis
- the same `PlayerProfileData` neighborhood now also preserves a bare `Market` member-shell clue beside the same kind of profile-side substructure names used for `Relics`, `CellData`, `ShardData`, `ResearchPointData`, and `AcademyPointData`
- the same narrowed neighborhood also preserves `PlayerProfileHandler`, `playerData`, `GetPlayerProfileData`, `FillPlayerProfileData`, and `ConvertSaveDataToProfileData` beside `get_Market` and `Market`, which makes the strongest current bridge a `PlayerProfileHandler`-mediated `playerData -> get_Market -> Market` path
- that same direct local neighborhood also preserves `get_Market`, `Market`, `GetPlayerProfileData`, `FillPlayerProfileData`, and `<FillPlayerProfileData>d__45` together, so there is still no checked repo-local evidence of another named object between `get_Market` and the PlayerProfile-side `Market` member
- that same bridge also preserves sibling market-side accessors `get_BM`, `get_ZN`, and `get_TU`, which makes `Market` look more like a broader wrapper hub than a direct Emporium-only declaring owner
- the recovered `InscryptionsDone` field run still lives in a separate broader progression cluster that spans `IS71Level` through `IS110Level`, `EsotericR*Trades`, `NecrumR*Trades`, and early `Mech1*` fields, which is broader than the direct-member `Market` shell itself
- the same metadata still exposes typed nested `PlayerProfileData` siblings such as `PlayerProfileData|GemData` and `PlayerProfileData|GemNodeCombo` without exposing an equivalent `PlayerProfileData|Market` or `PlayerProfileData|Inscryption` clue, so the exact type under that direct `Market` member handoff remains unresolved
- the cloud-save neighborhood still points through `CloudSavePlayerProfile` and `GetPlayerProfileInfo`, which keeps this lane attached to repo-local player-profile recovery rather than to UI-only Emporium text handlers
- the repo still does not have a direct `PlayerProfileData|Market` or `PlayerProfileData|Inscryption` type-map string, so direct declaring ownership is still unresolved
- the closest recovered market-side family still looks broader than `MultiverseMarket` alone, so the strongest grounded claim is now a `PlayerProfileHandler`-mediated direct `Market` member handoff that likely reaches a deeper progression payload rather than a fully named declared type

## Safe use

- safe for save-model narrowing and fail-fast validation
- not safe for adding canonical Emporium fields to `state.playerProfile`
- not safe for claiming that `MultiverseMarket` is itself the serialized PlayerProfile member
- not safe for claiming that another named nested object has been recovered between `get_Market` and `Market`
- not safe for claiming that `Market` itself directly declares `InscryptionsDone` or the nearby `IS*Level` cluster
