#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from trace_execution_core_v2 import NativeGraphExtensionExecutionCoreV2


ROOT = Path(__file__).resolve().parents[2]
V2_TRACE_EXPORTS_DIR = ROOT / "workbench" / "trace-exports-v2"


def _tail_lines(text: str, *, limit: int = 80) -> list[str]:
    lines = [line for line in str(text or "").splitlines()]
    if len(lines) <= limit:
        return lines
    return lines[-limit:]


def load_exported_trace_run(json_path: Path) -> dict[str, Any]:
    try:
        return json.loads(json_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def allocate_v2_export_paths(attempt_id: str) -> tuple[Path, Path]:
    V2_TRACE_EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    base = V2_TRACE_EXPORTS_DIR / str(attempt_id)
    return base.with_suffix(".json"), base.with_suffix(".md")


@dataclass(slots=True)
class BackendExecutionResult:
    backend_id: str
    execution_core_id: str
    command: list[str]
    return_code: int
    stdout_tail: list[str]
    stderr_tail: list[str]
    json_out: str
    md_out: str
    runtime_dataset: dict[str, Any]
    exported_dataset: dict[str, Any]
    exported_request_signature: str
    exported_trace_scope: str
    exported_mode: str

class NativeTraceBackendV2:
    backend_id = "native-trace-backend-v2"

    def build_command(
        self,
        execution: dict[str, Any],
        *,
        json_out: Path | None = None,
        md_out: Path | None = None,
        level: str,
        native_timeout: int,
        force: bool,
        profile_timing: bool,
    ) -> list[str]:
        command = [
            "v2-native-execution",
            "--scope",
            str(execution.get("traceScope") or "").strip(),
            "--routine",
            str(execution.get("executionRoutineId") or "").strip(),
            "--relation",
            str(execution.get("relationKind") or "").strip(),
            "--timeout",
            str(int(native_timeout)),
            "--level",
            str(level or "structured"),
        ]
        for anchor in execution.get("selectedAnchors") or []:
            anchor_value = str(anchor or "").strip()
            if anchor_value:
                command.extend(["--anchor", anchor_value])
        if force:
            command.append("--force")
        if profile_timing:
            command.append("--profile-timing")
        if json_out:
            command.extend(["--json-out", str(json_out)])
        if md_out:
            command.extend(["--md-out", str(md_out)])
        return command

    def run(
        self,
        execution: dict[str, Any],
        *,
        attempt_id: str,
        level: str,
        native_timeout: int,
        force: bool,
        profile_timing: bool,
    ) -> BackendExecutionResult:
        json_out, md_out = allocate_v2_export_paths(attempt_id)
        command = self.build_command(
            execution,
            json_out=json_out,
            md_out=md_out,
            level=level,
            native_timeout=native_timeout,
            force=force,
            profile_timing=profile_timing,
        )
        native_core = NativeGraphExtensionExecutionCoreV2()
        core_result = native_core.run(
            execution,
            json_out=json_out,
            md_out=md_out,
            level=level,
            native_timeout=native_timeout,
            force=force,
            profile_timing=profile_timing,
        )
        exported_dataset = load_exported_trace_run(json_out)
        exported_trace_run = dict(exported_dataset.get("traceRun") or {})
        return_code = int(core_result.return_code if core_result.handled else 1)
        stderr_text = str(core_result.stderr_text or "")
        if not core_result.handled and not stderr_text:
            stderr_text = "unsupported execution for native V2 backend"
        return BackendExecutionResult(
            backend_id=self.backend_id,
            execution_core_id=str(core_result.core_id or ""),
            command=command,
            return_code=return_code,
            stdout_tail=_tail_lines(core_result.stdout_text),
            stderr_tail=_tail_lines(stderr_text),
            json_out=str(json_out),
            md_out=str(md_out),
            runtime_dataset=dict(core_result.runtime_dataset or {}),
            exported_dataset=exported_dataset,
            exported_request_signature=str(exported_trace_run.get("requestSignature") or "").strip(),
            exported_trace_scope=str(exported_trace_run.get("traceScope") or "").strip(),
            exported_mode=str(exported_trace_run.get("mode") or "").strip(),
        )
