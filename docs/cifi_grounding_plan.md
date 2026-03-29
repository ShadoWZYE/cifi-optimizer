# CIFI Grounding Plan

Translate grounding research into concrete repo actions.

## Objective

Move the repo to a state where future optimization work is based on real CIFI systems and clearly labeled assumptions, not prototype fiction.

## Priority order

1. docs and terminology grounding
2. PlayerProfile cleanup
3. shard system de-fictionalization
4. test updates
5. rebuild optimizer work on grounded schema

## Repo summary

The repo already has:

- shared PlayerProfile
- modular recommendation flow
- import pipeline
- local-first design

But grounding work exists because earlier shard/prototype behavior included invented identities, curves, defaults, and authoritative-looking outputs.

Immediate goal:

- make schema truthful
- make docs truthful
- disable misleading behavior

## Workstreams

### 1. Docs grounding

- standardize CIFI terminology
- separate verified mechanics, external/community data, and assumptions
- rewrite or remove misleading markdown

### 2. PlayerProfile cleanup

- keep PlayerProfile limited to actual CIFI state or clearly labeled derived/external state
- remove fictional defaults
- separate game state from calibration and demo data

### 3. Shard system grounding

- stop presenting fictional shard logic as real optimizer output
- align shard work with known systems: Shards, Shard Mining Menu, Operations, Shard Milestones, Loop Prestige reset behavior
- prefer descriptive mode until verified tables exist

### 4. Tests

- stop asserting fictional outputs
- validate grounded contracts instead

## Suggested migration labels

- `verified`
- `community-tool`
- `derived`
- `experimental`
- `remove`
- `rename`
- `unsourced`

## Field review rules

For every field ask:

1. does it map to a visible CIFI concept?
2. is the name correct?
3. is the value user-entered, derived, or fictional?
4. should it live in canonical game state?
5. if uncertain, should it move under a labeled non-canonical namespace?

## System integration gate

Before any system moves from research/extraction into app recommendations, verify:

1. the in-game location and role
2. the real owner object or code-side owner in Unity/APK assets
3. the currency lane and player-owned state it consumes
4. the difference between verified player-facing labels, serialized ids, and community-tool labels
5. what remains unresolved enough that the app must stay descriptive or blocked

Fail this gate if any of the above are inferred rather than evidenced.

Presence of extracted data is not enough. A system can exist in committed assets and still remain unmapped for app purposes.

Treat that state as:

- available but unmapped
- not recommendation-ready
- blocked on mapping currencies, owned-state inputs, or player-facing labels

Even when a system is known to exist in CIFI, it should stay blocked until the repo understands how it exists in the shipped game and what fields and currencies drive it.

Acceptable next work after a failed gate:

- parser improvements
- owner-map and verification docs
- PlayerProfile contract planning
- labeled descriptive placeholders

Not acceptable after a failed gate:

- budget mapping by guesswork
- recommendation cards that treat one system's currency as another system's currency
- optimistic UI that implies understanding of a system the repo has not grounded

## Codex guidance

Recommended sequence:

1. add grounding docs
2. fix terminology
3. blank defaults
4. neutralize fake shard logic
5. review for new invented assumptions
6. only then rebuild grounded behavior

## Non-goals

Do not:

- redesign the app architecture
- expand into unrelated systems
- build speculative optimizer logic
- hide uncertainty behind polished UI
