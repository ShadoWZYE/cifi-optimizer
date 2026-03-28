# CIFI Verified Spec

This document is the current source-of-truth anchor for the repo.

Its purpose is to separate:
- verified **CIFI** mechanics and terminology
- community-tool conventions
- repo-specific assumptions
- unresolved gaps that must not be treated as factual game mechanics

## Grounding rule

No new field, label, formula, or recommendation should be added unless it is either:

1. a known in-game concept visible in CIFI, or
2. imported from a named community tool or sheet and explicitly labeled as such.

If a mechanic is uncertain, the app should:
- preserve structure
- avoid invented precision
- label assumptions clearly
- prefer descriptive output over prescriptive optimizer output

---

## Terminology

Use **CIFI** consistently in all user-facing docs and copy.

Avoid mixed casing like:
- CiFi
- Cifi

Use:
- CIFI

---

## Official title anchor

The official public game listing is:

- **Cell: Idle Factory Incremental**
- Developer: **Octocube Games**

Public anchor:
- Google Play listing for Cell: Idle Factory Incremental

---

## Verified shard system anchors

The following points are externally grounded and should be treated as current baseline truth unless replaced by stronger official evidence.

### Shards
- Shards are a real CIFI currency.
- Shards are tied to the **Shard Mining Menu**.
- Shards are gained through **Operations**.
- Shards are spent on **Shard Milestones**.
- Shards reset to **0** on **Loop Prestige**.

### Shard Mining Menu
- The Shard Mining Menu is a real CIFI system.
- It includes:
  - **Operations Overview**
  - **Shard Milestones**

### Operations
- Operations are a real mechanic tied to shard generation.
- Operations have a tick requirement.
- Operations include a reset timer between operations.
- Loop-related systems can affect operation pacing.
- Operations contribute to shard gain.

### Shard Milestones
- Shard Milestones are real CIFI progression objects.
- They have rarity-based threshold behavior.
- Threshold schedules differ by rarity.
- Milestones have level caps that may increase later depending on progression/unlocks.

---

## What is NOT currently verified enough for repo truth

The repo must not present the following as factual unless explicitly sourced:

- invented milestone names
- made-up shard breakpoint labels
- guessed cost curves
- guessed per-level value curves
- abstract “focus weights”
- fabricated ROI formulas
- fabricated ETA math based on unverified rates
- fake default player inventory values

---

## Current repo-specific problems to correct

These issues were identified in current repo work and should be treated as blocking for grounded optimizer behavior:

1. PlayerProfile defaults are pre-populated with fictional/prototype values
2. Some resource names do not clearly map to real CIFI systems
3. Current shard optimizer logic uses invented milestone names and heuristic value math
4. Docs mix prototype language with CIFI language
5. Casing is inconsistent (`CiFi` vs `CIFI`)
6. The current system can produce confident-looking recommendations from unverified mechanics

---

## Canonical policy for this repo

### Verified
Use for:
- real in-game currencies
- real menu systems
- real progression objects
- real unlock relationships
- real reset behavior
- externally sourced formulas or thresholds

### Community-tool
Use for:
- Desmos-like model calibration
- external helper tools
- spreadsheet-driven planning models
- utility fields not visible directly in-game

These are allowed, but must be labeled as:
- community-tool derived
- approximation
- external model
- not raw in-game state

### Repo assumption
Use for:
- temporary placeholders
- UI scaffolding
- migration compatibility
- unresolved schema placeholders

These must never be presented as authoritative game truth.

---

## Immediate implementation standard

Until shard mechanics are fully sourced into app data:

- do not rank fictional shard milestones
- do not fabricate upgrade costs
- do not fabricate upgrade values
- do not imply optimizer certainty
- prefer placeholder/descriptive shard output over fake recommendations

Acceptable temporary output:
- “Shard optimizer pending verified milestone table”
- “Current shard mechanics are not yet fully grounded”
- “This module is in descriptive mode until verified data is imported”

---

## Suggested schema principles

### PlayerProfile
`state.playerProfile` should represent:
- actual CIFI state
- user-supplied values
- clearly labeled external-model fields only where necessary

It should not silently mix:
- real game state
- planning abstractions
- mock defaults
- heuristic assumptions

### External model fields
If a field is not directly from the game, place it under a clearly labeled namespace such as:
- `externalModels`
- `communityTool`
- `derived`
- `experimental`

Do not mix these directly into canonical game state without labels.

---

## External sources used

These are the main public sources that informed this grounding pass.

### Official/public anchor
- Google Play listing for Cell: Idle Factory Incremental

### Community mechanics references
- CIFI Wiki / Fandom:
  - Shards
  - Shard Mining Menu
  - Operations
  - Shard Milestones
  - Loop Prestige
  - Navigation Page
  - Calculations and Formulas
  - Guides and Tools

### Community-tool reference
- SirRed’s CIFI Ouroboros Helper Tool

---

## Confidence notes

### High confidence
- CIFI naming/casing target
- Shards are real
- Operations are real
- Shard Mining Menu is real
- Shard Milestones are real
- Shards reset on Loop Prestige

### Medium confidence
- exact threshold schedules by rarity
- exact cap changes over time
- exact operations timing values
- exact currency naming for some non-shard systems

### Low confidence / unresolved
- exact shard cost formulas
- exact optimizer scoring formulas
- exact mapping of some current repo resource fields to real CIFI systems
- whether some current player profile fields should remain at all

---

## Development rule going forward

When in doubt:
- preserve structure
- remove fake precision
- document uncertainty
- do not invent mechanics