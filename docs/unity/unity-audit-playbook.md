## Agent default behavior

This playbook is not only for manual research refreshes. It is also the default fallback path for agents when repo docs or shipped datasets do not fully explain a game system.

If an agent encounters a mechanic, label, owner, currency, unlock rule, or player-state dependency that is unclear or missing:

1. check the relevant repo docs and current datasets
2. if still unresolved, inspect the committed APK/Unity artifacts described in this playbook
3. attempt to ground the answer from repo-local extraction evidence
4. only after that fails should external/public/community sources be considered

Agents should treat external sources as fallback evidence, not the first stop, for unresolved game-mechanic questions.

Default extraction workflow policy:

1. resolve the request through the trace/query planner
2. collect or reuse DB/cache/evidence
3. rebuild reducer/materializer-owned semantic and view state
4. export JSON or markdown only when a snapshot or operator-facing artifact is explicitly needed

Do not treat committed export files as the default recovery path when DB-backed trace/materialized state exists for the lane.
Use export-file archaeology only for debug, distribution, or historical comparison.

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

Repo-local npm extraction wrappers:

- preferred alias: `npm run extract:build`
  - restores and rebuilds `tools/unity/CifiAssetProbe/bin/probe-run` from committed repo state
  - keeps `.dotnet`, `.nuget/packages`, and `.appdata` inside the repo
  - requires local `.NET 8 SDK`; the first restore also needs NuGet network access unless the repo-local package cache is already warm
- preferred alias: `npm run extract:uabea`
  - rebuilds and runs `tools/unity/CifiAssetProbe`
  - keeps `.dotnet`, `.nuget/packages`, and `.appdata` inside the repo
  - if the runnable probe artifact is missing, the wrapper restores and rebuilds it automatically
  - if `Program.cs`, `CifiAssetProbe.csproj`, or `NuGet.Config` is newer than `bin/probe-run/CifiAssetProbe.dll`, the wrapper fails fast and tells you to run `npm run extract:build`
- historical shard probe wrappers have been removed from the supported npm surface
  - treat the old shard probe scripts as archive/debug artifacts only
  - the live shard lane should prefer `data/system-units/shards.v1.json`, DB-backed shard formula materialization, `data/shard-save-boundary.v2.json`, and DB-backed trace materialization
- preferred alias: `npm run extract:trace -- --query <query> --anchor <anchor>`
  - or pin an exact preset with `npm run extract:trace -- --target <target-id> --anchor <anchor>`
  - persists DB-backed trace state first; add `--export` only when you want derived `workbench/trace-runs/` outputs
  - those DB-backed target bundles are then projected into `data/system-units/trace.v1.json` and the other `data/system-units/*.json` read models by `node scripts/contracts/generate-system-units.mjs`
  - default operator path is planner/query -> DB/cache/evidence -> reducer/materializer views; exported files are debug/distribution outputs, not the active owner path
  - reads the DB/bootstrap request catalog first and treats the archived target registry only as historical compatibility provenance
  - resolves loose Codex-first queries through DB-owned subject/family coverage, expands them into family-aware anchors and semantic terms, then chooses one bounded trace scope or flat exploration
  - reads committed `workbench/apk/base/global-metadata.dat`, `workbench/unity/joined/level0`, `workbench/unity/joined/sharedassets0.assets`, direct extractor-backed support datasets, and the persistent Ghidra project when native behavior is needed
  - preserves target-driven cross-surface joins across metadata neighborhoods, owner-payload shells, direct Unity extraction, bounded blocker datasets, and nearby prefab or title surfaces in one checked bundle before any promotion
  - records explicit typed proved edges, negative edges, provenance-strength tags, and one solved-vs-blocked comparison shape from committed sources so the bundle can say which join exists, which join is missing, and which artifact proved each claim
  - emits a compact planner decision note plus a summary verdict such as `wire`, `quarantine`, or `keep researching` so Codex can read the bundle without manually reinterpreting the full graph first
  - current seeded trace families: `token-shop`, `shard-cost`, `shard-owned-state`, and `multiverse-market-save-owner`
  - the current committed token-shop planner path treats `token-shop-atu3-cells-effect` as the canonical ATU3 lane instead of the older negative split-row target
  - `token-shop-family-structure` now recovers its solved-shell structure from `data/archive/token-shop-values.json` plus DB-derived token-shop row scopes and the ATU3 materialized target, rather than from `data/token-shop-row-remap-boundary.json`
  - `token-shop-atu3-cells-effect` now recovers its shell adjacency and parameter surface from `data/archive/token-shop-values.json`, its effect/title/text surfaces from direct metadata and `level0`, and its remaining typed-owner gap from DB materialized ATU3 consumer lanes rather than from `data/token-shop-row-remap-boundary.json`
  - `token-shop-atu3-chest-consumer` now recovers its consumer-family, chest-routine, chest-object, and bonus-shell structure from direct metadata and `level0`, while using the DB materialized `token-shop-atu3-chest-consumer-read` target only for the still-missing exact CellBoostBonus read-site seam
  - `token-shop-atu3-chest-consumer-read` now recovers its getter and booster-bonus shell directly from metadata and uses the DB materialized `token-shop-atu3-chest-consumer` target only as the bounded negative comparator, so `data/token-shop-row-remap-boundary.json` no longer feeds either active ATU3 consumer trace scope
  - `token-shop-atu5-mk1-title` now recovers its shell bridge and blocked title-side comparison from direct extract, metadata, and `level0` evidence plus the DB-derived `row:ATU3Button` scope and `token-shop-atu3-cells-effect` materialization, so `data/token-shop-row-remap-boundary.json` no longer feeds that active trace scope
  - `token-shop-family-structure` now recovers its late unresolved shell/title contrast from direct `token-shop-values` fields, direct `level0` hits, and DB materialized ATU3 state, so `data/token-shop-late-atu-boundary.json` no longer feeds that active trace scope
  - shard owned-state bridge verdicts now live in the reducer-owned canonical semantic scope `semantic_scope_fragment:shard-owned-state:upgradeinfolist-population`, and the DB materialized shard target bundle exposes that canonical `bridgeAssessment` / `outcome` payload instead of relying on bundle-authored verdict logic
- active trace builders no longer read registry `strategyConfig` directly; builder support fields and surface seeds are now loaded through DB bootstrap helpers, and SQLite bootstrap no longer falls back to the registry file for active lanes
- `db:derived:token-shop-values` now owns the active TokenShop extract core used by the trace and spend lanes. [`data/archive/token-shop-values.json`](data/archive/token-shop-values.json) is only the archived snapshot of that extract shape.
- free-text trace resolution now asks SQLite for canonical subject candidates first; the bundle no longer rebuilds that candidate catalog itself, and the old token-shop ATU4 updater/display override has been folded into generic DB semantic-scope resolution
- explicit family selection now asks SQLite for a canonical family subject first; when no DB family subject exists the trace degrades to flat exploration instead of falling back to a registry `defaultTargetId`
- token-shop now also has a reducer-owned canonical `family_graph_fragment` (`family-graph:token-shop`), and both free-text `Token Shop` resolution and explicit `--family token-shop` use that DB family subject instead of starting from the old target-id catalog
- shard-cost, shard-owned-state, and multiverse-market/save-owner now also expose reducer-owned canonical family subjects (`family-graph:shard-cost`, `family-graph:shard-owned-state`, `family-graph:multiverse-market-save-owner`), so family-level free-text resolution no longer starts from `defaultTargetId` for the active trace families
- once a DB subject resolves to a concrete trace scope, live source selection now prefers the DB-owned `sourceFamilies` projection from the latest materialized target bundle for that scope; registry `sourceFamilies` remain compatibility fallback only when no DB projection exists yet
- best-gap anchor planning also no longer reloads registry `strategyConfig.surfaces`; it now relies on canonical semantic-scope terms, DB-native family/row subjects, and native summary terms
- active family execution planning now also has a DB-owned lane:
  - canonical `execution_plan_fragment` keyed as `target-execution-plan:<trace-scope>`
  - current token-shop, shard-cost, shard-owned-state, and multiverse active scopes now derive `joinGoal`, `claimStages`, and `depthPlan` from canonical planning fragments during execution when available
  - registry `depthPlan` / `claimStages` are now compatibility fallback only for scopes that do not yet have a canonical execution-plan fragment
- `node scripts/contracts/generate-system-units.mjs`
  - reads canonical repo inputs plus DB-backed `materialized_target_bundle_views`
  - writes `data/system-units/*.json` only as exported app/browser read models
  - also persists matching `materialized_system_unit_views` in SQLite so app-facing system units are not a parallel file-first truth path
- default lane decision rule:
  - if a target does not emit the expected DB-backed semantic or materialized artifact, the next move is probe/tool/materializer realignment before widening to adjacent families
  - long native or Ghidra-backed trace runs are expected while cacheable parsing or semantic reduction is still converging; duration alone is not evidence of a stall
  - treat the missing artifact itself as the blocker until the path emits it or shrinks to one named instrument seam
- `python scripts/unity/ghidra_headless.py invalidate`
  - supports evidence invalidation with `--script`
  - supports trace-fragment-only invalidation with `--trace-scope`, `--trace-fragment`, `--trace-fragment-key`, `--trace-script`, and `--trace-request-signature`
  - prefer the `--trace-*` flags when cleaning up DB-backed trace/materialized rows so evidence rows are not invalidated accidentally

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
5. Start from `npm run extract:trace` with a query, family, best-gap, or explicit target so the planner resolves the bounded subject first.
6. Let the trace path recover or reuse DB/cache/evidence, then check whether the expected semantic or materialized artifact was emitted.
7. Run `node scripts/contracts/generate-system-units.mjs` only after DB-backed trace/materializer state is in place or needs to be reprojected into read models.
8. Use raw metadata, `level0`, object-header scans, or serialized payload parsing as instrument-level support work inside that trace/materializer path, not as the default export-archaeology fallback.

## Long-run expectations

While cacheable parsing, native summaries, or Ghidra-backed reduction are still converging, long trace runs are expected.

Do not assume a long run is stalled only because it is long.
Treat it as a workflow blocker only when the expected DB/materialized artifact does not appear.

When that happens, the next step is:

1. inspect the probe/tool/materializer seam
2. fix the narrowest named instrument issue
3. rerun the same target

Only after that path is realigned should adjacent families or broader searches become the default next move.

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
- Active extract owner: `db:derived:token-shop-values` via `scripts/contracts/generate-system-units.mjs`
- Outputs:
  - [`docs/systems/spend/token-shop-values.md`](docs/systems/spend/token-shop-values.md)
  - [`data/archive/token-shop-values.json`](data/archive/token-shop-values.json)

### Chrystos Emporium

- Scene/UI shell names include `ChrystosEmperium.Shop`, but the mechanics owner is `MultiverseMarket` on GameObject `Inscryptions`
- Proven owner byte start: `33216256` in [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
- Active extract owner: `db:derived:multiverse-market-values` via `scripts/contracts/generate-system-units.mjs`
- Outputs:
  - [`docs/systems/spend/multiverse-market-values.md`](docs/systems/spend/multiverse-market-values.md)
  - [`data/archive/multiverse-market-values.json`](data/archive/multiverse-market-values.json)

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
   - `node scripts/contracts/generate-system-units.mjs`
   - `npm run extract:build`
   - `npm run extract:uabea`
   - shard probe-era wrappers are no longer part of the supported npm extraction surface
4. inspect the grounded outputs in `docs/` and `data/`
5. continue by targeting the next unresolved owner object, not by returning to broad string scraping

Recommended next unresolved extraction target after PR2:

- the exact serialized shard milestone row or save-side state behind the narrowed `ShardMining` / `ShardUpgradeInfo` trail

The current repo-local candidate ranking for that step is recorded in:

- [`docs/systems/shards/shard-extraction-candidates.md`](docs/systems/shards/shard-extraction-candidates.md)
- extraction-candidate ranking has been retired from the supported DB-first tooling surface

## Portability Notes

- `scripts/unity/uabea_probe.ps1` resolves the repo root from its own path and is clone-location agnostic.
- `scripts/unity/run_extract.mjs` is the primary npm entry point for extraction/materialization wrappers and keeps `.dotnet`, `.nuget`, and `.appdata` repo-local before invoking `dotnet`.
- `npm run extract:build` is the minimal reproducible rebuild path for the runnable probe artifact from repo state.
- The old token-shop and multiverse parser scripts have been removed; their raw extraction logic now lives directly in `scripts/contracts/generate-system-units.mjs`.
- The npm wrappers are path-portable, but they are not dependency-free: they still require local `dotnet`, Python, restored LFS assets, and the committed `.vendor_manual` libraries for the native shard probe.
- The first `npm run extract:build` on a machine may need outbound access to `api.nuget.org` to populate the repo-local `.nuget/packages` cache before later rebuilds can stay repo-local.
- The `.NET` wrapper no longer silently reuses a stale cached build. It only reuses `tools/unity/CifiAssetProbe/bin/probe-run` when the checked runnable artifact is newer than the local probe source inputs.
- On Windows, the wrapper accepts either `python` or `py -3`. On macOS/Linux, it looks for `python3` first and falls back to `python`.
- The current wrappers assume a shell environment that can execute `node`, `dotnet`, and Python from `PATH`; they do not bootstrap those toolchains for a fresh machine.
- `data/archive/uabea-extract-report.json` and `data/archive/unity-apk-extract-report.json` should be treated as raw extraction exports or historical provenance inputs, not as default active support surfaces.
- `data/system-units/*.json`, `workbench/trace-runs/*`, and other exported snapshots should also be treated as read-model, distribution, or debug surfaces; active extraction truth should come from DB-backed evidence, semantic fragments, materialized target bundles, and materialized system views first.
- When only typed LibCpp2IL tables are needed from the UABEA export, prefer `data/uabea-type-metadata-support.v1.json`.
- `shard-owned-state:upgradeinfolist-population` semantic scope is now reducer-owned in SQLite. It is refreshed during `rebuild_trace_views()` from persisted shard trace fragments rather than being a hand-maintained DB insert path.
- token-shop row semantic scopes such as `row:ATU4Button` are also reducer-owned in SQLite. `unity_trace_bundle.py` still assembles row recovery inputs during a trace run, but canonical row semantic scopes are refreshed during `rebuild_trace_views()` instead of being inserted directly by the bundle.
- `multiverse-market-save-owner-boundary` no longer consumes `data/multiverse-market-market-member-boundary.json` during active trace reconstruction. Its typed-field-negative edge now renders from direct metadata-side accessor and SaveData span recovery, while the remaining save-data import and ordered-overlap boundaries stay explicit.
- `multiverse-market-save-owner-boundary` also no longer consumes `data/multiverse-market-range-boundary.json` during active trace reconstruction. The 71-74 ordered-overlap support now renders from direct metadata-side `IS71-74` and `SetIS71-74CostText` hits plus `level0` `BuyIS71-74` hits, leaving only the save-data import boundary explicit in the active multiverse lane.
- `multiverse-market-save-owner-boundary` no longer consumes `data/multiverse-market-savedata-import-boundary.json` during active trace reconstruction either. The compatibility import target, canonical-import-empty label, and broader row-remap blocker text now come from the trace target registry plus direct metadata/row-side evidence, so the active multiverse lane is down to raw-source hits and the registry.
- `data/archive/unity-trace-target-registry.json` should now be treated as an archived compatibility catalog only, not as a structural truth layer or active planner shell. The decomposition audit is kept only to document what was migrated away from it.
- `token-shop-updater-display:ATU4` is now reducer-owned in SQLite. It derives a DB-backed updater/display semantic scope from the ATU4 evidence cluster (`ATU4Button`, `BuyModBoost`, `SetTokenTexts`, `SetAllTokenShopTexts`, and the `ModBoost*` parameter shell) and is surfaced through the `token-shop-atu4-mod` materialized target bundle.
- Target-level `decisionSummary` is now reducer-owned in SQLite as `assessment_fragment` entries keyed like `target-assessment:<trace-scope>`. The bundle no longer emits its own raw verdict preview; DB-backed materialized target bundles consume the canonical assessment fragment rebuilt from trace state plus target rules, and missing assessment state is surfaced explicitly.
- The assessment reducer no longer falls back to the archived registry when `outputSummaryRules` are missing. Verdict policy must arrive in the target payload; older rows can still preserve their last embedded legacy `decisionSummary` during rebuilds until the trace is rerun.
- `reconstruction_note_fragment` and `progression_fragment` no longer embed copied verdict payloads either. They now carry `assessmentSemanticKey` references back to `target-assessment:<trace-scope>`, so verdict ownership stays single-source in canonical assessment state during rebuilds and exported system-unit views.
- Target-level `groundedConclusion` and `currentBoundary` are now also reducer-owned in SQLite as `target_narrative_fragment` entries keyed like `target-narrative:<trace-scope>`. Live materialized target bundles read canonical narrative state from that fragment, while `reconstruction_note_fragment` now carries only `narrativeSemanticKey` and `assessmentSemanticKey` references plus bridge-side support. Missing canonical narrative is surfaced explicitly instead of being silently recomputed by the bundle.
- Active trace datasets now follow the same owner boundary: active family builders no longer author live `groundedConclusion` / `currentBoundary` prose, the bundle carries only a narrow `narrativeSeed` fallback for reducer ingestion, and the live dataset reads canonical narrative first.
- The generated system-unit trace/token-shop exports now also scrub token-shop row compatibility blobs (`closureStatus`, `literalSchemaRecovery`, `literalTextRecovery`) from nested dependency/scope projections so file-layer read models do not reintroduce stale row-recovery structure after DB rebuilds.
- `shard-owned-state-upgradeinfolist-population` and `multiverse-market-save-owner-boundary` now also read `bridgeCheck` and `solvedVsBlockedDiff` from reducer-owned `bridge_comparison_fragment` entries keyed like `target-bridge-comparison:<trace-scope>`. For those slices, the bundle persists only a `bridgeComparisonSeed` and reference key; `reconstruction_note_fragment` keeps `bridgeComparisonSemanticKey` instead of carrying live bridge/comparison prose.
- Token-shop compare builders remain presentation/fallback inspection surfaces. They are not canonical semantic owners, and registry `comparisonPresetId` remains preset/UI framing rather than comparison truth.
- Token-shop planner resolution is now trace-first even when old compare-era query terms match. `comparisonPresetId` remains legacy framing metadata only and no longer shapes active token-shop structured runs.
- The active family registry is now aligned to that behavior: `token-shop`, `shard-cost`, `shard-owned-state`, and `multiverse-market-save-owner` all use `defaultRunMode = trace` and empty `compareTerms`, so old compare-era steering no longer sits in the active planner catalog.
- Family-level `defaultTargetId` pointers have now been nulled as well. Active DB-first family resolution no longer carries a dead fallback target id in the registry.
- The old compare preset catalog has now been emptied as well: target `comparisonPresetId` values are `null` and `comparisonPresets` is an empty compatibility object.
- Live trace payloads also no longer re-emit registry `comparisonPresetId`, `followUpSurfaces`, or target-local `strategyConfig` plan fields as active execution shaping; canonical execution-plan/context fragments own those surfaces now.
- Token-shop row follow-up now stays row-local by default. `unity_trace_bundle.py` no longer seeds token-shop literal-schema recovery from a hardcoded generic schema-term bag, and token-shop code-path/schema native lookups now run with `familyHint=token-shop` so broad token-bank or callback neighborhoods do not get promoted into row-local DB summaries.
- Free-text trace resolution is now DB-first. `unity_trace_bundle.py` resolves user queries against DB-backed materialized target bundles and canonical semantic scopes before any legacy registry family routing, and if the DB cannot resolve a request it falls straight to flat cross-source exploration instead of a registry family scorer.
- Token-shop reconstruction fragments are now reducer-owned from canonical row scope, UI-binding, owner-controller, formula, and runtime fragments. They no longer derive shell/status structure from `system_scope_fragment` or `closureStatus`.
- Token-shop row semantic scopes now derive `rowLocalGraph` and `missingSeams` in SQLite. `closureStatus` remains only as a compatibility projection from that reducer-owned row graph state.
- The remaining token-shop literal compatibility layer is now narrower: persisted DB/export views keep a compact `literalRecoverySummary`, while the bulky raw `literalSchemaRecovery` / `literalTextRecovery` blobs only survive on the in-memory live builder path.
- Free-text DB reconstruction no longer depends on `materialized_target_bundle_views`. Resolution now ranks canonical semantic fragments/scopes first, with materialized target bundles treated as export/system-view projections only.
- Planner resolution now emits DB-native subject identity (`selectedSubjectKind` / `selectedSubjectKey`) while legacy target ids remain internal compatibility bookkeeping only.
- Execution now dispatches from DB subject kind first (`family-graph`, `semantic-scope`, `reconstruction-fragment`, `flat-explore`) and only keeps the old target id as compatibility metadata for builders and exports.
- The old target-strategy dispatch router is gone from `unity_trace_bundle.py`; live execution now enters through subject-kind dispatch only.
- Reconstruction-fragment dispatch for token-shop no longer needs registry `strategy` to choose the builder; the DB trace scope now maps directly and the registry only survives there as incidental compatibility metadata.
- Shard-cost, shard-owned-state, and multiverse save-owner builders now follow the same DB-first reuse pattern for primary `shellWindow` / `surfaces` and `traceGraph`: canonical `surface_plan_fragment` and `graph_plan_fragment` are consumed first, with local builder assembly kept only as fallback bootstrap when no canonical plan exists yet.
- Active trace runs now also derive their execution/render context from canonical `execution_context_fragment` state keyed like `target-execution-context:<trace-scope>`. Labels, family metadata, accepted anchors, join goals, solved/block ids, and summary-rule policy no longer need to come only from the compatibility target envelope once a scope has been materialized in SQLite.
- The DB now also owns the bootstrap path for `joinGoal` and `outputSummaryRules` on active scopes: if no canonical execution-context fragment exists yet, `unity_trace_bundle.py` asks SQLite for a synthesized execution context based on the resolved subject/trace scope instead of reading those policy fields directly from the registry target payload.
- Active support-context reads no longer fall back to target-local `strategyConfig` for the migrated trace scopes. Builder shell/support fields now come from DB/bootstrap support context only, with the registry target object left as explicit legacy metadata.
- Operator-facing trace output now treats DB subject identity plus `executionTraceScope` as the run identity. Compatibility-target carriage has been removed from the normal live path.
- Execution dispatch no longer uses legacy target-strategy names as the bridge between DB subjects and builders. Active lanes now resolve to subject-derived execution routines, with compatibility target ids left as outward compatibility metadata only.
- Token-shop row compatibility blobs are no longer the active status owner: row/runtime status and threshold-runtime seams now read graph-native `missingSeams` / `rowLocalGraph` projections first, while `closureStatus`, `literalSchemaRecovery`, and `literalTextRecovery` remain compatibility carriage only.
- The normal live trace dataset no longer emits top-level `closureStatus`, and current DB-backed target-bundle projections no longer restore one either. Compatibility status now survives only inside `rowRecovery` while the remaining builder-internal cleanup is completed.
- Canonical trace rebuild now also normalizes legacy `rowRecovery` payloads, so older valid trace rows do not reintroduce top-level `closureStatus` or bulky literal recovery blobs into current DB-backed materializations even before every lane is rerun.
- Rebuild-time maintenance now normalizes the live raw `trace_fragments.rowRecovery` payloads in place too, so the active raw fragment layer converges on the compact DB-first shape instead of leaving old compatibility blobs live indefinitely.
- Rebuild-time maintenance now also invalidates dead raw `closureStatus` fragments and rewrites live raw `traceRegistry` fragments to remove target-id and compare-era compatibility carriage, so the raw trace layer no longer rehydrates those legacy fields into current views.
- New trace runs no longer persist `system_scope_fragment`; that fragment is now legacy-compat only for rebuilding older rows.
- Normal request planning now uses a DB/bootstrap catalog only. Explicit `--target` is treated as a DB trace-scope selector, not a probe-era registry mode.
- The registry file is no longer part of the normal trace request path.
- See [unity-trace-lane-dependency-audit.md](unity-trace-lane-dependency-audit.md) for the current owner map of remaining bridge, comparison, registry, and export-time dependencies.

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




