#!/usr/bin/env python3
"""
TokenShop Cost Formula Tracer
Traces forward and backward from cost fields to find the actual formula.
Uses Unity helpers to trace through the object/method chain.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from portable_paths import repo_relative

ROOT = Path(__file__).resolve().parents[2]
UNITY_JOINED_DIR = ROOT / "workbench" / "unity" / "joined"

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "unity"))
from unity_probe_helpers import install_unitypy_stubs, get_env, build_indices


# Cost field patterns to trace
COST_FIELD_PATTERNS = [
    "StartCost", "AdditiveCost", "Bonus", "MaxLevel",
    "ATU1", "ATU2", "ATU3", "ATU4", "ATU5", "ATU6", "ATU7", "ATU8",
    "TokenBoost", "DiamondBoost", "CellBoost", "ModBoost",
    "MK1", "MK2", "MK3", "MK4", "MK5", "MK6", "MK7", "MK8",
]

# Buy methods to trace backwards from
BUY_HOOKS = [
    "BuyTokenBoost", "BuyDiamondBoost", "BuyCellBoost", "BuyModBoost",
    "BuyMK1TokenBoost", "BuyMK2TokenBoost", "BuyMK3TokenBoost",
    "BuyATU24", "BuyATU25", "BuyATU26", "BuyATU27", "BuyATU28",
]


def trace_cost_fields_forward(env, indices, script_map):
    """Trace forward from cost fields - find where they're read."""
    by_path_id = indices["by_path_id"]
    by_type = indices["by_type"]
    
    # Find all MonoScripts that reference cost fields
    cost_field_refs = defaultdict(list)
    
    # Search through method names in scripts
    for pid, script_name in script_map.items():
        for pattern in COST_FIELD_PATTERNS:
            if pattern.lower() in script_name.lower():
                # Check if it's a getter or cost calculation method
                if "get_" in script_name.lower() or "cost" in script_name.lower():
                    cost_field_refs[pattern].append({
                        "script_path_id": pid,
                        "script_name": script_name,
                    })
    
    return cost_field_refs


def trace_buy_methods_backward(env, indices, script_map):
    """Trace backward from buy methods - find what they call to get cost."""
    by_path_id = indices["by_path_id"]
    
    # Find buy-related methods
    buy_method_refs = defaultdict(list)
    
    for pid, script_name in script_map.items():
        for hook in BUY_HOOKS:
            if hook.lower() in script_name.lower():
                buy_method_refs[hook].append({
                    "script_path_id": pid,
                    "script_name": script_name,
                })
    
    return buy_method_refs


def find_cost_getters(env, indices, script_map):
    """Find methods that look like cost getters."""
    by_path_id = indices["by_path_id"]
    
    cost_getters = []
    
    for pid, script_name in script_map.items():
        # Look for patterns like get_ATU*Cost, get_*Cost, Calculate*Cost
        name_lower = script_name.lower()
        if "cost" in name_lower and ("get" in name_lower or "atu" in name_lower or "calc" in name_lower):
            cost_getters.append({
                "path_id": pid,
                "name": script_name,
            })
    
    return cost_getters


def main():
    print("=== TokenShop Cost Formula Tracer ===\n")
    
    print("Loading Unity environment...")
    env = get_env(UNITY_JOINED_DIR)
    
    print("Building indices...")
    indices = build_indices(env)
    by_path_id = indices["by_path_id"]
    print(f"  - {len(by_path_id)} objects indexed")
    
    # Build script map
    print("Building script map...")
    script_map = {}
    for obj in indices["by_type"].get("MonoScript", []):
        try:
            data = obj.read()
            script_map[obj.path_id] = getattr(data, "m_Name", "") or ""
        except:
            pass
    
    print(f"  - {len(script_map)} scripts loaded")
    
    # Trace forward from cost fields
    print("\n=== Forward Trace: Cost Field References ===")
    forward_refs = trace_cost_fields_forward(env, indices, script_map)
    for pattern, refs in sorted(forward_refs.items()):
        if refs:
            print(f"\n{pattern}:")
            for r in refs[:5]:
                print(f"  - {r['script_name']} (path_id={r['script_path_id']})")
    
    # Trace backward from buy methods
    print("\n=== Backward Trace: Buy Method Chain ===")
    backward_refs = trace_buy_methods_backward(env, indices, script_map)
    for hook, refs in sorted(backward_refs.items()):
        if refs:
            print(f"\n{hook}:")
            for r in refs[:3]:
                print(f"  - {r['script_name']} (path_id={r['script_path_id']})")
    
    # Find cost getters
    print("\n=== Cost Getter Methods ===")
    cost_getters = find_cost_getters(env, indices, script_map)
    for getter in cost_getters[:20]:
        print(f"  - {getter['name']} (path_id={getter['path_id']})")
    
    # Search for any TokenShop-related methods that might contain the formula
    print("\n=== TokenShop-related Methods (sample) ===")
    token_shop_methods = []
    for pid, name in script_map.items():
        if "tokenshop" in name.lower() or "atu" in name.lower():
            token_shop_methods.append({"path_id": pid, "name": name})
    
    for m in token_shop_methods[:30]:
        print(f"  - {m['name']} (path_id={m['path_id']})")
    
    # Save trace results
    trace_result = {
        "forward_refs": forward_refs,
        "backward_refs": backward_refs,
        "cost_getters": cost_getters[:50],
        "token_shop_methods": token_shop_methods[:50],
    }
    
    output = ROOT / "data" / "tokenshop-cost-trace.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(trace_result, f, indent=2, default=str)
    
    print(f"\nSaved trace to {output}")


if __name__ == "__main__":
    main()