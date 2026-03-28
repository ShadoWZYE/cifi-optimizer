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
  gemDust: 540
};

assert.equal(snapshot.snapshotVersion, "v1.0.0-alpha");
assert.ok(snapshot.shipLoadouts.length >= 4, "expected ship loadouts");
assert.ok(snapshot.progressionActions.length >= 4, "expected progression actions");
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

const progressionWinner = [...snapshot.progressionActions]
  .map((item) => ({
    label: item.label,
    score:
      item.baseValue *
      Math.min(1.2, (defaultProfile[item.resource] || 0) / Math.max(item.baseCost, 1)) *
      progressionUrgency(item.resource, "balanced")
  }))
  .sort((a, b) => b.score - a.score)[0];

const gemWinner = [...snapshot.gemNodes]
  .map((node) => ({
    label: node.label,
    score: (node.value / node.cost) * (1 + (node.maxLevel - node.level) / node.maxLevel)
  }))
  .sort((a, b) => b.score - a.score)[0];

assert.equal(shipWinner.name, "Freighter Overdrive");
assert.equal(progressionWinner.label, "Upgrade gem nodes with current dust");
assert.equal(gemWinner.label, "Surge Lattice");

console.log("Smoke tests passed.");

function progressionUrgency(resource, bias) {
  const table = {
    gems: bias === "premium" ? 1.16 : 0.96,
    tokens: bias === "speed" ? 1.14 : 1,
    relics: 0.94,
    gemDust: 1.1
  };
  return table[resource] ?? 1;
}
