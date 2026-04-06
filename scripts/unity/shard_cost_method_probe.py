from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from portable_paths import md_link


ROOT = Path(__file__).resolve().parents[2]
UABEA_REPORT_PATH = ROOT / "data" / "uabea-probe-report.json"
LIBIL2CPP_PATH = ROOT / "workbench" / "apk" / "base" / "libil2cpp.so"
JSON_OUT = ROOT / "data" / "shard-cost-method-probe.v1.json"
MD_OUT = ROOT / "docs" / "systems" / "shards" / "shard-cost-method-probe.md"

COST_METHOD_RE = re.compile(r"get_SU(?P<row>\d+)Cost$")
HELPER_METHOD_NAMES = {
    "UpdateShardCostList",
    "GetShardCostList",
    "SortCostAndBools",
    "CountAffordableShard",
}
OVER_LEVEL_METHOD_RE = re.compile(r"get_OverLevel\d+Exponent$")


def load_shard_methods() -> list[dict[str, object]]:
    report = json.loads(UABEA_REPORT_PATH.read_text(encoding="utf-8"))
    for entry in report.get("directTargetTypeMetadata", []):
        if entry.get("scriptName") == "ShardMining":
            return entry.get("methods", [])
    raise RuntimeError("ShardMining method metadata missing from uabea-probe-report.json")


def build_method_entry(method: dict[str, object], next_rva: int | None, binary_blob: bytes) -> dict[str, object]:
    props = method.get("methodProperties", {})
    rva = int(props.get("Rva"))
    method_pointer = int(props.get("MethodPointer"))
    row_match = COST_METHOD_RE.match(str(method.get("name")))
    row = int(row_match.group("row")) if row_match else None
    tracked_span = (next_rva - rva) if next_rva is not None else None
    body = binary_blob[rva:next_rva] if next_rva is not None else b""

    return {
        "row": row,
        "name": method.get("name"),
        "returnType": method.get("returnType"),
        "rva": rva,
        "methodPointer": method_pointer,
        "estimatedTrackedBodySize": tracked_span,
        "entryBytesHex": binary_blob[rva : rva + 16].hex(),
        "trackedBodySha256": hashlib.sha256(body).hexdigest() if body else None,
        "humanReadableSignature": props.get("HumanReadableSignature"),
    }


def cluster_rows_by_size(cost_methods: list[dict[str, object]]) -> list[dict[str, object]]:
    grouped: dict[int, list[dict[str, object]]] = defaultdict(list)
    for entry in cost_methods:
        size = entry.get("estimatedTrackedBodySize")
        if isinstance(size, int):
            grouped[size].append(entry)

    clusters: list[dict[str, object]] = []
    for size, rows in sorted(grouped.items(), key=lambda item: (-len(item[1]), item[0])):
        row_numbers = [int(entry["row"]) for entry in rows if entry.get("row") is not None]
        clusters.append(
            {
                "estimatedTrackedBodySize": size,
                "count": len(rows),
                "rows": row_numbers,
                "names": [entry["name"] for entry in rows],
            }
        )
    return clusters


def main() -> None:
    methods = load_shard_methods()
    binary_blob = LIBIL2CPP_PATH.read_bytes()

    tracked_methods: list[dict[str, object]] = []
    for method in methods:
        name = str(method.get("name"))
        if COST_METHOD_RE.match(name) or OVER_LEVEL_METHOD_RE.match(name) or name in HELPER_METHOD_NAMES:
            tracked_methods.append(method)
    tracked_methods.sort(key=lambda entry: int(entry.get("methodProperties", {}).get("Rva")))

    built_entries = []
    for index, method in enumerate(tracked_methods):
        next_rva = None
        if index + 1 < len(tracked_methods):
            next_rva = int(tracked_methods[index + 1].get("methodProperties", {}).get("Rva"))
        built_entries.append(build_method_entry(method, next_rva, binary_blob))

    cost_methods = [entry for entry in built_entries if entry.get("row") is not None]
    helper_methods = [entry for entry in built_entries if entry.get("row") is None]
    size_clusters = cluster_rows_by_size(cost_methods)
    size_distribution = Counter(
        entry["estimatedTrackedBodySize"]
        for entry in cost_methods
        if isinstance(entry.get("estimatedTrackedBodySize"), int)
    )

    result = {
        "dataset": "shard-cost-method-probe.v1",
        "generatedAt": str(date.today()),
        "source": {
            "uabeaProbeReport": "data/uabea-probe-report.json",
            "libIl2cpp": "workbench/apk/base/libil2cpp.so",
        },
        "costGetterFamily": {
            "count": len(cost_methods),
            "returnType": "BreakInfinity.BigDouble",
            "rows": cost_methods,
        },
        "helperMethods": helper_methods,
        "estimatedTrackedBodySizeClusters": size_clusters,
        "estimatedTrackedBodySizeDistribution": [
            {"estimatedTrackedBodySize": size, "count": count}
            for size, count in sorted(size_distribution.items(), key=lambda item: (-item[1], item[0]))
        ],
        "findings": [
            "ShardMining preserves a real get_SU0-29Cost runtime family returning BreakInfinity.BigDouble inside libil2cpp.so, not just metadata names.",
            "UpdateShardCostList, four get_OverLevel*Exponent helpers, and get_SU0Cost sit in one contiguous tracked neighborhood, which is the strongest current formula neighborhood for shard next-cost recovery.",
            "The get_SU1-17Cost accessors mostly collapse into a near-uniform tracked body-size band around 3279-3287 bytes, which is consistent with one repeated code template with row-local constants.",
            "Late getters diverge into smaller tracked size bands such as rows 19-21 at 3258 bytes, rows 23-24 at 2983 bytes, and rows 28-29 at 2693 bytes, which is consistent with branch changes or lane-specific late-game cost logic.",
            "The repo still does not preserve the decoded method bodies, so these tracked sizes narrow the formula search but do not by themselves prove the exact get_SU*Cost equation.",
        ],
        "currentBoundary": [
            "Treat get_SU0-29Cost as a verified runtime getter family on ShardMining with direct libil2cpp RVAs and entry bytes.",
            "Treat UpdateShardCostList, get_OverLevel100-400Exponent, GetShardCostList, SortCostAndBools, and CountAffordableShard as the strongest current native helper neighborhood for shard cost recovery.",
            "Treat tracked body-size clusters as code-shape evidence for shared or split cost lanes, not as final proof of the exact mathematical formula.",
            "Do not promote next-level shard costs as player-facing truth until the repo recovers or verifies the actual BigDouble computation used by the getter family.",
        ],
    }

    JSON_OUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    lines = [
        "# Shard Cost Method Probe",
        "",
        f"Source: {md_link(UABEA_REPORT_PATH)} plus the native code bytes in {md_link(LIBIL2CPP_PATH)}.",
        "",
        "## Grounded conclusions",
        "",
    ]
    lines.extend(f"- {finding}" for finding in result["findings"])
    lines.extend(
        [
            "",
            "## Helper neighborhood",
            "",
        ]
    )
    for helper in helper_methods:
        lines.append(
            f"- `{helper['name']}`; `rva={helper['rva']}`; `estimatedTrackedBodySize={helper['estimatedTrackedBodySize']}`; `returnType={helper['returnType']}`"
        )
    lines.extend(
        [
            "",
            "## Cost getter family",
            "",
        ]
    )
    for entry in cost_methods:
        lines.append(
            f"- `row={entry['row']}`; `{entry['name']}`; `rva={entry['rva']}`; `estimatedTrackedBodySize={entry['estimatedTrackedBodySize']}`; `entryBytes={entry['entryBytesHex'][:16]}`"
        )
    lines.extend(
        [
            "",
            "## Tracked size clusters",
            "",
        ]
    )
    for cluster in size_clusters:
        lines.append(
            f"- `size={cluster['estimatedTrackedBodySize']}`; `count={cluster['count']}`; `rows={cluster['rows']}`"
        )
    lines.extend(
        [
            "",
            "## Current boundary",
            "",
        ]
    )
    lines.extend(f"- {line}" for line in result["currentBoundary"])
    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
