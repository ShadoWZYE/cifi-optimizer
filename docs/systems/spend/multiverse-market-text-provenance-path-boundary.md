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
  - `SetAllChrystosEmporiumTexts` also directly calls `SetAllBonusTexts`
  - `SetIS78BaseBonusText` and `SetIS83BaseBonusText` read `IS78BaseBonusText` / `IS83BaseBonusText`, compose strings, and end in the standard IL2CPP `UnityEngine.UI.Text` virtual-dispatch write pattern
  - `SetIS78BonusText` and `SetIS83BonusText` also read `IS78BonusText` / `IS83BonusText`, source their payload values from `MultiverseMarket.get_FinalIS78Bonus()` / `get_FinalIS83Bonus()`, pass through the now-partially named helper lane `GeneralFunctionsManager.BigDoubleToText` or `System.Int32.ToString` plus two still-unresolved RVAs, and end in the same `UnityEngine.UI.Text` virtual-dispatch write pattern
  - the same exact runtime surface now also preserves the wider `IS1BonusText` through `IS110BonusText` field family and `SetIS1BonusText` through `SetIS110BonusText` writer family on `TextHandlerMarkets`
  - that same runtime surface also preserves `IS1IDText` through `IS110IDText` and `SetIS1IDText` through `SetIS110IDText`, while exposing no `CurrentBonusText`-named field or `SetCurrentBonusText` writer family and no `SetISNDescriptionText` family
  - the widened slot-name assembly search still does not recover any typed Assembly-CSharp owner exposing `CurrentBonusText` as a field or direct `Set*` slot-writer method
  - the widened runtime search also checks `NavigationManager` and `TextHandlerShopNPCs` as the obvious Emporium-adjacent fallback owners for the current-value slot, but only recovers orchestration-side `Market` / `InscryptionList` / `UpdateInscryptionUI` and shop-dialogue-side `EmporiumDialogueText` / `EmporiumCurrentText` / `DisplayTextEmporium`, not any row-local `CurrentBonusText` producer
  - that means the repo now recovers both a checked runtime base-bonus write lane and a separate checked runtime effect-label write lane, and can close the row-local effect-label slot alias by elimination to `BonusDescriptionText`
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
  - the recovered runtime `SetISNBaseBonusText` lane writes the base-bonus text, while the separately recovered `SetAllBonusTexts -> SetISNBonusText` lane now closes to the row-local `BonusDescriptionText` slot because `PerLevelBonusText` aligns with `SetISNBaseBonusText`, `IDText` aligns with `SetISNIDText`, `CurrentBonusText` has no recovered writer family, and `DescriptionText` has no recovered `SetISNDescriptionText` family
  - the control payload source is now narrower than a generic localization blocker because row `78` resolves through `MultiverseMarket.get_FinalIS78Bonus()` then `GeneralFunctionsManager.BigDoubleToText`, and row `83` resolves through `MultiverseMarket.get_FinalIS83Bonus()` then `System.Int32.ToString`, before two still-unresolved helper RVAs and `System.String.Concat`
  - no checked row-local string table or localization-key catalog is recovered
  - the live-asset walk does recover concrete row-local slot objects like `CurrentBonusText`, `BonusDescriptionText`, `PerLevelBonusText`, and `DescriptionText`, but the assignment-site scan shows only local ownership edges into their `UnityEngine.UI.Text` components
  - no direct strings `Inscryption 69` through `Inscryption 74` are recovered repo-locally

## Exact last missing layer

- The isolated missing layer is now:
  - the separate dedicated `CurrentBonusText` runtime writer lane
  - the two still-unresolved formatter-helper RVAs inside the already recovered `BonusDescriptionText` payload path
- In practical terms, the repo still needs the step that turns:
  - `SetIS78BonusText`
  - `SetIS83BonusText`
  - `SetISNBonusText`
  - `SetAllBonusTexts`
  - `MultiverseMarket.get_FinalIS78Bonus()`
  - `MultiverseMarket.get_FinalIS83Bonus()`
  - `GeneralFunctionsManager.BigDoubleToText`
  - `System.Int32.ToString`
  - unresolved helper RVAs `28277222` and `28277761`
  - `System.String.Concat`
  - into the now-closed row-local slot binding `BonusDescriptionText`
- What is still not recovered is:
  - the dedicated runtime method family, if any, that writes `CurrentBonusText`, after explicit negative checks against `TextHandlerMarkets`, `NavigationManager`, and `TextHandlerShopNPCs`
  - the exact helper/type names behind the remaining formatter RVAs `28277222` and `28277761` inside the already recovered `BonusDescriptionText` payload path
  - a broader typed join from that runtime path back to rows `69-74` or the rest of the Emporium table
- The live local assets no longer look like the missing layer:
  - they do not serialize any producer-side `TextHandlerMarkets` or `MultiverseMarket` links into those text components
  - they only serialize the component graph around the row-local UI subtree
  - the narrowest defensible remaining seam is therefore runtime-side code, not another unresolved local asset link

Current grounded conclusion:

- the structural Emporium row model stays unchanged
- rows `78` and `83` are only partial text-adjacent controls, not completed player-facing label bindings
- a control-row text-adjacent path is recoverable as a sparse Unity string anchor plus a row-local asset-slot chain
- the broader handler-side scaling clue is now a checked runtime write family: `SetAllChrystosEmporiumTexts` -> `SetAllBaseBonusTexts` -> `SetISNBaseBonusText`
- the repo also now recovers a parallel runtime effect-label write family: `SetAllBonusTexts` -> `SetIS78BonusText` / `SetIS83BonusText` / `SetISNBonusText`
- the row-local slot alias for that recovered effect-label family is now closed to `BonusDescriptionText`
- the control-row effect payload source is now narrowed to `MultiverseMarket.get_FinalIS78Bonus()` / `get_FinalIS83Bonus()` plus `GeneralFunctionsManager.BigDoubleToText` / `System.Int32.ToString`, two still-unresolved helper RVAs, and `System.String.Concat`
- `CurrentBonusText` remains a separate unrecovered writer lane because `TextHandlerMarkets` has no `CurrentBonusText`-named field or `SetCurrentBonusText` writer family in the checked runtime surface, the widened slot-name assembly search still recovers no typed Assembly-CSharp owner exposing `CurrentBonusText` directly, and the widened runtime search also checks `NavigationManager` and `TextHandlerShopNPCs` without recovering a row-local CurrentBonusText producer there either
- the exact remaining blocker is the unrecovered separate `CurrentBonusText` writer lane plus the two still-unresolved helper RVAs inside the already recovered `BonusDescriptionText` payload path
- compatibility-only import stays quarantined, `InscryptionsDone` stays wrapper-only, and planner-safe use stays blocked
