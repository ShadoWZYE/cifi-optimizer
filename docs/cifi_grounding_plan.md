# CIFI Grounding Plan

This document translates the grounding research into concrete repository actions.

## Objective

Bring the repository to a state where future optimization work is based on real **CIFI** systems and clearly labeled assumptions, not prototype-era fiction.

This is a blocking integrity pass.

---

## Priority order

1. docs and terminology grounding
2. PlayerProfile cleanup
3. shard system de-fictionalization
4. test updates
5. rebuild optimizer work on grounded schema

---

## Branch strategy

Recommended branch:
- `refactor/cifi-grounding`

Do not commit directly to `main`.

Keep PR #2 unmerged until grounded replacements exist.

---

## Repo state summary

The repo is structurally promising:
- shared PlayerProfile
- modular recommendation flow
- import pipeline
- local-first design

But the current shard work contains:
- invented milestone identities
- invented value/cost curves
- default fictional resource state
- convincing-looking but ungrounded outputs

That means the immediate goal is not “ship more optimizer,” but:
- make the schema truthful
- make the docs truthful
- disable misleading recommendation behavior

---

## Workstream 1: docs grounding

### Goals
- standardize all user-facing terminology to **CIFI**
- separate verified mechanics from repo assumptions
- remove or rewrite misleading markdown content

### Actions
- add `docs/cifi_verified_spec.md`
- add `docs/cifi_grounding_plan.md`
- add `docs/cifi_sources.md`
- rewrite markdown files that currently describe prototype assumptions as if they were game truth
- remove machine-local absolute paths from docs
- ensure docs distinguish:
  - verified
  - community-tool derived
  - assumption / placeholder

### Definition of done
- no markdown file casually asserts invented CIFI mechanics
- no `CiFi` casing remains in docs
- docs are usable by Codex as grounding context

---

## Workstream 2: PlayerProfile cleanup

### Goals
- make PlayerProfile represent actual CIFI state or clearly labeled derived state
- remove fictional default values from first app instantiation

### Actions
- change default profile to blank/zeroed values
- move demo values behind an explicit demo helper if still needed
- rename fields that do not map cleanly to CIFI
- mark uncertain fields for removal or migration
- separate external-model fields from game-state fields where possible

### Key rule
Do not silently mix:
- in-game values
- planner abstractions
- model calibration
- demo data

### Definition of done
- a fresh first-run profile does not look like fabricated gameplay state
- the schema is safer to build on

---

## Workstream 3: shard system grounding

### Goals
- stop presenting fictional shard logic as real optimizer output
- align shard work with known CIFI systems:
  - Shards
  - Shard Mining Menu
  - Operations
  - Shard Milestones
  - Loop Prestige reset behavior

### Actions
- quarantine or remove invented milestone dataset
- remove fabricated cost/value scoring where unsourced
- replace shard optimizer with either:
  - grounded descriptive mode, or
  - verified data-driven mode when source tables exist
- avoid invented milestone identities and fake breakpoints

### Acceptable temporary behavior
A non-misleading placeholder is better than a polished fiction layer.

Examples:
- “Shard module pending verified milestone table”
- “Descriptive mode only”
- “Recommendation scoring disabled until verified data is imported”

### Definition of done
- the app no longer emits authoritative-looking shard recommendations from made-up mechanics

---

## Workstream 4: tests

### Goals
- stop asserting fictional outputs
- validate grounded contracts instead

### Actions
- remove tests that expect fake shard winners
- add tests for:
  - schema shape
  - blank default profile behavior
  - grounded shard module fallback behavior
  - recommendation contract shape

### Definition of done
- tests enforce safety and truthfulness, not placeholder outcomes

---

## Suggested migration labels

Use one of these tags when reviewing fields/functions:

- `verified`
- `community-tool`
- `derived`
- `experimental`
- `remove`
- `rename`
- `unsourced`

---

## Field review rules

For every current field ask:
1. Does this correspond to a real visible CIFI concept?
2. Is the name correct?
3. Is the value directly user-entered, derived, or fictional?
4. Should it live in canonical game state?
5. If uncertain, should it be moved under a labeled non-canonical namespace?

---

## System integration gate

Before any system moves from research or extraction work into app recommendations, verify:

1. the in-game location and role of the system
2. the real owner object or code-side owner in the Unity/APK assets
3. the currency lane and player-owned state the system consumes
4. the difference between verified player-facing labels, serialized field ids, and community-tool labels
5. what remains unresolved enough that the app must stay descriptive or blocked

Fail this gate if any of the above are inferred rather than evidenced.

Presence of extracted data is not enough. A system can be available in committed assets and still remain unmapped for app purposes.
Treat that state as:
- available but unmapped
- not recommendation-ready
- still blocked on mapping currencies, owned-state inputs, or player-facing labels

Even when a system is known to exist in CIFI, it should remain blocked for app integration until the repo understands how it exists in the shipped game and what fields and currencies actually drive it.

Acceptable next work after a failed gate:
- parser improvements
- owner-map and verification docs
- PlayerProfile contract planning
- labeled descriptive placeholders

Not acceptable after a failed gate:
- budget mapping by guesswork
- recommendation cards that treat one system's currency as another system's currency
- optimistic UI that implies the planner understands a system it has not yet grounded

---

## Codex execution guidance

Codex should be used to do the bulk repo work, but with this sequence:

### Phase 1
- add grounding docs
- fix terminology
- blank defaults
- neutralize fake shard logic

### Phase 2
- review generated changes
- confirm no new invented assumptions were introduced

### Phase 3
- only then rebuild shard optimizer against grounded schema

---

## Recommended first commit

Commit message:
`refactor: add CIFI grounding docs and remove fictional shard assumptions`

That first commit can include:
- new docs
- terminology updates
- blank defaults
- shard fallback mode
- tests updated away from fictional expected outputs

---

## Merge readiness checklist

Before opening PR:
- docs added
- docs use CIFI casing
- first-run PlayerProfile is not fictional
- no fake shard recommendation remains in MVP path
- tests no longer encode invented game results
- misleading prototype assumptions are either removed or labeled

---

## Non-goals during grounding pass

Do not:
- redesign the app architecture
- expand into unrelated systems
- build new speculative optimizer logic
- hide uncertainty behind polished UI

The goal is integrity, not feature count.
