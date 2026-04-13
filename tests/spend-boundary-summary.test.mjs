import test from "node:test";
import assert from "node:assert/strict";

import {
  formatNumericRanges,
  getMultiverseMarketMarketMemberBoundarySummary,
  getTokenBankStateSummary,
  getTokenShopCostLaneSummary
} from "../spend-boundary-summary.js";

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
