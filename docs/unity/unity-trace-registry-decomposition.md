# Unity Trace Registry Decomposition

## Purpose

This audit breaks the archived `data/archive/unity-trace-target-registry.json` file into responsibility buckets now that DB-backed canonical/materialized trace state owns the live reconstruction work.

The strict rule is:

- if SQLite-backed evidence or materialized target state can derive it, it should not stay as registry calibration
- if it is only stable identity, display naming, or explicit preset/policy metadata, it may remain

Operator rule:

- the default execution path is planner/query selection -> DB/cache/evidence -> reducer/materializer views
- exported files and archived registries are debug, distribution, or compatibility surfaces unless a lane explicitly says otherwise
- if a target does not yield the expected DB/materialized artifact, fix the probe/tool/materializer path before widening into adjacent families

## Responsibility Buckets

### 1. Source-family declarations

- Registry fields:
  - `sourceFamilies.*.sourceIds`
  - `targets.*.requiredSourceFamilies`
- Classification:
  - `THIN DECLARATIVE METADATA`
- Why kept:
  - These are orchestration inputs for which raw source families a run is allowed to touch.
  - The DB stores recovered evidence, not the allowed search perimeter for a new trace request.
- Current consumers:
  - `resolve_source_catalog(...)`
  - run payload export under `traceRegistry`

### 2. Stable target and family identity

- Registry fields:
  - `planner.familyOrder`
  - `planner.families.*.label`
  - `planner.families.*.defaultTargetId`
  - `targets.*.label`
  - `targets.*.familyId`
  - `targets.*.strategy`
  - `targets.*.acceptedAnchors`
  - `targets.*.defaultAnchors`
- Classification:
  - mixed:
    - labels / accepted anchors / default anchors: `THIN DECLARATIVE METADATA`
    - `planner.families.*.defaultTargetId`: `LEGACY-COMPAT`
- Why kept:
  - These define stable target ids, labels, and accepted request shapes.
  - DB state is keyed by trace scope and request signature, but it does not define the externally callable trace catalog.
  - `defaultTargetId` is no longer used by normal DB-first family resolution for active lanes and is now `null` for the active families; the old target catalog survives only as explicit compatibility/debug metadata.

### 3. Planner matching and anchor expansion

- Registry fields:
  - `planner.families.*.queryTerms`
  - `planner.families.*.anchorExpansionTerms`
  - `planner.families.*.directTraceTerms`
  - `planner.families.*.compareTerms`
  - `planner.families.*.synonymSets`
  - `planner.families.*.defaultRunMode`
- Classification:
  - `POLICY/FALLBACK HINT`
- Why not DB-native yet:
  - This is still hand-authored calibration for matching free-text requests to families and choosing `trace` vs `compare`.
  - The DB can tell us what evidence exists for a target, but it does not yet own request-to-family routing or next-best target selection.
- Migration direction:
  - move family scoring and target suggestions toward DB-backed planner signals derived from materialized target bundles and canonical semantic coverage
  - keep registry terms only as fallback aliases once DB-native routing exists

### 4. Solved-vs-blocked compare metadata

- Registry fields:
  - `targets.*.solvedBaselineTargetId`
  - `targets.*.blockedTargetId`
  - `targets.*.comparisonPresetId`
  - `comparisonPresets.*`
- Classification:
  - `LEGACY-COMPAT`
- Why kept:
  - These do not decide truth reconstruction.
  - They survive only as compatibility/presentation framing for older compare-era inspection surfaces.
- Current recalibration:
  - Token-shop compare presets are now explicitly legacy framing only.
  - The planner no longer emits active `runMode=compare` or active compare-preset shaping for token-shop targets.
  - The active family registry no longer carries compare-era planner steering: `token-shop`, `shard-cost`, `shard-owned-state`, and `multiverse-market-save-owner` now all use `defaultRunMode = trace` and empty `compareTerms`.
  - `targets.*.comparisonPresetId` and `comparisonPresets.*` are now fully inert compatibility metadata: target ids are `null`, `comparisonPresets` is empty, and the live trace payload no longer emits them as active planner or execution shaping.
  - Those registry fields remain only as optional review/UI metadata until a broader decision is made about whether token-shop comparison presentation should survive at all.
- Constraint:
  - They should not be used to choose canonical structure or to backfill missing evidence.

### 5. Strategy config

- Registry fields:
  - `targets.*.strategyConfig`
- Classification:
  - mixed:
    - structural anchor constants: `THIN DECLARATIVE METADATA`
    - search-depth/follow-up hints: `POLICY/FALLBACK HINT`
    - compatibility labels and blocked-structure notes: `POLICY/FALLBACK HINT`
- Why partly kept:
  - The bundle strategies still need stable target-local seeds such as shell ids, anchor families, and explicit compatibility labels.
  - Recent cleanup moved old boundary-authored compatibility labels into this bucket for the multiverse lane. That is better than keeping stale support JSONs live, but it is still pre-DB scaffolding.
- Migration direction:
  - move target-local verdicts, blocked structures, and “what remains missing” narration into reducer-owned semantic/materialized state
  - move active execution planning into reducer-owned `execution_plan_fragment` state and leave registry `depthPlan` / `claimStages` as compatibility fallback only
  - keep only the minimum target-local invocation/config shell here

### 6. Join goals and output summary rules

- Registry fields:
  - `targets.*.joinGoal`
  - `targets.*.outputSummaryRules`
- Classification:
  - `POLICY/FALLBACK HINT`
- Why not DB-native yet:
  - These fields still drive bundle-authored summary and verdict thresholds.
  - They are workflow policy, not extracted evidence.
- Migration direction:
  - move lane verdict thresholds and summary policy into reducer-owned target assessment state or a smaller explicit policy layer outside the main target registry

## Obsolete Buckets Removed

The following planner fields were no longer consumed anywhere and were removed from the registry:

- `planner.resolutionVersion`
- `planner.boundedRunModes`
- `planner.resolutionOrder`

These were historical calibration metadata from the pre-DB phase. They did not drive current planner or DB behavior.

## Remaining Registry Role

After this audit, the justified remaining registry role is:

- stable target/family catalog
- bounded source-family allowlists
- request/planner fallback aliases
- optional compare-mode preset metadata
- temporary strategy/policy hints that have not yet moved into DB-owned planner or semantic state

It should no longer be treated as a place to store live structural truth.
It should also no longer be treated as the default archaeology path when a DB-backed target, semantic scope, or materialized view already exists.

## Remaining DB-Driven Resolution Work

The main remaining work to reduce registry burden further is:

1. DB-backed family/target routing
   - free-text trace routing now resolves from DB-backed materialized target bundles and canonical semantic scopes first; registry `queryTerms`/`synonymSets` are no longer the fallback path for free-text runs

2. DB-backed compare selection
   - derive solved-vs-blocked relationships from materialized target bundle coverage rather than only registry pairing

3. Reducer-owned target verdict policy
   - move `outputSummaryRules` and remaining compatibility/blocker narration into canonical semantic/materialized target assessment state

4. Strategy-config thinning
   - strip builder-local blocked-structure text and compatibility labels out of `strategyConfig` once the DB owns those conclusions

## First DB-backed Routing Slice

The first live routing burden moved off static registry hints is the token-shop updater/display ATU4 lane.

- DB-owned source:
  - `semantic_scope_fragment: token-shop-updater-display:ATU4`
- Current behavior:
  - planner inputs such as `SetTokenTexts`, `BuyModBoost`, and `ModBoostBonus` now resolve through that semantic scope to `token-shop-atu4-mod`
- Registry impact:
  - token-shop updater/display aliases in family-level `queryTerms`, `anchorExpansionTerms`, and `synonymSets` are now fallback-only for this lane rather than the primary routing path
