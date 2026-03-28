# Research Tracks

These are non-MVP investigation tracks that may inform future modules.

They are not current product commitments.

## Purpose

Use this document to track future research areas without turning them into premature product scope.

Any future work documented here must still follow the repo grounding rule:
- no invented CIFI mechanics
- no unlabeled model assumptions
- no speculative optimizer behavior presented as truth

---

## Hunter-related planning

Questions to resolve:
- which hunter-related fields belong in canonical game state
- which are build-planning metadata
- what can be grounded externally versus what is only community-tool modeled
- whether hunter logic belongs in MVP at all

Potential future outputs:
- grounded schema proposals
- labeled planning-only helper fields
- source-backed recommendations for later implementation

---

## Mech-related planning

Questions to resolve:
- exact resource names
- true constraints and unlock structure
- whether this belongs in MVP
- whether the first implementation should be descriptive only

This track should remain exploratory until real CIFI terminology and mechanics are verified.

---

## Input automation

Questions to resolve:
- which fields are highest-friction for manual entry
- whether paste/import gives enough value before OCR
- how to keep import UX grounded in actual CIFI concepts

Rule:
automation should follow grounded schema, not define it.

---

## External-model integration

Questions to resolve:
- which community tools are trustworthy enough to support
- how to label model-derived fields clearly
- how to preserve separation between game truth and external modeling

Any future integration must explicitly distinguish:
- verified in-game state
- community-tool derived values
- derived/app-level calculations

---

## Research output standard

Any research result added to the repo should include:
- topic
- source list
- confidence note
- whether it is verified, derived, or speculative
- implementation relevance

If uncertainty remains high, keep the result in research status rather than promoting it into app logic.