import { hasDbSystemCoverageForSubjects, normalizeDbSystemBundle } from "./db-system-bundle.js";
import { normalizeTokenShopDbBundle } from "./token-shop-db-bundle.js";
import { buildSpendProgressionModel } from "./progression-model.js";

export function buildAppMetaSystemView(appMetaSystemUnit) {
  return {
    snapshot: appMetaSystemUnit?.sections?.snapshot?.data ?? null,
    datasetContract: appMetaSystemUnit?.sections?.datasetContract?.data ?? null
  };
}

export function buildPlayerStateSystemView(playerStateSystemUnit, mergeDeep) {
  const canonical = playerStateSystemUnit?.sections?.canonicalSharedTruth?.defaultShape ?? {};
  const planner = playerStateSystemUnit?.sections?.plannerHelpers?.defaultShape ?? {};
  const externalModels = playerStateSystemUnit?.sections?.externalModels?.defaultShape ?? {};
  const compatibility = playerStateSystemUnit?.sections?.compatibilityImports?.defaultShape ?? {};

  return {
    canonicalSharedTruth: structuredClone(canonical),
    plannerHelpers: structuredClone(planner),
    externalModels: structuredClone(externalModels),
    compatibilityImports: structuredClone(compatibility),
    defaults: mergeDeep(
      mergeDeep(
        mergeDeep(structuredClone(canonical), structuredClone(planner)),
        structuredClone(externalModels)
      ),
      structuredClone(compatibility)
    )
  };
}

export function buildShardSystemView(shardsSystemUnit, shardDb) {
  const normalizedShardDbBundle = normalizeDbSystemBundle(shardDb);
  const staticOwnerFamilyBoundary =
    shardsSystemUnit?.sections?.family?.boundaries?.ownerFamily?.data ?? null;
  const staticFinalSuBonusBoundary =
    shardsSystemUnit?.sections?.family?.boundaries?.finalSuBonus?.data ?? null;
  const staticMilestonePayloadBoundary =
    shardsSystemUnit?.sections?.family?.boundaries?.milestonePayload?.data ?? null;
  const staticRowModelBoundary =
    shardsSystemUnit?.sections?.family?.boundaries?.rowModel?.data ?? null;
  const staticTitleEffectBoundary =
    shardsSystemUnit?.sections?.family?.boundaries?.titleEffect?.data ?? null;
  const staticEffectTextHandlerBoundary =
    shardsSystemUnit?.sections?.family?.boundaries?.effectTextHandler?.data ?? null;
  const staticRowShellBoundary =
    shardsSystemUnit?.sections?.family?.boundaries?.rowShell?.data ?? null;
  const staticRowAlignmentBoundary =
    shardsSystemUnit?.sections?.family?.boundaries?.rowAlignment?.data ?? null;
  const staticShardSaveBoundary =
    shardsSystemUnit?.sections?.ownedState?.saveBoundary?.data ?? null;
  const staticShardCostModelBoundary =
    shardsSystemUnit?.sections?.cost?.costModelBoundary?.data ?? null;
  const hasDbOwnerFamilyCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["family-graph:shards-owner-family"],
    traceScopes: ["shard-owner-family-boundary"]
  });
  const hasDbShardOwnedStateCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["shard-owned-state-upgradeinfolist-population"],
    traceScopes: ["shard-owned-state-upgradeinfolist-population"]
  });
  const hasDbShardCostCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["shard-cost-su0-structure"],
    traceScopes: ["shard-cost-su0-structure"]
  });
  const hasDbShardMilestonePayloadCoverage = hasDbSystemCoverageForSubjects(
    normalizedShardDbBundle,
    {
      subjectIds: ["family-graph:shards-milestone-payload"],
      traceScopes: ["shard-milestone-payload-boundary"]
    }
  );
  const hasDbShardRowModelCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["family-graph:shards-milestone-row-model"],
    traceScopes: ["shard-milestone-row-model-boundary"]
  });
  const hasDbShardRowShellCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["family-graph:shards-milestone-row-shell"],
    traceScopes: ["shard-milestone-row-shell-boundary"]
  });
  const hasDbShardRowAlignmentCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["family-graph:shards-milestone-row-alignment"],
    traceScopes: ["shard-milestone-row-alignment-boundary"]
  });
  const hasDbShardFinalSuCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["family-graph:shards-finalsu-bonus"],
    traceScopes: ["shard-finalsu-bonus-boundary"]
  });
  const hasDbShardTitleEffectCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["family-graph:shards-milestone-title-effect"],
    traceScopes: ["shard-milestone-title-effect-boundary"]
  });
  const hasDbShardEffectTextCoverage = hasDbSystemCoverageForSubjects(normalizedShardDbBundle, {
    subjectIds: ["family-graph:shards-effect-text-handler"],
    traceScopes: ["shard-effect-text-handler-boundary"]
  });
  return {
    db: {
      subjectMetadata: normalizedShardDbBundle.subjectMetadata,
      genericMechanics: normalizedShardDbBundle.genericScopes,
      boundaries: normalizedShardDbBundle.boundaries,
      hasAny: normalizedShardDbBundle.hasAny
    },
    family: {
      grounded: {
        milestones: shardsSystemUnit?.sections?.family?.grounded?.milestones?.data ?? null,
        observedBehaviors:
          shardsSystemUnit?.sections?.family?.grounded?.observedBehaviors?.data ?? null,
        provenance: shardsSystemUnit?.sections?.family?.grounded?.provenance?.data ?? null,
        assetGrounding: shardsSystemUnit?.sections?.family?.grounded?.assetGrounding?.data ?? null
      },
      boundaries: {
        ownerFamily: hasDbOwnerFamilyCoverage ? null : staticOwnerFamilyBoundary,
        finalSuBonus: hasDbShardFinalSuCoverage ? null : staticFinalSuBonusBoundary,
        milestonePayload: hasDbShardMilestonePayloadCoverage ? null : staticMilestonePayloadBoundary,
        rowModel: hasDbShardRowModelCoverage ? null : staticRowModelBoundary,
        titleEffect: hasDbShardTitleEffectCoverage ? null : staticTitleEffectBoundary,
        effectTextHandler: hasDbShardEffectTextCoverage ? null : staticEffectTextHandlerBoundary,
        rowShell: hasDbShardRowShellCoverage ? null : staticRowShellBoundary,
        rowAlignment: hasDbShardRowAlignmentCoverage ? null : staticRowAlignmentBoundary
      },
      compatibilityBoundaries: {
        ownerFamily: staticOwnerFamilyBoundary,
        finalSuBonus: staticFinalSuBonusBoundary,
        milestonePayload: staticMilestonePayloadBoundary,
        rowModel: staticRowModelBoundary,
        titleEffect: staticTitleEffectBoundary,
        effectTextHandler: staticEffectTextHandlerBoundary,
        rowShell: staticRowShellBoundary,
        rowAlignment: staticRowAlignmentBoundary
      },
      familyEvidence: shardsSystemUnit?.sections?.family?.familyEvidence?.data ?? null
    },
    ownedState: {
      saveBoundary: hasDbShardOwnedStateCoverage ? null : staticShardSaveBoundary,
      compatibilityBoundaries: {
        saveBoundary: staticShardSaveBoundary
      },
      traceBoundary: shardsSystemUnit?.sections?.ownedState?.traceBoundary?.data ?? null,
      saveOwnerCandidates: shardsSystemUnit?.sections?.ownedState?.saveOwnerCandidates?.data ?? null
    },
    cost: {
      costModelBoundary: hasDbShardCostCoverage ? null : staticShardCostModelBoundary,
      compatibilityBoundaries: {
        costModelBoundary: staticShardCostModelBoundary
      },
      bonusSlotProbe: shardsSystemUnit?.sections?.cost?.bonusSlotProbe?.data ?? null,
      formulaModel: shardsSystemUnit?.sections?.cost?.formulaModel?.data ?? null,
      screenshotCalibration: shardsSystemUnit?.sections?.cost?.screenshotCalibration?.data ?? null,
      listPathProbe: shardsSystemUnit?.sections?.cost?.listPathProbe?.data ?? null,
      traceBoundary: shardsSystemUnit?.sections?.cost?.traceBoundary?.data ?? null
    }
  };
}

export function buildSpendSystemView({
  tokenShopSystemUnit,
  multiverseMarketSystemUnit,
  systemDb
}) {
  const normalizedDbBundle = normalizeTokenShopDbBundle(systemDb?.tokenShop);
  const normalizedMultiverseDbBundle = normalizeDbSystemBundle(systemDb?.multiverseMarket);
  const hasDbTokenShopBundle = normalizedDbBundle.hasAny === true;
  const hasDbTokenShopDailyTokeniumCoverage = hasDbSystemCoverageForSubjects(normalizedDbBundle, {
    subjectIds: ["range:token-shop:ATU14Button-ATU19Button", "row:ATU3Button"],
    traceScopes: ["token-shop-daily-tokenium-family", "token-shop-atu3-cells-effect"]
  });
  const hasDbTokenShopTokenBankCoverage = hasDbSystemCoverageForSubjects(normalizedDbBundle, {
    subjectIds: [
      "range:token-shop:ATU1Button-ATU28Button",
      "range:token-shop:ATU14Button-ATU19Button",
      "row:ATU3Button"
    ],
    traceScopes: [
      "token-shop-family-structure",
      "token-shop-daily-tokenium-family",
      "token-shop-atu3-cells-effect"
    ]
  });
  const staticMultiverseMarketMemberBoundary =
    multiverseMarketSystemUnit?.sections?.saveOwner?.marketMemberBoundary?.data ?? null;
  const staticMultiverseSaveBoundary =
    multiverseMarketSystemUnit?.sections?.saveOwner?.saveBoundary?.data ?? null;
  const staticMultiverseMetadataNeighborhood =
    multiverseMarketSystemUnit?.sections?.rowIdentity?.metadataNeighborhood?.data ?? null;
  const staticMultiverseRangeBoundary =
    multiverseMarketSystemUnit?.sections?.rowIdentity?.rangeBoundary?.data ?? null;
  const staticMultiverseRowTextCoverage =
    multiverseMarketSystemUnit?.sections?.rowIdentity?.rowTextCoverage?.data ?? null;
  const staticMultiversePrefabRemapBoundary =
    multiverseMarketSystemUnit?.sections?.rowIdentity?.prefabRemapBoundary?.data ?? null;
  const staticMultiverseActionShell =
    multiverseMarketSystemUnit?.sections?.uiShell?.actionShell?.data ?? null;
  const staticMultiverseOwnerFamily =
    multiverseMarketSystemUnit?.sections?.uiShell?.ownerFamily?.data ?? null;
  const hasDbMultiverseSaveOwnerCoverage = hasDbSystemCoverageForSubjects(
    normalizedMultiverseDbBundle,
    {
      subjectIds: [
        "multiverse-market-save-owner-boundary",
        "family-graph:multiverse-market-save-owner"
      ],
      traceScopes: ["multiverse-market-save-owner-boundary"]
    }
  );
  const hasDbMultiverseRowTextCoverage = hasDbSystemCoverageForSubjects(
    normalizedMultiverseDbBundle,
    {
      subjectIds: ["family-graph:multiverse-market-row-text"],
      traceScopes: ["multiverse-market-row-text-boundary"]
    }
  );
  const hasDbMultiverseMetadataCoverage = hasDbSystemCoverageForSubjects(
    normalizedMultiverseDbBundle,
    {
      subjectIds: ["family-graph:multiverse-market-metadata-neighborhood"],
      traceScopes: ["multiverse-market-metadata-neighborhood"]
    }
  );
  const hasDbMultiverseActionShellCoverage = hasDbSystemCoverageForSubjects(
    normalizedMultiverseDbBundle,
    {
      subjectIds: ["family-graph:multiverse-market-action-shell"],
      traceScopes: ["multiverse-market-action-shell-boundary"]
    }
  );
  const hasDbMultiverseOwnerFamilyCoverage = hasDbSystemCoverageForSubjects(
    normalizedMultiverseDbBundle,
    {
      subjectIds: ["family-graph:multiverse-market-owner-family"],
      traceScopes: ["multiverse-market-owner-family-boundary"]
    }
  );
  const hasDbMultiversePrefabRemapCoverage = hasDbSystemCoverageForSubjects(
    normalizedMultiverseDbBundle,
    {
      subjectIds: ["family-graph:multiverse-market-prefab-remap"],
      traceScopes: ["multiverse-market-prefab-remap-boundary"]
    }
  );
  const progressionModel = buildSpendProgressionModel({
    tokenShopSystemUnit,
    multiverseMarketSystemUnit
  });
  return {
    progressionModel,
    tokenShop: {
      db: {
        subjectMetadata: normalizedDbBundle.subjectMetadata,
        genericMechanics: normalizedDbBundle.genericScopes,
        boundaries: normalizedDbBundle.boundaries,
        hasAny: normalizedDbBundle.hasAny
      },
      rows: {
        extract: tokenShopSystemUnit?.sections?.rows?.extract?.data ?? null,
        canonical: tokenShopSystemUnit?.sections?.rows?.canonical?.data ?? null,
        policy: {
          tierUnlocks: tokenShopSystemUnit?.sections?.rows?.policy?.tierUnlocks?.data ?? null
        },
        boundaries: {
          save: tokenShopSystemUnit?.sections?.rows?.boundaries?.save?.data ?? null,
          remap: tokenShopSystemUnit?.sections?.rows?.boundaries?.remap?.data ?? null,
          owner: tokenShopSystemUnit?.sections?.rows?.boundaries?.owner?.data ?? null,
          lateAtu: tokenShopSystemUnit?.sections?.rows?.boundaries?.lateAtu?.data ?? null
        }
      },
      tokenBank: {
        namingClues: hasDbTokenShopBundle
          ? null
          : tokenShopSystemUnit?.sections?.tokenBank?.namingClues?.data ?? null,
        stateClues: hasDbTokenShopTokenBankCoverage
          ? null
          : tokenShopSystemUnit?.sections?.tokenBank?.stateClues?.data ?? null,
        formulaBoundary: hasDbTokenShopTokenBankCoverage
          ? null
          : tokenShopSystemUnit?.sections?.tokenBank?.formulaBoundary?.data ?? null,
        ownerShell: hasDbTokenShopTokenBankCoverage
          ? null
          : tokenShopSystemUnit?.sections?.tokenBank?.ownerShell?.data ?? null,
        controllerShell: hasDbTokenShopTokenBankCoverage
          ? null
          : tokenShopSystemUnit?.sections?.tokenBank?.controllerShell?.data ?? null,
        compatibilityClues: {
          namingClues: tokenShopSystemUnit?.sections?.tokenBank?.namingClues?.data ?? null,
          stateClues: tokenShopSystemUnit?.sections?.tokenBank?.stateClues?.data ?? null,
          formulaBoundary: tokenShopSystemUnit?.sections?.tokenBank?.formulaBoundary?.data ?? null,
          ownerShell: tokenShopSystemUnit?.sections?.tokenBank?.ownerShell?.data ?? null,
          controllerShell: tokenShopSystemUnit?.sections?.tokenBank?.controllerShell?.data ?? null
        }
      },
      dailyTokenium: {
        laneClues: hasDbTokenShopDailyTokeniumCoverage
          ? null
          : tokenShopSystemUnit?.sections?.dailyTokenium?.laneClues?.data ?? null,
        compatibilityClues: {
          laneClues: tokenShopSystemUnit?.sections?.dailyTokenium?.laneClues?.data ?? null
        }
      },
      spendLanes: {
        costLanes: tokenShopSystemUnit?.sections?.spendLanes?.costLanes?.data ?? null,
        actionLaneClues: tokenShopSystemUnit?.sections?.spendLanes?.actionLaneClues?.data ?? null
      },
      traceRuns: tokenShopSystemUnit?.sections?.traceRuns ?? {}
    },
    multiverseMarket: {
      db: {
        subjectMetadata: normalizedMultiverseDbBundle.subjectMetadata,
        genericMechanics: normalizedMultiverseDbBundle.genericScopes,
        boundaries: normalizedMultiverseDbBundle.boundaries,
        hasAny: normalizedMultiverseDbBundle.hasAny
      },
      saveOwner: {
        extract: multiverseMarketSystemUnit?.sections?.saveOwner?.extract?.data ?? null,
        marketMemberBoundary: hasDbMultiverseSaveOwnerCoverage
          ? null
          : staticMultiverseMarketMemberBoundary,
        saveBoundary: hasDbMultiverseSaveOwnerCoverage ? null : staticMultiverseSaveBoundary,
        compatibilityBoundaries: {
          marketMemberBoundary: staticMultiverseMarketMemberBoundary,
          saveBoundary: staticMultiverseSaveBoundary
        },
        traceBoundary: multiverseMarketSystemUnit?.sections?.saveOwner?.traceBoundary?.data ?? null
      },
      rowIdentity: {
        metadataNeighborhood: hasDbMultiverseMetadataCoverage ? null : staticMultiverseMetadataNeighborhood,
        rangeBoundary: hasDbMultiverseSaveOwnerCoverage ? null : staticMultiverseRangeBoundary,
        rowTextCoverage: hasDbMultiverseRowTextCoverage ? null : staticMultiverseRowTextCoverage,
        prefabRemapBoundary: hasDbMultiversePrefabRemapCoverage ? null : staticMultiversePrefabRemapBoundary,
        compatibilityBoundaries: {
          metadataNeighborhood: staticMultiverseMetadataNeighborhood,
          rangeBoundary: staticMultiverseRangeBoundary,
          rowTextCoverage: staticMultiverseRowTextCoverage,
          prefabRemapBoundary: staticMultiversePrefabRemapBoundary
        }
      },
      uiShell: {
        actionShell: hasDbMultiverseActionShellCoverage ? null : staticMultiverseActionShell,
        ownerFamily: hasDbMultiverseOwnerFamilyCoverage ? null : staticMultiverseOwnerFamily,
        compatibilityBoundaries: {
          actionShell: staticMultiverseActionShell,
          ownerFamily: staticMultiverseOwnerFamily
        }
      }
    }
  };
}
