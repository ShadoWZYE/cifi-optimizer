# Import Mapping

The Data page imports CSV or JSON arrays into the app snapshot. The Profile page imports one PlayerProfile JSON document and normalizes it into `state.playerProfile`.

## PlayerProfile import rules

- guided/manual import is MVP-safe
- import must run through the PlayerProfile normalizer
- the Profile page should show where values landed: canonical, planner-only, external-model, or compatibility

Accepted shapes:

- current nested PlayerProfile schema
- legacy shapes still listed in `PLAYER_PROFILE_IMPORT_ALIASES`

Alias inventory:

- source: [`player-profile.js`](player-profile.js)
- checked-in audit:
  - [`docs/contracts/player-profile-import-aliases.md`](docs/contracts/player-profile-import-aliases.md)
  - [`data/player-profile-import-aliases.v1.json`](data/player-profile-import-aliases.v1.json)

Future alias changes should update the inventory, the audit artifacts, and migration smoke checks together.

## Boundary summary

- canonical shared truth lives under `player` and `meta`
- planner-only values live under `planning`
- external/community-tool state lives under `externalModels`
- unresolved legacy values live under `compatibility`
- imported blobs for real-but-unmapped systems live under `compatibility.unmappedSystemState`

Versioned external-model community tooling lives under:

- `externalModels.communityTools.shipOptimizer.v1`
- `externalModels.communityTools.shardOptimizer.v1`
- `externalModels.communityTools.modTreeOptimizer.v1`

Each versioned payload must carry provenance metadata:

- `toolName`
- `toolVersion`
- `sourceReference`
- `assumptionsSummary`
- `data`

## Important migration notes

- legacy `gemDust` may still be preserved under `compatibility.unresolvedProfileFields.gemDust`
- it must not be treated as an active gem-node budget unless explicitly mapped into `externalModels.experimental.gemNodes.budget`
- experimental helper imports now require explicit `externalModels.experimental.*` paths
- shard helper aliases such as `shardRatePerHour`, `totalShardMilestoneLevels`, `shardFocusMilestoneId`, `shardFocusMilestoneLevel`, and their `systems.shards.*` forms still normalize into `planning.shards.*`
- those shard helper fields stay planner-only; importing them does not promote shard milestone math into canonical truth
- `stage.highestShipUnlocked`, `stage.manualPhase`, and `systems.metaProgression.*` aliases should normalize into compatibility-only fields
- preserving those aliases is migration safety only; it does not make hunter, mech, or stage terms active MVP truth
- flat unresolved aliases such as `hunterLevel`, `traitSphereCount`, `mechParts`, and `gemDust` are retired
- ship implementation imports now require `systems.ship.*` or `externalModels.shipPlanner.*`; top-level `power`, `speed`, and `cargo` are retired
- versioned `externalModels.communityTools.*` payloads are external-model state only; they must not silently populate canonical `player.*` fields or planner-approved shard inputs
- imported objects like `systems.shardMilestones`, `systems.tokenShop`, or `systems.multiverseMarket` may be preserved under `compatibility.unmappedSystemState.*`
- flat spend-state clues such as `InscryptionsDone`, `IS*Level`, `TokenBankCap`, `ClaimableBankTokens`, or `FinalTokenBankFillSpeed` may also be preserved under `compatibility.unmappedSystemState.*`
- preserving those objects does not make the system planner-ready or canonical

## Snapshot dataset imports

### `shipLoadouts`

Columns:

- `id`
- `name`
- `resourceBias`
- `powerScale`
- `speedScale`
- `cargoScale`
- `risk`
- `notes`

### `shardMilestones`

Status:

- import is disabled pending a verified-safe schema
- do not treat cost, value, growth, breakpoint, or ROI-style fields as grounded input

Re-enable only after verified provenance, reviewed descriptive or verified-safe shape, and clear non-canonical labeling.

### `gemNodes`

Status:

- experimental / non-MVP

Columns:

- `id`
- `label`
- `level`
- `maxLevel`
- `cost`
- `value`
- `tags`

`tags` can be comma-separated in CSV imports.

### `validationCases`

Columns:

- `id`
- `module`
- `title`
- `expected`
- `description`

### `researchTracks`

Status:

- non-MVP research only

Columns:

- `id`
- `title`
- `goal`
- `nextSteps`

`nextSteps` can be comma-separated in CSV imports.


