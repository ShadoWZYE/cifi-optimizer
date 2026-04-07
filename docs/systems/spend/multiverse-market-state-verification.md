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

## Checked `IS*Level` to inscription-row boundary

- The wider inscription set now has three checked repo-local order clues that can be held together without over-claiming:
  - the broader action shell preserves `BuyIS1` through `BuyIS110` and `SetIS1CostText` through `SetIS110CostText`
  - the validated serialized late block currently covers rows `50-59` and `63-74`
  - the recovered `SaveData` field run around `InscryptionsDone` spans `IS25Level` through `IS110Level`
- Inside that wider ordered set, the smallest checked row-position overlap is now:
  - `IS71Level` -> ordered row `71`
  - `IS72Level` -> ordered row `72`
  - `IS73Level` -> ordered row `73`
  - `IS74Level` -> ordered row `74`
- This is grounded because each of those rows is present in the validated row dataset, each has checked `SetIS71CostText` through `SetIS74CostText` and `BuyIS71` through `BuyIS74` hooks, and the same numbers are directly recovered as `SaveData` fields.
- This is still not final row-label recovery. The repo-local evidence does not yet recover player-facing labels for rows `71-74`, and it does not yet ground a broader ordered remap outside `71-74`.

## Checked row `71-74` player-facing identity boundary

- The row-order mapping above is settled and separate from player-facing identity.
- Repo-local evidence now checks one narrow negative identity boundary for those same rows:
  - `IS71ID` through `IS74ID`, `BuyIS71` through `BuyIS74`, and `SetIS71CostText` through `SetIS74CostText` confirm ordered row access plus same-number serialized-id field recovery, not final player-facing labels
  - the visible prefab-number shell `ChrystosEmporiumUpgrade71-ID59` through `ChrystosEmporiumUpgrade74-ID62` is explicitly remapped to serialized ids `59-62`, so it cannot identify validated rows `71-74`
  - the nearest checked player-facing inscription labels currently preserved in repo-local probes are `Inscryption 78: Ouroboros Orbs` and `Inscryption 83: Fast-Loop ML`, both outside the `71-74` target rows
- Current grounded conclusion:
  - no stable player-facing identity is currently grounded for rows `71-74`
  - ordered row mapping and player-facing identity must remain separated
  - the canonical import-safe subset therefore stays empty

## Checked row `71-74` remap-band boundary

- The smallest defensible remap explanation is now checked directly inside the same band:
  - ordered rows remain `71-74` through `IS71Level` to `IS74Level`
  - serialized-id fields also stay same-number as `IS71ID` to `IS74ID`
  - prefab numbering breaks that same-number chain as `ChrystosEmporiumUpgrade71-ID59` through `ChrystosEmporiumUpgrade74-ID62`
- Repo-local probes also preserve earlier direct prefab shells `ChrystosEmporiumUpgrade59`, `ChrystosEmporiumUpgrade60`, `ChrystosEmporiumUpgrade61`, and `ChrystosEmporiumUpgrade62`.
- The narrow recovered relationship is therefore:
  - ordered row number and serialized-id field number stay aligned for `71-74`
  - prefab numbers `71-74` are reused as shells for serialized ids `59-62`
  - player-facing identity still stays unresolved because no checked string anchor names rows `71-74`

Current grounded conclusion:

- this remap-band explanation clarifies why the nearby same-number binding pattern breaks inside rows `71-74`
- it still does not ground player-facing identity for rows `71-74`
- the canonical import-safe subset stays empty

## Nearby checked inscription identity-binding pattern

- The nearest checked positive binding pattern now sits just outside the unresolved `71-74` band:
  - row `78`: `IS78Level`, `IS78ID`, `BuyIS78`, `ChrystosEmporiumUpgrade78-ID78`, `Inscryption 78: Ouroboros Orbs`
  - row `83`: `IS83Level`, `IS83ID`, `BuyIS83`, `ChrystosEmporiumUpgrade83-ID83`, `Inscryption 83: Fast-Loop ML`
- The smallest defensible pattern is a same-number nearby join recovered in the `TextHandlerMarkets` neighborhood:
  - `ISNLevel`
  - `ISNID`
  - `BuyISN`
  - `ChrystosEmporiumUpgradeN-IDN`
  - `Inscryption N: ...`
- This must stay distinct from ordered row mapping alone. Rows `71-74` still fail the direct prefab join because the visible shell is remapped as `ChrystosEmporiumUpgrade71-ID59` through `ChrystosEmporiumUpgrade74-ID62`, and no checked player-facing string currently names those rows.

Current grounded conclusion:

- nearby rows `78` and `83` now show how ordered inscription rows can bind to player-facing identity when the same-number chain is preserved
- this recovered pattern does not ground rows `71-74`
- the canonical import-safe subset stays empty

## Bounded SaveData import classification

- `safe_import_candidate`
  - none
- `wrapper_or_export_only`
  - `InscryptionsDone`
    - `PlayerProfileData` already exposes `InscryptionsDone` as a flat wrapper/export field, so importing it from the wider `SaveData` block would widen the owner surface without adding a new bounded canonical Emporium import
- `verified_but_blocked`
  - `IS71Level` through `IS74Level`
    - these now have a checked ordered row-position mapping to validated rows `71-74`, but final row labels and planner-safe canonical import mapping are still blocked in this slice
  - `IS25Level` through `IS70Level` and `IS75Level` through `IS110Level`
    - these are directly recovered on `SaveData`, but the wider `IS*Level` range still has no checked grounded row-position mapping for bounded canonical import
  - `EsotericR1Trades` through `EsotericR9Trades`
  - `NecrumR1Trades` through `NecrumR9Trades`
    - these counters are directly recovered in the same `SaveData` block, but the current slice does not ground them as canonical Emporium import targets
  - `Mech1Unlocked`, `Mech1Units`, `Mech1Upg1Level`, `Mech1Upg2Level`, `Mech1MissionsProgress`, `Mech1MissionsCompleted`, and `Mech2Unlocked`
    - these fields are directly recovered in the same `SaveData` block, but they belong to the adjacent mech progression cluster rather than the narrow Emporium import surface
- `unresolved`
  - none

Current grounded conclusion:

- no recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import
- `InscryptionsDone` stays wrapper/export-only because `PlayerProfileData` already exposes it as a flat wrapper surface
- `IS71Level` through `IS74Level` are the strongest blocked candidates because their ordered row positions now check out against validated Emporium rows `71-74`, but final row labels and broader row remap remain unresolved
- the broader `IS*Level`, trade-counter, and early `Mech*` neighbors remain verified on `SaveData` but blocked from canonical import because this slice does not reopen `Market` typed-field recovery, row remap, or planner integration

## Current app implication

- It is still not safe to add canonical `Inscryptions Done` or inscription-level fields to `state.playerProfile`.
- It is now safe to treat `InscryptionsDone` and nearby `IS*Level` strings as grounded metadata field clues for future save-side mapping work.
- It is now safe to treat `PlayerProfileHandler.get_Market -> MultiverseMarket` as a checked typed bridge, `PlayerProfileHandler.saveInfoCache` as a checked `PlayerProfileData` field, and the first nested `MultiverseMarket` payloads as row-local only.
- It is now safe to treat flat direct `PlayerProfileData` ownership of the wider `IS*Level` / trade-counter / mech run as ruled out in the checked field table, even though `PlayerProfileData` still exposes flat wrappers such as `InscryptionsDone`, `MechsOwned`, and `GadgetLevels`.
- It is now safe to treat `SaveData` as the exact declaring save owner for the wider `IS*Level` / trade-counter / mech progression cluster.
- It is now safe to treat the surrounding trade and mech fields as evidence that this lane lives in a broader saved progression block rather than in the separate reward/effect families.
- It is now safe to treat the save-side search as narrowed to `SaveData` behind the PlayerProfile persistence family and a checked `PlayerProfileHandler.get_Market -> MultiverseMarket` accessor bridge, while explicitly not claiming that a typed `Market` field has been recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`.
- It is now safe to treat validated Emporium rows `71-74` as the first row block that has both checked row recovery and checked ordered `IS*Level` overlap, while keeping final label remap and canonical import promotion downstream.
- The next spend-track slice should fork from this save-owner recovery and decide how much of the recovered `SaveData` declaration block can be used for bounded import support without reopening row remap or planner integration.


