import test from "node:test";
import assert from "node:assert/strict";

import { createTokenShopUiSupport } from "../token-shop-ui-support.js";

const tokenShopUi = createTokenShopUiSupport({
  formatValue(value) {
    return `[${value}]`;
  }
});

test("getTokenShopRowDisplayTitle prefers checked titles and strips rich text", () => {
  assert.equal(
    tokenShopUi.getTokenShopRowDisplayTitle({
      identity: "<b>Mk3 Generator Booster</b>",
      identitySource: "Checked title-side text chain",
      rowType: "prefab-driven"
    }),
    "Mk3 Generator Booster"
  );
});

test("getTokenShopCurrentVsNextBonusSummary preserves cap-aware detail", () => {
  assert.deepEqual(
    tokenShopUi.getTokenShopCurrentVsNextBonusSummary(
      { bonusStepLabel: "Mk1 Output", bonusStepMode: "multiplier", rowType: "prefab-driven" },
      2,
      4,
      1.5
    ),
    {
      currentLabel: "[2] extracted bonus step(s) of x[1.5] to Mk1 Output",
      nextLabel: "[3] extracted bonus step(s) of x[1.5] to Mk1 Output",
      detail:
        "Current level [2] to next level [3] adds one more extracted bonus step only. This view does not infer compounding, best-buy value, or optimizer math."
    }
  );
});

test("getTokenShopBonusStripEntries handles multiplier rows and maxed rows", () => {
  assert.deepEqual(
    tokenShopUi.getTokenShopBonusStripEntries({
      bonusStepLabel: "Mk2 Output",
      bonusStepMode: "multiplier",
      bonusValue: 1.25,
      currentLevel: 2,
      isMaxed: true
    }),
    [
      {
        label: "Mk2 Output",
        currentLabel: "x1.56",
        nextLabel: "MAX"
      }
    ]
  );
});

test("getTokenShopPlayerFacingSupportText joins grounded title-side support text", () => {
  assert.equal(
    tokenShopUi.getTokenShopPlayerFacingSupportText({
      playerFacingSupportText: [
        "This upgrade divides the cost of MK3 Generators by 3m",
        "This upgrade provides a 30% increase to the output of MK3 Generators."
      ]
    }),
    "This upgrade divides the cost of MK3 Generators by 3m This upgrade provides a 30% increase to the output of MK3 Generators."
  );
});
