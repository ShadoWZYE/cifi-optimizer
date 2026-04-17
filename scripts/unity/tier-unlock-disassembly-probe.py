#!/usr/bin/env python3
"""
Tier Unlock Disassembly Probe - Search for any tier-related strings
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

ROOT = Path(__file__).resolve().parents[2]
VENDOR_PATH = ROOT / ".vendor_manual"
if str(VENDOR_PATH) not in sys.path:
    sys.path.insert(0, str(VENDOR_PATH))

from capstone import Cs, CS_ARCH_X86, CS_MODE_64


LIBIL2CPP_PATH = ROOT / "workbench" / "apk" / "base" / "libil2cpp.so"
JSON_OUT = ROOT / "data" / "tier-unlock-disassembly.json"


def main():
    print(f"Loading {LIBIL2CPP_PATH}")
    
    with open(LIBIL2CPP_PATH, 'rb') as f:
        data = f.read()
    
    print(f"  Binary size: {len(data)} bytes")
    
    # Search for various tier-related patterns
    search_patterns = [
        b"TokenLevels",
        b"TierUnlocked",
        b"get_Total",
        b"Tier2",
        b"Tier3",
        b"Tier4",
        b"Tier5",
    ]
    
    print("\nSearching for tier-related strings...")
    for pattern in search_patterns:
        pos = data.find(pattern)
        if pos >= 0:
            # Get some context
            context = data[pos:pos+50]
            try:
                text = context.decode('ascii', errors='ignore').split('\x00')[0]
                print(f"  {pattern.decode()}: {hex(pos)} -> {text}")
            except:
                print(f"  {pattern.decode()}: {hex(pos)}")
    
    # Now scan for comparison instructions with specific values
    print("\nScanning for comparison instructions with threshold values...")
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    
    # Focus on the code section area (after headers, typical .text starts around 0x1000)
    # Sample more aggressively
    threshold_values = {}
    
    # Scan in 1MB chunks
    for chunk_start in range(0x100000, min(len(data), 60_000_000), 500_000):
        chunk = data[chunk_start:chunk_start + 500_000]
        
        try:
            for insn in md.disasm(chunk, chunk_start):
                if insn.mnemonic == 'cmp':
                    match = re.search(r'\$(-?\d+)', insn.op_str)
                    if match:
                        value = int(match.group(1))
                        if 20 <= value <= 160:  # Range of interest
                            if value not in threshold_values:
                                threshold_values[value] = []
                            threshold_values[value].append({
                                'rva': hex(insn.address),
                                'instr': f"{insn.mnemonic} {insn.op_str}"
                            })
        except:
            pass
    
    print(f"\nFound threshold candidates: {sorted(threshold_values.keys())}")
    
    results = {
        "threshold_candidates": sorted(threshold_values.keys()),
        "details": {str(k): v[:5] for k, v in threshold_values.items()}
    }
    
    with open(JSON_OUT, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"Wrote to {JSON_OUT}")


if __name__ == "__main__":
    main()