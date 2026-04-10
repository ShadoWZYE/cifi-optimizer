# Multiverse Market Text Runtime Probe

Source: [`data/unity-runtime-surface-probe.json`](data/unity-runtime-surface-probe.json) plus native disassembly from [`workbench/apk/base/libil2cpp.so`](workbench/apk/base/libil2cpp.so).

## Grounded conclusions

- The runtime probe now recovers typed TextHandlerMarkets field offsets and native RVAs for the exact Emporium text-handler family, without reopening the asset walk or shell-remap lane.
- SetAllChrystosEmporiumTexts directly calls SetAllBaseBonusTexts inside TextHandlerMarkets, which confirms a real runtime-only producer chain on the THMarkets side.
- SetIS78BaseBonusText and SetIS83BaseBonusText both read their row-local TextHandlerMarkets fields IS78BaseBonusText and IS83BaseBonusText, compose a string, and then end in the standard IL2CPP virtual-dispatch pattern that loads a UnityEngine.UI.Text method pair from the target object's class and jumps through it.
- Because UnityEngine.UI.Text.set_text is itself a virtual one-string setter in the recovered runtime surface, the narrowest defensible read is that the SetISNBaseBonusText family is a checked runtime assignment lane into UnityEngine.UI.Text components, but only as an inferred virtual setter bind rather than a named direct-call edge.
- SetIS78BonusText and SetIS83BonusText form a second parallel runtime writer family: they read IS78BonusText and IS83BonusText, compose strings, and end in the same UnityEngine.UI.Text virtual-dispatch write pattern, which recovers a separate effect-label lane beyond the already checked base-bonus lane.
- No CurrentBonusText-named or DescriptionText-named writer family is recovered in the TextHandlerMarkets runtime surface, so the strongest current inference is that ISNBonusText maps to the row-local effect-label slot most likely represented by BonusDescriptionText, while CurrentBonusText remains a separate current-value slot outside the recovered binder family.
- The remaining seam is now narrower than a missing effect-label producer: the repo still does not recover a typed row-local alias that proves whether ISNBonusText binds to BonusDescriptionText directly, nor a separate dedicated current-value writer for CurrentBonusText.

## Control methods

- `row=78`; `SetIS78BaseBonusText`; `rva=31814338`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS15BaseBonusText', 'IS71BonusText', 'IS72BonusText', 'IS78BaseBonusText', 'Market']`
- `row=83`; `SetIS83BaseBonusText`; `rva=31815343`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS71BonusText', 'IS72BonusText', 'IS83BaseBonusText', 'Market']`

## Effect-label methods

- `row=78`; `SetIS78BonusText`; `rva=31834602`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS15BaseBonusText', 'IS71BonusText', 'IS72BonusText', 'IS78BonusText', 'Market']`
- `row=83`; `SetIS83BonusText`; `rva=31835520`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS71BonusText', 'IS72BonusText', 'IS83BonusText', 'Market']`

## Current boundary

- Treat SaveData.ISNLevel through ISNID through BuyISN or SetISNCostText through row payload ID or Level or ISObject as the settled row-identity chain.
- Treat TextHandlerMarkets.SetAllChrystosEmporiumTexts through SetAllBaseBonusTexts through SetIS78BaseBonusText or SetIS83BaseBonusText as a checked runtime-only write path into UnityEngine.UI.Text for the base-bonus lane.
- Treat TextHandlerMarkets.SetIS78BonusText or SetIS83BonusText as a separately recovered runtime-only effect-label write lane into UnityEngine.UI.Text, distinct from the base-bonus lane.
- Do not treat the recovered effect-label writer as completed canonical label truth for rows 78 or 83; the screenshot mismatch still falsifies sparse Inscryption N anchors as completed label truth.
- Treat the exact remaining missing layer as the typed row-local alias from ISNBonusText into the recovered row-local slot objects, with BonusDescriptionText as the strongest current inference and CurrentBonusText still outside the recovered dedicated writer family.
- Do not widen canonical import, planner behavior, or the shipped compatibility preview while that effect-label producer remains unrecovered.
