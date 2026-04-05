# Shard Scene MonoBehaviour Probe

Source: direct `MonoBehaviour` inventory from [`workbench/unity/joined`](C:\Users\Shadow\Desktop\CiFi\workbench\unity\joined), read with vendored `UnityPy` plus local optional-dependency stubs so plain serialized-file reads still work in this repo.

## Grounded conclusions

- `level0` contains a direct `ShardMining` MonoBehaviour object, not just shard-related strings.
- `level0` also contains a direct shard bonus text handler object (`ShardPerLevelTextHandler`) and a separate `ConstructionMilestones` object in the same scene file.
- The current direct parser target for shard cost/value extraction is therefore the exact `ShardMining` byte range preserved below.
- This probe narrows the byte target for future cost extraction, but it does not yet recover typed numeric field values from the `ShardMining` payload.

## Extracted scene objects

- `ConstructionMilestones`: `pathId=270194`; `assetsFile=level0`; `byteStart=30515072`; `byteSize=4944`; `scriptPathId=1983`
- `ShardMining`: `pathId=290724`; `assetsFile=level0`; `byteStart=34088352`; `byteSize=6732`; `scriptPathId=2657`
- `ShardPerLevelTextHandler`: `pathId=286629`; `assetsFile=level0`; `byteStart=33319696`; `byteSize=1328`; `scriptPathId=1984`
