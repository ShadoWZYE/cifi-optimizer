# Trace + DB Engine V2 Rebuild Plan

## Status

Working plan for a from-scratch V2 of the trace planner and DB engine.

This is not an incremental patch log.
It is the end-to-end execution plan for replacing the current seam-heavy, scope-heavy engine with a typed program-structure reconstruction engine that emits a canonical graph and drives exploration from unresolved structural obligations.

Related current-state docs:

- [DB-Native Reconstruction Framework](db-native-reconstruction-framework.md)
- [Trace / Materializer / Reducer Audit](trace-materializer-reducer-audit.md)
- [Unity Trace Lane Dependency Audit](unity-trace-lane-dependency-audit.md)
- [DB Runtime Endgame Migration](../repo/db-runtime-endgame-migration.md)

## Lane Contract

### User-facing question

How do we make trace selection and DB reconstruction reliably grow grounded mechanic knowledge without manual frontier curation, repeated code edits, false closure, repeated dead retries, or scope-local graph drift?

### Minimum required inputs

- local APK / Unity / managed metadata assets
- local SQLite cache DB
- native trace capability
- reducer/materializer pass over persisted evidence

### Explicit non-blockers

- perfect app parity for every system before the engine exists
- deleting all legacy compatibility tables on day one
- replacing every consumer surface immediately

### Current true blocker

The current engine still treats workflow scopes and seam closure as the primary ontology.

That causes:

- graph truth mixed with workflow state
- scope-local duplication of what should be global graph knowledge
- obligation selection derived from curated seam logic instead of unresolved structure
- repeated nonclosing runs against already-tested anchors
- weak path reconstruction beyond first-hop wiring
- too much planner correctness living in Python caches and patch logic

### Largest coherent adjacent slice

Build a V2 typed-IR + canonical-graph engine beside the current one, prove it on a few systems, then migrate best-gap selection and execution onto it.

### Default next step

Implement the V2 core schema and bootstrap pipeline before adding more logic to the current best-gap stack.

## Executive Summary

The current engine has produced useful pieces:

- DB-backed evidence persistence
- canonical graph edge tables
- typed evidence edges
- central subject projections
- a graph-walk frontier
- DB-owned anchor checks

But the architecture is still wrong for the project goal.

The project needs an engine that:

1. reconstructs a typed program-structure IR from raw evidence
2. emits global game-mechanic truth as a concrete canonical graph from that IR
3. stores run observations separately from canonical truth
4. stores tested anchors/pairs/paths as persistent execution memory
5. derives unresolved structural obligations from IR + graph state
6. selects the next trace question from those obligations
7. treats seam closure only as a downstream projection, not as the planner’s source of truth

V2 should be built as a parallel engine, not as another patch layer on the current planner.

## Audit of Current Engine

## 1. Ontology problem

The current system still mixes three different concepts:

- graph truth
- workflow state
- run history

Examples:

- `canonical_graph_edges` tries to be graph truth
- `subject_state` tries to decide next work
- `knowledge_gaps` and `execution_plan_fragment` try to represent missing structure
- acquisition diagnostics and native trace payloads are used to infer what was already tested

This creates circular reasoning:

- workflow state influences graph selection
- graph selection influences workflow state
- retry logic is inferred from payloads rather than stored as its own model

Result:

- repeated reopening
- false closure
- repeated no-progress runs
- best-gap needing constant hand correction

## 2. Scope problem

Scope still matters too much.

It should only matter for provenance and consumer projections.
It should not be part of the identity of graph truth.

Current failures caused by scope-heavy design:

- same global relation rediscovered in multiple scoped shells
- graph-walk repeated on the same endpoint through different source nodes
- closure judged relative to a scope instead of global graph growth
- repeated need to invalidate scope-local caches

## 3. Missing typed intermediate structure

This is the deepest architectural defect.

The current engine still jumps too quickly from:

- raw trace payloads
- semantic fragments
- UI fragments
- row recovery payloads

into:

- graph edges
- seam guesses
- subject-state projections

What is missing is a first-class typed program-structure IR that explicitly models:

- symbols
- owners
- methods
- fields
- calls
- field reads
- field writes
- returns
- argument passing
- UI bindings
- prefab references
- literal/localized/value sources
- pointer vs container vs value semantics

Without that IR, the graph layer stays too shallow and too observation-shaped.

## 4. Graph depth problem

Current derivation is strongest on first-hop structure:

- shell -> action
- action -> prefab
- field -> getter

It is weaker on chained structure:

- action -> updater
- updater -> text slot
- slot -> localized/literal value source
- owner -> field -> getter -> returned value
- row shell -> concrete controller/update/value chain

Result:

- titles and display values stall
- value and cap derivation stall
- planner can ask a graph question but execution often cannot strengthen the graph

## 5. Execution memory problem

We repeatedly discovered that “tested” state lived in the wrong place.

Observed failure modes:

- exact failed pair suppression only
- endpoint retries through new source nodes
- stale Python caches between repeat iterations
- diagnostics not consistently expressing what was truly tested

This means execution memory was being reconstructed, not owned.

V2 must make execution memory a first-class DB model.

## 6. Performance problem

Current runtime cost is still dominated by broad rebuilds and repeated materialization:

- huge cold catalog loads
- post-run rebuild churn
- large `evidence_graph_edges` / `canonical_graph_edges` rewrites
- too much history/provenance churn relative to durable graph deltas

The engine still behaves like:

- run trace
- rebuild a broad slice of the world

instead of:

- update changed observations
- update changed IR identities
- update changed canonical edge identities
- update affected obligations
- refresh only impacted consumer projections

## 7. Consumer mismatch problem

The app and consumers want:

- exact titles
- update paths
- owner chains
- prefab chains
- value chains
- formulas
- effective caps

The current planner still thinks in terms of:

- seam closure
- family routing
- graph question as a compatibility mode

That is backwards.
Consumer needs should be projections from graph truth, not special-case planner lanes.

## Design Principles for V2

1. Program structure comes first; graph truth is derived from it.
2. Graph truth is global.
3. Scope is provenance, not graph identity.
4. Observations are append/update inputs, not canonical edges.
5. Tested state is persistent and queryable.
6. Obligations are derived from missing structure, not curated seams.
7. Execution asks path questions, not flat endpoint guesses.
8. Progress means graph strengthening, not scoped closure.
9. Consumer views are downstream projections.
10. Incremental rebuild only.
11. Compatibility views are temporary and read-only.

## V2 Architecture

## Layer 1. Raw Evidence Store

Purpose:

- persist raw extracted evidence exactly enough to re-derive structure without rereading all assets

Inputs:

- native trace outputs
- managed graph fragments
- semantic fragments
- UI binding fragments
- surface plan fragments
- row recovery fragments
- static asset metadata

Tables:

- `trace_events_v2`
- `semantic_fragments_v2`
- `ui_binding_fragments_v2`
- `managed_graph_fragments_v2`
- `static_symbol_fragments_v2`
- `native_value_fragments_v2`

Requirements:

- immutable or append-friendly
- fine-grained invalidation markers
- direct provenance links to source run / artifact / asset slice

## Layer 2. Typed Program-Structure IR

Purpose:

- normalize raw evidence into explicit program-structure facts before any canonical graph collapse

This is the key refinement over the earlier graph-first framing.
The graph should not be inferred directly from fuzzy evidence bundles where avoidable.
It should be emitted from a small, typed IR describing:

- symbols
- owners
- methods
- fields
- call edges
- field reads
- field writes
- returns
- argument passing
- prefab references
- UI bindings
- literal/localization/value sources
- pointer/container/value semantics

Tables:

- `structure_ir_nodes_v2`
- `structure_ir_edges_v2`
- `structure_ir_observations_v2`
- `structure_ir_derivations_v2`

Node classes:

- `type`
- `method`
- `field`
- `property`
- `ui-slot`
- `literal`
- `localized-key`
- `prefab`
- `runtime-value`
- `shell`
- `row-identity`

Edge classes:

- `owns-field`
- `owns-method`
- `calls`
- `reads-field`
- `writes-field`
- `returns`
- `passes-as-arg`
- `binds-ui-slot`
- `references-prefab`
- `resolves-literal`
- `resolves-localized-key`
- `pointer-to`
- `value-of`
- `container-of`

Requirements:

- concrete terms where possible
- structural typing before planner use
- enough information to derive the canonical graph without seam logic

## Layer 3. Canonical Graph Store

Purpose:

- hold global concrete mechanic wiring

Tables:

- `graph_nodes_v2`
- `graph_edges_v2`
- `graph_edge_support_v2`

Node identity:

- concrete game term whenever possible
- examples:
  - `ATU24Button`
  - `BuyATU24`
  - `SetTokenTexts`
  - `NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser`
  - `ATU24StartCost`
  - `get_FinalModBoostMaxLevel`

Edge identity:

- `(source_node_id, relation_kind, target_node_id, field_key?)`

No `trace_scope` in edge identity.

Required edge kinds:

- `calls`
- `reads-field`
- `writes-field`
- `owns-field`
- `owns-method`
- `returns-value-from`
- `passes-as-arg`
- `binds-ui-slot`
- `renders-literal`
- `references-prefab`
- `pointer-to`
- `value-of`
- `container-of`
- `serialized-adjacency`
- `shell-to-action`
- `action-to-updater`
- `action-to-prefab`

Each canonical edge needs:

- status: `candidate | exact | negative`
- evidence counts
- last strengthened at
- support diversity
- value semantics

The canonical graph is emitted from the structure IR, not directly from raw payload bundles.

## Layer 4. Observation Store

Purpose:

- record how an edge was observed, contradicted, or upgraded

Tables:

- `graph_edge_observations_v2`
- `node_observations_v2`
- `derivation_observations_v2`

Observation identity should include:

- source evidence fragment
- originating run / extraction context
- provenance scope
- confidence class

Use:

- promote candidate -> exact
- maintain negative evidence
- keep historical trail without duplicating canonical edge identities

## Layer 5. Execution Memory Store

Purpose:

- persist what has already been tested and under what outcome

Tables:

- `graph_anchor_checks_v2`
- `graph_pair_checks_v2`
- `graph_path_checks_v2`
- `execution_attempts_v2`

This is distinct from diagnostics.

It must answer:

- has anchor `X` already been tested in relation class `R`?
- has pair `A -> B` already failed exact verification?
- has path `A -> B -> C` already been attempted?
- what changed since that check?

Fields needed:

- target anchor / pair / path id
- relation class
- check status:
  - `covered`
  - `checked-nonclosing`
  - `contradicted`
  - `cooldown`
- checked count
- last request signature
- last graph version / graph digest
- re-open condition fingerprint

This layer replaces Python cache memory as the owner of tested state.

## Layer 6. Obligation Store

Purpose:

- represent unresolved structural questions directly

Tables:

- `graph_obligations_v2`
- `graph_obligation_support_v2`

Obligation classes:

- missing typed relation between co-evidenced nodes
- missing intermediate bridge between two partly linked nodes
- candidate edge needing verification
- known updater chain with missing value source
- known field/getter with missing return/value owner
- known UI slot with missing producer chain

Examples:

- `ATU25Button` has `shell-to-action`, but no verified `action-to-updater`
- `BuyATU25` has updater cluster, but no concrete title-value producer
- `SU0GrowthExponent` is co-evidenced with `MilestoneCostList`, but no exact relation class exists

Identity:

- obligation should be defined by structure/graph question, not scope

Scope can be attached as supporting provenance or preferred execution context.

## Layer 7. Consumer Projections

Purpose:

- derive app-facing mechanic views

Tables / views:

- `token_shop_projection_v2`
- `shard_projection_v2`
- `multiverse_projection_v2`
- generic `system_view_*_v2`

These should be pure projections from:

- canonical graph
- canonical verified facts
- obligations

They should not be planner-owned state.

## Derivation Engine V2

V2 needs explicit derivation passes.
Each pass should emit IR facts first and canonical graph edges second.

## Pass A. Symbol and ownership derivation

Inputs:

- static metadata
- managed graph fragments
- field/method fragments

Outputs:

- owner -> field
- owner -> method
- method family grouping
- pointer vs value distinctions where available
- IR node typing

## Pass B. Call/dataflow derivation

Inputs:

- native traces
- managed graph
- semantic fragments

Outputs:

- caller -> callee
- action -> updater
- method -> getter
- method -> returned field/value
- arg passing edges
- IR call/dataflow edges

## Pass C. UI binding derivation

Inputs:

- UI binding fragments
- surface plan fragments
- text/update fragments

Outputs:

- updater -> slot
- slot -> literal/localized source
- row shell -> slot/update path
- IR presentation/value-source edges

## Pass D. Prefab/controller derivation

Inputs:

- row recovery
- surface fragments
- native traces

Outputs:

- shell -> action
- action -> prefab
- controller -> updater
- controller -> field/value source
- IR controller/prefab ownership edges

## Pass E. Value/formula derivation

Inputs:

- formula fragments
- getter-family
- runtime table fragments
- exact values observed in native traces

Outputs:

- getter -> field/value
- field -> formula owner
- formula -> displayed/runtime lane
- IR value semantics and formula ownership edges

## Pass F. Obligation generation

Inputs:

- structure IR
- graph edges
- observations
- execution memory

Outputs:

- unresolved graph obligations
- retry eligibility
- preferred next-hop questions

## Best-Gap V2

`--best-gap-v2` should be built on obligations only.

It should not read:

- `subject_state` as primary routing truth
- `knowledge_gaps` as primary missingness truth
- seam registries as the primary exploration model

It should read:

- `graph_obligations_v2`
- `graph_edges_v2`
- `graph_edge_support_v2`
- `structure_ir_nodes_v2`
- `structure_ir_edges_v2`
- `graph_anchor_checks_v2`
- `graph_pair_checks_v2`
- `graph_path_checks_v2`

## Selection unit

One unresolved structure/graph obligation.

## Selection priorities

1. strongest evidence support
2. cheapest discriminating next hop
3. lowest repetition risk
4. highest probability of promoting candidate -> exact
5. highest downstream consumer value

## Execution output

Planner should emit:

- concrete source node
- concrete target node
- known bridge path, if any
- missing relation class
- preferred execution context
- expected strengthening condition

## Progress criteria

Progress only if:

- canonical edge promoted
- new candidate edge added
- stronger negative edge established
- obligation reduced or split more precisely

Not progress:

- anchor traced again
- scope summary changed without graph strengthening
- seam vanished temporarily

## Retry model

A failed check is suppressed until:

- graph neighborhood changed
- new supporting evidence arrived
- preferred bridge path changed
- obligation class changed

This is the DB-owned replacement for the current Python retry heuristics.

## DB Schema Plan

## New V2 tables

Core:

- `structure_ir_nodes_v2`
- `structure_ir_edges_v2`
- `structure_ir_observations_v2`
- `structure_ir_derivations_v2`
- `graph_nodes_v2`
- `graph_edges_v2`
- `graph_edge_support_v2`
- `graph_edge_observations_v2`

Raw evidence:

- `trace_events_v2`
- `semantic_fragments_v2`
- `ui_binding_fragments_v2`
- `managed_graph_fragments_v2`
- `native_value_fragments_v2`
- `static_symbol_fragments_v2`

Execution memory:

- `graph_anchor_checks_v2`
- `graph_pair_checks_v2`
- `graph_path_checks_v2`
- `execution_attempts_v2`

Obligations:

- `graph_obligations_v2`
- `graph_obligation_support_v2`

Derived consumer projections:

- `*_projection_v2` views per system

Compatibility:

- current `subject_state`, `knowledge_gaps`, `execution_plan_fragment` remain read-only projections during migration

## Required indices

- by source node
- by target node
- by relation kind
- by status
- by updated_at
- by observation support count
- by obligation status / class / priority
- by anchor/pair/path check identity

## Migration Strategy

## Phase 0. Freeze V1 logic

Rule:

- only fix correctness/stability blockers in V1
- no more major feature expansion in the current seam-first planner

## Phase 1. Build V2 storage in parallel

Deliverables:

- all V2 tables
- bootstrap loaders from current canonical graph, evidence graph, and available structured fragments
- no consumer cutover yet

Acceptance:

- V2 tables populate from current DB
- no V1 behavior change required

## Phase 2. Implement V2 typed IR derivation passes

Deliverables:

- symbol/ownership pass
- call/dataflow pass
- UI binding pass
- prefab/controller pass
- value/formula pass

Acceptance:

- known TokenShop/shard/multiverse examples appear first as concrete IR chains, then as concrete graph chains in V2

## Phase 3. Implement V2 execution memory

Deliverables:

- anchor/pair/path check persistence
- retry gating in DB
- graph version / neighborhood digest per check

Acceptance:

- repeated no-progress anchor selection is prevented without Python cache logic

## Phase 4. Implement obligation generator

Deliverables:

- `graph_obligations_v2`
- obligation scoring fields
- obligation support table

Acceptance:

- unresolved work is derivable from IR + graph structure alone
- not from curated seam families

## Phase 5. Add `--best-gap-v2`

Deliverables:

- V2 selector
- V2 path-based execution plan
- V2 progress evaluation

Acceptance:

- `--best-gap-v2 --repeat N` rotates through graph questions without manual edits
- repeated failed targets are suppressed until graph changed

## Phase 6. Prove on representative systems

Required proof systems:

- TokenShop row/title/display/value lane
- shard cost/formula/value lane
- multiverse owner/field lane

Acceptance:

- each system grows IR + graph truth across repeated runs
- not just subject-state churn

## Phase 7. Consumer projection cutover

Deliverables:

- V2-backed projections for app surfaces

Acceptance:

- app reads V2-derived truth for targeted systems

## Phase 8. Demote V1 planner surfaces

Demote:

- seam registries
- subject-state-first routing
- knowledge-gap-first routing
- Python retry memory

## Validation Plan

## Unit validation

- edge derivation tests by relation kind
- obligation generation tests
- retry suppression tests
- path continuation tests

## Integration validation

- repeat 10 batches on representative systems
- repeat 50 batches only after repeat 10 is stable

Required metrics:

- percent of runs adding or strengthening graph edges
- repeated identical target rate
- average obligation rotation rate
- IR/graph growth per batch
- materialization write volume per successful edge

## Regression checks

Must prove:

- no false `netProgress=yes`
- no repeated identical failed target in same batch unless graph changed
- no scope-local duplication of canonical edges
- no consumer regression on already-grounded systems

## Readiness Criteria for Repeat 50

Do not run large repeat batches until all are true:

1. V2 selector is default or explicitly targeted
2. anchor/pair/path checks are DB-owned
3. repeated failed target suppression works across fresh processes
4. path-based continuation is proven on at least three systems
5. IR/graph growth rate is meaningfully above churn rate

## Failure Modes V2 Must Eliminate

- false closure from scope-local subject state
- reopening from stale gap/seam payloads
- graph truth duplicated per scope
- repeated negative relation exploration
- graph question selected without respecting tested endpoints
- title/value lanes collapsing to flat shell-to-literal guesses
- broad post-run rebuilds for unchanged graph state
- Python cache state being required for planner correctness

## Non-goals

- perfect deletion of all V1 structures before V2 is proven
- full app migration in the same patch as V2 storage creation
- replacing every export/debug surface immediately

## Immediate Build Order

1. add full V2 schema
2. bootstrap current graph and structured fragments into V2
3. add execution-memory V2 tables
4. add IR derivation passes
5. add graph collapse from IR
6. add obligation generator
7. add `--best-gap-v2`
8. validate on shard + TokenShop + multiverse
9. cut consumer projections over

## Working definition of done

The rebuild is done when:

- the planner asks structure-derived graph obligations, not seam closures
- graph truth is global and cumulative
- typed IR exists and is the immediate source of graph derivation
- execution memory is DB-owned
- repeated runs add durable graph knowledge without code edits
- unresolved mechanic questions survive as obligations until proven, contradicted, or decomposed
- app-facing mechanic understanding is derived from graph truth rather than bespoke planner lanes
