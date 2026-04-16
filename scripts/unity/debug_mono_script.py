#!/usr/bin/env python3
"""
Debug script to check what's happening with MonoBehaviour script resolution
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
    
    by_path_id = {obj.path_id: obj for obj in env.objects}
    
    # Test with ATU1Button's first MonoBehaviour (path_id 386871)
    test_pid = 386871
    
    print(f"Testing path_id {test_pid}")
    
    if test_pid not in by_path_id:
        print("  NOT FOUND in index")
        return
        
    obj = by_path_id[test_pid]
    print(f"  Type: {obj.type.name}")
    
    if obj.type.name != "MonoBehaviour":
        print(f"  Not a MonoBehaviour!")
        return
    
    data = obj.read()
    print(f"  m_Name: {getattr(data, 'm_Name', 'N/A')}")
    
    # Check m_Script
    script_ptr = getattr(data, 'm_Script', None)
    print(f"  m_Script: {script_ptr}")
    
    if script_ptr:
        script_pid = getattr(script_ptr, 'm_PathID', None)
        print(f"    m_PathID: {script_pid}")
        
        if script_pid and script_pid in by_path_id:
            script_obj = by_path_id[script_pid]
            print(f"    Script object type: {script_obj.type.name}")
            
            if script_obj.type.name == "MonoScript":
                try:
                    script_data = script_obj.read()
                    script_name = getattr(script_data, 'm_Name', '') or ""
                    print(f"    Script name: {script_name}")
                except Exception as e:
                    print(f"    Error reading script: {e}")
        else:
            print(f"    Script path_id not in index!")


if __name__ == "__main__":
    main()