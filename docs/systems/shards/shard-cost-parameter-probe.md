# Shard Cost Parameter Probe

Source: [`workbench/apk/base/global-metadata.dat`](C:\Users\Shadow\Desktop\CiFi\workbench\apk\base\global-metadata.dat) plus the direct `ShardMining` MonoBehaviour byte range in [`workbench/unity/joined/level0`](C:\Users\Shadow\Desktop\CiFi\workbench\unity\joined\level0).

## Grounded conclusions

- Metadata now preserves a row-complete `SU0-29` family for `StartCost` (30 fields) and `CostExponent` (30 fields).
- Metadata also preserves a row-complete `get_SU0-29Cost` accessor family (30 accessors).
- Shared shard cost breakpoint hooks also survive in metadata as `OverLevel100Exponent, OverLevel200Exponent, OverLevel300Exponent, OverLevel400Exponent`.
- The direct `ShardMining` body contains 7 mixed integer/double parameter tuples beyond the old row-0 shell, which is stronger evidence that numeric shard cost parameters survive in scene data.
- The recovered tuples collapse into 5 distinct parameter signatures inside the direct `ShardMining` payload.
- ShardMining also preserves an exact `SU0-29UnlockReq` int lane ending `... / 8000 / 8050 / 8100` at body offset `1456`.
- Rows `0-29` now have a direct row-aligned tuple map inside `ShardMining` (30 row-aligned tuples).
- Rows `0-29` now also preserve exact trailing `bonusPerLevel` float values inside deterministic row-shaped `ShardMining` row blocks, including row `27` = `1.10 / 1.19 / 1.13`, row `19` = `1.13 / 1.15 / 1.17`, and row `0` = `1.10 / 1.02 / 1.30`.
- The aligned row blocks now preserve exact serialized cost fields: rows `1-29` expose `StartCost / CostExponent / GrowthExponent`, and row `0` exposes `StartCost / CostExponent / GrowthExponent / GrowthExponent2 / GrowthExponent3`.
- The old row-local integer-at-+8 is still preserved as an auxiliary unknown, but it no longer outranks the ordered double-field mapping as the strongest current named-cost recovery.
- Row `0` now resolves deterministically from the pointer run immediately before row `1`, with `pointerRefCount=19` and `trailingSlackByteCount=20`.
- These tuples are not yet fully formula-mapped, so they are preserved as candidate parameter records rather than promoted as final shard costs.
- Every recovered tuple ends in the same `0xFFFFFFFF`-style tail sentinel pattern, which strengthens the repeated-record interpretation.

## Unlock requirement lane

- `offset=1456`; `absolute=34089840`; `values=[0, 0, 5, 10, 20, 30, 40, 50, 120, 150, 180, 340, 520, 560, 700, 800, 900, 1000, 1100, 1400, 1500, 1600, 1700, 1800, 3300, 3600, 3900, 8000, 8050, 8100]`
- This 30-int lane is the strongest direct match for the shard unlock requirement family inside ShardMining.
- It preserves the zero-start pattern for rows 0-1, the early 5/10/20/30 progression, and the late 8000/8050/8100 thresholds for rows 27-29.
- That makes it strong enough to treat as the exact serialized SU0-29 unlock requirement block rather than a generic int cluster.

## Signature groups

- `leading=1.0`; `exponentA=2.5`; `exponentB=4.0`; `count=3`; `ints=[70, 82, 89]`; `tails=[0.01875000072, 0.025000009661, 0.012187505127]`
- `leading=2.0`; `exponentA=2.0`; `exponentB=2.0`; `count=1`; `ints=[21]`; `tails=[0.011562498273]`
- `leading=2.0`; `exponentA=2.25`; `exponentB=4.0`; `count=1`; `ints=[975]`; `tails=[0.023750010852]`
- `leading=4.0`; `exponentA=2.0`; `exponentB=3.8`; `count=1`; `ints=[3]`; `tails=[0.025000009668]`
- `leading=4.0`; `exponentA=2.29`; `exponentB=4.0`; `count=1`; `ints=[982]`; `tails=[0.038750000244]`

## Row-aligned tuple map

- `row=0`; `rarity=Unique`; `unlockReq=0`; `bonusCount=3`; `pointerRefs=19`; `costFields={'StartCost': 5.0, 'CostExponent': 1.3, 'GrowthExponent': 1.5, 'GrowthExponent2': 1.1, 'GrowthExponent3': 2.0}`; `auxInt=0`; `bonusPerLevel=[1.100000023842, 1.019999980927, 1.299999952316]`; `leading=5.0`; `int=0`; `exponentA=1.3`; `exponentB=1.5`; `tailScalar=1.1`
- `row=1`; `rarity=common`; `unlockReq=0`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 2.0, 'CostExponent': 1.15, 'GrowthExponent': 1.3}`; `auxInt=0`; `bonusPerLevel=[1.05999994278, 1.05999994278, 1.05999994278]`; `leading=2.0`; `int=0`; `exponentA=1.15`; `exponentB=1.3`; `tailScalar=0.011562498273`
- `row=2`; `rarity=common`; `unlockReq=5`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 6.0, 'CostExponent': 1.22, 'GrowthExponent': 2.2}`; `auxInt=0`; `bonusPerLevel=[1.05999994278, 1.05999994278, 1.05999994278]`; `leading=6.0`; `int=0`; `exponentA=1.22`; `exponentB=2.2`; `tailScalar=0.011562498273`
- `row=3`; `rarity=common`; `unlockReq=10`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 9.0, 'CostExponent': 1.24, 'GrowthExponent': 2.6}`; `auxInt=0`; `bonusPerLevel=[1.05999994278, 1.070000052452, 1.080000042915]`; `leading=9.0`; `int=0`; `exponentA=1.24`; `exponentB=2.6`; `tailScalar=0.012187505127`
- `row=4`; `rarity=Rare`; `unlockReq=20`; `bonusCount=4`; `pointerRefs=9`; `costFields={'StartCost': 2.4, 'CostExponent': 1.4, 'GrowthExponent': 1.2}`; `auxInt=1`; `bonusPerLevel=[1.05999994278, 1.049999952316, 1.039999961853, 0.009999999776]`; `leading=2.4`; `int=1`; `exponentA=1.4`; `exponentB=1.2`; `tailScalar=0.010937498869`
- `row=5`; `rarity=common`; `unlockReq=30`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 4.0, 'CostExponent': 1.26, 'GrowthExponent': 3.2}`; `auxInt=1`; `bonusPerLevel=[1.05999994278, 1.070000052452, 1.080000042915]`; `leading=4.0`; `int=1`; `exponentA=1.26`; `exponentB=3.2`; `tailScalar=0.012187505127`
- `row=6`; `rarity=common`; `unlockReq=40`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 8.0, 'CostExponent': 1.26, 'GrowthExponent': 3.4}`; `auxInt=1`; `bonusPerLevel=[1.05999994278, 1.070000052452, 1.080000042915]`; `leading=8.0`; `int=1`; `exponentA=1.26`; `exponentB=3.4`; `tailScalar=0.012187505127`
- `row=7`; `rarity=Rare`; `unlockReq=50`; `bonusCount=4`; `pointerRefs=9`; `costFields={'StartCost': 1.4, 'CostExponent': 1.5, 'GrowthExponent': 2.5}`; `auxInt=2`; `bonusPerLevel=[1.090000033379, 1.110000014305, 1.129999995232, 1.149999976158]`; `leading=1.4`; `int=2`; `exponentA=1.5`; `exponentB=2.5`; `tailScalar=0.014687502743`
- `row=8`; `rarity=Epic`; `unlockReq=120`; `bonusCount=5`; `pointerRefs=11`; `costFields={'StartCost': 4.0, 'CostExponent': 2.0, 'GrowthExponent': 3.8}`; `auxInt=3`; `bonusPerLevel=[1.399999976158, 1.200000047684, 1.799999952316, 1.200000047684, 2.0]`; `leading=4.0`; `int=3`; `exponentA=2.0`; `exponentB=3.8`; `tailScalar=0.025000009668`
- `row=9`; `rarity=common`; `unlockReq=150`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 3.1, 'CostExponent': 1.5, 'GrowthExponent': 1.6}`; `auxInt=4`; `bonusPerLevel=[1.05999994278, 1.070000052452, 1.080000042915]`; `leading=3.1`; `int=4`; `exponentA=1.5`; `exponentB=1.6`; `tailScalar=0.012187505127`
- `row=10`; `rarity=common`; `unlockReq=180`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 3.6, 'CostExponent': 1.48, 'GrowthExponent': 1.8}`; `auxInt=4`; `bonusPerLevel=[1.05999994278, 1.070000052452, 1.080000042915]`; `leading=3.6`; `int=4`; `exponentA=1.48`; `exponentB=1.8`; `tailScalar=0.012187505127`
- `row=11`; `rarity=Rare`; `unlockReq=340`; `bonusCount=4`; `pointerRefs=9`; `costFields={'StartCost': 5.6, 'CostExponent': 1.6, 'GrowthExponent': 2.8}`; `auxInt=7`; `bonusPerLevel=[1.399999976158, 1.5, 1.600000023842, 1.700000047684]`; `leading=5.6`; `int=7`; `exponentA=1.6`; `exponentB=2.8`; `tailScalar=0.125000029663`
- `row=12`; `rarity=Epic`; `unlockReq=520`; `bonusCount=5`; `pointerRefs=11`; `costFields={'StartCost': 9.99, 'CostExponent': 3.0, 'GrowthExponent': 1.8}`; `auxInt=12`; `bonusPerLevel=[1.200000047684, 1.149999976158, 1.100000023842, 2.0, 1.25]`; `leading=9.99`; `int=12`; `exponentA=3.0`; `exponentB=1.8`; `tailScalar=0.018750000722`
- `row=13`; `rarity=common`; `unlockReq=560`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 2.0, 'CostExponent': 1.78, 'GrowthExponent': 8.0}`; `auxInt=13`; `bonusPerLevel=[1.05999994278, 1.070000052452, 1.080000042915]`; `leading=2.0`; `int=13`; `exponentA=1.78`; `exponentB=8.0`; `tailScalar=0.012187505127`
- `row=14`; `rarity=Rare`; `unlockReq=700`; `bonusCount=4`; `pointerRefs=9`; `costFields={'StartCost': 2.0, 'CostExponent': 4.0, 'GrowthExponent': 2.0}`; `auxInt=17`; `bonusPerLevel=[1.149999976158, 1.179999947548, 1.210000038147, 0.009999999776]`; `leading=2.0`; `int=17`; `exponentA=4.0`; `exponentB=2.0`; `tailScalar=0.022499997144`
- `row=15`; `rarity=common`; `unlockReq=800`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 2.0, 'CostExponent': 2.0, 'GrowthExponent': 2.0}`; `auxInt=21`; `bonusPerLevel=[1.05999994278, 1.05999994278, 1.05999994278]`; `leading=2.0`; `int=21`; `exponentA=2.0`; `exponentB=2.0`; `tailScalar=0.011562498273`
- `row=16`; `rarity=Rare`; `unlockReq=900`; `bonusCount=4`; `pointerRefs=9`; `costFields={'StartCost': 6.0, 'CostExponent': 4.0, 'GrowthExponent': 1.2}`; `auxInt=23`; `bonusPerLevel=[1.049999952316, 1.25, 1.049999952316, 1.299999952316]`; `leading=6.0`; `int=23`; `exponentA=4.0`; `exponentB=1.2`; `tailScalar=0.031250007395`
- `row=17`; `rarity=Epic`; `unlockReq=1000`; `bonusCount=5`; `pointerRefs=11`; `costFields={'StartCost': 8.0, 'CostExponent': 3.0, 'GrowthExponent': 5.0}`; `auxInt=25`; `bonusPerLevel=[2.200000047684, 1.090000033379, 1.070000052452, 1.129999995232, 1.090000033379]`; `leading=8.0`; `int=25`; `exponentA=3.0`; `exponentB=5.0`; `tailScalar=0.01343750395`
- `row=18`; `rarity=Legendary`; `unlockReq=1100`; `bonusCount=6`; `pointerRefs=13`; `costFields={'StartCost': 1.5, 'CostExponent': 1.0, 'GrowthExponent': 5.0}`; `auxInt=33`; `bonusPerLevel=[1.149999976158, 1.159999966621, 6.0, 1.370000004768, 1.590000033379, 1.389999985695]`; `leading=1.5`; `int=33`; `exponentA=1.0`; `exponentB=5.0`; `tailScalar=0.019999999528`
- `row=19`; `rarity=common`; `unlockReq=1400`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 1.0, 'CostExponent': 2.5, 'GrowthExponent': 4.0}`; `auxInt=70`; `bonusPerLevel=[1.129999995232, 1.149999976158, 1.169999957085]`; `leading=1.0`; `int=70`; `exponentA=2.5`; `exponentB=4.0`; `tailScalar=0.01875000072`
- `row=20`; `rarity=common`; `unlockReq=1500`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 1.0, 'CostExponent': 2.5, 'GrowthExponent': 4.0}`; `auxInt=82`; `bonusPerLevel=[1.149999976158, 1.200000047684, 1.070000052452]`; `leading=1.0`; `int=82`; `exponentA=2.5`; `exponentB=4.0`; `tailScalar=0.025000009661`
- `row=21`; `rarity=common`; `unlockReq=1600`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 1.0, 'CostExponent': 2.5, 'GrowthExponent': 4.0}`; `auxInt=89`; `bonusPerLevel=[1.019999980927, 1.070000052452, 1.120000004768]`; `leading=1.0`; `int=89`; `exponentA=2.5`; `exponentB=4.0`; `tailScalar=0.012187505127`
- `row=22`; `rarity=Rare`; `unlockReq=1700`; `bonusCount=4`; `pointerRefs=9`; `costFields={'StartCost': 1.0, 'CostExponent': 5.0, 'GrowthExponent': 3.0}`; `auxInt=97`; `bonusPerLevel=[2.200000047684, 2.299999952316, 2.400000095367, 2.5]`; `leading=1.0`; `int=97`; `exponentA=5.0`; `exponentB=3.0`; `tailScalar=4.80000019148`
- `row=23`; `rarity=Epic`; `unlockReq=1800`; `bonusCount=5`; `pointerRefs=11`; `costFields={'StartCost': 1.0, 'CostExponent': 1.0, 'GrowthExponent': 1.0}`; `auxInt=114`; `bonusPerLevel=[1.120000004768, 1.120000004768, 1.179999947548, 1.070000052452, 1.350000023842]`; `leading=1.0`; `int=114`; `exponentA=1.0`; `exponentB=1.0`; `tailScalar=0.015312502148`
- `row=24`; `rarity=Rare`; `unlockReq=3300`; `bonusCount=4`; `pointerRefs=9`; `costFields={'StartCost': 4.0, 'CostExponent': 5.0, 'GrowthExponent': 5.0}`; `auxInt=275`; `bonusPerLevel=[1.549999952316, 1.5, 1.950000047684, 2.049999952316]`; `leading=4.0`; `int=275`; `exponentA=5.0`; `exponentB=5.0`; `tailScalar=0.125000029698`
- `row=25`; `rarity=Low Pristine`; `unlockReq=3600`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 3.0, 'CostExponent': 2.0, 'GrowthExponent': 2.0}`; `auxInt=350`; `bonusPerLevel=[1.22000002861, 1.75, 1.350000023842]`; `leading=3.0`; `int=350`; `exponentA=2.0`; `exponentB=2.0`; `tailScalar=0.500000118483`
- `row=26`; `rarity=Mid Pristine`; `unlockReq=3900`; `bonusCount=5`; `pointerRefs=11`; `costFields={'StartCost': 5.0, 'CostExponent': 2.0, 'GrowthExponent': 6.0}`; `auxInt=500`; `bonusPerLevel=[2.200000047684, 1.06400001049, 1.044000029564, 1.067999958992, 1.072000026703]`; `leading=5.0`; `int=500`; `exponentA=2.0`; `exponentB=6.0`; `tailScalar=0.01181250252`
- `row=27`; `rarity=common`; `unlockReq=8000`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 2.0, 'CostExponent': 2.25, 'GrowthExponent': 4.0}`; `auxInt=975`; `bonusPerLevel=[1.100000023842, 1.19000005722, 1.129999995232]`; `leading=2.0`; `int=975`; `exponentA=2.25`; `exponentB=4.0`; `tailScalar=0.023750010852`
- `row=28`; `rarity=common`; `unlockReq=8050`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 4.0, 'CostExponent': 2.29, 'GrowthExponent': 4.0}`; `auxInt=982`; `bonusPerLevel=[1.070000052452, 1.27999997139, 1.120000004768]`; `leading=4.0`; `int=982`; `exponentA=2.29`; `exponentB=4.0`; `tailScalar=0.038750000244`
- `row=29`; `rarity=common`; `unlockReq=8100`; `bonusCount=3`; `pointerRefs=7`; `costFields={'StartCost': 6.0, 'CostExponent': 2.3, 'GrowthExponent': 4.0}`; `auxInt=988`; `bonusPerLevel=[1.159999966621, 1.018000006676, 1.027999997139]`; `leading=6.0`; `int=988`; `exponentA=2.3`; `exponentB=4.0`; `tailScalar=0.008937502268`

## Row 0 aligned block

- `unlockReq=0`; `pointerRefs=19`; `costFields={'StartCost': 5.0, 'CostExponent': 1.3, 'GrowthExponent': 1.5, 'GrowthExponent2': 1.1, 'GrowthExponent3': 2.0}`; `auxInt=0`; `bonusPerLevel=[1.100000023842, 1.019999980927, 1.299999952316]`; `leading=5.0`; `int=0`; `exponentA=1.3`; `exponentB=1.5`; `tailScalar=1.1`; `trailingSlackByteCount=20`
- The row-0 block is now bounded by the same explicit row-shape rule as the other rows; the slack before row 1 is preserved as non-row spillover instead of folded into row-0 bonus floats.

## Repeated common-row group

- Rows `19-21` share the repeated `leading=1`, `exponentA=2.5`, `exponentB=4` signature.
- This is now a direct row-aligned grouping result, but the tuple fields are still not fully typed.

## Candidate tuples

- `offset=3112`; `leading=4.0`; `int=3`; `exponentA=2.0`; `exponentB=3.8`; `tailScalar=0.025000009668`; `tailSentinels=(4294967294, 4294967295)`
- `offset=4240`; `leading=2.0`; `int=21`; `exponentA=2.0`; `exponentB=2.0`; `tailScalar=0.011562498273`; `tailSentinels=(4294967295, 4294967295)`
- `offset=4984`; `leading=1.0`; `int=70`; `exponentA=2.5`; `exponentB=4.0`; `tailScalar=0.01875000072`; `tailSentinels=(4294967295, 4294967295)`
- `offset=5128`; `leading=1.0`; `int=82`; `exponentA=2.5`; `exponentB=4.0`; `tailScalar=0.025000009661`; `tailSentinels=(4294967295, 4294967295)`
- `offset=5272`; `leading=1.0`; `int=89`; `exponentA=2.5`; `exponentB=4.0`; `tailScalar=0.012187505127`; `tailSentinels=(4294967295, 4294967295)`
- `offset=6304`; `leading=2.0`; `int=975`; `exponentA=2.25`; `exponentB=4.0`; `tailScalar=0.023750010852`; `tailSentinels=(4294967295, 4294967295)`
- `offset=6448`; `leading=4.0`; `int=982`; `exponentA=2.29`; `exponentB=4.0`; `tailScalar=0.038750000244`; `tailSentinels=(4294967295, 4294967295)`
