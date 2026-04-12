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

## Lane contract rule

Every active track should make five things explicit:

- the user-facing question it is trying to answer
- the minimum required inputs for that answer
- the explicit non-blockers that should not hold the track open
- the current true blocker
- the smallest shippable tool slice

Use this contract to keep research aligned to shipping.

If a neighboring system is not a consumed input for the current slice, name it under non-blockers instead of letting it silently block the lane.

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
- `userQuestion`
- `minimumRequiredInputs`
- `explicitNonBlockers`
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

### `userQuestion`
Write the player-facing question the lane is trying to answer.

### `minimumRequiredInputs`
List only the inputs the current slice actually consumes.

### `explicitNonBlockers`
Name adjacent unresolved lanes that should stay visible but should not block the current slice.

### `currentSlice`
Describe only the current narrow problem being worked.

### `exitCondition`
State what must become true for the track to end.

Examples:
- recovered saved-state owner for TokenShop row levels
- mapped shard milestone payload to verified player-facing rows
- decided mech planning is deferred post-MVP

### `blockedBy`
Name the current true blocker, not every uncertainty in the lane.

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

- `shard-milestone-payload-recovery`
  - status: `active`
  - goal: recover the exact shard-side serialized row payload or declaring save-side owner needed for player-owned shard workflow inputs
- `spend-multiverse-savedata-import-surface`
  - status: `active`
  - goal: reach one bounded admissibility decision for `SaveData`-backed Emporium import without mixing that decision with row identity/remap research or planner behavior
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

- `spend-planner-first-ui-slice`
  - status: `archived`
  - goal: shipped the first real TokenShop tool slice around one real player question instead of treating the whole spend domain as one blocker
  - user question: `What grounded TokenShop upgrades can I buy right now from the subset we actually know?`
  - minimum required inputs: canonical Tokens, checked TokenShop row-remap subset for `ATU1Level`, `ATU2Level`, `ATU3Level`, `ATU4Level`, `ATU5Level`, `ATU6Level`, `ATU7Level`, and `ATU8Level`, imported current levels for that same subset, and checked `StartCost` / `AdditiveCost` values for those same rows
  - explicit non-blockers: token-bank cap or claimable-state recovery, Daily Tokenium cap or ready-state recovery, Emporium state recovery, unresolved TokenShop rows outside the checked subset, best-buy ranking, ROI math
  - current true blocker: closed for this slice; broader planner-safe spend behavior remains on separate owner and remap lanes
  - smallest shippable slice: a separate Overview module that shows each grounded subset row's identity, current level, next known cost, and current affordability in fixed grounded slot order, without optimizer claims or canonical `ATU*Level` promotion
- `spend-token-shop-row-detail-slice`
  - status: `archived`
  - goal: extend the shipped checked-row TokenShop panel into the next small grounded row-detail tool for the same verified subset only
  - user question: `What do the grounded upgrades I can already inspect actually do at my current level and on the next level?`
  - minimum required inputs: checked TokenShop row-remap subset for `ATU1Level`, `ATU2Level`, `ATU3Level`, `ATU4Level`, `ATU5Level`, `ATU6Level`, `ATU7Level`, and `ATU8Level`, imported current levels for that same subset, and checked `StartCost`, `AdditiveCost`, `Bonus`, and known-cap fields for those same rows, with ATU3 explicitly allowed to stay effect-driven instead of prefab-driven
  - explicit non-blockers: token-bank cap or claimable-state recovery, Daily Tokenium cap or ready-state recovery, Emporium state recovery, unresolved TokenShop rows outside the checked subset, best-buy ranking, ROI math, next-purchase recommendation rules
  - current true blocker: closed for this slice; broader planner-safe spend behavior still remains blocked on row identity coverage and a true next-purchase rule set
  - smallest shippable slice: a separate Overview module that keeps the fixed grounded row order `ATU1`, `ATU2`, `ATU5`, `ATU6`, then shows each row's grounded identity, current level, next known cost, known max-level status, and current-vs-next extracted bonus-step change without optimizer claims or canonical `ATU*Level` promotion
- `progression-token-shop-editor-first-slice`
  - status: `archived`
  - goal: move the checked TokenShop subset out of the Overview evidence panel and into the first real Progression-side TokenShop editor slice
  - user question: `What do the grounded upgrades I can already inspect actually do at my current level and on the next level?`
  - minimum required inputs: checked TokenShop row-remap subset for `ATU1Level`, `ATU2Level`, `ATU3Level`, `ATU4Level`, `ATU5Level`, `ATU6Level`, `ATU7Level`, and `ATU8Level`, local non-canonical editor levels for that same subset, compatibility import as prefill only, and checked `StartCost`, `AdditiveCost`, `Bonus`, and known-cap fields for those same rows
  - explicit non-blockers: token-bank cap or claimable-state recovery, Daily Tokenium cap or ready-state recovery, Emporium state recovery, unresolved TokenShop rows outside the checked subset, best-buy ranking, ROI math, next-purchase recommendation rules
  - current true blocker: closed for this slice; broader planner-safe spend behavior still remains blocked on row identity coverage and a true next-purchase rule set
  - smallest shippable slice: a dedicated TokenShop category under the Progression selector that keeps row order fixed to `ATU1`, `ATU2`, `ATU5`, `ATU6`, saves local checked-row current levels under a non-canonical planner path, uses compatibility import only as prefill, and shows grounded identity, next known cost, known max-level status, and current-vs-next extracted bonus-step change without optimizer claims or canonical `ATU*Level` promotion
- `spend-planner-from-extracted-data`
  - status: `archived`
  - reason: it mixed multiple independent spend blockers that now have distinct exit conditions and should no longer share one queue item
- `spend-multiverse-save-model-recovery`
  - status: `archived`
  - reason: the save-owner question is now grounded enough that the active follow-up is a narrower `SaveData` import-surface decision, not more generic owner recovery

