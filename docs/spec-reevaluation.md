# Spec Reevaluation

This document captures what the repository structure gets right and what still needs grounding.

## Goal

The purpose of this reevaluation is to prevent the repo from accumulating polished but fictional optimizer behavior.

The immediate objective is not to expand features.

The immediate objective is to:
- align the schema with real CIFI concepts
- align docs and terminology with CIFI
- remove or label unsourced mechanics
- prepare a safer base for future optimizer work

---

## What the current repo gets right

The repository already has useful structural ideas:

- local-first architecture
- shared PlayerProfile pattern
- central app state
- modular recommendation structure
- import-oriented workflow
- smoke test harness
- a clear MVP-oriented direction in `AGENTS.md`

These are worth preserving.

---

## What is still wrong

The current prototype still contains important semantic problems:

- some defaults are fictional or demo-like
- some naming is not clearly grounded in real CIFI systems
- some shard logic is heuristic fiction presented too confidently
- some documentation mixes prototype assumptions with real mechanics
- some datasets imply optimizer authority without external grounding

---

## Current rule

The app should not optimize against invented mechanics.

Where grounding is incomplete, the system should:
- fall back
- label uncertainty
- keep structure safe for future work

A clear placeholder is better than a misleading recommendation.

---

## Repo grounding priorities

### 1. Terminology
- standardize user-facing terminology to **CIFI**
- remove mixed casing like `CiFi`
- stop using vague prototype labels when a real CIFI term exists

### 2. PlayerProfile
- ensure `state.playerProfile` reflects actual CIFI state or clearly labeled derived state
- remove fictional first-run defaults
- separate canonical game state from external-model fields

### 3. Shard system
- align shard work to real anchors:
  - Shards
  - Shard Mining Menu
  - Operations
  - Shard Milestones
  - Loop Prestige reset behavior
- remove or neutralize invented milestone/value logic until verified inputs exist

### 4. Documentation
- make docs reflect repo reality
- distinguish verified, derived, community-tool, and speculative content
- remove local-machine path references and misleading examples

### 5. Tests
- stop asserting fictional optimizer winners
- validate safe grounded behavior and contract shape instead

---

## Non-goal during reevaluation

Do not:
- redesign the whole app
- expand speculative systems
- add new invented formulas
- preserve fake logic just because the UI is polished

---

## Immediate direction

1. ground terminology
2. ground schema
3. neutralize fake shard logic
4. update docs
5. rebuild future optimizer work on grounded structures