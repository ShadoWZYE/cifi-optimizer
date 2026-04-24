export const TOKEN_SHOP_OPTIMIZER_VERSION = "1.0.0";

export const TOKEN_COST_FORMULA = {
  type: "linear",
  startCostField: "StartCost",
  additiveCostField: "AdditiveCost",
  getNextCost: (currentLevel, startCost, additiveCost) => {
    return startCost + additiveCost * currentLevel;
  }
};

export const DIAMOND_COST_FORMULA = {
  type: "linear",
  startCostField: "StartCost",
  additiveCostField: "AdditiveCost",
  getNextCost: (currentLevel, startCost, additiveCost) => {
    return startCost + additiveCost * currentLevel;
  }
};

export function calculateUpgradeCost(row, currentLevel) {
  if (!row || typeof currentLevel !== "number") {
    return null;
  }

  const startCost = row.startCost;
  const additiveCost = row.additiveCost;

  if (typeof startCost !== "number" || typeof additiveCost !== "number") {
    return null;
  }

  if (typeof row.maxLevel === "number" && currentLevel >= row.maxLevel) {
    return { cost: null, isMaxed: true };
  }

  const nextLevel = currentLevel + 1;
  const cost = startCost + additiveCost * currentLevel;

  return { cost, isMaxed: false, nextLevel };
}

export function calculateUpgradeBenefit(row, currentLevel) {
  if (!row) {
    return null;
  }

  const bonus = row.bonusValue;
  const bonusMode = row.bonusMode;
  const maxLevel = row.maxLevel;

  if (typeof bonus !== "number") {
    return null;
  }

  const isMaxed = typeof maxLevel === "number" && currentLevel >= maxLevel;
  if (isMaxed) {
    return { benefit: 0, isMaxed: true, incremental: 0 };
  }

  const incrementalBenefit = bonusMode === "multiplier" ? bonus - 1 : bonus;

  return {
    benefit: bonusMode === "multiplier" ? bonus : currentLevel * bonus,
    incremental: incrementalBenefit,
    isMaxed: false,
    bonusMode
  };
}

export function calculateUpgradeValue(row, currentLevel, availableTokens) {
  const costInfo = calculateUpgradeCost(row, currentLevel);
  const benefitInfo = calculateUpgradeBenefit(row, currentLevel);

  if (!costInfo || !benefitInfo || costInfo.isMaxed || costInfo.cost === null) {
    return null;
  }

  const canAfford = costInfo.cost <= availableTokens;
  const value = benefitInfo.incremental / costInfo.cost;

  return {
    rowId: row.field,
    rowName: row.identity || row.slot,
    currentLevel,
    nextLevel: costInfo.nextLevel,
    cost: costInfo.cost,
    benefit: benefitInfo.incremental,
    value,
    canAfford,
    bonusMode: benefitInfo.bonusMode,
    bonusLabel: row.bonusStepLabel || "bonus"
  };
}

export function rankUpgradesByValue(upgradeList, availableTokens) {
  const ranked = upgradeList
    .map((upgrade) => calculateUpgradeValue(upgrade.row, upgrade.currentLevel, availableTokens))
    .filter((v) => v !== null && v.canAfford)
    .sort((a, b) => b.value - a.value);

  return ranked;
}

export function getNextBestUpgrade(upgradeList, availableTokens) {
  const ranked = rankUpgradesByValue(upgradeList, availableTokens);
  return ranked.length > 0 ? ranked[0] : null;
}

export function getAffordableUpgrades(upgradeList, availableTokens) {
  return upgradeList
    .map((upgrade) => calculateUpgradeValue(upgrade.row, upgrade.currentLevel, availableTokens))
    .filter((v) => v !== null && v.canAfford)
    .sort((a, b) => b.value - a.value);
}

export function getFullUpgradeAnalysis(upgradeList, availableTokens) {
  const all = upgradeList.map((upgrade) =>
    calculateUpgradeValue(upgrade.row, upgrade.currentLevel, availableTokens)
  );
  const affordable = all.filter((v) => v && v.canAfford);
  const unaffordable = all.filter((v) => v && !v.canAfford);
  const maxed = all.filter((v) => v === null || v.isMaxed);

  const ranked = [...affordable].sort((a, b) => b.value - a.value);

  return {
    ranked,
    affordableCount: affordable.length,
    unaffordableCount: unaffordable.length,
    maxedCount: maxed.length,
    totalTokens: availableTokens,
    nextBest: ranked.length > 0 ? ranked[0] : null,
    nextThree: ranked.slice(0, 3)
  };
}

export const OPTIMIZER_CATEGORIES = {
  tokenBoosters: {
    filter: (row) =>
      row.field.includes("ATU1") ||
      row.field.includes("ATU5") ||
      row.field.includes("ATU6") ||
      row.field.includes("ATU7") ||
      row.field.includes("ATU8") ||
      row.field.includes("ATU9") ||
      row.field.includes("ATU10") ||
      row.field.includes("ATU12"),
    label: "Token Output Boosters",
    description: "Generator boosters that increase Token output per loop"
  },
  diamondBoosters: {
    filter: (row) => row.field.includes("ATU2"),
    label: "Diamond Boosters",
    description: "Boosters that increase Diamond output"
  },
  cellBoosters: {
    filter: (row) => row.field.includes("ATU3"),
    label: "Cell Boosters",
    description: "Boosters that increase Cells from chests"
  },
  modBoosters: {
    filter: (row) => row.field.includes("ATU4"),
    label: "Mod Point Boosters",
    description: "Boosters that increase Mod Points"
  },
  tokenChests: {
    filter: (row) => row.field.includes("ATU13") || row.field.includes("ATU20"),
    label: "Token Chest Boosters",
    description: "Boosters that increase Tokens gained from chests"
  },
  dailyTokenium: {
    filter: (row) =>
      row.field.includes("ATU14") ||
      row.field.includes("ATU15") ||
      row.field.includes("ATU16") ||
      row.field.includes("ATU17") ||
      row.field.includes("ATU18") ||
      row.field.includes("ATU19") ||
      row.field.includes("ATU21") ||
      row.field.includes("ATU22") ||
      row.field.includes("ATU24") ||
      row.field.includes("ATU25") ||
      row.field.includes("ATU26") ||
      row.field.includes("ATU27") ||
      row.field.includes("ATU28"),
    label: "Daily Tokenium",
    description: "Daily Tokenium cap and bonus boosters (separate currency)"
  }
};

export function getCategoryBreakdown(upgradeList) {
  const categories = {};

  for (const [catKey, catDef] of Object.entries(OPTIMIZER_CATEGORIES)) {
    const filtered = upgradeList.filter((u) => catDef.filter(u.row));
    categories[catKey] = {
      ...catDef,
      count: filtered.length,
      upgrades: filtered
    };
  }

  return categories;
}
