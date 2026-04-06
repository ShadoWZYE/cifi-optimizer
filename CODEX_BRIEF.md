# CODEX_BRIEF.md

Work in this repo with grounded, focused, branch-scoped changes.

## Goal

Help build the grounded MVP core of a local-first CIFI toolkit that can replace fragmented external-tool workflows over time.

## Repo rules

- keep diffs small and task-shaped
- preserve local-first browser behavior
- prefer extraction, mapping, validation, and bounded implementation slices over redesign
- do not invent formulas, labels, owners, or player-state fields
- treat `state.playerProfile` as the shared state boundary
- keep grounded game truth separate from planner helpers, compatibility data, and external/community inputs
- prefer committed APK/Unity evidence when game truth is missing

## Workflow

- start every task by checking whether the worktree is clean
- if the worktree is dirty, report the exact paths before changing anything
- use `origin/main` as the base source of truth unless the user says otherwise
- never work directly on `main`
- create or switch to one dedicated branch per PR
- keep each branch scoped to one coherent grounded claim
- do not mix unrelated cleanup, planner integration, UI expansion, or parallel research lanes into the same PR
- do not discard, reset, clean, or delete tracked work unless the user explicitly asks

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
- recover an owner
- add a checked import or compatibility shape
- harden validation around an existing grounded claim

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

Run relevant checks for touched files:

- `npm run verify:data`
- `npm test`
- `node --check app.js`
