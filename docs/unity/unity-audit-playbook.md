## Agent default behavior

This playbook is not only for manual research refreshes. It is also the default fallback path for agents when repo docs or shipped datasets do not fully explain a game system.

If an agent encounters a mechanic, label, owner, currency, unlock rule, or player-state dependency that is unclear or missing:

1. check the relevant repo docs and current datasets
2. if still unresolved, inspect the committed APK/Unity artifacts described in this playbook
3. attempt to ground the answer from repo-local extraction evidence
4. only after that fails should external/public/community sources be considered

Agents should treat external sources as fallback evidence, not the first stop, for unresolved game-mechanic questions.

# Unity Audit Playbook

This document captures the current extraction pathway for grounded CIFI mechanics from the Android/Unity build so the work can be resumed on another machine without reconstructing the process from chat history.

## Scope

- Goal: recover grounded in-game mechanic owners, field names, and serialized constants from the shipped Unity/IL2CPP build.
- Current proven owners:
  - `TokenShop` in [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
  - `MultiverseMarket` in [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
- Current narrowed but unresolved owner family:
  - shard milestones / loop-reset shell in [`workbench/unity/joined/level0`](workbench/unity/joined/level0) and [`workbench/unity/joined/sharedassets0.assets`](workbench/unity/joined/sharedassets0.assets)
- Current non-goal: full save-file decoding. The external save/export blobs are still opaque and should not block mechanic extraction.

## Source Inputs

These inputs are now committed in the repository and restored through Git LFS:

- extracted APK payload under `workbench/apk/base`
- merged APK layout under `workbench/apk/merged`
- joined Unity asset files under `workbench/unity/joined`

These remain external prerequisites:

- Git LFS to restore the committed large files
- Python 3.11+ to run the maintained parser scripts
- `.NET 6 Runtime` for `UABEA`
- `.NET 8 SDK` only if rebuilding `tools/unity/CifiAssetProbe`
- LDPlayer only if recreating raw extracts from the emulator

Repo-local npm probe wrappers:

- `npm run probe:build`
  - restores and rebuilds `tools/unity/CifiAssetProbe/bin/probe-run` from committed repo state
  - keeps `.dotnet`, `.nuget/packages`, and `.appdata` inside the repo
  - requires local `.NET 8 SDK`; the first restore also needs NuGet network access unless the repo-local package cache is already warm
- `npm run probe:uabea`
  - rebuilds and runs `tools/unity/CifiAssetProbe`
  - keeps `.dotnet`, `.nuget/packages`, and `.appdata` inside the repo
  - if the runnable probe artifact is missing, the wrapper restores and rebuilds it automatically
  - if `Program.cs`, `CifiAssetProbe.csproj`, or `NuGet.Config` is newer than `bin/probe-run/CifiAssetProbe.dll`, the wrapper fails fast and tells you to run `npm run probe:build`
- `npm run probe:shards:parameters`
  - regenerates `data/shard-cost-parameter-probe.v1.json` and `docs/systems/shards/shard-cost-parameter-probe.md`
- `npm run probe:shards:type-metadata`
  - refreshes `data/uabea-probe-report.json` first, then regenerates `data/shard-type-metadata-probe.v1.json` and `docs/systems/shards/shard-type-metadata-probe.md`
- `npm run probe:shards:method`
  - refreshes `data/uabea-probe-report.json` first, then regenerates `data/shard-cost-method-probe.v1.json` and `docs/systems/shards/shard-cost-method-probe.md`
- `npm run probe:shards:cost-native`
  - refreshes `data/uabea-probe-report.json`, then regenerates the shard method, parameter, and native probe outputs in dependency order
- `npm run probe:trace -- --target <target-id> --anchor <anchor>`
  - regenerates `data/unity-trace-bundle.json` and `docs/unity/unity-trace-bundle.md`
  - reads committed `workbench/apk/base/global-metadata.dat`, `data/token-shop-values.json`, `data/daily-tokenium-lane-probe.json`, `data/uabea-probe-report.json`, `data/unity-probe-report.json`, and `data/lm244-targeted-probe.json`
  - preserves target-driven cross-surface joins across metadata neighborhoods, owner-payload shells, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle before any remap-boundary promotion
  - records explicit typed proved edges, negative edges, provenance-strength tags, and one solved-vs-blocked comparison shape from committed sources so the bundle can say which join exists, which join is missing, and which artifact proved each claim
  - the current checked target is `token-shop-atu3-cells`, which intentionally stays a negative trace unless one new committed artifact crosses back to `ATU3Button` or path id `15810`

Important primary files:

- [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat)
- [`workbench/apk/base/libil2cpp.so`](workbench/apk/base/libil2cpp.so)
- [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
- [`workbench/unity/joined/sharedassets0.assets`](workbench/unity/joined/sharedassets0.assets)

## Proven Workflow

1. Confirm the Android package and pull accessible app storage through LDPlayer ADB.
2. Extract the APK and split APK payloads into `workbench/apk/base`.
3. Merge the split APK native libraries with the base APK assets into `workbench/apk/merged`.
4. Join Unity split asset containers into `workbench/unity/joined`.
5. Use `rg -aob` against `global-metadata.dat` to locate class names, method names, and field neighborhoods for the target system.
6. Use `level0` string anchors to locate the concrete scene prefab names and UI owner objects.
7. Resolve the real `MonoBehaviour` owner by scanning MonoBehaviour headers and matching `m_Script` path IDs back to `MonoScript` names.
8. Parse the raw serialized object payload directly when tool-side IL2CPP typetree generation fails.

## Why Raw Parsing Was Needed

The current Unity build uses metadata version `39`. The available `Cpp2IL` path in local `AssetsTools.NET` tooling does not support that version cleanly enough for direct MonoBehaviour deserialization. The reliable fallback was:

- recover declaration-order field names from [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat)
- locate the owning MonoBehaviour byte range in [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
- align named fields to the raw byte stream
- promote successful alignments into repeatable parser scripts

## Owner Map

### Token Bank

- Scene/UI strings and prefab anchors are in [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
- Proven owner: `TokenShop`
- Parser: [`scripts/unity/token_shop_parse.py`](scripts/unity/token_shop_parse.py)
- Outputs:
  - [`docs/systems/spend/token-shop-values.md`](docs/systems/spend/token-shop-values.md)
  - [`data/token-shop-values.json`](data/token-shop-values.json)

### Chrystos Emporium

- Scene/UI shell names include `ChrystosEmperium.Shop`, but the mechanics owner is `MultiverseMarket` on GameObject `Inscryptions`
- Proven owner byte start: `33216256` in [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
- Parser: [`scripts/unity/multiverse_market_parse.py`](scripts/unity/multiverse_market_parse.py)
- Outputs:
  - [`docs/systems/spend/multiverse-market-values.md`](docs/systems/spend/multiverse-market-values.md)
  - [`data/multiverse-market-values.json`](data/multiverse-market-values.json)

## Current Findings

### TokenShop

`TokenShop` is fully validated as a serialized named-constant owner for token mechanics. It exposes grounded fields like `StartCost`, `AdditiveCost`, `Bonus`, `MaxLevel`, `FillMaxLevel`, and late-tier `ATU` values. This is the reference pattern for future system work.

### MultiverseMarket

`MultiverseMarket` metadata exposes:

- `IS1StartCost` through `IS110StartCost`
- `IS1CostExponent` through `IS110CostExponent`
- `IS1MaxLevel` through `IS110MaxLevel`
- `FinalIS1Cost` through `FinalIS110Cost`
- `FinalIS1Bonus` through `FinalIS110Bonus`

The currently validated serialized late block yields 22 structurally valid rows before the layout changes again. Those rows are not stored in inscription-ID order, which strongly suggests this block is a display/order list rather than a plain `IS50..IS71` array. It already yields direct `Bonus`, `StartCost`, and `CostExponent` values. A second parser is still needed for the remaining layout.

### Shard milestone shell

The repo now has grounded shell-level shard evidence and a narrowed owner-family split. Current recovered identifiers include:

- `LoopResetStage1` through `LoopResetStage5`
- `ShardMilestones-64`
- `ShardMilestones-256`
- `MilestoneBonusesPerLevel`
- `Milestone1` through at least `Milestone57`
- `Milestones, Assembly-CSharp`
- `SpaceShip-ShardMining-LV1` through `SpaceShip-ShardMining-LV4`

This is enough to justify descriptive shard and loop warnings. It is not enough to claim that the shipped app already exposes a verified milestone row map, bonus table, or cost table.

Current narrowed owner-family split:

- `ShardMining, Assembly-CSharp`
  - current role evidence: `CheckFirstTimeShardMilestoneOpened`, `AttachFastBuyButton`, `FastBuyButtonMethodShards`, `StartFastBuyButtonHold`
  - metadata tie-in: `ShardMining|ShardUpgradeInfo`
- `ShardUpgradeInfo`
  - current role evidence: `TotalMilestoneLevels`, `get_IsUnlocked`, `get_SU*FinalUnlockReq`, `FinalSU*Bonus*`, and `<FastBuyEnum>d__1429`
- `ConstructionMilestones, Assembly-CSharp`
  - current role evidence: `InitializeMilestones`, `BuyMilestone1` through `BuyMilestone57`, `ConstructionMilestonesSum`, `get_MilestoneMaxLevel`, and `FinalMilestone*Bonus*`
  - current interpretation: generic or academy-side milestone family, not the preferred shard-specific owner claim

## Resume Path

If resuming on another machine:

1. clone the repo with Git LFS enabled
2. confirm the large files under `workbench/apk/base`, `workbench/apk/merged`, `workbench/unity/joined`, and `tools` were restored
3. run:
   - `python scripts/unity/token_shop_parse.py`
   - `python scripts/unity/multiverse_market_parse.py`
   - `npm run probe:build`
   - `npm run probe:uabea`
   - `npm run probe:shards:parameters`
   - `npm run probe:shards:type-metadata`
   - `npm run probe:shards:method`
   - `npm run probe:shards:cost-native`
4. inspect the grounded outputs in `docs/` and `data/`
5. continue by targeting the next unresolved owner object, not by returning to broad string scraping

Recommended next unresolved extraction target after PR2:

- the exact serialized shard milestone row or save-side state behind the narrowed `ShardMining` / `ShardUpgradeInfo` trail

The current repo-local candidate ranking for that step is recorded in:

- [`docs/systems/shards/shard-extraction-candidates.md`](docs/systems/shards/shard-extraction-candidates.md)
- [`data/extraction-candidate-ranking.v1.json`](data/extraction-candidate-ranking.v1.json)
- regenerated by [`scripts/unity/score_extraction_candidates.py`](scripts/unity/score_extraction_candidates.py)

## Portability Notes

- `scripts/unity/uabea_probe.ps1` resolves the repo root from its own path and is clone-location agnostic.
- `scripts/unity/run_probe.mjs` is the npm entry point for the probe wrappers and keeps `.dotnet`, `.nuget`, and `.appdata` repo-local before invoking `dotnet`.
- `npm run probe:build` is the minimal reproducible rebuild path for the runnable probe artifact from repo state.
- `scripts/unity/token_shop_parse.py` and `scripts/unity/multiverse_market_parse.py` also resolve the repo root from their own path and are clone-location agnostic.
- The npm wrappers are path-portable, but they are not dependency-free: they still require local `dotnet`, Python, restored LFS assets, and the committed `.vendor_manual` libraries for the native shard probe.
- The first `npm run probe:build` on a machine may need outbound access to `api.nuget.org` to populate the repo-local `.nuget/packages` cache before later rebuilds can stay repo-local.
- The `.NET` wrapper no longer silently reuses a stale cached build. It only reuses `tools/unity/CifiAssetProbe/bin/probe-run` when the checked runnable artifact is newer than the local probe source inputs.
- On Windows, the wrapper accepts either `python` or `py -3`. On macOS/Linux, it looks for `python3` first and falls back to `python`.
- The current wrappers assume a shell environment that can execute `node`, `dotnet`, and Python from `PATH`; they do not bootstrap those toolchains for a fresh machine.

## Rework Guidance

The project can now be reworked around owner-based extraction rather than screenshot inference:

- use scene strings only to find the system anchor
- use metadata to find the actual logic owner and field families
- persist grounded outputs as small parser scripts plus checked-in JSON/markdown summaries
- keep `state.playerProfile` and recommendation logic strictly downstream from verified extracted mechanics

## Integration readiness gate

Owner recovery alone is not enough to wire a system into the app.

Before app integration, confirm from the available assets and docs:

1. the in-game system identity
2. the concrete owner object
3. the player-owned inputs needed for recommendations
4. the currency or budget lane the system actually spends
5. whether the visible labels are grounded in-game labels or only serialized ids

Current status:

- `TokenShop`
  - verified: real owner, serialized cost fields, bonus fields, and level-cap fields
  - not yet verified enough for app planning: full player-owned current-level inputs and final remap from serialized field ids to player-facing labels
- `MultiverseMarket`
  - verified: real owner, validated inscription rows, direct serialized constants for part of the system, an Emporium spend-lane shell labeled around `Inscryptions Done`, a checked `PlayerProfileHandler.get_Market -> MultiverseMarket` accessor bridge, exact `PlayerProfileData.InscryptionsDone`, exact metadata field clues such as nearby `IS*Level`, and a broader progression-style field run that continues into trade counters and `Mech*` fields
  - not yet verified enough for app planning: complete row coverage, player-owned current-level inputs, and a bounded import-safe surface on top of the now-recovered `SaveData` declaring owner for the checked `IS*Level` / trade-counter cluster, with `InscryptionsDone` kept split out as an exact dual declaration on `SaveData` and `PlayerProfileData`

If those gaps remain open, keep the system in extraction and verification docs rather than recommendation UI.

## Known Limits

- Full save/export decoding is still unresolved.
- `MultiverseMarket` is only partially decoded; the post-validated late block still needs a second-pass parser.
- Community naming should not be substituted for in-game names unless clearly labeled as external.


