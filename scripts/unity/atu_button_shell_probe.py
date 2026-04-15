#!/usr/bin/env python3
"""
ATU Button Shell Probe - Uses shared helpers
Probes ATU buttons at shell level to understand their components, children, and structure.
"""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path
from collections import defaultdict

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from portable_paths import repo_relative

ROOT = Path(__file__).resolve().parents[2]
UNITY_JOINED_DIR = ROOT / "workbench" / "unity" / "joined"
JSON_OUT = ROOT / "data" / "atu-button-shell-probe.json"


# Import helpers
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "unity"))
from unity_probe_helpers import install_unitypy_stubs, get_env, build_indices, find_gameobjects_by_name, get_gameobject_components, get_gameobject_children, find_text_under_gameobject, find_monobehaviours_near_pathid, get_monobehaviour_scripts


ATU_BUTTON_PATH_IDS = {
    15839: "ATU1Button",
    15804: "ATU2Button", 
    15810: "ATU3Button",
    15796: "ATU4Button",
    15831: "ATU5Button",
    15835: "ATU6Button",
    15792: "ATU7Button",
    15795: "ATU8Button",
    15845: "ATU9Button",
    15837: "ATU10Button",
    15793: "ATU11Button",
    15814: "ATU12Button",
    15821: "ATU13Button",
    15844: "ATU14Button",
    15850: "ATU15Button",
    15827: "ATU16Button",
    15841: "ATU17Button",
    15834: "ATU18Button",
    15842: "ATU19Button",
    15812: "ATU20Button",
    15829: "ATU21Button",
    15806: "ATU22Button",
    15828: "ATU23Button",
    15797: "ATU24Button",
    15820: "ATU25Button",
    15840: "ATU26Button",
    15832: "ATU27Button",
    15813: "ATU28Button",
}


def main() -> int:
    print("Loading Unity environment...")
    env = get_env(UNITY_JOINED_DIR)
    
    print("Building indices...")
    indices = build_indices(env)
    by_path_id = indices["by_path_id"]
    by_type = indices["by_type"]
    print(f"  - {len(by_path_id)} objects indexed")
    
    results = {
        "dataset": "atu-button-shell-probe",
        "source": {
            "unityJoinedDir": repo_relative(UNITY_JOINED_DIR),
            "probeMethod": "UnityPy GameObject component/children traversal with shared helpers",
        },
        "buttons": {},
    }
    
    # Find all UPGButton GameObjects to see the full set
    all_upg_buttons = find_gameobjects_by_name(env, indices, "UPGButton", exact=True)
    print(f"\nFound {len(all_upg_buttons)} UPGButton GameObjects total")
    
    # Probe each ATU button
    for path_id, field_name in ATU_BUTTON_PATH_IDS.items():
        print(f"Probing {field_name} (path_id={path_id})...", end=" ")
        
        if path_id not in by_path_id:
            print("NOT FOUND")
            continue
            
        obj = by_path_id[path_id]
        if obj.type.name != "GameObject":
            print(f"NOT A GAMEOBJECT ({obj.type.name})")
            continue
        
        # Get basic info
        try:
            data = obj.read()
            name = getattr(data, "m_Name", "") or ""
        except Exception as e:
            print(f"ERROR reading: {e}")
            continue
        
        # Get components - resolve MonoBehaviour script names
        components = get_gameobject_components(env, indices, path_id)
        
        # Resolve MonoBehaviour script names
        for comp in components:
            if comp["type"] == "MonoBehaviour":
                scripts = get_monobehaviour_scripts(env, indices, comp["path_id"])
                if scripts:
                    comp["script_name"] = scripts[0].get("script_name", "")
                    comp["behaviour_name"] = scripts[0].get("behaviour_name", "")
        
        # Get children (recursive to find all descendants)
        children = get_gameobject_children(env, indices, path_id, recursive=True)
        
        # Find text under this button
        texts = find_text_under_gameobject(env, indices, path_id)
        
        # Find nearby MonoBehaviours (within ±200 path_ids)
        nearby_monos = find_monobehaviours_near_pathid(env, indices, path_id, radius=200)
        
        results["buttons"][field_name] = {
            "path_id": path_id,
            "game_object_name": name,
            "component_count": len(components),
            "components": components,
            "children_count": len(children),
            "children": children[:10],  # Limit to first 10 for brevity
            "text_count": len(texts),
            "texts": texts[:5],  # Limit to first 5
            "nearby_monobehaviours_count": len(nearby_monos),
            "nearby_monobehaviours": nearby_monos[:10],  # Limit to first 10
        }
        
        print(f"OK (components={len(components)}, children={len(children)}, texts={len(texts)})")
    
    # Write output
    JSON_OUT.write_text(json.dumps(results, indent=2, ensure_ascii=False), encoding="utf-8")
    
    print(f"\nDone! Wrote {len(results['buttons'])} buttons to {JSON_OUT}")
    
    # Print summary
    print("\n=== SUMMARY ===")
    for field_name, data in results["buttons"].items():
        comp_types = [c["type"] for c in data.get("components", [])]
        print(f"{field_name}: {len(comp_types)} components - {comp_types}")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())