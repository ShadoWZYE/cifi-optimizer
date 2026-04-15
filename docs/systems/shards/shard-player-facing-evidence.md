# Shard Player-Facing Evidence

This note is the lightweight handoff between the player-facing shard tool and the deeper shard research trail.

Use it when the UI needs to explain the finished shard evidence contract without embedding probe-heavy research directly in player flows.

## Player-facing contract

Safe to show in the app now:

- shards as a real in-game resource tied to Operations and the Shard Mining menu
- loop-reset warnings and shard watch cards
- the direct-serialized `ShardMining` row-definition family as grounded product data
- per-row definition evidence split into title side, unlock requirement, bonus package shape, and row-local cost shell
- explicit `verified`, `partial`, and `blocked` row labels inside the shared shard-family table
- explicit owned-state blocker notes about what is still blocked and why

Not safe to imply in the app:

- recovered player-owned shard milestone state
- a grounded save owner for shard rows
- a grounded import path for shard milestone ownership
- best-buy order
- ROI or ETA certainty
- affordability estimates
- exact next-cost math
- canonical `state.playerProfile` promotion of unresolved shard rows

## Trust note

Tell the player plainly:

- the grounded app can now treat the reachable `ShardMining` row-definition family as grounded product data
- the grounded app shows each row in two lanes: definition evidence on one side and owned-state blockers on the other
- the grounded app cannot yet claim player-owned shard milestone ownership, exact shard cost math, affordability, ROI, ETA certainty, or best-buy order because save-owner mapping and planner-safe cost validation are still unresolved
- external-model imports are an interim compatibility path only and stay non-canonical until their assumptions and saved-state mappings are grounded

External-model compatibility can preserve community-tool payloads or imported unmapped blobs so a player does not lose context during research. That does not make those payloads grounded shard truth or recommendation-grade planner input.

## Status meanings

Shard-family row labels:

- `Verified`: one row now has aligned shipped title-side, row-shell, effect-package, and cost-shell evidence in the shared family table
- `Partial`: the row stays inside the recovered shard family, but at least one player-facing identity or verified-package seam is still unresolved
- `Blocked`: the current row evidence still conflicts or undershoots the recovered shard shell, so stronger player-facing claims would overreach

Owned-state status:

- `Blocked`: no checked save owner, import path, or planner-safe owned-state interpretation is recovered for player-owned shard milestone rows

## Where the UI should stop

The shard page should summarize:

- the grounded definition family that is safe to show now
- the owned-state blockers that remain closed
- why those blocked outputs are still blocked
- where external-model compatibility can help as an interim path
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
