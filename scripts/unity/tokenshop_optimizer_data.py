#!/usr/bin/env python3
"""
TokenShop Optimizer Data Builder
Combines all data needed for the optimizer into one file.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

ROOT = Path(__file__).resolve().parents[2]


def build_optimizer_data():
    print("=== Building TokenShop Optimizer Data ===\n")
    
    # Load all source data
    with open(ROOT / "data" / "tokenshop-cost-model.json", encoding="utf-8") as f:
        cost_model = json.load(f)
    
    with open(ROOT / "data" / "tokenshop-ui-mapping.json", encoding="utf-8") as f:
        ui_mapping = json.load(f)
    
    # Build unified optimizer data
    optimizer_data = {
        "version": "1.0.0",
        "description": "TokenShop optimizer data - cost model + UI labels",
        "rows": {},
    }
    
    # Combine cost + UI
    for atu_name in sorted(cost_model.keys(), key=lambda x: int(x.replace("ATU","").replace("Button",""))):
        cost = cost_model[atu_name]
        ui = ui_mapping.get(atu_name, {})
        
        row_id = int(atu_name.replace("ATU","").replace("Button",""))  # 1-28
        
        optimizer_data["rows"][row_id] = {
            "field_name": atu_name,
            "path_id": cost["path_id"],
            "tier": cost["tier"],
            "type": cost["type"],
            "prefab": cost.get("prefab"),
            # UI Labels
            "title": ui.get("title", cost["type"]),
            "bonus_label": ui.get("bonus_label", ""),
            # Cost Model
            "start_cost": cost["start_cost"],
            "additive_cost": cost["additive_cost"],
            "max_level": cost["max_level"],
            "formula": f"cost = {cost['start_cost']} + (level - 1) * {cost['additive_cost']}",
            # Bonus effect (if known)
            "bonus_value": cost.get("bonus"),
        }
    
    # Print summary
    print("Optimzer Data Summary:")
    print(f"  Total rows: {len(optimizer_data['rows'])}")
    print(f"  T1 rows: {sum(1 for r in optimizer_data['rows'].values() if r['tier'] == 't1')}")
    print(f"  T2 rows: {sum(1 for r in optimizer_data['rows'].values() if r['tier'] == 't2')}")
    print(f"  T3 rows: {sum(1 for r in optimizer_data['rows'].values() if r['tier'] == 't3')}")
    print(f"  T4+ rows: {sum(1 for r in optimizer_data['rows'].values() if r['tier'] in ['t4', 't5'])}")
    
    print("\nRow Details:")
    for row_id, row in sorted(optimizer_data["rows"].items()):
        print(f"  {row_id:2}. {row['title'][:30]:30} | L{row['max_level'] if row['max_level'] else '?':>4} | {row['start_cost']:>12,.0f} + (L-1)*{row['additive_cost']}")
    
    # Save
    output = ROOT / "data" / "tokenshop-optimizer-data.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(optimizer_data, f, indent=2)
    
    print(f"\nSaved to {output}")
    
    # Also print what the optimizer needs from player
    print("\n" + "="*60)
    print("DATA NEEDED FROM PLAYER TO RUN OPTIMIZER:")
    print("="*60)
    print("""
To run the optimizer, we need from the player's save:
1. Current ATU levels: ATU1Level through ATU28Level (int values)
2. Current Token balance (for cost calculations)
3. (Optional) Current Diamond balance (for diamond upgrades)

The optimizer will then:
- Read current levels from player save
- Calculate total tokens to max all upgrades
- Calculate token-per-level for each upgrade
- Determine optimal upgrade order based on cost/effect ratio

Example player input format:
{
  "ATU1Level": 5,
  "ATU2Level": 2,
  "ATU3Level": 10,
  ... (all 28 levels)
}
""")


if __name__ == "__main__":
    build_optimizer_data()