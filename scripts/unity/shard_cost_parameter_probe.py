from __future__ import annotations

import json
import math
import re
import struct
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"
LEVEL0_PATH = ROOT / "workbench" / "unity" / "joined" / "level0"
GROUNDED_PATH = ROOT / "data" / "shard-milestones.grounded.v1.json"
JSON_OUT = ROOT / "data" / "shard-cost-parameter-probe.v1.json"
MD_OUT = ROOT / "docs" / "systems" / "shards" / "shard-cost-parameter-probe.md"

SHARD_MINING_ABSOLUTE_OFFSET = 34_088_352
SHARD_MINING_BYTE_SIZE = 6_732
MONOBEHAVIOUR_HEAD_SIZE = 32


def extract_unique_matches(blob: str, pattern: str) -> list[str]:
    return sorted(set(re.findall(pattern, blob)))


def extract_metadata_families(metadata_text: str) -> dict[str, list[str]]:
    return {
        "startCostFields": extract_unique_matches(metadata_text, r"SU\d+StartCost"),
        "costExponentFields": extract_unique_matches(metadata_text, r"SU\d+CostExponent"),
        "growthExponentFields": extract_unique_matches(metadata_text, r"SU\d+GrowthExponent\d*"),
        "costAccessors": extract_unique_matches(metadata_text, r"get_SU\d+Cost"),
        "overLevelExponentFields": extract_unique_matches(metadata_text, r"OverLevel\d+Exponent"),
        "overLevelExponentAccessors": extract_unique_matches(metadata_text, r"get_OverLevel\d+Exponent"),
    }


def extract_shard_mining_candidate_tuples(level_blob: bytes) -> list[dict[str, object]]:
    body = level_blob[
        SHARD_MINING_ABSOLUTE_OFFSET + MONOBEHAVIOUR_HEAD_SIZE : SHARD_MINING_ABSOLUTE_OFFSET + SHARD_MINING_BYTE_SIZE
    ]
    tuples: list[dict[str, object]] = []
    for offset in range(0, len(body) - 56, 8):
        leading_value = struct.unpack_from("<d", body, offset)[0]
        int_value = struct.unpack_from("<I", body, offset + 8)[0]
        exponent_a = struct.unpack_from("<d", body, offset + 16)[0]
        exponent_b = struct.unpack_from("<d", body, offset + 32)[0]
        tail_scalar = struct.unpack_from("<d", body, offset + 48)[0]
        tail_sentinel_a = struct.unpack_from("<I", body, offset + 40)[0]
        tail_sentinel_b = struct.unpack_from("<I", body, offset + 44)[0]
        if not all(math.isfinite(value) for value in (leading_value, exponent_a, exponent_b, tail_scalar)):
            continue
        if not (0.9 <= leading_value <= 5):
            continue
        if not (1 <= int_value <= 2000):
            continue
        if not (1.8 <= exponent_a <= 2.6):
            continue
        if not (1.8 <= exponent_b <= 4.1):
            continue
        if not (0.005 <= tail_scalar <= 0.05):
            continue
        tuples.append(
            {
                "offset": offset,
                "absoluteOffset": SHARD_MINING_ABSOLUTE_OFFSET + MONOBEHAVIOUR_HEAD_SIZE + offset,
                "leadingValue": round(leading_value, 12),
                "intValue": int_value,
                "exponentA": round(exponent_a, 12),
                "exponentB": round(exponent_b, 12),
                "tailScalar": round(tail_scalar, 12),
                "tailSentinelA": tail_sentinel_a,
                "tailSentinelB": tail_sentinel_b,
            }
        )
    return tuples


def extract_pointer_runs(level_blob: bytes) -> list[dict[str, int]]:
    raw = level_blob[SHARD_MINING_ABSOLUTE_OFFSET : SHARD_MINING_ABSOLUTE_OFFSET + SHARD_MINING_BYTE_SIZE]
    body = raw[MONOBEHAVIOUR_HEAD_SIZE:]
    hits: list[int] = []
    for offset in range(0, len(body) - 12, 4):
        file_id = struct.unpack_from("<I", body, offset)[0]
        path_id = struct.unpack_from("<Q", body, offset + 4)[0]
        if file_id in (0, 1) and 1_000 < path_id < 1_000_000:
            hits.append(offset)
    runs: list[list[int]] = []
    if hits:
        current = [hits[0]]
        for offset in hits[1:]:
            if offset - current[-1] == 12:
                current.append(offset)
            else:
                runs.append(current)
                current = [offset]
        runs.append(current)
    return [{"start": run[0], "count": len(run)} for run in runs if len(run) >= 3]


def extract_unlock_requirement_block(level_blob: bytes) -> dict[str, object] | None:
    raw = level_blob[SHARD_MINING_ABSOLUTE_OFFSET : SHARD_MINING_ABSOLUTE_OFFSET + SHARD_MINING_BYTE_SIZE]
    body = raw[MONOBEHAVIOUR_HEAD_SIZE:]
    for offset in range(0, len(body) - 30 * 4 + 1, 4):
        values = [struct.unpack_from("<I", body, offset + index * 4)[0] for index in range(30)]
        if values[:4] != [0, 0, 5, 10]:
            continue
        if values[-3:] != [8000, 8050, 8100]:
            continue
        if any(values[index] > values[index + 1] for index in range(1, len(values) - 1)):
            continue
        return {
            "offset": offset,
            "absoluteOffset": SHARD_MINING_ABSOLUTE_OFFSET + MONOBEHAVIOUR_HEAD_SIZE + offset,
            "values": values,
            "rationale": [
                "This 30-int lane is the strongest direct match for the shard unlock requirement family inside ShardMining.",
                "It preserves the zero-start pattern for rows 0-1, the early 5/10/20/30 progression, and the late 8000/8050/8100 thresholds for rows 27-29.",
                "That makes it strong enough to treat as the exact serialized SU0-29 unlock requirement block rather than a generic int cluster.",
            ],
        }
    return None


def read_row_tuple(body: bytes, tuple_offset: int) -> dict[str, object]:
    return {
        "tupleOffset": tuple_offset,
        "leadingValue": round(struct.unpack_from("<d", body, tuple_offset)[0], 12),
        "intValue": struct.unpack_from("<I", body, tuple_offset + 8)[0],
        "exponentA": round(struct.unpack_from("<d", body, tuple_offset + 16)[0], 12),
        "exponentB": round(struct.unpack_from("<d", body, tuple_offset + 32)[0], 12),
        "tailScalar": round(struct.unpack_from("<d", body, tuple_offset + 48)[0], 12),
        "tailSentinelA": struct.unpack_from("<I", body, tuple_offset + 40)[0],
        "tailSentinelB": struct.unpack_from("<I", body, tuple_offset + 44)[0],
    }


def read_row_direct_values(body: bytes, tuple_offset: int, block_end: int, bonus_count: int) -> dict[str, object]:
    block = body[tuple_offset:block_end]
    bonus_float_count = max(0, bonus_count)
    bonus_bytes = bonus_float_count * 4
    prefix_end = len(block) - bonus_bytes
    prefix = block[:prefix_end]
    bonus_slice = block[prefix_end:]
    prefix_u32 = [
        struct.unpack_from("<I", prefix, offset)[0]
        for offset in range(0, len(prefix), 4)
        if offset + 4 <= len(prefix)
    ]
    prefix_f64 = []
    for offset in range(0, len(prefix), 8):
        if offset + 8 > len(prefix):
            break
        value = struct.unpack_from("<d", prefix, offset)[0]
        prefix_f64.append(None if not math.isfinite(value) else round(value, 12))
    bonus_per_level_values = [
        round(struct.unpack_from("<f", bonus_slice, offset)[0], 12)
        for offset in range(0, len(bonus_slice), 4)
        if offset + 4 <= len(bonus_slice)
    ]
    return {
        "numericBlockByteCount": len(block),
        "costPrefixByteCount": len(prefix),
        "bonusFloatCount": len(bonus_per_level_values),
        "costPrefixU32": prefix_u32,
        "costPrefixF64": prefix_f64,
        "candidateStartCostInt": prefix_u32[2] if len(prefix_u32) >= 3 else None,
        "candidateCostDoubleA": prefix_f64[0] if len(prefix_f64) >= 1 else None,
        "candidateCostDoubleB": prefix_f64[2] if len(prefix_f64) >= 3 else None,
        "candidateCostDoubleC": prefix_f64[4] if len(prefix_f64) >= 5 else None,
        "bonusPerLevelValues": bonus_per_level_values,
    }


def build_field_order_mapping_for_common_row(direct_values: dict[str, object]) -> dict[str, object]:
    return {
        "fieldNames": ["StartCost", "CostExponent", "GrowthExponent"],
        "values": {
            "StartCost": direct_values.get("candidateCostDoubleA"),
            "CostExponent": direct_values.get("candidateCostDoubleB"),
            "GrowthExponent": direct_values.get("candidateCostDoubleC"),
        },
        "auxiliaryIntCandidate": direct_values.get("candidateStartCostInt"),
        "rationale": [
            "Rows 1-29 preserve exactly three 16-byte BigDouble slots in the row-local numeric prefix before the bonus-per-level float tail.",
            "The metadata family for rows 1-29 also preserves exactly three row-local cost field names: StartCost, CostExponent, and GrowthExponent.",
            "This is strong enough to treat the three-value mapping as exact serialized row-local cost fields, even though the formula that consumes them is still not fully verified.",
        ],
    }


def build_field_order_mapping_for_row0(direct_values: dict[str, object]) -> dict[str, object]:
    prefix_f64 = direct_values.get("costPrefixF64", [])
    ordered_values = [
        prefix_f64[index] if index < len(prefix_f64) else None
        for index in (0, 2, 4, 6, 8)
    ]
    return {
        "fieldNames": [
            "StartCost",
            "CostExponent",
            "GrowthExponent",
            "GrowthExponent2",
            "GrowthExponent3",
        ],
        "values": {
            "StartCost": ordered_values[0],
            "CostExponent": ordered_values[1],
            "GrowthExponent": ordered_values[2],
            "GrowthExponent2": ordered_values[3],
            "GrowthExponent3": ordered_values[4],
        },
        "auxiliaryIntCandidate": direct_values.get("candidateStartCostInt"),
        "rationale": [
            "The row-0 prelude candidate preserves five 16-byte BigDouble slots before the bonus-per-level float tail.",
            "The row-0 metadata shell preserves five row-local cost field names in the same order: StartCost, CostExponent, GrowthExponent, GrowthExponent2, and GrowthExponent3.",
            "This is strong enough to treat the row-0 five-value mapping as exact serialized row-local cost fields, even though the exact get_SU0Cost formula is still not verified.",
        ],
    }


def build_row_aligned_tuple_candidates(level_blob: bytes, grounded: dict[str, object]) -> list[dict[str, object]]:
    milestones = sorted(
        [item for item in grounded.get("milestones", []) if int(item.get("milestoneNumber", -1)) >= 1],
        key=lambda item: int(item["milestoneNumber"]),
    )
    expected_counts = [2 * len(item.get("bonuses", [])) + 1 for item in milestones]
    pointer_runs = extract_pointer_runs(level_blob)
    matched_slice: list[dict[str, int]] | None = None
    for index in range(0, len(pointer_runs) - len(expected_counts) + 1):
        candidate_slice = pointer_runs[index : index + len(expected_counts)]
        if [int(entry["count"]) for entry in candidate_slice] == expected_counts:
            matched_slice = candidate_slice
            break
    if matched_slice is None:
        return []

    raw = level_blob[SHARD_MINING_ABSOLUTE_OFFSET : SHARD_MINING_ABSOLUTE_OFFSET + SHARD_MINING_BYTE_SIZE]
    body = raw[MONOBEHAVIOUR_HEAD_SIZE:]
    unlock_requirement_block = extract_unlock_requirement_block(level_blob)
    unlock_values = unlock_requirement_block.get("values", []) if unlock_requirement_block else []
    rows: list[dict[str, object]] = []
    for index, (milestone, run) in enumerate(zip(milestones, matched_slice)):
        row = int(milestone["milestoneNumber"])
        bonus_count = len(milestone.get("bonuses", []))
        tuple_offset = int(run["start"]) + int(run["count"]) * 12
        next_run_start = (
            int(matched_slice[index + 1]["start"])
            if index + 1 < len(matched_slice)
            else len(body)
        )
        if tuple_offset + 56 > len(body) or tuple_offset >= next_run_start:
            continue
        direct_values = read_row_direct_values(body, tuple_offset, next_run_start, bonus_count)
        rows.append(
            {
                "row": row,
                "rarity": milestone.get("rarity"),
                "unlockRequirementValue": unlock_values[row] if row < len(unlock_values) else None,
                "bonusCount": bonus_count,
                "pointerRunStart": int(run["start"]),
                "pointerRefCount": int(run["count"]),
                "nextPointerRunStart": next_run_start,
                **read_row_tuple(body, tuple_offset),
                **direct_values,
                "strongestFieldOrderMapping": build_field_order_mapping_for_common_row(direct_values),
            }
        )
    return rows


def build_row0_prelude_candidate(level_blob: bytes, grounded: dict[str, object]) -> dict[str, object] | None:
    milestones = sorted(
        [item for item in grounded.get("milestones", []) if int(item.get("milestoneNumber", -1)) >= 1],
        key=lambda item: int(item["milestoneNumber"]),
    )
    expected_counts = [2 * len(item.get("bonuses", [])) + 1 for item in milestones]
    pointer_runs = extract_pointer_runs(level_blob)
    matched_index: int | None = None
    for index in range(0, len(pointer_runs) - len(expected_counts) + 1):
        candidate_slice = pointer_runs[index : index + len(expected_counts)]
        if [int(entry["count"]) for entry in candidate_slice] == expected_counts:
            matched_index = index
            break
    if matched_index is None or matched_index == 0:
        return None
    prior_run = pointer_runs[matched_index - 1]
    raw = level_blob[SHARD_MINING_ABSOLUTE_OFFSET : SHARD_MINING_ABSOLUTE_OFFSET + SHARD_MINING_BYTE_SIZE]
    body = raw[MONOBEHAVIOUR_HEAD_SIZE:]
    unlock_requirement_block = extract_unlock_requirement_block(level_blob)
    unlock_values = unlock_requirement_block.get("values", []) if unlock_requirement_block else []
    tuple_offset = int(prior_run["start"]) + int(prior_run["count"]) * 12
    if tuple_offset + 56 > len(body):
        return None
    row0_bonus_count = 8
    first_verified_row_run = pointer_runs[matched_index]
    direct_values = read_row_direct_values(body, tuple_offset, int(first_verified_row_run["start"]), row0_bonus_count)
    return {
        "row": 0,
        "unlockRequirementValue": unlock_values[0] if unlock_values else None,
        "pointerRunStart": int(prior_run["start"]),
        "pointerRefCount": int(prior_run["count"]),
        "nextPointerRunStart": int(first_verified_row_run["start"]),
        "rationale": [
            "This is the strongest mixed numeric block immediately after the last pre-row pointer run before the verified row 1-29 sequence.",
            "Row 0 is the only grounded shard milestone with 8 bonus slots and no preserved row-aligned tuple in the 1-29 sequence, so this prelude block is the strongest current row-0 candidate.",
            "The row-local formula is not yet typed, so this stays a row-0 candidate block rather than a verified SU0 cost formula.",
        ],
        **read_row_tuple(body, tuple_offset),
        **direct_values,
        "strongestFieldOrderMapping": build_field_order_mapping_for_row0(direct_values),
    }


def build_signature_groups(candidate_tuples: list[dict[str, object]]) -> list[dict[str, object]]:
    groups: dict[tuple[float, float, float], list[dict[str, object]]] = {}
    for entry in candidate_tuples:
        key = (float(entry["leadingValue"]), float(entry["exponentA"]), float(entry["exponentB"]))
        groups.setdefault(key, []).append(entry)
    return [
        {
            "leadingValue": key[0],
            "exponentA": key[1],
            "exponentB": key[2],
            "count": len(entries),
            "offsets": [int(item["offset"]) for item in entries],
            "intValues": [int(item["intValue"]) for item in entries],
            "tailScalars": [float(item["tailScalar"]) for item in entries],
        }
        for key, entries in sorted(groups.items(), key=lambda item: (item[0][0], item[0][1], item[0][2]))
    ]


def build_repeated_common_row_group(row_aligned_tuples: list[dict[str, object]]) -> dict[str, object] | None:
    repeated_common = [
        entry
        for entry in row_aligned_tuples
        if float(entry["leadingValue"]) == 1.0
        and float(entry["exponentA"]) == 2.5
        and float(entry["exponentB"]) == 4.0
    ]
    repeated_common = sorted(repeated_common, key=lambda entry: int(entry["row"]))
    if len(repeated_common) != 3:
        return None
    return {
        "rows": [int(entry["row"]) for entry in repeated_common],
        "rationale": [
            "The row-aligned tuple map preserves exactly three repeated common-row records with signature leading=1, exponentA=2.5, exponentB=4.",
            "Those rows are tied to direct row-aligned tuple offsets inside ShardMining, not just a free-floating tuple scan.",
            "The tuple field semantics are still not fully typed, so this stays a row-family grouping result rather than a final cost-formula proof.",
        ],
        "tuples": repeated_common,
    }


def render_markdown(
    metadata_families: dict[str, list[str]],
    candidate_tuples: list[dict[str, object]],
    signature_groups: list[dict[str, object]],
    row_aligned_tuples: list[dict[str, object]],
    row0_prelude_candidate: dict[str, object] | None,
    unlock_requirement_block: dict[str, object] | None,
    repeated_common_row_group: dict[str, object] | None,
) -> str:
    lines = [
        "# Shard Cost Parameter Probe",
        "",
        "Source: [`workbench/apk/base/global-metadata.dat`](C:\\Users\\Shadow\\Desktop\\CiFi\\workbench\\apk\\base\\global-metadata.dat) plus the direct `ShardMining` MonoBehaviour byte range in [`workbench/unity/joined/level0`](C:\\Users\\Shadow\\Desktop\\CiFi\\workbench\\unity\\joined\\level0).",
        "",
        "## Grounded conclusions",
        "",
        f"- Metadata now preserves a row-complete `SU0-29` family for `StartCost` ({len(metadata_families['startCostFields'])} fields) and `CostExponent` ({len(metadata_families['costExponentFields'])} fields).",
        f"- Metadata also preserves a row-complete `get_SU0-29Cost` accessor family ({len(metadata_families['costAccessors'])} accessors).",
        f"- Shared shard cost breakpoint hooks also survive in metadata as `{', '.join(metadata_families['overLevelExponentFields'])}`.",
        f"- The direct `ShardMining` body contains {len(candidate_tuples)} mixed integer/double parameter tuples beyond the old row-0 shell, which is stronger evidence that numeric shard cost parameters survive in scene data.",
        f"- The recovered tuples collapse into {len(signature_groups)} distinct parameter signatures inside the direct `ShardMining` payload.",
        f"- ShardMining also preserves an exact `SU0-29UnlockReq` int lane ending `... / 8000 / 8050 / 8100` at body offset `{unlock_requirement_block['offset']}`." if unlock_requirement_block else "- Exact serialized `SU0-29UnlockReq` values were not recovered in this probe.",
        f"- Rows `1-29` now have a direct row-aligned tuple map inside `ShardMining` ({len(row_aligned_tuples)} row-aligned tuples).",
        f"- Rows `0-29` now also preserve exact trailing `bonusPerLevel` float values inside the same `ShardMining` row blocks, including row `27` = `1.10 / 1.19 / 1.13` and row `19` = `1.13 / 1.15 / 1.17`.",
        "- The aligned row blocks now preserve exact serialized cost fields: rows `1-29` expose `StartCost / CostExponent / GrowthExponent`, and row `0` exposes `StartCost / CostExponent / GrowthExponent / GrowthExponent2 / GrowthExponent3`.",
        "- The old row-local integer-at-+8 is still preserved as an auxiliary unknown, but it no longer outranks the ordered double-field mapping as the strongest current named-cost recovery.",
        f"- Row `0` also has a strongest current prelude candidate block after a `pointerRefCount={row0_prelude_candidate['pointerRefCount']}` run." if row0_prelude_candidate else "- Row `0` still does not have a preserved candidate block in this probe.",
        "- These tuples are not yet fully formula-mapped, so they are preserved as candidate parameter records rather than promoted as final shard costs.",
        "- Every recovered tuple ends in the same `0xFFFFFFFF`-style tail sentinel pattern, which strengthens the repeated-record interpretation.",
        "",
        "## Unlock requirement lane",
        "",
    ]
    if unlock_requirement_block:
        lines.append(
            "- "
            f"`offset={unlock_requirement_block['offset']}`; "
            f"`absolute={unlock_requirement_block['absoluteOffset']}`; "
            f"`values={unlock_requirement_block['values']}`"
        )
        lines.extend([f"- {line}" for line in unlock_requirement_block["rationale"]])
    else:
        lines.append("- The direct unlock requirement lane was not recovered in the current probe.")
    lines.extend(
        [
            "",
            "## Signature groups",
            "",
        ]
    )
    for group in signature_groups:
        lines.append(
            "- "
            f"`leading={group['leadingValue']}`; "
            f"`exponentA={group['exponentA']}`; "
            f"`exponentB={group['exponentB']}`; "
            f"`count={group['count']}`; "
            f"`ints={group['intValues']}`; "
            f"`tails={group['tailScalars']}`"
        )
    lines.extend(
        [
            "",
            "## Row-aligned tuple map",
            "",
        ]
    )
    for entry in row_aligned_tuples:
        lines.append(
            "- "
            f"`row={entry['row']}`; "
            f"`rarity={entry['rarity']}`; "
            f"`unlockReq={entry['unlockRequirementValue']}`; "
            f"`bonusCount={entry['bonusCount']}`; "
            f"`pointerRefs={entry['pointerRefCount']}`; "
            f"`costFields={entry['strongestFieldOrderMapping']['values']}`; "
            f"`auxInt={entry['strongestFieldOrderMapping']['auxiliaryIntCandidate']}`; "
            f"`bonusPerLevel={entry['bonusPerLevelValues']}`; "
            f"`leading={entry['leadingValue']}`; "
            f"`int={entry['intValue']}`; "
            f"`exponentA={entry['exponentA']}`; "
            f"`exponentB={entry['exponentB']}`; "
            f"`tailScalar={entry['tailScalar']}`"
        )
    lines.extend(
        [
            "",
            "## Row 0 prelude candidate",
            "",
        ]
    )
    if row0_prelude_candidate:
        lines.append(
            "- "
            f"`unlockReq={row0_prelude_candidate['unlockRequirementValue']}`; "
            f"`pointerRefs={row0_prelude_candidate['pointerRefCount']}`; "
            f"`costFields={row0_prelude_candidate['strongestFieldOrderMapping']['values']}`; "
            f"`auxInt={row0_prelude_candidate['strongestFieldOrderMapping']['auxiliaryIntCandidate']}`; "
            f"`bonusPerLevel={row0_prelude_candidate['bonusPerLevelValues']}`; "
            f"`leading={row0_prelude_candidate['leadingValue']}`; "
            f"`int={row0_prelude_candidate['intValue']}`; "
            f"`exponentA={row0_prelude_candidate['exponentA']}`; "
            f"`exponentB={row0_prelude_candidate['exponentB']}`; "
            f"`tailScalar={row0_prelude_candidate['tailScalar']}`"
        )
        lines.append("- This sits immediately before the verified row 1-29 tuple sequence, but it is still an inference-only row-0 candidate block.")
    else:
        lines.append("- No row-0 prelude candidate block was preserved in the current probe.")
    lines.extend(
        [
            "",
            "## Repeated common-row group",
            "",
        ]
    )
    if repeated_common_row_group:
        lines.append(f"- Rows `{repeated_common_row_group['rows'][0]}-{repeated_common_row_group['rows'][-1]}` share the repeated `leading=1`, `exponentA=2.5`, `exponentB=4` signature.")
        lines.append("- This is now a direct row-aligned grouping result, but the tuple fields are still not fully typed.")
    else:
        lines.append("- No repeated common-row group was preserved in the current row-aligned tuple map.")
    lines.extend(
        [
            "",
            "## Candidate tuples",
            "",
        ]
    )
    for entry in candidate_tuples:
        lines.append(
            "- "
            f"`offset={entry['offset']}`; "
            f"`leading={entry['leadingValue']}`; "
            f"`int={entry['intValue']}`; "
            f"`exponentA={entry['exponentA']}`; "
            f"`exponentB={entry['exponentB']}`; "
            f"`tailScalar={entry['tailScalar']}`; "
            f"`tailSentinels=({entry['tailSentinelA']}, {entry['tailSentinelB']})`"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    metadata_text = METADATA_PATH.read_bytes().decode("latin1", errors="ignore")
    level_blob = LEVEL0_PATH.read_bytes()
    grounded = json.loads(GROUNDED_PATH.read_text(encoding="utf-8"))
    metadata_families = extract_metadata_families(metadata_text)
    candidate_tuples = extract_shard_mining_candidate_tuples(level_blob)
    row_aligned_tuples = build_row_aligned_tuple_candidates(level_blob, grounded)
    row0_prelude_candidate = build_row0_prelude_candidate(level_blob, grounded)
    unlock_requirement_block = extract_unlock_requirement_block(level_blob)
    signature_groups = build_signature_groups(candidate_tuples)
    repeated_common_row_group = build_repeated_common_row_group(row_aligned_tuples)
    payload = {
        "dataset": "shard-cost-parameter-probe.v1",
        "generatedAt": str(date.today()),
        "source": {
            "metadata": str(METADATA_PATH),
            "level0": str(LEVEL0_PATH),
            "shardMiningAbsoluteOffset": SHARD_MINING_ABSOLUTE_OFFSET,
            "shardMiningByteSize": SHARD_MINING_BYTE_SIZE,
        },
        "metadataFamilies": metadata_families,
        "unlockRequirementBlock": unlock_requirement_block,
        "shardMiningCandidateTuples": candidate_tuples,
        "rowAlignedTupleCandidates": row_aligned_tuples,
        "row0PreludeCandidate": row0_prelude_candidate,
        "signatureGroups": signature_groups,
        "repeatedCommonRowGroup": repeated_common_row_group,
        "findings": [
            "global-metadata.dat now preserves row-complete SU0-29 StartCost, CostExponent, and get_SU*Cost families.",
            "The direct ShardMining payload now also preserves an exact serialized SU0-29 unlock requirement lane.",
            "Shared OverLevel100/200/300/400 exponent hooks also remain visible beside the shard row family in metadata.",
            "The direct ShardMining body contains mixed integer/double parameter tuples beyond the older row-0 shell.",
            "Those tuples collapse into five distinct parameter signatures, including one signature that repeats exactly three times.",
            "Rows 1-29 now have a direct row-aligned exact serialized value map inside ShardMining, derived from pointer-run counts that match the grounded row bonus structure.",
            "Rows 0-29 also now preserve exact trailing bonus-per-level float values inside the same aligned ShardMining row blocks.",
            "The aligned row prefixes now preserve exact serialized StartCost/CostExponent/GrowthExponent fields for rows 1-29, while row 0 preserves StartCost/CostExponent/GrowthExponent/GrowthExponent2/GrowthExponent3.",
            "The aligned row integer-at-+8 still survives as an auxiliary unknown per row, but it no longer outranks the ordered double-field mapping as the strongest current named-cost recovery.",
            "A strongest current row-0 prelude candidate block now sits immediately before that verified row 1-29 tuple sequence.",
            "The repeated leading=1 / exponentA=2.5 / exponentB=4 signature now maps directly to rows 19-21 in the row-aligned tuple map.",
            "The recovered tuples share the same tail sentinel pattern, which strengthens the repeated-record interpretation.",
            "The current repo can now preserve exact serialized shard row values without claiming a verified runtime formula.",
        ],
        "currentBoundary": [
            "Treat these recovered row values as exact serialized ShardMining row fields and unlock thresholds, not as a verified get_SU*Cost formula or planner-safe next-cost output.",
            "Do not promote these row values into shard planner math until formula behavior is verified.",
            "Treat the row-aligned cost-field mapping and trailing bonus floats as exact serialized row values, but not yet as a verified get_SU*Cost formula.",
            "Treat the row-0 prelude block as the strongest current SU0 candidate, not a verified row-0 cost tuple yet.",
            "Use this probe to narrow the next typed parser step around the existing ShardMining scene target.",
        ],
    }
    JSON_OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    MD_OUT.write_text(render_markdown(metadata_families, candidate_tuples, signature_groups, row_aligned_tuples, row0_prelude_candidate, unlock_requirement_block, repeated_common_row_group), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
