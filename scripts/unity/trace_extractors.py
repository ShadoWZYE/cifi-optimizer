from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from collections.abc import Iterator, Mapping
from datetime import datetime
from pathlib import Path
from typing import Any

from ghidra_cache_db import ASPECT_PRIORITIES, GhidraCacheDB
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
CACHE_DB_FILE = ROOT / "workbench" / "ghidra-cache" / "ghidra_cache.sqlite3"
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"
LEVEL0_PATH = ROOT / "workbench" / "unity" / "joined" / "level0"

TRACE_EXTRACTOR_CACHE: dict[str, Any] = {}
TRACE_CACHE_DB: GhidraCacheDB | None = None

TOKEN_SHOP_SHELL_PATTERN = "ATU"

FIELDISH_SUFFIXES = (
    "StartCost",
    "CostExponent",
    "GrowthExponent",
    "Bonus",
    "MaxLevel",
    "Level",
    "Levels",
    "Button",
    "Overlay",
    "Content",
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

UI_SLOT_MARKERS = (
    "Button",
    "Overlay",
    "Content",
    "Fill",
    "Text",
    "Title",
    "Description",
    "Desc",
    "CostText",
    "LevelText",
    "Requirement",
    "Req",
    "BonusText",
    "BonusBox",
    "BonusLayout",
    "Box",
    "Layout",
)


def get_trace_cache_db() -> GhidraCacheDB:
    global TRACE_CACHE_DB
    if TRACE_CACHE_DB is None:
        TRACE_CACHE_DB = GhidraCacheDB(CACHE_DB_FILE, GHIDRA_JOBS_DIR)
    return TRACE_CACHE_DB


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


def _normalize_bridge_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _is_ownerish_name(value: str) -> bool:
    if not value or len(value) > 80:
        return False
    if any(ch.isdigit() for ch in value):
        return False
    if "." in value or " " in value:
        return False
    if value.startswith(("get_", "set_", "<", "'", "\"", "(", "[", "{", "+", "-", "|")):
        return False
    if value.endswith(FIELDISH_SUFFIXES):
        return False
    return value[:1].isupper() and any(ch.islower() for ch in value[1:])


def _is_methodish_name(value: str) -> bool:
    if not value or len(value) > 120:
        return False
    if " " in value or value.startswith(("'", "\"", "(", "[", "{")):
        return False
    if value.startswith(("get_", "set_", "Buy", "Claim", "Update", "Count", "Sort", "Fill", "Convert")):
        return True
    return value[:1].islower() and any(ch.isupper() for ch in value[1:])


def _is_fieldish_name(value: str) -> bool:
    if not value or len(value) > 120:
        return False
    if " " in value or value.startswith(("get_", "set_", "Buy")):
        return False
    if value.endswith(FIELDISH_SUFFIXES):
        return True
    return value[:1].islower() and any(ch.isupper() for ch in value[1:])


def _is_ui_slot_like_term(value: str) -> bool:
    return any(marker in value for marker in UI_SLOT_MARKERS)


def _classify_bridge_term_kind(value: str) -> str:
    if _is_methodish_name(value):
        return "method"
    if _is_ownerish_name(value):
        return "owner"
    if _is_ui_slot_like_term(value):
        return "ui-slot"
    if _is_fieldish_name(value):
        return "field"
    return "term"


def _is_safe_native_anchor(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Za-z0-9_]+", value))


def _dedupe_terms(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        if not isinstance(value, str):
            continue
        trimmed = value.strip()
        if not trimmed:
            continue
        lowered = trimmed.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        output.append(trimmed)
    return output


def _term_overlap_score(left: str, right: str) -> int:
    left_tokens = set(_split_bridge_tokens(left))
    right_tokens = set(_split_bridge_tokens(right))
    if not left_tokens or not right_tokens:
        return 0
    overlap = left_tokens & right_tokens
    score = len(overlap) * 10
    if left.lower() == right.lower():
        score += 100
    elif left.lower() in right.lower() or right.lower() in left.lower():
        score += 20
    return score


def _collect_neighborhood_context_terms(
    metadata_neighborhoods: dict[str, Any],
    term: str,
) -> list[str]:
    context_terms: list[str] = []
    for neighborhood in metadata_neighborhoods.get(term, []):
        for context in neighborhood.get("context", []):
            value = str(context.get("string", "")).strip()
            if value and value not in context_terms:
                context_terms.append(value)
    return context_terms


def _collect_adjacent_neighborhood_terms(
    metadata_neighborhoods: dict[str, Any],
    term: str,
    radius: int = 6,
) -> list[str]:
    adjacent_terms: list[str] = []
    neighborhoods = metadata_neighborhoods.get(term, []) if isinstance(metadata_neighborhoods, dict) else []
    for neighborhood in neighborhoods:
        context = neighborhood.get("context", [])
        if not isinstance(context, list) or not context:
            continue
        context_values = [str(entry.get("string", "")).strip() for entry in context]
        match_index = next(
            (
                index for index, value in enumerate(context_values)
                if value == term or _normalize_bridge_text(term) in _normalize_bridge_text(value)
            ),
            -1,
        )
        if match_index < 0:
            continue
        left = max(0, match_index - radius)
        right = min(len(context_values), match_index + radius + 1)
        for value in context_values[left:right]:
            if value and value not in adjacent_terms:
                adjacent_terms.append(value)
    return adjacent_terms


def _get_canonical_term_view(term: str) -> dict[str, Any]:
    index = load_native_graph_index()
    return (
        index.get("projects", {})
        .get("cifi-full", {})
        .get("libil2cpp.so", {})
        .get("perTerm", {})
        .get(term, {})
        .get("canonicalTermView", {})
        or {}
    )


def _score_bridge_pivot(
    requested_term: str,
    requested_kind: str,
    candidate: str,
    candidate_kind: str,
) -> int:
    score = _term_overlap_score(requested_term, candidate)
    if candidate_kind == "owner":
        score += 20
    elif candidate_kind == "method":
        score += 24
    elif candidate_kind == "field":
        score += 14
    if requested_kind in {"field", "ui-slot"} and candidate_kind in {"owner", "method"}:
        score += 18
    if requested_kind == "owner" and candidate_kind == "method":
        score += 10
    if requested_kind == "method" and candidate_kind == "method":
        score += 12
    if requested_kind == "ui-slot" and candidate_kind == "field" and not _is_ui_slot_like_term(candidate):
        score += 14
    if candidate == requested_term:
        score += 8
    return score


def _build_generic_term_bridge_match(term: str) -> dict[str, Any]:
    canonical_view = _get_canonical_term_view(term)
    term_bridges = canonical_view.get("termBridges", {})
    bridge = term_bridges.get(term, {}) if isinstance(term_bridges, dict) else {}
    metadata_neighborhoods = canonical_view.get("metadataNeighborhoods", {})
    managed_reconstruction = canonical_view.get("managedReconstruction", {})
    managed_graph = canonical_view.get("managedGraph", {})
    search_expansion = bridge.get("searchExpansion", {}) if isinstance(bridge, dict) else {}
    context_strings = list(search_expansion.get("contextStrings", []))
    if not context_strings:
        context_strings = _collect_neighborhood_context_terms(metadata_neighborhoods, term)
    adjacent_terms = _collect_adjacent_neighborhood_terms(metadata_neighborhoods, term)

    owner_candidates = _dedupe_terms([
        *bridge.get("ownerCandidates", []),
        *managed_reconstruction.get("owners", []),
        *[
            str(owner.get("owner", ""))
            for owner in managed_reconstruction.get("scoredOwners", [])
            if isinstance(owner, dict)
        ],
    ])
    sibling_terms = _dedupe_terms([
        *[
            value for value in adjacent_terms
            if _is_fieldish_name(value) or _is_ui_slot_like_term(value)
        ],
        *bridge.get("relatedTerms", []),
        *search_expansion.get("fieldCandidates", []),
        *[
            value for value in context_strings
            if _is_fieldish_name(value) or _is_ui_slot_like_term(value)
        ],
    ])
    method_candidates = _dedupe_terms([
        *search_expansion.get("methodCandidates", []),
        *managed_reconstruction.get("methods", []),
        *[
            value for value in adjacent_terms
            if _is_methodish_name(value)
        ],
        *[
            value for value in context_strings
            if _is_methodish_name(value)
        ],
    ])

    for owner in managed_graph.get("owners", []) if isinstance(managed_graph, dict) else []:
        if not isinstance(owner, dict):
            continue
        owner_name = str(owner.get("owner", "")).strip()
        if owner_name:
            owner_candidates = _dedupe_terms([*owner_candidates, owner_name])
        method_candidates = _dedupe_terms([*method_candidates, *list(owner.get("methods", []))])
        sibling_terms = _dedupe_terms([*sibling_terms, *list(owner.get("fields", []))])

    return {
        "term": term,
        "termKind": _classify_bridge_term_kind(term),
        "bridgeKind": bridge.get("bridgeKind", "unresolved"),
        "ownerCandidates": owner_candidates,
        "siblingTerms": sibling_terms,
        "methodCandidates": method_candidates,
        "contextTerms": _dedupe_terms(context_strings),
        "adjacentTerms": adjacent_terms,
        "metadataNeighborhoodCount": len(metadata_neighborhoods.get(term, [])) if isinstance(metadata_neighborhoods, dict) else 0,
        "canonicalTermViewAvailable": bool(canonical_view),
    }


def build_generic_native_bridge_plan(
    anchor_values: list[str],
    family_hint: str | None = None,
) -> dict[str, Any]:
    requested_terms = normalize_native_search_terms(anchor_values)
    bridged_terms: list[str] = []
    native_core_terms: list[str] = []
    context_terms: list[str] = []
    matches: list[dict[str, Any]] = []
    owner_candidates: list[str] = []
    sibling_terms: list[str] = []
    method_candidates: list[str] = []

    def add_bridged(value: str) -> None:
        if value not in bridged_terms:
            bridged_terms.append(value)

    def add_native_core(value: str) -> None:
        if not _is_safe_native_anchor(value):
            return
        add_bridged(value)
        if value not in native_core_terms:
            native_core_terms.append(value)

    def add_context(value: str) -> None:
        add_bridged(value)
        if value not in context_terms:
            context_terms.append(value)

    for term in requested_terms:
        match = _build_generic_term_bridge_match(term)
        requested_kind = str(match.get("termKind", "term"))
        term_owner_candidates = [value for value in match.get("ownerCandidates", []) if _is_ownerish_name(value)]
        term_method_candidates = [value for value in match.get("methodCandidates", []) if _is_methodish_name(value)]
        term_sibling_terms = [
            value for value in match.get("siblingTerms", [])
            if _is_fieldish_name(value) or _is_ui_slot_like_term(value)
        ]
        adjacent_terms = [
            value for value in match.get("adjacentTerms", [])
            if _is_fieldish_name(value) or _is_ui_slot_like_term(value) or _is_methodish_name(value)
        ]
        term_context_terms = _dedupe_terms([
            *match.get("contextTerms", []),
            *adjacent_terms,
            *term_owner_candidates,
            *term_method_candidates,
            *term_sibling_terms,
        ])

        owner_candidates = _dedupe_terms([*owner_candidates, *term_owner_candidates])
        sibling_terms = _dedupe_terms([*sibling_terms, *term_sibling_terms])
        method_candidates = _dedupe_terms([*method_candidates, *term_method_candidates])

        selected_core_terms: list[str] = []
        selection_reasons: list[str] = []
        ranked_candidates: list[tuple[int, str, str]] = []
        for candidate in term_owner_candidates:
            ranked_candidates.append((_score_bridge_pivot(term, requested_kind, candidate, "owner"), candidate, "owner"))
        for candidate in term_method_candidates:
            ranked_candidates.append((_score_bridge_pivot(term, requested_kind, candidate, "method"), candidate, "method"))
        for candidate in term_sibling_terms:
            candidate_kind = "field" if not _is_ui_slot_like_term(candidate) else "ui-slot"
            score = _score_bridge_pivot(term, requested_kind, candidate, candidate_kind)
            if candidate in adjacent_terms:
                score += 18
            ranked_candidates.append((score, candidate, candidate_kind))
        ranked_candidates.sort(key=lambda item: (-item[0], item[1].lower()))

        if requested_kind == "method":
            selected_core_terms.append(term)
            selection_reasons.append("direct-method-anchor")
        elif requested_kind == "owner":
            selected_core_terms.append(term)
            selection_reasons.append("owner-anchor")

        for _, candidate, candidate_kind in ranked_candidates:
            if candidate in selected_core_terms:
                continue
            if requested_kind in {"field", "ui-slot"} and candidate_kind == "ui-slot":
                continue
            selected_core_terms.append(candidate)
            selection_reasons.append(f"{candidate_kind}-pivot")
            if len(selected_core_terms) >= 4:
                break

        if requested_kind in {"field", "ui-slot"} and not selected_core_terms:
            fallback_terms = [
                value for value in term_sibling_terms
                if _is_fieldish_name(value) and not _is_ui_slot_like_term(value)
            ]
            if fallback_terms:
                selected_core_terms.extend(fallback_terms[:2])
                selection_reasons.append("sibling-field-fallback")

        if not selected_core_terms:
            selected_core_terms.append(term)
            selection_reasons.append("direct-term-fallback")

        for value in selected_core_terms:
            add_native_core(value)
        for value in term_context_terms:
            add_context(value)
        add_context(term)

        matches.append(
            {
                **match,
                "selectedNativeCoreTerms": selected_core_terms,
                "selectedContextTerms": term_context_terms[:16],
                "selectionReasons": selection_reasons,
            }
        )

    second_stage_terms = normalize_native_search_terms([
        *native_core_terms,
        *owner_candidates,
        *method_candidates,
        *[
            value for value in sibling_terms
            if _is_fieldish_name(value) and not _is_ui_slot_like_term(value)
        ],
    ])

    return {
        "familyHint": family_hint,
        "strategy": "generic-metadata-native-bridge",
        "requestedTerms": requested_terms,
        "bridgedTerms": bridged_terms,
        "nativeCoreTerms": native_core_terms,
        "contextTerms": context_terms,
        "matches": matches,
        "ownerCandidates": owner_candidates[:24],
        "siblingTerms": sibling_terms[:24],
        "methodCandidates": method_candidates[:24],
        "secondStageTerms": second_stage_terms,
        "source": {
            "database": str(CACHE_DB_FILE),
            "canonicalView": "native_graph_index",
        },
    }


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
        "strategy": "token-shop-bridge",
        "requestedTerms": normalized_terms,
        "bridgedTerms": bridged_terms,
        "nativeCoreTerms": native_core_terms,
        "contextTerms": context_terms,
        "ownerCandidates": [],
        "siblingTerms": [],
        "methodCandidates": [],
        "secondStageTerms": normalize_native_search_terms([*native_core_terms, *context_terms]),
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
    data = get_trace_cache_db().export_process_index()
    if not isinstance(data, dict):
        return None
    return data


def load_native_graph_index() -> dict[str, Any]:
    data = get_trace_cache_db().export_native_graph_index()
    if not isinstance(data, dict):
        return {"version": 1, "projects": {}}
    if "projects" not in data or not isinstance(data.get("projects"), dict):
        data["projects"] = {}
    return data


def write_native_graph_index(index: dict[str, Any]) -> None:
    raise RuntimeError("write_native_graph_index is no longer a runtime path; use DB-backed semantic scope persistence or an explicit export command")


def get_semantic_scope(
    scope_id: str,
    project: str = "cifi-full",
    project_file: str = "libil2cpp.so",
) -> dict[str, Any] | None:
    view = get_trace_cache_db().find_canonical_semantic_fragment(project, project_file, "semantic_scope_fragment", scope_id)
    if not view:
        return None
    return dict(view.get("payload") or {})


def upsert_semantic_scope(
    scope_id: str,
    scope_payload: dict[str, Any],
    project: str = "cifi-full",
    project_file: str = "libil2cpp.so",
) -> None:
    get_trace_cache_db().upsert_semantic_scope_fragment(project, project_file, scope_id, scope_payload)


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
        "requestedTerms": wanted_terms,
        "searchTerms": wanted_terms,
        "returncode": 0,
        "status": job_info.get("status", "completed"),
        "jobId": job_info.get("job_id"),
        "job": job_info,
        "result": result,
        "summary": _summarize_native_result(result, wanted_terms, family_hint),
        "cacheHit": True,
    }


def build_native_trace_request_signature(
    requested_terms: list[str],
    search_terms: list[str],
    family_hint: str | None,
) -> str:
    payload = {
        "requestedTerms": sorted(set(requested_terms)),
        "searchTerms": sorted(set(search_terms)),
        "familyHint": family_hint,
    }
    return hashlib.sha1(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()[:16]


def _native_result_has_signal(result_payload: dict[str, Any] | None) -> bool:
    if not isinstance(result_payload, dict):
        return False
    for bucket_name in ("functions", "fuzzyFunctions", "referenceFunctions"):
        bucket = result_payload.get(bucket_name, {})
        if not isinstance(bucket, dict):
            continue
        for values in bucket.values():
            if isinstance(values, list) and values:
                return True
    term_bridges = result_payload.get("termBridges", {})
    if isinstance(term_bridges, dict):
        for bridge in term_bridges.values():
            if not isinstance(bridge, dict):
                continue
            if bridge.get("bridgeKind") in {
                "string-xref-bridge",
                "native-symbol-match",
                "token-bridge",
                "managed-expansion-bridge",
            }:
                return True
    return False


def plan_native_trace_extraction(
    anchor_values: list[str],
    family_hint: str | None = None,
) -> dict[str, Any]:
    requested_terms = normalize_native_search_terms(anchor_values)
    if family_hint == "token-shop":
        bridge_plan = build_token_shop_native_bridge_plan(requested_terms)
    else:
        bridge_plan = build_generic_native_bridge_plan(requested_terms, family_hint=family_hint)
    search_terms = normalize_native_search_terms(bridge_plan.get("nativeCoreTerms", []))
    if not search_terms:
        search_terms = requested_terms
    fallback_terms = normalize_native_search_terms(bridge_plan.get("secondStageTerms", []))
    fallback_terms = [term for term in fallback_terms if term.lower() not in {value.lower() for value in search_terms}]
    request_signature = build_native_trace_request_signature(requested_terms, search_terms, family_hint)
    return {
        "requestedTerms": requested_terms,
        "bridgePlan": bridge_plan,
        "searchTerms": search_terms,
        "fallbackTerms": fallback_terms,
        "requestSignature": request_signature,
        "familyHint": family_hint,
    }


def execute_native_trace_extraction(
    extraction_plan: dict[str, Any],
    timeout: int = 120,
) -> dict[str, Any]:
    requested_terms = list(extraction_plan.get("requestedTerms", []))
    search_terms = list(extraction_plan.get("searchTerms", []))
    family_hint = extraction_plan.get("familyHint")
    bridge_plan = extraction_plan.get("bridgePlan", {})
    request_signature = str(extraction_plan.get("requestSignature", ""))

    if not requested_terms:
        return {
            "available": False,
            "reason": "no-anchors",
            "project": "cifi-full",
            "requestedTerms": [],
            "searchTerms": [],
            "bridgePlan": bridge_plan,
            "requestSignature": request_signature,
        }

    if not GHIDRA_PROJECT_DIR.exists() or not GHIDRA_PROJECT_FILE.exists():
        return {
            "available": False,
            "reason": "persistent-project-missing",
            "project": "cifi-full",
            "requestedTerms": requested_terms,
            "searchTerms": search_terms,
            "bridgePlan": bridge_plan,
            "requestSignature": request_signature,
        }

    cached = find_cached_native_trace(search_terms, family_hint=family_hint)
    if cached:
        cached["requestedTerms"] = requested_terms
        cached["bridgePlan"] = bridge_plan
        cached["requestSignature"] = request_signature
        return cached

    def _run_process_project(terms: list[str]) -> tuple[subprocess.CompletedProcess[str], dict[str, Any]]:
        cmd = [
            sys.executable,
            str(GHIDRA_WRAPPER),
            "process-project",
            "cifi-full",
            "libil2cpp.so",
            "--search",
            ",".join(terms),
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
        try:
            payload = json.loads(proc.stdout)
        except json.JSONDecodeError:
            payload = {}
        return proc, payload

    result: dict[str, Any] = {
        "available": True,
        "project": "cifi-full",
        "requestedTerms": requested_terms,
        "searchTerms": search_terms,
        "status": "failed",
        "cacheHit": False,
        "bridgePlan": bridge_plan,
        "requestSignature": request_signature,
    }

    proc, payload = _run_process_project(search_terms)
    result["returncode"] = proc.returncode
    if not payload:
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

    fallback_terms = list(extraction_plan.get("fallbackTerms", []))
    if not _native_result_has_signal(result.get("result")) and fallback_terms:
        fallback_search_terms = normalize_native_search_terms([*search_terms, *fallback_terms])
        cached_fallback = find_cached_native_trace(fallback_search_terms, family_hint=family_hint)
        fallback_result: dict[str, Any] | None = None
        if cached_fallback:
            fallback_result = cached_fallback
        else:
            fallback_proc, fallback_payload = _run_process_project(fallback_search_terms)
            fallback_result = {
                "requestedTerms": requested_terms,
                "searchTerms": fallback_search_terms,
                "returncode": fallback_proc.returncode,
                "status": fallback_payload.get("status", "failed") if fallback_payload else "failed",
                "jobId": fallback_payload.get("job_id") if fallback_payload else None,
                "job": fallback_payload if fallback_payload else None,
                "cacheHit": False,
            }
            fallback_output_file = fallback_payload.get("output_file") if fallback_payload else None
            if fallback_output_file:
                fallback_path = Path(fallback_output_file)
                if fallback_path.exists():
                    try:
                        fallback_result["result"] = json.loads(fallback_path.read_text(encoding="utf-8"))
                    except json.JSONDecodeError:
                        fallback_result["result"] = {"error": "invalid-json", "path": str(fallback_path)}
        if fallback_result:
            fallback_signal = _native_result_has_signal(fallback_result.get("result"))
            result["fallbackBridgeAttempt"] = {
                "attempted": True,
                "searchTerms": fallback_result.get("searchTerms", fallback_search_terms),
                "status": fallback_result.get("status"),
                "cacheHit": fallback_result.get("cacheHit", False),
                "signalRecovered": fallback_signal,
            }
            if fallback_signal:
                result.update(
                    {
                        "searchTerms": list(fallback_result.get("searchTerms", fallback_search_terms)),
                        "returncode": int(fallback_result.get("returncode", result.get("returncode", 1))),
                        "status": str(fallback_result.get("status", result.get("status", "failed"))),
                        "jobId": fallback_result.get("jobId"),
                        "job": fallback_result.get("job"),
                        "result": fallback_result.get("result"),
                        "cacheHit": bool(fallback_result.get("cacheHit", False)),
                    }
                )
    return result


def _build_native_trace_evidence_rows(
    extraction_job_id: str,
    extraction_result: dict[str, Any],
) -> list[dict[str, Any]]:
    requested_terms = list(extraction_result.get("requestedTerms", []))
    bridge_plan = dict(extraction_result.get("bridgePlan", {}) or {})
    request_signature = str(extraction_result.get("requestSignature", "") or "")
    if not requested_terms or not request_signature:
        return []
    start_time = datetime.now().isoformat()
    rows: list[dict[str, Any]] = []
    match_map = {
        str(match.get("term", "")): match
        for match in bridge_plan.get("matches", [])
        if isinstance(match, dict) and match.get("term")
    }
    summary_map = {
        str(entry.get("term", "")): entry
        for entry in extraction_result.get("summary", {}).get("termSummaries", [])
        if isinstance(entry, dict) and entry.get("term")
    }

    def add(term: str, aspect_kind: str, payload: Any, aspect_key: str = "__self__", confidence: float | None = None) -> None:
        if payload is None:
            return
        if isinstance(payload, list) and not payload:
            return
        if isinstance(payload, dict) and not payload:
            return
        rows.append(
            {
                "project_name": "cifi-full",
                "project_file": "libil2cpp.so",
                "normalized_term": term.lower(),
                "term": term,
                "aspect_kind": aspect_kind,
                "aspect_key": aspect_key,
                "source_job_id": extraction_job_id,
                "payload": payload,
                "confidence": float(confidence if confidence is not None else float(ASPECT_PRIORITIES.get(aspect_kind, 50)) / 100.0),
                "reducer_priority": int(ASPECT_PRIORITIES.get(aspect_kind, 50)),
                "schema_version": int((extraction_result.get("result") or {}).get("schemaVersion", 0) or 0),
                "script_name": "trace_extractors.py",
                "producer_version": "native-trace-extraction-v1",
                "start_time": start_time,
            }
        )

    for term in requested_terms:
        match = dict(match_map.get(term, {}))
        summary = dict(summary_map.get(term, {}))
        search_attempt = {
            "term": term,
            "requestedTerms": requested_terms,
            "searchTerms": list(extraction_result.get("searchTerms", [])),
            "status": extraction_result.get("status"),
            "cacheHit": extraction_result.get("cacheHit", False),
            "sourceJobId": extraction_result.get("jobId"),
            "sourceTerm": term,
            "bridgeStrategy": bridge_plan.get("strategy"),
            "familyHint": extraction_result.get("bridgePlan", {}).get("familyHint"),
            "fallbackBridgeAttempt": extraction_result.get("fallbackBridgeAttempt"),
            "job": extraction_result.get("job"),
        }
        signal_fragment = {
            "term": term,
            "sourceJobId": extraction_result.get("jobId"),
            "bridgeKind": summary.get("bridgeKind"),
            "metadataHitCount": summary.get("metadataHitCount"),
            "directFunctionCount": summary.get("directFunctionCount"),
            "fuzzyFunctionCount": summary.get("fuzzyFunctionCount"),
            "referenceFunctionCount": summary.get("referenceFunctionCount"),
            "ownerCandidates": summary.get("ownerCandidates", []),
            "relatedTerms": summary.get("relatedTerms", []),
        }
        add(term, "bridge_plan", {
            "term": term,
            "termKind": match.get("termKind"),
            "requestedTerms": requested_terms,
            "selectedNativeCoreTerms": match.get("selectedNativeCoreTerms", []),
            "selectedContextTerms": match.get("selectedContextTerms", []),
            "selectionReasons": match.get("selectionReasons", []),
            "bridgeStrategy": bridge_plan.get("strategy"),
            "familyHint": bridge_plan.get("familyHint"),
            "sourceJobId": extraction_result.get("jobId"),
            "requestSignature": request_signature,
            "fallbackTerms": bridge_plan.get("secondStageTerms", []),
        }, aspect_key=request_signature, confidence=0.98)
        add(term, "metadata_context_fragment", list(match.get("selectedContextTerms", []) or match.get("contextTerms", []) or []), aspect_key=request_signature, confidence=0.76)
        add(term, "owner_inference", list(match.get("ownerCandidates", []) or bridge_plan.get("ownerCandidates", []) or []), aspect_key=request_signature, confidence=0.75)
        add(term, "sibling_cluster", list(match.get("siblingTerms", []) or bridge_plan.get("siblingTerms", []) or []), aspect_key=request_signature, confidence=0.75)
        add(term, "native_search_attempt", search_attempt, aspect_key=request_signature, confidence=0.96)
        add(term, "native_signal_fragment", signal_fragment, aspect_key=request_signature, confidence=0.94)

    return rows


def persist_native_trace_extraction(
    extraction_plan: dict[str, Any],
    extraction_result: dict[str, Any],
) -> dict[str, Any]:
    db = get_trace_cache_db()
    request_signature = str(extraction_plan.get("requestSignature", "") or "")
    requested_terms = list(extraction_plan.get("requestedTerms", []))
    search_terms = list(extraction_result.get("searchTerms", extraction_plan.get("searchTerms", [])))
    extraction_job_id = f"native-trace-extract:{request_signature}"
    extraction_job = {
        "job_id": extraction_job_id,
        "mode": "native-trace-extract",
        "project_name": "cifi-full",
        "project_file": "libil2cpp.so",
        "binary": "libil2cpp.so",
        "status": "completed",
        "start_time": datetime.now().isoformat(),
        "output_file": None,
        "job_file": None,
        "marker_file": None,
        "log_file": None,
        "signature": request_signature,
        "cache_mode": "db-extraction-stage",
        "search_strings": requested_terms,
        "expanded_search_strings": list(extraction_plan.get("fallbackTerms", [])),
        "executed_search_strings": search_terms,
        "completed_terms": requested_terms,
        "failed_terms": [],
        "per_term_jobs": [],
        "graph_backfilled_terms": [],
    }
    db.record_extraction_job(extraction_job)
    evidence_rows = _build_native_trace_evidence_rows(extraction_job_id, extraction_result)
    if evidence_rows:
        db.upsert_custom_evidence_rows(evidence_rows, rebuild_materialized=True)
    return db.materialize_native_trace_view(
        "cifi-full",
        "libil2cpp.so",
        request_signature,
        requested_terms,
        search_terms,
        dict(extraction_plan.get("bridgePlan", {}) or {}),
        family_hint=extraction_plan.get("familyHint"),
    )



def collect_native_trace(anchor_values: list[str], timeout: int = 120, family_hint: str | None = None) -> dict[str, Any]:
    extraction_plan = plan_native_trace_extraction(anchor_values, family_hint=family_hint)
    existing = get_trace_cache_db().find_materialized_native_trace_view(
        "cifi-full",
        "libil2cpp.so",
        str(extraction_plan.get("requestSignature", "")),
    )
    extraction_result = execute_native_trace_extraction(extraction_plan, timeout=timeout)
    if not extraction_result.get("available", True):
        return extraction_result

    extraction_result["summary"] = _summarize_native_result(
        extraction_result.get("result"),
        list(extraction_plan.get("requestedTerms", [])),
        family_hint,
    )
    materialized = persist_native_trace_extraction(extraction_plan, extraction_result)
    materialized["summary"] = _summarize_native_result(
        materialized.get("result"),
        list(extraction_plan.get("requestedTerms", [])),
        family_hint,
    )
    materialized["requestSignature"] = extraction_plan.get("requestSignature")
    materialized["extractionPlan"] = extraction_plan
    materialized["materializedFromDb"] = True
    if existing:
        materialized["previousMaterialization"] = {
            "builtAt": existing.get("builtAt"),
            "reducerVersion": existing.get("reducerVersion"),
        }
    return materialized
