# Unity Trace Registry Decomposition

## Purpose

This audit breaks `data/unity-trace-target-registry.json` into responsibility buckets now that DB-backed canonical/materialized trace state owns most live reconstruction work.

The strict rule is:

- if SQLite-backed evidence or materialized target state can derive it, it should not stay as registry calibration
- if it is only stable identity, display naming, or explicit preset/policy metadata, it may remain

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
  - `THIN DECLARATIVE METADATA`
- Why kept:
  - These define stable target ids, labels, and accepted request shapes.
  - DB state is keyed by trace scope and request signature, but it does not define the externally callable trace catalog.

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
  - `OPTIONAL UI/PRESET LAYER`
- Why kept:
  - These do not decide truth reconstruction.
  - They shape compare-mode summaries and bounded solved-vs-blocked framing for human review.
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

## Remaining DB-Driven Resolution Work

The main remaining work to reduce registry burden further is:

1. DB-backed family/target routing
   - replace free-text family scoring from `queryTerms`/`synonymSets` with DB-backed target suggestion and evidence coverage ranking

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
