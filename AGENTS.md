# AGENTS.md

## Purpose

Evolve this repo toward a grounded MVP without speculative behavior or large rewrites.

## Working rules

- make small, safe, incremental changes
- prefer extraction and cleanup over redesign
- preserve local-first browser behavior
- keep diffs focused
- prefer truth over placeholder sophistication

## MVP scope

First-class MVP systems:

- `state.playerProfile`
- guided/manual player import
- shard milestone workflow
- token/diamond spend planner
- loop-reset guardrails
- unified recommendation feed
- explainable recommendations

## Non-goals

Do not prioritize:

- OCR
- full save parsing
- generic progression tables
- Gem Nodes
- research UI expansion as product surface
- broad simulation architecture
- late-game full optimization systems

## Grounding rule

Do not add a field, label, formula, or recommendation unless it is:

1. a known in-game CIFI concept, or
2. a clearly labeled external/community import

If uncertain:

- preserve structure
- document assumptions
- keep uncertainty visible
- prefer descriptive behavior over invented precision

## Source priority

Use this order:

1. repo docs and shipped datasets
2. committed APK/Unity artifacts and extraction outputs under `workbench/`
3. official/public corroboration
4. community or external-model support

Do not silently upgrade fallback sources into canonical game truth.

## Integration gate

Before integrating a system into app behavior, verify:

1. in-game system identity
2. real owner object
3. currencies or budget lane
4. required player-owned inputs
5. grounded labels vs serialized ids/community names
6. verified facts vs unresolved assumptions

If any item is unresolved:

- do not wire it into recommendations
- keep it in docs, extraction, mapping, validation, or descriptive-mode surfaces
- record the unresolved gap

## Architecture rules

1. no large rewrites
2. prefer extraction over redesign
3. keep `state.playerProfile` as the shared state boundary
4. separate canonical state, planning helpers, external models, and compatibility data
5. keep recommendation outputs explainable
6. keep verified mechanics separate from heuristics

## Recommendation contract

All recommendation modules should converge on:

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