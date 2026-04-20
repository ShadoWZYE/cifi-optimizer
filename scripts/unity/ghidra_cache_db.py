#!/usr/bin/env python3
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Iterator


DB_SCHEMA_VERSION = 7
SCHEMA_VERSION_FLOOR = 7

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


def _normalize_result_terms(result: dict[str, Any], search_terms: list[str]) -> list[str]:
    normalized = [str(term).strip() for term in search_terms if str(term).strip()]
    if normalized:
        return normalized
    bridges = result.get("termBridges") or {}
    if isinstance(bridges, dict):
        return [str(term).strip() for term in bridges.keys() if str(term).strip()]
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


SYSTEM_TRACE_FRAGMENT_KINDS = {
    "system_scope_fragment",
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
        canonical_payload = dict(canonical_payload)
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


def _build_target_bundle_projection(
    payload: dict[str, Any],
    system_payload: dict[str, Any],
    semantic_views: dict[str, Any],
    semantic_coverage: dict[str, Any],
    trace_scope: str,
    request_signature: str,
) -> dict[str, Any]:
    return {
        "dataset": payload.get("dataset", "unity-trace-bundle"),
        "generatedAt": payload.get("generatedAt"),
        "target": payload.get("target"),
        "plannerResolution": payload.get("plannerResolution"),
        "traceRegistry": {
            "selectedTargetId": (payload.get("traceRegistry") or {}).get("selectedTargetId"),
            "selectedFamilyId": (payload.get("traceRegistry") or {}).get("selectedFamilyId"),
            "requiredSourceFamilies": (payload.get("traceRegistry") or {}).get("requiredSourceFamilies"),
        },
        "traceParams": payload.get("traceParams"),
        "assetSet": payload.get("assetSet"),
        "status": payload.get("status"),
        "semanticStatus": payload.get("semanticStatus"),
        "literalStatus": payload.get("literalStatus"),
        "runtimeStatus": payload.get("runtimeStatus"),
        "closureStatus": payload.get("closureStatus"),
        "decisionSummary": payload.get("decisionSummary"),
        "sourceFamilies": _build_canonical_source_projection(payload),
        "nativeView": _build_native_view_projection(payload),
        "systemViews": system_payload,
        "canonicalSemanticViews": semantic_views,
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
                        evidence["aspect_kind"],
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
                        evidence["aspect_kind"],
                        evidence["aspect_key"],
                        evidence["source_job_id"],
                        _json_dumps(evidence["payload"]),
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
            self._upsert_evidence_rows(self._extract_evidence_rows(job, result))
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
        combined_result["managedGraph"] = _merge_managed_graphs(graphs)

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
        semantic_graph = row_recovery.get("semanticGraph") or {}
        semantic_search_plan = row_recovery.get("semanticSearchPlan") or {}
        trace_graph = dataset.get("traceGraph") or {}
        closure_status = dataset.get("closureStatus") or {}
        decision_summary = dataset.get("decisionSummary") or {}

        for key, value in dataset.items():
            if key == "traceRun":
                continue
            fragment_rows.append(
                {
                    "project_name": project_name,
                    "project_file": project_file,
                    "trace_scope": trace_scope,
                    "request_signature": request_signature,
                    "fragment_kind": key,
                    "fragment_key": "__self__",
                    "payload": value,
                    "source_job_id": source_job_id if key in {"nativeTrace", "nativeReconstruction"} else "",
                    "source_term": ",".join(source_terms) if key in {"nativeTrace", "nativeReconstruction"} else "",
                    "confidence": 1.0 if key in {"nativeTrace", "nativeReconstruction", "traceGraph", "decisionSummary"} else 0.9,
                    "reducer_priority": 100 if key in {"nativeTrace", "nativeReconstruction", "traceGraph", "decisionSummary"} else 90,
                    "schema_version": int(dataset.get("nativeTrace", {}).get("result", {}).get("schemaVersion", SCHEMA_VERSION_FLOOR) or SCHEMA_VERSION_FLOOR),
                    "script_name": "unity_trace_bundle.py",
                    "producer_version": producer_version,
                    "start_time": str(dataset.get("generatedAt", "")) or now,
                }
            )

        system_fragments = {
            "system_scope_fragment": {
                "target": dataset.get("target"),
                "traceRegistry": dataset.get("traceRegistry"),
                "closureStatus": closure_status,
            },
            "formula_fragment": {
                "formulaReconstruction": formula_reconstruction,
                "recoveredFormulaFields": row_recovery.get("recoveredFormulaFields"),
                "recoveredFormulaValues": row_recovery.get("recoveredFormulaValues"),
            },
            "threshold_fragment": {
                "runtimeCostModel": formula_reconstruction.get("runtimeCostModel"),
                "unresolvedRuntimeTargets": closure_status.get("unresolvedRuntimeTargets"),
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
                "runtimeEvaluatorRecovery": runtime_evaluator,
                "runtimeStatus": dataset.get("runtimeStatus"),
                "decisionSummary": decision_summary,
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
            "semantic_scope_fragment": {
                "semanticScopeId": row_recovery.get("semanticScopeId"),
                "semanticGraph": semantic_graph,
                "semanticSearchPlan": semantic_search_plan,
            },
            "reconstruction_note_fragment": {
                "bridgeCheck": dataset.get("bridgeCheck"),
                "groundedConclusion": dataset.get("groundedConclusion"),
                "decisionSummary": decision_summary,
                "currentBoundary": dataset.get("currentBoundary"),
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
                provenance = {
                    "fragmentIds": selected_ids,
                    "sourceJobIds": [str(row["source_job_id"]) for row in ordered if str(row["source_job_id"])],
                    "sourceTerms": [str(row["source_term"]) for row in ordered if str(row["source_term"])],
                    "reducer": "best-rank",
                }
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
                canonical_payload = _json_loads(selected["payload_json"], None)
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
                conn.execute(
                    """
                    INSERT INTO canonical_semantic_fragments(
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
                        _json_dumps(value["provenance"]),
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
                        _json_dumps(system_provenance),
                        "system-trace-best-rank-v1",
                        datetime.now().isoformat(),
                    ),
                )
                semantic_keys = [
                    (kind, str((payload.get(kind) or {}).get("semanticKey", "")))
                    for kind in SYSTEM_TRACE_FRAGMENT_KINDS
                    if isinstance(payload.get(kind), dict) and str((payload.get(kind) or {}).get("semanticKey", ""))
                ]
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
                    _json_dumps(provenance or {}),
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
        source_job_id: str | None = None,
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
        if source_job_id:
            clauses.append("source_job_id = ?")
            params.append(source_job_id)
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
