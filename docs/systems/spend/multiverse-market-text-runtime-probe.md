# Multiverse Market Text Runtime Probe

Source: [`data/unity-runtime-surface-probe.json`](data/unity-runtime-surface-probe.json) plus native disassembly from [`workbench/apk/base/libil2cpp.so`](workbench/apk/base/libil2cpp.so).

## Grounded conclusions

- The runtime probe now recovers typed TextHandlerMarkets field offsets and native RVAs for the exact Emporium text-handler family, without reopening the asset walk or shell-remap lane.
- SetAllChrystosEmporiumTexts directly calls SetAllBaseBonusTexts inside TextHandlerMarkets, which confirms a real runtime-only producer chain on the THMarkets side.
- SetIS78BaseBonusText and SetIS83BaseBonusText both read their row-local TextHandlerMarkets fields IS78BaseBonusText and IS83BaseBonusText, compose a string, and then end in the standard IL2CPP virtual-dispatch pattern that loads a UnityEngine.UI.Text method pair from the target object's class and jumps through it.
- Because UnityEngine.UI.Text.set_text is itself a virtual one-string setter in the recovered runtime surface, the narrowest defensible read is that the SetISNBaseBonusText family is a checked runtime assignment lane into UnityEngine.UI.Text components, but only as an inferred virtual setter bind rather than a named direct-call edge.
- SetIS78BonusText and SetIS83BonusText form a second parallel runtime writer family: they read IS78BonusText and IS83BonusText, compose strings, and end in the same UnityEngine.UI.Text virtual-dispatch write pattern, which recovers a separate effect-label lane beyond the already checked base-bonus lane.
- The widened MultiverseMarket runtime surface now closes the row-78 and row-83 effect payload sources one step further: SetIS78BonusText calls MultiverseMarket.get_FinalIS78Bonus(), while SetIS83BonusText calls MultiverseMarket.get_FinalIS83Bonus(), before additional formatter helpers and System.String.Concat write into the recovered ISNBonusText sink.
- The same runtime surface now recovers a full typed effect-label family on TextHandlerMarkets from IS1BonusText through IS110BonusText and from SetIS1BonusText through SetIS110BonusText, plus the batch-level SetAllBonusTexts method, which closes the producer side for the non-current-value effect-label lane rather than only for rows 78 and 83.
- The same exact runtime surface also recovers a full IS1IDText through IS110IDText and SetIS1IDText through SetIS110IDText family on TextHandlerMarkets, which closes IDText off as its own dedicated row-label lane rather than as the sink for SetISNBonusText.
- That same exact typed runtime surface recovers no CurrentBonusText-named field and no SetCurrentBonusText-style writer family on TextHandlerMarkets, and the widened slot-name assembly search also fails to recover any typed Assembly-CSharp owner exposing CurrentBonusText as a field or direct Set* slot-writer method. CurrentBonusText therefore remains a separate runtime-only lane with no recovered dedicated producer.
- Because the row-local control-slot set is CurrentBonusText or BonusDescriptionText or PerLevelBonusText or DescriptionText or IDText, and the recovered runtime families now separately account for CurrentBonusText as absent, PerLevelBonusText via SetISNBaseBonusText, and IDText via SetISNIDText, while exposing no SetISNDescriptionText family at all, the narrowest typed repo-local slot alias for the recovered SetISNBonusText writer closes to BonusDescriptionText.
- The last two anonymous helper RVAs on the BonusDescriptionText path are now role-closed too: 28277222 is the runtime metadata-init helper reached from one-time guard blocks, and 28277761 is the null-reference throw helper reached only from the row-local null-guard branches.

## Control methods

- `row=78`; `SetIS78BaseBonusText`; `rva=31814338`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS15BaseBonusText', 'IS71BonusText', 'IS72BonusText', 'IS78BaseBonusText', 'Market']`
- `row=83`; `SetIS83BaseBonusText`; `rva=31815343`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS71BonusText', 'IS72BonusText', 'IS83BaseBonusText', 'Market']`

## Effect-label methods

- `row=78`; `SetIS78BonusText`; `rva=31834602`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS15BaseBonusText', 'IS71BonusText', 'IS72BonusText', 'IS78BonusText', 'Market']`
  payload: `sinkField=IS78BonusText`; `marketFieldRead=True`; `sourceGetter=get_FinalIS78Bonus`; `formatterHelperRvas=[28277222, 28277222, 30997230, 28277761]`
- `row=83`; `SetIS83BonusText`; `rva=31835520`; `callsDirectUnityUiSetText=False`; `virtualUnityUiTextSetterInference=True`; `boundFields=['IS71BonusText', 'IS72BonusText', 'IS83BonusText', 'Market']`
  payload: `sinkField=IS83BonusText`; `marketFieldRead=True`; `sourceGetter=get_FinalIS83Bonus`; `formatterHelperRvas=[28277222, 59968580, 28277761]`

## Effect-label family surface

- `fields=IS1BonusText..IS110BonusText`; `count=110`
- `methods=SetIS1BonusText..SetIS110BonusText`; `count=110`
- `SetAllBonusTexts recovered=True`
- `idFields=IS1IDText..IS110IDText`; `count=110`
- `idMethods=SetIS1IDText..SetIS110IDText`; `count=110`
- `rowNumberedDescriptionWritersRecovered=0`
- `TextHandlerMarkets.CurrentBonusText field present=False`
- `TextHandlerMarkets.SetCurrentBonusText writer present=False`
- `Assembly-CSharp current-value search matches=6`
- `Assembly-CSharp exact row-slot search matches=19`

## Root batch resolution

- `rva=31777557`; `target=TextHandlerMarkets.SetInscryptionsDoneText`
- `rva=31777729`; `target=TextHandlerMarkets.SetHellishBioMatterText`
- `rva=31777861`; `target=TextHandlerMarkets.SetAllCostTexts`
- `rva=31778743`; `target=TextHandlerMarkets.SetAllBaseBonusTexts`
- `rva=31779625`; `target=TextHandlerMarkets.SetAllBonusTexts`
- `rva=28277222`; `target=runtime metadata init helper (il2cpp_codegen_initialize_runtime_metadata)`
- `rva=37322803`; `target=MultiverseMarket.get_InscrpytionLevelsCount`
- `rva=59968580`; `target=System.Int32.ToString`
- `rva=37203408`; `target=MultiverseMarket.get_TotalInscryptionsAvailable`
- `rva=59968580`; `target=System.Int32.ToString`
- `rva=58520722`; `target=System.String.Concat`
- `rva=28277761`; `target=null-reference throw helper (il2cpp_codegen_raise_null_reference_exception)`
- `rva=28277222`; `target=runtime metadata init helper (il2cpp_codegen_initialize_runtime_metadata)`
- `rva=30996655`; `target=unresolved`
- `rva=28277761`; `target=null-reference throw helper (il2cpp_codegen_raise_null_reference_exception)`

## Slot alias resolution

- `resolvedRowLocalAlias=BonusDescriptionText`
- CurrentBonusText is excluded because TextHandlerMarkets exposes no CurrentBonusText-named field and no SetCurrentBonusText writer family.
- PerLevelBonusText aligns with the separately recovered SetISNBaseBonusText lane rather than the recovered SetISNBonusText lane.
- IDText aligns with the separately recovered SetIS1IDText through SetIS110IDText writer family on TextHandlerMarkets.
- DescriptionText is not supported by any recovered SetISNDescriptionText family on TextHandlerMarkets.
- BonusDescriptionText is the only remaining recovered row-local UnityEngine.UI.Text slot name compatible with the non-current, non-base, non-ID SetISNBonusText effect-label writer family.

## Helper-name narrowing

- `row78Helpers=['runtime metadata init helper@28277222', 'runtime metadata init helper@28277222', 'GeneralFunctionsManager.BigDoubleToText', 'null-reference throw helper@28277761']`
- `row83Helpers=['runtime metadata init helper@28277222', 'System.Int32.ToString', 'null-reference throw helper@28277761']`

## Current boundary

- Treat SaveData.ISNLevel through ISNID through BuyISN or SetISNCostText through row payload ID or Level or ISObject as the settled row-identity chain.
- Treat TextHandlerMarkets.SetAllChrystosEmporiumTexts through SetAllBaseBonusTexts through SetIS78BaseBonusText or SetIS83BaseBonusText as a checked runtime-only write path into UnityEngine.UI.Text for the base-bonus lane.
- Treat TextHandlerMarkets.SetAllBonusTexts through SetIS78BonusText or SetIS83BonusText as a separately recovered runtime-only effect-label write lane into UnityEngine.UI.Text, distinct from the base-bonus lane and sourced from MultiverseMarket.get_FinalIS78Bonus or get_FinalIS83Bonus plus GeneralFunctionsManager.BigDoubleToText or System.Int32.ToString, the runtime metadata-init helper, the null-reference throw helper, and System.String.Concat.
- Do not treat the recovered effect-label writer as completed canonical label truth for rows 78 or 83; the screenshot mismatch still falsifies sparse Inscryption N anchors as completed label truth.
- Treat CurrentBonusText as a separate unrecovered writer lane rather than as the sink for ISNBonusText, because TextHandlerMarkets now exposes a full ISNBonusText field and method family plus SetAllBonusTexts but no CurrentBonusText-named field or writer family, and the widened slot-name assembly search still recovers no typed Assembly-CSharp owner exposing CurrentBonusText as a field or direct slot-writer method.
- Treat BonusDescriptionText as the closed row-local slot alias for the recovered ISNBonusText effect-label writer family, because the same runtime surface separately accounts for IDText via SetISNIDText, PerLevelBonusText via SetISNBaseBonusText, and excludes CurrentBonusText while exposing no SetISNDescriptionText family.
- Do not widen canonical import, planner behavior, or the shipped compatibility preview while the separate CurrentBonusText writer lane remains unrecovered.
