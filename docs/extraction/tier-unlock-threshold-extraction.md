# Tier Unlock Threshold Extraction Guide

## Background

Tier unlock thresholds (25, 50, 100, 150) are embedded in the IL2CPP native binary, not in metadata. This document outlines how to extract them.

## What We Know

### Verified from Metadata (global-metadata.dat):

- Method names: `get_TotalT1TokenLevels` through `get_TotalT5TokenLevels` at offsets 658768+
- SaveData fields: `Tier2TokensUnlocked` (1916), `Tier3TokensUnlocked` (1917), `Tier4TokensUnlocked` (1918), `Tier5TokensUnlocked` (1919)
- Field type: `System.Boolean` (bool)

**Important**: These method names exist in `global-metadata.dat`, NOT in `libil2cpp.so`. The native binary may have these methods stripped or renamed.

### Not Verified (IL2CPP Embedded):

- Exact threshold values (25, 50, 100, 150) - these are hardcoded in native assembly code

## Why Strings Not in Binary?

IL2CPP compilation often strips or renames method names. The strings we found in trace bundle come from Unity metadata, not the native binary. To find thresholds, we need to:

1. Find the actual function that checks tier unlock status in the native binary
2. Disassemble that function to find hardcoded comparison values

## Approach

### Option 1: Use Ghidra (Recommended)

1. Download and install Ghidra
2. Open `workbench/apk/base/libil2cpp.so`
3. Search for `Tier2TokensUnlocked` string reference
4. Navigate to the function that writes to this SaveData field
5. Read the comparison constants in x86_64 assembly

### Option 2: Binary Analysis with Correct Offsets

The SaveData object is at a known offset. Look for code that:

- References SaveData base + offset 1916-1919 (where tier flags are stored)
- Calls get_Total\*TokenLevels methods
- Compares against threshold constants

## Status

| Item             | Status       | Source           |
| ---------------- | ------------ | ---------------- |
| Method names     | ✅ Verified  | Metadata (658k+) |
| Field offsets    | ✅ Verified  | UABEA probe      |
| Ghidra installed | ✅ Available | tools/ghidra/    |
| JDK 21 installed | ✅ Available | tools/jdk/       |
| Threshold values | ❌ Pending   | Ghidra analysis  |

## Tools Needed

1. **Ghidra** (recommended): Free reverse engineering suite - load binary, search strings, navigate to function, read assembly
   - Location: `tools/ghidra/ghidra_12.0.4_PUBLIC/`
   - Requires JDK 21: `tools/jdk/jdk-21.0.10+7/`
   - Run: `JAVA_HOME=tools/jdk/jdk-21.0.10+7 ./tools/ghidra/ghidra_12.0.4_PUBLIC/ghidraRun.bat`
2. **IDA Pro** (optional): Professional disassembly

## References

- Trace bundle: `data/unity-trace-bundle.json` (method string metadata offsets)
- UABEA probe: `data/uabea-probe-report.json` (SaveData field offsets 1916-1919)
