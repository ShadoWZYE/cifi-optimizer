# Spec Reevaluation Against CiFi Wiki

This document captures where the current first-pass suite is structurally useful but semantically inaccurate.

## What the current prototype gets right

- Shared player profile
- Shared data snapshot model
- Validation as a first-class feature
- Separate optimizer modules
- Local import pipeline for sheet-derived data
- A layout that can support one tool at a time

## What is currently wrong

The current prototype still uses placeholder data and placeholder categories in several places.

Examples:

- some resources and priorities do not map to real CiFi currencies,
- ship optimization is based on invented generic stats rather than real ship/install mechanics,
- progression recommendations are not yet organized around actual CiFi subsystems from the wiki,
- gem-node language is likely too generic and needs to be replaced with the exact in-game terminology and mechanics,
- hunter, trait-sphere, and Ouroboros systems need to be aligned with the wiki naming and menu structure.

## Real system anchors from the wiki

The unified suite should be re-centered around these actual areas:

- Ships
- Loop Prestige / Loop Modifications
- Shard systems
- Research systems
- Space Academy / missions / projects
- Trait Spheres Collection
- Ouroboros Gems Collection
- Hunters Headquarters
- Multiverse Market
- The game's actual currencies

## Recommended rebuild order

Recalibrate one tool at a time, in this order:

1. Shared terminology and profile schema
2. Ship optimizer
3. Broad progression recommender
4. Gem-related optimizer that corresponds to actual in-game systems
5. Trait-sphere optimizer
6. Hunter and mech-related systems

## Ship optimizer details confirmed by user

The ship optimizer must be rebuilt around the actual CiFi loadout system, not generic ship stats.

Confirmed mechanics:

- Players can have 3 ship loadouts at a time.
- These loadouts are commonly swapped between different LRs.
- Each loadout contains every ship in the game.
- Each ship has its own install allocation inside the loadout.
- Loadouts are built one install point at a time initially.
- In-game automation respects the install order used when the loadout is created.
- Available installs are constrained by progression and unlock state.
- Those install availability constraints are part of the calibration problem and may be inferable from the existing Desmos tool.
- Meltdown is a critical cross-system modifier after Ouroboros unlock / first traversal and must be represented in the model.

## Ship optimizer implementation implications

The current placeholder ship model should be replaced with:

- a per-loadout model,
- per-ship install allocation,
- install ordering metadata,
- install availability constraints,
- LR swap intent,
- and meltdown-aware calibration.

This means the ship optimizer should eventually answer questions like:

- which of the 3 loadouts should exist for a given stage,
- what install order each ship should follow,
- which installs are legal or currently available,
- and how loadout recommendations change across LR phases and meltdown state.

## Immediate implementation implications

- Replace placeholder resource names in the shared profile and snapshot with real CiFi names.
- Replace placeholder module copy with actual game-system names from the wiki.
- Re-scope each optimizer around one real source tool instead of a generic placeholder category.
- Use imported sheet data and wiki naming together: the wiki defines the canonical system names, while community sheets provide operational formulas and data tables.

## Working rule going forward

No new optimizer formula or UI copy should be added unless it maps to:

1. a known in-game system from the wiki, or
2. a known community tool that targets a real CiFi system.
