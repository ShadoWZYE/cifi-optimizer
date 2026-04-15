#!/usr/bin/env python3
"""
TokenShop Cost Formula Analyzer - Fixed
Correctly identifies cost formulas based on actual game behavior.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

ROOT = Path(__file__).resolve().parents[2]
VALUES_JSON = ROOT / "data" / "token-shop-values.json"
COMPLETE_JSON = ROOT / "data" / "tokenshop-complete-parse.json"


def analyze_cost_formula():
    """Analyze cost patterns to derive formula - CORRECTED."""
    
    values_data = json.loads(VALUES_JSON.read_text(encoding="utf-8"))
    fields = values_data.get("fields", [])
    field_by_name = {f["field"]: f for f in fields}
    
    print("=== TokenShop Cost Formula Analysis (Corrected) ===\n")
    
    # KEY INSIGHT: All ATU costs use LINEAR formula:
    # cost_at_level_n = StartCost + (level - 1) * AdditiveCost
    # 
    # The "AdditiveCost" field name means "additional cost per level"
    # NOT "multiplier". The decimal values (like 0.1) are just small increments.
    #
    # The "Bonus" field is a SEPARATE value - it affects the upgrade EFFECT,
    # not the cost.
    
    # Load complete mapping
    complete_data = json.loads(COMPLETE_JSON.read_text(encoding="utf-8"))
    atu_complete = complete_data.get("atuComplete", {})
    
    cost_model = {}
    
    print("Cost Model by ATU (Linear Formula: cost = start + (level-1) * additive):\n")
    
    for atu_name, info in sorted(atu_complete.items(), key=lambda x: int(x[0].replace("ATU","").replace("Button",""))):
        cost_fields = info.get("cost_fields", [])
        
        start_cost = None
        additive_cost = None
        bonus = None
        max_level = None
        
        for cf in cost_fields:
            field = cf.get("field", "")
            value = cf.get("value")
            
            if "StartCost" in field:
                start_cost = value
            elif "AdditiveCost" in field:
                additive_cost = value
            elif "Bonus" in field:
                # Handle multi-bonus cases (ATU24 has Bonus1-5)
                if isinstance(value, list):
                    bonus = value  # Multiple bonus steps
                elif "Bonus" in field and "1" in field:  # e.g., ATU24Bonus1
                    bonus = cf  # Store as-is
                else:
                    bonus = value
            elif "MaxLevel" in field or "FillMaxLevel" in field:
                max_level = value
        
        # Always use linear formula
        formula = "linear"
        
        cost_model[atu_name] = {
            "path_id": info["path_id"],
            "tier": info["tier"],
            "type": info["type"],
            "prefab": info.get("prefab"),
            "start_cost": float(start_cost) if start_cost is not None else None,
            "additive_cost": float(additive_cost) if additive_cost is not None else None,
            "bonus": bonus,
            "max_level": int(max_level) if max_level is not None else None,
            "formula": f"cost = {start_cost} + (level - 1) * {additive_cost}",
        }
        
        # Print nicely
        print(f"{atu_name} ({info['tier']} - {info['type']}):")
        print(f"  Start: {start_cost}, Add: {additive_cost}, Max: {max_level}")
        
        # Show costs at key levels
        if start_cost is not None and additive_cost is not None:
            for level in [1, 2, 5, 10, max_level if max_level and max_level <= 20 else 20]:
                if level is None:
                    continue
                if max_level and level > max_level:
                    continue
                cost = start_cost + (level - 1) * additive_cost
                print(f"    L{level}: {cost:,.0f}")
        
        print()
    
    # Summarize by tier
    print("=== Summary by Tier ===\n")
    by_tier = defaultdict(list)
    for name, model in cost_model.items():
        by_tier[model["tier"]].append(name)
    
    for tier in ["t1", "t2", "t3", "t4", "t5"]:
        if tier in by_tier:
            print(f"{tier.upper()}: {len(by_tier[tier])} rows - {', '.join(by_tier[tier])}")
    
    # Save cost model
    output = ROOT / "data" / "tokenshop-cost-model.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(cost_model, f, indent=2)
    print(f"\nSaved to {output}")
    
    # Also create a simplified version for the app
    simplified = {}
    for name, model in cost_model.items():
        simplified[name] = {
            "path_id": model["path_id"],
            "tier": model["tier"],
            "type": model["type"],
            "start": model["start_cost"],
            "add": model["additive_cost"],
            "max": model["max_level"],
            "bonus": model["bonus"] if not isinstance(model["bonus"], dict) else str(model["bonus"]),
        }
    
    output_simple = ROOT / "data" / "tokenshop-cost-model-simple.json"
    with open(output_simple, "w", encoding="utf-8") as f:
        json.dump(simplified, f, indent=2)
    print(f"Saved simplified to {output_simple}")


if __name__ == "__main__":
    analyze_cost_formula()