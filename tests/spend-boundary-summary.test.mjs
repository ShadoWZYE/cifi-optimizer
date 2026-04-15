import test from "node:test";
import assert from "node:assert/strict";

import {
  formatNumericRanges,
  getImportedMultiverseMarketPreview,
  getMultiverseMarketMarketMemberBoundarySummary,
  getTokeniumNamingSummary,
  getTokenBankStateSummary,
  getTokenShopCoverageSummary,
  getTokenShopCostLaneSummary
} from "../support/spend-boundary-summary.js";

test("formatNumericRanges groups sorted unique values into joined ranges", () => {
  assert.equal(formatNumericRanges([7, 4, 5, 9, 7, 6, 11]), "4-7 and 9 and 11");
});

test("getTokenShopCostLaneSummary preserves the spend-lane split labels", () => {
  assert.deepEqual(
    getTokenShopCostLaneSummary({
      tokenSpendGroups: ["TokenBoost"],
      dailyTokeniumModifierGroups: ["TokenDailiesT2", "TokenDailiesT3"],
      diamondGroups: ["DiamondBoost"],
      playerFacingClues: ["CostBox-Tokens", "CostBox-Tokenium", "Mission Materials Booster"]
    }),
    {
      hasLaneSplit: true,
      keepsDailyTokeniumSeparate: true,
      tokenLaneLabel: "TokenBoost",
      diamondLaneLabel: "DiamondBoost",
      dailyLaneLabel: "TokenDailiesT2",
      tokensShellLabel: "CostBox-Tokens",
      tokeniumShellLabel: "CostBox-Tokenium"
    }
  );
});

test("getTokenBankStateSummary keeps the cloud-save boundary separate from controller clues", () => {
  assert.deepEqual(
    getTokenBankStateSummary({
      tokenShopMethods: ["ClaimBankedTokens", "get_TokenBankCap"],
      displayOrHandlerClues: ["BigStatisticPrefab.TokenBankCap", "SetLM244BonusText"],
      cloudSavePlayerProfileBoundary: {
        scriptName: "CloudSavePlayerProfile",
        typedTargetFound: false,
        metadataAnchorFound: true,
        metadataShellMethods: ["GetCurrentSaveFileInfo", "GetPlayerProfileInfo"],
        metadataStateMachines: ["<CloudSavePlayerProfile>d__24"]
      }
    }),
    {
      hasControllerSplit: true,
      hasCloudSaveShellBoundary: true,
      claimMethod: "ClaimBankedTokens",
      capMethod: "get_TokenBankCap",
      displayShell: "BigStatisticPrefab.TokenBankCap",
      loopHandler: "TextHandlerLoopMods",
      loopHook: "SetLM244BonusText",
      cloudSaveShell: "CloudSavePlayerProfile",
      cloudSaveInfoRoutine: "GetCurrentSaveFileInfo",
      cloudSaveProfileRoutine: "GetPlayerProfileInfo",
      cloudSaveStateMachine: "<CloudSavePlayerProfile>d__24"
    }
  );
});

test("token spend naming and coverage summaries preserve the checked lane anchors", () => {
  assert.deepEqual(
    getTokeniumNamingSummary({
      assetNames: {
        resourceIcons: ["Resource_Tokenium"],
        academySprites: ["Aca.Tokenium553"]
      },
      level0Shells: ["CostBox-Tokens", "CostBox-Tokenium"]
    }),
    {
      hasNamingClues: true,
      resourceLabel: "Resource_Tokenium",
      academyLabel: "Aca.Tokenium553",
      tokenShellLabel: "CostBox-Tokens",
      tokeniumShellLabel: "CostBox-Tokenium"
    }
  );

  assert.deepEqual(
    getTokenShopCoverageSummary({
      numeric_table: {
        TokenBoost: { group: "T1" },
        DiamondBoost: { group: "T1" },
        TokenDailiesT2: { group: "T2" }
      },
      fields: [
        { group: "controller", field: "BankFill" },
        { group: "controller", field: "TokenBankDescriptionText" }
      ]
    }),
    {
      hasCoverage: true,
      numericGroupCount: 3,
      hasNamedLanes: true,
      namedLaneLabel: "TokenBoost, DiamondBoost, TokenDailiesT2",
      tierLabel: "T1, T2",
      hasControllerAnchors: true
    }
  );
});

test("imported multiverse market preview keeps the compatibility-only summary shape", () => {
  const preview = getImportedMultiverseMarketPreview(
    {
      importedState: {
        IS71Level: 3,
        IS72Level: 4,
        EsotericR1Trades: 9,
        Mech1Unlocked: true
      }
    },
    {},
    { overlapIds: [71, 72] },
    {
      formatBoundaryValue(value) {
        return String(value);
      },
      formatShardNumber(value) {
        return String(value);
      },
      isBoundaryValuePresent(value) {
        return value !== null && value !== undefined && value !== "";
      }
    }
  );

  assert.equal(preview.hasImportedCompatibilityPreview, true);
  assert.equal(preview.importedRangeLabel, "71-72");
  assert.equal(preview.overlapRangeLabel, "71-72");
  assert.equal(preview.tradeCounterSampleLine, "EsotericR1Trades 9");
  assert.equal(preview.missingOverlapLabel, "none");
  assert.equal(preview.rowSummaryShape.shapeId, "multiverse-market-row-local-text-summary");
});

test("imported multiverse market preview rejects unlabeled raw compatibility payloads", () => {
  const preview = getImportedMultiverseMarketPreview(
    {
      IS71Level: 3,
      EsotericR1Trades: 9
    },
    {},
    { overlapIds: [71] },
    {
      formatBoundaryValue(value) {
        return String(value);
      },
      formatShardNumber(value) {
        return String(value);
      },
      isBoundaryValuePresent(value) {
        return value !== null && value !== undefined && value !== "";
      }
    }
  );

  assert.equal(preview.hasImportedCompatibilityPreview, false);
  assert.equal(preview.importedSpanRowCount, 0);
  assert.equal(preview.importedTradeCounterCount, 0);
  assert.equal(preview.importedEarlyMechCount, 0);
});

test("getMultiverseMarketMarketMemberBoundarySummary keeps the PlayerProfile host narrowing", () => {
  const summary = getMultiverseMarketMarketMemberBoundarySummary({
    playerProfileAccessorClues: [
      "get_Market",
      "get_BM",
      "get_ZN",
      "get_TU",
      "get_Relics",
      "get_CellData",
      "get_ModPointData",
      "get_ShardData",
      "get_ResearchPointData",
      "get_AcademyPointData"
    ],
    playerProfileMemberShellClues: [
      "Market",
      "Relics",
      "CellData",
      "ModPointData",
      "ShardData",
      "ResearchPointData",
      "AcademyPointData"
    ],
    playerProfileHandlerBridgeClues: [
      "PlayerProfileHandler",
      "playerData",
      "GetPlayerProfileData",
      "FillPlayerProfileData",
      "ConvertSaveDataToProfileData"
    ],
    directMemberHandoffClues: [
      "get_Market",
      "Market",
      "GetPlayerProfileData",
      "FillPlayerProfileData",
      "<FillPlayerProfileData>d__45"
    ],
    typedSiblingContrastClues: ["PlayerProfileData|GemData", "PlayerProfileData|GemNodeCombo"],
    progressionPayloadFieldClues: [
      "InscryptionsDone",
      "EsotericR1Trades",
      "NecrumR1Trades",
      "Mech1Unlocked"
    ],
    cloudSaveBridgeClues: ["CloudSavePlayerProfile", "GetPlayerProfileInfo", "CloudLoad"],
    missingDirectTypeMapClues: [
      "PlayerProfileData|Market",
      "PlayerProfileData|Inscryption",
      "PlayerProfileData|MultiverseMarket"
    ],
    negativeTypedDirectPlayerProfileProgressionChecks: [
      "PlayerProfileData.IS71Level",
      "PlayerProfileData.IS110Level",
      "PlayerProfileData.EsotericR1Trades",
      "PlayerProfileData.NecrumR1Trades",
      "PlayerProfileData.Mech1Unlocked",
      "PlayerProfileData.Mech1MissionsCompleted"
    ],
    negativeTypedDirectMemberChecks: [
      "PlayerProfileHandler.Market",
      "PlayerProfileData.Market",
      "PlayerProfileData.MultiverseMarket",
      "MultiverseMarket.InscryptionsDone",
      "MultiverseMarket.IS71Level",
      "MultiverseMarket.IS110Level",
      "MultiverseMarket.EsotericR1Trades",
      "MultiverseMarket.NecrumR1Trades",
      "MultiverseMarket.Mech1Unlocked",
      "MultiverseMarket.Mech1MissionsCompleted"
    ],
    negativeTypedSaveDataMarketChecks: ["SaveData.Market", "SaveData.MultiverseMarket"],
    typedBridgeRecovery: {
      bridgeOwner: "PlayerProfileHandler",
      bridgeAccessor: "get_Market",
      bridgeReturnType: "MultiverseMarket"
    },
    typedHandlerFieldRecovery: {
      fieldOwner: "PlayerProfileHandler",
      fieldName: "saveInfoCache",
      fieldType: "PlayerProfileData"
    },
    typedPlayerProfileFieldTableRecovery: {
      fieldOwner: "PlayerProfileData",
      fieldCount: 89,
      methodCount: 1
    },
    typedSaveDataFieldTableRecovery: {
      fieldOwner: "SaveData",
      fieldCount: 4461,
      methodCount: 1
    },
    typedSaveDataProgressionOwnerSamples: [
      "IS71Level",
      "IS110Level",
      "InscryptionsDone",
      "EsotericR1Trades",
      "NecrumR1Trades",
      "Mech1Unlocked",
      "Mech1MissionsCompleted"
    ]
  });

  assert.equal(summary.hasBoundary, true);
  assert.equal(summary.hasHandlerBridge, true);
  assert.equal(summary.hasExactSaveDataProgressionOwner, true);
  assert.equal(summary.favorsPlayerProfileMemberHost, true);
  assert.equal(summary.canonicalHostLabel, "PlayerProfileHandler get_Market accessor bridge");
  assert.equal(summary.exactSaveOwnerLabel, "SaveData");
});
