# Shard Cost PR #23 Audit

This note audits the current shard-cost probe outputs and validator coverage, then records a strict done definition for PR `#23`.

It does not loosen any existing shard grounding gate.

## Audited outputs

Current shard-cost evidence is split across these shipped datasets:

- `data/shard-cost-model-boundary.v1.json`
- `data/shard-cost-parameter-probe.v1.json`
- `data/shard-cost-method-probe.v1.json`
- `data/shard-cost-native-probe.v1.json`
- `data/shard-cost-screenshot-calibration.v1.json`
- `data/shard-cost-list-path-probe.v1.json`

Current shard-cost UI and gating copy was also checked in:

- `docs/systems/shards/shard-system-verification.md`
- `docs/systems/shards/shard-cost-screenshot-calibration.md`
- `docs/systems/shards/shard-cost-native-probe.md`
- `docs/contracts/dataset-contracts.md`
- `app.js`

## Audited validators

Current automated checks were audited in:

- `scripts/contracts/validate-datasets.mjs`
- `tests/smoke.mjs`

What those validators currently do:

- enforce presence, shape, and sentinel values for each shard-cost probe dataset
- assert specific recovered anchors such as `get_SU0-29Cost`, `MilestoneCostList`, selected row-local BigDouble field mappings, selected native helper targets, and five screenshot checkpoints
- preserve blocked-use framing that says exact shard costs and planner-safe optimizer outputs are still unresolved

What those validators do not currently do:

- validate one canonical shard-cost formula dataset
- run one deterministic shard-cost evaluator implementation
- compare evaluator output against the known in-game checkpoints automatically
- prove that the repo has converged from evidence artifacts into one accepted formula model

## Audit result

The current shard-cost work is strong evidence, but it is still evidence.

Current status:

- the repo has a grounded parameter shell
- the repo has grounded native getter and helper-path evidence
- the repo has grounded screenshot checkpoints
- the repo does not yet have one versioned formula-model dataset
- the repo does not yet have one deterministic evaluator implementation
- the repo does not yet have automated calibration checks that fail when the accepted evaluator misses known in-game checkpoints

That means formula extraction is not complete yet.

## Strict Done Definition For PR #23

PR `#23` is done only when all of the following are true.

### 1. Single canonical formula-model dataset exists

The repo must ship exactly one versioned shard-cost formula-model dataset as the accepted source of formula truth.

Minimum bar:

- a single dataset file such as `data/shard-cost-formula-model.v1.json`
- versioned dataset id and generated date
- explicit source references back to the probe or boundary artifacts it was derived from
- explicit model scope for row `0` and rows `1-29`
- explicit stage coverage for pre-threshold, `100+`, `200+`, `300+`, and `400+` behavior where applicable
- explicit row-family or row-class mapping when rows share a model
- exact serialized input mapping for every evaluator input it consumes
- explicit unresolved gaps if any shard rows still remain blocked

Not done if:

- formula truth is still spread across multiple probe datasets
- the accepted model only exists in markdown prose
- the accepted model depends on reading raw probe-specific symbolic notes at runtime

### 2. Deterministic evaluator implementation exists

The repo must ship one deterministic evaluator implementation that consumes the canonical formula-model dataset and returns the same result for the same inputs every time.

Minimum bar:

- one checked-in implementation module, separate from descriptive UI copy
- explicit input contract for row id, current level, and all required serialized cost parameters
- explicit handling for row `0` if it remains a special-case lane
- explicit handling for row-family or stage-family branching
- output type and formatting behavior defined clearly enough for tests to assert
- no fallback to hand-written per-row constants outside the canonical formula-model dataset

Not done if:

- the app still only shows symbolic summaries or probe-derived hints
- evaluator logic is duplicated across probes, docs, and UI helpers
- output depends on non-deterministic parsing, manual interpretation, or ad hoc spreadsheet logic

### 3. Automated calibration checks exist and are mandatory

The validator path must automatically calibrate the accepted evaluator against known in-game checkpoints.

Minimum bar:

- `scripts/contracts/validate-datasets.mjs` or a directly invoked test helper loads the canonical formula-model dataset
- automated tests run the evaluator against the known screenshot checkpoints in `data/shard-cost-screenshot-calibration.v1.json`
- tests fail if the evaluator no longer matches the accepted checkpoints
- tests cover at least the currently preserved rows `1`, `9`, `14`, `21`, and `25`
- tests cover more than one threshold band, including at least one checkpoint above `100+` and one above `200+`
- calibration assertions compare numeric value, not only label presence or dataset shape

Not done if:

- checkpoints are still only documented in markdown
- validators still only assert that checkpoint rows exist in JSON
- calibration is done manually by reading logs or screenshots

### 4. Probe artifacts are demoted to evidence, not formula truth

After the canonical model lands, the current probe datasets may remain shipped, but only as supporting evidence and derivation trace.

Minimum bar:

- docs and contracts clearly distinguish evidence artifacts from the accepted formula-model dataset
- validators for the old probe datasets continue to protect grounding evidence
- the accepted evaluator does not require consumers to merge multiple probe files themselves

Not done if:

- downstream code still needs to combine `parameter`, `native`, `method`, `list-path`, and `screenshot` datasets ad hoc to reconstruct cost behavior

### 5. Grounding gates remain unchanged

Completing formula extraction does not by itself unlock broader planner claims.

The existing shard grounding gates still apply:

- no promotion of planner-safe shard optimization unless player-owned shard inputs are recovered strongly enough
- no silent promotion of community-grounded labels or bonus text as extracted game truth
- no claim that save-side shard milestone ownership is solved unless that owner is actually recovered
- no buy-order, ROI, or affordability recommendation from shard costs alone while owner, row, and player-state gates remain unresolved

Not done if:

- PR `#23` uses formula completion as a reason to relax save-owner, row-mapping, or player-state requirements

## Acceptance summary

PR `#23` is done when the repo has:

- one versioned shard-cost formula-model dataset
- one deterministic evaluator implementation that uses that dataset
- automated calibration checks against known in-game checkpoints
- preserved evidence datasets and blocked-use framing
- no relaxed grounding gate anywhere else in shard behavior

Anything less is still probe hardening, not completed formula extraction.
