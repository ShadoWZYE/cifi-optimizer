#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
UNITY_SCRIPTS = ROOT / "scripts" / "unity"
if str(UNITY_SCRIPTS) not in sys.path:
    sys.path.insert(0, str(UNITY_SCRIPTS))

from ghidra_cache_db import GhidraCacheDB  # noqa: E402
from unity_trace_bundle import (  # noqa: E402
    collect_trace_bundle_components,
    load_registry,
    materialize_trace_bundle_dataset,
    persist_trace_bundle_fragments,
    plan_trace_bundle_request,
)


DB_PATH = ROOT / "workbench" / "ghidra-cache" / "ghidra_cache.sqlite3"
JOBS_DIR = ROOT / "workbench" / "ghidra-jobs"
PROJECT_NAME = "cifi-full"
PROJECT_FILE = "libil2cpp.so"


def _get_db() -> GhidraCacheDB:
    return GhidraCacheDB(DB_PATH, JOBS_DIR)


def _build_trace_args(trace_scope: str) -> argparse.Namespace:
    return argparse.Namespace(
        target=trace_scope,
        query=[],
        anchor=[],
        family=None,
        extended_search=0,
        depth_search=None,
        level="structured",
        json_out=None,
        md_out=None,
        export=False,
        max_steps=5,
        chain=[],
        continue_on_error=False,
        force=False,
        resume=False,
        anchor_kind=None,
    )


def _materialize_target_bundle(trace_scope: str) -> dict[str, object]:
    args = _build_trace_args(trace_scope)
    registry = load_registry()
    request = plan_trace_bundle_request(args, registry)
    dataset = collect_trace_bundle_components(args)
    request_signature = str(request["requestSignature"])
    persist_trace_bundle_fragments(dataset, trace_scope, request_signature)
    materialized_payload = materialize_trace_bundle_dataset(dataset, trace_scope, request_signature)
    db = _get_db()
    view = db.find_latest_materialized_target_bundle_view(PROJECT_NAME, PROJECT_FILE, trace_scope)
    if view is None:
        return {
            "traceScope": trace_scope,
            "requestSignature": request_signature,
            "payload": materialized_payload,
            "provenance": {},
            "builtAt": materialized_payload.get("generatedAt"),
            "reducerVersion": "target-bundle-v1",
        }
    return view


def fetch_target_bundle(trace_scope: str, materialize_if_missing: bool) -> dict[str, object]:
    db = _get_db()
    view = db.find_latest_materialized_target_bundle_view(PROJECT_NAME, PROJECT_FILE, trace_scope)
    if view is not None:
        return view
    if not materialize_if_missing:
        raise SystemExit(f"Missing materialized target bundle view for trace scope: {trace_scope}")
    return _materialize_target_bundle(trace_scope)


def store_system_unit(system_id: str, version: str, exported_path: str | None) -> dict[str, object]:
    payload = json.loads(sys.stdin.read())
    provenance = {
        "systemId": system_id,
        "version": version,
        "generatedBy": payload.get("generatedBy"),
        "exportedPath": exported_path,
        "sourceModel": "db-first-system-unit-export",
    }
    db = _get_db()
    db.upsert_materialized_system_unit_view(
        system_id,
        version,
        payload,
        provenance=provenance,
        reducer_version="system-unit-v1",
        exported_path=exported_path,
    )
    return db.find_materialized_system_unit_view(system_id, version) or {
        "systemId": system_id,
        "version": version,
        "payload": payload,
        "provenance": provenance,
    }


def fetch_system_unit(system_id: str, version: str) -> dict[str, object]:
    db = _get_db()
    view = db.find_materialized_system_unit_view(system_id, version)
    if view is None:
        raise SystemExit(f"Missing materialized system unit view: {system_id}@{version}")
    return view


def main() -> None:
    parser = argparse.ArgumentParser(description="DB-backed helper for system-unit materialization.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch_target_parser = subparsers.add_parser("fetch-target-bundle")
    fetch_target_parser.add_argument("--trace-scope", required=True)
    fetch_target_parser.add_argument("--materialize-if-missing", action="store_true")

    store_unit_parser = subparsers.add_parser("store-system-unit")
    store_unit_parser.add_argument("--system-id", required=True)
    store_unit_parser.add_argument("--version", required=True)
    store_unit_parser.add_argument("--exported-path")

    fetch_unit_parser = subparsers.add_parser("fetch-system-unit")
    fetch_unit_parser.add_argument("--system-id", required=True)
    fetch_unit_parser.add_argument("--version", required=True)

    args = parser.parse_args()
    if args.command == "fetch-target-bundle":
        result = fetch_target_bundle(args.trace_scope, args.materialize_if_missing)
    elif args.command == "store-system-unit":
        result = store_system_unit(args.system_id, args.version, args.exported_path)
    elif args.command == "fetch-system-unit":
        result = fetch_system_unit(args.system_id, args.version)
    else:
        raise SystemExit(f"Unsupported command: {args.command}")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
