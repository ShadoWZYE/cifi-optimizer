#!/usr/bin/env python3
"""
Unity Probe Helpers - Shared methods for probing Unity objects
These methods can be reused for different object lookups without reimplementing the pattern.
"""

from __future__ import annotations

import sys
import types
from pathlib import Path
from collections import defaultdict
from typing import Any


ROOT = Path(__file__).resolve().parents[2]


def install_unitypy_stubs() -> None:
    """Install stubs for optional UnityPy dependencies."""
    if "brotli" not in sys.modules:
        brotli = types.ModuleType("brotli")
        brotli.decompress = lambda data: data
        brotli.compress = lambda data, *args, **kwargs: data
        sys.modules["brotli"] = brotli

    if "lz4" not in sys.modules:
        lz4 = types.ModuleType("lz4")
        lz4_block = types.ModuleType("lz4.block")
        lz4_block.decompress = lambda data, uncompressed_size=None: data
        lz4_block.compress = lambda data, **kwargs: data
        lz4.block = lz4_block
        sys.modules["lz4"] = lz4
        sys.modules["lz4.block"] = lz4_block

    if "PIL" not in sys.modules:
        pil = types.ModuleType("PIL")
        pil_image = types.ModuleType("PIL.Image")
        pil_image.open = lambda *args, **kwargs: None
        pil.Image = pil_image
        sys.modules["PIL"] = pil
        sys.modules["PIL.Image"] = pil_image


def get_env(unity_dir: Path | None = None, cache: dict | None = None) -> Any:
    """
    Get or create a cached Unity environment.
    
    Args:
        unity_dir: Path to Unity files directory. Defaults to workbench/unity/joined
        cache: Optional dict to use for caching the environment
    
    Returns:
        UnityPy Environment object
    """
    if unity_dir is None:
        unity_dir = ROOT / "workbench" / "unity" / "joined"
    
    if cache is not None and "env" in cache:
        return cache["env"]
    
    install_unitypy_stubs()
    sys.path.insert(0, str((ROOT / ".deps").resolve()))
    from UnityPy import Environment
    
    env = Environment()
    env.load_folder(str(unity_dir))
    
    if cache is not None:
        cache["env"] = env
    
    return env


def build_indices(env: Any) -> dict[str, Any]:
    """
    Build lookup indices for faster object access.
    
    Returns:
        {
            "by_path_id": {path_id: UnityObject},
            "by_type": {type_name: [UnityObject]}
        }
    """
    by_path_id: dict[int, Any] = {}
    by_type: dict[str, list] = defaultdict(list)
    
    for obj in env.objects:
        by_path_id[obj.path_id] = obj
        by_type[obj.type.name].append(obj)
    
    return {"by_path_id": by_path_id, "by_type": by_type}


def find_gameobjects_by_name(env: Any, indices: dict, name_pattern: str, exact: bool = False) -> list[dict]:
    """
    Find GameObjects matching a name pattern.
    
    Args:
        env: UnityPy Environment
        indices: Output of build_indices()
        name_pattern: Name to search for (case-sensitive substring unless exact=True)
        exact: If True, match exact name; else match substring
    
    Returns:
        [{"path_id": int, "name": str}, ...]
    """
    results = []
    by_path_id = indices["by_path_id"]
    
    for obj in indices["by_type"].get("GameObject", []):
        try:
            data = obj.read()
            name = getattr(data, "m_Name", "") or ""
            
            if exact:
                matches = name == name_pattern
            else:
                matches = name_pattern in name
            
            if matches:
                results.append({"path_id": obj.path_id, "name": name})
        except Exception:
            pass
    
    return results


def get_gameobject_components(env: Any, indices: dict, path_id: int) -> list[dict]:
    """
    Get all components on a GameObject.
    
    Args:
        env: UnityPy Environment
        indices: Output of build_indices()
        path_id: Path ID of the GameObject
    
    Returns:
        [{"path_id": int, "type": str}, ...]
    """
    by_path_id = indices["by_path_id"]
    
    if path_id not in by_path_id:
        return []
    
    obj = by_path_id[path_id]
    if obj.type.name != "GameObject":
        return []
    
    try:
        data = obj.read()
    except Exception:
        return []
    
    components = getattr(data, "m_Component", [])
    results = []
    
    if components:
        for comp_ref in components:
            if comp_ref:
                # Handle ComponentPair structure - components can be stored as pairs
                # The structure is: ComponentPair(component=PPtr(...))
                # We need to extract the PPtr and get its path_id
                comp_ptr = None
                
                # Try to get 'component' attribute from ComponentPair
                if hasattr(comp_ref, "component"):
                    comp_ptr = comp_ref.component
                elif hasattr(comp_ref, "component"):  # Maybe it's directly a PPtr
                    comp_ptr = comp_ref
                
                if comp_ptr:
                    # PPtr has m_PathID attribute
                    comp_pid = getattr(comp_ptr, "m_PathID", None)
                    if comp_pid is not None and comp_pid in by_path_id:
                        comp_type = by_path_id[comp_pid].type.name
                        results.append({"path_id": comp_pid, "type": comp_type})
    
    return results


def get_gameobject_children(env: Any, indices: dict, path_id: int, recursive: bool = False) -> list[dict]:
    """
    Get child GameObjects of a GameObject.
    
    Args:
        env: UnityPy Environment
        indices: Output of build_indices()
        path_id: Path ID of the parent GameObject
        recursive: If True, get all descendants; else only direct children
    
    Returns:
        [{"path_id": int, "name": str, "depth": int}, ...]
    """
    by_path_id = indices["by_path_id"]
    gameobjects = indices["by_type"].get("GameObject", [])
    
    results = []
    visited = set()
    queue = [(path_id, 0)]
    
    while queue:
        current_pid, depth = queue.pop(0)
        
        if current_pid in visited:
            continue
        visited.add(current_pid)
        
        for obj in gameobjects:
            try:
                data = obj.read()
                transform = getattr(data, "m_Transform", None)
                if not transform:
                    continue
                    
                transform_data = transform.read()
                parent = getattr(transform_data, "m_Father", None)
                if not parent:
                    continue
                    
                father_pid = getattr(parent, "path_id", None)
                if father_pid == current_pid:
                    name = getattr(data, "m_Name", "") or ""
                    results.append({"path_id": obj.path_id, "name": name, "depth": depth})
                    
                    if recursive:
                        queue.append((obj.path_id, depth + 1))
            except Exception:
                pass
    
    return results


def get_gameobject_parent(env: Any, indices: dict, path_id: int) -> int | None:
    """
    Get the path_id of the parent GameObject.
    
    Args:
        env: UnityPy Environment
        indices: Output of build_indices()
        path_id: Path ID of the child GameObject
    
    Returns:
        Parent path_id or None if no parent
    """
    by_path_id = indices["by_path_id"]
    
    if path_id not in by_path_id:
        return None
    
    obj = by_path_id[path_id]
    if obj.type.name != "GameObject":
        return None
    
    try:
        data = obj.read()
        transform = getattr(data, "m_Transform", None)
        if not transform:
            return None
            
        transform_data = transform.read()
        parent = getattr(transform_data, "m_Father", None)
        if not parent:
            return None
            
        return getattr(parent, "path_id", None)
    except Exception:
        return None


def find_text_under_gameobject(env: Any, indices: dict, path_id: int) -> list[dict]:
    """
    Find all text components under a GameObject (including children).
    
    Args:
        env: UnityPy Environment
        indices: Output of build_indices()
        path_id: Path ID of the parent GameObject
    
    Returns:
        [{"parent_path_id": int, "parent_name": str, "component_path_id": int, "component_type": str, "text_value": str}, ...]
    """
    by_path_id = indices["by_path_id"]
    gameobjects = indices["by_type"].get("GameObject", [])
    text_types = {"Text", "TextMeshProUGUI", "TextMeshPro"}
    
    results = []
    visited = set()
    queue = [path_id]
    
    while queue:
        current_pid = queue.pop(0)
        
        if current_pid in visited:
            continue
        visited.add(current_pid)
        
        if current_pid not in by_path_id:
            continue
            
        obj = by_path_id[current_pid]
        if obj.type.name != "GameObject":
            continue
        
        try:
            data = obj.read()
            name = getattr(data, "m_Name", "") or ""
        except Exception:
            continue
        
        components = getattr(data, "m_Component", [])
        if components:
            for comp_ref in components:
                if comp_ref:
                    comp_pid = getattr(comp_ref, "path_id", None)
                    if comp_pid is not None and comp_pid in by_path_id:
                        comp_obj = by_path_id[comp_pid]
                        if comp_obj.type.name in text_types:
                            try:
                                text_data = comp_obj.read()
                                text_val = ""
                                if comp_obj.type.name == "TextMeshProUGUI":
                                    text_val = getattr(text_data, "m_text", "") or ""
                                elif comp_obj.type.name == "Text":
                                    text_val = getattr(text_data, "m_Text", "") or ""
                                
                                results.append({
                                    "parent_path_id": current_pid,
                                    "parent_name": name,
                                    "component_path_id": comp_pid,
                                    "component_type": comp_obj.type.name,
                                    "text_value": text_val[:200],
                                })
                            except Exception:
                                pass
        
        # Add children to queue
        for child_obj in gameobjects:
            try:
                child_data = child_obj.read()
                child_transform = getattr(child_data, "m_Transform", None)
                if not child_transform:
                    continue
                    
                child_tf_data = child_transform.read()
                child_parent = getattr(child_tf_data, "m_Father", None)
                if not child_parent:
                    continue
                    
                child_parent_pid = getattr(child_parent, "path_id", None)
                if child_parent_pid == current_pid:
                    queue.append(child_obj.path_id)
            except Exception:
                pass
    
    return results


def find_monobehaviours_near_pathid(env: Any, indices: dict, path_id: int, radius: int = 200, script_name_filter: str | None = None) -> list[dict]:
    """
    Find MonoBehaviours near a given path_id.
    
    Args:
        env: UnityPy Environment
        indices: Output of build_indices()
        path_id: Reference path_id
        radius: How far to search (±path_id)
        script_name_filter: Optional script name to filter by
    
    Returns:
        [{"path_id": int, "behaviour_name": str, "script_name": str}, ...]
    """
    by_path_id = indices["by_path_id"]
    results = []
    
    for obj in indices["by_type"].get("MonoBehaviour", []):
        if abs(obj.path_id - path_id) > radius:
            continue
            
        try:
            data = obj.read()
            name = getattr(data, "m_Name", "") or ""
            script = getattr(data, "m_Script", None)
            
            if not script:
                continue
                
            script_pid = getattr(script, "path_id", None)
            if script_pid and script_pid in by_path_id:
                script_obj = by_path_id[script_pid]
                script_name = ""
                if script_obj.type.name == "MonoScript":
                    try:
                        script_name = getattr(script_obj.read(), "m_Name", "") or ""
                    except Exception:
                        pass
                
                if script_name_filter and script_name != script_name_filter:
                    continue
                
                results.append({
                    "path_id": obj.path_id,
                    "behaviour_name": name,
                    "script_name": script_name,
                })
        except Exception:
            pass
    
    return results


def get_monobehaviour_scripts(env: Any, indices: dict, path_id: int) -> list[dict]:
    """
    Get the script names for MonoBehaviour components.
    
    Args:
        env: UnityPy Environment
        indices: Output of build_indices()
        path_id: Path ID of the MonoBehaviour object
    
    Returns:
        [{"path_id": int, "script_name": str}, ...]
    """
    by_path_id = indices["by_path_id"]
    
    if path_id not in by_path_id:
        return []
    
    obj = by_path_id[path_id]
    if obj.type.name != "MonoBehaviour":
        return []
    
    try:
        data = obj.read()
    except Exception:
        return []
    
    # Get the m_Script field (PPtr to MonoScript)
    script_ptr = getattr(data, "m_Script", None)
    if not script_ptr:
        return []
    
    script_pid = getattr(script_ptr, "m_PathID", None)
    if script_pid is None or script_pid not in by_path_id:
        return []
    
    script_obj = by_path_id[script_pid]
    if script_obj.type.name != "MonoScript":
        return []
    
    try:
        script_data = script_obj.read()
        script_name = getattr(script_data, "m_Name", "") or ""
    except Exception:
        script_name = ""
    
    return [{"path_id": path_id, "script_name": script_name, "behaviour_name": getattr(data, "m_Name", "") or ""}]