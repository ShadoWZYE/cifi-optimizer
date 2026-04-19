# Tier Unlock Threshold Extraction Guide

## Background

Tier unlock thresholds (25, 50, 100, 150) are embedded in the IL2CPP native binary, not in metadata.
This document outlines how to extract them using the repo's persistent-project Ghidra workflow.

## What We Know

### Verified from Metadata (global-metadata.dat):

- Method names: `get_TotalT1TokenLevels` through `get_TotalT5TokenLevels` at offsets 658768+
- SaveData fields: `Tier2TokensUnlocked` (1916), `Tier3TokensUnlocked` (1917), `Tier4TokensUnlocked` (1918), `Tier5TokensUnlocked` (1919)
- Field type: `System.Boolean` (bool)

**Important**: These method names exist in `global-metadata.dat`, NOT in `libil2cpp.so`. The native binary may have these methods stripped or renamed.

### Not Verified (IL2CPP Embedded):

- Exact threshold values (25, 50, 100, 150) - these are hardcoded in native assembly code

## Why Strings Not in Binary?

IL2CPP compilation often strips or renames method names. The strings we found in the centralized trace unit come from Unity metadata, not the native binary. To find thresholds, we need to:

1. Find the actual function that checks tier unlock status in the native binary
2. Disassemble that function to find hardcoded comparison values

## Approach

### Option 1: Use Ghidra persistent project (Recommended)

1. Start from metadata/UABEA evidence for the unlock booleans and owner offsets.
2. Build or refresh the persistent analyzed project:

```powershell
python scripts\unity\ghidra_headless.py launch-build-project cifi-full workbench\apk\base\libil2cpp.so --timeout 1800
python scripts\unity\ghidra_headless.py poll <job_id>
```

3. Reuse the analyzed project for targeted follow-up runs:

```powershell
python scripts\unity\ghidra_headless.py process-project cifi-full libil2cpp.so --search Tier2TokensUnlocked,get_TotalT1TokenLevels --timeout 120
```

4. Treat string hits as optional. The primary native targets are:
   - writes to the unlock flag offsets
   - compare-immediate sites around `25`, `50`, `100`, `150`
   - aggregation logic over the earlier ATU level fields
5. Validate any threshold result against both native control flow and the known save-field owner.

### Option 2: Binary Analysis with Correct Offsets

The SaveData object is at a known offset. Look for code that:

- References SaveData base + offset 1916-1919 (where tier flags are stored)
- Calls get_Total\*TokenLevels methods
- Compares against threshold constants

## Status

| Item             | Status        | Source              |
| ---------------- | ------------- | ------------------- |
| Method names     | ✅ Verified   | Metadata (0xa0d50+) |
| Field offsets    | ✅ Verified   | UABEA probe         |
| Ghidra installed | ✅ Available  | tools/ghidra/       |
| JDK 21 installed | ✅ Available  | tools/jdk/          |
| Threshold values | ⚠️ Incomplete | Native binary       |

## Recent Findings

From `ghidra_headless.py` analysis on April 17, 2026:

- **Tier method names found in global-metadata.dat** at offsets:
  - `get_TotalT1TokenLevels`: 0xa0d50
  - `Tier2TokensUnlocked`: 0xadeba
  - `Tier3TokensUnlocked`: 0xadece
  - `Tier4TokensUnlocked`: 0xadee2
  - `Tier5TokensUnlocked`: 0xadef6

- **Threshold candidates** (raw byte matches in libil2cpp.so):
  - 25, 50, 100, 150 found at various addresses
  - These are candidate immediate/data locations only
  - They still need native-control-flow verification before being promoted as grounded thresholds

The actual threshold constants are embedded in native x86_64 assembly code, not guaranteed as
player-facing strings or preserved managed names. We need Ghidra to locate the surrounding native
comparison logic, not just byte matches.

## Tools Needed

1. **Ghidra** (recommended): Free reverse engineering suite - use persistent analyzed project plus
   targeted headless post-scripts
   - Location: `tools/ghidra/ghidra_12.0.4_PUBLIC/`
   - Requires JDK 21: `tools/jdk/jdk-21.0.10+7/`
   - Wrapper: `scripts/unity/ghidra_headless.py`
2. **IDA Pro** (optional): Professional disassembly

## References

- Trace unit: `data/system-units/trace.v1.json` (embedded live trace-run metadata offsets)
- UABEA probe: `data/uabea-probe-report.json` (SaveData field offsets 1916-1919)
- General workflow: `docs/extraction/ghidra-il2cpp-workflow.md`
