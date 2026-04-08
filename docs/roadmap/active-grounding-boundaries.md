# Active Grounding Boundaries

Use this page as the compact handoff surface for fresh grounding threads.

It is a short carry-forward layer over:

- `data/game-data.snapshot.v1.json`
- `docs/roadmap/research-tracks.md`
- the lane-specific verification notes linked below

It is not a replacement for canonical datasets, deep verification notes, or the full research-track queue.

## How to use it

- read this first for current lane boundaries
- read `docs/roadmap/known-false-paths.md` next so ruled-out interpretations do not get reopened
- then open only the lane notes and artifacts listed for the slice you are touching

## Active lanes

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
- Goal: decide whether any bounded `SaveData`-backed Emporium import surface is safe to expose without promoting unresolved labels or planner behavior too early
- Safe carry-forward:
  - `MultiverseMarket` is the real Emporium owner
  - exact typed recovery now confirms `PlayerProfileHandler.get_Market -> MultiverseMarket` as the checked accessor bridge
  - the bare `Market` symbol is still only a metadata/member-shell clue in the checked boundary
  - exact typed recovery still does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
  - `PlayerProfileData` is a flatter wrapper/export surface, not the declaring owner for the broader progression cluster
  - exact typed recovery now also confirms `SaveData` as the declaring owner for the wider `IS*Level` / `EsotericR*Trades` / `NecrumR*Trades` / early `Mech*` cluster
  - validated Emporium rows `71-74` overlap the recovered save-side `IS*Level` run
  - `IS71Level` through `IS74Level` only ground ordered overlap to rows `71-74`, not final player-facing identity
  - `InscryptionsDone` is wrapper/export-only for import decisions, not a new bounded canonical Emporium import
  - no recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `state.playerProfile`
- Still blocked:
  - the `69-74` prefab anomaly and incomplete player-facing label remap still block canonical Emporium identity
  - the recovered wider `SaveData` block mixes Emporium-adjacent rows with trade-counter and early `Mech*` progression fields, so the canonical import-safe subset stays empty
- Smallest next slice:
  - keep the import-safe subset explicitly empty unless new evidence grounds a narrower `SaveData`-backed Emporium import slice
- Start here:
  - `docs/systems/spend/multiverse-market-verification.md`
  - `docs/systems/spend/multiverse-market-state-verification.md`
  - `docs/systems/spend/multiverse-market-savedata-import-boundary.md`
  - `data/multiverse-market-savedata-import-boundary.json`

## Queued next blockers

Use these when the active lanes above close or split.

### `spend-token-shop-row-level-recovery`

- Goal: recover player-owned current TokenShop row levels
- Current blocker: owner-side constants and controller clues exist, but authoritative owned row-level state is not recovered
- Smallest next slice: checked level-owner or save-owner artifact

### `spend-token-bank-state-owner`

- Goal: recover the saved-state owner behind token-bank cap, fill, and claimable-bank state
- Current blocker: controller hooks and derived outputs are separated, but the saved-state owner is still unresolved
- Smallest next slice: checked bank-state owner boundary

### `spend-daily-tokenium-save-owner`

- Goal: recover the gameplay owner and saved-state fields behind the Academy or Farm Mission Daily Tokenium lane
- Current blocker: the lane family is grounded, but the owner still stops at modifier families and text paths
- Smallest next slice: checked owner-family or save-owner boundary

### `spend-multiverse-row-label-remap`

- Goal: finish the validated Emporium row id and label remap after owned-state recovery is stronger
- Current blocker: the active Emporium import-surface lane keeps the canonical import-safe subset empty, and rows `71-74` are still ordered-only overlap without grounded player-facing identity
- Smallest next slice: checked remap artifact for the currently validated row block

## Keep separate

- Canonical truth: shipped datasets and grounded player-facing contracts
- Narrowed checked boundaries: handoff seams, owner-family narrowing, range overlaps, and blocked-use framing
- Unresolved hypotheses: candidate wrappers, probable declaring families, and next probes that still need evidence
