# Ghidra IL2CPP Workflow

## Purpose

This repo uses Ghidra against `libil2cpp.so` as one part of a larger IL2CPP extraction workflow.
Ghidra is not the source of truth for original Unity class names by itself. It is the source of
truth for native execution details: control flow, constants, comparisons, call chains, and memory
accesses inside the compiled binary.

Use this workflow when metadata or Unity object probes tell us _what exists_, but we still need to
recover _how the game actually computes it_ in native code.

## Mental Model

The APK gives us two different information surfaces:

1. `global-metadata.dat`
2. `libil2cpp.so`

Treat them differently:

| Source | Best for | Typical examples |
| --- | --- | --- |
| `global-metadata.dat` | Managed names and structure | class names, field names, property names, method names |
| `libil2cpp.so` | Native implementation details | constants, branch logic, reads/writes, compare sites, call chains |

That means:

- Metadata tells us that `Tier2TokensUnlocked` exists.
- Native code tells us where the unlock flag is read or written.
- The bridge between them is usually field offset, nearby call shape, or a recovered owner object.

## What Ghidra Does Recover

Ghidra can recover:

- disassembly for native functions
- decompiler output for native functions
- control flow and compare sites
- references between functions and memory addresses
- data blocks and embedded constants
- repeated patterns once a persistent analyzed project exists

Ghidra does **not** reliably recover:

- full original Unity/C# object structure by name
- every original managed method/property name as a searchable native symbol
- direct “open class and read source” semantics for IL2CPP code

For this repo, assume native code is partially anonymous until we bridge it back to managed
metadata.

## Grounded Workflow

### 1. Start from grounded managed truth

Use repo probes first:

- `data/uabea-probe-report.json`
- `data/system-units/trace.v1.json`
- `workbench/apk/base/global-metadata.dat`
- committed extraction outputs that already map owners, fields, or offsets

Recover:

- field names
- likely owner type
- field offsets
- nearby related fields
- managed method/property names

### 2. Convert the question into native search anchors

Do not start with “find this exact class in Ghidra.”

Instead, produce native anchors such as:

- known field offsets
- known save-field ranges
- known constant families
- known method/property name fragments from metadata
- known adjacent helper families from previous probes

Example:

- managed question: “Where does token shop unlock tier 2?”
- native anchors: writes near `Tier2TokensUnlocked` owner offset, compare-immediate values around
  `25`, aggregation of earlier ATU levels, nearby unlock/write logic

### 3. Build or reuse a persistent analyzed Ghidra project

Use the repo wrapper:

```powershell
python scripts\unity\ghidra_headless.py launch-build-project cifi-full workbench\apk\base\libil2cpp.so --timeout 1800
python scripts\unity\ghidra_headless.py poll <job_id>
```

The persistent project lives under:

- `workbench/ghidra-projects/cifi-full.gpr`
- `workbench/ghidra-projects/cifi-full.rep/`

Once built, reuse it for later scripted searches instead of re-importing the binary.

### 4. Run project-side searches against the analyzed program

Use:

```powershell
python scripts\unity\ghidra_headless.py process-project cifi-full libil2cpp.so --search Tier2TokensUnlocked,get_TotalT1TokenLevels --timeout 120
```

Current repo support is intentionally narrow:

- script execution against an existing project
- simple string/method filtering
- result caching under `workbench/ghidra-jobs/`

This is now enough to support a first real native tracing layer, but the bridge still works mostly
through metadata neighborhoods and reconstructed managed structure rather than preserved native
symbols.

### 5. Bridge back to gameplay concepts

After a native hit is found, document:

- whether the hit is verified native logic or only a candidate
- which managed object/field it maps back to
- which assumptions are still unresolved
- whether the result is safe to promote into canonical state

Never promote a native candidate straight into canonical datasets without the provenance label.

## Why Exact Managed Names Often Fail in Ghidra

Many IL2CPP builds do not preserve managed names as searchable native strings in `libil2cpp.so`.
Those names often still exist in `global-metadata.dat`, but not as native symbol names.

So a failed Ghidra string search does **not** mean the feature is absent. It usually means:

- the name survived in metadata only
- the native function was stripped or renamed
- the implementation must be found through offsets, references, or constants instead

The repo now makes this explicit in its headless output:

- `functions`
  direct native function or reference bridge buckets
- `termBridges`
  per-term bridge classification
- `metadataNeighborhoods`
  nearby managed terms from `global-metadata.dat`
- `managedReconstruction`
  reconstructed owners, methods, fields, raw values, and scored owner groupings

So an empty `functions {}` bucket is no longer the same thing as an unresolved trace lane.

## Persistent Project Usage

Supported repo commands:

```powershell
python scripts\unity\ghidra_headless.py build-project <project_name> <binary> [--search a,b,c] [--timeout sec]
python scripts\unity\ghidra_headless.py launch-build-project <project_name> <binary> [--search a,b,c] [--timeout sec]
python scripts\unity\ghidra_headless.py process-project <project_name> [project_file] [--search a,b,c] [--timeout sec]
python scripts\unity\ghidra_headless.py poll <job_id>
python scripts\unity\ghidra_headless.py status
```

Recommended pattern:

1. Build one long-lived project for the current APK/native binary.
2. Reuse `process-project` for iterative searches.
3. Let the repo-side term graph accumulate searched terms and incidental findings over time.
4. Keep project-side search scripts small and targeted.
5. Add new search modes only when the pattern is generic enough to reuse.

## Result Versioning And Staleness

Completed native jobs now carry an explicit schema version.

That version gates cache reuse:

- old completed jobs are reused only if they satisfy the current native trace schema
- jobs missing newer reconstruction fields are treated as stale
- the wrapper reruns them automatically instead of serving older weaker payloads

This matters because native bridge logic evolves over time. The repo must not keep returning older
“unresolved” outputs after reconstruction rules have improved.

## Term Graph Reuse

`process-project` no longer treats exact merged jobs as the only meaningful cache unit.

The durable cache now has two layers:

1. `workbench/ghidra-jobs/`
   Stores the raw completed per-term and merged jobs.
2. `workbench/ghidra-cache/native_graph_index.json`
   Stores the growing term-centric graph reconstructed from those jobs.

That graph records:

- searched source terms
- incidental owner candidates
- incidental method candidates
- incidental field candidates
- term links recovered from metadata neighborhoods and bridge expansion

So if a later request asks for a term that was already recovered incidentally from an earlier
searched term, the wrapper can backfill that request from the graph and only execute Ghidra for the
remaining truly missing terms.

## Current Native Reconstruction Model

When native symbols are stripped, the repo reconstructs native-relevant managed structure by
grouping metadata-neighborhood evidence into:

- owners/classes
- methods or accessors
- fields
- raw value terms
- owner-to-term maps
- scored owner candidates

That means a trace can now say:

- owner: `ShardUpgradeInfo`
- method: `get_SU0Cost`
- fields: `SU0StartCost`, `SU0CostExponent`

even when no literal native function name survives in `libil2cpp.so`.

## What Is Generalizable

We can build reusable tooling for native search, but it should target recurring native patterns, not
pretend to reconstruct arbitrary Unity object graphs.

Good future generalizations:

- compare-immediate search for constant families
- field-offset access search
- write-site search for known save-field offsets
- xref clustering around candidate helper functions
- nearby function family extraction around a verified anchor

Bad generalizations:

- “recover all game objects/classes from Ghidra”
- “search by original Unity class name only”
- “assume every managed property is a preserved native symbol”

## Current Repo Decision

After cleanup, the repo is ready for a general analyzed-project search layer, but only in the
native-pattern sense described above. The next useful code should be a reusable search script
family over the persistent Ghidra project, not a fake object-model recovery layer.
