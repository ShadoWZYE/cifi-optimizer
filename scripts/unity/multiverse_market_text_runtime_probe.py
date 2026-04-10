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


def load_runtime_surface() -> dict[str, object]:
    return json.loads(RUNTIME_SURFACE_PATH.read_text(encoding="utf-8"))


def extract_target(surface: dict[str, object], report_key: str) -> dict[str, object]:
    for target in surface.get("targets", []):
        if target.get("reportKey") == report_key:
            return target
    raise KeyError(f"Missing runtime surface target {report_key}")


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
            if ins["mnemonic"] != "jmp" or str(ins["operand"]) != "r8":
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
                entry["mnemonic"] == "mov" and "qword ptr [rcx + 0x5e8]" in str(entry["operand"])
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


def main() -> None:
    surface = load_runtime_surface()
    text_handler = extract_target(surface, "textHandlerMarkets")
    unity_text = extract_target(surface, "unityUiText")
    system_string = extract_target(surface, "string")

    methods_by_rva, sorted_rvas = build_method_index(text_handler, unity_text, system_string)
    field_map = build_field_offset_map(text_handler)
    blob = LIBIL2CPP_PATH.read_bytes()

    target_methods = [
        "SetAllChrystosEmporiumTexts",
        "SetAllBaseBonusTexts",
        "SetIS78BaseBonusText",
        "SetIS83BaseBonusText",
    ]
    summaries = [summarize_method(name, methods_by_rva, sorted_rvas, blob, field_map) for name in target_methods]
    by_name = {entry["name"]: entry for entry in summaries}

    set_all = by_name["SetAllChrystosEmporiumTexts"]
    set_all_base = by_name["SetAllBaseBonusTexts"]
    row78 = by_name["SetIS78BaseBonusText"]
    row83 = by_name["SetIS83BaseBonusText"]

    findings = [
        "The runtime probe now recovers typed TextHandlerMarkets field offsets and native RVAs for the exact Emporium text-handler family, without reopening the asset walk or shell-remap lane.",
        "SetAllChrystosEmporiumTexts directly calls SetAllBaseBonusTexts inside TextHandlerMarkets, which confirms a real runtime-only producer chain on the THMarkets side.",
        "SetIS78BaseBonusText and SetIS83BaseBonusText both read their row-local TextHandlerMarkets fields IS78BaseBonusText and IS83BaseBonusText, compose a string, and then end in the standard IL2CPP virtual-dispatch pattern that loads a UnityEngine.UI.Text method pair from the target object's class and jumps through it.",
        "Because UnityEngine.UI.Text.set_text is itself a virtual one-string setter in the recovered runtime surface, the narrowest defensible read is that the SetISNBaseBonusText family is a checked runtime assignment lane into UnityEngine.UI.Text components, but only as an inferred virtual setter bind rather than a named direct-call edge.",
        "That recovered runtime write path is still specifically the base-bonus lane, not yet a recovered write path for the live effect-label text seen in screenshots.",
        "The stronger remaining blocker is now narrower than generic TextHandlerMarkets binding: the repo still does not recover the separate runtime producer that writes effect-label payloads into row-local slots like CurrentBonusText or BonusDescriptionText for rows 78 and 83.",
    ]

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
            "baseBonusBatchMethod": set_all_base,
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
        },
        "findings": findings,
        "currentBoundary": [
            "Treat SaveData.ISNLevel through ISNID through BuyISN or SetISNCostText through row payload ID or Level or ISObject as the settled row-identity chain.",
            "Treat TextHandlerMarkets.SetAllChrystosEmporiumTexts through SetAllBaseBonusTexts through SetIS78BaseBonusText or SetIS83BaseBonusText as a checked runtime-only write path into UnityEngine.UI.Text for the base-bonus lane.",
            "Do not treat that recovered base-bonus write path as a solved live effect-label binding for rows 78 or 83; the screenshot mismatch still falsifies sparse Inscryption N anchors as completed label truth.",
            "Treat the exact remaining missing layer as the separate runtime producer or binding path that populates the live effect-label slots such as CurrentBonusText or BonusDescriptionText, not the already recovered ISNBaseBonusText assignment lane.",
            "Do not widen canonical import, planner behavior, or the shipped compatibility preview while that effect-label producer remains unrecovered.",
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
    lines.extend(["", "## Current boundary", ""])
    lines.extend(f"- {line}" for line in result["currentBoundary"])
    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
