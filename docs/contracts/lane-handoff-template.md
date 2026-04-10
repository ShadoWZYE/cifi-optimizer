# Lane Handoff Template

Use this for a compact lane result or branch handoff when a full research note would add too much overhead.

Keep it short. Prefer one screen of text.

## When to use it

- branch handoff between grounding passes
- fresh-thread restart context
- narrow lane result that changes blockers or closes a false path
- queued-lane activation handoff

Do not use it as a substitute for:

- shipped dataset contracts
- deep verification notes
- full research notes that support dataset promotion

## Template

```md
# Lane Handoff

- Lane: `<track id>`
- Status: `active | queued | blocked | closed`
- Date: `YYYY-MM-DD`
- Scope: `<the narrow slice this handoff covers>`
- User-facing question: `<what player question this slice is trying to answer>`
- Minimum required inputs: `<only the inputs this slice actually consumes>`
- Explicit non-blockers: `<adjacent lanes that should stay visible but should not block this slice>`
- Current true blocker: `<single strongest blocker>`
- Smallest shippable tool slice: `<smallest honest slice worth shipping>`

## Grounded carry-forward

- `<verified fact that is safe to reuse>`
- `<verified fact that is safe to reuse>`

## Boundary to preserve

- `<what is narrowed but not solved>`
- `<what must stay descriptive or blocked>`

## Known false paths

- `<interpretation that should stay closed>`
- `<interpretation that should stay closed>`

## Open sources

- `<1-3 lane docs or artifacts to open first>`
```

## Field guidance

- `Lane`: use the existing `researchTracks` id when one exists
- `User-facing question`: keep it player-facing and concrete
- `Minimum required inputs`: list only consumed inputs, not every unresolved neighbor
- `Explicit non-blockers`: name adjacent unresolved lanes that should stay separate
- `Current true blocker`: use the strongest blocker, ideally the current `blockedBy`
- `Smallest shippable tool slice`: describe the smallest useful tool or surface that can ship honestly
- `Grounded carry-forward`: only facts already supported by repo-local evidence
- `Boundary to preserve`: narrowed checked seams, not guesses
- `Known false paths`: only ruled-out interpretations, not unresolved hypotheses
- `Open sources`: keep this to the minimum set needed to restart work
