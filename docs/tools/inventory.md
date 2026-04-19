# Unity Probe Tool Inventory

This document provides a comprehensive inventory of all extraction and analysis tools in the repository. Tools are organized by capability and purpose.

## Overview

The repo uses a centralized probe runner (`scripts/unity/run_probe.mjs`) that provides:

- **Generalized commands** - Parameterized extraction for any target/anchor
- **Pipeline chaining** - Multi-step analysis with `--chain` and `--max-steps`
- **Trace outputs** - Stable per-target `.json` + `.md` files under `workbench/trace-runs/`
- **Hierarchy levels** - `--level raw|structured|both` control

Related workflow docs:

- [`docs/extraction/extraction-flow.md`](../extraction/extraction-flow.md)
- [`docs/extraction/trace-registry-extension.md`](../extraction/trace-registry-extension.md)

## Quick Reference

| Command                        | Purpose                       | Produces Committed Artifacts?      |
| ------------------------------ | ----------------------------- | ---------------------------------- |
| `node run_probe.mjs build`     | Build C# AssetProbe           | No (build artifact)                |
| `node run_probe.mjs probe`     | Run C# AssetProbe directly    | Yes (data/uabea-probe-report.json) |
| `node run_probe.mjs probe:run` | Build + run in one command    | Yes                                |
| `node run_probe.mjs trace`     | Generalized trace bundle      | No (stable workbench outputs, later promoted into system units) |
| `node run_probe.mjs compile`   | Canonical dataset compilation | Yes                                |
| `node run_probe.mjs pipeline`  | Multi-step extraction         | Yes                                |

**C# Probe performance flags (with probe/probe:run):**

- `--quick`: Metadata only, no fields/methods (~25x faster)
- `--no-metadata`: Skip Cpp2IL load, use cache
- `--term <name>`: Only process types matching name
- `--report <path>`: Output report path

### 0. C# Asset Probe (Native .NET)

| Executable                             | Purpose                                                       | Output                         | Performance Flags                      |
| -------------------------------------- | ------------------------------------------------------------- | ------------------------------ | -------------------------------------- |
| `tools/unity/CifiAssetProbe/` (csproj) | High-performance IL2CPP/C# metadata extractor using LibCpp2IL | `data/uabea-probe-report.json` | `--quick`, `--no-metadata`, `--term X` |

**Performance flags:**

- `--quick`: Skip field/method enumeration (metadata-only, ~25x faster)
- `--no-metadata`: Skip Cpp2IL loading entirely (use cached data)
- `--term X`: Only process types matching term X (filters targets)

**Build & Run:**

```bash
cd tools/unity/CifiAssetProbe
dotnet build
dotnet run -- --report ../../data/uabea-probe-report.json --quick
dotnet run -- --term SaveData --quick
```

**Expected performance (full binary ~11MB, ~3000 types):**
| Mode | Time | Speedup vs Original |
|------|------|---------------------|
| Default | ~3-5 min | 5-8x |
| `--quick` | ~1-2 min | 12-25x |
| `--term X` | ~1 min | 25x |

**Optimizations implemented:**

- Type index: O(1) dictionary lookups vs O(n) scans
- Parallel processing: Uses all CPU cores
- Lazy field/method enumeration: Only loads when needed
- Reflection property cache: Caches PropertyInfo per type

## Tool Categories

### 1. Core Infrastructure

| Script                   | Purpose                                                      | Committed Output?               |
| ------------------------ | ------------------------------------------------------------ | ------------------------------- |
| `run_probe.mjs`          | Centralized probe runner with generalized CLI                | No                              |
| `unity_trace_bundle.py`  | Trace bundle generator - extracts and analyzes Unity objects | No (writes stable per-target outputs under `workbench/trace-runs/`) |
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

### 8. Binary Analysis (Ghidra)

| Tool                    | Purpose                       | Location        |
| ----------------------- | ----------------------------- | --------------- |
| `ghidra_12.0.4_PUBLIC/` | ARM64/x64 reverse engineering | `tools/ghidra/` |
| `jdk-21.0.10+7/`        | Java runtime for Ghidra       | `tools/jdk/`    |

**Usage:**

```bash
# Set JAVA_HOME to your JDK path, then run Ghidra
export JAVA_HOME="<path-to-jdk>"
./tools/ghidra/ghidra_12.0.4_PUBLIC/ghidraRun.bat
```

**Purpose:** Extract native execution details from `libil2cpp.so` that are not recoverable from
metadata alone: compare sites, call chains, constants, field-offset reads/writes, and bounded
native helper families.

| Script                         | Purpose                             | Committed Output? |
| ------------------------------ | ----------------------------------- | ----------------- |
| `ghidra_headless.py`           | Persistent-project Ghidra headless runner | No          |
| `ghidra_scripts/CiFiTierAnalysisPy.py` | Repo-owned Jython post-script used by headless jobs | No |
| `scripts/ocr/generator-ocr.py` | Generator OCR extraction            | No (optional)     |

**Supported workflow**

1. Use metadata/UABEA probes to recover names, types, and offsets.
2. Build one persistent analyzed Ghidra project for `libil2cpp.so`.
3. Reuse that project with `process-project` searches instead of re-importing.
4. Bridge native findings back to managed names through offsets and surrounding evidence.

**Headless usage**

```bash
# one-time persistent project build
python scripts/unity/ghidra_headless.py launch-build-project cifi-full workbench/apk/base/libil2cpp.so --timeout 1800 --max-cpu 8
python scripts/unity/ghidra_headless.py poll <job_id>

# later project reuse
python scripts/unity/ghidra_headless.py process-project cifi-full libil2cpp.so --search Tier2TokensUnlocked,get_TotalT1TokenLevels --timeout 1800 --max-cpu 14
```

`ghidra_headless.py` now forces headless settings/cache/temp files into `workbench/ghidra-runtime/`
so runs do not depend on writable `%APPDATA%` profile state. The persistent project is still
single-lock: do not run multiple `process-project` or `build-project` commands against `cifi-full`
at the same time.

`process-project` cache reuse is incremental:

- search terms are normalized case-insensitively, deduped, and sorted before lookup
- an exact prior completed job returns immediately from cache
- direct single-term hits are reused first
- still-missing terms can be backfilled from the repo-side native graph when they already appear as
  incidental findings from prior searched terms
- only truly missing terms execute a fresh Ghidra search
- merged results are written back as a new completed job, so future reordered or repeated requests
  hit the cache directly

This cache behavior is repo-side over `workbench/ghidra-jobs/` and the persistent
`workbench/ghidra-projects/cifi-full.rep` project. It is not an append-only mutation of Ghidra's
internal runtime cache format.

The wrapper also maintains a lightweight repo-side exact-match index at
`workbench/ghidra-cache/process_project_index.json`. That index is derived from completed
`process-project` jobs and lets later trace runs resolve common native term sets without rereading
every job directory.

It also maintains a term-centric native graph at
`workbench/ghidra-cache/native_graph_index.json`. That graph grows from completed single-term jobs
and stores:

- searched terms and their latest completed raw/reconstructed payloads
- incidental owner candidates
- incidental method candidates
- incidental field candidates
- term-to-term cooccurrence links

That graph is the long-lived cache shape. Exact merged jobs are still useful, but the durable
reuse layer is now “what terms have we already searched and what graph evidence did those searches
recover?” rather than only “have we already run this exact term set?”

The wrapper also performs bounded automatic cleanup inside the workbench:

- stale completed `process-project` jobs are removed automatically
- orphaned cache result files are removed automatically
- only a recent retained window of completed process jobs is kept
- running jobs and non-process job types are left alone

This keeps the repo-side native cache useful without letting old schema versions accumulate
indefinitely.

Native process-job reuse is schema-aware:

- completed jobs carry a native trace schema version
- exact cache hits are accepted only when they satisfy the current schema
- nested managed reconstruction and search-expansion schema are checked too
- older jobs are treated as stale and rerun automatically

That prevents the trace from getting stuck on older weaker native payloads after reconstruction
logic improves.

Current headless native outputs now preserve:

- `termBridges`
  Per-term bridge kind and evidence counts
- `metadataNeighborhoods`
  Nearby managed terms from `global-metadata.dat`
- `managedReconstruction`
  Reconstructed owners, methods, fields, raw values, owner-to-term maps, and scored owners

So even when strict native `functions` buckets are empty, the trace can still recover a useful
owner/method/field chain from metadata-backed native reconstruction.

**Important limitation**

Managed names often live only in `global-metadata.dat`, not as searchable symbols in
`libil2cpp.so`. Ghidra should therefore be used to recover _native implementation behavior_, not as
the sole source of original Unity object structure. See
`docs/extraction/ghidra-il2cpp-workflow.md`.

### 8. Compilation Scripts

| Script                                   | Purpose                             | Committed Output?                   |
| ---------------------------------------- | ----------------------------------- | ----------------------------------- |
| `scripts/compile_tokenshop_canonical.py` | Compile canonical TokenShop dataset | Yes (`tokenshop-canonical-v1.json`) |
| `scripts/contracts/generate-system-units.mjs` | Generate centralized embedded system-unit datasets | Yes (`data/system-units/*.json`) |
| `score_extraction_candidates.py`         | Score extraction candidates         | No                                  |

## Usage Examples

### Basic Trace

```bash
node scripts/unity/run_probe.mjs trace \
  --family token-shop
```

Use `--extended-search` when you want the trace to widen beyond the current bounded target:

- `--extended-search 0`: target-only sources
- `--extended-search 1`: sibling targets in the same family
- `--extended-search 2`: all trace families

Use `--depth-search` when you want the trace to follow recovered strong terms outward after the
bounded target completes:

- `--depth-search 0`: disabled
- `--depth-search 1`: one follow-up hop
- `--depth-search 2`: two follow-up hops

If you omit `--depth-search`, the trace can now use a target-level registry default depth when one
is declared.

### With Hierarchy Level

```bash
node scripts/unity/run_probe.mjs trace \
  --target shard-owned-state \
  --anchor upgradeInfoList \
  --level structured
```

### Ambiguous Explore

```bash
node scripts/unity/run_probe.mjs trace \
  --query SomeUnknownLabel \
  --level structured
```

If the planner cannot map the query cleanly to one family, the trace now falls back to
`generic-explore` and scans committed metadata, Unity assets, and bounded extraction documents
without promoting any canonical join by itself.

For exact TokenShop shell anchors such as `ATU1Button` or `ATU6Button`, the planner now bypasses
the TokenShop family default `ATU3` compare lane and routes directly to
`token-shop-family-structure` unless the query also carries explicit `ATU3` effect terms such as
`BuyCellBoost`, `CellBoost`, or `15810`.

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
  --target token-shop-atu3-cells-effect \
  --anchor ATU3Button \
  --extended-search 1 \
  --depth-search 1 \
  --force
```

### Continue on Error

```bash
node scripts/unity/run_probe.mjs pipeline \
  --target TokenShop \
  --continue-on-error
```

## Output Convention

Trace runs are stored in stable per-target paths under `workbench/trace-runs/` and overwrite on
repeat for the same workspace asset set:

```
workbench/trace-runs/
├── generic-explore.json
├── generic-explore.md
├── token-shop-atu3-cells-effect.json
├── token-shop-atu3-cells-effect.md
├── shard-cost-su0-structure.json
└── shard-cost-su0-structure.md
```

Each trace payload records `generatedAt` and `assetSet.fingerprint` internally, so the timestamp no
longer needs to live in the filename.

Wait for the trace command to finish before reading the output files. The trace rewrites the stable
`workbench/trace-runs/*.json` and `*.md` files in place, so reading during execution can show the
previous run or a partially rewritten file.

The markdown trace output now also includes:

- reconstructed owners
- reconstructed methods
- reconstructed fields and raw value terms
- scored owner candidates
- owner-to-term reconstruction maps

That section is the main native bridge summary when IL2CPP strips the original native symbol names.

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
