#!/usr/bin/env python3
"""
TokenShop UI Text Mapping
Maps ATU rows to their player-facing UI text/labels.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

ROOT = Path(__file__).resolve().parents[2]
TITLE_PROBE = ROOT / "data" / "token-shop-title-discovery-probe.json"
COMPLETE_JSON = ROOT / "data" / "tokenshop-complete-parse.json"


def main():
    print("=== TokenShop UI Text Mapping ===\n")
    
    # Load title probe data
    title_data = json.loads(TITLE_PROBE.read_text(encoding="utf-8"))
    
    # Load complete mapping
    complete_data = json.loads(COMPLETE_JSON.read_text(encoding="utf-8"))
    atu_complete = complete_data.get("atuComplete", {})
    
    # Known player-facing titles from prior probes
    # These are collected from various sources
    KNOWN_TITLES = {
        "ATU1Button": "Tokens Booster",
        "ATU2Button": "Diamonds Booster",
        "ATU3Button": "Cells Booster",
        "ATU4Button": "Mod Points Booster",
        "ATU5Button": "Mk1 Generator Output",
        "ATU6Button": "Mk2 Generator Booster",
        "ATU7Button": "Mk3 Generator Booster",
        "ATU8Button": "Mk4 Generator Booster",
        "ATU9Button": "Mk5 Generator Booster",
        "ATU10Button": "Mk6 Generator Booster",
        "ATU11Button": "Mk7 Generator Booster",
        "ATU12Button": "Mk8 Generator Booster",
        "ATU13Button": "Duo Booster One",
        "ATU14Button": "Duo Booster Two",
        "ATU15Button": "Duo Booster Three",
        "ATU16Button": "Duo Booster Four",
        "ATU17Button": "Duo Booster Five",
        "ATU18Button": "Duo Booster Six",
        "ATU19Button": "Trio Booster One",
        "ATU20Button": "Tokens Booster T3",
        "ATU21Button": "Daily Tokens T3",
        "ATU22Button": "Trinity Booster Two",
        "ATU23Button": "Trinity Booster Three",
        "ATU24Button": "Ultima Shards",
        "ATU25Button": "Ultima",
        "ATU26Button": "Campaign Fragments",
        "ATU27Button": "Ultima RP",
        "ATU28Button": "Ultima MP",
    }
    
    # Known descriptions/bonuses
    KNOWN_BONUS_LABELS = {
        "ATU1Button": "Tokens Gained from Token Chests",
        "ATU2Button": "Diamonds Gained from Diamond Chests",
        "ATU3Button": "Seconds timeskip to Cells Gained from Token & Diamond Chests",
        "ATU4Button": "Mod Points Gained",
        "ATU5Button": "Mk1 Output",
        "ATU6Button": "Mk2 Output",
        "ATU7Button": "Mk3 Output",
        "ATU8Button": "Mk4 Output",
        "ATU9Button": "Mk5 Output",
        "ATU10Button": "Mk6 Output",
        "ATU11Button": "Mk7 Output",
        "ATU12Button": "Mk8 Output",
    }
    
    # Build UI mapping
    ui_mapping = {}
    
    for atu_name, info in atu_complete.items():
        path_id = info["path_id"]
        
        # Find matching titles from title probe
        matched_titles = []
        if "titles" in title_data:
            for t in title_data["titles"]:
                if t.get("target_path_id") == path_id:
                    matched_titles.append(t.get("title", ""))
        
        # Combine known titles with matched
        all_titles = list(set(matched_titles + [KNOWN_TITLES.get(atu_name, "")]))
        
        ui_mapping[atu_name] = {
            "path_id": path_id,
            "tier": info["tier"],
            "type": info["type"],
            "prefab": info.get("prefab"),
            "title": KNOWN_TITLES.get(atu_name, ""),
            "bonus_label": KNOWN_BONUS_LABELS.get(atu_name, ""),
            "matched_titles": matched_titles,
        }
    
    # Print mapping
    print("UI Text Mapping by ATU:\n")
    for name, ui in sorted(ui_mapping.items(), key=lambda x: int(x[0].replace("ATU","").replace("Button",""))):
        print(f"{name} ({ui['tier']}):")
        print(f"  Title: {ui['title']}")
        print(f"  Bonus: {ui['bonus_label']}")
        if ui['matched_titles']:
            print(f"  Also found: {ui['matched_titles']}")
        print()
    
    # Save mapping
    output = ROOT / "data" / "tokenshop-ui-mapping.json"
    with open(output, "w", encoding="utf-8") as f:
        json.dump(ui_mapping, f, indent=2)
    print(f"\nSaved to {output}")


if __name__ == "__main__":
    main()