from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

from portable_paths import md_link, repo_relative


ROOT = Path(__file__).resolve().parents[2]
JSON_OUT = ROOT / "data" / "token-shop-remap-join-probe.json"
MD_OUT = ROOT / "docs" / "systems" / "spend" / "token-shop-remap-join-probe.md"

SOURCE_PATHS = {
    "tokenShopExtract": ROOT / "data" / "token-shop-values.json",
    "dailyTokeniumLaneProbe": ROOT / "data" / "daily-tokenium-lane-probe.json",
    "uabeaProbe": ROOT / "data" / "uabea-probe-report.json",
    "unityProbe": ROOT / "data" / "unity-probe-report.json",
    "lm244TargetedProbe": ROOT / "data" / "lm244-targeted-probe.json",
}

TARGETS = [
    {
        "id": "atu3-cells-domain",
        "label": "ATU3 cells-domain neighborhood",
        "shellField": "ATU3Button",
        "shellPathId": 15810,
        "shellWindowRadius": 3,
        "joinGoal": "Recover one checked ATU3Button or path id 15810 bridge to one exact prefab identity or final player-facing title.",
        "surfaceGroups": [
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
            "The shell-side owner window survives only in the TokenShop extract, where ATU3Button path id 15810 is still adjacent to the CellBoost owner block.",
            "The action lane survives only as a generic named buy cluster in the daily-tokenium lane probe, with StartCellBostHold, StopCellBostHold, and BuyCellBoost but no ATU3 shell reference.",
            "Prefab identities survive as detached probe hits in lm244-targeted or UABEA outputs, not as one checked object that still carries the ATU3 shell or path id.",
            "Final titles and generic text hooks survive as separate unity-probe string buckets, not as one checked title object that still carries the shell-side owner identity.",
        ],
        "groundedConclusion": "The upgraded ATU3 remap join probe stays negative. It now preserves the shell owner window, the BuyCellBoost action cluster, the diamond-special CellsBoost lane, the token-side CellsPerChestBooster or Token Ultima: Cells lane, and the generic TokenShop text-hook lane in one artifact family, but no committed source carries one exact ATU3Button or path id 15810 bridge together with one exact prefab identity or final player-facing title.",
    }
]


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def path_to_string(path_parts: list[str | int]) -> str:
    output = "$"
    for part in path_parts:
        if isinstance(part, int):
            output += f"[{part}]"
        else:
            output += f".{part}"
    return output


def is_scalar(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool)) or value is None


def summarize_parent(parent: Any, key_or_index: str | int) -> dict[str, Any]:
    if isinstance(parent, dict):
        scalar_items: list[dict[str, Any]] = []
        for sibling_key, sibling_value in parent.items():
            if len(scalar_items) >= 8:
                break
            if is_scalar(sibling_value):
                scalar_items.append({"key": sibling_key, "value": sibling_value})
        return {
            "containerType": "object",
            "matchedKey": key_or_index,
            "scalarEntries": scalar_items,
            "keys": list(parent.keys())[:12],
        }

    if isinstance(parent, list) and isinstance(key_or_index, int):
        window: list[dict[str, Any]] = []
        start = max(0, key_or_index - 3)
        end = min(len(parent), key_or_index + 4)
        for index in range(start, end):
            value = parent[index]
            if is_scalar(value):
                window.append({"index": index, "value": value})
        return {
            "containerType": "array",
            "matchedIndex": key_or_index,
            "length": len(parent),
            "nearbyScalarValues": window,
        }

    return {"containerType": type(parent).__name__}


def walk_json(
    value: Any,
    path_parts: list[str | int],
    parent: Any,
    key_or_index: str | int | None,
    exact_terms: set[str],
    hits: list[dict[str, Any]],
) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            walk_json(child, [*path_parts, key], value, key, exact_terms, hits)
        return

    if isinstance(value, list):
        for index, child in enumerate(value):
            walk_json(child, [*path_parts, index], value, index, exact_terms, hits)
        return

    if not isinstance(value, str):
        return

    if value not in exact_terms:
        return

    hits.append(
        {
            "term": value,
            "jsonPath": path_to_string(path_parts),
            "containerSummary": summarize_parent(parent, key_or_index) if parent is not None else None,
        }
    )


def collect_exact_hits(document: Any, terms: list[str], max_hits_per_term: int = 3) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    walk_json(document, [], None, None, set(terms), hits)

    counts: dict[str, int] = {}
    filtered: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for hit in hits:
        term = str(hit["term"])
        json_path = str(hit["jsonPath"])
        identity = (term, json_path)
        if identity in seen:
            continue
        seen.add(identity)
        counts.setdefault(term, 0)
        if counts[term] >= max_hits_per_term:
            continue
        counts[term] += 1
        filtered.append(hit)
    return filtered


def get_token_shop_shell_window(token_shop_extract: dict[str, Any], shell_field: str, radius: int) -> dict[str, Any]:
    fields = list(token_shop_extract.get("fields", []))
    shell_index = next(
        index for index, field in enumerate(fields)
        if field.get("field") == shell_field
    )
    shell_entry = fields[shell_index]
    window_start = max(0, shell_index - radius)
    window_end = min(len(fields), shell_index + radius + 1)
    window = []
    for field in fields[window_start:window_end]:
        compact = {
            "field": field.get("field"),
            "group": field.get("group"),
            "kind": field.get("kind"),
        }
        if "object_offset" in field:
            compact["objectOffset"] = field.get("object_offset")
        if "path_id" in field:
            compact["pathId"] = field.get("path_id")
        if "value" in field and is_scalar(field.get("value")):
            compact["value"] = field.get("value")
        window.append(compact)

    owner_field_block = [
        entry.get("field")
        for entry in fields[max(0, shell_index - 5):shell_index]
    ]

    return {
        "source": repo_relative(SOURCE_PATHS["tokenShopExtract"]),
        "shellField": shell_entry.get("field"),
        "shellPathId": shell_entry.get("path_id"),
        "shellObjectOffset": shell_entry.get("object_offset"),
        "ownerFieldBlock": owner_field_block,
        "window": window,
    }


def collect_surface_sources(documents: dict[str, Any], surface_group: dict[str, Any]) -> list[dict[str, Any]]:
    source_entries = []
    for source_id in surface_group["sourceIds"]:
        hits = collect_exact_hits(documents[source_id], surface_group["terms"])
        source_entries.append(
            {
                "sourceId": source_id,
                "sourcePath": repo_relative(SOURCE_PATHS[source_id]),
                "hitCount": len(hits),
                "hits": hits,
            }
        )
    return source_entries


def has_exact_bridge(shell_window: dict[str, Any], surfaces: list[dict[str, Any]], candidate_terms: list[str]) -> tuple[bool, list[dict[str, Any]]]:
    shell_signatures = {str(shell_window["shellField"]), str(shell_window["shellPathId"])}
    exact_bridge_hits: list[dict[str, Any]] = []

    for surface in surfaces:
        for source_entry in surface["sources"]:
            for hit in source_entry["hits"]:
                container_text = json.dumps(hit.get("containerSummary"), sort_keys=True)
                has_shell = any(signature in container_text for signature in shell_signatures)
                has_candidate = any(term in container_text for term in candidate_terms)
                if has_shell and has_candidate:
                    exact_bridge_hits.append(
                        {
                            "surfaceId": surface["id"],
                            "sourcePath": source_entry["sourcePath"],
                            "jsonPath": hit["jsonPath"],
                            "term": hit["term"],
                        }
                    )

    return (len(exact_bridge_hits) > 0, exact_bridge_hits)


def build_dataset() -> dict[str, Any]:
    documents = {source_id: load_json(path) for source_id, path in SOURCE_PATHS.items()}

    neighborhoods = []
    for target in TARGETS:
        shell_window = get_token_shop_shell_window(
            documents["tokenShopExtract"],
            target["shellField"],
            target["shellWindowRadius"],
        )

        surfaces = []
        for surface_group in target["surfaceGroups"]:
            surfaces.append(
                {
                    "id": surface_group["id"],
                    "label": surface_group["label"],
                    "searchTerms": surface_group["terms"],
                    "sources": collect_surface_sources(documents, surface_group),
                }
            )

        bridge_cleared, bridge_hits = has_exact_bridge(shell_window, surfaces, target["bridgeCandidateTerms"])
        neighborhoods.append(
            {
                "id": target["id"],
                "label": target["label"],
                "joinGoal": target["joinGoal"],
                "shellWindow": shell_window,
                "surfaces": surfaces,
                "bridgePromotionRule": "Only promote a remap boundary when one committed artifact preserves an exact ATU shell field or shell path id together with one exact prefab identity or final player-facing title in the same local container.",
                "bridgeCheck": {
                    "candidateTerms": target["bridgeCandidateTerms"],
                    "bridgeCleared": bridge_cleared,
                    "bridgeHits": bridge_hits,
                    "result": "checked object-or-title bridge recovered" if bridge_cleared else "no checked object-or-title bridge recovered",
                },
                "lostStructure": target["lostStructure"],
                "groundedConclusion": target["groundedConclusion"],
            }
        )

    return {
        "dataset": "token-shop-remap-join-probe",
        "generatedAt": str(date.today()),
        "probeMethod": {
            "command": "node scripts/unity/run_probe.mjs token-shop:remap-joins",
            "purpose": "Preserve unresolved TokenShop remap shell neighborhoods and their split action, prefab, and title surfaces in one repeatable artifact family before any boundary promotion.",
            "readsCommittedSourcesOnly": True,
        },
        "sources": {
            source_id: repo_relative(path)
            for source_id, path in SOURCE_PATHS.items()
        },
        "sourceRoles": [
            {
                "sourceId": "tokenShopExtract",
                "path": repo_relative(SOURCE_PATHS["tokenShopExtract"]),
                "role": "Preserves the shell-local TokenShop owner window and exact shell path ids from the raw serialized extract.",
            },
            {
                "sourceId": "dailyTokeniumLaneProbe",
                "path": repo_relative(SOURCE_PATHS["dailyTokeniumLaneProbe"]),
                "role": "Preserves named buy-hook neighborhoods such as BuyCellBoost with nearby start or stop hold actions.",
            },
            {
                "sourceId": "uabeaProbe",
                "path": repo_relative(SOURCE_PATHS["uabeaProbe"]),
                "role": "Preserves direct type or object-name hits such as prefab identities without pretending they already join back to one shell.",
            },
            {
                "sourceId": "unityProbe",
                "path": repo_relative(SOURCE_PATHS["unityProbe"]),
                "role": "Preserves level0-side title, text-hook, and prefab string surfaces that can be compared against shell-local owners.",
            },
            {
                "sourceId": "lm244TargetedProbe",
                "path": repo_relative(SOURCE_PATHS["lm244TargetedProbe"]),
                "role": "Preserves targeted level0 string-hit neighborhoods for specific unresolved TokenShop follow-up terms.",
            },
        ],
        "neighborhoods": neighborhoods,
        "currentBoundary": [
            "This probe is a join-preservation surface, not a remap promotion by itself.",
            "It is meant to keep exact shell ids, nearby action hooks, prefab identities, and final title or text surfaces in one generated artifact family so unresolved shells can be rechecked without restitching evidence by hand.",
            "If no single committed source preserves both the shell-side identity and one exact prefab or title candidate in the same local container, the result stays negative and the TokenShop remap boundary should not advance.",
        ],
    }


def write_markdown(dataset: dict[str, Any]) -> None:
    lines = [
        "# TokenShop Remap Join Probe",
        "",
        "This probe preserves unresolved TokenShop remap join attempts in one generated artifact family.",
        "",
        "## Source reads",
        "",
    ]

    for source_role in dataset["sourceRoles"]:
        lines.append(f"- `{source_role['sourceId']}`: {md_link(ROOT / source_role['path'])}")
        lines.append(f"  - {source_role['role']}")

    lines.extend([
        "",
        "## Probe contract",
        "",
        f"- Command: `{dataset['probeMethod']['command']}`",
        f"- Purpose: {dataset['probeMethod']['purpose']}",
        "- Promotion rule: only advance a remap boundary when one committed artifact preserves an exact shell id together with one exact prefab identity or final title in the same local container.",
        "",
    ])

    for neighborhood in dataset["neighborhoods"]:
        lines.extend([
            f"## {neighborhood['label']}",
            "",
            f"- Join goal: {neighborhood['joinGoal']}",
            f"- Shell source: {md_link(ROOT / neighborhood['shellWindow']['source'])}",
            f"- Shell field: `{neighborhood['shellWindow']['shellField']}`",
            f"- Shell path id: `{neighborhood['shellWindow']['shellPathId']}`",
            f"- Owner field block: `{', '.join(neighborhood['shellWindow']['ownerFieldBlock'])}`",
            "- Shell window:",
        ])
        for entry in neighborhood["shellWindow"]["window"]:
            detail = f"`{entry['field']}`"
            if entry.get("pathId") is not None:
                detail += f" path `{entry['pathId']}`"
            if entry.get("value") is not None:
                detail += f" value `{entry['value']}`"
            lines.append(f"  - {detail}")

        lines.extend([
            "",
            "### Preserved split surfaces",
            "",
        ])
        for surface in neighborhood["surfaces"]:
            lines.append(f"- `{surface['label']}`")
            lines.append(f"  - Search terms: `{', '.join(surface['searchTerms'])}`")
            for source_entry in surface["sources"]:
                lines.append(f"  - Source: {md_link(ROOT / source_entry['sourcePath'])} ({source_entry['hitCount']} hits)")
                for hit in source_entry["hits"]:
                    lines.append(f"    - `{hit['term']}` at `{hit['jsonPath']}`")

        lines.extend([
            "",
            "### Bridge check",
            "",
            f"- Result: `{neighborhood['bridgeCheck']['result']}`",
        ])
        if neighborhood["bridgeCheck"]["bridgeHits"]:
            for hit in neighborhood["bridgeCheck"]["bridgeHits"]:
                lines.append(
                    f"- Preserved bridge hit: `{hit['term']}` in {md_link(ROOT / hit['sourcePath'])} at `{hit['jsonPath']}`"
                )
        else:
            lines.append("- No source currently keeps the shell-side identity and one exact prefab or title candidate in the same local container.")

        lines.extend([
            "",
            "### Current loss",
            "",
        ])
        lines.extend(f"- {line}" for line in neighborhood["lostStructure"])
        lines.extend([
            "",
            "### Conclusion",
            "",
            f"- {neighborhood['groundedConclusion']}",
            "",
        ])

    MD_OUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    dataset = build_dataset()
    JSON_OUT.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf-8")
    write_markdown(dataset)


if __name__ == "__main__":
    main()
