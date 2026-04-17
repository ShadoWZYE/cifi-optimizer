# Tier Unlock Threshold Extraction Guide

## Background

Tier unlock thresholds (25, 50, 100, 150) are embedded in the IL2CPP native binary, not in metadata. This document outlines how to extract them.

## What We Know

### Verified from Metadata:

- Method names: `get_TotalT1TokenLevels` through `get_TotalT5TokenLevels` (RVA offsets ~658791+)
- SaveData fields: `Tier2TokensUnlocked` (1916), `Tier3TokensUnlocked` (1917), `Tier4TokensUnlocked` (1918), `Tier5TokensUnlocked` (1919)
- Field type: `System.Boolean` (bool)

### Not Verified (IL2CPP Embedded):

- Exact threshold values (25, 50, 100, 150) - these are hardcoded in native assembly

## Extraction Process

### Step 1: Locate the Binary

```
workbench/apk/base/libil2cpp.so
```

### Step 2: Find the Setter Method

The boolean flags are set by a method that checks total levels. Look for methods that:

- Write to addresses around offset 1916-1919 in SaveData
- Reference `get_TotalT*TokenLevels` methods
- Compare against constant values

### Step 3: Disassembly Approach

Using objdump or IDA/Ghidra:

```bash
# Find method RVA from trace bundle
# get_TotalT1TokenLevels at offset 658791
objdump -d -l libil2cpp.so | grep -A50 "658791"
```

Or use Ghidra/IDA to:

1. Load libil2cpp.so
2. Search for string "get_TotalT1TokenLevels"
3. Find the x86_64 function that calls this
4. Read the immediate values used in comparisons

### Step 4: Expected Pattern

The code likely looks something like (pseudo-C#):

```csharp
public bool CheckTierUnlocked(int tier) {
    int totalLevels = tier switch {
        2 => get_TotalT1TokenLevels(),
        3 => get_TotalT1TokenLevels() + get_TotalT2TokenLevels(),
        4 => get_TotalT1TokenLevels() + get_TotalT2TokenLevels() + get_TotalT3TokenLevels(),
        5 => get_TotalTokenLevels()  // sum of all tiers
    };
    return tier switch {
        2 => totalLevels >= 25,
        3 => totalLevels >= 50,
        4 => totalLevels >= 100,
        5 => totalLevels >= 150
    };
}
```

The comparison constants (25, 50, 100, 150) will appear as immediate values in the x86_64 assembly.

## Tools Needed

1. **objdump** (from binutils): `objdump -d libil2cpp.so`
2. **Ghidra** (recommended): Free reverse engineering suite
3. **IDA Pro** (optional): Professional disassembly

## References

- Trace bundle: `data/unity-trace-bundle.json` (method string offsets)
- UABEA probe: `data/uabea-probe-report.json` (field offsets)
- SaveData class: `data/tokenshop-model-recovery.json`

## Status

| Item             | Status           | Source      |
| ---------------- | ---------------- | ----------- |
| Method names     | ✅ Verified      | Metadata    |
| Field offsets    | ✅ Verified      | UABEA probe |
| Threshold values | ❌ Not extracted | IL2CPP      |

## Attempts Made

### 1. C# Metadata Probe

- Result: Found method names in metadata strings
- Limitation: Cannot extract hardcoded constants from IL2CPP

### 2. Python Capstone Disassembly

- Created: `scripts/unity/tier-unlock-disassembly-probe.py`
- Issues: ELF parsing issues with vendor elftools, capstone requires proper offset mapping

### 3. Working Approach - Use Ghidra/IDA

The most reliable way to extract these values:

1. **Using Ghidra** (free):
   - Download Ghidra
   - Open `workbench/apk/base/libil2cpp.so`
   - Search for string `get_TotalT1TokenLevels` in string references
   - Navigate to the function that calls this method
   - Look for `cmp` instructions with immediate values 25, 50, 100, 150

2. **Using objdump** (if available):

   ```bash
   # Requires binutils installed
   objdump -d -S libil2cpp.so | grep -B5 -A20 "get_TotalT1TokenLevels"
   ```

3. **Using Python with lief** (if installed):
   - Install: `pip install lief`
   - Use lief to properly parse ELF and find function addresses

## Recommended Next Steps

1. Use Ghidra to manually extract the threshold values
2. Once extracted, update `tokenshop-canonical-v1.json` with verified values
3. Remove "assumed" labels from the documentation
