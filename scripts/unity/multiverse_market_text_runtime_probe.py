from __future__ import annotations

import json
import re
from datetime import date
from pathlib import Path

from portable_paths import md_link

ROOT = Path(__file__).resolve().parents[2]
RUNTIME_SURFACE_PATH = ROOT / "data" / "unity-runtime-surface-probe.json"
LIBIL2CPP_PATH = ROOT / "workbench" / "apk" / "base" / "libil2cpp.so"
JSON_OUT = ROOT / "data" / "multiverse-market-text-runtime-probe.json"
MD_OUT = ROOT / "docs" / "systems" / "spend" / "multiverse-market-text-runtime-probe.md"

VENDOR_PATH = ROOT / ".vendor_manual"
import sys
if str(VENDOR_PATH) not in sys.path:
    sys.path.insert(0, str(VENDOR_PATH))

from capstone import Cs, CS_ARCH_X86, CS_MODE_64  # type: ignore

CALL_TARGET_RE = re.compile(r"^0x([0-9a-f]+)$")
FIELD_ACCESS_RE = re.compile(r"\[(?P<base>[a-z0-9]+) \+ (?P<offset>0x[0-9a-f]+)\]")
INSCRIPTION_NUMBER_RE = re.compile(r"IS(?P<number>\d+)")

NATIVE_HELPER_INFERENCES: dict[int, dict[str, str]] = {
    28277222: {
        "roleName": "runtime metadata init helper",
        "canonicalInference": "il2cpp_codegen_initialize_runtime_metadata",
        "contribution": "initializes one-time runtime metadata/class references before the effect-label payload is composed",
        "evidence": "called from one-time guard blocks immediately after lea rdi,[rip+...] and immediately before the guard byte flips to 1",
    },
    28277761: {
        "roleName": "null-reference throw helper",
        "canonicalInference": "il2cpp_codegen_raise_null_reference_exception",
        "contribution": "raises the null-guard failure path when Market or the target UnityEngine.UI.Text sink is missing",
        "evidence": "reached only from je branches after test-null checks in SetIS78BonusText and SetIS83BonusText",
    },
}

SEARCH_METHOD_WINDOW_BYTES = 1024


def load_runtime_surface() -> dict[str, object]:
    return json.loads(RUNTIME_SURFACE_PATH.read_text(encoding="utf-8"))


def extract_target(surface: dict[str, object], report_key: str) -> dict[str, object]:
    for target in surface.get("targets", []):
        if target.get("reportKey") == report_key:
            return target
    raise KeyError(f"Missing runtime surface target {report_key}")


def extract_assembly_search(
    surface: dict[str, object],
    required_field_patterns: list[str],
) -> dict[str, object]:
    required = tuple(required_field_patterns)
    for search in surface.get("assemblySearches", []):
        if tuple(search.get("fieldPatterns", [])) == required:
            return search
    raise KeyError(f"Missing runtime surface assembly search {required}")


def extract_rva_lookup_map(surface: dict[str, object]) -> dict[int, list[dict[str, object]]]:
    mapping: dict[int, list[dict[str, object]]] = {}
    lookup_root = surface.get("rvaLookups", {})
    if not isinstance(lookup_root, dict):
        return mapping
    for entry in lookup_root.get("resolved", []):
        if not isinstance(entry, dict):
            continue
        rva = entry.get("rva")
        matches = entry.get("matches", [])
        if isinstance(rva, int) and isinstance(matches, list):
            mapping[rva] = [match for match in matches if isinstance(match, dict)]
    return mapping


def build_method_index(*targets: dict[str, object]) -> tuple[dict[int, dict[str, object]], list[int]]:
    methods_by_rva: dict[int, dict[str, object]] = {}
    all_rvas: list[int] = []
    for target in targets:
        type_name = str(target.get("fullName") or target.get("scriptName"))
        for method in target.get("methods", []):
            props = method.get("methodProperties", {})
            rva = props.get("Rva")
            if not isinstance(rva, int):
                continue
            entry = {
                "typeName": type_name,
                "name": method.get("name"),
                "returnType": method.get("returnType"),
                "rva": rva,
                "methodPointer": props.get("MethodPointer"),
                "signature": props.get("HumanReadableSignature"),
                "parameters": method.get("parameters", []),
            }
            methods_by_rva[rva] = entry
            all_rvas.append(rva)
    return methods_by_rva, sorted(set(all_rvas))


def extend_method_index_with_search_hits(
    methods_by_rva: dict[int, dict[str, object]],
    all_rvas: list[int],
    search: dict[str, object],
) -> tuple[dict[int, dict[str, object]], list[int]]:
    for match in search.get("matches", []):
        type_name = str(match.get("fullName") or match.get("typeName"))
        for method in match.get("methodHits", []):
            props = method.get("methodProperties", {})
            rva = props.get("Rva")
            if not isinstance(rva, int):
                continue
            if rva not in methods_by_rva:
                methods_by_rva[rva] = {
                    "typeName": type_name,
                    "name": method.get("name"),
                    "returnType": method.get("returnType"),
                    "rva": rva,
                    "methodPointer": props.get("MethodPointer"),
                    "signature": props.get("HumanReadableSignature"),
                    "parameters": [],
                }
            all_rvas.append(rva)
    return methods_by_rva, sorted(set(all_rvas))


def build_field_offset_map(target: dict[str, object]) -> dict[int, dict[str, object]]:
    mapping: dict[int, dict[str, object]] = {}
    for field in target.get("fields", []):
        offset = field.get("fieldOffset")
        if isinstance(offset, int):
            mapping[offset] = field
    return mapping


def next_rva(sorted_rvas: list[int], current: int) -> int | None:
    for value in sorted_rvas:
        if value > current:
            return value
    return None


def collect_instructions(blob: bytes, start: int, end: int) -> list[dict[str, object]]:
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    rows: list[dict[str, object]] = []
    for ins in md.disasm(blob[start:end], start):
        rows.append(
            {
                "address": ins.address,
                "mnemonic": ins.mnemonic,
                "operand": ins.op_str,
                "size": ins.size,
            }
        )
    return rows


def collect_field_accesses(
    instructions: list[dict[str, object]],
    field_map: dict[int, dict[str, object]],
) -> list[dict[str, object]]:
    hits: list[dict[str, object]] = []
    seen: set[tuple[int, int]] = set()
    for ins in instructions:
        match = FIELD_ACCESS_RE.search(str(ins["operand"]))
        if not match:
            continue
        offset = int(match.group("offset"), 16)
        if offset not in field_map:
            continue
        key = (int(ins["address"]), offset)
        if key in seen:
            continue
        seen.add(key)
        field = field_map[offset]
        hits.append(
            {
                "address": int(ins["address"]),
                "mnemonic": ins["mnemonic"],
                "operand": ins["operand"],
                "baseRegister": match.group("base"),
                "fieldOffset": offset,
                "fieldName": field.get("name"),
                "fieldType": field.get("type"),
            }
        )
    return hits


def collect_calls(
    instructions: list[dict[str, object]],
    methods_by_rva: dict[int, dict[str, object]],
) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for ins in instructions:
        if ins["mnemonic"] != "call":
            continue
        operand = str(ins["operand"])
        match = CALL_TARGET_RE.match(operand)
        target_rva = int(match.group(1), 16) if match else None
        mapped = methods_by_rva.get(target_rva) if target_rva is not None else None
        rows.append(
            {
                "address": int(ins["address"]),
                "operand": operand,
                "targetRva": target_rva,
                "resolvedTarget": mapped,
            }
        )
    return rows


def summarize_method(
    name: str,
    methods_by_rva: dict[int, dict[str, object]],
    sorted_rvas: list[int],
    blob: bytes,
    field_map: dict[int, dict[str, object]],
) -> dict[str, object]:
    method = next(entry for entry in methods_by_rva.values() if entry["name"] == name and entry["typeName"] == "TextHandlerMarkets")
    start = int(method["rva"])
    end = next_rva(sorted_rvas, start)
    if end is None:
        end = start + 512
    instructions = collect_instructions(blob, start, end)
    field_accesses = collect_field_accesses(instructions, field_map)
    calls = collect_calls(instructions, methods_by_rva)
    virtual_text_set_inference = False
    if instructions:
        for index, ins in enumerate(instructions):
            is_virtual_tail = ins["mnemonic"] == "jmp" and str(ins["operand"]) == "r8"
            is_virtual_call = ins["mnemonic"] == "call" and "qword ptr [rcx + 0x5e8]" in str(ins["operand"])
            if not is_virtual_tail and not is_virtual_call:
                continue
            window = instructions[max(0, index - 10): index + 1]
            has_text_object = any(
                isinstance(hit.get("fieldType"), str) and hit["fieldType"] == "UnityEngine.UI.Text"
                for hit in field_accesses
            )
            has_string_compose = any(
                isinstance(call.get("resolvedTarget"), dict) and call["resolvedTarget"].get("typeName") == "System.String"
                for call in calls
            )
            has_methodinfo_pair = any(
                (
                    entry["mnemonic"] == "mov" and "qword ptr [rcx + 0x5e8]" in str(entry["operand"])
                ) or (
                    entry["mnemonic"] == "call" and "qword ptr [rcx + 0x5e8]" in str(entry["operand"])
                )
                for entry in window
            ) and any(
                entry["mnemonic"] == "mov" and "qword ptr [rcx + 0x5f0]" in str(entry["operand"])
                for entry in window
            )
            if has_text_object and has_string_compose and has_methodinfo_pair:
                virtual_text_set_inference = True
                break
    return {
        "name": name,
        "rva": start,
        "estimatedTrackedBodySize": end - start,
        "signature": method.get("signature"),
        "fieldAccesses": field_accesses,
        "callTargets": calls,
        "callsDirectUnityUiSetText": any(
            isinstance(call.get("resolvedTarget"), dict) and
            call["resolvedTarget"].get("typeName") == "UnityEngine.UI.Text" and
            call["resolvedTarget"].get("name") == "set_text"
            for call in calls
        ),
        "virtualUnityUiTextSetterInference": virtual_text_set_inference,
        "callsStringCompose": [
            call for call in calls
            if isinstance(call.get("resolvedTarget"), dict) and
            call["resolvedTarget"].get("typeName") == "System.String"
        ],
    }


def summarize_search_method(
    full_type_name: str,
    method_name: str,
    search: dict[str, object],
    methods_by_rva: dict[int, dict[str, object]],
    sorted_rvas: list[int],
    blob: bytes,
) -> dict[str, object]:
    method_hit = next(
        method
        for match in search.get("matches", [])
        if match.get("fullName") == full_type_name
        for method in match.get("methodHits", [])
        if method.get("name") == method_name
    )
    props = method_hit["methodProperties"]
    start = int(props["Rva"])
    # Search-hit methods come from a sparse cross-type scan, so next_rva() can jump
    # into unrelated code and wildly overstate what the candidate method actually does.
    end = start + SEARCH_METHOD_WINDOW_BYTES
    instructions = collect_instructions(blob, start, end)
    calls = collect_calls(instructions, methods_by_rva)
    return {
        "typeName": full_type_name,
        "name": method_name,
        "rva": start,
        "estimatedTrackedBodySize": end - start,
        "signature": props.get("HumanReadableSignature"),
        "callTargets": calls,
        "callsStringCompose": [
            call for call in calls
            if isinstance(call.get("resolvedTarget"), dict)
            and call["resolvedTarget"].get("typeName") == "System.String"
        ],
        "callsRecoveredBonusWriters": [
            call for call in calls
            if isinstance(call.get("resolvedTarget"), dict)
            and call["resolvedTarget"].get("typeName") == "TextHandlerMarkets"
            and str(call["resolvedTarget"].get("name", "")).startswith("SetIS")
        ],
        "callsRecoveredFinalBonusGetters": [
            call for call in calls
            if isinstance(call.get("resolvedTarget"), dict)
            and call["resolvedTarget"].get("typeName") == "MultiverseMarket"
            and str(call["resolvedTarget"].get("name", "")).startswith("get_FinalIS")
        ],
        "anonymousHelperRoles": [
            NATIVE_HELPER_INFERENCES[call["targetRva"]]["roleName"]
            for call in calls
            if isinstance(call.get("targetRva"), int)
            and call["targetRva"] in NATIVE_HELPER_INFERENCES
        ],
        "hasVirtualUnityUiTextSetterPattern": any(
            ins["mnemonic"] == "call" and "qword ptr [rax + 0x5e8]" in str(ins["operand"])
            or ins["mnemonic"] == "call" and "qword ptr [rcx + 0x5e8]" in str(ins["operand"])
            or ins["mnemonic"] == "jmp" and str(ins["operand"]) == "r8"
            for ins in instructions
        ),
    }


def summarize_search_method_if_present(
    full_type_name: str,
    method_name: str,
    search: dict[str, object],
    methods_by_rva: dict[int, dict[str, object]],
    sorted_rvas: list[int],
    blob: bytes,
) -> dict[str, object] | None:
    for match in search.get("matches", []):
        if match.get("fullName") != full_type_name:
            continue
        for method in match.get("methodHits", []):
            if method.get("name") == method_name:
                return summarize_search_method(
                    full_type_name,
                    method_name,
                    search,
                    methods_by_rva,
                    sorted_rvas,
                    blob,
                )
    return None


def sort_inscription_names(names: list[str]) -> list[str]:
    def key(name: str) -> tuple[int, str]:
        match = INSCRIPTION_NUMBER_RE.search(name)
        number = int(match.group("number")) if match else 999999
        return (number, name)

    return sorted(names, key=key)


def main() -> None:
    surface = load_runtime_surface()
    rva_lookup_map = extract_rva_lookup_map(surface)
    text_handler = extract_target(surface, "textHandlerMarkets")
    multiverse_market = extract_target(surface, "multiverseMarket")
    navigation_manager = extract_target(surface, "navigationManager")
    text_handler_shop_npcs = extract_target(surface, "textHandlerShopNpcs")
    unity_text = extract_target(surface, "unityUiText")
    system_string = extract_target(surface, "string")
    current_search = extract_assembly_search(
        surface,
        [
            "CurrentBonusText",
            "ActualBonusText",
            "TotalBonusText",
            "BonusText1",
            "CurrentBonusPerLevelText",
        ],
    )
    slot_search = extract_assembly_search(
        surface,
        [
            "CurrentBonusText",
            "BonusDescriptionText",
            "PerLevelBonusText",
            "DescriptionText",
            "IDText",
            "IconBox",
        ],
    )
    current_lane_candidate_search = extract_assembly_search(
        surface,
        [
            "CurrentBonusText",
            "BonusDescriptionText",
            "PerLevelBonusText",
            "CostText",
            "DescText",
            "CurrencyBox",
            "InscryptionsList",
            "Market",
        ],
    )

    methods_by_rva, sorted_rvas = build_method_index(
        text_handler,
        multiverse_market,
        navigation_manager,
        text_handler_shop_npcs,
        unity_text,
        system_string,
    )
    methods_by_rva, sorted_rvas = extend_method_index_with_search_hits(
        methods_by_rva,
        sorted_rvas,
        current_lane_candidate_search,
    )
    field_map = build_field_offset_map(text_handler)
    blob = LIBIL2CPP_PATH.read_bytes()
    text_handler_fields = text_handler.get("fields", [])
    text_handler_methods = text_handler.get("methods", [])
    bonus_text_field_names = sort_inscription_names([
        field.get("name") for field in text_handler_fields
        if isinstance(field.get("name"), str)
        and field["name"].startswith("IS")
        and field["name"].endswith("BonusText")
        and "BaseBonusText" not in field["name"]
    ])
    bonus_text_method_names = sort_inscription_names([
        method.get("name") for method in text_handler_methods
        if isinstance(method.get("name"), str)
        and method["name"].startswith("SetIS")
        and method["name"].endswith("BonusText")
        and "BaseBonusText" not in method["name"]
    ])
    id_text_field_names = sort_inscription_names([
        field.get("name") for field in text_handler_fields
        if isinstance(field.get("name"), str)
        and field["name"].startswith("IS")
        and field["name"].endswith("IDText")
    ])
    id_text_method_names = sort_inscription_names([
        method.get("name") for method in text_handler_methods
        if isinstance(method.get("name"), str)
        and method["name"].startswith("SetIS")
        and method["name"].endswith("IDText")
    ])
    description_text_method_names = sort_inscription_names([
        method.get("name") for method in text_handler_methods
        if isinstance(method.get("name"), str)
        and method["name"].startswith("SetIS")
        and method["name"].endswith("DescriptionText")
    ])
    current_bonus_text_field_present = any(field.get("name") == "CurrentBonusText" for field in text_handler_fields)
    current_bonus_text_method_present = any(method.get("name") == "SetCurrentBonusText" for method in text_handler_methods)
    current_search_matches = current_search.get("matches", [])
    slot_search_matches = slot_search.get("matches", [])

    target_methods = [
        "SetAllChrystosEmporiumTexts",
        "SetAllCostTexts",
        "SetAllBaseBonusTexts",
        "SetAllBonusTexts",
        "SetAllIDTexts",
        "SetIS78BaseBonusText",
        "SetIS83BaseBonusText",
        "SetIS78BonusText",
        "SetIS83BonusText",
    ]
    summaries = [
        summarize_method(name, methods_by_rva, sorted_rvas, blob, field_map)
        for name in target_methods
        if any(entry["name"] == name and entry["typeName"] == "TextHandlerMarkets" for entry in methods_by_rva.values())
    ]
    by_name = {entry["name"]: entry for entry in summaries}

    set_all = by_name["SetAllChrystosEmporiumTexts"]
    set_all_cost = by_name.get("SetAllCostTexts")
    set_all_base = by_name["SetAllBaseBonusTexts"]
    set_all_bonus = by_name.get("SetAllBonusTexts")
    set_all_id = by_name.get("SetAllIDTexts")
    row78 = by_name["SetIS78BaseBonusText"]
    row83 = by_name["SetIS83BaseBonusText"]
    row78_effect = by_name["SetIS78BonusText"]
    row83_effect = by_name["SetIS83BonusText"]

    def summarize_effect_payload_path(method_summary: dict[str, object]) -> dict[str, object]:
        call_targets = method_summary["callTargets"]
        source_getter = next(
            (
                call["resolvedTarget"]
                for call in call_targets
                if isinstance(call.get("resolvedTarget"), dict)
                and call["resolvedTarget"].get("typeName") == "MultiverseMarket"
                and str(call["resolvedTarget"].get("name", "")).startswith("get_FinalIS")
            ),
            None,
        )
        formatter_helpers = [
            {
                "targetRva": call["targetRva"],
                "operand": call["operand"],
                "resolvedLookupMatches": rva_lookup_map.get(call["targetRva"], []),
                "nativeHelperInference": NATIVE_HELPER_INFERENCES.get(call["targetRva"]),
            }
            for call in call_targets
            if call["targetRva"] is not None and call.get("resolvedTarget") is None
        ]
        string_compose = [
            call["resolvedTarget"]
            for call in call_targets
            if isinstance(call.get("resolvedTarget"), dict)
            and call["resolvedTarget"].get("typeName") == "System.String"
        ]
        return {
            "sinkField": next(
                (
                    hit["fieldName"]
                    for hit in method_summary["fieldAccesses"]
                    if hit.get("fieldName", "").endswith("BonusText")
                    and "BaseBonusText" not in str(hit.get("fieldName"))
                ),
                None,
            ),
            "marketFieldRead": any(hit.get("fieldName") == "Market" for hit in method_summary["fieldAccesses"]),
            "sourceGetter": source_getter,
            "formatterHelpers": formatter_helpers,
            "stringComposeMethods": string_compose,
            "virtualUnityUiTextSetterInference": method_summary["virtualUnityUiTextSetterInference"],
        }

    row78_effect_payload = summarize_effect_payload_path(row78_effect)
    row83_effect_payload = summarize_effect_payload_path(row83_effect)
    update_inscryption_ui_move_next = summarize_search_method(
        "NavigationManager+<UpdateInscryptionUI>d__185",
        "MoveNext",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    update_inscryption_ui = summarize_search_method_if_present(
        "NavigationManager",
        "UpdateInscryptionUI",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    insc_enum_move_next = summarize_search_method_if_present(
        "NavigationManager+<InscEnum>d__186",
        "MoveNext",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    disable_inscryption_objects = summarize_search_method_if_present(
        "NavigationManager",
        "DisableInscryptionObjects",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    on_available_inscryptions_click = summarize_search_method_if_present(
        "NavigationManager",
        "OnAvailbleInscryptionsClick",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    on_finished_inscryptions_click = summarize_search_method_if_present(
        "NavigationManager",
        "OnFinishedInscryptionsClick",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    opening_chrystos_emporium = summarize_search_method_if_present(
        "TextHandlerShopNPCs",
        "OpeningChrystosEmporium",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    emporium_default_text = summarize_search_method_if_present(
        "TextHandlerShopNPCs",
        "EmporiumDefaultText",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    display_text_emporium_move_next = summarize_search_method(
        "TextHandlerShopNPCs+<DisplayTextEmporium>d__22",
        "MoveNext",
        current_lane_candidate_search,
        methods_by_rva,
        sorted_rvas,
        blob,
    )
    root_batch_call_resolution = [
        {
            "targetRva": call["targetRva"],
            "resolvedTarget": call.get("resolvedTarget"),
            "resolvedLookupMatches": rva_lookup_map.get(call["targetRva"], []) if isinstance(call.get("targetRva"), int) else [],
        }
        for call in set_all["callTargets"]
        if isinstance(call.get("targetRva"), int)
    ]

    def helper_labels(payload: dict[str, object]) -> list[str]:
        labels: list[str] = []
        for helper in payload["formatterHelpers"]:
            matches = helper.get("resolvedLookupMatches", [])
            if matches:
                labels.extend(
                    f"{match.get('fullTypeName')}.{match.get('methodName')}"
                    for match in matches
                    if isinstance(match, dict)
                )
            elif isinstance(helper.get("nativeHelperInference"), dict):
                native = helper["nativeHelperInference"]
                labels.append(f"{native.get('roleName')}@{helper['targetRva']}")
            else:
                labels.append(f"unresolved@{helper['targetRva']}")
        return labels

    row78_helper_labels = helper_labels(row78_effect_payload)
    row83_helper_labels = helper_labels(row83_effect_payload)

    findings = [
        "The runtime probe now recovers typed TextHandlerMarkets field offsets and native RVAs for the exact Emporium text-handler family, without reopening the asset walk or shell-remap lane.",
        "SetAllChrystosEmporiumTexts directly calls SetAllBaseBonusTexts inside TextHandlerMarkets, which confirms a real runtime-only producer chain on the THMarkets side.",
        "SetIS78BaseBonusText and SetIS83BaseBonusText both read their row-local TextHandlerMarkets fields IS78BaseBonusText and IS83BaseBonusText, compose a string, and then end in the standard IL2CPP virtual-dispatch pattern that loads a UnityEngine.UI.Text method pair from the target object's class and jumps through it.",
        "Because UnityEngine.UI.Text.set_text is itself a virtual one-string setter in the recovered runtime surface, the narrowest defensible read is that the SetISNBaseBonusText family is a checked runtime assignment lane into UnityEngine.UI.Text components, but only as an inferred virtual setter bind rather than a named direct-call edge.",
        "SetIS78BonusText and SetIS83BonusText form a second parallel runtime writer family: they read IS78BonusText and IS83BonusText, compose strings, and end in the same UnityEngine.UI.Text virtual-dispatch write pattern, which recovers a separate effect-label lane beyond the already checked base-bonus lane.",
        "The widened MultiverseMarket runtime surface now closes the row-78 and row-83 effect payload sources one step further: SetIS78BonusText calls MultiverseMarket.get_FinalIS78Bonus(), while SetIS83BonusText calls MultiverseMarket.get_FinalIS83Bonus(), before additional formatter helpers and System.String.Concat write into the recovered ISNBonusText sink.",
        "The same runtime surface now recovers a full typed effect-label family on TextHandlerMarkets from IS1BonusText through IS110BonusText and from SetIS1BonusText through SetIS110BonusText, plus the batch-level SetAllBonusTexts method, which closes the producer side for the non-current-value effect-label lane rather than only for rows 78 and 83.",
        "The same exact runtime surface also recovers a full IS1IDText through IS110IDText and SetIS1IDText through SetIS110IDText family on TextHandlerMarkets, which closes IDText off as its own dedicated row-label lane rather than as the sink for SetISNBonusText.",
        "That same exact typed runtime surface recovers no CurrentBonusText-named field and no SetCurrentBonusText-style writer family on TextHandlerMarkets, and the widened slot-name assembly search also fails to recover any typed Assembly-CSharp owner exposing CurrentBonusText as a field or direct Set* slot-writer method. CurrentBonusText therefore remains a separate runtime-only lane with no recovered dedicated producer.",
        "Because the row-local control-slot set is CurrentBonusText or BonusDescriptionText or PerLevelBonusText or DescriptionText or IDText, and the recovered runtime families now separately account for CurrentBonusText as absent, PerLevelBonusText via SetISNBaseBonusText, and IDText via SetISNIDText, while exposing no SetISNDescriptionText family at all, the narrowest typed repo-local slot alias for the recovered SetISNBonusText writer closes to BonusDescriptionText.",
        "The narrowed Emporium UI-updater fallback search now surfaces NavigationManager.UpdateInscryptionUI, NavigationManager+<UpdateInscryptionUI>d__185.MoveNext, NavigationManager+<InscEnum>d__186.MoveNext, NavigationManager.DisableInscryptionObjects, OnAvailbleInscryptionsClick, OnFinishedInscryptionsClick, TextHandlerShopNPCs.OpeningChrystosEmporium, TextHandlerShopNPCs.EmporiumDefaultText, and TextHandlerShopNPCs+<DisplayTextEmporium>d__22.MoveNext as the last plausible non-TextHandlerMarkets runtime candidates. The checked NavigationManager routines stay in row-filter, row-toggle, and coroutine-orchestration flow without recovered MultiverseMarket final-bonus getters, recovered TextHandlerMarkets SetISN writers, or string-compose-to-text-setter behavior, while the TextHandlerShopNPCs routines stay in Emporium dialogue/current-string flow rather than a row-local CurrentBonusText lane.",
    ]
    if row78_helper_labels or row83_helper_labels:
        findings.append(
            "The last two anonymous helper RVAs on the BonusDescriptionText path are now role-closed too: 28277222 is the runtime metadata-init helper reached from one-time guard blocks, and 28277761 is the null-reference throw helper reached only from the row-local null-guard branches."
        )

    result = {
        "dataset": "multiverse-market-text-runtime-probe",
        "generatedAt": str(date.today()),
        "sources": {
            "runtimeSurface": "data/unity-runtime-surface-probe.json",
            "libIl2cpp": "workbench/apk/base/libil2cpp.so",
        },
        "methodChain": {
            "producerType": "TextHandlerMarkets",
            "rootMethod": set_all,
            "costBatchMethod": set_all_cost,
            "baseBonusBatchMethod": set_all_base,
            "effectLabelBatchMethod": set_all_bonus,
            "idBatchMethod": set_all_id,
            "rootBatchCallResolution": root_batch_call_resolution,
            "controlRows": [
                {
                    "row": 78,
                    "runtimeMethod": row78,
                    "boundFieldNames": sorted({hit["fieldName"] for hit in row78["fieldAccesses"]}),
                },
                {
                    "row": 83,
                    "runtimeMethod": row83,
                    "boundFieldNames": sorted({hit["fieldName"] for hit in row83["fieldAccesses"]}),
                },
            ],
            "effectLabelControlRows": [
                {
                    "row": 78,
                    "runtimeMethod": row78_effect,
                    "boundFieldNames": sorted({hit["fieldName"] for hit in row78_effect["fieldAccesses"]}),
                    "payloadPath": row78_effect_payload,
                },
                {
                    "row": 83,
                    "runtimeMethod": row83_effect,
                    "boundFieldNames": sorted({hit["fieldName"] for hit in row83_effect["fieldAccesses"]}),
                    "payloadPath": row83_effect_payload,
                },
            ],
            "effectLabelFamilySurface": {
                "fieldFamilyFirst": bonus_text_field_names[0],
                "fieldFamilyLast": bonus_text_field_names[-1],
                "fieldFamilyCount": len(bonus_text_field_names),
                "methodFamilyFirst": bonus_text_method_names[0],
                "methodFamilyLast": bonus_text_method_names[-1],
                "methodFamilyCount": len(bonus_text_method_names),
            },
            "idLabelFamilySurface": {
                "fieldFamilyFirst": id_text_field_names[0],
                "fieldFamilyLast": id_text_field_names[-1],
                "fieldFamilyCount": len(id_text_field_names),
                "methodFamilyFirst": id_text_method_names[0],
                "methodFamilyLast": id_text_method_names[-1],
                "methodFamilyCount": len(id_text_method_names),
            },
            "descriptionTextFamilyStatus": {
                "rowNumberedDescriptionWriterCount": len(description_text_method_names),
                "rowNumberedDescriptionWritersRecovered": description_text_method_names,
            },
            "currentValueSlotStatus": {
                "textHandlerCurrentBonusTextFieldPresent": current_bonus_text_field_present,
                "textHandlerCurrentBonusTextWriterPresent": current_bonus_text_method_present,
                "assemblyCurrentSearchMatchCount": len(current_search_matches),
                "assemblyCurrentSearchTypeNames": [
                    match.get("fullName")
                    for match in current_search_matches
                    if isinstance(match, dict)
                ],
                "exactRowSlotSearchMatchCount": len(slot_search_matches),
                "exactRowSlotSearchTypeNames": [
                    match.get("fullName")
                    for match in slot_search_matches
                    if isinstance(match, dict)
                ],
                "narrowedEmporiumUiCandidateTypeNames": [
                    match.get("fullName")
                    for match in current_lane_candidate_search.get("matches", [])
                    if isinstance(match, dict)
                ],
                "currentLaneCandidateChecks": {
                    "updateInscryptionUi": update_inscryption_ui,
                    "updateInscryptionUiMoveNext": update_inscryption_ui_move_next,
                    "inscEnumMoveNext": insc_enum_move_next,
                    "disableInscryptionObjects": disable_inscryption_objects,
                    "onAvailbleInscryptionsClick": on_available_inscryptions_click,
                    "onFinishedInscryptionsClick": on_finished_inscryptions_click,
                    "openingChrystosEmporium": opening_chrystos_emporium,
                    "emporiumDefaultText": emporium_default_text,
                    "displayTextEmporiumMoveNext": display_text_emporium_move_next,
                },
                "sameSinkAsRecoveredEffectLabelFamily": False,
                "strongestCurrentInference": "The recovered ISNBonusText family is the non-current-value effect-label writer lane sourced from MultiverseMarket final-bonus getters, while CurrentBonusText remains a separate current-value slot with no recovered dedicated TextHandlerMarkets field or writer family. The widened runtime surface now also recovers SetAllBonusTexts as the batch entry for the ISNBonusText family, but still recovers no typed CurrentBonusText field, no SetCurrentBonusText writer family, and no typed Assembly-CSharp owner exposing CurrentBonusText as a field or direct Set* slot-writer method. The narrowed Emporium UI-updater fallback search now also checks NavigationManager.UpdateInscryptionUI, NavigationManager+<InscEnum>d__186.MoveNext, NavigationManager.DisableInscryptionObjects, OnAvailbleInscryptionsClick, OnFinishedInscryptionsClick, TextHandlerShopNPCs.OpeningChrystosEmporium, and TextHandlerShopNPCs.EmporiumDefaultText, but still only recovers row-filter, row-toggle, coroutine-orchestration, and Emporium dialogue/current-string flow rather than a row-local CurrentBonusText producer."
            },
            "effectLabelSlotAliasResolution": {
                "status": "closed-best-fit-typed-alias",
                "resolvedRowLocalAlias": "BonusDescriptionText",
                "ruledOutAliases": [
                    "CurrentBonusText",
                    "PerLevelBonusText",
                    "IDText",
                    "DescriptionText",
                ],
                "reasoning": [
                    "CurrentBonusText is excluded because TextHandlerMarkets exposes no CurrentBonusText-named field and no SetCurrentBonusText writer family.",
                    "PerLevelBonusText aligns with the separately recovered SetISNBaseBonusText lane rather than the recovered SetISNBonusText lane.",
                    "IDText aligns with the separately recovered SetIS1IDText through SetIS110IDText writer family on TextHandlerMarkets.",
                    "DescriptionText is not supported by any recovered SetISNDescriptionText family on TextHandlerMarkets.",
                    "BonusDescriptionText is the only remaining recovered row-local UnityEngine.UI.Text slot name compatible with the non-current, non-base, non-ID SetISNBonusText effect-label writer family."
                ],
            },
        },
        "findings": findings,
        "currentBoundary": [
            "Treat SaveData.ISNLevel through ISNID through BuyISN or SetISNCostText through row payload ID or Level or ISObject as the settled row-identity chain.",
            "Treat TextHandlerMarkets.SetAllChrystosEmporiumTexts through SetAllBaseBonusTexts through SetIS78BaseBonusText or SetIS83BaseBonusText as a checked runtime-only write path into UnityEngine.UI.Text for the base-bonus lane.",
            "Treat TextHandlerMarkets.SetAllBonusTexts through SetIS78BonusText or SetIS83BonusText as a separately recovered runtime-only effect-label write lane into UnityEngine.UI.Text, distinct from the base-bonus lane and sourced from MultiverseMarket.get_FinalIS78Bonus or get_FinalIS83Bonus plus GeneralFunctionsManager.BigDoubleToText or System.Int32.ToString, the runtime metadata-init helper, the null-reference throw helper, and System.String.Concat.",
            "Do not treat the recovered effect-label writer as completed canonical label truth for rows 78 or 83; the screenshot mismatch still falsifies sparse Inscryption N anchors as completed label truth.",
            "Treat CurrentBonusText as a separate unrecovered writer lane rather than as the sink for ISNBonusText, because TextHandlerMarkets now exposes a full ISNBonusText field and method family plus SetAllBonusTexts but no CurrentBonusText-named field or writer family, and the widened slot-name assembly search still recovers no typed Assembly-CSharp owner exposing CurrentBonusText as a field or direct slot-writer method.",
            "Treat NavigationManager.UpdateInscryptionUI, NavigationManager+<UpdateInscryptionUI>d__185.MoveNext, NavigationManager+<InscEnum>d__186.MoveNext, NavigationManager.DisableInscryptionObjects, OnAvailbleInscryptionsClick, OnFinishedInscryptionsClick, TextHandlerShopNPCs.OpeningChrystosEmporium, TextHandlerShopNPCs.EmporiumDefaultText, and TextHandlerShopNPCs+<DisplayTextEmporium>d__22.MoveNext as checked negative fallback candidates for the CurrentBonusText lane: the NavigationManager methods stay in row-filter, row-toggle, and coroutine-orchestration flow, while the TextHandlerShopNPCs methods stay in Emporium dialogue/current-string flow.",
            "Treat BonusDescriptionText as the closed row-local slot alias for the recovered ISNBonusText effect-label writer family, because the same runtime surface separately accounts for IDText via SetISNIDText, PerLevelBonusText via SetISNBaseBonusText, and excludes CurrentBonusText while exposing no SetISNDescriptionText family.",
            "Do not widen canonical import, planner behavior, or the shipped compatibility preview while the separate CurrentBonusText writer lane remains unrecovered.",
        ],
    }

    JSON_OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Multiverse Market Text Runtime Probe",
        "",
        f"Source: {md_link(RUNTIME_SURFACE_PATH)} plus native disassembly from {md_link(LIBIL2CPP_PATH)}.",
        "",
        "## Grounded conclusions",
        "",
    ]
    lines.extend(f"- {finding}" for finding in findings)
    lines.extend(["", "## Control methods", ""])
    for entry in result["methodChain"]["controlRows"]:
        method = entry["runtimeMethod"]
        lines.append(
            f"- `row={entry['row']}`; `{method['name']}`; `rva={method['rva']}`; `callsDirectUnityUiSetText={method['callsDirectUnityUiSetText']}`; `virtualUnityUiTextSetterInference={method['virtualUnityUiTextSetterInference']}`; `boundFields={entry['boundFieldNames']}`"
        )
    lines.extend(["", "## Effect-label methods", ""])
    for entry in result["methodChain"]["effectLabelControlRows"]:
        method = entry["runtimeMethod"]
        lines.append(
            f"- `row={entry['row']}`; `{method['name']}`; `rva={method['rva']}`; `callsDirectUnityUiSetText={method['callsDirectUnityUiSetText']}`; `virtualUnityUiTextSetterInference={method['virtualUnityUiTextSetterInference']}`; `boundFields={entry['boundFieldNames']}`"
        )
        payload = entry["payloadPath"]
        source_getter = payload["sourceGetter"]
        lines.append(
            f"  payload: `sinkField={payload['sinkField']}`; `marketFieldRead={payload['marketFieldRead']}`; "
            f"`sourceGetter={source_getter['name'] if isinstance(source_getter, dict) else None}`; "
            f"`formatterHelperRvas={[helper['targetRva'] for helper in payload['formatterHelpers']]}`"
        )
    family = result["methodChain"]["effectLabelFamilySurface"]
    lines.extend([
        "",
        "## Effect-label family surface",
        "",
        f"- `fields={family['fieldFamilyFirst']}..{family['fieldFamilyLast']}`; `count={family['fieldFamilyCount']}`",
        f"- `methods={family['methodFamilyFirst']}..{family['methodFamilyLast']}`; `count={family['methodFamilyCount']}`",
        f"- `SetAllBonusTexts recovered={set_all_bonus is not None}`",
        f"- `idFields={result['methodChain']['idLabelFamilySurface']['fieldFamilyFirst']}..{result['methodChain']['idLabelFamilySurface']['fieldFamilyLast']}`; `count={result['methodChain']['idLabelFamilySurface']['fieldFamilyCount']}`",
        f"- `idMethods={result['methodChain']['idLabelFamilySurface']['methodFamilyFirst']}..{result['methodChain']['idLabelFamilySurface']['methodFamilyLast']}`; `count={result['methodChain']['idLabelFamilySurface']['methodFamilyCount']}`",
        f"- `rowNumberedDescriptionWritersRecovered={result['methodChain']['descriptionTextFamilyStatus']['rowNumberedDescriptionWriterCount']}`",
        f"- `TextHandlerMarkets.CurrentBonusText field present={result['methodChain']['currentValueSlotStatus']['textHandlerCurrentBonusTextFieldPresent']}`",
        f"- `TextHandlerMarkets.SetCurrentBonusText writer present={result['methodChain']['currentValueSlotStatus']['textHandlerCurrentBonusTextWriterPresent']}`",
        f"- `Assembly-CSharp current-value search matches={result['methodChain']['currentValueSlotStatus']['assemblyCurrentSearchMatchCount']}`",
        f"- `Assembly-CSharp exact row-slot search matches={result['methodChain']['currentValueSlotStatus']['exactRowSlotSearchMatchCount']}`",
        f"- `narrowedEmporiumUiCandidateTypeCount={len(result['methodChain']['currentValueSlotStatus']['narrowedEmporiumUiCandidateTypeNames'])}`",
    ])
    lines.extend(["", "## Root batch resolution", ""])
    for call in root_batch_call_resolution:
        resolved = call["resolvedTarget"]
        if isinstance(resolved, dict):
            label = f"{resolved['typeName']}.{resolved['name']}"
        elif call["resolvedLookupMatches"]:
            label = ", ".join(
                f"{match['fullTypeName']}.{match['methodName']}"
                for match in call["resolvedLookupMatches"]
            )
        elif call["targetRva"] in NATIVE_HELPER_INFERENCES:
            native = NATIVE_HELPER_INFERENCES[call["targetRva"]]
            label = f"{native['roleName']} ({native['canonicalInference']})"
        else:
            label = "unresolved"
        lines.append(f"- `rva={call['targetRva']}`; `target={label}`")
    lines.extend([
        "",
        "## Slot alias resolution",
        "",
        f"- `resolvedRowLocalAlias={result['methodChain']['effectLabelSlotAliasResolution']['resolvedRowLocalAlias']}`",
    ])
    lines.extend(f"- {line}" for line in result["methodChain"]["effectLabelSlotAliasResolution"]["reasoning"])
    lines.extend(["", "## Helper-name narrowing", ""])
    lines.append(f"- `row78Helpers={row78_helper_labels}`")
    lines.append(f"- `row83Helpers={row83_helper_labels}`")
    lines.extend(["", "## Current lane fallback candidates", ""])
    current_checks = result["methodChain"]["currentValueSlotStatus"]["currentLaneCandidateChecks"]
    update_method = current_checks["updateInscryptionUi"]
    update_candidate = current_checks["updateInscryptionUiMoveNext"]
    insc_enum_candidate = current_checks["inscEnumMoveNext"]
    disable_candidate = current_checks["disableInscryptionObjects"]
    available_candidate = current_checks["onAvailbleInscryptionsClick"]
    finished_candidate = current_checks["onFinishedInscryptionsClick"]
    opening_candidate = current_checks["openingChrystosEmporium"]
    default_candidate = current_checks["emporiumDefaultText"]
    dialogue_candidate = current_checks["displayTextEmporiumMoveNext"]
    if update_method is not None:
        lines.append(
            f"- `updateInscryptionUi.rva={update_method['rva']}`; "
            f"`callsStringCompose={len(update_method['callsStringCompose'])}`; "
            f"`callsRecoveredFinalBonusGetters={len(update_method['callsRecoveredFinalBonusGetters'])}`; "
            f"`callsRecoveredBonusWriters={len(update_method['callsRecoveredBonusWriters'])}`; "
            f"`hasVirtualUnityUiTextSetterPattern={update_method['hasVirtualUnityUiTextSetterPattern']}`"
        )
    lines.append(
        f"- `updateInscryptionUiMoveNext.rva={update_candidate['rva']}`; "
        f"`callsStringCompose={len(update_candidate['callsStringCompose'])}`; "
        f"`callsRecoveredFinalBonusGetters={len(update_candidate['callsRecoveredFinalBonusGetters'])}`; "
        f"`callsRecoveredBonusWriters={len(update_candidate['callsRecoveredBonusWriters'])}`; "
        f"`hasVirtualUnityUiTextSetterPattern={update_candidate['hasVirtualUnityUiTextSetterPattern']}`"
    )
    if insc_enum_candidate is not None:
        lines.append(
            f"- `inscEnumMoveNext.rva={insc_enum_candidate['rva']}`; "
            f"`callsStringCompose={len(insc_enum_candidate['callsStringCompose'])}`; "
            f"`callsRecoveredFinalBonusGetters={len(insc_enum_candidate['callsRecoveredFinalBonusGetters'])}`; "
            f"`callsRecoveredBonusWriters={len(insc_enum_candidate['callsRecoveredBonusWriters'])}`; "
            f"`hasVirtualUnityUiTextSetterPattern={insc_enum_candidate['hasVirtualUnityUiTextSetterPattern']}`"
        )
    if disable_candidate is not None:
        lines.append(
            f"- `disableInscryptionObjects.rva={disable_candidate['rva']}`; "
            f"`callsStringCompose={len(disable_candidate['callsStringCompose'])}`; "
            f"`callsRecoveredFinalBonusGetters={len(disable_candidate['callsRecoveredFinalBonusGetters'])}`; "
            f"`callsRecoveredBonusWriters={len(disable_candidate['callsRecoveredBonusWriters'])}`; "
            f"`hasVirtualUnityUiTextSetterPattern={disable_candidate['hasVirtualUnityUiTextSetterPattern']}`"
        )
    if available_candidate is not None:
        lines.append(
            f"- `onAvailbleInscryptionsClick.rva={available_candidate['rva']}`; "
            f"`callsStringCompose={len(available_candidate['callsStringCompose'])}`; "
            f"`callsRecoveredFinalBonusGetters={len(available_candidate['callsRecoveredFinalBonusGetters'])}`; "
            f"`callsRecoveredBonusWriters={len(available_candidate['callsRecoveredBonusWriters'])}`; "
            f"`hasVirtualUnityUiTextSetterPattern={available_candidate['hasVirtualUnityUiTextSetterPattern']}`"
        )
    if finished_candidate is not None:
        lines.append(
            f"- `onFinishedInscryptionsClick.rva={finished_candidate['rva']}`; "
            f"`callsStringCompose={len(finished_candidate['callsStringCompose'])}`; "
            f"`callsRecoveredFinalBonusGetters={len(finished_candidate['callsRecoveredFinalBonusGetters'])}`; "
            f"`callsRecoveredBonusWriters={len(finished_candidate['callsRecoveredBonusWriters'])}`; "
            f"`hasVirtualUnityUiTextSetterPattern={finished_candidate['hasVirtualUnityUiTextSetterPattern']}`"
        )
    if opening_candidate is not None:
        lines.append(
            f"- `openingChrystosEmporium.rva={opening_candidate['rva']}`; "
            f"`callsStringCompose={len(opening_candidate['callsStringCompose'])}`; "
            f"`callsRecoveredFinalBonusGetters={len(opening_candidate['callsRecoveredFinalBonusGetters'])}`; "
            f"`callsRecoveredBonusWriters={len(opening_candidate['callsRecoveredBonusWriters'])}`; "
            f"`hasVirtualUnityUiTextSetterPattern={opening_candidate['hasVirtualUnityUiTextSetterPattern']}`"
        )
    if default_candidate is not None:
        lines.append(
            f"- `emporiumDefaultText.rva={default_candidate['rva']}`; "
            f"`callsStringCompose={len(default_candidate['callsStringCompose'])}`; "
            f"`callsRecoveredFinalBonusGetters={len(default_candidate['callsRecoveredFinalBonusGetters'])}`; "
            f"`callsRecoveredBonusWriters={len(default_candidate['callsRecoveredBonusWriters'])}`; "
            f"`hasVirtualUnityUiTextSetterPattern={default_candidate['hasVirtualUnityUiTextSetterPattern']}`"
        )
    lines.append(
        f"- `displayTextEmporiumMoveNext.rva={dialogue_candidate['rva']}`; "
        f"`callsStringCompose={len(dialogue_candidate['callsStringCompose'])}`; "
        f"`callsRecoveredFinalBonusGetters={len(dialogue_candidate['callsRecoveredFinalBonusGetters'])}`; "
        f"`callsRecoveredBonusWriters={len(dialogue_candidate['callsRecoveredBonusWriters'])}`; "
        f"`hasVirtualUnityUiTextSetterPattern={dialogue_candidate['hasVirtualUnityUiTextSetterPattern']}`"
    )
    lines.extend(["", "## Current boundary", ""])
    lines.extend(f"- {line}" for line in result["currentBoundary"])
    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
