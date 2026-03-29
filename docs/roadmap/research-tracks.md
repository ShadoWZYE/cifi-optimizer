# Research Tracks

## Purpose

This document backs the in-app Research tab.

Research tracks are an active-work queue for unresolved research, extraction, mapping, validation, and implementation-prep work. They should behave like a grounded to-do list, not a permanent registry.

A track stays in the active list only while it still represents unresolved work. Once the work is fully integrated, superseded, or invalidated, the track should be removed from the active list.

Research tracks are not automatic product commitments, but they are the default intake and staging area for roadmap-adjacent work that is not yet fully closed.

## Source priority

Research should prefer committed APK/Unity extraction artifacts first.

Priority:

1. APK/Unity packages and extraction outputs already in the repo
2. official/public terminology and corroboration
3. community gap-filling or labeled external-model support

Before a track is promoted into implementation or roadmap work, record whether the APK/Unity path was checked, what it grounded, and what gaps remain.

For new notes, use `docs/contracts/research-note-template.md`.

## Lifecycle

Tracks should move through a simple active-work lifecycle:

- `needs-extraction`
- `needs-mapping`
- `needs-validation`
- `ready-for-implementation`
- `in-implementation`
- `blocked`

A track leaves the active list when it is:

- fully integrated into the app or roadmap-owned workflow
- superseded by narrower successor tracks
- invalidated by newer findings
- no longer worth pursuing

Completed tracks should be removed from the active list rather than left behind as clutter. If historical context matters, preserve it in commit history, linked notes, or archived docs rather than in the active queue.

## Intake rule

Add new tracks when unresolved work appears from:

- current APK/Unity probes or extraction findings
- roadmap follow-ups
- implementation gaps discovered during active work
- on-demand research requests
- doc or dataset conflicts discovered during grounding

If a new finding creates a genuinely new unresolved work item, add a new track. If it only updates an existing unresolved work item, update that track instead of creating duplication.

## Promotion rule

A track can move from research-prep into implementation or roadmap work only when:

- the system is described with grounded CIFI terminology
- the source list is documented
- the APK/Unity path has been checked and documented
- confidence and uncertainty are explicit
- the track is classified as canonical, planner-only, external-model, or speculative
- MVP or post-MVP value is clear
- the work can be cut into a shippable chunk

Otherwise the next action should stay in extraction, mapping, validation, or descriptive-mode hardening rather than speculative product implementation.

## Working rule

Every active track must expose the next concrete actions needed to move it forward.

The first next action may be any of:

- extract missing game data
- map owner/system boundaries
- validate or reshape dataset inputs
- correct stale docs
- harden descriptive-mode UI
- implement a grounded slice

The correct next action is whichever shortest step most directly reduces uncertainty or unlocks a shippable grounded slice.

## Standard track template

Every active track should answer:

- what system is being worked on
- why it matters
- current status
- what is already done
- what is left
- next actions
- what the current implementation slice is, if any
- what sources exist
- whether the APK/Unity path was checked first
- what is verified
- what is uncertain
- what repo artifacts exist
- what the smallest shippable grounded slice would be
- whether it belongs in MVP, post-MVP, or should stay deferred

## Recommended track shape

Use this shape for active tracks:

- `title`
- `status`
- `priority`
- `why it matters`
- `done`
- `remaining`
- `next actions`
- `implementation slice`
- `sources`
- `apk/unity path checked`
- `verified`
- `uncertain`
- `repo artifacts`
- `classification`
- `target stage` (`MVP`, `post-MVP`, `deferred`)
- `exit condition`

## Track categories

Candidate MVP-adjacent:

- spend-planner refinements
- loop-warning refinements
- manual/guided import improvements
- recommendation-feed explainability improvements

Post-MVP candidates:

- ship optimizer reintegration
- hunter planning
- mech planning
- academy/Zeus-adjacent systems
- broader external-model integrations

Deferred infrastructure:

- OCR/image-assisted input
- deeper automation
- full save parsing
- broad simulation architecture

## Current track rules

Hunter-related planning:

- keep in active research until the repo can answer which hunter fields are real state, which are planning metadata, and whether a first slice should remain descriptive

Mech-related planning:

- keep in active research until terminology, unlock structure, and MVP relevance are grounded

Input automation:

- keep in active research until the repo can show which manual inputs are high-friction and whether guided import is enough without OCR

External-model integration:

- keep in active research until the repo can show which tools are trustworthy, how fields stay labeled, and how recommendations avoid mixing app truth with model assumptions

## Research output standard

Any research result added to the repo should include:

- topic
- source list
- confidence note
- uncertainty note
- data classification
- implementation relevance
- recommended next step

For research that may promote shipped data, also follow `docs/contracts/dataset-refresh-checklist.md`.

If uncertainty remains high, the correct outcome is a better research note, better extraction coverage, or a clearer validation step — not speculative product code.