# AGENTS.md

## Purpose

Evolve this repo toward a grounded MVP core replacing fragmented external CiFi tools.

## Working rules

- Make incremental, focused changes
- Preserve local-first browser behavior
- Continue in same lane by default after successful runs
- Choose next highest-value adjacent step automatically
- Stop only when human input/validation/cross-lane choices are needed

## MVP scope

Prioritize:

- `state.playerProfile`
- Guided/manual player import
- Grounded shard workflow
- MVP-safe token/diamond planning
- Loop-reset guardrails
- Explainable recommendation outputs

## Lane contract

Each lane must declare:

- User-facing question
- Minimum required inputs
- Explicit non-blockers
- Current true blocker
- Largest coherent adjacent slice
- Default next step

## Grounding rule

Only add fields/labels/formulas/recommendations if:

1. Known in-game CIFI concept
2. Clearly labeled external/community input

## Data provenance rule

Never promote guessed, heuristic, or assumed data into canonical state without explicit labeling:

- If data is extracted from game binary/metadata → Label as "verified" or "extracted"
- If data is reasonable guess from patterns → Label as "assumed" or "heuristic" with noted uncertainty
- If data is from community/external source → Label as "community" or "external"
- Never mix unverified assumptions with grounded truth in shared state boundaries

When in doubt, leave data as external/compatibility-only until verified.

## Integration gate

Before wiring systems into app behavior:

1. Verify in-game location/owner/currencies
2. Distinguish in-game labels vs ids/community names
3. Track verified facts vs unresolved assumptions
4. Align with user painpoints/external-tool workflows

## Architecture rules

1. Keep `state.playerProfile` as shared state boundary
2. Separate canonical state, planning helpers, external models, and compatibility data
3. Preserve explainability in outputs
4. Avoid mixing grounded truth with heuristic/model assumptions
5. Prefer workflow consolidation over abstract architectural neatness

## Source priority

1. Committed repo docs/datasets
2. Committed APK/Unity artifacts/extraction outputs
3. Official/public corroboration
4. Community/external-model labeled support

Agents should prefer APK/Unity extraction/mapping when grounded game truth is missing.

## Test suite rules

The smoke test suite (`tests/smoke.mjs`) catches drift between committed data and code expectations. When data changes are intentional (not regressions), realign the smoke tests rather than reverting the data changes. This means:

1. Update assertions to match new data structure
2. Update expected dataset IDs in bundled-dataset-contract validation
3. Update bootstrap fetch paths if new datasets are added
4. Run smoke tests after any data or dataset-contract changes

The test suite exists to catch unintended drift - intentional changes are expected to update the test surface.

## Regression prevention

When adding optimizations or performance improvements to tools:

1. **Never remove existing optimizations** - If code has Parallel.ForEach, type indexing, or caching, keep it unless specifically asked
2. **Build before committing** - Run `dotnet build` to catch compilation errors from optimization changes
3. **Test changes** - Run smoke tests to verify tool still produces correct output
4. **Document new flags** - If adding new CLI flags (--quick, --cache, --no-metadata), update docs/tools/inventory.md
5. **Keep pass-through working** - If modifying run_probe.mjs, ensure --arg syntax still passes through to underlying tools

## Tool inventory

See [docs/tools/inventory.md](docs/tools/inventory.md) for a complete inventory of available tools, scripts, and their usage.
