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
    "tokenShopRowRemapBoundary": ROOT / "data" / "token-shop-row-remap-boundary.json",
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


def find_surface(surfaces: list[dict[str, Any]], surface_id: str) -> dict[str, Any]:
    return next(surface for surface in surfaces if surface["id"] == surface_id)


def find_source_entry(surface: dict[str, Any], source_id: str) -> dict[str, Any]:
    return next(source for source in surface["sources"] if source["sourceId"] == source_id)


def find_hit(source_entry: dict[str, Any], term: str) -> dict[str, Any]:
    return next(hit for hit in source_entry["hits"] if hit["term"] == term)


def cite_hit(source_entry: dict[str, Any], hit: dict[str, Any], note: str | None = None) -> dict[str, Any]:
    locator = f"metadata offset {hit['offset']}" if source_entry["sourceId"] == "metadata" else hit["jsonPath"]
    citation = {
        "sourceId": source_entry["sourceId"],
        "sourcePath": source_entry["sourcePath"],
        "term": hit["term"],
        "locator": locator,
    }
    if note:
        citation["note"] = note
    return citation


def cite_row_boundary(source_id: str, path: str, detail: str, note: str | None = None) -> dict[str, Any]:
    citation = {
        "sourceId": source_id,
        "sourcePath": repo_relative(SOURCE_PATHS[source_id]),
        "term": detail,
        "locator": path,
    }
    if note:
        citation["note"] = note
    return citation


def make_node(node_id: str, node_type: str, label: str, status: str, summary: str) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": node_type,
        "label": label,
        "status": status,
        "summary": summary,
    }


def make_edge(
    edge_id: str,
    from_node: str,
    to_node: str,
    edge_type: str,
    status: str,
    provenance_strength: str,
    statement: str,
    proved_by: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "id": edge_id,
        "from": from_node,
        "to": to_node,
        "type": edge_type,
        "status": status,
        "provenanceStrength": provenance_strength,
        "statement": statement,
        "provedBy": proved_by,
    }


def build_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    diamond_surface = find_surface(surfaces, "diamond-special")
    token_surface = find_surface(surfaces, "token-lane")
    text_surface = find_surface(surfaces, "text-hooks")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "dailyTokeniumLaneProbe")
    unity_diamond_source = find_source_entry(diamond_surface, "unityProbe")
    unity_token_source = find_source_entry(token_surface, "unityProbe")
    uabea_token_source = find_source_entry(token_surface, "uabeaProbe")
    unity_text_source = find_source_entry(text_surface, "unityProbe")
    lm244_source = find_source_entry(diamond_surface, "lm244TargetedProbe")

    metadata_atu3_hit = find_hit(metadata_source, "ATU3Button")
    metadata_cell_hit = find_hit(metadata_source, "CellBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyCellBoost")
    diamond_prefab_hit = find_hit(unity_diamond_source, "NewDiamondUPGPrefab.Specials.CellsBoost")
    diamond_title_hit = find_hit(unity_diamond_source, ">Diamond Upgrade 10 - CellsBoost")
    token_prefab_hit = find_hit(uabea_token_source, "NewTokenUPGPrefab.T1.CellsPerChestBooster")
    token_prefab_alt_hit = find_hit(unity_token_source, "NewTokenUPGPrefab.T5.UltimaCells")
    token_title_hit = find_hit(unity_token_source, "Token Ultima: Cells")
    text_hook_hit = find_hit(unity_text_source, "SetAllTokenShopTexts")
    text_hook_alt_hit = find_hit(unity_text_source, "SetTokenTexts")

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "generic-action-hook"
    diamond_prefab_node = "diamond-special-prefab"
    diamond_title_node = "diamond-special-title"
    token_prefab_node = "token-prefab-candidates"
    token_title_node = "token-title-candidate"
    text_hook_node = "generic-text-hooks"

    nodes = [
        make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
        make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
        make_node(metadata_node, "metadata-neighborhood", "ATU3Button + CellBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and cells-family declaration area together."),
        make_node(action_node, "action-hook-cluster", "BuyCellBoost generic cells-domain action cluster", "present", "The committed lane probe keeps the generic buy hook but not an ATU3-specific exact join."),
        make_node(diamond_prefab_node, "prefab-candidate", "NewDiamondUPGPrefab.Specials.CellsBoost", "present", "A detached diamond-special prefab candidate is preserved."),
        make_node(diamond_title_node, "title-candidate", ">Diamond Upgrade 10 - CellsBoost", "present", "A detached diamond-special title candidate is preserved."),
        make_node(token_prefab_node, "prefab-candidate", "NewTokenUPGPrefab.T1.CellsPerChestBooster and NewTokenUPGPrefab.T5.UltimaCells", "present", "Detached token-side prefab candidates are preserved."),
        make_node(token_title_node, "title-candidate", "Token Ultima: Cells", "present", "A detached token-side title candidate is preserved."),
        make_node(text_hook_node, "text-hook-cluster", "SetAllTokenShopTexts / SetTokenTexts", "present", "The generic TokenShop text side is preserved as a separate surface."),
    ]

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract.",
            [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        ),
        make_edge(
            "owner-block-to-metadata",
            owner_node,
            metadata_node,
            "declaration-neighborhood",
            "present",
            "contextual",
            "The metadata neighborhood keeps ATU3Button and the CellBoost declaration block in one raw declaration area.",
            [
                cite_hit(metadata_source, metadata_cell_hit),
                cite_hit(metadata_source, metadata_atu3_hit),
            ],
        ),
        make_edge(
            "owner-block-to-action-cluster",
            owner_node,
            action_node,
            "family-action-cluster",
            "present",
            "supporting",
            "The cells-domain action lane preserves BuyCellBoost as the nearest named buy hook for the same family, but only as a generic cluster.",
            [cite_hit(action_source, action_buy_hit)],
        ),
        make_edge(
            "diamond-surface-prefab",
            metadata_node,
            diamond_prefab_node,
            "candidate-prefab-surface",
            "present",
            "direct",
            "A separate diamond-special CellsBoost prefab candidate is preserved on committed probe surfaces.",
            [
                cite_hit(unity_diamond_source, diamond_prefab_hit),
                cite_hit(lm244_source, find_hit(lm244_source, "NewDiamondUPGPrefab.Specials.CellsBoost")),
            ],
        ),
        make_edge(
            "diamond-surface-title",
            diamond_prefab_node,
            diamond_title_node,
            "candidate-title-surface",
            "present",
            "direct",
            "The same detached diamond-special surface also preserves one final title candidate.",
            [cite_hit(unity_diamond_source, diamond_title_hit)],
        ),
        make_edge(
            "token-surface-prefab",
            action_node,
            token_prefab_node,
            "candidate-prefab-surface",
            "present",
            "direct",
            "Separate token-side prefab identities for cells-domain upgrades are preserved, but not joined back to the target shell.",
            [
                cite_hit(uabea_token_source, token_prefab_hit),
                cite_hit(unity_token_source, token_prefab_alt_hit),
            ],
        ),
        make_edge(
            "token-surface-title",
            token_prefab_node,
            token_title_node,
            "candidate-title-surface",
            "present",
            "direct",
            "The token-side candidate surface also preserves one detached title clue.",
            [cite_hit(unity_token_source, token_title_hit)],
        ),
        make_edge(
            "text-hook-surface",
            action_node,
            text_hook_node,
            "generic-text-hook-cluster",
            "present",
            "supporting",
            "The generic TokenShop text hooks are preserved as a separate surface, but they do not close the ATU3 join.",
            [
                cite_hit(unity_text_source, text_hook_hit),
                cite_hit(unity_text_source, text_hook_alt_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-shell-to-exact-action",
            shell_node,
            action_node,
            "exact-shell-to-action-hook",
            "missing",
            "negative",
            "No committed source proves one ATU3-specific direct buy or effect hook; the nearest named action surface stays the generic BuyCellBoost cluster.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    "No checked repo artifact in this lane currently preserves an ATU3-specific effect hook.",
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    "No checked repo artifact in this lane currently preserves an ATU3-specific direct buy hook.",
                ),
            ],
        ),
        make_edge(
            "missing-shell-to-diamond-prefab",
            shell_node,
            diamond_prefab_node,
            "exact-shell-to-prefab",
            "missing",
            "negative",
            "No committed source proves that the ATU3 shell or path id 15810 crosses directly into the detached diamond-special CellsBoost prefab candidate.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.testedSurfaces[1].missingJoin",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["testedSurfaces"][1]["missingJoin"],
                )
            ],
        ),
        make_edge(
            "missing-shell-to-token-prefab",
            shell_node,
            token_prefab_node,
            "exact-shell-to-prefab",
            "missing",
            "negative",
            "No committed source proves that the ATU3 shell or path id 15810 crosses directly into one exact token-side prefab identity.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]["missingLinks"][2],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.testedSurfaces[2].missingJoin",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["testedSurfaces"][2]["missingJoin"],
                ),
            ],
        ),
        make_edge(
            "missing-shell-to-title",
            shell_node,
            token_title_node,
            "exact-shell-to-title",
            "missing",
            "negative",
            "No committed source proves one exact ATU3 shell-to-final-title join across either the diamond-special or token-side title candidates.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        ),
    ]

    claim_ledger = [
        {
            "id": "claim-shell-window",
            "status": "proved",
            "statement": "The exact ATU3 shell window exists in committed TokenShop data.",
            "edgeIds": ["shell-to-owner-block"],
            "provedBy": edges[0]["provedBy"],
        },
        {
            "id": "claim-metadata-neighborhood",
            "status": "proved",
            "statement": "The metadata neighborhood keeps ATU3Button in the same declaration area as the CellBoost family.",
            "edgeIds": ["owner-block-to-metadata"],
            "provedBy": edges[1]["provedBy"],
        },
        {
            "id": "claim-cells-action-cluster",
            "status": "proved",
            "statement": "The generic cells-domain action cluster preserves BuyCellBoost, but not as an exact ATU3-specific join.",
            "edgeIds": ["owner-block-to-action-cluster"],
            "provedBy": edges[2]["provedBy"],
        },
        {
            "id": "claim-detached-candidate-surfaces",
            "status": "proved",
            "statement": "Detached prefab, title, and text-hook candidate surfaces still exist on committed probes.",
            "edgeIds": ["diamond-surface-prefab", "diamond-surface-title", "token-surface-prefab", "token-surface-title", "text-hook-surface"],
            "provedBy": [citation for edge in edges[3:] for citation in edge["provedBy"]],
        },
        {
            "id": "claim-missing-bridge",
            "status": "missing",
            "statement": "The exact shell-to-action, shell-to-prefab, and shell-to-title joins required to clear the ATU3 bridge are still missing.",
            "edgeIds": [edge["id"] for edge in negative_edges],
            "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
        },
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": claim_ledger,
    }


def build_solved_vs_blocked_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU1Button sits directly after the TokenBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.recoveredAdditionalBridge.ownerFieldBlock",
                    ", ".join(baseline["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "supporting-effect-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one exact ATU1-specific effect hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.recoveredAdditionalBridge.supportingEffectHook",
                    baseline["supportingEffectHook"],
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one checked row-specific buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.recoveredAdditionalBridge.supportingActionHook",
                    baseline["supportingActionHook"],
                )
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.recoveredAdditionalBridge.prefabIdentity",
                    baseline["prefabIdentity"],
                )
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly beside the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-specific effect or buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    blocked["missingLinks"][0],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                ),
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-prefab identity join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    blocked["missingLinks"][2],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        },
    ]
    shared_present = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        }.intersection(
            {
                edge["type"]
                for edge in blocked_edges
                if edge["status"] == "present"
            }
        )
    )
    baseline_only = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        } - set(shared_present)
    )
    blocked_missing = [edge["type"] for edge in blocked_edges if edge["status"] == "missing"]

    return {
        "baseline": {
            "id": "atu1-checked-row-bridge",
            "label": "ATU1 checked row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both rows preserve the direct serialized shell-to-owner-block adjacency.",
                "The solved ATU1 baseline also preserves one exact row-specific effect hook, one checked row-specific buy hook, and one exact prefab identity.",
                "The blocked ATU3 target stays missing the exact shell-to-action-hook, shell-to-prefab, and shell-to-title joins, so the cells-domain clues remain split instead of forming one checked bridge.",
            ],
        },
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
    trace_graph = build_trace_graph(shell_window, surfaces, documents["tokenShopRowRemapBoundary"])
    solved_vs_blocked_diff = build_solved_vs_blocked_diff(target_id, target, documents["tokenShopRowRemapBoundary"])
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
                "sourceId": "tokenShopRowRemapBoundary",
                "path": repo_relative(SOURCE_PATHS["tokenShopRowRemapBoundary"]),
                "role": "Preserves one already-cleared TokenShop row bridge and the checked blocked ATU3 comparison notes used for solved-vs-blocked diffing.",
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
        "traceGraph": trace_graph,
        "bridgePromotionRule": "Only promote a remap or owner boundary when one committed artifact preserves an exact shell-side anchor together with one exact prefab identity or final player-facing title in the same local container.",
        "bridgeCheck": {
            "candidateTerms": target["bridgeCandidateTerms"],
            "bridgeCleared": bridge_cleared,
            "bridgeHits": bridge_hits,
            "result": "checked object-or-title bridge recovered" if bridge_cleared else "no checked object-or-title bridge recovered",
        },
        "solvedVsBlockedDiff": solved_vs_blocked_diff,
        "lostStructure": target["lostStructure"],
        "groundedConclusion": target["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a remap promotion by itself.",
            "It now keeps declaration anchors, owner-payload shells, action hooks, targeted string hits, prefab or title surfaces, and explicit typed graph edges in one checked artifact bundle so unresolved joins can be judged from one place.",
            "The graph records both proved joins and negative joins, with provenance-strength tags and source citations for each claim.",
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
        "## Trace graph",
        "",
        f"- Present typed edges: `{len(dataset['traceGraph']['edges'])}`",
        f"- Negative typed edges: `{len(dataset['traceGraph']['negativeEdges'])}`",
        "",
        "### Proved joins",
        "",
    ])
    for edge in dataset["traceGraph"]["edges"]:
        lines.append(f"- `{edge['type']}`: {edge['statement']} [{edge['provenanceStrength']}]")
        for citation in edge["provedBy"]:
            lines.append(f"  - `{citation['sourceId']}` at `{citation['locator']}` proves `{citation['term']}`")
    lines.extend([
        "",
        "### Missing joins",
        "",
    ])
    for edge in dataset["traceGraph"]["negativeEdges"]:
        lines.append(f"- `{edge['type']}`: {edge['statement']} [{edge['provenanceStrength']}]")
        for citation in edge["provedBy"]:
            lines.append(f"  - `{citation['sourceId']}` at `{citation['locator']}` records `{citation['term']}`")
    lines.extend([
        "",
        "## Solved vs blocked",
        "",
        f"- Baseline: `{dataset['solvedVsBlockedDiff']['baseline']['shellField']}` path id `{dataset['solvedVsBlockedDiff']['baseline']['shellPathId']}` stays cleared as the comparison shape.",
        f"- Blocked target: `{dataset['solvedVsBlockedDiff']['blockedTarget']['shellField']}` path id `{dataset['solvedVsBlockedDiff']['blockedTarget']['shellPathId']}` stays blocked.",
        f"- Shared present edge types: `{', '.join(dataset['solvedVsBlockedDiff']['delta']['sharedPresentEdgeTypes'])}`",
        f"- Baseline-only present edge types: `{', '.join(dataset['solvedVsBlockedDiff']['delta']['baselineOnlyPresentEdgeTypes'])}`",
        f"- Blocked missing edge types: `{', '.join(dataset['solvedVsBlockedDiff']['delta']['blockedMissingEdgeTypes'])}`",
        "",
    ])
    lines.extend(f"- {line}" for line in dataset["solvedVsBlockedDiff"]["delta"]["solvedVsBlockedSummary"])
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
