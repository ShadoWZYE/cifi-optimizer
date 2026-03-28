# MVP Direction

## Core idea

Build a local-first CIFI assistant that answers:

"What should I do next, and why?"

The MVP is not a full simulator. It is an explainable recommendation tool built on grounded player state and labeled planning inputs.

---

## Core inputs

- manual or guided player profile entry
- bundled grounded datasets
- labeled planner-only helper inputs where needed
- optional external/community-tool state only when clearly marked

`state.playerProfile` remains the only shared source of canonical player state.

---

## Core outputs

The MVP should produce a ranked recommendation feed containing:

- upgrades
- warnings
- tradeoffs
- assumptions
- confidence

Each recommendation should be understandable without reverse-engineering the scoring model.

---

## Active MVP modules

### 1. Shards

Purpose:
- grounded shard milestone workflow
- threshold awareness
- descriptive guidance when numeric certainty is incomplete

Rules:
- do not reintroduce invented shard optimizer math
- keep provenance and uncertainty visible

### 2. Spend

Purpose:
- token and diamond planning
- best-next-buy guidance where the data is grounded enough to support it

Rules:
- separate verified cost/value data from heuristics
- avoid pretending extracted data solves the full economy automatically

### 3. Loop guardrails

Purpose:
- reset timing warnings
- catch obviously poor reset behavior

Rules:
- warning-first, not simulator-first
- no fake ROI or prestige certainty

### 4. Unified recommendation feed

Purpose:
- merge shard, spend, and warning outputs into one explainable surface

Rules:
- use one recommendation contract
- clearly distinguish upgrades from warnings

---

## Research tab role

The Research tab is the intake lane for future feature work.

Use it to:

- collect grounded findings
- track uncertainty and provenance
- stage candidate systems before they enter the roadmap
- choose the next feature to promote into implementation

Do not use it to:

- imply a feature is already committed
- ship speculative mechanics as active planner logic
- blur research notes with canonical product behavior

---

## Non-MVP

- OCR-first workflows
- full save parsing
- full-economy simulation
- generic progression tables
- gem-node optimizer expansion
- research systems as shipping product features
- late-game full optimization architecture

These can stay researched, but not promoted without passing through the Research tab intake rule first.

---

## Product philosophy

- Clarity over sophistication
- Trust over breadth
- Guidance over simulation
- Grounded structure over fake precision

---

## Delivery rule

Work should follow the staged execution plan in `docs/research-followup-execution-plan.md` and the PR sequence in `docs/pr-roadmap.md`.
