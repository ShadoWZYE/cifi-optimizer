#!/usr/bin/env python3
"""
TokenShop Title Discovery Probe
Targeted probe to find missing title-to-shell connections for ATU1, ATU2, ATU4, ATU5, ATU13, ATU20
"""

import argparse
import json
import re
from pathlib import Path
from typing import Any

ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")

ROOT = Path(__file__).resolve().parents[2]

TARGET_PATH_IDS = {
    15839: "ATU1Button",   # TokenBoost
    15804: "ATU2Button",   # DiamondBoost
    15796: "ATU4Button",   # ModBoost
    15831: "ATU5Button",   # MK1TokenBoost
    15821: "ATU13Button",  # TokenBoostT2
    15812: "ATU20Button", # TokenBoostT3
}

TITLE_CANDIDATES = {
    "Tokens Booster T1": 15839,
    "Tokens Booster T2": 15821,
    "Tokens Booster T3": 15812,
    "Tokens Booster": 15839,
    "Token Ultima: MP": 15796,
    "Mod Points Booster": 15796,
    "1. MK1 Generator Output": 15831,
}


def collect_strings(blob: bytes) -> list[dict[str, Any]]:
    entries = []
    for match in ASCII_RE.finditer(blob):
        value = match.group().decode("ascii", errors="ignore")
        entries.append({"offset": match.start(), "kind": "ascii", "value": value})
    for match in UTF16_RE.finditer(blob):
        value = match.group().decode("utf-16le", errors="ignore")
        entries.append({"offset": match.start(), "kind": "utf16", "value": value})
    entries.sort(key=lambda item: int(item["offset"]))
    return entries


def search_for_path_id_references(entries: list[dict[str, Any]], target_ids: list[int]) -> list[dict[str, Any]]:
    results = []
    for entry in entries:
        value = str(entry["value"])
        for pid in target_ids:
            if str(pid) in value:
                results.append({
                    "path_id": pid,
                    "offset": entry["offset"],
                    "kind": entry["kind"],
                    "value": value,
                    "context": "path_id_reference"
                })
    return results


def search_for_title_nearby(entries: list[dict[str, Any]], title_candidates: dict[str, int], radius: int = 20) -> list[dict[str, Any]]:
    results = []
    entries_by_offset = {int(e["offset"]): e for e in entries}
    
    for title, target_pid in title_candidates.items():
        title_lower = title.lower()
        for i, entry in enumerate(entries):
            if title_lower in str(entry["value"]).lower():
                entry_offset = int(entry["offset"])
                start_idx = max(0, i - radius)
                end_idx = min(len(entries), i + radius + 1)
                context = entries[start_idx:end_idx]
                
                has_path_id_nearby = False
                for ctx_entry in context:
                    ctx_val = str(ctx_entry["value"])
                    for pid in TARGET_PATH_IDS.keys():
                        if str(pid) in ctx_val:
                            has_path_id_nearby = True
                            break
                
                results.append({
                    "title": title,
                    "target_path_id": target_pid,
                    "offset": entry_offset,
                    "has_path_id_nearby": has_path_id_nearby,
                    "context_sample": [str(e["value"])[:50] for e in context[::3]]
                })
    return results


def search_method_signatures(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results = []
    method_pattern = re.compile(r"^(Set|Get|Update).*(TokenBoost|DiamondBoost|ModBoost|CellBoost|ATU\d+|Booster).*[Tt]itle$", re.IGNORECASE)
    
    for entry in entries:
        value = str(entry["value"])
        if method_pattern.search(value):
            results.append({
                "offset": entry["offset"],
                "kind": entry["kind"],
                "value": value,
                "context": "title_method_signature"
            })
    return results


def search_prefab_title_pairs(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results = []
    
    prefab_pattern = re.compile(r"NewTokenUPGPrefab\.T1\.(\w+)", re.IGNORECASE)
    title_patterns = [
        r"Tokens Booster",
        r"Diamond Boost",
        r"Mod Points Booster",
    ]
    title_re = re.compile("|".join(title_patterns), re.IGNORECASE)
    
    prefabs_by_offset = {}
    titles_by_offset = {}
    
    for entry in entries:
        offset = int(entry["offset"])
        value = str(entry["value"])
        
        prefab_match = prefab_pattern.search(value)
        if prefab_match:
            prefabs_by_offset[offset] = {"value": value, "match": prefab_match.group(1)}
        
        if title_re.search(value):
            titles_by_offset[offset] = value
    
    for prefab_offset, prefab_data in prefabs_by_offset.items():
        for title_offset, title_value in titles_by_offset.items():
            if abs(title_offset - prefab_offset) < 10000:
                results.append({
                    "prefab_offset": prefab_offset,
                    "prefab_value": prefab_data["value"],
                    "prefab_key": prefab_data["match"],
                    "title_offset": title_offset,
                    "title_value": title_value,
                    "distance": abs(title_offset - prefab_offset),
                    "context": "prefab_title_pair"
                })
    
    return sorted(results, key=lambda x: x["distance"])


def search_direct_joins(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Look for direct ATU1Button, ATU2Button, etc. references in title context"""
    results = []
    
    button_field_pattern = re.compile(r"ATU\d+Button", re.IGNORECASE)
    
    for entry in entries:
        value = str(entry["value"])
        if button_field_pattern.search(value):
            results.append({
                "offset": entry["offset"],
                "kind": entry["kind"],
                "value": value,
                "context": "button_field_reference"
            })
    
    return results


def main() -> int:
    parser = argparse.ArgumentParser(description="TokenShop Title Discovery Probe")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    metadata_path = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"
    level0_path = ROOT / "workbench" / "unity" / "joined" / "level0"

    results = {
        "dataset": "token-shop-title-discovery-probe",
        "target_path_ids": TARGET_PATH_IDS,
        "findings": {}
    }

    if metadata_path.exists():
        print(f"Searching {metadata_path.name}...")
        metadata_blob = metadata_path.read_bytes()
        metadata_entries = collect_strings(metadata_blob)
        
        results["findings"]["path_id_references"] = search_for_path_id_references(
            metadata_entries, list(TARGET_PATH_IDS.keys())
        )
        results["findings"]["title_methods"] = search_method_signatures(metadata_entries)
        results["findings"]["direct_button_joins"] = search_direct_joins(metadata_entries)

    if level0_path.exists():
        print(f"Searching {level0_path.name}...")
        level0_blob = level0_path.read_bytes()
        level0_entries = collect_strings(level0_blob)
        
        results["findings"]["title_nearby_search"] = search_for_title_nearby(
            level0_entries, TITLE_CANDIDATES
        )
        results["findings"]["prefab_title_pairs"] = search_prefab_title_pairs(level0_entries)
        results["findings"]["direct_button_joins_level0"] = search_direct_joins(level0_entries)

    output_path = args.output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    
    print(f"Results written to {output_path}")
    print(f"  - Path ID references found: {len(results['findings'].get('path_id_references', []))}")
    print(f"  - Title methods found: {len(results['findings'].get('title_methods', []))}")
    print(f"  - Title nearby search: {len(results['findings'].get('title_nearby_search', []))}")
    print(f"  - Prefab-title pairs: {len(results['findings'].get('prefab_title_pairs', []))}")
    print(f"  - Direct button joins: {len(results['findings'].get('direct_button_joins', []))}")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())