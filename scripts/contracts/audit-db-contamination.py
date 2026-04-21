#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "workbench" / "ghidra-cache" / "ghidra_cache.sqlite3"
DATASET_REF_RE = re.compile(r"data/[A-Za-z0-9._/-]+\.json")


def classify_ref(path: str) -> str:
    if any(marker in path for marker in ("-probe", "_probe", "extract-report")):
        return "SUSPICIOUS / stale risk"
    if any(
        marker in path
        for marker in (
            "savedata-import-boundary",
            "row-remap-boundary",
            "range-boundary",
            "late-atu-boundary",
            "market-member-boundary",
        )
    ):
        return "LEGACY BUT ACCEPTABLE"
    if ".v1.json" in path and any(
        token in path
        for token in ("save-boundary", "save-owner-candidates", "trace-support")
    ):
        return "SUSPICIOUS / stale risk"
    return "SAFE / current canonical"


def collect_refs(text: str) -> list[str]:
    return sorted(set(DATASET_REF_RE.findall(text or "")))


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    summary: dict[str, Any] = {
        "db": str(DB_PATH.relative_to(ROOT)),
        "auditedWritePaths": [
            "trace_extractors.py -> record_extraction_job / upsert_custom_evidence_rows",
            "trace_extractors.py -> upsert_semantic_scope",
            "unity_trace_bundle.py -> upsert_trace_dataset",
            "ghidra_cache_db.py -> rebuild_trace_views",
            "system_unit_db.py -> upsert_materialized_system_unit_view",
        ],
        "tableSignals": {},
        "traceScopeRefs": {},
    }

    table_specs = {
        "evidence": ["script_name", "producer_version", "is_valid", "invalidated_at"],
        "trace_fragments": ["script_name", "producer_version", "is_valid", "invalidated_at"],
        "canonical_semantic_fragments": ["reducer_version", "built_at"],
        "materialized_target_bundle_views": ["reducer_version", "built_at"],
        "materialized_system_unit_views": ["reducer_version", "built_at"],
    }
    for table, columns in table_specs.items():
        summary["tableSignals"][table] = {
            "columns": columns,
            "rowCount": conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0],
        }

    scope_refs: dict[str, Counter[str]] = defaultdict(Counter)
    for row in conn.execute(
        "SELECT trace_scope, payload_json FROM trace_fragments WHERE is_valid = 1 AND invalidated_at IS NULL"
    ):
        refs = collect_refs(row["payload_json"] or "")
        for ref in refs:
            scope_refs[str(row["trace_scope"])][ref] += 1

    for scope, refs in sorted(scope_refs.items()):
        if not refs:
            continue
        summary["traceScopeRefs"][scope] = [
            {
                "path": path,
                "count": count,
                "classification": classify_ref(path),
            }
            for path, count in refs.most_common()
        ]

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
