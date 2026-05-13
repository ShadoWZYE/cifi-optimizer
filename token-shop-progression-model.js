export function getTokenShopNumericFieldValue(tokenShop, fieldName) {
  const fields = Array.isArray(tokenShop?.fields) ? tokenShop.fields : [];
  const entry = fields.find((field) => field?.field === fieldName && field?.kind === "number");
  return typeof entry?.value === "number" ? entry.value : null;
}

export function resolveTokenShopProgressionLevelSource(
  fieldName,
  progressionState,
  compatibilityLevels
) {
  const playerStateValue = progressionState?.checkedSubsetPlayerState?.[fieldName];
  if (typeof playerStateValue === "number" && Number.isFinite(playerStateValue)) {
    return {
      value: playerStateValue,
      sourceLabel: "Checked player state",
      path: `planning.tokenShop.checkedSubsetPlayerState.${fieldName}`
    };
  }
  const compatibilityValue = compatibilityLevels?.[fieldName];
  if (typeof compatibilityValue === "number" && Number.isFinite(compatibilityValue)) {
    return {
      value: compatibilityValue,
      sourceLabel: "Compatibility fallback",
      path: `compatibility.unmappedSystemState.tokenShop.${fieldName}`
    };
  }
  return {
    value: 0,
    sourceLabel: "Default level 0",
    path: `planning.tokenShop.checkedSubsetPlayerState.${fieldName}`
  };
}

function getTokenShopNumericFieldValues(tokenShop, fieldNames) {
  return (Array.isArray(fieldNames) ? fieldNames : [])
    .map((fieldName) => ({
      field: fieldName,
      value: getTokenShopNumericFieldValue(tokenShop, fieldName)
    }))
    .filter((entry) => typeof entry.field === "string" && entry.field);
}

function resolveTokenShopCostState(row, currentLevel, startCost, additiveCost, maxLevel) {
  const costFormulaType = String(row?.costFormulaType || "linear").trim() || "linear";
  const costFormulaConfidence = String(row?.costFormulaConfidence || "verified").trim() || "verified";
  const hasLevel = typeof currentLevel === "number" && Number.isFinite(currentLevel);
  const isMaxed =
    hasLevel && typeof maxLevel === "number" && Number.isFinite(maxLevel) && currentLevel >= maxLevel;

  if (isMaxed) {
    return {
      costFormulaType,
      costFormulaConfidence,
      nextKnownCost: null,
      projectedNextCost: null,
      isMaxed: true,
      costFormulaLabel: "No next cost within known cap",
      costFormulaKnown: true,
      costFormulaProjected: false
    };
  }

  if (costFormulaType === "start-only") {
    const hasStartCost = typeof startCost === "number" && Number.isFinite(startCost);
    const nextKnownCost = hasLevel && currentLevel === 0 && hasStartCost ? startCost : null;
    return {
      costFormulaType,
      costFormulaConfidence,
      nextKnownCost,
      projectedNextCost: nextKnownCost,
      isMaxed: false,
      costFormulaKnown: hasStartCost,
      costFormulaProjected: false,
      costFormulaLabel:
        hasStartCost && currentLevel === 0
          ? `Known first-purchase cost: ${startCost}.`
          : hasStartCost
            ? "Only the first-purchase cost is grounded in this build."
            : "Known cost inputs are incomplete in this build."
    };
  }

  const hasLinearInputs =
    typeof startCost === "number" &&
    Number.isFinite(startCost) &&
    typeof additiveCost === "number" &&
    Number.isFinite(additiveCost);
  const projectedNextCost = hasLevel && hasLinearInputs ? startCost + additiveCost * currentLevel : null;
  if (costFormulaConfidence === "projected") {
    return {
      costFormulaType,
      costFormulaConfidence,
      nextKnownCost: null,
      projectedNextCost,
      isMaxed: false,
      costFormulaKnown: hasLinearInputs,
      costFormulaProjected: hasLinearInputs,
      costFormulaLabel: hasLinearInputs
        ? `Projected linear cost from extracted StartCost/AdditiveCost: start ${startCost} + additive ${additiveCost} x current level. Exact runtime formula is still unverified for this row.`
        : "Known cost inputs are incomplete in this build."
    };
  }
  return {
    costFormulaType,
    costFormulaConfidence,
    nextKnownCost: projectedNextCost,
    projectedNextCost,
    isMaxed: false,
    costFormulaKnown: hasLinearInputs,
    costFormulaProjected: false,
    costFormulaLabel: hasLinearInputs
      ? `Known cost inputs: start ${startCost} + additive ${additiveCost} x current level.`
      : "Known cost inputs are incomplete in this build."
  };
}

export function buildTokenShopProgressionModel({
  progressionState,
  compatibilityLevels,
  boundary,
  tokenShop,
  currentTokens,
  getGroundedSubsetDefinitions,
  getKnownMaxStatus,
  getCurrentVsNextBonusSummary
}) {
  const rows = getGroundedSubsetDefinitions(boundary).map((row) => {
    const levelSource = resolveTokenShopProgressionLevelSource(
      row.field,
      progressionState,
      compatibilityLevels
    );
    const currentLevel = levelSource.value;

    const startCost = getTokenShopNumericFieldValue(tokenShop, row.startCostField);
    const additiveCost = getTokenShopNumericFieldValue(tokenShop, row.additiveCostField);
    const bonusValues = getTokenShopNumericFieldValues(tokenShop, row.bonusFields);
    const bonusValue =
      getTokenShopNumericFieldValue(tokenShop, row.bonusField) ??
      bonusValues.find((entry) => typeof entry?.value === "number")?.value ??
      null;
    const maxLevel = getTokenShopNumericFieldValue(tokenShop, row.maxLevelField);
    const bonusMode = String(row?.bonusMode || row?.bonusStepMode || "additive").trim() || "additive";
    const costState = resolveTokenShopCostState(row, currentLevel, startCost, additiveCost, maxLevel);
    const nextKnownCost = costState.nextKnownCost;
    const isAffordable =
      typeof nextKnownCost === "number" && typeof currentTokens === "number"
        ? currentTokens >= nextKnownCost
        : null;

    return {
      ...row,
      currentLevel,
      currentLevelPath: levelSource.path,
      currentLevelSourceLabel: levelSource.sourceLabel,
      startCost,
      additiveCost,
      bonusValue,
      bonusValues,
      bonusMode,
      nextKnownCost,
      projectedNextCost: costState.projectedNextCost,
      isAffordable,
      isMaxed: costState.isMaxed,
      maxLevel,
      costFormulaType: costState.costFormulaType,
      costFormulaConfidence: costState.costFormulaConfidence,
      costFormulaKnown: costState.costFormulaKnown,
      costFormulaProjected: costState.costFormulaProjected,
      costFormulaLabel: costState.costFormulaLabel,
      maxStatus: getKnownMaxStatus(currentLevel, maxLevel),
      currentVsNextBonus: getCurrentVsNextBonusSummary(row, currentLevel, maxLevel, bonusValue)
    };
  });

  return {
    currentTokens,
    displayRule:
      "Rows are shown in grounded ATU slot order by visible in-game tier shell: T1 (ATU1-ATU12), T2 (ATU13-ATU19), T3 (ATU20-ATU23), T4 (ATU24-ATU28). Player-profile checked state is primary, compatibility is fallback only, and tier locks remain heuristic policy until stronger in-game gating clears.",
    rows,
    playerStateCount: rows.filter((row) => row.currentLevelSourceLabel === "Checked player state")
      .length,
    compatibilityCount: rows.filter(
      (row) => row.currentLevelSourceLabel === "Compatibility fallback"
    ).length,
    defaultCount: rows.filter((row) => row.currentLevelSourceLabel === "Default level 0").length,
    affordableCount: rows.filter((row) => row.isAffordable === true).length,
    knownCapCount: rows.filter((row) => row.maxStatus.label === "At or above known cap").length
  };
}
