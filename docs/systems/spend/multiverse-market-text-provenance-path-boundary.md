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
- sparse text-adjacent source:
  - `Inscryption 78: Ouroboros Orbs`
- recovered row-local asset slots from the live-asset walk:
  - `CurrentBonusText`
  - `BonusDescriptionText`
  - `PerLevelBonusText`
  - `DescriptionText`
  - `IDText`
  - `IconBox`
- recovered concrete component types on those slots:
  - `UnityEngine.UI.Text`
  - `UnityEngine.UI.Image`
  - `UnityEngine.UI.Outline`
  - `UnityEngine.UI.Shadow`
- recovered serialized ownership edges from the assignment-site pass:
  - `GameObject -> Text/Outline/Shadow/Image` component ownership
  - `RectTransform -> m_GameObject` backlinks
  - `CanvasRenderer -> m_GameObject` backlinks

## What is actually recovered

- A real text-adjacent control-row path exists for row `78`.
- The path now has two checked halves:
  - the row stays grounded structurally by the same-number save and carrier chain
  - the text-side neighborhood is grounded by `TextHandlerMarkets`
  - the repo preserves a sparse Unity string anchor
  - the live-asset seed walk also reaches row-local slot objects and concrete UI text components
- The new row `78` screenshot shows that this is not a completed live effect-text binding:
  - sparse anchor: `Inscryption 78: Ouroboros Orbs`
  - live screenshot text: `OUROBOROS POINTS GAINED`
- Rows `78` and `83` mirror the same slot family in the asset tree, so they remain useful falsifying controls, not solved labels.
- The deeper assignment-site scan now also answers the local serialized-binding question:
  - zero serialized `TextHandlerMarkets` or `MultiverseMarket` producer links point into the recovered row-local text components
  - the live asset graph stops at intrinsic component ownership around the row-local UI subtree
- The runtime code seam is now partially recovered too:
  - `SetAllChrystosEmporiumTexts` directly calls `SetAllBaseBonusTexts`
  - `SetIS78BaseBonusText` and `SetIS83BaseBonusText` read `IS78BaseBonusText` / `IS83BaseBonusText`, compose strings, and end in the standard IL2CPP `UnityEngine.UI.Text` virtual-dispatch write pattern
  - `SetIS78BonusText` and `SetIS83BonusText` also read `IS78BonusText` / `IS83BonusText`, compose strings, and end in the same `UnityEngine.UI.Text` virtual-dispatch write pattern
  - that means the repo now recovers both a checked runtime base-bonus write lane and a separate checked runtime effect-label write lane
- This means the repo can now name two checked game-side text-adjacent source classes:
  - direct Unity string anchors in the `TextHandlerMarkets` neighborhood
  - row-local asset slots with `UnityEngine.UI.Text` components under the checked Emporium row objects

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
  - the recovered runtime `SetISNBaseBonusText` lane writes the base-bonus text, while the separately recovered `SetISNBonusText` lane still does not prove which recovered row-local slot it targets
  - no checked row-local string table or localization-key catalog is recovered
  - the live-asset walk does recover concrete row-local slot objects like `CurrentBonusText`, `BonusDescriptionText`, `PerLevelBonusText`, and `DescriptionText`, but the assignment-site scan shows only local ownership edges into their `UnityEngine.UI.Text` components
  - no direct strings `Inscryption 69` through `Inscryption 74` are recovered repo-locally

## Exact last missing layer

- The isolated missing layer is now:
  - the typed row-local alias for the recovered `ISNBonusText` effect-label writer family, plus any separate `CurrentBonusText` writer
- In practical terms, the repo still needs the step that turns:
  - `SetAllBaseBonusTexts`
  - `SetISNBaseBonusText`
  - `SetIS78BonusText`
  - `SetIS83BonusText`
  - `SetISNBonusText`
  - into one exact recovered row-local slot binding such as `BonusDescriptionText`, while also checking whether `CurrentBonusText` has a different writer family
into:
  - concrete player-facing effect text
  - or concrete localization keys
  - written into the recovered `UnityEngine.UI.Text` components
  - tied back to ordered Emporium rows
- The live local assets no longer look like the missing layer:
  - they do not serialize any producer-side `TextHandlerMarkets` or `MultiverseMarket` links into those text components
  - they only serialize the component graph around the row-local UI subtree
  - the narrowest defensible remaining seam is therefore runtime-side code, not another unresolved local asset link

Current grounded conclusion:

- the structural Emporium row model stays unchanged
- rows `78` and `83` are only partial text-adjacent controls, not completed player-facing label bindings
- a control-row text-adjacent path is recoverable as a sparse Unity string anchor plus a row-local asset-slot chain
- the broader handler-side scaling clue is now a checked runtime write family: `SetAllChrystosEmporiumTexts` -> `SetAllBaseBonusTexts` -> `SetISNBaseBonusText`
- the repo also now recovers a parallel runtime effect-label write family: `SetIS78BonusText` / `SetIS83BonusText` / `SetISNBonusText`
- the exact remaining blocker is the unrecovered typed row-local slot alias for that effect-label writer family, plus any separate `CurrentBonusText` writer, before final live player-facing effect text can be claimed
- compatibility-only import stays quarantined, `InscryptionsDone` stays wrapper-only, and planner-safe use stays blocked
