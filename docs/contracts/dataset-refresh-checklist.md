# Dataset Refresh Checklist

Use this checklist before promoting a new bundled dataset or refreshing an existing shipped JSON asset.

## When to use it

Use this for:

- new bundled dataset files under `data/`
- schema changes to an existing bundled dataset
- classification changes for a shipped dataset
- research-note promotions that are intended to become shipped repo truth

## Promotion checklist

1. Confirm the source-priority order is explicit:
   - APK/Unity artifacts and repo extraction outputs first
   - official/public corroboration second
   - community gap-filling last
2. Update or add the supporting research note.
3. Record the shipped dataset in `data/bundled-dataset-contract.v1.json`.
4. Keep the dataset classification truthful:
   - `canonical-app-snapshot`
   - `grounded-descriptive`
   - `extracted-mechanics`
   - `community-derived`
5. Update `docs/contracts/dataset-contracts.md` if the shipped dataset set or grounding rules changed.
6. Update any roadmap or research-track status text if the promotion changes the current slice.
7. Run `npm run verify:data`.
8. Run `npm test`.
9. Run `npm run check:syntax` if app-facing copy or rendering changed.

## Research note minimums

Any research note that supports a bundled dataset promotion should explicitly record:

- topic
- source list
- APK/Unity path status
- confidence note
- uncertainty note
- data classification
- implementation relevance
- recommended next step

Use `docs/contracts/research-note-template.md` for new notes.

Use `docs/contracts/lane-handoff-template.md` for compact branch or lane handoffs that do not promote shipped repo truth.
Those handoffs should preserve lane ownership by recording the current blocker and default next adjacent step, not by implying one-off task completion.

