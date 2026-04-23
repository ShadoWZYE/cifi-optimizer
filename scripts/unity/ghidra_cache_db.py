#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[2]


DB_SCHEMA_VERSION = 7
SCHEMA_VERSION_FLOOR = 7

TRACE_FRAGMENT_TOP_LEVEL_KEYS = {
    "assetSet",
    "bridgePromotionRule",
    "depthExpansion",
    "depthSearch",
    "executionAnchors",
    "nativeReconstruction",
    "nativeTrace",
    "plannerResolution",
    "rowRecovery",
    "searchExpansion",
    "shellWindow",
    "sourceRoles",
    "sources",
    "surfaces",
    "target",
    "traceGraph",
    "traceParams",
    "traceRegistry",
    "traceWorkflow",
}

ASPECT_PRIORITIES = {
    "bridge_plan": 98,
    "native_search_attempt": 96,
    "native_signal_fragment": 94,
    "direct_functions": 100,
    "reference_functions": 95,
    "ascii_targets": 90,
    "managed_reconstruction": 88,
    "managed_graph_full": 88,
    "managed_graph_owner": 86,
    "managed_graph_edge": 86,
    "term_bridge_core": 84,
    "metadata_neighborhoods": 82,
    "expanded_function_matches": 80,
    "expanded_reference_matches": 80,
    "graph_backfill_link": 78,
    "metadata_context_fragment": 76,
    "owner_inference": 75,
    "sibling_cluster": 75,
    "owner_candidates": 74,
    "related_terms": 72,
    "fuzzy_functions": 65,
}

UNION_ASPECTS = {
    "native_search_attempt",
    "native_signal_fragment",
    "direct_functions",
    "fuzzy_functions",
    "reference_functions",
    "ascii_targets",
    "metadata_neighborhoods",
    "owner_candidates",
    "related_terms",
    "expanded_function_matches",
    "expanded_reference_matches",
    "managed_graph_owner",
    "managed_graph_edge",
    "graph_backfill_link",
    "metadata_context_fragment",
    "owner_inference",
    "sibling_cluster",
}

SINGLETON_ASPECTS = {
    "bridge_plan",
    "term_bridge_core",
    "managed_reconstruction",
    "managed_graph_full",
}

REPO_DATASET_REF_RE = re.compile(r"data/[A-Za-z0-9._/-]+\.json")
LEGACY_DATASET_MARKERS = (
    "-probe",
    "_probe",
    "extract-report",
    "savedata-import-boundary",
    "compatibility",
    ".v1.json",
)


def _collect_payload_provenance_signals(value: Any) -> dict[str, Any]:
    text = _payload_key(value)
    dataset_refs = sorted(set(REPO_DATASET_REF_RE.findall(text)))
    legacy_refs = [
        ref
        for ref in dataset_refs
        if any(marker in ref for marker in LEGACY_DATASET_MARKERS)
    ]
    compatibility_markers = sorted(
        {
            marker
            for marker in (
                "compatibility" if "compatibility" in text else None,
                "compatibility-only" if "compatibility-only" in text else None,
                "quarantine" if "quarantine" in text else None,
                "fallback" if "fallback" in text else None,
                "historical" if "historical" in text else None,
            )
            if marker
        }
    )
    risk_level = "db-native"
    if legacy_refs:
        risk_level = "legacy-support-influence"
    elif dataset_refs:
        risk_level = "repo-support-influence"
    return {
        "repoDatasetRefs": dataset_refs,
        "legacyDatasetRefs": legacy_refs,
        "compatibilityMarkers": compatibility_markers,
        "riskLevel": risk_level,
    }


def _load_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True)


def _json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _term_signature(search_terms: list[str]) -> str:
    return "\x1f".join(str(term).strip().lower() for term in search_terms if str(term).strip())


def _payload_key(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True, sort_keys=True)


def _dedupe_sequence(values: list[Any]) -> list[Any]:
    seen: set[str] = set()
    result: list[Any] = []
    for value in values:
        key = _payload_key(value)
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def _unique_strings(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        trimmed = str(value or "").strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        result.append(trimmed)
    return result


def _collect_semantic_scope_subject_terms(scope_payload: dict[str, Any]) -> list[str]:
    return _unique_strings(
        [
            str(scope_payload.get("scopeId") or ""),
            str(((scope_payload.get("rowShell") or {}).get("field") or "")),
            str((((scope_payload.get("rowShell") or {}).get("pathId")) or "")),
            str(((scope_payload.get("purchaseAction") or {}).get("term") or "")),
            str(scope_payload.get("sceneOwner") or ""),
            str(scope_payload.get("declaringField") or ""),
            str(scope_payload.get("runtimeShell") or ""),
            *[
                str(term)
                for term in (((scope_payload.get("purchaseAction") or {}).get("relatedTerms") or []))
            ],
            *[
                str(term)
                for term in (((scope_payload.get("displayUpdaters") or {}).get("primaryTerms") or []))
            ],
            *[
                str(term)
                for term in (((scope_payload.get("displayUpdaters") or {}).get("relatedTerms") or []))
            ],
            *[
                str(item.get("term") or "")
                for item in ((scope_payload.get("parameterShell") or []))
                if isinstance(item, dict)
            ],
        ]
    )


def _collect_resolution_terms_for_candidate(
    target: dict[str, Any],
    semantic_scope_payloads: list[dict[str, Any]],
    include_legacy_targets: bool = False,
) -> list[str]:
    terms = _unique_strings(
        [
            str(target.get("label") or ""),
            str(target.get("familyId") or ""),
        ]
    )
    if include_legacy_targets:
        terms.extend(
            _unique_strings(
                [
                    str(target.get("id") or ""),
                    str(target.get("traceScope") or ""),
                ]
            )
        )
    for scope_payload in semantic_scope_payloads:
        scope_terms = _collect_semantic_scope_subject_terms(scope_payload)
        terms.extend(scope_terms)
        terms.extend(
            _unique_strings(
                [
                    str(scope_payload.get("scopeType") or ""),
                    str(scope_payload.get("familyId") or ""),
                    str(scope_payload.get("targetId") or ""),
                    str(scope_payload.get("traceScope") or ""),
                ]
            )
        )
    return _unique_strings(terms)


def _collect_reconstruction_subject_terms(payload: dict[str, Any]) -> list[str]:
    row_shell = dict(payload.get("rowShell") or {})
    presentation = dict(payload.get("presentation") or {})
    return _unique_strings(
        [
            str(payload.get("semanticKey") or ""),
            str(payload.get("scopeType") or ""),
            str(payload.get("familyId") or ""),
            str(payload.get("traceScope") or ""),
            str(payload.get("targetId") or ""),
            str(row_shell.get("field") or ""),
            str(row_shell.get("pathId") or ""),
            *[str(role) for role in (presentation.get("slotRoles") or [])],
        ]
    )


def _collect_family_graph_subject_terms(payload: dict[str, Any]) -> list[str]:
    row_shells = list(payload.get("rowShells") or [])
    return _unique_strings(
        [
            str(payload.get("semanticKey") or ""),
            str(payload.get("scopeType") or ""),
            str(payload.get("familyId") or ""),
            str(payload.get("familyLabel") or ""),
            str(payload.get("traceScope") or ""),
            str(payload.get("targetId") or ""),
            *[
                str(item.get("field") or "")
                for item in row_shells
                if isinstance(item, dict)
            ],
            *[
                str(item.get("pathId") or "")
                for item in row_shells
                if isinstance(item, dict) and item.get("pathId") is not None
            ],
            *[str(term) for term in (payload.get("coreTerms") or [])],
            *[str(term) for term in (payload.get("supportingEdgeTypes") or [])],
        ]
    )


def _normalize_result_terms(result: dict[str, Any], search_terms: list[str]) -> list[str]:
    normalized = [str(term).strip() for term in search_terms if str(term).strip()]
    if normalized:
        return normalized
    explicit_terms = result.get("searchTerms") or result.get("search_strings") or []
    if isinstance(explicit_terms, list):
        normalized = [str(term).strip() for term in explicit_terms if str(term).strip()]
        if normalized:
            return normalized
    direct_terms = result.get("terms") or {}
    if isinstance(direct_terms, dict):
        normalized = [str(term).strip() for term in direct_terms.keys() if str(term).strip()]
        if normalized:
            return normalized
    bridges = result.get("termBridges") or {}
    if isinstance(bridges, dict):
        return [str(term).strip() for term in bridges.keys() if str(term).strip()]
    functions = result.get("functions") or {}
    if isinstance(functions, dict):
        return [str(term).strip() for term in functions.keys() if str(term).strip()]
    return []


def _rank_row(row: sqlite3.Row | dict[str, Any]) -> tuple[int, float, str, str]:
    reducer_priority = int(row["reducer_priority"] if isinstance(row, sqlite3.Row) else row.get("reducer_priority", 0) or 0)
    confidence = float(row["confidence"] if isinstance(row, sqlite3.Row) else row.get("confidence", 0.0) or 0.0)
    start_time = str(row["start_time"] if isinstance(row, sqlite3.Row) else row.get("start_time", "") or "")
    if isinstance(row, sqlite3.Row):
        row_id = row["evidence_id"] if "evidence_id" in row.keys() else row["fragment_id"] if "fragment_id" in row.keys() else ""
    else:
        row_id = row.get("evidence_id", "") or row.get("fragment_id", "") or ""
    return (reducer_priority, confidence, start_time, str(row_id))


def _merge_managed_reconstructions(payloads: list[dict[str, Any]]) -> dict[str, Any]:
    owners: list[str] = []
    methods: list[str] = []
    fields: list[str] = []
    raw_values: list[str] = []
    owner_to_terms: dict[str, dict[str, list[str]]] = {}
    scored_owners_by_name: dict[str, dict[str, Any]] = {}
    family_hint = None
    for payload in payloads:
        if not family_hint:
            family_hint = payload.get("familyHint")
        for value in payload.get("owners", []) or []:
            if value not in owners:
                owners.append(value)
        for value in payload.get("methods", []) or []:
            if value not in methods:
                methods.append(value)
        for value in payload.get("fields", []) or []:
            if value not in fields:
                fields.append(value)
        for value in payload.get("rawValueTerms", []) or []:
            if value not in raw_values:
                raw_values.append(value)
        for owner, bucket in (payload.get("ownerToTerms") or {}).items():
            target = owner_to_terms.setdefault(
                str(owner),
                {"methods": [], "fields": [], "rawValues": [], "relatedTerms": []},
            )
            for key in ("methods", "fields", "rawValues", "relatedTerms"):
                for item in bucket.get(key, []) or []:
                    if item not in target[key]:
                        target[key].append(item)
        for owner_entry in payload.get("scoredOwners", []) or []:
            owner = str(owner_entry.get("owner", "")).strip()
            if not owner:
                continue
            current = scored_owners_by_name.get(owner)
            if current is None:
                scored_owners_by_name[owner] = {
                    "owner": owner,
                    "score": int(owner_entry.get("score", 0) or 0),
                    "reasons": list(owner_entry.get("reasons", []) or []),
                    "methods": list(owner_entry.get("methods", []) or []),
                    "fields": list(owner_entry.get("fields", []) or []),
                    "rawValues": list(owner_entry.get("rawValues", []) or []),
                    "relatedTerms": list(owner_entry.get("relatedTerms", []) or []),
                }
                continue
            current["score"] = max(int(current.get("score", 0) or 0), int(owner_entry.get("score", 0) or 0))
            for key in ("reasons", "methods", "fields", "rawValues", "relatedTerms"):
                for item in owner_entry.get(key, []) or []:
                    if item not in current[key]:
                        current[key].append(item)
    scored_owners = sorted(
        scored_owners_by_name.values(),
        key=lambda item: (-int(item.get("score", 0) or 0), str(item.get("owner", "")).lower()),
    )
    return {
        "schemaVersion": SCHEMA_VERSION_FLOOR,
        "familyHint": family_hint,
        "owners": owners,
        "methods": methods,
        "fields": fields,
        "rawValueTerms": raw_values,
        "ownerToTerms": owner_to_terms,
        "scoredOwners": scored_owners,
    }


def _managed_owner_matches_family(owner: str, family_hint: str | None) -> bool:
    if not family_hint:
        return True
    lowered = owner.lower()
    if family_hint.startswith("shard"):
        return "shard" in lowered
    if family_hint == "token-shop":
        if any(noise in lowered for noise in ("tokenbank", "claimablebanktokens", "callback", "statemachine", "ugs")):
            return False
        return "tokenshop" in lowered or "arcade" in lowered or "atu" in lowered
    if family_hint.startswith("multiverse-market"):
        return "multiverse" in lowered or "market" in lowered or "inscryption" in lowered or "save" in lowered
    return True


def _prune_managed_reconstruction(payload: dict[str, Any]) -> dict[str, Any]:
    family_hint = str(payload.get("familyHint") or "").strip() or None
    if not family_hint:
        return payload
    owner_to_terms = dict(payload.get("ownerToTerms") or {})
    scored_owners = list(payload.get("scoredOwners") or [])
    allowed_owners = {
        str(entry.get("owner") or "")
        for entry in scored_owners
        if str(entry.get("owner") or "") and _managed_owner_matches_family(str(entry.get("owner") or ""), family_hint)
    }
    if not allowed_owners:
        return payload
    pruned_owner_to_terms = {
        owner: bucket
        for owner, bucket in owner_to_terms.items()
        if owner in allowed_owners
    }
    pruned_scored_owners = [
        entry for entry in scored_owners
        if str(entry.get("owner") or "") in allowed_owners
    ]
    pruned_scored_owners.sort(key=lambda item: (-int(item.get("score", 0) or 0), str(item.get("owner", "")).lower()))
    return {
        **payload,
        "owners": [owner for owner in (payload.get("owners") or []) if owner in allowed_owners],
        "ownerToTerms": pruned_owner_to_terms,
        "scoredOwners": pruned_scored_owners,
    }


def _merge_managed_graphs(payloads: list[dict[str, Any]]) -> dict[str, Any]:
    owners_by_name: dict[str, dict[str, Any]] = {}
    term_nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    orphan_methods: list[str] = []
    orphan_fields: list[str] = []
    orphan_raw_values: list[str] = []
    for payload in payloads:
        for owner_entry in payload.get("owners", []) or []:
            owner = str(owner_entry.get("owner", "")).strip()
            if not owner:
                continue
            current = owners_by_name.get(owner)
            if current is None:
                owners_by_name[owner] = {
                    "owner": owner,
                    "score": int(owner_entry.get("score", 0) or 0),
                    "methods": list(owner_entry.get("methods", []) or []),
                    "fields": list(owner_entry.get("fields", []) or []),
                    "rawValues": list(owner_entry.get("rawValues", []) or []),
                    "relatedTerms": list(owner_entry.get("relatedTerms", []) or []),
                }
                continue
            current["score"] = max(int(current.get("score", 0) or 0), int(owner_entry.get("score", 0) or 0))
            for key in ("methods", "fields", "rawValues", "relatedTerms"):
                for item in owner_entry.get(key, []) or []:
                    if item not in current[key]:
                        current[key].append(item)
        for node in payload.get("termNodes", []) or []:
            if node not in term_nodes:
                term_nodes.append(node)
        for edge in payload.get("edges", []) or []:
            if edge not in edges:
                edges.append(edge)
        for item in payload.get("orphanMethods", []) or []:
            if item not in orphan_methods:
                orphan_methods.append(item)
        for item in payload.get("orphanFields", []) or []:
            if item not in orphan_fields:
                orphan_fields.append(item)
        for item in payload.get("orphanRawValues", []) or []:
            if item not in orphan_raw_values:
                orphan_raw_values.append(item)
    owners = sorted(owners_by_name.values(), key=lambda item: (-int(item.get("score", 0) or 0), str(item.get("owner", "")).lower()))
    return {
        "schemaVersion": SCHEMA_VERSION_FLOOR,
        "owners": owners,
        "termNodes": term_nodes,
        "edges": edges,
        "orphanMethods": orphan_methods,
        "orphanFields": orphan_fields,
        "orphanRawValues": orphan_raw_values,
    }


def _prune_managed_graph(payload: dict[str, Any], family_hint: str | None, allowed_owners: set[str]) -> dict[str, Any]:
    if not family_hint or not allowed_owners:
        return payload
    owner_nodes = [
        entry for entry in (payload.get("owners") or [])
        if str(entry.get("owner") or "") in allowed_owners
    ]
    edges = []
    for edge in payload.get("edges", []) or []:
        source = str(edge.get("from") or "")
        edge_type = str(edge.get("type") or "")
        if edge_type in {"owns-method", "owns-field", "uses-raw-value", "related-term"} and source and source not in allowed_owners:
            continue
        edges.append(edge)
    return {
        **payload,
        "owners": owner_nodes,
        "edges": edges,
    }


SYSTEM_TRACE_FRAGMENT_KINDS = {
    "execution_context_fragment",
    "assessment_fragment",
    "target_narrative_fragment",
    "execution_plan_fragment",
    "surface_plan_fragment",
    "graph_plan_fragment",
    "bridge_policy_fragment",
    "family_graph_fragment",
    "formula_fragment",
    "threshold_fragment",
    "dependency_fragment",
    "ui_binding_fragment",
    "progression_fragment",
    "owner_controller_fragment",
    "runtime_table_fragment",
    "semantic_scope_fragment",
    "reconstruction_note_fragment",
}


def _support_metadata_from_rows(rows: list[sqlite3.Row]) -> dict[str, Any]:
    return {
        "supportingEvidenceCount": len(rows),
        "contributingTraceScopes": sorted({str(row["trace_scope"]) for row in rows}),
        "contributingTargets": sorted({str(row["trace_scope"]) for row in rows}),
        "contributingJobs": sorted({str(row["source_job_id"]) for row in rows if str(row["source_job_id"])}),
        "corroboratingFragmentIds": [int(row["fragment_id"]) for row in rows],
    }


def _merge_scalar_field(field_name: str, payloads: list[dict[str, Any]], conflicts: list[dict[str, Any]]) -> Any:
    values = []
    for payload in payloads:
        value = payload.get(field_name)
        if value is not None:
            values.append(value)
    if not values:
        return None
    first = values[0]
    unique = []
    for value in values:
        if value not in unique:
            unique.append(value)
    if len(unique) > 1:
        conflicts.append({"field": field_name, "values": unique})
    return first


def _reduce_formula_fragment(rows: list[sqlite3.Row]) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any], str]:
    ordered = sorted(rows, key=_rank_row, reverse=True)
    payloads = [_json_loads(row["payload_json"], {}) for row in ordered]
    conflicts: list[dict[str, Any]] = []
    grounded_constants: dict[str, Any] = {}
    constant_values: dict[str, list[Any]] = {}
    for payload in payloads:
        for key, value in (payload.get("groundedConstants") or {}).items():
            if value is None:
                continue
            constant_values.setdefault(str(key), [])
            if value not in constant_values[str(key)]:
                constant_values[str(key)].append(value)
    for key, values in constant_values.items():
        grounded_constants[key] = values[0]
        if len(values) > 1:
            conflicts.append({"field": f"groundedConstants.{key}", "values": values})
    canonical = {
        "semanticKey": str(payloads[0].get("semanticKey", "")),
        "familyId": str(payloads[0].get("familyId", "")),
        "recoveredFormulaFields": _dedupe_sequence([
            item
            for payload in payloads
            for item in (payload.get("recoveredFormulaFields") or [])
        ]),
        "groundedConstants": grounded_constants,
        "inferredCostModel": _merge_scalar_field("inferredCostModel", payloads, conflicts),
        "runtimeCostModel": _merge_scalar_field("runtimeCostModel", payloads, conflicts),
    }
    support = _support_metadata_from_rows(ordered)
    support["fieldLevelConflicts"] = conflicts
    alternates = [
        {
            "fragmentId": int(row["fragment_id"]),
            "traceScope": str(row["trace_scope"]),
            "requestSignature": str(row["request_signature"]),
            "sourceJobId": str(row["source_job_id"]),
            "sourceTerm": str(row["source_term"]),
            "confidence": float(row["confidence"]),
            "payload": _json_loads(row["payload_json"], None),
        }
        for row in ordered[1:]
    ]
    provenance = {
        **support,
        "reducer": "semantic-formula-merge-v1",
    }
    canonical["support"] = support
    return canonical, alternates, provenance, "semantic-formula-merge-v1"


def _reduce_dependency_fragment(rows: list[sqlite3.Row]) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any], str]:
    ordered = sorted(rows, key=_rank_row, reverse=True)
    payloads = [_json_loads(row["payload_json"], {}) for row in ordered]
    edge = payloads[0].get("edge")
    support = _support_metadata_from_rows(ordered)
    canonical = {
        "semanticKey": str(payloads[0].get("semanticKey", "")),
        "familyId": str(payloads[0].get("familyId", "")),
        "edge": edge,
        "roles": _dedupe_sequence([payload.get("role") for payload in payloads if payload.get("role")]),
        "support": support,
    }
    alternates = [
        {
            "fragmentId": int(row["fragment_id"]),
            "traceScope": str(row["trace_scope"]),
            "requestSignature": str(row["request_signature"]),
            "sourceJobId": str(row["source_job_id"]),
            "sourceTerm": str(row["source_term"]),
            "confidence": float(row["confidence"]),
            "payload": _json_loads(row["payload_json"], None),
        }
        for row in ordered[1:]
    ]
    provenance = {
        **support,
        "reducer": "semantic-dependency-merge-v1",
    }
    return canonical, alternates, provenance, "semantic-dependency-merge-v1"


def _reduce_owner_controller_fragment(rows: list[sqlite3.Row]) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any], str]:
    ordered = sorted(rows, key=_rank_row, reverse=True)
    payloads = [_json_loads(row["payload_json"], {}) for row in ordered]
    conflicts: list[dict[str, Any]] = []
    canonical = {
        "semanticKey": str(payloads[0].get("semanticKey", "")),
        "owner": _merge_scalar_field("owner", payloads, conflicts),
        "familyIds": _dedupe_sequence([payload.get("familyId") for payload in payloads if payload.get("familyId")]),
        "targetIds": _dedupe_sequence([payload.get("targetId") for payload in payloads if payload.get("targetId")]),
        "ownerFieldBlocks": _dedupe_sequence([payload.get("ownerFieldBlock") for payload in payloads if payload.get("ownerFieldBlock")]),
        "controllerBlocks": _dedupe_sequence([payload.get("controllerBlock") for payload in payloads if payload.get("controllerBlock")]),
        "ownerBlobRows": _dedupe_sequence([payload.get("ownerBlobRow") for payload in payloads if payload.get("ownerBlobRow")]),
        "runtimeEvaluatorRecoveries": _dedupe_sequence([payload.get("runtimeEvaluatorRecovery") for payload in payloads if payload.get("runtimeEvaluatorRecovery")]),
        "runtimeInstanceRecoveries": _dedupe_sequence([payload.get("runtimeInstanceRecovery") for payload in payloads if payload.get("runtimeInstanceRecovery")]),
    }
    support = _support_metadata_from_rows(ordered)
    support["fieldLevelConflicts"] = conflicts
    canonical["support"] = support
    alternates = [
        {
            "fragmentId": int(row["fragment_id"]),
            "traceScope": str(row["trace_scope"]),
            "requestSignature": str(row["request_signature"]),
            "sourceJobId": str(row["source_job_id"]),
            "sourceTerm": str(row["source_term"]),
            "confidence": float(row["confidence"]),
            "payload": _json_loads(row["payload_json"], None),
        }
        for row in ordered[1:]
    ]
    provenance = {
        **support,
        "reducer": "semantic-owner-controller-merge-v1",
    }
    return canonical, alternates, provenance, "semantic-owner-controller-merge-v1"


def _reduce_ui_binding_fragment(rows: list[sqlite3.Row]) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any], str]:
    ordered = sorted(rows, key=_rank_row, reverse=True)
    payloads = [_json_loads(row["payload_json"], {}) for row in ordered]
    conflicts: list[dict[str, Any]] = []
    canonical = {
        "semanticKey": str(payloads[0].get("semanticKey", "")),
        "role": _merge_scalar_field("role", payloads, conflicts),
        "familyIds": _dedupe_sequence([payload.get("familyId") for payload in payloads if payload.get("familyId")]),
        "targetIds": _dedupe_sequence([payload.get("targetId") for payload in payloads if payload.get("targetId")]),
        "shellWindows": _dedupe_sequence([payload.get("shellWindow") for payload in payloads if payload.get("shellWindow")]),
        "values": _dedupe_sequence([item for payload in payloads for item in (payload.get("values") or [])]),
        "presentationUpdatePaths": _dedupe_sequence([payload.get("presentationUpdatePath") for payload in payloads if payload.get("presentationUpdatePath")]),
    }
    support = _support_metadata_from_rows(ordered)
    support["fieldLevelConflicts"] = conflicts
    canonical["support"] = support
    alternates = [
        {
            "fragmentId": int(row["fragment_id"]),
            "traceScope": str(row["trace_scope"]),
            "requestSignature": str(row["request_signature"]),
            "sourceJobId": str(row["source_job_id"]),
            "sourceTerm": str(row["source_term"]),
            "confidence": float(row["confidence"]),
            "payload": _json_loads(row["payload_json"], None),
        }
        for row in ordered[1:]
    ]
    provenance = {
        **support,
        "reducer": "semantic-ui-binding-merge-v1",
    }
    return canonical, alternates, provenance, "semantic-ui-binding-merge-v1"


def _reduce_semantic_fragment(fragment_kind: str, rows: list[sqlite3.Row]) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any], str]:
    if fragment_kind == "formula_fragment":
        return _reduce_formula_fragment(rows)
    if fragment_kind == "dependency_fragment":
        return _reduce_dependency_fragment(rows)
    if fragment_kind == "owner_controller_fragment":
        return _reduce_owner_controller_fragment(rows)
    if fragment_kind == "ui_binding_fragment":
        return _reduce_ui_binding_fragment(rows)
    ordered = sorted(rows, key=_rank_row, reverse=True)
    support = _support_metadata_from_rows(ordered)
    canonical_payload = _json_loads(ordered[0]["payload_json"], None)
    if isinstance(canonical_payload, dict):
        canonical_payload = _normalize_reference_owned_payload(
            fragment_kind,
            canonical_payload,
            str(ordered[0]["trace_scope"] or ""),
        )
        canonical_payload["support"] = support
    alternates = [
        {
            "fragmentId": int(row["fragment_id"]),
            "traceScope": str(row["trace_scope"]),
            "requestSignature": str(row["request_signature"]),
            "sourceJobId": str(row["source_job_id"]),
            "sourceTerm": str(row["source_term"]),
            "confidence": float(row["confidence"]),
            "payload": _json_loads(row["payload_json"], None),
        }
        for row in ordered[1:]
    ]
    provenance = {
        **support,
        "reducer": "semantic-fragment-best-rank-v1",
    }
    return canonical_payload, alternates, provenance, "semantic-fragment-best-rank-v1"


def _normalize_reference_owned_payload(
    fragment_kind: str,
    payload: dict[str, Any] | None,
    trace_scope: str,
) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return payload
    if fragment_kind == "rowRecovery":
        return _sanitize_row_recovery_for_persistence(dict(payload))
    if fragment_kind == "traceRegistry":
        normalized = dict(payload)
        normalized["catalogMode"] = "db-bootstrap"
        normalized.pop("selectedTargetId", None)
        normalized.pop("compatibilityTargetId", None)
        normalized.pop("comparisonPresetId", None)
        normalized.pop("comparisonPreset", None)
        normalized.pop("solvedBaselineTargetId", None)
        normalized.pop("blockedTargetId", None)
        normalized.pop("path", None)
        if not list(normalized.get("followUpSurfaces") or []):
            normalized.pop("followUpSurfaces", None)
        return normalized
    if fragment_kind == "traceWorkflow":
        normalized = dict(payload)
        command = str(normalized.get("command") or "")
        direct_example = str(normalized.get("directExample") or "")
        normalized["command"] = command.replace("--legacy-targets ", "")
        normalized["directExample"] = direct_example.replace("--legacy-targets ", "")
        return normalized
    if fragment_kind not in {"reconstruction_note_fragment", "progression_fragment"}:
        return payload
    normalized = dict(payload)
    target_id = str(normalized.get("targetId") or trace_scope or "").strip()
    normalized.pop("decisionSummary", None)
    if target_id and not str(normalized.get("assessmentSemanticKey") or "").strip():
        normalized["assessmentSemanticKey"] = f"target-assessment:{target_id}"
    if fragment_kind == "reconstruction_note_fragment":
        normalized.pop("groundedConclusion", None)
        normalized.pop("currentBoundary", None)
        normalized.pop("bridgeCheck", None)
        if target_id and not str(normalized.get("narrativeSemanticKey") or "").strip():
            normalized["narrativeSemanticKey"] = f"target-narrative:{target_id}"
        if target_id and not str(normalized.get("bridgeComparisonSemanticKey") or "").strip():
            normalized["bridgeComparisonSemanticKey"] = f"target-bridge-comparison:{target_id}"
    return normalized


def _trace_surface(payload: dict[str, Any], surface_id: str) -> dict[str, Any] | None:
    for surface in payload.get("surfaces", []) or []:
        if isinstance(surface, dict) and str(surface.get("id")) == surface_id:
            return surface
    return None


def _trace_surface_source(surface: dict[str, Any] | None, source_id: str) -> dict[str, Any] | None:
    if not isinstance(surface, dict):
        return None
    for source in surface.get("sources", []) or []:
        if isinstance(source, dict) and str(source.get("sourceId")) == source_id:
            return source
    return None


def _trace_source_hit(source_entry: dict[str, Any] | None, term: str) -> dict[str, Any] | None:
    if not isinstance(source_entry, dict):
        return None
    for hit in source_entry.get("hits", []) or []:
        if not isinstance(hit, dict):
            continue
        if str(hit.get("term")) == term or term in (hit.get("matchedTerms") or []):
            return hit
    return None


def _trace_citation(source_entry: dict[str, Any] | None, hit: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(source_entry, dict) or not isinstance(hit, dict):
        return None
    if "jsonPath" in hit:
        locator = hit["jsonPath"]
    elif "pathId" in hit:
        locator = "{} path_id {}".format(hit.get("objectType", "unity-object"), hit["pathId"])
    elif str(source_entry.get("sourceId")) == "metadata" and "offset" in hit:
        locator = f"metadata offset {hit['offset']}"
    elif "offset" in hit:
        locator = f"offset {hit['offset']}"
    else:
        locator = "direct-hit"
    return {
        "sourceId": source_entry.get("sourceId"),
        "sourcePath": source_entry.get("sourcePath"),
        "term": hit.get("term"),
        "locator": locator,
    }


def _compact_trace_citations(*citations: dict[str, Any] | None) -> list[dict[str, Any]]:
    compacted: list[dict[str, Any]] = []
    for citation in citations:
        if not isinstance(citation, dict):
            continue
        if citation not in compacted:
            compacted.append(citation)
    return compacted


def _unique_strings(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        output.append(text)
    return output


def _collect_trace_support_metadata(
    trace_scope: str,
    target_id: str,
    fragment_provenances: list[dict[str, Any]],
) -> dict[str, Any]:
    contributing_jobs: list[str] = []
    corroborating_fragment_ids: list[int] = []
    for provenance in fragment_provenances:
        for job_id in provenance.get("sourceJobIds", []) or []:
            job_str = str(job_id)
            if job_str and job_str not in contributing_jobs:
                contributing_jobs.append(job_str)
        for fragment_id in provenance.get("fragmentIds", []) or []:
            try:
                value = int(fragment_id)
            except (TypeError, ValueError):
                continue
            if value not in corroborating_fragment_ids:
                corroborating_fragment_ids.append(value)
    return {
        "contributingJobs": contributing_jobs,
        "contributingTargets": [target_id],
        "contributingTraceScopes": [trace_scope],
        "corroboratingFragmentIds": corroborating_fragment_ids,
        "supportingEvidenceCount": len(corroborating_fragment_ids),
    }


def _synthesize_surface_plan_from_registry(
    trace_scope: str,
    compatibility_target_id: str,
    family_id: str,
) -> dict[str, Any]:
    strategy_config = dict(BOOTSTRAP_SUPPORT_CONTEXTS.get(compatibility_target_id) or {})
    default_anchors = list(BOOTSTRAP_DEFAULT_ANCHORS.get(compatibility_target_id) or [])
    if not strategy_config:
        return {}
    surface_plans: list[dict[str, Any]] = []
    for surface in list(strategy_config.get("surfaces") or []):
        if not isinstance(surface, dict):
            continue
        source_ids = [
            str(source_id)
            for source_id in (surface.get("sourceIds") or [])
            if str(source_id or "").strip() and str(source_id) != "tokenShopRowRemapBoundary"
        ]
        surface_plans.append(
            {
                "id": str(surface.get("id") or ""),
                "label": str(surface.get("label") or ""),
                "terms": _unique_strings([str(item) for item in (surface.get("terms") or [])]),
                "sourceIds": _unique_strings(source_ids),
            }
        )
    if not surface_plans:
        if compatibility_target_id == "shard-cost-su0-structure":
            parameter_shell = [str(item) for item in (strategy_config.get("parameterShell") or []) if str(item).strip()]
            accessor = str(strategy_config.get("accessor") or "").strip()
            surface_plans = [
                {
                    "id": "cost-model-boundary",
                    "label": "Shard cost-model boundary",
                    "terms": list(default_anchors),
                    "sourceIds": ["metadata"],
                },
                {
                    "id": "metadata-row0-structure",
                    "label": "Shard metadata row0 structure",
                    "terms": [accessor, *parameter_shell[:3]],
                    "sourceIds": ["metadata"],
                },
                {
                    "id": "runtime-cache-lifecycle",
                    "label": "Shard runtime cache lifecycle",
                    "terms": ["GetShardCostList", "UpdateShardCostList", "MilestoneCostList"],
                    "sourceIds": ["metadata"],
                },
            ]
        elif compatibility_target_id == "multiverse-market-save-owner-boundary":
            save_owner = str(strategy_config.get("saveOwner") or "").strip()
            compatibility_import = str(strategy_config.get("compatibilityImportTargetPath") or "").strip()
            ordered_overlap = [str(item) for item in (strategy_config.get("orderedOverlap") or []) if str(item).strip()]
            surface_plans = [
                {
                    "id": "accessor-bridge",
                    "label": "Accessor bridge",
                    "terms": list(default_anchors),
                    "sourceIds": ["metadata", "level0"],
                },
                {
                    "id": "save-owner-span",
                    "label": "SaveData owner span",
                    "terms": [save_owner, "IS1Level", "IS110Level", "InscryptionsDone", compatibility_import],
                    "sourceIds": ["metadata"],
                },
                {
                    "id": "ordered-overlap",
                    "label": "Ordered overlap",
                    "terms": ordered_overlap,
                    "sourceIds": ["metadata", "level0"],
                },
            ]
        if not surface_plans:
            return {}
    shell_window = {
        key: strategy_config.get(key)
        for key in ("shellField", "shellPathId", "shellWindowSource", "shellWindowRadius")
        if strategy_config.get(key) is not None
    }
    if not shell_window and compatibility_target_id == "shard-cost-su0-structure":
        shell_window = {
            "shellField": strategy_config.get("accessor"),
            "shellPathId": "runtime-getter",
            "shellWindowSource": "metadata",
        }
    elif not shell_window and compatibility_target_id == "multiverse-market-save-owner-boundary":
        shell_window = {
            "shellField": "get_Market",
            "shellPathId": "typed-accessor",
            "shellWindowSource": "metadata",
        }
    return {
        "semanticKey": f"target-surface-plan:{trace_scope}",
        "traceScope": trace_scope,
        "targetId": compatibility_target_id or trace_scope,
        "familyId": family_id or None,
        "shellWindow": shell_window,
        "surfacePlans": surface_plans,
        "synthesized": True,
    }


def _derive_shard_owned_state_semantic_scope(
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    if trace_scope != "shard-owned-state-upgradeinfolist-population":
        return None
    shell_window = dict(payload.get("shellWindow") or {})
    if not shell_window:
        return None
    target = dict(payload.get("target") or {})
    target_id = str(target.get("id") or trace_scope).strip()
    strategy_config = dict(BOOTSTRAP_SUPPORT_CONTEXTS.get(target_id) or {})
    scene_surface = _trace_surface(payload, "scene-owner")
    runtime_surface = _trace_surface(payload, "runtime-shell")
    watcher_surface = _trace_surface(payload, "owner-list-watchers")
    save_surface = _trace_surface(payload, "save-gap")
    handoff_surface = _trace_surface(payload, "handoff-boundary")
    level0_scene_source = _trace_surface_source(scene_surface, "level0")
    metadata_runtime_source = _trace_surface_source(runtime_surface, "metadata")
    metadata_watcher_source = _trace_surface_source(watcher_surface, "metadata")
    metadata_save_source = _trace_surface_source(save_surface, "metadata")
    metadata_handoff_source = _trace_surface_source(handoff_surface, "metadata")

    scene_owner_name = str(strategy_config.get("sceneOwner") or "")
    declaring_field = str(shell_window.get("shellField") or "") or "upgradeInfoList"
    runtime_label = next(
        (
            str(term)
            for term in (runtime_surface or {}).get("terms", []) or []
            if isinstance(term, str) and "->" in term
        ),
        f"{scene_owner_name}.{declaring_field} -> ShardMining+ShardUpgradeInfo" if scene_owner_name else declaring_field,
    )
    if "." in runtime_label:
        scene_owner_name = runtime_label.split(".", 1)[0].strip()
    if not scene_owner_name:
        scene_owner_name = next(
            (
                str(hit.get("term"))
                for hit in (level0_scene_source or {}).get("hits", []) or []
                if isinstance(hit, dict) and str(hit.get("term") or "")
            ),
            "",
        )
    scene_hit = _trace_source_hit(level0_scene_source, scene_owner_name) if scene_owner_name else None
    row_model_full_name = runtime_label.split("->", 1)[1].strip() if "->" in runtime_label else "ShardMining+ShardUpgradeInfo"
    row_state_fields = []
    for entry in shell_window.get("window", []) or []:
        if not isinstance(entry, dict) or str(entry.get("group")) != "runtime-row-state":
            continue
        field_name = str(entry.get("field") or "").strip()
        if not field_name:
            continue
        hit = _trace_source_hit(metadata_runtime_source, field_name)
        row_state_fields.append(
            {
                "name": field_name,
                "fieldOffset": (_trace_citation(metadata_runtime_source, hit) or {}).get("locator"),
                "evidence": _trace_citation(metadata_runtime_source, hit),
            }
        )

    owner_list_candidates = ["upgradeInfoList", "MaxedMilestonesList", "UnlockedMilestonesList", "MilestoneCostList"]
    local_hook_candidates = [
        "InitializeShards",
        "InitializeMaxLevelBools",
        "UpdateUnlockedMilestonesList",
        "UpdateMaxedMilestonesList",
        "CheckAllMilestoneLevelFills",
    ]
    save_family_candidates = ["PlayerProfileData", "GetPlayerProfileData", "FillPlayerProfileData", "CloudSavePlayerProfile"]
    handoff_candidates = [str(strategy_config.get("genericLead") or ""), "ConstructionMilestones"]

    owner_list_fields = [
        term for term in owner_list_candidates
        if _trace_source_hit(metadata_runtime_source, term) is not None or _trace_source_hit(metadata_watcher_source, term) is not None
    ]
    local_hooks = [term for term in local_hook_candidates if _trace_source_hit(metadata_watcher_source, term) is not None]
    save_family_terms = [term for term in save_family_candidates if _trace_source_hit(metadata_save_source, term) is not None]
    handoff_terms = [term for term in handoff_candidates if term and _trace_source_hit(metadata_handoff_source, term) is not None]

    trace_graph = dict(payload.get("traceGraph") or {})
    negative_edge_types = {
        str(edge.get("type"))
        for edge in trace_graph.get("negativeEdges", []) or []
        if isinstance(edge, dict) and str(edge.get("type") or "")
    }
    positive_edge_types = {
        str(edge.get("type"))
        for edge in trace_graph.get("edges", []) or []
        if isinstance(edge, dict) and str(edge.get("type") or "")
    }
    if "local-runtime-population-bridge" in positive_edge_types:
        outcome_kind = "local-runtime-population-bridge"
    elif "deeper-wrapper-handoff" in positive_edge_types:
        outcome_kind = "deeper-wrapper-handoff"
    elif {
        "local-runtime-population-bridge",
        "deeper-wrapper-handoff-recovery",
    }.issubset(negative_edge_types):
        outcome_kind = "non-local-injection-seam"
    else:
        outcome_kind = str((payload.get("outcome") or {}).get("kind") or "")
    if outcome_kind == "local-runtime-population-bridge":
        outcome = {
            "kind": outcome_kind,
            "label": "Local runtime population bridge",
            "summary": "The trace now preserves one shard-local construction bridge that populates upgradeInfoList owned-state values directly.",
            "nodeLabel": "Local ShardMining population bridge",
            "statement": "Raw trace evidence now preserves one local ShardMining-side producer that fills upgradeInfoList owned-state values.",
            "citations": [],
        }
    elif outcome_kind == "deeper-wrapper-handoff":
        outcome = {
            "kind": outcome_kind,
            "label": "Deeper wrapper handoff",
            "summary": "The trace now preserves a deeper save-side wrapper handoff for player-owned shard row state even though it does not stop on a local ShardMining producer.",
            "nodeLabel": "Recovered deeper save-side wrapper",
            "statement": "Raw trace evidence now preserves one deeper wrapper handoff for player-owned shard row state behind upgradeInfoList.",
            "citations": [],
        }
    elif outcome_kind == "non-local-injection-seam":
        outcome = {
            "kind": outcome_kind,
            "label": "Non-local injection seam",
            "summary": "The trace rules out a local upgradeInfoList population bridge and still cannot name a deeper wrapper handoff, so owned-state values remain bounded as a non-local injection seam.",
            "nodeLabel": "Non-local save-side injection seam",
            "statement": "The raw trace now narrows the owned-state path to a non-local seam: direct definitions and the runtime shell are recovered locally, but owned-state values still arrive from a source the repo cannot yet name.",
            "citations": _compact_trace_citations(
                _trace_citation(metadata_save_source, _trace_source_hit(metadata_save_source, "PlayerProfileData")),
                _trace_citation(metadata_watcher_source, _trace_source_hit(metadata_watcher_source, "InitializeShards")),
            ),
        }
    else:
        outcome = {
            "kind": "research-gap",
            "label": "Research gap",
            "summary": "The trace still lacks enough recovered shard owned-state structure to classify the bridge as local, wrapper-side, or a bounded non-local seam.",
            "nodeLabel": "Unclassified owned-state gap",
            "statement": "The raw trace does not yet preserve enough evidence to classify the owned-state bridge shape.",
            "citations": _compact_trace_citations(
                _trace_citation(metadata_watcher_source, _trace_source_hit(metadata_watcher_source, "InitializeShards")),
            ),
        }
    support = _collect_trace_support_metadata(
        trace_scope,
        str(target.get("id") or trace_scope),
        [
            dict(provenance.get("shellWindow") or {}),
            dict(provenance.get("surfaces") or {}),
            dict(provenance.get("traceGraph") or {}),
            dict(provenance.get("outcome") or {}),
            dict(provenance.get("bridgeCheck") or {}),
        ],
    )
    return {
        "scopeId": "shard-owned-state:upgradeinfolist-population",
        "scopeType": "trace-target-support",
        "familyId": "shard-owned-state",
        "sceneOwner": {
            "name": scene_owner_name,
            "pathId": scene_hit.get("pathId") if isinstance(scene_hit, dict) else None,
            "evidence": _trace_citation(level0_scene_source, scene_hit),
        },
        "runtimeShell": {
            "label": runtime_label,
            "ownerType": scene_owner_name,
            "declaringField": {
                "name": declaring_field,
                "fieldOffset": shell_window.get("shellPathId"),
                "evidence": _trace_citation(metadata_runtime_source, _trace_source_hit(metadata_runtime_source, declaring_field)),
            },
            "rowModelType": {
                "fullName": row_model_full_name,
                "evidence": _trace_citation(metadata_runtime_source, _trace_source_hit(metadata_runtime_source, row_model_full_name)),
            },
            "rowStateFields": row_state_fields,
        },
        "ownerListFields": owner_list_fields,
        "localHooks": local_hooks,
        "saveFamilyTerms": save_family_terms,
        "handoffTerms": handoff_terms,
        "bridgeAssessment": {
            "localBridgeRecovered": outcome_kind == "local-runtime-population-bridge",
            "wrapperHandoffRecovered": outcome_kind == "deeper-wrapper-handoff",
            "result": outcome_kind or "non-local-injection-seam",
            "checkedLocalHooks": local_hooks,
            "checkedSaveFamilyTerms": save_family_terms,
            "checkedHandoffTerms": handoff_terms,
        },
        "outcome": outcome,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_token_shop_row_semantic_scope(
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    if str(target.get("familyId") or "") != "token-shop":
        return None
    row_recovery = _sanitize_row_recovery_for_persistence(dict(payload.get("rowRecovery") or {}))
    semantic_scope_id = str(row_recovery.get("semanticScopeId") or "").strip()
    if not semantic_scope_id.startswith("row:"):
        return None
    semantic_graph = dict(row_recovery.get("semanticGraph") or {})
    semantic_search_plan = dict(row_recovery.get("semanticSearchPlan") or {})
    if not semantic_graph and not semantic_search_plan:
        return None
    row_local_graph = _derive_token_shop_row_local_graph(row_recovery)
    missing_seams = _derive_token_shop_row_missing_seams(row_local_graph, row_recovery)
    compatibility_status = _derive_token_shop_row_compatibility_status(
        row_local_graph,
        missing_seams,
        row_recovery,
    )
    support = _collect_trace_support_metadata(
        trace_scope,
        str(target.get("id") or trace_scope),
        [
            dict(provenance.get("shellWindow") or {}),
            dict(provenance.get("surfaces") or {}),
            dict(provenance.get("traceGraph") or {}),
            dict(provenance.get("nativeReconstruction") or {}),
            dict(provenance.get("rowRecovery") or {}),
        ],
    )
    return {
        "scopeId": semantic_scope_id,
        "scopeType": "row",
        "familyId": "token-shop",
        "targetId": str(target.get("id") or ""),
        "traceScope": trace_scope,
        "rowShellField": row_recovery.get("shellField"),
        "rowLocalGraph": row_local_graph,
        "missingSeams": missing_seams,
        "semanticGraph": semantic_graph,
        "semanticSearchPlan": semantic_search_plan,
        "compatibilityStatus": compatibility_status,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _load_materialized_term_payload(
    conn: sqlite3.Connection,
    term: str,
) -> tuple[dict[str, Any], dict[str, Any]] | tuple[None, None]:
    row = conn.execute(
        """
        SELECT payload_json, provenance_json
        FROM materialized_term_views
        WHERE term = ?
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (term,),
    ).fetchone()
    if row is None:
        return None, None
    return _json_loads(row["payload_json"], {}), _json_loads(row["provenance_json"], {})


def _load_canonical_semantic_fragment_payload(
    conn: sqlite3.Connection,
    fragment_kind: str,
    fragment_key: str,
) -> dict[str, Any]:
    row = conn.execute(
        """
        SELECT canonical_payload_json
        FROM canonical_semantic_fragments
        WHERE fragment_kind = ? AND fragment_key = ?
        LIMIT 1
        """,
        (fragment_kind, fragment_key),
    ).fetchone()
    if row is None:
        return {}
    return _json_loads(row["canonical_payload_json"], {})


def _load_canonical_semantic_fragment_payloads(
    conn: sqlite3.Connection,
    fragment_kind: str,
    fragment_key_like: str | None = None,
) -> list[dict[str, Any]]:
    query = """
        SELECT canonical_payload_json
        FROM canonical_semantic_fragments
        WHERE fragment_kind = ?
    """
    params: list[Any] = [fragment_kind]
    if fragment_key_like:
        query += " AND fragment_key LIKE ?"
        params.append(fragment_key_like)
    rows = conn.execute(query, tuple(params)).fetchall()
    return [_json_loads(row["canonical_payload_json"], {}) for row in rows]


def _load_latest_trace_fragment_payload(
    conn: sqlite3.Connection,
    trace_scope: str,
    fragment_kind: str,
) -> Any:
    row = conn.execute(
        """
        SELECT payload_json
        FROM trace_fragments
        WHERE trace_scope = ? AND fragment_kind = ? AND is_valid = 1
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (trace_scope, fragment_kind),
    ).fetchone()
    if row is None:
        return None
    return _json_loads(row["payload_json"], None)


def _count_literal_candidates(literal_text_recovery: dict[str, Any]) -> int:
    count = 0
    for key, value in literal_text_recovery.items():
        if key.endswith("Candidates") and isinstance(value, list):
            count += len(value)
    return count


def _sanitize_row_recovery_for_persistence(row_recovery: dict[str, Any]) -> dict[str, Any]:
    sanitized = dict(row_recovery or {})
    literal_summary = dict(sanitized.get("literalRecoverySummary") or {})
    if not literal_summary:
        literal_schema = dict(sanitized.get("literalSchemaRecovery") or {})
        literal_text = dict(sanitized.get("literalTextRecovery") or {})
        schema_fields = [
            str(item)
            for item in (literal_schema.get("schemaFields") or literal_text.get("schemaFields") or [])
            if str(item).strip()
        ]
        literal_summary = {
            "status": str(literal_text.get("status") or literal_schema.get("status") or "").strip() or None,
            "schemaFields": schema_fields,
            "schemaFieldCount": len(schema_fields),
            "title": str(literal_text.get("title") or "").strip() or None,
            "description": str(literal_text.get("description") or "").strip() or None,
            "shortEffectLabel": str(literal_text.get("shortEffectLabel") or "").strip() or None,
            "outputLabel": str(literal_text.get("outputLabel") or "").strip() or None,
            "bonusLabel": str(literal_text.get("bonusLabel") or "").strip() or None,
            "titleCandidateCount": len(list(literal_text.get("titleCandidates") or [])),
            "descriptionCandidateCount": len(list(literal_text.get("descriptionCandidates") or [])),
            "shortEffectCandidateCount": len(list(literal_text.get("shortEffectCandidates") or [])),
            "outputCandidateCount": len(list(literal_text.get("outputCandidates") or [])),
            "bonusCandidateCount": len(list(literal_text.get("bonusCandidates") or [])),
            "bonusMultiplier": str(literal_text.get("bonusMultiplier") or "").strip() or None,
        }
    sanitized["literalRecoverySummary"] = literal_summary
    sanitized.pop("closureStatus", None)
    sanitized.pop("literalSchemaRecovery", None)
    sanitized.pop("literalTextRecovery", None)
    return sanitized


def _derive_token_shop_row_local_graph(row_recovery: dict[str, Any]) -> dict[str, Any]:
    semantic_graph = dict(row_recovery.get("semanticGraph") or {})
    presentation_update = dict(row_recovery.get("presentationUpdatePath") or {})
    slots = dict(presentation_update.get("slots") or {})
    literal_summary = dict(row_recovery.get("literalRecoverySummary") or {})
    literal_text_recovery = dict(row_recovery.get("literalTextRecovery") or {})
    title_slots = list(slots.get("title") or [])
    description_slots = list(slots.get("description") or [])
    cost_slots = list(slots.get("cost") or [])
    formula_fields = _unique_strings(
        [
            str(edge.get("to") or "").replace("field:", "")
            for edge in (semantic_graph.get("edges") or [])
            if isinstance(edge, dict) and str(edge.get("type") or "") == "has-formula-field"
        ]
    )
    edge_types = _unique_strings(
        [
            str(edge.get("type") or "")
            for edge in (semantic_graph.get("edges") or [])
            if isinstance(edge, dict) and str(edge.get("type") or "").strip()
        ]
    )
    return {
        "rowShell": {
            "field": str(row_recovery.get("shellField") or "").strip() or None,
            "pathId": row_recovery.get("shellPathId"),
        },
        "edgeTypes": edge_types,
        "actionMethods": list(row_recovery.get("recoveredActionMethods") or []),
        "prefabCandidates": list(row_recovery.get("prefabCandidates") or []),
        "resolvedGameObjects": list(row_recovery.get("resolvedGameObjects") or []),
        "slotRoles": _unique_strings(
            [
                *("title" if title_slots else []),
                *("description" if description_slots else []),
                *("cost" if cost_slots else []),
                *(str(role) for role, slot_payload in slots.items() if slot_payload),
            ]
        ),
        "updateHooks": list(presentation_update.get("updateHookCandidates") or []),
        "formulaFields": formula_fields,
        "formulaValues": list(row_recovery.get("recoveredFormulaValues") or []),
        "textCandidateCount": len(list(row_recovery.get("textCandidates") or [])),
        "detachedTextCandidateCount": len(list(row_recovery.get("detachedTextCandidates") or [])),
        "literalTitleRecovered": bool(str(literal_summary.get("title") or literal_text_recovery.get("title") or "").strip()),
        "literalDescriptionRecovered": bool(str(literal_summary.get("description") or literal_text_recovery.get("description") or "").strip()),
        "nativePromotedOwner": str(row_recovery.get("nativePromotedOwner") or "").strip() or None,
    }


def _derive_token_shop_row_missing_seams(
    row_local_graph: dict[str, Any],
    row_recovery: dict[str, Any],
) -> list[dict[str, Any]]:
    seams: list[dict[str, Any]] = []
    if not list(row_local_graph.get("actionMethods") or []):
        seams.append({"id": "exact-shell-to-action-hook", "status": "missing"})
    if not list(row_local_graph.get("prefabCandidates") or []):
        seams.append({"id": "exact-shell-to-prefab", "status": "missing"})
    if not bool(row_local_graph.get("literalTitleRecovered")):
        seams.append({"id": "exact-shell-to-title", "status": "missing"})
    if not list(row_local_graph.get("updateHooks") or []):
        seams.append({"id": "exact-display-update-path", "status": "missing"})
    formula_reconstruction = dict(row_recovery.get("formulaReconstruction") or {})
    fast_buy_recovery = dict(row_recovery.get("fastBuyRecovery") or {})
    runtime_cost_model = dict(formula_reconstruction.get("runtimeCostModel") or {})
    unresolved_runtime_targets: list[str] = []
    if str(runtime_cost_model.get("status") or "") == "unresolved-runtime-modifiers":
        if str(fast_buy_recovery.get("status") or "") == "fast-buy-candidates-recovered":
            unresolved_runtime_targets.append("displayed-cost-fast-buy-or-runtime-modifiers")
        else:
            unresolved_runtime_targets.append("displayed-cost-runtime-modifiers")
    if not unresolved_runtime_targets:
        unresolved_runtime_targets = list(
            ((row_recovery.get("closureStatus") or {}).get("unresolvedRuntimeTargets") or [])
        )
    if unresolved_runtime_targets:
        seams.append(
            {
                "id": "runtime-model-gap",
                "status": "missing",
                "targets": unresolved_runtime_targets,
            }
        )
    return seams


def _derive_token_shop_row_compatibility_status(
    row_local_graph: dict[str, Any],
    missing_seams: list[dict[str, Any]],
    row_recovery: dict[str, Any],
) -> dict[str, Any]:
    legacy_closure_status = dict(row_recovery.get("closureStatus") or {})
    missing_ids = [str(seam.get("id") or "") for seam in missing_seams if str(seam.get("id") or "").strip()]
    unresolved_runtime_targets = []
    for seam in missing_seams:
        if str(seam.get("id") or "") == "runtime-model-gap":
            unresolved_runtime_targets.extend(list(seam.get("targets") or []))
    unresolved_runtime_targets = _unique_strings([str(value) for value in unresolved_runtime_targets])
    semantic_status = "open" if missing_ids else "closed"
    literal_status = (
        "closed"
        if bool(row_local_graph.get("literalTitleRecovered")) or int(row_local_graph.get("textCandidateCount") or 0) > 0
        else "open"
    )
    runtime_status = "open" if unresolved_runtime_targets else "closed"
    status = f"semantic-{semantic_status}"
    summary = str(legacy_closure_status.get("summary") or "").strip()
    if not summary:
        if missing_ids:
            summary = "Row-local graph remains open at: {}.".format(", ".join(missing_ids))
        else:
            summary = "Row-local graph is closed for the currently recovered token-shop evidence."
    return {
        "status": status,
        "semanticStatus": semantic_status,
        "literalStatus": literal_status,
        "runtimeStatus": runtime_status,
        "summary": summary,
        "missingSeamIds": missing_ids,
        "unresolvedRuntimeTargets": unresolved_runtime_targets,
    }


def _derive_token_shop_updater_display_semantic_scope(
    conn: sqlite3.Connection,
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
    assessment_summary: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    if trace_scope != "token-shop-atu4-mod":
        return None
    target = dict(payload.get("target") or {})
    if str(target.get("familyId") or "") != "token-shop":
        return None
    row_recovery = _sanitize_row_recovery_for_persistence(dict(payload.get("rowRecovery") or {}))
    semantic_scope_id = "token-shop-updater-display:ATU4"
    row_scope_id = str(row_recovery.get("semanticScopeId") or "").strip() or "row:ATU4Button"
    trace_payload = dict(payload.get("tracePayload") or {})
    trace_graph = dict((trace_payload.get("traceGraph") or {}))
    decision_summary = dict(assessment_summary or {})
    target_id = str(target.get("id") or trace_scope).strip()
    strategy_config = dict(BOOTSTRAP_SUPPORT_CONTEXTS.get(target_id) or {})

    shell_field = str(strategy_config.get("shellField") or "") or "ATU4Button"
    purchase_action = "BuyModBoost"
    updater_terms = ["SetTokenTexts", "SetAllTokenShopTexts"]
    parameter_terms = [
        "ModBoostStartCost",
        "ModBoostAdditiveCost",
        "ModBoostBonus",
        "ModBoostMaxLevel",
    ]
    related_update_terms = [
        "SetAdChestTexts",
        "SetAllBoosterAdTexts",
        "SetBoosterAdSecondsTexts",
        "SetBoosterBonusTexts",
        "SetDiamondTexts",
    ]

    term_payloads: dict[str, dict[str, Any]] = {}
    term_provenance: dict[str, dict[str, Any]] = {}
    for term in [shell_field, purchase_action, *updater_terms, *parameter_terms]:
        payload_entry, provenance_entry = _load_materialized_term_payload(conn, term)
        if payload_entry is None:
            continue
        term_payloads[term] = payload_entry
        term_provenance[term] = provenance_entry or {}

    if shell_field not in term_payloads or purchase_action not in term_payloads:
        return None

    set_token_payload = term_payloads.get("SetTokenTexts") or {}
    set_all_payload = term_payloads.get("SetAllTokenShopTexts") or {}
    purchase_payload = term_payloads.get(purchase_action) or {}

    bridge_plan = dict((set_token_payload.get("bridgePlans") or {}).get("SetTokenTexts") or {})
    managed_reconstruction = dict(set_token_payload.get("managedReconstruction") or {})
    purchase_reconstruction = dict(purchase_payload.get("managedReconstruction") or {})
    owner_to_terms = dict(managed_reconstruction.get("ownerToTerms") or purchase_reconstruction.get("ownerToTerms") or {})
    purchase_owner_cluster = dict(owner_to_terms.get(purchase_action) or {})

    parameter_shell = []
    for term in parameter_terms:
        payload_entry = term_payloads.get(term) or {}
        ascii_hits = list(((payload_entry.get("ascii_targets") or {}).get(term) or []))
        provenance_entry = term_provenance.get(term) or {}
        parameter_shell.append(
            {
                "term": term,
                "asciiHitCount": len(ascii_hits),
                "sourceJobIds": sorted(
                    set(
                        str(job_id)
                        for job_id in ((provenance_entry.get("ascii_targets") or {}).get("sourceJobIds") or [])
                        if str(job_id)
                    )
                ),
            }
        )

    positive_edge_types = [
        str(edge.get("type"))
        for edge in trace_graph.get("edges", []) or []
        if isinstance(edge, dict) and str(edge.get("type") or "")
    ]
    negative_edge_types = [
        str(edge.get("type"))
        for edge in trace_graph.get("negativeEdges", []) or []
        if isinstance(edge, dict) and str(edge.get("type") or "")
    ]
    blocked_edges = list(decision_summary.get("blockedEdgeTypes") or negative_edge_types)
    updater_linkage_status = (
        "updater-cluster-recovered-display-path-open"
        if "generic-text-hook-cluster" in positive_edge_types and blocked_edges
        else "updater-cluster-recovered"
    )

    support = _collect_trace_support_metadata(
        trace_scope,
        str(target.get("id") or trace_scope),
        [
            dict(provenance.get("traceGraph") or {}),
            dict(provenance.get("rowRecovery") or {}),
            dict(provenance.get("nativeReconstruction") or {}),
        ],
    )
    support["termViews"] = {
        term: {
            "sourceJobIds": sorted(
                {
                    str(job_id)
                    for bucket in (term_provenance.get(term) or {}).values()
                    if isinstance(bucket, dict)
                    for job_id in (bucket.get("sourceJobIds") or [])
                    if str(job_id)
                }
            )
        }
        for term in [shell_field, purchase_action, *updater_terms, *parameter_terms]
        if term in term_provenance
    }

    return {
        "scopeId": semantic_scope_id,
        "scopeType": "updater-display",
        "familyId": "token-shop",
        "targetId": str(target.get("id") or ""),
        "traceScope": trace_scope,
        "rowScopeId": row_scope_id,
        "rowShell": {
            "field": shell_field,
            "pathId": row_recovery.get("shellPathId"),
        },
        "purchaseAction": {
            "term": purchase_action,
            "relatedTerms": _unique_strings(
                [
                    *list(purchase_owner_cluster.get("relatedTerms") or []),
                    shell_field,
                    *updater_terms,
                ]
            ),
        },
        "displayUpdaters": {
            "primaryTerms": updater_terms,
            "relatedTerms": _unique_strings(
                [
                    *related_update_terms,
                    *list(bridge_plan.get("fallbackTerms") or []),
                ]
            ),
            "bridgePlan": {
                "strategy": bridge_plan.get("bridgeStrategy"),
                "selectedNativeCoreTerms": list(bridge_plan.get("selectedNativeCoreTerms") or []),
                "selectedContextTerms": list(bridge_plan.get("selectedContextTerms") or []),
            },
        },
        "parameterShell": parameter_shell,
        "assessment": {
            "status": updater_linkage_status,
            "supportingEdgeTypes": _unique_strings(positive_edge_types),
            "blockedEdgeTypes": blocked_edges,
            "decisionVerdict": decision_summary.get("verdict"),
        },
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_token_shop_reconstruction_fragment(
    conn: sqlite3.Connection,
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
    token_shop_scope: dict[str, Any] | None = None,
    assessment_summary: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    if str(target.get("familyId") or "") != "token-shop":
        return None

    formula_fragment = dict(payload.get("formula_fragment") or {})
    runtime_table_fragment = dict(payload.get("runtime_table_fragment") or {})
    target_id = str(target.get("id") or trace_scope).strip()
    row_recovery = _sanitize_row_recovery_for_persistence(dict(payload.get("rowRecovery") or {}))
    row_scope_id = str(row_recovery.get("semanticScopeId") or "").strip()
    row_scope = dict(token_shop_scope or {})
    if not row_scope and row_scope_id:
        row_scope = _load_canonical_semantic_fragment_payload(conn, "semantic_scope_fragment", row_scope_id)
    ui_binding_fragments = _load_canonical_semantic_fragment_payloads(
        conn,
        "ui_binding_fragment",
        f"ui-binding:token-shop:{target_id}:%",
    )
    owner_controller_fragments = [
        fragment
        for fragment in _load_canonical_semantic_fragment_payloads(conn, "owner_controller_fragment")
        if target_id in list(fragment.get("targetIds") or [])
    ]
    presentation_paths = [
        path
        for fragment in ui_binding_fragments
        for path in (fragment.get("presentationUpdatePaths") or [])
        if isinstance(path, dict)
    ]
    presentation_path = dict(presentation_paths[0] or {}) if presentation_paths else {}
    slots = dict(presentation_path.get("slots") or {})
    shell_windows = [
        shell_window
        for fragment in ui_binding_fragments
        for shell_window in (fragment.get("shellWindows") or [])
        if isinstance(shell_window, dict)
    ]
    shell_window = dict(shell_windows[0] or {}) if shell_windows else {}
    owner_blob_rows = [
        owner_blob_row
        for fragment in owner_controller_fragments
        for owner_blob_row in (fragment.get("ownerBlobRows") or [])
        if isinstance(owner_blob_row, dict)
    ]
    owner_blob_row = dict(owner_blob_rows[0] or {}) if owner_blob_rows else {}
    native_reconstruction = dict(runtime_table_fragment.get("nativeReconstruction") or {})
    assessment = dict(assessment_summary or {})
    row_local_graph = dict(row_scope.get("rowLocalGraph") or {})
    semantic_graph = dict(row_scope.get("semanticGraph") or {})
    missing_seams = list(row_scope.get("missingSeams") or [])
    missing_seam_ids = _unique_strings(
        [str(item.get("id") or "") for item in missing_seams if isinstance(item, dict) and str(item.get("id") or "").strip()]
    )
    compatibility_status = dict(row_scope.get("compatibilityStatus") or {})
    row_shell_field = str(
        ((row_local_graph.get("rowShell") or {}).get("field"))
        or row_scope.get("rowShellField")
        or shell_window.get("shellField")
        or ""
    ).strip()

    slot_roles = sorted(
        {
            *(str(fragment.get("role") or "") for fragment in ui_binding_fragments if str(fragment.get("role") or "").strip()),
            *(str(role) for role, slot_payload in slots.items() if slot_payload),
        }
    )
    interaction_paths = list(presentation_path.get("interactionToRenderPaths") or [])
    interaction_labels = _unique_strings(
        [
            str(item.get("interaction") or "")
            for item in interaction_paths
            if isinstance(item, dict) and str(item.get("interaction") or "").strip()
        ]
    )
    owner_field_blocks = [
        block
        for fragment in owner_controller_fragments
        for block in (fragment.get("ownerFieldBlocks") or [])
        if block
    ]
    controller_blocks = [
        block
        for fragment in owner_controller_fragments
        for block in (fragment.get("controllerBlocks") or [])
        if block
    ]
    owner_field_block = list(
        (owner_field_blocks[0] if owner_field_blocks else None)
        or owner_blob_row.get("ownerFieldBlock")
        or shell_window.get("ownerFieldBlock")
        or []
    )
    controller_block = list(
        (controller_blocks[0] if controller_blocks else None)
        or owner_blob_row.get("controllerBlock")
        or []
    )
    interaction_nodes = list(presentation_path.get("interactionNodes") or [])
    shell_path_id = (
        shell_window.get("shellPathId")
        or ((interaction_nodes[0] or {}).get("pathId") if interaction_nodes else None)
        or owner_blob_row.get("shellPathId")
    )
    formula_fields = _unique_strings(
        list(row_local_graph.get("formulaFields") or [])
        or [
            str(edge.get("to") or "").replace("field:", "")
            for edge in (semantic_graph.get("edges") or [])
            if isinstance(edge, dict) and str(edge.get("type") or "") == "has-formula-field"
        ]
    )
    blocked_edge_types = list(assessment.get("blockedEdgeTypes") or [])
    runtime_cost_model = dict(formula_fragment.get("runtimeCostModel") or {})
    runtime_model_status = str(runtime_cost_model.get("status") or "").strip()
    text_candidate_count = int(row_local_graph.get("textCandidateCount") or 0)
    detached_text_candidate_count = int(row_local_graph.get("detachedTextCandidateCount") or 0)
    literal_title_recovered = bool(row_local_graph.get("literalTitleRecovered"))
    literal_status = str(
        compatibility_status.get("literalStatus")
        or ("open" if "exact-shell-to-title" in missing_seam_ids and not literal_title_recovered and text_candidate_count <= 0 else "closed")
    )
    runtime_status = str(
        compatibility_status.get("runtimeStatus")
        or (
            "open"
            if ("runtime-model-gap" in missing_seam_ids or runtime_model_status.startswith("unresolved"))
            else (runtime_model_status or None) or ""
        )
    ) or None
    semantic_status = str(compatibility_status.get("semanticStatus") or ("open" if missing_seam_ids else "closed"))
    overall_status = str(compatibility_status.get("status") or ("semantic-open" if semantic_status == "open" else "semantic-closed"))

    support = _collect_trace_support_metadata(
        trace_scope,
        target_id,
        [
            dict(provenance.get("formula_fragment") or {}),
            dict(provenance.get("runtime_table_fragment") or {}),
            dict(provenance.get("rowRecovery") or {}),
        ],
    )
    support["uiBindingSemanticKeys"] = _unique_strings(
        [str(fragment.get("semanticKey") or "") for fragment in ui_binding_fragments]
    )
    support["ownerControllerSemanticKeys"] = _unique_strings(
        [str(fragment.get("semanticKey") or "") for fragment in owner_controller_fragments]
    )
    if row_scope_id:
        support["rowScopeId"] = row_scope_id

    return {
        "semanticKey": f"token-shop-reconstruction:{trace_scope}",
        "scopeType": (
            "token-shop-family-reconstruction"
            if trace_scope == "token-shop-family-structure"
            else "token-shop-row-reconstruction"
        ),
        "traceScope": trace_scope,
        "targetId": target_id,
        "familyId": "token-shop",
        "rowShell": {
            "field": row_shell_field,
            "pathId": shell_path_id,
            "ownerFieldBlock": owner_field_block,
            "controllerBlock": controller_block,
        },
        "presentation": {
            "slotRoles": slot_roles,
            "interactionPaths": interaction_labels,
            "slotCount": len(slot_roles),
        },
        "formula": {
            "recoveredFormulaFields": list(formula_fragment.get("recoveredFormulaFields") or formula_fields),
            "groundedConstants": dict(formula_fragment.get("groundedConstants") or {}),
            "runtimeCostModel": runtime_cost_model or None,
        },
        "rowLocalGraph": row_local_graph or None,
        "missingSeams": missing_seams,
        "runtime": {
            "promotedOwner": str(native_reconstruction.get("promotedOwner") or "").strip() or None,
            "promotedMethods": list(native_reconstruction.get("promotedMethods") or []),
            "promotedFields": list(native_reconstruction.get("promotedFields") or []),
        },
        "status": {
            "status": overall_status,
            "semanticStatus": semantic_status,
            "literalStatus": literal_status,
            "runtimeStatus": runtime_status,
            "schemaOwnerStatus": None,
            "requiredGapKinds": missing_seam_ids or blocked_edge_types,
            "unresolvedLiteralTargets": (["final-title-string"] if literal_status == "open" else []),
            "unresolvedRuntimeTargets": (
                ["displayed-cost-fast-buy-or-runtime-modifiers"]
                if runtime_status == "open"
                else []
            ),
            "directTextCandidateCount": text_candidate_count,
            "detachedTextCandidateCount": detached_text_candidate_count,
        },
        "assessment": {
            "verdict": assessment.get("verdict"),
            "blockedEdgeTypes": list(assessment.get("blockedEdgeTypes") or []),
            "baselineGap": list(assessment.get("baselineGap") or []),
        },
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_token_shop_family_graph_fragment(
    trace_scope: str,
    token_shop_reconstruction_fragment: dict[str, Any] | None,
    assessment_summary: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    reconstruction = dict(token_shop_reconstruction_fragment or {})
    if str(reconstruction.get("scopeType") or "") != "token-shop-family-reconstruction":
        return None
    if str(reconstruction.get("familyId") or "") != "token-shop":
        return None
    row_shells = [dict(reconstruction.get("rowShell") or {})]
    presentation = dict(reconstruction.get("presentation") or {})
    assessment = dict(assessment_summary or reconstruction.get("assessment") or {})
    return {
        "semanticKey": "family-graph:token-shop",
        "scopeType": "family-graph",
        "familyId": "token-shop",
        "familyLabel": "Token Shop",
        "traceScope": trace_scope,
        "targetId": str(reconstruction.get("targetId") or trace_scope),
        "rowShells": row_shells,
        "slotRoles": list(presentation.get("slotRoles") or []),
        "interactionPaths": list(presentation.get("interactionPaths") or []),
        "coreTerms": _unique_strings(
            [
                str(reconstruction.get("targetId") or ""),
                str(((reconstruction.get("rowShell") or {}).get("field") or "")),
                *[str(role) for role in (presentation.get("slotRoles") or [])],
            ]
        ),
        "supportingEdgeTypes": list(assessment.get("supportingEdgeTypes") or []),
        "assessment": {
            "verdict": assessment.get("verdict"),
            "blockedEdgeTypes": list(assessment.get("blockedEdgeTypes") or []),
        },
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": dict(reconstruction.get("support") or {}),
    }


FAMILY_GRAPH_LABELS = {
    "token-shop": "Token Shop",
    "shard-cost": "Shard cost",
    "shard-owned-state": "Shard owned state",
    "multiverse-market-save-owner": "Multiverse market/save-owner",
}

BOOTSTRAP_OUTPUT_SUMMARY_RULES = {
    "token-shop-atu4-mod": {
        "wire": {"minPresentEdges": 5, "maxNegativeEdges": 0},
        "quarantine": {"minPresentEdges": 5, "allowedNegativeEdgeTypes": ["exact-display-update-path"]},
        "messages": {
            "wire": "One exact shell-side owner, prefab, and presentation chain cleared cleanly enough to wire the traced boundary.",
            "quarantine": "The trace now preserves the ATU4 row-local bridge, but the runtime display-update path stays bounded negative so this row remains quarantined to remap evidence.",
            "research": "The trace is still too incomplete to preserve one bounded ATU4 updater/display verdict.",
        },
    },
    "token-shop-atu5-mk1-title": {
        "wire": {"minPresentEdges": 5, "maxNegativeEdges": 0},
        "quarantine": {"minPresentEdges": 5, "allowedNegativeEdgeTypes": ["exact-shell-to-title"]},
        "messages": {
            "wire": "One exact shell-to-prefab and title chain cleared cleanly enough to wire the traced boundary.",
            "quarantine": "The trace now preserves the ATU5 shell-to-prefab bridge, but the title-side pass stays bounded negative so this row remains quarantined to remap evidence.",
            "research": "The trace is still too incomplete to preserve one bounded ATU5 title-side verdict.",
        },
    },
    "token-shop-family-structure": {
        "wire": {"minPresentEdges": 6, "maxNegativeEdges": 0},
        "quarantine": {
            "minPresentEdges": 6,
            "allowedNegativeEdgeTypes": [
                "repeated-shell-to-title-localization-gap",
                "repeated-unresolved-shell-identity-gap",
            ],
        },
        "messages": {
            "wire": "The family audit found a fully localized repeated row-identity pattern, but this target should still remain descriptive only.",
            "quarantine": "The family audit preserves a repeated shell-to-proxy-to-prefab pattern and one standout ATU6 title-chain exemplar, but repeated title-localization gaps still quarantine the broader family.",
            "research": "The family audit is still too incomplete to summarize a stable cross-row TokenShop structure pattern.",
        },
    },
    "token-shop-atu7-mk3-bridge": {
        "wire": {"minPresentEdges": 5, "maxNegativeEdges": 0},
        "quarantine": {"minPresentEdges": 5, "allowedNegativeEdgeTypes": ["exact-display-update-path"]},
        "messages": {
            "wire": "One exact shell-to-prefab bridge cleared cleanly enough to wire the traced boundary.",
            "quarantine": "The trace now preserves the ATU7 shell-to-prefab bridge, but broader title-side identity remains bounded so this row stays quarantined to remap evidence.",
            "research": "The trace is still too incomplete to preserve one bounded ATU7 bridge verdict.",
        },
    },
    "token-shop-atu3-cells-effect": {
        "wire": {"minPresentEdges": 5, "maxNegativeEdges": 0},
        "quarantine": {"minPresentEdges": 5, "allowedNegativeEdgeTypes": ["typed-effect-owner-recovery"]},
        "messages": {
            "wire": "The ATU3 effect lane is recovered cleanly enough to wire the traced gameplay boundary.",
            "quarantine": "The ATU3 effect lane is grounded enough to preserve as quarantined effect-driven remap evidence, but the typed gameplay owner remains unresolved.",
            "research": "The ATU3 effect trace still lacks enough checked structure to preserve a bounded gameplay verdict.",
        },
    },
    "token-shop-atu3-chest-consumer": {
        "wire": {"minPresentEdges": 6, "maxNegativeEdges": 0},
        "quarantine": {"minPresentEdges": 5, "allowedNegativeEdgeTypes": ["exact-cellboost-to-booster-bonus-handoff"]},
        "messages": {
            "wire": "The ATU3 chest-consumer handoff is recovered cleanly enough to wire the traced gameplay boundary.",
            "quarantine": "The ATU3 chest-consumer handoff is grounded enough to preserve as quarantined cross-system remap evidence, but the exact CellBoostBonus handoff remains unresolved.",
            "research": "The ATU3 chest-consumer trace still lacks enough checked structure to preserve a bounded consumer verdict.",
        },
    },
    "token-shop-atu3-chest-consumer-read": {
        "wire": {"minPresentEdges": 7, "maxNegativeEdges": 0},
        "quarantine": {"minPresentEdges": 6, "allowedNegativeEdgeTypes": ["exact-cellboost-to-booster-bonus-handoff"]},
        "messages": {
            "wire": "The ATU3 consumer-read chain is recovered cleanly enough to wire the traced gameplay boundary.",
            "quarantine": "The ATU3 consumer-read chain is grounded enough to preserve as quarantined bonus-shell evidence, but the exact CellBoostBonus read site remains unresolved.",
            "research": "The ATU3 consumer-read trace still lacks enough checked structure to preserve a bounded read-side verdict.",
        },
    },
    "shard-cost-su0-structure": {
        "wire": {"minPresentEdges": 5, "maxNegativeEdges": 0},
        "quarantine": {
            "minPresentEdges": 4,
            "allowedNegativeEdgeTypes": [
                "automated-calibration-closure",
                "planner-safe-cost-output",
                "save-owner-recovery",
            ],
        },
        "messages": {
            "wire": "The shard-cost trace is complete enough to wire direct app behavior.",
            "quarantine": "The shard-cost structure is grounded enough to preserve in quarantined descriptive tooling, but not to wire planner-safe cost outputs.",
            "research": "The shard-cost trace is still too incomplete to preserve even a quarantined structural verdict.",
        },
    },
    "shard-owned-state-upgradeinfolist-population": {
        "wire": {"minPresentEdges": 6, "maxNegativeEdges": 0},
        "quarantine": {
            "minPresentEdges": 5,
            "allowedNegativeEdgeTypes": [
                "local-runtime-population-bridge",
                "deeper-wrapper-handoff-recovery",
            ],
        },
        "messages": {
            "wire": "The shard owned-state path is recovered cleanly enough to wire player-owned shard import behavior.",
            "quarantine": "The shard owned-state trace is grounded enough to preserve one exact boundary verdict, but the result must stay quarantined to blocker evidence until a local bridge or deeper wrapper handoff is recovered.",
            "research": "The shard owned-state trace still lacks enough checked structure to preserve one bounded population verdict.",
        },
    },
    "multiverse-market-save-owner-boundary": {
        "wire": {"minPresentEdges": 5, "maxNegativeEdges": 0},
        "quarantine": {
            "minPresentEdges": 4,
            "allowedNegativeEdgeTypes": [
                "typed-market-field-recovery",
                "canonical-import-admissibility",
                "broad-row-identity-remap",
            ],
        },
        "messages": {
            "wire": "The save-owner trace is complete enough to wire canonical import behavior.",
            "quarantine": "The save-owner boundary is grounded enough to preserve as quarantined compatibility truth, but not to wire canonical import or planner behavior.",
            "research": "The save-owner trace still lacks enough checked owner-boundary recovery to preserve even a quarantined verdict.",
        },
    },
}

BOOTSTRAP_SUPPORT_CONTEXTS = {
    "token-shop-atu4-mod": {
        "shellField": "ATU4Button",
        "shellPathId": 15796,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 4,
        "surfaces": [
            {"id": "metadata-neighborhood", "label": "Metadata neighborhood", "sourceIds": ["metadata"], "terms": ["ATU4Button", "ModBoost", "BuyModBoost"]},
            {"id": "action-lane", "label": "Action hook lane", "sourceIds": ["level0"], "terms": ["BuyModBoost"]},
            {"id": "prefab-lane", "label": "Prefab identity lane", "sourceIds": ["level0", "sharedassets0"], "terms": ["NewTokenUPGPrefab.T1.ModPointsBooster"]},
            {"id": "title-lane", "label": "Mod title lane", "sourceIds": ["level0", "sharedassets0", "metadata"], "terms": ["Token Ultima: MP", ":Diamond Upgrade 11 - ModBoost"]},
            {"id": "text-hooks", "label": "Generic TokenShop text-hook lane", "sourceIds": ["level0", "sharedassets0"], "terms": ["SetAllTokenShopTexts", "SetTokenTexts"]},
        ],
        "lostStructure": [
            "The shell-side owner window survives directly in the TokenShop owner blob, where ATU4Button path id 15796 stays adjacent to the ModBoost base-value block.",
            "The exact BuyModBoost action hook, NewTokenUPGPrefab.T1.ModPointsBooster prefab, and direct UI slot graph now converge on the same traced row family.",
            "The remaining unresolved lane is not row identity or text localization; it is the live BUY-cost runtime path feeding CostText.",
        ],
    },
    "token-shop-atu5-mk1-title": {
        "shellField": "ATU5Button",
        "shellPathId": 15831,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 4,
        "surfaces": [
            {"id": "metadata-neighborhood", "label": "Metadata neighborhood", "sourceIds": ["metadata"], "terms": ["ATU5Button", "MK1TokenBoost", "BuyMK1TokenBoost"]},
            {"id": "action-lane", "label": "Action hook lane", "sourceIds": ["level0"], "terms": ["BuyMK1TokenBoost"]},
            {"id": "prefab-lane", "label": "Prefab identity lane", "sourceIds": ["level0", "sharedassets0"], "terms": ["NewTokenUPGPrefab.T1.MK1Booster"]},
            {"id": "support-text-lane", "label": "MK1 generator support-text lane", "sourceIds": ["level0", "sharedassets0"], "terms": ["1. MK1 Generator Output,", "This upgrade divides the cost of MK1 Generators by 1500.", "This upgrade provides a 1% increase to MK1 Generator Output for each Loop Reset you've done (multiplicative)"]},
            {"id": "title-roster-gap", "label": "Neighboring generator title roster", "sourceIds": ["level0", "sharedassets0"], "terms": ["Mk2 Generator Booster", "Mk3 Generator Booster", "Mk5 Generator Booster"]},
            {"id": "text-hooks", "label": "Generic TokenShop text-hook lane", "sourceIds": ["level0", "sharedassets0"], "terms": ["SetAllTokenShopTexts", "SetTokenTexts"]},
        ],
        "lostStructure": [
            "The shell-side owner window survives only in the TokenShop extract, where ATU5Button path id 15831 stays adjacent to the MK1TokenBoost owner block.",
            "The exact BuyMK1TokenBoost action hook and NewTokenUPGPrefab.T1.MK1Booster prefab now converge on the same traced row family, but the final player-facing title still survives only as detached MK1 generator support text and neighboring generator-booster title-roster surfaces.",
            "Because the title-side join is still missing, the recovered ATU5 bridge is safe for row-remap evidence only and should not widen into canonical or planner behavior.",
        ],
    },
    "token-shop-family-structure": {
        "shellField": "ATU1Button through ATU28Button",
        "shellPathId": "family-range",
        "shellWindowSource": "tokenShopExtract",
        "surfaces": [
            {"id": "family-shells", "label": "Family shell range", "sourceIds": ["tokenShopExtract", "metadata"], "terms": ["ATU1Button", "ATU2Button", "ATU3Button", "ATU4Button", "ATU5Button", "ATU6Button", "ATU7Button", "ATU24Button", "ATU28Button"]},
            {"id": "bridge-proxies", "label": "Bridge-proxy lane", "sourceIds": ["level0"], "terms": ["BuyTokenBoost", "ATU2DiamondsBonus", "BuyModBoost", "BuyMK1TokenBoost", "BuyMK2TokenBoost", "BuyMK3TokenBoost", "BuyCellBoost", "BuyATU24"]},
            {"id": "prefab-roster", "label": "Prefab identity roster", "sourceIds": ["level0", "sharedassets0"], "terms": ["NewTokenUPGPrefab.T1.TokensBoost", "NewTokenUPGPrefab.T1.DiamondBoost", "NewTokenUPGPrefab.T1.ModPointsBooster", "NewTokenUPGPrefab.T1.MK1Booster", "NewTokenUPGPrefab.T1.MK2Booster", "NewTokenUPGPrefab.T1.MK3Booster", "NewTokenUPGPrefab.T1.CellsPerChestBooster", "NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser"]},
            {"id": "title-text-surfaces", "label": "Title and text surfaces", "sourceIds": ["level0", "sharedassets0"], "terms": ["SetAllTokenShopTexts", "SetTokenTexts", "Mk2 Generator Booster", "Token Ultima: MP", "1. MK1 Generator Output,", "Token Ultima: Cells", "Academy Booster"]},
            {"id": "negative-neighborhoods", "label": "Bounded unresolved neighborhoods", "sourceIds": ["level0"], "terms": ["ATU3Button", "BuyCellBoost", "ATU24Button", "BuyATU24", "StartCellBostHold"]},
        ],
        "lostStructure": [
            "The family audit confirms that shell-side ATU serialization survives much more often than row-local title localization does.",
            "The strongest repeated solved pattern is shell adjacency plus one row-family proxy hook and one exact prefab identity, but the title-side surfaces usually remain detached into generic text hooks, support text, or loose title rosters.",
            "ATU6 remains the standout strongest neighborhood because it is still the only row that carries one checked shell-to-prefab-to-title chain; ATU4, ATU5, and ATU7 stay structurally stronger than ATU3 and the late ATU24-ATU28 block, but still stop short of final title localization.",
        ],
    },
    "token-shop-atu7-mk3-bridge": {
        "shellField": "ATU7Button",
        "shellPathId": 15792,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 4,
        "surfaces": [
            {"id": "metadata-neighborhood", "label": "Metadata neighborhood", "sourceIds": ["metadata"], "terms": ["ATU7Button", "MK3TokenBoost", "BuyMK3TokenBoost"]},
            {"id": "action-lane", "label": "Action hook lane", "sourceIds": ["level0"], "terms": ["BuyMK3TokenBoost"]},
            {"id": "prefab-lane", "label": "Prefab identity lane", "sourceIds": ["level0", "sharedassets0"], "terms": ["NewTokenUPGPrefab.T1.MK3Booster"]},
        ],
        "lostStructure": [
            "The shell-side owner window still survives only in the TokenShop extract, where ATU7Button path id 15792 stays adjacent to the MK3TokenBoost owner block.",
            "This pass checks only the shell-to-action-hook-to-prefab bridge and does not promote any final player-facing title join for ATU7.",
            "Because the rest of the MK-family shells still lack their own checked joins, keep ATU7 as one bounded remap bridge and leave the neighboring unresolved rows quarantined.",
        ],
    },
    "token-shop-atu3-cells-effect": {
        "shellField": "ATU3Button",
        "shellPathId": 15810,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 3,
        "surfaces": [
            {"id": "metadata-neighborhood", "label": "Metadata neighborhood", "sourceIds": ["metadata"], "terms": ["ATU3Button", "CellBoost", "BuyCellBoost"]},
            {"id": "action-lane", "label": "Action hook lane", "sourceIds": ["level0"], "terms": ["StartCellBostHold", "StopCellBostHold", "BuyCellBoost"]},
            {"id": "shared-effect-title", "label": "Shared effect title lane", "sourceIds": ["level0"], "terms": ["Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>"]},
            {"id": "shared-effect-text", "label": "Shared effect text lane", "sourceIds": ["level0"], "terms": ["<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>."]},
            {"id": "detached-identity-surfaces", "label": "Detached cells identity surfaces", "sourceIds": ["level0", "sharedassets0"], "terms": ["CellsBoost", "CellsPerChestBooster", "Token Ultima: Cells"]},
        ],
        "lostStructure": [
            "The shell-side owner window survives only in the TokenShop extract, where ATU3Button path id 15810 stays adjacent to the CellBoost owner block.",
            "The shared effect chain now reaches the Cells Booster (Chests) title and the +1 Seconds timeskip to Cells Gained from Token & Diamond Chests text, but no committed source yet names the exact typed gameplay owner that consumes CellBoostBonus inside that chest-effect system.",
            "The older diamond-side CellsBoost and token-side CellsPerChestBooster or Token Ultima: Cells surfaces still survive as detached identity clues, so this pass must stay effect-driven rather than pretending the row is a standard shell-to-prefab-to-title remap.",
        ],
    },
    "token-shop-atu3-chest-consumer": {
        "shellField": "ATU3Button",
        "shellPathId": 15810,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 3,
        "surfaces": [
            {"id": "metadata-neighborhood", "label": "Metadata neighborhood", "sourceIds": ["metadata"], "terms": ["ATU3Button", "CellBoost", "BuyCellBoost"]},
            {"id": "shared-effect-title", "label": "Shared effect title lane", "sourceIds": ["level0"], "terms": ["Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>"]},
            {"id": "shared-effect-text", "label": "Shared effect text lane", "sourceIds": ["level0"], "terms": ["<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>."]},
            {"id": "consumer-family", "label": "Chest consumer family", "sourceIds": ["level0"], "terms": ["AdManager, Assembly-CSharp", "SetAdChestTexts", "OfflineManager, Assembly-CSharp", "DailyAndAdCounterChecker"]},
            {"id": "consumer-routines", "label": "Chest routine and bonus shell", "sourceIds": ["metadata"], "terms": ["StartTokenRoutine", "<TokenChestRoutine>d__149", "GoToClosedTokenChest", "StartDiamondRoutine", "<DiamondChestRoutine>d__155", "GoToClosedDiamondChest", "get_SmallAdCellGains", "get_BigAdCellGains", "<FinalAdTokenChestBonus>k__BackingField", "<FinalDiamondChestBonus>k__BackingField"]},
            {"id": "chest-objects", "label": "Concrete chest objects", "sourceIds": ["level0"], "terms": ["TokenChest", "DiamondChest"]},
        ],
        "lostStructure": [
            "The shell-side owner window still survives only in the TokenShop extract, where ATU3Button path id 15810 stays adjacent to the CellBoost owner block.",
            "The upgraded cross-system trace now reaches the concrete AdManager chest routine family through StartTokenRoutine, TokenChestRoutine, StartDiamondRoutine, DiamondChestRoutine, the closed-chest route methods, and the final chest-bonus shell, but no committed source yet shows the exact CellBoostBonus read or typed field handoff inside that family.",
            "Because the exact CellBoostBonus consumer seam is still missing, keep ATU3 quarantined as an effect-driven row and do not convert this target into a standard prefab-or-title TokenShop remap claim.",
        ],
    },
    "token-shop-atu3-chest-consumer-read": {
        "shellField": "ATU3Button",
        "shellPathId": 15810,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 3,
        "surfaces": [
            {"id": "metadata-neighborhood", "label": "Metadata neighborhood", "sourceIds": ["metadata"], "terms": ["ATU3Button", "CellBoost", "BuyCellBoost"]},
            {"id": "consumer-family", "label": "Chest consumer family", "sourceIds": ["level0"], "terms": ["AdManager, Assembly-CSharp", "SetAdChestTexts", "OfflineManager, Assembly-CSharp", "DailyAndAdCounterChecker"]},
            {"id": "consumer-routines", "label": "Chest consumer routines", "sourceIds": ["metadata"], "terms": ["StartTokenRoutine", "<TokenChestRoutine>d__149", "GoToClosedTokenChest", "StartDiamondRoutine", "<DiamondChestRoutine>d__155", "GoToClosedDiamondChest"]},
            {"id": "cell-gain-getters", "label": "Chest cell-gain getter shell", "sourceIds": ["metadata"], "terms": ["get_SmallAdCellGains", "get_BigAdCellGains"]},
            {"id": "booster-bonus-shell", "label": "Booster bonus aggregation shell", "sourceIds": ["metadata"], "terms": ["SetBoosterAdBonus", "get_FinalBoosterAdBonus", "SmallAdCellGains", "BigAdCellGains", "FinalBoosterAdBonus", "<BoosterAdRoutine>d__158"]},
            {"id": "final-chest-bonus-shell", "label": "Final chest bonus shell", "sourceIds": ["metadata"], "terms": ["<FinalAdTokenChestBonus>k__BackingField", "<FinalDiamondChestBonus>k__BackingField"]},
        ],
        "lostStructure": [
            "The checked ATU3 chain now reaches the concrete AdManager consumer family and one tighter internal bonus-aggregation shell, but no committed source yet shows the exact CellBoostBonus read-site or typed-field handoff into that shell.",
            "The getter family and the booster bonus aggregation shell survive together in committed metadata, while the final token and diamond chest bonus backing fields survive in committed probe output, so the remaining runtime seam is narrow enough to stay quarantined to one exact internal handoff break.",
            "Because the exact CellBoostBonus runtime read is still missing, this trace should stay as effect-chain completion evidence only and should not widen into prefab, title, or planner promotion.",
        ],
    },
    "shard-cost-su0-structure": {
        "accessor": "get_SU0Cost",
        "ownerType": "ShardUpgradeInfo",
        "parameterShell": [
            "SU0StartCost",
            "SU0CostExponent",
            "SU0GrowthExponent",
            "SU0GrowthExponent2",
            "SU0GrowthExponent3",
        ],
    },
    "shard-owned-state-upgradeinfolist-population": {
        "sceneOwner": "ShardMining",
        "runtimeShell": "ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo",
        "genericLead": "ConstructionMilestones, Assembly-CSharp",
        "saveCandidate": "PlayerProfile-side shard member shell",
    },
    "multiverse-market-save-owner-boundary": {
        "accessorBridge": "PlayerProfileHandler.get_Market -> MultiverseMarket",
        "saveOwner": "SaveData",
        "typedSpan": "IS1Level through IS110Level",
        "compatibilityImportTargetPath": "compatibility.unmappedSystemState.multiverseMarket",
        "canonicalImportSafeSubsetLabel": "none",
        "broaderRowRemapStatus": "Broader row identity or remap stays blocked outside the checked 71-74 ordered overlap.",
        "blockedStructure": [
            "The wider inscription ordering outside rows 71-74 is not yet grounded enough from checked repo-local evidence to promote broader IS*Level row mappings.",
            "The checked repo-local evidence still does not recover player-facing row labels for rows 71-74, only their ordered row positions inside the larger inscription set.",
            "do not claim a broader IS*Level to inscription-row remap until repo-local evidence checks more than the ordered 71-74 overlap",
        ],
        "orderedOverlap": [71, 72, 73, 74],
    },
}

BOOTSTRAP_DEFAULT_ANCHORS = {
    "token-shop-atu4-mod": ["ATU4Button", "15796"],
    "token-shop-atu5-mk1-title": ["ATU5Button", "15831"],
    "token-shop-family-structure": ["ATU1Button", "ATU2Button", "ATU4Button", "ATU5Button", "ATU6Button", "ATU7Button", "ATU3Button", "ATU24Button", "SetAllTokenShopTexts"],
    "token-shop-atu7-mk3-bridge": ["ATU7Button", "15792"],
    "token-shop-atu3-cells-effect": ["ATU3Button", "15810"],
    "token-shop-atu3-chest-consumer": ["ATU3Button", "15810", "BuyCellBoost", "AdManager, Assembly-CSharp"],
    "token-shop-atu3-chest-consumer-read": ["ATU3Button", "15810", "get_SmallAdCellGains", "SetBoosterAdBonus", "get_FinalBoosterAdBonus"],
    "shard-cost-su0-structure": ["ShardUpgradeInfo", "get_SU0Cost", "SU0StartCost"],
    "shard-owned-state-upgradeinfolist-population": [
        "upgradeInfoList",
        "ShardMining+ShardUpgradeInfo",
        "IsUnlocked",
        "MaxLevel",
    ],
    "multiverse-market-save-owner-boundary": ["get_Market", "SaveData", "IS71Level"],
}


def _derive_family_graph_fragment(
    conn: sqlite3.Connection,
    trace_scope: str,
    payload: dict[str, Any],
    assessment_summary: dict[str, Any] | None = None,
    target_narrative_fragment: dict[str, Any] | None = None,
    token_shop_reconstruction_fragment: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    family_id = str(target.get("familyId") or "").strip()
    if not family_id:
        return None
    if family_id == "token-shop":
        return _derive_token_shop_family_graph_fragment(
            trace_scope,
            token_shop_reconstruction_fragment,
            assessment_summary,
        )

    family_label = FAMILY_GRAPH_LABELS.get(family_id, family_id.replace("-", " "))
    assessment = dict(assessment_summary or {})
    narrative = dict(target_narrative_fragment or {})
    dependency_payloads = [
        fragment
        for fragment in _load_canonical_semantic_fragment_payloads(conn, "dependency_fragment")
        if trace_scope in list(((fragment.get("support") or {}).get("contributingTraceScopes") or []))
    ]
    support_scope = _load_canonical_semantic_fragment_payload(
        conn,
        "semantic_scope_fragment",
        "shard-owned-state:upgradeinfolist-population",
    ) if family_id == "shard-owned-state" else {}
    row_shells: list[dict[str, Any]] = []
    if support_scope:
        runtime_shell = dict(support_scope.get("runtimeShell") or {})
        declaring_field = dict(runtime_shell.get("declaringField") or {})
        row_shells.append(
            {
                "field": str(declaring_field.get("name") or runtime_shell.get("label") or ""),
                "pathId": None,
            }
        )
    core_terms: list[str] = []
    for fragment in dependency_payloads:
        edge = dict(fragment.get("edge") or {})
        core_terms.extend(
            [
                str(edge.get("from") or ""),
                str(edge.get("to") or ""),
                *[
                    str(item.get("term") or "")
                    for item in (edge.get("provedBy") or [])
                    if isinstance(item, dict)
                ],
            ]
        )
    if support_scope:
        runtime_shell = dict(support_scope.get("runtimeShell") or {})
        core_terms.extend(
            [
                str(runtime_shell.get("label") or ""),
                str(((runtime_shell.get("rowModelType") or {}).get("fullName") or "")),
                str((((support_scope.get("sceneOwner") or {}).get("name")) or "")),
            ]
        )
    return {
        "semanticKey": f"family-graph:{family_id}",
        "scopeType": "family-graph",
        "familyId": family_id,
        "familyLabel": family_label,
        "traceScope": trace_scope,
        "targetId": str(target.get("id") or trace_scope),
        "rowShells": [item for item in row_shells if item.get("field") or item.get("pathId") is not None],
        "coreTerms": _unique_strings([term for term in core_terms if term]),
        "supportingEdgeTypes": list(assessment.get("supportingEdgeTypes") or []),
        "assessment": {
            "verdict": assessment.get("verdict"),
            "blockedEdgeTypes": list(assessment.get("blockedEdgeTypes") or []),
            "summary": str(assessment.get("summary") or ""),
        },
        "groundedConclusion": str(narrative.get("groundedConclusion") or ""),
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": _collect_trace_support_metadata(
            trace_scope,
            str(target.get("id") or trace_scope),
            [
                dict((fragment.get("support") or {}))
                for fragment in dependency_payloads
            ] + [
                dict((support_scope.get("support") or {})) if support_scope else {},
                dict((assessment.get("support") or {})) if isinstance(assessment.get("support"), dict) else {},
            ],
        ),
    }


def _derive_target_assessment_fragment(
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    target_id = str(target.get("id") or trace_scope).strip()
    family_id = str(target.get("familyId") or "").strip()
    if not target_id:
        return None
    trace_graph = dict(payload.get("traceGraph") or {})
    proved_edges = list(trace_graph.get("edges") or [])
    negative_edges = list(trace_graph.get("negativeEdges") or [])
    negative_types = [
        str(edge.get("type"))
        for edge in negative_edges
        if isinstance(edge, dict) and str(edge.get("type") or "")
    ]
    diff = dict(((payload.get("solvedVsBlockedDiff") or {}).get("delta") or {}))
    baseline_gap = list(diff.get("blockedMissingEdgeTypes") or negative_types)
    native_summary = dict(payload.get("nativeReconstruction") or {})
    rules = dict(target.get("outputSummaryRules") or {})
    if not rules:
        rules = dict(
            BOOTSTRAP_OUTPUT_SUMMARY_RULES.get(trace_scope)
            or BOOTSTRAP_OUTPUT_SUMMARY_RULES.get(target_id)
            or {}
        )
    legacy_decision_summary = dict(payload.get("decisionSummary") or {})

    if not rules:
        if legacy_decision_summary:
            verdict = str(legacy_decision_summary.get("verdict") or "missing-output-summary-rules")
            summary = str(legacy_decision_summary.get("summary") or "").strip() or (
                "Canonical assessment policy is missing for this target payload. "
                "This reducer is preserving the last embedded legacy verdict until the trace is rerun."
            )
            baseline_gap = list(legacy_decision_summary.get("baselineGap") or baseline_gap)
        else:
            verdict = "missing-output-summary-rules"
            summary = (
                "Canonical assessment policy is missing for this target payload. "
                "Re-run the trace bundle and rebuild trace views before trusting verdict state."
            )
    else:
        wire = dict(rules.get("wire") or {})
        quarantine = dict(rules.get("quarantine") or {})
        if len(proved_edges) >= int(wire.get("minPresentEdges", 0) or 0) and len(negative_edges) <= int(wire.get("maxNegativeEdges", 0) or 0):
            verdict = "wire"
        elif len(proved_edges) >= int(quarantine.get("minPresentEdges", 0) or 0) and all(edge_type in (quarantine.get("allowedNegativeEdgeTypes") or []) for edge_type in negative_types):
            verdict = "quarantine"
        else:
            verdict = "keep researching"
        summary_messages = dict(rules.get("messages") or {})
        summary = str(summary_messages.get("research" if verdict == "keep researching" else verdict) or "").strip()

    promoted_owner = str(native_summary.get("promotedOwner") or "").strip()
    promoted_methods = [str(value) for value in (native_summary.get("promotedMethods") or []) if str(value).strip()]
    promoted_fields = [str(value) for value in (native_summary.get("promotedFields") or []) if str(value).strip()]
    if promoted_owner:
        chain_bits: list[str] = []
        if promoted_methods:
            chain_bits.append("methods {}".format(", ".join(promoted_methods[:3])))
        if promoted_fields:
            chain_bits.append("fields {}".format(", ".join(promoted_fields[:4])))
        if chain_bits:
            summary = "{} Native reconstruction now ties this lane to {} via {}.".format(
                summary,
                promoted_owner,
                " and ".join(chain_bits),
            ).strip()
        else:
            summary = "{} Native reconstruction now ties this lane to {}.".format(summary, promoted_owner).strip()

    support = _collect_trace_support_metadata(
        trace_scope,
        target_id,
        [
            dict(provenance.get("traceGraph") or {}),
            dict(provenance.get("nativeReconstruction") or {}),
            dict(provenance.get("solvedVsBlockedDiff") or {}),
        ],
    )
    return {
        "semanticKey": f"target-assessment:{trace_scope}",
        "scopeType": "target-assessment",
        "traceScope": trace_scope,
        "targetId": target_id,
        "familyId": family_id,
        "decisionSummary": {
            "verdict": verdict,
            "summary": summary,
            "provedEdgeCount": len(proved_edges),
            "negativeEdgeCount": len(negative_edges),
            "baselineGap": baseline_gap,
            "supportingEdgeTypes": (
                list(legacy_decision_summary.get("supportingEdgeTypes") or [])
                if not rules and legacy_decision_summary.get("supportingEdgeTypes")
                else [
                    str(edge.get("type"))
                    for edge in proved_edges
                    if isinstance(edge, dict) and str(edge.get("type") or "")
                ]
            ),
            "blockedEdgeTypes": (
                list(legacy_decision_summary.get("blockedEdgeTypes") or [])
                if not rules and legacy_decision_summary.get("blockedEdgeTypes")
                else negative_types
            ),
        },
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_execution_context_fragment(
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    planner_resolution = dict(payload.get("plannerResolution") or {})
    trace_registry = dict(payload.get("traceRegistry") or {})
    trace_workflow = dict(payload.get("traceWorkflow") or {})
    target_id = str(target.get("id") or trace_scope or "").strip()
    family_id = str(target.get("familyId") or trace_registry.get("selectedFamilyId") or "").strip()
    label = str(target.get("label") or "").strip()
    accepted_anchors = [str(value) for value in (trace_workflow.get("acceptedAnchors") or []) if str(value).strip()]
    join_goal = str(target.get("joinGoal") or "").strip()
    solved_baseline_target_id = str(target.get("solvedBaselineTargetId") or trace_registry.get("solvedBaselineTargetId") or "").strip()
    blocked_target_id = str(target.get("blockedTargetId") or trace_registry.get("blockedTargetId") or "").strip()
    output_summary_rules = dict(target.get("outputSummaryRules") or {})
    if not output_summary_rules:
        output_summary_rules = dict(
            BOOTSTRAP_OUTPUT_SUMMARY_RULES.get(trace_scope)
            or BOOTSTRAP_OUTPUT_SUMMARY_RULES.get(target_id)
            or {}
        )
    selected_subject_kind = str(planner_resolution.get("selectedSubjectKind") or trace_registry.get("selectedSubjectKind") or "").strip()
    selected_subject_key = str(planner_resolution.get("selectedSubjectKey") or trace_registry.get("selectedSubjectKey") or "").strip()
    execution_target_id = str(trace_registry.get("executionTargetId") or target_id).strip()
    execution_trace_scope = str(trace_registry.get("executionTraceScope") or trace_scope).strip()
    if not any(
        [
            target_id,
            family_id,
            label,
            accepted_anchors,
            join_goal,
            solved_baseline_target_id,
            blocked_target_id,
            output_summary_rules,
            selected_subject_kind,
            selected_subject_key,
            execution_target_id,
            execution_trace_scope,
        ]
    ):
        return None
    support = _collect_trace_support_metadata(
        trace_scope,
        target_id or trace_scope,
        [
            dict(provenance.get("target") or {}),
            dict(provenance.get("plannerResolution") or {}),
            dict(provenance.get("traceRegistry") or {}),
            dict(provenance.get("traceWorkflow") or {}),
        ],
    )
    return {
        "semanticKey": f"target-execution-context:{trace_scope}",
        "scopeType": "target-execution-context",
        "traceScope": trace_scope,
        "targetId": target_id or trace_scope,
        "executionTargetId": execution_target_id or target_id or trace_scope,
        "executionTraceScope": execution_trace_scope or trace_scope,
        "familyId": family_id,
        "label": label,
        "acceptedAnchors": accepted_anchors,
        "joinGoal": join_goal,
        "solvedBaselineTargetId": solved_baseline_target_id or None,
        "blockedTargetId": blocked_target_id or None,
        "outputSummaryRules": output_summary_rules or None,
        "selectedSubjectKind": selected_subject_kind or None,
        "selectedSubjectKey": selected_subject_key or None,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_token_shop_execution_plan_fragment(
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
    token_shop_scope: dict[str, Any] | None = None,
    token_shop_reconstruction_fragment: dict[str, Any] | None = None,
    family_graph_fragment: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    if str(target.get("familyId") or "") != "token-shop":
        return None
    native_trace = dict(payload.get("nativeTrace") or {})
    native_summary = dict(payload.get("nativeReconstruction") or native_trace.get("summary") or {})
    source_ids = _unique_strings([str(entry.get("sourceId") or "") for entry in (payload.get("sourceRoles") or []) if str(entry.get("sourceId") or "").strip()])
    if not source_ids:
        source_ids = ["metadata", "level0", "assets", "native"]

    follow_up_terms: list[str] = []
    join_goal = str(target.get("joinGoal") or "").strip()
    claim_stages: list[dict[str, Any]] = []
    depth_plan: list[dict[str, Any]] = []

    if token_shop_scope:
        row_scope = dict(token_shop_scope)
        row_local_graph = dict(row_scope.get("rowLocalGraph") or {})
        row_shell = dict(row_local_graph.get("rowShell") or {})
        missing_seams = list(row_scope.get("missingSeams") or [])
        seam_ids = _unique_strings([str(item.get("id") or "") for item in missing_seams if str(item.get("id") or "").strip()])
        follow_up_terms = _unique_strings(
            [
                str(row_shell.get("field") or ""),
                str(row_local_graph.get("nativePromotedOwner") or ""),
                *[str(value) for value in (row_local_graph.get("actionMethods") or [])],
                *[str(value) for value in (row_local_graph.get("prefabCandidates") or [])],
                *[str(value) for value in (row_local_graph.get("updateHooks") or [])],
                *[str(value) for value in (row_local_graph.get("formulaFields") or [])],
                *[str(value) for value in (native_trace.get("searchTerms") or [])],
            ]
        )
        if seam_ids:
            join_goal = (
                f"Reconstruct the Token Shop {row_shell.get('field') or trace_scope} row from current canonical fragments "
                f"and close the remaining adjacent seams: {', '.join(seam_ids)}."
            )
        elif row_shell.get("field"):
            join_goal = f"Recheck the recovered Token Shop {row_shell.get('field')} row and verify that no adjacent seam has reopened."
        claim_stages = [
            {
                "id": "row-local-graph",
                "label": f"{row_shell.get('field') or trace_scope} row-local graph",
                "status": str((row_scope.get("compatibilityStatus") or {}).get("semanticStatus") or "open"),
                "missingSeamIds": seam_ids,
            },
            {
                "id": "runtime-model",
                "label": f"{row_shell.get('field') or trace_scope} runtime model",
                "status": str((row_scope.get("compatibilityStatus") or {}).get("runtimeStatus") or "open"),
                "missingSeamIds": ["runtime-model-gap"] if "runtime-model-gap" in seam_ids else [],
            },
        ]
        depth_plan = [
            {
                "hop": 1,
                "goal": (
                    f"Close adjacent row seams for {row_shell.get('field') or trace_scope}: {', '.join(seam_ids)}."
                    if seam_ids
                    else f"Recheck adjacent row-local graph for {row_shell.get('field') or trace_scope}."
                ),
                "terms": follow_up_terms[:12],
                "sourceIds": source_ids,
            }
        ]
        if "runtime-model-gap" in seam_ids:
            runtime_value_terms = []
            for value in (row_local_graph.get("formulaValues") or []):
                if isinstance(value, dict):
                    runtime_value_terms.append(str(value.get("field") or value.get("label") or ""))
                else:
                    runtime_value_terms.append(str(value))
            runtime_terms = _unique_strings(
                [
                    *[str(value) for value in (row_local_graph.get("formulaFields") or [])],
                    *runtime_value_terms,
                    *[str(value) for value in (native_summary.get("searchTerms") or [])],
                ]
            )
            if runtime_terms:
                depth_plan.append(
                    {
                        "hop": 2,
                        "goal": f"Resolve the runtime-model-gap for {row_shell.get('field') or trace_scope}.",
                        "terms": runtime_terms[:12],
                        "sourceIds": _unique_strings([source_id for source_id in source_ids if source_id in {"metadata", "level0", "native", "assets"}]),
                    }
                )
    elif token_shop_reconstruction_fragment:
        reconstruction = dict(token_shop_reconstruction_fragment)
        row_shell = dict(reconstruction.get("rowShell") or {})
        presentation = dict(reconstruction.get("presentation") or {})
        assessment = dict(reconstruction.get("assessment") or {})
        blocked_edge_types = _unique_strings([str(value) for value in (assessment.get("blockedEdgeTypes") or [])])
        follow_up_terms = _unique_strings(
            [
                str(row_shell.get("field") or ""),
                *[str(value) for value in (presentation.get("slotRoles") or [])],
                *[str(value) for value in (native_trace.get("searchTerms") or [])],
            ]
        )
        join_goal = (
            f"Reconstruct the Token Shop family shell from current canonical fragments and audit the remaining family seams: {', '.join(blocked_edge_types)}."
            if blocked_edge_types
            else "Recheck the Token Shop family shell from current canonical fragments and verify no family seam reopened."
        )
        claim_stages = [
            {
                "id": "family-shell",
                "label": "Token Shop family shell",
                "status": "open" if blocked_edge_types else "closed",
                "missingSeamIds": blocked_edge_types,
            }
        ]
        depth_plan = [
            {
                "hop": 1,
                "goal": join_goal,
                "terms": follow_up_terms[:12],
                "sourceIds": source_ids,
            }
        ]

    if not join_goal:
        return None

    support_payloads = [dict(provenance.get("traceGraph") or {}), dict(provenance.get("nativeReconstruction") or {})]
    if token_shop_scope:
        support_payloads.append(dict(token_shop_scope.get("support") or {}))
    if token_shop_reconstruction_fragment:
        support_payloads.append(dict(token_shop_reconstruction_fragment.get("support") or {}))
    if family_graph_fragment:
        support_payloads.append(dict(family_graph_fragment.get("support") or {}))
    support = _collect_trace_support_metadata(
        trace_scope,
        str(target.get("id") or trace_scope),
        support_payloads,
    )
    return {
        "semanticKey": f"target-execution-plan:{trace_scope}",
        "traceScope": trace_scope,
        "targetId": str(target.get("id") or trace_scope),
        "familyId": "token-shop",
        "subjectKind": "family-graph" if family_graph_fragment else "semantic-scope",
        "joinGoal": join_goal,
        "followUpTerms": follow_up_terms,
        "claimStages": claim_stages,
        "depthPlan": depth_plan,
        "sourceIds": source_ids,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_generic_execution_plan_fragment(
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
    assessment_summary: dict[str, Any] | None = None,
    family_graph_fragment: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    family_id = str(target.get("familyId") or "").strip()
    if not family_id or family_id == "token-shop":
        return None
    native_trace = dict(payload.get("nativeTrace") or {})
    assessment = dict(assessment_summary or {})
    family_graph = dict(family_graph_fragment or {})
    blocked_edge_types = _unique_strings([str(value) for value in (assessment.get("blockedEdgeTypes") or [])])
    core_terms = _unique_strings([str(value) for value in (family_graph.get("coreTerms") or [])])
    row_shell_terms = []
    for item in (family_graph.get("rowShells") or []):
        if isinstance(item, dict):
            row_shell_terms.extend([str(item.get("field") or ""), str(item.get("pathId") or "")])
    follow_up_terms = _unique_strings([*core_terms, *row_shell_terms, *[str(value) for value in (native_trace.get("searchTerms") or [])]])
    source_ids = _unique_strings([str(entry.get("sourceId") or "") for entry in (payload.get("sourceRoles") or []) if str(entry.get("sourceId") or "").strip()])
    if not source_ids:
        source_ids = ["metadata", "level0", "assets", "native"]
    family_label = str(family_graph.get("familyLabel") or target.get("label") or family_id)
    join_goal = (
        f"Reconstruct the {family_label} subject from current canonical fragments and close the remaining adjacent seams: {', '.join(blocked_edge_types)}."
        if blocked_edge_types
        else f"Recheck the recovered {family_label} subject from current canonical fragments and verify no adjacent seam reopened."
    )
    claim_stages = [
        {
            "id": "family-subject",
            "label": family_label,
            "status": "open" if blocked_edge_types else "closed",
            "missingSeamIds": blocked_edge_types,
        }
    ]
    depth_plan = [
        {
            "hop": 1,
            "goal": join_goal,
            "terms": follow_up_terms[:12],
            "sourceIds": source_ids,
        }
    ]
    support = _collect_trace_support_metadata(
        trace_scope,
        str(target.get("id") or trace_scope),
        [
            dict(provenance.get("traceGraph") or {}),
            dict(provenance.get("nativeReconstruction") or {}),
            dict((family_graph_fragment or {}).get("support") or {}),
        ],
    )
    return {
        "semanticKey": f"target-execution-plan:{trace_scope}",
        "traceScope": trace_scope,
        "targetId": str(target.get("id") or trace_scope),
        "familyId": family_id,
        "subjectKind": "family-graph",
        "joinGoal": join_goal,
        "followUpTerms": follow_up_terms,
        "claimStages": claim_stages,
        "depthPlan": depth_plan,
        "sourceIds": source_ids,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_surface_plan_fragment(
    conn: sqlite3.Connection,
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    family_id = str(target.get("familyId") or "").strip()
    if family_id != "token-shop":
        return None
    shell_window = dict(_load_latest_trace_fragment_payload(conn, trace_scope, "shellWindow") or {})
    surfaces = list(_load_latest_trace_fragment_payload(conn, trace_scope, "surfaces") or [])
    if not shell_window or not surfaces:
        return None
    surface_plans: list[dict[str, Any]] = []
    for surface in surfaces:
        if not isinstance(surface, dict):
            continue
        source_ids = _unique_strings(
            [
                str(source.get("sourceId") or "")
                for source in (surface.get("sources") or [])
                if isinstance(source, dict) and str(source.get("sourceId") or "").strip()
            ]
        )
        surface_plans.append(
            {
                "id": str(surface.get("id") or ""),
                "label": str(surface.get("label") or ""),
                "terms": _unique_strings([str(value) for value in (surface.get("terms") or [])]),
                "sourceIds": source_ids,
            }
        )
    if not surface_plans:
        return None
    support = _collect_trace_support_metadata(
        trace_scope,
        str(target.get("id") or trace_scope),
        [
            dict(provenance.get("shellWindow") or {}),
            dict(provenance.get("surfaces") or {}),
        ],
    )
    return {
        "semanticKey": f"target-surface-plan:{trace_scope}",
        "traceScope": trace_scope,
        "targetId": str(target.get("id") or trace_scope),
        "familyId": family_id,
        "shellWindow": shell_window,
        "surfacePlans": surface_plans,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_graph_plan_fragment(
    conn: sqlite3.Connection,
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    family_id = str(target.get("familyId") or "").strip()
    if not family_id or family_id == "exploration":
        return None
    trace_graph = dict(_load_latest_trace_fragment_payload(conn, trace_scope, "traceGraph") or {})
    if not trace_graph:
        return None
    support = _collect_trace_support_metadata(
        trace_scope,
        str(target.get("id") or trace_scope),
        [
            dict(provenance.get("traceGraph") or {}),
        ],
    )
    return {
        "semanticKey": f"target-graph-plan:{trace_scope}",
        "traceScope": trace_scope,
        "targetId": str(target.get("id") or trace_scope),
        "familyId": family_id,
        "traceGraph": trace_graph,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_bridge_policy_fragment(
    conn: sqlite3.Connection,
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    family_id = str(target.get("familyId") or "").strip()
    if not family_id or family_id == "exploration":
        return None
    bridge_rule = str(_load_latest_trace_fragment_payload(conn, trace_scope, "bridgePromotionRule") or payload.get("bridgePromotionRule") or "").strip()
    lost_structure = list(_load_latest_trace_fragment_payload(conn, trace_scope, "lostStructure") or payload.get("lostStructure") or [])
    if not bridge_rule and not lost_structure:
        return None
    support = _collect_trace_support_metadata(
        trace_scope,
        str(target.get("id") or trace_scope),
        [
            dict(provenance.get("traceGraph") or {}),
            dict(provenance.get("bridgeCheck") or {}),
        ],
    )
    return {
        "semanticKey": f"target-bridge-policy:{trace_scope}",
        "traceScope": trace_scope,
        "targetId": str(target.get("id") or trace_scope),
        "familyId": family_id,
        "bridgePromotionRule": bridge_rule,
        "lostStructure": [str(item) for item in lost_structure if str(item).strip()],
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_target_narrative_fragment(
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    target = dict(payload.get("target") or {})
    target_id = str(target.get("id") or trace_scope or "").strip()
    family_id = str(target.get("familyId") or "").strip()
    narrative_seed = dict(payload.get("narrative_seed_fragment") or {})
    if not narrative_seed:
        narrative_seed = dict((provenance.get("narrative_seed_fragment") or {}).get("rawPayload") or {})
    if not narrative_seed:
        narrative_seed = dict((provenance.get("reconstruction_note_fragment") or {}).get("rawPayload") or {})
    if not narrative_seed:
        narrative_seed = dict(payload.get("reconstruction_note_fragment") or {})
    grounded_conclusion = str(narrative_seed.get("groundedConclusion") or "").strip()
    current_boundary = [
        str(line).strip()
        for line in (narrative_seed.get("currentBoundary") or [])
        if str(line).strip()
    ]
    if not grounded_conclusion and not current_boundary:
        return None
    support = _collect_trace_support_metadata(
        trace_scope,
        target_id,
        [
            dict(provenance.get("narrative_seed_fragment") or {}),
            dict(provenance.get("reconstruction_note_fragment") or {}),
        ],
    )
    return {
        "semanticKey": f"target-narrative:{trace_scope}",
        "scopeType": "target-narrative",
        "traceScope": trace_scope,
        "targetId": target_id,
        "familyId": family_id,
        "groundedConclusion": grounded_conclusion,
        "currentBoundary": current_boundary,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_target_bridge_comparison_fragment(
    trace_scope: str,
    payload: dict[str, Any],
    provenance: dict[str, Any],
) -> dict[str, Any] | None:
    if trace_scope not in {
        "shard-owned-state-upgradeinfolist-population",
        "multiverse-market-save-owner-boundary",
    }:
        return None
    target = dict(payload.get("target") or {})
    target_id = str(target.get("id") or trace_scope or "").strip()
    family_id = str(target.get("familyId") or "").strip()
    seed = dict(payload.get("bridge_comparison_seed_fragment") or {})
    if not seed:
        seed = dict((provenance.get("bridge_comparison_seed_fragment") or {}).get("rawPayload") or {})
    if not seed:
        return None
    bridge_check = dict(seed.get("bridgeCheck") or {})
    solved_vs_blocked = dict(seed.get("solvedVsBlockedDiff") or {})
    if not bridge_check and not solved_vs_blocked:
        return None
    support = _collect_trace_support_metadata(
        trace_scope,
        target_id,
        [
            dict(provenance.get("bridge_comparison_seed_fragment") or {}),
            dict(provenance.get("traceGraph") or {}),
            dict(provenance.get("outcome") or {}),
        ],
    )
    return {
        "semanticKey": f"target-bridge-comparison:{trace_scope}",
        "scopeType": "target-bridge-comparison",
        "traceScope": trace_scope,
        "targetId": target_id,
        "familyId": family_id,
        "bridgeCheck": bridge_check,
        "solvedVsBlockedDiff": solved_vs_blocked,
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "support": support,
    }


def _derive_reducer_semantic_fragments(
    conn: sqlite3.Connection,
    trace_groups: dict[tuple[str, str, str, str], dict[str, Any]],
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for (project_name, project_file, trace_scope, _request_signature), value in trace_groups.items():
        payload = dict(value.get("payload") or {})
        provenance = dict(value.get("provenance") or {})
        execution_context_fragment = _derive_execution_context_fragment(trace_scope, payload, provenance)
        if execution_context_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "execution_context_fragment",
                    "fragment_key": str(execution_context_fragment.get("semanticKey") or ""),
                    "payload": execution_context_fragment,
                    "provenance": {
                        **dict(execution_context_fragment.get("support") or {}),
                        "reducer": "derived-execution-context-fragment-v1",
                    },
                    "reducer_version": "derived-execution-context-fragment-v1",
                }
            )
        assessment_fragment = _derive_target_assessment_fragment(trace_scope, payload, provenance)
        assessment_summary = dict((assessment_fragment or {}).get("decisionSummary") or {})
        if assessment_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "assessment_fragment",
                    "fragment_key": str(assessment_fragment.get("semanticKey") or ""),
                    "payload": assessment_fragment,
                    "provenance": {
                        **dict(assessment_fragment.get("support") or {}),
                        "reducer": "derived-target-assessment-fragment-v1",
                    },
                    "reducer_version": "derived-target-assessment-fragment-v1",
                }
            )
        target_narrative_fragment = _derive_target_narrative_fragment(trace_scope, payload, provenance)
        if target_narrative_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "target_narrative_fragment",
                    "fragment_key": str(target_narrative_fragment.get("semanticKey") or ""),
                    "payload": target_narrative_fragment,
                    "provenance": {
                        **dict(target_narrative_fragment.get("support") or {}),
                        "reducer": "derived-target-narrative-fragment-v1",
                    },
                    "reducer_version": "derived-target-narrative-fragment-v1",
                }
            )
        bridge_comparison_fragment = _derive_target_bridge_comparison_fragment(trace_scope, payload, provenance)
        if bridge_comparison_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "bridge_comparison_fragment",
                    "fragment_key": str(bridge_comparison_fragment.get("semanticKey") or ""),
                    "payload": bridge_comparison_fragment,
                    "provenance": {
                        **dict(bridge_comparison_fragment.get("support") or {}),
                        "reducer": "derived-target-bridge-comparison-fragment-v1",
                    },
                    "reducer_version": "derived-target-bridge-comparison-fragment-v1",
                }
            )
        shard_scope = _derive_shard_owned_state_semantic_scope(trace_scope, payload, provenance)
        if shard_scope is None:
            shard_scope = None
        else:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "semantic_scope_fragment",
                    "fragment_key": str(shard_scope.get("scopeId") or ""),
                    "payload": shard_scope,
                    "provenance": {
                        **dict(shard_scope.get("support") or {}),
                        "reducer": "derived-shard-owned-state-semantic-scope-v2",
                    },
                    "reducer_version": "derived-shard-owned-state-semantic-scope-v2",
                }
            )
        token_shop_scope = _derive_token_shop_row_semantic_scope(trace_scope, payload, provenance)
        if token_shop_scope is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "semantic_scope_fragment",
                    "fragment_key": str(token_shop_scope.get("scopeId") or ""),
                    "payload": token_shop_scope,
                    "provenance": {
                        **dict(token_shop_scope.get("support") or {}),
                        "reducer": "derived-token-shop-row-semantic-scope-v1",
                    },
                    "reducer_version": "derived-token-shop-row-semantic-scope-v1",
                }
            )
        token_shop_updater_scope = _derive_token_shop_updater_display_semantic_scope(
            conn,
            trace_scope,
            payload,
            provenance,
            assessment_summary,
        )
        if token_shop_updater_scope is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "semantic_scope_fragment",
                    "fragment_key": str(token_shop_updater_scope.get("scopeId") or ""),
                    "payload": token_shop_updater_scope,
                    "provenance": {
                        **dict(token_shop_updater_scope.get("support") or {}),
                        "reducer": "derived-token-shop-updater-display-semantic-scope-v1",
                    },
                    "reducer_version": "derived-token-shop-updater-display-semantic-scope-v1",
                }
            )
        token_shop_reconstruction_fragment = _derive_token_shop_reconstruction_fragment(
            conn,
            trace_scope,
            payload,
            provenance,
            token_shop_scope,
            assessment_summary,
        )
        if token_shop_reconstruction_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "token_shop_reconstruction_fragment",
                    "fragment_key": str(token_shop_reconstruction_fragment.get("semanticKey") or ""),
                    "payload": token_shop_reconstruction_fragment,
                    "provenance": {
                        **dict(token_shop_reconstruction_fragment.get("support") or {}),
                        "reducer": "derived-token-shop-reconstruction-fragment-v1",
                    },
                    "reducer_version": "derived-token-shop-reconstruction-fragment-v1",
                }
            )
        family_graph_fragment = _derive_family_graph_fragment(
            conn,
            trace_scope,
            payload,
            assessment_summary,
            target_narrative_fragment,
            token_shop_reconstruction_fragment,
        )
        if family_graph_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "family_graph_fragment",
                    "fragment_key": str(family_graph_fragment.get("semanticKey") or ""),
                    "payload": family_graph_fragment,
                    "provenance": {
                        **dict(family_graph_fragment.get("support") or {}),
                        "reducer": "derived-family-graph-fragment-v1",
                    },
                    "reducer_version": "derived-family-graph-fragment-v1",
                }
            )
        execution_plan_fragment = _derive_token_shop_execution_plan_fragment(
            trace_scope,
            payload,
            provenance,
            token_shop_scope,
            token_shop_reconstruction_fragment,
            family_graph_fragment,
        )
        if execution_plan_fragment is None:
            execution_plan_fragment = _derive_generic_execution_plan_fragment(
                trace_scope,
                payload,
                provenance,
                assessment_summary,
                family_graph_fragment,
            )
        if execution_plan_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "execution_plan_fragment",
                    "fragment_key": str(execution_plan_fragment.get("semanticKey") or ""),
                    "payload": execution_plan_fragment,
                    "provenance": {
                        **dict(execution_plan_fragment.get("support") or {}),
                        "reducer": "derived-token-shop-execution-plan-fragment-v1",
                    },
                    "reducer_version": "derived-token-shop-execution-plan-fragment-v1",
                }
            )
        surface_plan_fragment = _derive_surface_plan_fragment(
            conn,
            trace_scope,
            payload,
            provenance,
        )
        if surface_plan_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "surface_plan_fragment",
                    "fragment_key": str(surface_plan_fragment.get("semanticKey") or ""),
                    "payload": surface_plan_fragment,
                    "provenance": {
                        **dict(surface_plan_fragment.get("support") or {}),
                        "reducer": "derived-surface-plan-fragment-v1",
                    },
                    "reducer_version": "derived-surface-plan-fragment-v1",
                }
            )
        graph_plan_fragment = _derive_graph_plan_fragment(
            conn,
            trace_scope,
            payload,
            provenance,
        )
        if graph_plan_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "graph_plan_fragment",
                    "fragment_key": str(graph_plan_fragment.get("semanticKey") or ""),
                    "payload": graph_plan_fragment,
                    "provenance": {
                        **dict(graph_plan_fragment.get("support") or {}),
                        "reducer": "derived-graph-plan-fragment-v1",
                    },
                    "reducer_version": "derived-graph-plan-fragment-v1",
                }
            )
        bridge_policy_fragment = _derive_bridge_policy_fragment(
            conn,
            trace_scope,
            payload,
            provenance,
        )
        if bridge_policy_fragment is not None:
            entries.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "fragment_kind": "bridge_policy_fragment",
                    "fragment_key": str(bridge_policy_fragment.get("semanticKey") or ""),
                    "payload": bridge_policy_fragment,
                    "provenance": {
                        **dict(bridge_policy_fragment.get("support") or {}),
                        "reducer": "derived-bridge-policy-fragment-v1",
                    },
                    "reducer_version": "derived-bridge-policy-fragment-v1",
                }
            )
    return entries


def _is_ignored_legacy_trace_fragment(row: sqlite3.Row) -> bool:
    fragment_kind = str(row["fragment_kind"])
    fragment_key = str(row["fragment_key"])
    trace_scope = str(row["trace_scope"])
    script_name = str(row["script_name"] or "")
    if fragment_kind == "closureStatus":
        return True
    if (
        fragment_kind == "semantic_scope_fragment"
        and fragment_key == "shard-owned-state:upgradeinfolist-population"
        and trace_scope == fragment_key
        and script_name == "trace_extractors.py"
    ):
        return True
    if (
        fragment_kind == "semantic_scope_fragment"
        and fragment_key.startswith("row:")
        and trace_scope == fragment_key
        and script_name == "trace_extractors.py"
    ):
        return True
    return False


def _build_semantic_coverage_summary(
    canonical_entries: list[dict[str, Any]],
    trace_scope: str | None = None,
) -> dict[str, Any]:
    by_kind: dict[str, dict[str, Any]] = {}
    target_contributions: dict[str, list[str]] = {}
    key_contributions: dict[str, list[str]] = {}
    conflict_keys: list[str] = []
    conflicted_objects: list[dict[str, Any]] = []
    for entry in canonical_entries:
        fragment_kind = str(entry.get("fragment_kind") or "")
        fragment_key = str(entry.get("fragment_key") or "")
        payload = dict(entry.get("payload") or {})
        provenance = dict(entry.get("provenance") or {})
        scopes = list(provenance.get("contributingTraceScopes", []) or provenance.get("traceScopes", []) or [])
        if trace_scope and trace_scope not in scopes:
            continue
        bucket = by_kind.setdefault(fragment_kind, {"count": 0, "keys": [], "conflictedKeys": []})
        bucket["count"] += 1
        bucket["keys"].append(fragment_key)
        key_contributions[fragment_key] = sorted(set(scopes))
        field_level_conflicts = (payload.get("support") or {}).get("fieldLevelConflicts") or []
        if field_level_conflicts:
            bucket["conflictedKeys"].append(fragment_key)
            conflict_keys.append(fragment_key)
            conflicted_objects.append(
                {
                    "fragmentKind": fragment_kind,
                    "fragmentKey": fragment_key,
                    "fieldLevelConflicts": field_level_conflicts,
                }
            )
        for scope in scopes:
            target_contributions.setdefault(scope, [])
            if fragment_key not in target_contributions[scope]:
                target_contributions[scope].append(fragment_key)
    return {
        "traceScope": trace_scope,
        "canonicalCount": sum(bucket["count"] for bucket in by_kind.values()),
        "byKind": by_kind,
        "targetContributions": target_contributions,
        "keyContributions": key_contributions,
        "conflictedKeys": sorted(set(conflict_keys)),
        "conflictedObjects": conflicted_objects,
    }


def _build_canonical_source_projection(payload: dict[str, Any]) -> dict[str, Any]:
    source_roles = list(payload.get("sourceRoles") or [])
    sources = dict(payload.get("sources") or {})
    ordered_ids: list[str] = []
    families: dict[str, dict[str, Any]] = {}
    for entry in source_roles:
        source_id = str(entry.get("sourceId") or "").strip()
        if not source_id:
            continue
        if source_id not in ordered_ids:
            ordered_ids.append(source_id)
        families[source_id] = {
            "sourceId": source_id,
            "reference": entry.get("path") or sources.get(source_id),
            "role": entry.get("role"),
            "familyId": entry.get("familyId"),
            "familyLabel": entry.get("familyLabel"),
        }
    for source_id, reference in sources.items():
        source_key = str(source_id)
        if source_key not in families:
            ordered_ids.append(source_key)
            families[source_key] = {
                "sourceId": source_key,
                "reference": reference,
            }
    return {
        "order": ordered_ids,
        "families": families,
    }


def _build_native_view_projection(payload: dict[str, Any]) -> dict[str, Any]:
    native_trace = dict(payload.get("nativeTrace") or {})
    native_summary = dict(payload.get("nativeReconstruction") or native_trace.get("summary") or {})
    return {
        "available": native_trace.get("available"),
        "project": native_trace.get("project"),
        "searchTerms": native_trace.get("searchTerms"),
        "jobId": native_trace.get("jobId"),
        "bridgePlan": native_trace.get("bridgePlan"),
        "fallbackBridgeAttempt": native_trace.get("fallbackBridgeAttempt"),
        "summary": native_summary,
        "materializedFromDb": native_trace.get("materializedFromDb"),
    }


def _sanitize_semantic_scope_projection(scope_payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(scope_payload, dict) or not scope_payload:
        return {}
    scope_id = str(scope_payload.get("scopeId") or "")
    scope_type = str(scope_payload.get("scopeType") or "")
    family_id = str(scope_payload.get("familyId") or "")
    is_token_shop_row_scope = (
        (family_id == "token-shop" and scope_type == "row")
        or scope_id.startswith("row:")
        or "rowLocalGraph" in scope_payload
        or "missingSeams" in scope_payload
        or "closureStatus" in scope_payload
        or "literalSchemaRecovery" in scope_payload
        or "literalTextRecovery" in scope_payload
    )
    if not is_token_shop_row_scope:
        return dict(scope_payload)
    return {
        "scopeId": scope_payload.get("scopeId"),
        "scopeType": scope_payload.get("scopeType"),
        "familyId": scope_payload.get("familyId"),
        "targetId": scope_payload.get("targetId"),
        "traceScope": scope_payload.get("traceScope"),
        "rowShellField": scope_payload.get("rowShellField"),
        "rowLocalGraph": dict(scope_payload.get("rowLocalGraph") or {}),
        "missingSeams": list(scope_payload.get("missingSeams") or []),
        "semanticGraph": dict(scope_payload.get("semanticGraph") or {}),
        "semanticSearchPlan": dict(scope_payload.get("semanticSearchPlan") or {}),
        "compatibilityStatus": dict(scope_payload.get("compatibilityStatus") or {}),
        "updatedAt": scope_payload.get("updatedAt"),
        "support": dict(scope_payload.get("support") or {}),
    }


def _sanitize_dependency_projection(payload: dict[str, Any]) -> dict[str, Any]:
    sanitized = dict(payload or {})
    semantic_scope = dict(sanitized.get("semanticScope") or {})
    if semantic_scope:
        sanitized["semanticScope"] = _sanitize_semantic_scope_projection(semantic_scope)
    return sanitized


def _sanitize_semantic_views_projection(semantic_views: dict[str, Any]) -> dict[str, Any]:
    sanitized_views: dict[str, Any] = {}
    for fragment_kind, fragment_group in dict(semantic_views or {}).items():
        if not isinstance(fragment_group, dict):
            sanitized_views[fragment_kind] = fragment_group
            continue
        sanitized_group: dict[str, Any] = {}
        for fragment_key, fragment_payload in fragment_group.items():
            if not isinstance(fragment_payload, dict):
                sanitized_group[fragment_key] = fragment_payload
                continue
            if fragment_kind == "semantic_scope_fragment":
                sanitized_group[fragment_key] = _sanitize_semantic_scope_projection(fragment_payload)
            elif fragment_kind == "dependency_fragment":
                sanitized_group[fragment_key] = _sanitize_dependency_projection(fragment_payload)
            else:
                sanitized_group[fragment_key] = dict(fragment_payload)
        sanitized_views[fragment_kind] = sanitized_group
    return sanitized_views


def _sanitize_system_views_projection(system_views: dict[str, Any]) -> dict[str, Any]:
    sanitized_views: dict[str, Any] = {}
    for fragment_kind, fragment_payload in dict(system_views or {}).items():
        if not isinstance(fragment_payload, dict):
            sanitized_views[fragment_kind] = fragment_payload
            continue
        if fragment_kind == "semantic_scope_fragment":
            sanitized_views[fragment_kind] = _sanitize_semantic_scope_projection(fragment_payload)
        elif fragment_kind == "dependency_fragment":
            sanitized_views[fragment_kind] = _sanitize_dependency_projection(fragment_payload)
        else:
            sanitized_views[fragment_kind] = dict(fragment_payload)
    return sanitized_views


def _build_target_bundle_projection(
    payload: dict[str, Any],
    system_payload: dict[str, Any],
    semantic_views: dict[str, Any],
    semantic_coverage: dict[str, Any],
    trace_scope: str,
    request_signature: str,
) -> dict[str, Any]:
    execution_context_fragment = dict((semantic_views.get("execution_context_fragment") or {}).get(f"target-execution-context:{trace_scope}") or {})
    assessment_fragment = dict((semantic_views.get("assessment_fragment") or {}).get(f"target-assessment:{trace_scope}") or {})
    target_narrative_fragment = dict((semantic_views.get("target_narrative_fragment") or {}).get(f"target-narrative:{trace_scope}") or {})
    bridge_comparison_fragment = dict((semantic_views.get("bridge_comparison_fragment") or {}).get(f"target-bridge-comparison:{trace_scope}") or {})
    token_shop_reconstruction_fragment = dict((semantic_views.get("token_shop_reconstruction_fragment") or {}).get(f"token-shop-reconstruction:{trace_scope}") or {})
    execution_plan_fragment = dict((semantic_views.get("execution_plan_fragment") or {}).get(f"target-execution-plan:{trace_scope}") or {})
    graph_plan_fragment = dict((semantic_views.get("graph_plan_fragment") or {}).get(f"target-graph-plan:{trace_scope}") or {})
    bridge_policy_fragment = dict((semantic_views.get("bridge_policy_fragment") or {}).get(f"target-bridge-policy:{trace_scope}") or {})
    closure_status = dict(((payload.get("rowRecovery") or {}).get("closureStatus") or {}))
    canonical_status = dict(token_shop_reconstruction_fragment.get("status") or {})
    decision_summary = dict(assessment_fragment.get("decisionSummary") or {})
    if not decision_summary:
        decision_summary = {
            "verdict": "missing-canonical-assessment",
            "summary": "Canonical assessment fragment is missing for this target bundle. Rebuild trace views before trusting verdict state.",
            "provedEdgeCount": 0,
            "negativeEdgeCount": 0,
            "baselineGap": [],
            "supportingEdgeTypes": [],
            "blockedEdgeTypes": [],
        }
    grounded_conclusion = str(target_narrative_fragment.get("groundedConclusion") or "").strip()
    current_boundary = [
        str(line).strip()
        for line in (target_narrative_fragment.get("currentBoundary") or [])
        if str(line).strip()
    ]
    if not grounded_conclusion and not current_boundary:
        grounded_conclusion = "Canonical target narrative fragment is missing for this target bundle. Rebuild trace views before trusting narrative state."
        current_boundary = [
            "Canonical target narrative fragment is missing for this target bundle.",
            "Rebuild trace views before trusting groundedConclusion or currentBoundary surfaces.",
        ]
    bridge_check = dict(bridge_comparison_fragment.get("bridgeCheck") or {})
    solved_vs_blocked = dict(bridge_comparison_fragment.get("solvedVsBlockedDiff") or {})
    bridge_comparison_key = str(bridge_comparison_fragment.get("semanticKey") or f"target-bridge-comparison:{trace_scope}")
    if not bridge_check:
        bridge_check = {
            "semanticKey": bridge_comparison_key,
            "bridgeCleared": None,
            "bridgeHits": [],
            "result": "Canonical bridge/comparison fragment is missing for this target bundle. Rebuild trace views before trusting bridge state.",
        }
    if not solved_vs_blocked:
        solved_vs_blocked = {
            "semanticKey": bridge_comparison_key,
            "baseline": {
                "id": trace_scope,
                "label": "Canonical bridge/comparison missing",
                "status": "missing-canonical-bridge-comparison",
                "sourcePath": "db:canonical-bridge-comparison-fragment",
                "shellField": None,
                "shellPathId": None,
                "comparisonShape": [],
                "groundedConclusion": "Canonical bridge/comparison fragment is missing for this target bundle.",
            },
            "blockedTarget": {
                "id": f"{trace_scope}-blocked",
                "label": "Canonical blocked comparison missing",
                "status": "missing-canonical-bridge-comparison",
                "sourcePath": "db:canonical-bridge-comparison-fragment",
                "shellField": None,
                "shellPathId": None,
                "comparisonShape": [],
                "groundedConclusion": "Canonical bridge/comparison fragment is missing for this target bundle.",
            },
            "delta": {
                "sharedPresentEdgeTypes": [],
                "baselineOnlyPresentEdgeTypes": [],
                "blockedMissingEdgeTypes": [],
                "solvedVsBlockedSummary": [
                    "Canonical bridge/comparison fragment is missing for this target bundle.",
                ],
            },
        }
    projected_system_payload = _sanitize_system_views_projection(system_payload)
    target = dict(payload.get("target") or {})
    if str(target.get("familyId") or "") in {
        "token-shop",
        "shard-cost",
        "shard-owned-state",
        "multiverse-market-save-owner",
    }:
        projected_system_payload.pop("system_scope_fragment", None)

    projected_semantic_views = _sanitize_semantic_views_projection(semantic_views)

    projected = {
        "dataset": payload.get("dataset") or "unity-trace-bundle",
        "generatedAt": payload.get("generatedAt"),
        "target": execution_context_fragment or payload.get("target"),
        "plannerResolution": payload.get("plannerResolution"),
        "traceRegistry": {
            "selectedSubjectKind": (payload.get("traceRegistry") or {}).get("selectedSubjectKind"),
            "selectedSubjectKey": (payload.get("traceRegistry") or {}).get("selectedSubjectKey"),
            "executionTargetId": (payload.get("traceRegistry") or {}).get("executionTargetId"),
            "executionTraceScope": (payload.get("traceRegistry") or {}).get("executionTraceScope"),
            "selectedFamilyId": (payload.get("traceRegistry") or {}).get("selectedFamilyId"),
            "requiredSourceFamilies": (payload.get("traceRegistry") or {}).get("requiredSourceFamilies"),
        },
        "traceParams": payload.get("traceParams"),
        "assetSet": payload.get("assetSet"),
        "status": payload.get("status") or canonical_status.get("status") or closure_status.get("status"),
        "semanticStatus": payload.get("semanticStatus") or canonical_status.get("semanticStatus") or closure_status.get("semanticStatus"),
        "literalStatus": payload.get("literalStatus") or canonical_status.get("literalStatus") or closure_status.get("literalStatus"),
        "runtimeStatus": payload.get("runtimeStatus") or canonical_status.get("runtimeStatus") or closure_status.get("runtimeStatus"),
        "decisionSummary": decision_summary,
        "bridgeComparisonSemanticKey": bridge_comparison_key,
        "bridgeCheck": bridge_check,
        "solvedVsBlockedDiff": solved_vs_blocked,
        "executionContextSemanticKey": str(execution_context_fragment.get("semanticKey") or f"target-execution-context:{trace_scope}"),
        "executionContext": execution_context_fragment or None,
        "executionPlanSemanticKey": str(execution_plan_fragment.get("semanticKey") or f"target-execution-plan:{trace_scope}"),
        "executionPlan": execution_plan_fragment or None,
        "narrativeSemanticKey": str(target_narrative_fragment.get("semanticKey") or f"target-narrative:{trace_scope}"),
        "groundedConclusion": grounded_conclusion,
        "currentBoundary": current_boundary,
        "tokenShopReconstructionSemanticKey": (
            str(token_shop_reconstruction_fragment.get("semanticKey") or "")
            if token_shop_reconstruction_fragment
            else None
        ),
        "tokenShopReconstruction": token_shop_reconstruction_fragment or None,
        "graphPlanSemanticKey": str(graph_plan_fragment.get("semanticKey") or f"target-graph-plan:{trace_scope}"),
        "graphPlan": graph_plan_fragment or None,
        "bridgePolicySemanticKey": str(bridge_policy_fragment.get("semanticKey") or f"target-bridge-policy:{trace_scope}"),
        "bridgePolicy": bridge_policy_fragment or None,
        "sourceFamilies": _build_canonical_source_projection(payload),
        "nativeView": _build_native_view_projection(payload),
        "systemViews": projected_system_payload,
        "canonicalSemanticViews": projected_semantic_views,
        "semanticCoverage": semantic_coverage,
        "materialization": {
            "traceScope": trace_scope,
            "requestSignature": request_signature,
            "traceView": "materialized_trace_view",
            "systemView": "canonical_system_trace_view",
            "semanticView": "canonical_semantic_fragment",
            "semanticCoverageView": "canonical_semantic_fragment",
            "dbBacked": True,
        },
    }
    return projected


def _normalize_live_trace_fragment_payloads(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        UPDATE trace_fragments
        SET is_valid = 0, invalidated_at = COALESCE(invalidated_at, ?)
        WHERE is_valid = 1
          AND invalidated_at IS NULL
          AND fragment_kind = 'closureStatus'
        """,
        (datetime.now().isoformat(),),
    )

    rows = conn.execute(
        """
        SELECT fragment_id, fragment_kind, payload_json
        FROM trace_fragments
        WHERE is_valid = 1
          AND invalidated_at IS NULL
          AND fragment_kind IN ('rowRecovery', 'traceRegistry', 'traceWorkflow')
        """
    ).fetchall()
    for row in rows:
        payload = _json_loads(row["payload_json"], None)
        if not isinstance(payload, dict):
            continue
        fragment_kind = str(row["fragment_kind"] or "")
        if fragment_kind == "rowRecovery":
            normalized = _sanitize_row_recovery_for_persistence(payload)
        elif fragment_kind == "traceRegistry":
            normalized = _normalize_reference_owned_payload("traceRegistry", payload, "") or {}
        elif fragment_kind == "traceWorkflow":
            normalized = _normalize_reference_owned_payload("traceWorkflow", payload, "") or {}
        else:
            continue
        if _json_dumps(normalized) == _json_dumps(payload):
            continue
        conn.execute(
            """
            UPDATE trace_fragments
            SET payload_json = ?, updated_at = ?
            WHERE fragment_id = ?
            """,
            (
                _json_dumps(normalized),
                datetime.now().isoformat(),
                int(row["fragment_id"]),
            ),
        )


class GhidraCacheDB:
    def __init__(self, db_path: Path, jobs_dir: Path) -> None:
        self.db_path = db_path
        self.jobs_dir = jobs_dir
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.jobs_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=30000")
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
                """
            )
            current_version_row = conn.execute("SELECT value FROM meta WHERE key = 'schema_version'").fetchone()
            current_version = int(current_version_row["value"]) if current_version_row and str(current_version_row["value"]).isdigit() else 0
            process_term_columns = {str(row["name"]) for row in conn.execute("PRAGMA table_info(process_term_index)").fetchall()}
            trace_fragment_columns = {str(row["name"]) for row in conn.execute("PRAGMA table_info(trace_fragments)").fetchall()}
            native_trace_view_columns = {str(row["name"]) for row in conn.execute("PRAGMA table_info(materialized_native_trace_views)").fetchall()}
            target_bundle_view_columns = {str(row["name"]) for row in conn.execute("PRAGMA table_info(materialized_target_bundle_views)").fetchall()}
            semantic_fragment_columns = {str(row["name"]) for row in conn.execute("PRAGMA table_info(canonical_semantic_fragments)").fetchall()}
            system_unit_view_columns = {str(row["name"]) for row in conn.execute("PRAGMA table_info(materialized_system_unit_views)").fetchall()}
            needs_structural_migration = (
                not process_term_columns
                or "source_kind" not in process_term_columns
                or not trace_fragment_columns
                or "trace_scope" not in trace_fragment_columns
                or not native_trace_view_columns
                or "request_signature" not in native_trace_view_columns
                or not target_bundle_view_columns
                or "trace_scope" not in target_bundle_view_columns
                or not semantic_fragment_columns
                or "fragment_key" not in semantic_fragment_columns
                or not system_unit_view_columns
                or "system_id" not in system_unit_view_columns
            )
            if (current_version and current_version < DB_SCHEMA_VERSION) or needs_structural_migration:
                conn.executescript(
                    """
                    DROP TABLE IF EXISTS process_term_index;
                    DROP TABLE IF EXISTS process_exact_index;
                    DROP TABLE IF EXISTS graph_links;
                    DROP TABLE IF EXISTS materialized_job_views;
                    DROP TABLE IF EXISTS materialized_term_views;
                    DROP TABLE IF EXISTS canonical_term_aspects;
                    DROP TABLE IF EXISTS evidence;
                    DROP TABLE IF EXISTS materialized_trace_views;
                    DROP TABLE IF EXISTS canonical_trace_fragments;
                    DROP TABLE IF EXISTS trace_fragments;
                    DROP TABLE IF EXISTS materialized_native_trace_views;
                    DROP TABLE IF EXISTS canonical_system_trace_views;
                    DROP TABLE IF EXISTS materialized_target_bundle_views;
                    DROP TABLE IF EXISTS canonical_semantic_fragments;
                    DROP TABLE IF EXISTS materialized_system_unit_views;
                    """
                )
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    mode TEXT NOT NULL,
                    project_name TEXT,
                    project_file TEXT,
                    binary TEXT,
                    status TEXT NOT NULL,
                    start_time TEXT,
                    updated_at TEXT NOT NULL,
                    output_file TEXT,
                    job_file TEXT,
                    marker_file TEXT,
                    log_file TEXT,
                    signature TEXT,
                    timeout_seconds INTEGER,
                    max_cpu INTEGER,
                    cache_mode TEXT,
                    lease_owner TEXT,
                    lease_expires_at TEXT,
                    invalidated_at TEXT,
                    invalidation_reason TEXT,
                    search_terms_json TEXT NOT NULL,
                    expanded_terms_json TEXT,
                    executed_terms_json TEXT,
                    completed_terms_json TEXT,
                    failed_terms_json TEXT,
                    per_term_jobs_json TEXT,
                    graph_backfilled_terms_json TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_jobs_mode_status
                    ON jobs(mode, status, invalidated_at);
                CREATE INDEX IF NOT EXISTS idx_jobs_project
                    ON jobs(project_name, project_file, mode, status, invalidated_at);
                CREATE INDEX IF NOT EXISTS idx_jobs_lease
                    ON jobs(status, lease_expires_at);

                CREATE TABLE IF NOT EXISTS job_terms (
                    job_id TEXT NOT NULL,
                    term TEXT NOT NULL,
                    ordinal INTEGER NOT NULL,
                    PRIMARY KEY(job_id, term),
                    FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_job_terms_term
                    ON job_terms(term, job_id);

                CREATE TABLE IF NOT EXISTS evidence (
                    evidence_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    normalized_term TEXT NOT NULL,
                    term TEXT NOT NULL,
                    aspect_kind TEXT NOT NULL,
                    aspect_key TEXT NOT NULL,
                    source_job_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    confidence REAL NOT NULL DEFAULT 0,
                    reducer_priority INTEGER NOT NULL DEFAULT 0,
                    schema_version INTEGER NOT NULL DEFAULT 0,
                    script_name TEXT,
                    producer_version TEXT,
                    start_time TEXT,
                    is_valid INTEGER NOT NULL DEFAULT 1,
                    invalidated_at TEXT,
                    invalidation_reason TEXT,
                    superseded_by INTEGER,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(project_name, project_file, normalized_term, aspect_kind, aspect_key, source_job_id),
                    FOREIGN KEY(source_job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_evidence_lookup
                    ON evidence(project_name, project_file, normalized_term, aspect_kind, is_valid);
                CREATE INDEX IF NOT EXISTS idx_evidence_job
                    ON evidence(source_job_id, is_valid);

                CREATE TABLE IF NOT EXISTS canonical_term_aspects (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    normalized_term TEXT NOT NULL,
                    aspect_kind TEXT NOT NULL,
                    selected_evidence_ids_json TEXT NOT NULL,
                    canonical_payload_json TEXT NOT NULL,
                    alternate_payloads_json TEXT,
                    provenance_json TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, normalized_term, aspect_kind)
                );

                CREATE TABLE IF NOT EXISTS materialized_term_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    normalized_term TEXT NOT NULL,
                    term TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, normalized_term)
                );

                CREATE TABLE IF NOT EXISTS materialized_job_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    signature TEXT NOT NULL,
                    wanted_terms_json TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, signature)
                );

                CREATE TABLE IF NOT EXISTS process_exact_index (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    signature TEXT NOT NULL,
                    job_id TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, signature),
                    FOREIGN KEY(job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS process_term_index (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    term TEXT NOT NULL,
                    source_kind TEXT NOT NULL,
                    source_ref TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, term, source_kind, source_ref)
                );

                CREATE TABLE IF NOT EXISTS graph_links (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    target_term TEXT NOT NULL,
                    source_term TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    source_ref TEXT NOT NULL,
                    start_time TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, target_term, source_term, kind, source_ref)
                );

                CREATE INDEX IF NOT EXISTS idx_graph_links_target
                    ON graph_links(project_name, project_file, target_term, start_time DESC);

                CREATE TABLE IF NOT EXISTS trace_fragments (
                    fragment_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    request_signature TEXT NOT NULL,
                    fragment_kind TEXT NOT NULL,
                    fragment_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    source_job_id TEXT NOT NULL DEFAULT '',
                    source_term TEXT NOT NULL DEFAULT '',
                    confidence REAL NOT NULL DEFAULT 0,
                    reducer_priority INTEGER NOT NULL DEFAULT 0,
                    schema_version INTEGER NOT NULL DEFAULT 0,
                    script_name TEXT,
                    producer_version TEXT,
                    start_time TEXT,
                    is_valid INTEGER NOT NULL DEFAULT 1,
                    invalidated_at TEXT,
                    invalidation_reason TEXT,
                    superseded_by INTEGER,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(project_name, project_file, trace_scope, request_signature, fragment_kind, fragment_key, source_job_id, source_term)
                );

                CREATE INDEX IF NOT EXISTS idx_trace_fragments_lookup
                    ON trace_fragments(project_name, project_file, trace_scope, request_signature, fragment_kind, is_valid);

                CREATE TABLE IF NOT EXISTS canonical_trace_fragments (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    request_signature TEXT NOT NULL,
                    fragment_kind TEXT NOT NULL,
                    fragment_key TEXT NOT NULL,
                    selected_fragment_ids_json TEXT NOT NULL,
                    canonical_payload_json TEXT NOT NULL,
                    alternate_payloads_json TEXT,
                    provenance_json TEXT,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, trace_scope, request_signature, fragment_kind, fragment_key)
                );

                CREATE TABLE IF NOT EXISTS materialized_trace_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    request_signature TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, trace_scope, request_signature)
                );

                CREATE TABLE IF NOT EXISTS materialized_native_trace_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    request_signature TEXT NOT NULL,
                    requested_terms_json TEXT NOT NULL,
                    search_terms_json TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, request_signature)
                );

                CREATE TABLE IF NOT EXISTS canonical_system_trace_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    request_signature TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, trace_scope, request_signature)
                );

                CREATE TABLE IF NOT EXISTS canonical_semantic_fragments (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    fragment_kind TEXT NOT NULL,
                    fragment_key TEXT NOT NULL,
                    canonical_payload_json TEXT NOT NULL,
                    alternate_payloads_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, fragment_kind, fragment_key)
                );

                CREATE TABLE IF NOT EXISTS materialized_target_bundle_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    request_signature TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, trace_scope, request_signature)
                );

                CREATE TABLE IF NOT EXISTS materialized_system_unit_views (
                    system_id TEXT NOT NULL,
                    version TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    exported_path TEXT,
                    PRIMARY KEY(system_id, version)
                );
                """
            )
            conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES('schema_version', ?)", (str(DB_SCHEMA_VERSION),))
            conn.execute(
                "INSERT OR REPLACE INTO meta(key, value) VALUES('last_seen_jobs_scan', COALESCE((SELECT value FROM meta WHERE key='last_seen_jobs_scan'), ''))"
            )

    def _job_row_to_dict(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        if row is None:
            return None
        data = dict(row)
        data["search_strings"] = _json_loads(data.pop("search_terms_json", None), [])
        data["expanded_search_strings"] = _json_loads(data.pop("expanded_terms_json", None), [])
        data["executed_search_strings"] = _json_loads(data.pop("executed_terms_json", None), [])
        data["completed_terms"] = _json_loads(data.pop("completed_terms_json", None), [])
        data["failed_terms"] = _json_loads(data.pop("failed_terms_json", None), [])
        data["per_term_jobs"] = _json_loads(data.pop("per_term_jobs_json", None), [])
        data["graph_backfilled_terms"] = _json_loads(data.pop("graph_backfilled_terms_json", None), [])
        return data

    def upsert_job(self, job_info: dict[str, Any], lease_owner: str | None = None) -> None:
        job_id = str(job_info.get("job_id", "")).strip()
        if not job_id:
            return
        now = datetime.now().isoformat()
        search_terms = list(job_info.get("search_strings", []))
        signature = str(job_info.get("signature") or _term_signature(search_terms))
        timeout_seconds = int(job_info.get("timeout", 0) or 0) or None
        lease_expires_at = None
        if job_info.get("status") == "running" and timeout_seconds:
            lease_expires_at = (datetime.now() + timedelta(seconds=int(timeout_seconds * 1.25))).isoformat()
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO jobs(
                    job_id, mode, project_name, project_file, binary, status, start_time, updated_at,
                    output_file, job_file, marker_file, log_file, signature, timeout_seconds, max_cpu,
                    cache_mode, lease_owner, lease_expires_at, invalidated_at, invalidation_reason,
                    search_terms_json, expanded_terms_json, executed_terms_json, completed_terms_json,
                    failed_terms_json, per_term_jobs_json, graph_backfilled_terms_json
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(job_id) DO UPDATE SET
                    mode=excluded.mode,
                    project_name=excluded.project_name,
                    project_file=excluded.project_file,
                    binary=excluded.binary,
                    status=excluded.status,
                    start_time=excluded.start_time,
                    updated_at=excluded.updated_at,
                    output_file=excluded.output_file,
                    job_file=excluded.job_file,
                    marker_file=excluded.marker_file,
                    log_file=excluded.log_file,
                    signature=excluded.signature,
                    timeout_seconds=excluded.timeout_seconds,
                    max_cpu=excluded.max_cpu,
                    cache_mode=excluded.cache_mode,
                    lease_owner=excluded.lease_owner,
                    lease_expires_at=excluded.lease_expires_at,
                    search_terms_json=excluded.search_terms_json,
                    expanded_terms_json=excluded.expanded_terms_json,
                    executed_terms_json=excluded.executed_terms_json,
                    completed_terms_json=excluded.completed_terms_json,
                    failed_terms_json=excluded.failed_terms_json,
                    per_term_jobs_json=excluded.per_term_jobs_json,
                    graph_backfilled_terms_json=excluded.graph_backfilled_terms_json
                """,
                (
                    job_id,
                    job_info.get("mode"),
                    job_info.get("project_name"),
                    job_info.get("project_file"),
                    job_info.get("binary"),
                    job_info.get("status"),
                    job_info.get("start_time"),
                    now,
                    job_info.get("output_file"),
                    job_info.get("job_file"),
                    job_info.get("marker_file"),
                    job_info.get("log_file"),
                    signature,
                    timeout_seconds,
                    job_info.get("max_cpu"),
                    job_info.get("cache_mode"),
                    lease_owner,
                    lease_expires_at,
                    job_info.get("invalidated_at"),
                    job_info.get("invalidation_reason"),
                    _json_dumps(search_terms),
                    _json_dumps(job_info.get("expanded_search_strings", [])),
                    _json_dumps(job_info.get("executed_search_strings", [])),
                    _json_dumps(job_info.get("completed_terms", [])),
                    _json_dumps(job_info.get("failed_terms", [])),
                    _json_dumps(job_info.get("per_term_jobs", [])),
                    _json_dumps(job_info.get("graph_backfilled_terms", [])),
                ),
            )
            conn.execute("DELETE FROM job_terms WHERE job_id = ?", (job_id,))
            for ordinal, term in enumerate(search_terms):
                conn.execute(
                    "INSERT OR REPLACE INTO job_terms(job_id, term, ordinal) VALUES(?,?,?)",
                    (job_id, term, ordinal),
                )

    def import_job_dir(self, job_dir: Path) -> dict[str, Any] | None:
        job_info = _load_json(job_dir / "job.json")
        if not job_info:
            return None
        if not job_info.get("job_file"):
            job_info["job_file"] = str(job_dir / "job.json")
        self.upsert_job(job_info)
        return job_info

    def import_all_job_dirs(self) -> None:
        latest_seen = ""
        seen_job_ids: set[str] = set()
        if not self.jobs_dir.exists():
            return
        for job_dir in sorted(self.jobs_dir.iterdir()):
            if not job_dir.is_dir():
                continue
            job_info = self.import_job_dir(job_dir)
            if job_info:
                job_id = str(job_info.get("job_id", "")).strip()
                if job_id:
                    seen_job_ids.add(job_id)
            latest_seen = max(latest_seen, str(job_dir.stat().st_mtime_ns))
        with self.connect() as conn:
            if seen_job_ids:
                placeholders = ",".join("?" for _ in seen_job_ids)
                conn.execute(
                    "DELETE FROM jobs WHERE job_file IS NOT NULL AND job_id NOT IN ({})".format(placeholders),
                    tuple(sorted(seen_job_ids)),
                )
            else:
                conn.execute("DELETE FROM jobs WHERE job_file IS NOT NULL")
            conn.execute(
                "INSERT OR REPLACE INTO meta(key, value) VALUES('last_seen_jobs_scan', ?)",
                (latest_seen,),
            )

    def sync_from_jobs_if_needed(self) -> None:
        if not self.jobs_dir.exists():
            return
        latest_fs = ""
        for job_dir in self.jobs_dir.iterdir():
            if job_dir.is_dir():
                latest_fs = max(latest_fs, str(job_dir.stat().st_mtime_ns))
        with self.connect() as conn:
            row = conn.execute("SELECT value FROM meta WHERE key = 'last_seen_jobs_scan'").fetchone()
            last_seen = row["value"] if row else ""
        if latest_fs != last_seen:
            self.import_all_job_dirs()

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        self.sync_from_jobs_if_needed()
        with self.connect() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        return self._job_row_to_dict(row)

    def _extract_evidence_rows(self, job: dict[str, Any], result: dict[str, Any]) -> list[dict[str, Any]]:
        project_name = str(job.get("project_name", "") or "")
        project_file = str(job.get("project_file", "") or "")
        job_id = str(job.get("job_id", "") or "")
        if not project_name or not project_file or not job_id:
            return []
        schema_version = int(result.get("schemaVersion", 0) or 0)
        script_name = str((result.get("headless") or {}).get("script", "") or "")
        producer_version = str(schema_version or "")
        start_time = str(job.get("start_time", "") or "")
        terms = _normalize_result_terms(result, list(job.get("search_strings", [])))
        evidence_rows: list[dict[str, Any]] = []

        def add(term: str, aspect_kind: str, payload: Any, aspect_key: str = "__self__", confidence: float | None = None) -> None:
            if payload is None:
                return
            if isinstance(payload, list) and not payload:
                return
            if isinstance(payload, dict) and not payload:
                return
            normalized_term = term.lower()
            evidence_rows.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "normalized_term": normalized_term,
                    "term": term,
                    "aspect_kind": aspect_kind,
                    "aspect_key": aspect_key,
                    "source_job_id": job_id,
                    "payload": payload,
                    "confidence": float(confidence if confidence is not None else ASPECT_PRIORITIES.get(aspect_kind, 50)) / 100.0,
                    "reducer_priority": int(ASPECT_PRIORITIES.get(aspect_kind, 50)),
                    "schema_version": schema_version,
                    "script_name": script_name,
                    "producer_version": producer_version,
                    "start_time": start_time,
                }
            )

        functions = result.get("functions") or {}
        fuzzy = result.get("fuzzyFunctions") or {}
        refs = result.get("referenceFunctions") or {}
        ascii_targets = result.get("ascii_targets") or {}
        neighborhoods = result.get("metadataNeighborhoods") or {}
        bridges = result.get("termBridges") or {}
        managed_reconstruction = result.get("managedReconstruction") or {}
        managed_graph = result.get("managedGraph") or {}
        graph_backfill = ((result.get("graphBackfill") or {}).get("linksByTerm") or {})

        for term in terms:
            bridge = dict((bridges.get(term) or {}))
            add(term, "direct_functions", list(functions.get(term, []) or []))
            add(term, "fuzzy_functions", list(fuzzy.get(term, []) or []))
            add(term, "reference_functions", list(refs.get(term, []) or []))
            add(term, "ascii_targets", list(ascii_targets.get(term, []) or []))
            add(term, "metadata_neighborhoods", list(neighborhoods.get(term, []) or []))
            add(term, "term_bridge_core", bridge)
            add(term, "owner_candidates", list(bridge.get("ownerCandidates", []) or []))
            add(term, "related_terms", list(bridge.get("relatedTerms", []) or []))
            add(term, "expanded_function_matches", list(bridge.get("expandedFunctionMatches", []) or []))
            add(term, "expanded_reference_matches", list(bridge.get("expandedReferenceMatches", []) or []))
            add(term, "managed_reconstruction", managed_reconstruction)
            add(term, "managed_graph_full", managed_graph)
            for owner_entry in managed_graph.get("owners", []) or []:
                owner = str(owner_entry.get("owner", "")).strip()
                if owner:
                    add(term, "managed_graph_owner", owner_entry, owner)
            for edge in managed_graph.get("edges", []) or []:
                edge_key = "{}|{}|{}".format(edge.get("from", ""), edge.get("type", ""), edge.get("to", ""))
                add(term, "managed_graph_edge", edge, edge_key)
            for link in graph_backfill.get(term, []) or []:
                link_key = "{}|{}|{}".format(link.get("sourceTerm", ""), link.get("kind", ""), link.get("value", ""))
                add(term, "graph_backfill_link", link, link_key, 0.78)
        return evidence_rows

    def _upsert_evidence_rows(self, evidence_rows: list[dict[str, Any]]) -> None:
        if not evidence_rows:
            return
        now = datetime.now().isoformat()
        with self.connect() as conn:
            for evidence in evidence_rows:
                aspect_kind = str(evidence["aspect_kind"] or "")
                payload_json = _json_dumps(evidence["payload"])
                if aspect_kind in SINGLETON_ASPECTS:
                    conn.execute(
                        """
                        UPDATE evidence
                        SET is_valid = 0,
                            invalidated_at = ?,
                            invalidation_reason = ?,
                            superseded_by = ?,
                            updated_at = ?
                        WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                          AND aspect_kind = ? AND aspect_key = ?
                          AND is_valid = 1 AND invalidated_at IS NULL
                          AND source_job_id <> ?
                        """,
                        (
                            now,
                            "superseded-by-new-evidence",
                            str(evidence["source_job_id"] or ""),
                            now,
                            evidence["project_name"],
                            evidence["project_file"],
                            evidence["normalized_term"],
                            aspect_kind,
                            evidence["aspect_key"],
                            evidence["source_job_id"],
                        ),
                    )
                else:
                    conn.execute(
                        """
                        UPDATE evidence
                        SET is_valid = 0,
                            invalidated_at = ?,
                            invalidation_reason = ?,
                            superseded_by = ?,
                            updated_at = ?
                        WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                          AND aspect_kind = ? AND aspect_key = ?
                          AND is_valid = 1 AND invalidated_at IS NULL
                          AND source_job_id <> ?
                          AND payload_json = ?
                        """,
                        (
                            now,
                            "superseded-by-equivalent-evidence",
                            str(evidence["source_job_id"] or ""),
                            now,
                            evidence["project_name"],
                            evidence["project_file"],
                            evidence["normalized_term"],
                            aspect_kind,
                            evidence["aspect_key"],
                            evidence["source_job_id"],
                            payload_json,
                        ),
                    )
                existing = conn.execute(
                    """
                    SELECT is_valid, invalidated_at, invalidation_reason, superseded_by
                    FROM evidence
                    WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                      AND aspect_kind = ? AND aspect_key = ? AND source_job_id = ?
                    """,
                    (
                        evidence["project_name"],
                        evidence["project_file"],
                        evidence["normalized_term"],
                        aspect_kind,
                        evidence["aspect_key"],
                        evidence["source_job_id"],
                    ),
                ).fetchone()
                is_valid = int(existing["is_valid"]) if existing else 1
                invalidated_at = existing["invalidated_at"] if existing else None
                invalidation_reason = existing["invalidation_reason"] if existing else None
                superseded_by = existing["superseded_by"] if existing else None
                conn.execute(
                    """
                    INSERT INTO evidence(
                        project_name, project_file, normalized_term, term, aspect_kind, aspect_key, source_job_id,
                        payload_json, confidence, reducer_priority, schema_version, script_name, producer_version,
                        start_time, is_valid, invalidated_at, invalidation_reason, superseded_by, created_at, updated_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(project_name, project_file, normalized_term, aspect_kind, aspect_key, source_job_id)
                    DO UPDATE SET
                        term=excluded.term,
                        payload_json=excluded.payload_json,
                        confidence=excluded.confidence,
                        reducer_priority=excluded.reducer_priority,
                        schema_version=excluded.schema_version,
                        script_name=excluded.script_name,
                        producer_version=excluded.producer_version,
                        start_time=excluded.start_time,
                        updated_at=excluded.updated_at
                    """,
                    (
                        evidence["project_name"],
                        evidence["project_file"],
                        evidence["normalized_term"],
                        evidence["term"],
                        aspect_kind,
                        evidence["aspect_key"],
                        evidence["source_job_id"],
                        payload_json,
                        evidence["confidence"],
                        evidence["reducer_priority"],
                        evidence["schema_version"],
                        evidence["script_name"],
                        evidence["producer_version"],
                        evidence["start_time"],
                        is_valid,
                        invalidated_at,
                        invalidation_reason,
                        superseded_by,
                        now,
                        now,
                    ),
                )

    def upsert_custom_evidence_rows(self, evidence_rows: list[dict[str, Any]], rebuild_materialized: bool = True) -> None:
        self._upsert_evidence_rows(evidence_rows)
        if rebuild_materialized:
            self._rebuild_canonical_and_materialized()

    def _reduce_rows(self, rows: list[sqlite3.Row], aspect_kind: str) -> tuple[Any, list[str], list[dict[str, Any]], dict[str, Any]]:
        ordered = sorted(rows, key=_rank_row, reverse=True)
        evidence_ids = [str(row["evidence_id"]) for row in ordered]
        alternates = [
            {
                "evidenceId": str(row["evidence_id"]),
                "sourceJobId": str(row["source_job_id"]),
                "confidence": float(row["confidence"]),
                "payload": _json_loads(row["payload_json"], None),
            }
            for row in ordered[1:]
        ]
        provenance = {
            "sourceJobIds": [str(row["source_job_id"]) for row in ordered],
            "evidenceIds": evidence_ids,
            "reducer": "union" if aspect_kind in UNION_ASPECTS else "best-rank",
        }
        if aspect_kind in SINGLETON_ASPECTS:
            canonical_payload = _json_loads(ordered[0]["payload_json"], {})
            return canonical_payload, evidence_ids[:1], alternates, provenance
        merged_payloads = [_json_loads(row["payload_json"], None) for row in ordered]
        flattened: list[Any] = []
        for payload in merged_payloads:
            if isinstance(payload, list):
                flattened.extend(payload)
            elif payload is not None:
                flattened.append(payload)
        canonical_payload = _dedupe_sequence(flattened)
        return canonical_payload, evidence_ids, alternates, provenance

    def _rebuild_canonical_and_materialized(self) -> None:
        with self.connect() as conn:
            conn.execute("DELETE FROM canonical_term_aspects")
            conn.execute("DELETE FROM materialized_term_views")
            conn.execute("DELETE FROM materialized_job_views")
            conn.execute("DELETE FROM process_exact_index")
            conn.execute("DELETE FROM process_term_index")
            conn.execute("DELETE FROM graph_links")

            aspect_rows = conn.execute(
                """
                SELECT * FROM evidence
                WHERE is_valid = 1
                  AND invalidated_at IS NULL
                  AND source_job_id IN (
                    SELECT job_id FROM jobs
                    WHERE mode IN ('process-project', 'native-trace-extract')
                      AND status = 'completed'
                      AND invalidated_at IS NULL
                  )
                ORDER BY project_name, project_file, normalized_term, aspect_kind
                """
            ).fetchall()

            grouped: dict[tuple[str, str, str, str], list[sqlite3.Row]] = {}
            for row in aspect_rows:
                key = (str(row["project_name"]), str(row["project_file"]), str(row["normalized_term"]), str(row["aspect_kind"]))
                grouped.setdefault(key, []).append(row)

            for (project_name, project_file, normalized_term, aspect_kind), rows in grouped.items():
                canonical_payload, selected_ids, alternates, provenance = self._reduce_rows(rows, aspect_kind)
                conn.execute(
                    """
                    INSERT INTO canonical_term_aspects(
                        project_name, project_file, normalized_term, aspect_kind, selected_evidence_ids_json,
                        canonical_payload_json, alternate_payloads_json, provenance_json, updated_at
                    ) VALUES(?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        normalized_term,
                        aspect_kind,
                        _json_dumps(selected_ids),
                        _json_dumps(canonical_payload),
                        _json_dumps(alternates),
                        _json_dumps(provenance),
                        datetime.now().isoformat(),
                    ),
                )

            term_rows = conn.execute(
                """
                SELECT DISTINCT project_name, project_file, normalized_term
                FROM canonical_term_aspects
                ORDER BY project_name, project_file, normalized_term
                """
            ).fetchall()
            for term_row in term_rows:
                project_name = str(term_row["project_name"])
                project_file = str(term_row["project_file"])
                normalized_term = str(term_row["normalized_term"])
                aspect_map_rows = conn.execute(
                    """
                    SELECT * FROM canonical_term_aspects
                    WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                    """,
                    (project_name, project_file, normalized_term),
                ).fetchall()
                aspects = {
                    str(row["aspect_kind"]): {
                        "payload": _json_loads(row["canonical_payload_json"], None),
                        "provenance": _json_loads(row["provenance_json"], {}),
                    }
                    for row in aspect_map_rows
                }
                term_label = normalized_term
                bridge_payload = dict(aspects.get("term_bridge_core", {}).get("payload") or {"term": normalized_term})
                bridge_payload["term"] = str(bridge_payload.get("term") or normalized_term)
                term_label = bridge_payload["term"]
                if "owner_candidates" in aspects:
                    bridge_payload["ownerCandidates"] = aspects["owner_candidates"]["payload"]
                if "related_terms" in aspects:
                    bridge_payload["relatedTerms"] = aspects["related_terms"]["payload"]
                if "expanded_function_matches" in aspects:
                    bridge_payload["expandedFunctionMatches"] = aspects["expanded_function_matches"]["payload"]
                if "expanded_reference_matches" in aspects:
                    bridge_payload["expandedReferenceMatches"] = aspects["expanded_reference_matches"]["payload"]
                bridge_plan_payload = dict(aspects.get("bridge_plan", {}).get("payload") or {})
                direct_functions = list(aspects.get("direct_functions", {}).get("payload") or [])
                fuzzy_functions = list(aspects.get("fuzzy_functions", {}).get("payload") or [])
                reference_functions = list(aspects.get("reference_functions", {}).get("payload") or [])
                ascii_targets = list(aspects.get("ascii_targets", {}).get("payload") or [])
                metadata_neighborhoods = list(aspects.get("metadata_neighborhoods", {}).get("payload") or [])
                managed_reconstruction = dict(aspects.get("managed_reconstruction", {}).get("payload") or {})
                managed_graph = dict(aspects.get("managed_graph_full", {}).get("payload") or {})
                owner_payloads = list(aspects.get("managed_graph_owner", {}).get("payload") or [])
                edge_payloads = list(aspects.get("managed_graph_edge", {}).get("payload") or [])
                if owner_payloads:
                    managed_graph["owners"] = owner_payloads
                if edge_payloads:
                    managed_graph["edges"] = edge_payloads
                payload = {
                    "binary": project_file,
                    "timestamp": datetime.now().isoformat(),
                    "functions": {term_label: direct_functions},
                    "fuzzyFunctions": {term_label: fuzzy_functions},
                    "referenceFunctions": {term_label: reference_functions},
                    "ascii_targets": {term_label: ascii_targets},
                    "metadataNeighborhoods": {term_label: metadata_neighborhoods},
                    "termBridges": {term_label: bridge_payload},
                    "bridgePlans": {term_label: bridge_plan_payload} if bridge_plan_payload else {},
                    "metadataContextFragments": {term_label: list(aspects.get("metadata_context_fragment", {}).get("payload") or [])},
                    "ownerInferences": {term_label: list(aspects.get("owner_inference", {}).get("payload") or [])},
                    "siblingClusters": {term_label: list(aspects.get("sibling_cluster", {}).get("payload") or [])},
                    "nativeSearchAttempts": {term_label: list(aspects.get("native_search_attempt", {}).get("payload") or [])},
                    "nativeSignalFragments": {term_label: list(aspects.get("native_signal_fragment", {}).get("payload") or [])},
                    "managedReconstruction": managed_reconstruction,
                    "managedGraph": managed_graph,
                    "schemaVersion": max(
                        int(managed_reconstruction.get("schemaVersion", 0) or 0),
                        int(managed_graph.get("schemaVersion", 0) or 0),
                        SCHEMA_VERSION_FLOOR,
                    ),
                    "errors": [],
                }
                provenance = {aspect_kind: aspect["provenance"] for aspect_kind, aspect in aspects.items()}
                conn.execute(
                    """
                    INSERT INTO materialized_term_views(
                        project_name, project_file, normalized_term, term, payload_json, provenance_json, updated_at
                    ) VALUES(?,?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        normalized_term,
                        term_label,
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        datetime.now().isoformat(),
                    ),
                )

                conn.execute(
                    """
                    INSERT INTO process_term_index(project_name, project_file, term, source_kind, source_ref, start_time)
                    VALUES(?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        normalized_term,
                        "canonical-term",
                        normalized_term,
                        datetime.now().isoformat(),
                    ),
                )

                for aspect_kind in ("owner_candidates", "related_terms", "graph_backfill_link", "managed_graph_owner", "managed_graph_edge"):
                    aspect_payload = aspects.get(aspect_kind, {}).get("payload") or []
                    for entry in aspect_payload:
                        if isinstance(entry, str):
                            target_term = entry.lower()
                            kind = aspect_kind
                        elif isinstance(entry, dict):
                            target_term = str(entry.get("value") or entry.get("owner") or entry.get("to") or "").strip().lower()
                            kind = str(entry.get("kind") or aspect_kind)
                        else:
                            continue
                        if not target_term:
                            continue
                        conn.execute(
                            """
                            INSERT OR REPLACE INTO graph_links(
                                project_name, project_file, target_term, source_term, kind, source_ref, start_time
                            ) VALUES(?,?,?,?,?,?,?)
                            """,
                            (
                                project_name,
                                project_file,
                                target_term,
                                normalized_term,
                                kind,
                                "canonical-term:{}".format(normalized_term),
                                datetime.now().isoformat(),
                            ),
                        )

            valid_jobs = conn.execute(
                """
                SELECT * FROM jobs
                WHERE mode = 'process-project'
                  AND status = 'completed'
                  AND invalidated_at IS NULL
                ORDER BY start_time ASC
                """
            ).fetchall()
            terms_by_signature: dict[tuple[str, str, str], list[str]] = {}
            for row in valid_jobs:
                job = self._job_row_to_dict(row)
                if not job:
                    continue
                signature = str(job.get("signature") or "")
                if not signature:
                    continue
                terms_by_signature[(str(job.get("project_name", "")), str(job.get("project_file", "")), signature)] = list(job.get("search_strings", []))
                conn.execute(
                    """
                    INSERT INTO process_exact_index(project_name, project_file, signature, job_id, start_time)
                    VALUES(?,?,?,?,?)
                    ON CONFLICT(project_name, project_file, signature) DO UPDATE SET
                        job_id = excluded.job_id,
                        start_time = excluded.start_time
                    WHERE excluded.start_time >= process_exact_index.start_time
                    """,
                    (
                        str(job.get("project_name", "")),
                        str(job.get("project_file", "")),
                        signature,
                        str(job.get("job_id", "")),
                        str(job.get("start_time", "")),
                    ),
                )

            for (project_name, project_file, signature), wanted_terms in terms_by_signature.items():
                term_views: list[dict[str, Any]] = []
                provenance = {"terms": {}, "sourceJobIds": []}
                for term in wanted_terms:
                    term_row = conn.execute(
                        """
                        SELECT * FROM materialized_term_views
                        WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                        """,
                        (project_name, project_file, term.lower()),
                    ).fetchone()
                    if not term_row:
                        continue
                    term_payload = _json_loads(term_row["payload_json"], {})
                    term_provenance = _json_loads(term_row["provenance_json"], {})
                    term_views.append(term_payload)
                    provenance["terms"][term] = term_provenance
                    for aspect_provenance in term_provenance.values():
                        for job_id in aspect_provenance.get("sourceJobIds", []) or []:
                            if job_id not in provenance["sourceJobIds"]:
                                provenance["sourceJobIds"].append(job_id)
                if not term_views:
                    continue
                combined_result = {
                    "binary": project_file,
                    "timestamp": datetime.now().isoformat(),
                    "functions": {},
                    "fuzzyFunctions": {},
                    "referenceFunctions": {},
                    "ascii_targets": {},
                    "metadataNeighborhoods": {},
                    "termBridges": {},
                    "errors": [],
                    "schemaVersion": SCHEMA_VERSION_FLOOR,
                }
                reconstructions: list[dict[str, Any]] = []
                graphs: list[dict[str, Any]] = []
                for term_payload in term_views:
                    combined_result["functions"].update(term_payload.get("functions", {}) or {})
                    combined_result["fuzzyFunctions"].update(term_payload.get("fuzzyFunctions", {}) or {})
                    combined_result["referenceFunctions"].update(term_payload.get("referenceFunctions", {}) or {})
                    combined_result["ascii_targets"].update(term_payload.get("ascii_targets", {}) or {})
                    combined_result["metadataNeighborhoods"].update(term_payload.get("metadataNeighborhoods", {}) or {})
                    combined_result["termBridges"].update(term_payload.get("termBridges", {}) or {})
                    if term_payload.get("managedReconstruction"):
                        reconstructions.append(term_payload["managedReconstruction"])
                    if term_payload.get("managedGraph"):
                        graphs.append(term_payload["managedGraph"])
                    combined_result["schemaVersion"] = max(int(combined_result["schemaVersion"]), int(term_payload.get("schemaVersion", 0) or 0))
                combined_result["managedReconstruction"] = _merge_managed_reconstructions(reconstructions)
                combined_result["managedGraph"] = _merge_managed_graphs(graphs)
                conn.execute(
                    """
                    INSERT INTO materialized_job_views(
                        project_name, project_file, signature, wanted_terms_json, payload_json, provenance_json, updated_at
                    ) VALUES(?,?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        signature,
                        _json_dumps(wanted_terms),
                        _json_dumps(combined_result),
                        _json_dumps(provenance),
                        datetime.now().isoformat(),
                    ),
                )

    def rebuild_indices(self, result_loader, stale_check) -> None:
        self.import_all_job_dirs()
        with self.connect() as conn:
            completed_rows = conn.execute(
                """
                SELECT * FROM jobs
                WHERE mode = 'process-project'
                  AND status = 'completed'
                ORDER BY start_time ASC
                """
            ).fetchall()
        for row in completed_rows:
            job = self._job_row_to_dict(row)
            if not job:
                continue
            result = result_loader(job)
            search_terms = list(job.get("search_strings", []))
            if not result or stale_check(result, search_terms):
                continue
            evidence_rows = self._extract_evidence_rows(job, result)
            if not evidence_rows:
                continue
            self._upsert_evidence_rows(evidence_rows)
        self._rebuild_canonical_and_materialized()

    def get_completed_process_jobs(self, project_name: str, project_file: str) -> list[dict[str, Any]]:
        self.sync_from_jobs_if_needed()
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM jobs
                WHERE mode = 'process-project'
                  AND project_name = ?
                  AND project_file = ?
                  AND status = 'completed'
                  AND invalidated_at IS NULL
                ORDER BY start_time DESC
                """,
                (project_name, project_file),
            ).fetchall()
        return [self._job_row_to_dict(row) for row in rows if row is not None]

    def find_exact_subset_job(self, project_name: str, project_file: str, signature: str) -> dict[str, Any] | None:
        self.sync_from_jobs_if_needed()
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT jobs.* FROM process_exact_index
                JOIN jobs ON jobs.job_id = process_exact_index.job_id
                WHERE process_exact_index.project_name = ?
                  AND process_exact_index.project_file = ?
                  AND process_exact_index.signature = ?
                  AND jobs.invalidated_at IS NULL
                """,
                (project_name, project_file, signature),
            ).fetchone()
        return self._job_row_to_dict(row)

    def find_materialized_job_view(self, project_name: str, project_file: str, signature: str) -> dict[str, Any] | None:
        self.sync_from_jobs_if_needed()
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_job_views
                WHERE project_name = ? AND project_file = ? AND signature = ?
                """,
                (project_name, project_file, signature),
            ).fetchone()
        if row is None:
            return None
        return {
            "job": {
                "job_id": "materialized:" + signature,
                "project_name": project_name,
                "project_file": project_file,
                "signature": signature,
                "status": "completed",
                "start_time": str(row["updated_at"]),
                "output_file": None,
                "cache_mode": "materialized-exact",
                "provenance": _json_loads(row["provenance_json"], {}),
            },
            "result": _json_loads(row["payload_json"], {}),
            "terms": _json_loads(row["wanted_terms_json"], []),
        }

    def find_canonical_term_view(self, project_name: str, project_file: str, term: str) -> dict[str, Any] | None:
        self.sync_from_jobs_if_needed()
        normalized = term.lower()
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_term_views
                WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                """,
                (project_name, project_file, normalized),
            ).fetchone()
        if row is None:
            return None
        payload = _json_loads(row["payload_json"], {})
        provenance = _json_loads(row["provenance_json"], {})
        return {
            "job": {
                "job_id": "canonical-term:" + normalized,
                "project_name": project_name,
                "project_file": project_file,
                "status": "completed",
                "start_time": str(row["updated_at"]),
                "output_file": None,
                "cache_mode": "canonical-term",
                "provenance": provenance,
            },
            "result": payload,
            "terms": [str(row["term"])],
        }

    def record_extraction_job(self, job_info: dict[str, Any]) -> None:
        self.upsert_job(job_info)

    def materialize_native_trace_view(
        self,
        project_name: str,
        project_file: str,
        request_signature: str,
        requested_terms: list[str],
        search_terms: list[str],
        bridge_plan: dict[str, Any],
        family_hint: str | None = None,
    ) -> dict[str, Any]:
        self.sync_from_jobs_if_needed()
        requested_terms = [str(term).strip() for term in requested_terms if str(term).strip()]
        search_terms = [str(term).strip() for term in search_terms if str(term).strip()]
        all_terms = _dedupe_sequence([*requested_terms, *search_terms])
        term_views: list[dict[str, Any]] = []
        provenance: dict[str, Any] = {
            "requestedTerms": requested_terms,
            "searchTerms": search_terms,
            "termViews": {},
            "bridgePlanSourceJobs": [],
            "searchAttemptSourceJobs": [],
        }
        with self.connect() as conn:
            for term in all_terms:
                row = conn.execute(
                    """
                    SELECT * FROM materialized_term_views
                    WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                    """,
                    (project_name, project_file, term.lower()),
                ).fetchone()
                if row is None:
                    continue
                term_views.append(_json_loads(row["payload_json"], {}))
                provenance["termViews"][term] = _json_loads(row["provenance_json"], {})

            latest_attempt_row = None
            if requested_terms:
                latest_attempt_row = conn.execute(
                    """
                    SELECT * FROM evidence
                    WHERE project_name = ?
                      AND project_file = ?
                      AND normalized_term IN ({})
                      AND aspect_kind = 'native_search_attempt'
                      AND is_valid = 1
                      AND invalidated_at IS NULL
                    ORDER BY reducer_priority DESC, confidence DESC, start_time DESC, evidence_id DESC
                    LIMIT 1
                    """.format(",".join("?" for _ in requested_terms)),
                    (project_name, project_file, *[term.lower() for term in requested_terms]),
                ).fetchone()
                bridge_rows = conn.execute(
                    """
                    SELECT * FROM evidence
                    WHERE project_name = ?
                      AND project_file = ?
                      AND normalized_term IN ({})
                      AND aspect_kind = 'bridge_plan'
                      AND is_valid = 1
                      AND invalidated_at IS NULL
                    ORDER BY reducer_priority DESC, confidence DESC, start_time DESC, evidence_id DESC
                    """.format(",".join("?" for _ in requested_terms)),
                    (project_name, project_file, *[term.lower() for term in requested_terms]),
                ).fetchall()
            else:
                bridge_rows = []

        combined_result = {
            "binary": project_file,
            "timestamp": datetime.now().isoformat(),
            "functions": {},
            "fuzzyFunctions": {},
            "referenceFunctions": {},
            "ascii_targets": {},
            "metadataNeighborhoods": {},
            "termBridges": {},
            "bridgePlans": {},
            "metadataContextFragments": {},
            "ownerInferences": {},
            "siblingClusters": {},
            "nativeSearchAttempts": {},
            "nativeSignalFragments": {},
            "errors": [],
            "schemaVersion": SCHEMA_VERSION_FLOOR,
        }
        reconstructions: list[dict[str, Any]] = []
        graphs: list[dict[str, Any]] = []
        for term_payload in term_views:
            combined_result["functions"].update(term_payload.get("functions", {}) or {})
            combined_result["fuzzyFunctions"].update(term_payload.get("fuzzyFunctions", {}) or {})
            combined_result["referenceFunctions"].update(term_payload.get("referenceFunctions", {}) or {})
            combined_result["ascii_targets"].update(term_payload.get("ascii_targets", {}) or {})
            combined_result["metadataNeighborhoods"].update(term_payload.get("metadataNeighborhoods", {}) or {})
            combined_result["termBridges"].update(term_payload.get("termBridges", {}) or {})
            combined_result["bridgePlans"].update(term_payload.get("bridgePlans", {}) or {})
            combined_result["metadataContextFragments"].update(term_payload.get("metadataContextFragments", {}) or {})
            combined_result["ownerInferences"].update(term_payload.get("ownerInferences", {}) or {})
            combined_result["siblingClusters"].update(term_payload.get("siblingClusters", {}) or {})
            combined_result["nativeSearchAttempts"].update(term_payload.get("nativeSearchAttempts", {}) or {})
            combined_result["nativeSignalFragments"].update(term_payload.get("nativeSignalFragments", {}) or {})
            if term_payload.get("managedReconstruction"):
                reconstructions.append(term_payload["managedReconstruction"])
            if term_payload.get("managedGraph"):
                graphs.append(term_payload["managedGraph"])
            combined_result["schemaVersion"] = max(int(combined_result["schemaVersion"]), int(term_payload.get("schemaVersion", 0) or 0))
        combined_result["managedReconstruction"] = _merge_managed_reconstructions(reconstructions)
        effective_family_hint = (
            str(combined_result["managedReconstruction"].get("familyHint") or "").strip()
            or str(family_hint or "").strip()
            or str(bridge_plan.get("familyHint") or "").strip()
        )
        if effective_family_hint:
            combined_result["managedReconstruction"]["familyHint"] = effective_family_hint
        combined_result["managedReconstruction"] = _prune_managed_reconstruction(
            combined_result["managedReconstruction"]
        )
        allowed_owners = {
            str(entry.get("owner") or "")
            for entry in (combined_result["managedReconstruction"].get("scoredOwners") or [])
            if str(entry.get("owner") or "")
        }
        combined_result["managedGraph"] = _prune_managed_graph(
            _merge_managed_graphs(graphs),
            effective_family_hint or None,
            allowed_owners,
        )

        latest_attempt = _json_loads(latest_attempt_row["payload_json"], {}) if latest_attempt_row is not None else {
            "requestedTerms": requested_terms,
            "searchTerms": search_terms,
            "status": "unknown",
            "cacheHit": False,
            "familyHint": family_hint,
        }
        if latest_attempt_row is not None:
            provenance["searchAttemptSourceJobs"].append(str(latest_attempt_row["source_job_id"]))

        materialized_bridge_plan = dict(bridge_plan)
        existing_matches = {
            str(match.get("term", "")): match
            for match in materialized_bridge_plan.get("matches", [])
            if isinstance(match, dict)
        }
        for row in bridge_rows:
            payload = _json_loads(row["payload_json"], {})
            term = str(payload.get("term", "")).strip()
            if term and term not in existing_matches:
                existing_matches[term] = payload
            job_id = str(row["source_job_id"])
            if job_id and job_id not in provenance["bridgePlanSourceJobs"]:
                provenance["bridgePlanSourceJobs"].append(job_id)
        if existing_matches:
            materialized_bridge_plan["matches"] = list(existing_matches.values())

        payload = {
            "available": True,
            "project": project_name,
            "requestedTerms": requested_terms,
            "searchTerms": search_terms,
            "status": str(latest_attempt.get("status", "unknown")),
            "cacheHit": bool(latest_attempt.get("cacheHit", False)),
            "jobId": latest_attempt.get("sourceJobId") or latest_attempt.get("jobId"),
            "job": latest_attempt.get("job"),
            "bridgePlan": materialized_bridge_plan,
            "fallbackBridgeAttempt": latest_attempt.get("fallbackBridgeAttempt"),
            "result": combined_result,
        }

        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO materialized_native_trace_views(
                    project_name, project_file, request_signature, requested_terms_json, search_terms_json,
                    payload_json, provenance_json, reducer_version, built_at
                ) VALUES(?,?,?,?,?,?,?,?,?)
                ON CONFLICT(project_name, project_file, request_signature) DO UPDATE SET
                    requested_terms_json=excluded.requested_terms_json,
                    search_terms_json=excluded.search_terms_json,
                    payload_json=excluded.payload_json,
                    provenance_json=excluded.provenance_json,
                    reducer_version=excluded.reducer_version,
                    built_at=excluded.built_at
                """,
                (
                    project_name,
                    project_file,
                    request_signature,
                    _json_dumps(requested_terms),
                    _json_dumps(search_terms),
                    _json_dumps(payload),
                    _json_dumps(provenance),
                    "db-native-trace-v1",
                    datetime.now().isoformat(),
                ),
            )
        return payload

    def find_materialized_native_trace_view(self, project_name: str, project_file: str, request_signature: str) -> dict[str, Any] | None:
        self.sync_from_jobs_if_needed()
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_native_trace_views
                WHERE project_name = ? AND project_file = ? AND request_signature = ?
                """,
                (project_name, project_file, request_signature),
            ).fetchone()
        if row is None:
            return None
        return {
            "requestedTerms": _json_loads(row["requested_terms_json"], []),
            "searchTerms": _json_loads(row["search_terms_json"], []),
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"] or ""),
            "builtAt": str(row["built_at"]),
        }

    def find_graph_backfill(self, project_name: str, project_file: str, term: str) -> list[dict[str, str]]:
        self.sync_from_jobs_if_needed()
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT target_term, source_term, kind, source_ref FROM graph_links
                WHERE project_name = ?
                  AND project_file = ?
                  AND target_term = ?
                ORDER BY start_time DESC
                """,
                (project_name, project_file, term.lower()),
            ).fetchall()
        return [
            {
                "value": str(row["target_term"]),
                "sourceTerm": str(row["source_term"]),
                "kind": str(row["kind"]),
                "sourceRef": str(row["source_ref"]),
            }
            for row in rows
        ]

    def reclaim_expired_running_jobs(self, now: datetime | None = None) -> list[str]:
        now = now or datetime.now()
        reclaimed: list[str] = []
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT job_id FROM jobs
                WHERE status = 'running'
                  AND lease_expires_at IS NOT NULL
                  AND lease_expires_at < ?
                """,
                (now.isoformat(),),
            ).fetchall()
            for row in rows:
                job_id = str(row["job_id"])
                reclaimed.append(job_id)
                conn.execute(
                    """
                    UPDATE jobs
                    SET status = 'expired',
                        updated_at = ?,
                        invalidation_reason = COALESCE(invalidation_reason, 'lease-expired')
                    WHERE job_id = ?
                    """,
                    (now.isoformat(), job_id),
                )
        return reclaimed

    def remove_jobs(self, job_ids: list[str]) -> None:
        normalized = sorted({str(job_id).strip() for job_id in job_ids if str(job_id).strip()})
        if not normalized:
            return
        with self.connect() as conn:
            placeholders = ",".join("?" for _ in normalized)
            conn.execute("DELETE FROM jobs WHERE job_id IN ({})".format(placeholders), tuple(normalized))

    def clear_job_local_artifacts(self, job_ids: list[str]) -> None:
        normalized = sorted({str(job_id).strip() for job_id in job_ids if str(job_id).strip()})
        if not normalized:
            return
        now = datetime.now().isoformat()
        with self.connect() as conn:
            placeholders = ",".join("?" for _ in normalized)
            conn.execute(
                """
                UPDATE jobs
                SET output_file = NULL,
                    job_file = NULL,
                    marker_file = NULL,
                    log_file = NULL,
                    updated_at = ?
                WHERE job_id IN ({})
                """.format(placeholders),
                (now, *normalized),
            )

    def invalidate_jobs(
        self,
        job_id: str | None = None,
        term: str | None = None,
        schema_lt: int | None = None,
        reason: str = "manual-invalidate",
        result_loader=None,
    ) -> list[str]:
        self.sync_from_jobs_if_needed()
        invalidated: list[str] = []
        with self.connect() as conn:
            if job_id:
                rows = conn.execute("SELECT job_id FROM jobs WHERE job_id = ?", (job_id,)).fetchall()
            elif term:
                rows = conn.execute(
                    """
                    SELECT DISTINCT jobs.job_id FROM jobs
                    JOIN job_terms ON job_terms.job_id = jobs.job_id
                    WHERE lower(job_terms.term) = lower(?)
                    """,
                    (term,),
                ).fetchall()
            elif schema_lt is not None and result_loader is not None:
                candidate_rows = conn.execute("SELECT * FROM jobs").fetchall()
                rows = []
                for row in candidate_rows:
                    job = self._job_row_to_dict(row)
                    if not job:
                        continue
                    result = result_loader(job)
                    version = int((result or {}).get("schemaVersion", 0) or 0)
                    if version and version < schema_lt:
                        rows.append({"job_id": job["job_id"]})
            else:
                rows = []
            timestamp = datetime.now().isoformat()
            for row in rows:
                current_job_id = str(row["job_id"])
                invalidated.append(current_job_id)
                conn.execute(
                    """
                    UPDATE jobs
                    SET invalidated_at = ?, invalidation_reason = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (timestamp, reason, timestamp, current_job_id),
                )
        return invalidated

    def invalidate_evidence(
        self,
        term: str | None = None,
        aspect_kind: str | None = None,
        source_job_id: str | None = None,
        script_name: str | None = None,
        producer_version: str | None = None,
        schema_lt: int | None = None,
        reason: str = "manual-partial-invalidate",
    ) -> list[int]:
        self.sync_from_jobs_if_needed()
        invalidated: list[int] = []
        clauses = ["1=1"]
        params: list[Any] = []
        if term:
            clauses.append("normalized_term = ?")
            params.append(term.lower())
        if aspect_kind:
            clauses.append("aspect_kind = ?")
            params.append(aspect_kind)
        if source_job_id:
            clauses.append("source_job_id = ?")
            params.append(source_job_id)
        if script_name:
            clauses.append("script_name = ?")
            params.append(script_name)
        if producer_version:
            clauses.append("producer_version = ?")
            params.append(producer_version)
        if schema_lt is not None:
            clauses.append("schema_version < ?")
            params.append(int(schema_lt))
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT evidence_id FROM evidence WHERE {} AND is_valid = 1 AND invalidated_at IS NULL".format(" AND ".join(clauses)),
                tuple(params),
            ).fetchall()
            timestamp = datetime.now().isoformat()
            for row in rows:
                evidence_id = int(row["evidence_id"])
                invalidated.append(evidence_id)
                conn.execute(
                    """
                    UPDATE evidence
                    SET is_valid = 0, invalidated_at = ?, invalidation_reason = ?, updated_at = ?
                    WHERE evidence_id = ?
                    """,
                    (timestamp, reason, timestamp, evidence_id),
                )
        return invalidated

    def export_process_index(self) -> dict[str, Any]:
        payload = {"version": 1, "generatedAt": datetime.now().isoformat(), "jobsByProject": {}}
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM jobs
                WHERE mode = 'process-project'
                  AND status = 'completed'
                  AND invalidated_at IS NULL
                ORDER BY start_time ASC
                """
            ).fetchall()
        for row in rows:
            job = self._job_row_to_dict(row)
            if not job:
                continue
            project_name = str(job.get("project_name", ""))
            project_file = str(job.get("project_file", ""))
            if not project_name or not project_file:
                continue
            payload.setdefault("jobsByProject", {}).setdefault(project_name, {}).setdefault(project_file, []).append(
                {
                    "job_id": job.get("job_id"),
                    "project_name": project_name,
                    "project_file": project_file,
                    "start_time": job.get("start_time", ""),
                    "output_file": job.get("output_file", ""),
                    "search_strings": job.get("search_strings", []),
                    "signature": job.get("signature", ""),
                    "status": job.get("status", ""),
                }
            )
        return payload

    def export_native_graph_index(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"version": 2, "generatedAt": datetime.now().isoformat(), "projects": {}}
        with self.connect() as conn:
            term_rows = conn.execute(
                """
                SELECT * FROM materialized_term_views
                ORDER BY project_name, project_file, normalized_term
                """
            ).fetchall()
            canonical_rows = conn.execute(
                """
                SELECT * FROM canonical_term_aspects
                ORDER BY project_name, project_file, normalized_term, aspect_kind
                """
            ).fetchall()
        canonical_by_term: dict[tuple[str, str, str], dict[str, Any]] = {}
        for row in canonical_rows:
            key = (str(row["project_name"]), str(row["project_file"]), str(row["normalized_term"]))
            canonical_by_term.setdefault(key, {})[str(row["aspect_kind"])] = {
                "payload": _json_loads(row["canonical_payload_json"], None),
                "provenance": _json_loads(row["provenance_json"], {}),
                "selectedEvidenceIds": _json_loads(row["selected_evidence_ids_json"], []),
                "alternates": _json_loads(row["alternate_payloads_json"], []),
            }
        for row in term_rows:
            project_name = str(row["project_name"])
            project_file = str(row["project_file"])
            term = str(row["term"])
            normalized_term = str(row["normalized_term"])
            project_bucket = payload.setdefault("projects", {}).setdefault(project_name, {}).setdefault(project_file, {})
            per_term = project_bucket.setdefault("perTerm", {})
            term_payload = _json_loads(row["payload_json"], {})
            term_provenance = _json_loads(row["provenance_json"], {})
            canonical_aspects = canonical_by_term.get((project_name, project_file, normalized_term), {})
            per_term[term] = {
                "canonicalTermView": term_payload,
                "provenance": term_provenance,
                "canonicalAspects": canonical_aspects,
                "termBridge": ((term_payload.get("termBridges") or {}).get(term) or {}),
                "managedReconstruction": term_payload.get("managedReconstruction", {}),
                "managedGraph": term_payload.get("managedGraph", {}),
                "outputFile": None,
                "startTime": str(row["updated_at"]),
            }
            aggregate = project_bucket.setdefault(
                "aggregateGraph",
                {"owners": {}, "methods": {}, "fields": {}, "rawValues": {}, "termLinks": {}, "incidentalFindings": []},
            )
            for aspect_kind, aspect in canonical_aspects.items():
                aspect_payload = aspect.get("payload")
                if aspect_kind in {"owner_candidates", "related_terms"}:
                    values = aspect_payload if isinstance(aspect_payload, list) else []
                    aggregate["termLinks"].setdefault(term, [])
                    for value in values:
                        link = {"kind": aspect_kind, "value": value}
                        if link not in aggregate["termLinks"][term]:
                            aggregate["termLinks"][term].append(link)
                        aggregate["incidentalFindings"].append({"sourceTerm": term, "kind": aspect_kind, "value": value})
                elif aspect_kind == "managed_graph_owner":
                    for owner_entry in aspect_payload if isinstance(aspect_payload, list) else []:
                        owner = str(owner_entry.get("owner", "")).strip()
                        if not owner:
                            continue
                        bucket = aggregate["owners"].setdefault(owner, {"terms": [], "methods": [], "fields": [], "rawValues": [], "scores": []})
                        if term not in bucket["terms"]:
                            bucket["terms"].append(term)
                        score = int(owner_entry.get("score", 0) or 0)
                        if score and score not in bucket["scores"]:
                            bucket["scores"].append(score)
                        for key, target_bucket in (("methods", aggregate["methods"]), ("fields", aggregate["fields"]), ("rawValues", aggregate["rawValues"])):
                            for item in owner_entry.get(key, []) or []:
                                if item not in bucket[key]:
                                    bucket[key].append(item)
                                target_bucket.setdefault(item, {"terms": []})
                                if term not in target_bucket[item]["terms"]:
                                    target_bucket[item]["terms"].append(term)
        return payload

    def upsert_trace_dataset(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        request_signature: str,
        dataset: dict[str, Any],
    ) -> None:
        now = datetime.now().isoformat()
        native_trace = dataset.get("nativeTrace") or {}
        source_job_id = str(native_trace.get("jobId") or "")
        source_terms = list(native_trace.get("searchTerms", []) or [])
        producer_version = str(dataset.get("assetSet", {}).get("fingerprint", "") or "")
        fragment_rows: list[dict[str, Any]] = []

        row_recovery = dataset.get("rowRecovery") or {}
        formula_reconstruction = row_recovery.get("formulaReconstruction") or {}
        runtime_instance = row_recovery.get("runtimeInstanceRecovery") or {}
        runtime_evaluator = row_recovery.get("runtimeEvaluatorRecovery") or {}
        presentation_update = row_recovery.get("presentationUpdatePath") or {}
        trace_graph = dataset.get("traceGraph") or {}
        sanitized_row_recovery = _sanitize_row_recovery_for_persistence(dict(row_recovery or {}))
        row_local_graph = _derive_token_shop_row_local_graph(row_recovery)
        missing_seams = _derive_token_shop_row_missing_seams(row_local_graph, row_recovery)
        compatibility_status = _derive_token_shop_row_compatibility_status(
            row_local_graph,
            missing_seams,
            row_recovery,
        )
        for key, value in dataset.items():
            if key == "traceRun":
                continue
            if key not in TRACE_FRAGMENT_TOP_LEVEL_KEYS:
                continue
            fragment_payload = sanitized_row_recovery if key == "rowRecovery" else value
            fragment_rows.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "trace_scope": trace_scope,
                    "request_signature": request_signature,
                    "fragment_kind": key,
                    "fragment_key": "__self__",
                    "payload": fragment_payload,
                    "source_job_id": source_job_id if key in {"nativeTrace", "nativeReconstruction"} else "",
                    "source_term": ",".join(source_terms) if key in {"nativeTrace", "nativeReconstruction"} else "",
                    "confidence": 1.0 if key in {"nativeTrace", "nativeReconstruction", "traceGraph"} else 0.9,
                    "reducer_priority": 100 if key in {"nativeTrace", "nativeReconstruction", "traceGraph"} else 90,
                    "schema_version": int(dataset.get("nativeTrace", {}).get("result", {}).get("schemaVersion", SCHEMA_VERSION_FLOOR) or SCHEMA_VERSION_FLOOR),
                    "script_name": "unity_trace_bundle.py",
                    "producer_version": producer_version,
                    "start_time": str(dataset.get("generatedAt", "")) or now,
                }
            )

        system_fragments = {
            "formula_fragment": {
                "formulaReconstruction": formula_reconstruction,
                "recoveredFormulaFields": row_recovery.get("recoveredFormulaFields"),
                "recoveredFormulaValues": row_recovery.get("recoveredFormulaValues"),
            },
            "threshold_fragment": {
                "runtimeCostModel": formula_reconstruction.get("runtimeCostModel"),
                "unresolvedRuntimeTargets": compatibility_status.get("unresolvedRuntimeTargets"),
                "lostStructure": dataset.get("lostStructure"),
            },
            "dependency_fragment": {
                "sourceRoles": dataset.get("sourceRoles"),
                "requiredSourceFamilies": (dataset.get("target") or {}).get("requiredSourceFamilies"),
                "traceEdges": (trace_graph or {}).get("edges"),
                "negativeEdges": (trace_graph or {}).get("negativeEdges"),
            },
            "ui_binding_fragment": {
                "shellWindow": dataset.get("shellWindow"),
                "surfaces": dataset.get("surfaces"),
                "presentationUpdatePath": presentation_update,
            },
            "progression_fragment": {
                "assessmentSemanticKey": f"target-assessment:{trace_scope}",
                "runtimeEvaluatorRecovery": runtime_evaluator,
                "runtimeStatus": dataset.get("runtimeStatus"),
            },
            "narrative_seed_fragment": {
                "groundedConclusion": ((dataset.get("narrativeSeed") or {}).get("groundedConclusion")),
                "currentBoundary": ((dataset.get("narrativeSeed") or {}).get("currentBoundary")),
                "narrativeSemanticKey": f"target-narrative:{trace_scope}",
            },
            "bridge_comparison_seed_fragment": {
                "bridgeComparisonSemanticKey": dataset.get("bridgeComparisonSemanticKey"),
                "bridgeCheck": ((dataset.get("bridgeComparisonSeed") or {}).get("bridgeCheck")),
                "solvedVsBlockedDiff": ((dataset.get("bridgeComparisonSeed") or {}).get("solvedVsBlockedDiff")),
            },
            "owner_controller_fragment": {
                "ownerFieldBlock": row_recovery.get("ownerFieldBlock"),
                "controllerBlock": row_recovery.get("controllerBlock"),
                "ownerBlobRow": row_recovery.get("ownerBlobRow"),
                "ownerModifierScan": row_recovery.get("ownerModifierScan"),
                "runtimeEvaluatorRecovery": runtime_evaluator,
            },
            "runtime_table_fragment": {
                "runtimeInstanceRecovery": runtime_instance,
                "nativeReconstruction": dataset.get("nativeReconstruction"),
            },
            "reconstruction_note_fragment": {
                "assessmentSemanticKey": f"target-assessment:{trace_scope}",
                "narrativeSemanticKey": f"target-narrative:{trace_scope}",
                "bridgeComparisonSemanticKey": dataset.get("bridgeComparisonSemanticKey"),
                "bridgeCheck": None if dataset.get("bridgeComparisonSeed") else dataset.get("bridgeCheck"),
            },
        }
        for kind, value in system_fragments.items():
            if not value:
                continue
            fragment_rows.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "trace_scope": trace_scope,
                    "request_signature": request_signature,
                    "fragment_kind": kind,
                    "fragment_key": "__self__",
                    "payload": value,
                    "source_job_id": source_job_id if source_job_id else "",
                    "source_term": ",".join(source_terms) if source_terms else "",
                    "confidence": 0.95,
                    "reducer_priority": 95,
                    "schema_version": int(dataset.get("nativeTrace", {}).get("result", {}).get("schemaVersion", SCHEMA_VERSION_FLOOR) or SCHEMA_VERSION_FLOOR),
                    "script_name": "unity_trace_bundle.py",
                    "producer_version": producer_version,
                    "start_time": str(dataset.get("generatedAt", "")) or now,
                }
            )
        for semantic_fragment in dataset.get("semanticFragments", []) or []:
            if not isinstance(semantic_fragment, dict):
                continue
            fragment_kind = str(semantic_fragment.get("fragment_kind", "")).strip()
            fragment_key = str(semantic_fragment.get("fragment_key", "")).strip()
            payload = semantic_fragment.get("payload")
            if not fragment_kind or not fragment_key or not payload:
                continue
            fragment_rows.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "trace_scope": trace_scope,
                    "request_signature": request_signature,
                    "fragment_kind": fragment_kind,
                    "fragment_key": fragment_key,
                    "payload": payload,
                    "source_job_id": source_job_id if source_job_id else "",
                    "source_term": ",".join(source_terms) if source_terms else "",
                    "confidence": 0.97,
                    "reducer_priority": 97,
                    "schema_version": int(dataset.get("nativeTrace", {}).get("result", {}).get("schemaVersion", SCHEMA_VERSION_FLOOR) or SCHEMA_VERSION_FLOOR),
                    "script_name": "unity_trace_bundle.py",
                    "producer_version": producer_version,
                    "start_time": str(dataset.get("generatedAt", "")) or now,
                }
            )
        with self.connect() as conn:
            for row in fragment_rows:
                conn.execute(
                    """
                    UPDATE trace_fragments
                    SET is_valid = 0,
                        invalidated_at = ?,
                        invalidation_reason = ?,
                        superseded_by = ?,
                        updated_at = ?
                    WHERE project_name = ? AND project_file = ? AND trace_scope = ?
                      AND fragment_kind = ? AND fragment_key = ?
                      AND is_valid = 1 AND invalidated_at IS NULL
                      AND NOT (
                        request_signature = ? AND source_job_id = ? AND source_term = ?
                      )
                    """,
                    (
                        now,
                        "superseded-by-new-trace-run",
                        row["request_signature"],
                        now,
                        row["project_name"],
                        row["project_file"],
                        row["trace_scope"],
                        row["fragment_kind"],
                        row["fragment_key"],
                        row["request_signature"],
                        row["source_job_id"],
                        row["source_term"],
                    ),
                )
                existing = conn.execute(
                    """
                    SELECT is_valid, invalidated_at, invalidation_reason, superseded_by
                    FROM trace_fragments
                    WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                      AND fragment_kind = ? AND fragment_key = ? AND source_job_id = ? AND source_term = ?
                    """,
                    (
                        row["project_name"],
                        row["project_file"],
                        row["trace_scope"],
                        row["request_signature"],
                        row["fragment_kind"],
                        row["fragment_key"],
                        row["source_job_id"],
                        row["source_term"],
                    ),
                ).fetchone()
                is_valid = int(existing["is_valid"]) if existing else 1
                invalidated_at = existing["invalidated_at"] if existing else None
                invalidation_reason = existing["invalidation_reason"] if existing else None
                superseded_by = existing["superseded_by"] if existing else None
                conn.execute(
                    """
                    INSERT INTO trace_fragments(
                        project_name, project_file, trace_scope, request_signature, fragment_kind, fragment_key,
                        payload_json, source_job_id, source_term, confidence, reducer_priority, schema_version,
                        script_name, producer_version, start_time, is_valid, invalidated_at, invalidation_reason,
                        superseded_by, created_at, updated_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(project_name, project_file, trace_scope, request_signature, fragment_kind, fragment_key, source_job_id, source_term)
                    DO UPDATE SET
                        payload_json=excluded.payload_json,
                        confidence=excluded.confidence,
                        reducer_priority=excluded.reducer_priority,
                        schema_version=excluded.schema_version,
                        script_name=excluded.script_name,
                        producer_version=excluded.producer_version,
                        start_time=excluded.start_time,
                        is_valid=1,
                        invalidated_at=NULL,
                        invalidation_reason=NULL,
                        superseded_by=NULL,
                        updated_at=excluded.updated_at
                    """,
                    (
                        row["project_name"],
                        row["project_file"],
                        row["trace_scope"],
                        row["request_signature"],
                        row["fragment_kind"],
                        row["fragment_key"],
                        _json_dumps(row["payload"]),
                        row["source_job_id"],
                        row["source_term"],
                        row["confidence"],
                        row["reducer_priority"],
                        row["schema_version"],
                        row["script_name"],
                        row["producer_version"],
                        row["start_time"],
                        is_valid,
                        invalidated_at,
                        invalidation_reason,
                        superseded_by,
                        now,
                        now,
                    ),
                )
        self.rebuild_trace_views()

    def rebuild_trace_views(self) -> None:
        with self.connect() as conn:
            _normalize_live_trace_fragment_payloads(conn)
            conn.execute("DELETE FROM canonical_trace_fragments")
            conn.execute("DELETE FROM materialized_trace_views")
            conn.execute("DELETE FROM canonical_system_trace_views")
            conn.execute("DELETE FROM canonical_semantic_fragments")
            conn.execute("DELETE FROM materialized_target_bundle_views")
            rows = conn.execute(
                """
                SELECT * FROM trace_fragments
                WHERE is_valid = 1 AND invalidated_at IS NULL
                ORDER BY project_name, project_file, trace_scope, request_signature, fragment_kind, updated_at DESC
                """
            ).fetchall()
            grouped: dict[tuple[str, str, str, str, str, str], list[sqlite3.Row]] = {}
            for row in rows:
                if _is_ignored_legacy_trace_fragment(row):
                    continue
                key = (
                    str(row["project_name"]),
                    str(row["project_file"]),
                    str(row["trace_scope"]),
                    str(row["request_signature"]),
                    str(row["fragment_kind"]),
                    str(row["fragment_key"]),
                )
                grouped.setdefault(key, []).append(row)
            trace_groups: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            semantic_groups: dict[tuple[str, str, str, str], list[sqlite3.Row]] = {}
            for key, fragment_rows in grouped.items():
                project_name, project_file, trace_scope, request_signature, fragment_kind, fragment_key = key
                ordered = sorted(fragment_rows, key=_rank_row, reverse=True)
                selected = ordered[0]
                selected_ids = [int(row["fragment_id"]) for row in ordered]
                raw_payload = _json_loads(selected["payload_json"], None)
                canonical_payload = _normalize_reference_owned_payload(
                    fragment_kind,
                    raw_payload if isinstance(raw_payload, dict) else None,
                    trace_scope,
                )
                provenance = {
                    "fragmentIds": selected_ids,
                    "sourceJobIds": [str(row["source_job_id"]) for row in ordered if str(row["source_job_id"])],
                    "sourceTerms": [str(row["source_term"]) for row in ordered if str(row["source_term"])],
                    "reducer": "best-rank",
                }
                if fragment_kind in {"reconstruction_note_fragment", "narrative_seed_fragment", "bridge_comparison_seed_fragment"} and isinstance(raw_payload, dict):
                    provenance["rawPayload"] = raw_payload
                provenance["payloadSignals"] = _collect_payload_provenance_signals(canonical_payload)
                alternates = [
                    {
                        "fragmentId": int(row["fragment_id"]),
                        "sourceJobId": str(row["source_job_id"]),
                        "sourceTerm": str(row["source_term"]),
                        "confidence": float(row["confidence"]),
                        "payload": _json_loads(row["payload_json"], None),
                    }
                    for row in ordered[1:]
                ]
                conn.execute(
                    """
                    INSERT INTO canonical_trace_fragments(
                        project_name, project_file, trace_scope, request_signature, fragment_kind, fragment_key,
                        selected_fragment_ids_json, canonical_payload_json, alternate_payloads_json, provenance_json, updated_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        trace_scope,
                        request_signature,
                        fragment_kind,
                        fragment_key,
                        _json_dumps(selected_ids),
                        _json_dumps(canonical_payload),
                        _json_dumps(alternates),
                        _json_dumps(provenance),
                        datetime.now().isoformat(),
                    ),
                )
                trace_group = trace_groups.setdefault(
                    (project_name, project_file, trace_scope, request_signature),
                    {"payload": {}, "provenance": {}},
                )
                trace_group["payload"][fragment_kind] = canonical_payload
                trace_group["provenance"][fragment_kind] = provenance
                if fragment_kind in SYSTEM_TRACE_FRAGMENT_KINDS and fragment_key != "__self__":
                    semantic_groups.setdefault((project_name, project_file, fragment_kind, fragment_key), []).extend(fragment_rows)

            canonical_semantic_lookup: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            canonical_semantic_entries: list[dict[str, Any]] = []
            for semantic_key, fragment_rows in semantic_groups.items():
                project_name, project_file, fragment_kind, fragment_key = semantic_key
                canonical_payload, alternates, provenance, reducer_version = _reduce_semantic_fragment(fragment_kind, fragment_rows)
                provenance = {
                    **provenance,
                    "payloadSignals": _collect_payload_provenance_signals(
                        {
                            "canonical": canonical_payload,
                            "alternates": alternates,
                        }
                    ),
                }
                conn.execute(
                    """
                    INSERT OR REPLACE INTO canonical_semantic_fragments(
                        project_name, project_file, fragment_kind, fragment_key, canonical_payload_json,
                        alternate_payloads_json, provenance_json, reducer_version, built_at
                    ) VALUES(?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        fragment_kind,
                        fragment_key,
                        _json_dumps(canonical_payload),
                        _json_dumps(alternates),
                        _json_dumps(provenance),
                        reducer_version,
                        datetime.now().isoformat(),
                    ),
                )
                canonical_semantic_lookup[semantic_key] = {
                    "payload": canonical_payload,
                    "alternates": alternates,
                    "provenance": provenance,
                }
                canonical_semantic_entries.append(
                    {
                        "project_name": project_name,
                        "project_file": project_file,
                        "fragment_kind": fragment_kind,
                        "fragment_key": fragment_key,
                        "payload": canonical_payload,
                        "provenance": provenance,
                    }
                )

            for entry in _derive_reducer_semantic_fragments(conn, trace_groups):
                semantic_key = (
                    str(entry["project_name"]),
                    str(entry["project_file"]),
                    str(entry["fragment_kind"]),
                    str(entry["fragment_key"]),
                )
                payload = dict(entry["payload"] or {})
                alternates: list[dict[str, Any]] = []
                provenance = {
                    **dict(entry.get("provenance") or {}),
                    "payloadSignals": _collect_payload_provenance_signals(
                        {
                            "canonical": payload,
                            "alternates": alternates,
                        }
                    ),
                }
                conn.execute(
                    """
                    INSERT OR REPLACE INTO canonical_semantic_fragments(
                        project_name, project_file, fragment_kind, fragment_key, canonical_payload_json,
                        alternate_payloads_json, provenance_json, reducer_version, built_at
                    ) VALUES(?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        semantic_key[0],
                        semantic_key[1],
                        semantic_key[2],
                        semantic_key[3],
                        _json_dumps(payload),
                        _json_dumps(alternates),
                        _json_dumps(provenance),
                        str(entry.get("reducer_version") or "semantic-fragment-derived-v1"),
                        datetime.now().isoformat(),
                    ),
                )
                canonical_semantic_lookup[semantic_key] = {
                    "payload": payload,
                    "alternates": alternates,
                    "provenance": provenance,
                }
                canonical_semantic_entries = [
                    existing
                    for existing in canonical_semantic_entries
                    if not (
                        existing["project_name"] == semantic_key[0]
                        and existing["project_file"] == semantic_key[1]
                        and existing["fragment_kind"] == semantic_key[2]
                        and existing["fragment_key"] == semantic_key[3]
                    )
                ]
                canonical_semantic_entries.append(
                    {
                        "project_name": semantic_key[0],
                        "project_file": semantic_key[1],
                        "fragment_kind": semantic_key[2],
                        "fragment_key": semantic_key[3],
                        "payload": payload,
                        "provenance": provenance,
                    }
                )

            for (project_name, project_file, trace_scope, request_signature), value in trace_groups.items():
                payload = dict(value["payload"])
                payload.setdefault("dataset", "unity-trace-bundle")
                payload.setdefault("generatedAt", datetime.now().isoformat(timespec="seconds"))
                conn.execute(
                    """
                    INSERT INTO materialized_trace_views(
                        project_name, project_file, trace_scope, request_signature, payload_json, provenance_json, reducer_version, built_at
                    ) VALUES(?,?,?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        trace_scope,
                        request_signature,
                        _json_dumps(payload),
                        _json_dumps(
                            {
                                **value["provenance"],
                                "payloadSignals": _collect_payload_provenance_signals(payload),
                            }
                        ),
                        "trace-fragment-best-rank-v1",
                        datetime.now().isoformat(),
                    ),
                )

                system_payload = {
                    kind: payload
                    for kind, payload in value["payload"].items()
                    if kind in SYSTEM_TRACE_FRAGMENT_KINDS
                }
                system_provenance = {
                    kind: provenance
                    for kind, provenance in value["provenance"].items()
                    if kind in SYSTEM_TRACE_FRAGMENT_KINDS
                }
                conn.execute(
                    """
                    INSERT INTO canonical_system_trace_views(
                        project_name, project_file, trace_scope, request_signature, payload_json, provenance_json, reducer_version, built_at
                    ) VALUES(?,?,?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        trace_scope,
                        request_signature,
                        _json_dumps(system_payload),
                        _json_dumps(
                            {
                                **system_provenance,
                                "payloadSignals": _collect_payload_provenance_signals(system_payload),
                            }
                        ),
                        "system-trace-best-rank-v1",
                        datetime.now().isoformat(),
                    ),
                )
                semantic_keys = [
                    (kind, str((payload.get(kind) or {}).get("semanticKey", "")))
                    for kind in SYSTEM_TRACE_FRAGMENT_KINDS
                    if isinstance(payload.get(kind), dict) and str((payload.get(kind) or {}).get("semanticKey", ""))
                ]
                if trace_scope == "shard-owned-state-upgradeinfolist-population":
                    semantic_keys.append(("semantic_scope_fragment", "shard-owned-state:upgradeinfolist-population"))
                if trace_scope == "token-shop-atu4-mod":
                    semantic_keys.append(("semantic_scope_fragment", "token-shop-updater-display:ATU4"))
                if str((payload.get("target") or {}).get("familyId") or "") == "token-shop":
                    semantic_keys.append(("token_shop_reconstruction_fragment", f"token-shop-reconstruction:{trace_scope}"))
                    semantic_keys.append(("execution_plan_fragment", f"target-execution-plan:{trace_scope}"))
                    semantic_keys.append(("surface_plan_fragment", f"target-surface-plan:{trace_scope}"))
                    semantic_keys.append(("graph_plan_fragment", f"target-graph-plan:{trace_scope}"))
                    semantic_keys.append(("bridge_policy_fragment", f"target-bridge-policy:{trace_scope}"))
                family_id = str((payload.get("target") or {}).get("familyId") or "")
                if family_id:
                    semantic_keys.append(("family_graph_fragment", f"family-graph:{family_id}"))
                semantic_keys.append(("execution_context_fragment", f"target-execution-context:{trace_scope}"))
                semantic_keys.append(("assessment_fragment", f"target-assessment:{trace_scope}"))
                semantic_keys.append(("target_narrative_fragment", f"target-narrative:{trace_scope}"))
                if trace_scope in {
                    "shard-owned-state-upgradeinfolist-population",
                    "multiverse-market-save-owner-boundary",
                }:
                    semantic_keys.append(("bridge_comparison_fragment", f"target-bridge-comparison:{trace_scope}"))
                semantic_views = {}
                semantic_alternates = {}
                semantic_provenance = {}
                for kind, fragment_key in semantic_keys:
                    semantic_entry = canonical_semantic_lookup.get((project_name, project_file, kind, fragment_key))
                    if not semantic_entry:
                        continue
                    bucket = semantic_views.setdefault(kind, {})
                    bucket[fragment_key] = semantic_entry["payload"]
                    semantic_alternates.setdefault(kind, {})[fragment_key] = semantic_entry["alternates"]
                    semantic_provenance.setdefault(kind, {})[fragment_key] = semantic_entry["provenance"]
                semantic_coverage = _build_semantic_coverage_summary(
                    [
                        entry
                        for entry in canonical_semantic_entries
                        if entry["project_name"] == project_name and entry["project_file"] == project_file
                    ],
                    trace_scope=trace_scope,
                )
                target_bundle_payload = _build_target_bundle_projection(
                    payload,
                    system_payload,
                    semantic_views,
                    semantic_coverage,
                    trace_scope,
                    request_signature,
                )
                target_bundle_provenance = {
                    "trace": value["provenance"],
                    "system": system_provenance,
                    "semantic": semantic_provenance,
                    "semanticAlternates": semantic_alternates,
                    "semanticCoverage": {"traceScope": trace_scope, "source": "canonical_semantic_fragments"},
                    "payloadSignals": _collect_payload_provenance_signals(target_bundle_payload),
                }
                conn.execute(
                    """
                    INSERT INTO materialized_target_bundle_views(
                        project_name, project_file, trace_scope, request_signature, payload_json, provenance_json, reducer_version, built_at
                    ) VALUES(?,?,?,?,?,?,?,?)
                    """,
                    (
                        project_name,
                        project_file,
                        trace_scope,
                        request_signature,
                        _json_dumps(target_bundle_payload),
                        _json_dumps(target_bundle_provenance),
                        "target-bundle-v1",
                        datetime.now().isoformat(),
                    ),
                )

    def find_materialized_trace_view(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        request_signature: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_trace_views
                WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                """,
                (project_name, project_file, trace_scope, request_signature),
            ).fetchone()
        if row is None:
            return None
        return {
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
        }

    def find_canonical_system_trace_view(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        request_signature: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM canonical_system_trace_views
                WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                """,
                (project_name, project_file, trace_scope, request_signature),
            ).fetchone()
        if row is None:
            return None
        return {
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
        }

    def find_materialized_target_bundle_view(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        request_signature: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_target_bundle_views
                WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                """,
                (project_name, project_file, trace_scope, request_signature),
            ).fetchone()
        if row is None:
            return None
        return {
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
        }

    def find_latest_materialized_target_bundle_view(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_target_bundle_views
                WHERE project_name = ? AND project_file = ? AND trace_scope = ?
                ORDER BY built_at DESC, request_signature DESC
                LIMIT 1
                """,
                (project_name, project_file, trace_scope),
            ).fetchone()
        if row is None:
            return None
        return {
            "traceScope": str(row["trace_scope"]),
            "requestSignature": str(row["request_signature"]),
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
        }

    def find_canonical_semantic_fragment(
        self,
        project_name: str,
        project_file: str,
        fragment_kind: str,
        fragment_key: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM canonical_semantic_fragments
                WHERE project_name = ? AND project_file = ? AND fragment_kind = ? AND fragment_key = ?
                """,
                (project_name, project_file, fragment_kind, fragment_key),
            ).fetchone()
        if row is None:
            return None
        return {
            "payload": _json_loads(row["canonical_payload_json"], {}),
            "alternates": _json_loads(row["alternate_payloads_json"], []),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
        }

    def find_or_synthesize_execution_context(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        *,
        subject_kind: str = "",
        subject_key: str = "",
        family_id: str = "",
        compatibility_target_id: str = "",
    ) -> dict[str, Any]:
        canonical = self.find_canonical_semantic_fragment(
            project_name,
            project_file,
            "execution_context_fragment",
            f"target-execution-context:{trace_scope}",
        )
        if canonical:
            return dict(canonical.get("payload") or {})

        execution_plan = self.find_canonical_semantic_fragment(
            project_name,
            project_file,
            "execution_plan_fragment",
            f"target-execution-plan:{trace_scope}",
        )
        plan_payload = dict((execution_plan or {}).get("payload") or {})

        subject_kind = str(subject_kind or "").strip()
        subject_key = str(subject_key or "").strip()
        family_id = str(family_id or "").strip()
        compatibility_target_id = str(compatibility_target_id or trace_scope or "").strip()
        label = compatibility_target_id or trace_scope

        if subject_kind == "family-graph" and subject_key:
            family_graph = self.find_canonical_semantic_fragment(
                project_name,
                project_file,
                "family_graph_fragment",
                subject_key,
            )
            family_graph_payload = dict((family_graph or {}).get("payload") or {})
            family_id = family_id or str(family_graph_payload.get("familyId") or "").strip()
            label = str(family_graph_payload.get("familyLabel") or label)
        elif subject_kind == "semantic-scope" and subject_key:
            scope = self.find_canonical_semantic_fragment(
                project_name,
                project_file,
                "semantic_scope_fragment",
                subject_key,
            )
            scope_payload = dict((scope or {}).get("payload") or {})
            family_id = family_id or str(scope_payload.get("familyId") or "").strip()
            row_shell = dict(scope_payload.get("rowShell") or {})
            label = str(row_shell.get("field") or scope_payload.get("scopeId") or label)

        if not family_id and compatibility_target_id:
            if compatibility_target_id.startswith("token-shop"):
                family_id = "token-shop"
            elif compatibility_target_id.startswith("shard-cost"):
                family_id = "shard-cost"
            elif compatibility_target_id.startswith("shard-owned-state"):
                family_id = "shard-owned-state"
            elif compatibility_target_id.startswith("multiverse-market"):
                family_id = "multiverse-market-save-owner"

        join_goal = str(plan_payload.get("joinGoal") or "").strip()
        if not join_goal:
            if subject_kind == "family-graph":
                join_goal = f"Reconstruct the {label} subject from current canonical fragments and close directly adjacent gaps only."
            elif subject_kind == "semantic-scope":
                join_goal = f"Reconstruct the {label} subject from current canonical fragments and close directly adjacent gaps only."
            else:
                join_goal = f"Reconstruct the {compatibility_target_id or trace_scope} subject from current canonical fragments and close directly adjacent gaps only."

        return {
            "semanticKey": f"target-execution-context:{trace_scope}",
            "scopeType": "target-execution-context",
            "traceScope": trace_scope,
            "targetId": compatibility_target_id or trace_scope,
            "executionTargetId": compatibility_target_id or trace_scope,
            "executionTraceScope": trace_scope,
            "familyId": family_id or None,
            "label": label,
            "joinGoal": join_goal,
            "outputSummaryRules": BOOTSTRAP_OUTPUT_SUMMARY_RULES.get(trace_scope),
            "selectedSubjectKind": subject_kind or None,
            "selectedSubjectKey": subject_key or None,
            "synthesized": True,
        }

    def find_or_synthesize_surface_plan(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        *,
        family_id: str = "",
        compatibility_target_id: str = "",
    ) -> dict[str, Any]:
        canonical = self.find_canonical_semantic_fragment(
            project_name,
            project_file,
            "surface_plan_fragment",
            f"target-surface-plan:{trace_scope}",
        )
        if canonical:
            return dict(canonical.get("payload") or {})
        return _synthesize_surface_plan_from_registry(
            str(trace_scope or "").strip(),
            str(compatibility_target_id or trace_scope or "").strip(),
            str(family_id or "").strip(),
        )

    def find_or_synthesize_support_context(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        *,
        family_id: str = "",
        compatibility_target_id: str = "",
    ) -> dict[str, Any]:
        target_id = compatibility_target_id or trace_scope
        strategy_config = dict(BOOTSTRAP_SUPPORT_CONTEXTS.get(target_id) or {})
        if not strategy_config:
            return {}
        return {
            "semanticKey": f"target-support-context:{trace_scope}",
            "traceScope": trace_scope,
            "targetId": target_id,
            "familyId": family_id or None,
            "supportContext": strategy_config,
            "synthesized": True,
        }

    def find_or_synthesize_target_narrative(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        *,
        subject_kind: str = "",
        subject_key: str = "",
        family_id: str = "",
        compatibility_target_id: str = "",
    ) -> dict[str, Any]:
        canonical = self.find_canonical_semantic_fragment(
            project_name,
            project_file,
            "target_narrative_fragment",
            f"target-narrative:{trace_scope}",
        )
        canonical_payload = dict((canonical or {}).get("payload") or {})
        if canonical_payload:
            return canonical_payload

        execution_context = self.find_or_synthesize_execution_context(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=family_id,
            compatibility_target_id=compatibility_target_id,
        )
        with self.connect() as conn:
            assessment = _load_canonical_semantic_fragment_payload(
                conn,
                "assessment_fragment",
                f"target-assessment:{trace_scope}",
            )
            execution_plan = _load_canonical_semantic_fragment_payload(
                conn,
                "execution_plan_fragment",
                f"target-execution-plan:{trace_scope}",
            )
            scope_payload = (
                _load_canonical_semantic_fragment_payload(conn, "semantic_scope_fragment", subject_key)
                if subject_kind == "semantic-scope" and subject_key
                else {}
            )

        family_id = (
            str(execution_context.get("familyId") or "").strip()
            or str(scope_payload.get("familyId") or "").strip()
            or str(family_id or "").strip()
        )
        target_id = (
            str(execution_context.get("targetId") or "").strip()
            or str(scope_payload.get("targetId") or "").strip()
            or str(compatibility_target_id or "").strip()
            or trace_scope
        )
        label = (
            str(execution_context.get("label") or "").strip()
            or str((scope_payload.get("rowShell") or {}).get("field") or "").strip()
            or trace_scope
        )
        decision_summary = dict(assessment.get("decisionSummary") or {})
        blocked_edges = [
            str(edge).strip()
            for edge in (decision_summary.get("blockedEdgeTypes") or [])
            if str(edge).strip()
        ]
        claim_stages = [
            str(stage).strip()
            for stage in (execution_plan.get("claimStages") or [])
            if str(stage).strip()
        ]
        join_goal = str(execution_context.get("joinGoal") or execution_plan.get("joinGoal") or "").strip()
        grounded_conclusion = str(decision_summary.get("summary") or "").strip()
        if not grounded_conclusion:
            if join_goal:
                grounded_conclusion = (
                    f"Canonical target narrative is not materialized yet. Current DB-owned execution goal for {label} is: "
                    f"{join_goal}"
                )
            else:
                grounded_conclusion = (
                    f"Canonical target narrative is not materialized yet. Current DB-owned subject context for {label} "
                    "remains bounded to directly adjacent gaps only."
                )
        current_boundary = [
            "This narrative is synthesized from DB execution context and assessment state until a canonical target-narrative fragment is rebuilt."
        ]
        if claim_stages:
            current_boundary.append(
                "Current claim stages: " + ", ".join(claim_stages) + "."
            )
        if blocked_edges:
            current_boundary.append(
                "Current blocked edges: " + ", ".join(blocked_edges) + "."
            )
        elif join_goal:
            current_boundary.append(join_goal)

        return {
            "semanticKey": f"target-narrative:{trace_scope}",
            "scopeType": "target-narrative",
            "traceScope": trace_scope,
            "targetId": target_id,
            "familyId": family_id or None,
            "groundedConclusion": grounded_conclusion,
            "currentBoundary": current_boundary,
            "synthesized": True,
        }

    def find_canonical_resolution_subject_candidates(
        self,
        project_name: str,
        project_file: str,
        include_legacy_targets: bool = False,
    ) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT fragment_kind, fragment_key, canonical_payload_json, built_at
                FROM canonical_semantic_fragments
                WHERE project_name = ? AND project_file = ?
                  AND fragment_kind IN (
                    'assessment_fragment',
                    'target_narrative_fragment',
                    'family_graph_fragment',
                    'bridge_comparison_fragment',
                    'token_shop_reconstruction_fragment',
                    'semantic_scope_fragment',
                    'runtime_table_fragment',
                    'formula_fragment',
                    'threshold_fragment'
                  )
                ORDER BY built_at DESC, fragment_kind ASC, fragment_key ASC
                """,
                (project_name, project_file),
            ).fetchall()
        candidates: dict[tuple[str, str], dict[str, Any]] = {}
        for row in rows:
            fragment_kind = str(row["fragment_kind"] or "")
            payload = _json_loads(row["canonical_payload_json"], {})
            trace_scope = str(payload.get("traceScope") or "").strip()
            target_id = str(payload.get("targetId") or "").strip()
            if fragment_kind == "semantic_scope_fragment" and not trace_scope:
                trace_scope = target_id
            if not trace_scope or not target_id:
                continue
            key = (trace_scope, target_id)
            candidate = candidates.setdefault(
                key,
                {
                    "traceScope": trace_scope,
                    "target": {
                        "id": target_id,
                        "traceScope": trace_scope,
                        "familyId": str(payload.get("familyId") or "").strip(),
                    },
                    "builtAt": str(row["built_at"] or ""),
                    "decisionSummary": {},
                    "nativeView": {},
                    "semanticScopePayloads": [],
                    "semanticScopeSubjects": [],
                    "familyGraphSubjects": [],
                    "reconstructionSubjects": [],
                    "label": "",
                },
            )
            if str(row["built_at"] or "") > str(candidate.get("builtAt") or ""):
                candidate["builtAt"] = str(row["built_at"] or "")
            if not candidate["target"].get("familyId") and payload.get("familyId"):
                candidate["target"]["familyId"] = str(payload.get("familyId") or "").strip()
            if fragment_kind == "assessment_fragment":
                candidate["decisionSummary"] = dict(payload.get("decisionSummary") or {})
            elif fragment_kind == "target_narrative_fragment":
                grounded_conclusion = str(payload.get("groundedConclusion") or "").strip()
                if grounded_conclusion and not candidate.get("label"):
                    candidate["label"] = grounded_conclusion[:120]
            elif fragment_kind == "semantic_scope_fragment":
                scope_payload = dict(payload)
                candidate["semanticScopePayloads"].append(scope_payload)
                candidate["semanticScopeSubjects"].append(
                    {
                        "scopeId": str(scope_payload.get("scopeId") or ""),
                        "scopeType": str(scope_payload.get("scopeType") or ""),
                        "traceScope": str(scope_payload.get("traceScope") or trace_scope),
                        "targetId": str(scope_payload.get("targetId") or target_id),
                        "label": str(((scope_payload.get("rowShell") or {}).get("field") or "") or scope_payload.get("scopeId") or ""),
                        "subjectTerms": _collect_semantic_scope_subject_terms(scope_payload),
                    }
                )
            elif fragment_kind == "runtime_table_fragment":
                candidate["nativeView"] = {
                    "summary": dict(payload.get("nativeReconstruction") or {}),
                    "searchTerms": list(payload.get("bridgedTerms") or []),
                }
            elif fragment_kind == "family_graph_fragment":
                family_graph_payload = dict(payload)
                candidate["familyGraphSubjects"].append(
                    {
                        "semanticKey": str(family_graph_payload.get("semanticKey") or row["fragment_key"] or ""),
                        "scopeType": str(family_graph_payload.get("scopeType") or ""),
                        "traceScope": str(family_graph_payload.get("traceScope") or trace_scope),
                        "targetId": str(family_graph_payload.get("targetId") or target_id),
                        "label": str(family_graph_payload.get("familyLabel") or candidate.get("label") or target_id),
                        "subjectTerms": _collect_family_graph_subject_terms(family_graph_payload),
                    }
                )
                candidate[fragment_kind] = family_graph_payload
            elif fragment_kind == "token_shop_reconstruction_fragment":
                reconstruction_payload = dict(payload)
                candidate["reconstructionSubjects"].append(
                    {
                        "semanticKey": str(reconstruction_payload.get("semanticKey") or row["fragment_key"] or ""),
                        "scopeType": str(reconstruction_payload.get("scopeType") or ""),
                        "traceScope": str(reconstruction_payload.get("traceScope") or trace_scope),
                        "targetId": str(reconstruction_payload.get("targetId") or target_id),
                        "label": str(((reconstruction_payload.get("rowShell") or {}).get("field") or "") or candidate.get("label") or target_id),
                        "subjectTerms": _collect_reconstruction_subject_terms(reconstruction_payload),
                    }
                )
                candidate[fragment_kind] = reconstruction_payload
            else:
                candidate[fragment_kind] = payload
        candidate_rows: list[dict[str, Any]] = []
        for candidate in candidates.values():
            candidate["resolutionTerms"] = _collect_resolution_terms_for_candidate(
                dict(candidate.get("target") or {}),
                list(candidate.get("semanticScopePayloads") or []),
                include_legacy_targets=include_legacy_targets,
            )
            candidate_rows.append(candidate)
        return candidate_rows

    def find_canonical_family_subject_candidate(
        self,
        project_name: str,
        project_file: str,
        family_id: str,
    ) -> dict[str, Any] | None:
        family_id = str(family_id or "").strip()
        if not family_id:
            return None
        candidates = self.find_canonical_resolution_subject_candidates(
            project_name,
            project_file,
            include_legacy_targets=False,
        )
        best: dict[str, Any] | None = None
        for candidate in candidates:
            target = dict(candidate.get("target") or {})
            if str(target.get("familyId") or "") != family_id:
                continue
            for subject in list(candidate.get("familyGraphSubjects") or []):
                if str(subject.get("scopeType") or "") != "family-graph":
                    continue
                best = {
                    "subjectKind": "family-graph",
                    "subjectKey": str(subject.get("semanticKey") or ""),
                    "subjectLabel": str(subject.get("label") or subject.get("semanticKey") or ""),
                    "targetId": str(subject.get("targetId") or target.get("id") or ""),
                    "traceScope": str(subject.get("traceScope") or candidate.get("traceScope") or ""),
                    "familyId": family_id,
                }
                break
            if best is not None:
                break
            for subject in list(candidate.get("reconstructionSubjects") or []):
                scope_type = str(subject.get("scopeType") or "")
                if "family-reconstruction" not in scope_type:
                    continue
                best = {
                    "subjectKind": "reconstruction-fragment",
                    "subjectKey": str(subject.get("semanticKey") or ""),
                    "subjectLabel": str(subject.get("label") or subject.get("semanticKey") or ""),
                    "targetId": str(subject.get("targetId") or target.get("id") or ""),
                    "traceScope": str(subject.get("traceScope") or candidate.get("traceScope") or ""),
                    "familyId": family_id,
                }
                break
            if best is not None:
                break
        return best

    def upsert_materialized_system_unit_view(
        self,
        system_id: str,
        version: str,
        payload: dict[str, Any],
        provenance: dict[str, Any] | None = None,
        reducer_version: str = "system-unit-v1",
        exported_path: str | None = None,
    ) -> None:
        built_at = datetime.now().isoformat()
        payload_signals = _collect_payload_provenance_signals(payload)
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO materialized_system_unit_views(
                    system_id, version, payload_json, provenance_json, reducer_version, built_at, exported_path
                ) VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(system_id, version) DO UPDATE SET
                    payload_json=excluded.payload_json,
                    provenance_json=excluded.provenance_json,
                    reducer_version=excluded.reducer_version,
                    built_at=excluded.built_at,
                    exported_path=excluded.exported_path
                """,
                (
                    system_id,
                    version,
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            **(provenance or {}),
                            "payloadSignals": payload_signals,
                        }
                    ),
                    reducer_version,
                    built_at,
                    exported_path,
                ),
            )

    def find_materialized_system_unit_view(
        self,
        system_id: str,
        version: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_system_unit_views
                WHERE system_id = ? AND version = ?
                """,
                (system_id, version),
            ).fetchone()
        if row is None:
            return None
        return {
            "systemId": str(row["system_id"]),
            "version": str(row["version"]),
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
            "exportedPath": str(row["exported_path"] or ""),
        }

    def upsert_semantic_scope_fragment(
        self,
        project_name: str,
        project_file: str,
        scope_id: str,
        scope_payload: dict[str, Any],
        producer_version: str = "",
        source_job_id: str = "",
        source_term: str = "",
        confidence: float = 1.0,
        reducer_priority: int = 100,
        script_name: str = "trace_extractors.py",
    ) -> None:
        now = datetime.now().isoformat()
        with self.connect() as conn:
            existing = conn.execute(
                """
                SELECT fragment_id FROM trace_fragments
                WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                  AND fragment_kind = ? AND fragment_key = ? AND source_job_id = ? AND source_term = ?
                """,
                (
                    project_name,
                    project_file,
                    scope_id,
                    scope_id,
                    "semantic_scope_fragment",
                    scope_id,
                    source_job_id,
                    source_term,
                ),
            ).fetchone()
            if existing is not None:
                conn.execute(
                    """
                    UPDATE trace_fragments
                    SET payload_json = ?, confidence = ?, reducer_priority = ?, schema_version = ?,
                        script_name = ?, producer_version = ?, start_time = ?, is_valid = 1,
                        invalidated_at = NULL, invalidation_reason = NULL, superseded_by = NULL,
                        updated_at = ?
                    WHERE fragment_id = ?
                    """,
                    (
                        _json_dumps(scope_payload),
                        float(confidence),
                        int(reducer_priority),
                        SCHEMA_VERSION_FLOOR,
                        script_name,
                        producer_version,
                        now,
                        now,
                        int(existing["fragment_id"]),
                    ),
                )
            else:
                conn.execute(
                """
                INSERT INTO trace_fragments(
                    project_name, project_file, trace_scope, request_signature,
                    fragment_kind, fragment_key, payload_json, source_job_id, source_term,
                    confidence, reducer_priority, schema_version, script_name, producer_version,
                    start_time, is_valid, invalidated_at, invalidation_reason, superseded_by,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, NULL, NULL, ?, ?)
                """,
                (
                    project_name,
                    project_file,
                    scope_id,
                    scope_id,
                    "semantic_scope_fragment",
                    scope_id,
                    _json_dumps(scope_payload),
                    source_job_id,
                    source_term,
                    float(confidence),
                    int(reducer_priority),
                    SCHEMA_VERSION_FLOOR,
                    script_name,
                    producer_version,
                    now,
                    now,
                    now,
                ),
            )
        self.rebuild_trace_views()

    def get_semantic_coverage_summary(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str | None = None,
    ) -> dict[str, Any]:
        with self.connect() as conn:
            canonical_rows = conn.execute(
                """
                SELECT fragment_kind, fragment_key, provenance_json, canonical_payload_json
                FROM canonical_semantic_fragments
                WHERE project_name = ? AND project_file = ?
                ORDER BY fragment_kind, fragment_key
                """,
                (project_name, project_file),
            ).fetchall()
        return _build_semantic_coverage_summary(
            [
                {
                    "fragment_kind": str(row["fragment_kind"]),
                    "fragment_key": str(row["fragment_key"]),
                    "payload": _json_loads(row["canonical_payload_json"], {}),
                    "provenance": _json_loads(row["provenance_json"], {}),
                }
                for row in canonical_rows
            ],
            trace_scope=trace_scope,
        )

    def invalidate_trace_fragments(
        self,
        trace_scope: str | None = None,
        request_signature: str | None = None,
        fragment_kind: str | None = None,
        fragment_key: str | None = None,
        source_job_id: str | None = None,
        script_name: str | None = None,
        reason: str = "manual-trace-invalidate",
    ) -> list[int]:
        clauses = ["1=1"]
        params: list[Any] = []
        if trace_scope:
            clauses.append("trace_scope = ?")
            params.append(trace_scope)
        if request_signature:
            clauses.append("request_signature = ?")
            params.append(request_signature)
        if fragment_kind:
            clauses.append("fragment_kind = ?")
            params.append(fragment_kind)
        if fragment_key:
            clauses.append("fragment_key = ?")
            params.append(fragment_key)
        if source_job_id:
            clauses.append("source_job_id = ?")
            params.append(source_job_id)
        if script_name:
            clauses.append("script_name = ?")
            params.append(script_name)
        invalidated: list[int] = []
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT fragment_id FROM trace_fragments WHERE {} AND is_valid = 1 AND invalidated_at IS NULL".format(" AND ".join(clauses)),
                tuple(params),
            ).fetchall()
            timestamp = datetime.now().isoformat()
            for row in rows:
                fragment_id = int(row["fragment_id"])
                invalidated.append(fragment_id)
                conn.execute(
                    """
                    UPDATE trace_fragments
                    SET is_valid = 0, invalidated_at = ?, invalidation_reason = ?, updated_at = ?
                    WHERE fragment_id = ?
                    """,
                    (timestamp, reason, timestamp, fragment_id),
                )
        if invalidated:
            self.rebuild_trace_views()
        return invalidated

    def get_stats(self) -> dict[str, int]:
        with self.connect() as conn:
            evidence_rows = int(conn.execute("SELECT COUNT(*) FROM evidence").fetchone()[0])
            valid_evidence_rows = int(conn.execute("SELECT COUNT(*) FROM evidence WHERE is_valid = 1 AND invalidated_at IS NULL").fetchone()[0])
            canonical_term_aspects = int(conn.execute("SELECT COUNT(*) FROM canonical_term_aspects").fetchone()[0])
            materialized_terms = int(conn.execute("SELECT COUNT(*) FROM materialized_term_views").fetchone()[0])
            materialized_jobs = int(conn.execute("SELECT COUNT(*) FROM materialized_job_views").fetchone()[0])
            trace_fragments = int(conn.execute("SELECT COUNT(*) FROM trace_fragments").fetchone()[0])
            valid_trace_fragments = int(conn.execute("SELECT COUNT(*) FROM trace_fragments WHERE is_valid = 1 AND invalidated_at IS NULL").fetchone()[0])
            canonical_trace_fragments = int(conn.execute("SELECT COUNT(*) FROM canonical_trace_fragments").fetchone()[0])
            materialized_trace_views = int(conn.execute("SELECT COUNT(*) FROM materialized_trace_views").fetchone()[0])
            materialized_native_trace_views = int(conn.execute("SELECT COUNT(*) FROM materialized_native_trace_views").fetchone()[0])
            canonical_system_trace_views = int(conn.execute("SELECT COUNT(*) FROM canonical_system_trace_views").fetchone()[0])
            materialized_target_bundle_views = int(conn.execute("SELECT COUNT(*) FROM materialized_target_bundle_views").fetchone()[0])
            canonical_semantic_fragments = int(conn.execute("SELECT COUNT(*) FROM canonical_semantic_fragments").fetchone()[0])
            materialized_system_unit_views = int(conn.execute("SELECT COUNT(*) FROM materialized_system_unit_views").fetchone()[0])
        return {
            "evidenceRows": evidence_rows,
            "validEvidenceRows": valid_evidence_rows,
            "canonicalTermAspects": canonical_term_aspects,
            "materializedTerms": materialized_terms,
            "materializedJobs": materialized_jobs,
            "traceFragments": trace_fragments,
            "validTraceFragments": valid_trace_fragments,
            "canonicalTraceFragments": canonical_trace_fragments,
            "materializedTraceViews": materialized_trace_views,
            "materializedNativeTraceViews": materialized_native_trace_views,
            "canonicalSystemTraceViews": canonical_system_trace_views,
            "materializedTargetBundleViews": materialized_target_bundle_views,
            "canonicalSemanticFragments": canonical_semantic_fragments,
            "materializedSystemUnitViews": materialized_system_unit_views,
        }

    def get_lifecycle_audit(self) -> dict[str, Any]:
        with self.connect() as conn:
            invalidated_evidence_rows = int(
                conn.execute("SELECT COUNT(*) FROM evidence WHERE is_valid = 0 OR invalidated_at IS NOT NULL").fetchone()[0]
            )
            invalidated_trace_rows = int(
                conn.execute("SELECT COUNT(*) FROM trace_fragments WHERE is_valid = 0 OR invalidated_at IS NOT NULL").fetchone()[0]
            )
            invalidated_jobs = int(
                conn.execute("SELECT COUNT(*) FROM jobs WHERE invalidated_at IS NOT NULL").fetchone()[0]
            )
            singleton_duplicate_groups = int(
                conn.execute(
                    """
                    SELECT COUNT(*) FROM (
                      SELECT normalized_term, aspect_kind, aspect_key,
                             SUM(CASE WHEN is_valid = 1 AND invalidated_at IS NULL THEN 1 ELSE 0 END) AS live
                      FROM evidence
                      WHERE aspect_kind NOT IN ({})
                      GROUP BY normalized_term, aspect_kind, aspect_key
                      HAVING live > 1
                    )
                    """.format(",".join("?" for _ in SINGLETON_ASPECTS.union(UNION_ASPECTS))),
                    tuple(SINGLETON_ASPECTS.union(UNION_ASPECTS)),
                ).fetchone()[0]
            )
            union_exact_duplicate_groups = int(
                conn.execute(
                    """
                    SELECT COUNT(*) FROM (
                      SELECT project_name, project_file, normalized_term, aspect_kind, aspect_key, payload_json,
                             SUM(CASE WHEN is_valid = 1 AND invalidated_at IS NULL THEN 1 ELSE 0 END) AS live
                      FROM evidence
                      WHERE aspect_kind IN ({})
                      GROUP BY project_name, project_file, normalized_term, aspect_kind, aspect_key, payload_json
                      HAVING live > 1
                    )
                    """.format(",".join("?" for _ in UNION_ASPECTS)),
                    tuple(UNION_ASPECTS),
                ).fetchone()[0]
            )
            trace_duplicate_groups = int(
                conn.execute(
                    """
                    SELECT COUNT(*) FROM (
                      SELECT trace_scope, fragment_kind, fragment_key,
                             SUM(CASE WHEN is_valid = 1 AND invalidated_at IS NULL THEN 1 ELSE 0 END) AS live
                      FROM trace_fragments
                      GROUP BY trace_scope, fragment_kind, fragment_key
                      HAVING live > 1
                    )
                    """
                ).fetchone()[0]
            )
        stats = self.get_stats()
        return {
            **stats,
            "invalidatedEvidenceRows": invalidated_evidence_rows,
            "invalidatedTraceFragments": invalidated_trace_rows,
            "invalidatedJobs": invalidated_jobs,
            "singletonLiveDuplicateEvidenceGroups": singleton_duplicate_groups,
            "unionExactPayloadDuplicateEvidenceGroups": union_exact_duplicate_groups,
            "liveDuplicateTraceFragmentGroups": trace_duplicate_groups,
        }

    def purge_invalidated_rows(
        self,
        older_than_days: int = 30,
        purge_jobs: bool = False,
    ) -> dict[str, int]:
        cutoff = (datetime.now() - timedelta(days=max(0, int(older_than_days)))).isoformat()
        with self.connect() as conn:
            evidence_rows = conn.execute(
                """
                SELECT COUNT(*) FROM evidence
                WHERE (is_valid = 0 OR invalidated_at IS NOT NULL)
                  AND COALESCE(invalidated_at, updated_at, created_at) < ?
                """,
                (cutoff,),
            ).fetchone()[0]
            conn.execute(
                """
                DELETE FROM evidence
                WHERE (is_valid = 0 OR invalidated_at IS NOT NULL)
                  AND COALESCE(invalidated_at, updated_at, created_at) < ?
                """,
                (cutoff,),
            )
            trace_rows = conn.execute(
                """
                SELECT COUNT(*) FROM trace_fragments
                WHERE (is_valid = 0 OR invalidated_at IS NOT NULL)
                  AND COALESCE(invalidated_at, updated_at, created_at) < ?
                """,
                (cutoff,),
            ).fetchone()[0]
            conn.execute(
                """
                DELETE FROM trace_fragments
                WHERE (is_valid = 0 OR invalidated_at IS NOT NULL)
                  AND COALESCE(invalidated_at, updated_at, created_at) < ?
                """,
                (cutoff,),
            )
            job_rows = 0
            if purge_jobs:
                job_rows = conn.execute(
                    """
                    SELECT COUNT(*) FROM jobs
                    WHERE invalidated_at IS NOT NULL
                      AND COALESCE(invalidated_at, updated_at, created_at) < ?
                    """,
                    (cutoff,),
                ).fetchone()[0]
                conn.execute(
                    """
                    DELETE FROM jobs
                    WHERE invalidated_at IS NOT NULL
                      AND COALESCE(invalidated_at, updated_at, created_at) < ?
                    """,
                    (cutoff,),
                )
        self._rebuild_canonical_and_materialized()
        self.rebuild_trace_views()
        return {
            "purgedEvidenceRows": int(evidence_rows),
            "purgedTraceFragments": int(trace_rows),
            "purgedJobs": int(job_rows),
            "olderThanDays": int(older_than_days),
        }
