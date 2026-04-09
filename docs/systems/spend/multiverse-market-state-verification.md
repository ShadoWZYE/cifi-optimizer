# Multiverse Market State Verification

This document records what the repo can currently say about the saved-state side of the `MultiverseMarket` track.

It now includes exact metadata field strings that sit around the Emporium state lane, exact typed bridge recovery for the direct `get_Market` accessor, and an exact negative result for typed `Market` field recovery on the checked PlayerProfile-side owners. Save-owner recovery is now grounded enough to archive that broader lane; the active follow-up is the narrower `SaveData` import-surface decision that keeps the checked accessor bridge, the metadata-only `Market` shell, and the wider save-owner recovery separated so the repo does not silently promote canonical Emporium imports without evidence. Until stronger evidence appears, `Market` remains accessor/member-shell naming only.

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
- exact typed save-to-profile conversion recovery:
  - `PlayerProfileHandler.ConvertSaveDataToProfileData(SaveData saveData, System.DateTime lastCloudSaveDate) -> PlayerProfileData`
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
- exact typed recovery now also confirms that `PlayerProfileHandler.ConvertSaveDataToProfileData(SaveData saveData, System.DateTime lastCloudSaveDate) -> PlayerProfileData`, which gives the checked `SaveData` owner a direct typed conversion bridge back into the flatter `PlayerProfileData` export/wrapper surface without promoting a typed `Market` field
- exact typed recovery separately confirms that `PlayerProfileData` directly declares `InscryptionsDone`, `MechsOwned`, and `GadgetLevels` as string fields, while the same probe does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileData`
- exact typed recovery also now fixes the dual declaration on concrete types: `PlayerProfileData.InscryptionsDone` is recovered as `System.String` while `SaveData.InscryptionsDone` is recovered as `System.Int32`, which further narrows the `PlayerProfileData` copy to a flat wrapper/export surface rather than a deeper typed Market-owned progression host
- exact typed recovery now also confirms that the checked `PlayerProfileData` field table has `89` direct fields and `1` method, and none of those direct fields are named `IS71Level`, `IS110Level`, `EsotericR1Trades`, `NecrumR1Trades`, `Mech1Unlocked`, or `Mech1MissionsCompleted`
- the same exact typed `PlayerProfileData` probe only recovers `PlayerProfileData+GemData` as a nested typed child in the checked field table, so the wider Emporium progression run is not recovered as a direct typed `PlayerProfileData` child beside the flat `InscryptionsDone`, `MechsOwned`, and `GadgetLevels` wrappers
- exact typed recovery now also confirms that `SaveData` declares `4461` fields and `1` method, and that same save table directly carries `IS1Level` through `IS110Level`, `InscryptionsDone`, `EsotericR*Trades`, `NecrumR*Trades`, and early `Mech1*` progression fields such as `Mech1Unlocked` and `Mech1MissionsCompleted`
- that makes `SaveData` the exact declaring save owner for the checked `IS*Level` / trade-counter / early `Mech*` portion of the wider Emporium progression run, while `InscryptionsDone` is exactly declared on both `SaveData` and `PlayerProfileData` and `PlayerProfileData` remains a flatter export-wrapper surface for nearby summary fields
- exact typed recovery also confirms that the first nested `MultiverseMarket` payloads are `MultiverseMarket|Inscryption` and `MultiverseMarket|InscryptionTupleObject`, and those payloads are row-local carriers rather than the broader progression block
- the same bridge still preserves sibling market-side accessors `get_BM`, `get_ZN`, and `get_TU`, which keeps `Market` broader than one Emporium-only field family even though the direct member handoff is now narrower than the older generic wrapper guess
- the recovered wider progression field run still sits in a broader cluster that spans `IS*Level`, Inscryptions, Necrum trade counters, and early mech progression, and the current checked typed recovery does not place that wider run directly on `MultiverseMarket` or on the first recovered nested market payloads
- the checked boundary therefore separates three things explicitly: `PlayerProfileHandler.get_Market -> MultiverseMarket` is the checked accessor bridge, `Market` is still only a metadata/member-shell clue, and no typed `Market`-named field is recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
- `SaveData` remains the exact declaring owner for the checked `IS*Level` / trade-counter / mech run, and the exact `InscryptionsDone` type split now closes that declaring-owner question for the checked cluster without converting the metadata-only `Market` shell into a checked typed field
- this is useful because it closes the checked save-owner question for the broader run without pretending the Emporium state is already import-ready or that `Market` has been recovered as a typed declaring field; the remaining unresolved seam is only typed Market-wrapper recovery beyond the checked bridge

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
- exact typed recovery now also shows that `InscryptionsDone` is directly declared on `PlayerProfileData`, while `SaveData` is the exact declaring owner for the checked `IS*Level` / trade-counter / early `Mech*` fields and the typed `Market`-named save-path owner still remains unresolved

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
  - `FinalMech1MainBonus`
  - `Mech1MissionsCompleted`
  - `Mech2Unlocked`

Current grounded conclusion:

- `InscryptionsDone` sits inside a broader player-progression field cluster rather than beside the separate `AchievementInscryptionsReward` or `FinalIS*` reward/effect symbols
- this is stronger evidence that the Emporium lane belongs to a saved progression model or sub-structure, not to a UI-only text path
- the recovered `IS*Level` run now directly overlaps the validated Emporium row block at ids `71-74`, which creates a grounded ordered-overlap bridge between save-side level clues and checked market rows
- exact typed recovery now rules out the direct checked `MultiverseMarket` owner, its first recovered nested row-local payloads, and flat direct `PlayerProfileData` fields for that wider run, and now also identifies `SaveData` as the declaring save structure that carries that broader progression block
- `InscryptionsDone` is also the exact typed break between the `IS1Level` through `IS110Level` span and the adjacent trade-counter and early-mech windows, so those post-`InscryptionsDone` fields should stay as separate bounded quarantine ranges even when they share the same compatibility envelope

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

- the authoritative saved-state field range or list for owned inscription levels that is safe to treat as canonical Emporium import truth
- whether the metadata-only `Market` shell corresponds to a real typed wrapper field anywhere on the checked save path, or only to accessor/property naming around the checked bridge
- whether downstream import work should ever read the wider `SaveData` declaration block directly, or continue using narrower wrapper-specific or compatibility-only surfaces for MVP safety

## Checked `IS*Level` to inscription-row boundary

- The wider inscription set now has three checked repo-local order clues that can be held together without over-claiming:
  - the broader action shell preserves `BuyIS1` through `BuyIS110` and `SetIS1CostText` through `SetIS110CostText`
  - the validated serialized late block currently covers rows `50-59` and `63-74`
  - the exact typed `SaveData` field run spans `IS1Level` through `IS110Level`, with no checked typed `IS0Level` below it and no checked typed `IS111Level` above it
- Inside that wider ordered set, the smallest checked row-position overlap is now:
  - `IS71Level` -> ordered row `71`
  - `IS72Level` -> ordered row `72`
  - `IS73Level` -> ordered row `73`
  - `IS74Level` -> ordered row `74`
- This is grounded because each of those rows is present in the validated row dataset, each has checked `SetIS71CostText` through `SetIS74CostText` and `BuyIS71` through `BuyIS74` hooks, and the same numbers are directly recovered as `SaveData` fields.
- This is still not final row-label recovery. The repo-local evidence does not yet recover player-facing labels for rows `71-74`, and it does not yet ground a broader ordered remap outside `71-74`.

## Checked row `69-74` player-facing identity-source boundary

- The numbering boundary is settled and separate from player-facing identity source:
  - `IS69Level` through `IS74Level`
  - `IS69ID` through `IS74ID`
  - `BuyIS69` through `BuyIS74`
  - prefab-number shells `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62`
- Repo-local evidence now checks the non-prefab identity-source candidates inside that same broken band:
  - `TextHandlerMarkets` cost-text coverage preserves `SetIS69CostText` through `SetIS74CostText`
  - the adjacent action shell preserves `BuyIS69` through `BuyIS74`
  - the checked `MultiverseMarket` field table preserves `THMarkets: TextHandlerMarkets` beside `InscryptionsList: List<GameObject>`
  - the checked repo-local probe artifacts do not recover direct player-facing strings `Inscryption 69` through `Inscryption 74`
  - following the prefab remap back to serialized ids `57-62` is still negative-only: earlier direct shells `ChrystosEmporiumUpgrade57` through `ChrystosEmporiumUpgrade62` are preserved, but the checked repo-local probe artifacts still do not recover direct player-facing strings `Inscryption 57` through `Inscryption 62`
  - the raw `tmp-multiverse-row-text-probe.json` continuation is now checked directly: `SetIS69BaseBonusText` stays in a bonus-presentation family, while `ClearISObjects`, `ClearISMaxLevelObjects`, `SetISMaxLevelObjects`, `THMarkets`, and `InscryptionsList` stay structural UI-shell hooks rather than a recovered row-title source
  - the supplied live UI screenshots directly show `INSCRYPTION #69` through `INSCRYPTION #74` in order between visible neighbors `INSCRYPTION #68` and `INSCRYPTION #75`, with row-local bonus texts `CELLS GAINED`, `SCIENTISTS COST REDUCTION`, `KDIOS RESEARCH EQUIPMENT BONUS`, `TICKS PER TICK-LOOP REDUCTION`, `LEVEL POINTS (LP) GAINED`, and `LOOP REQUIREMENT REDUCTION`
- Current grounded conclusion:
  - no stable repo-local player-facing identity source is currently recoverable for rows `69-74`
  - the supplied live UI screenshots do recover the player-facing identities of rows `69-74` directly
  - following the broken band back to remapped serialized ids `57-62` still does not recover a narrower player-facing label source and therefore stays bounded as shell metadata only
  - the raw `TextHandlerMarkets` base-bonus and `ISObject` shell continuation remains a checked negative boundary for repo-local row-label recovery
  - save numbering, serialized-id numbering, prefab numbering, and player-facing identity source must remain separated
  - repo-local identity recovery on rows `69-74` is closed unless a different repo-local source class appears
  - the canonical import-safe subset therefore stays empty

## Checked `69-74` anomaly provenance boundary

- The earliest checked anomaly appearance is upstream of the repo-local derived boundary datasets:
  - preserved app-side asset evidence already contains direct earlier shells `ChrystosEmporiumUpgrade59` through `ChrystosEmporiumUpgrade62`
  - preserved app-side asset and probe evidence also already contain remapped shells `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62`
  - the same raw probe layer still preserves same-number `IS69Level` through `IS74Level`, `IS69ID` through `IS74ID`, and `BuyIS69` through `BuyIS74`
- This means the checked repo pipeline first records the anomaly as raw app-side truth and only then summarizes it in repo-local derived datasets.

Current grounded conclusion:

- the `69-74` anomaly is app-side inherited rather than repo-local
- no repo-local normalization step is currently proven to introduce it
- live UI evidence now grounds rows `69-74` as player-facing rows `69-74`, but that does not rewrite the inherited prefab anomaly
- no dataset standardization is applied in this lane because preserving inherited source truth is safer than rewriting the prefab layer into a newer canonical shape the app-side evidence does not support

## Alternate serialized-export indirect-join boundary

- This check is a separate repo-local evidence class from the exhausted Market/TextHandler/probe path:
  - the checked UABEA field table preserves `InscryptionCostList`, `InscryptionAndCostRelations`, `IDChecks`, `inscryptions`, and `InscryptionTupleList` on `MultiverseMarket`
  - the same checked export preserves nested row payload types `MultiverseMarket|Inscryption` and `MultiverseMarket|InscryptionTupleObject`
- Those nested row payloads stay structural only:
  - `MultiverseMarket|Inscryption` preserves `ID`, `Cost`, `Level`, `MaxLevel`, `ISObject`, and `transform`
  - `MultiverseMarket|InscryptionTupleObject` preserves `ID`, `Cost`, `Level`, `MaxLevel`, and `ISObject`
- The checked serialized export still does not recover player-facing label-bearing fields such as:
  - `Name`
  - `Label`
  - `Title`
  - `Description`
  - `Text`
  - `LocalizationKey`
  - `StringId`
- The separate checked UI-shell clues still stop at:
  - `THMarkets: TextHandlerMarkets`
  - `InscryptionsList: List<GameObject>`
  - `SetAllChrystosEmporiumTexts`
- No checked adjacent repo-local consumer, controller, or view symbol references `InscryptionCostList`, `InscryptionAndCostRelations`, `IDChecks`, `inscryptions`, or `InscryptionTupleList` outside the alternate UABEA field-table export.

Current grounded conclusion:

- the alternate serialized export is a real new repo-local evidence class for the Emporium row lane
- it strengthens structural container recovery only, not player-facing label recovery
- no indirect catalog/relation join is recoverable repo-locally between the settled ordered rows or serialized ids and any separate identity-bearing catalog
- it does not help rows `69-74` join back to the settled ordered mapping as final player-facing identities
- the canonical import-safe subset stays empty

## Checked row `71-74` remap-band boundary

- The smallest defensible remap explanation is now checked directly inside the same band:
  - ordered rows remain `71-74` through `IS71Level` to `IS74Level`
  - serialized-id fields also stay same-number as `IS71ID` to `IS74ID`
  - prefab numbering breaks that same-number chain as `ChrystosEmporiumUpgrade71-ID59` through `ChrystosEmporiumUpgrade74-ID62`
- Repo-local probes also preserve earlier direct prefab shells `ChrystosEmporiumUpgrade59`, `ChrystosEmporiumUpgrade60`, `ChrystosEmporiumUpgrade61`, and `ChrystosEmporiumUpgrade62`.
- The narrow recovered relationship is therefore:
  - ordered row number and serialized-id field number stay aligned for `71-74`
  - prefab numbers `71-74` are reused as shells for serialized ids `59-62`
  - the supplied live UI screenshots show that player-facing identity still stays on rows `71-74`, so the `59-62` relation is shell metadata only

Current grounded conclusion:

- this remap-band explanation clarifies why the nearby same-number prefab-binding pattern breaks inside rows `71-74`
- live UI evidence still grounds player-facing identity for rows `71-74` directly as rows `71-74`
- the canonical import-safe subset stays empty

## Checked wider inscription numbering-stability boundary

- Across the checked larger `IS69-110` run, repo-local probes preserve the same number on:
  - `ISNLevel`
  - `ISNID`
  - `BuyISN`
- The earliest checked same-number failure is the prefab layer at row `69`, and the broken band is explicit:
  - `ChrystosEmporiumUpgrade69-ID57`
  - `ChrystosEmporiumUpgrade70-ID58`
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
- The same-number prefab chain resumes at row `75` and stays direct through the checked remainder:
  - `ChrystosEmporiumUpgrade75-ID75`
  - `ChrystosEmporiumUpgrade78-ID78`
  - `ChrystosEmporiumUpgrade83-ID83`
  - `ChrystosEmporiumUpgrade110-ID110`
- Direct player-facing string anchors inside that resumed stable range are still only:
  - `Inscryption 78: Ouroboros Orbs`
  - `Inscryption 83: Fast-Loop ML`

Current grounded conclusion:

- same-number prefab numbering is stable through row `68`
- same-number prefab numbering is broken from rows `69-74`
- same-number prefab numbering resumes at row `75` and stays direct through row `110`
- this wider numbering boundary still does not provide a repo-local row-label source for rows `69-74`, even though live UI evidence now grounds those rows directly
- the canonical import-safe subset stays empty

## Nearby checked inscription identity-binding pattern

- The nearest checked positive binding pattern now sits just outside the unresolved `69-74` band:
  - row `78`: `IS78Level`, `IS78ID`, `BuyIS78`, `ChrystosEmporiumUpgrade78-ID78`, `Inscryption 78: Ouroboros Orbs`
  - row `83`: `IS83Level`, `IS83ID`, `BuyIS83`, `ChrystosEmporiumUpgrade83-ID83`, `Inscryption 83: Fast-Loop ML`
- The smallest defensible pattern is a same-number nearby join recovered in the `TextHandlerMarkets` neighborhood:
  - `ISNLevel`
  - `ISNID`
  - `BuyISN`
  - `ChrystosEmporiumUpgradeN-IDN`
  - `Inscryption N: ...`
- This must stay distinct from ordered row mapping alone. Rows `69-74` still fail the direct prefab join because the visible shell is remapped as `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62`, and no checked repo-local player-facing string currently names those rows.

Current grounded conclusion:

- nearby rows `78` and `83` now show how ordered inscription rows can bind to player-facing identity when the same-number chain is preserved
- this recovered pattern does not ground rows `69-74` by itself; those rows now rely on live UI evidence instead
- the canonical import-safe subset stays empty

## Bounded SaveData import classification

- `safe_import_candidate`
  - `IS1Level` through `IS110Level`
    - this exact SaveData-owned `IS*Level` span is now safe to preserve as compatibility-only raw Emporium import truth under `compatibility.unmappedSystemState.multiverseMarket`
    - the checked rows `71-74` overlap anchors that wider run to validated Emporium rows without claiming final player-facing row identity
  - `EsotericR1Trades` through `EsotericR9Trades`
  - `NecrumR1Trades` through `NecrumR9Trades`
    - these exact typed trade-counter ranges sit immediately after the dual-declared `InscryptionsDone` boundary on `SaveData`, so they belong in the same compatibility envelope but as separate bounded quarantine ranges rather than as an extension of the `IS*Level` span
  - `Mech1Unlocked` through `Mech2Unlocked`
    - this exact typed early-mech window continues immediately after `NecrumR9Trades` and stays bounded before the broader `Mech2*` continuation, so it is safe to preserve as a separate quarantined range under the same compatibility envelope
- `wrapper_or_export_only`
  - `InscryptionsDone`
    - `PlayerProfileData` already exposes `InscryptionsDone` as a flat wrapper/export field, so importing it from the wider `SaveData` block would widen the owner surface without adding a new bounded canonical Emporium import
- `verified_but_blocked`
  - `IS71Level` through `IS74Level`
    - these now have a checked ordered row-position mapping to validated rows `71-74`, but final row labels and planner-safe canonical import mapping are still blocked in this slice
- `unresolved`
  - none

Current grounded conclusion:

- the exact SaveData-owned `IS*Level` span that is now safe to treat as raw Emporium import truth is `IS1Level` through `IS110Level`
- that import-safe span is compatibility-only and should stay under `compatibility.unmappedSystemState.multiverseMarket`
- the compatibility-safe import envelope is now split into separate exact typed quarantine ranges rather than one uninterrupted span past `InscryptionsDone`
- no recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import
- `InscryptionsDone` stays wrapper/export-only because `PlayerProfileData` already exposes it as a flat wrapper surface
- `IS71Level` through `IS74Level` remain the strongest ordered-overlap evidence for identity work, but they are still blocked from canonical import because final row labels and broader row remap remain unresolved
- the broader `IS*Level`, trade-counter, and early `Mech*` neighbors remain verified on `SaveData` but blocked from canonical import because this slice does not reopen `Market` typed-field recovery, row remap, or planner integration

## Current app implication

- It is still not safe to add canonical `Inscryptions Done` or inscription-level fields to `state.playerProfile`.
- It is now safe to treat `InscryptionsDone` and nearby `IS*Level` strings as grounded metadata field clues for future save-side mapping work.
- It is now safe to treat `PlayerProfileHandler.get_Market -> MultiverseMarket` as a checked typed bridge, `PlayerProfileHandler.saveInfoCache` as a checked `PlayerProfileData` field, and the first nested `MultiverseMarket` payloads as row-local only.
- It is now safe to treat `PlayerProfileHandler.ConvertSaveDataToProfileData(SaveData, System.DateTime) -> PlayerProfileData` as a checked typed conversion bridge from the recovered `SaveData` owner back into the flatter profile-side wrapper surface.
- It is now safe to treat flat direct `PlayerProfileData` ownership of the wider `IS*Level` / trade-counter / mech run as ruled out in the checked field table, even though `PlayerProfileData` still exposes flat wrappers such as `InscryptionsDone`, `MechsOwned`, and `GadgetLevels`.
- It is now safe to treat the exact `InscryptionsDone` type split itself as grounding: `PlayerProfileData.InscryptionsDone` is a typed string wrapper/export copy while `SaveData.InscryptionsDone` is a typed integer declaration inside the broader recovered progression cluster.
- It is now safe to treat `SaveData` as the exact declaring save owner for the checked `IS*Level` / trade-counter / mech progression cluster while keeping `InscryptionsDone` split out as an exact dual declaration on `SaveData` and `PlayerProfileData`.
- It is now safe to preserve the exact SaveData-owned `IS1Level` through `IS110Level` run as compatibility-only raw Emporium import truth under `compatibility.unmappedSystemState.multiverseMarket`.
- It is now safe to treat the surrounding trade and mech fields as evidence that this lane lives in a broader saved progression block rather than in the separate reward/effect families.
- It is now safe to treat the save-side search as narrowed to `SaveData` behind the PlayerProfile persistence family and a checked `PlayerProfileHandler.get_Market -> MultiverseMarket` accessor bridge, while explicitly not claiming that a typed `Market` field has been recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData` and while treating any remaining uncertainty as a Market-wrapper question rather than a generic declaring-owner search.
- It is now safe to treat validated Emporium rows `71-74` as the first row block that has both checked row recovery and checked ordered `IS*Level` overlap, while keeping final label remap and canonical import promotion downstream.
- The active import-surface result is now a split: `IS1Level` through `IS110Level` is compatibility-safe raw import truth, while no canonical Emporium subset is admissible yet and rows `71-74` remain ordered overlap only.
- The next spend-track slice should keep row remap separate and only revisit admissibility if stronger identity evidence appears.


