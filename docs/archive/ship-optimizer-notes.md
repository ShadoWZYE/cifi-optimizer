# Ship Optimizer Notes

This file captures the current known shape of the real CiFi ship optimizer problem.

## Confirmed model

- A player can maintain 3 loadouts at a time.
- Loadouts are often swapped depending on LR stage or target.
- Each loadout includes all ships, not just one ship.
- Each ship has install points allocated within that loadout.
- Install order matters because in-game automation follows the order in which installs were originally assigned.
- The optimizer therefore needs to model both:
  - final install totals
  - install sequence / install priority

## Constraints

- Not all installs are available at all times.
- Install availability depends on progression/calibration state.
- The existing Desmos tool likely encodes some of those constraints and should be mined for them.
- Calibration therefore needs to capture unlock state, available installs, and likely post-traversal modifiers.

## Post-Ouroboros requirement

- Meltdown affects all systems after Ouroboros unlock / first traversal.
- Ship optimization cannot be treated as isolated from the rest of the game once meltdown is active.
- The shared profile and loadout optimizer should include a meltdown-related state field once the real schema pass starts.

## Rebuild target

The ship optimizer module should evolve toward:

- loadout set planning across 3 slots
- per-ship install recommendation
- install-order-aware output
- legality checks for install availability
- LR-stage-aware recommendations
- meltdown-aware scoring
