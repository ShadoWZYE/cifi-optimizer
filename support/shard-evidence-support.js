export function createShardEvidenceSupport({
  formatShardNumber,
  getShardCostModelBoundarySummary,
  getShardEffectTextHandlerBoundarySummary,
  getShardGrounding,
  getShardMilestoneRowModelBoundarySummary,
  getShardMilestoneTitleEffectBoundarySummary,
  getShardPlannerState
}) {
  function formatThresholdScheduleSummary(thresholds = {}) {
    return Object.entries(thresholds)
      .filter(([rarity]) => rarity !== "source_ids")
      .map(([rarity, levels]) => `${rarity} ${Array.isArray(levels) ? levels.join("/") : ""}`)
      .join("; ");
  }

  function getGroundedShardMilestones() {
    return getShardGrounding()?.milestones?.milestones ?? [];
  }

  function getGroundedShardMechanics() {
    return getShardGrounding()?.milestones?.canonicalMechanics?.shardMilestoneSystem ?? {};
  }

  function getShardMilestoneFamilyEvidence() {
    const rows = Array.isArray(getShardGrounding()?.milestoneFamilyEvidence?.rows)
      ? getShardGrounding().milestoneFamilyEvidence.rows
      : [];
    return [...rows].sort((left, right) => Number(left?.row ?? 0) - Number(right?.row ?? 0));
  }

  function getShardMilestoneEvidenceRow(milestoneOrRow) {
    const row =
      typeof milestoneOrRow === "number"
        ? Number(milestoneOrRow)
        : Number(milestoneOrRow?.milestoneNumber ?? milestoneOrRow?.row);
    return getShardMilestoneFamilyEvidence().find((entry) => Number(entry?.row) === row) || null;
  }

  function getShardMilestoneEvidenceCounts() {
    return getShardMilestoneFamilyEvidence().reduce(
      (totals, row) => {
        const status = String(row?.status || "partial").toLowerCase();
        if (status === "verified" || status === "partial" || status === "blocked") {
          totals[status] += 1;
        }
        return totals;
      },
      { verified: 0, partial: 0, blocked: 0 }
    );
  }

  function getDefaultShardFocusMilestoneId(milestones) {
    if (!milestones.length) {
      return "";
    }
    const totalLevels = Number(getShardPlannerState().totalMilestoneLevels || 0);
    return getNextShardUnlockMilestone(totalLevels, milestones)?.id || milestones[0].id;
  }

  function getVerifiedShardRowPackages() {
    return getShardMilestoneFamilyEvidence()
      .filter((entry) => entry?.status === "verified" && entry?.verifiedPackage)
      .map((entry) => ({
        verifiedRow: {
          row: entry.row,
          rowKey: entry.rowKey,
          titleBinding: {
            playerFacingName: entry.titleBinding?.playerFacingName,
            title: Array.isArray(entry.titleBinding?.titleCandidates)
              ? entry.titleBinding.titleCandidates[0]
              : ""
          },
          effectPackage: entry.verifiedPackage
        }
      }));
  }

  function formatVerifiedShardBonusPackage(effectPackage) {
    return (Array.isArray(effectPackage?.bonuses) ? effectPackage.bonuses : [])
      .map((bonus) => {
        const unlock = Number.isFinite(Number(bonus?.unlockLevel))
          ? `Lv${Number(bonus.unlockLevel)}`
          : "Listed";
        return `${unlock} ${String(bonus?.effectLabel || "Unnamed bonus")}`;
      })
      .join(" | ");
  }

  function getShardBonusSlotRowSummary(row) {
    const rows = Array.isArray(getShardGrounding()?.bonusSlotProbe?.rows)
      ? getShardGrounding().bonusSlotProbe.rows
      : [];
    return rows.find((entry) => Number(entry.row) === Number(row)) || null;
  }

  function getShardRowAlignedCostTuple(row) {
    const tuples = Array.isArray(getShardGrounding()?.costParameterProbe?.rowAlignedTupleCandidates)
      ? getShardGrounding().costParameterProbe.rowAlignedTupleCandidates
      : [];
    return tuples.find((entry) => Number(entry.row) === Number(row)) || null;
  }

  function getShardRowDirectValues(row) {
    if (Number(row) === 0) {
      const row0 = getShardGrounding()?.costParameterProbe?.row0PreludeCandidate;
      return Number(row0?.row) === 0 ? row0 : null;
    }
    return getShardRowAlignedCostTuple(row);
  }

  function getShardExtractedUnlockRequirement(row) {
    const values = Array.isArray(
      getShardGrounding()?.costParameterProbe?.unlockRequirementBlock?.values
    )
      ? getShardGrounding().costParameterProbe.unlockRequirementBlock.values
      : [];
    const value = values[Number(row)];
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function getShardExtractedBonusPerLevel(row, bonusIndex) {
    const directValues = getShardRowDirectValues(row);
    const bonusValues = Array.isArray(directValues?.bonusPerLevelValues)
      ? directValues.bonusPerLevelValues
      : [];
    const value = bonusValues[bonusIndex];
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function getShardExtractedCostFieldMapping(row) {
    const directValues = getShardRowDirectValues(row);
    return directValues?.strongestFieldOrderMapping || null;
  }

  function getShardNativeCostRowSummary(row) {
    const rows = Array.isArray(getShardGrounding()?.costNativeProbe?.rows)
      ? getShardGrounding().costNativeProbe.rows
      : [];
    return rows.find((entry) => Number(entry.row) === Number(row)) || null;
  }

  function formatShardNativeThresholdStage(stage) {
    const minimumLevel = Number(stage?.minimumLevel);
    const getterName = stage?.getterName || "Unknown getter";
    const baseFieldName = stage?.baseFieldName || "Unknown base";
    if (!Number.isFinite(minimumLevel)) {
      return `${getterName} | ${baseFieldName}`;
    }
    return `${formatShardNumber(minimumLevel)}+ via ${getterName} and ${baseFieldName}`;
  }

  function getShardNativeCostStageSummary(row, level = 0) {
    const nativeRow = getShardNativeCostRowSummary(row);
    const stages = Array.isArray(nativeRow?.thresholdStages) ? nativeRow.thresholdStages : [];
    if (!stages.length) {
      return {
        stageLabel: "Native cost stages not yet recovered for this row.",
        nextStageLabel: "No higher native over-level stage recovered.",
        thresholdStageLabel: ""
      };
    }
    const orderedStages = stages
      .filter((stage) => Number.isFinite(Number(stage?.minimumLevel)))
      .sort((left, right) => Number(left.minimumLevel) - Number(right.minimumLevel));
    const stageLabel = orderedStages
      .map((stage) => formatShardNativeThresholdStage(stage))
      .join(" | ");
    const nextStage =
      orderedStages.find((stage) => Number(stage.minimumLevel) > Number(level)) || null;
    return {
      stageLabel,
      nextStageLabel: nextStage
        ? `Next native cost stage: ${formatShardNativeThresholdStage(nextStage)}`
        : "No higher native over-level stage recovered.",
      thresholdStageLabel: orderedStages.length
        ? `Verified stage order: base lane -> ${orderedStages.map((stage) => `${formatShardNumber(stage.minimumLevel)}+`).join(" -> ")}`
        : ""
    };
  }

  function getShardFormulaApplicationProfile(row) {
    const profiles = getShardGrounding()?.costNativeProbe?.formulaApplicationProfiles;
    if (!profiles) {
      return null;
    }
    if (Number(row) === 0) {
      return profiles.rowZero || null;
    }
    const normalRows = Array.isArray(profiles.normalRows) ? profiles.normalRows : [];
    return (
      normalRows.find((entry) => Array.isArray(entry?.rows) && entry.rows.includes(Number(row))) ||
      null
    );
  }

  function formatShardFormulaClassLabel(formulaClass) {
    const labels = {
      "row0-special-case": "Row 0 special case",
      "canonical-additive-premerge": "Canonical full recipe",
      "canonical-literal-builder": "Canonical full recipe",
      "drop-400-stage": "Drops 400+ stage",
      "two-stage-transition-band": "100/200 transition band",
      "hundred-stage-short-class": "100-only short class"
    };
    return labels[formulaClass] || "Unresolved native class";
  }

  function formatShardExtractedBonusPerLevel(value) {
    return Number.isFinite(Number(value))
      ? `${Number(value)
          .toFixed(3)
          .replace(/\.?0+$/u, "")}x`
      : "Unknown";
  }

  function formatProbeNumber(value) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return "Not tracked";
    }
    if (Math.abs(numericValue) >= 1000) {
      return formatShardNumber(numericValue);
    }
    if (Math.abs(numericValue) >= 1) {
      return Number(numericValue.toFixed(3)).toString();
    }
    return Number(numericValue.toPrecision(4)).toString();
  }

  function formatShardExtractedCostFieldMapping(mapping) {
    if (!mapping || typeof mapping !== "object" || !mapping.values) {
      return "Not recovered in direct row payload";
    }
    const fieldNames = Array.isArray(mapping.fieldNames)
      ? mapping.fieldNames
      : Object.keys(mapping.values);
    const parts = fieldNames
      .filter((fieldName) => Number.isFinite(Number(mapping.values?.[fieldName])))
      .map((fieldName) => `${fieldName} ${formatProbeNumber(mapping.values[fieldName])}`);
    if (!parts.length) {
      return "Not recovered in direct row payload";
    }
    const auxValue = mapping.auxiliaryIntCandidate;
    if (Number.isFinite(Number(auxValue))) {
      parts.push(`aux int ${formatProbeNumber(auxValue)}`);
    }
    return parts.join(" | ");
  }

  function getShardCostParameterProbeSummary(probe) {
    const metadataFamilies = probe?.metadataFamilies ?? {};
    const candidateTuples = Array.isArray(probe?.shardMiningCandidateTuples)
      ? probe.shardMiningCandidateTuples
      : [];
    const rowAlignedTuples = Array.isArray(probe?.rowAlignedTupleCandidates)
      ? probe.rowAlignedTupleCandidates
      : [];
    const signatureGroups = Array.isArray(probe?.signatureGroups) ? probe.signatureGroups : [];
    const startCostFields = Array.isArray(metadataFamilies.startCostFields)
      ? metadataFamilies.startCostFields
      : [];
    const costExponentFields = Array.isArray(metadataFamilies.costExponentFields)
      ? metadataFamilies.costExponentFields
      : [];
    const growthExponentFields = Array.isArray(metadataFamilies.growthExponentFields)
      ? metadataFamilies.growthExponentFields
      : [];
    const sampleTuple = rowAlignedTuples[0] ?? candidateTuples[0] ?? null;
    return {
      hasFullMetadataFamilies:
        startCostFields.length === 30 &&
        costExponentFields.length === 30 &&
        growthExponentFields.length >= 30,
      metadataLabel:
        startCostFields.length === 30 && costExponentFields.length === 30
          ? "SU0-29 StartCost and CostExponent"
          : "partial SU* cost fields",
      hasCandidateTuples: candidateTuples.length > 0,
      hasRowAlignedTuples: rowAlignedTuples.length > 0,
      candidateTupleCount: candidateTuples.length,
      rowAlignedTupleCount: rowAlignedTuples.length,
      signatureGroupCount: signatureGroups.length,
      sampleTupleLabel: sampleTuple
        ? `${formatProbeNumber(sampleTuple.intValue)} | ${formatProbeNumber(sampleTuple.exponentA)} | ${formatProbeNumber(sampleTuple.exponentB)} | ${formatProbeNumber(sampleTuple.tailScalar)}`
        : "unavailable"
    };
  }

  function getShardMilestoneGroundedSummary(milestone) {
    const row = Number(milestone?.milestoneNumber);
    const evidenceRow = getShardMilestoneEvidenceRow(row);
    const extractedUnlockRequirement = getShardExtractedUnlockRequirement(row);
    const status = String(evidenceRow?.status || "partial").toLowerCase();
    const titleCandidates = Array.isArray(evidenceRow?.titleBinding?.titleCandidates)
      ? evidenceRow.titleBinding.titleCandidates
      : [];
    const titleCoverageStatusLabel =
      status === "verified" ? "Verified" : status === "blocked" ? "Blocked" : "Partial";
    const rowShellStatusLabel =
      status === "verified" ? "Verified" : status === "blocked" ? "Blocked" : "Partial";
    const effectStatusLabel =
      status === "verified" ? "Verified" : status === "blocked" ? "Blocked" : "Partial";
    const costStatusLabel =
      evidenceRow?.costShell?.status === "verified"
        ? "Verified"
        : status === "blocked"
          ? "Blocked"
          : "Partial";
    return {
      titleCoverageTone: status === "blocked" ? "warn" : "pass",
      titleCoverageStatusLabel,
      titleCoverageStatusClass: `shard-status-pill-${titleCoverageStatusLabel.toLowerCase()}`,
      titleCoverageLine:
        Array.isArray(titleCandidates) && titleCandidates.length > 1
          ? `Shipped title candidates still conflict for row ${row}: ${titleCandidates.join(" | ")}.`
          : titleCandidates.length === 1
            ? `Shipped title evidence for row ${row}: ${titleCandidates[0]}.`
            : `No shipped title candidate is preserved for row ${row}.`,
      rowShellTone: status === "blocked" ? "warn" : "pass",
      rowShellStatusLabel,
      rowShellStatusClass: `shard-status-pill-${rowShellStatusLabel.toLowerCase()}`,
      rowShellLine:
        evidenceRow?.status === "verified"
          ? `Row ${row} clears one checked shard-local row shell package without promoting save-owned milestone state.`
          : `Row ${row} stays inside the recovered shard-local row family, but its save-owned milestone state remains unresolved.`,
      effectTone: status === "blocked" ? "warn" : "pass",
      effectStatusLabel,
      effectStatusClass: `shard-status-pill-${effectStatusLabel.toLowerCase()}`,
      effectLine:
        evidenceRow?.status === "blocked"
          ? evidenceRow?.statusReason || `Effect evidence for row ${row} is still blocked.`
          : `Recovered shard-side effect evidence preserves ${evidenceRow?.effectBinding?.bonusFieldCount ?? 0} bonus slots for this row through ${evidenceRow?.effectBinding?.handler || "the shard bonus handler"}.`,
      costTone: status === "blocked" ? "warn" : "pass",
      costStatusLabel,
      costStatusClass: `shard-status-pill-${costStatusLabel.toLowerCase()}`,
      costLine:
        evidenceRow?.costShell?.note ||
        `Recovered shard cost evidence keeps ${evidenceRow?.costShell?.getterName || `get_SU${row}Cost`} inside the shared family, but exact evaluator math remains blocked.`,
      extractedUnlockRequirement
    };
  }

  function getShardDefinitionEvidenceSummary(milestone) {
    const row = Number(milestone?.milestoneNumber);
    const evidenceRow = getShardMilestoneEvidenceRow(row);
    const summary = getShardMilestoneGroundedSummary(milestone);
    const titleCandidates = Array.isArray(evidenceRow?.titleBinding?.titleCandidates)
      ? evidenceRow.titleBinding.titleCandidates
      : [];
    const unlockRequirement = Number.isFinite(summary.extractedUnlockRequirement)
      ? `${formatShardNumber(summary.extractedUnlockRequirement)} total milestone levels (direct row payload)`
      : describeUnlockCondition(milestone?.unlockCondition);
    const bonusFieldCount = Number(evidenceRow?.effectBinding?.bonusFieldCount ?? 0);
    const groundedBonusCount = Number(evidenceRow?.effectBinding?.groundedBonusCount ?? 0);
    const calcAccessorCount = Number(evidenceRow?.effectBinding?.calcAccessorCount ?? 0);
    const verifiedPackage = evidenceRow?.verifiedPackage;
    const breakpoints = Array.isArray(verifiedPackage?.fixedBreakpoints)
      ? verifiedPackage.fixedBreakpoints.join("/")
      : null;
    return {
      titleLine:
        titleCandidates.length > 1
          ? `Shipped title candidates still conflict: ${titleCandidates.join(" | ")}.`
          : titleCandidates.length === 1
            ? `Shipped title binding: ${titleCandidates[0]}.`
            : "Shipped title binding is not yet recovered for this row.",
      unlockLine: `Unlock requirement: ${unlockRequirement}.`,
      bonusShapeLine: verifiedPackage
        ? `Verified bonus package with breakpoints ${breakpoints || "n/a"} and ${groundedBonusCount || 0} grounded bonus lane${groundedBonusCount === 1 ? "" : "s"}.`
        : `Recovered bonus package shape: ${bonusFieldCount} slot${bonusFieldCount === 1 ? "" : "s"}, ${groundedBonusCount} grounded lane${groundedBonusCount === 1 ? "" : "s"}, ${calcAccessorCount} sampled calc accessor${calcAccessorCount === 1 ? "" : "s"}.`,
      costLine: summary.costLine
    };
  }

  function getShardOwnedStateBlockerSummary() {
    const saveBoundary = getShardGrounding()?.saveBoundary ?? {};
    const probeResults =
      typeof saveBoundary?.probeResults === "object" && saveBoundary.probeResults
        ? saveBoundary.probeResults
        : {};
    const recoveredDeclaringRowModel =
      typeof saveBoundary?.recoveredDeclaringRowModel === "object" &&
      saveBoundary.recoveredDeclaringRowModel
        ? saveBoundary.recoveredDeclaringRowModel
        : {};
    const remainingCandidates = Array.isArray(
      getShardGrounding()?.saveOwnerCandidates?.remainingSaveOwnerCandidates
    )
      ? getShardGrounding().saveOwnerCandidates.remainingSaveOwnerCandidates
      : [];
    const leadingCandidate = remainingCandidates[0] ?? null;
    const runtimeShellAnchor = recoveredDeclaringRowModel?.ownerType
      ? `${recoveredDeclaringRowModel.ownerType}.upgradeInfoList -> ${recoveredDeclaringRowModel.rowModelType?.fullName || "ShardMining+ShardUpgradeInfo"}`
      : "ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo";
    return {
      statusLabel: "Blocked",
      ownerLine:
        probeResults.saveSideOwnerRecovered === false
          ? `No checked save-side owner is recovered for player-owned shard rows; the trail still stops at ${runtimeShellAnchor}.`
          : "A checked save-side owner is recovered.",
      traceLine:
        probeResults.traceOwnedStateOutcomeKind === "deeper-wrapper-handoff"
          ? "The trace does not recover a local ShardMining producer, but it does preserve a deeper wrapper handoff for owned-state values."
          : "The trace rules out a local upgradeInfoList population bridge and still cannot name a deeper wrapper handoff, so owned-state values stay bounded as a non-local injection seam.",
      importLine:
        "No grounded import path is available from PlayerProfileData or CloudSavePlayerProfile, so player-owned shard rows cannot be imported from this contract.",
      plannerLine:
        "Planner-safe affordability, exact per-level math, ROI, ETA, and canonical state.playerProfile promotion stay blocked on this row.",
      candidateLine: leadingCandidate?.label
        ? `Current unresolved save-owner candidate: ${leadingCandidate.label}.`
        : "No narrower save-owner candidate is promoted from this contract."
    };
  }

  function getShardMilestoneDisplayName(milestone) {
    const row = Number(milestone?.milestoneNumber ?? 0);
    const evidenceRow = getShardMilestoneEvidenceRow(milestone);
    const titleCandidates = Array.isArray(evidenceRow?.titleBinding?.titleCandidates)
      ? evidenceRow.titleBinding.titleCandidates
          .map((entry) => String(entry || "").trim())
          .filter(Boolean)
      : [];
    const uniqueTitles = [...new Set(titleCandidates)];
    if (uniqueTitles.length === 1 && evidenceRow?.status !== "blocked") {
      return uniqueTitles[0];
    }
    return milestone?.name || `Milestone ${row}`;
  }

  function getShardMilestonePanelTitle(milestone) {
    const row = Number(milestone?.milestoneNumber ?? 0);
    const displayName = getShardMilestoneDisplayName(milestone);
    const normalizedName = String(displayName || "")
      .replace(/^The\s+/i, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+Milestone$/i, "")
      .trim();
    return `#${row} THE ${normalizedName.toUpperCase()} MILESTONE`;
  }

  function getShardMilestoneLevelRailSummary(milestone) {
    const row = Number(milestone?.milestoneNumber ?? 0);
    const directValues = getShardRowDirectValues(row);
    const profile = getShardFormulaApplicationProfile(row);
    const nativeSummary = getShardNativeCostStageSummary(
      row,
      getShardPlannerState().observedLevelsByMilestone?.[milestone?.id] ?? ""
    );
    return {
      buttonLabel: "Level up",
      costLabel: directValues
        ? "Verified row inputs recovered; exact cost formula still unresolved."
        : "Current cost formula not yet verified.",
      formulaLabel: profile
        ? `${formatShardFormulaClassLabel(profile.formulaClass)}${profile.stageCoverage ? ` (${profile.stageCoverage})` : ""}`
        : row === 0
          ? "Row 0 special case"
          : "Unresolved native class",
      stageLabel: nativeSummary.thresholdStageLabel || nativeSummary.stageLabel,
      nextStageLabel: nativeSummary.nextStageLabel
    };
  }

  function getShardMilestoneDisplayMeta(milestone) {
    const preferredTitle = getShardMilestoneDisplayName(milestone);
    const sourceTitle = milestone?.name || "";
    const evidenceRow = getShardMilestoneEvidenceRow(milestone);
    if (evidenceRow?.status) {
      const label = evidenceRow.status.charAt(0).toUpperCase() + evidenceRow.status.slice(1);
      return `Evidence status: ${label}`;
    }
    if (preferredTitle && sourceTitle && preferredTitle !== sourceTitle) {
      return `Community alias: ${sourceTitle}`;
    }
    return `Unlock ${describeUnlockCondition(milestone?.unlockCondition)}`;
  }

  function parseShardNumericLabel(value) {
    const text = String(value || "").trim();
    if (!text) {
      return null;
    }
    const normalized = text.replace(",", ".").replace(/\s+/g, "");
    const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)$/);
    if (!match) {
      return null;
    }
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseShardBonusDescriptor(value) {
    const text = String(value || "").trim();
    if (!text) {
      return null;
    }
    const normalized = text.replace(",", ".").replace(/\s+/g, "");
    const multiplierMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)x$/i);
    if (multiplierMatch) {
      return { kind: "multiplier", value: Number(multiplierMatch[1]) };
    }
    const secondsPerLevelMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)s\/level$/i);
    if (secondsPerLevelMatch) {
      return { kind: "seconds-per-level", value: Number(secondsPerLevelMatch[1]) };
    }
    const secondsMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
    if (secondsMatch) {
      return { kind: "seconds", value: Number(secondsMatch[1]) };
    }
    return null;
  }

  function formatShardComputedMultiplier(value) {
    if (!Number.isFinite(value)) {
      return "Unresolved";
    }
    if (Math.abs(value) >= 1000) {
      return `x${formatShardNumber(value)}`;
    }
    if (Math.abs(value) >= 1) {
      return `x${Number(value.toFixed(3)).toString()}`;
    }
    return `x${Number(value.toPrecision(4)).toString()}`;
  }

  function formatShardComputedSeconds(value) {
    if (!Number.isFinite(value)) {
      return "Unresolved";
    }
    return `${Number(value.toFixed(3)).toString()}s`;
  }

  function getShardComputedBonusSummary(milestone, bonus, observedLevelValue) {
    const observedLevel = Number(observedLevelValue || 0);
    if (!Number.isFinite(observedLevel) || observedLevel <= 0) {
      return {
        currentLabel: "Enter an observed level",
        nextLabel: "Enter an observed level"
      };
    }
    const unlockLevel = Number.isFinite(Number(bonus?.unlockLevel))
      ? Number(bonus.unlockLevel)
      : null;
    if (unlockLevel !== null && observedLevel < unlockLevel) {
      return {
        currentLabel: `Locked until level ${formatShardNumber(unlockLevel)}`,
        nextLabel: `Locked until level ${formatShardNumber(unlockLevel)}`
      };
    }
    const activeLevels =
      unlockLevel === null ? observedLevel : Math.max(observedLevel - unlockLevel + 1, 0);
    const nextActiveLevels =
      unlockLevel === null ? observedLevel + 1 : Math.max(observedLevel + 1 - unlockLevel + 1, 0);
    const initialDescriptor = parseShardBonusDescriptor(bonus?.initialBonus);
    const bonusIndex = Array.isArray(milestone?.bonuses) ? milestone.bonuses.indexOf(bonus) : -1;
    const extractedPerLevelValue =
      bonusIndex >= 0
        ? getShardExtractedBonusPerLevel(milestone?.milestoneNumber, bonusIndex)
        : null;
    const perLevelDescriptor = Number.isFinite(extractedPerLevelValue)
      ? { kind: "multiplier", value: extractedPerLevelValue }
      : parseShardBonusDescriptor(bonus?.bonusPerLevel);
    if (perLevelDescriptor?.kind === "multiplier") {
      if (initialDescriptor?.kind === "multiplier") {
        const current =
          initialDescriptor.value *
          Math.pow(perLevelDescriptor.value, Math.max(activeLevels - 1, 0));
        const next =
          initialDescriptor.value *
          Math.pow(perLevelDescriptor.value, Math.max(nextActiveLevels - 1, 0));
        return {
          currentLabel: `${formatShardComputedMultiplier(current)} (descriptive model)`,
          nextLabel: `${formatShardComputedMultiplier(next)}`
        };
      }
      if (unlockLevel === null || unlockLevel === 1) {
        const current = Math.pow(perLevelDescriptor.value, observedLevel);
        const next = Math.pow(perLevelDescriptor.value, observedLevel + 1);
        return {
          currentLabel: `${formatShardComputedMultiplier(current)} (per-level multiplicative model)`,
          nextLabel: `${formatShardComputedMultiplier(next)}`
        };
      }
    }
    if (initialDescriptor?.kind === "seconds" && perLevelDescriptor?.kind === "seconds-per-level") {
      const current =
        initialDescriptor.value + perLevelDescriptor.value * Math.max(activeLevels - 1, 0);
      const next =
        initialDescriptor.value + perLevelDescriptor.value * Math.max(nextActiveLevels - 1, 0);
      return {
        currentLabel: `${formatShardComputedSeconds(current)} (descriptive model)`,
        nextLabel: formatShardComputedSeconds(next)
      };
    }
    return {
      currentLabel: "Current value unresolved from checked inputs",
      nextLabel: "Need typed bonus model or known initial value"
    };
  }

  function getShardUnlockRequirement(milestone) {
    if (milestone?.unlockCondition?.type === "total_milestone_levels_required") {
      return Number(milestone.unlockCondition.value || 0);
    }
    return 0;
  }

  function getNextShardUnlockMilestone(totalLevels, milestones = getGroundedShardMilestones()) {
    return (
      milestones
        .filter(
          (milestone) => milestone.unlockCondition?.type === "total_milestone_levels_required"
        )
        .sort((left, right) => getShardUnlockRequirement(left) - getShardUnlockRequirement(right))
        .find((milestone) => getShardUnlockRequirement(milestone) > totalLevels) || null
    );
  }

  function normalizeShardRarityKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getThresholdScheduleForMilestone(milestone, mechanics = getGroundedShardMechanics()) {
    if (Array.isArray(milestone?.fixedBreakpoints) && milestone.fixedBreakpoints.length) {
      return milestone.fixedBreakpoints;
    }
    const rarity = normalizeShardRarityKey(milestone?.rarity);
    return (
      Object.entries(mechanics.rarity_bonus_thresholds ?? {})
        .filter(([key]) => key !== "source_ids")
        .find(([key]) => normalizeShardRarityKey(key) === rarity)?.[1] ?? []
    );
  }

  function getNextShardThreshold(milestone, currentLevel, mechanics = getGroundedShardMechanics()) {
    return (
      getThresholdScheduleForMilestone(milestone, mechanics).find(
        (level) => Number(level) > Number(currentLevel || 0)
      ) ?? null
    );
  }

  function getNextShardCostBump(currentLevel) {
    const level = Number(currentLevel || 0);
    const nextHundred = Math.floor(level / 100) * 100 + 100;
    if (!Number.isFinite(nextHundred) || nextHundred <= 0) {
      return null;
    }
    let severity = "larger bump";
    if (nextHundred === 100 || nextHundred === 400) {
      severity = "large bump";
    } else if (nextHundred === 200 || nextHundred === 300) {
      severity = "small bump";
    }
    return { level: nextHundred, severity };
  }

  function getSourceTitlesForIds(sourceIds = []) {
    const sourceMap = getShardGrounding()?.provenance?.sources ?? {};
    return sourceIds.map((sourceId) => sourceMap[sourceId]?.title).filter(Boolean);
  }

  function getMilestoneSourceLabel(milestone) {
    const titles = getSourceTitlesForIds(milestone?.sourceIds || []);
    return titles.length ? titles.join(" | ") : "";
  }

  function getProvenanceConflictNote() {
    return (
      (getShardGrounding()?.provenance?.uncertaintyLog ?? []).find(
        (entry) => entry.status === "conflict_detected"
      )?.what_is_missing || ""
    );
  }

  function describeUnlockCondition(unlockCondition = {}) {
    if (unlockCondition.type === "total_milestone_levels_required") {
      return `${formatShardNumber(unlockCondition.value)} total milestone levels`;
    }
    if (unlockCondition.type === "event") {
      return String(unlockCondition.value || "Event unlock");
    }
    return "No grounded unlock condition captured";
  }

  function formatShardRarity(value) {
    const text = String(value || "").trim();
    return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown";
  }

  function formatThresholdLevels(levels) {
    return Array.isArray(levels) && levels.length
      ? levels.join(" / ")
      : "No explicit thresholds captured";
  }

  function formatOptionalNumber(value) {
    return value === null || value === undefined || value === "" || Number.isNaN(Number(value))
      ? "Not tracked"
      : formatShardNumber(value);
  }

  return {
    describeUnlockCondition,
    formatOptionalNumber,
    formatProbeNumber,
    formatShardExtractedBonusPerLevel,
    formatShardExtractedCostFieldMapping,
    formatShardRarity,
    formatThresholdLevels,
    formatThresholdScheduleSummary,
    formatVerifiedShardBonusPackage,
    getDefaultShardFocusMilestoneId,
    getMilestoneSourceLabel,
    getNextShardCostBump,
    getNextShardThreshold,
    getNextShardUnlockMilestone,
    getProvenanceConflictNote,
    getShardComputedBonusSummary,
    getShardExtractedBonusPerLevel,
    getShardExtractedCostFieldMapping,
    getShardExtractedUnlockRequirement,
    getShardFormulaApplicationProfile,
    getShardMilestoneEvidenceCounts,
    getShardMilestoneEvidenceRow,
    getShardMilestoneFamilyEvidence,
    getShardMilestoneDisplayMeta,
    getShardMilestoneDisplayName,
    getShardDefinitionEvidenceSummary,
    getShardMilestoneGroundedSummary,
    getShardMilestoneLevelRailSummary,
    getShardMilestonePanelTitle,
    getShardNativeCostStageSummary,
    getShardOwnedStateBlockerSummary,
    getShardUnlockRequirement,
    getSourceTitlesForIds,
    getThresholdScheduleForMilestone,
    getVerifiedShardRowPackages,
    normalizeShardRarityKey,
    parseShardBonusDescriptor,
    parseShardNumericLabel
  };
}
