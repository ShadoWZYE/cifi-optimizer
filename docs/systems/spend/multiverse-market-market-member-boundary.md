# Multiverse Market Market-Member Boundary

This note records the current repo-local boundary around the `get_Market` accessor clue recovered inside the `PlayerProfile` persistence neighborhood.

## What is now preserved

- PlayerProfile-side accessor clues:
  - `get_Market`
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

## Current grounded conclusion

- the PlayerProfile persistence family now has a real `get_Market` accessor clue, so the remaining save-side search is narrower than a generic "`PlayerProfileData` somewhere" hypothesis
- the same `PlayerProfileData` neighborhood now also preserves a bare `Market` member-shell clue beside the same kind of profile-side substructure names used for `Relics`, `CellData`, `ShardData`, `ResearchPointData`, and `AcademyPointData`
- the cloud-save neighborhood still points through `CloudSavePlayerProfile` and `GetPlayerProfileInfo`, which keeps this lane attached to repo-local player-profile recovery rather than to UI-only Emporium text handlers
- the repo still does not have a direct `PlayerProfileData|Market` or `PlayerProfileData|Inscryption` type-map string, so direct declaring ownership is still unresolved
- the closest recovered market-side family still looks broader than `MultiverseMarket` alone, so the strongest grounded claim is now "direct PlayerProfileData member shell or broader wrapper handoff" rather than a fully named declared type

## Safe use

- safe for save-model narrowing and fail-fast validation
- not safe for adding canonical Emporium fields to `state.playerProfile`
- not safe for claiming that `MultiverseMarket` is itself the serialized PlayerProfile member
