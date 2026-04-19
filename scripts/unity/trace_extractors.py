from __future__ import annotations

import json
import re
import subprocess
import sys
from collections.abc import Iterator, Mapping
from pathlib import Path
from typing import Any

from token_shop_parse import (
    TOKEN_SHOP_ABSOLUTE_OFFSET,
    TOKEN_SHOP_FIELD_OFFSET,
    build_numeric_table,
    extract_field_names,
    parse_token_shop,
)

ROOT = Path(__file__).resolve().parents[2]
GHIDRA_PROJECT_DIR = ROOT / "workbench" / "ghidra-projects" / "cifi-full.rep"
GHIDRA_PROJECT_FILE = ROOT / "workbench" / "ghidra-projects" / "cifi-full.gpr"
GHIDRA_WRAPPER = ROOT / "scripts" / "unity" / "ghidra_headless.py"
GHIDRA_JOBS_DIR = ROOT / "workbench" / "ghidra-jobs"
GHIDRA_PROCESS_INDEX = ROOT / "workbench" / "ghidra-cache" / "process_project_index.json"
GHIDRA_NATIVE_GRAPH_INDEX = ROOT / "workbench" / "ghidra-cache" / "native_graph_index.json"
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"
LEVEL0_PATH = ROOT / "workbench" / "unity" / "joined" / "level0"

TRACE_EXTRACTOR_CACHE: dict[str, Any] = {}

TOKEN_SHOP_SHELL_PATTERN = "ATU"


def load_token_shop_extract(force_refresh: bool = False) -> dict[str, Any]:
    cache_key = "token-shop-extract"
    if not force_refresh and cache_key in TRACE_EXTRACTOR_CACHE:
        return TRACE_EXTRACTOR_CACHE[cache_key]

    metadata_blob = METADATA_PATH.read_bytes()
    level_blob = LEVEL0_PATH.read_bytes()
    field_names = extract_field_names(metadata_blob)
    entries = parse_token_shop(level_blob, field_names)
    payload = {
        "source": {
            "metadata": str(METADATA_PATH),
            "level0": str(LEVEL0_PATH),
            "token_shop_absolute_offset": TOKEN_SHOP_ABSOLUTE_OFFSET,
            "token_shop_field_offset": TOKEN_SHOP_FIELD_OFFSET,
        },
        "field_count": len(field_names),
        "fields": entries,
        "numeric_table": build_numeric_table(entries),
        "extractionMode": "direct-runtime",
    }
    TRACE_EXTRACTOR_CACHE[cache_key] = payload
    return payload


def _split_bridge_tokens(value: str) -> list[str]:
    pieces = []
    current = []
    for char in value:
        if char.isalnum():
            current.append(char)
            continue
        if current:
            pieces.append("".join(current))
            current = []
    if current:
        pieces.append("".join(current))
    tokens: list[str] = []
    for piece in pieces:
        part = []
        for index, char in enumerate(piece):
            if index > 0 and char.isupper() and piece[index - 1].islower():
                tokens.append("".join(part).lower())
                part = [char]
            else:
                part.append(char)
        if part:
            tokens.append("".join(part).lower())
    return [token for token in tokens if token]


def _is_token_shop_shell(field_name: str) -> bool:
    return field_name.startswith(TOKEN_SHOP_SHELL_PATTERN) and field_name.endswith("Button")


def _score_token_shop_field_match(term_tokens: set[str], field_name: str) -> int:
    field_tokens = set(_split_bridge_tokens(field_name))
    if not term_tokens or not field_tokens:
        return 0
    overlap = term_tokens & field_tokens
    if not overlap:
        return 0
    score = len(overlap) * 10
    if field_name.lower().startswith("".join(token.capitalize() for token in overlap).lower()):
        score += 8
    if "boost" in overlap:
        score += 6
    if field_name.endswith(("StartCost", "AdditiveCost", "Bonus", "MaxLevel", "Fill")):
        score += 4
    return score


def build_token_shop_native_bridge_plan(anchor_values: list[str]) -> dict[str, Any]:
    token_shop = load_token_shop_extract()
    fields = list(token_shop.get("fields", []))
    normalized_terms = normalize_native_search_terms(anchor_values)
    bridged_terms: list[str] = []
    native_core_terms: list[str] = []
    context_terms: list[str] = []
    matches: list[dict[str, Any]] = []
    seen_terms: set[str] = set()

    def add_term(value: str) -> None:
        lowered = value.lower()
        if lowered in seen_terms:
            return
        seen_terms.add(lowered)
        bridged_terms.append(value)

    def add_native_core(value: str) -> None:
        add_term(value)
        if value not in native_core_terms:
            native_core_terms.append(value)

    def add_context(value: str) -> None:
        add_term(value)
        if value not in context_terms:
            context_terms.append(value)

    for term in normalized_terms:
        add_native_core(term)

    for term in normalized_terms:
        term_tokens = {
            token for token in _split_bridge_tokens(term)
            if token not in {"buy", "get", "set", "button", "overlay", "content"}
        }
        exact_index = next(
            (index for index, entry in enumerate(fields) if entry.get("field") == term),
            None,
        )
        best_index = exact_index
        best_score = 999 if exact_index is not None else 0
        if best_index is None:
            for index, entry in enumerate(fields):
                field_name = str(entry.get("field", ""))
                score = _score_token_shop_field_match(term_tokens, field_name)
                if score > best_score:
                    best_score = score
                    best_index = index
        if best_index is None or best_score <= 0:
            continue

        shell_index = best_index
        if not _is_token_shop_shell(str(fields[shell_index].get("field", ""))):
            for index in range(best_index, min(len(fields), best_index + 8)):
                if _is_token_shop_shell(str(fields[index].get("field", ""))):
                    shell_index = index
                    break
        if not _is_token_shop_shell(str(fields[shell_index].get("field", ""))):
            continue

        shell_entry = fields[shell_index]
        owner_block = [
            str(entry.get("field"))
            for entry in fields[max(0, shell_index - 5):shell_index]
            if entry.get("field")
        ]
        controller_block = [
            str(entry.get("field"))
            for entry in fields[shell_index:min(len(fields), shell_index + 4)]
            if entry.get("field")
        ]
        for value in owner_block:
            add_native_core(value)
        for value in controller_block:
            add_context(value)

        matches.append(
            {
                "requestedTerm": term,
                "matchedField": str(fields[best_index].get("field", "")),
                "matchScore": best_score if exact_index is None else 1000,
                "shellField": str(shell_entry.get("field", "")),
                "shellPathId": shell_entry.get("path_id"),
                "ownerFieldBlock": owner_block,
                "controllerBlock": controller_block,
            }
        )

    return {
        "familyHint": "token-shop",
        "requestedTerms": normalized_terms,
        "bridgedTerms": bridged_terms,
        "nativeCoreTerms": native_core_terms,
        "contextTerms": context_terms,
        "matches": matches,
        "source": {
            "metadata": str(METADATA_PATH),
            "level0": str(LEVEL0_PATH),
        },
    }


def load_trace_document(source_id: str, path: Path) -> Any:
    if source_id == "tokenShopExtract":
        return load_token_shop_extract()
    return json.loads(path.read_text(encoding="utf-8"))


class TraceDocumentCache(Mapping[str, Any]):
    def __init__(self, source_paths: dict[str, Path]):
        self._source_paths = dict(source_paths)
        self._loaded: dict[str, Any] = {}

    def __getitem__(self, source_id: str) -> Any:
        if source_id not in self._source_paths:
            raise KeyError(source_id)
        if source_id not in self._loaded:
            self._loaded[source_id] = load_trace_document(source_id, self._source_paths[source_id])
        return self._loaded[source_id]

    def __iter__(self) -> Iterator[str]:
        return iter(self._source_paths)

    def __len__(self) -> int:
        return len(self._source_paths)

    def preload(self, source_ids: list[str]) -> None:
        for source_id in source_ids:
            if source_id in self._source_paths:
                _ = self[source_id]


def _load_json_file(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _summarize_native_result(
    result_payload: dict[str, Any] | None,
    wanted_terms: list[str],
    family_hint: str | None = None,
) -> dict[str, Any]:
    if not isinstance(result_payload, dict):
        return {
            "termSummaries": [],
            "ownerCandidates": [],
            "reconstructedOwners": [],
            "ownerFamilyCandidates": [],
            "bridgedTerms": [],
            "metadataOnlyTerms": [],
            "unresolvedTerms": [],
        }

    bridges = result_payload.get("termBridges", {})
    ascii_targets = result_payload.get("ascii_targets", {})
    functions = result_payload.get("functions", {})
    fuzzy_functions = result_payload.get("fuzzyFunctions", {})
    reference_functions = result_payload.get("referenceFunctions", {})
    managed_reconstruction = result_payload.get("managedReconstruction", {})
    managed_graph = result_payload.get("managedGraph", {})
    requested_tokens = {
        token
        for term in wanted_terms
        for token in re.split(r"[^A-Za-z0-9]+", term)
        if token
    }

    def _term_overlap_score(value: str) -> int:
        lowered_value = value.lower()
        score = 0
        for term in wanted_terms:
            lowered_term = term.lower()
            if lowered_value == lowered_term:
                score += 100
            elif lowered_value.startswith(lowered_term) or lowered_term.startswith(lowered_value):
                score += 40
            elif lowered_term in lowered_value or lowered_value in lowered_term:
                score += 20
        value_tokens = {
            token.lower()
            for token in re.split(r"[^A-Za-z0-9]+", value)
            if token
        }
        score += len({token.lower() for token in requested_tokens} & value_tokens) * 5
        return score

    def _filter_related_values(values: list[str], minimum_score: int = 5, limit: int = 20) -> list[str]:
        scored = []
        for value in values:
            if not isinstance(value, str) or not value.strip():
                continue
            score = _term_overlap_score(value)
            if score < minimum_score:
                continue
            scored.append((score, value))
        scored.sort(key=lambda item: (-item[0], item[1].lower()))
        output: list[str] = []
        seen: set[str] = set()
        for _, value in scored:
            lowered = value.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            output.append(value)
            if len(output) >= limit:
                break
        return output

    summaries: list[dict[str, Any]] = []
    owner_candidates: list[str] = []
    reconstructed_owners: list[str] = []
    owner_family_candidates: list[str] = []
    bridged_terms: list[str] = []
    metadata_only_terms: list[str] = []
    unresolved_terms: list[str] = []
    wanted_keys = {term.lower() for term in wanted_terms}

    for term in wanted_terms:
        bridge = bridges.get(term, {})
        summary = {
            "term": term,
            "bridgeKind": bridge.get("bridgeKind", "unresolved"),
            "ownerCandidates": _filter_related_values(list(bridge.get("ownerCandidates", [])), minimum_score=1, limit=12),
            "relatedTerms": _filter_related_values(list(bridge.get("relatedTerms", [])), minimum_score=1, limit=12),
            "metadataHitCount": bridge.get("metadataStringHitCount", len(ascii_targets.get(term, []))),
            "directFunctionCount": len(functions.get(term, [])),
            "fuzzyFunctionCount": len(fuzzy_functions.get(term, [])),
            "referenceFunctionCount": len(reference_functions.get(term, [])),
            "note": bridge.get("note"),
        }
        summaries.append(summary)
        for candidate in summary["ownerCandidates"]:
            if candidate not in owner_candidates:
                owner_candidates.append(candidate)
            candidate_parts = [part for part in candidate.replace("+", "|").split("|") if part]
            candidate_keys = {part.lower() for part in candidate_parts}
            overlaps_query = bool(candidate_keys & wanted_keys) or candidate.lower() in wanted_keys
            if not overlaps_query:
                continue
            if (
                candidate not in reconstructed_owners
                and (
                    "|" in candidate
                    or "+" in candidate
                    or (candidate[:1].isupper() and candidate.replace("`", "").replace("_", "").isalnum())
                )
            ):
                reconstructed_owners.append(candidate)
                if "|" in candidate:
                    family_head = candidate.split("|", 1)[0]
                    if family_head and family_head not in owner_family_candidates:
                        owner_family_candidates.append(family_head)
        if summary["bridgeKind"] in {
            "string-xref-bridge",
            "native-symbol-match",
            "token-bridge",
            "metadata-neighborhood",
            "managed-expansion-bridge",
        }:
            bridged_terms.append(term)
        elif summary["bridgeKind"] == "metadata-only":
            metadata_only_terms.append(term)
        else:
            unresolved_terms.append(term)

    scored_owners = []
    filtered_methods = _filter_related_values(list(managed_reconstruction.get("methods", [])), minimum_score=1, limit=40)
    filtered_fields = _filter_related_values(list(managed_reconstruction.get("fields", [])), minimum_score=1, limit=40)
    filtered_raw_values = _filter_related_values(list(managed_reconstruction.get("rawValueTerms", [])), minimum_score=1, limit=40)

    for owner_entry in managed_reconstruction.get("scoredOwners", []):
        current = dict(owner_entry)
        owner_name = str(current.get("owner", ""))
        lowered = owner_name.lower()
        score = int(current.get("score", 0))
        reasons = list(current.get("reasons", []))
        if family_hint:
            family_match = (
                (family_hint.startswith("shard") and "shard" in lowered)
                or (family_hint == "token-shop" and ("token" in lowered or "shop" in lowered or "atu" in lowered))
                or (family_hint.startswith("multiverse-market") and ("multiverse" in lowered or "market" in lowered or "save" in lowered))
            )
            if family_match:
                score += 6
                if "family-hint-match" not in reasons:
                    reasons.append("family-hint-match")
            elif "|" in owner_name and family_hint.startswith("shard"):
                score -= 4
                if "cross-family-noise" not in reasons:
                    reasons.append("cross-family-noise")
        if owner_name.endswith("Data") or owner_name.endswith("Profile"):
            score += 5
            if "container-owner-bias" not in reasons:
                reasons.append("container-owner-bias")
        current["score"] = score
        current["reasons"] = reasons
        current["methods"] = _filter_related_values(list(current.get("methods", [])), minimum_score=1, limit=20)
        current["fields"] = _filter_related_values(list(current.get("fields", [])), minimum_score=1, limit=20)
        current["rawValues"] = _filter_related_values(list(current.get("rawValues", [])), minimum_score=1, limit=20)
        current["relatedTerms"] = _filter_related_values(list(current.get("relatedTerms", [])), minimum_score=1, limit=20)
        scored_owners.append(current)
    scored_owners.sort(key=lambda item: (-int(item.get("score", 0)), str(item.get("owner", "")).lower()))

    return {
        "termSummaries": summaries,
        "ownerCandidates": owner_candidates[:20],
        "reconstructedOwners": reconstructed_owners[:20],
        "ownerFamilyCandidates": owner_family_candidates[:20],
        "reconstructedMethods": filtered_methods,
        "reconstructedFields": filtered_fields,
        "rawValueTerms": filtered_raw_values,
        "ownerToTerms": managed_reconstruction.get("ownerToTerms", {}),
        "scoredOwners": scored_owners[:20],
        "bridgedTerms": bridged_terms,
        "metadataOnlyTerms": metadata_only_terms,
        "unresolvedTerms": unresolved_terms,
        "managedGraph": managed_graph if isinstance(managed_graph, dict) else {},
    }


def _native_result_is_stale(
    result_payload: dict[str, Any] | None,
    wanted_terms: list[str],
) -> bool:
    if not isinstance(result_payload, dict):
        return True
    schema_version = int(result_payload.get("schemaVersion", 0) or 0)
    if schema_version < 6:
        return True
    bridges = result_payload.get("termBridges")
    if not isinstance(bridges, dict):
        return True
    managed_reconstruction = result_payload.get("managedReconstruction")
    if not isinstance(managed_reconstruction, dict):
        return True
    reconstruction_schema = int(managed_reconstruction.get("schemaVersion", 0) or 0)
    if reconstruction_schema < 6:
        return True
    managed_graph = result_payload.get("managedGraph")
    if not isinstance(managed_graph, dict):
        return True
    graph_schema = int(managed_graph.get("schemaVersion", 0) or 0)
    if graph_schema < 6:
        return True
    if not isinstance(result_payload.get("searchExpansions"), dict):
        return True
    if "threshold_candidates" in result_payload:
        return True
    if isinstance(result_payload.get("metadataNeighborhoods"), dict):
        return False
    if isinstance(result_payload.get("ascii_targets"), dict):
        for term in wanted_terms:
            if result_payload["ascii_targets"].get(term):
                bridge = bridges.get(term, {})
                if bridge.get("metadataStringHitCount", 0) or bridge.get("ownerCandidates"):
                    return False
        return True
    return True


def normalize_native_search_terms(anchor_values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in anchor_values:
        trimmed = value.strip()
        if not trimmed:
            continue
        if trimmed.isdigit():
            continue
        if re.fullmatch(r"0x[0-9a-fA-F]+", trimmed):
            continue
        key = trimmed.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(trimmed)
    return sorted(normalized, key=str.lower)


def _term_signature(anchor_values: list[str]) -> str:
    return "\x1f".join(term.lower() for term in normalize_native_search_terms(anchor_values))


def _load_process_index() -> dict[str, Any] | None:
    data = _load_json_file(GHIDRA_PROCESS_INDEX)
    if not isinstance(data, dict):
        return None
    return data


def load_native_graph_index() -> dict[str, Any]:
    data = _load_json_file(GHIDRA_NATIVE_GRAPH_INDEX)
    if not isinstance(data, dict):
        return {"version": 1, "projects": {}}
    if "projects" not in data or not isinstance(data.get("projects"), dict):
        data["projects"] = {}
    return data


def write_native_graph_index(index: dict[str, Any]) -> None:
    payload = dict(index)
    payload.setdefault("version", 1)
    GHIDRA_NATIVE_GRAPH_INDEX.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def get_semantic_scope(
    scope_id: str,
    project: str = "cifi-full",
    project_file: str = "libil2cpp.so",
) -> dict[str, Any] | None:
    index = load_native_graph_index()
    return (
        index.get("projects", {})
        .get(project, {})
        .get(project_file, {})
        .get("semanticScopes", {})
        .get(scope_id)
    )


def upsert_semantic_scope(
    scope_id: str,
    scope_payload: dict[str, Any],
    project: str = "cifi-full",
    project_file: str = "libil2cpp.so",
) -> None:
    index = load_native_graph_index()
    project_bucket = index.setdefault("projects", {}).setdefault(project, {}).setdefault(project_file, {})
    semantic_scopes = project_bucket.setdefault("semanticScopes", {})
    semantic_scopes[scope_id] = scope_payload
    write_native_graph_index(index)


def find_cached_native_trace(anchor_values: list[str], project: str = "cifi-full", family_hint: str | None = None) -> dict[str, Any] | None:
    wanted_terms = normalize_native_search_terms(anchor_values)
    wanted_signature = _term_signature(wanted_terms)
    candidates: list[tuple[str, dict[str, Any], dict[str, Any]]] = []
    index = _load_process_index()

    if index:
        indexed_entries = (
            index.get("jobsByProject", {})
            .get(project, {})
            .get("libil2cpp.so", [])
        )
        for entry in indexed_entries:
            if entry.get("signature") != wanted_signature:
                continue
            job_id = entry.get("job_id")
            if not job_id:
                continue
            job_info = _load_json_file(GHIDRA_JOBS_DIR / str(job_id) / "job.json")
            if not job_info:
                continue
            output_file = Path(str(entry.get("output_file", "")))
            result = _load_json_file(output_file) if output_file else None
            if not result or _native_result_is_stale(result, wanted_terms):
                continue
            candidates.append((str(job_info.get("start_time", "")), job_info, result))

    if not candidates and GHIDRA_JOBS_DIR.exists():
        for job_dir in GHIDRA_JOBS_DIR.iterdir():
            if not job_dir.is_dir():
                continue
            job_info = _load_json_file(job_dir / "job.json")
            if not job_info:
                continue
            if job_info.get("mode") != "process-project":
                continue
            if job_info.get("project_name") != project:
                continue
            if job_info.get("status") != "completed":
                continue
            cached_terms = normalize_native_search_terms(job_info.get("search_strings", []))
            if cached_terms != wanted_terms:
                continue
            output_file = Path(job_info.get("output_file", ""))
            result = _load_json_file(output_file) if output_file else None
            if not result or _native_result_is_stale(result, wanted_terms):
                continue
            candidates.append((str(job_info.get("start_time", "")), job_info, result))

    if not candidates:
        return None

    _, job_info, result = sorted(candidates, key=lambda item: item[0], reverse=True)[0]
    return {
        "available": True,
        "project": project,
        "searchTerms": wanted_terms,
        "returncode": 0,
        "status": job_info.get("status", "completed"),
        "jobId": job_info.get("job_id"),
        "job": job_info,
        "result": result,
        "summary": _summarize_native_result(result, wanted_terms, family_hint),
        "cacheHit": True,
    }


def collect_native_trace(anchor_values: list[str], timeout: int = 120, family_hint: str | None = None) -> dict[str, Any]:
    wanted_terms = normalize_native_search_terms(anchor_values)
    bridge_plan: dict[str, Any] | None = None
    if family_hint == "token-shop":
        bridge_plan = build_token_shop_native_bridge_plan(wanted_terms)
        wanted_terms = normalize_native_search_terms(
            [*wanted_terms, *bridge_plan.get("nativeCoreTerms", [])]
        )
    if not wanted_terms:
        return {
            "available": False,
            "reason": "no-anchors",
            "project": "cifi-full",
            "searchTerms": [],
        }

    if not GHIDRA_PROJECT_DIR.exists() or not GHIDRA_PROJECT_FILE.exists():
        return {
            "available": False,
            "reason": "persistent-project-missing",
            "project": "cifi-full",
            "searchTerms": wanted_terms,
        }

    cached = find_cached_native_trace(wanted_terms, family_hint=family_hint)
    if cached:
        if bridge_plan:
            cached["bridgePlan"] = bridge_plan
        return cached

    cmd = [
        sys.executable,
        str(GHIDRA_WRAPPER),
        "process-project",
        "cifi-full",
        "libil2cpp.so",
        "--search",
        ",".join(wanted_terms),
        "--timeout",
        str(timeout),
        "--max-cpu",
        "14",
    ]
    proc = subprocess.run(
        cmd,
        cwd=str(ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )

    result: dict[str, Any] = {
        "available": True,
        "project": "cifi-full",
        "searchTerms": wanted_terms,
        "returncode": proc.returncode,
        "status": "failed",
        "cacheHit": False,
    }

    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        result["stdout"] = proc.stdout[-2000:]
        return result

    result.update(
        {
            "status": payload.get("status", "failed"),
            "jobId": payload.get("job_id"),
            "job": payload,
        }
    )

    output_file = payload.get("output_file")
    if output_file:
        path = Path(output_file)
        if path.exists():
            try:
                result["result"] = json.loads(path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                result["result"] = {"error": "invalid-json", "path": str(path)}
    result["summary"] = _summarize_native_result(result.get("result"), wanted_terms, family_hint)
    if bridge_plan:
        result["bridgePlan"] = bridge_plan

    return result
