# CIFI Unity Recon

This document records extractable Unity-side signals from the LDPlayer install of CIFI.

Scope:
- Grounded names and save-related symbols from `global-metadata.dat`
- Extracted file locations from the emulator
- Manual raw-report helpers such as `scripts/unity/unity_extract_report.py`, `scripts/unity/unity_textasset_dump.py`, and `scripts/unity/unity_targeted_string_report.py` when DB-backed/system-unit surfaces do not answer the question directly

Screenshot and emulator-capture policy:
- ADB or LDPlayer screenshots are validation-only surfaces.
- Use them to test current UI rendering, compare wording, check row ordering, and calibrate presentation styling.
- Do not use captured screenshots as grounding sources for canonical row identity, formulas, ownership, or mechanic truth.
- Grounding must still come from committed extraction outputs, DB-backed trace/materializer artifacts, or other explicit in-game asset/native evidence.

DB-first grounding policy:
- For active app behavior, row wiring, row titles, formulas, and display-value modeling, prefer DB-backed materialized views, target bundles, subject-state views, and system-unit views first.
- Do not ground live app behavior from stored fixed JSON snapshots under `data/` when the same lane already exists in the DB-backed reconstruction path.
- Treat committed JSON exports as fallback, distribution, debug, or historical comparison surfaces only unless the DB-backed lane is absent.

Current status:
- The game exposes external files at `/storage/emulated/0/Android/data/com.OctocubeGamesCompany.CIFI/files`
- The main exposed save/export artifacts are `CifiBackup.text` and `DATA.text`
- Both decode from base64 into binary payloads, but they are not plaintext and do not match each other byte-for-byte
- IL2CPP metadata exposes save and gameplay symbols that are directly useful for grounding optimiser imports

Findings from the first APK extract pass:
- Save/cloud code paths are explicit in metadata:
  - `Assets\Scripts\Data&Saving\Nakama\Backups.cs`
  - `Assets\Scripts\Data&Saving\Nakama\Cloud.cs`
  - `Assets\Scripts\Data&Saving\Nakama\PlayerProfile\PlayerProfileData.cs`
  - symbols including `BackupSave`, `ProcessBackup`, `CloudSavePlayerProfile`, `RecoverSave`, `ClickLoadByDeSerialization`
- The likely persistence stack is:
  - CodeStage Anti-Cheat `ObscuredFilePrefs` / `ObscuredPrefs`
  - Odin serialization
  - binary and JSON serializers
- The save/export blobs appear to be real game-state artifacts, but wrapped or encrypted:
  - `CifiBackup.bin`
  - `DATA_main.bin`
  - both are 149680 bytes
  - both differ from byte 0 onward, which is consistent with per-save wrapping or different snapshot content
- Unity asset splits expose grounded UI and content names that are useful for import schemas and labels:
  - shard milestone labels such as `ShardMilestoneBonus1`
  - token and diamond shop/present labels
  - loop reset and loop modifier labels
  - loadout and player profile labels
  - mission panel and reward labels
  - upgrade prefab names such as `NewDiamondUPGPrefab.*`, `NewTokenUPGPrefab.*`, `ChrystosEmporiumUpgrade*`, `BorgeUpgrade*`
- Metadata also exposes gameplay symbols that are likely useful for optimiser data modeling:
  - `LastSavedShardMilestones`
  - `LastSaveLoopMods`
  - `TimeOfSave`
  - `LastSavedPlayerLevel`
  - `GetMilestoneDiamondValue`
  - `GetMilestoneTokenValue`
  - `FinalTier1Tokens` through `FinalTier7Tokens`
  - `FinalTier1Diamonds` through `FinalTier7Diamonds`
  - `FinalShardBonus`
  - `DiamondUltimaBonus`

MultiverseMarket-specific save-side narrowing from repo-local metadata:

- `Assets\Scripts\Data&Saving\Nakama\PlayerProfile\PlayerProfileData.cs`
- `FillPlayerProfileData`
- `GetPlayerProfileData`
- `CloudSavePlayerProfile`
- `InscryptionsDone`
- `IS1Level`
- `IS50Level`
- `IS51Level`
- `IS64Level`
- `IS73Level`
- `IS110Level`
- `EsotericR1Trades` through `EsotericR8Trades`
- `NecrumR1Trades` through `NecrumR9Trades`
- `Mech1Unlocked`, `Mech1Units`, `Mech1Upg1Level`, `Mech1Upg2Level`, `Mech1MissionsProgress`, `Mech1MissionsCompleted`
- `AchievementInscryptionsReward`
- `<FinalISShardsBonus>k__BackingField`

Current conclusion:

- the Emporium owner is still `MultiverseMarket`
- the `Inscryptions Done` purchase lane is grounded from the scene/UI side
- the saved-state search is now better narrowed toward the broader player-profile persistence family
- exact typed recovery now also confirms `SaveData` as the declaring save model for the checked contiguous `IS1Level` through `IS110Level` / trade-counter / early `Mech*` cluster, while `InscryptionsDone` is split out as an exact dual declaration on `SaveData` and `PlayerProfileData` and the typed `Market` wrapper itself still needs stronger recovery
- the surrounding field run now looks like a broader progression-state block rather than an isolated achievement or reward symbol family
- `AchievementInscryptionsReward` and `FinalIS*` symbols remain effect/reward clues rather than recovered saved-balance fields

Generated artifacts:
- `scripts/unity/unity_extract_report.py` (manual research helper only)
- `scripts/unity/unity_textasset_dump.py` (manual research helper only)
- `scripts/unity/unity_targeted_string_report.py` (manual research helper only)
- historical metadata-neighborhood probing is now archived; active multiverse metadata neighborhood extraction is DB/exporter-owned
- `docs/unity/unity-extract-report.md`
- `docs/systems/spend/multiverse-market-metadata-neighborhood.md`
- `data/archive/unity-apk-extract-report.json`
- `data/archive/multiverse-market-metadata-neighborhood.json`
- `data/unity-textassets-manifest.json`
- `data/unity-iap-summary.json`

Current owner boundary:

- DB-backed/system-unit derivations are the active owner path for token-shop, multiverse, shard, and trace runtime work.
- Archived raw reports remain useful for manual provenance checks, but they are not active runtime or export owners.

Direct mechanics recovered so far:
- The Unity `TextAsset` catalog `IAPProductCatalog` contains first-party store configuration with concrete pack effects and amounts.
- Examples:
  - `com.octocubegames.cifi.diamondssmallpack`: `600 Instant Diamonds`
  - `com.octocubegames.cifi.diamondslargepack`: `1300 Instant Diamonds`
  - `com.octocubegames.cifi.diamondshugepackage`: `2800 Instant Diamonds`
  - `com.octocubegames.cifi.diamondsmassivepackage`: `5000 Instant Diamonds`
  - `com.octocubegames.cifi.generatorpackage`: doubles all generator output
  - `com.octocubegames.cifi.looppackage`: doubles MP gained per batch
  - `com.octocubegames.cifi.explorerpackage`: doubles shard and research gains
  - `com.octocubegames.cifi.collector`: increases mission mats and daily tokenium cap
  - `com.octocubegames.cifi.supporter`: tons of diamonds and double cell gains

Current blocker:
- Exact per-upgrade cost tables and formulas are still not extracted.
- The asset files load, but IL2CPP custom MonoBehaviour decoding is blocked because `TypeTreeGeneratorAPI` fails to initialize against this build's `libil2cpp.so`.
- Without that type tree, most game-defined ScriptableObjects and MonoBehaviours cannot be deserialized into field/value tables yet.

Recommended use for MVP:
- Use the metadata and UI strings to ground manual import labels and internal field names.
- Do not assume the save blobs are safely parseable yet.
- If deeper extraction is needed, the next step is targeted Unity asset parsing or an IL2CPP-oriented decoder for the `ObscuredFilePrefs` save path.

