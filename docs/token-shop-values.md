# Token Shop Values

Source: serialized `TokenShop` MonoBehaviour payload in [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0), aligned to declaration-order field names recovered from [`_cifi_apk/global-metadata.dat`](C:\Users\Shadow\Desktop\CiFi\_cifi_apk\global-metadata.dat).

## Grounded conclusions

- The token shop values are stored directly in the `TokenShop` scene object, not only in UI strings.
- The field layout confirms a named `StartCost`, `AdditiveCost`, `Bonus`, `MaxLevel` model for early token tiers.
- Tier-1 generator token boosts use `FillMaxLevel` instead of plain `MaxLevel`.
- Late token upgrades `ATU24` through `ATU28` are also serialized in the same object.

## Selected values

- `TokenBoost`: `StartCost=20`, `AdditiveCost=5`, `Bonus=0.2`, `MaxLevel=20`
- `DiamondBoost`: `StartCost=200`, `AdditiveCost=300`, `Bonus=1`, `MaxLevel=2`
- `CellBoost`: `StartCost=1`, `AdditiveCost=0.25`, `Bonus=1`, `MaxLevel=60`
- `ModBoost`: `StartCost=10`, `AdditiveCost=2`, `Bonus=1.01`, `MaxLevel=200`
- `MK1TokenBoost`: `StartCost=1`, `AdditiveCost=0.1`, `Bonus=1.01`, `FillMaxLevel=5000`
- `MK2TokenBoost`: `StartCost=2`, `AdditiveCost=0.12`, `Bonus=1.01`, `FillMaxLevel=5000`
- `MK3TokenBoost`: `StartCost=3`, `AdditiveCost=0.13`, `Bonus=1.01`, `FillMaxLevel=5000`
- `TokenBoostT2`: `StartCost=1000`, `AdditiveCost=500`, `Bonus=0.5`, `MaxLevel=10`
- `TokenDailiesT2`: `StartCost=1000`, `AdditiveCost=800`, `Bonus=0.2`, `MaxLevel=10`
- `T2Duo3`: `StartCost=100`, `AdditiveCost=3`, `Bonus=1.02`, `MaxLevel=2500`
- `TokenBoostT3`: `StartCost=2500`, `AdditiveCost=750`, `Bonus=1`, `MaxLevel=25`
- `T3Trio1`: `StartCost=7000`, `AdditiveCost=100`, `Bonus=1.03`, `MaxLevel=2000`
- `ATU24`: `StartCost=40000000`, `Bonus1=1.001`, `Bonus2=1.0005`, `Bonus3=1.0003`, `Bonus4=1.0002`, `Bonus5=1.0001`
- `ATU25`: `StartCost=1000000`, `AdditiveCost=25000`, `Bonus=0.5`, `MaxLevel=50`
- `ATU26`: `StartCost=10000000`, `AdditiveCost=1000000`, `Bonus=1000`, `MaxLevel=15`
- `ATU27`: `StartCost=50000000`, `AdditiveCost=10000000`, `Bonus=500`, `MaxLevel=15`
- `ATU28`: `StartCost=250000000`, `AdditiveCost=50000000`, `Bonus=500`, `MaxLevel=15`

## Raw field alignment

The following early fields show the exact byte alignment between metadata names and serialized object data:

- offset `236` `MeltdownActiveObject` -> path `34124`
- offset `248` `MeltdownT2ActiveObject` -> path `34125`
- offset `260` `MeltdownT3ActiveObject` -> path `34129`
- offset `272` `BankFill` -> path `309975`
- offset `284` `TokenShopButtonNotification` -> path `899`
- offset `296` `NavButtonNotification` -> path `13639`
- offset `308` `TokenBankDescriptionText` -> path `290364`
- offset `320` `TokenBoostStartCost` -> 20
- offset `324` `TokenBoostAdditiveCost` -> 5
- offset `328` `TokenBoostBonus` -> 0.2
- offset `332` `TokenBoostMaxLevel` -> 20
- offset `336` `TokenBoostFill` -> path `294959`
- offset `348` `ATU1Button` -> path `15839`
- offset `360` `ATU1MaxOverlay` -> path `49520`
- offset `372` `DiamondBoostStartCost` -> 200
- offset `376` `DiamondBoostAdditiveCost` -> 300
- offset `380` `DiamondBoostBonus` -> 1
- offset `384` `DiamondBoostMaxLevel` -> 2
- offset `388` `DiamondBoostFill` -> path `295016`
- offset `400` `ATU2Button` -> path `15804`
- offset `412` `ATU2MaxOverlay` -> path `49464`
- offset `424` `CellBoostStartCost` -> 1
- offset `428` `CellBoostAdditiveCost` -> 0.25
- offset `432` `CellBoostBonus` -> 1
- offset `436` `CellBoostMaxLevel` -> 60
- offset `440` `CellBoostFill` -> path `294990`
- offset `452` `ATU3Button` -> path `15810`
- offset `464` `ATU3MaxOverlay` -> path `49488`
- offset `476` `ModBoostStartCost` -> 10
- offset `480` `ModBoostAdditiveCost` -> 2
- offset `484` `ModBoostBonus` -> 1.01
- offset `488` `ModBoostMaxLevel` -> 200
- offset `492` `ModBoostFill` -> path `295004`
- offset `504` `ATU4Button` -> path `15796`
- offset `516` `ATU4MaxOverlay` -> path `49474`
- offset `528` `ATU4Content` -> path `33007`

## Formula evidence

- `T2Duo3StartCost=100`, `T2Duo3AdditiveCost=3`, `T2Duo3Bonus=1.02`, `T2Duo3MaxLevel=2500`.
- This matches the in-game `Duo Booster Three` screenshots: cost at level `1722` is `100 + 3 * 1722 = 5266`, displayed as `5.27k` after rounding.
