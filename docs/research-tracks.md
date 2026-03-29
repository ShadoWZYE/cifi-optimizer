# Research Tracks

## Purpose

This document backs the in-app Research tab.

The Research tab is now the intake mechanism for choosing future feature work. Its job is to hold grounded findings, uncertainty, and candidate implementation paths until a track is mature enough to enter the roadmap.

Research tracks are not product commitments.

---

## Source priority

Research should prefer the repo's committed APK and Unity extraction artifacts as the primary grounding path.

Use source priority in this order:

1. APK/Unity packages and extraction outputs already available in the repo
2. official/public sources for terminology, labeling, and corroboration
3. community sources for gap-filling or clearly labeled external-model behavior

Before a research track is promoted into roadmap work, it should explicitly record whether the APK/Unity path was checked, what it produced, and what gaps remain.

For new notes, use `docs/research-note-template.md`.

---

## Promotion rule

A research track can move into the roadmap only when all of the following are true:

- the system is described using grounded CIFI terminology
- the source list is documented
- the APK/Unity grounding path has been checked and documented
- the confidence and uncertainty are explicit
- the track is classified as canonical, planner-only, external-model, or speculative
- the MVP or post-MVP value is clear
- the work can be cut into a shippable chunk

If those conditions are not met, the track stays in research status.

---

## Standard track template

Every track should answer:

- what system is being researched
- why it matters
- what is already done in the repo
- what work is still left
- what the current implementation slice is
- what sources exist
- whether the APK/Unity package path was checked first
- what is verified
- what is still uncertain
- what data artifacts exist in the repo
- what would be the smallest shippable implementation slice
- whether it belongs in MVP, post-MVP, or should stay deferred

---

## Active track categories

### Candidate MVP-adjacent tracks

These may influence near-term work if grounding improves enough:

- spend-planner refinements
- loop-warning refinements
- manual/guided import improvements
- recommendation-feed explainability improvements

### Post-MVP candidate tracks

These may become roadmap candidates later, but are not current commitments:

- ship optimizer reintegration
- hunter-related planning
- mech-related planning
- academy or Zeus-adjacent systems
- external-model integrations beyond the current labeled surfaces

### Deferred infrastructure tracks

- OCR or image-assisted input
- deeper automation
- full save parsing
- broad simulation architecture

---

## Current track rules

### Hunter-related planning

Keep this in research until the repo can clearly answer:

- which hunter fields are real game state
- which are planning metadata
- which data can be grounded from sources already in the repo
- whether the first implementation would be descriptive only

### Mech-related planning

Keep this in research until the repo can clearly answer:

- exact CIFI terminology
- unlock and constraint structure
- whether it belongs anywhere near MVP
- whether there is enough grounded data for more than documentation

### Input automation

Keep this in research until the repo can clearly answer:

- which manual inputs create the most friction
- whether guided import is enough without OCR
- how automation can follow grounded schema instead of defining it

### External-model integration

Keep this in research until the repo can clearly answer:

- which tools are trustworthy enough to support
- how model-derived fields will stay labeled in UI and data
- how recommendations avoid mixing app truth with external-model assumptions

---

## Research output standard

Any research result added to the repo should include:

- topic
- source list
- confidence note
- uncertainty note
- data classification
- implementation relevance
- recommended next step

For research that may promote shipped data, also follow `docs/dataset-refresh-checklist.md`.

If uncertainty remains high, the correct outcome is a better research note, not product code.
