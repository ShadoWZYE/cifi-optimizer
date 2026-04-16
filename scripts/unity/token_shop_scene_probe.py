#!/usr/bin/env python3
"""
TokenShop Scene Probe
Traces TokenShop objects, buttons, prefab connections, and UI text components
using UnityPy to directly read the Unity scene objects.
"""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path
from collections import defaultdict

from portable_paths import md_link, repo_relative


ROOT = Path(__file__).resolve().parents[2]
UNITY_JOINED_DIR = ROOT / "workbench" / "unity" / "joined"
JSON_OUT = ROOT / "data" / "token-shop-scene-probe.json"
MD_OUT = ROOT / "docs" / "systems" / "spend" / "token-shop-scene-probe.md"

TARGET_SCRIPTS = {
    "TokenShop",
    "TokenShopButton", 
}


def install_optional_dependency_stubs() -> None:
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


def load_environment():
    install_optional_dependency_stubs()
    sys.path.insert(0, str((ROOT / ".deps").resolve()))
    from UnityPy import Environment

    env = Environment()
    env.load_folder(str(UNITY_JOINED_DIR))
    return env


def build_script_map(env) -> dict[int, str]:
    script_map: dict[int, str] = {}
    for obj in env.objects:
        if obj.type.name != "MonoScript":
            continue
        try:
            data = obj.read()
        except Exception:
            continue
        script_map[obj.path_id] = getattr(data, "m_Name", "") or ""
    return script_map


def get_game_object_name(data) -> str:
    """Extract GameObject name from MonoBehaviour data"""
    go = getattr(data, "m_GameObject", None)
    if go:
        try:
            go_data = go.read()
            return getattr(go_data, "m_Name", "") or ""
        except Exception:
            pass
    return getattr(data, "m_Name", "") or ""


def read_token_shop_serialized_data(env, token_shop_path_id: int) -> dict:
    """Read the raw serialized TokenShop data to extract fields"""
    for obj in env.objects:
        if obj.path_id == token_shop_path_id and obj.type.name == "MonoBehaviour":
            try:
                raw = obj.get_raw_data()
                if not raw:
                    return {"error": "No raw data available"}
                
                import struct
                
                fields = {
                    "raw_byte_length": len(raw),
                    "byte_start": obj.byte_start,
                    "byte_size": obj.byte_size,
                }
                
                # Known ATU button field to path_id mapping
                atu_field_pathids = {
                    "ATU1Button": 15839, "ATU2Button": 15804, "ATU3Button": 15810,
                    "ATU4Button": 15796, "ATU5Button": 15831, "ATU6Button": 15835,
                    "ATU7Button": 15792, "ATU8Button": 15795, "ATU9Button": 15845,
                    "ATU10Button": 15837, "ATU11Button": 15793, "ATU12Button": 15814,
                    "ATU13Button": 15821, "ATU14Button": 15844, "ATU15Button": 15850,
                    "ATU16Button": 15827, "ATU17Button": 15841, "ATU18Button": 15834,
                    "ATU19Button": 15842, "ATU20Button": 15812, "ATU21Button": 15829,
                    "ATU22Button": 15806, "ATU23Button": 15828, "ATU24Button": 15797,
                    "ATU25Button": 15820, "ATU26Button": 15840, "ATU27Button": 15832,
                    "ATU28Button": 15813,
                }
                
                # Find button offsets by scanning for path_ids
                button_offsets = {}
                for i in range(0, min(len(raw), 2000), 4):
                    try:
                        val = struct.unpack('<I', raw[i:i+4])[0]
                        if val in atu_field_pathids.values():
                            for field, pid in atu_field_pathids.items():
                                if pid == val and field not in button_offsets:
                                    button_offsets[field] = {"offset": i, "path_id": val}
                                    break
                    except:
                        pass
                
                fields["button_offsets"] = button_offsets
                
                # The value fields are at FIXED offsets in the serialized data, not relative to button refs
                # Value data starts at offset 320 and follows a pattern
                # Each ATU row has 4 value fields: start_cost, bonus, additive, max_level
                
                # Value field offsets discovered from full raw data analysis
                # These are absolute offsets in the serialized data
                # The 4th field mixes int (max_level) and float (multiplier) - stored as raw bits
                value_data_offsets = {
                    'start_cost': [320, 372, 424, 476, 532, 608, 684, 760, 836, 912, 988, 1064, 1140, 1216, 1268, 1316, 1368, 1420, 1472, 1528, 1580, 1632, 1684, 1736, 1800, 1852, 1904, 1956],
                    'bonus': [324, 376, 428, 480, 552, 628, 704, 780, 856, 932, 1008, 1084, 1160, 1212, 1264, 1316, 1368, 1420, 1472, 1524, 1576, 1628, 1680, 1736, 1796, 1852, 1904, 1956],
                    'additive': [328, 380, 432, 484, 556, 632, 708, 784, 860, 936, 1012, 1088, 1164, 1220, 1272, 1320, 1372, 1424, 1476, 1532, 1584, 1636, 1688, 1740, 1800, 1856, 1908, 1960],
                    'level_or_multiplier': [332, 384, 436, 488, 560, 636, 712, 788, 864, 940, 1016, 1092, 1168, 1224, 1276, 1324, 1376, 1428, 1480, 1536, 1588, 1640, 1692, 1744, 1804, 1860, 1912, 1964],
                }
                
                field_names = ['start_cost', 'bonus', 'additive', 'level_or_multiplier']
                
                parsed_values = {}
                sorted_atu_names = sorted(button_offsets.keys(), key=lambda x: int(x.replace('ATU','').replace('Button','')))
                
                for i, field_name in enumerate(sorted_atu_names):
                    btn_pid = button_offsets[field_name]["path_id"]
                    btn_offset = button_offsets[field_name]["offset"]
                    
                    values = {
                        "button_path_id": btn_pid,
                        "button_data_offset": btn_offset,
                    }
                    
                    for fname in field_names:
                        offsets_list = value_data_offsets[fname]
                        if i < len(offsets_list):
                            off = offsets_list[i]
                            if off < len(raw):
                                val_bits = struct.unpack('<I', raw[off:off+4])[0]
                                val_f = struct.unpack('<f', raw[off:off+4])[0]
                                
                                # The 4th field (level_or_multiplier) mixes int and float
                                # Store as raw bits - game will interpret based on context
                                if fname == 'level_or_multiplier':
                                    # If raw value is small int (<1000), store as int
                                    # Otherwise store float interpretation
                                    if val_bits < 1000:
                                        values[fname] = {
                                            "raw_bits": val_bits,
                                            "as_int": val_bits,
                                            "as_float": None,
                                            "byte_offset": off
                                        }
                                    else:
                                        values[fname] = {
                                            "raw_bits": val_bits,
                                            "as_int": None,
                                            "as_float": round(val_f, 10),
                                            "byte_offset": off
                                        }
                                else:
                                    values[fname] = {
                                        "raw_bits": val_bits,
                                        "as_float": round(val_f, 10),
                                        "byte_offset": off
                                    }
                            else:
                                values[fname] = None
                        else:
                            values[fname] = None
                    
                    parsed_values[field_name] = values
                
                fields["parsed_values"] = parsed_values
                
                return fields
            except Exception as e:
                return {"error": str(e)}
    return {"error": "Not found"}


def find_all_text_objects(env) -> list[dict]:
    """Find all text/TMPro objects in the scene"""
    text_objects = []
    
    for obj in env.objects:
        if obj.type.name not in ["Text", "TextMeshProUGUI", "TextMeshPro"]:
            continue
            
        try:
            data = obj.read()
        except Exception:
            continue
            
        # Get the GameObject
        go = getattr(data, "m_GameObject", None)
        if not go:
            continue
            
        try:
            go_data = go.read()
            name = getattr(go_data, "m_Name", "") or ""
        except Exception:
            name = f"Text_{obj.path_id}"
        
        # Get the text content if possible
        text_content = ""
        if obj.type.name == "TextMeshProUGUI":
            text_content = getattr(data, "m_text", "") or ""
        elif obj.type.name == "Text":
            text_content = getattr(data, "m_Text", "") or ""
        
        # Look for relevant text
        if any(x in name.lower() for x in ["token", "booster", "generator", "duo", "trinity", "tier", "max", "cells", "mod", "diamond", "ultima", "loot"]):
            text_objects.append({
                "path_id": obj.path_id,
                "name": name,
                "type": obj.type.name,
                "text_content": text_content[:100] if text_content else "",
            })
    
    return text_objects


def extract_button_fields(data) -> dict:
    """Extract ATU button fields from TokenShop MonoBehaviour"""
    fields = {}
    for key in dir(data):
        if key.startswith("ATU") and "Button" in key:
            try:
                value = getattr(data, key, None)
                if value:
                    # Try to get the path_id from the reference
                    if hasattr(value, "path_id"):
                        fields[key] = {"path_id": value.path_id}
                    elif hasattr(value, "m_PathID"):
                        fields[key] = {"path_id": value.m_PathID}
            except Exception:
                pass
    return fields


def extract_upgrade_fields(data) -> dict:
    """Extract upgrade numeric fields (StartCost, Bonus, MaxLevel, etc)"""
    fields = {}
    for key in dir(data):
        # Look for upgrade-related fields
        if any(x in key for x in ["StartCost", "AdditiveCost", "Bonus", "MaxLevel", "Fill"]):
            if key.startswith("ATU") or key.startswith("Token") or key.startswith("Diamond") or key.startswith("Cell") or key.startswith("Mod") or key.startswith("MK"):
                try:
                    value = getattr(data, key, None)
                    if value is not None and not callable(value):
                        fields[key] = value
                except Exception:
                    pass
    return fields


def find_text_components(env, parent_path_ids: set[int]) -> list[dict]:
    """Find Text/TMPro components that are children of the given parent path_ids"""
    text_components = []
    
    for obj in env.objects:
        if obj.type.name not in ["Text", "TextMeshProUGUI", "TextMeshPro"]:
            continue
            
        try:
            data = obj.read()
        except Exception:
            continue
            
        # Get the GameObject parent
        go = getattr(data, "m_GameObject", None)
        if not go:
            continue
            
        try:
            go_data = go.read()
            obj_name = getattr(go_data, "m_Name", "") or ""
        except Exception:
            continue
            
        # Get the actual path_id of this text object
        text_path_id = obj.path_id
        
        # Check if this is a TokenShop related text (contains relevant keywords)
        if any(x in obj_name for x in ["Token", "Booster", "Generator", "Duo", "Trinity", "Tier", "Max", "Cells", "Mod", "Diamond", "Ultima"]):
            text_components.append({
                "path_id": text_path_id,
                "name": obj_name,
                "type": obj.type.name,
            })
    
    return text_components


def find_prefab_references(env) -> dict:
    """Find all prefab GameObjects related to TokenShop upgrades"""
    prefabs = {}
    
    for obj in env.objects:
        if obj.type.name != "GameObject":
            continue
            
        try:
            data = obj.read()
        except Exception:
            continue
            
        name = getattr(data, "m_Name", "") or ""
        
        if "UPGPrefab" in name or "Booster" in name:
            prefabs[obj.path_id] = {
                "name": name,
                "path_id": obj.path_id,
            }
    
    return prefabs


def find_atu_button_gameobjects(env) -> dict:
    """Find ATU button GameObjects in scene by name"""
    buttons = {}
    
    # Known ATU button path_ids from TokenShop extract (field name -> path_id)
    atu_field_to_pathid = {
        "ATU1Button": 15839, "ATU2Button": 15804, "ATU3Button": 15810,
        "ATU4Button": 15796, "ATU5Button": 15831, "ATU6Button": 15835,
        "ATU7Button": 15792, "ATU8Button": 15795, "ATU9Button": 15845,
        "ATU10Button": 15837, "ATU11Button": 15793, "ATU12Button": 15814,
        "ATU13Button": 15821, "ATU14Button": 15844, "ATU15Button": 15850,
        "ATU16Button": 15827, "ATU17Button": 15841, "ATU18Button": 15834,
        "ATU19Button": 15842, "ATU20Button": 15812, "ATU21Button": 15829,
        "ATU22Button": 15806, "ATU23Button": 15828, "ATU24Button": 15797,
        "ATU25Button": 15820, "ATU26Button": 15840, "ATU27Button": 15832,
        "ATU28Button": 15813,
    }
    known_atu_pathids = set(atu_field_to_pathid.values())
    
    for obj in env.objects:
        if obj.type.name != "GameObject":
            continue
        
        is_atu = obj.path_id in known_atu_pathids
        
        if not is_atu:
            try:
                data = obj.read()
                name = getattr(data, "m_Name", "") or ""
                if name == "UPGButton":
                    is_atu = True
            except Exception:
                pass
        
        if is_atu:
            try:
                data = obj.read()
                name = getattr(data, "m_Name", "") or ""
            except Exception:
                name = f"Unknown_{obj.path_id}"
            
            field_name = next((k for k, v in atu_field_to_pathid.items() if v == obj.path_id), None)
            
            buttons[obj.path_id] = {
                "name": name,
                "path_id": obj.path_id,
                "atu_field": field_name,
            }
    
    return buttons


def find_token_shop_gameobjects(env) -> dict:
    """Find all GameObjects related to TokenShop by name patterns"""
    results = {
        "by_name": {},
        "by_transform_parent": {},
    }
    
    token_shop_go_path_ids = set()
    
    for obj in env.objects:
        if obj.type.name != "GameObject":
            continue
            
        try:
            data = obj.read()
        except Exception:
            continue
            
        name = getattr(data, "m_Name", "") or ""
        
        patterns = ["TokenShop", "Token Shop", "ATU", "Booster", "Upgrade"]
        if any(p.lower() in name.lower() for p in patterns):
            results["by_name"][obj.path_id] = {
                "name": name,
                "path_id": obj.path_id,
            }
    
    return results


def probe_token_shop_objects(env, script_map: dict[int, str]) -> dict:
    """Main probe function for TokenShop objects"""
    token_shop_objects = []
    token_shop_serialized_fields = {}
    all_text_objects = []
    prefab_refs = {}
    
    # First, find all TokenShop-related MonoBehaviours
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
            
        try:
            data = obj.read(check_read=False)
        except TypeError:
            try:
                data = obj.read()
            except Exception:
                continue
        except Exception:
            continue

        # Get the script
        script = getattr(data, "m_Script", None)
        script_path_id = getattr(script, "path_id", None)
        if script_path_id is None:
            continue

        script_name = script_map.get(script_path_id, "")
        
        # Check if this is a TokenShop object
        if script_name not in TARGET_SCRIPTS:
            continue
            
        obj_name = get_game_object_name(data)
        
        token_shop_objects.append({
            "path_id": obj.path_id,
            "script_name": script_name,
            "object_name": obj_name,
            "byte_start": getattr(obj, "byte_start", None),
            "byte_size": getattr(obj, "byte_size", None),
        })
        
        # Extract serialized fields
        if script_name == "TokenShop":
            serialized = read_token_shop_serialized_data(env, obj.path_id)
            token_shop_serialized_fields[obj.path_id] = serialized
    
    # Find all text objects in the scene (not just children)
    all_text_objects = find_all_text_objects(env)
    
    # Find prefab references
    prefab_refs = find_prefab_references(env)
    
    # Find ATU button GameObjects
    atu_buttons = find_atu_button_gameobjects(env)
    
    # Find TokenShop GameObjects by name patterns
    token_shop_gos = find_token_shop_gameobjects(env)
    
    return {
        "token_shop_objects": token_shop_objects,
        "serialized_fields": token_shop_serialized_fields,
        "text_objects": all_text_objects,
        "prefab_references": prefab_refs,
        "atu_buttons": atu_buttons,
        "token_shop_gameobjects": token_shop_gos["by_name"],
    }


def main() -> int:
    env = load_environment()
    script_map = build_script_map(env)
    results = probe_token_shop_objects(env, script_map)
    
    # Build output
    payload = {
        "dataset": "token-shop-scene-probe",
        "generatedAt": "2026-04-16",
        "source": {
            "unityJoinedDir": repo_relative(UNITY_JOINED_DIR),
            "probeMethod": "UnityPy MonoBehaviour inventory + child text component search",
        },
        **results,
        "findings": [
            f"Found {len(results['token_shop_objects'])} TokenShop MonoBehaviour objects",
            f"Found {len(results['prefab_references'])} upgrade prefab GameObjects",
            f"Found {len(results['atu_buttons'])} ATU button GameObjects",
            f"Found {len(results['token_shop_gameobjects'])} TokenShop-related GameObjects by name",
            f"Found {len(results['text_objects'])} text/TMPro objects",
        ],
    }
    
    JSON_OUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    
    # Generate markdown
    lines = [
        "# TokenShop Scene Probe",
        "",
        f"Source: {md_link(UNITY_JOINED_DIR)}, read with UnityPy",
        "",
        "## Findings",
        "",
    ]
    lines.extend(f"- {f}" for f in payload["findings"])
    
    if results["token_shop_objects"]:
        lines.extend(["", "## TokenShop Objects", ""])
        for obj in results["token_shop_objects"]:
            lines.append(f"- `{obj['script_name']}`: `{obj['object_name']}` (path_id={obj['path_id']})")
    
    if results["prefab_references"]:
        lines.extend(["", "## Prefab References", ""])
        # Group by tier
        by_tier = defaultdict(list)
        for pid, info in results["prefab_references"].items():
            name = info["name"]
            if ".T1." in name:
                by_tier["T1"].append(name)
            elif ".T2." in name:
                by_tier["T2"].append(name)
            elif ".T3." in name:
                by_tier["T3"].append(name)
            elif ".T4." in name:
                by_tier["T4"].append(name)
            elif ".T5." in name:
                by_tier["T5"].append(name)
        
        for tier in sorted(by_tier.keys()):
            lines.append(f"### {tier}")
            for name in sorted(by_tier[tier]):
                lines.append(f"- {name}")
    
    if results["atu_buttons"]:
        lines.extend(["", "## ATU Button GameObjects", ""])
        for path_id, info in sorted(results["atu_buttons"].items()):
            lines.append(f"- `{info['name']}` (path_id={path_id})")
    
    MD_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    
    print(f"TokenShop Scene Probe complete:")
    print(f"  - TokenShop objects: {len(results['token_shop_objects'])}")
    print(f"  - Prefab references: {len(results['prefab_references'])}")
    print(f"  - ATU buttons: {len(results['atu_buttons'])}")
    print(f"  - Text objects: {len(results['text_objects'])}")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())