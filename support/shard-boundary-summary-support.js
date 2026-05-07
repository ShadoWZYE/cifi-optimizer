import {
  composeDbCoverageSource,
  getDbSystemBoundaryEntry,
  getDbSystemCoverageSummary,
  getDbSystemGenericSubjectSummary,
  getDbSystemSubjectMetadataEntry,
  getDbSystemSubjectMetadataEntries
} from "./db-system-bundle.js";

function getShardSubjectMetadata(shardSystemOrBoundary) {
  return getDbSystemSubjectMetadataEntries(shardSystemOrBoundary);
}

function getShardGenericSubjectSummary(shardSystemOrBoundary, expectedSubjectId) {
  return getDbSystemGenericSubjectSummary(shardSystemOrBoundary, expectedSubjectId);
}

function getShardCompatibilityBoundary(shardSystemOrBoundary, boundaryKey) {
  return (
    shardSystemOrBoundary?.family?.compatibilityBoundaries?.[boundaryKey] ??
    shardSystemOrBoundary?.family?.boundaries?.[boundaryKey] ??
    shardSystemOrBoundary
  );
}

function markLegacyShardCompatibilityFallback(summary, fallbackMode) {
  return {
    ...summary,
    coverageSource: "compatibility-boundary-export",
    fallbackMode,
    usesLegacyCompatibilityFallback: true
  };
}

function getShardGenericCoverageSummary(shardSystemOrBoundary) {
  const genericCoverage = getDbSystemCoverageSummary(shardSystemOrBoundary, {
    subjectFilter: (subjectId) =>
      subjectId === "family-graph:shards-owner-family" ||
      subjectId === "family-graph:shards-finalsu-bonus" ||
      subjectId === "family-graph:shards-milestone-title-effect" ||
      subjectId === "family-graph:shards-effect-text-handler" ||
      subjectId === "family-graph:shards-milestone-payload" ||
      subjectId === "family-graph:shards-milestone-row-model" ||
      subjectId === "family-graph:shards-milestone-row-shell" ||
      subjectId === "family-graph:shards-milestone-row-alignment" ||
      subjectId === "shard-cost-su0-structure" ||
      subjectId === "shard-owned-state-upgradeinfolist-population"
  });
  return {
    hasCoverage: genericCoverage.hasCoverage,
    subjectLabels: genericCoverage.subjectLabels,
    nextSeamIds: genericCoverage.nextSeamIds,
    boundaryCount: genericCoverage.boundaryCount || 0,
    factCount: genericCoverage.genericFactCount,
    gapCount: genericCoverage.genericGapCount,
    hasOwnerFamilyBoundary: genericCoverage.subjectLabels.includes("family-graph:shards-owner-family"),
    hasFinalSuBoundary: genericCoverage.subjectLabels.includes("family-graph:shards-finalsu-bonus"),
    hasTitleEffectBoundary: genericCoverage.subjectLabels.includes(
      "family-graph:shards-milestone-title-effect"
    ),
    hasEffectTextBoundary: genericCoverage.subjectLabels.includes(
      "family-graph:shards-effect-text-handler"
    ),
    hasMilestonePayloadBoundary: genericCoverage.subjectLabels.includes(
      "family-graph:shards-milestone-payload"
    ),
    hasRowModelBoundary: genericCoverage.subjectLabels.includes(
      "family-graph:shards-milestone-row-model"
    ),
    hasRowShellBoundary: genericCoverage.subjectLabels.includes(
      "family-graph:shards-milestone-row-shell"
    ),
    hasRowAlignmentBoundary: genericCoverage.subjectLabels.includes(
      "family-graph:shards-milestone-row-alignment"
    ),
    hasCostBoundary: genericCoverage.subjectLabels.includes("shard-cost-su0-structure"),
    hasOwnedStateBoundary: genericCoverage.subjectLabels.includes(
      "shard-owned-state-upgradeinfolist-population"
    )
  };
}

export function getShardDbCoverageSummary(shardSystemOrBoundary) {
  const entries = getShardSubjectMetadata(shardSystemOrBoundary);
  const genericCoverage = getShardGenericCoverageSummary(shardSystemOrBoundary);
  const costSubject = getDbSystemSubjectMetadataEntry(
    shardSystemOrBoundary,
    "shard-cost-su0-structure"
  );
  const ownedStateSubject = getDbSystemSubjectMetadataEntry(
    shardSystemOrBoundary,
    "shard-owned-state-upgradeinfolist-population"
  );
  const nextSeamIds = [
    costSubject?.nextSeam?.id || null,
    ownedStateSubject?.nextSeam?.id || null
  ].filter(Boolean);
  const metadataLabels = entries
    .map((entry) => (typeof entry?.subjectId === "string" ? entry.subjectId : null))
    .filter(Boolean);
  const mergedLabels = [...new Set([...genericCoverage.subjectLabels, ...metadataLabels])];
  const mergedSeams = [...new Set([...genericCoverage.nextSeamIds, ...nextSeamIds])];
  return {
    hasCoverage: genericCoverage.hasCoverage || entries.length > 0,
    coverageSource: composeDbCoverageSource({
      hasGenericMechanics: genericCoverage.hasCoverage,
      hasBoundaryModel: genericCoverage.boundaryCount > 0,
      hasSubjectMetadata: entries.length > 0
    }),
    subjectCount: mergedLabels.length,
    subjectLabels: mergedLabels,
    ownerFamilySubjectId: genericCoverage.hasOwnerFamilyBoundary
      ? "family-graph:shards-owner-family"
      : null,
    costSubjectId: costSubject?.subjectId || null,
    ownedStateSubjectId: ownedStateSubject?.subjectId || null,
    genericFactCount: genericCoverage.factCount || 0,
    genericGapCount: genericCoverage.gapCount || 0,
    nextSeamIds: mergedSeams,
    nextSeamLabel: mergedSeams.join(", "),
    hasCostBoundary: genericCoverage.hasCostBoundary || Boolean(costSubject),
    hasOwnedStateBoundary: genericCoverage.hasOwnedStateBoundary || Boolean(ownedStateSubject)
  };
}

export function getShardOwnerFamilyBoundarySummary(boundary) {
  const compatibilityBoundary =
    boundary?.family?.compatibilityBoundaries?.ownerFamily ??
    boundary?.family?.boundaries?.ownerFamily ??
    boundary;
  const inferredBoundary = getDbSystemBoundaryEntry(
    boundary,
    "family-graph:shards-owner-family",
    "subject-boundary"
  );
  const genericSubject = getShardGenericSubjectSummary(boundary, "family-graph:shards-owner-family");
  if (inferredBoundary || genericSubject) {
    const factsByKind = genericSubject?.factsByKind || {};
    const screenControllers = Array.isArray(factsByKind["screen-controller-family"])
      ? factsByKind["screen-controller-family"]
      : [];
    const dataCarriers = Array.isArray(factsByKind["data-carrier-candidate"])
      ? factsByKind["data-carrier-candidate"]
      : [];
    const runtimeShells = Array.isArray(factsByKind["runtime-shell"])
      ? factsByKind["runtime-shell"]
      : [];
    const ownerFields = Array.isArray(factsByKind["owner-field"]) ? factsByKind["owner-field"] : [];
    const rowModelTypes = Array.isArray(factsByKind["row-model-type"])
      ? factsByKind["row-model-type"]
      : [];
    const rowStateFields = Array.isArray(factsByKind["row-state-field"])
      ? factsByKind["row-state-field"]
      : [];
    const supportingEdges = Array.isArray(factsByKind["supporting-edge-type"])
      ? factsByKind["supporting-edge-type"]
      : [];
    const blockedEdges = Array.isArray(factsByKind["blocked-edge-type"])
      ? factsByKind["blocked-edge-type"]
      : [];
    const groundedConclusions = Array.isArray(factsByKind["grounded-conclusion"])
      ? factsByKind["grounded-conclusion"]
      : [];
    const outcomeStatements = Array.isArray(factsByKind["outcome-statement"])
      ? factsByKind["outcome-statement"]
      : [];
    const sourceTraceScopes = Array.isArray(factsByKind["source-trace-scope"])
      ? factsByKind["source-trace-scope"]
      : [];
    const sourceSubjectIds = Array.isArray(factsByKind["source-subject-id"])
      ? factsByKind["source-subject-id"]
      : [];
    return {
      hasBoundary: screenControllers.length > 0 && dataCarriers.length > 0 && runtimeShells.length > 0,
      hasStructure: runtimeShells.length > 0 && ownerFields.length > 0 && rowModelTypes.length > 0,
      hasRowStateFields: rowStateFields.length > 0,
      hasSupportingEdges: supportingEdges.length > 0,
      hasBlockedEdges: blockedEdges.length > 0,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericSubject),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: false
      }),
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      screenController: screenControllers[0] || "ShardMining",
      dataCarrier:
        dataCarriers.find((value) => value.includes("|")) ||
        dataCarriers[0] ||
        "ShardMining|ShardUpgradeInfo",
      runtimeShell: runtimeShells[0] || null,
      ownerField: ownerFields[0] || null,
      rowModelType: rowModelTypes[0] || null,
      rowStateFieldLabel: rowStateFields.slice(0, 5).join(", "),
      supportingEdgeLabel: supportingEdges.join(", "),
      blockedEdgeLabel: blockedEdges.join(", "),
      groundedConclusion: groundedConclusions[0] || null,
      outcomeStatement: outcomeStatements[0] || null,
      sourceTraceScope:
        String(inferredBoundary?.sourceTraceScope || "").trim() ||
        sourceTraceScopes[0] ||
        null,
      sourceSubjectId:
        String(inferredBoundary?.sourceSubjectId || "").trim() ||
        sourceSubjectIds[0] ||
        null,
      nextSeamId: String(inferredBoundary?.nextSeamId || "").trim() || null,
      blockedInputReason:
        String(inferredBoundary?.blockedInputReason || "").trim() || null,
      subjectId: String(inferredBoundary?.subjectId || genericSubject?.subjectId || "").trim() || null,
      genericFactCount: Number(inferredBoundary?.genericFactCount || 0) || genericSubject?.factCount || 0,
      genericGapCount: Number(inferredBoundary?.genericGapCount || 0) || genericSubject?.gapCount || 0
    };
  }
  const screenControllers = Array.isArray(compatibilityBoundary?.screenControllerFamilies)
    ? compatibilityBoundary.screenControllerFamilies
    : [];
  const dataCarriers = Array.isArray(compatibilityBoundary?.dataCarrierCandidates)
    ? compatibilityBoundary.dataCarrierCandidates
    : [];
  const fastBuyHooks = Array.isArray(compatibilityBoundary?.screenControlAnchors)
    ? compatibilityBoundary.screenControlAnchors
    : [];
  const bonusAnchors = Array.isArray(compatibilityBoundary?.bonusFieldAnchors)
    ? compatibilityBoundary.bonusFieldAnchors
    : [];
  const genericLead = compatibilityBoundary?.downgradedGenericLead ?? {};
  const genericLeadReasons = Array.isArray(genericLead.reasons) ? genericLead.reasons : [];
  return markLegacyShardCompatibilityFallback({
    hasBoundary:
      screenControllers.includes("ShardMining, Assembly-CSharp") &&
      dataCarriers.includes("ShardMining|ShardUpgradeInfo"),
    hasFastBuyHooks: [
      "CheckFirstTimeShardMilestoneOpened",
      "AttachFastBuyButton",
      "FastBuyButtonMethodShards",
      "StartFastBuyButtonHold"
    ].every((name) => fastBuyHooks.includes(name)),
    hasBonusAnchors: [
      "TotalMilestoneLevels",
      "get_IsUnlocked",
      "FinalSU1Bonus1",
      "FinalSU29Bonus2",
      "FinalSU29Bonus3"
    ].every((name) => bonusAnchors.includes(name)),
    hasDowngradedGenericLead:
      genericLead.family === "ConstructionMilestones, Assembly-CSharp" &&
      genericLeadReasons.length > 0,
    screenController: screenControllers[0] || "ShardMining, Assembly-CSharp",
    dataCarrier: dataCarriers[0] || "ShardMining|ShardUpgradeInfo",
    fastBuyHooksLabel: fastBuyHooks.slice(0, 4).join(", "),
    bonusAnchorLabel: bonusAnchors
      .filter((name) =>
        [
          "TotalMilestoneLevels",
          "get_IsUnlocked",
          "FinalSU1Bonus1",
          "FinalSU29Bonus2",
          "FinalSU29Bonus3"
        ].includes(name)
      )
      .join(", "),
    genericLead: genericLead.family || "ConstructionMilestones, Assembly-CSharp",
    genericLeadReason:
      genericLeadReasons[0] || "its current evidence is still generic rather than shard-specific"
  }, "compatibility-owner-family");
}

export function getShardFinalSuBonusBoundarySummary(boundary) {
  const compatibilityBoundary = getShardCompatibilityBoundary(boundary, "finalSuBonus");
  const inferredBoundary = getDbSystemBoundaryEntry(
    boundary,
    "family-graph:shards-finalsu-bonus",
    "subject-boundary"
  );
  const genericSubject = getShardGenericSubjectSummary(boundary, "family-graph:shards-finalsu-bonus");
  if (inferredBoundary || genericSubject) {
    const factsByKind = genericSubject?.factsByKind || {};
    const dataCarriers = Array.isArray(factsByKind["data-carrier-candidate"])
      ? factsByKind["data-carrier-candidate"]
      : [];
    const unlockRequirementAccessors = Array.isArray(factsByKind["unlock-requirement-accessor"])
      ? factsByKind["unlock-requirement-accessor"]
      : [];
    const bonusFieldSamples = Array.isArray(factsByKind["bonus-field-sample"])
      ? factsByKind["bonus-field-sample"]
      : [];
    const bonusAccessorSamples = Array.isArray(factsByKind["bonus-accessor-sample"])
      ? factsByKind["bonus-accessor-sample"]
      : [];
    const adjacentFields = Array.isArray(factsByKind["adjacent-field"])
      ? factsByKind["adjacent-field"]
      : [];
    return {
      hasBoundary:
        dataCarriers.length > 0 &&
        unlockRequirementAccessors.length > 0 &&
        bonusFieldSamples.length > 0,
      hasAdjacentFields: adjacentFields.length > 0,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericSubject),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: false
      }),
      dataCarrier:
        dataCarriers.find((value) => value.includes("|")) ||
        dataCarriers[0] ||
        "ShardMining|ShardUpgradeInfo",
      unlockRangeLabel: unlockRequirementAccessors.join(", "),
      bonusFieldLabel: bonusFieldSamples.join(", "),
      bonusAccessorLabel: bonusAccessorSamples.join(", "),
      adjacentFieldLabel: adjacentFields.join(", "),
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      subjectId: String(inferredBoundary?.subjectId || genericSubject?.subjectId || "").trim() || null,
      blockedInputReason:
        String(inferredBoundary?.blockedInputReason || "").trim() || null,
      nextSeamId: String(inferredBoundary?.nextSeamId || "").trim() || null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericSubject?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericSubject?.gapCount || 0
    };
  }
  const unlockRequirementAccessors = Array.isArray(compatibilityBoundary?.unlockRequirementAccessors)
    ? compatibilityBoundary.unlockRequirementAccessors
    : [];
  const bonusFieldSamples = Array.isArray(compatibilityBoundary?.bonusFieldSamples)
    ? compatibilityBoundary.bonusFieldSamples
    : [];
  const bonusAccessorSamples = Array.isArray(compatibilityBoundary?.bonusAccessorSamples)
    ? compatibilityBoundary.bonusAccessorSamples
    : [];
  const adjacentFields = Array.isArray(compatibilityBoundary?.adjacentFields)
    ? compatibilityBoundary.adjacentFields
    : [];
  return markLegacyShardCompatibilityFallback({
    hasBoundary:
      compatibilityBoundary?.dataCarrier === "ShardUpgradeInfo" &&
      compatibilityBoundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo" &&
      ["get_SU1FinalUnlockReq", "get_SU29FinalUnlockReq"].every((name) =>
        unlockRequirementAccessors.includes(name)
      ) &&
      ["FinalSU1Bonus1", "FinalSU29Bonus2", "FinalSU29Bonus3"].every((name) =>
        bonusFieldSamples.includes(name)
      ) &&
      ["get_FinalSU1Bonus1", "get_FinalSU29Bonus2", "get_FinalSU29Bonus3"].every((name) =>
        bonusAccessorSamples.includes(name)
      ),
    hasAdjacentFields: [
      "TotalMilestoneLevels",
      "get_IsUnlocked",
      "OverLevel100Exponent",
      "OverLevel400Exponent",
      "<FastBuyEnum>d__1429"
    ].every((name) => adjacentFields.includes(name)),
    dataCarrier: compatibilityBoundary?.dataCarrier || "ShardUpgradeInfo",
    unlockRangeLabel: unlockRequirementAccessors.join(", "),
    bonusFieldLabel: bonusFieldSamples.join(", "),
    bonusAccessorLabel: bonusAccessorSamples.join(", "),
    adjacentFieldLabel: adjacentFields.join(", ")
  }, "compatibility-finalsu-bonus");
}

export function getShardMilestonePayloadBoundarySummary(boundary) {
  const compatibilityBoundary = getShardCompatibilityBoundary(boundary, "milestonePayload");
  const inferredBoundary = getDbSystemBoundaryEntry(
    boundary,
    "family-graph:shards-milestone-payload",
    "subject-boundary"
  );
  const genericSubject = getShardGenericSubjectSummary(
    boundary,
    "family-graph:shards-milestone-payload"
  );
  if (inferredBoundary || genericSubject) {
    const factsByKind = genericSubject?.factsByKind || {};
    const dataCarriers = Array.isArray(factsByKind["data-carrier-candidate"])
      ? factsByKind["data-carrier-candidate"]
      : [];
    const rowStateFields = Array.isArray(factsByKind["row-state-field"])
      ? factsByKind["row-state-field"]
      : [];
    const payloadHooks = Array.isArray(factsByKind["milestone-payload-hook"])
      ? factsByKind["milestone-payload-hook"]
      : [];
    const progressHooks = Array.isArray(factsByKind["progress-hook"])
      ? factsByKind["progress-hook"]
      : [];
    const costAccessors = Array.isArray(factsByKind["cost-accessor"])
      ? factsByKind["cost-accessor"]
      : [];
    const parameterShellFields = Array.isArray(factsByKind["parameter-shell-field"])
      ? factsByKind["parameter-shell-field"]
      : [];
    const saveCandidates = Array.isArray(factsByKind["save-candidate"])
      ? factsByKind["save-candidate"]
      : [];
    return {
      hasBoundary: dataCarriers.length > 0 && rowStateFields.length > 0,
      hasCostAndListHooks: payloadHooks.length > 0,
      hasProgressFillHooks: progressHooks.length > 0,
      hasTickFields: false,
      hasCostAccessorSamples: costAccessors.length > 0,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericSubject),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: false
      }),
      dataCarrier:
        dataCarriers.find((value) => value.includes("|")) ||
        dataCarriers[0] ||
        "ShardMining|ShardUpgradeInfo",
      milestoneStateLabel: rowStateFields.join(", "),
      costHookLabel: payloadHooks.join(", "),
      progressHookLabel: progressHooks.join(", "),
      tickFieldLabel: "",
      costAccessorLabel: costAccessors.join(", "),
      rowParameterLabel: parameterShellFields.join(", "),
      saveCandidateLabel: saveCandidates.join(", "),
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      subjectId: String(inferredBoundary?.subjectId || genericSubject?.subjectId || "").trim() || null,
      blockedInputReason:
        String(inferredBoundary?.blockedInputReason || "").trim() || null,
      nextSeamId: String(inferredBoundary?.nextSeamId || "").trim() || null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericSubject?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericSubject?.gapCount || 0
    };
  }
  const milestoneStateFields = Array.isArray(compatibilityBoundary?.milestoneStateFields)
    ? compatibilityBoundary.milestoneStateFields
    : [];
  const costAndListHooks = Array.isArray(compatibilityBoundary?.costAndListHooks)
    ? compatibilityBoundary.costAndListHooks
    : [];
  const progressFillHooks = Array.isArray(compatibilityBoundary?.progressFillHooks)
    ? compatibilityBoundary.progressFillHooks
    : [];
  const tickFields = Array.isArray(compatibilityBoundary?.tickFields)
    ? compatibilityBoundary.tickFields
    : [];
  const sampleCostAccessors = Array.isArray(compatibilityBoundary?.sampleCostAccessors)
    ? compatibilityBoundary.sampleCostAccessors
    : [];
  return markLegacyShardCompatibilityFallback({
    hasBoundary:
      compatibilityBoundary?.dataCarrier === "ShardUpgradeInfo" &&
      compatibilityBoundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo" &&
      [
        "TotalMilestoneLevels",
        "get_IsUnlocked",
        "set_IsUnlocked",
        "<IsUnlocked>k__BackingField"
      ].every((name) => milestoneStateFields.includes(name)),
    hasCostAndListHooks: [
      "get_TotalMilestoneLevels",
      "UpdateShardCostList",
      "GetShardCostList",
      "CountAffordableShard",
      "InitializeShards"
    ].every((name) => costAndListHooks.includes(name)),
    hasProgressFillHooks: [
      "CheckAllMilestoneLevelFills",
      "CheckMilestone0ProgressFill",
      "CheckMilestone1ProgressFill",
      "CheckMilestone9ProgressFill"
    ].every((name) => progressFillHooks.includes(name)),
    hasTickFields: ["Phase1Tick", "Phase6Tick", "CooldownTick"].every((name) =>
      tickFields.includes(name)
    ),
    hasCostAccessorSamples: ["get_SU23Cost", "get_SU29Cost"].every((name) =>
      sampleCostAccessors.includes(name)
    ),
    dataCarrier: compatibilityBoundary?.dataCarrier || "ShardUpgradeInfo",
    milestoneStateLabel: milestoneStateFields.join(", "),
    costHookLabel: costAndListHooks.join(", "),
    progressHookLabel: progressFillHooks.join(", "),
    tickFieldLabel: tickFields.join(", "),
    costAccessorLabel: sampleCostAccessors.join(", ")
  }, "compatibility-milestone-payload");
}

export function getShardCostModelBoundarySummary(boundary) {
  const compatibilityBoundary =
    boundary?.cost?.compatibilityBoundaries?.costModelBoundary ??
    boundary?.cost?.costModelBoundary ??
    boundary;
  const shardCostBoundary = getDbSystemBoundaryEntry(
    boundary,
    "shard-cost-su0-structure",
    "subject-boundary"
  );
  const shardCostMetadata = getDbSystemSubjectMetadataEntry(boundary, "shard-cost-su0-structure");
  const shardCostGeneric = getShardGenericSubjectSummary(boundary, "shard-cost-su0-structure");
  const shardCostOwnerType = String(
    shardCostGeneric?.factsByKind?.["owner-type"]?.[0] || "ShardUpgradeInfo"
  ).trim();
  const shardCostAccessor = String(
    shardCostGeneric?.factsByKind?.["cost-accessor"]?.[0] || "get_SU0Cost"
  ).trim();
  const shardParameterShell = Array.isArray(shardCostGeneric?.factsByKind?.["parameter-shell-field"])
    ? shardCostGeneric.factsByKind["parameter-shell-field"]
    : [];
  const costBoundaryPayload =
    shardCostBoundary && typeof shardCostBoundary === "object" ? shardCostBoundary : null;
  const knownEdges = Array.isArray(costBoundaryPayload?.knownEdges)
    ? costBoundaryPayload.knownEdges
    : Array.isArray(shardCostMetadata?.knownEdges)
      ? shardCostMetadata.knownEdges
      : [];
  const missingEdges = Array.isArray(costBoundaryPayload?.missingEdges)
    ? costBoundaryPayload.missingEdges
    : Array.isArray(shardCostMetadata?.missingEdges)
      ? shardCostMetadata.missingEdges
      : [];
  if (shardCostMetadata || shardCostBoundary) {
    const combinedNextSeamIds = [
      typeof costBoundaryPayload?.nextSeamId === "string" ? costBoundaryPayload.nextSeamId : null,
      typeof shardCostMetadata?.nextSeam?.id === "string" ? shardCostMetadata.nextSeam.id : null,
      ...(shardCostGeneric?.nextSeamIds ?? [])
    ].filter(Boolean);
    return {
      hasBoundary:
        knownEdges.includes("getter-family") &&
        knownEdges.includes("getter-to-parameter-shell"),
      hasSampledCostWindows: knownEdges.includes("getter-family"),
      hasRow0FormulaShell: knownEdges.includes("metadata-row0-parameter-shell"),
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(shardCostGeneric),
        hasBoundaryModel: Boolean(costBoundaryPayload),
        hasSubjectMetadata: true
      }),
      dataCarrier: shardCostOwnerType || "ShardUpgradeInfo",
      costWindowLabel: shardCostAccessor
        ? `${shardCostAccessor} through get_SU29Cost family shell`
        : "get_SU0Cost through get_SU29Cost family shell",
      row0FieldLabel:
        shardParameterShell.slice(0, 3).join(", ") || "SU0StartCost, SU0CostExponent, SU0GrowthExponent",
      row0FillLabel: "SU0Level1Fill through SU0Level8Fill",
      row0BonusLabel: "SU0Bonus1 through SU0Bonus8",
      supportedOptimizerLabel: knownEdges.includes("deterministic-evaluator")
        ? "deterministic-evaluator"
        : "optimizer-surface-unavailable",
      blockedOptimizerLabel: missingEdges.join(", "),
      boundaryVerdict: String(costBoundaryPayload?.verdict || "").trim() || null,
      subjectId: shardCostMetadata?.subjectId || costBoundaryPayload?.subjectId || null,
      subjectKind: shardCostMetadata?.subjectKind || costBoundaryPayload?.subjectKind || null,
      blockedInputReason:
        typeof costBoundaryPayload?.blockedInputReason === "string"
          ? costBoundaryPayload.blockedInputReason
          : typeof shardCostMetadata?.blockedInputReason === "string"
          ? shardCostMetadata.blockedInputReason
          : null,
      nextSeamId: combinedNextSeamIds[0] || null,
      genericFactCount:
        Number(costBoundaryPayload?.genericFactCount || 0) || shardCostGeneric?.factCount || 0,
      genericGapCount:
        Number(costBoundaryPayload?.genericGapCount || 0) || shardCostGeneric?.gapCount || 0
    };
  }
  const sampleCostAccessorWindows = Array.isArray(compatibilityBoundary?.sampleCostAccessorWindows)
    ? compatibilityBoundary.sampleCostAccessorWindows
    : [];
  const row0CostFields = Array.isArray(compatibilityBoundary?.row0CostFields)
    ? compatibilityBoundary.row0CostFields
    : [];
  const row0FillFields = Array.isArray(compatibilityBoundary?.row0FillFields)
    ? compatibilityBoundary.row0FillFields
    : [];
  const row0BonusFields = Array.isArray(compatibilityBoundary?.row0BonusFields)
    ? compatibilityBoundary.row0BonusFields
    : [];
  const optimizerBoundary =
    typeof compatibilityBoundary?.optimizerBoundary === "object" && compatibilityBoundary.optimizerBoundary
      ? compatibilityBoundary.optimizerBoundary
      : {};
  const supportedNow = Array.isArray(optimizerBoundary.supportedNow)
    ? optimizerBoundary.supportedNow
    : [];
  const blockedNow = Array.isArray(optimizerBoundary.blockedNow)
    ? optimizerBoundary.blockedNow
    : [];
  const earlyWindow =
    sampleCostAccessorWindows.find((window) => window?.label === "earlyWindow") || {};
  const lateWindow =
    sampleCostAccessorWindows.find((window) => window?.label === "lateWindow") || {};
  const earlyAccessors = Array.isArray(earlyWindow.accessors) ? earlyWindow.accessors : [];
  const lateAccessors = Array.isArray(lateWindow.accessors) ? lateWindow.accessors : [];
  return markLegacyShardCompatibilityFallback({
    hasBoundary:
      compatibilityBoundary?.dataCarrier === "ShardUpgradeInfo" &&
      compatibilityBoundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo",
    hasSampledCostWindows:
      earlyWindow.start === 0 &&
      earlyWindow.end === 9 &&
      earlyWindow.count === 10 &&
      ["get_SU0Cost", "get_SU9Cost"].every((name) => earlyAccessors.includes(name)) &&
      lateWindow.start === 23 &&
      lateWindow.end === 29 &&
      lateWindow.count === 7 &&
      ["get_SU23Cost", "get_SU29Cost"].every((name) => lateAccessors.includes(name)),
    hasRow0FormulaShell:
      [
        "SU0StartCost",
        "SU0CostExponent",
        "SU0GrowthExponent",
        "SU0GrowthExponent2",
        "SU0GrowthExponent3"
      ].every((name) => row0CostFields.includes(name)) &&
      ["SU0Level1Fill", "SU0Level8Fill"].every((name) => row0FillFields.includes(name)) &&
      ["SU0Bonus1", "SU0Bonus8"].every((name) => row0BonusFields.includes(name)),
    dataCarrier: compatibilityBoundary?.dataCarrier || "ShardUpgradeInfo",
    costWindowLabel: [earlyAccessors.join(", "), lateAccessors.join(", ")]
      .filter(Boolean)
      .join(" | "),
    row0FieldLabel: row0CostFields.join(", "),
    row0FillLabel: row0FillFields.join(", "),
    row0BonusLabel: row0BonusFields.join(", "),
    supportedOptimizerLabel: supportedNow.join(", "),
    blockedOptimizerLabel: blockedNow.join(", ")
  }, "compatibility-cost-model");
}

export function getShardMilestoneRowModelBoundarySummary(boundary) {
  const compatibilityBoundary = getShardCompatibilityBoundary(boundary, "rowModel");
  const inferredBoundary = getDbSystemBoundaryEntry(
    boundary,
    "family-graph:shards-milestone-row-model",
    "subject-boundary"
  );
  const genericSubject = getShardGenericSubjectSummary(
    boundary,
    "family-graph:shards-milestone-row-model"
  );
  if (inferredBoundary || genericSubject) {
    const factsByKind = genericSubject?.factsByKind || {};
    const dataCarriers = Array.isArray(factsByKind["data-carrier-candidate"])
      ? factsByKind["data-carrier-candidate"]
      : [];
    const runtimeShells = Array.isArray(factsByKind["runtime-shell"])
      ? factsByKind["runtime-shell"]
      : [];
    const rowModelTypes = Array.isArray(factsByKind["row-model-type"])
      ? factsByKind["row-model-type"]
      : [];
    const genericBuyFamilies = Array.isArray(factsByKind["generic-buy-family"])
      ? factsByKind["generic-buy-family"]
      : [];
    return {
      hasBoundary: dataCarriers.length > 0 && runtimeShells.length > 0 && rowModelTypes.length > 0,
      hasShardLocalBuySample: false,
      hasGenericBuyFamily: genericBuyFamilies.length > 0,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericSubject),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: false
      }),
      textCheckerRangeLabel: "unrecovered",
      unlockRangeLabel: "unrecovered",
      shardLocalBuyLabel: "",
      genericBuyLabel: genericBuyFamilies.join(", "),
      runtimeShell: runtimeShells[0] || null,
      rowModelType: rowModelTypes[0] || null,
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      subjectId: String(inferredBoundary?.subjectId || genericSubject?.subjectId || "").trim() || null,
      blockedInputReason:
        String(inferredBoundary?.blockedInputReason || "").trim() || null,
      nextSeamId: String(inferredBoundary?.nextSeamId || "").trim() || null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericSubject?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericSubject?.gapCount || 0
    };
  }
  const textCheckerRange =
    typeof compatibilityBoundary?.textCheckerRange === "object" && compatibilityBoundary.textCheckerRange
      ? compatibilityBoundary.textCheckerRange
      : {};
  const unlockRequirementRange =
    typeof compatibilityBoundary?.unlockRequirementRange === "object" && compatibilityBoundary.unlockRequirementRange
      ? compatibilityBoundary.unlockRequirementRange
      : {};
  const buyHookEvidence =
    typeof compatibilityBoundary?.buyHookEvidence === "object" && compatibilityBoundary.buyHookEvidence
      ? compatibilityBoundary.buyHookEvidence
      : {};
  const shardLocalDirectHooks = Array.isArray(buyHookEvidence.shardLocalDirectHooks)
    ? buyHookEvidence.shardLocalDirectHooks
    : [];
  const genericNumberedFamily =
    typeof buyHookEvidence.genericNumberedFamily === "object" &&
    buyHookEvidence.genericNumberedFamily
      ? buyHookEvidence.genericNumberedFamily
      : {};
  return markLegacyShardCompatibilityFallback({
    hasBoundary:
      compatibilityBoundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo" &&
      textCheckerRange.start === 0 &&
      textCheckerRange.end === 29 &&
      textCheckerRange.count === 30 &&
      unlockRequirementRange.start === 0 &&
      unlockRequirementRange.end === 29 &&
      unlockRequirementRange.count === 30,
    hasShardLocalBuySample: shardLocalDirectHooks.includes("BuyMilestone0"),
    hasGenericBuyFamily:
      genericNumberedFamily.family === "ConstructionMilestones, Assembly-CSharp" &&
      genericNumberedFamily.start === 1 &&
      genericNumberedFamily.end === 57 &&
      genericNumberedFamily.count === 57,
    textCheckerRangeLabel: `${textCheckerRange.start ?? "?"}-${textCheckerRange.end ?? "?"}`,
    unlockRangeLabel: `${unlockRequirementRange.start ?? "?"}-${unlockRequirementRange.end ?? "?"}`,
    shardLocalBuyLabel: shardLocalDirectHooks.join(", "),
    genericBuyLabel: `${genericNumberedFamily.family || "ConstructionMilestones, Assembly-CSharp"} ${genericNumberedFamily.start ?? "?"}-${genericNumberedFamily.end ?? "?"}`
  }, "compatibility-row-model");
}

export function getShardMilestoneTitleEffectBoundarySummary(boundary) {
  const compatibilityBoundary = getShardCompatibilityBoundary(boundary, "titleEffect");
  const inferredBoundary = getDbSystemBoundaryEntry(
    boundary,
    "family-graph:shards-milestone-title-effect",
    "subject-boundary"
  );
  const genericSubject = getShardGenericSubjectSummary(
    boundary,
    "family-graph:shards-milestone-title-effect"
  );
  if (inferredBoundary || genericSubject) {
    const factsByKind = genericSubject?.factsByKind || {};
    const titleAssetCandidates = Array.isArray(factsByKind["title-asset-candidate"])
      ? factsByKind["title-asset-candidate"]
      : [];
    const effectPresentationSlots = Array.isArray(factsByKind["effect-presentation-slot"])
      ? factsByKind["effect-presentation-slot"]
      : [];
    const sampleBonusCalcAccessors = Array.isArray(factsByKind["bonus-calc-accessor"])
      ? factsByKind["bonus-calc-accessor"]
      : [];
    return {
      hasBoundary: sampleBonusCalcAccessors.length > 0,
      hasEffectPresentationFamily: effectPresentationSlots.length > 0,
      hasBonusCalcSamples: sampleBonusCalcAccessors.length > 0,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericSubject),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: false
      }),
      titleRangeLabel: titleAssetCandidates.length ? titleAssetCandidates.join(", ") : "unrecovered",
      effectSlotLabel: effectPresentationSlots.join(", "),
      bonusCalcLabel: sampleBonusCalcAccessors.join(", "),
      row28ConflictLabel: "",
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      subjectId: String(inferredBoundary?.subjectId || genericSubject?.subjectId || "").trim() || null,
      blockedInputReason:
        String(inferredBoundary?.blockedInputReason || "").trim() || null,
      nextSeamId: String(inferredBoundary?.nextSeamId || "").trim() || null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericSubject?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericSubject?.gapCount || 0
    };
  }
  const titleAssetCandidates = Array.isArray(compatibilityBoundary?.titleAssetCandidates)
    ? compatibilityBoundary.titleAssetCandidates
    : [];
  const effectPresentationSlots = Array.isArray(compatibilityBoundary?.effectPresentationSlots)
    ? compatibilityBoundary.effectPresentationSlots
    : [];
  const sampleBonusCalcAccessors = Array.isArray(compatibilityBoundary?.sampleBonusCalcAccessors)
    ? compatibilityBoundary.sampleBonusCalcAccessors
    : [];
  const uniqueRows = [
    ...new Set(
      titleAssetCandidates.map((entry) => entry?.row).filter((value) => Number.isInteger(value))
    )
  ].sort((a, b) => a - b);
  const row28Candidates = titleAssetCandidates
    .filter((entry) => entry?.row === 28)
    .map((entry) => entry.title);
  return markLegacyShardCompatibilityFallback({
    hasBoundary: uniqueRows.includes(0) && uniqueRows.includes(29) && uniqueRows.includes(30),
    hasEffectPresentationFamily: ["ShardMilestoneBonus1", "ShardMilestoneBonus8"].every((name) =>
      effectPresentationSlots.includes(name)
    ),
    hasBonusCalcSamples: ["get_SU1Bonus1Calc", "get_SU5Bonus2Calc"].every((name) =>
      sampleBonusCalcAccessors.includes(name)
    ),
    titleRangeLabel: uniqueRows.length
      ? `${uniqueRows[0]}-${uniqueRows[uniqueRows.length - 1]}`
      : "unknown",
    effectSlotLabel: effectPresentationSlots.join(", "),
    bonusCalcLabel: sampleBonusCalcAccessors.join(", "),
    row28ConflictLabel: row28Candidates.join(", ")
  }, "compatibility-title-effect");
}

export function getShardEffectTextHandlerBoundarySummary(boundary) {
  const compatibilityBoundary = getShardCompatibilityBoundary(boundary, "effectTextHandler");
  const inferredBoundary = getDbSystemBoundaryEntry(
    boundary,
    "family-graph:shards-effect-text-handler",
    "subject-boundary"
  );
  const genericSubject = getShardGenericSubjectSummary(
    boundary,
    "family-graph:shards-effect-text-handler"
  );
  if (inferredBoundary || genericSubject) {
    const factsByKind = genericSubject?.factsByKind || {};
    const textHandlerTerms = Array.isArray(factsByKind["text-handler-term"])
      ? factsByKind["text-handler-term"]
      : [];
    const presentationFamily = Array.isArray(factsByKind["effect-presentation-slot"])
      ? factsByKind["effect-presentation-slot"]
      : [];
    const sampleBonusCalcAccessors = Array.isArray(factsByKind["bonus-calc-accessor"])
      ? factsByKind["bonus-calc-accessor"]
      : [];
    const uiContextAnchors = Array.isArray(factsByKind["ui-context-anchor"])
      ? factsByKind["ui-context-anchor"]
      : [];
    const genericWriterTerms = Array.isArray(factsByKind["generic-milestone-writer"])
      ? factsByKind["generic-milestone-writer"]
      : [];
    return {
      hasBoundary: genericWriterTerms.length > 0 && sampleBonusCalcAccessors.length > 0,
      hasPresentationFamily: presentationFamily.length > 0,
      hasBonusCalcSamples: sampleBonusCalcAccessors.length > 0,
      hasUiContextAnchors: uiContextAnchors.length > 0,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericSubject),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: false
      }),
      textHandlerLabel:
        textHandlerTerms[0] || "unrecovered-explicit-handler",
      genericWriterLabel: genericWriterTerms[0] || "SetAllMilestoneTexts",
      presentationFamilyLabel: presentationFamily.join(", "),
      bonusCalcLabel: sampleBonusCalcAccessors.join(", "),
      uiContextLabel: uiContextAnchors.join(", "),
      rowCoverageLabel: "quarantined-generic-writer-lane",
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      subjectId: String(inferredBoundary?.subjectId || genericSubject?.subjectId || "").trim() || null,
      blockedInputReason:
        String(inferredBoundary?.blockedInputReason || "").trim() || null,
      nextSeamId: String(inferredBoundary?.nextSeamId || "").trim() || null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericSubject?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericSubject?.gapCount || 0
    };
  }
  const presentationFamily = Array.isArray(compatibilityBoundary?.presentationFamily)
    ? compatibilityBoundary.presentationFamily
    : [];
  const sampleBonusCalcAccessors = Array.isArray(compatibilityBoundary?.sampleBonusCalcAccessors)
    ? compatibilityBoundary.sampleBonusCalcAccessors
    : [];
  const uiContextAnchors = Array.isArray(compatibilityBoundary?.uiContextAnchors)
    ? compatibilityBoundary.uiContextAnchors
    : [];
  const rowModelCoverage =
    typeof compatibilityBoundary?.rowModelCoverage === "object" && compatibilityBoundary?.rowModelCoverage
      ? compatibilityBoundary.rowModelCoverage
      : {};
  return markLegacyShardCompatibilityFallback({
    hasBoundary:
      compatibilityBoundary?.probableTextHandler === "TextHandlerShardMilestoneBonusesPerLevel/N" &&
      compatibilityBoundary?.genericMilestoneWriter === "SetAllMilestoneTexts" &&
      rowModelCoverage.start === 0 &&
      rowModelCoverage.end === 29 &&
      rowModelCoverage.count === 30,
    hasPresentationFamily: ["ShardMilestoneBonus1", "ShardMilestoneBonus8"].every((name) =>
      presentationFamily.includes(name)
    ),
    hasBonusCalcSamples: ["get_SU1Bonus1Calc", "get_SU5Bonus2Calc"].every((name) =>
      sampleBonusCalcAccessors.includes(name)
    ),
    hasUiContextAnchors: ["LevelText", "DescText", "ValueText", "DescriptionText"].every((name) =>
      uiContextAnchors.includes(name)
    ),
    textHandlerLabel: compatibilityBoundary?.probableTextHandler || "TextHandlerShardMilestoneBonusesPerLevel/N",
    genericWriterLabel: compatibilityBoundary?.genericMilestoneWriter || "SetAllMilestoneTexts",
    presentationFamilyLabel: presentationFamily.join(", "),
    bonusCalcLabel: sampleBonusCalcAccessors.join(", "),
    uiContextLabel: uiContextAnchors.join(", "),
    rowCoverageLabel: `${rowModelCoverage.start ?? "?"}-${rowModelCoverage.end ?? "?"}`
  }, "compatibility-effect-text-handler");
}

export function getShardMilestoneRowShellBoundarySummary(boundary) {
  const compatibilityBoundary = getShardCompatibilityBoundary(boundary, "rowShell");
  const inferredBoundary = getDbSystemBoundaryEntry(
    boundary,
    "family-graph:shards-milestone-row-shell",
    "subject-boundary"
  );
  const genericSubject = getShardGenericSubjectSummary(
    boundary,
    "family-graph:shards-milestone-row-shell"
  );
  if (inferredBoundary || genericSubject) {
    const factsByKind = genericSubject?.factsByKind || {};
    const screenControllers = Array.isArray(factsByKind["screen-controller-family"])
      ? factsByKind["screen-controller-family"]
      : [];
    const dataCarriers = Array.isArray(factsByKind["data-carrier-candidate"])
      ? factsByKind["data-carrier-candidate"]
      : [];
    const runtimeShells = Array.isArray(factsByKind["runtime-shell"])
      ? factsByKind["runtime-shell"]
      : [];
    const genericBuyFamilies = Array.isArray(factsByKind["generic-buy-family"])
      ? factsByKind["generic-buy-family"]
      : [];
    return {
      hasBoundary: screenControllers.length > 0 && dataCarriers.length > 0 && runtimeShells.length > 0,
      hasUnlockHookSamples: false,
      hasBuyHookSamples: genericBuyFamilies.length > 0,
      hasTextCheckerSamples: false,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericSubject),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: false
      }),
      screenController: screenControllers[0] || "ShardMining",
      tieIn:
        dataCarriers.find((value) => value.includes("|")) ||
        dataCarriers[0] ||
        "ShardMining|ShardUpgradeInfo",
      controllerHookLabel: runtimeShells[0] || "",
      unlockHookLabel: "",
      buyHookLabel: genericBuyFamilies.join(", "),
      textCheckerLabel: "",
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      subjectId: String(inferredBoundary?.subjectId || genericSubject?.subjectId || "").trim() || null,
      blockedInputReason:
        String(inferredBoundary?.blockedInputReason || "").trim() || null,
      nextSeamId: String(inferredBoundary?.nextSeamId || "").trim() || null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericSubject?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericSubject?.gapCount || 0
    };
  }
  const controllerShellAnchors = Array.isArray(compatibilityBoundary?.controllerShellAnchors)
    ? compatibilityBoundary.controllerShellAnchors
    : [];
  const unlockHookSamples = Array.isArray(compatibilityBoundary?.unlockHookSamples)
    ? compatibilityBoundary.unlockHookSamples
    : [];
  const buyHookSamples = Array.isArray(compatibilityBoundary?.buyHookSamples)
    ? compatibilityBoundary.buyHookSamples
    : [];
  const textCheckerSamples = Array.isArray(compatibilityBoundary?.textCheckerSamples)
    ? compatibilityBoundary.textCheckerSamples
    : [];
  return markLegacyShardCompatibilityFallback({
    hasBoundary:
      compatibilityBoundary?.screenControllerFamily === "ShardMining, Assembly-CSharp" &&
      compatibilityBoundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo" &&
      ["AttachFastBuyButton", "StartFastBuyButtonHold", "FastBuyButtonMethodShards"].every((name) =>
        controllerShellAnchors.includes(name)
      ),
    hasUnlockHookSamples: ["UnlockMilestone17", "UnlockMilestone29"].every((name) =>
      unlockHookSamples.includes(name)
    ),
    hasBuyHookSamples: buyHookSamples.includes("BuyMilestone0"),
    hasTextCheckerSamples: [
      "Milestone0TextChecker",
      "Milestone9TextChecker",
      "Milestone12TextChecker"
    ].every((name) => textCheckerSamples.includes(name)),
    screenController: compatibilityBoundary?.screenControllerFamily || "ShardMining, Assembly-CSharp",
    tieIn: compatibilityBoundary?.dataCarrierTieIn || "ShardMining|ShardUpgradeInfo",
    controllerHookLabel: controllerShellAnchors.join(", "),
    unlockHookLabel: unlockHookSamples.join(", "),
    buyHookLabel: buyHookSamples.join(", "),
    textCheckerLabel: textCheckerSamples.join(", ")
  }, "compatibility-row-shell");
}

export function getShardMilestoneRowAlignmentBoundarySummary(boundary) {
  const compatibilityBoundary = getShardCompatibilityBoundary(boundary, "rowAlignment");
  const inferredBoundary = getDbSystemBoundaryEntry(
    boundary,
    "family-graph:shards-milestone-row-alignment",
    "subject-boundary"
  );
  const genericSubject = getShardGenericSubjectSummary(
    boundary,
    "family-graph:shards-milestone-row-alignment"
  );
  if (inferredBoundary || genericSubject) {
    const factsByKind = genericSubject?.factsByKind || {};
    const screenControllers = Array.isArray(factsByKind["screen-controller-family"])
      ? factsByKind["screen-controller-family"]
      : [];
    const genericBuyFamilies = Array.isArray(factsByKind["generic-buy-family"])
      ? factsByKind["generic-buy-family"]
      : [];
    return {
      hasBoundary: screenControllers.length > 0,
      hasZeroUnlockTextOverlap: false,
      hasBuyTextOverlap: false,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericSubject),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: false
      }),
      unlockRangeLabel: "unrecovered",
      textCheckerRangeLabel: "unrecovered",
      buyRangeLabel: genericBuyFamilies.length ? "generic-numbered-family" : "unrecovered",
      unlockTextOverlapLabel: "unrecovered",
      buyTextOverlapLabel: "unrecovered",
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      subjectId: String(inferredBoundary?.subjectId || genericSubject?.subjectId || "").trim() || null,
      blockedInputReason:
        String(inferredBoundary?.blockedInputReason || "").trim() || null,
      nextSeamId: String(inferredBoundary?.nextSeamId || "").trim() || null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericSubject?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericSubject?.gapCount || 0
    };
  }
  const unlockHookRange =
    typeof compatibilityBoundary?.unlockHookRange === "object" && compatibilityBoundary.unlockHookRange
      ? compatibilityBoundary.unlockHookRange
      : {};
  const textCheckerRange =
    typeof compatibilityBoundary?.textCheckerRange === "object" && compatibilityBoundary.textCheckerRange
      ? compatibilityBoundary.textCheckerRange
      : {};
  const buyHookRange =
    typeof compatibilityBoundary?.buyHookRange === "object" && compatibilityBoundary.buyHookRange
      ? compatibilityBoundary.buyHookRange
      : {};
  const unlockTextCheckerOverlapIds = Array.isArray(compatibilityBoundary?.unlockTextCheckerOverlapIds)
    ? compatibilityBoundary.unlockTextCheckerOverlapIds
    : [];
  const buyTextCheckerOverlapIds = Array.isArray(compatibilityBoundary?.buyTextCheckerOverlapIds)
    ? compatibilityBoundary.buyTextCheckerOverlapIds
    : [];
  return markLegacyShardCompatibilityFallback({
    hasBoundary:
      compatibilityBoundary?.screenControllerFamily === "ShardMining, Assembly-CSharp" &&
      unlockHookRange.start === 17 &&
      unlockHookRange.end === 29 &&
      unlockHookRange.count === 13 &&
      textCheckerRange.start === 0 &&
      textCheckerRange.end === 12 &&
      textCheckerRange.count === 13 &&
      buyHookRange.start === 0 &&
      buyHookRange.end === 0 &&
      buyHookRange.count === 1,
    hasZeroUnlockTextOverlap: unlockTextCheckerOverlapIds.length === 0,
    hasBuyTextOverlap: buyTextCheckerOverlapIds.length === 1 && buyTextCheckerOverlapIds[0] === 0,
    unlockRangeLabel: `${unlockHookRange.start ?? "?"}-${unlockHookRange.end ?? "?"}`,
    textCheckerRangeLabel: `${textCheckerRange.start ?? "?"}-${textCheckerRange.end ?? "?"}`,
    buyRangeLabel: `${buyHookRange.start ?? "?"}-${buyHookRange.end ?? "?"}`,
    unlockTextOverlapLabel: unlockTextCheckerOverlapIds.length
      ? unlockTextCheckerOverlapIds.join(", ")
      : "none",
    buyTextOverlapLabel: buyTextCheckerOverlapIds.length
      ? buyTextCheckerOverlapIds.join(", ")
      : "none"
  }, "compatibility-row-alignment");
}

export function getShardSaveBoundarySummary(boundary) {
  const compatibilityBoundary =
    boundary?.ownedState?.compatibilityBoundaries?.saveBoundary ??
    boundary?.ownedState?.saveBoundary ??
    boundary;
  const shardOwnedStateBoundary = getDbSystemBoundaryEntry(
    boundary,
    "shard-owned-state-upgradeinfolist-population",
    "subject-boundary"
  );
  const shardOwnedStateMetadata = getDbSystemSubjectMetadataEntry(
    boundary,
    "shard-owned-state-upgradeinfolist-population"
  );
  const shardOwnedStateGeneric = getShardGenericSubjectSummary(
    boundary,
    "shard-owned-state-upgradeinfolist-population"
  );
  const shardSceneOwner = String(
    shardOwnedStateGeneric?.factsByKind?.["scene-owner"]?.[0] || "ShardMining"
  ).trim();
  const shardRuntimeShell = String(
    shardOwnedStateGeneric?.factsByKind?.["runtime-shell"]?.[0] ||
      "ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo"
  ).trim();
  const shardSaveCandidate = String(
    shardOwnedStateGeneric?.factsByKind?.["save-candidate"]?.[0] || ""
  ).trim();
  const ownedStateBoundaryPayload =
    shardOwnedStateBoundary && typeof shardOwnedStateBoundary === "object"
      ? shardOwnedStateBoundary
      : null;
  const knownEdges = Array.isArray(ownedStateBoundaryPayload?.knownEdges)
    ? ownedStateBoundaryPayload.knownEdges
    : Array.isArray(shardOwnedStateMetadata?.knownEdges)
      ? shardOwnedStateMetadata.knownEdges
      : [];
  const missingEdges = Array.isArray(ownedStateBoundaryPayload?.missingEdges)
    ? ownedStateBoundaryPayload.missingEdges
    : Array.isArray(shardOwnedStateMetadata?.missingEdges)
      ? shardOwnedStateMetadata.missingEdges
      : [];
  if (shardOwnedStateMetadata || shardOwnedStateBoundary) {
    const hasOwnedStatePopulationBridge = knownEdges.includes("local-runtime-population-bridge");
    const combinedNextSeamIds = [
      typeof ownedStateBoundaryPayload?.nextSeamId === "string"
        ? ownedStateBoundaryPayload.nextSeamId
        : null,
      typeof shardOwnedStateMetadata?.nextSeam?.id === "string"
        ? shardOwnedStateMetadata.nextSeam.id
        : null,
      ...(shardOwnedStateGeneric?.nextSeamIds ?? [])
    ].filter(Boolean);
    return {
      hasSeparationBoundary:
        knownEdges.includes("direct-scene-definition-payload") &&
        knownEdges.includes("definition-to-runtime-shell") &&
        knownEdges.includes("non-local-injection-seam"),
      hasDirectRowDefinitionPayload: knownEdges.includes("direct-scene-definition-payload"),
      hasRuntimeOwnedStateShell: knownEdges.includes("definition-to-runtime-shell"),
      hasOwnedStateTarget: knownEdges.includes("runtime-shell-to-owner-lists"),
      hasOwnedStatePopulationBridge,
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(shardOwnedStateGeneric),
        hasBoundaryModel: Boolean(ownedStateBoundaryPayload),
        hasSubjectMetadata: true
      }),
      ownedStateOutcomeKind: hasOwnedStatePopulationBridge
        ? "local-runtime-population-bridge"
        : knownEdges.includes("non-local-injection-seam")
          ? "non-local-injection-seam"
          : "owned-state-outcome-unavailable",
      boundaryVerdict: String(ownedStateBoundaryPayload?.verdict || "").trim() || null,
      ownerAnchor: `${shardSceneOwner} / ShardUpgradeInfo`,
      saveAnchor: "PlayerProfileData",
      cloudSaveAnchor: "CloudSavePlayerProfile",
      directPayloadAnchor: shardSceneOwner || "ShardMining",
      runtimeShellAnchor: shardRuntimeShell || "ShardMining.upgradeInfoList",
      unresolvedSaveCandidateLabel: shardSaveCandidate || null,
      ownedStateStatusLabel: hasOwnedStatePopulationBridge
        ? "Owned-state population bridge recovered"
        : knownEdges.includes("non-local-injection-seam")
          ? "Trace still stops at a non-local injection seam after the upgradeInfoList runtime shell"
          : "Owned-state population boundary status unavailable",
      overlapLabel: "zero direct overlap",
      ownerTermCount: Array.isArray(shardOwnedStateMetadata?.nextSeam?.terms)
        ? shardOwnedStateMetadata.nextSeam.terms.length
        : 0,
      subjectId: shardOwnedStateMetadata?.subjectId || ownedStateBoundaryPayload?.subjectId || null,
      subjectKind:
        shardOwnedStateMetadata?.subjectKind || ownedStateBoundaryPayload?.subjectKind || null,
      blockedInputReason:
        typeof ownedStateBoundaryPayload?.blockedInputReason === "string"
          ? ownedStateBoundaryPayload.blockedInputReason
          : typeof shardOwnedStateMetadata?.blockedInputReason === "string"
          ? shardOwnedStateMetadata.blockedInputReason
          : null,
      nextSeamId: combinedNextSeamIds[0] || null,
      genericFactCount:
        Number(ownedStateBoundaryPayload?.genericFactCount || 0) ||
        shardOwnedStateGeneric?.factCount ||
        0,
      genericGapCount:
        Number(ownedStateBoundaryPayload?.genericGapCount || 0) ||
        shardOwnedStateGeneric?.gapCount ||
        0,
      missingEdges
    };
  }
  const ownerShellTermsChecked = Array.isArray(compatibilityBoundary?.ownerShellTermsChecked)
    ? compatibilityBoundary.ownerShellTermsChecked
    : [];
  const saveFamilyTermsChecked = Array.isArray(compatibilityBoundary?.saveFamilyTermsChecked)
    ? compatibilityBoundary.saveFamilyTermsChecked
    : [];
  const stateRecoveryChecks =
    typeof compatibilityBoundary?.boundaryEvidence === "object" && compatibilityBoundary.boundaryEvidence
      ? compatibilityBoundary.boundaryEvidence
      : {};
  const recoveredDirectRowDefinitionPayload =
    typeof compatibilityBoundary?.recoveredDirectRowDefinitionPayload === "object" &&
    compatibilityBoundary.recoveredDirectRowDefinitionPayload
      ? compatibilityBoundary.recoveredDirectRowDefinitionPayload
      : {};
  const recoveredDeclaringRowModel =
    typeof compatibilityBoundary?.recoveredDeclaringRowModel === "object" &&
    compatibilityBoundary.recoveredDeclaringRowModel
      ? compatibilityBoundary.recoveredDeclaringRowModel
      : {};
  return markLegacyShardCompatibilityFallback({
    hasSeparationBoundary:
      stateRecoveryChecks.metadataNeighborhoodHasSaveTerms === false &&
      stateRecoveryChecks.level0HasSaveTerms === false &&
      stateRecoveryChecks.ownerShellWithSaveOverlapCount === 0 &&
      stateRecoveryChecks.directShardPlayerProfileContext === false &&
      saveFamilyTermsChecked.includes("PlayerProfileData") &&
      saveFamilyTermsChecked.includes("CloudSavePlayerProfile"),
    hasDirectRowDefinitionPayload:
      stateRecoveryChecks.directSerializedRowDefinitionRecovered === true,
    hasRuntimeOwnedStateShell: stateRecoveryChecks.runtimeOwnedStateShellRecovered === true,
    hasOwnedStateTarget: stateRecoveryChecks.ownedStateTargetRecovered === true,
    hasOwnedStatePopulationBridge: stateRecoveryChecks.ownedStatePopulationBridgeRecovered === true,
    ownedStateOutcomeKind: stateRecoveryChecks.ownedStateOutcomeKind || "non-local-injection-seam",
    ownerAnchor: "ShardMining / ShardUpgradeInfo",
    saveAnchor: "PlayerProfileData",
    cloudSaveAnchor: "CloudSavePlayerProfile",
    directPayloadAnchor: recoveredDirectRowDefinitionPayload.ownerType || "ShardMining",
    runtimeShellAnchor: recoveredDeclaringRowModel.ownerType
      ? `${recoveredDeclaringRowModel.ownerType}.upgradeInfoList`
      : "ShardMining.upgradeInfoList",
    ownedStateStatusLabel:
      stateRecoveryChecks.ownedStatePopulationBridgeRecovered === true
        ? "Owned-state population bridge recovered"
        : stateRecoveryChecks.ownedStateOutcomeKind === "deeper-wrapper-handoff"
          ? "The current evidence does not recover a local bridge, but it does preserve a deeper wrapper handoff for owned state"
        : "Trace rules out a local upgradeInfoList bridge and still cannot name a deeper wrapper handoff; owned state stays at a non-local injection seam",
    overlapLabel: "zero direct overlap",
    ownerTermCount: ownerShellTermsChecked.length
  }, "compatibility-save-boundary");
}
