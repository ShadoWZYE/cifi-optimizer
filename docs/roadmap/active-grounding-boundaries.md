# Active Grounding Boundaries

Use this page as the compact handoff surface for fresh grounding threads.

It is a short carry-forward layer over:

- `data/game-data.snapshot.v1.json`
- `docs/roadmap/research-tracks.md`
- the lane-specific verification notes linked below

It is not a replacement for canonical datasets, deep verification notes, or the full research-track queue.

## How to use it

- read this first for current lane boundaries
- use the lane contract first: user-facing question, minimum required inputs, explicit non-blockers, current true blocker, and largest coherent adjacent slice
- read `docs/roadmap/known-false-paths.md` next so ruled-out interpretations do not get reopened
- then open only the lane notes and artifacts listed for the slice you are touching

When restarting or handing off a lane, do not let adjacent unresolved systems become silent blockers unless the current slice actually consumes them.
Prefer recovering whole related families together when they share one implementation path. Do not reflexively split into one row, one field, one symbol, or one tiny evidence fragment at a time unless there is a real boundary.

## Active lanes

### `shard-milestone-payload-recovery`

- Status: `active`
- Goal: recover the player-owned shard row owner or exact serialized payload path needed behind the shard-local runtime shell
- Safe carry-forward:
  - `ShardMining` is the strongest current shard screen-controller family
  - `ShardUpgradeInfo` is the strongest current shard-specific data carrier candidate
  - the repo has checked shard payload-watch, row-shell, row-alignment, handoff, save-boundary, cost-parameter, cost-method, cost-native, type-metadata, and bonus-slot artifacts
  - the checked `ShardMining` to `ConstructionMilestones` handoff plus typed field table now recover one shard-local declaring row model: `ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo`
  - the recovered shard-local row shell currently exposes `Cost`, `MaxLevel`, and `IsUnlocked`
  - the repo now ships one shared shard-family evidence table for reachable rows `0-29`
  - that shared table keeps `SU1` and `SU2` as verified rows, keeps rows `0`, `7`, and `28` explicitly blocked, and holds the remaining reachable rows as descriptive partials
- Still blocked:
  - only two shard rows are currently verified end-to-end; the shared family table is still descriptive evidence, not a full verified row table
  - the direct row-definition payload is recovered on `ShardMining`, but the player-owned row state behind `upgradeInfoList` still has no verified save-side owner or serialized payload path
  - exact player-owned shard row state is not yet import-ready
  - exact planner-safe shard cost math and effect-text mapping are not yet recovered
- Largest coherent adjacent slice:
  - keep future shard follow-up inside the shared family evidence table, upgrading rows from `partial` or `blocked` to `verified` only when a real evidence or validation boundary clears
- Start here:
  - `docs/systems/shards/shard-system-verification.md`
  - `docs/systems/shards/shard-owner-family-verification.md`
  - `data/shard-milestone-family-evidence.v1.json`
  - `data/shard-milestone-handoff-boundary.v1.json`
  - `data/shard-save-boundary.v1.json`
  - `data/shard-milestone-save-owner-candidates.v1.json`

### `spend-multiverse-savedata-import-surface`

- Status: `active`
- Goal: reach one bounded admissibility decision for `SaveData`-backed Emporium import without mixing that decision with row identity/remap work or planner behavior
- Safe carry-forward:
  - `MultiverseMarket` is the real Emporium owner
  - exact typed recovery now confirms `PlayerProfileHandler.get_Market -> MultiverseMarket` as the checked accessor bridge
  - exact typed recovery now also confirms `PlayerProfileHandler.ConvertSaveDataToProfileData(SaveData, System.DateTime) -> PlayerProfileData` as the checked save-to-profile conversion bridge
  - the bare `Market` symbol is still only a metadata/member-shell clue in the checked boundary
  - exact typed recovery still does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
  - `PlayerProfileData` is a flatter wrapper/export surface, not the declaring owner for the broader checked progression cluster, even though it also directly declares `InscryptionsDone`
  - exact typed recovery also fixes the dual declaration on concrete types: `PlayerProfileData.InscryptionsDone` is `System.String` while `SaveData.InscryptionsDone` is `System.Int32`
  - exact typed recovery now also confirms `SaveData` as the declaring owner for the checked `IS*Level` / `EsotericR*Trades` / `NecrumR*Trades` / early `Mech*` cluster, with `InscryptionsDone` split out as an exact dual declaration on `SaveData` and `PlayerProfileData`
  - the exact SaveData-owned `IS1Level` through `IS110Level` span is now safe for compatibility-only raw Emporium import under `compatibility.unmappedSystemState.multiverseMarket`
  - validated Emporium rows `71-74` overlap the recovered save-side `IS*Level` run
  - `IS71Level` through `IS74Level` only ground ordered overlap to rows `71-74`, not import admissibility or final player-facing identity
  - `InscryptionsDone` is wrapper/export-only for import decisions, not a new bounded canonical Emporium import
  - no recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `state.playerProfile`
- Still blocked:
  - canonical Emporium import remains blocked even though row identity is now structurally grounded, because the repo recovers the runtime `SetAllChrystosEmporiumTexts` -> `SetAllBaseBonusTexts` -> `SetISNBaseBonusText` base-bonus lane, the parallel `SetISNBonusText` effect-label lane, the row-local slot alias for that effect-label writer as `BonusDescriptionText`, and the control-row payload source through `MultiverseMarket.get_FinalIS78Bonus()` / `get_FinalIS83Bonus()`, but still lacks the separate `CurrentBonusText` writer lane after explicit negative checks against `TextHandlerMarkets` and the last plausible row-local fallback surfaces `NavigationManager.UpdateInscryptionUI`, `NavigationManager+<UpdateInscryptionUI>d__185.MoveNext`, `NavigationManager+<InscEnum>d__186.MoveNext`, `NavigationManager.DisableInscryptionObjects`, `NavigationManager.OnAvailbleInscryptionsClick`, `NavigationManager.OnFinishedInscryptionsClick`, `TextHandlerShopNPCs.OpeningChrystosEmporium`, `TextHandlerShopNPCs.EmporiumDefaultText`, and `TextHandlerShopNPCs+<DisplayTextEmporium>d__22.MoveNext`, plus a broader canonical import-safe join
  - the recovered wider `SaveData` block still mixes Emporium-adjacent rows with trade-counter and early `Mech*` progression fields, so canonical import-safe identity stays empty even though the exact `IS1Level-IS110Level` span is compatibility-safe raw import
  - the only remaining save-owner seam is whether the metadata-only `Market` shell ever resolves to a real typed wrapper field beyond the checked accessor bridge; the checked declaring owner for the current cluster is already closed on `SaveData`
- Largest coherent adjacent slice:
  - keep canonical promotion explicitly blocked unless new evidence grounds a coherent player-facing `SaveData`-backed Emporium import family; do not split that work into row-by-row admissibility claims without a real boundary
- Start here:
  - `docs/systems/spend/multiverse-market-verification.md`
  - `docs/systems/spend/multiverse-market-state-verification.md`
  - `docs/systems/spend/multiverse-market-savedata-import-boundary.md`
  - `data/multiverse-market-savedata-import-boundary.json`

## Queued next blockers

Use these when the active lanes above close or split.

### `spend-token-shop-row-remap`

- Goal: remap recovered `SaveData` `ATU*Level` fields onto grounded TokenShop rows without inventing player-facing names
- Current blocker: the repo now has eleven checked shell-to-prefab bridges for `ATU1Button`, `ATU2Button`, `ATU4Button`, `ATU5Button`, `ATU6Button`, `ATU7Button`, `ATU8Button`, `ATU9Button`, `ATU10Button`, `ATU11Button`, and `ATU12Button`, plus one checked `ATU6Button` -> `NewTokenUPGPrefab.T1.MK2Booster` -> `Mk2 Generator Booster` title chain, one bounded `ATU5Button` -> `NewTokenUPGPrefab.T1.MK1Booster` -> `1. MK1 Generator Output,` named-identity and title-side text chain, one bounded `ATU8Button` -> `NewTokenUPGPrefab.T1.MK4Booster` -> `Mk4 Generator Booster` title-side text chain, one bounded `ATU9Button` -> `NewTokenUPGPrefab.T1.MK5Booster` -> `Mk5 Generator Booster` title-side text chain, one bounded `ATU10Button` -> `NewTokenUPGPrefab.T1.MK6Booster` -> `Mk6 Generator Booster` title-side text chain, one narrower `ATU11Button` -> `NewTokenUPGPrefab.T1.MK7Booster` bridge with only detached `MK7 GEN ENHANCEMENT` title-side text, one bounded `ATU12Button` -> `NewTokenUPGPrefab.T1.MK8Booster` -> `Mk8 Generator Booster` title-side text chain, and ATU3 now also has one checked effect-driven `ATU3Button` -> `BuyCellBoost` -> shared `Cells Booster (Chests)` chest-effect chain with `CellBoostBonus = 1` as a bounded parameter surface plus one tighter shared-effect-to-consumer-family handoff into the `AdManager` chest routine neighborhood and one checked internal bonus-aggregation shell; the explicit `CellBoostBonus`-anchor follow-up closes the full internal AdManager bonus-aggregation family as a bounded negative result, the bounded ATU4 title-side pass still stays negative, the remaining ATU5 blocker is still only the absent exact final row-title string, the late ATU24-ATU28 shell neighborhood remains a clean negative result, and the rest of the `ATU` family still lacks a checked bridge to a specific prefab identity or final player-facing row title
- Largest coherent adjacent slice: keep the current ATU bridge-side family quarantined until a coherent adjacent remap family is grounded, and only split into narrower `ATU*` probes where the owner path, runtime path, or validation path genuinely diverges, without reopening the closed ATU3 bonus-aggregation cluster, the closed ATU11 MK7 title-side seam, or the closed ATU12 MK8 bridge-plus-title-side-text seam

## Recently narrowed

### `spend-token-shop-row-level-recovery`

- Status: `archived`
- Grounded conclusion:
  - exact typed recovery now confirms `SaveData` as the declaring owner for `ATU1Level` through `ATU28Level`
  - the same exact save block also carries `Tier2TokensUnlocked` through `Tier5TokensUnlocked`
  - these raw fields are now safe for compatibility-only import under `compatibility.unmappedSystemState.tokenShop`
  - canonical/player-facing remap work should continue on a narrower row-label boundary instead of reopening the owner question

### `spend-token-bank-state-owner`

- Goal: recover the saved-state owner behind token-bank cap, fill, and claimable-bank state
- Current blocker: exact `SaveData.BankedTokens` recovery closes current stored amount, the checked `PlayerProfileHandler.saveInfoCache` plus `ConvertSaveDataToProfileData(...) -> PlayerProfileData` bridge still only exposes generic `PlayerProfileData.Tokens` and `PlayerProfileData.Tokenium` wrapper strings, and the remaining `CloudSavePlayerProfile` evidence now narrows only to a metadata-only cloud save/load shell instead of a deeper typed wrapper, so bank-cap and claimable-bank ownership are still unresolved
- Largest coherent adjacent slice: checked bank-state owner family boundary that either recovers a deeper declaring save model or proves a narrower non-`PlayerProfileData` wrapper than the current export bridge while keeping the metadata-only `CloudSavePlayerProfile` shell closed as a non-owner surface

### `spend-daily-tokenium-save-owner`

- Goal: recover the gameplay owner and saved-state fields behind the Academy or Farm Mission Daily Tokenium lane
- Current blocker: exact typed recovery now confirms `SaveData.DailyTokenium` for the current stored amount and narrows the save-side wrapper to the nearby mission-persistence block in `SaveData`, but cap and Daily Tokenium-specific ready-state ownership still stop short of a direct field and broader generic Tokenium claimable state is still not a checked Daily Tokenium join
- Largest coherent adjacent slice: checked Daily Tokenium mission-persistence family boundary inside that narrower `SaveData` neighborhood without collapsing generic `ClaimableTokenium` into Daily Tokenium

### `spend-multiverse-row-label-remap`

- Goal: finish the validated Emporium row id and label remap after owned-state recovery is stronger
- Current blocker: the active Emporium import-surface lane keeps the canonical import-safe subset empty, and rows `71-74` are still ordered-only overlap without grounded player-facing identity
- Largest coherent adjacent slice: checked remap artifact for the currently validated Emporium row family, splitting only if a real owner or validation boundary appears

## Keep separate

- Canonical truth: shipped datasets and grounded player-facing contracts
- Narrowed checked boundaries: handoff seams, owner-family narrowing, range overlaps, and blocked-use framing
- Unresolved hypotheses: candidate wrappers, probable declaring families, and next probes that still need evidence
