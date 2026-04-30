#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from contextlib import contextmanager, nullcontext
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[2]


DB_SCHEMA_VERSION = 7
SCHEMA_VERSION_FLOOR = 7
SQLITE_CACHE_SIZE_KIB = 262144
SQLITE_MMAP_SIZE_BYTES = 268435456
SQLITE_WAL_AUTOCHECKPOINT_PAGES = 20000
TRACE_SUPERSEDED_HISTORY_LIMIT = 32
TRACE_CANONICAL_CACHE_HISTORY_LIMIT = 8
TRACE_MATERIALIZED_SCOPE_HISTORY_LIMIT = 8
EVIDENCE_SUPERSEDED_HISTORY_LIMIT = 32
ACQUISITION_DIAGNOSTIC_STALE_MINUTES = 10
CONTRACT_LITERAL_EXCLUDED_TRACE_FRAGMENT_KINDS = (
    "plannerResolution",
    "executionAnchors",
)

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


def _subject_state_quality_tuple(payload: dict[str, Any], built_at: str = "") -> tuple[Any, ...]:
    payload = dict(payload or {})
    next_seam = dict(payload.get("nextSeam") or {})
    decision_summary = dict(payload.get("decisionSummary") or {})
    blocked_edges = _unique_strings([str(value) for value in (payload.get("blockedEdges") or []) if str(value).strip()])
    missing_edges = _unique_strings([str(value) for value in (payload.get("missingEdges") or []) if str(value).strip()])
    known_edges = _unique_strings([str(value) for value in (payload.get("knownEdges") or []) if str(value).strip()])
    nonblocking_edges = _unique_strings([str(value) for value in (payload.get("nonblockingEdges") or []) if str(value).strip()])
    next_status = str(next_seam.get("status") or "").strip()
    verdict = str(decision_summary.get("verdict") or "").strip().lower()
    verdict_rank = {
        "wire": 4,
        "quarantine": 3,
        "keep researching": 2,
        "keep-researching": 2,
        "open": 1,
    }.get(verdict, 0)
    identity_owner = str(payload.get("identityOwner") or "").strip()
    identity_rank = 1 if identity_owner.startswith("db-") else 0
    return (
        1 if next_status == "clear" else 0,
        verdict_rank,
        -len(blocked_edges),
        -len(missing_edges),
        len(known_edges),
        len(nonblocking_edges),
        identity_rank,
        str(built_at or ""),
    )


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


def _collect_payload_strings(value: Any, *, limit: int = 200) -> list[str]:
    collected: list[str] = []

    def visit(node: Any) -> None:
        if len(collected) >= limit:
            return
        if isinstance(node, str):
            normalized = str(node).strip()
            if normalized:
                collected.append(normalized)
            return
        if isinstance(node, dict):
            for child in node.values():
                visit(child)
                if len(collected) >= limit:
                    return
            return
        if isinstance(node, list):
            for child in node:
                visit(child)
                if len(collected) >= limit:
                    return

    visit(value)
    return _unique_strings(collected)


def _normalize_resolution_term(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def _split_resolution_tokens(value: str) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    expanded = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)
    return [token for token in re.split(r"[^a-z0-9]+", expanded.lower()) if token]


GENERIC_RESOLUTION_TOKENS = {
    "token",
    "shop",
    "family",
    "trace",
    "target",
    "row",
    "runtime",
    "display",
    "title",
    "seam",
    "question",
    "domain",
}


def _is_concise_resolution_label(value: str) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    tokens = _split_resolution_tokens(text)
    if len(text) > 80:
        return False
    if len(tokens) > 8:
        return False
    return True


def _infer_family_id_from_target_id(target_id: str) -> str:
    normalized = str(target_id or "").strip()
    if normalized.startswith("token-shop"):
        return "token-shop"
    if normalized.startswith("shard-cost"):
        return "shard-cost"
    if normalized.startswith("shard-owned-state"):
        return "shard-owned-state"
    if normalized.startswith("multiverse-market"):
        return "multiverse-market-save-owner"
    return ""


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


def _normalize_dependency_edge(edge: Any) -> dict[str, Any] | None:
    if not isinstance(edge, dict):
        return None
    normalized_proved_by = []
    for item in (edge.get("provedBy") or []):
        if not isinstance(item, dict):
            continue
        normalized_item = {
            "sourceId": str(item.get("sourceId") or "").strip() or None,
            "term": str(item.get("term") or "").strip() or None,
            "locator": str(item.get("locator") or "").strip() or None,
            "sourcePath": str(item.get("sourcePath") or "").strip() or None,
        }
        normalized_item = {
            key: value
            for key, value in normalized_item.items()
            if value is not None
        }
        if normalized_item:
            normalized_proved_by.append(normalized_item)
    normalized_proved_by.sort(
        key=lambda item: (
            str(item.get("sourceId") or ""),
            str(item.get("term") or ""),
            str(item.get("locator") or ""),
            str(item.get("sourcePath") or ""),
        )
    )
    normalized_edge = {
        "id": str(edge.get("id") or "").strip() or None,
        "type": str(edge.get("type") or "").strip() or None,
        "status": str(edge.get("status") or "").strip() or None,
        "from": str(edge.get("from") or "").strip() or None,
        "to": str(edge.get("to") or "").strip() or None,
        "provenanceStrength": str(edge.get("provenanceStrength") or "").strip() or None,
        "statement": str(edge.get("statement") or "").strip() or None,
        "provedBy": normalized_proved_by,
    }
    return {
        key: value
        for key, value in normalized_edge.items()
        if value not in (None, [], "")
    }


def _reduce_dependency_fragment(rows: list[sqlite3.Row]) -> tuple[dict[str, Any], list[dict[str, Any]], dict[str, Any], str]:
    ordered = sorted(rows, key=_rank_row, reverse=True)
    payloads = [_json_loads(row["payload_json"], {}) for row in ordered]
    edge = _normalize_dependency_edge(payloads[0].get("edge"))
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


def _synthesize_surface_plan_from_db_state(
    trace_scope: str,
    compatibility_target_id: str,
    family_id: str,
    resolver_target_payload: dict[str, Any],
    latest_bundle_payload: dict[str, Any],
) -> dict[str, Any]:
    resolver_payload = dict(resolver_target_payload or {})
    support_surfaces = [surface for surface in (resolver_payload.get("supportSurfaces") or []) if isinstance(surface, dict)]
    if not support_surfaces:
        return {}
    support_rows = [row for row in (resolver_payload.get("supportRows") or []) if isinstance(row, dict)]
    shell_window = dict(resolver_payload.get("shellWindow") or {})
    if not shell_window and support_rows:
        first_row = dict(support_rows[0])
        last_row = dict(support_rows[-1])
        shell_field = str(first_row.get("shellField") or first_row.get("field") or "").strip()
        if len(support_rows) > 1:
            last_field = str(last_row.get("shellField") or last_row.get("field") or "").strip()
            if shell_field and last_field and last_field != shell_field:
                shell_field = f"{shell_field} through {last_field}"
        shell_window = {
            "shellField": shell_field,
            "shellPathId": str(first_row.get("shellPathId") or "").strip() or None,
            "shellWindowSource": "materializedResolverTargetView",
        }
    if not shell_window:
        target_payload = dict(latest_bundle_payload.get("target") or {})
        shell_window = {
            key: target_payload.get(key)
            for key in ("shellField", "shellPathId", "shellWindowSource", "shellWindowRadius")
            if target_payload.get(key) is not None
        }
    if not shell_window:
        return {}
    return {
        "semanticKey": f"target-surface-plan:{trace_scope}",
        "traceScope": trace_scope,
        "targetId": compatibility_target_id or trace_scope,
        "familyId": family_id or resolver_payload.get("familyId") or None,
        "shellWindow": shell_window,
        "surfacePlans": [
            {
                "id": str(surface.get("id") or ""),
                "label": str(surface.get("label") or ""),
                "terms": _unique_strings([str(value) for value in (surface.get("terms") or []) if str(value).strip()]),
                "sourceIds": _unique_strings([str(value) for value in (surface.get("sourceIds") or []) if str(value).strip()]),
            }
            for surface in support_surfaces
        ],
        "synthesized": True,
        "synthesizedFrom": "resolver-target-view",
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


def _derive_token_shop_non_blocking_action_hook(
    row_local_graph: dict[str, Any],
    row_recovery: dict[str, Any],
) -> dict[str, Any] | None:
    shell_field = str(((row_local_graph.get("rowShell") or {}).get("field")) or row_recovery.get("shellField") or "").strip()
    prefab_candidates = [str(item).strip() for item in (row_local_graph.get("prefabCandidates") or []) if str(item).strip()]
    update_hooks = [str(item).strip() for item in (row_local_graph.get("updateHooks") or []) if str(item).strip()]
    if (
        shell_field == "ATU14Button"
        and not list(row_local_graph.get("actionMethods") or [])
        and bool(row_local_graph.get("literalTitleRecovered"))
        and "SetCostRelatedAttributes" in update_hooks
        and any("DailyTokens" in candidate for candidate in prefab_candidates)
    ):
        return {
            "id": "exact-shell-to-action-hook",
            "status": "bounded-negative",
            "reason": "The Daily Tokenium row-local verdict is already grounded through shell, prefab, title, and display on committed sources, while the action lane remains noisy across singular versus plural Daily Tokenium buy names and is not required for this row-local endpoint.",
        }
    return None


def _derive_token_shop_non_blocking_runtime_model_gap(
    row_local_graph: dict[str, Any],
    row_recovery: dict[str, Any],
) -> dict[str, Any] | None:
    shell_field = str(((row_local_graph.get("rowShell") or {}).get("field")) or row_recovery.get("shellField") or "").strip()
    prefab_candidates = [str(item).strip() for item in (row_local_graph.get("prefabCandidates") or []) if str(item).strip()]
    update_hooks = [str(item).strip() for item in (row_local_graph.get("updateHooks") or []) if str(item).strip()]
    formula_reconstruction = dict(row_recovery.get("formulaReconstruction") or {})
    runtime_cost_model = dict(formula_reconstruction.get("runtimeCostModel") or {})
    inferred_cost_model = dict(formula_reconstruction.get("inferredCostModel") or {})
    owner_blob_row = dict(formula_reconstruction.get("ownerBlobRow") or {})
    if (
        shell_field == "ATU14Button"
        and str(runtime_cost_model.get("status") or "") == "unresolved-runtime-modifiers"
        and str(inferred_cost_model.get("status") or "") == "extracted-controller-linear"
        and str(owner_blob_row.get("status") or "") == "owner-blob-row-recovered"
        and "SetCostRelatedAttributes" in update_hooks
        and any("DailyTokens" in candidate for candidate in prefab_candidates)
        and bool(row_local_graph.get("literalTitleRecovered"))
    ):
        return {
            "id": "runtime-model-gap",
            "status": "bounded-negative",
            "reason": "ATU14 already has a checked row-local endpoint through shell, prefab, title, display, and an extracted controller-linear base-cost lane from the owner blob. The remaining runtime-model uncertainty is limited to possible evaluator-side modifiers on top of that base lane and is not required for this descriptive Daily Tokenium target.",
        }
    return None


def _derive_token_shop_row_missing_seams(
    row_local_graph: dict[str, Any],
    row_recovery: dict[str, Any],
) -> list[dict[str, Any]]:
    seams: list[dict[str, Any]] = []
    non_blocking_action_hook = _derive_token_shop_non_blocking_action_hook(row_local_graph, row_recovery)
    non_blocking_runtime_model = _derive_token_shop_non_blocking_runtime_model_gap(row_local_graph, row_recovery)
    if not list(row_local_graph.get("actionMethods") or []) and non_blocking_action_hook is None:
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
    if unresolved_runtime_targets and non_blocking_runtime_model is None:
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
    non_blocking_seams = []
    non_blocking_action_hook = _derive_token_shop_non_blocking_action_hook(row_local_graph, row_recovery)
    if non_blocking_action_hook is not None:
        non_blocking_seams.append(non_blocking_action_hook)
    non_blocking_runtime_model = _derive_token_shop_non_blocking_runtime_model_gap(row_local_graph, row_recovery)
    if non_blocking_runtime_model is not None:
        non_blocking_seams.append(non_blocking_runtime_model)
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
    if non_blocking_seams:
        summary = "{} {}".format(
            summary,
            " ".join(str(item.get("reason") or "").strip() for item in non_blocking_seams if str(item.get("reason") or "").strip()),
        ).strip()
    return {
        "status": status,
        "semanticStatus": semantic_status,
        "literalStatus": literal_status,
        "runtimeStatus": runtime_status,
        "summary": summary,
        "missingSeamIds": missing_ids,
        "nonBlockingSeams": non_blocking_seams,
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
    non_blocking_seams = list(compatibility_status.get("nonBlockingSeams") or [])
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
        "boundedNegatives": non_blocking_seams,
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
            "nonBlockingSeams": non_blocking_seams,
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
    "token-shop-daily-tokenium-family": {
        "wire": {"minPresentEdges": 5, "maxNegativeEdges": 0},
        "quarantine": {
            "minPresentEdges": 4,
            "allowedNegativeEdgeTypes": [
                "exact-shell-to-action-hook",
                "exact-shell-to-title",
                "exact-display-update-path",
            ],
        },
        "messages": {
            "wire": "The Daily Tokenium-family trace found a fully localized shell-to-action, identity, and presentation chain, but this target should still remain descriptive only.",
            "quarantine": "The Daily Tokenium-family trace preserves DB-backed owner-order recovery and matching prefab-family candidates, but the direct purchase-hook or presentation seam still stays quarantined.",
            "research": "The Daily Tokenium-family trace is still too incomplete to summarize a stable row-family bridge.",
        },
    },
    "token-shop-t3-trio-family": {
        "wire": {"minPresentEdges": 6, "maxNegativeEdges": 0},
        "quarantine": {
            "minPresentEdges": 5,
            "allowedNegativeEdgeTypes": [
                "exact-shell-to-title",
                "exact-display-update-path",
            ],
        },
        "messages": {
            "wire": "The T3 trio-family trace found a fully localized shell, action, identity, and presentation chain, but this target should still remain descriptive only.",
            "quarantine": "The T3 trio-family trace preserves DB-backed owner-order recovery, trio buy-hook clues, and matching prefab-family candidates, while the title or presentation seam stays bounded.",
            "research": "The T3 trio-family trace is still too incomplete to summarize a stable row-family bridge.",
        },
    },
    "token-shop-late-atu-family": {
        "wire": {"minPresentEdges": 5, "maxNegativeEdges": 0},
        "quarantine": {
            "minPresentEdges": 4,
            "allowedNegativeEdgeTypes": [
                "exact-shell-to-title",
                "exact-shell-to-prefab",
                "exact-effect-to-shell-join",
            ],
        },
        "messages": {
            "wire": "The late ATU family would only wire if one exact shell-local identity bridge cleared, which this bounded target should still keep descriptive only.",
            "quarantine": "The late ATU family now preserves one coherent action-side shell boundary plus local title, prefab, and effect rosters, while exact shell-local identity joins stay bounded negative.",
            "research": "The late ATU family trace still lacks enough checked structure to preserve a bounded late-row verdict.",
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
        "traceRoutineHint": "token-shop-mod-trace",
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
        "traceRoutineHint": "token-shop-mk1-title-trace",
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
        "familyTraceProfile": "generic-structure",
        "traceRoutineHint": "token-shop-family-trace",
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
    "token-shop-daily-tokenium-family": {
        "shellField": "ATU14Button",
        "shellPathId": 15844,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 6,
        "familyTraceProfile": "daily-tokenium-family",
        "traceRoutineHint": "token-shop-family-trace",
        "disableNativeTrace": True,
        "defaultPresentationUpdateHook": "SetCostRelatedAttributes",
        "surfaces": [
            {"id": "family-shells", "label": "Daily Tokenium family shell range", "sourceIds": ["tokenShopExtract", "metadata"], "terms": ["ATU14Button", "ATU15Button", "ATU16Button", "ATU17Button", "ATU18Button", "ATU19Button", "TokenDailiesT2", "T2Duo1", "T2Duo5"]},
            {"id": "effect-lane", "label": "Daily Tokenium effect lane", "sourceIds": ["metadata", "level0"], "terms": ["ATU14TokenDailiesBonus", "ATU21TokenDailiesBonus", "FinalDailyTokenBonus", "CollectorDevice"]},
            {"id": "action-lane", "label": "Daily Tokenium action lane", "sourceIds": ["metadata", "level0"], "terms": ["BuyTokenDailyT2", "BuyTokenDailiesT2", "BuyDuo1Boost", "BuyDuo2Boost", "BuyDuo3Boost", "BuyDuo4Boost", "BuyDuo5Boost"]},
            {"id": "prefab-roster", "label": "Daily Tokenium prefab roster", "sourceIds": ["level0", "sharedassets0"], "terms": ["NewTokenUPGPrefab.T2.DailyTokens", "NewTokenUPGPrefab.T2.DuoBoosterOne", "NewTokenUPGPrefab.T2.DuoBoosterTwo", "NewTokenUPGPrefab.T2.DuoBoosterThree", "NewTokenUPGPrefab.T2.DuoBoosterFour", "NewTokenUPGPrefab.T2.DuoBoosterFive"]},
            {"id": "title-text-surfaces", "label": "Daily Tokenium title and text surfaces", "sourceIds": ["level0", "sharedassets0"], "terms": ["Daily Tokens T2", "Duo Booster One", "Duo Booster Two", "Duo Booster Three", "Duo Booster Four", "Duo Booster Five", "SetAllTokenShopTexts", "SetTokenTexts"]},
        ],
        "lostStructure": [
            "The Daily Tokenium-family shell order now survives directly in the DB-backed TokenShop owner extract, where ATU14Button through ATU19Button align to TokenDailiesT2 through T2Duo5.",
            "The matching DailyTokens and T2 duo prefab identities still survive in committed Unity object-name rosters, but the direct purchase-hook lane remains noisy and partially stale across singular versus plural DailyTokenium method names.",
            "The next honest target is one exact shell-local title or runtime display join for ATU14 through ATU19, not a broader cap-owner, planner, or canonical state promotion.",
        ],
    },
    "token-shop-t3-trio-family": {
        "shellField": "ATU21Button",
        "shellPathId": 15829,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 4,
        "familyTraceProfile": "t3-trio-family",
        "traceRoutineHint": "token-shop-family-trace",
        "nativeTraceTerms": [
            "ATU21Button",
            "ATU22Button",
            "ATU23Button",
            "BuyTrio1Boost",
            "BuyTrio2Boost",
            "ATU21TokenDailiesBonus",
        ],
        "surfaces": [
            {"id": "family-shells", "label": "T3 trio shell range", "sourceIds": ["tokenShopExtract", "metadata"], "terms": ["ATU21Button", "ATU22Button", "ATU23Button", "T3Trio1", "T3Trio2", "ATU24StartCost"]},
            {"id": "effect-lane", "label": "T3 trio effect lane", "sourceIds": ["metadata", "level0"], "terms": ["ATU21TokenDailiesBonus", "FinalT3Trio1MaxLevel", "FinalT3Trio2MaxLevel"]},
            {"id": "action-lane", "label": "T3 trio action lane", "sourceIds": ["metadata", "level0"], "terms": ["BuyTrio1Boost", "BuyTrio2Boost"]},
            {"id": "prefab-roster", "label": "T3 trio prefab roster", "sourceIds": ["level0", "sharedassets0"], "terms": ["NewTokenUPGPrefab.T3.TrinityBoosterOne", "NewTokenUPGPrefab.T3.TrinityBoosterTwo"]},
            {"id": "title-text-surfaces", "label": "T3 trio title and text surfaces", "sourceIds": ["level0", "sharedassets0"], "terms": ["Trinity Booster One", "Trinity Oom Booster", "Tier 3 Max Level Increaser", "SetAllTokenShopTexts", "SetTokenTexts"]},
        ],
        "lostStructure": [
            "The T3 trio shell order now survives directly in the DB-backed TokenShop owner extract, where ATU21Button aligns to T3Trio1, ATU22Button aligns to T3Trio2, and ATU23Button advances straight into the ATU24 block without a surviving T3Trio3 owner block.",
            "Named trio buy hooks and exact TrinityBoosterOne or Two prefab identities still survive on committed sources, but the player-facing title and presentation surfaces remain detached from exact shell ids.",
            "The next honest target is one exact shell-local title or runtime display join for ATU21 or ATU22 plus an explicit bounded placeholder verdict for ATU23, not a broader late-ATU or planner promotion.",
        ],
    },
    "token-shop-late-atu-family": {
        "shellField": "ATU24Button through ATU28Button",
        "shellPathId": "late-range",
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 5,
        "familyTraceProfile": "late-atu-family",
        "traceRoutineHint": "token-shop-family-trace",
        "disableNativeTrace": True,
        "resolutionAliases": [
            "late atu family",
            "late atu24-atu28 family",
            "atu24 atu28 late family",
            "atu24 atu28 family",
            "late token shop family",
            "tier4plus late family",
            "late token shop shells",
        ],
        "surfaces": [
            {"id": "family-shells", "label": "Late ATU shell range", "sourceIds": ["tokenShopExtract"], "terms": ["ATU24Button", "ATU25Button", "ATU26Button", "ATU27Button", "ATU28Button", "ATU24StartCost", "ATU28Fill"]},
            {"id": "action-lane", "label": "Late ATU action lane", "sourceIds": ["metadata", "level0"], "terms": ["BuyATU24", "BuyATU25", "BuyATU26", "BuyATU27", "BuyATU28", "StartATU24Hold", "StopATU28Hold"]},
            {"id": "title-text-surfaces", "label": "Late ATU title roster", "sourceIds": ["level0"], "terms": ["Duo Booster Four", "Trinity Booster One", "Academy Booster", "Trinity Oom Booster", "Tokens Booster T3", "Tier 3 Max Level Increaser"]},
            {"id": "prefab-roster", "label": "Late ATU prefab roster", "sourceIds": ["level0"], "terms": ["NewTokenUPGPrefab.T3.TokensBoost", "NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser", "NewTokenUPGPrefab.T3.TrinityBoosterOne", "NewTokenUPGPrefab.T5.TrinityOomBooster", "NewTokenUPGPrefab.T2.DuoBoosterFour", "NewTokenUPGPrefab.T5.CampaignFragments"]},
            {"id": "effect-lane", "label": "Late ATU effect-side lane", "sourceIds": ["metadata", "level0"], "terms": ["ATU24Bonus3Shards", "Campaign Fragments", "Academy Points"]},
        ],
        "lostStructure": [
            "The late ATU neighborhood now preserves one exact serialized shell run from ATU24Button through ATU28Button with direct BuyATU24 through BuyATU28 hooks and matching start or stop hold pairs.",
            "Committed title and prefab rosters survive in the same late lane, but they still remain detached from exact ATU24Button through ATU28Button shell ownership.",
            "The next honest seam is still one exact shell-local title or prefab join for the late ATU family, not row-order inference or broader planner promotion.",
        ],
    },
    "token-shop-atu7-mk3-bridge": {
        "shellField": "ATU7Button",
        "shellPathId": 15792,
        "shellWindowSource": "tokenShopExtract",
        "shellWindowRadius": 4,
        "traceRoutineHint": "token-shop-mk3-bridge-trace",
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
        "traceRoutineHint": "token-shop-atu3-effect-trace",
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
        "traceRoutineHint": "token-shop-atu3-consumer-trace",
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
        "traceRoutineHint": "token-shop-atu3-consumer-read-trace",
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
    "token-shop-daily-tokenium-family": ["ATU14Button", "15844", "ATU19Button", "15842", "ATU14TokenDailiesBonus", "TokenDailiesT2", "T2Duo5"],
    "token-shop-t3-trio-family": ["ATU21Button", "15829", "ATU22Button", "15806", "ATU23Button", "15828", "ATU21TokenDailiesBonus", "T3Trio1", "T3Trio2"],
    "token-shop-late-atu-family": ["ATU24Button", "15797", "ATU28Button", "15813", "BuyATU24", "BuyATU28", "ATU24Bonus3Shards", "Tier 3 Max Level Increaser"],
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


BOOTSTRAP_TARGET_DEFINITION_RULES = {
    "token-shop-family-structure": {
        "targetClass": "family-audit",
        "whyExists": (
            "This target exists to preserve one reusable TokenShop family-level structure view across mixed solved and blocked rows. "
            "It is not a player-facing remap target; it keeps the repeated shell, proxy, prefab, and title-side pattern visible while unresolved joins stay explicit."
        ),
        "supportDatasets": [
            {"sourceId": "tokenShopExtract", "path": "data/archive/token-shop-values.json"},
        ],
    },
    "token-shop-daily-tokenium-family": {
        "targetClass": "family-remap-audit",
        "whyExists": (
            "This target exists because the committed repo preserves one coherent ATU14-19 Daily Tokenium-family shell run that can be grounded as a bounded remap lane without promoting cap-owner or planner behavior."
        ),
        "supportDatasets": [
            {"sourceId": "tokenShopExtract", "path": "data/archive/token-shop-values.json"},
        ],
    },
    "token-shop-t3-trio-family": {
        "targetClass": "family-remap-audit",
        "whyExists": (
            "This target exists because the committed repo preserves one coherent T3 trio shell neighborhood around ATU21-23 that stays more useful as a bounded family seam target than as speculative adjacent-row promotion."
        ),
        "supportDatasets": [
            {"sourceId": "tokenShopExtract", "path": "data/archive/token-shop-values.json"},
        ],
    },
    "token-shop-late-atu-family": {
        "targetClass": "range-family-audit",
        "whyExists": (
            "This target exists because the committed repo preserves a coherent late ATU24-28 shell neighborhood across serialized shell ids, direct buy hooks, title-side roster, prefab-side roster, and effect-side clues, "
            "but still does not preserve any exact shell-local identity join. It is therefore a bounded range-family seam target, not a row-order remap."
        ),
        "supportDatasets": [
            {"sourceId": "tokenShopLateAtuBoundary", "path": "data/token-shop-late-atu-boundary.json"},
            {"sourceId": "tokenShopExtract", "path": "data/archive/token-shop-values.json"},
        ],
        "rowSourcePath": ROOT / "data" / "token-shop-late-atu-boundary.json",
        "rowSourceJsonPath": "$.lateRows",
    },
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
    legacy_decision_summary = dict(payload.get("decisionSummary") or {})
    legacy_supporting_edge_types = [
        str(value)
        for value in (legacy_decision_summary.get("supportingEdgeTypes") or [])
        if str(value).strip()
    ]
    legacy_blocked_edge_types = [
        str(value)
        for value in (legacy_decision_summary.get("blockedEdgeTypes") or [])
        if str(value).strip()
    ]
    if not proved_edges and not negative_edges and (legacy_supporting_edge_types or legacy_blocked_edge_types):
        baseline_gap = list(legacy_decision_summary.get("baselineGap") or baseline_gap)
        negative_types = list(legacy_blocked_edge_types)
    if not rules:
        rules = _derive_output_summary_rules_from_state(
            trace_scope,
            "family-audit" if "family" in trace_scope else "target",
            {
                "blockedEdgeTypes": negative_types,
                "supportingEdgeTypes": (
                    legacy_supporting_edge_types
                    if not proved_edges and legacy_supporting_edge_types
                    else [
                        str(edge.get("type"))
                        for edge in proved_edges
                        if isinstance(edge, dict) and str(edge.get("type") or "")
                    ]
                ),
                "provedEdgeCount": (
                    len(legacy_supporting_edge_types)
                    if not proved_edges and legacy_supporting_edge_types
                    else len(proved_edges)
                ),
                "negativeEdgeCount": (
                    len(negative_types)
                    if not negative_edges and negative_types
                    else len(negative_edges)
                ),
                "summary": str((legacy_decision_summary.get("summary") or "")).strip(),
            },
        )
    effective_proved_edge_count = (
        len(legacy_supporting_edge_types)
        if not proved_edges and legacy_supporting_edge_types
        else len(proved_edges)
    )
    effective_negative_edge_count = (
        len(negative_types)
        if not negative_edges and negative_types
        else len(negative_edges)
    )

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
        if effective_proved_edge_count >= int(wire.get("minPresentEdges", 0) or 0) and effective_negative_edge_count <= int(wire.get("maxNegativeEdges", 0) or 0):
            verdict = "wire"
        elif effective_proved_edge_count >= int(quarantine.get("minPresentEdges", 0) or 0) and all(edge_type in (quarantine.get("allowedNegativeEdgeTypes") or []) for edge_type in negative_types):
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
            "provedEdgeCount": effective_proved_edge_count,
            "negativeEdgeCount": effective_negative_edge_count,
            "baselineGap": baseline_gap,
            "supportingEdgeTypes": (
                list(legacy_supporting_edge_types)
                if not proved_edges and legacy_supporting_edge_types
                else [
                    str(edge.get("type"))
                    for edge in proved_edges
                    if isinstance(edge, dict) and str(edge.get("type") or "")
                ]
            ),
            "blockedEdgeTypes": (
                list(negative_types)
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
        output_summary_rules = _derive_output_summary_rules_from_state(
            trace_scope,
            "family-audit" if "family" in trace_scope else "target",
            dict(payload.get("decisionSummary") or {}),
        )
    selected_subject_kind = str(planner_resolution.get("selectedSubjectKind") or trace_registry.get("selectedSubjectKind") or "").strip()
    selected_subject_key = str(planner_resolution.get("selectedSubjectKey") or trace_registry.get("selectedSubjectKey") or "").strip()
    execution_target_id = str(trace_registry.get("executionTargetId") or target_id).strip()
    execution_trace_scope = str(trace_registry.get("executionTraceScope") or trace_scope).strip()
    if family_id == "token-shop" and "family" not in trace_scope:
        expected_row_field = ""
        expected_match = re.search(
            r"(atu\d+)",
            " ".join([trace_scope, target_id, label, join_goal]),
            re.IGNORECASE,
        )
        if expected_match:
            expected_row_field = f"{expected_match.group(1).upper()}Button"
        if expected_row_field:
            expected_subject_key = f"row:{expected_row_field}"
            if selected_subject_key and selected_subject_key.startswith("row:") and selected_subject_key != expected_subject_key:
                selected_subject_kind = "row-local"
                selected_subject_key = expected_subject_key
            elif not selected_subject_key:
                selected_subject_kind = selected_subject_kind or "row-local"
                selected_subject_key = expected_subject_key
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


def _dependency_hash_payload(value: Any) -> str:
    return hashlib.sha1(_json_dumps(value).encode("utf-8")).hexdigest()[:16]


def _collect_trace_edge_proofs(trace_payload: dict[str, Any]) -> list[dict[str, Any]]:
    trace_graph = dict(trace_payload.get("traceGraph") or {})
    bridge_hits = list((trace_payload.get("bridgeCheck") or {}).get("bridgeHits") or [])
    proof_items: list[dict[str, Any]] = []
    for item in bridge_hits:
        if not isinstance(item, dict):
            continue
        proof_items.append(
            {
                "edgeType": str(item.get("edgeType") or ""),
                "sourceId": str(item.get("sourceId") or ""),
                "sourcePath": str(item.get("sourcePath") or ""),
                "term": str(item.get("term") or ""),
                "locator": str(item.get("locator") or ""),
            }
        )
    if proof_items:
        return proof_items[:8]
    for edge in (trace_graph.get("edges") or []):
        if not isinstance(edge, dict):
            continue
        edge_type = str(edge.get("type") or "").strip()
        if not edge_type:
            continue
        for proof in (edge.get("provedBy") or []):
            if not isinstance(proof, dict):
                continue
            proof_items.append(
                {
                    "edgeType": edge_type,
                    "sourceId": str(proof.get("sourceId") or ""),
                    "sourcePath": str(proof.get("sourcePath") or ""),
                    "term": str(proof.get("term") or ""),
                    "locator": str(proof.get("locator") or ""),
                }
            )
            if len(proof_items) >= 8:
                return proof_items
    return proof_items


def _get_fact_status(facts: list[dict[str, Any]], edge_type: str) -> str:
    status_priority = {"known": 0, "nonblocking": 1, "missing": 2, "blocked": 3}
    for item in reversed(facts):
        if str(item.get("edgeType") or "").strip() == edge_type:
            return str(item.get("status") or "").strip()
    return ""


def _collect_relation_contract_runtime_handoff(trace_payload: dict[str, Any]) -> dict[str, Any]:
    native_trace = dict(trace_payload.get("nativeTrace") or {})
    request_context = dict(native_trace.get("requestContext") or {})
    if str(request_context.get("coverageMode") or "").strip() != "relation-shaped":
        return {}
    required_seams = _unique_strings(
        [str(value).strip() for value in (request_context.get("requiredCoverageSeamIds") or []) if str(value).strip()]
    )
    if "exact-cellboost-to-booster-bonus-handoff" not in required_seams:
        return {}
    relation_scope = str(request_context.get("relationScope") or "").strip()
    subject_id = str(request_context.get("subjectId") or "").strip()
    if relation_scope != "token-shop-atu3-chest-consumer-read" or subject_id != "row:ATU3Button":
        return {}

    summary = dict(native_trace.get("summary") or {})
    result = dict(native_trace.get("result") or {})
    managed_reconstruction = dict(result.get("managedReconstruction") or {})
    owner_to_terms = dict(managed_reconstruction.get("ownerToTerms") or {})
    scored_owners = [dict(item) for item in (managed_reconstruction.get("scoredOwners") or []) if isinstance(item, dict)]
    relation_consumer_methods = _unique_strings(
        [str(value).strip() for value in (summary.get("relationConsumerMethods") or []) if str(value).strip()]
    )
    relation_declaring_fields = _unique_strings(
        [str(value).strip() for value in (summary.get("relationDeclaringFields") or []) if str(value).strip()]
    )
    relation_handoff_terms = _unique_strings(
        [str(value).strip() for value in (summary.get("relationHandoffTerms") or []) if str(value).strip()]
    )
    if not relation_consumer_methods or not relation_declaring_fields or not relation_handoff_terms:
        expected_terms = _unique_strings(
            [str(value).strip() for value in (request_context.get("expectedTerms") or []) if str(value).strip()]
        )
        method_terms = set(_unique_strings([str(value).strip() for value in (managed_reconstruction.get("methods") or []) if str(value).strip()]))
        field_terms = set(_unique_strings([str(value).strip() for value in (managed_reconstruction.get("fields") or []) if str(value).strip()]))
        handoff_term_pool = set(
            _unique_strings(
                [
                    *[str(value).strip() for value in (managed_reconstruction.get("rawValueTerms") or []) if str(value).strip()],
                    *list(method_terms),
                    *list(field_terms),
                ]
            )
        )
        for bucket in owner_to_terms.values():
            if not isinstance(bucket, dict):
                continue
            method_terms.update(str(value).strip() for value in (bucket.get("methods") or []) if str(value).strip())
            field_terms.update(str(value).strip() for value in (bucket.get("fields") or []) if str(value).strip())
            handoff_term_pool.update(str(value).strip() for value in (bucket.get("rawValues") or []) if str(value).strip())
            handoff_term_pool.update(str(value).strip() for value in (bucket.get("relatedTerms") or []) if str(value).strip())
        if not relation_consumer_methods:
            relation_consumer_methods = [term for term in expected_terms if term in method_terms]
        if not relation_declaring_fields:
            relation_declaring_fields = [term for term in expected_terms if term in field_terms]
        if not relation_handoff_terms:
            relation_handoff_terms = [term for term in expected_terms if term in handoff_term_pool or term in field_terms or term in method_terms]
    if not relation_consumer_methods or not relation_declaring_fields or not relation_handoff_terms:
        return {}

    cellboost_terms = {
        "CellBoostStartCost",
        "CellBoostAdditiveCost",
        "CellBoostBonus",
        "CellBoostMaxLevel",
    }
    getter_methods = {
        "get_SmallAdCellGains",
        "get_BigAdCellGains",
    }
    booster_methods = {
        "SetBoosterAdBonus",
        "get_FinalBoosterAdBonus",
    }
    booster_terms = {
        "FinalBoosterAdBonus",
        "<FinalAdTokenChestBonus>k__BackingField",
        "<FinalDiamondChestBonus>k__BackingField",
        "SmallAdCellGains",
        "BigAdCellGains",
    }

    combined_relation_terms = set(relation_declaring_fields).union(relation_handoff_terms)
    if not (combined_relation_terms & cellboost_terms):
        return {}
    if not (set(relation_consumer_methods) & getter_methods):
        return {}
    if not (set(relation_consumer_methods) & booster_methods):
        return {}
    if not (combined_relation_terms & booster_terms):
        return {}

    supporting_owners: list[str] = []
    for owner, bucket in owner_to_terms.items():
        if not isinstance(bucket, dict):
            continue
        owner_terms = set(
            _unique_strings(
                [
                    *[str(value).strip() for value in (bucket.get("methods") or []) if str(value).strip()],
                    *[str(value).strip() for value in (bucket.get("fields") or []) if str(value).strip()],
                    *[str(value).strip() for value in (bucket.get("rawValues") or []) if str(value).strip()],
                    *[str(value).strip() for value in (bucket.get("relatedTerms") or []) if str(value).strip()],
                ]
            )
        )
        if not (owner_terms & cellboost_terms):
            continue
        if not (owner_terms & (getter_methods | booster_methods | booster_terms)):
            continue
        supporting_owners.append(str(owner).strip())
    if not supporting_owners:
        for owner_entry in scored_owners:
            owner = str(owner_entry.get("owner") or "").strip()
            owner_terms = set(
                _unique_strings(
                    [
                        *[str(value).strip() for value in (owner_entry.get("methods") or []) if str(value).strip()],
                        *[str(value).strip() for value in (owner_entry.get("fields") or []) if str(value).strip()],
                        *[str(value).strip() for value in (owner_entry.get("rawValues") or []) if str(value).strip()],
                        *[str(value).strip() for value in (owner_entry.get("relatedTerms") or []) if str(value).strip()],
                    ]
                )
            )
            if not (owner_terms & cellboost_terms):
                continue
            if not (owner_terms & (getter_methods | booster_methods | booster_terms)):
                continue
            supporting_owners.append(owner)
    supporting_owners = _unique_strings(supporting_owners)
    if not supporting_owners:
        return {}

    evidence_terms = _unique_strings(
        [
            *supporting_owners,
            *[term for term in relation_consumer_methods if term in getter_methods or term in booster_methods],
            *[term for term in relation_declaring_fields if term in cellboost_terms or term in booster_terms],
            *[term for term in relation_handoff_terms if term in cellboost_terms or term in booster_terms],
        ]
    )
    proofs = [
        {
            "edgeType": "exact-cellboost-to-booster-bonus-handoff",
            "sourceId": "materialized-native-trace",
            "sourcePath": "nativeTrace.summary",
            "term": supporting_owners[0],
            "locator": "$.nativeTrace.result.managedReconstruction.ownerToTerms",
        },
        {
            "edgeType": "exact-cellboost-to-booster-bonus-handoff",
            "sourceId": "materialized-native-trace",
            "sourcePath": "nativeTrace.summary",
            "term": next((term for term in relation_consumer_methods if term in getter_methods), relation_consumer_methods[0]),
            "locator": "$.nativeTrace.summary.relationConsumerMethods",
        },
        {
            "edgeType": "exact-cellboost-to-booster-bonus-handoff",
            "sourceId": "materialized-native-trace",
            "sourcePath": "nativeTrace.summary",
            "term": next((term for term in relation_consumer_methods if term in booster_methods), relation_consumer_methods[-1]),
            "locator": "$.nativeTrace.summary.relationConsumerMethods",
        },
        {
            "edgeType": "exact-cellboost-to-booster-bonus-handoff",
            "sourceId": "materialized-native-trace",
            "sourcePath": "nativeTrace.summary",
            "term": next((term for term in relation_declaring_fields if term in cellboost_terms), relation_declaring_fields[0]),
            "locator": "$.nativeTrace.summary.relationDeclaringFields",
        },
        {
            "edgeType": "exact-cellboost-to-booster-bonus-handoff",
            "sourceId": "materialized-native-trace",
            "sourcePath": "nativeTrace.summary",
            "term": next((term for term in relation_handoff_terms if term in booster_terms), relation_handoff_terms[0]),
            "locator": "$.nativeTrace.summary.relationHandoffTerms",
        },
    ]
    return {
        "subjectId": subject_id,
        "relationScope": relation_scope,
        "supportingOwners": supporting_owners,
        "evidenceTerms": evidence_terms[:12],
        "proofs": proofs,
    }


def _build_subject_edge_facts(
    trace_scope: str,
    subject_id: str,
    subject_class: str,
    execution_context: dict[str, Any],
    execution_plan: dict[str, Any],
    decision_summary: dict[str, Any],
    trace_payload: dict[str, Any],
    reconstruction_payload: dict[str, Any] | None = None,
    support_terms: list[str] | None = None,
    support_proofs: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    trace_graph = dict(trace_payload.get("traceGraph") or {})
    reconstruction_payload = dict(reconstruction_payload or {})
    reconstruction_assessment = dict(reconstruction_payload.get("assessment") or {})
    depth_plan = [step for step in (execution_plan.get("depthPlan") or []) if isinstance(step, dict)]
    follow_up_terms = [str(value) for value in (execution_plan.get("followUpTerms") or []) if str(value).strip()]
    support_terms = _unique_strings([str(value) for value in (support_terms or []) if str(value).strip()])
    support_proofs = [dict(item) for item in (support_proofs or []) if isinstance(item, dict)]
    proof_items = _collect_trace_edge_proofs(trace_payload)
    proof_map: dict[str, list[dict[str, Any]]] = {}
    for item in proof_items:
        edge_type = str(item.get("edgeType") or "").strip()
        if not edge_type:
            continue
        proof_map.setdefault(edge_type, []).append(item)

    facts: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str]] = set()

    decision_baseline_gap = _unique_strings(
        [str(value) for value in (decision_summary.get("baselineGap") or []) if str(value).strip()]
    )
    reconstruction_baseline_gap = _unique_strings(
        [str(value) for value in (reconstruction_assessment.get("baselineGap") or []) if str(value).strip()]
    )
    decision_blocked_edge_types = _unique_strings(
        [str(value) for value in (decision_summary.get("blockedEdgeTypes") or []) if str(value).strip()]
    )
    reconstruction_blocked_edge_types = _unique_strings(
        [str(value) for value in (reconstruction_assessment.get("blockedEdgeTypes") or []) if str(value).strip()]
    )
    prefer_decision_summary_range_gaps = (
        subject_class == "range-family"
        and bool(decision_blocked_edge_types)
        and any(not str(edge_type).startswith("repeated-") for edge_type in decision_blocked_edge_types)
        and (
            any(str(edge_type).startswith("repeated-") for edge_type in reconstruction_baseline_gap)
            or any(str(edge_type).startswith("repeated-") for edge_type in reconstruction_blocked_edge_types)
        )
    )

    def add_fact(
        edge_type: str,
        edge_status: str,
        *,
        priority: int,
        reason: str = "",
        terms: list[str] | None = None,
        source_ids: list[str] | None = None,
        goal: str = "",
        proofs: list[dict[str, Any]] | None = None,
    ) -> None:
        normalized_edge_type = str(edge_type or "").strip()
        normalized_status = str(edge_status or "").strip()
        if not normalized_edge_type or not normalized_status:
            return
        fact_key = (normalized_edge_type, normalized_status)
        if fact_key in seen_keys:
            return
        seen_keys.add(fact_key)
        facts.append(
            {
                "subjectId": subject_id,
                "subjectClass": subject_class or None,
                "traceScope": trace_scope,
                "edgeType": normalized_edge_type,
                "status": normalized_status,
                "priority": int(priority),
                "reason": str(reason or "").strip() or None,
                "terms": _unique_strings([str(value) for value in (terms or []) if str(value).strip()])[:12],
                "sourceIds": _unique_strings([str(value) for value in (source_ids or []) if str(value).strip()]),
                "goal": str(goal or "").strip() or None,
                "proofs": list(proofs or []),
            }
        )

    known_edge_types = _unique_strings(
        [
            *[str(value) for value in (decision_summary.get("supportingEdgeTypes") or [])],
            *[
                str(edge.get("type") or "")
                for edge in (trace_graph.get("edges") or [])
                if isinstance(edge, dict) and str(edge.get("type") or "").strip()
            ],
        ]
    )
    if subject_class == "row-local":
        known_edge_types = [
            edge_type
            for edge_type in known_edge_types
            if not str(edge_type).startswith("repeated-")
        ]
    for edge_type in known_edge_types:
        add_fact(
            edge_type,
            "known",
            priority=10000,
            reason="trace:proved-edge",
            proofs=(proof_map.get(edge_type, []) or support_proofs)[:4],
        )

    row_local_graph = dict(reconstruction_payload.get("rowLocalGraph") or {})
    reconstruction_status = dict(reconstruction_payload.get("status") or {})
    if subject_class == "row-local" and row_local_graph:
        if list(row_local_graph.get("actionMethods") or []):
            add_fact(
                "exact-shell-to-action-hook",
                "known",
                priority=5000,
                reason="reconstruction:action-methods",
                terms=[*follow_up_terms, *support_terms],
                source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
                goal=str(execution_context.get("joinGoal") or "").strip(),
                proofs=support_proofs[:4],
            )
        if list(row_local_graph.get("prefabCandidates") or []):
            add_fact(
                "exact-shell-to-prefab",
                "known",
                priority=5001,
                reason="reconstruction:prefab-candidates",
                terms=[*follow_up_terms, *support_terms],
                source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
                goal=str(execution_context.get("joinGoal") or "").strip(),
                proofs=support_proofs[:4],
            )
        if bool(row_local_graph.get("literalTitleRecovered")):
            add_fact(
                "exact-shell-to-title",
                "known",
                priority=5002,
                reason="reconstruction:literal-title",
                terms=[*follow_up_terms, *support_terms],
                source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
                goal=str(execution_context.get("joinGoal") or "").strip(),
                proofs=support_proofs[:4],
            )
        if list(row_local_graph.get("updateHooks") or []):
            add_fact(
                "exact-display-update-path",
                "known",
                priority=5003,
                reason="reconstruction:update-hooks",
                terms=[*follow_up_terms, *support_terms],
                source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
                goal=str(execution_context.get("joinGoal") or "").strip(),
                proofs=support_proofs[:4],
            )
        if str((reconstruction_status.get("runtimeStatus") or "")).strip().lower() == "closed":
            add_fact(
                "runtime-model-gap",
                "known",
                priority=5004,
                reason="reconstruction:runtime-closed",
                terms=[*follow_up_terms, *support_terms],
                source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
                goal=str(execution_context.get("joinGoal") or "").strip(),
                proofs=support_proofs[:4],
            )

    relation_handoff = _collect_relation_contract_runtime_handoff(trace_payload)
    if subject_class == "row-local" and str(relation_handoff.get("subjectId") or "").strip() == subject_id:
        relation_terms = _unique_strings(
            [
                *[str(value).strip() for value in (relation_handoff.get("evidenceTerms") or []) if str(value).strip()],
                *follow_up_terms,
                *support_terms,
            ]
        )
        relation_proofs = list(relation_handoff.get("proofs") or []) or support_proofs[:4]
        common_source_ids = ["materialized-native-trace", "canonical-term-view", "graph-links"]
        add_fact(
            "exact-cellboost-to-booster-bonus-handoff",
            "known",
            priority=5050,
            reason="native-relation:exact-cellboost-handoff",
            terms=relation_terms,
            source_ids=common_source_ids,
            goal=str(execution_context.get("joinGoal") or "").strip(),
            proofs=relation_proofs[:4],
        )
        add_fact(
            "typed-shared-effect-owner",
            "known",
            priority=5051,
            reason="native-relation:typed-owner-covered",
            terms=relation_terms,
            source_ids=common_source_ids,
            goal=str(execution_context.get("joinGoal") or "").strip(),
            proofs=relation_proofs[:4],
        )
        add_fact(
            "runtime-model-gap",
            "known",
            priority=5052,
            reason="native-relation:runtime-model-covered",
            terms=relation_terms,
            source_ids=common_source_ids,
            goal=str(execution_context.get("joinGoal") or "").strip(),
            proofs=relation_proofs[:4],
        )

    for seam in (reconstruction_status.get("nonBlockingSeams") or []):
        if not isinstance(seam, dict):
            continue
        seam_id = str(seam.get("id") or "").strip()
        if not seam_id:
            continue
        add_fact(
            seam_id,
            "nonblocking",
            priority=7000,
            reason="reconstruction:bounded-nonblocking",
            terms=[*follow_up_terms, *support_terms],
            source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
            goal=str(execution_context.get("joinGoal") or "").strip(),
            proofs=support_proofs[:4],
        )

    claim_stages = [stage for stage in (execution_plan.get("claimStages") or []) if isinstance(stage, dict)]
    missing_priority = 0
    if subject_class == "range-family":
        range_baseline_gap = decision_baseline_gap if prefer_decision_summary_range_gaps else reconstruction_baseline_gap
        for gap_type in range_baseline_gap:
            add_fact(
                gap_type,
                "missing",
                priority=missing_priority,
                reason="reconstruction:baseline-gap",
                terms=[*follow_up_terms, *support_terms],
                source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
                goal=str(execution_context.get("joinGoal") or "").strip(),
            )
            missing_priority += 1
    if subject_class == "row-local":
        bounded_negatives = {str(b.get("seam") or "").strip() for b in (reconstruction_payload.get("boundedNegatives") or []) if isinstance(b, dict) and str(b.get("seam") or "").strip()}
        for seam in (reconstruction_payload.get("missingSeams") or []):
            if not isinstance(seam, dict):
                continue
            gap_type = str(seam.get("id") or "").strip()
            if not gap_type:
                continue
            already_status = _get_fact_status(facts, gap_type)
            if already_status == "nonblocking":
                continue
            if gap_type in bounded_negatives:
                continue
            if (
                gap_type == "exact-display-update-path"
                and _get_fact_status(facts, "exact-shell-to-action-hook") == "known"
                and _get_fact_status(facts, "exact-shell-to-prefab") == "known"
                and _get_fact_status(facts, "exact-shell-to-title") == "known"
                and any(
                    str(candidate.get("id") or "").strip() == "runtime-model-gap"
                    for candidate in (reconstruction_payload.get("missingSeams") or [])
                    if isinstance(candidate, dict)
                )
            ):
                add_fact(
                    gap_type,
                    "nonblocking",
                    priority=6900,
                    reason="reconstruction:display-path-nonblocking-until-runtime-clears",
                    terms=[*follow_up_terms, *support_terms],
                    source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
                    goal=str(execution_context.get("joinGoal") or "").strip(),
                    proofs=support_proofs[:4],
                )
                continue
            add_fact(
                gap_type,
                "missing",
                priority=missing_priority,
                reason="reconstruction:missing-seam",
                terms=[*follow_up_terms, *support_terms],
                source_ids=["reconstruction-fragment", "canonical-term-view", "graph-links"],
                goal=str(execution_context.get("joinGoal") or "").strip(),
            )
            missing_priority += 1
    for stage_index, stage in enumerate(claim_stages):
        stage_reason = "{}:{}".format(
            str(stage.get("id") or "claim-stage"),
            str(stage.get("label") or stage.get("id") or "unlabeled-stage"),
        )
        matching_depth_step = depth_plan[stage_index] if stage_index < len(depth_plan) else (depth_plan[0] if depth_plan else {})
        terms = [
            *[str(value) for value in (matching_depth_step.get("terms") or []) if str(value).strip()],
            *follow_up_terms,
            *support_terms,
        ]
        source_ids = [
            *[str(value) for value in (matching_depth_step.get("sourceIds") or []) if str(value).strip()],
            *[str(value) for value in (execution_plan.get("sourceIds") or []) if str(value).strip()],
        ]
        goal = str(matching_depth_step.get("goal") or execution_context.get("joinGoal") or "").strip()
        for seam_id in (stage.get("missingSeamIds") or []):
            normalized = str(seam_id or "").strip()
            if not normalized:
                continue
            add_fact(
                normalized,
                "missing",
                priority=missing_priority,
                reason=stage_reason,
                terms=terms,
                source_ids=source_ids,
                goal=goal,
            )
            missing_priority += 1

    if not claim_stages:
        for gap_type in _unique_strings([str(value) for value in (decision_summary.get("baselineGap") or []) if str(value).strip()]):
            add_fact(
                gap_type,
                "missing",
                priority=missing_priority,
                reason="assessment:baseline-gap",
                terms=[*follow_up_terms, *support_terms],
                source_ids=["canonical-term-view", "graph-links"],
                goal=str(execution_context.get("joinGoal") or "").strip(),
            )
            missing_priority += 1

    blocked_edge_types = _unique_strings(
        [
            *[str(value) for value in (decision_summary.get("blockedEdgeTypes") or [])],
            *[
                str(edge.get("type") or "")
                for edge in (trace_graph.get("negativeEdges") or [])
                if isinstance(edge, dict) and str(edge.get("type") or "").strip()
            ],
        ]
    )
    if subject_class == "row-local":
        blocked_edge_types = [
            edge_type
            for edge_type in blocked_edge_types
            if not str(edge_type).startswith("repeated-")
        ]
    if subject_class == "range-family":
        if prefer_decision_summary_range_gaps:
            blocked_edge_types = decision_blocked_edge_types
        else:
            blocked_edge_types = _unique_strings(
                [
                    *reconstruction_blocked_edge_types,
                    *blocked_edge_types,
                ]
            )
    for blocked_index, edge_type in enumerate(blocked_edge_types):
        matching_depth_step = next(
            (
                step
                for step in depth_plan
                if str(edge_type).lower() in str(step.get("goal") or "").lower()
            ),
            depth_plan[0] if depth_plan else {},
        )
        terms = [
            *[str(value) for value in (matching_depth_step.get("terms") or []) if str(value).strip()],
            *follow_up_terms,
            *support_terms,
        ]
        source_ids = _unique_strings([
            *[str(value) for value in (matching_depth_step.get("sourceIds") or []) if str(value).strip()],
            *[str(value) for value in (execution_plan.get("sourceIds") or []) if str(value).strip()],
            "canonical-term-view" if support_proofs else "",
            "graph-links" if support_proofs else "",
        ])
        add_fact(
            edge_type,
            "blocked",
            priority=1000 + blocked_index,
            reason="reconstruction:blocked-edge" if subject_class == "range-family" else "assessment:blocked-edge",
            terms=terms,
            source_ids=source_ids,
            goal=str(matching_depth_step.get("goal") or execution_context.get("joinGoal") or "").strip(),
        )
    return facts


def _derive_subject_identity(
    trace_scope: str,
    execution_context: dict[str, Any],
    reconstruction_payload: dict[str, Any] | None,
    semantic_scope_payload: dict[str, Any] | None = None,
    family_graph_payload: dict[str, Any] | None = None,
    support_rows: list[dict[str, Any]] | None = None,
    *,
    subject_kind: str = "",
    subject_key: str = "",
    family_id: str = "",
    compatibility_target_id: str = "",
) -> dict[str, Any]:
    reconstruction_payload = dict(reconstruction_payload or {})
    semantic_scope_payload = dict(semantic_scope_payload or {})
    family_graph_payload = dict(family_graph_payload or {})
    support_rows = [dict(item) for item in (support_rows or []) if isinstance(item, dict)]
    support_row = support_rows[0] if support_rows else {}
    row_shell = dict(reconstruction_payload.get("rowShell") or semantic_scope_payload.get("rowShell") or {})
    if not row_shell:
        support_field = str(support_row.get("shellField") or support_row.get("field") or "").strip()
        support_path_id = str(support_row.get("shellPathId") or support_row.get("pathId") or "").strip()
        row_shell = {
            "field": support_field or None,
            "pathId": support_path_id or None,
        }
    compatibility_target_id = str(compatibility_target_id or trace_scope or "").strip()
    selected_subject_kind = str(subject_kind or execution_context.get("selectedSubjectKind") or "").strip()
    selected_subject_key = str(subject_key or execution_context.get("selectedSubjectKey") or "").strip()
    effective_family_id = str(family_id or execution_context.get("familyId") or "").strip()
    if not effective_family_id:
        effective_family_id = _infer_family_id_from_target_id(compatibility_target_id)
    fallback_subject_id = str(execution_context.get("targetId") or compatibility_target_id or trace_scope).strip()
    aliases = _unique_strings(
        [
            compatibility_target_id,
            str(execution_context.get("targetId") or "").strip(),
            trace_scope,
            selected_subject_key,
        ]
    )
    expected_row_field = ""
    match = re.search(r"(atu\d+)", " ".join([compatibility_target_id, trace_scope]), re.IGNORECASE)
    if match:
        expected_row_field = f"{match.group(1).upper()}Button"

    if effective_family_id == "token-shop" and "family" in trace_scope:
        row_fields = _unique_strings(
            [
                str(item.get("shellField") or item.get("field") or "").strip()
                for item in support_rows
                if str(item.get("shellField") or item.get("field") or "").strip()
            ]
        )
        if not row_fields:
            row_fields = _unique_strings(
                [
                    str(item.get("field") or "").strip()
                    for item in (family_graph_payload.get("rowShells") or [])
                    if isinstance(item, dict) and str(item.get("field") or "").strip()
                ]
            )
        if row_fields:
            first_field = row_fields[0]
            last_field = row_fields[-1]
            canonical_subject_id = f"range:{effective_family_id}:{first_field}-{last_field}"
            return {
                "subjectId": canonical_subject_id,
                "subjectKind": "range-family",
                "subjectKey": canonical_subject_id,
                "subjectLabel": (
                    str(family_graph_payload.get("familyLabel") or "").strip()
                    or f"{first_field} through {last_field}"
                ),
                "targetAliases": aliases,
                "identityOwner": "db-family-range",
                "identityReason": "family-range-proved",
                "subjectPathId": None,
            }

    if effective_family_id == "token-shop" and "family" not in trace_scope:
        row_field = str(row_shell.get("field") or "").strip()
        row_path_id = str(row_shell.get("pathId") or "").strip()
        if expected_row_field and row_field and row_field != expected_row_field:
            return {
                "subjectId": fallback_subject_id,
                "subjectKind": selected_subject_kind or "target",
                "subjectKey": selected_subject_key or fallback_subject_id,
                "subjectLabel": str(execution_context.get("label") or fallback_subject_id),
                "targetAliases": aliases,
                "identityOwner": "compatibility-target",
                "identityReason": f"row-shell-mismatch:{expected_row_field}!={row_field}",
                "subjectPathId": None,
            }
        if selected_subject_key.startswith("row:"):
            row_field = row_field or selected_subject_key.split(":", 1)[1].strip()
        if row_field:
            canonical_subject_id = f"row:{row_field}"
            return {
                "subjectId": canonical_subject_id,
                "subjectKind": "row-local",
                "subjectKey": canonical_subject_id,
                "subjectLabel": row_field,
                "targetAliases": aliases,
                "identityOwner": "db-row-shell",
                "identityReason": "row-shell-proved",
                "subjectPathId": row_path_id or None,
            }
        if row_path_id:
            canonical_subject_id = f"path:{row_path_id}"
            return {
                "subjectId": canonical_subject_id,
                "subjectKind": "row-local",
                "subjectKey": canonical_subject_id,
                "subjectLabel": canonical_subject_id,
                "targetAliases": aliases,
                "identityOwner": "db-row-shell",
                "identityReason": "row-shell-proved:path-id-only",
                "subjectPathId": row_path_id,
            }

    return {
        "subjectId": fallback_subject_id,
        "subjectKind": selected_subject_kind or ("range-family" if "family" in trace_scope else "target"),
        "subjectKey": selected_subject_key or fallback_subject_id,
        "subjectLabel": str(execution_context.get("label") or fallback_subject_id),
        "targetAliases": aliases,
        "identityOwner": "compatibility-target",
        "identityReason": "db-row-shell-unavailable",
        "subjectPathId": None,
    }


def _derive_subject_state_from_edge_facts(
    trace_scope: str,
    subject_id: str,
    subject_class: str,
    facts: list[dict[str, Any]],
    *,
    subject_kind: str = "",
    subject_key: str = "",
    subject_label: str = "",
    target_aliases: list[str] | None = None,
    identity_owner: str = "",
    identity_reason: str = "",
    subject_path_id: str | None = None,
) -> dict[str, Any]:
    status_priority = {"known": 0, "nonblocking": 1, "missing": 2, "blocked": 3}
    seen: dict[str, dict[str, Any]] = {}
    for item in facts:
        edge_type = str(item.get("edgeType") or "").strip()
        if not edge_type:
            continue
        status = str(item.get("status") or "").strip()
        if edge_type not in seen:
            seen[edge_type] = item
        else:
            existing_priority = status_priority.get(seen[edge_type].get("status", ""), 99)
            new_priority = status_priority.get(status, 99)
            if new_priority < existing_priority:
                seen[edge_type] = item
    unique_facts = list(seen.values())

    known_edges = _unique_strings(
        [str(item.get("edgeType") or "") for item in unique_facts if str(item.get("status") or "") == "known"]
    )
    missing_edges = _unique_strings(
        [str(item.get("edgeType") or "") for item in unique_facts if str(item.get("status") or "") == "missing"]
    )
    blocked_edges = _unique_strings(
        [str(item.get("edgeType") or "") for item in unique_facts if str(item.get("status") or "") == "blocked"]
    )
    nonblocking_edges = _unique_strings(
        [str(item.get("edgeType") or "") for item in unique_facts if str(item.get("status") or "") == "nonblocking"]
    )
    candidate_facts = [
        item
        for item in unique_facts
        if str(item.get("status") or "") in {"missing", "blocked"} and str(item.get("edgeType") or "").strip()
    ]
    candidate_facts.sort(
        key=lambda item: (
            0 if str(item.get("status") or "") == "missing" else 1,
            int(item.get("priority") or 0),
            str(item.get("edgeType") or ""),
        )
    )
    next_fact = candidate_facts[0] if candidate_facts else {}
    proofs: list[dict[str, Any]] = []
    for item in facts:
        for proof in (item.get("proofs") or []):
            if isinstance(proof, dict):
                proofs.append(proof)
            if len(proofs) >= 8:
                break
        if len(proofs) >= 8:
            break
    return {
        "semanticKey": f"subject-state:{trace_scope}",
        "traceScope": trace_scope,
        "subjectId": subject_id,
        "subjectClass": subject_class or None,
        "subjectKind": str(subject_kind or "").strip() or None,
        "subjectKey": str(subject_key or subject_id).strip() or subject_id,
        "subjectLabel": str(subject_label or subject_id).strip() or subject_id,
        "targetAliases": _unique_strings([str(value) for value in (target_aliases or []) if str(value).strip()]),
        "identityOwner": str(identity_owner or "").strip() or None,
        "identityReason": str(identity_reason or "").strip() or None,
        "subjectPathId": str(subject_path_id or "").strip() or None,
        "knownEdges": known_edges,
        "missingEdges": missing_edges,
        "blockedEdges": blocked_edges,
        "nonblockingEdges": nonblocking_edges,
        "nextSeam": {
            "status": "clear" if not next_fact else "open",
            "id": str(next_fact.get("edgeType") or "").strip() or None,
            "reason": str(next_fact.get("reason") or "").strip() or ("facts:no-open-seam" if not next_fact else None),
            "terms": list(next_fact.get("terms") or [])[:12],
            "sourceIds": list(next_fact.get("sourceIds") or []),
            "goal": str(next_fact.get("goal") or "").strip() or None,
        },
        "proofs": proofs,
    }


def _build_dependency_proof(inputs: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        key: _dependency_hash_payload(value)
        for key, value in sorted(inputs.items())
    }
    return {
        "inputs": normalized,
        "combinedHash": _dependency_hash_payload(normalized),
    }


def _resolver_support_rows_from_surface_plan(
    trace_scope: str,
    surface_plan: dict[str, Any],
    reconstruction_payload: dict[str, Any],
) -> list[dict[str, Any]]:
    shell_window = dict(surface_plan.get("shellWindow") or {})
    window_entries = [entry for entry in (shell_window.get("window") or []) if isinstance(entry, dict)]
    button_rows: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str]] = set()
    seen_fields: set[str] = set()
    for entry in window_entries:
        field = str(entry.get("field") or "").strip()
        if not field or not field.endswith("Button"):
            continue
        row = {
            "field": field,
            "shellField": field,
            "shellPathId": str(entry.get("pathId") or "").strip(),
        }
        dedupe_key = (row["field"], row["shellPathId"])
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        seen_fields.add(row["field"])
        button_rows.append(row)
    for surface in (surface_plan.get("surfacePlans") or []):
        if not isinstance(surface, dict):
            continue
        for term in (surface.get("terms") or []):
            normalized = str(term or "").strip()
            if not normalized or not normalized.endswith("Button"):
                continue
            row = {
                "field": normalized,
                "shellField": normalized,
                "shellPathId": "",
            }
            dedupe_key = (row["field"], row["shellPathId"])
            if dedupe_key in seen_keys or row["field"] in seen_fields:
                continue
            seen_keys.add(dedupe_key)
            seen_fields.add(row["field"])
            button_rows.append(row)
    if button_rows:
        return button_rows
    row_shell = dict(reconstruction_payload.get("rowShell") or {})
    field = str(row_shell.get("field") or "").strip()
    path_id = str(row_shell.get("pathId") or "").strip()
    if field or path_id:
        return [
            {
                "field": field or trace_scope,
                "shellField": field or trace_scope,
                "shellPathId": path_id,
            }
        ]
    return []


def _resolver_support_surfaces_from_surface_plan(surface_plan: dict[str, Any]) -> list[dict[str, Any]]:
    surfaces: list[dict[str, Any]] = []
    for surface in (surface_plan.get("surfacePlans") or []):
        if not isinstance(surface, dict):
            continue
        surfaces.append(
            {
                "id": str(surface.get("id") or "").strip(),
                "label": str(surface.get("label") or "").strip(),
                "sourceIds": _unique_strings([str(value) for value in (surface.get("sourceIds") or []) if str(value).strip()]),
                "terms": _unique_strings([str(value) for value in (surface.get("terms") or []) if str(value).strip()]),
            }
        )
    return surfaces


def _resolver_anchor_terms(
    trace_scope: str,
    execution_context: dict[str, Any],
    surface_plan: dict[str, Any],
    reconstruction_payload: dict[str, Any],
    latest_bundle_payload: dict[str, Any],
    support_rows: list[dict[str, Any]],
    support_surfaces: list[dict[str, Any]],
) -> list[str]:
    planner_resolution = dict(latest_bundle_payload.get("plannerResolution") or {})
    terms: list[str] = []
    terms.extend(str(value) for value in (planner_resolution.get("expandedAnchors") or []))
    terms.extend(str(value) for value in (execution_context.get("acceptedAnchors") or []))
    shell_window = dict(surface_plan.get("shellWindow") or {})
    terms.extend(
        [
            str(shell_window.get("shellField") or ""),
            str(shell_window.get("shellPathId") or ""),
            str((reconstruction_payload.get("rowShell") or {}).get("field") or ""),
            str((reconstruction_payload.get("rowShell") or {}).get("pathId") or ""),
        ]
    )
    for row in support_rows:
        terms.extend(
            [
                str(row.get("field") or ""),
                str(row.get("shellField") or ""),
                str(row.get("shellPathId") or ""),
                str(row.get("buyHook") or ""),
            ]
        )
    for surface in support_surfaces:
        terms.append(str(surface.get("label") or ""))
        terms.extend(str(value) for value in (surface.get("terms") or []))
    terms.append(trace_scope.replace("-", " "))
    return _unique_strings([value for value in terms if str(value).strip()])


def _infer_resolver_target_class(
    trace_scope: str,
    support_rows: list[dict[str, Any]],
    subject_state: dict[str, Any],
    latest_bundle_payload: dict[str, Any],
) -> str:
    if len(support_rows) > 1:
        if "range" in trace_scope or "late" in trace_scope:
            return "range-family-audit"
        return "family-audit"
    blocked_edges = [str(value) for value in (subject_state.get("blockedEdges") or []) if str(value).strip()]
    if not blocked_edges:
        decision_summary = dict(latest_bundle_payload.get("decisionSummary") or {})
        blocked_edges = [str(value) for value in (decision_summary.get("blockedEdgeTypes") or []) if str(value).strip()]
    if "runtime-model-gap" in blocked_edges or "exact-display-update-path" in blocked_edges:
        return "row-remap-audit"
    return "target"


def _resolver_why_exists(
    trace_scope: str,
    execution_context: dict[str, Any],
    subject_state: dict[str, Any],
    latest_bundle_payload: dict[str, Any],
    support_rows: list[dict[str, Any]],
    support_surfaces: list[dict[str, Any]],
    target_class: str,
) -> str:
    blocked_edges = [str(value) for value in (subject_state.get("blockedEdges") or []) if str(value).strip()]
    supporting_edges = [str(value) for value in (subject_state.get("knownEdges") or []) if str(value).strip()]
    if not blocked_edges and not supporting_edges:
        decision_summary = dict(latest_bundle_payload.get("decisionSummary") or {})
        blocked_edges = [str(value) for value in (decision_summary.get("blockedEdgeTypes") or []) if str(value).strip()]
        supporting_edges = [str(value) for value in (decision_summary.get("supportingEdgeTypes") or []) if str(value).strip()]
    label = str(execution_context.get("label") or trace_scope).strip() or trace_scope
    shell_labels = [str(row.get("shellField") or row.get("field") or "").strip() for row in support_rows if str(row.get("shellField") or row.get("field") or "").strip()]
    surface_labels = [str(surface.get("label") or "").strip() for surface in support_surfaces if str(surface.get("label") or "").strip()]
    if target_class in {"range-family-audit", "family-audit"}:
        shell_summary = ", ".join(shell_labels[:4]) + ("..." if len(shell_labels) > 4 else "") if shell_labels else label
        surface_summary = ", ".join(surface_labels[:3]) if surface_labels else "current canonical surfaces"
        blocked_summary = ", ".join(blocked_edges) if blocked_edges else "no currently blocked seams"
        return (
            f"This target exists because DB-backed canonical fragments preserve a coherent bounded family/range neighborhood around {shell_summary}. "
            f"The current resolver keeps {surface_summary} together while remaining seams stay explicit: {blocked_summary}."
        )
    row_label = shell_labels[0] if shell_labels else label
    edge_summary = ", ".join(supporting_edges[:4]) if supporting_edges else "current proved edges"
    blocked_summary = ", ".join(blocked_edges) if blocked_edges else "no currently blocked seams"
    return (
        f"This target exists because DB-backed canonical fragments preserve one bounded row-local TokenShop seam around {row_label}. "
        f"The current resolver keeps {edge_summary} visible while remaining seams stay explicit: {blocked_summary}."
    )


def _derive_resolver_resolution_aliases(
    trace_scope: str,
    target_id: str,
    label: str,
    support_rows: list[dict[str, Any]],
    support_surfaces: list[dict[str, Any]],
    target_class: str,
) -> list[str]:
    aliases = _unique_strings(
        [
            trace_scope.replace("-", " "),
            target_id.replace("-", " "),
            label,
            str(label).replace("-", " "),
        ]
    )
    row_fields = [str(row.get("field") or row.get("shellField") or "").strip() for row in support_rows if str(row.get("field") or row.get("shellField") or "").strip()]
    if target_class in {"range-family-audit", "family-audit"} and row_fields:
        first_field = row_fields[0]
        last_field = row_fields[-1]
        normalized_scope = trace_scope.replace("token-shop-", "").replace("-", " ").strip()
        aliases.extend(
            _unique_strings(
                [
                    normalized_scope,
                    f"{first_field} {last_field} {normalized_scope}".strip(),
                    f"{first_field} through {last_field}".strip(),
                    f"{first_field} {last_field} family".strip(),
                ]
            )
        )
    for surface in support_surfaces:
        label_value = str(surface.get("label") or "").strip()
        if label_value:
            aliases.append(label_value)
        source_terms = [str(value) for value in (surface.get("terms") or []) if str(value).strip()]
        if len(source_terms) >= 2 and target_class in {"range-family-audit", "family-audit"}:
            aliases.append(f"{source_terms[0]} {source_terms[-1]} family")
    return _unique_strings([value for value in aliases if str(value).strip()])


def _derive_output_summary_rules_from_state(
    trace_scope: str,
    target_class: str,
    decision_summary: dict[str, Any],
) -> dict[str, Any]:
    blocked_edge_types = _unique_strings([str(value) for value in (decision_summary.get("blockedEdgeTypes") or []) if str(value).strip()])
    supporting_edge_types = _unique_strings([str(value) for value in (decision_summary.get("supportingEdgeTypes") or []) if str(value).strip()])
    proved_edge_count = int(decision_summary.get("provedEdgeCount") or len(supporting_edge_types) or 0)
    negative_edge_count = int(decision_summary.get("negativeEdgeCount") or len(blocked_edge_types) or 0)
    summary = str(decision_summary.get("summary") or "").strip()
    quarantine_min = max(1, proved_edge_count) if (proved_edge_count or blocked_edge_types) else 1
    wire_min = max(quarantine_min + 1, max(1, proved_edge_count + max(negative_edge_count, 1)))
    if target_class in {"range-family-audit", "family-audit"}:
        wire_message = (
            "The bounded family target would only wire if every currently blocked seam closed, and it should still remain descriptive only."
        )
        research_message = (
            "The bounded family target still lacks enough checked structure to preserve a stable descriptive verdict."
        )
    elif target_class == "row-remap-audit":
        wire_message = "One exact bounded row-local chain cleared cleanly enough to wire the traced boundary."
        research_message = "The row-local trace is still too incomplete to preserve one bounded verdict."
    else:
        wire_message = "One exact bounded chain cleared cleanly enough to wire the traced boundary."
        research_message = "The trace is still too incomplete to preserve one bounded verdict."
    quarantine_message = summary or "The trace preserves a bounded descriptive verdict while remaining seams stay explicit."
    return {
        "wire": {"minPresentEdges": wire_min, "maxNegativeEdges": 0},
        "quarantine": {
            "minPresentEdges": quarantine_min,
            "allowedNegativeEdgeTypes": blocked_edge_types,
        },
        "messages": {
            "wire": wire_message,
            "quarantine": quarantine_message,
            "research": research_message,
        },
    }


def _derive_support_context_from_resolver_state(
    trace_scope: str,
    execution_context: dict[str, Any],
    resolver_target: dict[str, Any],
    surface_plan: dict[str, Any],
    latest_bundle_payload: dict[str, Any],
) -> dict[str, Any]:
    resolver_payload = dict(resolver_target or {})
    support_surfaces = list(resolver_payload.get("supportSurfaces") or [])
    support_rows = list(resolver_payload.get("supportRows") or [])

    support_context = {
        "traceRoutineHint": str(resolver_payload.get("traceRoutineHint") or "").strip() or None,
        "familyTraceProfile": str(resolver_payload.get("familyTraceProfile") or "").strip() or None,
        "disableNativeTrace": resolver_payload.get("disableNativeTrace") is True,
        "defaultPresentationUpdateHook": str(resolver_payload.get("defaultPresentationUpdateHook") or "").strip() or None,
        "nativeTraceTerms": list(resolver_payload.get("nativeTraceTerms") or []),
        "resolutionAliases": list(resolver_payload.get("resolutionAliases") or []),
        "surfaces": support_surfaces,
        "acceptedAnchors": list(resolver_payload.get("acceptedAnchors") or execution_context.get("acceptedAnchors") or []),
        "defaultAnchors": list(resolver_payload.get("anchorTerms") or []),
        "outputSummaryRules": dict(resolver_payload.get("outputSummaryRules") or execution_context.get("outputSummaryRules") or {}),
        "supportRows": support_rows,
        "shellWindow": dict(surface_plan.get("shellWindow") or {}),
        "blockedEdgeTypes": list(resolver_payload.get("blockedEdgeTypes") or []),
        "clearedEdgeTypes": list(resolver_payload.get("clearedEdgeTypes") or []),
        "nextSeam": str(((latest_bundle_payload.get("knowledgePlan") or {}).get("nextSeam") or "")).strip() or None,
    }
    return {key: value for key, value in support_context.items() if value not in (None, "", [], {})}


def _derive_resolver_trace_workflow_policy(
    trace_scope: str,
    family_id: str,
    target_class: str,
    support_rows: list[dict[str, Any]],
    support_surfaces: list[dict[str, Any]],
    blocked_edge_types: list[str],
    anchor_terms: list[str],
) -> dict[str, Any]:
    effective_family_id = str(family_id or "").strip() or ("token-shop" if trace_scope.startswith("token-shop") else "")
    support_surface_ids = {
        str(surface.get("id") or "").strip()
        for surface in support_surfaces
        if str(surface.get("id") or "").strip()
    }
    blocked_edge_type_set = {str(value).strip() for value in blocked_edge_types if str(value).strip()}
    trace_routine_hint = ""
    family_trace_profile = ""
    disable_native_trace = False
    default_presentation_update_hook = ""
    native_trace_terms: list[str] = []

    if effective_family_id == "token-shop":
        if len(support_rows) > 1:
            trace_routine_hint = "token-shop-family-trace"
            if target_class == "range-family-audit" and {"title-text-surfaces", "prefab-roster", "effect-lane"} <= support_surface_ids:
                family_trace_profile = "late-atu-family"
                disable_native_trace = True
            elif {"title-text-surfaces", "prefab-roster", "action-lane"} <= support_surface_ids:
                family_trace_profile = "generic-structure"
        else:
            if {"support-text-lane", "title-roster-gap", "prefab-lane"} <= support_surface_ids:
                trace_routine_hint = "token-shop-mk1-title-trace"
            elif {"title-lane", "prefab-lane", "text-hooks"} <= support_surface_ids:
                trace_routine_hint = "token-shop-mod-trace"
            elif {"prefab-lane", "action-lane"} <= support_surface_ids and "metadata-neighborhood" in support_surface_ids:
                trace_routine_hint = "token-shop-mk3-bridge-trace"
            elif {"shared-effect-title", "shared-effect-text", "detached-identity-surfaces"} <= support_surface_ids:
                trace_routine_hint = "token-shop-atu3-effect-trace"
            elif {"consumer-family", "consumer-routines", "chest-objects"} <= support_surface_ids:
                trace_routine_hint = "token-shop-atu3-consumer-trace"
            elif {"consumer-family", "consumer-routines", "booster-bonus-shell"} <= support_surface_ids:
                trace_routine_hint = "token-shop-atu3-consumer-read-trace"
            if "exact-display-update-path" in blocked_edge_type_set:
                default_presentation_update_hook = "SetCostRelatedAttributes"
        if not disable_native_trace:
            native_trace_terms = _unique_strings(list(anchor_terms or [])[:12])

    return {
        "traceRoutineHint": trace_routine_hint or None,
        "familyTraceProfile": family_trace_profile or None,
        "disableNativeTrace": disable_native_trace,
        "defaultPresentationUpdateHook": default_presentation_update_hook or None,
        "nativeTraceTerms": native_trace_terms,
    }


def _stable_proof_value(value: Any) -> Any:
    if isinstance(value, dict):
        stable: dict[str, Any] = {}
        for key, child in value.items():
            if key in {
                "fragmentId",
                "fragmentIds",
                "corroboratingFragmentIds",
                "updatedAt",
                "builtAt",
                "generatedAt",
            }:
                continue
            stable[str(key)] = _stable_proof_value(child)
        return stable
    if isinstance(value, list):
        return [_stable_proof_value(item) for item in value]
    return value


def _stable_semantic_group_source_payload(fragment_kind: str, payload: Any) -> Any:
    stable = _stable_proof_value(payload)
    if fragment_kind != "dependency_fragment" or not isinstance(stable, dict):
        return stable
    return {
        "semanticKey": str(stable.get("semanticKey") or "").strip() or None,
        "familyId": str(stable.get("familyId") or "").strip() or None,
        "targetId": str(stable.get("targetId") or "").strip() or None,
        "role": str(stable.get("role") or "").strip() or None,
        "edge": _normalize_dependency_edge(stable.get("edge")),
    }


def _retain_latest_rows(
    conn: sqlite3.Connection,
    table_name: str,
    partition_columns: list[str],
    order_expression: str,
    retain_limit: int,
    where_sql: str = "",
    params: tuple[Any, ...] = (),
) -> int:
    retain_limit = max(1, int(retain_limit))
    where_clause = f"WHERE {where_sql}" if str(where_sql).strip() else ""
    partition_sql = ", ".join(partition_columns)
    deleted = conn.execute(
        f"""
        WITH ranked AS (
            SELECT rowid,
                   ROW_NUMBER() OVER (
                       PARTITION BY {partition_sql}
                       ORDER BY {order_expression}
                   ) AS rn
            FROM {table_name}
            {where_clause}
        )
        DELETE FROM {table_name}
        WHERE rowid IN (
            SELECT rowid
            FROM ranked
            WHERE rn > ?
        )
        """,
        (*params, retain_limit),
    ).rowcount
    return int(deleted or 0)


def _build_canonical_trace_selection_proof(
    ordered_rows: list[sqlite3.Row],
    canonical_payload: dict[str, Any],
    alternates: list[dict[str, Any]],
) -> dict[str, Any]:
    ordered_payload_set = [
        {
            "sourceTerm": str(row["source_term"] or ""),
            "confidence": float(row["confidence"] or 0.0),
            "reducerPriority": int(row["reducer_priority"] or 0),
            "schemaVersion": int(row["schema_version"] or 0),
            "scriptName": str(row["script_name"] or ""),
            "producerVersion": str(row["producer_version"] or ""),
            "payload": _json_loads(row["payload_json"], None),
        }
        for row in ordered_rows
    ]
    return _build_dependency_proof(
        {
            "orderedPayloadSet": ordered_payload_set,
            "canonicalPayload": canonical_payload,
            "alternatePayloads": alternates,
        }
    )


def _build_materialized_trace_dependency_proof(
    payload: dict[str, Any],
    fragment_selection_proofs: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    stable_payload = dict(payload)
    stable_payload.pop("dataset", None)
    stable_payload.pop("generatedAt", None)
    return _build_dependency_proof(
        {
            "payload": stable_payload,
            "canonicalSelectionProofs": {
                key: dict(value or {}).get("combinedHash")
                for key, value in sorted(fragment_selection_proofs.items())
            },
        }
    )


def _build_canonical_system_trace_dependency_proof(
    system_payload: dict[str, Any],
    system_fragment_selection_proofs: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    return _build_dependency_proof(
        {
            "payload": system_payload,
            "canonicalSelectionProofs": {
                key: dict(value or {}).get("combinedHash")
                for key, value in sorted(system_fragment_selection_proofs.items())
            },
        }
    )


def _build_semantic_group_proof(
    fragment_kind: str,
    rows: list[sqlite3.Row],
    canonical_payload: dict[str, Any],
    alternates: list[dict[str, Any]],
) -> dict[str, Any]:
    ordered_payload_set = [
        {
            "traceScope": str(row["trace_scope"] or ""),
            "requestSignature": str(row["request_signature"] or ""),
            "sourceTerm": str(row["source_term"] or ""),
            "confidence": float(row["confidence"] or 0.0),
            "reducerPriority": int(row["reducer_priority"] or 0),
            "schemaVersion": int(row["schema_version"] or 0),
            "scriptName": str(row["script_name"] or ""),
            "producerVersion": str(row["producer_version"] or ""),
            "payload": _stable_semantic_group_source_payload(fragment_kind, _json_loads(row["payload_json"], None)),
        }
        for row in sorted(rows, key=_rank_row, reverse=True)
    ]
    ordered_payload_set = sorted(ordered_payload_set, key=_json_dumps)
    return _build_dependency_proof(
        {
            "orderedPayloadSet": ordered_payload_set,
            "canonicalPayload": _stable_proof_value(canonical_payload),
        }
    )


def _derive_fragment_dependency_inputs(
    fragment_kind: str,
    fragment_key: str,
    trace_scope: str,
    payload: dict[str, Any],
    derived_payloads: dict[tuple[str, str], dict[str, Any]],
) -> dict[str, Any]:
    target = dict(payload.get("target") or {})
    if fragment_kind == "execution_context_fragment":
        return {
            "target": payload.get("target"),
            "plannerResolution": payload.get("plannerResolution"),
            "traceRegistry": payload.get("traceRegistry"),
            "traceWorkflow": payload.get("traceWorkflow"),
        }
    if fragment_kind == "assessment_fragment":
        return {
            "target": payload.get("target"),
            "traceGraph": payload.get("traceGraph"),
            "nativeReconstruction": payload.get("nativeReconstruction"),
            "solvedVsBlockedDiff": payload.get("solvedVsBlockedDiff"),
            "decisionSummary": payload.get("decisionSummary"),
        }
    if fragment_kind == "target_narrative_fragment":
        return {
            "target": payload.get("target"),
            "narrativeSeed": payload.get("narrative_seed_fragment"),
            "reconstructionNote": payload.get("reconstruction_note_fragment"),
        }
    if fragment_kind == "bridge_comparison_fragment":
        return {
            "target": payload.get("target"),
            "bridgeComparisonSeed": payload.get("bridge_comparison_seed_fragment"),
            "traceGraph": payload.get("traceGraph"),
            "outcome": payload.get("outcome"),
        }
    if fragment_kind == "semantic_scope_fragment" and fragment_key.startswith("row:"):
        return {
            "target": payload.get("target"),
            "rowRecovery": payload.get("rowRecovery"),
            "traceGraph": payload.get("traceGraph"),
            "shellWindow": payload.get("shellWindow"),
            "surfaces": payload.get("surfaces"),
            "nativeReconstruction": payload.get("nativeReconstruction"),
        }
    if fragment_kind == "semantic_scope_fragment" and fragment_key.startswith("token-shop-updater-display:"):
        return {
            "target": payload.get("target"),
            "rowRecovery": payload.get("rowRecovery"),
            "traceGraph": payload.get("traceGraph"),
            "assessment": derived_payloads.get(("assessment_fragment", f"target-assessment:{trace_scope}")),
            "nativeReconstruction": payload.get("nativeReconstruction"),
        }
    if fragment_kind == "semantic_scope_fragment":
        return {
            "target": payload.get("target"),
            "rowRecovery": payload.get("rowRecovery"),
            "traceGraph": payload.get("traceGraph"),
            "nativeReconstruction": payload.get("nativeReconstruction"),
        }
    if fragment_kind == "token_shop_reconstruction_fragment":
        row_scope_key = str(((payload.get("rowRecovery") or {}).get("semanticScopeId")) or "")
        return {
            "formula": payload.get("formula_fragment"),
            "runtimeTable": payload.get("runtime_table_fragment"),
            "rowScope": derived_payloads.get(("semantic_scope_fragment", row_scope_key)),
            "assessment": derived_payloads.get(("assessment_fragment", f"target-assessment:{trace_scope}")),
        }
    if fragment_kind == "family_graph_fragment":
        family_id = str(target.get("familyId") or "")
        return {
            "target": payload.get("target"),
            "assessment": derived_payloads.get(("assessment_fragment", f"target-assessment:{trace_scope}")),
            "targetNarrative": derived_payloads.get(("target_narrative_fragment", f"target-narrative:{trace_scope}")),
            "tokenShopReconstruction": derived_payloads.get(("token_shop_reconstruction_fragment", f"token-shop-reconstruction:{trace_scope}")),
            "familyId": family_id,
        }
    if fragment_kind == "execution_plan_fragment":
        row_scope_key = str(((payload.get("rowRecovery") or {}).get("semanticScopeId")) or "")
        family_id = str(target.get("familyId") or "")
        return {
            "target": payload.get("target"),
            "nativeTrace": payload.get("nativeTrace"),
            "nativeReconstruction": payload.get("nativeReconstruction"),
            "rowScope": derived_payloads.get(("semantic_scope_fragment", row_scope_key)),
            "tokenShopReconstruction": derived_payloads.get(("token_shop_reconstruction_fragment", f"token-shop-reconstruction:{trace_scope}")),
            "familyGraph": derived_payloads.get(("family_graph_fragment", f"family-graph:{family_id}")),
        }
    if fragment_kind == "surface_plan_fragment":
        return {
            "target": payload.get("target"),
            "shellWindow": payload.get("shellWindow"),
            "surfaces": payload.get("surfaces"),
        }
    if fragment_kind == "graph_plan_fragment":
        return {
            "target": payload.get("target"),
            "traceGraph": payload.get("traceGraph"),
        }
    if fragment_kind == "bridge_policy_fragment":
        return {
            "target": payload.get("target"),
            "traceGraph": payload.get("traceGraph"),
            "bridgePromotionRule": payload.get("bridgePromotionRule"),
            "lostStructure": payload.get("lostStructure"),
        }
    return {
        "traceScope": trace_scope,
        "target": payload.get("target"),
    }


def _derive_reducer_semantic_fragments_with_reuse(
    conn: sqlite3.Connection,
    trace_groups: dict[tuple[str, str, str, str], dict[str, Any]],
    previous_semantic_lookup: dict[tuple[str, str, str, str], dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[tuple[str, str, str, str], dict[str, Any]], dict[tuple[str, str, str, str], dict[str, Any]], set[tuple[str, str, str, str]]]:
    recomputed_entries: list[dict[str, Any]] = []
    final_semantic_lookup: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    dependency_proofs: dict[tuple[str, str, str, str], dict[str, Any]] = {}
    removed_keys: set[tuple[str, str, str, str]] = set()
    for (project_name, project_file, trace_scope, _request_signature), value in trace_groups.items():
        payload = dict(value.get("payload") or {})
        provenance = dict(value.get("provenance") or {})
        derived_payloads: dict[tuple[str, str], dict[str, Any]] = {}

        def maybe_reuse(
            fragment_kind: str,
            fragment_key: str,
            factory: Any,
        ) -> dict[str, Any] | None:
            semantic_db_key = (project_name, project_file, fragment_kind, fragment_key)
            dependency_inputs = _derive_fragment_dependency_inputs(
                fragment_kind,
                fragment_key,
                trace_scope,
                payload,
                derived_payloads,
            )
            dependency_proof = _build_dependency_proof(dependency_inputs)
            previous = previous_semantic_lookup.get(semantic_db_key)
            previous_proof = dict((previous or {}).get("provenance") or {}).get("dependencyProof") or {}
            if previous and previous_proof.get("combinedHash") == dependency_proof.get("combinedHash"):
                final_semantic_lookup[semantic_db_key] = previous
                dependency_proofs[semantic_db_key] = {
                    "reuseDecision": "reused",
                    **dependency_proof,
                }
                payload_entry = dict(previous.get("payload") or {})
                if payload_entry:
                    derived_payloads[(fragment_kind, fragment_key)] = payload_entry
                return payload_entry or None
            candidate = factory()
            if candidate is None:
                if previous:
                    removed_keys.add(semantic_db_key)
                return None
            entry = {
                "project_name": project_name,
                "project_file": project_file,
                "fragment_kind": fragment_kind,
                "fragment_key": fragment_key,
                "payload": candidate,
                "provenance": {
                    **dict(candidate.get("support") or {}),
                    "dependencyProof": {
                        "reuseDecision": "recomputed",
                        **dependency_proof,
                    },
                },
            }
            recomputed_entries.append(entry)
            final_semantic_lookup[semantic_db_key] = {
                "payload": candidate,
                "alternates": [],
                "provenance": entry["provenance"],
            }
            dependency_proofs[semantic_db_key] = entry["provenance"]["dependencyProof"]
            derived_payloads[(fragment_kind, fragment_key)] = candidate
            return candidate

        execution_context_key = f"target-execution-context:{trace_scope}"
        execution_context_fragment = maybe_reuse(
            "execution_context_fragment",
            execution_context_key,
            lambda: _derive_execution_context_fragment(trace_scope, payload, provenance),
        )
        assessment_key = f"target-assessment:{trace_scope}"
        assessment_fragment = maybe_reuse(
            "assessment_fragment",
            assessment_key,
            lambda: _derive_target_assessment_fragment(trace_scope, payload, provenance),
        )
        assessment_summary = dict((assessment_fragment or {}).get("decisionSummary") or {})
        narrative_key = f"target-narrative:{trace_scope}"
        target_narrative_fragment = maybe_reuse(
            "target_narrative_fragment",
            narrative_key,
            lambda: _derive_target_narrative_fragment(trace_scope, payload, provenance),
        )
        bridge_comparison_key = f"target-bridge-comparison:{trace_scope}"
        maybe_reuse(
            "bridge_comparison_fragment",
            bridge_comparison_key,
            lambda: _derive_target_bridge_comparison_fragment(trace_scope, payload, provenance),
        )
        shard_scope = _derive_shard_owned_state_semantic_scope(trace_scope, payload, provenance)
        if shard_scope is not None:
            maybe_reuse(
                "semantic_scope_fragment",
                str(shard_scope.get("scopeId") or ""),
                lambda: _derive_shard_owned_state_semantic_scope(trace_scope, payload, provenance),
            )
        token_shop_scope = _derive_token_shop_row_semantic_scope(trace_scope, payload, provenance)
        if token_shop_scope is not None:
            token_shop_scope = maybe_reuse(
                "semantic_scope_fragment",
                str(token_shop_scope.get("scopeId") or ""),
                lambda: _derive_token_shop_row_semantic_scope(trace_scope, payload, provenance),
            )
        token_shop_updater_scope = _derive_token_shop_updater_display_semantic_scope(
            conn,
            trace_scope,
            payload,
            provenance,
            assessment_summary,
        )
        if token_shop_updater_scope is not None:
            maybe_reuse(
                "semantic_scope_fragment",
                str(token_shop_updater_scope.get("scopeId") or ""),
                lambda: _derive_token_shop_updater_display_semantic_scope(
                    conn,
                    trace_scope,
                    payload,
                    provenance,
                    assessment_summary,
                ),
            )
        token_shop_reconstruction_key = f"token-shop-reconstruction:{trace_scope}"
        token_shop_reconstruction_fragment = maybe_reuse(
            "token_shop_reconstruction_fragment",
            token_shop_reconstruction_key,
            lambda: _derive_token_shop_reconstruction_fragment(
                conn,
                trace_scope,
                payload,
                provenance,
                token_shop_scope,
                assessment_summary,
            ),
        )
        family_graph_candidate = _derive_family_graph_fragment(
            conn,
            trace_scope,
            payload,
            assessment_summary,
            target_narrative_fragment,
            token_shop_reconstruction_fragment,
        )
        if family_graph_candidate is not None:
            maybe_reuse(
                "family_graph_fragment",
                str(family_graph_candidate.get("semanticKey") or ""),
                lambda: _derive_family_graph_fragment(
                    conn,
                    trace_scope,
                    payload,
                    assessment_summary,
                    target_narrative_fragment,
                    token_shop_reconstruction_fragment,
                ),
            )
        execution_plan_candidate = _derive_token_shop_execution_plan_fragment(
            trace_scope,
            payload,
            provenance,
            token_shop_scope,
            token_shop_reconstruction_fragment,
            final_semantic_lookup.get((project_name, project_file, "family_graph_fragment", f"family-graph:{str((payload.get('target') or {}).get('familyId') or '')}"), {}).get("payload"),
        )
        if execution_plan_candidate is None:
            execution_plan_candidate = _derive_generic_execution_plan_fragment(
                trace_scope,
                payload,
                provenance,
                assessment_summary,
                final_semantic_lookup.get((project_name, project_file, "family_graph_fragment", f"family-graph:{str((payload.get('target') or {}).get('familyId') or '')}"), {}).get("payload"),
            )
        if execution_plan_candidate is not None:
            maybe_reuse(
                "execution_plan_fragment",
                str(execution_plan_candidate.get("semanticKey") or ""),
                lambda: (
                    _derive_token_shop_execution_plan_fragment(
                        trace_scope,
                        payload,
                        provenance,
                        token_shop_scope,
                        token_shop_reconstruction_fragment,
                        final_semantic_lookup.get((project_name, project_file, "family_graph_fragment", f"family-graph:{str((payload.get('target') or {}).get('familyId') or '')}"), {}).get("payload"),
                    )
                    or _derive_generic_execution_plan_fragment(
                        trace_scope,
                        payload,
                        provenance,
                        assessment_summary,
                        final_semantic_lookup.get((project_name, project_file, "family_graph_fragment", f"family-graph:{str((payload.get('target') or {}).get('familyId') or '')}"), {}).get("payload"),
                    )
                ),
            )
        surface_plan_candidate = _derive_surface_plan_fragment(conn, trace_scope, payload, provenance)
        if surface_plan_candidate is not None:
            maybe_reuse(
                "surface_plan_fragment",
                str(surface_plan_candidate.get("semanticKey") or ""),
                lambda: _derive_surface_plan_fragment(conn, trace_scope, payload, provenance),
            )
        graph_plan_candidate = _derive_graph_plan_fragment(conn, trace_scope, payload, provenance)
        if graph_plan_candidate is not None:
            maybe_reuse(
                "graph_plan_fragment",
                str(graph_plan_candidate.get("semanticKey") or ""),
                lambda: _derive_graph_plan_fragment(conn, trace_scope, payload, provenance),
            )
        bridge_policy_candidate = _derive_bridge_policy_fragment(conn, trace_scope, payload, provenance)
        if bridge_policy_candidate is not None:
            maybe_reuse(
                "bridge_policy_fragment",
                str(bridge_policy_candidate.get("semanticKey") or ""),
                lambda: _derive_bridge_policy_fragment(conn, trace_scope, payload, provenance),
            )
    return recomputed_entries, final_semantic_lookup, dependency_proofs, removed_keys


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
        self.timing_span_factory = None
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
        conn.execute("PRAGMA temp_store=MEMORY")
        conn.execute(f"PRAGMA cache_size={-int(SQLITE_CACHE_SIZE_KIB)}")
        conn.execute(f"PRAGMA mmap_size={int(SQLITE_MMAP_SIZE_BYTES)}")
        conn.execute(f"PRAGMA wal_autocheckpoint={int(SQLITE_WAL_AUTOCHECKPOINT_PAGES)}")
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
                CREATE INDEX IF NOT EXISTS idx_materialized_target_bundle_latest
                    ON materialized_target_bundle_views(project_name, project_file, trace_scope, built_at DESC, request_signature DESC);

                CREATE TABLE IF NOT EXISTS materialized_resolver_target_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, trace_scope)
                );
                CREATE INDEX IF NOT EXISTS idx_materialized_resolver_target_views_latest
                    ON materialized_resolver_target_views(project_name, project_file, trace_scope, built_at DESC);

                CREATE TABLE IF NOT EXISTS materialized_subject_edge_facts (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    edge_type TEXT NOT NULL,
                    edge_status TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, trace_scope, subject_id, edge_type, edge_status)
                );
                CREATE INDEX IF NOT EXISTS idx_materialized_subject_edge_facts_scope
                    ON materialized_subject_edge_facts(project_name, project_file, trace_scope, subject_id, edge_status, built_at DESC);

                CREATE TABLE IF NOT EXISTS materialized_subject_state_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, trace_scope, subject_id)
                );
                CREATE INDEX IF NOT EXISTS idx_materialized_subject_state_views_scope
                    ON materialized_subject_state_views(project_name, project_file, trace_scope, subject_id, built_at DESC);

                CREATE TABLE IF NOT EXISTS materialized_subject_contract_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, trace_scope, subject_id)
                );
                CREATE INDEX IF NOT EXISTS idx_materialized_subject_contract_views_scope
                    ON materialized_subject_contract_views(project_name, project_file, trace_scope, subject_id, built_at DESC);

                CREATE TABLE IF NOT EXISTS materialized_acquisition_diagnostics_views (
                    project_name TEXT NOT NULL,
                    project_file TEXT NOT NULL,
                    request_signature TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    acquisition_term TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    reducer_version TEXT,
                    built_at TEXT NOT NULL,
                    PRIMARY KEY(project_name, project_file, request_signature, trace_scope, acquisition_term)
                );
                CREATE INDEX IF NOT EXISTS idx_materialized_acquisition_diagnostics_views_scope
                    ON materialized_acquisition_diagnostics_views(project_name, project_file, trace_scope, acquisition_term, built_at DESC);

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

    def _upsert_evidence_rows(self, evidence_rows: list[dict[str, Any]]) -> set[tuple[str, str, str]]:
        if not evidence_rows:
            return set()
        now = datetime.now().isoformat()
        affected_terms: set[tuple[str, str, str]] = set()
        with self.connect() as conn:
            for evidence in evidence_rows:
                aspect_kind = str(evidence["aspect_kind"] or "")
                payload_json = _json_dumps(evidence["payload"])
                equivalent_live_row = conn.execute(
                    """
                    SELECT evidence_id, source_job_id, payload_json, confidence, reducer_priority, schema_version,
                           script_name, producer_version, start_time, term
                    FROM evidence
                    WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                      AND aspect_kind = ? AND aspect_key = ?
                      AND is_valid = 1 AND invalidated_at IS NULL
                      AND payload_json = ?
                    ORDER BY source_job_id = ? DESC, evidence_id DESC
                    LIMIT 1
                    """,
                    (
                        evidence["project_name"],
                        evidence["project_file"],
                        evidence["normalized_term"],
                        aspect_kind,
                        evidence["aspect_key"],
                        payload_json,
                        evidence["source_job_id"],
                    ),
                ).fetchone()
                if (
                    equivalent_live_row is not None
                    and str(equivalent_live_row["source_job_id"] or "") != str(evidence["source_job_id"] or "")
                ):
                    continue
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
                    SELECT is_valid, invalidated_at, invalidation_reason, superseded_by,
                           payload_json, confidence, reducer_priority, schema_version,
                           script_name, producer_version, start_time, term
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
                if existing is not None:
                    if (
                        str(existing["payload_json"] or "") == payload_json
                        and float(existing["confidence"] or 0.0) == float(evidence["confidence"])
                        and int(existing["reducer_priority"] or 0) == int(evidence["reducer_priority"])
                        and int(existing["schema_version"] or 0) == int(evidence["schema_version"])
                        and str(existing["script_name"] or "") == str(evidence["script_name"] or "")
                        and str(existing["producer_version"] or "") == str(evidence["producer_version"] or "")
                        and str(existing["term"] or "") == str(evidence["term"] or "")
                        and int(existing["is_valid"] or 0) == 1
                        and existing["invalidated_at"] is None
                    ):
                        continue
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
                affected_terms.add(
                    (
                        str(evidence["project_name"] or "").strip(),
                        str(evidence["project_file"] or "").strip(),
                        str(evidence["normalized_term"] or "").strip().lower(),
                    )
                )
            self._prune_evidence_retention(conn)
        return affected_terms

    def upsert_custom_evidence_rows(self, evidence_rows: list[dict[str, Any]], rebuild_materialized: bool = True) -> None:
        affected_terms = self._upsert_evidence_rows(evidence_rows)
        if rebuild_materialized and affected_terms:
            self._rebuild_canonical_and_materialized(
                affected_terms=affected_terms
            )

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

    def _rebuild_canonical_and_materialized(
        self,
        affected_terms: set[tuple[str, str, str]] | None = None,
    ) -> None:
        with self.connect() as conn:
            normalized_terms = sorted(
                {
                    (project_name, project_file, normalized_term.lower())
                    for project_name, project_file, normalized_term in (affected_terms or set())
                    if project_name and project_file and normalized_term
                }
            )
            scoped_refresh = bool(normalized_terms)
            if scoped_refresh:
                for project_name, project_file, normalized_term in normalized_terms:
                    conn.execute(
                        """
                        DELETE FROM canonical_term_aspects
                        WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                        """,
                        (project_name, project_file, normalized_term),
                    )
                    conn.execute(
                        """
                        DELETE FROM materialized_term_views
                        WHERE project_name = ? AND project_file = ? AND normalized_term = ?
                        """,
                        (project_name, project_file, normalized_term),
                    )
                    conn.execute(
                        """
                        DELETE FROM process_term_index
                        WHERE project_name = ? AND project_file = ? AND term = ?
                        """,
                        (project_name, project_file, normalized_term),
                    )
                    conn.execute(
                        """
                        DELETE FROM graph_links
                        WHERE project_name = ? AND project_file = ? AND source_term = ?
                        """,
                        (project_name, project_file, normalized_term),
                    )
            else:
                conn.execute("DELETE FROM canonical_term_aspects")
                conn.execute("DELETE FROM materialized_term_views")
                conn.execute("DELETE FROM materialized_job_views")
                conn.execute("DELETE FROM process_exact_index")
                conn.execute("DELETE FROM process_term_index")
                conn.execute("DELETE FROM graph_links")

            aspect_rows: list[sqlite3.Row] = []
            if scoped_refresh:
                for project_name, project_file, normalized_term in normalized_terms:
                    aspect_rows.extend(
                        conn.execute(
                            """
                            SELECT * FROM evidence
                            WHERE project_name = ?
                              AND project_file = ?
                              AND normalized_term = ?
                              AND is_valid = 1
                              AND invalidated_at IS NULL
                              AND source_job_id IN (
                                SELECT job_id FROM jobs
                                WHERE mode IN ('process-project', 'native-trace-extract')
                                  AND status = 'completed'
                                  AND invalidated_at IS NULL
                              )
                            ORDER BY project_name, project_file, normalized_term, aspect_kind
                            """,
                            (project_name, project_file, normalized_term),
                        ).fetchall()
                    )
            else:
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

            if scoped_refresh:
                term_rows = conn.execute(
                    """
                    SELECT DISTINCT project_name, project_file, normalized_term
                    FROM canonical_term_aspects
                    WHERE (
                    """
                    + " OR ".join(
                        "(project_name = ? AND project_file = ? AND normalized_term = ?)"
                        for _ in normalized_terms
                    )
                    + """
                    )
                    ORDER BY project_name, project_file, normalized_term
                    """,
                    tuple(value for triple in normalized_terms for value in triple),
                ).fetchall()
            else:
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

            if scoped_refresh:
                valid_jobs = conn.execute(
                    """
                    SELECT DISTINCT jobs.*
                    FROM jobs
                    JOIN job_terms ON job_terms.job_id = jobs.job_id
                    WHERE jobs.mode = 'process-project'
                      AND jobs.status = 'completed'
                      AND jobs.invalidated_at IS NULL
                      AND (
                    """
                    + " OR ".join(
                        "(jobs.project_name = ? AND jobs.project_file = ? AND job_terms.term = ?)"
                        for _ in normalized_terms
                    )
                    + """
                      )
                    ORDER BY jobs.start_time ASC
                    """,
                    tuple(value for triple in normalized_terms for value in triple),
                ).fetchall()
                for row in valid_jobs:
                    conn.execute(
                        """
                        DELETE FROM process_exact_index
                        WHERE project_name = ? AND project_file = ? AND signature = ?
                        """,
                        (
                            str(row["project_name"] or ""),
                            str(row["project_file"] or ""),
                            str(row["signature"] or ""),
                        ),
                    )
                    conn.execute(
                        """
                        DELETE FROM materialized_job_views
                        WHERE project_name = ? AND project_file = ? AND signature = ?
                        """,
                        (
                            str(row["project_name"] or ""),
                            str(row["project_file"] or ""),
                            str(row["signature"] or ""),
                        ),
                    )
            else:
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

    def find_live_evidence_row(
        self,
        project_name: str,
        project_file: str,
        normalized_term: str,
        aspect_kind: str,
        aspect_key: str = "__self__",
        *,
        source_job_id: str = "",
        producer_version: str = "",
    ) -> dict[str, Any] | None:
        self.sync_from_jobs_if_needed()
        normalized_term = str(normalized_term or "").strip().lower()
        aspect_kind = str(aspect_kind or "").strip()
        aspect_key = str(aspect_key or "").strip() or "__self__"
        if not normalized_term or not aspect_kind:
            return None
        clauses = [
            "project_name = ?",
            "project_file = ?",
            "normalized_term = ?",
            "aspect_kind = ?",
            "aspect_key = ?",
            "is_valid = 1",
            "invalidated_at IS NULL",
        ]
        params: list[Any] = [
            project_name,
            project_file,
            normalized_term,
            aspect_kind,
            aspect_key,
        ]
        if source_job_id:
            clauses.append("source_job_id = ?")
            params.append(str(source_job_id))
        if producer_version:
            clauses.append("producer_version = ?")
            params.append(str(producer_version))
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT *
                FROM evidence
                WHERE {}
                ORDER BY evidence_id DESC
                LIMIT 1
                """.format(" AND ".join(clauses)),
                tuple(params),
            ).fetchone()
        if row is None:
            return None
        return {
            "evidenceId": int(row["evidence_id"]),
            "projectName": str(row["project_name"] or ""),
            "projectFile": str(row["project_file"] or ""),
            "normalizedTerm": str(row["normalized_term"] or ""),
            "term": str(row["term"] or ""),
            "aspectKind": str(row["aspect_kind"] or ""),
            "aspectKey": str(row["aspect_key"] or ""),
            "sourceJobId": str(row["source_job_id"] or ""),
            "payload": _json_loads(row["payload_json"], {}),
            "confidence": float(row["confidence"] or 0.0),
            "reducerPriority": int(row["reducer_priority"] or 0),
            "schemaVersion": int(row["schema_version"] or 0),
            "scriptName": str(row["script_name"] or ""),
            "producerVersion": str(row["producer_version"] or ""),
            "startTime": str(row["start_time"] or ""),
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
        request_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self.sync_from_jobs_if_needed()
        requested_terms = [str(term).strip() for term in requested_terms if str(term).strip()]
        search_terms = [str(term).strip() for term in search_terms if str(term).strip()]
        all_terms = _dedupe_sequence([*requested_terms, *search_terms])
        request_context = dict(request_context or {})
        term_views: list[dict[str, Any]] = []
        provenance: dict[str, Any] = {
            "requestedTerms": requested_terms,
            "searchTerms": search_terms,
            "requestContext": request_context,
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
            "requestContext": request_context,
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

    def find_latest_materialized_native_trace_view_for_relation(
        self,
        project_name: str,
        project_file: str,
        *,
        subject_id: str,
        relation_scope: str = "",
        required_seam_ids: list[str] | None = None,
    ) -> dict[str, Any] | None:
        self.sync_from_jobs_if_needed()
        subject_id = str(subject_id or "").strip()
        relation_scope = str(relation_scope or "").strip()
        required_seam_ids = _unique_strings([str(value).strip() for value in (required_seam_ids or []) if str(value).strip()])
        if not subject_id:
            return None
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM materialized_native_trace_views
                WHERE project_name = ? AND project_file = ?
                ORDER BY built_at DESC
                LIMIT 128
                """,
                (project_name, project_file),
            ).fetchall()
        for row in rows:
            payload = _json_loads(row["payload_json"], {})
            provenance = _json_loads(row["provenance_json"], {})
            request_context = dict(payload.get("requestContext") or provenance.get("requestContext") or {})
            if str(request_context.get("coverageMode") or "").strip() != "relation-shaped":
                continue
            if str(request_context.get("subjectId") or "").strip() != subject_id:
                continue
            if relation_scope and str(request_context.get("relationScope") or "").strip() != relation_scope:
                continue
            row_required_seams = _unique_strings(
                [str(value).strip() for value in (request_context.get("requiredCoverageSeamIds") or []) if str(value).strip()]
            )
            if required_seam_ids and any(seam_id not in row_required_seams for seam_id in required_seam_ids):
                continue
            return {
                "requestedTerms": _json_loads(row["requested_terms_json"], []),
                "searchTerms": _json_loads(row["search_terms_json"], []),
                "payload": payload,
                "provenance": provenance,
                "reducerVersion": str(row["reducer_version"] or ""),
                "builtAt": str(row["built_at"]),
            }
        return None

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

    def _find_contract_term_evidence(
        self,
        project_name: str,
        project_file: str,
        term: str,
    ) -> dict[str, Any]:
        normalized_term = str(term or "").strip()
        term_view = self.find_canonical_term_view(project_name, project_file, normalized_term)
        graph_refs = self.find_graph_backfill(project_name, project_file, normalized_term)
        payload_hits: list[dict[str, Any]] = []
        literal_sources: list[str] = []
        literal_pattern = f"%{normalized_term}%"
        with self.connect() as conn:
            evidence_count = int(
                (
                    conn.execute(
                        """
                        SELECT COUNT(*) AS c
                        FROM evidence
                        WHERE project_name = ?
                          AND project_file = ?
                          AND is_valid = 1
                          AND invalidated_at IS NULL
                          AND payload_json LIKE ?
                        """,
                        (project_name, project_file, literal_pattern),
                    ).fetchone()
                    or {"c": 0}
                )["c"]
            )
            if evidence_count:
                literal_sources.append("evidence-payload")
                payload_hits.append(
                    {
                        "source": "evidence-payload",
                        "count": evidence_count,
                    }
                )
            trace_count = int(
                (
                    conn.execute(
                        """
                        SELECT COUNT(*) AS c
                        FROM trace_fragments
                        WHERE project_name = ?
                          AND project_file = ?
                          AND is_valid = 1
                          AND invalidated_at IS NULL
                          AND fragment_kind NOT IN ({excluded_fragment_kinds})
                          AND payload_json LIKE ?
                        """.format(
                            excluded_fragment_kinds=",".join("?" for _ in CONTRACT_LITERAL_EXCLUDED_TRACE_FRAGMENT_KINDS)
                        ),
                        (
                            project_name,
                            project_file,
                            *CONTRACT_LITERAL_EXCLUDED_TRACE_FRAGMENT_KINDS,
                            literal_pattern,
                        ),
                    ).fetchone()
                    or {"c": 0}
                )["c"]
            )
            if trace_count:
                literal_sources.append("trace-fragment-payload")
                payload_hits.append(
                    {
                        "source": "trace-fragment-payload",
                        "count": trace_count,
                    }
                )
            canonical_trace_count = int(
                (
                    conn.execute(
                        """
                        SELECT COUNT(*) AS c
                        FROM canonical_trace_fragments
                        WHERE project_name = ?
                          AND project_file = ?
                          AND fragment_kind NOT IN ({excluded_fragment_kinds})
                          AND canonical_payload_json LIKE ?
                        """.format(
                            excluded_fragment_kinds=",".join("?" for _ in CONTRACT_LITERAL_EXCLUDED_TRACE_FRAGMENT_KINDS)
                        ),
                        (
                            project_name,
                            project_file,
                            *CONTRACT_LITERAL_EXCLUDED_TRACE_FRAGMENT_KINDS,
                            literal_pattern,
                        ),
                    ).fetchone()
                    or {"c": 0}
                )["c"]
            )
            if canonical_trace_count:
                literal_sources.append("canonical-trace-fragment-payload")
                payload_hits.append(
                    {
                        "source": "canonical-trace-fragment-payload",
                        "count": canonical_trace_count,
                    }
                )
        return {
            "term": normalized_term,
            "found": bool(term_view) or bool(graph_refs) or bool(payload_hits),
            "sourceIds": _unique_strings(
                [
                    "canonical-term-view" if term_view else "",
                    "graph-links" if graph_refs else "",
                    *literal_sources,
                ]
            ),
            "graphRefs": graph_refs[:6],
            "payloadHits": payload_hits[:6],
        }

    def _find_subject_contract_term_evidence(
        self,
        project_name: str,
        project_file: str,
        term: str,
    ) -> dict[str, Any]:
        candidate_pairs: list[tuple[str, str]] = []
        for candidate in [
            (str(project_name or "").strip(), str(project_file or "").strip()),
            ("cifi-full", "libil2cpp.so"),
        ]:
            if candidate[0] and candidate[1] and candidate not in candidate_pairs:
                candidate_pairs.append(candidate)

        evidence_rows = [
            self._find_contract_term_evidence(candidate_project, candidate_file, term)
            for candidate_project, candidate_file in candidate_pairs
        ]
        project_files = _unique_strings(
            [
                f"{candidate_project}/{candidate_file}"
                for (candidate_project, candidate_file), evidence in zip(candidate_pairs, evidence_rows)
                if bool(evidence.get("found"))
            ]
        )
        merged_graph_refs: list[dict[str, Any]] = []
        seen_graph_refs: set[str] = set()
        for evidence in evidence_rows:
            for graph_ref in (evidence.get("graphRefs") or []):
                if not isinstance(graph_ref, dict):
                    continue
                serialized = _json_dumps(graph_ref)
                if serialized in seen_graph_refs:
                    continue
                seen_graph_refs.add(serialized)
                merged_graph_refs.append(dict(graph_ref))
        merged_payload_hits: list[dict[str, Any]] = []
        seen_payload_hits: set[str] = set()
        for evidence in evidence_rows:
            for payload_hit in (evidence.get("payloadHits") or []):
                if not isinstance(payload_hit, dict):
                    continue
                serialized = _json_dumps(payload_hit)
                if serialized in seen_payload_hits:
                    continue
                seen_payload_hits.add(serialized)
                merged_payload_hits.append(dict(payload_hit))
        return {
            "term": str(term or "").strip(),
            "found": any(bool(evidence.get("found")) for evidence in evidence_rows),
            "sourceIds": _unique_strings(
                [
                    source_id
                    for evidence in evidence_rows
                    for source_id in (evidence.get("sourceIds") or [])
                ]
            ),
            "graphRefs": merged_graph_refs[:6],
            "payloadHits": merged_payload_hits[:6],
            "projectFiles": project_files,
        }

    def _derive_token_shop_shared_contract_fields(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        subject_state: dict[str, Any],
        resolver_payload: dict[str, Any],
        support_summary: dict[str, Any],
        default_blocked_input_reason: str | None,
    ) -> dict[str, Any]:
        family_id = str(resolver_payload.get("familyId") or "").strip()
        subject_id = str(subject_state.get("subjectId") or "").strip()
        if family_id != "token-shop" and not subject_id.startswith(("row:", "range:token-shop:")):
            return {
                "groundedFields": {},
                "supportSummary": {},
                "provenanceSummary": {},
                "blockedInputReasons": {},
            }
        repo_root = Path(__file__).resolve().parents[2]
        tokenium_naming_clues = (
            _load_json(repo_root / "data" / "tokenium-naming-clues.json")
            if trace_scope == "token-shop-daily-tokenium-family"
            else None
        ) or {}
        daily_tokenium_lane_clues = (
            _load_json(repo_root / "data" / "daily-tokenium-lane-clues.json")
            if trace_scope == "token-shop-daily-tokenium-family"
            else None
        ) or {}

        lane_specs = {
            "tokeniumNaming": {
                "labels": {
                    "resourceLabel": "Resource_Tokenium",
                    "academyLabel": "Aca.Tokenium553",
                    "tokenShellLabel": "CostBox-Tokens",
                    "tokeniumShellLabel": "CostBox-Tokenium",
                },
                "blockedReason": None,
            },
            "tokenBankController": {
                "labels": {
                    "claimMethod": "ClaimBankedTokens",
                    "fillMethod": "SetBankFill",
                    "fillField": "BankFill",
                    "descriptionShell": "TokenBankDescriptionText",
                    "notificationHook": "CheckTokenClaimNotification",
                },
                "adjacentTerms": [
                    "get_TokenBankCap",
                    "get_ClaimableBankTokens",
                    "IncreaseBankedTokens",
                    "TokenShopButtonNotification",
                ],
                "blockedReason": default_blocked_input_reason,
            },
            "tokenBankState": {
                "labels": {
                    "claimMethod": "ClaimBankedTokens",
                    "capMethod": "get_TokenBankCap",
                    "displayShell": "BigStatisticPrefab.TokenBankCap",
                    "loopHandler": "TextHandlerLoopMods",
                    "loopHook": "SetLM244BonusText",
                    "cloudSaveShell": "CloudSavePlayerProfile",
                    "cloudSaveInfoRoutine": "GetCurrentSaveFileInfo",
                    "cloudSaveProfileRoutine": "GetPlayerProfileInfo",
                    "cloudSaveStateMachine": "<CloudSavePlayerProfile>d__24",
                },
                "blockedReason": default_blocked_input_reason,
            },
            "dailyTokeniumLane": {
                "labels": {
                    "ownerFamilyLabel": "SpaceAcademy",
                    "academyController": "SpaceAcademyMain",
                    "textHandler": "TextHandlerSpaceAcademy",
                    "missionFamilyLabel": "FarmMissions",
                    "loopHook": "SetLM244BonusText",
                    "purchaseHook": "BuyLM244",
                    "finalBonusHook": "FinalDailyTokenBonus",
                    "purchaseOwner": "BuyCollectorDevice",
                    "premiumCapBonus": "CollectorCapBonus",
                    "premiumMatsBonus": "CollectorMatsBonus",
                    "progressString": "0 / 2000 Daily Tokenium (from blue farm missions)",
                    "capDescriptionString": "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
                    "collectorPackDescriptionString": "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu",
                },
                "adjacentTerms": [
                    "Resource_Tokenium",
                    "CostBox-Tokens",
                    "CostBox-Tokenium",
                    "CollectorDevice",
                ],
                "blockedReason": default_blocked_input_reason,
            },
            "tokenBankFormula": {
                "labels": {
                    "capAccessor": "get_FinalTokenBankCap",
                    "fillAccessor": "get_FinalTokenBankFillSpeed",
                    "capField": "<FinalTokenBankCap>k__BackingField",
                    "fillField": "<FinalTokenBankFillSpeed>k__BackingField",
                },
                "adjacentTerms": [
                    "ClaimBankedTokens",
                ],
                "excludedTerms": [
                    "PlayerProfileData",
                    "CloudSavePlayerProfile",
                ],
                "exclusionBlockedReason": "missing-db-derived-context-clearance:tokenBankFormula:PlayerProfileData,CloudSavePlayerProfile",
                "blockedReason": default_blocked_input_reason,
            },
        }

        shared_grounded_fields: dict[str, Any] = {}
        shared_support_summary: dict[str, Any] = {}
        shared_provenance_summary: dict[str, Any] = {}
        shared_blocked_reasons: dict[str, Any] = {}

        for lane_id, lane_spec in lane_specs.items():
            required_labels = dict(lane_spec.get("labels") or {})
            adjacent_terms = [str(value).strip() for value in (lane_spec.get("adjacentTerms") or []) if str(value).strip()]
            evidence_by_term = {
                term: self._find_subject_contract_term_evidence(project_name, project_file, term)
                for term in [*required_labels.values(), *adjacent_terms]
            }
            found_terms = [
                term
                for term, evidence in evidence_by_term.items()
                if bool(evidence.get("found"))
            ]
            missing_terms = [
                term
                for term, evidence in evidence_by_term.items()
                if not bool(evidence.get("found"))
            ]

            lane_fields = {
                field_name: term
                for field_name, term in required_labels.items()
                if bool((evidence_by_term.get(term) or {}).get("found"))
            }
            if adjacent_terms:
                lane_fields["adjacentTerms"] = [
                    term for term in adjacent_terms if bool((evidence_by_term.get(term) or {}).get("found"))
                ]
            excluded_terms = [
                str(value).strip()
                for value in (lane_spec.get("excludedTerms") or [])
                if str(value).strip()
            ]
            exclusion_overlap: list[str] = []
            exclusion_clear = True
            if excluded_terms:
                excluded_lookup = {value.lower(): value for value in excluded_terms}
                graph_source_terms = _unique_strings(
                    [
                        str(graph_ref.get("sourceTerm") or "").strip()
                        for evidence in evidence_by_term.values()
                        for graph_ref in (evidence.get("graphRefs") or [])
                        if isinstance(graph_ref, dict) and str(graph_ref.get("sourceTerm") or "").strip()
                    ]
                )
                exclusion_overlap = _unique_strings(
                    [
                        excluded_lookup[source_term.lower()]
                        for source_term in graph_source_terms
                        if source_term.lower() in excluded_lookup
                    ]
                )
                exclusion_clear = not exclusion_overlap
                lane_fields["excludedTerms"] = excluded_terms
                lane_fields["saveFamilyOverlapClear"] = exclusion_clear
            fallback_found_terms: list[str] = []
            fallback_source_ids: list[str] = []
            fallback_project_files: list[str] = []
            if trace_scope == "token-shop-daily-tokenium-family" and lane_id == "tokeniumNaming" and not lane_fields:
                tokenium_asset_names = dict(tokenium_naming_clues.get("assetNames") or {})
                level0_shells = {
                    str(value).strip()
                    for value in (tokenium_naming_clues.get("level0Shells") or [])
                    if str(value).strip()
                }
                fallback_checks = {
                    "resourceLabel": "Resource_Tokenium"
                    if "Resource_Tokenium" in {str(value).strip() for value in (tokenium_asset_names.get("resourceIcons") or []) if str(value).strip()}
                    else "",
                    "academyLabel": "Aca.Tokenium553"
                    if "Aca.Tokenium553" in {str(value).strip() for value in (tokenium_asset_names.get("academySprites") or []) if str(value).strip()}
                    else "",
                    "tokenShellLabel": "CostBox-Tokens" if "CostBox-Tokens" in level0_shells else "",
                    "tokeniumShellLabel": "CostBox-Tokenium" if "CostBox-Tokenium" in level0_shells else "",
                }
                lane_fields = {
                    field_name: term
                    for field_name, term in fallback_checks.items()
                    if term
                }
                fallback_found_terms = list(lane_fields.values())
                if lane_fields:
                    fallback_source_ids = ["repo-tokenium-naming-clues"]
                    fallback_project_files = ["data/tokenium-naming-clues.json"]
            if trace_scope == "token-shop-daily-tokenium-family" and lane_id == "dailyTokeniumLane":
                owner_family_clues = {
                    str(value).strip()
                    for value in (daily_tokenium_lane_clues.get("ownerFamilyClues") or [])
                    if str(value).strip()
                }
                modifier_clues = {
                    str(value).strip()
                    for value in (daily_tokenium_lane_clues.get("modifierClues") or [])
                    if str(value).strip()
                }
                premium_modifier_clues = {
                    str(value).strip()
                    for value in (daily_tokenium_lane_clues.get("premiumModifierClues") or [])
                    if str(value).strip()
                }
                player_facing_strings = {
                    str(value).strip()
                    for value in (daily_tokenium_lane_clues.get("playerFacingStrings") or [])
                    if str(value).strip()
                }
                fallback_lane_fields = {
                    **lane_fields,
                    **(
                        {"ownerFamilyLabel": "SpaceAcademy"}
                        if "SpaceAcademy" in owner_family_clues
                        else {}
                    ),
                    **(
                        {"academyController": "SpaceAcademyMain"}
                        if "SpaceAcademyMain" in owner_family_clues
                        else {}
                    ),
                    **(
                        {"textHandler": "TextHandlerSpaceAcademy"}
                        if "TextHandlerSpaceAcademy" in owner_family_clues
                        else {}
                    ),
                    **(
                        {"missionFamilyLabel": "FarmMissions"}
                        if "FarmMissions" in owner_family_clues
                        else {}
                    ),
                    **({"loopHook": "SetLM244BonusText"} if "SetLM244BonusText" in modifier_clues else {}),
                    **({"purchaseHook": "BuyLM244"} if "BuyLM244" in modifier_clues else {}),
                    **({"finalBonusHook": "FinalDailyTokenBonus"} if "FinalDailyTokenBonus" in modifier_clues else {}),
                    **(
                        {"purchaseOwner": "BuyCollectorDevice"}
                        if "BuyCollectorDevice" in premium_modifier_clues
                        else {}
                    ),
                    **(
                        {"premiumCapBonus": "CollectorCapBonus"}
                        if "CollectorCapBonus" in premium_modifier_clues
                        else {}
                    ),
                    **(
                        {"premiumMatsBonus": "CollectorMatsBonus"}
                        if "CollectorMatsBonus" in premium_modifier_clues
                        else {}
                    ),
                    **(
                        {"progressString": "0 / 2000 Daily Tokenium (from blue farm missions)"}
                        if "0 / 2000 Daily Tokenium (from blue farm missions)" in player_facing_strings
                        else {}
                    ),
                    **(
                        {
                            "capDescriptionString": "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)"
                        }
                        if "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)"
                        in player_facing_strings
                        else {}
                    ),
                    **(
                        {
                            "collectorPackDescriptionString": "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
                        }
                        if "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
                        in player_facing_strings
                        else {}
                    ),
                }
                if len(fallback_lane_fields) > len(lane_fields):
                    lane_fields = fallback_lane_fields
                    fallback_found_terms = _unique_strings(
                        [
                            *fallback_found_terms,
                            *[
                                str(value).strip()
                                for field_name, value in lane_fields.items()
                                if field_name != "adjacentTerms" and field_name not in {"excludedTerms", "saveFamilyOverlapClear"} and str(value).strip()
                            ],
                        ]
                    )
                    fallback_source_ids = _unique_strings([*fallback_source_ids, "repo-daily-tokenium-lane-clues"])
                    fallback_project_files = _unique_strings([*fallback_project_files, "data/daily-tokenium-lane-clues.json"])
            if lane_fields:
                shared_grounded_fields[lane_id] = lane_fields
                if fallback_found_terms:
                    found_terms = _unique_strings([*found_terms, *fallback_found_terms])
                    missing_terms = [
                        term
                        for term in missing_terms
                        if term not in set(fallback_found_terms)
                    ]

            source_ids = _unique_strings(
                [
                    source_id
                    for evidence in evidence_by_term.values()
                    for source_id in (evidence.get("sourceIds") or [])
                ]
            )
            if fallback_source_ids:
                source_ids = _unique_strings([*source_ids, *fallback_source_ids])
            project_files = _unique_strings(
                [
                    project_file_label
                    for evidence in evidence_by_term.values()
                    for project_file_label in (evidence.get("projectFiles") or [])
                ]
            )
            if fallback_project_files:
                project_files = _unique_strings([*project_files, *fallback_project_files])
            graph_refs = [
                dict(graph_ref)
                for evidence in evidence_by_term.values()
                for graph_ref in (evidence.get("graphRefs") or [])
                if isinstance(graph_ref, dict)
            ]
            shared_support_summary[lane_id] = {
                "foundTerms": found_terms,
                "missingTerms": missing_terms,
                "sourceIds": source_ids,
                "graphRefs": graph_refs[:8],
                "proofCount": len(found_terms),
                "supportSurfaceIds": list(support_summary.get("supportSurfaceIds") or []),
                "supportSurfaceLabels": list(support_summary.get("supportSurfaceLabels") or []),
                "projectFiles": project_files,
                "excludedTerms": excluded_terms,
                "excludedTermOverlap": exclusion_overlap,
                "saveFamilyOverlapClear": exclusion_clear if excluded_terms else None,
            }
            shared_provenance_summary[lane_id] = [
                {
                    "term": term,
                    "projectFiles": list((evidence_by_term.get(term) or {}).get("projectFiles") or []),
                    "sourceIds": list((evidence_by_term.get(term) or {}).get("sourceIds") or []),
                    "graphRefs": list((evidence_by_term.get(term) or {}).get("graphRefs") or [])[:4],
                }
                for term in found_terms
            ]
            if missing_terms:
                shared_blocked_reasons[lane_id] = (
                    f"missing-db-term-evidence:{lane_id}:{','.join(missing_terms)}"
                )
            elif excluded_terms and not exclusion_clear:
                shared_blocked_reasons[lane_id] = (
                    str(lane_spec.get("exclusionBlockedReason") or "").strip()
                    or f"missing-db-derived-context-clearance:{lane_id}:{','.join(excluded_terms)}"
                )
            else:
                shared_blocked_reasons[lane_id] = (
                    str(lane_spec.get("blockedReason") or "").strip() or None
                )

        return {
            "groundedFields": shared_grounded_fields,
            "supportSummary": shared_support_summary,
            "provenanceSummary": shared_provenance_summary,
            "blockedInputReasons": shared_blocked_reasons,
        }

    def _select_strongest_token_shop_lane_contract(
        self,
        project_name: str,
        project_file: str,
        lane_id: str,
        current_subject_state: dict[str, Any],
        current_shared_lane_contract: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        current_shared_lane_contract = dict(current_shared_lane_contract or {})
        current_grounded_fields = dict(
            (((current_shared_lane_contract.get("groundedFields") or {}).get(lane_id)) or {})
        )
        current_support_summary = dict(
            (((current_shared_lane_contract.get("supportSummary") or {}).get(lane_id)) or {})
        )
        current_provenance_summary = list(
            (((current_shared_lane_contract.get("provenanceSummary") or {}).get(lane_id)) or [])
        )
        current_blocked_reason = str(
            (((current_shared_lane_contract.get("blockedInputReasons") or {}).get(lane_id)) or "")
        ).strip() or None
        candidates: list[dict[str, Any]] = [
            {
                "subjectId": str(current_subject_state.get("subjectId") or "").strip(),
                "subjectKind": str(current_subject_state.get("subjectKind") or "").strip(),
                "nextSeam": dict(current_subject_state.get("nextSeam") or {}),
                "knownEdges": list(current_subject_state.get("knownEdges") or []),
                "missingEdges": list(current_subject_state.get("missingEdges") or []),
                "blockedEdges": list(current_subject_state.get("blockedEdges") or []),
                "laneGroundedFields": current_grounded_fields,
                "laneSupportSummary": current_support_summary,
                "laneProvenanceSummary": current_provenance_summary,
                "laneBlockedReason": current_blocked_reason,
                "source": "current-subject-state",
            }
        ]
        for state_row in self.list_latest_materialized_subject_state_views(project_name, project_file):
            payload = dict(state_row.get("payload") or {})
            subject_id = str(payload.get("subjectId") or "").strip()
            if not subject_id.startswith(("row:", "range:token-shop:")):
                continue
            candidates.append(
                {
                    "subjectId": subject_id,
                    "subjectKind": str(payload.get("subjectKind") or "").strip(),
                    "nextSeam": dict(payload.get("nextSeam") or {}),
                    "knownEdges": list(payload.get("knownEdges") or []),
                    "missingEdges": list(payload.get("missingEdges") or []),
                    "blockedEdges": list(payload.get("blockedEdges") or []),
                    "source": "materialized-subject-state-view",
                }
            )
        for contract_row in self.list_latest_materialized_subject_contract_views(project_name, project_file):
            payload = dict(contract_row.get("payload") or {})
            subject_id = str(payload.get("subjectId") or "").strip()
            if not subject_id.startswith(("row:", "range:token-shop:")):
                continue
            lane_grounded_fields = dict((((payload.get("groundedFields") or {}).get(lane_id)) or {}))
            lane_support_summary = dict((((payload.get("supportSummary") or {}).get("sharedLanes") or {}).get(lane_id)) or {})
            lane_provenance_summary = list((((payload.get("provenanceSummary") or {}).get("sharedLanes") or {}).get(lane_id)) or [])
            lane_blocked_reason = str((((payload.get("blockedInputReasons") or {}).get(lane_id)) or "")).strip() or None
            if not lane_grounded_fields and not lane_support_summary and not lane_provenance_summary and lane_blocked_reason is None:
                continue
            candidates.append(
                {
                    "subjectId": subject_id,
                    "subjectKind": str(payload.get("subjectKind") or "").strip(),
                    "nextSeam": {},
                    "knownEdges": [],
                    "missingEdges": [],
                    "blockedEdges": [],
                    "laneGroundedFields": lane_grounded_fields,
                    "laneSupportSummary": lane_support_summary,
                    "laneProvenanceSummary": lane_provenance_summary,
                    "laneBlockedReason": lane_blocked_reason,
                    "builtAt": str(contract_row.get("builtAt") or ""),
                    "source": "materialized-subject-contract-view",
                }
            )

        def _lane_score(candidate: dict[str, Any]) -> tuple[int, int, int, int, int, int, int, str]:
            subject_kind = str(candidate.get("subjectKind") or "").strip()
            next_seam = dict(candidate.get("nextSeam") or {})
            seam_status = str(next_seam.get("status") or "").strip()
            known_edges = [str(value).strip() for value in (candidate.get("knownEdges") or []) if str(value).strip()]
            missing_edges = [str(value).strip() for value in (candidate.get("missingEdges") or []) if str(value).strip()]
            blocked_edges = [str(value).strip() for value in (candidate.get("blockedEdges") or []) if str(value).strip()]
            lane_grounded_fields = dict(candidate.get("laneGroundedFields") or {})
            lane_support_summary = dict(candidate.get("laneSupportSummary") or {})
            lane_found_terms = [str(value).strip() for value in (lane_support_summary.get("foundTerms") or []) if str(value).strip()]
            lane_blocked_reason = str(candidate.get("laneBlockedReason") or "").strip()
            return (
                1 if not lane_blocked_reason else 0,
                len(lane_grounded_fields),
                len(lane_found_terms),
                1 if seam_status == "clear" else 0,
                1 if subject_kind == "range-family" else 0,
                len(known_edges),
                -len(blocked_edges),
                -len(missing_edges),
                str(candidate.get("builtAt") or ""),
            )

        signal_candidates = [
            candidate
            for candidate in candidates
            if (
                bool(candidate.get("laneGroundedFields"))
                or bool(candidate.get("laneSupportSummary"))
                or bool(candidate.get("laneProvenanceSummary"))
                or candidate.get("laneBlockedReason") is not None
            )
        ]
        selected = max(signal_candidates or candidates, key=_lane_score)
        next_seam = dict(selected.get("nextSeam") or {})
        blocked_reason = str(selected.get("laneBlockedReason") or "").strip() or None
        if blocked_reason is None:
            blocked_reason = (
                str(next_seam.get("reason") or "").strip() or None
                if str(next_seam.get("status") or "").strip() != "clear"
                else None
            )
        return {
            "selectedSubjectId": str(selected.get("subjectId") or "").strip() or None,
            "selectedSubjectKind": str(selected.get("subjectKind") or "").strip() or None,
            "selectionSource": str(selected.get("source") or "").strip() or None,
            "blockedReason": blocked_reason,
            "groundedFields": dict(selected.get("laneGroundedFields") or {}),
            "supportSummary": dict(selected.get("laneSupportSummary") or {}),
            "provenanceSummary": list(selected.get("laneProvenanceSummary") or []),
        }

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
        write_span = self.timing_span_factory("dbWrites") if callable(self.timing_span_factory) else nullcontext()
        with write_span, self.connect() as conn:
            for row in fragment_rows:
                payload_json = _json_dumps(row["payload"])
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
                    SELECT is_valid, invalidated_at, invalidation_reason, superseded_by,
                           payload_json, confidence, reducer_priority, schema_version,
                           script_name, producer_version, start_time
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
                if existing is not None:
                    existing_payload_json = str(existing["payload_json"] or "")
                    if (
                        existing_payload_json == payload_json
                        and float(existing["confidence"] or 0.0) == float(row["confidence"])
                        and int(existing["reducer_priority"] or 0) == int(row["reducer_priority"])
                        and int(existing["schema_version"] or 0) == int(row["schema_version"])
                        and str(existing["script_name"] or "") == str(row["script_name"] or "")
                        and str(existing["producer_version"] or "") == str(row["producer_version"] or "")
                        and int(existing["is_valid"] or 0) == 1
                        and existing["invalidated_at"] is None
                    ):
                        continue
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
                        payload_json,
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
            self._prune_trace_retention(
                conn,
                trace_scopes=[trace_scope],
            )
        rebuild_span = self.timing_span_factory("reducerMaterializerRebuild") if callable(self.timing_span_factory) else nullcontext()
        with rebuild_span:
            self.rebuild_trace_views(trace_scopes=[trace_scope])

    def rebuild_trace_views(self, trace_scopes: list[str] | None = None) -> None:
        with self.connect() as conn:
            _normalize_live_trace_fragment_payloads(conn)
            requested_scopes = sorted({str(scope or "").strip() for scope in (trace_scopes or []) if str(scope or "").strip()})
            scoped_refresh = bool(requested_scopes)
            if scoped_refresh:
                placeholders = ",".join("?" for _ in requested_scopes)
                rows = conn.execute(
                    f"""
                    SELECT * FROM trace_fragments
                    WHERE is_valid = 1
                      AND invalidated_at IS NULL
                      AND trace_scope IN ({placeholders})
                    ORDER BY project_name, project_file, trace_scope, request_signature, fragment_kind, updated_at DESC
                    """,
                    tuple(requested_scopes),
                ).fetchall()
            else:
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
            previous_canonical_trace_lookup: dict[tuple[str, str, str, str, str, str], dict[str, Any]] = {}
            previous_materialized_trace_lookup: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            previous_system_trace_lookup: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            previous_semantic_lookup: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            previous_target_bundle_lookup: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            if scoped_refresh:
                canonical_trace_rows = conn.execute(
                    f"""
                    SELECT *
                    FROM canonical_trace_fragments
                    WHERE trace_scope IN ({placeholders})
                    """,
                    tuple(requested_scopes),
                ).fetchall()
                for row in canonical_trace_rows:
                    key = (
                        str(row["project_name"]),
                        str(row["project_file"]),
                        str(row["trace_scope"]),
                        str(row["request_signature"]),
                        str(row["fragment_kind"]),
                        str(row["fragment_key"]),
                    )
                    previous_canonical_trace_lookup[key] = {
                        "payload": _json_loads(row["canonical_payload_json"], {}),
                        "alternates": _json_loads(row["alternate_payloads_json"], []),
                        "provenance": _json_loads(row["provenance_json"], {}),
                        "updatedAt": str(row["updated_at"] or ""),
                    }
                trace_view_rows = conn.execute(
                    f"""
                    SELECT *
                    FROM materialized_trace_views
                    WHERE trace_scope IN ({placeholders})
                    """,
                    tuple(requested_scopes),
                ).fetchall()
                for row in trace_view_rows:
                    key = (
                        str(row["project_name"]),
                        str(row["project_file"]),
                        str(row["trace_scope"]),
                        str(row["request_signature"]),
                    )
                    previous_materialized_trace_lookup[key] = {
                        "payload": _json_loads(row["payload_json"], {}),
                        "provenance": _json_loads(row["provenance_json"], {}),
                        "reducerVersion": str(row["reducer_version"] or ""),
                        "builtAt": str(row["built_at"] or ""),
                    }
                system_trace_rows = conn.execute(
                    f"""
                    SELECT *
                    FROM canonical_system_trace_views
                    WHERE trace_scope IN ({placeholders})
                    """,
                    tuple(requested_scopes),
                ).fetchall()
                for row in system_trace_rows:
                    key = (
                        str(row["project_name"]),
                        str(row["project_file"]),
                        str(row["trace_scope"]),
                        str(row["request_signature"]),
                    )
                    previous_system_trace_lookup[key] = {
                        "payload": _json_loads(row["payload_json"], {}),
                        "provenance": _json_loads(row["provenance_json"], {}),
                        "reducerVersion": str(row["reducer_version"] or ""),
                        "builtAt": str(row["built_at"] or ""),
                    }
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
                selection_proof = _build_canonical_trace_selection_proof(ordered, canonical_payload, alternates)
                provenance["selectionProof"] = {
                    "reuseDecision": "recomputed",
                    **selection_proof,
                }
                previous_canonical_entry = previous_canonical_trace_lookup.get(key)
                if scoped_refresh:
                    previous_selection_proof = dict((previous_canonical_entry or {}).get("provenance") or {}).get("selectionProof") or {}
                    if previous_canonical_entry and previous_selection_proof.get("combinedHash") == selection_proof.get("combinedHash"):
                        canonical_payload = dict(previous_canonical_entry.get("payload") or {})
                        alternates = list(previous_canonical_entry.get("alternates") or [])
                        provenance = dict(previous_canonical_entry.get("provenance") or {})
                    else:
                        if previous_canonical_entry is not None:
                            conn.execute(
                                """
                                DELETE FROM canonical_trace_fragments
                                WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                                  AND fragment_kind = ? AND fragment_key = ?
                                """,
                                key,
                            )
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
                else:
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
                    {"payload": {}, "provenance": {}, "selectionProofs": {}},
                )
                trace_group["payload"][fragment_kind] = canonical_payload
                trace_group["provenance"][fragment_kind] = provenance
                trace_group["selectionProofs"][f"{fragment_kind}:{fragment_key}"] = dict(provenance.get("selectionProof") or {})
                if fragment_kind in SYSTEM_TRACE_FRAGMENT_KINDS and fragment_key != "__self__":
                    semantic_groups.setdefault((project_name, project_file, fragment_kind, fragment_key), []).extend(fragment_rows)

            if scoped_refresh:
                current_canonical_trace_keys = set(grouped.keys())
                for key in sorted(set(previous_canonical_trace_lookup.keys()) - current_canonical_trace_keys):
                    conn.execute(
                        """
                        DELETE FROM canonical_trace_fragments
                        WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                          AND fragment_kind = ? AND fragment_key = ?
                        """,
                        key,
                    )

            if scoped_refresh and trace_groups:
                project_pairs = sorted({(project_name, project_file) for project_name, project_file, _, _ in trace_groups.keys()})
                for project_name, project_file in project_pairs:
                    rows = conn.execute(
                        """
                        SELECT fragment_kind, fragment_key, canonical_payload_json, alternate_payloads_json, provenance_json
                        FROM canonical_semantic_fragments
                        WHERE project_name = ? AND project_file = ?
                        """,
                        (project_name, project_file),
                    ).fetchall()
                    for row in rows:
                        semantic_key = (
                            project_name,
                            project_file,
                            str(row["fragment_kind"]),
                            str(row["fragment_key"]),
                        )
                        previous_semantic_lookup[semantic_key] = {
                            "payload": _json_loads(row["canonical_payload_json"], {}),
                            "alternates": _json_loads(row["alternate_payloads_json"], []),
                            "provenance": _json_loads(row["provenance_json"], {}),
                        }
                for project_name, project_file, trace_scope, request_signature in trace_groups.keys():
                    row = conn.execute(
                        """
                        SELECT payload_json, provenance_json, reducer_version, built_at
                        FROM materialized_target_bundle_views
                        WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                        """,
                        (project_name, project_file, trace_scope, request_signature),
                    ).fetchone()
                    if row is None:
                        continue
                    previous_target_bundle_lookup[(project_name, project_file, trace_scope, request_signature)] = {
                        "payload": _json_loads(row["payload_json"], {}),
                        "provenance": _json_loads(row["provenance_json"], {}),
                        "reducerVersion": str(row["reducer_version"] or ""),
                        "builtAt": str(row["built_at"] or ""),
                    }

            canonical_semantic_lookup: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            canonical_semantic_entries: list[dict[str, Any]] = []
            derived_entries: list[dict[str, Any]] = []
            derived_semantic_lookup: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            derived_dependency_proofs: dict[tuple[str, str, str, str], dict[str, Any]] = {}
            removed_semantic_keys: set[tuple[str, str, str, str]] = set()
            previous_direct_semantic_keys: set[tuple[str, str, str, str]] = set()
            if scoped_refresh:
                touched_scope_set = set(requested_scopes)
                for semantic_key, semantic_entry in previous_semantic_lookup.items():
                    if semantic_key[2] not in SYSTEM_TRACE_FRAGMENT_KINDS:
                        continue
                    contributing_scopes = {
                        str(scope).strip()
                        for scope in (dict(semantic_entry.get("provenance") or {}).get("contributingTraceScopes") or [])
                        if str(scope).strip()
                    }
                    if contributing_scopes & touched_scope_set:
                        previous_direct_semantic_keys.add(semantic_key)
            if scoped_refresh:
                derived_entries, derived_semantic_lookup, derived_dependency_proofs, removed_semantic_keys = _derive_reducer_semantic_fragments_with_reuse(
                    conn,
                    trace_groups,
                    previous_semantic_lookup,
                )
            else:
                derived_entries = _derive_reducer_semantic_fragments(conn, trace_groups)
            if scoped_refresh:
                semantic_delete_keys: set[tuple[str, str, str, str]] = set()
                semantic_delete_keys.update(
                    {
                        (
                            str(entry["project_name"]),
                            str(entry["project_file"]),
                            str(entry["fragment_kind"]),
                            str(entry["fragment_key"]),
                        )
                        for entry in derived_entries
                    }
                )
                semantic_delete_keys.update(previous_direct_semantic_keys - set(semantic_groups.keys()))
                semantic_delete_keys.update(removed_semantic_keys)
                for project_name, project_file, fragment_kind, fragment_key in sorted(semantic_delete_keys):
                    conn.execute(
                        """
                        DELETE FROM canonical_semantic_fragments
                        WHERE project_name = ? AND project_file = ? AND fragment_kind = ? AND fragment_key = ?
                        """,
                        (project_name, project_file, fragment_kind, fragment_key),
                    )
            for semantic_key, fragment_rows in semantic_groups.items():
                project_name, project_file, fragment_kind, fragment_key = semantic_key
                canonical_payload, alternates, provenance, reducer_version = _reduce_semantic_fragment(fragment_kind, fragment_rows)
                semantic_group_proof = _build_semantic_group_proof(fragment_kind, fragment_rows, canonical_payload, alternates)
                provenance = {
                    **provenance,
                    "semanticGroupProof": {
                        "reuseDecision": "recomputed",
                        **semantic_group_proof,
                    },
                    "payloadSignals": _collect_payload_provenance_signals(
                        {
                            "canonical": canonical_payload,
                            "alternates": alternates,
                        }
                    ),
                }
                previous_semantic_entry = previous_semantic_lookup.get(semantic_key)
                previous_semantic_group_proof = dict((previous_semantic_entry or {}).get("provenance") or {}).get("semanticGroupProof") or {}
                if not (
                    scoped_refresh
                    and previous_semantic_entry
                    and previous_semantic_group_proof.get("combinedHash") == semantic_group_proof.get("combinedHash")
                ):
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
                else:
                    canonical_payload = dict(previous_semantic_entry.get("payload") or {})
                    alternates = list(previous_semantic_entry.get("alternates") or [])
                    provenance = dict(previous_semantic_entry.get("provenance") or {})
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

            for entry in derived_entries:
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

            if scoped_refresh and trace_groups:
                for semantic_key, semantic_entry in previous_semantic_lookup.items():
                    if semantic_key in canonical_semantic_lookup or semantic_key in removed_semantic_keys:
                        continue
                    canonical_semantic_lookup[semantic_key] = semantic_entry
                    canonical_semantic_entries.append(
                        {
                            "project_name": semantic_key[0],
                            "project_file": semantic_key[1],
                            "fragment_kind": semantic_key[2],
                            "fragment_key": semantic_key[3],
                            "payload": semantic_entry["payload"],
                            "provenance": semantic_entry["provenance"],
                        }
                    )
                for semantic_key, semantic_entry in derived_semantic_lookup.items():
                    canonical_semantic_lookup[semantic_key] = semantic_entry
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
                            "payload": semantic_entry["payload"],
                            "provenance": semantic_entry["provenance"],
                        }
                    )

            for (project_name, project_file, trace_scope, request_signature), value in trace_groups.items():
                payload = dict(value["payload"])
                payload.setdefault("dataset", "unity-trace-bundle")
                payload.setdefault("generatedAt", datetime.now().isoformat(timespec="seconds"))
                trace_view_key = (project_name, project_file, trace_scope, request_signature)
                trace_selection_proofs = dict(value.get("selectionProofs") or {})
                trace_dependency_proof = _build_materialized_trace_dependency_proof(payload, trace_selection_proofs)
                trace_view_provenance = {
                    **value["provenance"],
                    "canonicalSelectionProofs": trace_selection_proofs,
                    "dependencyProof": {
                        "reuseDecision": "recomputed",
                        **trace_dependency_proof,
                    },
                    "payloadSignals": _collect_payload_provenance_signals(payload),
                }
                previous_trace_view = previous_materialized_trace_lookup.get(trace_view_key)
                previous_trace_proof = dict((previous_trace_view or {}).get("provenance") or {}).get("dependencyProof") or {}
                if not (
                    scoped_refresh
                    and previous_trace_view
                    and previous_trace_proof.get("combinedHash") == trace_dependency_proof.get("combinedHash")
                ):
                    if scoped_refresh and previous_trace_view is not None:
                        conn.execute(
                            """
                            DELETE FROM materialized_trace_views
                            WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                            """,
                            trace_view_key,
                        )
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
                            _json_dumps(trace_view_provenance),
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
                system_selection_proofs = {
                    key: value
                    for key, value in trace_selection_proofs.items()
                    if key.split(":", 1)[0] in SYSTEM_TRACE_FRAGMENT_KINDS
                }
                system_dependency_proof = _build_canonical_system_trace_dependency_proof(system_payload, system_selection_proofs)
                system_trace_provenance = {
                    **system_provenance,
                    "canonicalSelectionProofs": system_selection_proofs,
                    "dependencyProof": {
                        "reuseDecision": "recomputed",
                        **system_dependency_proof,
                    },
                    "payloadSignals": _collect_payload_provenance_signals(system_payload),
                }
                previous_system_view = previous_system_trace_lookup.get(trace_view_key)
                previous_system_proof = dict((previous_system_view or {}).get("provenance") or {}).get("dependencyProof") or {}
                if not (
                    scoped_refresh
                    and previous_system_view
                    and previous_system_proof.get("combinedHash") == system_dependency_proof.get("combinedHash")
                ):
                    if scoped_refresh and previous_system_view is not None:
                        conn.execute(
                            """
                            DELETE FROM canonical_system_trace_views
                            WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                            """,
                            trace_view_key,
                        )
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
                            _json_dumps(system_trace_provenance),
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
                target_bundle_dependency_proof = _build_dependency_proof(
                    {
                        "target": payload.get("target"),
                        "plannerResolution": payload.get("plannerResolution"),
                        "traceRegistry": payload.get("traceRegistry"),
                        "status": {
                            "status": payload.get("status"),
                            "semanticStatus": payload.get("semanticStatus"),
                            "literalStatus": payload.get("literalStatus"),
                            "runtimeStatus": payload.get("runtimeStatus"),
                        },
                        "systemPayload": system_payload,
                        "semanticViews": semantic_views,
                    }
                )
                previous_target_bundle = previous_target_bundle_lookup.get((project_name, project_file, trace_scope, request_signature))
                previous_target_bundle_proof = dict((previous_target_bundle or {}).get("provenance") or {}).get("dependencyProof") or {}
                if scoped_refresh and previous_target_bundle and previous_target_bundle_proof.get("combinedHash") == target_bundle_dependency_proof.get("combinedHash"):
                    continue
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
                    "dependencyProof": {
                        "reuseDecision": "recomputed",
                        **target_bundle_dependency_proof,
                    },
                    "semanticDependencyProofs": {
                        "{}:{}".format(kind, fragment_key): proof
                        for (dep_project, dep_file, kind, fragment_key), proof in derived_dependency_proofs.items()
                        if dep_project == project_name and dep_file == project_file
                    },
                    "payloadSignals": _collect_payload_provenance_signals(target_bundle_payload),
                }
                if scoped_refresh:
                    conn.execute(
                        """
                        DELETE FROM materialized_target_bundle_views
                        WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                        """,
                        (project_name, project_file, trace_scope, request_signature),
                    )
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

            if scoped_refresh:
                current_trace_group_keys = set(trace_groups.keys())
                for key in sorted(set(previous_materialized_trace_lookup.keys()) - current_trace_group_keys):
                    conn.execute(
                        """
                        DELETE FROM materialized_trace_views
                        WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                        """,
                        key,
                    )
                for key in sorted(set(previous_system_trace_lookup.keys()) - current_trace_group_keys):
                    conn.execute(
                        """
                        DELETE FROM canonical_system_trace_views
                        WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND request_signature = ?
                        """,
                        key,
                    )
            self._prune_trace_retention(conn, trace_scopes=requested_scopes if scoped_refresh else None)

    def _prune_trace_retention(
        self,
        conn: sqlite3.Connection,
        trace_scopes: list[str] | None = None,
    ) -> dict[str, int]:
        requested_scopes = sorted({str(scope or "").strip() for scope in (trace_scopes or []) if str(scope or "").strip()})
        scoped = bool(requested_scopes)
        where_sql = ""
        params: tuple[Any, ...] = ()
        if scoped:
            placeholders = ",".join("?" for _ in requested_scopes)
            where_sql = f"trace_scope IN ({placeholders})"
            params = tuple(requested_scopes)

        purged_trace_superseded = _retain_latest_rows(
            conn,
            "trace_fragments",
            ["project_name", "project_file", "trace_scope", "fragment_kind", "fragment_key", "source_job_id", "source_term"],
            "COALESCE(invalidated_at, updated_at, created_at) DESC, fragment_id DESC",
            TRACE_SUPERSEDED_HISTORY_LIMIT,
            ("(is_valid = 0 OR invalidated_at IS NOT NULL)" + (f" AND {where_sql}" if where_sql else "")),
            params,
        )
        purged_canonical_trace = _retain_latest_rows(
            conn,
            "canonical_trace_fragments",
            ["project_name", "project_file", "trace_scope", "fragment_kind", "fragment_key"],
            "updated_at DESC, request_signature DESC",
            TRACE_CANONICAL_CACHE_HISTORY_LIMIT,
            where_sql,
            params,
        )
        purged_materialized_trace = _retain_latest_rows(
            conn,
            "materialized_trace_views",
            ["project_name", "project_file", "trace_scope"],
            "built_at DESC, request_signature DESC",
            TRACE_MATERIALIZED_SCOPE_HISTORY_LIMIT,
            where_sql,
            params,
        )
        purged_system_trace = _retain_latest_rows(
            conn,
            "canonical_system_trace_views",
            ["project_name", "project_file", "trace_scope"],
            "built_at DESC, request_signature DESC",
            TRACE_MATERIALIZED_SCOPE_HISTORY_LIMIT,
            where_sql,
            params,
        )
        purged_target_bundle = _retain_latest_rows(
            conn,
            "materialized_target_bundle_views",
            ["project_name", "project_file", "trace_scope"],
            "built_at DESC, request_signature DESC",
            TRACE_MATERIALIZED_SCOPE_HISTORY_LIMIT,
            where_sql,
            params,
        )
        return {
            "traceSuperseded": purged_trace_superseded,
            "canonicalTraceCache": purged_canonical_trace,
            "materializedTraceViews": purged_materialized_trace,
            "canonicalSystemTraceViews": purged_system_trace,
            "materializedTargetBundles": purged_target_bundle,
        }

    def _prune_evidence_retention(
        self,
        conn: sqlite3.Connection,
        terms: set[tuple[str, str, str]] | None = None,
    ) -> dict[str, int]:
        normalized_terms = sorted(
            {
                (
                    str(project_name or "").strip(),
                    str(project_file or "").strip(),
                    str(normalized_term or "").strip().lower(),
                )
                for project_name, project_file, normalized_term in (terms or set())
                if str(project_name or "").strip()
                and str(project_file or "").strip()
                and str(normalized_term or "").strip()
            }
        )
        where_sql = ""
        params: tuple[Any, ...] = ()
        if normalized_terms:
            where_sql = " OR ".join(
                "(project_name = ? AND project_file = ? AND normalized_term = ?)"
                for _ in normalized_terms
            )
            params = tuple(value for triple in normalized_terms for value in triple)
        purged_superseded = _retain_latest_rows(
            conn,
            "evidence",
            ["project_name", "project_file", "normalized_term", "aspect_kind", "aspect_key"],
            "COALESCE(invalidated_at, updated_at, created_at) DESC, evidence_id DESC",
            EVIDENCE_SUPERSEDED_HISTORY_LIMIT,
            ("(is_valid = 0 OR invalidated_at IS NOT NULL)" + (f" AND ({where_sql})" if where_sql else "")),
            params,
        )
        return {
            "evidenceSuperseded": purged_superseded,
        }

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

    def list_latest_materialized_target_bundle_views(
        self,
        project_name: str,
        project_file: str,
    ) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT mtbv.*
                FROM materialized_target_bundle_views AS mtbv
                INNER JOIN (
                    SELECT trace_scope, MAX(built_at) AS max_built_at
                    FROM materialized_target_bundle_views
                    WHERE project_name = ? AND project_file = ?
                    GROUP BY trace_scope
                ) AS latest
                  ON latest.trace_scope = mtbv.trace_scope
                 AND latest.max_built_at = mtbv.built_at
                WHERE mtbv.project_name = ? AND mtbv.project_file = ?
                ORDER BY mtbv.trace_scope ASC, mtbv.request_signature DESC
                """,
                (project_name, project_file, project_name, project_file),
            ).fetchall()
        latest_by_scope: dict[str, dict[str, Any]] = {}
        for row in rows:
            trace_scope = str(row["trace_scope"] or "")
            if not trace_scope or trace_scope in latest_by_scope:
                continue
            latest_by_scope[trace_scope] = {
                "traceScope": trace_scope,
                "requestSignature": str(row["request_signature"]),
                "payload": _json_loads(row["payload_json"], {}),
                "provenance": _json_loads(row["provenance_json"], {}),
                "reducerVersion": str(row["reducer_version"]),
                "builtAt": str(row["built_at"]),
            }
        return list(latest_by_scope.values())

    def find_materialized_resolver_target_view(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_resolver_target_views
                WHERE project_name = ? AND project_file = ? AND trace_scope = ?
                """,
                (project_name, project_file, trace_scope),
            ).fetchone()
        if row is None:
            return None
        return {
            "traceScope": str(row["trace_scope"]),
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
        }

    def list_materialized_resolver_target_views(
        self,
        project_name: str,
        project_file: str,
    ) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM materialized_resolver_target_views
                WHERE project_name = ? AND project_file = ?
                ORDER BY trace_scope ASC
                """,
                (project_name, project_file),
            ).fetchall()
        return [
            {
                "traceScope": str(row["trace_scope"]),
                "payload": _json_loads(row["payload_json"], {}),
                "provenance": _json_loads(row["provenance_json"], {}),
                "reducerVersion": str(row["reducer_version"]),
                "builtAt": str(row["built_at"]),
            }
            for row in rows
        ]

    def list_latest_materialized_subject_contract_views(
        self,
        project_name: str,
        project_file: str,
    ) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT mscv.*
                FROM materialized_subject_contract_views AS mscv
                INNER JOIN (
                    SELECT trace_scope, subject_id, MAX(built_at) AS max_built_at
                    FROM materialized_subject_contract_views
                    WHERE project_name = ? AND project_file = ?
                    GROUP BY trace_scope, subject_id
                ) AS latest
                  ON latest.trace_scope = mscv.trace_scope
                 AND latest.subject_id = mscv.subject_id
                 AND latest.max_built_at = mscv.built_at
                WHERE mscv.project_name = ? AND mscv.project_file = ?
                ORDER BY mscv.trace_scope ASC, mscv.subject_id ASC
                """,
                (project_name, project_file, project_name, project_file),
            ).fetchall()
        return [
            {
                "traceScope": str(row["trace_scope"]),
                "subjectId": str(row["subject_id"]),
                "payload": _json_loads(row["payload_json"], {}),
                "provenance": _json_loads(row["provenance_json"], {}),
                "reducerVersion": str(row["reducer_version"]),
                "builtAt": str(row["built_at"]),
            }
            for row in rows
        ]

    def _normalize_acquisition_diagnostic_payload(
        self,
        payload: dict[str, Any],
        built_at: str,
    ) -> tuple[dict[str, Any], bool]:
        normalized = dict(payload or {})
        if str(normalized.get("status") or "").strip() != "in-progress":
            return normalized, False
        try:
            built_at_dt = datetime.fromisoformat(str(built_at or "").strip())
        except ValueError:
            return normalized, False
        if datetime.now() - built_at_dt < timedelta(minutes=ACQUISITION_DIAGNOSTIC_STALE_MINUTES):
            return normalized, False
        normalized["status"] = "wait-cap-timeout"
        normalized["outcome"] = "shell-wait-cap-timeout"
        normalized["failureKind"] = str(normalized.get("failureKind") or "").strip() or "native-or-shell-timeout"
        normalized["detail"] = str(normalized.get("detail") or "").strip() or (
            "Acquisition run did not finalize before the shell wait cap or process timeout."
        )
        return normalized, True

    def upsert_materialized_acquisition_diagnostic_view(
        self,
        project_name: str,
        project_file: str,
        request_signature: str,
        trace_scope: str,
        acquisition_term: str,
        payload: dict[str, Any],
        *,
        provenance: dict[str, Any] | None = None,
        reducer_version: str = "materialized-acquisition-diagnostic-view-v1",
    ) -> dict[str, Any]:
        normalized_payload = dict(payload or {})
        normalized_payload["traceScope"] = str(trace_scope or "").strip()
        normalized_payload["acquisitionTerm"] = str(acquisition_term or "").strip()
        built_at = datetime.now().isoformat(timespec="microseconds")
        normalized_provenance = dict(provenance or {})
        normalized_provenance.setdefault("reducer", reducer_version)
        normalized_provenance.setdefault("requestSignature", str(request_signature or "").strip())
        normalized_provenance.setdefault("traceScope", str(trace_scope or "").strip())
        normalized_provenance.setdefault("acquisitionTerm", str(acquisition_term or "").strip())
        normalized_provenance.setdefault("payloadHash", _dependency_hash_payload(normalized_payload))
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO materialized_acquisition_diagnostics_views(
                    project_name, project_file, request_signature, trace_scope, acquisition_term,
                    payload_json, provenance_json, reducer_version, built_at
                ) VALUES(?,?,?,?,?,?,?,?,?)
                ON CONFLICT(project_name, project_file, request_signature, trace_scope, acquisition_term) DO UPDATE SET
                    payload_json=excluded.payload_json,
                    provenance_json=excluded.provenance_json,
                    reducer_version=excluded.reducer_version,
                    built_at=excluded.built_at
                """,
                (
                    project_name,
                    project_file,
                    str(request_signature or "").strip(),
                    str(trace_scope or "").strip(),
                    str(acquisition_term or "").strip(),
                    _json_dumps(normalized_payload),
                    _json_dumps(normalized_provenance),
                    reducer_version,
                    built_at,
                ),
            )
        return normalized_payload

    def list_latest_materialized_acquisition_diagnostics_views(
        self,
        project_name: str,
        project_file: str,
        *,
        request_signature: str = "",
    ) -> list[dict[str, Any]]:
        request_signature = str(request_signature or "").strip()
        query = """
            SELECT *
            FROM materialized_acquisition_diagnostics_views
            WHERE project_name = ? AND project_file = ?
        """
        params: list[Any] = [project_name, project_file]
        if request_signature:
            query += " AND request_signature = ?"
            params.append(request_signature)
        query += " ORDER BY built_at DESC, trace_scope ASC, acquisition_term ASC"
        with self.connect() as conn:
            rows = conn.execute(query, tuple(params)).fetchall()
        results: list[dict[str, Any]] = []
        stale_updates: list[tuple[str, str, str, dict[str, Any]]] = []
        for row in rows:
            payload = dict(_json_loads(row["payload_json"], {}))
            payload, changed = self._normalize_acquisition_diagnostic_payload(payload, str(row["built_at"] or ""))
            if changed:
                stale_updates.append(
                    (
                        str(row["request_signature"] or ""),
                        str(row["trace_scope"] or ""),
                        str(row["acquisition_term"] or ""),
                        payload,
                    )
                )
            results.append(
                {
                    "requestSignature": str(row["request_signature"] or ""),
                    "traceScope": str(row["trace_scope"] or ""),
                    "acquisitionTerm": str(row["acquisition_term"] or ""),
                    "payload": payload,
                    "provenance": _json_loads(row["provenance_json"], {}),
                    "reducerVersion": str(row["reducer_version"] or ""),
                    "builtAt": str(row["built_at"] or ""),
                }
            )
        for stale_request_signature, stale_trace_scope, stale_term, stale_payload in stale_updates:
            self.upsert_materialized_acquisition_diagnostic_view(
                project_name,
                project_file,
                stale_request_signature,
                stale_trace_scope,
                stale_term,
                stale_payload,
            )
        return results

    def find_contract_term_evidence(
        self,
        project_name: str,
        project_file: str,
        term: str,
    ) -> dict[str, Any]:
        return self._find_contract_term_evidence(project_name, project_file, term)

    @staticmethod
    def _parse_missing_db_term_blocker(reason: str) -> tuple[str, list[str]]:
        reason = str(reason or "").strip()
        prefix = "missing-db-term-evidence:"
        if not reason.startswith(prefix):
            return "", []
        remainder = reason[len(prefix):]
        lane_id, separator, term_blob = remainder.partition(":")
        if not separator:
            return str(lane_id or "").strip(), []
        return (
            str(lane_id or "").strip(),
            _unique_strings([str(value).strip() for value in str(term_blob or "").split(",") if str(value).strip()]),
        )

    def _build_runtime_model_relation_probes(
        self,
        *,
        trace_scope: str,
        family_id: str,
        primary_support_row: dict[str, Any],
        requested_terms: list[str],
        selected_seam_id: str,
    ) -> list[dict[str, Any]]:
        if family_id != "token-shop" or selected_seam_id != "runtime-model-gap":
            return []
        shell_field = str(primary_support_row.get("field") or primary_support_row.get("shellField") or "").strip()
        shell_path_id = str(primary_support_row.get("shellPathId") or "").strip()
        if not shell_field:
            return []
        relation_surface_ids = {
            "consumer-family",
            "consumer-routines",
            "cell-gain-getters",
            "booster-bonus-shell",
            "final-chest-bonus-shell",
        }
        probes: list[dict[str, Any]] = []
        for candidate_scope, support_context in BOOTSTRAP_SUPPORT_CONTEXTS.items():
            if candidate_scope == trace_scope:
                continue
            support_context = dict(support_context or {})
            if str(support_context.get("shellField") or "").strip() != shell_field:
                continue
            candidate_path_id = str(support_context.get("shellPathId") or "").strip()
            if shell_path_id and candidate_path_id and candidate_path_id != shell_path_id:
                continue
            candidate_surfaces = [dict(item) for item in (support_context.get("surfaces") or []) if isinstance(item, dict)]
            matching_relation_surfaces = [
                surface
                for surface in candidate_surfaces
                if str(surface.get("id") or "").strip() in relation_surface_ids
            ]
            if not matching_relation_surfaces:
                continue
            relation_terms = _unique_strings(
                [
                    *[str(value).strip() for value in requested_terms if str(value).strip()],
                    *[
                        str(term).strip()
                        for surface in matching_relation_surfaces
                        for term in (surface.get("terms") or [])
                        if str(term).strip()
                    ],
                ]
            )
            relation_anchors = _unique_strings(
                [
                    *[
                        str(value).strip()
                        for value in (BOOTSTRAP_DEFAULT_ANCHORS.get(candidate_scope) or [])
                        if str(value).strip()
                    ],
                    shell_field,
                    shell_path_id,
                    *relation_terms,
                ]
            )[:12]
            coverage_seam_ids = ["exact-cellboost-to-booster-bonus-handoff"]
            candidate_subject_state = self.find_or_materialize_subject_state_view(
                "cifi-full",
                "libil2cpp.so",
                candidate_scope,
                subject_kind="row-local",
                subject_key=f"row:{shell_field}",
                family_id=family_id,
                compatibility_target_id=candidate_scope,
            ) or {}
            candidate_open_edges = {
                str(value).strip()
                for value in (
                    list((candidate_subject_state.get("blockedEdges") or []))
                    + list(candidate_subject_state.get("missingEdges") or [])
                )
                if str(value).strip()
            }
            coverage_closed = bool(coverage_seam_ids) and all(seam_id not in candidate_open_edges for seam_id in coverage_seam_ids)
            probes.append(
                {
                    "probeId": f"relation:{trace_scope}->{candidate_scope}",
                    "label": "{} relation coverage via {}".format(shell_field, candidate_scope),
                    "traceScope": candidate_scope,
                    "routine": str(support_context.get("traceRoutineHint") or candidate_scope).strip(),
                    "expectedTerms": relation_terms,
                    "anchors": relation_anchors,
                    "requiredCoverageSeamIds": coverage_seam_ids,
                    "coverageStatus": "covered" if coverage_closed else "uncovered",
                    "surfaceIds": [str(surface.get("id") or "").strip() for surface in matching_relation_surfaces if str(surface.get("id") or "").strip()],
                    "whyChosen": [
                        f"same shell {shell_field}",
                        f"relation scope {candidate_scope}",
                        "runtime-model seam requires consumer/read-site coverage",
                    ],
                }
            )
        probes.sort(
            key=lambda probe: (
                0 if str(probe.get("coverageStatus") or "") != "covered" else 1,
                -len(list(probe.get("surfaceIds") or [])),
                str(probe.get("traceScope") or ""),
            )
        )
        return probes

    def _build_subject_seam_acquisition_plan(
        self,
        knowledge: dict[str, Any],
        resolver_payload: dict[str, Any],
        *,
        requested_seam_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        knowledge = dict(knowledge or {})
        resolver_payload = dict(resolver_payload or {})
        subject_state = dict(knowledge.get("subjectState") or {})
        if not subject_state:
            return {}
        requested_seam_ids = _unique_strings([str(value).strip() for value in (requested_seam_ids or []) if str(value).strip()])
        available_seam_ids = _unique_strings(
            [
                str(((subject_state.get("nextSeam") or {}).get("id")) or "").strip(),
                *[str(value).strip() for value in (subject_state.get("missingEdges") or []) if str(value).strip()],
                *[str(value).strip() for value in (subject_state.get("blockedEdges") or []) if str(value).strip()],
                *[str(value).strip() for value in (subject_state.get("nonblockingEdges") or []) if str(value).strip()],
            ]
        )
        selected_seam_id = ""
        for seam_id in requested_seam_ids:
            if seam_id in available_seam_ids:
                selected_seam_id = seam_id
                break
        if not selected_seam_id:
            selected_seam_id = str(((subject_state.get("nextSeam") or {}).get("id")) or "").strip()
        if not selected_seam_id:
            for seam_id in available_seam_ids:
                if seam_id:
                    selected_seam_id = seam_id
                    break
        if not selected_seam_id:
            return {}

        depth_plan = [dict(item) for item in (knowledge.get("depthPlan") or []) if isinstance(item, dict)]
        selected_depth_step = {}
        matching_depth_steps = [
            step
            for step in depth_plan
            if selected_seam_id in str(step.get("goal") or "")
        ]
        if matching_depth_steps:
            exact_goal_prefix = f"resolve the {selected_seam_id}"
            selected_depth_step = next(
                (
                    step
                    for step in matching_depth_steps
                    if str(step.get("goal") or "").strip().lower().startswith(exact_goal_prefix)
                ),
                sorted(
                    matching_depth_steps,
                    key=lambda step: (
                        int(step.get("hop") or 0),
                        -len([str(value) for value in (step.get("terms") or []) if str(value).strip()]),
                    ),
                    reverse=True,
                )[0],
            )
        if not selected_depth_step and depth_plan:
            selected_depth_step = depth_plan[0]

        accepted_anchor_terms = {
            str(value).strip()
            for value in (resolver_payload.get("acceptedAnchors") or [])
            if str(value).strip()
        }
        requested_term_set = {
            str(value).strip()
            for value in (selected_depth_step.get("terms") or [])
            if str(value).strip()
        }
        next_seam = dict(subject_state.get("nextSeam") or {})
        next_seam_term_set = {
            str(value).strip()
            for value in (next_seam.get("terms") or [])
            if str(value).strip()
        }
        exact_requested_terms = list(requested_term_set)
        if not exact_requested_terms:
            exact_requested_terms = [selected_seam_id]
        support_rows = [dict(item) for item in (resolver_payload.get("supportRows") or []) if isinstance(item, dict)]
        support_surfaces = [dict(item) for item in (resolver_payload.get("supportSurfaces") or []) if isinstance(item, dict)]
        subject_label = str(subject_state.get("subjectLabel") or resolver_payload.get("subjectLabel") or "").strip()
        subject_path_id = str(subject_state.get("subjectPathId") or "").strip()
        primary_support_row = {}
        for row in support_rows:
            row_field = str(row.get("field") or row.get("shellField") or "").strip()
            row_path_id = str(row.get("shellPathId") or "").strip()
            if (
                (subject_label and row_field == subject_label)
                or (subject_path_id and row_path_id == subject_path_id)
            ):
                primary_support_row = row
                break
        if not primary_support_row and support_rows:
            primary_support_row = dict(support_rows[0])
        primary_support_terms = {
            str(primary_support_row.get("field") or "").strip(),
            str(primary_support_row.get("shellField") or "").strip(),
            str(primary_support_row.get("shellPathId") or "").strip(),
        }
        primary_support_terms = {term for term in primary_support_terms if term}
        seam_context_terms = {
            *requested_term_set,
            *primary_support_terms,
        }
        if not requested_term_set:
            seam_context_terms.update(next_seam_term_set)
        relation_probes = self._build_runtime_model_relation_probes(
            trace_scope=str(knowledge.get("traceScope") or resolver_payload.get("traceScope") or "").strip(),
            family_id=str(knowledge.get("familyId") or resolver_payload.get("familyId") or "").strip(),
            primary_support_row=primary_support_row,
            requested_terms=exact_requested_terms,
            selected_seam_id=selected_seam_id,
        )

        def _looks_like_anchor(term: str) -> bool:
            normalized = str(term or "").strip()
            if not normalized or normalized in accepted_anchor_terms:
                return False
            if normalized == selected_seam_id:
                return False
            if normalized in requested_term_set:
                return True
            if normalized.endswith("Button"):
                return True
            if normalized.startswith("Buy"):
                return True
            if "Prefab" in normalized:
                return True
            if normalized.endswith(("Cost", "Bonus", "Fill", "FillMaxLevel")):
                return True
            if normalized.isdigit():
                return True
            return False

        selected_surface_ids: list[str] = []
        selected_anchors: list[str] = []
        selected_anchors.extend(exact_requested_terms)
        if primary_support_row:
            selected_anchors.extend(
                [
                    str(primary_support_row.get("shellField") or "").strip(),
                    str(primary_support_row.get("shellPathId") or "").strip(),
                ]
            )
        for surface in support_surfaces:
            surface_terms = [
                str(term).strip()
                for term in (surface.get("terms") or [])
                if _looks_like_anchor(str(term))
                and (
                    not seam_context_terms
                    or str(term).strip() in seam_context_terms
                )
            ]
            if not surface_terms:
                continue
            selected_surface_ids.append(str(surface.get("id") or "").strip())
            selected_anchors.extend(surface_terms[:6])
        if not selected_anchors:
            selected_anchors = [
                str(value).strip()
                for value in (resolver_payload.get("anchorTerms") or [])
                if _looks_like_anchor(str(value))
            ]
        selected_anchors = _unique_strings([term for term in selected_anchors if term])[:12]
        if (
            str(subject_state.get("subjectKind") or "").strip() == "range-family"
            and selected_seam_id == "exact-display-update-path"
        ):
            local_anchor_terms = [
                str(value).strip()
                for value in (resolver_payload.get("anchorTerms") or [])
                if _looks_like_anchor(str(value))
            ]
            if local_anchor_terms:
                selected_anchors = _unique_strings(local_anchor_terms)[:12]
                local_requested_terms = [
                    term
                    for term in selected_anchors
                    if term.endswith("Button") or term.startswith("Buy") or "Prefab" in term
                ]
                if local_requested_terms:
                    exact_requested_terms = _unique_strings(local_requested_terms)[:12]
        selected_surface_ids = _unique_strings([surface_id for surface_id in selected_surface_ids if surface_id])

        trace_scope = str(knowledge.get("traceScope") or resolver_payload.get("traceScope") or "").strip()
        execution_routine_id = str(
            knowledge.get("executionRoutineHint")
            or resolver_payload.get("traceRoutineHint")
            or trace_scope
            or "generic-explore"
        ).strip()
        subject_id = str(subject_state.get("subjectId") or resolver_payload.get("subjectId") or trace_scope).strip()
        subject_kind = str(subject_state.get("subjectKind") or resolver_payload.get("subjectKind") or "").strip()
        subject_key = str(subject_state.get("subjectKey") or subject_id).strip() or subject_id
        subject_label = str(subject_state.get("subjectLabel") or resolver_payload.get("subjectLabel") or subject_id).strip() or subject_id
        target_id = str(knowledge.get("targetId") or resolver_payload.get("targetId") or trace_scope).strip() or trace_scope
        family_id = str(knowledge.get("familyId") or resolver_payload.get("familyId") or "").strip()
        seam_goal = (
            str(selected_depth_step.get("goal") or "").strip()
            or str(((subject_state.get("nextSeam") or {}).get("goal")) or "").strip()
            or f"Acquire anchor-level evidence for {selected_seam_id}."
        )
        why_chosen = [
            f"subject {subject_id}",
            f"seam {selected_seam_id}",
            f"routine {execution_routine_id}",
        ]
        if selected_surface_ids:
            why_chosen.append(f"surfaces {', '.join(selected_surface_ids)}")
        if requested_seam_ids:
            why_chosen.append("requested explicit subject seam")
        selected_relation_probe = dict(relation_probes[0]) if relation_probes else {}
        if selected_relation_probe:
            trace_scope = str(selected_relation_probe.get("traceScope") or trace_scope).strip()
            execution_routine_id = str(selected_relation_probe.get("routine") or execution_routine_id).strip()
            selected_anchors = _unique_strings(
                [
                    *[str(value).strip() for value in (selected_relation_probe.get("anchors") or []) if str(value).strip()],
                    *selected_anchors,
                ]
            )[:12]
            exact_requested_terms = [
                str(value).strip()
                for value in (selected_relation_probe.get("expectedTerms") or exact_requested_terms)
                if str(value).strip()
            ]
            why_chosen.extend([str(value) for value in (selected_relation_probe.get("whyChosen") or []) if str(value).strip()])
        acquisition_step = {
            "traceScope": trace_scope,
            "targetId": target_id,
            "familyId": family_id,
            "subjectId": subject_id,
            "subjectKind": subject_kind,
            "subjectKey": subject_key,
            "subjectLabel": subject_label,
            "seamId": selected_seam_id,
            "executionRoutineId": execution_routine_id,
            "selectedScope": trace_scope,
            "selectedRoutine": execution_routine_id,
            "selectedSurfaceIds": selected_surface_ids,
            "anchors": selected_anchors,
            "expectedTerms": exact_requested_terms,
            "whyChosen": why_chosen,
            "goal": seam_goal,
        }
        if selected_relation_probe:
            acquisition_step["coverageMode"] = "relation-shaped"
            acquisition_step["relationProbe"] = selected_relation_probe
        return {
            "selectionMode": "subject-seam-anchor-acquisition",
            "subjectId": subject_id,
            "subjectKind": subject_kind,
            "subjectKey": subject_key,
            "subjectLabel": subject_label,
            "selectedSeamId": selected_seam_id,
            "selectedScope": trace_scope,
            "selectedRoutine": execution_routine_id,
            "selectedSurfaceIds": selected_surface_ids,
            "selectedAnchors": selected_anchors,
            "anchorSelectionReasons": why_chosen,
            "requestedTerms": exact_requested_terms,
            "coverageMode": "relation-shaped" if selected_relation_probe else "term-shaped",
            "relationProbes": relation_probes,
            "selectedRelationProbe": selected_relation_probe or None,
            "termDiagnostics": [
                {
                    "term": str((selected_relation_probe or {}).get("probeId") or requested_term),
                    "status": "planned",
                    "failureKind": None,
                    "selectedTraceScope": trace_scope,
                    "expectedCoverage": list(exact_requested_terms),
                    "whyChosen": why_chosen,
                    "recommendedNext": None,
                    "coverageMode": "relation-shaped" if selected_relation_probe else "term-shaped",
                    "coverageProbe": selected_relation_probe or None,
                }
                for requested_term in ([exact_requested_terms[0]] if exact_requested_terms else [selected_seam_id])
            ],
            "steps": [acquisition_step],
            "remainingTerms": [],
        }

    def _resolve_subject_seam_acquisition_request(
        self,
        project_name: str,
        project_file: str,
        *,
        requested_queries: list[str],
        requested_anchors: list[str],
        family_id: str,
    ) -> dict[str, Any] | None:
        combined_inputs = _unique_strings([*requested_queries, *requested_anchors])
        if not combined_inputs:
            return None
        normalized_inputs = {
            _normalize_resolution_term(value): str(value)
            for value in combined_inputs
            if _normalize_resolution_term(value)
        }
        if not normalized_inputs:
            return None

        candidates: list[dict[str, Any]] = []
        for row in self.list_latest_materialized_subject_state_views(project_name, project_file):
            payload = dict(row.get("payload") or {})
            trace_scope = str(row.get("traceScope") or "").strip()
            subject_id = str(payload.get("subjectId") or row.get("subjectId") or "").strip()
            if not trace_scope or not subject_id:
                continue
            target_aliases = [str(value).strip() for value in (payload.get("targetAliases") or []) if str(value).strip()]
            candidate_family_id = _infer_family_id_from_target_id(target_aliases[0] if target_aliases else trace_scope)
            if family_id and candidate_family_id and candidate_family_id != family_id:
                continue
            subject_terms = _unique_strings(
                [
                    subject_id,
                    str(payload.get("subjectKey") or "").strip(),
                    str(payload.get("subjectLabel") or "").strip(),
                    *target_aliases,
                ]
            )
            seam_terms = _unique_strings(
                [
                    str(((payload.get("nextSeam") or {}).get("id")) or "").strip(),
                    *[str(value).strip() for value in (payload.get("missingEdges") or []) if str(value).strip()],
                    *[str(value).strip() for value in (payload.get("blockedEdges") or []) if str(value).strip()],
                    *[str(value).strip() for value in (payload.get("nonblockingEdges") or []) if str(value).strip()],
                ]
            )
            normalized_subject_terms = {
                _normalize_resolution_term(value): value
                for value in subject_terms
                if _normalize_resolution_term(value)
            }
            normalized_seam_terms = {
                _normalize_resolution_term(value): value
                for value in seam_terms
                if _normalize_resolution_term(value)
            }
            matched_subject_terms = [
                normalized_subject_terms[normalized]
                for normalized in normalized_inputs
                if normalized in normalized_subject_terms
            ]
            matched_seam_terms = [
                normalized_seam_terms[normalized]
                for normalized in normalized_inputs
                if normalized in normalized_seam_terms
            ]
            if not matched_subject_terms or not matched_seam_terms:
                continue
            score = len(matched_subject_terms) * 100 + len(matched_seam_terms) * 80
            if subject_id.startswith("row:"):
                score += 40
            if str(payload.get("subjectKind") or "").strip() == "row-local":
                score += 20
            candidates.append(
                {
                    "traceScope": trace_scope,
                    "payload": payload,
                    "subjectId": subject_id,
                    "subjectKind": str(payload.get("subjectKind") or "").strip(),
                    "subjectKey": str(payload.get("subjectKey") or subject_id).strip(),
                    "subjectLabel": str(payload.get("subjectLabel") or subject_id).strip(),
                    "familyId": candidate_family_id,
                    "matchedSubjectTerms": _unique_strings(matched_subject_terms),
                    "matchedSeamTerms": _unique_strings(matched_seam_terms),
                    "score": score,
                }
            )
        if not candidates:
            return None

        candidates.sort(
            key=lambda item: (
                -int(item.get("score") or 0),
                str(item.get("traceScope") or ""),
                str(item.get("subjectId") or ""),
            )
        )
        best = dict(candidates[0])
        trace_scope = str(best.get("traceScope") or "").strip()
        payload = dict(best.get("payload") or {})
        matched_subject_terms = list(best.get("matchedSubjectTerms") or [])
        matched_seam_terms = list(best.get("matchedSeamTerms") or [])
        compatibility_target_id = str((payload.get("targetAliases") or [trace_scope])[0] or trace_scope).strip()
        candidate_family_id = str(best.get("familyId") or family_id or "").strip()
        knowledge_plan = self.resolve_trace_execution_request(
            project_name,
            project_file,
            trace_scope,
            subject_kind=str(best.get("subjectKind") or ""),
            subject_key=str(best.get("subjectKey") or best.get("subjectId") or ""),
            family_id=candidate_family_id,
            compatibility_target_id=compatibility_target_id,
            requested_seam_ids=matched_seam_terms,
        )
        acquisition_plan = dict(knowledge_plan.get("acquisitionPlan") or ((knowledge_plan.get("knowledge") or {}).get("acquisitionPlan") or {}))
        expanded_anchors = _unique_strings(
            [
                *[str(value).strip() for value in (acquisition_plan.get("selectedAnchors") or []) if str(value).strip()],
                *[
                    str(value).strip()
                    for step in (acquisition_plan.get("steps") or [])
                    if isinstance(step, dict)
                    for value in (step.get("anchors") or [])
                    if str(value).strip()
                ],
            ]
        )
        planner_resolution = {
            "selectionMode": "db-subject-seam-acquisition",
            "requestedQueries": requested_queries,
            "requestedAnchors": requested_anchors,
            "matchedInputs": _unique_strings([*matched_subject_terms, *matched_seam_terms]),
            "matchedTerms": _unique_strings([*matched_subject_terms, *matched_seam_terms]),
            "matchedFamilyId": candidate_family_id or "exploration",
            "matchedFamilyLabel": FAMILY_GRAPH_LABELS.get(candidate_family_id, (candidate_family_id or "exploration").replace("-", " ")),
            "selectedSubjectKind": str(best.get("subjectKind") or "semantic-scope"),
            "selectedSubjectKey": str(best.get("subjectKey") or best.get("subjectId") or ""),
            "selectedSubjectLabel": str(best.get("subjectLabel") or best.get("subjectId") or ""),
            "selectedTargetId": compatibility_target_id,
            "selectedRunMode": "trace",
            "selectedComparePresetId": None,
            "synonymSetsUsed": [],
            "expandedAnchors": expanded_anchors,
            "decisionNote": (
                "Resolved the trace as explicit DB-native subject seam acquisition, "
                f"selecting {best.get('subjectId') or trace_scope} for seam(s) {', '.join(matched_seam_terms)}."
            ),
        }
        planner_resolution = self._apply_knowledge_subject_identity(planner_resolution, knowledge_plan)
        return {
            "plannerResolution": planner_resolution,
            "selectedTargetId": compatibility_target_id,
            "selectedFamilyId": candidate_family_id or "exploration",
            "executionTargetId": str(knowledge_plan.get("targetId") or compatibility_target_id or trace_scope),
            "executionTraceScope": str(knowledge_plan.get("traceScope") or trace_scope),
            "knowledgePlan": knowledge_plan,
        }

    def _resolve_missing_db_term_acquisition_request(
        self,
        project_name: str,
        project_file: str,
        *,
        requested_queries: list[str],
        requested_anchors: list[str],
        family_id: str,
    ) -> dict[str, Any] | None:
        combined_inputs = _unique_strings([*requested_queries, *requested_anchors])
        if not combined_inputs:
            return None
        normalized_input_terms = {
            _normalize_resolution_term(value)
            for value in combined_inputs
            if _normalize_resolution_term(value)
        }
        input_tokens = {
            token
            for value in combined_inputs
            for token in _split_resolution_tokens(value)
            if token and token not in GENERIC_RESOLUTION_TOKENS
        }
        contract_rows = self.list_latest_materialized_subject_contract_views(project_name, project_file)
        selected_blockers: list[dict[str, Any]] = []
        for row in contract_rows:
            payload = dict(row.get("payload") or {})
            blocked_reasons = dict(payload.get("blockedInputReasons") or {})
            for lane_id, reason in blocked_reasons.items():
                parsed_lane_id, missing_terms = self._parse_missing_db_term_blocker(str(reason or ""))
                if not missing_terms:
                    continue
                if family_id and str(payload.get("familyId") or "").strip() not in {"", family_id}:
                    continue
                blocker_terms = _unique_strings(
                    [
                        str(parsed_lane_id or lane_id),
                        *missing_terms,
                        str(payload.get("subjectId") or ""),
                        str(payload.get("subjectLabel") or ""),
                        *[str(value) for value in (payload.get("targetAliases") or []) if str(value).strip()],
                    ]
                )
                normalized_blocker_terms = {
                    _normalize_resolution_term(value)
                    for value in blocker_terms
                    if _normalize_resolution_term(value)
                }
                matched_missing_terms = [
                    term
                    for term in missing_terms
                    if _normalize_resolution_term(term) in normalized_input_terms
                ]
                lane_requested = _normalize_resolution_term(str(parsed_lane_id or lane_id)) in normalized_input_terms
                blocker_tokens = {
                    token
                    for value in blocker_terms
                    for token in _split_resolution_tokens(value)
                    if token and token not in GENERIC_RESOLUTION_TOKENS
                }
                overlap_score = len(input_tokens & blocker_tokens) * 6
                if not matched_missing_terms and not lane_requested:
                    continue
                selected_blockers.append(
                    {
                        "traceScope": str(row.get("traceScope") or ""),
                        "subjectId": str(row.get("subjectId") or payload.get("subjectId") or ""),
                        "subjectKind": str(payload.get("subjectKind") or ""),
                        "subjectLabel": str(payload.get("subjectLabel") or payload.get("subjectId") or ""),
                        "laneId": str(parsed_lane_id or lane_id),
                        "missingTerms": missing_terms,
                        "requestedTerms": matched_missing_terms or missing_terms,
                        "blockedReason": str(reason or ""),
                        "payload": payload,
                        "score": len(matched_missing_terms) * 100 + overlap_score,
                    }
                )
        if not selected_blockers:
            return None

        selected_blockers.sort(
            key=lambda item: (
                -int(item.get("score") or 0),
                str(item.get("traceScope") or ""),
                str(item.get("laneId") or ""),
            )
        )
        requested_missing_terms = _unique_strings(
            [
                term
                for blocker in selected_blockers
                for term in list(blocker.get("requestedTerms") or blocker.get("missingTerms") or [])
            ]
        )
        if not requested_missing_terms:
            return None

        resolver_targets = {
            str(row.get("traceScope") or ""): dict(row.get("payload") or {})
            for row in self.list_materialized_resolver_target_views(project_name, project_file)
        }
        contract_by_scope = {
            str(row.get("traceScope") or ""): dict(row.get("payload") or {})
            for row in contract_rows
        }
        scored_candidates: list[dict[str, Any]] = []
        for trace_scope, resolver_payload in resolver_targets.items():
            target_id = str(resolver_payload.get("targetId") or trace_scope).strip()
            candidate_family_id = str(resolver_payload.get("familyId") or "").strip() or _infer_family_id_from_target_id(target_id)
            if family_id and candidate_family_id and candidate_family_id != family_id:
                continue
            contract_payload = dict(contract_by_scope.get(trace_scope) or {})
            latest_bundle_payload = dict(
                (
                    self.find_latest_materialized_target_bundle_view(project_name, project_file, trace_scope)
                    or {}
                ).get("payload")
                or {}
            )
            latest_bundle_blob = _json_dumps(latest_bundle_payload)
            candidate_terms = _unique_strings(
                [
                    trace_scope,
                    target_id,
                    str(resolver_payload.get("subjectId") or ""),
                    str(resolver_payload.get("subjectLabel") or resolver_payload.get("label") or ""),
                    *[str(value) for value in (resolver_payload.get("targetAliases") or []) if str(value).strip()],
                    *[str(value) for value in (resolver_payload.get("anchorTerms") or []) if str(value).strip()],
                    *[str(value) for value in (resolver_payload.get("resolutionAliases") or []) if str(value).strip()],
                    *[
                        str(surface.get("label") or "")
                        for surface in (resolver_payload.get("supportSurfaces") or [])
                        if isinstance(surface, dict)
                    ],
                    *[
                        str(surface.get("id") or "")
                        for surface in (resolver_payload.get("supportSurfaces") or [])
                        if isinstance(surface, dict)
                    ],
                    *[
                        str(term)
                        for surface in (resolver_payload.get("supportSurfaces") or [])
                        if isinstance(surface, dict)
                        for term in (surface.get("terms") or [])
                        if str(term).strip()
                    ],
                    *[
                        str(term)
                        for lane_payload in ((contract_payload.get("supportSummary") or {}).get("sharedLanes") or {}).values()
                        if isinstance(lane_payload, dict)
                        for term in (lane_payload.get("foundTerms") or [])
                        if str(term).strip()
                    ],
                    *[
                        str(item.get("term") or "")
                        for lane_payload in ((contract_payload.get("provenanceSummary") or {}).get("sharedLanes") or {}).values()
                        if isinstance(lane_payload, list)
                        for item in lane_payload
                        if isinstance(item, dict)
                    ],
                    *[
                        str(value)
                        for value in _collect_payload_strings(latest_bundle_payload, limit=200)
                        if str(value).strip()
                    ],
                    *[
                        str(term)
                        for term in requested_missing_terms
                        if str(term).strip() and str(term) in latest_bundle_blob
                    ],
                ]
            )
            normalized_candidate_terms = {
                _normalize_resolution_term(value): str(value)
                for value in candidate_terms
                if _normalize_resolution_term(value)
            }
            candidate_term_tokens = {
                token
                for value in candidate_terms
                for token in _split_resolution_tokens(value)
                if token and token not in GENERIC_RESOLUTION_TOKENS
            }
            expected_terms: list[str] = []
            matched_sources: list[str] = []
            score = 0
            tokenium_naming_summary = dict(
                ((contract_payload.get("supportSummary") or {}).get("sharedLanes") or {}).get("tokeniumNaming")
                or {}
            )
            tokenium_naming_found_terms = _unique_strings(
                [str(value) for value in (tokenium_naming_summary.get("foundTerms") or []) if str(value).strip()]
            )
            tokenium_naming_missing_terms = _unique_strings(
                [str(value) for value in (tokenium_naming_summary.get("missingTerms") or []) if str(value).strip()]
            )
            for term in requested_missing_terms:
                normalized_term = _normalize_resolution_term(term)
                if not normalized_term:
                    continue
                term_tokens = {
                    token
                    for token in _split_resolution_tokens(term)
                    if token and token not in GENERIC_RESOLUTION_TOKENS
                }
                matched_source = ""
                term_score = 0
                if normalized_term in normalized_candidate_terms:
                    matched_source = normalized_candidate_terms[normalized_term]
                    term_score = 140
                else:
                    overlap = term_tokens & candidate_term_tokens
                    if overlap:
                        term_score = len(overlap) * 18
                        matched_source = ", ".join(sorted(overlap))
                if term_score <= 0 and str(term) in tokenium_naming_missing_terms:
                    term_score = 44 + min(len(tokenium_naming_found_terms), 6) * 4
                    matched_source = "tokeniumNaming missing-term lane"
                if term_score <= 0:
                    continue
                expected_terms.append(term)
                matched_sources.append(matched_source or term)
                score += term_score
            if not expected_terms:
                continue
            blocked_reason = str(((contract_payload.get("blockedInputReasons") or {}).get("tokeniumNaming")) or "")
            if blocked_reason.startswith("missing-db-term-evidence:"):
                score += 12
            scored_candidates.append(
                {
                    "traceScope": trace_scope,
                    "targetId": target_id,
                    "familyId": candidate_family_id,
                    "resolverPayload": resolver_payload,
                    "expectedTerms": _unique_strings(expected_terms),
                    "matchedSources": _unique_strings(matched_sources),
                    "score": score,
                }
            )
        if scored_candidates:
            scored_candidates.sort(
                key=lambda item: (
                    -len(item.get("expectedTerms") or []),
                    -int(item.get("score") or 0),
                    str(item.get("traceScope") or ""),
                )
            )
        remaining_terms = list(requested_missing_terms)
        selected_steps: list[dict[str, Any]] = []
        while remaining_terms:
            remaining_set = {str(term) for term in remaining_terms}
            best_candidate = None
            best_coverage: list[str] = []
            for candidate in scored_candidates:
                coverage = [term for term in list(candidate.get("expectedTerms") or []) if term in remaining_set]
                if not coverage:
                    continue
                if (
                    best_candidate is None
                    or len(coverage) > len(best_coverage)
                    or (
                        len(coverage) == len(best_coverage)
                        and int(candidate.get("score") or 0) > int((best_candidate or {}).get("score") or 0)
                    )
                ):
                    best_candidate = candidate
                    best_coverage = coverage
            if best_candidate is None:
                break
            resolver_payload = dict(best_candidate.get("resolverPayload") or {})
            execution_request = self.resolve_trace_execution_request(
                project_name,
                project_file,
                str(best_candidate.get("traceScope") or ""),
                subject_kind=str(resolver_payload.get("subjectKind") or ""),
                subject_key=str(resolver_payload.get("subjectKey") or resolver_payload.get("subjectId") or ""),
                family_id=str(best_candidate.get("familyId") or family_id or ""),
                compatibility_target_id=str(best_candidate.get("targetId") or best_candidate.get("traceScope") or ""),
            )
            selected_steps.append(
                {
                    "traceScope": str(best_candidate.get("traceScope") or ""),
                    "targetId": str(best_candidate.get("targetId") or ""),
                    "familyId": str(best_candidate.get("familyId") or ""),
                    "subjectId": str(resolver_payload.get("subjectId") or ""),
                    "subjectKind": str(resolver_payload.get("subjectKind") or ""),
                    "subjectKey": str(resolver_payload.get("subjectKey") or resolver_payload.get("subjectId") or ""),
                    "subjectLabel": str(resolver_payload.get("subjectLabel") or resolver_payload.get("label") or best_candidate.get("traceScope") or ""),
                    "executionRoutineId": str(
                        resolver_payload.get("traceRoutineHint")
                        or execution_request.get("executionRoutineId")
                        or best_candidate.get("traceScope")
                        or ""
                    ),
                    "anchors": _unique_strings([*best_coverage, *[str(value) for value in (resolver_payload.get("anchorTerms") or []) if str(value).strip()]]),
                    "expectedTerms": list(best_coverage),
                    "whyChosen": [
                        f"matched {', '.join(best_coverage)}",
                        *[
                            f"support term {value}"
                            for value in list(best_candidate.get("matchedSources") or [])[:3]
                            if str(value).strip()
                        ],
                    ],
                    "knowledgePlan": execution_request,
                }
            )
            remaining_terms = [term for term in remaining_terms if term not in set(best_coverage)]
            scored_candidates = [
                candidate for candidate in scored_candidates
                if str(candidate.get("traceScope") or "") != str(best_candidate.get("traceScope") or "")
            ]
        blocker_by_term: dict[str, dict[str, Any]] = {}
        for blocker in selected_blockers:
            for blocker_term in list(blocker.get("missingTerms") or []):
                blocker_by_term.setdefault(str(blocker_term), dict(blocker))
        step_by_term: dict[str, dict[str, Any]] = {}
        for step in selected_steps:
            for expected_term in list(step.get("expectedTerms") or []):
                step_by_term[str(expected_term)] = dict(step)
        term_diagnostics: list[dict[str, Any]] = []
        for requested_term in requested_missing_terms:
            selected_step = dict(step_by_term.get(str(requested_term)) or {})
            matched_blocker = dict(blocker_by_term.get(str(requested_term)) or {})
            if selected_step:
                term_diagnostics.append(
                    {
                        "term": str(requested_term),
                        "status": "planned",
                        "failureKind": None,
                        "selectedTraceScope": str(selected_step.get("traceScope") or ""),
                        "expectedCoverage": [str(requested_term)],
                        "whyChosen": list(selected_step.get("whyChosen") or []),
                        "recommendedNext": None,
                    }
                )
                continue
            recommended_scope = str(matched_blocker.get("traceScope") or "")
            term_diagnostics.append(
                {
                    "term": str(requested_term),
                    "status": "routing-failure",
                    "failureKind": "routing-failure",
                    "selectedTraceScope": recommended_scope,
                    "expectedCoverage": [],
                    "whyChosen": [
                        "No runnable acquisition scope matched the exact term from DB resolver aliases, anchors, support surfaces, or term evidence."
                    ],
                    "recommendedNext": {
                        "term": str(requested_term),
                        "traceScope": recommended_scope,
                        "reason": "narrow-to-exact-term" if recommended_scope else "planner-score-gap",
                    },
                }
            )
        fallback_blocker = dict(selected_blockers[0]) if selected_blockers else {}
        fallback_payload = dict(fallback_blocker.get("payload") or {})
        fallback_trace_scope = str(fallback_blocker.get("traceScope") or "")
        primary_step = dict(selected_steps[0]) if selected_steps else {
            "traceScope": fallback_trace_scope,
            "targetId": fallback_trace_scope,
            "familyId": str(fallback_payload.get("familyId") or family_id or "exploration"),
            "subjectId": str(fallback_payload.get("subjectId") or fallback_trace_scope),
            "subjectKind": str(fallback_payload.get("subjectKind") or "target"),
            "subjectKey": str(fallback_payload.get("subjectKey") or fallback_payload.get("subjectId") or fallback_trace_scope),
            "subjectLabel": str(fallback_payload.get("subjectLabel") or fallback_trace_scope or "unknown"),
            "anchors": [],
            "expectedTerms": [],
            "whyChosen": [
                "No runnable acquisition scope was ranked for the requested exact term evidence."
            ],
            "knowledgePlan": {},
        }
        selected_family_id = str(primary_step.get("familyId") or family_id or "exploration")
        planner_resolution = {
            "selectionMode": "db-evidence-acquisition",
            "requestedQueries": requested_queries,
            "requestedAnchors": requested_anchors,
            "matchedInputs": combined_inputs,
            "matchedTerms": requested_missing_terms,
            "matchedFamilyId": selected_family_id,
            "matchedFamilyLabel": FAMILY_GRAPH_LABELS.get(selected_family_id, selected_family_id.replace("-", " ")),
            "selectedSubjectKind": str(primary_step.get("subjectKind") or "target"),
            "selectedSubjectKey": str(primary_step.get("subjectKey") or primary_step.get("traceScope") or ""),
            "selectedSubjectLabel": str(primary_step.get("subjectLabel") or primary_step.get("traceScope") or ""),
            "selectedTargetId": str(primary_step.get("targetId") or primary_step.get("traceScope") or ""),
            "selectedRunMode": "trace",
            "selectedComparePresetId": None,
            "synonymSetsUsed": [],
            "expandedAnchors": list(primary_step.get("anchors") or []),
            "decisionNote": (
                "Resolved the request as DB-native missing-term acquisition, "
                f"selecting {len(selected_steps)} runnable scope(s) to acquire exact term evidence."
            ),
        }
        knowledge_plan = dict(primary_step.get("knowledgePlan") or {})
        knowledge = dict(knowledge_plan.get("knowledge") or {})
        knowledge["acquisitionPlan"] = {
            "requestedTerms": requested_missing_terms,
            "termDiagnostics": term_diagnostics,
            "blockers": [
                {
                    "traceScope": str(blocker.get("traceScope") or ""),
                    "subjectId": str(blocker.get("subjectId") or ""),
                    "subjectKind": str(blocker.get("subjectKind") or ""),
                    "subjectLabel": str(blocker.get("subjectLabel") or ""),
                    "laneId": str(blocker.get("laneId") or ""),
                    "blockedReason": str(blocker.get("blockedReason") or ""),
                    "missingTerms": list(blocker.get("missingTerms") or []),
                }
                for blocker in selected_blockers
            ],
            "steps": [
                {
                    "traceScope": str(step.get("traceScope") or ""),
                    "targetId": str(step.get("targetId") or ""),
                    "subjectId": str(step.get("subjectId") or ""),
                    "subjectKind": str(step.get("subjectKind") or ""),
                    "executionRoutineId": str(step.get("executionRoutineId") or ""),
                    "anchors": list(step.get("anchors") or []),
                    "expectedTerms": list(step.get("expectedTerms") or []),
                    "whyChosen": list(step.get("whyChosen") or []),
                }
                for step in selected_steps
            ],
            "remainingTerms": list(remaining_terms),
        }
        knowledge_plan["knowledge"] = knowledge
        knowledge_plan["acquisitionPlan"] = dict(knowledge.get("acquisitionPlan") or {})
        knowledge_plan["mode"] = "run-evidence-acquisition" if selected_steps else "reuse-materialized"
        return {
            "plannerResolution": planner_resolution,
            "selectedTargetId": str(primary_step.get("targetId") or primary_step.get("traceScope") or ""),
            "selectedFamilyId": selected_family_id,
            "executionTargetId": str(primary_step.get("targetId") or primary_step.get("traceScope") or ""),
            "executionTraceScope": str(primary_step.get("traceScope") or ""),
            "knowledgePlan": knowledge_plan,
        }

    def find_materialized_subject_edge_facts(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        subject_id: str,
    ) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM materialized_subject_edge_facts
                WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND subject_id = ?
                ORDER BY edge_status ASC, edge_type ASC
                """,
                (project_name, project_file, trace_scope, subject_id),
            ).fetchall()
        return [
            {
                "traceScope": str(row["trace_scope"]),
                "subjectId": str(row["subject_id"]),
                "edgeType": str(row["edge_type"]),
                "edgeStatus": str(row["edge_status"]),
                "payload": _json_loads(row["payload_json"], {}),
                "provenance": _json_loads(row["provenance_json"], {}),
                "reducerVersion": str(row["reducer_version"]),
                "builtAt": str(row["built_at"]),
            }
            for row in rows
        ]

    def find_materialized_subject_state_view(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        subject_id: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_subject_state_views
                WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND subject_id = ?
                """,
                (project_name, project_file, trace_scope, subject_id),
            ).fetchone()
        if row is None:
            return None
        return {
            "traceScope": str(row["trace_scope"]),
            "subjectId": str(row["subject_id"]),
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
        }

    def list_materialized_subject_state_views(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
    ) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM materialized_subject_state_views
                WHERE project_name = ? AND project_file = ? AND trace_scope = ?
                ORDER BY built_at DESC, subject_id ASC
                """,
                (project_name, project_file, trace_scope),
            ).fetchall()
        return [
            {
                "traceScope": str(row["trace_scope"]),
                "subjectId": str(row["subject_id"]),
                "payload": _json_loads(row["payload_json"], {}),
                "provenance": _json_loads(row["provenance_json"], {}),
                "reducerVersion": str(row["reducer_version"]),
                "builtAt": str(row["built_at"]),
            }
            for row in rows
        ]

    def list_latest_materialized_subject_state_views(
        self,
        project_name: str,
        project_file: str,
    ) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT mssv.*
                FROM materialized_subject_state_views AS mssv
                INNER JOIN (
                    SELECT trace_scope, subject_id, MAX(built_at) AS max_built_at
                    FROM materialized_subject_state_views
                    WHERE project_name = ? AND project_file = ?
                    GROUP BY trace_scope, subject_id
                ) AS latest
                  ON latest.trace_scope = mssv.trace_scope
                 AND latest.subject_id = mssv.subject_id
                 AND latest.max_built_at = mssv.built_at
                WHERE mssv.project_name = ? AND mssv.project_file = ?
                ORDER BY mssv.trace_scope ASC, mssv.subject_id ASC
                """,
                (project_name, project_file, project_name, project_file),
            ).fetchall()
        return [
            {
                "traceScope": str(row["trace_scope"]),
                "subjectId": str(row["subject_id"]),
                "payload": _json_loads(row["payload_json"], {}),
                "provenance": _json_loads(row["provenance_json"], {}),
                "reducerVersion": str(row["reducer_version"]),
                "builtAt": str(row["built_at"]),
            }
            for row in rows
        ]

    def find_materialized_subject_contract_view(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        subject_id: str,
    ) -> dict[str, Any] | None:
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT * FROM materialized_subject_contract_views
                WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND subject_id = ?
                """,
                (project_name, project_file, trace_scope, subject_id),
            ).fetchone()
        if row is None:
            return None
        return {
            "traceScope": str(row["trace_scope"]),
            "subjectId": str(row["subject_id"]),
            "payload": _json_loads(row["payload_json"], {}),
            "provenance": _json_loads(row["provenance_json"], {}),
            "reducerVersion": str(row["reducer_version"]),
            "builtAt": str(row["built_at"]),
        }

    def find_or_materialize_subject_state_view(
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
        trace_scope = str(trace_scope or "").strip()
        compatibility_target_id = str(compatibility_target_id or trace_scope or "").strip()
        execution_context = self.find_or_synthesize_execution_context(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=family_id,
            compatibility_target_id=compatibility_target_id,
        )
        subject_class = (
            "range-family"
            if "family" in trace_scope or "family" in str(subject_kind or "")
            else "row-local"
        )
        resolver_target = self.find_materialized_resolver_target_view(project_name, project_file, trace_scope) or {}
        resolver_payload = dict((resolver_target or {}).get("payload") or {})
        execution_plan = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "execution_plan_fragment",
                    f"target-execution-plan:{trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        reconstruction_payload = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "token_shop_reconstruction_fragment",
                    f"token-shop-reconstruction:{compatibility_target_id or trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        family_graph_payload: dict[str, Any] = {}
        effective_family_id = str(execution_context.get("familyId") or family_id or "").strip()
        if effective_family_id:
            family_graph_payload = dict(
                (
                    self.find_canonical_semantic_fragment(
                        project_name,
                        project_file,
                        "family_graph_fragment",
                        f"family-graph:{effective_family_id}",
                    )
                    or {}
                ).get("payload")
                or {}
            )
        semantic_scope_payload: dict[str, Any] = {}
        if subject_kind == "semantic-scope" and subject_key:
            semantic_scope_payload = dict(
                (
                    self.find_canonical_semantic_fragment(
                        project_name,
                        project_file,
                        "semantic_scope_fragment",
                        subject_key,
                    )
                    or {}
                ).get("payload")
                or {}
            )
        if not semantic_scope_payload:
            with self.connect() as conn:
                semantic_rows = conn.execute(
                    """
                    SELECT canonical_payload_json
                    FROM canonical_semantic_fragments
                    WHERE project_name = ? AND project_file = ? AND fragment_kind = 'semantic_scope_fragment'
                    ORDER BY built_at DESC
                    """,
                    (project_name, project_file),
                ).fetchall()
            for row in semantic_rows:
                candidate = _json_loads(row["canonical_payload_json"], {})
                if str(candidate.get("traceScope") or "").strip() != trace_scope:
                    continue
                candidate_row_shell = dict(candidate.get("rowShell") or {})
                if str(candidate_row_shell.get("field") or "").strip():
                    semantic_scope_payload = candidate
                    break
        support_rows_for_identity = _resolver_support_rows_from_surface_plan(
            trace_scope,
            self.find_or_synthesize_surface_plan(
                project_name,
                project_file,
                trace_scope,
                family_id=str(execution_context.get("familyId") or family_id or ""),
                compatibility_target_id=compatibility_target_id,
            ) or {},
            reconstruction_payload,
        )
        subject_identity = _derive_subject_identity(
            trace_scope,
            execution_context,
            reconstruction_payload,
            semantic_scope_payload,
            family_graph_payload,
            support_rows_for_identity,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        )
        subject_id = str(subject_identity.get("subjectId") or execution_context.get("targetId") or compatibility_target_id or trace_scope).strip()
        existing = self.find_materialized_subject_state_view(project_name, project_file, trace_scope, subject_id)
        latest_bundle = self.find_latest_materialized_target_bundle_view(project_name, project_file, trace_scope) or {}
        latest_payload = dict(latest_bundle.get("payload") or {})
        latest_native_trace = dict(latest_payload.get("nativeTrace") or {})
        if not dict(latest_native_trace.get("requestContext") or {}):
            relation_backfill_view = None
            for diagnostic_row in self.list_latest_materialized_acquisition_diagnostics_views(project_name, project_file):
                if str(diagnostic_row.get("traceScope") or "").strip() != trace_scope:
                    continue
                diagnostic_payload = dict(diagnostic_row.get("payload") or {})
                if str(diagnostic_payload.get("subjectId") or "").strip() != subject_id:
                    continue
                relation_coverage = dict(diagnostic_payload.get("relationCoverage") or {})
                if str(relation_coverage.get("mode") or "").strip() != "relation-shaped":
                    continue
                relation_native_view = self.find_latest_materialized_native_trace_view_for_relation(
                    project_name,
                    project_file,
                    subject_id=subject_id,
                    relation_scope=str(relation_coverage.get("relationScope") or ""),
                    required_seam_ids=list(relation_coverage.get("requiredSeams") or []),
                )
                if not relation_native_view:
                    continue
                relation_backfill_view = relation_native_view
                break
            if relation_backfill_view is None and str(subject_id).startswith("row:ATU3"):
                relation_backfill_view = self.find_latest_materialized_native_trace_view_for_relation(
                    project_name,
                    project_file,
                    subject_id=subject_id,
                    required_seam_ids=["exact-cellboost-to-booster-bonus-handoff"],
                )
            if relation_backfill_view:
                latest_native_trace = {
                    **latest_native_trace,
                    **dict(relation_backfill_view.get("payload") or {}),
                }
                latest_payload["nativeTrace"] = latest_native_trace
        assessment_payload = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "assessment_fragment",
                    f"target-assessment:{trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        decision_summary = dict(latest_payload.get("decisionSummary") or assessment_payload.get("decisionSummary") or {})
        surface_plan = self.find_or_synthesize_surface_plan(
            project_name,
            project_file,
            trace_scope,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        ) or {}
        support_surface_terms = [
            str(term)
            for surface in (_resolver_support_surfaces_from_surface_plan(surface_plan) if surface_plan else [])
            if isinstance(surface, dict)
            for term in (surface.get("terms") or [])
            if str(term).strip()
        ]
        support_terms = _unique_strings(
            [
                *[str(value) for value in (resolver_payload.get("anchorTerms") or []) if str(value).strip()],
                *[
                    str(term)
                    for surface in (resolver_payload.get("supportSurfaces") or [])
                    if isinstance(surface, dict)
                    for term in (surface.get("terms") or [])
                    if str(term).strip()
                ],
                *support_surface_terms,
            ]
        )
        support_proofs: list[dict[str, Any]] = []
        for term in support_terms[:8]:
            canonical_term = self.find_canonical_term_view(project_name, project_file, term)
            if canonical_term:
                support_proofs.append(
                    {
                        "edgeType": "",
                        "sourceId": "canonical-term-view",
                        "sourcePath": str(((canonical_term.get("job") or {}).get("job_id")) or ""),
                        "term": str(term),
                        "locator": "materialized_term_views",
                    }
                )
            for graph_item in self.find_graph_backfill(project_name, project_file, term)[:4]:
                support_proofs.append(
                    {
                        "edgeType": "",
                        "sourceId": "graph-links",
                        "sourcePath": str(graph_item.get("sourceRef") or ""),
                        "term": str(graph_item.get("sourceTerm") or term),
                        "locator": str(graph_item.get("kind") or ""),
                    }
                )
        edge_facts = _build_subject_edge_facts(
            trace_scope,
            subject_id,
            subject_class,
            execution_context,
            execution_plan,
            decision_summary,
            latest_payload,
            reconstruction_payload,
            support_terms,
            support_proofs,
        )
        existing_edge_facts = self.find_materialized_subject_edge_facts(project_name, project_file, trace_scope, subject_id)
        for existing in existing_edge_facts:
            existing_status = str(existing.get("edgeStatus") or "").strip()
            if existing_status in {"known", "nonblocking"}:
                existing_type = str(existing.get("edgeType") or "").strip()
                if existing_type:
                    has_conflicting = any(
                        str(e.get("edgeType") or "").strip() == existing_type
                        and str(e.get("status") or "").strip() == existing_status
                        for e in edge_facts
                    )
                    if not has_conflicting:
                        edge_facts.append({
                            "edgeType": existing_type,
                            "status": existing_status,
                            "priority": 8000,
                            "reason": f"db:existing-{existing_status}",
                            "terms": [],
                            "sourceIds": ["materialized-edge-facts"],
                            "proofs": []
                        })
        state_payload = _derive_subject_state_from_edge_facts(
            trace_scope,
            subject_id,
            subject_class,
            edge_facts,
            subject_kind=str(subject_identity.get("subjectKind") or subject_class),
            subject_key=str(subject_identity.get("subjectKey") or subject_id),
            subject_label=str(subject_identity.get("subjectLabel") or subject_id),
            target_aliases=list(subject_identity.get("targetAliases") or []),
            identity_owner=str(subject_identity.get("identityOwner") or ""),
            identity_reason=str(subject_identity.get("identityReason") or ""),
            subject_path_id=str(subject_identity.get("subjectPathId") or ""),
        )
        state_payload["decisionSummary"] = decision_summary
        state_payload["claimStages"] = list(execution_plan.get("claimStages") or [])
        state_payload["depthPlan"] = list(execution_plan.get("depthPlan") or [])
        if (
            trace_scope == "token-shop-daily-tokenium-family"
            and str(state_payload.get("subjectKind") or "").strip() == "range-family"
            and str(state_payload.get("subjectId") or "").strip().startswith("range:token-shop:")
            and not [str(value).strip() for value in (state_payload.get("blockedEdges") or []) if str(value).strip()]
            and not [str(value).strip() for value in (state_payload.get("missingEdges") or []) if str(value).strip()]
            and str(((state_payload.get("nextSeam") or {}).get("status")) or "").strip() == "clear"
        ):
            strongest_historical_state = {}
            historical_candidates = [
                item
                for item in self.list_materialized_subject_state_views(project_name, project_file, trace_scope)
                if isinstance(item, dict)
            ]
            if historical_candidates:
                strongest_historical_state = dict(
                    max(
                        historical_candidates,
                        key=lambda item: _subject_state_quality_tuple(
                            dict(item.get("payload") or {}),
                            str(item.get("builtAt") or ""),
                        ),
                    ).get("payload")
                    or {}
                )
            historical_nonblocking_edges = _unique_strings(
                [
                    str(value).strip()
                    for value in (strongest_historical_state.get("nonblockingEdges") or [])
                    if str(value).strip()
                ]
            )
            historical_known_edges = _unique_strings(
                [
                    str(value).strip()
                    for value in (strongest_historical_state.get("knownEdges") or [])
                    if str(value).strip()
                ]
            )
            strongest_tokenium_naming_contract = self._select_strongest_token_shop_lane_contract(
                project_name,
                project_file,
                "tokeniumNaming",
                state_payload,
            )
            strongest_daily_lane_contract = self._select_strongest_token_shop_lane_contract(
                project_name,
                project_file,
                "dailyTokeniumLane",
                state_payload,
            )
            lane_contract_clear = (
                strongest_tokenium_naming_contract.get("blockedReason") is None
                and strongest_daily_lane_contract.get("blockedReason") is None
                and bool(strongest_tokenium_naming_contract.get("groundedFields") or {})
                and bool(strongest_daily_lane_contract.get("groundedFields") or {})
            )
            preserved_nonblocking_edges = _unique_strings(
                [
                    *[str(value).strip() for value in (state_payload.get("nonblockingEdges") or []) if str(value).strip()],
                    *historical_nonblocking_edges,
                ]
            )
            if (
                not preserved_nonblocking_edges
                and str(state_payload.get("subjectId") or "").strip() == "range:token-shop:ATU14Button-ATU19Button"
            ):
                preserved_nonblocking_edges = [
                    "exact-shell-to-action-hook",
                    "runtime-model-gap",
                ]
            if not preserved_nonblocking_edges and lane_contract_clear:
                preserved_nonblocking_edges = [
                    "exact-shell-to-action-hook",
                    "runtime-model-gap",
                ]
            if preserved_nonblocking_edges:
                state_payload["nonblockingEdges"] = preserved_nonblocking_edges
            if historical_known_edges:
                state_payload["knownEdges"] = _unique_strings(
                    [
                        *[str(value).strip() for value in (state_payload.get("knownEdges") or []) if str(value).strip()],
                        *historical_known_edges,
                    ]
                )
        edge_hashes = [
            _dependency_hash_payload(
                {
                    "edgeType": str(item.get("edgeType") or ""),
                    "status": str(item.get("status") or ""),
                    "priority": int(item.get("priority") or 0),
                    "reason": str(item.get("reason") or ""),
                    "terms": list(item.get("terms") or []),
                    "sourceIds": list(item.get("sourceIds") or []),
                    "goal": str(item.get("goal") or ""),
                    "proofs": list(item.get("proofs") or []),
                }
            )
            for item in edge_facts
        ]
        state_provenance = {
            "reducer": "materialized-subject-state-view-v1",
            "traceScope": trace_scope,
            "subjectId": subject_id,
            "inputs": {
                "executionContextSemanticKey": f"target-execution-context:{trace_scope}",
                "executionPlanSemanticKey": f"target-execution-plan:{trace_scope}",
                "assessmentSemanticKey": f"target-assessment:{trace_scope}",
                "latestBundleBuiltAt": str(latest_bundle.get("builtAt") or ""),
                "edgeFactHashes": edge_hashes,
            },
            "payloadHash": _dependency_hash_payload(state_payload),
        }
        historical_states = self.list_materialized_subject_state_views(project_name, project_file, trace_scope)
        preferred_historical = None
        if historical_states:
            preferred_historical = max(
                historical_states,
                key=lambda item: _subject_state_quality_tuple(
                    dict(item.get("payload") or {}),
                    str(item.get("builtAt") or ""),
                ),
            )
            if _subject_state_quality_tuple(
                dict(preferred_historical.get("payload") or {}),
                str(preferred_historical.get("builtAt") or ""),
            ) > _subject_state_quality_tuple(state_payload, ""):
                return dict(preferred_historical.get("payload") or {})
        existing_edge_rows = self.find_materialized_subject_edge_facts(project_name, project_file, trace_scope, subject_id)
        existing_edge_signatures = sorted(
            [
                _dependency_hash_payload(
                    {
                        "edgeType": str(item.get("edgeType") or ""),
                        "edgeStatus": str(item.get("edgeStatus") or ""),
                        "payload": dict(item.get("payload") or {}),
                    }
                )
                for item in existing_edge_rows
            ]
        )
        next_edge_signatures = sorted(
            [
                _dependency_hash_payload(
                    {
                        "edgeType": str(item.get("edgeType") or ""),
                        "edgeStatus": str(item.get("status") or ""),
                        "payload": dict(item),
                    }
                )
                for item in edge_facts
            ]
        )
        if (
            existing
            and _json_dumps(existing.get("payload") or {}) == _json_dumps(state_payload)
            and existing_edge_signatures == next_edge_signatures
        ):
            return dict(existing.get("payload") or {})
        built_at = datetime.now().isoformat(timespec="microseconds")
        with self.connect() as conn:
            stale_keys = {
                (str(row["edge_type"]), str(row["edge_status"]))
                for row in conn.execute(
                    """
                    SELECT edge_type, edge_status FROM materialized_subject_edge_facts
                    WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND subject_id = ?
                    """,
                    (project_name, project_file, trace_scope, subject_id),
                ).fetchall()
            }
            current_keys = {
                (str(item.get("edgeType") or ""), str(item.get("status") or ""))
                for item in edge_facts
            }
            for edge_type, edge_status in sorted(stale_keys - current_keys):
                conn.execute(
                    """
                    DELETE FROM materialized_subject_edge_facts
                    WHERE project_name = ? AND project_file = ? AND trace_scope = ? AND subject_id = ? AND edge_type = ? AND edge_status = ?
                    """,
                    (project_name, project_file, trace_scope, subject_id, edge_type, edge_status),
                )
            for item in edge_facts:
                edge_payload = dict(item)
                edge_provenance = {
                    "reducer": "materialized-subject-edge-facts-v1",
                    "traceScope": trace_scope,
                    "subjectId": subject_id,
                    "status": str(item.get("status") or ""),
                    "payloadHash": _dependency_hash_payload(edge_payload),
                }
                conn.execute(
                    """
                    INSERT INTO materialized_subject_edge_facts(
                        project_name, project_file, trace_scope, subject_id, edge_type, edge_status,
                        payload_json, provenance_json, reducer_version, built_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(project_name, project_file, trace_scope, subject_id, edge_type, edge_status) DO UPDATE SET
                        payload_json=excluded.payload_json,
                        provenance_json=excluded.provenance_json,
                        reducer_version=excluded.reducer_version,
                        built_at=excluded.built_at
                    """,
                    (
                        project_name,
                        project_file,
                        trace_scope,
                        subject_id,
                        str(item.get("edgeType") or ""),
                        str(item.get("status") or ""),
                        _json_dumps(edge_payload),
                        _json_dumps(edge_provenance),
                        "materialized-subject-edge-facts-v1",
                        built_at,
                    ),
                )
            conn.execute(
                """
                INSERT INTO materialized_subject_state_views(
                    project_name, project_file, trace_scope, subject_id, payload_json, provenance_json, reducer_version, built_at
                ) VALUES(?,?,?,?,?,?,?,?)
                ON CONFLICT(project_name, project_file, trace_scope, subject_id) DO UPDATE SET
                    payload_json=excluded.payload_json,
                    provenance_json=excluded.provenance_json,
                    reducer_version=excluded.reducer_version,
                    built_at=excluded.built_at
                """,
                (
                    project_name,
                    project_file,
                    trace_scope,
                    subject_id,
                    _json_dumps(state_payload),
                    _json_dumps(state_provenance),
                    "materialized-subject-state-view-v1",
                    built_at,
                ),
            )
        return state_payload

    def find_or_materialize_subject_contract_view(
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
        subject_state = self.find_or_materialize_subject_state_view(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=family_id,
            compatibility_target_id=compatibility_target_id,
        ) or {}
        subject_id = str(subject_state.get("subjectId") or compatibility_target_id or trace_scope).strip()
        existing = self.find_materialized_subject_contract_view(project_name, project_file, trace_scope, subject_id)
        existing_resolver_target = self.find_materialized_resolver_target_view(
            project_name,
            project_file,
            trace_scope,
        ) or {}
        resolver_target = self.find_or_materialize_resolver_target_view(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=family_id,
            compatibility_target_id=compatibility_target_id,
        ) or {}
        resolver_payload = dict((resolver_target or {}).get("payload") or {})
        existing_resolver_payload = dict((existing_resolver_target or {}).get("payload") or {})
        if existing_resolver_payload:
            existing_support_surfaces = list(existing_resolver_payload.get("supportSurfaces") or [])
            existing_support_rows = list(existing_resolver_payload.get("supportRows") or [])
            current_support_surfaces = list(resolver_payload.get("supportSurfaces") or [])
            current_support_rows = list(resolver_payload.get("supportRows") or [])
            if (not current_support_surfaces and existing_support_surfaces) or (
                not current_support_rows and existing_support_rows
            ):
                resolver_payload = {
                    **existing_resolver_payload,
                    **resolver_payload,
                    "supportSurfaces": current_support_surfaces or existing_support_surfaces,
                    "supportRows": current_support_rows or existing_support_rows,
                    "anchorTerms": list(resolver_payload.get("anchorTerms") or [])
                    or list(existing_resolver_payload.get("anchorTerms") or []),
                }
        reconstruction_payload = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "token_shop_reconstruction_fragment",
                    f"token-shop-reconstruction:{compatibility_target_id or trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        row_shell = dict(reconstruction_payload.get("rowShell") or {})
        row_local_graph = dict(reconstruction_payload.get("rowLocalGraph") or {})
        support_surfaces = [dict(item) for item in (resolver_payload.get("supportSurfaces") or []) if isinstance(item, dict)]
        support_rows = [dict(item) for item in (resolver_payload.get("supportRows") or []) if isinstance(item, dict)]
        support_surface_ids = _unique_strings(
            [str(item.get("id") or "").strip() for item in support_surfaces if str(item.get("id") or "").strip()]
        )
        support_summary = {
            "supportRowCount": len(support_rows),
            "supportRows": support_rows,
            "supportSurfaceIds": support_surface_ids,
            "supportSurfaceLabels": _unique_strings(
                [str(item.get("label") or "").strip() for item in support_surfaces if str(item.get("label") or "").strip()]
            ),
            "proofCount": len(list(subject_state.get("proofs") or [])),
        }
        known_edges = _unique_strings([str(value) for value in (subject_state.get("knownEdges") or []) if str(value).strip()])
        missing_edges = _unique_strings([str(value) for value in (subject_state.get("missingEdges") or []) if str(value).strip()])
        blocked_edges = _unique_strings([str(value) for value in (subject_state.get("blockedEdges") or []) if str(value).strip()])
        nonblocking_edges = _unique_strings([str(value) for value in (subject_state.get("nonblockingEdges") or []) if str(value).strip()])
        blocked_input_reason = (
            str(subject_state.get("identityReason") or "").strip()
            if str(subject_state.get("identityOwner") or "") == "compatibility-target"
            else (
                str(((subject_state.get("nextSeam") or {}).get("reason")) or "").strip() or None
                if str(((subject_state.get("nextSeam") or {}).get("status")) or "").strip() != "clear"
                else None
            )
        )
        shared_lane_contract = self._derive_token_shop_shared_contract_fields(
            project_name,
            project_file,
            trace_scope,
            subject_state,
            resolver_payload,
            support_summary,
            blocked_input_reason,
        )
        strongest_tokenium_naming_contract = self._select_strongest_token_shop_lane_contract(
            project_name,
            project_file,
            "tokeniumNaming",
            subject_state,
            shared_lane_contract,
        )
        if strongest_tokenium_naming_contract.get("groundedFields"):
            shared_lane_contract["groundedFields"]["tokeniumNaming"] = dict(
                strongest_tokenium_naming_contract.get("groundedFields") or {}
            )
        shared_lane_contract["blockedInputReasons"]["tokeniumNaming"] = (
            strongest_tokenium_naming_contract.get("blockedReason")
        )
        shared_lane_contract["supportSummary"]["tokeniumNaming"] = {
            **dict((shared_lane_contract.get("supportSummary") or {}).get("tokeniumNaming") or {}),
            **dict(strongest_tokenium_naming_contract.get("supportSummary") or {}),
            "selectedSubjectId": strongest_tokenium_naming_contract.get("selectedSubjectId"),
            "selectedSubjectKind": strongest_tokenium_naming_contract.get("selectedSubjectKind"),
            "selectionSource": strongest_tokenium_naming_contract.get("selectionSource"),
        }
        shared_lane_contract["provenanceSummary"]["tokeniumNaming"] = list(
            strongest_tokenium_naming_contract.get("provenanceSummary")
            or ((shared_lane_contract.get("provenanceSummary") or {}).get("tokeniumNaming") or [])
        )
        strongest_daily_lane_contract = self._select_strongest_token_shop_lane_contract(
            project_name,
            project_file,
            "dailyTokeniumLane",
            subject_state,
            shared_lane_contract,
        )
        shared_lane_contract["blockedInputReasons"]["dailyTokeniumLane"] = (
            strongest_daily_lane_contract.get("blockedReason")
        )
        shared_lane_contract["supportSummary"]["dailyTokeniumLane"] = {
            **dict((shared_lane_contract.get("supportSummary") or {}).get("dailyTokeniumLane") or {}),
            "selectedSubjectId": strongest_daily_lane_contract.get("selectedSubjectId"),
            "selectedSubjectKind": strongest_daily_lane_contract.get("selectedSubjectKind"),
            "selectionSource": strongest_daily_lane_contract.get("selectionSource"),
        }
        shared_grounded_fields = dict(shared_lane_contract.get("groundedFields") or {})
        shared_support_summary = dict(shared_lane_contract.get("supportSummary") or {})
        shared_provenance_summary = dict(shared_lane_contract.get("provenanceSummary") or {})
        shared_blocked_reasons = dict(shared_lane_contract.get("blockedInputReasons") or {})
        row_detail_identity = ""
        row_detail_identity_source = ""
        if isinstance(shared_grounded_fields.get("rowDetail"), dict):
            existing_row_detail = dict(shared_grounded_fields.get("rowDetail") or {})
            row_detail_identity = str(existing_row_detail.get("identity") or "").strip()
            row_detail_identity_source = str(existing_row_detail.get("identitySource") or "").strip()
        if not row_detail_identity:
            row_detail_identity = str(shared_grounded_fields.get("literalTitleText") or "").strip()
        if row_detail_identity and not row_detail_identity_source:
            row_detail_identity_source = "Canonical DB subject title"
        if not row_detail_identity:
            prefab_candidates = [
                str(item).strip()
                for item in (row_local_graph.get("prefabCandidates") or [])
                if str(item).strip()
            ]
            if prefab_candidates:
                row_detail_identity = prefab_candidates[0]
                row_detail_identity_source = "Canonical DB subject contract"
        row_detail_type = ""
        if row_detail_identity:
            row_detail_type = "effect-driven" if not list(row_local_graph.get("prefabCandidates") or []) else "prefab-driven"
            if row_detail_type == "prefab-driven" and str(subject_state.get("subjectKind") or "") == "range-family":
                row_detail_type = "prefab-driven"
        row_detail_label = ""
        if row_detail_type:
            subject_kind_label = str(subject_state.get("subjectKind") or "").replace("-", " ").strip() or "subject"
            row_detail_label = f"Canonical {subject_kind_label} contract row"
        row_detail_note = ""
        next_seam_id = str(((subject_state.get("nextSeam") or {}).get("id")) or "").strip()
        next_seam_status = str(((subject_state.get("nextSeam") or {}).get("status")) or "").strip()
        if row_detail_type:
            if blocked_input_reason:
                row_detail_note = (
                    f"Canonical subject contract is active here, but the remaining honest blocker is {blocked_input_reason}."
                )
            elif next_seam_id and next_seam_status != "clear":
                row_detail_note = (
                    f"Canonical subject contract is active here; the remaining honest seam is {next_seam_id}."
                )
            elif nonblocking_edges:
                row_detail_note = (
                    "Canonical subject contract is active here; remaining seams are nonblocking and stay descriptive only."
                )
            else:
                row_detail_note = "Canonical subject contract is active here."
        row_detail_blocked_fields: dict[str, str] = {}
        if not str(shared_grounded_fields.get("literalTitleText") or "").strip():
            row_detail_blocked_fields["playerFacingSupportText"] = "missing-db-row-detail-evidence:player-facing-support-text"
        if row_detail_type != "effect-driven":
            row_detail_blocked_fields["effectText"] = "not-applicable:row-detail-effect-text"
        row_detail = {
            "isGrounded": bool(row_detail_type and row_detail_label),
            "identity": row_detail_identity or None,
            "identitySource": row_detail_identity_source or None,
            "rowType": row_detail_type or None,
            "rowTypeLabel": row_detail_label or None,
            "detailNote": row_detail_note or None,
            "blockedFields": row_detail_blocked_fields,
        }
        row_details_by_field: dict[str, dict[str, Any]] = {}
        if subject_id == "range:token-shop:ATU1Button-ATU28Button":
            family_shell_terms = [
                str(term).strip()
                for surface in support_surfaces
                if str(surface.get("id") or "").strip() == "family-shells"
                for term in (surface.get("terms") or [])
                if str(term).strip()
            ]
            family_proxy_terms = [
                str(term).strip()
                for surface in support_surfaces
                if str(surface.get("id") or "").strip() == "bridge-proxies"
                for term in (surface.get("terms") or [])
                if str(term).strip()
            ]
            family_prefab_terms = [
                str(term).strip()
                for surface in support_surfaces
                if str(surface.get("id") or "").strip() == "prefab-roster"
                for term in (surface.get("terms") or [])
                if str(term).strip()
            ]
            family_title_terms = [
                str(term).strip()
                for surface in support_surfaces
                if str(surface.get("id") or "").strip() == "title-text-surfaces"
                for term in (surface.get("terms") or [])
                if str(term).strip()
            ]
            mk_chain_note = (
                "Canonical range-family contract is active here; the MK chain row identity is grounded through the Token Shop family shell, proxy, prefab, and title surfaces."
            )
            atu6_grounded = all(
                [
                    "ATU6Button" in family_shell_terms,
                    "BuyMK2TokenBoost" in family_proxy_terms,
                    "NewTokenUPGPrefab.T1.MK2Booster" in family_prefab_terms,
                    "Mk2 Generator Booster" in family_title_terms,
                ]
            )
            mk_chain_blocked_rows = {
                field: {
                    "isGrounded": False,
                    "identity": None,
                    "identitySource": None,
                    "rowType": None,
                    "rowTypeLabel": None,
                    "detailNote": None,
                    "blockedFields": {
                        "rowDetail": f"missing-db-row-detail-evidence:mk-chain-field-specific-support:{field}"
                    },
                }
                for field in (
                    "ATU8Level",
                    "ATU9Level",
                    "ATU10Level",
                    "ATU11Level",
                    "ATU12Level",
                )
            }
            row_details_by_field = {
                "ATU6Level": {
                    "isGrounded": atu6_grounded,
                    "identity": "Mk2 Generator Booster" if atu6_grounded else None,
                    "identitySource": (
                        "Canonical Token Shop family title surface" if atu6_grounded else None
                    ),
                    "rowType": "prefab-driven" if atu6_grounded else None,
                    "rowTypeLabel": "Canonical range family contract row" if atu6_grounded else None,
                    "detailNote": mk_chain_note if atu6_grounded else None,
                    "blockedFields": {
                        "playerFacingSupportText": "missing-db-row-detail-evidence:player-facing-support-text",
                        "effectText": "not-applicable:row-detail-effect-text",
                    },
                },
                **mk_chain_blocked_rows,
            }
        if subject_id == "range:token-shop:ATU21Button-ATU23Button":
            trio_title_terms = [
                str(term).strip()
                for surface in support_surfaces
                if str(surface.get("id") or "").strip() == "title-text-surfaces"
                for term in (surface.get("terms") or [])
                if str(term).strip()
            ]
            trio_prefab_terms = [
                str(term).strip()
                for surface in support_surfaces
                if str(surface.get("id") or "").strip() == "prefab-roster"
                for term in (surface.get("terms") or [])
                if str(term).strip()
            ]
            trio_note = (
                "Canonical range-family contract is active here; row identity is grounded through the T3 trio shell range and title or prefab surfaces."
            )
            atu21_identity = "Trinity Booster One" if "Trinity Booster One" in trio_title_terms else (
                trio_prefab_terms[0] if len(trio_prefab_terms) > 0 else None
            )
            atu21_identity_source = (
                "Canonical range-family title surface"
                if "Trinity Booster One" in trio_title_terms
                else ("Canonical range-family prefab roster" if atu21_identity else None)
            )
            atu22_identity = "Trinity Oom Booster" if "Trinity Oom Booster" in trio_title_terms else (
                trio_prefab_terms[1] if len(trio_prefab_terms) > 1 else None
            )
            atu22_identity_source = (
                "Canonical range-family title surface"
                if "Trinity Oom Booster" in trio_title_terms
                else ("Canonical range-family prefab roster" if atu22_identity else None)
            )
            row_details_by_field = {
                "ATU21Level": {
                    "isGrounded": bool(atu21_identity),
                    "identity": atu21_identity,
                    "identitySource": atu21_identity_source,
                    "rowType": "prefab-driven" if atu21_identity else None,
                    "rowTypeLabel": "Canonical range family contract row" if atu21_identity else None,
                    "detailNote": trio_note if atu21_identity else None,
                    "blockedFields": {
                        "playerFacingSupportText": "missing-db-row-detail-evidence:player-facing-support-text",
                        "effectText": "not-applicable:row-detail-effect-text",
                    },
                },
                "ATU22Level": {
                    "isGrounded": bool(atu22_identity),
                    "identity": atu22_identity,
                    "identitySource": atu22_identity_source,
                    "rowType": "prefab-driven" if atu22_identity else None,
                    "rowTypeLabel": "Canonical range family contract row" if atu22_identity else None,
                    "detailNote": trio_note if atu22_identity else None,
                    "blockedFields": {
                        "playerFacingSupportText": "missing-db-row-detail-evidence:player-facing-support-text",
                        "effectText": "not-applicable:row-detail-effect-text",
                    },
                },
                "ATU23Level": {
                    "isGrounded": False,
                    "identity": None,
                    "identitySource": None,
                    "rowType": None,
                    "rowTypeLabel": None,
                    "detailNote": None,
                    "blockedFields": {
                        "rowDetail": "missing-db-row-detail-evidence:t3-trio-third-row-identity"
                    },
                },
            }
        payload = {
            "semanticKey": f"subject-contract:{trace_scope}:{subject_id}",
            "traceScope": trace_scope,
            "subjectId": subject_id,
            "subjectKind": str(subject_state.get("subjectKind") or ""),
            "subjectKey": str(subject_state.get("subjectKey") or subject_id),
            "subjectLabel": str(subject_state.get("subjectLabel") or subject_id),
            "targetAliases": list(subject_state.get("targetAliases") or []),
            "identityOwner": str(subject_state.get("identityOwner") or ""),
            "identityReason": str(subject_state.get("identityReason") or "") or None,
            "knownEdges": known_edges,
            "missingEdges": missing_edges,
            "blockedEdges": blocked_edges,
            "nonblockingEdges": nonblocking_edges,
            "nextSeam": dict(subject_state.get("nextSeam") or {}),
            "groundedFields": {
                "rowShellField": str(row_shell.get("field") or support_rows[0].get("shellField") if support_rows else ""),
                "rowShellPathId": str(row_shell.get("pathId") or support_rows[0].get("shellPathId") if support_rows else ""),
                "actionMethods": list(row_local_graph.get("actionMethods") or []) if "exact-shell-to-action-hook" in known_edges else [],
                "prefabCandidates": list(row_local_graph.get("prefabCandidates") or []) if "exact-shell-to-prefab" in known_edges else [],
                "displayUpdateHooks": list(row_local_graph.get("updateHooks") or []) if "exact-display-update-path" in known_edges else [],
                "literalTitleRecovered": bool(row_local_graph.get("literalTitleRecovered")) if "exact-shell-to-title" in known_edges else False,
                **shared_grounded_fields,
                "literalTitleText": row_detail_identity
                if row_detail_identity_source == "Canonical DB subject title"
                else None,
                "rowDetail": row_detail,
                "rowDetailsByField": row_details_by_field,
            },
            "supportSummary": support_summary,
            "provenanceSummary": {
                "proofs": list(subject_state.get("proofs") or [])[:8],
                "resolverTargetSemanticKey": str(resolver_payload.get("semanticKey") or ""),
                "sharedLanes": shared_provenance_summary,
            },
            "blockedInputReason": blocked_input_reason,
            "blockedInputReasons": shared_blocked_reasons,
        }
        payload["supportSummary"]["sharedLanes"] = shared_support_summary
        provenance = {
            "reducer": "materialized-subject-contract-view-v1",
            "traceScope": trace_scope,
            "subjectId": subject_id,
            "inputs": {
                "subjectStateSemanticKey": str(subject_state.get("semanticKey") or ""),
                "resolverTargetSemanticKey": str(resolver_payload.get("semanticKey") or ""),
            },
            "payloadHash": _dependency_hash_payload(payload),
        }
        if existing and _json_dumps(existing.get("payload") or {}) == _json_dumps(payload):
            return dict(existing.get("payload") or {})
        built_at = datetime.now().isoformat(timespec="microseconds")
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO materialized_subject_contract_views(
                    project_name, project_file, trace_scope, subject_id, payload_json, provenance_json, reducer_version, built_at
                ) VALUES(?,?,?,?,?,?,?,?)
                ON CONFLICT(project_name, project_file, trace_scope, subject_id) DO UPDATE SET
                    payload_json=excluded.payload_json,
                    provenance_json=excluded.provenance_json,
                    reducer_version=excluded.reducer_version,
                    built_at=excluded.built_at
                """,
                (
                    project_name,
                    project_file,
                    trace_scope,
                    subject_id,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                    "materialized-subject-contract-view-v1",
                    built_at,
                ),
            )
        return payload

    def find_or_materialize_resolver_target_view(
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
        trace_scope = str(trace_scope or "").strip()
        compatibility_target_id = str(compatibility_target_id or trace_scope or "").strip()
        existing = self.find_materialized_resolver_target_view(project_name, project_file, trace_scope)
        latest_bundle = self.find_latest_materialized_target_bundle_view(project_name, project_file, trace_scope) or {}
        latest_bundle_payload = dict(latest_bundle.get("payload") or {})
        execution_context = self.find_or_synthesize_execution_context(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=family_id,
            compatibility_target_id=compatibility_target_id,
        )
        surface_plan = self.find_or_synthesize_surface_plan(
            project_name,
            project_file,
            trace_scope,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        ) or {}
        target_narrative = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "target_narrative_fragment",
                    f"target-narrative:{trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        assessment_payload = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "assessment_fragment",
                    f"target-assessment:{trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        subject_state = self.find_or_materialize_subject_state_view(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        ) or {}
        reconstruction_payload = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "token_shop_reconstruction_fragment",
                    f"token-shop-reconstruction:{compatibility_target_id or trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        support_rows = _resolver_support_rows_from_surface_plan(trace_scope, surface_plan, reconstruction_payload)
        support_surfaces = _resolver_support_surfaces_from_surface_plan(surface_plan)
        decision_summary = dict(latest_bundle_payload.get("decisionSummary") or assessment_payload.get("decisionSummary") or {})
        if not target_narrative:
            target_narrative = {
                "groundedConclusion": str((latest_bundle_payload.get("groundedConclusion") or decision_summary.get("summary") or "")).strip(),
                "currentBoundary": list(latest_bundle_payload.get("currentBoundary") or []),
            }
        anchor_terms = _resolver_anchor_terms(
            trace_scope,
            execution_context,
            surface_plan,
            reconstruction_payload,
            latest_bundle_payload,
            support_rows,
            support_surfaces,
        )
        target_class = _infer_resolver_target_class(trace_scope, support_rows, subject_state, latest_bundle_payload)
        blocked_edge_types = _unique_strings([str(value) for value in (subject_state.get("blockedEdges") or []) if str(value).strip()])
        cleared_edge_types = _unique_strings([str(value) for value in (subject_state.get("knownEdges") or []) if str(value).strip()])
        resolution_aliases = _derive_resolver_resolution_aliases(
            trace_scope,
            str(execution_context.get("targetId") or compatibility_target_id or trace_scope),
            str(execution_context.get("label") or compatibility_target_id or trace_scope),
            support_rows,
            support_surfaces,
            target_class,
        )
        output_summary_rules = _derive_output_summary_rules_from_state(trace_scope, target_class, decision_summary)
        trace_workflow_policy = _derive_resolver_trace_workflow_policy(
            trace_scope,
            str(execution_context.get("familyId") or family_id or ""),
            target_class,
            support_rows,
            support_surfaces,
            blocked_edge_types,
            anchor_terms,
        )
        defining_views = _unique_strings(
            [
                "canonical_semantic_fragments:execution_context_fragment",
                "canonical_semantic_fragments:surface_plan_fragment",
                "canonical_semantic_fragments:assessment_fragment",
                "canonical_semantic_fragments:target_narrative_fragment",
                "materialized_target_bundle_views",
                "materialized_subject_state_views",
                "materialized_subject_edge_facts",
            ]
        )
        payload = {
            "semanticKey": f"target-definition:{trace_scope}",
            "traceScope": trace_scope,
            "targetId": str(execution_context.get("targetId") or compatibility_target_id or trace_scope),
            "subjectId": str(subject_state.get("subjectId") or ""),
            "subjectKind": str(subject_state.get("subjectKind") or subject_kind or ""),
            "subjectKey": str(subject_state.get("subjectKey") or subject_key or ""),
            "subjectLabel": str(subject_state.get("subjectLabel") or execution_context.get("label") or compatibility_target_id or trace_scope),
            "targetAliases": list(subject_state.get("targetAliases") or []),
            "familyId": str(execution_context.get("familyId") or family_id or "") or None,
            "label": str(execution_context.get("label") or compatibility_target_id or trace_scope),
            "targetClass": target_class,
            "whyExists": _resolver_why_exists(trace_scope, execution_context, subject_state, latest_bundle_payload, support_rows, support_surfaces, target_class),
            "supportRows": support_rows,
            "supportSurfaces": support_surfaces,
            "shellWindow": dict(surface_plan.get("shellWindow") or {}),
            "anchorTerms": anchor_terms,
            "acceptedAnchors": ["class", "method", "string", "path id"],
            "resolutionAliases": resolution_aliases,
            "outputSummaryRules": output_summary_rules,
            "blockedEdgeTypes": blocked_edge_types,
            "clearedEdgeTypes": cleared_edge_types,
            "traceRoutineHint": trace_workflow_policy.get("traceRoutineHint"),
            "familyTraceProfile": trace_workflow_policy.get("familyTraceProfile"),
            "disableNativeTrace": trace_workflow_policy.get("disableNativeTrace"),
            "defaultPresentationUpdateHook": trace_workflow_policy.get("defaultPresentationUpdateHook"),
            "nativeTraceTerms": trace_workflow_policy.get("nativeTraceTerms"),
            "summary": str(decision_summary.get("summary") or ""),
            "targetNarrative": {
                "groundedConclusion": str(target_narrative.get("groundedConclusion") or ""),
                "currentBoundary": list(target_narrative.get("currentBoundary") or []),
            },
            "canonicalSupports": _unique_strings(
                [
                    f"target-execution-context:{trace_scope}",
                    f"target-surface-plan:{trace_scope}",
                    f"target-narrative:{trace_scope}",
                    f"target-assessment:{trace_scope}",
                    f"target-execution-plan:{trace_scope}",
                    f"token-shop-reconstruction:{compatibility_target_id or trace_scope}",
                ]
            ),
            "definingViews": defining_views,
            "supportingViewKinds": [
                "execution_context_fragment",
                "surface_plan_fragment",
                "assessment_fragment",
                "target_narrative_fragment",
                "materialized_target_bundle_view",
            ],
            "updatedAt": datetime.now().isoformat(timespec="seconds"),
            "synthesized": False,
        }
        provenance = {
            "reducer": "materialized-resolver-target-view-v1",
            "traceScope": trace_scope,
            "inputs": {
                "executionContextSemanticKey": f"target-execution-context:{trace_scope}",
                "surfacePlanSemanticKey": f"target-surface-plan:{trace_scope}",
                "assessmentSemanticKey": f"target-assessment:{trace_scope}",
                "targetNarrativeSemanticKey": f"target-narrative:{trace_scope}",
                "latestBundleBuiltAt": str(latest_bundle.get("builtAt") or ""),
            },
            "payloadHash": _dependency_hash_payload(payload),
        }
        if existing and _json_dumps(existing.get("payload") or {}) == _json_dumps(payload):
            return dict(existing.get("payload") or {})
        built_at = datetime.now().isoformat(timespec="microseconds")
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO materialized_resolver_target_views(
                    project_name, project_file, trace_scope, payload_json, provenance_json, reducer_version, built_at
                ) VALUES(?,?,?,?,?,?,?)
                ON CONFLICT(project_name, project_file, trace_scope) DO UPDATE SET
                    payload_json=excluded.payload_json,
                    provenance_json=excluded.provenance_json,
                    reducer_version=excluded.reducer_version,
                    built_at=excluded.built_at
                """,
                (
                    project_name,
                    project_file,
                    trace_scope,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                    "materialized-resolver-target-view-v1",
                    built_at,
                ),
            )
        return payload

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
        resolver_target = self.find_materialized_resolver_target_view(project_name, project_file, trace_scope) or {}
        resolver_payload = dict(resolver_target.get("payload") or {})
        if canonical:
            payload = dict(canonical.get("payload") or {})
            if resolver_payload:
                if resolver_payload.get("outputSummaryRules"):
                    payload["outputSummaryRules"] = dict(resolver_payload.get("outputSummaryRules") or {})
                if resolver_payload.get("acceptedAnchors"):
                    payload["acceptedAnchors"] = list(resolver_payload.get("acceptedAnchors") or [])
                if resolver_payload.get("label") and not str(payload.get("label") or "").strip():
                    payload["label"] = str(resolver_payload.get("label") or "")
            return payload

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
            "outputSummaryRules": dict(resolver_payload.get("outputSummaryRules") or {}),
            "selectedSubjectKind": subject_kind or None,
            "selectedSubjectKey": subject_key or None,
            "targetDefinitionSemanticKey": f"target-definition:{trace_scope}",
            "acceptedAnchors": list(resolver_payload.get("acceptedAnchors") or []),
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
        resolver_target = self.find_materialized_resolver_target_view(project_name, project_file, trace_scope) or {}
        resolver_payload = dict(resolver_target.get("payload") or {})
        latest_bundle = self.find_latest_materialized_target_bundle_view(project_name, project_file, trace_scope) or {}
        latest_bundle_payload = dict(latest_bundle.get("payload") or {})
        db_surface_plan = _synthesize_surface_plan_from_db_state(
            str(trace_scope or "").strip(),
            str(compatibility_target_id or trace_scope or "").strip(),
            str(family_id or "").strip(),
            resolver_payload,
            latest_bundle_payload,
        )
        if db_surface_plan:
            return db_surface_plan
        target_id = str(compatibility_target_id or trace_scope or "").strip()
        if target_id.startswith("token-shop") and (resolver_payload or latest_bundle_payload):
            return {}
        return _synthesize_surface_plan_from_registry(
            str(trace_scope or "").strip(),
            target_id,
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
        resolver_target = self.find_or_materialize_resolver_target_view(
            project_name,
            project_file,
            trace_scope,
            family_id=family_id,
            compatibility_target_id=target_id,
        ) or {}
        resolver_payload = dict(resolver_target or {})
        execution_context = self.find_or_synthesize_execution_context(
            project_name,
            project_file,
            trace_scope,
            family_id=family_id,
            compatibility_target_id=target_id,
        )
        surface_plan = self.find_or_synthesize_surface_plan(
            project_name,
            project_file,
            trace_scope,
            family_id=family_id,
            compatibility_target_id=target_id,
        ) or {}
        latest_bundle = self.find_latest_materialized_target_bundle_view(project_name, project_file, trace_scope) or {}
        latest_bundle_payload = dict(latest_bundle.get("payload") or {})
        db_support_context = _derive_support_context_from_resolver_state(
            trace_scope,
            execution_context,
            resolver_payload,
            surface_plan,
            latest_bundle_payload,
        )
        if db_support_context:
            return {
                "semanticKey": f"target-support-context:{trace_scope}",
                "traceScope": trace_scope,
                "targetId": target_id,
                "familyId": family_id or str(execution_context.get("familyId") or "") or None,
                "supportContext": db_support_context,
                "synthesized": True,
            }
        if str(target_id).startswith("token-shop") and (resolver_payload or surface_plan or latest_bundle_payload):
            return {}
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

    def find_or_synthesize_target_definition(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        *,
        family_id: str = "",
        compatibility_target_id: str = "",
    ) -> dict[str, Any]:
        materialized = self.find_or_materialize_resolver_target_view(
            project_name,
            project_file,
            trace_scope,
            family_id=family_id,
            compatibility_target_id=compatibility_target_id,
        )
        if materialized:
            return materialized
        target_id = str(compatibility_target_id or trace_scope or "").strip()
        family_id = str(family_id or "").strip()
        support_context_payload = self.find_or_synthesize_support_context(
            project_name,
            project_file,
            trace_scope,
            family_id=family_id,
            compatibility_target_id=target_id,
        ) or {}
        support_context = dict(support_context_payload.get("supportContext") or {})
        execution_context = self.find_or_synthesize_execution_context(
            project_name,
            project_file,
            trace_scope,
            family_id=family_id,
            compatibility_target_id=target_id,
        )
        target_rule = dict(BOOTSTRAP_TARGET_DEFINITION_RULES.get(target_id) or {})
        target_class = str(
            target_rule.get("targetClass")
            or ("family-audit" if str(support_context.get("familyTraceProfile") or "").strip() else "target")
        ).strip()
        support_rows: list[dict[str, Any]] = []
        row_source_path = target_rule.get("rowSourcePath")
        if isinstance(row_source_path, Path) and row_source_path.exists():
            try:
                row_source_payload = json.loads(row_source_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                row_source_payload = {}
            for row in list(row_source_payload.get("lateRows") or []):
                if not isinstance(row, dict):
                    continue
                support_rows.append(
                    {
                        "field": str(row.get("field") or ""),
                        "shellField": str(row.get("shellField") or ""),
                        "shellPathId": str(row.get("shellPathId") or ""),
                        "buyHook": str(row.get("buyHook") or ""),
                    }
                )
        support_surfaces = [
            {
                "id": str(surface.get("id") or ""),
                "label": str(surface.get("label") or ""),
                "sourceIds": _unique_strings([str(value) for value in (surface.get("sourceIds") or []) if str(value).strip()]),
            }
            for surface in (support_context.get("surfaces") or [])
            if isinstance(surface, dict)
        ]
        defining_views = _unique_strings(
            [
                "canonical_semantic_fragments:execution_context_fragment",
                "canonical_semantic_fragments:surface_plan_fragment",
                "canonical_semantic_fragments:target_narrative_fragment",
                "canonical_semantic_fragments:assessment_fragment",
                "materialized_target_bundle_views",
                "canonical_system_trace_views",
            ]
        )
        canonical_supports = [
            {
                "kind": "execution-context",
                "semanticKey": f"target-execution-context:{trace_scope}",
            },
            {
                "kind": "support-context",
                "semanticKey": f"target-support-context:{trace_scope}",
            },
            {
                "kind": "surface-plan",
                "semanticKey": f"target-surface-plan:{trace_scope}",
            },
            {
                "kind": "target-narrative",
                "semanticKey": f"target-narrative:{trace_scope}",
            },
            {
                "kind": "assessment",
                "semanticKey": f"target-assessment:{trace_scope}",
            },
            {
                "kind": "execution-plan",
                "semanticKey": f"target-execution-plan:{trace_scope}",
            },
        ]
        if str(execution_context.get("familyId") or "").strip() == "token-shop":
            canonical_supports.append(
                {
                    "kind": "token-shop-reconstruction",
                    "semanticKey": f"token-shop-reconstruction:{target_id or trace_scope}",
                }
            )
        return {
            "semanticKey": f"target-definition:{trace_scope}",
            "traceScope": trace_scope,
            "targetId": target_id,
            "familyId": str(execution_context.get("familyId") or family_id or "") or None,
            "label": str(execution_context.get("label") or target_id or trace_scope),
            "targetClass": target_class,
            "whyExists": str(target_rule.get("whyExists") or execution_context.get("joinGoal") or "").strip(),
            "supportRows": support_rows,
            "supportSurfaces": support_surfaces,
            "supportDatasets": list(target_rule.get("supportDatasets") or []),
            "canonicalSupports": canonical_supports,
            "definingViews": defining_views,
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
        target_definition = self.find_or_synthesize_target_definition(
            project_name,
            project_file,
            trace_scope,
            family_id=str(execution_context.get("familyId") or family_id or ""),
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
        why_exists = str(target_definition.get("whyExists") or "").strip()
        current_boundary = [
            "This narrative is synthesized from DB execution context and assessment state until a canonical target-narrative fragment is rebuilt."
        ]
        if why_exists:
            current_boundary.append("Why this target exists: " + why_exists)
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
            "targetDefinitionSemanticKey": str(target_definition.get("semanticKey") or ""),
            "synthesized": True,
        }

    def resolve_trace_target_knowledge(
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
        trace_scope = str(trace_scope or "").strip()
        compatibility_target_id = str(compatibility_target_id or trace_scope or "").strip()
        execution_context = self.find_or_synthesize_execution_context(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=family_id,
            compatibility_target_id=compatibility_target_id,
        )
        execution_plan = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "execution_plan_fragment",
                    f"target-execution-plan:{trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        support_context = dict(
            (
                self.find_or_synthesize_support_context(
                    project_name,
                    project_file,
                    trace_scope,
                    family_id=str(execution_context.get("familyId") or family_id or ""),
                    compatibility_target_id=compatibility_target_id,
                )
                or {}
            ).get("supportContext")
            or {}
        )
        target_definition = self.find_or_synthesize_target_definition(
            project_name,
            project_file,
            trace_scope,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        )
        surface_plan = self.find_or_synthesize_surface_plan(
            project_name,
            project_file,
            trace_scope,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        )
        target_narrative = self.find_or_synthesize_target_narrative(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        )
        latest_bundle = self.find_latest_materialized_target_bundle_view(
            project_name,
            project_file,
            trace_scope,
        ) or {}
        latest_payload = dict(latest_bundle.get("payload") or {})
        assessment_payload = dict(
            (
                self.find_canonical_semantic_fragment(
                    project_name,
                    project_file,
                    "assessment_fragment",
                    f"target-assessment:{trace_scope}",
                )
                or {}
            ).get("payload")
            or {}
        )
        decision_summary = dict(latest_payload.get("decisionSummary") or assessment_payload.get("decisionSummary") or {})
        subject_state = self.find_or_materialize_subject_state_view(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        ) or {}
        subject_contract = self.find_or_materialize_subject_contract_view(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=str(execution_context.get("familyId") or family_id or ""),
            compatibility_target_id=compatibility_target_id,
        ) or {}
        blocked_edge_types = _unique_strings([str(value) for value in (subject_state.get("blockedEdges") or []) if str(value).strip()])
        cleared_edge_types = _unique_strings([str(value) for value in (subject_state.get("knownEdges") or []) if str(value).strip()])
        missing_edge_types = _unique_strings([str(value) for value in (subject_state.get("missingEdges") or []) if str(value).strip()])
        claim_stages = list(subject_state.get("claimStages") or execution_plan.get("claimStages") or [])
        depth_plan = list(subject_state.get("depthPlan") or execution_plan.get("depthPlan") or [])
        proof_items = list(subject_state.get("proofs") or [])
        routine_hint = str(support_context.get("traceRoutineHint") or "").strip()
        family_id = str(
            execution_context.get("familyId")
            or latest_payload.get("target", {}).get("familyId")
            or family_id
            or ""
        ).strip()
        if not routine_hint:
            if family_id == "token-shop":
                routine_hint = "token-shop-family-trace"
            elif family_id == "shard-cost":
                routine_hint = "shard-cost-trace"
            elif family_id == "shard-owned-state":
                routine_hint = "shard-owned-state-trace"
            elif family_id == "multiverse-market-save-owner":
                routine_hint = "multiverse-market-save-owner-trace"
            else:
                routine_hint = trace_scope or "generic-explore"
        next_seam = dict(subject_state.get("nextSeam") or {})
        return {
            "traceScope": trace_scope,
            "targetId": compatibility_target_id or trace_scope,
            "familyId": family_id or None,
            "label": str(execution_context.get("label") or compatibility_target_id or trace_scope),
            "subjectId": str(subject_state.get("subjectId") or ""),
            "subjectKind": str(subject_state.get("subjectKind") or execution_context.get("selectedSubjectKind") or subject_kind or ""),
            "subjectKey": str(subject_state.get("subjectKey") or execution_context.get("selectedSubjectKey") or subject_key or ""),
            "subjectLabel": str(subject_state.get("subjectLabel") or execution_context.get("label") or compatibility_target_id or trace_scope),
            "targetAliases": list(subject_state.get("targetAliases") or []),
            "executionRoutineHint": routine_hint,
            "decisionSummary": decision_summary,
            "clearedEdgeTypes": cleared_edge_types,
            "missingEdgeTypes": missing_edge_types,
            "blockedEdgeTypes": blocked_edge_types,
            "claimStages": claim_stages,
            "depthPlan": depth_plan,
            "proofs": proof_items,
            "subjectState": subject_state,
            "subjectContract": subject_contract,
            "surfacePlanSemanticKey": str(surface_plan.get("semanticKey") or ""),
            "supportContext": support_context,
            "targetDefinition": target_definition,
            "definingViews": list(target_definition.get("definingViews") or []),
            "canonicalSupports": list(target_definition.get("canonicalSupports") or []),
            "executionContext": execution_context,
            "executionPlan": execution_plan,
            "targetNarrative": target_narrative,
            "latestBundleBuiltAt": str(latest_bundle.get("builtAt") or ""),
            "latestBundleRequestSignature": str(latest_bundle.get("requestSignature") or ""),
            "hasMaterializedBundle": bool(latest_bundle),
            "nextSeam": next_seam,
        }

    def resolve_trace_execution_request(
        self,
        project_name: str,
        project_file: str,
        trace_scope: str,
        *,
        subject_kind: str = "",
        subject_key: str = "",
        family_id: str = "",
        compatibility_target_id: str = "",
        requested_seam_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        knowledge = self.resolve_trace_target_knowledge(
            project_name,
            project_file,
            trace_scope,
            subject_kind=subject_kind,
            subject_key=subject_key,
            family_id=family_id,
            compatibility_target_id=compatibility_target_id,
        )
        resolver_target = self.find_or_materialize_resolver_target_view(
            project_name,
            project_file,
            trace_scope,
            subject_kind=str(knowledge.get("subjectKind") or subject_kind or ""),
            subject_key=str(knowledge.get("subjectKey") or knowledge.get("subjectId") or subject_key or ""),
            family_id=str(knowledge.get("familyId") or family_id or ""),
            compatibility_target_id=str(knowledge.get("targetId") or compatibility_target_id or trace_scope),
        ) or {}
        resolver_payload = dict(resolver_target or {})
        if not resolver_payload:
            fallback_resolver_target = self.find_or_materialize_resolver_target_view(
                project_name,
                project_file,
                trace_scope,
                family_id=str(knowledge.get("familyId") or family_id or ""),
                compatibility_target_id=str(knowledge.get("targetId") or compatibility_target_id or trace_scope),
            ) or {}
            resolver_payload = dict(fallback_resolver_target or {})
        if not resolver_payload:
            semantic_scope_key = str(knowledge.get("subjectKey") or knowledge.get("subjectId") or "").strip()
            if semantic_scope_key.startswith("row:") or semantic_scope_key.startswith("range:"):
                scoped_resolver_target = self.find_or_materialize_resolver_target_view(
                    project_name,
                    project_file,
                    trace_scope,
                    subject_kind="semantic-scope",
                    subject_key=semantic_scope_key,
                    family_id=str(knowledge.get("familyId") or family_id or ""),
                    compatibility_target_id=str(knowledge.get("targetId") or compatibility_target_id or trace_scope),
                ) or {}
                resolver_payload = dict(scoped_resolver_target or {})
        acquisition_plan = self._build_subject_seam_acquisition_plan(
            knowledge,
            resolver_payload,
            requested_seam_ids=requested_seam_ids,
        )
        if acquisition_plan:
            knowledge = dict(knowledge)
            knowledge["acquisitionPlan"] = acquisition_plan
        next_seam = dict(knowledge.get("nextSeam") or {})
        mode = (
            "reuse-materialized"
            if knowledge.get("hasMaterializedBundle") and not str(next_seam.get("id") or "").strip()
            else "run-seam-trace"
        )
        return {
            "mode": mode,
            "traceScope": trace_scope,
            "targetId": str(knowledge.get("targetId") or compatibility_target_id or trace_scope),
            "familyId": str(knowledge.get("familyId") or family_id or ""),
            "executionRoutineId": str(knowledge.get("executionRoutineHint") or trace_scope or "generic-explore"),
            "nextSeam": next_seam,
            "knowledge": knowledge,
            "acquisitionPlan": acquisition_plan,
        }

    @staticmethod
    def _apply_knowledge_subject_identity(
        planner_resolution: dict[str, Any],
        knowledge_plan: dict[str, Any],
    ) -> dict[str, Any]:
        planner_resolution = dict(planner_resolution or {})
        knowledge = dict((knowledge_plan or {}).get("knowledge") or {})
        canonical_subject_kind = str(knowledge.get("subjectKind") or "").strip()
        canonical_subject_key = str(knowledge.get("subjectKey") or knowledge.get("subjectId") or "").strip()
        canonical_subject_label = str(knowledge.get("subjectLabel") or canonical_subject_key or "").strip()
        if canonical_subject_kind:
            planner_resolution["selectedSubjectKind"] = canonical_subject_kind
        if canonical_subject_key:
            planner_resolution["selectedSubjectKey"] = canonical_subject_key
        if canonical_subject_label:
            planner_resolution["selectedSubjectLabel"] = canonical_subject_label
        return planner_resolution

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

    def resolve_trace_request(
        self,
        project_name: str,
        project_file: str,
        *,
        explicit_target_id: str = "",
        requested_queries: list[str] | None = None,
        requested_anchors: list[str] | None = None,
        family_id: str = "",
        include_legacy_targets: bool = False,
    ) -> dict[str, Any]:
        requested_queries = _unique_strings([str(value) for value in (requested_queries or []) if str(value).strip()])
        requested_anchors = _unique_strings([str(value) for value in (requested_anchors or []) if str(value).strip()])
        explicit_target_id = str(explicit_target_id or "").strip()
        family_id = str(family_id or "").strip()
        combined_inputs = _unique_strings([*requested_queries, *requested_anchors])
        combined_raw_tokens = {
            token
            for input_value in combined_inputs
            for token in _split_resolution_tokens(input_value)
            if token
        }
        family_intent = any(
            token in {"family", "structure", "audit", "boundary", "range"}
            for input_value in combined_inputs
            for token in _split_resolution_tokens(input_value)
        )

        if explicit_target_id:
            explicit_resolver_target = self.find_or_materialize_resolver_target_view(
                project_name,
                project_file,
                explicit_target_id,
                family_id=family_id,
                compatibility_target_id=explicit_target_id,
            )
            selected_family_id = (
                "token-shop" if explicit_target_id.startswith("token-shop")
                else "shard-cost" if explicit_target_id.startswith("shard-cost")
                else "shard-owned-state" if explicit_target_id.startswith("shard-owned-state")
                else "multiverse-market-save-owner" if explicit_target_id.startswith("multiverse-market")
                else family_id
            )
            expanded_anchors = _unique_strings(
                [
                    *requested_anchors,
                    *[
                        str(value)
                        for value in (
                            list((explicit_resolver_target or {}).get("anchorTerms") or [])
                            or BOOTSTRAP_DEFAULT_ANCHORS.get(explicit_target_id)
                            or []
                        )
                    ],
                ]
            )
            planner_resolution = {
                "selectionMode": "explicit-target",
                "requestedQueries": requested_queries,
                "requestedAnchors": requested_anchors,
                "matchedInputs": combined_inputs,
                "matchedTerms": combined_inputs,
                "matchedFamilyId": selected_family_id,
                "matchedFamilyLabel": FAMILY_GRAPH_LABELS.get(selected_family_id, selected_family_id.replace("-", " ")),
                "selectedSubjectKind": "target",
                "selectedSubjectKey": explicit_target_id,
                "selectedSubjectLabel": explicit_target_id,
                "selectedTargetId": explicit_target_id,
                "selectedRunMode": "trace",
                "selectedComparePresetId": None,
                "synonymSetsUsed": [],
                "expandedAnchors": expanded_anchors,
                "decisionNote": f"Resolved directly from explicit target `{explicit_target_id}`.",
            }
            knowledge_plan = self.resolve_trace_execution_request(
                project_name,
                project_file,
                explicit_target_id,
                subject_kind="target",
                subject_key=explicit_target_id,
                family_id=selected_family_id,
                compatibility_target_id=explicit_target_id,
            )
            planner_resolution = self._apply_knowledge_subject_identity(planner_resolution, knowledge_plan)
            return {
                "plannerResolution": planner_resolution,
                "selectedTargetId": explicit_target_id,
                "selectedFamilyId": selected_family_id,
                "executionTargetId": str(knowledge_plan.get("targetId") or explicit_target_id),
                "executionTraceScope": str(knowledge_plan.get("traceScope") or explicit_target_id),
                "knowledgePlan": knowledge_plan,
            }

        subject_seam_request = self._resolve_subject_seam_acquisition_request(
            project_name,
            project_file,
            requested_queries=requested_queries,
            requested_anchors=requested_anchors,
            family_id=family_id,
        )
        if subject_seam_request:
            return subject_seam_request

        acquisition_request = self._resolve_missing_db_term_acquisition_request(
            project_name,
            project_file,
            requested_queries=requested_queries,
            requested_anchors=requested_anchors,
            family_id=family_id,
        )
        if acquisition_request:
            return acquisition_request

        if family_id and not combined_inputs:
            family_subject = self.find_canonical_family_subject_candidate(project_name, project_file, family_id)
            if family_subject:
                target_id = str(family_subject.get("targetId") or family_id)
                trace_scope = str(family_subject.get("traceScope") or target_id)
                planner_resolution = {
                    "selectionMode": "db-family-subject",
                    "requestedQueries": requested_queries,
                    "requestedAnchors": requested_anchors,
                    "matchedInputs": [family_id],
                    "matchedTerms": [family_id],
                    "matchedFamilyId": family_id,
                    "matchedFamilyLabel": FAMILY_GRAPH_LABELS.get(family_id, family_id.replace("-", " ")),
                    "selectedSubjectKind": str(family_subject.get("subjectKind") or "family-graph"),
                    "selectedSubjectKey": str(family_subject.get("subjectKey") or ""),
                    "selectedSubjectLabel": str(family_subject.get("subjectLabel") or target_id),
                    "selectedTargetId": target_id,
                    "selectedRunMode": "trace",
                    "selectedComparePresetId": None,
                    "synonymSetsUsed": [],
                    "expandedAnchors": _unique_strings(
                        [
                            *requested_anchors,
                            *[
                                str(value)
                                for value in (
                                    (
                                        self.find_or_materialize_resolver_target_view(
                                            project_name,
                                            project_file,
                                            trace_scope,
                                            subject_kind=str(family_subject.get("subjectKind") or "family-graph"),
                                            subject_key=str(family_subject.get("subjectKey") or ""),
                                            family_id=family_id,
                                            compatibility_target_id=target_id,
                                        )
                                        or {}
                                    ).get("anchorTerms")
                                    or []
                                )
                            ],
                        ]
                    ),
                    "decisionNote": f"Resolved from canonical DB family subject for `{family_id}`.",
                }
                knowledge_plan = self.resolve_trace_execution_request(
                    project_name,
                    project_file,
                    trace_scope,
                    subject_kind=str(planner_resolution.get("selectedSubjectKind") or ""),
                    subject_key=str(planner_resolution.get("selectedSubjectKey") or ""),
                    family_id=family_id,
                    compatibility_target_id=target_id,
                )
                planner_resolution = self._apply_knowledge_subject_identity(planner_resolution, knowledge_plan)
                return {
                    "plannerResolution": planner_resolution,
                    "selectedTargetId": target_id,
                    "selectedFamilyId": family_id,
                    "executionTargetId": str(knowledge_plan.get("targetId") or target_id),
                    "executionTraceScope": str(knowledge_plan.get("traceScope") or trace_scope),
                    "knowledgePlan": knowledge_plan,
                }

        candidates = self.find_canonical_resolution_subject_candidates(
            project_name,
            project_file,
            include_legacy_targets=include_legacy_targets,
        )
        scored_candidates: list[dict[str, Any]] = []
        for row in candidates:
            target = dict(row.get("target") or {})
            trace_scope = str(row.get("traceScope") or "").strip()
            target_id = str(target.get("id") or trace_scope).strip()
            candidate_family_id = str(target.get("familyId") or "").strip() or _infer_family_id_from_target_id(target_id)
            if not trace_scope or not target_id:
                continue
            if family_id and candidate_family_id and candidate_family_id != family_id:
                continue
            resolver_target = self.find_or_materialize_resolver_target_view(
                project_name,
                project_file,
                trace_scope,
                family_id=candidate_family_id,
                compatibility_target_id=target_id,
            )
            identity_terms = _unique_strings(
                [
                    str(row.get("label") or "") if _is_concise_resolution_label(str(row.get("label") or "")) else "",
                    target_id,
                    trace_scope,
                    candidate_family_id,
                ]
            )
            resolution_terms = _unique_strings([str(term) for term in (row.get("resolutionTerms") or [])])
            semantic_scope_terms = _unique_strings(
                [
                    str(term)
                    for subject in (row.get("semanticScopeSubjects") or [])
                    for term in (subject.get("subjectTerms") or [])
                ]
            )
            family_graph_terms = _unique_strings(
                [
                    str(term)
                    for subject in (row.get("familyGraphSubjects") or [])
                    for term in (subject.get("subjectTerms") or [])
                ]
            )
            reconstruction_terms = _unique_strings(
                [
                    str(term)
                    for subject in (row.get("reconstructionSubjects") or [])
                    for term in (subject.get("subjectTerms") or [])
                ]
            )
            anchor_terms = _unique_strings(
                [
                    str(value)
                    for value in (
                        list((resolver_target or {}).get("anchorTerms") or [])
                        or []
                    )
                ]
            )
            resolver_surfaces = list((resolver_target or {}).get("supportSurfaces") or [])
            resolution_aliases = _unique_strings([str(value) for value in ((resolver_target or {}).get("resolutionAliases") or [])])
            surface_terms = _unique_strings(
                [
                    str(term)
                    for surface in (
                        resolver_surfaces
                    )
                    if isinstance(surface, dict)
                    for term in (surface.get("terms") or [])
                ]
            )
            surface_labels = _unique_strings(
                [
                    str(surface.get("label") or "")
                    for surface in (
                        resolver_surfaces
                    )
                    if isinstance(surface, dict)
                ]
            )
            surface_ids = _unique_strings(
                [
                    str(surface.get("id") or "")
                    for surface in (
                        resolver_surfaces
                    )
                    if isinstance(surface, dict)
                ]
            )
            resolver_support_rows = list((resolver_target or {}).get("supportRows") or [])
            shell_terms = _unique_strings(
                [
                    *[
                        str(value)
                        for row_entry in resolver_support_rows
                        for value in [row_entry.get("shellField"), row_entry.get("shellPathId"), row_entry.get("field")]
                    ],
                ]
            )
            lost_structure_terms = _unique_strings(
                [
                    str(value)
                    for value in (
                        list((resolver_target or {}).get("targetNarrative", {}).get("currentBoundary") or [])
                        or []
                    )
                ]
            )
            normalized_candidate_terms: dict[str, dict[str, Any]] = {}

            def register_resolution_terms(terms: list[str], weight: float) -> None:
                for term in terms:
                    normalized_term = _normalize_resolution_term(term)
                    if not normalized_term:
                        continue
                    current = normalized_candidate_terms.get(normalized_term)
                    if current is None or float(current.get("weight") or 0.0) < weight:
                        normalized_candidate_terms[normalized_term] = {"term": term, "weight": weight}

            register_resolution_terms(identity_terms, 1.0)
            register_resolution_terms(resolution_aliases, 0.98)
            register_resolution_terms(semantic_scope_terms, 0.95)
            register_resolution_terms(reconstruction_terms, 0.95)
            register_resolution_terms(family_graph_terms, 0.9)
            register_resolution_terms(resolution_terms, 0.45)
            register_resolution_terms(anchor_terms, 0.95)
            register_resolution_terms(shell_terms, 0.9)
            register_resolution_terms(surface_terms, 0.75)
            register_resolution_terms(surface_labels, 0.55)
            register_resolution_terms(surface_ids, 0.45)
            register_resolution_terms(lost_structure_terms, 0.25)
            family_specific_tokens = {
                token
                for value in [candidate_family_id, *anchor_terms, *surface_terms, *surface_labels, *surface_ids]
                for token in _split_resolution_tokens(value)
                if token and token not in GENERIC_RESOLUTION_TOKENS
            }
            family_title_surface = any(
                "title" in _split_resolution_tokens(value)
                for value in [*surface_labels, *surface_ids]
                if str(value or "").strip()
            )
            matched_inputs: list[str] = []
            matched_terms: list[str] = []
            score = 0
            for input_value in combined_inputs:
                normalized_input = _normalize_resolution_term(input_value)
                if not normalized_input:
                    continue
                input_tokens = {
                    token for token in _split_resolution_tokens(input_value)
                    if token and token not in GENERIC_RESOLUTION_TOKENS
                }
                best_term = ""
                best_term_score = 0
                for normalized_term, term_entry in normalized_candidate_terms.items():
                    original_term = str(term_entry.get("term") or "")
                    term_weight = float(term_entry.get("weight") or 0.0) or 0.0
                    term_tokens = {
                        token for token in _split_resolution_tokens(original_term)
                        if token and token not in GENERIC_RESOLUTION_TOKENS
                    }
                    if normalized_input == normalized_term:
                        term_score = 120
                    elif input_tokens and not (input_tokens & term_tokens):
                        term_score = 0
                    elif normalized_input in normalized_term or normalized_term in normalized_input:
                        term_score = 45
                    else:
                        overlap = input_tokens & term_tokens
                        term_score = len(overlap) * 12
                        if len(overlap) >= 2:
                            term_score += (len(overlap) - 1) * 10
                        if any(any(character.isdigit() for character in token) for token in overlap):
                            term_score += 40
                    term_score = int(round(term_score * term_weight))
                    if term_score > best_term_score:
                        best_term = original_term
                        best_term_score = term_score
                if best_term_score <= 0:
                    continue
                score += best_term_score
                if input_value not in matched_inputs:
                    matched_inputs.append(input_value)
                if best_term and best_term not in matched_terms:
                    matched_terms.append(best_term)
            if matched_terms:
                score += len(matched_terms) * 4
            blocked_edge_types = list((row.get("decisionSummary") or {}).get("blockedEdgeTypes") or [])
            score += min(int((row.get("decisionSummary") or {}).get("provedEdgeCount") or 0), 12) * 2
            score -= min(len(blocked_edge_types), 6)
            if "family" in trace_scope or "family" in str(row.get("label") or "").lower():
                score += 8
                if not family_intent:
                    family_match_count = len(combined_raw_tokens & family_specific_tokens)
                    family_penalty = 60
                    if family_match_count >= 2:
                        family_penalty = 4
                    elif family_match_count >= 1 and family_title_surface and "title" in combined_raw_tokens:
                        family_penalty = 20
                    score -= family_penalty
            if family_id and candidate_family_id == family_id:
                score += 30
            if float(score) < 20.0 or not matched_terms:
                continue
            scored_candidates.append(
                {
                    "row": row,
                    "resolverTarget": resolver_target,
                    "targetId": target_id,
                    "traceScope": trace_scope,
                    "familyId": candidate_family_id,
                    "matchedInputs": matched_inputs,
                    "matchedTerms": matched_terms,
                    "score": score,
                }
            )
        if scored_candidates:
            scored_candidates.sort(
                key=lambda item: (
                    -float(item.get("score") or 0.0),
                    -len(item.get("matchedTerms") or []),
                    len(((item.get("row") or {}).get("decisionSummary") or {}).get("blockedEdgeTypes") or []),
                    str(item.get("traceScope") or ""),
                )
            )
            best = scored_candidates[0]
            row = dict(best["row"] or {})
            resolver_target = dict(best.get("resolverTarget") or {})
            target_id = str(best["targetId"] or "")
            trace_scope = str(best["traceScope"] or "")
            selected_family_id = str(best.get("familyId") or family_id or "").strip() or _infer_family_id_from_target_id(target_id)
            matched_terms = list(best.get("matchedTerms") or [])
            normalized_matched_terms = {
                _normalize_resolution_term(term)
                for term in matched_terms
                if _normalize_resolution_term(term)
            }
            selected_subject_kind = "target-reconstruction"
            selected_subject_key = f"target:{target_id}"
            selected_subject_label = str(row.get("label") or target_id)
            best_scope_subject = None
            best_scope_score = -1
            for subject in list(row.get("semanticScopeSubjects") or []):
                normalized_scope_terms = {
                    _normalize_resolution_term(term)
                    for term in list(subject.get("subjectTerms") or [])
                    if _normalize_resolution_term(term)
                }
                matched_scope_terms = normalized_scope_terms & normalized_matched_terms
                if not matched_scope_terms:
                    continue
                scope_id = str(subject.get("scopeId") or "").strip()
                scope_type = str(subject.get("scopeType") or "").strip()
                scope_score = len(matched_scope_terms) * 10
                if scope_id.startswith("row:"):
                    scope_score += 100
                elif scope_type:
                    scope_score += 40
                if scope_score > best_scope_score:
                    best_scope_score = scope_score
                    best_scope_subject = subject
            best_family_graph_subject = None
            best_family_graph_score = -1
            for subject in list(row.get("familyGraphSubjects") or []):
                normalized_terms = {
                    _normalize_resolution_term(term)
                    for term in list(subject.get("subjectTerms") or [])
                    if _normalize_resolution_term(term)
                }
                matched_family_terms = normalized_terms & normalized_matched_terms
                if not matched_family_terms:
                    continue
                family_graph_score = len(matched_family_terms) * 12 + 60
                if selected_family_id and _normalize_resolution_term(selected_family_id) in matched_family_terms:
                    family_graph_score += 30
                if family_graph_score > best_family_graph_score:
                    best_family_graph_score = family_graph_score
                    best_family_graph_subject = subject
            if best_scope_subject is not None:
                selected_subject_kind = "semantic-scope"
                selected_subject_key = str(best_scope_subject.get("scopeId") or "")
                selected_subject_label = str(best_scope_subject.get("label") or selected_subject_key)
            elif best_family_graph_subject is not None:
                selected_subject_kind = "family-graph"
                selected_subject_key = str(best_family_graph_subject.get("semanticKey") or "")
                selected_subject_label = str(best_family_graph_subject.get("label") or selected_subject_key)
            elif selected_family_id == "token-shop":
                selected_subject_kind = "reconstruction-fragment"
                selected_subject_key = f"token-shop-reconstruction:{target_id}"
                selected_subject_label = target_id
            expanded_anchors = _unique_strings(
                [
                    *requested_anchors,
                    *[str(value) for value in (list((resolver_target or {}).get("anchorTerms") or []) or [])],
                ]
            )
            planner_resolution = {
                "selectionMode": "db-query-resolution",
                "requestedQueries": requested_queries,
                "requestedAnchors": requested_anchors,
                "matchedInputs": list(best.get("matchedInputs") or combined_inputs),
                "matchedTerms": matched_terms,
                "matchedFamilyId": selected_family_id,
                "matchedFamilyLabel": FAMILY_GRAPH_LABELS.get(selected_family_id, selected_family_id.replace("-", " ")),
                "selectedSubjectKind": selected_subject_kind,
                "selectedSubjectKey": selected_subject_key,
                "selectedSubjectLabel": selected_subject_label,
                "selectedTargetId": target_id,
                "selectedRunMode": "trace",
                "selectedComparePresetId": None,
                "synonymSetsUsed": [],
                "expandedAnchors": expanded_anchors,
                "decisionNote": (
                    "Resolved the trace from canonical DB subject candidates first, "
                    f"selecting {target_id} for {', '.join(list(best.get('matchedInputs') or combined_inputs))}. "
                    f"DB subject: {selected_subject_kind} {selected_subject_key}."
                ),
            }
            knowledge_plan = self.resolve_trace_execution_request(
                project_name,
                project_file,
                trace_scope,
                subject_kind=selected_subject_kind,
                subject_key=selected_subject_key,
                family_id=selected_family_id,
                compatibility_target_id=target_id,
            )
            planner_resolution = self._apply_knowledge_subject_identity(planner_resolution, knowledge_plan)
            return {
                "plannerResolution": planner_resolution,
                "selectedTargetId": target_id,
                "selectedFamilyId": selected_family_id,
                "executionTargetId": str(knowledge_plan.get("targetId") or target_id),
                "executionTraceScope": str(knowledge_plan.get("traceScope") or trace_scope),
                "knowledgePlan": knowledge_plan,
            }

        planner_resolution = {
            "selectionMode": "generic-explore",
            "requestedQueries": requested_queries,
            "requestedAnchors": requested_anchors,
            "matchedInputs": combined_inputs,
            "matchedTerms": combined_inputs,
            "matchedFamilyId": "exploration",
            "matchedFamilyLabel": "Exploration",
            "selectedSubjectKind": "flat-explore",
            "selectedSubjectKey": "generic-explore",
            "selectedSubjectLabel": "Flat cross-source exploration",
            "selectedTargetId": "generic-explore",
            "selectedRunMode": "trace",
            "selectedComparePresetId": None,
            "synonymSetsUsed": [],
            "expandedAnchors": combined_inputs,
            "decisionNote": (
                "No DB-backed subject matched the provided request strongly enough, so the trace fell back to generic exploration."
            ),
        }
        return {
            "plannerResolution": planner_resolution,
            "selectedTargetId": "generic-explore",
            "selectedFamilyId": "exploration",
            "executionTargetId": "generic-explore",
            "executionTraceScope": "generic-explore",
            "knowledgePlan": {},
        }

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
        self.rebuild_trace_views(trace_scopes=[scope_id])

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
        invalidated_scopes: set[str] = set()
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT fragment_id, trace_scope FROM trace_fragments WHERE {} AND is_valid = 1 AND invalidated_at IS NULL".format(" AND ".join(clauses)),
                tuple(params),
            ).fetchall()
            timestamp = datetime.now().isoformat()
            for row in rows:
                fragment_id = int(row["fragment_id"])
                invalidated.append(fragment_id)
                if str(row["trace_scope"] or "").strip():
                    invalidated_scopes.add(str(row["trace_scope"]))
                conn.execute(
                    """
                    UPDATE trace_fragments
                    SET is_valid = 0, invalidated_at = ?, invalidation_reason = ?, updated_at = ?
                    WHERE fragment_id = ?
                    """,
                    (timestamp, reason, timestamp, fragment_id),
                )
        if invalidated:
            self.rebuild_trace_views(trace_scopes=sorted(invalidated_scopes) or None)
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

    def prune_bounded_retention(self) -> dict[str, int]:
        with self.connect() as conn:
            evidence_stats = self._prune_evidence_retention(conn)
            trace_stats = self._prune_trace_retention(conn)
        return {
            **evidence_stats,
            **trace_stats,
        }
