# PR Roadmap (CiFi Optimizer MVP)

## Goal

Move from prototype → MVP with minimal disruption and maximum reuse.

---

# Phase 0 — Stabilize Architecture

## PR 1: PlayerProfile Core Refactor

### Goals

* Introduce canonical PlayerProfile
* Remove split between profile and shipConfig.playerState
* Prepare for module-based recommendations

### Changes

* Add createDefaultPlayerProfile()
* Add state.playerProfile
* Migrate persistence to PlayerProfile
* Add schema version + migration
* Add RecommendationAction structure
* Hide:

  * Gem Nodes
  * Research
  * OCR UI

### Output

* Clean state model
* Stable foundation for modules

---

# Phase 1 — First Real Value

## PR 2: Shard Milestone Optimizer

### Goals

* Replace generic progression system
* Add real recommendation engine

### Changes

* Remove progressionActions scoring
* Add shard input fields
* Add milestone detection + ranking
* Add ETA + cost modeling
* Add "why now" explanations

### Output

* First meaningful optimizer

---

## PR 3: Loop Reset Guardrails

### Goals

* Add trust + safety layer

### Changes

* Add rule-based warnings:

  * pre-reset checks
  * inefficient loop detection
* Surface warnings in recommendation feed

### Output

* Prevent bad decisions
* Increase trust

---

## PR 4: Diamond / Token Planner

### Goals

* Deliver "best next purchase"

### Changes

* Add resource income inputs
* Add planner logic
* Rank purchases
* Merge with shard + warnings

### Output

* Complete MVP loop:
  input → recommendations → action

---

# Phase 2 — Post-MVP Expansion

## PR 5+: Optional

* Ship optimizer reintegration
* Research planning
* Additional systems (Zeus, Academy)
* Improved import methods
* Optional OCR revisit

---

# Principles

* Each PR must be shippable
* No giant diffs
* Replace, don’t layer on top of placeholders
* Always move toward unified recommendation system

---

# Exit Condition (MVP Complete)

You have:

* Single PlayerProfile
* 3 working modules:

  * shards
  * spend
  * loop guardrails
* Unified recommendation feed
* Explainable outputs
* Local import/export

At this point: you have a real product.
