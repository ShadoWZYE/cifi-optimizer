#!/usr/bin/env python3
"""
TokenShop Formula Discovery - Simplified
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
ROOT = Path(__file__).resolve().parents[2]


def main():
    print("=== TokenShop Formula Discovery ===\n")
    
    # Check unity-probe-report.json for TokenShop methods
    probe_path = ROOT / "data" / "unity-probe-report.json"
    
    if not probe_path.exists():
        print("File not found")
        return
    
    print("Loading unity-probe-report.json...")
    with open(probe_path, encoding="utf-8") as f:
        data = json.load(f)
    
    # Look at strings section
    strings = data.get("strings", [])
    print(f"  - {len(strings)} strings")
    
    # Find cost-related strings near TokenShop/ATU
    print("\n=== Finding cost-related methods ===")
    
    cost_methods = []
    for s in strings:
        val = s.get("value", "")
        name_lower = val.lower()
        
        # Look for ATU-related cost methods
        if ("atu" in name_lower or "tokenboost" in name_lower or 
            "diamondboost" in name_lower or "modboost" in name_lower or
            "cellboost" in name_lower):
            if any(k in name_lower for k in ["cost", "get_", "calculate", "price"]):
                cost_methods.append(val)
    
    # Dedup and print
    seen = set()
    for m in sorted(set(cost_methods)):
        if m and len(m) < 80 and m not in seen:
            seen.add(m)
            print(f"  {m}")
    
    print(f"\nTotal: {len(seen)} cost-related methods")


if __name__ == "__main__":
    main()