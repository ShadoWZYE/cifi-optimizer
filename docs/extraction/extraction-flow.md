# Extraction Flow

## Purpose

This repo no longer treats extraction as "run a probe, keep the probe output forever". The current
goal is:

1. extract directly from grounded repo-local sources when possible
2. keep one clean trace result per run
3. promote only durable facts, blocker boundaries, and reusable models into `data/`

## Source order

Use sources in this order:

1. committed repo datasets and grounded docs
2. committed APK/Unity artifacts under `workbench/`
3. persistent Ghidra project for native behavior
4. external or community sources only when explicitly labeled

## Main flow

### 1. Pick the lane and question

Every extraction pass should start from a user-facing question, not from a file:

- "what owns this save value?"
- "what does this TokenShop row actually do?"
- "where does this shard cost formula live?"

That question determines:

- the trace family
- the bounded target
- the minimum required inputs
- the blocker boundary if the answer is still incomplete

### 2. Run trace against direct sources first

Use the trace runner as the front door:

```bash
node scripts/unity/run_probe.mjs trace --family token-shop
node scripts/unity/run_probe.mjs trace --target shard-cost-su0-structure
node scripts/unity/run_probe.mjs trace --query "Antimatter Cores"
```

The trace now prefers direct extraction from:

- `global-metadata.dat`
- `level0`
- `sharedassets0`
- the persistent Ghidra project when native behavior is needed

Stable trace outputs are overwritten in place under `workbench/trace-runs/`. Wait for the trace
command to finish before reading them.

### 3. Expand only when the bounded target is too shallow

Use bounded widening instead of unstructured probe sprawl:

- `--extended-search 1`
  Family-adjacent breadth expansion
- `--extended-search 2`
  Cross-family breadth expansion
- `--depth-search 1`
  One follow-up hop from recovered strong terms
- `--depth-search 2`
  Two follow-up hops

Use depth search when the missing proof is one or two edges away from the current target. Do not
promote depth-derived evidence into the primary template unless it is part of the bounded core
question.

### 4. Use Ghidra only for native behavior

The persistent project is the native implementation cache:

- project: `workbench/ghidra-projects/cifi-full.rep`
- runtime/cache: `workbench/ghidra-runtime/`
- repo-side native result index: `workbench/ghidra-cache/process_project_index.json`

Use Ghidra to recover:

- compare sites
- call chains
- field-offset reads and writes
- native helper families
- reconstructed managed owner/method/field chains when native symbols are stripped

Do not treat Ghidra as the canonical source for Unity class structure. Managed names still come
primarily from metadata.

The repo-side native lane is now schema-versioned and self-healing:

- completed `process-project` jobs carry an explicit native trace schema version
- stale jobs are rerun automatically when the schema is upgraded
- trace consumption no longer accepts pre-upgrade native payloads silently

The practical effect is that cached jobs stay fast, but richer bridge logic is still allowed to
replace older native results when the contract improves.

The cache is now term-centric as well as job-centric:

- each searched term can complete independently
- successful single-term jobs are promoted into a growing native graph
- later searches can reuse that graph when a requested term was already recovered incidentally from
  another searched term
- timeouts on one term no longer discard progress already recovered for earlier terms

The trace now also has a generic promotion layer for strong native reconstructions. When the native
summary can recover one high-confidence owner plus accompanying methods or fields, the bundle can
emit a standard `native-reconstruction` edge automatically without requiring target-specific code
first.

That promotion is now target-bounded as well as score-bounded. The bundle prefers reconstructed
owners that match the target's own bridge candidates, shell window, and anchor set, then carries
the owner-specific methods, fields, and raw values into the trace output.

### 4a. Understand the native bridge output

Native trace results are no longer just:

- literal string hits
- literal native symbol matches

They now preserve four layers of information:

1. native symbols and references when those genuinely exist
2. metadata-side neighborhoods when managed names only survive in `global-metadata.dat`
3. reconstructed owners/classes
4. reconstructed methods, fields, and raw value terms grouped under those owners

For example, a shard formula lane may still have empty native `functions {}` in the strict symbol
sense, but the trace can now still recover:

- owner: `ShardUpgradeInfo`
- method: `get_SU0Cost`
- fields/raw values: `SU0StartCost`, `SU0CostExponent`

That should be treated as meaningful recovered structure, not as “nothing found”.

## Manual vs automatic follow-up

Automatic:

- stale native reruns
- bridge classification
- reconstructed owner/method/field grouping
- scored owner ranking
- standard native reconstruction graph edge promotion

Manual:

- target-specific interpretation of what the reconstructed owner means for blocker clearance
- family-specific suppression when generic ranking still picks noisy neighbors
- canonical data promotion decisions

### 5. Classify the result

After a trace or extraction pass, sort the result into one of four buckets:

- canonical dataset
  Stable app-consumed truth
- boundary dataset
  Explicit blocker or negative join that still matters
- model or support dataset
  Reusable structured support such as a formula model
- ephemeral run output
  A trace run or search result that should stay in `workbench/`

When a native trace succeeds, also classify the reconstructed bridge strength:

- `native-symbol-match`
  direct native symbol survived
- `string-xref-bridge`
  string survives in program memory and points at native functions
- `metadata-neighborhood`
  owner/method/field reconstruction came from managed metadata neighborhoods
- `metadata-only`
  term survived, but no stronger bridge was recovered yet

## Promotion rules

Promote to `data/` only when the output is one of these:

- a verified extracted fact the app can safely consume
- a durable blocker boundary that prevents unsafe promotion
- a reusable model with clear provenance and scope

Do not promote:

- one-off search dumps
- temporary probe artifacts
- heuristics presented as truth
- mixed verified and assumed fields without labels

## Current shape

The repo is in transition:

- the live trace path is increasingly direct-source driven
- older historical probe files still exist
- the long-term target is a smaller canonical/boundary/model layer plus disposable trace runs

That means the right next step after a successful extraction is usually:

1. keep the trace result ephemeral
2. promote only the grounded subset
3. delete or demote any probe artifact that is no longer a live input
