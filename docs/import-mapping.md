# Import Mapping

The Data page accepts CSV or JSON arrays and normalizes them into the active app snapshot.

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
