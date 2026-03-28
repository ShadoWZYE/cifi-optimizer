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

Expected columns:
- `id`
- `label`
- `resourceBias`
- `baseCost`
- `costGrowth`
- `baseValue`
- `perLevelValue`
- `breakpoints`
- `confidence`
- `notes`

`breakpoints` can be provided as `level:bonusValue:reason|level:bonusValue:reason`.

### `gemNodes`

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

Expected columns:
- `id`
- `title`
- `goal`
- `nextSteps`

`nextSteps` can be comma-separated in CSV imports.
