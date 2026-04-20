// Legacy raw-contract compatibility only.
// Active helpers/runtime code should consume canonical v2 boundary contracts directly.

function getRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getBoundaryEvidence(boundary) {
  const boundaryEvidence = getRecord(boundary?.boundaryEvidence);
  if (Object.keys(boundaryEvidence).length) {
    return boundaryEvidence;
  }
  return getRecord(boundary?.probeResults);
}

export function normalizeShardSaveBoundary(boundary) {
  const normalized = getRecord(boundary);
  const sources = getRecord(normalized.sources);
  const boundaryEvidence = getBoundaryEvidence(normalized);
  return {
    ...normalized,
    sources: {
      ...sources,
      ownedStateTargetBundle:
        sources.ownedStateTargetBundle || sources.ownedStateTraceRun || ""
    },
    boundaryEvidence: {
      metadataNeighborhoodHasSaveTerms:
        boundaryEvidence.metadataNeighborhoodHasSaveTerms === true,
      level0HasSaveTerms: boundaryEvidence.level0HasSaveTerms === true,
      ownerShellWithSaveOverlapCount: Number(boundaryEvidence.ownerShellWithSaveOverlapCount || 0),
      directShardPlayerProfileContext:
        boundaryEvidence.directShardPlayerProfileContext === true,
      declaringRowModelRecovered: boundaryEvidence.declaringRowModelRecovered === true,
      directSerializedRowDefinitionRecovered:
        boundaryEvidence.directSerializedRowDefinitionRecovered === true,
      runtimeOwnedStateShellRecovered: boundaryEvidence.runtimeOwnedStateShellRecovered === true,
      ownedStateTargetRecovered:
        boundaryEvidence.ownedStateTargetRecovered === true ||
        boundaryEvidence.traceRegistryHasOwnedStateTarget === true,
      ownedStatePopulationBridgeRecovered:
        boundaryEvidence.ownedStatePopulationBridgeRecovered === true ||
        boundaryEvidence.traceWorkflowHasOwnedStatePopulationBridge === true,
      ownedStateOutcomeKind:
        boundaryEvidence.ownedStateOutcomeKind ||
        boundaryEvidence.traceOwnedStateOutcomeKind ||
        "non-local-injection-seam",
      ownedStateOutcomeLabel:
        boundaryEvidence.ownedStateOutcomeLabel || boundaryEvidence.traceOwnedStateOutcomeLabel || "",
      deeperWrapperHandoffRecovered:
        boundaryEvidence.deeperWrapperHandoffRecovered === true ||
        boundaryEvidence.traceHasDeeperWrapperHandoff === true,
      nonLocalInjectionSeamRecovered:
        boundaryEvidence.nonLocalInjectionSeamRecovered === true ||
        boundaryEvidence.traceHasNonLocalInjectionSeam === true,
      runtimePopulationLocalProducerRecovered:
        boundaryEvidence.runtimePopulationLocalProducerRecovered === true,
      saveSideOwnerRecovered: boundaryEvidence.saveSideOwnerRecovered === true
    }
  };
}

export function normalizeShardMilestoneSaveOwnerCandidates(candidates) {
  const normalized = getRecord(candidates);
  const sources = getRecord(normalized.sources);
  const checkedOverlapStatistics = getRecord(normalized.checkedOverlapStatistics);
  return {
    ...normalized,
    sources: {
      ...sources,
      ownedStateTargetBundle:
        sources.ownedStateTargetBundle || sources.ownedStateTraceRun || ""
    },
    checkedOverlapStatistics: {
      ...checkedOverlapStatistics,
      ownedStatePopulationBridgeRecovered:
        checkedOverlapStatistics.ownedStatePopulationBridgeRecovered === true ||
        checkedOverlapStatistics.traceWorkflowHasOwnedStatePopulationBridge === true,
      ownedStateOutcomeKind:
        checkedOverlapStatistics.ownedStateOutcomeKind ||
        checkedOverlapStatistics.traceOwnedStateOutcomeKind ||
        "non-local-injection-seam"
    }
  };
}

export function normalizeShardMilestoneHandoffBoundary(boundary) {
  const normalized = getRecord(boundary);
  const sources = getRecord(normalized.sources);
  return {
    ...normalized,
    sources: {
      ...sources,
      ownedStateTargetBundle:
        sources.ownedStateTargetBundle || sources.ownedStateTraceRun || ""
    }
  };
}

export function normalizeTokenShopSaveBoundary(boundary) {
  const normalized = getRecord(boundary);
  const boundaryEvidence = getBoundaryEvidence(normalized);
  return {
    ...normalized,
    boundaryEvidence: {
      metadataHasSaveTerms: boundaryEvidence.metadataHasSaveTerms === true,
      level0HasSaveTerms: boundaryEvidence.level0HasSaveTerms === true,
      ownerShellWithSaveOverlapCount: Number(boundaryEvidence.ownerShellWithSaveOverlapCount || 0),
      directTokenShopPlayerProfileContext:
        boundaryEvidence.directTokenShopPlayerProfileContext === true
    }
  };
}

export function normalizeMultiverseMarketSaveBoundary(boundary) {
  const normalized = getRecord(boundary);
  const boundaryEvidence = getBoundaryEvidence(normalized);
  return {
    ...normalized,
    boundaryEvidence: {
      actionShellWithSaveOverlapCount: Number(
        boundaryEvidence.actionShellWithSaveOverlapCount || 0
      ),
      metadataNeighborhoodHasActionTerms:
        boundaryEvidence.metadataNeighborhoodHasActionTerms === true,
      metadataNeighborhoodHasSaveTerms:
        boundaryEvidence.metadataNeighborhoodHasSaveTerms === true,
      metadataDirectCheckHasSaveTerms:
        boundaryEvidence.metadataDirectCheckHasSaveTerms === true ||
        boundaryEvidence.metadataProbeHasSaveTerms === true,
      level0DirectCheckHasSaveTerms:
        boundaryEvidence.level0DirectCheckHasSaveTerms === true ||
        boundaryEvidence.level0ProbeHasSaveTerms === true
    }
  };
}
