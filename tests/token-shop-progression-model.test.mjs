import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTokenShopProgressionModel,
  resolveTokenShopProgressionLevelSource
} from "../token-shop-progression-model.js";

test("resolveTokenShopProgressionLevelSource prefers checked player state, then compatibility", () => {
  assert.deepEqual(
    resolveTokenShopProgressionLevelSource(
      "ATU1Level",
      {
        checkedSubsetPlayerState: { ATU1Level: 3 }
      },
      { ATU1Level: 2 }
    ),
    {
      value: 3,
      sourceLabel: "Checked player state",
      path: "planning.tokenShop.checkedSubsetPlayerState.ATU1Level"
    }
  );

  assert.deepEqual(
    resolveTokenShopProgressionLevelSource(
      "ATU2Level",
      {
        checkedSubsetPlayerState: { ATU2Level: 3 }
      },
      { ATU2Level: 2 }
    ),
    {
      value: 3,
      sourceLabel: "Checked player state",
      path: "planning.tokenShop.checkedSubsetPlayerState.ATU2Level"
    }
  );

  assert.deepEqual(resolveTokenShopProgressionLevelSource("ATU3Level", {}, { ATU3Level: 2 }), {
    value: 2,
    sourceLabel: "Compatibility fallback",
    path: "compatibility.unmappedSystemState.tokenShop.ATU3Level"
  });
});

test("buildTokenShopProgressionModel shapes rows, affordability, and summary counts", () => {
  const summary = buildTokenShopProgressionModel({
    progressionState: {
      checkedSubsetPlayerState: { ATU1Level: 2, ATU2Level: 3 }
    },
    compatibilityLevels: { ATU3Level: 1 },
    boundary: { marker: true },
    tokenShop: {
      fields: [
        { field: "StartA", kind: "number", value: 10 },
        { field: "AddA", kind: "number", value: 5 },
        { field: "BonusA", kind: "number", value: 1.5 },
        { field: "MaxA", kind: "number", value: 4 },
        { field: "StartB", kind: "number", value: 20 },
        { field: "AddB", kind: "number", value: 10 },
        { field: "BonusB", kind: "number", value: 2 },
        { field: "MaxB", kind: "number", value: 3 }
      ]
    },
    currentTokens: 25,
    getGroundedSubsetDefinitions(receivedBoundary) {
      assert.deepEqual(receivedBoundary, { marker: true });
      return [
        {
          field: "ATU1Level",
          slot: "ATU1",
          startCostField: "StartA",
          additiveCostField: "AddA",
          bonusField: "BonusA",
          maxLevelField: "MaxA",
          rowType: "prefab-driven"
        },
        {
          field: "ATU2Level",
          slot: "ATU2",
          startCostField: "StartB",
          additiveCostField: "AddB",
          bonusField: "BonusB",
          maxLevelField: "MaxB",
          rowType: "effect-driven"
        },
        {
          field: "ATU3Level",
          slot: "ATU3",
          startCostField: "MissingStart",
          additiveCostField: "MissingAdd",
          bonusField: "MissingBonus",
          maxLevelField: "MissingMax",
          rowType: "prefab-driven"
        },
        {
          field: "ATU4Level",
          slot: "ATU4",
          startCostField: "MissingStart",
          additiveCostField: "MissingAdd",
          bonusField: "MissingBonus",
          maxLevelField: "MissingMax",
          rowType: "prefab-driven"
        }
      ];
    },
    getKnownMaxStatus(currentLevel, maxLevel) {
      return {
        label:
          typeof maxLevel === "number" && currentLevel >= maxLevel
            ? "At or above known cap"
            : "Below known cap"
      };
    },
    getCurrentVsNextBonusSummary(row, currentLevel, maxLevel, bonusValue) {
      return {
        detail: `${row.field}:${currentLevel}:${String(maxLevel)}:${String(bonusValue)}`
      };
    }
  });

  assert.equal(summary.currentTokens, 25);
  assert.equal(summary.rows.length, 4);
  assert.equal(summary.playerStateCount, 2);
  assert.equal(summary.compatibilityCount, 1);
  assert.equal(summary.defaultCount, 1);
  assert.equal(summary.affordableCount, 1);
  assert.equal(summary.knownCapCount, 1);

  assert.deepEqual(summary.rows[0], {
    field: "ATU1Level",
    slot: "ATU1",
    startCostField: "StartA",
    additiveCostField: "AddA",
    bonusField: "BonusA",
    maxLevelField: "MaxA",
    rowType: "prefab-driven",
    currentLevel: 2,
    currentLevelPath: "planning.tokenShop.checkedSubsetPlayerState.ATU1Level",
    currentLevelSourceLabel: "Checked player state",
    startCost: 10,
    additiveCost: 5,
    bonusValue: 1.5,
    bonusValues: [],
    bonusMode: "additive",
    nextKnownCost: 20,
    projectedNextCost: 20,
    isAffordable: true,
    isMaxed: false,
    maxLevel: 4,
    costFormulaType: "linear",
    costFormulaConfidence: "verified",
    costFormulaKnown: true,
    costFormulaProjected: false,
    costFormulaLabel: "Known cost inputs: start 10 + additive 5 x current level.",
    maxStatus: { label: "Below known cap" },
    currentVsNextBonus: { detail: "ATU1Level:2:4:1.5" }
  });

  assert.equal(summary.rows[1].currentLevelSourceLabel, "Checked player state");
  assert.equal(summary.rows[1].isMaxed, true);
  assert.equal(summary.rows[1].nextKnownCost, null);
  assert.equal(summary.rows[1].maxStatus.label, "At or above known cap");
  assert.equal(summary.rows[2].currentLevelSourceLabel, "Compatibility fallback");
  assert.equal(summary.rows[2].startCost, null);
  assert.equal(summary.rows[2].isAffordable, null);
  assert.equal(summary.rows[3].currentLevelSourceLabel, "Default level 0");
});

test("buildTokenShopProgressionModel preserves formula mode and bounded late start-only cost lanes", () => {
  const summary = buildTokenShopProgressionModel({
    progressionState: {
      checkedSubsetPlayerState: { ATU24Level: 0, ATU25Level: 2 }
    },
    compatibilityLevels: {},
    boundary: {},
    tokenShop: {
      fields: [
        { field: "ATU24StartCost", kind: "number", value: 40000000 },
        { field: "ATU24Bonus1", kind: "number", value: 1.001 },
        { field: "ATU24Bonus2", kind: "number", value: 1.0005 },
        { field: "ATU24Bonus3", kind: "number", value: 1.0003 },
        { field: "ATU24Bonus4", kind: "number", value: 1.0002 },
        { field: "ATU24Bonus5", kind: "number", value: 1.0001 },
        { field: "ATU25StartCost", kind: "number", value: 1000000 },
        { field: "ATU25AdditiveCost", kind: "number", value: 25000 },
        { field: "ATU25Bonus", kind: "number", value: 0.5 },
        { field: "ATU25MaxLevel", kind: "number", value: 50 }
      ]
    },
    currentTokens: 50000000,
    getGroundedSubsetDefinitions() {
      return [
        {
          field: "ATU24Level",
          slot: "ATU24",
          startCostField: "ATU24StartCost",
          bonusField: "ATU24Bonus3",
          bonusFields: ["ATU24Bonus1", "ATU24Bonus2", "ATU24Bonus3", "ATU24Bonus4", "ATU24Bonus5"],
          bonusStepMode: "multi",
          costFormulaType: "start-only"
        },
        {
          field: "ATU25Level",
          slot: "ATU25",
          startCostField: "ATU25StartCost",
          additiveCostField: "ATU25AdditiveCost",
          bonusField: "ATU25Bonus",
          maxLevelField: "ATU25MaxLevel",
          bonusStepMode: "additive"
        }
      ];
    },
    getKnownMaxStatus(currentLevel, maxLevel) {
      return {
        label:
          typeof maxLevel === "number" && currentLevel >= maxLevel
            ? "At or above known cap"
            : "Below known cap"
      };
    },
    getCurrentVsNextBonusSummary() {
      return { detail: "ok" };
    }
  });

  assert.equal(summary.rows[0].costFormulaType, "start-only");
  assert.equal(summary.rows[0].bonusMode, "multi");
  assert.equal(summary.rows[0].nextKnownCost, 40000000);
  assert.equal(summary.rows[0].isAffordable, true);
  assert.equal(summary.rows[0].bonusValues.length, 5);
  assert.equal(summary.rows[0].costFormulaKnown, true);
  assert.match(summary.rows[0].costFormulaLabel, /first-purchase cost/i);

  assert.equal(summary.rows[1].bonusMode, "additive");
  assert.equal(summary.rows[1].nextKnownCost, 1050000);
});

test("buildTokenShopProgressionModel keeps projected late linear formulas out of known-next-cost", () => {
  const summary = buildTokenShopProgressionModel({
    progressionState: {
      checkedSubsetPlayerState: { ATU26Level: 2 }
    },
    compatibilityLevels: {},
    boundary: {},
    tokenShop: {
      fields: [
        { field: "ATU26StartCost", kind: "number", value: 10000000 },
        { field: "ATU26AdditiveCost", kind: "number", value: 1000000 },
        { field: "ATU26Bonus", kind: "number", value: 1000 },
        { field: "ATU26MaxLevel", kind: "number", value: 15 }
      ]
    },
    currentTokens: 50000000,
    getGroundedSubsetDefinitions() {
      return [
        {
          field: "ATU26Level",
          slot: "ATU26",
          startCostField: "ATU26StartCost",
          additiveCostField: "ATU26AdditiveCost",
          bonusField: "ATU26Bonus",
          maxLevelField: "ATU26MaxLevel",
          bonusStepMode: "additive",
          costFormulaConfidence: "projected"
        }
      ];
    },
    getKnownMaxStatus() {
      return { label: "Below known cap" };
    },
    getCurrentVsNextBonusSummary() {
      return { detail: "ok" };
    }
  });

  assert.equal(summary.rows[0].nextKnownCost, null);
  assert.equal(summary.rows[0].projectedNextCost, 12000000);
  assert.equal(summary.rows[0].isAffordable, null);
  assert.equal(summary.rows[0].costFormulaProjected, true);
  assert.match(summary.rows[0].costFormulaLabel, /projected linear cost/i);
});
