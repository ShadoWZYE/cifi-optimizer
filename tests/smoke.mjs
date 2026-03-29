import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  normalizePlayerProfile
} from "../player-profile.js";
import { validateBundledDatasets } from "../scripts/validate-datasets.mjs";

const execFileAsync = promisify(execFile);

const snapshot = JSON.parse(await readFile(new URL("../data/game-data.snapshot.v1.json", import.meta.url), "utf8"));
const groundedShardMilestones = JSON.parse(await readFile(new URL("../data/shard-milestones.grounded.v1.json", import.meta.url), "utf8"));
const groundedShardObserved = JSON.parse(await readFile(new URL("../data/shard-observed-behaviors.grounded.v1.json", import.meta.url), "utf8"));
const groundedShardProvenance = JSON.parse(await readFile(new URL("../data/shard-milestones-provenance.grounded.v1.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("../app.js", import.meta.url), "utf8");
const agentsMd = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const groundingPlan = await readFile(new URL("../docs/cifi_grounding_plan.md", import.meta.url), "utf8");
const unityAuditPlaybook = await readFile(new URL("../docs/unity-audit-playbook.md", import.meta.url), "utf8");
const ownerMap = await readFile(new URL("../docs/unity-owner-map.md", import.meta.url), "utf8");
const spendVerificationDoc = await readFile(new URL("../docs/spend-system-verification.md", import.meta.url), "utf8");
const tokenBankStateDoc = await readFile(new URL("../docs/token-bank-state-verification.md", import.meta.url), "utf8");
const dailyTokeniumMissionDoc = await readFile(new URL("../docs/daily-tokenium-mission-lane-verification.md", import.meta.url), "utf8");
const shardVerificationDoc = await readFile(new URL("../docs/shard-system-verification.md", import.meta.url), "utf8");
const playerProfileSchemaDoc = await readFile(new URL("../docs/player-profile-schema.md", import.meta.url), "utf8");
const importMappingDoc = await readFile(new URL("../docs/import-mapping.md", import.meta.url), "utf8");
const tokenShopDoc = await readFile(new URL("../docs/token-shop-values.md", import.meta.url), "utf8");
const multiverseMarketDoc = await readFile(new URL("../docs/multiverse-market-values.md", import.meta.url), "utf8");
const shardIngestDoc = await readFile(new URL("../docs/shard-milestones-grounding-ingest.md", import.meta.url), "utf8");
const devServer = await readFile(new URL("../scripts/dev-server.mjs", import.meta.url), "utf8");
const launcherVbs = await readFile(new URL("../launch-cifi.vbs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
await execFileAsync(process.execPath, ["--check", fileURLToPath(new URL("../app.js", import.meta.url))]);
const datasetValidation = await validateBundledDatasets();

const defaultProfile = createDefaultPlayerProfile();

assert.equal(snapshot.snapshotVersion, "v1.0.0-alpha");
assert.ok(snapshot.shipLoadouts.length >= 4, "expected ship loadouts");
assert.deepEqual(snapshot.shardMilestones, [], "expected shard milestones to stay quarantined until verified");
assert.ok(snapshot.gemNodes.length >= 4, "expected gem nodes");
assert.ok(snapshot.validationCases.some((item) => item.expected === "Add current LR for loop guardrails"), "expected ranked progression validation case");
assert.ok(groundedShardMilestones.milestones.length >= 20, "expected grounded shard milestone dataset");
assert.ok(groundedShardObserved.observations.length >= 4, "expected grounded shard behavior examples");
assert.ok(groundedShardProvenance.uncertaintyLog.length >= 2, "expected grounded shard provenance notes");
assert.equal(groundedShardMilestones.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.equal(groundedShardObserved.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.equal(groundedShardProvenance.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.deepEqual(
  datasetValidation.map((entry) => entry.id),
  ["snapshot", "shards", "token-shop", "multiverse-market"]
);
const shardTrack = snapshot.researchTracks.find((track) => track.id === "shards-and-loop-guardrails");
assert.ok(shardTrack, "expected shard workflow track");
assert.match(shardTrack.goal, /Keep shard guidance truthful/);
assert.match(shardTrack.currentSlice, /Audit the current shard workflow against the stricter system-mapping gate/);
const spendTrack = snapshot.researchTracks.find((track) => track.id === "spend-planner-from-extracted-data");
assert.ok(spendTrack, "expected spend workflow track");
assert.match(spendTrack.currentSlice, /Treat Daily Tokenium as an Academy or Farm Mission reward lane/);
assert.match(agentsMd, /## System Integration Gate/);
assert.match(agentsMd, /Before integrating any game system into the app/);
assert.match(agentsMd, /available but unmapped/);
assert.match(agentsMd, /not build-ready until its owner, data shape, labels, currencies, and required player-state inputs are mapped/);
assert.match(groundingPlan, /## System integration gate/);
assert.match(groundingPlan, /Fail this gate if any of the above are inferred rather than evidenced/);
assert.match(groundingPlan, /Presence of extracted data is not enough/);
assert.match(groundingPlan, /Even when a system is known to exist in CIFI/);
assert.match(unityAuditPlaybook, /## Integration readiness gate/);
assert.match(unityAuditPlaybook, /MultiverseMarket/);
assert.match(ownerMap, /integration status: owner and serialized constants verified/);
assert.match(ownerMap, /Daily Tokenium lane is now better grounded as an Academy or Farm Mission reward family/);
assert.match(ownerMap, /OR_TokenBankCap/);
assert.match(ownerMap, /integration status: owner and partial row constants verified/);
assert.match(ownerMap, /recovered adjacent handlers/);
assert.match(ownerMap, /ClaimBankedTokens` -> `TokenShop, Assembly-CSharp/);
assert.match(ownerMap, /token-bank cap display -> `BigStatisticPrefab\.TokenBankCap`/);
assert.match(ownerMap, /daily-tokenium mission text path -> `TextHandlerLoopMods\.SetLM244BonusText`/);
assert.match(ownerMap, /recovered owner-family split/);
assert.match(ownerMap, /underlying Daily Tokenium lane -> `SpaceAcademy` \/ `FarmMissions` family in `level0`/);
assert.match(ownerMap, /Collector pack -> premium modifier family on that lane through Academy-menu Daily Tokenium cap text/);
assert.match(ownerMap, /ruled-out owner shortcut/);
assert.match(ownerMap, /LM244` is currently grounded as a text-handler path, not as the recovered gameplay owner of daily tokenium/);
assert.match(ownerMap, /adjacent systems still to map/);
assert.match(ownerMap, /token-bank cap \/ fill \/ claim owner and save-state inputs/);
assert.match(ownerMap, /Academy or Farm Mission gameplay owner and saved-state inputs for Daily Tokenium/);
assert.match(ownerMap, /`DiamondBoost` relation to the wider diamond-upgrade domain/);
assert.match(ownerMap, /downstream effect owners for generators, token chests, diamond chests, cells, mod points, shards, research points, academy points, hunt loot, campaign fragments, and Ouroboros orbs/);
assert.match(spendVerificationDoc, /# Spend System Verification Gate/);
assert.match(spendVerificationDoc, /It is not safe to map its spend lane to diamonds, tokens, or any other player resource without direct evidence/);
assert.match(spendVerificationDoc, /available but unmapped/);
assert.match(spendVerificationDoc, /Adjacent systems this signals/);
assert.match(spendVerificationDoc, /Meltdown-linked gating objects/);
assert.match(spendVerificationDoc, /downstream effect domains touched by TokenShop upgrades/);
assert.match(spendVerificationDoc, /token-bank cap, fill, claim, and daily tokenium state should remain `available but unmapped`/);
assert.match(spendVerificationDoc, /OR_TokenBankCap` and `OR_TokensFromChests` should currently be treated as grounded asset labels/);
assert.match(spendVerificationDoc, /claim actions resolve through `TokenShop`, token-bank cap display resolves through `BigStatisticPrefab\.TokenBankCap`, and at least one daily-tokenium text path resolves through `TextHandlerLoopMods\.SetLM244BonusText`/);
assert.match(spendVerificationDoc, /LM244` should currently be treated as a loop-mod text or explanation hook for daily tokenium, not as the recovered gameplay owner of that lane/);
assert.match(spendVerificationDoc, /Daily Tokenium is now better grounded as an Academy or Farm Mission reward lane that `TokenShop`, `LoopModifiers`, and the Collector pack all touch/);
assert.match(tokenBankStateDoc, /# Token Bank State Verification Gate/);
assert.match(tokenBankStateDoc, /ClaimBankedTokens/);
assert.match(tokenBankStateDoc, /FinalTokenBankFillSpeed/);
assert.match(tokenBankStateDoc, /0 \/ 2000 Daily Tokenium \(from blue farm missions\)/);
assert.match(tokenBankStateDoc, /## Source narrowing from this pass/);
assert.match(tokenBankStateDoc, /do not treat `OR_TokenBankCap` or `OR_TokensFromChests` as recovered formulas/);
assert.match(tokenBankStateDoc, /## Handler split recovered from this pass/);
assert.match(tokenBankStateDoc, /ClaimBankedTokens` appears directly beside `TokenShop, Assembly-CSharp`/);
assert.match(tokenBankStateDoc, /BigStatisticPrefab\.TokenBankCap/);
assert.match(tokenBankStateDoc, /TextHandlerLoopMods, Assembly-CSharp` -> `SetLM244BonusText/);
assert.match(tokenBankStateDoc, /## LM244 conclusion from this pass/);
assert.match(tokenBankStateDoc, /LM244` should currently be treated as a presentation or explanation hook, not as the recovered gameplay owner for daily tokenium/);
assert.match(tokenBankStateDoc, /## Daily Tokenium lane correction/);
assert.match(tokenBankStateDoc, /Daily Tokenium currently belongs to an Academy or Farm Mission lane that multiple systems touch/);
assert.match(tokenBankStateDoc, /Mission \/ farm mission rewards/);
assert.match(tokenBankStateDoc, /IAP \/ permanent pack modifiers/);
assert.match(dailyTokeniumMissionDoc, /# Daily Tokenium Mission Lane Verification/);
assert.match(dailyTokeniumMissionDoc, /Daily Tokenium currently belongs to the Academy or Farm Mission reward family/);
assert.match(dailyTokeniumMissionDoc, /Modifier-family split recovered from this pass/);
assert.match(dailyTokeniumMissionDoc, /grounded as one modifier family on the lane because a TokenShop upgrade text explicitly increases the Daily Tokenium cap/);
assert.match(dailyTokeniumMissionDoc, /grounded as a premium modifier family on the lane because its description explicitly increases Mission Materials and the Daily Tokenium cap in the Academy menu/);
assert.match(shardVerificationDoc, /# Shard System Verification Gate/);
assert.match(shardVerificationDoc, /community-grounded descriptive data/);
assert.match(shardVerificationDoc, /not yet mapped enough from shipped-game assets/);
assert.match(playerProfileSchemaDoc, /compatibility\.unmappedSystemState/);
assert.match(importMappingDoc, /compatibility\.unmappedSystemState/);
assert.match(tokenShopDoc, /## Integration status/);
assert.match(tokenShopDoc, /Not yet verified enough for app recommendations/);
assert.match(tokenShopDoc, /## Adjacent systems still to map/);
assert.match(tokenShopDoc, /Academy \/ farm mission tokenium lane/);
assert.match(tokenShopDoc, /Diamond-related upgrade lane inside TokenShop/);
assert.match(tokenShopDoc, /## Future mapping signals/);
assert.match(tokenShopDoc, /gameplay owner and saved-state family for the Academy or Farm Mission Daily Tokenium lane/);
assert.match(tokenShopDoc, /## Downstream systems TokenShop upgrades appear to affect/);
assert.match(tokenShopDoc, /TokenShop is a canonical cross-system modifier hub/);
assert.match(multiverseMarketDoc, /## Integration status/);
assert.match(multiverseMarketDoc, /the actual spend currency lane/);
assert.match(shardIngestDoc, /community-grounded descriptive data/);
assert.match(shardIngestDoc, /not yet shipped-game owner-grounded data/);

assert.match(html, /Player Data/);
assert.match(html, /Game Data/);
assert.match(html, /Ship Planner \(Community-tool\)/);
assert.match(html, /Gem Nodes \(Experimental\)/);
assert.match(html, /Research Intake/);
assert.match(html, /Candidate tracks and grounded findings/);
assert.match(html, /bundled data changes should pass local contract validation first/);
assert.match(html, /Apply to active snapshot/);
assert.match(html, /Reset to blank profile/);
assert.match(html, /PlayerProfile JSON/);
assert.match(html, /Import PlayerProfile JSON/);
assert.match(html, /Export PlayerProfile JSON/);
assert.match(html, /playerProfileImportSummary/);
assert.match(html, /Shared profile and labeled helpers/);
assert.match(html, /Shared PlayerProfile truth is limited to grounded CIFI account state/);
assert.match(html, /ship calibration remains outside shared profile truth as external-model implementation data/);
assert.match(html, /Community-tool Calibration/);
assert.match(html, /External model inputs preserved with the ship planner/);
assert.match(html, /Diamonds/);
assert.match(html, /Academy relics/);
assert.match(html, /Planner-only helper inputs are optional/);
assert.match(html, /Profile readiness/);
assert.doesNotMatch(html, /Rank shard milestones/);
assert.match(html, /Shard milestones \(disabled pending verified schema\)/);
assert.match(html, /Descriptive shard workflow/);
assert.match(html, /Focus milestone/);
assert.match(html, /Observed level on focus milestone/);
assert.match(html, /Total shard milestone levels/);
assert.match(html, /Grounded MVP checks only/);
assert.match(html, /Grounded checks, APK grounding, and support checks/);
assert.match(html, /APK-grounding checks/);
assert.match(html, /Ship checks stay in the grounded section because the system is canonical/);
assert.match(html, /validation can catch behavior drift and extracted-data mixing without overstating/);
assert.doesNotMatch(html, /External model inputs preserved outside raw game state/);

assert.match(appJs, /function runShipOptimization/);
assert.match(appJs, /function runProgressionOptimization/);
assert.match(appJs, /function buildGroundedShardRecommendations/);
assert.match(appJs, /function renderShardMilestoneDirectory/);
assert.match(appJs, /function renderShardWorkflowReference/);
assert.match(appJs, /function renderResearchTrackSupport/);
assert.match(appJs, /function renderResearchTrackProgress/);
assert.match(appJs, /function getResearchTrackStatus/);
assert.match(appJs, /function getResearchTrackProgressLabel/);
assert.match(appJs, /function importPlayerProfileJson/);
assert.match(appJs, /function exportPlayerProfileJson/);
assert.match(appJs, /function renderPlayerProfileBoundarySummary/);
assert.match(appJs, /function isBoundaryValuePresent/);
assert.match(appJs, /function formatBoundaryValue/);
assert.match(appJs, /function getCanonicalProfileState/);
assert.match(appJs, /function getShardPlannerState/);
assert.match(appJs, /function getShipPlannerState/);
assert.match(appJs, /function getExperimentalProfileState/);
assert.match(appJs, /function getCompatibilityProfileState/);
assert.match(appJs, /function initServerSession/);
assert.match(appJs, /function closeServerSession/);
assert.match(appJs, /function parseServerEvent/);
assert.match(appJs, /function getGemPlannerBudget/);
assert.match(appJs, /function getPlannerHelperCompletion/);
assert.match(appJs, /SUPPORT_SURFACE_VALIDATION_MODULES/);
assert.match(appJs, /function buildApkGroundingValidationCases/);
assert.match(appJs, /function renderOverviewSupportSummary/);
assert.match(appJs, /function getActiveMvpRecommendationFeed/);
assert.match(appJs, /function sortRecommendationFeed/);
assert.match(appJs, /function renderRecommendationFeedSummary/);
assert.match(appJs, /function renderSupportSurfaceNotice/);
assert.match(appJs, /function renderValidationSection/);
assert.match(appJs, /function toRecommendationAction/);
assert.match(appJs, /function sanitizeRecommendationLines/);
assert.match(appJs, /function getSourceTitlesForIds/);
assert.match(appJs, /function getMilestoneSourceLabel/);
assert.match(appJs, /function getProvenanceConflictNote/);
assert.match(appJs, /function buildLoopGuardrailRecommendations/);
assert.match(appJs, /function getObservedBehaviorById/);
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
assert.match(appJs, /Add current LR for loop guardrails/);
assert.match(appJs, /Use intentional short vs long runs/);
assert.match(appJs, /The current feed ranks trust-oriented warning urgency/);
assert.match(appJs, /Shard milestone manual import stays disabled; this build only uses the bundled grounded descriptive dataset/);
assert.match(appJs, /\.\/data\/shard-milestones\.grounded\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-observed-behaviors\.grounded\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestones-provenance\.grounded\.v1\.json/);
assert.match(appJs, /npm run verify:data/);
assert.match(appJs, /PlayerProfile JSON imported through the grounded normalizer/);
assert.match(appJs, /Canonical shared truth/);
assert.match(appJs, /Planner-only helpers/);
assert.match(appJs, /External-model implementation state/);
assert.match(appJs, /Compatibility leftovers/);
assert.match(appJs, /Unmapped shard milestone state/);
assert.match(appJs, /Unmapped TokenShop state/);
assert.match(appJs, /Unmapped MultiverseMarket state/);
assert.match(appJs, /Use buffer \/ instant loop checks before pushing LR higher/);
assert.match(appJs, /Legacy gemDust is preserved under compatibility/);
assert.match(appJs, /Planner helpers filled:/);
assert.match(appJs, /quarantined support surface/);
assert.match(appJs, /Grounding checks stay separate from MVP behavior/);
assert.match(appJs, /TokenShop owner payload/);
assert.match(appJs, /MultiverseMarket owner payload/);
assert.match(appJs, /Shard milestone mapping gate/);
assert.match(appJs, /Available but unmapped/);
assert.match(appJs, /These cards represent a real ship system, but the current implementation still uses community-tool calibration and provisional labels/);
assert.match(appJs, /Canonical ship system, provisional implementation/);
assert.match(appJs, /Experimental gem results/);
assert.match(appJs, /Grounded MVP checks/);
assert.match(appJs, /APK-grounding checks/);
assert.match(appJs, /Support-surface checks/);
assert.match(appJs, /Loop guardrails remain descriptive and source-linked/);
assert.match(appJs, /This card watches descriptive unlock gates only/);
assert.match(appJs, /Shard milestone mapping status/);
assert.match(appJs, /community-grounded descriptive data/);
assert.match(appJs, /Grounded shard anchors/);
assert.match(appJs, /Descriptive directory/);
assert.match(appJs, /Threshold guidance is milestone-specific and descriptive only/);
assert.match(appJs, /Use this to avoid false precision near known cost-bump levels/);
assert.match(appJs, /buildGroundedShardRecommendations\(\)\.map\(\(item\) => toRecommendationAction\(item, "shards"\)\)/);
assert.match(appJs, /buildLoopGuardrailRecommendations\(\)\.map\(\(item\) => toRecommendationAction\(item, "loop"\)\)/);
assert.match(appJs, /\/api\/client\/open/);
assert.match(appJs, /\/api\/client\/events/);
assert.match(appJs, /new EventSource/);
assert.doesNotMatch(appJs, /externalModels\.experimental\.gemNodes\.budget\s*\|\|\s*state\.playerProfile\.compatibility\.unresolvedProfileFields\.gemDust/);
assert.match(appJs, /CIFI Already Open/);
assert.match(appJs, /window\.close\(\)/);
assert.doesNotMatch(appJs, /C:\/Users\/Shadow\/Downloads/);
assert.doesNotMatch(appJs, /function getShardUpgradeCost/);
assert.doesNotMatch(appJs, /function getShardUpgradeValue/);
assert.doesNotMatch(appJs, /function getShardFocusWeight/);
assert.doesNotMatch(appJs, /function simulateShard/);
assert.match(devServer, /\/api\/healthz/);
assert.match(devServer, /\/api\/launcher\/reopen/);
assert.match(devServer, /\/api\/client\/open/);
assert.match(devServer, /\/api\/client\/events/);
assert.match(devServer, /event: launch/);
assert.match(devServer, /Launcher-mode server is idle\. Shutting down\./);
assert.match(launcherVbs, /http:\/\/localhost:4173\//);
assert.match(launcherVbs, /http:\/\/localhost:4173\/\?launch=1/);
assert.match(launcherVbs, /Start-Process -WindowStyle Hidden/);
assert.match(launcherVbs, /--launcher-mode/);
assert.match(launcherVbs, /ResolveNodePath/);
assert.match(launcherVbs, /ResolveFromWhere\("node\.exe"\)/);
assert.equal(pkg.scripts.dev, "node ./scripts/dev-server.mjs");
assert.equal(pkg.scripts["verify:data"], "node ./scripts/validate-datasets.mjs");
assert.equal(pkg.scripts.test, "node ./tests/smoke.mjs");

await verifyLauncherModeServerLifecycle();

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

const migratedUnmappedSystemsProfile = normalizePlayerProfile({
  profileName: "Unmapped systems",
  systems: {
    shardMilestones: {
      selectedMilestone: "alpha",
      observedLevel: 12
    },
    tokenShop: {
      tokenBoostLevel: 4
    },
    multiverseMarket: {
      inscription51Level: 2
    }
  }
});

assert.equal(migratedUnmappedSystemsProfile.meta.profileName, "Unmapped systems");
assert.deepEqual(migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.shardMilestones, {
  selectedMilestone: "alpha",
  observedLevel: 12
});
assert.deepEqual(migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.tokenShop, {
  tokenBoostLevel: 4
});
assert.deepEqual(migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.multiverseMarket, {
  inscription51Level: 2
});
assert.equal(migratedUnmappedSystemsProfile.player.resources.tokens, null);

assert.match(appJs, /function normalizeLoadoutName/);
assert.match(appJs, /name: normalizeLoadoutName\(stored\.name, fallback\.name\)/);

console.log("Smoke tests passed.");

async function waitForServer(url, attempts = 50, delayMs = 250) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function verifyLauncherModeServerLifecycle() {
  const testPort = 43000 + Math.floor(Math.random() * 1000);
  let serverProcess;
  let spawnError = null;
  let serverStdout = "";
  let serverStderr = "";

  try {
    serverProcess = spawn(process.execPath, [fileURLToPath(new URL("../scripts/dev-server.mjs", import.meta.url))], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(testPort),
        CIFI_LAUNCH_MODE: "1"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    if (error?.code === "EPERM") {
      console.warn("Skipping launcher-mode lifecycle spawn test because child_process.spawn is not permitted here.");
      return;
    }
    throw error;
  }

  serverProcess.once("error", (error) => {
    spawnError = error;
  });
  serverProcess.stdout.on("data", (chunk) => {
    serverStdout += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverStderr += chunk.toString();
  });

  try {
    await waitForServer(`http://localhost:${testPort}/api/healthz`);
  } catch (error) {
    const combinedOutput = `${serverStdout}\n${serverStderr}`;
    if (spawnError?.code === "EPERM" || /EPERM|not permitted/i.test(combinedOutput) || serverProcess.exitCode !== null) {
      console.warn("Skipping launcher-mode lifecycle spawn test because the environment blocked subprocess launch.");
      return;
    }
    throw new Error(`${error.message}\nstdout: ${serverStdout}\nstderr: ${serverStderr}`);
  }

  const clientOpen = await postJson(`http://localhost:${testPort}/api/client/open`, { clientId: "smoke-client" });
  assert.equal(clientOpen.ok, true);
  assert.equal(clientOpen.launcherMode, true);

  const eventController = new AbortController();
  const eventStream = await fetch(`http://localhost:${testPort}/api/client/events?clientId=smoke-client`, {
    signal: eventController.signal
  });
  assert.equal(eventStream.ok, true);

  const launcherReopen = await fetch(`http://localhost:${testPort}/api/launcher/reopen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  assert.equal(launcherReopen.status, 202);

  const healthAfterOpen = await fetchJson(`http://localhost:${testPort}/api/healthz`);
  assert.equal(healthAfterOpen.clientCount, 1);
  assert.equal(healthAfterOpen.launchSignalSequence, 1);

  const clientClose = await postJson(`http://localhost:${testPort}/api/client/close`, { clientId: "smoke-client" });
  assert.equal(clientClose.ok, true);
  eventController.abort();

  await waitForExit(serverProcess, 9000);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  assert.ok(response.ok, `Expected successful response from ${url}`);
  return response.json();
}

async function fetchJson(url) {
  const response = await fetch(url);
  assert.ok(response.ok, `Expected successful response from ${url}`);
  return response.json();
}

async function waitForExit(child, timeoutMs) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Timed out waiting for launcher-mode server shutdown"));
    }, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
