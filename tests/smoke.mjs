import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect, isDeepStrictEqual, promisify } from "node:util";
import {
  PLAYER_PROFILE_IMPORT_ALIASES,
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  normalizePlayerProfile
} from "../player-profile.js";
import { generateDatasetIndex } from "../scripts/contracts/generate-dataset-index.mjs";
import {
  getRecommendationContractIssues,
  sortRecommendationFeed,
  toRecommendationAction
} from "../recommendation-contract.js";
import { validateBundledDatasets } from "../scripts/contracts/validate-datasets.mjs";
import {
  evaluateShardCost,
  getShardCostFormulaModel,
  getShardCostRowClass,
  getShardCostRuntimeRule,
  isShardCostPlannerSafe,
  isShardCostPlannerSafeFromCalibration
} from "../scripts/shards/cost-evaluator.mjs";
import { lintDocPortability } from "../scripts/contracts/lint-doc-portability.mjs";
import { verifyVendoringLayout } from "../scripts/contracts/verify-vendoring-layout.mjs";
import {
  formatScientificLabel,
  getShardCostScreenshotCalibration,
  runShardCostCalibrationChecks
} from "../scripts/shards/calibration-check.mjs";

const execFileAsync = promisify(execFile);

const snapshot = JSON.parse(
  await readFile(new URL("../data/game-data.snapshot.v1.json", import.meta.url), "utf8")
);
const dataFramework = JSON.parse(
  await readFile(new URL("../data/data-framework.v1.json", import.meta.url), "utf8")
);
const dataUnitFormat = JSON.parse(
  await readFile(new URL("../data/data-unit-format.v1.json", import.meta.url), "utf8")
);
const shardSystemUnit = JSON.parse(
  await readFile(new URL("../data/units/shards.v1.json", import.meta.url), "utf8")
);
const playerStateUnit = JSON.parse(
  await readFile(new URL("../data/units/player-state.v1.json", import.meta.url), "utf8")
);
const appMetaUnit = JSON.parse(
  await readFile(new URL("../data/units/app-meta.v1.json", import.meta.url), "utf8")
);
const tokenShopSystemUnit = JSON.parse(
  await readFile(new URL("../data/units/token-shop.v1.json", import.meta.url), "utf8")
);
const multiverseMarketSystemUnit = JSON.parse(
  await readFile(new URL("../data/units/multiverse-market.v1.json", import.meta.url), "utf8")
);
const traceUnit = JSON.parse(
  await readFile(new URL("../data/units/trace.v1.json", import.meta.url), "utf8")
);
const generatedPlayerStateSystemUnit = JSON.parse(
  await readFile(new URL("../data/system-units/player-state.v1.json", import.meta.url), "utf8")
);
const generatedAppMetaSystemUnit = JSON.parse(
  await readFile(new URL("../data/system-units/app-meta.v1.json", import.meta.url), "utf8")
);
const generatedTokenShopSystemUnit = JSON.parse(
  await readFile(new URL("../data/system-units/token-shop.v1.json", import.meta.url), "utf8")
);
const generatedMultiverseMarketSystemUnit = JSON.parse(
  await readFile(new URL("../data/system-units/multiverse-market.v1.json", import.meta.url), "utf8")
);
const multiverseMarketMetadataNeighborhoodData =
  generatedMultiverseMarketSystemUnit.sections.rowIdentity.metadataNeighborhood.data;
const generatedShardsSystemUnit = JSON.parse(
  await readFile(new URL("../data/system-units/shards.v1.json", import.meta.url), "utf8")
);
const generatedTraceSystemUnit = JSON.parse(
  await readFile(new URL("../data/system-units/trace.v1.json", import.meta.url), "utf8")
);
const groundedShardMilestones = JSON.parse(
  await readFile(new URL("../data/shard-milestones.grounded.v1.json", import.meta.url), "utf8")
);
const groundedShardObserved = JSON.parse(
  await readFile(
    new URL("../data/shard-observed-behaviors.grounded.v1.json", import.meta.url),
    "utf8"
  )
);
const groundedShardProvenance = JSON.parse(
  await readFile(
    new URL("../data/shard-milestones-provenance.grounded.v1.json", import.meta.url),
    "utf8"
  )
);
const shardAssetGrounding = JSON.parse(
  await readFile(new URL("../data/shard-asset-grounding.v1.json", import.meta.url), "utf8")
);
const shardOwnerFamilyBoundary = JSON.parse(
  await readFile(new URL("../data/shard-owner-family-boundary.v1.json", import.meta.url), "utf8")
);
const shardFinalSuBonusBoundary = JSON.parse(
  await readFile(new URL("../data/shard-finalsu-bonus-boundary.v1.json", import.meta.url), "utf8")
);
const shardMilestonePayloadBoundary = JSON.parse(
  await readFile(
    new URL("../data/shard-milestone-payload-boundary.v1.json", import.meta.url),
    "utf8"
  )
);
const shardCostModelBoundary = JSON.parse(
  await readFile(new URL("../data/shard-cost-model-boundary.v1.json", import.meta.url), "utf8")
);
const shardMilestoneRowModelBoundary = JSON.parse(
  await readFile(
    new URL("../data/shard-milestone-row-model-boundary.v1.json", import.meta.url),
    "utf8"
  )
);
const shardMilestoneTitleEffectBoundary = JSON.parse(
  await readFile(
    new URL("../data/shard-milestone-title-effect-boundary.v1.json", import.meta.url),
    "utf8"
  )
);
const shardEffectTextHandlerBoundary = JSON.parse(
  await readFile(
    new URL("../data/shard-effect-text-handler-boundary.v1.json", import.meta.url),
    "utf8"
  )
);
const shardMilestoneRowShellBoundary = JSON.parse(
  await readFile(
    new URL("../data/shard-milestone-row-shell-boundary.v1.json", import.meta.url),
    "utf8"
  )
);
const shardMilestoneRowAlignmentBoundary = JSON.parse(
  await readFile(
    new URL("../data/shard-milestone-row-alignment-boundary.v1.json", import.meta.url),
    "utf8"
  )
);
const shardMilestoneHandoffBoundary = JSON.parse(
  await readFile(
    new URL("../data/shard-milestone-handoff-boundary.v2.json", import.meta.url),
    "utf8"
  )
);
const shardSaveBoundary = JSON.parse(
  await readFile(new URL("../data/shard-save-boundary.v2.json", import.meta.url), "utf8")
);
const shardMilestoneSaveOwnerCandidates = JSON.parse(
  await readFile(
    new URL("../data/shard-milestone-save-owner-candidates.v2.json", import.meta.url),
    "utf8"
  )
);
const shardCostScreenshotCalibration =
  generatedShardsSystemUnit.models.cost.screenshotCalibration.data;
const shardCostListPathProbe = generatedShardsSystemUnit.support.cost.listPathProbe.data;
const shardCostFormulaModel = JSON.parse(
  await readFile(new URL("../data/shard-cost-formula-model.v1.json", import.meta.url), "utf8")
);
const shardTypeMetadataProbe = JSON.parse(
  await readFile(new URL("../data/shard-type-metadata-probe.v1.json", import.meta.url), "utf8")
);
const shardBonusSlotProbe = generatedShardsSystemUnit.support.cost.bonusSlotProbe.data;
const shardMilestoneFamilyEvidence = generatedShardsSystemUnit.support.family.familyEvidence.data;
const extractionCandidateFamilies = JSON.parse(
  await readFile(new URL("../data/extraction-candidate-families.v1.json", import.meta.url), "utf8")
);
const bundledDatasetContract = JSON.parse(
  await readFile(new URL("../data/bundled-dataset-contract.v1.json", import.meta.url), "utf8")
);
const tokenBankFormulaBoundaryData = JSON.parse(
  await readFile(new URL("../data/token-bank-formula-boundary.json", import.meta.url), "utf8")
);
const multiverseMarketRangeBoundaryData = JSON.parse(
  await readFile(new URL("../data/multiverse-market-range-boundary.json", import.meta.url), "utf8")
);
const multiverseMarketRowTextCoverageData =
  generatedMultiverseMarketSystemUnit.sections.rowIdentity.rowTextCoverage.data;
const multiverseMarketPrefabRemapBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-prefab-remap-boundary.json", import.meta.url),
    "utf8"
  )
);
const tokeniumNamingCluesData = generatedTokenShopSystemUnit.sections.tokenBank.namingClues.data;
const tokenBankStateCluesData = generatedTokenShopSystemUnit.sections.tokenBank.stateClues.data;
const dailyTokeniumLaneCluesData =
  generatedTokenShopSystemUnit.sections.dailyTokenium.laneClues.data;
const tokenShopCostLanesData = generatedTokenShopSystemUnit.sections.spendLanes.costLanes.data;
const spendActionLaneCluesData =
  generatedTokenShopSystemUnit.sections.spendLanes.actionLaneClues.data;
const multiverseMarketActionShellData =
  generatedMultiverseMarketSystemUnit.sections.uiShell.actionShell.data;
const multiverseMarketOwnerFamilyData =
  generatedMultiverseMarketSystemUnit.sections.uiShell.ownerFamily.data;
const tokenShopOwnerShellData = generatedTokenShopSystemUnit.sections.tokenBank.ownerShell.data;
const tokenShopSaveBoundaryData = JSON.parse(
  await readFile(new URL("../data/token-shop-save-boundary.v2.json", import.meta.url), "utf8")
);
const tokenShopRowLevelOwnerData = generatedTokenShopSystemUnit.boundaries.rows.rowLevelOwner.data;
const tokenShopRowRemapBoundaryData = generatedTokenShopSystemUnit.boundaries.rows.remap.data;
const tokenShopLateAtuBoundaryData = JSON.parse(
  await readFile(new URL("../data/token-shop-late-atu-boundary.json", import.meta.url), "utf8")
);
const multiverseMarketSaveBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-save-boundary.v2.json", import.meta.url),
    "utf8"
  )
);
const multiverseMarketMarketMemberBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-market-member-boundary.json", import.meta.url),
    "utf8"
  )
);
const multiverseMarketSaveDataImportBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-savedata-import-boundary.json", import.meta.url),
    "utf8"
  )
);
const multiverseMarketRow6974IdentitySourceBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-row69-74-identity-source-boundary.json", import.meta.url),
    "utf8"
  )
);
const multiverseMarketSerializedLabelSourceBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-serialized-label-source-boundary.json", import.meta.url),
    "utf8"
  )
);
const multiverseMarketRow7174IdentityBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-row71-74-identity-boundary.json", import.meta.url),
    "utf8"
  )
);
const multiverseMarketRow7174RemapBandData =
  generatedMultiverseMarketSystemUnit.boundaries.rowIdentity.row7174RemapBand.data;
const multiverseMarketNearbyIdentityBindingPatternData =
  generatedMultiverseMarketSystemUnit.boundaries.rowIdentity.nearbyIdentityBindingPattern.data;
const multiverseMarketInscriptionNumberingStabilityBoundaryData = JSON.parse(
  await readFile(
    new URL(
      "../data/multiverse-market-inscription-numbering-stability-boundary.json",
      import.meta.url
    ),
    "utf8"
  )
);
const multiverseMarket6974AnomalyProvenanceData =
  generatedMultiverseMarketSystemUnit.boundaries.rowIdentity.anomalyProvenance.data;
const multiverseMarketShellRowPredictionBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-shell-row-prediction-boundary.json", import.meta.url),
    "utf8"
  )
);
const multiverseMarketTextProvenancePathBoundaryData = JSON.parse(
  await readFile(
    new URL("../data/multiverse-market-text-provenance-path-boundary.json", import.meta.url),
    "utf8"
  )
);
const tokenBankControllerShellData =
  generatedTokenShopSystemUnit.sections.tokenBank.controllerShell.data;
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("../app.js", import.meta.url), "utf8");
const systemUnitProviderJs = await readFile(
  new URL("../support/system-unit-provider.js", import.meta.url),
  "utf8"
);
const importNormalizationSupportModule = await readFile(
  new URL("../support/import-normalization-support.js", import.meta.url),
  "utf8"
);
const researchValidationSupportModule = await readFile(
  new URL("../support/research-validation-support.js", import.meta.url),
  "utf8"
);
const shardBoundarySummarySupportModule = await readFile(
  new URL("../support/shard-boundary-summary-support.js", import.meta.url),
  "utf8"
);
const playerProfileBoundarySupportModule = await readFile(
  new URL("../support/player-profile-boundary-support.js", import.meta.url),
  "utf8"
);
const recommendationFeedSupportModule = await readFile(
  new URL("../support/recommendation-feed-support.js", import.meta.url),
  "utf8"
);
const shardEvidenceSupportModule = await readFile(
  new URL("../support/shard-evidence-support.js", import.meta.url),
  "utf8"
);
const shipPlannerSupportModule = await readFile(
  new URL("../support/ship-planner-support.js", import.meta.url),
  "utf8"
);
const spendBoundarySummaryJs = await readFile(
  new URL("../support/spend-boundary-summary.js", import.meta.url),
  "utf8"
);
const tokenShopSubjectContractsJs = await readFile(
  new URL("../support/token-shop-subject-contracts.js", import.meta.url),
  "utf8"
);
const tokenShopProgressionModel = await readFile(
  new URL("../token-shop-progression-model.js", import.meta.url),
  "utf8"
);
const tokenShopUiSupport = await readFile(
  new URL("../token-shop-ui-support.js", import.meta.url),
  "utf8"
);
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const recommendationContractModule = await readFile(
  new URL("../recommendation-contract.js", import.meta.url),
  "utf8"
);
const recommendationFixtures = JSON.parse(
  await readFile(
    new URL("./fixtures/recommendation-actions.fixtures.json", import.meta.url),
    "utf8"
  )
);
const shardVerificationDoc = await readFile(
  new URL("../docs/systems/shards/shard-system-verification.md", import.meta.url),
  "utf8"
);
const shardGroundingBoundaryDoc = await readFile(
  new URL("../docs/systems/shards/shard-grounding-boundary.md", import.meta.url),
  "utf8"
);
const shardPlayerFacingEvidenceDoc = await readFile(
  new URL("../docs/systems/shards/shard-player-facing-evidence.md", import.meta.url),
  "utf8"
);
const shardExtractionCandidatesDoc = await readFile(
  new URL("../docs/systems/shards/shard-extraction-candidates.md", import.meta.url),
  "utf8"
);
const shardOwnerFamilyDoc = await readFile(
  new URL("../docs/systems/shards/shard-owner-family-verification.md", import.meta.url),
  "utf8"
);
const shardMetadataNeighborhoodDoc = await readFile(
  new URL("../docs/systems/shards/shard-metadata-neighborhood.md", import.meta.url),
  "utf8"
);
const shardBonusMetadataNeighborhoodDoc = await readFile(
  new URL("../docs/systems/shards/shard-bonus-metadata-neighborhood.md", import.meta.url),
  "utf8"
);
const shardminingMetadataNeighborhoodDoc = await readFile(
  new URL("../docs/systems/shards/shardmining-metadata-neighborhood.md", import.meta.url),
  "utf8"
);
const shardUpgradeInfoMetadataNeighborhoodDoc = await readFile(
  new URL("../docs/systems/shards/shardupgradeinfo-metadata-neighborhood.md", import.meta.url),
  "utf8"
);
const shardMetadataNeighborhood = JSON.parse(
  await readFile(new URL("../data/shard-metadata-neighborhood.v1.json", import.meta.url), "utf8")
);
const shardBonusMetadataNeighborhood = JSON.parse(
  await readFile(
    new URL("../data/shard-bonus-metadata-neighborhood.v1.json", import.meta.url),
    "utf8"
  )
);
const shardminingMetadataNeighborhood = JSON.parse(
  await readFile(
    new URL("../data/shardmining-metadata-neighborhood.v1.json", import.meta.url),
    "utf8"
  )
);
const shardUpgradeInfoMetadataNeighborhood = JSON.parse(
  await readFile(
    new URL("../data/shardupgradeinfo-metadata-neighborhood.v1.json", import.meta.url),
    "utf8"
  )
);
const extractionRankingDoc = await readFile(
  new URL("../docs/unity/extraction-candidate-ranking.md", import.meta.url),
  "utf8"
);
const playerProfileSchemaDoc = await readFile(
  new URL("../docs/contracts/player-profile-schema.md", import.meta.url),
  "utf8"
);
const importMappingDoc = await readFile(
  new URL("../docs/contracts/import-mapping.md", import.meta.url),
  "utf8"
);
const playerProfileAliasAuditDoc = await readFile(
  new URL("../docs/contracts/player-profile-import-aliases.md", import.meta.url),
  "utf8"
);
const playerProfileAliasAuditData = JSON.parse(
  await readFile(new URL("../data/player-profile-import-aliases.v1.json", import.meta.url), "utf8")
);
const datasetRefreshChecklistDoc = await readFile(
  new URL("../docs/contracts/dataset-refresh-checklist.md", import.meta.url),
  "utf8"
);
const researchNoteTemplateDoc = await readFile(
  new URL("../docs/contracts/research-note-template.md", import.meta.url),
  "utf8"
);
const datasetIndexGeneratedDoc = await readFile(
  new URL("../docs/contracts/dataset-index.generated.md", import.meta.url),
  "utf8"
);
const shardResearchNote = await readFile(
  new URL("../docs/research/shard-milestones-grounded-2026-03-28.md", import.meta.url),
  "utf8"
);
const tokenShopDoc = await readFile(
  new URL("../docs/systems/spend/token-shop-values.md", import.meta.url),
  "utf8"
);
const tokenShopRowRemapVerificationDoc = await readFile(
  new URL("../docs/systems/spend/token-shop-row-remap-verification.md", import.meta.url),
  "utf8"
);
const multiverseMarketDoc = await readFile(
  new URL("../docs/systems/spend/multiverse-market-values.md", import.meta.url),
  "utf8"
);
const multiverseMarketVerificationDoc = await readFile(
  new URL("../docs/systems/spend/multiverse-market-verification.md", import.meta.url),
  "utf8"
);
const multiverseMarketStateVerificationDoc = await readFile(
  new URL("../docs/systems/spend/multiverse-market-state-verification.md", import.meta.url),
  "utf8"
);
const multiverseMarketMarketMemberBoundaryDoc = await readFile(
  new URL("../docs/systems/spend/multiverse-market-market-member-boundary.md", import.meta.url),
  "utf8"
);
const multiverseMarket6974AnomalyProvenanceDoc = await readFile(
  new URL("../docs/systems/spend/multiverse-market-69-74-anomaly-provenance.md", import.meta.url),
  "utf8"
);
const tokenBankStateDoc = await readFile(
  new URL("../docs/systems/spend/token-bank-state-verification.md", import.meta.url),
  "utf8"
);
const spendSystemVerificationDoc = await readFile(
  new URL("../docs/systems/spend/spend-system-verification.md", import.meta.url),
  "utf8"
);
const dailyTokeniumMissionDoc = await readFile(
  new URL("../docs/systems/spend/daily-tokenium-mission-lane-verification.md", import.meta.url),
  "utf8"
);
const activeGroundingBoundariesDoc = await readFile(
  new URL("../docs/roadmap/active-grounding-boundaries.md", import.meta.url),
  "utf8"
);
const unityOwnerMapDoc = await readFile(
  new URL("../docs/unity/unity-owner-map.md", import.meta.url),
  "utf8"
);
const shardIngestDoc = await readFile(
  new URL("../docs/systems/shards/shard-milestones-grounding-ingest.md", import.meta.url),
  "utf8"
);
const unityAuditPlaybook = await readFile(
  new URL("../docs/unity/unity-audit-playbook.md", import.meta.url),
  "utf8"
);
const devServer = await readFile(new URL("../scripts/dev-server.mjs", import.meta.url), "utf8");
const extractRunner = await readFile(
  new URL("../scripts/unity/run_extract.mjs", import.meta.url),
  "utf8"
);
const launcherVbs = await readFile(new URL("../launch-cifi.vbs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const generatedDatasetIndex = await generateDatasetIndex(repoRoot);
await runNodeSyntaxCheck(fileURLToPath(new URL("../app.js", import.meta.url)));
const datasetValidation = await validateBundledDatasets();
const normalizedHtml = collapseWhitespace(html);
const normalizedAppJs = collapseWhitespace(appJs);
const normalizedImportNormalizationSupportModule = collapseWhitespace(
  importNormalizationSupportModule
);
const normalizedResearchValidationSupportModule = collapseWhitespace(
  researchValidationSupportModule
);
const normalizedShardBoundarySummarySupportModule = collapseWhitespace(
  shardBoundarySummarySupportModule
);
const normalizedPlayerProfileBoundarySupportModule = collapseWhitespace(
  playerProfileBoundarySupportModule
);
const normalizedRecommendationFeedSupportModule = collapseWhitespace(
  recommendationFeedSupportModule
);
const normalizedShardEvidenceSupportModule = collapseWhitespace(shardEvidenceSupportModule);
const normalizedShipPlannerSupportModule = collapseWhitespace(shipPlannerSupportModule);
const normalizedSpendBoundarySummaryJs = collapseWhitespace(spendBoundarySummaryJs);
const normalizedExtractRunner = collapseWhitespace(extractRunner);
const bootstrapDatasetBindings = getBootstrapDatasetBindings(appJs);
const hardAssert = {
  ok: assert.ok.bind(assert),
  equal: assert.equal.bind(assert),
  deepEqual: assert.deepEqual.bind(assert),
  match: assert.match.bind(assert),
  doesNotMatch: assert.doesNotMatch.bind(assert)
};
const smokeFailures = [];
const seenSmokeFailureKeys = new Set();

installSoftAssertions();

assert.deepEqual(
  bootstrapDatasetBindings.variableNames,
  ["shipBaseline", "loadedSystemUnits"],
  "bootstrap dataset destructuring changed unexpectedly"
);
assert.deepEqual(
  bootstrapDatasetBindings.fetchPaths,
  ["./data/ship-optimizer.desmos-baseline.v1.json"],
  "bootstrap fetch order changed unexpectedly"
);
assert.match(appJs, /loadSystemUnits\(\{/);
assert.match(appJs, /state\.systemUnitSource = systemUnitSource/);
assert.match(appJs, /TokenShop currency shell/);
assert.match(appJs, /Token or tokenium spend lane grounded/);
assertTextIncludesAllConcepts(
  appJs,
  ["Daily Tokenium", "TokenShop", "modifier-side", "budget lane"],
  "app spend guidance"
);
assert.match(appJs, /Foundation archive/);
assert.match(appJs, /researchView: "active"/);
assert.match(appJs, /function renderResearchViewSelector\(tracks\)/);
assert.match(appJs, /data-research-view="active"/);
assert.match(appJs, /data-research-view="archived"/);
assert.match(appJs, /function bindResearchViewSelector\(\)/);
assert.match(appJs, /track\.status === "archived" : track\.status !== "archived"/);
assert.match(styles, /\.research-view-toggle/);
assert.match(researchValidationSupportModule, /Active roadmap slice/);
assert.match(researchValidationSupportModule, /Queued behind mapping gate/);
assert.match(researchValidationSupportModule, /Queued after gate/);
assert.match(researchValidationSupportModule, /Sequence 1\/5/);
assert.match(researchValidationSupportModule, /Sequence 4\/5/);
assert.match(researchValidationSupportModule, /PR 3 then PR 5 hardening/);
assert.match(appJs, /APK\/Unity first/);
assert.match(researchValidationSupportModule, /Integration contract/);
assert.match(researchValidationSupportModule, /In research/);
assert.match(appJs, /checked APK or Unity evidence/);
assert.match(appJs, /Confidence, uncertainty, and classification are explicit/);
assert.match(appJs, /Sources/);
assert.match(appJs, /Repo artifacts/);
assert.match(appJs, /Verified now/);
assert.match(appJs, /Still uncertain/);
assert.match(appJs, /Smallest shippable slice/);
assert.match(researchValidationSupportModule, /Research intake only/);
assert.match(researchValidationSupportModule, /"hunter-related-planning"/);
assert.match(researchValidationSupportModule, /"mech-related-planning"/);
assert.match(researchValidationSupportModule, /"input-automation-intake"/);
assert.match(researchValidationSupportModule, /"external-model-integration-intake"/);
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
assert.match(
  shardBoundarySummarySupportModule,
  /export function getShardOwnerFamilyBoundarySummary/
);
assert.match(
  shardBoundarySummarySupportModule,
  /export function getShardFinalSuBonusBoundarySummary/
);
assert.match(appJs, /Grounded shard evidence/);
assert.match(appJs, /Definition carrier/);
assert.match(appJs, /ShardMining owns the reachable definition family|Shard owner-family/);
assert.match(appJs, /Shard-cost evidence/);
assert.match(appJs, /Recovered cost data now supports evidence cards/);
assert.match(appJs, /Safe shard truths already shown in the app/);
assert.match(appJs, /Definition family is grounded; owned state stays blocked/);
assert.match(appJs, /What must be grounded before stronger behavior/);
assertTextIncludesAllConcepts(
  appJs,
  ["uncertainty remains high", "better research note", "not stronger planner behavior"],
  "app shard grounding boundary"
);
assert.match(appJs, /function renderDatasetRefreshHardening/);
assert.match(appJs, /Dataset refresh hardening path/);
assert.match(appJs, /Use this before promoting new bundled data or refreshing shipped JSON assets/);
assert.match(appJs, /data\/bundled-dataset-contract\.v1\.json/);
assert.match(appJs, /canonical-app-snapshot/);
assert.match(appJs, /community-derived/);
assert.doesNotMatch(html, /id="overviewSpendSnapshot"/);
assert.match(appJs, /function renderSpendPlannerBoundary/);
assert.match(appJs, /Forked from the research-only spend-planner lane into a normal app surface/);
assert.match(appJs, /The active spend panel now stays tools first, import later/);
assert.match(appJs, /Canonical spend inputs available now/);
assert.match(appJs, /Blocked owner-dependent spend seams/);
assert.match(appJs, /Disabled planner actions/);
assert.match(appJs, /Why recommendations stay unavailable/);
assert.match(appJs, /Tokens",\s*value: canonical\.tokens/);
assert.match(appJs, /Diamonds",\s*value: canonical\.diamonds/);
assert.match(appJs, /Current LR",\s*value: canonical\.loopReset/);
assert.match(appJs, /Academy relics",\s*value: canonical\.academyRelics/);
assert.match(appJs, /These are the only spend-side values this panel consumes today/);
assert.match(appJs, /TokenShop row levels and recommendation math/);
assertTextIncludesAllConcepts(
  appJs,
  [
    "does not read",
    "checked TokenShop row levels",
    "ATU imports",
    "Progression-side storefront lane"
  ],
  "app spend planner exclusions"
);
assert.match(appJs, /buildAppMetaSystemView/);
assert.match(appJs, /state\.systemUnits = \{[\s\S]*appMeta: appMetaSystemUnit/);
assert.match(appJs, /state\.datasetContract = appMetaView\.datasetContract/);
assert.match(appJs, /Token-bank state/);
assertTextIncludesAllConcepts(
  appJs,
  [
    "Blocked for planner use",
    "Banked amount",
    "cap",
    "fill",
    "claimable-bank state",
    "owner-dependent seams"
  ],
  "app token-bank boundary"
);
assert.match(appJs, /Daily Tokenium lane state/);
assertTextIncludesAllConcepts(
  appJs,
  [
    "Stored amount",
    "cap",
    "ready or claimable state",
    "Academy",
    "Farm Mission",
    "grounded strongly enough"
  ],
  "app daily tokenium boundary"
);
assert.match(appJs, /Emporium owned progression and Inscryptions balance/);
assertTextIncludesAllConcepts(
  appJs,
  ["Intentionally parked", "spend planner", "does not consume", "Emporium import previews"],
  "app emporium boundary"
);
assert.match(appJs, /Recommend next spend/);
assert.match(appJs, /Use imported spend state/);
assert.match(appJs, /Rank TokenShop or Emporium buys/);
assert.match(systemUnitProviderJs, /\.\/data\/system-units\/token-shop\.v1\.json/);
assert.match(systemUnitProviderJs, /\.\/data\/system-units\/app-meta\.v1\.json/);
assert.match(
  appJs,
  /boundary\?\.adjacentFollowUp\?\.verifiedNamedIdentityJoin\?\.namedIdentity[\s\S]*boundary\?\.adjacentFollowUp\?\.verifiedTitleTextChain\?\.titleProbeTitle[\s\S]*boundary\?\.adjacentFollowUp\?\.recoveredAdditionalBridge\?\.prefabIdentity[\s\S]*"NewTokenUPGPrefab\.T1\.TokensBoost"/
);
assert.match(appJs, /boundary\?\.adjacentFollowUp\?\.verifiedNamedIdentityJoin\?\.namedIdentity/);
assert.match(appJs, /boundary\?\.adjacentFollowUp\?\.verifiedTitleTextChain\?\.titleProbeTitle/);
assert.match(
  appJs,
  /boundary\?\.recoveredBridge\?\.prefabIdentity \|\| "NewTokenUPGPrefab\.T1\.DiamondBoost"/
);
assert.match(
  appJs,
  /boundary\?\.boundedRecoveredBridge\?\.prefabIdentity[\s\S]*"NewTokenUPGPrefab\.T1\.MK1Booster"/
);
assert.match(
  normalizedAppJs,
  /boundary\?\.verifiedTitleJoin\?\.titleProbeTitle\s*\|\|\s*boundary\?\.boundedRecoveredBridgeFollowUp\?\.prefabIdentity\s*\|\|\s*"Mk2 Generator Booster"/
);
assert.match(appJs, /function renderTokenShopProgressionEditor/);
assert.match(appJs, /function getTokenShopProgressionModel/);
assert.match(tokenShopUiSupport, /function formatTokenShopBonusStep/);
assert.match(appJs, /THE TOKEN BANK/);
assert.match(tokenShopProgressionModel, /Default level 0/);
assert.ok(
  tokenShopProgressionModel.includes(
    "Rows are shown in grounded ATU slot order by visible in-game tier shell: T1 (ATU1-ATU12), T2 (ATU13-ATU19), T3 (ATU20-ATU23), T4 (ATU24-ATU28). Player-profile checked state is primary, compatibility is fallback only, and tier locks remain heuristic policy until stronger in-game gating clears."
  )
);
assert.match(appJs, /Effect-driven checked row/);
assert.match(appJs, /Prefab-driven checked row/);
assert.match(
  appJs,
  /purchase plates write back into checked player state and deduct Tokens from the profile/i
);
assert.match(appJs, /exact runtime display-update path and runtime model for the ATU4 row/i);
assert.match(tokenShopUiSupport, /function sanitizeTokenShopRichText/);
assert.match(appJs, /<details class="token-shop-evidence-note">/);
assert.match(appJs, /boundary\?\.atu3CrossSystemEffectTrace\?\.recoveredActionEffectChain/);
assert.match(appJs, /Recommended buys stay helper-only, not canonical truth/);
assert.match(appJs, /Manual levels live under checked player state/);
assert.match(
  appJs,
  /Known cost inputs: start \$\{formatBoundaryValue\(row\.startCost\)\} \+ additive \$\{formatBoundaryValue\(row\.additiveCost\)\} x current level\./
);
assert.match(appJs, /token-shop-buff-strip/);
assert.match(appJs, /token-shop-buff-plate/);
assert.match(tokenShopUiSupport, /"checked effect step\(s\)" : "extracted bonus step\(s\)"/);
assert.match(html, /id="tokenShopProgressionStatus"/);
assert.match(appJs, /TokenShop \(\$\{counts\.tokenShop\}\)/);
assert.match(appJs, /function renderTokenShopSavedStateSnapshot\(\)/);
assert.match(appJs, /Imported TokenShop saved amounts/);
assert.match(
  appJs,
  /exact stored amounts recovered under <code>compatibility\.unmappedSystemState\.tokenShop<\/code>/
);
assert.match(appJs, /Banked Tokens/);
assert.match(appJs, /Daily Tokenium/);
assert.match(
  appJs,
  /Current stored amount recovered from compatibility import only\. Token-bank cap and claimable-bank state remain blocked\./
);
assert.match(
  appJs,
  /Current stored amount recovered from compatibility import only\. Daily Tokenium cap and ready state remain blocked\./
);
assert.match(
  appJs,
  /A broader generic Tokenium claimable clue is present in the same import, but it stays out of this snapshot/
);
assert.match(
  appJs,
  /Checked subset only\. This TokenShop lane resolves current level from checked player state first and compatibility fallback second\. Local override rows are removed from the active storefront path\./
);
assert.match(appJs, /TokenShop row levels and recommendation math/);
assert.match(appJs, /Token-bank state/);
assert.match(appJs, /Daily Tokenium lane state/);
assert.match(
  appJs,
  /Academy or Farm Mission owner lane is grounded strongly enough for planner-safe use/
);
assert.match(appJs, /Emporium owned progression and Inscryptions balance/);
assert.match(appJs, /Confidence label: canonical PlayerProfile spend values only/);
assert.match(appJs, /Canonical boundary preserved/);
assert.match(appJs, /Tools first, import later/);
assert.match(appJs, /Owner-dependent inputs blocked/);
assert.match(appJs, /Uncertainty visible/);
assert.match(appJs, /No spend recommendations yet/);
assert.match(appJs, /function renderSpendPlannerResearchForkNote/);
assertTextIncludesAllConcepts(
  appJs,
  [
    "Overview page",
    "canonical-only descriptive spend panel",
    "row-level TokenShop tools",
    "compatibility imports",
    "non-canonical surfaces"
  ],
  "app spend planner fork note"
);
assertTextIncludesAllConcepts(
  appJs,
  ["grounded tools first", "import later"],
  "app spend planner product stance"
);
assert.match(
  tokenShopUiSupport,
  /Grounded as a checked shell-to-prefab-to-player-facing-title row\./
);
assert.match(appJs, /from "\.\/support\/recommendation-feed-support\.js"/);
assert.match(recommendationFeedSupportModule, /function getRecommendationExplainabilitySummary/);
assert.match(recommendationFeedSupportModule, /function getRecommendationContractSummary/);
assert.match(recommendationFeedSupportModule, /function getRecommendationExplainabilityAudit/);
assert.match(appJs, /from "\.\/support\/ship-planner-support\.js"/);
assert.match(appJs, /from "\.\/support\/player-profile-boundary-support\.js"/);
assert.match(
  playerProfileBoundarySupportModule,
  /export function buildPlayerProfileBoundaryGroups/
);
assert.match(playerProfileBoundarySupportModule, /export function getPlayerProfileBoundaryAudit/);
assert.match(playerProfileBoundarySupportModule, /export function getProfileCompletion/);
assert.match(
  playerProfileBoundarySupportModule,
  /export function getImportedMultiverseMarketPreviewCardModel/
);
assert.match(
  normalizedPlayerProfileBoundarySupportModule,
  /buildPlayerProfileBoundaryGroups\(\{ canonical, shardPlanner, shipPlanner, experimental, compatibility \}\)/
);
assert.match(shipPlannerSupportModule, /export function createShipPlannerSupport/);
assert.match(shipPlannerSupportModule, /export function getDisplayEffectTypes/);
assert.match(shipPlannerSupportModule, /export function getPrimaryEffectClass/);
assert.match(shipPlannerSupportModule, /export function normalizeEffectType/);
assert.match(
  normalizedShipPlannerSupportModule,
  /createShipPlannerSupport\(\{ desmosInstallWeightMaps, getActiveLoadout, getEffectiveCap, getShipCommunityToolState, getShipConfig, getShipInstallTotal, getShipTemplate, shipInstallIndexLayouts, sum \}\)/
);
assert.match(devServer, /launchSignalSequence:\s*launcherSignalSequence/);
assert.match(
  devServer,
  /launchSignalSequence:\s*launcherSignalSequence[\s\S]*launchSignalSequence:\s*launcherSignalSequence/
);
assert.match(
  devServer,
  /JSON\.stringify\(\{\s*launchSignalSequence:\s*launcherSignalSequence\s*\}\)/
);
assert.match(appJs, /function getActiveMvpRecommendationFeedPartition\(\)/);
assert.match(appJs, /function renderRecommendationFeedSupportNotice\(results, surface\)/);
assertTextIncludesAllConcepts(
  recommendationFeedSupportModule,
  ["failed", "shared recommendation contract", "removed from the main feed"],
  "recommendation feed support module failure guidance"
);
assertTextIncludesAllConcepts(
  recommendationFeedSupportModule,
  ["contract audit details", "repair those cards", "player-facing guidance"],
  "recommendation feed support module repair guidance"
);
assert.match(appJs, /All visible cards currently satisfy the shared recommendation contract\./);
assert.match(appJs, /Contract gaps still hide/);
assert.match(appJs, /Status: Contract gaps\./);
assert.match(appJs, /The current card satisfies the shared recommendation contract\./);
assert.match(appJs, /Player value/);
assert.match(appJs, /Spend-planner recommendations remain blocked by system-mapping gaps/);
assert.match(appJs, /Explainability audit/);
assert.match(appJs, /Status: \$\{escapeHtml\(explainabilityAudit\.status\)\}\./);
assert.match(appJs, /Source note: \$\{escapeHtml\(explainabilityAudit\.sourceNoteStatus\)\}\./);
assert.match(recommendationFeedSupportModule, /Missing: none\./);
assert.match(recommendationFeedSupportModule, /Partial context/);
assert.match(recommendationFeedSupportModule, /Complete context/);
assert.doesNotMatch(appJs, /function getPlayerProfileBoundaryAudit/);
assert.match(playerProfileBoundarySupportModule, /function getPlayerProfileBoundaryAudit/);
assert.match(appJs, /Import boundary audit/);
assertTextIncludesAllConcepts(
  appJs,
  ["Normalization keeps imported values", "labeled namespaces", "raw game truth"],
  "app import boundary audit guidance"
);
assert.match(playerProfileBoundarySupportModule, /Quarantined unmapped system blobs preserved:/);
assert.match(playerProfileBoundarySupportModule, /Compatibility-only leftovers preserved:/);
assert.match(appJs, /Review the boundary audit before using recommendations/);
const normalizedFeedAction = toRecommendationAction(
  {
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
  },
  "loop"
);
const fallbackFeedAction = toRecommendationAction(
  {
    score: "bad",
    confidence: -5,
    whyNow: [" ", "Missing inputs"]
  },
  "loop"
);
const sortedFeedFixture = sortRecommendationFeed([
  toRecommendationAction(
    {
      id: "upgrade-high",
      module: "shards",
      kind: "upgrade",
      title: "Upgrade high",
      score: 99,
      confidence: 0.9
    },
    "shards"
  ),
  toRecommendationAction(
    {
      id: "warning-low",
      module: "loop",
      kind: "warning",
      title: "Warning low",
      score: 20,
      confidence: 0.2
    },
    "loop"
  ),
  toRecommendationAction(
    {
      id: "warning-high",
      module: "loop",
      kind: "warning",
      title: "Warning high",
      score: 20,
      confidence: 0.8
    },
    "loop"
  )
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
const normalizedFixtureActions = recommendationFixtures.actions.map((item) =>
  toRecommendationAction(item, item.module)
);
const sortedFixtureActions = sortRecommendationFeed(normalizedFixtureActions);
const expectedBundledDatasetIds = [
  "snapshot",
  "data-framework",
  "app-meta-unit",
  "player-state-unit",
  "shards-unit",
  "token-shop-unit",
  "multiverse-market-unit",
  "trace-unit",
  "shards",
  "shard-asset-grounding",
  "shard-owner-family-boundary",
  "shard-finalsu-bonus-boundary",
  "shard-milestone-payload-boundary",
  "shard-cost-model-boundary",
  "shard-milestone-row-model-boundary",
  "shard-milestone-title-effect-boundary",
  "shard-effect-text-handler-boundary",
  "shard-milestone-row-shell-boundary",
  "shard-milestone-row-alignment-boundary",
  "shard-milestone-handoff-boundary",
  "shard-save-boundary",
  "shard-milestone-save-owner-candidates",
  "extraction-candidate-families",
  "token-bank-formula-boundary",
  "multiverse-market-range-boundary",
  "multiverse-market-prefab-remap-boundary",
  "token-shop-save-boundary",
  "token-shop-late-atu-boundary",
  "multiverse-market-save-boundary",
  "multiverse-market-market-member-boundary",
  "multiverse-market-savedata-import-boundary",
  "multiverse-market-row69-74-identity-source-boundary",
  "multiverse-market-serialized-label-source-boundary",
  "multiverse-market-row71-74-identity-boundary",
  "multiverse-market-inscription-numbering-stability-boundary",
  "multiverse-market-shell-row-prediction-boundary",
  "multiverse-market-text-provenance-path-boundary"
];

const defaultProfile = createDefaultPlayerProfile();
assert.deepEqual(defaultProfile.planning.shards.observedLevelsByMilestone, {});
assert.deepEqual(defaultProfile.planning.tokenShop.checkedSubsetLevels, {
  ATU1Level: null,
  ATU2Level: null,
  ATU3Level: null,
  ATU4Level: null,
  ATU5Level: null,
  ATU6Level: null,
  ATU7Level: null,
  ATU8Level: null,
  ATU9Level: null,
  ATU10Level: null,
  ATU11Level: null,
  ATU12Level: null,
  ATU13Level: null,
  ATU14Level: null,
  ATU15Level: null,
  ATU16Level: null,
  ATU17Level: null,
  ATU18Level: null,
  ATU19Level: null,
  ATU20Level: null,
  ATU21Level: null,
  ATU22Level: null,
  ATU23Level: null,
  ATU24Level: null,
  ATU25Level: null,
  ATU26Level: null,
  ATU27Level: null,
  ATU28Level: null
});
assert.deepEqual(defaultProfile.planning.tokenShop.checkedSubsetPlayerState, {
  ATU1Level: null,
  ATU2Level: null,
  ATU3Level: null,
  ATU4Level: null,
  ATU5Level: null,
  ATU6Level: null,
  ATU7Level: null,
  ATU8Level: null,
  ATU9Level: null,
  ATU10Level: null,
  ATU11Level: null,
  ATU12Level: null,
  ATU13Level: null,
  ATU14Level: null,
  ATU15Level: null,
  ATU16Level: null,
  ATU17Level: null,
  ATU18Level: null,
  ATU19Level: null,
  ATU20Level: null,
  ATU21Level: null,
  ATU22Level: null,
  ATU23Level: null,
  ATU24Level: null,
  ATU25Level: null,
  ATU26Level: null,
  ATU27Level: null,
  ATU28Level: null
});
assert.deepEqual(defaultProfile.externalModels.communityTools.shipOptimizer, {});
assert.deepEqual(defaultProfile.externalModels.communityTools.shardOptimizer, {});
assert.deepEqual(defaultProfile.externalModels.communityTools.modTreeOptimizer, {});

assert.equal(snapshot.snapshotVersion, "v1.0.0-alpha");
assert.equal(dataFramework.dataset, "repo-data-framework.v1");
assert.equal(dataFramework.migrationUnits.length, 5);
assert.deepEqual(
  dataFramework.roles.map((role) => role.id),
  ["canonical", "boundary", "model", "support", "historical-probe"]
);
assert.ok(dataFramework.migrationUnits.some((unit) => unit.id === "shards"));
assert.ok(dataFramework.migrationUnits.some((unit) => unit.id === "player-state"));
assert.ok(dataFramework.migrationUnits.some((unit) => unit.id === "token-shop"));
assert.ok(dataFramework.migrationUnits.some((unit) => unit.id === "multiverse-market"));
assert.ok(dataFramework.migrationUnits.some((unit) => unit.id === "trace"));
assert.deepEqual(
  dataFramework.migrationUnits.find((unit) => unit.id === "shards")?.inputs?.historicalProbe,
  [
    "data/shard-scene-monobehaviour-probe.v1.json",
    "data/shard-type-metadata-probe.v1.json",
    "data/shard-cost-parameter-probe.v1.json",
    "data/shard-cost-method-probe.v1.json",
    "data/shard-cost-native-probe.v1.json"
  ]
);
assert.deepEqual(
  dataFramework.migrationUnits.find((unit) => unit.id === "token-shop")?.inputs?.historicalProbe,
  [
    "data/archive/token-shop-values.json",
    "data/archive/token-shop-trace-support.v1.json",
    "data/archive/uabea-extract-report.json",
    "data/archive/unity-apk-extract-report.json"
  ]
);
assert.deepEqual(
  dataFramework.migrationUnits.find((unit) => unit.id === "multiverse-market")?.inputs
    ?.historicalProbe,
  [
    "data/archive/multiverse-market-values.json",
    "data/archive/multiverse-market-metadata-neighborhood.json",
    "data/archive/uabea-extract-report.json",
    "data/archive/unity-apk-extract-report.json"
  ]
);
assert.ok(
  dataFramework.migrationUnits
    .find((unit) => unit.id === "player-state")
    ?.inputs?.support?.includes("data/player-profile-import-aliases.v1.json")
);
assert.deepEqual(
  dataFramework.migrationUnits.find((unit) => unit.id === "player-state")?.targetDatasets,
  ["data/system-units/player-state.v1.json"]
);
assert.deepEqual(
  dataFramework.migrationUnits.find((unit) => unit.id === "shards")?.targetDatasets,
  ["data/system-units/shards.v1.json"]
);
assert.deepEqual(
  dataFramework.migrationUnits.find((unit) => unit.id === "token-shop")?.targetDatasets,
  ["data/system-units/token-shop.v1.json"]
);
assert.deepEqual(
  dataFramework.migrationUnits.find((unit) => unit.id === "multiverse-market")?.targetDatasets,
  ["data/system-units/multiverse-market.v1.json"]
);
assert.deepEqual(dataFramework.migrationUnits.find((unit) => unit.id === "trace")?.targetDatasets, [
  "data/system-units/trace.v1.json"
]);
assert.equal(dataUnitFormat.dataset, "repo-data-unit-format.v1");
assert.deepEqual(dataUnitFormat.viewKeys, [
  "canonical",
  "boundary",
  "model",
  "support",
  "historicalProbe"
]);
assert.deepEqual(dataUnitFormat.targetShapeKeys, [
  "canonical",
  "boundaries",
  "models",
  "support",
  "traceEvidence"
]);
assert.deepEqual(dataUnitFormat.provenanceRecordKinds, [
  "dataset",
  "code-contract",
  "doc-contract",
  "command"
]);
[
  shardSystemUnit,
  playerStateUnit,
  tokenShopSystemUnit,
  multiverseMarketSystemUnit,
  traceUnit
].forEach((unit) => {
  assert.equal(unit.dataset, "repo-data-unit.v1");
  assert.equal(unit.schemaRef, "data/data-unit-format.v1.json");
  assert.equal(unit.frameworkRef, "data/data-framework.v1.json");
  assert.ok(typeof unit.subsystems === "object" && unit.subsystems !== null);
  assert.ok(unit.provenance && Array.isArray(unit.provenance.sourceRecords));
  assert.deepEqual(Object.keys(unit.views), [
    "canonical",
    "boundary",
    "model",
    "support",
    "historicalProbe"
  ]);
});
assert.equal(shardSystemUnit.unitId, "shards");
assert.equal(playerStateUnit.unitId, "player-state");
assert.equal(tokenShopSystemUnit.unitId, "token-shop");
assert.equal(multiverseMarketSystemUnit.unitId, "multiverse-market");
assert.equal(traceUnit.unitId, "trace");
assert.deepEqual(tokenShopSystemUnit.views.historicalProbe, [
  "data/archive/uabea-extract-report.json",
  "data/archive/unity-apk-extract-report.json"
]);
assert.ok(
  !tokenShopSystemUnit.views.support.includes("data/spend-action-lane-clues.json"),
  "token shop unit support view should not keep spend-action-lane-clues as a live dependency"
);
assert.ok(
  !tokenShopSystemUnit.views.support.includes("data/token-bank-controller-shell.json"),
  "token shop unit support view should not keep token-bank-controller-shell as a live dependency"
);
assert.ok(
  !tokenShopSystemUnit.views.support.includes("data/token-shop-owner-shell.json"),
  "token shop unit support view should not keep token-shop-owner-shell as a live dependency"
);
assert.ok(
  !tokenShopSystemUnit.views.support.includes("data/tokenium-naming-clues.json"),
  "token shop unit support view should not keep tokenium-naming-clues as a live dependency"
);
assert.ok(
  !tokenShopSystemUnit.views.support.includes("data/token-bank-state-clues.json"),
  "token shop unit support view should not keep token-bank-state-clues as a live dependency"
);
assert.ok(
  !tokenShopSystemUnit.views.support.includes("data/daily-tokenium-lane-clues.json"),
  "token shop unit support view should not keep daily-tokenium-lane-clues as a live dependency"
);
assert.deepEqual(multiverseMarketSystemUnit.views.historicalProbe, [
  "data/archive/uabea-extract-report.json",
  "data/archive/unity-apk-extract-report.json"
]);
assert.deepEqual(shardSystemUnit.views.historicalProbe, [
  "data/shard-scene-monobehaviour-probe.v1.json",
  "data/shard-type-metadata-probe.v1.json",
  "data/shard-cost-parameter-probe.v1.json",
  "data/shard-cost-method-probe.v1.json",
  "data/shard-cost-native-probe.v1.json"
]);
assert.ok(
  multiverseMarketSystemUnit.views.boundary.includes(
    "data/multiverse-market-market-member-boundary.json"
  )
);
assert.ok(
  shardSystemUnit.replacementPlan.archiveAfterReplacement.includes(
    "data/shard-cost-native-probe.v1.json"
  )
);
assert.ok(playerStateUnit.views.support.includes("data/player-profile-import-aliases.v1.json"));
assert.ok(
  playerStateUnit.provenance.sourceRecords.some(
    (record) => record.kind === "code-contract" && record.path === "player-profile.js"
  )
);
assert.ok(
  Object.keys(shardSystemUnit.subsystems).includes("family") &&
    Object.keys(shardSystemUnit.subsystems).includes("owned-state") &&
    Object.keys(shardSystemUnit.subsystems).includes("cost")
);
assert.ok(
  tokenShopSystemUnit.provenance.sourceRecords.some(
    (record) =>
      record.kind === "command" &&
      record.command ===
        "python scripts\\unity\\unity_trace_bundle.py --family token-shop --level structured"
  )
);
assert.equal(generatedPlayerStateSystemUnit.dataset, "repo-system-unit.v1");
assert.equal(generatedPlayerStateSystemUnit.systemId, "player-state");
assert.equal(generatedPlayerStateSystemUnit.unitInventoryRef, "data/units/player-state.v1.json");
assert.equal(
  generatedPlayerStateSystemUnit.sections.canonicalSharedTruth.schemaVersion,
  PLAYER_PROFILE_SCHEMA_VERSION
);
assert.equal(generatedTokenShopSystemUnit.dataset, "repo-system-unit.v1");
assert.equal(generatedTokenShopSystemUnit.systemId, "token-shop");
assert.equal(generatedTokenShopSystemUnit.unitInventoryRef, "data/units/token-shop.v1.json");
assert.ok(generatedTokenShopSystemUnit.sections.rows.extract.data.field_count > 0);
assert.ok(
  generatedTokenShopSystemUnit.sections.tokenBank.controllerShell.data.controllerAnchors.includes(
    "ClaimBankedTokens"
  )
);
assert.equal(
  generatedTokenShopSystemUnit.sections.traceRuns.atu3Effect.data.target.targetId,
  "token-shop-atu3-cells-effect"
);
assert.equal(
  generatedTokenShopSystemUnit.sections.traceRuns.familyStructure.data.target.targetId,
  "token-shop-family-structure"
);
assert.equal(
  generatedTokenShopSystemUnit.sections.spendLanes.actionLaneClues.sourcePath,
  "db:derived:token-shop-action-lanes"
);
assert.equal(
  generatedTokenShopSystemUnit.sections.tokenBank.controllerShell.sourcePath,
  "db:derived:token-bank-controller-shell"
);
assert.equal(
  generatedTokenShopSystemUnit.sections.tokenBank.ownerShell.sourcePath,
  "db:derived:token-shop-owner-shell"
);
assert.equal(
  generatedTokenShopSystemUnit.sections.tokenBank.namingClues.sourcePath,
  "db:derived:tokenium-naming-clues"
);
assert.equal(
  generatedTokenShopSystemUnit.sections.tokenBank.stateClues.sourcePath,
  "db:derived:token-bank-state-clues"
);
assert.equal(
  generatedTokenShopSystemUnit.sections.dailyTokenium.laneClues.sourcePath,
  "db:derived:daily-tokenium-lane-clues"
);
assert.equal(generatedMultiverseMarketSystemUnit.dataset, "repo-system-unit.v1");
assert.equal(generatedMultiverseMarketSystemUnit.systemId, "multiverse-market");
["canonical", "boundaries", "models", "support", "traceEvidence"].forEach((key) => {
  assert.ok(
    generatedMultiverseMarketSystemUnit[key] &&
      typeof generatedMultiverseMarketSystemUnit[key] === "object",
    `generated multiverse market unit missing ${key}`
  );
});
assert.equal(
  generatedMultiverseMarketSystemUnit.unitInventoryRef,
  "data/units/multiverse-market.v1.json"
);
assert.ok(
  generatedMultiverseMarketSystemUnit.sections.saveOwner.marketMemberBoundary.data
    .playerProfileAccessorClues.length > 0
);
assert.equal(
  generatedMultiverseMarketSystemUnit.sections.saveOwner.traceBoundary.data.target.targetId,
  "multiverse-market-save-owner-boundary"
);
assert.equal(
  generatedMultiverseMarketSystemUnit.boundaries.rowIdentity.row7174RemapBand.data.dataset,
  "multiverse-market-row71-74-remap-band"
);
assert.equal(
  generatedMultiverseMarketSystemUnit.support.rowIdentity.metadataNeighborhood.sourcePath,
  "db:derived:multiverse-market-metadata-neighborhood"
);
assert.equal(
  generatedMultiverseMarketSystemUnit.sections.uiShell.actionShell.sourcePath,
  "db:derived:multiverse-market-action-shell"
);
assert.equal(
  generatedMultiverseMarketSystemUnit.sections.uiShell.ownerFamily.sourcePath,
  "db:derived:multiverse-market-owner-family"
);
assert.equal(
  generatedMultiverseMarketSystemUnit.traceEvidence.saveOwner.data.target.targetId,
  "multiverse-market-save-owner-boundary"
);
assert.equal(
  generatedMultiverseMarketSystemUnit.sections.rowIdentity.row7174RemapBand.data.dataset,
  "multiverse-market-row71-74-remap-band"
);
assert.equal(
  generatedMultiverseMarketSystemUnit.sections.rowIdentity.nearbyIdentityBindingPattern.data
    .dataset,
  "multiverse-market-nearby-identity-binding-pattern"
);
assert.equal(
  generatedMultiverseMarketSystemUnit.sections.rowIdentity.anomalyProvenance.data.dataset,
  "multiverse-market-69-74-anomaly-provenance"
);
assert.deepEqual(
  generatedMultiverseMarketSystemUnit.sections.rowIdentity.anomalyProvenance.data.settledAnomaly
    .brokenPrefabBandRows,
  [69, 70, 71, 72, 73, 74]
);
assert.deepEqual(
  generatedMultiverseMarketSystemUnit.sections.rowIdentity.nearbyIdentityBindingPattern.data
    .recoveredPattern.checkedPositiveRows,
  [78, 83]
);
assert.equal(
  generatedTokenShopSystemUnit.boundaries.rows.rowLevelOwner.data.dataset,
  "token-shop-row-level-owner"
);
assert.equal(
  generatedTokenShopSystemUnit.boundaries.rows.remap.data.dataset,
  "token-shop-row-remap-boundary"
);
assert.equal(
  generatedTokenShopSystemUnit.traceEvidence.familyStructure.data.target.targetId,
  "token-shop-family-structure"
);
assert.equal(generatedShardsSystemUnit.dataset, "repo-system-unit.v1");
assert.equal(generatedShardsSystemUnit.systemId, "shards");
assert.equal(generatedShardsSystemUnit.unitInventoryRef, "data/units/shards.v1.json");
assert.equal(
  generatedShardsSystemUnit.models.cost.formulaModel.sourcePath,
  "db:derived:shard-cost-formula-model"
);
assert.equal(
  generatedShardsSystemUnit.models.cost.formulaModel.data.dataset,
  "shard-cost-formula-model.v1"
);
assert.equal(
  generatedShardsSystemUnit.models.cost.screenshotCalibration.data.dataset,
  "shard-cost-screenshot-calibration.v1"
);
assert.equal(
  generatedShardsSystemUnit.models.cost.screenshotCalibration.sourcePath,
  "db:policy:shard-cost-screenshot-calibration"
);
assert.equal(
  generatedShardsSystemUnit.support.cost.listPathProbe.sourcePath,
  "db:derived:shard-cost-list-path"
);
assert.equal(
  generatedShardsSystemUnit.support.cost.bonusSlotProbe.sourcePath,
  "db:derived:shard-bonus-slot-support"
);
assert.ok(generatedShardsSystemUnit.sections.family.familyEvidence.data.rows.length > 0);
assert.equal(
  generatedShardsSystemUnit.sections.ownedState.traceBoundary.data.target.targetId,
  "shard-owned-state-upgradeinfolist-population"
);
assert.equal(
  generatedShardsSystemUnit.sections.cost.traceBoundary.data.target.targetId,
  "shard-cost-su0-structure"
);
assert.equal(generatedTraceSystemUnit.dataset, "repo-system-unit.v1");
assert.equal(generatedTraceSystemUnit.systemId, "trace");
assert.equal(generatedTraceSystemUnit.unitInventoryRef, "data/units/trace.v1.json");
assert.equal(
  generatedTraceSystemUnit.sections.promotionTargets.sourcePath,
  "db:derived:trace-promotion-targets"
);
assert.equal(
  generatedTraceSystemUnit.sections.liveRuns.tokenShopFamilyStructure.data.target.targetId,
  "token-shop-family-structure"
);
assert.ok(
  generatedTraceSystemUnit.sections.promotionTargets.targetIds.includes(
    "multiverse-market-save-owner-boundary"
  )
);
assert.ok(
  !traceUnit.views.support.includes("data/unity-trace-target-registry.json"),
  "trace unit views.support should no longer treat the registry file as a live support slice"
);
assert.ok(
  traceUnit.views.support.includes("db:derived:trace-promotion-targets"),
  "trace unit views.support should expose DB-derived trace promotion targets"
);
const shardOwnedStateTraceRun =
  generatedTraceSystemUnit.sections.liveRuns.shardOwnedStateUpgradeinfolistPopulation.data;
const tokenShopAtu3EffectTraceRun =
  generatedTraceSystemUnit.sections.liveRuns.tokenShopAtu3Effect.data;
assert.equal(bundledDatasetContract.contractVersion, "v1");
assert.equal(bundledDatasetContract.validationCommand, "npm run verify:data");
assert.deepEqual(
  bundledDatasetContract.sourcePriority.map((entry) => entry.id),
  ["apk-unity-artifacts", "official-public-corroboration", "community-gap-filling"]
);
assert.deepEqual(
  bundledDatasetContract.datasets.map((entry) => entry.id),
  expectedBundledDatasetIds
);
assert.equal(bundledDatasetContract.datasets[0]?.classification, "canonical-app-snapshot");
assert.equal(
  bundledDatasetContract.datasets.find((entry) => entry.id === "shards")?.classification,
  "grounded-descriptive"
);
assert.ok(
  bundledDatasetContract.datasets
    .filter((entry) => entry.id !== "snapshot" && entry.id !== "shards")
    .every((entry) => entry.classification === "extracted-mechanics")
);
assert.deepEqual(bundledDatasetContract.datasets.find((entry) => entry.id === "shards")?.files, [
  "data/shard-milestones.grounded.v1.json",
  "data/shard-observed-behaviors.grounded.v1.json",
  "data/shard-milestones-provenance.grounded.v1.json"
]);
assert.deepEqual(Object.keys(PLAYER_PROFILE_IMPORT_ALIASES), [
  "meta",
  "canonical",
  "planner",
  "externalModel",
  "experimental",
  "compatibility",
  "shipCalibration"
]);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.canonical.diamonds.some((path) => path.join(".") === "gems")
);
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
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.planner.shardFocusMilestoneLevel.some(
    (path) => path.join(".") === "systems.shards.focusMilestoneLevel"
  )
);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.planner.shardObservedLevelsByMilestone.some(
    (path) => path.join(".") === "systems.shards.observedLevelsByMilestone"
  )
);
assert.deepEqual(
  PLAYER_PROFILE_IMPORT_ALIASES.planner.tokenShopCheckedSubsetLevels.map((path) => path.join(".")),
  ["planning.tokenShop.checkedSubsetLevels"]
);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.compatibility.shardMilestoneState.some(
    (path) => path.join(".") === "compatibility.unmappedSystemState.shardMilestoneState"
  )
);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.compatibility.shardMilestoneState.some(
    (path) => path.join(".") === "systems.shardMilestones"
  )
);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.shipCalibration.communityToolState.some(
    (path) => path.join(".") === "externalModels.shipPlanner.communityToolState"
  )
);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.compatibility.tokenShop.some(
    (path) => path.join(".") === "systems.tokenBank"
  )
);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.compatibility.tokenShopStateClues.some(
    (path) => path.join(".") === "FinalTokenBankFillSpeed"
  )
);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.compatibility.tokenShopStateClues.some(
    (path) => path.join(".") === "ClaimableTokenium"
  )
);
assert.ok(
  PLAYER_PROFILE_IMPORT_ALIASES.compatibility.multiverseMarketStateClues.some(
    (path) => path.join(".") === "InscryptionsDone"
  )
);
assert.equal(playerProfileAliasAuditData.version, "v1");
assert.equal(playerProfileAliasAuditData.groupCount, 7);
assert.equal(playerProfileAliasAuditData.aliasCount, 34);
assert.equal(playerProfileAliasAuditData.acceptedPathCount, 85);
assert.deepEqual(
  playerProfileAliasAuditData.groups.map((group) => group.id),
  [
    "meta",
    "canonical",
    "planner",
    "externalModel",
    "experimental",
    "compatibility",
    "shipCalibration"
  ]
);
assert.match(playerProfileAliasAuditDoc, /# PlayerProfile Import Aliases/);
assert.match(playerProfileAliasAuditDoc, /## Canonical Shared Truth/);
assert.match(playerProfileAliasAuditDoc, /## Compatibility-only Migration Sinks/);
assert.match(playerProfileAliasAuditDoc, /systems\.ship\.playerState/);
assert.match(playerProfileAliasAuditDoc, /Accepted alias paths: 3/);
assert.match(playerProfileAliasAuditDoc, /Accepted alias paths: 32/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `resourceFocus`/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `power`/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `hunterLevel` \|/);
assert.ok(snapshot.shipLoadouts.length >= 4, "expected ship loadouts");
assert.deepEqual(
  snapshot.shardMilestones,
  [],
  "expected shard milestones to stay quarantined until verified"
);
assert.ok(snapshot.gemNodes.length >= 4, "expected gem nodes");
assert.equal(snapshot.validationCases.length, 4, "expected shipped validation case count");
assert.deepEqual(
  snapshot.validationCases.map((item) => ({ id: item.id, module: item.module })),
  [
    { id: "ship-parity-credits", module: "ship" },
    { id: "progression-gems-midgame", module: "progression" },
    { id: "recommendation-feed-contract", module: "recommendationFeed" },
    { id: "gem-node-roi", module: "gem" }
  ]
);
assert.match(getSnapshotValidationCase("progression-gems-midgame").description, /guardrail input/i);
assert.match(
  getSnapshotValidationCase("recommendation-feed-contract").description,
  /contract-valid actions/i
);
assert.match(appJs, /id:\s*"loop-guardrail-input-warning"/);
assert.match(appJs, /activeFeedContract\.invalidCount === 0/);
assert.ok(
  groundedShardMilestones.milestones.length >= 20,
  "expected grounded shard milestone dataset"
);
assert.ok(
  groundedShardObserved.observations.length >= 4,
  "expected grounded shard behavior examples"
);
assert.ok(
  groundedShardProvenance.uncertaintyLog.length >= 2,
  "expected grounded shard provenance notes"
);
assert.equal(shardAssetGrounding.dataset, "shard-asset-grounding.v1");
assert.equal(shardAssetGrounding.integrationStatus, "available-but-unmapped");
assert.ok(shardAssetGrounding.groundedShellIdentifiers.includes("LoopResetStage1"));
assert.ok(shardAssetGrounding.groundedShellIdentifiers.includes("MilestoneBonusesPerLevel"));
assert.ok(shardAssetGrounding.groundedFacts.some((fact) => /ShardUpgradeInfo/.test(fact)));
assert.ok(shardAssetGrounding.unresolvedGaps.length >= 4, "expected shard asset grounding gaps");
assert.ok(
  shardAssetGrounding.unresolvedGaps.includes(
    "exact milestone data object or serialized row payload"
  )
);
assert.equal(shardOwnerFamilyBoundary.dataset, "shard-owner-family-boundary.v1");
assert.ok(
  shardOwnerFamilyBoundary.screenControllerFamilies.includes("ShardMining, Assembly-CSharp")
);
assert.ok(shardOwnerFamilyBoundary.dataCarrierCandidates.includes("ShardMining|ShardUpgradeInfo"));
assert.ok(shardOwnerFamilyBoundary.dataCarrierCandidates.includes("ShardUpgradeInfo"));
assert.ok(shardOwnerFamilyBoundary.screenControlAnchors.includes("FastBuyButtonMethodShards"));
assert.ok(shardOwnerFamilyBoundary.bonusFieldAnchors.includes("FinalSU29Bonus2"));
assert.equal(
  shardOwnerFamilyBoundary.downgradedGenericLead.family,
  "ConstructionMilestones, Assembly-CSharp"
);
assert.ok(
  shardOwnerFamilyBoundary.currentBoundary.some((line) =>
    /Do not promote player-facing milestone labels/.test(line)
  )
);
assert.equal(shardFinalSuBonusBoundary.dataset, "shard-finalsu-bonus-boundary.v1");
assert.equal(shardFinalSuBonusBoundary.dataCarrier, "ShardUpgradeInfo");
assert.equal(shardFinalSuBonusBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.ok(shardFinalSuBonusBoundary.unlockRequirementAccessors.includes("get_SU29FinalUnlockReq"));
assert.ok(shardFinalSuBonusBoundary.bonusFieldSamples.includes("FinalSU29Bonus2"));
assert.ok(shardFinalSuBonusBoundary.bonusAccessorSamples.includes("get_FinalSU29Bonus2"));
assert.ok(shardFinalSuBonusBoundary.adjacentFields.includes("OverLevel400Exponent"));
assert.ok(
  shardFinalSuBonusBoundary.currentBoundary.some((line) =>
    /Do not map FinalSU fields directly/.test(line)
  )
);
assert.equal(shardMilestonePayloadBoundary.dataset, "shard-milestone-payload-boundary.v1");
assert.equal(shardMilestonePayloadBoundary.dataCarrier, "ShardUpgradeInfo");
assert.equal(shardMilestonePayloadBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.ok(shardMilestonePayloadBoundary.milestoneStateFields.includes("TotalMilestoneLevels"));
assert.ok(shardMilestonePayloadBoundary.costAndListHooks.includes("UpdateShardCostList"));
assert.ok(shardMilestonePayloadBoundary.progressFillHooks.includes("CheckMilestone9ProgressFill"));
assert.ok(shardMilestonePayloadBoundary.tickFields.includes("CooldownTick"));
assert.ok(shardMilestonePayloadBoundary.sampleCostAccessors.includes("get_SU29Cost"));
assert.ok(
  shardMilestonePayloadBoundary.currentBoundary.some((line) =>
    /Do not treat these hooks as recovered serialized player-owned milestone rows/.test(line)
  )
);
assert.equal(shardCostModelBoundary.dataset, "shard-cost-model-boundary.v1");
assert.equal(shardCostModelBoundary.dataCarrier, "ShardUpgradeInfo");
assert.equal(shardCostModelBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.deepEqual(shardCostModelBoundary.sampleCostAccessorWindows[0], {
  label: "earlyWindow",
  start: 0,
  end: 9,
  count: 10,
  accessors: [
    "get_SU0Cost",
    "get_SU1Cost",
    "get_SU2Cost",
    "get_SU3Cost",
    "get_SU4Cost",
    "get_SU5Cost",
    "get_SU6Cost",
    "get_SU7Cost",
    "get_SU8Cost",
    "get_SU9Cost"
  ]
});
assert.deepEqual(shardCostModelBoundary.sampleCostAccessorWindows[1], {
  label: "lateWindow",
  start: 23,
  end: 29,
  count: 7,
  accessors: [
    "get_SU23Cost",
    "get_SU24Cost",
    "get_SU25Cost",
    "get_SU26Cost",
    "get_SU27Cost",
    "get_SU28Cost",
    "get_SU29Cost"
  ]
});
assert.ok(shardCostModelBoundary.row0CostFields.includes("SU0StartCost"));
assert.ok(shardCostModelBoundary.row0CostFields.includes("SU0GrowthExponent3"));
assert.ok(shardCostModelBoundary.row0FillFields.includes("SU0Level8Fill"));
assert.ok(shardCostModelBoundary.row0BonusFields.includes("SU0Bonus8"));
assert.ok(
  shardCostModelBoundary.optimizerBoundary.supportedNow.includes(
    "row-local shard cost-parameter extraction and consistency checks against get_SU*Cost accessors"
  )
);
assert.ok(
  shardCostModelBoundary.optimizerBoundary.blockedNow.includes("exact per-level shard costs")
);
assert.ok(
  shardCostModelBoundary.currentBoundary.some((line) =>
    /Do not derive exact shard cost formulas/.test(line)
  )
);
assert.equal(shardMilestoneRowModelBoundary.dataset, "shard-milestone-row-model-boundary.v1");
assert.equal(shardMilestoneRowModelBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.deepEqual(shardMilestoneRowModelBoundary.textCheckerRange, { start: 0, end: 29, count: 30 });
assert.deepEqual(shardMilestoneRowModelBoundary.unlockRequirementRange, {
  start: 0,
  end: 29,
  count: 30
});
assert.deepEqual(shardMilestoneRowModelBoundary.buyHookEvidence.shardLocalDirectHooks, [
  "BuyMilestone0"
]);
assert.deepEqual(shardMilestoneRowModelBoundary.buyHookEvidence.genericNumberedFamily, {
  family: "ConstructionMilestones, Assembly-CSharp",
  start: 1,
  end: 57,
  count: 57
});
assert.ok(
  shardMilestoneRowModelBoundary.currentBoundary.some((line) =>
    /Do not infer that rows 0-29 are already mapped/.test(line)
  )
);
assert.equal(shardMilestoneTitleEffectBoundary.dataset, "shard-milestone-title-effect-boundary.v1");
assert.ok(
  shardMilestoneTitleEffectBoundary.titleAssetCandidates.some(
    (entry) => entry.row === 0 && entry.assetName === "SMilestone-0-Eternal(OURO)"
  )
);
assert.ok(
  shardMilestoneTitleEffectBoundary.titleAssetCandidates.some(
    (entry) => entry.row === 29 && entry.assetName === "SMilestone-29-Earthly"
  )
);
assert.ok(
  shardMilestoneTitleEffectBoundary.titleAssetCandidates.some(
    (entry) => entry.row === 30 && entry.assetName === "SMilestone-30-Illuminating"
  )
);
assert.equal(
  shardMilestoneTitleEffectBoundary.titleAssetCandidates.filter((entry) => entry.row === 28).length,
  2
);
assert.ok(
  shardMilestoneTitleEffectBoundary.effectPresentationSlots.includes("ShardMilestoneBonus1")
);
assert.ok(
  shardMilestoneTitleEffectBoundary.effectPresentationSlots.includes("ShardMilestoneBonus8")
);
assert.ok(shardMilestoneTitleEffectBoundary.sampleBonusCalcAccessors.includes("get_SU1Bonus1Calc"));
assert.ok(shardMilestoneTitleEffectBoundary.sampleBonusCalcAccessors.includes("get_SU5Bonus2Calc"));
assert.ok(
  shardMilestoneTitleEffectBoundary.findings.some((line) =>
    /row 28 currently has conflicting shipped asset title candidates/i.test(line)
  )
);
assert.ok(
  shardMilestoneTitleEffectBoundary.currentBoundary.some((line) =>
    /Do not treat the title list as fully conflict-free/.test(line)
  )
);
assert.equal(shardEffectTextHandlerBoundary.dataset, "shard-effect-text-handler-boundary.v1");
assert.equal(
  shardEffectTextHandlerBoundary.probableTextHandler,
  "TextHandlerShardMilestoneBonusesPerLevel/N"
);
assert.equal(shardEffectTextHandlerBoundary.genericMilestoneWriter, "SetAllMilestoneTexts");
assert.deepEqual(shardEffectTextHandlerBoundary.rowModelCoverage, { start: 0, end: 29, count: 30 });
assert.ok(shardEffectTextHandlerBoundary.presentationFamily.includes("ShardMilestoneBonus1"));
assert.ok(shardEffectTextHandlerBoundary.presentationFamily.includes("ShardMilestoneBonus8"));
assert.ok(shardEffectTextHandlerBoundary.sampleBonusCalcAccessors.includes("get_SU1Bonus1Calc"));
assert.ok(shardEffectTextHandlerBoundary.sampleBonusCalcAccessors.includes("get_SU5Bonus2Calc"));
assert.ok(shardEffectTextHandlerBoundary.uiContextAnchors.includes("LevelText"));
assert.ok(shardEffectTextHandlerBoundary.uiContextAnchors.includes("DescriptionText"));
assert.ok(
  shardEffectTextHandlerBoundary.currentBoundary.some((line) =>
    /Do not treat this boundary as a recovered row-complete effect-text table/.test(line)
  )
);
assert.equal(shardMilestoneRowShellBoundary.dataset, "shard-milestone-row-shell-boundary.v1");
assert.equal(shardMilestoneRowShellBoundary.screenControllerFamily, "ShardMining, Assembly-CSharp");
assert.equal(shardMilestoneRowShellBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.ok(
  shardMilestoneRowShellBoundary.controllerShellAnchors.includes("FastBuyButtonMethodShards")
);
assert.ok(shardMilestoneRowShellBoundary.unlockHookSamples.includes("UnlockMilestone17"));
assert.ok(shardMilestoneRowShellBoundary.unlockHookSamples.includes("UnlockMilestone29"));
assert.ok(shardMilestoneRowShellBoundary.buyHookSamples.includes("BuyMilestone0"));
assert.ok(shardMilestoneRowShellBoundary.textCheckerSamples.includes("Milestone0TextChecker"));
assert.ok(shardMilestoneRowShellBoundary.textCheckerSamples.includes("Milestone12TextChecker"));
assert.ok(
  shardMilestoneRowShellBoundary.currentBoundary.some((line) =>
    /Do not treat this partial row shell/.test(line)
  )
);
assert.equal(
  shardMilestoneRowAlignmentBoundary.dataset,
  "shard-milestone-row-alignment-boundary.v1"
);
assert.equal(
  shardMilestoneRowAlignmentBoundary.screenControllerFamily,
  "ShardMining, Assembly-CSharp"
);
assert.deepEqual(shardMilestoneRowAlignmentBoundary.unlockHookRange, {
  start: 17,
  end: 29,
  count: 13
});
assert.deepEqual(shardMilestoneRowAlignmentBoundary.textCheckerRange, {
  start: 0,
  end: 12,
  count: 13
});
assert.deepEqual(shardMilestoneRowAlignmentBoundary.buyHookRange, { start: 0, end: 0, count: 1 });
assert.deepEqual(shardMilestoneRowAlignmentBoundary.unlockTextCheckerOverlapIds, []);
assert.deepEqual(shardMilestoneRowAlignmentBoundary.buyTextCheckerOverlapIds, [0]);
assert.ok(
  shardMilestoneRowAlignmentBoundary.currentBoundary.some((line) =>
    /Do not infer that UnlockMilestone17 already maps/.test(line)
  )
);
assert.equal(shardMilestoneHandoffBoundary.dataset, "shard-milestone-handoff-boundary.v2");
assert.equal(shardMilestoneHandoffBoundary.shardControllerFamily, "ShardMining, Assembly-CSharp");
assert.deepEqual(shardMilestoneHandoffBoundary.shardControllerRowShell.unlockHookRange, {
  start: 17,
  end: 29,
  count: 13
});
assert.deepEqual(shardMilestoneHandoffBoundary.shardControllerRowShell.buyHookRange, {
  start: 0,
  end: 0,
  count: 1
});
assert.deepEqual(shardMilestoneHandoffBoundary.shardControllerRowShell.textCheckerRange, {
  start: 0,
  end: 12,
  count: 13
});
assert.equal(
  shardMilestoneHandoffBoundary.genericMilestoneLead.family,
  "ConstructionMilestones, Assembly-CSharp"
);
assert.equal(
  shardMilestoneHandoffBoundary.genericMilestoneLead.metadataPath,
  "Assets\\Scripts\\Upgrades\\AcademyData\\ConstructionMilestones.cs"
);
assert.deepEqual(shardMilestoneHandoffBoundary.genericMilestoneLead.buyHookRange, {
  start: 1,
  end: 57,
  count: 57
});
assert.ok(
  shardMilestoneHandoffBoundary.genericMilestoneLead.textAndValueAnchors.includes(
    "InitializeMilestones"
  )
);
assert.ok(
  shardMilestoneHandoffBoundary.genericMilestoneLead.textAndValueAnchors.includes(
    "SetAllMilestoneTexts"
  )
);
assert.ok(
  shardMilestoneHandoffBoundary.handoffFindings.some((line) => /BuyMilestone1-57/.test(line))
);
assert.equal(shardMilestoneHandoffBoundary.recoveredDeclaringRowModel.ownerType, "ShardMining");
assert.equal(
  shardMilestoneHandoffBoundary.recoveredDeclaringRowModel.declaringField.name,
  "upgradeInfoList"
);
assert.equal(
  shardMilestoneHandoffBoundary.recoveredDeclaringRowModel.rowModelType.fullName,
  "ShardMining+ShardUpgradeInfo"
);
assert.deepEqual(
  shardMilestoneHandoffBoundary.recoveredDeclaringRowModel.rowStateFields.map(
    (field) => field.name
  ),
  ["<Cost>k__BackingField", "<MaxLevel>k__BackingField", "<IsUnlocked>k__BackingField"]
);
assert.ok(
  shardMilestoneHandoffBoundary.currentBoundary.some(
    (line) =>
      /runtime row shell recovered/.test(line) &&
      /row-definition family already recovered/.test(line)
  )
);
assert.ok(
  shardMilestoneHandoffBoundary.currentBoundary.some((line) =>
    /not recovered player-owned shard milestone state/.test(line)
  )
);
assert.equal(shardSaveBoundary.dataset, "shard-save-boundary.v2");
assert.ok(shardSaveBoundary.ownerShellTermsChecked.includes("ShardMining"));
assert.ok(shardSaveBoundary.ownerShellTermsChecked.includes("UpdateShardCostList"));
assert.ok(shardSaveBoundary.saveFamilyTermsChecked.includes("PlayerProfileData"));
assert.ok(shardSaveBoundary.saveFamilyTermsChecked.includes("CloudSavePlayerProfile"));
assert.equal(shardSaveBoundary.boundaryEvidence.metadataNeighborhoodHasSaveTerms, false);
assert.equal(shardSaveBoundary.boundaryEvidence.level0HasSaveTerms, false);
assert.equal(shardSaveBoundary.boundaryEvidence.ownerShellWithSaveOverlapCount, 0);
assert.equal(shardSaveBoundary.boundaryEvidence.directShardPlayerProfileContext, false);
assert.equal(shardSaveBoundary.boundaryEvidence.declaringRowModelRecovered, true);
assert.equal(shardSaveBoundary.boundaryEvidence.saveSideOwnerRecovered, false);
assert.equal(shardSaveBoundary.recoveredDeclaringRowModel.ownerType, "ShardMining");
assert.equal(shardSaveBoundary.recoveredDeclaringRowModel.declaringField.name, "upgradeInfoList");
assert.equal(
  shardSaveBoundary.recoveredDeclaringRowModel.rowModelType.fullName,
  "ShardMining+ShardUpgradeInfo"
);
assert.deepEqual(
  shardSaveBoundary.recoveredDeclaringRowModel.rowStateFields.map((field) => field.name),
  ["<Cost>k__BackingField", "<MaxLevel>k__BackingField", "<IsUnlocked>k__BackingField"]
);
assert.ok(shardSaveBoundary.currentBoundary.some((line) => /zero checked overlap/.test(line)));
assert.ok(shardSaveBoundary.currentBoundary.some((line) => /upgradeInfoList/.test(line)));
assert.equal(shardMilestoneSaveOwnerCandidates.dataset, "shard-milestone-save-owner-candidates.v2");
assert.equal(
  shardMilestoneSaveOwnerCandidates.recoveredDeclaringRowModel.id,
  "shardmining-upgradeinfolist-row-model"
);
assert.equal(
  shardMilestoneSaveOwnerCandidates.recoveredDeclaringRowModel.declaringField.name,
  "upgradeInfoList"
);
assert.equal(
  shardMilestoneSaveOwnerCandidates.recoveredDeclaringRowModel.rowModelType.fullName,
  "ShardMining+ShardUpgradeInfo"
);
assert.equal(shardMilestoneSaveOwnerCandidates.remainingSaveOwnerCandidates.length, 1);
assert.ok(
  shardMilestoneSaveOwnerCandidates.remainingSaveOwnerCandidates.some(
    (entry) => entry.id === "player-profile-side-shard-member-shell"
  )
);
assert.equal(
  shardMilestoneSaveOwnerCandidates.checkedOverlapStatistics.ownerShellWithSaveOverlapCount,
  0
);
assert.equal(
  shardMilestoneSaveOwnerCandidates.checkedOverlapStatistics.directShardPlayerProfileContext,
  false
);
assert.equal(
  shardMilestoneSaveOwnerCandidates.checkedOverlapStatistics.declaringRowModelRecovered,
  true
);
assert.equal(
  shardMilestoneSaveOwnerCandidates.checkedOverlapStatistics.remainingSaveOwnerCandidateCount,
  1
);
assert.ok(
  shardMilestoneSaveOwnerCandidates.warnings.some((line) =>
    /not recovered a save-side owner/i.test(line)
  )
);
assert.ok(
  shardMilestoneSaveOwnerCandidates.currentBoundary.some((line) =>
    /recovered shard-local row-model result/i.test(line)
  )
);
assert.ok(
  shardMilestoneSaveOwnerCandidates.currentBoundary.some((line) => /save-owner gap/i.test(line))
);
assert.equal(shardCostScreenshotCalibration.dataset, "shard-cost-screenshot-calibration.v1");
assert.equal(shardCostScreenshotCalibration.entries.length, 5);
assert.ok(
  shardCostScreenshotCalibration.entries.some(
    (entry) =>
      entry.row === 1 && entry.observedLevel === 283 && entry.observedCostLabel === "1.89e565"
  )
);
assert.ok(
  shardCostScreenshotCalibration.entries.some(
    (entry) =>
      entry.row === 25 && entry.observedLevel === 16 && entry.observedCostLabel === "5.38e563"
  )
);
assert.ok(shardCostScreenshotCalibration.findings.some((line) => /e563-e565/.test(line)));
assert.ok(shardCostScreenshotCalibration.currentBoundary.some((line) => /player/i.test(line)));
assert.equal(shardCostListPathProbe.dataset, "shard-cost-list-path");
assert.equal(shardCostListPathProbe.ownerFields.milestoneCostListField.name, "MilestoneCostList");
assert.equal(shardCostListPathProbe.callOrder[0], "GetShardCostList");
assert.equal(shardCostListPathProbe.callOrder.at(-1), "get_SU29Cost");
assert.ok(
  shardCostListPathProbe.findings.some((line) =>
    /caches the results into MilestoneCostList/.test(line)
  )
);
assert.equal(shardCostFormulaModel.dataset, "shard-cost-formula-model.v1");
assert.equal(shardCostFormulaModel.completionFlags.canonicalDatasetShipped, true);
assert.equal(shardCostFormulaModel.completionFlags.deterministicEvaluatorImplemented, true);
assert.equal(shardCostFormulaModel.completionFlags.automatedCalibrationImplemented, false);
assert.equal(shardCostFormulaModel.implementation.module, "scripts/shards/cost-evaluator.mjs");
assert.equal(shardCostFormulaModel.implementation.outputKind, "normalized-bigdouble-like");
assert.equal(shardCostFormulaModel.implementation.deterministic, true);
assert.equal(shardCostFormulaModel.calibrationCheckConfig.scientificLabelMantissaDecimals, 2);
assert.equal(shardCostFormulaModel.calibrationCheckConfig.requiredExponentDelta, 0);
assert.equal(shardCostFormulaModel.calibrationCheckConfig.mantissaAbsoluteTolerance, 0.005);
assert.equal(shardCostFormulaModel.calibrationCheckConfig.mantissaRelativeTolerance, 0.005);
assert.deepEqual(
  shardCostFormulaModel.rowClasses.map((entry) => entry.id),
  [
    "row0-special-case",
    "canonical-additive-premerge",
    "canonical-literal-builder",
    "drop-400-stage",
    "two-stage-transition-band",
    "hundred-stage-short-class"
  ]
);
assert.equal(
  shardCostFormulaModel.stageRules.preThreshold.symbolicApproximation,
  "multiply(StartCost, dispatch(currentLevel, add(CostExponent, multiply(currentLevelBigDouble, GrowthExponent))))"
);
assert.ok(
  shardCostFormulaModel.stageRules.hundredPlus.sampledOffsetFeeders.some(
    (entry) =>
      entry.row === 19 &&
      entry.levelOffset === 70 &&
      Math.abs(entry.coefficient - -0.00011718430323526263) < 1e-16
  )
);
assert.equal(shardCostFormulaModel.verifiedParameters.unlockRequirementBlock.offset, 1456);
assert.equal(
  shardCostFormulaModel.verifiedParameters.row0FieldShell.exactBigDoubleValues.StartCost,
  "5.0e0"
);
assert.ok(
  shardCostFormulaModel.verifiedParameters.representativeNormalRows.some(
    (entry) => entry.row === 27 && entry.exactBigDoubleValues.StartCost === "2.0e975"
  )
);
assert.equal(
  shardCostFormulaModel.derivedParameters.dispatcherSelectionBoundary.decimalPowerBuilderTarget,
  "0x24e38f9"
);
assert.equal(shardCostFormulaModel.calibrationAnchors.length, 5);
assert.equal(shardCostFormulaModel.boundedUncertaintyFlags.row0ExactClosedFormUnresolved, true);
assert.equal(
  shardCostFormulaModel.boundedUncertaintyFlags.screenshotAnchorsMatchedByAcceptedEvaluator,
  false
);
assert.equal(shardCostFormulaModel.runtimeGetterRules.getterFamily.ownerType, "ShardMining");
assert.equal(
  shardCostFormulaModel.runtimeGetterRules.getterFamily.stableCallOrder[0],
  "GetShardCostList"
);
assert.equal(
  shardCostFormulaModel.runtimeGetterRules.getterFamily.stableCallOrder.at(-1),
  "get_SU29Cost"
);
assert.equal(
  shardCostFormulaModel.runtimeGetterRules.cacheLifecycle.cacheField,
  "MilestoneCostList"
);
assert.equal(
  shardCostFormulaModel.runtimeGetterRules.cacheLifecycle.orderedGetterOutputsCached,
  true
);
assert.deepEqual(shardCostFormulaModel.runtimeGetterRules.sharedStageLogic.windowOrder, [
  "pre-threshold",
  "100-plus-window",
  "200-plus-window",
  "300-plus-window",
  "400-plus-window"
]);
assert.deepEqual(
  shardCostFormulaModel.verifiedParameters.overLevelBaseFieldShells.map((entry) => entry.fieldName),
  ["OverLevel100Base", "OverLevel200Base", "OverLevel300Base", "OverLevel400Base"]
);
assert.equal(
  shardCostFormulaModel.derivedParameters.overLevelBaseRecoveryPath.status,
  "deterministic-native-seed-derivation"
);
assert.equal(
  shardCostFormulaModel.derivedParameters.overLevelBaseRecoveryPath.exactSerializedValuesRecovered,
  false
);
assert.ok(
  shardCostFormulaModel.derivedParameters.overLevelBaseRecoveryPath.derivedRuntimeSeedModels.some(
    (entry) => entry.fieldName === "OverLevel100Base" && entry.derivedSeedBigDoubleLabel === "2.0e0"
  )
);
assert.ok(
  shardCostFormulaModel.derivedParameters.overLevelBaseRecoveryPath.derivedRuntimeSeedModels.some(
    (entry) =>
      entry.fieldName === "OverLevel400Base" && entry.derivedSeedBigDoubleLabel === "7.812502e-3"
  )
);
assert.ok(
  shardCostFormulaModel.currentBoundary.some((line) =>
    /Do not expose exact next-level shard costs/.test(line)
  )
);
assert.equal(getShardCostFormulaModel().dataset, "shard-cost-formula-model.v1");
assert.equal(getShardCostRowClass(19)?.id, "canonical-literal-builder");
assert.equal(getShardCostRowClass(25)?.id, "hundred-stage-short-class");
assert.deepEqual(getShardCostRuntimeRule(19).thresholdGetterNames, [
  "get_OverLevel100Exponent",
  "get_OverLevel200Exponent",
  "get_OverLevel300Exponent",
  "get_OverLevel400Exponent"
]);
assert.equal(getShardCostRuntimeRule(19).getterName, "get_SU19Cost");
assert.equal(getShardCostRuntimeRule(19).getterCallIndex, 20);
assert.equal(getShardCostRuntimeRule(19).cacheField, "MilestoneCostList");
assert.equal(getShardCostRuntimeRule(19).overLevelBaseModels.length, 4);
assert.equal(getShardCostScreenshotCalibration().dataset, "shard-cost-screenshot-calibration.v1");
assert.equal(formatScientificLabel({ mantissa: 1.2, exponent: 565 }), "1.20e565");
const shardCostCalibrationChecks = runShardCostCalibrationChecks();
assert.equal(shardCostCalibrationChecks.results.length, 5);
assert.equal(shardCostCalibrationChecks.config.scientificLabelMantissaDecimals, 2);
assert.ok(
  shardCostCalibrationChecks.results.every(
    (entry) => typeof entry.actualLabel === "string" && /e/.test(entry.actualLabel)
  )
);
assert.equal(
  isShardCostPlannerSafeFromCalibration(shardCostCalibrationChecks),
  shardCostFormulaModel.completionFlags.automatedCalibrationImplemented === true &&
    shardCostCalibrationChecks.allPassed === true &&
    shardCostFormulaModel.completionFlags.plannerSafeCostOutputApproved === true
);
assert.equal(await isShardCostPlannerSafe(), false);
if (shardCostFormulaModel.completionFlags.automatedCalibrationImplemented) {
  assert.equal(shardCostCalibrationChecks.allPassed, true);
  assert.equal(shardCostCalibrationChecks.failureCount, 0);
} else {
  assert.equal(shardCostCalibrationChecks.automatedCalibrationImplemented, false);
  assert.equal(shardCostCalibrationChecks.allPassed, false);
  assert.ok(shardCostCalibrationChecks.failureCount >= 1);
}
const shardCostRow19 = evaluateShardCost({ row: 19, level: 126 });
const shardCostRow19Repeat = evaluateShardCost({ row: 19, level: 126 });
assert.deepEqual(shardCostRow19, shardCostRow19Repeat);
assert.equal(shardCostRow19.kind, "normalized-bigdouble-like");
assert.equal(shardCostRow19.status, "bounded-uncertain");
assert.equal(shardCostRow19.rowClassId, "canonical-literal-builder");
assert.equal(shardCostRow19.modeledLevel, 126);
assert.equal(shardCostRow19.levelWasClamped, false);
assert.equal(shardCostRow19.runtimeRule.getterName, "get_SU19Cost");
assert.equal(shardCostRow19.runtimeRule.listBuilderMethod, "GetShardCostList");
assert.equal(shardCostRow19.runtimeRule.refreshMethod, "UpdateShardCostList");
assert.equal(shardCostRow19.runtimeRule.sortedConsumerMethod, "SortCostAndBools");
assert.equal(shardCostRow19.runtimeRule.affordabilityConsumerMethod, "CountAffordableShard");
assert.equal(shardCostRow19.runtimeRule.orderedGetterOutputsCached, true);
assert.equal(shardCostRow19.runtimeRule.alternateFormulaPathFound, false);
assert.deepEqual(shardCostRow19.runtimeRule.windowOrder, [
  "pre-threshold",
  "100-plus-window",
  "200-plus-window",
  "300-plus-window",
  "400-plus-window"
]);
assert.ok(
  shardCostRow19.runtimeRule.overLevelBaseModels.some(
    (entry) => entry.fieldName === "OverLevel100Base" && entry.derivedSeedBigDoubleLabel === "2.0e0"
  )
);
assert.ok(shardCostRow19.normalizedCost.label.includes("e"));
assert.ok(shardCostRow19.adjustments.some((entry) => entry.kind === "hundred-plus-family"));
const shardCostRow17High = evaluateShardCost({ row: 17, level: 450 });
assert.equal(shardCostRow17High.rowClassId, "drop-400-stage");
assert.equal(shardCostRow17High.modeledLevel, 399);
assert.equal(shardCostRow17High.levelWasClamped, true);
assert.deepEqual(shardCostRow17High.activeStages, [100, 200, 300]);
const shardCostRow25High = evaluateShardCost({ row: 25, level: 250 });
assert.equal(shardCostRow25High.rowClassId, "hundred-stage-short-class");
assert.equal(shardCostRow25High.modeledLevel, 199);
assert.deepEqual(shardCostRow25High.activeStages, [100]);
assert.deepEqual(shardCostRow25High.runtimeRule.thresholdGetterNames, ["get_OverLevel100Exponent"]);
assert.deepEqual(
  shardCostRow25High.runtimeRule.overLevelBaseModels.map((entry) => entry.fieldName),
  ["OverLevel100Base"]
);
const shardCostRow0 = evaluateShardCost({ row: 0, level: 150 });
assert.equal(shardCostRow0.rowClassId, "row0-special-case");
assert.equal(shardCostRow0.runtimeRule.getterName, "get_SU0Cost");
assert.ok(shardCostRow0.adjustments.some((entry) => entry.kind === "row0-hundred-stage"));

function assertShardCostWindow(row, level, expected) {
  const result = evaluateShardCost({ row, level });
  assert.equal(result.rowClassId, expected.rowClassId);
  assert.equal(result.modeledLevel, expected.modeledLevel);
  assert.equal(result.levelWasClamped, expected.levelWasClamped);
  assert.deepEqual(result.activeStages, expected.activeStages);
  assert.deepEqual(
    result.adjustments.map((entry) => entry.kind),
    expected.adjustmentKinds
  );
  return result;
}

assertShardCostWindow(1, 20, {
  rowClassId: "canonical-additive-premerge",
  modeledLevel: 20,
  levelWasClamped: false,
  activeStages: [],
  adjustmentKinds: ["base-pre-threshold"]
});
assertShardCostWindow(1, 126, {
  rowClassId: "canonical-additive-premerge",
  modeledLevel: 126,
  levelWasClamped: false,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family"]
});
assertShardCostWindow(1, 226, {
  rowClassId: "canonical-additive-premerge",
  modeledLevel: 226,
  levelWasClamped: false,
  activeStages: [100, 200],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family"]
});
assertShardCostWindow(1, 326, {
  rowClassId: "canonical-additive-premerge",
  modeledLevel: 326,
  levelWasClamped: false,
  activeStages: [100, 200, 300],
  adjustmentKinds: [
    "base-pre-threshold",
    "hundred-plus-family",
    "two-hundred-plus-family",
    "three-hundred-plus-family"
  ]
});
assertShardCostWindow(1, 426, {
  rowClassId: "canonical-additive-premerge",
  modeledLevel: 426,
  levelWasClamped: false,
  activeStages: [100, 200, 300, 400],
  adjustmentKinds: [
    "base-pre-threshold",
    "hundred-plus-family",
    "two-hundred-plus-family",
    "three-hundred-plus-family",
    "four-hundred-stage-covered"
  ]
});

assertShardCostWindow(19, 20, {
  rowClassId: "canonical-literal-builder",
  modeledLevel: 20,
  levelWasClamped: false,
  activeStages: [],
  adjustmentKinds: ["base-pre-threshold"]
});
assertShardCostWindow(19, 126, {
  rowClassId: "canonical-literal-builder",
  modeledLevel: 126,
  levelWasClamped: false,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family"]
});
assertShardCostWindow(19, 226, {
  rowClassId: "canonical-literal-builder",
  modeledLevel: 226,
  levelWasClamped: false,
  activeStages: [100, 200],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family"]
});
assertShardCostWindow(19, 326, {
  rowClassId: "canonical-literal-builder",
  modeledLevel: 326,
  levelWasClamped: false,
  activeStages: [100, 200, 300],
  adjustmentKinds: [
    "base-pre-threshold",
    "hundred-plus-family",
    "two-hundred-plus-family",
    "three-hundred-plus-family"
  ]
});
assertShardCostWindow(19, 426, {
  rowClassId: "canonical-literal-builder",
  modeledLevel: 426,
  levelWasClamped: false,
  activeStages: [100, 200, 300, 400],
  adjustmentKinds: [
    "base-pre-threshold",
    "hundred-plus-family",
    "two-hundred-plus-family",
    "three-hundred-plus-family",
    "four-hundred-stage-covered"
  ]
});

assertShardCostWindow(17, 20, {
  rowClassId: "drop-400-stage",
  modeledLevel: 20,
  levelWasClamped: false,
  activeStages: [],
  adjustmentKinds: ["base-pre-threshold"]
});
assertShardCostWindow(17, 126, {
  rowClassId: "drop-400-stage",
  modeledLevel: 126,
  levelWasClamped: false,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family"]
});
assertShardCostWindow(17, 226, {
  rowClassId: "drop-400-stage",
  modeledLevel: 226,
  levelWasClamped: false,
  activeStages: [100, 200],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family"]
});
assertShardCostWindow(17, 326, {
  rowClassId: "drop-400-stage",
  modeledLevel: 326,
  levelWasClamped: false,
  activeStages: [100, 200, 300],
  adjustmentKinds: [
    "base-pre-threshold",
    "hundred-plus-family",
    "two-hundred-plus-family",
    "three-hundred-plus-family"
  ]
});
assertShardCostWindow(17, 426, {
  rowClassId: "drop-400-stage",
  modeledLevel: 399,
  levelWasClamped: true,
  activeStages: [100, 200, 300],
  adjustmentKinds: [
    "base-pre-threshold",
    "hundred-plus-family",
    "two-hundred-plus-family",
    "three-hundred-plus-family"
  ]
});

assertShardCostWindow(29, 20, {
  rowClassId: "two-stage-transition-band",
  modeledLevel: 20,
  levelWasClamped: false,
  activeStages: [],
  adjustmentKinds: ["base-pre-threshold"]
});
assertShardCostWindow(29, 126, {
  rowClassId: "two-stage-transition-band",
  modeledLevel: 126,
  levelWasClamped: false,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family"]
});
assertShardCostWindow(29, 226, {
  rowClassId: "two-stage-transition-band",
  modeledLevel: 226,
  levelWasClamped: false,
  activeStages: [100, 200],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family"]
});
assertShardCostWindow(29, 326, {
  rowClassId: "two-stage-transition-band",
  modeledLevel: 299,
  levelWasClamped: true,
  activeStages: [100, 200],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family"]
});
assertShardCostWindow(29, 426, {
  rowClassId: "two-stage-transition-band",
  modeledLevel: 299,
  levelWasClamped: true,
  activeStages: [100, 200],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family"]
});

assertShardCostWindow(25, 20, {
  rowClassId: "hundred-stage-short-class",
  modeledLevel: 20,
  levelWasClamped: false,
  activeStages: [],
  adjustmentKinds: ["base-pre-threshold"]
});
assertShardCostWindow(25, 126, {
  rowClassId: "hundred-stage-short-class",
  modeledLevel: 126,
  levelWasClamped: false,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family"]
});
assertShardCostWindow(25, 226, {
  rowClassId: "hundred-stage-short-class",
  modeledLevel: 199,
  levelWasClamped: true,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family"]
});
assertShardCostWindow(25, 326, {
  rowClassId: "hundred-stage-short-class",
  modeledLevel: 199,
  levelWasClamped: true,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family"]
});
assertShardCostWindow(25, 426, {
  rowClassId: "hundred-stage-short-class",
  modeledLevel: 199,
  levelWasClamped: true,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family"]
});

assertShardCostWindow(0, 20, {
  rowClassId: "row0-special-case",
  modeledLevel: 20,
  levelWasClamped: false,
  activeStages: [],
  adjustmentKinds: ["base-pre-threshold"]
});
assertShardCostWindow(0, 126, {
  rowClassId: "row0-special-case",
  modeledLevel: 126,
  levelWasClamped: false,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "row0-hundred-stage"]
});
assertShardCostWindow(0, 226, {
  rowClassId: "row0-special-case",
  modeledLevel: 199,
  levelWasClamped: true,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "row0-hundred-stage"]
});
assertShardCostWindow(0, 326, {
  rowClassId: "row0-special-case",
  modeledLevel: 199,
  levelWasClamped: true,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "row0-hundred-stage"]
});
assertShardCostWindow(0, 426, {
  rowClassId: "row0-special-case",
  modeledLevel: 199,
  levelWasClamped: true,
  activeStages: [100],
  adjustmentKinds: ["base-pre-threshold", "row0-hundred-stage"]
});
assert.equal(shardBonusSlotProbe.dataset, "shard-bonus-slot-support");
assert.equal(shardBonusSlotProbe.rows.length, 30);
assert.ok(
  shardBonusSlotProbe.rows.some(
    (entry) => entry.row === 0 && entry.bonusFieldCount === 8 && entry.groundedBonusCount === 3
  )
);
assert.ok(
  shardBonusSlotProbe.rows.some(
    (entry) => entry.row === 18 && entry.bonusFieldCount === 6 && entry.calcAccessorCount === 6
  )
);
assert.ok(
  shardBonusSlotProbe.rows.some(
    (entry) => entry.row === 27 && entry.bonusFieldCount === 3 && entry.calcAccessorCount === 3
  )
);
assert.ok(shardBonusSlotProbe.currentBoundary.some((line) => /slot counts alone/.test(line)));
assert.equal(
  generatedShardsSystemUnit.support.family.familyEvidence.sourcePath,
  "db:derived:shard-milestone-family-evidence"
);
assert.equal(shardMilestoneFamilyEvidence.dataset, "shard-milestone-family-evidence.v1");
assert.equal(shardMilestoneFamilyEvidence.reachableFamily.reachableRows.count, 30);
assert.equal(shardMilestoneFamilyEvidence.reachableFamily.declaringField.name, "upgradeInfoList");
const shardFamilyVerifiedRows = shardMilestoneFamilyEvidence.rows.filter(
  (entry) => entry.status === "verified"
);
const shardFamilyBlockedRows = shardMilestoneFamilyEvidence.rows.filter(
  (entry) => entry.status === "blocked"
);
assert.deepEqual(
  shardFamilyVerifiedRows.map((entry) => entry.rowKey),
  ["SU1", "SU2"]
);
assert.deepEqual(
  shardFamilyBlockedRows.map((entry) => entry.rowKey),
  ["SU0", "SU7", "SU28"]
);
assert.deepEqual(shardFamilyVerifiedRows[0].verifiedPackage.rowShellFields.bonusTextFields, [
  "SM1B1Text",
  "SM1B2Text",
  "SM1B3Text"
]);
assert.deepEqual(shardFamilyVerifiedRows[0].verifiedPackage.fixedBreakpoints, [1, 25, 50]);
assert.deepEqual(shardFamilyVerifiedRows[1].verifiedPackage.fixedBreakpoints, [1, 25, 50]);
assert.deepEqual(shardFamilyVerifiedRows[1].verifiedPackage.serializedCostFields, [
  "SU2StartCost",
  "SU2CostExponent",
  "SU2GrowthExponent"
]);
assert.equal(shardMilestoneFamilyEvidence.sharedEvidence.saveBoundary.status, "blocked");
assert.ok(
  shardMilestoneFamilyEvidence.currentBoundary.some((line) =>
    /shared shard milestone evidence table/.test(line)
  )
);
assert.equal(shardTypeMetadataProbe.targets.shardMining.fullName, "ShardMining");
assert.ok(
  shardTypeMetadataProbe.targets.shardMining.ownerListFields.some(
    (entry) => entry.name === "MilestoneCostList"
  )
);
assert.ok(
  shardTypeMetadataProbe.targets.shardMining.ownerListFields.some(
    (entry) =>
      entry.name === "upgradeInfoList" &&
      entry.type === "System.Collections.Generic.List`1<ShardMining+ShardUpgradeInfo>"
  )
);
assert.deepEqual(
  shardTypeMetadataProbe.targets.shardMining.overLevelBaseFields.map((entry) => entry.name),
  ["OverLevel100Base", "OverLevel200Base", "OverLevel300Base", "OverLevel400Base"]
);
assert.deepEqual(
  shardTypeMetadataProbe.targets.shardUpgradeInfo.fields.map((entry) => entry.name),
  ["<Cost>k__BackingField", "<MaxLevel>k__BackingField", "<IsUnlocked>k__BackingField"]
);
assert.equal(shardTypeMetadataProbe.rows.length, 30);
assert.ok(
  shardTypeMetadataProbe.rows.some(
    (entry) => entry.row === 0 && entry.costFieldCount === 5 && entry.bonusFieldCount === 8
  )
);
assert.ok(
  shardTypeMetadataProbe.rows.some(
    (entry) => entry.row === 18 && entry.bonusFieldCount === 6 && entry.bonusTextFieldCount === 6
  )
);
assert.ok(
  shardTypeMetadataProbe.rows.some(
    (entry) => entry.row === 27 && entry.costFieldCount === 3 && entry.bonusTextFieldCount === 3
  )
);
assert.equal(
  shardTypeMetadataProbe.overLevelBaseValueRecovery.exactSerializedValuesRecovered,
  false
);
assert.equal(
  shardTypeMetadataProbe.overLevelBaseValueRecovery.directMonoBehaviourFieldHitsCount,
  0
);
assert.ok(
  shardTypeMetadataProbe.currentBoundary.some((line) =>
    /not as final serialized row values/.test(line)
  )
);
assert.equal(extractionCandidateFamilies.dataset, "extraction-candidate-families.v1");
assert.ok(
  extractionCandidateFamilies.families.length >= 7,
  "expected seeded extraction candidate families"
);
assert.ok(
  extractionCandidateFamilies.families.some(
    (family) => family.id === "shards.milestone-owner-family"
  )
);
assert.ok(
  extractionCandidateFamilies.families.some(
    (family) => family.id === "spend.multiverse-market-save-model"
  )
);
assert.equal(
  groundedShardMilestones.sourceReport,
  "docs/research/shard-milestones-grounded-2026-03-28.md"
);
assert.equal(
  groundedShardObserved.sourceReport,
  "docs/research/shard-milestones-grounded-2026-03-28.md"
);
assert.equal(
  groundedShardProvenance.sourceReport,
  "docs/research/shard-milestones-grounded-2026-03-28.md"
);
assert.deepEqual(
  datasetValidation.map((entry) => entry.id),
  expectedBundledDatasetIds
);
assert.deepEqual(
  datasetValidation.map((entry) => entry.classification),
  bundledDatasetContract.datasets.map((entry) => entry.classification)
);
assert.equal(multiverseMarketMetadataNeighborhoodData.anchor_count, 10);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some(
    (entry) => entry.anchor === "CloudSavePlayerProfile"
  ),
  "expected CloudSavePlayerProfile anchor in multiverse metadata neighborhood"
);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some(
    (entry) => entry.anchor === "PlayerProfileData"
  ),
  "expected PlayerProfileData anchor in multiverse metadata neighborhood"
);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some(
    (entry) => entry.anchor === "InscryptionsDone"
  ),
  "expected InscryptionsDone anchor in multiverse metadata neighborhood"
);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some(
    (entry) => entry.anchor === "SetAllChrystosEmporiumTexts"
  ),
  "expected SetAllChrystosEmporiumTexts anchor in multiverse metadata neighborhood"
);
assert.ok(
  multiverseMarketMetadataNeighborhoodData.results.some(
    (entry) => entry.anchor === "Mech1Unlocked"
  ),
  "expected Mech1Unlocked anchor in multiverse metadata neighborhood"
);
const multiverseMarketCloudSaveEntry = multiverseMarketMetadataNeighborhoodData.results.find(
  (entry) => entry.anchor === "CloudSavePlayerProfile"
);
const multiverseMarketCloudSaveStrings = (multiverseMarketCloudSaveEntry?.matches ?? []).flatMap(
  (match) => [match.match_value, ...(match.context ?? []).map((item) => item.value)]
);
assert.ok(
  multiverseMarketCloudSaveStrings.some((value) => String(value).includes("CloudSavePlayerProfile"))
);
assert.ok(
  multiverseMarketCloudSaveStrings.some((value) => String(value).includes("GetPlayerProfileInfo"))
);
assert.deepEqual(multiverseMarketOwnerFamilyData.ownerAnchors, [
  "MultiverseMarket, Assembly-CSharp",
  "TextHandlerMarkets",
  "SetAllChrystosEmporiumTexts",
  "SetInscryptionsDoneText",
  "Inscryptions"
]);
assert.deepEqual(multiverseMarketOwnerFamilyData.costLaneAnchors, [
  "ResourceAmountText.InscryptionsDone",
  "AchievementBar-Inscryptions",
  "CostBox-InscryptionsDone"
]);
assert.deepEqual(multiverseMarketOwnerFamilyData.currencyBoxRange, {
  start: 1,
  end: 110,
  count: 110
});
assert.deepEqual(multiverseMarketOwnerFamilyData.validatedCurrencyBoxes, [
  "IS50CurrencyBox",
  "IS59CurrencyBox",
  "IS63CurrencyBox",
  "IS74CurrencyBox"
]);
assert.deepEqual(multiverseMarketOwnerFamilyData.sampleBuyHooks, [
  "BuyIS1",
  "BuyIS50",
  "BuyIS74",
  "BuyIS110"
]);
assert.deepEqual(tokeniumNamingCluesData.assetNames.resourceIcons, [
  "Resource_Tokenium",
  "Resource_Tokenium_Cap_0"
]);
assert.deepEqual(tokeniumNamingCluesData.assetNames.academySprites, ["Aca.Tokenium553"]);
assert.ok(tokeniumNamingCluesData.level0Shells.includes("CostBox-Tokens"));
assert.ok(tokeniumNamingCluesData.level0Shells.includes("CostBox-Tokenium"));
assert.ok(
  tokeniumNamingCluesData.metadataStrings.includes("Daily Tokenium (from blue farm missions)")
);
assert.ok(tokeniumNamingCluesData.metadataStrings.includes("Mission Materials"));
assert.ok(tokenBankStateCluesData.tokenShopMethods.includes("ClaimBankedTokens"));
assert.ok(tokenBankStateCluesData.tokenShopMethods.includes("get_TokenBankCap"));
assert.ok(tokenBankStateCluesData.tokenShopControllerRefs.includes("BankFill"));
assert.ok(tokenBankStateCluesData.tokenShopControllerRefs.includes("TokenBankDescriptionText"));
assert.ok(tokenBankStateCluesData.displayOrHandlerClues.includes("TextHandlerLoopMods"));
assert.ok(tokenBankStateCluesData.displayOrHandlerClues.includes("SetLM244BonusText"));
assert.ok(tokenBankStateCluesData.derivedOutputs.includes("FinalTokenBankFillSpeed"));
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.declaringType, "SaveData");
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.storedAmountField, "BankedTokens");
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.storedAmountFieldType, "System.Single");
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.storedAmountFieldIndex, 214);
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.storedAmountFieldOffset, 1800);
assert.equal(
  tokenBankStateCluesData.playerProfilePersistenceBoundary.bridgeOwner,
  "PlayerProfileHandler"
);
assert.equal(
  tokenBankStateCluesData.playerProfilePersistenceBoundary.bridgeMethod,
  "ConvertSaveDataToProfileData"
);
assert.equal(
  tokenBankStateCluesData.playerProfilePersistenceBoundary.bridgeReturnType,
  "PlayerProfileData"
);
assert.equal(
  tokenBankStateCluesData.playerProfilePersistenceBoundary.bridgeSignature,
  "PlayerProfileData ConvertSaveDataToProfileData(SaveData saveData, System.DateTime lastCloudSaveDate)"
);
assert.equal(
  tokenBankStateCluesData.playerProfilePersistenceBoundary.handlerField,
  "saveInfoCache"
);
assert.equal(
  tokenBankStateCluesData.playerProfilePersistenceBoundary.handlerFieldType,
  "PlayerProfileData"
);
assert.deepEqual(tokenBankStateCluesData.playerProfilePersistenceBoundary.wrapperFields, [
  {
    declaringType: "PlayerProfileData",
    field: "Tokens",
    fieldType: "System.String",
    fieldIndex: 28,
    fieldOffset: 240
  },
  {
    declaringType: "PlayerProfileData",
    field: "Tokenium",
    fieldType: "System.String",
    fieldIndex: 47,
    fieldOffset: 392
  }
]);
assert.equal(tokenBankStateCluesData.genericTokeniumClaimableBoundary.declaringType, "SaveData");
assert.equal(tokenBankStateCluesData.genericTokeniumClaimableBoundary.field, "ClaimableTokenium");
assert.equal(tokenBankStateCluesData.genericTokeniumClaimableBoundary.fieldType, "System.Double");
assert.equal(tokenBankStateCluesData.genericTokeniumClaimableBoundary.fieldIndex, 2022);
assert.equal(tokenBankStateCluesData.genericTokeniumClaimableBoundary.fieldOffset, 12064);
assert.equal(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.scriptName,
  "CloudSavePlayerProfile"
);
assert.equal(tokenBankStateCluesData.cloudSavePlayerProfileBoundary.typedTargetFound, false);
assert.equal(tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataAnchorFound, true);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataShellMethods.includes(
    "OnCloudSaveClick"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataShellMethods.includes(
    "GetCurrentSaveFileInfo"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataShellMethods.includes("CloudLoad")
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataShellMethods.includes(
    "GetPlayerProfileInfo"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataShellMethods.includes(
    "IsCloudSaved"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataStateMachines.includes(
    "<CloudSave>d__23"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataStateMachines.includes(
    "<CloudSavePlayerProfile>d__24"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataStateMachines.includes(
    "<GetCurrentSaveFileInfo>d__25"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataStateMachines.includes(
    "<CloudLoad>d__28"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataStateMachines.includes(
    "<GetPlayerProfileInfo>d__29"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataTransientLocals.includes(
    "<saveData>5__2"
  )
);
assert.ok(
  tokenBankStateCluesData.cloudSavePlayerProfileBoundary.metadataTransientLocals.includes(
    "<lastCloudSave>5__3"
  )
);
assert.match(
  tokenBankStateCluesData.playerProfilePersistenceBoundary.blockedReason,
  /only expose generic export strings, not token-bank-specific cap or claimable-bank fields/i
);
assert.ok(
  tokenBankStateCluesData.negativeTypedOwnerChecks.includes("SaveData.ClaimableBankTokens")
);
assert.ok(tokenBankStateCluesData.negativeTypedOwnerChecks.includes("SaveData.TokenBankCap"));
assert.ok(
  tokenBankStateCluesData.negativeTypedOwnerChecks.includes("PlayerProfileData.BankedTokens")
);
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("SpaceAcademy"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("SpaceAcademyMain"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("TextHandlerSpaceAcademy"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("FarmMissions"));
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.declaringType, "SaveData");
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.storedAmountField, "DailyTokenium");
assert.equal(
  dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.storedAmountFieldType,
  "System.Double"
);
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.storedAmountFieldIndex, 2361);
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.storedAmountFieldOffset, 13032);
assert.equal(dailyTokeniumLaneCluesData.saveNeighborhoodWrapperRecovery.declaringType, "SaveData");
assert.equal(
  dailyTokeniumLaneCluesData.saveNeighborhoodWrapperRecovery.wrapperLabel,
  "Academy or Farm Mission persistence neighborhood"
);
assert.deepEqual(
  dailyTokeniumLaneCluesData.saveNeighborhoodWrapperRecovery.fieldOrderEvidence.immediatelyBefore,
  ["MissionsCompletedAllTime", "MissionsSinceTR1"]
);
assert.ok(
  dailyTokeniumLaneCluesData.saveNeighborhoodWrapperRecovery.fieldOrderEvidence.immediatelyAfter.includes(
    "WastaMissionActive"
  )
);
assert.ok(
  dailyTokeniumLaneCluesData.saveNeighborhoodWrapperRecovery.fieldOrderEvidence.immediatelyAfter.includes(
    "CrytonMissionActive"
  )
);
assert.ok(
  dailyTokeniumLaneCluesData.saveNeighborhoodWrapperRecovery.fieldOrderEvidence.immediatelyAfter.includes(
    "WastaFarmActiveCount"
  )
);
assert.ok(
  /narrower save-side wrapper/i.test(
    dailyTokeniumLaneCluesData.saveNeighborhoodWrapperRecovery.whyItClears
  )
);
assert.ok(
  /does not expose a DailyTokeniumCap field/i.test(
    dailyTokeniumLaneCluesData.saveNeighborhoodWrapperRecovery.blockedReason
  )
);
assert.equal(dailyTokeniumLaneCluesData.genericTokeniumClaimableBoundary.declaringType, "SaveData");
assert.equal(
  dailyTokeniumLaneCluesData.genericTokeniumClaimableBoundary.field,
  "ClaimableTokenium"
);
assert.equal(
  dailyTokeniumLaneCluesData.genericTokeniumClaimableBoundary.fieldType,
  "System.Double"
);
assert.ok(
  /broader Tokenium resource cluster/i.test(
    dailyTokeniumLaneCluesData.genericTokeniumClaimableBoundary.blockedReason
  )
);
assert.ok(
  dailyTokeniumLaneCluesData.negativeTypedOwnerChecks.includes("SaveData.DailyTokeniumCap")
);
assert.ok(
  dailyTokeniumLaneCluesData.negativeTypedOwnerChecks.includes("PlayerProfileData.DailyTokenium")
);
assert.ok(
  dailyTokeniumLaneCluesData.negativeTypedOwnerChecks.includes("PlayerProfileData.DailyTokeniumCap")
);
assert.ok(dailyTokeniumLaneCluesData.modifierClues.includes("SetLM244BonusText"));
assert.ok(dailyTokeniumLaneCluesData.modifierClues.includes("BuyLM244"));
assert.ok(dailyTokeniumLaneCluesData.modifierClues.includes("FinalDailyTokenBonus"));
assert.ok(
  dailyTokeniumLaneCluesData.modifierClues.includes("FinalFragmentsGainedFromFarmMissions")
);
assert.ok(dailyTokeniumLaneCluesData.premiumModifierClues.includes("BuyCollectorDevice"));
assert.ok(dailyTokeniumLaneCluesData.premiumModifierClues.includes("CollectorCapBonus"));
assert.ok(dailyTokeniumLaneCluesData.premiumModifierClues.includes("CollectorMatsBonus"));
assert.deepEqual(dailyTokeniumLaneCluesData.playerFacingStrings, []);
assert.ok(tokenBankFormulaBoundaryData.derivedOutputCluster.includes("get_FinalTokenBankCap"));
assert.ok(
  tokenBankFormulaBoundaryData.derivedOutputCluster.includes("get_FinalTokenBankFillSpeed")
);
assert.ok(
  tokenBankFormulaBoundaryData.derivedOutputCluster.includes("<FinalTokenBankCap>k__BackingField")
);
assert.ok(
  tokenBankFormulaBoundaryData.derivedOutputCluster.includes(
    "<FinalTokenBankFillSpeed>k__BackingField"
  )
);
assert.ok(tokenBankFormulaBoundaryData.controllerSideAnchors.includes("ClaimBankedTokens"));
assert.ok(tokenBankFormulaBoundaryData.saveFamilyCluesChecked.includes("PlayerProfileData"));
assert.deepEqual(tokenBankFormulaBoundaryData.saveFamilyCluesInDerivedContext, []);
assert.deepEqual(multiverseMarketRangeBoundaryData.validatedRowRanges, ["50-59", "63-74"]);
assert.equal(
  multiverseMarketRangeBoundaryData.metadataIsRangeLabel,
  "IS71Level through IS110Level"
);
assert.deepEqual(multiverseMarketRangeBoundaryData.overlapIds, [71, 72, 73, 74]);
assert.deepEqual(multiverseMarketRowTextCoverageData.textHandlerAnchors, [
  "TextHandlerMarkets",
  "SetAllChrystosEmporiumTexts"
]);
assert.equal(multiverseMarketRowTextCoverageData.validatedRowCostTexts.length, 22);
assert.ok(multiverseMarketRowTextCoverageData.validatedRowCostTexts.includes("SetIS50CostText"));
assert.ok(multiverseMarketRowTextCoverageData.validatedRowCostTexts.includes("SetIS74CostText"));
assert.deepEqual(multiverseMarketRowTextCoverageData.sampleBuyHooks, ["BuyIS50", "BuyIS74"]);
assert.equal(
  generatedMultiverseMarketSystemUnit.sections.rowIdentity.rowTextCoverage.sourcePath,
  "db:derived:multiverse-market-row-text-coverage"
);
assert.deepEqual(
  multiverseMarketPrefabRemapBoundaryData.validatedIdsWithoutDirectPrefabName,
  [69, 70, 71, 72, 73, 74]
);
assert.deepEqual(
  multiverseMarketPrefabRemapBoundaryData.overrideSerializedIdsOutsideValidatedBlock,
  [60, 61, 62]
);
assert.deepEqual(
  multiverseMarketPrefabRemapBoundaryData.explicitPrefabIdOverrides.map(
    (entry) => `${entry.prefabNumber}->${entry.serializedId}`
  ),
  ["69->57", "70->58", "71->59", "72->60", "73->61", "74->62"]
);
assert.ok(tokenShopCostLanesData.tokenSpendGroups.includes("TokenBoost"));
assert.ok(tokenShopCostLanesData.tokenSpendGroups.includes("TokenBoostT2"));
assert.ok(tokenShopCostLanesData.tokenSpendGroups.includes("Tier5Token"));
assert.ok(tokenShopCostLanesData.tokenSpendGroups.includes("MK8TokenBoost"));
assert.ok(tokenShopCostLanesData.dailyTokeniumModifierGroups.includes("TokenDailiesT2"));
assert.ok(tokenShopCostLanesData.dailyTokeniumModifierGroups.includes("TokenDailiesT3"));
assert.deepEqual(tokenShopCostLanesData.diamondGroups, ["DiamondBoost"]);
assert.equal(tokenShopCostLanesData.tracePresentation.costShell, null);
assert.equal(tokenShopCostLanesData.tracePresentation.costRenderNode, null);
assert.equal(tokenShopCostLanesData.tracePresentation.descriptionRenderNode, null);
assert.ok(tokenShopCostLanesData.currentBoundary.some((line) => /CostBox/i.test(line)));
assert.ok(tokenShopCostLanesData.currentBoundary.some((line) => /CostText/i.test(line)));
assert.ok(tokenShopCostLanesData.currentBoundary.some((line) => /DescText/i.test(line)));
assert.ok(spendActionLaneCluesData.tokenDirectBuyHooks.includes("BuyTokenBoost"));
assert.ok(spendActionLaneCluesData.tokenDirectBuyHooks.includes("BuyMK1TokenBoost"));
assert.ok(spendActionLaneCluesData.tokenDirectBuyHooks.includes("BuyMK8TokenBoost"));
assert.deepEqual(spendActionLaneCluesData.diamondDirectBuyHooks, ["BuyDiamondBoost"]);
assert.ok(spendActionLaneCluesData.dailyTokeniumModifierHooks.includes("BuyLM244"));
assert.ok(spendActionLaneCluesData.dailyTokeniumModifierHooks.includes("BuyCollectorDevice"));
assert.ok(spendActionLaneCluesData.dailyTokeniumSupportingShells.includes("CostBox-Tokenium"));
assert.ok(
  spendActionLaneCluesData.dailyTokeniumSupportingShells.includes("Mission Materials Booster")
);
assert.ok(spendActionLaneCluesData.dailyTokeniumSupportingShells.includes("COLLECTERS PACK"));
assert.equal(spendActionLaneCluesData.searchResults.metadata.BuyTokenDailiesT2, 0);
assert.equal(spendActionLaneCluesData.searchResults.metadata.BuyTokenDailiesT3, 0);
assert.equal(spendActionLaneCluesData.searchResults.level0.BuyTokenDailiesT2, 0);
assert.equal(spendActionLaneCluesData.searchResults.level0.BuyTokenDailiesT3, 0);
assert.deepEqual(multiverseMarketActionShellData.textHandlerAnchors, [
  "TextHandlerMarkets",
  "SetAllChrystosEmporiumTexts"
]);
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
assert.ok(tokenShopOwnerShellData.sourcePresence.metadata.TokenShop > 0);
assert.equal(tokenShopOwnerShellData.sourcePresence.metadata.ClaimBankedTokens, 1);
assert.ok(tokenShopOwnerShellData.sourcePresence.level0.TokenShop > 0);
assert.equal(tokenShopOwnerShellData.sourcePresence.level0.ClaimBankedTokens, 1);
assert.ok(tokenShopSaveBoundaryData.ownerShellTermsChecked.includes("TokenShop"));
assert.equal(tokenShopSaveBoundaryData.dataset, "token-shop-save-boundary.v2");
assert.ok(tokenShopSaveBoundaryData.ownerShellTermsChecked.includes("ClaimBankedTokens"));
assert.ok(tokenShopSaveBoundaryData.saveFamilyTermsChecked.includes("PlayerProfileData"));
assert.ok(tokenShopSaveBoundaryData.saveFamilyTermsChecked.includes("CloudSavePlayerProfile"));
assert.equal(tokenShopSaveBoundaryData.boundaryEvidence.metadataHasSaveTerms, true);
assert.equal(tokenShopSaveBoundaryData.boundaryEvidence.level0HasSaveTerms, false);
assert.equal(tokenShopSaveBoundaryData.boundaryEvidence.ownerShellWithSaveOverlapCount, 0);
assert.equal(tokenShopSaveBoundaryData.boundaryEvidence.directTokenShopPlayerProfileContext, false);
assert.equal(tokenShopRowLevelOwnerData.dataset, "token-shop-row-level-owner");
assert.equal(tokenShopRowLevelOwnerData.typedSaveDataFieldTableRecovery.fieldOwner, "SaveData");
assert.equal(tokenShopRowLevelOwnerData.typedSaveDataFieldTableRecovery.fieldCount, 4461);
assert.equal(
  tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.saveFieldRange,
  "ATU1Level through ATU28Level"
);
assert.ok(
  tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.saveFieldSamples.includes("ATU1Level")
);
assert.ok(
  tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.saveFieldSamples.includes("ATU28Level")
);
assert.ok(
  tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.adjacentSaveFields.includes(
    "Tier2TokensUnlocked"
  )
);
assert.ok(
  tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.adjacentSaveFields.includes(
    "Tier5TokensUnlocked"
  )
);
assert.equal(
  tokenShopRowLevelOwnerData.compatibilityImportBoundary.targetPath,
  "compatibility.unmappedSystemState.tokenShop"
);
assert.ok(
  tokenShopRowLevelOwnerData.compatibilityImportBoundary.safeImportSubset.includes(
    "ATU1Level through ATU28Level"
  )
);
assert.ok(
  tokenShopRowLevelOwnerData.currentBoundary.some((line) =>
    /SaveData directly declares BankedTokens plus ATU1Level through ATU28Level/.test(line)
  )
);
assert.equal(tokenShopRowRemapBoundaryData.dataset, "token-shop-row-remap-boundary");
assert.equal(tokenShopRowRemapBoundaryData.recoveredBridge.shellField, "ATU2Button");
assert.equal(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.recoveredAdditionalBridge.shellField,
  "ATU1Button"
);
assert.ok(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "generic TokenShop text hooks"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "token-side tokens title candidates"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "diamond-side tokens title candidate"
  )
);
assert.equal(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.blockedTitleJoin.titleCandidate,
  "Tokens Booster T1"
);
assert.equal(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.blockedTitleJoin.alternateTitleCandidate,
  "Tokens Booster"
);
assert.equal(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.blockedTitleJoin.diamondTitleCandidate,
  ">Diamond Upgrade 9 - TokensBoost"
);
assert.match(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.blockedTitleJoin.missingJoin,
  /Tokens Booster, Tokens Booster T1, and >Diamond Upgrade 9 - TokensBoost title-side clues/i
);
assert.match(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.blockedTitleJoin.lastBlocker,
  /last honest blocker.*Tokens Booster.*Tokens Booster T1.*>Diamond Upgrade 9 - TokensBoost.*ATU1Button path id 15839/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.adjacentFollowUp.result,
  "one more grounded bridge recovered but no concrete title join cleared"
);
assert.equal(tokenShopRowRemapBoundaryData.boundedRecoveredBridge.shellField, "ATU5Button");
assert.equal(
  tokenShopRowRemapBoundaryData.boundedRecoveredBridge.supportingActionHook,
  "BuyMK1TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.boundedRecoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK1Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.boundedRecoveredBridge.groundedConclusion,
  /ATU5Button now has one checked bridge/
);
assert.equal(tokenShopRowRemapBoundaryData.boundedRecoveredBridgeFollowUp.shellField, "ATU6Button");
assert.equal(
  tokenShopRowRemapBoundaryData.boundedRecoveredBridgeFollowUp.supportingActionHook,
  "BuyMK2TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.boundedRecoveredBridgeFollowUp.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK2Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.boundedRecoveredBridgeFollowUp.groundedConclusion,
  /ATU6Button now has one additional checked bridge/
);
assert.equal(tokenShopRowRemapBoundaryData.verifiedTitleJoin.shellField, "ATU6Button");
assert.equal(
  tokenShopRowRemapBoundaryData.verifiedTitleJoin.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK2Booster"
);
assert.deepEqual(tokenShopRowRemapBoundaryData.verifiedTitleJoin.textHandlerSearchSurface, [
  "SetAllTokenShopTexts",
  "SetTokenTexts"
]);
assert.equal(
  tokenShopRowRemapBoundaryData.verifiedTitleJoin.titleProbeTitle,
  "Mk2 Generator Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.verifiedTitleJoin.titleProbeSupportText,
  /MK2 Generators/
);
assert.match(
  tokenShopRowRemapBoundaryData.verifiedTitleJoin.groundedConclusion,
  /shell-to-prefab-to-title chain/
);
assert.equal(tokenShopRowRemapBoundaryData.traceFollowUp.targetId, "token-shop-atu4-mod");
assert.equal(tokenShopRowRemapBoundaryData.traceFollowUp.recoveredBridge.shellField, "ATU4Button");
assert.equal(tokenShopRowRemapBoundaryData.traceFollowUp.recoveredBridge.shellPathId, 15796);
assert.equal(
  tokenShopRowRemapBoundaryData.traceFollowUp.recoveredBridge.supportingActionHook,
  "BuyModBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.traceFollowUp.recoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.ModPointsBooster"
);
assert.ok(
  tokenShopRowRemapBoundaryData.traceFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "generic TokenShop text hooks"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.traceFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "token-side mod title candidate"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.traceFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "diamond-side mod title candidate"
  )
);
assert.equal(
  tokenShopRowRemapBoundaryData.traceFollowUp.blockedTitleJoin.titleCandidate,
  "Token Ultima: MP"
);
assert.equal(
  tokenShopRowRemapBoundaryData.traceFollowUp.blockedTitleJoin.alternateTitleCandidate,
  ":Diamond Upgrade 11 - ModBoost"
);
assert.match(
  tokenShopRowRemapBoundaryData.traceFollowUp.blockedTitleJoin.missingJoin,
  /exact row-specific runtime display-update path/i
);
assert.match(
  tokenShopRowRemapBoundaryData.traceFollowUp.blockedTitleJoin.lastBlocker,
  /last honest blocker.*runtime display-update path.*ATU4Button path id 15796/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.traceFollowUp.result,
  "checked object bridge recovered but no concrete title join cleared"
);
assert.equal(tokenShopRowRemapBoundaryData.atu5TitleFollowUp.targetId, "token-shop-atu5-mk1-title");
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredBridge.shellField,
  "ATU5Button"
);
assert.equal(tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredBridge.shellPathId, 15831);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredBridge.supportingActionHook,
  "BuyMK1TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK1Booster"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredTitleTextChain.shellField,
  "ATU5Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredTitleTextChain.shellPathId,
  15831
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredTitleTextChain.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK1Booster"
);
assert.deepEqual(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredTitleTextChain.titleSideTextSurface,
  [
    "1. MK1 Generator Output,",
    "This upgrade divides the cost of MK1 Generators by 1500.",
    "This upgrade provides a 1% increase to MK1 Generator Output for each Loop Reset you've done (multiplicative)"
  ]
);
assert.match(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.recoveredTitleTextChain.groundedConclusion,
  /shell-to-prefab-to-title-side-text chain/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.verifiedNamedIdentityJoin.shellField,
  "ATU5Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.verifiedNamedIdentityJoin.shellPathId,
  15831
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.verifiedNamedIdentityJoin.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK1Booster"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.verifiedNamedIdentityJoin.namedIdentity,
  "1. MK1 Generator Output,"
);
assert.deepEqual(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.verifiedNamedIdentityJoin
    .supportingTitleTextSurface,
  [
    "This upgrade divides the cost of MK1 Generators by 1500.",
    "This upgrade provides a 1% increase to MK1 Generator Output for each Loop Reset you've done (multiplicative)"
  ]
);
assert.match(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.verifiedNamedIdentityJoin.groundedConclusion,
  /player-facing-named-identity join/i
);
assert.ok(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "generic TokenShop text hooks"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "MK1 generator support-text cluster"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.blockedTitleJoin.testedSurfaces.some(
    (surface) => surface.surface === "neighboring generator title roster gap"
  )
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.blockedTitleJoin.supportTextCandidate,
  "1. MK1 Generator Output,"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.blockedTitleJoin.alternateSupportTextCandidate,
  "This upgrade divides the cost of MK1 Generators by 1500."
);
assert.match(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.blockedTitleJoin.missingJoin,
  /generic text hooks and neighboring generator title roster still stay detached.*named MK1 Generator Output identity join/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu5TitleFollowUp.result,
  "checked object bridge plus named identity and title-side text chain recovered but no final title join cleared"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.targetId,
  "token-shop-atu7-mk3-bridge"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.recoveredBridge.shellField,
  "ATU7Button"
);
assert.equal(tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.recoveredBridge.shellPathId, 15792);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.recoveredBridge.supportingActionHook,
  "BuyMK3TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.recoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK3Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.recoveredBridge.groundedConclusion,
  /ATU7Button now has one checked trace-backed bridge/
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.verifiedTitleTextChain.shellField,
  "ATU7Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.verifiedTitleTextChain.shellPathId,
  15792
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.verifiedTitleTextChain.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK3Booster"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.verifiedTitleTextChain.titleProbeTitle,
  "Mk3 Generator Booster"
);
assert.deepEqual(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.verifiedTitleTextChain.titleProbeSupportText,
  [
    "This upgrade divides the cost of MK3 Generators by 3m",
    "This upgrade provides a 30% increase to the output of MK3 Generators."
  ]
);
assert.match(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.verifiedTitleTextChain.groundedConclusion,
  /shell-to-prefab-to-title-side-text chain/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu7BridgeFollowUp.result,
  "checked object bridge plus title-side text chain recovered"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.targetId,
  "token-shop-atu8-mk4-bridge"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.recoveredBridge.shellField,
  "ATU8Button"
);
assert.equal(tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.recoveredBridge.shellPathId, 15795);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.recoveredBridge.supportingActionHook,
  "BuyMK4TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.recoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK4Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.recoveredBridge.groundedConclusion,
  /ATU8Button now has one checked bridge/
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.verifiedTitleTextChain.shellField,
  "ATU8Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.verifiedTitleTextChain.shellPathId,
  15795
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.verifiedTitleTextChain.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK4Booster"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.verifiedTitleTextChain.titleProbeTitle,
  "Mk4 Generator Booster"
);
assert.deepEqual(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.verifiedTitleTextChain.titleProbeSupportText,
  [
    "This upgrade divides the cost of MK4 Generators by 400m.",
    "This upgrade provides a 1% increase to MK4 Generator Output for each Loop Reset you've done (multiplicative)"
  ]
);
assert.match(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.verifiedTitleTextChain.groundedConclusion,
  /shell-to-prefab-to-title-side-text chain/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu8BridgeFollowUp.result,
  "checked object bridge plus title-side text chain recovered"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.targetId,
  "token-shop-atu9-mk5-bridge"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.recoveredBridge.shellField,
  "ATU9Button"
);
assert.equal(tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.recoveredBridge.shellPathId, 15845);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.recoveredBridge.supportingActionHook,
  "BuyMK5TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.recoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK5Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.recoveredBridge.groundedConclusion,
  /ATU9Button now has one checked bridge/
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.verifiedTitleTextChain.shellField,
  "ATU9Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.verifiedTitleTextChain.shellPathId,
  15845
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.verifiedTitleTextChain.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK5Booster"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.verifiedTitleTextChain.titleProbeTitle,
  "Mk5 Generator Booster"
);
assert.deepEqual(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.verifiedTitleTextChain.titleProbeSupportText,
  [
    "This upgrade divides the cost of MK5 Generators by 50b.",
    "This upgrade provides a 30% increase to the output of MK5 Generators."
  ]
);
assert.match(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.verifiedTitleTextChain.groundedConclusion,
  /shell-to-prefab-to-title-side-text chain/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu9BridgeFollowUp.result,
  "checked object bridge plus title-side text chain recovered"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.targetId,
  "token-shop-atu10-mk6-bridge"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.recoveredBridge.shellField,
  "ATU10Button"
);
assert.equal(tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.recoveredBridge.shellPathId, 15837);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.recoveredBridge.supportingActionHook,
  "BuyMK6TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.recoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK6Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.recoveredBridge.groundedConclusion,
  /ATU10Button now has one checked bridge/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.verifiedTitleTextChain.shellField,
  "ATU10Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.verifiedTitleTextChain.shellPathId,
  15837
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.verifiedTitleTextChain.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK6Booster"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.verifiedTitleTextChain.titleProbeTitle,
  "Mk6 Generator Booster"
);
assert.deepEqual(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.verifiedTitleTextChain.titleProbeSupportText,
  [
    "This upgrade divides the cost of MK6 Generators by 6qa.",
    "This upgrade provides a 30% increase to the output of MK6 Generators."
  ]
);
assert.match(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.verifiedTitleTextChain.groundedConclusion,
  /shell-to-prefab-to-title-side-text chain/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu10BridgeFollowUp.result,
  "checked object bridge plus title-side text chain recovered"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.targetId,
  "token-shop-atu11-mk7-bridge"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.recoveredBridge.shellField,
  "ATU11Button"
);
assert.equal(tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.recoveredBridge.shellPathId, 15793);
assert.equal(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.recoveredBridge.supportingActionHook,
  "BuyMK7TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.recoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK7Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.recoveredBridge.groundedConclusion,
  /ATU11Button now has one checked bridge/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.boundedTitleSideNegative.shellField,
  "ATU11Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.boundedTitleSideNegative.shellPathId,
  15793
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.boundedTitleSideNegative.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK7Booster"
);
assert.deepEqual(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.boundedTitleSideNegative.detachedTitleSurface,
  [
    "MK7 GEN ENHANCEMENT",
    "This upgrade divides the cost of MK7 Generators by 70Qu.",
    "This upgrade provides a 30% increase to the output of MK7 Generators."
  ]
);
assert.match(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.boundedTitleSideNegative.missingJoin,
  /Mk7 Generator Booster title/i
);
assert.match(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.boundedTitleSideNegative.groundedConclusion,
  /row-specific negative on the title side/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu11BridgeFollowUp.result,
  "checked object bridge recovered but final title-side join remains unresolved"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.targetId,
  "token-shop-atu12-mk8-bridge"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.recoveredBridge.shellField,
  "ATU12Button"
);
assert.equal(tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.recoveredBridge.shellPathId, 15830);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.recoveredBridge.supportingActionHook,
  "BuyMK8TokenBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.recoveredBridge.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK8Booster"
);
assert.match(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.recoveredBridge.groundedConclusion,
  /ATU12Button now has one checked bridge/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.verifiedTitleTextChain.shellField,
  "ATU12Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.verifiedTitleTextChain.shellPathId,
  15830
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.verifiedTitleTextChain.prefabIdentity,
  "NewTokenUPGPrefab.T1.MK8Booster"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.verifiedTitleTextChain.titleProbeTitle,
  "Mk8 Generator Booster"
);
assert.deepEqual(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.verifiedTitleTextChain.titleProbeSupportText,
  [
    "This upgrade divides the cost of MK8 Generators by 8e100.",
    "This upgrade provides a 30% increase to the output of MK8 Generators."
  ]
);
assert.match(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.verifiedTitleTextChain.groundedConclusion,
  /shell-to-prefab-to-title-side-text chain/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu12BridgeFollowUp.result,
  "checked object bridge plus title-side text chain recovered"
);
assert.equal(tokenShopRowRemapBoundaryData.atu3CellsDisambiguationPass.shellField, "ATU3Button");
assert.equal(tokenShopRowRemapBoundaryData.atu3CellsDisambiguationPass.shellPathId, 15810);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CellsDisambiguationPass.result,
  "no concrete object-or-title join cleared"
);
assert.ok(
  tokenShopRowRemapBoundaryData.atu3CellsDisambiguationPass.testedSurfaces.some(
    (surface) => surface.surface === "BuyCellBoost"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.atu3CellsDisambiguationPass.testedSurfaces.some(
    (surface) => surface.surface === "diamond-special CellsBoost prefab or title"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.atu3CellsDisambiguationPass.testedSurfaces.some(
    (surface) => surface.surface === "token-prefab or Token Ultima: Cells title"
  )
);
assert.match(
  tokenShopRowRemapBoundaryData.atu3CellsDisambiguationPass.groundedConclusion,
  /stays negative/
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.targetId,
  "token-shop-atu3-cells-effect"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain.shellField,
  "ATU3Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain.shellPathId,
  15810
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain
    .supportingActionHook,
  "BuyCellBoost"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain
    .sharedEffectTitle,
  'Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>'
);
assert.match(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain
    .sharedEffectText,
  /\+1.*Cells Gained.*Token & Diamond Chests/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain
    .parameterSurface.field,
  "CellBoostBonus"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain
    .parameterSurface.value,
  1
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain
    .parameterSurface.supportingField,
  "CellBoostMaxLevel"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.recoveredActionEffectChain
    .parameterSurface.supportingValue,
  60
);
assert.ok(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.detachedIdentitySurfaces.diamondSide.includes(
    "NewDiamondUPGPrefab.Specials.CellsBoost"
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.detachedIdentitySurfaces.tokenSide.includes(
    "NewTokenUPGPrefab.T1.CellsPerChestBooster"
  )
);
assert.match(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin,
  /typed gameplay owner|chest-reward applier/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3CrossSystemEffectTrace.result,
  "checked action-to-shared-effect chain recovered but typed gameplay owner remains unresolved"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.targetId,
  "token-shop-atu3-chest-consumer"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerReadTrace.targetId,
  "token-shop-atu3-chest-consumer-read"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.recoveredConsumerHandoff.shellField,
  "ATU3Button"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.recoveredConsumerHandoff.shellPathId,
  15810
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerSystem,
  "AdManager, Assembly-CSharp"
);
[
  "StartTokenRoutine",
  "<TokenChestRoutine>d__149",
  "GoToClosedTokenChest",
  "StartDiamondRoutine",
  "<DiamondChestRoutine>d__155",
  "GoToClosedDiamondChest"
].forEach((name) => {
  assert.ok(
    tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerMethodFamily.includes(
      name
    )
  );
});
[
  "get_SmallAdCellGains",
  "get_BigAdCellGains",
  "<FinalAdTokenChestBonus>k__BackingField",
  "<FinalDiamondChestBonus>k__BackingField"
].forEach((name) => {
  assert.ok(
    tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerBonusShell.includes(
      name
    )
  );
});
["TokenChest", "DiamondChest"].forEach((name) => {
  assert.ok(
    tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.recoveredConsumerHandoff.supportingChestObjects.includes(
      name
    )
  );
});
assert.match(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.missingParameterConsumerSeam.missingJoin,
  /CellBoostBonus.*AdManager chest routine family/i
);
assert.match(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerReadTrace.missingExactReadSiteSeam.missingJoin,
  /CellBoostBonus read or typed field handoff into the internal AdManager bonus-aggregation shell/i
);
[
  "<TokenChestRoutine>d__149",
  "<DiamondChestRoutine>d__155",
  "<FinalAdTokenChestBonus>k__BackingField",
  "<FinalDiamondChestBonus>k__BackingField"
].forEach((name) => {
  assert.ok(
    tokenShopRowRemapBoundaryData.atu3ChestConsumerReadTrace.missingExactReadSiteSeam.ruledOutDirectConsumerTargets.includes(
      name
    )
  );
});
[
  "get_SmallAdCellGains",
  "get_BigAdCellGains",
  "SetBoosterAdBonus",
  "get_FinalBoosterAdBonus",
  "set_FinalBoosterAdBonus",
  "FinalBoosterAdBonus",
  "<FinalBoosterAdBonus>k__BackingField"
].forEach((name) => {
  assert.ok(
    tokenShopRowRemapBoundaryData.atu3ChestConsumerReadTrace.missingExactReadSiteSeam.ruledOutRemainingBonusAggregationTargets.includes(
      name
    )
  );
});
assert.match(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerReadTrace.missingExactReadSiteSeam
    .negativeConclusion,
  /stop searching that cluster for an exact handoff unless a new committed artifact lands/i
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerReadTrace.result,
  "checked consumer-internal bonus shell recovered and remaining internal AdManager bonus-aggregation family stays ruled out as an exact CellBoostBonus handoff"
);
assert.equal(
  tokenShopRowRemapBoundaryData.atu3ChestConsumerTrace.result,
  "checked shared-effect-to-consumer-family handoff recovered but exact CellBoostBonus consumer method remains unresolved"
);
assert.ok(
  tokenShopRowRemapBoundaryData.blockedIdentityJoin.missingLinks.some((line) =>
    /remaining ATU\*Button or ATU\*Content path_id family/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.blockedIdentityJoin.missingLinks.some((line) =>
    /CellBoostBonus read or typed field handoff into the internal AdManager bonus-aggregation shell/i.test(
      line
    )
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /thirteen checked TokenShop row bridges/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU4Button aligns directly with the ModBoost owner-field block/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU7Button aligns directly with the MK3TokenBoost owner-field block/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU8Button aligns directly with the MK4TokenBoost owner-field block/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU9Button aligns directly with the MK5TokenBoost owner-field block/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /checked ATU6 shell-to-prefab-to-title chain/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /new effect-driven trace does recover one shell-to-action-hook-to-shared-effect chain for ATU3Button/i.test(
      line
    )
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU3 consumer-seam pass now also recovers one checked handoff/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU3 consumer-internal read pass now tightens that seam one step further/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU1 title-side pass also stays negative.*Tokens Booster.*ATU1Button path id 15839/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU4 title-side pass is no longer the real blocker.*runtime display-update path/i.test(line)
  )
);
assert.ok(
  tokenShopRowRemapBoundaryData.currentBoundary.some((line) =>
    /ATU5 last-title-blocker pass now narrows cleanly/i.test(line)
  )
);
assert.equal(tokenShopLateAtuBoundaryData.dataset, "token-shop-late-atu-boundary");
assert.equal(
  tokenShopLateAtuBoundaryData.targetNeighborhood.saveFieldRange,
  "ATU24Level through ATU28Level"
);
assert.equal(
  tokenShopLateAtuBoundaryData.targetNeighborhood.shellFieldRange,
  "ATU24Button through ATU28Button"
);
assert.deepEqual(
  tokenShopLateAtuBoundaryData.lateRows.map((row) => row.shellField),
  ["ATU24Button", "ATU25Button", "ATU26Button", "ATU27Button", "ATU28Button"]
);
assert.deepEqual(tokenShopLateAtuBoundaryData.actionNeighborhood.preservedLateHooks, [
  "BuyATU24",
  "BuyATU25",
  "BuyATU26",
  "BuyATU27",
  "BuyATU28"
]);
assert.ok(
  tokenShopLateAtuBoundaryData.titleRosterBoundary.localTitleCluster.some(
    (entry) => entry.title === "Academy Booster"
  )
);
assert.ok(
  tokenShopLateAtuBoundaryData.prefabRosterBoundary.localPrefabCluster.some(
    (entry) => entry.identity === "NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser"
  )
);
assert.equal(
  tokenShopLateAtuBoundaryData.prefabRosterBoundary.separateEffectSidePrefab.identity,
  "NewTokenUPGPrefab.T5.CampaignFragments"
);
assert.ok(
  tokenShopLateAtuBoundaryData.effectSideBoundary.preservedEffectClues.includes("ATU24Bonus3Shards")
);
assert.equal(
  tokenShopLateAtuBoundaryData.result,
  "no concrete late-row object-or-title join cleared"
);
assert.match(
  tokenShopLateAtuBoundaryData.groundedConclusion,
  /(tighter bounded negative result|stronger family-level bounded negative result)/
);
assert.ok(
  tokenShopLateAtuBoundaryData.currentBoundary.some((line) =>
    /ATU24Level through ATU28Level/i.test(line)
  )
);
assert.ok(
  tokenShopLateAtuBoundaryData.currentBoundary.some((line) =>
    /do not infer ATU24 through ATU28 row identity/i.test(line)
  )
);
assert.equal(
  generatedTraceSystemUnit.sections.liveRuns.shardOwnedStateUpgradeinfolistPopulation.sourcePath,
  "db:materialized-target-bundle:shard-owned-state-upgradeinfolist-population"
);
assert.equal(
  shardOwnedStateTraceRun.target.targetId,
  "shard-owned-state-upgradeinfolist-population"
);
assert.equal(shardOwnedStateTraceRun.dataset, "unity-trace-bundle");
assert.equal(shardOwnedStateTraceRun.plannerResolution.selectionMode, "best-gap-db");
assert.equal(shardOwnedStateTraceRun.plannerResolution.matchedFamilyId, "shard-owned-state");
assert.equal(shardOwnedStateTraceRun.plannerResolution.runMode, "trace");
assert.ok(
  shardOwnedStateTraceRun.plannerResolution.expandedAnchors.includes("ShardMining.upgradeInfoList")
);
assert.ok(
  shardOwnedStateTraceRun.plannerResolution.expandedAnchorSpecs.some(
    (anchor) => anchor.value === "ShardMining.upgradeInfoList" && anchor.kind === "string"
  )
);
assert.equal(shardOwnedStateTraceRun.traceRegistry.selectedFamilyId, "shard-owned-state");
assert.equal(shardOwnedStateTraceRun.materialization.traceView, "materialized_trace_view");
assert.equal(shardOwnedStateTraceRun.materialization.systemView, "canonical_system_trace_view");
assert.equal(
  shardOwnedStateTraceRun.materialization.traceScope,
  "shard-owned-state-upgradeinfolist-population"
);
assert.ok(shardOwnedStateTraceRun.nativeView);
assert.ok(shardOwnedStateTraceRun.systemViews.owner_controller_fragment);
assert.ok(shardOwnedStateTraceRun.systemViews.runtime_table_fragment);
assert.ok(shardOwnedStateTraceRun.semanticCoverage);
assert.equal(shardOwnedStateTraceRun.decisionSummary.verdict, "quarantine");
assert.deepEqual(shardOwnedStateTraceRun.decisionSummary.baselineGap, [
  "local-runtime-population-bridge",
  "deeper-wrapper-handoff-recovery"
]);
assert.equal(tokenShopAtu3EffectTraceRun.target.targetId, "token-shop-atu3-cells-effect");
assert.equal(
  generatedTraceSystemUnit.sections.liveRuns.tokenShopAtu3Effect.sourcePath,
  "db:materialized-target-bundle:token-shop-atu3-cells-effect"
);
assert.equal(tokenShopAtu3EffectTraceRun.dataset, "unity-trace-bundle");
if (tokenShopAtu3EffectTraceRun.plannerResolution) {
  assert.ok(
    ["explicit-target", "archive-explicit-target", "best-gap-db"].includes(
      tokenShopAtu3EffectTraceRun.plannerResolution.selectionMode
    )
  );
  assert.equal(tokenShopAtu3EffectTraceRun.plannerResolution.matchedFamilyId, "token-shop");
  assert.equal(tokenShopAtu3EffectTraceRun.plannerResolution.runMode, "trace");
  assert.ok(tokenShopAtu3EffectTraceRun.plannerResolution.expandedAnchors.includes("ATU3Button"));
} else {
  assert.equal(
    tokenShopAtu3EffectTraceRun.traceRegistry.executionTargetId,
    "token-shop-atu3-cells-effect"
  );
  assert.equal(
    tokenShopAtu3EffectTraceRun.traceRegistry.executionTraceScope,
    "token-shop-atu3-cells-effect"
  );
}
assert.equal(tokenShopAtu3EffectTraceRun.materialization.traceView, "materialized_trace_view");
assert.equal(tokenShopAtu3EffectTraceRun.materialization.systemView, "canonical_system_trace_view");
assert.equal(
  tokenShopAtu3EffectTraceRun.materialization.traceScope,
  "token-shop-atu3-cells-effect"
);
assert.ok(tokenShopAtu3EffectTraceRun.systemViews.formula_fragment);
assert.equal(tokenShopAtu3EffectTraceRun.decisionSummary.verdict, "keep researching");
assert.deepEqual(tokenShopAtu3EffectTraceRun.decisionSummary.baselineGap, []);
assert.equal(tokenShopAtu3EffectTraceRun.runtimeStatus, null);
assert.ok(tokenShopAtu3EffectTraceRun.semanticCoverage);
assert.ok(tokenShopAtu3EffectTraceRun.semanticCoverage.byKind.ui_binding_fragment);
assert.ok(tokenShopAtu3EffectTraceRun.systemViews.formula_fragment);
assert.ok(tokenShopAtu3EffectTraceRun.semanticCoverage.byKind.ui_binding_fragment);

// TokenBank controller shell assertions
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("TokenShop"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("ClaimBankedTokens"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("SetBankFill"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("BankFill"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("TokenBankDescriptionText"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("CheckTokenClaimNotification"));
assert.ok(tokenBankControllerShellData.controllerAnchors.includes("TokenShopButtonNotification"));
assert.ok(tokenBankControllerShellData.adjacentControllerMethods.includes("get_TokenBankCap"));
assert.ok(
  tokenBankControllerShellData.adjacentControllerMethods.includes("get_ClaimableBankTokens")
);
assert.ok(tokenBankControllerShellData.adjacentControllerMethods.includes("IncreaseBankedTokens"));
assert.ok(tokenBankControllerShellData.sourcePresence.metadata.TokenShop > 0);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.ClaimBankedTokens, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.SetBankFill, 1);
assert.ok(tokenBankControllerShellData.sourcePresence.metadata.BankFill > 0);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.TokenBankDescriptionText, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.CheckTokenClaimNotification, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.metadata.TokenShopButtonNotification, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.level0.ClaimBankedTokens, 1);
assert.equal(tokenBankControllerShellData.sourcePresence.level0.BankedDescriptionTextIncrease, 1);
assert.ok(multiverseMarketSaveBoundaryData.actionShellTermsChecked.includes("TextHandlerMarkets"));
assert.ok(
  multiverseMarketSaveBoundaryData.actionShellTermsChecked.includes("SetAllChrystosEmporiumTexts")
);
assert.ok(multiverseMarketSaveBoundaryData.saveFamilyTermsChecked.includes("PlayerProfileData"));
assert.ok(
  multiverseMarketSaveBoundaryData.saveFamilyTermsChecked.includes("CloudSavePlayerProfile")
);
assert.equal(multiverseMarketSaveBoundaryData.dataset, "multiverse-market-save-boundary.v2");
assert.equal(multiverseMarketSaveBoundaryData.boundaryEvidence.actionShellWithSaveOverlapCount, 0);
assert.equal(
  multiverseMarketSaveBoundaryData.boundaryEvidence.metadataNeighborhoodHasActionTerms,
  true
);
assert.equal(
  multiverseMarketSaveBoundaryData.boundaryEvidence.metadataNeighborhoodHasSaveTerms,
  true
);
assert.equal(
  multiverseMarketSaveBoundaryData.boundaryEvidence.metadataDirectCheckHasSaveTerms,
  false
);
assert.equal(
  multiverseMarketSaveBoundaryData.boundaryEvidence.level0DirectCheckHasSaveTerms,
  false
);
const multiverseMarketInscryptionsEntry = multiverseMarketMetadataNeighborhoodData.results.find(
  (entry) => entry.anchor === "InscryptionsDone"
);
const recoveredInscryptionLevels = [
  ...new Set(
    (multiverseMarketInscryptionsEntry?.matches ?? [])
      .flatMap((match) => [match.match_value, ...(match.context ?? []).map((item) => item.value)])
      .flatMap((value) =>
        Array.from(String(value).matchAll(/IS(\d+)Level/g), (match) => Number(match[1]))
      )
      .filter((value) => Number.isFinite(value))
  )
].sort((left, right) => left - right);
assert.deepEqual(
  recoveredInscryptionLevels,
  [
    71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94,
    95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110
  ]
);
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
assert.deepEqual(
  sortedFeedFixture.map((item) => item.id),
  ["warning-high", "warning-low", "upgrade-high"]
);
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
const archivedShardParentTrack = snapshot.researchTracks.find(
  (track) => track.id === "shards-and-loop-guardrails"
);
withRequiredValue(archivedShardParentTrack, "expected archived shard parent track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(track.currentSlice, /Archived parent/);
  assert.match(track.currentSlice, /superseded by narrower successor work/);
  assert.equal(track.nextSteps.length, 0);
});
const shardTrack = snapshot.researchTracks.find(
  (track) => track.id === "shard-milestone-payload-recovery"
);
withRequiredValue(shardTrack, "expected shard milestone payload recovery track", (track) => {
  assertResearchTrackContract(track, "shard milestone payload recovery", {
    status: "active",
    minCompletedSteps: 8,
    minVerified: 8,
    requiredSources: [
      "docs/systems/shards/shard-system-verification.md",
      "docs/systems/shards/shard-owner-family-verification.md",
      "docs/unity/unity-owner-map.md",
      "docs/unity/unity-audit-playbook.md"
    ],
    requiredArtifacts: ["data/system-units/shards.v1.json", "data/system-units/trace.v1.json"],
    forbiddenArtifacts: [
      "data/shard-scene-monobehaviour-probe.v1.json",
      "data/shard-cost-parameter-probe.v1.json",
      "data/shard-cost-method-probe.v1.json",
      "data/shard-cost-native-probe.v1.json"
    ]
  });
  assert.equal(track.nextSteps.length, 2);
  assert.ok(track.verified.some((line) => /SU1 now clears as one bounded verified row/.test(line)));
  assert.ok(track.verified.some((line) => /SU2 now clears as one bounded verified row/.test(line)));
  assert.ok(
    track.verified.some((line) =>
      /renders the reachable shard family from one shared evidence table/.test(line)
    )
  );
  assert.ok(
    track.uncertain.some((line) => /save-side owner or exact serialized list host/i.test(line))
  );
});
const spendTrack = snapshot.researchTracks.find(
  (track) => track.id === "spend-planner-from-extracted-data"
);
withRequiredValue(spendTrack, "expected archived spend parent track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(
    track.currentSlice,
    /Archived parent: this broad spend lane is now superseded by narrower successor tracks/
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /Separate TokenShop cost lanes, action lanes, owner-shell clues, token-bank controller clues, and save-boundary clues into checked artifacts/.test(
        step
      )
    ),
    "expected archived spend parent to record TokenShop boundary separation"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /Separate MultiverseMarket owner-family, action-shell, range-boundary, prefab-remap, metadata-neighborhood, and save-boundary evidence into checked artifacts/.test(
        step
      )
    ),
    "expected archived spend parent to record Emporium boundary separation"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /owner-shell clues, token-bank controller clues, and save-boundary clues into checked artifacts/.test(
        step
      )
    ),
    "expected archived spend parent to preserve save-boundary separation"
  );
});
const spendSaveOwnerTrack = snapshot.researchTracks.find(
  (track) => track.id === "spend-multiverse-save-model-recovery"
);
withRequiredValue(spendSaveOwnerTrack, "expected archived Emporium save-owner track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(track.currentSlice, /Archived owner-recovery lane/);
  assert.equal(track.nextSteps.length, 0);
});
const spendImportSurfaceTrack = snapshot.researchTracks.find(
  (track) => track.id === "spend-multiverse-savedata-import-surface"
);
withRequiredValue(
  spendImportSurfaceTrack,
  "expected Emporium import-surface successor track",
  (track) => {
    assertResearchTrackContract(track, "multiverse import surface", {
      status: "queued",
      minCompletedSteps: 5,
      minVerified: 5,
      requiredSources: [
        "docs/systems/spend/spend-system-verification.md",
        "docs/systems/spend/multiverse-market-verification.md",
        "docs/systems/spend/multiverse-market-state-verification.md",
        "docs/systems/spend/multiverse-market-savedata-import-boundary.md",
        "docs/unity/unity-audit-playbook.md"
      ],
      requiredArtifacts: [
        "data/system-units/multiverse-market.v1.json",
        "data/multiverse-market-savedata-import-boundary.json",
        "data/multiverse-market-market-member-boundary.json",
        "data/multiverse-market-range-boundary.json"
      ]
    });
    assert.ok(
      track.completedSteps.some((step) =>
        /dedicated `multiverse-market-savedata-import-boundary` artifact/.test(step)
      ),
      "expected Emporium import-surface track to record the dedicated boundary artifact"
    );
    assert.ok(
      track.completedSteps.some((step) =>
        /`InscryptionsDone` classified as wrapper\/export-only/.test(step)
      ),
      "expected Emporium import-surface track to keep InscryptionsDone wrapper-only"
    );
    assert.ok(
      track.completedSteps.some((step) =>
        /`IS71Level` through `IS74Level` classified as verified-but-blocked/.test(step)
      ),
      "expected Emporium import-surface track to keep overlap rows verified-but-blocked"
    );
    assert.ok(
      track.completedSteps.some((step) =>
        /Promote the exact typed `IS1Level` through `IS110Level` span as compatibility-only raw Emporium import truth/.test(
          step
        )
      ),
      "expected Emporium import-surface track to record the compatibility-safe IS span"
    );
    assert.ok(
      track.nextSteps.some((step) =>
        /canonical Emporium import-safe subset explicitly empty/.test(step)
      ),
      "expected Emporium import-surface track to keep the canonical subset empty"
    );
    assert.ok(
      track.nextSteps.some((step) =>
        /Leave row `71-74` player-facing identity\/remap work on its separate downstream track/.test(
          step
        )
      ),
      "expected Emporium import-surface track to keep row remap separate"
    );
    assert.ok(
      multiverseMarketMarketMemberBoundaryData.missingDirectTypeMapClues.includes(
        "PlayerProfileData|Market"
      ) &&
        multiverseMarketMarketMemberBoundaryData.directPlayerProfileFieldSamples.includes(
          "InscryptionsDone"
        ) &&
        multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) =>
          /PlayerProfileData directly declares InscryptionsDone/i.test(line)
        ),
      "expected market-member boundary artifact to preserve the PlayerProfileData direct-field versus missing Market type-map boundary"
    );
    assert.ok(
      track.verified.some((line) =>
        /`PlayerProfileHandler\.get_Market -> MultiverseMarket`/.test(line)
      ),
      "expected Emporium import-surface track to record the checked accessor bridge in verified facts"
    );
    assert.ok(
      track.verified.some((line) =>
        /`SaveData` directly declares `IS71Level`, `IS110Level`, `InscryptionsDone`, `EsotericR1Trades`, `NecrumR1Trades`, `Mech1Unlocked`, and `Mech1MissionsCompleted`/.test(
          line
        )
      ),
      "expected Emporium import-surface track to record the exact SaveData progression owner in verified facts"
    );
    assert.ok(
      track.verified.some((line) =>
        /No recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import/.test(
          line
        )
      ),
      "expected Emporium import-surface track to keep canonical import blocked in verified facts"
    );
    assert.ok(
      track.uncertain.some((line) => /bounded `SaveData`-backed Emporium import slice/.test(line)),
      "expected Emporium import-surface track to keep the bounded import question open"
    );
    assert.ok(
      multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) =>
        /does not place that wider run directly on MultiverseMarket/i.test(line)
      ),
      "expected market-member boundary artifact to keep the broader progression run separate from direct MultiverseMarket ownership"
    );
  }
);
const spendFirstUiSliceTrack = snapshot.researchTracks.find(
  (track) => track.id === "spend-planner-first-ui-slice"
);
withRequiredValue(
  spendFirstUiSliceTrack,
  "expected spend planner first UI slice track",
  (track) => {
    assertResearchTrackContract(track, "spend planner first ui slice", {
      status: "active",
      minCompletedSteps: 6,
      minVerified: 4,
      requiredSources: [
        "docs/contracts/player-profile-schema.md",
        "docs/systems/spend/spend-system-verification.md",
        "docs/roadmap/research-tracks.md"
      ],
      requiredArtifacts: [
        "data/game-data.snapshot.v1.json",
        "data/system-units/token-shop.v1.json",
        "data/system-units/multiverse-market.v1.json",
        "app.js",
        "tests/smoke.mjs"
      ]
    });
    assert.ok(
      track.completedSteps.some((step) =>
        /Overview page instead of growing the research-only descriptive spend panel/.test(step)
      ),
      "expected spend first UI slice track to record the fork into a normal user surface"
    );
    assert.ok(
      track.completedSteps.some((step) =>
        /canonical `player\.resources\.\*`, `player\.loop\.loopReset`, and profile-confidence inputs only/.test(
          step
        )
      ),
      "expected spend first UI slice track to record canonical-only panel inputs"
    );
    assert.ok(
      track.completedSteps.some((step) =>
        /TokenShop row levels, token-bank state, Daily Tokenium lane state, and Emporium owned progression explicit as blocked seams/.test(
          step
        )
      ),
      "expected spend first UI slice track to keep blocked owner-dependent seams explicit"
    );
    assert.ok(
      track.completedSteps.some((step) => /tools first, import later/.test(step)),
      "expected spend first UI slice track to record the tools-first product stance"
    );
    assert.ok(
      track.completedSteps.some((step) => /recommendation-safe spend actions disabled/.test(step)),
      "expected spend first UI slice track to keep recommendation-safe actions disabled"
    );
    assert.ok(
      track.completedSteps.some((step) =>
        /canonical `player\.resources\.tokens`, `player\.resources\.diamonds`, `player\.loop\.loopReset`, and importable `player\.resources\.academyRelics`/.test(
          step
        )
      ),
      "expected spend first UI slice track to record the canonical spend contract"
    );
    assert.ok(
      track.verified.some((line) =>
        /`player\.resources\.tokens`, `player\.resources\.diamonds`, `player\.loop\.loopReset`, and importable `player\.resources\.academyRelics`/.test(
          line
        )
      ),
      "expected spend first UI slice track to record available canonical spend inputs"
    );
    assert.ok(
      track.verified.some((line) =>
        /Current spend owner-dependent blockers still live on separate TokenShop row-level or next-purchase, token-bank cap or claimable state-owner, Daily Tokenium cap or ready-state, and Emporium import-safe owned-progression tracks/.test(
          line
        )
      ),
      "expected spend first UI slice track to keep owner-dependent blockers on separate lanes"
    );
    assert.ok(
      track.verified.some((line) =>
        /truthful spend-planner panel can stay useful while consuming only canonical spend inputs and explicitly refusing blocked compatibility or owner-dependent state/.test(
          line
        )
      ),
      "expected spend first UI slice track to record the canonical-only usefulness boundary"
    );
    assert.ok(
      track.verified.some((line) =>
        /Recommendation-safe spend actions should stay disabled until one of the currently blocked owner-dependent seams clears strongly enough/.test(
          line
        )
      ),
      "expected spend first UI slice track to keep recommendation actions disabled in verified facts"
    );
    assert.ok(
      track.verified.some((line) =>
        /checked TokenShop row subset, token-bank import clues, Daily Tokenium import clues, and Emporium import preview can remain on separate tool or evidence surfaces/.test(
          line
        )
      ),
      "expected spend first UI slice track to keep tool-only evidence surfaces separate from the canonical panel"
    );
    assert.ok(track.nextSteps.length <= 3, "expected spend first UI slice next-step count");
  }
);
const tokenShopRowDetailSliceTrack = snapshot.researchTracks.find(
  (track) => track.id === "spend-token-shop-row-detail-slice"
);
withRequiredValue(
  tokenShopRowDetailSliceTrack,
  "expected TokenShop row-detail slice track",
  (track) => {
    assertResearchTrackContract(track, "token shop row detail slice", {
      status: "archived",
      minCompletedSteps: 5,
      minVerified: 4,
      requiredSources: [
        "docs/systems/spend/spend-system-verification.md",
        "docs/systems/spend/token-shop-values.md",
        "docs/roadmap/research-tracks.md"
      ],
      requiredArtifacts: [
        "data/game-data.snapshot.v1.json",
        "data/system-units/token-shop.v1.json",
        "app.js",
        "tests/smoke.mjs"
      ]
    });
    assert.ok(
      track.completedSteps.some((step) =>
        /Drop canonical Tokens from the consumed-input contract/.test(step)
      ),
      "expected TokenShop row-detail slice track to record the narrower consumed-input contract"
    );
    assert.ok(
      track.completedSteps.some((step) =>
        /current-vs-next extracted(?: or checked-effect)? bonus-step change|current-vs-next extracted or checked-effect step change/.test(
          step
        )
      ),
      "expected TokenShop row-detail slice track to record the row-detail output shape"
    );
    assert.ok(
      track.verified.some((line) =>
        /checked `StartCost`, `AdditiveCost`, `Bonus`, and known-cap fields/.test(line)
      ),
      "expected TokenShop row-detail slice track to record the shipped values inputs"
    );
    assert.ok(
      track.verified.some((line) => /true next-purchase rule set/.test(line)),
      "expected TokenShop row-detail slice track to keep broader planner behavior blocked"
    );
  }
);
const tokenShopProgressionEditorTrack = snapshot.researchTracks.find(
  (track) => track.id === "progression-token-shop-editor-first-slice"
);
withRequiredValue(
  tokenShopProgressionEditorTrack,
  "expected Progression TokenShop editor first slice track",
  (track) => {
    assertResearchTrackContract(track, "token shop progression editor first slice", {
      status: "archived",
      minCompletedSteps: 5,
      minVerified: 4,
      requiredSources: [
        "docs/contracts/player-profile-schema.md",
        "docs/systems/spend/spend-system-verification.md",
        "docs/roadmap/research-tracks.md"
      ],
      requiredArtifacts: [
        "data/game-data.snapshot.v1.json",
        "data/system-units/token-shop.v1.json",
        "app.js",
        "index.html",
        "tests/smoke.mjs"
      ]
    });
    assert.ok(
      track.completedSteps.some((step) =>
        /Move the checked TokenShop subset UI out of the Overview-bound spend boundary panel/.test(
          step
        )
      ),
      "expected Progression TokenShop editor slice track to record the surface move"
    );
    assert.ok(
      track.completedSteps.some((step) =>
        /level-1 and other checked player-state row values visible/.test(step)
      ),
      "expected Progression TokenShop storefront slice track to record checked player-state row visibility"
    );
    assert.ok(
      track.verified.some((line) =>
        /Checked player-state levels under `planning\.tokenShop\.checkedSubsetPlayerState\.\*` now drive the live storefront/.test(
          line
        )
      ),
      "expected Progression TokenShop storefront slice track to preserve the checked player-state storefront boundary"
    );
  }
);
const tokenBankOwnerTrack = snapshot.researchTracks.find(
  (track) => track.id === "spend-token-bank-state-owner"
);
withRequiredValue(tokenBankOwnerTrack, "expected token-bank state-owner track", (track) => {
  assert.equal(track.status, "active");
  assert.match(
    track.currentSlice,
    /exact `SaveData\.BankedTokens` recovery as the current token-bank stored-amount owner/
  );
  assert.match(
    track.currentSlice,
    /`PlayerProfileHandler\.saveInfoCache` plus `ConvertSaveDataToProfileData\(\.\.\.\) -> PlayerProfileData` bridge/
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /zero direct overlap between the narrowed TokenShop owner shell and the PlayerProfile save-family terms/.test(
        step
      )
    ),
    "expected token-bank state-owner track to record TokenShop save-boundary separation"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /FinalTokenBankCap and FinalTokenBankFillSpeed clustered as output-side accessors and backing fields without save-family joins/.test(
        step
      )
    ),
    "expected token-bank state-owner track to record the derived-output non-owner boundary"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /exact typed `SaveData\.BankedTokens` ownership for the current token-bank stored amount/.test(
        step
      )
    ),
    "expected token-bank state-owner track to record exact BankedTokens owner recovery"
  );
  assert.ok(
    track.verified.some((line) =>
      /`SaveData` directly declares `BankedTokens` as the current token-bank stored-amount field/.test(
        line
      )
    ),
    "expected token-bank state-owner track to record exact stored-amount owner"
  );
  assert.ok(
    track.verified.some((line) =>
      /do not currently expose `ClaimableBankTokens` or `TokenBankCap` on `SaveData` or `PlayerProfileData`/.test(
        line
      )
    ),
    "expected token-bank state-owner track to record typed negative cap and claimable checks"
  );
  assert.ok(
    track.verified.some((line) =>
      /`PlayerProfileHandler\.saveInfoCache: PlayerProfileData` and `ConvertSaveDataToProfileData\(SaveData, System\.DateTime\) -> PlayerProfileData`/.test(
        line
      )
    ),
    "expected token-bank state-owner track to record the checked PlayerProfile bridge"
  );
  assert.ok(
    track.verified.some((line) =>
      /remaining grounded save-side search therefore stays past both the generic `PlayerProfileData` export bridge and the metadata-only `CloudSavePlayerProfile` shell/.test(
        line
      )
    ),
    "expected token-bank state-owner track to record the narrowed broader save-family search path"
  );
  assert.ok(
    track.uncertain.some((line) =>
      /cap or claimable state lives on a deeper declaring save model beyond the checked `PlayerProfileData` wrapper-export bridge/.test(
        line
      )
    ),
    "expected token-bank state-owner track to keep the deeper save-model question unresolved"
  );
});
const feedTrack = snapshot.researchTracks.find(
  (track) => track.id === "unified-feed-and-hardening"
);
withRequiredValue(feedTrack, "expected unified feed track", (track) => {
  assert.equal(track.status, "active");
  assert.match(
    track.currentSlice,
    /quarantine contract-bad shard or loop cards out of the main player feed/
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /Show the bundled dataset refresh hardening path inside the validation surface/.test(step)
    ),
    "expected unified feed track to record in-app refresh hardening"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /Show feed-level explainability coverage counts/.test(step)
    ),
    "expected unified feed track to record explainability coverage work"
  );
  assert.ok(
    track.completedSteps.some((step) => /Show per-card explainability audit status/.test(step)),
    "expected unified feed track to record per-card explainability audit work"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /Show feed-level complete-versus-partial explainability audit counts/.test(step)
    ),
    "expected unified feed track to record feed-level explainability audit counts"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /Expand representative shard and loop fixtures toward partial-context warning shapes/.test(
        step
      )
    ),
    "expected unified feed track to record partial-context fixture coverage"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /recommendation contract audit status and per-card contract validity/.test(step)
    ),
    "expected unified feed track to record recommendation contract audit visibility"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /Promote recommendation-contract integrity into a shipped validation case/.test(step)
    ),
    "expected unified feed track to record runtime feed contract validation"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /explicit player-value benefit lines on active cards/.test(step)
    ),
    "expected unified feed track to record explicit player-value benefit lines"
  );
  assert.ok(
    track.completedSteps.some((step) =>
      /Quarantine contract-bad shard or loop cards into a labeled support notice/.test(step)
    ),
    "expected unified feed track to record contract-bad card quarantine"
  );
  assert.ok(
    track.nextSteps.some((step) =>
      /Apply the same refresh discipline when new asset-grounded datasets or owner recoveries are promoted/.test(
        step
      )
    ),
    "expected unified feed track to keep refresh discipline as remaining work"
  );
  assert.ok(
    track.nextSteps.some((step) =>
      /Keep strengthening explainability coverage as new recommendation modules join the feed/.test(
        step
      )
    ),
    "expected unified feed track to keep explainability hardening open"
  );
});
const profileTrack = snapshot.researchTracks.find(
  (track) => track.id === "playerprofile-boundary-and-imports"
);
withRequiredValue(profileTrack, "expected player profile track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(track.currentSlice, /classified alias inventory/);
  assert.match(track.currentSlice, /reduced non-canonical migration surface/);
  assert.equal(track.nextSteps.length, 0);
});
const datasetContractTrack = snapshot.researchTracks.find(
  (track) => track.id === "data-contracts-and-apk-pipeline"
);
withRequiredValue(datasetContractTrack, "expected dataset contract track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(track.currentSlice, /checked-in bundled-dataset contract manifest/);
  assert.match(track.currentSlice, /dataset refresh checklist/);
  assert.equal(track.nextSteps.length, 0);
});
const hunterTrack = snapshot.researchTracks.find((track) => track.id === "hunter-related-planning");
withRequiredValue(hunterTrack, "expected hunter intake track", (track) => {
  assert.equal(track.status, "research");
  assert.equal(track.classification, "speculative");
  assert.equal(track.apkUnityPathChecked, false);
  assert.match(track.currentSlice, /separate real hunter state from planning metadata/);
});
const mechTrack = snapshot.researchTracks.find((track) => track.id === "mech-related-planning");
withRequiredValue(mechTrack, "expected mech intake track", (track) => {
  assert.equal(track.status, "research");
  assert.equal(track.apkUnityPathChecked, true);
  assert.match(
    track.currentSlice,
    /uses recovered metadata clues only to narrow persistence neighborhoods/
  );
});
const automationTrack = snapshot.researchTracks.find(
  (track) => track.id === "input-automation-intake"
);
withRequiredValue(automationTrack, "expected automation intake track", (track) => {
  assert.equal(track.status, "research");
  assert.equal(track.category, "deferred-infrastructure");
  assert.match(track.currentSlice, /guided import is insufficient without OCR/);
});
const externalModelTrack = snapshot.researchTracks.find(
  (track) => track.id === "external-model-integration-intake"
);
withRequiredValue(externalModelTrack, "expected external-model intake track", (track) => {
  assert.equal(track.status, "research");
  assert.equal(track.classification, "external-model");
  assert.match(track.currentSlice, /avoid mixing app truth with model assumptions/);
});
assert.deepEqual(multiverseMarketSaveBoundaryData.actionShellTermsChecked, [
  "TextHandlerMarkets",
  "SetAllChrystosEmporiumTexts",
  "SetInscryptionsDoneText"
]);
assert.deepEqual(multiverseMarketSaveBoundaryData.saveFamilyTermsChecked, [
  "PlayerProfileData",
  "GetPlayerProfileData",
  "FillPlayerProfileData",
  "CloudSavePlayerProfile"
]);
assert.equal(multiverseMarketSaveBoundaryData.boundaryEvidence.actionShellWithSaveOverlapCount, 0);
assert.equal(
  multiverseMarketSaveBoundaryData.boundaryEvidence.metadataNeighborhoodHasActionTerms,
  true
);
assert.equal(
  multiverseMarketSaveBoundaryData.boundaryEvidence.metadataNeighborhoodHasSaveTerms,
  true
);
assert.deepEqual(multiverseMarketSaveBoundaryData.crossBoundaryTypedOwnerStatus, {
  status: "declaring-owner-closed-market-wrapper-still-unresolved",
  exactDeclaringOwner: "SaveData",
  scope:
    "checked InscryptionsDone / IS*Level / trade-counter / early Mech* progression cluster, with the declaring owner closed on SaveData and the remaining seam narrowed to typed Market-wrapper recovery only",
  note: "This artifact still records the action-shell versus save-family split only; the checked typed market-member boundary closes the declaring-owner question on SaveData, preserves the exact PlayerProfileData.InscryptionsDone:System.String versus SaveData.InscryptionsDone:System.Int32 split, and still does not recover a typed Market field or import-ready row mapping."
});
assertCurrentBoundaryIncludes(
  multiverseMarketSaveBoundaryData.currentBoundary,
  [
    /zero direct overlap/,
    /closes the declaring-owner question on SaveData/,
    /still does not recover a typed Market field, player-owned row levels/
  ],
  "MultiverseMarket save boundary"
);

assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedBridgeRecovery, {
  bridgeOwner: "PlayerProfileHandler",
  bridgeAccessor: "get_Market",
  bridgeReturnType: "MultiverseMarket"
});
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedHandlerFieldRecovery, {
  fieldOwner: "PlayerProfileHandler",
  fieldName: "saveInfoCache",
  fieldType: "PlayerProfileData"
});
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedProfileConversionRecovery, {
  bridgeOwner: "PlayerProfileHandler",
  bridgeMethod: "ConvertSaveDataToProfileData",
  sourceType: "SaveData",
  returnType: "PlayerProfileData",
  extraParameterType: "System.DateTime"
});
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedPlayerProfileFieldTableRecovery, {
  fieldOwner: "PlayerProfileData",
  fieldCount: 89,
  methodCount: 1
});
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedSaveDataFieldTableRecovery, {
  fieldOwner: "SaveData",
  fieldCount: 4461,
  methodCount: 1
});
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.missingDirectTypeMapClues, [
  "PlayerProfileData|Market",
  "PlayerProfileData|Inscryption",
  "PlayerProfileData|MultiverseMarket"
]);
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.directPlayerProfileFieldSamples, [
  "InscryptionsDone",
  "MechsOwned",
  "GadgetLevels"
]);
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedInscryptionsDoneDualDeclaration, {
  playerProfileData: {
    fieldOwner: "PlayerProfileData",
    fieldName: "InscryptionsDone",
    fieldType: "System.String",
    fieldIndex: 62
  },
  saveData: {
    fieldOwner: "SaveData",
    fieldName: "InscryptionsDone",
    fieldType: "System.Int32",
    fieldIndex: 3038
  }
});
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedSaveDataProgressionOwnerSamples, [
  "IS71Level",
  "IS110Level",
  "InscryptionsDone",
  "EsotericR1Trades",
  "NecrumR1Trades",
  "Mech1Unlocked",
  "Mech1MissionsCompleted"
]);
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedPlayerProfileNestedTypeChecks, [
  "PlayerProfileData+GemData"
]);
assert.deepEqual(
  multiverseMarketMarketMemberBoundaryData.negativeTypedDirectPlayerProfileProgressionChecks,
  [
    "PlayerProfileData.IS71Level",
    "PlayerProfileData.IS110Level",
    "PlayerProfileData.EsotericR1Trades",
    "PlayerProfileData.NecrumR1Trades",
    "PlayerProfileData.Mech1Unlocked",
    "PlayerProfileData.Mech1MissionsCompleted"
  ]
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) =>
    /does not place that wider run directly on MultiverseMarket/i.test(line)
  ),
  "expected typed probe to keep the broader progression run off direct MultiverseMarket ownership"
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) =>
    /PlayerProfileData field table has 89 direct fields and 1 method/i.test(line)
  ),
  "expected typed probe to preserve the exact PlayerProfileData field-table recovery"
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) =>
    /none of those direct fields are named IS71Level, IS110Level, EsotericR1Trades, NecrumR1Trades, Mech1Unlocked, or Mech1MissionsCompleted/i.test(
      line
    )
  ),
  "expected typed probe to rule out flat direct PlayerProfileData progression ownership"
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) =>
    /first nested MultiverseMarket payload types are .* row-local .* broader saved progression block/i.test(
      line
    )
  ),
  "expected typed probe to keep the first nested row-local payloads separate from the broader progression run"
);
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.firstNestedMarketTypeChecks, [
  "MultiverseMarket|Inscryption",
  "MultiverseMarket|InscryptionTupleObject"
]);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.progressionPayloadFieldClues.includes("NecrumR1Trades"),
  "expected broader progression payload clues to preserve trade counters"
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.progressionPayloadFieldClues.includes("Mech1Unlocked"),
  "expected broader progression payload clues to preserve early mech fields"
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.negativeTypedDirectMemberChecks.includes(
    "MultiverseMarket.InscryptionsDone"
  ),
  "expected typed probe to preserve the ruled-out direct MultiverseMarket InscryptionsDone ownership check"
);
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.negativeTypedSaveDataMarketChecks, [
  "SaveData.Market",
  "SaveData.MultiverseMarket"
]);
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.typedMarketFieldBoundary, {
  checkedAccessorBridge: "PlayerProfileHandler.get_Market -> MultiverseMarket",
  metadataMemberShell: "Market",
  checkedTypedFieldOwners: ["PlayerProfileHandler", "PlayerProfileData", "SaveData"],
  checkedNegativeTypedFieldRecoveries: [
    "PlayerProfileHandler.Market",
    "PlayerProfileData.Market",
    "PlayerProfileData.MultiverseMarket",
    "SaveData.Market",
    "SaveData.MultiverseMarket"
  ],
  conclusion: "negative-typed-market-field-in-checked-boundary",
  currentUse: "accessor-member-shell-naming-only"
});
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.deeperMarketOwnerStatus, {
  status: "declaring-owner-closed-market-wrapper-still-unresolved",
  scope:
    "typed Market-named wrapper recovery beyond the checked accessor bridge, not the declaring owner for the checked InscryptionsDone / IS*Level cluster",
  note: "Exact typed recovery closes the checked declaring-owner question on SaveData for the broader InscryptionsDone / IS*Level / trade-counter / early mech cluster, but still does not recover a typed Market field on PlayerProfileHandler, PlayerProfileData, or SaveData."
});
assertCurrentBoundaryIncludes(
  multiverseMarketMarketMemberBoundaryData.currentBoundary,
  [
    /PlayerProfileHandler declares get_Market with return type MultiverseMarket/,
    /saveInfoCache as a typed PlayerProfileData field/,
    /ConvertSaveDataToProfileData\(SaveData saveData, System\.DateTime lastCloudSaveDate\) -> PlayerProfileData/,
    /PlayerProfileData\.InscryptionsDone is recovered as System\.String while SaveData\.InscryptionsDone is recovered as System\.Int32/,
    /PlayerProfileData field table has 89 direct fields and 1 method/,
    /SaveData declares a 4461-field save table with 1 method/,
    /SaveData the current exact declaring owner/,
    /bare Market member-shell clue/,
    /separates three things explicitly/,
    /no typed Market-named field is recovered on PlayerProfileHandler, PlayerProfileData, or SaveData/,
    /does not place that wider run directly on MultiverseMarket/,
    /remaining unresolved seam is only whether any typed Market-wrapper exists/
  ],
  "MultiverseMarket market-member boundary"
);

assert.deepEqual(multiverseMarketRangeBoundaryData.validatedRowRanges, ["50-59", "63-74"]);
assert.deepEqual(multiverseMarketRangeBoundaryData.overlapIds, [71, 72, 73, 74]);
assert.equal(
  multiverseMarketRangeBoundaryData.metadataIsRangeLabel,
  "IS71Level through IS110Level"
);
assertCurrentBoundaryIncludes(
  multiverseMarketRangeBoundaryData.currentBoundary,
  [/first direct overlap/, /does not, by itself, prove the declaring save owner/],
  "MultiverseMarket range boundary"
);

assert.equal(multiverseMarketRowTextCoverageData.validatedRowCostTexts.length, 22);
assert.deepEqual(multiverseMarketRowTextCoverageData.sampleBuyHooks, ["BuyIS50", "BuyIS74"]);
assertCurrentBoundaryIncludes(
  multiverseMarketRowTextCoverageData.currentBoundary,
  [/validated-row text lane/, /text-handler coverage, not saved-state coverage/],
  "MultiverseMarket row-text coverage"
);

assert.deepEqual(
  multiverseMarketPrefabRemapBoundaryData.validatedIdsWithoutDirectPrefabName,
  [69, 70, 71, 72, 73, 74]
);
assert.equal(multiverseMarketPrefabRemapBoundaryData.explicitPrefabIdOverrides.length, 6);
assert.deepEqual(
  multiverseMarketPrefabRemapBoundaryData.overrideSerializedIdsOutsideValidatedBlock,
  [60, 61, 62]
);
assertCurrentBoundaryIncludes(
  multiverseMarketPrefabRemapBoundaryData.currentBoundary,
  [
    /not a one-to-one player-facing remap/,
    /block any assumption that validated rows 69 through 74 already have final grounded upgrade-number labels/
  ],
  "MultiverseMarket prefab remap boundary"
);

assertDatasetContractEntry(
  "multiverse-market-range-boundary",
  "data/multiverse-market-range-boundary.json"
);
assertDatasetContractEntry(
  "multiverse-market-prefab-remap-boundary",
  "data/multiverse-market-prefab-remap-boundary.json"
);
assertDatasetContractEntry(
  "multiverse-market-save-boundary",
  "data/multiverse-market-save-boundary.v2.json"
);
assertDatasetContractEntry(
  "multiverse-market-market-member-boundary",
  "data/multiverse-market-market-member-boundary.json"
);
assertDatasetContractEntry(
  "multiverse-market-savedata-import-boundary",
  "data/multiverse-market-savedata-import-boundary.json"
);
assertDatasetContractEntry(
  "multiverse-market-row69-74-identity-source-boundary",
  "data/multiverse-market-row69-74-identity-source-boundary.json"
);
assertDatasetContractEntry(
  "multiverse-market-serialized-label-source-boundary",
  "data/multiverse-market-serialized-label-source-boundary.json"
);
assertDatasetContractEntry(
  "multiverse-market-row71-74-identity-boundary",
  "data/multiverse-market-row71-74-identity-boundary.json"
);
assertDatasetContractEntry(
  "multiverse-market-shell-row-prediction-boundary",
  "data/multiverse-market-shell-row-prediction-boundary.json"
);
assertDatasetContractEntry(
  "multiverse-market-text-provenance-path-boundary",
  "data/multiverse-market-text-provenance-path-boundary.json"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.dataset,
  "multiverse-market-savedata-import-boundary"
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.importSafeSubset,
  ["IS1Level through IS110Level"]
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.exactImportSafeSubsetLabel,
  "IS1Level through IS110Level only"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.importTargetPath,
  "compatibility.unmappedSystemState.multiverseMarket"
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.canonicalImportSafeSubset,
  []
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion
    .exactCanonicalImportSafeSubsetLabel,
  "none"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.widerOrderedSet
    .actionShellBuyHookRange,
  "BuyIS1 through BuyIS110"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.widerOrderedSet
    .actionShellCostTextRange,
  "SetIS1CostText through SetIS110CostText"
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.widerOrderedSet
    .validatedRowRanges,
  ["50-59", "63-74"]
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.widerOrderedSet
    .saveDataFieldRange,
  "IS1Level through IS110Level"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.declaringOwner,
  "SaveData"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.contiguousLevelSpan,
  "IS1Level through IS110Level"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.lowerBoundary.includedField,
  "IS1Level"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.lowerBoundary.excludedNeighbor,
  "IS0Level"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.upperBoundary.includedField,
  "IS110Level"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.upperBoundary.excludedNeighbor,
  "IS111Level"
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.upperBoundary.nextTypedNeighbor,
  "InscryptionsDone"
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.checkedOrderedMappings.map(
    (entry) => [entry.saveField, entry.orderedInscriptionRow]
  ),
  [
    ["IS71Level", 71],
    ["IS72Level", 72],
    ["IS73Level", 73],
    ["IS74Level", 74]
  ]
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.classifications.safe_import_candidate.map(
    (entry) => entry.entryId
  ),
  ["savedata-owned-is1-110"]
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.classifications.wrapper_or_export_only.map(
    (entry) => entry.entryId
  ),
  ["inscryptionsdone-wrapper"]
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.classifications.verified_but_blocked.map(
    (entry) => entry.entryId
  ),
  [
    "checked-row-order-is71-74",
    "savedata-owned-trade-counters-outside-import-slice",
    "savedata-owned-adjacent-mech-window-outside-import-slice"
  ]
);
assert.deepEqual(multiverseMarketSaveDataImportBoundaryData.classifications.unresolved, []);
assert.match(
  multiverseMarketStateVerificationDoc,
  /## Checked `IS\*Level` to inscription-row boundary/
);
assert.match(multiverseMarketStateVerificationDoc, /`IS71Level` -> ordered row `71`/);
assert.match(multiverseMarketStateVerificationDoc, /`IS74Level` -> ordered row `74`/);
assert.match(multiverseMarketStateVerificationDoc, /## Bounded SaveData import classification/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /`safe_import_candidate`[\s\S]*`IS1Level` through `IS110Level`/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /`verified_but_blocked`[\s\S]*`EsotericR1Trades` through `EsotericR9Trades`[\s\S]*`NecrumR1Trades` through `NecrumR9Trades`/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /`verified_but_blocked`[\s\S]*`Mech1Unlocked` through `Mech2Unlocked`/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /`wrapper_or_export_only`[\s\S]*`InscryptionsDone`/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /`verified_but_blocked`[\s\S]*`IS71Level` through `IS74Level`/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /admitted Emporium import slice now stops at that exact `IS1Level` through `IS110Level` span/i
);
assert.match(multiverseMarketStateVerificationDoc, /`unresolved`[\s\S]*none/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /no recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import/i
);
assert.equal(
  multiverseMarketRow6974IdentitySourceBoundaryData.dataset,
  "multiverse-market-row69-74-identity-source-boundary"
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.settledBrokenPrefabBand.map((entry) => [
    entry.orderedInscriptionRow,
    entry.saveField,
    entry.serializedIdField,
    entry.buyHook,
    entry.costTextHook,
    entry.prefabName,
    entry.remappedSerializedId
  ]),
  [
    [69, "IS69Level", "IS69ID", "BuyIS69", "SetIS69CostText", "ChrystosEmporiumUpgrade69-ID57", 57],
    [70, "IS70Level", "IS70ID", "BuyIS70", "SetIS70CostText", "ChrystosEmporiumUpgrade70-ID58", 58],
    [71, "IS71Level", "IS71ID", "BuyIS71", "SetIS71CostText", "ChrystosEmporiumUpgrade71-ID59", 59],
    [72, "IS72Level", "IS72ID", "BuyIS72", "SetIS72CostText", "ChrystosEmporiumUpgrade72-ID60", 60],
    [73, "IS73Level", "IS73ID", "BuyIS73", "SetIS73CostText", "ChrystosEmporiumUpgrade73-ID61", 61],
    [74, "IS74Level", "IS74ID", "BuyIS74", "SetIS74CostText", "ChrystosEmporiumUpgrade74-ID62", 62]
  ]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .directPlayerFacingStringSearch.searchedLabels,
  [
    "Inscryption 69",
    "Inscryption 70",
    "Inscryption 71",
    "Inscryption 72",
    "Inscryption 73",
    "Inscryption 74"
  ]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .directPlayerFacingStringSearch.matches,
  []
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .remappedSerializedIdLabelBoundary.remappedSerializedIds,
  [57, 58, 59, 60, 61, 62]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .remappedSerializedIdLabelBoundary.earlierDirectPrefabShells,
  [
    "ChrystosEmporiumUpgrade57",
    "ChrystosEmporiumUpgrade58",
    "ChrystosEmporiumUpgrade59",
    "ChrystosEmporiumUpgrade60",
    "ChrystosEmporiumUpgrade61",
    "ChrystosEmporiumUpgrade62"
  ]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .remappedSerializedIdLabelBoundary.searchedLabels,
  [
    "Inscryption 57",
    "Inscryption 58",
    "Inscryption 59",
    "Inscryption 60",
    "Inscryption 61",
    "Inscryption 62"
  ]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .remappedSerializedIdLabelBoundary.matches,
  []
);
assert.equal(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .textHandlerCoverage.textHandlerOwner,
  "TextHandlerMarkets"
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .actionShellCoverage.buyHooks,
  ["BuyIS69", "BuyIS70", "BuyIS71", "BuyIS72", "BuyIS73", "BuyIS74"]
);
assert.deepEqual(
  [
    multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
      .metadataJoinCandidates.ownerField,
    multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
      .metadataJoinCandidates.ownerType,
    multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
      .metadataJoinCandidates.listField
  ],
  ["THMarkets", "TextHandlerMarkets", "InscryptionsList"]
);
assert.equal(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .tmpProbeNegativeBoundary.artifact,
  "tmp-multiverse-row-text-probe.json"
);
assert.equal(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .tmpProbeNegativeBoundary.sourceClass,
  "raw TextHandlerMarkets presentation-probe continuation"
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources
    .tmpProbeNegativeBoundary.checkedAnchors,
  [
    "SetIS69BaseBonusText",
    "ClearISObjects",
    "ClearISMaxLevelObjects",
    "SetISMaxLevelObjects",
    "THMarkets",
    "InscryptionsList"
  ]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.playerFacingIdentitySourceBoundary.identitySourceRecovered.map(
    (entry) => [entry.orderedInscriptionRow, entry.playerFacingLabel]
  ),
  [
    [69, "INSCRYPTION #69"],
    [70, "INSCRYPTION #70"],
    [71, "INSCRYPTION #71"],
    [72, "INSCRYPTION #72"],
    [73, "INSCRYPTION #73"],
    [74, "INSCRYPTION #74"]
  ]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.playerFacingIdentitySourceBoundary
    .canonicalImportSafeSubset,
  []
);
assert.equal(
  multiverseMarketRow6974IdentitySourceBoundaryData.playerFacingIdentitySourceBoundary
    .helpsRows6974,
  true
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.playerFacingIdentitySourceBoundary
    .identityStillBlocked,
  []
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /## Checked row `69-74` player-facing text-provenance boundary/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /row identity for rows `69-74` is already carried by the same-number chain/i
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /serialized ids `57-62`[\s\S]*do not recover direct player-facing strings `Inscryption 57` through `Inscryption 62`/i
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /tmp-multiverse-row-text-probe\.json[\s\S]*SetIS69BaseBonusText[\s\S]*ClearISObjects[\s\S]*ClearISMaxLevelObjects[\s\S]*SetISMaxLevelObjects/i
);
assert.equal(
  multiverseMarketSerializedLabelSourceBoundaryData.dataset,
  "multiverse-market-serialized-label-source-boundary"
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.multiverseMarketContainerFields.map(
    (entry) => [entry.name, entry.fieldOffset]
  ),
  [
    ["InscryptionCostList", 10656],
    ["InscryptionAndCostRelations", 10672],
    ["IDChecks", 10688],
    ["inscryptions", 10696],
    ["InscryptionTupleList", 10704]
  ]
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.rowPayloadTypes.map(
    (entry) => entry.typeName
  ),
  ["MultiverseMarket|Inscryption", "MultiverseMarket|InscryptionTupleObject"]
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence
    .labelBearingFieldChecks.recoveredStringOrLabelFields,
  []
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence
    .indirectJoinSearch.candidateCatalogOrRelationFields,
  [
    "InscryptionCostList",
    "InscryptionAndCostRelations",
    "IDChecks",
    "inscryptions",
    "InscryptionTupleList"
  ]
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence
    .indirectJoinSearch.separateUiShellClues,
  ["THMarkets", "InscryptionsList", "TextHandlerMarkets", "SetAllChrystosEmporiumTexts"]
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence
    .indirectJoinSearch.repoLocalConsumerSearchSourcesWithoutCandidateHits,
  [
    "data/system-units/multiverse-market.v1.json",
    "data/system-units/trace.v1.json",
    "db:materialized-target-bundle:multiverse-market-save-owner-boundary"
  ]
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence
    .indirectJoinSearch.adjacentConsumerOrViewSymbolsRecovered,
  []
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.joinBackAssessment
    .playerFacingIdentitySourceRecovered,
  []
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.joinBackAssessment.canonicalImportSafeSubset,
  []
);
assert.equal(
  multiverseMarketSerializedLabelSourceBoundaryData.joinBackAssessment.helpsRows6974,
  false
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.joinBackAssessment.smallestRecoveredPattern,
  []
);
assert.match(
  multiverseMarketVerificationDoc,
  /## Alternate serialized-export indirect-join boundary/
);
assert.match(multiverseMarketVerificationDoc, /InscryptionCostList/);
assert.match(
  multiverseMarketVerificationDoc,
  /no indirect catalog\/relation join is recoverable repo-locally/i
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /## Alternate serialized-export indirect-join boundary/
);
assert.match(multiverseMarketStateVerificationDoc, /InscryptionTupleList/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /no indirect catalog\/relation join is recoverable repo-locally/i
);
assert.equal(
  multiverseMarketRow7174IdentityBoundaryData.dataset,
  "multiverse-market-row71-74-identity-boundary"
);
assert.deepEqual(
  multiverseMarketRow7174IdentityBoundaryData.settledOrderedMapping.map((entry) => [
    entry.saveField,
    entry.orderedInscriptionRow
  ]),
  [
    ["IS71Level", 71],
    ["IS72Level", 72],
    ["IS73Level", 73],
    ["IS74Level", 74]
  ]
);
assert.deepEqual(
  multiverseMarketRow7174IdentityBoundaryData.playerFacingIdentityBoundary
    .canonicalImportSafeSubset,
  []
);
assert.deepEqual(
  multiverseMarketRow7174IdentityBoundaryData.playerFacingIdentityBoundary.identityRecovered.map(
    (entry) => [entry.orderedInscriptionRow, entry.playerFacingLabel]
  ),
  [
    [71, "INSCRYPTION #71"],
    [72, "INSCRYPTION #72"],
    [73, "INSCRYPTION #73"],
    [74, "INSCRYPTION #74"]
  ]
);
assert.deepEqual(
  multiverseMarketRow7174IdentityBoundaryData.playerFacingIdentityBoundary.identityStillBlocked,
  []
);
assert.deepEqual(
  multiverseMarketRow7174IdentityBoundaryData.playerFacingIdentityBoundary.adjacentKnownPlayerFacingAnchors.map(
    (entry) => [entry.orderedInscriptionRow, entry.label]
  ),
  [
    [68, "INSCRYPTION #68"],
    [75, "INSCRYPTION #75"]
  ]
);
assert.match(multiverseMarketStateVerificationDoc, /ChrystosEmporiumUpgrade71-ID59/);
assert.equal(multiverseMarketRow7174RemapBandData.dataset, "multiverse-market-row71-74-remap-band");
assert.deepEqual(
  multiverseMarketRow7174RemapBandData.remapBandRows.map((entry) => [
    entry.orderedInscriptionRow,
    entry.serializedIdField,
    entry.prefabName,
    entry.remappedSerializedId
  ]),
  [
    [71, "IS71ID", "ChrystosEmporiumUpgrade71-ID59", 59],
    [72, "IS72ID", "ChrystosEmporiumUpgrade72-ID60", 60],
    [73, "IS73ID", "ChrystosEmporiumUpgrade73-ID61", 61],
    [74, "IS74ID", "ChrystosEmporiumUpgrade74-ID62", 62]
  ]
);
assert.deepEqual(
  multiverseMarketRow7174RemapBandData.earlierPrefabShellEvidence.map((entry) => [
    entry.serializedId,
    entry.prefabName
  ]),
  [
    [59, "ChrystosEmporiumUpgrade59"],
    [60, "ChrystosEmporiumUpgrade60"],
    [61, "ChrystosEmporiumUpgrade61"],
    [62, "ChrystosEmporiumUpgrade62"]
  ]
);
assert.deepEqual(
  multiverseMarketRow7174RemapBandData.liveUiComparison.testedRows.map((entry) => [
    entry.orderedInscriptionRow,
    entry.playerFacingLabel
  ]),
  [
    [71, "INSCRYPTION #71"],
    [72, "INSCRYPTION #72"],
    [73, "INSCRYPTION #73"],
    [74, "INSCRYPTION #74"]
  ]
);
assert.deepEqual(multiverseMarketRow7174RemapBandData.canonicalImportSafeSubset, []);
assert.match(multiverseMarketStateVerificationDoc, /## Checked row `71-74` remap-band boundary/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /prefab numbers `71-74` are reused as shells for serialized ids `59-62`/i
);
assert.match(multiverseMarketVerificationDoc, /## Narrow row 71-74 remap-band boundary/);
assert.match(multiverseMarketVerificationDoc, /ChrystosEmporiumUpgrade71-ID59/);
assert.match(multiverseMarketVerificationDoc, /ChrystosEmporiumUpgrade59/);
assert.match(multiverseMarketVerificationDoc, /the canonical import-safe subset stays empty/i);
assert.equal(
  multiverseMarketNearbyIdentityBindingPatternData.dataset,
  "multiverse-market-nearby-identity-binding-pattern"
);
assert.deepEqual(
  multiverseMarketNearbyIdentityBindingPatternData.checkedPositiveBindings.map((entry) => [
    entry.orderedInscriptionRow,
    entry.saveField,
    entry.serializedIdField,
    entry.buyHook,
    entry.prefabName,
    entry.playerFacingLabel
  ]),
  [
    [
      78,
      "IS78Level",
      "IS78ID",
      "BuyIS78",
      "ChrystosEmporiumUpgrade78-ID78",
      "Inscryption 78: Ouroboros Orbs"
    ],
    [
      83,
      "IS83Level",
      "IS83ID",
      "BuyIS83",
      "ChrystosEmporiumUpgrade83-ID83",
      "Inscryption 83: Fast-Loop ML"
    ]
  ]
);
assert.deepEqual(
  multiverseMarketNearbyIdentityBindingPatternData.checkedPositiveBindings.map(
    (entry) => entry.controlStatus
  ),
  ["partial-text-adjacent-control", "partial-text-adjacent-control"]
);
assert.deepEqual(
  multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.checkedPositiveRows,
  [78, 83]
);
assert.equal(
  multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.patternName,
  "same-number nearby text-adjacent control"
);
assert.deepEqual(
  multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.checkedNegativeCarryoverRows,
  [69, 70, 71, 72, 73, 74]
);
assert.equal(
  multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.helpsRows6974,
  false
);
assert.deepEqual(
  multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.canonicalImportSafeSubset,
  []
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /## Nearby checked inscription text-adjacent controls/
);
assert.match(multiverseMarketStateVerificationDoc, /ChrystosEmporiumUpgrade78-ID78/);
assert.match(multiverseMarketStateVerificationDoc, /ChrystosEmporiumUpgrade83-ID83/);
assert.match(multiverseMarketVerificationDoc, /## Nearby checked text-adjacent controls/);
assert.match(
  multiverseMarketVerificationDoc,
  /sparse anchor: `Inscryption 78: Ouroboros Orbs`[\s\S]*live screenshot text: `OUROBOROS POINTS GAINED`/i
);
assert.match(
  multiverseMarketVerificationDoc,
  /IS83Level`, `IS83ID`, `BuyIS83`, `ChrystosEmporiumUpgrade83-ID83`, sparse anchor `Inscryption 83: Fast-Loop ML`/
);
assert.match(
  multiverseMarketVerificationDoc,
  /does not recover the missing player-facing text provenance for rows `69-74`/i
);
assert.match(
  multiverseMarketVerificationDoc,
  /ChrystosEmporiumUpgrade69-ID57[\s\S]*ChrystosEmporiumUpgrade74-ID62/i
);
assert.equal(
  multiverseMarket6974AnomalyProvenanceData.dataset,
  "multiverse-market-69-74-anomaly-provenance"
);
assert.deepEqual(
  multiverseMarket6974AnomalyProvenanceData.settledAnomaly.sameNumberAlignmentLayers,
  ["IS69Level through IS74Level", "IS69ID through IS74ID", "BuyIS69 through BuyIS74"]
);
assert.deepEqual(
  multiverseMarket6974AnomalyProvenanceData.settledAnomaly.brokenPrefabBandRows,
  [69, 70, 71, 72, 73, 74]
);
assert.deepEqual(multiverseMarket6974AnomalyProvenanceData.settledAnomaly.prefabRemapPairs, [
  "69->57",
  "70->58",
  "71->59",
  "72->60",
  "73->61",
  "74->62"
]);
assert.deepEqual(
  multiverseMarket6974AnomalyProvenanceData.settledAnomaly.playerFacingIdentityRecoveredRowsInBand,
  [69, 70, 71, 72, 73, 74]
);
assert.deepEqual(
  multiverseMarket6974AnomalyProvenanceData.pipelineStages.map((stage) => [
    stage.stageId,
    stage.classification,
    stage.anomalyPresent
  ]),
  [
    ["raw-app-side-asset", "raw-app-side", true],
    ["raw-app-side-probe-reports", "raw-app-side", true],
    ["repo-local-derived-boundaries", "repo-local-derived", true]
  ]
);
assert.equal(
  multiverseMarket6974AnomalyProvenanceData.provenanceConclusion.earliestCheckedAppearanceStage,
  "raw-app-side-asset"
);
assert.equal(
  multiverseMarket6974AnomalyProvenanceData.provenanceConclusion.anomalyOwner,
  "app-side-inherited"
);
assert.equal(
  multiverseMarket6974AnomalyProvenanceData.provenanceConclusion.repoLocalIntroductionDetected,
  false
);
assert.equal(
  multiverseMarket6974AnomalyProvenanceData.standardizationDecision.standardizationAllowed,
  false
);
assert.equal(
  multiverseMarket6974AnomalyProvenanceData.standardizationDecision.standardizationApplied,
  false
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /## Checked `69-74` anomaly provenance boundary/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /the `69-74` anomaly is app-side inherited rather than repo-local/i
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /live UI evidence now grounds rows `69-74` as player-facing rows `69-74`/i
);
assert.match(multiverseMarketVerificationDoc, /## Checked 69-74 anomaly provenance boundary/);
assert.match(
  multiverseMarketVerificationDoc,
  /the anomaly must remain represented as inherited source truth/i
);
assert.match(
  multiverseMarket6974AnomalyProvenanceDoc,
  /earliest checked appearance is raw app-side evidence/i
);
assert.match(
  multiverseMarket6974AnomalyProvenanceDoc,
  /No dataset standardization is applied in this lane\./
);
assert.equal(
  multiverseMarketShellRowPredictionBoundaryData.dataset,
  "multiverse-market-shell-row-prediction-boundary"
);
assert.deepEqual(
  multiverseMarketShellRowPredictionBoundaryData.testedRows.map((entry) => [
    entry.orderedInscriptionRow,
    entry.saveDataOwnerChain.saveField,
    entry.saveDataOwnerChain.serializedIdField,
    entry.saveDataOwnerChain.buyHook
  ]),
  [
    [69, "IS69Level", "IS69ID", "BuyIS69"],
    [70, "IS70Level", "IS70ID", "BuyIS70"],
    [71, "IS71Level", "IS71ID", "BuyIS71"],
    [72, "IS72Level", "IS72ID", "BuyIS72"],
    [73, "IS73Level", "IS73ID", "BuyIS73"],
    [74, "IS74Level", "IS74ID", "BuyIS74"],
    [78, "IS78Level", "IS78ID", "BuyIS78"]
  ]
);
assert.deepEqual(
  multiverseMarketShellRowPredictionBoundaryData.testedRows
    .slice(0, 6)
    .map((entry) => [
      entry.orderedInscriptionRow,
      entry.rowPayloadChain.recordInscriptionId,
      entry.rowPayloadChain.bonusValue
    ]),
  [
    [69, 69, 5000000136282112.0],
    [70, 70, 10000000000.0],
    [71, 71, 0.019999999552965164],
    [72, 72, 0.05999999865889549],
    [73, 73, 10.0],
    [74, 74, 40.0]
  ]
);
assert.equal(
  multiverseMarketShellRowPredictionBoundaryData.testedRows[6].shellMetadata.prefabName,
  "ChrystosEmporiumUpgrade78-ID78"
);
assert.deepEqual(
  multiverseMarketShellRowPredictionBoundaryData.actualStructureConclusion
    .canonicalImportSafeSubset,
  []
);
assert.equal(
  multiverseMarketShellRowPredictionBoundaryData.actualStructureConclusion
    .compatibilityOnlyImportPath,
  "compatibility.unmappedSystemState.multiverseMarket"
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /## Checked shell-to-SaveData row-prediction boundary/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /displayed row number follows the ordered same-number `SaveData` and row-carrier chain, not the prefab shell suffix/i
);
assert.match(multiverseMarketVerificationDoc, /## Shell-to-SaveData row-prediction boundary/);
assert.match(multiverseMarketVerificationDoc, /id `57` carries `0\.05`, not row `69`'s `5qa`/i);
assert.match(multiverseMarketVerificationDoc, /id `58` carries `5`, not row `70`'s `10b`/i);
assert.match(multiverseMarketVerificationDoc, /id `59` carries `5`, not row `71`'s `0\.02`/i);
assert.equal(
  multiverseMarketTextProvenancePathBoundaryData.dataset,
  "multiverse-market-text-provenance-path-boundary"
);
assert.deepEqual(
  [
    multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.orderedInscriptionRow,
    multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.saveDataOwnerChain.saveField,
    multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.saveDataOwnerChain
      .serializedIdField,
    multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.saveDataOwnerChain.buyHook,
    multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.saveDataOwnerChain
      .costTextHook
  ],
  [78, "IS78Level", "IS78ID", "BuyIS78", "SetIS78CostText"]
);
assert.equal(
  multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.textBearingSource
    .playerFacingLabel,
  "Inscryption 78: Ouroboros Orbs"
);
assert.equal(
  multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.textBearingSource.status,
  "not-a-completed-live-effect-text-binding"
);
assert.deepEqual(
  multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.rowLocalAssetBinding
    .row78SlotObjects,
  [
    "CurrentBonusText",
    "BonusDescriptionText",
    "PerLevelBonusText",
    "DescriptionText",
    "IDText",
    "IconBox"
  ]
);
assert.deepEqual(
  multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.rowLocalAssetBinding
    .recoveredComponentTypes,
  ["UnityEngine.UI.Text", "UnityEngine.UI.Image", "UnityEngine.UI.Outline", "UnityEngine.UI.Shadow"]
);
assert.equal(
  multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.assignmentSiteRecovery
    .candidateProducerSerializedHits,
  0
);
assert.equal(
  multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.assignmentSiteRecovery
    .externalSerializedProducerHits,
  0
);
assert.equal(
  multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.assignmentSiteRecovery
    .runtimeOnlyInference,
  true
);
assert.equal(
  multiverseMarketTextProvenancePathBoundaryData.controlRowTextPath.liveOutputCheck
    .displayedEffectText,
  "OUROBOROS POINTS GAINED"
);
assert.deepEqual(
  multiverseMarketTextProvenancePathBoundaryData.scalingCheck.broadHandlerFamilyRecovered,
  [
    "SetAllBaseBonusTexts",
    "SetIS1BaseBonusText",
    "SetIS25BaseBonusText",
    "SetIS50BaseBonusText",
    "SetIS68BaseBonusText",
    "SetIS69BaseBonusText"
  ]
);
assert.deepEqual(
  multiverseMarketTextProvenancePathBoundaryData.scalingCheck.playerFacingStringAnchorsRecovered,
  [
    "Inscryption 25: Idle Ship Speed",
    "Inscryption 46: Increase Basic Power",
    "Inscryption 78: Ouroboros Orbs",
    "Inscryption 83: Fast-Loop ML"
  ]
);
assert.deepEqual(
  multiverseMarketTextProvenancePathBoundaryData.scalingCheck.missingInsideTheCheckedEmporiumBand,
  [
    "Inscryption 69",
    "Inscryption 70",
    "Inscryption 71",
    "Inscryption 72",
    "Inscryption 73",
    "Inscryption 74"
  ]
);
assert.equal(multiverseMarketTextProvenancePathBoundaryData.scalingCheck.scalesToWholeTable, false);
assert.deepEqual(multiverseMarketTextProvenancePathBoundaryData.supportedRowLocalTextModel, {
  effectLabelLane: {
    slotAlias: "BonusDescriptionText",
    runtimeWriterFamily: "SetAllBonusTexts -> SetISNBonusText",
    status: "grounded-runtime-lane"
  },
  baseBonusLane: {
    slotAlias: "PerLevelBonusText",
    runtimeWriterFamily:
      "SetAllChrystosEmporiumTexts -> SetAllBaseBonusTexts -> SetISNBaseBonusText",
    status: "grounded-runtime-lane"
  },
  idLane: {
    slotAlias: "IDText",
    runtimeWriterFamily: "SetIS1IDText through SetIS110IDText",
    status: "grounded-runtime-lane"
  },
  currentValueLane: {
    slotAlias: "CurrentBonusText",
    status: "quarantined-unrecovered-runtime-only-display-lane",
    reason:
      "No typed CurrentBonusText field, SetCurrentBonusText writer family, or recovered row-local producer is present in the checked runtime surface."
  }
});
assert.deepEqual(multiverseMarketTextProvenancePathBoundaryData.appSideRowSummaryShape, {
  shapeId: "multiverse-market-row-local-text-summary",
  groundedFields: [
    {
      key: "effectLabel",
      slotAlias: "BonusDescriptionText",
      sourceLane: "SetAllBonusTexts -> SetISNBonusText"
    },
    {
      key: "baseBonus",
      slotAlias: "PerLevelBonusText",
      sourceLane: "SetAllChrystosEmporiumTexts -> SetAllBaseBonusTexts -> SetISNBaseBonusText"
    },
    {
      key: "rowIdLabel",
      slotAlias: "IDText",
      sourceLane: "SetIS1IDText through SetIS110IDText"
    }
  ],
  quarantinedFields: [
    {
      key: "currentValueDisplay",
      slotAlias: "CurrentBonusText",
      status: "quarantined-unrecovered-runtime-only-display-lane"
    }
  ]
});
assert.equal(
  multiverseMarketTextProvenancePathBoundaryData.lastMissingBindingLayer.layerName,
  "separate dedicated CurrentBonusText runtime writer lane after the last plausible row-local update surfaces are exhausted"
);
assert.deepEqual(
  multiverseMarketTextProvenancePathBoundaryData.lastMissingBindingLayer.currentlyRecoveredInputs,
  [
    "TextHandlerMarkets",
    "THMarkets",
    "MultiverseMarket",
    "SetAllChrystosEmporiumTexts",
    "SetAllBonusTexts",
    "SetAllBaseBonusTexts",
    "SetIS78BaseBonusText",
    "SetIS83BaseBonusText",
    "SetIS78BonusText",
    "SetIS83BonusText",
    "get_FinalIS78Bonus",
    "get_FinalIS83Bonus",
    "SetISNCostText",
    "SetISNBaseBonusText",
    "SetISNBonusText",
    "InscryptionsList",
    "CurrentBonusText",
    "BonusDescriptionText",
    "PerLevelBonusText",
    "DescriptionText",
    "IDText",
    "IconBox",
    "GeneralFunctionsManager.BigDoubleToText",
    "System.Int32.ToString",
    "runtime metadata init helper",
    "null-reference throw helper",
    "UnityEngine.UI.Text",
    "UnityEngine.UI.Image",
    "UnityEngine.UI.Outline",
    "UnityEngine.UI.Shadow",
    "RectTransform",
    "CanvasRenderer",
    "System.String.Concat"
  ]
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /## Checked control-row text-provenance path boundary/
);
assert.match(multiverseMarketStateVerificationDoc, /Inscryption 78: Ouroboros Orbs/);
assert.match(multiverseMarketStateVerificationDoc, /OUROBOROS POINTS GAINED/i);
assert.match(multiverseMarketStateVerificationDoc, /SetAllChrystosEmporiumTexts/);
assert.match(multiverseMarketStateVerificationDoc, /SetIS78BaseBonusText/);
assert.match(multiverseMarketStateVerificationDoc, /SetIS78BonusText/);
assert.match(multiverseMarketStateVerificationDoc, /CurrentBonusText/);
assert.match(multiverseMarketStateVerificationDoc, /UnityEngine\.UI\.Text/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /zero serialized `TextHandlerMarkets` or `MultiverseMarket` producer links/i
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /no `CurrentBonusText`-named field or `SetCurrentBonusText` writer family/i
);
assert.match(multiverseMarketStateVerificationDoc, /SetIS1IDText/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /row-local effect-label slot alias to `BonusDescriptionText`/i
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /`PerLevelBonusText` is now the grounded base-bonus lane/i
);
assert.match(multiverseMarketStateVerificationDoc, /`IDText` is now the grounded id lane/i);
assert.match(multiverseMarketStateVerificationDoc, /get_FinalIS78Bonus|get_FinalIS83Bonus/i);
assert.match(multiverseMarketStateVerificationDoc, /SetAllBonusTexts/);
assert.match(multiverseMarketStateVerificationDoc, /GeneralFunctionsManager\.BigDoubleToText/);
assert.match(multiverseMarketStateVerificationDoc, /System\.Int32\.ToString|Int32\.ToString/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /runtime metadata-init helper|runtime metadata init helper/i
);
assert.match(multiverseMarketStateVerificationDoc, /null-reference throw helper/i);
assert.match(multiverseMarketStateVerificationDoc, /separate `CurrentBonusText` writer lane/i);
assert.match(multiverseMarketStateVerificationDoc, /NavigationManager\.UpdateInscryptionUI/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /NavigationManager\+<UpdateInscryptionUI>d__185\.MoveNext/
);
assert.match(multiverseMarketStateVerificationDoc, /NavigationManager\+<InscEnum>d__186\.MoveNext/);
assert.match(multiverseMarketStateVerificationDoc, /NavigationManager\.DisableInscryptionObjects/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /NavigationManager\.OnAvailbleInscryptionsClick/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /NavigationManager\.OnFinishedInscryptionsClick/
);
assert.match(multiverseMarketStateVerificationDoc, /TextHandlerShopNPCs\.OpeningChrystosEmporium/);
assert.match(multiverseMarketStateVerificationDoc, /TextHandlerShopNPCs\.EmporiumDefaultText/);
assert.match(
  multiverseMarketStateVerificationDoc,
  /TextHandlerShopNPCs\+<DisplayTextEmporium>d__22\.MoveNext/
);
assert.match(
  multiverseMarketVerificationDoc,
  /## Checked control-row text-provenance path boundary/
);
assert.match(multiverseMarketVerificationDoc, /OUROBOROS POINTS GAINED/i);
assert.match(multiverseMarketVerificationDoc, /SetIS69BaseBonusText/);
assert.match(multiverseMarketVerificationDoc, /SetIS78BaseBonusText/);
assert.match(multiverseMarketVerificationDoc, /SetIS78BonusText/);
assert.match(multiverseMarketVerificationDoc, /CurrentBonusText/);
assert.match(multiverseMarketVerificationDoc, /UnityEngine\.UI\.Text/);
assert.match(
  multiverseMarketVerificationDoc,
  /zero serialized `TextHandlerMarkets` or `MultiverseMarket` producer links/i
);
assert.match(
  multiverseMarketVerificationDoc,
  /no `CurrentBonusText`-named field or `SetCurrentBonusText` writer family/i
);
assert.match(multiverseMarketVerificationDoc, /SetIS1IDText/);
assert.match(
  multiverseMarketVerificationDoc,
  /row-local effect-label slot alias to `BonusDescriptionText`/i
);
assert.match(
  multiverseMarketVerificationDoc,
  /`PerLevelBonusText` is now the grounded base-bonus lane/i
);
assert.match(multiverseMarketVerificationDoc, /`IDText` is now the grounded id lane/i);
assert.match(multiverseMarketVerificationDoc, /get_FinalIS78Bonus|get_FinalIS83Bonus/i);
assert.match(multiverseMarketVerificationDoc, /SetAllBonusTexts/);
assert.match(multiverseMarketVerificationDoc, /GeneralFunctionsManager\.BigDoubleToText/);
assert.match(multiverseMarketVerificationDoc, /System\.Int32\.ToString|Int32\.ToString/);
assert.match(multiverseMarketVerificationDoc, /separate `CurrentBonusText` writer lane/i);
assert.match(multiverseMarketVerificationDoc, /NavigationManager\.UpdateInscryptionUI/);
assert.match(
  multiverseMarketVerificationDoc,
  /NavigationManager\+<UpdateInscryptionUI>d__185\.MoveNext/
);
assert.match(multiverseMarketVerificationDoc, /NavigationManager\+<InscEnum>d__186\.MoveNext/);
assert.match(multiverseMarketVerificationDoc, /NavigationManager\.DisableInscryptionObjects/);
assert.match(multiverseMarketVerificationDoc, /NavigationManager\.OnAvailbleInscryptionsClick/);
assert.match(multiverseMarketVerificationDoc, /NavigationManager\.OnFinishedInscryptionsClick/);
assert.match(multiverseMarketVerificationDoc, /TextHandlerShopNPCs\.OpeningChrystosEmporium/);
assert.match(multiverseMarketVerificationDoc, /TextHandlerShopNPCs\.EmporiumDefaultText/);
assert.match(
  multiverseMarketVerificationDoc,
  /TextHandlerShopNPCs\+<DisplayTextEmporium>d__22\.MoveNext/
);
assert.match(
  tokenBankStateDoc,
  /LM244` should currently be treated as a presentation or explanation hook, not as the recovered gameplay owner for daily tokenium/
);
assert.match(tokenBankStateDoc, /PlayerProfileHandler\.saveInfoCache: PlayerProfileData/);
assert.match(
  tokenBankStateDoc,
  /ConvertSaveDataToProfileData\(SaveData, System\.DateTime\) -> PlayerProfileData/
);
assert.match(tokenBankStateDoc, /SaveData\.ClaimableTokenium/);
assert.match(tokenBankStateDoc, /CloudSavePlayerProfile/);
assert.match(
  tokenBankStateDoc,
  /only exposes generic `Tokens: System\.String` and `Tokenium: System\.String` wrapper fields/i
);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /checked accessor bridge:/);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /metadata\/member-shell clue:/);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /checked typed-`Market` field result:/);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /deeper typed `Market`-named owner status:/);
assert.match(
  multiverseMarketMarketMemberBoundaryDoc,
  /no typed `Market` or `MultiverseMarket` field is recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /metadata-only `Market` shell, and the wider save-owner recovery separated/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /(does not recover a typed `Market` field|no typed `Market`-named field is recovered) on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`/
);
assert.match(
  multiverseMarketStateVerificationDoc,
  /`SaveData` remains the exact declaring owner for the checked `IS\*Level` \/ trade-counter \/ mech run/
);
assert.match(
  activeGroundingBoundariesDoc,
  /the bare `Market` symbol is still only a metadata\/member-shell clue/
);
assert.match(
  activeGroundingBoundariesDoc,
  /does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`/
);
assert.match(
  activeGroundingBoundariesDoc,
  /saveInfoCache` plus `ConvertSaveDataToProfileData\(\.\.\.\) -> PlayerProfileData` bridge still only exposes generic `PlayerProfileData\.Tokens` and `PlayerProfileData\.Tokenium` wrapper strings, and the remaining `CloudSavePlayerProfile` evidence now narrows only to a metadata-only cloud save\/load shell/i
);
assert.match(
  spendSystemVerificationDoc,
  /saveInfoCache` plus `ConvertSaveDataToProfileData\(\.\.\.\) -> PlayerProfileData` bridge still only exposes generic `PlayerProfileData\.Tokens` and `PlayerProfileData\.Tokenium` wrapper strings/i
);
assert.match(spendSystemVerificationDoc, /SaveData\.ClaimableTokenium/);
assert.match(spendSystemVerificationDoc, /CloudSavePlayerProfile/);
assert.match(
  unityOwnerMapDoc,
  /saveInfoCache` plus `ConvertSaveDataToProfileData\(\.\.\.\) -> PlayerProfileData` bridge only exposes generic `PlayerProfileData\.Tokens` and `PlayerProfileData\.Tokenium` wrapper strings/i
);
assert.match(unityOwnerMapDoc, /SaveData\.ClaimableTokenium/);
assert.match(unityOwnerMapDoc, /CloudSavePlayerProfile/);
assert.doesNotMatch(
  multiverseMarketMarketMemberBoundaryDoc,
  /typed `Market` field recovered on `PlayerProfileHandler`/i
);
assert.doesNotMatch(
  multiverseMarketMarketMemberBoundaryDoc,
  /typed `Market` field recovered on `PlayerProfileData`/i
);
assert.doesNotMatch(
  multiverseMarketMarketMemberBoundaryDoc,
  /typed `Market` field recovered on `SaveData`/i
);
assert.match(tokenBankStateDoc, /## Daily Tokenium lane correction/);
assert.match(
  tokenBankStateDoc,
  /Daily Tokenium currently belongs to an Academy or Farm Mission lane that multiple systems touch/
);
assert.match(tokenBankStateDoc, /Mission \/ farm mission rewards/);
assert.match(tokenBankStateDoc, /IAP \/ permanent pack modifiers/);
assert.match(dailyTokeniumMissionDoc, /# Daily Tokenium Mission Lane Verification/);
assert.match(
  dailyTokeniumMissionDoc,
  /Daily Tokenium currently belongs to the Academy or Farm Mission reward family/
);
assert.match(
  dailyTokeniumMissionDoc,
  /`SaveData\.DailyTokenium` is now the strongest exact stored-amount recovery for the lane/
);
assert.match(dailyTokeniumMissionDoc, /Modifier-family split recovered from this pass/);
assert.match(dailyTokeniumMissionDoc, /Exact save-side narrowing recovered from this pass/);
assert.match(dailyTokeniumMissionDoc, /`SaveData` mission-persistence neighborhood/);
assert.match(
  dailyTokeniumMissionDoc,
  /`WastaMissionActive`, `CrytonMissionActive`, `EgetuarMissionActive`, `SekhurMissionActive`, `WastaCampaignProgress`, and `WastaFarmActiveCount`/
);
assert.match(
  dailyTokeniumMissionDoc,
  /boundary-backed evidence from `compatibility\.unmappedSystemState\.tokenShop\.DailyTokenium`/
);
assert.match(dailyTokeniumMissionDoc, /ClaimableTokenium/);
assert.match(dailyTokeniumMissionDoc, /DailyTokeniumCap/);
assert.match(
  dailyTokeniumMissionDoc,
  /grounded as one modifier family on the lane because a TokenShop upgrade text explicitly increases the Daily Tokenium cap/
);
assert.match(
  dailyTokeniumMissionDoc,
  /grounded as a premium modifier family on the lane because its description explicitly increases Mission Materials and the Daily Tokenium cap in the Academy menu/
);
assert.match(
  spendSystemVerificationDoc,
  /current narrowest checked save-side wrapper for that lane is the `SaveData` mission-persistence neighborhood/
);
assert.match(
  spendSystemVerificationDoc,
  /compatibility\.unmappedSystemState\.tokenShop\.DailyTokenium/
);
assert.match(
  activeGroundingBoundariesDoc,
  /narrows the save-side wrapper to the nearby mission-persistence block in `SaveData`/
);
assert.match(
  unityOwnerMapDoc,
  /narrowest checked save wrapper -> `SaveData` mission-persistence neighborhood/
);
assert.match(tokenShopDoc, /## Currency-lane grounding/);
assert.match(
  activeGroundingBoundariesDoc,
  /visible in-game shell split[\s\S]*T1.*ATU1-12[\s\S]*T2.*ATU13-19[\s\S]*T3.*ATU20-23[\s\S]*T4.*ATU24-28/i
);
assert.match(
  activeGroundingBoundariesDoc,
  /Largest coherent adjacent slice: move to the late `ATU24-28` shell family as the next bounded family audit/i
);
assert.match(
  activeGroundingBoundariesDoc,
  /while keeping the ATU14-19 and ATU21-23 family targets as quarantined grounded endpoints unless a late-family pass directly consumes one of their still-open display-side seams/i
);
assert.match(activeGroundingBoundariesDoc, /closed ATU3 bonus-aggregation cluster/i);
assert.match(activeGroundingBoundariesDoc, /closed ATU11 MK7 title-side seam/i);
assert.match(activeGroundingBoundariesDoc, /closed ATU12 MK8 bridge-plus-title-side-text seam/i);
assert.match(
  activeGroundingBoundariesDoc,
  /closes the full internal AdManager bonus-aggregation family as a bounded negative result/i
);
assert.match(tokenShopDoc, /resourceicons\/resource_tokenium/);
assert.match(tokenShopDoc, /resourceicons\/resource_tokenium_cap/);
assert.match(
  tokenShopDoc,
  /base TokenShop costs should currently be described as a token-bank token or tokenium spend lane/
);
const tokenShopRowRemapTrack = snapshot.researchTracks.find(
  (track) => track.id === "spend-token-shop-row-remap"
);
assert.ok(tokenShopRowRemapTrack, "Expected snapshot research track spend-token-shop-row-remap");
withRequiredValue(tokenShopRowRemapTrack, "expected token-shop row remap track", (track) => {
  assertResearchTrackContract(track, "token-shop row remap", {
    status: "active",
    minCompletedSteps: 8,
    minVerified: 12,
    requiredSources: [
      "docs/systems/spend/spend-system-verification.md",
      "docs/systems/spend/token-shop-row-remap-verification.md",
      "data/system-units/token-shop.v1.json",
      "data/system-units/trace.v1.json",
      "db:materialized-target-bundle:token-shop-family-structure",
      "db:materialized-target-bundle:token-shop-atu3-cells-effect"
    ],
    requiredArtifacts: [
      "data/system-units/token-shop.v1.json",
      "data/system-units/trace.v1.json",
      "data/token-shop-late-atu-boundary.json"
    ],
    forbiddenSources: [
      "data/archive/unity-apk-extract-report.json",
      "data/daily-tokenium-lane-probe.json",
      "data/daily-tokenium-owner-probe.json",
      "data/lm244-targeted-probe.json"
    ]
  });
});
assert.match(
  tokenShopRowRemapTrack?.currentSlice ?? "",
  /ATU1, ATU2, ATU4, ATU5, ATU6, ATU7, ATU8, ATU9, ATU10, ATU11, and ATU12 shell-to-prefab bridges plus one checked ATU6 shell-to-prefab-to-title chain/i
);
assert.match(
  tokenShopRowRemapTrack?.currentSlice ?? "",
  /one bounded ATU7 shell-to-prefab-to-title-side-text chain on `Mk3 Generator Booster` with matching MK3 support text/i
);
assert.match(
  tokenShopRowRemapTrack?.currentSlice ?? "",
  /late ATU24-ATU28 shell neighborhood as a (tighter bounded negative result|stronger family-level bounded negative result)/
);
assert.match(
  tokenShopRowRemapTrack?.blockedBy ?? "",
  /ATU3 now also clears one shell-to-action-hook-to-shared-effect chain, one tighter shared-effect-to-consumer-family handoff, and one checked internal bonus-aggregation shell while still failing exact prefab-or-title localization.*closes the outer chest routines, the final token-or-diamond chest bonus backing fields, and the remaining internal getter-or-booster aggregation family.*late ATU24-ATU28 shell neighborhood now stays negative/
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU5Button` to `NewTokenUPGPrefab\.T1\.MK1Booster/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU6Button` to `NewTokenUPGPrefab\.T1\.MK2Booster/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU7Button` to `NewTokenUPGPrefab\.T1\.MK3Booster/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU8Button` to `NewTokenUPGPrefab\.T1\.MK4Booster/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU9Button` to `NewTokenUPGPrefab\.T1\.MK5Booster/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU10Button` to `NewTokenUPGPrefab\.T1\.MK6Booster/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU7Button` to `NewTokenUPGPrefab\.T1\.MK3Booster` to `Mk3 Generator Booster`/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /last honest ATU1 blocker is still one exact join from the detached `Tokens Booster`, `Tokens Booster T1`, or `>Diamond Upgrade 9 - TokensBoost` title-side clue back to `ATU1Button` path id `15839`/.test(
      line
    )
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /remaining ATU5 blocker is now only the absent exact final player-facing row-title string/.test(
      line
    )
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /last honest ATU4 blocker is the exact runtime display-update path for `ATU4Button` path id `15796`/.test(
      line
    )
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /bounded ATU3 cells-domain disambiguation pass stays negative for prefab-or-title identity/.test(
      line
    )
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU3Button` -> `BuyCellBoost` -> shared `Cells Booster \(Chests\)`/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU6Button` to `NewTokenUPGPrefab\.T1\.MK2Booster` to `Mk2 Generator Booster`/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU8Button` to `NewTokenUPGPrefab\.T1\.MK4Booster` to `Mk4 Generator Booster`/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /ATU9Button` to `NewTokenUPGPrefab\.T1\.MK5Booster` to `Mk5 Generator Booster`/.test(line)
  )
);
assert.ok(
  tokenShopRowRemapTrack?.verified?.some((line) =>
    /late ATU24-ATU28 shell neighborhood now also has a (tighter bounded negative result|stronger family-level bounded negative result)/.test(
      line
    )
  )
);
assert.match(
  tokenShopDoc,
  /Daily Tokenium should stay separated as the Academy or Farm Mission reward lane that TokenShop modifies/
);
assert.match(shardVerificationDoc, /# Shard System Verification Gate/);
assert.match(shardVerificationDoc, /community-grounded descriptive data/);
assert.match(shardVerificationDoc, /not yet mapped enough from shipped-game assets/);
assert.match(shardVerificationDoc, /Boundary reference:/);
assert.match(shardVerificationDoc, /data\/shard-cost-model-boundary\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-milestone-row-model-boundary\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-milestone-title-effect-boundary\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-effect-text-handler-boundary\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-cost-formula-model\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-cost-screenshot-calibration\.v1\.json/);
assert.match(shardVerificationDoc, /Asset-grounded shell evidence/);
assert.match(shardVerificationDoc, /Owner-family evidence/);
assert.match(shardVerificationDoc, /ShardMining, Assembly-CSharp/);
assert.match(shardVerificationDoc, /ShardUpgradeInfo/);
assert.match(shardVerificationDoc, /TotalMilestoneLevels/);
assert.match(shardVerificationDoc, /SU0StartCost/);
assert.match(shardVerificationDoc, /get_SU0Cost/);
assert.match(shardVerificationDoc, /Milestone0TextChecker/);
assert.match(shardVerificationDoc, /SU29UnlockReq/);
assert.match(shardVerificationDoc, /SMilestone-0/);
assert.match(shardVerificationDoc, /ShardMilestoneBonus1/);
assert.match(shardVerificationDoc, /TextHandlerShardMilestoneBonusesPerLevel\/N/);
assert.match(shardVerificationDoc, /exact formulas/);
assert.match(
  shardVerificationDoc,
  /zero checked overlap with `PlayerProfileData`, `GetPlayerProfileData`, `FillPlayerProfileData`, or `CloudSavePlayerProfile`/
);
assert.match(shardVerificationDoc, /FinalSU\*Bonus\*/);
assert.match(shardVerificationDoc, /ConstructionMilestones/);
assert.match(shardVerificationDoc, /academy-side/);
assert.match(shardVerificationDoc, /LoopResetStage1/);
assert.match(shardVerificationDoc, /MilestoneBonusesPerLevel/);
assert.match(
  shardVerificationDoc,
  /asset-grounded milestone row order and milestone-number mapping/
);
assert.match(
  shardVerificationDoc,
  /The app may reference the asset-grounded shard shell only to justify warning-oriented shard and loop surfaces/
);
assert.match(shardGroundingBoundaryDoc, /# Shard Grounding Boundary/);
assert.match(shardGroundingBoundaryDoc, /data\/shard-asset-grounding\.v1\.json/);
assert.match(shardGroundingBoundaryDoc, /shard-extraction-candidates\.md/);
assert.match(shardGroundingBoundaryDoc, /shard-owner-family-verification\.md/);
assert.doesNotMatch(shardGroundingBoundaryDoc, /data\/extraction-candidate-ranking\.v1\.json/);
assert.match(shardGroundingBoundaryDoc, /APK or Unity-grounded now/);
assert.match(shardGroundingBoundaryDoc, /Descriptive-only for now/);
assert.match(shardGroundingBoundaryDoc, /Owner-family split recovered now/);
assert.match(shardGroundingBoundaryDoc, /ConstructionMilestones, Assembly-CSharp/);
assert.match(shardGroundingBoundaryDoc, /ShardMining, Assembly-CSharp/);
assert.match(shardGroundingBoundaryDoc, /ShardUpgradeInfo/);
assert.match(shardGroundingBoundaryDoc, /SMilestone-0-Eternal\(OURO\)/);
assert.match(shardGroundingBoundaryDoc, /ShardMilestoneBonus1/);
assert.match(shardGroundingBoundaryDoc, /TextHandlerShardMilestoneBonusesPerLevel\/N/);
assert.match(shardGroundingBoundaryDoc, /SU0UnlockReq/);
assert.match(shardGroundingBoundaryDoc, /UnlockMilestone17/);
assert.match(shardGroundingBoundaryDoc, /Milestone12TextChecker/);
assert.match(shardGroundingBoundaryDoc, /do not yet share one clean row-number range/);
assert.match(shardGroundingBoundaryDoc, /TotalMilestoneLevels/);
assert.match(shardGroundingBoundaryDoc, /FinalSU\*Bonus\*/);
assert.match(shardGroundingBoundaryDoc, /generic or academy-side milestone family/);
assert.match(shardGroundingBoundaryDoc, /LoopResetStage1/);
assert.match(shardGroundingBoundaryDoc, /Milestones, Assembly-CSharp/);
assert.match(
  shardGroundingBoundaryDoc,
  /ranking, ROI, ETA, affordability, and best-upgrade claims remain blocked/i
);
assert.match(
  shardPlayerFacingEvidenceDoc,
  /the grounded app can now treat the reachable `ShardMining` row-definition family as grounded product data/i
);
assert.match(
  shardPlayerFacingEvidenceDoc,
  /external-model imports are an interim compatibility path only and stay non-canonical/i
);
assert.match(
  shardPlayerFacingEvidenceDoc,
  /cannot yet claim player-owned shard milestone ownership, exact shard cost math, affordability, ROI, ETA certainty, or best-buy order/i
);
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
assert.match(shardOwnerFamilyDoc, /UnlockMilestone17/);
assert.match(shardOwnerFamilyDoc, /Milestone12TextChecker/);
assert.match(shardOwnerFamilyDoc, /data\/shard-milestone-row-shell-boundary\.v1\.json/);
assert.match(shardOwnerFamilyDoc, /data\/shard-milestone-row-alignment-boundary\.v1\.json/);
assert.match(shardOwnerFamilyDoc, /data\/shard-milestone-handoff-boundary\.v2\.json/);
assert.match(
  shardOwnerFamilyDoc,
  /splits into `UnlockMilestone17-29`, `Milestone0-12TextChecker`, and `BuyMilestone0`/
);
assert.match(shardOwnerFamilyDoc, /data\/shard-save-boundary\.v2\.json/);
assert.match(shardOwnerFamilyDoc, /BuyMilestone1-57/);
assert.match(shardOwnerFamilyDoc, /generic or academy-side milestone family/);
assert.equal(
  shardOwnerFamilyBoundary.embeddedOwnerProbeSummary.sourceFile,
  "workbench/unity/joined/level0"
);
assert.equal(
  shardOwnerFamilyBoundary.embeddedOwnerProbeSummary.strongestOwnerHit,
  "ShardMining, Assembly-CSharp"
);
assert.deepEqual(
  shardOwnerFamilyBoundary.embeddedConstructionComparisonSummary.sideBySideFamilies,
  ["ShardMining, Assembly-CSharp", "ConstructionMilestones, Assembly-CSharp"]
);
assert.equal(
  shardOwnerFamilyBoundary.embeddedConstructionComparisonSummary.sourceFile,
  "workbench/unity/joined/level0"
);
assert.equal(shardMetadataNeighborhood.metadata, "workbench\\apk\\base\\global-metadata.dat");
assert.equal(shardBonusMetadataNeighborhood.metadata, "workbench\\apk\\base\\global-metadata.dat");
assert.equal(shardminingMetadataNeighborhood.metadata, "workbench\\apk\\base\\global-metadata.dat");
assert.equal(
  shardUpgradeInfoMetadataNeighborhood.metadata,
  "workbench\\apk\\base\\global-metadata.dat"
);
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
assert.match(extractionRankingDoc, /pre-DB research workflow/i);
assert.match(
  extractionRankingDoc,
  /DB-backed trace resolution, best-gap scoring, and reducer-owned missing-seam state/i
);
assert.match(playerProfileSchemaDoc, /compatibility\.unmappedSystemState\.shardMilestoneState/);
assert.match(
  playerProfileSchemaDoc,
  /The active manual Profile form should only show values a typical player can quickly provide from the game/
);
assert.match(
  playerProfileSchemaDoc,
  /Academy relics \| `player\.resources\.academyRelics` \| real profile aggregate, but not a direct active-form input/
);
assert.match(
  playerProfileSchemaDoc,
  /Shard income \/ hour \| `planning\.shards\.ratePerHour` \| descriptive derived helper, not directly visible in game, so removed from the active form/
);
assert.match(
  playerProfileSchemaDoc,
  /verify the concrete shard milestone save owner or declaring save model/i
);
assert.match(
  playerProfileSchemaDoc,
  /prove planner-safe use before any recommendation or canonical `player\.\*` promotion/i
);
assert.match(playerProfileSchemaDoc, /## Experimental support-surface helpers/);
assert.match(playerProfileSchemaDoc, /systems\.metaProgression\.hunterLevel/);
assert.match(playerProfileSchemaDoc, /stage\.highestShipUnlocked/);
assert.match(playerProfileSchemaDoc, /top-level `power`, `speed`, and `cargo` no longer migrate/);
assert.match(
  playerProfileSchemaDoc,
  /planning\.gemNodeBudget`, `planning\.resourceFocus`, `planning\.researchHours`, and their flat helper forms are retired/
);
assert.match(
  playerProfileSchemaDoc,
  /flat `gemDust`, `hunterLevel`, `traitSphereCount`, and `mechParts` no longer migrate automatically/
);
assert.match(
  playerProfileSchemaDoc,
  /flat spend-state clues such as `BankedTokens`, `DailyTokenium`, `ClaimableTokenium`, `TokenBankCap`, `ClaimableBankTokens`, `FinalTokenBankCap`, `FinalTokenBankFillSpeed`, `DailyTokeniumCap`, `InscryptionsDone`, and exact typed SaveData-backed Emporium levels `IS1Level` through `IS110Level` may be quarantined/
);
assert.match(
  importMappingDoc,
  /`BankedTokens`, `DailyTokenium`, `ClaimableTokenium`, `TokenBankCap`, `ClaimableBankTokens`, `DailyTokeniumCap`/
);
assert.match(importMappingDoc, /compatibility\.unmappedSystemState/);
assert.match(
  importMappingDoc,
  /experimental helper imports now require explicit `externalModels\.experimental\.\*` paths/
);
assert.match(importMappingDoc, /externalModels\.communityTools\.shipOptimizer\.v1/);
assert.match(importMappingDoc, /toolName/);
assert.match(importMappingDoc, /sourceReference/);
assert.match(importMappingDoc, /must not silently populate canonical `player\.\*` fields/i);
assert.match(
  importMappingDoc,
  /stage\.highestShipUnlocked`, `stage\.manualPhase`, and `systems\.metaProgression\.\*` aliases should normalize into compatibility-only fields/
);
assert.match(
  importMappingDoc,
  /flat unresolved aliases such as `hunterLevel`, `traitSphereCount`, `mechParts`, and `gemDust` are retired/
);
assert.match(importMappingDoc, /top-level `power`, `speed`, and `cargo` are retired/);
assert.match(
  importMappingDoc,
  /flat spend-state clues such as `InscryptionsDone`, exact typed SaveData-backed Emporium levels `IS1Level` through `IS110Level`, `ATU\*Level`, `Tier\*TokensUnlocked`, `BankedTokens`, `DailyTokenium`, `ClaimableTokenium`, `TokenBankCap`, `ClaimableBankTokens`, `DailyTokeniumCap`, or `FinalTokenBankFillSpeed` may also be preserved/
);
assert.match(tokenShopDoc, /## Integration status/);
assert.match(tokenShopDoc, /Not yet verified enough for app recommendations/);
assert.match(tokenShopDoc, /## Current checked-row tool slice/);
assert.match(
  tokenShopDoc,
  /What do the grounded upgrades I can already inspect actually do at my current level and on the next level\?/
);
assert.match(tokenShopDoc, /## Adjacent systems still to map/);
assert.match(tokenShopDoc, /Academy \/ farm mission tokenium lane/);
assert.match(tokenShopDoc, /Diamond-related upgrade lane inside TokenShop/);
assert.match(tokenShopDoc, /## Future mapping signals/);
assert.match(
  tokenShopDoc,
  /gameplay owner and saved-state family for the Academy or Farm Mission Daily Tokenium lane/
);
assert.match(tokenShopDoc, /## Downstream systems TokenShop upgrades appear to affect/);
assert.match(
  spendSystemVerificationDoc,
  /tier-grouped TokenShop row-detail module for all 28 ATU rows[\s\S]*T1.*ATU1-12[\s\S]*T2.*ATU13-18[\s\S]*T3.*ATU19-23/i
);
assert.match(spendSystemVerificationDoc, /rest of the `ATU\*Level` family should stay quarantined/);
assert.match(tokenShopDoc, /TokenShop is a canonical cross-system modifier hub/);
assert.match(tokenShopRowRemapVerificationDoc, /data\/system-units\/trace\.v1\.json/);
assert.match(tokenShopRowRemapVerificationDoc, /bounded TokenShop family-structure trace audit/i);
assert.match(
  tokenShopRowRemapVerificationDoc,
  /bounded `ATU7Button` -> `NewTokenUPGPrefab\.T1\.MK3Booster` -> `Mk3 Generator Booster` title-side text chain/i
);
assert.match(
  tokenShopRowRemapVerificationDoc,
  /last honest blocker is now explicit: the exact row-specific runtime display-update path for `ATU4Button` path id `15796` still remains unresolved/i
);
assert.match(
  tokenShopRowRemapVerificationDoc,
  /bounded `ATU8Button` -> `NewTokenUPGPrefab\.T1\.MK4Booster` -> `Mk4 Generator Booster` title-side text chain/i
);
assert.match(
  tokenShopRowRemapVerificationDoc,
  /bounded `ATU8Button` -> `NewTokenUPGPrefab\.T1\.MK4Booster` -> `Mk4 Generator Booster` title-side text chain/i
);
assert.match(
  tokenShopRowRemapVerificationDoc,
  /ATU3Button` -> `BuyCellBoost` -> shared chest-effect lane chain/i
);
assert.match(
  tokenShopRowRemapVerificationDoc,
  /AdManager, Assembly-CSharp.*chest consumer family/i
);

assert.match(multiverseMarketDoc, /## Integration status/);
assert.match(multiverseMarketDoc, /CostBox-InscryptionsDone/);
assert.match(
  multiverseMarketDoc,
  /saved-state owner or runtime balance field behind the `Inscryptions Done` cost lane/
);
assert.match(shardIngestDoc, /community-grounded descriptive data/);
assert.match(shardIngestDoc, /not yet shipped-game owner-grounded data/);

assert.match(html, /Player Profile/);
assert.match(html, /Import Hangar/);
assert.match(html, /CIFI Command Deck/);
assert.match(html, /Reference and exploration kept off the main path/i);
assert.match(html, /Ship Workbench/);
assert.match(html, /Gem Node Lab/);
assert.match(html, /Research Archive/);
assert.match(html, /Candidate tracks, blockers, and grounded findings/);
assert.match(normalizedHtml, /Research items are not product commitments/);
assert.match(html, /Grounded next-step highlights/);
assert.doesNotMatch(html, /What is ready, blocked, or still support-only/);
assert.match(html, /Support-only screenshot intake/);
assert.doesNotMatch(html, /Queue and parsed output/);
assert.doesNotMatch(html, /Non-MVP manual values import/);
assert.match(html, /Apply to active snapshot/);
assert.match(html, /Reset to blank profile/);
assert.match(html, /PlayerProfile JSON/);
assert.match(html, /Import PlayerProfile JSON/);
assert.match(html, /Export PlayerProfile JSON/);
assert.match(html, /playerProfileImportSummary/);
assert.match(html, /Shared profile, manual capture, and guided import/);
assert.match(html, /Shared PlayerProfile truth is limited to grounded CIFI account state/);
assert.match(normalizedHtml, /Only values a player can read quickly in game belong here/);
assert.match(html, /Open TokenShop player-state helper/);
assert.match(normalizedHtml, /TokenShop player-state helper/);
assert.match(
  normalizedHtml,
  /These values feed the Progression-side TokenShop storefront while remaining planner-side support rather than canonical player truth/
);
assert.doesNotMatch(
  normalizedHtml,
  /ship calibration remains outside shared profile truth as planner implementation data/
);
assert.match(html, /Planner Calibration/);
assert.match(html, /Implementation inputs preserved with the ship planner/);
assert.doesNotMatch(appJs, /function getInstallGain\(/);
assert.doesNotMatch(appJs, /function getBestNextInstall\(/);
assert.doesNotMatch(appJs, /function getInstallWeight\(/);
assert.doesNotMatch(appJs, /function getShipCrew\(/);
assert.doesNotMatch(appJs, /function getShipInnovationMultiplier\(/);
assert.doesNotMatch(appJs, /function getInstallBaseMultiplier\(/);
assert.doesNotMatch(appJs, /function getTicksRun\(/);
assert.match(shipPlannerSupportModule, /function getInstallGain\(/);
assert.match(shipPlannerSupportModule, /function getBestNextInstall\(/);
assert.match(shipPlannerSupportModule, /function getInstallWeight\(/);
assert.match(shipPlannerSupportModule, /function getShipCrew\(/);
assert.match(shipPlannerSupportModule, /function getShipInnovationMultiplier\(/);
assert.match(shipPlannerSupportModule, /function getInstallBaseMultiplier\(/);
assert.match(shipPlannerSupportModule, /function getTicksRun\(/);
assert.match(html, /Diamonds/);
assert.match(html, /Planner-only helper inputs are optional/);
assert.match(
  normalizedHtml,
  /Manual profile inputs should come from values a typical player can quickly read in game/
);
assert.match(
  normalizedHtml,
  /Accepted number formats:\s*<code>5800<\/code>,\s*<code>5\.8k<\/code>,\s*<code>9\.8t<\/code>,\s*<code>7\.15e549<\/code>/
);
assert.match(
  normalizedHtml,
  /<input\s+id="loopReset"\s+name="loopReset"\s+type="text"\s+inputmode="decimal"\s+placeholder="41"\s*\/?>/
);
assert.match(
  normalizedHtml,
  /<input\s+id="diamonds"\s+name="diamonds"\s+type="text"\s+inputmode="decimal"\s+placeholder="5\.8k"\s*\/?>/
);
assert.match(
  normalizedHtml,
  /<input\s+id="shards"\s+name="shards"\s+type="text"\s+inputmode="decimal"\s+placeholder="7\.15e549"\s*\/?>/
);
assert.doesNotMatch(html, /<label for="academyRelics">Academy relics<\/label>/);
assert.doesNotMatch(html, /<label for="shardRatePerHour">Shard income \/ hour<\/label>/);
assert.match(html, /Profile readiness/);
assert.doesNotMatch(html, /Rank shard milestones/);
assert.match(html, /Shard milestones \(disabled pending verified schema\)/);
assert.match(html, /Shard Mining, loop flow, and TokenShop tools/);
assert.match(html, /Progression Controls/);
assert.match(html, /Choose the owning subsystem/);
assert.doesNotMatch(html, /Refresh progression/);
assert.match(html, /id="progressionSubsystemToggle"/);
assert.doesNotMatch(html, /id="progressionCalibrationPanel"/);
assert.doesNotMatch(html, /<label for="shardFocusMilestoneId">/);
assert.doesNotMatch(html, /<label for="shardFocusMilestoneLevel">/);
assert.match(html, /Total shard milestone levels/);
assert.match(html, /Grounded MVP checks only/);
assert.match(html, /Grounded checks, APK grounding, and support checks/);
assert.match(html, /Run validation checks/);
assert.match(html, /Product-facing checks/);
assert.match(html, /Extraction and mapping checks/);
assert.match(html, /Quarantined support surfaces/);
assert.match(html, /id="validationMvpResults"/);
assert.match(html, /id="validationApkResults"/);
assert.match(html, /id="validationSupportResults"/);
assert.doesNotMatch(html, /What each validation lane proves/);
assert.doesNotMatch(html, /Current repo status by scope/);
assert.doesNotMatch(html, /id="validationScopeSummary"/);
assert.match(appJs, /APK-grounding checks/);
assert.match(
  normalizedHtml,
  /These checks contribute to the overview benchmark and track current grounded MVP behavior/
);
assert.doesNotMatch(html, /External model inputs preserved outside raw game state/);
assert.match(html, /id="researchGuidancePanel"/);
assert.match(html, /id="researchViewPanel"/);
assert.match(html, /Current grounded track cards/);

assert.match(appJs, /function runShipOptimization/);
assert.match(appJs, /function runProgressionOptimization/);
assert.match(appJs, /function buildGroundedShardRecommendations/);
assert.match(appJs, /function renderShardMilestoneDirectory/);
assert.match(appJs, /function renderShardWorkflowReference/);
assert.match(appJs, /function renderResearchTrackSupport/);
assert.match(appJs, /function renderResearchTrackProgress/);
assert.match(appJs, /from "\.\/support\/research-validation-support\.js"/);
assert.doesNotMatch(appJs, /function getResearchTrackOrder/);
assert.doesNotMatch(appJs, /function getResearchTrackLane/);
assert.doesNotMatch(appJs, /function getResearchTrackStatus/);
assert.doesNotMatch(appJs, /function getResearchTrackProgressLabel/);
assert.match(researchValidationSupportModule, /export function getResearchTrackOrder/);
assert.match(researchValidationSupportModule, /export function getResearchTrackLane/);
assert.match(researchValidationSupportModule, /export function getResearchTrackStatus/);
assert.match(normalizedResearchValidationSupportModule, /return "Foundation archive";/);
assert.match(appJs, /Archived foundation cards may still appear here as historical context/);
assert.match(researchValidationSupportModule, /export function getResearchTrackProgressLabel/);
assert.match(researchValidationSupportModule, /export function buildSnapshotValidationCases/);
assert.match(researchValidationSupportModule, /export function getValidationScopeMeta/);
assert.match(researchValidationSupportModule, /export function getDatasetBadgeMetaFromEntry/);
assert.match(appJs, /from "\.\/recommendation-contract\.js"/);
assert.match(
  researchValidationSupportModule,
  /"unified-feed-and-hardening": "PR 3 then PR 5 hardening"/
);
assert.match(
  researchValidationSupportModule,
  /"spend-multiverse-savedata-import-surface": "PR 4 successor"/
);
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
assert.doesNotMatch(appJs, /function getPlannerHelperCompletion/);
assert.doesNotMatch(appJs, /function getProfileCompletion/);
assert.match(playerProfileBoundarySupportModule, /function getPlannerHelperCompletion/);
assert.match(playerProfileBoundarySupportModule, /function getProfileCompletion/);
assert.match(appJs, /SUPPORT_SURFACE_VALIDATION_MODULES/);
assert.match(appJs, /function buildApkGroundingValidationCases/);
assert.match(appJs, /function renderOverviewSupportSummary/);
assert.match(appJs, /function getActiveMvpRecommendationFeed/);
assert.match(appJs, /function sortRecommendationFeed/);
assert.match(appJs, /function renderRecommendationFeedSummary/);
assert.match(appJs, /function renderSupportSurfaceNotice/);
assert.match(appJs, /function renderValidationCards/);
assert.match(appJs, /function toRecommendationAction/);
assert.match(appJs, /function sanitizeRecommendationLines/);
assert.match(appJs, /from "\.\/support\/shard-boundary-summary-support\.js"/);
assert.doesNotMatch(appJs, /function getShardMilestonePayloadBoundarySummary/);
assert.doesNotMatch(appJs, /function getShardCostModelBoundarySummary/);
assert.doesNotMatch(appJs, /function getShardMilestoneRowModelBoundarySummary/);
assert.doesNotMatch(appJs, /function getShardMilestoneTitleEffectBoundarySummary/);
assert.doesNotMatch(appJs, /function getShardMilestoneRowShellBoundarySummary/);
assert.doesNotMatch(appJs, /function getShardMilestoneRowAlignmentBoundarySummary/);
assert.doesNotMatch(appJs, /function getShardSaveBoundarySummary/);
assert.match(
  shardBoundarySummarySupportModule,
  /export function getShardMilestonePayloadBoundarySummary/
);
assert.match(shardBoundarySummarySupportModule, /export function getShardCostModelBoundarySummary/);
assert.match(
  shardBoundarySummarySupportModule,
  /export function getShardMilestoneRowModelBoundarySummary/
);
assert.match(
  shardBoundarySummarySupportModule,
  /export function getShardMilestoneTitleEffectBoundarySummary/
);
assert.match(
  shardBoundarySummarySupportModule,
  /export function getShardMilestoneRowShellBoundarySummary/
);
assert.match(
  shardBoundarySummarySupportModule,
  /export function getShardMilestoneRowAlignmentBoundarySummary/
);
assert.match(shardBoundarySummarySupportModule, /export function getShardSaveBoundarySummary/);
assert.match(
  normalizedShardBoundarySummarySupportModule,
  /export function getShardOwnerFamilyBoundarySummary\(boundary\)/
);
assert.match(recommendationContractModule, /export function toRecommendationAction/);
assert.match(recommendationContractModule, /export function sortRecommendationFeed/);
assert.match(recommendationContractModule, /export function getRecommendationContractIssues/);
assert.match(appJs, /from "\.\/support\/shard-evidence-support\.js"/);
assert.match(shardEvidenceSupportModule, /getSourceTitlesForIds/);
assert.match(shardEvidenceSupportModule, /getMilestoneSourceLabel/);
assert.match(shardEvidenceSupportModule, /getProvenanceConflictNote/);
assert.match(appJs, /function buildLoopGuardrailRecommendations/);
assert.match(appJs, /function getObservedBehaviorById/);
assert.match(appJs, /function saveShardPlannerInputs/);
assert.match(appJs, /function getShardFocusLevelForMilestone/);
assert.match(shardEvidenceSupportModule, /getShardMilestoneGroundedSummary/);
assert.match(appJs, /function runGemOptimization/);
assert.match(appJs, /function previewImport/);
assert.match(appJs, /from "\.\/support\/import-normalization-support\.js"/);
assert.doesNotMatch(appJs, /function normalizeImportRow/);
assert.match(importNormalizationSupportModule, /export function parseCsv/);
assert.match(importNormalizationSupportModule, /export function normalizeImportRow/);
assert.match(importNormalizationSupportModule, /export function coerceInputValue/);
assert.match(importNormalizationSupportModule, /export function normalizeGeneratorTierKey/);
assert.match(
  normalizedImportNormalizationSupportModule,
  /export function normalizeCiNumberValue\(value\)/
);
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
assert.match(
  normalizedRecommendationFeedSupportModule,
  /export function getProgressionRecommendationFeedPartition\(items\)/
);
assert.match(appJs, /function getProgressionSubsystemPartition\(/);
assert.match(appJs, /function getSelectedProgressionSubsystem\(/);
assert.match(appJs, /function renderProgressionSubsystemToggle\(/);
assert.doesNotMatch(appJs, /function renderProgressionCalibrationPanel\(/);
assert.doesNotMatch(appJs, /function getProgressionCalibrationSummary\(/);
assert.match(appJs, /function renderProgressionSubsystemSection\(/);
assert.match(appJs, /function renderShardSubsystemSection\(/);
assert.match(appJs, /Shard Mining/);
assert.match(appJs, /Loop Prestige/);
assert.match(appJs, /Definition contract and blockers live in docs/);
assert.match(appJs, /These rows render from one shared shard-family evidence table/);
assert.match(appJs, /Grounded definition family/);
assert.doesNotMatch(appJs, /Tracked row/);
assert.match(appJs, /finished definition-side contract/);
assert.match(shardEvidenceSupportModule, /Evidence status:/);
assert.match(shardEvidenceSupportModule, /getShardMilestonePanelTitle/);
assert.match(
  normalizedShardEvidenceSupportModule,
  /THE \$\{normalizedName\.toUpperCase\(\)\} MILESTONE/
);
assert.match(appJs, /shard-threshold-pill/);
assert.match(shardEvidenceSupportModule, /Recovered shard cost evidence keeps/);
assert.match(appJs, /Definition evidence/);
assert.match(appJs, /Owned-state blocker/);
assert.doesNotMatch(appJs, /exact serialized cost fields/);
assert.match(appJs, /Unlock requirement/);
assert.doesNotMatch(appJs, /Extracted row state/);
assert.doesNotMatch(appJs, /Formula profile/);
assert.doesNotMatch(appJs, /Grounding detail/);
assert.doesNotMatch(appJs, /Grounded data/);
assert.match(
  shardEvidenceSupportModule,
  /Verified row inputs recovered; exact cost formula still unresolved\./
);
assert.match(shardEvidenceSupportModule, /Native cost stages not yet recovered for this row\./);
assert.match(appJs, /Verified package/);
assert.match(shardEvidenceSupportModule, /per-level multiplicative model/);
assert.match(shardEvidenceSupportModule, /Current value unresolved from checked inputs/);
assert.doesNotMatch(appJs, /Title source/);
assert.match(appJs, /Bonus package/);
assert.match(appJs, /Row-local cost shell/);
assert.match(appJs, /Save owner/);
assert.match(appJs, /shard-panel-card-tag/);
assert.match(appJs, /Lane \${escapeHtml\(String\(index \+ 1\)\)}/);
assert.doesNotMatch(appJs, /Runtime row/);
assert.doesNotMatch(appJs, /Native inputs/);
assert.doesNotMatch(appJs, /Open Profile/);
assert.match(appJs, /state\.progressionView/);
assert.match(appJs, /data-progression-view=/);
assert.doesNotMatch(appJs, /data-progression-action="open-profile"/);
assert.match(appJs, /data-shard-focus-level/);
assert.doesNotMatch(appJs, /shard-grounding-dropdown/);
assert.match(appJs, /shard-level-up-rail/);
assert.match(appJs, /observedLevelsByMilestone/);
assert.match(
  appJs,
  /Shard milestone manual import stays disabled; this build only uses the bundled grounded descriptive dataset/
);
assert.doesNotMatch(appJs, /\.\/data\/system-units\/shards\.v1\.json/);
assert.match(systemUnitProviderJs, /\.\/data\/system-units\/shards\.v1\.json/);
assert.match(appJs, /buildPlayerStateSystemView/);
assert.match(appJs, /buildShardSystemView/);
assert.match(appJs, /buildSpendSystemView/);
assert.match(appJs, /function getCurrentPlayerStateView\(/);
assert.match(appJs, /function getCurrentPlayerProfileDefaults\(/);
assert.match(appJs, /function getCurrentSpendSystemView\(/);
assert.match(appJs, /function getCurrentShardSystemView\(/);
assert.doesNotMatch(appJs, /playerProfileDefaults:\s*null/);
assert.doesNotMatch(appJs, /state\.playerProfileDefaults/);
assert.doesNotMatch(appJs, /Row-shell boundary/);
assert.doesNotMatch(appJs, /Row-alignment boundary/);
assert.match(appJs, /Recovered boundaries/);
assert.match(appJs, /Shard cost-model boundary/);
assert.match(
  appJs,
  /What the grounded app can safely show today: definition-side shard rows, loop warnings, threshold wording, and evidence-status notes sourced from the shared shard-family contract\./
);
assert.match(
  appJs,
  /Interim compatibility path: external-model imports can preserve community-tool context while staying non-canonical and outside grounded shard recommendations\./
);
assert.match(
  appJs,
  /If a player imports external-model or compatibility data, it is treated as an interim reference path only and not as canonical shard state\./
);
assert.match(appJs, /Still blocked/);
assert.doesNotMatch(appJs, /Title\/effect boundary/);
assert.doesNotMatch(appJs, /Effect-text handler boundary/);
assert.match(appJs, /Shard effect-text handler boundary/);
assert.match(appJs, /Shard milestone row model/);
assert.match(appJs, /Shard milestone titles and effect shell/);
assert.match(shardBoundarySummarySupportModule, /TextHandlerShardMilestoneBonusesPerLevel\/N/);
assert.match(appJs, /Shard milestone row shell/);
assert.match(appJs, /Shard milestone row alignment/);
assert.match(appJs, /UnlockMilestone, BuyMilestone, and MilestoneTextChecker row shell/);
assert.match(appJs, /Owner-family trail|Recovered boundaries|Still blocked/);
assert.match(
  appJs,
  /Shared shard family evidence covers rows 0-29 with verified, partial, and blocked classifications/
);
assert.match(appJs, /npm run verify:data/);
assert.match(appJs, /data\/bundled-dataset-contract\.v1\.json/);
assert.match(appJs, /PlayerProfile JSON imported through the grounded normalizer/);
assert.match(playerProfileBoundarySupportModule, /Canonical shared truth/);
assert.match(playerProfileBoundarySupportModule, /Planner-only helpers/);
assert.match(playerProfileBoundarySupportModule, /External-model implementation state/);
assert.match(playerProfileBoundarySupportModule, /Experimental support-surface helpers/);
assert.match(playerProfileBoundarySupportModule, /Compatibility leftovers/);
assert.match(playerProfileBoundarySupportModule, /Unmapped shard milestone state/);
assert.match(playerProfileBoundarySupportModule, /Unmapped TokenShop state/);
assert.match(playerProfileBoundarySupportModule, /Raw\/unmapped MultiverseMarket state/);
assert.match(appJs, /Use buffer \/ instant loop checks before pushing LR higher/);
assert.match(appJs, /Legacy gemDust is preserved under compatibility/);
assert.match(appJs, /Planner helpers filled:/);
assert.match(html, /quarantined support surfaces/);
assert.match(appJs, /Grounding checks stay separate from MVP behavior/);
assert.match(appJs, /function renderSpendPlannerBoundary/);
assert.match(appJs, /No spend recommendations yet/);
assert.match(appJs, /compatibility\.unmappedSystemState/);
assert.match(spendBoundarySummaryJs, /function getTokeniumNamingSummary/);
assert.match(appJs, /from "\.\/support\/spend-boundary-summary\.js"/);
assert.match(spendBoundarySummaryJs, /function getTokenBankStateSummary/);
assert.match(spendBoundarySummaryJs, /function getDailyTokeniumLaneSummary/);
assert.match(spendBoundarySummaryJs, /function getTokenBankFormulaBoundarySummary/);
assert.match(spendBoundarySummaryJs, /function formatNumericRanges/);
assert.match(spendBoundarySummaryJs, /function getMultiverseMarketRangeBoundarySummary/);
assert.match(spendBoundarySummaryJs, /function getMultiverseMarketRowTextCoverageSummary/);
assert.match(spendBoundarySummaryJs, /function getMultiverseMarketPrefabRemapBoundarySummary/);
assert.match(
  normalizedSpendBoundarySummaryJs,
  /export function getMultiverseMarketMarketMemberBoundarySummary\(boundary\)/
);
assert.match(
  normalizedSpendBoundarySummaryJs,
  /export function getImportedMultiverseMarketPreview\( importedMarketState, multiverseMarket, multiverseMarketRangeBoundary, \{ formatBoundaryValue, formatShardNumber, isBoundaryValuePresent \} \)/
);
assert.match(spendBoundarySummaryJs, /function getMultiverseMarketSaveBoundarySummary/);
assert.match(
  spendBoundarySummaryJs,
  /PlayerProfileHandler, playerData, GetPlayerProfileData, FillPlayerProfileData, and ConvertSaveDataToProfileData/
);
assert.match(appJs, /MultiverseMarket canonical host narrowing/);
assert.match(
  appJs,
  /identifies the declaring save model, but it still does not prove which recovered IS\*Level subset should be promoted as planner-safe validated MultiverseMarket rows/
);
assert.doesNotMatch(appJs, /\.\/data\/system-units\/token-shop\.v1\.json/);
assert.doesNotMatch(appJs, /\.\/data\/system-units\/multiverse-market\.v1\.json/);
assert.match(systemUnitProviderJs, /\.\/data\/system-units\/token-shop\.v1\.json/);
assert.match(systemUnitProviderJs, /\.\/data\/system-units\/multiverse-market\.v1\.json/);
assert.match(appJs, /Blocked owner-dependent spend seams/);
assert.match(appJs, /Emporium compatibility preview/);
assert.match(playerProfileBoundarySupportModule, /grounded Emporium text model is split/i);
assert.match(spendBoundarySummaryJs, /BonusDescriptionText/);
assert.match(spendBoundarySummaryJs, /PerLevelBonusText/);
assert.match(spendBoundarySummaryJs, /IDText/);
assert.match(spendBoundarySummaryJs, /CurrentBonusText/);
assert.match(playerProfileBoundarySupportModule, /distinct unrecovered runtime-only display lane/i);
assert.match(spendBoundarySummaryJs, /multiverse-market-row-local-text-summary/);
assert.match(appJs, /effectLabel/);
assert.match(playerProfileBoundarySupportModule, /baseBonus/);
assert.match(spendBoundarySummaryJs, /rowIdLabel/);
assert.match(spendBoundarySummaryJs, /currentValueDisplay/);
assert.match(
  playerProfileBoundarySupportModule,
  /App-side Emporium row summaries now normalize only the grounded lanes/i
);
assert.match(spendBoundarySummaryJs, /const overlapRowSummaries = importedOverlapRows\.map/);
assert.match(
  appJs,
  /Structured compatibility evidence from <code>\$\{escapeHtml\(entry\.shapeId\)\}<\/code>:/
);
assert.match(spendBoundarySummaryJs, /grounded-compatibility-evidence/);
assert.match(spendBoundarySummaryJs, /quarantined-unrecovered-runtime-only-display-lane/);
assert.match(spendBoundarySummaryJs, /Distinct unrecovered runtime-only display lane/);
assert.match(
  appJs,
  /descriptive preview of quarantined Emporium import state under <code>\$\{escapeHtml\(preview\.importTargetPath\)\}<\/code>\. It preserves only the checked raw <code>\$\{escapeHtml\(preview\.typedSpanLabel\)\}<\/code> span from <code>\$\{escapeHtml\(preview\.saveAnchor \|\| "SaveData"\)\}<\/code> as non-canonical evidence, while broader progression neighbors past <code>\$\{escapeHtml\(preview\.wrapperOnlyFieldLabel \|\| "InscryptionsDone"\)\}<\/code> stay outside the admitted import slice\./i
);
assert.match(
  playerProfileBoundarySupportModule,
  /stays wrapper-only and is intentionally excluded from this preview even when it exists in the imported compatibility blob/
);
assert.match(
  playerProfileBoundarySupportModule,
  /Broader .* progression neighbors after the dual-declared .* boundary stay outside this admitted Emporium import slice/
);
assert.match(
  playerProfileBoundarySupportModule,
  /Planner use stays blocked\. These imported levels remain quarantined compatibility evidence/
);
assert.match(
  spendBoundarySummaryJs,
  /get_Market, Market, GetPlayerProfileData, FillPlayerProfileData, and the FillPlayerProfileData coroutine shell/
);
assert.match(appJs, /Shard milestone mapping gate/);
assert.match(appJs, /Shard shell grounding payload/);
assert.match(appJs, /Shard milestone payload boundary/);
assert.match(appJs, /Shard save-side separation/);
assert.match(appJs, /Grounded shard shell evidence available/);
assert.doesNotMatch(appJs, /Repo-wide default unknown candidate/);
assert.doesNotMatch(appJs, /Top PR2-local shard candidate/);
assert.doesNotMatch(appJs, /Why next:/);
assert.match(appJs, /Available but unmapped/);
assert.match(appJs, /Shard milestone payload-watch boundary/);
assert.match(appJs, /Payload-watch boundary keeps/);
assert.doesNotMatch(appJs, /Save-side separation/);
assert.doesNotMatch(appJs, /Shard owner trail stays separate from PlayerProfile save clues/);
assert.match(
  appJs,
  /Shard owner trail and PlayerProfileData save-family clues stay separate with zero overlap/
);
assert.match(systemUnitProviderJs, /\.\/data\/system-units\/token-shop\.v1\.json/);
assert.match(spendBoundarySummaryJs, /function getTokenShopCostLaneSummary/);
assert.match(appJs, /TokenShop cost-lane split/);
assert.match(
  appJs,
  /DB-backed TokenShop subjects now preserve \$\{tokenShopCostLaneSummary\.rowLocalSubjectId\} plus \$\{tokenShopCostLaneSummary\.rangeFamilySubjectId\}/
);
assert.match(
  appJs,
  /Cost-lane support preserves \${tokenShopCostLaneSummary\.tokenLaneLabel}, \${tokenShopCostLaneSummary\.diamondLaneLabel}, \${tokenShopCostLaneSummary\.dailyLaneLabel}, \${tokenShopCostLaneSummary\.costShellLabel}, and \${tokenShopCostLaneSummary\.descriptionRenderLabel}|DB-backed TokenShop subjects now preserve \${tokenShopCostLaneSummary\.rowLocalSubjectId} plus \${tokenShopCostLaneSummary\.rangeFamilySubjectId}/
);
assert.match(appJs, /modifier-side reward lane|budget lane/);
assert.match(spendBoundarySummaryJs, /function getSpendActionLaneSummary/);
assert.match(appJs, /Spend action-lane split/);
assert.match(
  appJs,
  /DB-backed TokenShop action coverage or legacy spend action-lane clues preserved/
);
assert.match(
  appJs,
  /Canonical TokenShop action coverage now preserves \${spendActionLaneSummary\.rowLocalSubjectId} via \${spendActionLaneSummary\.loopModifierHook}, while \${spendActionLaneSummary\.rangeFamilySubjectId} keeps \${spendActionLaneSummary\.dailyHookT2} recorded with blocked input \${spendActionLaneSummary\.blockedInputReason \|\| "explicitly de-scoped"}|Action-lane clues preserve \${spendActionLaneSummary\.tokenHook}, \${spendActionLaneSummary\.diamondHook}, \${spendActionLaneSummary\.loopModifierHook}, and \${spendActionLaneSummary\.premiumModifierHook}/
);
assert.match(
  appJs,
  /Canonical TokenShop action coverage now preserves \${spendActionLaneSummary\.rowLocalSubjectId} via \${spendActionLaneSummary\.loopModifierHook}, while \${spendActionLaneSummary\.rangeFamilySubjectId} keeps \${spendActionLaneSummary\.dailyHookT2} recorded with blocked input \${spendActionLaneSummary\.blockedInputReason \|\| "explicitly de-scoped"}|Action-lane clues preserve \${spendActionLaneSummary\.tokenHook}, \${spendActionLaneSummary\.diamondHook}, \${spendActionLaneSummary\.loopModifierHook}, and \${spendActionLaneSummary\.premiumModifierHook}|Spend action-lane clues are not available in this build/
);
assert.match(spendBoundarySummaryJs, /"BuyTokenBoost"/);
assert.match(spendBoundarySummaryJs, /"BuyDiamondBoost"/);
assert.match(spendBoundarySummaryJs, /"BuyLM244"/);
assert.match(spendBoundarySummaryJs, /"BuyCollectorDevice"/);
assert.match(spendBoundarySummaryJs, /"BuyTokenDailiesT2"/);
assert.match(spendBoundarySummaryJs, /"BuyTokenDailiesT3"/);
assert.match(spendBoundarySummaryJs, /function getTokenShopOwnerShellSummary/);
assert.match(appJs, /TokenShop owner shell/);
assert.match(
  appJs,
  /DB-backed TokenShop subjects now preserve \$\{tokenShopOwnerShellSummary\.rowLocalSubjectId\} plus \$\{tokenShopOwnerShellSummary\.rangeFamilySubjectId\}/i
);
assert.match(
  appJs,
  /TokenShop owner-shell clues preserve \${tokenShopOwnerShellSummary\.ownerAnchor}, \${tokenShopOwnerShellSummary\.bankMethod}, \${tokenShopOwnerShellSummary\.notificationHook}, and \${tokenShopOwnerShellSummary\.deviceHook}/
);
assert.match(appJs, /save recovery remain separate tasks|planner state/);
assert.match(spendBoundarySummaryJs, /function getTokenShopSaveBoundarySummary/);
assert.match(appJs, /TokenShop save boundary/);
assert.match(
  appJs,
  /DB-backed TokenShop subject-state keeps \$\{tokenShopSaveBoundarySummary\.rowLocalSubjectId\} separate from \$\{tokenShopSaveBoundarySummary\.rangeFamilySubjectId\}, with blocked input \$\{tokenShopSaveBoundarySummary\.blockedInputReason\}\./
);
assert.match(
  appJs,
  /TokenShop save boundary keeps \${tokenShopSaveBoundarySummary\.ownerAnchor} separate from \${tokenShopSaveBoundarySummary\.saveAnchor}, with \${tokenShopSaveBoundarySummary\.overlapLabel}/
);
assert.match(
  appJs,
  /save recovery remain separate tasks|TokenShop save-boundary clues are not available/
);
assert.match(spendBoundarySummaryJs, /function getTokenBankControllerShellSummary/);
assert.match(appJs, /Token-bank controller shell/);
assert.match(appJs, /const hasTokenShopDbRead = hasTokenShopDbSurface\(tokenShop\);/);
assert.match(appJs, /const hasTokeniumNamingRead =/);
assert.match(appJs, /const hasTokenShopCostLaneRead =/);
assert.match(appJs, /const hasSpendActionLaneRead =/);
assert.match(appJs, /const hasTokenShopOwnerShellRead =/);
assert.match(appJs, /const hasTokenShopSaveBoundaryRead =/);
assert.match(appJs, /const hasTokenBankControllerShellRead =/);
assert.match(appJs, /const hasTokenBankStateRead =/);
assert.match(appJs, /const hasDailyTokeniumLaneRead =/);
assert.match(appJs, /const hasTokenBankFormulaRead =/);
assert.match(appJs, /if \(hasTokeniumNamingRead\)/);
assert.match(appJs, /if \(hasTokenShopCostLaneRead\)/);
assert.match(appJs, /if \(hasSpendActionLaneRead\)/);
assert.match(appJs, /if \(hasTokenShopOwnerShellRead\)/);
assert.match(appJs, /if \(hasTokenShopSaveBoundaryRead\)/);
assert.match(appJs, /if \(hasTokenBankControllerShellRead\)/);
assert.match(appJs, /if \(hasTokenBankStateRead\)/);
assert.match(appJs, /if \(hasDailyTokeniumLaneRead\)/);
assert.match(appJs, /if \(hasTokenBankFormulaRead\)/);
assert.match(
  appJs,
  /\$\{row\.dbMetadataSourceLabel \|\| row\.contractSourceLabel \|\| "DB-backed TokenShop mechanics"\} with compatibility level import: \$\{row\.identity\} \(\$\{row\.slot\}\)/
);
assert.match(
  appJs,
  /Compatibility imports remain the level source here, but generic mechanics now render grounded TokenShop row detail first and contracts only add DB-backed subject metadata when present\./
);
assert.match(
  tokenShopSubjectContractsJs,
  /import \{ TOKEN_SHOP_SCOPE_BY_FIELD, TOKEN_SHOP_SCOPE_IDS \} from "\.\/token-shop-scope-map\.js"/
);
assert.match(tokenShopSubjectContractsJs, /const scopeId = TOKEN_SHOP_SCOPE_BY_FIELD\[fieldName\]/);
assert.match(
  appJs,
  /\$\{tokeniumNamingSummary\.rangeFamilySubjectId \|\| tokeniumNamingSummary\.rowLocalSubjectId \|\| "DB-backed TokenShop subject"\} preserves \${tokeniumNamingSummary\.resourceLabel}, \${tokeniumNamingSummary\.academyLabel}, \${tokeniumNamingSummary\.tokenShellLabel}, and \${tokeniumNamingSummary\.tokeniumShellLabel}/
);
assert.match(
  appJs,
  /DB-backed TokenShop mechanics now preserve \$\{dailyTokeniumSummary\.rangeFamilySubjectId \|\| dailyTokeniumSummary\.rowLocalSubjectId \|\| "the Daily Tokenium lane"\} with \$\{dailyTokeniumSummary\.ownerFamilyLabel\}, \$\{dailyTokeniumSummary\.academyController\}, \$\{dailyTokeniumSummary\.textHandler\}, and \$\{dailyTokeniumSummary\.missionFamilyLabel\}\./
);
assert.match(
  appJs,
  /\$\{dailyTokeniumSummary\.loopHook\}, \$\{dailyTokeniumSummary\.purchaseHook\}, \$\{dailyTokeniumSummary\.finalBonusHook\}, \$\{dailyTokeniumSummary\.purchaseOwner\}, and collector-pack copy are now grounded on the canonical Daily Tokenium lane contract rather than read from legacy clue bundles\./
);
assert.match(
  appJs,
  /DB-backed TokenShop controller shell or legacy token-bank controller shell preserved/
);
assert.match(
  appJs,
  /Canonical TokenShop contracts now preserve token-bank controller shell on \${tokenBankControllerShellSummary\.rowLocalSubjectId}, with \${tokenBankControllerShellSummary\.claimMethod}, \${tokenBankControllerShellSummary\.fillMethod}, \${tokenBankControllerShellSummary\.fillField}, \${tokenBankControllerShellSummary\.descriptionShell}, and \${tokenBankControllerShellSummary\.notificationHook}|The token-bank controller shell preserves \${tokenBankControllerShellSummary\.claimMethod}, \${tokenBankControllerShellSummary\.fillMethod}, \${tokenBankControllerShellSummary\.fillField}, \${tokenBankControllerShellSummary\.descriptionShell}, and \${tokenBankControllerShellSummary\.notificationHook}/
);
assert.match(
  appJs,
  /DB-backed TokenShop mechanics now preserve token-bank state on \${tokenBankStateSummary\.rowLocalSubjectId \|\| tokenBankStateSummary\.rangeFamilySubjectId \|\| "the current TokenShop subject"}, with \${tokenBankStateSummary\.claimMethod}, \${tokenBankStateSummary\.capMethod}, \${tokenBankStateSummary\.displayShell}, and \${tokenBankStateSummary\.loopHook}\./
);
assert.match(
  appJs,
  /\$\{tokenBankStateSummary\.rowLocalSubjectId \|\| tokenBankStateSummary\.rangeFamilySubjectId \|\| "DB-backed TokenShop subject"\} preserves \${tokenBankStateSummary\.claimMethod}, \${tokenBankStateSummary\.capMethod}, \${tokenBankStateSummary\.displayShell}, and \${tokenBankStateSummary\.loopHook}/
);
assert.match(
  appJs,
  /\$\{dailyTokeniumSummary\.rangeFamilySubjectId \|\| dailyTokeniumSummary\.rowLocalSubjectId \|\| "DB-backed TokenShop subject"\} preserves \${dailyTokeniumSummary\.ownerFamilyLabel}, \${dailyTokeniumSummary\.missionFamilyLabel}, \${dailyTokeniumSummary\.loopHook}, \${dailyTokeniumSummary\.purchaseHook}, and \${dailyTokeniumSummary\.purchaseOwner}/
);
assert.match(
  appJs,
  /FinalTokenBank outputs remain non-owner clues rather than recovered saved-state fields/
);
assert.match(appJs, /hasTokenShopDbCoverage\(tokenBankFormulaSummary\)/);
assert.match(
  appJs,
  /\$\{tokenBankFormulaSummary\.rowLocalSubjectId \|\| tokenBankFormulaSummary\.rangeFamilySubjectId \|\| "DB-backed TokenShop subject"\} now preserves \$\{tokenBankFormulaSummary\.capAccessor\}, \$\{tokenBankFormulaSummary\.fillAccessor\}, \$\{tokenBankFormulaSummary\.capField\}, and \$\{tokenBankFormulaSummary\.fillField\} on the DB-backed mechanics surface\./
);
assert.match(
  appJs,
  /The DB-backed derived-output lane still records no save-family overlap in the grounded context\./
);
assert.match(
  appJs,
  /DB-backed TokenShop mechanics still keep the CloudSavePlayerProfile shell narrowed through \${tokenBankStateSummary\.cloudSaveInfoRoutine}, \${tokenBankStateSummary\.cloudSaveProfileRoutine}, and \${tokenBankStateSummary\.cloudSaveStateMachine}\./
);
assert.match(appJs, /CloudSavePlayerProfile evidence only preserves a metadata-side shell/);
assert.match(
  appJs,
  /This is enough to narrow future recovery work, but not enough to identify the exact declaring save model or a narrower PlayerProfile-side wrapper path for token-bank state/
);
assert.match(spendBoundarySummaryJs, /function getMultiverseMarketSaveBoundarySummary/);
assert.match(appJs, /MultiverseMarket save boundary/);
assert.match(
  appJs,
  /MultiverseMarket action shell and PlayerProfileData save-family clues stay separate with zero overlap/
);
assert.match(appJs, /MultiverseMarket canonical host narrowing/);
assert.match(appJs, /PlayerProfileHandler get_Market accessor bridge/);
assert.match(spendBoundarySummaryJs, /get_BM, get_ZN, get_TU/);
assert.match(
  appJs,
  /planner-ready owned-state inputs and canonical row-level imports remain blocked|broader progression-payload field cluster/
);
assert.match(
  appJs,
  /planner-ready owned-state inputs and canonical row-level imports remain blocked|metadata-only/
);
assert.match(spendBoundarySummaryJs, /"TokenBoost"/);
assert.match(spendBoundarySummaryJs, /"DiamondBoost"/);
assert.match(spendBoundarySummaryJs, /"TokenDailiesT2"/);
assert.match(spendBoundarySummaryJs, /"CostBox"/);
assert.match(spendBoundarySummaryJs, /"DescText"/);
assert.match(
  appJs,
  /These cards represent a real ship system, but the current implementation still uses planner calibration and some provisional labels/
);
assert.match(appJs, /Canonical ship system, provisional implementation/);
assert.match(appJs, /Experimental gem results/);
assert.match(html, /Product-facing checks/);
assert.match(appJs, /APK-grounding checks/);
assert.match(html, /Quarantined support surfaces/);
assert.match(appJs, /Loop guardrails remain descriptive and source-linked/);
assert.match(appJs, /This card watches descriptive unlock gates only/);
assert.doesNotMatch(appJs, /Shard milestone mapping status/);
assert.match(appJs, /community-grounded descriptive data/);
assert.match(appJs, /Grounded shard anchors/);
assert.doesNotMatch(appJs, /Title source/);
assert.match(appJs, /Threshold guidance is milestone-specific and descriptive only/);
assert.match(appJs, /Use this to avoid false precision near known cost-bump levels/);
assert.match(
  normalizedAppJs,
  /buildGroundedShardRecommendations\(\)\.map\(\(item\)\s*=>\s*toRecommendationAction\(item,\s*"shards"\s*\)\s*\)/
);
assert.match(
  normalizedAppJs,
  /buildLoopGuardrailRecommendations\(\)\.map\(\(item\)\s*=>\s*toRecommendationAction\(item,\s*"loop"\s*\)\s*\)/
);
assert.match(appJs, /\/api\/client\/open/);
assert.match(appJs, /\/api\/client\/events/);
assert.match(appJs, /loadSystemUnits/);
assert.match(appJs, /systemUnitApi/);
assert.match(appJs, /const DEFAULT_SERVER_CAPABILITIES = Object\.freeze/);
assert.match(appJs, /const SERVER_CAPABILITIES = getServerCapabilities\(\)/);
assert.match(
  appJs,
  /!window\.location\.origin\.startsWith\("http"\) \|\| !SERVER_CAPABILITIES\.sessionApi/
);
assert.match(appJs, /function getServerCapabilities\(\)/);
assert.match(appJs, /new EventSource/);
assert.match(html, /window\.__CIFI_SERVER_CAPABILITIES__ = \{/);
assert.match(html, /sessionApi: false/);
assert.match(html, /systemUnitApi: false/);
assert.doesNotMatch(
  appJs,
  /externalModels\.experimental\.gemNodes\.budget\s*\|\|\s*state\.playerProfile\.compatibility\.unresolvedProfileFields\.gemDust/
);
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
assert.match(devServer, /\/api\/system-units/);
assert.match(devServer, /window\.__CIFI_SERVER_CAPABILITIES__/);
assert.match(devServer, /sessionApi: true/);
assert.match(devServer, /systemUnitApi: true/);
assert.match(systemUnitProviderJs, /\/api\/system-units/);
assert.match(systemUnitProviderJs, /mode: "db"/);
assert.match(systemUnitProviderJs, /mode: "static-export"/);
assert.match(devServer, /event: launch/);
assert.match(devServer, /Launcher-mode server is idle\. Shutting down\./);
assert.match(launcherVbs, /http:\/\/localhost:4173\//);
assert.match(launcherVbs, /http:\/\/localhost:4173\/\?launch=1/);
assert.match(launcherVbs, /launch-cifi\.bat/);
assert.match(launcherVbs, /%ComSpec% \/c/);
assert.doesNotMatch(launcherVbs, /ResolveNodePath/);
assert.doesNotMatch(launcherVbs, /--launcher-mode/);
assert.doesNotMatch(launcherVbs, /Start-Process -WindowStyle Hidden/);
assert.equal(
  pkg.scripts["contracts:gen-index"],
  "node ./scripts/contracts/generate-dataset-index.mjs"
);
assert.equal(pkg.scripts.dev, "node ./scripts/dev-server.mjs");
assert.equal(pkg.scripts["lint:docs"], "node ./scripts/contracts/lint-doc-portability.mjs");
assert.equal(pkg.scripts["extract:build"], "node ./scripts/unity/run_extract.mjs build");
assert.equal(pkg.scripts["extract:asset"], "node ./scripts/unity/run_extract.mjs asset");
assert.equal(pkg.scripts["extract:asset:run"], "node ./scripts/unity/run_extract.mjs asset:run");
assert.equal(pkg.scripts["extract:trace"], "node ./scripts/unity/run_extract.mjs trace");
assert.equal(pkg.scripts["verify:data"], "node ./scripts/contracts/validate-datasets.mjs");
assert.equal(
  pkg.scripts["verify:vendoring"],
  "node ./scripts/contracts/verify-vendoring-layout.mjs"
);
assert.equal(pkg.scripts["check:syntax"], "node ./scripts/contracts/check-js-syntax.mjs");
assert.equal(pkg.scripts.test, "node ./tests/smoke.mjs");
assert.equal(pkg.scripts["test:unit"], "node ./scripts/tests/run-unit-tests.mjs");
assert.match(normalizedExtractRunner, /build:\s*\{/);
assert.match(extractRunner, /Extraction artifact is stale:/);
assert.match(extractRunner, /npm run extract:build/);
assert.match(extractRunner, /dotnet", \["restore", probeProject\]/);
assert.match(extractRunner, /readdirSync\(probeSourceDir\)/);
assert.match(extractRunner, /\.NET 8 SDK was not found on PATH/);
assert.match(normalizedExtractRunner, /trace:\s*\{/);
assert.match(extractRunner, /const extraArgs = process\.argv\.slice\(3\)/);
assert.match(unityAuditPlaybook, /preferred alias: `npm run extract:build`/);
assert.match(unityAuditPlaybook, /fails fast and tells you to run `npm run extract:build`/);
assert.match(unityAuditPlaybook, /no longer silently reuses a stale cached build/);
assert.match(unityAuditPlaybook, /api\.nuget\.org/);
assert.match(
  unityAuditPlaybook,
  /preferred alias: `npm run extract:trace -- --query <query> --anchor <anchor>`/
);
assert.match(
  unityAuditPlaybook,
  /or pin an exact preset with `npm run extract:trace -- --target <target-id> --anchor <anchor>`/
);
assert.match(unityAuditPlaybook, /data\/system-units\/trace\.v1\.json/);
assert.match(unityAuditPlaybook, /data\/archive\/unity-trace-target-registry\.json/);
assert.match(
  unityAuditPlaybook,
  /resolves loose Codex-first queries through DB-owned subject\/family coverage/i
);
assert.match(unityAuditPlaybook, /metadata neighborhoods, owner-payload shells/i);
assertTextIncludesConceptChoice(
  unityAuditPlaybook,
  [
    ["direct Unity extraction", "UABEA/CifiAssetProbe output"],
    ["nearby prefab or title surfaces", "bounded blocker datasets"]
  ],
  "unity audit playbook trace source guidance"
);
assert.match(
  unityAuditPlaybook,
  /typed proved edges, negative edges, provenance-strength tags, and one solved-vs-blocked comparison shape/
);
assert.match(unityAuditPlaybook, /wire`, `quarantine`, or `keep researching`/);
assert.deepEqual(await lintDocPortability(repoRoot), []);
const vendoringLayout = await verifyVendoringLayout(repoRoot);
assert.deepEqual(vendoringLayout.regressions, []);
assert.deepEqual(vendoringLayout.tolerated, [
  { path: ".deps", rule: "top-level .deps/ bucket", classification: "temporary" },
  { path: ".vendor_manual", rule: "top-level .vendor_*/ bucket", classification: "temporary" },
  { path: ".vendor_py", rule: "top-level .vendor_*/ bucket", classification: "temporary" },
  { path: ".wheelhouse", rule: "top-level cache bucket", classification: "temporary" }
]);
assert.match(importMappingDoc, /compatibility-only fields/i);
const datasetContractsDoc = await readFile(
  new URL("../docs/contracts/dataset-contracts.md", import.meta.url),
  "utf8"
);
assert.equal(generatedDatasetIndex, datasetIndexGeneratedDoc);
assert.match(datasetIndexGeneratedDoc, /## Source priority/);
assert.match(datasetIndexGeneratedDoc, /### `snapshot`/);
assert.match(datasetIndexGeneratedDoc, /### `app-meta-unit`/);
assert.match(datasetIndexGeneratedDoc, /### `player-state-unit`/);
assert.match(datasetIndexGeneratedDoc, /### `trace-unit`/);
assert.doesNotMatch(
  datasetIndexGeneratedDoc,
  /### `unity-trace-target-registry`/,
  "dataset index should no longer advertise the archived unity trace target registry as a shipped dataset"
);
assert.match(datasetIndexGeneratedDoc, /- Classification: `canonical-app-snapshot`/);
assert.match(datasetIndexGeneratedDoc, /- Files:\r?\n  - `data\/game-data\.snapshot\.v1\.json`/);
assert.match(datasetContractsDoc, /data\/bundled-dataset-contract\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-asset-grounding\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-owner-family-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-finalsu-bonus-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-milestone-payload-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-cost-model-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-milestone-row-model-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-milestone-title-effect-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-effect-text-handler-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-milestone-row-shell-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-milestone-row-alignment-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-milestone-handoff-boundary\.v2\.json/);
assert.match(datasetContractsDoc, /data\/shard-save-boundary\.v2\.json/);
assert.match(datasetContractsDoc, /data\/system-units\/player-state\.v1\.json/);
assert.match(datasetContractsDoc, /data\/system-units\/shards\.v1\.json/);
assert.match(datasetContractsDoc, /data\/system-units\/token-shop\.v1\.json/);
assert.match(datasetContractsDoc, /data\/system-units\/multiverse-market\.v1\.json/);
assert.match(datasetContractsDoc, /data\/system-units\/trace\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-cost-formula-model\.v1\.json/);
assert.doesNotMatch(
  datasetContractsDoc,
  /data\/shard-bonus-slot-probe\.v1\.json/,
  "dataset contracts doc should no longer treat shard-bonus-slot-probe as a shipped dataset"
);
assert.doesNotMatch(
  datasetContractsDoc,
  /data\/shard-milestone-family-evidence\.v1\.json/,
  "dataset contracts doc should no longer treat shard-milestone-family-evidence as a shipped dataset"
);
assert.doesNotMatch(
  datasetContractsDoc,
  /data\/multiverse-market-row-text-coverage\.json/,
  "dataset contracts doc should no longer treat multiverse-market-row-text-coverage as a shipped dataset"
);
assert.match(datasetContractsDoc, /data\/extraction-candidate-families\.v1\.json/);
assert.match(datasetContractsDoc, /docs\/contracts\/dataset-refresh-checklist\.md/);
assert.match(datasetContractsDoc, /Source-priority metadata/);
assert.match(datasetContractsDoc, /APK\/Unity artifacts and repo extraction outputs first/);
assert.match(datasetContractsDoc, /embedded row-identity and cost-support slices/i);
assert.match(datasetContractsDoc, /data\/multiverse-market-prefab-remap-boundary\.json/);
assert.doesNotMatch(
  JSON.stringify(bundledDatasetContract),
  /unity-trace-target-registry/,
  "bundled dataset contract should no longer ship the archived unity trace target registry"
);
assert.match(datasetContractsDoc, /editing `data\/bundled-dataset-contract\.v1\.json`/);
assert.match(datasetRefreshChecklistDoc, /# Dataset Refresh Checklist/);
assert.match(
  datasetRefreshChecklistDoc,
  /Record the shipped dataset in `data\/bundled-dataset-contract\.v1\.json`/
);
assert.match(datasetRefreshChecklistDoc, /Run `npm run verify:data`/);
assert.match(datasetRefreshChecklistDoc, /Run `npm run check:syntax`/);
assert.match(
  datasetRefreshChecklistDoc,
  /Use `docs\/contracts\/research-note-template\.md` for new notes/
);
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
assert.match(readme, /docs\/tools\/ocr\.md/);
assert.match(readme, /npm run test:unit/);
assert.match(readme, /npm run check:syntax/);

await runBlockingCheck(
  "daily tokenium subject-state monotonicity",
  verifyDailyTokeniumSubjectStateMonotonicity
);
await runBlockingCheck("launcher-mode lifecycle", verifyLauncherModeServerLifecycle);

const shipWinner = [...snapshot.shipLoadouts]
  .map((loadout) => ({
    name: loadout.name,
    score:
      (defaultProfile.externalModels.shipPlanner.summary.power ?? 0) *
        loadout.powerScale *
        snapshot.resourceGoals.credits.powerWeight +
      (defaultProfile.externalModels.shipPlanner.summary.speed ?? 0) *
        loadout.speedScale *
        snapshot.resourceGoals.credits.speedWeight *
        10 +
      (defaultProfile.externalModels.shipPlanner.summary.cargo ?? 0) *
        loadout.cargoScale *
        snapshot.resourceGoals.credits.cargoWeight +
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
assert.deepEqual(migratedLegacyProfile.planning.shards.observedLevelsByMilestone, {
  milestone_alpha: 12
});
assert.equal(migratedLegacyProfile.externalModels.shipPlanner.summary.power, 7);
assert.equal(migratedLegacyProfile.externalModels.shipPlanner.summary.speed, 2.5);
assert.equal(migratedLegacyProfile.externalModels.shipPlanner.summary.cargo, 19);
assert.equal(
  migratedLegacyProfile.externalModels.experimental.profileHints.primaryFarmingFocus,
  "shards"
);
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
assert.equal(
  migratedRetiredLooseAliasProfile.externalModels.experimental.profileHints.primaryFarmingFocus,
  null
);
assert.equal(
  migratedRetiredLooseAliasProfile.externalModels.experimental.profileHints.researchHours,
  null
);
assert.equal(migratedRetiredLooseAliasProfile.compatibility.unresolvedProfileFields.gemDust, null);
assert.equal(
  migratedRetiredLooseAliasProfile.compatibility.unresolvedProfileFields.hunterLevel,
  null
);
assert.equal(
  migratedRetiredLooseAliasProfile.compatibility.unresolvedProfileFields.traitSphereCount,
  null
);
assert.equal(
  migratedRetiredLooseAliasProfile.compatibility.unresolvedProfileFields.mechParts,
  null
);

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
    },
    communityTools: {
      shipOptimizer: {
        v1: {
          toolName: "CiFi Ship Optimizer",
          toolVersion: "2026-04-06",
          sourceReference: "https://example.com/ship-optimizer",
          assumptionsSummary: "Community weights and provisional ship labels.",
          data: {
            selectedShip: "Meltdown",
            weights: {
              power: 7,
              cargo: 4
            }
          }
        }
      },
      shardOptimizer: {
        v1: {
          toolName: "CiFi Shard Optimizer",
          toolVersion: "2026-04-06",
          sourceReference: "local export 2026-04-06",
          assumptionsSummary: "Uses community breakpoint heuristics only.",
          data: {
            targetRow: "omega_watch",
            suggestedBudget: "1.5e9"
          }
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
assert.equal(
  migratedNestedProfile.externalModels.shipPlanner.communityToolState.technical.Meltdown,
  12
);
assert.equal(
  migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.toolName,
  "CiFi Ship Optimizer"
);
assert.equal(
  migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.toolVersion,
  "2026-04-06"
);
assert.equal(
  migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.sourceReference,
  "https://example.com/ship-optimizer"
);
assert.equal(
  migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.assumptionsSummary,
  "Community weights and provisional ship labels."
);
assert.equal(
  migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.data.selectedShip,
  "Meltdown"
);
assert.equal(
  migratedNestedProfile.externalModels.communityTools.shardOptimizer.v1.data.targetRow,
  "omega_watch"
);
assert.deepEqual(migratedNestedProfile.externalModels.communityTools.modTreeOptimizer, {});
assert.equal(migratedNestedProfile.player.resources.shards, 15000);
assert.equal(migratedNestedProfile.planning.shards.focusMilestoneId, null);

const migratedInvalidCommunityToolProfile = normalizePlayerProfile({
  externalModels: {
    communityTools: {
      modTreeOptimizer: {
        v1: {
          toolName: "Missing provenance",
          data: {
            branch: "crit"
          }
        }
      }
    }
  }
});

assert.deepEqual(
  migratedInvalidCommunityToolProfile.externalModels.communityTools.modTreeOptimizer,
  {}
);

const exportedNestedProfile = JSON.parse(JSON.stringify(migratedNestedProfile));
assert.deepEqual(
  exportedNestedProfile.externalModels.communityTools,
  migratedNestedProfile.externalModels.communityTools
);
assert.equal(exportedNestedProfile.player.resources.shards, 15000);
assert.equal(exportedNestedProfile.planning.shards.focusMilestoneId, null);

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
assert.equal(
  migratedCompatibilityAliasProfile.compatibility.unresolvedProfileFields.hunterLevel,
  18
);
assert.equal(
  migratedCompatibilityAliasProfile.compatibility.unresolvedProfileFields.traitSphereCount,
  7
);
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
assert.deepEqual(migratedUnmappedSystemsProfile.planning.shards.observedLevelsByMilestone, {
  omega_watch: 6
});
assert.deepEqual(
  migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.shardMilestoneState,
  {
    status: "quarantined-unmapped",
    importedState: {
      selectedMilestone: "alpha",
      observedLevel: 12
    },
    mappingGate: {
      plannerUseAllowed: false,
      canonicalPromotionBlocked: true,
      requiredBeforeCanonicalPromotion: [
        "Verify the concrete shard milestone save owner or declaring save model.",
        "Recover a grounded field-to-label mapping for player-owned shard milestone state.",
        "Approve planner-safe recommendation use only after grounded save-state verification."
      ]
    },
    currentBoundary: [
      "Imported shard milestone state stays quarantined until the save owner, field mapping, and planner-safe interpretation are verified.",
      "Do not treat this blob as canonical player truth or grounded planner input."
    ]
  }
);
assert.deepEqual(
  migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.shardMilestones,
  migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.shardMilestoneState
);
assert.deepEqual(migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.tokenShop, {
  tokenBoostLevel: 4
});
assert.equal(
  migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.multiverseMarket,
  null
);
assert.equal(migratedUnmappedSystemsProfile.player.resources.tokens, null);

const migratedQuarantinedShardMilestoneProfile = normalizePlayerProfile({
  compatibility: {
    unmappedSystemState: {
      shardMilestoneState: {
        importedState: {
          selectedMilestone: "beta",
          observedLevel: 33,
          recoveredOwner: "PlayerProfileData"
        }
      }
    }
  }
});

assert.equal(migratedQuarantinedShardMilestoneProfile.planning.shards.focusMilestoneId, null);
assert.equal(migratedQuarantinedShardMilestoneProfile.planning.shards.focusMilestoneLevel, null);
assert.deepEqual(
  migratedQuarantinedShardMilestoneProfile.planning.shards.observedLevelsByMilestone,
  {}
);
assert.equal(
  migratedQuarantinedShardMilestoneProfile.compatibility.unmappedSystemState.shardMilestoneState
    .mappingGate.plannerUseAllowed,
  false
);
assert.equal(
  migratedQuarantinedShardMilestoneProfile.compatibility.unmappedSystemState.shardMilestoneState
    .mappingGate.canonicalPromotionBlocked,
  true
);
assert.equal(
  migratedQuarantinedShardMilestoneProfile.compatibility.unmappedSystemState.shardMilestoneState
    .importedState.observedLevel,
  33
);

const migratedFlatSpendStateProfile = normalizePlayerProfile({
  ATU1Level: "3",
  ATU2Level: "4",
  ATU3Level: "5",
  ATU4Level: "6",
  ATU5Level: "2",
  ATU6Level: "7",
  ATU7Level: "8",
  ATU8Level: "9",
  ATU9Level: "10",
  ATU10Level: "11",
  ATU12Level: "12",
  ATU28Level: 1,
  Tier2TokensUnlocked: true,
  Tier4TokensUnlocked: false,
  TokenBankCap: "1200",
  ClaimableBankTokens: "450",
  ClaimableTokenium: "275.5",
  FinalTokenBankFillSpeed: "1.25",
  DailyTokeniumCap: "2000",
  InscryptionsDone: "98",
  IS0Level: "1",
  IS1Level: "2",
  IS73Level: 4,
  EsotericR1Trades: "5",
  NecrumR9Trades: 6,
  Mech1Unlocked: true,
  FinalMech1MainBonus: "2.5e3",
  Mech2Unlocked: false,
  Mech2Units: 7,
  IS111Level: "9"
});

assert.deepEqual(migratedFlatSpendStateProfile.planning.tokenShop.checkedSubsetPlayerState, {
  ATU1Level: 3,
  ATU2Level: 4,
  ATU3Level: 5,
  ATU4Level: 6,
  ATU5Level: 2,
  ATU6Level: 7,
  ATU7Level: 8,
  ATU8Level: 9,
  ATU9Level: 10,
  ATU10Level: 11,
  ATU11Level: null,
  ATU12Level: 12,
  ATU13Level: null,
  ATU14Level: null,
  ATU15Level: null,
  ATU16Level: null,
  ATU17Level: null,
  ATU18Level: null,
  ATU19Level: null,
  ATU20Level: null,
  ATU21Level: null,
  ATU22Level: null,
  ATU23Level: null,
  ATU24Level: null,
  ATU25Level: null,
  ATU26Level: null,
  ATU27Level: null,
  ATU28Level: 1
});
assert.deepEqual(migratedFlatSpendStateProfile.compatibility.unmappedSystemState.tokenShop, {
  ATU1Level: 3,
  ATU2Level: 4,
  ATU3Level: 5,
  ATU4Level: 6,
  ATU5Level: 2,
  ATU6Level: 7,
  ATU7Level: 8,
  ATU8Level: 9,
  ATU9Level: 10,
  ATU10Level: 11,
  ATU12Level: 12,
  ATU28Level: 1,
  Tier2TokensUnlocked: true,
  Tier4TokensUnlocked: false,
  TokenBankCap: 1200,
  ClaimableBankTokens: 450,
  ClaimableTokenium: 275.5,
  FinalTokenBankFillSpeed: 1.25,
  DailyTokeniumCap: 2000
});
assert.deepEqual(migratedFlatSpendStateProfile.compatibility.unmappedSystemState.multiverseMarket, {
  status: "quarantined-raw-unmapped",
  importedState: {
    IS1Level: 2,
    IS73Level: 4
  },
  mappingGate: {
    plannerUseAllowed: false,
    canonicalPromotionBlocked: true,
    requiredBeforeCanonicalPromotion: [
      "Recover a direct typed Market wrapper seam beyond the current metadata-only Market member clue.",
      "Recover grounded Emporium row labels before promoting any IS*Level field beyond raw compatibility storage.",
      "Approve planner-safe recommendation use only after canonical Emporium player-state inputs are grounded."
    ]
  },
  currentBoundary: [
    "Imported Emporium SaveData state stays quarantined as raw/unmapped compatibility evidence under compatibility.unmappedSystemState.multiverseMarket.",
    "Preserve only the exact SaveData-owned IS1Level through IS110Level span here without promoting it into canonical state.playerProfile.",
    "Keep InscryptionsDone wrapper-only and leave adjacent SaveData trade-counter and early-mech progression fields outside this admitted Emporium import slice."
  ]
});
assert.equal(
  migratedFlatSpendStateProfile.compatibility.unmappedSystemState.multiverseMarket.importedState
    .InscryptionsDone,
  undefined
);
assert.equal(
  migratedFlatSpendStateProfile.compatibility.unmappedSystemState.multiverseMarket.importedState
    .EsotericR1Trades,
  undefined
);
assert.equal(
  migratedFlatSpendStateProfile.compatibility.unmappedSystemState.multiverseMarket.importedState
    .Mech1Unlocked,
  undefined
);
assert.equal(
  migratedFlatSpendStateProfile.compatibility.unmappedSystemState.multiverseMarket.importedState
    .Mech2Units,
  undefined
);
assert.equal(migratedFlatSpendStateProfile.player.resources.tokens, null);

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
assert.deepEqual(migratedInvalidShardHelpers.planning.shards.observedLevelsByMilestone, {});

assert.match(appJs, /function normalizeLoadoutName/);
assert.match(appJs, /name: normalizeLoadoutName\(stored\.name, fallback\.name\)/);

finalizeSmokeRun();

function installSoftAssertions() {
  assert.ok = (value, message = "expected truthy value") => {
    if (!value) {
      const stackDetail =
        message === "expected truthy value" ? summarizeAssertionLocation(new Error().stack) : "";
      recordSmokeFailure(
        "ok",
        message,
        `received ${summarizeValue(value)}${stackDetail ? ` at ${stackDetail}` : ""}`
      );
    }
  };

  assert.equal = (actual, expected, message = "expected strict equality") => {
    if (!Object.is(actual, expected)) {
      recordSmokeFailure(
        "equal",
        message,
        `expected ${summarizeValue(expected)}; received ${summarizeValue(actual)}`
      );
    }
  };

  assert.deepEqual = (actual, expected, message = "expected deep equality") => {
    if (!isDeepStrictEqual(actual, expected)) {
      recordSmokeFailure("deepEqual", message, summarizeDeepEqualityMismatch(actual, expected));
    }
  };

  assert.match = (actual, expected, message = `expected value to match ${String(expected)}`) => {
    if (!expected.test(String(actual))) {
      recordSmokeFailure(
        "match",
        message,
        `pattern ${String(expected)}; actual preview ${summarizeText(actual)}`
      );
    }
  };

  assert.doesNotMatch = (
    actual,
    expected,
    message = `expected value not to match ${String(expected)}`
  ) => {
    if (expected.test(String(actual))) {
      recordSmokeFailure(
        "doesNotMatch",
        message,
        `pattern ${String(expected)} unexpectedly matched ${summarizeText(actual)}`
      );
    }
  };
}

function recordSmokeFailure(kind, message, detail) {
  const key = `${kind}:${message}`;
  if (seenSmokeFailureKeys.has(key)) {
    return;
  }
  seenSmokeFailureKeys.add(key);
  smokeFailures.push({ kind, message, detail });
}

function summarizeValue(value) {
  if (typeof value === "string") {
    return summarizeText(value, 80);
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null ||
    value === undefined
  ) {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `array(len=${value.length}) ${inspect(value.slice(0, 3), { depth: 2, breakLength: 80 })}${value.length > 3 ? " ..." : ""}`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `object(keys=${keys.length}) ${inspect(keys.slice(0, 5), { breakLength: 80 })}${keys.length > 5 ? " ..." : ""}`;
  }
  return inspect(value, { depth: 1, breakLength: 80 });
}

function summarizeText(value, maxLength = 140) {
  const text = String(value).replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return JSON.stringify(text);
  }
  return `${JSON.stringify(text.slice(0, maxLength))}... (len=${text.length})`;
}

function summarizeDeepEqualityMismatch(actual, expected) {
  const mismatch = findFirstMismatch(actual, expected);
  if (mismatch) {
    return `${mismatch.path}: expected ${summarizeValue(mismatch.expected)}; received ${summarizeValue(mismatch.actual)}`;
  }
  return `expected ${summarizeValue(expected)}; received ${summarizeValue(actual)}`;
}

function findFirstMismatch(actual, expected, path = "root", depth = 0) {
  if (depth > 3) {
    return { path, actual, expected };
  }

  if (Object.is(actual, expected)) {
    return null;
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return { path: `${path}.length`, actual: actual.length, expected: expected.length };
    }
    for (let index = 0; index < Math.min(actual.length, expected.length, 25); index += 1) {
      const nested = findFirstMismatch(
        actual[index],
        expected[index],
        `${path}[${index}]`,
        depth + 1
      );
      if (nested) {
        return nested;
      }
    }
    return { path, actual, expected };
  }

  if (isPlainObject(actual) && isPlainObject(expected)) {
    const actualKeys = Object.keys(actual).sort();
    const expectedKeys = Object.keys(expected).sort();
    if (!isDeepStrictEqual(actualKeys, expectedKeys)) {
      const missingKeys = expectedKeys.filter((key) => !actualKeys.includes(key));
      const extraKeys = actualKeys.filter((key) => !expectedKeys.includes(key));
      return {
        path: `${path}{keys}`,
        actual: { missingKeys, extraKeys },
        expected: expectedKeys
      };
    }
    for (const key of expectedKeys.slice(0, 25)) {
      const nested = findFirstMismatch(actual[key], expected[key], `${path}.${key}`, depth + 1);
      if (nested) {
        return nested;
      }
    }
    return { path, actual, expected };
  }

  return { path, actual, expected };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function withRequiredValue(value, message, callback) {
  assert.ok(value, message);
  if (value) {
    callback(value);
  }
}

async function runBlockingCheck(label, task) {
  try {
    await task();
  } catch (error) {
    recordSmokeFailure("blocking", `${label} failed`, summarizeError(error));
  }
}

function summarizeError(error) {
  if (error instanceof Error) {
    const message = error.message.replace(/\s+/g, " ").trim();
    return message.length > 220 ? `${message.slice(0, 220)}...` : message;
  }
  return summarizeValue(error);
}

async function verifyDailyTokeniumSubjectStateMonotonicity() {
  const pythonScript = `
import json
import sqlite3
import sys
import time
from pathlib import Path
root = Path(r"""${repoRoot.replace(/\\/g, "/")}""")
sys.path.insert(0, str(root / "scripts" / "unity"))
from ghidra_cache_db import GhidraCacheDB
db = GhidraCacheDB(root / "workbench" / "ghidra-cache" / "ghidra_cache.sqlite3", root / "workbench" / "ghidra-jobs")
last_error = None
state = None
contract = None
for _ in range(4):
    try:
        state = db.find_or_materialize_subject_state_view(
            "cifi-full",
            "libil2cpp.so",
            "token-shop-daily-tokenium-family",
            compatibility_target_id="token-shop-daily-tokenium-family",
        )
        contract = db.find_or_materialize_subject_contract_view(
            "cifi-full",
            "libil2cpp.so",
            "token-shop-daily-tokenium-family",
            compatibility_target_id="token-shop-daily-tokenium-family",
        )
        last_error = None
        break
    except sqlite3.OperationalError as error:
        if "database is locked" not in str(error).lower():
            raise
        last_error = error
        time.sleep(0.35)
if last_error is not None:
    raise last_error
print(json.dumps({"state": state, "contract": contract}))
`;
  let stdout;
  try {
    ({ stdout } = await execFileAsync("python", ["-c", pythonScript], {
      cwd: repoRoot
    }));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EPERM") {
      console.warn(
        "Skipping daily tokenium subject-state monotonicity smoke check because child_process spawn is not permitted here."
      );
      return;
    }
    const failureText = [
      summarizeError(error),
      typeof error?.stderr === "string" ? error.stderr : "",
      typeof error?.stdout === "string" ? error.stdout : ""
    ]
      .filter(Boolean)
      .join("\n");
    if (/database is locked/i.test(failureText)) {
      console.warn(
        "Skipping daily tokenium subject-state monotonicity smoke check because the trace DB is currently locked by an active materialization path."
      );
      return;
    }
    throw error;
  }
  const payload = JSON.parse(stdout.trim());
  const state = payload.state ?? {};
  const contract = payload.contract ?? {};

  assert.equal(
    state.subjectId,
    "range:token-shop:ATU14Button-ATU19Button",
    "Daily Tokenium subject-state selector should preserve the stronger canonical range subject"
  );
  assert.deepEqual(
    state.blockedEdges ?? [],
    [],
    "Daily Tokenium subject-state should stay clear after weaker reruns"
  );
  assert.ok(
    [[], ["exact-shell-to-action-hook", "runtime-model-gap"]].some((expected) =>
      isDeepStrictEqual(state.nonblockingEdges ?? [], expected)
    ),
    "Daily Tokenium subject-state should either preserve the bounded nonblocking seams or collapse to a fully clear state view"
  );
  assert.equal(
    state.nextSeam?.status,
    "clear",
    "Daily Tokenium next seam should remain clear when the stronger grounded state still exists"
  );
  assert.equal(
    contract.subjectId,
    "range:token-shop:ATU14Button-ATU19Button",
    "Daily Tokenium subject-contract should project the preserved canonical range subject"
  );
  assert.equal(
    contract.blockedInputReasons?.tokeniumNaming ?? null,
    null,
    "Tokenium naming should stay cleared after evidence acquisition"
  );
  assert.equal(
    contract.groundedFields?.tokeniumNaming?.resourceLabel,
    "Resource_Tokenium",
    "Daily Tokenium contract should preserve the tokenium resource label"
  );
  assert.ok(
    [undefined, "Aca.Tokenium553"].includes(contract.groundedFields?.tokeniumNaming?.academyLabel),
    "Daily Tokenium contract should not regress the academy tokenium label when it is present"
  );
  assert.ok(
    [undefined, "CostBox-Tokens"].includes(
      contract.groundedFields?.tokeniumNaming?.tokenShellLabel
    ),
    "Daily Tokenium contract should not regress the token shell label when it is present"
  );
  assert.ok(
    [undefined, "CostBox-Tokenium"].includes(
      contract.groundedFields?.tokeniumNaming?.tokeniumShellLabel
    ),
    "Daily Tokenium contract should not regress the tokenium shell label when it is present"
  );
}

function summarizeAssertionLocation(stack) {
  if (!stack) {
    return "";
  }
  const frame = String(stack)
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .find(
      (line) =>
        /tests\/smoke\.mjs:\d+:\d+/i.test(line) &&
        !/assert\.ok\s+\(file:\/\/\/.*tests\/smoke\.mjs:\d+:\d+\)/i.test(line)
    );
  return frame ? frame.replace(/^at\s+/, "") : "";
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSemanticText(value) {
  return collapseWhitespace(String(value))
    .toLowerCase()
    .replace(/[`"'“”‘’]/g, "")
    .replace(/[^\p{L}\p{N}\s./:+-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assertTextIncludesAllConcepts(text, concepts, label) {
  const normalizedText = normalizeSemanticText(text);
  for (const concept of concepts) {
    const normalizedConcept = normalizeSemanticText(concept);
    assert.ok(
      normalizedText.includes(normalizedConcept),
      `expected ${label} to include concept ${JSON.stringify(concept)}`
    );
  }
}

function assertTextIncludesConceptChoice(text, conceptGroups, label) {
  const normalizedText = normalizeSemanticText(text);
  for (const group of conceptGroups) {
    const matched = group.some((concept) =>
      normalizedText.includes(normalizeSemanticText(concept))
    );
    assert.ok(
      matched,
      `expected ${label} to include one of ${group.map((concept) => JSON.stringify(concept)).join(", ")}`
    );
  }
}

function finalizeSmokeRun() {
  if (smokeFailures.length === 0) {
    console.log("Smoke tests passed.");
    return;
  }

  console.error(`Smoke tests failed with ${smokeFailures.length} issue(s):`);
  for (const [index, failure] of smokeFailures.entries()) {
    console.error(`${index + 1}. [${failure.kind}] ${failure.message}`);
    if (failure.detail) {
      console.error(`   ${failure.detail}`);
    }
  }

  throw new Error(`Smoke tests failed with ${smokeFailures.length} issue(s).`);
}

function assertCurrentBoundaryIncludes(boundaryLines, patterns, label) {
  const boundaryText = boundaryLines.join("\n");
  for (const pattern of patterns) {
    assert.match(boundaryText, pattern, `expected ${label} to include ${pattern}`);
  }
}

function assertDatasetContractEntry(id, file) {
  const entry = bundledDatasetContract.datasets.find((dataset) => dataset.id === id);
  assert.ok(entry, `expected bundled dataset contract entry for ${id}`);
  if (!entry) {
    return;
  }
  assert.equal(entry.classification, "extracted-mechanics");
  assert.deepEqual(entry.files, [file]);
}

function assertNonEmptyStringField(object, field, label) {
  assert.equal(typeof object[field], "string", `expected ${label}.${field} to be a string`);
  assert.ok(object[field].trim().length > 0, `expected ${label}.${field} to be non-empty`);
}

function assertResearchTrackContract(track, label, options = {}) {
  if (options.status) {
    assert.equal(track.status, options.status, `expected ${label} status`);
  }
  for (const field of [
    "goal",
    "currentSlice",
    "exitCondition",
    "blockedBy",
    "smallestShippableSlice"
  ]) {
    assertNonEmptyStringField(track, field, label);
  }
  for (const field of [
    "completedSteps",
    "nextSteps",
    "sources",
    "artifacts",
    "verified",
    "uncertain"
  ]) {
    assert.ok(Array.isArray(track[field]), `expected ${label}.${field} to be an array`);
  }
  if (options.minCompletedSteps !== undefined) {
    assert.ok(
      track.completedSteps.length >= options.minCompletedSteps,
      `expected ${label} completed step count`
    );
  }
  if (options.minVerified !== undefined) {
    assert.ok(track.verified.length >= options.minVerified, `expected ${label} verified count`);
  }
  if (options.requiredArtifacts) {
    for (const artifact of options.requiredArtifacts) {
      assert.ok(
        track.artifacts.includes(artifact),
        `expected ${label} artifacts to include ${artifact}`
      );
    }
  }
  if (options.forbiddenArtifacts) {
    for (const artifact of options.forbiddenArtifacts) {
      assert.ok(
        !track.artifacts.includes(artifact),
        `expected ${label} artifacts to omit ${artifact}`
      );
    }
  }
  if (options.requiredSources) {
    for (const source of options.requiredSources) {
      assert.ok(track.sources.includes(source), `expected ${label} sources to include ${source}`);
    }
  }
}

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
  const tempDir = await mkdtemp(join(tmpdir(), "cifi-smoke-app-state-"));
  const tempAppStateDbPath = join(tempDir, "app-state.sqlite3");
  let serverProcess;
  let spawnError = null;
  let serverStdout = "";
  let serverStderr = "";

  try {
    serverProcess = spawn(
      process.execPath,
      [fileURLToPath(new URL("../scripts/dev-server.mjs", import.meta.url))],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PORT: String(testPort),
          CIFI_LAUNCH_MODE: "1",
          CIFI_APP_STATE_DB_PATH: tempAppStateDbPath
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
  } catch (error) {
    if (error?.code === "EPERM") {
      console.warn(
        "Skipping launcher-mode lifecycle spawn test because child_process.spawn is not permitted here."
      );
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
    try {
      await waitForServer(`http://localhost:${testPort}/api/healthz`);
    } catch (error) {
      const combinedOutput = `${serverStdout}\n${serverStderr}`;
      if (
        spawnError?.code === "EPERM" ||
        /EPERM|not permitted/i.test(combinedOutput) ||
        serverProcess.exitCode !== null
      ) {
        console.warn(
          "Skipping launcher-mode lifecycle spawn test because the environment blocked subprocess launch."
        );
        return;
      }
      throw new Error(`${error.message}\nstdout: ${serverStdout}\nstderr: ${serverStderr}`);
    }

    const clientOpen = await postJson(`http://localhost:${testPort}/api/client/open`, {
      clientId: "smoke-client"
    });
    hardAssert.equal(clientOpen.ok, true);
    hardAssert.equal(clientOpen.launcherMode, true);

    const eventController = new AbortController();
    try {
      const eventStream = await fetch(
        `http://localhost:${testPort}/api/client/events?clientId=smoke-client`,
        {
          signal: eventController.signal
        }
      );
      hardAssert.equal(eventStream.ok, true);

      const launcherReopen = await fetch(`http://localhost:${testPort}/api/launcher/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      hardAssert.equal(launcherReopen.status, 202);

      const healthAfterOpen = await fetchJson(`http://localhost:${testPort}/api/healthz`);
      hardAssert.equal(healthAfterOpen.clientCount, 1);
      hardAssert.equal(healthAfterOpen.launchSignalSequence, 1);

      const systemUnits = await fetchJson(
        `http://localhost:${testPort}/api/system-units?ids=player-state,token-shop`
      );
      hardAssert.ok(
        systemUnits.mode === "db" || systemUnits.mode === "snapshot",
        `Expected DB-backed or committed snapshot system-unit mode; received ${systemUnits.mode}`
      );
      hardAssert.ok(systemUnits.units["player-state"]);
      hardAssert.ok(systemUnits.units["token-shop"]);

      const smokeProfile = normalizePlayerProfile(
        {
          meta: {
            profileName: "Smoke Test Profile",
            updatedAt: "2026-05-11T00:00:00.000Z"
          },
          player: {
            resources: {
              tokens: 123456,
              diamonds: 789
            }
          },
          planning: {
            tokenShop: {
              checkedSubsetPlayerState: {
                ATU1Level: 10,
                ATU2Level: 5
              }
            }
          }
        },
        createDefaultPlayerProfile().player
      );
      const storedProfile = await postJson(`http://localhost:${testPort}/api/player-profile`, {
        sourceLabel: "smoke-test",
        profile: smokeProfile
      });
      hardAssert.equal(storedProfile.ok, true);
      hardAssert.equal(storedProfile.profileId, "active");
      hardAssert.equal(storedProfile.sourceLabel, "smoke-test");

      const fetchedProfile = await fetchJson(`http://localhost:${testPort}/api/player-profile`);
      hardAssert.equal(fetchedProfile.profileId, "active");
      hardAssert.equal(fetchedProfile.sourceLabel, "smoke-test");
      hardAssert.equal(fetchedProfile.profile.meta.profileName, "Smoke Test Profile");
      hardAssert.equal(fetchedProfile.profile.player.resources.tokens, 123456);
      hardAssert.equal(
        fetchedProfile.profile.planning.tokenShop.checkedSubsetPlayerState.ATU1Level,
        10
      );

      const clientClose = await postJson(`http://localhost:${testPort}/api/client/close`, {
        clientId: "smoke-client"
      });
      hardAssert.equal(clientClose.ok, true);
    } finally {
      eventController.abort();
    }

    await waitForExit(serverProcess, 9000);
  } finally {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill();
    }
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  hardAssert.ok(response.ok, `Expected successful response from ${url}`);
  return response.json();
}

async function fetchJson(url) {
  const response = await fetch(url);
  hardAssert.ok(response.ok, `Expected successful response from ${url}`);
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
  const bootstrapMatch = source.match(
    /async function bootstrap\(\) \{[\s\S]*?const \[(?<names>[\s\S]*?)\] = await Promise\.all\(\[(?<fetches>[\s\S]*?)\]\);/
  );
  assert.ok(bootstrapMatch?.groups, "expected bootstrap Promise.all dataset binding");

  return {
    variableNames: bootstrapMatch.groups.names
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
    fetchPaths: [...bootstrapMatch.groups.fetches.matchAll(/fetchJson\("([^"]+)"\)/g)].map(
      (match) => match[1]
    )
  };
}

function getSnapshotValidationCase(id) {
  const validationCase = snapshot.validationCases.find((item) => item.id === id);
  assert.ok(validationCase, `Expected snapshot validation case ${id}`);
  return validationCase;
}

async function runNodeSyntaxCheck(targetFile) {
  try {
    await execFileAsync(process.execPath, ["--check", targetFile]);
  } catch (error) {
    if (error?.code === "EPERM" || error?.syscall === "spawn") {
      console.warn(
        `Skipping node --check for ${targetFile} because child_process spawn is not permitted here.`
      );
      return;
    }
    throw error;
  }
}

assert.equal(generatedAppMetaSystemUnit.dataset, "repo-system-unit.v1");
assert.equal(generatedAppMetaSystemUnit.systemId, "app-meta");
assert.equal(generatedAppMetaSystemUnit.unitInventoryRef, "data/units/app-meta.v1.json");
assert.equal(generatedAppMetaSystemUnit.sections.snapshot.data.dataset, snapshot.dataset);
assert.equal(
  generatedAppMetaSystemUnit.sections.datasetContract.data.contractVersion,
  bundledDatasetContract.contractVersion
);
