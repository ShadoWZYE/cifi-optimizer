#!/usr/bin/env python3
"""
TokenShop get_ATU*Cost Probe - Search metadata for methods
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
ROOT = Path(__file__).resolve().parents[2]


def main():
    print("=== TokenShop get_ATU*Cost Probe ===\n")
    
    # Load all available probe outputs
    probes = [
        "uabea-probe-report.json",
        "unity-probe-report.json",
        "unity-runtime-surface-probe.json", 
    ]
    
    ATU_COST_METHOD_RE = re.compile(r"get_ATU(\d+)Cost")
    
    for probe_name in probes:
        probe_path = ROOT / "data" / probe_name
        if not probe_path.exists():
            print(f"Skipping {probe_name} - not found")
            continue
            
        print(f"\nSearching {probe_name}...")
        
        with open(probe_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Search for get_ATU*Cost patterns
        matches = re.findall(r'"[^"]*get_ATU\d+Cost[^"]*"', content)
        
        if matches:
            print(f"  Found {len(matches)} matches:")
            seen = set()
            for m in matches[:10]:
                if m not in seen:
                    seen.add(m)
                    print(f"    {m[:100]}")
        else:
            print("  No get_ATU*Cost methods found")
    
    # Also try to load uabea-probe differently
    print("\n=== Trying direct uabea parse ===")
    with open('data/uabea-probe-report.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Try different keys
    print("Top-level keys:", list(data.keys()))
    
    # Check fileScriptTypeSummaries
    fs = data.get('fileScriptTypeSummaries', [])
    print("fileScriptTypeSummaries:", type(fs))
    if fs:
        print("  Length:", len(fs))
        if len(fs) > 0:
            print("  First entry:", list(fs[0].keys())[:10] if isinstance(fs[0], dict) else fs[0][:1])


if __name__ == "__main__":
    main()