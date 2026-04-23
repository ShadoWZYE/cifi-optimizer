# Trace Registry Extension Guide

Archived. The live trace path is DB-first now. This file remains only as historical guidance for
how the old registry-target model was authored before subject resolution, execution planning,
surface assembly, graph reuse, bridge policy, narrative, and assessment moved into reducer-owned
SQLite fragments.

## Purpose

The old registry used to encode how a family was recovered, not just what strings to search for.
It is now only an archived compatibility artifact, referred to in current repo surfaces as:

- `archive:unity-trace-target-registry.json`

The surviving runtime that replaced it lives in:

- `scripts/unity/unity_trace_bundle.py`

## Historical Notes

Do not extend `data/archive/unity-trace-target-registry.json` for new work. Add DB-owned bootstrap,
planning, support, surface, graph, bridge, narrative, or assessment fragments instead.

If you are auditing old target records, the guidance below explains what the old file used to
carry before the DB migration.

## When to add a new target

Add a target when you have a distinct bounded question such as:

- one save-owner boundary
- one TokenShop row or effect lane
- one shard cost structure
- one multiverse market join

Do not add a target just because you found one more interesting string. A target should answer a
coherent question and carry its own blocker model.

## Family structure

At minimum, a family should define:

- the family id and label
- its source families
- one or more targets

Each target should declare:

- `question`
  The user-facing question
- `requiredInputs`
  Minimum inputs needed to answer it
- `nonBlockers`
  What does not prevent the target from being useful
- `blocker`
  The current true blocker
- `largestAdjacentSlice`
  The next coherent extraction step
- `defaultNextStep`
  The normal continuation

That is the lane contract from `AGENTS.md`, expressed in target form.

## Choosing source families

Prefer live direct sources first:

- `metadata`
- `level0`
- `sharedassets0`
- a native trace source when needed

Keep boundary or model datasets only when they carry real value:

- explicit blocked joins
- reusable formula models
- preserved canonical-import boundaries

Do not use an older probe JSON as a primary source if the same positive evidence now exists in
metadata, `level0`, or the native trace layer.

When a target uses the native trace layer, prefer targets that can consume reconstructed native
chains, not just literal native symbol hits. The current native trace can now recover:

- reconstructed owners/classes
- reconstructed methods/accessors
- reconstructed fields and raw value terms

Use those when they materially strengthen the bounded claim, but keep the provenance strength
explicit.

## What is automatic now vs manual

The trace now has a generic native-promotion layer.

Automatic today:

- schema-versioned native job reuse and stale reruns
- metadata-neighborhood bridge classification
- reconstructed owners/classes
- reconstructed methods/accessors
- reconstructed fields and raw value terms
- scored owner candidates
- automatic `native-reconstruction` graph edge promotion when the reconstructed chain is strong
  enough
- automatic owner promotion against the bounded target surface, so matching bridge candidates such
  as `SaveData` can outrank nearby metadata noise

Manual today:

- deciding whether the reconstructed native owner should become a target-specific blocker or solved
  claim
- family-specific false-neighbor suppression rules when a generic owner score is still too noisy
- target-specific wording for user-facing conclusions when the native lane changes the meaning of
  the trace materially
- deciding which reconstructed terms are safe to promote into canonical system units

In practice:

- future runs already benefit from the generic reconstruction layer automatically
- manual edits are still needed when a family wants stronger domain-specific interpretation than the
  generic `native-reconstruction` edge can provide

## Surfaces

`strategyConfig.surfaces` should contain the primary proof surfaces for the bounded question.

Use primary surfaces only for evidence that is required to answer the target directly.

Examples:

- the shell neighborhood
- the action hook
- the shared effect title
- the prefab identity that actually closes the join

Do not place corroborating or contrast-only evidence in primary surfaces.

## Follow-up surfaces

Use `followUpSurfaces` when the evidence is still part of the same target or family, but is one or
more hops away from the bounded core proof.

Examples:

- detached identity/title surfaces
- corroborating consumer-family lanes
- downstream bonus shells

This keeps the main graph clean while still making the follow-up repeatable.

## Depth plans

Use `depthPlan` when the target requires staged follow-up recovery.

Each step should describe:

- `hop`
  Which hop this is
- `goal`
  What that hop is meant to recover
- `targetIds`
  Optional handoff targets for the next staged recovery
- `seedTerms`
  Terms worth carrying into the hop

Use depth for controlled graph recovery, not for unbounded recursion.

Good use:

- shell -> action -> effect -> consumer -> bonus shell

Bad use:

- keep expanding any matched term until something interesting appears

## Claim stages

Use `claimStages` to describe how multi-hop evidence becomes one final claim.

Examples:

- stage 1: bounded shell/action proof
- stage 2: effect-chain proof
- stage 3: downstream consumer handoff
- stage 4: detached identity corroboration

This is how a target with several hops can still remain explainable.

## Default depth

Use `defaultDepth` when a target normally requires one or more hops to be useful. This avoids
forcing the caller to remember `--depth-search` for known staged targets.

Do not set a large default depth casually. Default depth should reflect the smallest repeatably
useful staged plan.

## Generic explore vs new target

Use `generic-explore` first when:

- the family is unclear
- the object name is ambiguous
- you only have a loose string or label

Promote to a real target only after the trace consistently recovers:

- a bounded owner or shell
- a stable action/effect/identity neighborhood
- a clear blocker if the join is still incomplete

## Promotion checklist

Before adding or changing a target:

1. verify the owner/location/currency labels in metadata or Unity assets
2. keep verified and assumed evidence separate
3. decide which surfaces are primary vs follow-up
4. add a blocker instead of faking a solved join
5. prefer direct-source citations over historical probe summaries

## Minimal workflow

1. Run `trace --query ...` or `trace --family ...`
2. Identify the bounded target shape
3. Add or edit the registry target
4. Re-run the target directly
5. Use `--extended-search` or `--depth-search` only if the target is too shallow
6. Promote only the grounded subset into canonical or boundary data
