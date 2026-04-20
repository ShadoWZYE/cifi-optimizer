#!/usr/bin/env python3
"""
Ghidra headless runner for repo-native extraction tasks.

This wrapper uses Jython post-scripts that `analyzeHeadless` can execute
reliably in headless mode. Full auto-analysis is opt-in because libil2cpp.so
spends most of its time in GCC exception handling and tends to hit timeouts
before any useful extraction runs.

Usage:
    python ghidra_headless.py run <binary> [--search a,b,c] [--timeout sec] [--analyze]
    python ghidra_headless.py build-project <project_name> <binary> [--search a,b,c] [--timeout sec]
    python ghidra_headless.py launch-build-project <project_name> <binary> [--search a,b,c] [--timeout sec]
    python ghidra_headless.py process-project <project_name> [project_file] [--search a,b,c] [--timeout sec]
    python ghidra_headless.py poll <job_id>
    python ghidra_headless.py status
    python ghidra_headless.py cache <job_id> [--query string]
    python ghidra_headless.py rebuild-cache-db
    python ghidra_headless.py reclaim
    python ghidra_headless.py invalidate [--job-id id] [--term value] [--aspect kind] [--script name] [--producer-version v] [--schema-lt N] [--trace-scope scope] [--trace-fragment kind]
    python ghidra_headless.py export-process-index [--out path]
    python ghidra_headless.py export-native-graph [--out path]
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from ghidra_cache_db import GhidraCacheDB

ROOT = Path(__file__).resolve().parents[2]
GHIDRA_ROOT = ROOT / "tools/ghidra/ghidra_12.0.4_PUBLIC"
JDK_ROOT = ROOT / "tools/jdk/jdk-21.0.10+7"
ANALYZE_HEADLESS = GHIDRA_ROOT / "support/analyzeHeadless.bat"
SCRIPT_DIR = ROOT / "scripts/unity/ghidra_scripts"
GHIDRA_JYTHON_SCRIPT_DIR = GHIDRA_ROOT / "Ghidra/Features/Jython/ghidra_scripts"
CACHE_DIR = ROOT / "workbench/ghidra-cache"
PROCESS_INDEX_FILE = CACHE_DIR / "process_project_index.json"
NATIVE_GRAPH_INDEX_FILE = CACHE_DIR / "native_graph_index.json"
CACHE_DB_FILE = CACHE_DIR / "ghidra_cache.sqlite3"
PROJECT_DIR = ROOT / "workbench/ghidra-projects"
JOBS_DIR = ROOT / "workbench/ghidra-jobs"
GHIDRA_RUNTIME_DIR = ROOT / "workbench/ghidra-runtime"
MAX_RECENT_PROCESS_JOBS = 16
MAX_NATIVE_EXPANSION_TERMS_PER_REQUEST = 12
DEFAULT_RUN_TIMEOUT = 1200
DEFAULT_PROCESS_TIMEOUT = 1800
DEFAULT_BUILD_TIMEOUT = 5400
DEFAULT_SEARCH = [
    "Tier2TokensUnlocked",
    "Tier3TokensUnlocked",
    "Tier4TokensUnlocked",
    "Tier5TokensUnlocked",
    "get_TotalT1TokenLevels",
]

ASCII_MIN_LEN = 4
METADATA_NEIGHBORHOOD_WINDOW = 0x120
NATIVE_TRACE_SCHEMA_VERSION = 6
_CACHE_DB: GhidraCacheDB | None = None


def _get_cache_db() -> GhidraCacheDB:
    global _CACHE_DB
    if _CACHE_DB is None:
        _CACHE_DB = GhidraCacheDB(CACHE_DB_FILE, JOBS_DIR)
    return _CACHE_DB


def _default_max_cpu() -> int:
    logical = os.cpu_count() or 8
    return max(6, min(14, logical))


def _default_java_heap_gb() -> int:
    logical = os.cpu_count() or 8
    if logical >= 16:
        return 10
    if logical >= 8:
        return 6
    return 4


def _parse_hex_address(value: Any) -> int | None:
    if not isinstance(value, str):
        return None
    try:
        return int(value, 16)
    except ValueError:
        return None


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _split_term_tokens(value: str) -> list[str]:
    pieces = re.split(r"[^A-Za-z0-9]+", value)
    tokens: list[str] = []
    for piece in pieces:
        if not piece:
            continue
        parts = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+", piece)
        for part in parts:
            lowered = part.lower()
            if lowered:
                tokens.append(lowered)
    return tokens


def _is_safe_headless_term(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_]+", value))


def _is_classish_name(value: str) -> bool:
    if not value:
        return False
    if len(value) > 80:
        return False
    if value.count(" ") > 2:
        return False
    if "|" in value or "+" in value:
        if any(ch in value for ch in " /\\.:;\"'()[]{}"):
            return False
        parts = [part for part in re.split(r"[|+]+", value) if part]
        if not parts:
            return False
        return all(part[:1].isupper() and part.replace("`", "").isalnum() for part in parts)
    if any(ch.isdigit() for ch in value):
        return False
    if "." in value:
        return False
    if value.startswith(("get_", "set_", "<", "'", "\"", "(", "[", "{", "+", "-", "|")):
        return False
    fieldish_suffixes = (
        "StartCost",
        "CostExponent",
        "GrowthExponent",
        "Bonus",
        "MaxLevel",
        "Level",
        "Levels",
        "Button",
        "Overlay",
        "Fill",
        "Object",
        "Value",
        "Amount",
        "Done",
        "Progress",
        "Tick",
        "Text",
        "Number",
        "Upgrades",
        "AdditiveCost",
        "DescriptionText",
        "Notification",
    )
    if value.endswith(fieldish_suffixes):
        return False
    return value[:1].isupper() and any(ch.islower() for ch in value[1:])


def _is_methodish_name(value: str) -> bool:
    if not value or len(value) > 120:
        return False
    if " " in value or value.startswith(("'", "\"", "(", "[", "{")):
        return False
    if value.startswith(("get_", "set_", "Buy", "Claim", "Update", "Count", "Sort", "Fill", "Convert")):
        return True
    if "." in value or "|" in value or "+" in value:
        return False
    return value[:1].islower() and any(ch.isupper() for ch in value[1:])


def _is_fieldish_name(value: str) -> bool:
    if not value or len(value) > 120:
        return False
    if " " in value or value.startswith(("get_", "set_", "Buy")):
        return False
    suffixes = (
        "StartCost",
        "CostExponent",
        "GrowthExponent",
        "Bonus",
        "MaxLevel",
        "Level",
        "Levels",
        "Button",
        "Overlay",
        "Fill",
        "Object",
        "Value",
        "Amount",
        "Done",
        "Progress",
        "Tick",
        "Text",
        "Number",
        "Upgrades",
        "Unlocked",
        "AdditiveCost",
        "DescriptionText",
        "Notification",
    )
    if value.endswith(suffixes):
        return True
    if value[:1].islower() and any(ch.isupper() for ch in value[1:]):
        return True
    return False


def _is_ui_slot_term(value: str) -> bool:
    slot_markers = (
        "Text",
        "Title",
        "Description",
        "Desc",
        "Cost",
        "Level",
        "Requirement",
        "Req",
        "Bonus",
        "Box",
        "Layout",
        "Overlay",
        "Fill",
    )
    return any(marker in value for marker in slot_markers)


def _is_high_signal_expansion_candidate(value: str, requested_term: str) -> bool:
    candidate_tokens = _split_term_tokens(value)
    requested_tokens = set(_split_term_tokens(requested_term))
    requested_numbers = {token for token in requested_tokens if token.isdigit()}
    candidate_numbers = {token for token in candidate_tokens if token.isdigit()}
    generic_tokens = {
        "set",
        "get",
        "check",
        "all",
        "tier",
        "fill",
        "text",
        "max",
        "overlay",
        "active",
        "object",
        "description",
        "notification",
        "value",
        "handler",
    }
    non_generic = [token for token in candidate_tokens if token not in generic_tokens]
    if not non_generic:
        return False
    non_generic_requested = {token for token in requested_tokens if token not in generic_tokens}
    if _is_ui_slot_term(requested_term):
        overlap = set(candidate_tokens) & non_generic_requested
        if requested_numbers:
            return bool(requested_numbers & candidate_numbers) or bool(overlap)
        return bool(overlap)
    if requested_numbers:
        return bool(requested_numbers & candidate_numbers)
    if requested_tokens and set(candidate_tokens) & non_generic_requested:
        return True
    return any(
        token in {"token", "tokenshop", "diamond", "cell", "mod", "mk", "bank", "market", "shard"}
        for token in non_generic
    )


def _collect_ascii_runs(candidate_file: Path, min_len: int = ASCII_MIN_LEN) -> list[dict[str, Any]]:
    try:
        data = candidate_file.read_bytes()
    except OSError:
        return []

    runs: list[dict[str, Any]] = []
    i = 0
    while i < len(data) - min_len:
        if 0x20 <= data[i] < 0x7F:
            start = i
            while i < len(data) and 0x20 <= data[i] < 0x7F:
                i += 1
            if i - start < min_len:
                continue

            value = data[start:i].decode("ascii", errors="ignore")
            if len(value) < min_len:
                continue
            runs.append(
                {
                    "file": candidate_file.name,
                    "string": value,
                    "address": start,
                }
            )
        else:
            i += 1
    return runs


def normalize_search_terms(search_strings: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for term in search_strings:
        trimmed = term.strip()
        if not trimmed:
            continue
        key = trimmed.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(trimmed)
    return sorted(normalized, key=str.lower)


def ensure_dirs() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    PROJECT_DIR.mkdir(parents=True, exist_ok=True)
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    GHIDRA_RUNTIME_DIR.mkdir(parents=True, exist_ok=True)


def get_ghidra_runtime_env_dirs() -> dict[str, Path]:
    base = GHIDRA_RUNTIME_DIR
    roaming = base / "roaming"
    local = base / "local"
    temp = base / "temp"
    settings_root = base / "settings"
    cache_root = base / "cache"
    for directory in (roaming, local, temp, settings_root, cache_root):
        directory.mkdir(parents=True, exist_ok=True)
    return {
        "roaming": roaming,
        "local": local,
        "temp": temp,
        "settings": settings_root,
        "cache": cache_root,
    }


def get_java_home() -> Optional[str]:
    java_exe = JDK_ROOT / "bin" / ("java.exe" if sys.platform == "win32" else "java")
    if java_exe.exists():
        return str(JDK_ROOT)
    return None


def _threshold_candidates(binary_path: Path) -> dict[str, list[str]]:
    candidates: dict[str, list[str]] = {}
    try:
        data = binary_path.read_bytes()
    except OSError:
        return candidates

    for value in (25, 50, 100, 150):
        pattern = value.to_bytes(4, "little", signed=False)
        offsets: list[str] = []
        start = 0
        while True:
            index = data.find(pattern, start)
            if index < 0:
                break
            offsets.append(hex(index))
            if len(offsets) >= 25:
                break
            start = index + 1
        if offsets:
            candidates[str(value)] = offsets
    return candidates


def _scan_ascii_targets(binary_path: Path, search_strings: list[str]) -> dict[str, list[dict[str, str]]]:
    matches: dict[str, list[dict[str, str]]] = {}
    binary_files = [binary_path]

    metadata_path = Path(str(binary_path).replace("libil2cpp.so", "global-metadata.dat"))
    if metadata_path.exists():
        binary_files.append(metadata_path)

    for candidate_file in binary_files:
        try:
            data = candidate_file.read_bytes()
        except OSError:
            continue

        min_len = 4
        i = 0
        while i < len(data) - min_len:
            if 0x20 <= data[i] < 0x7F:
                start = i
                while i < len(data) and 0x20 <= data[i] < 0x7F:
                    i += 1
                if i - start < min_len:
                    continue

                value = data[start:i].decode("ascii", errors="ignore")
                if len(value) < min_len:
                    continue

                for target in search_strings:
                    if target.lower() in value.lower():
                        refs = matches.setdefault(target, [])
                        if len(refs) >= 10:
                            continue
                        refs.append(
                            {
                                "file": candidate_file.name,
                                "string": value[:80],
                                "address": hex(start),
                            }
                        )
            else:
                i += 1

    return matches


def _scan_metadata_neighborhoods(binary_path: Path, search_strings: list[str]) -> dict[str, list[dict[str, Any]]]:
    metadata_path = Path(str(binary_path).replace("libil2cpp.so", "global-metadata.dat"))
    if not metadata_path.exists():
        return {}

    runs = _collect_ascii_runs(metadata_path)
    if not runs:
        return {}

    neighborhoods: dict[str, list[dict[str, Any]]] = {}
    normalized_terms = {term: _normalize_text(term) for term in search_strings}

    for index, run in enumerate(runs):
        run_value = run["string"]
        run_normalized = _normalize_text(run_value)
        run_address = int(run["address"])
        for term, normalized_term in normalized_terms.items():
            if not normalized_term or normalized_term not in run_normalized:
                continue

            context: list[dict[str, str]] = []
            matched_terms: list[str] = []
            owner_candidates: list[str] = []
            left = index
            while left > 0 and run_address - int(runs[left - 1]["address"]) <= METADATA_NEIGHBORHOOD_WINDOW:
                left -= 1
            right = index
            while right + 1 < len(runs) and int(runs[right + 1]["address"]) - run_address <= METADATA_NEIGHBORHOOD_WINDOW:
                right += 1

            seen_context: set[str] = set()
            for current in runs[left : right + 1]:
                display = current["string"][:120]
                key = "{}:{}".format(current["address"], display)
                if key in seen_context:
                    continue
                seen_context.add(key)
                context.append(
                    {
                        "string": display,
                        "address": hex(int(current["address"])),
                    }
                )
                current_normalized = _normalize_text(current["string"])
                for other_term, other_normalized in normalized_terms.items():
                    if other_term == term or not other_normalized:
                        continue
                    if other_normalized in current_normalized and other_term not in matched_terms:
                        matched_terms.append(other_term)
                if _is_classish_name(current["string"]) and current["string"] not in owner_candidates:
                    owner_candidates.append(current["string"])

            neighborhoods.setdefault(term, []).append(
                {
                    "file": metadata_path.name,
                    "match": run_value[:120],
                    "address": hex(run_address),
                    "context": context[:20],
                    "matchedTerms": matched_terms[:12],
                    "ownerCandidates": owner_candidates[:12],
                }
            )

    return neighborhoods


def _derive_search_expansions(
    search_strings: list[str],
    metadata_neighborhoods: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    requested_terms = normalize_search_terms(search_strings)
    expansions_by_term: dict[str, dict[str, list[str]]] = {}
    native_search_terms: list[str] = []
    seen_native_terms: set[str] = {term.lower() for term in requested_terms}

    for term in requested_terms:
        expansions = {
            "ownerCandidates": [],
            "methodCandidates": [],
            "fieldCandidates": [],
            "relatedTerms": [],
            "contextStrings": [],
        }
        for neighborhood in metadata_neighborhoods.get(term, []):
            for owner in neighborhood.get("ownerCandidates", []):
                if owner not in expansions["ownerCandidates"]:
                    expansions["ownerCandidates"].append(owner)
            for related in neighborhood.get("matchedTerms", []):
                if related not in expansions["relatedTerms"]:
                    expansions["relatedTerms"].append(related)
            for context_entry in neighborhood.get("context", []):
                value = str(context_entry.get("string", "")).strip()
                if not value:
                    continue
                if value not in expansions["contextStrings"]:
                    expansions["contextStrings"].append(value)
                if not _is_high_signal_expansion_candidate(value, term):
                    continue
                if _is_methodish_name(value) and value not in expansions["methodCandidates"]:
                    expansions["methodCandidates"].append(value)
                elif _is_fieldish_name(value) and value not in expansions["fieldCandidates"]:
                    expansions["fieldCandidates"].append(value)

        expansion_terms = [
            *expansions["ownerCandidates"],
            *expansions["methodCandidates"],
            *expansions["fieldCandidates"],
        ]
        for candidate in normalize_search_terms(expansion_terms):
            lowered = candidate.lower()
            if not _is_safe_headless_term(candidate):
                continue
            if lowered in seen_native_terms:
                continue
            seen_native_terms.add(lowered)
            native_search_terms.append(candidate)
        expansions_by_term[term] = expansions

    return {
        "requestedTerms": requested_terms,
        "nativeSearchTerms": normalize_search_terms(native_search_terms),
        "byRequestedTerm": expansions_by_term,
    }


def _score_native_expansion_term(expansion_term: str, requested_terms: list[str]) -> int:
    lowered = expansion_term.lower()
    score = 0
    for requested in requested_terms:
        requested_lower = requested.lower()
        if lowered == requested_lower:
            score += 100
        elif lowered.startswith(requested_lower) or requested_lower.startswith(lowered):
            score += 40
        elif requested_lower in lowered or lowered in requested_lower:
            score += 20
    if any(marker in expansion_term for marker in ("Cost", "Bonus", "Fill", "Level", "Button", "Overlay", "Content", "Text")):
        score += 8
    if expansion_term.startswith(("Buy", "Set", "get_", "Check")):
        score += 6
    return score


def _build_analysis_terms(
    requested_terms: list[str],
    native_search_terms: list[str],
) -> list[str]:
    normalized_requested = normalize_search_terms(requested_terms)
    requested_lower = {term.lower() for term in normalized_requested}
    prioritized_expansions = sorted(
        [
            term
            for term in normalize_search_terms(native_search_terms)
            if term.lower() not in requested_lower
        ],
        key=lambda term: (-_score_native_expansion_term(term, normalized_requested), term.lower()),
    )[:MAX_NATIVE_EXPANSION_TERMS_PER_REQUEST]
    return [
        term
        for term in normalize_search_terms([*normalized_requested, *prioritized_expansions])
        if _is_safe_headless_term(term)
    ]


def _enrich_term_bridges(
    result_data: dict[str, Any],
    search_strings: list[str],
    ascii_targets: dict[str, list[dict[str, str]]],
    metadata_neighborhoods: dict[str, list[dict[str, Any]]],
    search_expansions: dict[str, Any] | None = None,
) -> None:
    direct_functions = result_data.get("functions", {})
    fuzzy_functions = result_data.get("fuzzyFunctions", {})
    reference_functions = result_data.get("referenceFunctions", {})
    existing_bridges = result_data.get("termBridges", {})
    query_owner_candidates = [term for term in search_strings if _is_classish_name(term)]
    expansion_map = (search_expansions or {}).get("byRequestedTerm", {})
    enriched_bridges: dict[str, Any] = {}

    for term in search_strings:
        bridge = dict(existing_bridges.get(term, {}))
        metadata_hits = ascii_targets.get(term, [])
        neighborhoods = metadata_neighborhoods.get(term, [])
        owner_candidates = list(query_owner_candidates)
        related_terms: list[str] = []
        neighborhood_sample_terms: list[str] = []
        expanded_function_matches: list[dict[str, Any]] = []
        expanded_reference_matches: list[dict[str, Any]] = []
        expansion_terms = expansion_map.get(term, {})

        for neighborhood in neighborhoods:
            for candidate in neighborhood.get("ownerCandidates", []):
                if candidate not in owner_candidates:
                    owner_candidates.append(candidate)
            for candidate_term in neighborhood.get("matchedTerms", []):
                if candidate_term not in related_terms:
                    related_terms.append(candidate_term)
            for context_entry in neighborhood.get("context", [])[:8]:
                candidate_value = context_entry.get("string")
                if candidate_value and candidate_value not in neighborhood_sample_terms:
                    neighborhood_sample_terms.append(candidate_value)

        for candidate_term in (
            expansion_terms.get("ownerCandidates", [])
            + expansion_terms.get("methodCandidates", [])
            + expansion_terms.get("fieldCandidates", [])
            + expansion_terms.get("relatedTerms", [])
        ):
            for function_entry in direct_functions.get(candidate_term, []):
                if function_entry not in expanded_function_matches:
                    expanded_function_matches.append(function_entry)
            for function_entry in fuzzy_functions.get(candidate_term, []):
                if function_entry not in expanded_function_matches:
                    expanded_function_matches.append(function_entry)
            for function_entry in reference_functions.get(candidate_term, []):
                if function_entry not in expanded_reference_matches:
                    expanded_reference_matches.append(function_entry)

        metadata_count = max(int(bridge.get("metadataStringHitCount", 0)), len(metadata_hits))
        direct_count = max(int(bridge.get("directSymbolMatchCount", 0)), len(direct_functions.get(term, [])))
        fuzzy_count = max(int(bridge.get("fuzzySymbolMatchCount", 0)), len(fuzzy_functions.get(term, [])))
        reference_count = max(int(bridge.get("referenceFunctionCount", 0)), len(reference_functions.get(term, [])))
        expanded_match_count = len(expanded_function_matches) + len(expanded_reference_matches)

        bridge_kind = bridge.get("bridgeKind", "unresolved")
        note = bridge.get("note", "No native bridge was recovered for this term.")
        if reference_count and metadata_count:
            bridge_kind = "string-xref-bridge"
            note = "Metadata or program strings survived and referenced native functions were recovered."
        elif direct_count:
            bridge_kind = "native-symbol-match"
            note = "One or more native functions matched the requested term directly."
        elif fuzzy_count:
            bridge_kind = "token-bridge"
            note = "No direct symbol match, but token-overlap native candidates were recovered."
        elif metadata_count and expanded_match_count:
            bridge_kind = "managed-expansion-bridge"
            note = "Metadata neighborhoods produced owner, method, or field expansions that recovered native functions."
        elif metadata_count and (owner_candidates or related_terms or neighborhoods):
            bridge_kind = "metadata-neighborhood"
            note = "Metadata-side strings were recovered with nearby owner or sibling terms."
        elif metadata_count:
            bridge_kind = "metadata-only"
            note = "Managed identifier was recovered from metadata, but no stronger native bridge was found."

        bridge.update(
            {
                "term": term,
                "metadataStringHitCount": metadata_count,
                "directSymbolMatchCount": direct_count,
                "fuzzySymbolMatchCount": fuzzy_count,
                "referenceFunctionCount": reference_count,
                "expandedMatchCount": expanded_match_count,
                "metadataNeighborhoodCount": len(neighborhoods),
                "ownerCandidates": owner_candidates[:12],
                "relatedTerms": related_terms[:12],
                "metadataNeighborhoodSamples": neighborhood_sample_terms[:12],
                "searchExpansion": expansion_terms,
                "expandedFunctionMatches": expanded_function_matches[:16],
                "expandedReferenceMatches": expanded_reference_matches[:16],
                "bridgeKind": bridge_kind,
                "note": note,
            }
        )
        enriched_bridges[term] = bridge

    result_data["termBridges"] = enriched_bridges
    if metadata_neighborhoods:
        result_data["metadataNeighborhoods"] = metadata_neighborhoods
    if search_expansions:
        result_data["searchExpansions"] = search_expansions


def _classify_managed_term_kind(term: str) -> str:
    if term.startswith(("get_", "set_")):
        return "method"
    if _is_classish_name(term):
        return "owner"
    fieldish_markers = (
        "Cost",
        "Bonus",
        "Exponent",
        "Level",
        "Amount",
        "Value",
        "Tokens",
        "Tokenium",
        "Unlocked",
        "Progress",
        "Cooldown",
        "Fill",
        "Max",
    )
    if any(marker in term for marker in fieldish_markers):
        return "field"
    return "term"


def _owner_matches_family(owner: str, family_hint: str | None) -> bool:
    if not family_hint:
        return False
    lowered = owner.lower()
    if family_hint.startswith("shard"):
        return "shard" in lowered
    if family_hint == "token-shop":
        return "token" in lowered or "shop" in lowered or "atu" in lowered
    if family_hint.startswith("multiverse-market"):
        return "multiverse" in lowered or "market" in lowered or "inscryption" in lowered
    return False


def _build_managed_reconstruction(
    search_strings: list[str],
    term_bridges: dict[str, Any],
    family_hint: str | None = None,
) -> dict[str, Any]:
    owners: list[str] = []
    methods: list[str] = []
    fields: list[str] = []
    raw_value_terms: list[str] = []
    owner_to_terms: dict[str, dict[str, list[str]]] = {}
    owner_scores: dict[str, int] = {}
    owner_reasons: dict[str, list[str]] = {}

    for term in search_strings:
        bridge = term_bridges.get(term, {})
        bridge_kind = bridge.get("bridgeKind")
        if bridge_kind not in {
            "metadata-neighborhood",
            "metadata-only",
            "string-xref-bridge",
            "native-symbol-match",
            "token-bridge",
            "managed-expansion-bridge",
        }:
            continue

        term_kind = _classify_managed_term_kind(term)
        bridge_owners = bridge.get("ownerCandidates", [])
        search_expansion = bridge.get("searchExpansion", {})
        filtered_owners: list[str] = []
        for owner in bridge_owners:
            if owner not in filtered_owners and _is_classish_name(owner):
                filtered_owners.append(owner)
        if term_kind == "owner" and term not in filtered_owners:
            filtered_owners.insert(0, term)

        for owner in filtered_owners:
            if owner not in owners:
                owners.append(owner)
            bucket = owner_to_terms.setdefault(
                owner,
                {"methods": [], "fields": [], "rawValues": [], "relatedTerms": []},
            )
            owner_scores[owner] = owner_scores.get(owner, 0) + 2
            reasons = owner_reasons.setdefault(owner, [])
            if "term-owner-neighborhood" not in reasons:
                reasons.append("term-owner-neighborhood")
            if _owner_matches_family(owner, family_hint):
                owner_scores[owner] += 4
                if "family-match" not in reasons:
                    reasons.append("family-match")
            if term_kind == "method":
                if term not in methods:
                    methods.append(term)
                if term not in bucket["methods"]:
                    bucket["methods"].append(term)
                    owner_scores[owner] += 5
                    if "method-ownership" not in reasons:
                        reasons.append("method-ownership")
            elif term_kind == "field":
                if term not in fields:
                    fields.append(term)
                if term not in raw_value_terms:
                    raw_value_terms.append(term)
                if term not in bucket["fields"]:
                    bucket["fields"].append(term)
                    owner_scores[owner] += 4
                    if "field-ownership" not in reasons:
                        reasons.append("field-ownership")
                if term not in bucket["rawValues"]:
                    bucket["rawValues"].append(term)
            elif term_kind == "owner":
                if term not in bucket["relatedTerms"]:
                    bucket["relatedTerms"].append(term)
                    owner_scores[owner] += 3
                    if "owner-anchor" not in reasons:
                        reasons.append("owner-anchor")
            else:
                if term not in bucket["relatedTerms"]:
                    bucket["relatedTerms"].append(term)
                    owner_scores[owner] += 1
                    if "related-term" not in reasons:
                        reasons.append("related-term")

        if not filtered_owners:
            if term_kind == "method" and term not in methods:
                methods.append(term)
            elif term_kind == "field":
                if term not in fields:
                    fields.append(term)
                if term not in raw_value_terms:
                    raw_value_terms.append(term)

        for method_candidate in search_expansion.get("methodCandidates", []):
            if method_candidate not in methods:
                methods.append(method_candidate)
        for field_candidate in search_expansion.get("fieldCandidates", []):
            if field_candidate not in fields:
                fields.append(field_candidate)
            if field_candidate not in raw_value_terms:
                raw_value_terms.append(field_candidate)

    scored_owners = [
        {
            "owner": owner,
            "score": owner_scores.get(owner, 0),
            "reasons": owner_reasons.get(owner, []),
            "methods": owner_to_terms.get(owner, {}).get("methods", []),
            "fields": owner_to_terms.get(owner, {}).get("fields", []),
            "rawValues": owner_to_terms.get(owner, {}).get("rawValues", []),
            "relatedTerms": owner_to_terms.get(owner, {}).get("relatedTerms", []),
        }
        for owner in owners
    ]
    scored_owners.sort(key=lambda item: (-item["score"], item["owner"].lower()))

    return {
        "schemaVersion": NATIVE_TRACE_SCHEMA_VERSION,
        "familyHint": family_hint,
        "owners": owners[:20],
        "methods": methods[:40],
        "fields": fields[:40],
        "rawValueTerms": raw_value_terms[:40],
        "ownerToTerms": owner_to_terms,
        "scoredOwners": scored_owners[:20],
    }


def _build_managed_graph(
    search_strings: list[str],
    term_bridges: dict[str, Any],
    managed_reconstruction: dict[str, Any],
) -> dict[str, Any]:
    owner_to_terms = managed_reconstruction.get("ownerToTerms", {})
    scored_owners = managed_reconstruction.get("scoredOwners", [])
    owner_scores = {
        str(entry.get("owner", "")): int(entry.get("score", 0) or 0)
        for entry in scored_owners
        if entry.get("owner")
    }
    owner_nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    attached_methods: set[str] = set()
    attached_fields: set[str] = set()
    attached_raw_values: set[str] = set()

    for owner, bucket in owner_to_terms.items():
        methods = list(bucket.get("methods", []))
        fields = list(bucket.get("fields", []))
        raw_values = list(bucket.get("rawValues", []))
        related_terms = list(bucket.get("relatedTerms", []))
        owner_nodes.append(
            {
                "owner": owner,
                "score": owner_scores.get(owner, 0),
                "methods": methods,
                "fields": fields,
                "rawValues": raw_values,
                "relatedTerms": related_terms,
            }
        )
        for method in methods:
            attached_methods.add(method)
            edges.append({"from": owner, "to": method, "type": "owns-method"})
        for field in fields:
            attached_fields.add(field)
            edges.append({"from": owner, "to": field, "type": "owns-field"})
        for raw_value in raw_values:
            attached_raw_values.add(raw_value)
            edges.append({"from": owner, "to": raw_value, "type": "uses-raw-value"})
        for related_term in related_terms:
            edges.append({"from": owner, "to": related_term, "type": "related-term"})

    orphan_methods = [
        method for method in managed_reconstruction.get("methods", [])
        if method not in attached_methods
    ]
    orphan_fields = [
        field for field in managed_reconstruction.get("fields", [])
        if field not in attached_fields
    ]
    orphan_raw_values = [
        value for value in managed_reconstruction.get("rawValueTerms", [])
        if value not in attached_raw_values
    ]
    term_nodes = []
    for term in search_strings:
        bridge = term_bridges.get(term, {})
        term_nodes.append(
            {
                "term": term,
                "bridgeKind": bridge.get("bridgeKind", "unresolved"),
                "ownerCandidates": bridge.get("ownerCandidates", []),
                "relatedTerms": bridge.get("relatedTerms", []),
            }
        )

    return {
        "schemaVersion": NATIVE_TRACE_SCHEMA_VERSION,
        "owners": owner_nodes,
        "termNodes": term_nodes,
        "edges": edges,
        "orphanMethods": orphan_methods,
        "orphanFields": orphan_fields,
        "orphanRawValues": orphan_raw_values,
    }


def _sync_jython_script(script_name: str) -> Path:
    source = SCRIPT_DIR / script_name
    target = GHIDRA_JYTHON_SCRIPT_DIR / script_name
    GHIDRA_JYTHON_SCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    return target


def _make_job_dir(prefix: str, job_id: Optional[str] = None) -> tuple[str, Path]:
    if job_id is None:
        job_id = "{}_{}".format(prefix, datetime.now().strftime("%Y%m%d_%H%M%S"))
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    return job_id, job_dir


def _extract_error(log_text: str) -> Optional[str]:
    for line in reversed(log_text.splitlines()):
        if "SCRIPT ERROR" in line or line.startswith("ERROR ") or "Exception in thread" in line:
            return line.strip()
    return None


def _load_json(path: Path) -> Optional[dict]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _term_signature(search_strings: list[str]) -> str:
    return "\x1f".join(term.lower() for term in normalize_search_terms(search_strings))


def _empty_process_index() -> dict[str, Any]:
    return {
        "version": 1,
        "generatedAt": datetime.now().isoformat(),
        "jobsByProject": {},
    }


def _load_result_for_job(job_info: dict[str, Any]) -> dict[str, Any] | None:
    output_file = Path(str(job_info.get("output_file", "")))
    if not output_file.exists():
        return None
    return _load_json(output_file)


def _refresh_runtime_state(stages: list[str] | None = None) -> dict[str, Any]:
    selected_stages = [stage.lower() for stage in (stages or ["full"])]
    if "full" in selected_stages:
        selected_stages = ["native-cache", "trace-system", "materialization"]
    db = _get_cache_db()
    process_index: dict[str, Any] | None = None
    native_graph_index: dict[str, Any] | None = None
    completed: list[str] = []

    if "native-cache" in selected_stages:
        db.rebuild_indices(_load_result_for_job, _process_result_is_stale)
        process_index = db.export_process_index()
        native_graph_index = db.export_native_graph_index()
        completed.append("native-cache")

    if any(stage in selected_stages for stage in ("trace-system", "semantic", "materialization")):
        db.rebuild_trace_views()
        if "trace-system" not in completed:
            completed.append("trace-system")
        if "materialization" in selected_stages:
            completed.append("materialization")

    return {
        "processIndex": process_index or db.export_process_index(),
        "nativeGraphIndex": native_graph_index or db.export_native_graph_index(),
        "stagesRun": completed,
    }


def _sync_job_file(job_info: dict[str, Any]) -> dict[str, Any]:
    job_id = str(job_info.get("job_id", "")).strip()
    if not job_id:
        return job_info
    job_file = Path(str(job_info.get("job_file", JOBS_DIR / job_id / "job.json")))
    job_file.parent.mkdir(parents=True, exist_ok=True)
    job_file.write_text(json.dumps(job_info, indent=2), encoding="utf-8")
    job_info["job_file"] = str(job_file)
    return job_info


def _process_result_is_stale(result_payload: dict[str, Any] | None, wanted_terms: list[str]) -> bool:
    if not isinstance(result_payload, dict):
        return True
    if int(result_payload.get("schemaVersion", 0)) < NATIVE_TRACE_SCHEMA_VERSION:
        return True
    bridges = result_payload.get("termBridges")
    if not isinstance(bridges, dict):
        return True
    managed_reconstruction = result_payload.get("managedReconstruction")
    if not isinstance(managed_reconstruction, dict):
        return True
    if int(managed_reconstruction.get("schemaVersion", 0)) < NATIVE_TRACE_SCHEMA_VERSION:
        return True
    managed_graph = result_payload.get("managedGraph")
    if not isinstance(managed_graph, dict):
        return True
    if int(managed_graph.get("schemaVersion", 0)) < NATIVE_TRACE_SCHEMA_VERSION:
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


def _load_process_index() -> dict[str, Any]:
    index = _get_cache_db().export_process_index()
    if not isinstance(index, dict) or "jobsByProject" not in index:
        return _empty_process_index()
    return index


def _write_process_index(index: dict[str, Any]) -> None:
    _write_process_index_to_path(index, PROCESS_INDEX_FILE)


def _write_native_graph_index(index: dict[str, Any]) -> None:
    _write_native_graph_index_to_path(index, NATIVE_GRAPH_INDEX_FILE)


def _write_process_index_to_path(index: dict[str, Any], path: Path) -> None:
    payload = dict(index)
    payload["generatedAt"] = datetime.now().isoformat()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _write_native_graph_index_to_path(index: dict[str, Any], path: Path) -> None:
    payload = dict(index)
    payload["generatedAt"] = datetime.now().isoformat()
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def _load_native_graph_index() -> dict[str, Any]:
    index = _get_cache_db().export_native_graph_index()
    if not isinstance(index, dict) or "projects" not in index:
        return {}
    return index


def export_process_index(out_path: Path | None = None) -> dict[str, Any]:
    index = _get_cache_db().export_process_index()
    target = out_path or PROCESS_INDEX_FILE
    _write_process_index_to_path(index, target)
    return {"database": str(CACHE_DB_FILE), "out": str(target)}


def export_native_graph(out_path: Path | None = None) -> dict[str, Any]:
    index = _get_cache_db().export_native_graph_index()
    target = out_path or NATIVE_GRAPH_INDEX_FILE
    _write_native_graph_index_to_path(index, target)
    return {"database": str(CACHE_DB_FILE), "out": str(target)}


def _safe_remove_job_dir(job_dir: Path) -> None:
    resolved = job_dir.resolve()
    jobs_root = JOBS_DIR.resolve()
    if resolved == jobs_root or jobs_root not in resolved.parents:
        raise RuntimeError("Refusing to remove job dir outside ghidra jobs root: {}".format(job_dir))
    shutil.rmtree(resolved, ignore_errors=True)


def _safe_remove_cache_file(cache_file: Path) -> None:
    resolved = cache_file.resolve()
    cache_root = CACHE_DIR.resolve()
    if cache_root not in resolved.parents:
        raise RuntimeError("Refusing to remove cache file outside ghidra cache root: {}".format(cache_file))
    try:
        resolved.unlink()
    except FileNotFoundError:
        return


def prune_ghidra_artifacts() -> None:
    if not JOBS_DIR.exists():
        return

    db = _get_cache_db()
    process_jobs: list[tuple[str, Path, dict[str, Any], dict[str, Any] | None]] = []
    jobs_to_remove: list[Path] = []
    removed_job_ids: list[str] = []
    newest_by_signature: dict[str, tuple[str, Path, dict[str, Any], dict[str, Any] | None]] = {}

    for job_dir in JOBS_DIR.iterdir():
        if not job_dir.is_dir():
            continue
        job_info = _load_json(job_dir / "job.json")
        if not job_info:
            continue
        if job_info.get("status") == "running":
            continue
        if job_info.get("mode") != "process-project":
            continue
        output_file = Path(str(job_info.get("output_file", "")))
        result_payload = _load_json(output_file) if output_file.exists() else None
        search_terms = normalize_search_terms(job_info.get("search_strings", []))
        start_time = str(job_info.get("start_time", ""))
        if result_payload is None or _process_result_is_stale(result_payload, search_terms):
            jobs_to_remove.append(job_dir)
            continue
        candidate = (start_time, job_dir, job_info, result_payload)
        process_jobs.append(candidate)
        signature = _term_signature(search_terms)
        previous = newest_by_signature.get(signature)
        if previous is None or start_time > previous[0]:
            newest_by_signature[signature] = candidate

    process_jobs.sort(key=lambda item: item[0], reverse=True)
    keep_job_ids = {entry[2].get("job_id") for entry in newest_by_signature.values()}
    unique_signature_jobs = [entry for entry in process_jobs if entry[2].get("job_id") in keep_job_ids]
    unique_signature_jobs.sort(key=lambda item: item[0], reverse=True)
    keep_job_ids.update(entry[2].get("job_id") for entry in unique_signature_jobs[:MAX_RECENT_PROCESS_JOBS])
    for _, job_dir, job_info, _ in process_jobs:
        if job_info.get("job_id") not in keep_job_ids:
            jobs_to_remove.append(job_dir)

    seen_job_ids: set[str] = set()
    for job_dir in jobs_to_remove:
        job_info = _load_json(job_dir / "job.json") or {}
        job_id = str(job_info.get("job_id", ""))
        if job_id in seen_job_ids:
            continue
        seen_job_ids.add(job_id)
        _safe_remove_job_dir(job_dir)
        if job_id:
            removed_job_ids.append(job_id)
            _safe_remove_cache_file(CACHE_DIR / "{}_results.json".format(job_id))

    for cache_file in CACHE_DIR.glob("*_results.json"):
        job_id = cache_file.stem[:-8] if cache_file.stem.endswith("_results") else ""
        if not job_id:
            continue
        if not (JOBS_DIR / job_id).exists():
            _safe_remove_cache_file(cache_file)

    if removed_job_ids:
        db.remove_jobs(removed_job_ids)
    _rebuild_cache_views()


def _index_bucket(index: dict[str, Any], project_name: str, project_file: str, create: bool = False) -> list[dict[str, Any]]:
    projects = index.setdefault("jobsByProject", {}) if create else index.get("jobsByProject", {})
    project_entry = projects.setdefault(project_name, {}) if create else projects.get(project_name, {})
    if create:
        return project_entry.setdefault(project_file, [])
    return list(project_entry.get(project_file, []))


def _rebuild_process_index() -> dict[str, Any]:
    index, _ = _rebuild_cache_views()
    return index


def _rebuild_native_graph_index() -> dict[str, Any]:
    _, graph_index = _rebuild_cache_views()
    return graph_index


def _upsert_process_index_entry(index: dict[str, Any], job_info: dict[str, Any]) -> None:
    project_name = str(job_info.get("project_name", ""))
    project_file = str(job_info.get("project_file", ""))
    if not project_name or not project_file:
        return
    bucket = _index_bucket(index, project_name, project_file, create=True)
    entry = {
        "job_id": job_info.get("job_id"),
        "project_name": project_name,
        "project_file": project_file,
        "start_time": job_info.get("start_time", ""),
        "output_file": job_info.get("output_file", ""),
        "search_strings": normalize_search_terms(job_info.get("search_strings", [])),
        "signature": _term_signature(job_info.get("search_strings", [])),
        "status": job_info.get("status", ""),
    }
    bucket[:] = [item for item in bucket if item.get("job_id") != entry["job_id"]]
    bucket.append(entry)


def _load_completed_process_job_candidates(project_name: str, project_file: str) -> list[dict[str, Any]]:
    db = _get_cache_db()
    candidates: list[dict[str, Any]] = []
    stale_job_ids: list[str] = []

    for job_info in db.get_completed_process_jobs(project_name, project_file):
        result = _load_result_for_job(job_info)
        terms = normalize_search_terms(job_info.get("search_strings", []))
        if not result or _process_result_is_stale(result, terms):
            job_id = str(job_info.get("job_id", "")).strip()
            if job_id:
                stale_job_ids.append(job_id)
            continue
        candidates.append({"job": _sync_job_file(job_info), "result": result, "terms": terms})

    if stale_job_ids:
        for job_id in stale_job_ids:
            db.invalidate(job_id=job_id, reason="stale-process-result")
        _rebuild_cache_views()
        fresh_candidates: list[dict[str, Any]] = []
        for job_info in db.get_completed_process_jobs(project_name, project_file):
            result = _load_result_for_job(job_info)
            terms = normalize_search_terms(job_info.get("search_strings", []))
            if not result or _process_result_is_stale(result, terms):
                continue
            fresh_candidates.append({"job": _sync_job_file(job_info), "result": result, "terms": terms})
        return fresh_candidates
    return candidates


def _choose_cached_process_subset(project_name: str, project_file: str, wanted_terms: list[str]) -> Optional[dict[str, Any]]:
    db = _get_cache_db()
    signature = _term_signature(wanted_terms)
    exact_job = db.find_exact_subset_job(project_name, project_file, signature)
    if exact_job:
        result = _load_result_for_job(exact_job)
        terms = normalize_search_terms(exact_job.get("search_strings", []))
        if result and not _process_result_is_stale(result, terms):
            return {"job": _sync_job_file(exact_job), "result": result, "terms": terms}
    materialized = db.find_materialized_job_view(project_name, project_file, signature)
    if materialized:
        return materialized
    wanted_set = {term.lower() for term in wanted_terms}
    best: Optional[dict[str, Any]] = None
    best_size = -1
    best_time = ""
    for candidate in _load_completed_process_job_candidates(project_name, project_file):
        candidate_terms = candidate["terms"]
        candidate_set = {term.lower() for term in candidate_terms}
        if not candidate_set.issubset(wanted_set):
            continue
        size = len(candidate_terms)
        start_time = str(candidate["job"].get("start_time", ""))
        if size > best_size or (size == best_size and start_time > best_time):
            best = candidate
            best_size = size
            best_time = start_time
    return best


def _choose_cached_process_term_jobs(project_name: str, project_file: str, wanted_terms: list[str]) -> tuple[list[dict[str, Any]], list[str]]:
    hits: list[dict[str, Any]] = []
    missing: list[str] = []
    db = _get_cache_db()
    for term in wanted_terms:
        candidate = db.find_canonical_term_view(project_name, project_file, term)
        if candidate is None:
            missing.append(term)
            continue
        hits.append(candidate)
    return hits, missing


def _graph_backfill_links_for_term(
    aggregate_graph: dict[str, Any],
    term: str,
) -> list[dict[str, str]]:
    lowered = term.lower()
    links: list[dict[str, str]] = []

    for source_term, source_links in aggregate_graph.get("termLinks", {}).items():
        for link in source_links:
            value = str(link.get("value", "")).strip()
            if not value or value.lower() != lowered:
                continue
            candidate = {
                "sourceTerm": str(source_term),
                "kind": str(link.get("kind", "")),
                "value": value,
            }
            if candidate not in links:
                links.append(candidate)

    for bucket_name in ("owners", "methods", "fields", "rawValues"):
        bucket = aggregate_graph.get(bucket_name, {})
        for value, info in bucket.items():
            if str(value).strip().lower() != lowered:
                continue
            for source_term in info.get("terms", []):
                candidate = {
                    "sourceTerm": str(source_term),
                    "kind": bucket_name,
                    "value": str(value),
                }
                if candidate not in links:
                    links.append(candidate)
    return links


def _choose_graph_backfill_candidates(
    project_name: str,
    project_file: str,
    missing_terms: list[str],
    direct_hits: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str], dict[str, list[dict[str, str]]]]:
    db = _get_cache_db()
    seen_job_ids = {
        str(candidate.get("job", {}).get("job_id", ""))
        for candidate in direct_hits
        if candidate.get("job", {}).get("job_id")
    }
    graph_hits: list[dict[str, Any]] = []
    graph_links_by_term: dict[str, list[dict[str, str]]] = {}
    remaining_missing: list[str] = []

    for term in missing_terms:
        links = db.find_graph_backfill(project_name, project_file, term)
        if not links:
            remaining_missing.append(term)
            continue
        graph_links_by_term[term] = links
        selected_candidate: dict[str, Any] | None = None
        for link in links:
            source_term = str(link.get("sourceTerm", "")).strip()
            if not source_term:
                continue
            candidate = db.find_canonical_term_view(project_name, project_file, source_term)
            if candidate is None:
                continue
            selected_candidate = candidate
            break
        if selected_candidate is None:
            remaining_missing.append(term)
            continue
        job_id = str(selected_candidate.get("job", {}).get("job_id", ""))
        if job_id and job_id in seen_job_ids:
            continue
        if job_id:
            seen_job_ids.add(job_id)
        graph_hits.append(selected_candidate)

    return graph_hits, remaining_missing, graph_links_by_term


def _merge_term_maps(*maps: dict[str, Any]) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for current in maps:
        for term, value in current.items():
            if term not in merged:
                merged[term] = value
                continue
            if isinstance(merged[term], list) and isinstance(value, list):
                seen = {
                    json.dumps(item, sort_keys=True)
                    for item in merged[term]
                    if isinstance(item, dict)
                }
                extras = []
                for item in value:
                    if isinstance(item, dict):
                        encoded = json.dumps(item, sort_keys=True)
                        if encoded in seen:
                            continue
                        seen.add(encoded)
                    extras.append(item)
                merged[term] = merged[term] + extras
            else:
                merged[term] = value
    return merged


def _merge_result_payloads(
    base_result: dict[str, Any],
    new_result: dict[str, Any],
    wanted_terms: list[str],
    reused_job_id: Optional[str],
    missing_terms: list[str],
) -> dict[str, Any]:
    merged = dict(base_result)
    merged["schemaVersion"] = NATIVE_TRACE_SCHEMA_VERSION
    merged["strings"] = _merge_term_maps(base_result.get("strings", {}), new_result.get("strings", {}))
    merged["functions"] = _merge_term_maps(base_result.get("functions", {}), new_result.get("functions", {}))
    merged["fuzzyFunctions"] = _merge_term_maps(
        base_result.get("fuzzyFunctions", {}),
        new_result.get("fuzzyFunctions", {}),
    )
    merged["referenceFunctions"] = _merge_term_maps(
        base_result.get("referenceFunctions", {}),
        new_result.get("referenceFunctions", {}),
    )
    merged["termBridges"] = {
        **base_result.get("termBridges", {}),
        **new_result.get("termBridges", {}),
    }
    if base_result.get("metadataNeighborhoods") or new_result.get("metadataNeighborhoods"):
        merged["metadataNeighborhoods"] = _merge_term_maps(
            base_result.get("metadataNeighborhoods", {}),
            new_result.get("metadataNeighborhoods", {}),
        )
    if base_result.get("searchExpansions") or new_result.get("searchExpansions"):
        merged["searchExpansions"] = {
            "requestedTerms": wanted_terms,
            "nativeSearchTerms": normalize_search_terms(
                [
                    *base_result.get("searchExpansions", {}).get("nativeSearchTerms", []),
                    *new_result.get("searchExpansions", {}).get("nativeSearchTerms", []),
                ]
            ),
            "byRequestedTerm": {
                **base_result.get("searchExpansions", {}).get("byRequestedTerm", {}),
                **new_result.get("searchExpansions", {}).get("byRequestedTerm", {}),
            },
        }
    if base_result.get("ascii_targets") or new_result.get("ascii_targets"):
        merged["ascii_targets"] = _merge_term_maps(
            base_result.get("ascii_targets", {}),
            new_result.get("ascii_targets", {}),
        )
    merged["errors"] = [*base_result.get("errors", []), *new_result.get("errors", [])]
    merged["timestamp"] = datetime.now().isoformat()
    merged["cache"] = {
        "requested_terms": wanted_terms,
        "reused_job_id": reused_job_id,
        "missing_terms": missing_terms,
        "merged": reused_job_id is not None and bool(missing_terms),
    }
    if "functionCount" in new_result:
        merged["functionCount"] = new_result["functionCount"]
    elif "functionCount" in base_result:
        merged["functionCount"] = base_result["functionCount"]
    return merged


def _finalize_result_payload(
    result_data: dict[str, Any],
    search_strings: list[str],
    metadata_neighborhoods: dict[str, list[dict[str, Any]]],
    search_expansions: dict[str, Any],
    ascii_targets: dict[str, list[dict[str, str]]] | None = None,
    family_hint: str | None = None,
) -> dict[str, Any]:
    result_data["schemaVersion"] = NATIVE_TRACE_SCHEMA_VERSION
    if ascii_targets is not None:
        result_data["ascii_targets"] = ascii_targets
    if metadata_neighborhoods:
        result_data["metadataNeighborhoods"] = metadata_neighborhoods
    _enrich_term_bridges(
        result_data,
        search_strings,
        result_data.get("ascii_targets", {}),
        result_data.get("metadataNeighborhoods", {}),
        search_expansions,
    )
    result_data["managedReconstruction"] = _build_managed_reconstruction(
        search_strings,
        result_data.get("termBridges", {}),
        family_hint,
    )
    result_data["managedGraph"] = _build_managed_graph(
        search_strings,
        result_data.get("termBridges", {}),
        result_data.get("managedReconstruction", {}),
    )
    return result_data


def _merge_candidate_results(
    candidates: list[dict[str, Any]],
    wanted_terms: list[str],
    metadata_neighborhoods: dict[str, list[dict[str, Any]]],
    search_expansions: dict[str, Any],
    ascii_targets: dict[str, list[dict[str, str]]] | None = None,
    family_hint: str | None = None,
) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for candidate in candidates:
        candidate_result = candidate.get("result", {})
        if not merged:
            merged = _merge_result_payloads(candidate_result, {}, wanted_terms, None, [])
        else:
            merged = _merge_result_payloads(
                merged,
                candidate_result,
                wanted_terms,
                candidate.get("job", {}).get("job_id"),
                [],
            )
    if not merged:
        merged = {
            "binary": "libil2cpp.so",
            "timestamp": datetime.now().isoformat(),
            "strings": {},
            "functions": {},
            "errors": [],
        }
    return _finalize_result_payload(
        merged,
        wanted_terms,
        metadata_neighborhoods,
        search_expansions,
        ascii_targets=ascii_targets,
        family_hint=family_hint,
    )


def _run_single_process_project_term(
    project_name: str,
    project_file: str,
    requested_term: str,
    timeout: int,
    max_cpu: Optional[int],
    scanned_binary: Path,
) -> Optional[dict[str, Any]]:
    search_strings = [requested_term]
    metadata_neighborhoods = (
        _scan_metadata_neighborhoods(scanned_binary, search_strings)
        if scanned_binary.exists()
        else {}
    )
    search_expansions = _derive_search_expansions(search_strings, metadata_neighborhoods)
    analysis_terms = _build_analysis_terms(
        search_strings,
        search_expansions.get("nativeSearchTerms", []),
    )
    script_name = "CiFiTierAnalysisPy.py"
    _sync_jython_script(script_name)

    job_id, job_dir = _make_job_dir("process")
    output_file = job_dir / "results.json"
    marker_file = job_dir / "results.done"
    log_file = job_dir / "headless.log"

    cmd = [
        str(ANALYZE_HEADLESS),
        str(PROJECT_DIR),
        project_name,
        "-process",
        project_file,
        "-readOnly",
        "-noanalysis",
        "-postScript",
        script_name,
        str(output_file),
        str(marker_file),
    ]
    cmd.extend(analysis_terms)
    if max_cpu:
        cmd.extend(["-max-cpu", str(max_cpu)])

    try:
        proc = _run_headless_command(cmd, timeout, log_file)
    except subprocess.TimeoutExpired as exc:
        timeout_output = (exc.stdout or "") if isinstance(exc.stdout, str) else ""
        if timeout_output:
            log_file.write_text(timeout_output, encoding="utf-8")
        job_info = {
            "job_id": job_id,
            "mode": "process-project",
            "project_name": project_name,
            "project_file": project_file,
            "timeout": timeout,
            "max_cpu": max_cpu,
            "search_strings": search_strings,
            "expanded_search_strings": analysis_terms,
            "executed_search_strings": analysis_terms,
            "output_file": str(output_file),
            "marker_file": str(marker_file),
            "log_file": str(log_file),
            "start_time": datetime.now().isoformat(),
            "status": "failed",
            "single_term": True,
            "error": "timeout after {} seconds".format(timeout),
        }
        written = _write_job_info(job_dir, job_info)
        return {
            "job": written,
            "result": {
                "binary": project_file,
                "timestamp": datetime.now().isoformat(),
                "strings": {},
                "functions": {},
                "errors": ["timeout after {} seconds".format(timeout)],
            },
            "terms": search_strings,
        }
    except RuntimeError as exc:
        print("ERROR: {}".format(exc))
        return None

    fresh_result = _load_json(output_file) or {
        "binary": project_file,
        "timestamp": datetime.now().isoformat(),
        "strings": {},
        "functions": {},
        "errors": [],
    }
    marker_exists = marker_file.exists()
    status = "completed" if proc.returncode == 0 and marker_exists else "failed"
    error = None if status == "completed" else _extract_error(proc.stdout)

    fresh_result["headless"] = {
        "status": status,
        "analyze": False,
        "returncode": proc.returncode,
        "log_file": str(log_file),
        "script": script_name,
        "project_name": project_name,
        "project_file": project_file,
        "mode": "process-project",
    }
    ascii_targets = _scan_ascii_targets(scanned_binary, search_strings) if scanned_binary.exists() else {}
    fresh_result = _finalize_result_payload(
        fresh_result,
        search_strings,
        metadata_neighborhoods,
        search_expansions,
        ascii_targets=ascii_targets,
    )
    if error:
        fresh_result.setdefault("errors", []).append(error)

    output_file.write_text(json.dumps(fresh_result, indent=2), encoding="utf-8")
    shutil.copy(output_file, CACHE_DIR / "{}_results.json".format(job_id))

    job_info = {
        "job_id": job_id,
        "mode": "process-project",
        "project_name": project_name,
        "project_file": project_file,
        "timeout": timeout,
        "max_cpu": max_cpu,
        "search_strings": search_strings,
        "expanded_search_strings": analysis_terms,
        "executed_search_strings": analysis_terms,
        "output_file": str(output_file),
        "marker_file": str(marker_file),
        "log_file": str(log_file),
        "start_time": datetime.now().isoformat(),
        "status": status,
        "single_term": True,
    }
    if error:
        job_info["error"] = error
    written = _write_job_info(job_dir, job_info)
    if written.get("status") == "completed":
        _rebuild_cache_views()
        prune_ghidra_artifacts()
    return {
        "job": written,
        "result": fresh_result,
        "terms": search_strings,
    }


def _run_headless_command(
    command: list[str],
    timeout: int,
    log_file: Path,
) -> subprocess.CompletedProcess[str]:
    java_home = get_java_home()
    if not java_home:
        raise RuntimeError("JDK not found at {}".format(JDK_ROOT))

    env = os.environ.copy()
    runtime_dirs = get_ghidra_runtime_env_dirs()
    env["JAVA_HOME"] = java_home
    env["PATH"] = "{};{}".format(JDK_ROOT / "bin", env.get("PATH", ""))
    env["APPDATA"] = str(runtime_dirs["roaming"])
    env["LOCALAPPDATA"] = str(runtime_dirs["local"])
    env["TEMP"] = str(runtime_dirs["temp"])
    env["TMP"] = str(runtime_dirs["temp"])
    env["GHIDRA_SETTINGS_DIR"] = str(runtime_dirs["settings"])
    env["GHIDRA_CACHE_DIR"] = str(runtime_dirs["cache"])
    java_tool_options = env.get("JAVA_TOOL_OPTIONS", "").strip()
    ghidra_vmargs = [
        '-Dapplication.settingsdir="{}"'.format(runtime_dirs["settings"]),
        '-Dapplication.cachedir="{}"'.format(runtime_dirs["cache"]),
        '-Dapplication.tempdir="{}"'.format(runtime_dirs["temp"]),
        '-Djava.io.tmpdir="{}"'.format(runtime_dirs["temp"]),
        "-Xmx{}g".format(_default_java_heap_gb()),
    ]
    env["JAVA_TOOL_OPTIONS"] = "{} {}".format(java_tool_options, " ".join(ghidra_vmargs)).strip()

    proc = subprocess.run(
        command,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=max(timeout + 30, 60),
        check=False,
    )
    log_file.write_text(proc.stdout, encoding="utf-8")
    return proc


def _write_job_info(job_dir: Path, job_info: dict) -> dict:
    normalized = dict(job_info)
    normalized["signature"] = _term_signature(normalized.get("search_strings", []))
    normalized["job_file"] = str(job_dir / "job.json")
    normalized = _sync_job_file(normalized)
    _get_cache_db().upsert_job(normalized)
    return normalized


def _read_job_info(job_dir: Path) -> dict:
    existing = _load_json(job_dir / "job.json")
    if existing:
        return existing
    return {}


def run_analysis(binary_path: str, search_strings: list[str], timeout: int = 600, analyze: bool = False) -> Optional[dict]:
    ensure_dirs()
    search_strings = normalize_search_terms(search_strings)

    binary = Path(binary_path)
    if not binary.is_absolute():
        binary = (ROOT / binary).resolve()
    if not binary.exists():
        print("ERROR: binary not found at {}".format(binary))
        return None

    metadata_neighborhoods = _scan_metadata_neighborhoods(binary, search_strings)
    search_expansions = _derive_search_expansions(search_strings, metadata_neighborhoods)
    analysis_terms = _build_analysis_terms(
        search_strings,
        search_expansions.get("nativeSearchTerms", []),
    )

    job_id, job_dir = _make_job_dir("run")
    output_file = job_dir / "results.json"
    marker_file = job_dir / "results.done"
    log_file = job_dir / "headless.log"
    script_name = "CiFiTierAnalysisPy.py"
    _sync_jython_script(script_name)

    cmd = [
        str(ANALYZE_HEADLESS),
        str(PROJECT_DIR),
        job_id,
        "-import",
        str(binary),
        "-postScript",
        script_name,
        str(output_file),
        str(marker_file),
    ]
    cmd.extend(analysis_terms)
    if not analyze:
        cmd.append("-noanalysis")
    else:
        cmd.extend(["-analysisTimeoutPerFile", str(timeout)])

    try:
        proc = _run_headless_command(cmd, timeout, log_file)
    except RuntimeError as exc:
        print("ERROR: {}".format(exc))
        return None

    result_data = _load_json(output_file)
    marker_exists = marker_file.exists()
    status = "completed" if proc.returncode == 0 and result_data and marker_exists else "failed"
    error = None if status == "completed" else _extract_error(proc.stdout)

    if result_data is None:
        result_data = {
            "binary": str(binary),
            "timestamp": datetime.now().isoformat(),
            "strings": {},
            "functions": {},
            "errors": [],
        }

    result_data["ascii_targets"] = _scan_ascii_targets(binary, search_strings)
    result_data["metadataNeighborhoods"] = metadata_neighborhoods
    result_data["schemaVersion"] = NATIVE_TRACE_SCHEMA_VERSION
    _enrich_term_bridges(
        result_data,
        search_strings,
        result_data.get("ascii_targets", {}),
        result_data.get("metadataNeighborhoods", {}),
        search_expansions,
    )
    result_data["managedReconstruction"] = _build_managed_reconstruction(
        search_strings,
        result_data.get("termBridges", {}),
    )
    result_data["headless"] = {
        "status": status,
        "analyze": analyze,
        "returncode": proc.returncode,
        "log_file": str(log_file),
        "script": script_name,
    }
    if error:
        result_data.setdefault("errors", []).append(error)

    output_file.write_text(json.dumps(result_data, indent=2), encoding="utf-8")
    shutil.copy(output_file, CACHE_DIR / "{}_results.json".format(job_id))

    job_info = {
        "job_id": job_id,
        "binary": str(binary),
        "timeout": timeout,
        "analyze": analyze,
        "search_strings": search_strings,
        "expanded_search_strings": analysis_terms,
        "output_file": str(output_file),
        "marker_file": str(marker_file),
        "log_file": str(log_file),
        "start_time": datetime.now().isoformat(),
        "status": status,
    }
    if error:
        job_info["error"] = error
    written = _write_job_info(job_dir, job_info)
    if written.get("status") == "completed":
        _rebuild_cache_views()
        prune_ghidra_artifacts()
    return written


def build_project(
    project_name: str,
    binary_path: str,
    search_strings: list[str],
    timeout: int,
    max_cpu: Optional[int] = None,
    job_id_override: Optional[str] = None,
) -> Optional[dict]:
    ensure_dirs()
    search_strings = normalize_search_terms(search_strings)

    binary = Path(binary_path)
    if not binary.is_absolute():
        binary = (ROOT / binary).resolve()
    if not binary.exists():
        print("ERROR: binary not found at {}".format(binary))
        return None

    metadata_neighborhoods = _scan_metadata_neighborhoods(binary, search_strings)
    search_expansions = _derive_search_expansions(search_strings, metadata_neighborhoods)
    analysis_terms = _build_analysis_terms(
        search_strings,
        search_expansions.get("nativeSearchTerms", []),
    )

    script_name = "CiFiTierAnalysisPy.py"
    _sync_jython_script(script_name)

    job_id, job_dir = _make_job_dir("build", job_id_override)
    output_file = job_dir / "results.json"
    marker_file = job_dir / "results.done"
    log_file = job_dir / "headless.log"

    initial_job_info = _read_job_info(job_dir)
    initial_job_info.update(
        {
            "job_id": job_id,
            "mode": "build-project",
            "project_name": project_name,
            "binary": str(binary),
            "timeout": timeout,
            "max_cpu": max_cpu,
            "search_strings": search_strings,
            "expanded_search_strings": analysis_terms,
            "output_file": str(output_file),
            "marker_file": str(marker_file),
            "log_file": str(log_file),
            "start_time": initial_job_info.get("start_time", datetime.now().isoformat()),
            "status": "running",
        }
    )
    _write_job_info(job_dir, initial_job_info)

    cmd = [
        str(ANALYZE_HEADLESS),
        str(PROJECT_DIR),
        project_name,
        "-import",
        str(binary),
        "-overwrite",
        "-analysisTimeoutPerFile",
        str(timeout),
        "-postScript",
        script_name,
        str(output_file),
        str(marker_file),
    ]
    cmd.extend(analysis_terms)
    if max_cpu:
        cmd.extend(["-max-cpu", str(max_cpu)])

    try:
        proc = _run_headless_command(cmd, timeout, log_file)
    except RuntimeError as exc:
        print("ERROR: {}".format(exc))
        return None

    result_data = _load_json(output_file) or {
        "binary": str(binary),
        "timestamp": datetime.now().isoformat(),
        "strings": {},
        "functions": {},
        "errors": [],
    }
    marker_exists = marker_file.exists()
    status = "completed" if proc.returncode == 0 and marker_exists else "failed"
    error = None if status == "completed" else _extract_error(proc.stdout)

    result_data["ascii_targets"] = result_data.get("ascii_targets") or _scan_ascii_targets(binary, search_strings)
    result_data["metadataNeighborhoods"] = result_data.get("metadataNeighborhoods") or metadata_neighborhoods
    result_data["schemaVersion"] = NATIVE_TRACE_SCHEMA_VERSION
    _enrich_term_bridges(
        result_data,
        search_strings,
        result_data.get("ascii_targets", {}),
        result_data.get("metadataNeighborhoods", {}),
        search_expansions,
    )
    result_data["managedReconstruction"] = _build_managed_reconstruction(
        search_strings,
        result_data.get("termBridges", {}),
    )
    result_data["headless"] = {
        "status": status,
        "analyze": True,
        "returncode": proc.returncode,
        "log_file": str(log_file),
        "script": script_name,
        "project_name": project_name,
        "mode": "build-project",
    }
    if error:
        result_data.setdefault("errors", []).append(error)

    output_file.write_text(json.dumps(result_data, indent=2), encoding="utf-8")
    shutil.copy(output_file, CACHE_DIR / "{}_results.json".format(job_id))

    job_info = _read_job_info(job_dir)
    job_info.update(
        {
            "job_id": job_id,
            "mode": "build-project",
            "project_name": project_name,
            "binary": str(binary),
            "timeout": timeout,
            "max_cpu": max_cpu,
            "search_strings": search_strings,
            "expanded_search_strings": analysis_terms,
            "output_file": str(output_file),
            "marker_file": str(marker_file),
            "log_file": str(log_file),
            "start_time": job_info.get("start_time", datetime.now().isoformat()),
            "status": status,
        }
    )
    if error:
        job_info["error"] = error

    written = _write_job_info(job_dir, job_info)
    if written.get("status") == "completed":
        _rebuild_cache_views()
        prune_ghidra_artifacts()
    return written


def launch_build_project(project_name: str, binary_path: str, search_strings: list[str], timeout: int, max_cpu: Optional[int] = None) -> dict:
    ensure_dirs()
    search_strings = normalize_search_terms(search_strings)

    job_id, job_dir = _make_job_dir("build")
    launcher_log = job_dir / "launcher.log"
    binary = Path(binary_path)
    if not binary.is_absolute():
        binary = (ROOT / binary).resolve()

    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "build-project",
        project_name,
        str(binary),
        "--timeout",
        str(timeout),
        "--job-id",
        job_id,
    ]
    if max_cpu:
        command.extend(["--max-cpu", str(max_cpu)])
    if search_strings:
        command.extend(["--search", ",".join(search_strings)])

    creationflags = 0
    if sys.platform == "win32":
        creationflags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP

    with launcher_log.open("w", encoding="utf-8") as log_handle:
        proc = subprocess.Popen(
            command,
            cwd=str(ROOT),
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            text=True,
            creationflags=creationflags,
            close_fds=True,
        )

    job_info = {
        "job_id": job_id,
        "mode": "build-project",
        "project_name": project_name,
        "binary": str(binary),
        "timeout": timeout,
        "max_cpu": max_cpu,
        "search_strings": search_strings,
        "output_file": str(job_dir / "results.json"),
        "marker_file": str(job_dir / "results.done"),
        "log_file": str(job_dir / "headless.log"),
        "launcher_log": str(launcher_log),
        "launcher_pid": proc.pid,
        "start_time": datetime.now().isoformat(),
        "status": "running",
    }
    _write_job_info(job_dir, job_info)
    return job_info


def process_project(project_name: str, project_file: str, search_strings: list[str], timeout: int, max_cpu: Optional[int] = None) -> Optional[dict]:
    ensure_dirs()
    search_strings = normalize_search_terms(search_strings)
    scanned_binary = (ROOT / "workbench" / "apk" / "base" / project_file).resolve()
    metadata_neighborhoods = (
        _scan_metadata_neighborhoods(scanned_binary, search_strings)
        if scanned_binary.exists()
        else {}
    )
    search_expansions = _derive_search_expansions(search_strings, metadata_neighborhoods)
    analysis_terms = _build_analysis_terms(
        search_strings,
        search_expansions.get("nativeSearchTerms", []),
    )

    exact_cached = _choose_cached_process_subset(project_name, project_file, search_strings)
    if exact_cached and not _process_result_is_stale(exact_cached.get("result"), search_strings):
        cached_job = dict(exact_cached["job"])
        cached_job["requested_search_strings"] = search_strings
        cached_job["expanded_search_strings"] = analysis_terms
        cached_job["cache_hit"] = True
        cached_job["cache_mode"] = "exact"
        cached_job["reused_job_id"] = exact_cached["job"].get("job_id")
        cached_job["missing_terms"] = []
        cached_job["per_term_jobs"] = [exact_cached["job"].get("job_id")]
        return cached_job

    cached_term_hits, missing_terms = _choose_cached_process_term_jobs(project_name, project_file, search_strings)
    graph_term_hits, missing_terms, graph_links_by_term = _choose_graph_backfill_candidates(
        project_name,
        project_file,
        missing_terms,
        cached_term_hits,
    )
    successful_candidates = [*cached_term_hits, *graph_term_hits]
    failed_terms: list[str] = []
    executed_terms: list[str] = []

    for term in missing_terms:
        executed_terms.append(term)
        candidate = _run_single_process_project_term(
            project_name,
            project_file,
            term,
            timeout,
            max_cpu,
            scanned_binary,
        )
        if not candidate or candidate.get("job", {}).get("status") != "completed":
            failed_terms.append(term)
            continue
        successful_candidates.append(candidate)

    if not successful_candidates:
        job_id, job_dir = _make_job_dir("process")
        output_file = job_dir / "results.json"
        marker_file = job_dir / "results.done"
        log_file = job_dir / "headless.log"
        result_data = _finalize_result_payload(
            {
                "binary": project_file,
                "timestamp": datetime.now().isoformat(),
                "strings": {},
                "functions": {},
                "errors": ["No individual process-project term jobs completed."],
            },
            search_strings,
            metadata_neighborhoods,
            search_expansions,
            ascii_targets=_scan_ascii_targets(scanned_binary, search_strings) if scanned_binary.exists() else {},
        )
        output_file.write_text(json.dumps(result_data, indent=2), encoding="utf-8")
        job_info = {
            "job_id": job_id,
            "mode": "process-project",
            "project_name": project_name,
            "project_file": project_file,
            "timeout": timeout,
            "max_cpu": max_cpu,
            "search_strings": search_strings,
            "expanded_search_strings": analysis_terms,
            "executed_search_strings": executed_terms,
            "completed_terms": [],
            "failed_terms": failed_terms,
            "per_term_jobs": [],
            "output_file": str(output_file),
            "marker_file": str(marker_file),
            "log_file": str(log_file),
            "start_time": datetime.now().isoformat(),
            "status": "failed",
            "cache_mode": "per-term",
        }
        return _write_job_info(job_dir, job_info)

    job_id, job_dir = _make_job_dir("process")
    output_file = job_dir / "results.json"
    marker_file = job_dir / "results.done"
    log_file = job_dir / "headless.log"
    result_data = _merge_candidate_results(
        successful_candidates,
        search_strings,
        metadata_neighborhoods,
        search_expansions,
        ascii_targets=_scan_ascii_targets(scanned_binary, search_strings) if scanned_binary.exists() else {},
    )
    status = "completed" if not failed_terms else "partial"
    if graph_links_by_term:
        result_data["graphBackfill"] = {
            "terms": sorted(graph_links_by_term.keys()),
            "linksByTerm": graph_links_by_term,
        }
    result_data["headless"] = {
        "status": status,
        "analyze": False,
        "returncode": 0,
        "log_file": str(log_file),
        "script": "CiFiTierAnalysisPy.py",
        "project_name": project_name,
        "project_file": project_file,
        "mode": "process-project",
        "executionModel": "per-term-merge",
    }
    if failed_terms:
        result_data.setdefault("errors", []).append(
            "Per-term native jobs failed for: {}".format(", ".join(failed_terms))
        )
    output_file.write_text(json.dumps(result_data, indent=2), encoding="utf-8")
    shutil.copy(output_file, CACHE_DIR / "{}_results.json".format(job_id))
    marker_file.write_text("merged\n", encoding="utf-8")

    reused_job_ids = [candidate.get("job", {}).get("job_id") for candidate in cached_term_hits if candidate.get("job", {}).get("job_id")]
    graph_reused_job_ids = [candidate.get("job", {}).get("job_id") for candidate in graph_term_hits if candidate.get("job", {}).get("job_id")]
    per_term_job_ids = [candidate.get("job", {}).get("job_id") for candidate in successful_candidates if candidate.get("job", {}).get("job_id")]
    job_info = {
        "job_id": job_id,
        "mode": "process-project",
        "project_name": project_name,
        "project_file": project_file,
        "timeout": timeout,
        "max_cpu": max_cpu,
        "search_strings": search_strings,
        "expanded_search_strings": analysis_terms,
        "executed_search_strings": executed_terms,
        "completed_terms": [candidate.get("terms", [""])[0] for candidate in successful_candidates if candidate.get("terms")],
        "failed_terms": failed_terms,
        "per_term_jobs": per_term_job_ids,
        "graph_backfilled_terms": sorted(graph_links_by_term.keys()),
        "output_file": str(output_file),
        "marker_file": str(marker_file),
        "log_file": str(log_file),
        "start_time": datetime.now().isoformat(),
        "status": status,
        "cache_mode": "per-term+graph" if graph_links_by_term else "per-term",
    }
    if reused_job_ids:
        job_info["reused_job_id"] = reused_job_ids[0]
        job_info["reused_job_ids"] = reused_job_ids
    if graph_reused_job_ids:
        job_info["graph_reused_job_ids"] = graph_reused_job_ids

    written = _write_job_info(job_dir, job_info)
    _rebuild_cache_views()
    prune_ghidra_artifacts()
    return written


def poll_job(job_id: str) -> Optional[dict]:
    job_file = JOBS_DIR / job_id / "job.json"
    if not job_file.exists():
        print("Job {} not found".format(job_id))
        return None
    return _load_json(job_file)


def cache_results(job_info: dict) -> Optional[Path]:
    output_file = Path(job_info["output_file"])
    if not output_file.exists():
        return None
    cache_file = CACHE_DIR / "{}_results.json".format(job_info["job_id"])
    shutil.copy(output_file, cache_file)
    return cache_file


def query_cache(query: str) -> list[dict]:
    results = []
    lowered = query.lower()
    for cache_file in CACHE_DIR.glob("*_results.json"):
        data = _load_json(cache_file)
        if not data:
            continue

        matches = {"file": str(cache_file), "strings": {}, "functions": {}}
        for term, refs in data.get("strings", {}).items():
            if lowered in term.lower():
                matches["strings"][term] = refs
        for func_name, func_data in data.get("functions", {}).items():
            if lowered in func_name.lower():
                matches["functions"][func_name] = func_data
        if matches["strings"] or matches["functions"]:
            results.append(matches)
    return results


def get_status() -> None:
    if not JOBS_DIR.exists():
        print("No jobs found")
        return

    jobs = []
    for directory in JOBS_DIR.iterdir():
        if directory.is_dir():
            job = _load_json(directory / "job.json")
            if job:
                jobs.append(job)

    for job in sorted(jobs, key=lambda item: item.get("start_time", ""), reverse=True):
        print("Job: {}".format(job["job_id"]))
        print("  Status: {}".format(job["status"]))
        print("  Analyze: {}".format(job.get("analyze", False)))
        print("  Binary: {}".format(job.get("binary", "N/A")))
        print("  Started: {}".format(job.get("start_time", "N/A")))
        if job.get("error"):
            print("  Error: {}".format(job["error"]))
        print()


def rebuild_cache_db(stages: list[str] | None = None) -> dict[str, Any]:
    db = _get_cache_db()
    rebuild = _refresh_runtime_state(stages)
    process_index = rebuild["processIndex"]
    native_graph_index = rebuild["nativeGraphIndex"]
    summary = {
        "database": str(CACHE_DB_FILE),
        "stagesRun": rebuild["stagesRun"],
        "processProjectEntries": sum(
            len(project_files)
            for projects in process_index.get("jobsByProject", {}).values()
            for project_files in projects.values()
        ),
        "nativeProjects": len(native_graph_index.get("projects", {})),
    }
    summary.update(db.get_stats())
    return summary


def reclaim_expired_jobs() -> dict[str, Any]:
    db = _get_cache_db()
    reclaimed = db.reclaim_expired_running_jobs()
    synced: list[str] = []
    for job_id in reclaimed:
        job = db.get_job(job_id)
        if not job:
            continue
        _sync_job_file(job)
        synced.append(job_id)
    if reclaimed:
        _refresh_runtime_state()
    return {"database": str(CACHE_DB_FILE), "reclaimedJobIds": synced}


def invalidate_cached_jobs(
    job_id: str | None = None,
    term: str | None = None,
    schema_lt: int | None = None,
    aspect_kind: str | None = None,
    script_name: str | None = None,
    producer_version: str | None = None,
    trace_scope: str | None = None,
    trace_fragment: str | None = None,
) -> dict[str, Any]:
    db = _get_cache_db()
    invalidated_jobs: list[str] = []
    invalidated_evidence: list[int] = []
    invalidated_trace_fragments: list[int] = []
    if aspect_kind or script_name or producer_version:
        invalidated_evidence = db.invalidate_evidence(
            term=term,
            aspect_kind=aspect_kind,
            source_job_id=job_id,
            script_name=script_name,
            producer_version=producer_version,
            schema_lt=schema_lt,
        )
    elif trace_scope or trace_fragment:
        invalidated_trace_fragments = db.invalidate_trace_fragments(
            trace_scope=trace_scope,
            fragment_kind=trace_fragment,
            source_job_id=job_id,
        )
    else:
        invalidated_jobs = db.invalidate_jobs(
            job_id=job_id,
            term=term,
            schema_lt=schema_lt,
            result_loader=_load_result_for_job,
        )
    synced: list[str] = []
    for current_job_id in invalidated_jobs:
        job = db.get_job(current_job_id)
        if not job:
            continue
        _sync_job_file(job)
        synced.append(current_job_id)
    if invalidated_jobs or invalidated_evidence or invalidated_trace_fragments:
        _refresh_runtime_state()
    return {
        "database": str(CACHE_DB_FILE),
        "invalidatedJobIds": synced,
        "invalidatedEvidenceIds": invalidated_evidence,
        "invalidatedTraceFragmentIds": invalidated_trace_fragments,
    }


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1]

    if command == "run":
        if len(sys.argv) < 3:
            print("Usage: ghidra_headless.py run <binary> [--search str1,str2] [--timeout sec] [--analyze]")
            sys.exit(1)

        binary = sys.argv[2]
        search_strings = list(DEFAULT_SEARCH)
        timeout = DEFAULT_RUN_TIMEOUT
        analyze = False

        i = 3
        while i < len(sys.argv):
            if sys.argv[i] == "--search" and i + 1 < len(sys.argv):
                search_strings = [item for item in sys.argv[i + 1].split(",") if item]
                i += 2
            elif sys.argv[i] == "--timeout" and i + 1 < len(sys.argv):
                timeout = int(sys.argv[i + 1])
                i += 2
            elif sys.argv[i] == "--analyze":
                analyze = True
                i += 1
            else:
                i += 1

        job_info = run_analysis(binary, search_strings, timeout, analyze)
        print(json.dumps(job_info, indent=2))
        return

    if command == "build-project":
        if len(sys.argv) < 4:
            print("Usage: ghidra_headless.py build-project <project_name> <binary> [--search str1,str2] [--timeout sec] [--max-cpu N]")
            sys.exit(1)

        project_name = sys.argv[2]
        binary = sys.argv[3]
        search_strings = list(DEFAULT_SEARCH)
        timeout = DEFAULT_BUILD_TIMEOUT
        max_cpu = _default_max_cpu()
        job_id_override = None

        i = 4
        while i < len(sys.argv):
            if sys.argv[i] == "--search" and i + 1 < len(sys.argv):
                search_strings = [item for item in sys.argv[i + 1].split(",") if item]
                i += 2
            elif sys.argv[i] == "--timeout" and i + 1 < len(sys.argv):
                timeout = int(sys.argv[i + 1])
                i += 2
            elif sys.argv[i] == "--max-cpu" and i + 1 < len(sys.argv):
                max_cpu = int(sys.argv[i + 1])
                i += 2
            elif sys.argv[i] == "--job-id" and i + 1 < len(sys.argv):
                job_id_override = sys.argv[i + 1]
                i += 2
            else:
                i += 1

        job_info = build_project(project_name, binary, search_strings, timeout, max_cpu, job_id_override)
        print(json.dumps(job_info, indent=2))
        return

    if command == "launch-build-project":
        if len(sys.argv) < 4:
            print("Usage: ghidra_headless.py launch-build-project <project_name> <binary> [--search str1,str2] [--timeout sec] [--max-cpu N]")
            sys.exit(1)

        project_name = sys.argv[2]
        binary = sys.argv[3]
        search_strings = list(DEFAULT_SEARCH)
        timeout = DEFAULT_BUILD_TIMEOUT
        max_cpu = _default_max_cpu()

        i = 4
        while i < len(sys.argv):
            if sys.argv[i] == "--search" and i + 1 < len(sys.argv):
                search_strings = [item for item in sys.argv[i + 1].split(",") if item]
                i += 2
            elif sys.argv[i] == "--timeout" and i + 1 < len(sys.argv):
                timeout = int(sys.argv[i + 1])
                i += 2
            elif sys.argv[i] == "--max-cpu" and i + 1 < len(sys.argv):
                max_cpu = int(sys.argv[i + 1])
                i += 2
            else:
                i += 1

        job_info = launch_build_project(project_name, binary, search_strings, timeout, max_cpu)
        print(json.dumps(job_info, indent=2))
        return

    if command == "process-project":
        if len(sys.argv) < 3:
            print("Usage: ghidra_headless.py process-project <project_name> [project_file] [--search str1,str2] [--timeout sec] [--max-cpu N]")
            sys.exit(1)

        project_name = sys.argv[2]
        project_file = "libil2cpp.so"
        search_strings = list(DEFAULT_SEARCH)
        timeout = DEFAULT_PROCESS_TIMEOUT
        max_cpu = _default_max_cpu()

        i = 3
        if i < len(sys.argv) and not sys.argv[i].startswith("--"):
            project_file = sys.argv[i]
            i += 1

        while i < len(sys.argv):
            if sys.argv[i] == "--search" and i + 1 < len(sys.argv):
                search_strings = [item for item in sys.argv[i + 1].split(",") if item]
                i += 2
            elif sys.argv[i] == "--timeout" and i + 1 < len(sys.argv):
                timeout = int(sys.argv[i + 1])
                i += 2
            elif sys.argv[i] == "--max-cpu" and i + 1 < len(sys.argv):
                max_cpu = int(sys.argv[i + 1])
                i += 2
            else:
                i += 1

        job_info = process_project(project_name, project_file, search_strings, timeout, max_cpu)
        print(json.dumps(job_info, indent=2))
        return

    if command == "poll":
        if len(sys.argv) < 3:
            print("Usage: ghidra_headless.py poll <job_id>")
            sys.exit(1)
        print(json.dumps(poll_job(sys.argv[2]), indent=2))
        return

    if command == "status":
        get_status()
        return

    if command == "cache":
        if len(sys.argv) < 3:
            print("Usage: ghidra_headless.py cache <job_id> [--query string]")
            sys.exit(1)

        job_info = poll_job(sys.argv[2])
        if not job_info or job_info.get("status") != "completed":
            print("Job not completed or not found")
            return

        cache_file = cache_results(job_info)
        print("Cached: {}".format(cache_file))

        if len(sys.argv) > 4 and sys.argv[3] == "--query":
            results = query_cache(sys.argv[4])
            print("Query results:")
            print(json.dumps(results, indent=2))
        return

    if command == "rebuild-cache-db":
        stages: list[str] = []
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == "--stage" and i + 1 < len(sys.argv):
                stages.append(sys.argv[i + 1])
                i += 2
            else:
                i += 1
        print(json.dumps(rebuild_cache_db(stages or None), indent=2))
        return

    if command == "export-process-index":
        out_path = None
        if len(sys.argv) >= 4 and sys.argv[2] == "--out":
            out_path = Path(sys.argv[3])
        print(json.dumps(export_process_index(out_path), indent=2))
        return

    if command == "export-native-graph":
        out_path = None
        if len(sys.argv) >= 4 and sys.argv[2] == "--out":
            out_path = Path(sys.argv[3])
        print(json.dumps(export_native_graph(out_path), indent=2))
        return

    if command == "reclaim":
        print(json.dumps(reclaim_expired_jobs(), indent=2))
        return

    if command == "invalidate":
        job_id = None
        term = None
        schema_lt = None
        aspect_kind = None
        script_name = None
        producer_version = None
        trace_scope = None
        trace_fragment = None
        i = 2
        while i < len(sys.argv):
            if sys.argv[i] == "--job-id" and i + 1 < len(sys.argv):
                job_id = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--term" and i + 1 < len(sys.argv):
                term = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--aspect" and i + 1 < len(sys.argv):
                aspect_kind = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--script" and i + 1 < len(sys.argv):
                script_name = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--producer-version" and i + 1 < len(sys.argv):
                producer_version = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--trace-scope" and i + 1 < len(sys.argv):
                trace_scope = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--trace-fragment" and i + 1 < len(sys.argv):
                trace_fragment = sys.argv[i + 1]
                i += 2
            elif sys.argv[i] == "--schema-lt" and i + 1 < len(sys.argv):
                schema_lt = int(sys.argv[i + 1])
                i += 2
            else:
                i += 1
        if not any(value is not None for value in (job_id, term, schema_lt, aspect_kind, script_name, producer_version, trace_scope, trace_fragment)):
            print("Usage: ghidra_headless.py invalidate [--job-id id] [--term value] [--aspect kind] [--script name] [--producer-version v] [--schema-lt N] [--trace-scope scope] [--trace-fragment kind]")
            sys.exit(1)
        print(
            json.dumps(
                invalidate_cached_jobs(
                    job_id=job_id,
                    term=term,
                    schema_lt=schema_lt,
                    aspect_kind=aspect_kind,
                    script_name=script_name,
                    producer_version=producer_version,
                    trace_scope=trace_scope,
                    trace_fragment=trace_fragment,
                ),
                indent=2,
            )
        )
        return

    print("Unknown command: {}".format(command))
    sys.exit(1)


if __name__ == "__main__":
    main()
