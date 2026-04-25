import test from "node:test";
import assert from "node:assert/strict";

import {
  formatNumericRanges,
  getDailyTokeniumLaneSummary,
  getImportedMultiverseMarketPreview,
  getMultiverseMarketMarketMemberBoundarySummary,
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
      subjectContracts: {
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
      coverageSource: "subject-contracts",
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
      subjectContracts: {
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
      coverageSource: "subject-contracts",
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
      subjectContracts: {
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
      coverageSource: "subject-contracts",
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
      coverageSource: "legacy-token-bank-state",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
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
      subjectContracts: {
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
      coverageSource: "subject-contracts",
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
    subjectContracts: {
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

  assert.equal(summary.coverageSource, "subject-contracts");
  assert.equal(summary.purchaseHook, "BuyLM244");
  assert.equal(summary.ownerFamilyLabel, "SpaceAcademy");
});

test("contract-backed tokenium naming ignores conflicting legacy fallback clues", () => {
  const summary = getTokeniumNamingSummary({
    subjectContracts: {
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

  assert.equal(summary.coverageSource, "subject-contracts");
  assert.equal(summary.resourceLabel, "Resource_Tokenium");
  assert.equal(summary.academyLabel, "Aca.Tokenium553");
});

test("getTokenShopCoverageSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenShopCoverageSummary({
      subjectContracts: {
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
      coverageSource: "subject-contracts",
      numericGroupCount: 2,
      hasNamedLanes: true,
      namedLaneLabel: "row:ATU4Button, range:token-shop:ATU24Button-ATU28Button",
      tierLabel: "1 row-local and 1 range-family canonical subjects",
      hasControllerAnchors: true,
      subjectCount: 2,
      rowLocalCount: 1,
      rangeFamilyCount: 1,
      blockedCount: 2,
      subjectLabels: ["row:ATU4Button", "range:token-shop:ATU24Button-ATU28Button"]
    }
  );
});

test("getTokenShopOwnerShellSummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenShopOwnerShellSummary({
      subjectContracts: {
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
      coverageSource: "subject-contracts",
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
      subjectContracts: {
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
      subjectContracts: {
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
      coverageSource: "subject-contracts",
      ownerAnchor: "row:ATU4Button",
      saveAnchor: "range:token-shop:ATU24Button-ATU28Button",
      overlapLabel: "canonical subject-state separation",
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
      subjectContracts: {
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
      coverageSource: "subject-contracts",
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
      subjectContracts: {
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
      subjectContracts: {
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
      hasCloudSaveShellBoundary: true,
      coverageSource: "subject-contracts",
      claimMethod: "ClaimBankedTokens",
      capMethod: "get_TokenBankCap",
      displayShell: "BigStatisticPrefab.TokenBankCap",
      loopHandler: "TextHandlerLoopMods",
      loopHook: "SetLM244BonusText",
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
      subjectContracts: {
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
      coverageSource: "legacy-token-bank-state",
      fallbackMode: "export-debug-compatibility",
      usesLegacyCompatibilityFallback: true,
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

test("getTokenBankFormulaBoundarySummary prefers canonical subject contracts when available", () => {
  assert.deepEqual(
    getTokenBankFormulaBoundarySummary({
      subjectContracts: {
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
      coverageSource: "subject-contracts",
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
      subjectContracts: {
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
      subjectContracts: {
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
