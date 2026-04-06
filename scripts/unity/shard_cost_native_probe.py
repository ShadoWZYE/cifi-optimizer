from __future__ import annotations

import json
import re
import struct
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VENDOR_PATH = ROOT / ".vendor_manual"
if str(VENDOR_PATH) not in sys.path:
    sys.path.insert(0, str(VENDOR_PATH))

from capstone import Cs, CS_ARCH_X86, CS_MODE_64  # type: ignore
from elftools.elf.elffile import ELFFile  # type: ignore


METHOD_PROBE_PATH = ROOT / "data" / "shard-cost-method-probe.v1.json"
UABEA_REPORT_PATH = ROOT / "data" / "uabea-probe-report.json"
PARAMETER_PROBE_PATH = ROOT / "data" / "shard-cost-parameter-probe.v1.json"
LIBIL2CPP_PATH = ROOT / "workbench" / "apk" / "base" / "libil2cpp.so"
JSON_OUT = ROOT / "data" / "shard-cost-native-probe.v1.json"
MD_OUT = ROOT / "docs" / "systems" / "shards" / "shard-cost-native-probe.md"

FIELD_READ_RE = re.compile(r"\[(?P<base>rbx|r14) \+ (?P<offset>0x[0-9a-f]+)\]")
SHARD_COST_FIELD_RE = re.compile(r"^SU(?P<row>\d+)(StartCost|CostExponent|GrowthExponent\d*)$")
RIP_LOAD_RE = re.compile(r"\[rip (?P<sign>[+-]) (?P<offset>0x[0-9a-f]+)\]")

HELPER_TARGET_SUMMARIES = {
    "0x24e1a07": "Builds a BreakInfinity.BigDouble from the current double literal input.",
    "0x24e1d36": "Converts an integer input into a BreakInfinity.BigDouble shell.",
    "0x24e1d8d": "Converts a float input into a BreakInfinity.BigDouble shell.",
    "0x24e1cb3": "Runs the checked multiply-side BreakInfinity.BigDouble lane after metadata/class-init guards, with a nearby ~0.007812501835424509 normalization literal in the checked body.",
    "0x24e1ab0": "Tail-jumps into the checked BreakInfinity.BigDouble additive merge helper at 0x24e176a after metadata/class-init guards.",
    "0x24e3620": "Feeds one BigDouble lane through a follow-up helper before tail-jumping into a larger routine.",
    "0x24e20d9": "Enters the shard-side remainder transform family, which routes through 0x24e1a2b, 0x24e1452, and 0x24e0faa before rejoining the additive path.",
    "0x24e176a": "Acts as the checked BreakInfinity.BigDouble additive or merge lane for two inputs, with zero, infinity, and exponent-gap handling plus a nearby ~0.007812501844669254 normalization literal.",
    "0x24e1c3f": "Builds a reciprocal-style BigDouble helper input by dividing a tiny 5.238690707360522e-11 literal by the argument and negating the paired integer exponent.",
    "0x24e1b33": "Multiplies two checked BigDouble mantissa lanes, adds the paired integer exponents, then normalizes through 0x24e0746.",
    "0x24e05a0": "Builds or normalizes a BreakInfinity.BigDouble pair from a plain double input, with special handling for NaN, infinity, and zero.",
    "0x24e06df": "Behaves like a near-zero predicate on the incoming double lane.",
    "0x24e09f8": "Behaves like an infinity predicate on the incoming double lane.",
    "0x24e0cda": "Converts a BreakInfinity.BigDouble pair into a plain double with exponent-band clamps around double-decimal limits.",
    "0x24e0746": "Normalizes a mantissa-plus-exponent pair back into a BreakInfinity.BigDouble representation.",
}

LEVEL_GATE_VALUES = {
    0x64: 100,
    0xC8: 200,
    0x12C: 300,
    0x190: 400,
}

OVER_LEVEL_BASE_FIELD_BY_GETTER = {
    "get_OverLevel100Exponent": "OverLevel100Base",
    "get_OverLevel200Exponent": "OverLevel200Base",
    "get_OverLevel300Exponent": "OverLevel300Base",
    "get_OverLevel400Exponent": "OverLevel400Base",
}


def load_method_probe() -> dict[str, object]:
    return json.loads(METHOD_PROBE_PATH.read_text(encoding="utf-8"))


def load_parameter_probe_rows() -> dict[int, dict[str, object]]:
    probe = json.loads(PARAMETER_PROBE_PATH.read_text(encoding="utf-8"))
    rows = probe.get("rowAlignedTupleCandidates", [])
    mapping: dict[int, dict[str, object]] = {}
    for entry in rows:
        row = entry.get("row")
        if isinstance(row, int):
            mapping[row] = entry
    return mapping


def build_over_level_getter_map(method_probe: dict[str, object]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    helper_methods = method_probe.get("helperMethods", [])
    for entry in helper_methods:
        name = entry.get("name")
        rva = entry.get("rva")
        if not isinstance(name, str) or not isinstance(rva, int):
            continue
        if not name.startswith("get_OverLevel"):
            continue
        mapping[format_offset(rva)] = name
    return mapping


def load_field_offset_map() -> dict[int, str]:
    report = json.loads(UABEA_REPORT_PATH.read_text(encoding="utf-8"))
    for entry in report.get("directTargetTypeMetadata", []):
        if entry.get("scriptName") != "ShardMining":
            continue
        fields = entry.get("fields", [])
        mapping: dict[int, str] = {}
        for field in fields:
            offset = field.get("fieldOffset")
            name = field.get("name")
            if isinstance(offset, int) and isinstance(name, str):
                mapping[offset] = name
        return mapping
    raise RuntimeError("ShardMining field metadata missing from uabea-probe-report.json")


def load_plt_symbol_map() -> dict[str, str]:
    with LIBIL2CPP_PATH.open("rb") as handle:
        elf = ELFFile(handle)
        plt = elf.get_section_by_name(".plt")
        rela = elf.get_section_by_name(".rela.plt") or elf.get_section_by_name(".rel.plt")
        if plt is None or rela is None:
            raise RuntimeError("libil2cpp.so is missing .plt or .rela.plt")
        dynsym = elf.get_section(rela["sh_link"])
        if dynsym is None:
            raise RuntimeError("libil2cpp.so is missing dynsym for .rela.plt")
        section_bias = int(plt["sh_addr"]) - int(plt["sh_offset"])
        got_to_name = {
            int(rel["r_offset"]): dynsym.get_symbol(rel["r_info_sym"]).name
            for rel in rela.iter_relocations()
        }

    stubs: dict[str, str] = {}
    for stub_start in (0x4437DD0, 0x4437E30, 0x4437E50, 0x44385D0):
        entry = next(Cs(CS_ARCH_X86, CS_MODE_64).disasm(LIBIL2CPP_PATH.read_bytes()[stub_start : stub_start + 6], stub_start))
        match = RIP_LOAD_RE.search(entry.op_str)
        if match is None:
            continue
        displacement = int(match.group("offset"), 16)
        if match.group("sign") == "-":
            displacement = -displacement
        got_file_offset = int(entry.address) + int(entry.size) + displacement
        symbol_name = got_to_name.get(got_file_offset + section_bias)
        if symbol_name:
            stubs[format_offset(stub_start)] = symbol_name
    return stubs


def format_offset(value: int) -> str:
    return f"0x{value:x}"


def collect_field_reads(code: bytes, start: int, limit: int = 32) -> list[dict[str, object]]:
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    rows: list[dict[str, object]] = []
    for ins in md.disasm(code, start):
        match = FIELD_READ_RE.search(ins.op_str)
        if match:
            rows.append(
                {
                    "address": ins.address,
                    "mnemonic": ins.mnemonic,
                    "baseRegister": match.group("base"),
                    "offset": int(match.group("offset"), 16),
                    "offsetHex": match.group("offset"),
                    "operand": ins.op_str,
                }
            )
            if len(rows) >= limit:
                break
    return rows


def collect_instructions(code: bytes, start: int, limit: int | None = None) -> list[dict[str, object]]:
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    rows: list[dict[str, object]] = []
    for ins in md.disasm(code, start):
        rows.append(
            {
                "address": ins.address,
                "mnemonic": ins.mnemonic,
                "operand": ins.op_str,
                "size": ins.size,
            }
        )
        if limit is not None and len(rows) >= limit:
            break
    return rows


def derive_operand_pair_starts(field_reads: list[dict[str, object]]) -> list[str]:
    starts: list[str] = []
    for entry in field_reads:
        if entry["mnemonic"] != "movsd":
            continue
        offset_hex = str(entry["offsetHex"])
        if offset_hex == "0x20":
            continue
        starts.append(offset_hex)
    return starts


def attach_field_names(
    field_reads: list[dict[str, object]],
    field_offset_map: dict[int, str],
) -> tuple[list[dict[str, object]], list[str]]:
    named_reads: list[dict[str, object]] = []
    operand_fields: list[str] = []
    for entry in field_reads:
        offset = int(entry["offset"])
        field_name = field_offset_map.get(offset)
        if field_name is None and offset >= 8:
            field_name = field_offset_map.get(offset - 8)
        named_entry = dict(entry)
        if field_name:
            named_entry["fieldName"] = field_name
        named_reads.append(named_entry)
        if entry["mnemonic"] == "movsd" and field_name:
            operand_fields.append(field_name)
    return named_reads, operand_fields


def derive_cost_field_usage(field_reads: list[dict[str, object]], row: int) -> list[str]:
    seen: list[str] = []
    prefix = f"SU{row}"
    for entry in field_reads:
        field_name = entry.get("fieldName")
        if not isinstance(field_name, str):
            continue
        if not field_name.startswith(prefix):
            continue
        if not SHARD_COST_FIELD_RE.match(field_name):
            continue
        if field_name not in seen:
            seen.append(field_name)
    return seen


def collect_early_calls(code: bytes, start: int, limit: int = 12) -> list[dict[str, object]]:
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    calls: list[dict[str, object]] = []
    for ins in md.disasm(code, start):
        if ins.mnemonic == "call":
            calls.append(
                {
                    "address": ins.address,
                    "target": ins.op_str,
                }
            )
            if len(calls) >= limit:
                break
    return calls


def derive_level_gate_checks(code: bytes, start: int) -> list[int]:
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    gates: list[int] = []
    for ins in md.disasm(code, start):
        if ins.mnemonic != "cmp":
            continue
        operand = ins.op_str.replace(" ", "")
        match = re.fullmatch(r"eax,0x([0-9a-f]+)", operand)
        if not match:
            continue
        immediate = int(match.group(1), 16)
        gate = LEVEL_GATE_VALUES.get(immediate)
        if gate is None or gate in gates:
            continue
        gates.append(gate)
    return gates


def derive_threshold_stages(call_targets: list[str], over_level_getter_map: dict[str, str]) -> list[dict[str, object]]:
    stages: list[dict[str, object]] = []
    seen: set[str] = set()
    for target in call_targets:
        getter_name = over_level_getter_map.get(target)
        if getter_name is None or getter_name in seen:
            continue
        seen.add(getter_name)
        match = re.search(r"OverLevel(?P<level>\d+)Exponent", getter_name)
        minimum_level = int(match.group("level")) if match else None
        stages.append(
            {
                "minimumLevel": minimum_level,
                "getterName": getter_name,
                "getterTarget": target,
                "baseFieldName": OVER_LEVEL_BASE_FIELD_BY_GETTER.get(getter_name),
            }
        )
    return stages


def find_instruction_index(
    instructions: list[dict[str, object]],
    *,
    mnemonic: str,
    operand: str | None = None,
    start_index: int = 0,
) -> int | None:
    for index in range(start_index, len(instructions)):
        entry = instructions[index]
        if entry["mnemonic"] != mnemonic:
            continue
        if operand is not None and entry["operand"] != operand:
            continue
        return index
    return None


def any_call_target(instructions: list[dict[str, object]], target: str) -> bool:
    return any(entry["mnemonic"] == "call" and entry["operand"] == target for entry in instructions)


def any_jump_target(instructions: list[dict[str, object]], target: str) -> bool:
    return any(entry["mnemonic"] == "jmp" and entry["operand"] == target for entry in instructions)


def any_field_name(instructions: list[dict[str, object]], prefix: str) -> bool:
    for entry in instructions:
        field_name = entry.get("fieldName")
        if isinstance(field_name, str) and field_name.startswith(prefix):
            return True
    return False


def extract_rip_literal_loads(
    instructions: list[dict[str, object]],
    blob: bytes,
) -> list[dict[str, object]]:
    loads: list[dict[str, object]] = []
    for entry in instructions:
        mnemonic = entry["mnemonic"]
        if mnemonic not in {"movsd", "movss"}:
            continue
        operand = str(entry["operand"])
        match = RIP_LOAD_RE.search(operand)
        if not match:
            continue
        disp = int(match.group("offset"), 16)
        if match.group("sign") == "-":
            disp = -disp
        target = int(entry["address"]) + int(entry["size"]) + disp
        if mnemonic == "movsd":
            value = struct.unpack_from("<d", blob, target)[0]
        else:
            value = struct.unpack_from("<f", blob, target)[0]
        loads.append(
            {
                "address": int(entry["address"]),
                "mnemonic": mnemonic,
                "targetAddress": target,
                "value": value,
            }
        )
    return loads


def derive_hundred_stage_structure(
    instructions: list[dict[str, object]],
    named_field_reads: list[dict[str, object]],
    row: int,
    blob: bytes,
) -> dict[str, object] | None:
    gate_index = find_instruction_index(instructions, mnemonic="cmp", operand="eax, 0x64")
    if gate_index is None:
        return None
    next_gate_index = find_instruction_index(
        instructions,
        mnemonic="cmp",
        operand="eax, 0x12c",
        start_index=gate_index + 1,
    )
    window = instructions[gate_index : next_gate_index if next_gate_index is not None else len(instructions)]
    if not window:
        return None

    divide_by_100 = any(
        entry["mnemonic"] == "imul" and entry["operand"] == "rax, rax, 0x51eb851f"
        for entry in window
    )
    has_loop_compare = any(entry["mnemonic"] == "ucomisd" for entry in window)
    has_loop_increment = any(entry["mnemonic"] == "addsd" for entry in window)
    has_loop_counter_to_double = any(
        entry["mnemonic"] == "cvtsi2sd" and entry["operand"] == "xmm0, eax" for entry in window
    )

    remainder_lane = {
        "usesCurrentLevelBigDouble": any_call_target(window, "0x24e1d36"),
        "usesBoundary100BigDouble": any(
            entry["mnemonic"] == "mov" and entry["operand"] == "edi, 0x64" for entry in window
        )
        and any_call_target(window, "0x24e1d36"),
        "powerHelperTarget": "0x24e20d9" if any_call_target(window, "0x24e20d9") else None,
        "followUpMergeTarget": "0x24e3620" if any_call_target(window, "0x24e3620") else None,
        "finalMergeTarget": "0x24e1cb3" if any_call_target(window, "0x24e1cb3") else None,
    }

    prefix = f"SU{row}"
    stage_field_usage: list[str] = []
    for entry in named_field_reads:
        field_name = entry.get("fieldName")
        address = entry.get("address")
        if not isinstance(field_name, str) or not field_name.startswith(prefix):
            continue
        if not isinstance(address, int):
            continue
        if next_gate_index is not None and address >= window[-1]["address"]:
            continue
        if field_name not in stage_field_usage:
            stage_field_usage.append(field_name)

    return {
        "divideBy100CompilerPattern": divide_by_100,
        "loopCounterConvertedToBigDouble": has_loop_counter_to_double,
        "perHundredLoop": {
            "usesLoopCompare": has_loop_compare,
            "usesLoopIncrementLiteral": has_loop_increment,
            "initialLiteralBuilderTarget": "0x24e1a07" if any_call_target(window, "0x24e1a07") else None,
            "loopMergeTarget": "0x24e1cb3" if any_call_target(window, "0x24e1cb3") else None,
        },
        "remainderLane": remainder_lane,
        "stageFieldUsage": stage_field_usage,
        "literalLoads": extract_rip_literal_loads(window, blob),
    }


def derive_three_hundred_stage_cost_lane(
    instructions: list[dict[str, object]],
    named_field_reads: list[dict[str, object]],
    row: int,
) -> dict[str, object] | None:
    gate_index = find_instruction_index(instructions, mnemonic="cmp", operand="eax, 0x12c")
    if gate_index is None:
        return None
    window = instructions[gate_index : min(len(instructions), gate_index + 80)]
    prefix = f"SU{row}"
    stage_field_usage: list[str] = []
    for entry in named_field_reads:
        field_name = entry.get("fieldName")
        address = entry.get("address")
        if not isinstance(field_name, str) or not field_name.startswith(prefix):
            continue
        if not isinstance(address, int) or address < window[0]["address"] or address > window[-1]["address"]:
            continue
        if field_name not in stage_field_usage:
            stage_field_usage.append(field_name)

    if not stage_field_usage and not any_call_target(window, "0x24e1cb3"):
        return None

    return {
        "usesPositiveRemainderGate": any(
            entry["mnemonic"] == "test" and entry["operand"] == "eax, eax" for entry in window
        ),
        "usesCurrentLevelBigDouble": any(
            entry["mnemonic"] == "cvtsi2sd" and entry["operand"] == "xmm0, eax" for entry in window
        ),
        "stageFieldUsage": stage_field_usage,
        "usesCostExponentAndGrowthExponentLane": any(
            field_name.endswith("CostExponent") or field_name.endswith("GrowthExponent")
            for field_name in stage_field_usage
        ),
        "mergeTargets": [
            target
            for target in ("0x24e1cb3", "0x24e1ab0", "0x24e3620")
            if any_call_target(window, target)
        ],
    }


def derive_stage_dispatch_call_families(
    instructions: list[dict[str, object]],
) -> list[dict[str, object]]:
    gate_points: list[tuple[int, int]] = []
    for item in instructions:
        if item["mnemonic"] != "cmp":
            continue
        operand = str(item["operand"])
        if operand not in {"eax, 0x64", "eax, 0xc8", "eax, 0x12c", "eax, 0x190"}:
            continue
        immediate = int(operand.split(", ", 1)[1], 16)
        gate_points.append((int(item["address"]), LEVEL_GATE_VALUES[immediate]))

    families: list[dict[str, object]] = []
    for index, entry in enumerate(instructions):
        if entry["mnemonic"] != "call" or entry["operand"] != "0x24e3620":
            continue
        window = instructions[max(0, index - 18) : min(len(instructions), index + 8)]
        preceding_calls = [
            item["operand"]
            for item in window
            if item["address"] < entry["address"] and item["mnemonic"] == "call"
        ]
        following_calls = [
            item["operand"]
            for item in window
            if item["address"] > entry["address"] and item["mnemonic"] == "call"
        ]
        integer_seeds: list[int] = []
        for item in window:
            if item["mnemonic"] != "mov" or not str(item["operand"]).startswith("edi, "):
                continue
            seed_text = str(item["operand"]).split(", ", 1)[1]
            try:
                integer_seeds.append(int(seed_text, 0))
            except ValueError:
                continue
        previous_gates = [gate for gate in gate_points if gate[0] < int(entry["address"])]
        next_gates = [gate for gate in gate_points if gate[0] > int(entry["address"])]
        previous_gate_levels = [gate[1] for gate in previous_gates[-2:]]
        next_gate_levels = [gate[1] for gate in next_gates[:2]]
        threshold_window = "pre-threshold"
        if previous_gates:
            latest = previous_gates[-1][1]
            if latest >= 400:
                threshold_window = "post-400-window"
            elif latest >= 300:
                threshold_window = "300-plus-window"
            elif latest >= 200:
                threshold_window = "200-plus-window"
            elif latest >= 100:
                threshold_window = "100-plus-window"
        family = {
            "callAddress": entry["address"],
            "precedingCallTargets": preceding_calls,
            "followingCallTargets": following_calls,
            "usesUnaryThresholdTransform": "0x24e20d9" in preceding_calls,
            "usesPreMergeMultiply": "0x24e1cb3" in preceding_calls,
            "usesPreMergeAdd": "0x24e1ab0" in preceding_calls,
            "usesCurrentLevelBigDouble": "0x24e1d36" in preceding_calls,
            "usesLiteralBuilder": "0x24e1a07" in preceding_calls,
            "integerSeeds": integer_seeds,
            "previousGateLevels": previous_gate_levels,
            "nextGateLevels": next_gate_levels,
            "thresholdWindow": threshold_window,
            "postDispatchMergeTarget": following_calls[0] if following_calls else None,
        }
        families.append(family)
    return families


def derive_sampled_offset_feeder(
    instructions: list[dict[str, object]],
    blob: bytes,
    call_address: int,
) -> dict[str, object] | None:
    index = next((i for i, entry in enumerate(instructions) if int(entry["address"]) == call_address), None)
    if index is None:
        return None
    window = instructions[max(0, index - 36) : index + 1]
    level_offset = None
    coefficient = None
    feeder_model = None

    for entry in window:
        if entry["mnemonic"] == "lea":
            match = re.fullmatch(r"edi, \[rax - 0x([0-9a-f]+)\]", str(entry["operand"]))
            if match:
                level_offset = int(match.group(1), 16)
        elif entry["mnemonic"] == "add":
            match = re.fullmatch(r"ebp, -0x([0-9a-f]+)", str(entry["operand"]))
            if match:
                level_offset = int(match.group(1), 16)
        elif entry["mnemonic"] == "mulsd":
            match = RIP_LOAD_RE.search(str(entry["operand"]))
            if match:
                disp = int(match.group("offset"), 16)
                if match.group("sign") == "-":
                    disp = -disp
                target = int(entry["address"]) + int(entry["size"]) + disp
                coefficient = struct.unpack_from("<d", blob, target)[0]
                feeder_model = "scalarOffsetTimesCoefficientThenAdd"
        elif entry["mnemonic"] == "movsd" and coefficient is None:
            if "xmm0, qword ptr [rip " not in str(entry["operand"]):
                continue
            match = RIP_LOAD_RE.search(str(entry["operand"]))
            if match:
                disp = int(match.group("offset"), 16)
                if match.group("sign") == "-":
                    disp = -disp
                target = int(entry["address"]) + int(entry["size"]) + disp
                coefficient = struct.unpack_from("<d", blob, target)[0]
                feeder_model = "literalTimesBigDoubleOffsetThenAdd"

    if level_offset is None or coefficient is None or feeder_model is None:
        return None
    return {
        "callAddress": call_address,
        "levelOffset": level_offset,
        "coefficient": coefficient,
        "model": feeder_model,
    }


def derive_window_offset_families(
    rows: list[dict[str, object]],
    instructions_by_row: dict[int, list[dict[str, object]]],
    blob: bytes,
) -> dict[str, object]:
    hundred_window_feeders: list[dict[str, object]] = []
    two_hundred_window_feeders: list[dict[str, object]] = []

    for row_entry in rows:
        row = int(row_entry["row"])
        if row not in instructions_by_row:
            continue
        families = row_entry.get("stageDispatchCallFamilies", [])
        if not isinstance(families, list):
            continue
        for family in families:
            if not isinstance(family, dict):
                continue
            threshold_window = family.get("thresholdWindow")
            call_address = family.get("callAddress")
            if not isinstance(call_address, int) or not isinstance(threshold_window, str):
                continue
            extracted = derive_sampled_offset_feeder(instructions_by_row[row], blob, call_address)
            if extracted is None:
                continue
            enriched = {
                "row": row,
                "thresholdWindow": threshold_window,
                "usesLiteralBuilder": bool(family.get("usesLiteralBuilder")),
                "usesPreMergeAdd": bool(family.get("usesPreMergeAdd")),
                "usesPreMergeMultiply": bool(family.get("usesPreMergeMultiply")),
                **extracted,
            }
            if threshold_window == "100-plus-window" and enriched["usesPreMergeAdd"]:
                hundred_window_feeders.append(enriched)
            if threshold_window == "200-plus-window" and enriched["usesPreMergeAdd"] and enriched["usesPreMergeMultiply"]:
                two_hundred_window_feeders.append(enriched)

    family_rows: dict[tuple[object, ...], list[int]] = defaultdict(list)
    for entry in hundred_window_feeders:
        key = (
            entry["model"],
            entry["levelOffset"],
            entry["usesLiteralBuilder"],
            entry["usesPreMergeMultiply"],
        )
        family_rows[key].append(int(entry["row"]))

    family_summaries = []
    for key, grouped_rows in sorted(family_rows.items(), key=lambda item: item[1]):
        model, level_offset, uses_literal_builder, uses_pre_merge_multiply = key
        family_summaries.append(
            {
                "thresholdWindow": "100-plus-window",
                "model": model,
                "levelOffset": level_offset,
                "usesLiteralBuilder": uses_literal_builder,
                "usesPreMergeMultiply": uses_pre_merge_multiply,
                "rows": grouped_rows,
            }
        )

    two_hundred_family_rows: dict[tuple[object, ...], list[int]] = defaultdict(list)
    three_hundred_family_rows: dict[tuple[object, ...], list[int]] = defaultdict(list)
    for row_entry in rows:
        families = row_entry.get("stageDispatchCallFamilies", [])
        if not isinstance(families, list):
            continue
        for family in families:
            if not isinstance(family, dict):
                continue
            threshold_window = family.get("thresholdWindow")
            if not isinstance(threshold_window, str):
                continue
            key = (
                bool(family.get("usesUnaryThresholdTransform")),
                bool(family.get("usesPreMergeMultiply")),
                bool(family.get("usesPreMergeAdd")),
                bool(family.get("usesCurrentLevelBigDouble")),
                bool(family.get("usesLiteralBuilder")),
                tuple(int(seed) for seed in family.get("integerSeeds", [])),
            )
            if threshold_window == "200-plus-window":
                two_hundred_family_rows[key].append(int(row_entry["row"]))
            elif threshold_window == "300-plus-window":
                three_hundred_family_rows[key].append(int(row_entry["row"]))

    two_hundred_family_summaries = []
    for key, grouped_rows in sorted(two_hundred_family_rows.items(), key=lambda item: item[1]):
        (
            uses_unary_threshold_transform,
            uses_pre_merge_multiply,
            uses_pre_merge_add,
            uses_current_level_big_double,
            uses_literal_builder,
            integer_seeds,
        ) = key
        two_hundred_family_summaries.append(
            {
                "thresholdWindow": "200-plus-window",
                "usesUnaryThresholdTransform": uses_unary_threshold_transform,
                "usesPreMergeMultiply": uses_pre_merge_multiply,
                "usesPreMergeAdd": uses_pre_merge_add,
                "usesCurrentLevelBigDouble": uses_current_level_big_double,
                "usesLiteralBuilder": uses_literal_builder,
                "integerSeeds": list(integer_seeds),
                "rows": grouped_rows,
            }
        )

    three_hundred_family_summaries = []
    for key, grouped_rows in sorted(three_hundred_family_rows.items(), key=lambda item: item[1]):
        (
            uses_unary_threshold_transform,
            uses_pre_merge_multiply,
            uses_pre_merge_add,
            uses_current_level_big_double,
            uses_literal_builder,
            integer_seeds,
        ) = key
        three_hundred_family_summaries.append(
            {
                "thresholdWindow": "300-plus-window",
                "usesUnaryThresholdTransform": uses_unary_threshold_transform,
                "usesPreMergeMultiply": uses_pre_merge_multiply,
                "usesPreMergeAdd": uses_pre_merge_add,
                "usesCurrentLevelBigDouble": uses_current_level_big_double,
                "usesLiteralBuilder": uses_literal_builder,
                "integerSeeds": list(integer_seeds),
                "rows": grouped_rows,
            }
        )

    return {
        "hundredWindowFeeders": hundred_window_feeders,
        "twoHundredWindowFeeders": two_hundred_window_feeders,
        "hundredWindowFamilies": family_summaries,
        "twoHundredWindowFamilies": two_hundred_family_summaries,
        "threeHundredWindowFamilies": three_hundred_family_summaries,
    }


def derive_stage_window_profiles(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    grouped_rows: dict[tuple[tuple[object, ...], ...], list[int]] = defaultdict(list)
    for row_entry in rows:
        families = row_entry.get("stageDispatchCallFamilies", [])
        if not isinstance(families, list):
            continue
        signature: list[tuple[object, ...]] = []
        for family in families:
            if not isinstance(family, dict):
                continue
            threshold_window = family.get("thresholdWindow")
            if threshold_window not in {"100-plus-window", "200-plus-window", "300-plus-window"}:
                continue
            signature.append(
                (
                    str(threshold_window),
                    bool(family.get("usesUnaryThresholdTransform")),
                    bool(family.get("usesPreMergeMultiply")),
                    bool(family.get("usesPreMergeAdd")),
                    bool(family.get("usesLiteralBuilder")),
                    tuple(int(seed) for seed in family.get("integerSeeds", [])),
                )
            )
        grouped_rows[tuple(signature)].append(int(row_entry["row"]))

    profiles: list[dict[str, object]] = []
    for signature, grouped in sorted(grouped_rows.items(), key=lambda item: item[1]):
        family_entries = []
        for threshold_window, uses_unary, uses_mul, uses_add, uses_literal, integer_seeds in signature:
            family_entries.append(
                {
                    "thresholdWindow": threshold_window,
                    "usesUnaryThresholdTransform": uses_unary,
                    "usesPreMergeMultiply": uses_mul,
                    "usesPreMergeAdd": uses_add,
                    "usesLiteralBuilder": uses_literal,
                    "integerSeeds": list(integer_seeds),
                }
            )
        profiles.append(
            {
                "rows": grouped,
                "familySignature": family_entries,
            }
        )
    return profiles


def derive_stage_profile_correlations(
    stage_profiles: list[dict[str, object]],
    parameter_rows: dict[int, dict[str, object]],
) -> list[dict[str, object]]:
    correlations: list[dict[str, object]] = []
    for profile in stage_profiles:
        rows = [int(row) for row in profile.get("rows", []) if isinstance(row, int)]
        unlocks: list[int] = []
        rarities: list[str] = []
        start_costs: list[float] = []
        cost_exponents: list[float] = []
        growth_exponents: list[float] = []
        for row in rows:
            entry = parameter_rows.get(row)
            if entry is None:
                continue
            unlock = entry.get("unlockRequirementValue")
            rarity = entry.get("rarity")
            values = entry.get("strongestFieldOrderMapping", {}).get("values", {})
            if isinstance(unlock, int):
                unlocks.append(unlock)
            if isinstance(rarity, str):
                rarities.append(rarity)
            for source, target in (
                ("StartCost", start_costs),
                ("CostExponent", cost_exponents),
                ("GrowthExponent", growth_exponents),
            ):
                value = values.get(source)
                if isinstance(value, (int, float)):
                    target.append(float(value))
        correlation = {
            "rows": rows,
            "unlockRequirementRange": [min(unlocks), max(unlocks)] if unlocks else None,
            "distinctRarities": sorted(set(rarities)),
            "distinctStartCosts": sorted({round(value, 6) for value in start_costs}),
            "distinctCostExponents": sorted({round(value, 6) for value in cost_exponents}),
            "distinctGrowthExponents": sorted({round(value, 6) for value in growth_exponents}),
        }
        correlations.append(correlation)
    return correlations


def derive_transition_row_analysis(rows: list[dict[str, object]]) -> dict[str, object]:
    row_map = {int(entry["row"]): entry for entry in rows}

    def family_signature(row: int) -> list[dict[str, object]]:
        entry = row_map[row]
        signature = []
        for family in entry.get("stageDispatchCallFamilies", []):
            threshold_window = family.get("thresholdWindow")
            if threshold_window not in {"100-plus-window", "200-plus-window", "300-plus-window"}:
                continue
            signature.append(
                {
                    "thresholdWindow": threshold_window,
                    "usesUnaryThresholdTransform": bool(family.get("usesUnaryThresholdTransform")),
                    "usesPreMergeMultiply": bool(family.get("usesPreMergeMultiply")),
                    "usesPreMergeAdd": bool(family.get("usesPreMergeAdd")),
                    "usesLiteralBuilder": bool(family.get("usesLiteralBuilder")),
                    "integerSeeds": [int(seed) for seed in family.get("integerSeeds", [])],
                    "postDispatchMergeTarget": family.get("postDispatchMergeTarget"),
                }
            )
        return signature

    return {
        "transitionRows": [
            {
                "row": 18,
                "betweenRows": [17, 19],
                "neighborContrast": [
                    "Adds a second 100-plus unary feeder with integer seed 99.",
                    "Drops the sampled 200-plus unary feeder that rows 17 and 19 both preserve.",
                    "Drops get_OverLevel300Exponent from the preserved threshold stage list.",
                ],
                "familySignature": family_signature(18),
            },
            {
                "row": 24,
                "betweenRows": [23, 27],
                "neighborContrast": [
                    "Keeps the 19-23 literal-builder 100-plus additive lane.",
                    "Keeps the broader 200-plus additive-premerge lane.",
                    "Adds a 300-plus unary feeder with integer seed 49.",
                    "Adds a literal-builder 100-plus lane without a post-dispatch merge target.",
                ],
                "familySignature": family_signature(24),
            },
            {
                "row": 25,
                "betweenRows": [24, 26],
                "neighborContrast": [
                    "Keeps the literal-builder 100-plus additive lane.",
                    "Drops the broader 200-plus families entirely in the sampled window.",
                    "Adds a 300-plus unary feeder with integer seed 19.",
                    "Keeps a literal-builder 100-plus lane that rejoins through 0x24e1ab0 instead of 0x24e1cb3.",
                ],
                "familySignature": family_signature(25),
            },
            {
                "row": 26,
                "betweenRows": [25, 27],
                "neighborContrast": [
                    "Rejoins the broad 200-plus unary family with seed 180.",
                    "Keeps the literal-builder 100-plus additive lane from rows 24-25.",
                    "Keeps the literal-builder 100-plus no-post-merge lane instead of returning fully to the 27-29 profile.",
                ],
                "familySignature": family_signature(26),
            },
        ],
        "row0SpecialCase": {
            "row": 0,
            "costFieldUsage": list(row_map[0].get("costFieldUsage", [])),
            "operandFieldNames": list(row_map[0].get("operandFieldNames", [])),
            "levelGateChecks": list(row_map[0].get("levelGateChecks", [])),
            "thresholdStages": [stage.get("getterName") for stage in row_map[0].get("thresholdStages", [])],
            "familySignature": family_signature(0),
            "facts": [
                "Row 0 exposes five serialized cost fields instead of the three-field row model used by rows 1-29.",
                "Row 0 only preserves a level-100 gate in the checked native sample, not the 100/200/300 staged ladder seen on rows 1-29.",
                "Row 0 enters 0x24e368d directly in a later 100-plus window and does not preserve the same repeated stage-dispatch family used by rows 1-29.",
                "Row 0 also preserves eight bonus-per-level slots in the serialized candidate block, which matches the wider row-0 gameplay panel rather than the three-to-six slot rows in the later milestone families.",
            ],
        },
    }


def derive_threshold_stage_classes(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    grouped: dict[tuple[str, ...], list[int]] = defaultdict(list)
    for entry in rows:
        row = int(entry["row"])
        if row == 0:
            continue
        stages = tuple(
            str(stage.get("getterName"))
            for stage in entry.get("thresholdStages", [])
            if isinstance(stage, dict) and isinstance(stage.get("getterName"), str)
        )
        grouped[stages].append(row)
    classes: list[dict[str, object]] = []
    for stages, grouped_rows in sorted(grouped.items(), key=lambda item: item[1]):
        classes.append(
            {
                "getterNames": list(stages),
                "rows": grouped_rows,
            }
        )
    return classes


def derive_representative_class_analysis(
    rows: list[dict[str, object]],
    parameter_rows: dict[int, dict[str, object]],
    threshold_stage_classes: list[dict[str, object]],
) -> list[dict[str, object]]:
    row_map = {int(entry["row"]): entry for entry in rows}
    analyses: list[dict[str, object]] = []
    for cls in threshold_stage_classes:
        class_rows = [int(row) for row in cls.get("rows", []) if isinstance(row, int)]
        if not class_rows:
            continue
        representatives = [class_rows[0]]
        if len(class_rows) > 1:
            representatives.append(class_rows[-1])
        rep_entries = []
        for row in representatives:
            native = row_map[row]
            param = parameter_rows.get(row, {})
            values = param.get("strongestFieldOrderMapping", {}).get("values", {})
            rep_entries.append(
                {
                    "row": row,
                    "unlockRequirementValue": param.get("unlockRequirementValue"),
                    "rarity": param.get("rarity"),
                    "costValues": values,
                    "hundredStageStructure": native.get("hundredStageStructure"),
                    "threeHundredStageCostLane": native.get("threeHundredStageCostLane"),
                    "stageDispatchFamilies": [
                        family
                        for family in native.get("stageDispatchCallFamilies", [])
                        if isinstance(family, dict)
                        and family.get("thresholdWindow") in {"100-plus-window", "200-plus-window", "300-plus-window"}
                    ],
                }
            )
        analyses.append(
            {
                "getterNames": cls.get("getterNames", []),
                "rows": class_rows,
                "representatives": rep_entries,
            }
        )
    return analyses


def derive_normal_row_stage_recipe() -> dict[str, object]:
    return {
        "sharedScaffolding": {
            "appliesToRows": [1, 29],
            "facts": [
                "Rows 1-29 keep the same hundred-stage structure: divide-by-100 compiler lane, per-hundred BigDouble loop, and currentLevel-vs-100 remainder lane through 0x24e20d9 -> 0x24e3620 -> 0x24e1cb3.",
                "Rows 1-29 also keep the same late cost-field reopen: the sampled 300-plus lane still uses CostExponent plus GrowthExponent through the checked positive-remainder path.",
                "Rows 1-29 keep the same checked row-local stage fields in the sampled native path: StartCost, CostExponent, and GrowthExponent.",
            ],
        },
        "classRecipes": [
            {
                "getterNames": ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"],
                "rows": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21],
                "recipe": [
                    "100-plus unary feeder with seed 100",
                    "300-plus additive feeder",
                    "200-plus unary feeder with seed 180",
                    "100-plus secondary additive lane",
                    "200-plus secondary additive-premerge lane",
                ],
            },
            {
                "getterNames": ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"],
                "rows": [17, 22, 23],
                "recipe": [
                    "Same sampled stage recipe as the 100/200/300/400 class in the checked window",
                    "Current difference is preserved stage coverage: no sampled OverLevel400 getter",
                ],
            },
            {
                "getterNames": ["get_OverLevel100Exponent", "get_OverLevel200Exponent"],
                "rows": [18, 24, 27, 28, 29],
                "recipe": [
                    "Keeps the base 100-plus unary seed-100 lane",
                    "Keeps the sampled 300-plus additive feeder",
                    "Drops or substitutes the sampled 300-plus / 200-plus unary coverage depending on row band",
                    "Rows 27-29 keep the broad secondary additive-premerge lanes",
                    "Rows 18 and 24 act as transition rows with substituted unary seeds or literal side lanes",
                ],
            },
            {
                "getterNames": ["get_OverLevel100Exponent"],
                "rows": [25, 26],
                "recipe": [
                    "Keeps the base 100-plus unary seed-100 lane",
                    "Keeps the sampled 300-plus additive feeder",
                    "Adds a literal-builder 100-plus additive lane",
                    "Ends on a literal-builder 100-plus side lane that rejoins through 0x24e1ab0",
                    "Represents the shortest preserved over-level coverage class",
                ],
            },
        ],
        "currentInference": [
            "The strongest current normal-row formula model is a shared stage scaffold with class-specific stage coverage and feeder substitutions.",
            "Inside the full 100/200/300/400 class, the remaining sampled split is concentrated in the secondary 100-plus feeder: rows 1-16 use the additive-premerge variant, while rows 19-21 use the literal-builder additive variant.",
            "This is strong enough to stop treating SU1-29 as thirty unrelated formulas, but not yet strong enough to emit exact numeric costs.",
        ],
    }


def derive_canonical_symbolic_assembler() -> dict[str, object]:
    return {
        "canonicalClass": {
            "getterNames": [
                "get_OverLevel100Exponent",
                "get_OverLevel200Exponent",
                "get_OverLevel300Exponent",
                "get_OverLevel400Exponent",
            ],
            "rows": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21],
            "symbolicStages": [
                {
                    "name": "base-row-fields",
                    "inputs": ["StartCost", "CostExponent", "GrowthExponent"],
                    "notes": [
                        "The getter opens on row-local StartCost and CostExponent and later touches GrowthExponent in the same sampled body.",
                        "These inputs are stored as BreakInfinity.BigDouble pairs on the owning ShardMining row.",
                    ],
                },
                {
                    "name": "hundred-stage",
                    "inputs": ["currentLevel", "100", "StartCost", "CostExponent", "GrowthExponent"],
                    "notes": [
                        "Uses the divide-by-100 compiler lane and a per-hundred BigDouble loop.",
                        "Uses a currentLevel-vs-100 remainder lane through 0x24e20d9 -> 0x24e3620 -> 0x24e1cb3.",
                    ],
                },
                {
                    "name": "two-hundred-stage",
                    "inputs": ["currentLevel", "180", "OverLevel200Base"],
                    "notes": [
                        "Adds a unary threshold feeder with seed 180.",
                        "Keeps a later additive-premerge lane that rejoins through 0x24e1cb3.",
                    ],
                },
                {
                    "name": "three-hundred-stage",
                    "inputs": ["currentLevel", "CostExponent", "GrowthExponent", "OverLevel300Base"],
                    "notes": [
                        "Reopens CostExponent plus GrowthExponent in the positive-remainder lane.",
                        "Keeps a plain additive dispatcher feeder in the sampled 300-plus window.",
                    ],
                },
                {
                    "name": "four-hundred-stage",
                    "inputs": ["OverLevel400Base"],
                    "notes": [
                        "The full canonical class preserves get_OverLevel400Exponent after the earlier stage ladder.",
                        "The current probe verifies this stage exists in the canonical class, but does not yet prove its final numeric merge rule.",
                    ],
                },
            ],
            "subprofiles": [
                {
                    "rows": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
                    "notes": [
                        "Keeps the secondary 100-plus lane as an additive-premerge path with 0x24e1cb3 and 0x24e1ab0 already in the preceding call chain.",
                        "Keeps the secondary 200-plus additive-premerge lane after the unary seed-180 stage.",
                    ],
                },
                {
                    "rows": [19, 20, 21],
                    "notes": [
                        "Keeps the same main stage ladder as the broader canonical class.",
                        "Switches the secondary 100-plus lane to a literal-builder additive feeder through 0x24e1a07 and 0x24e1ab0 before rejoining 0x24e1cb3.",
                        "Keeps the same sampled 200-plus additive-premerge lane as the broader canonical class.",
                    ],
                },
            ],
        },
        "classDeltas": [
            {
                "getterNames": ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"],
                "delta": [
                    "Use the canonical shared scaffold.",
                    "Drop the sampled OverLevel400 stage while keeping the same earlier sampled stage shape.",
                ],
            },
            {
                "getterNames": ["get_OverLevel100Exponent", "get_OverLevel200Exponent"],
                "delta": [
                    "Use the canonical shared scaffold through the early stages.",
                    "Drop the sampled OverLevel300 and OverLevel400 getter coverage.",
                    "Allow the transition substitutions seen on rows 18 and 24 before the broad 27-29 profile rejoins the class.",
                ],
            },
            {
                "getterNames": ["get_OverLevel100Exponent"],
                "delta": [
                    "Use the canonical hundred-stage scaffold.",
                    "Drop the sampled OverLevel200, OverLevel300, and OverLevel400 getter coverage.",
                    "Keep the literal-builder 100-plus side lane that rejoins through 0x24e1ab0.",
                ],
            },
        ],
        "currentBoundary": [
            "This symbolic assembler is a stage recipe boundary for normal rows SU1-29, not yet a closed-form numeric evaluator.",
            "It is strong enough to describe which verified stages exist and what row-local or owner-side inputs they consume.",
            "It is not yet strong enough to emit exact current or next shard costs.",
        ],
    }


def derive_canonical_merge_constraints() -> dict[str, object]:
    return {
        "canonicalRows": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21],
        "sharedConstraints": [
            "The first 100-plus feeder is stable across the canonical class: unary threshold transform, seed 100, and post-dispatch merge through 0x24e1cb3.",
            "The sampled 300-plus feeder is also stable across the canonical class: plain additive feeder that rejoins through 0x24e1cb3.",
            "The first 200-plus feeder is stable across the canonical class: unary threshold transform, seed 180, and post-dispatch merge through 0x24e1cb3.",
            "The later 200-plus additive-premerge lane is stable across the canonical class.",
        ],
        "secondaryHundredPlusSplit": [
            {
                "rows": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
                "path": "additivePremerge",
                "notes": [
                    "Uses current-level BigDouble input.",
                    "Uses pre-merge multiply and pre-merge add before dispatch.",
                    "Rejoins through 0x24e1cb3.",
                ],
            },
            {
                "rows": [19, 20, 21],
                "path": "literalBuilderAdditive",
                "notes": [
                    "Uses 0x24e1a07 literal-builder plus 0x24e1ab0 additive path before dispatch.",
                    "Does not use the additive-premerge multiply on the sampled path.",
                    "Still rejoins through 0x24e1cb3.",
                ],
            },
        ],
        "currentInference": [
            "The narrowest remaining merge-rule breakpoint in the canonical class is the secondary 100-plus feeder.",
            "Everything else sampled in the canonical class is stable enough to treat as shared stage assembly.",
        ],
    }


def derive_formula_application_profiles() -> dict[str, object]:
    return {
        "rowZero": {
            "rows": [0],
            "formulaClass": "row0-special-case",
            "summary": "Row 0 stays on its own five-field shard cost lane with only a checked 100+ gate in the sampled native body.",
        },
        "normalRows": [
            {
                "rows": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
                "stageCoverage": "100/200/300/400",
                "formulaClass": "canonical-additive-premerge",
                "summary": "Uses the full canonical stage recipe with the additive-premerge secondary 100+ feeder.",
            },
            {
                "rows": [19, 20, 21],
                "stageCoverage": "100/200/300/400",
                "formulaClass": "canonical-literal-builder",
                "summary": "Uses the full canonical stage recipe but swaps the secondary 100+ feeder to the literal-builder additive path.",
            },
            {
                "rows": [17, 22, 23],
                "stageCoverage": "100/200/300",
                "formulaClass": "drop-400-stage",
                "summary": "Keeps the canonical scaffold through 300+ and drops the sampled 400+ stage coverage.",
            },
            {
                "rows": [18, 24, 27, 28, 29],
                "stageCoverage": "100/200",
                "formulaClass": "two-stage-transition-band",
                "summary": "Uses the 100/200 scaffold with transition substitutions around the 100+ and 300+ feeder families.",
            },
            {
                "rows": [25, 26],
                "stageCoverage": "100",
                "formulaClass": "hundred-stage-short-class",
                "summary": "Uses the shortest preserved normal-row class: canonical hundred-stage plus the literal-builder side lane through 0x24e1ab0.",
            },
        ],
        "currentBoundary": [
            "These profiles are strong enough to assign every shard row to a staged native recipe class.",
            "They are not yet strong enough to emit exact current-cost or next-cost numbers because the numeric merge rule inside those classes is still unresolved.",
        ],
    }


def derive_secondary_hundred_plus_merge_models() -> dict[str, object]:
    return {
        "sharedFrame": [
            "Both canonical 100-plus secondary lanes finish by feeding 0x24e3620, then post-multiply the result through 0x24e1cb3 with the preserved final stack lane.",
            "Both lanes reuse the same current-level-minus-offset seam before dispatch, but they differ in how that seam is assembled into the pre-dispatch BigDouble input.",
            "The sampled canonical split sits inside a post-200, pre-300 branch: both subprofiles load OverLevel200Base into the dispatch base lane and reuse get_OverLevel200Exponent before the final 0x24e3620 dispatch.",
            "That means the sampled split is no longer between different owner-side exponent getters. It is between different extra pre-dispatch scalar-lane builders layered on top of the same OverLevel200 base-plus-exponent stage lane.",
            "The final post-dispatch multiply lane is the already-accumulated stack result from the earlier stage chain, not a branch-specific helper return.",
        ],
        "profiles": [
            {
                "rows": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 27, 28, 29],
                "profile": "additive-premerge",
                "offsetModel": "(level - offset)",
                "symbolicApproximation": "dispatch(baseLane, add(stageLane, multiply(levelOffsetBigDouble, preservedScalarLane))) then multiply(finalStackLane, dispatchedResult)",
                "laneSources": {
                    "baseLane": "Owner-side OverLevel200Base BigDouble field loaded from ShardMining (sampled at rsp+8 before 0x24e3620 in the post-200 window).",
                    "stageLane": "Shared get_OverLevel200Exponent helper result returned into rsp+10 before 0x24e1ab0; sampled helper 0x2477d78 starts from a fixed BigDouble zero seed and may merge one float-built lane behind an MMO-side flag.",
                    "preservedScalarLane": "Literal-built BigDouble lane preserved on the stack before the multiply-side premerge.",
                    "finalStackLane": "Previously accumulated stage result preserved at rsp before the final 0x24e1cb3 merge.",
                },
                "preDispatchAssembly": [
                    "Build BigDouble(level - offset) through 0x24e1d36",
                    "Multiply that lane through 0x24e1cb3 with the preserved scalar slot",
                    "Add the preserved stage lane through 0x24e1ab0",
                    "Dispatch the assembled BigDouble through 0x24e3620",
                ],
                "sampleRows": [1, 27],
            },
            {
                "rows": [19, 20, 21],
                "profile": "literal-builder-additive",
                "offsetModel": "(level - offset) * coefficient",
                "symbolicApproximation": "dispatch(baseLane, add(stageLane, literalBigDouble((level - offset) * coefficient))) then multiply(finalStackLane, dispatchedResult)",
                "laneSources": {
                    "baseLane": "Owner-side OverLevel200Base BigDouble field loaded from ShardMining (sampled at rsp+8 before 0x24e3620 in the post-200 window).",
                    "stageLane": "Shared get_OverLevel200Exponent helper result returned into rsp+10 before 0x24e1ab0; sampled helper 0x2477d78 starts from a fixed BigDouble zero seed and may merge one float-built lane behind an MMO-side flag.",
                    "preservedScalarLane": "Coefficient-scaled scalar lane converted through 0x24e1a07 before the additive pre-dispatch merge.",
                    "finalStackLane": "Previously accumulated stage result preserved at rsp before the final 0x24e1cb3 merge.",
                },
                "preDispatchAssembly": [
                    "Convert currentLevel - offset into a scalar double lane",
                    "Apply the recovered row-window coefficient before BigDouble construction",
                    "Build that scalar result through 0x24e1a07",
                    "Add the preserved stage lane through 0x24e1ab0",
                    "Dispatch the assembled BigDouble through 0x24e3620",
                ],
                "sampleRows": [19],
            },
        ],
        "currentInference": [
            "The strongest remaining numeric split inside the canonical class is now the pre-dispatch assembly rule for the secondary 100-plus lane.",
            "Rows 1-16 and 27-29 preserve a multiplicative additive-premerge builder, while rows 19-21 preserve a scalar coefficient plus literal-builder additive path before the same OverLevel200-based dispatcher and final post-dispatch multiply lane.",
            "This is stronger than the earlier boundary because it identifies how the two canonical branches assemble their dispatcher input, not just that they call different helper families.",
            "The remaining blocker inside this split is no longer the owner-side base or exponent helper. It is the exact in-game meaning and magnitude of the profile-specific preserved scalar lane layered onto the shared OverLevel200 stage lane.",
            "The sampled stack-fed lane sources are now narrowed enough to say baseLane is OverLevel200Base, stageLane is get_OverLevel200Exponent, and finalStackLane is a carried stage result; the unresolved part is the exact in-game meaning of the literal or coefficient lane magnitudes.",
        ],
    }


def derive_pre_threshold_merge_models() -> dict[str, object]:
    return {
        "sharedNormalPath": [
            "Sampled rows 9 and 25 preserve the same owner-flag-zero pre-threshold structure before the first 0x24e3620 dispatch.",
            "That shared path opens on row-local StartCost and CostExponent, then reopens currentLevel and GrowthExponent before assembling the dispatcher input.",
            "The sampled assembly order is: multiply currentLevelBigDouble by GrowthExponent, additive-merge that into CostExponent, dispatch the merged lane through 0x24e3620 with currentLevel, then post-multiply the dispatched result by StartCost.",
            "This makes the pre-threshold lane materially tighter than before: below 100, the normal sampled rows now preserve one reusable symbolic recipe instead of only loose helper calls.",
        ],
        "normalProfile": {
            "rows": [9, 25],
            "symbolicApproximation": "multiply(StartCost, dispatch(currentLevel, add(CostExponent, multiply(currentLevelBigDouble, GrowthExponent))))",
            "laneSources": {
                "startCostLane": "Row-local StartCost BigDouble loaded first and preserved on rsp+8 before the post-dispatch multiply.",
                "costExponentLane": "Row-local CostExponent BigDouble preserved on rsp before the GrowthExponent/currentLevel merge.",
                "growthExponentLane": "Row-local GrowthExponent BigDouble reopened before the first dispatcher call.",
                "currentLevelLane": "Current milestone level converted through 0x24e1d36 both for the GrowthExponent multiply and again for the 0x24e3620 dispatch.",
            },
            "preDispatchAssembly": [
                "Convert currentLevel into BigDouble through 0x24e1d36",
                "Multiply GrowthExponent by currentLevel through 0x24e1cb3",
                "Add that lane into CostExponent through 0x24e1ab0",
                "Dispatch the merged lane through 0x24e3620 using currentLevel as the scalar input",
                "Post-multiply the dispatched result by StartCost through 0x24e1cb3",
            ],
        },
        "alternateFlaggedBranchSamples": [
            {
                "row": 9,
                "branchCondition": "ownerFlagNonZero",
                "seedBuilder": "0x24e1a07 from a sampled double-literal lane before the CostExponent and GrowthExponent multiplies",
            },
            {
                "row": 25,
                "branchCondition": "ownerFlagNonZero",
                "seedBuilder": "0x24e1d36 from sampled integer seed 4 before the CostExponent and GrowthExponent multiplies",
            },
        ],
        "currentInference": [
            "The owner-flag-zero branch is now the strongest current candidate for the general below-100 shard cost recipe on normal rows.",
            "The owner-flag-nonzero branch still exists in sampled rows 9 and 25, but its row-local seed builders diverge enough that it should stay a gated alternate branch until the repo proves when that flag is active in-game.",
            "This does not finish the exact evaluator yet, but it clears a meaningful gap: the repo now has a reusable symbolic pre-threshold recipe instead of only staged 100/200/300/400 descriptions.",
        ],
    }


def derive_over_level_getter_profile(
    instructions: list[dict[str, object]],
    getter_name: str,
    blob: bytes,
) -> dict[str, object]:
    initial_builder_target = None
    initial_integer_seed = None
    for index, entry in enumerate(instructions):
        if entry["mnemonic"] != "call":
            continue
        if entry["operand"] not in {"0x24e1d36", "0x24e1a07"}:
            continue
        initial_builder_target = str(entry["operand"])
        if entry["operand"] == "0x24e1d36":
            for lookback in range(max(0, index - 3), index):
                candidate = instructions[lookback]
                if candidate["mnemonic"] == "mov" and str(candidate["operand"]).startswith("edi, "):
                    seed_text = str(candidate["operand"]).split(", ", 1)[1]
                    initial_integer_seed = int(seed_text, 0)
                    break
        break

    return {
        "getterName": getter_name,
        "initialBuilderTarget": initial_builder_target,
        "initialIntegerSeed": initial_integer_seed,
        "usesOptionalFloatMerge": any_call_target(instructions, "0x24e1d8d") and any_jump_target(instructions, "0x24e1ab0"),
        "usesMultiplyLane": any_call_target(instructions, "0x24e1cb3"),
        "usesFollowUpLane": any_call_target(instructions, "0x24e3620"),
        "fallsIntoExtendedShardLane": getter_name == "get_OverLevel400Exponent"
        and any(entry["mnemonic"] == "cmp" and entry["operand"] == "eax, 0xa" for entry in instructions),
        "literalLoads": extract_rip_literal_loads(instructions, blob),
    }


def derive_decimal_power_bridge(plt_symbol_map: dict[str, str]) -> dict[str, object]:
    return {
        "bigDoubleLog10Target": "0x24e30e4",
        "scaledPowerBuilderTarget": "0x24e38f9",
        "scalarToBigDoubleTarget": "0x24e349c",
        "powWrapperTarget": "0x393474a",
        "powWrapperEntryTarget": "0x1b2ea12",
        "mathImports": {
            "modfStubTarget": "0x4437dd0",
            "modfImportName": plt_symbol_map.get("0x4437dd0"),
            "fmodStubTarget": "0x4437e30",
            "fmodImportName": plt_symbol_map.get("0x4437e30"),
            "log10StubTarget": "0x4437e50",
            "log10ImportName": plt_symbol_map.get("0x4437e50"),
            "powStubTarget": "0x44385d0",
            "powImportName": plt_symbol_map.get("0x44385d0"),
        },
        "facts": [
            "0x24e30e4 is the checked BigDouble-to-scalar log10 bridge: it takes the absolute mantissa lane, calls imported log10, then adds the paired integer exponent lane.",
            "0x393474a is no longer just a pow-like candidate: it jumps into 0x1b2ea12, which preserves NaN and sign edge handling, uses imported modf to validate whole-exponent cases, and falls back to imported pow for the generic scalar power path.",
            "0x24e349c preserves the inverse bridge from scalar back to a normalized BigDouble pair: it uses imported fmod on the scalar lane against the checked tolerance shell, then routes through the pow-wrapper and 0x24e0746 to rebuild the BigDouble result.",
            "0x24e38f9 now preserves the strongest current closed-form helper read in the shard chain: it treats its inputs as a decimal scientific BigDouble lane (mantissa plus integer exponent) raised to a scalar power, splitting integer-exponent times scalar into integral and fractional parts, adding log10(mantissa) times the scalar power, then rebuilding the mantissa through the pow-wrapper before normalizing with 0x24e0746.",
        ],
    }


def derive_stage_assembly_boundary() -> dict[str, object]:
    return {
        "stageDispatcherEntryTarget": "0x24e3620",
        "stageDispatcherBodyTarget": "0x24e368d",
        "scalarCompareTarget": "0x24e2d86",
        "specialCaseGateTarget": "0x24e387a",
        "scalarToBigDoubleTarget": "0x24e349c",
        "decimalPowerBuilderTarget": "0x24e38f9",
        "facts": [
            "0x24e3620 is the checked BigDouble-to-scalar stage bridge: it converts the incoming BigDouble lane through 0x24e0cda, then tail-jumps into the stage dispatcher at 0x24e368d with the original scalar lane plus the converted exponent-side scalar lane.",
            "0x24e368d is the checked stage-assembly dispatcher for the scalar remainder family. It first records whether the converted exponent-side scalar is already aligned to the tiny fmod tolerance shell through 0x24e3597, then runs a scalar compare through 0x24e2d86 before choosing its output lane.",
            "When the scalar compare passes and the converted exponent-side scalar does not trip that tiny-tolerance alignment check, 0x24e368d returns a cached BigDouble pair from the owner-side object slot at +0x40/+0x48 off the dispatcher metadata object rather than rebuilding the result through the decimal power builder.",
            "Otherwise 0x24e368d falls into two active reconstruction lanes: it can route through 0x24e349c to rebuild directly from the converted exponent-side scalar, or through 0x24e38f9 to rebuild from the original scalar lane plus the converted exponent-side scalar via the decimal power path.",
            "0x24e387a is the checked special-case gate between those two reconstruction lanes. It only opens its positive path when the dispatcher row-selector argument equals 1, which makes it a narrow special-case lane rather than the general shard cost builder.",
            "That means the remaining shard-formula uncertainty is stage composition inside get_SU*Cost: the repo now has the helper identity and the dispatcher shape, but not yet the full symbolic rule for when each verified stage lane is selected across the 100/200/300/400 cost bands."
        ],
    }


def derive_dispatcher_compare_model() -> dict[str, object]:
    return {
        "compareTarget": "0x24e2d86",
        "arguments": {
            "firstScalarMantissaLane": "Original scalar dispatcher input from xmm0.",
            "firstScalarExponentLane": "Dispatcher selector or exponent-half integer carried in rdi.",
            "secondScalarMantissaLane": "Converted BigDouble mantissa-style scalar from xmm1 after 0x24e0cda.",
            "secondScalarExponentLane": "Converted BigDouble exponent-half integer carried in rsi.",
        },
        "facts": [
            "0x24e2d86 rejects non-finite scalar lanes first through 0x24e08e3 before doing any ordering work.",
            "It then handles near-zero mantissas through 0x24e06df before falling back to sign and exponent ordering.",
            "When both mantissas are non-zero and the exponent halves match, it compares the mantissas directly and returns true only when the converted BigDouble lane is greater than the original scalar lane.",
            "When signs differ, it returns true exactly when the converted BigDouble lane is positive and the original scalar lane is non-positive.",
            "When signs match and exponent halves differ, it uses exponent ordering instead of mantissa ordering, with the sign-aware inequality flipped for negative lanes.",
        ],
        "currentInference": [
            "The strongest current read is that 0x24e2d86 is a signed BigDouble-style greater-than comparator between the converted exponent-side lane and the original dispatcher scalar lane.",
            "That means the cached constant fast path is no longer gated by an opaque boolean helper: it wins only when the converted BigDouble lane dominates the original scalar lane and the tiny-tolerance alignment check does not fire.",
        ],
    }


def derive_dispatcher_alignment_model() -> dict[str, object]:
    return {
        "alignmentCheckTarget": "0x24e3597",
        "nearZeroPredicateTarget": "0x24e06df",
        "fractionImportTarget": "0x4437e30",
        "toleranceLiteral": 5.238690707360522e-11,
        "facts": [
            "0x24e3597 applies the imported fractional helper at 0x4437e30 against the converted exponent-side scalar and the tiny 5.238690707360522e-11 tolerance literal.",
            "It then feeds the absolute remainder through 0x24e06df, so the return value is a tiny-alignment predicate rather than a general integer test.",
            "Inside 0x24e368d, that predicate only blocks the cached-lane fast path; it does not directly choose between 0x24e349c and 0x24e38f9.",
        ],
        "currentInference": [
            "The repo should stop describing 0x24e3597 as a vague near-integer check. The sampled body shows a tiny fmod-style alignment gate on the converted exponent-side scalar.",
            "That aligns with the dispatcher layout: cached constants are reused only when the converted lane wins the compare and is not already aligned to the tiny tolerance shell.",
        ],
    }


def derive_dispatcher_selection_model() -> dict[str, object]:
    return {
        "facts": [
            "Inside 0x24e368d, the cached constant lane wins only when 0x24e2d86 says the converted BigDouble lane is greater than the original scalar lane and the converted exponent-side scalar does not trip the tiny-alignment check in 0x24e3597.",
            "If that cached lane does not win, 0x24e387a only opens the scalar-to-BigDouble fallback when the dispatcher selector register equals 1.",
            "Otherwise the dispatcher falls through to 0x24e38f9, the decimal power-builder lane.",
        ],
        "sampledNormalRows": [
            {
                "rows": [1, 9, 27, 29],
                "selectorLaneSource": "Sampled pre-dispatch rdi lane comes from the CostExponent exponent-half slot preserved in the row-local BigDouble pair.",
                "sampledSelectorValues": [0],
                "inference": "The 0x24e387a special-case gate does not naturally open on these sampled normal-row calls, so the non-cached path falls through to 0x24e38f9.",
            },
            {
                "rows": [25],
                "selectorLaneSource": "Sampled pre-dispatch rdi lane comes from the CostExponent exponent-half slot preserved in the row-local BigDouble pair.",
                "sampledSelectorValues": [4],
                "inference": "This sampled short-class row also misses the selector==1 special-case gate, which again makes 0x24e38f9 the stronger non-cached candidate than 0x24e349c.",
            },
        ],
        "currentInference": [
            "The scalar-to-BigDouble fallback 0x24e349c is now a narrow special-case reconstruction lane rather than the default normal-row rebuild path.",
            "For the sampled normal rows, the strongest current dispatcher read is: cached owner-side constant lane when the converted lane dominates and does not trip the tiny-alignment gate, otherwise decimal power-builder 0x24e38f9.",
            "This materially narrows the remaining formula gap because the normal-row evaluator no longer needs to treat 0x24e349c and 0x24e38f9 as equally likely on the sampled main paths.",
        ],
    }


def derive_over_level_seed_models() -> dict[str, object]:
    return {
        "sampledGetters": [
            {
                "getterName": "get_OverLevel100Exponent",
                "baseSeedModel": "integerBigDouble",
                "baseSeed": 2,
                "optionalMmoMergeModel": "floatBigDouble additive merge behind MMO flag",
                "optionalMmoMergeFloatValue": 1.264570970563716e-39,
            },
            {
                "getterName": "get_OverLevel200Exponent",
                "baseSeedModel": "doubleLiteralBigDouble",
                "baseSeed": 0.0,
                "optionalMmoMergeModel": "floatBigDouble additive merge behind MMO flag",
                "optionalMmoMergeFloatValue": 6.345649113524877e-36,
            },
            {
                "getterName": "get_OverLevel300Exponent",
                "baseSeedModel": "doubleLiteralBigDouble",
                "baseSeed": 0.0,
                "optionalMmoMergeModel": "floatBigDouble additive merge behind MMO flag",
                "optionalMmoMergeFloatValue": 6.345649113524877e-36,
            },
            {
                "getterName": "get_OverLevel400Exponent",
                "baseSeedModel": "doubleLiteralBigDouble",
                "baseSeed": 0.007812501846152979,
                "optionalMmoMergeModel": "floatBigDouble additive merge behind MMO flag before the wider SU0-driven lane",
                "optionalMmoMergeFloatValue": 6.345649113524877e-36,
            },
        ],
        "currentInference": [
            "The sampled 100/200/300 over-level exponent getters are now narrowed to literal-seeded BigDouble builders, not direct payload-field readers.",
            "That makes these getters usable as stage-builder seed models even though the exact MMO-side float merge magnitude is still unresolved.",
            "The strongest current read is: 100 starts from integer seed 2, while 200 and 300 start from zero BigDouble shells before the same gated float merge path.",
            "The sampled MMO-side float merges are now preserved directly: 100 carries a tiny 1.264570970563716e-39 lane, 200 and 300 share 6.345649113524877e-36, and 400 starts from 0.007812501846152979 before the same tiny merge family.",
        ],
    }


def main() -> None:
    method_probe = load_method_probe()
    over_level_getter_map = build_over_level_getter_map(method_probe)
    field_offset_map = load_field_offset_map()
    parameter_rows = load_parameter_probe_rows()
    plt_symbol_map = load_plt_symbol_map()
    blob = LIBIL2CPP_PATH.read_bytes()
    getters = method_probe["costGetterFamily"]["rows"]

    rows = []
    clusters: dict[tuple[str, ...], list[int]] = defaultdict(list)
    over_level_profiles = []

    for helper in method_probe.get("helperMethods", []):
        name = helper.get("name")
        start = helper.get("rva")
        size = helper.get("estimatedTrackedBodySize")
        if not isinstance(name, str) or not name.startswith("get_OverLevel"):
            continue
        if not isinstance(start, int) or not isinstance(size, int):
            continue
        scan_size = max(size, 1400) if name == "get_OverLevel400Exponent" else size
        code = blob[start : start + scan_size]
        instructions = collect_instructions(code[:scan_size], start)
        over_level_profiles.append(
            derive_over_level_getter_profile(
                instructions,
                name,
                blob,
            )
        )

    for getter in getters:
        row = int(getter["row"])
        start = int(getter["rva"])
        size = int(getter["estimatedTrackedBodySize"])
        code = blob[start : start + size]
        field_reads = collect_field_reads(code[:224], start)
        extended_field_reads = collect_field_reads(code[: min(size, 1200)], start)
        named_field_reads, operand_fields = attach_field_names(field_reads, field_offset_map)
        named_extended_field_reads, _ = attach_field_names(extended_field_reads, field_offset_map)
        cost_field_usage = derive_cost_field_usage(named_extended_field_reads, row)
        early_calls = collect_early_calls(code, start)
        full_calls = collect_early_calls(code, start, limit=96)
        full_instructions = collect_instructions(code[: min(size, 2400)], start)
        early_targets = tuple(call["target"] for call in early_calls)
        clusters[early_targets].append(row)
        threshold_stages = derive_threshold_stages([call["target"] for call in full_calls], over_level_getter_map)
        level_gate_checks = derive_level_gate_checks(code[: min(size, 2200)], start)
        hundred_stage_structure = derive_hundred_stage_structure(full_instructions, named_extended_field_reads, row, blob)
        three_hundred_stage_cost_lane = derive_three_hundred_stage_cost_lane(full_instructions, named_extended_field_reads, row)
        stage_dispatch_call_families = derive_stage_dispatch_call_families(full_instructions)
        rows.append(
            {
                "row": row,
                "name": getter["name"],
                "rva": start,
                "estimatedTrackedBodySize": size,
                "entryBytesHex": getter["entryBytesHex"],
                "earlyFieldReads": named_field_reads,
                "costFieldUsage": cost_field_usage,
                "operandPairStartsHex": derive_operand_pair_starts(named_field_reads),
                "operandFieldNames": operand_fields,
                "earlyCallTargets": [call["target"] for call in early_calls],
                "levelGateChecks": level_gate_checks,
                "thresholdStages": threshold_stages,
                "hundredStageStructure": hundred_stage_structure,
                "threeHundredStageCostLane": three_hundred_stage_cost_lane,
                "stageDispatchCallFamilies": stage_dispatch_call_families,
            }
        )

    cluster_entries = []
    for targets, grouped_rows in sorted(clusters.items(), key=lambda item: (-len(item[1]), item[1])):
        cluster_entries.append(
            {
                "rowCount": len(grouped_rows),
                "rows": grouped_rows,
                "earlyCallTargets": list(targets),
            }
        )

    row1 = next(entry for entry in rows if entry["row"] == 1)
    row19 = next(entry for entry in rows if entry["row"] == 19)
    row27 = next(entry for entry in rows if entry["row"] == 27)
    row0 = next(entry for entry in rows if entry["row"] == 0)
    row_instruction_map = {entry["row"]: collect_instructions(blob[entry["rva"] : entry["rva"] + entry["estimatedTrackedBodySize"]], entry["rva"]) for entry in rows if int(entry["row"]) >= 1}
    sampled_offset_feeders = [
        {
            "row": 1,
            "thresholdWindow": "100-plus-window",
            **derive_sampled_offset_feeder(row_instruction_map[1], blob, 38256043),
        },
        {
            "row": 19,
            "thresholdWindow": "100-plus-window",
            **derive_sampled_offset_feeder(row_instruction_map[19], blob, 38314290),
        },
        {
            "row": 27,
            "thresholdWindow": "100-plus-window",
            **derive_sampled_offset_feeder(row_instruction_map[27], blob, 38337459),
        },
    ]
    window_offset_families = derive_window_offset_families(rows, row_instruction_map, blob)
    stage_window_profiles = derive_stage_window_profiles(rows)
    stage_profile_correlations = derive_stage_profile_correlations(stage_window_profiles, parameter_rows)
    transition_row_analysis = derive_transition_row_analysis(rows)
    threshold_stage_classes = derive_threshold_stage_classes(rows)
    representative_class_analysis = derive_representative_class_analysis(rows, parameter_rows, threshold_stage_classes)
    normal_row_stage_recipe = derive_normal_row_stage_recipe()
    canonical_symbolic_assembler = derive_canonical_symbolic_assembler()
    canonical_merge_constraints = derive_canonical_merge_constraints()
    formula_application_profiles = derive_formula_application_profiles()
    pre_threshold_merge_models = derive_pre_threshold_merge_models()
    secondary_hundred_plus_merge_models = derive_secondary_hundred_plus_merge_models()
    dispatcher_selection_model = derive_dispatcher_selection_model()
    dispatcher_compare_model = derive_dispatcher_compare_model()
    dispatcher_alignment_model = derive_dispatcher_alignment_model()
    over_level_seed_models = derive_over_level_seed_models()

    result = {
        "dataset": "shard-cost-native-probe.v1",
        "generatedAt": str(date.today()),
        "source": {
            "methodProbe": "data/shard-cost-method-probe.v1.json",
            "uabeaProbeReport": "data/uabea-probe-report.json",
            "libIl2cpp": "workbench/apk/base/libil2cpp.so",
            "vendorManual": ".vendor_manual",
        },
        "rows": rows,
        "earlyCallClusters": cluster_entries,
        "helperTargetSummaries": [
            {"target": target, "summary": summary}
            for target, summary in HELPER_TARGET_SUMMARIES.items()
        ],
        "genericBigDoubleHelpers": {
            "storedCostFieldsUseBigDoubleSlots": True,
            "rowCostFieldSlotSizeBytes": 16,
            "multiplyHelperTarget": "0x24e1b33",
            "addHelperTarget": "0x24e176a",
            "doubleToBigDoubleTarget": "0x24e05a0",
            "normalizePairTarget": "0x24e0746",
            "toDoubleTarget": "0x24e0cda",
            "nearZeroPredicateTarget": "0x24e06df",
            "infinityPredicateTarget": "0x24e09f8",
            "integerToleranceCheckTarget": "0x24e3597",
            "fractionSplitTarget": "0x393469a",
            "facts": [
                "Rows 1-29 preserve three checked 16-byte BigDouble cost slots per row, and row 0 preserves five checked 16-byte BigDouble cost slots.",
                "0x24e1b33 is a direct BigDouble multiply helper: it multiplies mantissas, adds paired exponents, then normalizes through 0x24e0746.",
                "0x24e176a is a direct BigDouble add or merge helper with zero, infinity, and exponent-gap fast paths.",
                "0x24e05a0 and 0x24e0746 are the checked constructor or normalization lane for rebuilding BigDouble pairs from scalar intermediates.",
                "0x24e0cda is the checked BigDouble-to-double conversion lane with decimal-exponent clamps around the standard double range.",
                "0x24e3620 converts one BigDouble input back to a plain double before dispatching into the remaining scalar remainder subfamily."
            ],
        },
        "scalarRemainderSubfamily": {
            "entryTarget": "0x24e3620",
            "followUpDispatcherTarget": "0x24e368d",
            "scalarCompareTarget": "0x24e2d86",
            "integerToleranceCheckTarget": "0x24e3597",
            "integralPartHelperTarget": "0x393469a",
            "scalarToBigDoubleTarget": "0x24e349c",
            "scaledPowerBuilderTarget": "0x24e38f9",
            "unresolvedTransformTarget": "0x393474a",
            "resolvedTransformKind": "powWrapper",
            "facts": [
                "0x393469a wraps modf through 0x1b2ea0c and returns the integral part through the output pointer slot rather than the fractional return value.",
                "0x24e349c preserves a checked scalar-to-BigDouble lane: near-integer inputs fast-path into a normalized integer-power shell, while non-integer inputs fall back through fmod plus the pow-wrapper before rebuilding a BigDouble through 0x24e0746.",
                "0x24e38f9 starts by multiplying an integer lane by the incoming scalar lane, then checks whether that product is already close enough to an integer to fast-path directly into 0x24e0746.",
                "When that product is not already near an integer, 0x24e38f9 splits it into integral and fractional lanes, calls imported log10 on the base scalar, adds the resulting log10-derived term back into the fractional lane, and then rebuilds a BreakInfinity.BigDouble pair through the pow-wrapper plus 0x24e0746.",
                "0x393474a now resolves from a pow-like candidate to the checked internal pow-wrapper lane inside the shard remainder family: it jumps into 0x1b2ea12, which uses modf for whole-exponent edge handling and imported pow for the generic scalar power fallback.",
                "That makes 0x24e38f9 the strongest current segmented power-builder lane rather than a plain additive adjustment, and it moves the remaining shard-formula uncertainty up to stage assembly inside get_SU*Cost rather than helper identity."
            ],
        },
        "decimalPowerBridge": derive_decimal_power_bridge(plt_symbol_map),
        "stageAssemblyBoundary": derive_stage_assembly_boundary(),
        "sampledOffsetFeeders": sampled_offset_feeders,
        "windowOffsetFamilies": window_offset_families,
        "stageWindowProfiles": stage_window_profiles,
        "stageProfileCorrelations": stage_profile_correlations,
        "transitionRowAnalysis": transition_row_analysis,
        "thresholdStageClasses": threshold_stage_classes,
        "representativeClassAnalysis": representative_class_analysis,
        "normalRowStageRecipe": normal_row_stage_recipe,
        "canonicalSymbolicAssembler": canonical_symbolic_assembler,
        "canonicalMergeConstraints": canonical_merge_constraints,
        "formulaApplicationProfiles": formula_application_profiles,
        "preThresholdMergeModels": pre_threshold_merge_models,
        "secondaryHundredPlusMergeModels": secondary_hundred_plus_merge_models,
        "dispatcherCompareModel": dispatcher_compare_model,
        "dispatcherAlignmentModel": dispatcher_alignment_model,
        "dispatcherSelectionModel": dispatcher_selection_model,
        "overLevelSeedModels": over_level_seed_models,
        "powerHelperFamily": {
            "shardPathEntryTarget": "0x24e20d9",
            "shardPathChain": [
                "0x24e20d9",
                "0x24e1a2b",
                "0x24e1452",
                "0x24e0faa",
                "0x24e1ab0",
            ],
            "nearbySiblingChain": [
                "0x24e21dc",
                "0x24e1bba",
                "0x24e1c3f",
                "0x24e1cb3",
            ],
            "helperFacts": [
                "0x24e0faa flips the sign bit on the incoming double lane before returning the paired BigDouble integer component unchanged.",
                "0x24e1c3f divides the tiny 5.238690707360522e-11 literal by the incoming double lane and negates the paired integer exponent before returning.",
                "0x24e0cda converts a BigDouble pair into a double with clamped edge handling around exponent bands before later rounding or normalization.",
                "0x39345ca behaves like a sign classifier that returns negative, zero, or positive lane state from a double input."
            ]
        },
        "overLevelGetterProfiles": over_level_profiles,
        "findings": [
            "Each get_SU*Cost getter reads row-local ShardMining cost operands directly from the owning object before entering the repeated BigDouble helper call chain.",
            "Those row-local shard cost operands are stored as checked 16-byte BreakInfinity.BigDouble slots, not as plain scalar doubles: rows 1-29 preserve StartCost, CostExponent, and GrowthExponent BigDouble pairs, while row 0 preserves five BigDouble cost slots.",
            "Rows 1-12 share one dominant early call-target pattern, while rows 13-16 and 18-29 mostly share a shifted late-row pattern where the second early call target changes from 0x24e1a07 to 0x24e1d36.",
            "Row 17 is a native call-pattern outlier between the mid and late bands, and row 0 is a much larger special-case getter with a distinct operand shell.",
            "Rows 1, 19, and 27 each begin by loading two BigDouble-like operand pairs from row-local offsets that line up with the recovered serialized cost-field shells, which is the strongest current bridge between native getter code and scene payload values.",
            "The upgraded typed field map now resolves those operand-pair starts to named ShardMining cost fields: rows 1-29 open on StartCost and CostExponent, while row 0 also surfaces GrowthExponent in the early getter path.",
            "Extending the getter read window shows rows 1-29 also touch GrowthExponent later in the native body, so the current verified runtime input set for those rows is StartCost plus CostExponent plus GrowthExponent.",
            "The row-local integer lane is still live inside the getter body: current milestone level values are repeatedly converted through 0x24e1d36 before entering the staged helper chain, so the unresolved integer path remains a real candidate for final cost magnitude behavior.",
            "Rows 1-29 now preserve an explicit staged over-level sequence: the getter bodies call get_OverLevel100Exponent, get_OverLevel200Exponent, get_OverLevel300Exponent, and get_OverLevel400Exponent in ascending threshold order.",
            "Rows 1-29 also preserve explicit current-level compare gates inside get_SU*Cost itself: the native bodies branch on level 100, 200, and 300 in the checked sample, with larger rows continuing into the 400 lane deeper in the body.",
            "Inside the 100+ branch, rows 1, 19, and 27 all preserve the compiler-style divide-by-100 integer lane, a repeated multiply-style BigDouble loop, and a second currentLevel-vs-100 remainder lane that routes through 0x24e20d9, 0x24e3620, and 0x24e1cb3 before rejoining the main result.",
            "Inside the 300+ branch, rows 1, 19, and 27 re-open the row-local cost operand shell in the CostExponent and GrowthExponent neighborhood rather than only reusing the earlier StartCost lane, which makes the late-stage cost path look like a stacked segmented construction.",
            "The sampled over-level getters are now split more cleanly: get_OverLevel100Exponent, get_OverLevel200Exponent, and get_OverLevel300Exponent build their exponent lanes from fixed literal or integer seeds plus the MMO-side optional float merge, while sampled get_OverLevel400Exponent diverges into a wider SU0 field-driven lane.",
            "The generic helper family is now much tighter in BigDouble terms: 0x24e1b33 is a direct multiply helper, 0x24e176a is a direct additive merge helper, 0x24e05a0 and 0x24e0746 rebuild normalized BigDouble pairs, and 0x24e0cda converts BigDouble pairs back into scalar doubles.",
            "The merge and multiply helpers also preserve nearby checked normalization literals around 0.0078125, which suggests the BigDouble helper family is normalizing significand-style lanes while assembling shard costs.",
            "The shard path now preserves a checked unary helper chain for the 100+ remainder lane: 0x24e20d9 enters 0x24e1a2b, which routes through 0x24e1452 then 0x24e0faa before rejoining 0x24e1ab0.",
            "A nearby sibling helper lane also exists beside the shard path: it routes through 0x24e1bba then 0x24e1c3f before rejoining 0x24e1cb3, but the current shard getter sample calls 0x24e20d9 directly rather than proving runtime branch selection between both paths.",
            "The helper-family neighborhood now also shows that 0x24e3620 converts a BigDouble pair into a double before dispatching into the remaining scalar remainder subfamily, while 0x39345ca behaves like a sign classifier, which narrows the remaining blocker to scalar transform semantics rather than generic BigDouble plumbing.",
            "Inside that scalar remainder subfamily, 0x393469a now resolves to a modf wrapper that returns the integral lane, 0x24e349c now preserves a checked scalar-to-BigDouble fallback, and 0x24e38f9 now preserves a checked decimal power-builder: it multiplies an integer exponent lane by the stage scalar, fast-paths near-integer cases, otherwise splits integral and fractional lanes, adds a log10-derived mantissa term, and rebuilds a BigDouble through the pow-wrapper plus 0x24e0746.",
            "0x393474a is no longer just a pow-like candidate in the shard probe; it is the checked internal pow-wrapper lane that uses modf for whole-exponent handling and falls back to imported pow for the generic scalar power case.",
            "That makes the strongest current formula read a segmented decimal power-builder: stored BigDouble cost fields feed the staged 100/200/300/400 bands, while the remaining uncertainty is in how get_SU*Cost stacks those verified helper lanes across stage boundaries, not in the identity of the final scalar power transform itself.",
            "0x24e30e4 now gives the repo a checked BigDouble-to-log10 bridge, which means the probe has both sides of the decimal conversion pair used by the shard cost helper family.",
            "The remaining formula gap is now narrowed to a checked stage dispatcher: 0x24e3620 and 0x24e368d choose between a cached constant lane, the scalar-to-BigDouble fallback, and the decimal power-builder after the helper math has already been resolved.",
            "0x24e2d86 is now typed as a signed BigDouble-style greater-than comparator between the converted exponent-side lane and the original scalar dispatcher lane, which removes one of the last opaque boolean gates from the cached-lane rule.",
            "0x24e3597 is now typed more honestly too: it is a tiny fmod-style alignment gate on the converted exponent-side scalar, not a generic near-integer test.",
            "Sample rows 1, 19, and 27 all now preserve repeated dispatcher call families inside get_SU*Cost itself: an opening pre-threshold additive feeder, a first 100-plus unary threshold feeder through 0x24e20d9 with an explicit 100 seed, a later 200-plus unary threshold feeder with an explicit 180 seed, and later additive-premerge feeders that still route through the same dispatcher before rejoining the main multiply lane.",
            "The sampled 300-plus window also preserves a plain additive dispatcher feeder before the later 100-plus and 200-plus additive-premerge feeders reopen the stacked stage lane.",
            "Row 19 also preserves one extra literal-seeded dispatcher feeder inside a 100-plus window that is not present in the same sampled window for rows 1 and 27, which makes it the strongest current sampled outlier inside the otherwise shared dispatcher pattern.",
            "Sampled late-window feeder parameters are now preserved directly from the binary: row 1 carries a `(level - 70)` additive-premerge lane with coefficient `9.765628774403013e-05`, row 19 carries a 100-plus scalar outlier lane `(level - 70) * -0.00011718430323526263` before additive merge, and row 27 carries a `(level - 82)` additive-premerge lane with coefficient `8192.001984596252`.",
            "The 100-plus feeder extraction now also clusters sampled rows into reusable late-window families: rows 1-18 keep a non-literal additive-premerge family with offset 70, rows 19-23 switch to a literal-builder additive family with offset 70, rows 24-26 keep that literal-builder family but shift the offset to 67, and rows 27-29 return to a non-literal additive-premerge family with offset 82.",
            "The later stage windows now also preserve reusable row-family maps instead of only isolated samples: the 200-plus window collapses into a broad unary threshold family with integer seed 180 plus a broad additive-premerge family, while the 300-plus window stays on one shared additive family with only rows 24 and 25 adding unary outlier feeders.",
            "Across the 100-plus, 200-plus, and 300-plus windows together, the sampled rows now collapse into a small cross-window profile map: a broad shared profile on rows 1-17 plus 27-29, a 19-23 literal-builder profile, a row-18 transition profile, and a tight 24-26 transition band with extra late-window outliers.",
            "Those cross-window profiles do not collapse cleanly onto one rarity band or one simple serialized cost-constant rule: the broad shared profile spans mixed rarities and cost constants, row 19-23 forms a contiguous unlock band with a distinct 100-plus literal-builder lane, and rows 27-29 return to the broad shared profile despite very different late-row cost constants.",
            "The transition rows now preserve concrete neighbor contrasts instead of only profile labels: row 18 inserts a second 100-plus unary feeder and drops the sampled 200-plus unary lane, while rows 24-26 preserve literal-builder 100-plus side lanes and row-specific 300-plus unary outliers before row 27 returns to the broad shared profile.",
            "Row 0 is no longer just a weaker version of the later rows in the probe. Its checked native path is a separate special case: five serialized cost fields, only a level-100 gate in the sampled native body, direct 0x24e368d entry in a late 100-plus window, and eight preserved bonus slots in the serialized candidate block.",
            "The normal SU1-29 rows now also split cleanly by preserved over-level getter coverage: rows 1-16 and 19-21 keep 100/200/300/400, rows 17/22/23 keep 100/200/300, rows 18/24/27-29 keep 100/200, and rows 25-26 keep only 100. That is the strongest current structural explanation for the transition-row family switches.",
            "Representative rows from each normal-row coverage class preserve the same hundred-stage and three-hundred-stage scaffolding even when the serialized cost constants change sharply, which makes the stage-coverage class a stronger formula boundary than the raw row constants alone.",
            "The strongest current normal-row recipe is now a shared stage scaffold with class-specific stage coverage and feeder substitutions, rather than thirty unrelated shard formulas.",
            "That recipe is now preserved as one canonical symbolic stage assembler for the 100/200/300/400 class, with the shorter classes expressed as stage-coverage deltas rather than fresh formulas.",
            "The sampled owner-flag-zero pre-threshold lane is now also preserved as a reusable symbolic recipe on rows 9 and 25: StartCost post-multiplies the result of dispatch(currentLevel, CostExponent + currentLevel * GrowthExponent).",
            "That pre-threshold recipe is the strongest current below-100 model for normal rows, while the owner-flag-nonzero branch remains a gated alternate path with row-specific seed builders.",
            "The stage dispatcher is now narrower on sampled normal rows: the 0x24e349c scalar fallback is a selector==1 special-case lane, while sampled normal-row selector lanes preserve CostExponent exponent halves 0 or 4, which makes 0x24e38f9 the stronger non-cached rebuild path.",
            "The cached-lane condition is also tighter now: it is gated by a signed BigDouble-style dominance compare plus a tiny alignment check on the converted exponent-side scalar, not just an opaque helper pass.",
            "The sampled 100/200/300 over-level exponent getters are now narrowed to literal-seeded BigDouble builders: 100 starts from integer seed 2, while 200 and 300 start from zero BigDouble shells before the shared MMO-side optional float merge.",
            "The canonical class itself now also preserves one stable internal split: rows 1-16 versus rows 19-21 differ in the secondary 100-plus feeder while keeping the same main stage ladder.",
            "That makes the secondary 100-plus feeder the narrowest remaining merge breakpoint inside the canonical class; the sampled 300-plus feeder and both sampled 200-plus feeders are otherwise stable across that class.",
            "The repo now also preserves direct formula-application profiles for all shard rows: row 0 is a separate special case, while rows 1-29 now resolve to one of five staged normal-row profile classes.",
            "The canonical split is now preserved as two explicit pre-dispatch merge models: an additive-premerge builder on rows 1-16 and 27-29, versus a coefficient-scaled literal-builder additive path on rows 19-21.",
            "The constructor lanes are also typed: 0x24e1a07 builds a BigDouble from a double literal, 0x24e1d36 converts an integer into a BigDouble shell, and 0x24e1d8d does the same for float inputs.",
            "The typed metadata still preserves OverLevel100Base, OverLevel200Base, OverLevel300Base, and OverLevel400Base field names on ShardMining, but the sampled 100/200/300 getter bodies do not directly read those payload fields in the current native trace.",
            "That means exact serialized OverLevel*Base payload values remain unresolved and should not yet be treated as proven active runtime inputs for the sampled normal-row cost path.",
            "For rows 1-29 the getter entry path currently surfaces two early operand-pair starts, while row 0 surfaces three, which further supports row 0 as a separate native cost lane.",
            "This still does not prove the final mathematical cost equation, but it narrows the exact remaining blocker: how the scalar remainder subfamily under 0x24e3620 combines level-derived scalar pieces with the stored BigDouble cost fields across the 100/200/300/400 stage bands.",
        ],
        "currentBoundary": [
            "Treat the get_SU*Cost native getter family as verified code that reads row-local ShardMining operands before entering a shared BigDouble helper chain.",
            "Treat the row-local StartCost, CostExponent, and GrowthExponent fields as checked serialized BreakInfinity.BigDouble pairs, not as plain scalar doubles.",
            "Treat the early call-target clusters as real native cost lanes or branch families, not as final names for the called helpers.",
            "Treat the recovered operand offsets as the strongest current bridge between native getter code and serialized shard cost fields.",
            "Treat the repeated integer-to-BigDouble conversions as part of the live cost assembly path until the repo proves they are only temporary loop counters.",
            "Treat the explicit level 100, 200, and 300 compare gates as verified native stage branches inside get_SU*Cost, not just as inferred UI thresholds.",
            "Treat the verified divide-by-100 loop and currentLevel-vs-100 remainder lane as staged runtime structure, not yet as a closed-form formula.",
            "Treat 0x24e20d9 as the shard-path unary transform entry, and treat the reciprocal lane as a nearby sibling helper until the repo proves a runtime branch relationship between them.",
            "Treat the generic BigDouble helper family as mostly typed now; the remaining unknown is stage assembly inside get_SU*Cost after the decimal power helpers, not whether shard costs use BigDouble inputs.",
            "Treat 0x24e30e4 as the checked BigDouble-to-log10 bridge, 0x24e349c as the scalar-to-BigDouble fallback lane, 0x24e38f9 as the segmented decimal power-builder, and 0x393474a as the internal pow-wrapper lane that falls back to imported pow.",
            "Treat 0x24e3620 and 0x24e368d as the checked stage dispatcher that assembles those helper outputs, with 0x24e387a as a narrow special-case gate rather than the general cost builder.",
            "Treat the repeated 0x24e3620 call families inside rows 1, 19, and 27 as verified staged feeder patterns tied to pre-threshold, 100-plus, 200-plus, and 300-plus windows, but do not collapse them into a final per-band symbolic formula until the repo proves which dispatcher lane each family actually selects at runtime.",
            "Treat the sampled `(level - offset)` feeder parameters as real row/window-specific extracted inputs, but do not generalize them to every row until the repo proves the broader row-family mapping.",
            "Treat the 100-plus feeder row clusters as the strongest current path toward a reusable shard cost family model, and treat the new 200-plus and 300-plus family maps as grounded stage-window structure rather than isolated row anecdotes.",
            "Treat the new cross-window stage profiles as grounded row-band structure inside get_SU*Cost, with rows 18 and 24-26 as the main transition outliers to explain before claiming one fully general shard formula.",
            "Treat the current stage-profile correlations as evidence that the remaining gap is a row-family switch inside get_SU*Cost rather than a simple direct function of rarity or serialized StartCost/CostExponent/GrowthExponent values alone.",
            "Treat row 0 as a separate shard cost lane until the repo proves how its five-field model and single checked level-100 gate map onto the later staged formula family.",
            "Treat the preserved over-level getter coverage classes as the strongest current key for the normal-row formula switch, ahead of rarity or raw serialized cost constants alone.",
            "Treat one representative row per coverage class as enough to carry the current formula investigation, unless a new outlier breaks the shared hundred-stage or three-hundred-stage scaffolding inside that class.",
            "Treat the current normal-row result as a class recipe boundary, not yet as a closed-form numeric evaluator.",
            "Treat the canonical symbolic assembler as the current best repo-local description of normal-row shard cost construction, while still blocking exact cost output until the numeric merge rule is proven.",
            "Treat the formula application profiles as player-safe structure summaries only: they map rows to staged recipe classes, not to exact current-cost numbers.",
            "Treat the new pre-threshold merge model as the strongest current below-100 recipe for normal rows, but keep the owner-flag-nonzero branch gated until the repo proves when that alternate path is active in-game.",
            "Treat the dispatcherCompareModel as the strongest current symbolic read of 0x24e2d86: it compares the converted exponent-side BigDouble lane against the original scalar lane with sign-aware mantissa and exponent ordering.",
            "Treat the dispatcherAlignmentModel as the strongest current read of 0x24e3597: it is a tiny fmod-style alignment gate, not a generic integer test.",
            "Treat the dispatcherSelectionModel as a real narrowing step: on sampled normal-row calls, 0x24e349c is not a co-equal default with 0x24e38f9, but a selector==1 special-case lane behind the cached-constant fast path.",
            "Treat the OverLevel100/200/300/400Base metadata names as unresolved typed field clues until the repo recovers a direct serialized mapping or a getter body that actually reads them.",
            "Treat the overLevelSeedModels as the strongest current stage-builder inputs for the sampled 100/200/300 getters: literal seeds are grounded, while the optional MMO-side float merge magnitude remains unresolved.",
            "Treat the secondary 100-plus merge models as the strongest current candidate for the remaining numeric split, but do not collapse them into a final evaluator until the preserved stack lanes are typed into exact symbolic inputs.",
            "Treat the secondary 100-plus feeder split inside the canonical class as the next numeric-merge breakpoint to explain, rather than broadening back out to all rows.",
            "Treat the sampled 300-plus feeder and both sampled 200-plus feeders as shared canonical-class structure until the binary evidence shows otherwise.",
            "Do not expose exact next-level shard costs until the repo verifies how these operand reads and helper calls combine into the returned BreakInfinity.BigDouble.",
        ],
        "spotChecks": {
            "row0": {
                "rva": row0["rva"],
                "earlyFieldOffsetsHex": [entry["offsetHex"] for entry in row0["earlyFieldReads"][:8]],
                "costFieldUsage": row0["costFieldUsage"][:5],
                "operandFieldNames": row0["operandFieldNames"][:3],
                "operandPairStartsHex": row0["operandPairStartsHex"][:3],
            },
            "row1": {
                "rva": row1["rva"],
                "earlyFieldOffsetsHex": [entry["offsetHex"] for entry in row1["earlyFieldReads"][:6]],
                "costFieldUsage": row1["costFieldUsage"][:3],
                "operandFieldNames": row1["operandFieldNames"][:2],
                "operandPairStartsHex": row1["operandPairStartsHex"][:2],
                "levelGateChecks": row1["levelGateChecks"],
                "thresholdStages": row1["thresholdStages"],
                "hundredStageStructure": row1["hundredStageStructure"],
                "threeHundredStageCostLane": row1["threeHundredStageCostLane"],
            },
            "row19": {
                "rva": row19["rva"],
                "earlyFieldOffsetsHex": [entry["offsetHex"] for entry in row19["earlyFieldReads"][:6]],
                "costFieldUsage": row19["costFieldUsage"][:3],
                "operandFieldNames": row19["operandFieldNames"][:2],
                "operandPairStartsHex": row19["operandPairStartsHex"][:2],
                "levelGateChecks": row19["levelGateChecks"],
                "thresholdStages": row19["thresholdStages"],
                "hundredStageStructure": row19["hundredStageStructure"],
                "threeHundredStageCostLane": row19["threeHundredStageCostLane"],
            },
            "row27": {
                "rva": row27["rva"],
                "earlyFieldOffsetsHex": [entry["offsetHex"] for entry in row27["earlyFieldReads"][:6]],
                "costFieldUsage": row27["costFieldUsage"][:3],
                "operandFieldNames": row27["operandFieldNames"][:2],
                "operandPairStartsHex": row27["operandPairStartsHex"][:2],
                "levelGateChecks": row27["levelGateChecks"],
                "thresholdStages": row27["thresholdStages"],
                "hundredStageStructure": row27["hundredStageStructure"],
                "threeHundredStageCostLane": row27["threeHundredStageCostLane"],
            },
        },
    }

    JSON_OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Shard Cost Native Probe",
        "",
        "Source: [`data/shard-cost-method-probe.v1.json`](C:\\Users\\Shadow\\Desktop\\CiFi\\data\\shard-cost-method-probe.v1.json), typed field offsets from [`data/uabea-probe-report.json`](C:\\Users\\Shadow\\Desktop\\CiFi\\data\\uabea-probe-report.json), plus disassembly of [`workbench/apk/base/libil2cpp.so`](C:\\Users\\Shadow\\Desktop\\CiFi\\workbench\\apk\\base\\libil2cpp.so) using the manually extracted local libraries in `.vendor_manual`.",
        "",
        "## Grounded conclusions",
        "",
    ]
    lines.extend(f"- {finding}" for finding in result["findings"])
    lines.extend(["", "## Early call clusters", ""])
    for entry in cluster_entries:
        lines.append(
            f"- `rows={entry['rows']}`; `rowCount={entry['rowCount']}`; `earlyCalls={entry['earlyCallTargets'][:6]}`"
        )
    lines.extend(["", "## Helper targets", ""])
    for entry in result["helperTargetSummaries"]:
        lines.append(f"- `{entry['target']}`; {entry['summary']}")
    lines.extend(["", "## Over-level getter profiles", ""])
    for entry in result["overLevelGetterProfiles"]:
        lines.append(
            f"- `{entry['getterName']}`; `initialBuilder={entry['initialBuilderTarget']}`; `initialIntegerSeed={entry['initialIntegerSeed']}`; `optionalFloatMerge={entry['usesOptionalFloatMerge']}`; `usesMultiplyLane={entry['usesMultiplyLane']}`; `usesFollowUpLane={entry['usesFollowUpLane']}`; `fallsIntoExtendedShardLane={entry['fallsIntoExtendedShardLane']}`"
        )
    lines.extend(["", "## Spot checks", ""])
    for key, value in result["spotChecks"].items():
        lines.append(f"- `{key}`; `rva={value['rva']}`; `earlyFieldOffsets={value['earlyFieldOffsetsHex']}`; `costFieldUsage={value['costFieldUsage']}`; `operandFields={value['operandFieldNames']}`; `operandPairs={value['operandPairStartsHex']}`; `levelGates={value.get('levelGateChecks', [])}`")
        if value.get("thresholdStages"):
            lines.append(f"  - `thresholdStages={value['thresholdStages']}`")
        if value.get("hundredStageStructure"):
            lines.append(f"  - `hundredStageStructure={value['hundredStageStructure']}`")
        if value.get("threeHundredStageCostLane"):
            lines.append(f"  - `threeHundredStageCostLane={value['threeHundredStageCostLane']}`")
    lines.extend(["", "## Formula application profiles", ""])
    lines.append(
        f"- `row0`; `formulaClass={result['formulaApplicationProfiles']['rowZero']['formulaClass']}`; `{result['formulaApplicationProfiles']['rowZero']['summary']}`"
    )
    for entry in result["formulaApplicationProfiles"]["normalRows"]:
        lines.append(
            f"- `rows={entry['rows']}`; `stageCoverage={entry['stageCoverage']}`; `formulaClass={entry['formulaClass']}`; `{entry['summary']}`"
        )
    lines.extend(["", "## Secondary 100-plus merge models", ""])
    for line in result["secondaryHundredPlusMergeModels"]["sharedFrame"]:
        lines.append(f"- {line}")
    for entry in result["secondaryHundredPlusMergeModels"]["profiles"]:
        lines.append(
            f"- `rows={entry['rows']}`; `profile={entry['profile']}`; `offsetModel={entry['offsetModel']}`; `sampleRows={entry['sampleRows']}`"
        )
        for step in entry["preDispatchAssembly"]:
            lines.append(f"  - {step}")
    lines.extend(["", "## Current boundary", ""])
    lines.extend(f"- {line}" for line in result["currentBoundary"])
    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
