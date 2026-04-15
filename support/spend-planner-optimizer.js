export function createTokenShopOptimizer(
  getTokenShopProgressionModel,
  getPlayerTokens,
  getPlayerDiamonds
) {
  const getModel = getTokenShopProgressionModel;
  const getTokens = getPlayerTokens;
  const getDiamonds = getPlayerDiamonds;

  function buildUpgradeList() {
    const model = getModel();
    if (!model || !model.rows) {
      return [];
    }

    return model.rows.map((row) => ({
      row,
      currentLevel: row.currentLevel || 0
    }));
  }

  function calculateNextCost(row) {
    const startCost = row.startCost;
    const additiveCost = row.additiveCost;
    const currentLevel = row.currentLevel || 0;
    const maxLevel = row.maxLevel;

    if (typeof maxLevel === "number" && currentLevel >= maxLevel) {
      return { cost: null, isMaxed: true };
    }

    if (typeof startCost !== "number" || typeof additiveCost !== "number") {
      return { cost: null, isMaxed: false };
    }

    const cost = startCost + additiveCost * currentLevel;
    return { cost, isMaxed: false };
  }

  function calculateBenefit(row) {
    const bonus = row.bonusValue;
    const currentLevel = row.currentLevel || 0;
    const maxLevel = row.maxLevel;
    const bonusMode = row.bonusMode || "additive";

    if (typeof maxLevel === "number" && currentLevel >= maxLevel) {
      return { benefit: 0, incremental: 0, isMaxed: true };
    }

    if (typeof bonus !== "number") {
      return { benefit: 0, incremental: 0, isMaxed: false };
    }

    const incremental = bonusMode === "multiplier" ? bonus - 1 : bonus;
    return {
      benefit: bonusMode === "multiplier" ? bonus : currentLevel * bonus,
      incremental,
      isMaxed: false
    };
  }

  function evaluateUpgrade(row, currencyAmount, currencyType = "tokens") {
    const costInfo = calculateNextCost(row);
    const benefitInfo = calculateBenefit(row);

    if (costInfo.isMaxed) {
      return { ...row, affordable: false, reason: "Max level reached", value: null };
    }

    if (costInfo.cost === null) {
      return { ...row, affordable: false, reason: "Cost unavailable", value: null };
    }

    const canAfford = costInfo.cost <= currencyAmount;
    const value = benefitInfo.incremental / costInfo.cost;

    return {
      ...row,
      currentLevel: row.currentLevel || 0,
      nextLevel: (row.currentLevel || 0) + 1,
      cost: costInfo.cost,
      benefit: benefitInfo.incremental,
      bonusMode: row.bonusMode,
      bonusLabel: row.bonusStepLabel,
      value,
      affordable: canAfford,
      currencyType,
      remainingAfter: canAfford ? currencyAmount - costInfo.cost : null
    };
  }

  function rankByValue(evaluations) {
    return evaluations
      .filter((e) => e.affordable && e.value !== null)
      .sort((a, b) => b.value - a.value);
  }

  function rankByBenefit(evaluations) {
    return evaluations.filter((e) => e.affordable).sort((a, b) => b.benefit - a.benefit);
  }

  function rankByCost(evaluations) {
    return evaluations.filter((e) => e.affordable).sort((a, b) => a.cost - b.cost);
  }

  function getRecommendations(currencyType = "tokens") {
    const upgrades = buildUpgradeList();
    const currencyAmount = currencyType === "diamonds" ? getDiamonds() : getTokens();

    if (typeof currencyAmount !== "number" || currencyAmount <= 0) {
      return {
        currencyType,
        currencyAmount: 0,
        message: `Enter ${currencyType} to see upgrade recommendations`,
        recommendations: []
      };
    }

    const evaluations = upgrades.map((u) => evaluateUpgrade(u.row, currencyAmount, currencyType));
    const ranked = rankByValue(evaluations);

    const grouped = {
      byValue: ranked.slice(0, 5),
      byBenefit: rankByBenefit(evaluations).slice(0, 5),
      byCost: rankByCost(evaluations).slice(0, 5),
      unaffordable: evaluations.filter((e) => !e.affordable && e.cost !== null),
      maxed: evaluations.filter((e) => e.reason === "Max level reached")
    };

    return {
      currencyType,
      currencyAmount,
      totalUpgrades: upgrades.length,
      affordableCount: ranked.length,
      recommendations: ranked.slice(0, 5),
      grouped,
      nextBest: ranked[0] || null
    };
  }

  function getFullAnalysis() {
    const tokenRecs = getRecommendations("tokens");
    const diamondRecs = getRecommendations("diamonds");

    return {
      tokens: tokenRecs,
      diamonds: diamondRecs,
      summary: {
        tokenNextBest: tokenRecs.nextBest,
        diamondNextBest: diamondRecs.nextBest,
        canOptimize: tokenRecs.affordableCount > 0 || diamondRecs.affordableCount > 0
      }
    };
  }

  return {
    getRecommendations,
    getFullAnalysis,
    buildUpgradeList,
    evaluateUpgrade
  };
}

export function formatUpgradeRecommendation(rec) {
  if (!rec) return "No recommendation available";

  const valueLabel = (rec.value * 100).toFixed(2);
  const benefitLabel =
    rec.bonusMode === "multiplier"
      ? `x${rec.bonusLabel}`
      : `+${rec.benefit.toFixed(2)} ${rec.bonusLabel}`;

  return {
    name: rec.identity || rec.slot || rec.field,
    currentLevel: rec.currentLevel,
    nextLevel: rec.nextLevel,
    cost: rec.cost,
    benefit: benefitLabel,
    valuePercent: valueLabel,
    canAfford: rec.affordable
  };
}
