# AGENTS.md

## Purpose

Evolve this repo toward a grounded MVP core that can expand into a unified replacement for fragmented external CiFi tools.

## Working rules

- make incremental, focused changes
- preserve local-first browser behavior
- prefer the largest coherent adjacent slice that answers a real player question honestly
- use extraction, decompilation, and research as intake when they unblock a slice, not as the default product lane
- do not introduce speculative mechanics or fake precision
- keep verified game truth separate from planner helpers, external models, and compatibility data
- keep diffs small unless broader change is clearly required
- do not confuse tiny scope with disciplined scope
- do not default to one row at a time, one field at a time, one symbol at a time, or one tiny evidence fragment at a time when the surrounding family shares the same implementation path and can be recovered together honestly
- recover whole related families together when they share owner shape, runtime behavior, validation path, and blocker state
- split work only when the boundary is real: different owner families, different runtime systems, different validation paths, meaningfully different blocker states, or review risk from unrelated changes
- before finishing a task, run the same local checks CI runs: `npm run ci:local`

## MVP scope

Prioritize:

- `state.playerProfile`
- guided/manual player import
- grounded shard workflow
- MVP-safe token/diamond planning
- loop-reset guardrails
- explainable recommendation/planning outputs

Do not assume all systems should converge into one surface. Converge surfaces only where that clearly improves user value, reduces fragmentation, or replaces an existing external-tool workflow.

## Lane contract

Every future lane should declare:

- the user-facing question it is trying to answer
- the minimum required inputs for that answer
- the explicit non-blockers that should not hold the slice open
- the current true blocker
- the largest coherent adjacent slice that is still shippable, reviewable, and validation-safe

If a neighboring lane is not a consumed input for the current slice, keep it listed as a non-blocker instead of letting it silently block implementation.

## Grounding rule

Do not add a field, label, formula, or recommendation unless it is:

1. a known in-game CIFI concept, or
2. a clearly labeled external/community-derived input

If uncertain:

- preserve structure
- document assumptions
- avoid invented precision
- prefer descriptive behavior over fake confidence

## Integration gate

Before integrating a system into app behavior, verify:

1. where it lives in-game
2. its real owner
3. its currencies or required player-owned inputs
4. which labels are grounded in-game labels versus ids or community names
5. which facts are verified versus unresolved assumptions
6. which user painpoint or external-tool workflow the integration improves

If these are not grounded enough:

- do not wire the system into planner/recommendation logic
- keep it in docs, extraction, mapping, validation, or descriptive-mode surfaces
- record the unresolved gap

## Non-goals

Do not prioritize:

- full save parsing
- broad simulation architecture
- late-game full optimization systems
- premature UI unification
- systems with unclear MVP value
- OCR before its actual user-value target is clear

## Architecture rules

1. keep `state.playerProfile` as the shared state boundary
2. separate canonical state, planning helpers, external models, and compatibility data
3. preserve explainability in outputs
4. avoid silent mixing of grounded truth and heuristic/model assumptions
5. prefer workflow consolidation over abstract architectural neatness

## Source priority

1. committed repo docs and shipped datasets
2. committed APK/Unity artifacts and extraction outputs
3. official/public corroboration
4. community or labeled external-model support

Agents should prefer APK/Unity extraction and mapping when grounded game truth is missing.
