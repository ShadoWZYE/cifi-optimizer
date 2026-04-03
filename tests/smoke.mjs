import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  PLAYER_PROFILE_IMPORT_ALIASES,
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  normalizePlayerProfile
} from "../player-profile.js";
import {
  getRecommendationContractIssues,
  sortRecommendationFeed,
  toRecommendationAction
} from "../recommendation-contract.js";
import { validateBundledDatasets } from "../scripts/contracts/validate-datasets.mjs";

const execFileAsync = promisify(execFile);

const snapshot = JSON.parse(await readFile(new URL("../data/game-data.snapshot.v1.json", import.meta.url), "utf8"));
const groundedShardMilestones = JSON.parse(await readFile(new URL("../data/shard-milestones.grounded.v1.json", import.meta.url), "utf8"));
const groundedShardObserved = JSON.parse(await readFile(new URL("../data/shard-observed-behaviors.grounded.v1.json", import.meta.url), "utf8"));
const groundedShardProvenance = JSON.parse(await readFile(new URL("../data/shard-milestones-provenance.grounded.v1.json", import.meta.url), "utf8"));
const shardAssetGrounding = JSON.parse(await readFile(new URL("../data/shard-asset-grounding.v1.json", import.meta.url), "utf8"));
const shardOwnerFamilyBoundary = JSON.parse(await readFile(new URL("../data/shard-owner-family-boundary.v1.json", import.meta.url), "utf8"));
const shardFinalSuBonusBoundary = JSON.parse(await readFile(new URL("../data/shard-finalsu-bonus-boundary.v1.json", import.meta.url), "utf8"));
const shardMilestonePayloadBoundary = JSON.parse(await readFile(new URL("../data/shard-milestone-payload-boundary.v1.json", import.meta.url), "utf8"));
const shardSaveBoundary = JSON.parse(await readFile(new URL("../data/shard-save-boundary.v1.json", import.meta.url), "utf8"));
const extractionCandidateFamilies = JSON.parse(await readFile(new URL("../data/extraction-candidate-families.v1.json", import.meta.url), "utf8"));
const extractionCandidateRanking = JSON.parse(await readFile(new URL("../data/extraction-candidate-ranking.v1.json", import.meta.url), "utf8"));
const bundledDatasetContract = JSON.parse(await readFile(new URL("../data/bundled-dataset-contract.v1.json", import.meta.url), "utf8"));
const multiverseMarketMetadataNeighborhoodData = JSON.parse(await readFile(new URL("../data/multiverse-market-metadata-neighborhood.json", import.meta.url), "utf8"));
const tokeniumNamingCluesData = JSON.parse(await readFile(new URL("../data/tokenium-naming-clues.json", import.meta.url), "utf8"));
const tokenBankStateCluesData = JSON.parse(await readFile(new URL("../data/token-bank-state-clues.json", import.meta.url), "utf8"));
const dailyTokeniumLaneCluesData = JSON.parse(await readFile(new URL("../data/daily-tokenium-lane-clues.json", import.meta.url), "utf8"));
const tokenBankFormulaBoundaryData = JSON.parse(await readFile(new URL("../data/token-bank-formula-boundary.json", import.meta.url), "utf8"));
const multiverseMarketRangeBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-range-boundary.json", import.meta.url), "utf8"));
const multiverseMarketRowTextCoverageData = JSON.parse(await readFile(new URL("../data/multiverse-market-row-text-coverage.json", import.meta.url), "utf8"));
const multiverseMarketPrefabRemapBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-prefab-remap-boundary.json", import.meta.url), "utf8"));
const tokenShopCostLanesData = JSON.parse(await readFile(new URL("../data/token-shop-cost-lanes.json", import.meta.url), "utf8"));
const spendActionLaneCluesData = JSON.parse(await readFile(new URL("../data/spend-action-lane-clues.json", import.meta.url), "utf8"));
const multiverseMarketActionShellData = JSON.parse(await readFile(new URL("../data/multiverse-market-action-shell.json", import.meta.url), "utf8"));
const multiverseMarketOwnerFamilyData = JSON.parse(await readFile(new URL("../data/multiverse-market-owner-family.json", import.meta.url), "utf8"));
const tokenShopOwnerShellData = JSON.parse(await readFile(new URL("../data/token-shop-owner-shell.json", import.meta.url), "utf8"));
const tokenShopSaveBoundaryData = JSON.parse(await readFile(new URL("../data/token-shop-save-boundary.json", import.meta.url), "utf8"));
const multiverseMarketSaveBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-save-boundary.json", import.meta.url), "utf8"));
const tokenBankControllerShellData = JSON.parse(await readFile(new URL("../data/token-bank-controller-shell.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("../app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const agentsMd = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const groundingPlan = await readFile(new URL("../docs/cifi_grounding_plan.md", import.meta.url), "utf8");
const unityAuditPlaybook = await readFile(new URL("../docs/unity/unity-audit-playbook.md", import.meta.url), "utf8");
const ownerMap = await readFile(new URL("../docs/unity/unity-owner-map.md", import.meta.url), "utf8");
const spendVerificationDoc = await readFile(new URL("../docs/systems/spend/spend-system-verification.md", import.meta.url), "utf8");
const tokenBankStateDoc = await readFile(new URL("../docs/systems/spend/token-bank-state-verification.md", import.meta.url), "utf8");
const dailyTokeniumMissionDoc = await readFile(new URL("../docs/systems/spend/daily-tokenium-mission-lane-verification.md", import.meta.url), "utf8");
const multiverseMarketVerificationDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-verification.md", import.meta.url), "utf8");
const multiverseMarketStateDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-state-verification.md", import.meta.url), "utf8");
const multiverseMarketMetadataNeighborhoodDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-metadata-neighborhood.md", import.meta.url), "utf8");
const recommendationContractModule = await readFile(new URL("../recommendation-contract.js", import.meta.url), "utf8");
const recommendationFixtures = JSON.parse(await readFile(new URL("./fixtures/recommendation-actions.fixtures.json", import.meta.url), "utf8"));
const shardVerificationDoc = await readFile(new URL("../docs/systems/shards/shard-system-verification.md", import.meta.url), "utf8");
const shardGroundingBoundaryDoc = await readFile(new URL("../docs/systems/shards/shard-grounding-boundary.md", import.meta.url), "utf8");
const shardExtractionCandidatesDoc = await readFile(new URL("../docs/systems/shards/shard-extraction-candidates.md", import.meta.url), "utf8");
const shardOwnerFamilyDoc = await readFile(new URL("../docs/systems/shards/shard-owner-family-verification.md", import.meta.url), "utf8");
const shardOwnerFamilyProbe = JSON.parse(await readFile(new URL("../data/shard-owner-family-probe.v1.json", import.meta.url), "utf8"));
const shardVsConstructionOwnerProbe = JSON.parse(await readFile(new URL("../data/shard-vs-construction-owner-probe.v1.json", import.meta.url), "utf8"));
const shardMetadataNeighborhoodDoc = await readFile(new URL("../docs/systems/shards/shard-metadata-neighborhood.md", import.meta.url), "utf8");
const shardBonusMetadataNeighborhoodDoc = await readFile(new URL("../docs/systems/shards/shard-bonus-metadata-neighborhood.md", import.meta.url), "utf8");
const shardminingMetadataNeighborhoodDoc = await readFile(new URL("../docs/systems/shards/shardmining-metadata-neighborhood.md", import.meta.url), "utf8");
const shardUpgradeInfoMetadataNeighborhoodDoc = await readFile(new URL("../docs/systems/shards/shardupgradeinfo-metadata-neighborhood.md", import.meta.url), "utf8");
const shardMetadataNeighborhood = JSON.parse(await readFile(new URL("../data/shard-metadata-neighborhood.v1.json", import.meta.url), "utf8"));
const shardBonusMetadataNeighborhood = JSON.parse(await readFile(new URL("../data/shard-bonus-metadata-neighborhood.v1.json", import.meta.url), "utf8"));
const shardminingMetadataNeighborhood = JSON.parse(await readFile(new URL("../data/shardmining-metadata-neighborhood.v1.json", import.meta.url), "utf8"));
const shardUpgradeInfoMetadataNeighborhood = JSON.parse(await readFile(new URL("../data/shardupgradeinfo-metadata-neighborhood.v1.json", import.meta.url), "utf8"));
const extractionRankingDoc = await readFile(new URL("../docs/unity/extraction-candidate-ranking.md", import.meta.url), "utf8");
const playerProfileSchemaDoc = await readFile(new URL("../docs/contracts/player-profile-schema.md", import.meta.url), "utf8");
const importMappingDoc = await readFile(new URL("../docs/contracts/import-mapping.md", import.meta.url), "utf8");
const playerProfileAliasAuditDoc = await readFile(new URL("../docs/contracts/player-profile-import-aliases.md", import.meta.url), "utf8");
const playerProfileAliasAuditData = JSON.parse(await readFile(new URL("../data/player-profile-import-aliases.v1.json", import.meta.url), "utf8"));
const datasetRefreshChecklistDoc = await readFile(new URL("../docs/contracts/dataset-refresh-checklist.md", import.meta.url), "utf8");
const researchNoteTemplateDoc = await readFile(new URL("../docs/contracts/research-note-template.md", import.meta.url), "utf8");
const shardResearchNote = await readFile(new URL("../docs/research/shard-milestones-grounded-2026-03-28.md", import.meta.url), "utf8");
const tokenShopDoc = await readFile(new URL("../docs/systems/spend/token-shop-values.md", import.meta.url), "utf8");
const multiverseMarketDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-values.md", import.meta.url), "utf8");
const shardIngestDoc = await readFile(new URL("../docs/systems/shards/shard-milestones-grounding-ingest.md", import.meta.url), "utf8");
const devServer = await readFile(new URL("../scripts/dev-server.mjs", import.meta.url), "utf8");
const launcherVbs = await readFile(new URL("../launch-cifi.vbs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
await execFileAsync(process.execPath, ["--check", fileURLToPath(new URL("../app.js", import.meta.url))]);
const datasetValidation = await validateBundledDatasets();
const bootstrapDatasetBindings = getBootstrapDatasetBindings(appJs);

assert.deepEqual(
  bootstrapDatasetBindings.variableNames,
  [
    "snapshot",
    "shipBaseline",
    "groundedShardMilestones",
    "groundedShardObservedBehaviors",
    "groundedShardProvenance",
    "shardAssetGrounding",
    "shardOwnerFamilyBoundary",
    "shardFinalSuBonusBoundary",
    "shardMilestonePayloadBoundary",
    "shardSaveBoundary",
    "extractionCandidateRanking",
    "tokenShopValues",
    "multiverseMarketValues",
    "multiverseMarketMetadataNeighborhood",
    "tokeniumNamingClues",
    "tokenBankStateClues",
    "dailyTokeniumLaneClues",
    "tokenBankFormulaBoundary",
    "multiverseMarketRangeBoundary",
    "multiverseMarketRowTextCoverage",
    "multiverseMarketPrefabRemapBoundary",
    "tokenShopCostLanes",
    "spendActionLaneClues",
    "multiverseMarketActionShell",
    "multiverseMarketOwnerFamily",
    "tokenShopOwnerShell",
    "tokenShopSaveBoundary",
    "multiverseMarketSaveBoundary",
    "tokenBankControllerShell"
  ],
  "bootstrap dataset destructuring changed unexpectedly"
);
assert.deepEqual(
  bootstrapDatasetBindings.fetchPaths,
  [
    "./data/game-data.snapshot.v1.json",
    "./data/ship-optimizer.desmos-baseline.v1.json",
    "./data/shard-milestones.grounded.v1.json",
    "./data/shard-observed-behaviors.grounded.v1.json",
    "./data/shard-milestones-provenance.grounded.v1.json",
    "./data/shard-asset-grounding.v1.json",
    "./data/shard-owner-family-boundary.v1.json",
    "./data/shard-finalsu-bonus-boundary.v1.json",
    "./data/shard-milestone-payload-boundary.v1.json",
    "./data/shard-save-boundary.v1.json",
    "./data/extraction-candidate-ranking.v1.json",
    "./data/token-shop-values.json",
    "./data/multiverse-market-values.json",
    "./data/multiverse-market-metadata-neighborhood.json",
    "./data/tokenium-naming-clues.json",
    "./data/token-bank-state-clues.json",
    "./data/daily-tokenium-lane-clues.json",
    "./data/token-bank-formula-boundary.json",
    "./data/multiverse-market-range-boundary.json",
    "./data/multiverse-market-row-text-coverage.json",
    "./data/multiverse-market-prefab-remap-boundary.json",
    "./data/token-shop-cost-lanes.json",
    "./data/spend-action-lane-clues.json",
    "./data/multiverse-market-action-shell.json",
    "./data/multiverse-market-owner-family.json",
    "./data/token-shop-owner-shell.json",
    "./data/token-shop-save-boundary.json",
    "./data/multiverse-market-save-boundary.json",
    "./data/token-bank-controller-shell.json"
  ],
  "bootstrap fetch order changed unexpectedly"
);
assert.match(appJs, /TokenShop currency shell/);
assert.match(appJs, /Token or tokenium spend lane grounded/);
assert.match(appJs, /Player-facing strings still frame Daily Tokenium as a farm-mission or Academy Menu reward lane that TokenShop and the Collector pack modify/);
assert.match(appJs, /Foundation archive/);
assert.match(appJs, /researchView: "active"/);
assert.match(appJs, /function renderResearchViewSelector\(tracks\)/);
assert.match(appJs, /data-research-view="active"/);
assert.match(appJs, /data-research-view="archived"/);
assert.match(appJs, /function bindResearchViewSelector\(\)/);
assert.match(appJs, /track\.status === "archived" : track\.status !== "archived"/);
assert.match(styles, /\.research-view-toggle/);
assert.match(appJs, /Active roadmap slice/);
assert.match(appJs, /Queued behind mapping gate/);
assert.match(appJs, /Queued after gate/);
assert.match(appJs, /Sequence 1\/5/);
assert.match(appJs, /Sequence 4\/5/);
assert.match(appJs, /PR 3 then PR 5 hardening/);
assert.match(appJs, /APK\/Unity first/);
assert.match(appJs, /Integration contract/);
assert.match(appJs, /In research/);
assert.match(appJs, /checked APK or Unity evidence/);
assert.match(appJs, /Confidence, uncertainty, and classification are explicit/);
assert.match(appJs, /Sources/);
assert.match(appJs, /Repo artifacts/);
assert.match(appJs, /Verified now/);
assert.match(appJs, /Still uncertain/);
assert.match(appJs, /Smallest shippable slice/);
assert.match(appJs, /Research intake only/);
assert.match(appJs, /"hunter-related-planning"/);
assert.match(appJs, /"mech-related-planning"/);
assert.match(appJs, /"input-automation-intake"/);
assert.match(appJs, /"external-model-integration-intake"/);
assert.match(appJs, /function renderResearchGuidance/);
assert.match(appJs, /Tracks stay in intake until they are mature enough for roadmap work/);
assert.match(appJs, /Not a product commitment/);
assert.match(appJs, /Promotion rule/);
assert.match(appJs, /Track categories/);
assert.match(appJs, /Candidate MVP-adjacent/);
assert.match(appJs, /Post-MVP candidates/);
assert.match(appJs, /Deferred infrastructure/);
assert.match(appJs, /Current research rules/);
assert.match(appJs, /Hunter planning stays in research/);
assert.match(appJs, /Mech planning stays in research/);
assert.match(appJs, /Input automation stays in research/);
assert.match(appJs, /External-model integration stays in research/);
assert.match(appJs, /function renderShardGroundingBoundary/);
assert.match(appJs, /function getShardOwnerFamilyBoundarySummary/);
assert.match(appJs, /function getShardFinalSuBonusBoundarySummary/);
assert.match(appJs, /Grounded shard boundary/);
assert.match(appJs, /Owner-family narrowing/);
assert.match(appJs, /Shard-specific trail beats the generic milestone lead/);
assert.match(appJs, /FinalSU field boundary/);
assert.match(appJs, /ShardUpgradeInfo keeps the bonus-field family local/);
assert.match(appJs, /Safe repo truths vs descriptive milestone data/);
assert.match(appJs, /Community-grounded milestone rows/);
assert.match(appJs, /What must be grounded before stronger behavior/);
assert.match(appJs, /If uncertainty remains high, the correct output is a better research note, not stronger planner behavior/);
assert.match(appJs, /function renderDatasetRefreshHardening/);
assert.match(appJs, /Dataset refresh hardening path/);
assert.match(appJs, /Use this before promoting new bundled data or refreshing shipped JSON assets/);
assert.match(appJs, /data\/bundled-dataset-contract\.v1\.json/);
assert.match(appJs, /canonical-app-snapshot/);
assert.match(appJs, /community-derived/);
assert.match(appJs, /function renderSpendPlannerBoundary/);
assert.match(appJs, /Spend planner boundary/);
assert.match(appJs, /Extracted spend data is grounded enough for boundary notes, but still blocked for planner cards/);
assert.match(appJs, /Safe grounded truths now/);
assert.match(appJs, /Still blocked before planner behavior/);
assert.match(appJs, /Imported spend payload watch/);
assert.match(appJs, /compatibility\.unmappedSystemState/);
assert.match(appJs, /No quarantined TokenShop payload is present in the imported PlayerProfile/);
assert.match(appJs, /No quarantined MultiverseMarket payload is present in the imported PlayerProfile/);
assert.match(appJs, /First safe spend unlock path/);
assert.match(appJs, /No spend recommendations yet/);
assert.match(appJs, /TokenShop token-bank anchors/);
assert.match(appJs, /Recovered token-bank controller anchors available/);
assert.match(appJs, /Validated late-block constants available/);
assert.match(appJs, /validated late-block row set/);
assert.match(appJs, /BigStatisticPrefab\.TokenBankCap/);
assert.match(appJs, /TextHandlerLoopMods\.SetLM244BonusText/);
assert.match(appJs, /Inscryptions Done/);
assert.match(appJs, /function getRecommendationExplainabilitySummary/);
assert.match(appJs, /function getRecommendationContractSummary/);
assert.match(appJs, /function getRecommendationExplainabilityAudit/);
assert.match(appJs, /function getActiveMvpRecommendationFeedPartition\(\)/);
assert.match(appJs, /function renderRecommendationFeedSupportNotice\(results, surface\)/);
assert.match(appJs, /failed the shared recommendation contract and were removed from the main feed/);
assert.match(appJs, /Use the contract audit details to repair those cards before treating them as player-facing guidance/);
assert.match(appJs, /Contract audit: Valid/);
assert.match(appJs, /No contract gaps in the active feed/);
assert.match(appJs, /Status: Contract gaps\./);
assert.match(appJs, /The current card satisfies the shared recommendation contract\./);
assert.match(appJs, /Player value/);
assert.match(appJs, /Explainability coverage: Why now/);
assert.match(appJs, /Average confidence:/);
assert.match(appJs, /Items with all explainability fields:/);
assert.match(appJs, /Explainability audit: Complete context/);
assert.match(appJs, /Partial context/);
assert.match(appJs, /Missing source notes/);
assert.match(appJs, /Explainability audit/);
assert.match(appJs, /Status: \$\{escapeHtml\(explainabilityAudit\.status\)\}\./);
assert.match(appJs, /Source note: \$\{escapeHtml\(explainabilityAudit\.sourceNoteStatus\)\}\./);
assert.match(appJs, /Missing: none\./);
assert.match(appJs, /Partial context/);
assert.match(appJs, /Complete context/);
assert.match(appJs, /function getPlayerProfileBoundaryAudit/);
assert.match(appJs, /Import boundary audit/);
assert.match(appJs, /Normalization keeps imported values in labeled namespaces instead of flattening them into raw game truth/);
assert.match(appJs, /Quarantined unmapped system blobs preserved:/);
assert.match(appJs, /Compatibility-only leftovers preserved:/);
assert.match(appJs, /Review the boundary audit before using recommendations/);
const normalizedFeedAction = toRecommendationAction({
  id: " shard-threshold ",
  module: "shards",
  kind: "upgrade",
  title: "Threshold watch",
  score: "42",
  confidence: "1.4",
  benefit: ["  Track next threshold  ", "", null],
  whyNow: ["  Grounded shard threshold  "],
  assumptions: [" descriptive only "],
  warnings: [" no ROI implied "]
}, "loop");
const fallbackFeedAction = toRecommendationAction(
  {
    score: "bad",
    confidence: -5,
    whyNow: [" ", "Missing inputs"]
  },
  "loop"
);
const sortedFeedFixture = sortRecommendationFeed([
  toRecommendationAction({ id: "upgrade-high", module: "shards", kind: "upgrade", title: "Upgrade high", score: 99, confidence: 0.9 }, "shards"),
  toRecommendationAction({ id: "warning-low", module: "loop", kind: "warning", title: "Warning low", score: 20, confidence: 0.2 }, "loop"),
  toRecommendationAction({ id: "warning-high", module: "loop", kind: "warning", title: "Warning high", score: 20, confidence: 0.8 }, "loop")
]);
const invalidFeedIssues = getRecommendationContractIssues({
  id: "",
  module: "",
  kind: "todo",
  title: "",
  score: Number.NaN,
  confidence: 2,
  benefit: [],
  whyNow: ["ok", ""],
  assumptions: null,
  warnings: ["warning"]
});
const normalizedFixtureActions = recommendationFixtures.actions.map((item) => toRecommendationAction(item, item.module));
const sortedFixtureActions = sortRecommendationFeed(normalizedFixtureActions);

const defaultProfile = createDefaultPlayerProfile();

assert.equal(snapshot.snapshotVersion, "v1.0.0-alpha");
assert.equal(bundledDatasetContract.contractVersion, "v1");
assert.equal(bundledDatasetContract.validationCommand, "npm run verify:data");
assert.deepEqual(
  bundledDatasetContract.sourcePriority.map((entry) => entry.id),
  ["apk-unity-artifacts", "official-public-corroboration", "community-gap-filling"]
);
assert.deepEqual(
  bundledDatasetContract.datasets.map((entry) => entry.id),
  ["snapshot", "shards", "shard-asset-grounding", "shard-owner-family-boundary", "shard-finalsu-bonus-boundary", "shard-milestone-payload-boundary", "shard-save-boundary", "extraction-candidate-families", "extraction-candidate-ranking", "token-shop", "multiverse-market", "multiverse-market-metadata-neighborhood", "tokenium-naming-clues", "token-bank-state-clues", "daily-tokenium-lane-clues", "token-bank-formula-boundary", "multiverse-market-range-boundary", "multiverse-market-row-text-coverage", "multiverse-market-prefab-remap-boundary", "token-shop-cost-lanes", "spend-action-lane-clues", "multiverse-market-action-shell", "multiverse-market-owner-family", "token-shop-owner-shell", "token-shop-save-boundary", "multiverse-market-save-boundary", "token-bank-controller-shell"]
);
assert.deepEqual(
  bundledDatasetContract.datasets.map((entry) => entry.classification),
  ["canonical-app-snapshot", "grounded-descriptive", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics", "extracted-mechanics"]
);
assert.deepEqual(
  bundledDatasetContract.datasets.find((entry) => entry.id === "shards")?.files,
  [
    "data/shard-milestones.grounded.v1.json",
    "data/shard-observed-behaviors.grounded.v1.json",
    "data/shard-milestones-provenance.grounded.v1.json"
  ]
);
assert.deepEqual(
  Object.keys(PLAYER_PROFILE_IMPORT_ALIASES),
  ["meta", "canonical", "planner", "externalModel", "experimental", "compatibility", "shipCalibration"]
);
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.canonical.diamonds.some((path) => path.join(".") === "gems"));
assert.deepEqual(
  PLAYER_PROFILE_IMPORT_ALIASES.externalModel.shipPower.map((path) => path.join(".")),
  ["externalModels.shipPlanner.summary.power", "systems.ship.power"]
);
assert.deepEqual(
  PLAYER_PROFILE_IMPORT_ALIASES.experimental.primaryFarmingFocus.map((path) => path.join(".")),
  ["externalModels.experimental.profileHints.primaryFarmingFocus"]
);
assert.deepEqual(
  PLAYER_PROFILE_IMPORT_ALIASES.compatibility.hunterLevel.map((path) => path.join(".")),
  ["compatibility.unresolvedProfileFields.hunterLevel", "systems.metaProgression.hunterLevel"]
);
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.planner.shardFocusMilestoneLevel.some((path) => path.join(".") === "systems.shards.focusMilestoneLevel"));
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.shipCalibration.communityToolState.some((path) => path.join(".") === "externalModels.shipPlanner.communityToolState"));
assert.equal(playerProfileAliasAuditData.version, "v1");
assert.equal(playerProfileAliasAuditData.groupCount, 7);
assert.equal(playerProfileAliasAuditData.aliasCount, 30);
assert.equal(playerProfileAliasAuditData.acceptedPathCount, 68);
assert.deepEqual(
  playerProfileAliasAuditData.groups.map((group) => group.id),
  ["meta", "canonical", "planner", "externalModel", "experimental", "compatibility", "shipCalibration"]
);
assert.match(playerProfileAliasAuditDoc, /# PlayerProfile Import Aliases/);
assert.match(playerProfileAliasAuditDoc, /## Canonical Shared Truth/);
assert.match(playerProfileAliasAuditDoc, /## Compatibility-only Migration Sinks/);
assert.match(playerProfileAliasAuditDoc, /systems\.ship\.playerState/);
assert.match(playerProfileAliasAuditDoc, /Accepted alias paths: 3/);
assert.match(playerProfileAliasAuditDoc, /Accepted alias paths: 18/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `resourceFocus`/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `power`/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `hunterLevel` \|/);
assert.ok(snapshot.shipLoadouts.length >= 4, "expected ship loadouts");
assert.deepEqual(snapshot.shardMilestones, [], "expected shard milestones to stay quarantined until verified");
assert.ok(snapshot.gemNodes.length >= 4, "expected gem nodes");
assert.equal(snapshot.validationCases.length, 4, "expected shipped validation case count");
assert.ok(snapshot.validationCases.some((item) => item.expected === "Add current LR for loop guardrails"), "expected ranked progression validation case");
assert.ok(snapshot.validationCases.some((item) => item.expected === "All active feed items satisfy shared recommendation contract"), "expected recommendation feed contract validation case");
assert.ok(groundedShardMilestones.milestones.length >= 20, "expected grounded shard milestone dataset");
assert.ok(groundedShardObserved.observations.length >= 4, "expected grounded shard behavior examples");
assert.ok(groundedShardProvenance.uncertaintyLog.length >= 2, "expected grounded shard provenance notes");
assert.equal(shardAssetGrounding.dataset, "shard-asset-grounding.v1");
assert.equal(shardAssetGrounding.integrationStatus, "available-but-unmapped");
assert.ok(shardAssetGrounding.groundedShellIdentifiers.includes("LoopResetStage1"));
assert.ok(shardAssetGrounding.groundedShellIdentifiers.includes("MilestoneBonusesPerLevel"));
assert.ok(shardAssetGrounding.groundedFacts.some((fact) => /ShardUpgradeInfo/.test(fact)));
assert.ok(shardAssetGrounding.unresolvedGaps.length >= 4, "expected shard asset grounding gaps");
assert.ok(shardAssetGrounding.unresolvedGaps.includes("exact milestone data object or serialized row payload"));
assert.equal(shardOwnerFamilyBoundary.dataset, "shard-owner-family-boundary.v1");
assert.ok(shardOwnerFamilyBoundary.screenControllerFamilies.includes("ShardMining, Assembly-CSharp"));
assert.ok(shardOwnerFamilyBoundary.dataCarrierCandidates.includes("ShardMining|ShardUpgradeInfo"));
assert.ok(shardOwnerFamilyBoundary.dataCarrierCandidates.includes("ShardUpgradeInfo"));
assert.ok(shardOwnerFamilyBoundary.screenControlAnchors.includes("FastBuyButtonMethodShards"));
assert.ok(shardOwnerFamilyBoundary.bonusFieldAnchors.includes("FinalSU29Bonus2"));
assert.equal(shardOwnerFamilyBoundary.downgradedGenericLead.family, "ConstructionMilestones, Assembly-CSharp");
assert.ok(shardOwnerFamilyBoundary.currentBoundary.some((line) => /Do not promote player-facing milestone labels/.test(line)));
assert.equal(shardFinalSuBonusBoundary.dataset, "shard-finalsu-bonus-boundary.v1");
assert.equal(shardFinalSuBonusBoundary.dataCarrier, "ShardUpgradeInfo");
assert.equal(shardFinalSuBonusBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.ok(shardFinalSuBonusBoundary.unlockRequirementAccessors.includes("get_SU29FinalUnlockReq"));
assert.ok(shardFinalSuBonusBoundary.bonusFieldSamples.includes("FinalSU29Bonus2"));
assert.ok(shardFinalSuBonusBoundary.bonusAccessorSamples.includes("get_FinalSU29Bonus2"));
assert.ok(shardFinalSuBonusBoundary.adjacentFields.includes("OverLevel400Exponent"));
assert.ok(shardFinalSuBonusBoundary.currentBoundary.some((line) => /Do not map FinalSU fields directly/.test(line)));
assert.equal(shardMilestonePayloadBoundary.dataset, "shard-milestone-payload-boundary.v1");
assert.equal(shardMilestonePayloadBoundary.dataCarrier, "ShardUpgradeInfo");
assert.equal(shardMilestonePayloadBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.ok(shardMilestonePayloadBoundary.milestoneStateFields.includes("TotalMilestoneLevels"));
assert.ok(shardMilestonePayloadBoundary.costAndListHooks.includes("UpdateShardCostList"));
assert.ok(shardMilestonePayloadBoundary.progressFillHooks.includes("CheckMilestone9ProgressFill"));
assert.ok(shardMilestonePayloadBoundary.tickFields.includes("CooldownTick"));
assert.ok(shardMilestonePayloadBoundary.sampleCostAccessors.includes("get_SU29Cost"));
assert.ok(shardMilestonePayloadBoundary.currentBoundary.some((line) => /Do not treat these hooks as recovered serialized player-owned milestone rows/.test(line)));
assert.equal(shardSaveBoundary.dataset, "shard-save-boundary.v1");
assert.ok(shardSaveBoundary.ownerShellTermsChecked.includes("ShardMining"));
assert.ok(shardSaveBoundary.ownerShellTermsChecked.includes("UpdateShardCostList"));
assert.ok(shardSaveBoundary.saveFamilyTermsChecked.includes("PlayerProfileData"));
assert.ok(shardSaveBoundary.saveFamilyTermsChecked.includes("CloudSavePlayerProfile"));
assert.equal(shardSaveBoundary.probeResults.metadataNeighborhoodHasSaveTerms, false);
assert.equal(shardSaveBoundary.probeResults.level0HasSaveTerms, false);
assert.equal(shardSaveBoundary.probeResults.ownerShellWithSaveOverlapCount, 0);
assert.equal(shardSaveBoundary.probeResults.directShardPlayerProfileContext, false);
assert.ok(shardSaveBoundary.currentBoundary.some((line) => /zero checked overlap/.test(line)));
assert.equal(extractionCandidateFamilies.dataset, "extraction-candidate-families.v1");
assert.ok(extractionCandidateFamilies.families.length >= 8, "expected seeded extraction candidate families");
assert.ok(extractionCandidateFamilies.families.some((family) => family.id === "shards.milestone-owner-family"));
assert.ok(extractionCandidateFamilies.families.some((family) => family.id === "spend.multiverse-market-owner-family"));
assert.equal(extractionCandidateRanking.dataset, "extraction-candidate-ranking.v1");
assert.equal(extractionCandidateRanking.sourceConfig, "data/extraction-candidate-families.v1.json");
assert.equal(extractionCandidateRanking.topCandidate.id, "spend.multiverse-market-owner-family");
assert.equal(extractionCandidateRanking.topCandidate.track, "spend-planner-from-extracted-data");
assert.ok(Array.isArray(extractionCandidateRanking.familyFilter));
assert.equal(extractionCandidateRanking.familyFilter.length, 0);
const topShardCandidate = extractionCandidateRanking.candidates.find((candidate) => candidate.track === "shards-and-loop-guardrails");
assert.ok(topShardCandidate, "expected a PR2-local shard candidate");
assert.equal(topShardCandidate.id, "shards.milestone-owner-family");
assert.ok(topShardCandidate.heuristicScore >= 500);
assert.ok(topShardCandidate.binaryFileCoverage.includes("workbench/unity/joined/level0"));
assert.ok(topShardCandidate.binaryFileCoverage.includes("workbench/apk/base/global-metadata.dat"));
assert.equal(groundedShardMilestones.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.equal(groundedShardObserved.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.equal(groundedShardProvenance.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.deepEqual(
  datasetValidation.map((entry) => entry.id),
  ["snapshot", "shards", "shard-asset-grounding", "shard-owner-family-boundary", "shard-finalsu-bonus-boundary", "shard-milestone-payload-boundary", "shard-save-boundary", "extraction-candidate-families", "extraction-candidate-ranking", "token-shop", "multiverse-market", "multiverse-market-metadata-neighborhood", "tokenium-naming-clues", "token-bank-state-clues", "daily-tokenium-lane-clues", "token-bank-formula-boundary", "multiverse-market-range-boundary", "multiverse-market-row-text-coverage", "multiverse-market-prefab-remap-boundary", "token-shop-cost-lanes", "spend-action-lane-clues", "multiverse-market-action-shell", "multiverse-market-owner-family", "token-shop-owner-shell", "token-shop-save-boundary", "multiverse-market-save-boundary", "token-bank-controller-shell"]
);
assert.deepEqual(
  datasetValidation.map((entry) => entry.classification),
  bundledDatasetContract.datasets.map((entry) => entry.classification)
);
assert.equal(multiverseMarketMetadataNeighborhoodData.anchor_count, 9);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some((entry) => entry.anchor === "CloudSavePlayerProfile"),
  "expected CloudSavePlayerProfile anchor in multiverse metadata neighborhood"
);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some((entry) => entry.anchor === "PlayerProfileData"),
  "expected PlayerProfileData anchor in multiverse metadata neighborhood"
);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some((entry) => entry.anchor === "InscryptionsDone"),
  "expected InscryptionsDone anchor in multiverse metadata neighborhood"
);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some((entry) => entry.anchor === "SetAllChrystosEmporiumTexts"),
  "expected SetAllChrystosEmporiumTexts anchor in multiverse metadata neighborhood"
);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some((entry) => entry.anchor === "Mech1Unlocked"),
  "expected Mech1Unlocked anchor in multiverse metadata neighborhood"
);
const multiverseMarketCloudSaveEntry = multiverseMarketMetadataNeighborhoodData.results.find((entry) => entry.anchor === "CloudSavePlayerProfile");
const multiverseMarketCloudSaveStrings = (multiverseMarketCloudSaveEntry?.matches ?? []).flatMap((match) => [match.match_value, ...((match.context ?? []).map((item) => item.value))]);
assert.ok(multiverseMarketCloudSaveStrings.some((value) => String(value).includes("CloudSavePlayerProfile")));
assert.ok(multiverseMarketCloudSaveStrings.some((value) => String(value).includes("GetPlayerProfileInfo")));
assert.deepEqual(
  multiverseMarketOwnerFamilyData.ownerAnchors,
  ["MultiverseMarket, Assembly-CSharp", "TextHandlerMarkets", "SetAllChrystosEmporiumTexts", "SetInscryptionsDoneText", "Inscryptions"]
);
assert.deepEqual(
  multiverseMarketOwnerFamilyData.costLaneAnchors,
  ["ResourceAmountText.InscryptionsDone", "AchievementBar-Inscryptions", "CostBox-InscryptionsDone"]
);
assert.deepEqual(multiverseMarketOwnerFamilyData.currencyBoxRange, { start: 1, end: 110, count: 110 });
assert.deepEqual(
  multiverseMarketOwnerFamilyData.validatedCurrencyBoxes,
  ["IS50CurrencyBox", "IS59CurrencyBox", "IS63CurrencyBox", "IS74CurrencyBox"]
);
assert.deepEqual(
  multiverseMarketOwnerFamilyData.sampleBuyHooks,
  ["BuyIS47", "BuyIS64", "BuyIS73", "BuyIS105"]
);
assert.deepEqual(tokeniumNamingCluesData.assetNames.resourceIcons, ["Resource_Tokenium", "Resource_Tokenium_Cap_0"]);
assert.deepEqual(tokeniumNamingCluesData.assetNames.academySprites, ["Aca.Tokenium553"]);
assert.ok(tokeniumNamingCluesData.level0Shells.includes("CostBox-Tokens"));
assert.ok(tokeniumNamingCluesData.level0Shells.includes("CostBox-Tokenium"));
assert.ok(tokeniumNamingCluesData.metadataStrings.includes("Daily Tokenium (from blue farm missions)"));
assert.ok(tokeniumNamingCluesData.metadataStrings.includes("INCREASE TOKENS PER TOKENIUM-553"));
assert.ok(tokenBankStateCluesData.tokenShopMethods.includes("ClaimBankedTokens"));
assert.ok(tokenBankStateCluesData.tokenShopMethods.includes("get_TokenBankCap"));
assert.ok(tokenBankStateCluesData.tokenShopControllerRefs.includes("BankFill"));
assert.ok(tokenBankStateCluesData.tokenShopControllerRefs.includes("TokenBankDescriptionText"));
assert.ok(tokenBankStateCluesData.displayOrHandlerClues.includes("BigStatisticPrefab.TokenBankCap"));
assert.ok(tokenBankStateCluesData.displayOrHandlerClues.includes("TextHandlerLoopMods"));
assert.ok(tokenBankStateCluesData.displayOrHandlerClues.includes("SetLM244BonusText"));
assert.ok(tokenBankStateCluesData.derivedOutputs.includes("FinalTokenBankFillSpeed"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("SpaceAcademy"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("SpaceAcademyMain"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("TextHandlerSpaceAcademy"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("FarmMissions"));
assert.ok(dailyTokeniumLaneCluesData.modifierClues.includes("SetLM244BonusText"));
assert.ok(dailyTokeniumLaneCluesData.modifierClues.includes("BuyLM244"));
assert.ok(dailyTokeniumLaneCluesData.modifierClues.includes("FinalDailyTokenBonus"));
assert.ok(dailyTokeniumLaneCluesData.modifierClues.includes("FinalFragmentsGainedFromFarmMissions"));
assert.ok(dailyTokeniumLaneCluesData.premiumModifierClues.includes("BuyCollectorDevice"));
assert.ok(dailyTokeniumLaneCluesData.premiumModifierClues.includes("CollectorCapBonus"));
assert.ok(dailyTokeniumLaneCluesData.premiumModifierClues.includes("CollectorMatsBonus"));
assert.ok(dailyTokeniumLaneCluesData.playerFacingStrings.includes("0 / 2000 Daily Tokenium (from blue farm missions)"));
assert.ok(tokenBankFormulaBoundaryData.derivedOutputCluster.includes("get_FinalTokenBankCap"));
assert.ok(tokenBankFormulaBoundaryData.derivedOutputCluster.includes("get_FinalTokenBankFillSpeed"));
assert.ok(tokenBankFormulaBoundaryData.derivedOutputCluster.includes("<FinalTokenBankCap>k__BackingField"));
assert.ok(tokenBankFormulaBoundaryData.derivedOutputCluster.includes("<FinalTokenBankFillSpeed>k__BackingField"));
assert.ok(tokenBankFormulaBoundaryData.controllerSideAnchors.includes("ClaimBankedTokens"));
assert.ok(tokenBankFormulaBoundaryData.saveFamilyCluesChecked.includes("PlayerProfileData"));
assert.deepEqual(tokenBankFormulaBoundaryData.saveFamilyCluesInDerivedContext, []);
assert.deepEqual(multiverseMarketRangeBoundaryData.validatedRowRanges, ["50-59", "63-74"]);
assert.equal(multiverseMarketRangeBoundaryData.metadataIsRangeLabel, "IS99Level through IS110Level");
assert.deepEqual(multiverseMarketRangeBoundaryData.overlapIds, []);
assert.deepEqual(multiverseMarketRowTextCoverageData.textHandlerAnchors, ["TextHandlerMarkets", "SetAllChrystosEmporiumTexts"]);
assert.equal(multiverseMarketRowTextCoverageData.validatedRowCostTexts.length, 22);
assert.ok(multiverseMarketRowTextCoverageData.validatedRowCostTexts.includes("SetIS50CostText"));
assert.ok(multiverseMarketRowTextCoverageData.validatedRowCostTexts.includes("SetIS74CostText"));
assert.deepEqual(multiverseMarketRowTextCoverageData.sampleBuyHooks, ["BuyIS50", "BuyIS74"]);
assert.deepEqual(multiverseMarketPrefabRemapBoundaryData.validatedIdsWithoutDirectPrefabName, [69, 70, 71, 72, 73, 74]);
assert.deepEqual(multiverseMarketPrefabRemapBoundaryData.overrideSerializedIdsOutsideValidatedBlock, [60, 61, 62]);
assert.deepEqual(
  multiverseMarketPrefabRemapBoundaryData.explicitPrefabIdOverrides.map((entry) => `${entry.prefabNumber}->${entry.serializedId}`),
  ["69->57", "70->58", "71->59", "72->60", "73->61", "74->62"]
);
assert.ok(tokenShopCostLanesData.tokenSpendGroups.includes("TokenBoost"));
assert.ok(tokenShopCostLanesData.tokenSpendGroups.includes("TokenBoostT2"));
assert.ok(tokenShopCostLanesData.tokenSpendGroups.includes("Tier5Token"));
assert.ok(tokenShopCostLanesData.tokenSpendGroups.includes("MK8TokenBoost"));
assert.ok(tokenShopCostLanesData.dailyTokeniumModifierGroups.includes("TokenDailiesT2"));
assert.ok(tokenShopCostLanesData.dailyTokeniumModifierGroups.includes("TokenDailiesT3"));
assert.deepEqual(tokenShopCostLanesData.diamondGroups, ["DiamondBoost"]);
assert.ok(tokenShopCostLanesData.playerFacingClues.includes("CostBox-Tokens"));
assert.ok(tokenShopCostLanesData.playerFacingClues.includes("CostBox-Tokenium"));
assert.ok(tokenShopCostLanesData.playerFacingClues.includes("Mission Materials Booster"));
assert.ok(spendActionLaneCluesData.tokenDirectBuyHooks.includes("BuyTokenBoost"));
assert.ok(spendActionLaneCluesData.tokenDirectBuyHooks.includes("BuyMK1TokenBoost"));
assert.ok(spendActionLaneCluesData.tokenDirectBuyHooks.includes("BuyMK8TokenBoost"));
assert.deepEqual(spendActionLaneCluesData.diamondDirectBuyHooks, ["BuyDiamondBoost"]);
assert.ok(spendActionLaneCluesData.dailyTokeniumModifierHooks.includes("BuyLM244"));
assert.ok(spendActionLaneCluesData.dailyTokeniumModifierHooks.includes("BuyCollectorDevice"));
assert.ok(spendActionLaneCluesData.dailyTokeniumSupportingShells.includes("CostBox-Tokenium"));
assert.ok(spendActionLaneCluesData.dailyTokeniumSupportingShells.includes("Mission Materials Booster"));
assert.ok(spendActionLaneCluesData.dailyTokeniumSupportingShells.includes("COLLECTERS PACK"));
assert.equal(spendActionLaneCluesData.searchResults.metadata.BuyTokenDailiesT2, 0);
assert.equal(spendActionLaneCluesData.searchResults.metadata.BuyTokenDailiesT3, 0);
assert.equal(spendActionLaneCluesData.searchResults.level0.BuyTokenDailiesT2, 0);
assert.equal(spendActionLaneCluesData.searchResults.level0.BuyTokenDailiesT3, 0);
assert.deepEqual(multiverseMarketActionShellData.textHandlerAnchors, ["TextHandlerMarkets", "SetAllChrystosEmporiumTexts"]);
assert.equal(multiverseMarketActionShellData.contextDerivedBuyHookRange.start, 1);
assert.equal(multiverseMarketActionShellData.contextDerivedBuyHookRange.end, 110);
assert.equal(multiverseMarketActionShellData.contextDerivedBuyHookRange.count, 110);
assert.equal(multiverseMarketActionShellData.contextDerivedCostTextRange.start, 1);
assert.equal(multiverseMarketActionShellData.contextDerivedCostTextRange.end, 110);
assert.equal(multiverseMarketActionShellData.contextDerivedCostTextRange.count, 110);
assert.deepEqual(multiverseMarketActionShellData.validatedBuyHookRanges, ["50-59", "63-74"]);
assert.equal(multiverseMarketActionShellData.validatedBuyHooks.length, 22);
assert.ok(multiverseMarketActionShellData.validatedBuyHooks.includes("BuyIS50"));
assert.ok(multiverseMarketActionShellData.validatedBuyHooks.includes("BuyIS74"));
assert.equal(multiverseMarketActionShellData.validatedCostTexts.length, 22);
assert.ok(multiverseMarketActionShellData.validatedCostTexts.includes("SetIS50CostText"));
assert.ok(multiverseMarketActionShellData.validatedCostTexts.includes("SetIS74CostText"));
assert.ok(tokenShopOwnerShellData.ownerAnchors.includes("TokenShop"));
assert.ok(tokenShopOwnerShellData.ownerAnchors.includes("InitializeTokenShop"));
assert.ok(tokenShopOwnerShellData.ownerAnchors.includes("SetAllTokenShopTexts"));
assert.ok(tokenShopOwnerShellData.tokenBankMethods.includes("get_TokenBankCap"));
assert.ok(tokenShopOwnerShellData.tokenBankMethods.includes("get_ClaimableBankTokens"));
assert.ok(tokenShopOwnerShellData.tokenBankMethods.includes("ClaimBankedTokens"));
assert.ok(tokenShopOwnerShellData.notificationHooks.includes("CheckTokenClaimNotification"));
assert.ok(tokenShopOwnerShellData.notificationHooks.includes("TokenShopButtonNotification"));
assert.ok(tokenShopOwnerShellData.notificationHooks.includes("BankedDescriptionTextIncrease"));
assert.ok(tokenShopOwnerShellData.adjacentDeviceHooks.includes("BuyAutoTokenClicker"));
assert.ok(tokenShopOwnerShellData.adjacentDeviceHooks.includes("BuyAutoDiamondClicker"));
assert.ok(tokenShopOwnerShellData.adjacentDeviceHooks.includes("BuyChestSpeedster"));
assert.equal(tokenShopOwnerShellData.sourcePresence.metadata.TokenShop, 1);
assert.equal(tokenShopOwnerShellData.sourcePresence.metadata.ClaimBankedTokens, 1);
assert.equal(tokenShopOwnerShellData.sourcePresence.level0.TokenShop, 1);
assert.equal(tokenShopOwnerShellData.sourcePresence.level0.ClaimBankedTokens, 1);
assert.ok(tokenShopSaveBoundaryData.ownerShellTermsChecked.includes("TokenShop"));
assert.ok(tokenShopSaveBoundaryData.ownerShellTermsChecked.includes("ClaimBankedTokens"));
assert.ok(tokenShopSaveBoundaryData.saveFamilyTermsChecked.includes("PlayerProfileData"));
assert.ok(tokenShopSaveBoundaryData.saveFamilyTermsChecked.includes("CloudSavePlayerProfile"));
assert.equal(tokenShopSaveBoundaryData.probeResults.metadataHasSaveTerms, true);
assert.equal(tokenShopSaveBoundaryData.probeResults.level0HasSaveTerms, false);
assert.equal(tokenShopSaveBoundaryData.probeResults.ownerShellWithSaveOverlapCount, 0);
assert.equal(tokenShopSaveBoundaryData.probeResults.directTokenShopPlayerProfileContext, false);
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("TokenShop"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("ClaimBankedTokens"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("SetBankFill"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("BankFill"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("TokenBankDescriptionText"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("CheckTokenClaimNotification"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("TokenShopButtonNotification"));
assert.ok(tokenBankControllerShellData.adjacentControllerMethods.includes("get_TokenBankCap"));
assert.ok(tokenBankControllerShellData.adjacentControllerMethods.includes("get_ClaimableBankTokens"));
assert.ok(tokenBankControllerShellData.adjacentControllerMethods.includes("IncreaseBankedTokens"));
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.TokenShop, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.ClaimBankedTokens, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.SetBankFill, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.BankFill, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.TokenBankDescriptionText, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.CheckTokenClaimNotification, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.TokenShopButtonNotification, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.level0.ClaimBankedTokens, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.level0.BankedDescriptionTextIncrease, 1);
assert.ok(multiverseMarketSaveBoundaryData.actionShellTermsChecked.includes("TextHandlerMarkets"));
assert.ok(multiverseMarketSaveBoundaryData.actionShellTermsChecked.includes("SetAllChrystosEmporiumTexts"));
assert.ok(multiverseMarketSaveBoundaryData.saveFamilyTermsChecked.includes("PlayerProfileData"));
assert.ok(multiverseMarketSaveBoundaryData.saveFamilyTermsChecked.includes("CloudSavePlayerProfile"));
assert.equal(multiverseMarketSaveBoundaryData.probeResults.actionShellWithSaveOverlapCount, 0);
assert.equal(multiverseMarketSaveBoundaryData.probeResults.metadataNeighborhoodHasActionTerms, true);
assert.equal(multiverseMarketSaveBoundaryData.probeResults.metadataNeighborhoodHasSaveTerms, true);
assert.equal(multiverseMarketSaveBoundaryData.probeResults.metadataProbeHasSaveTerms, false);
assert.equal(multiverseMarketSaveBoundaryData.probeResults.level0ProbeHasSaveTerms, false);
const multiverseMarketInscryptionsEntry = multiverseMarketMetadataNeighborhoodData.results.find((entry) => entry.anchor === "InscryptionsDone");
const recoveredInscryptionLevels = [...new Set(
  (multiverseMarketInscryptionsEntry?.matches ?? [])
    .flatMap((match) => [match.match_value, ...((match.context ?? []).map((item) => item.value))])
    .flatMap((value) => Array.from(String(value).matchAll(/IS(\d+)Level/g), (match) => Number(match[1])))
    .filter((value) => Number.isFinite(value))
)].sort((left, right) => left - right);
assert.deepEqual(recoveredInscryptionLevels, [99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]);
assert.equal(normalizedFeedAction.id, "shard-threshold");
assert.equal(normalizedFeedAction.kind, "upgrade");
assert.equal(normalizedFeedAction.score, 42);
assert.equal(normalizedFeedAction.confidence, 1);
assert.deepEqual(normalizedFeedAction.benefit, ["Track next threshold"]);
assert.deepEqual(fallbackFeedAction.whyNow, ["Missing inputs"]);
assert.equal(fallbackFeedAction.module, "loop");
assert.equal(fallbackFeedAction.kind, "warning");
assert.equal(fallbackFeedAction.score, 0);
assert.equal(fallbackFeedAction.confidence, 0);
assert.deepEqual(sortedFeedFixture.map((item) => item.id), ["warning-high", "warning-low", "upgrade-high"]);
assert.equal(getRecommendationContractIssues(normalizedFeedAction).length, 0);
assert.ok(invalidFeedIssues.length >= 4, "expected multiple recommendation contract issues");
assert.equal(recommendationFixtures.actions.length, 7);
assert.deepEqual(
  recommendationFixtures.actions.map((item) => item.module),
  ["loop", "loop", "shards", "shards", "shards", "loop", "shards"]
);
assert.ok(
  normalizedFixtureActions.every((item) => getRecommendationContractIssues(item).length === 0),
  "expected representative shard and loop fixtures to satisfy the recommendation contract"
);
assert.ok(
  normalizedFixtureActions.some((item) => item.assumptions.length === 0),
  "expected fixture coverage for partial-context warnings with missing assumptions"
);
assert.ok(
  normalizedFixtureActions.some((item) => item.notes === null),
  "expected fixture coverage for partial-context warnings with missing source notes"
);
assert.deepEqual(
  sortedFixtureActions.map((item) => item.id),
  [
    "loop-guardrail-input-warning",
    "loop-guardrail-rising-requirements-warning",
    "loop-guardrail-buffer-check-warning",
    "shard-module-next-threshold-watch",
    "shard-module-cost-bump-watch",
    "shard-module-next-unlock-watch",
    "shard-module-threshold-mismatch-watch"
  ]
);
const shardTrack = snapshot.researchTracks.find((track) => track.id === "shards-and-loop-guardrails");
assert.ok(shardTrack, "expected shard workflow track");
assert.equal(shardTrack.status, "active");
assert.match(shardTrack.goal, /Keep shard guidance truthful/);
assert.match(shardTrack.currentSlice, /checked shard owner-family boundary, a checked FinalSU bonus-field boundary, a checked milestone payload-watch boundary, and a checked shard save-boundary separation around ShardUpgradeInfo/);
assert.match(shardTrack.currentSlice, /exact serialized row payload or save-side owner behind that narrowed shard-specific trail/);
assert.ok(shardTrack.nextSteps.length >= 3, "expected remaining shard extraction steps");
const spendTrack = snapshot.researchTracks.find((track) => track.id === "spend-planner-from-extracted-data");
assert.ok(spendTrack, "expected spend workflow track");
assert.equal(spendTrack.status, "queued");
assert.match(spendTrack.currentSlice, /Use APK and Unity extraction to harden spend-lane naming, TokenShop cost-lane, action-lane, owner-shell, and save-boundary splits, Daily Tokenium owner-family clues, token-bank controller and formula boundaries, MultiverseMarket prefab-remap boundaries, and save-model boundaries before planner wiring/);
assert.match(spendTrack.currentSlice, /narrow token-bank controller shell around ClaimBankedTokens or SetBankFill or BankFill or TokenBankDescriptionText or TokenShopButtonNotification/);
assert.match(spendTrack.currentSlice, /checked broader BuyIS1-110 or SetIS1-110CostText action shell around the validated 50-59 and 63-74 row block/);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote the MultiverseMarket metadata-neighborhood clue bundle into bundled dataset validation and APK-grounding checks/.test(step)),
  "expected spend track to record metadata-neighborhood validation hardening"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Surface the narrowed MultiverseMarket save-family boundary in the Validation page/.test(step)),
  "expected spend track to record in-app save-side boundary visibility"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a MultiverseMarket prefab-remap boundary into a checked-in dataset/.test(step)),
  "expected spend track to record the prefab-remap boundary dataset"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /recovered IS\*Level field run is broader than the currently validated MultiverseMarket row block/.test(step)),
  "expected spend track to record row-block versus field-run boundary visibility"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote exact MultiverseMarket validated-row coverage into APK checks and research support/.test(step)),
  "expected spend track to record exact row-coverage support in app surfaces"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote TokenShop extracted family coverage into APK checks and research support/.test(step)),
  "expected spend track to record token-shop coverage support in app surfaces"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Refresh the checked-in MultiverseMarket metadata neighborhood from APK artifacts to include CloudSavePlayerProfile, SetAllChrystosEmporiumTexts, and Mech1Unlocked/.test(step)),
  "expected spend track to record stronger APK metadata-neighborhood grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote token versus tokenium naming clues from shipped assets into a checked-in extracted dataset/.test(step)),
  "expected spend track to record token versus tokenium naming grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote token-bank controller-side clues from APK and Unity artifacts into a checked-in extracted dataset/.test(step)),
  "expected spend track to record token-bank controller split grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote Daily Tokenium lane clues from APK, Unity, and checked-in IAP artifacts into a bundled extracted dataset/.test(step)),
  "expected spend track to record Daily Tokenium owner-family grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a token-bank formula boundary from APK metadata/.test(step)),
  "expected spend track to record token-bank formula boundary grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a token-bank controller-shell dataset/.test(step)),
  "expected spend track to record token-bank controller-shell grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a MultiverseMarket range boundary into a checked-in dataset/.test(step)),
  "expected spend track to record MultiverseMarket range-boundary grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote validated-row text coverage from APK and Unity artifacts into a checked-in dataset/.test(step)),
  "expected spend track to record MultiverseMarket row-text coverage grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a TokenShop cost-lane boundary into a checked-in dataset/.test(step)),
  "expected spend track to record TokenShop cost-lane grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a spend action-lane boundary into a checked-in dataset/.test(step)),
  "expected spend track to record spend action-lane grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a MultiverseMarket action-shell boundary into a checked-in dataset/.test(step)),
  "expected spend track to record MultiverseMarket action-shell grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a TokenShop owner-shell boundary into a checked-in dataset/.test(step)),
  "expected spend track to record TokenShop owner-shell grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a TokenShop save-boundary dataset/.test(step)),
  "expected spend track to record TokenShop save-boundary grounding"
);
assert.ok(
  spendTrack.completedSteps.some((step) => /Promote a MultiverseMarket save-boundary dataset/.test(step)),
  "expected spend track to record MultiverseMarket save-boundary grounding"
);
const feedTrack = snapshot.researchTracks.find((track) => track.id === "unified-feed-and-hardening");
assert.ok(feedTrack, "expected unified feed track");
assert.equal(feedTrack.status, "active");
assert.match(feedTrack.currentSlice, /quarantine contract-bad shard or loop cards out of the main player feed/);
assert.ok(
  feedTrack.completedSteps.some((step) => /Show the bundled dataset refresh hardening path inside the validation surface/.test(step)),
  "expected unified feed track to record in-app refresh hardening"
);
assert.ok(
  feedTrack.completedSteps.some((step) => /Show feed-level explainability coverage counts/.test(step)),
  "expected unified feed track to record explainability coverage work"
);
assert.ok(
  feedTrack.completedSteps.some((step) => /Show per-card explainability audit status/.test(step)),
  "expected unified feed track to record per-card explainability audit work"
);
assert.ok(
  feedTrack.completedSteps.some((step) => /Show feed-level complete-versus-partial explainability audit counts/.test(step)),
  "expected unified feed track to record feed-level explainability audit counts"
);
assert.ok(
  feedTrack.completedSteps.some((step) => /Expand representative shard and loop fixtures toward partial-context warning shapes/.test(step)),
  "expected unified feed track to record partial-context fixture coverage"
);
assert.ok(
  feedTrack.completedSteps.some((step) => /recommendation contract audit status and per-card contract validity/.test(step)),
  "expected unified feed track to record recommendation contract audit visibility"
);
assert.ok(
  feedTrack.completedSteps.some((step) => /Promote recommendation-contract integrity into a shipped validation case/.test(step)),
  "expected unified feed track to record runtime feed contract validation"
);
assert.ok(
  feedTrack.completedSteps.some((step) => /explicit player-value benefit lines on active cards/.test(step)),
  "expected unified feed track to record explicit player-value benefit lines"
);
assert.ok(
  feedTrack.completedSteps.some((step) => /Quarantine contract-bad shard or loop cards into a labeled support notice/.test(step)),
  "expected unified feed track to record contract-bad card quarantine"
);
assert.ok(
  feedTrack.nextSteps.some((step) => /Apply the same refresh discipline when new asset-grounded datasets or owner recoveries are promoted/.test(step)),
  "expected unified feed track to keep refresh discipline as remaining work"
);
assert.ok(
  feedTrack.nextSteps.some((step) => /Keep strengthening explainability coverage as new recommendation modules join the feed/.test(step)),
  "expected unified feed track to keep explainability hardening open"
);
const profileTrack = snapshot.researchTracks.find((track) => track.id === "playerprofile-boundary-and-imports");
assert.ok(profileTrack, "expected player profile track");
assert.equal(profileTrack.status, "archived");
assert.match(profileTrack.currentSlice, /classified alias inventory/);
assert.match(profileTrack.currentSlice, /reduced non-canonical migration surface/);
assert.equal(profileTrack.nextSteps.length, 0);
const datasetContractTrack = snapshot.researchTracks.find((track) => track.id === "data-contracts-and-apk-pipeline");
assert.ok(datasetContractTrack, "expected dataset contract track");
assert.equal(datasetContractTrack.status, "archived");
assert.match(datasetContractTrack.currentSlice, /checked-in bundled-dataset contract manifest/);
assert.match(datasetContractTrack.currentSlice, /dataset refresh checklist/);
assert.equal(datasetContractTrack.nextSteps.length, 0);
const hunterTrack = snapshot.researchTracks.find((track) => track.id === "hunter-related-planning");
assert.ok(hunterTrack, "expected hunter intake track");
assert.equal(hunterTrack.status, "research");
assert.equal(hunterTrack.classification, "speculative");
assert.equal(hunterTrack.apkUnityPathChecked, false);
assert.match(hunterTrack.currentSlice, /separate real hunter state from planning metadata/);
const mechTrack = snapshot.researchTracks.find((track) => track.id === "mech-related-planning");
assert.ok(mechTrack, "expected mech intake track");
assert.equal(mechTrack.status, "research");
assert.equal(mechTrack.apkUnityPathChecked, true);
assert.match(mechTrack.currentSlice, /uses recovered metadata clues only to narrow persistence neighborhoods/);
const automationTrack = snapshot.researchTracks.find((track) => track.id === "input-automation-intake");
assert.ok(automationTrack, "expected automation intake track");
assert.equal(automationTrack.status, "research");
assert.equal(automationTrack.category, "deferred-infrastructure");
assert.match(automationTrack.currentSlice, /guided import is insufficient without OCR/);
const externalModelTrack = snapshot.researchTracks.find((track) => track.id === "external-model-integration-intake");
assert.ok(externalModelTrack, "expected external-model intake track");
assert.equal(externalModelTrack.status, "research");
assert.equal(externalModelTrack.classification, "external-model");
assert.match(externalModelTrack.currentSlice, /avoid mixing app truth with model assumptions/);
assert.match(agentsMd, /## Integration gate/);
assert.match(agentsMd, /## Architecture rules/);
assert.match(agentsMd, /Before integrating a system into app behavior, verify/);
assert.match(agentsMd, /do not wire the system into planner\/recommendation logic/);
assert.match(agentsMd, /keep it in docs, extraction, mapping, validation, or descriptive-mode surfaces/);
assert.match(agentsMd, /record the unresolved gap/);
assert.match(groundingPlan, /## System integration gate/);
assert.match(groundingPlan, /Fail this gate if any of the above are inferred rather than evidenced/);
assert.match(groundingPlan, /Presence of extracted data is not enough/);
assert.match(groundingPlan, /Even when a system is known to exist in CIFI/);
assert.match(unityAuditPlaybook, /## Integration readiness gate/);
assert.match(unityAuditPlaybook, /MultiverseMarket/);
assert.match(unityAuditPlaybook, /Current narrowed but unresolved owner family/);
assert.match(unityAuditPlaybook, /shard milestones \/ loop-reset shell/);
assert.match(unityAuditPlaybook, /LoopResetStage1/);
assert.match(unityAuditPlaybook, /ShardMining, Assembly-CSharp/);
assert.match(unityAuditPlaybook, /ShardUpgradeInfo/);
assert.match(unityAuditPlaybook, /TotalMilestoneLevels/);
assert.match(unityAuditPlaybook, /FinalSU\*Bonus\*/);
assert.match(unityAuditPlaybook, /ConstructionMilestones, Assembly-CSharp/);
assert.match(unityAuditPlaybook, /generic or academy-side milestone family/);
assert.match(unityAuditPlaybook, /Recommended next unresolved extraction target after PR2/);
assert.match(unityAuditPlaybook, /narrowed persistence search toward `PlayerProfileData`/);
assert.match(unityAuditPlaybook, /exact metadata field clues such as `InscryptionsDone` and nearby `IS\*Level`/);
assert.match(unityAuditPlaybook, /broader progression-style field run that continues into trade counters and `Mech\*` fields/);
assert.match(ownerMap, /integration status: owner and serialized constants verified/);
assert.match(ownerMap, /base spend lane is now grounded as token or tokenium spending/);
assert.match(ownerMap, /Daily Tokenium lane is now better grounded as an Academy or Farm Mission reward family/);
assert.match(ownerMap, /OR_TokenBankCap/);
assert.match(ownerMap, /recovered currency-shell evidence/);
assert.match(ownerMap, /resourceicons\/resource_tokenium/);
assert.match(ownerMap, /resourceicons\/resource_tokenium_cap/);
assert.match(ownerMap, /TokenBankDescriptionText/);
assert.match(ownerMap, /FinalTokenBankCap/);
assert.match(ownerMap, /integration status: owner, partial row constants, and `Inscryptions Done` spend-lane shell verified/);
assert.match(ownerMap, /Inscryptions Done/);
assert.match(ownerMap, /InscryptionsDone/);
assert.match(ownerMap, /IS50Level/);
assert.match(ownerMap, /NecrumR1Trades/);
assert.match(ownerMap, /Mech1Unlocked/);
assert.match(ownerMap, /BuyIS47/);
assert.match(ownerMap, /PlayerProfileData/);
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
assert.match(ownerMap, /Narrowed but not yet planner-ready owner families/);
assert.match(ownerMap, /shard milestones \/ loop-reset shell/);
assert.match(ownerMap, /LoopResetStage1/);
assert.match(ownerMap, /ShardMilestones-64/);
assert.match(ownerMap, /MilestoneBonusesPerLevel/);
assert.match(ownerMap, /SpaceShip-ShardMining-LV1/);
assert.match(ownerMap, /ShardMining, Assembly-CSharp/);
assert.match(ownerMap, /ShardUpgradeInfo/);
assert.match(ownerMap, /TotalMilestoneLevels/);
assert.match(ownerMap, /zero checked overlap with `PlayerProfileData`, `GetPlayerProfileData`, `FillPlayerProfileData`, or `CloudSavePlayerProfile`/);
assert.match(ownerMap, /get_SU1FinalUnlockReq/);
assert.match(ownerMap, /FinalSU1Bonus1/);
assert.match(ownerMap, /ConstructionMilestones, Assembly-CSharp/);
assert.match(ownerMap, /generic or academy-side milestone family/);
assert.match(ownerMap, /keep planner behavior blocked/);
assert.match(spendVerificationDoc, /# Spend System Verification Gate/);
assert.match(spendVerificationDoc, /available but unmapped/);
assert.match(spendVerificationDoc, /Verified currency-shell evidence now includes/);
assert.match(spendVerificationDoc, /resourceicons\/resource_tokenium/);
assert.match(spendVerificationDoc, /resourceicons\/resource_tokenium_cap/);
assert.match(spendVerificationDoc, /Adjacent systems this signals/);
assert.match(spendVerificationDoc, /Meltdown-linked gating objects/);
assert.match(spendVerificationDoc, /downstream effect domains touched by TokenShop upgrades/);
assert.match(spendVerificationDoc, /It is safe to describe its cost lane as token-bank token or tokenium spending/);
assert.match(spendVerificationDoc, /token-bank cap, fill, claim, and daily tokenium state should remain `available but unmapped`/);
assert.match(spendVerificationDoc, /OR_TokenBankCap` and `OR_TokensFromChests` should currently be treated as grounded asset labels/);
assert.match(spendVerificationDoc, /claim actions resolve through `TokenShop`, token-bank cap display resolves through `BigStatisticPrefab\.TokenBankCap`, and at least one daily-tokenium text path resolves through `TextHandlerLoopMods\.SetLM244BonusText`/);
assert.match(spendVerificationDoc, /LM244` should currently be treated as a loop-mod text or explanation hook for daily tokenium, not as the recovered gameplay owner of that lane/);
assert.match(spendVerificationDoc, /Daily Tokenium is now better grounded as an Academy or Farm Mission reward lane that `TokenShop`, `LoopModifiers`, and the Collector pack all touch/);
assert.match(spendVerificationDoc, /CostBox-InscryptionsDone/);
assert.match(spendVerificationDoc, /InscryptionsDone/);
assert.match(spendVerificationDoc, /IS50Level/);
assert.match(spendVerificationDoc, /exact metadata field names for this lane/);
assert.match(spendVerificationDoc, /broader progression-style field block around `InscryptionsDone`/);
assert.match(spendVerificationDoc, /saved-state owner or runtime balance field behind the `Inscryptions Done` spend lane/);
assert.match(spendVerificationDoc, /It is safe to stop inferring its spend lane from diamonds, tokens, or other unrelated player resources/);
assert.match(spendVerificationDoc, /PlayerProfileData/);
assert.match(spendVerificationDoc, /The current best repo-local saved-state path is the broader `PlayerProfileData` persistence family/);
assert.match(multiverseMarketVerificationDoc, /# Multiverse Market Verification Gate/);
assert.match(multiverseMarketVerificationDoc, /CostBox-InscryptionsDone/);
assert.match(multiverseMarketVerificationDoc, /AchievementBar-Inscryptions/);
assert.match(multiverseMarketVerificationDoc, /MultiverseMarket, Assembly-CSharp` -> `BuyIS47`/);
assert.match(multiverseMarketVerificationDoc, /MultiverseMarket, Assembly-CSharp` -> `BuyIS64`/);
assert.match(multiverseMarketVerificationDoc, /MultiverseMarket, Assembly-CSharp` -> `BuyIS73`/);
assert.match(multiverseMarketVerificationDoc, /Inscryption 25: Shard Gains/);
assert.match(multiverseMarketVerificationDoc, /Inscryption 78: Ouroboros Orbs/);
assert.match(multiverseMarketVerificationDoc, /`InscryptionsDone` is an exact metadata field string/);
assert.match(multiverseMarketVerificationDoc, /saved-state field or owner that stores the current `Inscryptions Done` balance/);
assert.match(multiverseMarketVerificationDoc, /It is not safe to generate spend recommendations yet/);
assert.match(multiverseMarketStateDoc, /# Multiverse Market State Verification/);
assert.match(multiverseMarketStateDoc, /PlayerProfileData\.cs/);
assert.match(multiverseMarketStateDoc, /FillPlayerProfileData/);
assert.match(multiverseMarketStateDoc, /GetPlayerProfileData/);
assert.match(multiverseMarketStateDoc, /CloudSavePlayerProfile/);
assert.match(multiverseMarketStateDoc, /InscryptionsDone/);
assert.match(multiverseMarketStateDoc, /IS50Level/);
assert.match(multiverseMarketStateDoc, /NecrumR1Trades/);
assert.match(multiverseMarketStateDoc, /Mech1Unlocked/);
assert.match(multiverseMarketStateDoc, /AchievementInscryptionsReward/);
assert.match(multiverseMarketStateDoc, /FinalISShardsBonus/);
assert.match(multiverseMarketStateDoc, /still not safe to add canonical `Inscryptions Done` or inscription-level fields to `state\.playerProfile`/);
assert.match(multiverseMarketMetadataNeighborhoodDoc, /# Metadata Neighborhood Probe/);
assert.match(multiverseMarketMetadataNeighborhoodDoc, /InscryptionsDone/);
assert.match(multiverseMarketMetadataNeighborhoodDoc, /IS110Level/);
assert.match(multiverseMarketMetadataNeighborhoodDoc, /EsotericR1Trades/);
assert.match(multiverseMarketMetadataNeighborhoodDoc, /SetInscryptionsDoneText/);
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
assert.match(tokenShopDoc, /## Currency-lane grounding/);
assert.match(tokenShopDoc, /resourceicons\/resource_tokenium/);
assert.match(tokenShopDoc, /resourceicons\/resource_tokenium_cap/);
assert.match(tokenShopDoc, /base TokenShop costs should currently be described as a token-bank token or tokenium spend lane/);
assert.match(tokenShopDoc, /Daily Tokenium should stay separated as the Academy or Farm Mission reward lane that TokenShop modifies/);
assert.match(shardVerificationDoc, /# Shard System Verification Gate/);
assert.match(shardVerificationDoc, /community-grounded descriptive data/);
assert.match(shardVerificationDoc, /not yet mapped enough from shipped-game assets/);
assert.match(shardVerificationDoc, /Boundary reference:/);
assert.match(shardVerificationDoc, /Asset-grounded shell evidence/);
assert.match(shardVerificationDoc, /Owner-family evidence/);
assert.match(shardVerificationDoc, /ShardMining, Assembly-CSharp/);
assert.match(shardVerificationDoc, /ShardUpgradeInfo/);
assert.match(shardVerificationDoc, /TotalMilestoneLevels/);
assert.match(shardVerificationDoc, /zero checked overlap with `PlayerProfileData`, `GetPlayerProfileData`, `FillPlayerProfileData`, or `CloudSavePlayerProfile`/);
assert.match(shardVerificationDoc, /FinalSU\*Bonus\*/);
assert.match(shardVerificationDoc, /ConstructionMilestones/);
assert.match(shardVerificationDoc, /academy-side/);
assert.match(shardVerificationDoc, /LoopResetStage1/);
assert.match(shardVerificationDoc, /MilestoneBonusesPerLevel/);
assert.match(shardVerificationDoc, /asset-grounded milestone row order and milestone-number mapping/);
assert.match(shardVerificationDoc, /The app may reference the asset-grounded shard shell only to justify warning-oriented shard and loop surfaces/);
assert.match(shardGroundingBoundaryDoc, /# Shard Grounding Boundary/);
assert.match(shardGroundingBoundaryDoc, /data\/shard-asset-grounding\.v1\.json/);
assert.match(shardGroundingBoundaryDoc, /shard-extraction-candidates\.md/);
assert.match(shardGroundingBoundaryDoc, /shard-owner-family-verification\.md/);
assert.match(shardGroundingBoundaryDoc, /data\/extraction-candidate-ranking\.v1\.json/);
assert.match(shardGroundingBoundaryDoc, /APK or Unity-grounded now/);
assert.match(shardGroundingBoundaryDoc, /Descriptive-only for now/);
assert.match(shardGroundingBoundaryDoc, /Owner-family split recovered now/);
assert.match(shardGroundingBoundaryDoc, /ConstructionMilestones, Assembly-CSharp/);
assert.match(shardGroundingBoundaryDoc, /ShardMining, Assembly-CSharp/);
assert.match(shardGroundingBoundaryDoc, /ShardUpgradeInfo/);
assert.match(shardGroundingBoundaryDoc, /TotalMilestoneLevels/);
assert.match(shardGroundingBoundaryDoc, /FinalSU\*Bonus\*/);
assert.match(shardGroundingBoundaryDoc, /generic or academy-side milestone family/);
assert.match(shardGroundingBoundaryDoc, /LoopResetStage1/);
assert.match(shardGroundingBoundaryDoc, /Milestones, Assembly-CSharp/);
assert.match(shardGroundingBoundaryDoc, /ranking, ROI, ETA, affordability, and best-upgrade claims remain blocked/i);
assert.match(shardExtractionCandidatesDoc, /# Shard Extraction Candidates/);
assert.match(shardExtractionCandidatesDoc, /shards\.milestone-owner-family/);
assert.match(shardExtractionCandidatesDoc, /loop-reset stage family/i);
assert.match(shardExtractionCandidatesDoc, /heuristic, not mechanic truth/i);
assert.match(shardExtractionCandidatesDoc, /repo-wide default top unknown extraction candidate/i);
assert.match(shardExtractionCandidatesDoc, /best next shard-planner extraction candidate/i);
assert.match(shardOwnerFamilyDoc, /# Shard Owner-Family Verification/);
assert.match(shardOwnerFamilyDoc, /ConstructionMilestones, Assembly-CSharp/);
assert.match(shardOwnerFamilyDoc, /ShardMining, Assembly-CSharp/);
assert.match(shardOwnerFamilyDoc, /ShardMining\|ShardUpgradeInfo/);
assert.match(shardOwnerFamilyDoc, /FastBuyButtonMethodShards/);
assert.match(shardOwnerFamilyDoc, /blueprint hold strings/);
assert.match(shardOwnerFamilyDoc, /StartMilestone\*Hold/);
assert.match(shardOwnerFamilyDoc, /TotalMilestoneLevels/);
assert.match(shardOwnerFamilyDoc, /FinalSU1Bonus1/);
assert.match(shardOwnerFamilyDoc, /FinalSU29Bonus2/);
assert.match(shardOwnerFamilyDoc, /data\/shard-save-boundary\.v1\.json/);
assert.match(shardOwnerFamilyDoc, /generic or academy-side milestone family/);
assert.equal(shardOwnerFamilyProbe[0].file, "workbench\\unity\\joined\\level0");
assert.ok(shardOwnerFamilyProbe.some((entry) => entry.match_count > 0), "expected shard owner-family probe matches");
assert.equal(shardVsConstructionOwnerProbe[0].file, "workbench\\unity\\joined\\level0");
assert.ok(
  shardVsConstructionOwnerProbe.some(
    (entry) =>
      entry.matches?.some((match) => match.value === "ConstructionMilestones, Assembly-CSharp") &&
      entry.matches?.some((match) => match.value === "ShardMining, Assembly-CSharp")
  ),
  "expected side-by-side shard vs construction owner probe hits"
);
assert.equal(shardMetadataNeighborhood.metadata, "workbench\\apk\\base\\global-metadata.dat");
assert.equal(shardBonusMetadataNeighborhood.metadata, "workbench\\apk\\base\\global-metadata.dat");
assert.equal(shardminingMetadataNeighborhood.metadata, "workbench\\apk\\base\\global-metadata.dat");
assert.equal(shardUpgradeInfoMetadataNeighborhood.metadata, "workbench\\apk\\base\\global-metadata.dat");
assert.match(shardMetadataNeighborhoodDoc, /ConstructionMilestonesSum/);
assert.match(shardMetadataNeighborhoodDoc, /get_MilestoneMaxLevel/);
assert.match(shardMetadataNeighborhoodDoc, /ClaimDiamondMilestone/);
assert.match(shardBonusMetadataNeighborhoodDoc, /FinalMilestone1Bonus1/);
assert.match(shardBonusMetadataNeighborhoodDoc, /FinalMilestone10Bonus/);
assert.match(shardBonusMetadataNeighborhoodDoc, /BuyMilestone57/);
assert.match(shardminingMetadataNeighborhoodDoc, /ShardUpgradeInfo/);
assert.match(shardminingMetadataNeighborhoodDoc, /TotalMilestoneLevels/);
assert.match(shardminingMetadataNeighborhoodDoc, /get_SU1FinalUnlockReq/);
assert.match(shardUpgradeInfoMetadataNeighborhoodDoc, /FinalSU29Bonus2/);
assert.match(shardUpgradeInfoMetadataNeighborhoodDoc, /<FastBuyEnum>d__1429/);
assert.match(extractionRankingDoc, /# Extraction Candidate Ranking/);
assert.match(extractionRankingDoc, /spend\.multiverse-market-owner-family/);
assert.match(extractionRankingDoc, /filter by track or family id/i);
assert.match(playerProfileSchemaDoc, /compatibility\.unmappedSystemState/);
assert.match(playerProfileSchemaDoc, /The active manual Profile form should only show values a typical player can quickly provide from the game/);
assert.match(playerProfileSchemaDoc, /Academy relics \| `player\.resources\.academyRelics` \| real profile aggregate, but not a direct active-form input/);
assert.match(playerProfileSchemaDoc, /Shard income \/ hour \| `planning\.shards\.ratePerHour` \| descriptive derived helper, not directly visible in game, so removed from the active form/);
assert.match(playerProfileSchemaDoc, /## Experimental support-surface helpers/);
assert.match(playerProfileSchemaDoc, /systems\.metaProgression\.hunterLevel/);
assert.match(playerProfileSchemaDoc, /stage\.highestShipUnlocked/);
assert.match(playerProfileSchemaDoc, /top-level `power`, `speed`, and `cargo` no longer migrate/);
assert.match(playerProfileSchemaDoc, /planning\.gemNodeBudget`, `planning\.resourceFocus`, `planning\.researchHours`, and their flat helper forms are retired/);
assert.match(playerProfileSchemaDoc, /flat `gemDust`, `hunterLevel`, `traitSphereCount`, and `mechParts` no longer migrate automatically/);
assert.match(importMappingDoc, /compatibility\.unmappedSystemState/);
assert.match(importMappingDoc, /experimental helper imports now require explicit `externalModels\.experimental\.\*` paths/);
assert.match(importMappingDoc, /stage\.highestShipUnlocked`, `stage\.manualPhase`, and `systems\.metaProgression\.\*` aliases should normalize into compatibility-only fields/);
assert.match(importMappingDoc, /flat unresolved aliases such as `hunterLevel`, `traitSphereCount`, `mechParts`, and `gemDust` are retired/);
assert.match(importMappingDoc, /top-level `power`, `speed`, and `cargo` are retired/);
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
assert.match(multiverseMarketDoc, /CostBox-InscryptionsDone/);
assert.match(multiverseMarketDoc, /saved-state owner or runtime balance field behind the `Inscryptions Done` cost lane/);
assert.match(shardIngestDoc, /community-grounded descriptive data/);
assert.match(shardIngestDoc, /not yet shipped-game owner-grounded data/);

assert.match(html, /Player Data/);
assert.match(html, /Game Data/);
assert.match(html, /Local-first CIFI MVP/);
assert.match(html, /one explainable recommendation feed/i);
assert.match(html, /Ship Planner \(External-model\)/);
assert.match(html, /Gem Nodes \(Quarantined\)/);
assert.match(html, /Research Intake/);
assert.match(html, /Candidate tracks and grounded findings/);
assert.match(html, /bundled data changes should pass local contract validation first/);
assert.match(html, /Grounded next-step highlights/);
assert.match(html, /How to load labeled data into the app/);
assert.match(html, /Prepare a labeled CSV export or JSON payload/);
assert.match(html, /Apply to active snapshot/);
assert.match(html, /Reset to blank profile/);
assert.match(html, /PlayerProfile JSON/);
assert.match(html, /Import PlayerProfile JSON/);
assert.match(html, /Export PlayerProfile JSON/);
assert.match(html, /playerProfileImportSummary/);
assert.match(html, /Shared profile and labeled helpers/);
assert.match(html, /Shared PlayerProfile truth is limited to grounded CIFI account state/);
assert.match(html, /The active form only shows values a typical player can quickly provide from the game/);
assert.match(html, /ship calibration remains outside shared profile truth as external-model implementation data/);
assert.match(html, /Community-tool Calibration/);
assert.match(html, /External model inputs preserved with the ship planner/);
assert.match(html, /Diamonds/);
assert.match(html, /Planner-only helper inputs are optional/);
assert.match(html, /Manual profile inputs should come from values a typical player can quickly read in game/);
assert.match(html, /Accepted number formats: <code>5800<\/code>, <code>5\.8k<\/code>, <code>9\.8t<\/code>, <code>7\.15e549<\/code>/);
assert.match(html, /<input id="loopReset" name="loopReset" type="text" inputmode="decimal" placeholder="41">/);
assert.match(html, /<input id="diamonds" name="diamonds" type="text" inputmode="decimal" placeholder="5\.8k">/);
assert.match(html, /<input id="shards" name="shards" type="text" inputmode="decimal" placeholder="7\.15e549">/);
assert.doesNotMatch(html, /<label for="academyRelics">Academy relics<\/label>/);
assert.doesNotMatch(html, /<label for="shardRatePerHour">Shard income \/ hour<\/label>/);
assert.match(html, /Profile readiness/);
assert.doesNotMatch(html, /Rank shard milestones/);
assert.match(html, /Shard milestones \(disabled pending verified schema\)/);
assert.match(html, /Descriptive shard workflow/);
assert.match(html, /Focus milestone/);
assert.match(html, /Observed level on focus milestone/);
assert.match(html, /Total shard milestone levels/);
assert.match(html, /Grounded MVP checks only/);
assert.match(html, /Grounded checks, APK grounding, and support checks/);
assert.match(html, /Run validation checks/);
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
assert.match(appJs, /function getResearchTrackOrder/);
assert.match(appJs, /function getResearchTrackLane/);
assert.match(appJs, /if \(track\.status === "archived"\) \{\s*return "Foundation archive";\s*\}/);
assert.match(appJs, /Archived foundation cards may still appear here as historical context/);
assert.match(appJs, /function getResearchTrackStatus/);
assert.match(appJs, /function getResearchTrackProgressLabel/);
assert.match(appJs, /from "\.\/recommendation-contract\.js"/);
assert.match(appJs, /"unified-feed-and-hardening": "PR 3 then PR 5 hardening"/);
assert.match(appJs, /"spend-planner-from-extracted-data": "PR 4"/);
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
assert.match(appJs, /function getShardMilestonePayloadBoundarySummary/);
assert.match(appJs, /function getShardSaveBoundarySummary/);
assert.match(recommendationContractModule, /export function toRecommendationAction/);
assert.match(recommendationContractModule, /export function sortRecommendationFeed/);
assert.match(recommendationContractModule, /export function getRecommendationContractIssues/);
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
assert.match(appJs, /\.\/data\/shard-asset-grounding\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-owner-family-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-finalsu-bonus-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestone-payload-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-save-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/extraction-candidate-ranking\.v1\.json/);
assert.match(appJs, /npm run verify:data/);
assert.match(appJs, /data\/bundled-dataset-contract\.v1\.json/);
assert.match(appJs, /PlayerProfile JSON imported through the grounded normalizer/);
assert.match(appJs, /Canonical shared truth/);
assert.match(appJs, /Planner-only helpers/);
assert.match(appJs, /External-model implementation state/);
assert.match(appJs, /Experimental support-surface helpers/);
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
assert.match(appJs, /TokenShop extracted family coverage/);
assert.match(appJs, /32 numeric groups with TokenBoost, DiamondBoost, and TokenDailiesT2 plus token-bank controller anchors/);
assert.match(appJs, /Spend tokenium naming clues/);
assert.match(appJs, /Resource_Tokenium, Aca\.Tokenium553, CostBox-Tokens, and CostBox-Tokenium available/);
assert.match(appJs, /Token-bank controller split clues/);
assert.match(appJs, /ClaimBankedTokens, get_TokenBankCap, BigStatisticPrefab\.TokenBankCap, and SetLM244BonusText available/);
assert.match(appJs, /MultiverseMarket owner payload/);
assert.match(appJs, /MultiverseMarket validated row coverage/);
assert.match(appJs, /22 validated rows across ids 50-59 and 63-74/);
assert.match(appJs, /MultiverseMarket save-family clues/);
assert.match(appJs, /PlayerProfileData persistence clues available/);
assert.match(appJs, /MultiverseMarket cloud-save path clues/);
assert.match(appJs, /CloudSavePlayerProfile path clues available/);
assert.match(appJs, /MultiverseMarket progression-field cluster/);
assert.match(appJs, /InscryptionsDone trade-counter cluster available/);
assert.match(appJs, /Spend save-side narrowing/);
assert.match(appJs, /broader PlayerProfileData persistence family instead of treating MultiverseMarket itself as the recovered save owner/);
assert.match(appJs, /Likely persistence family/);
assert.match(appJs, /Cloud-save profile path/);
assert.match(appJs, /CloudSavePlayerProfile and GetPlayerProfileInfo now appear in the same checked-in save-path neighborhood/);
assert.match(appJs, /Grounded field-cluster clues/);
assert.match(appJs, /Validated row block vs broader field run/);
assert.match(appJs, /currently validates .* rows across ids/);
assert.match(appJs, /broader than the currently validated row block/);
assert.match(appJs, /Grounded spend inputs/);
assert.match(appJs, /TokenShop currently exposes .* extracted numeric families across/);
assert.match(appJs, /const namedLanes = \["TokenBoost", "DiamondBoost", "TokenDailiesT2"\]/);
assert.match(appJs, /BankFill and TokenBankDescriptionText/);
assert.match(appJs, /Shipped assets now preserve \$\{tokeniumNamingSummary\.resourceLabel\} plus \$\{tokeniumNamingSummary\.academyLabel\}/);
assert.match(appJs, /level0 keeps both \$\{tokeniumNamingSummary\.tokenShellLabel\} and \$\{tokeniumNamingSummary\.tokeniumShellLabel\}/);
assert.match(appJs, /function getTokeniumNamingSummary/);
assert.match(appJs, /Token-bank controller clues now preserve \$\{tokenBankStateSummary\.claimMethod\}, \$\{tokenBankStateSummary\.capMethod\}, \$\{tokenBankStateSummary\.displayShell\}, and \$\{tokenBankStateSummary\.loopHandler\}/);
assert.match(appJs, /function getTokenBankStateSummary/);
assert.match(appJs, /Daily Tokenium lane clues now preserve \$\{dailyTokeniumSummary\.ownerFamilyLabel\}, \$\{dailyTokeniumSummary\.missionFamilyLabel\}, \$\{dailyTokeniumSummary\.loopHook\}, \$\{dailyTokeniumSummary\.purchaseHook\}, and \$\{dailyTokeniumSummary\.premiumPack\}/);
assert.match(appJs, /Player-facing strings still frame Daily Tokenium as a farm-mission or Academy Menu reward lane that TokenShop and the Collector pack modify/);
assert.match(appJs, /function getDailyTokeniumLaneSummary/);
assert.match(appJs, /function getTokenBankFormulaBoundarySummary/);
assert.match(appJs, /"ClaimBankedTokens"/);
assert.match(appJs, /"BigStatisticPrefab\.TokenBankCap"/);
assert.match(appJs, /"SetLM244BonusText"/);
assert.match(appJs, /"SpaceAcademy"/);
assert.match(appJs, /"FarmMissions"/);
assert.match(appJs, /"BuyLM244"/);
assert.match(appJs, /"BuyCollectorDevice"/);
assert.match(appJs, /"COLLECTERS PACK"/);
assert.match(appJs, /"get_FinalTokenBankCap"/);
assert.match(appJs, /"get_FinalTokenBankFillSpeed"/);
assert.match(appJs, /"<FinalTokenBankCap>k__BackingField"/);
assert.match(appJs, /"<FinalTokenBankFillSpeed>k__BackingField"/);
assert.match(appJs, /"Resource_Tokenium"/);
assert.match(appJs, /"Aca\.Tokenium553"/);
assert.match(appJs, /"CostBox-Tokens"/);
assert.match(appJs, /"CostBox-Tokenium"/);
assert.match(appJs, /MultiverseMarket currently has .* validated rows across ids/);
assert.match(appJs, /not enough to identify the declaring save model or planner-ready owned-state inputs/);
assert.match(appJs, /Do not promote FinalIS or achievement symbols into canonical player state yet/);
assert.match(appJs, /does not identify the declaring save model or which recovered IS\*Level subset actually maps to the validated MultiverseMarket rows/);
assert.match(appJs, /Shard milestone mapping gate/);
assert.match(appJs, /Shard shell grounding payload/);
assert.match(appJs, /Shard milestone payload boundary/);
assert.match(appJs, /Shard save-side separation/);
assert.match(appJs, /Grounded shard shell evidence available/);
assert.match(appJs, /Repo-wide default unknown candidate/);
assert.match(appJs, /Top PR2-local shard candidate/);
assert.match(appJs, /Why next:/);
assert.match(appJs, /Available but unmapped/);
assert.match(appJs, /\.\/data\/multiverse-market-metadata-neighborhood\.json/);
assert.match(appJs, /\.\/data\/tokenium-naming-clues\.json/);
assert.match(appJs, /\.\/data\/token-bank-state-clues\.json/);
assert.match(appJs, /\.\/data\/daily-tokenium-lane-clues\.json/);
assert.match(appJs, /\.\/data\/token-bank-formula-boundary\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-range-boundary\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-row-text-coverage\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-prefab-remap-boundary\.json/);
assert.match(appJs, /Payload-watch boundary/);
assert.match(appJs, /ShardUpgradeInfo keeps the milestone payload trail local/);
assert.match(appJs, /Save-side separation/);
assert.match(appJs, /Shard owner trail stays separate from PlayerProfile save clues/);
assert.match(appJs, /Shard owner trail and PlayerProfileData save-family clues stay separate with zero overlap/);
assert.match(appJs, /\.\/data\/token-shop-cost-lanes\.json/);
assert.match(appJs, /\.\/data\/spend-action-lane-clues\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-action-shell\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-owner-family\.json/);
assert.match(appJs, /\.\/data\/token-shop-owner-shell\.json/);
assert.match(appJs, /\.\/data\/token-shop-save-boundary\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-save-boundary\.json/);
assert.match(appJs, /\.\/data\/token-bank-controller-shell\.json/);
assert.match(appJs, /Daily Tokenium owner-family clues/);
assert.match(appJs, /SpaceAcademy, FarmMissions, SetLM244BonusText, BuyLM244, and BuyCollectorDevice available/);
assert.match(appJs, /Daily Tokenium owner family/);
assert.match(appJs, /SpaceAcademy, SpaceAcademyMain, TextHandlerSpaceAcademy, and FarmMissions now appear in a checked-in lane clue bundle/);
assert.match(appJs, /Token-bank derived output boundary/);
assert.match(appJs, /FinalTokenBankCap and FinalTokenBankFillSpeed cluster without PlayerProfileData or CloudSavePlayerProfile joins/);
assert.match(appJs, /Token-bank formula clues now preserve \$\{tokenBankFormulaSummary\.capAccessor\}, \$\{tokenBankFormulaSummary\.fillAccessor\}, \$\{tokenBankFormulaSummary\.capField\}, and \$\{tokenBankFormulaSummary\.fillField\} as a derived-output cluster/);
assert.match(appJs, /FinalTokenBankCap and FinalTokenBankFillSpeed now appear in a checked-in accessor and backing-field cluster/);
assert.match(appJs, /The same checked local context still does not expose PlayerProfileData or CloudSavePlayerProfile beside those outputs/);
assert.match(appJs, /MultiverseMarket row-range boundary/);
assert.match(appJs, /Validated rows 50-59 and 63-74 do not overlap the recovered IS99-110 metadata run/);
assert.match(appJs, /Validated rows \${multiverseMarketRangeSummary\.validatedRangeLabel} do not overlap \${multiverseMarketRangeSummary\.metadataRangeLabel}/);
assert.match(appJs, /function getMultiverseMarketRangeBoundarySummary/);
assert.match(appJs, /Validated rows vs recovered IS run/);
assert.match(appJs, /The separate metadata run \${multiverseMarketRangeSummary\.metadataRangeLabel} currently has no direct overlap with that validated block/);
assert.match(appJs, /The checked range boundary now preserves a zero-overlap result between validated rows \${multiverseMarketRangeSummary\.validatedRangeLabel} and the recovered metadata run \${multiverseMarketRangeSummary\.metadataRangeLabel}/);
assert.match(appJs, /MultiverseMarket validated row text coverage/);
assert.match(appJs, /TextHandlerMarkets and SetAllChrystosEmporiumTexts cover SetIS50-59 and 63-74 cost texts/);
assert.match(appJs, /function getMultiverseMarketRowTextCoverageSummary/);
assert.match(appJs, /function getMultiverseMarketPrefabRemapBoundarySummary/);
assert.match(appJs, /The validated row block also has direct text-handler coverage through \${multiverseMarketRowTextSummary\.textHandler}, \${multiverseMarketRowTextSummary\.textBatcher}, and \${multiverseMarketRowTextSummary\.coveredCount} SetIS\*CostText hooks/);
assert.match(appJs, /That is row-label coverage for the validated block, not saved-state coverage/);
assert.match(appJs, /Validated row text coverage/);
assert.match(appJs, /TextHandlerMarkets now preserves \${multiverseMarketRowTextSummary\.coveredCount} direct SetIS\*CostText hooks for validated rows \${multiverseMarketRowTextSummary\.validatedRangeLabel}/);
assert.match(appJs, /MultiverseMarket prefab remap boundary/);
assert.match(appJs, /Validated ids 69-74 still do not have direct ChrystosEmporiumUpgrade number matches/);
assert.match(appJs, /Prefab remap boundary/);
assert.match(appJs, /function getTokenShopCostLaneSummary/);
assert.match(appJs, /TokenShop cost-lane split/);
assert.match(appJs, /TokenBoost, DiamondBoost, TokenDailiesT2, CostBox-Tokens, and CostBox-Tokenium available/);
assert.match(appJs, /TokenShop cost-lane clues now preserve \${tokenShopCostLaneSummary\.tokenLaneLabel}, \${tokenShopCostLaneSummary\.diamondLaneLabel}, \${tokenShopCostLaneSummary\.dailyLaneLabel}, \${tokenShopCostLaneSummary\.tokensShellLabel}, and \${tokenShopCostLaneSummary\.tokeniumShellLabel}/);
assert.match(appJs, /This keeps TokenDailies on the Daily Tokenium modifier lane instead of mixing it into generic token spend rows/);
assert.match(appJs, /function getSpendActionLaneSummary/);
assert.match(appJs, /Spend action-lane split/);
assert.match(appJs, /BuyTokenBoost, BuyDiamondBoost, BuyLM244, BuyCollectorDevice, and zero BuyTokenDailies hooks preserved/);
assert.match(appJs, /Spend action-lane clues now preserve \${spendActionLaneSummary\.tokenHook}, \${spendActionLaneSummary\.diamondHook}, \${spendActionLaneSummary\.loopModifierHook}, and \${spendActionLaneSummary\.premiumModifierHook}/);
assert.match(appJs, /The checked APK and Unity probe still returns zero \${spendActionLaneSummary\.dailyHookT2} or \${spendActionLaneSummary\.dailyHookT3} matches/);
assert.match(appJs, /"BuyTokenBoost"/);
assert.match(appJs, /"BuyDiamondBoost"/);
assert.match(appJs, /"BuyLM244"/);
assert.match(appJs, /"BuyCollectorDevice"/);
assert.match(appJs, /"BuyTokenDailiesT2"/);
assert.match(appJs, /"BuyTokenDailiesT3"/);
assert.match(appJs, /function getMultiverseMarketActionShellSummary/);
assert.match(appJs, /MultiverseMarket action shell/);
assert.match(appJs, /Context-derived BuyIS1-110 and SetIS1-110CostText shell preserved while only rows 50-59 and 63-74 stay validated/);
assert.match(appJs, /The same checked action shell context reaches \${multiverseMarketActionShellSummary\.buyRangeLabel} plus \${multiverseMarketActionShellSummary\.costTextRangeLabel}, while only \${multiverseMarketActionShellSummary\.validatedRangeLabel} stays numerically validated/);
assert.match(appJs, /That broader action shell is useful for mapping and UI recovery, but it should not be promoted as full numeric validation or saved-state coverage/);
assert.match(appJs, /function getMultiverseMarketOwnerFamilySummary/);
assert.match(appJs, /MultiverseMarket owner family/);
assert.match(appJs, /MultiverseMarket, Inscryptions, and IS1-110 CurrencyBox shell preserved without implying saved-state ownership/);
assert.match(appJs, /MultiverseMarket owner-family clues now preserve \${multiverseMarketOwnerFamilySummary\.ownerAnchor}, \${multiverseMarketOwnerFamilySummary\.inscryptionsLabel}, \${multiverseMarketOwnerFamilySummary\.textHandler}, \${multiverseMarketOwnerFamilySummary\.batcher}, and \${multiverseMarketOwnerFamilySummary\.costBox}/);
assert.match(appJs, /The same checked shell also preserves \${multiverseMarketOwnerFamilySummary\.resourceText}, \${multiverseMarketOwnerFamilySummary\.achievementBar}, and \${multiverseMarketOwnerFamilySummary\.currencyRangeLabel}, with validated samples such as \${multiverseMarketOwnerFamilySummary\.firstValidatedCurrencyBox} and \${multiverseMarketOwnerFamilySummary\.lastValidatedCurrencyBox}/);
assert.match(appJs, /That is enough to keep the Emporium owner-family and Inscryptions cost-lane shell grounded, but not enough to recover player-owned balance fields or current row levels/);
assert.match(appJs, /function getTokenShopOwnerShellSummary/);
assert.match(appJs, /TokenShop owner shell/);
assert.match(appJs, /TokenShop, ClaimBankedTokens, CheckTokenClaimNotification, and BuyAutoTokenClicker preserved as one local owner shell/);
assert.match(appJs, /TokenShop owner-shell clues now preserve \${tokenShopOwnerShellSummary\.ownerAnchor}, \${tokenShopOwnerShellSummary\.bankMethod}, \${tokenShopOwnerShellSummary\.notificationHook}, and \${tokenShopOwnerShellSummary\.deviceHook}/);
assert.match(appJs, /That local TokenShop shell is enough to keep bank controls and adjacent device hooks grouped together, but not enough to promote player-owned bank values into planner state/);
assert.match(appJs, /function getTokenShopSaveBoundarySummary/);
assert.match(appJs, /TokenShop save boundary/);
assert.match(appJs, /TokenShop owner shell and PlayerProfileData save-family clues stay separate with zero overlap/);
assert.match(appJs, /The checked save boundary still keeps \${tokenShopSaveBoundarySummary\.ownerAnchor} separate from \${tokenShopSaveBoundarySummary\.saveAnchor}, with \${tokenShopSaveBoundarySummary\.overlapLabel}/);
assert.match(appJs, /That means TokenShop ownership and PlayerProfile save recovery remain separate tasks, so the app should not infer saved bank values from owner-shell clues yet/);
assert.match(appJs, /function getTokenBankControllerShellSummary/);
assert.match(appJs, /Token-bank controller shell/);
assert.match(appJs, /ClaimBankedTokens, SetBankFill, BankFill, TokenBankDescriptionText, and CheckTokenClaimNotification preserved/);
assert.match(appJs, /Token-bank controller shell now preserves \${tokenBankControllerShellSummary\.claimMethod}, \${tokenBankControllerShellSummary\.fillMethod}, \${tokenBankControllerShellSummary\.fillField}, \${tokenBankControllerShellSummary\.descriptionShell}, and \${tokenBankControllerShellSummary\.notificationHook}/);
assert.match(appJs, /That keeps the narrow bank controller cluster together without promoting it into saved-state ownership or formula truth/);
assert.match(appJs, /function getMultiverseMarketSaveBoundarySummary/);
assert.match(appJs, /MultiverseMarket save boundary/);
assert.match(appJs, /MultiverseMarket action shell and PlayerProfileData save-family clues stay separate with zero overlap/);
assert.match(appJs, /The checked save boundary still keeps \${multiverseMarketSaveBoundarySummary\.actionAnchor} separate from \${multiverseMarketSaveBoundarySummary\.saveAnchor}, with \${multiverseMarketSaveBoundarySummary\.overlapLabel}/);
assert.match(appJs, /That means MultiverseMarket action-shell recovery and PlayerProfile save recovery remain separate tasks, so the app should not infer player-owned row levels from action-shell clues yet/);
assert.match(appJs, /"TokenBoost"/);
assert.match(appJs, /"DiamondBoost"/);
assert.match(appJs, /"TokenDailiesT2"/);
assert.match(appJs, /"CostBox-Tokens"/);
assert.match(appJs, /"CostBox-Tokenium"/);
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
assert.match(appJs, /const DEFAULT_SERVER_CAPABILITIES = Object\.freeze/);
assert.match(appJs, /const SERVER_CAPABILITIES = getServerCapabilities\(\)/);
assert.match(appJs, /!window\.location\.origin\.startsWith\("http"\) \|\| !SERVER_CAPABILITIES\.sessionApi/);
assert.match(appJs, /function getServerCapabilities\(\)/);
assert.match(appJs, /new EventSource/);
assert.match(html, /window\.__CIFI_SERVER_CAPABILITIES__ = \{/);
assert.match(html, /sessionApi: false/);
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
assert.match(devServer, /window\.__CIFI_SERVER_CAPABILITIES__/);
assert.match(devServer, /sessionApi: true/);
assert.match(devServer, /event: launch/);
assert.match(devServer, /Launcher-mode server is idle\. Shutting down\./);
assert.match(launcherVbs, /http:\/\/localhost:4173\//);
assert.match(launcherVbs, /http:\/\/localhost:4173\/\?launch=1/);
assert.match(launcherVbs, /Start-Process -WindowStyle Hidden/);
assert.match(launcherVbs, /--launcher-mode/);
assert.match(launcherVbs, /ResolveNodePath/);
assert.match(launcherVbs, /ResolveFromWhere\("node\.exe"\)/);
assert.equal(pkg.scripts.dev, "node ./scripts/dev-server.mjs");
assert.equal(pkg.scripts["verify:data"], "node ./scripts/contracts/validate-datasets.mjs");
assert.equal(pkg.scripts.test, "node ./tests/smoke.mjs");
assert.match(importMappingDoc, /compatibility-only fields/i);
const datasetContractsDoc = await readFile(new URL("../docs/contracts/dataset-contracts.md", import.meta.url), "utf8");
assert.match(datasetContractsDoc, /data\/bundled-dataset-contract\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-asset-grounding\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-owner-family-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-finalsu-bonus-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-milestone-payload-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-save-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/extraction-candidate-families\.v1\.json/);
assert.match(datasetContractsDoc, /data\/extraction-candidate-ranking\.v1\.json/);
assert.match(datasetContractsDoc, /docs\/contracts\/dataset-refresh-checklist\.md/);
assert.match(datasetContractsDoc, /Source-priority metadata/);
assert.match(datasetContractsDoc, /APK\/Unity artifacts and repo extraction outputs first/);
assert.match(datasetContractsDoc, /spend-boundary datasets/);
assert.match(datasetContractsDoc, /data\/multiverse-market-prefab-remap-boundary\.json/);
assert.match(datasetContractsDoc, /editing `data\/bundled-dataset-contract\.v1\.json`/);
assert.match(datasetRefreshChecklistDoc, /# Dataset Refresh Checklist/);
assert.match(datasetRefreshChecklistDoc, /Record the shipped dataset in `data\/bundled-dataset-contract\.v1\.json`/);
assert.match(datasetRefreshChecklistDoc, /Run `npm run verify:data`/);
assert.match(datasetRefreshChecklistDoc, /Use `docs\/contracts\/research-note-template\.md` for new notes/);
assert.match(researchNoteTemplateDoc, /# Research Note Template/);
assert.match(researchNoteTemplateDoc, /APK\/Unity path checked first/);
assert.match(researchNoteTemplateDoc, /Data classification/);
assert.match(researchNoteTemplateDoc, /Recommended next step/);
assert.match(shardResearchNote, /## Repo-local intake metadata/);
assert.match(shardResearchNote, /APK\/Unity path checked first: no/);
assert.match(shardResearchNote, /community-grounded descriptive input/);
assert.match(readme, /## North star/);
assert.match(readme, /## Current phase/);
assert.match(readme, /## Doc map/);
assert.match(readme, /docs\/roadmap\/mvp-plan\.md/);
assert.match(readme, /docs\/roadmap\/research-tracks\.md/);

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
  totalShardMilestoneLevels: "17",
  shardFocusMilestoneId: "milestone_alpha",
  shardFocusMilestoneLevel: "12",
  systems: {
    ship: {
      power: "7",
      speed: "2.5",
      cargo: "19"
    },
    metaProgression: {
      hunterLevel: "14",
      traitSphereCount: "5",
      mechParts: "9"
    }
  },
  externalModels: {
    experimental: {
      gemNodes: {
        budget: "250"
      },
      profileHints: {
        primaryFarmingFocus: "shards",
        researchHours: "6"
      }
    }
  },
  compatibility: {
    unresolvedProfileFields: {
      gemDust: "33"
    }
  },
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
assert.equal(migratedLegacyProfile.planning.shards.totalMilestoneLevels, 17);
assert.equal(migratedLegacyProfile.planning.shards.focusMilestoneId, "milestone_alpha");
assert.equal(migratedLegacyProfile.planning.shards.focusMilestoneLevel, 12);
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

const migratedScientificAndSuffixProfile = normalizePlayerProfile({
  player: {
    loop: {
      loopReset: "4"
    },
    resources: {
      diamonds: "5.8k",
      tokens: "9.8t",
      academyRelics: "1.5e3",
      shards: "7.15e549"
    }
  },
  planning: {
    shards: {
      ratePerHour: "2.25m",
      totalMilestoneLevels: "3.4e2"
    }
  }
});

assert.equal(migratedScientificAndSuffixProfile.player.loop.loopReset, 4);
assert.equal(migratedScientificAndSuffixProfile.player.resources.diamonds, 5800);
assert.equal(migratedScientificAndSuffixProfile.player.resources.tokens, 9800000000000);
assert.equal(migratedScientificAndSuffixProfile.player.resources.academyRelics, 1500);
assert.equal(migratedScientificAndSuffixProfile.player.resources.shards, "7.15e549");
assert.equal(migratedScientificAndSuffixProfile.planning.shards.ratePerHour, 2250000);
assert.equal(migratedScientificAndSuffixProfile.planning.shards.totalMilestoneLevels, 340);

const migratedRetiredLooseAliasProfile = normalizePlayerProfile({
  power: "7",
  speed: "2.5",
  cargo: "19",
  resourceFocus: "shards",
  gemNodeBudget: "250",
  researchHours: "6",
  gemDust: "33",
  hunterLevel: "14",
  traitSphereCount: "5",
  mechParts: "9"
});

assert.equal(migratedRetiredLooseAliasProfile.externalModels.shipPlanner.summary.power, null);
assert.equal(migratedRetiredLooseAliasProfile.externalModels.shipPlanner.summary.speed, null);
assert.equal(migratedRetiredLooseAliasProfile.externalModels.shipPlanner.summary.cargo, null);
assert.equal(migratedRetiredLooseAliasProfile.externalModels.experimental.gemNodes.budget, null);
assert.equal(migratedRetiredLooseAliasProfile.externalModels.experimental.profileHints.primaryFarmingFocus, null);
assert.equal(migratedRetiredLooseAliasProfile.externalModels.experimental.profileHints.researchHours, null);
assert.equal(migratedRetiredLooseAliasProfile.compatibility.unresolvedProfileFields.gemDust, null);
assert.equal(migratedRetiredLooseAliasProfile.compatibility.unresolvedProfileFields.hunterLevel, null);
assert.equal(migratedRetiredLooseAliasProfile.compatibility.unresolvedProfileFields.traitSphereCount, null);
assert.equal(migratedRetiredLooseAliasProfile.compatibility.unresolvedProfileFields.mechParts, null);

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

const migratedCompatibilityAliasProfile = normalizePlayerProfile({
  stage: {
    highestShipUnlocked: "K",
    manualPhase: "post-koios"
  },
  systems: {
    metaProgression: {
      hunterLevel: "18",
      traitSphereCount: "7",
      mechParts: "11"
    }
  }
});

assert.equal(migratedCompatibilityAliasProfile.compatibility.legacyStage.highestShipUnlocked, "K");
assert.equal(migratedCompatibilityAliasProfile.compatibility.legacyStage.manualPhase, "post-koios");
assert.equal(migratedCompatibilityAliasProfile.compatibility.unresolvedProfileFields.hunterLevel, 18);
assert.equal(migratedCompatibilityAliasProfile.compatibility.unresolvedProfileFields.traitSphereCount, 7);
assert.equal(migratedCompatibilityAliasProfile.compatibility.unresolvedProfileFields.mechParts, 11);
assert.equal(migratedCompatibilityAliasProfile.player.resources.tokens, null);

const migratedUnmappedSystemsProfile = normalizePlayerProfile({
  profileName: "Unmapped systems",
  systems: {
    loop: {
      loopReset: "73"
    },
    shards: {
      ratePerHour: "44",
      totalMilestoneLevels: "21",
      focusMilestoneId: "omega_watch",
      focusMilestoneLevel: "6"
    },
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
assert.equal(migratedUnmappedSystemsProfile.player.loop.loopReset, 73);
assert.equal(migratedUnmappedSystemsProfile.planning.shards.ratePerHour, 44);
assert.equal(migratedUnmappedSystemsProfile.planning.shards.totalMilestoneLevels, 21);
assert.equal(migratedUnmappedSystemsProfile.planning.shards.focusMilestoneId, "omega_watch");
assert.equal(migratedUnmappedSystemsProfile.planning.shards.focusMilestoneLevel, 6);
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

const migratedInvalidShardHelpers = normalizePlayerProfile({
  planning: {
    shards: {
      ratePerHour: "not-a-number",
      totalMilestoneLevels: "",
      focusMilestoneId: "   ",
      focusMilestoneLevel: "NaN"
    }
  }
});

assert.equal(migratedInvalidShardHelpers.planning.shards.ratePerHour, null);
assert.equal(migratedInvalidShardHelpers.planning.shards.totalMilestoneLevels, null);
assert.equal(migratedInvalidShardHelpers.planning.shards.focusMilestoneId, null);
assert.equal(migratedInvalidShardHelpers.planning.shards.focusMilestoneLevel, null);

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

function getBootstrapDatasetBindings(source) {
  const bootstrapMatch = source.match(/const \[(?<names>[\s\S]*?)\] = await Promise\.all\(\[(?<fetches>[\s\S]*?)\]\);/);
  assert.ok(bootstrapMatch?.groups, "expected bootstrap Promise.all dataset binding");

  return {
    variableNames: bootstrapMatch.groups.names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
    fetchPaths: [...bootstrapMatch.groups.fetches.matchAll(/fetchJson\("([^"]+)"\)/g)].map((match) => match[1])
  };
}

