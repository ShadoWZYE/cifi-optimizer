# Shard Cost Screenshot Calibration

Source: player-provided in-game shard milestone screenshots preserved in [`data/shard-cost-screenshot-calibration.v1.json`](C:\Users\Shadow\Desktop\CiFi\data\shard-cost-screenshot-calibration.v1.json).

## Grounded conclusions

- The checked calibration set now preserves five in-game shard cost checkpoints: rows `1`, `9`, `14`, `21`, and `25`.
- These checkpoints span both pre-threshold and post-threshold rows, including examples above the native `100+` and `200+` stage breaks.
- The visible costs stay in the `e563-e565` range even where the currently recovered `StartCost` mantissas remain small, which keeps the unresolved integer lane live as a real magnitude candidate.
- The screenshots are calibration anchors for candidate formulas, not final formula proof.

## Checkpoints

- `row=1`; `title=#1 THE ALPHA MILESTONE`; `level=283`; `cost=1.89e565`
- `row=9`; `title=#9 THE PRODUCING MILESTONE`; `level=20`; `cost=3.31e564`
- `row=14`; `title=#14 THE PATHING MILESTONE`; `level=153`; `cost=9.73e565`
- `row=21`; `title=#21 THE TARGETING MILESTONE`; `level=126`; `cost=1.20e565`
- `row=25`; `title=#25 THE FABRICATING MILESTONE`; `level=16`; `cost=5.38e563`

## Current boundary

- Treat these screenshot costs as in-game checkpoints supplied by the player.
- Treat them as calibration anchors for candidate shard formulas, especially around the native `100+`, `200+`, and `300+` stage bands.
- Do not promote a computed shard next-cost until the repo matches these checkpoints with a verified runtime equation.
