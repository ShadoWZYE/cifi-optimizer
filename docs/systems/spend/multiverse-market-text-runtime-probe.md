# Multiverse Market Text Runtime Probe

Source: [`data/unity-runtime-surface-probe.json`](data/unity-runtime-surface-probe.json) plus native disassembly from [`workbench/apk/base/libil2cpp.so`](workbench/apk/base/libil2cpp.so).

## Grounded conclusions

- The runtime probe now recovers typed TextHandlerMarkets field offsets and native RVAs for the exact Emporium text-handler family, without reopening the asset walk or shell-remap lane.
- SetAllChrystosEmporiumTexts directly calls SetAllBaseBonusTexts inside TextHandlerMarkets, which confirms a real runtime-only producer chain on the THMarkets side.
- SetIS78BaseBonusText and SetIS83BaseBonusText both read their row-local TextHandlerMarkets fields IS78BaseBonusText and IS83BaseBonusText, compose a string, and then end in the standard IL2CPP virtual-dispatch pattern that loads a UnityEngine.UI.Text method pair from the target object's class and jumps through it.
- Because UnityEngine.UI.Text.set_text is itself a virtual one-string setter in the recovered runtime surface, the narrowest defensible read is that the SetISNBaseBonusText family is a checked runtime assignment lane into UnityEngine.UI.Text components, but only as an inferred virtual setter bind rather than a named direct-call edge.
- SetIS78BonusText and SetIS83BonusText form a second parallel runtime writer family: they read IS78BonusText and IS83BonusText, compose strings, and end in the same UnityEngine.UI.Text virtual-dispatch write pattern, which recovers a separate effect-label lane beyond the already checked base-bonus lane.
- The same runtime surface now recovers a full typed effect-label family on TextHandlerMarkets from IS1BonusText through IS110BonusText and from SetIS1BonusText through SetIS110BonusText, which closes the producer side for the non-current-value effect-label lane rather than only for rows 78 and 83.
- That same exact typed runtime surface recovers no CurrentBonusText-named field and no SetCurrentBonusText-style writer family on TextHandlerMarkets, so CurrentBonusText is no longer a plausible alias for the recovered ISNBonusText sink and must remain a separate unrecovered writer lane if it is written at runtime.
- The remaining seam is now narrower than a generic slot-alias question: the repo still does not recover the exact non-CurrentBonusText row-local alias that proves whether ISNBonusText binds directly to BonusDescriptionText or another recovered row-local UnityEngine.UI.Text slot.

## Control methods

- `row=78`; `SetIS78BaseBonusText`; `rva=31814338`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS15BaseBonusText', 'IS71BonusText', 'IS72BonusText', 'IS78BaseBonusText', 'Market']`
- `row=83`; `SetIS83BaseBonusText`; `rva=31815343`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS71BonusText', 'IS72BonusText', 'IS83BaseBonusText', 'Market']`

## Effect-label methods

- `row=78`; `SetIS78BonusText`; `rva=31834602`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS15BaseBonusText', 'IS71BonusText', 'IS72BonusText', 'IS78BonusText', 'Market']`
- `row=83`; `SetIS83BonusText`; `rva=31835520`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS71BonusText', 'IS72BonusText', 'IS83BonusText', 'Market']`

## Effect-label family surface

- `fields=IS1BonusText..IS110BonusText`; `count=110`
- `methods=SetIS1BonusText..SetIS110BonusText`; `count=110`
- `TextHandlerMarkets.CurrentBonusText field present=False`
- `TextHandlerMarkets.SetCurrentBonusText writer present=False`

## Current boundary

- Treat SaveData.ISNLevel through ISNID through BuyISN or SetISNCostText through row payload ID or Level or ISObject as the settled row-identity chain.
- Treat TextHandlerMarkets.SetAllChrystosEmporiumTexts through SetAllBaseBonusTexts through SetIS78BaseBonusText or SetIS83BaseBonusText as a checked runtime-only write path into UnityEngine.UI.Text for the base-bonus lane.
- Treat TextHandlerMarkets.SetIS78BonusText or SetIS83BonusText as a separately recovered runtime-only effect-label write lane into UnityEngine.UI.Text, distinct from the base-bonus lane.
- Do not treat the recovered effect-label writer as completed canonical label truth for rows 78 or 83; the screenshot mismatch still falsifies sparse Inscryption N anchors as completed label truth.
- Treat CurrentBonusText as a separate unrecovered writer lane rather than as the sink for ISNBonusText, because TextHandlerMarkets now exposes a full ISNBonusText field and method family but no CurrentBonusText-named field or writer family.
- Treat the exact remaining missing layer as the typed non-CurrentBonusText row-local alias from ISNBonusText into the recovered row-local slot objects, with BonusDescriptionText as the strongest current inference.
- Do not widen canonical import, planner behavior, or the shipped compatibility preview while that effect-label producer remains unrecovered.
