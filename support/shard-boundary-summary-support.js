export function getShardOwnerFamilyBoundarySummary(boundary) {
  const screenControllers = Array.isArray(boundary?.screenControllerFamilies)
    ? boundary.screenControllerFamilies
    : [];
  const dataCarriers = Array.isArray(boundary?.dataCarrierCandidates)
    ? boundary.dataCarrierCandidates
    : [];
  const fastBuyHooks = Array.isArray(boundary?.screenControlAnchors)
    ? boundary.screenControlAnchors
    : [];
  const bonusAnchors = Array.isArray(boundary?.bonusFieldAnchors) ? boundary.bonusFieldAnchors : [];
  const genericLead = boundary?.downgradedGenericLead ?? {};
  const genericLeadReasons = Array.isArray(genericLead.reasons) ? genericLead.reasons : [];
  return {
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
  };
}

export function getShardFinalSuBonusBoundarySummary(boundary) {
  const unlockRequirementAccessors = Array.isArray(boundary?.unlockRequirementAccessors)
    ? boundary.unlockRequirementAccessors
    : [];
  const bonusFieldSamples = Array.isArray(boundary?.bonusFieldSamples)
    ? boundary.bonusFieldSamples
    : [];
  const bonusAccessorSamples = Array.isArray(boundary?.bonusAccessorSamples)
    ? boundary.bonusAccessorSamples
    : [];
  const adjacentFields = Array.isArray(boundary?.adjacentFields) ? boundary.adjacentFields : [];
  return {
    hasBoundary:
      boundary?.dataCarrier === "ShardUpgradeInfo" &&
      boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo" &&
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
    dataCarrier: boundary?.dataCarrier || "ShardUpgradeInfo",
    unlockRangeLabel: unlockRequirementAccessors.join(", "),
    bonusFieldLabel: bonusFieldSamples.join(", "),
    bonusAccessorLabel: bonusAccessorSamples.join(", "),
    adjacentFieldLabel: adjacentFields.join(", ")
  };
}

export function getShardMilestonePayloadBoundarySummary(boundary) {
  const milestoneStateFields = Array.isArray(boundary?.milestoneStateFields)
    ? boundary.milestoneStateFields
    : [];
  const costAndListHooks = Array.isArray(boundary?.costAndListHooks)
    ? boundary.costAndListHooks
    : [];
  const progressFillHooks = Array.isArray(boundary?.progressFillHooks)
    ? boundary.progressFillHooks
    : [];
  const tickFields = Array.isArray(boundary?.tickFields) ? boundary.tickFields : [];
  const sampleCostAccessors = Array.isArray(boundary?.sampleCostAccessors)
    ? boundary.sampleCostAccessors
    : [];
  return {
    hasBoundary:
      boundary?.dataCarrier === "ShardUpgradeInfo" &&
      boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo" &&
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
    dataCarrier: boundary?.dataCarrier || "ShardUpgradeInfo",
    milestoneStateLabel: milestoneStateFields.join(", "),
    costHookLabel: costAndListHooks.join(", "),
    progressHookLabel: progressFillHooks.join(", "),
    tickFieldLabel: tickFields.join(", "),
    costAccessorLabel: sampleCostAccessors.join(", ")
  };
}

export function getShardCostModelBoundarySummary(boundary) {
  const sampleCostAccessorWindows = Array.isArray(boundary?.sampleCostAccessorWindows)
    ? boundary.sampleCostAccessorWindows
    : [];
  const row0CostFields = Array.isArray(boundary?.row0CostFields) ? boundary.row0CostFields : [];
  const row0FillFields = Array.isArray(boundary?.row0FillFields) ? boundary.row0FillFields : [];
  const row0BonusFields = Array.isArray(boundary?.row0BonusFields) ? boundary.row0BonusFields : [];
  const optimizerBoundary =
    typeof boundary?.optimizerBoundary === "object" && boundary.optimizerBoundary
      ? boundary.optimizerBoundary
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
  return {
    hasBoundary:
      boundary?.dataCarrier === "ShardUpgradeInfo" &&
      boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo",
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
    dataCarrier: boundary?.dataCarrier || "ShardUpgradeInfo",
    costWindowLabel: [earlyAccessors.join(", "), lateAccessors.join(", ")]
      .filter(Boolean)
      .join(" | "),
    row0FieldLabel: row0CostFields.join(", "),
    row0FillLabel: row0FillFields.join(", "),
    row0BonusLabel: row0BonusFields.join(", "),
    supportedOptimizerLabel: supportedNow.join(", "),
    blockedOptimizerLabel: blockedNow.join(", ")
  };
}

export function getShardMilestoneRowModelBoundarySummary(boundary) {
  const textCheckerRange =
    typeof boundary?.textCheckerRange === "object" && boundary.textCheckerRange
      ? boundary.textCheckerRange
      : {};
  const unlockRequirementRange =
    typeof boundary?.unlockRequirementRange === "object" && boundary.unlockRequirementRange
      ? boundary.unlockRequirementRange
      : {};
  const buyHookEvidence =
    typeof boundary?.buyHookEvidence === "object" && boundary.buyHookEvidence
      ? boundary.buyHookEvidence
      : {};
  const shardLocalDirectHooks = Array.isArray(buyHookEvidence.shardLocalDirectHooks)
    ? buyHookEvidence.shardLocalDirectHooks
    : [];
  const genericNumberedFamily =
    typeof buyHookEvidence.genericNumberedFamily === "object" &&
    buyHookEvidence.genericNumberedFamily
      ? buyHookEvidence.genericNumberedFamily
      : {};
  return {
    hasBoundary:
      boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo" &&
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
  };
}

export function getShardMilestoneTitleEffectBoundarySummary(boundary) {
  const titleAssetCandidates = Array.isArray(boundary?.titleAssetCandidates)
    ? boundary.titleAssetCandidates
    : [];
  const effectPresentationSlots = Array.isArray(boundary?.effectPresentationSlots)
    ? boundary.effectPresentationSlots
    : [];
  const sampleBonusCalcAccessors = Array.isArray(boundary?.sampleBonusCalcAccessors)
    ? boundary.sampleBonusCalcAccessors
    : [];
  const uniqueRows = [
    ...new Set(
      titleAssetCandidates.map((entry) => entry?.row).filter((value) => Number.isInteger(value))
    )
  ].sort((a, b) => a - b);
  const row28Candidates = titleAssetCandidates
    .filter((entry) => entry?.row === 28)
    .map((entry) => entry.title);
  return {
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
  };
}

export function getShardEffectTextHandlerBoundarySummary(boundary) {
  const presentationFamily = Array.isArray(boundary?.presentationFamily)
    ? boundary.presentationFamily
    : [];
  const sampleBonusCalcAccessors = Array.isArray(boundary?.sampleBonusCalcAccessors)
    ? boundary.sampleBonusCalcAccessors
    : [];
  const uiContextAnchors = Array.isArray(boundary?.uiContextAnchors)
    ? boundary.uiContextAnchors
    : [];
  const rowModelCoverage =
    typeof boundary?.rowModelCoverage === "object" && boundary?.rowModelCoverage
      ? boundary.rowModelCoverage
      : {};
  return {
    hasBoundary:
      boundary?.probableTextHandler === "TextHandlerShardMilestoneBonusesPerLevel/N" &&
      boundary?.genericMilestoneWriter === "SetAllMilestoneTexts" &&
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
    textHandlerLabel: boundary?.probableTextHandler || "TextHandlerShardMilestoneBonusesPerLevel/N",
    genericWriterLabel: boundary?.genericMilestoneWriter || "SetAllMilestoneTexts",
    presentationFamilyLabel: presentationFamily.join(", "),
    bonusCalcLabel: sampleBonusCalcAccessors.join(", "),
    uiContextLabel: uiContextAnchors.join(", "),
    rowCoverageLabel: `${rowModelCoverage.start ?? "?"}-${rowModelCoverage.end ?? "?"}`
  };
}

export function getShardMilestoneRowShellBoundarySummary(boundary) {
  const controllerShellAnchors = Array.isArray(boundary?.controllerShellAnchors)
    ? boundary.controllerShellAnchors
    : [];
  const unlockHookSamples = Array.isArray(boundary?.unlockHookSamples)
    ? boundary.unlockHookSamples
    : [];
  const buyHookSamples = Array.isArray(boundary?.buyHookSamples) ? boundary.buyHookSamples : [];
  const textCheckerSamples = Array.isArray(boundary?.textCheckerSamples)
    ? boundary.textCheckerSamples
    : [];
  return {
    hasBoundary:
      boundary?.screenControllerFamily === "ShardMining, Assembly-CSharp" &&
      boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo" &&
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
    screenController: boundary?.screenControllerFamily || "ShardMining, Assembly-CSharp",
    tieIn: boundary?.dataCarrierTieIn || "ShardMining|ShardUpgradeInfo",
    controllerHookLabel: controllerShellAnchors.join(", "),
    unlockHookLabel: unlockHookSamples.join(", "),
    buyHookLabel: buyHookSamples.join(", "),
    textCheckerLabel: textCheckerSamples.join(", ")
  };
}

export function getShardMilestoneRowAlignmentBoundarySummary(boundary) {
  const unlockHookRange =
    typeof boundary?.unlockHookRange === "object" && boundary.unlockHookRange
      ? boundary.unlockHookRange
      : {};
  const textCheckerRange =
    typeof boundary?.textCheckerRange === "object" && boundary.textCheckerRange
      ? boundary.textCheckerRange
      : {};
  const buyHookRange =
    typeof boundary?.buyHookRange === "object" && boundary.buyHookRange
      ? boundary.buyHookRange
      : {};
  const unlockTextCheckerOverlapIds = Array.isArray(boundary?.unlockTextCheckerOverlapIds)
    ? boundary.unlockTextCheckerOverlapIds
    : [];
  const buyTextCheckerOverlapIds = Array.isArray(boundary?.buyTextCheckerOverlapIds)
    ? boundary.buyTextCheckerOverlapIds
    : [];
  return {
    hasBoundary:
      boundary?.screenControllerFamily === "ShardMining, Assembly-CSharp" &&
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
  };
}

export function getShardSaveBoundarySummary(boundary) {
  const ownerShellTermsChecked = Array.isArray(boundary?.ownerShellTermsChecked)
    ? boundary.ownerShellTermsChecked
    : [];
  const saveFamilyTermsChecked = Array.isArray(boundary?.saveFamilyTermsChecked)
    ? boundary.saveFamilyTermsChecked
    : [];
  const probeResults =
    typeof boundary?.probeResults === "object" && boundary.probeResults
      ? boundary.probeResults
      : {};
  const recoveredDirectRowDefinitionPayload =
    typeof boundary?.recoveredDirectRowDefinitionPayload === "object" &&
    boundary.recoveredDirectRowDefinitionPayload
      ? boundary.recoveredDirectRowDefinitionPayload
      : {};
  const recoveredDeclaringRowModel =
    typeof boundary?.recoveredDeclaringRowModel === "object" && boundary.recoveredDeclaringRowModel
      ? boundary.recoveredDeclaringRowModel
      : {};
  return {
    hasSeparationBoundary:
      probeResults.metadataNeighborhoodHasSaveTerms === false &&
      probeResults.level0HasSaveTerms === false &&
      probeResults.ownerShellWithSaveOverlapCount === 0 &&
      probeResults.directShardPlayerProfileContext === false &&
      saveFamilyTermsChecked.includes("PlayerProfileData") &&
      saveFamilyTermsChecked.includes("CloudSavePlayerProfile"),
    hasDirectRowDefinitionPayload: probeResults.directSerializedRowDefinitionRecovered === true,
    hasRuntimeOwnedStateShell: probeResults.runtimeOwnedStateShellRecovered === true,
    hasTraceOwnedStatePopulationBridge:
      probeResults.traceWorkflowHasOwnedStatePopulationBridge === true,
    ownerAnchor: "ShardMining / ShardUpgradeInfo",
    saveAnchor: "PlayerProfileData",
    cloudSaveAnchor: "CloudSavePlayerProfile",
    directPayloadAnchor: recoveredDirectRowDefinitionPayload.ownerType || "ShardMining",
    runtimeShellAnchor: recoveredDeclaringRowModel.ownerType
      ? `${recoveredDeclaringRowModel.ownerType}.upgradeInfoList`
      : "ShardMining.upgradeInfoList",
    traceOwnedStateLabel:
      probeResults.traceWorkflowHasOwnedStatePopulationBridge !== true
        ? "Trace closes shard-cost structure only; owned-state population stays non-local"
        : "Trace-owned-state population bridge recovered",
    overlapLabel: "zero direct overlap",
    ownerTermCount: ownerShellTermsChecked.length
  };
}
