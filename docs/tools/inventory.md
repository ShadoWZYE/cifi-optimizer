# Tool Inventory

Current inventory for the DB-first extraction/runtime architecture.

Related docs:

- [DB Runtime Endgame Migration](../repo/db-runtime-endgame-migration.md)
- [DB-First Tooling Audit](db-first-tooling-audit-2026-04-21.md)
- [DB-First Repo Audit](../repo/db-first-repo-audit-2026-04-21.md)

## Runtime Shape

The supported pipeline is:

1. planner/query-driven trace selection
2. asset/native extraction only as needed for that trace
3. SQLite evidence and trace fragments
4. reducer-owned canonical/materialized views
5. optional system-unit JSON export for static fallback, distribution, or snapshots

The app/runtime should treat SQLite-backed system views as primary. Committed JSON exports are fallback or archival unless explicitly called out below.
When a target does not emit the expected DB/materialized artifact, the next step is probe/tool/materializer realignment before widening scope.
Long native or Ghidra-backed trace runs are expected while cacheable parsing is still progressing; duration alone is not evidence of a stall.

## Operator Entrypoints

### npm scripts

| Command | Purpose |
| --- | --- |
| `npm run extract:build` | Build the C# Unity asset extractor |
| `npm run extract:uabea` | Run the built C# Unity asset extractor |
| `npm run extract:asset` | Run asset extraction directly |
| `npm run extract:asset:run` | Build and run asset extraction in one command |
| `npm run extract:trace` | Run the DB-first trace launcher |
| `npm run capture:surface -- --surface progression --subsystem tokenshop --output workbench/token-shop.png` | Capture a local app surface through Playwright + installed Chrome/Edge, auto-injecting saved CiFi browser state when available |
| `npm run verify:data` | Validate datasets, system units, and contracts |
| `npm test` | Run smoke tests |

### direct wrappers

| Command | Purpose |
| --- | --- |
| `node scripts/unity/run_extract.mjs trace ...` | Main extraction/trace wrapper |
| `python scripts/unity/unity_trace_bundle.py ...` | Direct trace orchestration |
| `python scripts/unity/ghidra_headless.py ...` | Native pipeline, DB rebuilds, lifecycle maintenance |
| `launch-trace-gap.bat` | Run best-gap follow-up from DB state |
| `node scripts/contracts/generate-system-units.mjs` | Export DB-backed system-unit snapshots |
| `node scripts/contracts/validate-datasets.mjs` | Validate active dataset and export contracts |
| `node scripts/ui/capture-local-surface.mjs ...` | Capture a local rendered UI surface for validation |

## Active Tools

### Trace and DB

| Path | Role | Notes |
| --- | --- | --- |
| `scripts/unity/unity_trace_bundle.py` | Active pipeline | DB-first subject resolution, execution planning, best-gap follow-up, trace persistence |
| `scripts/unity/ghidra_cache_db.py` | Active pipeline | Canonical reducer/materializer owner for evidence, semantic fragments, execution plans, system views |
| `scripts/unity/ghidra_headless.py` | Active pipeline | Ghidra wrapper, DB rebuilds, invalidation, lifecycle audit/purge |
| `scripts/unity/trace_extractors.py` | Active pipeline | Native/managed extraction helpers used by the DB-first trace path |
| `scripts/contracts/system_unit_db.py` | Active bridge | Reads/materializes DB-backed system-unit and trace views for export/runtime helpers |

### Asset and metadata extraction

| Path | Role | Notes |
| --- | --- | --- |
| `scripts/unity/run_extract.mjs` | Active wrapper | Maintained human-facing wrapper over build, asset, and trace commands |
| `tools/unity/CifiAssetProbe/` | Active extractor | C# LibCpp2IL/UABEA extractor |
| `scripts/contracts/generate-extract-report-support.mjs` | Active support generator | Reduces `data/archive/uabea-extract-report.json` into `data/uabea-type-metadata-support.v1.json` |
| `scripts/unity/uabea_probe.ps1` | Active helper | PowerShell wrapper around `run_extract.mjs` asset flow |

### Export and validation

| Path | Role | Notes |
| --- | --- | --- |
| `scripts/contracts/generate-system-units.mjs` | Export bridge | Builds static system-unit snapshots from DB-backed views plus remaining explicit boundary/policy inputs |
| `scripts/contracts/generate-dataset-index.mjs` | Ops/doc helper | Regenerates the dataset index documentation |
| `scripts/contracts/validate-datasets.mjs` | Active validator | Enforces current dataset/export/runtime contracts |
| `tests/smoke.mjs` | Active validator | Drift detection for app/bootstrap/export/tooling assumptions |
| `scripts/ui/capture-local-surface.mjs` | Active validation helper | Uses Playwright with installed Chrome/Edge to capture local rendered app surfaces without the brittle raw headless Chromium path. Prefer the local server's DB-backed `/api/player-profile` state when available, and only fall back to browser localStorage scraping/cache when the server-backed player profile is absent. Use `--fresh` to force a blank state, or `--user-data-dir` with `--profile-directory` to target a specific browser profile. |

### Runtime app state

| Path / Surface | Role | Notes |
| --- | --- | --- |
| `workbench/app-state.sqlite3` | Active runtime store | Separate app-state DB for mutable user/profile state. Do not mix this with canonical extraction/materializer truth in `workbench/ghidra-cache/ghidra_cache.sqlite3`. |
| `GET /api/player-profile` | Active runtime API | Returns the current DB-backed active player profile used by the app/capture validation path. |
| `POST /api/player-profile` | Active runtime API | Upserts the current DB-backed active player profile. |
| `CIFI_APP_STATE_DB_PATH` | Dev-server override | Optional environment override for the app-state DB path. Use this for tests or isolated validation runs instead of mutating the default local app-state DB. |

### Shard planners

| Path | Role | Notes |
| --- | --- | --- |
| `scripts/shards/cost-evaluator.mjs` | Active planner | Reads DB-backed shard system-unit outputs |
| `scripts/shards/calibration-check.mjs` | Active checker | Reads DB-backed shard formula/calibration outputs |
| `scripts/shards/calibration-report.mjs` | Active report | Reporting helper over current shard calibration surfaces |

## Direct `run_extract` Commands

Supported `run_extract.mjs` commands:

| Command | Status | Notes |
| --- | --- | --- |
| `build` | supported | Build the C# asset extractor |
| `uabea` | supported | Run the built C# asset extractor |
| `asset` | supported | Run asset extraction |
| `asset:run` | supported | Build and run asset extraction |
| `trace` | supported | Run the DB-first trace path |
| `compile` | supported | Regenerate system-unit exports |

Asset extraction flags:

- `--quick`
- `--no-metadata`
- `--term <name>`

Trace examples:

```bash
node scripts/unity/run_extract.mjs trace --family token-shop
node scripts/unity/run_extract.mjs trace --query "ATU4Button" --level structured
python scripts/unity/unity_trace_bundle.py --best-gap --dry-run
launch-trace-gap.bat
```

Trace operating rule:

- prefer `extract:trace` or `unity_trace_bundle.py` as the default recovery path
- expect DB/cache/materialized artifacts to be the primary success signal
- use `--export` or exported JSON outputs only when a snapshot/debug artifact is explicitly needed
- if the expected DB/materialized artifact is missing after a run, fix the trace/probe/materializer path before moving to adjacent targets

DB/lifecycle examples:

```bash
python scripts/unity/ghidra_headless.py rebuild-cache-db --stage native-cache
python scripts/unity/ghidra_headless.py rebuild-cache-db --stage trace-system
python scripts/unity/ghidra_headless.py audit-db-lifecycle
python scripts/unity/ghidra_headless.py purge-invalidated --older-than-days 30
```

## Transitional or Narrow-Scope Tools

These remain in the repo, but they are not the main architecture owners.

| Path | Status | Why it still exists |
| --- | --- | --- |
| `scripts/unity/unity_extract_report.py` | manual research only | Older Unity object report helper; keep only for raw questions the DB/system-unit surface does not answer yet |
| `scripts/unity/unity_textasset_dump.py` | manual research only | TextAsset dump helper; not part of the DB-first runtime or export path |
| `scripts/unity/unity_targeted_string_report.py` | manual research only | Targeted string search helper; keep only for ad hoc raw string investigation |
| `scripts/unity/unity_extract_helpers.py` | transitional utility | Shared helper layer still referenced by older extraction utilities |
| `scripts/contracts/generate-dataset-index.mjs` | ops helper | Useful while committed dataset/archive inventory still matters |

## Removed or Superseded

These should not be reintroduced as active workflow without a fresh DB-first justification.

| Path or surface | Status | Replacement |
| --- | --- | --- |
| `scripts/unity/run_probe.mjs` | removed | `scripts/unity/run_extract.mjs` |
| `scripts/unity/token_shop_parse.py` | removed | `db:derived:token-shop-values` built in `generate-system-units.mjs` |
| `scripts/unity/multiverse_market_parse.py` | removed | `db:derived:multiverse-market-values` built in `generate-system-units.mjs` |
| `probe:*` npm aliases | removed | `extract:*` npm aliases |
| shard probe script cluster | removed | DB-first trace/materializer flow |
| `scripts/unity/score_extraction_candidates.py` | removed | DB-native best-gap selection |
| `data/extraction-candidate-ranking.v1.json` | removed | DB-native best-gap selection |
| `scripts/contracts/generate-trace-support-datasets.mjs` | removed | DB-backed system-unit export; archived snapshot only |
| `run_extract.mjs pipeline` | removed | direct DB-first trace, asset, and compile commands |
| `data/archive/unity-trace-target-registry.json` | archived | DB/bootstrap subject resolution and execution planning |
| `data/archive/token-shop-trace-support.v1.json` | archived | DB-backed token-shop system-unit/export state |

## Archive Policy

If a tool or dataset:

- no longer feeds app/runtime behavior,
- no longer feeds `generate-system-units.mjs`,
- and exists only for provenance or historical review,

it should live under `data/archive/` or be documented as archival, not as active support.

## Practical Rule

Before adding or reviving a tool:

1. Prefer extending `unity_trace_bundle.py`, `ghidra_cache_db.py`, or `ghidra_headless.py`.
2. Prefer DB-backed materialization over new committed intermediate JSON.
3. Only keep standalone generators when they still produce a live input that the DB/export layer cannot yet derive.
