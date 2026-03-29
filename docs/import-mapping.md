# Import Mapping

The Data page accepts CSV or JSON arrays and normalizes them into the active app snapshot.

Separate from those snapshot imports, the Profile page may accept a single PlayerProfile JSON document. That path must normalize into `state.playerProfile` and keep canonical, planner-only, external-model, and compatibility fields labeled.

## PlayerProfile JSON import

Status:
- MVP-safe guided/manual import support
- import must run through the PlayerProfile normalizer, not direct assignment
- the Profile page should show where imported values landed: canonical, planner-only, external-model, or compatibility

Accepted shapes:
- current nested PlayerProfile schema
- legacy flat fields already supported by `normalizePlayerProfile`

Grounding rules:
- canonical shared truth stays under `player` and `meta`
- planner-only values stay under `planning`
- external/community-tool state stays under `externalModels`
- unresolved legacy values stay under `compatibility`
- imported blobs for real-but-unmapped systems stay under `compatibility.unmappedSystemState`

Boundary note:
- legacy `gemDust` may be preserved under `compatibility.unresolvedProfileFields.gemDust`
- it must not be treated as the active experimental gem-node budget unless a user explicitly maps it into `externalModels.experimental.gemNodes.budget`
- imported objects like `systems.shardMilestones`, `systems.tokenShop`, or `systems.multiverseMarket` may be preserved under `compatibility.unmappedSystemState.*`
- preserving those objects does not make the system planner-ready or canonical

## Supported datasets

### `shipLoadouts`

Expected columns:
- `id`
- `name`
- `resourceBias`
- `powerScale`
- `speedScale`
- `cargoScale`
- `risk`
- `notes`

### `shardMilestones`

Current status:
- import is disabled pending a verified-safe shard milestone schema
- do not treat cost, value, growth, breakpoint, or ROI-style fields as grounded input

Future shard milestone imports should only be re-enabled once the repo has:
- verified source provenance
- a reviewed descriptive or verified-safe record shape
- clear labeling for any non-canonical fields

### `gemNodes`

Status:
- experimental / non-MVP

Expected columns:
- `id`
- `label`
- `level`
- `maxLevel`
- `cost`
- `value`
- `tags`

`tags` can be comma-separated in CSV imports.

### `validationCases`

Expected columns:
- `id`
- `module`
- `title`
- `expected`
- `description`

### `researchTracks`

Status:
- non-MVP research only

Expected columns:
- `id`
- `title`
- `goal`
- `nextSteps`

`nextSteps` can be comma-separated in CSV imports.
