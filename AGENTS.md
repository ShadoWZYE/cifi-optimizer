# AGENTS.md

## Purpose

Evolve this repo from prototype to MVP without adding speculative behavior.

Priorities:

- small, safe, incremental changes
- MVP alignment
- reuse over rewrite
- truth over placeholder sophistication

## MVP scope

First-class MVP systems only:

- PlayerProfile
- guided/manual player import
- shard milestone workflow
- diamond/token spend planner
- loop-reset guardrails
- unified recommendation feed
- explainable recommendations

## Grounding rule

Do not add a field, label, formula, or recommendation unless it is:

1. a known in-game CIFI concept, or
2. a clearly labeled external/community import

If uncertain:

- preserve structure
- document assumptions
- avoid invented precision
- prefer descriptive behavior over fake confidence

## System Integration Gate

Before integrating any game system into the app, verify from repo docs and available Unity/APK assets:

1. where it lives in-game
2. what the real owner is
3. which currencies or player-owned inputs it uses
4. which labels are verified in-game labels versus serialized ids or community-tool names
5. which parts are verified fact versus unresolved assumption

If any item fails:

- do not wire the system into recommendations
- keep the work in docs, extraction, verification, mapping, or descriptive-mode surfaces
- record the unresolved gap

Important:

- extracted data being present in the repo does not mean the system is mapped enough to integrate
- treat systems as `available but unmapped` until currencies, owned-state inputs, and labels are verified
- a real in-game system is still not build-ready until its owner, data shape, labels, currencies, and required player-state inputs are mapped clearly enough for truthful app behavior

## Non-goals

Do not prioritize:

- OCR
- full save parsing
- generic progression tables
- Gem-node optimizer
- Research-tracks UI
- broad simulation architectures
- late-game full optimization systems

## Architecture rules

1. No large rewrites
   Work incrementally within existing files unless explicit refactoring is required.
2. Prefer extraction over redesign
   If code is messy, extract functions or modules instead of introducing new frameworks.
3. Keep local-first behavior
   The app must work fully in-browser.
4. Single source of truth
   All player state must converge into `state.playerProfile`.
5. Separate truth from models
   Do not silently mix verified in-game state, derived values, external-model fields, or placeholders.
6. Recommendation system contract
   All modules should ultimately emit:

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
## Source-of-truth rule

When working in this repository, agents must treat committed repo-local APK/Unity artifacts as the primary source of truth for undocumented, partially documented, or conflicting game systems.

Default behavior:

1. First check the existing repo docs and shipped datasets.
2. If the answer is incomplete, unclear, stale, or missing, pivot to repo-local APK/Unity extraction artifacts under `workbench/` and related Unity tooling/scripts.
3. Try to ground the system from those committed artifacts before using any external source.
4. Only use external/public/community/model-derived sources when the repo-local APK/Unity path does not resolve the question well enough.
5. When external sources are used, label them clearly and do not silently upgrade them into canonical game truth.

Agents should not skip directly to external sourcing for game-mechanic questions that could be resolved from repo-local extraction artifacts.

If the repo-local APK/Unity path still does not provide enough evidence, agents should either:
- ask for clarification, or
- ask permission before relying on external source data for product-shaping decisions.

This rule applies especially to:
- system ownership
- currencies
- unlock conditions
- labels and terminology
- player-state fields
- planner inputs
- recommendation logic assumptions