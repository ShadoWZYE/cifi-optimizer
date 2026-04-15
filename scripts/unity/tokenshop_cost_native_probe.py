#!/usr/bin/env python3
"""
TokenShop Native Method Probe - Find get_ATU*Cost in libil2cpp.so
Uses ELF PLT/GOT to find method addresses and basic disassembly.
"""

from __future__ import annotations

import json
import re
import struct
import sys
from collections import defaultdict
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

ROOT = Path(__file__).resolve().parents[2]
VENDOR_PATH = ROOT / ".vendor_manual"
if str(VENDOR_PATH) not in sys.path:
    sys.path.insert(0, str(VENDOR_PATH))

from capstone import Cs, CS_ARCH_X86, CS_MODE_64
from elftools.elf.elffile import ELFFile


LIBIL2CPP_PATH = ROOT / "workbench" / "apk" / "base" / "libil2cpp.so"
JSON_OUT = ROOT / "data" / "tokenshop-cost-native-probe.json"
MD_OUT = ROOT / "docs" / "systems" / "spend" / "tokenshop-cost-native-probe.md"


RIP_LOAD_RE = re.compile(r"\[rip (?P<sign>[+-]) (?P<offset>0x[0-9a-f]+)\]")
FIELD_READ_RE = re.compile(r"\[(?P<base>rbx|r14|r12|r13|r15) \+ (?P<offset>0x[0-9a-f]+)\]")


def load_plt_and_rela(elf):
    """Load PLT and RELA sections to build symbol map."""
    plt = elf.get_section_by_name(".plt")
    rela = elf.get_section_by_name(".rela.plt") or elf.get_section_by_name(".rel.plt")
    
    if plt is None or rela is None:
        return None, None, {}
    
    dynsym = elf.get_section(rela["sh_link"])
    if dynsym is None:
        return None, None, {}
    
    section_bias = int(plt["sh_addr"]) - int(plt["sh_offset"])
    
    got_to_name = {}
    for rel in rela.iter_relocations():
        r_offset = int(rel["r_offset"])
        sym = dynsym.get_symbol(rel["r_info_sym"])
        if sym:
            got_to_name[r_offset] = sym.name
    
    return plt, rela, got_to_name, section_bias


def find_method_in_plt(plt_data, rela_data, got_to_name, section_bias, method_name):
    """Find a method's address in PLT by looking for its stub."""
    plt_start = plt_data.header.sh_addr
    plt_size = plt_data.header.sh_size
    
    with open(LIBIL2CPP_PATH, 'rb') as f:
        f.seek(plt_data.header.sh_offset)
        plt_bytes = f.read(plt_size)
    
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    
    for insn in md.disasm(plt_bytes, plt_start):
        if insn.mnemonic == 'jmp':
            match = RIP_LOAD_RE.search(insn.op_str)
            if match:
                displacement = int(match.group("offset"), 16)
                if match.group("sign") == "-":
                    displacement = -displacement
                
                got_file_offset = int(insn.address) + int(insn.size) + displacement
                sym_name = got_to_name.get(got_file_offset)
                
                if sym_name == method_name:
                    return int(insn.address)
    
    return None


def disassemble_at_rva(rva, length=100):
    """Disassemble bytes at an RVA."""
    with open(LIBIL2CPP_PATH, 'rb') as f:
        f.seek(rva)
        code = f.read(length)
    
    md = Cs(CS_ARCH_X86, CS_MODE_64)
    return list(md.disasm(code, rva))


def analyze_cost_method(rva):
    """Analyze a get_ATU*Cost method."""
    instructions = disassemble_at_rva(rva, 200)
    
    # Find field reads
    field_reads = []
    for insn in instructions:
        if insn.mnemonic in ['mov', 'movsd', 'movss', 'add', 'addsd', 'sqrtss']:
            match = FIELD_READ_RE.search(insn.op_str)
            if match:
                field_reads.append({
                    "rva": hex(insn.address),
                    "mnemonic": insn.mnemonic,
                    "offset": match.group("offset"),
                    "base": match.group("base"),
                })
    
    # Find calls to helpers
    calls = []
    for insn in instructions:
        if insn.mnemonic == 'call':
            calls.append(insn.op_str)
    
    return {
        "rva": hex(rva),
        "instruction_count": len(instructions),
        "field_reads": field_reads[:10],
        "calls": calls[:5],
    }


def main():
    print("=== TokenShop Native Method Probe ===\n")
    
    # Load ELF
    print("Loading libil2cpp.so...")
    with open(LIBIL2CPP_PATH, 'rb') as f:
        elf = ELFFile(f)
    
    plt, rela, got_to_name, section_bias = load_plt_and_rela(elf)
    
    if plt is None:
        print("ERROR: Could not find PLT/RELA sections")
        return
    
    print(f"  PLT: {plt.header.sh_offset} - {plt.header.sh_size} bytes")
    print(f"  GOT entries: {len(got_to_name)}")
    
    # Find get_ATU*Cost methods
    print("\n=== Finding get_ATU*Cost methods ===")
    
    results = {
        "dataset": "tokenshop-cost-native-probe",
        "generatedAt": str(date.today()),
        "source": {"libIl2cpp": "workbench/apk/base/libil2cpp.so"},
        "methods": {},
    }
    
    for i in range(1, 29):
        method_name = f"get_ATU{i}Cost"
        
        # Find in PLT
        method_rva = find_method_in_plt(plt, rela, got_to_name, section_bias, method_name)
        
        if method_rva:
            print(f"  {method_name}: 0x{method_rva:x}")
            
            # Analyze the method
            analysis = analyze_cost_method(method_rva)
            results["methods"][method_name] = analysis
            
            print(f"    Instructions: {analysis['instruction_count']}")
            print(f"    Field reads: {len(analysis['field_reads'])}")
            for fr in analysis['field_reads'][:3]:
                print(f"      [{fr['base']} + {fr['offset']}]")
        else:
            print(f"  {method_name}: NOT FOUND in PLT")
    
    # Save results
    with open(JSON_OUT, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nSaved to {JSON_OUT}")


if __name__ == "__main__":
    main()