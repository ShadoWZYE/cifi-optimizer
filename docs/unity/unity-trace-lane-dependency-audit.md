# Unity Trace Lane Dependency Audit

## Purpose

This audit maps the remaining live semantic dependencies in the trace lane after verdict and narrative ownership moved into reducer-owned canonical state.

Scope:

- [scripts/unity/unity_trace_bundle.py](../../scripts/unity/unity_trace_bundle.py)
- [scripts/unity/ghidra_cache_db.py](../../scripts/unity/ghidra_cache_db.py)
- [scripts/contracts/generate-system-units.mjs](../../scripts/contracts/generate-system-units.mjs)
- archived [data/archive/unity-trace-target-registry.json](../../data/archive/unity-trace-target-registry.json)

Classification:

- `canonical-owner`: active canonical owner of semantic meaning
- `fallback-only`: temporary fallback or orchestration hint; should not be treated as canonical truth
- `legacy-compat`: compatibility/export carryover retained for old rows or user-facing continuity
- `stale/removable`: no longer justified as a live dependency

Default workflow policy for this lane:

1. planner or query resolves the bounded target
2. DB/cache/evidence is recovered or reused
3. reducer/materializer emits canonical semantic or materialized state
4. exports are regenerated only as snapshots or read models

If step 3 does not happen, the next move is probe/tool/materializer realignment before widening into adjacent families.
Long native or Ghidra-backed runs are expected while cacheable parsing and reduction are still converging, so runtime length alone should not be treated as a stall signal.

## Live Dependency Inventory

### 1. Verdict policy and assessment

- Owner:
  - `assessment_fragment` in SQLite, derived in `ghidra_cache_db.py`
- Current live dependencies:
  - `target.outputSummaryRules` carried in bundle payload
  - `traceGraph.edges`
  - `traceGraph.negativeEdges`
  - `solvedVsBlockedDiff.delta.blockedMissingEdgeTypes`
  - `nativeReconstruction.promoted*`
  - legacy embedded `payload.decisionSummary` on pre-cleanup rows
- Classification:
  - `assessment_fragment`: `canonical-owner`
  - `target.outputSummaryRules`: `fallback-only`
  - legacy embedded `payload.decisionSummary`: `legacy-compat`
  - registry reload fallback for missing `outputSummaryRules`: `stale/removable`
- Notes:
  - Verdict state is now DB-owned.
  - The registry dependence in this lane was the reducer fallback that reloaded `outputSummaryRules` from the registry when the bundle payload omitted them. That fallback is now removed.
  - Older rows without embedded policy still preserve their last embedded decision summary as compatibility input until those targets are rerun.

### 2. Narrative state

- Owner:
  - `target_narrative_fragment` in SQLite, derived in `ghidra_cache_db.py`
- Current live dependencies:
  - `dataset.narrativeSeed`
  - legacy `reconstruction_note_fragment.rawPayload`
- Classification:
  - `target_narrative_fragment`: `canonical-owner`
  - `narrativeSeed`: `fallback-only`
  - `reconstruction_note_fragment.rawPayload` narrative fallback: `legacy-compat`
- Notes:
  - Live bundles no longer own `groundedConclusion` or `currentBoundary`.
  - Canonical narrative is reducer-owned, but the reducer still accepts a narrow seed path from bundle output and older reconstruction-note rows.

### 3. Bridge check state

- Owner today:
  - mixed:
    - reducer-owned for `shard-owned-state-upgradeinfolist-population`
    - reducer-owned for `multiverse-market-save-owner-boundary`
    - bundle-authored elsewhere
- Current live dependencies:
  - `bridgeCheck.result`
  - `bridgeCheck.bridgeCleared`
  - `bridgeCheck.bridgeHits`
  - target-specific `bridgePromotionRule`
- Classification:
  - shard owned-state / multiverse save-owner `bridgeCheck`: `canonical-owner`
  - all remaining bundle-authored `bridgeCheck`: `fallback-only`
  - `bridgePromotionRule`: `fallback-only`
- Notes:
  - `target-bridge-comparison:<trace-scope>` is now the canonical owner for the shard owned-state and multiverse save-owner bridge/comparison lane.
  - The bundle persists only `bridgeComparisonSeed` for those slices and references the canonical fragment by semantic key.
  - This is still one of the largest remaining bundle-authored semantic surfaces outside those migrated slices.
  - It still carries meaningful lane-specific interpretation and user-facing phrasing.
  - Migrating it cleanly would require a broader bridge-semantics model, not a narrow cleanup.

### 4. Comparison prose and solved-vs-blocked builders

- Owner today:
  - mixed:
    - reducer-owned for `shard-owned-state-upgradeinfolist-population`
    - reducer-owned for `multiverse-market-save-owner-boundary`
    - still authored in `unity_trace_bundle.py` elsewhere
- Current live dependencies:
  - `solvedVsBlockedDiff.baseline.groundedConclusion`
  - `solvedVsBlockedDiff.blockedTarget.groundedConclusion`
  - `solvedVsBlockedDiff.delta.solvedVsBlockedSummary`
  - target-local compare builders and comparison prose helpers
  - registry `comparisonPresetId` / `comparisonPresets`
- Classification:
  - shard owned-state / multiverse save-owner compare payloads: `canonical-owner`
  - token-shop compare payloads and prose builders: `fallback-only`
  - `comparisonPresetId` / `comparisonPresets`: `legacy-compat`
- Notes:
  - `target-bridge-comparison:<trace-scope>` now owns `solvedVsBlockedDiff` for the shard owned-state and multiverse save-owner slices.
  - The attempted `target-comparison:<trace-scope>` migration for narrow token-shop slices was removed. Token-shop compare builders remain presentation/fallback inspection surfaces rather than canonical semantic owners.
  - Registry `comparisonPresetId` / `comparisonPresets` remain preset/UI framing only for token-shop.
  - Remaining compare builders still contribute semantic meaning and user-facing explanation at bundle time.
  - Narrow cleanup is possible only where a comparison helper exists solely to patch old payload shapes.

### 5. Registry strategy/policy shell

- Current live dependencies:
  - `strategyConfig.surfaces`
  - `strategyConfig.followUpSurfaces`
  - `strategyConfig.depthPlan`
  - `strategyConfig.claimStages`
  - `strategyConfig.groundedConclusion`
  - target `joinGoal`
  - target `comparisonPresetId`
  - target `outputSummaryRules`
- Classification:
  - stable invocation config (`surfaces`, shell ids, default anchors): `fallback-only`
  - DB-owned `execution_plan_fragment` for active lanes: `canonical-owner`
  - `groundedConclusion` in registry: `fallback-only`
  - compare presets: `legacy-compat`
  - any registry prose used only to seed bundle-local narrative: `stale/removable` once no longer read
- Notes:
  - The registry is now mostly a planner-policy shell.
  - The largest remaining semantic burden here is not target identity but bundle-side prose/config consumption.
  - Token-shop compare-era steering has now been downgraded further:
    - token-shop planner resolution no longer emits active `runMode=compare`
    - token-shop `comparisonPresetId` no longer flows into active traceRegistry comparison shaping
    - token-shop family registry no longer carries live compare-era planner steering (`defaultRunMode` is `trace`, `compareTerms` is empty)
    - those presets remain legacy UI framing only
  - Active planning state now has a canonical owner path too:
    - `target-execution-plan:<trace-scope>` carries DB-owned `joinGoal`, `claimStages`, and `depthPlan`
    - token-shop, shard-cost, shard-owned-state, and multiverse active scopes now consume that fragment first
    - registry `depthPlan` / `claimStages` remain only as compatibility fallback where no canonical plan exists yet

### 6. Export-time shape patching

- Current live dependencies:
  - DB projection fallbacks in `_build_target_bundle_projection(...)`
- Classification:
  - DB projection fallback from `closureStatus`: `legacy-compat`
  - export-time field patching in `generate-system-units.mjs`: `stale/removable`
- Notes:
  - The exporter no longer needs to patch shallow trace-run fields itself.
  - System-unit export should read the DB-backed target bundle shape directly; any compatibility fallback belongs in the DB projection, not in the exporter.

### 7. Generic explore fallback

- Owner today:
  - bundle-authored in `unity_trace_bundle.py`
- Current live dependencies:
  - generic exploration `groundedConclusion`
  - generic exploration `currentBoundary`
  - generic exploration comparison placeholders
- Classification:
  - `legacy-compat`
- Notes:
  - This lane is intentionally non-canonical and descriptive.
  - It should stay isolated from canonical truth, but it is not the highest-value cleanup seam because it does not feed the bounded target lanes.

## Smallest Next Cleanup Seam

The narrowest high-value stale dependency is:

- remove the assessment reducer fallback that reloads `outputSummaryRules` from the registry when target payloads omit them

Why this was next:

- it still gave the registry live semantic influence over verdict policy
- current bundle payloads already carry `target.outputSummaryRules`
- removing it did not require redesigning bridge semantics or comparison prose
- if rules are missing, canonical assessment now surfaces that explicitly or preserves the last embedded legacy verdict

## Highest-Value Remaining Seam

After the shard, multiverse, and token-shop compare-steering recalibration, the next highest-value seam is the remaining token-shop builder-local prose/config cluster.

Current state:

- token-shop compare semantics are still emitted by bundle-local helpers such as:
  - `build_mod_vs_blocked_diff(...)`
  - `build_mk1_vs_blocked_diff(...)` for seed generation only
  - `build_mk3_vs_blocked_diff(...)` for seed generation only
  - `build_atu3_effect_vs_split_diff(...)`
  - `build_family_structure_diff(...)`
- these still depend on target-local and compare-local prose decisions rather than a unified canonical comparison model
- token-shop `strategyConfig.groundedConclusion`, `joinGoal`, and target-local lost-structure phrasing still shape trace payload prose directly

Why I stopped there:

- the stale compare-run steering cluster is now downgraded to legacy metadata and no longer advertises itself as active execution behavior
- the next cut is no longer planner/run-mode cleanup
- it needs a deliberate decision about what the canonical token-shop comparison model should own versus what remains preset/UI framing

## Not Yet Narrow Enough

These remain important but require broader design work:

- `bridgeCheck` ownership migration
- solved-vs-blocked comparison prose migration
- registry `groundedConclusion` / compare text removal across the whole target catalog

Those are semantic-model changes, not just stale dependency removal.
