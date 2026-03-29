# Shard Milestones Grounding Ingest

## Source report
- docs/research/shard-milestones-grounded-2026-03-28.md

## Generated artifacts
- data/shard-milestones.grounded.v1.json
- data/shard-observed-behaviors.grounded.v1.json
- data/shard-milestones-provenance.grounded.v1.json

## Safe to use now
- Canonical shard system anchors: shard unlock, operation linkage, loop-reset behavior, menu structure, rarity threshold schedules, level-cap notes, and stated cost-breakpoint notes.
- Descriptive milestone records: names, rarities, unlock requirements, threshold levels, and explicitly cited effect labels and per-level bonus strings.
- Observed player behavior examples as validation or explanatory fixtures only.

## Classification

- System-level shard anchors: grounded enough for repo truth.
- Milestone list and milestone detail rows: community-grounded descriptive data, not yet shipped-game owner-grounded data.
- Observed behavior notes: community-backed explanatory data, not optimizer truth.

## Must stay disabled or descriptive
- Numeric shard cost tables per level.
- Any inferred shard cost formula.
- ROI scoring, best-upgrade ranking, or ETA math based on milestone costs.
- Any logic that collapses source conflicts into one authoritative formula.

## Open uncertainty
- Per-level shard costs are not present in accessible sources.
- Several milestone bonus fields remain Unknown or Unkown in source text and are preserved verbatim.
- Some milestone definitions conflict between older Game-Vault snapshots and Fandom; the normalized runtime file uses the richer Fandom listing while provenance retains the conflict note.
- Some source strings appear truncated or oddly formatted and are preserved as observed.

## Integration guidance
- Load data/shard-milestones.grounded.v1.json as the descriptive shard milestone dataset.
- Use data/shard-observed-behaviors.grounded.v1.json for validation fixtures, hints, or future explainability copy.
- Use data/shard-milestones-provenance.grounded.v1.json for docs, import review, or uncertainty display, not for ranking logic.
- Keep the shard module in grounded descriptive mode until a separately sourced cost table exists.
- Do not present milestone names, unlock tables, or effect rows as Unity/APK-extracted facts unless a shipped-game owner mapping is added first.
