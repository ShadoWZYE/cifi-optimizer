# Daily Tokenium Mission Lane Verification

This document records what is currently grounded about the Daily Tokenium lane that TokenShop touches.

It exists because the lane should no longer be treated as an unresolved TokenShop-only mechanic. The available Unity evidence shows Daily Tokenium living in the Academy or Farm Mission family, with TokenShop, loop modifiers, and permanent packs acting as modifiers or presentation layers around it.

## Verified now

- `SpaceAcademy` exists as a real navigation surface in `level0`, beside other first-class menu buttons such as `TokenShopButton`, `LoopModifiers`, and `DailyRewards`.
- `FarmMissions`, `FarmMission1`, `FarmMission2`, `FarmMission3`, `FarmMission4-C12`, and `FarmMissionFill` exist as real scene or prefab labels in `level0`.
- Daily Tokenium is explicitly described as mission-fed:
  - `0 / 2000 Daily Tokenium (from blue farm missions)`
  - `This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)`
- The Academy or mission lane has adjacent reward terminology:
  - `MISSION MATERIALS GAINED`
  - `Mission Materials Booster`
  - `Academy Booster`
  - `Statistic-FragmentsPerFarmMission`
- Loop modifiers are tied to Academy and Farm Mission unlocks:
  - `New Loop Mods & Academy Missions!`
  - `4 New Loop Mods unlocking new Academy Campaigns (4 per planet) & Farm Missions (1 per planet)`
- The Collector pack also modifies the same lane:
  - `The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu`

## Grounded conclusions

- Daily Tokenium currently belongs to the Academy or Farm Mission reward family, not to a pure TokenShop-only state family.
- TokenShop is still part of this lane, but as a modifier path:
  - it owns at least one upgrade text path that raises the Daily Tokenium cap
  - it does not currently appear to be the sole owner of the underlying mission-fed lane
- Loop modifiers are adjacent to this same lane:
  - they unlock Academy Campaigns and Farm Missions
  - `LM244` currently remains a text or explanation hook, not the gameplay owner
- The Collector pack is another separate modifier family on the same lane, specifically boosting mission materials and the farmable Daily Tokenium cap in the Academy menu.

Safe repo conclusion:

- treat Daily Tokenium as an Academy or Farm Mission lane with multiple modifier families touching it
- do not model it as a standalone TokenShop-only mechanic
- do not model it as a LoopModifiers-owned mechanic either

## Modifier-family split recovered from this pass

- `Academy / Farm Missions`
  - grounded as the underlying lane family through `SpaceAcademy`, `FarmMissions`, mission-prefab labels, and mission-fed Daily Tokenium strings
- `TokenShop`
  - grounded as one modifier family on the lane because a TokenShop upgrade text explicitly increases the Daily Tokenium cap and references Farm Missions
- `LoopModifiers`
  - grounded as an unlock or explanation family on the lane because loop-mod strings unlock Academy Campaigns and Farm Missions, and `LM244` renders a Daily Tokenium text path
- `Collector` pack
  - grounded as a premium modifier family on the lane because its description explicitly increases Mission Materials and the Daily Tokenium cap in the Academy menu

## Not yet verified enough for app integration

- the specific gameplay owner class for current Daily Tokenium amount or cap
- the saved-state field that stores current farmed Daily Tokenium
- whether `Tokenium` and `Tokenium-553` are presentation variants of one lane or distinct internal resource labels
- the exact formula path that combines:
  - base Academy or Farm Mission rewards
  - TokenShop modifiers
  - loop-mod unlocks or modifiers
  - Collector-pack modifiers
- whether mission materials and Daily Tokenium share one owner family or only share UI locality

## Current app implication

- Daily Tokenium should remain `available but unmapped`.
- Future spend-planner work should treat it as a cross-system mission lane, not as a simple TokenShop budget field.
- The next mapping pass should chase the gameplay owner or saved-state family for Academy or Farm Mission reward state, not only more TokenShop strings.
