import { getTokenShopRowMeta, getTokenShopRowTitle } from "./token-shop-row-meta.js";
import {
  DEFAULT_SPEND_OBJECTIVE_ID,
  getTokenShopFamilyProgressionLens
} from "./progression-model.js";

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

const PROGRESSION_FAMILY_META = Object.freeze({
  "token-chest": Object.freeze({
    label: "Chest income",
    impactWeight: 1.35,
    additiveUnitScale: 0.5,
    reason: "Improves Token chest income, which feeds future TokenShop purchases."
  }),
  "diamond-chest": Object.freeze({
    label: "Diamond income",
    impactWeight: 0.75,
    additiveUnitScale: 1,
    reason: "Helps diamond-side progression, but it is not the main TokenShop loop."
  }),
  "cells-chest": Object.freeze({
    label: "Chest cells",
    impactWeight: 0.9,
    additiveUnitScale: 1,
    reason: "Improves chest-derived Cells, which supports adjacent progression but not direct Token loops."
  }),
  "mod-points": Object.freeze({
    label: "Mod points",
    impactWeight: 1.05,
    additiveUnitScale: 0.01,
    reason: "Improves Mod Point progression with a grounded multiplicative lane."
  }),
  "generator-output": Object.freeze({
    label: "Generator output",
    impactWeight: 1.45,
    additiveUnitScale: 0.01,
    reason: "Improves permanent generator output, a core long-run progression lane."
  }),
  "daily-tokenium": Object.freeze({
    label: "Daily Tokenium",
    impactWeight: 0.58,
    additiveUnitScale: 0.2,
    reason: "Improves the separate Daily Tokenium lane, which is useful but not the main Token spend loop."
  }),
  "duo-booster": Object.freeze({
    label: "Duo chain",
    impactWeight: 1.08,
    additiveUnitScale: 0.02,
    reason: "Improves the Duo progression chain and is strongest once the mid tiers are open."
  }),
  "trinity-booster": Object.freeze({
    label: "Trinity chain",
    impactWeight: 1.16,
    additiveUnitScale: 0.03,
    reason: "Improves the Trinity progression chain and becomes relevant in the later visible tiers."
  }),
  "late-ultima": Object.freeze({
    label: "Ultima lane",
    impactWeight: 0.68,
    additiveUnitScale: 100,
    reason: "Late Ultima rows are expensive and currently treated as late-lane progression helpers."
  }),
  default: Object.freeze({
    label: "Checked lane",
    impactWeight: 1,
    additiveUnitScale: 1,
    reason: "Grounded checked row with no stronger family-specific weighting yet."
  })
});

function getRowFamilyMeta(row) {
  const meta = getTokenShopRowMeta(row?.field);
  return PROGRESSION_FAMILY_META[meta?.progressionFamily] || PROGRESSION_FAMILY_META.default;
}

function getRowProgressionLens(row, context = {}) {
  const meta = getTokenShopRowMeta(row?.field);
  const progressionLens = getTokenShopFamilyProgressionLens(
    context?.progressionModel,
    context?.objectiveId || DEFAULT_SPEND_OBJECTIVE_ID
  );
  return progressionLens.get(meta?.progressionFamily) || null;
}

function getTierOrdinal(tierKey) {
  switch (String(tierKey || "").trim()) {
    case "t4":
      return 4;
    case "t3":
      return 3;
    case "t2":
      return 2;
    default:
      return 1;
  }
}

function getHighestUnlockedTier(states = {}) {
  if (states.t4) return "t4";
  if (states.t3) return "t3";
  if (states.t2) return "t2";
  return "t1";
}

function getRowTierWeight(row, context = {}) {
  const rowTier = getTierOrdinal(row?.storeTier || row?.tierKey || "t1");
  const activeTier = getTierOrdinal(getHighestUnlockedTier(context?.tierStates || {}));
  if (rowTier === activeTier) {
    return 1.16;
  }
  if (rowTier < activeTier) {
    return 0.94;
  }
  return 0.84;
}

function getUnlockPressureWeight(row, context = {}) {
  const tierKey = String(row?.storeTier || row?.tierKey || "t1").trim();
  if (!tierKey || tierKey === "t4") {
    return 1;
  }
  const nextTier = tierKey === "t1" ? "t2" : tierKey === "t2" ? "t3" : "t4";
  if (context?.tierStates?.[nextTier]) {
    return 1;
  }
  const remainingLevels = Number(context?.tierLevelsRemaining?.[nextTier]);
  if (!Number.isFinite(remainingLevels)) {
    return 1;
  }
  if (remainingLevels <= 5) {
    return 1.18;
  }
  if (remainingLevels <= 15) {
    return 1.1;
  }
  return 1.04;
}

function getNormalizedProgressionGain(row, benefitInfo) {
  const familyMeta = getRowFamilyMeta(row);
  if (benefitInfo?.bonusMode === "multiplier") {
    const rawBonus = typeof row?.bonusValue === "number" ? row.bonusValue : 1;
    return Math.max(0, rawBonus - 1);
  }
  const additiveScale = familyMeta.additiveUnitScale || 1;
  return Math.max(0, (benefitInfo?.incremental || 0) / additiveScale);
}

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

  const currentMagnitude =
    bonusMode === "multiplier" ? Math.pow(bonus || 1, currentLevel) : currentLevel * bonus;
  const nextMagnitude =
    bonusMode === "multiplier"
      ? Math.pow(bonus || 1, currentLevel + 1)
      : (currentLevel + 1) * bonus;
  const incrementalBenefit = nextMagnitude - currentMagnitude;

  return {
    benefit: currentMagnitude,
    incremental: incrementalBenefit,
    isMaxed: false,
    bonusMode
  };
}

export function calculateUpgradeValue(row, currentLevel, availableTokens, context = {}) {
  const costInfo = calculateUpgradeCost(row, currentLevel);
  const benefitInfo = calculateUpgradeBenefit(row, currentLevel);

  if (!costInfo || !benefitInfo || costInfo.isMaxed || costInfo.cost === null) {
    return null;
  }

  const canAfford = costInfo.cost <= availableTokens;
  const familyMeta = getRowFamilyMeta(row);
  const progressionLens = getRowProgressionLens(row, context);
  const normalizedGain = getNormalizedProgressionGain(row, benefitInfo);
  const fallbackImpactWeight = familyMeta.impactWeight;
  const lensWeight =
    typeof progressionLens?.scoreMultiplier === "number" && Number.isFinite(progressionLens.scoreMultiplier)
      ? progressionLens.scoreMultiplier
      : 1;
  const progressionWeight =
    fallbackImpactWeight *
    lensWeight *
    getRowTierWeight(row, context) *
    getUnlockPressureWeight(row, context);
  const value = normalizedGain > 0 ? (normalizedGain * progressionWeight) / costInfo.cost : 0;

  return {
    rowId: row.field,
    rowName: getTokenShopRowTitle(row.field, row.identity || row.slot),
    currentLevel,
    nextLevel: costInfo.nextLevel,
    cost: costInfo.cost,
    benefit: benefitInfo.incremental,
    normalizedGain,
    progressionWeight,
    value,
    canAfford,
    bonusMode: benefitInfo.bonusMode,
    bonusLabel: row.bonusStepLabel || "bonus",
    familyLabel: familyMeta.label,
    recommendationReason: familyMeta.reason,
    progressionNotes: Array.isArray(progressionLens?.notes) ? progressionLens.notes : [],
    progressionCarrierId: progressionLens?.carrierId || null,
    progressionCarrierLabel: progressionLens?.carrierLabel || null,
    progressionObjectiveId: progressionLens?.objectiveId || context?.objectiveId || DEFAULT_SPEND_OBJECTIVE_ID,
    progressionObjectiveLabel: progressionLens?.objectiveLabel || "Short-run Token Acceleration",
    progressionConfidenceLabel: progressionLens?.confidenceLabel || "Heuristic fallback"
  };
}

export function rankUpgradesByValue(upgradeList, availableTokens, context = {}) {
  const ranked = upgradeList
    .map((upgrade) => calculateUpgradeValue(upgrade.row, upgrade.currentLevel, availableTokens, context))
    .filter((v) => v !== null && v.canAfford)
    .sort((a, b) => b.value - a.value);

  return ranked;
}

export function getNextBestUpgrade(upgradeList, availableTokens, context = {}) {
  const ranked = rankUpgradesByValue(upgradeList, availableTokens, context);
  return ranked.length > 0 ? ranked[0] : null;
}

export function getAffordableUpgrades(upgradeList, availableTokens, context = {}) {
  return upgradeList
    .map((upgrade) => calculateUpgradeValue(upgrade.row, upgrade.currentLevel, availableTokens, context))
    .filter((v) => v !== null && v.canAfford)
    .sort((a, b) => b.value - a.value);
}

export function getFullUpgradeAnalysis(upgradeList, availableTokens, context = {}) {
  const all = upgradeList.map((upgrade) =>
    calculateUpgradeValue(upgrade.row, upgrade.currentLevel, availableTokens, context)
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
