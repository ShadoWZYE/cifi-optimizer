# Research Tracks

## Purpose

`docs/roadmap/research-tracks.md` is the active unresolved queue for extraction, mapping, validation, and implementation-prep work.

For fresh-thread restart context, pair this file with:

- `docs/roadmap/active-grounding-boundaries.md`
- `docs/roadmap/known-false-paths.md`
- `docs/contracts/lane-handoff-template.md`

It is not a permanent registry, a full history log, or a place to keep growing broad themes forever.

Research tracks exist to turn uncertainty into one of three outcomes:

1. a shippable implementation slice
2. a narrower successor track
3. a closed/deferred result

If a track is not moving toward one of those outcomes, it should be rewritten, forked, or closed.

---

## Core rule

Prefer narrow tracks with clear exits over broad tracks with long step lists.

A good track should describe one real unresolved problem with one plausible unlock path.

A bad track becomes a container for multiple semi-independent problems, repeated hardening passes, or documentation of why implementation is still blocked.

---

## Forking rule

Fork a new track when any of the following becomes true:

- the next work has its own exit condition
- the next work has a different blocker than the parent track
- the next work could ship independently in 1-2 PRs
- the parent track has more than 5 meaningful next steps
- the parent track mixes extraction, mapping, planner wiring, and hardening in one lane
- progress is happening, but only by adding more boundaries/checks without unlocking capability

Do not keep extending a parent track once it has become a bundle of narrower problems.

Prefer successor tracks over endlessly extending `nextSteps`.

---

## Closure rule

Close or supersede a track when it is:

- implemented
- replaced by narrower child tracks
- blocked hard enough that it should move to deferred intake
- invalidated by stronger evidence
- no longer MVP-relevant

Tracks should leave the active queue quickly once they stop being the best unit of work.

---

## Capability bias

Research should support shipping, not become its own infinite product.

When choosing between:
- another boundary/check/doc pass, or
- the smallest credible capability unlock,

prefer the capability unlock.

If exact truth is still blocked, prefer:
- a clearly labeled partial slice
- a descriptive preview
- a smaller extraction track
over another broad “sanitize everything” pass.

---

## Track size rule

One track should usually correspond to one of these:

- recover one owner/save model
- map one player-owned input family
- verify one currency/mechanic boundary
- wire one MVP-safe planner slice
- decide one system’s MVP relevance

If a track is trying to do more than one of those, split it.

---

## Standard track template

Each active track should include:

- `id`
- `title`
- `status`
- `goal`
- `currentSlice`
- `exitCondition`
- `blockedBy`
- `smallestShippableSlice`
- `completedSteps`
- `nextSteps`
- `sources`
- `artifacts`
- `verified`
- `uncertain`

---

## Authoring rules

### `goal`
Name the real player-value or implementation unlock, not just the research topic.

### `currentSlice`
Describe only the current narrow problem being worked.

### `exitCondition`
State what must become true for the track to end.

Examples:
- recovered saved-state owner for TokenShop row levels
- mapped shard milestone payload to verified player-facing rows
- decided mech planning is deferred post-MVP

### `blockedBy`
Name the single strongest blocker, not every uncertainty in the lane.

### `smallestShippableSlice`
Describe the smallest useful output that could ship without pretending the whole system is solved.

### `nextSteps`
Keep this short.
Use 1-3 steps maximum.
If more are needed, fork.

---

## Anti-patterns

Avoid tracks that:

- keep accumulating unrelated subtasks
- mix extraction with planner UX with validation hardening
- grow long `completedSteps` sections without changing capability
- only document why the system is still blocked
- keep adding checks for things that are not yet worth checking
- stay active after their real next work has clearly split into multiple narrower lanes

---

## Examples

Prefer this:

- `spend-token-shop-row-level-recovery`
- `spend-token-bank-save-owner`
- `multiverse-market-id-to-label-remap`
- `shard-milestone-payload-recovery`
- `shard-milestone-row-verification`
- `spend-planner-first-ui-slice`

Instead of this:

- one giant spend-planner track with every extraction, remap, save-boundary, and planner step inside it

---

## Working rule

When updating this file:

- update an existing track only if the new work shares the same exit condition
- otherwise fork a new track
- supersede or archive the parent when the child tracks become the real active queue

The goal is not to minimize the number of tracks.

The goal is to keep each track small enough that progress means a real unlock, not just a better description of blockage.

---

## Active Queue

The repo's active unresolved queue currently lives in [`data/game-data.snapshot.v1.json`](data/game-data.snapshot.v1.json) and should stay mirrored here at a high level.

Current active or queued tracks:

- `spend-planner-first-ui-slice`
  - status: `active`
  - goal: ship a descriptive spend-planner panel that shows canonical inputs plus explicitly labeled boundary-backed spend evidence while keeping blocked owner-dependent inputs unavailable
- `shard-milestone-payload-recovery`
  - status: `active`
  - goal: recover the exact shard-side serialized row payload or declaring save-side owner needed for player-owned shard workflow inputs
- `spend-multiverse-savedata-import-surface`
  - status: `active`
  - goal: decide whether any bounded `SaveData`-backed Emporium import surface is safe to expose without promoting unresolved row labels, broader progression fields, or planner behavior too early
- `spend-token-shop-row-level-recovery`
  - status: `archived`
  - goal: recovered exact `SaveData` ownership for raw `ATU1Level` through `ATU28Level` TokenShop row levels; follow-up work moves to row remap instead of owner recovery
- `spend-token-shop-row-remap`
  - status: `active`
  - goal: remap recovered raw `ATU*Level` TokenShop row fields onto grounded row identities without promoting speculative player-facing labels; the current blocker is now narrowed to joining one `ATU` row shell or generic TokenShop text hook to one concrete prefab or final title
- `spend-token-bank-state-owner`
  - status: `active`
  - goal: recover the saved-state owner behind token-bank cap, fill, and claimable state without guessing from derived `OR_*` labels
- `spend-daily-tokenium-save-owner`
  - status: `queued`
  - goal: recover the gameplay owner and saved-state fields behind the Academy or Farm Mission Daily Tokenium lane
- `spend-multiverse-row-label-remap`
  - status: `queued`
  - goal: finish the validated-row id and label remap after the bounded Emporium import-surface decision lane closes

Superseded parent:

- `spend-planner-from-extracted-data`
  - status: `archived`
  - reason: it mixed multiple independent spend blockers that now have distinct exit conditions and should no longer share one queue item
- `spend-multiverse-save-model-recovery`
  - status: `archived`
  - reason: the save-owner question is now grounded enough that the active follow-up is a narrower `SaveData` import-surface decision, not more generic owner recovery

