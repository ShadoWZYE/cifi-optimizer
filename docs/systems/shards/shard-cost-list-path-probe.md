# Shard Cost List Path Probe

Source: [`data/shard-cost-method-probe.v1.json`](C:\Users\Shadow\Desktop\CiFi\data\shard-cost-method-probe.v1.json), [`data/uabea-probe-report.json`](C:\Users\Shadow\Desktop\CiFi\data\uabea-probe-report.json), and disassembly of [`workbench/apk/base/libil2cpp.so`](C:\Users\Shadow\Desktop\CiFi\workbench\apk\base\libil2cpp.so).

## Grounded conclusions

- `GetShardCostList` allocates a `List<BreakInfinity.BigDouble>` and appends row costs by calling `get_SU0Cost` through `get_SU29Cost` in order.
- `UpdateShardCostList` refreshes the owner-side `MilestoneCostList` field before downstream shard sorting and affordability passes.
- `SortCostAndBools` consumes the list-builder path rather than bypassing it.
- `CountAffordableShard` works downstream from the sorted cost list, so affordability logic does not reveal a separate hidden cost formula.

## Current boundary

- Treat the list-builder path as a checked owner-side cache of the getter family outputs.
- Treat it as evidence that the remaining formula work still lives inside `get_SU*Cost`.
- Do not expose exact shard next-costs until those getter bodies are fully explained.
