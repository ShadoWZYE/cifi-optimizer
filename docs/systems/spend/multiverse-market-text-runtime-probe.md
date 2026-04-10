# Multiverse Market Text Runtime Probe

Source: [`data/unity-runtime-surface-probe.json`](data/unity-runtime-surface-probe.json) plus native disassembly from [`workbench/apk/base/libil2cpp.so`](workbench/apk/base/libil2cpp.so).

## Grounded conclusions

- The runtime probe now recovers typed TextHandlerMarkets field offsets and native RVAs for the exact Emporium text-handler family, without reopening the asset walk or shell-remap lane.
- SetAllChrystosEmporiumTexts directly calls SetAllBaseBonusTexts inside TextHandlerMarkets, which confirms a real runtime-only producer chain on the THMarkets side.
- SetIS78BaseBonusText and SetIS83BaseBonusText both read their row-local TextHandlerMarkets fields IS78BaseBonusText and IS83BaseBonusText, compose a string, and then end in the standard IL2CPP virtual-dispatch pattern that loads a UnityEngine.UI.Text method pair from the target object's class and jumps through it.
- Because UnityEngine.UI.Text.set_text is itself a virtual one-string setter in the recovered runtime surface, the narrowest defensible read is that the SetISNBaseBonusText family is a checked runtime assignment lane into UnityEngine.UI.Text components, but only as an inferred virtual setter bind rather than a named direct-call edge.
- That recovered runtime write path is still specifically the base-bonus lane, not yet a recovered write path for the live effect-label text seen in screenshots.
- The stronger remaining blocker is now narrower than generic TextHandlerMarkets binding: the repo still does not recover the separate runtime producer that writes effect-label payloads into row-local slots like CurrentBonusText or BonusDescriptionText for rows 78 and 83.

## Control methods

- `row=78`; `SetIS78BaseBonusText`; `rva=31814338`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS15BaseBonusText', 'IS71BonusText', 'IS72BonusText', 'IS78BaseBonusText', 'Market']`
- `row=83`; `SetIS83BaseBonusText`; `rva=31815343`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS71BonusText', 'IS72BonusText', 'IS83BaseBonusText', 'Market']`

## Current boundary

- Treat SaveData.ISNLevel through ISNID through BuyISN or SetISNCostText through row payload ID or Level or ISObject as the settled row-identity chain.
- Treat TextHandlerMarkets.SetAllChrystosEmporiumTexts through SetAllBaseBonusTexts through SetIS78BaseBonusText or SetIS83BaseBonusText as a checked runtime-only write path into UnityEngine.UI.Text for the base-bonus lane.
- Do not treat that recovered base-bonus write path as a solved live effect-label binding for rows 78 or 83; the screenshot mismatch still falsifies sparse Inscryption N anchors as completed label truth.
- Treat the exact remaining missing layer as the separate runtime producer or binding path that populates the live effect-label slots such as CurrentBonusText or BonusDescriptionText, not the already recovered ISNBaseBonusText assignment lane.
- Do not widen canonical import, planner behavior, or the shipped compatibility preview while that effect-label producer remains unrecovered.
