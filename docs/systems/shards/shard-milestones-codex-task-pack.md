# Codex Task Pack: Wire Grounded Shard Milestones Into the App

## Start state
- Start from fresh `main`.
- Pull latest `main` before making changes.
- Create a new branch named `codex/shard-milestones-grounded-import`.

## Source report
- `docs/research/shard-milestones-grounded-2026-03-28.md`

## Files to add
- `data/shard-milestones.grounded.v1.json`
- `data/shard-observed-behaviors.grounded.v1.json`
- `data/shard-milestones-provenance.grounded.v1.json`
- `docs/systems/shards/shard-milestones-grounding-ingest.md`

## Implementation goal
Import the new grounded shard milestone artifacts into `ShadoWZYE/cifi-optimizer` and wire them into the app in grounded descriptive mode.

## Constraints
- Preserve CIFI casing.
- Keep diffs focused and incremental.
- Do not move generated runtime artifacts into `research/`.
- Do not invent shard cost tables, shard cost formulas, ROI math, ETA math, or best-upgrade logic.
- Do not re-enable authoritative shard ranking.
- Separate canonical game data, observed player behavior, and uncertainty/provenance.
- Keep all player truth under `state.playerProfile`.
- Follow the existing recommendation contract shape for any user-facing shard output.

## Required app changes
1. Add the new files above.
2. Update the app snapshot/bootstrap flow so grounded shard milestone data is available to the UI without replacing the entire snapshot architecture.
3. Keep `runProgressionOptimization()` in descriptive mode.
4. Replace the current generic shard warning copy with grounded copy that references imported milestone data while explicitly stating that ranking remains disabled because shard costs are still unknown.
5. Surface descriptive shard facts only, such as:
   - shard milestone count in the dataset
   - rarity threshold schedules
   - known level-cap notes
   - explicit cost-breakpoint notes
   - preserved uncertainty notes when relevant
6. If validation fixtures are easy to add incrementally, use `data/shard-observed-behaviors.grounded.v1.json` to add or update non-authoritative validation/display fixtures. Do not convert them into optimizer truths.
7. If import tooling is touched, keep shard import restricted to the verified-safe descriptive schema only.
8. Do not remove the fallback warning behavior unless the replacement stays clearly descriptive.

## Suggested integration shape
- Load `data/shard-milestones.grounded.v1.json` as the active descriptive shard dataset.
- Keep `data/shard-milestones-provenance.grounded.v1.json` for review/docs/uncertainty display, not scoring.
- Treat `data/shard-observed-behaviors.grounded.v1.json` as observed examples only.
- Prefer a small renderer/helper for shard descriptive output instead of reworking the app architecture.

## Verification
Run the repo verification that already exists, at minimum:
- `npm test` if configured
- any existing smoke test in the repo
- a quick manual app load check that the shard panel/recommendation area renders without errors

## Git workflow
1. Create branch `codex/shard-milestones-grounded-import`.
2. Commit with a focused message such as: `feat: add grounded shard milestone datasets`
3. Push the branch.
4. Open a PR against `main`.

## PR summary requirements
State clearly that:
- shard milestone data is now imported in grounded descriptive mode
- milestone costs and ranking logic remain intentionally disabled
- observed player behaviors are stored separately from canonical mechanics
- provenance and uncertainty were preserved without inventing formulas

