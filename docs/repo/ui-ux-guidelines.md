# UI/UX Guidelines

## Purpose

Keep the app easy to navigate as the grounded MVP grows. Each surface should have one clear job, preserve provenance boundaries, and avoid mixing player tools with research or implementation detail.

## Surface Hierarchy

1. `Pilot tools`
   - Main player workflow surfaces.
   - Consume shared `state.playerProfile` and other product-facing state.
   - Default destination for actions a player would take repeatedly.

2. `Support tools`
   - Product-adjacent verification or planner support.
   - May expose implementation detail, but must stay clearly labeled.
   - Should support a primary tool, not replace it.

3. `Reference and exploration`
   - Research, evidence, blocked work, or experimental planners.
   - Must not read like production-safe advice unless explicitly labeled.

## Page Ownership

### Command Center

- Show status, shared readiness, and the unified recommendation feed.
- Do not duplicate owning tools or subsystem-specific helper panels here.
- If a summary starts looking like a second copy of another page, remove it and extend the feed instead.

### Player Profile

- Own canonical player entry, optional planner helpers, import/export, and namespace audit.
- Keep canonical entry separate from import review and compatibility audit.
- Do not mix deep subsystem-specific research notes into this page.

### Progression Bay

- Own player-facing progression tools only.
- Each subsystem should keep its own section or toggle target.
- Do not duplicate generic import, validation, or research content here.

### Import Hangar

- Own dataset intake, import preview, OCR intake, and import/source history.
- Keep experimental OCR visually and semantically separate from grounded imports.
- Keep the grounded intake path first, OCR support after it, and source history last.
- Do not host product recommendations here.

### Ship Workbench

- Own ship planner calibration, loadout editing, and planner readout.
- Separate setup/calibration from active editing from recommendations.
- Avoid bright visual islands that break the rest of the shell.

### Grounding Console

- Own checks, validation partitions, and drift review.
- Keep grounded, APK, and support checks visibly separated.
- Lead with run controls, then explain scopes, then show detailed results.
- Keep research-heavy boundary writeups out of the main validation result grid unless the console is the clear owner.

### Research Archive / Gem Node Lab

- Own evidence, blockers, future lanes, and experimental planners.
- Must stay clearly off the main product path.
- Separate archive contract, track-view controls, and actual track cards into distinct panels.

## Panel Contract

Every major panel should answer:

- What is this panel for?
- What inputs belong here?
- What outputs belong here?
- What does not belong here?

If a panel cannot answer those in one short header and one short supporting note, it is probably carrying too much.

## Composition Rules

- One panel, one job.
- Do not duplicate the same conceptual slice on multiple pages unless one is a summary and the other is the owner.
- Prefer summary -> owning page, not full tool -> another full tool.
- Avoid page-level two-column shells for primary surfaces; stack panels and let the owning tool use the width.
- Keep action controls near the state they change.
- Keep recommendations separate from configuration when comparison matters.
- Collapse helper-dense editors by default when they would otherwise dominate the page.

## Save Behavior

- Default to auto-save for ordinary UI editing.
- Use explicit commands only for deliberate artifact creation or destructive actions.
- Examples of explicit actions that still belong:
  - export
  - import/apply
  - capture snapshot
  - reset/clear/undo

Do not add `Save` buttons for routine field editing unless there is a concrete transactional requirement.

## Copy Rules

- Prefer product language over temporary implementation language in visible UI.
- Use implementation labels only when the distinction is important for provenance.
- Keep headers short and task-oriented.
- Use support text to explain boundaries, not to narrate the UI.

## Visual Rules

- Keep surfaces in one tonal family across the app.
- Avoid high-contrast subthemes that make one panel look like a different product.
- Reserve stronger accent contrast for active state, warnings, or primary calls to action.
- Action rows should use stable grid sizing so buttons do not jitter or look uneven.

## Panel Review Checklist

Before shipping a new panel or editing an existing one, verify:

1. The panel has a single clear purpose.
2. Its content belongs to the owning page.
3. No nearby page already owns the same slice.
4. Routine edits auto-save if safe.
5. Destructive or artifact-producing actions remain explicit.
6. The contrast level matches surrounding surfaces.
7. Buttons align consistently within the row/grid.
8. Product truth, planner helpers, compatibility state, and research evidence remain clearly separated.
