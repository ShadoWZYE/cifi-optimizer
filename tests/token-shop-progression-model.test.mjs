import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTokenShopProgressionModel,
  resolveTokenShopProgressionLevelSource
} from "../token-shop-progression-model.js";

test("resolveTokenShopProgressionLevelSource prefers local, then player state, then compatibility", () => {
  assert.deepEqual(
    resolveTokenShopProgressionLevelSource(
      "ATU1Level",
      {
        checkedSubsetLevels: { ATU1Level: 4 },
        checkedSubsetPlayerState: { ATU1Level: 3 }
      },
      { ATU1Level: 2 }
    ),
    {
      value: 4,
      sourceLabel: "Local progression override",
      path: "planning.tokenShop.checkedSubsetLevels.ATU1Level"
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
      checkedSubsetLevels: { ATU1Level: 2 },
      checkedSubsetPlayerState: { ATU2Level: 3 }
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
  assert.equal(summary.localCount, 1);
  assert.equal(summary.playerStateCount, 1);
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
    currentLevelPath: "planning.tokenShop.checkedSubsetLevels.ATU1Level",
    currentLevelSourceLabel: "Local progression override",
    startCost: 10,
    additiveCost: 5,
    bonusValue: 1.5,
    nextKnownCost: 20,
    isAffordable: true,
    isMaxed: false,
    maxLevel: 4,
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
