#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
from collections import Counter
from datetime import timedelta
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Iterator


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB_PATH = ROOT / "workbench" / "ghidra-cache" / "ghidra_cache.sqlite3"
V2_REDUCER_VERSION = "trace-db-v2"
V2_SCHEMA_VERSION = 1
TOKEN_SHOP_VALUES_PATH = ROOT / "data" / "archive" / "token-shop-values.json"
_TOKEN_SHOP_VALUES_CACHE: dict[str, Any] | None = None


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _json_loads(value: str | None, default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return default


def _now_iso() -> str:
    return datetime.now().isoformat(timespec="microseconds")


def _load_token_shop_values_extract() -> dict[str, Any]:
    global _TOKEN_SHOP_VALUES_CACHE
    if _TOKEN_SHOP_VALUES_CACHE is not None:
        return _TOKEN_SHOP_VALUES_CACHE
    if not TOKEN_SHOP_VALUES_PATH.exists():
        _TOKEN_SHOP_VALUES_CACHE = {}
        return _TOKEN_SHOP_VALUES_CACHE
    try:
        _TOKEN_SHOP_VALUES_CACHE = json.loads(TOKEN_SHOP_VALUES_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        _TOKEN_SHOP_VALUES_CACHE = {}
    return _TOKEN_SHOP_VALUES_CACHE


def _shift_iso(value: str, *, seconds: int) -> str:
    try:
        return (datetime.fromisoformat(str(value)) + timedelta(seconds=seconds)).isoformat(timespec="microseconds")
    except (TypeError, ValueError):
        return _now_iso()


def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _stable_key(parts: list[str]) -> str:
    return _sha1("||".join(str(part or "").strip() for part in parts))


def _infer_node_kind(node_id: str) -> str:
    value = str(node_id or "").strip()
    lowered = value.lower()
    if not value:
        return "unknown"
    if lowered.startswith(("get_", "set_", "buy", "update", "fill", "convert", "check")):
        return "method"
    if "prefab" in lowered:
        return "prefab"
    if lowered.endswith(("button", "level", "text", "cost", "bonus", "slot")):
        return "field"
    if lowered.startswith(("atu", "su", "is")):
        return "field"
    if "." in value and any(chunk and chunk[0].isupper() for chunk in value.split(".")):
        return "symbol"
    return "symbol"


def _looks_like_concrete_term(value: str) -> bool:
    text = str(value or "").strip()
    if not text or len(text) > 120:
        return False
    lowered = text.lower()
    if lowered in {
        "gameobject",
        "class",
        "method",
        "field",
        "target",
        "metadata",
        "native",
        "assets",
        "level0",
        "none",
        "unknown",
        "generic",
    }:
        return False
    if lowered.startswith(("$.", "workbench/", "data/", "target-", "dependency:", "reconstruction-note:", "target-", "family-graph:", "native-acquisition-gap:")):
        return False
    if any(token in lowered for token in ("sourcepath", "sourceid", "locator", "semantickey", "requestsignature", "traceScope".lower(), "contributingtracescopes")):
        return False
    if re.fullmatch(r"[0-9a-f]{12,}", lowered):
        return False
    if text.startswith(("Buy", "Set", "Get", "Check", "Update", "Fill", "Convert", "Initialize", "Count", "Sort", "NewTokenUPGPrefab", "ATU", "SU", "IS", "DU", "LM")):
        return True
    if "Prefab" in text or "." in text:
        return True
    if 1 <= len(text.split()) <= 6 and any(ch.isupper() for ch in text):
        return True
    return False


def _contains_domain_signal(value: str) -> bool:
    lowered = str(value or "").strip().lower()
    if not lowered:
        return False
    domain_tokens = (
        "token",
        "shard",
        "cell",
        "diamond",
        "bank",
        "claim",
        "mod",
        "booster",
        "boost",
        "arcade",
        "campaign",
        "trinity",
        "prefab",
        "cost",
        "fill",
        "bonus",
        "level",
        "chest",
        "save",
        "profile",
        "atu",
        "su",
        "du",
        "lm",
        "mk",
    )
    return any(token in lowered for token in domain_tokens)


def _looks_like_actionable_anchor_term(value: str) -> bool:
    text = str(value or "").strip()
    if not _looks_like_concrete_term(text):
        return False
    if text.startswith(("Buy", "Set", "get_", "Get", "Check", "Claim", "Fill", "NewTokenUPGPrefab", "ATU", "SU", "DU", "LM", "MK")):
        return True
    return _contains_domain_signal(text)


def _anchor_penalty_score(value: str) -> float:
    text = str(value or "").strip()
    lowered = text.lower()
    if not text:
        return 0.0
    penalty = 0.0
    if lowered in {
        "assembly-csharp",
        "assembly-csharp-firstpass",
        "begininvoke",
        "nativerestorewindowclosedcallback",
        "adsinitializer",
        "admanager",
        "animationsinmenuhandler",
        "arcadeinfotab",
        "initializeugs",
    }:
        penalty += 80.0
    if lowered == "setstatemachine":
        penalty += 35.0
    if text.startswith(("Assembly-", "Native", "Begin", "Initialize")) and not _contains_domain_signal(text):
        penalty += 25.0
    if not _contains_domain_signal(text) and not text.startswith(("Buy", "Set", "get_", "Get", "Check", "Claim", "Fill", "NewTokenUPGPrefab", "ATU", "SU", "DU", "LM", "MK")):
        penalty += 20.0
    return penalty


def _scope_specificity_score(scope: str) -> int:
    value = str(scope or "").strip().lower()
    if not value:
        return -1
    score = len([part for part in value.split("-") if part])
    if "family" not in value:
        score += 5
    if re.search(r"atu\d+|su\d+|du\d+|lm\d+|mk\d+", value):
        score += 5
    return score


def _scope_looks_opaque(scope: str) -> bool:
    value = str(scope or "").strip()
    if not value:
        return True
    return bool(re.fullmatch(r"[0-9a-f]{16,64}", value, re.IGNORECASE))


def _normalize_runtime_trace_scope(raw_scope: str, payload: dict[str, Any] | None = None) -> str:
    scope_value = str(raw_scope or "").strip()
    payload_obj = payload if isinstance(payload, dict) else {}
    trace_knowledge = dict(payload_obj.get("traceKnowledge") or {})
    bridge_plan = dict(trace_knowledge.get("bridgePlan") or {})
    trace_run = dict(payload_obj.get("traceRun") or {})
    candidate_scopes = [
        scope_value,
        str(trace_run.get("traceScope") or "").strip(),
        str(bridge_plan.get("familyHint") or "").strip(),
        str(trace_knowledge.get("familyHint") or "").strip(),
        str(payload_obj.get("traceScope") or "").strip(),
    ]
    for candidate in candidate_scopes:
        if candidate and not _scope_looks_opaque(candidate):
            return candidate
    return scope_value


def _relation_walk_priority_bonus(relation_kind: str) -> float:
    normalized = str(relation_kind or "").strip()
    bonuses = {
        "returns-value-from": 40.0,
        "getter-family": 30.0,
        "exact-shell-to-action-hook": 28.0,
        "exact-shell-to-prefab": 24.0,
        "binds-ui-slot": 18.0,
        "exact-display-update-path": 14.0,
        "serialized-adjacency": 4.0,
        "owns-method": -6.0,
        "owns-field": -20.0,
        "uses-raw-value": -40.0,
    }
    return bonuses.get(normalized, 0.0)


def _relation_walk_support_weight(relation_kind: str, support_count: int) -> float:
    normalized = str(relation_kind or "").strip()
    count = max(int(support_count or 0), 0)
    caps = {
        "returns-value-from": 8,
        "getter-family": 6,
        "exact-shell-to-action-hook": 6,
        "exact-shell-to-prefab": 5,
        "binds-ui-slot": 4,
        "exact-display-update-path": 4,
        "serialized-adjacency": 2,
        "owns-method": 2,
        "owns-field": 2,
        "uses-raw-value": 1,
    }
    return float(min(count, caps.get(normalized, 3)))


def _is_promotable_graph_relation(relation_kind: str) -> bool:
    normalized = str(relation_kind or "").strip()
    return normalized in {
        "serialized-adjacency",
        "exact-shell-to-action-hook",
        "exact-shell-to-prefab",
        "exact-display-update-path",
        "binds-ui-slot",
        "getter-family",
        "returns-value-from",
        "save-owner-recovery",
        "owns-method",
        "owns-field",
    }


def _iter_projection_actionable_terms(payload: dict[str, Any]) -> Iterator[tuple[str, str]]:
    if not isinstance(payload, dict):
        return
    for key, value in payload.items():
        normalized_key = str(key or "").strip()
        if not normalized_key or normalized_key in {
            "projectionCompleteness",
            "ownedStatePopulationBridgeRecovered",
            "saveFamilyOverlapClear",
        }:
            continue
        if isinstance(value, str):
            term = str(value or "").strip()
            if _looks_like_actionable_anchor_term(term):
                yield normalized_key, term
            continue
        if isinstance(value, list):
            for item in value:
                term = str(item or "").strip()
                if _looks_like_actionable_anchor_term(term):
                    yield normalized_key, term


def _projection_anchor_rank(value: str) -> float:
    text = str(value or "").strip()
    if not _looks_like_actionable_anchor_term(text):
        return -1_000.0
    if text.startswith(("Buy", "Claim", "Set", "Check", "Update", "Fill")):
        return 100.0
    if text.endswith("Button"):
        return 85.0
    if "Prefab" in text:
        return 70.0
    if text.startswith(("get_", "Get")):
        return 45.0
    if _contains_domain_signal(text):
        return 35.0
    return 10.0


def _looks_like_display_slot_term(value: str) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    if text in {
        "CostBox",
        "CostText",
        "DescriptionBox",
        "DescText",
        "TokenDescText_TMPro",
        "LevelText",
        "ReqText",
        "TitleBox",
        "TokenUPGTitleText_TMPro",
    }:
        return True
    return text.endswith(("Text_TMPro", "CostBox", "TitleBox"))


def _projection_term_shape(value: str) -> str:
    text = str(value or "").strip()
    lowered = text.lower()
    if not text:
        return "unknown"
    if text.startswith(("get_", "Get")):
        return "getter"
    if text.startswith(("Set", "Check", "Update", "Fill", "Count", "Sort", "Initialize", "Attach", "Convert", "Start")):
        return "updater"
    if text.startswith(("Buy", "Claim", "Unlock", "Activate")):
        return "action"
    if text.endswith("Button"):
        return "button"
    if _looks_like_display_slot_term(text):
        return "ui-shell"
    if text.endswith(("Overlay", "MaxOverlay", "Content")):
        return "ui-shell"
    if "prefab" in lowered:
        return "prefab"
    if "backingfield" in lowered:
        return "value-field"
    if text.endswith(("Cost", "Bonus", "Fill", "MaxLevel", "Level", "Text", "Slot")):
        return "value-field"
    if lowered.endswith("info") or lowered.endswith("handler") or lowered.endswith("manager") or lowered.endswith("shop"):
        return "owner"
    if "|" in text:
        return "compound"
    return "symbol"


def _split_projection_identity_tokens(value: str) -> list[str]:
    text = str(value or "").strip()
    if not text:
        return []
    text = text.replace("|", " ").replace(".", " ").replace("_", " ")
    text = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", text)
    text = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1 \2", text)
    raw_tokens = [token for token in re.split(r"[^A-Za-z0-9]+", text) if token]
    stop_tokens = {
        "get",
        "set",
        "check",
        "update",
        "fill",
        "buy",
        "claim",
        "unlock",
        "activate",
        "button",
        "overlay",
        "content",
        "text",
        "slot",
        "max",
        "level",
        "start",
        "additive",
        "bonus",
        "cost",
        "final",
        "list",
        "data",
        "info",
        "handler",
        "manager",
        "shop",
        "player",
        "profile",
        "cloud",
        "save",
        "new",
        "prefab",
    }
    tokens: list[str] = []
    for token in raw_tokens:
        normalized = token.strip().lower()
        if not normalized or normalized in stop_tokens:
            continue
        if len(normalized) <= 2 and not re.fullmatch(r"(atu|su|du|mk)\d+", normalized):
            continue
        tokens.append(normalized)
    return tokens


def _projection_identity_tokens(value: str) -> set[str]:
    return set(_split_projection_identity_tokens(value))


def _projection_family_tokens(value: str) -> set[str]:
    return {
        token
        for token in _projection_identity_tokens(value)
        if re.fullmatch(r"(atu|su|du|mk)\d+", token)
    }


def _projection_non_generic_tokens(value: str) -> set[str]:
    broad_tokens = {
        "boost",
        "bonus1",
        "bonus2",
        "bonus3",
        "bonus4",
        "bonus5",
        "count",
        "total",
        "material",
        "mission",
        "affordable",
    }
    return {
        token
        for token in _projection_identity_tokens(value)
        if token not in broad_tokens
    }


def _projection_runtime_context_terms(payload: dict[str, Any], source_node_id: str) -> list[str]:
    terms: list[str] = [str(source_node_id or "").strip()]
    if not isinstance(payload, dict):
        return [term for term in terms if term]
    for key in ("sourceAnchor", "ownerAnchor", "bridgeAnchors", "requestedTerms"):
        value = payload.get(key)
        if isinstance(value, str):
            term = str(value or "").strip()
            if term:
                terms.append(term)
            continue
        if isinstance(value, list):
            for item in value:
                term = str(item or "").strip()
                if term:
                    terms.append(term)
    return list(dict.fromkeys(term for term in terms if term))


def _infer_projection_relation_intent(
    projection_kind: str,
    source_node_id: str,
    support_kind: str,
) -> dict[str, Any] | None:
    normalized_projection_kind = str(projection_kind or "").strip()
    normalized_support_kind = str(support_kind or "").strip()
    source_shape = _projection_term_shape(source_node_id)
    source_family_tokens = _projection_family_tokens(source_node_id)
    if normalized_projection_kind == "value-formula-structure":
        if normalized_support_kind == "formulaAccessors":
            return {"intent": "formula-accessor", "allowedTargetShapes": {"getter"}}
        if normalized_support_kind == "formulaFields":
            return {"intent": "formula-field", "allowedTargetShapes": {"value-field"}}
        if normalized_support_kind == "deterministicEvaluators":
            return {"intent": "formula-evaluator", "allowedTargetShapes": {"updater", "getter", "owner", "symbol"}}
        return None
    if normalized_projection_kind in {"save-owner-structure", "shard-save-owner-structure"}:
        if normalized_support_kind == "recoveredTargets":
            return {
                "intent": "save-owner-bridge",
                "allowedTargetShapes": {"getter", "updater", "owner", "symbol"},
                "requireContextOverlap": True,
            }
        return None
    if normalized_projection_kind == "structural-neighborhood-structure":
        if source_shape == "button":
            if normalized_support_kind == "actionTargets":
                return {"intent": "button-action-neighborhood", "allowedTargetShapes": {"action"}}
            if normalized_support_kind == "uiTargets":
                return {
                    "intent": "button-ui-neighborhood",
                    "allowedTargetShapes": {"value-field", "ui-shell"},
                    "requireContextOverlap": True,
                }
            return None
        if source_shape == "action":
            support_map = {
                "prefabTargets": {"prefab"},
                "updaterTargets": {"updater"},
                "getterTargets": {"getter"},
                "valueTargets": {"value-field", "symbol"},
                "uiTargets": {"value-field", "ui-shell"},
            }
            allowed = support_map.get(normalized_support_kind)
            if allowed:
                return {
                    "intent": "action-structural-neighborhood",
                    "allowedTargetShapes": allowed,
                    "requireSameFamilyIfPresent": bool(source_family_tokens),
                    "requireContextOverlap": normalized_support_kind in {"getterTargets", "valueTargets", "uiTargets"},
                }
            return None
        if source_shape == "owner":
            support_map = {
                "actionTargets": {"action"},
                "getterTargets": {"getter"},
                "updaterTargets": {"updater"},
                "valueTargets": {"value-field"},
                "ownerTargets": {"owner", "symbol"},
            }
            allowed = support_map.get(normalized_support_kind)
            if allowed:
                return {
                    "intent": "owner-structural-neighborhood",
                    "allowedTargetShapes": allowed,
                    "requireSameFamilyIfPresent": normalized_support_kind == "valueTargets" and bool(source_family_tokens),
                    "requireContextOverlap": normalized_support_kind in {"valueTargets", "ownerTargets"},
                }
            return None
        if source_shape == "getter":
            support_map = {
                "valueTargets": {"value-field", "owner", "symbol"},
                "updaterTargets": {"updater", "owner", "symbol"},
                "parameterTargets": {"value-field", "symbol"},
                "ownerTargets": {"owner", "symbol"},
            }
            allowed = support_map.get(normalized_support_kind)
            if allowed:
                return {
                    "intent": "getter-structural-neighborhood",
                    "allowedTargetShapes": allowed,
                    "requireContextOverlap": True,
                }
            return None
        if source_shape == "updater":
            support_map = {
                "valueTargets": {"value-field", "symbol"},
                "getterTargets": {"getter"},
                "ownerTargets": {"owner", "symbol"},
                "uiTargets": {"value-field", "ui-shell"},
            }
            allowed = support_map.get(normalized_support_kind)
            if allowed:
                return {
                    "intent": "updater-structural-neighborhood",
                    "allowedTargetShapes": allowed,
                    "requireContextOverlap": True,
                }
            return None
        return None
    if normalized_projection_kind == "runtime-bridge-structure" and normalized_support_kind == "bridgeTargets":
        if source_shape == "button":
            return {
                "intent": "runtime-button-bridge",
                "allowedTargetShapes": {"value-field", "ui-shell", "button"},
                "requireContextOverlap": True,
            }
        if source_shape == "action":
            return {
                "intent": "runtime-action-bridge",
                "allowedTargetShapes": {"value-field", "updater", "getter", "prefab", "button", "ui-shell"},
                "requireSameFamilyIfPresent": bool(source_family_tokens),
                "requireContextOverlap": not bool(source_family_tokens),
            }
        if source_shape == "updater":
            return {
                "intent": "runtime-updater-bridge",
                "allowedTargetShapes": {"updater", "getter", "value-field", "owner", "symbol"},
                "requireSameFamilyIfPresent": bool(source_family_tokens),
                "requireContextOverlap": True,
            }
        if source_shape == "getter":
            return {
                "intent": "runtime-getter-bridge",
                "allowedTargetShapes": {"value-field", "updater", "owner", "symbol", "getter"},
                "requireSameFamilyIfPresent": bool(source_family_tokens),
                "requireContextOverlap": True,
            }
        if source_shape == "owner":
            return {
                "intent": "runtime-owner-bridge",
                "allowedTargetShapes": {"getter", "updater", "value-field", "owner", "symbol"},
                "requireContextOverlap": True,
            }
        return None
    if normalized_projection_kind == "runtime-bridge-structure" and normalized_support_kind == "actionTargets":
        if source_shape == "button":
            return {
                "intent": "runtime-button-action-bridge",
                "allowedTargetShapes": {"action"},
            }
        return None
    if normalized_projection_kind == "token-shop-row-structure" and normalized_support_kind == "instanceTargets":
        if source_shape in {"button", "action", "owner", "symbol"}:
            return {
                "intent": "token-shop-runtime-instance-bridge",
                "allowedTargetShapes": {"getter", "updater", "owner", "symbol", "value-field"},
            }
        return None
    if normalized_projection_kind == "token-shop-row-structure" and normalized_support_kind == "runtimeSlotTargets":
        if source_shape in {"updater", "getter", "owner", "symbol"}:
            return {
                "intent": "token-shop-runtime-slot-bridge",
                "allowedTargetShapes": {"value-field", "ui-shell", "symbol"},
            }
        return None
    return {
        "intent": "generic-projection-bridge",
        "allowedTargetShapes": {"getter", "updater", "value-field", "owner", "symbol", "prefab"},
    }


def _projection_pair_is_plausible(
    source_node_id: str,
    target_node_id: str,
    support_kind: str,
    projection_kind: str = "",
    payload: dict[str, Any] | None = None,
) -> bool:
    source_value = str(source_node_id or "").strip()
    target_value = str(target_node_id or "").strip()
    kind_value = str(support_kind or "").strip()
    if not source_value or not target_value:
        return False
    source_shape = _projection_term_shape(source_value)
    target_shape = _projection_term_shape(target_value)
    if source_shape == "button" and target_shape in {"button", "ui-shell"}:
        return False
    if source_shape == "getter" and target_shape in {"button", "ui-shell"}:
        return False
    if source_shape in {"value-field", "prefab"} and target_shape == "button":
        return False
    if source_shape == "compound" or target_shape == "compound":
        return False
    intent = _infer_projection_relation_intent(projection_kind, source_value, support_kind)
    if not intent:
        return False
    allowed_target_shapes = set(intent.get("allowedTargetShapes") or [])
    if allowed_target_shapes and target_shape not in allowed_target_shapes:
        return False
    source_family_tokens = _projection_family_tokens(source_value)
    target_family_tokens = _projection_family_tokens(target_value)
    if intent.get("requireSameFamilyIfPresent") and source_family_tokens:
        if not target_family_tokens or not (source_family_tokens & target_family_tokens):
            return False
    if intent.get("requireContextOverlap"):
        context_terms = _projection_runtime_context_terms(payload or {}, source_value)
        context_tokens: set[str] = set()
        for term in context_terms:
            context_tokens.update(_projection_non_generic_tokens(term))
        target_tokens = _projection_non_generic_tokens(target_value)
        if not (context_tokens & target_tokens):
            return False
    if (
        projection_kind == "token-shop-row-structure"
        and kind_value == "instanceTargets"
        and source_shape in {"getter", "updater"}
        and target_shape == "value-field"
    ):
        return False
    if (
        projection_kind == "token-shop-row-structure"
        and _is_runtime_property_accessor(source_value)
        and kind_value in {"getterTargets", "instanceTargets", "parameterTargets", "runtimeSlotTargets"}
    ):
        return False
    if (
        projection_kind == "runtime-bridge-structure"
        and kind_value == "bridgeTargets"
        and source_shape in {"getter", "owner"}
        and target_shape == "value-field"
        and not source_family_tokens
    ):
        return False
    if (
        source_shape == "getter"
        and target_shape == "value-field"
        and not source_family_tokens
        and not target_family_tokens
        and (
            source_value.startswith(("GetCurrentSaveFileInfo", "GetPlayerProfileInfo", "ConvertSaveDataToProfileData", "FillPlayerProfileData"))
            or "Save" in source_value
            or "Profile" in source_value
            or source_value in {"CloudSavePlayerProfile", "get_ClaimableBankTokens", "GetPlayerProfileInfo"}
        )
    ):
        return False
    if kind_value == "bridgeTargets":
        if source_shape in {"button", "ui-shell", "value-field", "compound"}:
            return False
        context_terms = _projection_runtime_context_terms(payload or {}, source_value)
        context_tokens: set[str] = set()
        for term in context_terms:
            context_tokens.update(_projection_identity_tokens(term))
        target_tokens = _projection_identity_tokens(target_value)
        shared_tokens = context_tokens & target_tokens
        broad_bridge_tokens = {"boost"}
        if target_shape in {"button", "ui-shell"} and source_shape != "action":
            return False
        if source_family_tokens and target_family_tokens and not (source_family_tokens & target_family_tokens):
            return False
        if target_shape == "value-field" and source_shape == "action":
            source_tokens = _projection_identity_tokens(source_value)
            target_non_generic = _projection_non_generic_tokens(target_value)
            if not (source_tokens & target_non_generic):
                return False
        if target_shape in {"button", "ui-shell"} and source_shape == "action":
            source_tokens = _projection_identity_tokens(source_value)
            if not (source_tokens & target_tokens):
                return False
        if not shared_tokens:
            if not (source_shape == "action" and target_shape in {"button", "ui-shell"}):
                return False
        if shared_tokens and all(token in broad_bridge_tokens for token in shared_tokens):
            return False
        if target_shape in {"button", "ui-shell"} and source_shape in {"action", "updater", "getter", "owner"}:
            source_tokens = _projection_identity_tokens(source_value)
            if not (source_tokens & target_tokens):
                requested = {
                    str(item or "").strip()
                    for item in ((payload or {}).get("requestedTerms") or [])
                    if str(item or "").strip()
                }
                requested_tokens: set[str] = set()
                for term in requested:
                    requested_tokens.update(_projection_identity_tokens(term))
                if not (requested_tokens & target_tokens):
                    return False
    return True


def _projection_source_anchor(payload: dict[str, Any], subject_id: str) -> str:
    anchors = _projection_source_anchors(payload, subject_id, limit=1)
    return anchors[0] if anchors else ""


def _projection_source_anchors(payload: dict[str, Any], subject_id: str, *, limit: int = 6) -> list[str]:
    ranked_candidates: list[tuple[float, int, str]] = []
    for key_priority, key in enumerate(("sourceAnchor", "ownerAnchor", "owner", "actionHook", "rowButton", "capMethod")):
        value = str(payload.get(key) or "").strip() if isinstance(payload, dict) else ""
        if value and _looks_like_actionable_anchor_term(value):
            ranked_candidates.append((_projection_anchor_rank(value), key_priority, value))
    if isinstance(payload, dict):
        for key_priority, key in enumerate(
            (
                "bridgeAnchors",
                "requestedTerms",
                "formulaAccessors",
                "recoveredTargets",
                "actionTargets",
                "getterTargets",
                "updaterTargets",
            ),
            start=10,
        ):
            values = payload.get(key)
            if not isinstance(values, list):
                continue
            for item in values:
                value = str(item or "").strip()
                if not value or not _looks_like_actionable_anchor_term(value):
                    continue
                shape = _projection_term_shape(value)
                bonus = 0.0
                if shape in {"action", "updater", "getter", "owner"}:
                    bonus = 18.0
                elif shape == "button":
                    bonus = -12.0
                elif shape in {"ui-shell", "value-field", "compound"}:
                    bonus = -20.0
                ranked_candidates.append((_projection_anchor_rank(value) + bonus, key_priority, value))
    subject_value = str(subject_id or "").strip()
    if subject_value and _looks_like_actionable_anchor_term(subject_value):
        ranked_candidates.append((_projection_anchor_rank(subject_value), 99, subject_value))
    if not ranked_candidates:
        return []
    ranked_candidates.sort(key=lambda item: (-item[0], item[1], item[2]))
    ordered = list(dict.fromkeys(item[2] for item in ranked_candidates if item[2]))
    return ordered[: max(int(limit or 0), 1)]


def _projection_source_anchor_budget(projection_kind: str, payload: dict[str, Any] | None = None) -> int:
    normalized_kind = str(projection_kind or "").strip()
    payload_obj = payload if isinstance(payload, dict) else {}
    if normalized_kind == "runtime-bridge-structure":
        bridge_target_count = len(
            [
                str(value or "").strip()
                for value in (payload_obj.get("bridgeTargets") or [])
                if str(value or "").strip()
            ]
        )
        return 12 if bridge_target_count >= 8 else 8
    if normalized_kind == "structural-neighborhood-structure":
        target_bucket_count = 0
        for key in (
            "actionTargets",
            "getterTargets",
            "updaterTargets",
            "prefabTargets",
            "valueTargets",
            "uiTargets",
            "ownerTargets",
            "parameterTargets",
        ):
            values = payload_obj.get(key)
            if isinstance(values, list) and any(str(value or "").strip() for value in values):
                target_bucket_count += 1
        return 12 if target_bucket_count >= 3 else 8
    if normalized_kind in {"save-owner-structure", "shard-save-owner-structure", "token-bank-state-structure"}:
        return 10
    return 6


def _is_save_owner_anchor_candidate(value: str) -> bool:
    text = str(value or "").strip()
    if not _looks_like_actionable_anchor_term(text):
        return False
    shape = _projection_term_shape(text)
    if shape not in {"owner", "getter", "updater"}:
        return False
    save_owner_signals = (
        "Save",
        "Profile",
        "Market",
        "Claimable",
        "Milestone",
        "Shard",
        "Player",
    )
    if shape == "getter":
        if not any(signal in text for signal in save_owner_signals):
            return False
    elif shape == "updater":
        if not any(signal in text for signal in save_owner_signals):
            return False
    elif shape == "owner":
        if not (
            any(signal in text for signal in save_owner_signals)
            or text.endswith(("Data", "Info"))
        ):
            return False
    return True


def _is_save_owner_recovered_target(value: str) -> bool:
    text = str(value or "").strip()
    if not text:
        return False
    explicit_targets = {
        "PlayerProfileData",
        "ConvertSaveDataToProfileData",
        "FillPlayerProfileData",
        "get_Market",
        "GetCurrentSaveFileInfo",
        "GetPlayerProfileInfo",
        "CloudSavePlayerProfile",
        "get_TotalMilestoneLevels",
        "TotalMilestoneLevels",
        "InitializeMaxLevelBools",
        "GetShardCostList",
        "MilestoneCostList",
        "UpdateShardCostList",
    }
    if text in explicit_targets:
        return True
    if "Save" in text or "Profile" in text or "Market" in text:
        return True
    return False


def _is_runtime_property_accessor(value: str) -> bool:
    text = str(value or "").strip()
    return bool(text) and bool(re.fullmatch(r"(get|set)_[A-Za-z0-9_]+", text))


def _projection_live_source_anchors(
    projection_kind: str,
    payload: dict[str, Any],
    subject_id: str,
) -> list[str]:
    normalized_kind = str(projection_kind or "").strip()
    if normalized_kind == "runtime-bridge-structure" and isinstance(payload, dict):
        row_button = str(payload.get("rowButton") or "").strip()
        if row_button:
            anchors: list[str] = []
            for key in ("sourceAnchor", "actionHook", "rowButton", "ownerAnchor"):
                value = str(payload.get(key) or "").strip()
                if value and _looks_like_actionable_anchor_term(value) and not _is_runtime_property_accessor(value):
                    anchors.append(value)
            for value in payload.get("bridgeAnchors") or []:
                term = str(value or "").strip()
                if (
                    term
                    and _looks_like_actionable_anchor_term(term)
                    and not _is_runtime_property_accessor(term)
                    and _projection_term_shape(term) in {"action", "updater", "owner", "symbol"}
                ):
                    anchors.append(term)
            if anchors:
                return list(dict.fromkeys(anchors))[: max(_projection_source_anchor_budget(normalized_kind, payload), 1)]
    if normalized_kind == "token-shop-row-structure" and isinstance(payload, dict):
        runtime_projection = _normalize_token_shop_runtime_projection(payload.get("runtimeProjection") or {})
        runtime_seam_open = bool(
            str(runtime_projection.get("runtimeStatus") or "").strip()
            or str(runtime_projection.get("instanceStatus") or "").strip()
            or list(runtime_projection.get("unresolvedDisplayValues") or [])
            or list(runtime_projection.get("unresolvedInstanceValues") or [])
        )
        if runtime_seam_open:
            semantic_updaters: list[str] = []
            semantic_owners: list[str] = []
            semantic_instances: list[str] = []
            semantic_getters: list[str] = []
            anchors: list[str] = []
            runtime_evaluator_owner = str(runtime_projection.get("evaluatorOwner") or "").strip()
            preferred_instance_terms = [
                str(runtime_projection.get("instanceOwner") or "").strip(),
                str(runtime_projection.get("creationMethod") or "").strip(),
                str(runtime_projection.get("selectionKey") or "").strip(),
            ]
            for value in payload.get("updaterTargets") or []:
                term = str(value or "").strip()
                if term and _looks_like_actionable_anchor_term(term) and not _is_runtime_property_accessor(term):
                    semantic_updaters.append(term)
            for value in payload.get("ownerTargets") or []:
                term = str(value or "").strip()
                if preferred_instance_terms[0] and term == runtime_evaluator_owner:
                    continue
                if term and _looks_like_actionable_anchor_term(term) and not _is_runtime_property_accessor(term):
                    semantic_owners.append(term)
            for value in payload.get("instanceTargets") or []:
                term = str(value or "").strip()
                term_shape = _projection_term_shape(term)
                if (
                    term
                    and _looks_like_actionable_anchor_term(term)
                    and not _is_runtime_property_accessor(term)
                    and term_shape in {"owner", "symbol"}
                    and term[:1].isupper()
                    and not term.endswith(("Texts", "Buttons", "Overlays"))
                ):
                    semantic_instances.append(term)
            for value in payload.get("getterTargets") or []:
                term = str(value or "").strip()
                if term and _looks_like_actionable_anchor_term(term) and not _is_runtime_property_accessor(term):
                    semantic_getters.append(term)
            anchors.extend(term for term in preferred_instance_terms if term and _looks_like_actionable_anchor_term(term))
            anchors.extend(semantic_updaters)
            anchors.extend(semantic_owners)
            anchors.extend(semantic_instances)
            for key in ("actionHook", "rowButton"):
                value = str(payload.get(key) or "").strip()
                if value and _looks_like_actionable_anchor_term(value):
                    anchors.append(value)
            anchors.extend(semantic_getters)
            if anchors:
                return list(dict.fromkeys(anchors))[: max(_projection_source_anchor_budget(normalized_kind, payload), 1)]
    if normalized_kind in {"save-owner-structure", "shard-save-owner-structure"}:
        anchors: list[str] = []
        for key in ("ownerAnchor", "sourceAnchor"):
            value = str(payload.get(key) or "").strip() if isinstance(payload, dict) else ""
            if value and _looks_like_actionable_anchor_term(value):
                anchors.append(value)
        if anchors:
            return list(dict.fromkeys(anchors))
    return _projection_source_anchors(
        payload,
        subject_id,
        limit=_projection_source_anchor_budget(normalized_kind, payload),
    )


def _token_shop_runtime_projection_from_row_recovery(row_recovery: dict[str, Any] | None) -> dict[str, Any]:
    recovery = row_recovery if isinstance(row_recovery, dict) else {}
    if not recovery:
        return {}
    formula_reconstruction = dict(recovery.get("formulaReconstruction") or {})
    owner_cost_schema = dict(formula_reconstruction.get("ownerCostSchema") or {})
    literal_summary = dict(recovery.get("literalRecoverySummary") or {})
    row_layout = dict(recovery.get("rowLayoutExplanation") or {})
    runtime_evaluator = dict(recovery.get("runtimeEvaluatorRecovery") or {})
    runtime_instance = dict(recovery.get("runtimeInstanceRecovery") or {})
    fast_buy_recovery = dict(recovery.get("fastBuyRecovery") or {})
    global_modifier_recovery = dict(recovery.get("globalModifierRecovery") or {})
    closure_status = dict(recovery.get("closureStatus") or {})
    presentation_update_path = dict(recovery.get("presentationUpdatePath") or {})
    inferred_cost_model = dict(formula_reconstruction.get("inferredCostModel") or {})
    runtime_cost_model = dict(formula_reconstruction.get("runtimeCostModel") or {})
    grounded_constants = dict(formula_reconstruction.get("groundedConstants") or {})
    display_formula = runtime_cost_model or inferred_cost_model
    unresolved_display_values = [
        str(value).strip()
        for value in (row_layout.get("unresolvedDisplayValues") or [])
        if str(value).strip()
    ]
    runtime_slot_targets = [
        str(item.get("slotLabel") or "").strip()
        for item in (closure_status.get("requiredSemanticGaps") or [])
        if isinstance(item, dict)
        and str(item.get("kind") or "").strip() == "missing-verified-updater-edge"
        and str(item.get("slotLabel") or "").strip()
    ]
    if not runtime_slot_targets:
        for slot_entries in (presentation_update_path.get("slots") or {}).values():
            if not isinstance(slot_entries, list):
                continue
            for slot_entry in slot_entries:
                if not isinstance(slot_entry, dict):
                    continue
                slot_name = str(slot_entry.get("name") or "").strip()
                if slot_name:
                    runtime_slot_targets.append(slot_name)
    evaluator_methods = [
        str(value).strip()
        for value in (runtime_evaluator.get("evaluatorMethods") or [])
        if str(value).strip()
    ]
    evaluator_methods = list(
        dict.fromkeys(
            [
                *evaluator_methods,
                *[
                    str(value).strip()
                    for value in (owner_cost_schema.get("methods") or [])
                    if str(value).strip()
                ],
            ]
        )
    )
    evaluator_fields = [
        str(value).strip()
        for value in (runtime_evaluator.get("evaluatorFields") or [])
        if str(value).strip()
    ]
    evaluator_fields = list(
        dict.fromkeys(
            [
                *evaluator_fields,
                *[
                    str(value).strip()
                    for value in (owner_cost_schema.get("fields") or [])
                    if str(value).strip()
                ],
            ]
        )
    )
    runtime_projection: dict[str, Any] = {
        "displayEntries": [],
        "displayFormula": {
            **display_formula,
            "outputLabel": str(literal_summary.get("outputLabel") or "").strip() or None,
            "bonusLabel": str(literal_summary.get("bonusLabel") or "").strip() or None,
            "runtimeStatus": str(runtime_evaluator.get("status") or "").strip() or None,
            "instanceStatus": str(runtime_instance.get("status") or "").strip() or None,
            "unresolvedDisplayValues": unresolved_display_values,
        }
        if display_formula or unresolved_display_values or literal_summary.get("outputLabel") or literal_summary.get("bonusLabel")
        else None,
        "displayValue": None,
        "displayValueLabel": None,
        "effectiveMaxLevel": None,
        "finalMaxAccessor": "",
        "nextCostAccessor": "",
        "runtimeStatus": str(runtime_evaluator.get("status") or "").strip() or None,
        "instanceStatus": str(runtime_instance.get("status") or "").strip() or None,
        "evaluatorOwner": str(runtime_evaluator.get("owner") or "").strip() or None,
        "evaluatorMethods": evaluator_methods,
        "evaluatorFields": evaluator_fields,
        "instanceOwner": str(runtime_instance.get("instanceOwner") or "").strip() or None,
        "instanceFields": [
            str(value).strip()
            for value in (runtime_instance.get("instanceFields") or [])
            if str(value).strip()
        ],
        "instanceAccessors": [
            str(value).strip()
            for value in (runtime_instance.get("instanceAccessors") or [])
            if str(value).strip()
        ],
        "uiBindingArrays": [
            str(value).strip()
            for value in (runtime_instance.get("uiBindingArrays") or [])
            if str(value).strip()
        ],
        "creationMethod": str(runtime_instance.get("creationMethod") or "").strip() or None,
        "selectionKey": str(runtime_instance.get("selectionKey") or "").strip() or None,
        "runtimeSlotTargets": list(dict.fromkeys(runtime_slot_targets)),
        "unresolvedDisplayValues": unresolved_display_values,
        "unresolvedInstanceValues": [
            str(value).strip()
            for value in (runtime_evaluator.get("unresolvedInstanceValues") or [])
            if str(value).strip()
        ],
        "unresolvedRuntimeTargets": [
            str(value).strip()
            for value in (closure_status.get("unresolvedRuntimeTargets") or [])
            if str(value).strip()
        ],
        "fastBuyStatus": str(fast_buy_recovery.get("status") or "").strip() or None,
        "fastBuyTerms": [],
        "fastBuyOwners": [],
        "fastBuyFields": [],
        "fastBuyHierarchyPaths": [],
        "globalModifierStatus": str(global_modifier_recovery.get("status") or "").strip() or None,
        "modifierTerms": [],
        "modifierOwners": [],
        "modifierMethods": [],
        "modifierFields": [],
        "canonicalInstanceLaneTerms": [],
    }
    fast_buy_paths = [
        str(item.get("hierarchyPath") or "").strip().lower()
        for item in (
            list(fast_buy_recovery.get("fastBuyObjects") or [])
            + list(fast_buy_recovery.get("bulkBuyObjects") or [])
        )
        if isinstance(item, dict) and str(item.get("hierarchyPath") or "").strip()
    ]
    if fast_buy_paths:
        global_noise_markers = ("shards", "academy", "loopmod", "researchmenu", "gearmenu")
        if all(any(marker in path for marker in global_noise_markers) for path in fast_buy_paths):
            fast_buy_recovery["status"] = "fast-buy-candidates-global-only"
    fast_buy_native = dict(fast_buy_recovery.get("nativeTerms") or {})
    runtime_projection["fastBuyTerms"] = list(
        dict.fromkeys(
            [
                *[
                    str(value).strip()
                    for value in (fast_buy_recovery.get("rawStringHits") or [])
                    if str(value).strip()
                    and any(marker in str(value) for marker in ("FastBuy", "BUY x10", "Attach"))
                ],
                *[
                    str(value).strip()
                    for value in (fast_buy_native.get("methodCandidates") or [])
                    if str(value).strip()
                ],
            ]
        )
    )
    runtime_projection["fastBuyOwners"] = list(
        dict.fromkeys(
            str(value).strip()
            for value in (fast_buy_native.get("ownerCandidates") or [])
            if str(value).strip()
        )
    )
    runtime_projection["fastBuyFields"] = list(
        dict.fromkeys(
            str(value).strip()
            for value in (fast_buy_native.get("fieldCandidates") or [])
            if str(value).strip()
        )
    )
    runtime_projection["fastBuyHierarchyPaths"] = list(
        dict.fromkeys(
            str(item.get("hierarchyPath") or "").strip()
            for item in (
                list(fast_buy_recovery.get("fastBuyObjects") or [])
                + list(fast_buy_recovery.get("bulkBuyObjects") or [])
            )
            if isinstance(item, dict) and str(item.get("hierarchyPath") or "").strip()
        )
    )
    runtime_projection["modifierTerms"] = list(
        dict.fromkeys(
            str(value).strip()
            for value in (global_modifier_recovery.get("candidateTerms") or [])
            if str(value).strip()
        )
    )
    runtime_projection["modifierOwners"] = list(
        dict.fromkeys(
            str(value).strip()
            for value in (global_modifier_recovery.get("candidateOwners") or [])
            if str(value).strip()
        )
    )
    runtime_projection["modifierMethods"] = list(
        dict.fromkeys(
            str(value).strip()
            for value in (global_modifier_recovery.get("candidateMethods") or [])
            if str(value).strip()
        )
    )
    runtime_projection["modifierFields"] = list(
        dict.fromkeys(
            str(value).strip()
            for value in (global_modifier_recovery.get("candidateFields") or [])
            if str(value).strip()
        )
    )
    if "get_cost" in evaluator_methods:
        runtime_projection["nextCostAccessor"] = "get_cost"
    final_max_candidates = [
        term
        for term in [
            *[
                str(value).strip()
                for value in (recovery.get("nativePromotedMethods") or [])
                if str(value).strip()
            ],
            *[
                str(value).strip()
                for value in (recovery.get("nativePromotedFields") or [])
                if str(value).strip()
            ],
            *evaluator_methods,
        ]
        if re.search(r"Final.+(MaxLevel|FillMaxLevel)$", term)
    ]
    if final_max_candidates:
        runtime_projection["finalMaxAccessor"] = final_max_candidates[0]
    elif "maxLevel" in evaluator_fields:
        runtime_projection["finalMaxAccessor"] = "maxLevel"
    if "get_finalSetValue" in evaluator_methods and "finalSetValue" not in runtime_projection["unresolvedInstanceValues"]:
        runtime_projection["unresolvedInstanceValues"].append("finalSetValue")
    runtime_instance_text = _json_dumps(runtime_instance)
    if "currentIndex" in runtime_instance_text and "currentIndex" not in evaluator_fields:
        evaluator_fields.append("currentIndex")
        runtime_projection["evaluatorFields"] = evaluator_fields
    runtime_slot_targets = [
        str(value).strip()
        for value in (runtime_projection.get("runtimeSlotTargets") or [])
        if str(value).strip()
    ]
    unresolved_runtime = [
        str(value).strip()
        for value in (runtime_projection.get("unresolvedInstanceValues") or [])
        if str(value).strip()
    ]
    canonical_instance_lane_terms: list[str] = []
    if (
        str(runtime_projection.get("runtimeStatus") or "").strip().endswith("-open")
        or unresolved_runtime
        or str(runtime_projection.get("instanceStatus") or "").strip().endswith("-open")
    ):
        canonical_instance_lane_terms.extend(
            [
                "CreateUpgradeClass",
                "Upgrade",
                "currentIndex",
            ]
        )
        if any("Cost" in value or value.endswith("Text") for value in runtime_slot_targets):
            canonical_instance_lane_terms.append("costTexts")
        if any("Desc" in value or "description" in value.lower() for value in runtime_slot_targets):
            canonical_instance_lane_terms.append("descriptionsTexts")
        if "maxLevel" in evaluator_fields or "level" in evaluator_fields:
            canonical_instance_lane_terms.append("levelTexts")
        for value in [
            "cost",
            "costExponent",
            "additiveIncrease",
            "calculationType",
            "calculationsType",
            "finalSetValue",
            "maxLevel",
            "level",
            "output",
        ]:
            if value in evaluator_fields or any(value in item for item in unresolved_runtime):
                canonical_instance_lane_terms.append(value)
        for accessor in [
            "get_cost",
            "get_costExponent",
            "get_additiveIncrease",
            "get_calculationsType",
            "get_finalSetValue",
            "get_maxLevel",
            "get_level",
        ]:
            if accessor in evaluator_methods:
                canonical_instance_lane_terms.append(accessor)
        canonical_instance_lane_terms.extend(
            [
                *[value for value in (runtime_projection.get("fastBuyTerms") or []) if value],
                *[value for value in (runtime_projection.get("fastBuyOwners") or []) if value],
                *[value for value in (runtime_projection.get("fastBuyFields") or []) if value],
                *[value for value in (runtime_projection.get("modifierTerms") or []) if value],
                *[value for value in (runtime_projection.get("modifierOwners") or []) if value],
                *[value for value in (runtime_projection.get("modifierMethods") or []) if value],
                *[value for value in (runtime_projection.get("modifierFields") or []) if value],
            ]
        )
    runtime_projection["canonicalInstanceLaneTerms"] = list(
        dict.fromkeys(value for value in canonical_instance_lane_terms if value)
    )
    grounded_max_level = grounded_constants.get("MaxLevel")
    if isinstance(grounded_max_level, (int, float)) and float(grounded_max_level).is_integer():
        runtime_projection["baseMaxLevel"] = int(grounded_max_level)
    elif isinstance(grounded_max_level, (int, float)):
        runtime_projection["baseMaxLevel"] = float(grounded_max_level)
    return _normalize_token_shop_runtime_projection(runtime_projection)


def _grounded_token_shop_row_constants_from_fields(row_value_fields: list[str] | None) -> dict[str, Any]:
    value_fields = [
        str(value).strip()
        for value in (row_value_fields or [])
        if str(value).strip()
    ]
    if not value_fields:
        return {}
    family_names: list[str] = []
    suffix_re = re.compile(r"(StartCost|AdditiveCost|Bonus|FillMaxLevel|MaxLevel|Fill)$")
    for field_name in value_fields:
        match = suffix_re.search(field_name)
        if not match:
            continue
        family_names.append(field_name[: match.start()])
    if not family_names:
        return {}
    canonical_family = family_names[0]
    if any(name != canonical_family for name in family_names[1:]):
        return {}
    numeric_table = dict(_load_token_shop_values_extract().get("numeric_table") or {})
    family_entry = dict(numeric_table.get(canonical_family) or {})
    if not family_entry:
        return {}
    grounded: dict[str, Any] = {}
    max_level_value = family_entry.get("MaxLevel")
    if not isinstance(max_level_value, (int, float)):
        max_level_value = family_entry.get("FillMaxLevel")
    for key in ("StartCost", "AdditiveCost", "Bonus"):
        value = family_entry.get(key)
        if isinstance(value, (int, float)):
            grounded[key] = value
    if isinstance(max_level_value, (int, float)):
        grounded["MaxLevel"] = max_level_value
    if grounded:
        grounded["family"] = canonical_family
    return grounded


def _merge_grounded_token_shop_runtime_projection(
    runtime_projection: dict[str, Any] | None,
    *,
    row_value_fields: list[str] | None = None,
    ui_slots: list[str] | None = None,
) -> dict[str, Any]:
    projection = _normalize_token_shop_runtime_projection(runtime_projection)
    grounded = _grounded_token_shop_row_constants_from_fields(row_value_fields)
    if not grounded:
        return projection
    if projection.get("baseMaxLevel") is None and isinstance(grounded.get("MaxLevel"), (int, float)):
        max_level = grounded.get("MaxLevel")
        projection["baseMaxLevel"] = int(max_level) if float(max_level).is_integer() else float(max_level)
    if not projection.get("displayFormula"):
        cost_slots = [
            str(value).strip()
            for value in (ui_slots or [])
            if str(value).strip() and ("Cost" in str(value) or str(value).endswith("Text"))
        ]
        notes = [
            "Recovered directly from the TokenShop owner blob in the local Unity asset extract.",
            "Displayed runtime values can still diverge if evaluator-side transforms or modifiers apply on top of this base lane.",
        ]
        projection["displayFormula"] = {
            "status": "unresolved-runtime-modifiers",
            "expression": "DisplayedCost(level) = BaseCost(level) plus unresolved runtime modifiers/evaluator-side transforms",
            "groundedConstants": {
                key: value for key, value in grounded.items() if key in {"StartCost", "AdditiveCost", "Bonus", "MaxLevel"}
            },
            "displaySlots": cost_slots,
            "runtimeStatus": projection.get("runtimeStatus"),
            "instanceStatus": projection.get("instanceStatus"),
            "unresolvedDisplayValues": list(projection.get("unresolvedDisplayValues") or []),
            "notes": notes,
        }
    return _normalize_token_shop_runtime_projection(projection)


def _normalize_token_shop_runtime_projection(runtime_projection: dict[str, Any] | None) -> dict[str, Any]:
    projection = dict(runtime_projection or {})
    if not projection:
        return {}

    def _uniq_strings(values: Any) -> list[str]:
        return list(dict.fromkeys(str(value).strip() for value in (values or []) if str(value).strip()))

    global_noise_markers = ("shards", "academy", "loopmod", "researchmenu", "gearmenu")
    fast_buy_paths = [path.lower() for path in _uniq_strings(projection.get("fastBuyHierarchyPaths") or [])]
    fast_buy_status = str(projection.get("fastBuyStatus") or "").strip()
    fast_buy_global_only = bool(fast_buy_paths) and all(
        any(marker in path for marker in global_noise_markers) for path in fast_buy_paths
    )
    if fast_buy_status == "fast-buy-candidates-recovered" and fast_buy_global_only:
        fast_buy_status = "fast-buy-candidates-global-only"
    projection["fastBuyStatus"] = fast_buy_status or None

    for key in (
        "fastBuyTerms",
        "fastBuyOwners",
        "fastBuyFields",
        "fastBuyHierarchyPaths",
        "modifierTerms",
        "modifierOwners",
        "modifierMethods",
        "modifierFields",
        "runtimeSlotTargets",
        "unresolvedDisplayValues",
        "unresolvedInstanceValues",
        "canonicalInstanceLaneTerms",
    ):
        projection[key] = _uniq_strings(projection.get(key) or [])

    unresolved_runtime_targets = [
        value
        for value in _uniq_strings(projection.get("unresolvedRuntimeTargets") or [])
        if value != "displayed-cost-fast-buy-or-runtime-modifiers"
    ]
    if fast_buy_status == "fast-buy-candidates-row-local":
        unresolved_runtime_targets.append("fast-buy-runtime-quantity")
    else:
        unresolved_runtime_targets = [value for value in unresolved_runtime_targets if value != "fast-buy-runtime-quantity"]
        projection["fastBuyTerms"] = []
        projection["fastBuyOwners"] = []
        projection["fastBuyFields"] = []

    global_modifier_status = str(projection.get("globalModifierStatus") or "").strip()
    if global_modifier_status == "global-modifier-candidates-recovered":
        unresolved_runtime_targets.append("set-wide-cost-modifiers")

    unresolved_instance_values = [value.lower() for value in projection.get("unresolvedInstanceValues") or [] if value]
    evaluator_instance_targets: list[str] = []
    if any(
        any(marker in value for marker in ("costexponent", "calculationtype", "finalsetvalue", "displayed-cost"))
        for value in unresolved_instance_values
    ):
        unresolved_runtime_targets.append("runtime-evaluator-instance-formula")
    for value in unresolved_instance_values:
        if "costexponent" in value:
            evaluator_instance_targets.append("runtime-cost-exponent-instance-value")
        if "calculationtype" in value or "calculationstype" in value:
            evaluator_instance_targets.append("runtime-calculation-type-instance-value")
        if "finalsetvalue" in value:
            evaluator_instance_targets.append("runtime-final-set-value-instance-value")
        if "displayed-cost" in value or "evaluator expression" in value:
            evaluator_instance_targets.append("runtime-displayed-cost-expression")
        if "output/preview" in value or "output preview" in value:
            evaluator_instance_targets.append("runtime-output-preview-value")
    unresolved_runtime_targets.extend(evaluator_instance_targets)
    projection["unresolvedRuntimeTargets"] = list(dict.fromkeys(unresolved_runtime_targets))

    fast_buy_lane_terms = set(projection.get("fastBuyTerms") or []) | set(projection.get("fastBuyOwners") or []) | set(projection.get("fastBuyFields") or [])
    fast_buy_markers = ("FastBuy", "BUY x10", "AttachFastBuyButton", "StartFastBuyButtonHold", "BulkBuy")
    projection["canonicalInstanceLaneTerms"] = [
        value
        for value in _uniq_strings(projection.get("canonicalInstanceLaneTerms") or [])
        if fast_buy_status == "fast-buy-candidates-row-local"
        or (
            value not in fast_buy_lane_terms
            and not any(marker in value for marker in fast_buy_markers)
        )
    ]
    return projection


def _runtime_display_formula_fragment_from_trace_knowledge(
    trace_knowledge: dict[str, Any] | None,
    *,
    trace_scope: str = "",
    source_node_id: str = "",
    relation_kind: str = "",
) -> dict[str, Any]:
    knowledge = trace_knowledge if isinstance(trace_knowledge, dict) else {}
    row_recovery = dict(knowledge.get("rowRecovery") or {})
    if not row_recovery:
        return {}
    shell_field = str(row_recovery.get("shellField") or "").strip()
    formula_reconstruction = dict(row_recovery.get("formulaReconstruction") or {})
    runtime_evaluator = dict(row_recovery.get("runtimeEvaluatorRecovery") or {})
    runtime_instance = dict(row_recovery.get("runtimeInstanceRecovery") or {})
    presentation_update_path = dict(row_recovery.get("presentationUpdatePath") or {})
    closure_status = dict(row_recovery.get("closureStatus") or {})
    if not shell_field:
        return {}
    display_slots: list[str] = []
    for slot_entries in (presentation_update_path.get("slots") or {}).values():
        if not isinstance(slot_entries, list):
            continue
        for slot_entry in slot_entries:
            if not isinstance(slot_entry, dict):
                continue
            slot_name = str(slot_entry.get("name") or "").strip()
            if slot_name:
                display_slots.append(slot_name)
    display_slots = list(dict.fromkeys(display_slots))
    fragment_payload = {
        "traceScope": str(trace_scope or "").strip(),
        "sourceNodeId": str(source_node_id or "").strip(),
        "relationKind": str(relation_kind or "").strip(),
        "shellField": shell_field,
        "formulaReconstruction": formula_reconstruction,
        "runtimeEvaluatorRecovery": runtime_evaluator,
        "runtimeInstanceRecovery": runtime_instance,
        "presentationUpdatePath": presentation_update_path,
        "closureStatus": closure_status,
        "displaySlots": display_slots,
    }
    if not formula_reconstruction and not runtime_evaluator and not runtime_instance and not display_slots:
        return {}
    return fragment_payload


def _merge_runtime_display_formula_fragment(
    runtime_projection: dict[str, Any] | None,
    fragment_payload: dict[str, Any] | None,
) -> dict[str, Any]:
    projection = _normalize_token_shop_runtime_projection(runtime_projection)
    fragment = fragment_payload if isinstance(fragment_payload, dict) else {}
    if not fragment:
        return projection
    formula_reconstruction = dict(fragment.get("formulaReconstruction") or {})
    runtime_evaluator = dict(fragment.get("runtimeEvaluatorRecovery") or {})
    runtime_instance = dict(fragment.get("runtimeInstanceRecovery") or {})
    presentation_update_path = dict(fragment.get("presentationUpdatePath") or {})
    display_slots = [
        str(value).strip()
        for value in (
            fragment.get("displaySlots")
            or [
                str(item.get("name") or "").strip()
                for slot_entries in (presentation_update_path.get("slots") or {}).values()
                if isinstance(slot_entries, list)
                for item in slot_entries
                if isinstance(item, dict)
            ]
        )
        if str(value).strip()
    ]
    display_formula = dict(projection.get("displayFormula") or {})
    fragment_runtime_formula = dict(formula_reconstruction.get("runtimeCostModel") or {})
    fragment_inferred_formula = dict(formula_reconstruction.get("inferredCostModel") or {})
    if fragment_runtime_formula and not display_formula:
        display_formula = fragment_runtime_formula
    elif fragment_inferred_formula and not display_formula:
        display_formula = fragment_inferred_formula
    if display_formula:
        display_formula = dict(display_formula)
        if display_slots:
            existing_slots = [
                str(value).strip()
                for value in (display_formula.get("displaySlots") or [])
                if str(value).strip()
            ]
            display_formula["displaySlots"] = list(dict.fromkeys([*existing_slots, *display_slots]))
        projection["displayFormula"] = display_formula
    if display_slots:
        projection["runtimeSlotTargets"] = list(
            dict.fromkeys(
                [
                    *[str(value).strip() for value in (projection.get("runtimeSlotTargets") or []) if str(value).strip()],
                    *display_slots,
                ]
            )
        )
    grounded_constants = dict(formula_reconstruction.get("groundedConstants") or {})
    max_level_value = grounded_constants.get("MaxLevel")
    if projection.get("baseMaxLevel") is None and isinstance(max_level_value, (int, float)):
        projection["baseMaxLevel"] = int(max_level_value) if float(max_level_value).is_integer() else float(max_level_value)
    if not str(projection.get("evaluatorOwner") or "").strip() and str(runtime_evaluator.get("owner") or "").strip():
        projection["evaluatorOwner"] = str(runtime_evaluator.get("owner") or "").strip()
    if not str(projection.get("instanceOwner") or "").strip() and str(runtime_instance.get("instanceOwner") or "").strip():
        projection["instanceOwner"] = str(runtime_instance.get("instanceOwner") or "").strip()
    if not str(projection.get("creationMethod") or "").strip() and str(runtime_instance.get("creationMethod") or "").strip():
        projection["creationMethod"] = str(runtime_instance.get("creationMethod") or "").strip()
    if not str(projection.get("selectionKey") or "").strip() and str(runtime_instance.get("selectionKey") or "").strip():
        projection["selectionKey"] = str(runtime_instance.get("selectionKey") or "").strip()
    for key, fragment_values in (
        ("evaluatorMethods", runtime_evaluator.get("evaluatorMethods") or []),
        ("evaluatorFields", runtime_evaluator.get("evaluatorFields") or []),
        ("instanceFields", runtime_instance.get("instanceFields") or []),
        ("instanceAccessors", runtime_instance.get("instanceAccessors") or []),
        ("uiBindingArrays", runtime_instance.get("uiBindingArrays") or []),
        ("unresolvedDisplayValues", runtime_evaluator.get("unresolvedDisplayValues") or []),
        ("unresolvedInstanceValues", runtime_evaluator.get("unresolvedInstanceValues") or []),
    ):
        merged_values = list(
            dict.fromkeys(
                [
                    *[
                        str(value).strip()
                        for value in (projection.get(key) or [])
                        if str(value).strip()
                    ],
                    *[
                        str(value).strip()
                        for value in fragment_values
                        if str(value).strip()
                    ],
                ]
            )
        )
        if merged_values:
            projection[key] = merged_values
    unresolved_runtime_targets = list(
        dict.fromkeys(
            [
                *[
                    str(value).strip()
                    for value in (projection.get("unresolvedRuntimeTargets") or [])
                    if str(value).strip()
                ],
                *[
                    str(value).strip()
                    for value in ((fragment.get("closureStatus") or {}).get("unresolvedRuntimeTargets") or [])
                    if str(value).strip()
                ],
            ]
        )
    )
    if unresolved_runtime_targets:
        projection["unresolvedRuntimeTargets"] = unresolved_runtime_targets
    if not str(projection.get("instanceStatus") or "").strip() and str(runtime_instance.get("status") or "").strip():
        projection["instanceStatus"] = str(runtime_instance.get("status") or "").strip()
    if not str(projection.get("runtimeStatus") or "").strip() and str(runtime_evaluator.get("status") or "").strip():
        projection["runtimeStatus"] = str(runtime_evaluator.get("status") or "").strip()
    return _normalize_token_shop_runtime_projection(projection)


def _token_shop_runtime_projection_terms(runtime_projection: dict[str, Any] | None) -> dict[str, list[str]]:
    projection = _normalize_token_shop_runtime_projection(runtime_projection)
    if not projection:
        return {}
    evaluator_owner = str(projection.get("evaluatorOwner") or "").strip()
    next_cost_accessor = str(projection.get("nextCostAccessor") or "").strip()
    final_max_accessor = str(projection.get("finalMaxAccessor") or "").strip()
    display_formula = dict(projection.get("displayFormula") or {})
    formula_model_recovered = (
        str(display_formula.get("status") or "").strip() == "unresolved-runtime-modifiers"
        and projection.get("baseMaxLevel") is not None
        and bool(next_cost_accessor)
    )
    relation_targets: dict[str, list[str]] = {
        "getterTargets": [],
        "updaterTargets": [],
        "ownerTargets": [],
        "parameterTargets": [],
        "valueTargets": [],
        "instanceTargets": [],
        "runtimeSlotTargets": [],
    }
    if evaluator_owner:
        relation_targets["ownerTargets"].append(evaluator_owner)
    instance_owner = str(projection.get("instanceOwner") or "").strip()
    if instance_owner:
        relation_targets["ownerTargets"].append(instance_owner)
        relation_targets["instanceTargets"].append(instance_owner)
    creation_method = str(projection.get("creationMethod") or "").strip()
    if creation_method:
        relation_targets["instanceTargets"].append(creation_method)
    selection_key = str(projection.get("selectionKey") or "").strip()
    if selection_key:
        relation_targets["instanceTargets"].append(selection_key)
    if not formula_model_recovered:
        for term in [next_cost_accessor, final_max_accessor]:
            if term.startswith(("get_", "Get")):
                relation_targets["getterTargets"].append(term)
            elif term:
                relation_targets["valueTargets"].append(term)
    for method in [
        str(value).strip()
        for value in (projection.get("evaluatorMethods") or [])
        if str(value).strip()
    ]:
        if formula_model_recovered:
            if method in {"SetCostRelatedAttributes", "CalculateAndSetUpgradeCalculations", "BuyAndApplyUpgrade"}:
                relation_targets["updaterTargets"].append(method)
            continue
        if method.startswith(("get_", "Get")):
            relation_targets["getterTargets"].append(method)
        else:
            relation_targets["updaterTargets"].append(method)
    if not formula_model_recovered:
        for field in [
            str(value).strip()
            for value in (projection.get("evaluatorFields") or [])
            if str(value).strip()
        ]:
            relation_targets["parameterTargets"].append(field)
        for field in [
            str(value).strip()
            for value in (projection.get("instanceFields") or [])
            if str(value).strip()
        ]:
            relation_targets["parameterTargets"].append(field)
            relation_targets["instanceTargets"].append(field)
        for accessor in [
            str(value).strip()
            for value in (projection.get("instanceAccessors") or [])
            if str(value).strip()
        ]:
            if accessor.startswith(("get_", "Get")):
                relation_targets["getterTargets"].append(accessor)
            else:
                relation_targets["updaterTargets"].append(accessor)
        for value in [
            str(item).strip()
            for item in (projection.get("uiBindingArrays") or [])
            if str(item).strip()
        ]:
            relation_targets["parameterTargets"].append(value)
    for value in [
        str(item).strip()
        for item in (projection.get("runtimeSlotTargets") or [])
        if str(item).strip()
    ]:
        relation_targets["runtimeSlotTargets"].append(value)
    if not formula_model_recovered:
        for value in [
            str(item).strip()
            for item in (projection.get("canonicalInstanceLaneTerms") or [])
            if str(item).strip()
        ]:
            relation_targets["instanceTargets"].append(value)
            if value.startswith(("get_", "Get")):
                relation_targets["getterTargets"].append(value)
            elif value.endswith("Texts") or value.endswith("Buttons") or value.endswith("Overlays"):
                relation_targets["parameterTargets"].append(value)
            elif value[:1].isupper():
                relation_targets["ownerTargets"].append(value)
            else:
                relation_targets["parameterTargets"].append(value)
    for owner in [
        str(item).strip()
        for item in (
            list(projection.get("modifierOwners") or [])
            + list(projection.get("fastBuyOwners") or [])
        )
        if str(item).strip()
    ]:
        relation_targets["ownerTargets"].append(owner)
    for method in [
        str(item).strip()
        for item in (
            list(projection.get("modifierMethods") or [])
            + list(projection.get("fastBuyTerms") or [])
        )
        if str(item).strip()
    ]:
        if method.startswith(("get_", "Get")):
            relation_targets["getterTargets"].append(method)
        elif _looks_like_actionable_anchor_term(method):
            relation_targets["updaterTargets"].append(method)
        else:
            relation_targets["parameterTargets"].append(method)
    for field in [
        str(item).strip()
        for item in (
            list(projection.get("modifierFields") or [])
            + list(projection.get("fastBuyFields") or [])
        )
        if str(item).strip()
    ]:
        relation_targets["parameterTargets"].append(field)
    for term in [
        str(item).strip()
        for item in (projection.get("modifierTerms") or [])
        if str(item).strip()
    ]:
        if term.startswith(("get_", "Get")):
            relation_targets["getterTargets"].append(term)
        elif _looks_like_actionable_anchor_term(term):
            relation_targets["ownerTargets"].append(term)
        else:
            relation_targets["parameterTargets"].append(term)
    for field in [
        str(value).strip()
        for value in (display_formula.get("displaySlots") or [])
        if str(value).strip()
    ]:
        relation_targets["valueTargets"].append(field)
    return {
        key: list(dict.fromkeys(value for value in values if value))
        for key, values in relation_targets.items()
        if any(value for value in values)
    }


def _token_shop_runtime_seed_terms(
    runtime_projection: dict[str, Any] | None,
    support_kind: str = "",
) -> list[str]:
    projection = _normalize_token_shop_runtime_projection(runtime_projection)
    if not projection:
        return []
    normalized_support_kind = str(support_kind or "").strip()

    def _collect_terms(*groups: Any) -> list[str]:
        collected: list[str] = []
        for group in groups:
            if isinstance(group, (list, tuple)):
                for value in group:
                    term = str(value or "").strip()
                    if term:
                        collected.append(term)
                continue
            term = str(group or "").strip()
            if term:
                collected.append(term)
        return list(dict.fromkeys(collected))

    common_terms = _collect_terms(
        projection.get("creationMethod"),
        projection.get("instanceOwner"),
        projection.get("selectionKey"),
        projection.get("evaluatorOwner"),
    )
    instance_terms = _collect_terms(
        projection.get("instanceFields") or [],
        projection.get("instanceAccessors") or [],
        projection.get("canonicalInstanceLaneTerms") or [],
    )
    slot_terms = _collect_terms(
        projection.get("runtimeSlotTargets") or [],
        projection.get("uiBindingArrays") or [],
    )
    evaluator_terms = _collect_terms(
        projection.get("evaluatorMethods") or [],
        projection.get("evaluatorFields") or [],
        projection.get("nextCostAccessor"),
        projection.get("finalMaxAccessor"),
    )
    modifier_terms = _collect_terms(
        projection.get("modifierTerms") or [],
        projection.get("modifierOwners") or [],
        projection.get("modifierMethods") or [],
        projection.get("modifierFields") or [],
        projection.get("fastBuyTerms") or [],
        projection.get("fastBuyOwners") or [],
        projection.get("fastBuyFields") or [],
    )

    if normalized_support_kind == "runtimeSlotTargets":
        seed_terms = _collect_terms(
            slot_terms[:4],
            common_terms[:3],
            evaluator_terms[:4],
            modifier_terms[:6],
            ["SetCostRelatedAttributes", "CalculateAndSetUpgradeCalculations"],
        )
    elif normalized_support_kind == "instanceTargets":
        seed_terms = _collect_terms(
            common_terms[:4],
            instance_terms[:6],
            slot_terms[:2],
            evaluator_terms[:3],
            modifier_terms[:6],
        )
    elif normalized_support_kind in {"getterTargets", "parameterTargets", "ownerTargets"}:
        seed_terms = _collect_terms(
            evaluator_terms[:5],
            common_terms[:4],
            instance_terms[:8],
            slot_terms[:3],
            modifier_terms[:8],
        )
    else:
        seed_terms = _collect_terms(
            common_terms[:4],
            instance_terms[:4],
            slot_terms[:3],
            evaluator_terms[:4],
            modifier_terms[:6],
        )
    return seed_terms[:12]


def _token_shop_runtime_row_context_terms(row_payload: dict[str, Any] | None) -> list[str]:
    payload = row_payload if isinstance(row_payload, dict) else {}
    runtime_projection = _normalize_token_shop_runtime_projection(payload.get("runtimeProjection") or {})
    context_terms: list[str] = []
    for value in (
        payload.get("sourceAnchor"),
        payload.get("rowButton"),
        payload.get("actionHook"),
        runtime_projection.get("instanceOwner"),
        runtime_projection.get("creationMethod"),
        runtime_projection.get("selectionKey"),
        payload.get("ownerAnchor"),
        payload.get("resolvedDisplayUpdater"),
        payload.get("resolvedUiSlot"),
    ):
        term = str(value or "").strip()
        if term:
            context_terms.append(term)
    for key in ("bridgeAnchors", "bridgeTargets"):
        for value in payload.get(key) or []:
            term = str(value or "").strip()
            if term:
                context_terms.append(term)
    for key in ("updaterTargets", "getterTargets", "ownerTargets", "parameterTargets", "runtimeSlotTargets"):
        for value in payload.get(key) or []:
            term = str(value or "").strip()
            if term:
                context_terms.append(term)
    for key in ("rowValueFields", "uiSlots"):
        for value in payload.get(key) or []:
            term = str(value or "").strip()
            if term:
                context_terms.append(term)
    for key in ("requestedTerms",):
        for value in payload.get(key) or []:
            term = str(value or "").strip()
            if term:
                context_terms.append(term)
    for value in _token_shop_runtime_seed_terms(runtime_projection, "instanceTargets"):
        term = str(value or "").strip()
        if term:
            context_terms.append(term)
    return list(dict.fromkeys(context_terms))


def _token_shop_runtime_instance_layer_recovered(runtime_projection: dict[str, Any] | None) -> bool:
    projection = _normalize_token_shop_runtime_projection(runtime_projection)
    return str(projection.get("instanceStatus") or "").strip() == "instance-layer-recovered-values-open"


def _token_shop_runtime_display_seam_open(runtime_projection: dict[str, Any] | None) -> bool:
    projection = _normalize_token_shop_runtime_projection(runtime_projection)
    if not projection:
        return False
    if list(projection.get("runtimeSlotTargets") or []):
        return True
    if list(projection.get("unresolvedDisplayValues") or []):
        return True
    display_formula = dict(projection.get("displayFormula") or {})
    if list(display_formula.get("unresolvedDisplayValues") or []):
        return True
    return False


def _runtime_display_formula_target_covered(
    row_payload: dict[str, Any] | None,
    target_value: str,
) -> bool:
    payload = row_payload if isinstance(row_payload, dict) else {}
    runtime_projection = _normalize_token_shop_runtime_projection(payload.get("runtimeProjection") or {})
    if not runtime_projection:
        return False
    normalized_target = str(target_value or "").strip()
    unresolved_targets = {
        str(value).strip()
        for value in (runtime_projection.get("unresolvedRuntimeTargets") or [])
        if str(value).strip()
    }
    if normalized_target in {
        "runtime-evaluator-instance-formula",
        "runtime-cost-exponent-instance-value",
        "runtime-calculation-type-instance-value",
        "runtime-final-set-value-instance-value",
        "runtime-displayed-cost-expression",
        "runtime-output-preview-value",
        "fast-buy-runtime-quantity",
        "set-wide-cost-modifiers",
    }:
        return normalized_target not in unresolved_targets
    if normalized_target == "runtime-display-formula":
        if unresolved_targets:
            return False
        display_formula = dict(runtime_projection.get("displayFormula") or {})
        if str(display_formula.get("status") or "").strip() == "unresolved-runtime-modifiers":
            return False
        return bool(display_formula or runtime_projection.get("runtimeSlotTargets") or runtime_projection.get("displayValue"))
    return False


def _is_runtime_semantic_symbolic_target(value: str) -> bool:
    normalized = str(value or "").strip()
    return normalized in {
        "runtime-evaluator-instance-formula",
        "runtime-cost-exponent-instance-value",
        "runtime-calculation-type-instance-value",
        "runtime-final-set-value-instance-value",
        "runtime-displayed-cost-expression",
        "runtime-output-preview-value",
        "fast-buy-runtime-quantity",
        "set-wide-cost-modifiers",
        "runtime-display-formula",
    }


def _merge_token_shop_runtime_projection_template(
    runtime_projection: dict[str, Any] | None,
    template_projection: dict[str, Any] | None,
) -> dict[str, Any]:
    base = _normalize_token_shop_runtime_projection(runtime_projection)
    template = _normalize_token_shop_runtime_projection(template_projection)
    if not base:
        return template
    if not template or _token_shop_runtime_instance_layer_recovered(base):
        return base
    if str(base.get("evaluatorOwner") or "").strip() != str(template.get("evaluatorOwner") or "").strip():
        return base
    if str(base.get("nextCostAccessor") or "").strip() != str(template.get("nextCostAccessor") or "").strip():
        return base
    merged = dict(base)
    for key in ("instanceOwner", "creationMethod", "selectionKey"):
        if not str(merged.get(key) or "").strip() and str(template.get(key) or "").strip():
            merged[key] = template.get(key)
    for key in ("instanceFields", "instanceAccessors", "uiBindingArrays", "runtimeSlotTargets"):
        merged_values = [
            str(value).strip()
            for value in (merged.get(key) or [])
            if str(value).strip()
        ]
        template_values = [
            str(value).strip()
            for value in (template.get(key) or [])
            if str(value).strip()
        ]
        merged[key] = list(dict.fromkeys([*merged_values, *template_values]))
    merged["instanceStatus"] = str(template.get("instanceStatus") or merged.get("instanceStatus") or "").strip() or None
    display_formula = dict(merged.get("displayFormula") or {})
    template_formula = dict(template.get("displayFormula") or {})
    if template_formula:
        display_formula.setdefault("instanceStatus", template_formula.get("instanceStatus"))
        merged["displayFormula"] = display_formula
    return merged


def _iter_projection_target_terms(payload: dict[str, Any]) -> Iterator[tuple[str, str]]:
    excluded_keys = {
        "ownerAnchor",
        "owner",
        "actionHook",
        "rowButton",
        "subjectId",
        "sourceAnchor",
        "sourceShape",
        "traceScopes",
        "supportingScopes",
        "supportingRowButtons",
        "sampleActionHooks",
        "supportingPrefabs",
        "relationKinds",
        "relationCounts",
        "projectionCompleteness",
        "ownedStatePopulationBridgeRecovered",
        "saveFamilyOverlapClear",
        "bridgeAnchors",
        "requestedTerms",
    }
    for support_kind, value in _iter_projection_actionable_terms(payload):
        if support_kind in excluded_keys:
            continue
        yield support_kind, value


def _projection_pair_penalty(
    source_node_id: str,
    target_node_id: str,
    support_kind: str,
    projection_kind: str = "",
    payload: dict[str, Any] | None = None,
) -> float:
    source_value = str(source_node_id or "").strip()
    target_value = str(target_node_id or "").strip()
    kind_value = str(support_kind or "").strip().lower()
    penalty = 0.0
    if not _projection_pair_is_plausible(source_value, target_value, support_kind, projection_kind, payload):
        return 1_000.0
    source_shape = _projection_term_shape(source_value)
    target_shape = _projection_term_shape(target_value)
    if source_value.startswith(("get_", "Get")) and target_value.endswith(("Button", "Overlay", "Content", "MaxOverlay")):
        penalty += 90.0
    if source_value.endswith("Button") and target_value.startswith(("get_", "Get")):
        penalty += 35.0
    if "bridge" in kind_value and target_value.endswith(("Overlay", "Content", "MaxOverlay")):
        penalty += 25.0
    if kind_value == "bridgetargets":
        context_terms = _projection_runtime_context_terms(payload or {}, source_value)
        context_tokens: set[str] = set()
        for term in context_terms:
            context_tokens.update(_projection_identity_tokens(term))
        target_tokens = _projection_identity_tokens(target_value)
        shared_token_count = len(context_tokens & target_tokens)
        if shared_token_count == 0:
            penalty += 120.0
        elif shared_token_count == 1:
            penalty += 20.0
        if source_shape == "action" and target_shape == "value-field":
            penalty -= 8.0
        if source_shape in {"updater", "owner"} and target_shape in {"getter", "value-field"}:
            penalty -= 5.0
    if not _contains_domain_signal(source_value) and not _contains_domain_signal(target_value):
        penalty += 20.0
    return penalty


def _button_row_tokens(values: list[str]) -> set[str]:
    tokens: set[str] = set()
    for value in values:
        value_text = str(value or "").strip()
        if not value_text:
            continue
        derived = _projection_non_generic_tokens(value_text) or _projection_identity_tokens(value_text)
        tokens.update(derived)
    return tokens


def _button_row_family_heads(values: list[str]) -> set[str]:
    suffixes = (
        "StartCost",
        "AdditiveCost",
        "Bonus",
        "FillMaxLevel",
        "MaxLevel",
        "Fill",
    )
    heads: set[str] = set()
    for value in values:
        value_text = str(value or "").strip()
        if not value_text:
            continue
        for suffix in suffixes:
            if value_text.endswith(suffix) and len(value_text) > len(suffix):
                heads.add(value_text[: -len(suffix)])
                break
    return heads


def _action_family_head(value: str) -> str:
    text = str(value or "").strip()
    if text.endswith("Enum"):
        text = text[:-4]
    for prefix in ("Buy", "Claim", "GoTo"):
        if text.startswith(prefix) and len(text) > len(prefix):
            return text[len(prefix) :]
    return ""


def _synthesize_button_actions_from_row_terms(values: list[str]) -> list[str]:
    heads = sorted(_button_row_family_heads(values))
    actions: list[str] = []
    explicit_map = {
        "TokenDailiesT2": "BuyTokenDailyT2",
        "TokenDailiesT3": "BuyTokenDailyT3",
        "T2Duo1": "BuyDuo1Boost",
        "T2Duo2": "BuyDuo2Boost",
        "T2Duo3": "BuyDuo3Boost",
        "T2Duo4": "BuyDuo4Boost",
        "T2Duo5": "BuyDuo5Boost",
    }
    for head in heads:
        explicit_action = explicit_map.get(head)
        if explicit_action:
            actions.append(explicit_action)
            continue
        if re.fullmatch(r"(TokenBoost|DiamondBoost|CellBoost|ModBoost|MK\d+TokenBoost|ATU\d+|LM\d+)", head):
            actions.append(f"Buy{head}")
    return actions


def _preferred_button_actions_from_runtime_terms(values: list[str]) -> list[str]:
    actions: list[str] = []
    seen: set[str] = set()
    patterns = (
        r"get_Final(?P<head>MK\d+TokenBoost)FillMaxLevel",
        r"get_Final(?P<head>ATU\d+)MaxLevel",
        r"get_Final(?P<head>TokenBoost)FillMaxLevel",
        r"get_Final(?P<head>DiamondBoost)FillMaxLevel",
        r"get_Final(?P<head>CellBoost)FillMaxLevel",
        r"get_Final(?P<head>ModBoost)FillMaxLevel",
    )
    for value in values:
        term = str(value or "").strip()
        if not term:
            continue
        for pattern in patterns:
            match = re.fullmatch(pattern, term)
            if not match:
                continue
            head = str(match.group("head") or "").strip()
            if not head:
                continue
            action = f"Buy{head}"
            if action not in seen:
                seen.add(action)
                actions.append(action)
            break
    return actions


def _token_shop_row_scope_for_button(button_id: str) -> str:
    match = re.fullmatch(r"ATU(\d+)Button", str(button_id or "").strip())
    if not match:
        return ""
    row_number = int(match.group(1))
    if 14 <= row_number <= 19:
        return "token-shop-daily-tokenium-family"
    if 21 <= row_number <= 23:
        return "token-shop-t3-trio-family"
    if 24 <= row_number <= 28:
        return "token-shop-late-atu-family"
    if row_number == 20:
        return "token-shop-t3-trio-family"
    if row_number == 13:
        return "token-shop-daily-tokenium-family"
    if row_number == 4:
        return "token-shop-atu4-mod"
    if row_number == 3:
        return "token-shop-atu3-cells-effect"
    if row_number in {5, 6, 7, 8, 9, 10, 11, 12}:
        return "token-shop-atu3-cells-effect"
    return "token-shop-family-structure"


def _token_shop_raw_row_records() -> list[dict[str, Any]]:
    extract = _load_token_shop_values_extract()
    fields = extract.get("fields") if isinstance(extract, dict) else None
    if not isinstance(fields, list):
        return []
    suffixes = (
        "StartCost",
        "AdditiveCost",
        "Bonus",
        "FillMaxLevel",
        "MaxLevel",
        "Fill",
    )
    raw_rows: list[dict[str, Any]] = []
    current_family_head = ""
    current_value_fields: list[str] = []
    pending_row: dict[str, Any] | None = None

    def flush_pending_row() -> None:
        nonlocal pending_row
        if not pending_row:
            return
        if pending_row.get("button"):
            pending_row["traceScope"] = _token_shop_row_scope_for_button(str(pending_row.get("button") or "").strip())
            raw_rows.append(pending_row)
        pending_row = None

    for entry in fields:
        if not isinstance(entry, dict):
            continue
        field_name = str(entry.get("field") or "").strip()
        if not field_name:
            continue
        matched_suffix = ""
        for suffix in suffixes:
            if field_name.endswith(suffix) and len(field_name) > len(suffix):
                matched_suffix = suffix
                break
        if matched_suffix:
            flush_pending_row()
            family_head = field_name[: -len(matched_suffix)]
            if family_head != current_family_head:
                current_family_head = family_head
                current_value_fields = []
            current_value_fields.append(field_name)
            continue
        button_match = re.fullmatch(r"ATU\d+Button", field_name)
        if button_match:
            flush_pending_row()
            pending_row = {
                "button": field_name,
                "familyHead": current_family_head,
                "valueFields": list(current_value_fields),
                "uiSlots": [],
            }
            continue
        if pending_row and re.fullmatch(r"ATU\d+(?:MaxOverlay|Overlay|Content)", field_name):
            pending_row["uiSlots"].append(field_name)
            continue
        flush_pending_row()
    flush_pending_row()
    return raw_rows


def _button_progress_bonus(value: str) -> float:
    text = str(value or "").strip()
    match = re.fullmatch(r"ATU(\d+)Button", text)
    if not match:
        return 0.0
    index = int(match.group(1))
    return max(0.0, 24.0 - float(index))


def _graph_walk_pair_is_plausible(
    source_node_id: str,
    relation_kind: str,
    target_node_id: str,
    *,
    bridge_kind: str,
) -> bool:
    source_value = str(source_node_id or "").strip()
    target_value = str(target_node_id or "").strip()
    relation_value = str(relation_kind or "").strip()
    bridge_value = str(bridge_kind or "").strip()
    if not source_value or not target_value or not relation_value:
        return False
    source_shape = _projection_term_shape(source_value)
    target_shape = _projection_term_shape(target_value)
    source_family_tokens = _projection_family_tokens(source_value)
    target_family_tokens = _projection_family_tokens(target_value)

    if relation_value == "exact-shell-to-action-hook":
        return target_shape == "action"
    if relation_value == "exact-shell-to-prefab":
        return target_shape == "prefab"
    if relation_value == "getter-family":
        return source_shape in {"owner", "symbol"} and target_shape == "getter"
    if relation_value == "returns-value-from":
        return source_shape == "getter" and target_shape in {"value-field", "symbol", "owner"}

    if bridge_value == "direct-terminus":
        if relation_value == "binds-ui-slot":
            if source_shape in {"button", "owner"} and target_shape in {"value-field", "ui-shell"}:
                return False
        if relation_value == "owns-field":
            if source_shape == "owner" and target_shape == "value-field":
                if not source_family_tokens:
                    return False
                if not target_family_tokens or not (source_family_tokens & target_family_tokens):
                    return False
        if relation_value == "owns-method":
            if source_shape == "owner" and target_shape in {"getter", "updater", "action"}:
                if not source_family_tokens and not target_family_tokens:
                    return False
        if relation_value == "uses-raw-value":
            if source_shape in {"owner", "button", "ui-shell"}:
                return False
        if relation_value == "serialized-adjacency":
            if source_shape in {"owner", "button"} and target_shape in {"button", "ui-shell", "value-field"}:
                return False
    return True


def _supports_native_negative_edge_verification(relation_kind: str, source_node_id: str, target_node_id: str) -> bool:
    normalized = str(relation_kind or "").strip()
    source_value = str(source_node_id or "").strip()
    target_value = str(target_node_id or "").strip()
    supported_relations = {
        "exact-shell-to-action-hook",
        "exact-shell-to-prefab",
        "exact-display-update-path",
        "save-owner-recovery",
        "binds-ui-slot",
        "returns-value-from",
        "getter-family",
    }
    if normalized not in supported_relations:
        return False
    if not _looks_like_actionable_anchor_term(source_value):
        return False
    if not _looks_like_actionable_anchor_term(target_value):
        return False
    return True


class TraceGraphDBV2:
    def __init__(self, db_path: Path | None = None):
        self.db_path = Path(db_path or DEFAULT_DB_PATH)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._schema_ready = False

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("PRAGMA foreign_keys = ON")
            conn.execute("PRAGMA busy_timeout = 30000")
            conn.execute("PRAGMA synchronous = NORMAL")
            yield conn
            conn.commit()
        finally:
            conn.close()

    def ensure_schema(self) -> None:
        if self._schema_ready:
            return
        with self.connect() as conn:
            conn.execute("PRAGMA journal_mode = WAL")
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS engine_v2_meta (
                    meta_key TEXT PRIMARY KEY,
                    meta_value TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS trace_events_v2 (
                    event_id TEXT PRIMARY KEY,
                    source_run_id TEXT NOT NULL,
                    source_kind TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    request_signature TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_trace_events_v2_scope
                    ON trace_events_v2(trace_scope, source_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS semantic_fragments_v2 (
                    fragment_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    fragment_kind TEXT NOT NULL,
                    fragment_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_semantic_fragments_v2_scope
                    ON semantic_fragments_v2(trace_scope, fragment_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS ui_binding_fragments_v2 (
                    fragment_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    binding_kind TEXT NOT NULL,
                    binding_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_ui_binding_fragments_v2_scope
                    ON ui_binding_fragments_v2(trace_scope, binding_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS managed_graph_fragments_v2 (
                    fragment_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    graph_kind TEXT NOT NULL,
                    graph_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_managed_graph_fragments_v2_scope
                    ON managed_graph_fragments_v2(trace_scope, graph_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS static_symbol_fragments_v2 (
                    fragment_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    symbol_kind TEXT NOT NULL,
                    symbol_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_static_symbol_fragments_v2_scope
                    ON static_symbol_fragments_v2(trace_scope, symbol_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS native_value_fragments_v2 (
                    fragment_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    value_kind TEXT NOT NULL,
                    value_key TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_native_value_fragments_v2_scope
                    ON native_value_fragments_v2(trace_scope, value_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS structure_ir_nodes_v2 (
                    node_id TEXT PRIMARY KEY,
                    node_kind TEXT NOT NULL,
                    canonical_label TEXT NOT NULL,
                    normalized_key TEXT NOT NULL,
                    first_seen_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_structure_ir_nodes_v2_kind
                    ON structure_ir_nodes_v2(node_kind, updated_at DESC);

                CREATE TABLE IF NOT EXISTS structure_ir_edges_v2 (
                    edge_id TEXT PRIMARY KEY,
                    source_node_id TEXT NOT NULL,
                    edge_kind TEXT NOT NULL,
                    target_node_id TEXT NOT NULL,
                    field_key TEXT NOT NULL DEFAULT '',
                    edge_status TEXT NOT NULL DEFAULT 'candidate',
                    value_semantics TEXT NOT NULL DEFAULT 'unknown',
                    support_count INTEGER NOT NULL DEFAULT 0,
                    contradiction_count INTEGER NOT NULL DEFAULT 0,
                    first_seen_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_structure_ir_edges_v2_source
                    ON structure_ir_edges_v2(source_node_id, edge_kind, edge_status, updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_structure_ir_edges_v2_target
                    ON structure_ir_edges_v2(target_node_id, edge_kind, edge_status, updated_at DESC);

                CREATE TABLE IF NOT EXISTS structure_ir_observations_v2 (
                    observation_id TEXT PRIMARY KEY,
                    edge_id TEXT NOT NULL,
                    source_run_id TEXT NOT NULL,
                    source_kind TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    observation_status TEXT NOT NULL,
                    confidence REAL NOT NULL DEFAULT 0,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_structure_ir_observations_v2_edge
                    ON structure_ir_observations_v2(edge_id, created_at DESC);

                CREATE TABLE IF NOT EXISTS structure_ir_derivations_v2 (
                    derivation_id TEXT PRIMARY KEY,
                    derivation_kind TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    input_fingerprint TEXT NOT NULL,
                    output_fingerprint TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_structure_ir_derivations_v2_scope
                    ON structure_ir_derivations_v2(trace_scope, derivation_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS graph_nodes_v2 (
                    node_id TEXT PRIMARY KEY,
                    node_kind TEXT NOT NULL,
                    canonical_label TEXT NOT NULL,
                    normalized_key TEXT NOT NULL,
                    node_status TEXT NOT NULL DEFAULT 'active',
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_graph_nodes_v2_kind
                    ON graph_nodes_v2(node_kind, updated_at DESC);

                CREATE TABLE IF NOT EXISTS graph_edges_v2 (
                    edge_id TEXT PRIMARY KEY,
                    source_node_id TEXT NOT NULL,
                    relation_kind TEXT NOT NULL,
                    target_node_id TEXT NOT NULL,
                    field_key TEXT NOT NULL DEFAULT '',
                    edge_status TEXT NOT NULL DEFAULT 'candidate',
                    value_semantics TEXT NOT NULL DEFAULT 'unknown',
                    support_count INTEGER NOT NULL DEFAULT 0,
                    contradiction_count INTEGER NOT NULL DEFAULT 0,
                    first_seen_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_edges_v2_identity
                    ON graph_edges_v2(source_node_id, relation_kind, target_node_id, field_key);
                CREATE INDEX IF NOT EXISTS idx_graph_edges_v2_source
                    ON graph_edges_v2(source_node_id, relation_kind, edge_status, updated_at DESC);
                CREATE INDEX IF NOT EXISTS idx_graph_edges_v2_target
                    ON graph_edges_v2(target_node_id, relation_kind, edge_status, updated_at DESC);

                CREATE TABLE IF NOT EXISTS graph_edge_support_v2 (
                    support_id TEXT PRIMARY KEY,
                    edge_id TEXT NOT NULL,
                    support_kind TEXT NOT NULL,
                    support_value TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_graph_edge_support_v2_edge
                    ON graph_edge_support_v2(edge_id, support_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS graph_edge_observations_v2 (
                    observation_id TEXT PRIMARY KEY,
                    edge_id TEXT NOT NULL,
                    trace_scope TEXT NOT NULL,
                    source_run_id TEXT NOT NULL,
                    source_kind TEXT NOT NULL,
                    observation_status TEXT NOT NULL,
                    confidence REAL NOT NULL DEFAULT 0,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_graph_edge_observations_v2_edge
                    ON graph_edge_observations_v2(edge_id, created_at DESC);

                CREATE TABLE IF NOT EXISTS graph_anchor_checks_v2 (
                    check_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    relation_kind TEXT NOT NULL,
                    anchor_term TEXT NOT NULL,
                    anchor_role TEXT NOT NULL,
                    check_status TEXT NOT NULL,
                    checked_count INTEGER NOT NULL DEFAULT 0,
                    last_request_signature TEXT NOT NULL DEFAULT '',
                    graph_context_digest TEXT NOT NULL DEFAULT '',
                    reopen_fingerprint TEXT NOT NULL DEFAULT '',
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_anchor_checks_v2_identity
                    ON graph_anchor_checks_v2(trace_scope, relation_kind, anchor_term, anchor_role);

                CREATE TABLE IF NOT EXISTS graph_pair_checks_v2 (
                    check_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    relation_kind TEXT NOT NULL,
                    source_node_id TEXT NOT NULL,
                    target_node_id TEXT NOT NULL,
                    check_status TEXT NOT NULL,
                    checked_count INTEGER NOT NULL DEFAULT 0,
                    last_request_signature TEXT NOT NULL DEFAULT '',
                    graph_context_digest TEXT NOT NULL DEFAULT '',
                    reopen_fingerprint TEXT NOT NULL DEFAULT '',
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_pair_checks_v2_identity
                    ON graph_pair_checks_v2(trace_scope, relation_kind, source_node_id, target_node_id);

                CREATE TABLE IF NOT EXISTS graph_path_checks_v2 (
                    check_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    relation_kind TEXT NOT NULL,
                    path_fingerprint TEXT NOT NULL,
                    check_status TEXT NOT NULL,
                    checked_count INTEGER NOT NULL DEFAULT 0,
                    last_request_signature TEXT NOT NULL DEFAULT '',
                    graph_context_digest TEXT NOT NULL DEFAULT '',
                    reopen_fingerprint TEXT NOT NULL DEFAULT '',
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_path_checks_v2_identity
                    ON graph_path_checks_v2(trace_scope, relation_kind, path_fingerprint);

                CREATE TABLE IF NOT EXISTS execution_attempts_v2 (
                    attempt_id TEXT PRIMARY KEY,
                    trace_scope TEXT NOT NULL,
                    relation_kind TEXT NOT NULL,
                    obligation_id TEXT NOT NULL DEFAULT '',
                    source_node_id TEXT NOT NULL DEFAULT '',
                    target_node_id TEXT NOT NULL DEFAULT '',
                    request_signature TEXT NOT NULL DEFAULT '',
                    attempt_status TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_execution_attempts_v2_scope
                    ON execution_attempts_v2(trace_scope, relation_kind, attempt_status, updated_at DESC);

                CREATE TABLE IF NOT EXISTS graph_obligations_v2 (
                    obligation_id TEXT PRIMARY KEY,
                    obligation_kind TEXT NOT NULL,
                    relation_kind TEXT NOT NULL,
                    source_node_id TEXT NOT NULL DEFAULT '',
                    target_node_id TEXT NOT NULL DEFAULT '',
                    preferred_trace_scope TEXT NOT NULL DEFAULT '',
                    obligation_status TEXT NOT NULL DEFAULT 'open',
                    priority REAL NOT NULL DEFAULT 0,
                    support_count INTEGER NOT NULL DEFAULT 0,
                    last_graph_context_digest TEXT NOT NULL DEFAULT '',
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_graph_obligations_v2_status
                    ON graph_obligations_v2(obligation_status, obligation_kind, priority DESC, updated_at DESC);

                CREATE TABLE IF NOT EXISTS graph_obligation_support_v2 (
                    support_id TEXT PRIMARY KEY,
                    obligation_id TEXT NOT NULL,
                    support_kind TEXT NOT NULL,
                    support_ref TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_graph_obligation_support_v2_obligation
                    ON graph_obligation_support_v2(obligation_id, support_kind, created_at DESC);

                CREATE TABLE IF NOT EXISTS consumer_projections_v2 (
                    projection_id TEXT PRIMARY KEY,
                    projection_kind TEXT NOT NULL,
                    subject_id TEXT NOT NULL,
                    trace_scope TEXT NOT NULL DEFAULT '',
                    projection_status TEXT NOT NULL DEFAULT 'active',
                    payload_json TEXT NOT NULL,
                    provenance_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_consumer_projections_v2_kind
                    ON consumer_projections_v2(projection_kind, projection_status, updated_at DESC);
                """
            )
            conn.execute(
                """
                INSERT INTO engine_v2_meta(meta_key, meta_value)
                VALUES('schema_version', ?)
                ON CONFLICT(meta_key) DO UPDATE SET meta_value = excluded.meta_value
                """,
                (str(V2_SCHEMA_VERSION),),
            )
        self._schema_ready = True

    def bootstrap_from_v1_core(self) -> dict[str, int]:
        self.ensure_schema()
        counts = {
            "irNodes": 0,
            "irEdges": 0,
            "graphNodes": 0,
            "graphEdges": 0,
            "graphObservations": 0,
            "anchorChecks": 0,
        }
        with self.connect() as conn:
            canonical_rows = conn.execute(
                """
                SELECT source_node_id, edge_kind, target_node_id, field_key, edge_status,
                       relation_role, value_semantics, positive_observation_count,
                       negative_observation_count, support_scope_count, payload_json,
                       provenance_json, updated_at
                FROM canonical_graph_edges
                ORDER BY updated_at ASC
                """
            ).fetchall()
            for row in canonical_rows:
                source_node_id = str(row["source_node_id"] or "").strip()
                target_node_id = str(row["target_node_id"] or "").strip()
                if not source_node_id or not target_node_id:
                    continue
                for node_id in (source_node_id, target_node_id):
                    self._upsert_v2_node(
                        conn,
                        "graph_nodes_v2",
                        node_id=node_id,
                        node_kind=_infer_node_kind(node_id),
                        payload={"origin": "bootstrap-v1-canonical-graph"},
                        provenance={"sourceTable": "canonical_graph_edges"},
                        updated_at=str(row["updated_at"] or _now_iso()),
                    )
                    self._upsert_v2_node(
                        conn,
                        "structure_ir_nodes_v2",
                        node_id=node_id,
                        node_kind=_infer_node_kind(node_id),
                        payload={"origin": "bootstrap-v1-canonical-graph"},
                        provenance={"sourceTable": "canonical_graph_edges"},
                        updated_at=str(row["updated_at"] or _now_iso()),
                    )
                edge_id = self._upsert_v2_edge(
                    conn,
                    "graph_edges_v2",
                    source_node_id=source_node_id,
                    relation_kind=str(row["edge_kind"] or "").strip(),
                    target_node_id=target_node_id,
                    field_key=str(row["field_key"] or "").strip(),
                    edge_status=str(row["edge_status"] or "").strip() or "candidate",
                    value_semantics=str(row["value_semantics"] or "").strip() or "unknown",
                    support_count=int(row["positive_observation_count"] or 0),
                    contradiction_count=int(row["negative_observation_count"] or 0),
                    payload=_json_loads(row["payload_json"], {}),
                    provenance=_json_loads(row["provenance_json"], {}),
                    updated_at=str(row["updated_at"] or _now_iso()),
                )
                self._upsert_v2_edge(
                    conn,
                    "structure_ir_edges_v2",
                    source_node_id=source_node_id,
                    relation_kind=str(row["edge_kind"] or "").strip(),
                    target_node_id=target_node_id,
                    field_key=str(row["field_key"] or "").strip(),
                    edge_status=str(row["edge_status"] or "").strip() or "candidate",
                    value_semantics=str(row["value_semantics"] or "").strip() or "unknown",
                    support_count=int(row["positive_observation_count"] or 0),
                    contradiction_count=int(row["negative_observation_count"] or 0),
                    payload=_json_loads(row["payload_json"], {}),
                    provenance=_json_loads(row["provenance_json"], {}),
                    updated_at=str(row["updated_at"] or _now_iso()),
                )
                counts["graphEdges"] += 1
                counts["irEdges"] += 1
                counts["graphNodes"] += 2
                counts["irNodes"] += 2
                if edge_id:
                    support_id = _stable_key(["v2-support", edge_id, "bootstrap-v1"])
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO graph_edge_support_v2(
                            support_id, edge_id, support_kind, support_value, trace_scope,
                            payload_json, provenance_json, created_at
                        ) VALUES(?,?,?,?,?,?,?,?)
                        """,
                        (
                            support_id,
                            edge_id,
                            "bootstrap-v1",
                            "canonical-graph",
                            "",
                            _json_dumps({"supportScopeCount": int(row["support_scope_count"] or 0)}),
                            _json_dumps({"sourceTable": "canonical_graph_edges"}),
                            str(row["updated_at"] or _now_iso()),
                        ),
                    )
            evidence_rows = conn.execute(
                """
                SELECT trace_scope, graph_scope, source_node_id, edge_kind, target_node_id, field_key,
                       edge_status, source_layer, relation_role, value_semantics, payload_json,
                       provenance_json, updated_at
                FROM evidence_graph_edges
                ORDER BY updated_at ASC
                """
            ).fetchall()
            for row in evidence_rows:
                source_node_id = str(row["source_node_id"] or "").strip()
                target_node_id = str(row["target_node_id"] or "").strip()
                relation_kind = str(row["edge_kind"] or "").strip()
                if not source_node_id or not target_node_id or not relation_kind:
                    continue
                edge_id = _stable_key(["v2-edge", source_node_id, relation_kind, target_node_id, str(row["field_key"] or "").strip()])
                observation_id = _stable_key(
                    [
                        "v2-observation",
                        edge_id,
                        str(row["trace_scope"] or "").strip(),
                        str(row["source_layer"] or "").strip(),
                        str(row["updated_at"] or "").strip(),
                    ]
                )
                payload = _json_loads(row["payload_json"], {})
                provenance = _json_loads(row["provenance_json"], {})
                conn.execute(
                    """
                    INSERT OR REPLACE INTO graph_edge_observations_v2(
                        observation_id, edge_id, trace_scope, source_run_id, source_kind,
                        observation_status, confidence, payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        observation_id,
                        edge_id,
                        str(row["trace_scope"] or "").strip(),
                        "",
                        str(row["source_layer"] or "").strip() or "bootstrap-v1",
                        str(row["edge_status"] or "").strip() or "candidate",
                        1.0 if str(row["edge_status"] or "").strip() == "present" else 0.5,
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        str(row["updated_at"] or _now_iso()),
                    ),
                )
                conn.execute(
                    """
                    INSERT OR REPLACE INTO structure_ir_observations_v2(
                        observation_id, edge_id, source_run_id, source_kind, trace_scope,
                        observation_status, confidence, payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        observation_id,
                        edge_id,
                        "",
                        str(row["source_layer"] or "").strip() or "bootstrap-v1",
                        str(row["trace_scope"] or "").strip(),
                        str(row["edge_status"] or "").strip() or "candidate",
                        1.0 if str(row["edge_status"] or "").strip() == "present" else 0.5,
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        str(row["updated_at"] or _now_iso()),
                    ),
                )
                counts["graphObservations"] += 1
            anchor_rows = conn.execute(
                """
                SELECT trace_scope, seam_id, anchor_term, anchor_role, check_status, checked_count,
                       last_request_signature, payload_json, provenance_json, built_at
                FROM graph_anchor_checks
                ORDER BY built_at ASC
                """
            ).fetchall()
            for row in anchor_rows:
                check_id = _stable_key(
                    [
                        "v2-anchor-check",
                        str(row["trace_scope"] or "").strip(),
                        str(row["seam_id"] or "").strip(),
                        str(row["anchor_term"] or "").strip(),
                        str(row["anchor_role"] or "").strip(),
                    ]
                )
                conn.execute(
                    """
                    INSERT OR REPLACE INTO graph_anchor_checks_v2(
                        check_id, trace_scope, relation_kind, anchor_term, anchor_role,
                        check_status, checked_count, last_request_signature,
                        graph_context_digest, reopen_fingerprint,
                        payload_json, provenance_json, updated_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        check_id,
                        str(row["trace_scope"] or "").strip(),
                        str(row["seam_id"] or "").strip(),
                        str(row["anchor_term"] or "").strip(),
                        str(row["anchor_role"] or "").strip(),
                        str(row["check_status"] or "").strip(),
                        int(row["checked_count"] or 0),
                        str(row["last_request_signature"] or "").strip(),
                        "",
                        "",
                        str(row["payload_json"] or "{}"),
                        str(row["provenance_json"] or "{}"),
                        str(row["built_at"] or _now_iso()),
                    ),
                )
                counts["anchorChecks"] += 1
        return counts

    def bootstrap_from_v1_evidence(self) -> dict[str, int]:
        self.ensure_schema()
        counts = {
            "traceEvents": 0,
            "semanticFragments": 0,
            "uiBindingFragments": 0,
            "managedGraphFragments": 0,
            "staticSymbolFragments": 0,
            "nativeValueFragments": 0,
        }
        with self.connect() as conn:
            trace_rows = conn.execute(
                """
                SELECT trace_scope, fragment_kind, fragment_key, payload_json, source_job_id,
                       source_term, confidence, created_at, updated_at
                FROM trace_fragments
                WHERE is_valid = 1
                ORDER BY updated_at ASC, fragment_id ASC
                """
            ).fetchall()
            for row in trace_rows:
                trace_scope = str(row["trace_scope"] or "").strip()
                fragment_kind = str(row["fragment_kind"] or "").strip()
                fragment_key = str(row["fragment_key"] or "").strip() or "__self__"
                payload = _json_loads(row["payload_json"], {})
                created_at = str(row["updated_at"] or row["created_at"] or _now_iso())
                provenance = {
                    "sourceTable": "trace_fragments",
                    "fragmentKind": fragment_kind,
                    "fragmentKey": fragment_key,
                    "sourceJobId": str(row["source_job_id"] or "").strip(),
                    "sourceTerm": str(row["source_term"] or "").strip(),
                    "confidence": float(row["confidence"] or 0),
                }
                event_id = _stable_key(["v2-trace-event", trace_scope, fragment_kind, fragment_key, created_at])
                conn.execute(
                    """
                    INSERT OR REPLACE INTO trace_events_v2(
                        event_id, source_run_id, source_kind, trace_scope, request_signature,
                        payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?)
                    """,
                    (
                        event_id,
                        str(row["source_job_id"] or "").strip(),
                        fragment_kind or "trace-fragment",
                        trace_scope,
                        "",
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        created_at,
                    ),
                )
                counts["traceEvents"] += 1
                target_table, kind_field, key_field, kind_value = self._classify_v1_trace_fragment(fragment_kind, payload)
                if not target_table:
                    continue
                fragment_id = _stable_key(["v2-fragment", target_table, trace_scope, kind_value, fragment_key, created_at])
                conn.execute(
                    f"""
                    INSERT OR REPLACE INTO {target_table}(
                        fragment_id, trace_scope, {kind_field}, {key_field},
                        payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?)
                    """,
                    (
                        fragment_id,
                        trace_scope,
                        kind_value,
                        fragment_key,
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        created_at,
                    ),
                )
                if target_table == "semantic_fragments_v2":
                    counts["semanticFragments"] += 1
                elif target_table == "ui_binding_fragments_v2":
                    counts["uiBindingFragments"] += 1
                elif target_table == "managed_graph_fragments_v2":
                    counts["managedGraphFragments"] += 1
                elif target_table == "static_symbol_fragments_v2":
                    counts["staticSymbolFragments"] += 1
                elif target_table == "native_value_fragments_v2":
                    counts["nativeValueFragments"] += 1

            semantic_rows = conn.execute(
                """
                SELECT fragment_kind, fragment_key, canonical_payload_json, provenance_json, built_at
                FROM canonical_semantic_fragments
                ORDER BY built_at ASC
                """
            ).fetchall()
            for row in semantic_rows:
                fragment_kind = str(row["fragment_kind"] or "").strip()
                fragment_key = str(row["fragment_key"] or "").strip() or "__self__"
                payload = _json_loads(row["canonical_payload_json"], {})
                provenance = _json_loads(row["provenance_json"], {})
                trace_scope = self._infer_scope_from_v2_payload(fragment_key, payload, provenance)
                target_table, kind_field, key_field, kind_value = self._classify_v1_semantic_fragment(fragment_kind, payload)
                if not target_table:
                    continue
                fragment_id = _stable_key(["v2-semantic", target_table, trace_scope, kind_value, fragment_key, str(row["built_at"] or "")])
                conn.execute(
                    f"""
                    INSERT OR REPLACE INTO {target_table}(
                        fragment_id, trace_scope, {kind_field}, {key_field},
                        payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?)
                    """,
                    (
                        fragment_id,
                        trace_scope,
                        kind_value,
                        fragment_key,
                        _json_dumps(payload),
                        _json_dumps({**provenance, "sourceTable": "canonical_semantic_fragments"}),
                        str(row["built_at"] or _now_iso()),
                    ),
                )
                if target_table == "semantic_fragments_v2":
                    counts["semanticFragments"] += 1
                elif target_table == "ui_binding_fragments_v2":
                    counts["uiBindingFragments"] += 1
                elif target_table == "managed_graph_fragments_v2":
                    counts["managedGraphFragments"] += 1
                elif target_table == "static_symbol_fragments_v2":
                    counts["staticSymbolFragments"] += 1
                elif target_table == "native_value_fragments_v2":
                    counts["nativeValueFragments"] += 1

            native_rows = conn.execute(
                """
                SELECT request_signature, requested_terms_json, search_terms_json, payload_json, provenance_json, built_at
                FROM native_trace_views
                ORDER BY built_at ASC
                """
            ).fetchall()
            for row in native_rows:
                payload = _json_loads(row["payload_json"], {})
                provenance = _json_loads(row["provenance_json"], {})
                trace_scope = self._infer_scope_from_v2_payload(
                    str(row["request_signature"] or "").strip(),
                    payload,
                    provenance,
                )
                fragment_id = _stable_key(["v2-native", trace_scope, str(row["request_signature"] or "").strip()])
                conn.execute(
                    """
                    INSERT OR REPLACE INTO native_value_fragments_v2(
                        fragment_id, trace_scope, value_kind, value_key,
                        payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?)
                    """,
                    (
                        fragment_id,
                        trace_scope,
                        "native-trace",
                        str(row["request_signature"] or "").strip(),
                        _json_dumps(
                            {
                                "requestedTerms": _json_loads(row["requested_terms_json"], []),
                                "searchTerms": _json_loads(row["search_terms_json"], []),
                                "nativeTrace": payload,
                            }
                        ),
                        _json_dumps({**provenance, "sourceTable": "native_trace_views"}),
                        str(row["built_at"] or _now_iso()),
                    ),
                )
                counts["nativeValueFragments"] += 1
        return counts

    def _apply_exact_relation_uniqueness_hygiene_with_conn(self, conn: sqlite3.Connection) -> dict[str, int]:
        downgraded_edges = 0
        downgraded_groups = 0
        now = _now_iso()
        ambiguous_groups = conn.execute(
            """
            SELECT source_node_id, relation_kind, COUNT(*) AS target_count
            FROM graph_edges_v2
            WHERE edge_status = 'present'
              AND relation_kind IN ('exact-shell-to-action-hook', 'exact-shell-to-prefab')
            GROUP BY source_node_id, relation_kind
            HAVING COUNT(*) > 1
            """
        ).fetchall()
        for group in ambiguous_groups:
            source_node_id = str(group["source_node_id"] or "").strip()
            relation_kind = str(group["relation_kind"] or "").strip()
            target_count = int(group["target_count"] or 0)
            if not source_node_id or not relation_kind or target_count < 2:
                continue
            downgraded_groups += 1
            edge_rows = conn.execute(
                """
                SELECT edge_id, target_node_id, contradiction_count, payload_json, provenance_json
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = ?
                  AND edge_status = 'present'
                """,
                (source_node_id, relation_kind),
            ).fetchall()
            for edge_row in edge_rows:
                edge_id = str(edge_row["edge_id"] or "").strip()
                target_node_id = str(edge_row["target_node_id"] or "").strip()
                next_contradiction_count = max(int(edge_row["contradiction_count"] or 0), target_count - 1)
                payload = _json_loads(edge_row["payload_json"], {})
                provenance = _json_loads(edge_row["provenance_json"], {})
                payload["uniquenessHygiene"] = {
                    "applied": True,
                    "reason": "multiple-present-targets-for-unique-exact-relation",
                    "sourceNodeId": source_node_id,
                    "relationKind": relation_kind,
                    "presentTargetCount": target_count,
                    "downgradedAt": now,
                }
                provenance["uniquenessHygiene"] = {
                    "source": "trace-db-v2",
                    "reason": "multiple-present-targets-for-unique-exact-relation",
                    "presentTargetCount": target_count,
                }
                conn.execute(
                    """
                    UPDATE graph_edges_v2
                    SET edge_status = 'candidate',
                        contradiction_count = ?,
                        payload_json = ?,
                        provenance_json = ?,
                        updated_at = ?
                    WHERE edge_id = ?
                    """,
                    (
                        next_contradiction_count,
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        now,
                        edge_id,
                    ),
                )
                conn.execute(
                    """
                    UPDATE structure_ir_edges_v2
                    SET edge_status = 'candidate',
                        contradiction_count = CASE
                            WHEN contradiction_count < ? THEN ?
                            ELSE contradiction_count
                        END,
                        payload_json = ?,
                        provenance_json = ?,
                        updated_at = ?
                    WHERE edge_id = ?
                    """,
                    (
                        next_contradiction_count,
                        next_contradiction_count,
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        now,
                        edge_id,
                    ),
                )
                support_id = _stable_key(["v2-support", edge_id, "uniqueness-hygiene", now])
                conn.execute(
                    """
                    INSERT OR REPLACE INTO graph_edge_support_v2(
                        support_id, edge_id, support_kind, support_value, trace_scope,
                        payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?)
                    """,
                    (
                        support_id,
                        edge_id,
                        "uniqueness-hygiene",
                        relation_kind,
                        "",
                        _json_dumps(
                            {
                                "sourceNodeId": source_node_id,
                                "targetNodeId": target_node_id,
                                "presentTargetCount": target_count,
                            }
                        ),
                        _json_dumps({"source": "trace-db-v2"}),
                        now,
                    ),
                )
                downgraded_edges += 1
        malformed_exact_rows = conn.execute(
            """
            SELECT edge_id, source_node_id, relation_kind, target_node_id, contradiction_count, payload_json, provenance_json
            FROM graph_edges_v2
            WHERE edge_status = 'present'
              AND relation_kind IN ('exact-shell-to-action-hook', 'exact-shell-to-prefab')
            """
        ).fetchall()
        for edge_row in malformed_exact_rows:
            source_node_id = str(edge_row["source_node_id"] or "").strip()
            relation_kind = str(edge_row["relation_kind"] or "").strip()
            if _projection_term_shape(source_node_id) in {"button", "ui-shell"}:
                continue
            edge_id = str(edge_row["edge_id"] or "").strip()
            target_node_id = str(edge_row["target_node_id"] or "").strip()
            next_contradiction_count = max(int(edge_row["contradiction_count"] or 0), 1)
            payload = _json_loads(edge_row["payload_json"], {})
            provenance = _json_loads(edge_row["provenance_json"], {})
            payload["shapeHygiene"] = {
                "applied": True,
                "reason": "exact-shell-relation-source-not-shell-like",
                "sourceNodeId": source_node_id,
                "relationKind": relation_kind,
                "sourceShape": _projection_term_shape(source_node_id),
                "downgradedAt": now,
            }
            provenance["shapeHygiene"] = {
                "source": "trace-db-v2",
                "reason": "exact-shell-relation-source-not-shell-like",
                "sourceShape": _projection_term_shape(source_node_id),
            }
            conn.execute(
                """
                UPDATE graph_edges_v2
                SET edge_status = 'candidate',
                    contradiction_count = CASE
                        WHEN contradiction_count < ? THEN ?
                        ELSE contradiction_count
                    END,
                    payload_json = ?,
                    provenance_json = ?,
                    updated_at = ?
                WHERE edge_id = ?
                """,
                (
                    next_contradiction_count,
                    next_contradiction_count,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                    now,
                    edge_id,
                ),
            )
            conn.execute(
                """
                UPDATE structure_ir_edges_v2
                SET edge_status = 'candidate',
                    contradiction_count = CASE
                        WHEN contradiction_count < ? THEN ?
                        ELSE contradiction_count
                    END,
                    payload_json = ?,
                    provenance_json = ?,
                    updated_at = ?
                WHERE edge_id = ?
                """,
                (
                    next_contradiction_count,
                    next_contradiction_count,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                    now,
                    edge_id,
                ),
            )
            support_id = _stable_key(["v2-support", edge_id, "shape-hygiene", now])
            conn.execute(
                """
                INSERT OR REPLACE INTO graph_edge_support_v2(
                    support_id, edge_id, support_kind, support_value, trace_scope,
                    payload_json, provenance_json, created_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    support_id,
                    edge_id,
                    "shape-hygiene",
                    relation_kind,
                    "",
                    _json_dumps(
                        {
                            "sourceNodeId": source_node_id,
                            "targetNodeId": target_node_id,
                            "sourceShape": _projection_term_shape(source_node_id),
                        }
                    ),
                    _json_dumps({"source": "trace-db-v2"}),
                    now,
                ),
            )
            downgraded_edges += 1
            downgraded_groups += 1
        mismatched_exact_action_rows = conn.execute(
            """
            SELECT edge_id, source_node_id, target_node_id, contradiction_count, payload_json, provenance_json
            FROM graph_edges_v2
            WHERE edge_status = 'present'
              AND relation_kind = 'exact-shell-to-action-hook'
              AND source_node_id GLOB 'ATU*Button'
            """
        ).fetchall()
        for edge_row in mismatched_exact_action_rows:
            source_node_id = str(edge_row["source_node_id"] or "").strip()
            target_node_id = str(edge_row["target_node_id"] or "").strip()
            neighbor_rows = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND edge_status = 'present'
                  AND relation_kind IN ('serialized-adjacency', 'metadata-neighborhood', 'binds-ui-slot')
                """,
                (source_node_id,),
            ).fetchall()
            row_tokens = _button_row_tokens([str(row["target_node_id"] or "").strip() for row in neighbor_rows])
            action_tokens = _projection_non_generic_tokens(target_node_id) or _projection_identity_tokens(target_node_id)
            if not row_tokens or not action_tokens or (row_tokens & action_tokens):
                continue
            edge_id = str(edge_row["edge_id"] or "").strip()
            next_contradiction_count = max(int(edge_row["contradiction_count"] or 0), 1)
            payload = _json_loads(edge_row["payload_json"], {})
            provenance = _json_loads(edge_row["provenance_json"], {})
            payload["shapeHygiene"] = {
                "applied": True,
                "reason": "exact-shell-action-row-family-mismatch",
                "sourceNodeId": source_node_id,
                "targetNodeId": target_node_id,
                "rowTokens": sorted(row_tokens),
                "actionTokens": sorted(action_tokens),
                "downgradedAt": now,
            }
            provenance["shapeHygiene"] = {
                "source": "trace-db-v2",
                "reason": "exact-shell-action-row-family-mismatch",
                "rowTokens": sorted(row_tokens),
                "actionTokens": sorted(action_tokens),
            }
            conn.execute(
                """
                UPDATE graph_edges_v2
                SET edge_status = 'candidate',
                    contradiction_count = CASE
                        WHEN contradiction_count < ? THEN ?
                        ELSE contradiction_count
                    END,
                    payload_json = ?,
                    provenance_json = ?,
                    updated_at = ?
                WHERE edge_id = ?
                """,
                (
                    next_contradiction_count,
                    next_contradiction_count,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                    now,
                    edge_id,
                ),
            )
            conn.execute(
                """
                UPDATE structure_ir_edges_v2
                SET edge_status = 'candidate',
                    contradiction_count = CASE
                        WHEN contradiction_count < ? THEN ?
                        ELSE contradiction_count
                    END,
                    payload_json = ?,
                    provenance_json = ?,
                    updated_at = ?
                WHERE edge_id = ?
                """,
                (
                    next_contradiction_count,
                    next_contradiction_count,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                    now,
                    edge_id,
                ),
            )
            support_id = _stable_key(["v2-support", edge_id, "shape-hygiene-family", now])
            conn.execute(
                """
                INSERT OR REPLACE INTO graph_edge_support_v2(
                    support_id, edge_id, support_kind, support_value, trace_scope,
                    payload_json, provenance_json, created_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    support_id,
                    edge_id,
                    "shape-hygiene",
                    "exact-shell-action-row-family-mismatch",
                    "",
                    _json_dumps(
                        {
                            "sourceNodeId": source_node_id,
                            "targetNodeId": target_node_id,
                            "rowTokens": sorted(row_tokens),
                            "actionTokens": sorted(action_tokens),
                        }
                    ),
                    _json_dumps({"source": "trace-db-v2"}),
                    now,
                ),
            )
            downgraded_edges += 1
            downgraded_groups += 1
        display_fanout_groups = conn.execute(
            """
            SELECT source_node_id, relation_kind, COUNT(*) AS target_count
            FROM graph_edges_v2
            WHERE edge_status = 'present'
              AND relation_kind = 'exact-display-update-path'
            GROUP BY source_node_id, relation_kind
            HAVING COUNT(*) > 3
            """
        ).fetchall()
        for group in display_fanout_groups:
            source_node_id = str(group["source_node_id"] or "").strip()
            relation_kind = str(group["relation_kind"] or "").strip()
            target_count = int(group["target_count"] or 0)
            if not source_node_id or target_count < 4:
                continue
            downgraded_groups += 1
            edge_rows = conn.execute(
                """
                SELECT edge_id, target_node_id, contradiction_count, payload_json, provenance_json
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'exact-display-update-path'
                  AND edge_status = 'present'
                """,
                (source_node_id,),
            ).fetchall()
            for edge_row in edge_rows:
                edge_id = str(edge_row["edge_id"] or "").strip()
                target_node_id = str(edge_row["target_node_id"] or "").strip()
                next_contradiction_count = max(int(edge_row["contradiction_count"] or 0), target_count - 2)
                payload = _json_loads(edge_row["payload_json"], {})
                provenance = _json_loads(edge_row["provenance_json"], {})
                payload["fanoutHygiene"] = {
                    "applied": True,
                    "reason": "too-many-present-display-update-targets-for-source",
                    "sourceNodeId": source_node_id,
                    "relationKind": relation_kind,
                    "presentTargetCount": target_count,
                    "downgradedAt": now,
                }
                provenance["fanoutHygiene"] = {
                    "source": "trace-db-v2",
                    "reason": "too-many-present-display-update-targets-for-source",
                    "presentTargetCount": target_count,
                }
                conn.execute(
                    """
                    UPDATE graph_edges_v2
                    SET edge_status = 'candidate',
                        contradiction_count = ?,
                        payload_json = ?,
                        provenance_json = ?,
                        updated_at = ?
                    WHERE edge_id = ?
                    """,
                    (
                        next_contradiction_count,
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        now,
                        edge_id,
                    ),
                )
                conn.execute(
                    """
                    UPDATE structure_ir_edges_v2
                    SET edge_status = 'candidate',
                        contradiction_count = CASE
                            WHEN contradiction_count < ? THEN ?
                            ELSE contradiction_count
                        END,
                        payload_json = ?,
                        provenance_json = ?,
                        updated_at = ?
                    WHERE edge_id = ?
                    """,
                    (
                        next_contradiction_count,
                        next_contradiction_count,
                        _json_dumps(payload),
                        _json_dumps(provenance),
                        now,
                        edge_id,
                    ),
                )
                support_id = _stable_key(["v2-support", edge_id, "display-fanout-hygiene", now])
                conn.execute(
                    """
                    INSERT OR REPLACE INTO graph_edge_support_v2(
                        support_id, edge_id, support_kind, support_value, trace_scope,
                        payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?)
                    """,
                    (
                        support_id,
                        edge_id,
                        "display-fanout-hygiene",
                        relation_kind,
                        "",
                        _json_dumps(
                            {
                                "sourceNodeId": source_node_id,
                                "targetNodeId": target_node_id,
                                "presentTargetCount": target_count,
                            }
                        ),
                        _json_dumps({"source": "trace-db-v2"}),
                        now,
                    ),
                )
                downgraded_edges += 1
        return {"downgradedEdges": downgraded_edges, "downgradedGroups": downgraded_groups}

    def derive_obligations_from_v2_graph(self) -> dict[str, int]:
        self.ensure_schema()
        counts = {"open": 0, "closed": 0, "supports": 0}
        derived_ids: set[str] = set()
        with self.connect() as conn:
            counts.update(self._apply_exact_relation_uniqueness_hygiene_with_conn(conn))
            scope_term_cache: dict[str, list[dict[str, Any]]] = {}
            recent_target_attempt_counts: dict[tuple[str, str], int] = {}
            recent_source_attempt_counts: dict[tuple[str, str], int] = {}
            recent_repeat_rows = conn.execute(
                """
                SELECT trace_scope, source_node_id, target_node_id, COUNT(*) AS c
                FROM execution_attempts_v2
                WHERE attempt_status IN ('nonclosing', 'strengthened')
                  AND updated_at >= ?
                GROUP BY trace_scope, source_node_id, target_node_id
                """,
                (_shift_iso(_now_iso(), seconds=-6 * 3600),),
            ).fetchall()
            for recent_row in recent_repeat_rows:
                trace_scope = str(recent_row["trace_scope"] or "").strip()
                source_node_id = str(recent_row["source_node_id"] or "").strip()
                target_node_id = str(recent_row["target_node_id"] or "").strip()
                count = int(recent_row["c"] or 0)
                if trace_scope and target_node_id:
                    recent_target_attempt_counts[(trace_scope, target_node_id)] = (
                        recent_target_attempt_counts.get((trace_scope, target_node_id), 0) + count
                    )
                if trace_scope and source_node_id:
                    recent_source_attempt_counts[(trace_scope, source_node_id)] = (
                        recent_source_attempt_counts.get((trace_scope, source_node_id), 0) + count
                    )
            checked_pair_digests: dict[tuple[str, str, str, str], str] = {}
            covered_pairs: set[tuple[str, str, str, str]] = set()
            for row in conn.execute(
                """
                SELECT trace_scope, relation_kind, source_node_id, target_node_id, check_status, graph_context_digest
                FROM graph_pair_checks_v2
                WHERE check_status IN ('checked-nonclosing', 'covered')
                """
            ).fetchall():
                key = (
                    str(row["trace_scope"] or "").strip(),
                    str(row["relation_kind"] or "").strip(),
                    str(row["source_node_id"] or "").strip(),
                    str(row["target_node_id"] or "").strip(),
                )
                status = str(row["check_status"] or "").strip()
                if status == "covered":
                    covered_pairs.add(key)
                elif status == "checked-nonclosing":
                    checked_pair_digests[key] = str(row["graph_context_digest"] or "").strip()
            checked_path_digests: dict[tuple[str, str, str], str] = {}
            covered_paths: set[tuple[str, str, str]] = set()
            for row in conn.execute(
                """
                SELECT trace_scope, relation_kind, path_fingerprint, check_status, graph_context_digest
                FROM graph_path_checks_v2
                WHERE check_status IN ('checked-nonclosing', 'covered')
                """
            ).fetchall():
                key = (
                    str(row["trace_scope"] or "").strip(),
                    str(row["relation_kind"] or "").strip(),
                    str(row["path_fingerprint"] or "").strip(),
                )
                status = str(row["check_status"] or "").strip()
                if status == "covered":
                    covered_paths.add(key)
                elif status == "checked-nonclosing":
                    checked_path_digests[key] = str(row["graph_context_digest"] or "").strip()
            relation_kinds_to_walk = {
                "exact-shell-to-action-hook",
                "exact-shell-to-prefab",
                "getter-family",
                "save-owner-recovery",
            }
            support_rows = conn.execute(
                """
                SELECT edge_id, source_node_id, relation_kind, target_node_id, edge_status,
                       support_count, contradiction_count, payload_json, provenance_json, updated_at
                FROM graph_edges_v2
                ORDER BY updated_at DESC
                """
            ).fetchall()
            for row in support_rows:
                edge_id = str(row["edge_id"] or "").strip()
                source_node_id = str(row["source_node_id"] or "").strip()
                target_node_id = str(row["target_node_id"] or "").strip()
                relation_kind = str(row["relation_kind"] or "").strip()
                edge_status = str(row["edge_status"] or "").strip()
                if not edge_id or not source_node_id or not target_node_id or not relation_kind:
                    continue
                payload = _json_loads(row["payload_json"], {})
                provenance = _json_loads(row["provenance_json"], {})
                preferred_trace_scope = self._resolve_preferred_scope_for_edge(conn, edge_id, payload, provenance)
                if edge_status == "negative":
                    if source_node_id == target_node_id:
                        continue
                    if not _supports_native_negative_edge_verification(
                        relation_kind,
                        source_node_id,
                        target_node_id,
                    ):
                        continue
                    effective_support_count = max(
                        int(row["support_count"] or 0),
                        int(row["contradiction_count"] or 0),
                        int(payload.get("negativeObservationCount") or 0) if isinstance(payload, dict) else 0,
                    )
                    graph_digest = _stable_key([edge_id, edge_status, str(effective_support_count), str(row["contradiction_count"] or 0)])
                    if (preferred_trace_scope, relation_kind, source_node_id, target_node_id) in covered_pairs:
                        continue
                    if checked_pair_digests.get(
                        (preferred_trace_scope, relation_kind, source_node_id, target_node_id),
                        "",
                    ) == graph_digest:
                        continue
                    obligation_id = _stable_key(["v2-obligation", "verify-negative-edge", relation_kind, source_node_id, target_node_id])
                    derived_ids.add(obligation_id)
                    priority = 200.0 + float(effective_support_count) * 10.0
                    self._upsert_obligation(
                        conn,
                        obligation_id=obligation_id,
                        obligation_kind="verify-negative-edge",
                        relation_kind=relation_kind,
                        source_node_id=source_node_id,
                        target_node_id=target_node_id,
                        preferred_trace_scope=preferred_trace_scope,
                        priority=priority,
                        support_count=effective_support_count,
                        graph_context_digest=graph_digest,
                        payload={
                            "edgeId": edge_id,
                            "edgeStatus": edge_status,
                            "knownPair": [source_node_id, target_node_id],
                            "goal": "Upgrade a negative or missing relation into a verified structural edge.",
                        },
                        provenance={
                            "source": "graph_edges_v2",
                            "sourceEdgeId": edge_id,
                            "supportCount": effective_support_count,
                            "contradictionCount": int(row["contradiction_count"] or 0),
                        },
                        updated_at=str(row["updated_at"] or _now_iso()),
                    )
                    counts["open"] += 1
                    self._upsert_obligation_support(
                        conn,
                        obligation_id=obligation_id,
                        support_kind="graph-edge",
                        support_ref=edge_id,
                        payload={"edgeStatus": edge_status, "relationKind": relation_kind, "supportCount": effective_support_count},
                        provenance={"source": "graph_edges_v2"},
                        created_at=str(row["updated_at"] or _now_iso()),
                    )
                    counts["supports"] += 1
                    continue

                if edge_status != "present" or relation_kind not in relation_kinds_to_walk:
                    continue
                if not _looks_like_actionable_anchor_term(target_node_id):
                    continue
                if (preferred_trace_scope, "graph-extension", source_node_id, target_node_id) in covered_pairs:
                    continue
                outgoing_count = int(
                    (
                        conn.execute(
                            """
                            SELECT COUNT(*) AS c
                            FROM graph_edges_v2
                            WHERE source_node_id = ?
                              AND edge_status = 'present'
                            """,
                            (target_node_id,),
                        ).fetchone()
                        or {"c": 0}
                    )["c"]
                    or 0
                )
                bridge_path = [source_node_id, target_node_id]
                bridge_relation_kind = relation_kind
                bridge_kind = "direct-terminus"
                if relation_kind == "exact-shell-to-prefab":
                    action_bridge = conn.execute(
                        """
                        SELECT target_node_id
                        FROM graph_edges_v2
                        WHERE source_node_id = ?
                          AND relation_kind = 'exact-shell-to-action-hook'
                          AND edge_status = 'present'
                        ORDER BY support_count DESC, updated_at DESC
                        LIMIT 1
                        """,
                        (source_node_id,),
                    ).fetchone()
                    if action_bridge:
                        action_node_id = str(action_bridge["target_node_id"] or "").strip()
                        if action_node_id:
                            bridge_path = [source_node_id, action_node_id, target_node_id]
                            bridge_relation_kind = "exact-shell-to-action-hook"
                            bridge_kind = "action-bridge"
                            outgoing_count = int(
                                (
                                    conn.execute(
                                        """
                                        SELECT COUNT(*) AS c
                                        FROM graph_edges_v2
                                        WHERE source_node_id = ?
                                          AND edge_status = 'present'
                                        """,
                                        (action_node_id,),
                                    ).fetchone()
                                    or {"c": 0}
                                )["c"]
                                or 0
                            )
                path_fingerprint = _stable_key(["v2-path", preferred_trace_scope, *bridge_path, relation_kind, bridge_kind])
                if (preferred_trace_scope, "graph-extension", path_fingerprint) in covered_paths:
                    continue
                if not _graph_walk_pair_is_plausible(
                    source_node_id,
                    relation_kind,
                    target_node_id,
                    bridge_kind=bridge_kind,
                ):
                    continue
                if outgoing_count > 0 and bridge_kind == "direct-terminus":
                    continue
                obligation_kind = "continue-bridge-path" if len(bridge_path) > 2 else "continue-path"
                obligation_id = _stable_key(
                    [
                        "v2-obligation",
                        "continue-target-lane",
                        preferred_trace_scope,
                        target_node_id,
                    ]
                )
                derived_ids.add(obligation_id)
                support_priority_weight = _relation_walk_support_weight(relation_kind, int(row["support_count"] or 0))
                priority = 300.0 + support_priority_weight * 5.0
                if bridge_kind == "action-bridge":
                    priority += 25.0
                priority += _relation_walk_priority_bonus(relation_kind)
                priority -= _anchor_penalty_score(source_node_id)
                priority -= _anchor_penalty_score(target_node_id) * 0.5
                priority -= float(recent_target_attempt_counts.get((preferred_trace_scope, target_node_id), 0)) * 35.0
                priority -= float(recent_source_attempt_counts.get((preferred_trace_scope, source_node_id), 0)) * 10.0
                graph_digest = _stable_key([edge_id, obligation_kind, path_fingerprint, str(outgoing_count), str(row["support_count"] or 0)])
                if checked_pair_digests.get(
                    (preferred_trace_scope, "graph-extension", source_node_id, target_node_id),
                    "",
                ) == graph_digest:
                    continue
                if checked_path_digests.get(
                    (preferred_trace_scope, "graph-extension", path_fingerprint),
                    "",
                ) == graph_digest:
                    continue
                inserted = self._upsert_obligation(
                    conn,
                    obligation_id=obligation_id,
                    obligation_kind=obligation_kind,
                    relation_kind="graph-extension",
                    source_node_id=source_node_id,
                    target_node_id=target_node_id,
                    preferred_trace_scope=preferred_trace_scope,
                    priority=priority,
                    support_count=int(row["support_count"] or 0),
                    graph_context_digest=graph_digest,
                    payload={
                        "edgeId": edge_id,
                        "knownPair": [source_node_id, target_node_id],
                        "knownRelationKind": relation_kind,
                        "bridgePath": bridge_path,
                        "bridgeRelationKind": bridge_relation_kind,
                        "pathFingerprint": path_fingerprint,
                        "bridgeKind": bridge_kind,
                        "goal": "Walk outward from a verified terminus and recover the next structural hop.",
                    },
                    provenance={
                        "source": "graph_edges_v2",
                        "sourceEdgeId": edge_id,
                        "sourceRelationKind": relation_kind,
                        "supportCount": int(row["support_count"] or 0),
                    },
                    updated_at=str(row["updated_at"] or _now_iso()),
                )
                if inserted:
                    counts["open"] += 1
                    self._upsert_obligation_support(
                        conn,
                        obligation_id=obligation_id,
                        support_kind="graph-edge",
                        support_ref=edge_id,
                        payload={"edgeStatus": edge_status, "relationKind": relation_kind, "bridgePath": bridge_path},
                        provenance={"source": "graph_edges_v2"},
                        created_at=str(row["updated_at"] or _now_iso()),
                    )
                    counts["supports"] += 1

                if len(bridge_path) > 2:
                    scope_terms = scope_term_cache.get(preferred_trace_scope)
                    if scope_terms is None:
                        scope_terms = self._list_scope_candidate_terms(conn, preferred_trace_scope)
                        scope_term_cache[preferred_trace_scope] = scope_terms
                    edge_nodes = set(bridge_path)
                    tail_node_id = bridge_path[-1]
                    for candidate in scope_terms[:24]:
                        candidate_term = str(candidate.get("term") or "").strip()
                        if not candidate_term or candidate_term in edge_nodes:
                            continue
                        if (preferred_trace_scope, "graph-extension", tail_node_id, candidate_term) in covered_pairs:
                            continue
                        if self._graph_relation_exists(conn, tail_node_id, candidate_term):
                            continue
                        candidate_priority = priority + float(candidate.get("score") or 0)
                        candidate_priority -= _anchor_penalty_score(candidate_term) * 0.5
                        candidate_priority -= float(recent_target_attempt_counts.get((preferred_trace_scope, candidate_term), 0)) * 35.0
                        candidate_priority -= float(recent_source_attempt_counts.get((preferred_trace_scope, tail_node_id), 0)) * 10.0
                        candidate_sources = list(candidate.get("sources") or [])
                        candidate_statuses = list(candidate.get("statuses") or [])
                        candidate_obligation_id = _stable_key(
                            [
                                "v2-obligation",
                                "continue-evidence-lane",
                                preferred_trace_scope,
                                tail_node_id,
                                candidate_term,
                            ]
                        )
                        derived_ids.add(candidate_obligation_id)
                        candidate_path = [*bridge_path, candidate_term]
                        candidate_fingerprint = _stable_key(["v2-path", preferred_trace_scope, *candidate_path, relation_kind, "evidence-bridge"])
                        if (preferred_trace_scope, "graph-extension", candidate_fingerprint) in covered_paths:
                            continue
                        candidate_graph_digest = _stable_key([edge_id, candidate_fingerprint, *candidate_sources, *candidate_statuses])
                        if checked_pair_digests.get(
                            (preferred_trace_scope, "graph-extension", tail_node_id, candidate_term),
                            "",
                        ) == candidate_graph_digest:
                            continue
                        if checked_path_digests.get(
                            (preferred_trace_scope, "graph-extension", candidate_fingerprint),
                            "",
                        ) == candidate_graph_digest:
                            continue
                        inserted = self._upsert_obligation(
                            conn,
                            obligation_id=candidate_obligation_id,
                            obligation_kind="continue-evidence-path",
                            relation_kind="graph-extension",
                            source_node_id=tail_node_id,
                            target_node_id=candidate_term,
                            preferred_trace_scope=preferred_trace_scope,
                            priority=candidate_priority,
                            support_count=int(candidate.get("count") or 0),
                            graph_context_digest=candidate_graph_digest,
                            payload={
                                "edgeId": edge_id,
                                "bridgePath": bridge_path,
                                "bridgeKind": bridge_kind,
                                "bridgeRelationKind": bridge_relation_kind,
                                "pathFingerprint": candidate_fingerprint,
                                "candidateTerm": candidate_term,
                                "candidateSources": candidate_sources,
                                "candidateStatuses": candidate_statuses,
                                "goal": "Extend the verified bridge path into a concrete same-scope evidence term that is not yet linked structurally.",
                            },
                            provenance={
                                "source": "v2-evidence-enricher",
                                "sourceEdgeId": edge_id,
                                "candidateSources": candidate_sources,
                            },
                            updated_at=str(row["updated_at"] or _now_iso()),
                        )
                        if inserted:
                            counts["open"] += 1
                            self._upsert_obligation_support(
                                conn,
                                obligation_id=candidate_obligation_id,
                                support_kind="evidence-term",
                                support_ref=candidate_term,
                                payload={"sources": candidate_sources, "statuses": candidate_statuses},
                                provenance={"source": "v2-evidence-enricher", "traceScope": preferred_trace_scope},
                                created_at=str(row["updated_at"] or _now_iso()),
                            )
                            counts["supports"] += 1

            projection_rows = conn.execute(
                """
                SELECT projection_id, projection_kind, subject_id, trace_scope, payload_json, provenance_json, updated_at
                FROM consumer_projections_v2
                WHERE projection_status = 'active'
                ORDER BY updated_at DESC
                """
            ).fetchall()
            projection_term_seen: set[tuple[str, str, str]] = set()
            for row in projection_rows:
                projection_id = str(row["projection_id"] or "").strip()
                projection_kind = str(row["projection_kind"] or "").strip()
                subject_id = str(row["subject_id"] or "").strip()
                preferred_trace_scope = str(row["trace_scope"] or "").strip()
                payload = _json_loads(row["payload_json"], {})
                provenance = _json_loads(row["provenance_json"], {})
                if not projection_id or not projection_kind or not preferred_trace_scope or not isinstance(payload, dict):
                    continue
                source_node_ids = _projection_live_source_anchors(
                    projection_kind,
                    payload,
                    subject_id,
                )
                if not source_node_ids:
                    continue
                projection_completeness = str(payload.get("projectionCompleteness") or "").strip()
                runtime_projection = _normalize_token_shop_runtime_projection(payload.get("runtimeProjection") or {})
                runtime_seam_open = bool(
                    str(runtime_projection.get("runtimeStatus") or "").strip()
                    or str(runtime_projection.get("instanceStatus") or "").strip()
                    or list(runtime_projection.get("unresolvedDisplayValues") or [])
                    or list(runtime_projection.get("unresolvedInstanceValues") or [])
                )
                runtime_formula_model_recovered = (
                    str(dict(runtime_projection.get("displayFormula") or {}).get("status") or "").strip()
                    == "unresolved-runtime-modifiers"
                    and runtime_projection.get("baseMaxLevel") is not None
                    and bool(str(runtime_projection.get("nextCostAccessor") or "").strip())
                )
                runtime_instance_recovered = _token_shop_runtime_instance_layer_recovered(runtime_projection)
                runtime_display_seam_open = _token_shop_runtime_display_seam_open(runtime_projection)
                runtime_instance_owner = str(runtime_projection.get("instanceOwner") or "").strip()
                runtime_creation_method = str(runtime_projection.get("creationMethod") or "").strip()
                runtime_evaluator_owner = str(runtime_projection.get("evaluatorOwner") or "").strip()
                unresolved_runtime_targets = {
                    str(value).strip()
                    for value in (runtime_projection.get("unresolvedRuntimeTargets") or [])
                    if str(value).strip()
                }
                runtime_fast_buy_terms = {
                    str(value).strip()
                    for value in (
                        list(runtime_projection.get("fastBuyTerms") or [])
                        + list(runtime_projection.get("fastBuyOwners") or [])
                        + list(runtime_projection.get("fastBuyFields") or [])
                    )
                    if str(value).strip()
                }
                runtime_modifier_terms = {
                    str(value).strip()
                    for value in (
                        list(runtime_projection.get("modifierTerms") or [])
                        + list(runtime_projection.get("modifierOwners") or [])
                        + list(runtime_projection.get("modifierMethods") or [])
                        + list(runtime_projection.get("modifierFields") or [])
                    )
                    if str(value).strip()
                }
                for source_node_id in source_node_ids:
                    if not _looks_like_actionable_anchor_term(source_node_id):
                        continue
                    bundle_targets_by_support: dict[str, list[str]] = {}
                    for support_kind, target_node_id in _iter_projection_target_terms(payload):
                        if (
                            projection_kind == "token-shop-row-structure"
                            and runtime_seam_open
                            and support_kind == "rowValueFields"
                        ):
                            continue
                        if (
                            projection_kind == "token-shop-row-structure"
                            and runtime_instance_recovered
                            and support_kind in {"getterTargets", "updaterTargets", "runtimeSlotTargets", "ownerTargets", "parameterTargets"}
                        ):
                            continue
                        if (
                            projection_kind == "token-shop-row-structure"
                            and runtime_instance_recovered
                            and runtime_display_seam_open
                            and support_kind == "instanceTargets"
                        ):
                            continue
                        if (
                            projection_kind == "runtime-bridge-structure"
                            and support_kind == "rowValueFields"
                        ):
                            continue
                        if (
                            projection_kind == "runtime-bridge-structure"
                            and runtime_formula_model_recovered
                            and support_kind in {"getterTargets", "parameterTargets", "updaterTargets", "ownerTargets", "instanceTargets"}
                        ):
                            continue
                        target_value = str(target_node_id or "").strip()
                        if not target_value or target_value == source_node_id:
                            continue
                        if not _projection_pair_is_plausible(
                            source_node_id,
                            target_value,
                            support_kind,
                            projection_kind,
                            payload,
                        ):
                            continue
                        seen_key = (projection_id, source_node_id, target_value)
                        if seen_key in projection_term_seen:
                            continue
                        projection_term_seen.add(seen_key)
                        if self._projection_proxy_relation_covered(conn, source_node_id, target_value):
                            continue
                        bundle_targets_by_support.setdefault(support_kind, []).append(target_value)
                        if (preferred_trace_scope, "graph-extension", source_node_id, target_value) in covered_pairs:
                            continue
                        candidate_path = [source_node_id, target_value]
                        candidate_fingerprint = _stable_key(
                            ["v2-path", preferred_trace_scope, projection_id, *candidate_path, "projection-bridge"]
                        )
                        if (preferred_trace_scope, "graph-extension", candidate_fingerprint) in covered_paths:
                            continue
                        support_count = 1
                        if isinstance(payload.get("supportingRowButtons"), list):
                            support_count += len([value for value in payload.get("supportingRowButtons") or [] if str(value or "").strip()])
                        if isinstance(payload.get("supportingScopes"), list):
                            support_count += len([value for value in payload.get("supportingScopes") or [] if str(value or "").strip()])
                        priority = 235.0
                        if projection_completeness == "structured":
                            priority += 20.0
                        elif projection_completeness == "partial":
                            priority += 10.0
                        if projection_kind == "runtime-bridge-structure":
                            bridge_targets = {
                                str(value).strip()
                                for value in (payload.get("bridgeTargets") or [])
                                if str(value).strip()
                            }
                            fast_buy_active = (
                                str(runtime_projection.get("fastBuyStatus") or "").strip()
                                == "fast-buy-candidates-row-local"
                            )
                            global_modifier_active = (
                                str(runtime_projection.get("globalModifierStatus") or "").strip()
                                == "global-modifier-candidates-recovered"
                            )
                            is_fast_buy_lane = (
                                (fast_buy_active or "fast-buy-runtime-quantity" in unresolved_runtime_targets)
                                and (source_node_id in runtime_fast_buy_terms or target_value in runtime_fast_buy_terms)
                            )
                            is_global_modifier_lane = (
                                (global_modifier_active or "set-wide-cost-modifiers" in unresolved_runtime_targets)
                                and (source_node_id in runtime_modifier_terms or target_value in runtime_modifier_terms)
                            )
                            is_formula_lane = (
                                "runtime-evaluator-instance-formula" in unresolved_runtime_targets
                                and (
                                    target_value in {
                                        "costExponent",
                                        "calculationType",
                                        "calculationsType",
                                        "finalSetValue",
                                        "get_costExponent",
                                        "get_calculationsType",
                                        "get_finalSetValue",
                                        "set_costExponent",
                                        "set_calculationsType",
                                        "set_finalSetValue",
                                    }
                                    or source_node_id in {
                                        "ArcadeUpgradeSO",
                                        "SetCostRelatedAttributes",
                                        "CalculateAndSetUpgradeCalculations",
                                        "BuyAndApplyUpgrade",
                                    }
                                )
                            )
                            if str(payload.get("rowButton") or "").strip() and str(payload.get("actionHook") or "").strip():
                                if "family" not in preferred_trace_scope:
                                    priority += 18.0
                                if bridge_targets & {"CostBox", "CostText", "costTexts", "levelTexts"}:
                                    priority += 40.0
                                if source_node_id == str(payload.get("actionHook") or "").strip():
                                    priority += 16.0
                                if source_node_id == str(payload.get("sourceAnchor") or "").strip():
                                    priority += 10.0
                            if is_fast_buy_lane:
                                priority += 96.0
                            elif is_global_modifier_lane:
                                priority += 72.0
                            elif is_formula_lane:
                                priority += 88.0
                            elif (
                                unresolved_runtime_targets
                                and support_kind in {"parameterTargets", "ownerTargets"}
                                and target_value in {
                                    "baseCost",
                                    "cost",
                                    "costExponent",
                                    "additiveIncrease",
                                    "calculationType",
                                    "calculationsType",
                                    "finalSetValue",
                                    "output",
                                    "maxLevel",
                                }
                            ):
                                priority -= 52.0
                            if (
                                "runtime-evaluator-instance-formula" in unresolved_runtime_targets
                                and target_value in {"ModBoostStartCost", "ModBoostAdditiveCost", "ModBoostBonus", "ModBoostFill", "ModBoostMaxLevel"}
                            ):
                                priority -= 44.0
                        if support_kind.lower().endswith(("method", "hook", "accessor")):
                            priority += 12.0
                        elif support_kind.lower().endswith(("field", "shell", "slot")):
                            priority += 8.0
                        if projection_kind == "token-shop-row-structure":
                            if support_kind in {"getterTargets", "updaterTargets"}:
                                priority += 36.0
                            elif support_kind == "runtimeSlotTargets":
                                priority += 56.0
                            elif support_kind == "instanceTargets":
                                priority += 48.0
                            elif support_kind in {"ownerTargets", "parameterTargets"}:
                                priority += 18.0
                            if support_kind == "runtimeSlotTargets":
                                if source_node_id in {"SetCostRelatedAttributes", "CalculateAndSetUpgradeCalculations", "BuyAndApplyUpgrade"}:
                                    priority += 26.0
                                if source_node_id.startswith(("set_", "get_")):
                                    priority -= 18.0
                            if support_kind == "instanceTargets":
                                if source_node_id and source_node_id in {runtime_instance_owner, runtime_creation_method}:
                                    priority += 34.0
                                elif runtime_instance_owner and source_node_id == runtime_evaluator_owner:
                                    priority -= 16.0
                        if _projection_term_shape(source_node_id) == "button" and support_kind == "actionTargets":
                            priority += 28.0
                            priority += _button_progress_bonus(source_node_id)
                            priority += self._button_action_completion_bonus(conn, source_node_id)
                        priority -= _anchor_penalty_score(source_node_id)
                        priority -= _anchor_penalty_score(target_value) * 0.5
                        priority -= _projection_pair_penalty(
                            source_node_id,
                            target_value,
                            support_kind,
                            projection_kind,
                            payload,
                        )
                        priority -= float(recent_target_attempt_counts.get((preferred_trace_scope, target_value), 0)) * 25.0
                        priority -= float(recent_source_attempt_counts.get((preferred_trace_scope, source_node_id), 0)) * 8.0
                        graph_digest = _stable_key(
                            [projection_id, projection_kind, support_kind, source_node_id, target_value, projection_completeness]
                        )
                        if checked_pair_digests.get(
                            (preferred_trace_scope, "graph-extension", source_node_id, target_value),
                            "",
                        ) == graph_digest:
                            continue
                        if checked_path_digests.get(
                            (preferred_trace_scope, "graph-extension", candidate_fingerprint),
                            "",
                        ) == graph_digest:
                            continue
                        obligation_id = _stable_key(
                            [
                                "v2-obligation",
                                "continue-projection-lane",
                                preferred_trace_scope,
                                source_node_id,
                                target_value,
                            ]
                        )
                        derived_ids.add(obligation_id)
                        inserted = self._upsert_obligation(
                            conn,
                            obligation_id=obligation_id,
                            obligation_kind="continue-projection-path",
                            relation_kind="graph-extension",
                            source_node_id=source_node_id,
                            target_node_id=target_value,
                            preferred_trace_scope=preferred_trace_scope,
                            priority=priority,
                            support_count=support_count,
                            graph_context_digest=graph_digest,
                            payload={
                                "projectionId": projection_id,
                                "projectionKind": projection_kind,
                                "supportKind": support_kind,
                                "pathFingerprint": candidate_fingerprint,
                                "candidateTerm": target_value,
                                "goal": "Extend V2 consumer projection structure into a missing graph relation.",
                            },
                            provenance={
                                "source": "consumer_projections_v2",
                                "projectionId": projection_id,
                                "projectionKind": projection_kind,
                                "projectionCompleteness": projection_completeness,
                            },
                            updated_at=str(row["updated_at"] or _now_iso()),
                        )
                        if inserted:
                            counts["open"] += 1
                            self._upsert_obligation_support(
                                conn,
                                obligation_id=obligation_id,
                                support_kind="projection-term",
                                support_ref=f"{projection_id}:{support_kind}:{target_value}",
                                payload={"projectionKind": projection_kind, "supportKind": support_kind},
                                provenance={"source": "consumer_projections_v2"},
                                created_at=str(row["updated_at"] or _now_iso()),
                            )
                            counts["supports"] += 1

                    if (
                        projection_kind == "token-shop-row-structure"
                        and runtime_formula_model_recovered
                        and runtime_instance_recovered
                        and runtime_display_seam_open
                    ):
                        display_slot_targets = [
                            str(value).strip()
                            for value in (
                                list(runtime_projection.get("runtimeSlotTargets") or [])
                                + list(payload.get("uiSlots") or [])
                            )
                            if str(value).strip() and _looks_like_display_slot_term(str(value).strip())
                        ]
                        preferred_display_slot = next(
                            (value for value in display_slot_targets if value in {"CostText", "LevelText", "TokenDescText_TMPro"}),
                            display_slot_targets[0] if display_slot_targets else "",
                        )
                        unresolved_runtime_targets = [
                            str(value).strip()
                            for value in (runtime_projection.get("unresolvedRuntimeTargets") or [])
                            if str(value).strip()
                        ]
                        semantic_target_specs = []
                        action_hook = str(payload.get("actionHook") or "").strip()
                        row_button = str(payload.get("rowButton") or "").strip()
                        updater_targets = [
                            str(value).strip()
                            for value in (payload.get("updaterTargets") or [])
                            if str(value).strip()
                        ]
                        if "runtime-evaluator-instance-formula" in unresolved_runtime_targets:
                            semantic_target_specs.append(
                                {
                                    "target": "runtime-evaluator-instance-formula",
                                    "preferredSources": [
                                        "SetCostRelatedAttributes",
                                        "CalculateAndSetUpgradeCalculations",
                                        "BuyAndApplyUpgrade",
                                        action_hook,
                                        row_button,
                                    ],
                                    "goal": "Recover the remaining runtime evaluator / instance formula for this row.",
                                    "priority": 404.0,
                                }
                            )
                        for target_name, goal_text, goal_priority in (
                            ("runtime-cost-exponent-instance-value", "Recover the runtime cost exponent value for the selected evaluator instance.", 416.0),
                            ("runtime-calculation-type-instance-value", "Recover the runtime calculation type value that selects the evaluator path for this row.", 414.0),
                            ("runtime-final-set-value-instance-value", "Recover the runtime final-set value used to render this row.", 412.0),
                            ("runtime-displayed-cost-expression", "Recover the exact runtime displayed-cost expression for this row.", 420.0),
                            ("runtime-output-preview-value", "Recover the runtime output or preview value used by this row.", 410.0),
                        ):
                            if target_name not in unresolved_runtime_targets:
                                continue
                            semantic_target_specs.append(
                                {
                                    "target": target_name,
                                    "preferredSources": [
                                        "SetCostRelatedAttributes",
                                        "CalculateAndSetUpgradeCalculations",
                                        "BuyAndApplyUpgrade",
                                        action_hook,
                                        row_button,
                                    ],
                                    "goal": goal_text,
                                    "priority": goal_priority,
                                }
                            )
                        if "fast-buy-runtime-quantity" in unresolved_runtime_targets:
                            semantic_target_specs.append(
                                {
                                    "target": "fast-buy-runtime-quantity",
                                    "preferredSources": [
                                        action_hook,
                                        "BuyAndApplyUpgrade",
                                        "SetCostRelatedAttributes",
                                        row_button,
                                    ],
                                    "goal": "Recover the row-local fast-buy quantity lane that affects displayed cost/value behavior.",
                                    "priority": 392.0,
                                }
                            )
                        if "set-wide-cost-modifiers" in unresolved_runtime_targets:
                            semantic_target_specs.append(
                                {
                                    "target": "set-wide-cost-modifiers",
                                    "preferredSources": [
                                        "CalculateAndSetUpgradeCalculations",
                                        "BuyAndApplyUpgrade",
                                        action_hook,
                                        row_button,
                                    ],
                                    "goal": "Recover the set-wide runtime cost modifiers that alter displayed row values.",
                                    "priority": 388.0,
                                }
                            )
                        if not semantic_target_specs and preferred_display_slot:
                            semantic_target_specs.append(
                                {
                                    "target": "runtime-display-formula",
                                    "preferredSources": [
                                        "SetCostRelatedAttributes",
                                        "CalculateAndSetUpgradeCalculations",
                                        "BuyAndApplyUpgrade",
                                        action_hook,
                                        row_button,
                                    ],
                                    "goal": "Recover the remaining runtime display/effective-value formula for this row.",
                                    "priority": 396.0,
                                }
                            )
                        for semantic_spec in semantic_target_specs:
                            preferred_formula_source = next(
                                (
                                    value
                                    for value in semantic_spec.get("preferredSources") or []
                                    if value and source_node_id == value
                                ),
                                "",
                            )
                            if semantic_spec.get("preferredSources") and not preferred_formula_source:
                                continue
                            formula_obligation_id = _stable_key(
                                [
                                    "v2-obligation",
                                    "continue-runtime-display-formula",
                                    preferred_trace_scope,
                                    source_node_id,
                                    projection_id,
                                    str(semantic_spec.get("target") or "").strip(),
                                ]
                            )
                            derived_ids.add(formula_obligation_id)
                            formula_payload = {
                                "candidateTerm": str(semantic_spec.get("target") or "runtime-display-formula").strip(),
                                "goal": str(semantic_spec.get("goal") or "").strip(),
                                "projectionId": projection_id,
                                "projectionKind": projection_kind,
                                "supportKind": "runtimeDisplayFormula",
                                "displaySlots": display_slot_targets,
                                "displayAnchor": preferred_display_slot,
                                "unresolvedRuntimeTargets": unresolved_runtime_targets,
                            }
                            inserted = self._upsert_obligation(
                                conn,
                                obligation_id=formula_obligation_id,
                                obligation_kind="continue-runtime-display-formula",
                                relation_kind="runtime-display-formula",
                                source_node_id=source_node_id,
                                target_node_id=str(semantic_spec.get("target") or "runtime-display-formula").strip(),
                                preferred_trace_scope=preferred_trace_scope,
                                priority=float(semantic_spec.get("priority") or 396.0),
                                support_count=max(
                                    1,
                                    len(display_slot_targets)
                                    + len([value for value in (payload.get("rowValueFields") or []) if str(value).strip()]),
                                ),
                                graph_context_digest=_stable_key(
                                    [
                                        "v2-scope-digest",
                                        preferred_trace_scope,
                                        str(semantic_spec.get("target") or "runtime-display-formula").strip(),
                                    ]
                                ),
                                payload=formula_payload,
                                provenance={
                                    "source": "consumer_projections_v2",
                                    "projectionId": projection_id,
                                    "projectionKind": projection_kind,
                                    "projectionCompleteness": projection_completeness,
                                },
                                updated_at=str(row["updated_at"] or _now_iso()),
                            )
                            if inserted:
                                counts["open"] += 1
                            self._upsert_obligation_support(
                                conn,
                                obligation_id=formula_obligation_id,
                                support_kind="runtime-display-formula",
                                support_ref=str(semantic_spec.get("target") or preferred_display_slot or "runtime-display-formula").strip(),
                                payload={
                                    "displaySlots": display_slot_targets,
                                    "unresolvedRuntimeTargets": unresolved_runtime_targets,
                                },
                                provenance={"source": "consumer_projections_v2", "traceScope": preferred_trace_scope},
                                created_at=str(row["updated_at"] or _now_iso()),
                            )
                            counts["supports"] += 1
                    for support_kind, bundle_targets in bundle_targets_by_support.items():
                        unique_bundle_targets = list(dict.fromkeys(bundle_targets))
                        if len(unique_bundle_targets) < 2:
                            continue
                        ranked_bundle_targets = unique_bundle_targets[:8]
                        batch_fingerprint = _stable_key(
                            [
                                "v2-projection-bundle",
                                preferred_trace_scope,
                                projection_id,
                                source_node_id,
                                support_kind,
                                *ranked_bundle_targets,
                            ]
                        )
                        batch_graph_digest = _stable_key(
                            [
                                projection_id,
                                projection_kind,
                                support_kind,
                                source_node_id,
                                projection_completeness,
                                *ranked_bundle_targets,
                            ]
                        )
                        if checked_path_digests.get(
                            (preferred_trace_scope, "graph-extension", batch_fingerprint),
                            "",
                        ) == batch_graph_digest:
                            continue
                        bundle_priority = 250.0
                        if projection_completeness == "structured":
                            bundle_priority += 24.0
                        elif projection_completeness == "partial":
                            bundle_priority += 12.0
                        if projection_kind == "runtime-bridge-structure":
                            bridge_targets = {
                                str(value).strip()
                                for value in (payload.get("bridgeTargets") or [])
                                if str(value).strip()
                            }
                            if str(payload.get("rowButton") or "").strip() and str(payload.get("actionHook") or "").strip():
                                if "family" not in preferred_trace_scope:
                                    bundle_priority += 22.0
                                if bridge_targets & {"CostBox", "CostText", "costTexts", "levelTexts"}:
                                    bundle_priority += 52.0
                                if source_node_id == str(payload.get("actionHook") or "").strip():
                                    bundle_priority += 22.0
                                if source_node_id == str(payload.get("sourceAnchor") or "").strip():
                                    bundle_priority += 14.0
                        if support_kind.lower().endswith(("method", "hook", "accessor")):
                            bundle_priority += 14.0
                        elif support_kind.lower().endswith(("field", "shell", "slot")):
                            bundle_priority += 10.0
                        if projection_kind == "token-shop-row-structure":
                            if support_kind in {"getterTargets", "updaterTargets"}:
                                bundle_priority += 40.0
                            elif support_kind == "runtimeSlotTargets":
                                bundle_priority += 60.0
                            elif support_kind == "instanceTargets":
                                bundle_priority += 52.0
                            elif support_kind in {"ownerTargets", "parameterTargets"}:
                                bundle_priority += 20.0
                            if support_kind == "runtimeSlotTargets":
                                if source_node_id in {"SetCostRelatedAttributes", "CalculateAndSetUpgradeCalculations", "BuyAndApplyUpgrade"}:
                                    bundle_priority += 30.0
                                if source_node_id.startswith(("set_", "get_")):
                                    bundle_priority -= 20.0
                            if support_kind == "instanceTargets":
                                if source_node_id and source_node_id in {runtime_instance_owner, runtime_creation_method}:
                                    bundle_priority += 36.0
                                elif runtime_instance_owner and source_node_id == runtime_evaluator_owner:
                                    bundle_priority -= 18.0
                        if _projection_term_shape(source_node_id) == "button" and support_kind == "actionTargets":
                            bundle_priority += 32.0
                            bundle_priority += _button_progress_bonus(source_node_id)
                            bundle_priority += self._button_action_completion_bonus(conn, source_node_id)
                        bundle_priority -= _anchor_penalty_score(source_node_id)
                        bundle_priority -= float(recent_source_attempt_counts.get((preferred_trace_scope, source_node_id), 0)) * 10.0
                        bundle_priority += min(float(len(ranked_bundle_targets)) * 4.0, 24.0)
                        bundle_priority -= float(
                            sum(recent_target_attempt_counts.get((preferred_trace_scope, target), 0) for target in ranked_bundle_targets)
                        ) * 8.0
                        bundle_obligation_id = _stable_key(
                            [
                                "v2-obligation",
                                "continue-projection-bundle",
                                preferred_trace_scope,
                                projection_id,
                                source_node_id,
                                support_kind,
                            ]
                        )
                        derived_ids.add(bundle_obligation_id)
                        inserted = self._upsert_obligation(
                            conn,
                            obligation_id=bundle_obligation_id,
                            obligation_kind="continue-projection-bundle",
                            relation_kind="graph-extension",
                            source_node_id=source_node_id,
                            target_node_id=ranked_bundle_targets[0],
                            preferred_trace_scope=preferred_trace_scope,
                            priority=bundle_priority,
                            support_count=len(ranked_bundle_targets),
                            graph_context_digest=batch_graph_digest,
                            payload={
                                "projectionId": projection_id,
                                "projectionKind": projection_kind,
                                "supportKind": support_kind,
                                "pathFingerprint": batch_fingerprint,
                                "candidateTerm": ranked_bundle_targets[0],
                                "batchedCandidateTerms": ranked_bundle_targets,
                                "goal": "Process a bounded projection neighborhood in one run instead of exhausting sibling terms individually.",
                            },
                            provenance={
                                "source": "consumer_projections_v2",
                                "projectionId": projection_id,
                                "projectionKind": projection_kind,
                                "projectionCompleteness": projection_completeness,
                                "bundleMode": True,
                            },
                            updated_at=str(row["updated_at"] or _now_iso()),
                        )
                        if inserted:
                            counts["open"] += 1
                            self._upsert_obligation_support(
                                conn,
                                obligation_id=bundle_obligation_id,
                                support_kind="projection-bundle",
                                support_ref=f"{projection_id}:{support_kind}:{source_node_id}",
                                payload={
                                    "projectionKind": projection_kind,
                                    "supportKind": support_kind,
                                    "batchedCandidateTerms": ranked_bundle_targets,
                                },
                                provenance={"source": "consumer_projections_v2"},
                                created_at=str(row["updated_at"] or _now_iso()),
                            )
                            counts["supports"] += 1

            for row in conn.execute(
                """
                SELECT obligation_id
                FROM graph_obligations_v2
                WHERE obligation_status = 'open'
                """
            ).fetchall():
                obligation_id = str(row["obligation_id"] or "").strip()
                if obligation_id and obligation_id not in derived_ids:
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
            projection_obligation_rows = conn.execute(
                """
                SELECT obligation_id, source_node_id, target_node_id, payload_json
                FROM graph_obligations_v2
                WHERE obligation_status = 'open'
                  AND obligation_kind IN ('continue-projection-path', 'continue-projection-bundle', 'continue-runtime-display-formula')
                """
            ).fetchall()
            for row in projection_obligation_rows:
                obligation_id = str(row["obligation_id"] or "").strip()
                source_node_id = str(row["source_node_id"] or "").strip()
                target_node_id = str(row["target_node_id"] or "").strip()
                payload = _json_loads(row["payload_json"], {})
                projection_id = str(payload.get("projectionId") or "").strip()
                support_kind = str(payload.get("supportKind") or "").strip()
                if not obligation_id or not projection_id or not support_kind:
                    continue
                projection_row = conn.execute(
                    """
                    SELECT projection_kind, subject_id, payload_json
                    FROM consumer_projections_v2
                    WHERE projection_id = ?
                      AND projection_status = 'active'
                    """,
                    (projection_id,),
                ).fetchone()
                if not projection_row:
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
                    continue
                projection_kind = str(projection_row["projection_kind"] or "").strip()
                subject_id = str(projection_row["subject_id"] or "").strip()
                projection_payload = _json_loads(projection_row["payload_json"], {})
                runtime_projection = _normalize_token_shop_runtime_projection(projection_payload.get("runtimeProjection") or {})
                runtime_instance_recovered = _token_shop_runtime_instance_layer_recovered(runtime_projection)
                runtime_display_seam_open = _token_shop_runtime_display_seam_open(runtime_projection)
                if (
                    projection_kind == "token-shop-row-structure"
                    and runtime_instance_recovered
                    and runtime_display_seam_open
                    and support_kind == "instanceTargets"
                ):
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
                    continue
                live_source_node_ids = _projection_live_source_anchors(
                    projection_kind,
                    projection_payload,
                    subject_id,
                )
                batched_candidate_terms = [
                    str(value).strip()
                    for value in (payload.get("batchedCandidateTerms") or [])
                    if str(value).strip()
                ]
                if source_node_id not in live_source_node_ids:
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
                    continue
                if (
                    projection_kind == "token-shop-row-structure"
                    and support_kind == "runtimeDisplayFormula"
                    and (
                        not runtime_instance_recovered
                        or not runtime_display_seam_open
                        or not (
                            str(dict(runtime_projection.get("displayFormula") or {}).get("status") or "").strip()
                            == "unresolved-runtime-modifiers"
                            and runtime_projection.get("baseMaxLevel") is not None
                            and bool(str(runtime_projection.get("nextCostAccessor") or "").strip())
                        )
                    )
                ):
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
                    continue
                if (
                    projection_kind == "runtime-bridge-structure"
                    and support_kind == "rowValueFields"
                ):
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
                    continue
                if (
                    projection_kind == "token-shop-row-structure"
                    and runtime_instance_recovered
                    and support_kind in {"getterTargets", "updaterTargets", "runtimeSlotTargets", "ownerTargets", "parameterTargets"}
                ):
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
                    continue
                if batched_candidate_terms:
                    uncovered_bundle_targets = [
                        target_value
                        for target_value in batched_candidate_terms
                        if not self._projection_proxy_relation_covered(conn, source_node_id, target_value)
                    ]
                    if not uncovered_bundle_targets:
                        conn.execute(
                            """
                            UPDATE graph_obligations_v2
                            SET obligation_status = 'closed',
                                updated_at = ?
                            WHERE obligation_id = ?
                            """,
                            (_now_iso(), obligation_id),
                        )
                        counts["closed"] += 1
                        continue
                elif target_node_id and self._projection_proxy_relation_covered(conn, source_node_id, target_node_id):
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
                    continue
                if support_kind == "runtimeDisplayFormula":
                    continue
                if str(payload.get("batchedCandidateTerms") or ""):
                    live_targets = {
                        str(target_value or "").strip()
                        for candidate_support_kind, target_value in _iter_projection_target_terms(projection_payload)
                        if candidate_support_kind == support_kind
                        and _projection_pair_is_plausible(
                            source_node_id,
                            str(target_value or "").strip(),
                            candidate_support_kind,
                            projection_kind,
                            projection_payload,
                        )
                    }
                    if batched_candidate_terms and not any(value in live_targets for value in batched_candidate_terms):
                        conn.execute(
                            """
                            UPDATE graph_obligations_v2
                            SET obligation_status = 'closed',
                                updated_at = ?
                            WHERE obligation_id = ?
                            """,
                            (_now_iso(), obligation_id),
                        )
                        counts["closed"] += 1
                elif not _projection_pair_is_plausible(
                    source_node_id,
                    target_node_id,
                    support_kind,
                    projection_kind,
                    projection_payload,
                ):
                    conn.execute(
                        """
                        UPDATE graph_obligations_v2
                        SET obligation_status = 'closed',
                            updated_at = ?
                        WHERE obligation_id = ?
                        """,
                        (_now_iso(), obligation_id),
                    )
                    counts["closed"] += 1
            counts["open"] = int(
                (
                    conn.execute(
                        """
                        SELECT COUNT(*) AS c
                        FROM graph_obligations_v2
                        WHERE obligation_status = 'open'
                        """
                    ).fetchone()
                    or {"c": 0}
                )["c"]
                or 0
            )
            counts["supports"] = int(
                (
                    conn.execute(
                        """
                        SELECT COUNT(*) AS c
                        FROM graph_obligation_support_v2
                        WHERE obligation_id IN (
                            SELECT obligation_id
                            FROM graph_obligations_v2
                            WHERE obligation_status = 'open'
                        )
                        """
                    ).fetchone()
                    or {"c": 0}
                )["c"]
                or 0
            )
        return counts

    def _list_scope_candidate_terms(self, conn: sqlite3.Connection, trace_scope: str) -> list[dict[str, Any]]:
        term_rows: dict[str, dict[str, Any]] = {}

        def add_term(term: str, source: str, status: str = "") -> None:
            value = str(term or "").strip()
            if not _looks_like_actionable_anchor_term(value):
                return
            row = term_rows.setdefault(
                value,
                {"term": value, "count": 0, "sources": set(), "statuses": set(), "score": 0.0},
            )
            row["count"] += 1
            row["sources"].add(source)
            if status:
                row["statuses"].add(status)
            score = 1.0
            if value.startswith(("Buy", "Set", "get_", "Get", "Update", "Fill", "NewTokenUPGPrefab")):
                score += 2.0
            if _contains_domain_signal(value):
                score += 2.0
            if "resolved" in status:
                score += 1.0
            if source == "native-gap":
                score += 1.0
            row["score"] += score

        def walk(value: Any, source: str, collected: set[str], parent_key: str = "") -> None:
            if isinstance(value, dict):
                for key, nested in value.items():
                    key_name = str(key or "")
                    if isinstance(nested, str) and key_name in {
                        "term",
                        "note",
                        "terms",
                        "anchors",
                        "acceptedAnchors",
                        "expandedAnchors",
                        "followUpTerms",
                        "requestedTerms",
                        "searchTerms",
                        "executedSearchTerms",
                        "bridgedTerms",
                        "contextTerms",
                        "selectedNativeCoreTerms",
                        "selectedContextTerms",
                    }:
                        if key_name == "note":
                            for chunk in nested.split(","):
                                if _looks_like_concrete_term(chunk):
                                    collected.add(str(chunk).strip())
                        elif _looks_like_concrete_term(nested):
                            collected.add(str(nested).strip())
                    else:
                        walk(nested, source, collected, key_name)
                return
            if isinstance(value, list):
                for item in value:
                    walk(item, source, collected, parent_key)
                return
            if isinstance(value, str) and parent_key in {
                "term",
                "note",
                "terms",
                "anchors",
                "acceptedAnchors",
                "expandedAnchors",
                "followUpTerms",
                "requestedTerms",
                "searchTerms",
                "executedSearchTerms",
                "bridgedTerms",
                "contextTerms",
                "selectedNativeCoreTerms",
                "selectedContextTerms",
            }:
                if parent_key == "note":
                    for chunk in value.split(","):
                        if _looks_like_concrete_term(chunk):
                            collected.add(str(chunk).strip())
                elif _looks_like_concrete_term(value):
                    collected.add(str(value).strip())

        semantic_rows = conn.execute(
            """
            SELECT fragment_kind, payload_json
            FROM semantic_fragments_v2
            WHERE trace_scope = ?
            """,
            (trace_scope,),
        ).fetchall()
        for row in semantic_rows:
            local_terms: set[str] = set()
            walk(_json_loads(row["payload_json"], {}), f"semantic:{str(row['fragment_kind'] or '').strip()}", local_terms)
            for term in local_terms:
                add_term(term, f"semantic:{str(row['fragment_kind'] or '').strip()}")

        managed_rows = conn.execute(
            """
            SELECT graph_kind, payload_json
            FROM managed_graph_fragments_v2
            WHERE trace_scope = ?
            """,
            (trace_scope,),
        ).fetchall()
        for row in managed_rows:
            local_terms: set[str] = set()
            walk(_json_loads(row["payload_json"], {}), f"managed:{str(row['graph_kind'] or '').strip()}", local_terms)
            for term in local_terms:
                add_term(term, f"managed:{str(row['graph_kind'] or '').strip()}")

        native_rows = conn.execute(
            """
            SELECT value_kind, payload_json
            FROM native_value_fragments_v2
            WHERE trace_scope = ?
            """,
            (trace_scope,),
        ).fetchall()
        for row in native_rows:
            value_kind = str(row["value_kind"] or "").strip()
            payload = _json_loads(row["payload_json"], {})
            if value_kind == "native_acquisition_gap_fragment" and isinstance(payload, dict):
                add_term(str(payload.get("term") or "").strip(), "native-gap", str(payload.get("status") or "").strip())
                for executed in payload.get("executedSearchTerms") or []:
                    add_term(str(executed or "").strip(), "native-gap-executed", str(payload.get("status") or "").strip())
            else:
                local_terms: set[str] = set()
                walk(payload, f"native:{value_kind}", local_terms)
                for term in local_terms:
                    add_term(term, f"native:{value_kind}")

        results = []
        for row in term_rows.values():
            results.append(
                {
                    "term": row["term"],
                    "count": int(row["count"]),
                    "sources": sorted(str(source) for source in row["sources"]),
                    "statuses": sorted(str(status) for status in row["statuses"] if status),
                    "score": float(row["score"]),
                }
            )
        results.sort(key=lambda item: (-float(item["score"]), -int(item["count"]), item["term"]))
        return results

    def _graph_relation_exists(self, conn: sqlite3.Connection, left_node_id: str, right_node_id: str) -> bool:
        row = conn.execute(
            """
            SELECT 1
            FROM graph_edges_v2
            WHERE edge_status = 'present'
              AND (
                    (source_node_id = ? AND target_node_id = ?)
                 OR (source_node_id = ? AND target_node_id = ?)
              )
            LIMIT 1
            """,
            (left_node_id, right_node_id, right_node_id, left_node_id),
        ).fetchone()
        return bool(row)

    def _strong_graph_relation_exists(self, conn: sqlite3.Connection, left_node_id: str, right_node_id: str) -> bool:
        strong_relations = (
            "serialized-adjacency",
            "exact-shell-to-action-hook",
            "exact-shell-to-prefab",
            "exact-display-update-path",
            "getter-family",
            "returns-value-from",
            "binds-ui-slot",
            "getter-to-parameter-shell",
            "metadata-row0-parameter-shell",
            "deterministic-evaluator",
            "save-owner-recovery",
            "native-reconstruction",
        )
        placeholders = ",".join("?" for _ in strong_relations)
        row = conn.execute(
            f"""
            SELECT 1
            FROM graph_edges_v2
            WHERE edge_status = 'present'
              AND relation_kind IN ({placeholders})
              AND (
                    (source_node_id = ? AND target_node_id = ?)
                 OR (source_node_id = ? AND target_node_id = ?)
              )
            LIMIT 1
            """,
            (*strong_relations, left_node_id, right_node_id, right_node_id, left_node_id),
        ).fetchone()
        return bool(row)

    def _infer_button_action_candidates_with_conn(
        self,
        conn: sqlite3.Connection,
        trace_scope: str,
        source_node_id: str,
        row_terms: list[str],
        limit: int = 4,
    ) -> list[str]:
        scope_value = str(trace_scope or "").strip()
        source_value = str(source_node_id or "").strip()
        if not scope_value or not source_value:
            return []
        exact_action_rows = conn.execute(
            """
            SELECT target_node_id
            FROM graph_edges_v2
            WHERE source_node_id = ?
              AND relation_kind = 'exact-shell-to-action-hook'
              AND edge_status = 'present'
            ORDER BY support_count DESC, updated_at DESC
            """,
            (source_value,),
        ).fetchall()
        if exact_action_rows:
            exact_actions: list[str] = []
            seen_exact: set[str] = set()
            exact_terms = {str(row["target_node_id"] or "").strip() for row in exact_action_rows if str(row["target_node_id"] or "").strip()}
            for term in sorted(exact_terms):
                canonical_term = term[:-4] if term.endswith("Enum") and term[:-4] in exact_terms else term
                if canonical_term in seen_exact:
                    continue
                if term.endswith("Enum") and canonical_term != term:
                    continue
                seen_exact.add(canonical_term)
                exact_actions.append(canonical_term)
            if exact_actions:
                return exact_actions[: max(int(limit or 0), 1)]
        row_projection = conn.execute(
            """
            SELECT payload_json
            FROM consumer_projections_v2
            WHERE subject_id = ?
              AND projection_kind = 'token-shop-row-structure'
              AND projection_status = 'active'
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (source_value,),
        ).fetchone()
        if row_projection:
            row_payload = _json_loads(row_projection["payload_json"], {})
            if isinstance(row_payload, dict):
                action_hook = str(row_payload.get("actionHook") or "").strip()
                if action_hook:
                    return [action_hook]
        native_token_weights: Counter[str] = Counter()
        native_rows = conn.execute(
            """
            SELECT payload_json
            FROM native_value_fragments_v2
            WHERE trace_scope = ?
              AND payload_json LIKE ?
            ORDER BY created_at DESC
            LIMIT 64
            """,
            (scope_value, f"%{source_value}%"),
        ).fetchall()
        for native_row in native_rows:
            payload = _json_loads(native_row["payload_json"], {})
            trace_knowledge = dict(payload.get("traceKnowledge") or {})
            bridge_plan = dict(trace_knowledge.get("bridgePlan") or {})
            for match in bridge_plan.get("matches") or []:
                if not isinstance(match, dict) or str(match.get("shellField") or "").strip() != source_value:
                    continue
                for term in [
                    str(match.get("matchedField") or "").strip(),
                    *[str(value or "").strip() for value in (match.get("ownerFieldBlock") or [])],
                    *[str(value or "").strip() for value in (match.get("controllerBlock") or [])],
                ]:
                    if not term:
                        continue
                    for token in (_projection_non_generic_tokens(term) or _projection_identity_tokens(term)):
                        native_token_weights[token] += 1
        graph_row_terms = [
            str(item["target_node_id"] or "").strip()
            for item in conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND edge_status = 'present'
                  AND relation_kind IN ('serialized-adjacency', 'binds-ui-slot')
                ORDER BY updated_at DESC
                """,
                (source_value,),
            ).fetchall()
            if str(item["target_node_id"] or "").strip()
        ]
        combined_row_terms = list(dict.fromkeys([*row_terms, *graph_row_terms]))
        row_tokens = _button_row_tokens(combined_row_terms)
        if native_token_weights:
            row_tokens.update(native_token_weights.keys())
        row_family_heads = _button_row_family_heads(combined_row_terms)
        native_family_tokens = {token for token in native_token_weights.keys() if re.fullmatch(r"(atu|su|du|mk)\d+", token)}
        if not row_tokens:
            return []
        preferred_runtime_actions = _preferred_button_actions_from_runtime_terms(combined_row_terms)
        if preferred_runtime_actions:
            return preferred_runtime_actions[: max(int(limit or 0), 1)]
        synthesized_actions = _synthesize_button_actions_from_row_terms(combined_row_terms)
        if synthesized_actions:
            return synthesized_actions[: max(int(limit or 0), 1)]
        candidates = self._list_scope_candidate_terms(conn, scope_value)
        ranked: list[tuple[float, str]] = []
        for candidate in candidates:
            term = str(candidate.get("term") or "").strip()
            if not term or _projection_term_shape(term) != "action":
                continue
            term_tokens = _projection_non_generic_tokens(term) or _projection_identity_tokens(term)
            overlap = row_tokens & term_tokens
            if not overlap:
                continue
            score = float(candidate.get("score") or 0.0)
            if native_token_weights:
                score += float(sum(native_token_weights.get(token, 0) for token in overlap)) * 12.0
            score += float(len(overlap)) * 20.0
            term_family_tokens = _projection_family_tokens(term)
            if native_family_tokens and term_family_tokens and not (native_family_tokens & term_family_tokens):
                continue
            action_family_head = _action_family_head(term)
            if row_family_heads:
                if not action_family_head:
                    continue
                if action_family_head not in row_family_heads:
                    continue
            if term.endswith("Enum"):
                score -= 12.0
            if term.startswith("Buy"):
                score += 6.0
            ranked.append((score, term))
        for synthesized_action in synthesized_actions:
            synth_family_head = _action_family_head(synthesized_action)
            if row_family_heads and synth_family_head not in row_family_heads:
                continue
            synth_score = 240.0 + float(sum(native_token_weights.values())) * 2.0
            if synth_family_head and any(value == synth_family_head for value in row_family_heads):
                synth_score += 40.0
            ranked.append((synth_score, synthesized_action))
        ranked.sort(key=lambda item: (-item[0], item[1]))
        ranked_terms = [term for _, term in ranked]
        ranked_term_set = set(ranked_terms)
        ordered: list[str] = []
        seen: set[str] = set()
        for term in ranked_terms:
            canonical_term = term[:-4] if term.endswith("Enum") and term[:-4] in ranked_term_set else term
            if canonical_term in seen:
                continue
            if term.endswith("Enum") and canonical_term != term:
                continue
            seen.add(canonical_term)
            ordered.append(canonical_term)
        return ordered[: max(int(limit or 0), 1)]

    def _button_action_completion_bonus(self, conn: sqlite3.Connection, source_node_id: str) -> float:
        source_value = str(source_node_id or "").strip()
        if not re.fullmatch(r"ATU\d+Button", source_value):
            return 0.0
        exact_present = conn.execute(
            """
            SELECT 1
            FROM graph_edges_v2
            WHERE source_node_id = ?
              AND relation_kind = 'exact-shell-to-action-hook'
              AND edge_status = 'present'
            LIMIT 1
            """,
            (source_value,),
        ).fetchone()
        if exact_present:
            return 0.0
        shell_progress_count = int(
            (
                conn.execute(
                    """
                    SELECT COUNT(*) AS c
                    FROM graph_edges_v2
                    WHERE source_node_id = ?
                      AND edge_status = 'present'
                      AND relation_kind IN ('serialized-adjacency', 'binds-ui-slot')
                    """,
                    (source_value,),
                ).fetchone()
                or {"c": 0}
            )["c"]
            or 0
        )
        if shell_progress_count < 3:
            return 0.0
        row_projection = conn.execute(
            """
            SELECT payload_json
            FROM consumer_projections_v2
            WHERE subject_id = ?
              AND projection_kind = 'token-shop-row-structure'
              AND projection_status = 'active'
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            (source_value,),
        ).fetchone()
        if not row_projection:
            return 72.0
        payload = _json_loads(row_projection["payload_json"], {})
        completeness = str(payload.get("projectionCompleteness") or "").strip()
        if completeness != "structured":
            return 48.0
        return 0.0

    def _projection_proxy_relation_covered(
        self,
        conn: sqlite3.Connection,
        source_node_id: str,
        target_node_id: str,
    ) -> bool:
        if self._strong_graph_relation_exists(conn, source_node_id, target_node_id):
            return True
        source_value = str(source_node_id or "").strip()
        target_value = str(target_node_id or "").strip()
        if not source_value or not target_value:
            return False
        source_shape = _projection_term_shape(source_value)
        target_shape = _projection_term_shape(target_value)
        if target_value in {
            "runtime-evaluator-instance-formula",
            "runtime-cost-exponent-instance-value",
            "runtime-calculation-type-instance-value",
            "runtime-final-set-value-instance-value",
            "runtime-displayed-cost-expression",
            "runtime-output-preview-value",
            "fast-buy-runtime-quantity",
            "set-wide-cost-modifiers",
            "runtime-display-formula",
        }:
            runtime_rows = conn.execute(
                """
                SELECT payload_json
                FROM consumer_projections_v2
                WHERE projection_status = 'active'
                  AND projection_kind = 'token-shop-row-structure'
                  AND payload_json LIKE ?
                LIMIT 32
                """,
                (f"%{source_value}%",),
            ).fetchall()
            for runtime_row in runtime_rows:
                row_payload = _json_loads(runtime_row["payload_json"], {})
                if _runtime_display_formula_target_covered(row_payload, target_value):
                    return True
        if source_shape == "updater" and target_shape == "ui-shell":
            row_projection = conn.execute(
                """
                SELECT 1
                FROM consumer_projections_v2
                WHERE projection_status = 'active'
                  AND projection_kind = 'token-shop-row-structure'
                  AND payload_json LIKE ?
                  AND payload_json LIKE ?
                LIMIT 1
                """,
                (f"%{source_value}%", f"%{target_value}%"),
            ).fetchone()
            if row_projection:
                return True
        if source_shape != "action":
            return False

        target_relation_kinds: tuple[str, ...] = ()
        if target_shape in {"value-field", "owner", "symbol"}:
            target_relation_kinds = ("serialized-adjacency",)
        elif target_shape in {"ui-shell", "button"}:
            direct_shell_row = conn.execute(
                """
                SELECT 1
                FROM graph_edges_v2
                WHERE edge_status = 'present'
                  AND relation_kind = 'exact-shell-to-action-hook'
                  AND source_node_id = ?
                  AND target_node_id = ?
                LIMIT 1
                """,
                (target_value, source_value),
            ).fetchone()
            if direct_shell_row:
                return True
            target_relation_kinds = ("binds-ui-slot",)
        elif target_shape == "prefab":
            target_relation_kinds = ("exact-shell-to-prefab",)
        if not target_relation_kinds:
            return False

        placeholders = ",".join("?" for _ in target_relation_kinds)
        rows = conn.execute(
            f"""
            SELECT action_edge.source_node_id
            FROM graph_edges_v2 action_edge
            JOIN graph_edges_v2 target_edge
              ON target_edge.source_node_id = action_edge.source_node_id
            WHERE action_edge.edge_status = 'present'
              AND action_edge.relation_kind = 'exact-shell-to-action-hook'
              AND action_edge.target_node_id = ?
              AND target_edge.edge_status = 'present'
              AND target_edge.relation_kind IN ({placeholders})
              AND target_edge.target_node_id = ?
            LIMIT 1
            """,
            (source_value, *target_relation_kinds, target_value),
        ).fetchall()
        for row in rows:
            shell_source = str(row["source_node_id"] or "").strip()
            if _projection_term_shape(shell_source) in {"button", "ui-shell"}:
                return True
        return False

    def record_trace_event(
        self,
        *,
        source_run_id: str,
        source_kind: str,
        trace_scope: str,
        request_signature: str,
        payload: dict[str, Any] | None = None,
        provenance: dict[str, Any] | None = None,
        created_at: str = "",
    ) -> str:
        self.ensure_schema()
        event_at = str(created_at or "").strip() or _now_iso()
        event_id = _stable_key(
            [
                "v2-trace-event",
                source_run_id,
                source_kind,
                trace_scope,
                request_signature,
                event_at,
            ]
        )
        with self.connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO trace_events_v2(
                    event_id, source_run_id, source_kind, trace_scope, request_signature,
                    payload_json, provenance_json, created_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    event_id,
                    str(source_run_id or "").strip(),
                    str(source_kind or "").strip(),
                    str(trace_scope or "").strip(),
                    str(request_signature or "").strip(),
                    _json_dumps(payload or {}),
                    _json_dumps(provenance or {}),
                    event_at,
                ),
            )
        return event_id

    def list_recent_execution_attempts(self, limit: int = 20) -> list[dict[str, Any]]:
        self.ensure_schema()
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT attempt_id, trace_scope, relation_kind, obligation_id, source_node_id, target_node_id,
                       request_signature, attempt_status, payload_json, provenance_json, created_at, updated_at
                FROM execution_attempts_v2
                ORDER BY updated_at DESC
                LIMIT ?
                """,
                (int(limit),),
            ).fetchall()
        results: list[dict[str, Any]] = []
        for row in rows:
            payload = _json_loads(row["payload_json"], {})
            execution_backend = (
                payload.get("executionBackend")
                if isinstance(payload.get("executionBackend"), dict)
                else {}
            )
            backend_run = (
                payload.get("backendRun")
                if isinstance(payload.get("backendRun"), dict)
                else payload.get("executionResult")
                if isinstance(payload.get("executionResult"), dict)
                else {}
            )
            backend_export = (
                payload.get("backendExport")
                if isinstance(payload.get("backendExport"), dict)
                else payload.get("executionExport")
                if isinstance(payload.get("executionExport"), dict)
                else {}
            )
            results.append(
                {
                    "attemptId": str(row["attempt_id"] or "").strip(),
                    "traceScope": str(row["trace_scope"] or "").strip(),
                    "relationKind": str(row["relation_kind"] or "").strip(),
                    "obligationId": str(row["obligation_id"] or "").strip(),
                    "sourceNodeId": str(row["source_node_id"] or "").strip(),
                    "targetNodeId": str(row["target_node_id"] or "").strip(),
                    "requestSignature": str(row["request_signature"] or "").strip(),
                    "attemptStatus": str(row["attempt_status"] or "").strip(),
                    "executionBackend": execution_backend,
                    "backendRun": backend_run,
                    "backendExport": backend_export,
                    "payload": payload,
                    "provenance": _json_loads(row["provenance_json"], {}),
                    "createdAt": str(row["created_at"] or "").strip(),
                    "updatedAt": str(row["updated_at"] or "").strip(),
                }
            )
        return results

    def normalize_execution_attempt_payloads(self) -> dict[str, int]:
        self.ensure_schema()
        normalized = 0
        status_updates = 0
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT attempt_id, attempt_status, payload_json
                FROM execution_attempts_v2
                ORDER BY updated_at ASC
                """
            ).fetchall()
            for row in rows:
                attempt_id = str(row["attempt_id"] or "").strip()
                attempt_status = str(row["attempt_status"] or "").strip()
                payload = _json_loads(row["payload_json"], {})
                changed = False

                execution_backend = (
                    payload.get("executionBackend")
                    if isinstance(payload.get("executionBackend"), dict)
                    else {}
                )
                if not execution_backend:
                    legacy_command = payload.get("legacyCommand")
                    if not isinstance(legacy_command, list):
                        legacy_command = payload.get("backendCommand")
                    json_out = str(
                        payload.get("backendJsonOut")
                        or payload.get("legacyJsonOut")
                        or ""
                    ).strip()
                    md_out = str(
                        payload.get("backendMdOut")
                        or payload.get("legacyMdOut")
                        or ""
                    ).strip()
                    execution_backend = {
                        "backendId": str(payload.get("backendId") or "").strip(),
                        "executionCoreId": str(payload.get("executionCoreId") or "").strip(),
                        "command": list(legacy_command or []),
                        "jsonOut": json_out,
                        "mdOut": md_out,
                    }
                    if (
                        execution_backend.get("backendId")
                        or execution_backend.get("executionCoreId")
                        or execution_backend.get("command")
                        or execution_backend.get("jsonOut")
                        or execution_backend.get("mdOut")
                    ):
                        payload["executionBackend"] = execution_backend
                        changed = True
                for stale_key in ("legacyCommand", "legacyJsonOut", "legacyMdOut"):
                    if stale_key in payload:
                        payload.pop(stale_key, None)
                        changed = True

                backend_run = (
                    payload.get("backendRun")
                    if isinstance(payload.get("backendRun"), dict)
                    else {}
                )
                if not backend_run:
                    if isinstance(payload.get("executionResult"), dict):
                        backend_run = dict(payload.get("executionResult") or {})
                    elif isinstance(payload.get("legacyRun"), dict):
                        backend_run = dict(payload.get("legacyRun") or {})
                    if backend_run:
                        payload["backendRun"] = backend_run
                        changed = True
                if "legacyRun" in payload:
                    payload.pop("legacyRun", None)
                    changed = True

                backend_export = (
                    payload.get("backendExport")
                    if isinstance(payload.get("backendExport"), dict)
                    else {}
                )
                if not backend_export:
                    if isinstance(payload.get("executionExport"), dict):
                        backend_export = dict(payload.get("executionExport") or {})
                    elif isinstance(payload.get("legacyExport"), dict):
                        backend_export = dict(payload.get("legacyExport") or {})
                    if backend_export:
                        payload["backendExport"] = backend_export
                        changed = True
                if "legacyExport" in payload:
                    payload.pop("legacyExport", None)
                    changed = True

                result_sync = (
                    payload.get("resultSync")
                    if isinstance(payload.get("resultSync"), dict)
                    else {}
                )
                if result_sync:
                    if "legacyRequestSignature" in result_sync and "matchedRequestSignature" not in result_sync:
                        result_sync["matchedRequestSignature"] = result_sync.get("legacyRequestSignature")
                        changed = True
                    if "legacyAttemptFound" in result_sync and "matchedAttemptFound" not in result_sync:
                        result_sync["matchedAttemptFound"] = result_sync.get("legacyAttemptFound")
                        changed = True
                    if "fallbackLegacyAttemptFound" in result_sync and "fallbackMatchedAttemptFound" not in result_sync:
                        result_sync["fallbackMatchedAttemptFound"] = result_sync.get("fallbackLegacyAttemptFound")
                        changed = True
                    for stale_key in (
                        "legacyRequestSignature",
                        "legacyAttemptFound",
                        "fallbackLegacyAttemptFound",
                    ):
                        if stale_key in result_sync:
                            result_sync.pop(stale_key, None)
                            changed = True
                    payload["resultSync"] = result_sync

                next_status = attempt_status
                if attempt_status == "legacy-completed":
                    next_status = "backend-completed"
                elif attempt_status == "legacy-error":
                    next_status = "backend-error"
                if next_status != attempt_status:
                    status_updates += 1
                    changed = True

                if not changed:
                    continue
                conn.execute(
                    """
                    UPDATE execution_attempts_v2
                    SET attempt_status = ?,
                        payload_json = ?,
                        updated_at = ?
                    WHERE attempt_id = ?
                    """,
                    (
                        next_status,
                        _json_dumps(payload),
                        _now_iso(),
                        attempt_id,
                    ),
                )
                normalized += 1
        return {"normalized": normalized, "statusUpdates": status_updates}

    def _derive_consumer_projections_with_conn(self, conn: sqlite3.Connection) -> dict[str, int]:
        self._apply_exact_relation_uniqueness_hygiene_with_conn(conn)
        counts = {
            "tokenShopRows": 0,
            "tokenBankControllers": 0,
            "tokenBankFormulas": 0,
            "tokenBankStates": 0,
            "shardCostRows": 0,
            "shardSaveOwners": 0,
            "genericFormulaStructures": 0,
            "genericSaveOwners": 0,
            "genericStructuralNeighborhoods": 0,
            "runtimeBridgeStructures": 0,
            "closed": 0,
        }
        def _bucket_structural_target(
            relation_kind: str,
            source_node_id: str,
            target_node_id: str,
        ) -> str:
            normalized_relation = str(relation_kind or "").strip()
            source_shape = _projection_term_shape(source_node_id)
            target_shape = _projection_term_shape(target_node_id)
            if normalized_relation == "exact-shell-to-action-hook":
                return "actionTargets"
            if normalized_relation == "exact-shell-to-prefab":
                return "prefabTargets"
            if normalized_relation == "exact-display-update-path":
                return "updaterTargets"
            if normalized_relation == "getter-family":
                return "getterTargets"
            if normalized_relation in {"returns-value-from", "getter-to-parameter-shell", "metadata-row0-parameter-shell"}:
                return "valueTargets" if target_shape != "ui-shell" else "parameterTargets"
            if normalized_relation == "binds-ui-slot":
                return "uiTargets"
            if normalized_relation == "serialized-adjacency":
                if target_shape in {"value-field", "getter", "prefab"}:
                    return "valueTargets"
                if target_shape in {"ui-shell", "button"}:
                    return "uiTargets"
                return ""
            if normalized_relation == "metadata-neighborhood":
                if source_shape == "button":
                    if target_shape in {"value-field", "getter", "prefab"}:
                        return "valueTargets"
                    if target_shape in {"ui-shell", "button"}:
                        return "uiTargets"
                return ""
            if normalized_relation == "deterministic-evaluator":
                return "updaterTargets"
            if normalized_relation == "save-owner-recovery":
                return "ownerTargets"
            if normalized_relation == "owns-method":
                if target_shape == "action":
                    return "actionTargets"
                if target_shape == "getter":
                    return "getterTargets"
                if target_shape == "updater":
                    return "updaterTargets"
                if target_shape == "owner":
                    return "ownerTargets"
                return ""
            if normalized_relation == "owns-field":
                if source_shape in {"owner", "getter", "updater"}:
                    return "valueTargets"
                return ""
            return ""
        raw_token_shop_rows = _token_shop_raw_row_records()
        for raw_row in raw_token_shop_rows:
            button_id = str(raw_row.get("button") or "").strip()
            trace_scope = str(raw_row.get("traceScope") or "").strip()
            value_fields = [
                str(value or "").strip()
                for value in (raw_row.get("valueFields") or [])
                if str(value or "").strip()
            ]
            ui_slots = [
                str(value or "").strip()
                for value in (raw_row.get("uiSlots") or [])
                if str(value or "").strip()
            ]
            family_head = str(raw_row.get("familyHead") or "").strip()
            if not button_id or not value_fields:
                continue
            updated_at = _now_iso()
            self._upsert_v2_node(
                conn,
                "graph_nodes_v2",
                node_id=button_id,
                node_kind="trace-graph-node",
                payload={"label": button_id, "traceScope": trace_scope},
                provenance={"source": "token-shop-values-extract", "sourceKind": "raw-owner-order"},
                updated_at=updated_at,
            )
            for field_name in value_fields:
                self._upsert_v2_node(
                    conn,
                    "graph_nodes_v2",
                    node_id=field_name,
                    node_kind="trace-graph-node",
                    payload={"label": field_name, "traceScope": trace_scope},
                    provenance={"source": "token-shop-values-extract", "sourceKind": "raw-owner-order"},
                    updated_at=updated_at,
                )
                edge_payload = {
                    "familyHead": family_head,
                    "rowButton": button_id,
                    "source": "token-shop-values-extract",
                }
                edge_id = self._upsert_v2_edge(
                    conn,
                    "graph_edges_v2",
                    source_node_id=button_id,
                    relation_kind="serialized-adjacency",
                    target_node_id=field_name,
                    field_key="",
                    edge_status="present",
                    value_semantics="raw-owner-order",
                    support_count=1,
                    contradiction_count=0,
                    payload=edge_payload,
                    provenance={"source": "token-shop-values-extract", "sourceKind": "raw-owner-order"},
                    updated_at=updated_at,
                )
                observation_id = _stable_key(["v2-raw-token-shop-observation", button_id, "serialized-adjacency", field_name])
                conn.execute(
                    """
                    INSERT OR REPLACE INTO graph_edge_observations_v2(
                        observation_id, edge_id, trace_scope, source_run_id, source_kind,
                        observation_status, confidence, payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        observation_id,
                        edge_id,
                        trace_scope,
                        "token-shop-values-extract",
                        "token-shop-values-extract",
                        "present",
                        1.0,
                        _json_dumps(edge_payload),
                        _json_dumps({"source": "token-shop-values-extract", "sourceKind": "raw-owner-order"}),
                        updated_at,
                    ),
                )
            for ui_slot in ui_slots:
                self._upsert_v2_node(
                    conn,
                    "graph_nodes_v2",
                    node_id=ui_slot,
                    node_kind="trace-graph-node",
                    payload={"label": ui_slot, "traceScope": trace_scope},
                    provenance={"source": "token-shop-values-extract", "sourceKind": "raw-owner-order"},
                    updated_at=updated_at,
                )
                edge_payload = {
                    "familyHead": family_head,
                    "rowButton": button_id,
                    "source": "token-shop-values-extract",
                }
                edge_id = self._upsert_v2_edge(
                    conn,
                    "graph_edges_v2",
                    source_node_id=button_id,
                    relation_kind="binds-ui-slot",
                    target_node_id=ui_slot,
                    field_key="",
                    edge_status="present",
                    value_semantics="raw-owner-order",
                    support_count=1,
                    contradiction_count=0,
                    payload=edge_payload,
                    provenance={"source": "token-shop-values-extract", "sourceKind": "raw-owner-order"},
                    updated_at=updated_at,
                )
                observation_id = _stable_key(["v2-raw-token-shop-observation", button_id, "binds-ui-slot", ui_slot])
                conn.execute(
                    """
                    INSERT OR REPLACE INTO graph_edge_observations_v2(
                        observation_id, edge_id, trace_scope, source_run_id, source_kind,
                        observation_status, confidence, payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        observation_id,
                        edge_id,
                        trace_scope,
                        "token-shop-values-extract",
                        "token-shop-values-extract",
                        "present",
                        1.0,
                        _json_dumps(edge_payload),
                        _json_dumps({"source": "token-shop-values-extract", "sourceKind": "raw-owner-order"}),
                        updated_at,
                    ),
                )
        action_rows = conn.execute(
            """
            SELECT source_node_id, target_node_id, updated_at
            FROM graph_edges_v2
            WHERE relation_kind = 'exact-shell-to-action-hook'
              AND edge_status = 'present'
              AND source_node_id GLOB 'ATU*Button'
            ORDER BY updated_at DESC
            """
        ).fetchall()
        token_shop_runtime_recovery_by_button: dict[str, dict[str, Any]] = {}
        token_shop_runtime_recovery_templates: list[dict[str, Any]] = []
        token_shop_runtime_formula_fragments_by_button: dict[str, dict[str, Any]] = {}
        runtime_dataset_rows = conn.execute(
            """
            SELECT trace_scope, payload_json, created_at
            FROM native_value_fragments_v2
            WHERE value_kind = 'trace-backend-dataset'
            ORDER BY created_at DESC
            """
        ).fetchall()
        for runtime_row in runtime_dataset_rows:
            dataset_payload = _json_loads(runtime_row["payload_json"], {})
            trace_knowledge = dict(dataset_payload.get("traceKnowledge") or {})
            row_recovery = dict(trace_knowledge.get("rowRecovery") or {})
            shell_field = str(row_recovery.get("shellField") or "").strip()
            if not shell_field or not re.fullmatch(r"ATU\d+Button", shell_field):
                continue
            normalized_runtime_scope = _normalize_runtime_trace_scope(
                str(runtime_row["trace_scope"] or "").strip(),
                dataset_payload,
            )
            if shell_field in token_shop_runtime_recovery_by_button:
                continue
            runtime_projection = _token_shop_runtime_projection_from_row_recovery(row_recovery)
            recovery_entry = {
                "traceScope": normalized_runtime_scope,
                "rowRecovery": row_recovery,
                "runtimeProjection": runtime_projection,
            }
            token_shop_runtime_recovery_by_button[shell_field] = recovery_entry
            if _token_shop_runtime_instance_layer_recovered(runtime_projection):
                token_shop_runtime_recovery_templates.append(recovery_entry)
        semantic_formula_rows = conn.execute(
            """
            SELECT payload_json, created_at
            FROM semantic_fragments_v2
            WHERE fragment_kind = 'runtime_display_formula_fragment'
            ORDER BY created_at DESC
            """
        ).fetchall()
        for semantic_row in semantic_formula_rows:
            fragment_payload = _json_loads(semantic_row["payload_json"], {})
            shell_field = str(fragment_payload.get("shellField") or "").strip()
            if not shell_field or shell_field in token_shop_runtime_formula_fragments_by_button:
                continue
            token_shop_runtime_formula_fragments_by_button[shell_field] = fragment_payload
        derived_ids: set[str] = set()
        for row in action_rows:
            button_id = str(row["source_node_id"] or "").strip()
            action_id = str(row["target_node_id"] or "").strip()
            if not button_id or not action_id or not re.fullmatch(r"ATU\d+Button", button_id):
                continue
            projection_id = _stable_key(["consumer-projection-v2", "token-shop-row-structure", button_id])
            derived_ids.add(projection_id)
            scope_row = conn.execute(
                """
                SELECT trace_scope
                FROM graph_edge_observations_v2
                WHERE edge_id = (
                    SELECT edge_id
                    FROM graph_edges_v2
                    WHERE source_node_id = ?
                      AND relation_kind = 'exact-shell-to-action-hook'
                      AND target_node_id = ?
                    LIMIT 1
                )
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (button_id, action_id),
            ).fetchone()
            trace_scope = str(scope_row["trace_scope"] or "").strip() if scope_row else ""
            prefab_rows = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'exact-shell-to-prefab'
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                """,
                (button_id,),
            ).fetchall()
            updater_rows = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'exact-display-update-path'
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                """,
                (action_id,),
            ).fetchall()
            slot_rows = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'binds-ui-slot'
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                """,
                (button_id,),
            ).fetchall()
            prefab_candidates = [
                str(item["target_node_id"] or "").strip()
                for item in prefab_rows
                if str(item["target_node_id"] or "").strip()
            ]
            updater_candidates = [
                str(item["target_node_id"] or "").strip()
                for item in updater_rows
                if str(item["target_node_id"] or "").strip()
            ]
            ui_slot_candidates = [
                str(item["target_node_id"] or "").strip()
                for item in slot_rows
                if str(item["target_node_id"] or "").strip()
            ]
            value_rows = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'serialized-adjacency'
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                """,
                (button_id,),
            ).fetchall()
            row_value_fields = [
                str(item["target_node_id"] or "").strip()
                for item in value_rows
                if str(item["target_node_id"] or "").strip()
            ]
            resolved_prefab = prefab_candidates[0] if len(set(prefab_candidates)) == 1 else ""
            resolved_updater = updater_candidates[0] if len(set(updater_candidates)) == 1 else ""
            resolved_ui_slot = ui_slot_candidates[0] if len(set(ui_slot_candidates)) == 1 else ""
            runtime_recovery_entry = token_shop_runtime_recovery_by_button.get(button_id) or {}
            runtime_projection = _normalize_token_shop_runtime_projection(runtime_recovery_entry.get("runtimeProjection") or {})
            runtime_projection = _merge_runtime_display_formula_fragment(
                runtime_projection,
                token_shop_runtime_formula_fragments_by_button.get(button_id) or {},
            )
            if not _token_shop_runtime_instance_layer_recovered(runtime_projection):
                for template_entry in token_shop_runtime_recovery_templates:
                    runtime_projection = _merge_token_shop_runtime_projection_template(
                        runtime_projection,
                        _normalize_token_shop_runtime_projection(template_entry.get("runtimeProjection") or {}),
                    )
            runtime_projection = _merge_grounded_token_shop_runtime_projection(
                runtime_projection,
                row_value_fields=row_value_fields,
                ui_slots=ui_slot_candidates,
            )
            runtime_targets = _token_shop_runtime_projection_terms(runtime_projection)
            runtime_trace_scope = str(runtime_recovery_entry.get("traceScope") or "").strip()
            runtime_scope_atu_match = re.search(r"\batu(\d+)\b", runtime_trace_scope, re.IGNORECASE)
            button_atu_match = re.search(r"\bATU(\d+)Button\b", button_id, re.IGNORECASE)
            if runtime_scope_atu_match and button_atu_match and runtime_scope_atu_match.group(1) != button_atu_match.group(1):
                runtime_trace_scope = ""
            payload = {
                "rowButton": button_id,
                "actionHook": action_id,
                "prefabs": prefab_candidates,
                "displayUpdaters": updater_candidates,
                "uiSlots": ui_slot_candidates,
                "resolvedPrefab": resolved_prefab,
                "resolvedDisplayUpdater": resolved_updater,
                "resolvedUiSlot": resolved_ui_slot,
                "prefabResolutionStatus": "resolved" if resolved_prefab else ("ambiguous" if prefab_candidates else "missing"),
                "displayUpdaterResolutionStatus": "resolved" if resolved_updater else ("ambiguous" if updater_candidates else "missing"),
                "uiSlotResolutionStatus": "resolved" if resolved_ui_slot else ("ambiguous" if ui_slot_candidates else "missing"),
                "rowValueFields": row_value_fields,
                "runtimeProjection": runtime_projection,
                "runtimeTraceScope": runtime_trace_scope or None,
            }
            payload.update(runtime_targets)
            payload["projectionCompleteness"] = (
                "structured"
                if action_id and (resolved_prefab or resolved_updater or resolved_ui_slot)
                else "partial"
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "token-shop-row-structure",
                    button_id,
                    trace_scope,
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "graph_edges_v2",
                            "actionRelation": "exact-shell-to-action-hook",
                            "projectionVersion": V2_REDUCER_VERSION,
                        }
                    ),
                    str(row["updated_at"] or _now_iso()),
                ),
            )
            counts["tokenShopRows"] += 1
        row_shell_rows = conn.execute(
            """
            SELECT source_node_id, MAX(updated_at) AS updated_at
            FROM graph_edges_v2
            WHERE edge_status = 'present'
              AND source_node_id GLOB 'ATU*Button'
              AND relation_kind IN ('serialized-adjacency', 'binds-ui-slot', 'exact-shell-to-action-hook')
            GROUP BY source_node_id
            ORDER BY MAX(updated_at) DESC
            """
        ).fetchall()
        for row in row_shell_rows:
            button_id = str(row["source_node_id"] or "").strip()
            if not button_id or not re.fullmatch(r"ATU\d+Button", button_id):
                continue
            projection_id = _stable_key(["consumer-projection-v2", "token-shop-row-structure", button_id])
            derived_ids.add(projection_id)
            exact_action_row = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'exact-shell-to-action-hook'
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (button_id,),
            ).fetchone()
            action_id = str(exact_action_row["target_node_id"] or "").strip() if exact_action_row else ""
            scope_row = conn.execute(
                """
                SELECT trace_scope
                FROM graph_edge_observations_v2
                WHERE edge_id IN (
                    SELECT edge_id
                    FROM graph_edges_v2
                    WHERE source_node_id = ?
                      AND edge_status = 'present'
                      AND relation_kind IN ('exact-shell-to-action-hook', 'serialized-adjacency', 'binds-ui-slot')
                )
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (button_id,),
            ).fetchone()
            trace_scope = str(scope_row["trace_scope"] or "").strip() if scope_row else ""
            slot_rows = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'binds-ui-slot'
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                """,
                (button_id,),
            ).fetchall()
            value_rows = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'serialized-adjacency'
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                """,
                (button_id,),
            ).fetchall()
            ui_slot_candidates = [
                str(item["target_node_id"] or "").strip()
                for item in slot_rows
                if str(item["target_node_id"] or "").strip()
            ]
            row_value_fields = [
                str(item["target_node_id"] or "").strip()
                for item in value_rows
                if str(item["target_node_id"] or "").strip()
            ]
            resolved_ui_slot = ui_slot_candidates[0] if len(set(ui_slot_candidates)) == 1 else ""
            runtime_recovery_entry = token_shop_runtime_recovery_by_button.get(button_id) or {}
            runtime_projection = _normalize_token_shop_runtime_projection(runtime_recovery_entry.get("runtimeProjection") or {})
            runtime_projection = _merge_runtime_display_formula_fragment(
                runtime_projection,
                token_shop_runtime_formula_fragments_by_button.get(button_id) or {},
            )
            if not _token_shop_runtime_instance_layer_recovered(runtime_projection):
                for template_entry in token_shop_runtime_recovery_templates:
                    runtime_projection = _merge_token_shop_runtime_projection_template(
                        runtime_projection,
                        _normalize_token_shop_runtime_projection(template_entry.get("runtimeProjection") or {}),
                    )
            runtime_projection = _merge_grounded_token_shop_runtime_projection(
                runtime_projection,
                row_value_fields=row_value_fields,
                ui_slots=ui_slot_candidates,
            )
            runtime_targets = _token_shop_runtime_projection_terms(runtime_projection)
            runtime_trace_scope = str(runtime_recovery_entry.get("traceScope") or "").strip()
            runtime_scope_atu_match = re.search(r"\batu(\d+)\b", runtime_trace_scope, re.IGNORECASE)
            button_atu_match = re.search(r"\bATU(\d+)Button\b", button_id, re.IGNORECASE)
            if runtime_scope_atu_match and button_atu_match and runtime_scope_atu_match.group(1) != button_atu_match.group(1):
                runtime_trace_scope = ""
            payload = {
                "rowButton": button_id,
                "actionHook": action_id,
                "prefabs": [],
                "displayUpdaters": [],
                "uiSlots": ui_slot_candidates,
                "resolvedPrefab": "",
                "resolvedDisplayUpdater": "",
                "resolvedUiSlot": resolved_ui_slot,
                "prefabResolutionStatus": "missing",
                "displayUpdaterResolutionStatus": "missing",
                "uiSlotResolutionStatus": "resolved" if resolved_ui_slot else ("ambiguous" if ui_slot_candidates else "missing"),
                "rowValueFields": row_value_fields,
                "runtimeProjection": runtime_projection,
                "runtimeTraceScope": runtime_trace_scope or None,
            }
            payload.update(runtime_targets)
            payload["projectionCompleteness"] = (
                "structured"
                if row_value_fields and resolved_ui_slot
                else "partial"
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "token-shop-row-structure",
                    button_id,
                    trace_scope,
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "graph_edges_v2",
                            "projectionVersion": V2_REDUCER_VERSION,
                            "rowStructureMode": "shell-adjacency-fallback",
                        }
                    ),
                    str(row["updated_at"] or _now_iso()),
                ),
            )

        structural_relation_rows = conn.execute(
            """
            SELECT e.edge_id, e.source_node_id, e.relation_kind, e.target_node_id, e.updated_at
            FROM graph_edges_v2 e
            WHERE e.edge_status = 'present'
              AND e.relation_kind IN (
                    'exact-shell-to-action-hook',
                    'exact-shell-to-prefab',
                    'exact-display-update-path',
                    'getter-family',
                    'returns-value-from',
                    'binds-ui-slot',
                    'serialized-adjacency',
                    'metadata-neighborhood',
                    'getter-to-parameter-shell',
                    'metadata-row0-parameter-shell',
                    'deterministic-evaluator',
                    'save-owner-recovery',
                    'owns-method',
                    'owns-field'
              )
            ORDER BY e.updated_at DESC
            """
        ).fetchall()
        structural_groups: dict[str, dict[str, Any]] = {}
        for row in structural_relation_rows:
            edge_id = str(row["edge_id"] or "").strip()
            source_node_id = str(row["source_node_id"] or "").strip()
            relation_kind = str(row["relation_kind"] or "").strip()
            target_node_id = str(row["target_node_id"] or "").strip()
            if not _looks_like_actionable_anchor_term(source_node_id) or not _looks_like_actionable_anchor_term(target_node_id):
                continue
            source_shape = _projection_term_shape(source_node_id)
            if source_shape not in {"button", "action", "owner", "getter", "updater"}:
                continue
            bucket = _bucket_structural_target(relation_kind, source_node_id, target_node_id)
            if not bucket:
                continue
            group = structural_groups.setdefault(
                source_node_id,
                {
                    "sourceShape": source_shape,
                    "updatedAt": str(row["updated_at"] or _now_iso()),
                    "scopes": {},
                    "relationKinds": set(),
                    "relationCounts": {},
                    "targets": {
                        "actionTargets": set(),
                        "getterTargets": set(),
                        "updaterTargets": set(),
                        "prefabTargets": set(),
                        "valueTargets": set(),
                        "uiTargets": set(),
                        "ownerTargets": set(),
                        "parameterTargets": set(),
                    },
                },
            )
            group["updatedAt"] = max(str(group["updatedAt"] or ""), str(row["updated_at"] or _now_iso()))
            group["relationKinds"].add(relation_kind)
            group["relationCounts"][relation_kind] = int(group["relationCounts"].get(relation_kind, 0)) + 1
            target_set = group["targets"].get(bucket)
            if isinstance(target_set, set):
                target_set.add(target_node_id)
            preferred_scope = self._resolve_preferred_scope_for_edge(conn, edge_id, {}, {}) if edge_id else ""
            if preferred_scope:
                group["scopes"][preferred_scope] = int(group["scopes"].get(preferred_scope, 0)) + 1
        for source_node_id, group in structural_groups.items():
            targets = group["targets"]
            total_targets = sum(len(values) for values in targets.values() if isinstance(values, set))
            non_empty_buckets = sum(1 for values in targets.values() if isinstance(values, set) and values)
            if total_targets < 2:
                continue
            preferred_trace_scope = ""
            if group["scopes"]:
                preferred_trace_scope = sorted(
                    group["scopes"].items(),
                    key=lambda item: (-int(item[1]), -_scope_specificity_score(item[0]), item[0]),
                )[0][0]
            source_shape = str(group["sourceShape"] or "").strip()
            projection_id = _stable_key(["consumer-projection-v2", "structural-neighborhood-structure", source_node_id])
            derived_ids.add(projection_id)
            payload: dict[str, Any] = {
                "sourceAnchor": source_node_id,
                "sourceShape": source_shape,
                "traceScopes": sorted(str(scope or "").strip() for scope in group["scopes"].keys() if str(scope or "").strip()),
                "relationKinds": sorted(str(value or "").strip() for value in group["relationKinds"] if str(value or "").strip()),
                "relationCounts": {str(key): int(value) for key, value in sorted(group["relationCounts"].items())},
            }
            if source_shape == "action":
                payload["actionHook"] = source_node_id
            elif source_shape == "button":
                payload["rowButton"] = source_node_id
            else:
                payload["ownerAnchor"] = source_node_id
            if source_shape == "button" and not targets["actionTargets"]:
                row_terms_for_actions = list(targets["valueTargets"]) + list(targets["uiTargets"])
                inferred_actions = self._infer_button_action_candidates_with_conn(
                    conn,
                    preferred_trace_scope,
                    source_node_id,
                    row_terms_for_actions,
                    limit=4,
                )
                for action_term in inferred_actions:
                    targets["actionTargets"].add(action_term)
            for bucket_name, values in targets.items():
                normalized_values = sorted(str(value or "").strip() for value in values if str(value or "").strip())
                if normalized_values:
                    payload[bucket_name] = normalized_values
            payload["projectionCompleteness"] = (
                "structured"
                if non_empty_buckets >= 2 and (
                    ("actionTargets" in payload and "valueTargets" in payload)
                    or ("actionTargets" in payload and "uiTargets" in payload)
                    or ("actionTargets" in payload and "getterTargets" in payload)
                    or ("prefabTargets" in payload and "updaterTargets" in payload)
                    or ("getterTargets" in payload and "valueTargets" in payload)
                    or ("updaterTargets" in payload and "valueTargets" in payload)
                )
                else "partial"
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "structural-neighborhood-structure",
                    source_node_id,
                    preferred_trace_scope,
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "graph_edges_v2",
                            "projectionVersion": V2_REDUCER_VERSION,
                            "autoDerived": True,
                            "derivationKind": "strong-graph-structure-bundle",
                        }
                    ),
                    str(group["updatedAt"] or _now_iso()),
                ),
            )
            counts["genericStructuralNeighborhoods"] += 1

        token_bank_cap_rows = conn.execute(
            """
            SELECT edge_id, source_node_id, target_node_id, payload_json, provenance_json, updated_at
            FROM graph_edges_v2
            WHERE relation_kind = 'owns-method'
              AND edge_status = 'present'
              AND target_node_id = 'get_TokenBankCap'
            ORDER BY updated_at DESC
            """
        ).fetchall()
        row_projection_rows = conn.execute(
            """
            SELECT subject_id, trace_scope, payload_json, updated_at
            FROM consumer_projections_v2
            WHERE projection_kind = 'token-shop-row-structure'
              AND projection_status = 'active'
            ORDER BY updated_at DESC
            """
        ).fetchall()
        row_projection_payloads: list[dict[str, Any]] = []
        for row in row_projection_rows:
            payload = _json_loads(str(row["payload_json"] or ""), {})
            if not isinstance(payload, dict):
                payload = {}
            row_projection_payloads.append(
                {
                    "subjectId": str(row["subject_id"] or "").strip(),
                    "traceScope": str(row["trace_scope"] or "").strip(),
                    "updatedAt": str(row["updated_at"] or "").strip(),
                    "payload": payload,
                }
            )

        for row_projection in row_projection_payloads:
            payload = dict(row_projection.get("payload") or {})
            runtime_projection = _normalize_token_shop_runtime_projection(payload.get("runtimeProjection") or {})
            trace_scope = (
                str(payload.get("runtimeTraceScope") or "").strip()
                or str(row_projection.get("traceScope") or "").strip()
            )
            row_button = str(payload.get("rowButton") or "").strip()
            action_hook = str(payload.get("actionHook") or "").strip()
            resolved_updater = str(payload.get("resolvedDisplayUpdater") or "").strip()
            if not trace_scope or _scope_looks_opaque(trace_scope) or not row_button or not runtime_projection:
                continue
            runtime_targets = _token_shop_runtime_projection_terms(runtime_projection)
            runtime_display_formula = dict(runtime_projection.get("displayFormula") or {})
            runtime_formula_model_recovered = (
                str(runtime_display_formula.get("status") or "").strip() == "unresolved-runtime-modifiers"
                and runtime_projection.get("baseMaxLevel") is not None
                and bool(str(runtime_projection.get("nextCostAccessor") or "").strip())
            )
            bridge_anchors = [
                row_button,
                action_hook,
                resolved_updater,
                str(runtime_projection.get("instanceOwner") or "").strip(),
                str(runtime_projection.get("creationMethod") or "").strip(),
                str(runtime_projection.get("selectionKey") or "").strip(),
            ]
            row_value_fields = [
                str(value).strip()
                for value in (payload.get("rowValueFields") or [])
                if str(value).strip()
            ]
            ui_slots = [
                str(value).strip()
                for value in (payload.get("uiSlots") or [])
                if str(value).strip()
            ]
            runtime_slot_targets = [
                str(value).strip()
                for value in (runtime_projection.get("runtimeSlotTargets") or [])
                if str(value).strip()
            ]
            updater_targets = [
                str(value).strip()
                for value in (runtime_targets.get("updaterTargets") or [])
                if str(value).strip()
            ]
            getter_targets = [
                str(value).strip()
                for value in (runtime_targets.get("getterTargets") or [])
                if str(value).strip()
            ]
            owner_targets = [
                str(value).strip()
                for value in (runtime_targets.get("ownerTargets") or [])
                if str(value).strip()
            ]
            parameter_targets = [
                str(value).strip()
                for value in (runtime_targets.get("parameterTargets") or [])
                if str(value).strip()
            ]
            canonical_terms = [
                str(value).strip()
                for value in (runtime_projection.get("canonicalInstanceLaneTerms") or [])
                if str(value).strip()
            ]
            if runtime_formula_model_recovered:
                bridge_targets = list(
                    dict.fromkeys(
                        [
                            *runtime_slot_targets,
                            *[
                                value
                                for value in ui_slots
                                if value in {"CostBox", "CostText", "LevelText", "TokenDescText_TMPro", "TokenUPGTitleText_TMPro"}
                            ],
                        ]
                    )
                )
            else:
                bridge_targets = list(
                    dict.fromkeys(
                        [
                            *runtime_slot_targets,
                            *updater_targets,
                            *canonical_terms,
                            *getter_targets,
                            *parameter_targets,
                            *[
                                str(value).strip()
                                for value in (runtime_targets.get("instanceTargets") or [])
                                if str(value).strip()
                            ],
                        ]
                    )
                )
            excluded_targets = {
                value
                for value in [
                    row_button,
                    action_hook,
                    resolved_updater,
                    *bridge_anchors,
                    *row_value_fields,
                    *ui_slots,
                ]
                if str(value).strip()
            }
            bridge_targets = [
                term
                for term in bridge_targets
                if term and term not in excluded_targets
            ][:24]
            if not bridge_targets:
                continue
            preferred_updater = next(
                (
                    value
                    for value in updater_targets
                    if value in {"SetCostRelatedAttributes", "CalculateAndSetUpgradeCalculations", "BuyAndApplyUpgrade"}
                ),
                updater_targets[0] if updater_targets else "",
            )
            source_anchor = preferred_updater or resolved_updater or action_hook or row_button
            owner_anchor = (
                str(runtime_projection.get("instanceOwner") or "").strip()
                or resolved_updater
                or action_hook
                or row_button
            )
            bridge_anchor_terms = [term for term in [*bridge_anchors, *updater_targets, *owner_targets] if term]
            if runtime_formula_model_recovered:
                requested_terms = list(
                    dict.fromkeys(
                        [
                            *bridge_anchor_terms,
                            *row_value_fields,
                            *ui_slots,
                            *bridge_targets,
                        ]
                    )
                )[:24]
            else:
                requested_terms = list(
                    dict.fromkeys(
                        [
                            *bridge_anchor_terms,
                            *row_value_fields,
                            *ui_slots,
                            *getter_targets,
                            *parameter_targets,
                            *bridge_targets,
                        ]
                    )
                )[:32]
            runtime_bridge_payload = {
                "sourceAnchor": source_anchor,
                "ownerAnchor": owner_anchor,
                "rowButton": row_button,
                "actionHook": action_hook,
                "runtimeProjection": runtime_projection,
                "rowValueFields": row_value_fields,
                "uiSlots": ui_slots,
                "updaterTargets": updater_targets,
                "getterTargets": getter_targets,
                "ownerTargets": owner_targets,
                "parameterTargets": parameter_targets,
                "bridgeAnchors": bridge_anchor_terms,
                "requestedTerms": requested_terms,
                "bridgeTargets": bridge_targets,
                "traceScopes": [trace_scope],
                "sourceShape": _projection_term_shape(source_anchor),
                "projectionCompleteness": "structured" if resolved_updater and runtime_slot_targets else "partial",
            }
            runtime_bridge_projection_id = _stable_key(
                ["consumer-projection-v2", "runtime-bridge-structure", trace_scope, row_button, "row-runtime"]
            )
            derived_ids.add(runtime_bridge_projection_id)
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    runtime_bridge_projection_id,
                    "runtime-bridge-structure",
                    source_anchor,
                    trace_scope,
                    "active",
                    _json_dumps(runtime_bridge_payload),
                    _json_dumps(
                        {
                            "source": "consumer_projections_v2",
                            "projectionVersion": V2_REDUCER_VERSION,
                            "baseKind": "token-shop-row-runtime-projection",
                            "rowProjectionKind": "token-shop-row-structure",
                        }
                    ),
                    str(row_projection.get("updatedAt") or _now_iso()),
                ),
            )
            counts["runtimeBridgeStructures"] += 1

        def _any_scope_term(scopes: list[str], term: str) -> bool:
            normalized_term = str(term or "").strip()
            if not normalized_term:
                return False
            like_value = f"%{normalized_term}%"
            if scopes:
                scope_placeholders = ",".join("?" for _ in scopes)
                params: list[Any] = [*scopes, like_value]
                for table_name in (
                    "semantic_fragments_v2",
                    "native_value_fragments_v2",
                    "managed_graph_fragments_v2",
                ):
                    row_match = conn.execute(
                        f"""
                        SELECT 1
                        FROM {table_name}
                        WHERE trace_scope IN ({scope_placeholders})
                          AND payload_json LIKE ?
                        LIMIT 1
                        """,
                        tuple(params),
                    ).fetchone()
                    if row_match:
                        return True
            for table_name in (
                "semantic_fragments_v2",
                "native_value_fragments_v2",
                "managed_graph_fragments_v2",
            ):
                row_match = conn.execute(
                    f"""
                    SELECT 1
                    FROM {table_name}
                    WHERE payload_json LIKE ?
                    LIMIT 1
                    """,
                    (like_value,),
                ).fetchone()
                if row_match:
                    return True
            return False

        def _formula_context_has_save_terms(scopes: list[str], formula_terms: list[str], save_terms: list[str]) -> bool:
            normalized_formula_terms = [str(term or "").strip() for term in formula_terms if str(term or "").strip()]
            normalized_save_terms = [str(term or "").strip() for term in save_terms if str(term or "").strip()]
            if not normalized_formula_terms or not normalized_save_terms:
                return False
            tables = ("semantic_fragments_v2", "native_value_fragments_v2", "managed_graph_fragments_v2")
            for table_name in tables:
                if scopes:
                    scope_placeholders = ",".join("?" for _ in scopes)
                    rows = conn.execute(
                        f"""
                        SELECT payload_json
                        FROM {table_name}
                        WHERE trace_scope IN ({scope_placeholders})
                        """,
                        tuple(scopes),
                    ).fetchall()
                else:
                    rows = conn.execute(
                        f"""
                        SELECT payload_json
                        FROM {table_name}
                        """
                    ).fetchall()
                for row in rows:
                    payload_text = str(row["payload_json"] or "")
                    if not any(term in payload_text for term in normalized_formula_terms):
                        continue
                    if any(term in payload_text for term in normalized_save_terms):
                        return True
            return False

        for row in token_bank_cap_rows:
            edge_id = str(row["edge_id"] or "").strip()
            owner_id = str(row["source_node_id"] or "").strip()
            cap_method = str(row["target_node_id"] or "").strip()
            if not owner_id or not cap_method:
                continue
            edge_payload = _json_loads(row["payload_json"], {})
            edge_provenance = _json_loads(row["provenance_json"], {})
            supporting_rows: list[dict[str, Any]] = []
            for projection in row_projection_payloads:
                display_updaters = projection["payload"].get("displayUpdaters")
                if not isinstance(display_updaters, list):
                    continue
                normalized_updaters = [str(value or "").strip() for value in display_updaters if str(value or "").strip()]
                if "SetBankFill" in normalized_updaters or "CheckTokenClaimNotification" in normalized_updaters:
                    supporting_rows.append(
                        {
                            "subjectId": projection["subjectId"],
                            "traceScope": projection["traceScope"],
                            "displayUpdaters": normalized_updaters,
                            "payload": projection["payload"],
                        }
                    )
            projection_id = _stable_key(["consumer-projection-v2", "token-bank-controller-structure", owner_id])
            derived_ids.add(projection_id)
            supporting_rows.sort(key=lambda item: item["subjectId"])
            sample_action_hooks = [
                str(item["payload"].get("actionHook") or "").strip()
                for item in supporting_rows
                if str(item["payload"].get("actionHook") or "").strip()
            ]
            supporting_scopes = sorted(
                {
                    str(item["traceScope"] or "").strip()
                    for item in supporting_rows
                    if str(item["traceScope"] or "").strip()
                }
            )

            prefabs = [
                str(prefab or "").strip()
                for item in supporting_rows
                for prefab in (item["payload"].get("prefabs") if isinstance(item["payload"].get("prefabs"), list) else [])
                if str(prefab or "").strip()
            ]
            claim_method = "ClaimBankedTokens" if _any_scope_term(supporting_scopes, "ClaimBankedTokens") else ""
            fill_method = "SetBankFill" if any("SetBankFill" in item["displayUpdaters"] for item in supporting_rows) else ""
            fill_field = "BankFill" if _any_scope_term(supporting_scopes, "BankFill") else ""
            description_shell = "TokenBankDescriptionText" if _any_scope_term(supporting_scopes, "TokenBankDescriptionText") else ""
            notification_hook = (
                "CheckTokenClaimNotification"
                if any("CheckTokenClaimNotification" in item["displayUpdaters"] for item in supporting_rows)
                else ""
            )
            adjacent_terms = [cap_method]
            if _any_scope_term(supporting_scopes, "get_ClaimableBankTokens"):
                adjacent_terms.append("get_ClaimableBankTokens")
            if _any_scope_term(supporting_scopes, "IncreaseBankedTokens"):
                adjacent_terms.append("IncreaseBankedTokens")
            payload = {
                "ownerAnchor": owner_id,
                "claimMethod": claim_method,
                "capMethod": cap_method,
                "fillMethod": fill_method,
                "fillField": fill_field,
                "descriptionShell": description_shell,
                "notificationHook": notification_hook,
                "adjacentTerms": adjacent_terms,
                "sampleActionHooks": sorted(set(sample_action_hooks)),
                "supportingRowButtons": sorted(
                    {
                        str(item["subjectId"] or "").strip()
                        for item in supporting_rows
                        if str(item["subjectId"] or "").strip()
                    }
                ),
                "supportingPrefabs": sorted(set(prefabs)),
            }
            payload["projectionCompleteness"] = (
                "structured"
                if (
                    payload["claimMethod"]
                    and payload["capMethod"]
                    and payload["fillMethod"]
                    and payload["fillField"]
                    and payload["descriptionShell"]
                    and payload["notificationHook"]
                    and "get_ClaimableBankTokens" in payload["adjacentTerms"]
                    and "IncreaseBankedTokens" in payload["adjacentTerms"]
                )
                else "partial"
            )
            trace_scope = next(
                (
                    str(item["traceScope"] or "").strip()
                    for item in supporting_rows
                    if str(item["traceScope"] or "").strip()
                ),
                self._resolve_preferred_scope_for_edge(conn, edge_id, edge_payload, edge_provenance) if edge_id else "",
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "token-bank-controller-structure",
                    owner_id,
                    trace_scope,
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "graph_edges_v2+consumer_projections_v2",
                            "capRelation": "owns-method",
                            "rowProjectionKind": "token-shop-row-structure",
                            "projectionVersion": V2_REDUCER_VERSION,
                        }
                    ),
                    str(row["updated_at"] or _now_iso()),
                ),
            )
            counts["tokenBankControllers"] += 1

            formula_projection_id = _stable_key(["consumer-projection-v2", "token-bank-formula-structure", owner_id])
            derived_ids.add(formula_projection_id)
            cap_accessor = "get_FinalTokenBankCap" if _any_scope_term(supporting_scopes, "get_FinalTokenBankCap") else ""
            fill_accessor = (
                "get_FinalTokenBankFillSpeed"
                if _any_scope_term(supporting_scopes, "get_FinalTokenBankFillSpeed")
                else ""
            )
            cap_field = (
                "<FinalTokenBankCap>k__BackingField"
                if _any_scope_term(supporting_scopes, "<FinalTokenBankCap>k__BackingField")
                else ""
            )
            fill_formula_field = (
                "<FinalTokenBankFillSpeed>k__BackingField"
                if _any_scope_term(supporting_scopes, "<FinalTokenBankFillSpeed>k__BackingField")
                else ""
            )
            save_overlap_clear = not (
                _any_scope_term(supporting_scopes, "SaveData")
                or _any_scope_term(supporting_scopes, "PlayerProfileData")
                or _any_scope_term(supporting_scopes, "CloudSavePlayerProfile")
            )
            formula_payload = {
                "ownerAnchor": owner_id,
                "capAccessor": cap_accessor,
                "fillAccessor": fill_accessor,
                "capField": cap_field,
                "fillField": fill_formula_field,
                "saveFamilyOverlapClear": (
                    not _formula_context_has_save_terms(
                        supporting_scopes,
                        [
                            "get_FinalTokenBankCap",
                            "get_FinalTokenBankFillSpeed",
                            "<FinalTokenBankCap>k__BackingField",
                            "<FinalTokenBankFillSpeed>k__BackingField",
                        ],
                        ["SaveData", "PlayerProfileData", "CloudSavePlayerProfile"],
                    )
                ),
                "supportingRowButtons": sorted(
                    {
                        str(item["subjectId"] or "").strip()
                        for item in supporting_rows
                        if str(item["subjectId"] or "").strip()
                    }
                ),
                "supportingScopes": supporting_scopes,
            }
            formula_payload["projectionCompleteness"] = (
                "structured"
                if (
                    formula_payload["capAccessor"]
                    and formula_payload["fillAccessor"]
                    and formula_payload["capField"]
                    and formula_payload["fillField"]
                    and formula_payload["saveFamilyOverlapClear"] is True
                )
                else "partial"
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    formula_projection_id,
                    "token-bank-formula-structure",
                    owner_id,
                    trace_scope,
                    "active",
                    _json_dumps(formula_payload),
                    _json_dumps(
                        {
                            "source": "semantic_fragments_v2+native_value_fragments_v2",
                            "formulaTerms": [
                                "get_FinalTokenBankCap",
                                "get_FinalTokenBankFillSpeed",
                                "<FinalTokenBankCap>k__BackingField",
                                "<FinalTokenBankFillSpeed>k__BackingField",
                            ],
                            "projectionVersion": V2_REDUCER_VERSION,
                        }
                    ),
                    str(row["updated_at"] or _now_iso()),
                ),
            )
            counts["tokenBankFormulas"] += 1

            state_projection_id = _stable_key(["consumer-projection-v2", "token-bank-state-structure", owner_id])
            derived_ids.add(state_projection_id)
            state_payload = {
                "ownerAnchor": owner_id,
                "claimMethod": "ClaimBankedTokens" if _any_scope_term(supporting_scopes, "ClaimBankedTokens") else "",
                "capMethod": cap_method,
                "displayShell": (
                    "BigStatisticPrefab.TokenBankCap"
                    if _any_scope_term(supporting_scopes, "BigStatisticPrefab.TokenBankCap")
                    else ""
                ),
                "loopHandler": "TextHandlerLoopMods" if _any_scope_term(supporting_scopes, "TextHandlerLoopMods") else "",
                "loopHook": "SetLM244BonusText" if _any_scope_term(supporting_scopes, "SetLM244BonusText") else "",
                "exactSaveOwnerType": "SaveData" if _any_scope_term(supporting_scopes, "SaveData") else "",
                "storedAmountField": "BankedTokens" if _any_scope_term(supporting_scopes, "BankedTokens") else "",
                "genericClaimableFieldOwner": "SaveData" if _any_scope_term(supporting_scopes, "SaveData") else "",
                "genericClaimableField": (
                    "ClaimableTokenium" if _any_scope_term(supporting_scopes, "ClaimableTokenium") else ""
                ),
                "profileBridgeOwner": (
                    "PlayerProfileHandler" if _any_scope_term(supporting_scopes, "PlayerProfileHandler") else ""
                ),
                "profileBridgeMethod": (
                    "ConvertSaveDataToProfileData"
                    if _any_scope_term(supporting_scopes, "ConvertSaveDataToProfileData")
                    else ""
                ),
                "profileBridgeReturnType": (
                    "PlayerProfileData" if _any_scope_term(supporting_scopes, "PlayerProfileData") else ""
                ),
                "profileCacheField": "saveInfoCache" if _any_scope_term(supporting_scopes, "saveInfoCache") else "",
                "cloudSaveShell": (
                    "CloudSavePlayerProfile"
                    if _any_scope_term(supporting_scopes, "CloudSavePlayerProfile")
                    else ""
                ),
                "cloudSaveInfoRoutine": (
                    "GetCurrentSaveFileInfo"
                    if _any_scope_term(supporting_scopes, "GetCurrentSaveFileInfo")
                    else ""
                ),
                "cloudSaveProfileRoutine": (
                    "GetPlayerProfileInfo"
                    if _any_scope_term(supporting_scopes, "GetPlayerProfileInfo")
                    else ""
                ),
                "cloudSaveStateMachine": (
                    "<CloudSavePlayerProfile>d__24"
                    if _any_scope_term(supporting_scopes, "<CloudSavePlayerProfile>d__24")
                    else ""
                ),
                "supportingRowButtons": sorted(
                    {
                        str(item["subjectId"] or "").strip()
                        for item in supporting_rows
                        if str(item["subjectId"] or "").strip()
                    }
                ),
                "supportingScopes": supporting_scopes,
            }
            state_payload["projectionCompleteness"] = (
                "structured"
                if (
                    state_payload["claimMethod"]
                    and state_payload["capMethod"]
                    and state_payload["displayShell"]
                    and state_payload["loopHook"]
                    and state_payload["cloudSaveShell"]
                    and state_payload["cloudSaveInfoRoutine"]
                    and state_payload["cloudSaveProfileRoutine"]
                    and state_payload["cloudSaveStateMachine"]
                )
                else "partial"
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    state_projection_id,
                    "token-bank-state-structure",
                    owner_id,
                    trace_scope,
                    "active",
                    _json_dumps(state_payload),
                    _json_dumps(
                        {
                            "source": "semantic_fragments_v2+native_value_fragments_v2+consumer_projections_v2",
                            "stateTerms": [
                                "ClaimBankedTokens",
                                "get_TokenBankCap",
                                "BigStatisticPrefab.TokenBankCap",
                                "SetLM244BonusText",
                                "SaveData",
                                "BankedTokens",
                                "ClaimableTokenium",
                                "PlayerProfileHandler",
                                "ConvertSaveDataToProfileData",
                                "PlayerProfileData",
                                "saveInfoCache",
                                "CloudSavePlayerProfile",
                            ],
                            "projectionVersion": V2_REDUCER_VERSION,
                        }
                    ),
                    str(row["updated_at"] or _now_iso()),
                ),
            )
            counts["tokenBankStates"] += 1

        generic_formula_rows = conn.execute(
            """
            SELECT source_node_id, updated_at
            FROM graph_edges_v2
            WHERE relation_kind = 'getter-family'
              AND edge_status = 'present'
            GROUP BY source_node_id
            ORDER BY MAX(updated_at) DESC
            """
        ).fetchall()
        for row in generic_formula_rows:
            owner_id = str(row["source_node_id"] or "").strip()
            if not _looks_like_actionable_anchor_term(owner_id):
                continue
            getter_rows = conn.execute(
                """
                SELECT target_node_id, updated_at
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'getter-family'
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                """,
                (owner_id,),
            ).fetchall()
            getters = [str(item["target_node_id"] or "").strip() for item in getter_rows if str(item["target_node_id"] or "").strip()]
            if not getters:
                continue
            field_candidates = [value for value in getters if not value.startswith(("get_", "Get"))]
            accessor_candidates = [value for value in getters if value.startswith(("get_", "Get"))]
            parameter_shells: list[str] = []
            evaluators: list[str] = []
            trace_scopes: set[str] = set()
            for getter_id in getters:
                parameter_rows = conn.execute(
                    """
                    SELECT target_node_id
                    FROM graph_edges_v2
                    WHERE source_node_id = ?
                      AND relation_kind IN ('getter-to-parameter-shell', 'metadata-row0-parameter-shell', 'returns-value-from')
                      AND edge_status = 'present'
                    ORDER BY updated_at DESC
                    """,
                    (getter_id,),
                ).fetchall()
                parameter_shells.extend(
                    str(item["target_node_id"] or "").strip()
                    for item in parameter_rows
                    if str(item["target_node_id"] or "").strip()
                )
                evaluator_rows = conn.execute(
                    """
                    SELECT DISTINCT target_node_id
                    FROM graph_edges_v2
                    WHERE source_node_id = ?
                      AND relation_kind = 'deterministic-evaluator'
                      AND edge_status = 'present'
                    ORDER BY target_node_id ASC
                    """,
                    (getter_id,),
                ).fetchall()
                evaluators.extend(
                    str(item["target_node_id"] or "").strip()
                    for item in evaluator_rows
                    if str(item["target_node_id"] or "").strip()
                )
                scope_rows = conn.execute(
                    """
                    SELECT DISTINCT trace_scope
                    FROM graph_edge_observations_v2
                    WHERE edge_id IN (
                        SELECT edge_id
                        FROM graph_edges_v2
                        WHERE source_node_id = ?
                          AND relation_kind = 'getter-family'
                          AND target_node_id = ?
                    )
                      AND trace_scope <> ''
                    """,
                    (owner_id, getter_id),
                ).fetchall()
                trace_scopes.update(
                    str(item["trace_scope"] or "").strip()
                    for item in scope_rows
                    if str(item["trace_scope"] or "").strip()
                )
            projection_id = _stable_key(["consumer-projection-v2", "value-formula-structure", owner_id])
            derived_ids.add(projection_id)
            trace_scope = sorted(trace_scopes)[0] if trace_scopes else ""
            payload = {
                "ownerAnchor": owner_id,
                "formulaAccessors": list(dict.fromkeys(accessor_candidates)),
                "formulaFields": list(dict.fromkeys(field_candidates + parameter_shells)),
                "deterministicEvaluators": list(dict.fromkeys(evaluators)),
                "traceScopes": sorted(trace_scopes),
            }
            payload["projectionCompleteness"] = (
                "structured"
                if payload["formulaAccessors"] and (payload["formulaFields"] or payload["deterministicEvaluators"])
                else "partial"
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "value-formula-structure",
                    owner_id,
                    trace_scope,
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "graph_edges_v2",
                            "projectionVersion": V2_REDUCER_VERSION,
                            "baseRelation": "getter-family",
                        }
                    ),
                    str(row["updated_at"] or _now_iso()),
                ),
            )
            counts["genericFormulaStructures"] += 1

        shard_rows = conn.execute(
            """
            SELECT source_node_id, target_node_id, updated_at
            FROM graph_edges_v2
            WHERE source_node_id = 'ShardUpgradeInfo'
              AND relation_kind = 'getter-family'
              AND edge_status = 'present'
              AND target_node_id GLOB 'get_SU*Cost'
            ORDER BY updated_at DESC
            """
        ).fetchall()
        for row in shard_rows:
            owner_id = str(row["source_node_id"] or "").strip()
            getter_id = str(row["target_node_id"] or "").strip()
            match = re.fullmatch(r"get_(SU\d+)Cost", getter_id)
            if not owner_id or not getter_id or not match:
                continue
            shard_id = str(match.group(1) or "").strip()
            if not shard_id:
                continue
            projection_id = _stable_key(["consumer-projection-v2", "shard-cost-structure", shard_id])
            derived_ids.add(projection_id)
            parameter_rows = conn.execute(
                """
                SELECT relation_kind, target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind IN ('getter-to-parameter-shell', 'metadata-row0-parameter-shell')
                  AND edge_status = 'present'
                ORDER BY updated_at DESC
                """,
                (getter_id,),
            ).fetchall()
            parameter_shells = [str(item["target_node_id"] or "").strip() for item in parameter_rows if str(item["target_node_id"] or "").strip()]
            evaluator_rows = conn.execute(
                """
                SELECT DISTINCT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id IN (
                    SELECT target_node_id
                    FROM graph_edges_v2
                    WHERE source_node_id = ?
                      AND relation_kind IN ('getter-to-parameter-shell', 'metadata-row0-parameter-shell')
                      AND edge_status = 'present'
                )
                  AND relation_kind = 'deterministic-evaluator'
                  AND edge_status = 'present'
                ORDER BY target_node_id ASC
                """,
                (getter_id,),
            ).fetchall()
            payload = {
                "owner": owner_id,
                "shardId": shard_id,
                "costGetter": getter_id,
                "parameterShells": parameter_shells,
                "deterministicEvaluators": [
                    str(item["target_node_id"] or "").strip()
                    for item in evaluator_rows
                    if str(item["target_node_id"] or "").strip()
                ],
            }
            payload["projectionCompleteness"] = (
                "structured"
                if payload["parameterShells"] or payload["deterministicEvaluators"]
                else "partial"
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "shard-cost-structure",
                    shard_id,
                    "shard-cost-su0-structure",
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "graph_edges_v2",
                            "getterRelation": "getter-family",
                            "projectionVersion": V2_REDUCER_VERSION,
                        }
                    ),
                    str(row["updated_at"] or _now_iso()),
                ),
            )
            counts["shardCostRows"] += 1
        shard_save_rows = conn.execute(
            """
            SELECT fragment_id, trace_scope, payload_json, created_at
            FROM native_value_fragments_v2
            WHERE trace_scope = 'shard-cost-su0-structure'
              AND value_kind = 'trace-backend-dataset'
            ORDER BY created_at DESC
            """
        ).fetchall()
        shard_save_targets: list[str] = []
        shard_save_scopes: set[str] = set()
        for row in shard_save_rows:
            payload = _json_loads(row["payload_json"], {})
            trace_knowledge = dict(payload.get("traceKnowledge") or {})
            bridge_plan = dict(trace_knowledge.get("bridgePlan") or {})
            requested_terms = [
                str(value or "").strip()
                for value in (payload.get("requestedTerms") or [])
                if str(value or "").strip()
            ]
            bridged_terms = [
                str(value or "").strip()
                for value in (bridge_plan.get("bridgedTerms") or [])
                if str(value or "").strip()
            ]
            for term in [*requested_terms, *bridged_terms]:
                if term in {"MilestoneCostList", "GetShardCostList", "UpdateShardCostList"}:
                    shard_save_targets.append(term)
            trace_scope = str(row["trace_scope"] or "").strip()
            if trace_scope:
                shard_save_scopes.add(trace_scope)
        if shard_save_targets:
            projection_id = _stable_key(
                ["consumer-projection-v2", "shard-save-owner-structure", "ShardUpgradeInfo"]
            )
            derived_ids.add(projection_id)
            unique_targets = list(dict.fromkeys(shard_save_targets))
            payload = {
                "ownerAnchor": "ShardUpgradeInfo",
                "saveAnchor": "PlayerProfileData",
                "cloudSaveAnchor": "CloudSavePlayerProfile",
                "recoveredTargets": unique_targets,
                "traceScopes": sorted(shard_save_scopes),
                "ownedStateOutcomeKind": "non-local-injection-seam",
                "ownedStatePopulationBridgeRecovered": False,
                "projectionCompleteness": "partial",
            }
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "shard-save-owner-structure",
                    "ShardUpgradeInfo",
                    "shard-cost-su0-structure",
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "native_value_fragments_v2",
                            "projectionVersion": V2_REDUCER_VERSION,
                            "recoveredTargets": unique_targets,
                        }
                    ),
                    _now_iso(),
                ),
            )
            counts["shardSaveOwners"] += 1
        runtime_dataset_rows = conn.execute(
            """
            SELECT trace_scope, payload_json, created_at
            FROM native_value_fragments_v2
            WHERE value_kind = 'trace-backend-dataset'
            ORDER BY created_at DESC
            """
        ).fetchall()
        evidence_save_owner_groups: dict[tuple[str, str], dict[str, Any]] = {}
        for row in runtime_dataset_rows:
            payload = _json_loads(row["payload_json"], {})
            normalized_trace_scope = _normalize_runtime_trace_scope(str(row["trace_scope"] or "").strip(), payload)
            trace_knowledge = dict(payload.get("traceKnowledge") or {})
            bridge_plan = dict(trace_knowledge.get("bridgePlan") or {})
            family_hint = str(bridge_plan.get("familyHint") or trace_knowledge.get("familyHint") or "").strip()
            family_scope = _normalize_runtime_trace_scope(normalized_trace_scope or family_hint, payload)
            if not family_scope or _scope_looks_opaque(family_scope):
                continue
            anchor_terms = [
                str(value or "").strip()
                for value in (
                    dict(payload.get("traceRun") or {}).get("anchorTerms")
                    or payload.get("requestedTerms")
                    or []
                )
                if _looks_like_actionable_anchor_term(str(value or "").strip())
            ]
            bridge_terms = [
                str(value or "").strip()
                for value in (bridge_plan.get("bridgedTerms") or [])
                if _looks_like_actionable_anchor_term(str(value or "").strip())
            ]
            context_terms = [
                str(value or "").strip()
                for value in (bridge_plan.get("contextTerms") or [])
                if _looks_like_actionable_anchor_term(str(value or "").strip())
            ]
            owner_candidates = sorted(
                {
                    value
                    for value in [*anchor_terms, *bridge_terms, *context_terms]
                    if _is_save_owner_anchor_candidate(value)
                },
                key=lambda item: (-_projection_anchor_rank(item), item.startswith(("get_", "Get")), item),
            )
            owner_anchor = owner_candidates[0] if owner_candidates else ""
            if not owner_anchor:
                continue
            save_anchor = ""
            cloud_anchor = ""
            recovered_targets: list[str] = []
            for term in [*anchor_terms, *bridge_terms, *context_terms]:
                if term == "SaveData":
                    save_anchor = term
                    continue
                if term in {"CloudSavePlayerProfile", "GetPlayerProfileInfo"}:
                    cloud_anchor = cloud_anchor or term
                    continue
                if _is_save_owner_recovered_target(term):
                    recovered_targets.append(term)
            recovered_targets = list(dict.fromkeys(value for value in recovered_targets if value and value != owner_anchor))
            if not recovered_targets or not (save_anchor or cloud_anchor or "save-owner" in family_scope):
                continue
            group = evidence_save_owner_groups.setdefault(
                (owner_anchor, family_scope),
                {
                    "saveAnchor": save_anchor,
                    "cloudSaveAnchor": cloud_anchor,
                    "recoveredTargets": [],
                    "traceScopes": set(),
                    "createdAt": str(row["created_at"] or _now_iso()),
                },
            )
            group["createdAt"] = max(str(group["createdAt"] or ""), str(row["created_at"] or _now_iso()))
            if save_anchor:
                group["saveAnchor"] = save_anchor
            if cloud_anchor:
                group["cloudSaveAnchor"] = cloud_anchor
            group["traceScopes"].add(family_scope)
            group["recoveredTargets"].extend(recovered_targets)
        for (owner_anchor, trace_scope), group in evidence_save_owner_groups.items():
            unique_targets = list(dict.fromkeys(str(value or "").strip() for value in group["recoveredTargets"] if str(value or "").strip()))
            if not unique_targets:
                continue
            projection_id = _stable_key(["consumer-projection-v2", "save-owner-structure", owner_anchor, trace_scope])
            derived_ids.add(projection_id)
            payload = {
                "ownerAnchor": owner_anchor,
                "saveAnchor": str(group.get("saveAnchor") or "PlayerProfileData"),
                "cloudSaveAnchor": str(group.get("cloudSaveAnchor") or "CloudSavePlayerProfile"),
                "recoveredTargets": unique_targets,
                "traceScopes": sorted(str(value or "").strip() for value in group["traceScopes"] if str(value or "").strip()),
                "ownedStateOutcomeKind": "runtime-evidence-bridge",
                "ownedStatePopulationBridgeRecovered": False,
                "projectionCompleteness": "partial",
            }
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "save-owner-structure",
                    owner_anchor,
                    trace_scope,
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "native_value_fragments_v2",
                            "projectionVersion": V2_REDUCER_VERSION,
                            "baseKind": "trace-backend-dataset",
                            "autoDerived": True,
                        }
                    ),
                    str(group["createdAt"] or _now_iso()),
                ),
            )
            counts["genericSaveOwners"] += 1
        generic_save_owner_rows = conn.execute(
            """
            SELECT e.source_node_id AS source_node_id, o.trace_scope AS trace_scope, MAX(o.created_at) AS updated_at
            FROM graph_edge_observations_v2 o
            JOIN graph_edges_v2 e
              ON e.edge_id = o.edge_id
            WHERE e.relation_kind = 'save-owner-recovery'
              AND o.trace_scope <> ''
            GROUP BY source_node_id, trace_scope
            ORDER BY MAX(o.created_at) DESC
            """
        ).fetchall()
        for row in generic_save_owner_rows:
            owner_id = str(row["source_node_id"] or "").strip()
            trace_scope = _normalize_runtime_trace_scope(str(row["trace_scope"] or "").strip(), {})
            if not _is_save_owner_anchor_candidate(owner_id) or not trace_scope:
                continue
            negative_rows = conn.execute(
                """
                SELECT target_node_id
                FROM graph_edges_v2
                WHERE source_node_id = ?
                  AND relation_kind = 'save-owner-recovery'
                ORDER BY updated_at DESC
                """,
                (owner_id,),
            ).fetchall()
            recovered_targets = [
                str(item["target_node_id"] or "").strip()
                for item in negative_rows
                if _is_save_owner_recovered_target(str(item["target_node_id"] or "").strip())
            ]
            if not recovered_targets:
                continue
            projection_id = _stable_key(["consumer-projection-v2", "save-owner-structure", owner_id, trace_scope])
            derived_ids.add(projection_id)
            payload = {
                "ownerAnchor": owner_id,
                "saveAnchor": "PlayerProfileData",
                "cloudSaveAnchor": "CloudSavePlayerProfile",
                "recoveredTargets": list(dict.fromkeys(recovered_targets)),
                "traceScopes": [trace_scope],
                "ownedStateOutcomeKind": "non-local-injection-seam",
                "ownedStatePopulationBridgeRecovered": False,
            }
            payload["projectionCompleteness"] = "partial"
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "save-owner-structure",
                    owner_id,
                    trace_scope,
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "graph_edges_v2+graph_edge_observations_v2",
                            "projectionVersion": V2_REDUCER_VERSION,
                            "baseRelation": "save-owner-recovery",
                        }
                    ),
                    str(row["updated_at"] or _now_iso()),
                ),
            )
            counts["genericSaveOwners"] += 1
        runtime_bridge_groups: dict[tuple[str, str], dict[str, Any]] = {}
        for row in runtime_dataset_rows:
            payload = _json_loads(row["payload_json"], {})
            trace_scope = _normalize_runtime_trace_scope(str(row["trace_scope"] or "").strip(), payload)
            if trace_scope.startswith("token-shop"):
                continue
            trace_run = dict(payload.get("traceRun") or {})
            trace_knowledge = dict(payload.get("traceKnowledge") or {})
            bridge_plan = dict(trace_knowledge.get("bridgePlan") or {})
            anchor_terms = [
                str(value or "").strip()
                for value in (trace_run.get("anchorTerms") or payload.get("requestedTerms") or [])
                if _looks_like_actionable_anchor_term(str(value or "").strip())
            ]
            owner_candidates = [
                *anchor_terms,
                *[
                    str(value or "").strip()
                    for value in (payload.get("requestedTerms") or [])
                    if _looks_like_actionable_anchor_term(str(value or "").strip())
                ],
                *[
                    str(value or "").strip()
                    for value in (bridge_plan.get("bridgedTerms") or [])[:12]
                    if _looks_like_actionable_anchor_term(str(value or "").strip())
                ],
            ]
            ranked_owner_candidates = sorted(
                {value for value in owner_candidates if value},
                key=lambda item: (-_projection_anchor_rank(item), item.startswith(("get_", "Get")), item),
            )
            owner_anchor = ranked_owner_candidates[0] if ranked_owner_candidates else ""
            if not trace_scope or _scope_looks_opaque(trace_scope) or not owner_anchor:
                continue
            group = runtime_bridge_groups.setdefault(
                (trace_scope, owner_anchor),
                {
                    "anchors": set(),
                    "requested": set(),
                    "bridged": set(),
                    "created_at": str(row["created_at"] or _now_iso()),
                },
            )
            group["created_at"] = max(str(group["created_at"]), str(row["created_at"] or _now_iso()))
            for value in anchor_terms:
                group["anchors"].add(value)
            for value in payload.get("requestedTerms") or []:
                term = str(value or "").strip()
                if _looks_like_actionable_anchor_term(term):
                    group["requested"].add(term)
            for value in bridge_plan.get("bridgedTerms") or []:
                term = str(value or "").strip()
                if _looks_like_actionable_anchor_term(term):
                    group["bridged"].add(term)
        for (trace_scope, owner_anchor), group in runtime_bridge_groups.items():
            projection_id = _stable_key(
                ["consumer-projection-v2", "runtime-bridge-structure", trace_scope, owner_anchor]
            )
            derived_ids.add(projection_id)
            anchor_terms = sorted(group["anchors"])
            requested_terms = sorted(group["requested"])
            bridge_targets = [
                term
                for term in sorted(group["bridged"])
                if term not in set(anchor_terms)
            ][:24]
            if not bridge_targets:
                continue
            payload = {
                "ownerAnchor": owner_anchor,
                "bridgeAnchors": anchor_terms,
                "requestedTerms": requested_terms,
                "bridgeTargets": bridge_targets,
                "traceScopes": [trace_scope],
                "projectionCompleteness": "partial",
            }
            if _projection_term_shape(owner_anchor) == "button":
                inferred_actions = self._infer_button_action_candidates_with_conn(
                    conn,
                    trace_scope,
                    owner_anchor,
                    [*anchor_terms, *bridge_targets],
                    limit=4,
                )
                if inferred_actions:
                    payload["actionTargets"] = inferred_actions
                    payload["projectionCompleteness"] = "structured"
            conn.execute(
                """
                INSERT OR REPLACE INTO consumer_projections_v2(
                    projection_id, projection_kind, subject_id, trace_scope,
                    projection_status, payload_json, provenance_json, updated_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    projection_id,
                    "runtime-bridge-structure",
                    owner_anchor,
                    trace_scope,
                    "active",
                    _json_dumps(payload),
                    _json_dumps(
                        {
                            "source": "native_value_fragments_v2",
                            "projectionVersion": V2_REDUCER_VERSION,
                            "baseKind": "trace-backend-dataset",
                        }
                    ),
                    str(group["created_at"] or _now_iso()),
                ),
            )
            counts["runtimeBridgeStructures"] += 1
        runtime_button_rows = conn.execute(
            """
            SELECT projection_id, trace_scope, subject_id, payload_json, provenance_json, updated_at
            FROM consumer_projections_v2
            WHERE projection_kind = 'runtime-bridge-structure'
              AND projection_status = 'active'
            """
        ).fetchall()
        for row in runtime_button_rows:
            subject_id = str(row["subject_id"] or "").strip()
            if _projection_term_shape(subject_id) != "button":
                continue
            payload = _json_loads(row["payload_json"], {})
            if not isinstance(payload, dict):
                continue
            trace_scope = str(row["trace_scope"] or "").strip()
            inferred_actions = self._infer_button_action_candidates_with_conn(
                conn,
                trace_scope,
                subject_id,
                [
                    *[str(value or "").strip() for value in (payload.get("bridgeAnchors") or [])],
                    *[str(value or "").strip() for value in (payload.get("bridgeTargets") or [])],
                ],
                limit=4,
            )
            if not inferred_actions:
                continue
            payload["actionTargets"] = inferred_actions
            payload["projectionCompleteness"] = "structured"
            conn.execute(
                """
                UPDATE consumer_projections_v2
                SET payload_json = ?,
                    updated_at = ?
                WHERE projection_id = ?
                """,
                (
                    _json_dumps(payload),
                    str(row["updated_at"] or _now_iso()),
                    str(row["projection_id"] or "").strip(),
                ),
            )
        for stale_row in conn.execute(
            """
            SELECT projection_id
            FROM consumer_projections_v2
            WHERE projection_kind IN (
                'token-shop-row-structure',
                'token-bank-controller-structure',
                'token-bank-formula-structure',
                'token-bank-state-structure',
                'shard-cost-structure',
                'shard-save-owner-structure',
                'value-formula-structure',
                'save-owner-structure',
                'runtime-bridge-structure',
                'structural-neighborhood-structure'
            )
              AND projection_status = 'active'
            """
        ).fetchall():
            projection_id = str(stale_row["projection_id"] or "").strip()
            if projection_id and projection_id not in derived_ids:
                conn.execute(
                    """
                    UPDATE consumer_projections_v2
                    SET projection_status = 'closed',
                        updated_at = ?
                    WHERE projection_id = ?
                    """,
                    (_now_iso(), projection_id),
                )
                counts["closed"] += 1
        return counts

    def derive_consumer_projections(self) -> dict[str, int]:
        self.ensure_schema()
        with self.connect() as conn:
            return self._derive_consumer_projections_with_conn(conn)

    def list_consumer_projections(self, projection_kind: str = "", limit: int = 20) -> list[dict[str, Any]]:
        self.ensure_schema()
        params: list[Any] = []
        sql = """
            SELECT projection_id, projection_kind, subject_id, trace_scope,
                   projection_status, payload_json, provenance_json, updated_at
            FROM consumer_projections_v2
            WHERE projection_status = 'active'
        """
        if projection_kind:
            sql += " AND projection_kind = ?"
            params.append(str(projection_kind))
        sql += " ORDER BY updated_at DESC LIMIT ?"
        params.append(int(limit))
        with self.connect() as conn:
            rows = conn.execute(sql, tuple(params)).fetchall()
        results: list[dict[str, Any]] = []
        for row in rows:
            results.append(
                {
                    "projectionId": str(row["projection_id"] or "").strip(),
                    "projectionKind": str(row["projection_kind"] or "").strip(),
                    "subjectId": str(row["subject_id"] or "").strip(),
                    "traceScope": str(row["trace_scope"] or "").strip(),
                    "projectionStatus": str(row["projection_status"] or "").strip(),
                    "payload": _json_loads(row["payload_json"], {}),
                    "provenance": _json_loads(row["provenance_json"], {}),
                    "updatedAt": str(row["updated_at"] or "").strip(),
                }
            )
        return results

    def record_pair_check(
        self,
        *,
        trace_scope: str,
        relation_kind: str,
        source_node_id: str,
        target_node_id: str,
        check_status: str,
        request_signature: str = "",
        graph_context_digest: str = "",
        reopen_fingerprint: str = "",
        payload: dict[str, Any] | None = None,
        provenance: dict[str, Any] | None = None,
    ) -> str:
        self.ensure_schema()
        check_id = _stable_key(["v2-pair-check", trace_scope, relation_kind, source_node_id, target_node_id])
        updated_at = _now_iso()
        with self.connect() as conn:
            self._record_pair_check_with_conn(
                conn,
                trace_scope=trace_scope,
                relation_kind=relation_kind,
                source_node_id=source_node_id,
                target_node_id=target_node_id,
                check_status=check_status,
                request_signature=request_signature,
                graph_context_digest=graph_context_digest,
                reopen_fingerprint=reopen_fingerprint,
                payload=payload or {},
                provenance=provenance or {},
                updated_at=updated_at,
            )
        return check_id

    def record_path_check(
        self,
        *,
        trace_scope: str,
        relation_kind: str,
        path_fingerprint: str,
        check_status: str,
        request_signature: str = "",
        graph_context_digest: str = "",
        reopen_fingerprint: str = "",
        payload: dict[str, Any] | None = None,
        provenance: dict[str, Any] | None = None,
    ) -> str:
        self.ensure_schema()
        check_id = _stable_key(["v2-path-check", trace_scope, relation_kind, path_fingerprint])
        updated_at = _now_iso()
        with self.connect() as conn:
            self._record_path_check_with_conn(
                conn,
                trace_scope=trace_scope,
                relation_kind=relation_kind,
                path_fingerprint=path_fingerprint,
                check_status=check_status,
                request_signature=request_signature,
                graph_context_digest=graph_context_digest,
                reopen_fingerprint=reopen_fingerprint,
                payload=payload or {},
                provenance=provenance or {},
                updated_at=updated_at,
            )
        return check_id

    def _record_pair_check_with_conn(
        self,
        conn: sqlite3.Connection,
        *,
        trace_scope: str,
        relation_kind: str,
        source_node_id: str,
        target_node_id: str,
        check_status: str,
        request_signature: str,
        graph_context_digest: str,
        reopen_fingerprint: str,
        payload: dict[str, Any],
        provenance: dict[str, Any],
        updated_at: str,
    ) -> str:
        check_id = _stable_key(["v2-pair-check", trace_scope, relation_kind, source_node_id, target_node_id])
        existing = conn.execute(
            """
            SELECT checked_count
            FROM graph_pair_checks_v2
            WHERE trace_scope = ?
              AND relation_kind = ?
              AND source_node_id = ?
              AND target_node_id = ?
            """,
            (trace_scope, relation_kind, source_node_id, target_node_id),
        ).fetchone()
        checked_count = int((existing or {"checked_count": 0})["checked_count"] or 0)
        if check_status.startswith("checked"):
            checked_count += 1
        conn.execute(
            """
            INSERT OR REPLACE INTO graph_pair_checks_v2(
                check_id, trace_scope, relation_kind, source_node_id, target_node_id,
                check_status, checked_count, last_request_signature, graph_context_digest,
                reopen_fingerprint, payload_json, provenance_json, updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                check_id,
                trace_scope,
                relation_kind,
                source_node_id,
                target_node_id,
                check_status,
                checked_count,
                request_signature,
                graph_context_digest,
                reopen_fingerprint,
                _json_dumps(payload),
                _json_dumps(provenance),
                updated_at,
            ),
        )
        return check_id

    def _record_path_check_with_conn(
        self,
        conn: sqlite3.Connection,
        *,
        trace_scope: str,
        relation_kind: str,
        path_fingerprint: str,
        check_status: str,
        request_signature: str,
        graph_context_digest: str,
        reopen_fingerprint: str,
        payload: dict[str, Any],
        provenance: dict[str, Any],
        updated_at: str,
    ) -> str:
        check_id = _stable_key(["v2-path-check", trace_scope, relation_kind, path_fingerprint])
        existing = conn.execute(
            """
            SELECT checked_count
            FROM graph_path_checks_v2
            WHERE trace_scope = ?
              AND relation_kind = ?
              AND path_fingerprint = ?
            """,
            (trace_scope, relation_kind, path_fingerprint),
        ).fetchone()
        checked_count = int((existing or {"checked_count": 0})["checked_count"] or 0)
        if check_status.startswith("checked"):
            checked_count += 1
        conn.execute(
            """
            INSERT OR REPLACE INTO graph_path_checks_v2(
                check_id, trace_scope, relation_kind, path_fingerprint,
                check_status, checked_count, last_request_signature, graph_context_digest,
                reopen_fingerprint, payload_json, provenance_json, updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                check_id,
                trace_scope,
                relation_kind,
                path_fingerprint,
                check_status,
                checked_count,
                request_signature,
                graph_context_digest,
                reopen_fingerprint,
                _json_dumps(payload),
                _json_dumps(provenance),
                updated_at,
            ),
        )
        return check_id

    def _classify_v1_trace_fragment(self, fragment_kind: str, payload: dict[str, Any]) -> tuple[str, str, str, str] | tuple[None, None, None, None]:
        normalized = fragment_kind.strip()
        if normalized in {"traceGraph", "rowRecovery", "traceRegistry", "traceWorkflow", "plannerResolution"}:
            return ("managed_graph_fragments_v2", "graph_kind", "graph_key", normalized)
        if normalized in {"ui_binding_fragment"}:
            return ("ui_binding_fragments_v2", "binding_kind", "binding_key", normalized)
        if normalized in {
            "dependency_fragment",
            "execution_plan_fragment",
            "execution_context_fragment",
            "assessment_fragment",
            "surface_plan_fragment",
            "semantic_scope_fragment",
            "reconstruction_note_fragment",
            "bridge_policy_fragment",
            "family_graph_fragment",
            "graph_plan_fragment",
        }:
            return ("semantic_fragments_v2", "fragment_kind", "fragment_key", normalized)
        if normalized in {"owner_controller_fragment", "formula_fragment", "threshold_fragment", "progression_fragment"}:
            return ("static_symbol_fragments_v2", "symbol_kind", "symbol_key", normalized)
        if normalized in {"nativeTrace", "nativeReconstruction", "native_acquisition_gap_fragment", "runtime_table_fragment"}:
            return ("native_value_fragments_v2", "value_kind", "value_key", normalized)
        if normalized in {"surfaces", "sourceRoles", "sources", "shellWindow", "target", "executionAnchors", "searchExpansion", "depthSearch"}:
            return ("semantic_fragments_v2", "fragment_kind", "fragment_key", normalized)
        return (None, None, None, None)

    def _classify_v1_semantic_fragment(self, fragment_kind: str, payload: dict[str, Any]) -> tuple[str, str, str, str] | tuple[None, None, None, None]:
        normalized = fragment_kind.strip()
        if normalized in {"graph_plan_fragment", "family_graph_fragment"}:
            return ("managed_graph_fragments_v2", "graph_kind", "graph_key", normalized)
        if normalized in {"ui_binding_fragment"}:
            return ("ui_binding_fragments_v2", "binding_kind", "binding_key", normalized)
        if normalized in {"owner_controller_fragment", "formula_fragment", "threshold_fragment", "progression_fragment"}:
            return ("static_symbol_fragments_v2", "symbol_kind", "symbol_key", normalized)
        if normalized in {"runtime_table_fragment"}:
            return ("native_value_fragments_v2", "value_kind", "value_key", normalized)
        if normalized:
            return ("semantic_fragments_v2", "fragment_kind", "fragment_key", normalized)
        return (None, None, None, None)

    def _infer_scope_from_v2_payload(self, fallback: str, payload: dict[str, Any], provenance: dict[str, Any]) -> str:
        for key in ("trace_scope", "traceScope", "targetId", "scopeId"):
            value = str(payload.get(key) or provenance.get(key) or "").strip()
            if value:
                normalized = _normalize_runtime_trace_scope(value, payload)
                if normalized:
                    return normalized
        for key in ("supportTraceScopes", "contributingTraceScopes", "supportGraphScopes"):
            scopes = payload.get(key) if isinstance(payload, dict) else None
            if isinstance(scopes, list):
                for scope in scopes:
                    value = str(scope or "").strip()
                    if value:
                        normalized = _normalize_runtime_trace_scope(value, payload)
                        if normalized:
                            return normalized
            scopes = provenance.get(key) if isinstance(provenance, dict) else None
            if isinstance(scopes, list):
                for scope in scopes:
                    value = str(scope or "").strip()
                    if value:
                        normalized = _normalize_runtime_trace_scope(value, payload)
                        if normalized:
                            return normalized
        support = payload.get("support") if isinstance(payload, dict) else None
        if isinstance(support, dict):
            scopes = support.get("contributingTraceScopes")
            if isinstance(scopes, list):
                for scope in scopes:
                    value = str(scope or "").strip()
                    if value:
                        normalized = _normalize_runtime_trace_scope(value, payload)
                        if normalized:
                            return normalized
        if isinstance(provenance, dict):
            scopes = provenance.get("contributingTraceScopes")
            if isinstance(scopes, list):
                for scope in scopes:
                    value = str(scope or "").strip()
                    if value:
                        normalized = _normalize_runtime_trace_scope(value, payload)
                        if normalized:
                            return normalized
        return _normalize_runtime_trace_scope(str(fallback or "").strip(), payload)

    def _resolve_preferred_scope_for_edge(
        self,
        conn: sqlite3.Connection,
        edge_id: str,
        payload: dict[str, Any],
        provenance: dict[str, Any],
    ) -> str:
        observation_rows = conn.execute(
            """
            SELECT trace_scope, COUNT(*) AS observation_count, MAX(created_at) AS latest_seen
            FROM graph_edge_observations_v2
            WHERE edge_id = ?
              AND trace_scope <> ''
            GROUP BY trace_scope
            """,
            (edge_id,),
        ).fetchall()
        if observation_rows:
            ranked_scopes = sorted(
                (
                    (
                        str(row["trace_scope"] or "").strip(),
                        int(row["observation_count"] or 0),
                        str(row["latest_seen"] or ""),
                    )
                    for row in observation_rows
                    if str(row["trace_scope"] or "").strip()
                ),
                key=lambda item: (
                    -item[1],
                    -_scope_specificity_score(item[0]),
                    item[2],
                ),
            )
            if ranked_scopes:
                return ranked_scopes[0][0]
        preferred_trace_scope = self._infer_scope_from_v2_payload("", payload, provenance)
        if preferred_trace_scope:
            return preferred_trace_scope
        support_row = conn.execute(
            """
            SELECT trace_scope
            FROM graph_edge_support_v2
            WHERE edge_id = ?
              AND trace_scope <> ''
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (edge_id,),
        ).fetchone()
        if support_row:
            value = str(support_row["trace_scope"] or "").strip()
            if value:
                return value
        return edge_id

    def _upsert_obligation(
        self,
        conn: sqlite3.Connection,
        *,
        obligation_id: str,
        obligation_kind: str,
        relation_kind: str,
        source_node_id: str,
        target_node_id: str,
        preferred_trace_scope: str,
        priority: float,
        support_count: int,
        graph_context_digest: str,
        payload: dict[str, Any],
        provenance: dict[str, Any],
        updated_at: str,
    ) -> bool:
        existing_row = conn.execute(
            """
            SELECT created_at, priority, support_count, obligation_status
            FROM graph_obligations_v2
            WHERE obligation_id = ?
            """,
            (obligation_id,),
        ).fetchone()
        if existing_row:
            existing_priority = float(existing_row["priority"] or 0.0)
            existing_support_count = int(existing_row["support_count"] or 0)
            existing_status = str(existing_row["obligation_status"] or "").strip()
            if existing_status == "open":
                if existing_priority > float(priority):
                    return False
                if existing_priority == float(priority) and existing_support_count > int(support_count):
                    return False
        created_at = str((existing_row or {"created_at": updated_at})["created_at"] or updated_at)
        conn.execute(
            """
            INSERT OR REPLACE INTO graph_obligations_v2(
                obligation_id, obligation_kind, relation_kind, source_node_id, target_node_id,
                preferred_trace_scope, obligation_status, priority, support_count,
                last_graph_context_digest, payload_json, provenance_json, created_at, updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                obligation_id,
                obligation_kind,
                relation_kind,
                source_node_id,
                target_node_id,
                preferred_trace_scope,
                "open",
                float(priority),
                int(support_count),
                graph_context_digest,
                _json_dumps(payload),
                _json_dumps(provenance),
                created_at,
                updated_at,
            ),
        )
        return True

    def _upsert_obligation_support(
        self,
        conn: sqlite3.Connection,
        *,
        obligation_id: str,
        support_kind: str,
        support_ref: str,
        payload: dict[str, Any],
        provenance: dict[str, Any],
        created_at: str,
    ) -> None:
        support_id = _stable_key(["v2-obligation-support", obligation_id, support_kind, support_ref])
        conn.execute(
            """
            INSERT OR REPLACE INTO graph_obligation_support_v2(
                support_id, obligation_id, support_kind, support_ref,
                payload_json, provenance_json, created_at
            ) VALUES(?,?,?,?,?,?,?)
            """,
            (
                support_id,
                obligation_id,
                support_kind,
                support_ref,
                _json_dumps(payload),
                _json_dumps(provenance),
                created_at,
            ),
        )

    def _upsert_v2_node(
        self,
        conn: sqlite3.Connection,
        table_name: str,
        *,
        node_id: str,
        node_kind: str,
        payload: dict[str, Any],
        provenance: dict[str, Any],
        updated_at: str,
    ) -> None:
        if table_name == "structure_ir_nodes_v2":
            conn.execute(
                """
                INSERT OR REPLACE INTO structure_ir_nodes_v2(
                    node_id, node_kind, canonical_label, normalized_key,
                    first_seen_at, updated_at, payload_json, provenance_json
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    node_id,
                    node_kind,
                    node_id,
                    node_id.lower(),
                    updated_at,
                    updated_at,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                ),
            )
            return
        conn.execute(
            """
            INSERT OR REPLACE INTO graph_nodes_v2(
                node_id, node_kind, canonical_label, normalized_key,
                node_status, payload_json, provenance_json, updated_at
            ) VALUES(?,?,?,?,?,?,?,?)
            """,
            (
                node_id,
                node_kind,
                node_id,
                node_id.lower(),
                "active",
                _json_dumps(payload),
                _json_dumps(provenance),
                updated_at,
            ),
        )

    def _upsert_v2_edge(
        self,
        conn: sqlite3.Connection,
        table_name: str,
        *,
        source_node_id: str,
        relation_kind: str,
        target_node_id: str,
        field_key: str,
        edge_status: str,
        value_semantics: str,
        support_count: int,
        contradiction_count: int,
        payload: dict[str, Any],
        provenance: dict[str, Any],
        updated_at: str,
    ) -> str:
        edge_id = _stable_key(["v2-edge", source_node_id, relation_kind, target_node_id, field_key])
        if table_name == "structure_ir_edges_v2":
            conn.execute(
                """
                INSERT OR REPLACE INTO structure_ir_edges_v2(
                    edge_id, source_node_id, edge_kind, target_node_id, field_key,
                    edge_status, value_semantics, support_count, contradiction_count,
                    first_seen_at, updated_at, payload_json, provenance_json
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    edge_id,
                    source_node_id,
                    relation_kind,
                    target_node_id,
                    field_key,
                    edge_status,
                    value_semantics,
                    support_count,
                    contradiction_count,
                    updated_at,
                    updated_at,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                ),
            )
        else:
            conn.execute(
                """
                INSERT OR REPLACE INTO graph_edges_v2(
                    edge_id, source_node_id, relation_kind, target_node_id, field_key,
                    edge_status, value_semantics, support_count, contradiction_count,
                    first_seen_at, updated_at, payload_json, provenance_json
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    edge_id,
                    source_node_id,
                    relation_kind,
                    target_node_id,
                    field_key,
                    edge_status,
                    value_semantics,
                    support_count,
                    contradiction_count,
                    updated_at,
                    updated_at,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                ),
            )
        return edge_id

    def _import_export_trace_graph_with_conn(
        self,
        conn: sqlite3.Connection,
        *,
        attempt_id: str,
        trace_scope: str,
        request_signature: str,
        exported_dataset: dict[str, Any],
        dataset_source: str = "trace-backend-dataset",
    ) -> dict[str, int]:
        trace_graph = dict(exported_dataset.get("traceGraph") or {})
        nodes = list(trace_graph.get("nodes") or [])
        edges = list(trace_graph.get("edges") or [])
        negative_edges = list(trace_graph.get("negativeEdges") or [])
        if not nodes and not edges and not negative_edges:
            return {"irObservationCount": 0, "graphObservationCount": 0}
        created_at = str(dict(exported_dataset.get("traceRun") or {}).get("materializedAt") or _now_iso())
        node_labels = {
            str(node.get("id") or "").strip(): str(node.get("label") or "").strip()
            for node in nodes
            if str(node.get("id") or "").strip()
        }
        imported_ir = 0
        imported_graph = 0
        strengthened_graph = 0
        for node in nodes:
            node_id = str(node.get("id") or "").strip()
            if not node_id:
                continue
            self._upsert_v2_node(
                conn,
                "structure_ir_nodes_v2",
                node_id=node_id,
                node_kind="trace-graph-node",
                payload={"label": str(node.get("label") or "").strip(), "traceScope": trace_scope},
                provenance={"source": dataset_source, "sourceKind": "traceGraph.node"},
                updated_at=created_at,
            )
            self._upsert_v2_node(
                conn,
                "graph_nodes_v2",
                node_id=node_id,
                node_kind="trace-graph-node",
                payload={"label": str(node.get("label") or "").strip(), "traceScope": trace_scope},
                provenance={"source": dataset_source, "sourceKind": "traceGraph.node"},
                updated_at=created_at,
            )
        for edge in [*edges, *negative_edges]:
            source_id = str(edge.get("from") or "").strip()
            target_id = str(edge.get("to") or "").strip()
            relation_kind = str(edge.get("type") or "").strip()
            edge_status = str(edge.get("status") or "").strip() or "candidate"
            promotable_relation = _is_promotable_graph_relation(relation_kind)
            if not source_id or not target_id or not relation_kind:
                continue
            for node_id in (source_id, target_id):
                self._upsert_v2_node(
                    conn,
                    "structure_ir_nodes_v2",
                    node_id=node_id,
                    node_kind="trace-graph-node",
                    payload={"label": node_labels.get(node_id, node_id), "traceScope": trace_scope},
                    provenance={"source": dataset_source, "sourceKind": "traceGraph.node"},
                    updated_at=created_at,
                )
                self._upsert_v2_node(
                    conn,
                    "graph_nodes_v2",
                    node_id=node_id,
                    node_kind="trace-graph-node",
                    payload={"label": node_labels.get(node_id, node_id), "traceScope": trace_scope},
                    provenance={"source": dataset_source, "sourceKind": "traceGraph.node"},
                    updated_at=created_at,
                )
            common_payload = {
                "statement": str(edge.get("statement") or "").strip(),
                "provedBy": list(edge.get("provedBy") or []),
                "provenanceStrength": str(edge.get("provenanceStrength") or "").strip(),
            }
            ir_edge_id = self._upsert_v2_edge(
                conn,
                "structure_ir_edges_v2",
                source_node_id=source_id,
                relation_kind=relation_kind,
                target_node_id=target_id,
                field_key="",
                edge_status=edge_status,
                value_semantics="trace-graph",
                support_count=1 if edge_status == "present" else 0,
                contradiction_count=1 if edge_status in {"missing", "negative"} else 0,
                payload=common_payload,
                provenance={"source": dataset_source, "sourceKind": "traceGraph.edge"},
                updated_at=created_at,
            )
            previous_graph_row = conn.execute(
                """
                SELECT support_count, contradiction_count, edge_status
                FROM graph_edges_v2
                WHERE edge_id = ?
                """,
                (_stable_key(["v2-edge", source_id, relation_kind, target_id, ""]),),
            ).fetchone()
            graph_observation_id = _stable_key(
                [
                    "v2-graph-export-observation",
                    attempt_id,
                    _stable_key(["v2-edge", source_id, relation_kind, target_id, ""]),
                    trace_scope,
                    edge_status,
                    created_at,
                ]
            )
            existed_graph_observation = conn.execute(
                "SELECT 1 FROM graph_edge_observations_v2 WHERE observation_id = ?",
                (graph_observation_id,),
            ).fetchone()
            previous_support_count = int(previous_graph_row["support_count"] or 0) if previous_graph_row else 0
            previous_contradiction_count = int(previous_graph_row["contradiction_count"] or 0) if previous_graph_row else 0
            previous_edge_status = str(previous_graph_row["edge_status"] or "").strip() if previous_graph_row else ""
            next_support_count = previous_support_count + (
                1 if edge_status == "present" and not existed_graph_observation else 0
            )
            next_contradiction_count = previous_contradiction_count + (
                1 if edge_status in {"missing", "negative"} and not existed_graph_observation else 0
            )
            next_edge_status = previous_edge_status
            if edge_status == "present" and promotable_relation:
                next_edge_status = "present"
            elif not next_edge_status:
                next_edge_status = "candidate" if edge_status == "present" else edge_status
            graph_edge_id = self._upsert_v2_edge(
                conn,
                "graph_edges_v2",
                source_node_id=source_id,
                relation_kind=relation_kind,
                target_node_id=target_id,
                field_key="",
                edge_status=next_edge_status,
                value_semantics="trace-graph",
                support_count=next_support_count,
                contradiction_count=next_contradiction_count,
                payload=common_payload,
                provenance={"source": dataset_source, "sourceKind": "traceGraph.edge"},
                updated_at=created_at,
            )
            ir_observation_id = _stable_key(
                [
                    "v2-ir-observation",
                    attempt_id,
                    ir_edge_id,
                    trace_scope,
                    edge_status,
                    created_at,
                ]
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO structure_ir_observations_v2(
                    observation_id, edge_id, source_run_id, source_kind, trace_scope,
                    observation_status, confidence, payload_json, provenance_json, created_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    ir_observation_id,
                    ir_edge_id,
                    attempt_id,
                    dataset_source,
                    trace_scope,
                    edge_status,
                    1.0 if edge_status == "present" else 0.5,
                    _json_dumps(common_payload),
                    _json_dumps({"source": "unity_trace_bundle_v2", "sourceKind": dataset_source}),
                    created_at,
                ),
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO graph_edge_observations_v2(
                    observation_id, edge_id, trace_scope, source_run_id, source_kind,
                    observation_status, confidence, payload_json, provenance_json, created_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    graph_observation_id,
                    graph_edge_id,
                    trace_scope,
                    request_signature or attempt_id,
                    dataset_source,
                    edge_status,
                    1.0 if edge_status == "present" else 0.5,
                    _json_dumps(common_payload),
                    _json_dumps({"source": "unity_trace_bundle_v2", "sourceKind": dataset_source}),
                    created_at,
                ),
            )
            if (
                edge_status == "present"
                and promotable_relation
                and next_edge_status == "present"
                and previous_edge_status != "present"
            ):
                strengthened_graph += 1
            support_id = _stable_key(["v2-export-support", graph_edge_id, trace_scope, request_signature or created_at])
            conn.execute(
                """
                INSERT OR REPLACE INTO graph_edge_support_v2(
                    support_id, edge_id, support_kind, support_value, trace_scope,
                    payload_json, provenance_json, created_at
                ) VALUES(?,?,?,?,?,?,?,?)
                """,
                (
                    support_id,
                    graph_edge_id,
                    "trace-export",
                    request_signature or "export",
                    trace_scope,
                    _json_dumps({"edgeStatus": edge_status, "relationKind": relation_kind}),
                    _json_dumps({"source": "unity_trace_bundle_v2", "sourceKind": dataset_source}),
                    created_at,
                ),
            )
            imported_ir += 1
            imported_graph += 1
        return {
            "irObservationCount": imported_ir,
            "graphObservationCount": imported_graph,
            "strengthenedGraphCount": strengthened_graph,
        }

    def list_open_obligations(self, limit: int = 20) -> list[dict[str, Any]]:
        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT obligation_id, obligation_kind, relation_kind, source_node_id, target_node_id,
                       preferred_trace_scope, obligation_status, priority, support_count,
                       payload_json, provenance_json, created_at, updated_at
                FROM graph_obligations_v2
                WHERE obligation_status = 'open'
                ORDER BY
                    priority DESC,
                    support_count DESC,
                    CASE obligation_kind
                        WHEN 'continue-runtime-display-formula' THEN 0
                        WHEN 'continue-evidence-path' THEN 1
                        WHEN 'continue-projection-bundle' THEN 2
                        WHEN 'continue-projection-path' THEN 3
                        WHEN 'continue-bridge-path' THEN 4
                        WHEN 'continue-path' THEN 5
                        WHEN 'verify-negative-edge' THEN 6
                        ELSE 7
                    END,
                    updated_at DESC
                LIMIT ?
                """,
                (int(limit),),
            ).fetchall()
        return [
            {
                "obligationId": str(row["obligation_id"] or ""),
                "obligationKind": str(row["obligation_kind"] or ""),
                "relationKind": str(row["relation_kind"] or ""),
                "sourceNodeId": str(row["source_node_id"] or ""),
                "targetNodeId": str(row["target_node_id"] or ""),
                "preferredTraceScope": str(row["preferred_trace_scope"] or ""),
                "obligationStatus": str(row["obligation_status"] or ""),
                "priority": float(row["priority"] or 0),
                "supportCount": int(row["support_count"] or 0),
                "payload": _json_loads(row["payload_json"], {}),
                "provenance": _json_loads(row["provenance_json"], {}),
                "createdAt": str(row["created_at"] or ""),
                "updatedAt": str(row["updated_at"] or ""),
            }
            for row in rows
        ]

    def record_nonclosing_obligation(self, obligation_id: str, request_signature: str = "") -> dict[str, Any]:
        self.ensure_schema()
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT obligation_id, obligation_kind, relation_kind, source_node_id, target_node_id,
                       preferred_trace_scope, last_graph_context_digest, payload_json, provenance_json
                FROM graph_obligations_v2
                WHERE obligation_id = ?
                """,
                (obligation_id,),
            ).fetchone()
            if not row:
                return {"recorded": False, "reason": "not-found", "obligationId": obligation_id}
            payload = _json_loads(row["payload_json"], {})
            provenance = _json_loads(row["provenance_json"], {})
            trace_scope = str(row["preferred_trace_scope"] or "").strip()
            relation_kind = str(row["relation_kind"] or "").strip()
            source_node_id = str(row["source_node_id"] or "").strip()
            target_node_id = str(row["target_node_id"] or "").strip()
            graph_context_digest = str(row["last_graph_context_digest"] or "").strip()
            pair_check_id = self.record_pair_check(
                trace_scope=trace_scope,
                relation_kind=relation_kind,
                source_node_id=source_node_id,
                target_node_id=target_node_id,
                check_status="checked-nonclosing",
                request_signature=request_signature,
                graph_context_digest=graph_context_digest,
                payload={
                    "obligationId": obligation_id,
                    "obligationKind": str(row["obligation_kind"] or "").strip(),
                    "knownPair": payload.get("knownPair") or [source_node_id, target_node_id],
                },
                provenance={"source": "graph_obligations_v2", **provenance},
            )
            path_check_id = ""
            path_fingerprint = str(payload.get("pathFingerprint") or "").strip()
            if path_fingerprint:
                path_check_id = self.record_path_check(
                    trace_scope=trace_scope,
                    relation_kind=relation_kind,
                    path_fingerprint=path_fingerprint,
                    check_status="checked-nonclosing",
                    request_signature=request_signature,
                    graph_context_digest=graph_context_digest,
                    payload={
                        "obligationId": obligation_id,
                        "bridgePath": payload.get("bridgePath") or [],
                        "bridgeKind": payload.get("bridgeKind") or "",
                    },
                    provenance={"source": "graph_obligations_v2", **provenance},
                )
            return {
                "recorded": True,
                "obligationId": obligation_id,
                "pairCheckId": pair_check_id,
                "pathCheckId": path_check_id,
                "traceScope": trace_scope,
                "relationKind": relation_kind,
                "sourceNodeId": source_node_id,
                "targetNodeId": target_node_id,
            }

    def select_best_obligation(self) -> dict[str, Any]:
        obligations = self.list_open_obligations(limit=1)
        return dict(obligations[0]) if obligations else {}

    def build_execution_request_for_obligation(self, obligation_id: str) -> dict[str, Any]:
        self.ensure_schema()
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT obligation_id, obligation_kind, relation_kind, source_node_id, target_node_id,
                       preferred_trace_scope, last_graph_context_digest, payload_json, provenance_json
                FROM graph_obligations_v2
                WHERE obligation_id = ?
                """,
                (obligation_id,),
            ).fetchone()
            if not row:
                return {}
            payload = _json_loads(row["payload_json"], {})
            provenance = _json_loads(row["provenance_json"], {})
            bridge_path = [str(value).strip() for value in (payload.get("bridgePath") or []) if str(value).strip()]
            candidate_term = str(payload.get("candidateTerm") or "").strip()
            source_node_id = str(row["source_node_id"] or "").strip()
            target_node_id = str(row["target_node_id"] or "").strip()
            projection_id = str(payload.get("projectionId") or "").strip()
            support_kind = str(payload.get("supportKind") or "").strip()
            projection_payload = {}
            if projection_id:
                projection_row = conn.execute(
                    """
                    SELECT payload_json
                    FROM consumer_projections_v2
                    WHERE projection_id = ?
                    """,
                    (projection_id,),
                ).fetchone()
                if projection_row:
                    projection_payload = _json_loads(projection_row["payload_json"], {})
            sibling_candidate_terms: list[str] = [
                str(value).strip()
                for value in (payload.get("batchedCandidateTerms") or [])
                if str(value).strip()
            ]
            if (
                not sibling_candidate_terms
                and str(row["obligation_kind"] or "").strip() in {"continue-projection-path", "continue-projection-bundle", "continue-runtime-display-formula"}
                and projection_id
                and support_kind
                and source_node_id
            ):
                sibling_rows = conn.execute(
                    """
                    SELECT target_node_id, priority
                    FROM graph_obligations_v2
                    WHERE obligation_status = 'open'
                      AND obligation_kind IN ('continue-projection-path', 'continue-projection-bundle', 'continue-runtime-display-formula')
                      AND preferred_trace_scope = ?
                      AND source_node_id = ?
                      AND json_extract(payload_json, '$.projectionId') = ?
                      AND json_extract(payload_json, '$.supportKind') = ?
                    ORDER BY
                        CASE WHEN target_node_id = ? THEN 0 ELSE 1 END,
                        priority DESC,
                        support_count DESC,
                        updated_at DESC
                    LIMIT 8
                    """,
                    (
                        str(row["preferred_trace_scope"] or "").strip(),
                        source_node_id,
                        projection_id,
                        support_kind,
                        target_node_id,
                    ),
                ).fetchall()
                sibling_candidate_terms = list(
                    dict.fromkeys(
                        str(item["target_node_id"] or "").strip()
                        for item in sibling_rows
                        if str(item["target_node_id"] or "").strip()
                    )
                )
                if target_node_id and target_node_id not in sibling_candidate_terms:
                    sibling_candidate_terms.insert(0, target_node_id)
            selected_anchors: list[str]
            if len(bridge_path) >= 2:
                selected_anchors = list(dict.fromkeys(bridge_path[:2]))
            else:
                selected_anchors = [value for value in (source_node_id, target_node_id) if value]
            batch_terms = sibling_candidate_terms or ([candidate_term] if candidate_term else [])
            if support_kind == "runtimeDisplayFormula":
                display_slot_terms = [
                    str(value).strip()
                    for value in (payload.get("displaySlots") or [])
                    if str(value).strip()
                ]
                batch_terms = list(
                    dict.fromkeys(
                        value
                        for value in [candidate_term, *display_slot_terms, *batch_terms]
                        if value and not _is_runtime_semantic_symbolic_target(value)
                    )
                )
            requested_terms = list(dict.fromkeys([*bridge_path, *batch_terms]))
            if (
                str(payload.get("projectionKind") or "").strip() == "token-shop-row-structure"
                and support_kind in {"getterTargets", "updaterTargets", "instanceTargets", "ownerTargets", "parameterTargets", "runtimeSlotTargets"}
            ):
                runtime_projection = _normalize_token_shop_runtime_projection(projection_payload.get("runtimeProjection") or {})
                runtime_seed_terms = _token_shop_runtime_seed_terms(runtime_projection, support_kind)
                if runtime_seed_terms:
                    selected_anchors = list(dict.fromkeys([*selected_anchors, *runtime_seed_terms[:6]]))
                    requested_terms = list(dict.fromkeys([*requested_terms, *runtime_seed_terms]))
            if (
                str(payload.get("projectionKind") or "").strip() == "token-shop-row-structure"
                and support_kind == "runtimeDisplayFormula"
            ):
                runtime_projection = _normalize_token_shop_runtime_projection(projection_payload.get("runtimeProjection") or {})
                runtime_seed_terms = _token_shop_runtime_seed_terms(runtime_projection, "getterTargets")
                formula_candidate = str(payload.get("candidateTerm") or "").strip()
                if formula_candidate == "runtime-evaluator-instance-formula":
                    runtime_seed_terms = list(
                        dict.fromkeys(
                            [
                                *runtime_seed_terms,
                                *_token_shop_runtime_seed_terms(runtime_projection, "instanceTargets"),
                            ]
                        )
                    )
                elif formula_candidate == "runtime-cost-exponent-instance-value":
                    runtime_seed_terms = list(
                        dict.fromkeys(
                            [
                                *runtime_seed_terms,
                                "ArcadeUpgradeSO",
                                "Upgrade",
                                "currentIndex",
                                "costExponent",
                                "get_costExponent",
                                "set_costExponent",
                            ]
                        )
                    )
                elif formula_candidate == "runtime-calculation-type-instance-value":
                    runtime_seed_terms = list(
                        dict.fromkeys(
                            [
                                *runtime_seed_terms,
                                "ArcadeUpgradeSO",
                                "Upgrade",
                                "currentIndex",
                                "calculationType",
                                "calculationsType",
                                "get_calculationsType",
                                "set_calculationsType",
                            ]
                        )
                    )
                elif formula_candidate == "runtime-final-set-value-instance-value":
                    runtime_seed_terms = list(
                        dict.fromkeys(
                            [
                                *runtime_seed_terms,
                                "ArcadeUpgradeSO",
                                "Upgrade",
                                "currentIndex",
                                "finalSetValue",
                                "get_finalSetValue",
                                "set_finalSetValue",
                            ]
                        )
                    )
                elif formula_candidate == "runtime-displayed-cost-expression":
                    runtime_seed_terms = list(
                        dict.fromkeys(
                            [
                                *runtime_seed_terms,
                                "ArcadeUpgradeSO",
                                "Upgrade",
                                "currentIndex",
                                "get_cost",
                                "cost",
                                "costExponent",
                                "get_costExponent",
                                "additiveIncrease",
                                "get_additiveIncrease",
                                "CostBox",
                                "CostText",
                            ]
                        )
                    )
                elif formula_candidate == "runtime-output-preview-value":
                    runtime_seed_terms = list(
                        dict.fromkeys(
                            [
                                *runtime_seed_terms,
                                "ArcadeUpgradeSO",
                                "Upgrade",
                                "currentIndex",
                                "output",
                                "get_output",
                                "LevelText",
                                "TokenDescText_TMPro",
                            ]
                        )
                    )
                elif formula_candidate == "fast-buy-runtime-quantity":
                    runtime_seed_terms = list(
                        dict.fromkeys(
                            [
                                *runtime_seed_terms,
                                *[
                                    str(value).strip()
                                    for key in ("fastBuyTerms", "fastBuyOwners", "fastBuyFields")
                                    for value in (runtime_projection.get(key) or [])
                                    if str(value).strip()
                                ],
                            ]
                        )
                    )
                elif formula_candidate == "set-wide-cost-modifiers":
                    runtime_seed_terms = list(
                        dict.fromkeys(
                            [
                                *runtime_seed_terms,
                                *[
                                    str(value).strip()
                                    for key in ("modifierTerms", "modifierOwners", "modifierMethods", "modifierFields")
                                    for value in (runtime_projection.get(key) or [])
                                    if str(value).strip()
                                ],
                            ]
                        )
                    )
                if runtime_seed_terms:
                    selected_anchors = list(dict.fromkeys([*selected_anchors, *runtime_seed_terms[:8]]))
                    requested_terms = list(dict.fromkeys([*requested_terms, *runtime_seed_terms]))
            if (
                str(payload.get("projectionKind") or "").strip() == "runtime-bridge-structure"
                and str(row["preferred_trace_scope"] or "").strip().startswith("token-shop")
            ):
                row_context_terms = _token_shop_runtime_row_context_terms(projection_payload)
                if row_context_terms and not (
                    support_kind == "runtimeDisplayFormula"
                    and candidate_term in {
                        "runtime-displayed-cost-expression",
                        "runtime-cost-exponent-instance-value",
                        "runtime-calculation-type-instance-value",
                        "runtime-final-set-value-instance-value",
                    }
                ):
                    selected_anchors = list(dict.fromkeys([*selected_anchors, *row_context_terms[:10]]))
                    requested_terms = list(dict.fromkeys([*requested_terms, *row_context_terms]))
            if support_kind == "runtimeDisplayFormula":
                display_anchor = str(payload.get("displayAnchor") or "").strip()
                row_button = str(projection_payload.get("rowButton") or "").strip()
                selected_anchors = [
                    value
                    for value in list(dict.fromkeys([source_node_id, display_anchor, row_button, *selected_anchors]))
                    if value and value != "runtime-display-formula"
                ]
                requested_terms = [
                    value
                    for value in list(dict.fromkeys([*requested_terms, candidate_term, display_anchor, row_button]))
                    if value and not _is_runtime_semantic_symbolic_target(value)
                ]
                if candidate_term == "runtime-displayed-cost-expression":
                    focused_terms = [
                        row_button,
                        display_anchor,
                        "CostBox",
                        "CostText",
                        "SetCostRelatedAttributes",
                        "CalculateAndSetUpgradeCalculations",
                        "CreateUpgradeClass",
                        "Upgrade",
                        "currentIndex",
                        "ArcadeUpgradeSO",
                        "get_cost",
                        "get_costExponent",
                        "get_additiveIncrease",
                        "get_finalSetValue",
                        "cost",
                        "costExponent",
                        "additiveIncrease",
                        "calculationType",
                        "finalSetValue",
                    ]
                    requested_terms = [
                        value
                        for value in list(dict.fromkeys(focused_terms))
                        if value and not _is_runtime_semantic_symbolic_target(value)
                    ][:24]
                    selected_anchors = [
                        value
                        for value in list(
                            dict.fromkeys(
                                [
                                    "SetCostRelatedAttributes",
                                    display_anchor,
                                    row_button,
                                    "get_cost",
                                    "get_costExponent",
                                    "get_additiveIncrease",
                                    "get_finalSetValue",
                                    "CalculateAndSetUpgradeCalculations",
                                    "CreateUpgradeClass",
                                    "Upgrade",
                                    "currentIndex",
                                ]
                            )
                        )
                        if value and not _is_runtime_semantic_symbolic_target(value)
                    ][:10]
            requested_terms = [
                value
                for value in requested_terms
                if value and not _is_runtime_semantic_symbolic_target(value)
            ]
            selected_anchors = [
                value
                for value in selected_anchors
                if value and not _is_runtime_semantic_symbolic_target(value)
            ]
            if not requested_terms:
                requested_terms = [value for value in (source_node_id, target_node_id) if value]
            trace_scope = str(row["preferred_trace_scope"] or "").strip()
            relation_kind = str(row["relation_kind"] or "").strip()
            request_signature = _stable_key(
                [
                    "v2-exec",
                    str(row["obligation_id"] or "").strip(),
                    trace_scope,
                    relation_kind,
                    str(row["last_graph_context_digest"] or "").strip(),
                    *requested_terms,
                ]
            )[:16]
            return {
                "obligationId": str(row["obligation_id"] or "").strip(),
                "obligationKind": str(row["obligation_kind"] or "").strip(),
                "relationKind": relation_kind,
                "traceScope": trace_scope,
                "sourceNodeId": source_node_id,
                "targetNodeId": target_node_id,
                "bridgePath": bridge_path,
                "candidateTerm": candidate_term,
                "batchedCandidateTerms": batch_terms,
                "graphContextDigest": str(row["last_graph_context_digest"] or "").strip(),
                "selectedAnchors": selected_anchors,
                "requestedTerms": requested_terms,
                "requestSignature": request_signature,
                "executionRoutineId": "run-evidence-acquisition-v2",
                "traceDirective": {
                    "mode": "run-v2-obligation",
                    "obligationId": str(row["obligation_id"] or "").strip(),
                    "obligationKind": str(row["obligation_kind"] or "").strip(),
                    "relationKind": relation_kind,
                    "bridgeKind": str(payload.get("bridgeKind") or "").strip(),
                    "graphContextDigest": str(row["last_graph_context_digest"] or "").strip(),
                    "pathFingerprint": str(payload.get("pathFingerprint") or "").strip(),
                    "candidateSources": list(payload.get("candidateSources") or []),
                    "projectionId": projection_id,
                    "supportKind": support_kind,
                },
                "payload": payload,
                "provenance": provenance,
            }

    def record_execution_attempt(
        self,
        execution_request: dict[str, Any],
        *,
        attempt_status: str = "planned",
    ) -> dict[str, Any]:
        self.ensure_schema()
        obligation_id = str(execution_request.get("obligationId") or "").strip()
        trace_scope = str(execution_request.get("traceScope") or "").strip()
        relation_kind = str(execution_request.get("relationKind") or "").strip()
        source_node_id = str(execution_request.get("sourceNodeId") or "").strip()
        target_node_id = str(execution_request.get("targetNodeId") or "").strip()
        request_signature = str(execution_request.get("requestSignature") or "").strip()
        if not obligation_id or not trace_scope or not relation_kind:
            return {"recorded": False, "reason": "invalid-request"}
        now = _now_iso()
        attempt_id = _stable_key(["v2-attempt", obligation_id, request_signature or "no-signature", now])
        payload = {
            "selectedAnchors": list(execution_request.get("selectedAnchors") or []),
            "requestedTerms": list(execution_request.get("requestedTerms") or []),
            "bridgePath": list(execution_request.get("bridgePath") or []),
            "candidateTerm": str(execution_request.get("candidateTerm") or "").strip(),
            "batchedCandidateTerms": list(execution_request.get("batchedCandidateTerms") or []),
            "graphContextDigest": str(execution_request.get("graphContextDigest") or "").strip(),
            "executionRoutineId": str(execution_request.get("executionRoutineId") or "").strip(),
            "traceDirective": dict(execution_request.get("traceDirective") or {}),
        }
        provenance = {
            "source": "v2-best-gap",
            "obligationId": obligation_id,
            "obligationKind": str(execution_request.get("obligationKind") or "").strip(),
        }
        with self.connect() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO execution_attempts_v2(
                    attempt_id, trace_scope, relation_kind, obligation_id, source_node_id, target_node_id,
                    request_signature, attempt_status, payload_json, provenance_json, created_at, updated_at
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    attempt_id,
                    trace_scope,
                    relation_kind,
                    obligation_id,
                    source_node_id,
                    target_node_id,
                    request_signature,
                    attempt_status,
                    _json_dumps(payload),
                    _json_dumps(provenance),
                    now,
                    now,
                ),
            )
        return {
            "recorded": True,
            "attemptId": attempt_id,
            "attemptStatus": attempt_status,
            "requestSignature": request_signature,
            "traceScope": trace_scope,
            "relationKind": relation_kind,
        }

    def update_execution_attempt(
        self,
        attempt_id: str,
        *,
        attempt_status: str = "",
        payload_patch: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        self.ensure_schema()
        with self.connect() as conn:
            row = conn.execute(
                """
                SELECT attempt_status, payload_json
                FROM execution_attempts_v2
                WHERE attempt_id = ?
                """,
                (attempt_id,),
            ).fetchone()
            if not row:
                return {"updated": False, "reason": "attempt-not-found", "attemptId": attempt_id}
            payload = _json_loads(row["payload_json"], {})
            if payload_patch:
                payload.update(payload_patch)
            next_status = str(attempt_status or row["attempt_status"] or "").strip() or "planned"
            conn.execute(
                """
                UPDATE execution_attempts_v2
                SET attempt_status = ?,
                    payload_json = ?,
                    updated_at = ?
                WHERE attempt_id = ?
                """,
                (
                    next_status,
                    _json_dumps(payload),
                    _now_iso(),
                    attempt_id,
                ),
            )
        return {"updated": True, "attemptId": attempt_id, "attemptStatus": next_status}

    def apply_execution_result_from_dataset(
        self,
        attempt_id: str,
        request_signature: str = "",
        exported_dataset: dict[str, Any] | None = None,
        dataset_source: str = "trace-backend-dataset",
    ) -> dict[str, Any]:
        self.ensure_schema()
        with self.connect() as conn:
            attempt_row = conn.execute(
                """
                SELECT attempt_id, trace_scope, relation_kind, obligation_id, source_node_id, target_node_id,
                       request_signature, attempt_status, payload_json, provenance_json, created_at, updated_at
                FROM execution_attempts_v2
                WHERE attempt_id = ?
                """,
                (attempt_id,),
            ).fetchone()
            if not attempt_row:
                return {"applied": False, "reason": "attempt-not-found", "attemptId": attempt_id}

            payload = _json_loads(attempt_row["payload_json"], {})
            exported_dataset = dict(exported_dataset or {})
            exported_trace_run = dict(exported_dataset.get("traceRun") or {})
            exported_trace_knowledge = dict(exported_dataset.get("traceKnowledge") or {})
            exported_request_signature = str(exported_trace_run.get("requestSignature") or "").strip()
            request_signature = str(
                exported_request_signature
                or request_signature
                or attempt_row["request_signature"]
                or ""
            ).strip()
            trace_scope = str(attempt_row["trace_scope"] or "").strip()
            if exported_trace_run.get("traceScope"):
                trace_scope = str(exported_trace_run.get("traceScope") or "").strip() or trace_scope
            relation_kind = str(attempt_row["relation_kind"] or "").strip()
            obligation_id = str(attempt_row["obligation_id"] or "").strip()
            source_node_id = str(attempt_row["source_node_id"] or "").strip()
            target_node_id = str(attempt_row["target_node_id"] or "").strip()
            created_at = str(attempt_row["created_at"] or "")
            requested_terms = [str(value).strip() for value in (payload.get("requestedTerms") or []) if str(value).strip()]
            exported_requested_terms = [
                str(value).strip()
                for value in (exported_dataset.get("requestedTerms") or [])
                if str(value).strip()
            ]
            if not requested_terms and exported_requested_terms:
                requested_terms = exported_requested_terms
            bridge_path = [str(value).strip() for value in (payload.get("bridgePath") or []) if str(value).strip()]
            candidate_term = str(payload.get("candidateTerm") or "").strip()
            batched_candidate_terms = [
                str(value).strip()
                for value in (payload.get("batchedCandidateTerms") or [])
                if str(value).strip()
            ]
            if candidate_term and candidate_term not in batched_candidate_terms:
                batched_candidate_terms.insert(0, candidate_term)
            if not batched_candidate_terms and target_node_id:
                batched_candidate_terms = [target_node_id]
            projection_id = str(payload.get("traceDirective", {}).get("projectionId") or payload.get("projectionId") or "").strip()

            if exported_dataset:
                export_graph_import = self._import_export_trace_graph_with_conn(
                    conn,
                    attempt_id=attempt_id,
                    trace_scope=trace_scope,
                    request_signature=request_signature,
                    exported_dataset=exported_dataset,
                    dataset_source=dataset_source,
                )
                imported_ir_observations = int(export_graph_import.get("irObservationCount") or 0)
                imported_graph_observations = int(export_graph_import.get("graphObservationCount") or 0)
                strengthened_edges = int(export_graph_import.get("strengthenedGraphCount") or 0)
                semantic_fragment_changed = False
                export_fragment_id = _stable_key(
                    [
                        "v2-trace-export-sync",
                        attempt_id,
                        trace_scope,
                        request_signature or "no-signature",
                    ]
                )
                conn.execute(
                    """
                    INSERT OR REPLACE INTO native_value_fragments_v2(
                        fragment_id, trace_scope, value_kind, value_key,
                        payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?)
                    """,
                    (
                        export_fragment_id,
                        trace_scope,
                        dataset_source,
                        request_signature or attempt_id,
                        _json_dumps(
                            {
                                "traceRun": exported_trace_run,
                                "traceKnowledge": exported_trace_knowledge,
                                "requestedTerms": exported_requested_terms,
                                "searchTerms": list(exported_dataset.get("searchTerms") or []),
                            }
                        ),
                        _json_dumps(
                            {
                                "source": "unity_trace_bundle_v2",
                                "sourceKind": dataset_source,
                            }
                        ),
                        str(exported_trace_run.get("materializedAt") or _now_iso()),
                    ),
                )
                semantic_fragment_payload = _runtime_display_formula_fragment_from_trace_knowledge(
                    exported_trace_knowledge,
                    trace_scope=trace_scope,
                    source_node_id=source_node_id,
                    relation_kind=relation_kind,
                )
                if semantic_fragment_payload:
                    fragment_key = str(
                        semantic_fragment_payload.get("shellField")
                        or source_node_id
                        or trace_scope
                        or attempt_id
                    ).strip()
                    fragment_id = _stable_key(
                        [
                            "v2-semantic-runtime-display-formula",
                            trace_scope,
                            fragment_key,
                        ]
                    )
                    previous_fragment_row = conn.execute(
                        """
                        SELECT payload_json
                        FROM semantic_fragments_v2
                        WHERE fragment_id = ?
                        """,
                        (fragment_id,),
                    ).fetchone()
                    previous_fragment_payload = (
                        _json_loads(previous_fragment_row["payload_json"], {})
                        if previous_fragment_row
                        else {}
                    )
                    semantic_fragment_changed = previous_fragment_payload != semantic_fragment_payload
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO semantic_fragments_v2(
                            fragment_id, trace_scope, fragment_kind, fragment_key,
                            payload_json, provenance_json, created_at
                        ) VALUES(?,?,?,?,?,?,?)
                        """,
                        (
                            fragment_id,
                            trace_scope,
                            "runtime_display_formula_fragment",
                            fragment_key,
                            _json_dumps(semantic_fragment_payload),
                            _json_dumps(
                                {
                                    "source": "unity_trace_bundle_v2",
                                    "sourceKind": dataset_source,
                                    "relationKind": relation_kind,
                                    "sourceNodeId": source_node_id,
                                    "targetNodeId": target_node_id,
                                    "attemptId": attempt_id,
                                }
                            ),
                            str(exported_trace_run.get("materializedAt") or _now_iso()),
                        ),
                    )
            else:
                imported_ir_observations = 0
                imported_graph_observations = 0
                strengthened_edges = 0
                semantic_fragment_changed = False
                event_id = _stable_key(
                    ["v2-trace-event", attempt_id, "v2-backend-dataset-sync", trace_scope, request_signature or "sync"]
                )
                conn.execute(
                    """
                    INSERT OR REPLACE INTO trace_events_v2(
                        event_id, source_run_id, source_kind, trace_scope, request_signature,
                        payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?)
                    """,
                    (
                        event_id,
                        attempt_id,
                        "v2-backend-dataset-sync",
                        trace_scope,
                        request_signature,
                        _json_dumps(
                            {
                                "attemptId": attempt_id,
                                "traceRun": exported_trace_run,
                                "traceKnowledge": exported_trace_knowledge,
                                "requestedTerms": exported_requested_terms,
                                "searchTerms": list(exported_dataset.get("searchTerms") or []),
                            }
                        ),
                        _json_dumps({"source": "unity_trace_bundle_v2", "sourceKind": dataset_source}),
                        str(exported_trace_run.get("materializedAt") or _now_iso()),
                    ),
                )

            evidence_rows = []

            imported_observations = 0
            imported_edge_ids: set[str] = set()
            imported_terms = set(requested_terms)
            if candidate_term:
                imported_terms.add(candidate_term)
            imported_terms.update(bridge_path)
            imported_terms.update(
                value for value in (source_node_id, target_node_id) if str(value).strip()
            )

            for row in evidence_rows:
                source_id = str(row["source_node_id"] or "").strip()
                target_id = str(row["target_node_id"] or "").strip()
                relation = str(row["edge_kind"] or "").strip()
                field_key = str(row["field_key"] or "").strip()
                edge_status = str(row["edge_status"] or "").strip() or "candidate"
                if not source_id or not target_id or not relation:
                    continue
                payload_json = _json_loads(row["payload_json"], {})
                provenance_json = _json_loads(row["provenance_json"], {})
                updated_at = str(row["updated_at"] or _now_iso())
                for node_id in (source_id, target_id):
                    self._upsert_v2_node(
                        conn,
                        "graph_nodes_v2",
                        node_id=node_id,
                        node_kind=_infer_node_kind(node_id),
                        payload={"origin": "v1-result-sync", "traceScope": trace_scope},
                        provenance={"sourceTable": "evidence_graph_edges"},
                        updated_at=updated_at,
                    )
                    self._upsert_v2_node(
                        conn,
                        "structure_ir_nodes_v2",
                        node_id=node_id,
                        node_kind=_infer_node_kind(node_id),
                        payload={"origin": "v1-result-sync", "traceScope": trace_scope},
                        provenance={"sourceTable": "evidence_graph_edges"},
                        updated_at=updated_at,
                    )
                edge_id = self._upsert_v2_edge(
                    conn,
                    "structure_ir_edges_v2",
                    source_node_id=source_id,
                    relation_kind=relation,
                    target_node_id=target_id,
                    field_key=field_key,
                    edge_status=edge_status,
                    value_semantics=str(row["value_semantics"] or "").strip() or "unknown",
                    support_count=1 if edge_status == "present" else 0,
                    contradiction_count=1 if edge_status == "negative" else 0,
                    payload=payload_json,
                    provenance=provenance_json,
                    updated_at=updated_at,
                )
                imported_edge_ids.add(edge_id)
                edge_is_relevant = bool(source_id in imported_terms or target_id in imported_terms)
                observation_id = _stable_key(
                    [
                        "v2-observation",
                        edge_id,
                        trace_scope,
                        str(row["source_layer"] or "").strip(),
                        updated_at,
                    ]
                )
                existed_observation = conn.execute(
                    "SELECT 1 FROM graph_edge_observations_v2 WHERE observation_id = ?",
                    (observation_id,),
                ).fetchone()
                conn.execute(
                    """
                    INSERT OR REPLACE INTO graph_edge_observations_v2(
                        observation_id, edge_id, trace_scope, source_run_id, source_kind,
                        observation_status, confidence, payload_json, provenance_json, created_at
                    ) VALUES(?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        observation_id,
                        edge_id,
                        trace_scope,
                        request_signature,
                        str(row["source_layer"] or "").strip() or "v1-result-sync",
                        edge_status,
                        1.0 if edge_status == "present" else 0.5,
                        _json_dumps(payload_json),
                        _json_dumps(provenance_json),
                        updated_at,
                    ),
                )
                if not existed_observation and edge_is_relevant:
                    imported_observations += 1

                canonical_row = conn.execute(
                    """
                    SELECT source_node_id, edge_kind, target_node_id, field_key, edge_status,
                           value_semantics, positive_observation_count, negative_observation_count,
                           payload_json, provenance_json, updated_at
                    FROM canonical_graph_edges
                    WHERE project_name = 'cifi-full'
                      AND project_file = 'libil2cpp.so'
                      AND source_node_id = ?
                      AND edge_kind = ?
                      AND target_node_id = ?
                      AND field_key = ?
                    LIMIT 1
                    """,
                    (source_id, relation, target_id, field_key),
                ).fetchone()
                if canonical_row:
                    previous = conn.execute(
                        "SELECT support_count, contradiction_count, edge_status FROM graph_edges_v2 WHERE edge_id = ?",
                        (edge_id,),
                    ).fetchone()
                    self._upsert_v2_edge(
                        conn,
                        "graph_edges_v2",
                        source_node_id=source_id,
                        relation_kind=relation,
                        target_node_id=target_id,
                        field_key=field_key,
                        edge_status=str(canonical_row["edge_status"] or "").strip() or edge_status,
                        value_semantics=str(canonical_row["value_semantics"] or "").strip() or "unknown",
                        support_count=int(canonical_row["positive_observation_count"] or 0),
                        contradiction_count=int(canonical_row["negative_observation_count"] or 0),
                        payload=_json_loads(canonical_row["payload_json"], {}),
                        provenance=_json_loads(canonical_row["provenance_json"], {}),
                        updated_at=str(canonical_row["updated_at"] or updated_at),
                    )
                    if previous:
                        if (
                            int(canonical_row["positive_observation_count"] or 0) > int(previous["support_count"] or 0)
                            or str(canonical_row["edge_status"] or "") != str(previous["edge_status"] or "")
                        ):
                            if edge_is_relevant:
                                strengthened_edges += 1
                    else:
                        if edge_is_relevant:
                            strengthened_edges += 1
                    support_id = _stable_key(["v2-support", edge_id, trace_scope, request_signature or updated_at])
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO graph_edge_support_v2(
                            support_id, edge_id, support_kind, support_value, trace_scope,
                            payload_json, provenance_json, created_at
                        ) VALUES(?,?,?,?,?,?,?,?)
                        """,
                        (
                            support_id,
                            edge_id,
                            "v1-result-sync",
                            request_signature or "sync",
                            trace_scope,
                            _json_dumps({"relationKind": relation, "edgeStatus": str(canonical_row["edge_status"] or "").strip()}),
                            _json_dumps({"sourceTable": "canonical_graph_edges"}),
                            str(canonical_row["updated_at"] or updated_at),
                        ),
                    )

            outcome = "awaiting-result"
            if strengthened_edges > 0:
                outcome = "strengthened"
            elif semantic_fragment_changed:
                outcome = "strengthened"
            elif imported_observations > 0 or exported_trace_run:
                backend_run_payload = dict(payload.get("backendRun") or {}) if isinstance(payload.get("backendRun"), dict) else {}
                if not backend_run_payload and isinstance(payload.get("executionResult"), dict):
                    backend_run_payload = dict(payload.get("executionResult") or {})
                return_code = backend_run_payload.get("returnCode")
                export_changed = bool(exported_trace_run.get("dbPersistedChanged"))
                has_trace_knowledge = bool(exported_trace_knowledge)
                if return_code == 0 or export_changed or has_trace_knowledge or imported_ir_observations > 0 or imported_graph_observations > 0:
                    outcome = "nonclosing"

            graph_context_digest = str(
                payload.get("graphContextDigest")
                or payload.get("traceDirective", {}).get("graphContextDigest")
                or ""
            ).strip()
            if not graph_context_digest:
                graph_context_digest = _stable_key(
                    [
                        obligation_id,
                        trace_scope,
                        relation_kind,
                        str(len(imported_edge_ids)),
                        str(imported_observations),
                        str(strengthened_edges),
                        outcome,
                    ]
                )

            if outcome == "nonclosing":
                batch_target_statuses = {
                    batch_target: (
                        "covered"
                        if self._projection_proxy_relation_covered(conn, source_node_id, batch_target)
                        else "checked-nonclosing"
                    )
                    for batch_target in batched_candidate_terms
                    if source_node_id and batch_target
                }
                for batch_target, batch_status in batch_target_statuses.items():
                    self._record_pair_check_with_conn(
                        conn,
                        trace_scope=trace_scope,
                        relation_kind=relation_kind,
                        source_node_id=source_node_id,
                        target_node_id=batch_target,
                        check_status=batch_status,
                        request_signature=request_signature,
                        graph_context_digest=graph_context_digest,
                        reopen_fingerprint="",
                        payload={
                            "attemptId": attempt_id,
                            "obligationId": obligation_id,
                            "requestedTerms": requested_terms,
                            "bridgePath": bridge_path,
                            "candidateTerm": batch_target,
                            "batchedCandidateTerms": batched_candidate_terms,
                        },
                        provenance={"source": "v2-result-apply"},
                        updated_at=_now_iso(),
                    )
                    if projection_id:
                        batch_fingerprint = _stable_key(
                            ["v2-path", trace_scope, projection_id, source_node_id, batch_target, "projection-bridge"]
                        )
                        self._record_path_check_with_conn(
                            conn,
                            trace_scope=trace_scope,
                            relation_kind=relation_kind,
                            path_fingerprint=batch_fingerprint,
                            check_status=batch_status,
                            request_signature=request_signature,
                            graph_context_digest=graph_context_digest,
                            reopen_fingerprint="",
                            payload={
                                "attemptId": attempt_id,
                                "obligationId": obligation_id,
                                "bridgePath": [source_node_id, batch_target],
                                "candidateTerm": batch_target,
                                "batchedCandidateTerms": batched_candidate_terms,
                            },
                            provenance={"source": "v2-result-apply"},
                            updated_at=_now_iso(),
                        )
                path_fingerprint = str(payload.get("traceDirective", {}).get("pathFingerprint") or payload.get("pathFingerprint") or "").strip()
                if path_fingerprint:
                    path_status = "covered" if any(status == "covered" for status in batch_target_statuses.values()) else "checked-nonclosing"
                    self._record_path_check_with_conn(
                        conn,
                        trace_scope=trace_scope,
                        relation_kind=relation_kind,
                        path_fingerprint=path_fingerprint,
                        check_status=path_status,
                        request_signature=request_signature,
                        graph_context_digest=graph_context_digest,
                        reopen_fingerprint="",
                        payload={
                            "attemptId": attempt_id,
                            "obligationId": obligation_id,
                            "bridgePath": bridge_path,
                            "candidateTerm": candidate_term,
                            "batchedCandidateTerms": batched_candidate_terms,
                        },
                        provenance={"source": "v2-result-apply"},
                        updated_at=_now_iso(),
                    )

            if outcome == "strengthened":
                for batch_target in batched_candidate_terms:
                    if not source_node_id or not batch_target:
                        continue
                    if self._projection_proxy_relation_covered(conn, source_node_id, batch_target):
                        self._record_pair_check_with_conn(
                            conn,
                            trace_scope=trace_scope,
                            relation_kind=relation_kind,
                            source_node_id=source_node_id,
                            target_node_id=batch_target,
                            check_status="covered",
                            request_signature=request_signature,
                            graph_context_digest=graph_context_digest,
                            reopen_fingerprint="",
                            payload={
                                "attemptId": attempt_id,
                                "obligationId": obligation_id,
                                "candidateTerm": batch_target,
                                "batchedCandidateTerms": batched_candidate_terms,
                            },
                            provenance={"source": "v2-result-apply"},
                            updated_at=_now_iso(),
                        )
                    else:
                        self._record_pair_check_with_conn(
                            conn,
                            trace_scope=trace_scope,
                            relation_kind=relation_kind,
                            source_node_id=source_node_id,
                            target_node_id=batch_target,
                            check_status="checked-nonclosing",
                            request_signature=request_signature,
                            graph_context_digest=graph_context_digest,
                            reopen_fingerprint="",
                            payload={
                                "attemptId": attempt_id,
                                "obligationId": obligation_id,
                                "candidateTerm": batch_target,
                                "batchedCandidateTerms": batched_candidate_terms,
                            },
                            provenance={"source": "v2-result-apply"},
                            updated_at=_now_iso(),
                        )
                for batch_target in batched_candidate_terms:
                    if not source_node_id or not batch_target or not projection_id:
                        continue
                    batch_fingerprint = _stable_key(
                        ["v2-path", trace_scope, projection_id, source_node_id, batch_target, "projection-bridge"]
                    )
                    batch_status = (
                        "covered"
                        if self._projection_proxy_relation_covered(conn, source_node_id, batch_target)
                        else "checked-nonclosing"
                    )
                    self._record_path_check_with_conn(
                        conn,
                        trace_scope=trace_scope,
                        relation_kind=relation_kind,
                        path_fingerprint=batch_fingerprint,
                        check_status=batch_status,
                        request_signature=request_signature,
                        graph_context_digest=graph_context_digest,
                        reopen_fingerprint="",
                        payload={
                            "attemptId": attempt_id,
                            "obligationId": obligation_id,
                            "bridgePath": [source_node_id, batch_target],
                            "candidateTerm": batch_target,
                            "batchedCandidateTerms": batched_candidate_terms,
                        },
                        provenance={"source": "v2-result-apply"},
                        updated_at=_now_iso(),
                    )
                path_fingerprint = str(payload.get("traceDirective", {}).get("pathFingerprint") or payload.get("pathFingerprint") or "").strip()
                if path_fingerprint:
                    self._record_path_check_with_conn(
                        conn,
                        trace_scope=trace_scope,
                        relation_kind=relation_kind,
                        path_fingerprint=path_fingerprint,
                        check_status="covered",
                        request_signature=request_signature,
                        graph_context_digest=graph_context_digest,
                        reopen_fingerprint="",
                        payload={
                            "attemptId": attempt_id,
                            "obligationId": obligation_id,
                            "bridgePath": bridge_path,
                            "candidateTerm": candidate_term,
                            "batchedCandidateTerms": batched_candidate_terms,
                        },
                        provenance={"source": "v2-result-apply"},
                        updated_at=_now_iso(),
                    )

            projection_refresh = (
                self._derive_consumer_projections_with_conn(conn)
                if (
                    imported_ir_observations > 0
                    or imported_graph_observations > 0
                    or strengthened_edges > 0
                    or semantic_fragment_changed
                )
                else None
            )

            updated_payload = {
                **payload,
                "resultSync": {
                    "requestSignature": request_signature,
                    "matchedRequestSignature": request_signature,
                    "exportedRequestSignature": exported_request_signature,
                    "importedObservationCount": imported_observations,
                    "importedIrObservationCount": imported_ir_observations,
                    "importedGraphObservationCount": imported_graph_observations,
                    "strengthenedEdgeCount": strengthened_edges,
                    "importedEdgeCount": len(imported_edge_ids),
                    "datasetSource": dataset_source,
                    "exportTraceFound": bool(exported_trace_run),
                    "outcome": outcome,
                    "semanticFragmentChanged": semantic_fragment_changed,
                    "projectionRefresh": projection_refresh,
                },
            }
            conn.execute(
                """
                UPDATE execution_attempts_v2
                SET attempt_status = ?,
                    payload_json = ?,
                    updated_at = ?
                WHERE attempt_id = ?
                """,
                (
                    outcome if outcome else str(attempt_row["attempt_status"] or "planned"),
                    _json_dumps(updated_payload),
                    _now_iso(),
                    attempt_id,
                ),
            )
            if outcome in {"strengthened", "nonclosing"}:
                conn.execute(
                    """
                    UPDATE graph_obligations_v2
                    SET obligation_status = 'closed',
                        updated_at = ?
                    WHERE obligation_id = ?
                    """,
                    (_now_iso(), obligation_id),
                )

        return {
            "applied": True,
            "attemptId": attempt_id,
            "traceScope": trace_scope,
            "requestSignature": request_signature,
            "importedObservationCount": imported_observations,
            "importedIrObservationCount": imported_ir_observations,
            "importedGraphObservationCount": imported_graph_observations,
            "strengthenedEdgeCount": strengthened_edges,
            "importedEdgeCount": len(imported_edge_ids),
            "outcome": outcome,
            "semanticFragmentChanged": semantic_fragment_changed,
            "datasetSource": dataset_source,
            "exportTraceFound": bool(exported_trace_run),
            "projectionRefresh": projection_refresh,
        }

    def stats(self) -> dict[str, int]:
        table_names = [
            "trace_events_v2",
            "semantic_fragments_v2",
            "ui_binding_fragments_v2",
            "managed_graph_fragments_v2",
            "static_symbol_fragments_v2",
            "native_value_fragments_v2",
            "structure_ir_nodes_v2",
            "structure_ir_edges_v2",
            "structure_ir_observations_v2",
            "graph_nodes_v2",
            "graph_edges_v2",
            "graph_edge_support_v2",
            "graph_edge_observations_v2",
            "graph_anchor_checks_v2",
            "graph_pair_checks_v2",
            "graph_path_checks_v2",
            "execution_attempts_v2",
            "graph_obligations_v2",
            "graph_obligation_support_v2",
            "consumer_projections_v2",
        ]
        with self.connect() as conn:
            return {
                table_name: int((conn.execute(f"SELECT COUNT(*) AS c FROM {table_name}").fetchone() or {"c": 0})["c"] or 0)
                for table_name in table_names
            }

    def obligation_status_counts(self) -> dict[str, int]:
        with self.connect() as conn:
            counts = {"open": 0, "closed": 0, "total": 0}
            for row in conn.execute(
                """
                SELECT obligation_status, COUNT(*) AS c
                FROM graph_obligations_v2
                GROUP BY obligation_status
                """
            ).fetchall():
                status = str(row["obligation_status"] or "").strip().lower()
                count = int(row["c"] or 0)
                if status == "open":
                    counts["open"] += count
                elif status == "closed":
                    counts["closed"] += count
                counts["total"] += count
            return counts


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Trace + DB V2 schema/obligation/projection helper")
    parser.add_argument("--db", default=str(DEFAULT_DB_PATH), help="Path to the SQLite DB")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("init", help="Create the V2 schema")
    subparsers.add_parser("derive-obligations", help="Derive V2 graph obligations from graph + execution memory")
    subparsers.add_parser("normalize-attempts", help="Backfill backend-native fields into older V2 execution attempt rows")
    record_nonclosing = subparsers.add_parser("record-nonclosing", help="Record a V2 nonclosing result into DB-owned pair/path memory")
    record_nonclosing.add_argument("obligation_id", help="Target obligation id")
    record_nonclosing.add_argument("--request-signature", default="", help="Optional request signature")
    execute_best_gap = subparsers.add_parser("execute-best-gap", help="Select the top V2 obligation and build/persist an execution attempt")
    execute_best_gap.add_argument("--dry-run", action="store_true", help="Preview only without recording an execution attempt")
    derive_projections = subparsers.add_parser("derive-projections", help="Derive V2 consumer projections from graph truth")
    derive_projections.add_argument("--kind", default="", help="Optional projection kind hint")
    list_projections = subparsers.add_parser("list-projections", help="List active V2 consumer projections")
    list_projections.add_argument("--kind", default="", help="Optional projection kind filter")
    list_projections.add_argument("--limit", type=int, default=20, help="Result limit")
    subparsers.add_parser("stats", help="Print V2 table counts")
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    db = TraceGraphDBV2(Path(args.db))
    if args.command == "init":
        db.ensure_schema()
        print(f"Initialized V2 schema at {db.db_path}")
        return
    if args.command == "derive-obligations":
        counts = db.derive_obligations_from_v2_graph()
        print(_json_dumps({"dbPath": str(db.db_path), "derived": counts}))
        return
    if args.command == "normalize-attempts":
        result = db.normalize_execution_attempt_payloads()
        print(_json_dumps({"dbPath": str(db.db_path), "normalized": result}))
        return
    if args.command == "record-nonclosing":
        result = db.record_nonclosing_obligation(str(args.obligation_id), str(args.request_signature or ""))
        print(_json_dumps({"dbPath": str(db.db_path), "recorded": result}))
        return
    if args.command == "execute-best-gap":
        db.derive_obligations_from_v2_graph()
        obligation = db.select_best_obligation()
        if not obligation:
            print(_json_dumps({"dbPath": str(db.db_path), "execution": {}, "message": "No V2 obligations available."}))
            return
        execution_request = db.build_execution_request_for_obligation(str(obligation.get("obligationId") or ""))
        result = {}
        if execution_request and not bool(args.dry_run):
            result = db.record_execution_attempt(execution_request, attempt_status="planned")
        print(
            _json_dumps(
                {
                    "dbPath": str(db.db_path),
                    "obligation": obligation,
                    "execution": execution_request,
                    "attempt": result,
                }
            )
        )
        return
    if args.command == "derive-projections":
        result = db.derive_consumer_projections()
        print(_json_dumps({"dbPath": str(db.db_path), "derived": result, "kind": str(args.kind or "")}))
        return
    if args.command == "list-projections":
        result = db.list_consumer_projections(str(args.kind or ""), int(args.limit))
        print(_json_dumps({"dbPath": str(db.db_path), "projections": result}))
        return
    if args.command == "stats":
        print(_json_dumps({"dbPath": str(db.db_path), "stats": db.stats()}))
        return
    raise SystemExit(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
