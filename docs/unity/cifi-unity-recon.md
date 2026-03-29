# CIFI Unity Recon

This document records extractable Unity-side signals from the LDPlayer install of CIFI.

Scope:
- Grounded names and save-related symbols from `global-metadata.dat`
- Extracted file locations from the emulator
- Repeatable probe outputs from `scripts/unity/unity_apk_probe.py`

Current status:
- The game exposes external files at `/storage/emulated/0/Android/data/com.OctocubeGamesCompany.CIFI/files`
- The main exposed save/export artifacts are `CifiBackup.text` and `DATA.text`
- Both decode from base64 into binary payloads, but they are not plaintext and do not match each other byte-for-byte
- IL2CPP metadata exposes save and gameplay symbols that are directly useful for grounding optimiser imports

Findings from the first APK probe:
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
- exact metadata field names now exist for `InscryptionsDone` and nearby `IS*Level`, but the declaring save model still needs confirmation
- the surrounding field run now looks like a broader progression-state block rather than an isolated achievement or reward symbol family
- `AchievementInscryptionsReward` and `FinalIS*` symbols remain effect/reward clues rather than recovered saved-balance fields

Generated artifacts:
- `scripts/unity/unity_apk_probe.py`
- `scripts/unity/unity_textasset_dump.py`
- `scripts/unity/metadata_neighborhood_probe.py`
- `docs/unity/unity-probe-report.md`
- `docs/systems/spend/multiverse-market-metadata-neighborhood.md`
- `data/unity-probe-report.json`
- `data/multiverse-market-metadata-neighborhood.json`
- `data/unity-textassets-manifest.json`
- `data/unity-iap-summary.json`

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

