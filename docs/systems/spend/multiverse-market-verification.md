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

## Narrow row 71-74 identity boundary

- The ordered mapping stays settled:
  - `IS71Level` -> row `71`
  - `IS72Level` -> row `72`
  - `IS73Level` -> row `73`
  - `IS74Level` -> row `74`
- The player-facing identity boundary for those same rows is still negative-only:
  - `IS71ID` through `IS74ID`, `BuyIS71` through `BuyIS74`, and `SetIS71CostText` through `SetIS74CostText` confirm ordered row access plus same-number serialized-id field recovery, not final labels
  - `ChrystosEmporiumUpgrade71-ID59` through `ChrystosEmporiumUpgrade74-ID62` explicitly point the visible prefab-number shell at serialized ids `59-62`, not at validated rows `71-74`
  - the nearest checked player-facing inscription labels remain `Inscryption 78: Ouroboros Orbs` and `Inscryption 83: Fast-Loop ML`, which are outside rows `71-74`

Current grounded conclusion:

- no stable player-facing identity is currently grounded for rows `71-74`
- rows `71-74` therefore remain ordered-only mappings, not import-safe player-facing labels
- the canonical import-safe subset stays empty

## Narrow row 71-74 remap-band boundary

- The smallest checked remap relationship is:
  - ordered rows: `IS71Level` through `IS74Level`
  - serialized-id fields: `IS71ID` through `IS74ID`
  - remapped prefab shells: `ChrystosEmporiumUpgrade71-ID59` through `ChrystosEmporiumUpgrade74-ID62`
- Repo-local probes also preserve earlier direct shells `ChrystosEmporiumUpgrade59`, `ChrystosEmporiumUpgrade60`, `ChrystosEmporiumUpgrade61`, and `ChrystosEmporiumUpgrade62`.
- This means prefab numbers `71-74` are reused as shells for serialized ids `59-62`, so the nearby same-number join fails before a player-facing label can bind.

Current grounded conclusion:

- this recovers the remap-band relationship but not player-facing identity
- rows `71-74` still stay unresolved for player-facing identity
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
- this wider numbering boundary still does not ground new player-facing identity for unresolved rows, including `71-74`
- the canonical import-safe subset stays empty

## Nearby checked identity-binding pattern

- The nearest checked positive identity-binding examples are rows `78` and `83`.
- Each row keeps the same number across the nearby checked chain:
  - `IS78Level`, `IS78ID`, `BuyIS78`, `ChrystosEmporiumUpgrade78-ID78`, `Inscryption 78: Ouroboros Orbs`
  - `IS83Level`, `IS83ID`, `BuyIS83`, `ChrystosEmporiumUpgrade83-ID83`, `Inscryption 83: Fast-Loop ML`
- Repo-local metadata and probe evidence place those anchors in the `TextHandlerMarkets` neighborhood, including the checked source-path string `9\Assets\Scripts\Text\Text Ouroboros\TextHandlerMarkets.cs`.

Current grounded conclusion:

- nearby player-facing identity can be grounded when the same row number survives across `ISNLevel`, `ISNID`, `BuyISN`, direct prefab name `ChrystosEmporiumUpgradeN-IDN`, and `Inscryption N: ...`
- this explains how nearby inscription rows bind to player-facing labels without widening beyond checked rows `78` and `83`
- this pattern still does not ground rows `71-74` because the prefab join is remapped there and no checked player-facing labels have been recovered for those rows
- the canonical import-safe subset therefore stays empty

## Still unresolved

- the saved-state field or owner that stores the current `Inscryptions Done` balance
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
  - the Emporium balance and owned-level fields appear to live in a broader progression-state field block rather than in the separate reward/effect symbol families
  - validated rows `71-74` now have both checked row recovery and checked ordered save-side `IS*Level` overlap, which is the strongest current repo-local foothold for future import mapping
  - that foothold is still row-order only, not final label recovery, so the canonical import-safe subset stays empty
  - effect/reward symbols should not be treated as recovered saved-balance fields

## Current app implication

- It is safe to treat `MultiverseMarket` as a real Emporium owner with a grounded `Inscryptions Done` cost-lane shell.
- It is safe to treat the `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62` override band as a real prefab-remap boundary that blocks naive label assumptions for validated ids `69-74`.
- It is not safe to generate spend recommendations yet.
- The spend-planner track should stop inferring this lane from diamonds or tokens.
- `MultiverseMarket` remains `available but unmapped` until the owned-state and saved-balance inputs are recovered.

## Next allowed slice

1. determine which save model actually declares `InscryptionsDone` and the nearby `IS*Level` fields
2. recover player-owned inscription levels or equivalent next-purchase state from that same save-side neighborhood
3. extend parsing past the current validated late block
4. finish the inscription-number and prefab-to-label remap, especially across the `69-74` prefab override band
5. only then add spend-planner recommendations


