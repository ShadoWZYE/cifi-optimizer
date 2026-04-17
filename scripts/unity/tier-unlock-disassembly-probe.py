#!/usr/bin/env python3
"""
Tier Unlock Disassembly Probe - Use pyelftools properly
"""

import json
import re
import struct
import sys
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

ROOT = Path(__file__).resolve().parents[2]
VENDOR_PATH = ROOT / ".vendor_manual"
if str(VENDOR_PATH) not in sys.path:
    sys.path.insert(0, str(VENDOR_PATH))

# Use struct directly instead of elftools
import lief


LIBIL2CPP_PATH = ROOT / "workbench" / "apk" / "base" / "libil2cpp.so"
JSON_OUT = ROOT / "data" / "tier-unlock-disassembly.json"

METHOD_NAMES = [
    "get_TotalT1TokenLevels",
    "get_TotalT2TokenLevels", 
    "get_TotalT3TokenLevels",
    "get_TotalT4TokenLevels",
    "get_TotalT5TokenLevels",
    "get_TotalTokenLevels"
]


def main():
    print(f"Loading {LIBIL2CPP_PATH}...")
    
    binary = lief.parse(str(LIBIL2CPP_PATH))
    
    if not binary:
        print("Failed to parse binary")
        return
    
    print(f"  Binary type: {binary.format}")
    print(f"  Architecture: {binary.header.machine_type}")
    
    # Get all symbols
    print("\nSearching for method symbols...")
    
    symbols_found = {}
    for symbol in binary.symbols:
        for name in METHOD_NAMES:
            if symbol.name and name in symbol.name:
                symbols_found[name] = {
                    "address": hex(symbol.value) if symbol.value else None,
                    "size": symbol.size
                }
                print(f"  Found {name} at {hex(symbol.value) if symbol.value else 'N/A'}")
    
    # Get all strings in binary
    print("\nSearching for strings...")
    strings_found = {}
    for section in binary.sections:
        if section.name in [".rodata", ".dynstr", ".data"]:
            try:
                content = section.content
                for name in METHOD_NAMES:
                    search = name.encode()
                    pos = bytes(content).find(search)
                    if pos >= 0:
                        strings_found[name] = hex(section.offset + pos)
            except:
                pass
    
    print(f"Strings found: {strings_found}")
    
    results = {
        "description": "ELF analysis for tier unlock methods",
        "symbols": symbols_found,
        "strings": strings_found
    }
    
    # Try to find functions and disassemble them
    print("\nAnalyzing functions...")
    
    from capstone import Cs, CS_ARCH_X86, CS_MODE_64
    
    for name, info in symbols_found.items():
        if info["address"]:
            try:
                addr = int(info["address"], 16)
                # Read some bytes at this address
                with open(LIBIL2CPP_PATH, 'rb') as f:
                    # This is a file offset, not a virtual address
                    # We need to find the right offset
                    pass
            except:
                pass
    
    with open(JSON_OUT, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"Wrote to {JSON_OUT}")


if __name__ == "__main__":
    main()