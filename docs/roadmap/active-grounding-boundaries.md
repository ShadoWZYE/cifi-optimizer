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

### `spend-multiverse-save-model-recovery`

- Status: `active`
- Goal: recover the declaring save model behind `InscryptionsDone` and the nearby `IS*Level` cluster
- Safe carry-forward:
  - `MultiverseMarket` is the real Emporium owner
  - `InscryptionsDone` is a real metadata field string
  - the save-side search is narrowed to the PlayerProfile persistence family
  - exact typed recovery now confirms `PlayerProfileHandler.get_Market -> MultiverseMarket` as the checked accessor bridge
  - the bare `Market` symbol is still only a metadata/member-shell clue in the checked boundary
  - exact typed recovery still does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`
  - exact typed recovery now also confirms `SaveData` as the declaring owner for the wider `IS*Level` / `EsotericR*Trades` / `NecrumR*Trades` / early `Mech*` cluster
  - the broader `IS*Level` / trade-counter / mech run is not declared directly on checked `MultiverseMarket` or its first nested row-local payloads
  - validated Emporium rows `71-74` overlap the recovered save-side `IS*Level` run
  - the wider checked same-number prefab boundary is now stable through `68`, broken across `69-74`, and resumed at `75-110`
- Still blocked:
  - the checked boundary still does not recover a typed `Market` field, so `Market` should remain accessor/member-shell naming only unless new evidence appears
  - the full owned `IS*Level` range is not yet safe import truth
- Smallest next slice:
  - decide how much of the recovered `SaveData` declaration block is safe to expose for bounded import support without re-promoting metadata-shell `Market` into a typed owner claim
- Start here:
  - `docs/systems/spend/multiverse-market-verification.md`
  - `docs/systems/spend/multiverse-market-state-verification.md`
  - `data/multiverse-market-save-boundary.json`
  - `data/multiverse-market-market-member-boundary.json`

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
- Current blocker: the save-model and validated-row owned-state range are not yet strong enough to anchor the remap
- Smallest next slice: checked remap artifact for the currently validated row block

## Keep separate

- Canonical truth: shipped datasets and grounded player-facing contracts
- Narrowed checked boundaries: handoff seams, owner-family narrowing, range overlaps, and blocked-use framing
- Unresolved hypotheses: candidate wrappers, probable declaring families, and next probes that still need evidence
