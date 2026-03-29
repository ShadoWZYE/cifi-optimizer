# Research Tracks

## Purpose

This document backs the in-app Research tab. Research tracks hold grounded findings, uncertainty, and candidate implementation paths until they are mature enough for roadmap work.

Research tracks are not product commitments.

## Source priority

Research should prefer committed APK/Unity extraction artifacts first.

Priority:

1. APK/Unity packages and extraction outputs already in the repo
2. official/public terminology and corroboration
3. community gap-filling or labeled external-model support

Before a track is promoted, record whether the APK/Unity path was checked, what it grounded, and what gaps remain.

For new notes, use `docs/contracts/research-note-template.md`.

## Promotion rule

A track can move into the roadmap only when:

- the system is described with grounded CIFI terminology
- the source list is documented
- the APK/Unity path has been checked and documented
- confidence and uncertainty are explicit
- the track is classified as canonical, planner-only, external-model, or speculative
- MVP or post-MVP value is clear
- the work can be cut into a shippable chunk

Otherwise it stays in research.

## Standard track template

Every track should answer:

- what system is being researched
- why it matters
- what is already done
- what is left
- what the current implementation slice is
- what sources exist
- whether the APK/Unity path was checked first
- what is verified
- what is uncertain
- what repo artifacts exist
- what the smallest shippable slice would be
- whether it belongs in MVP, post-MVP, or should stay deferred

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

- keep in research until the repo can answer which hunter fields are real state, which are planning metadata, and whether a first slice would only be descriptive

Mech-related planning:

- keep in research until terminology, unlock structure, and MVP relevance are grounded

Input automation:

- keep in research until the repo can show which manual inputs are high-friction and whether guided import is enough without OCR

External-model integration:

- keep in research until the repo can show which tools are trustworthy, how fields stay labeled, and how recommendations avoid mixing app truth with model assumptions

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

If uncertainty remains high, the correct outcome is a better research note, not product code.

