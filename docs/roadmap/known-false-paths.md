# Known False Paths

Use this page to avoid reopening interpretations the repo has already ruled out or narrowed away.

This is not a list of open hypotheses. It is a compact list of paths that should stay closed unless stronger repo-local evidence overturns them.

## Shards

### Do not treat `ConstructionMilestones` as the recovered shard row owner

- Current checked result: it is the academy-side handoff family, not the recovered declaring shard row model
- Why this stays closed: the shard-local shell still lives on the `ShardMining` side and the direct declaring owner is still unresolved
- Source anchors:
  - `docs/systems/shards/shard-owner-family-verification.md`
  - `data/shard-milestone-handoff-boundary.v1.json`

### Do not infer one clean shard row-number map from current `UnlockMilestone*`, `BuyMilestone*`, and `Milestone*TextChecker` hooks

- Current checked result: the partial row-shell families do not overlap cleanly enough to support one-to-one row mapping
- Why this stays closed: unlock hooks, text-checker hooks, and buy hooks currently cover different ranges
- Source anchors:
  - `docs/systems/shards/shard-system-verification.md`
  - `data/shard-milestone-row-alignment-boundary.v1.json`

### Do not claim exact shard planner math, best-buy order, ROI, ETA, or recovered player-owned shard rows

- Current checked result: shard evidence is descriptive and narrowing, not planner-safe owned-state truth
- Why this stays closed: save-owner recovery and exact cost validation remain blocked
- Source anchors:
  - `docs/systems/shards/shard-player-facing-evidence.md`
  - `docs/systems/shards/shard-grounding-boundary.md`

## Spend

### Do not treat the Emporium spend lane as diamond, token-bank, or generic spend-pool state

- Current checked result: `MultiverseMarket` is a real Emporium owner and `InscryptionsDone` is the grounded spend-lane shell
- Why this stays closed: older borrowed-currency interpretations are weaker than the current owner and metadata evidence
- Source anchors:
  - `docs/systems/spend/multiverse-market-verification.md`
  - `docs/systems/spend/spend-system-verification.md`

### Do not treat direct `MultiverseMarket` ownership on `PlayerProfileData` as recovered canonical save truth

- Current checked result: the stronger current handoff is a PlayerProfile-side `get_Market` member path or broader wrapper
- Why this stays closed: the checked declaring owner for the `IS*Level` / trade-counter / early `Mech*` run is now `SaveData`, `InscryptionsDone` is split out as an exact dual declaration on `SaveData` and `PlayerProfileData`, the exact dual declaration is also type-split as `PlayerProfileData.InscryptionsDone: System.String` versus `SaveData.InscryptionsDone: System.Int32`, and the typed `Market` field itself still stays unresolved on the checked save path
- Source anchors:
  - `docs/systems/spend/multiverse-market-state-verification.md`
  - `data/multiverse-market-market-member-boundary.json`

### Do not reopen a generic declaring-owner search behind `InscryptionsDone` and the nearby `IS*Level` cluster

- Current checked result: the exact declaring owner for the checked cluster is already closed on `SaveData`
- Why this stays closed: the remaining unresolved seam is only whether the metadata-only `Market` shell ever resolves to a typed wrapper field beyond the checked `PlayerProfileHandler.get_Market -> MultiverseMarket` bridge, not who declares the checked `InscryptionsDone` / `IS*Level` progression block
- Source anchors:
  - `docs/systems/spend/multiverse-market-market-member-boundary.md`
  - `data/multiverse-market-market-member-boundary.json`

### Do not treat the `69-74 -> 57-62` prefab shell relation as the live player-facing Emporium remap

- Current checked result: the shell anomaly is real, but supplied in-game screenshots show the live UI still presenting rows `69-74` directly as `INSCRYPTION #69` through `INSCRYPTION #74`
- Why this stays closed: the remapped prefab names remain useful only as internal shell metadata and anomaly provenance, not as the player-facing row identities
- Source anchors:
  - `docs/systems/spend/multiverse-market-row69-74-identity-source-boundary.md`
  - `docs/systems/spend/multiverse-market-row71-74-remap-band.md`

### Do not treat Daily Tokenium as a TokenShop-only lane

- Current checked result: Daily Tokenium is currently best grounded as an Academy or Farm Mission reward lane that multiple modifier families touch
- Why this stays closed: TokenShop, loop modifiers, and the Collector pack are modifier or adjacent families, not the recovered underlying owner
- Source anchors:
  - `docs/systems/spend/daily-tokenium-mission-lane-verification.md`
  - `docs/systems/spend/token-bank-state-verification.md`

### Do not treat `LM244` as the recovered Daily Tokenium gameplay owner

- Current checked result: `LM244` is a loop-mod text or explanation hook
- Why this stays closed: the owner search still stops before the actual saved-state family
- Source anchors:
  - `docs/systems/spend/spend-system-verification.md`
  - `docs/systems/spend/daily-tokenium-mission-lane-verification.md`

### Do not treat TokenShop base costs as diamond costs

- Current checked result: the base TokenShop spend lane is grounded as token-bank token or tokenium spending
- Why this stays closed: diamond-related paths are separate modifier or downstream lanes touched by specific upgrades
- Source anchors:
  - `docs/systems/spend/token-shop-values.md`
  - `docs/systems/spend/spend-system-verification.md`

## Workflow

### Do not promote narrowed boundary artifacts as canonical player state

- Current checked result: owner-family, save-boundary, handoff, and metadata-neighborhood artifacts narrow the search but do not by themselves become `state.playerProfile` truth
- Why this stays closed: the repo keeps canonical truth, checked boundaries, and unresolved hypotheses separate on purpose
- Source anchors:
  - `docs/roadmap/mvp-plan.md`
  - `docs/contracts/dataset-contracts.md`
