#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

from ghidra_cache_db_v2 import DEFAULT_DB_PATH, TraceGraphDBV2
from trace_backend_v2 import NativeTraceBackendV2, allocate_v2_export_paths, load_exported_trace_run


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2)


def _emit_progress(message: str) -> None:
    sys.stderr.write(f"[progress] {message}\n")
    sys.stderr.flush()


def _emit_state(key: str, value: Any) -> None:
    text = str(value or "").strip()
    if not text:
        return
    sys.stderr.write(f"{key}={text}\n")
    sys.stderr.flush()


def _emit_iteration_progress(current: int, total: int) -> None:
    if current < 0 or total < 1:
        return
    _emit_state("iteration", f"{current}/{total}")
    _emit_progress(f"Starting iteration {current}/{total}")


def _format_short_list(values: Any, limit: int = 4) -> str:
    items = [str(value or "").strip() for value in (values or []) if str(value or "").strip()]
    if not items:
        return "none"
    if len(items) <= limit:
        return ",".join(items)
    return f"{','.join(items[:limit])} (+{len(items) - limit} more)"


def _emit_obligation_progress(obligation: dict[str, Any] | None, execution: dict[str, Any] | None = None) -> None:
    obligation = obligation or {}
    execution = execution or {}
    source_node = str(
        obligation.get("sourceNodeId")
        or execution.get("sourceNodeId")
        or ""
    ).strip()
    target_node = str(
        obligation.get("targetNodeId")
        or execution.get("targetNodeId")
        or ""
    ).strip()
    obligation_kind = str(
        obligation.get("obligationKind")
        or execution.get("obligationKind")
        or ""
    ).strip()
    relation_kind = str(
        obligation.get("relationKind")
        or execution.get("relationKind")
        or ""
    ).strip()
    trace_scope = str(
        obligation.get("preferredTraceScope")
        or execution.get("traceScope")
        or ""
    ).strip()
    payload = obligation.get("payload") if isinstance(obligation.get("payload"), dict) else {}
    goal = str(payload.get("goal") or "").strip()
    if source_node or target_node:
        _emit_state("subject", f"{source_node or 'unknown'} -> {target_node or 'unknown'}")
    if obligation_kind:
        label = obligation_kind
        bridge_relation = str(payload.get("bridgeRelationKind") or payload.get("knownRelationKind") or "").strip()
        if bridge_relation:
            label = f"{label} via {bridge_relation}"
        _emit_state("subjectLabel", label)
        _emit_state("family", obligation_kind)
    if relation_kind:
        _emit_state("seam", relation_kind)
    if trace_scope:
        _emit_state("executionScope", trace_scope)
    if target_node:
        _emit_state("unresolvedAnchor", target_node)
    blocked = str(payload.get("bridgeRelationKind") or payload.get("knownRelationKind") or "").strip()
    if blocked:
        _emit_state("blockedEdges", blocked)
    if goal:
        _emit_progress(goal)


def _emit_run_result_progress(run_result: dict[str, Any]) -> None:
    execution = run_result.get("execution") if isinstance(run_result.get("execution"), dict) else {}
    applied = run_result.get("applied") if isinstance(run_result.get("applied"), dict) else {}
    attempted = _format_short_list(execution.get("requestedTerms") or execution.get("selectedAnchors") or [])
    traced = _format_short_list(execution.get("selectedAnchors") or execution.get("requestedTerms") or [])
    recovered_items: list[str] = []
    graph_obs = int(applied.get("importedGraphObservationCount") or 0)
    ir_obs = int(applied.get("importedIrObservationCount") or 0)
    if graph_obs > 0:
        recovered_items.append(f"graphObs:{graph_obs}")
    if ir_obs > 0:
        recovered_items.append(f"irObs:{ir_obs}")
    recovered = ",".join(recovered_items) if recovered_items else "none"
    strengthened = int(applied.get("strengthenedEdgeCount") or 0)
    new_edges = f"strengthened:{strengthened}" if strengthened > 0 else "none"
    outcome = str(applied.get("outcome") or "").strip().lower()
    net_progress = "yes" if outcome == "strengthened" else "no"
    _emit_state("verdict", str(applied.get("outcome") or "unknown"))
    sys.stderr.write(
        "recovered={recovered} traced={traced} attempted={attempted} missing=none newEdges={new_edges} netProgress={net_progress}\n".format(
            recovered=recovered,
            traced=traced,
            attempted=attempted,
            new_edges=new_edges,
            net_progress=net_progress,
        )
    )
    sys.stderr.flush()


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Trace planner V2 entrypoint")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to the SQLite DB")
    parser.add_argument("--limit", type=int, default=10, help="Result limit")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("init-v2-db", help="Initialize the V2 DB schema")
    subparsers.add_parser("derive-v2-obligations", help="Derive V2 obligations from graph + execution memory")
    record_nonclosing = subparsers.add_parser("record-v2-nonclosing", help="Record a V2 nonclosing result into DB-owned pair/path memory")
    record_nonclosing.add_argument("obligation_id", help="Target obligation id")
    record_nonclosing.add_argument("--request-signature", default="", help="Optional request signature")
    subparsers.add_parser("stats-v2", help="Print V2 table counts")
    attempts = subparsers.add_parser("attempts-v2", help="List recent V2 execution attempts")
    attempts.add_argument("--limit", type=int, default=20, help="Result limit")
    execute_best_gap = subparsers.add_parser("execute-best-gap-v2", help="Select the top V2 obligation and build/persist an execution attempt")
    execute_best_gap.add_argument("--dry-run", action="store_true", help="Preview only without recording an execution attempt")
    run_best_gap = subparsers.add_parser("run-best-gap-v2", help="Select, execute through the native V2 backend, and reconcile one V2 obligation")
    run_best_gap.add_argument("--dry-run", action="store_true", help="Preview the selected V2 obligation and backend command without running it")
    run_best_gap.add_argument("--repeat", type=int, default=1, help="Repeat the V2 select/execute/reconcile loop this many times")
    run_best_gap.add_argument("--native-timeout", type=int, default=20, help="Native backend timeout in seconds")
    run_best_gap.add_argument("--level", choices=["raw", "structured", "both"], default="structured", help="Native backend output level")
    run_best_gap.add_argument("--force", action="store_true", help="Pass through --force to the V2 execution backend")
    run_best_gap.add_argument("--profile-timing", action="store_true", help="Pass through --profile-timing to the V2 execution backend")
    apply_result = subparsers.add_parser("apply-result-v2", help="Apply a V2 backend dataset into a V2 execution attempt")
    apply_result.add_argument("attempt_id", help="V2 execution attempt id")
    apply_result.add_argument("--request-signature", default="", help="Optional request signature override")
    apply_export_result = subparsers.add_parser("apply-export-result-v2", help="Apply an exported V2 trace JSON artifact directly into a V2 execution attempt")
    apply_export_result.add_argument("attempt_id", help="V2 execution attempt id")
    apply_export_result.add_argument("json_path", help="Path to an exported trace JSON artifact")
    apply_export_result.add_argument("--request-signature", default="", help="Optional request signature override")

    best_gap = subparsers.add_parser("best-gap-v2", help="Inspect the current highest-priority V2 obligations")
    best_gap.add_argument("--dry-run", action="store_true", help="Preview only")
    return parser


def _print_best_gap_v2(db: TraceGraphDBV2, limit: int, dry_run: bool) -> int:
    db.derive_obligations_from_v2_graph()
    obligations = db.list_open_obligations(limit=limit)
    if not obligations:
        print("No V2 graph obligations are currently available.")
        print("Next expected implementation slice: path-shaped obligation derivation over the V2 IR + evidence graph.")
        return 0
    current = obligations[0]
    print(
        "Best V2 obligation: {} [{}]".format(
            current.get("obligationId") or "unknown",
            current.get("obligationKind") or "unknown",
        )
    )
    print(
        "  relation={} source={} target={} preferredScope={}".format(
            current.get("relationKind") or "unknown",
            current.get("sourceNodeId") or "unknown",
            current.get("targetNodeId") or "unknown",
            current.get("preferredTraceScope") or "none",
        )
    )
    print(
        "  priority={} supportCount={} status={}".format(
            current.get("priority") or 0,
            current.get("supportCount") or 0,
            current.get("obligationStatus") or "unknown",
        )
    )
    payload = current.get("payload") or {}
    bridge_path = payload.get("bridgePath")
    if isinstance(bridge_path, list) and bridge_path:
        print(
            "  bridgePath={} bridgeKind={}".format(
                " -> ".join(str(part or "") for part in bridge_path),
                payload.get("bridgeKind") or "direct",
            )
        )
    candidate_term = payload.get("candidateTerm")
    if candidate_term:
        print(
            "  candidateTerm={} candidateSources={}".format(
                candidate_term,
                ",".join(str(source) for source in (payload.get("candidateSources") or [])) or "none",
            )
        )
    if dry_run:
        print("Dry run only.")
    return 0


def _run_best_gap_v2_once(
    db: TraceGraphDBV2,
    *,
    level: str,
    native_timeout: int,
    force: bool,
    profile_timing: bool,
    refresh_obligations: bool = True,
) -> dict[str, Any]:
    if refresh_obligations:
        _emit_progress("Refreshing V2 graph obligations")
        db.derive_obligations_from_v2_graph()
    obligation = db.select_best_obligation()
    if not obligation:
        _emit_progress("No V2 obligations available")
        return {"message": "No V2 obligations available.", "needsObligationRefresh": False}
    execution = db.build_execution_request_for_obligation(str(obligation.get("obligationId") or ""))
    if not execution:
        _emit_obligation_progress(obligation, None)
        _emit_progress("Unable to build a V2 execution request")
        return {"obligation": obligation, "message": "Unable to build a V2 execution request.", "needsObligationRefresh": False}
    _emit_obligation_progress(obligation, execution)
    _emit_progress("Recording V2 execution attempt")
    attempt = db.record_execution_attempt(execution, attempt_status="planned")
    attempt_id = str(attempt.get("attemptId") or "").strip()
    if not attempt_id:
        _emit_progress("Failed to record V2 execution attempt")
        return {
            "obligation": obligation,
            "execution": execution,
            "attempt": attempt,
            "backendCommand": [],
            "message": "Failed to record V2 execution attempt.",
            "needsObligationRefresh": False,
        }
    backend = NativeTraceBackendV2()
    json_out, md_out = allocate_v2_export_paths(attempt_id)
    backend_command = backend.build_command(
        execution,
        json_out=json_out,
        md_out=md_out,
        level=str(level or "structured"),
        native_timeout=int(native_timeout),
        force=bool(force),
        profile_timing=bool(profile_timing),
    )
    db.update_execution_attempt(
        attempt_id,
        attempt_status="running",
        payload_patch={
            "backendId": backend.backend_id,
            "executionCoreId": "",
            "executionBackend": {
                "backendId": backend.backend_id,
                "executionCoreId": "",
                "command": backend_command,
                "jsonOut": str(json_out),
                "mdOut": str(md_out),
            },
            "backendCommand": backend_command,
            "backendJsonOut": str(json_out),
            "backendMdOut": str(md_out),
        },
    )
    db.record_trace_event(
        source_run_id=attempt_id,
        source_kind="v2-backend-dispatch",
        trace_scope=str(execution.get("traceScope") or ""),
        request_signature=str(execution.get("requestSignature") or ""),
        payload={
            "obligationId": str(execution.get("obligationId") or ""),
            "selectedAnchors": list(execution.get("selectedAnchors") or []),
            "requestedTerms": list(execution.get("requestedTerms") or []),
            "executionCoreId": "",
            "backendId": backend.backend_id,
            "backendCommand": backend_command,
        },
        provenance={"source": "unity_trace_bundle_v2.run-best-gap-v2"},
    )
    _emit_progress(f"Dispatching V2 backend {backend.backend_id}")
    backend_result = backend.run(
        execution,
        attempt_id=attempt_id,
        level=str(level or "structured"),
        native_timeout=int(native_timeout),
        force=bool(force),
        profile_timing=bool(profile_timing),
    )
    _emit_progress(
        f"Backend completed via {str(backend_result.execution_core_id or backend.backend_id)} (rc={int(backend_result.return_code)})"
    )
    db.update_execution_attempt(
        attempt_id,
        attempt_status="backend-completed" if backend_result.return_code == 0 else "backend-error",
        payload_patch={
            "executionCoreId": str(backend_result.execution_core_id or ""),
            "executionBackend": {
                "backendId": backend_result.backend_id,
                "executionCoreId": str(backend_result.execution_core_id or ""),
                "command": list(backend_result.command),
                "jsonOut": str(backend_result.json_out),
                "mdOut": str(backend_result.md_out),
            },
            "executionResult": {
                "returnCode": int(backend_result.return_code),
                "stdoutTail": list(backend_result.stdout_tail),
                "stderrTail": list(backend_result.stderr_tail),
            },
            "backendCommand": list(backend_result.command),
            "backendRun": {
                "returnCode": int(backend_result.return_code),
                "stdoutTail": list(backend_result.stdout_tail),
                "stderrTail": list(backend_result.stderr_tail),
            },
        },
    )
    db.record_trace_event(
        source_run_id=attempt_id,
        source_kind="v2-backend-result",
        trace_scope=str(execution.get("traceScope") or ""),
        request_signature=str(execution.get("requestSignature") or ""),
        payload={
            "backendId": backend_result.backend_id,
            "executionCoreId": str(backend_result.execution_core_id or ""),
            "returnCode": int(backend_result.return_code),
            "stdoutTail": list(backend_result.stdout_tail),
            "stderrTail": list(backend_result.stderr_tail),
        },
        provenance={"source": "unity_trace_bundle_v2.run-best-gap-v2"},
    )
    runtime_dataset = dict(backend_result.runtime_dataset or {})
    exported_dataset = dict(backend_result.exported_dataset or {})
    reconcile_dataset = dict(runtime_dataset or exported_dataset)
    exported_trace_run = dict(reconcile_dataset.get("traceRun") or exported_dataset.get("traceRun") or {})
    exported_request_signature = str(backend_result.exported_request_signature or "").strip()
    if reconcile_dataset:
        db.record_trace_event(
            source_run_id=attempt_id,
            source_kind="v2-backend-dataset",
            trace_scope=str(execution.get("traceScope") or ""),
            request_signature=exported_request_signature or str(execution.get("requestSignature") or ""),
            payload={
                "traceRun": exported_trace_run,
                "progressSummary": dict(reconcile_dataset.get("progressSummary") or {}),
                "exactEvidenceSummary": dict(reconcile_dataset.get("exactEvidenceSummary") or {}),
            },
            provenance={
                "source": "unity_trace_bundle_v2.run-best-gap-v2",
                "backendId": backend_result.backend_id,
                "executionCoreId": str(backend_result.execution_core_id or ""),
                "jsonOut": str(backend_result.json_out),
                "runtimeDataset": bool(runtime_dataset),
            },
        )
        db.update_execution_attempt(
            attempt_id,
            payload_patch={
                "backendExport": {
                    "jsonOut": str(backend_result.json_out),
                    "mdOut": str(backend_result.md_out),
                    "requestSignature": exported_request_signature,
                    "traceScope": str(backend_result.exported_trace_scope or ""),
                    "mode": str(backend_result.exported_mode or ""),
                    "runtimeDataset": bool(runtime_dataset),
                    "executionCoreId": str(backend_result.execution_core_id or ""),
                },
                "executionExport": {
                    "jsonOut": str(backend_result.json_out),
                    "mdOut": str(backend_result.md_out),
                    "requestSignature": exported_request_signature,
                    "traceScope": str(backend_result.exported_trace_scope or ""),
                    "mode": str(backend_result.exported_mode or ""),
                    "runtimeDataset": bool(runtime_dataset),
                    "executionCoreId": str(backend_result.execution_core_id or ""),
                },
            },
        )
    applied = db.apply_execution_result_from_dataset(
        attempt_id,
        request_signature=exported_request_signature,
        exported_dataset=reconcile_dataset,
        dataset_source="trace-backend-dataset",
    )
    _emit_progress("Applied V2 execution result")
    _emit_run_result_progress({"execution": execution, "applied": applied})
    needs_obligation_refresh = bool(
        int(applied.get("strengthenedEdgeCount") or 0) > 0
        or int(applied.get("importedObservationCount") or 0) > 0
    )
    return {
        "obligation": obligation,
        "execution": execution,
        "attempt": attempt,
        "executionBackend": {
            "backendId": backend_result.backend_id,
            "executionCoreId": str(backend_result.execution_core_id or ""),
            "command": list(backend_result.command),
            "jsonOut": str(backend_result.json_out),
            "mdOut": str(backend_result.md_out),
        },
        "backendCommand": list(backend_result.command),
        "backendRun": {
            "returnCode": int(backend_result.return_code),
            "stdoutTail": list(backend_result.stdout_tail),
            "stderrTail": list(backend_result.stderr_tail),
        },
        "backendExport": {
            "jsonOut": str(backend_result.json_out),
            "mdOut": str(backend_result.md_out),
            "requestSignature": exported_request_signature,
            "traceScope": str(backend_result.exported_trace_scope or ""),
            "mode": str(backend_result.exported_mode or ""),
            "executionCoreId": str(backend_result.execution_core_id or ""),
        },
        "applied": applied,
        "needsObligationRefresh": needs_obligation_refresh,
    }


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    db = TraceGraphDBV2(Path(args.db))

    if args.command == "init-v2-db":
        db.ensure_schema()
        print(f"Initialized V2 DB schema at {db.db_path}")
        return
    if args.command == "derive-v2-obligations":
        print(_json_dumps({"dbPath": str(db.db_path), "derived": db.derive_obligations_from_v2_graph()}))
        return
    if args.command == "record-v2-nonclosing":
        print(
            _json_dumps(
                {
                    "dbPath": str(db.db_path),
                    "recorded": db.record_nonclosing_obligation(
                        str(args.obligation_id),
                        str(args.request_signature or ""),
                    ),
                }
            )
        )
        return
    if args.command == "stats-v2":
        print(_json_dumps({"dbPath": str(db.db_path), "stats": db.stats()}))
        return
    if args.command == "attempts-v2":
        print(_json_dumps({"dbPath": str(db.db_path), "attempts": db.list_recent_execution_attempts(limit=int(args.limit))}))
        return
    if args.command == "execute-best-gap-v2":
        _emit_progress("Refreshing V2 graph obligations")
        db.derive_obligations_from_v2_graph()
        obligation_counts = db.obligation_status_counts()
        obligation = db.select_best_obligation()
        if not obligation:
            _emit_progress("No V2 obligations available")
            print(
                _json_dumps(
                    {
                        "dbPath": str(db.db_path),
                        "execution": {},
                        "obligationCounts": obligation_counts,
                        "message": "No V2 obligations available.",
                    }
                )
            )
            return
        execution = db.build_execution_request_for_obligation(str(obligation.get("obligationId") or ""))
        _emit_obligation_progress(obligation, execution)
        attempt = {}
        if execution and not bool(args.dry_run):
            _emit_progress("Recording V2 execution attempt")
            attempt = db.record_execution_attempt(execution, attempt_status="planned")
        print(
            _json_dumps(
                {
                    "dbPath": str(db.db_path),
                    "obligation": obligation,
                    "execution": execution,
                    "attempt": attempt,
                    "obligationCounts": obligation_counts,
                }
            )
        )
        return
    if args.command == "run-best-gap-v2":
        if int(args.repeat) < 1:
            raise SystemExit("--repeat must be at least 1")
        db.derive_obligations_from_v2_graph()
        obligation_counts = db.obligation_status_counts()
        obligation = db.select_best_obligation()
        if not obligation:
            print(
                _json_dumps(
                    {
                        "dbPath": str(db.db_path),
                        "obligationCounts": obligation_counts,
                        "message": "No V2 obligations available.",
                    }
                )
            )
            return
        execution = db.build_execution_request_for_obligation(str(obligation.get("obligationId") or ""))
        if not execution:
            _emit_obligation_progress(obligation, None)
            _emit_progress("Unable to build a V2 execution request")
            print(_json_dumps({"dbPath": str(db.db_path), "obligation": obligation, "message": "Unable to build a V2 execution request."}))
            return
        backend = NativeTraceBackendV2()
        dry_run_json_out = Path("trace-export-preview.json")
        dry_run_md_out = Path("trace-export-preview.md")
        backend_command = backend.build_command(
            execution,
            json_out=dry_run_json_out,
            md_out=dry_run_md_out,
            level=str(args.level or "structured"),
            native_timeout=int(args.native_timeout),
            force=bool(args.force),
            profile_timing=bool(args.profile_timing),
        )
        if bool(args.dry_run):
            _emit_obligation_progress(obligation, execution)
            _emit_progress("Prepared V2 dry-run execution preview")
            print(
                _json_dumps(
                    {
                        "dbPath": str(db.db_path),
                        "obligation": obligation,
                        "execution": execution,
                        "obligationCounts": obligation_counts,
                        "executionBackend": {
                            "backendId": backend.backend_id,
                            "executionCoreId": "preview",
                            "command": backend_command,
                            "jsonOut": str(dry_run_json_out),
                            "mdOut": str(dry_run_md_out),
                        },
                        "backendCommand": backend_command,
                        "dryRun": True,
                    }
                )
            )
            return
        runs: list[dict[str, Any]] = []
        repeat_total = int(args.repeat)
        needs_obligation_refresh = False
        for iteration_index in range(repeat_total):
            _emit_iteration_progress(iteration_index + 1, repeat_total)
            run_result = _run_best_gap_v2_once(
                db,
                level=str(args.level or "structured"),
                native_timeout=int(args.native_timeout),
                force=bool(args.force),
                profile_timing=bool(args.profile_timing),
                refresh_obligations=bool(needs_obligation_refresh or iteration_index == 0),
            )
            runs.append(run_result)
            needs_obligation_refresh = bool(run_result.get("needsObligationRefresh"))
            if not run_result.get("obligation"):
                break
        next_obligation = {}
        db.derive_obligations_from_v2_graph()
        obligation_counts = db.obligation_status_counts()
        next_obligation = db.select_best_obligation()
        print(
            _json_dumps(
                {
                    "dbPath": str(db.db_path),
                    "repeat": int(args.repeat),
                    "runs": runs,
                    "nextObligation": next_obligation,
                    "obligationCounts": obligation_counts,
                }
            )
        )
        return
    if args.command == "apply-result-v2":
        request_signature = str(args.request_signature or "")
        print(
            _json_dumps(
                {
                    "dbPath": str(db.db_path),
                    "applied": db.apply_execution_result_from_dataset(
                        str(args.attempt_id),
                        request_signature=request_signature,
                        dataset_source="trace-backend-dataset",
                    ),
                }
            )
        )
        return
    if args.command == "apply-export-result-v2":
        exported_dataset = load_exported_trace_run(Path(args.json_path))
        exported_trace_run = dict(exported_dataset.get("traceRun") or {})
        request_signature = str(args.request_signature or exported_trace_run.get("requestSignature") or "")
        print(
            _json_dumps(
                {
                    "dbPath": str(db.db_path),
                    "jsonPath": str(Path(args.json_path)),
                    "applied": db.apply_execution_result_from_dataset(
                        str(args.attempt_id),
                        request_signature=request_signature,
                        exported_dataset=exported_dataset,
                        dataset_source="trace-export-artifact",
                    ),
                }
            )
        )
        return
    if args.command == "best-gap-v2":
        raise SystemExit(_print_best_gap_v2(db, args.limit, bool(args.dry_run)))
    raise SystemExit(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
