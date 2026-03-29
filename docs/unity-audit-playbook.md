# Unity Audit Playbook

This document captures the current extraction pathway for grounded CIFI mechanics from the Android/Unity build so the work can be resumed on another machine without reconstructing the process from chat history.

## Scope

- Goal: recover grounded in-game mechanic owners, field names, and serialized constants from the shipped Unity/IL2CPP build.
- Current proven owners:
  - `TokenShop` in [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
  - `MultiverseMarket` in [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
- Current non-goal: full save-file decoding. The external save/export blobs are still opaque and should not block mechanic extraction.

## Source Inputs

These inputs are now committed in the repository and restored through Git LFS:

- extracted APK payload under `_cifi_apk`
- merged APK layout under `_cifi_apk_merged`
- joined Unity asset files under `_unity_joined`

These remain external prerequisites:

- Git LFS to restore the committed large files
- Python 3.11+ to run the maintained parser scripts
- `.NET 6 Runtime` for `UABEA`
- `.NET 8 SDK` only if rebuilding `tools/CifiAssetProbe`
- LDPlayer only if recreating raw extracts from the emulator

Important primary files:

- [`_cifi_apk/global-metadata.dat`](C:\Users\Shadow\Desktop\CiFi\_cifi_apk\global-metadata.dat)
- [`_cifi_apk/libil2cpp.so`](C:\Users\Shadow\Desktop\CiFi\_cifi_apk\libil2cpp.so)
- [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
- [`_unity_joined/sharedassets0.assets`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\sharedassets0.assets)

## Proven Workflow

1. Confirm the Android package and pull accessible app storage through LDPlayer ADB.
2. Extract the APK and split APK payloads into `_cifi_apk`.
3. Merge the split APK native libraries with the base APK assets into `_cifi_apk_merged`.
4. Join Unity split asset containers into `_unity_joined`.
5. Use `rg -aob` against `global-metadata.dat` to locate class names, method names, and field neighborhoods for the target system.
6. Use `level0` string anchors to locate the concrete scene prefab names and UI owner objects.
7. Resolve the real `MonoBehaviour` owner by scanning MonoBehaviour headers and matching `m_Script` path IDs back to `MonoScript` names.
8. Parse the raw serialized object payload directly when tool-side IL2CPP typetree generation fails.

## Why Raw Parsing Was Needed

The current Unity build uses metadata version `39`. The available `Cpp2IL` path in local `AssetsTools.NET` tooling does not support that version cleanly enough for direct MonoBehaviour deserialization. The reliable fallback was:

- recover declaration-order field names from [`global-metadata.dat`](C:\Users\Shadow\Desktop\CiFi\_cifi_apk\global-metadata.dat)
- locate the owning MonoBehaviour byte range in [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
- align named fields to the raw byte stream
- promote successful alignments into repeatable parser scripts

## Owner Map

### Token Bank

- Scene/UI strings and prefab anchors are in [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
- Proven owner: `TokenShop`
- Parser: [`scripts/token_shop_parse.py`](C:\Users\Shadow\Desktop\CiFi\scripts\token_shop_parse.py)
- Outputs:
  - [`docs/token-shop-values.md`](C:\Users\Shadow\Desktop\CiFi\docs\token-shop-values.md)
  - [`data/token-shop-values.json`](C:\Users\Shadow\Desktop\CiFi\data\token-shop-values.json)

### Chrystos Emporium

- Scene/UI shell names include `ChrystosEmperium.Shop`, but the mechanics owner is `MultiverseMarket` on GameObject `Inscryptions`
- Proven owner byte start: `33216256` in [`_unity_joined/level0`](C:\Users\Shadow\Desktop\CiFi\_unity_joined\level0)
- Parser: [`scripts/multiverse_market_parse.py`](C:\Users\Shadow\Desktop\CiFi\scripts\multiverse_market_parse.py)
- Outputs:
  - [`docs/multiverse-market-values.md`](C:\Users\Shadow\Desktop\CiFi\docs\multiverse-market-values.md)
  - [`data/multiverse-market-values.json`](C:\Users\Shadow\Desktop\CiFi\data\multiverse-market-values.json)

## Current Findings

### TokenShop

`TokenShop` is fully validated as a serialized named-constant owner for token mechanics. It exposes grounded fields like `StartCost`, `AdditiveCost`, `Bonus`, `MaxLevel`, `FillMaxLevel`, and late-tier `ATU` values. This is the reference pattern for future system work.

### MultiverseMarket

`MultiverseMarket` metadata exposes:

- `IS1StartCost` through `IS110StartCost`
- `IS1CostExponent` through `IS110CostExponent`
- `IS1MaxLevel` through `IS110MaxLevel`
- `FinalIS1Cost` through `FinalIS110Cost`
- `FinalIS1Bonus` through `FinalIS110Bonus`

The currently validated serialized late block yields 22 structurally valid rows before the layout changes again. Those rows are not stored in inscription-ID order, which strongly suggests this block is a display/order list rather than a plain `IS50..IS71` array. It already yields direct `Bonus`, `StartCost`, and `CostExponent` values. A second parser is still needed for the remaining layout.

## Resume Path

If resuming on another machine:

1. clone the repo with Git LFS enabled
2. confirm the large files under `_cifi_apk`, `_cifi_apk_merged`, `_unity_joined`, and `tools` were restored
3. run:
   - `python scripts/token_shop_parse.py`
   - `python scripts/multiverse_market_parse.py`
4. inspect the grounded outputs in `docs/` and `data/`
5. continue by targeting the next unresolved owner object, not by returning to broad string scraping

## Portability Notes

- `scripts/uabea_probe.ps1` resolves the repo root from its own path and is clone-location agnostic.
- `scripts/token_shop_parse.py` and `scripts/multiverse_market_parse.py` also resolve the repo root from their own path and are clone-location agnostic.

## Rework Guidance

The project can now be reworked around owner-based extraction rather than screenshot inference:

- use scene strings only to find the system anchor
- use metadata to find the actual logic owner and field families
- persist grounded outputs as small parser scripts plus checked-in JSON/markdown summaries
- keep `state.playerProfile` and recommendation logic strictly downstream from verified extracted mechanics

## Integration readiness gate

Owner recovery alone is not enough to wire a system into the app.

Before app integration, confirm from the available assets and docs:

1. the in-game system identity
2. the concrete owner object
3. the player-owned inputs needed for recommendations
4. the currency or budget lane the system actually spends
5. whether the visible labels are grounded in-game labels or only serialized ids

Current status:

- `TokenShop`
  - verified: real owner, serialized cost fields, bonus fields, and level-cap fields
  - not yet verified enough for app planning: full player-owned current-level inputs and final remap from serialized field ids to player-facing labels
- `MultiverseMarket`
  - verified: real owner, validated inscription rows, direct serialized constants for part of the system, an Emporium spend-lane shell labeled around `Inscryptions Done`, and a narrowed persistence search toward `PlayerProfileData`
  - not yet verified enough for app planning: complete row coverage, player-owned current-level inputs, and the exact saved-state owner behind the `Inscryptions Done` balance

If those gaps remain open, keep the system in extraction and verification docs rather than recommendation UI.

## Known Limits

- Full save/export decoding is still unresolved.
- `MultiverseMarket` is only partially decoded; the post-validated late block still needs a second-pass parser.
- Community naming should not be substituted for in-game names unless clearly labeled as external.
