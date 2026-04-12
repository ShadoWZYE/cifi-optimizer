# Active Grounding Boundaries

Use this page as the compact handoff surface for fresh grounding threads.

It is a short carry-forward layer over:

- `data/game-data.snapshot.v1.json`
- `docs/roadmap/research-tracks.md`
- the lane-specific verification notes linked below

It is not a replacement for canonical datasets, deep verification notes, or the full research-track queue.

## How to use it

- read this first for current lane boundaries
- use the lane contract first: user-facing question, minimum required inputs, explicit non-blockers, current true blocker, and smallest shippable tool slice
- read `docs/roadmap/known-false-paths.md` next so ruled-out interpretations do not get reopened
- then open only the lane notes and artifacts listed for the slice you are touching

When restarting or handing off a lane, do not let adjacent unresolved systems become silent blockers unless the current slice actually consumes them.

## Active lanes

### `spend-planner-first-ui-slice`

- Status: `active`
- User-facing question: what TokenShop rows can the player safely inspect from current repo-backed data right now, and what still stays blocked
- Minimum required inputs:
  - the checked TokenShop row-remap subset
  - imported current levels for that same checked subset
  - explicit blocked-state labeling for unresolved rows or inputs
- Explicit non-blockers:
  - token-bank cap or claimable-state recovery
  - Daily Tokenium cap or ready-state recovery
  - Emporium owned-state recovery
  - unresolved TokenShop rows outside the checked subset
  - recommendation math or new gameplay logic
- Current true blocker:
  - keeping the first slice subset-bound and player-facing instead of widening it into a full spend-planner dependency bundle
- Smallest shippable tool slice:
  - ship a normal app surface that shows the checked TokenShop row subset, current imported levels for that subset, and explicit blocked-input notes for everything still unresolved, with no recommendation math
- Start here:
  - `docs/systems/spend/spend-system-verification.md`
  - `docs/systems/spend/token-shop-row-remap-verification.md`
  - `docs/roadmap/research-tracks.md`

### `shard-milestone-payload-recovery`

- Status: `active`
- Goal: recover the exact shard-side serialized row payload or declaring save-side owner needed for player-owned shard workflow inputs
- Safe carry-forward:
  - `ShardMining` is the strongest current shard screen-controller family
  - `ShardUpgradeInfo` is the strongest current shard-specific data carrier candidate
  - the repo has checked shard payload-watch, row-shell, row-alignment, handoff, save-boundary, cost-parameter, cost-method, cost-native, type-metadata, and bonus-slot artifacts
  - the current shard row-owner seam is narrowed to the `ShardMining` to `ConstructionMilestones` handoff, not a fully open shard-owner search
- Still blocked:
  - the declaring serialized row model or save-side owner is not yet recovered
  - exact player-owned shard row state is not yet import-ready
  - exact planner-safe shard cost math and effect-text mapping are not yet recovered
- Smallest next slice:
  - recover the declaring row or save owner at the narrowed handoff seam, or tighten that seam further without claiming solved player-owned rows
- Start here:
  - `docs/systems/shards/shard-system-verification.md`
  - `docs/systems/shards/shard-owner-family-verification.md`
  - `data/shard-milestone-handoff-boundary.v1.json`
  - `data/shard-save-boundary.v1.json`

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
- Smallest next slice:
  - keep canonical promotion explicitly blocked unless new evidence grounds player-facing row identity or a narrower canonical `SaveData`-backed Emporium import slice
- Start here:
  - `docs/systems/spend/multiverse-market-verification.md`
  - `docs/systems/spend/multiverse-market-state-verification.md`
  - `docs/systems/spend/multiverse-market-savedata-import-boundary.md`
  - `data/multiverse-market-savedata-import-boundary.json`

## Queued next blockers

Use these when the active lanes above close or split.

### `spend-token-shop-row-remap`

- Goal: remap recovered `SaveData` `ATU*Level` fields onto grounded TokenShop rows without inventing player-facing names
- Current blocker: the repo now has seven checked shell-to-prefab bridges for `ATU1Button`, `ATU2Button`, `ATU4Button`, `ATU5Button`, `ATU6Button`, `ATU7Button`, and `ATU8Button`, plus one checked `ATU6Button` -> `NewTokenUPGPrefab.T1.MK2Booster` -> `Mk2 Generator Booster` title chain, one bounded `ATU5Button` -> `NewTokenUPGPrefab.T1.MK1Booster` -> `1. MK1 Generator Output,` named-identity and title-side text chain, one bounded `ATU8Button` -> `NewTokenUPGPrefab.T1.MK4Booster` -> `Mk4 Generator Booster` title-side text chain, and ATU3 now also has one checked effect-driven `ATU3Button` -> `BuyCellBoost` -> shared `Cells Booster (Chests)` chest-effect chain with `CellBoostBonus = 1` as a bounded parameter surface plus one tighter shared-effect-to-consumer-family handoff into the `AdManager` chest routine neighborhood and one checked internal bonus-aggregation shell, but the exact `CellBoostBonus` read-site or typed-field handoff into that internal shell is still unresolved, the bounded ATU4 title-side pass still stays negative, the remaining ATU5 blocker is now only the absent exact final row-title string, the late ATU24-ATU28 shell neighborhood still remains a clean negative result, and the rest of the `ATU` family still lacks a checked bridge to a specific prefab identity or final player-facing row title
- Smallest next slice: keep ATU3 quarantined as an effect-driven row unless a committed source finally exposes the exact `CellBoostBonus` read-site seam into the internal bonus-aggregation shell, or recover one more checked shell-to-prefab bridge from a different unresolved `ATU*Button`, `ATU*Content`, or adjacent shell neighborhood without widening the rest of the family

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
- Current blocker: exact `SaveData.BankedTokens` recovery closes current stored amount and the broader checked `PlayerProfileHandler.saveInfoCache` plus `ConvertSaveDataToProfileData(...) -> PlayerProfileData` bridge only exposes generic `PlayerProfileData.Tokens` and `PlayerProfileData.Tokenium` wrapper strings, so bank-cap and claimable-bank ownership are still unresolved
- Smallest next slice: checked bank-state owner boundary that either recovers a deeper declaring save model or proves a narrower non-`PlayerProfileData` wrapper than the current export bridge

### `spend-daily-tokenium-save-owner`

- Goal: recover the gameplay owner and saved-state fields behind the Academy or Farm Mission Daily Tokenium lane
- Current blocker: exact typed recovery now confirms `SaveData.DailyTokenium` for the current stored amount and narrows the save-side wrapper to the nearby mission-persistence block in `SaveData`, but cap and Daily Tokenium-specific ready-state ownership still stop short of a direct field and broader generic Tokenium claimable state is still not a checked Daily Tokenium join
- Smallest next slice: checked cap or ready-state boundary inside that narrower `SaveData` mission-persistence neighborhood without collapsing generic `ClaimableTokenium` into Daily Tokenium

### `spend-multiverse-row-label-remap`

- Goal: finish the validated Emporium row id and label remap after owned-state recovery is stronger
- Current blocker: the active Emporium import-surface lane keeps the canonical import-safe subset empty, and rows `71-74` are still ordered-only overlap without grounded player-facing identity
- Smallest next slice: checked remap artifact for the currently validated row block

## Keep separate

- Canonical truth: shipped datasets and grounded player-facing contracts
- Narrowed checked boundaries: handoff seams, owner-family narrowing, range overlaps, and blocked-use framing
- Unresolved hypotheses: candidate wrappers, probable declaring families, and next probes that still need evidence
