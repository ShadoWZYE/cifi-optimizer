from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import struct
import sys
import types
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from time import perf_counter
from typing import Any

from ghidra_cache_db import (
    FAMILY_GRAPH_LABELS,
    GhidraCacheDB,
)
from portable_paths import md_link, repo_relative
from trace_extractors import (
    TraceDocumentCache,
    _summarize_native_result,
    build_token_shop_native_bridge_plan,
    collect_native_trace,
    find_cached_native_trace,
    load_token_shop_extract,
)


ROOT = Path(__file__).resolve().parents[2]
TRACE_EXPORTS_DIR = ROOT / "workbench" / "trace-exports"
JSON_OUT = TRACE_EXPORTS_DIR / "unity-trace-bundle.json"
MD_OUT = TRACE_EXPORTS_DIR / "unity-trace-bundle.md"
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"
UNITY_JOINED_DIR = ROOT / "workbench" / "unity" / "joined"
TRACE_RUNS_DIR = ROOT / "workbench" / "trace-runs"
TRACE_CACHE_DB = ROOT / "workbench" / "ghidra-cache" / "ghidra_cache.sqlite3"
UNITY_SEARCH_INDEX_CACHE_PATH = ROOT / "workbench" / "ghidra-cache" / "unity-search-index-cache.json"
UNITY_RAW_STRING_INDEX_CACHE_PATH = ROOT / "workbench" / "ghidra-cache" / "unity-raw-string-index-cache.json"
TRACE_TIMING_LIVE_PATH = TRACE_RUNS_DIR / "unity-trace-bundle-timing-live.json"

TRACE_DB: GhidraCacheDB | None = None
TRACE_BUNDLE_RUN_CACHE: dict[tuple[str, str], Any] = {}
ACTIVE_TRACE_PROFILER: "TraceRunProfiler | None" = None
ACTIVE_TRACE_RUNTIME_FLAGS: dict[str, Any] = {}

UNITY_ENV: Any = None
METADATA_STRING_ENTRIES: list[dict[str, Any]] | None = None
UNITY_SEARCH_INDEX: dict[str, list[dict[str, Any]]] | None = None
UNITY_RAW_STRING_INDEX: dict[str, list[dict[str, Any]]] | None = None
UNITY_OBJECTS_BY_PATH_ID: dict[int, Any] | None = None
UNITY_OBJECTS_BY_ASSET_AND_PATH_ID: dict[tuple[str, int], Any] | None = None


def _infer_runtime_family_id(*values: Any) -> str:
    for value in values:
        normalized = str(value or "").strip().lower()
        if not normalized:
            continue
        if normalized.startswith("token-shop"):
            return "token-shop"
        if normalized.startswith("shard-cost"):
            return "shard-cost"
        if normalized.startswith("shard-owned-state"):
            return "shard-owned-state"
        if normalized.startswith("multiverse-market"):
            return "multiverse-market-save-owner"
    return ""


class TraceRunProfiler:
    def __init__(self, enabled: bool = False):
        self.enabled = bool(enabled)
        self._totals: dict[str, float] = {}
        self._counts: dict[str, int] = {}
        self._metadata: dict[str, Any] = {}
        self._phase_order: list[dict[str, Any]] = []
        self._started_at: float | None = perf_counter() if self.enabled else None
        self._live_path = TRACE_TIMING_LIVE_PATH if self.enabled else None
        if self.enabled and self._live_path is not None:
            self._live_path.parent.mkdir(parents=True, exist_ok=True)
            self._write_live_snapshot()

    @contextmanager
    def span(self, bucket: str):
        if not self.enabled:
            yield
            return
        started = perf_counter()
        try:
            yield
        finally:
            elapsed = perf_counter() - started
            self._totals[bucket] = self._totals.get(bucket, 0.0) + elapsed
            self._counts[bucket] = self._counts.get(bucket, 0) + 1
            self._write_live_snapshot()

    @contextmanager
    def phase(self, label: str, bucket: str | None = None):
        if not self.enabled:
            yield
            return
        phase_bucket = str(bucket or label).strip() or str(label).strip() or "phase"
        print(f"[phase] {label}...")
        started = perf_counter()
        try:
            with self.span(phase_bucket):
                yield
        finally:
            elapsed_ms = round((perf_counter() - started) * 1000.0, 3)
            self._phase_order.append({"label": label, "bucket": phase_bucket, "elapsedMs": elapsed_ms})
            print(f"[phase] {label} done in {elapsed_ms:.3f}ms")
            self._write_live_snapshot()

    def set_metadata(self, key: str, value: Any) -> None:
        if self.enabled:
            self._metadata[key] = value
            self._write_live_snapshot()

    def _write_live_snapshot(self) -> None:
        if not self.enabled or self._live_path is None:
            return
        self._live_path.write_text(json.dumps(self.report_payload(), indent=2), encoding="utf-8")

    def totals_ms(self) -> dict[str, float]:
        return {bucket: round(seconds * 1000.0, 3) for bucket, seconds in self._totals.items()}

    def total_run_ms(self) -> float:
        if not self.enabled or self._started_at is None:
            return 0.0
        return round((perf_counter() - self._started_at) * 1000.0, 3)

    def report_payload(self) -> dict[str, Any]:
        buckets = self.totals_ms()
        total_measured_ms = round(sum(buckets.values()), 3)
        dominant_bucket = max(buckets.items(), key=lambda item: item[1])[0] if buckets else None
        return {
            "enabled": self.enabled,
            "totalRunMs": self.total_run_ms(),
            "totalMeasuredMs": total_measured_ms,
            "bucketsMs": buckets,
            "bucketCounts": dict(self._counts),
            "dominantBucket": dominant_bucket,
            "phases": list(self._phase_order),
            "metadata": dict(self._metadata),
        }


@contextmanager
def _trace_profile_span(bucket: str):
    profiler = ACTIVE_TRACE_PROFILER
    if profiler is None or not profiler.enabled:
        yield
        return
    with profiler.span(bucket):
        yield


@contextmanager
def _trace_phase(label: str, bucket: str):
    profiler = ACTIVE_TRACE_PROFILER
    if profiler is None or not profiler.enabled:
        yield
        return
    with profiler.phase(label, bucket):
        yield


def get_trace_db() -> GhidraCacheDB:
    global TRACE_DB
    if TRACE_DB is None:
        TRACE_DB = GhidraCacheDB(TRACE_CACHE_DB, ROOT / "workbench" / "ghidra-jobs")
    TRACE_DB.timing_span_factory = _trace_profile_span
    return TRACE_DB


def _set_active_trace_runtime_flags(flags: dict[str, Any] | None) -> None:
    global ACTIVE_TRACE_RUNTIME_FLAGS
    ACTIVE_TRACE_RUNTIME_FLAGS = dict(flags or {})


def _get_active_trace_runtime_flag(key: str, default: Any = None) -> Any:
    return ACTIVE_TRACE_RUNTIME_FLAGS.get(key, default)


def reset_trace_bundle_run_cache() -> None:
    TRACE_BUNDLE_RUN_CACHE.clear()


def _trace_bundle_cache_get(bucket: str, key: str) -> Any | None:
    return TRACE_BUNDLE_RUN_CACHE.get((bucket, key))


def _trace_bundle_cache_put(bucket: str, key: str, value: Any) -> Any:
    TRACE_BUNDLE_RUN_CACHE[(bucket, key)] = value
    return value


def _diagnostic_evidence_sources_checked(evidence: dict[str, Any]) -> list[str]:
    return [
        str(source_id)
        for source_id in (evidence.get("sourceIds") or [])
        if str(source_id).strip()
    ]


def _pick_acquisition_evidence_source_job_id(
    project_name: str,
    project_file: str,
    request_signature: str,
    preferred_terms: list[str],
) -> str:
    exact_job = get_trace_db().find_exact_subset_job(project_name, project_file, request_signature)
    exact_job_id = str((exact_job or {}).get("job_id") or "").strip()
    if exact_job_id:
        return exact_job_id

    preferred_tokens = {
        token
        for value in preferred_terms
        for token in re.split(r"[^a-z0-9]+", str(value or "").lower())
        if token
    }
    for job in get_trace_db().get_completed_process_jobs(project_name, project_file):
        job_id = str(job.get("job_id") or "").strip()
        if not job_id:
            continue
        search_strings = [str(value).strip() for value in (job.get("search_strings") or []) if str(value).strip()]
        search_blob = " ".join(search_strings).lower()
        if any(term.lower() in search_blob for term in preferred_terms if str(term).strip()):
            return job_id
        search_tokens = {
            token
            for value in search_strings
            for token in re.split(r"[^a-z0-9]+", value.lower())
            if token
        }
        if preferred_tokens and preferred_tokens.intersection(search_tokens):
            return job_id
    # Exact acquisition hits can surface durable literal evidence even when the
    # underlying process job metadata did not record the full requested string.
    # In that case, bind the promoted evidence to the latest completed process
    # job for the same binary so the evidence row survives scope churn.
    for job in get_trace_db().get_completed_process_jobs(project_name, project_file):
        job_id = str(job.get("job_id") or "").strip()
        if job_id:
            return job_id
    return ""


def _persist_acquisition_exact_term_evidence(
    *,
    project_name: str,
    project_file: str,
    trace_scope: str,
    request_signature: str,
    target_id: str,
    execution_routine_id: str,
    term: str,
    why_chosen: list[str],
    evidence: dict[str, Any],
) -> None:
    normalized_term = str(term or "").strip().lower()
    if not normalized_term or not bool(evidence.get("found")):
        return
    source_job_id = _pick_acquisition_evidence_source_job_id(
        project_name,
        project_file,
        request_signature,
        [term, trace_scope, target_id, execution_routine_id, *why_chosen],
    )
    if not source_job_id:
        return
    now = datetime.now().isoformat()
    get_trace_db().upsert_custom_evidence_rows(
        [
            {
                "project_name": project_name,
                "project_file": project_file,
                "normalized_term": normalized_term,
                "term": str(term or "").strip(),
                "aspect_kind": "acquisition_exact_term",
                "aspect_key": str(trace_scope or "").strip() or "__self__",
                "source_job_id": source_job_id,
                "payload": {
                    "term": str(term or "").strip(),
                    "traceScope": str(trace_scope or "").strip(),
                    "targetId": str(target_id or "").strip(),
                    "requestSignature": str(request_signature or "").strip(),
                    "executionRoutineId": str(execution_routine_id or "").strip(),
                    "whyChosen": [str(value) for value in (why_chosen or []) if str(value).strip()],
                    "evidenceHits": _diagnostic_evidence_hits(evidence),
                    "evidenceSourcesChecked": _diagnostic_evidence_sources_checked(evidence),
                    "durableEvidence": True,
                    "source": "acquisition-exact-hit",
                },
                "confidence": 0.99,
                "reducer_priority": 99,
                "schema_version": 7,
                "script_name": "unity_trace_bundle.py",
                "producer_version": str(request_signature or "").strip(),
                "start_time": now,
            }
        ],
        rebuild_materialized=True,
    )


def _diagnostic_evidence_hits(evidence: dict[str, Any]) -> dict[str, Any]:
    return {
        "found": bool(evidence.get("found")),
        "graphRefs": [dict(item) for item in (evidence.get("graphRefs") or []) if isinstance(item, dict)][:6],
        "payloadHits": [dict(item) for item in (evidence.get("payloadHits") or []) if isinstance(item, dict)][:6],
    }


def _recommended_next_acquisition_step(
    term: str,
    selected_scope: str,
    evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    evidence = dict(evidence or {})
    graph_refs = [dict(item) for item in (evidence.get("graphRefs") or []) if isinstance(item, dict)]
    if graph_refs:
        recommended_scope = str((graph_refs[0].get("traceScope") or selected_scope or "")).strip()
        return {
            "term": str(term or "").strip(),
            "traceScope": recommended_scope,
            "reason": "graph-linked-narrowing",
        }
    return {
        "term": str(term or "").strip(),
        "traceScope": str(selected_scope or "").strip(),
        "reason": "narrow-to-exact-term",
    }


def _persist_acquisition_term_diagnostic(
    request_signature: str,
    trace_scope: str,
    term: str,
    payload: dict[str, Any],
) -> None:
    get_trace_db().upsert_materialized_acquisition_diagnostic_view(
        "cifi-full",
        "libil2cpp.so",
        request_signature,
        trace_scope,
        term,
        payload,
    )


def _rebind_acquisition_dataset_to_request(
    dataset: dict[str, Any],
    *,
    planner_resolution: dict[str, Any],
    execution_trace_scope: str,
    execution_target_id: str,
    selected_family_id: str,
    request_signature: str,
) -> dict[str, Any]:
    rebound = dict(dataset or {})
    rebound["plannerResolution"] = dict(planner_resolution or {})
    trace_registry = dict(rebound.get("traceRegistry") or {})
    trace_registry["executionTraceScope"] = str(execution_trace_scope or execution_target_id or "").strip()
    trace_registry["selectedFamilyId"] = str(selected_family_id or "").strip()
    trace_registry["selectedTargetId"] = str(execution_target_id or execution_trace_scope or "").strip()
    trace_registry["executionTargetId"] = str(execution_target_id or execution_trace_scope or "").strip()
    trace_registry["selectedSubjectKind"] = str(planner_resolution.get("selectedSubjectKind") or trace_registry.get("selectedSubjectKind") or "").strip()
    trace_registry["selectedSubjectKey"] = str(planner_resolution.get("selectedSubjectKey") or trace_registry.get("selectedSubjectKey") or "").strip()
    rebound["traceRegistry"] = trace_registry
    native_trace = dict(rebound.get("nativeTrace") or {})
    if native_trace:
        native_trace["requestSignature"] = str(request_signature or "").strip()
        rebound["nativeTrace"] = native_trace
        request_context = dict(native_trace.get("requestContext") or {})
        requested_terms = [str(value).strip() for value in (native_trace.get("requestedTerms") or []) if str(value).strip()]
        search_terms = [str(value).strip() for value in (native_trace.get("searchTerms") or []) if str(value).strip()]
        if request_context and requested_terms and search_terms:
            get_trace_db().materialize_native_trace_view(
                "cifi-full",
                "libil2cpp.so",
                str(request_signature or "").strip(),
                requested_terms,
                search_terms,
                dict(native_trace.get("bridgePlan") or {}),
                family_hint=str(selected_family_id or "").strip() or None,
                request_context=request_context,
            )
    return rebound


def _load_request_acquisition_diagnostics(
    trace_scope: str,
    request_signature: str,
) -> list[dict[str, Any]]:
    trace_scope = str(trace_scope or "").strip()
    request_signature = str(request_signature or "").strip()
    if not trace_scope or not request_signature:
        return []
    rows = get_trace_db().list_latest_materialized_acquisition_diagnostics_views(
        "cifi-full",
        "libil2cpp.so",
        request_signature=request_signature,
    )
    return [dict(row) for row in rows if str(row.get("traceScope") or "").strip() == trace_scope]


def _relation_request_context_matches_contract(
    request_context: dict[str, Any] | None,
    relation_scope: str,
    required_seams: list[str],
) -> bool:
    request_context = dict(request_context or {})
    if str(request_context.get("coverageMode") or "").strip() != "relation-shaped":
        return False
    context_scope = str(request_context.get("relationScope") or "").strip()
    if context_scope != str(relation_scope or "").strip():
        return False
    context_seams = sorted(
        str(value).strip()
        for value in (request_context.get("requiredCoverageSeamIds") or [])
        if str(value).strip()
    )
    return context_seams == sorted(str(value).strip() for value in (required_seams or []) if str(value).strip())


def _relation_request_context_from_acquisition_plan(
    acquisition_plan: dict[str, Any],
    planner_resolution: dict[str, Any],
) -> dict[str, Any]:
    acquisition_plan = dict(acquisition_plan or {})
    relation_probe = dict(acquisition_plan.get("selectedRelationProbe") or {})
    if str(acquisition_plan.get("coverageMode") or "").strip() != "relation-shaped" or not relation_probe:
        return {}
    return {
        "coverageMode": "relation-shaped",
        "relationScope": str(relation_probe.get("traceScope") or acquisition_plan.get("selectedScope") or "").strip(),
        "requiredCoverageSeamIds": [
            str(value).strip()
            for value in (relation_probe.get("requiredCoverageSeamIds") or [])
            if str(value).strip()
        ],
        "expectedTerms": [
            str(value).strip()
            for value in (relation_probe.get("expectedTerms") or acquisition_plan.get("requestedTerms") or [])
            if str(value).strip()
        ],
        "anchors": [
            str(value).strip()
            for value in (relation_probe.get("anchors") or acquisition_plan.get("selectedAnchors") or [])
            if str(value).strip()
        ],
        "subjectId": str(acquisition_plan.get("subjectId") or planner_resolution.get("selectedSubjectKey") or "").strip(),
        "seamId": str(acquisition_plan.get("selectedSeamId") or "").strip(),
        "executionRoutineId": str(acquisition_plan.get("selectedRoutine") or "").strip(),
    }


def _ensure_relation_native_payload_materialized(
    *,
    trace_scope: str,
    request_signature: str,
    selected_family_id: str,
    acquisition_plan: dict[str, Any],
    planner_resolution: dict[str, Any],
) -> dict[str, Any]:
    request_context = _relation_request_context_from_acquisition_plan(acquisition_plan, planner_resolution)
    if not request_context:
        return {}
    existing = get_trace_db().find_materialized_native_trace_view("cifi-full", "libil2cpp.so", request_signature)
    if existing and _relation_request_context_matches_contract(
        dict((existing.get("payload") or {}).get("requestContext") or {}),
        str(request_context.get("relationScope") or ""),
        list(request_context.get("requiredCoverageSeamIds") or []),
    ):
        return dict(existing.get("payload") or {})
    diagnostics = _load_request_acquisition_diagnostics(trace_scope, request_signature)
    evidence_terms = unique_strings(
        [
            str(term).strip()
            for row in diagnostics
            for term in (
                list(dict(dict(row.get("payload") or {}).get("relationCoverage") or {}).get("evidenceTerms") or [])
                or list(dict(row.get("payload") or {}).get("expectedCoverage") or [])
            )
            if str(term).strip()
        ]
    )
    requested_terms = unique_strings(
        [str(value).strip() for value in (request_context.get("expectedTerms") or []) if str(value).strip()]
    )
    if not evidence_terms:
        evidence_terms = list(requested_terms)
    if not requested_terms:
        requested_terms = list(evidence_terms)
    if not evidence_terms or not requested_terms:
        return {}
    return dict(
        get_trace_db().materialize_native_trace_view(
            "cifi-full",
            "libil2cpp.so",
            request_signature,
            requested_terms,
            evidence_terms,
            {},
            family_hint=str(selected_family_id or "").strip() or None,
            request_context=request_context,
        )
        or {}
    )


def _describe_relation_gap(
    *,
    trace_scope: str,
    request_signature: str,
    relation_scope: str,
    required_seams: list[str],
    native_trace_payload: dict[str, Any],
    relation_covered: bool,
) -> dict[str, Any]:
    native_trace_payload = dict(native_trace_payload or {})
    native_summary = dict(native_trace_payload.get("summary") or {})
    request_context = dict(native_trace_payload.get("requestContext") or {})
    diagnostics = _load_request_acquisition_diagnostics(trace_scope, request_signature)
    relation_rows = [
        row
        for row in diagnostics
        if isinstance(row.get("payload"), dict) and dict(row.get("payload") or {}).get("relationCoverage")
    ]
    relation_hit_terms = unique_strings(
        [
            str(row.get("acquisitionTerm") or "").strip()
            for row in relation_rows
            if str(dict(row.get("payload") or {}).get("outcome") or "").strip()
            in {"term-present-only", "missing-relation-native-payload", "missing-native-artifact"}
        ]
    )
    if relation_covered:
        return {
            "cacheHitDisposition": "relation-covered",
            "missingArtifacts": [],
            "blockerCategory": "",
            "detail": "",
            "evidenceTerms": relation_hit_terms,
        }
    if not _relation_request_context_matches_contract(request_context, relation_scope, required_seams):
        detail = "No persisted native trace payload matching the requested relation contract was materialized."
        if relation_hit_terms:
            detail = (
                "Exact relation-probe terms were persisted ({terms}), but no native trace payload matching "
                "the requested relation contract was materialized."
            ).format(terms=", ".join(relation_hit_terms[:6]))
        return {
            "cacheHitDisposition": "missing-relation-native-payload",
            "missingArtifacts": ["relation-contract-native-payload"],
            "blockerCategory": "request-timeout-or-incomplete-materialization",
            "detail": detail,
            "evidenceTerms": relation_hit_terms,
        }
    reconstructed_owners = unique_strings(
        [
            str(value).strip()
            for value in [
                *(native_summary.get("reconstructedOwners") or []),
                *(native_summary.get("ownerCandidates") or []),
                native_summary.get("promotedOwner"),
            ]
            if str(value).strip()
        ]
    )
    reconstructed_methods = unique_strings(
        [
            str(value).strip()
            for value in [
                *(native_summary.get("relationConsumerMethods") or []),
                *(native_summary.get("reconstructedMethods") or []),
                *(native_summary.get("promotedMethods") or []),
            ]
            if str(value).strip()
        ]
    )
    reconstructed_fields = unique_strings(
        [
            str(value).strip()
            for value in [
                *(native_summary.get("relationDeclaringFields") or []),
                *(native_summary.get("reconstructedFields") or []),
                *(native_summary.get("promotedFields") or []),
            ]
            if str(value).strip()
        ]
    )
    raw_value_terms = unique_strings(
        [
            str(value).strip()
            for value in [
                *(native_summary.get("relationHandoffTerms") or []),
                *(native_summary.get("rawValueTerms") or []),
                *(native_summary.get("promotedRawValues") or []),
            ]
            if str(value).strip()
        ]
    )
    missing_artifacts: list[str] = []
    if not reconstructed_owners:
        missing_artifacts.append("typed-owner")
    if not reconstructed_methods:
        missing_artifacts.append("consumer-method")
    if not reconstructed_fields:
        missing_artifacts.append("declaring-field")
    if not raw_value_terms:
        missing_artifacts.append("cellboost-to-booster-bonus-handoff")
    if missing_artifacts:
        return {
            "cacheHitDisposition": "missing-native-artifact",
            "missingArtifacts": missing_artifacts,
            "blockerCategory": "native-payload-shape",
            "detail": (
                "The relation-contract native payload was materialized, but it still lacks "
                + ", ".join(missing_artifacts)
                + "."
            ),
            "evidenceTerms": relation_hit_terms,
        }
    return {
        "cacheHitDisposition": "relation-contract-uncovered",
        "missingArtifacts": [],
        "blockerCategory": "subject-state-materialization",
        "detail": (
            "The relation-contract native payload contains owner, method, and field-level evidence, "
            "but the required seam remains open after materialization."
        ),
        "evidenceTerms": relation_hit_terms,
    }


def load_canonical_semantic_scope(scope_id: str) -> dict[str, Any]:
    scope_id = str(scope_id or "").strip()
    if not scope_id:
        return {}
    cached = _trace_bundle_cache_get("canonical-semantic-scope", scope_id)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        view = get_trace_db().find_canonical_semantic_fragment(
            "cifi-full",
            "libil2cpp.so",
            "semantic_scope_fragment",
            scope_id,
        )
    if not view:
        return {}
    payload = dict(view.get("payload") or {})
    _trace_bundle_cache_put("canonical-semantic-scope", scope_id, payload)
    return dict(payload)


def load_canonical_execution_plan(trace_scope: str) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    cached = _trace_bundle_cache_get("execution-plan", trace_scope)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        view = get_trace_db().find_canonical_semantic_fragment(
            "cifi-full",
            "libil2cpp.so",
            "execution_plan_fragment",
            f"target-execution-plan:{trace_scope}",
        )
    if not view:
        return {}
    payload = dict(view.get("payload") or {})
    _trace_bundle_cache_put("execution-plan", trace_scope, payload)
    return dict(payload)


def load_canonical_execution_context(trace_scope: str) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    cached = _trace_bundle_cache_get("execution-context", trace_scope)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        view = get_trace_db().find_canonical_semantic_fragment(
            "cifi-full",
            "libil2cpp.so",
            "execution_context_fragment",
            f"target-execution-context:{trace_scope}",
        )
    if not view:
        return {}
    payload = dict(view.get("payload") or {})
    _trace_bundle_cache_put("execution-context", trace_scope, payload)
    return dict(payload)


def load_or_synthesize_surface_plan(trace_scope: str, target: dict[str, Any] | None = None) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    target = dict(target or {})
    cache_key = "{}::{}".format(trace_scope, str(target.get("id") or trace_scope))
    cached = _trace_bundle_cache_get("surface-plan", cache_key)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        payload = dict(
            get_trace_db().find_or_synthesize_surface_plan(
                "cifi-full",
                "libil2cpp.so",
                trace_scope,
                family_id=str(target.get("familyId") or ""),
                compatibility_target_id=str(target.get("id") or trace_scope),
            )
            or {}
        )
    _trace_bundle_cache_put("surface-plan", cache_key, payload)
    return dict(payload)


def load_or_synthesize_support_context(trace_scope: str, target: dict[str, Any] | None = None) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    target = dict(target or {})
    cache_key = "{}::{}".format(trace_scope, str(target.get("id") or trace_scope))
    cached = _trace_bundle_cache_get("support-context", cache_key)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        payload = dict(
            (
                get_trace_db().find_or_synthesize_support_context(
                    "cifi-full",
                    "libil2cpp.so",
                    trace_scope,
                    family_id=str(target.get("familyId") or ""),
                    compatibility_target_id=str(target.get("id") or trace_scope),
                )
                or {}
            ).get("supportContext")
            or {}
        )
    _trace_bundle_cache_put("support-context", cache_key, payload)
    return dict(payload)


def load_canonical_graph_plan(trace_scope: str) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    cached = _trace_bundle_cache_get("graph-plan", trace_scope)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        view = get_trace_db().find_canonical_semantic_fragment(
            "cifi-full",
            "libil2cpp.so",
            "graph_plan_fragment",
            f"target-graph-plan:{trace_scope}",
        )
    if not view:
        return {}
    payload = dict(view.get("payload") or {})
    _trace_bundle_cache_put("graph-plan", trace_scope, payload)
    return dict(payload)


def load_canonical_bridge_policy(trace_scope: str) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    cached = _trace_bundle_cache_get("bridge-policy", trace_scope)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        view = get_trace_db().find_canonical_semantic_fragment(
            "cifi-full",
            "libil2cpp.so",
            "bridge_policy_fragment",
            f"target-bridge-policy:{trace_scope}",
        )
    if not view:
        return {}
    payload = dict(view.get("payload") or {})
    _trace_bundle_cache_put("bridge-policy", trace_scope, payload)
    return dict(payload)


def load_canonical_target_narrative(trace_scope: str) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    cached = _trace_bundle_cache_get("target-narrative", trace_scope)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        view = get_trace_db().find_canonical_semantic_fragment(
            "cifi-full",
            "libil2cpp.so",
            "target_narrative_fragment",
            f"target-narrative:{trace_scope}",
        )
    if not view:
        return {}
    payload = dict(view.get("payload") or {})
    _trace_bundle_cache_put("target-narrative", trace_scope, payload)
    return dict(payload)


def load_latest_materialized_target_bundle(trace_scope: str) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    cached = _trace_bundle_cache_get("latest-target-bundle", trace_scope)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        view = get_trace_db().find_latest_materialized_target_bundle_view(
            "cifi-full",
            "libil2cpp.so",
            trace_scope,
        )
    if not view:
        return {}
    payload = dict(view.get("payload") or {})
    _trace_bundle_cache_put("latest-target-bundle", trace_scope, payload)
    return dict(payload)


def load_trace_target_knowledge(
    trace_scope: str,
    *,
    subject_kind: str = "",
    subject_key: str = "",
    family_id: str = "",
    target_id: str = "",
) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    if not trace_scope:
        return {}
    cache_key = "::".join([trace_scope, subject_kind, subject_key, family_id, target_id])
    cached = _trace_bundle_cache_get("trace-target-knowledge", cache_key)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads"):
        payload = dict(
            get_trace_db().resolve_trace_target_knowledge(
                "cifi-full",
                "libil2cpp.so",
                trace_scope,
                subject_kind=subject_kind,
                subject_key=subject_key,
                family_id=family_id,
                compatibility_target_id=target_id,
            )
            or {}
        )
    _trace_bundle_cache_put("trace-target-knowledge", cache_key, payload)
    return dict(payload)


def load_handoff_target_metadata(target_id: str) -> dict[str, Any]:
    target_id = str(target_id or "").strip()
    if not target_id:
        return {}
    payload = load_latest_materialized_target_bundle(target_id)
    target_payload = dict(payload.get("target") or {})
    if target_payload:
        return target_payload
    execution_context = get_trace_db().find_or_synthesize_execution_context(
        "cifi-full",
        "libil2cpp.so",
        target_id,
        compatibility_target_id=target_id,
    )
    if not execution_context:
        return {"id": target_id}
    return {
        "id": target_id,
        "label": execution_context.get("label") or target_id,
        "familyId": execution_context.get("familyId"),
        "acceptedAnchors": list(execution_context.get("acceptedAnchors") or []),
        "joinGoal": execution_context.get("joinGoal"),
    }


def load_latest_source_projection(trace_scope: str) -> dict[str, Any]:
    payload = load_latest_materialized_target_bundle(trace_scope)
    return dict(payload.get("sourceFamilies") or {})


def _parse_iso_datetime(value: str | None) -> datetime | None:
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _latest_materialized_target_payloads() -> list[dict[str, Any]]:
    cached = _trace_bundle_cache_get("latest-target-payloads", "all")
    if cached is not None:
        return [dict(row) for row in cached]
    with _trace_profile_span("dbReads.bestGapTargetPayloads"):
        rows = get_trace_db().list_latest_materialized_target_bundle_views("cifi-full", "libil2cpp.so")
    _trace_bundle_cache_put("latest-target-payloads", "all", rows)
    return [dict(row) for row in rows]


def _latest_materialized_subject_state_rows() -> list[dict[str, Any]]:
    cached = _trace_bundle_cache_get("latest-subject-state-rows", "all")
    if cached is not None:
        return [dict(row) for row in cached]
    with _trace_profile_span("dbReads.bestGapSubjectStates"):
        rows = get_trace_db().list_latest_materialized_subject_state_views("cifi-full", "libil2cpp.so")
    _trace_bundle_cache_put("latest-subject-state-rows", "all", rows)
    return [dict(row) for row in rows]


def _materialized_resolver_target_rows() -> list[dict[str, Any]]:
    cached = _trace_bundle_cache_get("materialized-resolver-target-rows", "all")
    if cached is not None:
        return [dict(row) for row in cached]
    with _trace_profile_span("dbReads.bestGapResolverTargets"):
        rows = get_trace_db().list_materialized_resolver_target_views("cifi-full", "libil2cpp.so")
    _trace_bundle_cache_put("materialized-resolver-target-rows", "all", rows)
    return [dict(row) for row in rows]


def _pick_best_subject_state_for_trace_scope(
    trace_scope: str,
    target_id: str,
    subject_state_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    trace_scope = str(trace_scope or "").strip()
    target_id = str(target_id or "").strip()
    expected_row_subject_id = ""
    if "family" not in trace_scope:
        expected_match = re.search(r"(atu\d+)", " ".join([trace_scope, target_id]), re.IGNORECASE)
        if expected_match:
            expected_row_subject_id = f"row:{expected_match.group(1).upper()}Button"
    candidates: list[dict[str, Any]] = []
    for row in subject_state_rows:
        if str(row.get("traceScope") or "").strip() != trace_scope:
            continue
        payload = dict(row.get("payload") or {})
        subject_id = str(payload.get("subjectId") or row.get("subjectId") or "").strip()
        subject_kind = str(payload.get("subjectKind") or "").strip()
        if expected_row_subject_id and subject_kind == "row-local" and subject_id and subject_id != expected_row_subject_id:
            continue
        aliases = {
            str(value).strip()
            for value in (payload.get("targetAliases") or [])
            if str(value).strip()
        }
        alias_match = 1 if target_id and target_id in aliases else 0
        next_seam = dict(payload.get("nextSeam") or {})
        next_seam_open = 1 if str(next_seam.get("status") or "").strip() == "open" else 0
        candidates.append(
            {
                "row": row,
                "aliasMatch": alias_match,
                "nextSeamOpen": next_seam_open,
                "builtAtSort": int(re.sub(r"\D", "", str(row.get("builtAt") or "")) or "0"),
                "knownCount": len([value for value in (payload.get("knownEdges") or []) if str(value).strip()]),
                "missingCount": len([value for value in (payload.get("missingEdges") or []) if str(value).strip()]),
                "blockedCount": len([value for value in (payload.get("blockedEdges") or []) if str(value).strip()]),
                "nonblockingCount": len([value for value in (payload.get("nonblockingEdges") or []) if str(value).strip()]),
                "subjectKind": subject_kind,
            }
        )
    if not candidates:
        return {}
    candidates.sort(
        key=lambda item: (
            -int(item.get("aliasMatch") or 0),
            -int(item.get("nextSeamOpen") or 0),
            -int(item.get("knownCount") or 0),
            int(item.get("blockedCount") or 0),
            int(item.get("missingCount") or 0),
            -int(item.get("nonblockingCount") or 0),
            -int(item.get("builtAtSort") or 0),
            0 if str(item.get("subjectKind") or "") == "row-local" else 1,
            str(((item.get("row") or {}).get("subjectId")) or ""),
        )
    )
    return dict((candidates[0].get("row") or {}))


def _canonical_semantic_scopes_for_target(trace_scope: str, target_id: str | None = None) -> list[dict[str, Any]]:
    trace_scope = str(trace_scope or "").strip()
    target_id = str(target_id or "").strip()
    if not trace_scope and not target_id:
        return []
    cache_key = "{}::{}".format(trace_scope, target_id)
    cached = _trace_bundle_cache_get("semantic-scopes-for-target", cache_key)
    if cached is not None:
        return [dict(item) for item in cached]
    db = get_trace_db()
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT fragment_key, canonical_payload_json, provenance_json, reducer_version, built_at
            FROM canonical_semantic_fragments
            WHERE fragment_kind = 'semantic_scope_fragment'
            ORDER BY built_at DESC, fragment_key ASC
            """
        ).fetchall()
    scopes: list[dict[str, Any]] = []
    for row in rows:
        payload = json.loads(str(row["canonical_payload_json"] or "{}"))
        payload_trace_scope = str(payload.get("traceScope") or "").strip()
        payload_target_id = str(payload.get("targetId") or "").strip()
        if trace_scope and payload_trace_scope == trace_scope:
            scopes.append(
                {
                    "fragmentKey": str(row["fragment_key"] or ""),
                    "payload": payload,
                    "provenance": json.loads(str(row["provenance_json"] or "{}")),
                    "reducerVersion": str(row["reducer_version"] or ""),
                    "builtAt": str(row["built_at"] or ""),
                }
            )
            continue
        if target_id and payload_target_id == target_id:
            scopes.append(
                {
                    "fragmentKey": str(row["fragment_key"] or ""),
                    "payload": payload,
                    "provenance": json.loads(str(row["provenance_json"] or "{}")),
                    "reducerVersion": str(row["reducer_version"] or ""),
                    "builtAt": str(row["built_at"] or ""),
                }
            )
    _trace_bundle_cache_put("semantic-scopes-for-target", cache_key, scopes)
    return [dict(item) for item in scopes]


def _looks_like_trace_anchor(value: str) -> bool:
    candidate = str(value or "").strip()
    if not candidate or len(candidate) > 96:
        return False
    if candidate.startswith("$.") or candidate.startswith("workbench/"):
        return False
    if candidate.lower() in {"present", "missing", "wire", "quarantine", "keep researching", "explore"}:
        return False
    word_count = len(candidate.split())
    if word_count > 7:
        return False
    if not re.search(r"[A-Za-z0-9]", candidate):
        return False
    if re.search(r"[{}\\[\\]]", candidate):
        return False
    return True


def _trace_anchor_priority(path: tuple[str, ...]) -> int:
    path_text = ".".join(part for part in path if part)
    if any(part in {"term", "terms", "searchTerms", "defaultAnchors"} for part in path):
        return 120
    if any(part in {"field", "fields", "rowShellField", "owner", "ownerType", "fullName"} for part in path):
        return 110
    if any(part in {"method", "methods", "hooks", "localHooks", "handoffTerms"} for part in path):
        return 105
    if any(part in {"primaryTerms", "relatedTerms", "bridgedTerms", "contextTerms", "selectedNativeCoreTerms", "selectedContextTerms"} for part in path):
        return 100
    if any(part in {"name", "pathId"} for part in path):
        return 95
    if any(part in {"label", "summary", "statement", "note", "notes", "citations", "support", "supportingEvidenceCount"} for part in path):
        return 0
    if "semanticSearchPlan" in path_text:
        return 90
    return 60


def _collect_trace_anchor_terms(value: Any, path: tuple[str, ...] = ()) -> list[tuple[int, str]]:
    results: list[tuple[int, str]] = []
    if isinstance(value, dict):
        for key, nested in value.items():
            results.extend(_collect_trace_anchor_terms(nested, (*path, str(key))))
        return results
    if isinstance(value, list):
        for nested in value:
            results.extend(_collect_trace_anchor_terms(nested, path))
        return results
    if isinstance(value, (str, int, float)):
        candidate = str(value).strip()
        if _looks_like_trace_anchor(candidate):
            priority = _trace_anchor_priority(path)
            if priority > 0:
                results.append((priority, candidate))
    return results


def _active_trace_scope_run_counts() -> dict[str, int]:
    db = get_trace_db()
    counts: dict[str, int] = {}
    with db.connect() as conn:
        rows = conn.execute(
            """
            SELECT trace_scope, COUNT(DISTINCT request_signature) AS run_count
            FROM trace_fragments
            WHERE project_name = ?
              AND project_file = ?
              AND invalidated_at IS NULL
            GROUP BY trace_scope
            """,
            ("cifi-full", "libil2cpp.so"),
        ).fetchall()
    for row in rows:
        trace_scope = str(row["trace_scope"] or "").strip()
        if not trace_scope:
            continue
        counts[trace_scope] = int(row["run_count"] or 0)
    return counts


def _cached_contract_term_evidence(term: str) -> dict[str, Any]:
    normalized = str(term or "").strip()
    if not normalized:
        return {}
    cache_key = normalize_planner_term(normalized) or normalized.lower()
    cached = _trace_bundle_cache_get("best-gap-contract-term-evidence", cache_key)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads.bestGapTermEvidence"):
        payload = dict(get_trace_db().find_contract_term_evidence("cifi-full", "libil2cpp.so", normalized) or {})
    _trace_bundle_cache_put("best-gap-contract-term-evidence", cache_key, payload)
    return dict(payload)


def _cached_fast_term_evidence_summary(term: str) -> dict[str, Any]:
    normalized = str(term or "").strip()
    if not normalized:
        return {}
    cache_key = normalize_planner_term(normalized) or normalized.lower()
    cached = _trace_bundle_cache_get("best-gap-fast-term-evidence", cache_key)
    if cached is not None:
        return dict(cached)
    with _trace_profile_span("dbReads.bestGapFastTermEvidence"):
        term_view = get_trace_db().find_canonical_term_view("cifi-full", "libil2cpp.so", normalized)
        graph_refs = get_trace_db().find_graph_backfill("cifi-full", "libil2cpp.so", normalized)
    payload = {
        "term": normalized,
        "found": bool(term_view) or bool(graph_refs),
        "sourceIds": unique_strings(
            [
                "canonical-term-view" if term_view else "",
                "graph-links" if graph_refs else "",
            ]
        ),
        "graphRefs": [dict(entry) for entry in graph_refs[:6]],
        "payloadHits": [],
    }
    _trace_bundle_cache_put("best-gap-fast-term-evidence", cache_key, payload)
    return dict(payload)


def _aggregate_term_evidence_summaries(terms: list[str], *, full: bool = False) -> dict[str, Any]:
    normalized_terms = [str(term).strip() for term in terms if str(term).strip()]
    if not normalized_terms:
        return {}
    payload_hits: list[dict[str, Any]] = []
    graph_refs: list[dict[str, Any]] = []
    source_ids: list[str] = []
    found = False
    for term in normalized_terms:
        evidence = _cached_contract_term_evidence(term) if full else _cached_fast_term_evidence_summary(term)
        if not evidence:
            continue
        found = found or bool(evidence.get("found"))
        source_ids.extend(str(source_id) for source_id in (evidence.get("sourceIds") or []) if str(source_id).strip())
        graph_refs.extend(dict(entry) for entry in (evidence.get("graphRefs") or []) if isinstance(entry, dict))
        payload_hits.extend(dict(entry) for entry in (evidence.get("payloadHits") or []) if isinstance(entry, dict))
    counts_by_source: dict[str, int] = {}
    for entry in payload_hits:
        source = str(entry.get("source") or "").strip()
        if not source:
            continue
        counts_by_source[source] = counts_by_source.get(source, 0) + int(entry.get("count") or 0)
    return {
        "term": normalized_terms[0],
        "terms": normalized_terms,
        "found": found,
        "sourceIds": unique_strings(source_ids),
        "graphRefs": graph_refs[:12],
        "payloadHits": [{"source": source, "count": count} for source, count in counts_by_source.items()],
    }


def _cached_recent_nonclosing_acquisition_terms() -> dict[tuple[str, str], set[str]]:
    cached = _trace_bundle_cache_get("best-gap-nonclosing-acquisition-terms", "all")
    if cached is not None:
        return {
            (str(key[0]), str(key[1])): {str(term) for term in value}
            for key, value in cached.items()
        }
    rows = get_trace_db().list_latest_materialized_acquisition_diagnostics_views("cifi-full", "libil2cpp.so")
    exhausted: dict[tuple[str, str], set[str]] = {}
    for row in rows:
        payload = dict(row.get("payload") or {})
        status = str(payload.get("status") or "").strip()
        if status not in {"true-missing-evidence", "exact-evidence-nonclosing"}:
            continue
        trace_scope = str(row.get("traceScope") or payload.get("selectedTraceScope") or "").strip()
        seam_id = str(payload.get("seamId") or "").strip()
        term = str(row.get("acquisitionTerm") or "").strip()
        if not trace_scope or not seam_id or not term:
            continue
        exhausted.setdefault((trace_scope, seam_id), set()).add(term)
    _trace_bundle_cache_put(
        "best-gap-nonclosing-acquisition-terms",
        "all",
        {key: sorted(value) for key, value in exhausted.items()},
    )
    return exhausted


def _looks_like_concrete_acquisition_anchor(term: str) -> bool:
    candidate = str(term or "").strip()
    if not candidate:
        return False
    if candidate.endswith("Button"):
        return True
    if candidate.startswith("Buy"):
        return True
    if "Prefab" in candidate:
        return True
    if candidate.isdigit():
        return True
    if candidate.endswith(("Cost", "Bonus", "Fill", "FillMaxLevel", "MaxLevel", "Overlay", "Content", "Text")):
        return True
    return False


def _term_evidence_score(evidence: dict[str, Any]) -> float:
    payload_total = sum(int((entry or {}).get("count") or 0) for entry in (evidence.get("payloadHits") or []) if isinstance(entry, dict))
    graph_count = len([entry for entry in (evidence.get("graphRefs") or []) if isinstance(entry, dict)])
    source_count = len([source_id for source_id in (evidence.get("sourceIds") or []) if str(source_id).strip()])
    return min(payload_total, 5000) * 0.02 + graph_count * 8.0 + source_count * 6.0


def _summarize_acquisition_action(acquisition_plan: dict[str, Any]) -> dict[str, Any]:
    step = next((dict(item) for item in (acquisition_plan.get("steps") or []) if isinstance(item, dict)), {})
    relation_probe = dict(step.get("relationProbe") or acquisition_plan.get("selectedRelationProbe") or {})
    return {
        "traceScope": str(step.get("traceScope") or acquisition_plan.get("selectedScope") or ""),
        "routine": str(step.get("executionRoutineId") or acquisition_plan.get("selectedRoutine") or ""),
        "seamId": str(step.get("seamId") or acquisition_plan.get("selectedSeamId") or ""),
        "anchors": [str(value) for value in (step.get("anchors") or acquisition_plan.get("selectedAnchors") or []) if str(value).strip()],
        "expectedTerms": [str(value) for value in (step.get("expectedTerms") or acquisition_plan.get("requestedTerms") or []) if str(value).strip()],
        "whyChosen": [str(value) for value in (step.get("whyChosen") or acquisition_plan.get("anchorSelectionReasons") or []) if str(value).strip()],
        "coverageMode": str(step.get("coverageMode") or acquisition_plan.get("coverageMode") or ""),
        "relationProbe": relation_probe or None,
    }


def _build_acquisition_first_best_gap_candidates(
    registry: dict[str, Any],
    run_counts: dict[str, int],
    target_rows: list[dict[str, Any]],
    subject_state_rows: list[dict[str, Any]],
    resolver_target_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    target_payloads_by_scope = {
        str(row.get("traceScope") or "").strip(): dict(row.get("payload") or {})
        for row in target_rows
        if str(row.get("traceScope") or "").strip()
    }
    resolver_payloads_by_scope = {
        str(row.get("traceScope") or "").strip(): dict(row.get("payload") or {})
        for row in resolver_target_rows
        if str(row.get("traceScope") or "").strip()
    }
    target_id_by_scope = {
        str(row.get("traceScope") or "").strip(): str(((row.get("payload") or {}).get("target") or {}).get("targetId") or "").strip()
        for row in target_rows
        if str(row.get("traceScope") or "").strip()
    }
    canonical_row_subjects_by_scope: dict[str, set[str]] = {}
    for row in subject_state_rows:
        trace_scope = str(row.get("traceScope") or "").strip()
        payload = dict(row.get("payload") or {})
        if not trace_scope or str(payload.get("subjectKind") or "").strip() != "row-local":
            continue
        subject_id = str(payload.get("subjectId") or "").strip()
        if not subject_id:
            continue
        canonical_row_subjects_by_scope.setdefault(trace_scope, set()).add(subject_id)
    subject_mentions_by_anchor: dict[str, list[dict[str, str]]] = {}
    candidate_bases: list[dict[str, Any]] = []

    selected_subject_rows: list[dict[str, Any]] = []
    seen_trace_scopes: set[str] = set()
    for row in subject_state_rows:
        trace_scope = str(row.get("traceScope") or "").strip()
        if not trace_scope or trace_scope in seen_trace_scopes:
            continue
        selected_row = _pick_best_subject_state_for_trace_scope(
            trace_scope,
            target_id_by_scope.get(trace_scope) or trace_scope,
            subject_state_rows,
        )
        if not selected_row:
            continue
        seen_trace_scopes.add(trace_scope)
        selected_subject_rows.append(selected_row)

    for row in selected_subject_rows:
        trace_scope = str(row.get("traceScope") or "").strip()
        subject_state = dict(row.get("payload") or {})
        if not trace_scope or not subject_state:
            continue
        target_aliases = [str(value) for value in (subject_state.get("targetAliases") or []) if str(value).strip()]
        target_id = str(target_aliases[0] if target_aliases else trace_scope).strip()
        expected_row_subject_id = ""
        if "family" not in trace_scope:
            expected_match = re.search(r"(atu\d+)", " ".join([trace_scope, target_id]), re.IGNORECASE)
            if expected_match:
                expected_row_subject_id = f"row:{expected_match.group(1).upper()}Button"
        subject_id = str(subject_state.get("subjectId") or "").strip()
        subject_kind = str(subject_state.get("subjectKind") or "").strip()
        if expected_row_subject_id and subject_kind == "row-local" and subject_id and subject_id != expected_row_subject_id:
            continue
        if (
            expected_row_subject_id
            and subject_kind != "row-local"
            and expected_row_subject_id in canonical_row_subjects_by_scope.get(trace_scope, set())
        ):
            continue
        target_payload = dict(target_payloads_by_scope.get(trace_scope) or {})
        target = dict(target_payload.get("target") or (registry.get("targets") or {}).get(target_id) or {})
        resolver_target_payload = dict(resolver_payloads_by_scope.get(trace_scope) or {})
        decision_summary = dict(subject_state.get("decisionSummary") or {})
        blocked_edge_types = list(subject_state.get("blockedEdges") or [])
        baseline_gap = list(subject_state.get("missingEdges") or [])
        known_edge_types = list(subject_state.get("knownEdges") or [])
        nonblocking_edge_types = list(subject_state.get("nonblockingEdges") or [])
        unresolved_edge_types = unique_strings([*blocked_edge_types, *baseline_gap])
        if not unresolved_edge_types:
            continue
        scopes = _canonical_semantic_scopes_for_target(trace_scope, target_id)
        semantic_scope_ids = [
            str((scope.get("payload") or {}).get("scopeId") or scope.get("fragmentKey") or "")
            for scope in scopes
            if str((scope.get("payload") or {}).get("scopeId") or scope.get("fragmentKey") or "").strip()
        ]
        lightweight_knowledge = {
            "traceScope": trace_scope,
            "targetId": target_id,
            "familyId": str(target.get("familyId") or _infer_runtime_family_id(trace_scope, target_id) or ""),
            "subjectState": subject_state,
            "executionRoutineHint": str(resolver_target_payload.get("traceRoutineHint") or trace_scope or "generic-explore"),
            "depthPlan": list(subject_state.get("depthPlan") or []),
        }
        with _trace_profile_span("anchorSelection.bestGap"):
            acquisition_plan = dict(get_trace_db()._build_subject_seam_acquisition_plan(lightweight_knowledge, resolver_target_payload) or {})
        selected_anchors = [str(value) for value in (acquisition_plan.get("selectedAnchors") or []) if str(value).strip()]
        if not selected_anchors:
            continue
        subject_mention = {
            "subjectId": str(subject_state.get("subjectId") or ""),
            "subjectKind": str(subject_state.get("subjectKind") or ""),
            "subjectLabel": str(subject_state.get("subjectLabel") or ""),
            "traceScope": trace_scope,
        }
        for anchor in selected_anchors:
            normalized_anchor = normalize_planner_term(anchor) or anchor.lower()
            subject_mentions_by_anchor.setdefault(normalized_anchor, [])
            if subject_mention not in subject_mentions_by_anchor[normalized_anchor]:
                subject_mentions_by_anchor[normalized_anchor].append(subject_mention)
        candidate_bases.append(
            {
                "traceScope": trace_scope,
                "targetId": target_id,
                "target": target,
                "targetPayload": target_payload,
                "resolverTargetPayload": resolver_target_payload,
                "subjectState": subject_state,
                "decisionSummary": decision_summary,
                "blockedEdgeTypes": blocked_edge_types,
                "baselineGap": baseline_gap,
                "unresolvedEdgeTypes": unresolved_edge_types,
                "knownEdgeTypes": known_edge_types,
                "nonblockingEdgeTypes": nonblocking_edge_types,
                "semanticScopeIds": semantic_scope_ids,
                "acquisitionPlan": acquisition_plan,
                "selectedAnchors": selected_anchors,
                "runCount": int(run_counts.get(trace_scope) or 0),
                "builtAt": str(row.get("builtAt") or ""),
            }
        )

    candidates: list[dict[str, Any]] = []
    exhausted_acquisition_terms = _cached_recent_nonclosing_acquisition_terms()
    for base in candidate_bases:
        acquisition_plan = dict(base.get("acquisitionPlan") or {})
        selected_seam_id = str(acquisition_plan.get("selectedSeamId") or "").strip()
        exhausted_terms = exhausted_acquisition_terms.get(
            (str(base.get("traceScope") or "").strip(), selected_seam_id),
            set(),
        )
        selected_relation_probe = dict(acquisition_plan.get("selectedRelationProbe") or {})
        if selected_relation_probe:
            relation_terms = [
                str(value).strip()
                for value in (selected_relation_probe.get("expectedTerms") or acquisition_plan.get("requestedTerms") or [])
                if str(value).strip()
            ]
            evidence = _aggregate_term_evidence_summaries(relation_terms)
            evidence_frequency = {
                "payloadHitTotal": sum(int((entry or {}).get("count") or 0) for entry in (evidence.get("payloadHits") or []) if isinstance(entry, dict)),
                "payloadHits": [dict(entry) for entry in (evidence.get("payloadHits") or []) if isinstance(entry, dict)],
                "graphRefCount": len([entry for entry in (evidence.get("graphRefs") or []) if isinstance(entry, dict)]),
                "sourceIds": [str(source_id) for source_id in (evidence.get("sourceIds") or []) if str(source_id).strip()],
            }
            score = (
                _term_evidence_score(evidence)
                + len([edge for edge in (base.get("knownEdgeTypes") or []) if str(edge).strip()]) * 6.0
                + 48.0
                - min(int(base.get("runCount") or 0), 8) * 1.5
            )
            subject_state = dict(base.get("subjectState") or {})
            action_plan = dict(acquisition_plan)
            action_plan["selectedAnchors"] = list(selected_relation_probe.get("anchors") or action_plan.get("selectedAnchors") or [])
            action_plan["requestedTerms"] = relation_terms
            candidate = {
                "targetId": str(base.get("targetId") or ""),
                "traceScope": str(base.get("traceScope") or ""),
                "executionTraceScope": str(selected_relation_probe.get("traceScope") or base.get("traceScope") or base.get("targetId") or ""),
                "selectedSubjectKind": str(subject_state.get("subjectKind") or ""),
                "selectedSubjectKey": str(subject_state.get("subjectKey") or subject_state.get("subjectId") or ""),
                "selectedSubjectLabel": str(subject_state.get("subjectLabel") or subject_state.get("subjectId") or ""),
                "label": str((base.get("target") or {}).get("label") or base.get("traceScope") or ""),
                "familyId": str((base.get("target") or {}).get("familyId") or _infer_runtime_family_id(base.get("traceScope"), base.get("targetId")) or ""),
                "verdict": str((base.get("decisionSummary") or {}).get("verdict") or ""),
                "blockedEdgeTypes": list(base.get("blockedEdgeTypes") or []),
                "baselineGap": list(base.get("baselineGap") or []),
                "unresolvedEdgeTypes": list(base.get("unresolvedEdgeTypes") or []),
                "knownEdgeTypes": list(base.get("knownEdgeTypes") or []),
                "nonblockingEdgeTypes": list(base.get("nonblockingEdgeTypes") or []),
                "provedEdgeCount": int((base.get("decisionSummary") or {}).get("provedEdgeCount") or len(base.get("knownEdgeTypes") or [])),
                "negativeEdgeCount": int((base.get("decisionSummary") or {}).get("negativeEdgeCount") or len(base.get("blockedEdgeTypes") or [])),
                "semanticScopeIds": list(base.get("semanticScopeIds") or []),
                "nativeAvailable": bool(((base.get("targetPayload") or {}).get("nativeView") or {}).get("available") is True),
                "nativeSearchTerms": list((((base.get("targetPayload") or {}).get("nativeView") or {}).get("searchTerms") or [])),
                "anchors": list(action_plan.get("selectedAnchors") or []),
                "selectedAnchors": list(action_plan.get("selectedAnchors") or []),
                "anchorSelectionReasons": unique_strings([*list(action_plan.get("anchorSelectionReasons") or []), "relation-shaped runtime-model probe"]),
                "selectedSeamId": str(action_plan.get("selectedSeamId") or ((subject_state.get("nextSeam") or {}).get("id")) or "").strip(),
                "executionRoutineId": str(selected_relation_probe.get("routine") or (base.get("resolverTargetPayload") or {}).get("traceRoutineHint") or base.get("traceScope") or "generic-explore"),
                "targetAliases": list(subject_state.get("targetAliases") or []),
                "acquisitionPlan": action_plan,
                "score": round(score, 2),
                "builtAt": str(base.get("builtAt") or ""),
                "decisionSummary": dict(base.get("decisionSummary") or {}),
                "runCount": int(base.get("runCount") or 0),
                "unresolvedAnchor": str(selected_relation_probe.get("label") or selected_relation_probe.get("probeId") or "relation-probe"),
                "evidence": evidence,
                "evidenceTerms": relation_terms,
                "evidenceFrequency": evidence_frequency,
                "canonicalSubjectsMentioningAnchor": [
                    {
                        "subjectId": str(subject_state.get("subjectId") or ""),
                        "subjectKind": str(subject_state.get("subjectKind") or ""),
                        "subjectLabel": str(subject_state.get("subjectLabel") or ""),
                        "traceScope": str(base.get("traceScope") or ""),
                    }
                ],
                "knownSummary": list(base.get("knownEdgeTypes") or []),
                "unknownSummary": list(base.get("unresolvedEdgeTypes") or []),
                "plannedAction": _summarize_acquisition_action(action_plan),
                "coverageMode": "relation-shaped",
            }
            candidates.append(candidate)
            continue
        requested_term_pool = [
            str(value)
            for value in (acquisition_plan.get("requestedTerms") or [])
            if str(value).strip()
        ]
        if any(_looks_like_concrete_acquisition_anchor(term) for term in requested_term_pool):
            candidate_anchor_pool = unique_strings(requested_term_pool)
        else:
            candidate_anchor_pool = unique_strings(
                [
                    *requested_term_pool,
                    *[
                        str(value)
                        for value in (base.get("selectedAnchors") or [])
                        if str(value).strip()
                    ],
                ]
            )
        candidate_anchor_pool = [anchor for anchor in candidate_anchor_pool if _looks_like_concrete_acquisition_anchor(anchor)]
        unexhausted_anchor_pool = [anchor for anchor in candidate_anchor_pool if anchor not in exhausted_terms]
        if unexhausted_anchor_pool:
            candidate_anchor_pool = unexhausted_anchor_pool
        if not candidate_anchor_pool:
            candidate_anchor_pool = list(base.get("selectedAnchors") or [])[:1]
        for unresolved_anchor in candidate_anchor_pool[:4]:
            evidence = _cached_fast_term_evidence_summary(unresolved_anchor)
            normalized_anchor = normalize_planner_term(unresolved_anchor) or unresolved_anchor.lower()
            canonical_subject_mentions = list(subject_mentions_by_anchor.get(normalized_anchor) or [])
            evidence_frequency = {
                "payloadHitTotal": sum(int((entry or {}).get("count") or 0) for entry in (evidence.get("payloadHits") or []) if isinstance(entry, dict)),
                "payloadHits": [dict(entry) for entry in (evidence.get("payloadHits") or []) if isinstance(entry, dict)],
                "graphRefCount": len([entry for entry in (evidence.get("graphRefs") or []) if isinstance(entry, dict)]),
                "sourceIds": [str(source_id) for source_id in (evidence.get("sourceIds") or []) if str(source_id).strip()],
            }
            action_plan = dict(acquisition_plan)
            action_plan["selectedAnchors"] = [unresolved_anchor]
            action_plan["anchorSelectionReasons"] = unique_strings(
                [*list(action_plan.get("anchorSelectionReasons") or []), f"ranked unresolved anchor {unresolved_anchor}"]
            )
            if unresolved_anchor in {
                str(value).strip()
                for value in (acquisition_plan.get("requestedTerms") or [])
                if str(value).strip()
            }:
                action_plan["requestedTerms"] = [unresolved_anchor]
            action_steps: list[dict[str, Any]] = []
            for step in [dict(item) for item in (acquisition_plan.get("steps") or []) if isinstance(item, dict)]:
                narrowed_step = dict(step)
                narrowed_step["anchors"] = [unresolved_anchor]
                if unresolved_anchor in {
                    str(value).strip()
                    for value in (step.get("expectedTerms") or acquisition_plan.get("requestedTerms") or [])
                    if str(value).strip()
                }:
                    narrowed_step["expectedTerms"] = [unresolved_anchor]
                narrowed_step["whyChosen"] = unique_strings(
                    [*list(narrowed_step.get("whyChosen") or []), f"ranked unresolved anchor {unresolved_anchor}"]
                )
                action_steps.append(narrowed_step)
            action_plan["steps"] = action_steps
            score = (
                _term_evidence_score(evidence)
                + len(canonical_subject_mentions) * 18.0
                + len([edge for edge in (base.get("knownEdgeTypes") or []) if str(edge).strip()]) * 6.0
                + (10.0 if str((base.get("subjectState") or {}).get("subjectKind") or "") == "row-local" else 0.0)
                + (6.0 if unresolved_anchor.endswith("Button") else 0.0)
                + (4.0 if "Prefab" in unresolved_anchor else 0.0)
                - len([edge for edge in (base.get("blockedEdgeTypes") or []) if str(edge).strip()]) * 2.0
                - min(int(base.get("runCount") or 0), 8) * 1.5
            )
            subject_state = dict(base.get("subjectState") or {})
            candidate = {
                "targetId": str(base.get("targetId") or ""),
                "traceScope": str(base.get("traceScope") or ""),
                "executionTraceScope": str(base.get("traceScope") or base.get("targetId") or ""),
                "selectedSubjectKind": str(subject_state.get("subjectKind") or ""),
                "selectedSubjectKey": str(subject_state.get("subjectKey") or subject_state.get("subjectId") or ""),
                "selectedSubjectLabel": str(subject_state.get("subjectLabel") or subject_state.get("subjectId") or ""),
                "label": str((base.get("target") or {}).get("label") or base.get("traceScope") or ""),
                "familyId": str((base.get("target") or {}).get("familyId") or _infer_runtime_family_id(base.get("traceScope"), base.get("targetId")) or ""),
                "verdict": str((base.get("decisionSummary") or {}).get("verdict") or ""),
                "blockedEdgeTypes": list(base.get("blockedEdgeTypes") or []),
                "baselineGap": list(base.get("baselineGap") or []),
                "unresolvedEdgeTypes": list(base.get("unresolvedEdgeTypes") or []),
                "knownEdgeTypes": list(base.get("knownEdgeTypes") or []),
                "nonblockingEdgeTypes": list(base.get("nonblockingEdgeTypes") or []),
                "provedEdgeCount": int((base.get("decisionSummary") or {}).get("provedEdgeCount") or len(base.get("knownEdgeTypes") or [])),
                "negativeEdgeCount": int((base.get("decisionSummary") or {}).get("negativeEdgeCount") or len(base.get("blockedEdgeTypes") or [])),
                "semanticScopeIds": list(base.get("semanticScopeIds") or []),
                "nativeAvailable": bool(((base.get("targetPayload") or {}).get("nativeView") or {}).get("available") is True),
                "nativeSearchTerms": list((((base.get("targetPayload") or {}).get("nativeView") or {}).get("searchTerms") or [])),
                "anchors": list(base.get("selectedAnchors") or []),
                "selectedAnchors": [unresolved_anchor],
                "anchorSelectionReasons": unique_strings(
                    [*list(action_plan.get("anchorSelectionReasons") or []), f"evidence-first unresolved anchor {unresolved_anchor}"]
                ),
                "selectedSeamId": str(action_plan.get("selectedSeamId") or ((subject_state.get("nextSeam") or {}).get("id")) or "").strip(),
                "executionRoutineId": str((base.get("resolverTargetPayload") or {}).get("traceRoutineHint") or base.get("traceScope") or "generic-explore"),
                "targetAliases": list(subject_state.get("targetAliases") or []),
                "acquisitionPlan": action_plan,
                "score": round(score, 2),
                "builtAt": str(base.get("builtAt") or ""),
                "decisionSummary": dict(base.get("decisionSummary") or {}),
                "subjectState": subject_state,
                "runCount": int(base.get("runCount") or 0),
                "unresolvedAnchor": unresolved_anchor,
                "evidence": evidence,
                "evidenceFrequency": evidence_frequency,
                "canonicalSubjectsMentioningAnchor": canonical_subject_mentions[:8],
                "knownSummary": list(base.get("knownEdgeTypes") or []),
                "unknownSummary": unique_strings([*list(base.get("blockedEdgeTypes") or []), *list(base.get("baselineGap") or [])]),
                "plannedAction": _summarize_acquisition_action(action_plan),
                "coverageMode": str(action_plan.get("coverageMode") or ""),
                "selectionMode": "acquisition-first-canonical-evidence",
                "materializedProvenance": {
                    "traceScope": str(base.get("traceScope") or ""),
                    "targetAliases": list(subject_state.get("targetAliases") or []),
                    "runCount": int(base.get("runCount") or 0),
                },
            }
            candidates.append(candidate)
    return candidates


def choose_best_gap_plan(registry: dict[str, Any] | None = None) -> dict[str, Any]:
    registry = registry or load_request_catalog()
    with _trace_phase("DB reads", "phase.bestGapDbReads"):
        with _trace_profile_span("dbReads.bestGapRunCounts"):
            run_counts = _active_trace_scope_run_counts()
        target_rows = _latest_materialized_target_payloads()
        subject_state_rows = _latest_materialized_subject_state_rows()
        resolver_target_rows = _materialized_resolver_target_rows()
    with _trace_phase("Candidate scoring", "phase.bestGapCandidateScoring"):
        with _trace_profile_span("candidateScoring.bestGap"):
            candidates = _build_acquisition_first_best_gap_candidates(
                registry,
                run_counts,
                target_rows,
                subject_state_rows,
                resolver_target_rows,
            )
    if not candidates:
        raise ValueError("No DB-backed blocked trace targets are currently available.")
    candidates.sort(
        key=lambda item: (
            0 if str(item.get("coverageMode") or "") == "relation-shaped" else 1,
            -float(item.get("score") or 0.0),
            -int((item.get("evidenceFrequency") or {}).get("payloadHitTotal") or 0),
            -len(item.get("canonicalSubjectsMentioningAnchor") or []),
            -int(item.get("provedEdgeCount") or 0),
            int(item.get("negativeEdgeCount") or 0),
            int(len(item.get("blockedEdgeTypes") or [])),
            str(item.get("unresolvedAnchor") or ""),
            str(item.get("traceScope") or ""),
        )
    )
    best = dict(candidates[0])
    evidence_terms = [str(term).strip() for term in (best.get("evidenceTerms") or []) if str(term).strip()]
    if evidence_terms:
        full_evidence = _aggregate_term_evidence_summaries(evidence_terms[:6], full=True)
    else:
        full_evidence = _cached_contract_term_evidence(str(best.get("unresolvedAnchor") or ""))
    best["evidence"] = full_evidence
    best["evidenceFrequency"] = {
        "payloadHitTotal": sum(int((entry or {}).get("count") or 0) for entry in (full_evidence.get("payloadHits") or []) if isinstance(entry, dict)),
        "payloadHits": [dict(entry) for entry in (full_evidence.get("payloadHits") or []) if isinstance(entry, dict)],
        "graphRefCount": len([entry for entry in (full_evidence.get("graphRefs") or []) if isinstance(entry, dict)]),
        "sourceIds": [str(source_id) for source_id in (full_evidence.get("sourceIds") or []) if str(source_id).strip()],
    }
    best["rankedAlternatives"] = candidates[:5]
    return best


def _print_best_gap_plan(best_gap_plan: dict[str, Any]) -> None:
    print(
        "Best current acquisition gap: {} ({})".format(
            best_gap_plan["traceScope"],
            best_gap_plan["label"],
        )
    )
    if best_gap_plan.get("unresolvedAnchor"):
        print("  unresolvedAnchor={}".format(best_gap_plan.get("unresolvedAnchor") or "none"))
    if best_gap_plan.get("selectedSubjectKind") and best_gap_plan.get("selectedSubjectKey"):
        print(
            "  subject={} {} executionScope={}".format(
                best_gap_plan.get("selectedSubjectKind"),
                best_gap_plan.get("selectedSubjectKey"),
                best_gap_plan.get("executionTraceScope") or best_gap_plan.get("traceScope") or "unknown",
            )
        )
    if best_gap_plan.get("selectedSeamId") or best_gap_plan.get("executionRoutineId"):
        print(
            "  seam={} routine={}".format(
                best_gap_plan.get("selectedSeamId") or "none",
                best_gap_plan.get("executionRoutineId") or "unknown",
            )
        )
    print(
        "  score={} verdict={} seam={} unresolved={} blocked={} proved={} runs={} semanticScopes={}".format(
            best_gap_plan["score"],
            best_gap_plan["verdict"],
            best_gap_plan.get("selectedSeamId") or "none",
            ",".join(best_gap_plan.get("unresolvedEdgeTypes") or []) or "none",
            ",".join(best_gap_plan["blockedEdgeTypes"]) or "none",
            best_gap_plan["provedEdgeCount"],
            best_gap_plan.get("runCount") or 0,
            ",".join(best_gap_plan["semanticScopeIds"]) or "none",
        )
    )
    evidence_frequency = dict(best_gap_plan.get("evidenceFrequency") or {})
    if evidence_frequency:
        print(
            "  evidence payloadHits={} graphRefs={} provenance={}".format(
                evidence_frequency.get("payloadHitTotal") or 0,
                evidence_frequency.get("graphRefCount") or 0,
                ", ".join(evidence_frequency.get("sourceIds") or []) or "none",
            )
        )
    canonical_subjects = list(best_gap_plan.get("canonicalSubjectsMentioningAnchor") or [])
    if canonical_subjects:
        print(
            "  canonicalSubjects={}".format(
                " | ".join(
                    "{} {} @{}".format(
                        item.get("subjectKind") or "subject",
                        item.get("subjectId") or item.get("subjectLabel") or "unknown",
                        item.get("traceScope") or "unknown",
                    )
                    for item in canonical_subjects[:4]
                )
            )
        )
    if best_gap_plan.get("knownSummary") or best_gap_plan.get("unknownSummary"):
        print(
            "  known={} unknown={}".format(
                ", ".join(best_gap_plan.get("knownSummary") or []) or "none",
                ", ".join(best_gap_plan.get("unknownSummary") or []) or "none",
            )
        )
    planned_action = dict(best_gap_plan.get("plannedAction") or {})
    if planned_action:
        print(
            "  acquisitionAction scope={} routine={} anchors={} terms={}".format(
                planned_action.get("traceScope") or "unknown",
                planned_action.get("routine") or "unknown",
                ", ".join(planned_action.get("anchors") or []) or "none",
                ", ".join(planned_action.get("expectedTerms") or []) or "none",
            )
        )
        if str(planned_action.get("coverageMode") or "").strip():
            relation_probe = dict(planned_action.get("relationProbe") or {})
            print(
                "  acquisitionCoverage mode={} relationScope={} requiredSeams={}".format(
                    planned_action.get("coverageMode") or "term-shaped",
                    relation_probe.get("traceScope") or "none",
                    ", ".join(relation_probe.get("requiredCoverageSeamIds") or []) or "none",
                )
            )
    if best_gap_plan.get("anchors"):
        print("  anchors={}".format(", ".join(best_gap_plan["anchors"])))
    if best_gap_plan.get("targetAliases"):
        print("  targetAliases={}".format(", ".join(best_gap_plan.get("targetAliases") or []) or "none"))
    if best_gap_plan.get("anchorSelectionReasons"):
        print("  anchorWhy={}".format("; ".join(best_gap_plan.get("anchorSelectionReasons") or []) or "none"))
    alternatives = list(best_gap_plan.get("rankedAlternatives") or [])[1:4]
    if alternatives:
        print(
            "  next={}".format(
                " | ".join(
                    "{}:{} anchor={} seam={} graphRefs={} subjects={}".format(
                        alt["traceScope"],
                        alt["score"],
                        alt.get("unresolvedAnchor") or "none",
                        alt.get("selectedSeamId") or "none",
                        int((alt.get("evidenceFrequency") or {}).get("graphRefCount") or 0),
                        len(alt.get("canonicalSubjectsMentioningAnchor") or []),
                    )
                    for alt in alternatives
                )
            )
        )


def _print_completed_trace_run(dataset: dict[str, Any], iteration: int | None = None, total_iterations: int | None = None) -> None:
    prefix = "Trace run completed"
    if iteration is not None and total_iterations is not None and total_iterations > 1:
        prefix = f"Trace run completed ({iteration}/{total_iterations})"
    trace_registry = dict(dataset.get("traceRegistry") or {})
    trace_params = dict(dataset.get("traceParams") or {})
    trace_run = dict(dataset.get("traceRun") or {})
    planner_resolution = dict(dataset.get("plannerResolution") or {})
    decision_summary = dict(dataset.get("decisionSummary") or {})
    trace_knowledge = dict(dataset.get("traceKnowledge") or {})
    trace_directive = dict(dataset.get("traceDirective") or {})
    post_run_discoveries = dict(dataset.get("postRunDiscoveries") or {})
    acquisition_plan = dict(trace_directive.get("acquisitionPlan") or {})
    execution_scope = str(trace_registry.get("executionTraceScope") or "").strip()
    subject_kind = str(planner_resolution.get("selectedSubjectKind") or "").strip()
    subject_key = str(planner_resolution.get("selectedSubjectKey") or "").strip()
    subject_state_fallback = dict(post_run_discoveries.get("subjectState") or {})
    if not subject_state_fallback and execution_scope and subject_key:
        subject_state_row = _pick_best_subject_state_for_trace_scope(
            execution_scope,
            str(trace_registry.get("selectedTargetId") or planner_resolution.get("selectedTargetId") or execution_scope),
            _latest_materialized_subject_state_rows(),
        )
        subject_state_fallback = dict(subject_state_row.get("payload") or {})
    if not acquisition_plan:
        acquisition_plan = dict(post_run_discoveries.get("acquisitionPlan") or {})
    if not acquisition_plan and subject_state_fallback:
        acquisition_plan = dict(
            get_trace_db().resolve_trace_execution_request(
                "cifi-full",
                "libil2cpp.so",
                execution_scope,
                subject_kind=str(trace_knowledge.get("subjectKind") or subject_kind or "").strip(),
                subject_key=str(trace_knowledge.get("subjectId") or subject_key or "").strip(),
                family_id=str(trace_registry.get("selectedFamilyId") or trace_params.get("family") or ""),
                compatibility_target_id=str(trace_registry.get("selectedTargetId") or planner_resolution.get("selectedTargetId") or execution_scope),
            ).get("acquisitionPlan")
            or {}
        )
    print(prefix + ":")
    print(
        "  subject={} {}".format(
            planner_resolution.get("selectedSubjectKind") or "unknown-subject",
            planner_resolution.get("selectedSubjectKey") or "unknown",
        )
    )
    selected_seam_id = acquisition_plan.get("selectedSeamId") or ((trace_directive.get("nextSeam") or {}).get("id")) or ((subject_state_fallback.get("nextSeam") or {}).get("id"))
    selected_routine = acquisition_plan.get("selectedRoutine") or trace_directive.get("executionRoutineId")
    if selected_seam_id or selected_routine:
        print(
            "  seam={} routine={}".format(
                selected_seam_id or "none",
                selected_routine or "unknown",
            )
        )
    print("  executionScope={}".format(trace_registry.get("executionTraceScope") or "unknown"))
    print("  family={}".format(trace_registry.get("selectedFamilyId") or trace_params.get("family") or "unknown"))
    print("  runId={}".format(trace_run.get("id") or "db-only"))
    print(
        "  anchors={}".format(
            ", ".join(acquisition_plan.get("selectedAnchors") or trace_params.get("anchors") or []) or "none"
        )
    )
    target_aliases = list(trace_knowledge.get("targetAliases") or subject_state_fallback.get("targetAliases") or [])
    if target_aliases:
        print("  targetAliases={}".format(", ".join(target_aliases) or "none"))
    if acquisition_plan.get("anchorSelectionReasons"):
        print("  anchorWhy={}".format("; ".join(acquisition_plan.get("anchorSelectionReasons") or []) or "none"))
    native_timeout = trace_params.get("nativeTimeout")
    if native_timeout is not None:
        timeout_label = "disabled" if int(native_timeout) <= 0 else str(native_timeout)
        print("  nativeTimeout={}".format(timeout_label))
    native_trace = dict(dataset.get("nativeTrace") or {})
    native_reuse_report = dict(native_trace.get("reuseReport") or {})
    if native_reuse_report:
        print(
            "  nativeReuse reused={} skipped={} traced={} missing={}".format(
                ",".join(native_reuse_report.get("reusedAnchors") or []) or "none",
                ",".join(native_reuse_report.get("skippedAnchors") or []) or "none",
                ",".join(native_reuse_report.get("newlyTracedAnchors") or []) or "none",
                ",".join(native_reuse_report.get("missingAnchorsAfterExecution") or []) or "none",
            )
        )
    relation_coverage = dict(post_run_discoveries.get("relationCoverage") or {})
    if relation_coverage:
        print(
            "  relationCoverage mode={} scope={} covered={} cacheHit={}".format(
                relation_coverage.get("mode") or "term-shaped",
                relation_coverage.get("relationScope") or "none",
                "yes" if relation_coverage.get("covered") else "no",
                relation_coverage.get("cacheHitDisposition") or "unknown",
            )
        )
        if relation_coverage.get("blockerCategory"):
            print("  relationBlockerCategory={}".format(relation_coverage.get("blockerCategory")))
        if relation_coverage.get("missingArtifacts"):
            print(
                "  relationMissingArtifacts={}".format(
                    ",".join(relation_coverage.get("missingArtifacts") or []) or "none"
                )
            )
        if relation_coverage.get("detail"):
            print("  relationDetail={}".format(relation_coverage.get("detail")))
    print(
        "  verdict={} blocked={} proved={} negative={}".format(
            decision_summary.get("verdict") or "unknown",
            ",".join(decision_summary.get("blockedEdgeTypes") or []) or "none",
            decision_summary.get("provedEdgeCount") or 0,
            decision_summary.get("negativeEdgeCount") or 0,
        )
    )
    if decision_summary.get("summary"):
        print("  summary={}".format(decision_summary["summary"]))
    discovered_known = list(trace_knowledge.get("knownEdges") or trace_knowledge.get("clearedEdgeTypes") or subject_state_fallback.get("knownEdges") or [])
    discovered_missing = list(trace_knowledge.get("missingEdgeTypes") or trace_knowledge.get("missingEdges") or subject_state_fallback.get("missingEdges") or [])
    discovered_nonblocking = list(trace_knowledge.get("nonblockingEdges") or subject_state_fallback.get("nonblockingEdges") or [])
    discovered_next_seam = dict(trace_directive.get("nextSeam") or subject_state_fallback.get("nextSeam") or {})
    print(
        "  discovered known={} missing={} nonblocking={} nextSeam={}".format(
            ",".join(discovered_known) or "none",
            ",".join(discovered_missing) or "none",
            ",".join(discovered_nonblocking) or "none",
            discovered_next_seam.get("id") or "none",
        )
    )


def _execute_trace_bundle_run(
    args: argparse.Namespace,
    registry: dict[str, Any],
    output_mode: str,
) -> dict[str, Any]:
    global ACTIVE_TRACE_PROFILER
    reset_trace_bundle_run_cache()
    profiler = TraceRunProfiler(enabled=bool(getattr(args, "profile_timing", False)))
    if args.best_gap and not profiler.enabled:
        profiler = TraceRunProfiler(enabled=True)
    ACTIVE_TRACE_PROFILER = profiler
    try:
        with profiler.phase("Subject-state / contract materialization", "phase.subjectStateMaterialization"):
            with profiler.span("plannerTargetResolution"):
                trace_plan = plan_trace_bundle_request(args, registry)
                planner_resolution = trace_plan["plannerResolution"]
                execution_target_id = str(trace_plan.get("executionTargetId") or trace_plan.get("selectedTargetId") or "")
                execution_trace_scope = str(trace_plan.get("executionTraceScope") or execution_target_id)
                selected_family_id = str(trace_plan["selectedFamilyId"])
                knowledge_plan = dict(trace_plan.get("knowledgePlan") or {})
                asset_set = trace_plan["assetSet"]
                request_signature = str(trace_plan["requestSignature"])

        profiler.set_metadata("executionTraceScope", execution_trace_scope)
        profiler.set_metadata("selectedFamilyId", selected_family_id)
        profiler.set_metadata("requestSignature", request_signature)
        if knowledge_plan:
            profiler.set_metadata("traceDirectiveMode", knowledge_plan.get("mode"))
            profiler.set_metadata("nextSeamId", ((knowledge_plan.get("nextSeam") or {}).get("id")))
        acquisition_plan = dict(knowledge_plan.get("acquisitionPlan") or {})
        next_seam_id = str((knowledge_plan.get("nextSeam") or {}).get("id") or "").strip()
        cleared_edge_types = {
            str(edge_type)
            for edge_type in ((knowledge_plan.get("knowledge") or {}).get("clearedEdgeTypes") or [])
            if str(edge_type).strip()
        }
        _set_active_trace_runtime_flags(
            {
                "skipUnityRawStringScan": (
                    next_seam_id == "exact-display-update-path"
                    and ("native-reconstruction" in cleared_edge_types or "exact-shell-to-prefab" in cleared_edge_types)
                ),
                "acquisitionPlan": acquisition_plan,
            }
        )
        _ensure_relation_native_payload_materialized(
            trace_scope=execution_trace_scope,
            request_signature=request_signature,
            selected_family_id=selected_family_id,
            acquisition_plan=acquisition_plan,
            planner_resolution=planner_resolution,
        )
        for term_diagnostic in [dict(item) for item in (acquisition_plan.get("termDiagnostics") or []) if isinstance(item, dict)]:
            if str(term_diagnostic.get("status") or "").strip() != "routing-failure":
                continue
            diagnostic_term = str(term_diagnostic.get("term") or "").strip()
            if not diagnostic_term:
                continue
            diagnostic_scope = str(term_diagnostic.get("selectedTraceScope") or execution_trace_scope or "").strip()
            _persist_acquisition_term_diagnostic(
                request_signature,
                diagnostic_scope,
                diagnostic_term,
                {
                    "status": "routing-failure",
                    "outcome": "routing-failure",
                    "failureKind": "routing-failure",
                    "selectedTraceScope": diagnostic_scope,
                    "expectedCoverage": list(term_diagnostic.get("expectedCoverage") or []),
                    "whyChosen": list(term_diagnostic.get("whyChosen") or []),
                    "evidenceHits": {"found": False, "graphRefs": [], "payloadHits": []},
                    "evidenceSourcesChecked": [],
                    "detail": "Planner could not rank a runnable acquisition scope for the exact missing term.",
                    "nextRecommended": dict(term_diagnostic.get("recommendedNext") or {}) or None,
                },
            )

        short_circuit_existing = False
        if knowledge_plan.get("mode") == "run-evidence-acquisition" and list(acquisition_plan.get("steps") or []) and not args.resume:
            acquisition_results: list[dict[str, Any]] = []
            dataset = {}
            requested_terms = [str(term).strip() for term in (acquisition_plan.get("requestedTerms") or []) if str(term).strip()]
            for term_diagnostic in [dict(item) for item in (acquisition_plan.get("termDiagnostics") or []) if isinstance(item, dict)]:
                diagnostic_term = str(term_diagnostic.get("term") or "").strip()
                if not diagnostic_term:
                    continue
                diagnostic_scope = str(term_diagnostic.get("selectedTraceScope") or execution_trace_scope or "").strip()
                status = str(term_diagnostic.get("status") or "").strip() or "planned"
                if status == "routing-failure":
                    continue
                failure_kind = str(term_diagnostic.get("failureKind") or "").strip() or None
                payload = {
                    "status": status,
                    "failureKind": failure_kind,
                    "selectedTraceScope": diagnostic_scope,
                    "expectedCoverage": list(term_diagnostic.get("expectedCoverage") or []),
                    "whyChosen": list(term_diagnostic.get("whyChosen") or []),
                    "evidenceHits": {"found": False, "graphRefs": [], "payloadHits": []},
                    "evidenceSourcesChecked": [],
                    "nextRecommended": dict(term_diagnostic.get("recommendedNext") or {}) or None,
                }
                if status == "routing-failure":
                    payload["outcome"] = "routing-failure"
                    payload["detail"] = "Planner could not rank a runnable acquisition scope for the exact missing term."
                _persist_acquisition_term_diagnostic(
                    request_signature,
                    diagnostic_scope,
                    diagnostic_term,
                    payload,
                )
            for step in list(acquisition_plan.get("steps") or []):
                step_trace_scope = str(step.get("traceScope") or "")
                step_target_id = str(step.get("targetId") or step_trace_scope)
                step_family_id = str(step.get("familyId") or selected_family_id or "")
                step_subject_kind = str(step.get("subjectKind") or planner_resolution.get("selectedSubjectKind") or "")
                step_subject_key = str(step.get("subjectKey") or planner_resolution.get("selectedSubjectKey") or step_trace_scope)
                step_subject_label = str(step.get("subjectLabel") or planner_resolution.get("selectedSubjectLabel") or step_trace_scope)
                step_anchors = list(step.get("anchors") or [])
                step_queries = list(step.get("expectedTerms") or [])
                step_request_signature = build_trace_request_signature(
                    step_trace_scope,
                    step_family_id,
                    step_queries,
                    step_anchors,
                    args.extended_search,
                    args.depth_search,
                    args.level,
                    asset_set.get("fingerprint", ""),
                )
                step_planner_resolution = dict(planner_resolution)
                step_planner_resolution.update(
                    {
                        "selectedSubjectKind": step_subject_kind,
                        "selectedSubjectKey": step_subject_key,
                        "selectedSubjectLabel": step_subject_label,
                        "selectedTargetId": step_target_id,
                        "matchedFamilyId": step_family_id,
                        "expandedAnchors": step_anchors,
                        "matchedTerms": step_queries,
                    }
                )
                step_trace_plan = dict(trace_plan)
                step_knowledge_plan = dict(step.get("knowledgePlan") or {})
                step_knowledge_plan["executionRoutineId"] = str(
                    step.get("executionRoutineId")
                    or step_knowledge_plan.get("executionRoutineId")
                    or step_trace_scope
                )
                step_trace_plan.update(
                    {
                        "plannerResolution": step_planner_resolution,
                        "selectedSubjectKind": step_subject_kind,
                        "selectedSubjectKey": step_subject_key,
                        "selectedTargetId": step_target_id,
                        "executionTargetId": step_target_id,
                        "executionTraceScope": step_trace_scope,
                        "selectedFamilyId": step_family_id,
                        "knowledgePlan": step_knowledge_plan,
                        "requestSignature": step_request_signature,
                    }
                )
                for step_term in step_queries:
                    _persist_acquisition_term_diagnostic(
                        request_signature,
                        step_trace_scope,
                        step_term,
                        {
                            "status": "in-progress",
                            "outcome": "running",
                            "selectedTraceScope": step_trace_scope,
                            "selectedTargetId": step_target_id,
                            "executionRoutineId": str(step_knowledge_plan.get("executionRoutineId") or ""),
                            "expectedCoverage": [step_term],
                            "whyChosen": list(step.get("whyChosen") or []),
                            "evidenceHits": {"found": False, "graphRefs": [], "payloadHits": []},
                            "evidenceSourcesChecked": [],
                            "nextRecommended": _recommended_next_acquisition_step(step_term, step_trace_scope),
                        },
                    )
                step_args = argparse.Namespace(**vars(args))
                step_args.query = step_queries
                step_args.anchor = step_anchors
                try:
                    step_dataset = collect_trace_bundle_components(step_args, step_trace_plan, registry)
                    persist_trace_bundle_fragments(step_dataset, step_trace_scope, step_request_signature)
                    step_dataset = materialize_trace_bundle_dataset(step_dataset, step_trace_scope, step_request_signature)
                    step_dataset = _rebind_acquisition_dataset_to_request(
                        step_dataset,
                        planner_resolution=planner_resolution,
                        execution_trace_scope=execution_trace_scope,
                        execution_target_id=execution_target_id,
                        selected_family_id=selected_family_id,
                        request_signature=request_signature,
                    )
                    persist_trace_bundle_fragments(step_dataset, execution_trace_scope, request_signature)
                    step_dataset = materialize_trace_bundle_dataset(step_dataset, execution_trace_scope, request_signature)
                except Exception as exc:
                    for step_term in step_queries:
                        _persist_acquisition_term_diagnostic(
                            request_signature,
                            step_trace_scope,
                            step_term,
                            {
                                "status": "execution-compatibility-failure",
                                "outcome": "execution-failure",
                                "failureKind": "execution-compatibility-failure",
                                "selectedTraceScope": step_trace_scope,
                                "selectedTargetId": step_target_id,
                                "executionRoutineId": str(step_knowledge_plan.get("executionRoutineId") or ""),
                                "expectedCoverage": [step_term],
                                "whyChosen": list(step.get("whyChosen") or []),
                                "detail": f"{type(exc).__name__}: {exc}",
                                "evidenceHits": {"found": False, "graphRefs": [], "payloadHits": []},
                                "evidenceSourcesChecked": [],
                                "nextRecommended": _recommended_next_acquisition_step(step_term, step_trace_scope),
                            },
                        )
                    raise
                evidence_diagnostics: dict[str, dict[str, Any]] = {}
                with profiler.phase("Post-run discoveries", "postRunDiscoveries"):
                    for step_term in step_queries:
                        term_evidence = get_trace_db().find_contract_term_evidence("cifi-full", "libil2cpp.so", step_term)
                        evidence_diagnostics[step_term] = term_evidence
                        evidence_found = bool(term_evidence.get("found"))
                        if evidence_found:
                            _persist_acquisition_exact_term_evidence(
                                project_name="cifi-full",
                                project_file="libil2cpp.so",
                                trace_scope=step_trace_scope,
                                request_signature=step_request_signature,
                                target_id=step_target_id,
                                execution_routine_id=str(step_knowledge_plan.get("executionRoutineId") or ""),
                                term=step_term,
                                why_chosen=list(step.get("whyChosen") or []),
                                evidence=term_evidence,
                            )
                        _persist_acquisition_term_diagnostic(
                            request_signature,
                            step_trace_scope,
                            step_term,
                            {
                                "status": "exact-evidence-found" if evidence_found else "true-missing-evidence",
                                "outcome": "exact-hit" if evidence_found else "no-exact-hit",
                                "selectedTraceScope": step_trace_scope,
                                "selectedTargetId": step_target_id,
                                "executionRoutineId": str(step_knowledge_plan.get("executionRoutineId") or ""),
                                "expectedCoverage": [step_term],
                                "whyChosen": list(step.get("whyChosen") or []),
                                "evidenceHits": _diagnostic_evidence_hits(term_evidence),
                                "evidenceSourcesChecked": _diagnostic_evidence_sources_checked(term_evidence),
                                "nextRecommended": None if evidence_found else _recommended_next_acquisition_step(step_term, step_trace_scope, term_evidence),
                            },
                        )
                acquisition_results.append(
                    {
                        "traceScope": step_trace_scope,
                        "targetId": step_target_id,
                        "expectedTerms": step_queries,
                        "anchors": step_anchors,
                        "whyChosen": list(step.get("whyChosen") or []),
                        "termStatuses": {
                            step_term: str(
                                "exact-evidence-found" if bool((evidence_diagnostics.get(step_term) or {}).get("found")) else "true-missing-evidence"
                            )
                            for step_term in step_queries
                        },
                    }
                )
                dataset = step_dataset
            dataset["traceAcquisitionPlan"] = {
                "requestedTerms": requested_terms,
                "steps": acquisition_results,
                "remainingTerms": list(acquisition_plan.get("remainingTerms") or []),
            }
        elif knowledge_plan.get("mode") == "reuse-materialized" and not args.force:
            with profiler.span("dbReads"):
                existing = get_trace_db().find_latest_materialized_target_bundle_view("cifi-full", "libil2cpp.so", execution_trace_scope)
            if existing and trace_dataset_has_required_fragments(existing["payload"]):
                dataset = dict(existing["payload"])
                short_circuit_existing = True
            elif args.resume:
                with profiler.span("dbReads"):
                    existing = get_trace_db().find_materialized_target_bundle_view("cifi-full", "libil2cpp.so", execution_trace_scope, request_signature)
                    if existing is None:
                        existing = get_trace_db().find_materialized_trace_view("cifi-full", "libil2cpp.so", execution_trace_scope, request_signature)
                if existing and trace_dataset_has_required_fragments(existing["payload"]):
                    dataset = dict(existing["payload"])
                else:
                    dataset = collect_trace_bundle_components(args, trace_plan, registry)
        elif args.resume:
            with profiler.span("dbReads"):
                existing = get_trace_db().find_materialized_target_bundle_view("cifi-full", "libil2cpp.so", execution_trace_scope, request_signature)
                if existing is None:
                    existing = get_trace_db().find_materialized_trace_view("cifi-full", "libil2cpp.so", execution_trace_scope, request_signature)
            if existing and trace_dataset_has_required_fragments(existing["payload"]):
                dataset = dict(existing["payload"])
            else:
                dataset = collect_trace_bundle_components(args, trace_plan, registry)
        else:
            dataset = collect_trace_bundle_components(args, trace_plan, registry)

        with profiler.span("finalBundleAssembly"):
            export_requested = args.export or args.json_out != JSON_OUT or args.md_out != MD_OUT
            json_out, md_out, run_id = allocate_trace_run_paths(
                dataset["traceRegistry"].get("executionTraceScope") or "generic-explore",
                dataset["traceRegistry"]["selectedFamilyId"],
                args.json_out if args.json_out != JSON_OUT else None,
                args.md_out if args.md_out != MD_OUT else None,
            )

            dataset["traceParams"] = {
                "target": args.target,
                "anchors": args.anchor,
                "family": args.family,
                "bestGap": args.best_gap,
                "extendedSearch": args.extended_search,
                "depthSearch": args.depth_search,
                "nativeTimeout": args.native_timeout,
                "level": args.level,
                "anchorKind": args.anchor_kind,
                "maxSteps": args.max_steps,
            }
            dataset["assetSet"] = asset_set
            dataset["traceKnowledge"] = dict((knowledge_plan.get("knowledge") or {}))
            dataset["traceDirective"] = {
                "mode": knowledge_plan.get("mode") or "run-seam-trace",
                "executionRoutineId": knowledge_plan.get("executionRoutineId"),
                "nextSeam": dict(knowledge_plan.get("nextSeam") or {}),
            }
            if acquisition_plan:
                dataset["traceDirective"]["acquisitionPlan"] = acquisition_plan
            dataset["traceRun"] = {
                "id": run_id,
                "jsonOut": str(json_out) if export_requested else None,
                "mdOut": str(md_out) if export_requested else None,
                "mode": "db-knowledge-reuse" if short_circuit_existing else "stable-target-run",
                "outputMode": output_mode,
                "overwritesOnRepeat": export_requested,
            }

        if not short_circuit_existing:
            native_trace_runtime = dict(dataset.get("nativeTrace") or {})
            native_reuse_report = dict((native_trace_runtime.get("reuseReport")) or {})
            persist_trace_bundle_fragments(
                dataset,
                str(dataset["traceRegistry"].get("executionTraceScope") or "generic-explore"),
                request_signature,
            )
            dataset = materialize_trace_bundle_dataset(
                dataset,
                str(dataset["traceRegistry"].get("executionTraceScope") or "generic-explore"),
                request_signature,
            )
            if native_reuse_report:
                dataset.setdefault("nativeTrace", {})
                if isinstance(dataset.get("nativeTrace"), dict):
                    dataset["nativeTrace"]["reuseReport"] = native_reuse_report
            if native_trace_runtime:
                dataset.setdefault("nativeTrace", {})
                if isinstance(dataset.get("nativeTrace"), dict):
                    for key in (
                        "requestContext",
                        "cacheHit",
                        "requestedTerms",
                        "searchTerms",
                        "materializedFromDb",
                    ):
                        if key in native_trace_runtime:
                            dataset["nativeTrace"][key] = native_trace_runtime.get(key)

        with profiler.phase("Post-run discoveries", "phase.postRunDiscoveries"):
            post_run_discoveries: dict[str, Any] = {}
            post_run_execution_scope = str(dataset.get("traceRegistry", {}).get("executionTraceScope") or execution_trace_scope or "").strip()
            post_run_target_id = str(dataset.get("traceRegistry", {}).get("selectedTargetId") or trace_plan.get("selectedTargetId") or post_run_execution_scope).strip()
            if post_run_execution_scope:
                with profiler.span("postRunDiscoveries.subjectState"):
                    post_run_subject_row = _pick_best_subject_state_for_trace_scope(
                        post_run_execution_scope,
                        post_run_target_id,
                        _latest_materialized_subject_state_rows(),
                    )
                    post_run_subject_state = dict(post_run_subject_row.get("payload") or {})
                if post_run_subject_state:
                    post_run_discoveries["subjectState"] = post_run_subject_state
            if acquisition_plan:
                post_run_discoveries["acquisitionPlan"] = acquisition_plan
                selected_relation_probe = dict(acquisition_plan.get("selectedRelationProbe") or {})
                requested_terms = [
                    str(term).strip()
                    for term in (acquisition_plan.get("requestedTerms") or [])
                    if str(term).strip()
                ]
                selected_seam_id = str(acquisition_plan.get("selectedSeamId") or "").strip()
                subject_missing_edges = {
                    str(edge).strip()
                    for edge in (
                        list((post_run_subject_state or {}).get("missingEdges") or [])
                        + list((post_run_subject_state or {}).get("blockedEdges") or [])
                    )
                    if str(edge).strip()
                }
                seam_still_open = bool(selected_seam_id and selected_seam_id in subject_missing_edges)
                relation_coverage = {}
                if selected_relation_probe:
                    relation_scope = str(selected_relation_probe.get("traceScope") or "").strip()
                    relation_required_seams = [
                        str(value).strip()
                        for value in (selected_relation_probe.get("requiredCoverageSeamIds") or [])
                        if str(value).strip()
                    ]
                    relation_subject_state = {}
                    if relation_scope:
                        relation_subject_row = _pick_best_subject_state_for_trace_scope(
                            relation_scope,
                            relation_scope,
                            _latest_materialized_subject_state_rows(),
                        )
                        relation_subject_state = dict(relation_subject_row.get("payload") or {})
                    relation_open_edges = {
                        str(edge).strip()
                        for edge in (
                            list(relation_subject_state.get("missingEdges") or [])
                            + list(relation_subject_state.get("blockedEdges") or [])
                        )
                        if str(edge).strip()
                    }
                    relation_covered = bool(relation_required_seams) and all(seam_id not in relation_open_edges for seam_id in relation_required_seams)
                    native_trace_payload = dict(dataset.get("nativeTrace") or {})
                    relation_gap = _describe_relation_gap(
                        trace_scope=post_run_execution_scope,
                        request_signature=request_signature,
                        relation_scope=relation_scope,
                        required_seams=relation_required_seams,
                        native_trace_payload=native_trace_payload,
                        relation_covered=relation_covered,
                    )
                    relation_coverage = {
                        "mode": "relation-shaped",
                        "relationScope": relation_scope,
                        "requiredSeams": relation_required_seams,
                        "covered": relation_covered,
                        "cacheHitDisposition": relation_gap.get("cacheHitDisposition") or "unknown",
                        "blockerCategory": relation_gap.get("blockerCategory") or None,
                        "missingArtifacts": list(relation_gap.get("missingArtifacts") or []),
                        "evidenceTerms": list(relation_gap.get("evidenceTerms") or []),
                        "detail": relation_gap.get("detail") or None,
                    }
                    post_run_discoveries["relationCoverage"] = relation_coverage
                for requested_term in requested_terms:
                    term_evidence = get_trace_db().find_contract_term_evidence("cifi-full", "libil2cpp.so", requested_term)
                    evidence_found = bool(term_evidence.get("found"))
                    if evidence_found:
                        _persist_acquisition_exact_term_evidence(
                            project_name="cifi-full",
                            project_file="libil2cpp.so",
                            trace_scope=post_run_execution_scope,
                            request_signature=request_signature,
                            target_id=post_run_target_id,
                            execution_routine_id=str(acquisition_plan.get("selectedRoutine") or knowledge_plan.get("executionRoutineId") or ""),
                            term=requested_term,
                            why_chosen=list(acquisition_plan.get("anchorSelectionReasons") or []),
                            evidence=term_evidence,
                        )
                    _persist_acquisition_term_diagnostic(
                        request_signature,
                        post_run_execution_scope,
                        requested_term,
                        {
                            "status": (
                                "relation-coverage-missing"
                                if relation_coverage and evidence_found and not bool(relation_coverage.get("covered"))
                                else (
                                "exact-evidence-nonclosing"
                                if evidence_found and seam_still_open
                                else ("exact-evidence-found" if evidence_found else "true-missing-evidence")
                                )
                            ),
                            "outcome": (
                                str(relation_coverage.get("cacheHitDisposition") or "term-present-only")
                                if relation_coverage and evidence_found and not bool(relation_coverage.get("covered"))
                                else (
                                "exact-hit-nonclosing"
                                if evidence_found and seam_still_open
                                else ("exact-hit" if evidence_found else "no-exact-hit")
                                )
                            ),
                            "selectedTraceScope": post_run_execution_scope,
                            "selectedTargetId": post_run_target_id,
                            "executionRoutineId": str(acquisition_plan.get("selectedRoutine") or knowledge_plan.get("executionRoutineId") or ""),
                            "seamId": selected_seam_id,
                            "subjectId": str((post_run_subject_state or {}).get("subjectId") or planner_resolution.get("selectedSubjectKey") or ""),
                            "expectedCoverage": [requested_term],
                            "whyChosen": list(acquisition_plan.get("anchorSelectionReasons") or []),
                            "evidenceHits": _diagnostic_evidence_hits(term_evidence),
                            "evidenceSourcesChecked": _diagnostic_evidence_sources_checked(term_evidence),
                            "relationCoverage": relation_coverage or None,
                            "missingArtifacts": list((relation_coverage or {}).get("missingArtifacts") or []),
                            "detail": (
                                str((relation_coverage or {}).get("detail") or "")
                                if relation_coverage and evidence_found and not bool(relation_coverage.get("covered"))
                                else (
                                f"Exact term evidence exists for {requested_term}, but {selected_seam_id or 'the selected seam'} remains open after materialization."
                                if evidence_found and seam_still_open
                                else None
                                )
                            ),
                            "nextRecommended": (
                                _recommended_next_acquisition_step(requested_term, post_run_execution_scope, term_evidence)
                                if not evidence_found
                                else None
                            ),
                        },
                    )
            if post_run_discoveries:
                dataset["postRunDiscoveries"] = post_run_discoveries

        with profiler.span("finalBundleAssembly"):
            if export_requested:
                export_trace_run(dataset, json_out, md_out)
                print(f"Trace bundle exported: {json_out}")
                print(f"Markdown: {md_out}")
            else:
                if short_circuit_existing:
                    print(f"Trace bundle reused from DB knowledge for subject scope: {execution_trace_scope}")
                else:
                    print(f"Trace bundle materialized in DB for subject scope: {execution_trace_scope}")

        if profiler.enabled:
            timing_report = profiler.report_payload()
            dataset["traceTiming"] = timing_report
            print("Trace timing (ms):")
            for bucket, elapsed_ms in sorted(
                timing_report.get("bucketsMs", {}).items(),
                key=lambda item: item[1],
                reverse=True,
            ):
                count = timing_report.get("bucketCounts", {}).get(bucket, 0)
                print(f"  {bucket}={elapsed_ms:.3f} ({count} span{'s' if count != 1 else ''})")
            print(f"  totalRunMs={timing_report.get('totalRunMs', 0.0):.3f}")
            if timing_report.get("dominantBucket"):
                print(f"  dominantBucket={timing_report['dominantBucket']}")
        return dataset
    finally:
        _set_active_trace_runtime_flags({})
        ACTIVE_TRACE_PROFILER = None


def install_unitypy_stubs() -> None:
    brotli = types.ModuleType("brotli")
    brotli.decompress = lambda data: data
    brotli.compress = lambda data, *args, **kwargs: data

    lz4 = types.ModuleType("lz4")
    lz4_block = types.ModuleType("lz4.block")
    lz4_block.decompress = lambda data, uncompressed_size=None: data
    lz4_block.compress = lambda data, **kwargs: data
    lz4.block = lz4_block

    pil = types.ModuleType("PIL")
    pil_image = types.ModuleType("PIL.Image")
    pil_image.open = lambda *args, **kwargs: None
    pil.Image = pil_image

    sys.modules.setdefault("brotli", brotli)
    sys.modules.setdefault("lz4", lz4)
    sys.modules.setdefault("lz4.block", lz4_block)
    sys.modules.setdefault("PIL", pil)
    sys.modules.setdefault("PIL.Image", pil_image)


def get_unity_env():
    global UNITY_ENV
    if UNITY_ENV is None:
        with _trace_profile_span("sourceLoading.unityEnvLoad"):
            install_unitypy_stubs()
            sys.path.insert(0, str((ROOT / ".deps").resolve()))
            from UnityPy import Environment
            UNITY_ENV = Environment()
            UNITY_ENV.load_folder(str(UNITY_JOINED_DIR))
    return UNITY_ENV


def _unity_search_index_source_paths() -> list[Path]:
    return [
        CANONICAL_SOURCE_PATHS["level0"],
        *ASSET_SOURCE_MEMBER_PATHS.values(),
    ]


def _build_unity_search_index_fingerprint() -> str:
    fingerprint_parts: list[str] = []
    for path in _unity_search_index_source_paths():
        if not path.exists():
            continue
        stat = path.stat()
        fingerprint_parts.append(f"{repo_relative(path)}:{stat.st_size}:{stat.st_mtime_ns}")
    return hashlib.sha1("|".join(fingerprint_parts).encode("utf-8")).hexdigest()[:16]


def _unity_raw_string_index_source_paths() -> list[Path]:
    return [
        path
        for source_id in ("level0", *ASSET_SOURCE_MEMBERS)
        if (path := get_unity_source_path(source_id)) is not None
    ]


def _build_unity_raw_string_index_fingerprint() -> str:
    fingerprint_parts: list[str] = []
    for path in _unity_raw_string_index_source_paths():
        if not path.exists():
            continue
        stat = path.stat()
        fingerprint_parts.append(f"{repo_relative(path)}:{stat.st_size}:{stat.st_mtime_ns}")
    return hashlib.sha1("|".join(fingerprint_parts).encode("utf-8")).hexdigest()[:16]


def _load_cached_unity_search_index() -> dict[str, list[dict[str, Any]]] | None:
    cache_path = UNITY_SEARCH_INDEX_CACHE_PATH
    if not cache_path.exists():
        return None
    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if str(payload.get("fingerprint") or "") != _build_unity_search_index_fingerprint():
        return None
    cached_index = payload.get("searchIndex")
    if not isinstance(cached_index, dict):
        return None
    return {
        str(source_id): list(entries or [])
        for source_id, entries in cached_index.items()
    }


def _store_cached_unity_search_index(search_index: dict[str, list[dict[str, Any]]]) -> None:
    cache_path = UNITY_SEARCH_INDEX_CACHE_PATH
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "fingerprint": _build_unity_search_index_fingerprint(),
        "searchIndex": search_index,
        "cachedAt": datetime.now().isoformat(timespec="seconds"),
    }
    cache_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def _load_cached_unity_raw_string_index() -> dict[str, list[dict[str, Any]]] | None:
    cache_path = UNITY_RAW_STRING_INDEX_CACHE_PATH
    if not cache_path.exists():
        return None
    try:
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if str(payload.get("fingerprint") or "") != _build_unity_raw_string_index_fingerprint():
        return None
    cached_index = payload.get("rawStringIndex")
    if not isinstance(cached_index, dict):
        return None
    return {
        str(source_id): list(entries or [])
        for source_id, entries in cached_index.items()
    }


def _store_cached_unity_raw_string_index(raw_string_index: dict[str, list[dict[str, Any]]]) -> None:
    cache_path = UNITY_RAW_STRING_INDEX_CACHE_PATH
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "fingerprint": _build_unity_raw_string_index_fingerprint(),
        "rawStringIndex": raw_string_index,
        "cachedAt": datetime.now().isoformat(timespec="seconds"),
    }
    cache_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")


def _ensure_unity_object_indexes() -> None:
    global UNITY_OBJECTS_BY_PATH_ID
    global UNITY_OBJECTS_BY_ASSET_AND_PATH_ID
    global UNITY_SEARCH_INDEX
    if (
        UNITY_OBJECTS_BY_PATH_ID is not None
        and UNITY_OBJECTS_BY_ASSET_AND_PATH_ID is not None
        and UNITY_SEARCH_INDEX is not None
    ):
        return

    with _trace_profile_span("sourceLoading.unityObjectIndex"):
        env = get_unity_env()
        preferred_assets = {"level0": 0, "globalgamemanagers.assets": 1, "sharedassets0.assets": 2}
        chosen_by_path_id: dict[int, Any] = {}
        objects_by_asset_and_path_id: dict[tuple[str, int], Any] = {}
        cached_search_index = _load_cached_unity_search_index()
        search_index: dict[str, list[dict[str, Any]]] = dict(cached_search_index or {})
        build_search_index = cached_search_index is None

        for obj in env.objects:
            path_id = int(obj.path_id)
            asset_name = getattr(getattr(obj, "assets_file", None), "name", "") or ""
            objects_by_asset_and_path_id[(asset_name, path_id)] = obj

            current = chosen_by_path_id.get(path_id)
            if current is None:
                chosen_by_path_id[path_id] = obj
            else:
                current_asset = getattr(getattr(current, "assets_file", None), "name", "") or ""
                if preferred_assets.get(asset_name, 99) < preferred_assets.get(current_asset, 99):
                    chosen_by_path_id[path_id] = obj

            if not build_search_index:
                continue

            search_surfaces: list[tuple[str, str, int]] = []
            if obj.type.name == "MonoBehaviour":
                data = safe_unity_read(obj)
                if data is not None:
                    script = getattr(data, "m_Script", None)
                    if script:
                        try:
                            script_data = script.read()
                            class_name = getattr(script_data, "m_Name", "") or ""
                            if class_name:
                                search_surfaces.append(("class-name", class_name, 90))
                        except Exception:
                            pass
                    obj_name = getattr(data, "m_Name", "") or ""
                    if obj_name:
                        search_surfaces.append(("object-name", obj_name, 80))
            elif obj.type.name == "GameObject":
                data = safe_unity_read(obj)
                name = getattr(data, "m_Name", "") or "" if data is not None else ""
                if name:
                    search_surfaces.append(("object-name", name, 85))
            elif obj.type.name in ("Text", "TextMeshProUGUI", "TextMeshPro"):
                data = safe_unity_read(obj)
                if data is not None:
                    text_field = "m_text" if obj.type.name in ("TextMeshProUGUI", "TextMeshPro") else "m_Text"
                    text_content = getattr(data, text_field, "") or ""
                    if text_content:
                        search_surfaces.append(("text-content", text_content, 70))

            if not search_surfaces:
                continue

            entry = {
                "pathId": obj.path_id,
                "objectType": obj.type.name,
                "surfaces": [
                    {
                        "surfaceType": surface_type,
                        "surfaceValue": str(surface_value),
                        "baseScore": base_score,
                    }
                    for surface_type, surface_value, base_score in search_surfaces
                ],
            }
            for source_key in get_unity_source_keys(obj):
                search_index.setdefault(source_key, []).append(entry)

    UNITY_OBJECTS_BY_PATH_ID = chosen_by_path_id
    UNITY_OBJECTS_BY_ASSET_AND_PATH_ID = objects_by_asset_and_path_id
    UNITY_SEARCH_INDEX = search_index
    if build_search_index:
        _store_cached_unity_search_index(search_index)


def safe_unity_read(obj: Any) -> Any | None:
    try:
        return obj.read(check_read=False)
    except TypeError:
        try:
            return obj.read()
        except Exception:
            return None
    except Exception:
        return None


def get_unity_objects_by_path_id() -> dict[int, Any]:
    global UNITY_OBJECTS_BY_PATH_ID
    if UNITY_OBJECTS_BY_PATH_ID is None:
        _ensure_unity_object_indexes()
    return UNITY_OBJECTS_BY_PATH_ID


def get_unity_objects_by_asset_and_path_id() -> dict[tuple[str, int], Any]:
    global UNITY_OBJECTS_BY_ASSET_AND_PATH_ID
    if UNITY_OBJECTS_BY_ASSET_AND_PATH_ID is None:
        _ensure_unity_object_indexes()
    return UNITY_OBJECTS_BY_ASSET_AND_PATH_ID


def _resolve_external_asset_name(source_asset_name: str | None, file_id: int | None) -> str | None:
    if file_id in (None, 0):
        return source_asset_name
    env = get_unity_env()
    for asset in env.files.values():
        asset_name = getattr(asset, "name", "") or ""
        if asset_name != source_asset_name:
            continue
        externals = getattr(asset, "externals", []) or []
        index = int(file_id) - 1
        if 0 <= index < len(externals):
            external = externals[index]
            return getattr(external, "name", None) or getattr(external, "path", None)
    return None


def get_unity_object(path_id: int | None, source_asset_name: str | None = "level0") -> Any | None:
    if path_id is None:
        return None
    if source_asset_name:
        direct = get_unity_objects_by_asset_and_path_id().get((source_asset_name, int(path_id)))
        if direct is not None:
            return direct
    return get_unity_objects_by_path_id().get(int(path_id))


def get_unity_gameobject_name(path_id: int | None, source_asset_name: str | None = "level0") -> str | None:
    obj = get_unity_object(path_id, source_asset_name=source_asset_name)
    if obj is None:
        return None
    data = safe_unity_read(obj)
    if data is None:
        return None
    return getattr(data, "m_Name", None)


def get_unity_gameobject_parent_path_id(path_id: int | None, source_asset_name: str | None = "level0") -> int | None:
    obj = get_unity_object(path_id, source_asset_name=source_asset_name)
    if obj is None:
        return None
    data = safe_unity_read(obj)
    if data is None:
        return None
    for comp in getattr(data, "m_Component", []) or []:
        target = getattr(comp, "component", None) or getattr(comp, "m_Component", None) or comp
        target = resolve_unity_ref(target, source_asset_name=source_asset_name)
        if target is None or target.type.name not in ("Transform", "RectTransform"):
            continue
        transform_data = safe_unity_read(target)
        if transform_data is None:
            continue
        father = getattr(transform_data, "m_Father", None)
        father_path_id = getattr(father, "path_id", None)
        if father_path_id is None:
            continue
        father_obj = get_unity_object(int(father_path_id), source_asset_name=source_asset_name)
        father_data = safe_unity_read(father_obj) if father_obj is not None else None
        game_object_ref = getattr(father_data, "m_GameObject", None) if father_data is not None else None
        game_object_path_id = getattr(game_object_ref, "path_id", None)
        if game_object_path_id is not None:
            return int(game_object_path_id)
    return None


def build_unity_gameobject_hierarchy_path(path_id: int | None, source_asset_name: str | None = "level0") -> str | None:
    if path_id is None:
        return None
    parts: list[str] = []
    seen: set[int] = set()
    current = int(path_id)
    while current not in seen:
        seen.add(current)
        name = get_unity_gameobject_name(current, source_asset_name=source_asset_name)
        parts.append(f"{name or current}[{current}]")
        parent = get_unity_gameobject_parent_path_id(current, source_asset_name=source_asset_name)
        if parent is None:
            break
        current = parent
    return " / ".join(reversed(parts))


def resolve_unity_ref(target: Any, source_asset_name: str | None = "level0") -> Any | None:
    if target is None:
        return None
    path_id = getattr(target, "path_id", None)
    if path_id is not None:
        file_id = getattr(target, "file_id", None)
        asset_name = _resolve_external_asset_name(source_asset_name, file_id)
        resolved = get_unity_object(int(path_id), source_asset_name=asset_name)
        if resolved is not None:
            return resolved
    return target


def get_unity_script_name(data: Any) -> str | None:
    script = getattr(data, "m_Script", None)
    if not script:
        return None
    try:
        script_data = script.read()
        return getattr(script_data, "m_Name", None)
    except Exception:
        return None


def get_unity_source_keys(obj: Any) -> set[str]:
    asset_name = getattr(getattr(obj, "assets_file", None), "name", "") or ""
    keys = {asset_name, "resources"}
    if asset_name.endswith(".assets"):
        keys.add(asset_name[:-7])
    return {key for key in keys if key}


def get_unity_source_path(source_id: str) -> Path | None:
    if source_id == "level0":
        return CANONICAL_SOURCE_PATHS["level0"]
    return ASSET_SOURCE_MEMBER_PATHS.get(source_id)


def get_unity_search_index() -> dict[str, list[dict[str, Any]]]:
    global UNITY_SEARCH_INDEX
    if UNITY_SEARCH_INDEX is None:
        _ensure_unity_object_indexes()
    return UNITY_SEARCH_INDEX


def get_unity_raw_string_index() -> dict[str, list[dict[str, Any]]]:
    global UNITY_RAW_STRING_INDEX
    if UNITY_RAW_STRING_INDEX is not None:
        return UNITY_RAW_STRING_INDEX

    with _trace_profile_span("sourceLoading.rawStringIndex"):
        cached_index = _load_cached_unity_raw_string_index()
        if cached_index is not None:
            index = cached_index
        else:
            index: dict[str, list[dict[str, Any]]] = {}
            for source_id in ("level0", *ASSET_SOURCE_MEMBERS):
                path = get_unity_source_path(source_id)
                if not path or not path.exists():
                    index[source_id] = []
                    continue
                entries = extract_strings(path.read_bytes())
                index[source_id] = [
                    {
                        "offset": entry["offset"],
                        "encoding": entry["encoding"],
                        "value": entry["value"],
                    }
                    for entry in entries
                ]
            _store_cached_unity_raw_string_index(index)
    UNITY_RAW_STRING_INDEX = index
    return UNITY_RAW_STRING_INDEX


def classify_presentation_role(name: str, script_names: list[str]) -> str | None:
    lower_name = name.lower()
    lower_scripts = {script.lower() for script in script_names}
    if "title" in lower_name:
        return "title"
    if "desc" in lower_name or "description" in lower_name:
        return "description"
    if "cost" in lower_name:
        return "cost"
    if "level" in lower_name:
        return "level"
    if "req" in lower_name or "require" in lower_name:
        return "requirement"
    if "bonus" in lower_name:
        return "bonus"
    if "icon" in lower_name:
        return "icon"
    if "fill" in lower_name:
        return "fill"
    if "overlay" in lower_name:
        return "overlay"
    if "button" in lower_name:
        return "button"
    if "textmeshprougui" in lower_scripts or "text" in lower_scripts:
        return "text"
    return None


def extract_gameobject_presentation(go_path_id: int, max_depth: int = 4) -> list[dict[str, Any]]:
    seen: set[int] = set()
    entries: list[dict[str, Any]] = []

    def visit_gameobject(current_go_id: int, depth: int, parent_go_id: int | None = None, hierarchy: list[str] | None = None) -> None:
        if current_go_id in seen or depth > max_depth:
            return
        seen.add(current_go_id)
        obj = get_unity_object(current_go_id)
        if obj is None:
            return
        data = safe_unity_read(obj)
        if data is None:
            return
        name = getattr(data, "m_Name", "") or ""
        components = getattr(data, "m_Component", []) or []
        component_types: list[str] = []
        script_names: list[str] = []
        component_details: list[dict[str, Any]] = []
        transform_obj = None
        current_hierarchy = [*(hierarchy or []), name or str(current_go_id)]
        for comp in components:
            target = getattr(comp, "component", None) or getattr(comp, "m_Component", None) or comp
            target = resolve_unity_ref(target, source_asset_name="level0")
            if target is None:
                continue
            component_types.append(str(target.type.name))
            if target.type.name in ("Transform", "RectTransform"):
                transform_obj = target
            comp_data = safe_unity_read(target)
            if comp_data is None:
                continue
            script_name = get_unity_script_name(comp_data)
            if script_name:
                script_names.append(str(script_name))
            component_detail = {
                "type": str(target.type.name),
                "pathId": getattr(target, "path_id", None),
            }
            if script_name:
                component_detail["scriptName"] = str(script_name)
            game_object_ref = getattr(comp_data, "m_GameObject", None)
            game_object_path_id = getattr(game_object_ref, "path_id", None)
            if game_object_path_id is not None:
                component_detail["gameObjectPathId"] = int(game_object_path_id)
            if hasattr(comp_data, "m_Enabled"):
                component_detail["enabled"] = bool(getattr(comp_data, "m_Enabled"))
            text_value = None
            if hasattr(comp_data, "m_text"):
                text_value = getattr(comp_data, "m_text")
            elif hasattr(comp_data, "m_Text"):
                text_value = getattr(comp_data, "m_Text")
            if isinstance(text_value, str) and text_value.strip():
                component_detail["text"] = text_value
            component_details.append(component_detail)
        role = classify_presentation_role(name, script_names)
        entry = {
            "pathId": current_go_id,
            "name": name,
            "depth": depth,
            "parentPathId": parent_go_id,
            "hierarchyPath": " / ".join(current_hierarchy),
            "componentTypes": unique_strings(component_types),
            "scriptNames": unique_strings(script_names),
            "componentDetails": component_details,
            "role": role,
        }
        entries.append(entry)
        if transform_obj is None:
            return
        transform_data = safe_unity_read(transform_obj)
        if transform_data is None:
            return
        for child in getattr(transform_data, "m_Children", []) or []:
            try:
                child_transform = child.read()
            except Exception:
                continue
            child_go = getattr(getattr(child_transform, "m_GameObject", None), "path_id", None)
            if child_go:
                visit_gameobject(int(child_go), depth + 1, current_go_id, current_hierarchy)

    visit_gameobject(int(go_path_id), 0)
    return entries


def resolve_pointer_binding_to_gameobject(binding: dict[str, Any]) -> dict[str, Any] | None:
    path_id = binding.get("pathId")
    obj = get_unity_object(path_id, source_asset_name="level0")
    if obj is None:
        return None
    if obj.type.name == "GameObject":
        return {
            "sourceField": binding.get("field"),
            "sourcePathId": path_id,
            "gameObjectPathId": path_id,
            "gameObjectName": get_unity_gameobject_name(path_id, source_asset_name="level0"),
            "sourceType": obj.type.name,
        }
    data = safe_unity_read(obj)
    if data is None:
        return None
    go_ptr = getattr(data, "m_GameObject", None)
    go_path_id = getattr(go_ptr, "path_id", None)
    if go_path_id is None:
        return None
    return {
        "sourceField": binding.get("field"),
        "sourcePathId": path_id,
        "gameObjectPathId": go_path_id,
        "gameObjectName": get_unity_gameobject_name(go_path_id, source_asset_name="level0"),
        "sourceType": obj.type.name,
        "scriptName": get_unity_script_name(data),
    }


def build_formula_reconstruction(
    recovered_formula_values: list[dict[str, Any]],
    presentation_objects: list[dict[str, Any]],
    literal_schema_recovery: dict[str, Any] | None = None,
    owner_blob_row: dict[str, Any] | None = None,
    owner_modifier_scan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    value_by_field = {
        str(item.get("field")): item.get("value")
        for item in recovered_formula_values
        if item.get("field") is not None
    }
    owner_blob_row = owner_blob_row or {}
    start_cost = owner_blob_row.get("startCost", value_by_field.get("ModBoostStartCost"))
    additive_cost = owner_blob_row.get("additiveCost", value_by_field.get("ModBoostAdditiveCost"))
    bonus_value = owner_blob_row.get("bonus", value_by_field.get("ModBoostBonus"))
    max_level = owner_blob_row.get("maxLevel", value_by_field.get("ModBoostMaxLevel"))
    cost_slots = [item["name"] for item in presentation_objects if item.get("role") == "cost"]
    level_slots = [item["name"] for item in presentation_objects if item.get("role") == "level"]
    bonus_slots = [item["name"] for item in presentation_objects if item.get("role") == "bonus"]
    controller_cost_exponent_fields: list[str] = []
    controller_start_cost_fields = ["ModBoostStartCost"] if start_cost is not None else []
    controller_additive_cost_fields = ["ModBoostAdditiveCost"] if additive_cost is not None else []
    schema_fields = {
        str(field_name)
        for field_name in (literal_schema_recovery or {}).get("schemaFields", [])
        if field_name
    }
    owner_has_cost_exponent = "CostExponent" in schema_fields
    owner_cost_schema = build_arcade_upgrade_owner_cost_schema()
    owner_modifier_scan = owner_modifier_scan or {}
    aligned_modifier_components = owner_modifier_scan.get("matchedComponents", []) or []

    inferred_cost_model = None
    if start_cost is not None and additive_cost is not None:
        inferred_cost_model = {
            "status": "extracted-controller-linear",
            "kind": "controller-linear-step",
            "expression": "BaseCost(level) = StartCost + AdditiveCost * level",
            "groundedConstants": {
                "StartCost": start_cost,
                "AdditiveCost": additive_cost,
            },
            "displaySlots": cost_slots,
            "evidence": {
                "controllerStartCostFieldCount": len(controller_start_cost_fields),
                "controllerAdditiveCostFieldCount": len(controller_additive_cost_fields),
                "controllerCostExponentFieldCount": len(controller_cost_exponent_fields),
                "ownerSchemaHasCostExponent": owner_has_cost_exponent,
                "ownerCalculationTypeOptions": owner_cost_schema.get("calculationTypeOptions", []),
            },
            "notes": [
                "Recovered directly from the TokenShop owner blob in level0 as a StartCost/AdditiveCost pair.",
                "No owner-blob-side *CostExponent fields are exposed in the serialized TokenShop row payload.",
                "This supports a linear base-cost lane for ATU/controller rows.",
                "Displayed in-game cost can still diverge if scriptable-object-side evaluators or runtime modifiers apply on top of the base lane.",
            ],
        }
        if owner_has_cost_exponent:
            inferred_cost_model["notes"].append(
                "ArcadeUpgradeSO still exposes CostExponent in the owner schema, so exponent-based or transformed runtime pricing remains a separate unresolved modifier lane."
            )
        if not aligned_modifier_components:
            inferred_cost_model["notes"].append(
                "No aligned ATU4 row ids or grounded constants were recovered from ArcadeShop or ArcadeManager, so the unresolved live-cost transform is more likely method-side than another serialized row block."
            )
    elif start_cost is not None:
        inferred_cost_model = {
            "status": "partial",
            "kind": "constant-or-derived",
            "expression": "StartCost",
            "groundedConstants": {
                "StartCost": start_cost,
            },
            "displaySlots": cost_slots,
            "notes": [
                "Only StartCost is grounded directly; progression rule is unresolved.",
            ],
        }

    inferred_bonus_model = None
    if bonus_value is not None:
        inferred_bonus_model = {
            "status": "heuristic",
            "kind": "bonus-field",
            "expression": "Bonus field applied through upgrade level or display logic",
            "groundedConstants": {
                "Bonus": bonus_value,
            },
            "displaySlots": bonus_slots,
            "notes": [
                "Bonus constant is grounded directly.",
                "Exact runtime application path is still unresolved without native/display update confirmation.",
            ],
        }

    runtime_cost_model = None
    if inferred_cost_model is not None:
        runtime_cost_model = {
            "status": "unresolved-runtime-modifiers",
            "expression": "DisplayedCost(level) = BaseCost(level) plus unresolved runtime modifiers/evaluator-side transforms",
            "notes": [
                "The extracted controller payload closes the base row formula but not the full runtime display calculation.",
                "The direct TokenShop owner blob closes the base row formula but not the full runtime display calculation.",
                "If live in-game values exceed the recovered linear lane, the remaining gap is in scriptable-object-side evaluation, discounts, clamps, or other external upgrade modifiers.",
            ],
        }
        if owner_has_cost_exponent:
            runtime_cost_model["notes"].append(
                "ArcadeUpgradeSO owner schema still names CostExponent, which is the strongest current signal for a higher-order runtime pricing transform outside the flattened TokenShop row payload."
            )
        if not aligned_modifier_components:
            runtime_cost_model["notes"].append(
                "Direct level0 owner-component scans did not recover aligned ATU4 row ids or grounded constants in ArcadeShop or ArcadeManager."
            )

    return {
        "groundedConstants": {
            "StartCost": start_cost,
            "AdditiveCost": additive_cost,
            "Bonus": bonus_value,
            "MaxLevel": max_level,
        },
        "displaySlots": {
            "cost": unique_strings(cost_slots),
            "level": unique_strings(level_slots),
            "bonus": unique_strings(bonus_slots),
        },
        "inferredCostModel": inferred_cost_model,
        "inferredBonusModel": inferred_bonus_model,
        "runtimeCostModel": runtime_cost_model,
        "ownerCostSchema": owner_cost_schema,
        "ownerBlobRow": owner_blob_row if owner_blob_row.get("status") == "owner-blob-row-recovered" else None,
        "ownerModifierScan": owner_modifier_scan if owner_modifier_scan.get("status") == "owner-modifier-scan-complete" else None,
        "status": "base-cost-closed-runtime-modifiers-open" if inferred_cost_model else "grounded-constants-plus-heuristic-shape",
    }


def build_presentation_update_path(
    presentation_objects: list[dict[str, Any]],
    update_hook_candidates: list[str],
) -> dict[str, Any]:
    direct_roles = {"title", "description", "cost", "level", "requirement"}
    render_scripts = {"TextMeshProUGUI", "Text", "Image", "Outline"}
    interaction_scripts = {"Button", "EventTrigger"}
    slots: dict[str, list[dict[str, Any]]] = {}
    slot_by_key: dict[tuple[str, int | None, str], dict[str, Any]] = {}
    for item in presentation_objects:
        role = item.get("role")
        if role not in direct_roles:
            continue
        slot_entry = {
            "name": item.get("name"),
            "pathId": item.get("pathId"),
            "parentPathId": item.get("parentPathId"),
            "hierarchyPath": item.get("hierarchyPath"),
            "componentTypes": item.get("componentTypes", []),
            "scriptNames": item.get("scriptNames", []),
            "componentPathIds": [
                detail.get("pathId")
                for detail in item.get("componentDetails", [])
                if detail.get("pathId") is not None
            ],
        }
        slot_key = (str(role), slot_entry.get("pathId"), str(slot_entry.get("name") or ""))
        existing = slot_by_key.get(slot_key)
        if existing is None or len(str(slot_entry.get("hierarchyPath") or "")) > len(str(existing.get("hierarchyPath") or "")):
            slot_by_key[slot_key] = slot_entry

    for slot_key in sorted(slot_by_key.keys(), key=lambda item: (item[0], str(item[2]).lower())):
        role = slot_key[0]
        slots.setdefault(role, []).append(slot_by_key[slot_key])

    update_hooks = [
        candidate
        for candidate in update_hook_candidates
        if isinstance(candidate, str) and METHOD_RE.fullmatch(candidate)
    ]

    slot_component_scripts = unique_strings(
        [
            script_name
            for item in presentation_objects
            for script_name in item.get("scriptNames", [])
            if script_name
        ]
    )

    def dedupe_nodes(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        by_path: dict[int, dict[str, Any]] = {}
        output: list[dict[str, Any]] = []
        for item in nodes:
            path_id = item.get("pathId")
            if not isinstance(path_id, int):
                output.append(item)
                continue
            existing = by_path.get(path_id)
            if existing is None or len(str(item.get("hierarchyPath", ""))) > len(str(existing.get("hierarchyPath", ""))):
                by_path[path_id] = item
        keyed_ids = set(by_path.keys())
        for item in nodes:
            path_id = item.get("pathId")
            if isinstance(path_id, int):
                if path_id in keyed_ids:
                    keyed_ids.remove(path_id)
                    output.append(by_path[path_id])
            elif item not in output:
                output.append(item)
        return output

    interaction_nodes = dedupe_nodes(
        [
            {
                "name": item.get("name"),
                "pathId": item.get("pathId"),
                "parentPathId": item.get("parentPathId"),
                "hierarchyPath": item.get("hierarchyPath"),
                "scriptNames": item.get("scriptNames", []),
                "componentPathIds": [
                    detail.get("pathId")
                    for detail in item.get("componentDetails", [])
                    if detail.get("pathId") is not None
                ],
            }
            for item in presentation_objects
            if any(script in interaction_scripts for script in item.get("scriptNames", []))
        ]
    )

    render_nodes = dedupe_nodes(
        [
            {
                "role": item.get("role"),
                "name": item.get("name"),
                "pathId": item.get("pathId"),
                "parentPathId": item.get("parentPathId"),
                "hierarchyPath": item.get("hierarchyPath"),
                "scriptNames": item.get("scriptNames", []),
                "componentPathIds": [
                    detail.get("pathId")
                    for detail in item.get("componentDetails", [])
                    if detail.get("pathId") is not None
                ],
            }
            for item in presentation_objects
            if any(script in {"TextMeshProUGUI", "Text"} for script in item.get("scriptNames", []))
            and item.get("role") in direct_roles
        ]
    )

    interaction_to_render_paths: list[dict[str, Any]] = []
    for interaction in interaction_nodes:
        interaction_name = str(interaction.get("name", ""))
        for render in render_nodes:
            render_path = str(render.get("hierarchyPath", ""))
            if not render_path:
                continue
            if interaction_name and interaction_name in render_path:
                interaction_to_render_paths.append(
                    {
                        "interaction": interaction.get("name"),
                        "interactionPathId": interaction.get("pathId"),
                        "renderRole": render.get("role"),
                        "renderNode": render.get("name"),
                        "renderPathId": render.get("pathId"),
                        "hierarchyPath": render_path,
                    }
                )

    node_by_path: dict[int, dict[str, Any]] = {}
    for item in dedupe_nodes(
        [
            {
                "name": item.get("name"),
                "pathId": item.get("pathId"),
                "parentPathId": item.get("parentPathId"),
                "hierarchyPath": item.get("hierarchyPath"),
                "role": item.get("role"),
                "scriptNames": item.get("scriptNames", []),
                "componentPathIds": [
                    detail.get("pathId")
                    for detail in item.get("componentDetails", [])
                    if detail.get("pathId") is not None
                ],
            }
            for item in presentation_objects
        ]
    ):
        path_id = item.get("pathId")
        if isinstance(path_id, int):
            node_by_path[path_id] = {**item, "children": []}

    roots: list[dict[str, Any]] = []
    for path_id, node in node_by_path.items():
        parent_id = node.get("parentPathId")
        parent = node_by_path.get(parent_id) if isinstance(parent_id, int) else None
        if parent is None:
            roots.append(node)
        else:
            parent["children"].append(node)

    def sort_tree(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        nodes.sort(key=lambda item: (len(str(item.get("hierarchyPath", ""))), str(item.get("name", "")).lower()))
        for node in nodes:
            node["children"] = sort_tree(node.get("children", []))
        return nodes

    recursive_graph = sort_tree(roots)

    def summarize_subtree(node: dict[str, Any]) -> dict[str, Any]:
        script_names = unique_strings([str(value) for value in node.get("scriptNames", []) if value])
        roles = {str(node.get("role"))} if node.get("role") else set()
        names = {str(node.get("name"))} if node.get("name") else set()
        render_count = 1 if any(script in render_scripts for script in script_names) else 0
        interaction_count = 1 if any(script in interaction_scripts for script in script_names) else 0
        text_count = 1 if any(script in {"TextMeshProUGUI", "Text"} for script in script_names) else 0
        descendants = 0
        for child in node.get("children", []):
            child_summary = summarize_subtree(child)
            roles.update(child_summary["roles"])
            names.update(child_summary["names"])
            render_count += child_summary["renderCount"]
            interaction_count += child_summary["interactionCount"]
            text_count += child_summary["textCount"]
            descendants += 1 + child_summary["descendantCount"]
        return {
            "roles": roles,
            "names": names,
            "renderCount": render_count,
            "interactionCount": interaction_count,
            "textCount": text_count,
            "descendantCount": descendants,
        }

    recursive_anchors: list[dict[str, Any]] = []
    recursive_anchor_terms: list[str] = []
    structure_summary = {
        "rootNodes": [],
        "containers": [],
        "leafRenderNodes": [],
        "kinds": {
            "interactionShells": [],
            "contentPanels": [],
            "titleContainers": [],
            "descriptionContainers": [],
            "costDisplays": [],
            "progressIndicators": [],
            "bonusGroups": [],
            "overlayStates": [],
            "requirementDisplays": [],
            "fills": [],
        },
        "primaryKinds": {
            "interactionShells": [],
            "contentPanels": [],
            "titleContainers": [],
            "descriptionContainers": [],
            "costDisplays": [],
            "progressIndicators": [],
            "bonusGroups": [],
            "overlayStates": [],
            "requirementDisplays": [],
            "fills": [],
        },
        "selectedPrimaryStructure": {},
    }

    def make_structure_entry(node: dict[str, Any]) -> dict[str, Any]:
        return {
            "name": node.get("name"),
            "pathId": node.get("pathId"),
            "hierarchyPath": node.get("hierarchyPath"),
            "role": node.get("role"),
            "scriptNames": node.get("scriptNames", []),
        }

    def add_structure_bucket(bucket_name: str, kind: str, node: dict[str, Any]) -> None:
        bucket = structure_summary[bucket_name].setdefault(kind, [])
        entry = {
            "name": node.get("name"),
            "pathId": node.get("pathId"),
            "hierarchyPath": node.get("hierarchyPath"),
            "role": node.get("role"),
            "scriptNames": node.get("scriptNames", []),
        }
        if entry not in bucket:
            bucket.append(entry)

    for node in recursive_graph:
        stack = [node]
        while stack:
            current = stack.pop()
            subtree = summarize_subtree(current)
            current_scripts = unique_strings([str(value) for value in current.get("scriptNames", []) if value])
            current_role = current.get("role")
            should_recurse = (
                subtree["descendantCount"] > 0
                and (
                    subtree["interactionCount"] > 0
                    or subtree["textCount"] > 0
                    or len([role for role in subtree["roles"] if role and role != "None"]) >= 2
                    or (current_role in {"button", "fill", "overlay"} and subtree["renderCount"] > 0)
                    or any(script in {"RectTransform", "Button", "EventTrigger"} for script in current_scripts)
                )
            )
            if should_recurse:
                reasons: list[str] = []
                if subtree["interactionCount"] > 0:
                    reasons.append("subtree includes interaction components")
                if subtree["textCount"] > 0:
                    reasons.append("subtree includes text-render components")
                meaningful_roles = [role for role in subtree["roles"] if role and role != "None"]
                if len(meaningful_roles) >= 2:
                    reasons.append("subtree spans multiple presentation roles")
                if current_role in {"button", "fill", "overlay"} and subtree["renderCount"] > 0:
                    reasons.append(f"{current_role} node owns render subtree")
                if any(script in {"RectTransform", "Button", "EventTrigger"} for script in current_scripts):
                    reasons.append("node carries recursive UI container or interaction script")
                anchor = {
                    "name": current.get("name"),
                    "pathId": current.get("pathId"),
                    "parentPathId": current.get("parentPathId"),
                    "hierarchyPath": current.get("hierarchyPath"),
                    "role": current_role,
                    "scriptNames": current_scripts,
                    "descendantCount": subtree["descendantCount"],
                    "subtreeRenderCount": subtree["renderCount"],
                    "subtreeInteractionCount": subtree["interactionCount"],
                    "subtreeTextCount": subtree["textCount"],
                    "subtreeRoles": sorted(meaningful_roles),
                    "recurseReasons": unique_strings(reasons),
                }
                recursive_anchors.append(anchor)
                for term_value in [current.get("name"), current.get("hierarchyPath"), *current_scripts]:
                    if isinstance(term_value, str) and term_value.strip():
                        recursive_anchor_terms.append(term_value.strip())

            path_id = current.get("pathId")
            children = current.get("children", [])
            is_render_leaf = subtree["textCount"] > 0 and not children
            if isinstance(path_id, int):
                summary_entry = {
                    "name": current.get("name"),
                    "pathId": path_id,
                    "parentPathId": current.get("parentPathId"),
                    "hierarchyPath": current.get("hierarchyPath"),
                    "role": current.get("role"),
                    "scriptNames": current_scripts,
                    "childCount": len(children),
                    "descendantCount": subtree["descendantCount"],
                    "subtreeRoles": sorted([role for role in subtree["roles"] if role and role != "None"]),
                }
                if current.get("parentPathId") is None and summary_entry not in structure_summary["rootNodes"]:
                    structure_summary["rootNodes"].append(summary_entry)
                if children and summary_entry not in structure_summary["containers"]:
                    structure_summary["containers"].append(summary_entry)
                if is_render_leaf:
                    leaf_entry = make_structure_entry(current)
                    if leaf_entry not in structure_summary["leafRenderNodes"]:
                        structure_summary["leafRenderNodes"].append(leaf_entry)

                meaningful_roles = {role for role in subtree["roles"] if role and role != "None"}
                if subtree["interactionCount"] > 0:
                    add_structure_bucket("kinds", "interactionShells", current)
                if {"title", "description"} & meaningful_roles and len(children) > 0:
                    add_structure_bucket("kinds", "contentPanels", current)
                if "title" in meaningful_roles and subtree["textCount"] > 0:
                    add_structure_bucket("kinds", "titleContainers", current)
                if "description" in meaningful_roles and subtree["textCount"] > 0:
                    add_structure_bucket("kinds", "descriptionContainers", current)
                if "cost" in meaningful_roles and subtree["textCount"] > 0:
                    add_structure_bucket("kinds", "costDisplays", current)
                if "fill" in meaningful_roles or "level" in meaningful_roles:
                    add_structure_bucket("kinds", "progressIndicators", current)
                if len([role for role in meaningful_roles if role == "bonus"]) > 0 and subtree["descendantCount"] >= 2:
                    add_structure_bucket("kinds", "bonusGroups", current)
                if "overlay" in meaningful_roles or current.get("role") == "overlay":
                    add_structure_bucket("kinds", "overlayStates", current)
                if "requirement" in meaningful_roles:
                    add_structure_bucket("kinds", "requirementDisplays", current)
                if current.get("role") == "fill" or "fill" in meaningful_roles:
                    add_structure_bucket("kinds", "fills", current)

                local_roles = {role for role in [current.get("role")] if role and role != "None"}
                if any(script in interaction_scripts for script in current_scripts):
                    add_structure_bucket("primaryKinds", "interactionShells", current)
                if len(children) > 0 and {"title", "description"} <= meaningful_roles and not local_roles:
                    add_structure_bucket("primaryKinds", "contentPanels", current)
                if current.get("role") == "title" and len(children) > 0:
                    add_structure_bucket("primaryKinds", "titleContainers", current)
                if current.get("role") == "description" and len(children) > 0:
                    add_structure_bucket("primaryKinds", "descriptionContainers", current)
                if current.get("role") == "cost" and len(children) > 0:
                    add_structure_bucket("primaryKinds", "costDisplays", current)
                if len(children) > 0 and ({"fill", "level"} & meaningful_roles) and not local_roles:
                    add_structure_bucket("primaryKinds", "progressIndicators", current)
                if len(children) > 0 and current.get("role") == "bonus":
                    add_structure_bucket("primaryKinds", "bonusGroups", current)
                if current.get("role") == "overlay" and len(children) > 0:
                    add_structure_bucket("primaryKinds", "overlayStates", current)
                if current.get("role") == "requirement":
                    add_structure_bucket("primaryKinds", "requirementDisplays", current)
                if current.get("role") == "fill":
                    add_structure_bucket("primaryKinds", "fills", current)
            stack.extend(reversed(current.get("children", [])))

    recursive_anchors = dedupe_nodes(recursive_anchors)
    recursive_anchor_terms = unique_strings(recursive_anchor_terms)

    def choose_best_primary(kind: str) -> dict[str, Any] | None:
        candidates = list(structure_summary["primaryKinds"].get(kind, []))
        if not candidates:
            return None
        root_paths = {str(item.get("hierarchyPath") or "") for item in structure_summary.get("rootNodes", [])}

        def score(item: dict[str, Any]) -> tuple[int, int, int, str]:
            path = str(item.get("hierarchyPath") or "")
            role = str(item.get("role") or "")
            scripts = set(item.get("scriptNames") or [])
            depth = path.count(" / ")
            penalty = 0
            if path in root_paths:
                penalty += 5
            if kind in {"progressIndicators", "bonusGroups"} and role in {"title", "description", "cost"}:
                penalty += 3
            if kind == "progressIndicators" and "Button" in scripts:
                penalty += 4
            if kind == "contentPanels" and role:
                penalty += 4
            if kind == "overlayStates" and role != "overlay":
                penalty += 4
            if kind in {"titleContainers", "descriptionContainers", "costDisplays", "requirementDisplays", "fills"} and depth == 0:
                penalty += 5
            if kind == "interactionShells" and "Button" not in scripts and "EventTrigger" not in scripts:
                penalty += 6
            return (penalty, depth, len(path), path.lower())

        candidates.sort(key=score)
        return candidates[0]

    for bucket_name in (
        "interactionShells",
        "contentPanels",
        "titleContainers",
        "descriptionContainers",
        "costDisplays",
        "progressIndicators",
        "bonusGroups",
        "overlayStates",
        "requirementDisplays",
        "fills",
    ):
        selected = choose_best_primary(bucket_name)
        if selected is not None:
            structure_summary["selectedPrimaryStructure"][bucket_name] = selected

    return {
        "status": "direct-slot-graph-recovered",
        "slots": slots,
        "slotComponentScripts": slot_component_scripts,
        "interactionNodes": interaction_nodes,
        "renderNodes": render_nodes,
        "interactionToRenderPaths": interaction_to_render_paths,
        "recursiveGraph": recursive_graph,
        "recursiveAnchors": recursive_anchors,
        "recursiveAnchorTerms": recursive_anchor_terms,
        "structureSummary": structure_summary,
        "updateHookCandidates": update_hooks,
        "notes": [
            "Recovered directly from Unity GameObject hierarchy and attached component scripts.",
            "Direct slot graph is grounded even when final rendered strings remain unresolved.",
            "Recursive follow-up anchors are inferred from subtree structure, interaction scripts, and render-component density rather than from row-specific templates.",
            "Detached update hooks are preserved separately until a row-specific code path is proven.",
        ],
    }


def build_presentation_follow_up(
    presentation_objects: list[dict[str, Any]],
    presentation_update_path: dict[str, Any],
    cached_semantic_scope: dict[str, Any] | None,
    current_semantic_search_plan: dict[str, Any] | None,
    detached_text_candidates: list[str],
    row_anchor_terms: list[str],
) -> dict[str, Any]:
    max_active_code_path_terms = 1
    literal_schema_field_terms = {
        "UpgradeName",
        "Description",
        "UnlockConditionText",
        "FinalSetValue",
        "CalculationType",
        "Output",
        "AdditiveIncrease",
        "Cost",
        "CostExponent",
        "MaxLevel",
        "Destination",
        "UpgradeType",
    }
    literal_schema_method_terms = {
        "CreateUpgradeClass",
        "CalculateAndSetUpgradeCalculations",
        "BuyAndApplyUpgrade",
        "SetGeneralTextsOnUpgrade",
        "SetCostRelatedAttributes",
        "SetUnlockRelatedAttributes",
        "SetAllAttributes",
        "get_finalSetValue",
        "set_finalSetValue",
        "get_unlockConditionText",
        "set_unlockConditionText",
    }
    def split_tokens(value: str) -> list[str]:
        pieces = re.split(r"[^A-Za-z0-9]+", value)
        tokens: list[str] = []
        for piece in pieces:
            if not piece:
                continue
            current = []
            for index, char in enumerate(piece):
                if index > 0 and char.isupper() and piece[index - 1].islower():
                    tokens.append("".join(current).lower())
                    current = [char]
                else:
                    current.append(char)
            if current:
                tokens.append("".join(current).lower())
        return [token for token in tokens if token]

    generic_tokens = {
        "text",
        "title",
        "desc",
        "description",
        "cost",
        "level",
        "req",
        "requirement",
        "bonus",
        "box",
        "layout",
        "fill",
        "overlay",
        "content",
        "button",
        "buy",
        "token",
        "tmp",
        "tmpro",
        "upg",
        "all",
        "set",
        "texts",
        "points",
    }

    def overlap_score(value: str, anchor_terms: list[str], anchor_tokens: set[str]) -> int:
        lowered_value = value.lower()
        score = 0
        for term in anchor_terms:
            lowered_term = term.lower()
            if lowered_value == lowered_term:
                score += 120
            elif lowered_value.startswith(lowered_term) or lowered_term.startswith(lowered_value):
                score += 45
            elif lowered_term in lowered_value or lowered_value in lowered_term:
                score += 20
        value_tokens = {token for token in split_tokens(value) if token not in generic_tokens}
        score += len(anchor_tokens & value_tokens) * 8
        return score

    def is_generic_ui_term(value: str) -> bool:
        value_tokens = split_tokens(value)
        if not value_tokens:
            return True
        return all(token in generic_tokens for token in value_tokens)

    def classify_native_bucket(
        values: list[str],
        anchor_terms: list[str],
        anchor_tokens: set[str],
        minimum_score: int = 8,
    ) -> tuple[list[str], list[str]]:
        linked: list[str] = []
        rejected: list[str] = []
        seen_linked: set[str] = set()
        seen_rejected: set[str] = set()
        for value in values:
            if not isinstance(value, str) or not value.strip():
                continue
            lowered = value.lower()
            score = overlap_score(value, anchor_terms, anchor_tokens)
            if score >= minimum_score:
                if lowered not in seen_linked:
                    seen_linked.add(lowered)
                    linked.append(value)
            elif lowered not in seen_rejected:
                seen_rejected.add(lowered)
                rejected.append(value)
        return linked, rejected

    def collect_raw_function_candidates(raw_result: dict[str, Any], term: str) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        for bucket_name in ("functions", "referenceFunctions", "fuzzyFunctions"):
            bucket = raw_result.get(bucket_name, {})
            if not isinstance(bucket, dict):
                continue
            for entry in bucket.get(term, []) or []:
                if isinstance(entry, dict):
                    tagged_entry = dict(entry)
                    tagged_entry["bucket"] = bucket_name
                    candidates.append(tagged_entry)
        return candidates

    def classify_function_candidates(
        raw_result: dict[str, Any],
        term: str,
        anchor_terms: list[str],
        anchor_tokens: set[str],
    ) -> tuple[list[str], list[str]]:
        linked: list[str] = []
        rejected: list[str] = []
        seen_linked: set[str] = set()
        seen_rejected: set[str] = set()
        for entry in collect_raw_function_candidates(raw_result, term):
            name = str(entry.get("name", "")).strip()
            if not name:
                continue
            score = overlap_score(name, anchor_terms, anchor_tokens)
            for related_value in [*entry.get("callers", []), *entry.get("callees", []), *entry.get("matchedTokens", [])]:
                score += overlap_score(str(related_value), anchor_terms, anchor_tokens)
            lowered = name.lower()
            if score >= 12:
                if lowered not in seen_linked:
                    seen_linked.add(lowered)
                    linked.append(name)
            elif lowered not in seen_rejected:
                seen_rejected.add(lowered)
                rejected.append(name)
        return linked, rejected

    primary_roles = {"title", "description", "cost", "level", "requirement"}
    structure_summary = presentation_update_path.get("structureSummary", {}) or {}
    selected_primary = structure_summary.get("selectedPrimaryStructure", {}) or {}
    primary_terms: list[str] = []
    code_path_anchor_terms: list[str] = []
    primary_structural_anchors: list[dict[str, Any]] = []
    orphaned_terms: list[str] = []

    for subsystem, item in selected_primary.items():
        if not isinstance(item, dict):
            continue
        anchor = {
            "subsystem": subsystem,
            "name": item.get("name"),
            "pathId": item.get("pathId"),
            "hierarchyPath": item.get("hierarchyPath"),
            "role": item.get("role"),
            "scriptNames": item.get("scriptNames", []),
        }
        primary_structural_anchors.append(anchor)
        for candidate in [item.get("name"), item.get("hierarchyPath")]:
            if isinstance(candidate, str) and candidate.strip() and candidate not in primary_terms:
                primary_terms.append(candidate)
        name_candidate = item.get("name")
        if isinstance(name_candidate, str) and name_candidate.strip() and not is_generic_ui_term(name_candidate):
            code_path_anchor_terms.append(name_candidate.strip())

    for item in presentation_objects:
        role = item.get("role")
        name = str(item.get("name", "")).strip()
        if not name:
            continue
        if role in primary_roles and name not in primary_terms:
            if name not in primary_terms:
                primary_terms.append(name)
        elif role in {"bonus", "fill", "icon", "overlay", "button"}:
            if name not in orphaned_terms:
                orphaned_terms.append(name)
    for detached in detached_text_candidates:
        if detached not in orphaned_terms:
            orphaned_terms.append(detached)

    for hook in presentation_update_path.get("updateHookCandidates", []) or []:
        if isinstance(hook, str) and hook.strip():
            code_path_anchor_terms.append(hook.strip())

    def code_path_term_priority(value: str) -> tuple[int, int, str]:
        lowered = value.lower()
        score = 0
        if METHOD_RE.fullmatch(value):
            score += 40
        if any(token in lowered for token in ("overlay", "fill", "progress", "circular")):
            score += 18
        if any(token in lowered for token in ("title", "desc", "cost", "level", "req")):
            score += 12
        if any(token in lowered for token in ("button", "content", "box")):
            score -= 10
        return (-score, len(value), lowered)

    code_path_anchor_terms = unique_strings(code_path_anchor_terms)
    cached_semantic_search_plan = (
        (cached_semantic_scope or {}).get("semanticSearchPlan")
        if isinstance(cached_semantic_scope, dict)
        else None
    )
    active_plan = current_semantic_search_plan or cached_semantic_search_plan or {}
    prioritized_resume_terms: list[str] = []
    gap_focus: dict[str, Any] | None = None
    for gap in active_plan.get("requiredGaps", []) or []:
        candidate_terms = [
            term for term in (gap.get("candidateTerms", []) or [])
            if isinstance(term, str) and term.strip()
        ]
        if candidate_terms:
            gap_focus = {
                "kind": gap.get("kind"),
                "slotRole": gap.get("slotRole"),
                "slotLabel": gap.get("slotLabel"),
                "missingEdge": gap.get("missingEdge"),
            }
            prioritized_resume_terms.extend(candidate_terms)
            break
    if not prioritized_resume_terms:
        prioritized_resume_terms = [
            term
            for term in active_plan.get("suggestedTerms", []) or []
            if isinstance(term, str) and term.strip()
        ]
    code_path_anchor_terms = unique_strings([*prioritized_resume_terms, *code_path_anchor_terms])
    code_path_anchor_terms.sort(key=code_path_term_priority)

    effective_anchor_terms = unique_strings(
        [term for term in row_anchor_terms if not is_generic_ui_term(term)]
    )
    anchor_tokens = {
        token
        for term in effective_anchor_terms
        for token in split_tokens(term)
        if token not in generic_tokens
    }

    results: list[dict[str, Any]] = []
    code_path_results: list[dict[str, Any]] = []
    recursive_updater_candidates: list[dict[str, Any]] = []
    row_linked_native_terms = {
        "methods": [],
        "fields": [],
        "rawValues": [],
        "owners": [],
    }
    rejected_native_noise = {
        "methods": [],
        "fields": [],
        "rawValues": [],
        "owners": [],
    }

    def add_unique(bucket: dict[str, list[str]], key: str, values: list[str]) -> None:
        current = bucket.setdefault(key, [])
        seen = {value.lower() for value in current}
        for value in values:
            lowered = value.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            current.append(value)

    for term in primary_terms:
        cached = find_cached_native_trace([term], family_hint="token-shop")
        linked_methods: list[str] = []
        rejected_methods: list[str] = []
        linked_fields: list[str] = []
        rejected_fields: list[str] = []
        linked_raw_values: list[str] = []
        rejected_raw_values: list[str] = []
        linked_owners: list[str] = []
        rejected_owners: list[str] = []
        if cached:
            summary = cached.get("summary") or {}
            raw_result = cached.get("result") or {}
            linked_methods, rejected_methods = classify_function_candidates(
                raw_result,
                term,
                effective_anchor_terms,
                anchor_tokens,
            )
            summary_linked_methods, summary_rejected_methods = classify_native_bucket(
                list(summary.get("reconstructedMethods", [])),
                effective_anchor_terms,
                anchor_tokens,
                minimum_score=8,
            )
            linked_methods = unique_strings([*linked_methods, *summary_linked_methods])
            rejected_methods = unique_strings([*rejected_methods, *summary_rejected_methods])
            linked_fields, rejected_fields = classify_native_bucket(
                list(summary.get("reconstructedFields", [])),
                effective_anchor_terms,
                anchor_tokens,
                minimum_score=8,
            )
            linked_raw_values, rejected_raw_values = classify_native_bucket(
                list(summary.get("rawValueTerms", [])),
                effective_anchor_terms,
                anchor_tokens,
                minimum_score=8,
            )
            linked_owners, rejected_owners = classify_native_bucket(
                list(summary.get("reconstructedOwners", [])),
                effective_anchor_terms,
                anchor_tokens,
                minimum_score=10,
            )
            add_unique(row_linked_native_terms, "methods", linked_methods)
            add_unique(row_linked_native_terms, "fields", linked_fields)
            add_unique(row_linked_native_terms, "rawValues", linked_raw_values)
            add_unique(row_linked_native_terms, "owners", linked_owners)
            add_unique(rejected_native_noise, "methods", rejected_methods)
            add_unique(rejected_native_noise, "fields", rejected_fields)
            add_unique(rejected_native_noise, "rawValues", rejected_raw_values)
            add_unique(rejected_native_noise, "owners", rejected_owners)
        results.append(
            {
                "term": term,
                "cacheAvailable": bool(cached),
                "status": cached.get("status") if cached else "planned",
                "jobId": cached.get("jobId") if cached else None,
                "summary": cached.get("summary") if cached else None,
                "rowLinkedMethods": linked_methods,
                "rowLinkedFields": linked_fields,
                "rowLinkedRawValues": linked_raw_values,
                "rowLinkedOwners": linked_owners,
                "rejectedMethods": rejected_methods,
                "rejectedFields": rejected_fields,
                "rejectedRawValues": rejected_raw_values,
                "rejectedOwners": rejected_owners,
            }
        )

    for term in code_path_anchor_terms:
        cached = find_cached_native_trace([term], family_hint="token-shop")
        raw_bridge_expansion: dict[str, Any] = {}
        if cached:
            raw_result = cached.get("result") or {}
            term_bridge = (raw_result.get("termBridges") or {}).get(term, {})
            raw_bridge_expansion = term_bridge.get("searchExpansion") or {}
        code_path_results.append(
            {
                "term": term,
                "cacheAvailable": bool(cached),
                "executedThisRun": False,
                "status": cached.get("status") if cached else "planned",
                "jobId": cached.get("jobId") if cached else None,
                "summary": cached.get("summary") if cached else None,
                "rawBridgeExpansion": raw_bridge_expansion,
            }
        )

    seen_recursive_updaters: set[str] = set()
    for item in code_path_results:
        summary = item.get("summary") or {}
        seed_term = str(item.get("term") or "").strip()
        candidate_values: list[str] = []
        for term_summary in summary.get("termSummaries", []) or []:
            candidate_values.extend(term_summary.get("ownerCandidates", []) or [])
        candidate_values.extend(summary.get("bridgedTerms", []) or [])
        raw_bridge_expansion = item.get("rawBridgeExpansion") or {}
        candidate_values.extend(raw_bridge_expansion.get("ownerCandidates", []) or [])
        candidate_values.extend(raw_bridge_expansion.get("methodCandidates", []) or [])
        candidate_values.extend(raw_bridge_expansion.get("fieldCandidates", []) or [])
        for candidate in candidate_values:
            if not isinstance(candidate, str):
                continue
            normalized = candidate.strip()
            if not normalized:
                continue
            lowered = normalized.lower()
            if lowered in seen_recursive_updaters:
                continue
            if not METHOD_RE.fullmatch(normalized):
                continue
            if not normalized.startswith("Set"):
                continue
            if not any(marker in normalized for marker in ("Text", "Cost", "Level", "Unlock", "Attribute", "Upgrade")):
                continue
            seen_recursive_updaters.add(lowered)
            recursive_updater_candidates.append(
                {
                    "term": normalized,
                    "sourceTerm": seed_term,
                    "status": "cached" if find_cached_native_trace([normalized], family_hint="token-shop") else "planned",
                }
            )

    def recursive_updater_priority(item: dict[str, Any]) -> tuple[int, int, str]:
        term = str(item.get("term") or "")
        source_term = str(item.get("sourceTerm") or "")
        lowered = term.lower()
        score = 0
        if "token" in lowered or "shop" in lowered:
            score += 30
        if "unlock" in lowered or "cost" in lowered or "level" in lowered:
            score += 18
        if "attribute" in lowered or "generaltext" in lowered:
            score += 16
        if "title" in lowered or "desc" in lowered or "text" in lowered:
            score += 12
        if "main" in lowered:
            score += 8
        if source_term == "SetAllTokenShopTexts":
            score += 12
        if source_term == "SetTokenTexts":
            score += 8
        if source_term == "MaxedOverlay":
            score += 18
        if any(token in lowered for token in ("ads", "watched", "adchest", "booster", "diamond", "shard", "techupgrade", "automation")):
            score -= 35
        if "minimized" in lowered:
            score -= 20
        return (-score, len(term), lowered)

    recursive_updater_candidates.sort(key=recursive_updater_priority)

    literal_schema_candidates: list[dict[str, Any]] = []
    seen_literal_schema_terms: set[str] = set()

    def collect_literal_schema_terms(values: list[str], source_term: str) -> None:
        for value in values:
            if not isinstance(value, str):
                continue
            normalized = value.strip()
            if not normalized:
                continue
            lowered = normalized.lower()
            if lowered in seen_literal_schema_terms:
                continue
            literal_kind = None
            if normalized in literal_schema_field_terms:
                literal_kind = "schema-field"
            elif normalized in literal_schema_method_terms:
                literal_kind = "schema-method"
            elif normalized.startswith("get_") or normalized.startswith("set_"):
                accessor_lowered = normalized.lower()
                if any(
                    token in accessor_lowered
                    for token in ("upgrade", "description", "condition", "value", "output", "unlock")
                ) and "borge" not in accessor_lowered:
                    literal_kind = "schema-accessor"
            if literal_kind is None:
                continue
            seen_literal_schema_terms.add(lowered)
            literal_schema_candidates.append(
                {
                    "term": normalized,
                    "kind": literal_kind,
                    "sourceTerm": source_term,
                    "status": "cached" if find_cached_native_trace([normalized], family_hint="token-shop") else "planned",
                }
            )

    for item in code_path_results:
        seed_term = str(item.get("term") or "").strip()
        summary = item.get("summary") or {}
        raw_bridge_expansion = item.get("rawBridgeExpansion") or {}
        candidate_values: list[str] = []
        for term_summary in summary.get("termSummaries", []) or []:
            candidate_values.extend(term_summary.get("ownerCandidates", []) or [])
        candidate_values.extend(summary.get("bridgedTerms", []) or [])
        candidate_values.extend(raw_bridge_expansion.get("ownerCandidates", []) or [])
        candidate_values.extend(raw_bridge_expansion.get("methodCandidates", []) or [])
        candidate_values.extend(raw_bridge_expansion.get("fieldCandidates", []) or [])
        candidate_values.extend(raw_bridge_expansion.get("contextStrings", []) or [])
        collect_literal_schema_terms(candidate_values, seed_term)

    def literal_schema_priority(item: dict[str, Any]) -> tuple[int, int, str]:
        term = str(item.get("term") or "")
        source_term = str(item.get("sourceTerm") or "")
        lowered = term.lower()
        score = 0
        if term in {"UpgradeName", "Description", "UnlockConditionText"}:
            score += 40
        if term in {"FinalSetValue", "CalculationType", "Output"}:
            score += 28
        if term in {"AdditiveIncrease", "Cost", "CostExponent", "MaxLevel"}:
            score += 22
        if term in {"CreateUpgradeClass", "CalculateAndSetUpgradeCalculations", "BuyAndApplyUpgrade"}:
            score += 18
        if "unlock" in lowered or "description" in lowered or "upgrade" in lowered:
            score += 10
        if source_term in {"UnlockConditionText", "FinalSetValue", "CalculationType"}:
            score += 14
        if source_term == "SetGeneralTextsOnUpgrade":
            score += 8
        return (-score, len(term), lowered)

    literal_schema_candidates.sort(key=literal_schema_priority)

    if gap_focus and gap_focus.get("kind") == "missing-verified-updater-edge":
        focused_updater_terms = unique_strings(
            [item["term"] for item in recursive_updater_candidates if isinstance(item.get("term"), str)]
        )
        if focused_updater_terms:
            code_path_anchor_terms = unique_strings([*focused_updater_terms, *code_path_anchor_terms])
            code_path_anchor_terms = [
                term for term in code_path_anchor_terms
                if METHOD_RE.fullmatch(term) or term in focused_updater_terms
            ]
    elif literal_schema_candidates:
        prioritized_literal_terms = unique_strings(
            [item["term"] for item in literal_schema_candidates if isinstance(item.get("term"), str)]
        )
        code_path_anchor_terms = unique_strings([*prioritized_literal_terms, *code_path_anchor_terms])
    existing_terms = {str(item.get("term") or "").strip().lower() for item in code_path_results}
    for item in literal_schema_candidates:
        term = str(item.get("term") or "").strip()
        if not term or term.lower() in existing_terms:
            continue
        existing_terms.add(term.lower())
        code_path_results.append(
            {
                "term": term,
                "cacheAvailable": False,
                "executedThisRun": False,
                "status": item.get("status") or "planned",
                "jobId": None,
                "summary": None,
                "rawBridgeExpansion": {},
                "followUpKind": item.get("kind"),
                "sourceTerm": item.get("sourceTerm"),
            }
        )
    next_live_term: str | None = None
    if gap_focus and gap_focus.get("kind") == "missing-verified-updater-edge":
        next_updater = next(
            (
                item for item in recursive_updater_candidates
                if str(item.get("status") or "") == "planned"
                and str(item.get("term") or "").strip().lower() not in existing_terms
            ),
            None,
        )
        if next_updater is not None:
            next_live_term = str(next_updater.get("term") or "").strip()
    if not next_live_term and literal_schema_candidates:
        next_literal = next(
            (
                item for item in literal_schema_candidates
                if str(item.get("status") or "") == "planned"
                and str(item.get("term") or "").strip().lower() in {
                    str(result.get("term") or "").strip().lower()
                    for result in code_path_results
                    if str(result.get("status") or "") == "planned"
                }
            ),
            None,
        )
        if next_literal is not None:
            next_live_term = str(next_literal.get("term") or "").strip()
    if not next_live_term:
        next_planned = next(
            (
                item for item in code_path_results
                if str(item.get("status") or "") == "planned"
            ),
            None,
        )
        if next_planned is not None:
            next_live_term = str(next_planned.get("term") or "").strip()

    if next_live_term:
        cached = collect_native_trace([next_live_term], timeout=90, family_hint="token-shop")
        raw_result = cached.get("result") or {}
        term_bridge = (raw_result.get("termBridges") or {}).get(next_live_term, {})
        code_path_results = [
            item for item in code_path_results
            if str(item.get("term") or "").strip().lower() != next_live_term.lower()
        ]
        code_path_results.insert(
            0,
            {
                "term": next_live_term,
                "cacheAvailable": bool(cached),
                "executedThisRun": True,
                "status": cached.get("status") if cached else "planned",
                "jobId": cached.get("jobId") if cached else None,
                "summary": cached.get("summary") if cached else None,
                "rawBridgeExpansion": (term_bridge.get("searchExpansion") or {}),
            },
        )
        code_path_anchor_terms = unique_strings([next_live_term, *code_path_anchor_terms])

    return {
        "primaryTerms": primary_terms,
        "primaryStructuralAnchors": primary_structural_anchors,
        "codePathAnchorTerms": code_path_anchor_terms,
        "gapFocusedFollowUp": gap_focus,
        "codePathResults": code_path_results,
        "recursiveUpdaterCandidates": recursive_updater_candidates,
        "literalSchemaCandidates": literal_schema_candidates,
        "codePathExecutionPolicy": {
            "mode": "bounded-active-follow-up",
            "maxActiveTermsPerRun": max_active_code_path_terms,
            "note": "Missing structural code-path anchors are collected live up to a small cap, then left planned for later runs.",
        },
        "orphanedTerms": orphaned_terms,
        "rowAnchorTerms": effective_anchor_terms,
        "rowLinkedNativeTerms": row_linked_native_terms,
        "rejectedNativeNoise": rejected_native_noise,
        "results": results,
    }


def build_token_shop_literal_schema_recovery(
    row_recovery: dict[str, Any],
    schema_results: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    follow_up = row_recovery.get("presentationFollowUp", {}) or {}
    code_path_results = follow_up.get("codePathResults", []) or []
    literal_schema_candidates = follow_up.get("literalSchemaCandidates", []) or []
    active_schema_results = schema_results or []

    schema_fields = {
        "UpgradeName",
        "Description",
        "UnlockConditionText",
        "FinalSetValue",
        "CalculationType",
        "Output",
        "AdditiveIncrease",
        "Cost",
        "CostExponent",
        "MaxLevel",
        "Destination",
        "UpgradeType",
    }
    schema_methods = {
        "CreateUpgradeClass",
        "CalculateAndSetUpgradeCalculations",
        "BuyAndApplyUpgrade",
        "SetGeneralTextsOnUpgrade",
        "SetCostRelatedAttributes",
        "SetUnlockRelatedAttributes",
        "SetAllAttributes",
        "get_finalSetValue",
        "set_finalSetValue",
        "get_unlockConditionText",
        "set_unlockConditionText",
    }
    recovered_fields: list[str] = []
    recovered_methods: list[str] = []
    recovered_owner: str | None = None
    source_terms: list[str] = []

    def add_unique(values: list[str], candidate: str) -> None:
        if candidate and candidate not in values:
            values.append(candidate)

    for item in [*code_path_results, *active_schema_results]:
        summary = item.get("summary") or {}
        source_term = str(item.get("term") or "").strip()
        if source_term:
            add_unique(source_terms, source_term)
            if source_term in schema_fields:
                add_unique(recovered_fields, source_term)
            elif source_term in schema_methods:
                add_unique(recovered_methods, source_term)
        for owner in summary.get("reconstructedOwners", []) or []:
            if owner == "ArcadeUpgradeSO":
                recovered_owner = owner
        owner_to_terms = summary.get("ownerToTerms", {}) or {}
        for owner_name in owner_to_terms:
            if owner_name == "ArcadeUpgradeSO":
                recovered_owner = owner_name
        for owner_entry in summary.get("scoredOwners", []) or []:
            if str(owner_entry.get("owner") or "").strip() == "ArcadeUpgradeSO":
                recovered_owner = "ArcadeUpgradeSO"
        for term_summary in summary.get("termSummaries", []) or []:
            term_label = str(term_summary.get("term") or "").strip()
            if term_label in schema_fields:
                add_unique(recovered_fields, term_label)
            elif term_label in schema_methods:
                add_unique(recovered_methods, term_label)
            for owner in term_summary.get("ownerCandidates", []) or []:
                if owner == "ArcadeUpgradeSO":
                    recovered_owner = owner
        for field in summary.get("reconstructedFields", []) or []:
            if field in schema_fields:
                add_unique(recovered_fields, field)
        for method in summary.get("reconstructedMethods", []) or []:
            if method in schema_methods:
                add_unique(recovered_methods, method)
        raw_bridge_expansion = item.get("rawBridgeExpansion") or {}
        for field in raw_bridge_expansion.get("fieldCandidates", []) or []:
            if field in schema_fields:
                add_unique(recovered_fields, field)
        for method in raw_bridge_expansion.get("methodCandidates", []) or []:
            if method in schema_methods:
                add_unique(recovered_methods, method)
        for candidate in raw_bridge_expansion.get("ownerCandidates", []) or []:
            if candidate == "ArcadeUpgradeSO":
                recovered_owner = candidate
            elif candidate in schema_fields:
                add_unique(recovered_fields, candidate)
            elif candidate in schema_methods:
                add_unique(recovered_methods, candidate)
        for candidate in raw_bridge_expansion.get("contextStrings", []) or []:
            if candidate == "ArcadeUpgradeSO":
                recovered_owner = candidate
            elif candidate in schema_fields:
                add_unique(recovered_fields, candidate)
            elif candidate in schema_methods:
                add_unique(recovered_methods, candidate)

    for item in literal_schema_candidates:
        term = str(item.get("term") or "").strip()
        if term in schema_fields:
            add_unique(recovered_fields, term)
        elif term in schema_methods:
            add_unique(recovered_methods, term)
        source_term = str(item.get("sourceTerm") or "").strip()
        if source_term:
            add_unique(source_terms, source_term)

    title_field_present = "UpgradeName" in recovered_fields
    description_field_present = "Description" in recovered_fields
    final_value_fields = [
        field for field in recovered_fields
        if field in {"FinalSetValue", "CalculationType", "Output", "AdditiveIncrease", "Cost", "CostExponent", "MaxLevel"}
    ]
    return {
        "status": "schema-owner-recovered" if recovered_owner else "schema-owner-unresolved",
        "owner": recovered_owner,
        "schemaFields": recovered_fields,
        "schemaMethods": recovered_methods,
        "finalValueFields": final_value_fields,
        "titleFieldPresent": title_field_present,
        "descriptionFieldPresent": description_field_present,
        "sourceTerms": source_terms,
        "schemaResults": active_schema_results,
    }


def build_token_shop_literal_schema_follow_up(
    row_context: dict[str, Any],
) -> list[dict[str, Any]]:
    schema_terms = {
        "UpgradeName",
        "Description",
        "UnlockConditionText",
        "FinalSetValue",
        "CalculationType",
        "Output",
        "AdditiveIncrease",
        "Cost",
        "CostExponent",
        "MaxLevel",
        "Destination",
        "UpgradeType",
        "CreateUpgradeClass",
        "CalculateAndSetUpgradeCalculations",
        "BuyAndApplyUpgrade",
        "SetGeneralTextsOnUpgrade",
        "SetCostRelatedAttributes",
        "SetUnlockRelatedAttributes",
        "SetAllAttributes",
        "get_finalSetValue",
        "set_finalSetValue",
        "get_unlockConditionText",
        "set_unlockConditionText",
        "get_cost",
        "get_costExponent",
    }

    def split_tokens(value: str) -> list[str]:
        pieces = re.split(r"[^A-Za-z0-9]+", value)
        tokens: list[str] = []
        for piece in pieces:
            if not piece:
                continue
            current = []
            for index, char in enumerate(piece):
                if index > 0 and char.isupper() and piece[index - 1].islower():
                    tokens.append("".join(current).lower())
                    current = [char]
                else:
                    current.append(char)
            if current:
                tokens.append("".join(current).lower())
        return [token for token in tokens if token]

    generic_tokens = {
        "text",
        "title",
        "desc",
        "description",
        "cost",
        "level",
        "req",
        "requirement",
        "bonus",
        "box",
        "layout",
        "fill",
        "overlay",
        "content",
        "button",
        "buy",
        "token",
        "tmp",
        "tmpro",
        "upg",
        "all",
        "set",
        "texts",
        "points",
    }

    def collect_signature_tokens(values: list[str]) -> set[str]:
        tokens: set[str] = set()
        for value in values:
            for token in split_tokens(value):
                if token not in generic_tokens:
                    tokens.add(token)
        return tokens

    signature_values = [
        str(row_context.get("shellField") or ""),
        *(str(value) for value in (row_context.get("ownerFieldBlock") or []) if value),
        *(str(value) for value in (row_context.get("actionMethods") or []) if value),
        *(str(value) for value in (row_context.get("prefabCandidates") or []) if value),
    ]
    signature_tokens = collect_signature_tokens(signature_values)

    presentation_follow_up = row_context.get("presentationFollowUp") or {}
    code_path_results = list(presentation_follow_up.get("codePathResults", []) or [])
    candidate_terms: list[dict[str, Any]] = []
    seen_terms: set[str] = set()

    def overlaps_row_signature(value: str, source_term: str) -> bool:
        candidate_tokens = collect_signature_tokens([value, source_term])
        return bool(signature_tokens and signature_tokens & candidate_tokens)

    def add_candidate(term: str, source_term: str) -> None:
        normalized = str(term or "").strip()
        if not normalized or normalized not in schema_terms:
            return
        lowered = normalized.lower()
        if lowered in seen_terms:
            return
        if not overlaps_row_signature(normalized, source_term):
            return
        seen_terms.add(lowered)
        candidate_terms.append(
            {
                "term": normalized,
                "sourceTerm": source_term,
                "status": "cached" if find_cached_native_trace([normalized], family_hint="token-shop") else "planned",
                "followUpKind": "row-local-schema-candidate",
            }
        )

    for item in code_path_results:
        source_term = str(item.get("term") or "").strip()
        raw_bridge_expansion = item.get("rawBridgeExpansion") or {}
        for bucket_name in ("ownerCandidates", "methodCandidates", "fieldCandidates", "contextStrings"):
            for candidate in raw_bridge_expansion.get(bucket_name, []) or []:
                add_candidate(str(candidate), source_term)

    results: list[dict[str, Any]] = []
    next_live_term: str | None = None
    for candidate in candidate_terms:
        term = str(candidate.get("term") or "").strip()
        cached = find_cached_native_trace([term], family_hint="token-shop")
        if not cached and next_live_term is None:
            next_live_term = term
        results.append(
            {
                "term": term,
                "cacheAvailable": bool(cached),
                "executedThisRun": False,
                "status": cached.get("status") if cached else "planned",
                "jobId": cached.get("jobId") if cached else None,
                "summary": cached.get("summary") if cached else None,
                "rawBridgeExpansion": ((cached.get("result") or {}).get("termBridges") or {}).get(term, {}).get("searchExpansion", {}) if cached else {},
                "followUpKind": candidate.get("followUpKind") or "row-local-schema-candidate",
                "sourceTerm": candidate.get("sourceTerm"),
            }
        )
    if next_live_term:
        cached = collect_native_trace([next_live_term], timeout=90, family_hint="token-shop")
        term_bridge = ((cached.get("result") or {}).get("termBridges") or {}).get(next_live_term, {}) if cached else {}
        results = [
            item for item in results
            if str(item.get("term") or "").strip().lower() != next_live_term.lower()
        ]
        results.insert(
            0,
            {
                "term": next_live_term,
                "cacheAvailable": bool(cached),
                "executedThisRun": True,
                "status": cached.get("status") if cached else "planned",
                "jobId": cached.get("jobId") if cached else None,
                "summary": cached.get("summary") if cached else None,
                "rawBridgeExpansion": (term_bridge.get("searchExpansion") or {}),
                "followUpKind": "row-local-schema-candidate",
            }
        )
    return results


def build_token_shop_literal_text_recovery(
    row_recovery: dict[str, Any],
) -> dict[str, Any]:
    raw_entries = get_unity_raw_string_index().get("level0", [])
    if not raw_entries:
        return {
            "status": "literal-text-unavailable",
            "title": None,
            "description": None,
            "shortEffectLabel": None,
            "outputLabel": None,
            "bonusLabel": None,
            "titleCandidates": [],
            "descriptionCandidates": [],
            "shortEffectCandidates": [],
            "outputCandidates": [],
            "bonusCandidates": [],
        }

    value_by_field = {
        str(item.get("field")): item.get("value")
        for item in row_recovery.get("recoveredFormulaValues", []) or []
        if item.get("field") is not None
    }
    shell_field = str(row_recovery.get("shellField") or "").strip()
    prefab_candidates = [str(item).strip() for item in row_recovery.get("prefabCandidates", []) or [] if str(item).strip()]
    prefab_text = " ".join(prefab_candidates)
    row_signature_text = " ".join(
        [
            shell_field,
            prefab_text,
            *[
                str(item.get("field") or "").strip()
                for item in row_recovery.get("recoveredFormulaValues", []) or []
                if str(item.get("field") or "").strip()
            ],
        ]
    ).lower()
    schema = row_recovery.get("literalSchemaRecovery", {}) or {}
    schema_fields = set(schema.get("schemaFields", []) or [])

    is_daily_tokenium_family = any(
        marker in row_signature_text
        for marker in (
            "dailytokens",
            "tokendailies",
            "dailytokenium",
            "daily token",
        )
    )

    bonus_value = value_by_field.get("ModBoostBonus")
    formatted_bonus = None
    if isinstance(bonus_value, (int, float)):
        formatted_bonus = f"x{float(bonus_value):.2f}"

    if is_daily_tokenium_family:
        output_candidates = [
            entry for entry in raw_entries
            if isinstance(entry.get("value"), str)
            and "daily tokenium" in entry["value"].lower()
            and len(str(entry.get("value") or "")) <= 120
        ]
        output_candidates.sort(
            key=lambda item: (
                0 if str(item.get("value") or "").startswith("0 / ") else 1,
                len(str(item.get("value") or "")),
                int(item.get("offset") or 0),
            )
        )
        selected_output = output_candidates[0] if output_candidates else None
        output_label = str(selected_output.get("value") or "").strip() if selected_output else None
        output_core_base = "Daily Tokens"
        output_abbreviation = None

        def title_score(value: str) -> tuple[int, int, int, str]:
            lowered = value.lower()
            score = 0
            if "daily tokens" in lowered:
                score += 14
            if "t2" in lowered:
                score += 8
            if "output:" in lowered:
                score -= 10
            if "<" in value or ">" in value:
                score -= 8
            if ":" in value:
                score -= 3
            return (-score, len(value), lowered.count(" "), value)

        title_candidates = [
            entry for entry in raw_entries
            if isinstance(entry.get("value"), str)
            and "daily tokens" in entry["value"].lower()
            and len(entry["value"]) <= 80
        ]
        title_candidates.sort(key=lambda item: title_score(str(item.get("value") or "")))
        selected_title = title_candidates[0] if title_candidates else None

        bonus_candidates = []
        selected_bonus = None

        description_candidates = []
        for entry in raw_entries:
            value = str(entry.get("value") or "")
            lowered = value.lower()
            if "this upgrade" not in lowered:
                continue
            if "daily tokenium" not in lowered:
                continue
            score = 0
            if "farm missions" in lowered:
                score += 8
            if "cap" in lowered:
                score += 8
            if "daily tokenium-553" in lowered:
                score += 4
            description_candidates.append(
                {
                    "offset": entry.get("offset"),
                    "encoding": entry.get("encoding"),
                    "value": value,
                    "score": score,
                }
            )
        description_candidates.sort(
            key=lambda item: (-int(item.get("score") or 0), len(str(item.get("value") or "")), int(item.get("offset") or 0))
        )
        selected_description = description_candidates[0] if description_candidates else None

        short_effect_candidates = []
        selected_short_effect = None
    else:
        output_candidates = [
            entry for entry in raw_entries
            if isinstance(entry.get("value"), str)
            and entry["value"].startswith("Output: ")
            and "Mod Points" in entry["value"]
        ]
        output_candidates.sort(
            key=lambda item: (
                0 if "(MP)" in str(item.get("value") or "") else 1,
                len(str(item.get("value") or "")),
                int(item.get("offset") or 0),
            )
        )
        selected_output = output_candidates[0] if output_candidates else None
        output_label = str(selected_output.get("value") or "").strip() if selected_output else None
        output_core = output_label.removeprefix("Output: ").strip() if output_label else "Mod Points"
        output_core_base = output_core.replace("(MP)", "").replace("()", "").strip()
        output_abbreviation_match = re.search(r"\(([^)]+)\)", output_label or "")
        output_abbreviation = output_abbreviation_match.group(1).strip() if output_abbreviation_match else None

        def title_score(value: str) -> tuple[int, int, int, str]:
            lowered = value.lower()
            score = 0
            if output_core_base and output_core_base.lower() in lowered:
                score += 10
            if "booster" in lowered:
                score += 8
            if "output:" in lowered:
                score -= 10
            if "<" in value or ">" in value:
                score -= 8
            if ":" in value:
                score -= 3
            if shell_field.startswith("ATU4") and "ultima" in lowered:
                score -= 2
            if prefab_text and "modpointsbooster" in prefab_text.lower() and "mod points booster" == lowered:
                score += 12
            return (-score, len(value), lowered.count(" "), value)

        title_candidates = [
            entry for entry in raw_entries
            if isinstance(entry.get("value"), str)
            and output_core_base.lower() in entry["value"].lower()
            and "booster" in entry["value"].lower()
            and len(entry["value"]) <= 80
        ]
        title_candidates.sort(key=lambda item: title_score(str(item.get("value") or "")))
        selected_title = title_candidates[0] if title_candidates else None

        bonus_candidates = [
            entry for entry in raw_entries
            if isinstance(entry.get("value"), str)
            and output_core_base.lower() in entry["value"].lower()
            and "gained" in entry["value"].lower()
            and len(entry["value"]) <= 80
        ]
        bonus_candidates.sort(key=lambda item: (0 if str(item.get("value") or "").startswith("2. ") else 1, len(str(item.get("value") or "")), int(item.get("offset") or 0)))
        selected_bonus = bonus_candidates[0] if bonus_candidates else None

        description_candidates = []
        for entry in raw_entries:
            value = str(entry.get("value") or "")
            lowered = value.lower()
            if "this upgrade" not in lowered:
                continue
            if output_core_base.lower() not in lowered:
                continue
            if formatted_bonus and formatted_bonus.lower() not in lowered:
                continue
            score = 0
            if "mission materials" in lowered:
                score += 6
            if "multiplicative" in lowered:
                score += 6
            if formatted_bonus and formatted_bonus.lower() in lowered:
                score += 8
            if "all " in lowered:
                score += 2
            description_candidates.append(
                {
                    "offset": entry.get("offset"),
                    "encoding": entry.get("encoding"),
                    "value": value,
                    "score": score,
                }
            )
        description_candidates.sort(key=lambda item: (-int(item.get("score") or 0), len(str(item.get("value") or "")), int(item.get("offset") or 0)))
        selected_description = description_candidates[0] if description_candidates else None

        short_effect_candidates = []
        for entry in raw_entries:
            value = str(entry.get("value") or "").strip()
            lowered = value.lower()
            if not formatted_bonus or formatted_bonus.lower() not in lowered:
                continue
            if "gained" not in lowered:
                continue
            if output_abbreviation and output_abbreviation.lower() not in lowered:
                continue
            score = 0
            if "<color=" in value:
                score += 6
            if formatted_bonus and formatted_bonus.lower() in lowered:
                score += 8
            if output_abbreviation and output_abbreviation.lower() in lowered:
                score += 8
            if "to <color" in lowered:
                score += 3
            short_effect_candidates.append(
                {
                    "offset": entry.get("offset"),
                    "encoding": entry.get("encoding"),
                    "value": value,
                    "score": score,
                }
            )
        short_effect_candidates.sort(
            key=lambda item: (-int(item.get("score") or 0), len(str(item.get("value") or "")), int(item.get("offset") or 0))
        )
        selected_short_effect = short_effect_candidates[0] if short_effect_candidates else None

    title_text = str(selected_title.get("value") or "").strip() if selected_title else None
    description_text = str(selected_description.get("value") or "").strip() if selected_description else None
    short_effect_label = str(selected_short_effect.get("value") or "").strip() if selected_short_effect else None
    bonus_label = str(selected_bonus.get("value") or "").strip() if selected_bonus else None

    literal_status = "literal-text-open"
    if title_text and description_text:
        literal_status = "literal-text-recovered"
    elif title_text or description_text:
        literal_status = "literal-text-partial"

    return {
        "status": literal_status,
        "title": title_text,
        "description": description_text,
        "shortEffectLabel": short_effect_label,
        "outputLabel": output_label,
        "bonusLabel": bonus_label,
        "titleCandidates": title_candidates[:8],
        "descriptionCandidates": description_candidates[:8],
        "shortEffectCandidates": short_effect_candidates[:8],
        "outputCandidates": output_candidates[:8],
        "bonusCandidates": bonus_candidates[:8],
        "bonusMultiplier": formatted_bonus,
        "schemaFields": sorted(schema_fields),
    }


def build_token_shop_literal_recovery_summary(
    literal_schema_recovery: dict[str, Any],
    literal_text_recovery: dict[str, Any],
) -> dict[str, Any]:
    schema_fields = [
        str(item)
        for item in (literal_schema_recovery.get("schemaFields") or literal_text_recovery.get("schemaFields") or [])
        if str(item).strip()
    ]
    return {
        "status": str(literal_text_recovery.get("status") or literal_schema_recovery.get("status") or "").strip() or None,
        "schemaFields": schema_fields,
        "schemaFieldCount": len(schema_fields),
        "title": str(literal_text_recovery.get("title") or "").strip() or None,
        "description": str(literal_text_recovery.get("description") or "").strip() or None,
        "shortEffectLabel": str(literal_text_recovery.get("shortEffectLabel") or "").strip() or None,
        "outputLabel": str(literal_text_recovery.get("outputLabel") or "").strip() or None,
        "bonusLabel": str(literal_text_recovery.get("bonusLabel") or "").strip() or None,
        "titleCandidateCount": len(list(literal_text_recovery.get("titleCandidates") or [])),
        "descriptionCandidateCount": len(list(literal_text_recovery.get("descriptionCandidates") or [])),
        "shortEffectCandidateCount": len(list(literal_text_recovery.get("shortEffectCandidates") or [])),
        "outputCandidateCount": len(list(literal_text_recovery.get("outputCandidates") or [])),
        "bonusCandidateCount": len(list(literal_text_recovery.get("bonusCandidates") or [])),
        "bonusMultiplier": str(literal_text_recovery.get("bonusMultiplier") or "").strip() or None,
    }


def build_token_shop_semantic_graph(row_recovery: dict[str, Any]) -> dict[str, Any]:
    def add_node(nodes: list[dict[str, Any]], seen: set[str], node_id: str, node_type: str, label: str, **extra: Any) -> None:
        if not node_id or node_id in seen:
            return
        seen.add(node_id)
        payload = {"id": node_id, "type": node_type, "label": label}
        payload.update(extra)
        nodes.append(payload)

    def add_edge(edges: list[dict[str, Any]], seen: set[tuple[str, str, str]], source: str, edge_type: str, target: str, **extra: Any) -> None:
        if not source or not target:
            return
        key = (source, edge_type, target)
        if key in seen:
            return
        seen.add(key)
        payload = {"source": source, "type": edge_type, "target": target}
        payload.update(extra)
        edges.append(payload)

    shell_field = str(row_recovery.get("shellField") or "").strip()
    semantic_id = f"token-shop-row:{shell_field}" if shell_field else "token-shop-row:unknown"
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    node_seen: set[str] = set()
    edge_seen: set[tuple[str, str, str]] = set()

    add_node(nodes, node_seen, semantic_id, "row", shell_field or "token-shop-row")

    if shell_field:
        shell_node = f"field:{shell_field}"
        add_node(nodes, node_seen, shell_node, "field", shell_field, fieldKind="shell")
        add_edge(edges, edge_seen, semantic_id, "has-shell-field", shell_node, confidence="verified")

    for method in row_recovery.get("recoveredActionMethods", []) or []:
        method_node = f"method:{method}"
        add_node(nodes, node_seen, method_node, "method", method, methodKind="action")
        add_edge(edges, edge_seen, semantic_id, "invokes-action", method_node, confidence="verified")

    for prefab in row_recovery.get("prefabCandidates", []) or []:
        prefab_node = f"prefab:{prefab}"
        add_node(nodes, node_seen, prefab_node, "prefab", prefab)
        add_edge(edges, edge_seen, semantic_id, "uses-prefab", prefab_node, confidence="verified")

    field_node_ids: dict[str, str] = {}
    for entry in row_recovery.get("recoveredFormulaValues", []) or []:
        field_name = str(entry.get("field") or "").strip()
        if not field_name:
            continue
        field_node = f"field:{field_name}"
        field_node_ids[field_name] = field_node
        add_node(
            nodes,
            node_seen,
            field_node,
            "field",
            field_name,
            fieldKind="formula",
            objectOffset=entry.get("objectOffset"),
            group=entry.get("group"),
        )
        add_edge(edges, edge_seen, semantic_id, "has-formula-field", field_node, confidence="verified")
        value = entry.get("value")
        if value is not None:
            value_label = str(value)
            value_node = f"raw-value:{field_name}:{value_label}"
            add_node(nodes, node_seen, value_node, "raw-value", value_label, field=field_name)
            add_edge(edges, edge_seen, field_node, "has-value", value_node, confidence="verified")

    resolved_gameobjects = row_recovery.get("resolvedGameObjects", []) or []
    for obj in resolved_gameobjects:
        game_object_path_id = obj.get("gameObjectPathId")
        if not isinstance(game_object_path_id, int):
            continue
        go_name = str(obj.get("gameObjectName") or game_object_path_id)
        go_node = f"game-object:{game_object_path_id}"
        add_node(
            nodes,
            node_seen,
            go_node,
            "ui-object",
            go_name,
            pathId=game_object_path_id,
            sourceField=obj.get("sourceField"),
            sourceType=obj.get("sourceType"),
        )
        add_edge(edges, edge_seen, semantic_id, "binds-ui-object", go_node, confidence="verified")
        source_field = str(obj.get("sourceField") or "").strip()
        if source_field:
            source_field_node = f"field:{source_field}"
            add_node(nodes, node_seen, source_field_node, "field", source_field, fieldKind="pointer")
            add_edge(edges, edge_seen, source_field_node, "points-to-ui-object", go_node, confidence="verified")

    presentation_update = row_recovery.get("presentationUpdatePath", {}) or {}
    structure_summary = presentation_update.get("structureSummary", {}) or {}
    selected_primary = structure_summary.get("selectedPrimaryStructure", {}) or {}
    subsystem_to_node: dict[str, str] = {}
    for subsystem, item in selected_primary.items():
        if not isinstance(item, dict):
            continue
        path_id = item.get("pathId")
        node_id = f"ui-subsystem:{subsystem}:{path_id if isinstance(path_id, int) else item.get('name')}"
        subsystem_to_node[subsystem] = node_id
        add_node(
            nodes,
            node_seen,
            node_id,
            "ui-subsystem",
            str(item.get("name") or subsystem),
            subsystem=subsystem,
            pathId=path_id,
            hierarchyPath=item.get("hierarchyPath"),
            role=item.get("role"),
            scriptNames=item.get("scriptNames", []),
        )
        add_edge(edges, edge_seen, semantic_id, "has-ui-subsystem", node_id, confidence="verified")
        if isinstance(path_id, int):
            add_edge(edges, edge_seen, f"game-object:{path_id}", "hosts-subsystem", node_id, confidence="strong-bridge")

    subsystem_slot_map = {
        "titleContainers": "title",
        "descriptionContainers": "description",
        "costDisplays": "cost",
        "requirementDisplays": "requirement",
    }
    slots = presentation_update.get("slots", {}) or {}
    for subsystem, slot_role in subsystem_slot_map.items():
        subsystem_node = subsystem_to_node.get(subsystem)
        if not subsystem_node:
            continue
        for slot in slots.get(slot_role, []) or []:
            slot_path_id = slot.get("pathId")
            slot_name = str(slot.get("name") or slot_role)
            slot_node = f"ui-slot:{slot_role}:{slot_path_id if isinstance(slot_path_id, int) else slot_name}"
            add_node(
                nodes,
                node_seen,
                slot_node,
                "ui-slot",
                slot_name,
                slotRole=slot_role,
                pathId=slot_path_id,
                hierarchyPath=slot.get("hierarchyPath"),
                scriptNames=slot.get("scriptNames", []),
            )
            add_edge(edges, edge_seen, subsystem_node, "contains-slot", slot_node, confidence="verified")

    updater_terms: list[str] = []
    updater_terms.extend(presentation_update.get("updateHookCandidates", []) or [])
    updater_terms.extend(item.get("term") for item in (row_recovery.get("presentationFollowUp", {}) or {}).get("recursiveUpdaterCandidates", []) if item.get("term"))
    updater_terms = unique_strings([term for term in updater_terms if isinstance(term, str)])
    for updater in updater_terms:
        updater_node = f"updater:{updater}"
        add_node(nodes, node_seen, updater_node, "updater", updater)
        add_edge(edges, edge_seen, semantic_id, "has-updater-candidate", updater_node, confidence="strong-bridge")

    follow_up = row_recovery.get("presentationFollowUp", {}) or {}
    literal_schema = row_recovery.get("literalSchemaRecovery", {}) or {}
    literal_text = row_recovery.get("literalTextRecovery", {}) or {}
    recursive_updaters = follow_up.get("recursiveUpdaterCandidates", []) or []
    for updater_item in recursive_updaters:
        term = str(updater_item.get("term") or "").strip()
        source_term = str(updater_item.get("sourceTerm") or "").strip()
        if not term or not source_term:
            continue
        add_edge(
            edges,
            edge_seen,
            f"updater:{source_term}",
            "expands-to-updater",
            f"updater:{term}",
            confidence="strong-bridge",
            status=updater_item.get("status"),
        )

    updater_to_roles = {
        "SetTokenTexts": ["title", "description"],
        "SetAllTokenShopTexts": ["title", "description", "cost", "level", "requirement"],
        "SetGeneralTextsOnUpgrade": ["title", "description"],
        "SetCostRelatedAttributes": ["cost"],
        "SetUnlockRelatedAttributes": ["requirement"],
        "SetAllAttributes": ["title", "description", "cost", "requirement"],
    }
    slot_nodes_by_role = {
        node.get("slotRole"): [item for item in nodes if item.get("type") == "ui-slot" and item.get("slotRole") == node.get("slotRole")]
        for node in [item for item in nodes if item.get("type") == "ui-slot"]
    }
    schema_owner = str(literal_schema.get("owner") or "").strip()
    if schema_owner:
        schema_owner_node = f"schema-owner:{schema_owner}"
        add_node(nodes, node_seen, schema_owner_node, "schema-owner", schema_owner)
        add_edge(edges, edge_seen, semantic_id, "uses-upgrade-schema", schema_owner_node, confidence="strong-bridge")
        for field in literal_schema.get("schemaFields", []) or []:
            field_node = f"schema-field:{field}"
            add_node(nodes, node_seen, field_node, "schema-field", field)
            add_edge(edges, edge_seen, schema_owner_node, "declares-schema-field", field_node, confidence="strong-bridge")
            if field == "UpgradeName":
                for slot_node in slot_nodes_by_role.get("title", []):
                    add_edge(edges, edge_seen, field_node, "defines-literal-slot", slot_node["id"], confidence="strong-bridge")
            elif field == "Description":
                for slot_node in slot_nodes_by_role.get("description", []):
                    add_edge(edges, edge_seen, field_node, "defines-literal-slot", slot_node["id"], confidence="strong-bridge")
            elif field in {"FinalSetValue", "CalculationType", "Output", "AdditiveIncrease", "Cost", "CostExponent", "MaxLevel"}:
                for slot_node in slot_nodes_by_role.get("cost", []):
                    add_edge(edges, edge_seen, field_node, "defines-value-slot", slot_node["id"], confidence="heuristic")
        for method in literal_schema.get("schemaMethods", []) or []:
            method_node = f"schema-method:{method}"
            add_node(nodes, node_seen, method_node, "schema-method", method)
            add_edge(edges, edge_seen, schema_owner_node, "declares-schema-method", method_node, confidence="strong-bridge")
            if method in {"SetGeneralTextsOnUpgrade", "SetAllAttributes"}:
                for role in ("title", "description"):
                    for slot_node in slot_nodes_by_role.get(role, []):
                        add_edge(edges, edge_seen, method_node, "writes-literal-slot", slot_node["id"], confidence="strong-bridge")
            if method in {"SetCostRelatedAttributes", "CalculateAndSetUpgradeCalculations"}:
                for slot_node in slot_nodes_by_role.get("cost", []):
                    add_edge(edges, edge_seen, method_node, "writes-value-slot", slot_node["id"], confidence="strong-bridge")
    for updater, roles in updater_to_roles.items():
        updater_node = f"updater:{updater}"
        if updater_node not in node_seen:
            continue
        for role in roles:
            for slot_node in slot_nodes_by_role.get(role, []):
                confidence = "heuristic"
                if updater in {"SetGeneralTextsOnUpgrade", "SetCostRelatedAttributes", "SetUnlockRelatedAttributes", "SetAllAttributes"}:
                    confidence = "strong-bridge"
                add_edge(edges, edge_seen, updater_node, "updates-slot", slot_node["id"], confidence=confidence)

    cost_slot_nodes = slot_nodes_by_role.get("cost", [])
    level_slot_nodes = slot_nodes_by_role.get("level", [])
    requirement_slot_nodes = slot_nodes_by_role.get("requirement", [])
    for field_name, field_node in field_node_ids.items():
        lowered = field_name.lower()
        if "cost" in lowered:
            for slot_node in cost_slot_nodes:
                confidence = "strong-bridge" if lowered.endswith("startcost") or lowered.endswith("additivecost") else "heuristic"
                add_edge(edges, edge_seen, field_node, "drives-slot", slot_node["id"], confidence=confidence)
        if "level" in lowered or "maxlevel" in lowered:
            for slot_node in level_slot_nodes:
                add_edge(edges, edge_seen, field_node, "bounds-slot", slot_node["id"], confidence="heuristic")
        if "bonus" in lowered:
            bonus_subsystem = subsystem_to_node.get("bonusGroups")
            if bonus_subsystem:
                add_edge(edges, edge_seen, field_node, "drives-subsystem", bonus_subsystem, confidence="heuristic")
        if "unlock" in lowered or "req" in lowered:
            for slot_node in requirement_slot_nodes:
                add_edge(edges, edge_seen, field_node, "drives-slot", slot_node["id"], confidence="heuristic")

    title_text = str(literal_text.get("title") or "").strip()
    if title_text:
        title_text_node = f"literal-text:title:{hashlib.md5(title_text.encode('utf-8')).hexdigest()[:10]}"
        add_node(nodes, node_seen, title_text_node, "literal-text", title_text, slotRole="title")
        for slot_node in slot_nodes_by_role.get("title", []):
            add_edge(edges, edge_seen, title_text_node, "fills-slot", slot_node["id"], confidence="strong-bridge")
    description_text = str(literal_text.get("description") or "").strip()
    if description_text:
        description_text_node = f"literal-text:description:{hashlib.md5(description_text.encode('utf-8')).hexdigest()[:10]}"
        add_node(nodes, node_seen, description_text_node, "literal-text", description_text, slotRole="description")
        for slot_node in slot_nodes_by_role.get("description", []):
            add_edge(edges, edge_seen, description_text_node, "fills-slot", slot_node["id"], confidence="strong-bridge")
    short_effect_text = str(literal_text.get("shortEffectLabel") or "").strip()
    if short_effect_text:
        short_effect_node = f"literal-text:short-effect:{hashlib.md5(short_effect_text.encode('utf-8')).hexdigest()[:10]}"
        add_node(nodes, node_seen, short_effect_node, "literal-text", short_effect_text, slotRole="description", presentationKind="short-effect")
        for slot_node in slot_nodes_by_role.get("description", []):
            slot_label = str(slot_node.get("label") or "")
            if "DescText" in slot_label:
                add_edge(edges, edge_seen, short_effect_node, "fills-slot", slot_node["id"], confidence="strong-bridge")
    bonus_label = str(literal_text.get("bonusLabel") or "").strip()
    if bonus_label:
        bonus_label_node = f"literal-text:bonus:{hashlib.md5(bonus_label.encode('utf-8')).hexdigest()[:10]}"
        add_node(nodes, node_seen, bonus_label_node, "literal-text", bonus_label, slotRole="bonus")
        bonus_subsystem = subsystem_to_node.get("bonusGroups")
        if bonus_subsystem:
            add_edge(edges, edge_seen, bonus_label_node, "fills-subsystem", bonus_subsystem, confidence="strong-bridge")

    return {
        "status": "derived-semantic-graph",
        "nodes": nodes,
        "edges": edges,
    }


def build_semantic_search_plan(semantic_graph: dict[str, Any]) -> dict[str, Any]:
    nodes = semantic_graph.get("nodes", []) or []
    edges = semantic_graph.get("edges", []) or []
    node_by_id = {node.get("id"): node for node in nodes if node.get("id")}
    verified_levels = {"verified", "strong-bridge"}

    required_gaps: list[dict[str, Any]] = []
    suggested_terms: list[str] = []

    updater_nodes = [node for node in nodes if node.get("type") == "updater"]
    slot_nodes = [node for node in nodes if node.get("type") == "ui-slot"]
    formula_fields = [node for node in nodes if node.get("type") == "field" and node.get("fieldKind") == "formula"]
    row_nodes = [node for node in nodes if node.get("type") == "row"]

    row_label = row_nodes[0].get("label") if row_nodes else "row"

    for slot in slot_nodes:
        slot_role = slot.get("slotRole")
        slot_id = slot.get("id")
        updater_edges = [edge for edge in edges if edge.get("type") == "updates-slot" and edge.get("target") == slot_id]
        strong_updater = any(str(edge.get("confidence") or "") in verified_levels for edge in updater_edges)
        if not strong_updater:
            required_gaps.append(
                {
                    "kind": "missing-verified-updater-edge",
                    "row": row_label,
                    "slotRole": slot_role,
                    "slotLabel": slot.get("label"),
                    "missingEdge": f"updater -> updates-slot -> {slot.get('label')}",
                    "candidateTerms": [
                        node.get("label")
                        for node in updater_nodes
                        if isinstance(node.get("label"), str)
                    ],
                }
            )
        if slot_role == "cost":
            driver_edges = [
                edge for edge in edges
                if edge.get("type") in {"drives-slot", "bounds-slot"} and edge.get("target") == slot_id
            ]
            strong_driver = any(str(edge.get("confidence") or "") in verified_levels for edge in driver_edges)
            if not strong_driver:
                required_gaps.append(
                    {
                        "kind": "missing-verified-field-driver",
                        "row": row_label,
                        "slotRole": slot_role,
                        "slotLabel": slot.get("label"),
                        "missingEdge": f"field -> drives-slot -> {slot.get('label')}",
                        "candidateTerms": [
                            node.get("label")
                            for node in formula_fields
                            if isinstance(node.get("label"), str)
                        ],
                    }
                )

    for field in formula_fields:
        field_id = field.get("id")
        has_value = any(edge.get("type") == "has-value" and edge.get("source") == field_id for edge in edges)
        if not has_value:
            required_gaps.append(
                {
                    "kind": "missing-raw-value",
                    "field": field.get("label"),
                    "missingEdge": f"{field.get('label')} -> has-value -> raw-value",
                }
            )

    title_or_desc_slots = [slot for slot in slot_nodes if slot.get("slotRole") in {"title", "description"}]
    for slot in title_or_desc_slots:
        slot_id = slot.get("id")
        strong_updater = any(
            edge.get("type") == "updates-slot"
            and edge.get("target") == slot_id
            and str(edge.get("confidence") or "") in verified_levels
            for edge in edges
        )
        if not strong_updater:
            required_gaps.append(
                {
                    "kind": "missing-final-rendered-text-path",
                    "row": row_label,
                    "slotRole": slot.get("slotRole"),
                    "slotLabel": slot.get("label"),
                    "missingEdge": f"verified updater -> updates-slot -> {slot.get('label')}",
                    "candidateTerms": [
                        node.get("label")
                        for node in updater_nodes
                        if isinstance(node.get("label"), str) and "Text" in str(node.get("label"))
                    ],
                }
            )

    for updater in updater_nodes:
        label = str(updater.get("label") or "")
        if label and label not in suggested_terms:
            suggested_terms.append(label)
    for field in formula_fields:
        label = str(field.get("label") or "")
        if label and label not in suggested_terms:
            suggested_terms.append(label)
    for gap in required_gaps:
        for candidate in gap.get("candidateTerms", []) or []:
            if isinstance(candidate, str) and candidate not in suggested_terms:
                suggested_terms.append(candidate)

    return {
        "status": "graph-gap-driven",
        "requiredGaps": required_gaps,
        "suggestedTerms": suggested_terms[:12],
    }


def build_row_closure_status(row_recovery: dict[str, Any]) -> dict[str, Any]:
    semantic_plan = row_recovery.get("semanticSearchPlan", {}) or {}
    required_gaps = semantic_plan.get("requiredGaps", []) or []
    direct_text_candidates = row_recovery.get("textCandidates", []) or []
    detached_text_candidates = row_recovery.get("detachedTextCandidates", []) or []
    presentation_update = row_recovery.get("presentationUpdatePath", {}) or {}
    formula_reconstruction = row_recovery.get("formulaReconstruction", {}) or {}
    fast_buy_recovery = row_recovery.get("fastBuyRecovery", {}) or {}
    title_slots = (presentation_update.get("slots", {}) or {}).get("title", []) or []
    description_slots = (presentation_update.get("slots", {}) or {}).get("description", []) or []

    def looks_like_slot_label(value: str) -> bool:
        if re.fullmatch(r"[A-Za-z0-9_]+ \([a-z]+\)", value):
            return True
        if re.fullmatch(r"[A-Za-z0-9_]+", value):
            return True
        return False

    literal_title_resolved = any(
        isinstance(value, str)
        and not looks_like_slot_label(value)
        and (" " in value or ":" in value)
        for value in direct_text_candidates
    )
    literal_description_resolved = any(
        isinstance(value, str)
        and not looks_like_slot_label(value)
        and (" " in value or ":" in value)
        for value in direct_text_candidates
    )
    semantic_closed = len(required_gaps) == 0
    unresolved_literals: list[str] = []
    unresolved_runtime_targets: list[str] = []
    if title_slots and not literal_title_resolved:
        unresolved_literals.append("final-title-string")
    if description_slots and not literal_description_resolved:
        unresolved_literals.append("final-description-string")
    runtime_cost_model = formula_reconstruction.get("runtimeCostModel") or {}
    if str(runtime_cost_model.get("status") or "") == "unresolved-runtime-modifiers":
        if str(fast_buy_recovery.get("status") or "") == "fast-buy-candidates-recovered":
            unresolved_runtime_targets.append("displayed-cost-fast-buy-or-runtime-modifiers")
        else:
            unresolved_runtime_targets.append("displayed-cost-runtime-modifiers")
    if semantic_closed and unresolved_runtime_targets and unresolved_literals:
        closure_status = "semantic-closed-runtime-open-literal-open"
    elif semantic_closed and unresolved_runtime_targets:
        closure_status = "semantic-closed-runtime-open"
    elif semantic_closed and unresolved_literals:
        closure_status = "semantic-closed-literal-open"
    elif semantic_closed:
        closure_status = "fully-closed"
    else:
        closure_status = "semantic-open"

    return {
        "semanticStatus": "closed" if semantic_closed else "open",
        "literalStatus": "open" if unresolved_literals else "closed",
        "runtimeStatus": "open" if unresolved_runtime_targets else "closed",
        "literalSchemaStatus": "compatibility-carried",
        "status": closure_status,
        "requiredSemanticGaps": required_gaps,
        "unresolvedLiteralTargets": unresolved_literals,
        "unresolvedRuntimeTargets": unresolved_runtime_targets,
        "directTextCandidates": direct_text_candidates,
        "detachedTextCandidates": detached_text_candidates,
    }


def build_token_shop_row_layout_explanation(row_recovery: dict[str, Any]) -> dict[str, Any]:
    presentation_update = row_recovery.get("presentationUpdatePath", {}) or {}
    direct_text_candidates = [str(value).strip() for value in (row_recovery.get("textCandidates") or []) if str(value).strip()]
    selected_primary = ((presentation_update.get("structureSummary") or {}).get("selectedPrimaryStructure") or {})
    slots = presentation_update.get("slots", {}) or {}
    formula_reconstruction = row_recovery.get("formulaReconstruction", {}) or {}

    def summarize_slot(role: str, preferred_name: str | None = None) -> dict[str, Any] | None:
        entries = list(slots.get(role, []) or [])
        if preferred_name:
            preferred = next((entry for entry in entries if str(entry.get("name") or "") == preferred_name), None)
            if preferred:
                return preferred
        return entries[0] if entries else None

    title_slot = summarize_slot("title", "TokenUPGTitleText_TMPro")
    short_effect_slot = next(
        (entry for entry in (slots.get("description", []) or []) if str(entry.get("name") or "") == "DescText"),
        None,
    )
    long_description_slot = summarize_slot("description", "TokenDescText_TMPro")
    cost_slot = summarize_slot("cost", "CostText")
    level_slot = summarize_slot("level", "LevelText")
    requirement_slot = summarize_slot("requirement", "ReqText")
    progress_indicator = selected_primary.get("progressIndicators")
    bonus_group = selected_primary.get("bonusGroups")
    readable_candidates = [value for value in direct_text_candidates if " " in value or ":" in value]
    title_text = readable_candidates[0] if readable_candidates else None
    long_description_text = readable_candidates[1] if len(readable_candidates) > 1 else None
    short_effect_text = next((value for value in readable_candidates if "x" in value or "gained" in value.lower()), None)
    bonus_label = next((value for value in readable_candidates if "bonus" in value.lower()), None)

    return {
        "status": "row-layout-recovered",
        "titleLine": {
            "text": title_text,
            "slot": title_slot,
            "explanation": "Top title strip for the upgrade card.",
        },
        "shortEffectLine": {
            "text": short_effect_text,
            "slot": short_effect_slot,
            "explanation": "Compact effect line rendered inside the main button area.",
        },
        "longDescriptionLine": {
            "text": long_description_text,
            "slot": long_description_slot,
            "explanation": "Longer description surface preserved in the description subtree.",
        },
        "buyCostDisplay": {
            "slot": cost_slot,
            "formula": (formula_reconstruction.get("inferredCostModel") or {}).get("expression"),
            "runtimeFormula": (formula_reconstruction.get("runtimeCostModel") or {}).get("expression"),
            "explanation": "BUY button cost slot. Base row formula is grounded; live displayed cost can still include unresolved runtime modifiers.",
        },
        "levelDisplay": {
            "slot": level_slot,
            "progressIndicator": progress_indicator,
            "explanation": "Circular progress area showing current level/fill state.",
        },
        "requirementDisplay": {
            "slot": requirement_slot,
            "explanation": "Overlay-side requirement or unlock text.",
        },
        "bonusDisplay": {
            "subsystem": bonus_group,
            "label": bonus_label,
            "explanation": "Bonus-layout subsystem for extra output or bonus labels.",
        },
        "unresolvedDisplayValues": [
            "current live displayed cost after runtime modifiers",
            "current live output/preview value shown in the lower panel",
        ],
    }


def build_token_shop_runtime_evaluator_recovery(
    literal_schema_recovery: dict[str, Any] | None,
    formula_reconstruction: dict[str, Any] | None,
) -> dict[str, Any]:
    literal_schema_recovery = literal_schema_recovery or {}
    formula_reconstruction = formula_reconstruction or {}
    schema_results = literal_schema_recovery.get("schemaResults", []) or []
    result_by_term = {
        str(entry.get("term")): entry
        for entry in schema_results
        if entry.get("term")
    }
    relevant_terms = [
        "SetCostRelatedAttributes",
        "CalculateAndSetUpgradeCalculations",
        "get_cost",
        "get_costExponent",
        "get_finalSetValue",
        "FinalSetValue",
        "CalculationType",
        "CostExponent",
    ]
    matched_terms = [term for term in relevant_terms if term in result_by_term]
    direct_runtime_terms = [
        term for term in matched_terms
        if term in {"CreateUpgradeClass", "CalculateAndSetUpgradeCalculations", "SetCostRelatedAttributes", "get_cost", "get_costExponent", "get_finalSetValue", "CostExponent", "CalculationType", "FinalSetValue"}
    ]
    context_strings: list[str] = []
    for term in matched_terms:
        context_strings.extend((result_by_term.get(term, {}).get("rawBridgeExpansion") or {}).get("contextStrings", []))
    context_strings = unique_strings(context_strings)
    backing_fields = [
        value for value in context_strings
        if value.startswith("<") and value.endswith(">k__BackingField")
    ]
    owner_cost_schema = formula_reconstruction.get("ownerCostSchema") or {}
    runtime_cost_model = formula_reconstruction.get("runtimeCostModel") or {}
    return {
        "status": (
            "method-chain-recovered-instance-values-open"
            if str(runtime_cost_model.get("status") or "") == "unresolved-runtime-modifiers"
            else "method-chain-recovered"
        ),
        "owner": owner_cost_schema.get("owner") or "ArcadeUpgradeSO",
        "evaluatorMethods": [
            method for method in [
                "get_cost",
                "get_costExponent",
                "get_finalSetValue",
                "CalculateAndSetUpgradeCalculations",
                "SetCostRelatedAttributes",
                "BuyAndApplyUpgrade",
            ]
            if method in (owner_cost_schema.get("methods") or []) or method in matched_terms
        ],
        "evaluatorFields": [
            field for field in [
                "baseCost",
                "additiveIncrease",
                "costExponent",
                "calculationType",
                "finalSetValue",
                "output",
                "maxLevel",
            ]
            if field in (owner_cost_schema.get("fields") or [])
        ],
        "backingFields": backing_fields,
        "likelyRuntimeChain": [
            "ArcadeUpgradeSO",
            "get_cost / get_costExponent / get_finalSetValue",
            "CalculateAndSetUpgradeCalculations",
            "SetCostRelatedAttributes",
            "CostText",
        ],
        "matchedSchemaTerms": matched_terms,
        "directRuntimeTerms": direct_runtime_terms,
        "unresolvedInstanceValues": [
            "costExponent instance value for the ATU4 upgrade object",
            "calculationType instance value for the ATU4 upgrade object",
            "finalSetValue instance value for the ATU4 upgrade object",
            "exact displayed-cost evaluator expression",
        ] if str(runtime_cost_model.get("status") or "") == "unresolved-runtime-modifiers" else [],
        "notes": [
            "The runtime cost lane is now traced to the ArcadeUpgradeSO evaluator family rather than another serialized TokenShop row block.",
            "Metadata neighborhoods preserve evaluator methods, backing-field names, and the SetCostRelatedAttributes/CalculateAndSetUpgradeCalculations chain.",
            "The remaining gap is the ATU4 instance-side values feeding that evaluator chain, not the existence of the chain itself.",
        ],
    }


def build_token_shop_runtime_instance_recovery(
    literal_schema_recovery: dict[str, Any] | None,
) -> dict[str, Any]:
    literal_schema_recovery = literal_schema_recovery or {}
    schema_results = literal_schema_recovery.get("schemaResults", []) or []
    result_by_term = {
        str(entry.get("term")): entry
        for entry in schema_results
        if entry.get("term")
    }
    create_upgrade = result_by_term.get("CreateUpgradeClass") or {}
    cost_attrs = result_by_term.get("SetCostRelatedAttributes") or {}
    get_cost_exponent = result_by_term.get("get_costExponent") or {}

    context_strings = unique_strings(
        [
            *((create_upgrade.get("rawBridgeExpansion") or {}).get("contextStrings") or []),
            *((cost_attrs.get("rawBridgeExpansion") or {}).get("contextStrings") or []),
            *((get_cost_exponent.get("rawBridgeExpansion") or {}).get("contextStrings") or []),
        ]
    )
    ui_binding_arrays = [
        value for value in context_strings
        if value in {
            "upgradeGOInstances",
            "contentBlocks",
            "nameTexts",
            "descriptionsTexts",
            "levelTexts",
            "costTexts",
            "upgradeIcon1",
            "upgradeIcon2",
            "buyButtons",
            "buyAnims",
            "maxedOverlays",
        }
    ]
    instance_fields = [
        value for value in context_strings
        if value in {
            "index",
            "level",
            "cost",
            "costExponent",
            "additiveIncrease",
            "calculationsType",
            "finalSetValue",
            "output",
            "maxLevel",
            "requirementMet",
            "isUnlocked",
            "upgradeName",
            "description",
        }
    ]
    instance_accessors = [
        value for value in context_strings
        if value in {
            "get_index",
            "set_index",
            "get_level",
            "set_level",
            "get_upgradeName",
            "set_upgradeName",
            "get_description",
            "set_description",
            "get_cost",
            "set_cost",
            "get_costExponent",
            "set_costExponent",
            "get_additiveIncrease",
            "set_additiveIncrease",
            "get_calculationsType",
            "set_calculationsType",
            "get_output",
            "set_output",
            "get_maxLevel",
            "set_maxLevel",
            "get_finalSetValue",
            "set_finalSetValue",
        }
    ]
    instance_owner = "Upgrade" if "Upgrade" in context_strings else None
    selection_key = "currentIndex" if "currentIndex" in context_strings else None
    return {
        "status": (
            "instance-layer-recovered-values-open"
            if instance_owner
            else "instance-layer-unresolved"
        ),
        "instanceOwner": instance_owner,
        "selectionKey": selection_key,
        "creationMethod": "CreateUpgradeClass" if create_upgrade else None,
        "uiBindingArrays": ui_binding_arrays,
        "instanceFields": instance_fields,
        "instanceAccessors": instance_accessors,
        "likelyInstanceChain": [
            "CreateUpgradeClass",
            "Upgrade",
            "currentIndex",
            "SetCostRelatedAttributes",
            "costTexts / CostText",
        ] if instance_owner else [],
        "notes": [
            "The runtime lane now distinguishes the per-row Upgrade instance layer from the static ArcadeUpgradeSO schema.",
            "SetCostRelatedAttributes context preserves currentIndex plus the level/cost/calculationsType/finalSetValue field family.",
            "get_costExponent context preserves the TokenShop-side UI binding arrays and the Upgrade accessor family.",
            "The remaining gap is the ATU4 instance values and any player-state/global modifier inputs, not the identity of the instance layer.",
        ],
    }


def build_token_shop_fast_buy_recovery(
    formula_reconstruction: dict[str, Any] | None,
) -> dict[str, Any]:
    formula_reconstruction = formula_reconstruction or {}
    grounded = formula_reconstruction.get("groundedConstants") or {}
    start_cost = grounded.get("StartCost")
    additive_cost = grounded.get("AdditiveCost")
    sample_level = 2200
    sample_display_cost = 176400
    base_cost_at_sample_level = None
    if isinstance(start_cost, (int, float)) and isinstance(additive_cost, (int, float)):
        base_cost_at_sample_level = float(start_cost) + float(additive_cost) * sample_level
    sample_ratio = None
    inferred_purchase_factor = None
    if base_cost_at_sample_level:
        sample_ratio = sample_display_cost / base_cost_at_sample_level
        rounded_ratio = round(sample_ratio)
        if abs(sample_ratio - rounded_ratio) < 1e-9 and rounded_ratio > 1:
            inferred_purchase_factor = int(rounded_ratio)

    search_index = get_unity_search_index().get("level0", [])
    fast_buy_objects: list[dict[str, Any]] = []
    bulk_buy_objects: list[dict[str, Any]] = []
    for entry in search_index:
        name_match = next(
            (
                str(surface.get("surfaceValue") or "")
                for surface in entry.get("surfaces", []) or []
                if str(surface.get("surfaceType") or "") == "object-name"
            ),
            "",
        )
        if not name_match:
            continue
        if "FastBuyButton" in name_match:
            path_id = int(entry.get("pathId"))
            fast_buy_objects.append(
                {
                    "pathId": path_id,
                    "name": name_match,
                    "hierarchyPath": build_unity_gameobject_hierarchy_path(path_id, source_asset_name="level0"),
                }
            )
        if "BulkBuyButton" in name_match:
            path_id = int(entry.get("pathId"))
            bulk_buy_objects.append(
                {
                    "pathId": path_id,
                    "name": name_match,
                    "hierarchyPath": build_unity_gameobject_hierarchy_path(path_id, source_asset_name="level0"),
                }
            )

    raw_entries = get_unity_raw_string_index().get("level0", [])
    raw_string_hits = [
        entry["value"]
        for entry in raw_entries
        if isinstance(entry.get("value"), str)
        and entry["value"] in {
            "BUY x10",
            "MaxOverlay.FastBuyButton",
            "FastBuyButtonMethodGear",
            "FastBuyButtonMethodShards",
            "StartFastBuyButtonHold",
            "AttachFastBuyButton",
        }
    ]

    cached = find_cached_native_trace(["StartFastBuyButtonHold"], family_hint=None)
    bridge = ((cached.get("result") or {}).get("termBridges") or {}).get("StartFastBuyButtonHold", {}) if cached else {}
    search_expansion = (bridge.get("searchExpansion") or {}) if bridge else {}

    return {
        "status": "fast-buy-candidates-recovered" if (fast_buy_objects or cached) else "fast-buy-candidates-unresolved",
        "fastBuyObjects": fast_buy_objects,
        "bulkBuyObjects": bulk_buy_objects,
        "rawStringHits": unique_strings(raw_string_hits),
        "nativeTerms": {
            "ownerCandidates": unique_strings(search_expansion.get("ownerCandidates", []) or []),
            "methodCandidates": unique_strings(search_expansion.get("methodCandidates", []) or []),
            "fieldCandidates": unique_strings(search_expansion.get("fieldCandidates", []) or []),
            "contextStrings": unique_strings(search_expansion.get("contextStrings", []) or []),
            "jobId": cached.get("jobId") if cached else None,
        },
        "sampleRuntimeCheck": {
            "sampleLevel": sample_level,
            "baseCostAtSampleLevel": base_cost_at_sample_level,
            "sampleDisplayedCost": sample_display_cost,
            "sampleDisplayToBaseRatio": sample_ratio,
            "inferredPurchaseFactor": inferred_purchase_factor,
            "note": (
                "Using the provided ATU4 screenshot level/cost, the displayed BUY cost is exactly 40x the recovered base row cost."
                if inferred_purchase_factor
                else "Using the provided ATU4 screenshot level/cost, the displayed BUY cost exceeds the recovered base row cost."
            ),
        } if sample_ratio is not None else None,
                    "notes": [
                        "Fast-buy controls are recoverable directly from level0 object hierarchies and raw level0 strings.",
                        "The strongest direct asset-side fast-buy evidence is MaxOverlay.FastBuyButton plus StartFastBuyButtonHold/AttachFastBuyButton string neighborhoods.",
                        "Recovered MaxOverlay.FastBuyButton variants include Button and ButtonWithHold components, which makes hold-repeat or quantity-multiplied buying a plausible runtime explanation for the exact 40x sample ratio.",
                        "Current direct asset evidence does not tie a FastBuyButton node into the ATU4 prefab subtree itself, so this lane is still a menu-level runtime candidate rather than a verified ATU4-local control.",
                        "The exact 40x screenshot ratio makes fast-buy quantity or hold-repeat state a stronger runtime-cost suspect than the weaker TotalSetMPBonus lane by itself.",
                    ],
                }


def build_token_shop_global_modifier_recovery(
    formula_reconstruction: dict[str, Any] | None,
) -> dict[str, Any]:
    formula_reconstruction = formula_reconstruction or {}
    grounded = formula_reconstruction.get("groundedConstants") or {}
    start_cost = grounded.get("StartCost")
    additive_cost = grounded.get("AdditiveCost")
    sample_level = 2200
    sample_display_cost = 176400
    base_cost_at_sample_level = None
    if isinstance(start_cost, (int, float)) and isinstance(additive_cost, (int, float)):
        base_cost_at_sample_level = float(start_cost) + float(additive_cost) * sample_level
    sample_ratio = None
    if base_cost_at_sample_level:
        sample_ratio = sample_display_cost / base_cost_at_sample_level

    cached_terms: dict[str, dict[str, Any]] = {}
    for term in ("FinalUltimaMP", "get_FinalUltimaMP", "TotalSetMPBonus", "get_TotalSetMPBonus"):
        cached = find_cached_native_trace([term], family_hint=None)
        if cached:
            cached_terms[term] = cached

    recovered_methods: list[str] = []
    recovered_fields: list[str] = []
    owner_candidates: list[str] = []
    context_strings: list[str] = []
    for term, cached in cached_terms.items():
        summary = cached.get("summary") or {}
        recovered_methods.extend(summary.get("reconstructedMethods", []) or [])
        recovered_fields.extend(summary.get("reconstructedFields", []) or [])
        owner_candidates.extend(summary.get("reconstructedOwners", []) or [])
        for owner in (summary.get("ownerToTerms") or {}).keys():
            owner_candidates.append(str(owner))
        bridge = ((cached.get("result") or {}).get("termBridges") or {}).get(term, {}) or {}
        context_strings.extend((bridge.get("searchExpansion") or {}).get("contextStrings", []) or [])
        owner_candidates.extend(bridge.get("ownerCandidates", []) or [])

    recovered_methods = unique_strings(recovered_methods)
    recovered_fields = unique_strings(recovered_fields)
    owner_candidates = unique_strings(owner_candidates)
    context_strings = unique_strings(context_strings)
    return {
        "status": "global-modifier-candidates-recovered" if cached_terms else "global-modifier-candidates-unresolved",
        "candidateTerms": list(cached_terms.keys()),
        "candidateOwners": owner_candidates,
        "candidateMethods": recovered_methods,
        "candidateFields": recovered_fields,
        "contextStrings": context_strings,
        "sampleRuntimeCheck": {
            "sampleLevel": sample_level,
            "baseCostAtSampleLevel": base_cost_at_sample_level,
            "sampleDisplayedCost": sample_display_cost,
            "sampleDisplayToBaseRatio": sample_ratio,
            "note": "Using the provided ATU4 screenshot level/cost, the displayed BUY cost is exactly 40x the recovered base row cost.",
        } if sample_ratio is not None else None,
        "notes": [
            "This lane captures global or set-wide MP modifiers that may sit on top of the per-row Upgrade evaluator.",
            "FinalUltimaMP and TotalSetMPBonus both survive as direct metadata/native-facing terms.",
            "These candidates do not prove the exact ATU4 displayed-cost formula yet, but they are now explicit runtime-side suspects rather than detached observations.",
        ],
    }


ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")
NUMERIC_RE = re.compile(r"^\d+$")
METHOD_RE = re.compile(r"^(?:get_|set_|Buy|Claim|Check|Start|Stop|Set|Fill|Open|Close|Display|Convert|Attach|Initialize|Update|On)[A-Za-z0-9_<>]+$")
CLASSLIKE_RE = re.compile(r"^[A-Z][A-Za-z0-9_<>]+$")

CANONICAL_SOURCE_PATHS = {
    "metadata": METADATA_PATH,
    "level0": ROOT / "workbench" / "unity" / "joined" / "level0",
    "native": ROOT / "workbench" / "apk" / "base" / "libil2cpp.so",
}

ASSET_SOURCE_MEMBER_PATHS = {
    "sharedassets0": ROOT / "workbench" / "unity" / "joined" / "sharedassets0.assets",
    "globalgamemanagers": ROOT / "workbench" / "unity" / "joined" / "globalgamemanagers.assets",
}

SUPPORT_DATASET_PATHS = {
    "tokenShopExtract": ROOT / "data" / "archive" / "token-shop-values.json",
    "tokenShopRowRemapBoundary": ROOT / "data" / "token-shop-row-remap-boundary.json",
    "tokenShopLateAtuBoundary": ROOT / "data" / "token-shop-late-atu-boundary.json",
    "shardCostFormulaModel": ROOT / "data" / "shard-cost-formula-model.v1.json",
    "multiverseMarketMemberBoundary": ROOT / "data" / "multiverse-market-market-member-boundary.json",
    "multiverseMarketSaveDataImportBoundary": ROOT / "data" / "multiverse-market-savedata-import-boundary.json",
    "multiverseMarketRangeBoundary": ROOT / "data" / "multiverse-market-range-boundary.json",
}

SOURCE_REFERENCE_PATHS = {
    **CANONICAL_SOURCE_PATHS,
    **ASSET_SOURCE_MEMBER_PATHS,
    **SUPPORT_DATASET_PATHS,
}

CANONICAL_SOURCE_ROLE_TEXT = {
    "metadata": "Primary raw declaration-side source from global-metadata.dat.",
    "level0": "Primary direct Unity scene/object extraction from level0.",
    "assets": "Primary shared Unity assets family spanning sharedassets0 and globalgamemanagers.",
    "native": "Primary native executable source from libil2cpp.so via DB-backed native extraction.",
}

ASSET_SOURCE_MEMBERS = tuple(ASSET_SOURCE_MEMBER_PATHS.keys())
CANONICAL_SOURCE_IDS = ("metadata", "level0", "assets", "native")


def get_source_reference(source_id: str) -> str:
    if source_id == "assets":
        return " + ".join(repo_relative(path) for path in ASSET_SOURCE_MEMBER_PATHS.values())
    if source_id == "tokenShopExtract":
        return f"{repo_relative(METADATA_PATH)} + {repo_relative(CANONICAL_SOURCE_PATHS['level0'])}"
    path = SOURCE_REFERENCE_PATHS.get(source_id)
    if path is None:
        raise KeyError(f"Unknown source id: {source_id}")
    return repo_relative(path)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


RUNTIME_SOURCE_FAMILIES = {
    source_id: {
        "label": source_id,
        "sourceIds": [source_id],
    }
    for source_id in CANONICAL_SOURCE_IDS
}


def build_runtime_trace_catalog() -> dict[str, Any]:
    targets: dict[str, Any] = {}
    resolver_targets = {
        str(row.get("traceScope") or ""): dict(row.get("payload") or {})
        for row in get_trace_db().list_materialized_resolver_target_views("cifi-full", "libil2cpp.so")
        if str(row.get("traceScope") or "").strip()
    }
    for row in _latest_materialized_target_payloads():
        payload = dict(row.get("payload") or {})
        target = dict(payload.get("target") or {})
        target_id = str(target.get("id") or row.get("traceScope") or "").strip()
        if not target_id:
            continue
        resolver_payload = dict(resolver_targets.get(target_id) or {})
        merged_target = dict(target)
        merged_target["id"] = target_id
        merged_target.setdefault("label", target_id)
        merged_target["familyId"] = str(merged_target.get("familyId") or "").strip() or _infer_runtime_family_id(
            target_id,
            row.get("traceScope"),
            resolver_payload.get("traceScope"),
            resolver_payload.get("subjectId"),
        )
        merged_target.setdefault("requiredSourceFamilies", list(CANONICAL_SOURCE_IDS))
        merged_target.setdefault("defaultAnchors", list(resolver_payload.get("anchorTerms") or []))
        merged_target.setdefault("acceptedAnchors", list(resolver_payload.get("acceptedAnchors") or target.get("acceptedAnchors") or []))
        if resolver_payload.get("outputSummaryRules"):
            merged_target["outputSummaryRules"] = dict(resolver_payload.get("outputSummaryRules") or {})
        targets[target_id] = merged_target

    for target_id, resolver_payload in resolver_targets.items():
        if target_id in targets:
            continue
        execution_context = get_trace_db().find_or_synthesize_execution_context(
            "cifi-full",
            "libil2cpp.so",
            target_id,
            compatibility_target_id=target_id,
        )
        family_id = str(execution_context.get("familyId") or "").strip() or _infer_runtime_family_id(
            target_id,
            execution_context.get("traceScope"),
            execution_context.get("targetId"),
        )
        if not family_id:
            continue
        targets[target_id] = {
            "id": target_id,
            "label": str(execution_context.get("label") or target_id),
            "familyId": family_id,
            "acceptedAnchors": list(resolver_payload.get("acceptedAnchors") or execution_context.get("acceptedAnchors") or []),
            "joinGoal": execution_context.get("joinGoal"),
            "outputSummaryRules": resolver_payload.get("outputSummaryRules") or execution_context.get("outputSummaryRules"),
            "requiredSourceFamilies": list(CANONICAL_SOURCE_IDS),
            "defaultAnchors": list(resolver_payload.get("anchorTerms") or []),
            "solvedBaselineTargetId": execution_context.get("solvedBaselineTargetId"),
            "blockedTargetId": execution_context.get("blockedTargetId"),
        }

    planner_families: dict[str, Any] = {}
    for family_id, label in FAMILY_GRAPH_LABELS.items():
        planner_families[family_id] = {
            "label": label,
            "anchorExpansionTerms": [],
            "synonymSets": {},
        }

    return {
        "dataset": "unity-trace-runtime-catalog",
        "targets": targets,
        "planner": {"families": planner_families},
        "sourceFamilies": dict(RUNTIME_SOURCE_FAMILIES),
        "comparisonPresets": {},
    }


def load_request_catalog() -> dict[str, Any]:
    return build_runtime_trace_catalog()


def normalize_planner_term(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def unique_strings(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        trimmed = value.strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        output.append(trimmed)
    return output


def infer_anchor_kind(value: str) -> str:
    if NUMERIC_RE.fullmatch(value):
        return "path id"
    if METHOD_RE.fullmatch(value) or (value.startswith("<") and ">" in value):
        return "method"
    if CLASSLIKE_RE.fullmatch(value):
        return "class"
    return "string"


def build_anchor_specs(values: list[str], origin: str) -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for value in values:
        trimmed = value.strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        specs.append(
            {
                "value": trimmed,
                "kind": infer_anchor_kind(trimmed),
                "origin": origin,
            }
        )
    return specs


def get_signal_tier(score: int) -> str:
    if score >= 100:
        return "high-signal"
    if score >= 65:
        return "supporting"
    return "incidental"


def get_source_search_modes(source_id: str) -> list[str]:
    return ["exact-structured"] if source_id != "metadata" else ["exact-string", "bounded-containment"]


def canonicalize_source_family_id(source_id: str) -> str:
    if source_id in CANONICAL_SOURCE_IDS:
        return source_id
    if source_id in ASSET_SOURCE_MEMBER_PATHS:
        return "assets"
    return source_id


def is_obvious_noise(value: str) -> list[str]:
    lower_value = value.lower()
    flags: list[str] = []
    if "publickey=" in lower_value:
        flags.append("assembly-public-key-blob")
    if "begin certificate" in lower_value or "end certificate" in lower_value:
        flags.append("certificate-blob")
    if len(value) >= 280:
        flags.append("long-string-blob")
    return flags


def format_signal_reason(match_mode: str, source_id: str, matched_anchor_values: list[str], noise_flags: list[str], local_signal: str | None = None) -> str:
    anchor_label = ", ".join(matched_anchor_values)
    parts = [f"{match_mode} match on {anchor_label} via {source_id}"]
    if local_signal:
        parts.append(local_signal)
    if noise_flags:
        parts.append(f"noise flags: {', '.join(noise_flags)}")
    return "; ".join(parts)


def format_anchor_specs(anchor_specs: list[dict[str, Any]]) -> str:
    return ", ".join(f"{item['value']} ({item['kind']})" for item in anchor_specs)


def _apply_db_execution_plan(target: dict[str, Any], execution_trace_scope: str) -> tuple[dict[str, Any], dict[str, Any]]:
    execution_plan = load_canonical_execution_plan(execution_trace_scope)
    if not execution_plan:
        return target, {}
    patched_target = dict(target)
    patched_target["executionPlan"] = execution_plan
    if execution_plan.get("joinGoal"):
        patched_target["joinGoal"] = str(execution_plan.get("joinGoal") or patched_target.get("joinGoal") or "")
    return patched_target, execution_plan


def _apply_db_execution_context(
    target: dict[str, Any],
    execution_trace_scope: str,
    planner_resolution: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    planner_resolution = dict(planner_resolution or {})
    execution_context = get_trace_db().find_or_synthesize_execution_context(
        "cifi-full",
        "libil2cpp.so",
        execution_trace_scope,
        subject_kind=str(planner_resolution.get("selectedSubjectKind") or ""),
        subject_key=str(planner_resolution.get("selectedSubjectKey") or ""),
        family_id=str(target.get("familyId") or ""),
        compatibility_target_id=str(target.get("id") or ""),
    )
    if not execution_context:
        return target, {}
    patched_target = dict(target)
    for key in (
        "label",
        "familyId",
        "joinGoal",
        "solvedBaselineTargetId",
        "blockedTargetId",
        "outputSummaryRules",
    ):
        value = execution_context.get(key)
        if value not in (None, "", []):
            patched_target[key] = value
    accepted_anchors = [str(value) for value in (execution_context.get("acceptedAnchors") or []) if str(value).strip()]
    if accepted_anchors:
        patched_target["acceptedAnchors"] = accepted_anchors
    return patched_target, execution_context
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
            if source_id == "assets":
                source_paths[source_id] = UNITY_JOINED_DIR
            else:
                source_paths[source_id] = CANONICAL_SOURCE_PATHS[source_id]
            source_roles.append(
                {
                    "sourceId": source_id,
                    "path": get_source_reference(source_id),
                    "familyId": family_id,
                    "familyLabel": family["label"],
                    "role": CANONICAL_SOURCE_ROLE_TEXT[source_id],
                }
            )
    return source_paths, source_roles


def resolve_source_catalog_from_projection(source_projection: dict[str, Any]) -> tuple[dict[str, Path], list[dict[str, Any]]]:
    source_paths: dict[str, Path] = {}
    source_roles: list[dict[str, Any]] = []
    families = dict(source_projection.get("families") or {})
    order = list(source_projection.get("order") or families.keys())
    seen: set[str] = set()
    for source_id in order:
        source_id = canonicalize_source_family_id(source_id)
        if not source_id or source_id in seen:
            continue
        seen.add(source_id)
        entry = dict(families.get(source_id) or {})
        if source_id == "assets":
            source_paths[source_id] = UNITY_JOINED_DIR
        elif source_id in CANONICAL_SOURCE_PATHS:
            source_paths[source_id] = CANONICAL_SOURCE_PATHS[source_id]
        else:
            continue
        source_roles.append(
            {
                "sourceId": source_id,
                "path": entry.get("reference") or get_source_reference(source_id),
                "familyId": entry.get("familyId"),
                "familyLabel": entry.get("familyLabel"),
                "role": entry.get("role") or CANONICAL_SOURCE_ROLE_TEXT.get(source_id),
            }
        )
    return source_paths, source_roles


def get_active_source_ids_for_target(target: dict[str, Any]) -> list[str]:
    active_ids: list[str] = []
    seen: set[str] = set()

    def add(source_id: str) -> None:
        source_id = canonicalize_source_family_id(source_id)
        if source_id not in seen:
            seen.add(source_id)
            active_ids.append(source_id)

    for source_id in collect_primary_source_ids_for_target(target):
        add(source_id)

    add("native")

    if not active_ids:
        return list(CANONICAL_SOURCE_IDS)
    return active_ids


def get_extended_source_ids_for_target(registry: dict[str, Any], target: dict[str, Any], extended_search: int) -> list[str]:
    active_ids = get_active_source_ids_for_target(target)
    if extended_search <= 0:
        return active_ids

    seen = set(active_ids)

    def add(source_id: str) -> None:
        if source_id not in seen:
            seen.add(source_id)
            active_ids.append(source_id)

    if extended_search >= 1:
        family_id = str(target["familyId"])
        for sibling in registry["targets"].values():
            if sibling.get("familyId") != family_id:
                continue
            for source_id in get_active_source_ids_for_target(sibling):
                add(source_id)

    if extended_search >= 2:
        for family in registry["sourceFamilies"].values():
            for source_id in family.get("sourceIds", []):
                add(source_id)

    return active_ids


def narrow_source_catalog(
    source_paths: dict[str, Path],
    source_roles: list[dict[str, Any]],
    active_source_ids: list[str],
) -> tuple[dict[str, Path], list[dict[str, Any]]]:
    active_set = set(active_source_ids)
    narrowed_paths = {source_id: path for source_id, path in source_paths.items() if source_id in active_set}
    narrowed_roles = [entry for entry in source_roles if entry["sourceId"] in active_set]
    return narrowed_paths, narrowed_roles


def get_extended_source_ids_for_projection(source_projection: dict[str, Any], extended_search: int) -> list[str]:
    ordered_ids = [
        canonicalize_source_family_id(source_id)
        for source_id in list(source_projection.get("order") or [])
        if canonicalize_source_family_id(source_id)
    ]
    active_ids = unique_strings(ordered_ids) or list(CANONICAL_SOURCE_IDS)
    if extended_search >= 2:
        for source_id in CANONICAL_SOURCE_IDS:
            if source_id not in active_ids:
                active_ids.append(source_id)
    return active_ids


def extract_strings(blob: bytes) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for match in ASCII_RE.finditer(blob):
        entries.append({"offset": match.start(), "encoding": "ascii", "value": match.group().decode("ascii", errors="ignore")})
    for match in UTF16_RE.finditer(blob):
        entries.append({"offset": match.start(), "encoding": "utf16le", "value": match.group().decode("utf-16le", errors="ignore")})
    return sorted(entries, key=lambda entry: int(entry["offset"]))


def get_metadata_string_entries() -> list[dict[str, Any]]:
    global METADATA_STRING_ENTRIES
    if METADATA_STRING_ENTRIES is None:
        METADATA_STRING_ENTRIES = extract_strings(METADATA_PATH.read_bytes())
    return METADATA_STRING_ENTRIES


def build_arcade_upgrade_owner_cost_schema() -> dict[str, Any]:
    entries = get_metadata_string_entries()
    values = [str(entry.get("value") or "") for entry in entries]
    try:
        owner_index = values.index("ArcadeUpgradeSO")
    except ValueError:
        return {
            "status": "owner-cost-schema-unavailable",
            "owner": "ArcadeUpgradeSO",
            "fields": [],
            "methods": [],
            "enumType": None,
            "calculationTypeOptions": [],
        }

    window = entries[max(0, owner_index - 16): owner_index + 80]
    window_values = [str(entry.get("value") or "") for entry in window]

    field_names = []
    for candidate in (
        "baseCost",
        "additiveIncrease",
        "costExponent",
        "calculationType",
        "output",
        "maxLevel",
        "finalSetValue",
    ):
        if candidate in window_values and candidate not in field_names:
            field_names.append(candidate)

    method_names = []
    for candidate in (
        "get_cost",
        "set_cost",
        "get_costExponent",
        "set_costExponent",
        "get_additiveIncrease",
        "set_additiveIncrease",
        "get_calculationsType",
        "set_calculationsType",
        "get_output",
        "set_output",
        "get_finalSetValue",
        "set_finalSetValue",
        "CalculateAndSetUpgradeCalculations",
        "SetCostRelatedAttributes",
        "BuyAndApplyUpgrade",
    ):
        if candidate in values and candidate not in method_names:
            method_names.append(candidate)

    enum_type = "ArcadeUpgradeCalculationType" if "ArcadeUpgradeCalculationType" in values else None
    enum_options = [
        candidate
        for candidate in ("percentage", "additive", "subtractive")
        if candidate in values
    ]

    return {
        "status": "owner-cost-schema-recovered",
        "owner": "ArcadeUpgradeSO",
        "fields": field_names,
        "methods": method_names,
        "enumType": enum_type,
        "calculationTypeOptions": enum_options,
        "evidenceWindow": window[:40],
    }


def build_token_shop_owner_blob_row(shell_path_id: int | None) -> dict[str, Any]:
    if shell_path_id is None:
        return {"status": "owner-blob-row-unavailable"}
    token_shop_component = None
    env = get_unity_env()
    for obj in env.objects:
        if getattr(getattr(obj, "assets_file", None), "name", "") != "level0":
            continue
        if obj.type.name != "MonoBehaviour":
            continue
        data = safe_unity_read(obj)
        if data is None or get_unity_script_name(data) != "TokenShop":
            continue
        token_shop_component = obj
        break
    if token_shop_component is None:
        return {"status": "owner-blob-row-unavailable", "reason": "TokenShop component not found in level0"}

    component_data = safe_unity_read(token_shop_component)
    reader = getattr(component_data, "object_reader", None) if component_data is not None else None
    if reader is None:
        return {"status": "owner-blob-row-unavailable", "reason": "TokenShop component has no readable object reader"}

    raw = reader.read_bytes(reader.byte_size)
    shell_bytes = int(shell_path_id).to_bytes(4, "little", signed=False)
    shell_offset = raw.find(shell_bytes)
    if shell_offset < 32:
        return {
            "status": "owner-blob-row-unavailable",
            "reason": "Shell path id not found inside TokenShop owner blob",
            "shellPathId": shell_path_id,
        }

    def read_u32(offset: int) -> int:
        return int.from_bytes(raw[offset:offset + 4], "little", signed=False)

    def read_f32(offset: int) -> float:
        return struct.unpack("<f", raw[offset:offset + 4])[0]

    def looks_like_row_shell(candidate_offset: int) -> bool:
        if candidate_offset < 32 or candidate_offset + 36 >= len(raw):
            return False
        candidate_shell = read_u32(candidate_offset)
        if not get_unity_gameobject_name(candidate_shell, "level0"):
            return False
        max_overlay = read_u32(candidate_offset + 12)
        content = read_u32(candidate_offset + 24)
        overlay = read_u32(candidate_offset + 36)
        return bool(
            get_unity_gameobject_name(max_overlay, "level0")
            and get_unity_gameobject_name(content, "level0")
            and get_unity_gameobject_name(overlay, "level0")
        )

    next_shell_offset = None
    for candidate_offset in range(shell_offset + 4, min(len(raw) - 40, shell_offset + 256), 4):
        if looks_like_row_shell(candidate_offset):
            next_shell_offset = candidate_offset
            break

    row_data_end_offset = shell_offset + 40
    next_row_preview_scalars: list[dict[str, Any]] = []
    if next_shell_offset is not None:
        for pos in range(row_data_end_offset, next_shell_offset, 4):
            value_u32 = read_u32(pos)
            value_f32 = read_f32(pos)
            if value_u32 == 0:
                continue
            next_row_preview_scalars.append(
                {
                    "relativeOffset": pos - shell_offset,
                    "u32": value_u32,
                    "f32": value_f32,
                }
            )

    return {
        "status": "owner-blob-row-recovered",
        "ownerComponent": {
            "script": "TokenShop",
            "componentPathId": int(token_shop_component.path_id),
            "gameObjectPathId": getattr(getattr(component_data, "m_GameObject", None), "path_id", None),
        },
        "shellPathId": int(shell_path_id),
        "shellOffset": shell_offset,
        "startCost": read_f32(shell_offset - 32),
        "additiveCost": read_f32(shell_offset - 28),
        "bonus": read_f32(shell_offset - 24),
        "maxLevel": read_u32(shell_offset - 20),
        "fillPathId": read_u32(shell_offset - 12),
        "maxOverlayPathId": read_u32(shell_offset + 12),
        "contentPathId": read_u32(shell_offset + 24),
        "overlayPathId": read_u32(shell_offset + 36),
        "rowDataEndRelativeOffset": 40,
        "nextRowShellOffset": next_shell_offset,
        "nextRowShellRelativeOffset": (next_shell_offset - shell_offset) if next_shell_offset is not None else None,
        "nextRowPreviewScalars": next_row_preview_scalars,
        "serializedRuntimeFieldsPresent": False,
        "notes": [
            "The direct TokenShop owner blob row is anchored on the shell path id and currently resolves StartCost/AdditiveCost/Bonus/MaxLevel plus fill/content/overlay bindings.",
            "The current row data ends after the overlay path block; any repeated scalar block before the next shell belongs to the next serialized row, not the current one.",
            "If calculationType/finalSetValue are not present inside this row window, they must be supplied later by the runtime Upgrade instance/evaluator path rather than a hidden TokenShop row field.",
        ],
    }


def build_token_shop_owner_modifier_scan(owner_blob_row: dict[str, Any] | None) -> dict[str, Any]:
    owner_blob_row = owner_blob_row or {}
    shell_path_id = owner_blob_row.get("shellPathId")
    content_path_id = owner_blob_row.get("contentPathId")
    overlay_path_id = owner_blob_row.get("overlayPathId")
    fill_path_id = owner_blob_row.get("fillPathId")
    if shell_path_id is None:
        return {"status": "owner-modifier-scan-unavailable", "reason": "owner blob row unavailable"}

    env = get_unity_env()
    component_names = {"ArcadeShop", "ArcadeManager"}
    component_scans: list[dict[str, Any]] = []
    int_targets = {
        "shellPathId": int(shell_path_id),
        "contentPathId": int(content_path_id) if content_path_id is not None else None,
        "overlayPathId": int(overlay_path_id) if overlay_path_id is not None else None,
        "fillPathId": int(fill_path_id) if fill_path_id is not None else None,
    }
    float_targets = {
        "startCost": owner_blob_row.get("startCost"),
        "additiveCost": owner_blob_row.get("additiveCost"),
        "bonus": owner_blob_row.get("bonus"),
    }
    for obj in env.objects:
        if getattr(getattr(obj, "assets_file", None), "name", "") != "level0":
            continue
        if obj.type.name != "MonoBehaviour":
            continue
        data = safe_unity_read(obj)
        script_name = get_unity_script_name(data) if data is not None else None
        if script_name not in component_names:
            continue
        reader = getattr(data, "object_reader", None) if data is not None else None
        if reader is None:
            continue
        raw = reader.read_bytes(reader.byte_size)
        int_hits: dict[str, int] = {}
        float_hits: dict[str, int] = {}
        for label, value in int_targets.items():
            if value is None:
                continue
            int_hits[label] = raw.find(int(value).to_bytes(4, "little", signed=False))
        for label, value in float_targets.items():
            if value is None:
                continue
            float_hits[label] = raw.find(struct.pack("<f", float(value)))
        aligned_int_hits = {label: offset for label, offset in int_hits.items() if offset >= 0 and offset % 4 == 0}
        aligned_float_hits = {label: offset for label, offset in float_hits.items() if offset >= 0 and offset % 4 == 0}
        component_scans.append(
            {
                "script": script_name,
                "componentPathId": int(obj.path_id),
                "byteSize": int(reader.byte_size),
                "intHits": int_hits,
                "floatHits": float_hits,
                "alignedIntHits": aligned_int_hits,
                "alignedFloatHits": aligned_float_hits,
                "matchedIntTargets": list(aligned_int_hits.keys()),
                "matchedFloatTargets": list(aligned_float_hits.keys()),
                "weakIncidentalTargets": [
                    label for label, offset in {**int_hits, **float_hits}.items()
                    if offset >= 0 and offset % 4 != 0
                ],
            }
        )

    matched_components = [
        entry for entry in component_scans
        if entry.get("matchedIntTargets") or entry.get("matchedFloatTargets")
    ]
    return {
        "status": "owner-modifier-scan-complete",
        "matchedComponents": matched_components,
        "scannedComponents": component_scans,
        "notes": [
            "This scan checks whether ATU4 row ids or grounded constants survive directly inside other level0 owner components.",
            "Only aligned hits count as direct serialized-owner evidence; unaligned float/string coincidences stay weak incidental evidence.",
            "If aligned row ids and grounded constants both stay absent here, runtime modifiers are more likely method-side than serialized beside the row.",
        ],
    }


def collect_metadata_hits(anchor_specs: list[dict[str, Any]], context: int = 8) -> tuple[list[dict[str, Any]], int]:
    entries = get_metadata_string_entries()
    hits: list[dict[str, Any]] = []
    executable_specs = [spec for spec in anchor_specs if spec["kind"] != "path id"]
    counts: dict[str, int] = {spec["value"]: 0 for spec in executable_specs}
    suppressed_count = 0
    for index, entry in enumerate(entries):
        value = str(entry["value"])
        matched_specs: list[dict[str, Any]] = []
        match_modes: list[str] = []
        for spec in executable_specs:
            anchor = spec["value"]
            if value == anchor:
                matched_specs.append(spec)
                match_modes.append("exact-string")
                continue
            if anchor.lower() in value.lower():
                matched_specs.append(spec)
                match_modes.append("bounded-containment")
        if not matched_specs:
            continue
        matched_anchor_values = [spec["value"] for spec in matched_specs]
        if all(counts[anchor] >= 4 for anchor in matched_anchor_values):
            continue
        noise_flags = is_obvious_noise(value)
        score = max(90 if mode == "exact-string" else 45 for mode in match_modes)
        if noise_flags:
            score -= 40
        if score < 20:
            suppressed_count += 1
            continue
        start = max(index - context, 0)
        end = min(index + context + 1, len(entries))
        hits.append(
            {
                "term": value,
                "matchedTerms": matched_anchor_values,
                "matchedAnchorKinds": unique_strings([spec["kind"] for spec in matched_specs]),
                "matchMode": "exact-string" if "exact-string" in match_modes else "bounded-containment",
                "offset": entry["offset"],
                "context": entries[start:end],
                "signalScore": score,
                "signalTier": get_signal_tier(score),
                "noiseFlags": noise_flags,
                "signalReason": format_signal_reason(
                    "exact-string" if "exact-string" in match_modes else "bounded-containment",
                    "metadata",
                    matched_anchor_values,
                    noise_flags,
                ),
            }
        )
        for matched_term in matched_anchor_values:
            counts[matched_term] += 1
        if all(count >= 4 for count in counts.values()):
            break
    hits.sort(key=lambda item: (-int(item["signalScore"]), int(item["offset"])))
    return hits, suppressed_count


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


def collect_exact_hits(document: Any, anchor_specs: list[dict[str, Any]], source_id: str, shell_window: dict[str, Any] | None, max_hits_per_term: int = 4) -> tuple[list[dict[str, Any]], int]:
    hits: list[dict[str, Any]] = []
    exact_terms = [spec["value"] for spec in anchor_specs]
    walk_json(document, [], None, None, set(exact_terms), hits)
    spec_by_value = {spec["value"]: spec for spec in anchor_specs}
    counts: dict[str, int] = {}
    filtered: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    suppressed_count = 0
    for hit in hits:
        identity = (hit["term"], hit["jsonPath"])
        if identity in seen:
            continue
        seen.add(identity)
        counts.setdefault(hit["term"], 0)
        if counts[hit["term"]] >= max_hits_per_term:
            continue
        spec = spec_by_value[hit["term"]]
        container_text = json.dumps(hit.get("containerSummary") or {}, sort_keys=True)
        shell_field = str(shell_window["shellField"]) if shell_window else None
        shell_path = str(shell_window["shellPathId"]) if shell_window else None
        owner_fields = set(shell_window["ownerFieldBlock"]) if shell_window else set()
        local_signal: str | None = None
        score = 85
        if spec["kind"] == "path id":
            score += 15
        if source_id == "tokenShopExtract":
            score += 25
        else:
            score += 10
        if shell_field and hit["term"] == shell_field:
            score += 25
            local_signal = "shell-local exact anchor"
        elif shell_path and hit["term"] == shell_path:
            score += 30
            local_signal = "shell-local path id"
        elif hit["term"] in owner_fields:
            score += 25
            local_signal = "owner-local exact field"
        elif shell_field and shell_field in container_text:
            score += 10
            local_signal = "container keeps shell anchor nearby"
        elif owner_fields and any(field in container_text for field in owner_fields):
            score += 10
            local_signal = "container keeps owner-local fields nearby"
        noise_flags = is_obvious_noise(hit["term"])
        if noise_flags:
            score -= 40
        if score < 20:
            suppressed_count += 1
            continue
        hit["matchedTerms"] = [spec["value"]]
        hit["matchedAnchorKinds"] = [spec["kind"]]
        hit["matchMode"] = "exact-structured"
        hit["signalScore"] = score
        hit["signalTier"] = get_signal_tier(score)
        hit["noiseFlags"] = noise_flags
        hit["signalReason"] = format_signal_reason("exact-structured", source_id, [spec["value"]], noise_flags, local_signal)
        counts[hit["term"]] += 1
        filtered.append(hit)
    filtered.sort(key=lambda item: (-int(item["signalScore"]), item["jsonPath"]))
    return filtered, suppressed_count


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
        "source": get_source_reference("tokenShopExtract"),
        "shellField": shell_entry.get("field"),
        "shellPathId": shell_entry.get("path_id"),
        "shellObjectOffset": shell_entry.get("object_offset"),
        "ownerFieldBlock": [entry.get("field") for entry in fields[max(0, shell_index - 5):shell_index]],
        "window": window,
    }


def collect_source_hits(documents: dict[str, Any], source_id: str, anchor_specs: list[dict[str, Any]], shell_window: dict[str, Any] | None = None) -> dict[str, Any]:
    if source_id == "metadata":
        hits, suppressed_count = collect_metadata_hits(anchor_specs)
        return {
            "sourceId": source_id,
            "sourcePath": get_source_reference(source_id),
            "searchModes": get_source_search_modes(source_id),
            "hitCount": len(hits),
            "highSignalHitCount": sum(1 for hit in hits if hit["signalTier"] == "high-signal"),
            "supportingHitCount": sum(1 for hit in hits if hit["signalTier"] == "supporting"),
            "incidentalHitCount": sum(1 for hit in hits if hit["signalTier"] == "incidental"),
            "suppressedNoiseCount": suppressed_count,
            "hits": hits,
        }
    if source_id in ("level0", "assets", *ASSET_SOURCE_MEMBERS):
        unity_source_ids = [source_id] if source_id != "assets" else list(ASSET_SOURCE_MEMBERS)
        hits: list[dict[str, Any]] = []
        suppressed_count = 0
        for unity_source_id in unity_source_ids:
            member_hits, member_suppressed = collect_unity_hits(unity_source_id, anchor_specs)
            hits.extend(member_hits)
            suppressed_count += member_suppressed
        return {
            "sourceId": source_id,
            "sourcePath": get_source_reference(source_id),
            "searchModes": ["object-name", "class-name", "component-type", "text-content"],
            "hitCount": len(hits),
            "highSignalHitCount": sum(1 for hit in hits if hit.get("signalTier") == "high-signal"),
            "supportingHitCount": sum(1 for hit in hits if hit.get("signalTier") == "supporting"),
            "incidentalHitCount": sum(1 for hit in hits if hit.get("signalTier") == "incidental"),
            "suppressedNoiseCount": suppressed_count,
            "hits": hits,
        }
    if source_id == "native":
        return {
            "sourceId": source_id,
            "sourcePath": get_source_reference(source_id),
            "searchModes": ["bridge-plan", "process-project", "db-materialized-native-trace"],
            "hitCount": 0,
            "highSignalHitCount": 0,
            "supportingHitCount": 0,
            "incidentalHitCount": 0,
            "suppressedNoiseCount": 0,
            "hits": [],
        }
    hits, suppressed_count = collect_exact_hits(documents[source_id], anchor_specs, source_id, shell_window)
    return {
        "sourceId": source_id,
        "sourcePath": get_source_reference(source_id),
        "searchModes": get_source_search_modes(source_id),
        "hitCount": len(hits),
        "highSignalHitCount": sum(1 for hit in hits if hit["signalTier"] == "high-signal"),
        "supportingHitCount": sum(1 for hit in hits if hit["signalTier"] == "supporting"),
        "incidentalHitCount": sum(1 for hit in hits if hit["signalTier"] == "incidental"),
        "suppressedNoiseCount": suppressed_count,
        "hits": hits,
    }


def collect_unity_hits(source_id: str, anchor_specs: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """Collect hits from Unity files using UnityPy"""
    hits: list[dict[str, Any]] = []
    suppressed_count = 0
    skip_raw_string_scan = bool(_get_active_trace_runtime_flag("skipUnityRawStringScan", False))
    exact_terms = {spec["value"] for spec in anchor_specs}
    spec_by_value = {spec["value"]: spec for spec in anchor_specs}

    for entry in get_unity_search_index().get(source_id, []):
        for surface in entry["surfaces"]:
            str_value = surface["surfaceValue"]
            for term in exact_terms:
                matched = False
                match_mode = ""
                if str_value == term:
                    matched = True
                    match_mode = "exact-string"
                elif term.lower() in str_value.lower():
                    matched = True
                    match_mode = "bounded-containment"

                if matched:
                    signal_tier = "high-signal" if match_mode == "exact-string" else "supporting"
                    hits.append({
                        "term": term,
                        "matchedValue": str_value[:200],
                        "surfaceType": surface["surfaceType"],
                        "pathId": entry["pathId"],
                        "objectType": entry["objectType"],
                        "signalTier": signal_tier,
                        "matchMode": match_mode,
                        "score": surface["baseScore"] if match_mode == "exact-string" else surface["baseScore"] // 2,
                    })
                    break

    if not skip_raw_string_scan:
        seen = {(hit["term"], hit.get("surfaceType", ""), str(hit.get("pathId", "")), hit.get("matchedValue", "")) for hit in hits}
        for entry in get_unity_raw_string_index().get(source_id, []):
            value = entry["value"]
            for term in exact_terms:
                matched = False
                match_mode = ""
                if value == term:
                    matched = True
                    match_mode = "exact-string"
                elif term.lower() in value.lower():
                    matched = True
                    match_mode = "bounded-containment"
                if not matched:
                    continue

                identity = (term, "raw-string", str(entry["offset"]), value[:200])
                if identity in seen:
                    continue
                seen.add(identity)
                spec = spec_by_value[term]
                score = 78 if match_mode == "exact-string" else 42
                if spec["kind"] == "path id":
                    score -= 20
                hits.append(
                    {
                        "term": term,
                        "matchedValue": value[:200],
                        "surfaceType": "raw-string",
                        "offset": entry["offset"],
                        "encoding": entry["encoding"],
                        "jsonPath": "raw-string@{}".format(entry["offset"]),
                        "signalTier": "high-signal" if match_mode == "exact-string" else "supporting",
                        "matchMode": match_mode,
                        "score": score,
                    }
                )
                break

    return hits, suppressed_count


def find_surface(surfaces: list[dict[str, Any]], surface_id: str) -> dict[str, Any]:
    return next(surface for surface in surfaces if surface["id"] == surface_id)


def maybe_find_surface(surfaces: list[dict[str, Any]], surface_id: str) -> dict[str, Any] | None:
    return next((surface for surface in surfaces if surface["id"] == surface_id), None)


def find_source_entry(surface: dict[str, Any], source_id: str) -> dict[str, Any]:
    return next(source for source in surface["sources"] if source["sourceId"] == source_id)


def maybe_find_source_entry(surface: dict[str, Any], source_id: str) -> dict[str, Any] | None:
    return next((source for source in surface["sources"] if source["sourceId"] == source_id), None)


def find_hit(source_entry: dict[str, Any], term: str) -> dict[str, Any]:
    return next(
        hit
        for hit in source_entry["hits"]
        if hit["term"] == term or term in hit.get("matchedTerms", [])
    )


def maybe_find_hit(source_entry: dict[str, Any] | None, term: str) -> dict[str, Any] | None:
    if source_entry is None:
        return None
    return next(
        (
            hit
            for hit in source_entry["hits"]
            if hit["term"] == term or term in hit.get("matchedTerms", [])
        ),
        None,
    )


def find_token_shop_extract_field(token_shop_extract: dict[str, Any], field_name: str) -> dict[str, Any] | None:
    fields = token_shop_extract.get("fields", []) or []
    return next(
        (
            field
            for field in fields
            if isinstance(field, dict) and str(field.get("field") or "") == field_name
        ),
        None,
    )


def build_token_shop_extract_window_entry(
    token_shop_extract: dict[str, Any],
    field_name: str,
    group: str,
    kind: str = "pointer",
) -> dict[str, Any]:
    field = find_token_shop_extract_field(token_shop_extract, field_name)
    return {
        "field": field_name,
        "group": group,
        "kind": kind,
        "pathId": (field or {}).get("path_id"),
    }


def cite_hit(source_entry: dict[str, Any], hit: dict[str, Any], note: str | None = None) -> dict[str, Any]:
    if "jsonPath" in hit:
        locator = hit["jsonPath"]
    elif "pathId" in hit:
        locator = "{} path_id {}".format(hit.get("objectType", "unity-object"), hit["pathId"])
    elif source_entry["sourceId"] == "metadata" and "offset" in hit:
        locator = f"metadata offset {hit['offset']}"
    elif "offset" in hit:
        locator = f"offset {hit['offset']}"
    else:
        locator = "direct-hit"
    citation = {
        "sourceId": source_entry["sourceId"],
        "sourcePath": source_entry["sourcePath"],
        "term": hit["term"],
        "locator": locator,
    }
    if note:
        citation["note"] = note
    return citation


def maybe_cite_hit(source_entry: dict[str, Any] | None, hit: dict[str, Any] | None, note: str | None = None) -> dict[str, Any] | None:
    if source_entry is None or hit is None:
        return None
    return cite_hit(source_entry, hit, note)


def compact_citations(*citations: dict[str, Any] | None) -> list[dict[str, Any]]:
    return [citation for citation in citations if citation is not None]


def flatten_depth_sources(depth_expansion: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if not depth_expansion:
        return []
    sources: list[dict[str, Any]] = []
    for hop in depth_expansion:
        sources.extend(hop.get("sources", []))
    return sources


def find_term_in_source_entries(source_entries: list[dict[str, Any]], term: str, preferred_source_ids: list[str] | None = None) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    preferred_source_ids = preferred_source_ids or []
    for source_id in preferred_source_ids:
        for source_entry in source_entries:
            if source_entry["sourceId"] != source_id:
                continue
            hit = maybe_find_hit(source_entry, term)
            if hit is not None:
                return source_entry, hit
    for source_entry in source_entries:
        hit = maybe_find_hit(source_entry, term)
        if hit is not None:
            return source_entry, hit
    return None, None


def cite_row_boundary(source_id: str, path: str, detail: str, note: str | None = None) -> dict[str, Any]:
    citation = {
        "sourceId": source_id,
        "sourcePath": get_source_reference(source_id),
        "term": detail,
        "locator": path,
    }
    if note:
        citation["note"] = note
    return citation


def cite_token_shop_extract_field(
    field_name: str,
    token_shop_extract: dict[str, Any],
    note: str | None = None,
) -> dict[str, Any]:
    field = find_token_shop_extract_field(token_shop_extract, field_name) or {}
    detail = field_name
    if field.get("path_id") is not None:
        detail = f"{field_name} path_id {field['path_id']}"
    return cite_row_boundary("tokenShopExtract", f"$.fields[field={field_name}]", detail, note)


def cite_db_semantic_scope(
    scope_id: str,
    detail: str,
    note: str | None = None,
) -> dict[str, Any]:
    citation = {
        "sourceId": "dbSemanticScope",
        "sourcePath": f"db:canonical-semantic-fragment:semantic_scope_fragment:{scope_id}",
        "term": detail,
        "locator": scope_id,
    }
    if note:
        citation["note"] = note
    return citation


def _token_shop_row_scope_status(row_scope: dict[str, Any]) -> dict[str, Any]:
    compatibility_status = dict(row_scope.get("compatibilityStatus") or {})
    if compatibility_status:
        return compatibility_status
    missing_seam_ids = _token_shop_row_scope_missing_seam_ids(row_scope)
    row_local_graph = dict(row_scope.get("rowLocalGraph") or {})
    semantic_status = "open" if missing_seam_ids else "closed"
    literal_status = "open" if "exact-shell-to-title" in missing_seam_ids else "closed"
    runtime_status = "open" if "runtime-model-gap" in missing_seam_ids else "closed"
    summary = (
        "Row-local graph remains open at: {}.".format(", ".join(missing_seam_ids))
        if missing_seam_ids
        else "Row-local graph is closed for the currently recovered token-shop evidence."
    )
    return {
        "status": f"semantic-{semantic_status}",
        "semanticStatus": semantic_status,
        "literalStatus": literal_status,
        "runtimeStatus": runtime_status,
        "summary": summary,
        "missingSeamIds": missing_seam_ids,
        "unresolvedRuntimeTargets": (
            ["displayed-cost-fast-buy-or-runtime-modifiers"]
            if "runtime-model-gap" in missing_seam_ids
            else []
        ),
        "directTextCandidateCount": int(row_local_graph.get("textCandidateCount") or 0),
        "detachedTextCandidateCount": int(row_local_graph.get("detachedTextCandidateCount") or 0),
    }


def _token_shop_row_scope_missing_seam_ids(row_scope: dict[str, Any]) -> list[str]:
    return [
        str(seam.get("id") or "")
        for seam in (row_scope.get("missingSeams") or [])
        if isinstance(seam, dict) and str(seam.get("id") or "").strip()
    ]


def _token_shop_title_recovered(
    row_recovery: dict[str, Any] | None = None,
    row_scope: dict[str, Any] | None = None,
) -> bool:
    row_recovery = dict(row_recovery or {})
    literal_summary = dict(row_recovery.get("literalRecoverySummary") or {})
    if str(literal_summary.get("title") or "").strip():
        return True
    row_scope = dict(row_scope or {})
    if row_scope:
        return "exact-shell-to-title" not in set(_token_shop_row_scope_missing_seam_ids(row_scope))
    return False


def cite_db_materialized_target(
    trace_scope: str,
    locator: str,
    detail: str,
    note: str | None = None,
) -> dict[str, Any]:
    citation = {
        "sourceId": "dbMaterializedTarget",
        "sourcePath": f"db:materialized-target-bundle:{trace_scope}",
        "term": detail,
        "locator": locator,
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


def _collect_native_owner_selection_terms(target: dict[str, Any], trace_payload: dict[str, Any]) -> list[str]:
    raw_terms: list[str] = []
    raw_terms.extend(str(anchor) for anchor in target.get("anchors", []))
    bridge_check = trace_payload.get("bridgeCheck", {})
    raw_terms.extend(str(term) for term in bridge_check.get("candidateTerms", []))
    for hit in bridge_check.get("bridgeHits", []):
        term = hit.get("term")
        if isinstance(term, str) and term:
            raw_terms.append(term)
    shell_window = trace_payload.get("shellWindow", {})
    for key in ("shellField", "ownerFieldBlock", "ownerType", "declaringType"):
        value = shell_window.get(key)
        if isinstance(value, str) and value:
            raw_terms.append(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item:
                    raw_terms.append(item)
    deduped: list[str] = []
    seen: set[str] = set()
    for term in raw_terms:
        normalized = term.strip()
        if not normalized:
            continue
        if "Prefab" in normalized:
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped.append(normalized)
    return deduped


def _collect_native_trace_terms(
    target: dict[str, Any],
    planner_resolution: dict[str, Any],
    trace_payload: dict[str, Any],
) -> list[str]:
    acquisition_plan = dict(_get_active_trace_runtime_flag("acquisitionPlan") or {})
    relation_probe = dict(acquisition_plan.get("selectedRelationProbe") or {})
    if str(acquisition_plan.get("coverageMode") or "").strip() == "relation-shaped" and relation_probe:
        relation_terms = unique_strings(
            [
                *[str(value) for value in (relation_probe.get("expectedTerms") or []) if str(value).strip()],
                *[str(value) for value in (acquisition_plan.get("requestedTerms") or []) if str(value).strip()],
                *[str(value) for value in (relation_probe.get("anchors") or []) if str(value).strip()],
                *[str(value) for value in (planner_resolution.get("requestedAnchors") or []) if str(value).strip()],
                *[str(value) for value in (planner_resolution.get("requestedQueries") or []) if str(value).strip()],
            ]
        )
        if relation_terms:
            return relation_terms
    trace_scope = str(target.get("id") or target.get("traceScope") or "").strip()
    support_context = load_or_synthesize_support_context(trace_scope, target) if trace_scope else {}
    if support_context.get("disableNativeTrace") is True:
        return []
    requested_anchor_terms = unique_strings(planner_resolution.get("requestedAnchors", [])[:8])
    if requested_anchor_terms:
        return requested_anchor_terms
    selected_anchor_terms = unique_strings(
        [
            *planner_resolution.get("requestedQueries", [])[:3],
            *(spec["value"] for spec in build_anchor_specs(planner_resolution.get("expandedAnchors", []), "planner-expanded-anchor")[:8]),
        ]
    )
    if selected_anchor_terms:
        return selected_anchor_terms
    configured_terms = [str(value) for value in (support_context.get("nativeTraceTerms") or []) if str(value).strip()]
    if configured_terms:
        return unique_strings(configured_terms)
    base_terms = unique_strings([*(str(anchor) for anchor in target.get("anchors", []))])
    owner_selection_terms = _collect_native_owner_selection_terms(target, trace_payload)
    return unique_strings([*base_terms, *owner_selection_terms])


def _build_token_shop_row_recovery(
    target: dict[str, Any],
    trace_payload: dict[str, Any],
    native_trace: dict[str, Any],
) -> dict[str, Any] | None:
    if target.get("familyId") != "token-shop":
        return None
    bridge_plan = native_trace.get("bridgePlan") or build_token_shop_native_bridge_plan(
        _collect_native_owner_selection_terms(target, trace_payload)
    )
    trace_shell = trace_payload.get("shellWindow", {})
    trace_shell_field = trace_shell.get("shellField")
    trace_shell_path_id = trace_shell.get("shellPathId")
    support_context = load_or_synthesize_support_context(str(target.get("id") or target.get("traceScope") or ""), target)
    if str(support_context.get("familyTraceProfile") or "") == "late-atu-family":
        return None
    if "through" in str(trace_shell_field or "").lower():
        return None
    try:
        int(trace_shell_path_id)
    except (TypeError, ValueError):
        return None
    matches = list(bridge_plan.get("matches", []))
    match = None
    if trace_shell_field:
        match = next((candidate for candidate in matches if candidate.get("shellField") == trace_shell_field), None)
    if match is None and matches:
        match = matches[0]
    if match is None and trace_shell_field:
        match = {
            "requestedTerm": trace_shell_field,
            "matchedField": trace_shell_field,
            "matchScore": 1000,
            "shellField": trace_shell_field,
            "shellPathId": trace_shell.get("shellPathId"),
            "ownerFieldBlock": list(trace_shell.get("ownerFieldBlock", [])),
            "controllerBlock": [
                item.get("field")
                for item in trace_shell.get("window", [])
                if isinstance(item, dict) and item.get("field")
            ],
        }
    if match is None:
        return None
    native_summary = native_trace.get("summary", {}) if isinstance(native_trace, dict) else {}
    token_shop_extract = load_token_shop_extract()
    extract_fields = token_shop_extract.get("fields", [])
    fields_by_name = {
        str(entry.get("field")): entry
        for entry in extract_fields
        if entry.get("field")
    }
    reconstructed_fields = set(native_summary.get("reconstructedFields", []))
    raw_value_terms = set(native_summary.get("rawValueTerms", []))
    reconstructed_methods = set(native_summary.get("reconstructedMethods", []))
    owner_field_block = list(match.get("ownerFieldBlock", []))
    controller_block = list(match.get("controllerBlock", []))
    formula_fields = [field for field in owner_field_block if field in reconstructed_fields or field in raw_value_terms]
    controller_objects = [field for field in controller_block if field.endswith(("Overlay", "Content", "Button"))]
    bridge_hits = trace_payload.get("bridgeCheck", {}).get("bridgeHits", [])
    direct_source_ids = {"metadata", "level0", "assets", "tokenShopExtract"}
    prefab_candidates: list[str] = []
    direct_text_candidates: list[str] = []
    detached_text_candidates: list[str] = []
    action_candidates: list[str] = []
    update_hook_candidates: list[str] = []
    presentation_update_markers = ("Text", "Desc", "Title", "Cost", "Level", "Display", "Update")
    for edge in trace_payload.get("traceGraph", {}).get("edges", []):
        edge_type = str(edge.get("type", "")).strip()
        for proof in edge.get("provedBy", []):
            source_id = str(proof.get("sourceId", "")).strip()
            term = str(proof.get("term", "")).strip()
            if source_id not in direct_source_ids or not term:
                continue
            if "Prefab" in term and term not in prefab_candidates:
                prefab_candidates.append(term)
            if "path_id" not in term and (" " in term or ":" in term or term.startswith("Set")):
                if edge_type in {"title-candidate-surface", "generic-text-hook-cluster"}:
                    if term not in detached_text_candidates:
                        detached_text_candidates.append(term)
                elif term not in direct_text_candidates:
                    direct_text_candidates.append(term)
            if term.startswith("Buy") and term not in action_candidates:
                action_candidates.append(term)
    for hit in bridge_hits:
        source_path = str(hit.get("sourcePath", ""))
        if not any(token in source_path for token in ("global-metadata.dat", "level0", "sharedassets0", "globalgamemanagers")):
            continue
        term = str(hit.get("term", "")).strip()
        if not term:
            continue
        if "Prefab" in term and term not in prefab_candidates:
            prefab_candidates.append(term)
        if term.startswith("Buy") and term not in action_candidates:
            action_candidates.append(term)
    text_hook_surface = maybe_find_surface(trace_payload.get("surfaces", []), "text-hooks")
    if text_hook_surface:
        text_hook_source = maybe_find_source_entry(text_hook_surface, "level0")
        if text_hook_source:
            for hit in text_hook_source.get("hits", []):
                term = str(hit.get("term", "")).strip()
                if METHOD_RE.fullmatch(term) and any(marker in term for marker in presentation_update_markers):
                    if term not in update_hook_candidates:
                        update_hook_candidates.append(term)
                    if term not in detached_text_candidates:
                        detached_text_candidates.append(term)
    trace_scope = str(target.get("id") or target.get("traceScope") or "").strip()
    support_context = load_or_synthesize_support_context(trace_scope, target) if trace_scope else {}
    default_update_hook = str(support_context.get("defaultPresentationUpdateHook") or "").strip()
    if (
        default_update_hook
        and not update_hook_candidates
        and any(field_name.endswith(("StartCost", "AdditiveCost")) for field_name in owner_field_block)
    ):
        cost_updater_payload = _load_canonical_term_payload(default_update_hook)
        if cost_updater_payload:
            update_hook_candidates.append(default_update_hook)
    action_methods = [method for method in reconstructed_methods if method.startswith("Buy")]
    recovered_formula_values = []
    recovered_object_bindings = []
    for field_name in owner_field_block:
        entry = fields_by_name.get(field_name)
        if not entry:
            continue
        if entry.get("kind") == "number":
            recovered_formula_values.append(
                {
                    "field": field_name,
                    "group": entry.get("group"),
                    "objectOffset": entry.get("object_offset"),
                    "value": entry.get("value"),
                    "rawU32": entry.get("raw_u32"),
                    "rawF32": entry.get("raw_f32"),
                }
            )
        elif entry.get("kind") == "pointer":
            recovered_object_bindings.append(
                {
                    "field": field_name,
                    "group": entry.get("group"),
                    "objectOffset": entry.get("object_offset"),
                    "pathId": entry.get("path_id"),
                    "fileId": entry.get("file_id"),
                }
            )
    for field_name in controller_block:
        entry = fields_by_name.get(field_name)
        if not entry or entry.get("kind") != "pointer":
            continue
        binding = {
            "field": field_name,
            "group": entry.get("group"),
            "objectOffset": entry.get("object_offset"),
            "pathId": entry.get("path_id"),
            "fileId": entry.get("file_id"),
        }
        if binding not in recovered_object_bindings:
            recovered_object_bindings.append(binding)

    resolved_gameobjects: list[dict[str, Any]] = []
    presentation_objects: list[dict[str, Any]] = []
    for binding in recovered_object_bindings:
        resolved = resolve_pointer_binding_to_gameobject(binding)
        if not resolved:
            continue
        if resolved not in resolved_gameobjects:
            resolved_gameobjects.append(resolved)
        game_object_path_id = resolved.get("gameObjectPathId")
        if game_object_path_id is None:
            continue
        for entry in extract_gameobject_presentation(int(game_object_path_id)):
            enriched = dict(entry)
            enriched["sourceField"] = resolved.get("sourceField")
            enriched["sourcePathId"] = resolved.get("sourcePathId")
            if enriched not in presentation_objects:
                presentation_objects.append(enriched)
            if enriched.get("role") in {"title", "description", "cost", "level", "requirement", "bonus"}:
                candidate = f"{enriched['name']} ({enriched['role']})"
                if candidate not in direct_text_candidates:
                    direct_text_candidates.append(candidate)
    presentation_update_path = build_presentation_update_path(
        presentation_objects,
        update_hook_candidates,
    )
    semantic_scope_id = f"row:{match.get('shellField')}" if match.get("shellField") else None
    cached_semantic_scope = load_canonical_semantic_scope(semantic_scope_id) if semantic_scope_id else None
    shell_native_core = unique_strings(
        [
            trace_shell_field or "",
            *owner_field_block,
            *(term for term in action_candidates if term.startswith("Buy")),
        ]
    )
    row_anchor_terms = unique_strings(
        [
            trace_shell_field or "",
            *(value.get("field", "") for value in recovered_object_bindings if value.get("field")),
            *owner_field_block,
            *controller_block,
            *formula_fields,
            *action_candidates,
            *action_methods,
            *presentation_update_path.get("recursiveAnchorTerms", []),
        ]
    )
    semantic_graph = build_token_shop_semantic_graph(
        {
            "shellField": match.get("shellField"),
            "recoveredActionMethods": unique_strings([*action_candidates, *action_methods]),
            "prefabCandidates": prefab_candidates,
            "recoveredFormulaValues": recovered_formula_values,
            "resolvedGameObjects": resolved_gameobjects,
            "presentationUpdatePath": presentation_update_path,
            "presentationFollowUp": {},
        }
    )
    semantic_search_plan = build_semantic_search_plan(semantic_graph)
    presentation_follow_up = build_presentation_follow_up(
        presentation_objects,
        presentation_update_path,
        cached_semantic_scope,
        semantic_search_plan,
        detached_text_candidates,
        row_anchor_terms,
    )
    literal_schema_follow_up = build_token_shop_literal_schema_follow_up(
        {
            "shellField": match.get("shellField"),
            "ownerFieldBlock": owner_field_block,
            "actionMethods": unique_strings([*action_candidates, *action_methods]),
            "prefabCandidates": prefab_candidates,
            "presentationFollowUp": presentation_follow_up,
        }
    )
    literal_schema_recovery = build_token_shop_literal_schema_recovery(
        {
            "presentationFollowUp": presentation_follow_up,
        },
        literal_schema_follow_up,
    )
    literal_text_recovery = build_token_shop_literal_text_recovery(
        {
            "shellField": match.get("shellField"),
            "prefabCandidates": prefab_candidates,
            "recoveredFormulaValues": recovered_formula_values,
            "literalSchemaRecovery": literal_schema_recovery,
        }
    )
    literal_recovery_summary = build_token_shop_literal_recovery_summary(
        literal_schema_recovery,
        literal_text_recovery,
    )
    owner_blob_row = build_token_shop_owner_blob_row(match.get("shellPathId"))
    owner_modifier_scan = build_token_shop_owner_modifier_scan(owner_blob_row)
    formula_reconstruction = build_formula_reconstruction(
        recovered_formula_values,
        presentation_objects,
        literal_schema_recovery,
        owner_blob_row,
        owner_modifier_scan,
    )
    runtime_evaluator_recovery = build_token_shop_runtime_evaluator_recovery(
        literal_schema_recovery,
        formula_reconstruction,
    )
    runtime_instance_recovery = build_token_shop_runtime_instance_recovery(
        literal_schema_recovery,
    )
    fast_buy_recovery = build_token_shop_fast_buy_recovery(
        formula_reconstruction,
    )
    global_modifier_recovery = build_token_shop_global_modifier_recovery(
        formula_reconstruction,
    )
    for literal_value in (
        literal_text_recovery.get("title"),
        literal_text_recovery.get("description"),
        literal_text_recovery.get("shortEffectLabel"),
        literal_text_recovery.get("outputLabel"),
        literal_text_recovery.get("bonusLabel"),
    ):
        if isinstance(literal_value, str) and literal_value.strip() and literal_value not in direct_text_candidates:
            direct_text_candidates.append(literal_value)
    semantic_graph = build_token_shop_semantic_graph(
        {
            "shellField": match.get("shellField"),
            "recoveredActionMethods": unique_strings([*action_candidates, *action_methods]),
            "prefabCandidates": prefab_candidates,
            "recoveredFormulaValues": recovered_formula_values,
            "resolvedGameObjects": resolved_gameobjects,
            "presentationUpdatePath": presentation_update_path,
            "presentationFollowUp": presentation_follow_up,
            "literalSchemaRecovery": literal_schema_recovery,
            "literalTextRecovery": literal_text_recovery,
        }
    )
    semantic_search_plan = build_semantic_search_plan(semantic_graph)
    closure_status = build_row_closure_status(
        {
            "semanticSearchPlan": semantic_search_plan,
            "textCandidates": direct_text_candidates,
            "detachedTextCandidates": detached_text_candidates,
            "presentationUpdatePath": presentation_update_path,
            "formulaReconstruction": formula_reconstruction,
            "fastBuyRecovery": fast_buy_recovery,
            "literalSchemaRecovery": literal_schema_recovery,
            "literalTextRecovery": literal_text_recovery,
        }
    )
    row_layout_explanation = build_token_shop_row_layout_explanation(
        {
            "presentationUpdatePath": presentation_update_path,
            "literalTextRecovery": literal_text_recovery,
            "formulaReconstruction": formula_reconstruction,
        }
    )
    return {
        "requestedTerms": bridge_plan.get("requestedTerms", []),
        "nativeCoreTerms": shell_native_core or bridge_plan.get("nativeCoreTerms", []),
        "contextTerms": bridge_plan.get("contextTerms", []),
        "shellField": match.get("shellField"),
        "shellPathId": match.get("shellPathId"),
        "ownerFieldBlock": owner_field_block,
        "controllerBlock": controller_block,
        "recoveredFormulaFields": formula_fields,
        "recoveredFormulaValues": recovered_formula_values,
        "recoveredRawValues": [value for value in owner_field_block if value in raw_value_terms],
        "recoveredActionMethods": unique_strings([*action_candidates, *action_methods]),
        "controllerObjects": controller_objects,
        "recoveredObjectBindings": recovered_object_bindings,
        "resolvedGameObjects": resolved_gameobjects,
        "presentationObjects": presentation_objects,
        "prefabCandidates": prefab_candidates,
        "textCandidates": direct_text_candidates,
        "detachedTextCandidates": detached_text_candidates,
        "formulaReconstruction": formula_reconstruction,
        "ownerBlobRow": owner_blob_row,
        "ownerModifierScan": owner_modifier_scan,
        "presentationUpdatePath": presentation_update_path,
        "presentationFollowUp": presentation_follow_up,
        "literalSchemaFollowUp": literal_schema_follow_up,
        "literalSchemaRecovery": literal_schema_recovery,
        "literalTextRecovery": literal_text_recovery,
        "literalRecoverySummary": literal_recovery_summary,
        "rowLayoutExplanation": row_layout_explanation,
        "runtimeEvaluatorRecovery": runtime_evaluator_recovery,
        "runtimeInstanceRecovery": runtime_instance_recovery,
        "fastBuyRecovery": fast_buy_recovery,
        "globalModifierRecovery": global_modifier_recovery,
        "semanticGraph": semantic_graph,
        "semanticSearchPlan": semantic_search_plan,
        "closureStatus": closure_status,
        "semanticScopeId": semantic_scope_id,
        "nativePromotedOwner": native_summary.get("promotedOwner"),
        "nativePromotedMethods": native_summary.get("promotedMethods", []),
        "nativePromotedFields": native_summary.get("promotedFields", []),
        "nativePromotedRawValues": native_summary.get("promotedRawValues", []),
        "coverage": {
            "hasShell": bool(match.get("shellField")),
            "hasFormulaBlock": bool(owner_field_block),
            "hasRecoveredFormulaFields": bool(formula_fields),
            "hasRecoveredFormulaValues": bool(recovered_formula_values),
            "hasActionMethod": bool(action_candidates or action_methods),
            "hasPrefabCandidate": bool(prefab_candidates),
            "hasTextCandidate": bool(direct_text_candidates),
            "hasDetachedTextCandidate": bool(detached_text_candidates),
        },
    }


def _select_promoted_native_owner(
    target: dict[str, Any],
    trace_payload: dict[str, Any],
    native_summary: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not native_summary:
        return None
    scored_owners = list(native_summary.get("scoredOwners", []))
    if not scored_owners:
        return None
    selection_terms = _collect_native_owner_selection_terms(target, trace_payload)
    owner_to_terms = native_summary.get("ownerToTerms", {})
    best_choice: dict[str, Any] | None = None
    best_score: tuple[int, int, str] | None = None
    for owner_entry in scored_owners:
        owner_name = str(owner_entry.get("owner", "")).strip()
        if not owner_name:
            continue
        lowered_owner = owner_name.lower()
        selection_bonus = 0
        matched_terms: list[str] = []
        for term in selection_terms:
            lowered_term = term.lower()
            if lowered_term == lowered_owner:
                selection_bonus += 14
                matched_terms.append(term)
            elif lowered_owner in lowered_term or lowered_term in lowered_owner:
                selection_bonus += 6
                matched_terms.append(term)
        if owner_name.endswith("Data") or owner_name.endswith("Profile"):
            selection_bonus += 4
        owner_score = int(owner_entry.get("score", 0))
        candidate_score = (owner_score + selection_bonus, len(matched_terms), lowered_owner)
        if best_score is None or candidate_score > best_score:
            owner_terms = owner_to_terms.get(owner_name, {}) if isinstance(owner_to_terms, dict) else {}
            best_choice = {
                "owner": owner_name,
                "score": owner_score,
                "promotedScore": owner_score + selection_bonus,
                "reasons": list(owner_entry.get("reasons", [])),
                "matchedTerms": matched_terms,
                "methods": list(owner_terms.get("methods", [])) or list(native_summary.get("reconstructedMethods", [])),
                "fields": list(owner_terms.get("fields", [])) or list(native_summary.get("reconstructedFields", [])),
                "rawValues": list(owner_terms.get("rawValues", [])) or list(native_summary.get("rawValueTerms", [])),
                "relatedTerms": list(owner_terms.get("relatedTerms", [])),
            }
            best_score = candidate_score
    return best_choice


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


def augment_trace_payload_with_native_reconstruction(
    target: dict[str, Any],
    trace_payload: dict[str, Any],
    native_summary: dict[str, Any] | None,
) -> dict[str, Any]:
    if not native_summary:
        return trace_payload

    scored_owners = native_summary.get("scoredOwners", [])
    bridged_terms = native_summary.get("bridgedTerms", [])
    reconstructed_methods = native_summary.get("reconstructedMethods", [])
    reconstructed_fields = native_summary.get("reconstructedFields", [])
    if not scored_owners or not bridged_terms:
        return trace_payload

    promoted_owner = _select_promoted_native_owner(target, trace_payload, native_summary)
    if not promoted_owner:
        return trace_payload
    if int(promoted_owner.get("promotedScore", promoted_owner.get("score", 0))) < 6:
        return trace_payload

    trace_graph = trace_payload.get("traceGraph", {})
    nodes = list(trace_graph.get("nodes", []))
    edges = list(trace_graph.get("edges", []))
    if any(edge.get("type") == "native-reconstruction" for edge in edges):
        return trace_payload

    owner_name = str(promoted_owner.get("owner", ""))
    promoted_methods = list(promoted_owner.get("methods", [])) or reconstructed_methods
    promoted_fields = list(promoted_owner.get("fields", [])) or reconstructed_fields
    promoted_raw_values = list(promoted_owner.get("rawValues", [])) or native_summary.get("rawValueTerms", [])
    methods_label = ", ".join(promoted_methods[:3]) or "no reconstructed methods"
    fields_label = ", ".join(promoted_fields[:4]) or "no reconstructed fields"
    reasons_label = ", ".join(promoted_owner.get("reasons", [])) or "metadata-neighborhood"
    node_id = "native-reconstruction"
    target_node_id = trace_graph.get("nodes", [{}])[0].get("id", "target-shell") if trace_graph.get("nodes") else "target-shell"
    nodes.append(
        make_node(
            node_id,
            "native-reconstruction",
            owner_name,
            "present",
            "Automatic native reconstruction linked this target to {} via {} and {}.".format(
                owner_name,
                methods_label,
                fields_label,
            ),
        )
    )
    edges.append(
        make_edge(
            "native-reconstruction-edge",
            target_node_id,
            node_id,
            "native-reconstruction",
            "present",
            "contextual",
            "Automatic native reconstruction linked this target to {} using {}.".format(
                owner_name,
                reasons_label,
            ),
            [
                {
                    "sourceId": "nativeTrace",
                    "sourcePath": "nativeTrace.summary",
                    "term": owner_name,
                    "locator": "$.nativeTrace.summary",
                    "note": "Auto-promoted reconstructed owner with methods {} and fields {}.".format(
                        methods_label,
                        fields_label,
                    ),
                    "matchedTerms": promoted_owner.get("matchedTerms", []),
                }
            ],
        )
    )
    trace_payload["traceGraph"]["nodes"] = nodes
    trace_payload["traceGraph"]["edges"] = edges
    trace_payload.setdefault("bridgeCheck", {}).setdefault("bridgeHits", []).append(
        {
            "sourceId": "nativeTrace",
            "sourcePath": "nativeTrace.summary",
            "term": owner_name,
            "note": "Automatic native reconstruction",
            "methods": promoted_methods[:6],
            "fields": promoted_fields[:8],
            "rawValues": promoted_raw_values[:8],
            "ownerScore": promoted_owner.get("promotedScore", promoted_owner.get("score", 0)),
            "matchedTerms": promoted_owner.get("matchedTerms", []),
        }
    )
    existing_conclusion = trace_payload.get("groundedConclusion", "")
    if owner_name and owner_name not in existing_conclusion:
        trace_payload["groundedConclusion"] = "{} Automatic native reconstruction ties this lane to {} via {} and {}.".format(
            existing_conclusion,
            owner_name,
            methods_label,
            fields_label,
        ).strip()
    return trace_payload


def build_mod_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_recovery: dict[str, Any] | None = None,
    row_scope: dict[str, Any] | None = None,
) -> dict[str, Any]:
    shell_field = str(shell_window.get("shellField") or "ATU4Button")
    shell_path_id = shell_window.get("shellPathId") or "unknown"
    owner_field_block = [str(item) for item in (shell_window.get("ownerFieldBlock") or []) if str(item).strip()]
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-lane")
    title_surface = find_surface(surfaces, "title-lane")
    text_surface = find_surface(surfaces, "text-hooks")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "level0")
    level0_prefab_source = find_source_entry(prefab_surface, "level0")
    level0_title_source = maybe_find_source_entry(title_surface, "level0")
    metadata_title_source = maybe_find_source_entry(title_surface, "metadata")
    level0_text_source = find_source_entry(text_surface, "level0")

    metadata_shell_hit = find_hit(metadata_source, "ATU4Button")
    metadata_owner_hit = find_hit(metadata_source, "ModBoostStartCost")
    action_buy_hit = maybe_find_hit(action_source, "BuyModBoost")
    prefab_hit = find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.ModPointsBooster")
    title_hit = maybe_find_hit(level0_title_source, "Token Ultima: MP") if level0_title_source else None
    diamond_title_hit = maybe_find_hit(metadata_title_source, ":Diamond Upgrade 11 - ModBoost") if metadata_title_source else None
    text_hook_hit = maybe_find_hit(level0_text_source, "SetAllTokenShopTexts") if level0_text_source else None

    row_recovery = row_recovery or {}
    presentation_update = row_recovery.get("presentationUpdatePath", {}) or {}
    title_slots = list((presentation_update.get("slots") or {}).get("title", []))
    description_slots = list((presentation_update.get("slots") or {}).get("description", []))
    cost_slots = list((presentation_update.get("slots") or {}).get("cost", []))
    update_hooks = list(presentation_update.get("updateHookCandidates", []))
    recovered_formula_values = list(row_recovery.get("recoveredFormulaValues", []))
    title_recovered = _token_shop_title_recovered(row_recovery, row_scope)

    def make_level0_citation(term: str, locator: str, note: str) -> dict[str, Any]:
        return {
            "sourceId": "level0",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]),
            "term": term,
            "locator": locator,
            "note": note,
        }

    def make_extract_citation(term: str, locator: str, note: str) -> dict[str, Any]:
        return {
            "sourceId": "tokenShopExtract",
            "sourcePath": get_source_reference("tokenShopExtract"),
            "term": term,
            "locator": locator,
            "note": note,
        }

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "action-hook"
    prefab_node = "prefab-identity"
    title_node = "presentation-slots"
    text_node = "text-hook-cluster"

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the ModBoost owner-field block in the exact TokenShop extract.",
            [
                make_extract_citation(
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "$.fields",
                    "Shell window recovered directly from metadata plus level0.",
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
            "The metadata neighborhood keeps ATU4Button and the ModBoost declaration block in one raw declaration area.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
            ],
        ),
        make_edge(
            "shell-to-action-hook",
            shell_node,
            action_node,
            "exact-shell-to-action-hook",
            "present",
            "supporting",
            "The action lane preserves the matching direct buy hook BuyModBoost for the same ModBoost row family.",
            compact_citations(
                maybe_cite_hit(action_source, action_buy_hit),
            ),
        ),
        make_edge(
            "action-hook-to-prefab",
            action_node,
            prefab_node,
            "exact-shell-to-prefab",
            "present",
            "direct",
            "The prefab roster preserves the exact ModPointsBooster identity on the same traced row family.",
            [
                cite_hit(level0_prefab_source, prefab_hit),
            ],
        ),
        make_edge(
            "prefab-to-presentation-slots",
            prefab_node,
            title_node,
            "direct-presentation-slot-graph",
            "present",
            "direct",
            "The Unity object graph recovers direct title and description slots for this row.",
            [
                *[
                    make_level0_citation(
                        str(slot.get("name")),
                        "$.rowRecovery.presentationUpdatePath.slots.title",
                        str(slot.get("hierarchyPath")),
                    )
                    for slot in title_slots
                ],
                *[
                    make_level0_citation(
                        str(slot.get("name")),
                        "$.rowRecovery.presentationUpdatePath.slots.description",
                        str(slot.get("hierarchyPath")),
                    )
                    for slot in description_slots
                ],
            ],
        ),
        make_edge(
            "action-hook-to-presentation-slots",
            action_node,
            title_node,
            "interaction-to-render-slot-graph",
            "present",
            "direct",
            "The interaction shell exposes Button/EventTrigger components that lead into row-local TMPro/Text render slots through the recovered Unity hierarchy.",
            [
                *[
                    {
                        "sourceId": "level0",
                        "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]),
                        "term": str(item.get("interaction")),
                        "locator": "$.rowRecovery.presentationUpdatePath.interactionToRenderPaths",
                        "note": f"{item.get('hierarchyPath')} -> {item.get('renderNode')}",
                    }
                    for item in (presentation_update.get("interactionToRenderPaths") or [])
                ],
            ],
        ),
        make_edge(
            "presentation-slots-to-text-hook-cluster",
            title_node,
            text_node,
            "generic-text-hook-cluster",
            "present",
            "supporting",
            "The generic TokenShop text updater survives separately from the recovered slot graph, but it still does not prove one row-specific rendered title string.",
            compact_citations(
                *[
                    maybe_cite_hit(level0_text_source, maybe_find_hit(level0_text_source, hook))
                    for hook in update_hooks
                    if level0_text_source
                ],
            ),
        ),
    ]

    negative_edges = [
        *(
            []
            if title_recovered
            else [
                make_edge(
                    "missing-shell-to-title",
                    shell_node,
                    title_node,
                    "exact-shell-to-title",
                    "missing",
                    "negative",
                    "No direct asset or native-backed source proves one exact rendered ATU4 title string; the row-local title slots exist, but the detached title candidates and generic text updater still do not close the final title join.",
                    [
                        *[
                            make_level0_citation(
                                str(slot.get("name")),
                                "$.rowRecovery.presentationUpdatePath.slots.title",
                                "Recovered title slot without direct rendered string payload.",
                            )
                            for slot in title_slots
                        ],
                        *([cite_hit(level0_title_source, title_hit)] if level0_title_source and title_hit else []),
                        *([cite_hit(metadata_title_source, diamond_title_hit)] if metadata_title_source and diamond_title_hit else []),
                        *([cite_hit(level0_text_source, text_hook_hit)] if level0_text_source and text_hook_hit else []),
                    ],
                )
            ]
        ),
        make_edge(
            "missing-runtime-cost-update",
            action_node,
            text_node,
            "exact-display-update-path",
            "missing",
            "negative",
            "The row recovers grounded constants and the visible cost slot, but the exact row-specific runtime cost update path remains unresolved.",
            [
                *[
                    make_extract_citation(
                        str(item.get("field")),
                        "$.rowRecovery.recoveredFormulaValues",
                        f"value={item.get('value')}",
                    )
                    for item in recovered_formula_values
                    if item.get("field") in {"ModBoostStartCost", "ModBoostAdditiveCost", "ModBoostBonus", "ModBoostMaxLevel"}
                ],
                *[
                    make_level0_citation(
                        str(slot.get("name")),
                        "$.rowRecovery.presentationUpdatePath.slots.cost",
                        str(slot.get("hierarchyPath")),
                    )
                    for slot in cost_slots
                ],
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_field} path_id {shell_path_id}", "present", "The exact target shell survives in the TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(owner_field_block) or "owner-field block unresolved", "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(metadata_node, "metadata-neighborhood", "ATU4Button + ModBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and ModBoost declaration area together."),
            make_node(action_node, "action-hook", "BuyModBoost", "present", "The direct ModBoost buy hook is preserved in level0."),
            make_node(prefab_node, "prefab-identity", "NewTokenUPGPrefab.T1.ModPointsBooster", "present", "The exact token prefab identity is preserved."),
            make_node(title_node, "presentation-slots", ", ".join(slot.get("name", "") for slot in title_slots) or "row-local presentation slots", "present", "Direct title and description slots are recovered from the Unity object graph."),
            make_node(text_node, "text-hook-cluster", ", ".join(update_hooks) or "generic text updater", "present", "The generic TokenShop text updater survives as a separate presentation surface."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-trace-recovered-bridge",
                "status": "proved",
                "statement": "The ATU4 trace preserves one exact shell-to-prefab bridge through the ModBoost row family using direct asset-backed evidence.",
                "edgeIds": ["shell-to-owner-block", "shell-to-action-hook", "action-hook-to-prefab", "prefab-to-presentation-slots", "action-hook-to-presentation-slots"],
                "provedBy": [citation for edge in edges[:6] for citation in edge["provedBy"]],
            },
            {
                "id": "claim-missing-title-join",
                "status": "missing" if not title_recovered else "proved",
                "statement": (
                    "The exact shell-to-final-title join for ATU4 is still missing even though the direct title slot graph is recovered."
                    if not title_recovered
                    else "The canonical ATU4 row scope no longer carries an exact shell-to-final-title seam."
                ),
                "edgeIds": [edge["id"] for edge in negative_edges] if not title_recovered else [],
                "provedBy": (
                    [citation for edge in negative_edges for citation in edge["provedBy"]]
                    if not title_recovered
                    else compact_citations(
                        cite_db_semantic_scope(
                            str((row_scope or {}).get("scopeId") or "row:ATU4Button"),
                            str(_token_shop_row_scope_status(row_scope or {}).get("status") or "semantic-closed"),
                            "Canonical row-local graph no longer carries an exact-shell-to-title seam for ATU4Button.",
                        )
                    )
                ),
            },
        ],
    }


def build_mk1_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_recovery: dict[str, Any] | None = None,
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-lane")
    support_surface = find_surface(surfaces, "support-text-lane")
    roster_surface = find_surface(surfaces, "title-roster-gap")
    text_surface = find_surface(surfaces, "text-hooks")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "level0")
    level0_prefab_source = find_source_entry(prefab_surface, "level0")
    level0_support_source = find_source_entry(support_surface, "level0")
    level0_roster_source = find_source_entry(roster_surface, "level0")
    level0_text_source = find_source_entry(text_surface, "level0")
    row_recovery = row_recovery or {}
    literal_summary = dict(row_recovery.get("literalRecoverySummary") or {})
    title_recovered = bool(str(literal_summary.get("title") or "").strip())

    metadata_shell_hit = find_hit(metadata_source, "ATU5Button")
    metadata_owner_hit = find_hit(metadata_source, "MK1TokenBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyMK1TokenBoost")
    prefab_hit = find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.MK1Booster")
    support_hit = find_hit(level0_support_source, "1. MK1 Generator Output,")
    alt_support_hit = maybe_find_hit(level0_support_source, "This upgrade divides the cost of MK1 Generators by 1500.")
    roster_hit = maybe_find_hit(level0_roster_source, "Mk2 Generator Booster")
    text_hook_hit = maybe_find_hit(level0_text_source, "SetAllTokenShopTexts")

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "action-hook"
    prefab_node = "prefab-identity"
    support_node = "support-text-cluster"
    roster_node = "neighbor-title-roster"
    text_node = "text-hook-cluster"

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the MK1TokenBoost owner-field block in the committed TokenShop extract.",
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
            "The metadata neighborhood keeps ATU5Button and the MK1TokenBoost declaration block in one raw declaration area.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
            ],
        ),
        make_edge(
            "shell-to-action-hook",
            shell_node,
            action_node,
            "exact-shell-to-action-hook",
            "present",
            "supporting",
            "The checked action lane preserves the matching direct buy hook BuyMK1TokenBoost for the same MK1 row family.",
            [
                cite_hit(action_source, action_buy_hit),
            ],
        ),
        make_edge(
            "action-hook-to-prefab",
            action_node,
            prefab_node,
            "exact-shell-to-prefab",
            "present",
            "direct",
            "The checked prefab roster preserves the exact MK1Booster identity on the same traced row family.",
            [
                cite_hit(level0_prefab_source, prefab_hit),
            ],
        ),
        make_edge(
            "prefab-to-support-text",
            prefab_node,
            support_node,
            "title-candidate-surface",
            "present",
            "supporting",
            "Separate MK1 generator support text still survives, but only as a detached title-side surface.",
            compact_citations(
                cite_hit(level0_support_source, support_hit),
                maybe_cite_hit(level0_support_source, alt_support_hit),
            ),
        ),
        make_edge(
            "prefab-to-title-roster",
            prefab_node,
            roster_node,
            "neighbor-title-roster",
            "present",
            "supporting",
            "The owner-side title roster still preserves neighboring generator-booster titles, but not an exact MK1 title join.",
            compact_citations(
                maybe_cite_hit(level0_roster_source, roster_hit),
            ),
        ),
        make_edge(
            "prefab-to-text-hook-cluster",
            prefab_node,
            text_node,
            "generic-text-hook-cluster",
            "present",
            "supporting",
            "The generic TokenShop text hooks survive as a separate title-side surface, but they do not close the ATU5 title join.",
            compact_citations(
                maybe_cite_hit(level0_text_source, text_hook_hit),
            ),
        ),
    ]

    negative_edges = [
        *(
            []
            if title_recovered
            else [
                make_edge(
                    "missing-shell-to-title",
                    shell_node,
                    support_node,
                    "exact-shell-to-title",
                    "missing",
                    "negative",
                    "No committed source proves one exact ATU5 shell-to-final-title join; the surviving generic text hooks, detached MK1 generator support text, and neighboring generator-booster title roster all remain detached from the shell-side row neighborhood.",
                    compact_citations(
                        cite_hit(level0_support_source, support_hit),
                        maybe_cite_hit(level0_support_source, alt_support_hit),
                        maybe_cite_hit(level0_roster_source, roster_hit),
                        maybe_cite_hit(level0_text_source, text_hook_hit),
                    ),
                )
            ]
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(metadata_node, "metadata-neighborhood", "ATU5Button + MK1TokenBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and MK1TokenBoost declaration area together."),
            make_node(action_node, "action-hook", "BuyMK1TokenBoost", "present", "The committed support datasets preserve the matching MK1 buy hook."),
            make_node(prefab_node, "prefab-identity", "NewTokenUPGPrefab.T1.MK1Booster", "present", "The exact token prefab identity is preserved."),
            make_node(support_node, "title-candidate", "1. MK1 Generator Output,", "present", "A detached MK1 generator support-text candidate is preserved."),
            make_node(roster_node, "neighbor-title-roster", "Mk2 Generator Booster", "present", "Neighboring generator-booster titles remain preserved in the owner-side roster."),
            make_node(text_node, "text-hook-cluster", "SetAllTokenShopTexts / SetTokenTexts", "present", "The generic TokenShop text hooks survive as a separate title-side surface."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-trace-recovered-bridge",
                "status": "proved",
                "statement": "The ATU5 trace now preserves one exact shell-to-prefab bridge through the MK1TokenBoost row family.",
                "edgeIds": ["shell-to-owner-block", "shell-to-action-hook", "action-hook-to-prefab"],
                "provedBy": [citation for edge in edges[:4] for citation in edge["provedBy"]],
            },
            {
                "id": "claim-missing-title-join",
                "status": "missing" if negative_edges else "proved",
                "statement": (
                    "The exact shell-to-final-title join for ATU5 is still missing across the detached support-text, neighboring title-roster, and generic text-hook surfaces."
                    if negative_edges
                    else "The ATU5 row now preserves one exact shell-to-final-title join."
                ),
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_mk3_bridge_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-lane")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "level0")
    level0_prefab_source = find_source_entry(prefab_surface, "level0")
    metadata_shell_hit = find_hit(metadata_source, "ATU7Button")
    metadata_owner_hit = find_hit(metadata_source, "MK3TokenBoostStartCost")
    action_buy_hit = maybe_find_hit(action_source, "BuyMK3TokenBoost")
    level0_prefab_hit = maybe_find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "action-hook"
    prefab_node = "prefab-identity"
    action_present = action_buy_hit is not None
    prefab_present = level0_prefab_hit is not None

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the MK3TokenBoost owner-field block in the committed TokenShop extract.",
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
            "The metadata neighborhood keeps ATU7Button and the MK3TokenBoost declaration block in one raw declaration area.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
            ],
        ),
        make_edge(
            "shell-to-action-hook",
            shell_node,
            action_node,
            "exact-shell-to-action-hook",
            "present" if action_present else "absent",
            "supporting" if action_present else "contextual",
            (
                "The checked action lane preserves the matching direct buy hook BuyMK3TokenBoost for the same MK3 row family."
                if action_present
                else "This acquisition scope does not currently surface the legacy BuyMK3TokenBoost hook, so the MK3 bridge stays shell-only."
            ),
            compact_citations(
                maybe_cite_hit(action_source, action_buy_hit),
            ),
        ),
        make_edge(
            "action-hook-to-prefab",
            action_node,
            prefab_node,
            "exact-shell-to-prefab",
            "present" if prefab_present else "absent",
            "direct" if prefab_present else "contextual",
            (
                "The checked prefab roster preserves the exact MK3Booster identity on the same traced row family."
                if prefab_present
                else "This acquisition scope does not currently surface the legacy MK3 prefab identity, so the bridge remains unpromoted."
            ),
            compact_citations(
                maybe_cite_hit(level0_prefab_source, level0_prefab_hit),
            ),
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(metadata_node, "metadata-neighborhood", "ATU7Button + MK3TokenBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and MK3TokenBoost declaration area together."),
            make_node(
                action_node,
                "action-hook",
                "BuyMK3TokenBoost",
                "present" if action_present else "absent",
                "The committed support datasets preserve the matching MK3 buy hook."
                if action_present
                else "The current DB-derived acquisition scope does not expose the legacy MK3 buy hook.",
            ),
            make_node(
                prefab_node,
                "prefab-identity",
                "NewTokenUPGPrefab.T1.MK3Booster",
                "present" if prefab_present else "absent",
                "The exact token prefab identity is preserved."
                if prefab_present
                else "The current DB-derived acquisition scope does not expose the legacy MK3 prefab identity.",
            ),
        ],
        "edges": edges,
        "negativeEdges": [],
        "claimLedger": [
            {
                "id": "claim-trace-recovered-bridge",
                "status": "proved",
                "statement": "The ATU7 trace now preserves one exact shell-to-prefab bridge through the MK3TokenBoost row family.",
                "edgeIds": [edge["id"] for edge in edges],
                "provedBy": [citation for edge in edges for citation in edge["provedBy"]],
            }
        ],
    }


def build_atu3_effect_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    effect_context: dict[str, Any],
    depth_expansion: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    title_surface = find_surface(surfaces, "shared-effect-title")
    text_surface = find_surface(surfaces, "shared-effect-text")
    detached_surface = maybe_find_surface(surfaces, "detached-identity-surfaces")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "level0")
    owner_title_source = find_source_entry(title_surface, "level0")
    lane_text_source = find_source_entry(text_surface, "level0")
    depth_sources = flatten_depth_sources(depth_expansion)
    metadata_detached_source = find_source_entry(detached_surface, "metadata") if detached_surface else None
    level0_detached_source = find_source_entry(detached_surface, "level0") if detached_surface else None
    if detached_surface is None:
        level0_detached_source, _ = find_term_in_source_entries(depth_sources, "NewTokenUPGPrefab.T1.CellsPerChestBooster", ["level0"])
        metadata_detached_source, _ = find_term_in_source_entries(depth_sources, "NewDiamondUPGPrefab.Specials.CellsBoost", ["metadata", "level0"])

    metadata_shell_hit = maybe_find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = maybe_find_hit(metadata_source, "CellBoostStartCost")
    action_buy_hit = maybe_find_hit(action_source, "BuyCellBoost")
    title_hit = maybe_find_hit(owner_title_source, "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>")
    lane_text_hit = maybe_find_hit(lane_text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")
    diamond_prefab_hit = maybe_find_hit(metadata_detached_source, "NewDiamondUPGPrefab.Specials.CellsBoost")
    diamond_title_hit = maybe_find_hit(metadata_detached_source, ">Diamond Upgrade 10 - CellsBoost")
    token_prefab_hit = maybe_find_hit(level0_detached_source, "NewTokenUPGPrefab.T1.CellsPerChestBooster")
    token_ultima_hit = maybe_find_hit(level0_detached_source, "NewTokenUPGPrefab.T5.UltimaCells")
    token_title_hit = maybe_find_hit(level0_detached_source, "Token Ultima: Cells")
    buy_cells_boost_hit = maybe_find_hit(level0_detached_source, "BuyCellsBoost")
    if buy_cells_boost_hit is None:
        level0_detached_source, buy_cells_boost_hit = find_term_in_source_entries(depth_sources, "BuyCellsBoost", ["level0", "metadata"])
    if diamond_prefab_hit is None:
        metadata_detached_source, diamond_prefab_hit = find_term_in_source_entries(depth_sources, "NewDiamondUPGPrefab.Specials.CellsBoost", ["metadata", "level0"])
    if diamond_title_hit is None:
        metadata_detached_source, diamond_title_hit = find_term_in_source_entries(depth_sources, ">Diamond Upgrade 10 - CellsBoost", ["metadata", "level0"])
    if token_prefab_hit is None:
        level0_detached_source, token_prefab_hit = find_term_in_source_entries(depth_sources, "NewTokenUPGPrefab.T1.CellsPerChestBooster", ["level0", "metadata"])
    if token_ultima_hit is None:
        level0_detached_source, token_ultima_hit = find_term_in_source_entries(depth_sources, "NewTokenUPGPrefab.T5.UltimaCells", ["level0", "metadata"])
    if token_title_hit is None:
        level0_detached_source, token_title_hit = find_term_in_source_entries(depth_sources, "Token Ultima: Cells", ["level0", "metadata"])

    chest_consumer_target = dict(effect_context.get("chestConsumerTarget") or {})
    consumer_read_target = dict(effect_context.get("consumerReadTarget") or {})
    chest_consumer_summary = dict(chest_consumer_target.get("decisionSummary") or {})
    consumer_read_summary = dict(consumer_read_target.get("decisionSummary") or {})

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    action_node = "action-hook"
    shared_system_node = "shared-effect-system"
    effect_text_node = "player-effect-text"
    parameter_node = "parameter-surface"
    detached_node = "detached-identity-surfaces"

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
            "owner-block-to-action-hook",
            owner_node,
            action_node,
            "exact-shell-to-action-hook",
            "present",
            "supporting",
            "The metadata neighborhood and checked lane support datasets preserve BuyCellBoost as the exact named action hook for the same CellBoost family.",
            compact_citations(
                maybe_cite_hit(metadata_source, metadata_shell_hit),
                maybe_cite_hit(metadata_source, metadata_owner_hit),
                maybe_cite_hit(action_source, action_buy_hit),
            ),
        ),
        make_edge(
            "action-hook-to-shared-effect-system",
            action_node,
            shared_system_node,
            "shared-effect-system",
            "present",
            "direct",
            "The checked cross-system effect surface preserves the shared Cells Booster (Chests) title for the same cells-from-chests gameplay lane.",
            compact_citations(
                maybe_cite_hit(owner_title_source, title_hit),
            ),
        ),
        make_edge(
            "shared-effect-system-to-player-effect-text",
            shared_system_node,
            effect_text_node,
            "derived-player-effect-surface",
            "present",
            "direct",
            "The same shared effect lane preserves one exact player-facing effect string for cells gained from Token and Diamond chests.",
            compact_citations(
                maybe_cite_hit(lane_text_source, lane_text_hit),
            ),
        ),
        make_edge(
            "owner-block-to-parameter-surface",
            owner_node,
            parameter_node,
            "parameter-surface",
            "present",
            "direct",
            "The raw CellBoost parameter surface preserves the bonus value and max-level cap that bound the shared chest-effect lane.",
            [
                cite_token_shop_extract_field("CellBoostBonus", token_shop_extract, "TokenShop extract preserves the exact ATU3 bonus parameter field."),
                cite_token_shop_extract_field("CellBoostMaxLevel", token_shop_extract, "TokenShop extract preserves the exact ATU3 max-level parameter field."),
            ],
        ),
        make_edge(
            "action-hook-to-detached-identity-surfaces",
            action_node,
            detached_node,
            "detached-identity-contrast",
            "present",
            "supporting",
            "The older diamond-side and token-side Cells identity surfaces still survive as detached contrast evidence, whether preserved directly or recovered one hop out from the bounded effect trace.",
            [
                *compact_citations(
                    maybe_cite_hit(level0_detached_source, buy_cells_boost_hit),
                    maybe_cite_hit(metadata_detached_source, diamond_prefab_hit),
                    maybe_cite_hit(metadata_detached_source, diamond_title_hit),
                    maybe_cite_hit(level0_detached_source, token_prefab_hit),
                    maybe_cite_hit(level0_detached_source, token_ultima_hit),
                    maybe_cite_hit(level0_detached_source, token_title_hit),
                ),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-typed-effect-owner",
            shared_system_node,
            effect_text_node,
            "typed-shared-effect-owner",
            "missing",
            "negative",
            "No committed source currently names the exact runtime chest-reward applier or typed gameplay owner that consumes CellBoostBonus inside the shared Token and Diamond chest cells-gain system.",
            [
                cite_db_materialized_target(
                    "token-shop-atu3-chest-consumer",
                    "$.decisionSummary.summary",
                    str(chest_consumer_summary.get("summary") or "The exact CellBoostBonus field handoff still stays bounded negative."),
                ),
                cite_db_materialized_target(
                    "token-shop-atu3-chest-consumer-read",
                    "$.decisionSummary.summary",
                    str(consumer_read_summary.get("summary") or "The exact CellBoostBonus read site still stays bounded negative."),
                ),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(action_node, "action-hook", "BuyCellBoost", "present", "The committed support datasets preserve the matching cells buy hook."),
            make_node(shared_system_node, "shared-effect-system", "Cells Booster (Chests)", "present", "A shared cells-from-chests gameplay effect surface is preserved."),
            make_node(effect_text_node, "player-effect-text", "+1 Seconds timeskip to Cells Gained from Token & Diamond Chests", "present", "The player-facing effect text survives on the same shared chest-effect lane."),
            make_node(parameter_node, "parameter-surface", "CellBoostBonus = 1, CellBoostMaxLevel = 60", "present", "The raw CellBoost parameter surface bounds the effect lane without naming the applier."),
            make_node(detached_node, "detached-identity-surfaces", "diamond CellsBoost + token CellsPerChestBooster / Token Ultima: Cells", "present", "Older detached identity surfaces remain preserved as contrast evidence."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-atu3-effect-chain",
                "status": "proved",
                "statement": "ATU3 now preserves one shell-to-action-hook-to-shared-effect chain into the cells-from-chests gameplay lane.",
                "edgeIds": ["shell-to-owner-block", "owner-block-to-action-hook", "action-hook-to-shared-effect-system", "shared-effect-system-to-player-effect-text", "owner-block-to-parameter-surface"],
                "provedBy": [citation for edge in edges[:5] for citation in edge["provedBy"]],
            },
            {
                "id": "claim-detached-identity-surfaces",
                "status": "proved",
                "statement": "The older diamond-side and token-side Cells identity surfaces still survive, but only as detached contrast evidence.",
                "edgeIds": ["action-hook-to-detached-identity-surfaces"],
                "provedBy": list(edges[5]["provedBy"]),
            },
            {
                "id": "claim-missing-typed-owner",
                "status": "missing",
                "statement": "The exact typed gameplay owner or chest-effect applier still is not recovered.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_mod_vs_blocked_diff(
    target_id: str,
    target: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_recovery: dict[str, Any] | None = None,
    row_scope: dict[str, Any] | None = None,
) -> dict[str, Any]:
    action_source = find_source_entry(find_surface(surfaces, "action-lane"), "level0")
    prefab_source = find_source_entry(find_surface(surfaces, "prefab-lane"), "level0")
    row_recovery = row_recovery or {}
    presentation_update = row_recovery.get("presentationUpdatePath", {}) or {}
    title_slots = list((presentation_update.get("slots") or {}).get("title", []))
    detached_text = list(row_recovery.get("detachedTextCandidates", []))
    title_recovered = _token_shop_title_recovered(row_recovery, row_scope)
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU4Button sits directly after the ModBoost owner-field block.",
            "provedBy": [
                {
                    "sourceId": "tokenShopExtract",
                    "sourcePath": get_source_reference("tokenShopExtract"),
                    "term": f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "locator": "$.fields",
                    "note": "Shell window recovered directly from metadata plus level0.",
                }
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one checked row-specific buy hook.",
            "provedBy": compact_citations(
                maybe_cite_hit(action_source, maybe_find_hit(action_source, "BuyModBoost"))
            ),
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": compact_citations(
                maybe_cite_hit(prefab_source, maybe_find_hit(prefab_source, "NewTokenUPGPrefab.T1.ModPointsBooster"))
            ),
        },
        {
            "type": "exact-shell-to-title",
            "status": "present" if title_recovered else "missing",
            "provenanceStrength": "direct" if title_recovered else "negative",
            "statement": (
                "ATU4 now preserves one exact shell-to-final-title join."
                if title_recovered
                else "ATU4 still lacks one exact shell-to-final-title join."
            ),
            "provedBy": [
                *[
                    {
                        "sourceId": "level0",
                        "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]),
                        "term": str(slot.get("name")),
                        "locator": "$.rowRecovery.presentationUpdatePath.slots.title",
                        "note": str(slot.get("hierarchyPath")),
                    }
                    for slot in title_slots
                ],
                *[
                    {
                        "sourceId": "level0",
                        "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]),
                        "term": term,
                        "locator": "$.rowRecovery.detachedTextCandidates",
                        "note": "Detached text candidate, not a direct rendered row title.",
                    }
                    for term in detached_text
                ],
            ],
        },
    ]
    blocked_edges = [
        *(
            []
            if title_recovered
            else [
                {
                    "type": "exact-shell-to-title",
                    "status": "missing",
                    "provenanceStrength": "negative",
                    "statement": "The direct title slot graph exists, but the exact rendered title string is still unresolved.",
                    "provedBy": baseline_edges[3]["provedBy"],
                }
            ]
        ),
        {
            "type": "exact-display-update-path",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The visible cost slot and grounded constants are recovered, but the exact row-specific runtime display update path is still unresolved.",
            "provedBy": [],
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
            "id": "atu4-trace-row-bridge",
            "label": "ATU4 asset/native row bridge",
            "status": "cleared",
            "sourcePath": get_source_reference("tokenShopExtract"),
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": "ATU4 preserves one direct shell-to-buy-hook-to-prefab bridge and one recovered presentation slot graph from live assets.",
        },
        "blockedTarget": {
            "id": "atu4-rendered-title-and-update-path",
            "label": "ATU4 rendered title and update path",
            "status": "blocked",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]),
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": "The rendered title string and row-specific display update path remain unresolved even though the live slot graph is recovered.",
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "The live ATU4 trace preserves the direct serialized shell-to-owner-block adjacency.",
                "ATU4 now preserves one direct buy hook, one exact prefab identity, and one recovered title/description slot graph from Unity assets.",
                (
                    "The remaining blocker is no longer a detached comparison artifact; it is the unresolved rendered title string and exact row-specific display update path."
                    if not title_recovered
                    else "The remaining blocker is the exact row-specific display update path."
                ),
            ],
        },
    }


def build_mk1_vs_blocked_diff(
    target_id: str,
    target: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    mk1_context: dict[str, Any],
) -> dict[str, Any]:
    action_source = find_source_entry(find_surface(surfaces, "action-lane"), "level0")
    prefab_source = find_source_entry(find_surface(surfaces, "prefab-lane"), "level0")
    support_source = find_source_entry(find_surface(surfaces, "support-text-lane"), "level0")
    roster_source = find_source_entry(find_surface(surfaces, "title-roster-gap"), "level0")
    text_source = find_source_entry(find_surface(surfaces, "text-hooks"), "level0")
    row_scope = dict(mk1_context.get("rowScope") or {})
    effect_target = dict(mk1_context.get("effectTarget") or {})
    row_scope_status = _token_shop_row_scope_status(row_scope)
    missing_seam_ids = set(_token_shop_row_scope_missing_seam_ids(row_scope))
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU5Button sits directly after the MK1TokenBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one checked row-specific buy hook.",
            "provedBy": [
                cite_hit(action_source, find_hit(action_source, "BuyMK1TokenBoost"))
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_hit(prefab_source, find_hit(prefab_source, "NewTokenUPGPrefab.T1.MK1Booster"))
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing" if "exact-shell-to-title" in missing_seam_ids else "present",
            "provenanceStrength": "negative" if "exact-shell-to-title" in missing_seam_ids else "direct",
            "statement": (
                "ATU5 still lacks one exact shell-to-final-title join."
                if "exact-shell-to-title" in missing_seam_ids
                else "ATU5 now preserves a recovered title-side join through the current row-local graph and literal recovery."
            ),
            "provedBy": [
                cite_hit(source_entry, hit)
                for source_entry, hit in [
                    (support_source, maybe_find_hit(support_source, "1. MK1 Generator Output,")),
                    (support_source, maybe_find_hit(support_source, "This upgrade divides the cost of MK1 Generators by 1500.")),
                    (roster_source, maybe_find_hit(roster_source, "Mk2 Generator Booster")),
                    (text_source, maybe_find_hit(text_source, "SetAllTokenShopTexts")),
                ]
                if hit is not None
            ],
        },
    ]
    blocked_edges = build_token_shop_atu3_blocked_edges(token_shop_extract, row_scope, effect_target)
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
            "id": "atu5-trace-row-bridge",
            "label": "ATU5 trace-backed row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]),
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": "ATU5 preserves one direct shell-to-buy-hook-to-prefab bridge, but title-side evidence still remains detached from the exact shell neighborhood.",
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": "db:canonical-semantic-fragment:semantic_scope_fragment:row:ATU3Button",
            "shellField": "ATU3Button",
            "shellPathId": find_token_shop_extract_field(token_shop_extract, "ATU3Button").get("path_id"),
            "comparisonShape": blocked_edges,
            "groundedConclusion": str(row_scope_status.get("summary") or (effect_target.get("decisionSummary") or {}).get("summary") or "ATU3 remains narrower and still lacks one exact shell join."),
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both rows preserve the direct serialized shell-to-owner-block adjacency.",
                "The solved ATU5 trace now preserves one checked row-specific buy hook and one exact MK1Booster prefab identity.",
                "ATU5 still lacks a final title join, but ATU3 remains narrower and more blocked because its action, prefab, and title clues still do not converge on one exact shell join.",
            ],
        },
    }


def build_token_shop_atu3_blocked_edges(
    token_shop_extract: dict[str, Any],
    row_scope: dict[str, Any],
    effect_target: dict[str, Any],
) -> list[dict[str, Any]]:
    row_scope_status = _token_shop_row_scope_status(row_scope)
    missing_seam_ids = _token_shop_row_scope_missing_seam_ids(row_scope)
    effect_summary = dict(effect_target.get("decisionSummary") or {})
    missing_seam_set = set(missing_seam_ids)
    return [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly beside the CellBoost owner-field block.",
            "provedBy": [
                cite_token_shop_extract_field("ATU3Button", token_shop_extract),
                cite_token_shop_extract_field("CellBoostStartCost", token_shop_extract),
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing" if "exact-shell-to-action-hook" in missing_seam_set else "present",
            "provenanceStrength": "negative" if "exact-shell-to-action-hook" in missing_seam_set else "supporting",
            "statement": (
                "ATU3 still lacks one exact shell-specific effect or buy hook."
                if "exact-shell-to-action-hook" in missing_seam_set
                else "ATU3 now preserves one exact shell-specific effect or buy hook in the current row-local graph."
            ),
            "provedBy": [
                cite_db_materialized_target(
                    "token-shop-atu3-cells-effect",
                    "$.decisionSummary.summary",
                    str(effect_summary.get("summary") or "ATU3 still lacks one exact shell-specific effect or buy hook."),
                ),
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "missing" if "exact-shell-to-prefab" in missing_seam_set else "present",
            "provenanceStrength": "negative" if "exact-shell-to-prefab" in missing_seam_set else "direct",
            "statement": (
                "ATU3 still lacks one exact shell-to-prefab identity join."
                if "exact-shell-to-prefab" in missing_seam_set
                else "ATU3 now preserves one exact shell-to-prefab identity join in the current row-local graph."
            ),
            "provedBy": [
                cite_db_semantic_scope(
                    "row:ATU3Button",
                    str(row_scope_status.get("status") or "semantic-open"),
                    "ATU3 row-local graph still carries {} and does not clear one exact prefab identity join.".format(
                        ", ".join(missing_seam_ids or ["open row-local seams"])
                    ),
                ),
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing" if "exact-shell-to-title" in missing_seam_set else "present",
            "provenanceStrength": "negative" if "exact-shell-to-title" in missing_seam_set else "direct",
            "statement": (
                "ATU3 still lacks one exact shell-to-final-title join."
                if "exact-shell-to-title" in missing_seam_set
                else "ATU3 now preserves one exact shell-to-final-title join in the current row-local graph."
            ),
            "provedBy": [
                cite_db_semantic_scope(
                    "row:ATU3Button",
                    str(row_scope_status.get("summary") or row_scope_status.get("status") or "semantic-open"),
                    "ATU3 row-local graph still carries {} and does not clear one exact shell-to-final-title join.".format(
                        ", ".join(missing_seam_ids or ["open row-local seams"])
                    ),
                ),
            ],
        },
    ]


def build_mk3_vs_blocked_diff(
    target_id: str,
    target: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    mk3_context: dict[str, Any],
) -> dict[str, Any]:
    action_source = find_source_entry(find_surface(surfaces, "action-lane"), "level0")
    prefab_source = find_source_entry(find_surface(surfaces, "prefab-lane"), "level0")
    action_buy_hit = maybe_find_hit(action_source, "BuyMK3TokenBoost")
    prefab_hit = maybe_find_hit(prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")
    row_scope = dict(mk3_context.get("rowScope") or {})
    effect_target = dict(mk3_context.get("effectTarget") or {})
    row_scope_status = _token_shop_row_scope_status(row_scope)
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU7Button sits directly after the MK3TokenBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present" if action_buy_hit is not None else "absent",
            "provenanceStrength": "supporting" if action_buy_hit is not None else "contextual",
            "statement": (
                "The solved bridge preserves one checked row-specific buy hook."
                if action_buy_hit is not None
                else "The current acquisition scope does not preserve one checked row-specific MK3 buy hook."
            ),
            "provedBy": compact_citations(
                maybe_cite_hit(action_source, action_buy_hit)
            ),
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present" if prefab_hit is not None else "absent",
            "provenanceStrength": "direct" if prefab_hit is not None else "contextual",
            "statement": (
                "The solved bridge preserves one exact prefab identity on the same row family."
                if prefab_hit is not None
                else "The current acquisition scope does not preserve one exact MK3 prefab identity."
            ),
            "provedBy": compact_citations(
                maybe_cite_hit(prefab_source, prefab_hit)
            ),
        },
        {
            "type": "multi-support-prefab-corroboration",
            "status": "present" if action_buy_hit is not None and prefab_hit is not None else "absent",
            "provenanceStrength": "supporting" if action_buy_hit is not None and prefab_hit is not None else "contextual",
            "statement": (
                "The solved bridge is corroborated by multiple checked prefab surfaces."
                if action_buy_hit is not None and prefab_hit is not None
                else "The current acquisition scope does not preserve the full checked MK3 corroboration set."
            ),
            "provedBy": compact_citations(
                maybe_cite_hit(action_source, action_buy_hit),
                maybe_cite_hit(prefab_source, prefab_hit),
                cite_db_semantic_scope(
                    "row:ATU7Button",
                    str(row_scope_status.get("status") or "semantic-open"),
                    "ATU7 remains DB-derived and corroborated by the current canonical row scope.",
                ),
            ),
        },
    ]
    blocked_edges = build_token_shop_atu3_blocked_edges(token_shop_extract, row_scope, effect_target)
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
            "id": "atu7-trace-row-bridge",
            "label": "ATU7 trace-backed row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]),
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": "ATU7 preserves one direct shell-to-buy-hook-to-prefab bridge with corroborating row-scope evidence, but this still stays bounded as row-level trace evidence.",
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": "db:canonical-semantic-fragment:semantic_scope_fragment:row:ATU3Button",
            "shellField": "ATU3Button",
            "shellPathId": find_token_shop_extract_field(token_shop_extract, "ATU3Button").get("path_id"),
            "comparisonShape": blocked_edges,
            "groundedConclusion": str((effect_target.get("decisionSummary") or {}).get("summary") or closure_status.get("summary") or "ATU3 remains narrower and still lacks one exact shell join."),
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both rows preserve the direct serialized shell-to-owner-block adjacency.",
                "The solved ATU7 trace now preserves one checked row-specific buy hook, one exact MK3Booster prefab identity, and multi-support prefab corroboration.",
                "ATU3 remains narrower and more blocked because its action, prefab, and title clues still do not converge on one exact shell join.",
            ],
        },
    }


def build_atu3_effect_vs_split_diff(
    target_id: str,
    target: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    effect_context: dict[str, Any],
) -> dict[str, Any]:
    action_source = find_source_entry(find_surface(surfaces, "action-lane"), "level0")
    title_source = find_source_entry(find_surface(surfaces, "shared-effect-title"), "level0")
    text_source = find_source_entry(find_surface(surfaces, "shared-effect-text"), "level0")
    row_scope = dict(effect_context.get("rowScope") or {})
    chest_consumer_target = dict(effect_context.get("chestConsumerTarget") or {})
    chest_consumer_summary = dict(chest_consumer_target.get("decisionSummary") or {})
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly after the CellBoost owner-field block.",
            "provedBy": [
                cite_token_shop_extract_field("ATU3Button", token_shop_extract),
                cite_token_shop_extract_field("CellBoostStartCost", token_shop_extract),
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The effect-driven trace now preserves one checked row-family action hook.",
            "provedBy": [
                cite_hit(action_source, find_hit(action_source, "BuyCellBoost")),
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves one shared cells-from-chests effect system surface.",
            "provedBy": [
                cite_hit(title_source, find_hit(title_source, "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>")),
            ],
        },
        {
            "type": "derived-player-effect-surface",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves one exact player-facing effect string for the shared chest-effect lane.",
            "provedBy": [
                cite_hit(text_source, find_hit(text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")),
            ],
        },
        {
            "type": "parameter-surface",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves a bounded CellBoost parameter surface.",
            "provedBy": [
                cite_token_shop_extract_field("CellBoostBonus", token_shop_extract),
                cite_token_shop_extract_field("CellBoostMaxLevel", token_shop_extract),
            ],
        },
        {
            "type": "typed-shared-effect-owner",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The exact typed gameplay owner for the shared chest-effect applier still remains unresolved.",
            "provedBy": [
                cite_db_materialized_target(
                    "token-shop-atu3-chest-consumer",
                    "$.decisionSummary.summary",
                    str(chest_consumer_summary.get("summary") or "The exact CellBoostBonus field handoff still stays bounded negative."),
                ),
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
                cite_token_shop_extract_field("ATU3Button", token_shop_extract),
                cite_token_shop_extract_field("CellBoostStartCost", token_shop_extract),
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace only preserved a generic action cluster, not an effect-chain verdict.",
            "provedBy": [
                cite_db_semantic_scope(
                    "row:ATU3Button",
                    str(_token_shop_row_scope_status(row_scope).get("status") or "semantic-open"),
                    "ATU3 row-local graph still carries {} and does not clear one exact shell-to-action effect verdict by itself.".format(
                        ", ".join(_token_shop_row_scope_missing_seam_ids(row_scope) or ["open row-local seams"])
                    ),
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace did not preserve one checked shared effect-system join.",
            "provedBy": [
                cite_db_semantic_scope(
                    "row:ATU3Button",
                    str(_token_shop_row_scope_status(row_scope).get("status") or "semantic-open"),
                    "ATU3 row-local graph still carries {} and does not by itself prove the shared chest-effect lane.".format(
                        ", ".join(_token_shop_row_scope_missing_seam_ids(row_scope) or ["open row-local seams"])
                    ),
                )
            ],
        },
        {
            "type": "derived-player-effect-surface",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace did not treat the surviving player-facing effect as one checked derived surface.",
            "provedBy": [
                cite_db_semantic_scope(
                    "row:ATU3Button",
                    str(_token_shop_row_scope_status(row_scope).get("status") or "semantic-open"),
                    "ATU3 row-local graph still carries {} and leaves the effect-text lane detached from one exact row-local identity verdict.".format(
                        ", ".join(_token_shop_row_scope_missing_seam_ids(row_scope) or ["open row-local seams"])
                    ),
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
            "id": "atu3-effect-driven-chain",
            "label": "ATU3 effect-driven chain",
            "status": "cleared",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]),
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": "ATU3 now preserves one shell-to-action-hook-to-shared-effect chain into the cells-from-chests gameplay lane, but the typed gameplay owner remains unresolved.",
        },
        "blockedTarget": {
            "id": target_id,
            "label": "ATU3 prefab/title split",
            "status": "blocked",
            "sourcePath": "db:canonical-semantic-fragment:semantic_scope_fragment:row:ATU3Button",
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": "The row-local ATU3 scope still leaves the action, shared-effect, and player-facing effect surfaces structurally open without one exact typed owner or row-identity closure.",
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both ATU3 traces preserve the direct serialized shell-to-owner-block adjacency.",
                "The new effect-driven trace adds one checked BuyCellBoost-to-shared-cells-effect chain plus a bounded parameter surface.",
                "The older split trace still remains useful as detached identity contrast, but it does not clear the shared chest-effect lane or the derived player-facing effect surface.",
            ],
        },
    }


def build_atu3_chest_consumer_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    consumer_context: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    title_surface = find_surface(surfaces, "shared-effect-title")
    text_surface = find_surface(surfaces, "shared-effect-text")
    consumer_surface = find_surface(surfaces, "consumer-family")
    routine_surface = find_surface(surfaces, "consumer-routines")
    chest_surface = find_surface(surfaces, "chest-objects")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    title_source = find_source_entry(title_surface, "level0")
    lane_text_source = find_source_entry(text_surface, "level0")
    lane_consumer_source = find_source_entry(consumer_surface, "level0")
    metadata_routine_source = find_source_entry(routine_surface, "metadata")
    chest_source = find_source_entry(chest_surface, "level0")

    metadata_shell_hit = maybe_find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = maybe_find_hit(metadata_source, "CellBoostStartCost")
    title_hit = maybe_find_hit(title_source, "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>")
    lane_text_hit = maybe_find_hit(lane_text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")
    ad_manager_hit = maybe_find_hit(lane_consumer_source, "AdManager, Assembly-CSharp")
    set_texts_hit = maybe_find_hit(lane_consumer_source, "SetAdChestTexts")
    offline_hit = maybe_find_hit(lane_consumer_source, "OfflineManager, Assembly-CSharp")
    checker_hit = maybe_find_hit(lane_consumer_source, "DailyAndAdCounterChecker")
    start_token_hit = maybe_find_hit(metadata_routine_source, "StartTokenRoutine")
    token_routine_hit = maybe_find_hit(metadata_routine_source, "<TokenChestRoutine>d__149")
    closed_token_hit = maybe_find_hit(metadata_routine_source, "GoToClosedTokenChest")
    start_diamond_hit = maybe_find_hit(metadata_routine_source, "StartDiamondRoutine")
    diamond_routine_hit = maybe_find_hit(metadata_routine_source, "<DiamondChestRoutine>d__155")
    closed_diamond_hit = maybe_find_hit(metadata_routine_source, "GoToClosedDiamondChest")
    small_cells_hit = maybe_find_hit(metadata_routine_source, "get_SmallAdCellGains")
    big_cells_hit = maybe_find_hit(metadata_routine_source, "get_BigAdCellGains")
    final_token_bonus_hit = maybe_find_hit(metadata_routine_source, "<FinalAdTokenChestBonus>k__BackingField")
    final_diamond_bonus_hit = maybe_find_hit(metadata_routine_source, "<FinalDiamondChestBonus>k__BackingField")
    token_chest_hit = maybe_find_hit(chest_source, "TokenChest")
    diamond_chest_hit = maybe_find_hit(chest_source, "DiamondChest")

    consumer_read_target = dict(consumer_context.get("consumerReadTarget") or {})
    consumer_read_summary = dict(consumer_read_target.get("decisionSummary") or {})

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    shared_effect_node = "shared-effect-lane"
    consumer_family_node = "consumer-family"
    routine_family_node = "chest-routine-family"
    bonus_shell_node = "consumer-bonus-shell"
    chest_objects_node = "chest-objects"

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
            "owner-block-to-shared-effect",
            owner_node,
            shared_effect_node,
            "shared-effect-system",
            "present",
            "direct",
            "The already-grounded ATU3 effect lane preserves the shared Cells Booster (Chests) title and player-facing chest-effect text.",
            compact_citations(
                maybe_cite_hit(metadata_source, metadata_shell_hit),
                maybe_cite_hit(metadata_source, metadata_owner_hit),
                maybe_cite_hit(title_source, title_hit),
                maybe_cite_hit(lane_text_source, lane_text_hit),
            ),
        ),
        make_edge(
            "shared-effect-to-consumer-family",
            shared_effect_node,
            consumer_family_node,
            "shared-effect-to-consumer-family",
            "present",
            "direct",
            "The ATU3 shared chest-effect lane now hands off into the concrete AdManager chest consumer family.",
            compact_citations(
                maybe_cite_hit(lane_consumer_source, ad_manager_hit),
                maybe_cite_hit(lane_consumer_source, set_texts_hit),
                maybe_cite_hit(lane_consumer_source, offline_hit),
                maybe_cite_hit(lane_consumer_source, checker_hit),
            ),
        ),
        make_edge(
            "consumer-family-to-routines",
            consumer_family_node,
            routine_family_node,
            "consumer-family-to-chest-routines",
            "present",
            "direct",
            "The same consumer family preserves the token and diamond chest routine neighborhood.",
            compact_citations(
                maybe_cite_hit(metadata_routine_source, start_token_hit),
                maybe_cite_hit(metadata_routine_source, token_routine_hit),
                maybe_cite_hit(metadata_routine_source, closed_token_hit),
                maybe_cite_hit(metadata_routine_source, start_diamond_hit),
                maybe_cite_hit(metadata_routine_source, diamond_routine_hit),
                maybe_cite_hit(metadata_routine_source, closed_diamond_hit),
            ),
        ),
        make_edge(
            "consumer-family-to-bonus-shell",
            consumer_family_node,
            bonus_shell_node,
            "consumer-family-to-bonus-shell",
            "present",
            "direct",
            "The same runtime shell preserves the chest-reward bonus and cell-gain shell adjacent to the ATU3 consumer family.",
            compact_citations(
                maybe_cite_hit(metadata_routine_source, small_cells_hit),
                maybe_cite_hit(metadata_routine_source, big_cells_hit),
                maybe_cite_hit(metadata_routine_source, final_token_bonus_hit),
                maybe_cite_hit(metadata_routine_source, final_diamond_bonus_hit),
            ),
        ),
        make_edge(
            "consumer-family-to-chest-objects",
            consumer_family_node,
            chest_objects_node,
            "consumer-family-to-chest-objects",
            "present",
            "supporting",
            "Direct Unity extraction preserves the concrete token and diamond chest objects used by the same consumer family.",
            compact_citations(
                maybe_cite_hit(chest_source, token_chest_hit),
                maybe_cite_hit(chest_source, diamond_chest_hit),
            ),
        ),
        make_edge(
            "shared-effect-to-routine-family",
            shared_effect_node,
            routine_family_node,
            "derived-player-effect-surface",
            "present",
            "supporting",
            "The preserved +1 seconds cells-from-chests effect surface now narrows onto the same token and diamond chest routine family rather than floating as detached text.",
            compact_citations(
                maybe_cite_hit(title_source, title_hit),
                maybe_cite_hit(metadata_routine_source, token_routine_hit),
                maybe_cite_hit(metadata_routine_source, diamond_routine_hit),
            ),
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-exact-cellboost-consumer-method",
            owner_node,
            bonus_shell_node,
            "exact-cellboost-consumer-method",
            "missing",
            "negative",
            "No committed source yet shows the exact CellBoostBonus read or typed field handoff inside the AdManager chest routine family that applies the ATU3 cells-from-chests timeskip effect.",
            [
                cite_db_materialized_target(
                    "token-shop-atu3-chest-consumer-read",
                    "$.decisionSummary.summary",
                    str(consumer_read_summary.get("summary") or "The exact CellBoostBonus read or typed field handoff still stays bounded negative."),
                ),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(shared_effect_node, "shared-effect-system", "Cells Booster (Chests) + +1 seconds cells-from-chests text", "present", "The ATU3 row now preserves one grounded shared chest-effect lane."),
            make_node(consumer_family_node, "consumer-family", "AdManager, Assembly-CSharp + chest support systems", "present", "The concrete chest consumer family is preserved in direct Unity extraction."),
            make_node(routine_family_node, "consumer-routine-family", "TokenChestRoutine + DiamondChestRoutine neighborhood", "present", "The token and diamond chest routine family is preserved."),
            make_node(bonus_shell_node, "consumer-bonus-shell", "get_SmallAdCellGains/get_BigAdCellGains + Final chest bonus fields", "present", "The chest reward bonus shell survives beside the consumer family."),
            make_node(chest_objects_node, "chest-objects", "TokenChest + DiamondChest", "present", "Direct Unity extraction preserves the concrete chest game objects."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-atu3-consumer-family",
                "status": "proved",
                "statement": "ATU3 now preserves one shared-effect-to-consumer-family handoff into the concrete AdManager chest reward neighborhood.",
                "edgeIds": [edge["id"] for edge in edges],
                "provedBy": [citation for edge in edges for citation in edge["provedBy"]],
            },
            {
                "id": "claim-missing-exact-cellboost-handoff",
                "status": "missing",
                "statement": "The exact CellBoostBonus read or typed field handoff inside the consumer family still is not recovered.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }

def build_atu3_chest_consumer_read_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    read_context: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    consumer_surface = find_surface(surfaces, "consumer-family")
    routine_surface = find_surface(surfaces, "consumer-routines")
    getter_surface = find_surface(surfaces, "cell-gain-getters")
    booster_surface = find_surface(surfaces, "booster-bonus-shell")
    final_surface = find_surface(surfaces, "final-chest-bonus-shell")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    lane_consumer_source = find_source_entry(consumer_surface, "level0")
    metadata_routine_source = find_source_entry(routine_surface, "metadata")
    getter_source = find_source_entry(getter_surface, "metadata")
    booster_source = find_source_entry(booster_surface, "metadata")
    final_source = find_source_entry(final_surface, "metadata")

    metadata_shell_hit = maybe_find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = maybe_find_hit(metadata_source, "CellBoostStartCost")
    ad_manager_hit = maybe_find_hit(lane_consumer_source, "AdManager, Assembly-CSharp")
    set_texts_hit = maybe_find_hit(lane_consumer_source, "SetAdChestTexts")
    offline_hit = maybe_find_hit(lane_consumer_source, "OfflineManager, Assembly-CSharp")
    checker_hit = maybe_find_hit(lane_consumer_source, "DailyAndAdCounterChecker")
    start_token_hit = maybe_find_hit(metadata_routine_source, "StartTokenRoutine")
    token_routine_hit = maybe_find_hit(metadata_routine_source, "<TokenChestRoutine>d__149")
    start_diamond_hit = maybe_find_hit(metadata_routine_source, "StartDiamondRoutine")
    diamond_routine_hit = maybe_find_hit(metadata_routine_source, "<DiamondChestRoutine>d__155")
    small_getter_hit = maybe_find_hit(getter_source, "get_SmallAdCellGains")
    big_getter_hit = maybe_find_hit(getter_source, "get_BigAdCellGains")
    set_booster_hit = maybe_find_hit(booster_source, "SetBoosterAdBonus")
    final_booster_getter_hit = maybe_find_hit(booster_source, "get_FinalBoosterAdBonus")
    small_cells_hit = maybe_find_hit(booster_source, "SmallAdCellGains")
    big_cells_hit = maybe_find_hit(booster_source, "BigAdCellGains")
    final_booster_hit = maybe_find_hit(booster_source, "FinalBoosterAdBonus")
    set_final_booster_hit = maybe_find_hit(booster_source, "set_FinalBoosterAdBonus")
    final_booster_field_hit = maybe_find_hit(booster_source, "<FinalBoosterAdBonus>k__BackingField")
    booster_routine_hit = maybe_find_hit(booster_source, "<BoosterAdRoutine>d__158")
    final_token_bonus_hit = maybe_find_hit(final_source, "<FinalAdTokenChestBonus>k__BackingField")
    final_diamond_bonus_hit = maybe_find_hit(final_source, "<FinalDiamondChestBonus>k__BackingField")

    consumer_target = dict(read_context.get("consumerTarget") or {})
    consumer_summary = dict(consumer_target.get("decisionSummary") or {})

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    consumer_family_node = "consumer-family"
    routine_family_node = "chest-routine-family"
    getter_node = "cell-gain-getters"
    booster_node = "booster-bonus-shell"
    final_bonus_node = "final-chest-bonus-shell"

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
            "owner-block-to-consumer-family",
            owner_node,
            consumer_family_node,
            "shared-effect-to-consumer-family",
            "present",
            "derived",
            "The already checked ATU3 effect-driven lane remains grounded inside the AdManager chest consumer family.",
            compact_citations(
                maybe_cite_hit(metadata_source, metadata_shell_hit),
                maybe_cite_hit(metadata_source, metadata_owner_hit),
                maybe_cite_hit(lane_consumer_source, ad_manager_hit),
                maybe_cite_hit(lane_consumer_source, set_texts_hit),
                maybe_cite_hit(lane_consumer_source, offline_hit),
                maybe_cite_hit(lane_consumer_source, checker_hit),
            ),
        ),
        make_edge(
            "consumer-family-to-routines",
            consumer_family_node,
            routine_family_node,
            "consumer-family-to-chest-routines",
            "present",
            "direct",
            "The consumer family still preserves the token and diamond chest routine neighborhood.",
            compact_citations(
                maybe_cite_hit(metadata_routine_source, start_token_hit),
                maybe_cite_hit(metadata_routine_source, token_routine_hit),
                maybe_cite_hit(metadata_routine_source, start_diamond_hit),
                maybe_cite_hit(metadata_routine_source, diamond_routine_hit),
            ),
        ),
        make_edge(
            "consumer-family-to-getters",
            consumer_family_node,
            getter_node,
            "consumer-family-to-cell-gain-getters",
            "present",
            "direct",
            "The same internal runtime neighborhood preserves both chest cell-gain getters.",
            compact_citations(
                maybe_cite_hit(getter_source, small_getter_hit),
                maybe_cite_hit(getter_source, big_getter_hit),
            ),
        ),
        make_edge(
            "getters-to-booster-shell",
            getter_node,
            booster_node,
            "cell-gain-getters-to-booster-bonus-shell",
            "present",
            "direct",
            "Committed metadata preserves the cell-gain getters beside the booster bonus aggregation shell.",
            compact_citations(
                maybe_cite_hit(booster_source, set_booster_hit),
                maybe_cite_hit(booster_source, final_booster_getter_hit),
                maybe_cite_hit(booster_source, small_cells_hit),
                maybe_cite_hit(booster_source, big_cells_hit),
                maybe_cite_hit(booster_source, final_booster_hit),
                maybe_cite_hit(booster_source, booster_routine_hit),
            ),
        ),
        make_edge(
            "booster-shell-to-final-shell",
            booster_node,
            final_bonus_node,
            "booster-bonus-shell-to-final-chest-bonus-shell",
            "present",
            "derived",
            "The booster bonus aggregation shell remains adjacent to the final token and diamond chest bonus backing-field shell preserved in metadata.",
            compact_citations(
                maybe_cite_hit(final_source, final_token_bonus_hit),
                maybe_cite_hit(final_source, final_diamond_bonus_hit),
            ),
        ),
    ]

    negative_edges = [
        make_edge(
            "cellboost-read-site-break",
            owner_node,
            booster_node,
            "exact-cellboost-to-booster-bonus-handoff",
            "missing",
            "negative",
            "The exact CellBoostBonus read site or typed field handoff into the internal booster bonus shell still remains unresolved.",
            [
                cite_db_materialized_target(
                    "token-shop-atu3-chest-consumer",
                    "$.decisionSummary.summary",
                    str(consumer_summary.get("summary") or "The exact CellBoostBonus field handoff still stays bounded negative."),
                ),
                *compact_citations(
                    maybe_cite_hit(getter_source, small_getter_hit),
                    maybe_cite_hit(getter_source, big_getter_hit),
                    maybe_cite_hit(booster_source, set_booster_hit),
                    maybe_cite_hit(booster_source, final_booster_getter_hit),
                    maybe_cite_hit(booster_source, set_final_booster_hit),
                    maybe_cite_hit(booster_source, final_booster_hit),
                    maybe_cite_hit(booster_source, final_booster_field_hit),
                ),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(consumer_family_node, "consumer-family", "AdManager, Assembly-CSharp + chest support systems", "present", "The concrete chest consumer family is preserved in committed support datasets."),
            make_node(routine_family_node, "consumer-routine-family", "TokenChestRoutine + DiamondChestRoutine neighborhood", "present", "The token and diamond chest routine family is preserved."),
            make_node(getter_node, "cell-gain-getter-shell", "get_SmallAdCellGains + get_BigAdCellGains", "present", "The chest cell-gain getter shell survives in committed metadata."),
            make_node(booster_node, "booster-bonus-shell", "SetBoosterAdBonus + get_FinalBoosterAdBonus + FinalBoosterAdBonus", "present", "The internal booster bonus aggregation shell is preserved."),
            make_node(final_bonus_node, "final-chest-bonus-shell", "Final token + diamond chest bonus backing fields", "present", "The final chest bonus shell is preserved in metadata."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-atu3-consumer-internal-shell",
                "status": "proved",
                "statement": "ATU3 now preserves one internal bonus-aggregation shell inside the concrete AdManager chest consumer family.",
                "edgeIds": [edge["id"] for edge in edges],
                "provedBy": [citation for edge in edges for citation in edge["provedBy"]],
            },
            {
                "id": "claim-missing-exact-cellboost-read-site",
                "status": "missing",
                "statement": "The exact CellBoostBonus read site or typed field handoff anywhere inside the checked internal bonus-aggregation family still is not recovered.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_atu3_consumer_vs_effect_diff(
    target_id: str,
    target: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    consumer_context: dict[str, Any],
) -> dict[str, Any]:
    title_source = find_source_entry(find_surface(surfaces, "shared-effect-title"), "level0")
    consumer_source = find_source_entry(find_surface(surfaces, "consumer-family"), "level0")
    routine_source = find_source_entry(find_surface(surfaces, "consumer-routines"), "metadata")
    chest_source = find_source_entry(find_surface(surfaces, "chest-objects"), "level0")
    effect_target = dict(consumer_context.get("effectTarget") or {})
    effect_summary = dict(effect_target.get("decisionSummary") or {})
    consumer_read_target = dict(consumer_context.get("consumerReadTarget") or {})
    consumer_read_summary = dict(consumer_read_target.get("decisionSummary") or {})
    shared_effect_title_hit = maybe_find_hit(title_source, "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>")
    ad_manager_hit = maybe_find_hit(consumer_source, "AdManager, Assembly-CSharp")
    token_chest_routine_hit = maybe_find_hit(routine_source, "<TokenChestRoutine>d__149")
    diamond_chest_routine_hit = maybe_find_hit(routine_source, "<DiamondChestRoutine>d__155")
    final_ad_bonus_hit = maybe_find_hit(routine_source, "<FinalAdTokenChestBonus>k__BackingField")
    final_diamond_bonus_hit = maybe_find_hit(routine_source, "<FinalDiamondChestBonus>k__BackingField")
    token_chest_hit = maybe_find_hit(chest_source, "TokenChest")
    diamond_chest_hit = maybe_find_hit(chest_source, "DiamondChest")
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly after the CellBoost owner-field block.",
            "provedBy": [
                cite_token_shop_extract_field("ATU3Button", token_shop_extract),
                cite_token_shop_extract_field("CellBoostStartCost", token_shop_extract),
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The shared Cells Booster (Chests) effect lane remains preserved.",
            "provedBy": compact_citations(
                maybe_cite_hit(title_source, shared_effect_title_hit),
            ),
        },
        {
            "type": "shared-effect-to-consumer-family",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves one handoff into the AdManager chest consumer family.",
            "provedBy": compact_citations(
                maybe_cite_hit(consumer_source, ad_manager_hit),
            ),
        },
        {
            "type": "consumer-family-to-chest-routines",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves the token and diamond chest routine family.",
            "provedBy": compact_citations(
                maybe_cite_hit(routine_source, token_chest_routine_hit),
                maybe_cite_hit(routine_source, diamond_chest_routine_hit),
            ),
        },
        {
            "type": "consumer-family-to-bonus-shell",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves the final chest-bonus shell.",
            "provedBy": compact_citations(
                maybe_cite_hit(routine_source, final_ad_bonus_hit),
                maybe_cite_hit(routine_source, final_diamond_bonus_hit),
            ),
        },
        {
            "type": "consumer-family-to-chest-objects",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The new trace now preserves the concrete token and diamond chest objects.",
            "provedBy": compact_citations(
                maybe_cite_hit(chest_source, token_chest_hit),
                maybe_cite_hit(chest_source, diamond_chest_hit),
            ),
        },
        {
            "type": "exact-cellboost-consumer-method",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The exact CellBoostBonus read or typed field handoff inside the consumer family still remains unresolved.",
            "provedBy": [
                cite_db_materialized_target(
                    "token-shop-atu3-chest-consumer-read",
                    "$.decisionSummary.summary",
                    str(consumer_read_summary.get("summary") or "The exact CellBoostBonus read or typed field handoff still stays bounded negative."),
                )
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly after the CellBoost owner-field block.",
            "provedBy": [
                cite_token_shop_extract_field("ATU3Button", token_shop_extract),
                cite_token_shop_extract_field("CellBoostStartCost", token_shop_extract),
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The older effect-driven trace already preserved the shared Cells Booster (Chests) effect lane.",
            "provedBy": compact_citations(
                maybe_cite_hit(title_source, shared_effect_title_hit),
            ),
        },
        {
            "type": "shared-effect-to-consumer-family",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace stopped at the shared effect surface and did not preserve one concrete consumer-family handoff.",
            "provedBy": [
                cite_db_materialized_target(
                    "token-shop-atu3-cells-effect",
                    "$.decisionSummary.summary",
                    str(effect_summary.get("summary") or "The effect-driven trace remains quarantined before the concrete consumer-family handoff."),
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-routines",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the token and diamond chest routine family.",
            "provedBy": [
                cite_db_materialized_target(
                    "token-shop-atu3-cells-effect",
                    "$.decisionSummary.summary",
                    str(effect_summary.get("summary") or "The effect-driven trace remains quarantined before the concrete consumer-family handoff."),
                )
            ],
        },
        {
            "type": "consumer-family-to-bonus-shell",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the concrete chest-bonus shell.",
            "provedBy": [
                cite_db_materialized_target(
                    "token-shop-atu3-cells-effect",
                    "$.decisionSummary.summary",
                    str(effect_summary.get("summary") or "The effect-driven trace remains quarantined before the concrete consumer-family handoff."),
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-objects",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the concrete chest-object handoff.",
            "provedBy": [
                cite_db_materialized_target(
                    "token-shop-atu3-cells-effect",
                    "$.decisionSummary.summary",
                    str(effect_summary.get("summary") or "The effect-driven trace remains quarantined before the concrete consumer-family handoff."),
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
            "id": "atu3-consumer-family-handoff",
            "label": "ATU3 consumer-family handoff",
            "status": "cleared",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]),
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": "ATU3 now preserves one shared-effect-to-consumer-family handoff into the concrete AdManager chest routine neighborhood, but the exact CellBoostBonus field handoff still remains unresolved.",
        },
        "blockedTarget": {
            "id": target_id,
            "label": "ATU3 effect-only chain",
            "status": "blocked",
            "sourcePath": "db:materialized-target-bundle:token-shop-atu3-cells-effect",
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": "The effect-driven ATU3 chain stops at the shared effect surface and does not by itself close the consumer-family, routine, chest-object, or bonus-shell handoff.",
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both ATU3 traces preserve the direct serialized shell-to-owner-block adjacency and the shared effect lane.",
                "The consumer-handoff trace adds one checked AdManager consumer-family, chest-routine, chest-object, and chest-bonus shell handoff.",
                "The remaining bounded break is the exact CellBoostBonus read or typed field handoff inside that consumer family.",
            ],
        },
    }


def build_family_structure_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    family_context: dict[str, Any],
) -> dict[str, Any]:
    def fallback_surface(surface_id: str) -> dict[str, Any]:
        return maybe_find_surface(surfaces, surface_id) or {"id": surface_id, "sources": []}

    def fallback_source(surface: dict[str, Any], source_id: str) -> dict[str, Any]:
        return maybe_find_source_entry(surface, source_id) or {
            "sourceId": source_id,
            "sourcePath": "db:missing-surface-plan",
            "hits": [],
        }

    def fallback_hit(source_entry: dict[str, Any], term: str) -> dict[str, Any]:
        return maybe_find_hit(source_entry, term) or {"term": term}

    shell_surface = fallback_surface("family-shells")
    proxy_surface = fallback_surface("bridge-proxies")
    prefab_surface = fallback_surface("prefab-roster")
    title_surface = fallback_surface("title-text-surfaces")
    unresolved_surface = fallback_surface("negative-neighborhoods")

    extract_source = fallback_source(shell_surface, "tokenShopExtract")
    proxy_lane_source = fallback_source(proxy_surface, "level0")
    level0_prefab_source = fallback_source(prefab_surface, "level0")
    level0_title_source = fallback_source(title_surface, "level0")
    unresolved_lane_source = fallback_source(unresolved_surface, "level0")

    atu1_shell_hit = fallback_hit(extract_source, "ATU1Button")
    atu6_shell_hit = fallback_hit(extract_source, "ATU6Button")
    atu7_shell_hit = fallback_hit(extract_source, "ATU7Button")
    atu24_shell_hit = fallback_hit(extract_source, "ATU24Button")
    buy_token_hit = fallback_hit(proxy_lane_source, "BuyTokenBoost")
    buy_mk1_hit = fallback_hit(proxy_lane_source, "BuyMK1TokenBoost")
    buy_mk2_hit = fallback_hit(proxy_lane_source, "BuyMK2TokenBoost")
    buy_mk3_hit = fallback_hit(proxy_lane_source, "BuyMK3TokenBoost")
    buy_mod_hit = fallback_hit(proxy_lane_source, "BuyModBoost")
    buy_late_hit = fallback_hit(unresolved_lane_source, "BuyATU24")
    prefab_token_hit = fallback_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.TokensBoost")
    prefab_mk2_hit = fallback_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.MK2Booster")
    prefab_mk3_hit = fallback_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")
    title_mk2_hit = fallback_hit(level0_title_source, "Mk2 Generator Booster")
    text_hook_hit = fallback_hit(level0_title_source, "SetAllTokenShopTexts")
    mod_title_hit = fallback_hit(level0_title_source, "Token Ultima: MP")
    mk1_support_hit = fallback_hit(level0_title_source, "1. MK1 Generator Output,")
    late_title_hit = fallback_hit(level0_title_source, "Academy Booster")
    row_scopes = dict(family_context.get("rowScopes") or {})
    atu3_target = dict(family_context.get("atu3Target") or {})
    atu3_decision_summary = dict(atu3_target.get("decisionSummary") or {})

    shell_node = "atu-family-shells"
    solved_node = "solved-shell-subset"
    proxy_node = "row-family-proxy-lane"
    prefab_node = "prefab-roster"
    title_node = "title-text-surfaces"
    exemplar_node = "atu6-title-exemplar"
    unresolved_node = "bounded-unresolved-neighborhoods"

    edges = [
        make_edge(
            "family-shell-adjacency",
            shell_node,
            solved_node,
            "repeated-serialized-shell-adjacency",
            "present",
            "direct",
            "The committed TokenShop payload repeatedly preserves exact ATU shell ids and adjacent owner neighborhoods across both solved and still-unresolved rows.",
            [
                cite_token_shop_extract_field("ATU1Button", token_shop_extract),
                cite_token_shop_extract_field("ATU6Button", token_shop_extract),
                cite_hit(extract_source, atu7_shell_hit),
                cite_hit(extract_source, atu24_shell_hit),
                cite_token_shop_extract_field("ATU28Button", token_shop_extract),
            ],
        ),
        make_edge(
            "family-proxy-lane",
            solved_node,
            proxy_node,
            "repeated-row-family-proxy-lane",
            "present",
            "supporting",
            "The strongest solved subset repeatedly preserves one row-family proxy lane through buy hooks or effect hooks rather than raw row-order similarity.",
            [
                cite_hit(proxy_lane_source, buy_token_hit),
                cite_hit(proxy_lane_source, buy_mod_hit),
                cite_hit(proxy_lane_source, buy_mk1_hit),
                cite_hit(proxy_lane_source, buy_mk2_hit),
                cite_hit(proxy_lane_source, buy_mk3_hit),
            ],
        ),
        make_edge(
            "family-prefab-subset",
            solved_node,
            prefab_node,
            "repeated-shell-to-prefab-subset",
            "present",
            "direct",
            "The same solved subset repeatedly reaches exact prefab identities on committed sources, even when final titles still do not localize.",
            [
                cite_hit(level0_prefab_source, prefab_token_hit),
                cite_hit(level0_prefab_source, prefab_mk2_hit),
                cite_hit(level0_prefab_source, prefab_mk3_hit),
            ],
        ),
        make_edge(
            "family-title-text-surfaces",
            solved_node,
            title_node,
            "repeated-title-text-surface",
            "present",
            "supporting",
            "Generic TokenShop text hooks and row-adjacent title or support-text surfaces repeatedly survive, but they usually remain detached from exact shell ids.",
            [
                cite_hit(level0_title_source, text_hook_hit),
                cite_hit(level0_title_source, mod_title_hit),
                cite_hit(level0_title_source, mk1_support_hit),
                cite_hit(level0_title_source, late_title_hit),
            ],
        ),
        make_edge(
            "family-title-exemplar",
            solved_node,
            exemplar_node,
            "exact-shell-to-title-exemplar",
            "present",
            "direct",
            "ATU6 remains the standout strongest row neighborhood because the repo preserves one exact shell-to-prefab-to-title chain there.",
            [
                cite_hit(level0_title_source, title_mk2_hit),
                cite_hit(level0_prefab_source, prefab_mk2_hit),
            ],
        ),
        make_edge(
            "family-unresolved-bounds",
            shell_node,
            unresolved_node,
            "bounded-unresolved-neighborhood-coverage",
            "present",
            "supporting",
            "The still-unresolved neighborhoods are already checked as bounded negatives rather than open-ended unknowns.",
            [
                cite_db_materialized_target(
                    "token-shop-atu3-cells-effect",
                    "$.decisionSummary.summary",
                    str(atu3_decision_summary.get("summary") or "ATU3 remains quarantined to descriptive remap evidence."),
                ),
                cite_token_shop_extract_field("ATU24Button", token_shop_extract),
                cite_hit(unresolved_lane_source, buy_late_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "family-missing-title-localization",
            solved_node,
            title_node,
            "repeated-shell-to-title-localization-gap",
            "missing",
            "negative",
            "Outside ATU6, the solved shell subset still does not repeatedly localize final player-facing row titles: ATU1, ATU2, ATU4, ATU5, and ATU7 all stop short of one exact shell-to-title join.",
            [
                cite_db_semantic_scope("row:ATU1Button", str(_token_shop_row_scope_status(row_scopes.get("row:ATU1Button") or {}).get("status") or "semantic-open"), "ATU1 row-local graph still carries {} and does not add a second exact title exemplar here.".format(", ".join(_token_shop_row_scope_missing_seam_ids(row_scopes.get("row:ATU1Button") or {}) or ["open row-local seams"]))),
                cite_db_semantic_scope("row:ATU4Button", str(_token_shop_row_scope_status(row_scopes.get("row:ATU4Button") or {}).get("status") or "semantic-open"), "ATU4 row-local graph still carries {} and does not add a second exact title exemplar here.".format(", ".join(_token_shop_row_scope_missing_seam_ids(row_scopes.get("row:ATU4Button") or {}) or ["open row-local seams"]))),
                cite_db_semantic_scope("row:ATU5Button", str(_token_shop_row_scope_status(row_scopes.get("row:ATU5Button") or {}).get("status") or "semantic-open"), "ATU5 row-local graph still carries {} and does not add a second exact title exemplar here.".format(", ".join(_token_shop_row_scope_missing_seam_ids(row_scopes.get("row:ATU5Button") or {}) or ["open row-local seams"]))),
                cite_db_semantic_scope("row:ATU7Button", str(_token_shop_row_scope_status(row_scopes.get("row:ATU7Button") or {}).get("status") or "semantic-open"), "ATU7 row-local graph still carries {} and does not add a second exact title exemplar here.".format(", ".join(_token_shop_row_scope_missing_seam_ids(row_scopes.get("row:ATU7Button") or {}) or ["open row-local seams"]))),
            ],
        ),
        make_edge(
            "family-missing-unresolved-identity",
            shell_node,
            unresolved_node,
            "repeated-unresolved-shell-identity-gap",
            "missing",
            "negative",
            "The unresolved ATU3 and late ATU24-ATU28 neighborhoods still fail the exact shell-to-prefab or shell-to-title localization step entirely, even though shell-side serialization and nearby hooks survive.",
            [
                cite_db_materialized_target(
                    "token-shop-atu3-cells-effect",
                    "$.decisionSummary.summary",
                    str(atu3_decision_summary.get("summary") or "ATU3 remains quarantined to descriptive remap evidence."),
                ),
                cite_token_shop_extract_field("ATU24Button", token_shop_extract, "Late unresolved shells still survive only as exact serialized TokenShop fields."),
                cite_hit(unresolved_lane_source, buy_late_hit),
                cite_hit(level0_title_source, late_title_hit),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-family", shell_window["shellField"], "present", "The ATU shell family is preserved as one exact serialized TokenShop range."),
            make_node(solved_node, "solved-shell-subset", "ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU7Button", "present", "Six shell neighborhoods now preserve checked row-family structure."),
            make_node(proxy_node, "row-family-proxy-lane", "BuyTokenBoost, ATU2DiamondsBonus, BuyModBoost, BuyMK1TokenBoost, BuyMK2TokenBoost, BuyMK3TokenBoost", "present", "Row-family proxy hooks survive on the strongest solved subset."),
            make_node(prefab_node, "prefab-roster", "TokensBoost, DiamondBoost, ModPointsBooster, MK1Booster, MK2Booster, MK3Booster", "present", "Exact prefab identities survive for the solved subset."),
            make_node(title_node, "title-text-surfaces", "SetAllTokenShopTexts, SetTokenTexts, Token Ultima: MP, 1. MK1 Generator Output,", "present", "Title and text surfaces survive repeatedly, but usually as detached clusters."),
            make_node(exemplar_node, "exact-title-exemplar", "ATU6Button -> Mk2 Generator Booster", "present", "ATU6 is the only fully localized shell-to-prefab-to-title chain."),
            make_node(unresolved_node, "bounded-unresolved-neighborhoods", "ATU3Button plus ATU24Button through ATU28Button", "present", "The main unresolved neighborhoods are already checked as bounded negatives."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-repeated-solved-structure",
                "status": "proved",
                "statement": "The strongest solved TokenShop rows repeatedly preserve shell adjacency, one row-family proxy lane, and one exact prefab identity.",
                "edgeIds": ["family-shell-adjacency", "family-proxy-lane", "family-prefab-subset"],
                "provedBy": [citation for edge in edges[:3] for citation in edge["provedBy"]],
            },
            {
                "id": "claim-atu6-standout",
                "status": "proved",
                "statement": "ATU6 is structurally stronger than the rest because it alone clears one exact shell-to-prefab-to-title chain.",
                "edgeIds": ["family-title-exemplar"],
                "provedBy": list(edges[4]["provedBy"]),
            },
            {
                "id": "claim-repeated-gaps",
                "status": "missing",
                "statement": "The family still repeatedly fails the final title-localization step, and unresolved neighborhoods still fail exact identity localization outright.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_family_structure_diff(
    target_id: str,
    target: dict[str, Any],
    token_shop_extract: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    family_context: dict[str, Any],
) -> dict[str, Any]:
    def fallback_surface(surface_id: str) -> dict[str, Any]:
        return maybe_find_surface(surfaces, surface_id) or {"id": surface_id, "sources": []}

    def fallback_source(surface: dict[str, Any], source_id: str) -> dict[str, Any]:
        return maybe_find_source_entry(surface, source_id) or {
            "sourceId": source_id,
            "sourcePath": "db:missing-surface-plan",
            "hits": [],
        }

    def fallback_hit(source_entry: dict[str, Any], term: str) -> dict[str, Any]:
        return maybe_find_hit(source_entry, term) or {"term": term}

    proxy_source = fallback_source(fallback_surface("bridge-proxies"), "level0")
    prefab_source = fallback_source(fallback_surface("prefab-roster"), "level0")
    title_source = fallback_source(fallback_surface("title-text-surfaces"), "level0")
    row_scopes = dict(family_context.get("rowScopes") or {})
    atu3_target = dict(family_context.get("atu3Target") or {})
    atu3_decision_summary = dict(atu3_target.get("decisionSummary") or {})
    late_title_hit = fallback_hit(title_source, "Academy Booster")
    baseline_edges = [
        {
            "type": "repeated-serialized-shell-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The strongest solved subset repeatedly preserves exact serialized shell adjacency.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    shell_window["shellField"],
                    "Solved shell family window recovered from the exact TokenShop payload.",
                ),
            ],
        },
        {
            "type": "repeated-row-family-proxy-lane",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The strongest solved subset repeatedly preserves one row-family proxy hook lane.",
            "provedBy": [
                cite_hit(proxy_source, fallback_hit(proxy_source, "BuyTokenBoost")),
                cite_hit(proxy_source, fallback_hit(proxy_source, "BuyMK1TokenBoost")),
                cite_hit(proxy_source, fallback_hit(proxy_source, "BuyMK2TokenBoost")),
                cite_hit(proxy_source, fallback_hit(proxy_source, "BuyMK3TokenBoost")),
            ],
        },
        {
            "type": "repeated-shell-to-prefab-subset",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The strongest solved subset repeatedly preserves exact prefab identities.",
            "provedBy": [
                cite_hit(prefab_source, fallback_hit(prefab_source, "NewTokenUPGPrefab.T1.TokensBoost")),
                cite_hit(prefab_source, fallback_hit(prefab_source, "NewTokenUPGPrefab.T1.MK2Booster")),
                cite_hit(prefab_source, fallback_hit(prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")),
            ],
        },
        {
            "type": "exact-shell-to-title-exemplar",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU6 contributes one exact shell-to-prefab-to-title exemplar.",
            "provedBy": [
                cite_hit(title_source, fallback_hit(title_source, "Mk2 Generator Booster")),
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "repeated-serialized-shell-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The unresolved neighborhoods still preserve exact serialized shell-side neighborhoods.",
            "provedBy": [
                cite_token_shop_extract_field("ATU3Button", token_shop_extract, "ATU3 remains inside the exact serialized TokenShop controller range."),
                cite_token_shop_extract_field("ATU24Button", token_shop_extract, "Late unresolved shells remain inside the exact serialized TokenShop controller range."),
                cite_token_shop_extract_field("ATU28Button", token_shop_extract),
            ],
        },
        {
            "type": "repeated-row-family-proxy-lane",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "Some unresolved neighborhoods still preserve nearby generic or late buy-hook shells.",
            "provedBy": [
                cite_hit(proxy_source, fallback_hit(proxy_source, "BuyCellBoost")),
                cite_hit(proxy_source, fallback_hit(proxy_source, "BuyATU24")),
            ],
        },
        {
            "type": "repeated-shell-to-prefab-subset",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The unresolved neighborhoods still do not preserve exact shell-to-prefab localization.",
            "provedBy": [
                cite_db_materialized_target(
                    "token-shop-atu3-cells-effect",
                    "$.decisionSummary.summary",
                    str(atu3_decision_summary.get("summary") or "ATU3 remains quarantined to descriptive remap evidence."),
                ),
                cite_token_shop_extract_field("ATU24Button", token_shop_extract),
                cite_hit(proxy_source, fallback_hit(proxy_source, "BuyATU24")),
            ],
        },
        {
            "type": "exact-shell-to-title-exemplar",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The unresolved neighborhoods still do not preserve one exact shell-to-final-title chain.",
            "provedBy": [
                cite_db_semantic_scope("row:ATU3Button", str(_token_shop_row_scope_status(row_scopes.get("row:ATU3Button") or {}).get("status") or "semantic-open"), "ATU3 row-local graph still carries {} and does not clear one exact shell-to-final-title exemplar.".format(", ".join(_token_shop_row_scope_missing_seam_ids(row_scopes.get("row:ATU3Button") or {}) or ["open row-local seams"]))),
                cite_token_shop_extract_field("ATU24Button", token_shop_extract),
                cite_hit(title_source, late_title_hit),
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
            "id": "token-shop-family-structure",
            "label": "TokenShop solved family structure",
            "status": "cleared",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]),
            "shellField": "ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU7Button",
            "shellPathId": "solved-subset",
            "comparisonShape": baseline_edges,
            "groundedConclusion": "The strongest solved TokenShop subset repeatedly preserves shell adjacency, one row-family proxy lane, and one exact prefab identity, with ATU6 adding one exact title-chain exemplar.",
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]),
            "shellField": "ATU3Button plus ATU24Button through ATU28Button",
            "shellPathId": "bounded-unresolved-neighborhoods",
            "comparisonShape": blocked_edges,
            "groundedConclusion": "The unresolved TokenShop neighborhoods still preserve shell-side serialization and some proxy hooks, but exact prefab and title localization remain blocked.",
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both the solved and unresolved neighborhoods still preserve shell-side ATU serialization.",
                "The strongest solved subset adds repeated row-family proxy hooks and exact prefab identities, while ATU6 alone adds one exact title-chain exemplar.",
                "The unresolved neighborhoods still stop before exact prefab or final-title localization, so the family audit remains descriptive rather than promotive.",
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
        "sourcePath": get_source_reference(source_id),
        "searchModes": get_source_search_modes(source_id),
        "hitCount": len(hits),
        "highSignalHitCount": len(hits),
        "supportingHitCount": 0,
        "incidentalHitCount": 0,
        "suppressedNoiseCount": 0,
        "hits": hits,
    }


def make_surface_hit(term: str, json_path: str) -> dict[str, Any]:
    return {
        "term": term,
        "jsonPath": json_path,
        "signalTier": "high-signal",
        "signalScore": 100,
        "matchMode": "exact-structured",
    }


def build_surface_bundle(
    surface: dict[str, Any],
    anchors: list[str],
    documents: dict[str, Any],
    shell_window: dict[str, Any] | None,
    available_source_ids: list[str],
    extended_search: int,
) -> dict[str, Any]:
    terms = list(dict.fromkeys([*surface["terms"], *anchors]))
    anchor_specs = build_anchor_specs(terms, "surface-search")
    canonical_source_ids = unique_strings([canonicalize_source_family_id(source_id) for source_id in surface["sourceIds"]])
    sources = [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in canonical_source_ids]

    if extended_search > 0:
        for source_id in available_source_ids:
            if source_id in canonical_source_ids:
                continue
            source_entry = collect_source_hits(documents, source_id, anchor_specs, shell_window)
            if source_entry["hitCount"] <= 0:
                continue
            source_entry["searchExtension"] = "supplemental"
            sources.append(source_entry)

    return {
        "id": surface["id"],
        "label": surface["label"],
        "terms": terms,
        "anchorSpecs": anchor_specs,
        "sources": sources,
    }


def resolve_surface_plan(
    trace_scope: str,
    fallback_shell_window: dict[str, Any],
    fallback_surfaces: list[dict[str, Any]],
    target: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    surface_plan = load_or_synthesize_surface_plan(trace_scope, target)
    if not surface_plan:
        return fallback_shell_window, fallback_surfaces
    planned_shell_window = dict(surface_plan.get("shellWindow") or {})
    planned_surfaces = []
    for surface in list(surface_plan.get("surfacePlans") or []):
        if not isinstance(surface, dict):
            continue
        planned_surfaces.append(
            {
                "id": str(surface.get("id") or ""),
                "label": str(surface.get("label") or ""),
                "terms": list(surface.get("terms") or []),
                "sourceIds": list(surface.get("sourceIds") or []),
            }
        )
    if not planned_surfaces:
        return fallback_shell_window, fallback_surfaces
    return planned_shell_window or fallback_shell_window, planned_surfaces


def resolve_token_shop_surface_plan(
    trace_scope: str,
    fallback_shell_window: dict[str, Any],
    fallback_surfaces: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    target = {"id": trace_scope, "familyId": "token-shop"}
    return resolve_surface_plan(trace_scope, fallback_shell_window, fallback_surfaces, target)


def build_token_shop_fallback_shell_window(
    trace_scope: str,
    target: dict[str, Any],
    token_shop_extract: dict[str, Any],
) -> dict[str, Any]:
    extract_fields = {
        str(field.get("field") or "").strip()
        for field in (token_shop_extract.get("fields") or [])
        if isinstance(field, dict) and str(field.get("field") or "").strip()
    }

    def resolve_concrete_shell_field(*candidate_groups: Any) -> str:
        for group in candidate_groups:
            if isinstance(group, str):
                candidate = str(group).strip()
                if candidate in extract_fields:
                    return candidate
                continue
            if isinstance(group, dict):
                nested_values = [
                    group.get("shellField"),
                    group.get("field"),
                    group.get("terms"),
                    group.get("anchors"),
                    group.get("defaultAnchors"),
                ]
                candidate = resolve_concrete_shell_field(*nested_values)
                if candidate:
                    return candidate
                continue
            if isinstance(group, (list, tuple, set)):
                for item in group:
                    candidate = resolve_concrete_shell_field(item)
                    if candidate:
                        return candidate
        return ""

    surface_plan = load_or_synthesize_surface_plan(trace_scope, target)
    shell_seed = dict(surface_plan.get("shellWindow") or {})
    shell_field = resolve_concrete_shell_field(shell_seed.get("shellField"), shell_seed)
    shell_radius = shell_seed.get("shellWindowRadius")
    try:
        radius = int(shell_radius)
    except (TypeError, ValueError):
        radius = None
    if shell_field and radius is not None:
        return get_shell_window(token_shop_extract, shell_field, radius)
    strategy_config = load_or_synthesize_support_context(trace_scope, target) or get_target_strategy_config(target)
    resolved_shell_field = resolve_concrete_shell_field(
        strategy_config.get("shellField"),
        strategy_config.get("surfaces"),
        strategy_config.get("defaultAnchors"),
        target.get("anchors"),
        shell_field,
    )
    return get_shell_window(
        token_shop_extract,
        resolved_shell_field,
        int(strategy_config.get("shellWindowRadius") or radius or 0),
    )


def resolve_graph_plan(trace_scope: str) -> dict[str, Any]:
    graph_plan = load_canonical_graph_plan(trace_scope)
    return dict(graph_plan.get("traceGraph") or {})


def resolve_token_shop_graph_plan(trace_scope: str) -> dict[str, Any]:
    return resolve_graph_plan(trace_scope)


def resolve_token_shop_bridge_policy(trace_scope: str, fallback_rule: str) -> str:
    return resolve_bridge_policy(trace_scope, fallback_rule)


def resolve_bridge_policy(trace_scope: str, fallback_rule: str) -> str:
    bridge_policy = load_canonical_bridge_policy(trace_scope)
    rule = str(bridge_policy.get("bridgePromotionRule") or "").strip()
    return rule or fallback_rule


def resolve_token_shop_lost_structure(trace_scope: str, fallback_values: list[str]) -> list[str]:
    return resolve_lost_structure(trace_scope, fallback_values)


def resolve_lost_structure(trace_scope: str, fallback_values: list[str]) -> list[str]:
    bridge_policy = load_canonical_bridge_policy(trace_scope)
    values = [str(item) for item in (bridge_policy.get("lostStructure") or []) if str(item).strip()]
    return values or list(fallback_values)


def resolve_target_narrative(
    trace_scope: str,
    fallback_grounded_conclusion: str,
    fallback_current_boundary: list[str],
    *,
    subject_kind: str = "",
    subject_key: str = "",
    family_id: str = "",
    compatibility_target_id: str = "",
    allow_fallback: bool = False,
) -> dict[str, Any]:
    narrative = get_trace_db().find_or_synthesize_target_narrative(
        "cifi-full",
        "libil2cpp.so",
        trace_scope,
        subject_kind=subject_kind,
        subject_key=subject_key,
        family_id=family_id,
        compatibility_target_id=compatibility_target_id,
    )
    semantic_key = str(narrative.get("semanticKey") or f"target-narrative:{trace_scope}")
    grounded_conclusion = str(narrative.get("groundedConclusion") or "").strip()
    current_boundary = [
        str(line).strip()
        for line in (narrative.get("currentBoundary") or [])
        if str(line).strip()
    ]
    if grounded_conclusion or current_boundary:
        return {
            "narrativeSemanticKey": semantic_key,
            "groundedConclusion": grounded_conclusion,
            "currentBoundary": current_boundary,
            "narrativeOwner": "canonical-target-narrative-fragment",
        }
    if allow_fallback:
        return {
            "narrativeSemanticKey": semantic_key,
            "groundedConclusion": str(fallback_grounded_conclusion or "").strip(),
            "currentBoundary": [str(line).strip() for line in fallback_current_boundary if str(line).strip()],
            "narrativeOwner": "bundle-fallback-narrative-seed",
        }
    missing_note = "Canonical target narrative fragment pending rebuild for this target."
    return {
        "narrativeSemanticKey": semantic_key,
        "groundedConclusion": missing_note,
        "currentBoundary": [missing_note],
        "narrativeOwner": "missing-canonical-target-narrative-fragment",
    }


def collect_depth_followup_terms(surfaces: list[dict[str, Any]], seed_terms: list[str], limit: int = 12) -> list[str]:
    output: list[str] = []
    seen = set(seed_terms)
    for surface in surfaces:
        for source in surface["sources"]:
            for hit in source["hits"]:
                term = str(hit.get("term", "")).strip()
                if not term or term in seen:
                    continue
                signal_tier = hit.get("signalTier")
                if signal_tier not in {"high-signal", "supporting"}:
                    continue
                if len(term) > 120:
                    continue
                seen.add(term)
                output.append(term)
                if len(output) >= limit:
                    return output
    return output


def get_strategy_surface_lookup(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    lookup: dict[str, dict[str, Any]] = {}
    for surface in config.get("surfaces", []):
        lookup[str(surface["id"])] = surface
    for surface in config.get("followUpSurfaces", []):
        lookup[str(surface["id"])] = surface
    return lookup


def get_follow_up_surface_ids(config: dict[str, Any]) -> set[str]:
    return {str(surface["id"]) for surface in config.get("followUpSurfaces", [])}


def get_target_strategy_config(target: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(target, dict):
        return {}
    trace_scope = str(target.get("id") or target.get("traceScope") or "").strip()
    support_context = load_or_synthesize_support_context(trace_scope, target) if trace_scope else {}
    return support_context


def get_token_shop_builder_context(
    target_id: str,
    target: dict[str, Any] | None,
    config: dict[str, Any] | None,
    shell_window: dict[str, Any] | None = None,
) -> dict[str, Any]:
    target = dict(target or {})
    config = dict(config or {})
    shell_window = dict(shell_window or {})
    shell_candidates = [
        str(config.get("shellField") or "").strip(),
        str(shell_window.get("shellField") or "").strip(),
        *[str(value).strip() for value in (config.get("defaultAnchors") or []) if str(value).strip()],
        *[str(value).strip() for value in (target.get("anchors") or []) if str(value).strip()],
    ]
    inferred_shell_field = next(
        (
            value
            for value in shell_candidates
            if value and ("ATU" in value or "Button" in value or "Boost" in value)
        ),
        "",
    )
    shell_field = str(
        config.get("shellField")
        or shell_window.get("shellField")
        or inferred_shell_field
        or target_id
    ).strip()
    shell_path_id = str(
        config.get("shellPathId")
        or shell_window.get("shellPathId")
        or "path id unresolved"
    ).strip()
    return {
        "shellField": shell_field or target_id,
        "shellPathId": shell_path_id or "path id unresolved",
        "lostStructure": list(config.get("lostStructure") or []),
    }


def get_target_execution_plan(target: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(target, dict):
        return {}
    return dict(target.get("executionPlan") or {})


def get_primary_surfaces_for_depth(config: dict[str, Any], depth_search: int) -> list[dict[str, Any]]:
    surfaces = list(config.get("surfaces", []))
    if depth_search <= 0:
        return surfaces
    follow_up_ids = get_follow_up_surface_ids(config)
    if not follow_up_ids:
        return surfaces
    return [surface for surface in surfaces if str(surface["id"]) not in follow_up_ids]


def collect_depth_seed_terms_for_target(
    target: dict[str, Any],
    base_seed_terms: list[str],
    depth_search: int,
) -> list[str]:
    if depth_search <= 0:
        return unique_strings(base_seed_terms)

    config = get_target_strategy_config(target)
    execution_plan = get_target_execution_plan(target)
    lookup = get_strategy_surface_lookup(config)
    seed_terms = list(base_seed_terms)
    for step in execution_plan.get("depthPlan", []):
        hop = int(step.get("hop", 0))
        if hop <= 0 or hop > depth_search:
            continue
        for surface_id in step.get("surfaceIds", []):
            surface = lookup.get(str(surface_id))
            if surface:
                seed_terms.extend(surface.get("terms", []))

    follow_up_terms = list(execution_plan.get("followUpTerms", []))
    if follow_up_terms:
        seed_terms.extend(follow_up_terms)
    elif len(seed_terms) == len(base_seed_terms):
        for surface in config.get("followUpSurfaces", []):
            seed_terms.extend(surface.get("terms", []))

    return unique_strings(seed_terms)


def collect_primary_terms_for_target(target: dict[str, Any]) -> list[str]:
    surface_plan = load_or_synthesize_surface_plan(str(target.get("id") or ""), target)
    planned_terms: list[str] = []
    for surface in list(surface_plan.get("surfacePlans") or []):
        if isinstance(surface, dict):
            planned_terms.extend(str(item) for item in (surface.get("terms") or []) if str(item).strip())
    if planned_terms:
        return unique_strings(planned_terms)
    config = get_target_strategy_config(target)
    terms: list[str] = []
    for surface in get_primary_surfaces_for_depth(config, 0):
        terms.extend(surface.get("terms", []))
    return unique_strings(terms)


def collect_primary_source_ids_for_target(target: dict[str, Any]) -> list[str]:
    surface_plan = load_or_synthesize_surface_plan(str(target.get("id") or ""), target)
    planned_source_ids: list[str] = []
    for surface in list(surface_plan.get("surfacePlans") or []):
        if isinstance(surface, dict):
            planned_source_ids.extend(str(item) for item in (surface.get("sourceIds") or []) if str(item).strip())
    if planned_source_ids:
        return unique_strings(planned_source_ids)
    config = get_target_strategy_config(target)
    source_ids: list[str] = []
    for surface in get_primary_surfaces_for_depth(config, 0):
        source_ids.extend(str(item) for item in surface.get("sourceIds", []))
    return unique_strings(source_ids)


def collect_depth_plan_terms(
    target: dict[str, Any],
    hop_index: int,
) -> tuple[list[str], dict[str, Any]]:
    config = get_target_strategy_config(target)
    execution_plan = get_target_execution_plan(target)
    lookup = get_strategy_surface_lookup(config)
    step = next((item for item in execution_plan.get("depthPlan", []) if int(item.get("hop", -1)) == hop_index), None)
    if not step:
        return [], {"goal": None, "surfaceIds": [], "targetIds": [], "targetLabels": [], "sourceIds": []}

    planned_terms: list[str] = []
    planned_source_ids: list[str] = [str(item) for item in step.get("sourceIds", [])]
    planned_terms.extend(str(item) for item in step.get("terms", []) if str(item).strip())
    for surface_id in step.get("surfaceIds", []):
        surface = lookup.get(str(surface_id))
        if surface:
            planned_terms.extend(surface.get("terms", []))
            planned_source_ids.extend(str(item) for item in surface.get("sourceIds", []))

    target_labels: list[str] = []
    for target_id in step.get("targetIds", []):
        handoff_target = load_handoff_target_metadata(str(target_id))
        if not handoff_target:
            continue
        planned_terms.extend(collect_primary_terms_for_target(handoff_target))
        planned_source_ids.extend(collect_primary_source_ids_for_target(handoff_target))
        target_labels.append(str(handoff_target.get("label", target_id)))

    return unique_strings(planned_terms), {
        "goal": step.get("goal"),
        "surfaceIds": [str(item) for item in step.get("surfaceIds", [])],
        "targetIds": [str(item) for item in step.get("targetIds", [])],
        "targetLabels": target_labels,
        "sourceIds": unique_strings(planned_source_ids),
    }


def build_depth_expansion(
    base_surfaces: list[dict[str, Any]],
    documents: dict[str, Any],
    shell_window: dict[str, Any] | None,
    available_source_ids: list[str],
    depth_search: int,
    seed_terms: list[str],
    target: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if depth_search <= 0:
        return []

    hops: list[dict[str, Any]] = []
    current_terms = unique_strings([*seed_terms, *collect_depth_followup_terms(base_surfaces, [])])
    seen_terms: set[str] = set()

    for hop_index in range(1, depth_search + 1):
        if not current_terms:
            break
        planned_terms, planned_step = collect_depth_plan_terms(target or {}, hop_index) if target else ([], {"goal": None, "surfaceIds": [], "targetIds": [], "targetLabels": [], "sourceIds": []})
        hop_terms = unique_strings([*current_terms, *planned_terms])
        if not hop_terms:
            break
        anchor_specs = build_anchor_specs(hop_terms, f"depth-hop-{hop_index}")
        sources: list[dict[str, Any]] = []
        hop_source_ids = planned_step["sourceIds"] or available_source_ids
        for source_id in hop_source_ids:
            source_entry = collect_source_hits(documents, source_id, anchor_specs, shell_window)
            if source_entry["hitCount"] <= 0:
                continue
            sources.append(source_entry)
        hops.append(
            {
                "hop": hop_index,
                "goal": planned_step["goal"],
                "plannedSurfaceIds": planned_step["surfaceIds"],
                "plannedTargetIds": planned_step["targetIds"],
                "plannedTargetLabels": planned_step["targetLabels"],
                "plannedSourceIds": planned_step["sourceIds"],
                "terms": hop_terms,
                "anchorSpecs": anchor_specs,
                "sources": sources,
            }
        )
        next_terms = collect_depth_followup_terms(
            [{"id": f"depth-hop-{hop_index}", "label": f"Depth hop {hop_index}", "sources": sources}],
            list(seen_terms),
        )
        seen_terms.update(hop_terms)
        current_terms = next_terms
    return hops


def make_generic_shell_window() -> dict[str, Any]:
    return {
        "source": "generic-explore",
        "shellField": "generic-explore",
        "shellPathId": "n/a",
        "shellObjectOffset": None,
        "ownerFieldBlock": [],
        "window": [],
    }


def build_generic_explore_trace(anchors: list[str], source_ids: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    shell_window = make_generic_shell_window()
    anchor_specs = build_anchor_specs(anchors, "generic-explore")
    sources = [collect_source_hits(documents, source_id, anchor_specs, None) for source_id in source_ids]
    sources = [source for source in sources if source["hitCount"] > 0]
    total_hits = sum(source["hitCount"] for source in sources)
    trace_graph = {
        "nodes": [
            make_node("query", "query-anchor-set", ", ".join(anchors) or "explore", "present", "The ambiguous query or anchor set being searched across committed sources."),
            make_node("results", "cross-source-results", f"{total_hits} hits across {len(sources)} sources", "present" if total_hits else "missing", "Cross-source exploratory search results for unknown or ambiguous terms."),
        ],
        "edges": [
            make_edge(
                "query-to-results",
                "query",
                "results",
                "cross-source-search",
                "present" if total_hits else "missing",
                "direct" if total_hits else "negative",
                "The generic explore run searched committed metadata, Unity assets, and bounded extraction documents without forcing a family remap.",
                [],
            )
        ],
        "negativeEdges": [],
        "claimLedger": [],
    }
    return {
        "shellWindow": shell_window,
        "surfaces": [
            {
                "id": "cross-source-search",
                "label": "Cross-source search",
                "terms": anchors,
                "anchorSpecs": anchor_specs,
                "sources": sources,
            }
        ],
        "traceGraph": trace_graph,
        "bridgePromotionRule": "Generic exploration never promotes canonical joins by itself; use it to locate candidate families, owners, methods, titles, or prefab surfaces before a targeted family trace.",
        "bridgeCheck": {
            "candidateTerms": anchors,
            "bridgeCleared": False,
            "bridgeHits": [],
            "result": "cross-source exploration only",
        },
        "solvedVsBlockedDiff": {
            "baseline": {
                "id": "generic-explore",
                "label": "Generic explore baseline",
                "status": "exploration",
                "sourcePath": "generic-explore",
                "shellField": "generic-explore",
                "shellPathId": "n/a",
                "comparisonShape": [],
                "groundedConclusion": "Generic exploration is a search surface, not a solved-vs-blocked remap comparison.",
            },
            "blockedTarget": {
                "id": "generic-explore",
                "label": "Generic explore baseline",
                "status": "exploration",
                "sourcePath": "generic-explore",
                "shellField": "generic-explore",
                "shellPathId": "n/a",
                "comparisonShape": [],
                "groundedConclusion": "Generic exploration is a search surface, not a solved-vs-blocked remap comparison.",
            },
            "delta": {
                "sharedPresentEdgeTypes": [],
                "baselineOnlyPresentEdgeTypes": [],
                "blockedMissingEdgeTypes": [],
                "solvedVsBlockedSummary": [
                    "This run is exploratory only.",
                    "Use the returned hit surfaces to choose a family or define a new bounded target.",
                ],
            },
        },
        "lostStructure": [
            "Generic exploration does not infer ownership, row identity, or canonical joins by itself.",
            "Ambiguous strings can hit multiple surfaces and may require a follow-up family trace or new bounded target to disambiguate.",
        ],
        "groundedConclusion": (
            "The generic explore fallback preserves ambiguous search capability across committed sources without pretending unknown strings already map to one verified family or object."
        ),
        "currentBoundary": [
            "Treat this as discovery output only.",
            "Do not promote labels, joins, or formulas from generic exploration into canonical state without a bounded follow-up trace.",
            "Use the strongest surviving source surfaces to pick or define the next explicit family target.",
        ],
        "outcome": {
            "kind": "exploration",
            "label": "Generic cross-source exploration",
            "summary": f"Recovered {total_hits} hits across {len(sources)} sources for ambiguous input.",
        },
    }


def build_token_shop_mod_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    fallback_shell_window = build_token_shop_fallback_shell_window(target_id, target, documents["tokenShopExtract"])
    fallback_surface_specs = []
    shell_window, surface_specs = resolve_token_shop_surface_plan(target_id, fallback_shell_window, fallback_surface_specs)
    builder_context = get_token_shop_builder_context(target_id, target, config, shell_window)
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in surface_specs]
    provisional_payload = {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "bridgeCheck": {"bridgeHits": []},
        "traceGraph": {"nodes": [], "edges": [], "negativeEdges": [], "claimLedger": []},
    }
    row_recovery = _build_token_shop_row_recovery(target, provisional_payload, {"summary": {}}) or {}
    row_scope = load_canonical_semantic_scope("row:ATU4Button")
    action_method = next(iter(row_recovery.get("recoveredActionMethods", [])), "BuyModBoost")
    prefab_identity = next(iter(row_recovery.get("prefabCandidates", [])), "NewTokenUPGPrefab.T1.ModPointsBooster")

    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, target),
        "traceGraph": build_mod_trace_graph(shell_window, surfaces, row_recovery, row_scope),
        "bridgePromotionRule": resolve_token_shop_bridge_policy(target_id, "Only promote a TokenShop row from live assets and native evidence when one checked shell-side owner block, one row-specific action hook, one exact prefab identity, and one recovered presentation slot graph converge on the same row family."),
        "bridgeCheck": {
            "candidateTerms": [action_method, prefab_identity],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": action_method},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": prefab_identity},
            ],
            "result": "direct asset/native row bridge recovered",
        },
        "solvedVsBlockedDiff": build_mod_vs_blocked_diff(target_id, target, shell_window, surfaces, row_recovery, row_scope),
        "lostStructure": resolve_token_shop_lost_structure(target_id, list(builder_context["lostStructure"])),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def build_token_shop_mk1_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    token_shop_extract = documents["tokenShopExtract"]
    fallback_shell_window = build_token_shop_fallback_shell_window(target_id, target, token_shop_extract)
    mk1_context = {
        "rowScope": load_canonical_semantic_scope("row:ATU3Button"),
        "effectTarget": load_latest_materialized_target_bundle("token-shop-atu3-cells-effect"),
    }
    fallback_surface_specs = []
    shell_window, surface_specs = resolve_token_shop_surface_plan(target_id, fallback_shell_window, fallback_surface_specs)
    builder_context = get_token_shop_builder_context(target_id, target, config, shell_window)
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in surface_specs]
    comparison_seed = build_mk1_vs_blocked_diff(target_id, target, shell_window, surfaces, token_shop_extract, mk1_context)
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, target),
        "traceGraph": resolve_token_shop_graph_plan(target_id) or build_mk1_trace_graph(shell_window, surfaces, row_recovery),
        "bridgePromotionRule": resolve_token_shop_bridge_policy(target_id, "Only promote the traced ATU5 row past quarantine when one exact shell-to-final-title join is recovered; prefab-only and support-text-only evidence remains remap-only."),
        "bridgeCheck": {
            "candidateTerms": [builder_context["shellField"], "BuyMK1TokenBoost", "NewTokenUPGPrefab.T1.MK1Booster"],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "BuyMK1TokenBoost"},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "NewTokenUPGPrefab.T1.MK1Booster"},
            ],
"result": "checked object bridge recovered",
        },
        "solvedVsBlockedDiff": comparison_seed["delta"],
        "lostStructure": resolve_token_shop_lost_structure(target_id, list(builder_context["lostStructure"])),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def build_token_shop_mk3_bridge_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    token_shop_extract = documents["tokenShopExtract"]
    fallback_shell_window = build_token_shop_fallback_shell_window(target_id, target, token_shop_extract)
    mk3_context = {
        "rowScope": load_canonical_semantic_scope("row:ATU7Button"),
        "effectTarget": load_latest_materialized_target_bundle("token-shop-atu3-cells-effect"),
    }
    fallback_surface_specs = []
    shell_window, surface_specs = resolve_token_shop_surface_plan(target_id, fallback_shell_window, fallback_surface_specs)
    builder_context = get_token_shop_builder_context(target_id, target, config, shell_window)
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in surface_specs]
    comparison_seed = build_mk3_vs_blocked_diff(target_id, target, shell_window, surfaces, token_shop_extract, mk3_context)
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, target),
        "traceGraph": resolve_token_shop_graph_plan(target_id) or build_mk3_bridge_trace_graph(shell_window, surfaces),
        "bridgePromotionRule": resolve_token_shop_bridge_policy(target_id, "Only promote the traced ATU7 row as one bounded remap bridge when one checked shell-side owner block, one row-specific action hook, and one exact prefab identity converge on the same row family; do not infer any final title from this pass."),
        "bridgeCheck": {
            "candidateTerms": [builder_context["shellField"], "BuyMK3TokenBoost", "NewTokenUPGPrefab.T1.MK3Booster"],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "BuyMK3TokenBoost"},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "NewTokenUPGPrefab.T1.MK3Booster"},
            ],
"result": "checked object bridge recovered",
        },
        "solvedVsBlockedDiff": comparison_seed["delta"],
        "lostStructure": resolve_token_shop_lost_structure(target_id, list(builder_context["lostStructure"])),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def build_token_shop_atu3_effect_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    token_shop_extract = documents["tokenShopExtract"]
    fallback_shell_window = build_token_shop_fallback_shell_window(target_id, target, token_shop_extract)
    effect_context = {
        "rowScope": load_canonical_semantic_scope("row:ATU3Button"),
        "chestConsumerTarget": load_latest_materialized_target_bundle("token-shop-atu3-chest-consumer"),
        "consumerReadTarget": load_latest_materialized_target_bundle("token-shop-atu3-chest-consumer-read"),
    }
    fallback_surface_specs = []
    shell_window, effect_surfaces = resolve_token_shop_surface_plan(target_id, fallback_shell_window, fallback_surface_specs)
    builder_context = get_token_shop_builder_context(target_id, target, config, shell_window)
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in effect_surfaces]
    depth_expansion = build_depth_expansion(
        surfaces,
        documents,
        shell_window,
        available_source_ids,
        depth_search,
        collect_depth_seed_terms_for_target(target, anchors, depth_search),
        target,
    )
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": depth_expansion,
        "traceGraph": resolve_token_shop_graph_plan(target_id) or build_atu3_effect_trace_graph(shell_window, surfaces, token_shop_extract, effect_context, depth_expansion),
        "bridgePromotionRule": resolve_token_shop_bridge_policy(target_id, "Only preserve ATU3 as an effect-driven row when one checked shell-side owner block, one exact row-family action hook, and one shared chest-effect title or text surface converge on the same cells-from-chests lane; keep typed gameplay owner claims blocked unless the applier is recovered explicitly."),
        "bridgeCheck": {
            "candidateTerms": [builder_context["shellField"], "BuyCellBoost", "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>", "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>."],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "BuyCellBoost"},
                {"surfaceId": "shared-effect-title", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>"},
                {"surfaceId": "shared-effect-text", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>."},
            ],
            "result": "checked action-to-shared-effect chain recovered",
        },
        "solvedVsBlockedDiff": build_atu3_effect_vs_split_diff(target_id, target, shell_window, surfaces, token_shop_extract, effect_context),
        "lostStructure": resolve_token_shop_lost_structure(target_id, list(builder_context["lostStructure"])),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def build_token_shop_atu3_chest_consumer_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    token_shop_extract = documents["tokenShopExtract"]
    fallback_shell_window = build_token_shop_fallback_shell_window(target_id, target, token_shop_extract)
    consumer_context = {
        "effectTarget": load_latest_materialized_target_bundle("token-shop-atu3-cells-effect"),
        "consumerReadTarget": load_latest_materialized_target_bundle("token-shop-atu3-chest-consumer-read"),
    }
    fallback_surface_specs = []
    shell_window, surface_specs = resolve_token_shop_surface_plan(target_id, fallback_shell_window, fallback_surface_specs)
    builder_context = get_token_shop_builder_context(target_id, target, config, shell_window)
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in surface_specs]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, target),
        "traceGraph": resolve_token_shop_graph_plan(target_id) or build_atu3_chest_consumer_trace_graph(shell_window, surfaces, consumer_context),
        "bridgePromotionRule": resolve_token_shop_bridge_policy(target_id, "Only preserve ATU3 as a consumer-seam row when one checked shared chest-effect lane, one concrete chest consumer family, one chest-routine neighborhood, and one chest-bonus shell converge on the same cells-from-chests lane; keep exact CellBoostBonus consumer-method claims blocked unless that handoff is recovered explicitly."),
        "bridgeCheck": {
            "candidateTerms": [builder_context["shellField"], "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>", "AdManager, Assembly-CSharp", "<TokenChestRoutine>d__149", "<FinalDiamondChestBonus>k__BackingField"],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "shared-effect-title", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>"},
                {"surfaceId": "consumer-family", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "AdManager, Assembly-CSharp"},
                {"surfaceId": "consumer-routines", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "<TokenChestRoutine>d__149"},
                {"surfaceId": "consumer-routines", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "<FinalDiamondChestBonus>k__BackingField"},
            ],
            "result": "checked shared-effect-to-consumer-family handoff recovered",
        },
        "solvedVsBlockedDiff": build_atu3_consumer_vs_effect_diff(target_id, target, shell_window, surfaces, token_shop_extract, consumer_context),
        "lostStructure": resolve_token_shop_lost_structure(target_id, list(builder_context["lostStructure"])),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def build_atu3_consumer_read_vs_consumer_diff(
    target_id: str,
    target: dict[str, Any],
    shell_window: dict[str, Any],
    consumer_context: dict[str, Any],
) -> dict[str, Any]:
    consumer_summary = dict((consumer_context.get("consumerTarget") or {}).get("decisionSummary") or {})
    baseline_edges = [
        "serialized-adjacency",
        "shared-effect-to-consumer-family",
        "consumer-family-to-chest-routines",
        "consumer-family-to-cell-gain-getters",
        "cell-gain-getters-to-booster-bonus-shell",
        "booster-bonus-shell-to-final-chest-bonus-shell",
    ]
    blocked_edges = [
        "serialized-adjacency",
        "shared-effect-to-consumer-family",
        "consumer-family-to-chest-routines",
        "consumer-family-to-bonus-shell",
    ]
    shared_present = [edge for edge in baseline_edges if edge in blocked_edges]
    baseline_only = [edge for edge in baseline_edges if edge not in blocked_edges]
    blocked_missing = ["exact-cellboost-to-booster-bonus-handoff"]
    return {
        "baseline": {
            "id": "atu3-consumer-internal-read",
            "label": "ATU3 consumer-internal read shell",
            "status": "cleared",
            "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]),
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": "ATU3 now preserves one internal getter-to-booster bonus aggregation shell inside the AdManager chest consumer family, but the exact CellBoostBonus read handoff still remains unresolved.",
        },
        "blockedTarget": {
            "id": target_id,
            "label": "ATU3 chest consumer seam",
            "status": "blocked",
            "sourcePath": "db:materialized-target-bundle:token-shop-atu3-chest-consumer",
            "shellField": shell_window["shellField"],
            "shellPathId": shell_window["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": str(consumer_summary.get("summary") or "The exact CellBoostBonus field handoff still stays bounded negative."),
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both ATU3 consumer traces preserve the direct serialized shell-to-owner-block adjacency and the shared effect-to-consumer-family handoff.",
                "The new internal read trace adds one checked getter-to-booster bonus aggregation shell inside the AdManager chest consumer family.",
                "The remaining bounded break is no longer the outer chest routine family but the exact CellBoostBonus read-site handoff into that internal bonus shell.",
            ],
        },
    }


def build_token_shop_atu3_chest_consumer_read_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    fallback_shell_window = build_token_shop_fallback_shell_window(target_id, target, documents["tokenShopExtract"])
    read_context = {
        "consumerTarget": load_latest_materialized_target_bundle("token-shop-atu3-chest-consumer"),
    }
    fallback_surface_specs = []
    shell_window, surface_specs = resolve_token_shop_surface_plan(target_id, fallback_shell_window, fallback_surface_specs)
    builder_context = get_token_shop_builder_context(target_id, target, config, shell_window)
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in surface_specs]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, target),
        "traceGraph": resolve_token_shop_graph_plan(target_id) or build_atu3_chest_consumer_read_trace_graph(shell_window, surfaces, read_context),
        "bridgePromotionRule": resolve_token_shop_bridge_policy(target_id, "Only preserve ATU3 as a consumer-internal read trace when one checked chest consumer family, one chest routine neighborhood, one cell-gain getter shell, and one booster bonus aggregation shell converge on the same cells-from-chests lane; keep the exact CellBoostBonus runtime read blocked unless that handoff is recovered explicitly."),
        "bridgeCheck": {
            "candidateTerms": [
                builder_context["shellField"],
                "AdManager, Assembly-CSharp",
                "get_SmallAdCellGains",
                "SetBoosterAdBonus",
                "get_FinalBoosterAdBonus",
            ],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "consumer-family", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "AdManager, Assembly-CSharp"},
                {"surfaceId": "cell-gain-getters", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "get_SmallAdCellGains"},
                {"surfaceId": "booster-bonus-shell", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "SetBoosterAdBonus"},
                {"surfaceId": "booster-bonus-shell", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "get_FinalBoosterAdBonus"},
            ],
            "result": "checked consumer-internal bonus shell recovered",
        },
        "solvedVsBlockedDiff": build_atu3_consumer_read_vs_consumer_diff(target_id, target, shell_window, read_context),
        "lostStructure": resolve_token_shop_lost_structure(target_id, list(builder_context["lostStructure"])),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def _build_token_shop_family_profile_payload(
    profile_id: str,
    target_id: str,
    target: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    documents: dict[str, Any],
    available_source_ids: list[str],
    depth_search: int,
    anchors: list[str],
    config: dict[str, Any],
    family_context: dict[str, Any],
) -> dict[str, Any] | None:
    builder_context = get_token_shop_builder_context(target_id, target, config, shell_window)
    provisional_payload = {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "bridgeCheck": {"bridgeHits": []},
        "traceGraph": {"nodes": [], "edges": [], "negativeEdges": [], "claimLedger": []},
    }
    row_recovery: dict[str, Any] = {}
    if profile_id in {"daily-tokenium-family", "t3-trio-family"}:
        row_recovery = _build_token_shop_row_recovery(target, provisional_payload, {"summary": {}}) or {}
    depth_expansion = build_depth_expansion(
        surfaces,
        documents,
        shell_window,
        available_source_ids,
        depth_search,
        anchors,
        target,
    )
    profiles: dict[str, dict[str, Any]] = {
        "daily-tokenium-family": {
            "graph": lambda: build_token_shop_daily_tokenium_family_graph(shell_window, surfaces, token_shop_extract, row_recovery),
            "bridgePromotionRule": "This target is a bounded Daily Tokenium-family audit only. Do not promote cap-owner, planner, or canonical state behavior from it.",
            "bridgeCheck": {
                "candidateTerms": ["ATU14Button", "TokenDailiesT2", "ATU19Button", "T2Duo5"],
                "bridgeCleared": True,
                "bridgeHits": [
                    {"surfaceId": "family-shells", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]), "term": "ATU14Button"},
                    {"surfaceId": "family-shells", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]), "term": "TokenDailiesT2"},
                    {"surfaceId": "prefab-roster", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "NewTokenUPGPrefab.T2.DailyTokens"},
                    {"surfaceId": "prefab-roster", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "NewTokenUPGPrefab.T2.DuoBoosterFive"},
                ],
                "result": "checked Daily Tokenium-family owner-order audit recovered",
            },
            "solvedVsBlockedDiff": lambda: {},
        },
        "t3-trio-family": {
            "graph": lambda: build_token_shop_t3_trio_family_graph(shell_window, surfaces, token_shop_extract, row_recovery),
            "bridgePromotionRule": "This target is a bounded T3 trio-family audit only. Do not promote late-tier, planner, or canonical state behavior from it.",
            "bridgeCheck": {
                "candidateTerms": ["ATU21Button", "T3Trio1", "ATU22Button", "T3Trio2", "ATU23Button"],
                "bridgeCleared": True,
                "bridgeHits": [
                    {"surfaceId": "family-shells", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]), "term": "ATU21Button"},
                    {"surfaceId": "family-shells", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]), "term": "T3Trio1"},
                    {"surfaceId": "action-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "BuyTrio1Boost"},
                    {"surfaceId": "prefab-roster", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "NewTokenUPGPrefab.T3.TrinityBoosterOne"},
                ],
                "result": "checked T3 trio-family owner-order audit recovered",
            },
            "solvedVsBlockedDiff": lambda: {},
        },
        "late-atu-family": {
            "graph": lambda: build_token_shop_late_atu_family_graph(
                shell_window,
                surfaces,
                token_shop_extract,
                dict(documents.get("tokenShopLateAtuBoundary") or {}),
            ),
            "bridgePromotionRule": "This target is a bounded late ATU family audit only. Do not promote row-order guesses, planner behavior, or canonical state behavior from it.",
            "bridgeCheck": {
                "candidateTerms": ["ATU24Button", "ATU28Button", "BuyATU24", "BuyATU28"],
                "bridgeCleared": True,
                "bridgeHits": [
                    {"surfaceId": "family-shells", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["tokenShopExtract"]), "term": "ATU24Button"},
                    {"surfaceId": "action-lane", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "BuyATU24"},
                    {"surfaceId": "title-text-surfaces", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "Tier 3 Max Level Increaser"},
                    {"surfaceId": "prefab-roster", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser"},
                ],
                "result": "checked late ATU shell-side audit recovered",
            },
            "solvedVsBlockedDiff": lambda: {},
        },
        "generic-structure": {
            "graph": lambda: resolve_token_shop_graph_plan(target_id) or build_family_structure_graph(shell_window, surfaces, token_shop_extract, family_context),
            "bridgePromotionRule": "This target is a bounded family audit only. Do not promote any new TokenShop row remaps, planner behavior, or player-facing labels from it.",
            "bridgeCheck": {
                "candidateTerms": ["ATU1Button", "ATU2Button", "ATU4Button", "ATU5Button", "ATU6Button", "ATU7Button", "ATU3Button", "ATU24Button"],
                "bridgeCleared": True,
                "bridgeHits": [
                    {"surfaceId": "bridge-proxies", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "BuyTokenBoost"},
                    {"surfaceId": "bridge-proxies", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "BuyMK1TokenBoost"},
                    {"surfaceId": "prefab-roster", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "NewTokenUPGPrefab.T1.MK2Booster"},
                    {"surfaceId": "title-text-surfaces", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]), "term": "Mk2 Generator Booster"},
                ],
                "result": "checked family structure audit recovered",
            },
            "solvedVsBlockedDiff": lambda: build_family_structure_diff(target_id, target, token_shop_extract, shell_window, surfaces, family_context),
        },
    }
    profile = dict(profiles.get(profile_id) or {})
    if not profile:
        return None
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": depth_expansion,
        "traceGraph": profile["graph"](),
        "bridgePromotionRule": resolve_token_shop_bridge_policy(target_id, str(profile.get("bridgePromotionRule") or "")),
        "bridgeCheck": dict(profile.get("bridgeCheck") or {}),
        "solvedVsBlockedDiff": dict(
            profile["solvedVsBlockedDiff"]() if callable(profile.get("solvedVsBlockedDiff")) else (profile.get("solvedVsBlockedDiff") or {})
        ),
        "lostStructure": resolve_token_shop_lost_structure(target_id, list(builder_context["lostStructure"])),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def build_token_shop_family_structure_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    support_context = load_or_synthesize_support_context(target_id, target)
    builder_context = get_token_shop_builder_context(target_id, target, config)
    token_shop_extract = documents["tokenShopExtract"]
    family_context = {
        "rowScopes": {
            scope_id: load_canonical_semantic_scope(scope_id)
            for scope_id in (
                "row:ATU1Button",
                "row:ATU3Button",
                "row:ATU4Button",
                "row:ATU5Button",
                "row:ATU7Button",
            )
        },
        "atu3Target": load_latest_materialized_target_bundle("token-shop-atu3-cells-effect"),
    }
    fallback_surface_specs = []
    fallback_shell_window = {
        "source": get_source_reference("tokenShopExtract"),
        "shellField": builder_context["shellField"],
        "shellPathId": builder_context["shellPathId"],
        "shellObjectOffset": None,
        "ownerFieldBlock": [
            "TokenBoost / DiamondBoost / ModBoost / MK1TokenBoost / MK2TokenBoost solved-row windows",
            "ATU3 cells-domain split window",
            "ATU24Button through ATU28Button late shell neighborhood",
        ],
        "window": [
            build_token_shop_extract_window_entry(token_shop_extract, "ATU1Button", "solved-shell"),
            build_token_shop_extract_window_entry(token_shop_extract, "ATU2Button", "solved-shell"),
            build_token_shop_extract_window_entry(token_shop_extract, "ATU4Button", "solved-shell"),
            build_token_shop_extract_window_entry(token_shop_extract, "ATU5Button", "solved-shell"),
            build_token_shop_extract_window_entry(token_shop_extract, "ATU6Button", "solved-shell"),
            build_token_shop_extract_window_entry(token_shop_extract, "ATU3Button", "blocked-shell"),
            {"field": "ATU24Button through ATU28Button", "group": "blocked-shell", "kind": "range", "pathId": "ATU24Button path_id 15797 through ATU28Button path_id 15813"},
        ],
    }
    fallback_surface_specs = []
    shell_window, surface_specs = resolve_token_shop_surface_plan(target_id, fallback_shell_window, fallback_surface_specs)
    if not shell_window.get("ownerFieldBlock") or not shell_window.get("window"):
        fallback_row_window = build_token_shop_fallback_shell_window(target_id, target, token_shop_extract)
        shell_window = {
            **fallback_row_window,
            **shell_window,
        }
        shell_window.setdefault("ownerFieldBlock", list(fallback_row_window.get("ownerFieldBlock") or []))
        shell_window.setdefault("window", list(fallback_row_window.get("window") or []))
    surfaces = [build_surface_bundle(surface_config, anchors, documents, shell_window, available_source_ids, extended_search) for surface_config in surface_specs]
    profile_id = str(support_context.get("familyTraceProfile") or "generic-structure").strip()
    profile_payload = _build_token_shop_family_profile_payload(
        profile_id,
        target_id,
        target,
        shell_window,
        surfaces,
        token_shop_extract,
        documents,
        available_source_ids,
        depth_search,
        anchors,
        config,
        family_context,
    )
    if profile_payload is None:
        raise ValueError(f"Unsupported TokenShop family trace profile: {profile_id}")
    return profile_payload


def build_token_shop_daily_tokenium_family_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    row_recovery: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row_recovery = dict(row_recovery or {})
    row_scope_id = str(row_recovery.get("semanticScopeId") or "row:ATU14Button").strip()
    row_scope = load_canonical_semantic_scope(row_scope_id)
    row_scope_status = _token_shop_row_scope_status(row_scope)
    literal_summary = dict(row_recovery.get("literalRecoverySummary") or {})
    title_text = str(literal_summary.get("title") or "").strip()
    presentation_update = dict(row_recovery.get("presentationUpdatePath") or {})
    interaction_paths = list(presentation_update.get("interactionToRenderPaths") or [])
    update_hook_candidates = list(presentation_update.get("updateHookCandidates") or [])
    title_recovered = _token_shop_title_recovered(row_recovery, row_scope)

    shell_surface = find_surface(surfaces, "family-shells")
    effect_surface = find_surface(surfaces, "effect-lane")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-roster")
    title_surface = find_surface(surfaces, "title-text-surfaces")

    extract_source = find_source_entry(shell_surface, "tokenShopExtract")
    metadata_shell_source = maybe_find_source_entry(shell_surface, "metadata")
    metadata_effect_source = maybe_find_source_entry(effect_surface, "metadata")
    level0_effect_source = maybe_find_source_entry(effect_surface, "level0")
    metadata_action_source = maybe_find_source_entry(action_surface, "metadata")
    level0_action_source = maybe_find_source_entry(action_surface, "level0")
    level0_prefab_source = maybe_find_source_entry(prefab_surface, "level0")
    level0_title_source = maybe_find_source_entry(title_surface, "level0")

    atu14_shell_hit = maybe_find_hit(extract_source, "ATU14Button")
    atu19_shell_hit = maybe_find_hit(extract_source, "ATU19Button")
    token_dailies_hit = maybe_find_hit(extract_source, "TokenDailiesT2")
    t2_duo5_hit = maybe_find_hit(extract_source, "T2Duo5")
    effect_hit = maybe_find_hit(metadata_effect_source, "ATU14TokenDailiesBonus") or maybe_find_hit(level0_effect_source, "ATU14TokenDailiesBonus")
    daily_prefab_hit = maybe_find_hit(level0_prefab_source, "NewTokenUPGPrefab.T2.DailyTokens")
    duo_prefab_hit = maybe_find_hit(level0_prefab_source, "NewTokenUPGPrefab.T2.DuoBoosterFive")
    title_hit = maybe_find_hit(level0_title_source, "Daily Tokens T2")
    text_hook_hit = maybe_find_hit(level0_title_source, "SetAllTokenShopTexts") or maybe_find_hit(level0_title_source, "SetTokenTexts")
    direct_action_hit = (
        maybe_find_hit(metadata_action_source, "BuyTokenDailiesT2")
        or maybe_find_hit(level0_action_source, "BuyTokenDailiesT2")
        or maybe_find_hit(metadata_action_source, "BuyTokenDailyT2")
        or maybe_find_hit(level0_action_source, "BuyTokenDailyT2")
    )

    shell_node = "daily-tokenium-family-shells"
    owner_node = "daily-tokenium-owner-order"
    effect_node = "daily-tokenium-effect-lane"
    prefab_node = "daily-tokenium-prefab-roster"
    title_node = "daily-tokenium-title-surfaces"
    unresolved_node = "daily-tokenium-unresolved-seams"

    edges = [
        make_edge(
            "daily-tokenium-owner-order",
            shell_node,
            owner_node,
            "repeated-serialized-shell-adjacency",
            "present",
            "direct",
            "The DB-backed TokenShop owner payload preserves one coherent Daily Tokenium-family shell order from ATU14Button on TokenDailiesT2 through ATU19Button on T2Duo5.",
            compact_citations(
                cite_token_shop_extract_field("ATU14Button", token_shop_extract),
                cite_token_shop_extract_field("TokenDailiesT2StartCost", token_shop_extract),
                cite_hit(extract_source, atu19_shell_hit) if atu19_shell_hit is not None else None,
                cite_token_shop_extract_field("T2Duo5StartCost", token_shop_extract),
            ),
        ),
        make_edge(
            "daily-tokenium-effect-hook",
            owner_node,
            effect_node,
            "row-family-effect-hook",
            "present",
            "direct" if effect_hit is not None else "supporting",
            "ATU14TokenDailiesBonus survives as the checked effect-side clue anchoring the ATU14 start of the Daily Tokenium-family run.",
            compact_citations(
                maybe_cite_hit(metadata_effect_source, effect_hit),
                maybe_cite_hit(level0_effect_source, effect_hit),
            ),
        ),
        make_edge(
            "daily-tokenium-prefab-roster",
            owner_node,
            prefab_node,
            "repeated-prefab-family-candidate",
            "present",
            "supporting",
            "Committed Unity object-name rosters still preserve the matching DailyTokens and T2 duo prefab family identities for this owner-order run.",
            compact_citations(
                maybe_cite_hit(level0_prefab_source, daily_prefab_hit),
                maybe_cite_hit(level0_prefab_source, duo_prefab_hit),
            ),
        ),
        *(
            [
                make_edge(
                    "daily-tokenium-title-bridge",
                    owner_node,
                    title_node,
                    "exact-shell-to-title",
                    "present",
                    "direct",
                    f"ATU14Button now preserves one exact shell-to-title join on {title_text}.",
                    compact_citations(
                        maybe_cite_hit(level0_title_source, title_hit),
                        cite_db_semantic_scope(
                            row_scope_id,
                            str(row_scope_status.get("status") or "semantic-closed"),
                            "Canonical row-local graph now keeps the title seam closed for this shell family.",
                        ),
                    ),
                ),
            ]
            if title_recovered and title_text
            else []
        ),
        *(
            [
                make_edge(
                    "daily-tokenium-display-bridge",
                    owner_node,
                    title_node,
                    "exact-display-update-path",
                    "present",
                    "direct",
                    "ATU14Button now preserves one checked cost-side updater bridge: SetCostRelatedAttributes writes the localized Daily Tokenium-family cost subtree rooted at UPGButton / CostBox / CostText.",
                    compact_citations(
                        {
                            "sourceId": "dbTermView",
                            "sourcePath": "db:materialized-term-view:SetCostRelatedAttributes",
                            "term": "SetCostRelatedAttributes",
                            "locator": "$.managedReconstruction.ownerToTerms",
                            "note": "Cached canonical term view preserves the TokenShop-side cost updater family.",
                        },
                        *[
                            {
                                "sourceId": "level0",
                                "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]),
                                "term": str(item.get("interaction")),
                                "locator": "$.rowRecovery.presentationUpdatePath.interactionToRenderPaths",
                                "note": f"{item.get('hierarchyPath')} -> {item.get('renderNode')}",
                            }
                            for item in interaction_paths
                            if str(item.get("renderRole") or "") == "cost"
                        ],
                        cite_db_semantic_scope(
                            row_scope_id,
                            str(row_scope_status.get("status") or "semantic-open"),
                            "Canonical row-local graph no longer carries an exact-display-update-path seam for this shell family.",
                        ),
                    ),
                ),
            ]
            if update_hook_candidates
            else []
        ),
        make_edge(
            "atu19-not-tokenboostt3",
            owner_node,
            unresolved_node,
            "duplicate-owner-block-ruled-out",
            "present",
            "direct",
            "The owner-side field order no longer supports the old ATU19 equals ATU20 duplicate theory because ATU19 stays on T2Duo5 before the TokenBoostT3 block begins.",
            compact_citations(
                cite_hit(extract_source, t2_duo5_hit) if t2_duo5_hit is not None else None,
                cite_token_shop_extract_field("TokenBoostT3StartCost", token_shop_extract),
            ),
        ),
    ]

    negative_edges = []
    if direct_action_hit is None:
        negative_edges.append(
            make_edge(
                "daily-tokenium-direct-action-gap",
                effect_node,
                unresolved_node,
                "exact-shell-to-action-hook",
                "missing",
                "supporting",
                "The focused DB-backed trace still does not localize one exact shell-local Daily Tokenium direct purchase hook; the action lane remains noisy across singular versus plural method names.",
                compact_citations(
                    cite_row_boundary(
                        "dbSystemUnit",
                        "materialized_system_unit_views:token-shop",
                        "BuyTokenDailiesT2 unresolved in active spend action lane",
                    ),
                ),
            )
        )
    if not title_recovered:
        negative_edges.append(
            make_edge(
                "daily-tokenium-title-gap",
                prefab_node,
                title_node,
                "exact-shell-to-title",
                "missing",
                "supporting",
                "Daily Tokenium title candidates still remain detached from one exact shell-local row-title join and continue to sit beside generic TokenShop text hooks.",
                compact_citations(
                    maybe_cite_hit(level0_title_source, title_hit),
                    maybe_cite_hit(level0_title_source, text_hook_hit),
                ),
            )
        )
    if not update_hook_candidates:
        negative_edges.append(
            make_edge(
                "daily-tokenium-display-gap",
                title_node,
                unresolved_node,
                "exact-display-update-path",
                "missing",
                "supporting",
                (
                    "The current row-local trace now localizes the shell-to-render slot path from UPGButton into DescText and CostText, but it still does not recover one row-specific runtime updater that writes the Daily Tokenium-family presentation."
                    if interaction_paths and not update_hook_candidates
                    else "No committed DB-native semantic scope or materialized target bundle yet localizes the runtime display-update path for the Daily Tokenium-family shell run."
                ),
                compact_citations(
                    maybe_cite_hit(level0_title_source, text_hook_hit),
                    cite_db_semantic_scope(
                        row_scope_id,
                        str(row_scope_status.get("summary") or row_scope_status.get("status") or "semantic-open"),
                        "The canonical row-local graph still carries an exact-display-update-path seam for this shell family.",
                    ),
                ),
            )
        )

    return {
        "nodes": [
            {"id": shell_node, "label": "Daily Tokenium family shells"},
            {"id": owner_node, "label": "Owner-order recovery"},
            {"id": effect_node, "label": "Effect hook lane"},
            {"id": prefab_node, "label": "Prefab family roster"},
            {"id": title_node, "label": "Title and text surfaces"},
            {"id": unresolved_node, "label": "Unresolved seams"},
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
    }


def build_token_shop_t3_trio_family_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    row_recovery: dict[str, Any] | None = None,
) -> dict[str, Any]:
    row_recovery = dict(row_recovery or {})
    row_scope_id = str(row_recovery.get("semanticScopeId") or "row:ATU21Button").strip()
    row_scope = load_canonical_semantic_scope(row_scope_id)
    row_scope_status = _token_shop_row_scope_status(row_scope)
    literal_summary = dict(row_recovery.get("literalRecoverySummary") or {})
    title_text = str(literal_summary.get("title") or "").strip()
    presentation_update = dict(row_recovery.get("presentationUpdatePath") or {})
    interaction_paths = list(presentation_update.get("interactionToRenderPaths") or [])
    update_hook_candidates = list(presentation_update.get("updateHookCandidates") or [])
    title_recovered = _token_shop_title_recovered(row_recovery, row_scope)

    shell_surface = find_surface(surfaces, "family-shells")
    effect_surface = find_surface(surfaces, "effect-lane")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-roster")
    title_surface = find_surface(surfaces, "title-text-surfaces")

    extract_source = find_source_entry(shell_surface, "tokenShopExtract")
    metadata_effect_source = maybe_find_source_entry(effect_surface, "metadata")
    level0_effect_source = maybe_find_source_entry(effect_surface, "level0")
    metadata_action_source = maybe_find_source_entry(action_surface, "metadata")
    level0_action_source = maybe_find_source_entry(action_surface, "level0")
    level0_prefab_source = maybe_find_source_entry(prefab_surface, "level0")
    level0_title_source = maybe_find_source_entry(title_surface, "level0")

    atu21_shell_hit = maybe_find_hit(extract_source, "ATU21Button")
    atu22_shell_hit = maybe_find_hit(extract_source, "ATU22Button")
    atu23_shell_hit = maybe_find_hit(extract_source, "ATU23Button")
    trio1_hit = maybe_find_hit(extract_source, "T3Trio1")
    trio2_hit = maybe_find_hit(extract_source, "T3Trio2")
    atu24_start_hit = maybe_find_hit(extract_source, "ATU24StartCost")
    effect_hit = maybe_find_hit(metadata_effect_source, "ATU21TokenDailiesBonus") or maybe_find_hit(level0_effect_source, "ATU21TokenDailiesBonus")
    trio1_action_hit = maybe_find_hit(metadata_action_source, "BuyTrio1Boost") or maybe_find_hit(level0_action_source, "BuyTrio1Boost")
    trio2_action_hit = maybe_find_hit(metadata_action_source, "BuyTrio2Boost") or maybe_find_hit(level0_action_source, "BuyTrio2Boost")
    trio1_prefab_hit = maybe_find_hit(level0_prefab_source, "NewTokenUPGPrefab.T3.TrinityBoosterOne")
    trio2_prefab_hit = maybe_find_hit(level0_prefab_source, "NewTokenUPGPrefab.T3.TrinityBoosterTwo")
    title_hit = maybe_find_hit(level0_title_source, "Trinity Booster One")
    detached_title_hit = maybe_find_hit(level0_title_source, "Trinity Oom Booster") or maybe_find_hit(level0_title_source, "Tier 3 Max Level Increaser")
    text_hook_hit = maybe_find_hit(level0_title_source, "SetAllTokenShopTexts") or maybe_find_hit(level0_title_source, "SetTokenTexts")

    shell_node = "t3-trio-family-shells"
    owner_node = "t3-trio-owner-order"
    effect_node = "t3-trio-effect-lane"
    action_node = "t3-trio-action-lane"
    prefab_node = "t3-trio-prefab-roster"
    title_node = "t3-trio-title-surfaces"
    unresolved_node = "t3-trio-unresolved-seams"

    edges = [
        make_edge(
            "t3-trio-owner-order",
            shell_node,
            owner_node,
            "repeated-serialized-shell-adjacency",
            "present",
            "direct",
            "The DB-backed TokenShop owner payload preserves one coherent T3 trio shell order: ATU21Button aligns to T3Trio1, ATU22Button aligns to T3Trio2, and ATU23Button advances straight into the ATU24 block.",
            compact_citations(
                cite_hit(extract_source, atu21_shell_hit) if atu21_shell_hit is not None else None,
                cite_hit(extract_source, trio1_hit) if trio1_hit is not None else None,
                cite_hit(extract_source, atu22_shell_hit) if atu22_shell_hit is not None else None,
                cite_hit(extract_source, trio2_hit) if trio2_hit is not None else None,
                cite_hit(extract_source, atu23_shell_hit) if atu23_shell_hit is not None else None,
                cite_hit(extract_source, atu24_start_hit) if atu24_start_hit is not None else None,
            ),
        ),
        make_edge(
            "t3-trio-effect-hook",
            owner_node,
            effect_node,
            "row-family-effect-hook",
            "present",
            "direct" if effect_hit is not None else "supporting",
            "ATU21TokenDailiesBonus survives as the checked effect-side clue at the start of the T3 trio neighborhood.",
            compact_citations(
                maybe_cite_hit(metadata_effect_source, effect_hit),
                maybe_cite_hit(level0_effect_source, effect_hit),
            ),
        ),
        make_edge(
            "t3-trio-action-lane",
            owner_node,
            action_node,
            "row-family-action-hook-subset",
            "present",
            "supporting",
            "Named trio buy hooks survive for the two concrete T3 numeric blocks through BuyTrio1Boost and BuyTrio2Boost, while no third trio buy hook survives beside ATU23.",
            compact_citations(
                maybe_cite_hit(metadata_action_source, trio1_action_hit),
                maybe_cite_hit(metadata_action_source, trio2_action_hit),
                maybe_cite_hit(level0_action_source, trio1_action_hit),
                maybe_cite_hit(level0_action_source, trio2_action_hit),
            ),
        ),
        make_edge(
            "t3-trio-prefab-roster",
            owner_node,
            prefab_node,
            "repeated-prefab-family-candidate",
            "present",
            "supporting",
            "Committed Unity object-name rosters preserve the matching TrinityBoosterOne and TrinityBoosterTwo prefab identities for the two concrete T3 trio rows.",
            compact_citations(
                maybe_cite_hit(level0_prefab_source, trio1_prefab_hit),
                maybe_cite_hit(level0_prefab_source, trio2_prefab_hit),
            ),
        ),
        *(
            [
                make_edge(
                    "t3-trio-title-bridge",
                    owner_node,
                    title_node,
                    "exact-shell-to-title",
                    "present",
                    "direct",
                    f"ATU21Button now preserves one exact shell-to-title join on {title_text}.",
                    compact_citations(
                        maybe_cite_hit(level0_title_source, title_hit),
                        cite_db_semantic_scope(
                            row_scope_id,
                            str(row_scope_status.get("status") or "semantic-closed"),
                            "Canonical row-local graph now keeps the title seam closed for this shell family.",
                        ),
                    ),
                ),
            ]
            if title_recovered and title_text
            else []
        ),
        *(
            [
                make_edge(
                    "t3-trio-display-bridge",
                    owner_node,
                    title_node,
                    "exact-display-update-path",
                    "present",
                    "direct",
                    "ATU21Button now preserves one checked cost-side updater bridge into the localized T3 trio presentation subtree.",
                    compact_citations(
                        *[
                            {
                                "sourceId": "level0",
                                "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["level0"]),
                                "term": str(item.get("interaction")),
                                "locator": "$.rowRecovery.presentationUpdatePath.interactionToRenderPaths",
                                "note": f"{item.get('hierarchyPath')} -> {item.get('renderNode')}",
                            }
                            for item in interaction_paths
                            if str(item.get("renderRole") or "") == "cost"
                        ],
                        cite_db_semantic_scope(
                            row_scope_id,
                            str(row_scope_status.get("status") or "semantic-open"),
                            "Canonical row-local graph no longer carries an exact-display-update-path seam for this shell family.",
                        ),
                    ),
                ),
            ]
            if update_hook_candidates
            else []
        ),
        make_edge(
            "t3-trio-placeholder-check",
            owner_node,
            unresolved_node,
            "placeholder-shell-check",
            "present",
            "direct",
            "The owner-side field order keeps ATU23Button as shell plus max-overlay only and then advances directly into ATU24StartCost, so no committed T3Trio3 owner block survives for a third live trio row.",
            compact_citations(
                cite_hit(extract_source, atu23_shell_hit) if atu23_shell_hit is not None else None,
                cite_token_shop_extract_field("ATU23MaxOverlay", token_shop_extract),
                cite_hit(extract_source, atu24_start_hit) if atu24_start_hit is not None else None,
            ),
        ),
    ]

    negative_edges = []
    if not title_recovered:
        negative_edges.append(
            make_edge(
                "t3-trio-title-gap",
                prefab_node,
                title_node,
                "exact-shell-to-title",
                "missing",
                "supporting",
                "The surviving T3 title candidates still remain detached from one exact shell-local row-title join and continue to sit beside generic TokenShop text hooks.",
                compact_citations(
                    maybe_cite_hit(level0_title_source, title_hit),
                    maybe_cite_hit(level0_title_source, detached_title_hit),
                    maybe_cite_hit(level0_title_source, text_hook_hit),
                ),
            )
        )
    if not update_hook_candidates:
        negative_edges.append(
            make_edge(
                "t3-trio-display-gap",
                title_node,
                unresolved_node,
                "exact-display-update-path",
                "missing",
                "supporting",
                (
                    "The current row-local trace localizes the shell-side presentation subtree for ATU21, but it still does not recover one row-specific runtime updater that writes the T3 trio presentation."
                    if interaction_paths and not update_hook_candidates
                    else "No committed DB-native semantic scope or materialized target bundle yet localizes the runtime display-update path for the T3 trio shell run."
                ),
                compact_citations(
                    maybe_cite_hit(level0_title_source, text_hook_hit),
                    cite_db_semantic_scope(
                        row_scope_id,
                        str(row_scope_status.get("summary") or row_scope_status.get("status") or "semantic-open"),
                        "The canonical row-local graph still carries an exact-display-update-path seam for this shell family.",
                    ),
                ),
            )
        )

    return {
        "nodes": [
            {"id": shell_node, "label": "T3 trio family shells"},
            {"id": owner_node, "label": "Owner-order recovery"},
            {"id": effect_node, "label": "Effect hook lane"},
            {"id": action_node, "label": "Action hook lane"},
            {"id": prefab_node, "label": "Prefab family roster"},
            {"id": title_node, "label": "Title and text surfaces"},
            {"id": unresolved_node, "label": "Unresolved seams"},
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
    }


def build_token_shop_late_atu_family_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    token_shop_extract: dict[str, Any],
    late_boundary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    late_boundary = dict(late_boundary or {})
    action_boundary = dict(late_boundary.get("actionNeighborhood") or {})
    title_boundary = dict(late_boundary.get("titleRosterBoundary") or {})
    prefab_boundary = dict(late_boundary.get("prefabRosterBoundary") or {})
    effect_boundary = dict(late_boundary.get("effectSideBoundary") or {})

    shell_surface = find_surface(surfaces, "family-shells")
    action_surface = find_surface(surfaces, "action-lane")
    title_surface = find_surface(surfaces, "title-text-surfaces")
    prefab_surface = find_surface(surfaces, "prefab-roster")
    effect_surface = find_surface(surfaces, "effect-lane")

    extract_source = find_source_entry(shell_surface, "tokenShopExtract")
    metadata_action_source = maybe_find_source_entry(action_surface, "metadata")
    level0_action_source = maybe_find_source_entry(action_surface, "level0")
    level0_title_source = maybe_find_source_entry(title_surface, "level0")
    level0_prefab_source = maybe_find_source_entry(prefab_surface, "level0")
    metadata_effect_source = maybe_find_source_entry(effect_surface, "metadata")
    level0_effect_source = maybe_find_source_entry(effect_surface, "level0")

    atu24_shell_hit = maybe_find_hit(extract_source, "ATU24Button")
    atu28_shell_hit = maybe_find_hit(extract_source, "ATU28Button")
    buy_atu24_hit = maybe_find_hit(metadata_action_source, "BuyATU24") or maybe_find_hit(level0_action_source, "BuyATU24")
    buy_atu28_hit = maybe_find_hit(metadata_action_source, "BuyATU28") or maybe_find_hit(level0_action_source, "BuyATU28")
    title_hit = maybe_find_hit(level0_title_source, "Tier 3 Max Level Increaser") or maybe_find_hit(level0_title_source, "Academy Booster")
    prefab_hit = maybe_find_hit(level0_prefab_source, "NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser") or maybe_find_hit(level0_prefab_source, "NewTokenUPGPrefab.T5.CampaignFragments")
    effect_hit = maybe_find_hit(metadata_effect_source, "ATU24Bonus3Shards") or maybe_find_hit(level0_effect_source, "Campaign Fragments")

    title_cluster = ", ".join(
        str(item.get("title") or "")
        for item in (title_boundary.get("localTitleCluster") or [])
        if str(item.get("title") or "").strip()
    )
    prefab_cluster = ", ".join(
        str(item.get("identity") or "")
        for item in (prefab_boundary.get("localPrefabCluster") or [])
        if str(item.get("identity") or "").strip()
    )
    effect_cluster = ", ".join(str(item) for item in (effect_boundary.get("preservedEffectClues") or []) if str(item).strip())

    shell_node = "late-atu-family-shells"
    action_node = "late-atu-action-boundary"
    title_node = "late-atu-title-roster"
    prefab_node = "late-atu-prefab-roster"
    effect_node = "late-atu-effect-lane"
    unresolved_node = "late-atu-unresolved-identity"

    edges = [
        make_edge(
            "late-atu-shell-range",
            shell_node,
            action_node,
            "repeated-serialized-shell-adjacency",
            "present",
            "direct",
            "The late ATU shell range preserves one exact serialized shell run from ATU24Button through ATU28Button and the same tier4plus owner-field window.",
            compact_citations(
                maybe_cite_hit(extract_source, atu24_shell_hit),
                maybe_cite_hit(extract_source, atu28_shell_hit),
                cite_token_shop_extract_field("ATU24StartCost", token_shop_extract),
                cite_token_shop_extract_field("ATU28Fill", token_shop_extract),
            ),
        ),
        make_edge(
            "late-atu-action-shell",
            action_node,
            unresolved_node,
            "row-family-action-hook",
            "present",
            "direct",
            str(action_boundary.get("groundedConclusion") or "The late shell range keeps one coherent direct BuyATU24 through BuyATU28 action-side boundary."),
            compact_citations(
                maybe_cite_hit(metadata_action_source, buy_atu24_hit),
                maybe_cite_hit(level0_action_source, buy_atu24_hit),
                maybe_cite_hit(metadata_action_source, buy_atu28_hit),
                maybe_cite_hit(level0_action_source, buy_atu28_hit),
            ),
        ),
        make_edge(
            "late-atu-title-roster",
            shell_node,
            title_node,
            "late-title-roster-cluster",
            "present",
            "supporting",
            str(title_boundary.get("groundedConclusion") or "A local late title roster survives, but without an exact shell owner join."),
            compact_citations(
                maybe_cite_hit(level0_title_source, title_hit),
                {
                    "sourceId": "tokenShopLateAtuBoundary",
                    "sourcePath": get_source_reference("tokenShopLateAtuBoundary"),
                    "term": "localTitleCluster",
                    "locator": "$.titleRosterBoundary.localTitleCluster",
                    "note": title_cluster or "Late title roster cluster",
                },
            ),
        ),
        make_edge(
            "late-atu-prefab-roster",
            shell_node,
            prefab_node,
            "late-prefab-roster-cluster",
            "present",
            "supporting",
            str(prefab_boundary.get("groundedConclusion") or "A local late prefab roster survives, but without an exact shell owner join."),
            compact_citations(
                maybe_cite_hit(level0_prefab_source, prefab_hit),
                {
                    "sourceId": "tokenShopLateAtuBoundary",
                    "sourcePath": get_source_reference("tokenShopLateAtuBoundary"),
                    "term": "localPrefabCluster",
                    "locator": "$.prefabRosterBoundary.localPrefabCluster",
                    "note": prefab_cluster or "Late prefab roster cluster",
                },
            ),
        ),
        make_edge(
            "late-atu-effect-lane",
            shell_node,
            effect_node,
            "late-effect-domain-cluster",
            "present",
            "supporting",
            str(effect_boundary.get("groundedConclusion") or "Effect-side clues survive in the late ATU lane, but they do not close shell identity."),
            compact_citations(
                maybe_cite_hit(metadata_effect_source, effect_hit),
                maybe_cite_hit(level0_effect_source, effect_hit),
                {
                    "sourceId": "tokenShopLateAtuBoundary",
                    "sourcePath": get_source_reference("tokenShopLateAtuBoundary"),
                    "term": "preservedEffectClues",
                    "locator": "$.effectSideBoundary.preservedEffectClues",
                    "note": effect_cluster or "Late effect-side clue cluster",
                },
            ),
        ),
    ]

    negative_edges = [
        make_edge(
            "late-atu-missing-title-join",
            shell_node,
            title_node,
            "exact-shell-to-title",
            "missing",
            "negative",
            str(title_boundary.get("missingJoin") or "The local late title roster does not preserve one exact shell-local title join."),
            compact_citations(
                maybe_cite_hit(level0_title_source, title_hit),
                cite_token_shop_extract_field("ATU24Button", token_shop_extract),
                cite_token_shop_extract_field("ATU28Button", token_shop_extract),
            ),
        ),
        make_edge(
            "late-atu-missing-prefab-join",
            shell_node,
            prefab_node,
            "exact-shell-to-prefab",
            "missing",
            "negative",
            str(prefab_boundary.get("missingJoin") or "The local late prefab roster does not preserve one exact shell-local prefab join."),
            compact_citations(
                maybe_cite_hit(level0_prefab_source, prefab_hit),
                cite_token_shop_extract_field("ATU24Button", token_shop_extract),
                cite_token_shop_extract_field("ATU28Button", token_shop_extract),
            ),
        ),
        make_edge(
            "late-atu-missing-effect-join",
            shell_node,
            effect_node,
            "exact-effect-to-shell-join",
            "missing",
            "negative",
            str(effect_boundary.get("missingJoin") or "The late effect-side clues still do not cross back to one exact shell owner."),
            compact_citations(
                maybe_cite_hit(metadata_effect_source, effect_hit),
                maybe_cite_hit(level0_effect_source, effect_hit),
                cite_token_shop_extract_field("ATU24Button", token_shop_extract),
            ),
        ),
    ]

    return {
        "nodes": [
            {"id": shell_node, "label": "Late ATU family shells"},
            {"id": action_node, "label": "Late ATU action boundary"},
            {"id": title_node, "label": "Late title roster"},
            {"id": prefab_node, "label": "Late prefab roster"},
            {"id": effect_node, "label": "Late effect-side lane"},
            {"id": unresolved_node, "label": "Unresolved identity joins"},
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
    }


def build_shard_cost_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    metadata_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs([config["ownerType"], config["accessor"], *config["parameterShell"], "GetShardCostList", "UpdateShardCostList", "MilestoneCostList", *anchors], "surface-search"),
    )
    fallback_shell_window = {
        "source": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]),
        "shellField": config["accessor"],
        "shellPathId": "runtime-getter",
        "shellObjectOffset": None,
        "ownerFieldBlock": config["parameterShell"],
        "window": [{"field": field, "group": "row0-parameter-shell", "kind": "field"} for field in config["parameterShell"]],
    }
    fallback_surface_specs = []
    shell_window, surface_specs = resolve_surface_plan(
        str(target.get("id") or "shard-cost-su0-structure"),
        fallback_shell_window,
        fallback_surface_specs,
        target,
    )
    surfaces = [
        build_surface_bundle(surface, anchors, documents, shell_window, ["metadata"], 0)
        for surface in surface_specs
    ]

    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": resolve_graph_plan(str(target.get("id") or "shard-cost-su0-structure")) or {
            "nodes": [
                make_node("shard-owner", "owner-type", config["ownerType"], "present", "ShardUpgradeInfo remains the checked shard-local data carrier."),
                make_node("shard-getter", "getter", config["accessor"], "present", "The row0 shard cost accessor is preserved in committed structure datasets."),
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
                    "Metadata preserves get_SU0Cost on the ShardUpgradeInfo mechanic family.",
                    [
                        cite_hit(metadata_source, find_hit(metadata_source, config["ownerType"])),
                        cite_hit(metadata_source, find_hit(metadata_source, config["accessor"])),
                    ],
                ),
                make_edge(
                    "shard-getter-to-parameter-shell",
                    "shard-getter",
                    "shard-parameter-shell",
                    "getter-to-parameter-shell",
                    "present",
                    "direct",
                    "Metadata preserves the SU0 cost parameter shell beside get_SU0Cost.",
                    [
                        cite_hit(metadata_source, find_hit(metadata_source, config["parameterShell"][0])),
                        cite_hit(metadata_source, find_hit(metadata_source, config["parameterShell"][1])),
                        cite_hit(metadata_source, find_hit(metadata_source, config["parameterShell"][2])),
                    ],
                ),
                make_edge(
                    "shard-native-to-parameter-shell",
                    "shard-getter",
                    "shard-parameter-shell",
                    "metadata-row0-parameter-shell",
                    "present",
                    "direct",
                    "Metadata preserves the same row0 parameter shell directly beside get_SU0Cost without importing an external shard-cost support dataset.",
                    [
                        cite_hit(metadata_source, find_hit(metadata_source, config["parameterShell"][0])),
                        cite_hit(metadata_source, find_hit(metadata_source, config["parameterShell"][1])),
                        cite_hit(metadata_source, find_hit(metadata_source, config["parameterShell"][2])),
                    ],
                ),
                make_edge(
                    "shard-parameter-shell-to-evaluator",
                    "shard-parameter-shell",
                    "shard-evaluator",
                    "deterministic-evaluator",
                    "present",
                    "supporting",
                    "Metadata preserves the runtime shard-cost cache lifecycle through GetShardCostList, UpdateShardCostList, and MilestoneCostList.",
                    [
                        cite_hit(metadata_source, find_hit(metadata_source, "GetShardCostList")),
                        cite_hit(metadata_source, find_hit(metadata_source, "UpdateShardCostList")),
                        cite_hit(metadata_source, find_hit(metadata_source, "MilestoneCostList")),
                    ],
                ),
            ],
            "negativeEdges": [
                make_edge("shard-missing-calibration", "shard-evaluator", "shard-evaluator", "automated-calibration-closure", "missing", "negative", "Automated calibration is not yet reconstructed from raw metadata/native evidence in this target, so the structural evaluator is not calibration-closed.", []),
                make_edge("shard-missing-planner-safe-output", "shard-evaluator", "shard-evaluator", "planner-safe-cost-output", "missing", "negative", "Planner-safe shard cost output remains intentionally blocked until calibration closure is recovered from raw evidence.", []),
                make_edge("shard-missing-save-owner", "shard-owner", "shard-evaluator", "save-owner-recovery", "missing", "negative", "This shard-cost target still lacks direct save-side owner recovery and must stay separate from owned-state claims.", []),
            ],
            "claimLedger": [],
        },
        "bridgePromotionRule": resolve_bridge_policy(str(target.get("id") or "shard-cost-su0-structure"), "Only promote shard cost output past descriptive quarantine when calibration closure, planner-safe approval, and save-owner boundaries are all checked explicitly."),
        "bridgeCheck": {
            "candidateTerms": config["parameterShell"],
            "bridgeCleared": True,
            "bridgeHits": [{"surfaceId": "metadata-row0-structure", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": config["accessor"]}],
            "result": "checked getter-to-parameter-shell structure recovered",
        },
        "solvedVsBlockedDiff": {
            "baseline": {"id": "shard-cost-su0-structure", "label": "Shard SU0 structural baseline", "status": "cleared", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "shellField": config["accessor"], "shellPathId": "runtime-getter", "comparisonShape": [{"type": "getter-family", "status": "present"}, {"type": "getter-to-parameter-shell", "status": "present"}, {"type": "metadata-row0-parameter-shell", "status": "present"}, {"type": "deterministic-evaluator", "status": "present"}], "groundedConclusion": "The shard SU0 getter-to-parameter-shell structure is grounded enough to preserve as a quarantined structural baseline."},
            "blockedTarget": {"id": "shard-cost-planner-safe-output", "label": "Shard planner-safe cost output", "status": "blocked", "sourcePath": "workflow:shard-cost-trace-policy", "shellField": config["accessor"], "shellPathId": "planner-output", "comparisonShape": [{"type": "automated-calibration-closure", "status": "missing"}, {"type": "planner-safe-cost-output", "status": "missing"}, {"type": "save-owner-recovery", "status": "missing"}], "groundedConclusion": "The shard planner-safe output target remains blocked by calibration, approval, and save-owner recovery."},
            "delta": {
                "sharedPresentEdgeTypes": ["getter-family", "getter-to-parameter-shell", "metadata-row0-parameter-shell"],
                "baselineOnlyPresentEdgeTypes": ["deterministic-evaluator"],
                "blockedMissingEdgeTypes": ["automated-calibration-closure", "planner-safe-cost-output", "save-owner-recovery"],
                "solvedVsBlockedSummary": [
                    "The solved shard baseline preserves one direct getter-family, parameter-shell, and metadata-backed row0 structure chain.",
                    "The same family also preserves one deterministic evaluator structure model.",
                    "Planner-safe output stays blocked because calibration, approval, and save-owner recovery are still explicitly negative.",
                ],
            },
        },
        "lostStructure": resolve_lost_structure(str(target.get("id") or "shard-cost-su0-structure"), [
            "Exact per-level shard costs remain unresolved.",
            "Planner-safe shard ranking, ROI, and affordability output remains blocked.",
            "Save-owner recovery for shard milestone state remains unresolved in this cost-only trace target.",
        ]),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def _collect_recovered_terms(source_entries: list[dict[str, Any]], candidates: list[str]) -> list[str]:
    recovered: list[str] = []
    for term in candidates:
        for source_entry in source_entries:
            if maybe_find_hit(source_entry, term) is not None:
                recovered.append(term)
                break
    return unique_strings(recovered)


def _build_shard_owned_state_semantic_scope(
    config: dict[str, Any],
    metadata_runtime_source: dict[str, Any],
    metadata_watcher_source: dict[str, Any],
    metadata_save_source: dict[str, Any],
    metadata_handoff_source: dict[str, Any],
    level0_scene_source: dict[str, Any],
    shard_scene_hit: dict[str, Any] | None,
) -> dict[str, Any]:
    row_state_candidates = ["<Cost>k__BackingField", "<MaxLevel>k__BackingField", "<IsUnlocked>k__BackingField"]
    owner_list_candidates = ["upgradeInfoList", "MaxedMilestonesList", "UnlockedMilestonesList", "MilestoneCostList"]
    local_hook_candidates = [
        "InitializeShards",
        "InitializeMaxLevelBools",
        "UpdateUnlockedMilestonesList",
        "UpdateMaxedMilestonesList",
        "CheckAllMilestoneLevelFills",
    ]
    save_family_candidates = ["PlayerProfileData", "GetPlayerProfileData", "FillPlayerProfileData", "CloudSavePlayerProfile"]
    handoff_candidates = [config["genericLead"], "ConstructionMilestones"]

    declaring_field_name = next(
        (term for term in owner_list_candidates if maybe_find_hit(metadata_runtime_source, term) is not None),
        "upgradeInfoList",
    )
    row_model_name = next(
        (term for term in ("ShardMining+ShardUpgradeInfo",) if maybe_find_hit(metadata_runtime_source, term) is not None),
        "ShardMining+ShardUpgradeInfo",
    )
    declaring_field_hit = maybe_find_hit(metadata_runtime_source, declaring_field_name)
    scene_owner_citation = maybe_cite_hit(level0_scene_source, shard_scene_hit)
    row_model_hit = maybe_find_hit(metadata_runtime_source, row_model_name)
    row_state_fields = []
    for term in row_state_candidates:
        hit = maybe_find_hit(metadata_runtime_source, term)
        if hit is None:
            continue
        citation = maybe_cite_hit(metadata_runtime_source, hit)
        row_state_fields.append(
            {
                "name": term,
                "fieldOffset": citation.get("locator") if citation else None,
                "evidence": citation,
            }
        )

    return {
        "scopeId": "shard-owned-state:upgradeinfolist-population",
        "scopeType": "trace-target-support",
        "familyId": "shard-owned-state",
        "sceneOwner": {
            "name": config["sceneOwner"],
            "pathId": shard_scene_hit.get("pathId") if isinstance(shard_scene_hit, dict) else None,
            "evidence": scene_owner_citation,
        },
        "runtimeShell": {
            "label": f"{config['sceneOwner']}.{declaring_field_name} -> {row_model_name}",
            "ownerType": config["sceneOwner"],
            "declaringField": {
                "name": declaring_field_name,
                "fieldOffset": maybe_cite_hit(metadata_runtime_source, declaring_field_hit).get("locator") if declaring_field_hit is not None else None,
                "evidence": maybe_cite_hit(metadata_runtime_source, declaring_field_hit),
            },
            "rowModelType": {
                "fullName": row_model_name,
                "evidence": maybe_cite_hit(metadata_runtime_source, row_model_hit),
            },
            "rowStateFields": row_state_fields,
        },
        "ownerListFields": _collect_recovered_terms([metadata_runtime_source, metadata_watcher_source], owner_list_candidates),
        "localHooks": _collect_recovered_terms([metadata_watcher_source], local_hook_candidates),
        "saveFamilyTerms": _collect_recovered_terms([metadata_save_source], save_family_candidates),
        "handoffTerms": _collect_recovered_terms([metadata_handoff_source], handoff_candidates),
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
    }


def build_shard_owned_state_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str]) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    row_state_candidates = ["<Cost>k__BackingField", "<MaxLevel>k__BackingField", "<IsUnlocked>k__BackingField"]
    owner_list_candidates = ["upgradeInfoList", "MaxedMilestonesList", "UnlockedMilestonesList", "MilestoneCostList"]
    local_hook_candidates = [
        "InitializeShards",
        "InitializeMaxLevelBools",
        "UpdateUnlockedMilestonesList",
        "UpdateMaxedMilestonesList",
        "CheckAllMilestoneLevelFills",
    ]
    save_family_candidates = ["PlayerProfileData", "GetPlayerProfileData", "FillPlayerProfileData", "CloudSavePlayerProfile"]
    metadata_anchor_specs = build_anchor_specs(
        unique_strings(
            [
                config["sceneOwner"],
                "ShardMining+ShardUpgradeInfo",
                *owner_list_candidates,
                *row_state_candidates,
                *anchors,
            ]
        ),
        "surface-search",
    )
    metadata_runtime_source = collect_source_hits(documents, "metadata", metadata_anchor_specs)
    metadata_watcher_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs([*local_hook_candidates, *owner_list_candidates, *anchors], "surface-search"),
    )
    metadata_save_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs([*save_family_candidates, config["saveCandidate"], *anchors], "surface-search"),
    )
    metadata_handoff_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs([config["genericLead"], "ConstructionMilestones", *anchors], "surface-search"),
    )
    level0_scene_source = collect_source_hits(
        documents,
        "level0",
        build_anchor_specs([config["sceneOwner"], *anchors], "surface-search"),
    )
    shard_scene_hit = maybe_find_hit(level0_scene_source, config["sceneOwner"])
    shard_scene_path_id = shard_scene_hit.get("pathId") if isinstance(shard_scene_hit, dict) else None
    shard_scope = _build_shard_owned_state_semantic_scope(
        config,
        metadata_runtime_source,
        metadata_watcher_source,
        metadata_save_source,
        metadata_handoff_source,
        level0_scene_source,
        shard_scene_hit,
    )
    canonical_shard_scope = load_canonical_semantic_scope("shard-owned-state:upgradeinfolist-population")
    if canonical_shard_scope:
        shard_scope["bridgeAssessment"] = dict(canonical_shard_scope.get("bridgeAssessment") or {})
        shard_scope["outcome"] = dict(canonical_shard_scope.get("outcome") or {})
    recovered_runtime_shell = dict(shard_scope.get("runtimeShell") or {})
    row_state_fields = [field["name"] for field in recovered_runtime_shell.get("rowStateFields", []) if isinstance(field, dict) and field.get("name")]
    owner_list_fields = list(shard_scope.get("ownerListFields") or [])
    save_family_terms = list(shard_scope.get("saveFamilyTerms") or [])
    local_hooks_checked = list(shard_scope.get("localHooks") or [])
    bridge_assessment = dict(shard_scope.get("bridgeAssessment") or {})
    local_bridge_recovered = bool(bridge_assessment.get("localBridgeRecovered"))
    wrapper_handoff_recovered = bool(bridge_assessment.get("wrapperHandoffRecovered"))
    outcome_payload = dict(shard_scope.get("outcome") or {})
    outcome_kind = str(outcome_payload.get("kind") or "research-gap")
    outcome_label = str(outcome_payload.get("label") or "Canonical verdict pending")
    outcome_summary = str(outcome_payload.get("summary") or "The canonical shard owned-state verdict has not been materialized yet.")
    outcome_node_label = str(outcome_payload.get("nodeLabel") or "Owned-state verdict pending")
    outcome_statement = str(outcome_payload.get("statement") or "DB-owned canonical verdict is not available yet for this shard-owned-state target.")
    outcome_citations = list(outcome_payload.get("citations") or [])
    bridge_result = {
        "local-runtime-population-bridge": "checked local runtime population bridge recovered",
        "deeper-wrapper-handoff": "checked deeper wrapper handoff recovered",
        "non-local-injection-seam": "checked non-local injection seam preserved",
    }.get(outcome_kind, "checked shard owned-state gap remains unclassified")

    fallback_shell_window = {
        "source": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]),
        "shellField": recovered_runtime_shell.get("declaringField", {}).get("name"),
        "shellPathId": recovered_runtime_shell.get("declaringField", {}).get("fieldOffset"),
        "shellObjectOffset": shard_scene_path_id,
        "ownerFieldBlock": row_state_fields,
        "window": [
            {
                "field": recovered_runtime_shell.get("declaringField", {}).get("name"),
                "group": "runtime-shell",
                "kind": "field",
                "value": recovered_runtime_shell.get("label") or recovered_runtime_shell.get("declaringField", {}).get("name"),
            },
            *[
                {"field": field["name"], "group": "runtime-row-state", "kind": "field", "value": field.get("type") or field["name"]}
                for field in recovered_runtime_shell.get("rowStateFields", [])
            ],
        ],
    }

    fallback_surface_specs = [
        {
            "id": "scene-owner",
            "label": "Direct scene owner",
            "terms": [config["sceneOwner"], recovered_runtime_shell.get("label") or config["runtimeShell"], *anchors],
            "sourceIds": ["level0", "metadata"],
        },
        {
            "id": "runtime-shell",
            "label": "upgradeInfoList runtime shell",
            "terms": [recovered_runtime_shell.get("label") or config["runtimeShell"], *row_state_fields, *anchors],
            "sourceIds": ["metadata"],
        },
        {
            "id": "owner-list-watchers",
            "label": "Shard-local watcher and list shells",
            "terms": [*local_hooks_checked, *owner_list_fields, *anchors],
            "sourceIds": ["metadata"],
        },
        {
            "id": "handoff-boundary",
            "label": "Controller versus wrapper handoff boundary",
            "terms": [config["genericLead"], "ConstructionMilestones", *anchors],
            "sourceIds": ["metadata"],
        },
        {
            "id": "save-gap",
            "label": "Save-side blocker",
            "terms": [config["saveCandidate"], "PlayerProfileData", "CloudSavePlayerProfile", *anchors],
            "sourceIds": ["metadata"],
        },
    ]
    shell_window, surface_specs = resolve_surface_plan(
        str(target.get("id") or "shard-owned-state-upgradeinfolist-population"),
        fallback_shell_window,
        fallback_surface_specs,
    )
    surfaces = [
        build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, 0)
        for surface in surface_specs
    ]
    for surface in surfaces:
        surface["anchorSpecs"] = build_anchor_specs(surface["terms"], "surface-search")

    trace_graph = {
        "nodes": [
            make_node("shard-scene-owner", "scene-owner", f"{config['sceneOwner']} path_id {shard_scene_path_id}", "present", "The direct level0 ShardMining MonoBehaviour object is preserved."),
            make_node("shard-definition-family", "definition-payload", "Direct ShardMining SU0-29 definition payload", "present", "The reachable row-definition family is preserved directly on the ShardMining scene object."),
            make_node("shard-runtime-shell", "runtime-shell", recovered_runtime_shell.get("label") or config["runtimeShell"], "present", "The owned-state shell is preserved as upgradeInfoList -> ShardMining+ShardUpgradeInfo."),
            make_node("shard-owner-list-shell", "owner-list-shell", ", ".join(owner_list_fields), "present", "ShardMining preserves adjacent list shells that watch milestone cost and bool state."),
            make_node("shard-local-hooks", "watcher-hooks", ", ".join(local_hooks_checked), "present", "Shard-local watcher hooks around costs, unlock lists, max-level lists, and progress fills are preserved."),
            make_node("shard-owned-state-outcome", "owned-state-outcome", outcome_node_label, "present", outcome_summary),
        ],
        "edges": [
            make_edge(
                "shard-scene-to-definition",
                "shard-scene-owner",
                "shard-definition-family",
                "direct-scene-definition-payload",
                "present",
                "direct",
                "The direct level0 ShardMining MonoBehaviour object still holds the reachable shard definition family locally.",
                [
                    *compact_citations(maybe_cite_hit(level0_scene_source, shard_scene_hit)),
                    {
                        "sourceId": "metadata",
                        "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]),
                        "locator": "term",
                        "term": config["sceneOwner"],
                    },
                ],
            ),
            make_edge(
                "shard-definition-to-runtime-shell",
                "shard-definition-family",
                "shard-runtime-shell",
                "definition-to-runtime-shell",
                "present",
                "direct",
                "The same ShardMining owner that carries direct row definitions also declares upgradeInfoList -> ShardMining+ShardUpgradeInfo as the recovered runtime row shell.",
                [
                    *compact_citations(
                        maybe_cite_hit(metadata_runtime_source, maybe_find_hit(metadata_runtime_source, config["sceneOwner"])),
                        maybe_cite_hit(metadata_runtime_source, maybe_find_hit(metadata_runtime_source, recovered_runtime_shell.get("declaringField", {}).get("name", ""))),
                    ),
                    {
                        "sourceId": "metadata",
                        "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]),
                        "locator": "term",
                        "term": recovered_runtime_shell.get("rowModelType", {}).get("fullName"),
                    },
                ],
            ),
            make_edge(
                "shard-runtime-to-owner-lists",
                "shard-runtime-shell",
                "shard-owner-list-shell",
                "runtime-shell-to-owner-lists",
                "present",
                "direct",
                "Type reflection preserves upgradeInfoList beside MaxedMilestonesList, UnlockedMilestonesList, and MilestoneCostList on ShardMining.",
                [
                    *compact_citations(
                        maybe_cite_hit(metadata_runtime_source, maybe_find_hit(metadata_runtime_source, "upgradeInfoList")),
                        maybe_cite_hit(metadata_runtime_source, maybe_find_hit(metadata_runtime_source, "MaxedMilestonesList")),
                        maybe_cite_hit(metadata_runtime_source, maybe_find_hit(metadata_runtime_source, "UnlockedMilestonesList")),
                        maybe_cite_hit(metadata_runtime_source, maybe_find_hit(metadata_runtime_source, "MilestoneCostList")),
                    ),
                ],
            ),
            make_edge(
                "shard-runtime-to-local-hooks",
                "shard-runtime-shell",
                "shard-local-hooks",
                "runtime-shell-to-local-hooks",
                "present",
                "supporting",
                "The shard payload-watch boundary keeps InitializeShards, list refresh hooks, and milestone progress-fill hooks attached to the same shard-local runtime shell.",
                [
                    *compact_citations(
                        maybe_cite_hit(metadata_watcher_source, maybe_find_hit(metadata_watcher_source, "InitializeShards")),
                        maybe_cite_hit(metadata_watcher_source, maybe_find_hit(metadata_watcher_source, "InitializeMaxLevelBools")),
                        maybe_cite_hit(metadata_watcher_source, maybe_find_hit(metadata_watcher_source, "UpdateUnlockedMilestonesList")),
                        maybe_cite_hit(metadata_watcher_source, maybe_find_hit(metadata_watcher_source, "UpdateMaxedMilestonesList")),
                        maybe_cite_hit(metadata_watcher_source, maybe_find_hit(metadata_watcher_source, "CheckAllMilestoneLevelFills")),
                    ),
                ],
            ),
            make_edge(
                "shard-runtime-to-outcome",
                "shard-runtime-shell",
                "shard-owned-state-outcome",
                outcome_kind,
                "present",
                "derived",
                outcome_statement,
                outcome_citations,
            ),
        ],
        "negativeEdges": [],
        "claimLedger": [],
    }

    if not local_bridge_recovered:
        trace_graph["negativeEdges"].append(
            make_edge(
                "shard-missing-local-bridge",
                "shard-local-hooks",
                "shard-runtime-shell",
                "local-runtime-population-bridge",
                "missing",
                "negative",
                "The checked shard-local watcher hooks still do not recover any exact write, constructor, or setup path that populates upgradeInfoList owned-state values locally.",
                [
                    *compact_citations(maybe_cite_hit(metadata_watcher_source, maybe_find_hit(metadata_watcher_source, "InitializeShards"))),
                ],
            )
        )

    if not wrapper_handoff_recovered:
        trace_graph["negativeEdges"].append(
            make_edge(
                "shard-missing-wrapper-handoff",
                "shard-runtime-shell",
                "shard-owned-state-outcome",
                "deeper-wrapper-handoff-recovery",
                "missing",
                "negative",
                "The repo still does not recover an exact deeper wrapper or save-side owner behind upgradeInfoList even though PlayerProfile-side save-family terms remain the leading unresolved search area.",
                [
                    *compact_citations(maybe_cite_hit(metadata_save_source, maybe_find_hit(metadata_save_source, "PlayerProfileData"))),
                ],
            )
        )

    comparison_shape = [
        {"type": "direct-scene-definition-payload", "status": "present"},
        {"type": "definition-to-runtime-shell", "status": "present"},
        {"type": "runtime-shell-to-owner-lists", "status": "present"},
        {"type": "runtime-shell-to-local-hooks", "status": "present"},
        {"type": outcome_kind, "status": "present"},
    ]
    blocked_shape = []
    if not local_bridge_recovered:
        blocked_shape.append({"type": "local-runtime-population-bridge", "status": "missing"})
    if not wrapper_handoff_recovered:
        blocked_shape.append({"type": "deeper-wrapper-handoff-recovery", "status": "missing"})

    bridge_comparison_seed = {
        "bridgeCheck": {
            "candidateTerms": [recovered_runtime_shell.get("label") or config["runtimeShell"], *row_state_fields, *local_hooks_checked[:4]],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "runtime-shell", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": recovered_runtime_shell.get("declaringField", {}).get("name")},
                {"surfaceId": "owner-list-watchers", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": local_hooks_checked[0] if local_hooks_checked else None},
                {"surfaceId": "save-gap", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "PlayerProfileData"},
            ],
            "result": bridge_result,
        },
        "solvedVsBlockedDiff": {
            "baseline": {
                "id": "shard-owned-state-upgradeinfolist-population",
                "label": "Shard owned-state population boundary",
                "status": "cleared",
                "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]),
                "shellField": recovered_runtime_shell.get("declaringField", {}).get("name"),
                "shellPathId": recovered_runtime_shell.get("declaringField", {}).get("fieldOffset"),
                "comparisonShape": comparison_shape,
                "groundedConclusion": outcome_summary,
            },
            "blockedTarget": {
                "id": "shard-owned-state-local-bridge",
                "label": "Shard local owned-state producer",
                "status": "blocked",
                "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]),
                "shellField": recovered_runtime_shell.get("declaringField", {}).get("name"),
                "shellPathId": "owned-state-bridge",
                "comparisonShape": blocked_shape,
                "groundedConclusion": "A recovered local producer or deeper wrapper handoff is still required before player-owned shard state can be named safely.",
            },
            "delta": {
                "sharedPresentEdgeTypes": [
                    "direct-scene-definition-payload",
                    "definition-to-runtime-shell",
                    "runtime-shell-to-owner-lists",
                    "runtime-shell-to-local-hooks",
                ],
                "baselineOnlyPresentEdgeTypes": [outcome_kind],
                "blockedMissingEdgeTypes": [entry["type"] for entry in blocked_shape],
                "solvedVsBlockedSummary": [
                    "The current shard trace preserves one direct scene owner, one direct row-definition family, one recovered runtime row shell, and one shard-local watcher/list cluster.",
                    outcome_summary,
                    "Player-owned shard import stays blocked until a real local producer or exact deeper wrapper handoff is recovered.",
                ],
            },
        },
    }

    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": resolve_graph_plan(str(target.get("id") or "shard-owned-state-upgradeinfolist-population")) or trace_graph,
        "outcome": {
            "kind": outcome_kind,
            "label": outcome_label,
            "summary": outcome_summary,
        },
        "bridgePromotionRule": resolve_bridge_policy(str(target.get("id") or "shard-owned-state-upgradeinfolist-population"), "Only promote player-owned shard state past descriptive quarantine when one exact local population bridge or deeper save-side wrapper handoff is recovered explicitly."),
        "bridgeComparisonSeed": bridge_comparison_seed,
        "lostStructure": resolve_lost_structure(str(target.get("id") or "shard-owned-state-upgradeinfolist-population"), [
            "Shard-local watcher hooks still sit beside upgradeInfoList, UnlockedMilestonesList, MaxedMilestonesList, and MilestoneCostList without one committed write path into IsUnlocked, MaxLevel, or current milestone progress.",
            "PlayerProfile-side save-family terms remain only a search area rather than a recovered declaring wrapper or serialized payload owner.",
            "Keep the owned-state result quarantined to blocker evidence only; it does not reopen planner math, affordability, ROI, ETA, or canonical state.playerProfile promotion.",
        ]),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def build_multiverse_market_save_owner_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = get_target_strategy_config(target)
    metadata_accessor_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs(["PlayerProfileHandler", "get_Market", "MultiverseMarket", *anchors], "surface-search"),
    )
    metadata_owner_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs([config["saveOwner"], "IS1Level", "IS110Level", "InscryptionsDone", *anchors], "surface-search"),
    )
    metadata_ordered_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs(
            [
                "SetIS71CostText",
                "SetIS72CostText",
                "SetIS73CostText",
                "SetIS74CostText",
                "IS71Level",
                "IS72Level",
                "IS73Level",
                "IS74Level",
                *anchors,
            ],
            "surface-search",
        ),
    )
    level0_accessor_source = collect_source_hits(
        documents,
        "level0",
        build_anchor_specs(["PlayerProfileHandler", "MultiverseMarket", config["saveOwner"], "InscryptionsDone", *anchors], "surface-search"),
    )
    level0_action_source = collect_source_hits(
        documents,
        "level0",
        build_anchor_specs(["BuyIS71", "BuyIS72", "BuyIS73", "BuyIS74", "MultiverseMarket", config["saveOwner"], *anchors], "surface-search"),
    )
    fallback_shell_window = {
        "source": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]),
        "shellField": "get_Market",
        "shellPathId": "typed-accessor",
        "shellObjectOffset": None,
        "ownerFieldBlock": [config["saveOwner"], "IS1Level", "IS110Level", "InscryptionsDone"],
        "window": [
            {"field": "bridgeAccessor", "group": "typed-boundary", "kind": "method", "value": "get_Market"},
            {"field": "bridgeOwner", "group": "typed-boundary", "kind": "type", "value": "PlayerProfileHandler"},
            {"field": "bridgeReturnType", "group": "typed-boundary", "kind": "type", "value": "MultiverseMarket"},
            {"field": "declaringOwner", "group": "typed-boundary", "kind": "type", "value": config["saveOwner"]},
            {"field": "typedSpan", "group": "typed-boundary", "kind": "field-range", "value": config["typedSpan"]},
        ],
    }
    fallback_surface_specs = []
    shell_window, surface_specs = resolve_surface_plan(
        str(target.get("id") or "multiverse-market-save-owner-boundary"),
        fallback_shell_window,
        fallback_surface_specs,
        target,
    )
    surfaces = [
        build_surface_bundle(surface, anchors, documents, shell_window, ["metadata", "level0"], 0)
        for surface in surface_specs
    ]
    bridge_check = {
        "candidateTerms": [config["accessorBridge"], config["saveOwner"], config["typedSpan"]],
        "bridgeCleared": True,
        "bridgeHits": [{"surfaceId": "accessor-bridge", "sourcePath": repo_relative(SOURCE_REFERENCE_PATHS["metadata"]), "term": "get_Market"}],
        "result": "checked accessor-to-save-owner boundary recovered",
    }
    solved_vs_blocked = {
        "baseline": {"id": "multiverse-market-save-owner-boundary", "label": "Emporium save-owner boundary", "status": "cleared", "sourcePath": "semantic:target-bridge-policy:multiverse-market-save-owner-boundary", "shellField": config["accessorBridge"], "shellPathId": "typed-accessor", "comparisonShape": [{"type": "accessor-bridge", "status": "present"}, {"type": "typed-save-owner", "status": "present"}, {"type": "compatibility-import-span", "status": "present"}], "groundedConclusion": "The Emporium accessor-to-SaveData owner boundary is grounded enough to preserve as compatibility-only truth."},
        "blockedTarget": {"id": "multiverse-market-canonical-import", "label": "Emporium canonical import", "status": "blocked", "sourcePath": "semantic:target-bridge-comparison:multiverse-market-save-owner-boundary", "shellField": config["saveOwner"], "shellPathId": "canonical-import", "comparisonShape": [{"type": "typed-market-field-recovery", "status": "missing"}, {"type": "canonical-import-admissibility", "status": "missing"}, {"type": "broad-row-identity-remap", "status": "missing"}], "groundedConclusion": "Canonical import remains blocked even though the wider save-owner boundary is grounded."},
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
    }
    bridge_comparison_seed = {
        "bridgeCheck": bridge_check,
        "solvedVsBlockedDiff": solved_vs_blocked,
    }
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": resolve_graph_plan(str(target.get("id") or "multiverse-market-save-owner-boundary")) or {
            "nodes": [
                make_node("market-accessor", "accessor-bridge", config["accessorBridge"], "present", "The checked PlayerProfileHandler.get_Market accessor bridge is preserved."),
                make_node("market-owner", "declaring-owner", config["saveOwner"], "present", "SaveData remains the exact checked wider owner."),
                make_node("market-span", "typed-span", config["typedSpan"], "present", "The exact contiguous IS1Level through IS110Level span is preserved."),
                make_node("market-import", "compatibility-import", config["compatibilityImportTargetPath"], "present", "The compatibility-only import target is preserved."),
            ],
            "edges": [
                make_edge("market-accessor-to-owner", "market-accessor", "market-owner", "accessor-bridge", "present", "direct", "Metadata and level0 preserve the get_Market accessor bridge, its MultiverseMarket return type, and the wider SaveData ownership boundary.", [cite_hit(metadata_accessor_source, find_hit(metadata_accessor_source, "PlayerProfileHandler")), cite_hit(metadata_accessor_source, find_hit(metadata_accessor_source, "get_Market")), cite_hit(metadata_accessor_source, find_hit(metadata_accessor_source, "MultiverseMarket")), cite_hit(metadata_owner_source, find_hit(metadata_owner_source, config["saveOwner"]))]),
                make_edge("market-owner-to-span", "market-owner", "market-span", "typed-save-owner", "present", "direct", "Metadata directly preserves the SaveData-owned Emporium span from IS1Level through IS110Level beside InscryptionsDone.", [cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "IS1Level")), cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "IS110Level")), cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "InscryptionsDone"))]),
                make_edge(
                    "market-span-to-import",
                    "market-span",
                    "market-import",
                    "compatibility-import-span",
                    "present",
                    "supporting",
                    "The exact IS span is preserved as compatibility-only raw Emporium truth under {} rather than canonical PlayerProfile import.".format(config["compatibilityImportTargetPath"]),
                    [
                        cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "IS1Level")),
                        cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "IS110Level")),
                        cite_hit(level0_action_source, find_hit(level0_action_source, "BuyIS71")),
                    ],
                ),
                make_edge(
                    "market-overlap-support",
                    "market-span",
                    "market-import",
                    "ordered-row-overlap",
                    "present",
                    "supporting",
                    "Rows 71-74 still anchor the wider IS span to checked Emporium ordering through direct IS71-74 metadata terms plus the surviving SetIS71-74CostText and BuyIS71-74 row-side surfaces.",
                    [
                        cite_hit(metadata_ordered_source, find_hit(metadata_ordered_source, "IS71Level")),
                        cite_hit(metadata_ordered_source, find_hit(metadata_ordered_source, "IS74Level")),
                        cite_hit(metadata_ordered_source, find_hit(metadata_ordered_source, "SetIS71CostText")),
                        cite_hit(metadata_ordered_source, find_hit(metadata_ordered_source, "SetIS74CostText")),
                        cite_hit(level0_action_source, find_hit(level0_action_source, "BuyIS71")),
                        cite_hit(level0_action_source, find_hit(level0_action_source, "BuyIS74")),
                    ],
                ),
            ],
            "negativeEdges": [
                make_edge(
                    "market-missing-typed-market-field",
                    "market-accessor",
                    "market-owner",
                    "typed-market-field-recovery",
                    "missing",
                    "negative",
                    "The checked direct trace still only recovers the PlayerProfileHandler.get_Market accessor bridge and the wider SaveData-owned IS span, not a typed Market or MultiverseMarket field on PlayerProfileHandler, PlayerProfileData, or SaveData.",
                    [
                        cite_hit(metadata_accessor_source, find_hit(metadata_accessor_source, "PlayerProfileHandler")),
                        cite_hit(metadata_accessor_source, find_hit(metadata_accessor_source, "get_Market")),
                        cite_hit(metadata_owner_source, find_hit(metadata_owner_source, config["saveOwner"])),
                        cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "IS1Level")),
                        cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "IS110Level")),
                    ],
                ),
                make_edge(
                    "market-missing-canonical-import",
                    "market-span",
                    "market-import",
                    "canonical-import-admissibility",
                    "missing",
                    "negative",
                    "Canonical import remains explicitly {} even though the compatibility-only import target is preserved.".format(config["canonicalImportSafeSubsetLabel"]),
                    [
                        cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "InscryptionsDone")),
                        cite_hit(level0_action_source, find_hit(level0_action_source, "BuyIS74")),
                    ],
                ),
                make_edge(
                    "market-missing-broad-row-remap",
                    "market-span",
                    "market-import",
                    "broad-row-identity-remap",
                    "missing",
                    "negative",
                    config["broaderRowRemapStatus"],
                    [
                        cite_hit(metadata_ordered_source, find_hit(metadata_ordered_source, "IS71Level")),
                        cite_hit(metadata_ordered_source, find_hit(metadata_ordered_source, "IS74Level")),
                        cite_hit(level0_action_source, find_hit(level0_action_source, "BuyIS71")),
                        cite_hit(level0_action_source, find_hit(level0_action_source, "BuyIS74")),
                    ],
                ),
            ],
            "claimLedger": [],
        },
        "bridgePromotionRule": resolve_bridge_policy(str(target.get("id") or "multiverse-market-save-owner-boundary"), "Only promote the Emporium save-owner boundary past compatibility quarantine when canonical import admissibility and broader row identity are both checked explicitly."),
        "bridgeComparisonSeed": bridge_comparison_seed,
        "lostStructure": resolve_lost_structure(str(target.get("id") or "multiverse-market-save-owner-boundary"), list(config["blockedStructure"])),
        "groundedConclusion": "",
        "currentBoundary": [],
    }


def build_bridge_comparison_reference_payload(target_id: str) -> dict[str, Any]:
    semantic_key = f"target-bridge-comparison:{target_id}"
    return {
        "bridgeComparisonSemanticKey": semantic_key,
        "bridgeCheck": {
            "semanticKey": semantic_key,
            "bridgeCleared": None,
            "bridgeHits": [],
            "result": "Canonical bridge/comparison fragment pending rebuild for this target.",
        },
        "solvedVsBlockedDiff": {
            "semanticKey": semantic_key,
            "baseline": {
                "id": target_id,
                "label": "Canonical bridge/comparison pending",
                "status": "pending-canonical-bridge-comparison",
                "sourcePath": "db:canonical-bridge-comparison-fragment",
                "shellField": None,
                "shellPathId": None,
                "comparisonShape": [],
                "groundedConclusion": "Canonical bridge/comparison fragment pending rebuild for this target.",
            },
            "blockedTarget": {
                "id": f"{target_id}-blocked",
                "label": "Canonical blocked comparison pending",
                "status": "pending-canonical-bridge-comparison",
                "sourcePath": "db:canonical-bridge-comparison-fragment",
                "shellField": None,
                "shellPathId": None,
                "comparisonShape": [],
                "groundedConclusion": "Canonical bridge/comparison fragment pending rebuild for this target.",
            },
            "delta": {
                "sharedPresentEdgeTypes": [],
                "baselineOnlyPresentEdgeTypes": [],
                "blockedMissingEdgeTypes": [],
                "solvedVsBlockedSummary": [
                    "Canonical bridge/comparison fragment pending rebuild for this target.",
                ],
            },
        },
    }


def build_trace_payload_for_subject(
    execution_routine: str,
    compatibility_target: dict[str, Any],
    anchors: list[str],
    documents: dict[str, Any],
    available_source_ids: list[str],
    extended_search: int,
    depth_search: int,
) -> dict[str, Any]:
    target_id = str(
        compatibility_target.get("traceScope")
        or compatibility_target.get("id")
        or ""
    )
    target = compatibility_target
    if not execution_routine:
        raise ValueError(
            "Could not derive an execution routine from DB subject "
            f"{planner_resolution.get('selectedSubjectKind')} {planner_resolution.get('selectedSubjectKey')}."
        )
    if execution_routine == "token-shop-mod-trace":
        return build_token_shop_mod_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if execution_routine == "token-shop-mk1-title-trace":
        return build_token_shop_mk1_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if execution_routine == "token-shop-mk3-bridge-trace":
        return build_token_shop_mk3_bridge_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if execution_routine == "token-shop-atu3-effect-trace":
        return build_token_shop_atu3_effect_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if execution_routine == "token-shop-atu3-consumer-trace":
        return build_token_shop_atu3_chest_consumer_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if execution_routine == "token-shop-atu3-consumer-read-trace":
        return build_token_shop_atu3_chest_consumer_read_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if execution_routine == "token-shop-family-trace":
        return build_token_shop_family_structure_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if execution_routine == "shard-cost-trace":
        return build_shard_cost_trace(target, anchors, documents)
    if execution_routine == "shard-owned-state-trace":
        return build_shard_owned_state_trace(target, anchors, documents, available_source_ids)
    if execution_routine == "multiverse-market-save-owner-trace":
        return build_multiverse_market_save_owner_trace(target, anchors, documents)
    raise ValueError(f"Unsupported subject-derived unity trace routine: {execution_routine}")


def get_priority_support_documents(target: dict[str, Any]) -> list[str]:
    family_id = target["familyId"]
    if family_id == "exploration":
        return ["tokenShopExtract", "tokenShopRowRemapBoundary", "shardCostFormulaModel", "multiverseMarketMemberBoundary"]
    if family_id == "token-shop":
        return ["tokenShopExtract", "tokenShopRowRemapBoundary"]
    if family_id == "shard-cost":
        return []
    if family_id == "shard-owned-state":
        return []
    if family_id == "multiverse-market-save-owner":
        return []
    return []


def build_dataset(
    trace_plan: dict[str, Any],
    target_id: str | None,
    queries: list[str],
    extra_anchors: list[str],
    registry: dict[str, Any] | None = None,
    family_id: str | None = None,
    extended_search: int = 0,
    depth_search: int | None = 0,
    native_timeout: int = 1800,
) -> dict[str, Any]:
    if registry is None:
        with _trace_phase("Catalog load", "catalogLoad"):
            registry = load_request_catalog()
    with _trace_profile_span("plannerTargetResolution"):
        planner_resolution = dict(trace_plan["plannerResolution"])
        selected_target_id = str(trace_plan.get("selectedTargetId") or planner_resolution["selectedTargetId"])
        execution_target_id = str(trace_plan.get("executionTargetId") or selected_target_id)
        execution_trace_scope = str(trace_plan.get("executionTraceScope") or execution_target_id)
        knowledge_plan = dict(trace_plan.get("knowledgePlan") or {})
        execution_routine_id = str(knowledge_plan.get("executionRoutineId") or execution_trace_scope or "generic-explore")
        db_source_projection = (
            load_latest_source_projection(execution_trace_scope)
            if execution_trace_scope and execution_trace_scope != "generic-explore"
            else {}
        )
    execution_plan: dict[str, Any] = {}
    is_generic_explore = planner_resolution["selectionMode"] == "generic-explore"
    with _trace_phase("Unity asset loading", "unityAssetLoading"):
        if is_generic_explore:
            target = {
                "id": "generic-explore",
                "label": "Generic cross-source exploration",
                "familyId": "exploration",
                "acceptedAnchors": ["class", "method", "string", "path id"],
                "joinGoal": "Search ambiguous strings or unknown object names across committed metadata, Unity assets, and bounded extraction documents without forcing a family remap.",
                "requiredSourceFamilies": list(registry["sourceFamilies"].keys()),
                "solvedBaselineTargetId": None,
                "blockedTargetId": None,
            }
            family_plan = {"label": "Exploration", "anchorExpansionTerms": []}
            anchors = unique_strings([*planner_resolution["expandedAnchors"], *extra_anchors])
            source_paths, source_roles = resolve_source_catalog(registry, target["requiredSourceFamilies"])
            required_source_families = list(target["requiredSourceFamilies"])
            source_projection_owner = "registry-fallback"
            resolved_depth_search = 0 if depth_search is None else depth_search
            execution_context = {}
        else:
            target = dict(registry["targets"][selected_target_id])
            target_family_id = str(trace_plan.get("selectedFamilyId") or target.get("familyId") or "").strip()
            if target_family_id not in registry["planner"]["families"]:
                target_family_id = str(target.get("familyId") or "").strip()
            if target_family_id not in registry["planner"]["families"]:
                target_family_id = _infer_runtime_family_id(
                    execution_trace_scope,
                    execution_target_id,
                    selected_target_id,
                )
            if target_family_id not in registry["planner"]["families"]:
                target_family_id = "exploration"
            family_plan = registry["planner"]["families"][target_family_id]
            target, execution_context = _apply_db_execution_context(target, execution_trace_scope, planner_resolution)
            target, execution_plan = _apply_db_execution_plan(target, execution_trace_scope)
            anchors = unique_strings(planner_resolution["expandedAnchors"])
            if db_source_projection:
                source_paths, source_roles = resolve_source_catalog_from_projection(db_source_projection)
                source_paths, source_roles = narrow_source_catalog(
                    source_paths,
                    source_roles,
                    get_extended_source_ids_for_projection(db_source_projection, extended_search),
                )
                required_source_families = unique_strings(
                    [
                        str(entry.get("familyId") or "")
                        for entry in list((db_source_projection.get("families") or {}).values())
                        if str(entry.get("familyId") or "").strip()
                    ]
                ) or list(target["requiredSourceFamilies"])
                source_projection_owner = "db-source-projection"
            else:
                source_family_ids = list(registry["sourceFamilies"].keys()) if extended_search >= 2 else target["requiredSourceFamilies"]
                source_paths, source_roles = resolve_source_catalog(registry, source_family_ids)
                source_paths, source_roles = narrow_source_catalog(source_paths, source_roles, get_extended_source_ids_for_target(registry, target, extended_search))
                required_source_families = list(target["requiredSourceFamilies"])
                source_projection_owner = "registry-fallback"
            resolved_depth_search = target.get("defaultDepth", 0) if depth_search is None else depth_search
    execution_anchor_specs = build_anchor_specs(anchors, "execution-anchor")
    expanded_anchor_specs = build_anchor_specs(planner_resolution["expandedAnchors"], "planner-expanded-anchor")
    with _trace_profile_span("sourceLoading"):
        support_documents = TraceDocumentCache(SUPPORT_DATASET_PATHS)
        support_documents.preload(get_priority_support_documents(target))
        trace_payload = (
            build_generic_explore_trace(anchors, list(source_paths.keys()), support_documents)
            if is_generic_explore
            else build_trace_payload_for_subject(
                execution_routine_id,
                target,
                anchors,
                support_documents,
                list(source_paths.keys()),
                extended_search,
                resolved_depth_search,
            )
        )
    native_anchor_values = _collect_native_trace_terms(target, planner_resolution, trace_payload)
    active_acquisition_plan = dict(_get_active_trace_runtime_flag("acquisitionPlan") or {})
    relation_probe = dict(active_acquisition_plan.get("selectedRelationProbe") or {})
    native_request_context = (
        {
            "coverageMode": "relation-shaped",
            "relationScope": str(relation_probe.get("traceScope") or active_acquisition_plan.get("selectedScope") or "").strip(),
            "requiredCoverageSeamIds": [
                str(value)
                for value in (relation_probe.get("requiredCoverageSeamIds") or [])
                if str(value).strip()
            ],
            "expectedTerms": [
                str(value)
                for value in (
                    relation_probe.get("expectedTerms")
                    or active_acquisition_plan.get("requestedTerms")
                    or []
                )
                if str(value).strip()
            ],
            "anchors": [
                str(value)
                for value in (relation_probe.get("anchors") or active_acquisition_plan.get("selectedAnchors") or [])
                if str(value).strip()
            ],
            "subjectId": str(active_acquisition_plan.get("subjectId") or planner_resolution.get("selectedSubjectKey") or "").strip(),
            "seamId": str(active_acquisition_plan.get("selectedSeamId") or "").strip(),
            "executionRoutineId": str(active_acquisition_plan.get("selectedRoutine") or "").strip(),
        }
        if str(active_acquisition_plan.get("coverageMode") or "").strip() == "relation-shaped" and relation_probe
        else None
    )
    with _trace_phase("Native / trace execution", "nativeTraceExecution"):
        with _trace_profile_span("nativeExtraction"):
            native_trace = collect_native_trace(
                native_anchor_values,
                native_timeout,
                target["familyId"],
                request_context=native_request_context,
            )
    promoted_native_owner = _select_promoted_native_owner(target, trace_payload, native_trace.get("summary"))
    if promoted_native_owner and isinstance(native_trace.get("summary"), dict):
        native_trace["summary"]["promotedOwner"] = promoted_native_owner["owner"]
        native_trace["summary"]["promotedOwnerScore"] = promoted_native_owner.get("promotedScore", promoted_native_owner.get("score", 0))
        native_trace["summary"]["promotedOwnerMatchedTerms"] = promoted_native_owner.get("matchedTerms", [])
        native_trace["summary"]["promotedMethods"] = promoted_native_owner.get("methods", [])
        native_trace["summary"]["promotedFields"] = promoted_native_owner.get("fields", [])
        native_trace["summary"]["promotedRawValues"] = promoted_native_owner.get("rawValues", [])
    trace_payload = augment_trace_payload_with_native_reconstruction(
        target,
        trace_payload,
        native_trace.get("summary"),
    )
    with _trace_profile_span("finalBundleAssembly"):
        row_recovery = _build_token_shop_row_recovery(target, trace_payload, native_trace)
    closure_status = (row_recovery or {}).get("closureStatus") or {}
    with _trace_profile_span("finalBundleAssembly"):
        bridge_comparison_reference = (
            build_bridge_comparison_reference_payload(execution_trace_scope)
            if trace_payload.get("bridgeComparisonSeed")
            else {}
        )
        narrative_reference = resolve_target_narrative(
            execution_trace_scope,
            str(trace_payload.get("groundedConclusion") or ""),
            list(trace_payload.get("currentBoundary") or []),
            subject_kind=str(planner_resolution.get("selectedSubjectKind") or ""),
            subject_key=str(planner_resolution.get("selectedSubjectKey") or ""),
            family_id=str(target.get("familyId") or ""),
            compatibility_target_id=selected_target_id,
            allow_fallback=is_generic_explore,
        )
        dataset = {
        "dataset": "unity-trace-bundle",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "traceWorkflow": {
            "command": "node scripts/unity/run_extract.mjs trace [--target <target-id>] [--family <family-id>] [--query <query>] [--anchor <anchor>] [--extended-search <0|1|2>]",
            "directExample": "node scripts/unity/run_extract.mjs trace --target <target-id> --anchor <anchor>",
            "plannerExample": "node scripts/unity/run_extract.mjs trace --family <family-id> --query <query> --anchor <anchor> --extended-search <0|1|2>",
            "acceptedAnchors": target["acceptedAnchors"],
            "targetResolution": "explicit legacy target, explicit family, or checked DB-first query planner plus family-aware anchor expansion",
            "readsCommittedSourcesOnly": True,
        },
        "plannerResolution": {
            "selectionMode": planner_resolution["selectionMode"],
            "requestedQueries": planner_resolution["requestedQueries"],
            "requestedAnchors": planner_resolution["requestedAnchors"],
            "matchedInputs": planner_resolution["matchedInputs"],
            "matchedTerms": planner_resolution["matchedTerms"],
            "matchedFamilyId": planner_resolution["matchedFamilyId"],
            "matchedFamilyLabel": planner_resolution["matchedFamilyLabel"],
            "selectedSubjectKind": planner_resolution.get("selectedSubjectKind"),
            "selectedSubjectKey": planner_resolution.get("selectedSubjectKey"),
            "selectedSubjectLabel": planner_resolution.get("selectedSubjectLabel"),
            "runMode": planner_resolution["selectedRunMode"],
            "comparePresetId": None,
            "synonymSetsUsed": planner_resolution["synonymSetsUsed"],
            "expandedAnchors": planner_resolution["expandedAnchors"],
            "expandedAnchorSpecs": expanded_anchor_specs,
            "decisionNote": planner_resolution["decisionNote"],
        },
        "executionAnchors": execution_anchor_specs,
        "searchExpansion": {
            "level": extended_search,
            "label": "target-only" if extended_search <= 0 else "family-adjacent" if extended_search == 1 else "cross-family",
        },
        "depthSearch": {
            "level": resolved_depth_search,
            "label": "disabled" if resolved_depth_search <= 0 else f"{resolved_depth_search}-hop",
            "hops": trace_payload.get("depthExpansion", []),
        },
        "traceRegistry": {
            "catalogMode": "db-bootstrap",
            "selectedSubjectKind": planner_resolution.get("selectedSubjectKind"),
            "selectedSubjectKey": planner_resolution.get("selectedSubjectKey"),
            "executionTargetId": execution_target_id,
            "executionTraceScope": execution_trace_scope,
            "selectedFamilyId": target["familyId"],
            "requiredSourceFamilies": required_source_families,
            "defaultDepth": target.get("defaultDepth", 0),
            "followUpTerms": list(execution_plan.get("followUpTerms") or []),
            "depthPlan": list(execution_plan.get("depthPlan") or []),
            "claimStages": list(execution_plan.get("claimStages") or []),
            "sourceProjectionOwner": source_projection_owner,
            "executionContextSemanticKey": execution_context.get("semanticKey"),
            "executionPlanSemanticKey": execution_plan.get("semanticKey"),
        },
        "sources": {source_id: get_source_reference(source_id) for source_id in source_paths},
        "sourceRoles": source_roles,
        "nativeTrace": native_trace,
        "nativeReconstruction": native_trace.get("summary", {}),
        "rowRecovery": row_recovery,
        "status": closure_status.get("status"),
        "semanticStatus": closure_status.get("semanticStatus"),
        "literalStatus": closure_status.get("literalStatus"),
        "runtimeStatus": closure_status.get("runtimeStatus"),
        "target": {
            "id": selected_target_id,
            "label": execution_context.get("label") or target["label"],
            "familyId": execution_context.get("familyId") or target["familyId"],
            "anchors": anchors,
            "joinGoal": execution_context.get("joinGoal") or target["joinGoal"],
            "requiredSourceFamilies": required_source_families,
            "solvedBaselineTargetId": execution_context.get("solvedBaselineTargetId") or target["solvedBaselineTargetId"],
            "blockedTargetId": execution_context.get("blockedTargetId") or target["blockedTargetId"],
            "outputSummaryRules": execution_context.get("outputSummaryRules") or target.get("outputSummaryRules"),
        },
        "shellWindow": trace_payload["shellWindow"],
        "surfaces": trace_payload["surfaces"],
        "depthExpansion": trace_payload.get("depthExpansion", []),
        "traceGraph": trace_payload["traceGraph"],
        "outcome": trace_payload.get("outcome"),
        "bridgePromotionRule": trace_payload["bridgePromotionRule"],
        "bridgeCheck": (
            bridge_comparison_reference["bridgeCheck"]
            if bridge_comparison_reference
            else trace_payload["bridgeCheck"]
        ),
        "solvedVsBlockedDiff": (
            bridge_comparison_reference["solvedVsBlockedDiff"]
            if bridge_comparison_reference
            else trace_payload["solvedVsBlockedDiff"]
        ),
        "bridgeComparisonSeed": trace_payload.get("bridgeComparisonSeed"),
        "bridgeComparisonSemanticKey": bridge_comparison_reference.get(
            "bridgeComparisonSemanticKey",
            f"target-bridge-comparison:{execution_trace_scope}" if trace_payload.get("bridgeComparisonSeed") else None,
        ),
        "lostStructure": trace_payload["lostStructure"],
        "executionContextSemanticKey": execution_context.get("semanticKey") or f"target-execution-context:{execution_trace_scope}",
        "executionContext": execution_context or None,
        "groundedConclusion": narrative_reference["groundedConclusion"],
        "currentBoundary": narrative_reference["currentBoundary"],
        "narrativeSeed": {
            "groundedConclusion": str(trace_payload.get("groundedConclusion") or ""),
            "currentBoundary": list(trace_payload.get("currentBoundary") or []),
        },
        "narrativeSemanticKey": narrative_reference["narrativeSemanticKey"],
        "narrativeOwner": narrative_reference["narrativeOwner"],
        }
    return dataset


def write_markdown(dataset: dict[str, Any]) -> None:
    def format_source_ref(source_ref: str) -> str:
        return f"`{source_ref}`" if " + " in source_ref else md_link(ROOT / source_ref)

    if "nativeTrace" not in dataset and "nativeView" in dataset:
        lines = [
            "# Unity Trace Bundle",
            "",
            f"- Generated at: `{dataset.get('generatedAt')}`",
            f"- Target: `{(dataset.get('target') or {}).get('id')}`",
            f"- Label: {(dataset.get('target') or {}).get('label')}",
            f"- Status: `{dataset.get('status') or 'unknown'}`",
            f"- Semantic status: `{dataset.get('semanticStatus') or 'unknown'}`",
            f"- Literal status: `{dataset.get('literalStatus') or 'unknown'}`",
            f"- Runtime status: `{dataset.get('runtimeStatus') or 'unknown'}`",
            "",
            "## Canonical Sources",
            "",
        ]
        source_families = ((dataset.get("sourceFamilies") or {}).get("families") or {})
        source_order = list(((dataset.get("sourceFamilies") or {}).get("order") or source_families.keys()))
        for source_id in source_order:
            entry = source_families.get(source_id) or {}
            lines.append(f"- `{source_id}`: {format_source_ref(str(entry.get('reference') or 'n/a'))}")
            if entry.get("role"):
                lines.append(f"  - {entry['role']}")
        native_view = dataset.get("nativeView") or {}
        lines.extend([
            "",
            "## Native View",
            "",
            f"- Available: `{native_view.get('available')}`",
            f"- Project: `{native_view.get('project')}`",
            f"- Search terms: `{', '.join(native_view.get('searchTerms') or []) or 'none'}`",
            "",
            "## Semantic Coverage",
            "",
            f"- Canonical count: `{(dataset.get('semanticCoverage') or {}).get('canonicalCount', 0)}`",
            f"- Conflicted keys: `{', '.join((dataset.get('semanticCoverage') or {}).get('conflictedKeys', [])) or 'none'}`",
            "",
            "## Materialization",
            "",
            f"- Trace scope: `{(dataset.get('materialization') or {}).get('traceScope')}`",
            f"- Request signature: `{(dataset.get('materialization') or {}).get('requestSignature')}`",
            "",
        ])
        output_path = Path(dataset["traceRun"]["mdOut"])
        output_path.write_text("\n".join(lines), encoding="utf-8")
        return

    lines = [
        "# Unity Trace Bundle",
        "",
        f"- Generated at: `{dataset['generatedAt']}`",
        f"- Target: `{dataset['target']['id']}`",
        f"- Label: {dataset['target']['label']}",
        f"- Status: `{dataset.get('status') or 'unknown'}`",
        f"- Semantic status: `{dataset.get('semanticStatus') or 'unknown'}`",
        f"- Literal status: `{dataset.get('literalStatus') or 'unknown'}`",
        f"- Runtime status: `{dataset.get('runtimeStatus') or 'unknown'}`",
        f"- Asset set fingerprint: `{dataset['assetSet']['fingerprint']}`",
        f"- Anchors: `{', '.join(dataset['target']['anchors'])}`",
        f"- Join goal: {dataset['target']['joinGoal']}",
        "",
        "## Planner resolution",
        "",
        f"- Selection mode: `{dataset['plannerResolution']['selectionMode']}`",
        f"- Matched family: `{dataset['plannerResolution']['matchedFamilyId']}` ({dataset['plannerResolution']['matchedFamilyLabel']})",
        f"- Run mode: `{dataset['plannerResolution']['runMode']}`",
        f"- Requested queries: `{', '.join(dataset['plannerResolution']['requestedQueries']) or 'none'}`",
        f"- Requested anchors: `{', '.join(dataset['plannerResolution']['requestedAnchors']) or 'none'}`",
        f"- Expanded anchor kinds: `{format_anchor_specs(dataset['plannerResolution']['expandedAnchorSpecs'])}`",
        f"- Decision note: {dataset['plannerResolution']['decisionNote']}",
        "",
        "## Execution anchors",
        "",
        f"- Typed execution anchors: `{format_anchor_specs(dataset['executionAnchors'])}`",
        f"- Extended search: `{dataset['searchExpansion']['level']}` ({dataset['searchExpansion']['label']})",
        f"- Depth search: `{dataset['depthSearch']['level']}` ({dataset['depthSearch']['label']})",
        "",
        "## Workflow",
        "",
        f"- Command: `{dataset['traceWorkflow']['command']}`",
        f"- Direct example: `{dataset['traceWorkflow']['directExample']}`",
        f"- Planner example: `{dataset['traceWorkflow']['plannerExample']}`",
        f"- Accepted anchor kinds: `{', '.join(dataset['traceWorkflow']['acceptedAnchors'])}`",
        "- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.",
        f"- Subject: `{dataset['plannerResolution']['selectedSubjectKind']}` `{dataset['plannerResolution']['selectedSubjectKey']}`",
        f"- Execution scope: `{dataset['traceRegistry']['executionTraceScope']}`",
        f"- Family: `{dataset['traceRegistry']['selectedFamilyId']}`",
        f"- Catalog mode: `{dataset['traceRegistry'].get('catalogMode') or 'unknown'}`",
        f"- Default depth: `{dataset['traceRegistry']['defaultDepth']}`",
        "",
    ]
    trace_registry_path = dataset["traceRegistry"].get("path")
    if isinstance(trace_registry_path, str) and trace_registry_path.strip():
        lines.insert(
            len(lines) - 2,
            f"- Compatibility catalog path: {md_link(ROOT / trace_registry_path)}",
        )
    lines.extend(
        [
            "## Native Trace",
            "",
            f"- Available: `{dataset['nativeTrace']['available']}`",
            f"- Project: `{dataset['nativeTrace']['project']}`",
            f"- Search terms: `{', '.join(dataset['nativeTrace']['searchTerms']) or 'none'}`",
        ]
    )
    if dataset["nativeTrace"]["available"]:
        lines.append(f"- Status: `{dataset['nativeTrace'].get('status', 'unknown')}`")
        if dataset["nativeTrace"].get("jobId"):
            lines.append(f"- Job id: `{dataset['nativeTrace']['jobId']}`")
        native_summary = dataset["nativeTrace"].get("summary", {})
        promoted_owner = _select_promoted_native_owner(dataset["target"], dataset, native_summary)
        if native_summary.get("reconstructedOwners"):
            lines.append(
                f"- Reconstructed owners: `{', '.join(native_summary['reconstructedOwners'])}`"
            )
        if native_summary.get("ownerFamilyCandidates"):
            lines.append(
                f"- Owner families: `{', '.join(native_summary['ownerFamilyCandidates'])}`"
            )
        if native_summary.get("ownerCandidates"):
            lines.append(
                f"- Owner candidates: `{', '.join(native_summary['ownerCandidates'])}`"
            )
        if native_summary.get("reconstructedMethods"):
            lines.append(
                f"- Reconstructed methods: `{', '.join(native_summary['reconstructedMethods'])}`"
            )
        if native_summary.get("reconstructedFields"):
            lines.append(
                f"- Reconstructed fields: `{', '.join(native_summary['reconstructedFields'])}`"
            )
        if native_summary.get("rawValueTerms"):
            lines.append(
                f"- Raw value terms: `{', '.join(native_summary['rawValueTerms'])}`"
            )
        if promoted_owner:
            lines.append(
                f"- Top owner reconstruction: `{promoted_owner.get('owner')}` (score {promoted_owner.get('promotedScore', promoted_owner.get('score'))})"
            )
            if promoted_owner.get("matchedTerms"):
                lines.append(
                    f"- Promotion matched target terms: `{', '.join(promoted_owner['matchedTerms'])}`"
                )
        elif native_summary.get("scoredOwners"):
            top_owner = native_summary["scoredOwners"][0]
            lines.append(
                f"- Top owner reconstruction: `{top_owner.get('owner')}` (score {top_owner.get('score')})"
            )
        if native_summary.get("bridgedTerms"):
            lines.append(
                f"- Bridged terms: `{', '.join(native_summary['bridgedTerms'])}`"
            )
        if native_summary.get("metadataOnlyTerms"):
            lines.append(
                f"- Metadata-only terms: `{', '.join(native_summary['metadataOnlyTerms'])}`"
            )
        if native_summary.get("unresolvedTerms"):
            lines.append(
                f"- Unresolved terms: `{', '.join(native_summary['unresolvedTerms'])}`"
            )
    else:
        lines.append(f"- Reason: `{dataset['nativeTrace'].get('reason', 'unknown')}`")
    row_recovery = dataset.get("rowRecovery")
    if row_recovery:
        formula_value_summary = ", ".join(
            f"{item['field']}={item['value']}"
            for item in row_recovery.get("recoveredFormulaValues", [])
        ) or "none"
        object_binding_summary = ", ".join(
            f"{item['field']}->{item['pathId']}"
            for item in row_recovery.get("recoveredObjectBindings", [])
        ) or "none"
        lines.extend(
            [
                "",
                "## Row Recovery",
                "",
                f"- Shell: `{row_recovery.get('shellField')}` path id `{row_recovery.get('shellPathId')}`",
                f"- Native core terms: `{', '.join(row_recovery.get('nativeCoreTerms', [])) or 'none'}`",
                f"- Owner field block: `{', '.join(row_recovery.get('ownerFieldBlock', [])) or 'none'}`",
                f"- Recovered formula fields: `{', '.join(row_recovery.get('recoveredFormulaFields', [])) or 'none'}`",
                f"- Recovered formula values: `{formula_value_summary}`",
                f"- Recovered raw values: `{', '.join(row_recovery.get('recoveredRawValues', [])) or 'none'}`",
                f"- Action methods: `{', '.join(row_recovery.get('recoveredActionMethods', [])) or 'none'}`",
                f"- Controller objects: `{', '.join(row_recovery.get('controllerObjects', [])) or 'none'}`",
                f"- Object bindings: `{object_binding_summary}`",
                f"- Prefab candidates: `{', '.join(row_recovery.get('prefabCandidates', [])) or 'none'}`",
                f"- Text candidates: `{', '.join(row_recovery.get('textCandidates', [])) or 'none'}`",
                f"- Detached text candidates: `{', '.join(row_recovery.get('detachedTextCandidates', [])) or 'none'}`",
            ]
        )
        formula_reconstruction = row_recovery.get("formulaReconstruction", {})
        cost_model = formula_reconstruction.get("inferredCostModel") or {}
        bonus_model = formula_reconstruction.get("inferredBonusModel") or {}
        runtime_cost_model = formula_reconstruction.get("runtimeCostModel") or {}
        owner_cost_schema = formula_reconstruction.get("ownerCostSchema") or {}
        owner_blob_row = row_recovery.get("ownerBlobRow") or {}
        owner_modifier_scan = row_recovery.get("ownerModifierScan") or {}
        runtime_evaluator_recovery = row_recovery.get("runtimeEvaluatorRecovery") or {}
        runtime_instance_recovery = row_recovery.get("runtimeInstanceRecovery") or {}
        global_modifier_recovery = row_recovery.get("globalModifierRecovery") or {}
        next_row_preview_summary = ", ".join(
            "rel={} u32={} f32={}".format(
                item.get("relativeOffset"),
                item.get("u32"),
                item.get("f32"),
            )
            for item in owner_blob_row.get("nextRowPreviewScalars", [])
        ) or "none"
        lines.extend(
            [
                f"- Formula status: `{formula_reconstruction.get('status', 'none')}`",
                f"- Grounded constants: `{', '.join(f'{key}={value}' for key, value in (formula_reconstruction.get('groundedConstants') or {}).items() if value is not None) or 'none'}`",
                f"- Cost display slots: `{', '.join((formula_reconstruction.get('displaySlots') or {}).get('cost', [])) or 'none'}`",
                f"- Inferred cost model: `{cost_model.get('expression', 'none')}`",
                f"- Runtime cost model: `{runtime_cost_model.get('expression', 'none')}`",
                f"- Owner cost schema fields: `{', '.join(owner_cost_schema.get('fields', [])) or 'none'}`",
                f"- Owner calculation types: `{', '.join(owner_cost_schema.get('calculationTypeOptions', [])) or 'none'}`",
                f"- Owner blob row source: `{owner_blob_row.get('status', 'none')}`",
                f"- Owner blob shell offset: `{owner_blob_row.get('shellOffset', 'none')}`",
                f"- Owner blob next-row relative offset: `{owner_blob_row.get('nextRowShellRelativeOffset', 'none')}`",
                f"- Owner blob serialized runtime fields present: `{owner_blob_row.get('serializedRuntimeFieldsPresent', 'none')}`",
                f"- Owner blob next-row preview scalars: `{next_row_preview_summary}`",
                f"- Owner modifier matched components: `{', '.join(item.get('script', '') for item in owner_modifier_scan.get('matchedComponents', [])) or 'none'}`",
                f"- Runtime evaluator status: `{runtime_evaluator_recovery.get('status', 'none')}`",
                f"- Runtime evaluator methods: `{', '.join(runtime_evaluator_recovery.get('evaluatorMethods', [])) or 'none'}`",
                f"- Runtime evaluator backing fields: `{', '.join(runtime_evaluator_recovery.get('backingFields', [])) or 'none'}`",
                f"- Runtime evaluator direct terms: `{', '.join(runtime_evaluator_recovery.get('directRuntimeTerms', [])) or 'none'}`",
                f"- Runtime instance owner: `{runtime_instance_recovery.get('instanceOwner', 'none')}`",
                f"- Runtime instance selection key: `{runtime_instance_recovery.get('selectionKey', 'none')}`",
                f"- Runtime instance UI arrays: `{', '.join(runtime_instance_recovery.get('uiBindingArrays', [])) or 'none'}`",
                f"- Runtime instance fields: `{', '.join(runtime_instance_recovery.get('instanceFields', [])) or 'none'}`",
                f"- Global modifier candidate terms: `{', '.join(global_modifier_recovery.get('candidateTerms', [])) or 'none'}`",
                f"- Global modifier candidate methods: `{', '.join(global_modifier_recovery.get('candidateMethods', [])) or 'none'}`",
                f"- Global modifier sample ratio: `{((global_modifier_recovery.get('sampleRuntimeCheck') or {}).get('sampleDisplayToBaseRatio')) or 'none'}`",
                f"- Fast-buy status: `{(row_recovery.get('fastBuyRecovery') or {}).get('status', 'none')}`",
                f"- Fast-buy sample ratio: `{(((row_recovery.get('fastBuyRecovery') or {}).get('sampleRuntimeCheck') or {}).get('sampleDisplayToBaseRatio')) or 'none'}`",
                f"- Fast-buy inferred purchase factor: `{(((row_recovery.get('fastBuyRecovery') or {}).get('sampleRuntimeCheck') or {}).get('inferredPurchaseFactor')) or 'none'}`",
                f"- Fast-buy object roots: `{', '.join(item.get('hierarchyPath', '') for item in ((row_recovery.get('fastBuyRecovery') or {}).get('fastBuyObjects') or [])[:5]) or 'none'}`",
                f"- Bonus display slots: `{', '.join((formula_reconstruction.get('displaySlots') or {}).get('bonus', [])) or 'none'}`",
                f"- Inferred bonus model: `{bonus_model.get('expression', 'none')}`",
            ]
        )
        layout = row_recovery.get("rowLayoutExplanation", {}) or {}
        if layout:
            lines.extend(
                [
                    f"- Layout title line: `{((layout.get('titleLine') or {}).get('text')) or 'none'}`",
                    f"- Layout short effect line: `{((layout.get('shortEffectLine') or {}).get('text')) or 'none'}`",
                    f"- Layout long description line: `{((layout.get('longDescriptionLine') or {}).get('text')) or 'none'}`",
                    f"- Layout unresolved display values: `{', '.join(layout.get('unresolvedDisplayValues', [])) or 'none'}`",
                ]
            )
        presentation_follow_up = row_recovery.get("presentationFollowUp", {})
        presentation_update_path = row_recovery.get("presentationUpdatePath", {})
        render_node_summary = ", ".join(
            f"{item.get('name', '')} ({item.get('role', '')})"
            for item in presentation_update_path.get("renderNodes", [])
        ) or "none"
        recursive_root_summary = ", ".join(
            item.get("name", "")
            for item in presentation_update_path.get("recursiveGraph", [])
        ) or "none"
        lines.extend(
            [
                f"- Presentation follow-up primary terms: `{', '.join(presentation_follow_up.get('primaryTerms', [])) or 'none'}`",
                f"- Presentation follow-up orphaned terms: `{', '.join(presentation_follow_up.get('orphanedTerms', [])) or 'none'}`",
                f"- Presentation row-linked methods: `{', '.join((presentation_follow_up.get('rowLinkedNativeTerms') or {}).get('methods', [])) or 'none'}`",
                f"- Presentation row-linked fields: `{', '.join((presentation_follow_up.get('rowLinkedNativeTerms') or {}).get('fields', [])) or 'none'}`",
                f"- Presentation rejected native noise: `{', '.join((presentation_follow_up.get('rejectedNativeNoise') or {}).get('methods', [])[:8] + (presentation_follow_up.get('rejectedNativeNoise') or {}).get('fields', [])[:8]) or 'none'}`",
                f"- Presentation update hooks: `{', '.join(presentation_update_path.get('updateHookCandidates', [])) or 'none'}`",
                f"- Presentation slot scripts: `{', '.join(presentation_update_path.get('slotComponentScripts', [])) or 'none'}`",
                f"- Interaction nodes: `{', '.join(item.get('name', '') for item in presentation_update_path.get('interactionNodes', [])) or 'none'}`",
                f"- Render nodes: `{render_node_summary}`",
                f"- Recursive graph roots: `{recursive_root_summary}`",
            ]
        )
    lines.extend(["",])
    native_summary = dataset["nativeTrace"].get("summary", {})
    if native_summary.get("termSummaries"):
        lines.extend(
            [
                "### Native bridge terms",
                "",
            ]
        )
        for term_summary in native_summary["termSummaries"]:
            lines.append(
                "- `{}`: `{}`".format(
                    term_summary["term"],
                    term_summary["bridgeKind"],
                )
            )
            if term_summary.get("ownerCandidates"):
                lines.append(
                    "  - owner candidates: {}".format(", ".join(term_summary["ownerCandidates"]))
                )
            if term_summary.get("relatedTerms"):
                lines.append(
                    "  - related terms: {}".format(", ".join(term_summary["relatedTerms"]))
                )
            if term_summary.get("note"):
                lines.append("  - {}".format(term_summary["note"]))
        if native_summary.get("ownerToTerms"):
            lines.extend(
                [
                    "",
                    "### Reconstructed owner mapping",
                    "",
                ]
            )
            for owner, owner_terms in native_summary["ownerToTerms"].items():
                lines.append(f"- `{owner}`")
                if owner_terms.get("methods"):
                    lines.append("  - methods: {}".format(", ".join(owner_terms["methods"])))
                if owner_terms.get("fields"):
                    lines.append("  - fields: {}".format(", ".join(owner_terms["fields"])))
                if owner_terms.get("rawValues"):
                    lines.append("  - raw values: {}".format(", ".join(owner_terms["rawValues"])))
                if owner_terms.get("relatedTerms"):
                    lines.append("  - related terms: {}".format(", ".join(owner_terms["relatedTerms"])))
        if native_summary.get("scoredOwners"):
            lines.extend(
                [
                    "",
                    "### Scored owners",
                    "",
                ]
            )
            for owner_entry in native_summary["scoredOwners"][:5]:
                lines.append(
                    "- `{}` score `{}` via `{}`".format(
                        owner_entry.get("owner"),
                        owner_entry.get("score"),
                        ", ".join(owner_entry.get("reasons", [])) or "no-reasons",
                    )
                )
        lines.append("")
    if dataset.get("outcome"):
        lines.extend(
            [
                "## Outcome",
                "",
                f"- Kind: `{dataset['outcome']['kind']}`",
                f"- Label: {dataset['outcome']['label']}",
                f"- Summary: {dataset['outcome']['summary']}",
                "",
            ]
        )
    lines.extend(
        [
            "## Asset Set",
            "",
            f"- Fingerprint: `{dataset['assetSet']['fingerprint']}`",
            f"- Inputs: `{dataset['assetSet']['inputCount']}`",
            "",
        ]
    )
    lines.extend(
        [
            "## Source reads",
            "",
        ]
    )
    for source_role in dataset["sourceRoles"]:
        lines.append(f"- `{source_role['sourceId']}`: {format_source_ref(source_role['path'])}")
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
        lines.append(f"- Typed anchors: `{format_anchor_specs(surface.get('anchorSpecs', []))}`")
        for source_entry in surface["sources"]:
            lines.append(f"- Source: {format_source_ref(source_entry['sourcePath'])} ({source_entry['hitCount']} hits)")
            lines.append(
                f"  - Signal summary: {source_entry['highSignalHitCount']} high-signal, "
                f"{source_entry['supportingHitCount']} supporting, {source_entry['incidentalHitCount']} incidental, "
                f"{source_entry['suppressedNoiseCount']} suppressed-noise"
            )
            for hit in source_entry["hits"]:
                if source_entry["sourceId"] == "metadata":
                    lines.append(
                        f"  - `{hit['term']}` at metadata offset `{hit['offset']}` "
                        f"[{hit['signalTier']}, score {hit['signalScore']}, {hit['matchMode']}]"
                    )
                elif source_entry["sourceId"] in ("level0", "assets", "sharedassets0", "globalgamemanagers"):
                    if "pathId" in hit:
                        location = f"path_id `{hit['pathId']}` ({hit['objectType']}, {hit['surfaceType']})"
                    else:
                        location = f"raw offset `{hit['offset']}` ({hit.get('encoding', 'raw')}, {hit['surfaceType']})"
                    lines.append(
                        f"  - `{hit['term']}` at {location} "
                        f"[{hit['signalTier']}, score {hit['score']}, {hit['matchMode']}]"
                    )
                else:
                    lines.append(
                        f"  - `{hit['term']}` at `{hit['jsonPath']}` "
                        f"[{hit['signalTier']}, score {hit['signalScore']}, {hit['matchMode']}]"
                    )
        lines.append("")
    if dataset.get("depthExpansion"):
        lines.extend([
            "## Depth Expansion",
            "",
        ])
        for hop in dataset["depthExpansion"]:
            lines.append(f"### Hop {hop['hop']}")
            lines.append("")
            if hop.get("goal"):
                lines.append(f"- Goal: {hop['goal']}")
            if hop.get("plannedSurfaceIds"):
                lines.append(f"- Planned surfaces: `{', '.join(hop['plannedSurfaceIds'])}`")
            if hop.get("plannedTargetIds"):
                lines.append(f"- Planned targets: `{', '.join(hop['plannedTargetIds'])}`")
            if hop.get("plannedTargetLabels"):
                lines.append(f"- Target labels: `{', '.join(hop['plannedTargetLabels'])}`")
            if hop.get("plannedSourceIds"):
                lines.append(f"- Planned sources: `{', '.join(hop['plannedSourceIds'])}`")
            lines.append(f"- Follow-up terms: `{', '.join(hop['terms']) or 'none'}`")
            lines.append(f"- Typed anchors: `{format_anchor_specs(hop.get('anchorSpecs', []))}`")
            for source_entry in hop["sources"]:
                lines.append(f"- Source: {md_link(ROOT / source_entry['sourcePath'])} ({source_entry['hitCount']} hits)")
                lines.append(
                    f"  - Signal summary: {source_entry['highSignalHitCount']} high-signal, "
                    f"{source_entry['supportingHitCount']} supporting, {source_entry['incidentalHitCount']} incidental, "
                    f"{source_entry['suppressedNoiseCount']} suppressed-noise"
                )
            lines.append("")
    if dataset["traceRegistry"].get("depthPlan"):
        lines.extend([
            "## Registry Depth Plan",
            "",
        ])
        for step in dataset["traceRegistry"]["depthPlan"]:
            lines.append(f"- Hop `{step['hop']}`: {step['goal']}")
            if step.get("surfaceIds"):
                lines.append(f"  - Surfaces: `{', '.join(step['surfaceIds'])}`")
            if step.get("targetIds"):
                lines.append(f"  - Targets: `{', '.join(step['targetIds'])}`")
        lines.append("")
    if dataset["traceRegistry"].get("claimStages"):
        lines.extend([
            "## Claim Stages",
            "",
        ])
        for stage in dataset["traceRegistry"]["claimStages"]:
            lines.append(f"- `{stage['id']}`: {stage['label']}")
            lines.append(f"  - Required edges: `{', '.join(stage.get('requiredEdgeTypes', []))}`")
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
        f"- {dataset.get('groundedConclusion') or 'Canonical target narrative fragment is missing; rebuild trace views before trusting narrative state.'}",
        "",
    ])
    output_path = Path(dataset["traceRun"]["mdOut"])
    output_path.write_text("\n".join(lines), encoding="utf-8")


def sanitize_run_label(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "trace"


def build_trace_asset_set() -> dict[str, Any]:
    asset_paths = [
        METADATA_PATH,
        CANONICAL_SOURCE_PATHS["level0"],
        *ASSET_SOURCE_MEMBER_PATHS.values(),
        CANONICAL_SOURCE_PATHS["native"],
    ]
    fingerprint_parts: list[str] = []
    inputs: list[dict[str, Any]] = []
    for path in asset_paths:
        if not path.exists():
            continue
        stat = path.stat()
        rel_path = repo_relative(path)
        fingerprint_parts.append(f"{rel_path}:{stat.st_size}:{stat.st_mtime_ns}")
        inputs.append(
            {
                "path": rel_path,
                "size": stat.st_size,
                "modifiedAt": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
            }
        )
    digest = hashlib.sha1("|".join(fingerprint_parts).encode("utf-8")).hexdigest()[:12]
    return {
        "fingerprint": digest,
        "inputCount": len(inputs),
        "inputs": inputs,
    }


def allocate_trace_run_paths(target_id: str, family_id: str, explicit_json_out: Path | None, explicit_md_out: Path | None) -> tuple[Path, Path, str]:
    run_label = sanitize_run_label(target_id or family_id)
    json_path = explicit_json_out or (TRACE_RUNS_DIR / f"{run_label}.json")
    md_path = explicit_md_out or (TRACE_RUNS_DIR / f"{run_label}.md")
    return json_path, md_path, run_label


def export_trace_run(dataset: dict[str, Any], json_out: Path, md_out: Path) -> None:
    TRACE_RUNS_DIR.mkdir(parents=True, exist_ok=True)
    export_dataset = dict(dataset or {})
    row_recovery = dict(export_dataset.get("rowRecovery") or {})
    if row_recovery:
        sanitized_row_recovery = dict(row_recovery)
        if sanitized_row_recovery.get("literalRecoverySummary") is None:
            sanitized_row_recovery["literalRecoverySummary"] = build_token_shop_literal_recovery_summary(
                dict(row_recovery.get("literalSchemaRecovery") or {}),
                dict(row_recovery.get("literalTextRecovery") or {}),
            )
        sanitized_row_recovery.pop("closureStatus", None)
        sanitized_row_recovery.pop("literalSchemaRecovery", None)
        sanitized_row_recovery.pop("literalTextRecovery", None)
        export_dataset["rowRecovery"] = sanitized_row_recovery
    json_out.write_text(json.dumps(export_dataset, indent=2) + "\n", encoding="utf-8")
    write_markdown(export_dataset)


def build_trace_request_signature(
    selected_target_id: str,
    selected_family_id: str,
    queries: list[str],
    anchors: list[str],
    extended_search: int,
    depth_search: int | None,
    level: str,
    asset_fingerprint: str,
) -> str:
    payload = {
        "target": selected_target_id,
        "family": selected_family_id,
        "queries": sorted(set(queries)),
        "anchors": sorted(set(anchors)),
        "extendedSearch": extended_search,
        "depthSearch": depth_search,
        "level": level,
        "assetFingerprint": asset_fingerprint,
    }
    return hashlib.sha1(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:16]


def _semantic_key(*parts: Any) -> str:
    return ":".join(str(part).strip() for part in parts if str(part).strip())


def _load_canonical_term_payload(term: str) -> dict[str, Any]:
    view = get_trace_db().find_canonical_term_view("cifi-full", "libil2cpp.so", term)
    if not view:
        return {}
    return dict(view.get("result") or {})


def _load_canonical_semantic_payload(fragment_kind: str, fragment_key: str) -> dict[str, Any]:
    view = get_trace_db().find_canonical_semantic_fragment("cifi-full", "libil2cpp.so", fragment_kind, fragment_key)
    if not view:
        return {}
    return dict(view.get("payload") or {})


def _load_canonical_semantic_scope_payload(dataset: dict[str, Any]) -> dict[str, Any]:
    row_recovery = dataset.get("rowRecovery") or {}
    semantic_scope_id = str(row_recovery.get("semanticScopeId") or "").strip()
    if not semantic_scope_id:
        return {}
    return load_canonical_semantic_scope(semantic_scope_id)


def _build_dependency_scope_summary(scope_payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(scope_payload, dict) or not scope_payload:
        return {}
    row_local_graph = dict(scope_payload.get("rowLocalGraph") or {})
    return {
        "scopeId": scope_payload.get("scopeId"),
        "scopeType": scope_payload.get("scopeType"),
        "familyId": scope_payload.get("familyId"),
        "targetId": scope_payload.get("targetId"),
        "traceScope": scope_payload.get("traceScope"),
        "rowShell": dict(row_local_graph.get("rowShell") or {}),
        "rowLocalGraph": row_local_graph,
        "missingSeams": list(scope_payload.get("missingSeams") or []),
        "compatibilityStatus": dict(scope_payload.get("compatibilityStatus") or {}),
    }


def _load_target_ui_binding_views(target: dict[str, Any]) -> dict[str, dict[str, Any]]:
    family_id = str(target.get("familyId") or "").strip()
    target_id = str(target.get("id") or "").strip()
    if not family_id or not target_id:
        return {}
    views: dict[str, dict[str, Any]] = {}
    for role in ("title", "description", "cost", "level", "requirement", "bonus", "fill", "icon", "overlay"):
        fragment_key = _semantic_key("ui-binding", family_id, target_id, role)
        payload = _load_canonical_semantic_payload("ui_binding_fragment", fragment_key)
        if payload:
            views[role] = payload
    return views


def _collect_dependency_edges(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    trace_graph = dataset.get("traceGraph") or {}
    row_recovery = dataset.get("rowRecovery") or {}
    semantic_scope_payload = _load_canonical_semantic_scope_payload(dataset)
    for candidate in (
        trace_graph.get("edges"),
        (row_recovery.get("semanticGraph") or {}).get("edges"),
        (semantic_scope_payload.get("semanticGraph") or {}).get("edges"),
    ):
        if isinstance(candidate, list) and candidate:
            return [edge for edge in candidate if isinstance(edge, dict)]
    return []


def extract_owner_controller_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    row_recovery = dataset.get("rowRecovery") or {}
    target = dataset.get("target") or {}
    native_reconstruction = dataset.get("nativeReconstruction") or {}
    trace_payload = dataset.get("tracePayload") or {}
    trace_shell = trace_payload.get("shellWindow") or {}
    fragments: list[dict[str, Any]] = []
    owner_blob_row = row_recovery.get("ownerBlobRow") or {}
    runtime_instance = row_recovery.get("runtimeInstanceRecovery") or {}
    runtime_evaluator = row_recovery.get("runtimeEvaluatorRecovery") or {}
    owner_field_block = list(
        row_recovery.get("ownerFieldBlock")
        or owner_blob_row.get("ownerFieldBlock")
        or trace_shell.get("ownerFieldBlock")
        or []
    )
    controller_block = list(
        row_recovery.get("controllerBlock")
        or owner_blob_row.get("controllerBlock")
        or []
    )
    owner_names = unique_strings([
        str(runtime_instance.get("instanceOwner") or ""),
        str(runtime_evaluator.get("owner") or ""),
        *(str(owner) for owner in (native_reconstruction.get("owners") or [])),
    ])
    for owner in owner_names:
        canonical_payload = _load_canonical_semantic_payload("owner_controller_fragment", _semantic_key("owner-controller", owner))
        fragments.append(
            {
                "fragment_kind": "owner_controller_fragment",
                "fragment_key": _semantic_key("owner-controller", owner),
                "payload": {
                    "semanticKey": _semantic_key("owner-controller", owner),
                    "owner": owner,
                    "familyId": target.get("familyId"),
                    "targetId": target.get("id"),
                    "ownerFieldBlock": owner_field_block,
                    "controllerBlock": controller_block,
                    "ownerBlobRow": owner_blob_row,
                    "runtimeEvaluatorRecovery": runtime_evaluator,
                    "runtimeInstanceRecovery": runtime_instance,
                    "dbCorroboration": canonical_payload,
                },
            }
        )
    return fragments


def extract_formula_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    row_recovery = dataset.get("rowRecovery") or {}
    formula_reconstruction = row_recovery.get("formulaReconstruction") or {}
    target = dataset.get("target") or {}
    recovered_formula_fields = list(row_recovery.get("recoveredFormulaFields") or [])
    canonical_field_views = {
        field: _load_canonical_term_payload(field)
        for field in recovered_formula_fields
    }
    grounded = dict(formula_reconstruction.get("groundedConstants") or {})
    for field in recovered_formula_fields:
        if grounded.get(field) is not None:
            continue
        field_view = canonical_field_views.get(field) or {}
        for value in (
            field_view.get("termBridge", {}).get("resolvedValue"),
            field_view.get("managedReconstruction", {}).get("resolvedValue"),
            field_view.get("resolvedValue"),
        ):
            if value is not None:
                grounded[field] = value
                break
    if not grounded and not recovered_formula_fields:
        return []
    formula_key = _semantic_key(
        "formula",
        target.get("familyId"),
        *recovered_formula_fields,
    ) or _semantic_key("formula", target.get("id"))
    return [
        {
            "fragment_kind": "formula_fragment",
            "fragment_key": formula_key,
            "payload": {
                "semanticKey": formula_key,
                "targetId": target.get("id"),
                "familyId": target.get("familyId"),
                "recoveredFormulaFields": recovered_formula_fields,
                "groundedConstants": grounded,
                "inferredCostModel": formula_reconstruction.get("inferredCostModel"),
                "runtimeCostModel": formula_reconstruction.get("runtimeCostModel"),
                "canonicalFieldViews": canonical_field_views,
            },
        }
    ]


def extract_threshold_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    row_recovery = dataset.get("rowRecovery") or {}
    formula_reconstruction = row_recovery.get("formulaReconstruction") or {}
    runtime_cost_model = formula_reconstruction.get("runtimeCostModel") or {}
    if not runtime_cost_model:
        return []
    target = dataset.get("target") or {}
    semantic_scope_payload = _load_canonical_semantic_scope_payload(dataset)
    missing_seams = list((semantic_scope_payload.get("missingSeams") or []))
    unresolved_runtime_targets = []
    for seam in missing_seams:
        if str((seam or {}).get("id") or "") == "runtime-model-gap":
            unresolved_runtime_targets.extend(list((seam or {}).get("targets") or []))
    if not unresolved_runtime_targets:
        runtime_cost_model = dict((dataset.get("rowRecovery") or {}).get("formulaReconstruction", {}).get("runtimeCostModel") or {})
        if str(runtime_cost_model.get("status") or "") == "unresolved-runtime-modifiers":
            unresolved_runtime_targets = ["displayed-cost-runtime-modifiers"]
    threshold_key = _semantic_key("threshold", target.get("familyId"), target.get("id"), "runtime-cost")
    return [
        {
            "fragment_kind": "threshold_fragment",
            "fragment_key": threshold_key,
            "payload": {
                "semanticKey": threshold_key,
                "targetId": target.get("id"),
                "familyId": target.get("familyId"),
                "runtimeCostModel": runtime_cost_model,
                "unresolvedRuntimeTargets": unresolved_runtime_targets,
            },
        }
    ]


def extract_dependency_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    target = dataset.get("target") or {}
    fragments: list[dict[str, Any]] = []
    for edge in _collect_dependency_edges(dataset):
        if not isinstance(edge, dict):
            continue
        edge_type = str(edge.get("type") or "").strip()
        source = str(edge.get("from") or "").strip()
        dest = str(edge.get("to") or "").strip()
        if not edge_type or not source or not dest:
            continue
        edge_key = _semantic_key("dependency", target.get("familyId"), edge_type, source, dest)
        fragments.append(
            {
                "fragment_kind": "dependency_fragment",
                "fragment_key": edge_key,
                "payload": {
                    "semanticKey": edge_key,
                    "targetId": target.get("id"),
                    "familyId": target.get("familyId"),
                    "edge": edge,
                },
            }
        )
    return fragments


def extract_ui_binding_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    row_recovery = dataset.get("rowRecovery") or {}
    presentation_update = row_recovery.get("presentationUpdatePath") or {}
    target = dataset.get("target") or {}
    trace_payload = dataset.get("tracePayload") or {}
    trace_shell = trace_payload.get("shellWindow") or {}
    canonical_bindings = _load_target_ui_binding_views(target)
    slot_roles = sorted(
        {
            *[str(role) for role in (presentation_update.get("slots") or {}).keys()],
            *[str(role) for role in canonical_bindings.keys()],
        }
    )
    fragments: list[dict[str, Any]] = []
    for role in slot_roles:
        values = (presentation_update.get("slots") or {}).get(role) or []
        canonical_binding = canonical_bindings.get(role) or {}
        if not values:
            values = list(canonical_binding.get("values") or [])
        effective_presentation_path = presentation_update or {}
        if not effective_presentation_path:
            presentation_paths = canonical_binding.get("presentationUpdatePaths") or []
            if presentation_paths:
                effective_presentation_path = presentation_paths[0]
        if not values:
            continue
        shell_window = {
            "shellField": row_recovery.get("shellField") or trace_shell.get("shellField"),
            "shellPathId": row_recovery.get("shellPathId") or trace_shell.get("shellPathId"),
            "ownerFieldBlock": list(
                row_recovery.get("ownerFieldBlock")
                or trace_shell.get("ownerFieldBlock")
                or []
            ),
        }
        if not any(shell_window.get(key) for key in ("shellField", "shellPathId", "ownerFieldBlock")):
            shell_window = {}
        role_key = _semantic_key("ui-binding", target.get("familyId"), target.get("id"), role)
        fragments.append(
            {
                "fragment_kind": "ui_binding_fragment",
                "fragment_key": role_key,
                "payload": {
                    "semanticKey": role_key,
                    "targetId": target.get("id"),
                    "familyId": target.get("familyId"),
                    "role": role,
                    "values": values,
                    "presentationUpdatePath": effective_presentation_path,
                    "shellField": row_recovery.get("shellField"),
                    "shellWindow": shell_window,
                    "dbCorroboration": canonical_binding,
                },
            }
        )
    return fragments


def extract_progression_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    row_recovery = dataset.get("rowRecovery") or {}
    runtime_evaluator = row_recovery.get("runtimeEvaluatorRecovery") or {}
    if not runtime_evaluator:
        return []
    target = dataset.get("target") or {}
    assessment_key = f"target-assessment:{target.get('id')}"
    progression_key = _semantic_key("progression", target.get("familyId"), str(runtime_evaluator.get("owner") or "runtime"))
    return [
        {
            "fragment_kind": "progression_fragment",
            "fragment_key": progression_key,
            "payload": {
                "semanticKey": progression_key,
                "targetId": target.get("id"),
                "familyId": target.get("familyId"),
                "runtimeEvaluatorRecovery": runtime_evaluator,
                "assessmentSemanticKey": assessment_key,
            },
        }
    ]


def extract_runtime_table_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    row_recovery = dataset.get("rowRecovery") or {}
    runtime_instance = row_recovery.get("runtimeInstanceRecovery") or {}
    if not runtime_instance:
        return []
    target = dataset.get("target") or {}
    runtime_key = _semantic_key("runtime-table", target.get("familyId"), str(runtime_instance.get("instanceOwner") or target.get("id")))
    return [
        {
            "fragment_kind": "runtime_table_fragment",
            "fragment_key": runtime_key,
            "payload": {
                "semanticKey": runtime_key,
                "targetId": target.get("id"),
                "familyId": target.get("familyId"),
                "runtimeInstanceRecovery": runtime_instance,
                "nativeReconstruction": dataset.get("nativeReconstruction"),
            },
        }
    ]


def extract_semantic_scope_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    row_recovery = dataset.get("rowRecovery") or {}
    semantic_scope_id = str(row_recovery.get("semanticScopeId") or "").strip()
    if not semantic_scope_id:
        return []
    if semantic_scope_id.startswith("row:") or semantic_scope_id == "shard-owned-state:upgradeinfolist-population":
        return []
    target = dataset.get("target") or {}
    canonical_scope = _load_canonical_semantic_scope_payload(dataset)
    scope_payload = canonical_scope or {
        "semanticKey": semantic_scope_id,
        "targetId": target.get("id"),
        "familyId": target.get("familyId"),
        "semanticGraph": row_recovery.get("semanticGraph"),
        "semanticSearchPlan": row_recovery.get("semanticSearchPlan"),
    }
    return [
        {
            "fragment_kind": "semantic_scope_fragment",
            "fragment_key": semantic_scope_id,
            "payload": scope_payload,
        }
    ]


def extract_reconstruction_note_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    target = dataset.get("target") or {}
    note_key = _semantic_key("reconstruction-note", target.get("familyId"), target.get("id"))
    assessment_key = f"target-assessment:{target.get('id')}"
    narrative_key = f"target-narrative:{target.get('id')}"
    return [
        {
            "fragment_kind": "reconstruction_note_fragment",
            "fragment_key": note_key,
            "payload": {
                "semanticKey": note_key,
                "targetId": target.get("id"),
                "familyId": target.get("familyId"),
                "assessmentSemanticKey": assessment_key,
                "narrativeSemanticKey": narrative_key,
                "bridgeCheck": dataset.get("bridgeCheck"),
            },
        }
    ]


def collect_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    fragments: list[dict[str, Any]] = []
    for extractor in (
        extract_owner_controller_semantic_fragments,
        extract_formula_semantic_fragments,
        extract_threshold_semantic_fragments,
        extract_dependency_semantic_fragments,
        extract_ui_binding_semantic_fragments,
        extract_progression_semantic_fragments,
        extract_runtime_table_semantic_fragments,
        extract_semantic_scope_semantic_fragments,
        extract_reconstruction_note_semantic_fragments,
    ):
        fragments.extend(extractor(dataset))
    return fragments


def _planner_resolution_from_best_gap_plan(
    best_gap_plan: dict[str, Any],
    queries: list[str],
    anchors: list[str],
) -> dict[str, Any]:
    requested_queries = unique_strings(queries)
    requested_anchors = unique_strings(anchors)
    best_gap_anchors = unique_strings(
        [
            *list(best_gap_plan.get("selectedAnchors") or []),
            *list(best_gap_plan.get("anchors") or []),
        ]
    )
    expanded_anchors = unique_strings(
        [
            *best_gap_anchors,
            *requested_queries,
            *requested_anchors,
        ]
    )
    matched_inputs = unique_strings(
        [
            *requested_queries,
            *requested_anchors,
            *list(best_gap_plan.get("semanticScopeIds") or []),
        ]
    )
    subject_kind = str(best_gap_plan.get("selectedSubjectKind") or "").strip() or "semantic-scope"
    subject_key = str(best_gap_plan.get("selectedSubjectKey") or "").strip()
    if not subject_key:
        scope_ids = list(best_gap_plan.get("semanticScopeIds") or [])
        subject_key = str(scope_ids[0] if scope_ids else best_gap_plan.get("traceScope") or "").strip()
    subject_label = str(best_gap_plan.get("selectedSubjectLabel") or subject_key or best_gap_plan.get("label") or "").strip()
    return {
        "selectionMode": "best-gap-db",
        "requestedQueries": requested_queries,
        "requestedAnchors": requested_anchors,
        "matchedInputs": matched_inputs,
        "matchedTerms": unique_strings(
            [
                *matched_inputs,
                *best_gap_anchors,
            ]
        ),
        "matchedFamilyId": str(best_gap_plan.get("familyId") or "exploration"),
        "matchedFamilyLabel": str(best_gap_plan.get("label") or best_gap_plan.get("traceScope") or "Exploration"),
        "selectedSubjectKind": subject_kind,
        "selectedSubjectKey": subject_key,
        "selectedSubjectLabel": subject_label,
        "selectedTargetId": str(best_gap_plan.get("targetId") or best_gap_plan.get("traceScope") or "generic-explore"),
        "selectedRunMode": "trace",
        "selectedComparePresetId": None,
        "synonymSetsUsed": [],
        "expandedAnchors": expanded_anchors,
        "decisionNote": (
            "Selected the highest-value unresolved DB-backed gap directly from canonical trace state, "
            f"using {subject_kind} {subject_key or 'unknown'} as the execution subject"
            f" for seam {best_gap_plan.get('selectedSeamId') or 'unknown'}."
        ),
    }


def _cached_knowledge_plan_from_best_gap_plan(best_gap_plan: dict[str, Any]) -> dict[str, Any]:
    subject_state = dict(best_gap_plan.get("subjectState") or {})
    acquisition_plan = dict(best_gap_plan.get("acquisitionPlan") or {})
    known_edge_types = unique_strings(
        [
            *list(subject_state.get("knownEdges") or []),
            *list(best_gap_plan.get("knownEdgeTypes") or []),
        ]
    )
    blocked_edge_types = unique_strings(
        [
            *list(subject_state.get("blockedEdges") or []),
            *list(best_gap_plan.get("blockedEdgeTypes") or []),
        ]
    )
    missing_edge_types = unique_strings(
        [
            *list(subject_state.get("missingEdges") or []),
            *list(best_gap_plan.get("baselineGap") or []),
        ]
    )
    nonblocking_edge_types = unique_strings(
        [
            *list(subject_state.get("nonblockingEdges") or []),
            *list(best_gap_plan.get("nonblockingEdgeTypes") or []),
        ]
    )
    next_seam = dict(subject_state.get("nextSeam") or {})
    if not str(next_seam.get("id") or "").strip():
        next_seam = {
            "id": str(best_gap_plan.get("selectedSeamId") or "").strip() or None,
            "status": "unresolved",
        }
    mode = "run-seam-trace"
    if list(acquisition_plan.get("steps") or []) and (
        str(acquisition_plan.get("selectedSeamId") or "").strip()
        != str(next_seam.get("id") or "").strip()
    ):
        mode = "run-evidence-acquisition"
    return {
        "mode": mode,
        "status": "db-cached",
        "executionRoutineId": str(best_gap_plan.get("executionRoutineId") or ""),
        "nextSeam": next_seam,
        "acquisitionPlan": acquisition_plan,
        "knowledge": {
            "subjectId": str(subject_state.get("subjectId") or best_gap_plan.get("selectedSubjectKey") or ""),
            "subjectKind": str(subject_state.get("subjectKind") or best_gap_plan.get("selectedSubjectKind") or ""),
            "subjectLabel": str(subject_state.get("subjectLabel") or best_gap_plan.get("selectedSubjectLabel") or ""),
            "targetAliases": list(subject_state.get("targetAliases") or best_gap_plan.get("targetAliases") or []),
            "knownEdges": known_edge_types,
            "clearedEdgeTypes": known_edge_types,
            "blockedEdges": blocked_edge_types,
            "blockedEdgeTypes": blocked_edge_types,
            "missingEdges": missing_edge_types,
            "missingEdgeTypes": missing_edge_types,
            "nonblockingEdges": nonblocking_edge_types,
            "nonblockingEdgeTypes": nonblocking_edge_types,
            "decisionSummary": dict(subject_state.get("decisionSummary") or best_gap_plan.get("decisionSummary") or {}),
            "acquisitionPlan": acquisition_plan,
        },
    }


def plan_trace_bundle_request(
    args: argparse.Namespace,
    registry: dict[str, Any] | None = None,
) -> dict[str, Any]:
    registry = registry or load_request_catalog()
    best_gap_plan = dict(getattr(args, "best_gap_plan", {}) or {})
    if best_gap_plan:
        planner_resolution = _planner_resolution_from_best_gap_plan(
            best_gap_plan,
            args.query,
            args.anchor,
        )
        selected_target_id = str(planner_resolution["selectedTargetId"])
        execution_target_id = str(best_gap_plan.get("targetId") or best_gap_plan.get("traceScope") or selected_target_id)
        execution_trace_scope = str(best_gap_plan.get("traceScope") or selected_target_id)
        selected_family_id = (
            str(registry["targets"][selected_target_id]["familyId"])
            if selected_target_id in registry.get("targets", {})
            else str(planner_resolution.get("matchedFamilyId") or args.family or "exploration")
        )
        if not str(selected_family_id or "").strip():
            selected_family_id = _infer_runtime_family_id(
                selected_target_id,
                execution_target_id,
                execution_trace_scope,
                best_gap_plan.get("familyId"),
            )
        if not str(selected_family_id or "").strip():
            selected_family_id = "exploration"
        knowledge_plan = {}
        if execution_trace_scope and execution_trace_scope != "generic-explore":
            if best_gap_plan:
                knowledge_plan = _cached_knowledge_plan_from_best_gap_plan(best_gap_plan)
            else:
                with _trace_profile_span("subjectStateMaterialization"):
                    knowledge_plan = dict(
                        get_trace_db().resolve_trace_execution_request(
                            "cifi-full",
                            "libil2cpp.so",
                            execution_trace_scope,
                            subject_kind=str(planner_resolution.get("selectedSubjectKind") or ""),
                            subject_key=str(planner_resolution.get("selectedSubjectKey") or ""),
                            family_id=selected_family_id,
                            compatibility_target_id=selected_target_id,
                        )
                        or {}
                    )
    else:
        with _trace_profile_span("subjectStateMaterialization"):
            resolved_request = dict(
                get_trace_db().resolve_trace_request(
                    "cifi-full",
                    "libil2cpp.so",
                    explicit_target_id=str(args.target or ""),
                    requested_queries=list(args.query or []),
                    requested_anchors=list(args.anchor or []),
                    family_id=str(args.family or ""),
                    include_legacy_targets=False,
                )
                or {}
            )
        planner_resolution = dict(resolved_request.get("plannerResolution") or {})
        selected_target_id = str(resolved_request.get("selectedTargetId") or planner_resolution.get("selectedTargetId") or "")
        execution_target_id = str(resolved_request.get("executionTargetId") or selected_target_id)
        execution_trace_scope = str(resolved_request.get("executionTraceScope") or execution_target_id)
        selected_family_id = str(resolved_request.get("selectedFamilyId") or planner_resolution.get("matchedFamilyId") or "").strip()
        if not selected_family_id and selected_target_id in registry.get("targets", {}):
            selected_family_id = str(registry["targets"][selected_target_id].get("familyId") or "").strip()
        if not selected_family_id:
            selected_family_id = _infer_runtime_family_id(
                selected_target_id,
                execution_target_id,
                execution_trace_scope,
                args.family,
            )
        if not selected_family_id:
            selected_family_id = str(args.family or "exploration")
        knowledge_plan = dict(resolved_request.get("knowledgePlan") or {})
    with _trace_profile_span("dbReads.assetFingerprint"):
        asset_set = build_trace_asset_set()
    request_signature = build_trace_request_signature(
        execution_trace_scope,
        selected_family_id,
        args.query,
        args.anchor,
        args.extended_search,
        args.depth_search,
        args.level,
        asset_set.get("fingerprint", ""),
    )
    return {
        "plannerResolution": planner_resolution,
        "selectedSubjectKind": str(planner_resolution.get("selectedSubjectKind") or ""),
        "selectedSubjectKey": str(planner_resolution.get("selectedSubjectKey") or ""),
        "selectedTargetId": selected_target_id,
        "executionTargetId": execution_target_id,
        "executionTraceScope": execution_trace_scope,
        "selectedFamilyId": selected_family_id,
        "knowledgePlan": knowledge_plan,
        "assetSet": asset_set,
        "requestSignature": request_signature,
    }


def collect_trace_bundle_components(
    args: argparse.Namespace,
    trace_plan: dict[str, Any],
    registry: dict[str, Any] | None = None,
) -> dict[str, Any]:
    dataset = build_dataset(
        trace_plan,
        args.target,
        args.query,
        args.anchor,
        registry,
        args.family,
        args.extended_search,
        args.depth_search,
        args.native_timeout,
    )
    with _trace_profile_span("finalBundleAssembly"):
        dataset["semanticFragments"] = collect_semantic_fragments(dataset)
    return dataset


def persist_trace_bundle_fragments(
    dataset: dict[str, Any],
    trace_scope: str,
    request_signature: str,
) -> None:
    db = get_trace_db()
    with _trace_profile_span("dbWrites"):
        db.upsert_trace_dataset("cifi-full", "libil2cpp.so", trace_scope, request_signature, dataset)


def materialize_trace_bundle_dataset(
    dataset: dict[str, Any],
    trace_scope: str,
    request_signature: str,
) -> dict[str, Any]:
    current_trace_run = dict(dataset.get("traceRun", {}) or {})
    db = get_trace_db()
    with _trace_profile_span("dbReads"):
        materialized = db.find_materialized_target_bundle_view("cifi-full", "libil2cpp.so", trace_scope, request_signature)
        if materialized is None:
            materialized = db.find_materialized_trace_view("cifi-full", "libil2cpp.so", trace_scope, request_signature)
    if materialized:
        with _trace_profile_span("reducerMaterializerRebuild"):
            payload = dict(materialized["payload"])
            trace_run = dict(current_trace_run)
            trace_run["dbBacked"] = True
            trace_run["traceScope"] = trace_scope
            trace_run["requestSignature"] = request_signature
            trace_run["materializedAt"] = materialized.get("builtAt")
            trace_run["reducerVersion"] = materialized.get("reducerVersion")
            payload["traceRun"] = trace_run
            payload["traceProvenance"] = materialized.get("provenance", {})
            materialized_native_trace = get_trace_db().find_materialized_native_trace_view("cifi-full", "libil2cpp.so", request_signature)
            if materialized_native_trace:
                payload.setdefault("nativeTrace", {})
                if isinstance(payload.get("nativeTrace"), dict):
                    native_trace_payload = dict(materialized_native_trace.get("payload") or {})
                    if native_trace_payload.get("result") is not None:
                        native_trace_payload["summary"] = _summarize_native_result(
                            native_trace_payload.get("result"),
                            list(native_trace_payload.get("requestedTerms") or []),
                            str(payload.get("traceRegistry", {}).get("selectedFamilyId") or "").strip() or None,
                            dict(native_trace_payload.get("requestContext") or {}),
                        )
                    for key, value in native_trace_payload.items():
                        if payload["nativeTrace"].get(key) in (None, "", [], {}) and value not in (None, "", [], {}):
                            payload["nativeTrace"][key] = value
        return payload
    dataset["traceRun"] = dict(current_trace_run)
    dataset["traceRun"]["dbBacked"] = True
    dataset["traceRun"]["traceScope"] = trace_scope
    dataset["traceRun"]["requestSignature"] = request_signature
    return dataset


def trace_dataset_has_required_fragments(dataset: dict[str, Any]) -> bool:
    if {"traceRegistry", "target", "nativeTrace"}.issubset(dataset):
        return True
    required = {
        "traceRegistry",
        "target",
        "nativeView",
        "systemViews",
        "canonicalSemanticViews",
        "semanticCoverage",
        "sourceFamilies",
    }
    return all(key in dataset for key in required)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Unity Trace Bundle Generator - Extract and analyze Unity objects"
    )
    
    # Target specification (from registry or custom)
    parser.add_argument("--target", 
                        help="Explicit DB trace scope / target scope (e.g., token-shop-atu3-cells-effect)")
    parser.add_argument("--query", action="append", default=[],
                        help="Query term to search for (can specify multiple)")
    parser.add_argument("--anchor", action="append", default=[],
                        help="Anchor to trace (class, method, string, path id - can specify multiple)")
    parser.add_argument("--best-gap", action="store_true",
                        help="Choose the best current blocked target from DB-backed materialized trace state and run it")
    
    # Family specification for custom targets
    parser.add_argument("--family",
                        help="Trace family shortcut when you want the family default target or family-scoped query resolution")
    parser.add_argument("--extended-search",
                        type=int,
                        choices=[0, 1, 2],
                        default=0,
                        help="Widen source search beyond the selected target: 0 target-only, 1 same-family sibling targets, 2 all trace families")
    parser.add_argument("--depth-search",
                        type=int,
                        choices=[0, 1, 2],
                        default=None,
                        help="Follow recovered strong terms outward for 0-2 hops after the bounded target trace; omit to use any target-level default depth")
    
    # Hierarchy level control
    parser.add_argument("--level",
                        choices=["raw", "structured", "both"],
                        default="both",
                        help="Output level: raw (extracted), structured (analyzed), both (combined)")
    
    # Output control
    parser.add_argument("--json-out", type=Path, default=JSON_OUT,
                        help="Output JSON path")
    parser.add_argument("--md-out", type=Path, default=MD_OUT,
                        help="Output markdown path")
    parser.add_argument("--export", action="store_true",
                        help="Write derived trace-run JSON/Markdown exports to disk")
    
    # Pipeline control
    parser.add_argument("--max-steps", type=int, default=5,
                        help="Maximum analysis steps in chain")
    parser.add_argument("--chain", action="append", default=[],
                        help="Additional extractor scripts to run in sequence")
    parser.add_argument("--continue-on-error", action="store_true",
                        help="Continue pipeline even if a step fails")
    
    # Output behavior
    parser.add_argument("--force", action="store_true",
                        help="Force regeneration even if output exists")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from previous output if available")
    
    # Anchor kind specification
    parser.add_argument("--anchor-kind",
                        choices=["class", "method", "string", "path id", "prefab"],
                        help="Kind of anchor being traced")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print the resolved plan and exit without running the trace")
    parser.add_argument("--native-timeout", type=int, default=1800,
                        help="Repo-side native/process-project timeout in seconds; use 0 to disable the wrapper timeout")
    parser.add_argument("--repeat", type=int, default=1,
                        help="When used with --best-gap and no explicit target/query/family, rerank and run again this many times")
    parser.add_argument("--profile-timing", action="store_true",
                        help="Print end-to-end trace timing buckets for performance profiling")

    global ACTIVE_TRACE_PROFILER
    args = parser.parse_args()
    cli_profiler = TraceRunProfiler(enabled=bool(args.profile_timing or args.best_gap))
    ACTIVE_TRACE_PROFILER = cli_profiler
    with cli_profiler.phase("Catalog load", "catalogLoad"):
        registry = load_request_catalog()

    auto_best_gap_mode = bool(args.best_gap and not args.target and not args.family and not args.query and not args.anchor)

    try:
        # Validate arguments
        if not args.best_gap and not args.target and not args.family and not args.query and not args.anchor:
            parser.error("pass --target, --family, or at least one --query/--anchor")
        if args.repeat < 1:
            parser.error("--repeat must be at least 1")
        if args.dry_run:
            dry_run_args = argparse.Namespace(**vars(args))
            best_gap_plan: dict[str, Any] | None = None
            if auto_best_gap_mode:
                with cli_profiler.phase("DB reads / best-gap selection", "phase.bestGapSelection"):
                    best_gap_plan = choose_best_gap_plan(registry)
                dry_run_args.anchor = list(best_gap_plan.get("selectedAnchors") or best_gap_plan.get("anchors") or [])
                dry_run_args.best_gap_plan = best_gap_plan
                _print_best_gap_plan(best_gap_plan)
            with cli_profiler.phase("Subject-state / contract materialization", "phase.subjectStateMaterialization"):
                trace_plan = plan_trace_bundle_request(dry_run_args, registry)
            planner_resolution = trace_plan["plannerResolution"]
            print("Dry run only.")
            print(
                "  subject={} {}".format(
                    planner_resolution.get("selectedSubjectKind") or "unknown-subject",
                    planner_resolution.get("selectedSubjectKey") or "unknown",
                )
            )
            print("  executionScope={}".format(trace_plan["executionTraceScope"]))
            print("  family={}".format(trace_plan["selectedFamilyId"]))
            print("  selectionMode={}".format(planner_resolution["selectionMode"]))
            print("  anchors={}".format(", ".join(planner_resolution["expandedAnchors"]) or "none"))
            knowledge_plan = dict(trace_plan.get("knowledgePlan") or {})
            if knowledge_plan:
                next_seam = dict(knowledge_plan.get("nextSeam") or {})
                knowledge = dict(knowledge_plan.get("knowledge") or {})
                print("  traceDirective={}".format(knowledge_plan.get("mode") or "run-seam-trace"))
                print("  clearedEdges={}".format(", ".join(knowledge.get("clearedEdgeTypes") or []) or "none"))
                print("  blockedEdges={}".format(", ".join(knowledge.get("blockedEdgeTypes") or []) or "none"))
                print("  nextSeam={}".format(next_seam.get("id") or "none"))
                acquisition_plan = dict(knowledge_plan.get("acquisitionPlan") or knowledge.get("acquisitionPlan") or {})
                if acquisition_plan:
                    print("  acquisitionTerms={}".format(", ".join(acquisition_plan.get("requestedTerms") or []) or "none"))
                    if acquisition_plan.get("subjectId") or acquisition_plan.get("selectedSeamId"):
                        print(
                            "  acquisitionSubject={} seam={} scope={} routine={}".format(
                                acquisition_plan.get("subjectId") or "unknown",
                                acquisition_plan.get("selectedSeamId") or "none",
                                acquisition_plan.get("selectedScope") or "none",
                                acquisition_plan.get("selectedRoutine") or "none",
                            )
                        )
                    if acquisition_plan.get("selectedAnchors"):
                        print("  acquisitionAnchors={}".format(", ".join(acquisition_plan.get("selectedAnchors") or []) or "none"))
                    if str(acquisition_plan.get("coverageMode") or "").strip():
                        relation_probe = dict(acquisition_plan.get("selectedRelationProbe") or {})
                        print(
                            "  acquisitionCoverage mode={} relationScope={} requiredSeams={}".format(
                                acquisition_plan.get("coverageMode") or "term-shaped",
                                relation_probe.get("traceScope") or "none",
                                ", ".join(relation_probe.get("requiredCoverageSeamIds") or []) or "none",
                            )
                        )
                    for index, step in enumerate(list(acquisition_plan.get("steps") or []), start=1):
                        print(
                            "  acquisitionStep{}={} seam={} routine={} anchors={} terms={} why={}".format(
                                index,
                                step.get("traceScope") or "unknown",
                                step.get("seamId") or "none",
                                step.get("executionRoutineId") or step.get("selectedRoutine") or "none",
                                ", ".join(step.get("anchors") or []) or "none",
                                ", ".join(step.get("expectedTerms") or []) or "none",
                                "; ".join(step.get("whyChosen") or []) or "none",
                            )
                        )
                    for term_diagnostic in [dict(item) for item in (acquisition_plan.get("termDiagnostics") or []) if isinstance(item, dict)]:
                        if str(term_diagnostic.get("status") or "").strip() == "planned":
                            continue
                        recommended_next = dict(term_diagnostic.get("recommendedNext") or {})
                        print(
                            "  acquisitionTermStatus {}={} scope={} next={}".format(
                                term_diagnostic.get("term") or "unknown",
                                term_diagnostic.get("status") or "unknown",
                                term_diagnostic.get("selectedTraceScope") or "none",
                                "{}@{}".format(
                                    recommended_next.get("term") or "none",
                                    recommended_next.get("traceScope") or "none",
                                ),
                            )
                        )
            if best_gap_plan:
                print("  blocked={}".format(", ".join(best_gap_plan["blockedEdgeTypes"]) or "none"))
            if cli_profiler.enabled:
                timing_report = cli_profiler.report_payload()
                print("Trace timing (ms):")
                for bucket, elapsed_ms in sorted(
                    timing_report.get("bucketsMs", {}).items(),
                    key=lambda item: item[1],
                    reverse=True,
                ):
                    count = timing_report.get("bucketCounts", {}).get(bucket, 0)
                    print(f"  {bucket}={elapsed_ms:.3f} ({count} span{'s' if count != 1 else ''})")
                print(f"  totalRunMs={timing_report.get('totalRunMs', 0.0):.3f}")
                if timing_report.get("dominantBucket"):
                    print(f"  dominantBucket={timing_report['dominantBucket']}")
            return
    
        # Determine output level
        if args.level == "raw":
            output_mode = "raw_only"
        elif args.level == "structured":
            output_mode = "structured_only"
        else:
            output_mode = "both"
        
        total_iterations = args.repeat if auto_best_gap_mode else 1
        for iteration in range(1, total_iterations + 1):
            run_args = argparse.Namespace(**vars(args))
            if auto_best_gap_mode:
                with cli_profiler.phase("DB reads / best-gap selection", "phase.bestGapSelection"):
                    best_gap_plan = choose_best_gap_plan(registry)
                run_args.anchor = list(best_gap_plan.get("selectedAnchors") or best_gap_plan.get("anchors") or [])
                run_args.best_gap_plan = best_gap_plan
                _print_best_gap_plan(best_gap_plan)
            dataset = _execute_trace_bundle_run(run_args, registry, output_mode)
            _print_completed_trace_run(dataset, iteration, total_iterations)
            if auto_best_gap_mode and iteration < total_iterations:
                print("Refreshing best-gap selection from DB-backed materialized state before the next run...")
    finally:
        ACTIVE_TRACE_PROFILER = None


if __name__ == "__main__":
    main()
