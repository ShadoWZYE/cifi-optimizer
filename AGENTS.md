# AGENTS.md

## Purpose

This repository is evolving from a prototype into an MVP for a CiFi upgrade-optimization tool.

Agents (Codex, etc.) must prioritize:

* small, safe, incremental changes
* alignment with MVP product direction
* reuse over rewrite

---

## MVP Product Scope (DO NOT EXPAND BEYOND THIS)

The only first-class systems for MVP are:

* PlayerProfile (single source of truth)
* Guided/manual player import
* Shard milestone optimizer
* Diamond/token spend planner
* Loop-reset guardrails (warnings)
* Unified recommendation feed
* Explainable recommendations ("why now")

---

## Explicit Non-Goals (for now)

Do NOT prioritize or expand:

* OCR pipelines
* Full save-file parsing
* Generic progression tables
* Gem-node optimizer
* Research-tracks UI
* "simulate everything" architectures
* Late-game full optimization systems

These may exist in the repo but are not part of MVP.

---

## Architecture Rules

### 1. No large rewrites

* Do NOT replace the entire app structure.
* Work incrementally within existing files unless explicitly refactoring.

### 2. Prefer extraction over redesign

* If code is messy, extract functions/modules.
* Do NOT introduce complex frameworks or abstractions.

### 3. Keep local-first behavior

* The app must work fully in-browser.
* Use localStorage or equivalent unless instructed otherwise.

### 4. Single source of truth

* All player state must converge into:
  state.playerProfile

### 5. Recommendation system contract

All modules must output actions in this shape:

```js
{
  id: string,
  module: string,
  kind: "upgrade" | "warning",
  title: string,
  score: number,
  confidence: number,
  cost?: {},
  eta?: {},
  benefit?: string[],
  whyNow?: string[],
  assumptions?: string[],
  warnings?: string[]
}
```

---

## Coding Guidelines

* Keep diffs small and readable
* Do not rename files unnecessarily
* Do not break existing working flows unless explicitly replacing them
* Add TODOs only if actionable
* Avoid premature abstraction

---

## When Working on a Feature

Always:

1. Identify affected files
2. Propose a minimal plan
3. Then implement

---

## When Unsure

* Make the most practical assumption
* State it clearly in comments
* Do NOT block progress on uncertainty

---

## Preferred Strategy

* Refactor → then build
* Replace placeholder systems with real ones
* Ship usable slices early

---

## Definition of Success

A change is good if:

* it moves the repo closer to MVP scope
* it reduces ambiguity in player state or recommendations
* it improves clarity, not complexity
