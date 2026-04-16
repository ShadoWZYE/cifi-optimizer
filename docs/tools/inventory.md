# Unity Probe Tool Inventory

This document provides a comprehensive inventory of all extraction and analysis tools in the repository. Tools are organized by capability and purpose.

## Overview

The repo uses a centralized probe runner (`scripts/unity/run_probe.mjs`) that provides:

- **Generalized commands** - Parameterized extraction for any target/anchor
- **Pipeline chaining** - Multi-step analysis with `--chain` and `--max-steps`
- **Output convention** - `{target}-{anchor}-{timestamp}.json` structure
- **Hierarchy levels** - `--level raw|structured|both` control

## Quick Reference

| Command                       | Purpose                       | Produces Committed Artifacts? |
| ----------------------------- | ----------------------------- | ----------------------------- |
| `node run_probe.mjs build`    | Build C# uabea probe          | No (build artifact)           |
| `node run_probe.mjs trace`    | Generalized trace bundle      | Yes                           |
| `node run_probe.mjs compile`  | Canonical dataset compilation | Yes                           |
| `node run_probe.mjs pipeline` | Multi-step extraction         | Yes                           |

## Tool Categories

### 1. Core Infrastructure

| Script                   | Purpose                                                      | Committed Output?               |
| ------------------------ | ------------------------------------------------------------ | ------------------------------- |
| `run_probe.mjs`          | Centralized probe runner with generalized CLI                | No                              |
| `unity_trace_bundle.py`  | Trace bundle generator - extracts and analyzes Unity objects | Yes (`unity-trace-bundle.json`) |
| `unity_probe_helpers.py` | Reusable Unity probing methods                               | No (utility)                    |
| `portable_paths.py`      | Path resolution helpers                                      | No (utility)                    |

### 2. APK/Unity Extraction

| Script                           | Purpose                              | Committed Output? |
| -------------------------------- | ------------------------------------ | ----------------- |
| `unity_apk_probe.py`             | Generic APK/Unity object extraction  | No                |
| `unity_textasset_dump.py`        | TextAsset string extraction          | No                |
| `unity_targeted_string_probe.py` | Targeted string search               | No                |
| `metadata_neighborhood_probe.py` | Metadata field neighborhood analysis | No                |

### 3. TokenShop Extraction (11 scripts)

| Script                                | Purpose                            | Committed Output?                 |
| ------------------------------------- | ---------------------------------- | --------------------------------- |
| `token_shop_scene_probe.py`           | TokenShop scene object extraction  | Yes (intermediate)                |
| `token_shop_parse.py`                 | TokenShop field/method parsing     | Yes (intermediate)                |
| `token_shop_title_discovery_probe.py` | Player-facing title discovery      | Yes                               |
| `tokenshop_complete_parse.py`         | Complete TokenShop data extraction | Yes                               |
| `tokenshop_optimizer_data.py`         | Optimizer-ready data formatting    | Yes                               |
| `tokenshop_ui_mapping.py`             | UI text mapping                    | Yes (`tokenshop-ui-mapping.json`) |
| `tokenshop_cost_formula.py`           | Cost formula analysis              | No                                |
| `tokenshop_cost_native_probe.py`      | Native code cost probing           | No                                |
| `tokenshop_cost_native_analyzer.py`   | Native cost analysis               | No                                |
| `tokenshop_cost_method_probe.py`      | Method-level cost extraction       | No                                |
| `tokenshop_cost_tracer.py`            | Cost tracer                        | No                                |
| `tokenshop_atucost_probe.py`          | ATU-specific cost probe            | No                                |
| `tokenshop_getcost_analyzer.py`       | getCost method analysis            | No                                |
| `tokenshop_formula_discovery.py`      | Formula discovery                  | No                                |

### 4. Shard Extraction (8 scripts)

| Script                                     | Purpose                         | Committed Output?  |
| ------------------------------------------ | ------------------------------- | ------------------ |
| `shard_scene_probe.py`                     | Shard scene object extraction   | Yes (intermediate) |
| `shard_type_metadata_probe.py`             | Type metadata extraction        | Yes                |
| `shard_cost_parameter_probe.py`            | Cost parameter field extraction | Yes                |
| `shard_cost_method_probe.py`               | Cost method extraction          | Yes                |
| `shard_cost_native_probe.py`               | Native code cost analysis       | Yes                |
| `shard_bonus_slot_probe.py`                | Bonus slot probing              | Yes                |
| `shard_milestone_save_owner_candidates.py` | Save owner candidate analysis   | Yes                |
| `shard_scene_monobehaviour_probe.py`       | MonoBehaviour probe             | No                 |

### 5. Multiverse Market Extraction (2 scripts)

| Script                                    | Purpose              | Committed Output? |
| ----------------------------------------- | -------------------- | ----------------- |
| `multiverse_market_parse.py`              | Market data parsing  | Yes               |
| `multiverse_market_text_runtime_probe.py` | Text runtime probing | Yes               |

### 6. Debug/Development Tools

| Script                      | Purpose                           |
| --------------------------- | --------------------------------- |
| `debug_button_structure.py` | Debug ATU button structure        |
| `debug_mono_readable.py`    | Debug MonoBehaviour readability   |
| `debug_mono_script.py`      | Debug MonoBehaviour script issues |
| `check_dtm.py`              | Quick DTM check                   |
| `check_formula_fields.py`   | Formula field validation          |

### 7. OCR Tools

| Script                         | Purpose                  | Committed Output? |
| ------------------------------ | ------------------------ | ----------------- |
| `scripts/ocr/generator-ocr.py` | Generator OCR extraction | No (optional)     |

### 8. Compilation Scripts

| Script                                   | Purpose                             | Committed Output?                   |
| ---------------------------------------- | ----------------------------------- | ----------------------------------- |
| `scripts/compile_tokenshop_canonical.py` | Compile canonical TokenShop dataset | Yes (`tokenshop-canonical-v1.json`) |
| `score_extraction_candidates.py`         | Score extraction candidates         | No                                  |

## Usage Examples

### Basic Trace

```bash
node scripts/unity/run_probe.mjs trace \
  --target token-shop-atu3-cells \
  --anchor ATU3Button \
  --family token-shop
```

### With Hierarchy Level

```bash
node scripts/unity/run_probe.mjs trace \
  --target shard-owned-state \
  --anchor upgradeInfoList \
  --level structured
```

### Pipeline with Resume

```bash
node scripts/unity/run_probe.mjs pipeline \
  --target TokenShop \
  --anchors ATU1Button ATU2Button ATU3Button \
  --output data/tokenshop-canonical-v1.json \
  --resume
```

### Force Regeneration

```bash
node scripts/unity/run_probe.mjs trace \
  --target token-shop-atu3-cells \
  --anchor ATU3Button \
  --force
```

### Continue on Error

```bash
node scripts/unity/run_probe.mjs pipeline \
  --target TokenShop \
  --continue-on-error
```

## Output Convention

Artifacts are stored in `workbench/probes/{target}-{anchors}/{timestamp}/`:

```
workbench/probes/
├── token-shop-ATU3Button/
│   └── 2026-04-16T03-27-00/
│       ├── raw/
│       │   └── token-shop-raw.json
│       ├── structured/
│       │   ├── token-shop-fields.json
│       │   ├── token-shop-methods.json
│       │   └── token-shop-costs.json
│       ├── both/
│       │   └── token-shop-canonical.json
│       └── manifest.json
└── shard-owned-state-upgradeInfoList/
    └── 2026-04-16T03-30-00/
        └── ...
```

## Legacy Commands

For backwards compatibility, old commands still work:

- `node run_probe.mjs shards:parameters`
- `node run_probe.mjs shards:type-metadata`
- `node run_probe.mjs shards:method`
- `node run_probe.mjs shards:cost-native`

## Adding New Probes

To add a new probe script:

1. Follow the standard interface in `unity_probe_helpers.py`
2. Add to appropriate category in commandTemplates in `run_probe.mjs`
3. Document in this inventory
4. Update committed output list in `docs/repo/artifacts.md`

## Notes

- Scripts marked "Yes" for committed output produce artifacts that can be committed to the repo
- Scripts marked "No" are utilities, debug tools, or intermediate processing
- All extraction scripts should accept CLI arguments for target/anchor flexibility
- Use `--level` to control output hierarchy (raw, structured, both)
