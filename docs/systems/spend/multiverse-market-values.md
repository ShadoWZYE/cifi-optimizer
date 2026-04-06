# Multiverse Market Values

Source: serialized `MultiverseMarket` MonoBehaviour payload in [`workbench/unity/joined/level0`](workbench/unity/joined/level0).

## Grounded conclusions

- The late Chrystos Emporium inscription rows are stored directly in the `MultiverseMarket` scene object.
- For the validated late block, each inscription row exposes direct serialized values for `ID`, `MaxLevel`, `Bonus`, `StartCost`, and `CostExponent`.
- The current validated late-block scan yields 22 structurally valid rows before the layout changes again.
- These rows are not serialized in inscription-ID order; they appear to be a display/order list rather than a plain `IS50..IS71` sequence.
- The visible screenshot row `Inscription #51` is present in this block with direct extracted constants.

## Integration status

Verified enough for repo truth:

- `MultiverseMarket` is a real owner for Chrystos Emporium / Inscryptions data.
- The validated late block exposes direct serialized constants for part of the system.
- The serialized rows include concrete `CurrencyBox` pointers, and existing targeted probes recover Emporium cost-shell names such as `CostBox-InscryptionsDone`.

Not yet verified enough for app recommendations:

- the saved-state owner or runtime balance field behind the `Inscryptions Done` cost lane
- player-owned current inscription levels or equivalent state
- full row coverage beyond the current validated block
- final remap from serialized ids to grounded player-facing labels

## Extracted late-block rows

- `IS50`: `MaxLevel=8`; `Bonus=1.0`; `StartCost=1`; `CostExponent=2.3`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS51`: `MaxLevel=10`; `Bonus=8.0`; `StartCost=2`; `CostExponent=2.5`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS52`: `MaxLevel=8`; `Bonus=1.0299999713897705`; `StartCost=3`; `CostExponent=2.4`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS53`: `MaxLevel=8`; `Bonus=1.0`; `StartCost=1`; `CostExponent=2.6`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS54`: `MaxLevel=10`; `Bonus=8.0`; `StartCost=2`; `CostExponent=2.4`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS55`: `MaxLevel=8`; `Bonus=1.0`; `StartCost=3`; `CostExponent=2.2`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS56`: `MaxLevel=10`; `Bonus=8.0`; `StartCost=4`; `CostExponent=2.1`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS63`: `MaxLevel=7`; `Bonus=2.2200000286102295`; `StartCost=1`; `CostExponent=1.8`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS64`: `MaxLevel=8`; `Bonus=1.0`; `StartCost=1`; `CostExponent=2.5`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS65`: `MaxLevel=10`; `Bonus=8.0`; `StartCost=2`; `CostExponent=2.3`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS66`: `MaxLevel=10`; `Bonus=4.440000057220459`; `StartCost=5`; `CostExponent=2.5`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS67`: `MaxLevel=8`; `Bonus=1.0`; `StartCost=1`; `CostExponent=2.8`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS68`: `MaxLevel=10`; `Bonus=8.0`; `StartCost=2`; `CostExponent=2.5`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS69`: `MaxLevel=10`; `Bonus=5000000136282112.0`; `StartCost=5`; `CostExponent=1`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS70`: `MaxLevel=7`; `Bonus=10000000000.0`; `StartCost=6`; `CostExponent=1.04`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS71`: `MaxLevel=10`; `Bonus=0.019999999552965164`; `StartCost=3`; `CostExponent=6`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS72`: `MaxLevel=5`; `Bonus=0.05999999865889549`; `StartCost=1`; `CostExponent=1`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS73`: `MaxLevel=10`; `Bonus=10.0`; `StartCost=2`; `CostExponent=3`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS74`: `MaxLevel=8`; `Bonus=40.0`; `StartCost=3`; `CostExponent=3`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS57`: `MaxLevel=3`; `Bonus=0.05000000074505806`; `StartCost=1`; `CostExponent=1`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS58`: `MaxLevel=10`; `Bonus=5`; `StartCost=2`; `CostExponent=5`; `ProgressObjects=10`; `MaxLevelObjects=10`
- `IS59`: `MaxLevel=5`; `Bonus=5`; `StartCost=3`; `CostExponent=6`; `ProgressObjects=10`; `MaxLevelObjects=10`

## Screenshot anchor

- `Inscription #51` in the provided Emporium screenshot matches a serialized row with `MaxLevel=10`, `Bonus=8`, `StartCost=2`, and `CostExponent=2.5`.
- The same row still points to concrete scene UI objects for its `BuyButton`, `CurrencyBox`, and `MaxOverlay`, confirming this is the real Emporium upgrade block rather than a detached text table.
- `FinalIS*Cost` and `FinalIS*Bonus` are still present in metadata as code-side outputs, but they do not appear as a simple trailing serialized array in this validated block.

## Handler and currency-shell evidence

- Existing targeted repo-local probes recover `CostBox-InscryptionsDone` and `AchievementBar-Inscryptions` alongside Emporium UI shell names.
- Existing targeted repo-local probes also recover direct owner-to-handler links such as `MultiverseMarket, Assembly-CSharp` -> `BuyIS47`, `BuyIS64`, `BuyIS73`, `BuyIS13`, and `BuyIS105`.
- This is enough to ground the Emporium purchase lane around `Inscryptions Done` as a player-facing cost shell.
- This is not yet enough to recover the saved-state balance field or full recommendation-ready player input shape.

