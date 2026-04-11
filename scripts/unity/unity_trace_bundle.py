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
REGISTRY_PATH = ROOT / "data" / "unity-trace-target-registry.json"
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"

ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")

ALL_SOURCE_PATHS = {
    "metadata": METADATA_PATH,
    "tokenShopExtract": ROOT / "data" / "token-shop-values.json",
    "tokenShopRowRemapBoundary": ROOT / "data" / "token-shop-row-remap-boundary.json",
    "dailyTokeniumLaneProbe": ROOT / "data" / "daily-tokenium-lane-probe.json",
    "uabeaProbe": ROOT / "data" / "uabea-probe-report.json",
    "unityProbe": ROOT / "data" / "unity-probe-report.json",
    "lm244TargetedProbe": ROOT / "data" / "lm244-targeted-probe.json",
    "shardCostModelBoundary": ROOT / "data" / "shard-cost-model-boundary.v1.json",
    "shardCostParameterProbe": ROOT / "data" / "shard-cost-parameter-probe.v1.json",
    "shardCostMethodProbe": ROOT / "data" / "shard-cost-method-probe.v1.json",
    "shardCostNativeProbe": ROOT / "data" / "shard-cost-native-probe.v1.json",
    "shardCostFormulaModel": ROOT / "data" / "shard-cost-formula-model.v1.json",
    "shardMilestoneSaveOwnerCandidates": ROOT / "data" / "shard-milestone-save-owner-candidates.v1.json",
    "multiverseMarketMemberBoundary": ROOT / "data" / "multiverse-market-market-member-boundary.json",
    "multiverseMarketSaveDataImportBoundary": ROOT / "data" / "multiverse-market-savedata-import-boundary.json",
    "multiverseMarketRangeBoundary": ROOT / "data" / "multiverse-market-range-boundary.json",
    "multiverseMarketRowTextCoverage": ROOT / "data" / "multiverse-market-row-text-coverage.json",
    "multiverseMarketActionShell": ROOT / "data" / "multiverse-market-action-shell.json",
}

SOURCE_ROLE_TEXT = {
    "metadata": "Preserves raw declaration-side string neighborhoods from global-metadata.dat.",
    "tokenShopExtract": "Preserves exact owner-payload shell windows and path ids recovered from the TokenShop parser.",
    "tokenShopRowRemapBoundary": "Preserves one already-cleared TokenShop row bridge and the checked blocked ATU3 comparison notes used for solved-vs-blocked diffing.",
    "dailyTokeniumLaneProbe": "Preserves named action-hook neighborhoods from the committed targeted string probe outputs.",
    "uabeaProbe": "Preserves UABEA or CifiAssetProbe object and type output such as named prefab identities or typed field tables.",
    "unityProbe": "Preserves broader committed unity string buckets including title or text-hook surfaces.",
    "lm244TargetedProbe": "Preserves targeted string-hit neighborhoods from the local lm244 follow-up probe lane.",
    "shardCostModelBoundary": "Preserves the grounded shard cost-model boundary around ShardUpgradeInfo, sampled get_SU* accessors, and the SU0 parameter shell.",
    "shardCostParameterProbe": "Preserves direct shard cost parameter offsets and field names recovered from committed APK/Unity evidence.",
    "shardCostMethodProbe": "Preserves the getter-family and helper-method structure for shard cost accessors.",
    "shardCostNativeProbe": "Preserves native getter field-read evidence tying get_SU* methods to specific shard cost parameters.",
    "shardCostFormulaModel": "Preserves the canonical shard-cost evaluator structure model and completion flags without claiming planner-safe closure.",
    "shardMilestoneSaveOwnerCandidates": "Preserves the still-blocked shard save-owner candidate narrowing used to keep structural cost work separate from save-side promotion.",
    "multiverseMarketMemberBoundary": "Preserves the checked PlayerProfileHandler.get_Market to MultiverseMarket accessor bridge and the exact SaveData owner boundary clues.",
    "multiverseMarketSaveDataImportBoundary": "Preserves the bounded compatibility-only Emporium import decision and the blocked canonical-import framing.",
    "multiverseMarketRangeBoundary": "Preserves the checked row-range overlap between validated Emporium rows and the wider IS* typed span.",
    "multiverseMarketRowTextCoverage": "Preserves the checked SetIS* cost-text coverage that anchors ordered row overlap without claiming full row identity recovery.",
    "multiverseMarketActionShell": "Preserves the checked BuyIS* action-shell coverage across the wider Emporium row family.",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_registry() -> dict[str, Any]:
    registry = load_json(REGISTRY_PATH)
    if registry.get("dataset") != "unity-trace-target-registry":
        raise ValueError("unity trace target registry dataset id drifted")
    return registry


def resolve_source_catalog(registry: dict[str, Any], family_ids: list[str]) -> tuple[dict[str, Path], list[dict[str, Any]]]:
    source_paths: dict[str, Path] = {}
    source_roles: list[dict[str, Any]] = []
    seen: set[str] = set()
    for family_id in family_ids:
        family = registry["sourceFamilies"][family_id]
        for source_id in family["sourceIds"]:
            if source_id in seen:
                continue
            seen.add(source_id)
            source_paths[source_id] = ALL_SOURCE_PATHS[source_id]
            source_roles.append(
                {
                    "sourceId": source_id,
                    "path": repo_relative(ALL_SOURCE_PATHS[source_id]),
                    "familyId": family_id,
                    "familyLabel": family["label"],
                    "role": SOURCE_ROLE_TEXT[source_id],
                }
            )
    return source_paths, source_roles


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
        "source": repo_relative(ALL_SOURCE_PATHS["tokenShopExtract"]),
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
            "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
            "hitCount": len(hits),
            "hits": hits,
        }
    hits = collect_exact_hits(documents[source_id], terms)
    return {
        "sourceId": source_id,
        "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
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
        "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
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
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
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


def make_surface_source(source_id: str, hits: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "sourceId": source_id,
        "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
        "hitCount": len(hits),
        "hits": hits,
    }


def make_surface_hit(term: str, json_path: str) -> dict[str, Any]:
    return {"term": term, "jsonPath": json_path}


def build_token_shop_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = []
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "sources": [collect_source_hits(documents, source_id, terms) for source_id in surface["sourceIds"]],
            }
        )
    bridge_cleared, bridge_hits = has_exact_bridge(shell_window, surfaces, config["bridgeCandidateTerms"])
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_trace_graph(shell_window, surfaces, documents["tokenShopRowRemapBoundary"]),
        "bridgePromotionRule": "Only promote a remap or owner boundary when one committed artifact preserves an exact shell-side anchor together with one exact prefab identity or final player-facing title in the same local container.",
        "bridgeCheck": {
            "candidateTerms": config["bridgeCandidateTerms"],
            "bridgeCleared": bridge_cleared,
            "bridgeHits": bridge_hits,
            "result": "checked object-or-title bridge recovered" if bridge_cleared else "no checked object-or-title bridge recovered",
        },
        "solvedVsBlockedDiff": build_solved_vs_blocked_diff(target_id, target, documents["tokenShopRowRemapBoundary"]),
        "lostStructure": config["lostStructure"],
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a remap promotion by itself.",
            "It now keeps declaration anchors, owner-payload shells, action hooks, targeted string hits, prefab or title surfaces, and explicit typed graph edges in one checked artifact bundle so unresolved joins can be judged from one place.",
            "The graph records both proved joins and negative joins, with provenance-strength tags and source citations for each claim.",
            "If no committed source preserves both the shell-side anchor and one exact prefab or title candidate in the same local container, the result stays negative and downstream boundaries should not advance.",
        ],
    }


def build_shard_cost_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    cost_model = documents["shardCostModelBoundary"]
    parameter_probe = documents["shardCostParameterProbe"]
    native_probe = documents["shardCostNativeProbe"]
    formula_model = documents["shardCostFormulaModel"]
    save_owner_candidates = documents["shardMilestoneSaveOwnerCandidates"]
    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["shardCostModelBoundary"]),
        "shellField": config["accessor"],
        "shellPathId": "runtime-getter",
        "shellObjectOffset": None,
        "ownerFieldBlock": config["parameterShell"],
        "window": [{"field": field, "group": "row0-parameter-shell", "kind": "field"} for field in config["parameterShell"]],
    }
    surfaces = [
        {
            "id": "cost-model-boundary",
            "label": "Shard cost-model boundary",
            "terms": anchors,
            "sources": [
                make_surface_source(
                    "shardCostModelBoundary",
                    [
                        make_surface_hit(config["ownerType"], "$.dataCarrier"),
                        make_surface_hit(config["accessor"], "$.sampleCostAccessorWindows[0].accessors[0]"),
                        *[make_surface_hit(field, "$.row0CostFields") for field in config["parameterShell"][:3]],
                    ],
                )
            ],
        },
        {
            "id": "native-getter",
            "label": "Shard native getter probe",
            "terms": [config["accessor"], *config["parameterShell"][:3]],
            "sources": [
                make_surface_source(
                    "shardCostNativeProbe",
                    [
                        make_surface_hit(config["accessor"], "$.rows[0].name"),
                        *[make_surface_hit(field, "$.rows[0].operandFieldNames") for field in native_probe["rows"][0]["operandFieldNames"]],
                    ],
                )
            ],
        },
        {
            "id": "formula-model",
            "label": "Shard formula model",
            "terms": ["GetShardCostList", "UpdateShardCostList", "MilestoneCostList"],
            "sources": [
                make_surface_source(
                    "shardCostFormulaModel",
                    [
                        make_surface_hit("GetShardCostList", "$.runtimeGetterRules.cacheLifecycle.listBuilderMethod"),
                        make_surface_hit("UpdateShardCostList", "$.runtimeGetterRules.cacheLifecycle.refreshMethod"),
                        make_surface_hit("MilestoneCostList", "$.runtimeGetterRules.cacheLifecycle.cacheField"),
                    ],
                )
            ],
        },
    ]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": {
            "nodes": [
                make_node("shard-owner", "owner-type", config["ownerType"], "present", "ShardUpgradeInfo remains the checked shard-local data carrier."),
                make_node("shard-getter", "getter", config["accessor"], "present", "The row0 shard cost accessor is preserved in committed structure probes."),
                make_node("shard-parameter-shell", "parameter-shell", ", ".join(config["parameterShell"]), "present", "The row0 shard parameter shell is preserved as direct field names."),
                make_node("shard-evaluator", "evaluator-structure", "deterministic evaluator structure", "present", "The canonical shard-cost structure model and deterministic evaluator exist."),
            ],
            "edges": [
                make_edge(
                    "shard-owner-to-getter",
                    "shard-owner",
                    "shard-getter",
                    "getter-family",
                    "present",
                    "direct",
                    "The cost-model boundary preserves get_SU0Cost on the ShardUpgradeInfo mechanic family.",
                    [
                        cite_row_boundary("shardCostModelBoundary", "$.dataCarrier", cost_model["dataCarrier"]),
                        cite_row_boundary("shardCostModelBoundary", "$.sampleCostAccessorWindows[0].accessors[0]", config["accessor"]),
                    ],
                ),
                make_edge(
                    "shard-getter-to-parameter-shell",
                    "shard-getter",
                    "shard-parameter-shell",
                    "getter-to-parameter-shell",
                    "present",
                    "direct",
                    "The checked shard boundary preserves the SU0 cost parameter shell beside get_SU0Cost.",
                    [
                        cite_row_boundary("shardCostModelBoundary", "$.row0CostFields", ", ".join(cost_model["row0CostFields"])),
                        cite_row_boundary("shardCostParameterProbe", "$.dataset", parameter_probe["dataset"]),
                    ],
                ),
                make_edge(
                    "shard-native-to-parameter-shell",
                    "shard-getter",
                    "shard-parameter-shell",
                    "native-parameter-read",
                    "present",
                    "direct",
                    "The native getter probe directly reads SU0StartCost, SU0CostExponent, and SU0GrowthExponent from the row0 getter body.",
                    [cite_row_boundary("shardCostNativeProbe", "$.rows[0].operandFieldNames", ", ".join(native_probe["rows"][0]["operandFieldNames"]))],
                ),
                make_edge(
                    "shard-parameter-shell-to-evaluator",
                    "shard-parameter-shell",
                    "shard-evaluator",
                    "deterministic-evaluator",
                    "present",
                    "supporting",
                    "The canonical shard-cost formula model and deterministic evaluator preserve the same getter family as a checked structural model.",
                    [
                        cite_row_boundary("shardCostFormulaModel", "$.completionFlags.canonicalDatasetShipped", str(formula_model["completionFlags"]["canonicalDatasetShipped"])),
                        cite_row_boundary("shardCostFormulaModel", "$.completionFlags.deterministicEvaluatorImplemented", str(formula_model["completionFlags"]["deterministicEvaluatorImplemented"])),
                    ],
                ),
            ],
            "negativeEdges": [
                make_edge("shard-missing-calibration", "shard-evaluator", "shard-evaluator", "automated-calibration-closure", "missing", "negative", "Automated calibration is not yet implemented, so the structural evaluator is not calibration-closed.", [cite_row_boundary("shardCostFormulaModel", "$.completionFlags.automatedCalibrationImplemented", str(formula_model["completionFlags"]["automatedCalibrationImplemented"]))]),
                make_edge("shard-missing-planner-safe-output", "shard-evaluator", "shard-evaluator", "planner-safe-cost-output", "missing", "negative", "Planner-safe shard cost output is still explicitly unapproved.", [cite_row_boundary("shardCostFormulaModel", "$.completionFlags.plannerSafeCostOutputApproved", str(formula_model["completionFlags"]["plannerSafeCostOutputApproved"]))]),
                make_edge("shard-missing-save-owner", "shard-owner", "shard-evaluator", "save-owner-recovery", "missing", "negative", "Shard save-owner recovery is still unresolved and must stay separate from the structural cost model.", [cite_row_boundary("shardMilestoneSaveOwnerCandidates", "$.warnings[0]", save_owner_candidates["warnings"][0])]),
            ],
            "claimLedger": [],
        },
        "bridgePromotionRule": "Only promote shard cost output past descriptive quarantine when calibration closure, planner-safe approval, and save-owner boundaries are all checked explicitly.",
        "bridgeCheck": {
            "candidateTerms": config["parameterShell"],
            "bridgeCleared": True,
            "bridgeHits": [{"surfaceId": "native-getter", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostNativeProbe"]), "term": config["accessor"]}],
            "result": "checked getter-to-parameter-shell structure recovered",
        },
        "solvedVsBlockedDiff": {
            "baseline": {"id": "shard-cost-su0-structure", "label": "Shard SU0 structural baseline", "status": "cleared", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostFormulaModel"]), "shellField": config["accessor"], "shellPathId": "runtime-getter", "comparisonShape": [{"type": "getter-family", "status": "present"}, {"type": "getter-to-parameter-shell", "status": "present"}, {"type": "native-parameter-read", "status": "present"}, {"type": "deterministic-evaluator", "status": "present"}], "groundedConclusion": "The shard SU0 getter-to-parameter-shell structure is grounded enough to preserve as a quarantined structural baseline."},
            "blockedTarget": {"id": "shard-cost-planner-safe-output", "label": "Shard planner-safe cost output", "status": "blocked", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostFormulaModel"]), "shellField": config["accessor"], "shellPathId": "planner-output", "comparisonShape": [{"type": "automated-calibration-closure", "status": "missing"}, {"type": "planner-safe-cost-output", "status": "missing"}, {"type": "save-owner-recovery", "status": "missing"}], "groundedConclusion": "The shard planner-safe output target remains blocked by calibration, approval, and save-owner recovery."},
            "delta": {
                "sharedPresentEdgeTypes": ["getter-family", "getter-to-parameter-shell", "native-parameter-read"],
                "baselineOnlyPresentEdgeTypes": ["deterministic-evaluator"],
                "blockedMissingEdgeTypes": ["automated-calibration-closure", "planner-safe-cost-output", "save-owner-recovery"],
                "solvedVsBlockedSummary": [
                    "The solved shard baseline preserves one direct getter-family, parameter-shell, and native-field-read chain.",
                    "The same family also preserves one deterministic evaluator structure model.",
                    "Planner-safe output stays blocked because calibration, approval, and save-owner recovery are still explicitly negative.",
                ],
            },
        },
        "lostStructure": [cost_model["optimizerBoundary"]["blockedNow"][0], cost_model["optimizerBoundary"]["blockedNow"][1], save_owner_candidates["warnings"][0]],
        "groundedConclusion": "The shard SU0 cost trace is structurally grounded. The repo preserves one checked getter-to-parameter-shell chain and one deterministic evaluator structure, but calibration closure, planner-safe cost output, and save-owner recovery all remain blocked.",
        "currentBoundary": [
            "This target preserves shard-cost structure only.",
            "It is appropriate for descriptive or quarantined structural reads, not planner-safe cost output or save-owner promotion.",
            "Keep shard cost structure separated from shard save-owner recovery until direct save-side evidence appears.",
        ],
    }


def build_multiverse_market_save_owner_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    member_boundary = documents["multiverseMarketMemberBoundary"]
    import_boundary = documents["multiverseMarketSaveDataImportBoundary"]
    range_boundary = documents["multiverseMarketRangeBoundary"]
    row_text_coverage = documents["multiverseMarketRowTextCoverage"]
    action_shell = documents["multiverseMarketActionShell"]
    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["multiverseMarketMemberBoundary"]),
        "shellField": config["accessorBridge"],
        "shellPathId": "typed-accessor",
        "shellObjectOffset": None,
        "ownerFieldBlock": [config["saveOwner"], config["typedSpan"], "InscryptionsDone"],
        "window": [
            {"field": "bridgeAccessor", "group": "typed-boundary", "kind": "method", "value": config["accessorBridge"]},
            {"field": "declaringOwner", "group": "typed-boundary", "kind": "type", "value": config["saveOwner"]},
            {"field": "typedSpan", "group": "typed-boundary", "kind": "field-range", "value": config["typedSpan"]},
        ],
    }
    surfaces = [
        {
            "id": "accessor-bridge",
            "label": "Accessor bridge",
            "terms": anchors,
            "sources": [
                make_surface_source(
                    "multiverseMarketMemberBoundary",
                    [
                        make_surface_hit("PlayerProfileHandler", "$.typedBridgeRecovery.bridgeOwner"),
                        make_surface_hit("get_Market", "$.typedBridgeRecovery.bridgeAccessor"),
                        make_surface_hit("MultiverseMarket", "$.typedBridgeRecovery.bridgeReturnType"),
                    ],
                )
            ],
        },
        {
            "id": "save-owner-span",
            "label": "SaveData owner span",
            "terms": [config["saveOwner"], config["typedSpan"], "InscryptionsDone"],
            "sources": [
                make_surface_source(
                    "multiverseMarketSaveDataImportBoundary",
                    [
                        make_surface_hit(config["saveOwner"], "$.typedSpanBoundary.declaringOwner"),
                        make_surface_hit(config["typedSpan"], "$.typedSpanBoundary.contiguousLevelSpan"),
                        make_surface_hit("compatibility.unmappedSystemState.multiverseMarket", "$.boundedImportConclusion.importTargetPath"),
                    ],
                )
            ],
        },
        {
            "id": "ordered-overlap",
            "label": "Ordered overlap",
            "terms": [str(item) for item in config["orderedOverlap"]],
            "sources": [
                make_surface_source("multiverseMarketRangeBoundary", [make_surface_hit(str(item), "$.overlapIds") for item in range_boundary["overlapIds"]]),
                make_surface_source("multiverseMarketRowTextCoverage", [make_surface_hit("SetIS71CostText", "$.validatedRowCostTexts")]),
                make_surface_source("multiverseMarketActionShell", [make_surface_hit("BuyIS71", "$.validatedBuyHooks")]),
            ],
        },
    ]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": {
            "nodes": [
                make_node("market-accessor", "accessor-bridge", config["accessorBridge"], "present", "The checked PlayerProfileHandler.get_Market accessor bridge is preserved."),
                make_node("market-owner", "declaring-owner", config["saveOwner"], "present", "SaveData remains the exact checked wider owner."),
                make_node("market-span", "typed-span", config["typedSpan"], "present", "The exact contiguous IS1Level through IS110Level span is preserved."),
                make_node("market-import", "compatibility-import", "compatibility.unmappedSystemState.multiverseMarket", "present", "The compatibility-only import target is preserved."),
            ],
            "edges": [
                make_edge("market-accessor-to-owner", "market-accessor", "market-owner", "accessor-bridge", "present", "direct", "The checked accessor bridge still leads from PlayerProfileHandler.get_Market to MultiverseMarket while wider typed ownership stays on SaveData.", [cite_row_boundary("multiverseMarketMemberBoundary", "$.typedBridgeRecovery.bridgeAccessor", member_boundary["typedBridgeRecovery"]["bridgeAccessor"]), cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.typedSpanBoundary.declaringOwner", import_boundary["typedSpanBoundary"]["declaringOwner"])]),
                make_edge("market-owner-to-span", "market-owner", "market-span", "typed-save-owner", "present", "direct", "SaveData directly preserves the contiguous IS1Level through IS110Level span.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.typedSpanBoundary.contiguousLevelSpan", import_boundary["typedSpanBoundary"]["contiguousLevelSpan"])]),
                make_edge("market-span-to-import", "market-span", "market-import", "compatibility-import-span", "present", "supporting", "The exact IS span is preserved as compatibility-only raw Emporium truth, not canonical PlayerProfile import.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.boundedImportConclusion.importTargetPath", import_boundary["boundedImportConclusion"]["importTargetPath"])]),
                make_edge("market-overlap-support", "market-span", "market-import", "ordered-row-overlap", "present", "supporting", "Rows 71-74 still anchor the wider IS span to checked Emporium ordering and cost-text/action surfaces.", [cite_row_boundary("multiverseMarketRangeBoundary", "$.overlapIds", ", ".join(str(item) for item in range_boundary["overlapIds"])), cite_row_boundary("multiverseMarketRowTextCoverage", "$.validatedRowCostTexts", "SetIS71CostText"), cite_row_boundary("multiverseMarketActionShell", "$.validatedBuyHooks", "BuyIS71")]),
            ],
            "negativeEdges": [
                make_edge("market-missing-typed-market-field", "market-accessor", "market-owner", "typed-market-field-recovery", "missing", "negative", "No typed Market or MultiverseMarket field is recovered directly on PlayerProfileHandler, PlayerProfileData, or SaveData.", [cite_row_boundary("multiverseMarketMemberBoundary", "$.negativeTypedSaveDataMarketChecks", ", ".join(member_boundary["negativeTypedSaveDataMarketChecks"]))]),
                make_edge("market-missing-canonical-import", "market-span", "market-import", "canonical-import-admissibility", "missing", "negative", "Canonical import remains explicitly empty even though the compatibility-only import target is preserved.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.boundedImportConclusion.exactCanonicalImportSafeSubsetLabel", import_boundary["boundedImportConclusion"]["exactCanonicalImportSafeSubsetLabel"])]),
                make_edge("market-missing-broad-row-remap", "market-span", "market-import", "broad-row-identity-remap", "missing", "negative", "Broader row identity or remap stays blocked outside the checked 71-74 ordered overlap.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.checkedIsToRowOrderBoundary.blockedWiderMapping[0]", import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][0])]),
            ],
            "claimLedger": [],
        },
        "bridgePromotionRule": "Only promote the Emporium save-owner boundary past compatibility quarantine when canonical import admissibility and broader row identity are both checked explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["accessorBridge"], config["saveOwner"], config["typedSpan"]],
            "bridgeCleared": True,
            "bridgeHits": [{"surfaceId": "accessor-bridge", "sourcePath": repo_relative(ALL_SOURCE_PATHS["multiverseMarketMemberBoundary"]), "term": config["accessorBridge"]}],
            "result": "checked accessor-to-save-owner boundary recovered",
        },
        "solvedVsBlockedDiff": {
            "baseline": {"id": "multiverse-market-save-owner-boundary", "label": "Emporium save-owner boundary", "status": "cleared", "sourcePath": repo_relative(ALL_SOURCE_PATHS["multiverseMarketSaveDataImportBoundary"]), "shellField": config["accessorBridge"], "shellPathId": "typed-accessor", "comparisonShape": [{"type": "accessor-bridge", "status": "present"}, {"type": "typed-save-owner", "status": "present"}, {"type": "compatibility-import-span", "status": "present"}], "groundedConclusion": "The Emporium accessor-to-SaveData owner boundary is grounded enough to preserve as compatibility-only truth."},
            "blockedTarget": {"id": "multiverse-market-canonical-import", "label": "Emporium canonical import", "status": "blocked", "sourcePath": repo_relative(ALL_SOURCE_PATHS["multiverseMarketSaveDataImportBoundary"]), "shellField": config["saveOwner"], "shellPathId": "canonical-import", "comparisonShape": [{"type": "typed-market-field-recovery", "status": "missing"}, {"type": "canonical-import-admissibility", "status": "missing"}, {"type": "broad-row-identity-remap", "status": "missing"}], "groundedConclusion": "Canonical import remains blocked even though the wider save-owner boundary is grounded."},
            "delta": {
                "sharedPresentEdgeTypes": ["accessor-bridge", "typed-save-owner"],
                "baselineOnlyPresentEdgeTypes": ["compatibility-import-span"],
                "blockedMissingEdgeTypes": ["typed-market-field-recovery", "canonical-import-admissibility", "broad-row-identity-remap"],
                "solvedVsBlockedSummary": [
                    "The solved save-owner baseline preserves the typed accessor bridge and exact SaveData-owned IS span.",
                    "The same target also preserves one compatibility-only import span for quarantined state.",
                    "Canonical import stays blocked because typed Market field recovery, canonical admissibility, and broader row identity are still negative.",
                ],
            },
        },
        "lostStructure": [import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][0], import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][1], import_boundary["boundedImportConclusion"]["blockedBy"][2]],
        "groundedConclusion": "The multiverse-market save-owner trace is grounded enough to preserve a checked accessor-to-SaveData owner boundary and a compatibility-only IS1Level through IS110Level span, but canonical import and broader row identity remain blocked.",
        "currentBoundary": [
            "This target preserves save-owner and compatibility-import truth only.",
            "Do not promote canonical PlayerProfile import, planner behavior, or row remap claims from this target alone.",
            "Keep the checked accessor bridge, exact SaveData owner, and bounded compatibility-only import span separate from downstream row identity or planner work.",
        ],
    }


def build_trace_payload(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    strategy = target["strategy"]
    if strategy == "token-shop-atu3-cells":
        return build_token_shop_trace(target_id, target, anchors, documents)
    if strategy == "shard-cost-su0-structure":
        return build_shard_cost_trace(target, anchors, documents)
    if strategy == "multiverse-market-save-owner-boundary":
        return build_multiverse_market_save_owner_trace(target, anchors, documents)
    raise ValueError(f"Unsupported unity trace strategy: {strategy}")


def build_decision_summary(target: dict[str, Any], trace_payload: dict[str, Any]) -> dict[str, Any]:
    proved_edges = list(trace_payload["traceGraph"]["edges"])
    negative_edges = list(trace_payload["traceGraph"]["negativeEdges"])
    diff = trace_payload["solvedVsBlockedDiff"]["delta"]
    rules = target["outputSummaryRules"]
    negative_types = [edge["type"] for edge in negative_edges]
    wire = rules["wire"]
    quarantine = rules["quarantine"]
    if len(proved_edges) >= int(wire["minPresentEdges"]) and len(negative_edges) <= int(wire["maxNegativeEdges"]):
        verdict = "wire"
    elif len(proved_edges) >= int(quarantine["minPresentEdges"]) and all(edge_type in quarantine["allowedNegativeEdgeTypes"] for edge_type in negative_types):
        verdict = "quarantine"
    else:
        verdict = "keep researching"
    return {
        "verdict": verdict,
        "summary": rules["messages"]["research" if verdict == "keep researching" else verdict],
        "provedEdgeCount": len(proved_edges),
        "negativeEdgeCount": len(negative_edges),
        "baselineGap": diff["blockedMissingEdgeTypes"],
        "supportingEdgeTypes": [edge["type"] for edge in proved_edges],
        "blockedEdgeTypes": negative_types,
    }


def build_dataset(target_id: str, extra_anchors: list[str]) -> dict[str, Any]:
    registry = load_registry()
    target = registry["targets"][target_id]
    anchors = list(dict.fromkeys([*target["defaultAnchors"], *extra_anchors]))
    source_paths, source_roles = resolve_source_catalog(registry, target["requiredSourceFamilies"])
    documents = {source_id: load_json(path) for source_id, path in source_paths.items() if source_id != "metadata"}
    trace_payload = build_trace_payload(target_id, target, anchors, documents)
    return {
        "dataset": "unity-trace-bundle",
        "generatedAt": str(date.today()),
        "traceWorkflow": {
            "command": "node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>",
            "acceptedAnchors": target["acceptedAnchors"],
            "targetResolution": "checked repo-local target preset plus anchor list",
            "readsCommittedSourcesOnly": True,
        },
        "traceRegistry": {
            "path": repo_relative(REGISTRY_PATH),
            "selectedTargetId": target_id,
            "selectedFamilyId": target["familyId"],
            "requiredSourceFamilies": target["requiredSourceFamilies"],
            "solvedBaselineTargetId": target["solvedBaselineTargetId"],
            "blockedTargetId": target["blockedTargetId"],
            "comparisonPreset": registry["comparisonPresets"][target["comparisonPresetId"]],
        },
        "sources": {source_id: repo_relative(path) for source_id, path in source_paths.items()},
        "sourceRoles": source_roles,
        "target": {
            "id": target_id,
            "label": target["label"],
            "familyId": target["familyId"],
            "anchors": anchors,
            "joinGoal": target["joinGoal"],
            "requiredSourceFamilies": target["requiredSourceFamilies"],
            "solvedBaselineTargetId": target["solvedBaselineTargetId"],
            "blockedTargetId": target["blockedTargetId"],
        },
        "shellWindow": trace_payload["shellWindow"],
        "surfaces": trace_payload["surfaces"],
        "traceGraph": trace_payload["traceGraph"],
        "decisionSummary": build_decision_summary(target, trace_payload),
        "bridgePromotionRule": trace_payload["bridgePromotionRule"],
        "bridgeCheck": trace_payload["bridgeCheck"],
        "solvedVsBlockedDiff": trace_payload["solvedVsBlockedDiff"],
        "lostStructure": trace_payload["lostStructure"],
        "groundedConclusion": trace_payload["groundedConclusion"],
        "currentBoundary": trace_payload["currentBoundary"],
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
        f"- Accepted anchor kinds: `{', '.join(dataset['traceWorkflow']['acceptedAnchors'])}`",
        "- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.",
        f"- Registry target: `{dataset['traceRegistry']['selectedTargetId']}` from `{dataset['traceRegistry']['selectedFamilyId']}` via {md_link(ROOT / dataset['traceRegistry']['path'])}",
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
        "## Decision summary",
        "",
        f"- Verdict: `{dataset['decisionSummary']['verdict']}`",
        f"- Summary: {dataset['decisionSummary']['summary']}",
        f"- Proved edges: `{dataset['decisionSummary']['provedEdgeCount']}`",
        f"- Negative edges: `{dataset['decisionSummary']['negativeEdgeCount']}`",
        f"- Baseline gap: `{', '.join(dataset['decisionSummary']['baselineGap'])}`",
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
    registry = load_registry()
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True, choices=sorted(registry["targets"].keys()))
    parser.add_argument("--anchor", action="append", default=[])
    parser.add_argument("--json-out", type=Path, default=JSON_OUT)
    parser.add_argument("--md-out", type=Path, default=MD_OUT)
    args = parser.parse_args()
    dataset = build_dataset(args.target, args.anchor)
    args.json_out.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf-8")
    write_markdown(dataset)


if __name__ == "__main__":
    main()
