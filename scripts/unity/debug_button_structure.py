#!/usr/bin/env python3
"""
Find readable MonoBehaviours near specific path_ids
"""

import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
UNITY_JOINED_DIR = ROOT / "workbench" / "unity" / "joined"


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


def main():
    install_optional_dependency_stubs()
    sys.path.insert(0, str((ROOT / ".deps").resolve()))
    from UnityPy import Environment
    
    env = Environment()
    env.load_folder(str(UNITY_JOINED_DIR))
    
    # Build script map
    script_map = {}
    for obj in env.objects:
        if obj.type.name == "MonoScript":
            try:
                data = obj.read()
                name = getattr(data, 'm_Name', '') or ""
                script_map[obj.path_id] = name
            except:
                pass
    
    # Test path_ids around ATU buttons and the TokenShopButton
    test_pids = [
        (82849, "TokenShopButton GameObject"),
        (82848, "LoopModifiers GameObject"),
        # ATU buttons from token-shop-values.json
        (15790, "First UPGButton"),
        (15792, "ATU7Button"),
        (15839, "ATU1Button"),
    ]
    
    by_path_id = {obj.path_id: obj for obj in env.objects}
    
    for pid, desc in test_pids:
        print(f"\n=== {desc} (path_id={pid}) ===")
        
        if pid not in by_path_id:
            print("  NOT FOUND")
            continue
            
        obj = by_path_id[pid]
        print(f"  Type: {obj.type.name}")
        
        if obj.type.name == "GameObject":
            try:
                data = obj.read()
                name = getattr(data, 'm_Name', '') or ""
                print(f"  Name: {name}")
                
                components = getattr(data, 'm_Component', [])
                print(f"  Components: {len(components)}")
                
                for i, comp_ref in enumerate(components):
                    if comp_ref:
                        comp_ptr = getattr(comp_ref, 'component', None)
                        if comp_ptr:
                            comp_pid = getattr(comp_ptr, 'm_PathID', None)
                            if comp_pid and comp_pid in by_path_id:
                                comp_obj = by_path_id[comp_pid]
                                print(f"    [{i}] {comp_obj.type.name} (path_id={comp_pid})")
                                
                                # If it's a MonoBehaviour, try to get the script name
                                if comp_obj.type.name == "MonoBehaviour":
                                    try:
                                        mono_data = comp_obj.read()
                                        script_ptr = getattr(mono_data, 'm_Script', None)
                                        if script_ptr:
                                            script_pid = getattr(script_ptr, 'm_PathID', None)
                                            if script_pid and script_pid in script_map:
                                                print(f"        Script: {script_map[script_pid]}")
                                    except Exception as e:
                                        print(f"        (unreadable: {str(e)[:30]})")
            except Exception as e:
                print(f"  Error reading: {e}")


if __name__ == "__main__":
    main()