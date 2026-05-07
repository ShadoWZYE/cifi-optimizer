import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildSpendSystemView } from "../support/system-unit-projections.js";
import {
  buildSpendProgressionModel,
  getSpendObjectiveMode,
  getTokenShopFamilyProgressionLens
} from "../support/progression-model.js";

function loadJson(path) {
  return JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
}

const tokenShopSystemUnit = loadJson("../data/system-units/token-shop.v1.json");
const multiverseMarketSystemUnit = loadJson("../data/system-units/multiverse-market.v1.json");

test("buildSpendProgressionModel exposes canonical carriers and blocked transforms", () => {
  const model = buildSpendProgressionModel({
    tokenShopSystemUnit,
    multiverseMarketSystemUnit
  });

  assert.equal(model.version, "0.1.0");
  assert.equal(model.readiness.hasCanonicalCarrierGraph, true);
  assert.equal(model.readiness.trueRoiReady, false);
  assert.ok(model.readiness.blockedTransformCount >= 1);

  const carrierIds = model.carriers.map((item) => item.id);
  assert.ok(carrierIds.includes("carrier:token-bank-balance"));
  assert.ok(carrierIds.includes("carrier:daily-tokenium-wallet"));
  assert.ok(carrierIds.includes("carrier:generator-output"));
  assert.ok(carrierIds.includes("carrier:multiverse-market-progression"));

  const tokenBankCarrier = model.carriers.find((item) => item.id === "carrier:token-bank-balance");
  assert.equal(tokenBankCarrier.status, "verified");
  assert.equal(tokenBankCarrier.provenance, "verified-extract");

  const blockedTransform = model.transforms.find(
    (item) => item.id === "transform:generator-output-to-token-progression"
  );
  assert.ok(blockedTransform);
  assert.equal(blockedTransform.status, "blocked");
  assert.equal(blockedTransform.provenance, "missing-cross-system-transform");

  const objectiveIds = model.objectiveModes.map((item) => item.id);
  assert.deepEqual(objectiveIds, [
    "objective:token-shop-short-run",
    "objective:generator-compounding",
    "objective:daily-tokenium-side-lane",
    "objective:broad-account-growth"
  ]);
});

test("buildSpendSystemView includes the shared progression model", () => {
  const spendView = buildSpendSystemView({
    tokenShopSystemUnit,
    multiverseMarketSystemUnit,
    systemDb: null
  });

  assert.ok(spendView.progressionModel);
  assert.equal(spendView.progressionModel.readiness.hasGroundedObjectiveModes, true);
  assert.equal(spendView.progressionModel.readiness.trueRoiReady, false);

  const broadObjective = spendView.progressionModel.objectiveModes.find(
    (item) => item.id === "objective:broad-account-growth"
  );
  assert.ok(broadObjective);
  assert.equal(broadObjective.status, "blocked");
  assert.ok(
    broadObjective.blockedTransformIds.includes("transform:multiverse-market-to-shared-progress")
  );
});

test("progression model exposes TokenShop family lens for ROI consumers", () => {
  const model = buildSpendProgressionModel({
    tokenShopSystemUnit,
    multiverseMarketSystemUnit
  });

  const objective = getSpendObjectiveMode(model, "objective:token-shop-short-run");
  const lens = getTokenShopFamilyProgressionLens(model, "objective:token-shop-short-run");
  const tokenChest = lens.get("token-chest");
  const dailyTokenium = lens.get("daily-tokenium");

  assert.equal(objective.id, "objective:token-shop-short-run");
  assert.ok(tokenChest);
  assert.equal(tokenChest.carrierId, "carrier:token-chest-income");
  assert.equal(tokenChest.transformStatus, "verified");
  assert.equal(tokenChest.objectiveId, "objective:token-shop-short-run");

  assert.ok(dailyTokenium);
  assert.equal(dailyTokenium.carrierId, "carrier:daily-tokenium-lane");
  assert.ok(tokenChest.scoreMultiplier > dailyTokenium.scoreMultiplier);
});
