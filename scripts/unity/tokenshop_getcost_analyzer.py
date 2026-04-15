#!/usr/bin/env python3
"""
TokenShop GetCost Method Analyzer
Finds the actual get_ATU*Cost methods and traces their implementation.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
ROOT = Path(__file__).resolve().parents[2]


def main():
    print("=== TokenShop get_ATU*Cost Method Analysis ===\n")
    
    # Read metadata as binary for more detailed analysis
    with open(ROOT / "workbench" / "apk" / "base" / "global-metadata.dat", 'rb') as f:
        data = f.read()
    
    # Get all ASCII strings
    ascii_strings = re.findall(b'[\x20-\x7e]{4,}', data)
    decoded = [s.decode('ascii') for s in ascii_strings]
    
    # Find methods that call get_ATU*Cost to see what they do
    print("=== Methods that reference get_ATU*Cost ===\n")
    
    # Find related methods
    related = []
    for s in decoded:
        if 'get_ATU' in s or 'ATU' in s:
            if any(k in s for k in ['Cost', 'Level', 'Bonus', 'Start', 'Add', 'Max', 'Fill']):
                related.append(s)
    
    # Group by ATU number
    by_atu = {}
    for r in related:
        match = re.search(r'ATU(\d+)', r)
        if match:
            num = int(match.group(1))
            if num not in by_atu:
                by_atu[num] = []
            by_atu[num].append(r)
    
    for num in sorted(by_atu.keys())[:5]:  # Show first 5 ATUs
        print(f"ATU{num}:")
        for r in sorted(by_atu[num])[:10]:
            print(f"  {r}")
    
    # Now let's find what the actual cost formula is
    # Look for any method that combines StartCost + AdditiveCost
    print("\n=== Searching for cost calculation patterns ===\n")
    
    calc_patterns = []
    for s in decoded:
        # Look for patterns like: StartCost * AdditiveCost, StartCost + level * Additive, etc.
        if any(p in s for p in ['TokenBoostStartCost', 'DiamondBoostStartCost', 'CellBoostStartCost']):
            if any(p in s for p in ['AdditiveCost', 'Bonus', 'MaxLevel']):
                calc_patterns.append(s)
    
    # These are just the field names, not the formula
    # The formula must be in the method implementation
    
    # Let's look at what else is around these methods in the metadata
    # Find TokenShop class full definition
    print("\n=== TokenShop related methods ===\n")
    ts_methods = set()
    for s in decoded:
        if 'TokenShop' in s:
            ts_methods.add(s)
    
    for m in sorted(ts_methods)[:30]:
        print(f"  {m}")


if __name__ == "__main__":
    main()