#!/usr/bin/env python3
"""
Find readable MonoBehaviours in the scene
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
    
    # Find all MonoBehaviour path_ids
    mono_pids = [obj.path_id for obj in env.objects if obj.type.name == "MonoBehaviour"]
    print(f"Found {len(mono_pids)} MonoBehaviour objects")
    
    # Test a sample to see if any are readable
    readable = []
    unreadable = []
    
    for pid in mono_pids[:100]:  # Test first 100
        for obj in env.objects:
            if obj.path_id == pid:
                try:
                    data = obj.read()
                    readable.append(pid)
                except Exception as e:
                    unreadable.append((pid, str(e)[:50]))
                break
    
    print(f"\nFirst 100 MonoBehaviours:")
    print(f"  Readable: {len(readable)}")
    print(f"  Unreadable: {len(unreadable)}")
    
    if readable:
        print(f"\nFirst 10 readable: {readable[:10]}")
    
    if unreadable:
        print(f"\nFirst 5 unreadable errors:")
        for pid, err in unreadable[:5]:
            print(f"  {pid}: {err}")
    
    # Let's also find TokenShopButton-related MonoBehaviours
    print("\n\n=== Looking for TokenShopButton-related MonoBehaviours ===")
    script_map = {}
    for obj in env.objects:
        if obj.type.name == "MonoScript":
            try:
                data = obj.read()
                name = getattr(data, 'm_Name', '') or ""
                script_map[obj.path_id] = name
            except:
                pass
    
    button_scripts = [s for s in script_map.values() if 'Button' in s or 'button' in s]
    print(f"Found {len(button_scripts)} Button-related MonoScripts:")
    for bs in sorted(set(button_scripts))[:20]:
        print(f"  - {bs}")


if __name__ == "__main__":
    main()