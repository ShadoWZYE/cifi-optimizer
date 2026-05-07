import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateUpgradeBenefit,
  calculateUpgradeCost,
  getFullUpgradeAnalysis
} from "../support/token-shop-optimizer.js";
import { buildSpendProgressionModel } from "../support/progression-model.js";
import tokenShopSystemUnit from "../data/units/token-shop.v1.json" with { type: "json" };
import multiverseMarketSystemUnit from "../data/units/multiverse-market.v1.json" with { type: "json" };

test("calculateUpgradeBenefit uses next-step delta for multiplier rows", () => {
  const result = calculateUpgradeBenefit(
    {
      bonusValue: 1.3,
      bonusMode: "multiplier",
      maxLevel: 10
    },
    2
  );

  assert.equal(result.isMaxed, false);
  assert.equal(Number(result.benefit.toFixed(4)), Number((1.3 ** 2).toFixed(4)));
  assert.equal(Number(result.incremental.toFixed(4)), Number(((1.3 ** 3) - (1.3 ** 2)).toFixed(4)));
});

test("getFullUpgradeAnalysis ranks affordable grounded upgrades by next-step value", () => {
  const analysis = getFullUpgradeAnalysis(
    [
      {
        currentLevel: 2,
        row: {
          field: "ATU5Level",
          slot: "ATU5",
          identity: "Mk1 Generator Booster",
          startCost: 10,
          additiveCost: 5,
          bonusValue: 1.5,
          bonusMode: "multiplier",
          bonusStepLabel: "Mk1 Output",
          maxLevel: 10
        }
      },
      {
        currentLevel: 0,
        row: {
          field: "ATU1Level",
          slot: "ATU1",
          identity: "Tokens Boost",
          startCost: 30,
          additiveCost: 0,
          bonusValue: 0.2,
          bonusMode: "additive",
          bonusStepLabel: "Tokens from chests",
          maxLevel: 10
        }
      }
    ],
    40
  );

  assert.equal(analysis.affordableCount, 2);
  assert.equal(analysis.nextBest.rowId, "ATU5Level");
  assert.equal(analysis.nextThree.length, 2);
  assert.equal(analysis.nextBest.familyLabel, "Generator output");
});

test("getFullUpgradeAnalysis applies progression-family weighting across visible tiers", () => {
  const progressionModel = buildSpendProgressionModel({
    tokenShopSystemUnit,
    multiverseMarketSystemUnit
  });
  const analysis = getFullUpgradeAnalysis(
    [
      {
        currentLevel: 0,
        row: {
          field: "ATU14Level",
          storeTier: "t2",
          identity: "Daily Tokenium Trigger",
          startCost: 1000,
          additiveCost: 800,
          bonusValue: 1.2,
          bonusMode: "multiplier",
          bonusStepLabel: "Daily Tokenium bonus",
          maxLevel: 10
        }
      },
      {
        currentLevel: 0,
        row: {
          field: "ATU13Level",
          storeTier: "t2",
          identity: "Tokens Booster T2",
          startCost: 1000,
          additiveCost: 500,
          bonusValue: 0.5,
          bonusMode: "additive",
          bonusStepLabel: "Tokens from chests",
          maxLevel: 10
        }
      }
    ],
    1500,
    {
      progressionModel,
      objectiveId: "objective:token-shop-short-run",
      tierStates: { t1: true, t2: true, t3: false, t4: false },
      tierLevelsRemaining: { t2: 0, t3: 5, t4: 55 }
    }
  );

  assert.equal(analysis.affordableCount, 2);
  assert.equal(analysis.nextBest.rowId, "ATU13Level");
  assert.match(analysis.nextBest.recommendationReason, /Token chest income/i);
});

test("getFullUpgradeAnalysis exposes progression-model carrier context", () => {
  const progressionModel = buildSpendProgressionModel({
    tokenShopSystemUnit,
    multiverseMarketSystemUnit
  });
  const analysis = getFullUpgradeAnalysis(
    [
      {
        currentLevel: 0,
        row: {
          field: "ATU4Level",
          storeTier: "t1",
          identity: "Mod Booster",
          startCost: 100,
          additiveCost: 25,
          bonusValue: 1.2,
          bonusMode: "multiplier",
          bonusStepLabel: "Mod Points",
          maxLevel: 10
        }
      }
    ],
    500,
    {
      progressionModel,
      objectiveId: "objective:token-shop-short-run",
      tierStates: { t1: true, t2: false, t3: false, t4: false },
      tierLevelsRemaining: { t2: 25, t3: 50, t4: 100 }
    }
  );

  assert.equal(analysis.nextBest.progressionCarrierId, "carrier:mod-points-gain");
  assert.equal(analysis.nextBest.progressionObjectiveId, "objective:token-shop-short-run");
  assert.ok(["Grounded", "Bounded", "Blocked"].includes(analysis.nextBest.progressionConfidenceLabel));
});
