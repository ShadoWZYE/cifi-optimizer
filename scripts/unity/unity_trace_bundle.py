from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import struct
import sys
import types
from datetime import datetime
from pathlib import Path
from typing import Any

from ghidra_cache_db import GhidraCacheDB
from portable_paths import md_link, repo_relative
from trace_extractors import (
    TraceDocumentCache,
    build_token_shop_native_bridge_plan,
    collect_native_trace,
    find_cached_native_trace,
    get_semantic_scope,
    load_token_shop_extract,
    upsert_semantic_scope,
)


ROOT = Path(__file__).resolve().parents[2]
JSON_OUT = ROOT / "data" / "unity-trace-bundle.json"
MD_OUT = ROOT / "docs" / "unity" / "unity-trace-bundle.md"
REGISTRY_PATH = ROOT / "data" / "unity-trace-target-registry.json"
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"
UNITY_JOINED_DIR = ROOT / "workbench" / "unity" / "joined"
TRACE_RUNS_DIR = ROOT / "workbench" / "trace-runs"
TRACE_CACHE_DB = ROOT / "workbench" / "ghidra-cache" / "ghidra_cache.sqlite3"

TRACE_DB: GhidraCacheDB | None = None

UNITY_ENV: Any = None
METADATA_STRING_ENTRIES: list[dict[str, Any]] | None = None
UNITY_SEARCH_INDEX: dict[str, list[dict[str, Any]]] | None = None
UNITY_RAW_STRING_INDEX: dict[str, list[dict[str, Any]]] | None = None
UNITY_OBJECTS_BY_PATH_ID: dict[int, Any] | None = None
UNITY_OBJECTS_BY_ASSET_AND_PATH_ID: dict[tuple[str, int], Any] | None = None


def get_trace_db() -> GhidraCacheDB:
    global TRACE_DB
    if TRACE_DB is None:
        TRACE_DB = GhidraCacheDB(TRACE_CACHE_DB, ROOT / "workbench" / "ghidra-jobs")
    return TRACE_DB


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
        install_unitypy_stubs()
        sys.path.insert(0, str((ROOT / ".deps").resolve()))
        from UnityPy import Environment
        UNITY_ENV = Environment()
        UNITY_ENV.load_folder(str(UNITY_JOINED_DIR))
    return UNITY_ENV


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
    if UNITY_OBJECTS_BY_PATH_ID is not None:
        return UNITY_OBJECTS_BY_PATH_ID
    env = get_unity_env()
    preferred_assets = {"level0": 0, "globalgamemanagers.assets": 1, "sharedassets0.assets": 2}
    chosen: dict[int, Any] = {}
    for obj in env.objects:
        path_id = int(obj.path_id)
        asset_name = getattr(getattr(obj, "assets_file", None), "name", "") or ""
        current = chosen.get(path_id)
        if current is None:
            chosen[path_id] = obj
            continue
        current_asset = getattr(getattr(current, "assets_file", None), "name", "") or ""
        if preferred_assets.get(asset_name, 99) < preferred_assets.get(current_asset, 99):
            chosen[path_id] = obj
    UNITY_OBJECTS_BY_PATH_ID = chosen
    return UNITY_OBJECTS_BY_PATH_ID


def get_unity_objects_by_asset_and_path_id() -> dict[tuple[str, int], Any]:
    global UNITY_OBJECTS_BY_ASSET_AND_PATH_ID
    if UNITY_OBJECTS_BY_ASSET_AND_PATH_ID is not None:
        return UNITY_OBJECTS_BY_ASSET_AND_PATH_ID
    env = get_unity_env()
    UNITY_OBJECTS_BY_ASSET_AND_PATH_ID = {
        ((getattr(getattr(obj, "assets_file", None), "name", "") or ""), int(obj.path_id)): obj
        for obj in env.objects
    }
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
        return PRIMARY_SOURCE_PATHS["level0"]
    return ASSET_SOURCE_MEMBER_PATHS.get(source_id)


def get_unity_search_index() -> dict[str, list[dict[str, Any]]]:
    global UNITY_SEARCH_INDEX
    if UNITY_SEARCH_INDEX is not None:
        return UNITY_SEARCH_INDEX

    env = get_unity_env()
    index: dict[str, list[dict[str, Any]]] = {}
    for obj in env.objects:
        search_surfaces: list[tuple[str, str, int]] = []

        if obj.type.name == "MonoBehaviour":
            try:
                data = obj.read()
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
            except Exception:
                pass
        elif obj.type.name == "GameObject":
            try:
                data = obj.read()
                name = getattr(data, "m_Name", "") or ""
                if name:
                    search_surfaces.append(("object-name", name, 85))
            except Exception:
                pass
        elif obj.type.name in ("Text", "TextMeshProUGUI", "TextMeshPro"):
            try:
                data = obj.read()
                text_field = "m_text" if obj.type.name in ("TextMeshProUGUI", "TextMeshPro") else "m_Text"
                text_content = getattr(data, text_field, "") or ""
                if text_content:
                    search_surfaces.append(("text-content", text_content, 70))
            except Exception:
                pass

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
            index.setdefault(source_key, []).append(entry)

    UNITY_SEARCH_INDEX = index
    return UNITY_SEARCH_INDEX


def get_unity_raw_string_index() -> dict[str, list[dict[str, Any]]]:
    global UNITY_RAW_STRING_INDEX
    if UNITY_RAW_STRING_INDEX is not None:
        return UNITY_RAW_STRING_INDEX

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
        cached = find_cached_native_trace([term], family_hint=None)
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
                    "status": "cached" if find_cached_native_trace([normalized], family_hint=None) else "planned",
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
                    "status": "cached" if find_cached_native_trace([normalized], family_hint=None) else "planned",
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
        cached = collect_native_trace([next_live_term], timeout=90, family_hint=None)
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


def build_token_shop_literal_schema_follow_up() -> list[dict[str, Any]]:
    schema_terms = [
        "CalculationType",
        "CostExponent",
        "FinalSetValue",
        "get_costExponent",
        "get_finalSetValue",
        "CalculateAndSetUpgradeCalculations",
        "SetCostRelatedAttributes",
        "CreateUpgradeClass",
        "AdditiveIncrease",
        "Cost",
        "Output",
        "UpgradeName",
        "Description",
        "UnlockConditionText",
        "get_cost",
    ]
    results: list[dict[str, Any]] = []
    next_live_term: str | None = None
    for term in schema_terms:
        cached = find_cached_native_trace([term], family_hint=None)
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
                "followUpKind": "literal-schema-seed",
            }
        )
    if next_live_term:
        cached = collect_native_trace([next_live_term], timeout=90, family_hint=None)
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
                "followUpKind": "literal-schema-seed",
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
    schema = row_recovery.get("literalSchemaRecovery", {}) or {}
    schema_fields = set(schema.get("schemaFields", []) or [])

    bonus_value = value_by_field.get("ModBoostBonus")
    formatted_bonus = None
    if isinstance(bonus_value, (int, float)):
        formatted_bonus = f"x{float(bonus_value):.2f}"

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
    literal_schema = row_recovery.get("literalSchemaRecovery", {}) or {}
    literal_text = row_recovery.get("literalTextRecovery", {}) or {}
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

    literal_title_resolved = bool(str(literal_text.get("title") or "").strip()) or any(
        isinstance(value, str)
        and not looks_like_slot_label(value)
        and (" " in value or ":" in value)
        for value in direct_text_candidates
    )
    literal_description_resolved = bool(str(literal_text.get("description") or "").strip()) or any(
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
        "literalSchemaStatus": str(literal_schema.get("status") or "schema-unchecked"),
        "status": closure_status,
        "requiredSemanticGaps": required_gaps,
        "unresolvedLiteralTargets": unresolved_literals,
        "unresolvedRuntimeTargets": unresolved_runtime_targets,
        "directTextCandidates": direct_text_candidates,
        "detachedTextCandidates": detached_text_candidates,
        "literalSchemaRecovery": literal_schema,
        "literalTextRecovery": literal_text,
    }


def build_token_shop_row_layout_explanation(row_recovery: dict[str, Any]) -> dict[str, Any]:
    presentation_update = row_recovery.get("presentationUpdatePath", {}) or {}
    literal_text = row_recovery.get("literalTextRecovery", {}) or {}
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
    bonus_multiplier = literal_text.get("bonusMultiplier")
    output_label = str(literal_text.get("outputLabel") or "").strip()
    derived_short_effect = None
    if bonus_multiplier and output_label:
        output_domain = output_label.removeprefix("Output: ").strip()
        if output_domain.endswith("(MP)"):
            output_domain = "MP Gained"
        elif output_domain:
            output_domain = f"{output_domain} Gained"
        derived_short_effect = f"{bonus_multiplier} to {output_domain}." if output_domain else None

    return {
        "status": "row-layout-recovered",
        "titleLine": {
            "text": literal_text.get("title"),
            "slot": title_slot,
            "explanation": "Top title strip for the upgrade card.",
        },
        "shortEffectLine": {
            "text": literal_text.get("shortEffectLabel"),
            "slot": short_effect_slot,
            "explanation": "Compact effect line rendered inside the main button area.",
            "composition": {
                "multiplier": bonus_multiplier,
                "outputLabel": literal_text.get("outputLabel"),
                "derivedReadableForm": derived_short_effect,
                "note": "The short in-card label behaves like a compact presentation form derived from the bonus multiplier plus the output domain.",
            },
        },
        "longDescriptionLine": {
            "text": literal_text.get("description"),
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
            "label": literal_text.get("bonusLabel"),
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

PRIMARY_SOURCE_PATHS = {
    "metadata": METADATA_PATH,
    "level0": ROOT / "workbench" / "unity" / "joined" / "level0",
    "native": ROOT / "workbench" / "apk" / "base" / "libil2cpp.so",
}

ASSET_SOURCE_MEMBER_PATHS = {
    "sharedassets0": ROOT / "workbench" / "unity" / "joined" / "sharedassets0.assets",
    "globalgamemanagers": ROOT / "workbench" / "unity" / "joined" / "globalgamemanagers.assets",
}

COMPATIBILITY_SOURCE_PATHS = {
    "tokenShopExtract": ROOT / "data" / "token-shop-values.json",
    "tokenShopRowRemapBoundary": ROOT / "data" / "token-shop-row-remap-boundary.json",
    "tokenShopLateAtuBoundary": ROOT / "data" / "token-shop-late-atu-boundary.json",
    "shardCostNativeProbe": ROOT / "data" / "shard-cost-native-probe.v1.json",
    "shardCostFormulaModel": ROOT / "data" / "shard-cost-formula-model.v1.json",
    "shardSaveBoundary": ROOT / "data" / "shard-save-boundary.v1.json",
    "shardMilestoneSaveOwnerCandidates": ROOT / "data" / "shard-milestone-save-owner-candidates.v1.json",
    "multiverseMarketMemberBoundary": ROOT / "data" / "multiverse-market-market-member-boundary.json",
    "multiverseMarketSaveDataImportBoundary": ROOT / "data" / "multiverse-market-savedata-import-boundary.json",
    "multiverseMarketRangeBoundary": ROOT / "data" / "multiverse-market-range-boundary.json",
}

CONCRETE_SOURCE_PATHS = {
    **PRIMARY_SOURCE_PATHS,
    **ASSET_SOURCE_MEMBER_PATHS,
    **COMPATIBILITY_SOURCE_PATHS,
}

# Internal concrete-path lookup for compatibility-only helpers and legacy citations.
ALL_SOURCE_PATHS = CONCRETE_SOURCE_PATHS

PRIMARY_SOURCE_ROLE_TEXT = {
    "metadata": "Primary raw declaration-side source from global-metadata.dat.",
    "level0": "Primary direct Unity scene/object extraction from level0.",
    "assets": "Primary shared Unity assets family spanning sharedassets0 and globalgamemanagers.",
    "native": "Primary native executable source from libil2cpp.so via DB-backed native extraction.",
}

COMPATIBILITY_SOURCE_ROLE_TEXT = {
    "tokenShopExtract": "Compatibility/import artifact preserving one historical TokenShop owner-payload extraction.",
    "tokenShopRowRemapBoundary": "Compatibility/debug artifact preserving one historical TokenShop row-remap boundary pass.",
    "tokenShopLateAtuBoundary": "Compatibility/debug artifact preserving one historical late-ATU boundary pass.",
    "shardCostNativeProbe": "Compatibility/reference artifact preserving one historical shard native-probe result.",
    "shardCostFormulaModel": "Compatibility/reference artifact preserving one historical shard cost model export.",
    "shardSaveBoundary": "Compatibility/reference artifact preserving one historical shard save-boundary export.",
    "shardMilestoneSaveOwnerCandidates": "Compatibility/reference artifact preserving one historical shard save-owner narrowing pass.",
    "multiverseMarketMemberBoundary": "Compatibility/reference artifact preserving one historical market member-boundary pass.",
    "multiverseMarketSaveDataImportBoundary": "Compatibility/reference artifact preserving one historical market import-boundary pass.",
    "multiverseMarketRangeBoundary": "Compatibility/reference artifact preserving one historical market range-boundary pass.",
}

ASSET_SOURCE_MEMBERS = tuple(ASSET_SOURCE_MEMBER_PATHS.keys())
PRIMARY_SOURCE_IDS = ("metadata", "level0", "assets", "native")


def get_source_reference(source_id: str) -> str:
    if source_id == "assets":
        return " + ".join(repo_relative(path) for path in ASSET_SOURCE_MEMBER_PATHS.values())
    if source_id == "tokenShopExtract":
        return f"{repo_relative(METADATA_PATH)} + {repo_relative(PRIMARY_SOURCE_PATHS['level0'])}"
    path = CONCRETE_SOURCE_PATHS.get(source_id)
    if path is None:
        raise KeyError(f"Unknown source id: {source_id}")
    return repo_relative(path)


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_registry() -> dict[str, Any]:
    registry = load_json(REGISTRY_PATH)
    if registry.get("dataset") != "unity-trace-target-registry":
        raise ValueError("unity trace target registry dataset id drifted")
    return registry


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


def canonicalize_primary_source_id(source_id: str) -> str:
    if source_id in PRIMARY_SOURCE_IDS:
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


def flatten_planner_terms(family_plan: dict[str, Any]) -> list[str]:
    values = list(family_plan.get("queryTerms", [])) + list(family_plan.get("anchorExpansionTerms", []))
    for term_list in family_plan.get("synonymSets", {}).values():
        values.extend(term_list)
    return unique_strings(values)


def score_planner_family(family_id: str, family_plan: dict[str, Any], inputs: list[str]) -> dict[str, Any]:
    matched_terms: list[str] = []
    matched_inputs: list[str] = []
    score = 0
    for term in flatten_planner_terms(family_plan):
        normalized_term = normalize_planner_term(term)
        if not normalized_term:
            continue
        best_input: str | None = None
        best_score = 0
        for input_value in inputs:
            normalized_input = normalize_planner_term(input_value)
            if not normalized_input:
                continue
            if normalized_input == normalized_term:
                best_input = input_value
                best_score = 6
                break
            if normalized_input in normalized_term or normalized_term in normalized_input:
                if best_score < 3:
                    best_input = input_value
                    best_score = 3
        if best_input is None:
            continue
        score += best_score
        matched_terms.append(term)
        if best_input not in matched_inputs:
            matched_inputs.append(best_input)
    return {
        "familyId": family_id,
        "score": score,
        "matchedTerms": matched_terms,
        "matchedInputs": matched_inputs,
    }


def choose_best_family(registry: dict[str, Any], inputs: list[str]) -> dict[str, Any]:
    planner = registry["planner"]
    scored = [
        score_planner_family(family_id, planner["families"][family_id], inputs)
        for family_id in planner["familyOrder"]
    ]
    scored.sort(key=lambda item: (-int(item["score"]), -len(item["matchedTerms"]), planner["familyOrder"].index(item["familyId"])))
    best = scored[0]
    if int(best["score"]) <= 0:
        available = ", ".join(planner["familyOrder"])
        raise ValueError(f"Could not resolve a trace family from query inputs {inputs}. Checked planner families: {available}.")
    return best


def _detect_exact_target_override(
    registry: dict[str, Any],
    requested_queries: list[str],
    requested_anchors: list[str],
) -> dict[str, Any] | None:
    combined_inputs = unique_strings([*requested_queries, *requested_anchors])
    if not combined_inputs:
        return None
    normalized_inputs = {normalize_planner_term(value): value for value in combined_inputs if normalize_planner_term(value)}
    token_shop_shell_terms = {
        normalized: original
        for normalized, original in normalized_inputs.items()
        if re.fullmatch(r"atu\d+button", normalized)
    }
    if not token_shop_shell_terms:
        return None
    token_shop_effect_terms = {
        normalize_planner_term(value)
        for value in (
            "ATU3Button",
            "CellBoost",
            "BuyCellBoost",
            "15810",
            "Cells Booster",
        )
    }
    if any(term in normalized_inputs for term in token_shop_effect_terms):
        return None
    target_id = "token-shop-family-structure"
    target = registry["targets"][target_id]
    family_plan = registry["planner"]["families"][target["familyId"]]
    synonym_sets_used = pick_synonym_sets(family_plan, combined_inputs, list(token_shop_shell_terms.values()))
    expanded_anchors = expand_anchor_terms(
        target,
        family_plan,
        requested_queries,
        requested_anchors,
        synonym_sets_used,
    )
    return {
        "selectionMode": "exact-anchor-override",
        "requestedQueries": requested_queries,
        "requestedAnchors": requested_anchors,
        "matchedInputs": combined_inputs,
        "matchedTerms": list(token_shop_shell_terms.values()),
        "matchedFamilyId": target["familyId"],
        "matchedFamilyLabel": family_plan["label"],
        "selectedTargetId": target_id,
        "selectedRunMode": "trace",
        "selectedComparePresetId": None,
        "synonymSetsUsed": synonym_sets_used,
        "expandedAnchors": expanded_anchors,
        "decisionNote": (
            "Exact TokenShop shell anchors were provided without ATU3 effect terms, so the trace used the "
            "family-structure target instead of the TokenShop family default compare lane."
        ),
    }


def make_generic_explore_resolution(registry: dict[str, Any], queries: list[str], anchors: list[str]) -> dict[str, Any]:
    combined_inputs = unique_strings([*queries, *anchors])
    expanded_anchors = unique_strings(combined_inputs)
    return {
        "selectionMode": "generic-explore",
        "requestedQueries": queries,
        "requestedAnchors": anchors,
        "matchedInputs": combined_inputs,
        "matchedTerms": combined_inputs,
        "matchedFamilyId": "exploration",
        "matchedFamilyLabel": "Exploration",
        "selectedTargetId": "generic-explore",
        "selectedRunMode": "trace",
        "selectedComparePresetId": None,
        "synonymSetsUsed": [],
        "expandedAnchors": expanded_anchors,
        "decisionNote": (
            "No planner family matched the provided inputs strongly enough, so the trace fell back to a generic "
            "cross-source exploration run across committed metadata, Unity assets, and bounded extraction documents."
        ),
    }


def pick_synonym_sets(family_plan: dict[str, Any], inputs: list[str], matched_terms: list[str]) -> list[dict[str, Any]]:
    matched_set = set(matched_terms)
    selected: list[dict[str, Any]] = []
    for set_id, terms in family_plan.get("synonymSets", {}).items():
        set_matches = [term for term in terms if term in matched_set]
        if not set_matches:
            normalized_terms = [normalize_planner_term(term) for term in terms]
            set_matches = [
                term
                for term, normalized_term in zip(terms, normalized_terms)
                if any(normalized_term and normalized_term in normalize_planner_term(input_value) for input_value in inputs)
            ]
        if not set_matches:
            continue
        selected.append({"id": set_id, "matchedTerms": unique_strings(set_matches), "terms": terms})
    return selected


def choose_run_mode(family_plan: dict[str, Any], inputs: list[str], explicit_target: bool) -> str:
    if explicit_target:
        return "trace"
    normalized_inputs = [normalize_planner_term(value) for value in inputs if normalize_planner_term(value)]
    direct_terms = [normalize_planner_term(term) for term in family_plan.get("directTraceTerms", [])]
    compare_terms = [normalize_planner_term(term) for term in family_plan.get("compareTerms", [])]
    if any(term and term in normalized_inputs for term in direct_terms):
        return "trace"
    if any(term and term in normalized_inputs for term in compare_terms):
        return "compare"
    return str(family_plan["defaultRunMode"])


def expand_anchor_terms(
    target: dict[str, Any],
    family_plan: dict[str, Any],
    queries: list[str],
    anchors: list[str],
    synonym_sets_used: list[dict[str, Any]],
    include_family_expansion: bool = True,
) -> list[str]:
    values = list(target["defaultAnchors"]) + queries + anchors
    if include_family_expansion:
        values.extend(list(family_plan.get("anchorExpansionTerms", [])))
    for synonym_set in synonym_sets_used:
        values.extend(synonym_set["terms"])
    return unique_strings(values)


def build_planner_decision_note(
    selection_mode: str,
    family_plan: dict[str, Any],
    resolution: dict[str, Any],
    target: dict[str, Any],
) -> str:
    family_label = family_plan["label"]
    selected_target_id = resolution["selectedTargetId"]
    if selection_mode == "explicit-target":
        return (
            f"Used explicit target {selected_target_id} in the {family_label} family and kept anchor expansion bounded "
            f"to the target plus any explicit query or anchor input."
        )
    matched_inputs = ", ".join(resolution["matchedInputs"]) if resolution["matchedInputs"] else family_label
    synonym_labels = ", ".join(item["id"] for item in resolution["synonymSetsUsed"]) or "family defaults"
    if resolution["runMode"] == "compare":
        return (
            f"Matched {matched_inputs} to {family_label} through {synonym_labels} and chose the bounded "
            f"{target['comparisonPresetId']} compare run because this query is better grounded as one checked solved-vs-blocked family trace."
        )
    return (
        f"Matched {matched_inputs} to {family_label} through {synonym_labels} and chose the single "
        f"{selected_target_id} trace because the query already points at one checked family target."
    )


def resolve_planner_selection(
    registry: dict[str, Any],
    explicit_target_id: str | None,
    queries: list[str],
    anchors: list[str],
    explicit_family_id: str | None = None,
) -> dict[str, Any]:
    requested_queries = unique_strings(queries)
    requested_anchors = unique_strings(anchors)
    if explicit_target_id:
        target = registry["targets"][explicit_target_id]
        family_id = target["familyId"]
        family_plan = registry["planner"]["families"][family_id]
        combined_inputs = unique_strings([*requested_queries, *requested_anchors])
        synonym_sets_used = pick_synonym_sets(family_plan, combined_inputs, combined_inputs)
        expanded_anchors = expand_anchor_terms(
            target,
            family_plan,
            requested_queries,
            requested_anchors,
            synonym_sets_used,
            include_family_expansion=False,
        )
        resolution = {
            "selectionMode": "explicit-target",
            "requestedQueries": requested_queries,
            "requestedAnchors": requested_anchors,
            "matchedInputs": combined_inputs,
            "matchedTerms": combined_inputs,
            "matchedFamilyId": family_id,
            "matchedFamilyLabel": family_plan["label"],
            "selectedTargetId": explicit_target_id,
            "selectedRunMode": choose_run_mode(family_plan, combined_inputs, explicit_target=True),
            "selectedComparePresetId": None,
            "synonymSetsUsed": synonym_sets_used,
            "expandedAnchors": expanded_anchors,
        }
        resolution["decisionNote"] = build_planner_decision_note("explicit-target", family_plan, {
            "selectedTargetId": resolution["selectedTargetId"],
            "matchedInputs": resolution["matchedInputs"],
            "synonymSetsUsed": resolution["synonymSetsUsed"],
            "runMode": resolution["selectedRunMode"],
        }, target)
        return resolution

    if explicit_family_id:
        family_id = explicit_family_id
        family_plan = registry["planner"]["families"][family_id]
        target_id = family_plan["defaultTargetId"]
        target = registry["targets"][target_id]
        combined_inputs = unique_strings([family_plan["label"], *requested_queries, *requested_anchors])
        synonym_sets_used = pick_synonym_sets(family_plan, combined_inputs, combined_inputs)
        expanded_anchors = expand_anchor_terms(target, family_plan, requested_queries, requested_anchors, synonym_sets_used)
        run_mode = choose_run_mode(family_plan, combined_inputs, explicit_target=False)
        resolution = {
            "selectionMode": "explicit-family",
            "requestedQueries": requested_queries,
            "requestedAnchors": requested_anchors,
            "matchedInputs": combined_inputs,
            "matchedTerms": combined_inputs,
            "matchedFamilyId": family_id,
            "matchedFamilyLabel": family_plan["label"],
            "selectedTargetId": target_id,
            "selectedRunMode": run_mode,
            "selectedComparePresetId": target["comparisonPresetId"] if run_mode == "compare" else None,
            "synonymSetsUsed": synonym_sets_used,
            "expandedAnchors": expanded_anchors,
        }
        resolution["decisionNote"] = (
            f"Used explicit family {family_plan['label']} and resolved to default target {target_id} while keeping "
            f"family-aware anchor expansion for the run."
        )
        return resolution

    combined_inputs = unique_strings([*requested_queries, *requested_anchors])
    if not combined_inputs:
        raise ValueError("Pass --target or at least one --query/--anchor to resolve a unity trace.")
    exact_override = _detect_exact_target_override(registry, requested_queries, requested_anchors)
    if exact_override is not None:
        return exact_override
    try:
        best_family = choose_best_family(registry, combined_inputs)
    except ValueError:
        return make_generic_explore_resolution(registry, requested_queries, requested_anchors)
    family_id = best_family["familyId"]
    family_plan = registry["planner"]["families"][family_id]
    target_id = family_plan["defaultTargetId"]
    target = registry["targets"][target_id]
    synonym_sets_used = pick_synonym_sets(family_plan, combined_inputs, best_family["matchedTerms"])
    run_mode = choose_run_mode(family_plan, combined_inputs, explicit_target=False)
    expanded_anchors = expand_anchor_terms(target, family_plan, requested_queries, requested_anchors, synonym_sets_used)
    resolution = {
        "selectionMode": "query-planner",
        "requestedQueries": requested_queries,
        "requestedAnchors": requested_anchors,
        "matchedInputs": best_family["matchedInputs"],
        "matchedTerms": best_family["matchedTerms"],
        "matchedFamilyId": family_id,
        "matchedFamilyLabel": family_plan["label"],
        "selectedTargetId": target_id,
        "selectedRunMode": run_mode,
        "selectedComparePresetId": target["comparisonPresetId"] if run_mode == "compare" else None,
        "synonymSetsUsed": synonym_sets_used,
        "expandedAnchors": expanded_anchors,
    }
    resolution["decisionNote"] = build_planner_decision_note("query-planner", family_plan, {
        "selectedTargetId": resolution["selectedTargetId"],
        "matchedInputs": resolution["matchedInputs"],
        "synonymSetsUsed": resolution["synonymSetsUsed"],
        "runMode": resolution["selectedRunMode"],
    }, target)
    return resolution


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
                source_paths[source_id] = PRIMARY_SOURCE_PATHS[source_id]
            source_roles.append(
                {
                    "sourceId": source_id,
                    "path": get_source_reference(source_id),
                    "familyId": family_id,
                    "familyLabel": family["label"],
                    "role": PRIMARY_SOURCE_ROLE_TEXT[source_id],
                }
            )
    return source_paths, source_roles


def get_active_source_ids_for_target(target: dict[str, Any]) -> list[str]:
    active_ids: list[str] = []
    seen: set[str] = set()

    def add(source_id: str) -> None:
        source_id = canonicalize_primary_source_id(source_id)
        if source_id not in seen:
            seen.add(source_id)
            active_ids.append(source_id)

    for surface in target.get("strategyConfig", {}).get("surfaces", []):
        for source_id in surface.get("sourceIds", []):
            add(source_id)

    add("native")

    if not active_ids:
        return list(PRIMARY_SOURCE_IDS)
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
    base_terms = unique_strings(
        [
            *(str(anchor) for anchor in target.get("anchors", [])),
            *planner_resolution.get("requestedQueries", [])[:3],
            *planner_resolution.get("requestedAnchors", [])[:3],
            *(spec["value"] for spec in build_anchor_specs(planner_resolution.get("expandedAnchors", []), "planner-expanded-anchor")[:8]),
        ]
    )
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
    cached_semantic_scope = get_semantic_scope(semantic_scope_id) if semantic_scope_id else None
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
    literal_schema_follow_up = build_token_shop_literal_schema_follow_up()
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
    if semantic_scope_id:
        upsert_semantic_scope(
            semantic_scope_id,
            {
                "scopeId": semantic_scope_id,
                "scopeType": "row",
                "familyId": "token-shop",
                "rowShellField": match.get("shellField"),
                "semanticGraph": semantic_graph,
                "semanticSearchPlan": semantic_search_plan,
                "closureStatus": closure_status,
                "literalSchemaRecovery": literal_schema_recovery,
                "literalTextRecovery": literal_text_recovery,
                "updatedAt": datetime.now().isoformat(timespec="seconds"),
            },
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
) -> dict[str, Any]:
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
    action_buy_hit = find_hit(action_source, "BuyModBoost")
    prefab_hit = find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.ModPointsBooster")
    title_hit = find_hit(level0_title_source, "Token Ultima: MP") if level0_title_source else None
    diamond_title_hit = find_hit(metadata_title_source, ":Diamond Upgrade 11 - ModBoost") if metadata_title_source else None
    text_hook_hit = find_hit(level0_text_source, "SetAllTokenShopTexts") if level0_text_source else None

    row_recovery = row_recovery or {}
    presentation_update = row_recovery.get("presentationUpdatePath", {}) or {}
    title_slots = list((presentation_update.get("slots") or {}).get("title", []))
    description_slots = list((presentation_update.get("slots") or {}).get("description", []))
    cost_slots = list((presentation_update.get("slots") or {}).get("cost", []))
    update_hooks = list(presentation_update.get("updateHookCandidates", []))
    recovered_formula_values = list(row_recovery.get("recoveredFormulaValues", []))

    def make_level0_citation(term: str, locator: str, note: str) -> dict[str, Any]:
        return {
            "sourceId": "level0",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]),
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
                        "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]),
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
            [
                *[
                    cite_hit(level0_text_source, find_hit(level0_text_source, hook))
                    for hook in update_hooks
                    if level0_text_source and find_hit(level0_text_source, hook)
                ],
            ],
        ),
    ]

    negative_edges = [
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
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
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
                "status": "missing",
                "statement": "The exact shell-to-final-title join for ATU4 is still missing even though the direct title slot graph is recovered.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_mk1_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
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

    metadata_shell_hit = find_hit(metadata_source, "ATU5Button")
    metadata_owner_hit = find_hit(metadata_source, "MK1TokenBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyMK1TokenBoost")
    prefab_hit = find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.MK1Booster")
    support_hit = find_hit(level0_support_source, "1. MK1 Generator Output,")
    alt_support_hit = find_hit(level0_support_source, "This upgrade divides the cost of MK1 Generators by 1500.")
    roster_hit = find_hit(level0_roster_source, "Mk2 Generator Booster")
    text_hook_hit = find_hit(level0_text_source, "SetAllTokenShopTexts")

    unresolved_title = row_remap_boundary["atu5TitleFollowUp"]["blockedTitleJoin"]

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
            [
                cite_hit(level0_support_source, support_hit),
                cite_hit(level0_support_source, alt_support_hit),
            ],
        ),
        make_edge(
            "prefab-to-title-roster",
            prefab_node,
            roster_node,
            "neighbor-title-roster",
            "present",
            "supporting",
            "The owner-side title roster still preserves neighboring generator-booster titles, but not an exact MK1 title join.",
            [
                cite_hit(level0_roster_source, roster_hit),
            ],
        ),
        make_edge(
            "prefab-to-text-hook-cluster",
            prefab_node,
            text_node,
            "generic-text-hook-cluster",
            "present",
            "supporting",
            "The generic TokenShop text hooks survive as a separate title-side surface, but they do not close the ATU5 title join.",
            [
                cite_hit(level0_text_source, text_hook_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-shell-to-title",
            shell_node,
            support_node,
            "exact-shell-to-title",
            "missing",
            "negative",
            "No committed source proves one exact ATU5 shell-to-final-title join; the surviving generic text hooks, detached MK1 generator support text, and neighboring generator-booster title roster all remain detached from the shell-side row neighborhood.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.blockedTitleJoin.missingJoin",
                    unresolved_title["missingJoin"],
                ),
                cite_hit(level0_support_source, support_hit),
                cite_hit(level0_support_source, alt_support_hit),
                cite_hit(level0_roster_source, roster_hit),
                cite_hit(level0_text_source, text_hook_hit),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(metadata_node, "metadata-neighborhood", "ATU5Button + MK1TokenBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and MK1TokenBoost declaration area together."),
            make_node(action_node, "action-hook", "BuyMK1TokenBoost", "present", "The committed probe set preserves the matching MK1 buy hook."),
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
                "status": "missing",
                "statement": "The exact shell-to-final-title join for ATU5 is still missing across the detached support-text, neighboring title-roster, and generic text-hook surfaces.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_mk3_bridge_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-lane")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "level0")
    level0_prefab_source = find_source_entry(prefab_surface, "level0")
    metadata_shell_hit = find_hit(metadata_source, "ATU7Button")
    metadata_owner_hit = find_hit(metadata_source, "MK3TokenBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyMK3TokenBoost")
    level0_prefab_hit = find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "action-hook"
    prefab_node = "prefab-identity"

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
            "present",
            "supporting",
            "The checked action lane preserves the matching direct buy hook BuyMK3TokenBoost for the same MK3 row family.",
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
            "The checked prefab roster preserves the exact MK3Booster identity on the same traced row family.",
            [
                cite_hit(level0_prefab_source, level0_prefab_hit),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(metadata_node, "metadata-neighborhood", "ATU7Button + MK3TokenBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and MK3TokenBoost declaration area together."),
            make_node(action_node, "action-hook", "BuyMK3TokenBoost", "present", "The committed probe set preserves the matching MK3 buy hook."),
            make_node(prefab_node, "prefab-identity", "NewTokenUPGPrefab.T1.MK3Booster", "present", "The exact token prefab identity is preserved."),
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
    row_remap_boundary: dict[str, Any],
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

    metadata_shell_hit = find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = find_hit(metadata_source, "CellBoostStartCost")
    action_buy_hit = maybe_find_hit(action_source, "BuyCellBoost")
    title_hit = find_hit(owner_title_source, "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>")
    lane_text_hit = find_hit(lane_text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")
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

    effect_trace = row_remap_boundary["atu3CrossSystemEffectTrace"]["recoveredActionEffectChain"]
    detached_identities = row_remap_boundary["atu3CrossSystemEffectTrace"]["detachedIdentitySurfaces"]
    missing_owner = row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]

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
            "The metadata neighborhood and checked lane probe preserve BuyCellBoost as the exact named action hook for the same CellBoost family.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.supportingActionHook", effect_trace["supportingActionHook"]),
                *compact_citations(maybe_cite_hit(action_source, action_buy_hit)),
            ],
        ),
        make_edge(
            "action-hook-to-shared-effect-system",
            action_node,
            shared_system_node,
            "shared-effect-system",
            "present",
            "direct",
            "The checked cross-system effect surface preserves the shared Cells Booster (Chests) title for the same cells-from-chests gameplay lane.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectTitle", effect_trace["sharedEffectTitle"]),
                cite_hit(owner_title_source, title_hit),
            ],
        ),
        make_edge(
            "shared-effect-system-to-player-effect-text",
            shared_system_node,
            effect_text_node,
            "derived-player-effect-surface",
            "present",
            "direct",
            "The same shared effect lane preserves one exact player-facing effect string for cells gained from Token and Diamond chests.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectText", effect_trace["sharedEffectText"]),
                cite_hit(lane_text_source, lane_text_hit),
            ],
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
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.derivedReading", effect_trace["parameterSurface"]["derivedReading"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.field", effect_trace["parameterSurface"]["field"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.supportingField", effect_trace["parameterSurface"]["supportingField"]),
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
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.detachedIdentitySurfaces.groundedConclusion", detached_identities["groundedConclusion"]),
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
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin", missing_owner["missingJoin"]),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(action_node, "action-hook", "BuyCellBoost", "present", "The committed probe set preserves the matching cells buy hook."),
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
) -> dict[str, Any]:
    action_source = find_source_entry(find_surface(surfaces, "action-lane"), "level0")
    prefab_source = find_source_entry(find_surface(surfaces, "prefab-lane"), "level0")
    row_recovery = row_recovery or {}
    presentation_update = row_recovery.get("presentationUpdatePath", {}) or {}
    title_slots = list((presentation_update.get("slots") or {}).get("title", []))
    detached_text = list(row_recovery.get("detachedTextCandidates", []))
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
            "provedBy": [
                cite_hit(action_source, find_hit(action_source, "BuyModBoost"))
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_hit(prefab_source, find_hit(prefab_source, "NewTokenUPGPrefab.T1.ModPointsBooster"))
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU4 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                *[
                    {
                        "sourceId": "level0",
                        "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]),
                        "term": str(slot.get("name")),
                        "locator": "$.rowRecovery.presentationUpdatePath.slots.title",
                        "note": str(slot.get("hierarchyPath")),
                    }
                    for slot in title_slots
                ],
                *[
                    {
                        "sourceId": "level0",
                        "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]),
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
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The direct title slot graph exists, but the exact rendered title string is still unresolved.",
            "provedBy": baseline_edges[3]["provedBy"],
        },
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
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]),
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
                "The remaining blocker is no longer a detached comparison artifact; it is the unresolved rendered title string and exact row-specific display update path.",
            ],
        },
    }


def build_mk1_vs_blocked_diff(
    target_id: str,
    target: dict[str, Any],
    row_remap_boundary: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
) -> dict[str, Any]:
    baseline = row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    action_source = find_source_entry(find_surface(surfaces, "action-lane"), "level0")
    prefab_source = find_source_entry(find_surface(surfaces, "prefab-lane"), "level0")
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
                cite_hit(action_source, find_hit(action_source, baseline["supportingActionHook"]))
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_hit(prefab_source, find_hit(prefab_source, baseline["prefabIdentity"]))
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU5 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.blockedTitleJoin.missingJoin",
                    row_remap_boundary["atu5TitleFollowUp"]["blockedTitleJoin"]["missingJoin"],
                )
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
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-specific effect or buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    blocked["missingLinks"][0],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                ),
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-prefab identity join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    blocked["missingLinks"][2],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
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
            "id": "atu5-trace-row-bridge",
            "label": "ATU5 trace-backed row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopExtract"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
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


def build_mk3_vs_blocked_diff(
    target_id: str,
    target: dict[str, Any],
    row_remap_boundary: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
) -> dict[str, Any]:
    baseline = row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    action_source = find_source_entry(find_surface(surfaces, "action-lane"), "level0")
    prefab_source = find_source_entry(find_surface(surfaces, "prefab-lane"), "level0")
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
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one checked row-specific buy hook.",
            "provedBy": [
                cite_hit(action_source, find_hit(action_source, baseline["supportingActionHook"]))
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_hit(prefab_source, find_hit(prefab_source, baseline["prefabIdentity"]))
            ],
        },
        {
            "type": "multi-probe-prefab-corroboration",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge is corroborated by multiple checked prefab surfaces.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu7BridgeFollowUp.recoveredBridge.groundedConclusion",
                    baseline["groundedConclusion"],
                )
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
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-specific effect or buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    blocked["missingLinks"][0],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                ),
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-prefab identity join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    blocked["missingLinks"][2],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
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
            "id": "atu7-trace-row-bridge",
            "label": "ATU7 trace-backed row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopExtract"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both rows preserve the direct serialized shell-to-owner-block adjacency.",
                "The solved ATU7 trace now preserves one checked row-specific buy hook, one exact MK3Booster prefab identity, and multi-probe prefab corroboration.",
                "ATU3 remains narrower and more blocked because its action, prefab, and title clues still do not converge on one exact shell join.",
            ],
        },
    }


def build_atu3_effect_vs_split_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["atu3CrossSystemEffectTrace"]["recoveredActionEffectChain"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly after the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.ownerFieldBlock",
                    ", ".join(baseline["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The effect-driven trace now preserves one checked row-family action hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.supportingActionHook",
                    baseline["supportingActionHook"],
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves one shared cells-from-chests effect system surface.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectTitle",
                    baseline["sharedEffectTitle"],
                )
            ],
        },
        {
            "type": "derived-player-effect-surface",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves one exact player-facing effect string for the shared chest-effect lane.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectText",
                    baseline["sharedEffectText"],
                )
            ],
        },
        {
            "type": "parameter-surface",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves a bounded CellBoost parameter surface.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.derivedReading",
                    baseline["parameterSurface"]["derivedReading"],
                )
            ],
        },
        {
            "type": "typed-shared-effect-owner",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The exact typed gameplay owner for the shared chest-effect applier still remains unresolved.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
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
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace only preserved a generic action cluster, not an effect-chain verdict.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace did not preserve one checked shared effect-system join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        },
        {
            "type": "derived-player-effect-surface",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace did not treat the surviving player-facing effect as one checked derived surface.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
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
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": "ATU3 prefab/title split",
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
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
    row_remap_boundary: dict[str, Any],
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

    metadata_shell_hit = find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = find_hit(metadata_source, "CellBoostStartCost")
    title_hit = find_hit(title_source, "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>")
    lane_text_hit = find_hit(lane_text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")
    ad_manager_hit = find_hit(lane_consumer_source, "AdManager, Assembly-CSharp")
    set_texts_hit = find_hit(lane_consumer_source, "SetAdChestTexts")
    offline_hit = find_hit(lane_consumer_source, "OfflineManager, Assembly-CSharp")
    checker_hit = find_hit(lane_consumer_source, "DailyAndAdCounterChecker")
    start_token_hit = find_hit(metadata_routine_source, "StartTokenRoutine")
    token_routine_hit = find_hit(metadata_routine_source, "<TokenChestRoutine>d__149")
    closed_token_hit = find_hit(metadata_routine_source, "GoToClosedTokenChest")
    start_diamond_hit = find_hit(metadata_routine_source, "StartDiamondRoutine")
    diamond_routine_hit = find_hit(metadata_routine_source, "<DiamondChestRoutine>d__155")
    closed_diamond_hit = find_hit(metadata_routine_source, "GoToClosedDiamondChest")
    small_cells_hit = find_hit(metadata_routine_source, "get_SmallAdCellGains")
    big_cells_hit = find_hit(metadata_routine_source, "get_BigAdCellGains")
    final_token_bonus_hit = find_hit(metadata_routine_source, "<FinalAdTokenChestBonus>k__BackingField")
    final_diamond_bonus_hit = find_hit(metadata_routine_source, "<FinalDiamondChestBonus>k__BackingField")
    token_chest_hit = find_hit(chest_source, "TokenChest")
    diamond_chest_hit = find_hit(chest_source, "DiamondChest")

    consumer_trace = row_remap_boundary["atu3ChestConsumerTrace"]["recoveredConsumerHandoff"]
    missing_seam = row_remap_boundary["atu3ChestConsumerTrace"]["missingParameterConsumerSeam"]

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
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
                cite_hit(title_source, title_hit),
                cite_hit(lane_text_source, lane_text_hit),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.sharedEffectTitle", consumer_trace["sharedEffectTitle"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.sharedEffectText", consumer_trace["sharedEffectText"]),
            ],
        ),
        make_edge(
            "shared-effect-to-consumer-family",
            shared_effect_node,
            consumer_family_node,
            "shared-effect-to-consumer-family",
            "present",
            "direct",
            "The ATU3 shared chest-effect lane now hands off into the concrete AdManager chest consumer family.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerSystem", consumer_trace["consumerSystem"]),
                cite_hit(lane_consumer_source, ad_manager_hit),
                cite_hit(lane_consumer_source, set_texts_hit),
                cite_hit(lane_consumer_source, offline_hit),
                cite_hit(lane_consumer_source, checker_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-routines",
            consumer_family_node,
            routine_family_node,
            "consumer-family-to-chest-routines",
            "present",
            "direct",
            "The same consumer family preserves the token and diamond chest routine neighborhood.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerMethodFamily", ", ".join(consumer_trace["consumerMethodFamily"])),
                cite_hit(metadata_routine_source, start_token_hit),
                cite_hit(metadata_routine_source, token_routine_hit),
                cite_hit(metadata_routine_source, closed_token_hit),
                cite_hit(metadata_routine_source, start_diamond_hit),
                cite_hit(metadata_routine_source, diamond_routine_hit),
                cite_hit(metadata_routine_source, closed_diamond_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-bonus-shell",
            consumer_family_node,
            bonus_shell_node,
            "consumer-family-to-bonus-shell",
            "present",
            "direct",
            "The same runtime shell preserves the chest-reward bonus and cell-gain shell adjacent to the ATU3 consumer family.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerBonusShell", ", ".join(consumer_trace["consumerBonusShell"])),
                cite_hit(metadata_routine_source, small_cells_hit),
                cite_hit(metadata_routine_source, big_cells_hit),
                cite_hit(metadata_routine_source, final_token_bonus_hit),
                cite_hit(metadata_routine_source, final_diamond_bonus_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-chest-objects",
            consumer_family_node,
            chest_objects_node,
            "consumer-family-to-chest-objects",
            "present",
            "supporting",
            "Direct Unity extraction preserves the concrete token and diamond chest objects used by the same consumer family.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.supportingChestObjects", ", ".join(consumer_trace["supportingChestObjects"])),
                cite_hit(chest_source, token_chest_hit),
                cite_hit(chest_source, diamond_chest_hit),
            ],
        ),
        make_edge(
            "shared-effect-to-routine-family",
            shared_effect_node,
            routine_family_node,
            "derived-player-effect-surface",
            "present",
            "supporting",
            "The preserved +1 seconds cells-from-chests effect surface now narrows onto the same token and diamond chest routine family rather than floating as detached text.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.groundedConclusion", consumer_trace["groundedConclusion"]),
                cite_hit(title_source, title_hit),
                cite_hit(metadata_routine_source, token_routine_hit),
                cite_hit(metadata_routine_source, diamond_routine_hit),
            ],
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
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.missingParameterConsumerSeam.missingJoin", missing_seam["missingJoin"]),
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
    row_remap_boundary: dict[str, Any],
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

    metadata_shell_hit = find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = find_hit(metadata_source, "CellBoostStartCost")
    ad_manager_hit = find_hit(lane_consumer_source, "AdManager, Assembly-CSharp")
    set_texts_hit = find_hit(lane_consumer_source, "SetAdChestTexts")
    offline_hit = find_hit(lane_consumer_source, "OfflineManager, Assembly-CSharp")
    checker_hit = find_hit(lane_consumer_source, "DailyAndAdCounterChecker")
    start_token_hit = find_hit(metadata_routine_source, "StartTokenRoutine")
    token_routine_hit = find_hit(metadata_routine_source, "<TokenChestRoutine>d__149")
    start_diamond_hit = find_hit(metadata_routine_source, "StartDiamondRoutine")
    diamond_routine_hit = find_hit(metadata_routine_source, "<DiamondChestRoutine>d__155")
    small_getter_hit = find_hit(getter_source, "get_SmallAdCellGains")
    big_getter_hit = find_hit(getter_source, "get_BigAdCellGains")
    set_booster_hit = find_hit(booster_source, "SetBoosterAdBonus")
    final_booster_getter_hit = find_hit(booster_source, "get_FinalBoosterAdBonus")
    small_cells_hit = find_hit(booster_source, "SmallAdCellGains")
    big_cells_hit = find_hit(booster_source, "BigAdCellGains")
    final_booster_hit = find_hit(booster_source, "FinalBoosterAdBonus")
    set_final_booster_hit = find_hit(booster_source, "set_FinalBoosterAdBonus")
    final_booster_field_hit = find_hit(booster_source, "<FinalBoosterAdBonus>k__BackingField")
    booster_routine_hit = find_hit(booster_source, "<BoosterAdRoutine>d__158")
    final_token_bonus_hit = find_hit(final_source, "<FinalAdTokenChestBonus>k__BackingField")
    final_diamond_bonus_hit = find_hit(final_source, "<FinalDiamondChestBonus>k__BackingField")

    read_trace = row_remap_boundary["atu3ChestConsumerReadTrace"]["recoveredInternalReadShell"]
    missing_seam = row_remap_boundary["atu3ChestConsumerReadTrace"]["missingExactReadSiteSeam"]

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
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
                cite_hit(lane_consumer_source, ad_manager_hit),
                cite_hit(lane_consumer_source, set_texts_hit),
                cite_hit(lane_consumer_source, offline_hit),
                cite_hit(lane_consumer_source, checker_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-routines",
            consumer_family_node,
            routine_family_node,
            "consumer-family-to-chest-routines",
            "present",
            "direct",
            "The consumer family still preserves the token and diamond chest routine neighborhood.",
            [
                cite_hit(metadata_routine_source, start_token_hit),
                cite_hit(metadata_routine_source, token_routine_hit),
                cite_hit(metadata_routine_source, start_diamond_hit),
                cite_hit(metadata_routine_source, diamond_routine_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-getters",
            consumer_family_node,
            getter_node,
            "consumer-family-to-cell-gain-getters",
            "present",
            "direct",
            "The same internal runtime neighborhood preserves both chest cell-gain getters.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.cellGainGetterFamily", ", ".join(read_trace["cellGainGetterFamily"])),
                cite_hit(getter_source, small_getter_hit),
                cite_hit(getter_source, big_getter_hit),
            ],
        ),
        make_edge(
            "getters-to-booster-shell",
            getter_node,
            booster_node,
            "cell-gain-getters-to-booster-bonus-shell",
            "present",
            "direct",
            "Committed metadata preserves the cell-gain getters beside the booster bonus aggregation shell.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.boosterAdBonusShell", ", ".join(read_trace["boosterAdBonusShell"])),
                cite_hit(booster_source, set_booster_hit),
                cite_hit(booster_source, final_booster_getter_hit),
                cite_hit(booster_source, small_cells_hit),
                cite_hit(booster_source, big_cells_hit),
                cite_hit(booster_source, final_booster_hit),
                cite_hit(booster_source, booster_routine_hit),
            ],
        ),
        make_edge(
            "booster-shell-to-final-shell",
            booster_node,
            final_bonus_node,
            "booster-bonus-shell-to-final-chest-bonus-shell",
            "present",
            "derived",
            "The booster bonus aggregation shell remains adjacent to the final token and diamond chest bonus backing-field shell preserved in metadata.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.finalChestBonusShell", ", ".join(read_trace["finalChestBonusShell"])),
                cite_hit(final_source, final_token_bonus_hit),
                cite_hit(final_source, final_diamond_bonus_hit),
            ],
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
            missing_seam["missingJoin"],
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerReadTrace.missingExactReadSiteSeam.missingJoin", missing_seam["missingJoin"]),
                cite_hit(getter_source, small_getter_hit),
                cite_hit(getter_source, big_getter_hit),
                cite_hit(booster_source, set_booster_hit),
                cite_hit(booster_source, final_booster_getter_hit),
                cite_hit(booster_source, set_final_booster_hit),
                cite_hit(booster_source, final_booster_hit),
                cite_hit(booster_source, final_booster_field_hit),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(consumer_family_node, "consumer-family", "AdManager, Assembly-CSharp + chest support systems", "present", "The concrete chest consumer family is preserved in committed probe artifacts."),
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


def build_atu3_consumer_vs_effect_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["atu3ChestConsumerTrace"]["recoveredConsumerHandoff"]
    blocked = row_remap_boundary["atu3CrossSystemEffectTrace"]["recoveredActionEffectChain"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly after the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.ownerFieldBlock",
                    ", ".join(blocked["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The shared Cells Booster (Chests) effect lane remains preserved.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.sharedEffectTitle",
                    baseline["sharedEffectTitle"],
                )
            ],
        },
        {
            "type": "shared-effect-to-consumer-family",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves one handoff into the AdManager chest consumer family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerSystem",
                    baseline["consumerSystem"],
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-routines",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves the token and diamond chest routine family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerMethodFamily",
                    ", ".join(baseline["consumerMethodFamily"]),
                )
            ],
        },
        {
            "type": "consumer-family-to-bonus-shell",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves the final chest-bonus shell.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerBonusShell",
                    ", ".join(baseline["consumerBonusShell"]),
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-objects",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The new trace now preserves the concrete token and diamond chest objects.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.supportingChestObjects",
                    ", ".join(baseline["supportingChestObjects"]),
                )
            ],
        },
        {
            "type": "exact-cellboost-consumer-method",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The exact CellBoostBonus read or typed field handoff inside the consumer family still remains unresolved.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.missingParameterConsumerSeam.missingJoin",
                    row_remap_boundary["atu3ChestConsumerTrace"]["missingParameterConsumerSeam"]["missingJoin"],
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
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.ownerFieldBlock",
                    ", ".join(blocked["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The older effect-driven trace already preserved the shared Cells Booster (Chests) effect lane.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectTitle",
                    blocked["sharedEffectTitle"],
                )
            ],
        },
        {
            "type": "shared-effect-to-consumer-family",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace stopped at the shared effect surface and did not preserve one concrete consumer-family handoff.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-routines",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the token and diamond chest routine family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
            ],
        },
        {
            "type": "consumer-family-to-bonus-shell",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the concrete chest-bonus shell.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-objects",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the concrete chest-object handoff.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
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
            "id": "atu3-chest-consumer-handoff",
            "label": "ATU3 chest consumer handoff",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": "atu3-effect-driven-chain",
            "label": "ATU3 effect-driven chain",
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both ATU3 traces preserve the direct serialized shell-to-owner-block adjacency and the shared Cells Booster (Chests) effect lane.",
                "The new consumer-seam trace adds one checked handoff into the AdManager chest consumer family, its chest-routine neighborhood, the final chest-bonus shell, and the concrete chest objects.",
                "The remaining honest blocker is now only the exact CellBoostBonus read or typed field handoff inside that consumer family.",
            ],
        },
    }


def build_family_structure_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
    late_boundary: dict[str, Any],
) -> dict[str, Any]:
    shell_surface = find_surface(surfaces, "family-shells")
    proxy_surface = find_surface(surfaces, "bridge-proxies")
    prefab_surface = find_surface(surfaces, "prefab-roster")
    title_surface = find_surface(surfaces, "title-text-surfaces")
    unresolved_surface = find_surface(surfaces, "negative-neighborhoods")

    extract_source = find_source_entry(shell_surface, "tokenShopExtract")
    proxy_lane_source = find_source_entry(proxy_surface, "level0")
    level0_prefab_source = find_source_entry(prefab_surface, "level0")
    level0_title_source = find_source_entry(title_surface, "level0")
    unresolved_lane_source = find_source_entry(unresolved_surface, "level0")

    atu1_shell_hit = find_hit(extract_source, "ATU1Button")
    atu6_shell_hit = find_hit(extract_source, "ATU6Button")
    atu7_shell_hit = find_hit(extract_source, "ATU7Button")
    atu24_shell_hit = find_hit(extract_source, "ATU24Button")
    buy_token_hit = find_hit(proxy_lane_source, "BuyTokenBoost")
    buy_mk1_hit = find_hit(proxy_lane_source, "BuyMK1TokenBoost")
    buy_mk2_hit = find_hit(proxy_lane_source, "BuyMK2TokenBoost")
    buy_mk3_hit = find_hit(proxy_lane_source, "BuyMK3TokenBoost")
    buy_mod_hit = find_hit(proxy_lane_source, "BuyModBoost")
    buy_late_hit = find_hit(unresolved_lane_source, "BuyATU24")
    prefab_token_hit = find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.TokensBoost")
    prefab_mk2_hit = find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.MK2Booster")
    prefab_mk3_hit = find_hit(level0_prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")
    title_mk2_hit = find_hit(level0_title_source, "Mk2 Generator Booster")
    text_hook_hit = find_hit(level0_title_source, "SetAllTokenShopTexts")
    mod_title_hit = find_hit(level0_title_source, "Token Ultima: MP")
    mk1_support_hit = find_hit(level0_title_source, "1. MK1 Generator Output,")

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
                cite_hit(extract_source, atu1_shell_hit),
                cite_hit(extract_source, atu6_shell_hit),
                cite_hit(extract_source, atu7_shell_hit),
                cite_hit(extract_source, atu24_shell_hit),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.targetNeighborhood.shellFieldRange", late_boundary["targetNeighborhood"]["shellFieldRange"]),
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
                cite_row_boundary("tokenShopLateAtuBoundary", "$.titleRosterBoundary.localTitleCluster[2].title", late_boundary["titleRosterBoundary"]["localTitleCluster"][2]["title"]),
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
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CellsDisambiguationPass.groundedConclusion", row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.groundedConclusion", late_boundary["groundedConclusion"]),
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
                cite_row_boundary("tokenShopRowRemapBoundary", "$.blockedIdentityJoin.missingLinks[1]", row_remap_boundary["blockedIdentityJoin"]["missingLinks"][1]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.traceFollowUp.blockedTitleJoin.missingJoin", row_remap_boundary["traceFollowUp"]["blockedTitleJoin"]["missingJoin"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu5TitleFollowUp.blockedTitleJoin.missingJoin", row_remap_boundary["atu5TitleFollowUp"]["blockedTitleJoin"]["missingJoin"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu7BridgeFollowUp.recoveredBridge.groundedConclusion", row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]["groundedConclusion"]),
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
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CellsDisambiguationPass.groundedConclusion", row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.result", late_boundary["result"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.groundedConclusion", late_boundary["groundedConclusion"]),
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
    row_remap_boundary: dict[str, Any],
    late_boundary: dict[str, Any],
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
) -> dict[str, Any]:
    proxy_source = find_source_entry(find_surface(surfaces, "bridge-proxies"), "level0")
    prefab_source = find_source_entry(find_surface(surfaces, "prefab-roster"), "level0")
    title_source = find_source_entry(find_surface(surfaces, "title-text-surfaces"), "level0")
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
                cite_hit(proxy_source, find_hit(proxy_source, "BuyTokenBoost")),
                cite_hit(proxy_source, find_hit(proxy_source, "BuyMK1TokenBoost")),
                cite_hit(proxy_source, find_hit(proxy_source, "BuyMK2TokenBoost")),
                cite_hit(proxy_source, find_hit(proxy_source, "BuyMK3TokenBoost")),
            ],
        },
        {
            "type": "repeated-shell-to-prefab-subset",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The strongest solved subset repeatedly preserves exact prefab identities.",
            "provedBy": [
                cite_hit(prefab_source, find_hit(prefab_source, "NewTokenUPGPrefab.T1.TokensBoost")),
                cite_hit(prefab_source, find_hit(prefab_source, "NewTokenUPGPrefab.T1.MK2Booster")),
                cite_hit(prefab_source, find_hit(prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")),
            ],
        },
        {
            "type": "exact-shell-to-title-exemplar",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU6 contributes one exact shell-to-prefab-to-title exemplar.",
            "provedBy": [
                cite_hit(title_source, find_hit(title_source, "Mk2 Generator Booster")),
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
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock", ", ".join(row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]["adjacentOwnerFieldBlock"])),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.targetNeighborhood.shellFieldRange", late_boundary["targetNeighborhood"]["shellFieldRange"]),
            ],
        },
        {
            "type": "repeated-row-family-proxy-lane",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "Some unresolved neighborhoods still preserve nearby generic or late buy-hook shells.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.blockedAdjacentShell.nearestNamedActionHook", row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]["nearestNamedActionHook"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.actionNeighborhood.preservedLateHooks[0]", late_boundary["actionNeighborhood"]["preservedLateHooks"][0]),
            ],
        },
        {
            "type": "repeated-shell-to-prefab-subset",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The unresolved neighborhoods still do not preserve exact shell-to-prefab localization.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]", row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]["missingLinks"][2]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.result", late_boundary["result"]),
            ],
        },
        {
            "type": "exact-shell-to-title-exemplar",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The unresolved neighborhoods still do not preserve one exact shell-to-final-title chain.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CellsDisambiguationPass.groundedConclusion", row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.groundedConclusion", late_boundary["groundedConclusion"]),
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
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopExtract"]),
            "shellField": "ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU7Button",
            "shellPathId": "solved-subset",
            "comparisonShape": baseline_edges,
            "groundedConclusion": "The strongest solved TokenShop subset repeatedly preserves shell adjacency, one row-family proxy lane, and one exact prefab identity, with ATU6 adding one exact title-chain exemplar.",
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopLateAtuBoundary"]),
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
    primary_source_ids = unique_strings([canonicalize_primary_source_id(source_id) for source_id in surface["sourceIds"]])
    sources = [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in primary_source_ids]

    if extended_search > 0:
        for source_id in available_source_ids:
            if source_id in primary_source_ids:
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


def get_primary_surfaces_for_depth(config: dict[str, Any], depth_search: int) -> list[dict[str, Any]]:
    surfaces = list(config.get("surfaces", []))
    if depth_search <= 0:
        return surfaces
    follow_up_ids = get_follow_up_surface_ids(config)
    if not follow_up_ids:
        return surfaces
    return [surface for surface in surfaces if str(surface["id"]) not in follow_up_ids]


def collect_depth_seed_terms_for_target(
    config: dict[str, Any],
    base_seed_terms: list[str],
    depth_search: int,
) -> list[str]:
    if depth_search <= 0:
        return unique_strings(base_seed_terms)

    lookup = get_strategy_surface_lookup(config)
    seed_terms = list(base_seed_terms)
    for step in config.get("depthPlan", []):
        hop = int(step.get("hop", 0))
        if hop <= 0 or hop > depth_search:
            continue
        for surface_id in step.get("surfaceIds", []):
            surface = lookup.get(str(surface_id))
            if surface:
                seed_terms.extend(surface.get("terms", []))

    if len(seed_terms) == len(base_seed_terms):
        for surface in config.get("followUpSurfaces", []):
            seed_terms.extend(surface.get("terms", []))

    return unique_strings(seed_terms)


def collect_primary_terms_for_target(target: dict[str, Any]) -> list[str]:
    config = target.get("strategyConfig", {})
    terms: list[str] = []
    for surface in get_primary_surfaces_for_depth(config, 0):
        terms.extend(surface.get("terms", []))
    return unique_strings(terms)


def collect_primary_source_ids_for_target(target: dict[str, Any]) -> list[str]:
    config = target.get("strategyConfig", {})
    source_ids: list[str] = []
    for surface in get_primary_surfaces_for_depth(config, 0):
        source_ids.extend(str(item) for item in surface.get("sourceIds", []))
    return unique_strings(source_ids)


def collect_depth_plan_terms(
    config: dict[str, Any],
    hop_index: int,
    registry_targets: dict[str, Any] | None = None,
) -> tuple[list[str], dict[str, Any]]:
    if registry_targets is None:
        registry_targets = load_registry().get("targets", {})

    lookup = get_strategy_surface_lookup(config)
    step = next((item for item in config.get("depthPlan", []) if int(item.get("hop", -1)) == hop_index), None)
    if not step:
        return [], {"goal": None, "surfaceIds": [], "targetIds": [], "targetLabels": [], "sourceIds": []}

    planned_terms: list[str] = []
    planned_source_ids: list[str] = []
    for surface_id in step.get("surfaceIds", []):
        surface = lookup.get(str(surface_id))
        if surface:
            planned_terms.extend(surface.get("terms", []))
            planned_source_ids.extend(str(item) for item in surface.get("sourceIds", []))

    target_labels: list[str] = []
    for target_id in step.get("targetIds", []):
        handoff_target = registry_targets.get(str(target_id))
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
    config: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if depth_search <= 0:
        return []

    hops: list[dict[str, Any]] = []
    current_terms = unique_strings([*seed_terms, *collect_depth_followup_terms(base_surfaces, [])])
    seen_terms: set[str] = set()
    registry_targets = load_registry().get("targets", {}) if config and config.get("depthPlan") else None

    for hop_index in range(1, depth_search + 1):
        if not current_terms:
            break
        planned_terms, planned_step = collect_depth_plan_terms(config, hop_index, registry_targets) if config else ([], {"goal": None, "surfaceIds": [], "targetIds": [], "targetLabels": [], "sourceIds": []})
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
    config = target["strategyConfig"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in config["surfaces"]]
    provisional_payload = {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "bridgeCheck": {"bridgeHits": []},
        "traceGraph": {"nodes": [], "edges": [], "negativeEdges": [], "claimLedger": []},
    }
    row_recovery = _build_token_shop_row_recovery(target, provisional_payload, {"summary": {}}) or {}
    action_method = next(iter(row_recovery.get("recoveredActionMethods", [])), "BuyModBoost")
    prefab_identity = next(iter(row_recovery.get("prefabCandidates", [])), "NewTokenUPGPrefab.T1.ModPointsBooster")
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, config),
        "traceGraph": build_mod_trace_graph(shell_window, surfaces, row_recovery),
        "bridgePromotionRule": "Only promote a TokenShop row from live assets and native evidence when one checked shell-side owner block, one row-specific action hook, one exact prefab identity, and one recovered presentation slot graph converge on the same row family.",
        "bridgeCheck": {
            "candidateTerms": [action_method, prefab_identity],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": action_method},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": prefab_identity},
            ],
            "result": "direct asset/native row bridge recovered",
        },
        "solvedVsBlockedDiff": build_mod_vs_blocked_diff(target_id, target, shell_window, surfaces, row_recovery),
        "lostStructure": config["lostStructure"],
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a full-lane TokenShop remap promotion by itself.",
            "It now preserves one exact ATU4 shell-to-action-hook-to-prefab bridge plus one direct recovered presentation slot graph from Unity assets.",
            "Keep the recovered ATU4 row grounded as live asset/native evidence; the remaining unresolved lane is the live displayed BUY cost and its runtime multiplier path.",
        ],
    }


def build_token_shop_mk1_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in config["surfaces"]]
    trace_bridge = row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, config),
        "traceGraph": build_mk1_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only promote the traced ATU5 row past quarantine when one exact shell-to-final-title join is recovered; prefab-only and support-text-only evidence remains remap-only.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], trace_bridge["supportingActionHook"], trace_bridge["prefabIdentity"]],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": trace_bridge["supportingActionHook"]},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": trace_bridge["prefabIdentity"]},
            ],
            "result": "checked object bridge recovered",
        },
        "solvedVsBlockedDiff": build_mk1_vs_blocked_diff(target_id, target, row_remap_boundary, shell_window, surfaces),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a full-lane TokenShop remap promotion by itself.",
            "It now preserves one exact ATU5 shell-to-action-hook-to-prefab bridge in the same checked trace bundle while keeping the MK1 support-text, neighboring generator title-roster, and generic text-hook surfaces explicit.",
            "Keep the recovered ATU5 bridge quarantined to row-remap evidence until a separate final player-facing title join clears.",
        ],
    }


def build_token_shop_mk3_bridge_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in config["surfaces"]]
    trace_bridge = row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, config),
        "traceGraph": build_mk3_bridge_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only promote the traced ATU7 row as one bounded remap bridge when one checked shell-side owner block, one row-specific action hook, and one exact prefab identity converge on the same row family; do not infer any final title from this pass.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], trace_bridge["supportingActionHook"], trace_bridge["prefabIdentity"]],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": trace_bridge["supportingActionHook"]},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": trace_bridge["prefabIdentity"]},
            ],
            "result": "checked object bridge recovered",
        },
        "solvedVsBlockedDiff": build_mk3_vs_blocked_diff(target_id, target, row_remap_boundary, shell_window, surfaces),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a full-lane TokenShop remap promotion by itself.",
            "It now preserves one exact ATU7 shell-to-action-hook-to-prefab bridge in the same checked trace bundle without reopening title-side localization first.",
            "Keep the recovered ATU7 bridge bounded to row-remap evidence and leave the rest of the unresolved MK-family shells quarantined until their own exact joins clear.",
        ],
    }


def build_token_shop_atu3_effect_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    effect_surfaces = get_primary_surfaces_for_depth(config, depth_search)
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in effect_surfaces]
    depth_expansion = build_depth_expansion(
        surfaces,
        documents,
        shell_window,
        available_source_ids,
        depth_search,
        collect_depth_seed_terms_for_target(config, anchors, depth_search),
        config,
    )
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": depth_expansion,
        "traceGraph": build_atu3_effect_trace_graph(shell_window, surfaces, row_remap_boundary, depth_expansion),
        "bridgePromotionRule": "Only preserve ATU3 as an effect-driven row when one checked shell-side owner block, one exact row-family action hook, and one shared chest-effect title or text surface converge on the same cells-from-chests lane; keep typed gameplay owner claims blocked unless the applier is recovered explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], "BuyCellBoost", "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>", "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>."],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "BuyCellBoost"},
                {"surfaceId": "shared-effect-title", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>"},
                {"surfaceId": "shared-effect-text", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>."},
            ],
            "result": "checked action-to-shared-effect chain recovered",
        },
        "solvedVsBlockedDiff": build_atu3_effect_vs_split_diff(target_id, target, row_remap_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a standard prefab-or-title TokenShop remap promotion by itself.",
            "It now preserves one exact ATU3 shell-to-action-hook-to-shared-effect chain for the cells-from-chests gameplay lane while keeping the detached diamond-side and token-side identity surfaces explicit as contrast evidence.",
            "Keep the ATU3 result quarantined to effect-driven remap evidence until the exact typed gameplay owner or chest-effect applier is recovered.",
        ],
    }


def build_token_shop_atu3_chest_consumer_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in config["surfaces"]]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, config),
        "traceGraph": build_atu3_chest_consumer_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only preserve ATU3 as a consumer-seam row when one checked shared chest-effect lane, one concrete chest consumer family, one chest-routine neighborhood, and one chest-bonus shell converge on the same cells-from-chests lane; keep exact CellBoostBonus consumer-method claims blocked unless that handoff is recovered explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>", "AdManager, Assembly-CSharp", "<TokenChestRoutine>d__149", "<FinalDiamondChestBonus>k__BackingField"],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "shared-effect-title", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>"},
                {"surfaceId": "consumer-family", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "AdManager, Assembly-CSharp"},
                {"surfaceId": "consumer-routines", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "<TokenChestRoutine>d__149"},
                {"surfaceId": "consumer-routines", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "<FinalDiamondChestBonus>k__BackingField"},
            ],
            "result": "checked shared-effect-to-consumer-family handoff recovered",
        },
        "solvedVsBlockedDiff": build_atu3_consumer_vs_effect_diff(target_id, target, row_remap_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven cross-system trace workflow, not a standard prefab-or-title TokenShop remap promotion by itself.",
            "It now preserves one exact ATU3 shared-effect-to-consumer-family handoff into the AdManager chest routine neighborhood while keeping the exact CellBoostBonus read or typed field handoff explicit as the only remaining break.",
            "Keep the ATU3 result quarantined to effect-driven remap evidence until one committed source recovers the exact CellBoostBonus consumer method or typed field handoff.",
        ],
    }


def build_atu3_consumer_read_vs_consumer_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["atu3ChestConsumerReadTrace"]["recoveredInternalReadShell"]
    blocked = row_remap_boundary["atu3ChestConsumerTrace"]["recoveredConsumerHandoff"]
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
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": "ATU3 chest consumer seam",
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
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
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = [build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search) for surface in config["surfaces"]]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, config),
        "traceGraph": build_atu3_chest_consumer_read_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only preserve ATU3 as a consumer-internal read trace when one checked chest consumer family, one chest routine neighborhood, one cell-gain getter shell, and one booster bonus aggregation shell converge on the same cells-from-chests lane; keep the exact CellBoostBonus runtime read blocked unless that handoff is recovered explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], "AdManager, Assembly-CSharp", "get_SmallAdCellGains", "SetBoosterAdBonus", "get_FinalBoosterAdBonus"],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "consumer-family", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "AdManager, Assembly-CSharp"},
                {"surfaceId": "cell-gain-getters", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "get_SmallAdCellGains"},
                {"surfaceId": "booster-bonus-shell", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "SetBoosterAdBonus"},
                {"surfaceId": "booster-bonus-shell", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "get_FinalBoosterAdBonus"},
            ],
            "result": "checked consumer-internal bonus shell recovered",
        },
        "solvedVsBlockedDiff": build_atu3_consumer_read_vs_consumer_diff(target_id, target, row_remap_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven cross-system trace workflow, not a standard prefab-or-title TokenShop remap promotion by itself.",
            "It now preserves one exact ATU3 consumer-internal bonus shell inside the AdManager chest consumer family while also closing the checked outer chest routines, final token-or-diamond chest bonus backing fields, remaining getter-or-booster aggregation family, and FinalBoosterAdBonus setter-or-backing-field surfaces as a bounded negative result for one exact CellBoostBonus handoff.",
            "Keep the ATU3 result quarantined to effect-chain completion evidence and do not reopen this closed AdManager bonus-aggregation cluster unless a new committed artifact lands.",
        ],
    }


def build_token_shop_family_structure_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    late_boundary = documents["tokenShopLateAtuBoundary"]
    surfaces = []
    shell_window = {
        "source": get_source_reference("tokenShopExtract"),
        "shellField": config["shellField"],
        "shellPathId": config["shellPathId"],
        "shellObjectOffset": None,
        "ownerFieldBlock": [
            "TokenBoost / DiamondBoost / ModBoost / MK1TokenBoost / MK2TokenBoost solved-row windows",
            "ATU3 cells-domain split window",
            "ATU24Button through ATU28Button late shell neighborhood",
        ],
        "window": [
            {"field": "ATU1Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]["shellPathId"]},
            {"field": "ATU2Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["recoveredBridge"]["shellPathId"]},
            {"field": "ATU4Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["traceFollowUp"]["recoveredBridge"]["shellPathId"]},
            {"field": "ATU5Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]["shellPathId"]},
            {"field": "ATU6Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["verifiedTitleJoin"]["shellPathId"]},
            {"field": "ATU3Button", "group": "blocked-shell", "kind": "pointer", "pathId": row_remap_boundary["atu3CellsDisambiguationPass"]["shellPathId"]},
            {"field": "ATU24Button through ATU28Button", "group": "blocked-shell", "kind": "range", "pathId": late_boundary["targetNeighborhood"]["shellFieldRange"]},
        ],
    }
    for surface in config["surfaces"]:
        surfaces.append(build_surface_bundle(surface, anchors, documents, shell_window, available_source_ids, extended_search))

    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "depthExpansion": build_depth_expansion(surfaces, documents, shell_window, available_source_ids, depth_search, anchors, config),
        "traceGraph": build_family_structure_graph(shell_window, surfaces, row_remap_boundary, late_boundary),
        "bridgePromotionRule": "This target is a bounded family audit only. Do not promote any new TokenShop row remaps, planner behavior, or player-facing labels from it.",
        "bridgeCheck": {
            "candidateTerms": [
                "ATU1Button",
                "ATU2Button",
                "ATU4Button",
                "ATU5Button",
                "ATU6Button",
                "ATU3Button",
                "ATU24Button",
            ],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "bridge-proxies", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "BuyTokenBoost"},
                {"surfaceId": "bridge-proxies", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "BuyMK1TokenBoost"},
                {"surfaceId": "prefab-roster", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "NewTokenUPGPrefab.T1.MK2Booster"},
                {"surfaceId": "title-text-surfaces", "sourcePath": repo_relative(ALL_SOURCE_PATHS["level0"]), "term": "Mk2 Generator Booster"},
            ],
            "result": "checked family structure audit recovered",
        },
        "solvedVsBlockedDiff": build_family_structure_diff(target_id, target, row_remap_boundary, late_boundary, shell_window, surfaces),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a bounded TokenShop family structure audit, not a remap promotion pass.",
            "The audit groups the solved ATU1, ATU2, ATU4, ATU5, ATU6, and ATU7 shells alongside the bounded ATU3 and late ATU24-ATU28 negatives so repeated joins and repeated gaps can be compared in one checked bundle.",
            "Do not infer new row identity from row order, loose title-roster similarity, generic text hooks, or this audit alone.",
        ],
    }


def build_shard_cost_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    native_probe = documents["shardCostNativeProbe"]
    formula_model = documents["shardCostFormulaModel"]
    save_owner_candidates = documents["shardMilestoneSaveOwnerCandidates"]
    metadata_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs([config["ownerType"], config["accessor"], *config["parameterShell"], "GetShardCostList", "UpdateShardCostList", "MilestoneCostList", *anchors], "surface-search"),
    )
    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["metadata"]),
        "shellField": config["accessor"],
        "shellPathId": "runtime-getter",
        "shellObjectOffset": None,
        "ownerFieldBlock": config["parameterShell"],
        "window": [{"field": field, "group": "row0-parameter-shell", "kind": "field"} for field in config["parameterShell"]],
    }
    surfaces = [
        {
            "id": "cost-model-boundary",
            "label": "Shard cost-model boundary",
            "terms": anchors,
            "sources": [
                metadata_source
            ],
        },
        {
            "id": "native-getter",
            "label": "Shard native getter probe",
            "terms": [config["accessor"], *config["parameterShell"][:3]],
            "sources": [
                make_surface_source(
                    "shardCostNativeProbe",
                    [
                        make_surface_hit(config["accessor"], "$.rows[0].name"),
                        *[make_surface_hit(field, "$.rows[0].operandFieldNames") for field in native_probe["rows"][0]["operandFieldNames"]],
                    ],
                )
            ],
        },
        {
            "id": "formula-model",
            "label": "Shard formula model",
            "terms": ["GetShardCostList", "UpdateShardCostList", "MilestoneCostList"],
            "sources": [
                make_surface_source(
                    "shardCostFormulaModel",
                    [
                        make_surface_hit("GetShardCostList", "$.runtimeGetterRules.cacheLifecycle.listBuilderMethod"),
                        make_surface_hit("UpdateShardCostList", "$.runtimeGetterRules.cacheLifecycle.refreshMethod"),
                        make_surface_hit("MilestoneCostList", "$.runtimeGetterRules.cacheLifecycle.cacheField"),
                    ],
                )
            ],
        },
    ]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": {
            "nodes": [
                make_node("shard-owner", "owner-type", config["ownerType"], "present", "ShardUpgradeInfo remains the checked shard-local data carrier."),
                make_node("shard-getter", "getter", config["accessor"], "present", "The row0 shard cost accessor is preserved in committed structure probes."),
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
                    "native-parameter-read",
                    "present",
                    "direct",
                    "The native getter probe directly reads SU0StartCost, SU0CostExponent, and SU0GrowthExponent from the row0 getter body.",
                    [cite_row_boundary("shardCostNativeProbe", "$.rows[0].operandFieldNames", ", ".join(native_probe["rows"][0]["operandFieldNames"]))],
                ),
                make_edge(
                    "shard-parameter-shell-to-evaluator",
                    "shard-parameter-shell",
                    "shard-evaluator",
                    "deterministic-evaluator",
                    "present",
                    "supporting",
                    "The canonical shard-cost formula model and deterministic evaluator preserve the same getter family as a checked structural model.",
                    [
                        cite_row_boundary("shardCostFormulaModel", "$.completionFlags.canonicalDatasetShipped", str(formula_model["completionFlags"]["canonicalDatasetShipped"])),
                        cite_row_boundary("shardCostFormulaModel", "$.completionFlags.deterministicEvaluatorImplemented", str(formula_model["completionFlags"]["deterministicEvaluatorImplemented"])),
                    ],
                ),
            ],
            "negativeEdges": [
                make_edge("shard-missing-calibration", "shard-evaluator", "shard-evaluator", "automated-calibration-closure", "missing", "negative", "Automated calibration is not yet implemented, so the structural evaluator is not calibration-closed.", [cite_row_boundary("shardCostFormulaModel", "$.completionFlags.automatedCalibrationImplemented", str(formula_model["completionFlags"]["automatedCalibrationImplemented"]))]),
                make_edge("shard-missing-planner-safe-output", "shard-evaluator", "shard-evaluator", "planner-safe-cost-output", "missing", "negative", "Planner-safe shard cost output is still explicitly unapproved.", [cite_row_boundary("shardCostFormulaModel", "$.completionFlags.plannerSafeCostOutputApproved", str(formula_model["completionFlags"]["plannerSafeCostOutputApproved"]))]),
                make_edge("shard-missing-save-owner", "shard-owner", "shard-evaluator", "save-owner-recovery", "missing", "negative", "Shard save-owner recovery is still unresolved and must stay separate from the structural cost model.", [cite_row_boundary("shardMilestoneSaveOwnerCandidates", "$.warnings[0]", save_owner_candidates["warnings"][0])]),
            ],
            "claimLedger": [],
        },
        "bridgePromotionRule": "Only promote shard cost output past descriptive quarantine when calibration closure, planner-safe approval, and save-owner boundaries are all checked explicitly.",
        "bridgeCheck": {
            "candidateTerms": config["parameterShell"],
            "bridgeCleared": True,
            "bridgeHits": [{"surfaceId": "native-getter", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostNativeProbe"]), "term": config["accessor"]}],
            "result": "checked getter-to-parameter-shell structure recovered",
        },
        "solvedVsBlockedDiff": {
            "baseline": {"id": "shard-cost-su0-structure", "label": "Shard SU0 structural baseline", "status": "cleared", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostFormulaModel"]), "shellField": config["accessor"], "shellPathId": "runtime-getter", "comparisonShape": [{"type": "getter-family", "status": "present"}, {"type": "getter-to-parameter-shell", "status": "present"}, {"type": "native-parameter-read", "status": "present"}, {"type": "deterministic-evaluator", "status": "present"}], "groundedConclusion": "The shard SU0 getter-to-parameter-shell structure is grounded enough to preserve as a quarantined structural baseline."},
            "blockedTarget": {"id": "shard-cost-planner-safe-output", "label": "Shard planner-safe cost output", "status": "blocked", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostFormulaModel"]), "shellField": config["accessor"], "shellPathId": "planner-output", "comparisonShape": [{"type": "automated-calibration-closure", "status": "missing"}, {"type": "planner-safe-cost-output", "status": "missing"}, {"type": "save-owner-recovery", "status": "missing"}], "groundedConclusion": "The shard planner-safe output target remains blocked by calibration, approval, and save-owner recovery."},
            "delta": {
                "sharedPresentEdgeTypes": ["getter-family", "getter-to-parameter-shell", "native-parameter-read"],
                "baselineOnlyPresentEdgeTypes": ["deterministic-evaluator"],
                "blockedMissingEdgeTypes": ["automated-calibration-closure", "planner-safe-cost-output", "save-owner-recovery"],
                "solvedVsBlockedSummary": [
                    "The solved shard baseline preserves one direct getter-family, parameter-shell, and native-field-read chain.",
                    "The same family also preserves one deterministic evaluator structure model.",
                    "Planner-safe output stays blocked because calibration, approval, and save-owner recovery are still explicitly negative.",
                ],
            },
        },
        "lostStructure": [
            "Exact per-level shard costs remain unresolved.",
            "Planner-safe shard ranking, ROI, and affordability output remains blocked.",
            save_owner_candidates["warnings"][0],
        ],
        "groundedConclusion": "The shard SU0 cost trace is structurally grounded. The repo preserves one checked getter-to-parameter-shell chain and one deterministic evaluator structure, but calibration closure, planner-safe cost output, and save-owner recovery all remain blocked.",
        "currentBoundary": [
            "This target preserves shard-cost structure only.",
            "It is appropriate for descriptive or quarantined structural reads, not planner-safe cost output or save-owner promotion.",
            "Keep shard cost structure separated from shard save-owner recovery until direct save-side evidence appears.",
        ],
    }


def build_shard_owned_state_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str]) -> dict[str, Any]:
    config = target["strategyConfig"]
    save_boundary = documents["shardSaveBoundary"]
    save_owner_candidates = documents["shardMilestoneSaveOwnerCandidates"]

    recovered_runtime_shell = save_boundary["recoveredDeclaringRowModel"]
    row_state_fields = [field["name"] for field in recovered_runtime_shell["rowStateFields"]]
    owner_list_fields = ["MaxedMilestonesList", "UnlockedMilestonesList", "MilestoneCostList", "upgradeInfoList"]
    metadata_anchor_specs = build_anchor_specs(
        unique_strings(
            [
                config["sceneOwner"],
                "ShardMining+ShardUpgradeInfo",
                recovered_runtime_shell["declaringField"]["name"],
                *row_state_fields,
                *owner_list_fields,
                *anchors,
            ]
        ),
        "surface-search",
    )
    metadata_runtime_source = collect_source_hits(documents, "metadata", metadata_anchor_specs)
    local_hooks_checked = list(save_boundary["runtimeConstructionBoundary"]["localHooksChecked"])
    metadata_watcher_source = collect_source_hits(
        documents,
        "metadata",
        build_anchor_specs([*local_hooks_checked, *owner_list_fields, *anchors], "surface-search"),
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
    shard_scene_path_id = save_boundary["recoveredDirectRowDefinitionPayload"]["sceneObject"]["pathId"]

    local_bridge_recovered = save_boundary["probeResults"].get("runtimePopulationLocalProducerRecovered") is True
    wrapper_handoff_recovered = save_boundary["probeResults"].get("saveSideOwnerRecovered") is True
    if local_bridge_recovered:
        outcome_kind = "local-runtime-population-bridge"
        outcome_label = "Local runtime population bridge"
        outcome_summary = (
            "The trace now preserves one shard-local construction bridge that populates upgradeInfoList owned-state values directly."
        )
        outcome_node_label = "Local ShardMining population bridge"
        outcome_statement = (
            "Committed shard boundary evidence now preserves one local ShardMining-side producer that fills upgradeInfoList owned-state values."
        )
        outcome_citations = [
            cite_row_boundary(
                "shardSaveBoundary",
                "$.runtimeConstructionBoundary.traceResult",
                save_boundary["runtimeConstructionBoundary"]["traceResult"][1],
            )
        ]
        bridge_result = "checked local runtime population bridge recovered"
    elif wrapper_handoff_recovered:
        outcome_kind = "deeper-wrapper-handoff"
        outcome_label = "Deeper wrapper handoff"
        outcome_summary = (
            "The trace now preserves a deeper save-side wrapper handoff for player-owned shard row state even though it does not stop on a local ShardMining producer."
        )
        outcome_node_label = "Recovered deeper save-side wrapper"
        outcome_statement = (
            "Committed shard boundary evidence now preserves one deeper wrapper handoff for player-owned shard row state behind upgradeInfoList."
        )
        outcome_citations = [
            cite_row_boundary(
                "shardMilestoneSaveOwnerCandidates",
                "$.currentBoundary",
                save_owner_candidates["currentBoundary"][0],
            )
        ]
        bridge_result = "checked deeper wrapper handoff recovered"
    else:
        outcome_kind = "non-local-injection-seam"
        outcome_label = "Non-local injection seam"
        outcome_summary = (
            "The trace rules out a local upgradeInfoList population bridge and still cannot name a deeper wrapper handoff, so owned-state values remain bounded as a non-local injection seam."
        )
        outcome_node_label = "Non-local save-side injection seam"
        outcome_statement = (
            "The committed shard boundary set now narrows the owned-state path to a non-local seam: direct definitions and the runtime shell are recovered locally, but owned-state values still arrive from a source the repo cannot yet name."
        )
        outcome_citations = [
            cite_row_boundary(
                "shardSaveBoundary",
                "$.currentBoundary[2]",
                save_boundary["currentBoundary"][2],
            ),
            cite_row_boundary(
                "shardMilestoneSaveOwnerCandidates",
                "$.confidenceNotes[1]",
                save_owner_candidates["confidenceNotes"][1],
            ),
        ]
        bridge_result = "checked non-local injection seam preserved"

    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["metadata"]),
        "shellField": recovered_runtime_shell["declaringField"]["name"],
        "shellPathId": recovered_runtime_shell["declaringField"]["fieldOffset"],
        "shellObjectOffset": shard_scene_path_id,
        "ownerFieldBlock": row_state_fields,
        "window": [
            {"field": recovered_runtime_shell["declaringField"]["name"], "group": "runtime-shell", "kind": "field", "value": recovered_runtime_shell["declaringField"]["type"]},
            *[
                {"field": field["name"], "group": "runtime-row-state", "kind": "field", "value": field["type"]}
                for field in recovered_runtime_shell["rowStateFields"]
            ],
        ],
    }

    surfaces = [
        {
            "id": "scene-owner",
            "label": "Direct scene owner",
            "terms": [config["sceneOwner"], config["runtimeShell"], *anchors],
            "sources": [
                level0_scene_source,
                metadata_runtime_source,
            ],
        },
        {
            "id": "runtime-shell",
            "label": "upgradeInfoList runtime shell",
            "terms": [config["runtimeShell"], *row_state_fields, *anchors],
            "sources": [
                metadata_runtime_source,
            ],
        },
        {
            "id": "owner-list-watchers",
            "label": "Shard-local watcher and list shells",
            "terms": [*local_hooks_checked, *owner_list_fields, *anchors],
            "sources": [
                metadata_watcher_source,
            ],
        },
        {
            "id": "handoff-boundary",
            "label": "Controller versus wrapper handoff boundary",
            "terms": [config["genericLead"], "ConstructionMilestones", *anchors],
            "sources": [
                metadata_handoff_source
            ],
        },
        {
            "id": "save-gap",
            "label": "Save-side blocker",
            "terms": [config["saveCandidate"], "PlayerProfileData", "CloudSavePlayerProfile", *anchors],
            "sources": [
                make_surface_source(
                    "shardMilestoneSaveOwnerCandidates",
                    [
                        make_surface_hit(
                            save_owner_candidates["remainingSaveOwnerCandidates"][0]["label"],
                            "$.remainingSaveOwnerCandidates[0].label",
                        ),
                        make_surface_hit("PlayerProfileData", "$.remainingSaveOwnerCandidates[0].candidateFieldClusters"),
                        make_surface_hit("CloudSavePlayerProfile", "$.remainingSaveOwnerCandidates[0].candidateFieldClusters"),
                    ],
                ),
                make_surface_source(
                    "shardSaveBoundary",
                    [
                        make_surface_hit("PlayerProfileData", "$.saveFamilyTermsChecked"),
                        make_surface_hit("CloudSavePlayerProfile", "$.saveFamilyTermsChecked"),
                    ],
                ),
            ],
        },
    ]
    for surface in surfaces:
        surface["anchorSpecs"] = build_anchor_specs(surface["terms"], "surface-search")

    trace_graph = {
        "nodes": [
            make_node("shard-scene-owner", "scene-owner", f"{config['sceneOwner']} path_id {shard_scene_path_id}", "present", "The direct level0 ShardMining MonoBehaviour object is preserved."),
            make_node("shard-definition-family", "definition-payload", "Direct ShardMining SU0-29 definition payload", "present", "The reachable row-definition family is preserved directly on the ShardMining scene object."),
            make_node("shard-runtime-shell", "runtime-shell", config["runtimeShell"], "present", "The owned-state shell is preserved as upgradeInfoList -> ShardMining+ShardUpgradeInfo."),
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
                    cite_row_boundary("shardSaveBoundary", "$.recoveredDirectRowDefinitionPayload.sceneObject.pathId", str(shard_scene_path_id)),
                    cite_row_boundary("shardSaveBoundary", "$.recoveredDirectRowDefinitionPayload.ownerType", save_boundary["recoveredDirectRowDefinitionPayload"]["ownerType"]),
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
                        maybe_cite_hit(metadata_runtime_source, maybe_find_hit(metadata_runtime_source, recovered_runtime_shell["declaringField"]["name"])),
                    ),
                    cite_row_boundary("shardSaveBoundary", "$.recoveredDeclaringRowModel.rowModelType.fullName", recovered_runtime_shell["rowModelType"]["fullName"]),
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
                    cite_row_boundary(
                        "shardSaveBoundary",
                        "$.runtimeConstructionBoundary.traceResult[1]",
                        save_boundary["runtimeConstructionBoundary"]["traceResult"][1],
                    ),
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
                "The repo still does not recover an exact deeper wrapper or save-side owner behind upgradeInfoList even though a PlayerProfile-side shard member shell remains the leading unresolved candidate.",
                [
                    cite_row_boundary(
                        "shardMilestoneSaveOwnerCandidates",
                        "$.remainingSaveOwnerCandidates[0].label",
                        save_owner_candidates["remainingSaveOwnerCandidates"][0]["label"],
                    ),
                    cite_row_boundary(
                        "shardMilestoneSaveOwnerCandidates",
                        "$.currentBoundary[0]",
                        save_owner_candidates["currentBoundary"][0],
                    ),
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

    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": trace_graph,
        "outcome": {
            "kind": outcome_kind,
            "label": outcome_label,
            "summary": outcome_summary,
        },
        "bridgePromotionRule": "Only promote player-owned shard state past descriptive quarantine when one exact local population bridge or deeper save-side wrapper handoff is recovered explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["runtimeShell"], *row_state_fields, *local_hooks_checked[:4]],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "runtime-shell", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": recovered_runtime_shell["declaringField"]["name"]},
                {"surfaceId": "owner-list-watchers", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": local_hooks_checked[0]},
                {"surfaceId": "save-gap", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardMilestoneSaveOwnerCandidates"]), "term": save_owner_candidates["remainingSaveOwnerCandidates"][0]["label"]},
            ],
            "result": bridge_result,
        },
        "solvedVsBlockedDiff": {
            "baseline": {
                "id": "shard-owned-state-upgradeinfolist-population",
                "label": "Shard owned-state population boundary",
                "status": "cleared",
                "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardSaveBoundary"]),
                "shellField": recovered_runtime_shell["declaringField"]["name"],
                "shellPathId": recovered_runtime_shell["declaringField"]["fieldOffset"],
                "comparisonShape": comparison_shape,
                "groundedConclusion": outcome_summary,
            },
            "blockedTarget": {
                "id": "shard-owned-state-local-bridge",
                "label": "Shard local owned-state producer",
                "status": "blocked",
                "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]),
                "shellField": recovered_runtime_shell["declaringField"]["name"],
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
        "lostStructure": [
            "Shard-local watcher hooks still sit beside upgradeInfoList, UnlockedMilestonesList, MaxedMilestonesList, and MilestoneCostList without one committed write path into IsUnlocked, MaxLevel, or current milestone progress.",
            "The leading PlayerProfile-side shard member shell remains an unresolved candidate rather than a recovered declaring wrapper or serialized payload owner.",
            "Keep the owned-state result quarantined to blocker evidence only; it does not reopen planner math, affordability, ROI, ETA, or canonical state.playerProfile promotion.",
        ],
        "groundedConclusion": outcome_summary,
        "currentBoundary": [
            "This target preserves the shard owned-state population boundary only.",
            "It keeps direct ShardMining row definitions, the recovered upgradeInfoList runtime shell, and local watcher/list clusters visible in one trace bundle without promoting them into a recovered import path.",
            "Treat the result as blocker evidence for player-owned shard state, not as planner-safe state, canonical import, or row-package verification.",
        ],
    }


def build_multiverse_market_save_owner_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    member_boundary = documents["multiverseMarketMemberBoundary"]
    import_boundary = documents["multiverseMarketSaveDataImportBoundary"]
    range_boundary = documents["multiverseMarketRangeBoundary"]
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
        build_anchor_specs(["SetIS71CostText", "IS71Level", "IS72Level", *anchors], "surface-search"),
    )
    level0_accessor_source = collect_source_hits(
        documents,
        "level0",
        build_anchor_specs(["PlayerProfileHandler", "MultiverseMarket", config["saveOwner"], "InscryptionsDone", *anchors], "surface-search"),
    )
    level0_action_source = collect_source_hits(
        documents,
        "level0",
        build_anchor_specs(["BuyIS71", "MultiverseMarket", config["saveOwner"], *anchors], "surface-search"),
    )
    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["metadata"]),
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
    surfaces = [
        {
            "id": "accessor-bridge",
            "label": "Accessor bridge",
            "terms": anchors,
            "sources": [
                metadata_accessor_source,
                level0_accessor_source,
            ],
        },
        {
            "id": "save-owner-span",
            "label": "SaveData owner span",
            "terms": [config["saveOwner"], "IS1Level", "IS110Level", "InscryptionsDone", "compatibility.unmappedSystemState.multiverseMarket"],
            "sources": [
                metadata_owner_source,
                make_surface_source(
                    "multiverseMarketSaveDataImportBoundary",
                    [
                        make_surface_hit(config["saveOwner"], "$.typedSpanBoundary.declaringOwner"),
                        make_surface_hit("compatibility.unmappedSystemState.multiverseMarket", "$.boundedImportConclusion.importTargetPath"),
                    ],
                )
            ],
        },
        {
            "id": "ordered-overlap",
            "label": "Ordered overlap",
            "terms": [str(item) for item in config["orderedOverlap"]],
            "sources": [
                make_surface_source("multiverseMarketRangeBoundary", [make_surface_hit(str(item), "$.overlapIds") for item in range_boundary["overlapIds"]]),
                metadata_ordered_source,
                level0_action_source,
            ],
        },
    ]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": {
            "nodes": [
                make_node("market-accessor", "accessor-bridge", config["accessorBridge"], "present", "The checked PlayerProfileHandler.get_Market accessor bridge is preserved."),
                make_node("market-owner", "declaring-owner", config["saveOwner"], "present", "SaveData remains the exact checked wider owner."),
                make_node("market-span", "typed-span", config["typedSpan"], "present", "The exact contiguous IS1Level through IS110Level span is preserved."),
                make_node("market-import", "compatibility-import", "compatibility.unmappedSystemState.multiverseMarket", "present", "The compatibility-only import target is preserved."),
            ],
            "edges": [
                make_edge("market-accessor-to-owner", "market-accessor", "market-owner", "accessor-bridge", "present", "direct", "Metadata and level0 preserve the get_Market accessor bridge, its MultiverseMarket return type, and the wider SaveData ownership boundary.", [cite_hit(metadata_accessor_source, find_hit(metadata_accessor_source, "PlayerProfileHandler")), cite_hit(metadata_accessor_source, find_hit(metadata_accessor_source, "get_Market")), cite_hit(metadata_accessor_source, find_hit(metadata_accessor_source, "MultiverseMarket")), cite_hit(metadata_owner_source, find_hit(metadata_owner_source, config["saveOwner"]))]),
                make_edge("market-owner-to-span", "market-owner", "market-span", "typed-save-owner", "present", "direct", "Metadata directly preserves the SaveData-owned Emporium span from IS1Level through IS110Level beside InscryptionsDone.", [cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "IS1Level")), cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "IS110Level")), cite_hit(metadata_owner_source, find_hit(metadata_owner_source, "InscryptionsDone"))]),
                make_edge("market-span-to-import", "market-span", "market-import", "compatibility-import-span", "present", "supporting", "The exact IS span is preserved as compatibility-only raw Emporium truth, not canonical PlayerProfile import.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.boundedImportConclusion.importTargetPath", import_boundary["boundedImportConclusion"]["importTargetPath"])]),
                make_edge("market-overlap-support", "market-span", "market-import", "ordered-row-overlap", "present", "supporting", "Rows 71-74 still anchor the wider IS span to checked Emporium ordering plus the surviving SetIS71CostText and BuyIS71 row-side surfaces.", [cite_row_boundary("multiverseMarketRangeBoundary", "$.overlapIds", ", ".join(str(item) for item in range_boundary["overlapIds"])), cite_hit(metadata_ordered_source, find_hit(metadata_ordered_source, "SetIS71CostText")), cite_hit(level0_action_source, find_hit(level0_action_source, "BuyIS71"))]),
            ],
            "negativeEdges": [
                make_edge("market-missing-typed-market-field", "market-accessor", "market-owner", "typed-market-field-recovery", "missing", "negative", "No typed Market or MultiverseMarket field is recovered directly on PlayerProfileHandler, PlayerProfileData, or SaveData.", [cite_row_boundary("multiverseMarketMemberBoundary", "$.negativeTypedSaveDataMarketChecks", ", ".join(member_boundary["negativeTypedSaveDataMarketChecks"]))]),
                make_edge("market-missing-canonical-import", "market-span", "market-import", "canonical-import-admissibility", "missing", "negative", "Canonical import remains explicitly empty even though the compatibility-only import target is preserved.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.boundedImportConclusion.exactCanonicalImportSafeSubsetLabel", import_boundary["boundedImportConclusion"]["exactCanonicalImportSafeSubsetLabel"])]),
                make_edge("market-missing-broad-row-remap", "market-span", "market-import", "broad-row-identity-remap", "missing", "negative", "Broader row identity or remap stays blocked outside the checked 71-74 ordered overlap.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.checkedIsToRowOrderBoundary.blockedWiderMapping[0]", import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][0])]),
            ],
            "claimLedger": [],
        },
        "bridgePromotionRule": "Only promote the Emporium save-owner boundary past compatibility quarantine when canonical import admissibility and broader row identity are both checked explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["accessorBridge"], config["saveOwner"], config["typedSpan"]],
            "bridgeCleared": True,
            "bridgeHits": [{"surfaceId": "accessor-bridge", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "get_Market"}],
            "result": "checked accessor-to-save-owner boundary recovered",
        },
        "solvedVsBlockedDiff": {
            "baseline": {"id": "multiverse-market-save-owner-boundary", "label": "Emporium save-owner boundary", "status": "cleared", "sourcePath": repo_relative(ALL_SOURCE_PATHS["multiverseMarketSaveDataImportBoundary"]), "shellField": config["accessorBridge"], "shellPathId": "typed-accessor", "comparisonShape": [{"type": "accessor-bridge", "status": "present"}, {"type": "typed-save-owner", "status": "present"}, {"type": "compatibility-import-span", "status": "present"}], "groundedConclusion": "The Emporium accessor-to-SaveData owner boundary is grounded enough to preserve as compatibility-only truth."},
            "blockedTarget": {"id": "multiverse-market-canonical-import", "label": "Emporium canonical import", "status": "blocked", "sourcePath": repo_relative(ALL_SOURCE_PATHS["multiverseMarketSaveDataImportBoundary"]), "shellField": config["saveOwner"], "shellPathId": "canonical-import", "comparisonShape": [{"type": "typed-market-field-recovery", "status": "missing"}, {"type": "canonical-import-admissibility", "status": "missing"}, {"type": "broad-row-identity-remap", "status": "missing"}], "groundedConclusion": "Canonical import remains blocked even though the wider save-owner boundary is grounded."},
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
        },
        "lostStructure": [import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][0], import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][1], import_boundary["boundedImportConclusion"]["blockedBy"][2]],
        "groundedConclusion": "The multiverse-market save-owner trace is grounded enough to preserve a checked accessor-to-SaveData owner boundary and a compatibility-only IS1Level through IS110Level span, but canonical import and broader row identity remain blocked.",
        "currentBoundary": [
            "This target preserves save-owner and compatibility-import truth only.",
            "Do not promote canonical PlayerProfile import, planner behavior, or row remap claims from this target alone.",
            "Keep the checked accessor bridge, exact SaveData owner, and bounded compatibility-only import span separate from downstream row identity or planner work.",
        ],
    }


def build_trace_payload(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any], available_source_ids: list[str], extended_search: int, depth_search: int) -> dict[str, Any]:
    strategy = target["strategy"]
    if strategy == "token-shop-atu4-mod":
        return build_token_shop_mod_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if strategy == "token-shop-atu5-mk1-title":
        return build_token_shop_mk1_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if strategy == "token-shop-atu7-mk3-bridge":
        return build_token_shop_mk3_bridge_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if strategy == "token-shop-atu3-cells-effect":
        return build_token_shop_atu3_effect_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if strategy == "token-shop-atu3-chest-consumer":
        return build_token_shop_atu3_chest_consumer_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if strategy == "token-shop-atu3-chest-consumer-read":
        return build_token_shop_atu3_chest_consumer_read_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if strategy == "token-shop-family-structure":
        return build_token_shop_family_structure_trace(target_id, target, anchors, documents, available_source_ids, extended_search, depth_search)
    if strategy == "shard-cost-su0-structure":
        return build_shard_cost_trace(target, anchors, documents)
    if strategy == "shard-owned-state-upgradeinfolist-population":
        return build_shard_owned_state_trace(target, anchors, documents, available_source_ids)
    if strategy == "multiverse-market-save-owner-boundary":
        return build_multiverse_market_save_owner_trace(target, anchors, documents)
    raise ValueError(f"Unsupported unity trace strategy: {strategy}")


def build_decision_summary(target: dict[str, Any], trace_payload: dict[str, Any], native_summary: dict[str, Any] | None = None) -> dict[str, Any]:
    if "outputSummaryRules" not in target:
        native_note = ""
        promoted_owner = _select_promoted_native_owner(target, trace_payload, native_summary)
        if promoted_owner and native_summary:
            native_note = " Reconstructed native owner candidates: {}.".format(
                ", ".join([promoted_owner["owner"], *native_summary.get("reconstructedOwners", [])][:3])
            )
        return {
            "verdict": "explore",
            "summary": "This run is exploratory only. Use the surviving source hits to choose or define a bounded family trace.{}".format(native_note),
            "provedEdgeCount": len(trace_payload["traceGraph"]["edges"]),
            "negativeEdgeCount": len(trace_payload["traceGraph"]["negativeEdges"]),
            "baselineGap": [],
            "supportingEdgeTypes": [edge["type"] for edge in trace_payload["traceGraph"]["edges"]],
            "blockedEdgeTypes": [edge["type"] for edge in trace_payload["traceGraph"]["negativeEdges"]],
        }
    proved_edges = list(trace_payload["traceGraph"]["edges"])
    negative_edges = list(trace_payload["traceGraph"]["negativeEdges"])
    diff = trace_payload["solvedVsBlockedDiff"]["delta"]
    rules = target["outputSummaryRules"]
    negative_types = [edge["type"] for edge in negative_edges]
    wire = rules["wire"]
    quarantine = rules["quarantine"]
    if len(proved_edges) >= int(wire["minPresentEdges"]) and len(negative_edges) <= int(wire["maxNegativeEdges"]):
        verdict = "wire"
    elif len(proved_edges) >= int(quarantine["minPresentEdges"]) and all(edge_type in quarantine["allowedNegativeEdgeTypes"] for edge_type in negative_types):
        verdict = "quarantine"
    else:
        verdict = "keep researching"
    summary = rules["messages"]["research" if verdict == "keep researching" else verdict]
    promoted_owner = _select_promoted_native_owner(target, trace_payload, native_summary)
    if promoted_owner:
        top_owner = promoted_owner["owner"]
        reconstructed_methods = promoted_owner.get("methods", [])
        reconstructed_fields = promoted_owner.get("fields", [])
        chain_bits = []
        if reconstructed_methods:
            chain_bits.append("methods {}".format(", ".join(reconstructed_methods[:3])))
        if reconstructed_fields:
            chain_bits.append("fields {}".format(", ".join(reconstructed_fields[:4])))
        if chain_bits:
            summary = "{} Native reconstruction now ties this lane to {} via {}.".format(
                summary,
                top_owner,
                " and ".join(chain_bits),
            )
        else:
            summary = "{} Native reconstruction now ties this lane to {}.".format(summary, top_owner)
    return {
        "verdict": verdict,
        "summary": summary,
        "provedEdgeCount": len(proved_edges),
        "negativeEdgeCount": len(negative_edges),
        "baselineGap": diff["blockedMissingEdgeTypes"],
        "supportingEdgeTypes": [edge["type"] for edge in proved_edges],
        "blockedEdgeTypes": negative_types,
    }


def get_priority_preload_documents(target: dict[str, Any]) -> list[str]:
    family_id = target["familyId"]
    if family_id == "exploration":
        return ["tokenShopExtract", "tokenShopRowRemapBoundary", "shardCostFormulaModel", "multiverseMarketMemberBoundary"]
    if family_id == "token-shop":
        return ["tokenShopExtract", "tokenShopRowRemapBoundary"]
    if family_id == "shard-cost":
        return ["shardCostFormulaModel", "shardMilestoneSaveOwnerCandidates"]
    if family_id == "shard-owned-state":
        return ["shardSaveBoundary", "shardMilestoneSaveOwnerCandidates"]
    if family_id == "multiverse-market-save-owner":
        return ["multiverseMarketMemberBoundary", "multiverseMarketSaveDataImportBoundary"]
    return []


def build_dataset(target_id: str | None, queries: list[str], extra_anchors: list[str], family_id: str | None = None, extended_search: int = 0, depth_search: int | None = 0) -> dict[str, Any]:
    registry = load_registry()
    planner_resolution = resolve_planner_selection(registry, target_id, queries, extra_anchors, family_id)
    selected_target_id = str(planner_resolution["selectedTargetId"])
    is_generic_explore = planner_resolution["selectionMode"] == "generic-explore"
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
        resolved_depth_search = 0 if depth_search is None else depth_search
    else:
        target = registry["targets"][selected_target_id]
        family_plan = registry["planner"]["families"][target["familyId"]]
        anchors = unique_strings(planner_resolution["expandedAnchors"])
        source_family_ids = list(registry["sourceFamilies"].keys()) if extended_search >= 2 else target["requiredSourceFamilies"]
        source_paths, source_roles = resolve_source_catalog(registry, source_family_ids)
        source_paths, source_roles = narrow_source_catalog(source_paths, source_roles, get_extended_source_ids_for_target(registry, target, extended_search))
        resolved_depth_search = target.get("defaultDepth", 0) if depth_search is None else depth_search
    execution_anchor_specs = build_anchor_specs(anchors, "execution-anchor")
    expanded_anchor_specs = build_anchor_specs(planner_resolution["expandedAnchors"], "planner-expanded-anchor")
    documents = TraceDocumentCache(COMPATIBILITY_SOURCE_PATHS)
    documents.preload(get_priority_preload_documents(target))
    trace_payload = (
        build_generic_explore_trace(anchors, list(source_paths.keys()), documents)
        if is_generic_explore
        else build_trace_payload(selected_target_id, target, anchors, documents, list(source_paths.keys()), extended_search, resolved_depth_search)
    )
    native_anchor_values = _collect_native_trace_terms(target, planner_resolution, trace_payload)
    native_trace = collect_native_trace(
        native_anchor_values,
        1800,
        target["familyId"],
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
    row_recovery = _build_token_shop_row_recovery(target, trace_payload, native_trace)
    closure_status = (row_recovery or {}).get("closureStatus") or {}
    return {
        "dataset": "unity-trace-bundle",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "traceWorkflow": {
            "command": "node scripts/unity/run_probe.mjs trace [--target <target-id>] [--family <family-id>] [--query <query>] [--anchor <anchor>] [--extended-search <0|1|2>]",
            "directExample": "node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>",
            "plannerExample": "node scripts/unity/run_probe.mjs trace --family <family-id> --query <query> --anchor <anchor> --extended-search <0|1|2>",
            "acceptedAnchors": target["acceptedAnchors"],
            "targetResolution": "explicit target, explicit family, or checked query planner plus family-aware anchor expansion",
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
            "runMode": planner_resolution["selectedRunMode"],
            "comparePresetId": planner_resolution["selectedComparePresetId"],
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
            "path": repo_relative(REGISTRY_PATH),
            "selectedTargetId": selected_target_id,
            "selectedFamilyId": target["familyId"],
            "requiredSourceFamilies": target["requiredSourceFamilies"],
            "solvedBaselineTargetId": target["solvedBaselineTargetId"],
            "blockedTargetId": target["blockedTargetId"],
            "comparisonPreset": None
            if is_generic_explore or not target.get("comparisonPresetId")
            else registry["comparisonPresets"][target["comparisonPresetId"]],
            "defaultDepth": target.get("defaultDepth", 0),
            "followUpSurfaces": target.get("strategyConfig", {}).get("followUpSurfaces", []),
            "depthPlan": target.get("strategyConfig", {}).get("depthPlan", []),
            "claimStages": target.get("strategyConfig", {}).get("claimStages", []),
        },
        "sources": {source_id: get_source_reference(source_id) for source_id in source_paths},
        "sourceRoles": source_roles,
        "nativeTrace": native_trace,
        "nativeReconstruction": native_trace.get("summary", {}),
        "rowRecovery": row_recovery,
        "status": closure_status.get("status"),
        "closureStatus": closure_status,
        "semanticStatus": closure_status.get("semanticStatus"),
        "literalStatus": closure_status.get("literalStatus"),
        "runtimeStatus": closure_status.get("runtimeStatus"),
        "target": {
            "id": selected_target_id,
            "label": target["label"],
            "familyId": target["familyId"],
            "anchors": anchors,
            "joinGoal": target["joinGoal"],
            "requiredSourceFamilies": target["requiredSourceFamilies"],
            "solvedBaselineTargetId": target["solvedBaselineTargetId"],
            "blockedTargetId": target["blockedTargetId"],
        },
        "shellWindow": trace_payload["shellWindow"],
        "surfaces": trace_payload["surfaces"],
        "depthExpansion": trace_payload.get("depthExpansion", []),
        "traceGraph": trace_payload["traceGraph"],
        "outcome": trace_payload.get("outcome"),
        "decisionSummary": build_decision_summary(target, trace_payload, native_trace.get("summary")),
        "bridgePromotionRule": trace_payload["bridgePromotionRule"],
        "bridgeCheck": trace_payload["bridgeCheck"],
        "solvedVsBlockedDiff": trace_payload["solvedVsBlockedDiff"],
        "lostStructure": trace_payload["lostStructure"],
        "groundedConclusion": trace_payload["groundedConclusion"],
        "currentBoundary": trace_payload["currentBoundary"],
    }


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
        f"- Registry target: `{dataset['traceRegistry']['selectedTargetId']}` from `{dataset['traceRegistry']['selectedFamilyId']}` via {md_link(ROOT / dataset['traceRegistry']['path'])}",
        f"- Registry default depth: `{dataset['traceRegistry']['defaultDepth']}`",
        "",
    ]
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
        f"- {dataset['groundedConclusion']}",
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
        PRIMARY_SOURCE_PATHS["level0"],
        *ASSET_SOURCE_MEMBER_PATHS.values(),
        PRIMARY_SOURCE_PATHS["native"],
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
    json_out.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf-8")
    write_markdown(dataset)


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
    return _load_canonical_semantic_payload("semantic_scope_fragment", semantic_scope_id)


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
    fragments: list[dict[str, Any]] = []
    owner_blob_row = row_recovery.get("ownerBlobRow") or {}
    runtime_instance = row_recovery.get("runtimeInstanceRecovery") or {}
    runtime_evaluator = row_recovery.get("runtimeEvaluatorRecovery") or {}
    owner_names = unique_strings([
        str((row_recovery.get("literalSchemaRecovery") or {}).get("owner") or ""),
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
                "unresolvedRuntimeTargets": (dataset.get("closureStatus") or {}).get("unresolvedRuntimeTargets"),
            },
        }
    ]


def extract_dependency_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    target = dataset.get("target") or {}
    fragments: list[dict[str, Any]] = []
    semantic_scope_payload = _load_canonical_semantic_scope_payload(dataset)
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
                    "nativeSummary": dataset.get("nativeReconstruction"),
                    "semanticScope": semantic_scope_payload,
                },
            }
        )
    return fragments


def extract_ui_binding_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    row_recovery = dataset.get("rowRecovery") or {}
    presentation_update = row_recovery.get("presentationUpdatePath") or {}
    target = dataset.get("target") or {}
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
                "decisionSummary": dataset.get("decisionSummary"),
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
    target = dataset.get("target") or {}
    return [
        {
            "fragment_kind": "semantic_scope_fragment",
            "fragment_key": semantic_scope_id,
            "payload": {
                "semanticKey": semantic_scope_id,
                "targetId": target.get("id"),
                "familyId": target.get("familyId"),
                "semanticGraph": row_recovery.get("semanticGraph"),
                "semanticSearchPlan": row_recovery.get("semanticSearchPlan"),
            },
        }
    ]


def extract_reconstruction_note_semantic_fragments(dataset: dict[str, Any]) -> list[dict[str, Any]]:
    target = dataset.get("target") or {}
    note_key = _semantic_key("reconstruction-note", target.get("familyId"), target.get("id"))
    return [
        {
            "fragment_kind": "reconstruction_note_fragment",
            "fragment_key": note_key,
            "payload": {
                "semanticKey": note_key,
                "targetId": target.get("id"),
                "familyId": target.get("familyId"),
                "bridgeCheck": dataset.get("bridgeCheck"),
                "groundedConclusion": dataset.get("groundedConclusion"),
                "decisionSummary": dataset.get("decisionSummary"),
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


def plan_trace_bundle_request(
    args: argparse.Namespace,
    registry: dict[str, Any],
) -> dict[str, Any]:
    planner_resolution = resolve_planner_selection(registry, args.target, args.query, args.anchor, args.family)
    selected_target_id = str(planner_resolution["selectedTargetId"])
    selected_family_id = (
        str(registry["targets"][selected_target_id]["familyId"])
        if selected_target_id in registry.get("targets", {})
        else str(planner_resolution.get("matchedFamilyId") or args.family or "exploration")
    )
    asset_set = build_trace_asset_set()
    request_signature = build_trace_request_signature(
        selected_target_id,
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
        "selectedTargetId": selected_target_id,
        "selectedFamilyId": selected_family_id,
        "assetSet": asset_set,
        "requestSignature": request_signature,
    }


def collect_trace_bundle_components(
    args: argparse.Namespace,
) -> dict[str, Any]:
    dataset = build_dataset(args.target, args.query, args.anchor, args.family, args.extended_search, args.depth_search)
    dataset["semanticFragments"] = collect_semantic_fragments(dataset)
    return dataset


def persist_trace_bundle_fragments(
    dataset: dict[str, Any],
    trace_scope: str,
    request_signature: str,
) -> None:
    db = get_trace_db()
    db.upsert_trace_dataset("cifi-full", "libil2cpp.so", trace_scope, request_signature, dataset)


def materialize_trace_bundle_dataset(
    dataset: dict[str, Any],
    trace_scope: str,
    request_signature: str,
) -> dict[str, Any]:
    current_trace_run = dict(dataset.get("traceRun", {}) or {})
    db = get_trace_db()
    materialized = db.find_materialized_target_bundle_view("cifi-full", "libil2cpp.so", trace_scope, request_signature)
    if materialized is None:
        materialized = db.find_materialized_trace_view("cifi-full", "libil2cpp.so", trace_scope, request_signature)
    if materialized:
        payload = dict(materialized["payload"])
        trace_run = dict(current_trace_run)
        trace_run["dbBacked"] = True
        trace_run["traceScope"] = trace_scope
        trace_run["requestSignature"] = request_signature
        trace_run["materializedAt"] = materialized.get("builtAt")
        trace_run["reducerVersion"] = materialized.get("reducerVersion")
        payload["traceRun"] = trace_run
        payload["traceProvenance"] = materialized.get("provenance", {})
        return payload
    dataset["traceRun"] = dict(current_trace_run)
    dataset["traceRun"]["dbBacked"] = True
    dataset["traceRun"]["traceScope"] = trace_scope
    dataset["traceRun"]["requestSignature"] = request_signature
    return dataset


def trace_dataset_has_required_fragments(dataset: dict[str, Any]) -> bool:
    if {"traceRegistry", "target", "decisionSummary", "nativeTrace"}.issubset(dataset):
        return True
    required = {
        "traceRegistry",
        "target",
        "decisionSummary",
        "nativeView",
        "systemViews",
        "canonicalSemanticViews",
        "semanticCoverage",
        "sourceFamilies",
    }
    return all(key in dataset for key in required)


def main() -> None:
    registry = load_registry()
    parser = argparse.ArgumentParser(
        description="Unity Trace Bundle Generator - Extract and analyze Unity objects"
    )
    
    # Target specification (from registry or custom)
    parser.add_argument("--target", 
                        choices=sorted(registry["targets"].keys()),
                        help="Target ID from trace registry (e.g., token-shop-atu3-cells-effect)")
    parser.add_argument("--query", action="append", default=[],
                        help="Query term to search for (can specify multiple)")
    parser.add_argument("--anchor", action="append", default=[],
                        help="Anchor to trace (class, method, string, path id - can specify multiple)")
    
    # Family specification for custom targets
    parser.add_argument("--family",
                        choices=sorted(registry["planner"]["families"].keys()),
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
                        help="Additional probe scripts to run in sequence")
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
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.target and not args.family and not args.query and not args.anchor:
        parser.error("pass --target, --family, or at least one --query/--anchor")
    
    # Determine output level
    if args.level == "raw":
        output_mode = "raw_only"
    elif args.level == "structured":
        output_mode = "structured_only"
    else:
        output_mode = "both"
    
    trace_plan = plan_trace_bundle_request(args, registry)
    planner_resolution = trace_plan["plannerResolution"]
    selected_target_id = str(trace_plan["selectedTargetId"])
    selected_family_id = str(trace_plan["selectedFamilyId"])
    asset_set = trace_plan["assetSet"]
    request_signature = str(trace_plan["requestSignature"])

    if args.resume:
        existing = get_trace_db().find_materialized_target_bundle_view("cifi-full", "libil2cpp.so", selected_target_id, request_signature)
        if existing is None:
            existing = get_trace_db().find_materialized_trace_view("cifi-full", "libil2cpp.so", selected_target_id, request_signature)
        if existing and trace_dataset_has_required_fragments(existing["payload"]):
            dataset = dict(existing["payload"])
        else:
            dataset = collect_trace_bundle_components(args)
    else:
        dataset = collect_trace_bundle_components(args)

    export_requested = args.export or args.json_out != JSON_OUT or args.md_out != MD_OUT
    json_out, md_out, run_id = allocate_trace_run_paths(
        dataset["traceRegistry"]["selectedTargetId"],
        dataset["traceRegistry"]["selectedFamilyId"],
        args.json_out if args.json_out != JSON_OUT else None,
        args.md_out if args.md_out != MD_OUT else None,
    )

    # Add metadata about the trace parameters
    dataset["traceParams"] = {
        "target": args.target,
        "anchors": args.anchor,
        "family": args.family,
        "extendedSearch": args.extended_search,
        "depthSearch": args.depth_search,
        "level": args.level,
        "anchorKind": args.anchor_kind,
        "maxSteps": args.max_steps
    }
    dataset["assetSet"] = asset_set
    dataset["traceRun"] = {
        "id": run_id,
        "jsonOut": str(json_out) if export_requested else None,
        "mdOut": str(md_out) if export_requested else None,
        "mode": "stable-target-run",
        "outputMode": output_mode,
        "overwritesOnRepeat": export_requested,
    }

    persist_trace_bundle_fragments(dataset, str(dataset["traceRegistry"]["selectedTargetId"]), request_signature)
    dataset = materialize_trace_bundle_dataset(dataset, str(dataset["traceRegistry"]["selectedTargetId"]), request_signature)

    if export_requested:
        export_trace_run(dataset, json_out, md_out)
        print(f"Trace bundle exported: {json_out}")
        print(f"Markdown: {md_out}")
    else:
        print(f"Trace bundle materialized in DB for target: {selected_target_id}")


if __name__ == "__main__":
    main()
