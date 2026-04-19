# Data Framework

## Purpose

`data/data-framework.v1.json` is the central migration manifest for the repo's data refactor.

It does not replace the existing datasets yet. It classifies them, groups them into future
centralized system units, and records which files are still:

- canonical
- boundary
- model
- support
- historical probe input

The intent is to make later cleanup mechanical:

1. move live reads behind one centralized system unit
2. verify app, trace, and tests consume that unit or an explicit projection of it
3. archive or delete old probe-era files only after the live reads are gone

## Why this exists

The repo currently has:

- app-consumed datasets
- trace-consumed datasets
- reusable boundary/model datasets
- historical probe outputs still living beside them
- a PlayerProfile boundary that still lives mostly in code and docs

Without one central map, cleanup becomes guesswork. The framework manifest gives each file a
declared system destination before anything is removed.

## What the framework contains

### 1. Role definitions

These are the target roles inside centralized units:

- `canonical`
  Grounded or app-consumed truth
- `boundary`
  Explicit blocker or checked negative seam
- `model`
  Reusable evaluator or structured rule model
- `support`
  Shared grounded support that can still power UI or trace summaries
- `historical-probe`
  Only the source material that is still live or still needed during the migration window

### 2. System units

A system unit is the future centralized consumer shape for one coherent in-game system or tooling
surface.

Current units include:

- `shards`
- `player-state`
- `token-shop`
- `multiverse-market`
- `trace`

Each unit records:

- `kind`
  `system` or `tooling`
- `status`
  `active`, `seeded`, or later archive-ready
- `targetDatasets`
  The current seed dataset(s) for that unit
- `subsystems`
  Internal slices such as shard family, shard owned-state, shard cost, or TokenShop token-bank
- `appStatePaths`
  Where the app already consumes that unit, usually as `state.systemUnits.*` plus any explicit
  projection/getter path that turns the unit into a runtime view
- `traceTargets`
  Trace targets that already align with the unit
- `plannerConsumers`
  Code paths already coupled to the system
- `inputs.canonical`, `inputs.boundary`, `inputs.model`, `inputs.support`, `inputs.historicalProbe`
  The current files that feed the unit by role
- `provenance`
  The rule for how embedded centralized data should point back to committed sources or transient
  regeneration commands

### 3. Unit format

The repo now also defines the common replacement-unit shape in:

- `data/data-unit-format.v1.json`

And seeds first unit files in:

- `data/units/shards.v1.json`
- `data/units/player-state.v1.json`
- `data/units/token-shop.v1.json`
- `data/units/multiverse-market.v1.json`
- `data/units/trace.v1.json`

These unit files do not replace the old datasets yet. They are the concrete format targets future
rewrites should move toward.

The final generated unit shape should collapse embedded data into:

- `canonical`
- `boundaries`
- `models`
- `support`
- `traceEvidence`
- `replacementPlan`

The older `sections` shape can survive temporarily as a compatibility mirror while runtime code is
still being rewired, but it is no longer the target end state.

The repo now also starts generating actual centralized system datasets in:

- `data/system-units/player-state.v1.json`
- `data/system-units/token-shop.v1.json`
- `data/system-units/multiverse-market.v1.json`
- `data/system-units/shards.v1.json`
- `data/system-units/trace.v1.json`

Those files embed copied data plus provenance and are the first real step away from inventory-only
unit manifests.

Unit manifests and generated units can now also carry an archive review inside `replacementPlan`.
Use it to distinguish:

- `keep`
  still a distinct model, calibration, or boundary dataset
- `defer`
  not a live consumer input anymore, but archiving it now risks losing provenance or contradiction context
- `archive-candidate`
  safe to move toward archive-only once the listed replacement conditions hold

## How to use it

### Adding a new consolidation step

When you want to replace a probe-era file:

1. identify the system unit it belongs to
2. move the live app/trace/test read to the unit's target dataset or projection
3. once all live reads are gone, remove the file from the unit's active `historicalProbe` view
4. keep it only in the archive plan until you are ready to archive or delete it

### Adding a new extraction family

If a new system does not fit an existing unit:

1. add a new system unit
2. decide whether it is a `system` or `tooling` unit
3. record its seed dataset(s)
4. classify its current inputs by role inside `inputs.*`
5. define the subsystem slices it needs
6. describe the intended app, trace, or planner consumer path

Do not add a new probe file without deciding which system unit it belongs to.

### UI-related data

Do not create a separate `ui` system unit by default.

For this repo, most UI-facing strings, labels, row titles, shells, and display clues are still
part of the underlying mechanic-evidence problem, not an independent presentation contract. That
means they should usually stay embedded inside their owning system unit:

- TokenShop UI clues stay in `token-shop`
- Emporium text and identity surfaces stay in `multiverse-market`
- shard title or effect text surfaces stay in `shards`

Split UI data into its own unit only when all of the following become true:

1. the data is primarily shared presentation metadata rather than mechanic grounding
2. multiple systems consume the same normalized UI structure
3. the unit can stay stable without depending on unresolved probe-era joins
4. moving it out would reduce duplication instead of creating a second source of truth

Until then, prefer:

- system-owned data in `data/system-units/*.v1.json`
- UI-specific projections in code
- small shared support helpers when formatting or display logic is reused

### Generating embedded system units

Run:

- `node scripts/contracts/generate-system-units.mjs`

Current generated outputs:

- `data/system-units/player-state.v1.json`
- `data/system-units/token-shop.v1.json`
- `data/system-units/multiverse-market.v1.json`
- `data/system-units/shards.v1.json`
- `data/system-units/trace.v1.json`

These generated files are meant to embed normalized data for later wiring. They should not become
thin pointer layers back to the old source files.

### Regrounding after centralization

Centralization is not only a file-move exercise. When a system unit or upgraded trace replaces the
older probe basis for a lane, reevaluate the lane's blocker wording and grounded conclusions.

Do a regrounding pass when either of these becomes true:

1. a centralized system unit now carries stronger or broader evidence than the older probe files
2. the trace/native lane now reconstructs owners, methods, fields, or raw values that were missing
   when the blocker note was written

In that case:

- keep the old blocker only if the stronger source still supports it
- rewrite the blocker if the newer source narrows it materially
- move the lane from "unknown owner" to the tighter real blocker when possible
- preserve the old wording only in historical notes, not in live unit or boundary contracts

### Provenance rule inside units

System units are meant to absorb data, not just point back to the old files forever.

That means:

- the centralized unit should eventually embed normalized data directly
- provenance should explain where that embedded data came from
- committed source datasets should be referenced by path
- transient probe-era evidence should record the command that regenerates the report instead of
  turning the transient report into a permanent dependency

Typical provenance records are:

- `dataset`
  A committed JSON source file still used as source material
- `code-contract`
  A code-owned boundary or normalizer contract that still defines the shared shape
- `doc-contract`
  A checked-in document that still defines a bounded contract
- `command`
  The exact command used to regenerate a transient trace or probe output

## Current intended direction

## Current wiring status

### Fully bootstrap-wired

These app bootstrap reads now come from centralized generated units instead of the older per-file
dataset pile:

- `player-state`
- `shards`
- `token-shop`
- `multiverse-market`

In practice, `app.js` now fetches:

- `data/system-units/player-state.v1.json`
- `data/system-units/shards.v1.json`
- `data/system-units/token-shop.v1.json`
- `data/system-units/multiverse-market.v1.json`

plus the remaining shared non-system inputs:

- `data/game-data.snapshot.v1.json`
- `data/bundled-dataset-contract.v1.json`
- `data/ship-optimizer.desmos-baseline.v1.json`
- `data/extraction-candidate-ranking.v1.json`

### Runtime-backed through projections

These lanes now have explicit code projections in:

- `support/system-unit-projections.js`

Current projections:

- `buildPlayerStateSystemView(...)`
- `buildShardSystemView(...)`
- `buildSpendSystemView(...)`

This means the unit-to-runtime mapping is no longer hand-expanded inline in bootstrap.
`app.js` now reads centralized getters instead of dereferencing the compatibility mirrors directly.

### Still in progress

The app now stores:

- `state.systemUnits.playerState`
- `state.systemUnits.shards`
- `state.systemUnits.tokenShop`
- `state.systemUnits.multiverseMarket`

and uses getter-backed runtime projections such as:

- `app.js:getCurrentPlayerStateView`
- `app.js:getCurrentSpendSystemView`
- `app.js:getCurrentShardSystemView`
- `support/system-unit-projections.js`

`state.shardGrounding`, `state.extractedMechanics`, and `state.playerProfileDefaults`
are no longer stored as app state. The app-facing runtime now reads the centralized system-view
getters directly, and any remaining compatibility shaping is confined to targeted support helpers
rather than normal app data flow.

The next refactor slices should keep shrinking the remaining gap:

1. move more support modules to explicit system-unit projections
2. replace compatibility-shaped helper payloads with narrower, named runtime views
3. archive or delete old flat source files only after no live app, trace, planner, or validation
   path still depends on them

### Player state

- `state.playerProfile` should be represented as a centralized `player-state` unit
- canonical, planner-only, external-model, and compatibility import lanes should stay explicit
- the current alias audit is the first data-side projection of that shared boundary

### Shards

- definition-side shard evidence, owned-state blockers, and cost work should converge into the
  same `shards` unit
- those slices should remain separate subsystems inside the unit, not separate top-level data
  products

### TokenShop

- current support and boundary files should converge into `token-shop`
- the app should eventually read a centralized system unit instead of many shell or clue bundles

### Multiverse Market

- owner/save/member boundaries should converge into `multiverse-market`
- support summaries should become projections of that centralized unit

### Trace

- trace remains the extraction orchestration layer
- centralized units are the promotion targets behind trace

## Non-goals

This framework is not:

- a single flattened database file
- a replacement for provenance
- a signal to delete historical files immediately

The repo should still keep canonical, boundary, and model datasets explicit. The framework exists
to tell us how to migrate toward that shape safely while leaving source material recoverable.
