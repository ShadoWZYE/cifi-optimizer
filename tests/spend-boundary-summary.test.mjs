import test from "node:test";
import assert from "node:assert/strict";

import {
  formatNumericRanges,
  getDailyTokeniumLaneSummary,
  getImportedMultiverseMarketPreview,
  getMultiverseMarketActionShellSummary,
  getMultiverseMarketBroadRowRemapSummary,
  getMultiverseMarketCanonicalImportSummary,
  getMultiverseMarketMarketMemberBoundarySummary,
  getMultiverseMarketMetadataSummary,
  getMultiverseMarketOwnerFamilySummary,
  getMultiverseMarketPrefabRemapBoundarySummary,
  getMultiverseMarketRangeBoundarySummary,
  getMultiverseMarketRowTextCoverageSummary,
  getMultiverseMarketSaveBoundarySummary,
  getMultiverseMarketTypedOwnerSummary,
  getSpendActionLaneSummary,
  getTokenBankControllerShellSummary,
  getTokenBankFormulaBoundarySummary,
  getTokeniumNamingSummary,
  getTokenBankStateSummary,
  getTokenShopCoverageSummary,
  getTokenShopCostLaneSummary,
  getTokenShopOwnerShellSummary,
  getTokenShopSaveBoundarySummary
} from "../support/spend-boundary-summary.js";
import { buildSpendSystemView } from "../support/system-unit-projections.js";

test("formatNumericRanges groups sorted unique values into joined ranges", () => {
  assert.equal(formatNumericRanges([7, 4, 5, 9, 7, 6, 11]), "4-7 and 9 and 11");
});

test("getTokenShopCostLaneSummary preserves the spend-lane split labels", () => {
  assert.deepEqual(
    getTokenShopCostLaneSummary({
      tokenSpendGroups: ["TokenBoost"],
      dailyTokeniumModifierGroups: ["TokenDailiesT2", "TokenDailiesT3"],
      diamondGroups: ["DiamondBoost"],
      tracePresentation: {
        costShell: "CostBox",
        costRenderNode: "CostText",
        descriptionRenderNode: "DescText"
      }
    }),
    {
      hasLaneSplit: true,
      coverageSource: "legacy-cost-lanes",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      keepsDailyTokeniumSeparate: true,
      tokenLaneLabel: "TokenBoost",
      diamondLaneLabel: "DiamondBoost",
      dailyLaneLabel: "TokenDailiesT2",
      costShellLabel: "CostBox",
      costRenderLabel: "CostText",
      descriptionRenderLabel: "DescText"
    }
  );
});

test("getTokenShopCostLaneSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenShopCostLaneSummary({
      subjectMetadata: {
        "token-shop-atu4-mod": {
          subjectId: "row:ATU4Button",
          subjectKind: "row-local",
          groundedFields: {
            displayUpdateHooks: ["SetCostRelatedAttributes"]
          },
          blockedEdges: ["exact-display-update-path"],
          blockedInputReason: "assessment:baseline-gap",
          nextSeam: { id: "exact-display-update-path" }
        },
        "token-shop-daily-tokenium-family": {
          subjectId: "range:token-shop:ATU14Button-ATU19Button",
          subjectKind: "range-family",
          knownEdges: ["exact-display-update-path", "row-family-effect-hook"],
          supportSummary: {
            supportSurfaceLabels: ["Daily Tokenium title and text surfaces"]
          }
        }
      }
    }),
    {
      hasLaneSplit: true,
      coverageSource: "db-subject-metadata",
      keepsDailyTokeniumSeparate: true,
      tokenLaneLabel: "row:ATU4Button",
      diamondLaneLabel: "row-local",
      dailyLaneLabel: "range:token-shop:ATU14Button-ATU19Button",
      costShellLabel: "SetCostRelatedAttributes",
      costRenderLabel: "Daily Tokenium title and text surfaces",
      descriptionRenderLabel: "exact-display-update-path",
      rowLocalSubjectId: "row:ATU4Button",
      rangeFamilySubjectId: "range:token-shop:ATU14Button-ATU19Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      rowLocalBlockedEdges: ["exact-display-update-path"],
      rangeFamilyKnownEdges: ["exact-display-update-path", "row-family-effect-hook"],
      blockedInputReason: "assessment:baseline-gap"
    }
  );
});

test("getSpendActionLaneSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getSpendActionLaneSummary({
      subjectMetadata: {
        "token-shop-atu7-mk3-bridge": {
          subjectId: "row:ATU7Button",
          subjectKind: "row-local",
          groundedFields: {
            actionMethods: ["BuyMK3TokenBoost"]
          },
          knownEdges: ["exact-shell-to-action-hook"]
        },
        "token-shop-daily-tokenium-family": {
          subjectId: "range:token-shop:ATU14Button-ATU19Button",
          subjectKind: "range-family",
          knownEdges: ["row-family-action-hook"],
          nonblockingEdges: ["exact-shell-to-action-hook"],
          nextSeam: { id: "none" }
        }
      }
    }),
    {
      hasActionSplit: true,
      coverageSource: "db-subject-metadata",
      keepsDailyDirectHooksUnrecovered: true,
      tokenHook: "row:ATU7Button",
      diamondHook: "row-local",
      loopModifierHook: "BuyMK3TokenBoost",
      premiumModifierHook: "range:token-shop:ATU14Button-ATU19Button",
      dailyHookT2: "exact-shell-to-action-hook",
      dailyHookT3: "none",
      rowLocalSubjectId: "row:ATU7Button",
      rangeFamilySubjectId: "range:token-shop:ATU14Button-ATU19Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      rowLocalKnownEdges: ["exact-shell-to-action-hook"],
      rangeFamilyKnownEdges: ["row-family-action-hook"],
      rangeFamilyNonblockingEdges: ["exact-shell-to-action-hook"],
      blockedInputReason: null
    }
  );
});

test("getDailyTokeniumLaneSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getDailyTokeniumLaneSummary({
      subjectMetadata: {
        "token-shop-atu4-mod": {
          subjectId: "row:ATU4Button",
          subjectKind: "row-local",
          groundedFields: {
            dailyTokeniumLane: {
              ownerFamilyLabel: "SpaceAcademy",
              academyController: "SpaceAcademyMain",
              textHandler: "TextHandlerSpaceAcademy",
              missionFamilyLabel: "FarmMissions",
              loopHook: "SetLM244BonusText",
              purchaseHook: "BuyLM244",
              finalBonusHook: "FinalDailyTokenBonus",
              purchaseOwner: "BuyCollectorDevice",
              premiumCapBonus: "CollectorCapBonus",
              premiumMatsBonus: "CollectorMatsBonus",
              progressString: "0 / 2000 Daily Tokenium (from blue farm missions)",
              capDescriptionString:
                "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
              collectorPackDescriptionString:
                "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
            }
          },
          blockedInputReasons: {
            dailyTokeniumLane: null
          }
        },
        "token-shop-daily-tokenium-family": {
          subjectId: "range:token-shop:ATU14Button-ATU19Button",
          subjectKind: "range-family",
          groundedFields: {
            dailyTokeniumLane: {
              ownerFamilyLabel: "SpaceAcademy",
              academyController: "SpaceAcademyMain",
              textHandler: "TextHandlerSpaceAcademy",
              missionFamilyLabel: "FarmMissions",
              loopHook: "SetLM244BonusText",
              purchaseHook: "BuyLM244",
              finalBonusHook: "FinalDailyTokenBonus",
              purchaseOwner: "BuyCollectorDevice",
              premiumCapBonus: "CollectorCapBonus",
              premiumMatsBonus: "CollectorMatsBonus",
              progressString: "0 / 2000 Daily Tokenium (from blue farm missions)",
              capDescriptionString:
                "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
              collectorPackDescriptionString:
                "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
            }
          },
          blockedInputReasons: {
            dailyTokeniumLane: null
          }
        }
      }
    }),
    {
      hasOwnerFamilyClues: true,
      hasModifierBoundary: true,
      hasPlayerFacingBoundary: true,
      coverageSource: "db-subject-metadata",
      ownerFamilyLabel: "SpaceAcademy",
      missionFamilyLabel: "FarmMissions",
      academyController: "SpaceAcademyMain",
      textHandler: "TextHandlerSpaceAcademy",
      loopHook: "SetLM244BonusText",
      purchaseHook: "BuyLM244",
      finalBonusHook: "FinalDailyTokenBonus",
      purchaseOwner: "BuyCollectorDevice",
      premiumCapBonus: "CollectorCapBonus",
      premiumMatsBonus: "CollectorMatsBonus",
      progressString: "0 / 2000 Daily Tokenium (from blue farm missions)",
      capDescriptionString:
        "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
      collectorPackDescriptionString:
        "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu",
      premiumPack: "COLLECTERS PACK",
      rowLocalSubjectId: "row:ATU4Button",
      rangeFamilySubjectId: "range:token-shop:ATU14Button-ATU19Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      blockedInputReason: null
    }
  );
});

test("getTokenBankStateSummary keeps the cloud-save boundary separate from controller clues", () => {
  assert.deepEqual(
    getTokenBankStateSummary({
      tokenShopMethods: ["ClaimBankedTokens", "get_TokenBankCap"],
      displayOrHandlerClues: ["BigStatisticPrefab.TokenBankCap", "SetLM244BonusText"],
      exactSaveOwnerRecovery: {
        declaringType: "SaveData",
        storedAmountField: "BankedTokens"
      },
      genericTokeniumClaimableBoundary: {
        declaringType: "SaveData",
        field: "ClaimableTokenium"
      },
      playerProfilePersistenceBoundary: {
        bridgeOwner: "PlayerProfileHandler",
        bridgeMethod: "ConvertSaveDataToProfileData",
        bridgeReturnType: "PlayerProfileData",
        handlerField: "saveInfoCache"
      },
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
      hasExactStoredAmountOwner: true,
      hasGenericClaimableBoundary: true,
      hasPlayerProfileBridgeBoundary: true,
      hasCloudSaveShellBoundary: true,
      coverageSource: "legacy-token-bank-state",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      claimMethod: "ClaimBankedTokens",
      capMethod: "get_TokenBankCap",
      displayShell: "BigStatisticPrefab.TokenBankCap",
      loopHandler: "TextHandlerLoopMods",
      loopHook: "SetLM244BonusText",
      exactSaveOwnerType: "SaveData",
      storedAmountField: "BankedTokens",
      exactSaveOwnerLabel: "SaveData.BankedTokens",
      genericClaimableFieldOwner: "SaveData",
      genericClaimableField: "ClaimableTokenium",
      genericClaimableLabel: "SaveData.ClaimableTokenium",
      profileBridgeOwner: "PlayerProfileHandler",
      profileBridgeMethod: "ConvertSaveDataToProfileData",
      profileBridgeReturnType: "PlayerProfileData",
      profileCacheField: "saveInfoCache",
      profileBridgeLabel:
        "PlayerProfileHandler.saveInfoCache + ConvertSaveDataToProfileData(...) -> PlayerProfileData",
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
      coverageSource: "legacy-tokenium-naming",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      resourceLabel: "Resource_Tokenium",
      academyLabel: "Aca.Tokenium553",
      tokenShellLabel: "CostBox-Tokens",
      tokeniumShellLabel: "CostBox-Tokenium"
    }
  );

  assert.deepEqual(
    getTokeniumNamingSummary({
      subjectMetadata: {
        "token-shop-atu7-mk3-bridge": {
          subjectId: "row:ATU7Button",
          subjectKind: "row-local",
          groundedFields: {
            tokeniumNaming: {
              resourceLabel: "Resource_Tokenium",
              academyLabel: "Aca.Tokenium553",
              tokenShellLabel: "CostBox-Tokens",
              tokeniumShellLabel: "CostBox-Tokenium"
            }
          },
          blockedInputReasons: {
            tokeniumNaming: null
          }
        },
        "token-shop-daily-tokenium-family": {
          subjectId: "range:token-shop:ATU14Button-ATU19Button",
          subjectKind: "range-family",
          groundedFields: {
            tokeniumNaming: {
              resourceLabel: "Resource_Tokenium",
              academyLabel: "Aca.Tokenium553",
              tokenShellLabel: "CostBox-Tokens",
              tokeniumShellLabel: "CostBox-Tokenium"
            }
          },
          blockedInputReasons: {
            tokeniumNaming: null
          }
        }
      }
    }),
    {
      hasNamingClues: true,
      coverageSource: "db-subject-metadata",
      resourceLabel: "Resource_Tokenium",
      academyLabel: "Aca.Tokenium553",
      tokenShellLabel: "CostBox-Tokens",
      tokeniumShellLabel: "CostBox-Tokenium",
      rowLocalSubjectId: "row:ATU7Button",
      rangeFamilySubjectId: "range:token-shop:ATU14Button-ATU19Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      blockedInputReason: null
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
      coverageSource: "legacy-extract",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      numericGroupCount: 3,
      hasNamedLanes: true,
      namedLaneLabel: "TokenBoost, DiamondBoost, TokenDailiesT2",
      tierLabel: "T1, T2",
      hasControllerAnchors: true
    }
  );
});

test("contract-backed Daily Tokenium summary ignores conflicting legacy fallback clues", () => {
  const summary = getDailyTokeniumLaneSummary({
    subjectMetadata: {
      "token-shop-atu4-mod": {
        subjectId: "row:ATU4Button",
        subjectKind: "row-local",
        groundedFields: {
          dailyTokeniumLane: {
            ownerFamilyLabel: "SpaceAcademy",
            academyController: "SpaceAcademyMain",
            textHandler: "TextHandlerSpaceAcademy",
            missionFamilyLabel: "FarmMissions",
            loopHook: "SetLM244BonusText",
            purchaseHook: "BuyLM244",
            finalBonusHook: "FinalDailyTokenBonus",
            purchaseOwner: "BuyCollectorDevice",
            premiumCapBonus: "CollectorCapBonus",
            premiumMatsBonus: "CollectorMatsBonus",
            progressString: "0 / 2000 Daily Tokenium (from blue farm missions)",
            capDescriptionString:
              "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
            collectorPackDescriptionString:
              "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
          }
        },
        blockedInputReasons: {
          dailyTokeniumLane: null
        }
      },
      "token-shop-daily-tokenium-family": {
        subjectId: "range:token-shop:ATU14Button-ATU19Button",
        subjectKind: "range-family",
        groundedFields: {
          dailyTokeniumLane: {
            ownerFamilyLabel: "SpaceAcademy",
            academyController: "SpaceAcademyMain",
            textHandler: "TextHandlerSpaceAcademy",
            missionFamilyLabel: "FarmMissions",
            loopHook: "SetLM244BonusText",
            purchaseHook: "BuyLM244",
            finalBonusHook: "FinalDailyTokenBonus",
            purchaseOwner: "BuyCollectorDevice",
            premiumCapBonus: "CollectorCapBonus",
            premiumMatsBonus: "CollectorMatsBonus",
            progressString: "0 / 2000 Daily Tokenium (from blue farm missions)",
            capDescriptionString:
              "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
            collectorPackDescriptionString:
              "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
          }
        },
        blockedInputReasons: {
          dailyTokeniumLane: null
        }
      }
    },
    dailyTokenium: {
      laneClues: {
        ownerFamilyClues: [],
        modifierClues: [],
        premiumModifierClues: [],
        playerFacingStrings: []
      }
    }
  });

  assert.equal(summary.coverageSource, "db-subject-metadata");
  assert.equal(summary.purchaseHook, "BuyLM244");
  assert.equal(summary.ownerFamilyLabel, "SpaceAcademy");
});

test("contract-backed tokenium naming ignores conflicting legacy fallback clues", () => {
  const summary = getTokeniumNamingSummary({
    subjectMetadata: {
      "token-shop-atu7-mk3-bridge": {
        subjectId: "row:ATU7Button",
        subjectKind: "row-local",
        groundedFields: {
          tokeniumNaming: {
            resourceLabel: "Resource_Tokenium",
            academyLabel: "Aca.Tokenium553",
            tokenShellLabel: "CostBox-Tokens",
            tokeniumShellLabel: "CostBox-Tokenium"
          }
        },
        blockedInputReasons: {
          tokeniumNaming: null
        }
      }
    },
    assetNames: {
      resourceIcons: ["Wrong_Resource"],
      academySprites: ["Wrong_Academy"]
    },
    level0Shells: ["Wrong-Shell"]
  });

  assert.equal(summary.coverageSource, "db-subject-metadata");
  assert.equal(summary.resourceLabel, "Resource_Tokenium");
  assert.equal(summary.academyLabel, "Aca.Tokenium553");
});

test("generic Token Shop lane summaries do not credit metadata when generic mechanics already clear the lane", () => {
  const summary = getTokenShopCostLaneSummary({
    genericMechanics: {
      "token-shop-atu4-mod": {
        entities: [
          {
            entityKind: "row-local",
            entityId: "row:ATU4Button",
            payload: { subjectId: "row:ATU4Button" }
          }
        ],
        facts: [
          {
            factKind: "display-update-hook",
            factValue: "SetCostRelatedAttributes"
          }
        ],
        gaps: []
      },
      "token-shop-daily-tokenium-family": {
        entities: [
          {
            entityKind: "range-family",
            entityId: "range:token-shop:ATU14Button-ATU19Button",
            payload: { subjectId: "range:token-shop:ATU14Button-ATU19Button" }
          }
        ],
        facts: [
          {
            factKind: "support-surface-label",
            factValue: "Daily Tokenium title and text surfaces"
          }
        ],
        gaps: [
          {
            gapKind: "missing-edge",
            payload: { edgeType: "exact-display-update-path" }
          },
          {
            gapKind: "next-seam",
            payload: { seamId: "exact-display-update-path" }
          }
        ]
      }
    },
    subjectMetadata: {
      "token-shop-atu4-mod": {
        subjectId: "row:ATU4Button",
        subjectKind: "row-local"
      }
    }
  });

  assert.equal(summary.coverageSource, "generic-mechanics");
});

test("getTokenShopCoverageSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenShopCoverageSummary({
      subjectMetadata: {
        "token-shop-atu4-mod": {
          subjectId: "row:ATU4Button",
          subjectKind: "row-local",
          groundedFields: {
            actionMethods: ["BuyModBoost"]
          },
          knownEdges: ["exact-shell-to-prefab"],
          blockedEdges: ["exact-display-update-path"]
        },
        "token-shop-late-atu-family": {
          subjectId: "range:token-shop:ATU24Button-ATU28Button",
          subjectKind: "range-family",
          groundedFields: {},
          knownEdges: ["row-family-action-hook"],
          blockedEdges: ["exact-shell-to-title"]
        }
      }
    }),
    {
      hasCoverage: true,
      coverageSource: "db-subject-metadata",
      numericGroupCount: 2,
      hasNamedLanes: true,
      namedLaneLabel: "row:ATU4Button, range:token-shop:ATU24Button-ATU28Button",
      tierLabel: "1 row-local and 1 range-family DB-backed subjects",
      hasControllerAnchors: true,
      subjectCount: 2,
      rowLocalCount: 1,
      rangeFamilyCount: 1,
      blockedCount: 2,
      subjectLabels: ["row:ATU4Button", "range:token-shop:ATU24Button-ATU28Button"],
      genericScopeCount: 0,
      unresolvedRowFieldCount: 0
    }
  );
});

test("getTokenShopCoverageSummary prefers generic mechanics over metadata in active coverage labels", () => {
  const summary = getTokenShopCoverageSummary({
    genericMechanics: {
      "token-shop-atu4-mod": {
        entities: [
          {
            entityKind: "row-local",
            entityId: "row:ATU4Button",
            payload: { subjectId: "row:ATU4Button" }
          }
        ],
        facts: [
          {
            factKind: "action-method",
            factValue: "BuyModBoost"
          }
        ],
        gaps: [
          {
            gapKind: "missing-edge",
            payload: { edgeType: "exact-display-update-path" }
          }
        ]
      },
      "token-shop-late-atu-family": {
        entities: [
          {
            entityKind: "range-family",
            entityId: "range:token-shop:ATU24Button-ATU28Button",
            payload: { subjectId: "range:token-shop:ATU24Button-ATU28Button" }
          }
        ],
        facts: [],
        gaps: []
      }
    },
    subjectMetadata: {
      "token-shop-atu4-mod": {
        subjectId: "row:ATU4Button",
        subjectKind: "row-local",
        knownEdges: ["exact-shell-to-prefab"]
      }
    }
  });

  assert.equal(summary.coverageSource, "generic-mechanics");
  assert.equal(summary.subjectCount, 2);
  assert.equal(summary.genericScopeCount, 2);
});

test("getTokenShopOwnerShellSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenShopOwnerShellSummary({
      subjectMetadata: {
        "token-shop-atu7-mk3-bridge": {
          subjectId: "row:ATU7Button",
          subjectKind: "row-local",
          groundedFields: {
            actionMethods: ["BuyMK3TokenBoost"]
          },
          knownEdges: ["exact-shell-to-action-hook"],
          nextSeam: { id: "exact-display-update-path" }
        },
        "token-shop-late-atu-family": {
          subjectId: "range:token-shop:ATU24Button-ATU28Button",
          subjectKind: "range-family",
          knownEdges: ["row-family-action-hook"],
          blockedEdges: ["exact-shell-to-title"]
        }
      }
    }),
    {
      hasOwnerShell: true,
      coverageSource: "db-subject-metadata",
      ownerAnchor: "row:ATU7Button",
      bankMethod: "BuyMK3TokenBoost",
      notificationHook: "exact-display-update-path",
      deviceHook: "range:token-shop:ATU24Button-ATU28Button",
      rowLocalSubjectId: "row:ATU7Button",
      rangeFamilySubjectId: "range:token-shop:ATU24Button-ATU28Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      rowLocalKnownEdges: ["exact-shell-to-action-hook"],
      rangeKnownEdges: ["row-family-action-hook"],
      rangeBlockedEdges: ["exact-shell-to-title"],
      blockedInputReason: null
    }
  );
});

test("getTokenShopOwnerShellSummary preserves legacy fallback when contract remains blocked", () => {
  assert.deepEqual(
    getTokenShopOwnerShellSummary({
      subjectMetadata: {
        "token-shop-atu7-mk3-bridge": {
          subjectId: "row:ATU7Button",
          subjectKind: "row-local",
          groundedFields: {
            actionMethods: ["BuyMK3TokenBoost"]
          },
          knownEdges: ["exact-shell-to-action-hook"],
          blockedInputReason: "reconstruction:missing-seam"
        }
      },
      ownerAnchors: ["TokenShop", "InitializeTokenShop"],
      tokenBankMethods: ["ClaimBankedTokens"],
      notificationHooks: ["CheckTokenClaimNotification"],
      adjacentDeviceHooks: ["BuyAutoTokenClicker"]
    }),
    {
      hasOwnerShell: true,
      coverageSource: "legacy-owner-shell",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      ownerAnchor: "TokenShop",
      bankMethod: "ClaimBankedTokens",
      notificationHook: "CheckTokenClaimNotification",
      deviceHook: "BuyAutoTokenClicker"
    }
  );
});

test("getTokenShopSaveBoundarySummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenShopSaveBoundarySummary({
      subjectMetadata: {
        "token-shop-atu4-mod": {
          subjectId: "row:ATU4Button",
          subjectKind: "row-local",
          blockedEdges: ["exact-display-update-path"],
          blockedInputReason: "assessment:baseline-gap"
        },
        "token-shop-late-atu-family": {
          subjectId: "range:token-shop:ATU24Button-ATU28Button",
          subjectKind: "range-family",
          blockedEdges: ["exact-shell-to-title"],
          blockedInputReason: "reconstruction:baseline-gap"
        }
      }
    }),
    {
      hasSeparationBoundary: true,
      coverageSource: "db-subject-metadata",
      ownerAnchor: "row:ATU4Button",
      saveAnchor: "range:token-shop:ATU24Button-ATU28Button",
      overlapLabel: "db-backed subject-state separation",
      rowLocalSubjectId: "row:ATU4Button",
      rangeFamilySubjectId: "range:token-shop:ATU24Button-ATU28Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      rowLocalBlockedEdges: ["exact-display-update-path"],
      rangeFamilyBlockedEdges: ["exact-shell-to-title"],
      blockedInputReason: "reconstruction:baseline-gap"
    }
  );
});

test("getTokenBankControllerShellSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenBankControllerShellSummary({
      subjectMetadata: {
        "token-shop-atu7-mk3-bridge": {
          subjectId: "row:ATU7Button",
          subjectKind: "row-local",
          groundedFields: {
            tokenBankController: {
              claimMethod: "ClaimBankedTokens",
              fillMethod: "SetBankFill",
              fillField: "BankFill",
              descriptionShell: "TokenBankDescriptionText",
              notificationHook: "CheckTokenClaimNotification",
              adjacentTerms: [
                "get_TokenBankCap",
                "get_ClaimableBankTokens",
                "IncreaseBankedTokens",
                "TokenShopButtonNotification"
              ]
            }
          },
          blockedInputReasons: {
            tokenBankController: null
          }
        },
        "token-shop-late-atu-family": {
          subjectId: "range:token-shop:ATU24Button-ATU28Button",
          subjectKind: "range-family",
          groundedFields: {
            tokenBankController: {
              claimMethod: "ClaimBankedTokens"
            }
          }
        }
      }
    }),
    {
      hasControllerShell: true,
      coverageSource: "db-subject-metadata",
      claimMethod: "ClaimBankedTokens",
      fillMethod: "SetBankFill",
      fillField: "BankFill",
      descriptionShell: "TokenBankDescriptionText",
      notificationHook: "CheckTokenClaimNotification",
      rowLocalSubjectId: "row:ATU7Button",
      rangeFamilySubjectId: "range:token-shop:ATU24Button-ATU28Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      adjacentTerms: [
        "get_TokenBankCap",
        "get_ClaimableBankTokens",
        "IncreaseBankedTokens",
        "TokenShopButtonNotification"
      ],
      blockedInputReason: null
    }
  );
});

test("getTokenBankControllerShellSummary preserves legacy fallback when contract remains blocked", () => {
  assert.deepEqual(
    getTokenBankControllerShellSummary({
      subjectMetadata: {
        "token-shop-atu7-mk3-bridge": {
          subjectId: "row:ATU7Button",
          subjectKind: "row-local",
          groundedFields: {
            tokenBankController: {
              claimMethod: "ClaimBankedTokens",
              fillMethod: "SetBankFill",
              fillField: "BankFill",
              descriptionShell: "TokenBankDescriptionText",
              notificationHook: "CheckTokenClaimNotification",
              adjacentTerms: ["get_TokenBankCap"]
            }
          },
          blockedInputReasons: {
            tokenBankController: "reconstruction:missing-seam"
          }
        }
      },
      controllerAnchors: [
        "ClaimBankedTokens",
        "SetBankFill",
        "BankFill",
        "TokenBankDescriptionText",
        "CheckTokenClaimNotification",
        "TokenShopButtonNotification"
      ],
      adjacentControllerMethods: [
        "get_TokenBankCap",
        "get_ClaimableBankTokens",
        "IncreaseBankedTokens"
      ]
    }),
    {
      hasControllerShell: true,
      coverageSource: "legacy-token-bank-controller",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      claimMethod: "ClaimBankedTokens",
      fillMethod: "SetBankFill",
      fillField: "BankFill",
      descriptionShell: "TokenBankDescriptionText",
      notificationHook: "CheckTokenClaimNotification"
    }
  );
});

test("getTokenBankStateSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenBankStateSummary({
      subjectMetadata: {
        "token-shop-atu4-mod": {
          subjectId: "row:ATU4Button",
          subjectKind: "row-local",
          groundedFields: {
            tokenBankState: {
              claimMethod: "ClaimBankedTokens",
              capMethod: "get_TokenBankCap",
              displayShell: "BigStatisticPrefab.TokenBankCap",
              loopHandler: "TextHandlerLoopMods",
              loopHook: "SetLM244BonusText",
              exactSaveOwnerType: "SaveData",
              storedAmountField: "BankedTokens",
              genericClaimableFieldOwner: "SaveData",
              genericClaimableField: "ClaimableTokenium",
              profileBridgeOwner: "PlayerProfileHandler",
              profileBridgeMethod: "ConvertSaveDataToProfileData",
              profileBridgeReturnType: "PlayerProfileData",
              profileCacheField: "saveInfoCache",
              cloudSaveShell: "CloudSavePlayerProfile",
              cloudSaveInfoRoutine: "GetCurrentSaveFileInfo",
              cloudSaveProfileRoutine: "GetPlayerProfileInfo",
              cloudSaveStateMachine: "<CloudSavePlayerProfile>d__24"
            }
          }
        },
        "token-shop-late-atu-family": {
          subjectId: "range:token-shop:ATU24Button-ATU28Button",
          subjectKind: "range-family",
          groundedFields: {
            tokenBankState: {
              claimMethod: "ClaimBankedTokens"
            }
          }
        }
      }
    }),
    {
      hasControllerSplit: true,
      hasExactStoredAmountOwner: true,
      hasGenericClaimableBoundary: true,
      hasPlayerProfileBridgeBoundary: true,
      hasCloudSaveShellBoundary: true,
      coverageSource: "db-subject-metadata",
      claimMethod: "ClaimBankedTokens",
      capMethod: "get_TokenBankCap",
      displayShell: "BigStatisticPrefab.TokenBankCap",
      loopHandler: "TextHandlerLoopMods",
      loopHook: "SetLM244BonusText",
      exactSaveOwnerType: "SaveData",
      storedAmountField: "BankedTokens",
      exactSaveOwnerLabel: "SaveData.BankedTokens",
      genericClaimableFieldOwner: "SaveData",
      genericClaimableField: "ClaimableTokenium",
      genericClaimableLabel: "SaveData.ClaimableTokenium",
      profileBridgeOwner: "PlayerProfileHandler",
      profileBridgeMethod: "ConvertSaveDataToProfileData",
      profileBridgeReturnType: "PlayerProfileData",
      profileCacheField: "saveInfoCache",
      profileBridgeLabel:
        "PlayerProfileHandler.saveInfoCache + ConvertSaveDataToProfileData(...) -> PlayerProfileData",
      cloudSaveShell: "CloudSavePlayerProfile",
      cloudSaveInfoRoutine: "GetCurrentSaveFileInfo",
      cloudSaveProfileRoutine: "GetPlayerProfileInfo",
      cloudSaveStateMachine: "<CloudSavePlayerProfile>d__24",
      rowLocalSubjectId: "row:ATU4Button",
      rangeFamilySubjectId: "range:token-shop:ATU24Button-ATU28Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      blockedInputReason: null
    }
  );
});

test("getTokenBankStateSummary preserves legacy fallback when contract remains blocked", () => {
  assert.deepEqual(
    getTokenBankStateSummary({
      subjectMetadata: {
        "token-shop-daily-tokenium-family": {
          subjectId: "range:token-shop:ATU14Button-ATU19Button",
          subjectKind: "range-family",
          groundedFields: {
            tokenBankState: {
              claimMethod: "ClaimBankedTokens",
              capMethod: "get_TokenBankCap",
              loopHandler: "TextHandlerLoopMods",
              loopHook: "SetLM244BonusText",
              cloudSaveShell: "CloudSavePlayerProfile",
              cloudSaveInfoRoutine: "GetCurrentSaveFileInfo",
              cloudSaveProfileRoutine: "GetPlayerProfileInfo",
              cloudSaveStateMachine: "<CloudSavePlayerProfile>d__24"
            }
          },
          blockedInputReasons: {
            tokenBankState:
              "missing-db-term-evidence:tokenBankState:BigStatisticPrefab.TokenBankCap"
          }
        }
      },
      exactSaveOwnerRecovery: {
        declaringType: "SaveData",
        storedAmountField: "BankedTokens"
      },
      genericTokeniumClaimableBoundary: {
        declaringType: "SaveData",
        field: "ClaimableTokenium"
      },
      playerProfilePersistenceBoundary: {
        bridgeOwner: "PlayerProfileHandler",
        bridgeMethod: "ConvertSaveDataToProfileData",
        bridgeReturnType: "PlayerProfileData",
        handlerField: "saveInfoCache"
      },
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
      hasExactStoredAmountOwner: true,
      hasGenericClaimableBoundary: true,
      hasPlayerProfileBridgeBoundary: true,
      hasCloudSaveShellBoundary: true,
      coverageSource: "legacy-token-bank-state",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      claimMethod: "ClaimBankedTokens",
      capMethod: "get_TokenBankCap",
      displayShell: "BigStatisticPrefab.TokenBankCap",
      loopHandler: "TextHandlerLoopMods",
      loopHook: "SetLM244BonusText",
      exactSaveOwnerType: "SaveData",
      storedAmountField: "BankedTokens",
      exactSaveOwnerLabel: "SaveData.BankedTokens",
      genericClaimableFieldOwner: "SaveData",
      genericClaimableField: "ClaimableTokenium",
      genericClaimableLabel: "SaveData.ClaimableTokenium",
      profileBridgeOwner: "PlayerProfileHandler",
      profileBridgeMethod: "ConvertSaveDataToProfileData",
      profileBridgeReturnType: "PlayerProfileData",
      profileCacheField: "saveInfoCache",
      profileBridgeLabel:
        "PlayerProfileHandler.saveInfoCache + ConvertSaveDataToProfileData(...) -> PlayerProfileData",
      cloudSaveShell: "CloudSavePlayerProfile",
      cloudSaveInfoRoutine: "GetCurrentSaveFileInfo",
      cloudSaveProfileRoutine: "GetPlayerProfileInfo",
      cloudSaveStateMachine: "<CloudSavePlayerProfile>d__24"
    }
  );
});

test("getTokenBankFormulaBoundarySummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenBankFormulaBoundarySummary({
      subjectMetadata: {
        "token-shop-atu4-mod": {
          subjectId: "row:ATU4Button",
          subjectKind: "row-local",
          groundedFields: {
            tokenBankFormula: {
              capAccessor: "get_FinalTokenBankCap",
              fillAccessor: "get_FinalTokenBankFillSpeed",
              capField: "<FinalTokenBankCap>k__BackingField",
              fillField: "<FinalTokenBankFillSpeed>k__BackingField",
              saveFamilyOverlapClear: true
            }
          }
        },
        "token-shop-late-atu-family": {
          subjectId: "range:token-shop:ATU24Button-ATU28Button",
          subjectKind: "range-family",
          groundedFields: {
            tokenBankFormula: {
              capAccessor: "get_FinalTokenBankCap"
            }
          },
          blockedInputReasons: {
            tokenBankFormula: null
          }
        }
      }
    }),
    {
      hasDerivedOutputBoundary: true,
      hasNoSaveJoinInDerivedContext: true,
      coverageSource: "db-subject-metadata",
      capAccessor: "get_FinalTokenBankCap",
      fillAccessor: "get_FinalTokenBankFillSpeed",
      capField: "<FinalTokenBankCap>k__BackingField",
      fillField: "<FinalTokenBankFillSpeed>k__BackingField",
      rowLocalSubjectId: "row:ATU4Button",
      rangeFamilySubjectId: "range:token-shop:ATU24Button-ATU28Button",
      rowLocalSubjectKind: "row-local",
      rangeFamilySubjectKind: "range-family",
      blockedInputReason: null
    }
  );
});

test("getTokenBankFormulaBoundarySummary preserves legacy fallback when contract remains blocked", () => {
  assert.deepEqual(
    getTokenBankFormulaBoundarySummary({
      subjectMetadata: {
        "token-shop-late-atu-family": {
          subjectId: "range:token-shop:ATU24Button-ATU28Button",
          subjectKind: "range-family",
          groundedFields: {
            tokenBankFormula: {
              capAccessor: "get_FinalTokenBankCap",
              fillAccessor: "get_FinalTokenBankFillSpeed",
              capField: "<FinalTokenBankCap>k__BackingField",
              fillField: "<FinalTokenBankFillSpeed>k__BackingField",
              saveFamilyOverlapClear: false
            }
          },
          blockedInputReasons: {
            tokenBankFormula: "missing-db-derived-context-clearance:tokenBankFormula"
          }
        }
      },
      tokenBank: {
        formulaBoundary: {
          derivedOutputCluster: [
            "get_FinalTokenBankCap",
            "get_FinalTokenBankFillSpeed",
            "<FinalTokenBankCap>k__BackingField",
            "<FinalTokenBankFillSpeed>k__BackingField"
          ],
          saveFamilyCluesInDerivedContext: []
        }
      }
    }),
    {
      hasDerivedOutputBoundary: true,
      hasNoSaveJoinInDerivedContext: true,
      coverageSource: "legacy-token-bank-formula",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      capAccessor: "get_FinalTokenBankCap",
      fillAccessor: "get_FinalTokenBankFillSpeed",
      capField: "<FinalTokenBankCap>k__BackingField",
      fillField: "<FinalTokenBankFillSpeed>k__BackingField"
    }
  );
});

test("getTokeniumNamingSummary preserves legacy fallback when contract remains blocked", () => {
  assert.deepEqual(
    getTokeniumNamingSummary({
      subjectMetadata: {
        "token-shop-daily-tokenium-family": {
          subjectId: "range:token-shop:ATU14Button-ATU19Button",
          subjectKind: "range-family",
          groundedFields: {
            tokeniumNaming: {
              resourceLabel: "Resource_Tokenium",
              tokenShellLabel: "CostBox-Tokens",
              tokeniumShellLabel: "CostBox-Tokenium"
            }
          },
          blockedInputReasons: {
            tokeniumNaming: "missing-db-term-evidence:tokeniumNaming:Aca.Tokenium553"
          }
        }
      },
      assetNames: {
        resourceIcons: ["Resource_Tokenium"],
        academySprites: ["Aca.Tokenium553"]
      },
      level0Shells: ["CostBox-Tokens", "CostBox-Tokenium"]
    }),
    {
      hasNamingClues: true,
      coverageSource: "legacy-tokenium-naming",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
      resourceLabel: "Resource_Tokenium",
      academyLabel: "Aca.Tokenium553",
      tokenShellLabel: "CostBox-Tokens",
      tokeniumShellLabel: "CostBox-Tokenium"
    }
  );
});

test("imported multiverse market preview keeps the compatibility-only summary shape", () => {
  const preview = getImportedMultiverseMarketPreview(
    {
      status: "quarantined-raw-unmapped",
      importedState: {
        IS71Level: 3,
        IS72Level: 4
      },
      mappingGate: {
        plannerUseAllowed: false,
        canonicalPromotionBlocked: true
      },
      currentBoundary: ["compatibility-only"]
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
  assert.equal(preview.hasOverlapLevelPreview, false);
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

test("multiverse save-owner summaries still fall back through a system view when DB coverage is absent", () => {
  const spendView = buildSpendSystemView({
    tokenShopSystemUnit: null,
    multiverseMarketSystemUnit: {
      sections: {
        saveOwner: {
          saveBoundary: {
            data: {
              actionShellTermsChecked: ["TextHandlerMarkets"],
              saveFamilyTermsChecked: ["PlayerProfileData"],
              boundaryEvidence: {
                actionShellWithSaveOverlapCount: 0,
                metadataNeighborhoodHasActionTerms: true,
                metadataNeighborhoodHasSaveTerms: true,
                metadataDirectCheckHasSaveTerms: false,
                level0DirectCheckHasSaveTerms: false
              }
            }
          },
          marketMemberBoundary: {
            data: {
              playerProfileAccessorClues: ["get_Market"],
              playerProfileMemberShellClues: ["Market"],
              playerProfileHandlerBridgeClues: ["PlayerProfileHandler"],
              directMemberHandoffClues: ["get_Market", "Market"],
              typedSiblingContrastClues: ["PlayerProfileData|GemData"],
              progressionPayloadFieldClues: ["InscryptionsDone"],
              cloudSaveBridgeClues: ["CloudSavePlayerProfile"],
              missingDirectTypeMapClues: ["PlayerProfileData|Market"],
              negativeTypedDirectPlayerProfileProgressionChecks: ["PlayerProfileData.IS71Level"],
              negativeTypedDirectMemberChecks: ["PlayerProfileData.Market"],
              negativeTypedSaveDataMarketChecks: ["SaveData.Market"],
              typedBridgeRecovery: {
                bridgeOwner: "PlayerProfileHandler",
                bridgeAccessor: "get_Market",
                bridgeReturnType: "MultiverseMarket"
              },
              typedHandlerFieldRecovery: {
                fieldOwner: "PlayerProfileHandler",
                fieldName: "saveInfoCache",
                fieldType: "PlayerProfileData"
              }
            }
          }
        }
      }
    },
    systemDb: null
  });

  const saveSummary = getMultiverseMarketSaveBoundarySummary(spendView.multiverseMarket);
  const memberSummary = getMultiverseMarketMarketMemberBoundarySummary(spendView.multiverseMarket);
  assert.equal(saveSummary.hasSeparationBoundary, true);
  assert.equal(saveSummary.actionAnchor, "TextHandlerMarkets");
  assert.equal(memberSummary.hasTypedAccessorBridge, true);
  assert.equal(memberSummary.exactSaveOwnerLabel, "SaveData");
});

test("buildSpendSystemView keeps multiverse save-owner artifacts only as compatibility fallback when DB coverage exists", () => {
  const spendView = buildSpendSystemView({
    tokenShopSystemUnit: null,
    multiverseMarketSystemUnit: {
      sections: {
        saveOwner: {
          saveBoundary: {
            data: { actionShellTermsChecked: ["TextHandlerMarkets"] }
          },
          marketMemberBoundary: {
            data: { playerProfileAccessorClues: ["get_Market"] }
          }
        }
      }
    },
    systemDb: {
      multiverseMarket: {
        genericMechanics: {
          scopes: {
            "multiverse-market-save-owner-boundary": {
              entities: [
                { entityId: "multiverse-market-save-owner-boundary", entityKind: "family-graph" }
              ],
              facts: [],
              relations: [],
              gaps: []
            }
          }
        },
        boundaries: {
          owner: {
            subjectId: "multiverse-market-save-owner-boundary",
            boundaryKind: "subject-boundary",
            verdict: "quarantine"
          }
        }
      }
    }
  });

  assert.equal(spendView.multiverseMarket.saveOwner.saveBoundary, null);
  assert.equal(spendView.multiverseMarket.saveOwner.marketMemberBoundary, null);
  assert.deepEqual(spendView.multiverseMarket.saveOwner.compatibilityBoundaries.saveBoundary, {
    actionShellTermsChecked: ["TextHandlerMarkets"]
  });
  assert.deepEqual(
    spendView.multiverseMarket.saveOwner.compatibilityBoundaries.marketMemberBoundary,
    { playerProfileAccessorClues: ["get_Market"] }
  );
});

test("multiverse row-text, action-shell, and owner-family summaries prefer DB-backed generic mechanics when present", () => {
  const market = {
    db: {
      genericMechanics: {
        scopes: {
          "multiverse-market-row-text-boundary": {
            entities: [
              { entityId: "family-graph:multiverse-market-row-text", entityKind: "family-graph" }
            ],
            facts: [
              { factKind: "owner-anchor", factValue: "TextHandlerMarkets" },
              { factKind: "owner-anchor", factValue: "SetAllChrystosEmporiumTexts" },
              { factKind: "cost-text-sample", factValue: "SetIS71CostText" },
              { factKind: "cost-text-sample", factValue: "SetIS74CostText" },
              { factKind: "cost-text-row-id", factValue: "71" },
              { factKind: "cost-text-row-id", factValue: "74" },
              { factKind: "buy-hook-sample", factValue: "BuyIS71" },
              { factKind: "buy-hook-sample", factValue: "BuyIS74" }
            ],
            relations: [],
            gaps: [{ gapKind: "next-seam", payload: { seamId: "broad-row-identity-remap" } }]
          },
          "multiverse-market-action-shell-boundary": {
            entities: [
              {
                entityId: "family-graph:multiverse-market-action-shell",
                entityKind: "family-graph"
              }
            ],
            facts: [
              { factKind: "owner-anchor", factValue: "TextHandlerMarkets" },
              { factKind: "owner-anchor", factValue: "SetAllChrystosEmporiumTexts" },
              { factKind: "buy-hook-row-id", factValue: "71" },
              { factKind: "buy-hook-row-id", factValue: "72" },
              { factKind: "cost-text-row-id", factValue: "71" },
              { factKind: "cost-text-row-id", factValue: "74" },
              { factKind: "buy-hook-sample", factValue: "BuyIS71" },
              { factKind: "buy-hook-sample", factValue: "BuyIS72" },
              { factKind: "cost-text-sample", factValue: "SetIS71CostText" },
              { factKind: "cost-text-sample", factValue: "SetIS74CostText" }
            ],
            relations: [],
            gaps: [{ gapKind: "next-seam", payload: { seamId: "broad-row-identity-remap" } }]
          },
          "multiverse-market-owner-family-boundary": {
            entities: [
              {
                entityId: "family-graph:multiverse-market-owner-family",
                entityKind: "family-graph"
              }
            ],
            facts: [
              { factKind: "owner-anchor", factValue: "MultiverseMarket" },
              { factKind: "owner-anchor", factValue: "TextHandlerMarkets" },
              { factKind: "owner-anchor", factValue: "SetAllChrystosEmporiumTexts" },
              { factKind: "resource-anchor", factValue: "ResourceAmountText" },
              { factKind: "wrapper-only-field-label", factValue: "InscryptionsDone" }
            ],
            relations: [],
            gaps: [{ gapKind: "next-seam", payload: { seamId: "currency-shell-range-recovery" } }]
          }
        }
      },
      boundaries: {
        rowText: {
          subjectId: "family-graph:multiverse-market-row-text",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        },
        actionShell: {
          subjectId: "family-graph:multiverse-market-action-shell",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        },
        ownerFamily: {
          subjectId: "family-graph:multiverse-market-owner-family",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    },
    saveOwner: {
      extract: {
        source: {
          validated_ids: [50, 59, 63, 71, 72, 73, 74]
        }
      }
    }
  };

  const rowTextSummary = getMultiverseMarketRowTextCoverageSummary(null, market);
  assert.equal(rowTextSummary.hasValidatedTextCoverage, true);
  assert.equal(rowTextSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(rowTextSummary.validatedRangeLabel, "71 and 74");

  const actionShellSummary = getMultiverseMarketActionShellSummary(null, market);
  assert.equal(actionShellSummary.hasActionShell, true);
  assert.equal(actionShellSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(actionShellSummary.buyRangeLabel, "BuyIS71-72");

  const ownerFamilySummary = getMultiverseMarketOwnerFamilySummary(null, market);
  assert.equal(ownerFamilySummary.hasOwnerFamily, true);
  assert.equal(ownerFamilySummary.hasCurrencyShell, false);
  assert.equal(ownerFamilySummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(ownerFamilySummary.inscryptionsLabel, "InscryptionsDone");

  const metadataSummary = getMultiverseMarketMetadataSummary(null, {
    ...market,
    db: {
      ...market.db,
      genericMechanics: {
        scopes: {
          ...market.db.genericMechanics.scopes,
          "multiverse-market-metadata-neighborhood": {
            entities: [
              {
                entityId: "family-graph:multiverse-market-metadata-neighborhood",
                entityKind: "family-graph"
              }
            ],
            facts: [
              { factKind: "metadata-anchor", factValue: "PlayerProfileData" },
              { factKind: "metadata-anchor", factValue: "FillPlayerProfileData" },
              { factKind: "metadata-anchor", factValue: "InscryptionsDone" },
              { factKind: "metadata-anchor", factValue: "EsotericR1Trades" },
              { factKind: "typed-span", factValue: "IS1Level through IS110Level" }
            ],
            relations: [],
            gaps: [{ gapKind: "next-seam", payload: { seamId: "cloud-save-path-recovery" } }]
          }
        }
      },
      boundaries: {
        ...market.db.boundaries,
        metadataNeighborhood: {
          subjectId: "family-graph:multiverse-market-metadata-neighborhood",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  });
  assert.equal(metadataSummary.hasSaveFamilyClues, true);
  assert.equal(metadataSummary.hasProgressionFieldCluster, true);
  assert.equal(metadataSummary.hasCloudSavePathClues, false);
  assert.equal(metadataSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(metadataSummary.recoveredIsRangeLabel, "IS1Level through IS110Level");

  const typedOwnerMetadataSummary = getMultiverseMarketMetadataSummary(null, {
    ...market,
    db: {
      ...market.db,
      genericMechanics: {
        scopes: {
          ...market.db.genericMechanics.scopes,
          "multiverse-market-typed-owner-boundary": {
            entities: [
              { entityId: "family-graph:multiverse-market-typed-owner", entityKind: "family-graph" }
            ],
            facts: [
              { factKind: "typed-host-anchor", factValue: "PlayerProfileData" },
              { factKind: "typed-conversion-anchor", factValue: "FillPlayerProfileData" },
              { factKind: "typed-field-sample", factValue: "InscryptionsDone" },
              { factKind: "typed-field-sample", factValue: "EsotericR1Trades" },
              { factKind: "typed-span", factValue: "IS1Level through IS110Level" }
            ],
            relations: [],
            gaps: [{ gapKind: "next-seam", payload: { seamId: "typed-market-field-recovery" } }]
          }
        }
      },
      boundaries: {
        ...market.db.boundaries,
        typedOwner: {
          subjectId: "family-graph:multiverse-market-typed-owner",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  });
  assert.equal(typedOwnerMetadataSummary.hasSaveFamilyClues, true);
  assert.equal(typedOwnerMetadataSummary.hasProgressionFieldCluster, true);
  assert.equal(typedOwnerMetadataSummary.recoveredIsRangeLabel, "IS1Level through IS110Level");
  assert.equal(typedOwnerMetadataSummary.coverageSource, "generic-mechanics+boundary-model");

  const typedOwnerSummary = getMultiverseMarketTypedOwnerSummary({
    ...market,
    db: {
      ...market.db,
      genericMechanics: {
        scopes: {
          ...market.db.genericMechanics.scopes,
          "multiverse-market-typed-owner-boundary": {
            entities: [
              { entityId: "family-graph:multiverse-market-typed-owner", entityKind: "family-graph" }
            ],
            facts: [
              { factKind: "typed-host-anchor", factValue: "PlayerProfileHandler" },
              { factKind: "typed-host-anchor", factValue: "PlayerProfileData" },
              { factKind: "typed-host-anchor", factValue: "SaveData" },
              { factKind: "typed-conversion-anchor", factValue: "FillPlayerProfileData" },
              { factKind: "typed-field-sample", factValue: "InscryptionsDone" },
              { factKind: "typed-field-sample", factValue: "EsotericR1Trades" },
              { factKind: "typed-span", factValue: "IS1Level through IS110Level" }
            ],
            relations: [],
            gaps: [
              { gapKind: "missing-edge", payload: { edgeId: "typed-market-field-recovery" } },
              { gapKind: "next-seam", payload: { seamId: "typed-market-field-recovery" } }
            ]
          }
        }
      },
      boundaries: {
        ...market.db.boundaries,
        typedOwner: {
          subjectId: "family-graph:multiverse-market-typed-owner",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  });
  assert.equal(typedOwnerSummary.hasTypedOwnerAnchors, true);
  assert.equal(typedOwnerSummary.hasTypedConversionAnchors, true);
  assert.equal(typedOwnerSummary.hasTypedFieldSamples, true);
  assert.equal(typedOwnerSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(typedOwnerSummary.recoveredIsRangeLabel, "IS1Level through IS110Level");
  assert.equal(
    typedOwnerSummary.negativeTypedOwnerLabel,
    "exact typed Market or MultiverseMarket field host remains unrecovered"
  );

  const canonicalImportSummary = getMultiverseMarketCanonicalImportSummary({
    ...market,
    db: {
      ...market.db,
      genericMechanics: {
        scopes: {
          ...market.db.genericMechanics.scopes,
          "multiverse-market-canonical-import-boundary": {
            entities: [
              {
                entityId: "family-graph:multiverse-market-canonical-import",
                entityKind: "family-graph"
              }
            ],
            facts: [
              {
                factKind: "compatibility-import-target-path",
                factValue: "compatibility.unmappedSystemState.multiverseMarket"
              },
              { factKind: "canonical-import-safe-subset-label", factValue: "none" },
              { factKind: "ordered-overlap-row-id", factValue: "71" },
              { factKind: "ordered-overlap-row-id", factValue: "74" }
            ],
            relations: [],
            gaps: [
              { gapKind: "missing-edge", payload: { edgeId: "canonical-import-admissibility" } },
              { gapKind: "next-seam", payload: { seamId: "canonical-import-admissibility" } }
            ]
          }
        }
      },
      boundaries: {
        ...market.db.boundaries,
        canonicalImport: {
          subjectId: "family-graph:multiverse-market-canonical-import",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  });
  assert.equal(canonicalImportSummary.hasCanonicalImportBoundary, true);
  assert.equal(canonicalImportSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(canonicalImportSummary.safeSubsetLabel, "none");
  assert.equal(
    canonicalImportSummary.negativeCanonicalImportLabel,
    "canonical import admissibility remains unrecovered"
  );

  const broadRemapSummary = getMultiverseMarketBroadRowRemapSummary({
    ...market,
    db: {
      ...market.db,
      genericMechanics: {
        scopes: {
          ...market.db.genericMechanics.scopes,
          "multiverse-market-broad-row-remap-boundary": {
            entities: [
              {
                entityId: "family-graph:multiverse-market-broad-row-remap",
                entityKind: "family-graph"
              }
            ],
            facts: [
              {
                factKind: "broader-row-remap-status",
                factValue:
                  "Broader row identity or remap stays blocked outside the checked 71-74 ordered overlap."
              },
              { factKind: "ordered-overlap-row-id", factValue: "71" },
              { factKind: "ordered-overlap-row-id", factValue: "74" },
              { factKind: "buy-hook-sample", factValue: "BuyIS71" },
              { factKind: "buy-hook-sample", factValue: "BuyIS74" },
              { factKind: "cost-text-sample", factValue: "SetIS71CostText" },
              { factKind: "cost-text-sample", factValue: "SetIS74CostText" }
            ],
            relations: [],
            gaps: [
              { gapKind: "missing-edge", payload: { edgeId: "broad-row-identity-remap" } },
              { gapKind: "next-seam", payload: { seamId: "broad-row-identity-remap" } }
            ]
          }
        }
      },
      boundaries: {
        ...market.db.boundaries,
        broadRowRemap: {
          subjectId: "family-graph:multiverse-market-broad-row-remap",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  });
  assert.equal(broadRemapSummary.hasBroadRowRemapBoundary, true);
  assert.equal(broadRemapSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(
    broadRemapSummary.negativeBroadRemapLabel,
    "broader row identity remap remains unrecovered outside the checked overlap"
  );
  assert.equal(broadRemapSummary.buyRangeLabel, "71 and 74");
  assert.equal(broadRemapSummary.costTextRangeLabel, "71 and 74");

  const prefabRemapSummary = getMultiverseMarketPrefabRemapBoundarySummary(null, {
    ...market,
    db: {
      ...market.db,
      genericMechanics: {
        scopes: {
          ...market.db.genericMechanics.scopes,
          "multiverse-market-prefab-remap-boundary": {
            entities: [
              {
                entityId: "family-graph:multiverse-market-prefab-remap",
                entityKind: "family-graph"
              }
            ],
            facts: [
              { factKind: "prefab-sample", factValue: "ChrystosEmporiumUpgrade71" },
              { factKind: "prefab-sample", factValue: "ChrystosEmporiumUpgrade74" },
              { factKind: "prefab-override-pair", factValue: "ChrystosEmporiumUpgrade71-ID59" },
              { factKind: "prefab-override-pair", factValue: "ChrystosEmporiumUpgrade74-ID62" },
              { factKind: "prefab-row-id", factValue: "71" },
              { factKind: "prefab-row-id", factValue: "74" },
              { factKind: "serialized-id-row-id", factValue: "59" },
              { factKind: "serialized-id-row-id", factValue: "62" }
            ],
            relations: [],
            gaps: [
              { gapKind: "next-seam", payload: { seamId: "explicit-prefab-override-mapping" } }
            ]
          }
        }
      },
      boundaries: {
        ...market.db.boundaries,
        prefabRemap: {
          subjectId: "family-graph:multiverse-market-prefab-remap",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  });
  assert.equal(prefabRemapSummary.hasOverrideBoundary, true);
  assert.equal(prefabRemapSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(prefabRemapSummary.validatedMismatchLabel, "71 and 74");
  assert.deepEqual(prefabRemapSummary.overridePairs, [
    "ChrystosEmporiumUpgrade71-ID59",
    "ChrystosEmporiumUpgrade74-ID62"
  ]);
});

test("buildSpendSystemView keeps multiverse row and ui-shell artifacts only as compatibility fallback when DB coverage exists", () => {
  const spendView = buildSpendSystemView({
    tokenShopSystemUnit: null,
    multiverseMarketSystemUnit: {
      sections: {
        rowIdentity: {
          metadataNeighborhood: {
            data: { results: [{ anchor: "PlayerProfileData", matches: [] }] }
          },
          rangeBoundary: { data: { validatedRowRanges: ["50-59 and 63-74"] } },
          rowTextCoverage: { data: { textHandlerAnchors: ["TextHandlerMarkets"] } },
          prefabRemapBoundary: { data: { directPrefabNumberMatches: [50, 68] } }
        },
        uiShell: {
          actionShell: { data: { textHandlerAnchors: ["TextHandlerMarkets"] } },
          ownerFamily: { data: { ownerAnchors: ["MultiverseMarket"] } }
        }
      }
    },
    systemDb: {
      multiverseMarket: {
        genericMechanics: {
          scopes: {
            "multiverse-market-save-owner-boundary": {
              entities: [
                { entityId: "multiverse-market-save-owner-boundary", entityKind: "family-graph" }
              ],
              facts: [],
              relations: [],
              gaps: []
            },
            "multiverse-market-row-text-boundary": {
              entities: [
                { entityId: "family-graph:multiverse-market-row-text", entityKind: "family-graph" }
              ],
              facts: [],
              relations: [],
              gaps: []
            },
            "multiverse-market-metadata-neighborhood": {
              entities: [
                {
                  entityId: "family-graph:multiverse-market-metadata-neighborhood",
                  entityKind: "family-graph"
                }
              ],
              facts: [],
              relations: [],
              gaps: []
            },
            "multiverse-market-action-shell-boundary": {
              entities: [
                {
                  entityId: "family-graph:multiverse-market-action-shell",
                  entityKind: "family-graph"
                }
              ],
              facts: [],
              relations: [],
              gaps: []
            },
            "multiverse-market-owner-family-boundary": {
              entities: [
                {
                  entityId: "family-graph:multiverse-market-owner-family",
                  entityKind: "family-graph"
                }
              ],
              facts: [],
              relations: [],
              gaps: []
            },
            "multiverse-market-prefab-remap-boundary": {
              entities: [
                {
                  entityId: "family-graph:multiverse-market-prefab-remap",
                  entityKind: "family-graph"
                }
              ],
              facts: [],
              relations: [],
              gaps: []
            }
          }
        },
        boundaries: {
          saveOwner: {
            subjectId: "multiverse-market-save-owner-boundary",
            boundaryKind: "subject-boundary",
            verdict: "quarantine"
          },
          metadataNeighborhood: {
            subjectId: "family-graph:multiverse-market-metadata-neighborhood",
            boundaryKind: "subject-boundary",
            verdict: "quarantine"
          },
          rowText: {
            subjectId: "family-graph:multiverse-market-row-text",
            boundaryKind: "subject-boundary",
            verdict: "quarantine"
          },
          actionShell: {
            subjectId: "family-graph:multiverse-market-action-shell",
            boundaryKind: "subject-boundary",
            verdict: "quarantine"
          },
          ownerFamily: {
            subjectId: "family-graph:multiverse-market-owner-family",
            boundaryKind: "subject-boundary",
            verdict: "quarantine"
          },
          prefabRemap: {
            subjectId: "family-graph:multiverse-market-prefab-remap",
            boundaryKind: "subject-boundary",
            verdict: "quarantine"
          }
        }
      }
    }
  });

  assert.equal(spendView.multiverseMarket.rowIdentity.metadataNeighborhood, null);
  assert.equal(spendView.multiverseMarket.rowIdentity.rangeBoundary, null);
  assert.equal(spendView.multiverseMarket.rowIdentity.rowTextCoverage, null);
  assert.equal(spendView.multiverseMarket.rowIdentity.prefabRemapBoundary, null);
  assert.equal(spendView.multiverseMarket.uiShell.actionShell, null);
  assert.equal(spendView.multiverseMarket.uiShell.ownerFamily, null);
  assert.deepEqual(
    spendView.multiverseMarket.rowIdentity.compatibilityBoundaries.metadataNeighborhood,
    { results: [{ anchor: "PlayerProfileData", matches: [] }] }
  );
  assert.deepEqual(spendView.multiverseMarket.rowIdentity.compatibilityBoundaries.rangeBoundary, {
    validatedRowRanges: ["50-59 and 63-74"]
  });
  assert.deepEqual(spendView.multiverseMarket.uiShell.compatibilityBoundaries.ownerFamily, {
    ownerAnchors: ["MultiverseMarket"]
  });
});
