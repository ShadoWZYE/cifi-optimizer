# CODEX_BRIEF.md

Work in this repo with grounded, focused, branch-scoped changes.

## Goal

Help build the grounded MVP core of a local-first CIFI toolkit that can replace fragmented external-tool workflows over time.

## Repo rules

- keep diffs small and task-shaped
- preserve local-first browser behavior
- prefer the largest coherent adjacent slice that answers a real player question honestly
- treat extraction, mapping, decompilation, and validation as intake that supports a slice, not as default product scope
- do not invent formulas, labels, owners, or player-state fields
- treat `state.playerProfile` as the shared state boundary
- keep grounded game truth separate from planner helpers, compatibility data, and external/community inputs
- prefer committed APK/Unity evidence when game truth is missing
- do not confuse disciplined scope with row-by-row, field-by-field, symbol-by-symbol, or tiny evidence-fragment tasking when the surrounding family shares one implementation path
- recover whole related families together when they share owner shape, runtime behavior, and validation handling
- split work only when there is a real boundary: different owner families, different runtime systems, different validation paths, meaningfully different blocker states, or review risk from unrelated changes

## Workflow

- start every task by checking whether the worktree is clean
- if the worktree is dirty, report the exact paths before changing anything
- use remote `origin/main` as the base source of truth unless the user says otherwise
- never work directly on `main`
- create or switch to one dedicated branch per PR
- keep each branch scoped to one coherent grounded claim or one coherent adjacent slice
- do not mix unrelated cleanup, planner integration, UI expansion, or parallel research lanes into the same PR
- do not discard, reset, clean, or delete tracked work unless the user explicitly asks

## Slice contract

Every lane, PR, or handoff should declare:

1. the user-facing question being answered
2. the minimum required inputs
3. the explicit non-blockers
4. the current true blocker
5. the largest coherent adjacent slice that can ship honestly

Do not let adjacent research or extraction lanes block a slice unless they are consumed inputs for that slice.

## Grounding gate

Before wiring a system into app behavior, verify:

1. where it lives in-game
2. its real owner or declaring wrapper
3. its currencies or player-owned inputs
4. which labels are in-game versus compatibility/community labels
5. which facts are verified versus unresolved
6. what user workflow the integration actually improves

If that gate is not met, keep the work in docs, extraction, mapping, validation, quarantine, or descriptive-mode surfaces.

## PR shape

A good PR should do one bounded thing, such as:

- narrow a boundary
- recover a related owner family
- add a checked import or compatibility shape
- harden validation around an existing grounded claim
- ship one coherent related slice that answers a real player question without pretending unrelated systems are solved

If exact recovery is not possible, prefer a narrower honest boundary over fake closure.

## MVP focus

- player profile
- guided/manual import
- grounded shard workflow
- MVP-safe token/diamond planning
- loop-reset guardrails
- explainable recommendation/planning outputs

## End-of-task report

Always report:

1. branch name
2. grounded conclusion reached
3. files changed
4. what remains blocked
5. validation run and results

## Verify

Before finishing a task, run the same local checks CI runs:

- `npm run ci:local`

Only add extra targeted checks such as `node --check app.js` when the touched files or task call for them.
