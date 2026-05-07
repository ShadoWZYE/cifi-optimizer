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
    const bonusValue = getTokenShopNumericFieldValue(tokenShop, row.bonusField);
    const maxLevel = getTokenShopNumericFieldValue(tokenShop, row.maxLevelField);
    const hasLevel = typeof currentLevel === "number" && Number.isFinite(currentLevel);
    const isMaxed = hasLevel && typeof maxLevel === "number" && currentLevel >= maxLevel;
    const nextKnownCost =
      hasLevel && !isMaxed && typeof startCost === "number" && typeof additiveCost === "number"
        ? startCost + additiveCost * currentLevel
        : null;
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
      nextKnownCost,
      isAffordable,
      isMaxed,
      maxLevel,
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
