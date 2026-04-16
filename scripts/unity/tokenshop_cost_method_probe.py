#!/usr/bin/env python3
"""
TokenShop get_ATU*Cost Method Probe
Like shard_cost_method_probe.py but for TokenShop get_ATU*Cost methods.
Finds the RVA and basic info from uabea-probe, then can trace into native code.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from portable_paths import md_link


ROOT = Path(__file__).resolve().parents[2]
VENDOR_PATH = ROOT / ".vendor_manual"
if str(VENDOR_PATH) not in sys.path:
    sys.path.insert(0, str(VENDOR_PATH))

UABEA_REPORT_PATH = ROOT / "data" / "uabea-probe-report.json"
JSON_OUT = ROOT / "data" / "tokenshop-cost-method-probe.json"
MD_OUT = ROOT / "docs" / "systems" / "spend" / "tokenshop-cost-method-probe.md"


ATU_COST_METHOD_RE = re.compile(r"^get_ATU(?P<row>\d+)Cost$")


def load_method_methods() -> list:
    """Load method data from uabea-probe-report.json."""
    report = json.loads(UABEA_REPORT_PATH.read_text(encoding="utf-8"))
    
    # Find TokenShop methods - need to search through method definitions
    methods = []
    
    # Check targetScriptIndexLookups for TokenShop
    tsil = report.get("targetScriptIndexLookups", [])
    
    # The structure is a list, need to find TokenShop entries
    for entry in tsil:
        if isinstance(entry, dict):
            name = entry.get("name", "")
            if "TokenShop" in name or "ATU" in name:
                methods.append(entry)
    
    return methods


def main():
    print("=== TokenShop get_ATU*Cost Method Probe ===\n")
    
    # Load methods
    print("Loading methods from uabea-probe-report.json...")
    all_methods = load_method_methods()
    print(f"  Found {len(all_methods)} TokenShop-related methods")
    
    # Find ATU cost methods
    atu_cost_methods = []
    for m in all_methods:
        name = m.get("name", "")
        match = ATU_COST_METHOD_RE.match(name)
        if match:
            row = int(match.group("row"))
            rva = m.get("methodProperties", {}).get("Rva")
            if rva:
                atu_cost_methods.append({
                    "name": name,
                    "row": row,
                    "rva": rva,
                    "signature": m.get("methodProperties", {}).get("HumanReadableSignature", ""),
                })
    
    print(f"\nFound {len(atu_cost_methods)} get_ATU*Cost methods:")
    for m in sorted(atu_cost_methods, key=lambda x: x["row"]):
        print(f"  ATU{m['row']}: {m['name']} at RVA {m['rva']}")
    
    # Also look for related helper methods
    print("\n=== Related helper methods ===")
    helper_patterns = ["GetATUCost", "CalculateTokenCost", "GetUpgradeCost", "TokenShopCost"]
    helper_methods = []
    for m in all_methods:
        name = m.get("name", "")
        if any(p.lower() in name.lower() for p in helper_patterns):
            rva = m.get("methodProperties", {}).get("Rva")
            if rva:
                helper_methods.append({
                    "name": name,
                    "rva": rva,
                })
    
    for h in helper_methods[:10]:
        print(f"  {h['name']} at RVA {h['rva']}")
    
    # Save results
    result = {
        "dataset": "tokenshop-cost-method-probe",
        "generatedAt": str(date.today()),
        "source": {
            "uabeaProbeReport": "data/uabea-probe-report.json",
        },
        "costGetterFamily": {
            "count": len(atu_cost_methods),
            "returnType": "Unknown (likely BigDouble)",
            "rows": atu_cost_methods,
        },
        "helperMethods": helper_methods[:20],
    }
    
    JSON_OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nSaved to {JSON_OUT}")


if __name__ == "__main__":
    main()