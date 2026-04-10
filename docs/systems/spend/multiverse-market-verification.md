# Multiverse Market Verification Gate

This document records what is currently grounded about the `MultiverseMarket` spend-planner track and what still blocks app integration.

It exists because the repo had already proven the `MultiverseMarket` owner and late-block constants, but the spend lane and label state were still treated too loosely in the spend-planner docs.

## Verified now

- In-game system family:
  - Chrystos Emporium / Inscryptions
- Unity owner:
  - `MultiverseMarket`
- Repo-local owner evidence:
  - [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
  - [`data/multiverse-market-values.json`](data/multiverse-market-values.json)
  - [`data/lm244-targeted-probe.json`](data/lm244-targeted-probe.json)
  - [`docs/systems/spend/multiverse-market-state-verification.md`](docs/multiverse-market-state-verification.md)
  - [`docs/unity/unity-audit-playbook.md`](docs/unity-audit-playbook.md)

## Spend-lane shell recovered from this pass

- The validated `MultiverseMarket` late block stores a concrete `CurrencyBox` pointer beside each recovered inscription row.
- Existing targeted string probes recover Emporium-side UI shell names:
  - `CostBox-InscryptionsDone`
  - `AchievementBar-Inscryptions`
- Existing targeted string probes also recover direct purchase handlers adjacent to the owner name:
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS47`
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS64`
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS13`
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS73`
  - `MultiverseMarket, Assembly-CSharp` -> `BuyIS105`

Current grounded conclusion:

- the Emporium purchase flow is wired through a player-facing cost lane labeled around `Inscryptions Done`
- this is strong enough to stop treating the MultiverseMarket spend lane as completely unknown
- this is not yet strong enough to claim the saved runtime balance field or import-ready player-state shape

## Partial label anchors recovered from repo-local probes

These labels are useful grounding anchors, but they do not yet fully remap all serialized rows:

- `Inscryption 25: Shard Gains`
- `Inscryption 46: Shards Gained`
- `Inscryption 78: Ouroboros Orbs`
- `Inscryption 83: Fast-Loop ML`
- `ChrystosEmporiumUpgrade51`
- `ChrystosEmporiumUpgrade64`
- `ChrystosEmporiumUpgrade73`

Current grounded conclusion:

- the system exposes real inscription-number labels and prefab identities in the shipped assets
- the late serialized block is still not stored in plain inscription-ID order
- the checked prefab shell now stays direct through `ChrystosEmporiumUpgrade68` but switches to explicit overrides `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62`
- label remap remains partial until the row-order and ID mapping are closed more completely

## Narrow row 69-74 text-provenance boundary

- The row numbering stays settled:
  - `IS69Level` -> row `69`
  - `IS70Level` -> row `70`
  - `IS71Level` -> row `71`
  - `IS72Level` -> row `72`
  - `IS73Level` -> row `73`
  - `IS74Level` -> row `74`
- The checked repo-local non-prefab identity-source candidates for those same rows are still negative-only:
  - `IS69ID` through `IS74ID`, `BuyIS69` through `BuyIS74`, and `SetIS69CostText` through `SetIS74CostText` confirm ordered row access plus same-number serialized-id field recovery, not final labels
  - `THMarkets: TextHandlerMarkets` and `InscryptionsList: List<GameObject>` recover a nearby UI population shell, not a checked row-to-label join
  - `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62` explicitly point the visible prefab-number shell at serialized ids `57-62`, not at validated rows `69-74`
  - the checked repo-local probe artifacts do not recover direct player-facing strings `Inscryption 69` through `Inscryption 74`
  - following that prefab remap back to earlier direct shells `ChrystosEmporiumUpgrade57` through `ChrystosEmporiumUpgrade62` is also still negative-only because the checked repo-local probe artifacts do not recover direct player-facing strings `Inscryption 57` through `Inscryption 62`
  - the raw `tmp-multiverse-row-text-probe.json` continuation is now checked directly: `SetIS69BaseBonusText` stays inside a bonus-presentation family, while `ClearISObjects`, `ClearISMaxLevelObjects`, `SetISMaxLevelObjects`, `THMarkets`, and `InscryptionsList` stay structural UI-shell hooks rather than a row-label source
  - the supplied live UI screenshots directly show `INSCRYPTION #69` through `INSCRYPTION #74` in order, between visible neighbors `INSCRYPTION #68` and `INSCRYPTION #75`

Current grounded conclusion:

- row identity for rows `69-74` is already carried by the same-number chain `SaveData.ISNLevel -> ISNID -> BuyISN/SetISNCostText -> row payload ID/Level/ISObject`
- the supplied live UI screenshots validate those player-facing rows directly
- following the broken band back to remapped serialized ids `57-62` does not recover a narrower player-facing text source either and therefore stays bounded as internal shell metadata only
- the raw `TextHandlerMarkets` base-bonus and `ISObject` shell continuation is now exhausted as a checked negative boundary for repo-local effect or label text recovery
- the remaining unresolved lane is the actual game-side player-facing effect or label text source for Emporium rows
- the canonical import-safe subset stays empty

## Checked 69-74 anomaly provenance boundary

- Raw app-side evidence preserved repo-locally already carries the anomaly before the boundary datasets summarize it:
  - the preserved `level0` asset includes direct-shell names `ChrystosEmporiumUpgrade59` through `ChrystosEmporiumUpgrade62`
  - that same preserved app-side evidence also includes remapped shells `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62`
  - raw probe reports also preserve same-number `IS69Level` through `IS74Level`, `IS69ID` through `IS74ID`, and `BuyIS69` through `BuyIS74`
- The repo-local derived datasets therefore inherit an already-split source shape:
  - same-number alignment holds on save/id/hook side
  - prefab numbering is broken only in the `69-74` band
  - the repo-local player-facing label source is still unresolved even though live UI now grounds the visible row identities

Current grounded conclusion:

- the earliest checked appearance of the `69-74` anomaly is raw app-side evidence, not a repo-local recovery or normalization step
- the anomaly must remain represented as inherited source truth
- live UI evidence now grounds player-facing rows `69-74` directly, but that does not rewrite the inherited prefab anomaly
- no dataset standardization is applied in this lane because rewriting the derived datasets to a newer same-number prefab shape would erase checked app-side evidence

## Shell-to-SaveData row-prediction boundary

- The strongest recoverable row-link structure now runs:
  - `PlayerProfileHandler.get_Market -> MultiverseMarket`
  - `SaveData.ISNLevel`
  - `ISNID`
  - `BuyISN`
  - `SetISNCostText`
  - `MultiverseMarket|Inscryption` and `MultiverseMarket|InscryptionTupleObject`
  - `ID`, `Level`, and `ISObject`
- For rows `69-74`, that ordered same-number chain predicts the displayed row number and the validated row payload predicts the live bonus magnitude.
- The shell layer does not:
  - `ChrystosEmporiumUpgrade69-ID57`
  - `ChrystosEmporiumUpgrade70-ID58`
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
- The bonus-value mismatch is explicit where earlier ids are validated:
  - id `57` carries `0.05`, not row `69`'s `5qa`
  - id `58` carries `5`, not row `70`'s `10b`
  - id `59` carries `5`, not row `71`'s `0.02`
- Control row `78` shows the same-number non-divergent case:
  - `IS78Level`, `IS78ID`, `BuyIS78`, `ChrystosEmporiumUpgrade78-ID78`, `Inscryption 78: Ouroboros Orbs`

Current grounded conclusion:

- the actual structure linking displayed inscription rows through to `SaveData` is the ordered same-number owner and row-carrier path, not the prefab shell suffix
- the `57-62` relation is meaningful only as shell-local anomaly metadata
- row payload carriers recover live bonus magnitudes for rows `69-74`, but not their player-facing bonus-text phrases
- compatibility-only import and planner blocks remain unchanged

## Alternate serialized-export indirect-join boundary

- This check is distinct from the settled Market/TextHandler/probe path.
- The checked UABEA field-table export does recover additional `MultiverseMarket` structural containers:
  - `InscryptionCostList`
  - `InscryptionAndCostRelations`
  - `IDChecks`
  - `inscryptions`
  - `InscryptionTupleList`
- The same export also recovers the checked nested row payloads:
  - `MultiverseMarket|Inscryption`
  - `MultiverseMarket|InscryptionTupleObject`
- Those nested payloads only preserve row-local carriers:
  - `ID`
  - `Cost`
  - `Level`
  - `MaxLevel`
  - `ISObject`
  - `transform` on `MultiverseMarket|Inscryption`
- The checked serialized export does not recover any player-facing label-bearing field such as `Name`, `Label`, `Title`, `Description`, `Text`, `LocalizationKey`, or `StringId`.
- The checked repo-local UI-shell clues remain separate:
  - `THMarkets: TextHandlerMarkets`
  - `InscryptionsList: List<GameObject>`
  - `SetAllChrystosEmporiumTexts`
- No checked adjacent repo-local consumer, controller, or view symbol references `InscryptionCostList`, `InscryptionAndCostRelations`, `IDChecks`, `inscryptions`, or `InscryptionTupleList` outside the alternate UABEA field-table export.

Current grounded conclusion:

- this new evidence class is real, repo-local, and separate from the exhausted Market/TextHandler/probe path
- it strengthens structural row-container recovery only
- no indirect catalog/relation join is recoverable repo-locally between the settled ordered rows or serialized ids and any separate identity-bearing catalog
- it does not help unresolved rows `69-74` join back to the settled ordered mapping as player-facing identities
- the canonical import-safe subset stays empty

## Narrow row 71-74 remap-band boundary

- The smallest checked remap relationship is:
  - ordered rows: `IS71Level` through `IS74Level`
  - serialized-id fields: `IS71ID` through `IS74ID`
  - remapped prefab shells: `ChrystosEmporiumUpgrade71-ID59` through `ChrystosEmporiumUpgrade74-ID62`
- Repo-local probes also preserve earlier direct shells `ChrystosEmporiumUpgrade59`, `ChrystosEmporiumUpgrade60`, `ChrystosEmporiumUpgrade61`, and `ChrystosEmporiumUpgrade62`.
- This means prefab numbers `71-74` are reused as shells for serialized ids `59-62`, but the supplied live UI screenshots still show player-facing rows `71-74` directly.

Current grounded conclusion:

- this recovers the remap-band relationship while bounding `59-62` as internal shell metadata only
- rows `71-74` stay player-facing rows `71-74` in live UI
- the canonical import-safe subset stays empty

## Wider checked inscription numbering-stability boundary

- Across the checked larger `IS69-110` run, repo-local probes preserve the same number on:
  - `ISNLevel`
  - `ISNID`
  - `BuyISN`
- The earliest checked same-number failure is the prefab layer at row `69`:
  - `ChrystosEmporiumUpgrade69-ID57`
  - `ChrystosEmporiumUpgrade70-ID58`
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
- The same-number prefab chain then resumes and stays direct through the checked remainder:
  - `ChrystosEmporiumUpgrade75-ID75`
  - `ChrystosEmporiumUpgrade78-ID78`
  - `ChrystosEmporiumUpgrade83-ID83`
  - `ChrystosEmporiumUpgrade110-ID110`
- Direct player-facing string anchors are still sparse:
  - `Inscryption 78: Ouroboros Orbs`
  - `Inscryption 83: Fast-Loop ML`

Current grounded conclusion:

- same-number prefab numbering is stable through row `68`
- same-number prefab numbering is broken from rows `69-74`
- same-number prefab numbering resumes at row `75` and stays direct through row `110`
- this wider numbering boundary still does not provide a repo-local player-facing effect or label text source for rows `69-74`, even though the same-number chain already grounds those rows structurally
- the canonical import-safe subset stays empty

## Nearby checked text-adjacent controls

- The nearest checked partial text-adjacent controls are rows `78` and `83`.
- Each row keeps the same number across the nearby checked chain:
  - `IS78Level`, `IS78ID`, `BuyIS78`, `ChrystosEmporiumUpgrade78-ID78`, sparse anchor `Inscryption 78: Ouroboros Orbs`
  - `IS83Level`, `IS83ID`, `BuyIS83`, `ChrystosEmporiumUpgrade83-ID83`, sparse anchor `Inscryption 83: Fast-Loop ML`
- Repo-local metadata and probe evidence place those anchors in the `TextHandlerMarkets` neighborhood, including the checked source-path string `9\Assets\Scripts\Text\Text Ouroboros\TextHandlerMarkets.cs`.
- The new row `78` screenshot mismatch means the sparse anchors cannot be treated as completed live effect-text bindings:
  - sparse anchor: `Inscryption 78: Ouroboros Orbs`
  - live screenshot text: `OUROBOROS POINTS GAINED`

Current grounded conclusion:

- nearby partial text-adjacent controls can be grounded when the same row number survives across `ISNLevel`, `ISNID`, `BuyISN`, direct prefab name `ChrystosEmporiumUpgradeN-IDN`, and a sparse `Inscryption N: ...` anchor
- this does not complete live effect-text binding for rows `78` or `83`
- this pattern does not recover the missing player-facing text provenance for rows `69-74`; those rows already keep their ordered identity through the same-number chain while the prefab join stays remapped and no checked repo-local player-facing strings have been recovered
- the canonical import-safe subset therefore stays empty

## Checked control-row text-provenance path boundary

- A narrow game-side text-adjacent path is now checked for control row `78`:
  - structural row chain: `IS78Level`, `IS78ID`, `BuyIS78`, `SetIS78CostText`
  - text-side shell: `THMarkets: TextHandlerMarkets`, `SetAllChrystosEmporiumTexts`
  - direct text-adjacent source: `Inscryption 78: Ouroboros Orbs`
- This does recover one real text-adjacent source, but only as a sparse Unity string anchor in the `TextHandlerMarkets` neighborhood.
- The new row `78` screenshot shows that the sparse anchor does not reproduce live effect text:
  - sparse anchor: `Inscryption 78: Ouroboros Orbs`
  - live screenshot text: `OUROBOROS POINTS GAINED`
- The broadest handler-side scaling clue now checked repo-locally is:
  - `SetAllBaseBonusTexts`
  - `SetIS1BaseBonusText`
  - `SetIS25BaseBonusText`
  - `SetIS50BaseBonusText`
  - `SetIS68BaseBonusText`
  - `SetIS69BaseBonusText`
- That still does not produce a reusable whole-table text join:
  - sparse direct anchors exist only for rows `25`, `46`, `78`, and `83`
  - no checked repo-local player-facing strings `Inscryption 69` through `Inscryption 74` are recovered
  - generic UI text-slot names `ActualBonusText`, `BonusText1`, and `TotalBonusText` are present repo-locally, but no checked join ties them specifically to `THMarkets` or ordered Emporium rows
  - no checked repo-local consumer binds `SetISNBaseBonusText` to direct strings, localization keys, or an Emporium-specific row-local text catalog

Current grounded conclusion:

- the structural row model stays unchanged
- rows `78` and `83` are only partial text-adjacent controls, not completed live effect-text bindings
- a control-row text-adjacent source is recoverable, but only as a sparse Unity string anchor
- the handler-side scaling clue is now tightened to the `SetAllBaseBonusTexts` / `SetISNBaseBonusText` family
- the exact remaining blocker is the unrecovered `TextHandlerMarkets` join that routes those methods into Emporium row-local text slots and then into final live player-facing effect text
- the canonical import-safe subset stays empty

## Still unresolved

- whether any typed `Market`-wrapper exists beyond the existing `PlayerProfileData` string wrapper for `InscryptionsDone` and the wider `SaveData` declaring owner
- player-owned current inscription levels or equivalent owned-state inputs for next-buy logic
- full row coverage outside the currently validated late block
- exact row-by-row remap from serialized `IS*` ids and prefab identities to final in-game labels

## Saved-state narrowing from this pass

- Repo-local metadata now narrows the persistence search toward `PlayerProfileData`, `FillPlayerProfileData`, and `GetPlayerProfileData`.
- Repo-local metadata now also exposes exact Emporium-adjacent field strings including `InscryptionsDone`, nearby `IS*Level` entries such as `IS50Level`, `IS64Level`, `IS73Level`, and nearby trade fields such as `EsotericR1Trades`.
- The broader field run around `InscryptionsDone` now includes `IS25Level` through `IS110Level`, `EsotericR1Trades` through `EsotericR9Trades`, `NecrumR1Trades` through `NecrumR9Trades`, and early `Mech*` fields such as `Mech1Unlocked` and `Mech1Upg1Level`.
- The checked range boundary now shows that the recovered save-side `IS*Level` run overlaps the validated Emporium row block at ids `71-74`, and the checked action-shell plus row-text coverage is now enough to ground the ordered row-position boundary `IS71Level -> row 71` through `IS74Level -> row 74`.
- Repo-local metadata also shows Inscryptions-adjacent reward/effect symbols such as `AchievementInscryptionsReward` and `<FinalISShardsBonus>k__BackingField`.
- Current grounded conclusion:
- `MultiverseMarket` remains the mechanic owner
- the likely saved-state search path now runs through the broader player-profile persistence family
- `InscryptionsDone` is an exact metadata field string, not just a UI label inferred from `CostBox-InscryptionsDone`
- exact typed recovery now also confirms that `SaveData` directly declares the checked `IS*Level` / trade-counter / early `Mech*` progression cluster, while `InscryptionsDone` is exactly declared on both `SaveData` and `PlayerProfileData` and `PlayerProfileData` stays a flatter wrapper/export surface for nearby fields such as `InscryptionsDone`
- the Emporium balance and owned-level fields appear to live in a broader progression-state field block rather than in the separate reward/effect symbol families
- validated rows `71-74` now have both checked row recovery and checked ordered save-side `IS*Level` overlap
- that overlap is still row-order only, not an import-admissible canonical subset or final label recovery, so the canonical import-safe subset stays empty
- effect/reward symbols should not be treated as recovered saved-balance fields

## Current app implication

- It is safe to treat `MultiverseMarket` as a real Emporium owner with a grounded `Inscryptions Done` cost-lane shell.
- It is safe to treat the `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62` override band as a real prefab-remap boundary whose `57-62` relation stays internal shell metadata rather than a player-facing remap for validated ids `69-74`.
- It is safe to treat `SaveData` as the exact declaring save owner for the checked `IS*Level` / trade-counter / early `Mech*` progression cluster, while keeping `InscryptionsDone` split out as an exact dual declaration on `SaveData` and `PlayerProfileData`.
- It is not safe to generate spend recommendations yet.
- The spend-planner track should stop inferring this lane from diamonds or tokens.
- `MultiverseMarket` remains `available but unmapped` until the owned-state and saved-balance inputs are recovered.

## Next allowed slice

1. keep the active lane on the bounded `SaveData` import-surface decision, preserve the exact typed `IS1Level` through `IS110Level` span as compatibility-only raw Emporium import truth, and leave the canonical Emporium import-safe subset explicitly empty unless stronger identity evidence appears
2. keep any player-owned inscription-level preview descriptive and quarantined unless a narrower grounded canonical import slice is checked
3. keep any future Emporium follow-up focused on the actual missing source class: game-side player-facing effect or label text provenance beyond the recovered same-number row chain
4. only then revisit whether any canonical Emporium import or spend-planner recommendation is justified


