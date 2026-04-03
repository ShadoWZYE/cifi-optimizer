# Research Tracks

## Purpose

This document backs the in-app Research tab.

Research tracks are an active-work queue for unresolved extraction, mapping, validation, implementation-prep, and painpoint-analysis work. They should behave like a grounded to-do list, not a permanent registry.

A track stays active only while it still represents unresolved work. Once integrated, superseded, or invalidated, remove it from the active list.

## Source priority

Prefer committed APK/Unity extraction artifacts first.

Priority:
1. APK/Unity packages and extraction outputs already in the repo
2. official/public terminology and corroboration
3. community gap-filling or labeled external-model support

Before promoting a track into implementation, record whether the APK/Unity path was checked, what it grounded, and what gaps remain.

## Promotion rule

A track can move into implementation only when:
- the system is described with grounded CIFI terminology
- the source list is documented
- the APK/Unity path has been checked and documented
- confidence and uncertainty are explicit
- the track is classified as canonical, planner-only, external-model, or speculative
- MVP or post-MVP value is clear
- the work can be cut into a meaningful grounded slice

## Working rule

Every active track must expose the next concrete actions needed to move it forward.

The next action may be:
- extract missing game data
- map owner/system boundaries
- validate or reshape dataset inputs
- analyze current player painpoints or community-tool workflow gaps
- harden descriptive-mode UI
- implement a grounded slice

The correct next action is the step that most directly reduces uncertainty, improves player value, or unlocks a meaningful grounded implementation slice.

## Standard track template

Every active track should answer:
- what system is being worked on
- why it matters
- what player painpoint or external-tool workflow it relates to
- current status
- what is already done
- what is left
- next actions
- implementation slice
- sources
- whether the APK/Unity path was checked first
- what is verified
- what is uncertain
- what repo artifacts exist
- what grounded slice would create the most value
- whether it belongs in MVP, post-MVP, or should stay deferred