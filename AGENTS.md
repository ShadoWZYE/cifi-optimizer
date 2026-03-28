# AGENTS.md

## Purpose

This repository is evolving from a prototype into an MVP for a **CIFI** upgrade-optimization tool.

Agents must prioritize:
- small, safe, incremental changes
- alignment with MVP direction
- reuse over rewrite
- truth over placeholder sophistication

---

## MVP Product Scope

The only first-class systems for MVP are:

- PlayerProfile (single source of truth)
- Guided/manual player import
- Shard milestone workflow
- Diamond/token spend planner
- Loop-reset guardrails (warnings)
- Unified recommendation feed
- Explainable recommendations

---

## Grounding rule

No field, label, formula, or recommendation should be added unless it is either:

1. a known in-game CIFI concept, or
2. imported from a named external/community tool and clearly labeled as such

If uncertain:
- preserve structure
- document assumptions
- avoid invented precision
- prefer descriptive behavior over fake optimizer confidence

---

## Explicit Non-Goals (for now)

Do NOT prioritize or expand:

- OCR pipelines
- Full save-file parsing
- Generic progression tables
- Gem-node optimizer
- Research-tracks UI
- “simulate everything” architectures
- Late-game full optimization systems

These may exist in the repo, but they are not part of MVP.

---

## Architecture Rules

### 1. No large rewrites
- Do NOT replace the entire app structure.
- Work incrementally within existing files unless explicitly refactoring.

### 2. Prefer extraction over redesign
- If code is messy, extract functions/modules.
- Do NOT introduce complex frameworks or abstractions.

### 3. Keep local-first behavior
- The app must work fully in-browser.
- Use localStorage or equivalent unless explicitly instructed otherwise.

### 4. Single source of truth
All player state must converge into:
- `state.playerProfile`

### 5. Separate truth from models
Do not silently mix:
- verified in-game state
- derived values
- external/community-tool model fields
- placeholder assumptions

Anything not directly representing game state should be clearly labeled.

### 6. Recommendation system contract
All modules should ultimately output actions in this shape:

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