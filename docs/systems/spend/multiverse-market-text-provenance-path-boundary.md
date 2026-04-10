# Multiverse Market Text-Provenance Path Boundary

This note records the narrowest checked game-side path from a structurally settled Emporium row to text-adjacent evidence, and where that path still fails to reproduce live effect text.

## Checked control row

- control row:
  - `78`
- settled structural row chain:
  - `IS78Level`
  - `IS78ID`
  - `BuyIS78`
  - `SetIS78CostText`
- text-side shell:
  - `THMarkets: TextHandlerMarkets`
  - `SetAllChrystosEmporiumTexts`
  - `9\Assets\Scripts\Text\Text Ouroboros\TextHandlerMarkets.cs`
- recovered text-adjacent source:
  - `Inscryption 78: Ouroboros Orbs`

## What is actually recovered

- A real text-adjacent control-row path exists for row `78`.
- That path is still narrow:
  - the row stays grounded structurally by the same-number save and carrier chain
  - the text-side neighborhood is grounded by `TextHandlerMarkets`
  - the only recovered text is a sparse Unity string anchor
- The new row `78` screenshot shows that this is not a completed live effect-text binding:
  - sparse anchor: `Inscryption 78: Ouroboros Orbs`
  - live screenshot text: `OUROBOROS POINTS GAINED`
- This means the repo can now name one checked game-side text-adjacent source class:
  - direct Unity string anchors in the `TextHandlerMarkets` neighborhood

## What does not scale yet

- The repo also preserves a broader handler-side family:
  - `SetAllBaseBonusTexts`
  - `SetIS1BaseBonusText`
  - `SetIS25BaseBonusText`
  - `SetIS50BaseBonusText`
  - `SetIS68BaseBonusText`
  - `SetIS69BaseBonusText`
- That is a stronger scaling clue than the earlier generic text-provenance blocker.
- It is still not a recovered row-to-text join:
  - no checked repo-local consumer binds `SetISNBaseBonusText` to direct player-facing strings
  - no checked row-local string table or localization-key catalog is recovered
  - no direct strings `Inscryption 69` through `Inscryption 74` are recovered repo-locally

## Exact last missing layer

- The isolated missing layer is now:
  - the `TextHandlerMarkets` base-bonus text binding consumer
- In practical terms, the repo still needs the step that turns:
  - `SetAllBaseBonusTexts`
  - `SetISNBaseBonusText`
into:
  - concrete player-facing effect text
  - or concrete localization keys
  - tied back to ordered Emporium rows

Current grounded conclusion:

- the structural Emporium row model stays unchanged
- rows `78` and `83` are only partial text-adjacent controls, not completed player-facing label bindings
- a control-row text-adjacent source is recoverable, but only as a sparse Unity string anchor
- the broader handler-side scaling clue is the `SetAllBaseBonusTexts` / `SetISNBaseBonusText` family
- the exact remaining blocker is the unrecovered `TextHandlerMarkets` consumer or binding step that resolves those methods into final live player-facing effect text
- compatibility-only import stays quarantined, `InscryptionsDone` stays wrapper-only, and planner-safe use stays blocked
