# Shard Player-Facing Evidence

This note is the lightweight handoff between player-facing shard pages and the deeper shard research trail.

Use it when the UI needs to explain what shard evidence is safe to show without embedding probe-heavy research directly in player flows.

## Player-facing contract

Safe to show in the app now:

- shards as a real in-game resource tied to Operations and the Shard Mining menu
- loop-reset warnings and shard watch cards
- descriptive unlock thresholds and cost-bump notes
- descriptive shard-cost evidence with explicit status labels

Not safe to imply in the app:

- best-buy order
- ROI or ETA certainty
- affordability estimates
- exact next-cost math
- recovered player-owned shard milestone state

## Status meanings

- `Available`: repo data supports a descriptive evidence claim for the current shard view
- `Integrated`: bundled descriptive data is intentionally shown in the player-facing UI
- `Blocked`: a stronger player-facing claim would overreach the current grounding contract
- `Unmapped`: evidence exists nearby, but the exact row owner or player-owned mapping is unresolved

## Where the UI should stop

The shard page should summarize:

- what is safe to show now
- what remains blocked
- where the user can open the deeper docs

The shard page should not inline:

- long probe inventories
- byte offsets
- metadata neighborhood dumps
- extraction candidate walkthroughs
- multi-paragraph research recaps

## Deep docs

Grounding and contract:

- [shard-grounding-boundary.md](docs/systems/shards/shard-grounding-boundary.md)
- [shard-system-verification.md](docs/systems/shards/shard-system-verification.md)
- [shard-owner-family-verification.md](docs/systems/shards/shard-owner-family-verification.md)

Cost recovery and probes:

- [shard-cost-parameter-probe.md](docs/systems/shards/shard-cost-parameter-probe.md)
- [shard-cost-native-probe.md](docs/systems/shards/shard-cost-native-probe.md)
- [shard-cost-method-probe.md](docs/systems/shards/shard-cost-method-probe.md)
- [shard-cost-list-path-probe.md](docs/systems/shards/shard-cost-list-path-probe.md)
- [shard-scene-monobehaviour-probe.md](docs/systems/shards/shard-scene-monobehaviour-probe.md)

Follow-up work:

- [shard-extraction-candidates.md](docs/systems/shards/shard-extraction-candidates.md)
- [shard-milestones-grounding-ingest.md](docs/systems/shards/shard-milestones-grounding-ingest.md)
- [shard-milestones-codex-task-pack.md](docs/systems/shards/shard-milestones-codex-task-pack.md)
