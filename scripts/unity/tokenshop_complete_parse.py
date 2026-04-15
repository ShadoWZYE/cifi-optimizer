#!/usr/bin/env python3
"""
TokenShop Complete Parser - V3
Comprehensive extraction with full cost field sets for each ATU.
"""

from __future__ import annotations

import json
import re
import struct
import sys
import types
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from portable_paths import repo_relative

ROOT = Path(__file__).resolve().parents[2]
JSON_OUT = ROOT / "data" / "tokenshop-complete-parse.json"
VALUES_JSON = ROOT / "data" / "token-shop-values.json"
FULL_MAPPING_JSON = ROOT / "data" / "token-shop-full-mapping.json"


# ATU button mapping - complete with known info from prior probes
ATU_BUTTONS = {
    15839: {"name": "ATU1Button", "tier": "t1", "type": "Token Boost", "prefab": "NewTokenUPGPrefab.T1.TokensBoost"},
    15804: {"name": "ATU2Button", "tier": "t1", "type": "Diamond Boost", "prefab": "NewDiamondUPGPrefab.T1.DiamondBoost"},
    15810: {"name": "ATU3Button", "tier": "t1", "type": "Cells Boost", "prefab": "NewTokenUPGPrefab.T1.CellsPerChestBooster"},
    15796: {"name": "ATU4Button", "tier": "t1", "type": "Mod Points Boost", "prefab": "NewTokenUPGPrefab.T1.ModPointsBooster"},
    15831: {"name": "ATU5Button", "tier": "t1", "type": "MK1 Generator", "prefab": "NewTokenUPGPrefab.T1.MK1Booster"},
    15835: {"name": "ATU6Button", "tier": "t1", "type": "MK2 Generator", "prefab": "NewTokenUPGPrefab.T1.MK2Booster"},
    15792: {"name": "ATU7Button", "tier": "t1", "type": "MK3 Generator", "prefab": "NewTokenUPGPrefab.T1.MK3Booster"},
    15795: {"name": "ATU8Button", "tier": "t1", "type": "MK4 Generator", "prefab": "NewTokenUPGPrefab.T1.MK4Booster"},
    15845: {"name": "ATU9Button", "tier": "t1", "type": "MK5 Generator", "prefab": "NewTokenUPGPrefab.T1.MK5Booster"},
    15837: {"name": "ATU10Button", "tier": "t1", "type": "MK6 Generator", "prefab": "NewTokenUPGPrefab.T1.MK6Booster"},
    15793: {"name": "ATU11Button", "tier": "t1", "type": "MK7 Generator", "prefab": "NewTokenUPGPrefab.T1.MK7Booster"},
    15814: {"name": "ATU12Button", "tier": "t1", "type": "MK8 Generator", "prefab": "NewTokenUPGPrefab.T1.MK8Booster"},
    15821: {"name": "ATU13Button", "tier": "t2", "type": "Duo 1", "prefab": "NewTokenUPGPrefab.T2.DuoBoosterOne"},
    15844: {"name": "ATU14Button", "tier": "t2", "type": "Duo 2", "prefab": "NewTokenUPGPrefab.T2.DuoBoosterTwo"},
    15850: {"name": "ATU15Button", "tier": "t2", "type": "Duo 3", "prefab": "NewTokenUPGPrefab.T2.DuoBoosterThree"},
    15827: {"name": "ATU16Button", "tier": "t2", "type": "Duo 4", "prefab": "NewTokenUPGPrefab.T2.DuoBoosterFour"},
    15841: {"name": "ATU17Button", "tier": "t2", "type": "Duo 5", "prefab": "NewTokenUPGPrefab.T2.DuoBoosterFive"},
    15834: {"name": "ATU18Button", "tier": "t2", "type": "Duo 6", "prefab": "NewTokenUPGPrefab.T2.DuoBoosterSix"},
    15842: {"name": "ATU19Button", "tier": "t3", "type": "Trinity 1", "prefab": "NewTokenUPGPrefab.T3.TrinityBoosterOne"},
    15812: {"name": "ATU20Button", "tier": "t3", "type": "T3 Tokens", "prefab": "NewTokenUPGPrefab.T3.TokensBoost"},
    15829: {"name": "ATU21Button", "tier": "t3", "type": "Trinity 1", "prefab": "NewTokenUPGPrefab.T3.TrinityBoosterOne"},
    15806: {"name": "ATU22Button", "tier": "t3", "type": "Trinity 2", "prefab": "NewTokenUPGPrefab.T3.TrinityBoosterTwo"},
    15828: {"name": "ATU23Button", "tier": "t3", "type": "Trinity 3", "prefab": "NewTokenUPGPrefab.T3.DailyTokens"},
    15797: {"name": "ATU24Button", "tier": "t4", "type": "Ultima Shards", "prefab": "NewTokenUPGPrefab.T4.Ultima"},
    15820: {"name": "ATU25Button", "tier": "t4", "type": "Ultima", "prefab": "NewTokenUPGPrefab.T4.Ultima"},
    15840: {"name": "ATU26Button", "tier": "t5", "type": "Campaign Fragments", "prefab": "NewTokenUPGPrefab.T5.CampaignFragments"},
    15832: {"name": "ATU27Button", "tier": "t5", "type": "Ultima RP", "prefab": "NewTokenUPGPrefab.T5.UltimaRP"},
    15813: {"name": "ATU28Button", "tier": "t5", "type": "Ultima MP", "prefab": "NewTokenUPGPrefab.T5.UltimaMP"},
}


def main() -> int:
    print("Loading token-shop-values.json...")
    values_data = json.loads(VALUES_JSON.read_text(encoding="utf-8"))
    fields = values_data.get("fields", [])
    print(f"  - {len(fields)} fields parsed")
    
    # Build field lookup by name
    field_by_name = {f["field"]: f for f in fields}
    field_by_offset = {f["object_offset"]: f for f in fields}
    
    # Load full mapping for buy hooks and grounded notes
    print("Loading token-shop-full-mapping.json...")
    try:
        full_mapping_data = json.loads(FULL_MAPPING_JSON.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        # Try to fix the malformed JSON - extract just the groundedRows array
        content = FULL_MAPPING_JSON.read_text(encoding="utf-8")
        # Find the groundedRows array and extract it
        import re
        match = re.search(r'"groundedRows":\s*\[(.*?)\]\s*\]', content, re.DOTALL)
        if match:
            # Rebuild proper JSON
            fixed = '{"groundedRows": [' + match.group(1) + ']}'
            full_mapping_data = json.loads(fixed)
        else:
            full_mapping_data = {"groundedRows": []}
    
    grounded_rows = full_mapping_data.get("groundedRows", [])
    
    # Build lookup from field name to grounded info
    grounded_by_field = {}
    for row in grounded_rows:
        field = row.get("field", "")
        if field:
            grounded_by_field[field] = row
    
    # Build comprehensive ATU mapping
    print("\n=== Building ATU Mapping ===")
    
    # Map cost field names by ATU - based on token-shop-values.json structure
    # Pattern: Each ATU button has 4 cost fields before it (or 5 for some late ATUs)
    # StartCost, AdditiveCost, Bonus, MaxLevel (or FillMaxLevel for some)
    
    cost_field_patterns = {
        "ATU1Button": ["TokenBoostStartCost", "TokenBoostAdditiveCost", "TokenBoostBonus", "TokenBoostMaxLevel"],
        "ATU2Button": ["DiamondBoostStartCost", "DiamondBoostAdditiveCost", "DiamondBoostBonus", "DiamondBoostMaxLevel"],
        "ATU3Button": ["CellBoostStartCost", "CellBoostAdditiveCost", "CellBoostBonus", "CellBoostMaxLevel"],
        "ATU4Button": ["ModBoostStartCost", "ModBoostAdditiveCost", "ModBoostBonus", "ModBoostMaxLevel"],
        "ATU5Button": ["MK1TokenBoostStartCost", "MK1TokenBoostAdditiveCost", "MK1TokenBoostBonus", "MK1TokenBoostFillMaxLevel"],
        "ATU6Button": ["MK2TokenBoostStartCost", "MK2TokenBoostAdditiveCost", "MK2TokenBoostBonus", "MK2TokenBoostFillMaxLevel"],
        "ATU7Button": ["MK3TokenBoostStartCost", "MK3TokenBoostAdditiveCost", "MK3TokenBoostBonus", "MK3TokenBoostFillMaxLevel"],
        "ATU8Button": ["MK4TokenBoostStartCost", "MK4TokenBoostAdditiveCost", "MK4TokenBoostBonus", "MK4TokenBoostFillMaxLevel"],
        "ATU9Button": ["MK5TokenBoostStartCost", "MK5TokenBoostAdditiveCost", "MK5TokenBoostBonus", "MK5TokenBoostFillMaxLevel"],
        "ATU10Button": ["MK6TokenBoostStartCost", "MK6TokenBoostAdditiveCost", "MK6TokenBoostBonus", "MK6TokenBoostFillMaxLevel"],
        "ATU11Button": ["MK7TokenBoostStartCost", "MK7TokenBoostAdditiveCost", "MK7TokenBoostBonus", "MK7TokenBoostFillMaxLevel"],
        "ATU12Button": ["MK8TokenBoostStartCost", "MK8TokenBoostAdditiveCost", "MK8TokenBoostBonus", "MK8TokenBoostFillMaxLevel"],
    }
    
    # Extended patterns for tier2-5 (approximated from token-shop-values.json)
    cost_field_patterns.update({
        "ATU13Button": ["TokenBoostT2StartCost", "TokenBoostT2AdditiveCost", "TokenBoostT2Bonus", "TokenBoostT2MaxLevel"],
        "ATU14Button": ["TokenDailiesT2StartCost", "TokenDailiesT2AdditiveCost", "TokenDailiesT2Bonus", "TokenDailiesT2MaxLevel"],
        "ATU15Button": ["T2Duo1StartCost", "T2Duo1AdditiveCost", "T2Duo1Bonus", "T2Duo1MaxLevel"],
        "ATU16Button": ["T2Duo2StartCost", "T2Duo2AdditiveCost", "T2Duo2Bonus", "T2Duo2MaxLevel"],
        "ATU17Button": ["T2Duo3StartCost", "T2Duo3AdditiveCost", "T2Duo3Bonus", "T2Duo3MaxLevel"],
        "ATU18Button": ["T2Duo4StartCost", "T2Duo4AdditiveCost", "T2Duo4Bonus", "T2Duo4MaxLevel"],
        "ATU19Button": ["T2Duo5StartCost", "T2Duo5AdditiveCost", "T2Duo5Bonus", "T2Duo5MaxLevel"],
        "ATU20Button": ["TokenBoostT3StartCost", "TokenBoostT3AdditiveCost", "TokenBoostT3Bonus", "TokenBoostT3MaxLevel"],
        "ATU21Button": ["TokenDailiesT3StartCost", "TokenDailiesT3AdditiveCost", "TokenDailiesT3Bonus", "TokenDailiesT3MaxLevel"],
        "ATU22Button": ["T3Trio1StartCost", "T3Trio1AdditiveCost", "T3Trio1Bonus", "T3Trio1MaxLevel"],
        "ATU23Button": ["T3Trio2StartCost", "T3Trio2AdditiveCost", "T3Trio2Bonus", "T3Trio2MaxLevel"],
        "ATU24Button": ["ATU24StartCost", "ATU24Bonus1", "ATU24Bonus2", "ATU24Bonus3"],
        "ATU25Button": ["ATU25StartCost", "ATU25AdditiveCost", "ATU25Bonus", "ATU25MaxLevel"],
        "ATU26Button": ["ATU26StartCost", "ATU26AdditiveCost", "ATU26Bonus", "ATU26MaxLevel"],
        "ATU27Button": ["ATU27StartCost", "ATU27AdditiveCost", "ATU27Bonus", "ATU27MaxLevel"],
        "ATU28Button": ["ATU28StartCost", "ATU28AdditiveCost", "ATU28Bonus", "ATU28MaxLevel"],
    })
    
    # Build the complete ATU mapping
    atu_complete = {}
    
    for pid, info in ATU_BUTTONS.items():
        name = info["name"]
        
        # Get cost field names
        cost_fields = cost_field_patterns.get(name, [])
        
        # Extract values from field_by_name
        cost_values = []
        for cf_name in cost_fields:
            if cf_name in field_by_name:
                fdata = field_by_name[cf_name]
                cost_values.append({
                    "field": cf_name,
                    "value": fdata.get("value"),
                    "raw_u32": fdata.get("raw_u32"),
                    "raw_f32": fdata.get("raw_f32"),
                })
        
        # Get grounded info if available
        level_field = name.replace("Button", "Level")
        grounded = grounded_by_field.get(level_field, {})
        
        atu_complete[name] = {
            "path_id": pid,
            "tier": info["tier"],
            "type": info["type"],
            "prefab": info["prefab"],
            "cost_fields": cost_values,
            "buy_hook": grounded.get("buyHook"),
            "grounded_note": grounded.get("groundedNote", grounded.get("groundedConclusion", ""))[:100],
        }
    
    # Print summary
    print("\n=== ATU Complete Mapping ===")
    for name, info in sorted(atu_complete.items(), key=lambda x: int(x[0].replace("ATU","").replace("Button",""))):
        print(f"\n{name} ({info['tier']} - {info['type']})")
        print(f"  path_id: {info['path_id']}")
        print(f"  prefab: {info['prefab']}")
        if info['buy_hook']:
            print(f"  buy_hook: {info['buy_hook']}")
        for cf in info['cost_fields']:
            print(f"  {cf['field']}: {cf['value']}")
    
    # Output result
    result = {
        "dataset": "tokenshop-complete-parse",
        "source": {
            "valuesJson": repo_relative(VALUES_JSON),
            "fullMappingJson": repo_relative(FULL_MAPPING_JSON),
            "totalFields": len(fields),
        },
        "controllerFields": [f for f in fields if f.get("group") == "controller"],
        "numericFieldsByTier": {
            "tier1": len([f for f in fields if f.get("group") == "tier1"]),
            "tier2": len([f for f in fields if f.get("group") == "tier2"]),
            "tier3": len([f for f in fields if f.get("group") == "tier3"]),
            "tier4plus": len([f for f in fields if f.get("group") == "tier4plus"]),
        },
        "atuComplete": atu_complete,
    }
    
    JSON_OUT.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n\nWrote to {JSON_OUT}")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())