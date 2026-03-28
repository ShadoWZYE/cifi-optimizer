import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const snapshot = JSON.parse(await readFile(new URL("../data/game-data.snapshot.v1.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("../app.js", import.meta.url), "utf8");
const devServer = await readFile(new URL("../scripts/dev-server.mjs", import.meta.url), "utf8");
const launcherVbs = await readFile(new URL("../launch-cifi.vbs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

const defaultProfile = {
  power: 980,
  speed: 132,
  cargo: 670,
  gems: 860,
  tokens: 430,
  relics: 215,
  gemDust: 540,
  shards: 1850,
  shardRatePerHour: 640,
  shardMilestoneOpsLevel: 8,
  shardMilestoneYieldLevel: 4,
  shardMilestoneCellsLevel: 6,
  shardMilestoneResearchLevel: 3
};

assert.equal(snapshot.snapshotVersion, "v1.0.0-alpha");
assert.ok(snapshot.shipLoadouts.length >= 4, "expected ship loadouts");
assert.ok(snapshot.shardMilestones.length >= 4, "expected shard milestones");
assert.ok(snapshot.gemNodes.length >= 4, "expected gem nodes");

assert.match(html, /Player Data/);
assert.match(html, /Game Data/);
assert.match(html, /Ship Optimizer/);
assert.match(html, /Apply to active snapshot/);

assert.match(appJs, /function runShipOptimization/);
assert.match(appJs, /function runProgressionOptimization/);
assert.match(appJs, /function runGemOptimization/);
assert.match(appJs, /function previewImport/);
assert.match(appJs, /function normalizeImportRow/);
assert.match(appJs, /function createDefaultPlayerProfile/);
assert.match(appJs, /function normalizePlayerProfile/);
assert.match(appJs, /playerProfile:/);
assert.match(appJs, /BroadcastChannel/);
assert.match(appJs, /launcher-reopen/);
assert.match(devServer, /\/api\/healthz/);
assert.match(launcherVbs, /\?launch=1/);
assert.match(launcherVbs, /ResolveNodePath/);
assert.match(launcherVbs, /ResolveFromWhere\("node\.exe"\)/);
assert.equal(pkg.scripts.dev, "node ./scripts/dev-server.mjs");
assert.equal(pkg.scripts.test, "node ./tests/smoke.mjs");

const shipWinner = [...snapshot.shipLoadouts]
  .map((loadout) => ({
    name: loadout.name,
    score:
      (defaultProfile.power * loadout.powerScale * snapshot.resourceGoals.credits.powerWeight) +
      (defaultProfile.speed * loadout.speedScale * snapshot.resourceGoals.credits.speedWeight * 10) +
      (defaultProfile.cargo * loadout.cargoScale * snapshot.resourceGoals.credits.cargoWeight) +
      (loadout.resourceBias === "credits" ? 45 : 0)
  }))
  .sort((a, b) => b.score - a.score)[0];

const progressionWinner = [...snapshot.shardMilestones]
  .map((item) => {
    const currentLevel = defaultProfile[{
      opsAccelerator: "shardMilestoneOpsLevel",
      shardCompression: "shardMilestoneYieldLevel",
      hotspotScanner: "shardMilestoneCellsLevel",
      researchSurvey: "shardMilestoneResearchLevel"
    }[item.id]];
    const targetLevel = item.breakpoints.map((breakpoint) => breakpoint.level).find((level) => level > currentLevel) ?? (currentLevel + 1);
    const totalCost = sumUpgradeCost(item, currentLevel, targetLevel);
    const totalValue = sumUpgradeValue(item, currentLevel, targetLevel);
    const focusWeight = item.resourceBias === "shards" ? 1.25 : 1;
    const proximityWeight = targetLevel - currentLevel <= 2 ? 1.22 : 1;
    const affordabilityWeight = totalCost <= defaultProfile.shards ? 1.18 : 1;
    return {
      label: `Push ${item.label} to ${targetLevel}`,
      score: (totalValue / Math.max(totalCost, 1)) * focusWeight * proximityWeight * affordabilityWeight * 100
    };
  })
  .sort((a, b) => b.score - a.score)[0];

const gemWinner = [...snapshot.gemNodes]
  .map((node) => ({
    label: node.label,
    score: (node.value / node.cost) * (1 + (node.maxLevel - node.level) / node.maxLevel)
  }))
  .sort((a, b) => b.score - a.score)[0];

assert.equal(shipWinner.name, "Freighter Overdrive");
assert.equal(progressionWinner.label, "Push Shard Compression to 5");
assert.equal(gemWinner.label, "Surge Lattice");

console.log("Smoke tests passed.");

function sumUpgradeCost(item, currentLevel, targetLevel) {
  let total = 0;
  for (let level = currentLevel; level < targetLevel; level += 1) {
    total += item.baseCost * Math.pow(item.costGrowth, level);
  }
  return Math.round(total);
}

function sumUpgradeValue(item, currentLevel, targetLevel) {
  let total = 0;
  for (let level = currentLevel; level < targetLevel; level += 1) {
    total += item.perLevelValue;
  }
  item.breakpoints.forEach((breakpoint) => {
    if (breakpoint.level > currentLevel && breakpoint.level <= targetLevel) {
      total += breakpoint.bonusValue;
    }
  });
  return total;
}
