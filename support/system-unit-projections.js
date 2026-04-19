export function buildPlayerStateSystemView(playerStateSystemUnit, mergeDeep) {
  const canonical = playerStateSystemUnit?.sections?.canonicalSharedTruth?.defaultShape ?? {};
  const planner = playerStateSystemUnit?.sections?.plannerHelpers?.defaultShape ?? {};
  const externalModels = playerStateSystemUnit?.sections?.externalModels?.defaultShape ?? {};
  const compatibility =
    playerStateSystemUnit?.sections?.compatibilityImports?.defaultShape ?? {};

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

export function buildShardSystemView(shardsSystemUnit) {
  return {
    family: {
      grounded: {
        milestones: shardsSystemUnit?.sections?.family?.grounded?.milestones?.data ?? null,
        observedBehaviors:
          shardsSystemUnit?.sections?.family?.grounded?.observedBehaviors?.data ?? null,
        provenance: shardsSystemUnit?.sections?.family?.grounded?.provenance?.data ?? null,
        assetGrounding: shardsSystemUnit?.sections?.family?.grounded?.assetGrounding?.data ?? null
      },
      boundaries: {
        ownerFamily: shardsSystemUnit?.sections?.family?.boundaries?.ownerFamily?.data ?? null,
        finalSuBonus: shardsSystemUnit?.sections?.family?.boundaries?.finalSuBonus?.data ?? null,
        milestonePayload:
          shardsSystemUnit?.sections?.family?.boundaries?.milestonePayload?.data ?? null,
        rowModel: shardsSystemUnit?.sections?.family?.boundaries?.rowModel?.data ?? null,
        titleEffect: shardsSystemUnit?.sections?.family?.boundaries?.titleEffect?.data ?? null,
        effectTextHandler:
          shardsSystemUnit?.sections?.family?.boundaries?.effectTextHandler?.data ?? null,
        rowShell: shardsSystemUnit?.sections?.family?.boundaries?.rowShell?.data ?? null,
        rowAlignment:
          shardsSystemUnit?.sections?.family?.boundaries?.rowAlignment?.data ?? null
      },
      familyEvidence: shardsSystemUnit?.sections?.family?.familyEvidence?.data ?? null
    },
    ownedState: {
      saveBoundary: shardsSystemUnit?.sections?.ownedState?.saveBoundary?.data ?? null,
      traceBoundary: shardsSystemUnit?.sections?.ownedState?.traceBoundary?.data ?? null,
      saveOwnerCandidates:
        shardsSystemUnit?.sections?.ownedState?.saveOwnerCandidates?.data ?? null
    },
    cost: {
      costModelBoundary: shardsSystemUnit?.sections?.cost?.costModelBoundary?.data ?? null,
      bonusSlotProbe: shardsSystemUnit?.sections?.cost?.bonusSlotProbe?.data ?? null,
      costParameterProbe: shardsSystemUnit?.sections?.cost?.costParameterProbe?.data ?? null,
      costNativeProbe: shardsSystemUnit?.sections?.cost?.costNativeProbe?.data ?? null,
      formulaModel: shardsSystemUnit?.sections?.cost?.formulaModel?.data ?? null,
      screenshotCalibration:
        shardsSystemUnit?.sections?.cost?.screenshotCalibration?.data ?? null,
      listPathProbe: shardsSystemUnit?.sections?.cost?.listPathProbe?.data ?? null,
      traceBoundary: shardsSystemUnit?.sections?.cost?.traceBoundary?.data ?? null
    }
  };
}

export function buildSpendSystemView({
  tokenShopSystemUnit,
  multiverseMarketSystemUnit
}) {
  return {
    tokenShop: {
      rows: {
        extract: tokenShopSystemUnit?.sections?.rows?.extract?.data ?? null,
        canonical: tokenShopSystemUnit?.sections?.rows?.canonical?.data ?? null,
        boundaries: {
          save: tokenShopSystemUnit?.sections?.rows?.boundaries?.save?.data ?? null,
          remap: tokenShopSystemUnit?.sections?.rows?.boundaries?.remap?.data ?? null,
          owner: tokenShopSystemUnit?.sections?.rows?.boundaries?.owner?.data ?? null,
          lateAtu: tokenShopSystemUnit?.sections?.rows?.boundaries?.lateAtu?.data ?? null
        }
      },
      tokenBank: {
        namingClues: tokenShopSystemUnit?.sections?.tokenBank?.namingClues?.data ?? null,
        stateClues: tokenShopSystemUnit?.sections?.tokenBank?.stateClues?.data ?? null,
        formulaBoundary: tokenShopSystemUnit?.sections?.tokenBank?.formulaBoundary?.data ?? null,
        ownerShell: tokenShopSystemUnit?.sections?.tokenBank?.ownerShell?.data ?? null,
        controllerShell: tokenShopSystemUnit?.sections?.tokenBank?.controllerShell?.data ?? null
      },
      dailyTokenium: {
        laneClues: tokenShopSystemUnit?.sections?.dailyTokenium?.laneClues?.data ?? null
      },
      spendLanes: {
        costLanes: tokenShopSystemUnit?.sections?.spendLanes?.costLanes?.data ?? null,
        actionLaneClues:
          tokenShopSystemUnit?.sections?.spendLanes?.actionLaneClues?.data ?? null
      },
      traceRuns: tokenShopSystemUnit?.sections?.traceRuns ?? {}
    },
    multiverseMarket: {
      saveOwner: {
        extract: multiverseMarketSystemUnit?.sections?.saveOwner?.extract?.data ?? null,
        marketMemberBoundary:
          multiverseMarketSystemUnit?.sections?.saveOwner?.marketMemberBoundary?.data ?? null,
        saveBoundary: multiverseMarketSystemUnit?.sections?.saveOwner?.saveBoundary?.data ?? null,
        traceBoundary:
          multiverseMarketSystemUnit?.sections?.saveOwner?.traceBoundary?.data ?? null
      },
      rowIdentity: {
        metadataNeighborhood:
          multiverseMarketSystemUnit?.sections?.rowIdentity?.metadataNeighborhood?.data ?? null,
        rangeBoundary:
          multiverseMarketSystemUnit?.sections?.rowIdentity?.rangeBoundary?.data ?? null,
        rowTextCoverage:
          multiverseMarketSystemUnit?.sections?.rowIdentity?.rowTextCoverage?.data ?? null,
        prefabRemapBoundary:
          multiverseMarketSystemUnit?.sections?.rowIdentity?.prefabRemapBoundary?.data ?? null
      },
      uiShell: {
        actionShell: multiverseMarketSystemUnit?.sections?.uiShell?.actionShell?.data ?? null,
        ownerFamily: multiverseMarketSystemUnit?.sections?.uiShell?.ownerFamily?.data ?? null
      }
    }
  };
}
