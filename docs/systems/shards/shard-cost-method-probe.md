# Shard Cost Method Probe

Source: [`data/uabea-type-metadata-support.v1.json`](data/uabea-type-metadata-support.v1.json) plus the native code bytes in [`workbench/apk/base/libil2cpp.so`](workbench/apk/base/libil2cpp.so).

## Grounded conclusions

- ShardMining preserves a real get_SU0-29Cost runtime family returning BreakInfinity.BigDouble inside libil2cpp.so, not just metadata names.
- UpdateShardCostList, four get_OverLevel*Exponent helpers, and get_SU0Cost sit in one contiguous tracked neighborhood, which is the strongest current formula neighborhood for shard next-cost recovery.
- The get_SU1-17Cost accessors mostly collapse into a near-uniform tracked body-size band around 3279-3287 bytes, which is consistent with one repeated code template with row-local constants.
- Late getters diverge into smaller tracked size bands such as rows 19-21 at 3258 bytes, rows 23-24 at 2983 bytes, and rows 28-29 at 2693 bytes, which is consistent with branch changes or lane-specific late-game cost logic.
- The repo still does not preserve the decoded method bodies, so these tracked sizes narrow the formula search but do not by themselves prove the exact get_SU*Cost equation.

## Helper neighborhood

- `UpdateShardCostList`; `rva=38238055`; `estimatedTrackedBodySize=1366`; `returnType=System.Void`
- `get_OverLevel100Exponent`; `rva=38239421`; `estimatedTrackedBodySize=187`; `returnType=BreakInfinity.BigDouble`
- `get_OverLevel200Exponent`; `rva=38239608`; `estimatedTrackedBodySize=190`; `returnType=BreakInfinity.BigDouble`
- `get_OverLevel300Exponent`; `rva=38239798`; `estimatedTrackedBodySize=190`; `returnType=BreakInfinity.BigDouble`
- `get_OverLevel400Exponent`; `rva=38239988`; `estimatedTrackedBodySize=190`; `returnType=BreakInfinity.BigDouble`
- `SortCostAndBools`; `rva=38348434`; `estimatedTrackedBodySize=734`; `returnType=System.Void`
- `GetShardCostList`; `rva=38349168`; `estimatedTrackedBodySize=2694`; `returnType=System.Collections.Generic.List`1<BreakInfinity.BigDouble>`
- `CountAffordableShard`; `rva=38351862`; `estimatedTrackedBodySize=None`; `returnType=System.Void`

## Cost getter family

- `row=0`; `get_SU0Cost`; `rva=38240178`; `estimatedTrackedBodySize=13978`; `entryBytes=5541574156415541`
- `row=1`; `get_SU1Cost`; `rva=38254156`; `estimatedTrackedBodySize=3282`; `entryBytes=5541574156415541`
- `row=2`; `get_SU2Cost`; `rva=38257438`; `estimatedTrackedBodySize=3279`; `entryBytes=5541574156415541`
- `row=3`; `get_SU3Cost`; `rva=38260717`; `estimatedTrackedBodySize=3279`; `entryBytes=5541574156415541`
- `row=4`; `get_SU4Cost`; `rva=38263996`; `estimatedTrackedBodySize=3282`; `entryBytes=5541574156415541`
- `row=5`; `get_SU5Cost`; `rva=38267278`; `estimatedTrackedBodySize=3279`; `entryBytes=5541574156415541`
- `row=6`; `get_SU6Cost`; `rva=38270557`; `estimatedTrackedBodySize=3282`; `entryBytes=5541574156415541`
- `row=7`; `get_SU7Cost`; `rva=38273839`; `estimatedTrackedBodySize=3284`; `entryBytes=5541574156415541`
- `row=8`; `get_SU8Cost`; `rva=38277123`; `estimatedTrackedBodySize=3284`; `entryBytes=5541574156415541`
- `row=9`; `get_SU9Cost`; `rva=38280407`; `estimatedTrackedBodySize=3284`; `entryBytes=5541574156415541`
- `row=10`; `get_SU10Cost`; `rva=38283691`; `estimatedTrackedBodySize=3284`; `entryBytes=5541574156415541`
- `row=11`; `get_SU11Cost`; `rva=38286975`; `estimatedTrackedBodySize=3284`; `entryBytes=5541574156415541`
- `row=12`; `get_SU12Cost`; `rva=38290259`; `estimatedTrackedBodySize=3287`; `entryBytes=5541574156415541`
- `row=13`; `get_SU13Cost`; `rva=38293546`; `estimatedTrackedBodySize=3287`; `entryBytes=5541574156415541`
- `row=14`; `get_SU14Cost`; `rva=38296833`; `estimatedTrackedBodySize=3287`; `entryBytes=5541574156415541`
- `row=15`; `get_SU15Cost`; `rva=38300120`; `estimatedTrackedBodySize=3287`; `entryBytes=5541574156415541`
- `row=16`; `get_SU16Cost`; `rva=38303407`; `estimatedTrackedBodySize=3287`; `entryBytes=5541574156415541`
- `row=17`; `get_SU17Cost`; `rva=38306694`; `estimatedTrackedBodySize=3009`; `entryBytes=5541574156415541`
- `row=18`; `get_SU18Cost`; `rva=38309703`; `estimatedTrackedBodySize=2735`; `entryBytes=5541574156415541`
- `row=19`; `get_SU19Cost`; `rva=38312438`; `estimatedTrackedBodySize=3258`; `entryBytes=5541574156415541`
- `row=20`; `get_SU20Cost`; `rva=38315696`; `estimatedTrackedBodySize=3258`; `entryBytes=5541574156415541`
- `row=21`; `get_SU21Cost`; `rva=38318954`; `estimatedTrackedBodySize=3258`; `entryBytes=5541574156415541`
- `row=22`; `get_SU22Cost`; `rva=38322212`; `estimatedTrackedBodySize=2983`; `entryBytes=5541574156415541`
- `row=23`; `get_SU23Cost`; `rva=38325195`; `estimatedTrackedBodySize=2983`; `entryBytes=5541574156415541`
- `row=24`; `get_SU24Cost`; `rva=38328178`; `estimatedTrackedBodySize=2662`; `entryBytes=5541574156415541`
- `row=25`; `get_SU25Cost`; `rva=38330840`; `estimatedTrackedBodySize=2346`; `entryBytes=5541574156415541`
- `row=26`; `get_SU26Cost`; `rva=38333186`; `estimatedTrackedBodySize=2392`; `entryBytes=5541574156415541`
- `row=27`; `get_SU27Cost`; `rva=38335578`; `estimatedTrackedBodySize=2693`; `entryBytes=5541574156415541`
- `row=28`; `get_SU28Cost`; `rva=38338271`; `estimatedTrackedBodySize=2693`; `entryBytes=5541574156415541`
- `row=29`; `get_SU29Cost`; `rva=38340964`; `estimatedTrackedBodySize=7470`; `entryBytes=5541574156415541`

## Tracked size clusters

- `size=3284`; `count=5`; `rows=[7, 8, 9, 10, 11]`
- `size=3287`; `count=5`; `rows=[12, 13, 14, 15, 16]`
- `size=3258`; `count=3`; `rows=[19, 20, 21]`
- `size=3279`; `count=3`; `rows=[2, 3, 5]`
- `size=3282`; `count=3`; `rows=[1, 4, 6]`
- `size=2693`; `count=2`; `rows=[27, 28]`
- `size=2983`; `count=2`; `rows=[22, 23]`
- `size=2346`; `count=1`; `rows=[25]`
- `size=2392`; `count=1`; `rows=[26]`
- `size=2662`; `count=1`; `rows=[24]`
- `size=2735`; `count=1`; `rows=[18]`
- `size=3009`; `count=1`; `rows=[17]`
- `size=7470`; `count=1`; `rows=[29]`
- `size=13978`; `count=1`; `rows=[0]`

## Current boundary

- Treat get_SU0-29Cost as a verified runtime getter family on ShardMining with direct libil2cpp RVAs and entry bytes.
- Treat UpdateShardCostList, get_OverLevel100-400Exponent, GetShardCostList, SortCostAndBools, and CountAffordableShard as the strongest current native helper neighborhood for shard cost recovery.
- Treat tracked body-size clusters as code-shape evidence for shared or split cost lanes, not as final proof of the exact mathematical formula.
- Do not promote next-level shard costs as player-facing truth until the repo recovers or verifies the actual BigDouble computation used by the getter family.

