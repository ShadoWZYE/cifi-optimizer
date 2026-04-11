from __future__ import annotations

import argparse
import json
import re
from datetime import date
from pathlib import Path
from typing import Any

from portable_paths import md_link, repo_relative


ROOT = Path(__file__).resolve().parents[2]
JSON_OUT = ROOT / "data" / "unity-trace-bundle.json"
MD_OUT = ROOT / "docs" / "unity" / "unity-trace-bundle.md"
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"

ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")

SOURCE_PATHS = {
    "metadata": METADATA_PATH,
    "tokenShopExtract": ROOT / "data" / "token-shop-values.json",
    "dailyTokeniumLaneProbe": ROOT / "data" / "daily-tokenium-lane-probe.json",
    "uabeaProbe": ROOT / "data" / "uabea-probe-report.json",
    "unityProbe": ROOT / "data" / "unity-probe-report.json",
    "lm244TargetedProbe": ROOT / "data" / "lm244-targeted-probe.json",
}

TRACE_TARGETS: dict[str, dict[str, Any]] = {
    "token-shop-atu3-cells": {
        "label": "TokenShop ATU3 cells split",
        "anchors": ["ATU3Button", "15810"],
        "joinGoal": "Recover one checked ATU3Button or path id 15810 bridge to one exact prefab identity or final player-facing title.",
        "shellField": "ATU3Button",
        "shellPathId": 15810,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 3,
        "surfaces": [
            {
                "id": "metadata-neighborhood",
                "label": "Metadata neighborhood",
                "sourceIds": ["metadata"],
                "terms": ["ATU3Button", "CellBoost", "BuyCellBoost"],
            },
            {
                "id": "action-lane",
                "label": "Action hook lane",
                "sourceIds": ["dailyTokeniumLaneProbe"],
                "terms": ["StartCellBostHold", "StopCellBostHold", "BuyCellBoost"],
            },
            {
                "id": "diamond-special",
                "label": "Diamond-special prefab or title lane",
                "sourceIds": ["lm244TargetedProbe", "unityProbe", "uabeaProbe"],
                "terms": ["NewDiamondUPGPrefab.Specials.CellsBoost", ">Diamond Upgrade 10 - CellsBoost"],
            },
            {
                "id": "token-lane",
                "label": "Token prefab or title lane",
                "sourceIds": ["uabeaProbe", "unityProbe"],
                "terms": [
                    "NewTokenUPGPrefab.T1.CellsPerChestBooster",
                    "NewTokenUPGPrefab.T5.UltimaCells",
                    "Token Ultima: Cells",
                ],
            },
            {
                "id": "text-hooks",
                "label": "Generic TokenShop text-hook lane",
                "sourceIds": ["unityProbe"],
                "terms": ["SetAllTokenShopTexts", "SetTokenTexts"],
            },
        ],
        "bridgeCandidateTerms": [
            "NewDiamondUPGPrefab.Specials.CellsBoost",
            ">Diamond Upgrade 10 - CellsBoost",
            "NewTokenUPGPrefab.T1.CellsPerChestBooster",
            "NewTokenUPGPrefab.T5.UltimaCells",
            "Token Ultima: Cells",
        ],
        "lostStructure": [
            "The shell-side owner window survives only in the TokenShop extract, where ATU3Button path id 15810 stays adjacent to the CellBoost owner block.",
            "The metadata neighborhood still proves ATU3Button and CellBoost live in one raw declaration area, but it does not keep one checked prefab identity or final title in the same local container.",
            "The action lane survives only as a generic named buy cluster in the daily-tokenium lane probe, with StartCellBostHold, StopCellBostHold, and BuyCellBoost but no shell-side path id.",
            "Prefab identities survive as detached UABEA, targeted-string, or unity-probe hits, and final titles survive as separate unity-probe buckets, so the current extraction still loses the direct cross-surface join back to 15810.",
        ],
        "groundedConclusion": "The ATU3Button or 15810 trace stays negative. The trace workflow now preserves shell, metadata, action-hook, prefab, title, and text-hook surfaces in one checked bundle, but no committed source carries one exact ATU3Button or path id 15810 bridge together with one exact prefab identity or final player-facing title.",
    }
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_strings(blob: bytes) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for match in ASCII_RE.finditer(blob):
        entries.append({"offset": match.start(), "encoding": "ascii", "value": match.group().decode("ascii", errors="ignore")})
    for match in UTF16_RE.finditer(blob):
        entries.append({"offset": match.start(), "encoding": "utf16le", "value": match.group().decode("utf-16le", errors="ignore")})
    return sorted(entries, key=lambda entry: int(entry["offset"]))


def collect_metadata_hits(terms: list[str], context: int = 8) -> list[dict[str, Any]]:
    entries = extract_strings(METADATA_PATH.read_bytes())
    hits: list[dict[str, Any]] = []
    lower_terms = [term.lower() for term in terms]
    for index, entry in enumerate(entries):
        value = str(entry["value"])
        matched = [terms[position] for position, lower in enumerate(lower_terms) if lower in value.lower()]
        if not matched:
            continue
        start = max(index - context, 0)
        end = min(index + context + 1, len(entries))
        hits.append(
            {
                "term": value,
                "matchedTerms": matched,
                "offset": entry["offset"],
                "context": entries[start:end],
            }
        )
        if len(hits) >= 8:
            break
    return hits


def path_to_string(path_parts: list[str | int]) -> str:
    output = "$"
    for part in path_parts:
        output += f"[{part}]" if isinstance(part, int) else f".{part}"
    return output


def is_scalar(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool)) or value is None


def summarize_parent(parent: Any, key_or_index: str | int) -> dict[str, Any]:
    if isinstance(parent, dict):
        scalars = []
        for sibling_key, sibling_value in parent.items():
            if len(scalars) >= 8:
                break
            if is_scalar(sibling_value):
                scalars.append({"key": sibling_key, "value": sibling_value})
        return {"containerType": "object", "matchedKey": key_or_index, "scalarEntries": scalars}
    if isinstance(parent, list) and isinstance(key_or_index, int):
        window = []
        for index in range(max(0, key_or_index - 3), min(len(parent), key_or_index + 4)):
            value = parent[index]
            if is_scalar(value):
                window.append({"index": index, "value": value})
        return {"containerType": "array", "matchedIndex": key_or_index, "nearbyScalarValues": window}
    return {"containerType": type(parent).__name__}


def walk_json(value: Any, path_parts: list[str | int], parent: Any, key_or_index: str | int | None, exact_terms: set[str], hits: list[dict[str, Any]]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            walk_json(child, [*path_parts, key], value, key, exact_terms, hits)
        return
    if isinstance(value, list):
        for index, child in enumerate(value):
            walk_json(child, [*path_parts, index], value, index, exact_terms, hits)
        return
    if not isinstance(value, str) and not isinstance(value, int):
        return
    if str(value) not in exact_terms:
        return
    hits.append(
        {
            "term": str(value),
            "jsonPath": path_to_string(path_parts),
            "containerSummary": summarize_parent(parent, key_or_index) if parent is not None else None,
        }
    )


def collect_exact_hits(document: Any, terms: list[str], max_hits_per_term: int = 4) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    walk_json(document, [], None, None, set(terms), hits)
    counts: dict[str, int] = {}
    filtered: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for hit in hits:
        identity = (hit["term"], hit["jsonPath"])
        if identity in seen:
            continue
        seen.add(identity)
        counts.setdefault(hit["term"], 0)
        if counts[hit["term"]] >= max_hits_per_term:
            continue
        counts[hit["term"]] += 1
        filtered.append(hit)
    return filtered


def get_shell_window(token_shop_extract: dict[str, Any], shell_field: str, radius: int) -> dict[str, Any]:
    fields = list(token_shop_extract.get("fields", []))
    shell_index = next(index for index, field in enumerate(fields) if field.get("field") == shell_field)
    shell_entry = fields[shell_index]
    window = []
    for field in fields[max(0, shell_index - radius): min(len(fields), shell_index + radius + 1)]:
        compact = {"field": field.get("field"), "group": field.get("group"), "kind": field.get("kind")}
        if "object_offset" in field:
            compact["objectOffset"] = field.get("object_offset")
        if "path_id" in field:
            compact["pathId"] = field.get("path_id")
        if "value" in field and is_scalar(field.get("value")):
            compact["value"] = field.get("value")
        window.append(compact)
    return {
        "source": repo_relative(SOURCE_PATHS["tokenShopExtract"]),
        "shellField": shell_entry.get("field"),
        "shellPathId": shell_entry.get("path_id"),
        "shellObjectOffset": shell_entry.get("object_offset"),
        "ownerFieldBlock": [entry.get("field") for entry in fields[max(0, shell_index - 5):shell_index]],
        "window": window,
    }


def collect_source_hits(documents: dict[str, Any], source_id: str, terms: list[str]) -> dict[str, Any]:
    if source_id == "metadata":
        hits = collect_metadata_hits(terms)
        return {
            "sourceId": source_id,
            "sourcePath": repo_relative(SOURCE_PATHS[source_id]),
            "hitCount": len(hits),
            "hits": hits,
        }
    hits = collect_exact_hits(documents[source_id], terms)
    return {
        "sourceId": source_id,
        "sourcePath": repo_relative(SOURCE_PATHS[source_id]),
        "hitCount": len(hits),
        "hits": hits,
    }


def has_exact_bridge(shell_window: dict[str, Any], surfaces: list[dict[str, Any]], candidate_terms: list[str]) -> tuple[bool, list[dict[str, Any]]]:
    shell_signatures = {str(shell_window["shellField"]), str(shell_window["shellPathId"])}
    bridge_hits: list[dict[str, Any]] = []
    for surface in surfaces:
        for source_entry in surface["sources"]:
            for hit in source_entry["hits"]:
                text = json.dumps(hit, sort_keys=True)
                if any(signature in text for signature in shell_signatures) and any(term in text for term in candidate_terms):
                    bridge_hits.append(
                        {
                            "surfaceId": surface["id"],
                            "sourcePath": source_entry["sourcePath"],
                            "term": hit["term"],
                        }
                    )
    return len(bridge_hits) > 0, bridge_hits


def build_dataset(target_id: str, extra_anchors: list[str]) -> dict[str, Any]:
    target = TRACE_TARGETS[target_id]
    anchors = list(dict.fromkeys([*target["anchors"], *extra_anchors]))
    documents = {source_id: load_json(path) for source_id, path in SOURCE_PATHS.items() if source_id != "metadata"}
    shell_window = get_shell_window(documents["tokenShopExtract"], target["shellField"], target["shellWindowRadius"])

    surfaces = []
    for surface in target["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "sources": [collect_source_hits(documents, source_id, terms) for source_id in surface["sourceIds"]],
            }
        )

    bridge_cleared, bridge_hits = has_exact_bridge(shell_window, surfaces, target["bridgeCandidateTerms"])
    return {
        "dataset": "unity-trace-bundle",
        "generatedAt": str(date.today()),
        "traceWorkflow": {
            "command": "node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>",
            "acceptedAnchors": ["class", "method", "string", "path id"],
            "targetResolution": "checked repo-local target preset plus anchor list",
            "readsCommittedSourcesOnly": True,
        },
        "sources": {source_id: repo_relative(path) for source_id, path in SOURCE_PATHS.items()},
        "sourceRoles": [
            {
                "sourceId": "metadata",
                "path": repo_relative(SOURCE_PATHS["metadata"]),
                "role": "Preserves raw declaration-side string neighborhoods from global-metadata.dat.",
            },
            {
                "sourceId": "tokenShopExtract",
                "path": repo_relative(SOURCE_PATHS["tokenShopExtract"]),
                "role": "Preserves exact owner-payload shell windows and path ids recovered from the TokenShop parser.",
            },
            {
                "sourceId": "dailyTokeniumLaneProbe",
                "path": repo_relative(SOURCE_PATHS["dailyTokeniumLaneProbe"]),
                "role": "Preserves named action-hook neighborhoods from the committed targeted string probe outputs.",
            },
            {
                "sourceId": "uabeaProbe",
                "path": repo_relative(SOURCE_PATHS["uabeaProbe"]),
                "role": "Preserves UABEA or CifiAssetProbe object and type output such as named prefab identities.",
            },
            {
                "sourceId": "unityProbe",
                "path": repo_relative(SOURCE_PATHS["unityProbe"]),
                "role": "Preserves broader committed unity string buckets including title or text-hook surfaces.",
            },
            {
                "sourceId": "lm244TargetedProbe",
                "path": repo_relative(SOURCE_PATHS["lm244TargetedProbe"]),
                "role": "Preserves targeted string-hit neighborhoods from the local lm244 follow-up probe lane.",
            },
        ],
        "target": {
            "id": target_id,
            "label": target["label"],
            "anchors": anchors,
            "joinGoal": target["joinGoal"],
        },
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "bridgePromotionRule": "Only promote a remap or owner boundary when one committed artifact preserves an exact shell-side anchor together with one exact prefab identity or final player-facing title in the same local container.",
        "bridgeCheck": {
            "candidateTerms": target["bridgeCandidateTerms"],
            "bridgeCleared": bridge_cleared,
            "bridgeHits": bridge_hits,
            "result": "checked object-or-title bridge recovered" if bridge_cleared else "no checked object-or-title bridge recovered",
        },
        "lostStructure": target["lostStructure"],
        "groundedConclusion": target["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a remap promotion by itself.",
            "It keeps declaration anchors, owner-payload shells, action hooks, targeted string hits, and prefab or title surfaces in one checked artifact bundle so unresolved joins can be judged from one place.",
            "If no committed source preserves both the shell-side anchor and one exact prefab or title candidate in the same local container, the result stays negative and downstream boundaries should not advance.",
        ],
    }


def write_markdown(dataset: dict[str, Any]) -> None:
    lines = [
        "# Unity Trace Bundle",
        "",
        f"- Target: `{dataset['target']['id']}`",
        f"- Label: {dataset['target']['label']}",
        f"- Anchors: `{', '.join(dataset['target']['anchors'])}`",
        f"- Join goal: {dataset['target']['joinGoal']}",
        "",
        "## Workflow",
        "",
        f"- Command: `{dataset['traceWorkflow']['command']}`",
        "- Accepted anchor kinds: `class`, `method`, `string`, `path id`",
        "- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.",
        "",
        "## Source reads",
        "",
    ]
    for source_role in dataset["sourceRoles"]:
        lines.append(f"- `{source_role['sourceId']}`: {md_link(ROOT / source_role['path'])}")
        lines.append(f"  - {source_role['role']}")
    lines.extend([
        "",
        "## Shell window",
        "",
        f"- Shell field: `{dataset['shellWindow']['shellField']}`",
        f"- Shell path id: `{dataset['shellWindow']['shellPathId']}`",
        f"- Owner field block: `{', '.join(dataset['shellWindow']['ownerFieldBlock'])}`",
        "",
        "## Surface traces",
        "",
    ])
    for surface in dataset["surfaces"]:
        lines.append(f"### {surface['label']}")
        lines.append("")
        lines.append(f"- Search terms: `{', '.join(surface['terms'])}`")
        for source_entry in surface["sources"]:
            lines.append(f"- Source: {md_link(ROOT / source_entry['sourcePath'])} ({source_entry['hitCount']} hits)")
            for hit in source_entry["hits"]:
                if source_entry["sourceId"] == "metadata":
                    lines.append(f"  - `{hit['term']}` at metadata offset `{hit['offset']}`")
                else:
                    lines.append(f"  - `{hit['term']}` at `{hit['jsonPath']}`")
        lines.append("")
    lines.extend([
        "## Bridge check",
        "",
        f"- Result: `{dataset['bridgeCheck']['result']}`",
    ])
    if not dataset["bridgeCheck"]["bridgeHits"]:
        lines.append("- No committed source keeps the shell-side anchor and one exact prefab or title in the same local container.")
    lines.extend([
        "",
        "## Current loss",
        "",
    ])
    lines.extend(f"- {line}" for line in dataset["lostStructure"])
    lines.extend([
        "",
        "## Conclusion",
        "",
        f"- {dataset['groundedConclusion']}",
        "",
    ])
    MD_OUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, choices=sorted(TRACE_TARGETS.keys()))
    parser.add_argument("--anchor", action="append", default=[])
    parser.add_argument("--json-out", type=Path, default=JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=MD_OUT)
    args = parser.parse_args()
    dataset = build_dataset(args.target, args.anchor)
    args.json_out.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf-8")
    write_markdown(dataset)


if __name__ == "__main__":
    main()
