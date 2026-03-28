# Game Data Ingest Process

## Goals

- Keep verified game data separate from player state.
- Import reference spreadsheets into app-owned versioned snapshots.
- Make updates reviewable before they affect optimizer behavior.

## Proposed workflow

1. Export source sheet tabs into normalized JSON or CSV artifacts.
2. Map raw sheet columns into stable internal records by subsystem.
3. Attach snapshot metadata:
   - source URL
   - capture date
   - source sheet/tab names
   - import notes
4. Run validation comparisons against benchmark cases before promoting a new snapshot.
5. Store the promoted snapshot as the current app version and keep older snapshots for regression diffs.

## Initial subsystems

- Resource goal weighting
- Ship/loadout presets
- Progression action tables
- Gem node value tables
- Trait sphere constants
- Hunter seed metadata

## Review gates

- No silent schema changes
- No snapshot promotion without benchmark results
- Confidence notes required for partially verified formulas
