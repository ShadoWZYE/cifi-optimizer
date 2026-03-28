import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  normalizePlayerProfile
} from "../player-profile.js";

const execFileAsync = promisify(execFile);

const snapshot = JSON.parse(await readFile(new URL("../data/game-data.snapshot.v1.json", import.meta.url), "utf8"));
const groundedShardMilestones = JSON.parse(await readFile(new URL("../data/shard-milestones.grounded.v1.json", import.meta.url), "utf8"));
const groundedShardObserved = JSON.parse(await readFile(new URL("../data/shard-observed-behaviors.grounded.v1.json", import.meta.url), "utf8"));
const groundedShardProvenance = JSON.parse(await readFile(new URL("../data/shard-milestones-provenance.grounded.v1.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("../app.js", import.meta.url), "utf8");
const devServer = await readFile(new URL("../scripts/dev-server.mjs", import.meta.url), "utf8");
const launcherVbs = await readFile(new URL("../launch-cifi.vbs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
await execFileAsync(process.execPath, ["--check", fileURLToPath(new URL("../app.js", import.meta.url))]);

const defaultProfile = createDefaultPlayerProfile();

assert.equal(snapshot.snapshotVersion, "v1.0.0-alpha");
assert.ok(snapshot.shipLoadouts.length >= 4, "expected ship loadouts");
assert.deepEqual(snapshot.shardMilestones, [], "expected shard milestones to stay quarantined until verified");
assert.ok(snapshot.gemNodes.length >= 4, "expected gem nodes");
assert.ok(snapshot.validationCases.some((item) => item.expected === "Next shard unlock to watch"), "expected grounded shard validation case");
assert.ok(groundedShardMilestones.milestones.length >= 20, "expected grounded shard milestone dataset");
assert.ok(groundedShardObserved.observations.length >= 4, "expected grounded shard behavior examples");
assert.ok(groundedShardProvenance.uncertaintyLog.length >= 2, "expected grounded shard provenance notes");
assert.equal(groundedShardMilestones.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.equal(groundedShardObserved.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.equal(groundedShardProvenance.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");

assert.match(html, /Player Data/);
assert.match(html, /Game Data/);
assert.match(html, /Ship Planner \(Community-tool\)/);
assert.match(html, /Gem Nodes \(Experimental\)/);
assert.match(html, /Research Intake/);
assert.match(html, /Candidate tracks and grounded findings/);
assert.match(html, /Apply to active snapshot/);
assert.match(html, /Reset to blank profile/);
assert.match(html, /Shared PlayerProfile truth is limited to grounded CIFI account state/);
assert.match(html, /Diamonds/);
assert.match(html, /Academy relics/);
assert.match(html, /Planner-only helper inputs are optional/);
assert.doesNotMatch(html, /Rank shard milestones/);
assert.match(html, /Shard milestones \(disabled pending verified schema\)/);
assert.match(html, /Grounded shard workflow/);
assert.match(html, /Focus milestone/);
assert.match(html, /Observed level on focus milestone/);
assert.match(html, /Total shard milestone levels/);

assert.match(appJs, /function runShipOptimization/);
assert.match(appJs, /function runProgressionOptimization/);
assert.match(appJs, /function buildGroundedShardRecommendations/);
assert.match(appJs, /function renderShardMilestoneDirectory/);
assert.match(appJs, /function renderShardWorkflowReference/);
assert.match(appJs, /function saveShardPlannerInputs/);
assert.match(appJs, /function runGemOptimization/);
assert.match(appJs, /function previewImport/);
assert.match(appJs, /function normalizeImportRow/);
assert.match(appJs, /from "\.\/player-profile\.js"/);
assert.match(appJs, /PLAYER_PROFILE_SCHEMA_VERSION/);
assert.match(appJs, /playerProfile:/);
assert.match(appJs, /externalModels/);
assert.match(appJs, /communityToolState/);
assert.match(appJs, /CANONICAL_PROFILE_FIELD_PATHS/);
assert.match(appJs, /BroadcastChannel/);
assert.match(appJs, /launcher-reopen/);
assert.match(appJs, /kind:\s*"warning"/);
assert.match(appJs, /Next shard unlock to watch/);
assert.match(appJs, /Next shard threshold to watch/);
assert.match(appJs, /Shard cost bump watch/);
assert.match(appJs, /Shard milestone manual import stays disabled; this build only uses the bundled grounded descriptive dataset/);
assert.match(appJs, /\.\/data\/shard-milestones\.grounded\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-observed-behaviors\.grounded\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestones-provenance\.grounded\.v1\.json/);
assert.doesNotMatch(appJs, /C:\/Users\/Shadow\/Downloads/);
assert.doesNotMatch(appJs, /function getShardUpgradeCost/);
assert.doesNotMatch(appJs, /function getShardUpgradeValue/);
assert.doesNotMatch(appJs, /function getShardFocusWeight/);
assert.doesNotMatch(appJs, /function simulateShard/);
assert.match(devServer, /\/api\/healthz/);
assert.match(launcherVbs, /http:\/\/localhost:4173\//);
assert.match(launcherVbs, /ResolveNodePath/);
assert.match(launcherVbs, /ResolveFromWhere\("node\.exe"\)/);
assert.equal(pkg.scripts.dev, "node ./scripts/dev-server.mjs");
assert.equal(pkg.scripts.test, "node ./tests/smoke.mjs");

const shipWinner = [...snapshot.shipLoadouts]
  .map((loadout) => ({
    name: loadout.name,
    score:
      ((defaultProfile.externalModels.shipPlanner.summary.power ?? 0) * loadout.powerScale * snapshot.resourceGoals.credits.powerWeight) +
      ((defaultProfile.externalModels.shipPlanner.summary.speed ?? 0) * loadout.speedScale * snapshot.resourceGoals.credits.speedWeight * 10) +
      ((defaultProfile.externalModels.shipPlanner.summary.cargo ?? 0) * loadout.cargoScale * snapshot.resourceGoals.credits.cargoWeight) +
      (loadout.resourceBias === "credits" ? 45 : 0)
  }))
  .sort((a, b) => b.score - a.score)[0];

const gemWinner = [...snapshot.gemNodes]
  .map((node) => ({
    label: node.label,
    score: (node.value / node.cost) * (1 + (node.maxLevel - node.level) / node.maxLevel)
  }))
  .sort((a, b) => b.score - a.score)[0];

assert.equal(shipWinner.name, "Freighter Overdrive");
assert.equal(gemWinner.label, "Surge Lattice");

const migratedLegacyProfile = normalizePlayerProfile({
  profileName: "Legacy main",
  automationConfidence: "mixed",
  loopReset: "41",
  gems: "500",
  tokens: 120,
  relics: "12",
  shards: "9000",
  shardRatePerHour: "80",
  power: "7",
  speed: "2.5",
  cargo: "19",
  resourceFocus: "shards",
  gemNodeBudget: "250",
  researchHours: "6",
  gemDust: "33",
  hunterLevel: "14",
  traitSphereCount: "5",
  mechParts: "9",
  notes: "legacy"
});

assert.equal(migratedLegacyProfile.meta.schemaVersion, PLAYER_PROFILE_SCHEMA_VERSION);
assert.equal(migratedLegacyProfile.meta.dataConfidence, "mixed");
assert.equal(migratedLegacyProfile.player.loop.loopReset, 41);
assert.equal(migratedLegacyProfile.player.resources.diamonds, 500);
assert.equal(migratedLegacyProfile.player.resources.tokens, 120);
assert.equal(migratedLegacyProfile.player.resources.academyRelics, 12);
assert.equal(migratedLegacyProfile.player.resources.shards, 9000);
assert.equal(migratedLegacyProfile.planning.shards.ratePerHour, 80);
assert.equal(migratedLegacyProfile.externalModels.shipPlanner.summary.power, 7);
assert.equal(migratedLegacyProfile.externalModels.shipPlanner.summary.speed, 2.5);
assert.equal(migratedLegacyProfile.externalModels.shipPlanner.summary.cargo, 19);
assert.equal(migratedLegacyProfile.externalModels.experimental.profileHints.primaryFarmingFocus, "shards");
assert.equal(migratedLegacyProfile.externalModels.experimental.profileHints.researchHours, 6);
assert.equal(migratedLegacyProfile.externalModels.experimental.gemNodes.budget, 250);
assert.equal(migratedLegacyProfile.compatibility.unresolvedProfileFields.gemDust, 33);
assert.equal(migratedLegacyProfile.compatibility.unresolvedProfileFields.hunterLevel, 14);
assert.equal(migratedLegacyProfile.compatibility.unresolvedProfileFields.traitSphereCount, 5);
assert.equal(migratedLegacyProfile.compatibility.unresolvedProfileFields.mechParts, 9);
assert.equal(migratedLegacyProfile.notes.profile, "legacy");

const migratedNestedProfile = normalizePlayerProfile({
  meta: {
    profileName: "Nested main",
    updatedAt: "2026-03-28T00:00:00.000Z",
    dataConfidence: "verified"
  },
  player: {
    loop: {
      loopReset: 64
    },
    resources: {
      diamonds: 900,
      tokens: 250,
      academyRelics: 40,
      shards: 15000
    }
  },
  planning: {
    shards: {
      ratePerHour: 110
    }
  },
  notes: {
    profile: "nested"
  },
  externalModels: {
    shipPlanner: {
      communityToolState: {
        technical: {
          Meltdown: 12
        }
      }
    }
  }
});

assert.equal(migratedNestedProfile.meta.profileName, "Nested main");
assert.equal(migratedNestedProfile.meta.updatedAt, "2026-03-28T00:00:00.000Z");
assert.equal(migratedNestedProfile.meta.dataConfidence, "verified");
assert.equal(migratedNestedProfile.player.resources.diamonds, 900);
assert.equal(migratedNestedProfile.planning.shards.ratePerHour, 110);
assert.equal(migratedNestedProfile.notes.profile, "nested");
assert.equal(migratedNestedProfile.externalModels.shipPlanner.communityToolState.technical.Meltdown, 12);

assert.match(appJs, /function normalizeLoadoutName/);
assert.match(appJs, /name: normalizeLoadoutName\(stored\.name, fallback\.name\)/);

console.log("Smoke tests passed.");
