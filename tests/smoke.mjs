import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
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

const snapshot = JSON.parse(await readFile(new URL("../data/game-data.snapshot.v1.json", import.meta.url), "utf8"));
const groundedShardMilestones = JSON.parse(await readFile(new URL("../data/shard-milestones.grounded.v1.json", import.meta.url), "utf8"));
const groundedShardObserved = JSON.parse(await readFile(new URL("../data/shard-observed-behaviors.grounded.v1.json", import.meta.url), "utf8"));
const groundedShardProvenance = JSON.parse(await readFile(new URL("../data/shard-milestones-provenance.grounded.v1.json", import.meta.url), "utf8"));
const shardAssetGrounding = JSON.parse(await readFile(new URL("../data/shard-asset-grounding.v1.json", import.meta.url), "utf8"));
const shardOwnerFamilyBoundary = JSON.parse(await readFile(new URL("../data/shard-owner-family-boundary.v1.json", import.meta.url), "utf8"));
const shardFinalSuBonusBoundary = JSON.parse(await readFile(new URL("../data/shard-finalsu-bonus-boundary.v1.json", import.meta.url), "utf8"));
const shardMilestonePayloadBoundary = JSON.parse(await readFile(new URL("../data/shard-milestone-payload-boundary.v1.json", import.meta.url), "utf8"));
const shardCostModelBoundary = JSON.parse(await readFile(new URL("../data/shard-cost-model-boundary.v1.json", import.meta.url), "utf8"));
const shardMilestoneRowModelBoundary = JSON.parse(await readFile(new URL("../data/shard-milestone-row-model-boundary.v1.json", import.meta.url), "utf8"));
const shardMilestoneTitleEffectBoundary = JSON.parse(await readFile(new URL("../data/shard-milestone-title-effect-boundary.v1.json", import.meta.url), "utf8"));
const shardEffectTextHandlerBoundary = JSON.parse(await readFile(new URL("../data/shard-effect-text-handler-boundary.v1.json", import.meta.url), "utf8"));
const shardMilestoneRowShellBoundary = JSON.parse(await readFile(new URL("../data/shard-milestone-row-shell-boundary.v1.json", import.meta.url), "utf8"));
const shardMilestoneRowAlignmentBoundary = JSON.parse(await readFile(new URL("../data/shard-milestone-row-alignment-boundary.v1.json", import.meta.url), "utf8"));
const shardMilestoneHandoffBoundary = JSON.parse(await readFile(new URL("../data/shard-milestone-handoff-boundary.v1.json", import.meta.url), "utf8"));
const shardSaveBoundary = JSON.parse(await readFile(new URL("../data/shard-save-boundary.v1.json", import.meta.url), "utf8"));
const shardMilestoneSaveOwnerCandidates = JSON.parse(await readFile(new URL("../data/shard-milestone-save-owner-candidates.v1.json", import.meta.url), "utf8"));
const shardSceneMonoBehaviourProbe = JSON.parse(await readFile(new URL("../data/shard-scene-monobehaviour-probe.v1.json", import.meta.url), "utf8"));
const shardCostParameterProbe = JSON.parse(await readFile(new URL("../data/shard-cost-parameter-probe.v1.json", import.meta.url), "utf8"));
const shardCostMethodProbe = JSON.parse(await readFile(new URL("../data/shard-cost-method-probe.v1.json", import.meta.url), "utf8"));
const shardCostNativeProbe = JSON.parse(await readFile(new URL("../data/shard-cost-native-probe.v1.json", import.meta.url), "utf8"));
const shardCostScreenshotCalibration = JSON.parse(await readFile(new URL("../data/shard-cost-screenshot-calibration.v1.json", import.meta.url), "utf8"));
const shardCostListPathProbe = JSON.parse(await readFile(new URL("../data/shard-cost-list-path-probe.v1.json", import.meta.url), "utf8"));
const shardCostFormulaModel = JSON.parse(await readFile(new URL("../data/shard-cost-formula-model.v1.json", import.meta.url), "utf8"));
const shardBonusSlotProbe = JSON.parse(await readFile(new URL("../data/shard-bonus-slot-probe.v1.json", import.meta.url), "utf8"));
const shardTypeMetadataProbe = JSON.parse(await readFile(new URL("../data/shard-type-metadata-probe.v1.json", import.meta.url), "utf8"));
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
const tokenShopRowLevelOwnerData = JSON.parse(await readFile(new URL("../data/token-shop-row-level-owner.json", import.meta.url), "utf8"));
const multiverseMarketSaveBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-save-boundary.json", import.meta.url), "utf8"));
const multiverseMarketMarketMemberBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-market-member-boundary.json", import.meta.url), "utf8"));
const multiverseMarketSaveDataImportBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-savedata-import-boundary.json", import.meta.url), "utf8"));
const multiverseMarketRow6974IdentitySourceBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-row69-74-identity-source-boundary.json", import.meta.url), "utf8"));
const multiverseMarketSerializedLabelSourceBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-serialized-label-source-boundary.json", import.meta.url), "utf8"));
const multiverseMarketRow7174IdentityBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-row71-74-identity-boundary.json", import.meta.url), "utf8"));
const multiverseMarketRow7174RemapBandData = JSON.parse(await readFile(new URL("../data/multiverse-market-row71-74-remap-band.json", import.meta.url), "utf8"));
const multiverseMarketNearbyIdentityBindingPatternData = JSON.parse(await readFile(new URL("../data/multiverse-market-nearby-identity-binding-pattern.json", import.meta.url), "utf8"));
const multiverseMarketInscriptionNumberingStabilityBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-inscription-numbering-stability-boundary.json", import.meta.url), "utf8"));
const multiverseMarket6974AnomalyProvenanceData = JSON.parse(await readFile(new URL("../data/multiverse-market-69-74-anomaly-provenance.json", import.meta.url), "utf8"));
const multiverseMarketShellRowPredictionBoundaryData = JSON.parse(await readFile(new URL("../data/multiverse-market-shell-row-prediction-boundary.json", import.meta.url), "utf8"));
const tokenBankControllerShellData = JSON.parse(await readFile(new URL("../data/token-bank-controller-shell.json", import.meta.url), "utf8"));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appJs = await readFile(new URL("../app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const recommendationContractModule = await readFile(new URL("../recommendation-contract.js", import.meta.url), "utf8");
const recommendationFixtures = JSON.parse(await readFile(new URL("./fixtures/recommendation-actions.fixtures.json", import.meta.url), "utf8"));
const shardVerificationDoc = await readFile(new URL("../docs/systems/shards/shard-system-verification.md", import.meta.url), "utf8");
const shardGroundingBoundaryDoc = await readFile(new URL("../docs/systems/shards/shard-grounding-boundary.md", import.meta.url), "utf8");
const shardPlayerFacingEvidenceDoc = await readFile(new URL("../docs/systems/shards/shard-player-facing-evidence.md", import.meta.url), "utf8");
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
const datasetIndexGeneratedDoc = await readFile(new URL("../docs/contracts/dataset-index.generated.md", import.meta.url), "utf8");
const shardResearchNote = await readFile(new URL("../docs/research/shard-milestones-grounded-2026-03-28.md", import.meta.url), "utf8");
const tokenShopDoc = await readFile(new URL("../docs/systems/spend/token-shop-values.md", import.meta.url), "utf8");
const multiverseMarketDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-values.md", import.meta.url), "utf8");
const multiverseMarketVerificationDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-verification.md", import.meta.url), "utf8");
const multiverseMarketStateVerificationDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-state-verification.md", import.meta.url), "utf8");
const multiverseMarketMarketMemberBoundaryDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-market-member-boundary.md", import.meta.url), "utf8");
const multiverseMarket6974AnomalyProvenanceDoc = await readFile(new URL("../docs/systems/spend/multiverse-market-69-74-anomaly-provenance.md", import.meta.url), "utf8");
const tokenBankStateDoc = await readFile(new URL("../docs/systems/spend/token-bank-state-verification.md", import.meta.url), "utf8");
const dailyTokeniumMissionDoc = await readFile(new URL("../docs/systems/spend/daily-tokenium-mission-lane-verification.md", import.meta.url), "utf8");
const activeGroundingBoundariesDoc = await readFile(new URL("../docs/roadmap/active-grounding-boundaries.md", import.meta.url), "utf8");
const shardIngestDoc = await readFile(new URL("../docs/systems/shards/shard-milestones-grounding-ingest.md", import.meta.url), "utf8");
const unityAuditPlaybook = await readFile(new URL("../docs/unity/unity-audit-playbook.md", import.meta.url), "utf8");
const devServer = await readFile(new URL("../scripts/dev-server.mjs", import.meta.url), "utf8");
const probeRunner = await readFile(new URL("../scripts/unity/run_probe.mjs", import.meta.url), "utf8");
const launcherVbs = await readFile(new URL("../launch-cifi.vbs", import.meta.url), "utf8");
const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const generatedDatasetIndex = await generateDatasetIndex(repoRoot);
await runNodeSyntaxCheck(fileURLToPath(new URL("../app.js", import.meta.url)));
const datasetValidation = await validateBundledDatasets();
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
  [
    "snapshot",
    "datasetContract",
    "shipBaseline",
    "groundedShardMilestones",
    "groundedShardObservedBehaviors",
    "groundedShardProvenance",
    "shardAssetGrounding",
    "shardOwnerFamilyBoundary",
    "shardFinalSuBonusBoundary",
    "shardMilestonePayloadBoundary",
    "shardCostModelBoundary",
    "shardMilestoneRowModelBoundary",
    "shardMilestoneTitleEffectBoundary",
    "shardEffectTextHandlerBoundary",
    "shardMilestoneRowShellBoundary",
    "shardMilestoneRowAlignmentBoundary",
      "shardSaveBoundary",
      "shardSceneMonoBehaviourProbe",
      "shardCostParameterProbe",
      "shardCostNativeProbe",
      "shardBonusSlotProbe",
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
    "multiverseMarketMarketMemberBoundary",
    "tokenBankControllerShell"
  ],
  "bootstrap dataset destructuring changed unexpectedly"
);
assert.deepEqual(
  bootstrapDatasetBindings.fetchPaths,
  [
    "./data/game-data.snapshot.v1.json",
    "./data/bundled-dataset-contract.v1.json",
    "./data/ship-optimizer.desmos-baseline.v1.json",
    "./data/shard-milestones.grounded.v1.json",
    "./data/shard-observed-behaviors.grounded.v1.json",
    "./data/shard-milestones-provenance.grounded.v1.json",
    "./data/shard-asset-grounding.v1.json",
    "./data/shard-owner-family-boundary.v1.json",
    "./data/shard-finalsu-bonus-boundary.v1.json",
    "./data/shard-milestone-payload-boundary.v1.json",
    "./data/shard-cost-model-boundary.v1.json",
    "./data/shard-milestone-row-model-boundary.v1.json",
    "./data/shard-milestone-title-effect-boundary.v1.json",
    "./data/shard-effect-text-handler-boundary.v1.json",
    "./data/shard-milestone-row-shell-boundary.v1.json",
    "./data/shard-milestone-row-alignment-boundary.v1.json",
    "./data/shard-save-boundary.v1.json",
    "./data/shard-scene-monobehaviour-probe.v1.json",
    "./data/shard-cost-parameter-probe.v1.json",
    "./data/shard-cost-native-probe.v1.json",
    "./data/shard-bonus-slot-probe.v1.json",
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
    "./data/multiverse-market-market-member-boundary.json",
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
assert.match(appJs, /Grounded shard evidence/);
assert.match(appJs, /Ownership mapping/);
assert.match(appJs, /Shard-specific ownership evidence is narrowed, not resolved/);
assert.match(appJs, /Shard-cost evidence/);
assert.match(appJs, /Recovered cost data now supports evidence cards/);
assert.match(appJs, /Safe shard truths already shown in the app/);
assert.match(appJs, /Recovered shard-cost evidence stays descriptive/);
assert.match(appJs, /What must be grounded before stronger behavior/);
assert.match(appJs, /If uncertainty remains high, the correct output is a better research note, not stronger planner behavior/);
assert.match(appJs, /function renderDatasetRefreshHardening/);
assert.match(appJs, /Dataset refresh hardening path/);
assert.match(appJs, /Use this before promoting new bundled data or refreshing shipped JSON assets/);
assert.match(appJs, /data\/bundled-dataset-contract\.v1\.json/);
assert.match(appJs, /canonical-app-snapshot/);
assert.match(appJs, /community-derived/);
assert.match(appJs, /function renderSpendPlannerBoundary/);
assert.match(appJs, /Spend planner first slice/);
assert.match(appJs, /Bounded preview only\. This panel separates grounded canonical inputs, evidence-backed boundary inputs, and blocked planner inputs while owner recovery and remap work remain unresolved/);
assert.match(appJs, /Grounded canonical inputs available now/);
assert.match(appJs, /Evidence-backed boundary inputs available now/);
assert.match(appJs, /Blocked inputs and unavailable planner actions/);
assert.match(appJs, /Active Emporium import-surface decision/);
assert.match(appJs, /Why recommendations stay unavailable/);
assert.match(appJs, /Tokens",\s*value: canonical\.tokens/);
assert.match(appJs, /Diamonds",\s*value: canonical\.diamonds/);
assert.match(appJs, /Current LR",\s*value: canonical\.loopReset/);
assert.match(appJs, /Academy relics",\s*value: canonical\.academyRelics/);
assert.match(appJs, /Banked tokens \(stored amount\)",\s*value: compatibility\.unmappedSystems\?\.tokenShop\?\.BankedTokens/);
assert.match(appJs, /Exact SaveData\.BankedTokens recovery grounds the current stored token-bank amount as boundary-backed state only/);
assert.match(appJs, /TokenShop current row levels/);
assert.match(appJs, /token-bank cap and claimable tokens/i);
assert.match(appJs, /Daily Tokenium current amount or cap/);
assert.match(appJs, /Emporium owned progression and Inscryptions balance/);
assert.match(appJs, /Grounded SaveData overlap currently stops at ordered rows/);
assert.match(appJs, /Emporium next step:/);
assert.match(appJs, /Confidence label: canonical PlayerProfile values and explicitly labeled boundary-backed evidence only/);
assert.match(appJs, /Canonical boundary preserved/);
assert.match(appJs, /Boundary-backed evidence labeled/);
assert.match(appJs, /Uncertainty visible/);
assert.match(appJs, /No spend recommendations yet/);
assert.match(appJs, /function getRecommendationExplainabilitySummary/);
assert.match(appJs, /function getRecommendationContractSummary/);
assert.match(appJs, /function getRecommendationExplainabilityAudit/);
assert.match(appJs, /function getActiveMvpRecommendationFeedPartition\(\)/);
assert.match(appJs, /function renderRecommendationFeedSupportNotice\(results, surface\)/);
assert.match(appJs, /failed the shared recommendation contract and were removed from the main feed/);
assert.match(appJs, /Use the contract audit details to repair those cards before treating them as player-facing guidance/);
assert.match(appJs, /All visible cards currently satisfy the shared recommendation contract\./);
assert.match(appJs, /Contract gaps still hide/);
assert.match(appJs, /Status: Contract gaps\./);
assert.match(appJs, /The current card satisfies the shared recommendation contract\./);
assert.match(appJs, /Player value/);
assert.match(appJs, /Spend-planner recommendations remain blocked by system-mapping gaps/);
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
const expectedBundledDatasetIds = [
  "snapshot",
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
  "shard-scene-monobehaviour-probe",
  "shard-cost-parameter-probe",
  "shard-cost-method-probe",
  "shard-cost-native-probe",
  "shard-cost-screenshot-calibration",
  "shard-cost-list-path-probe",
  "shard-cost-formula-model",
  "shard-bonus-slot-probe",
  "shard-type-metadata-probe",
  "extraction-candidate-families",
  "extraction-candidate-ranking",
  "token-shop",
  "multiverse-market",
  "multiverse-market-metadata-neighborhood",
  "tokenium-naming-clues",
  "token-bank-state-clues",
  "daily-tokenium-lane-clues",
  "token-bank-formula-boundary",
  "multiverse-market-range-boundary",
  "multiverse-market-row-text-coverage",
  "multiverse-market-prefab-remap-boundary",
  "token-shop-cost-lanes",
  "spend-action-lane-clues",
  "multiverse-market-action-shell",
  "multiverse-market-owner-family",
  "token-shop-owner-shell",
  "token-shop-save-boundary",
  "token-shop-row-level-owner",
  "token-shop-row-remap-boundary",
  "multiverse-market-save-boundary",
  "multiverse-market-market-member-boundary",
  "multiverse-market-savedata-import-boundary",
  "multiverse-market-row69-74-identity-source-boundary",
  "multiverse-market-serialized-label-source-boundary",
  "multiverse-market-row71-74-identity-boundary",
  "multiverse-market-row71-74-remap-band",
  "multiverse-market-nearby-identity-binding-pattern",
  "multiverse-market-inscription-numbering-stability-boundary",
  "multiverse-market-69-74-anomaly-provenance",
  "multiverse-market-shell-row-prediction-boundary",
  "token-bank-controller-shell"
];

const defaultProfile = createDefaultPlayerProfile();
assert.deepEqual(defaultProfile.planning.shards.observedLevelsByMilestone, {});
assert.deepEqual(defaultProfile.externalModels.communityTools.shipOptimizer, {});
assert.deepEqual(defaultProfile.externalModels.communityTools.shardOptimizer, {});
assert.deepEqual(defaultProfile.externalModels.communityTools.modTreeOptimizer, {});

assert.equal(snapshot.snapshotVersion, "v1.0.0-alpha");
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
assert.deepEqual(
  bundledDatasetContract.datasets.map((entry) => entry.classification),
  ["canonical-app-snapshot", "grounded-descriptive", ...new Array(bundledDatasetContract.datasets.length - 2).fill("extracted-mechanics")]
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
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.planner.shardObservedLevelsByMilestone.some((path) => path.join(".") === "systems.shards.observedLevelsByMilestone"));
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.compatibility.shardMilestoneState.some((path) => path.join(".") === "compatibility.unmappedSystemState.shardMilestoneState"));
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.compatibility.shardMilestoneState.some((path) => path.join(".") === "systems.shardMilestones"));
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.shipCalibration.communityToolState.some((path) => path.join(".") === "externalModels.shipPlanner.communityToolState"));
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.compatibility.tokenShop.some((path) => path.join(".") === "systems.tokenBank"));
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.compatibility.tokenShopStateClues.some((path) => path.join(".") === "FinalTokenBankFillSpeed"));
assert.ok(PLAYER_PROFILE_IMPORT_ALIASES.compatibility.multiverseMarketStateClues.some((path) => path.join(".") === "InscryptionsDone"));
assert.equal(playerProfileAliasAuditData.version, "v1");
assert.equal(playerProfileAliasAuditData.groupCount, 7);
assert.equal(playerProfileAliasAuditData.aliasCount, 33);
assert.equal(playerProfileAliasAuditData.acceptedPathCount, 83);
assert.deepEqual(
  playerProfileAliasAuditData.groups.map((group) => group.id),
  ["meta", "canonical", "planner", "externalModel", "experimental", "compatibility", "shipCalibration"]
);
assert.match(playerProfileAliasAuditDoc, /# PlayerProfile Import Aliases/);
assert.match(playerProfileAliasAuditDoc, /## Canonical Shared Truth/);
assert.match(playerProfileAliasAuditDoc, /## Compatibility-only Migration Sinks/);
assert.match(playerProfileAliasAuditDoc, /systems\.ship\.playerState/);
assert.match(playerProfileAliasAuditDoc, /Accepted alias paths: 3/);
assert.match(playerProfileAliasAuditDoc, /Accepted alias paths: 31/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `resourceFocus`/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `power`/);
assert.doesNotMatch(playerProfileAliasAuditDoc, /, `hunterLevel` \|/);
assert.ok(snapshot.shipLoadouts.length >= 4, "expected ship loadouts");
assert.deepEqual(snapshot.shardMilestones, [], "expected shard milestones to stay quarantined until verified");
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
assert.match(getSnapshotValidationCase("recommendation-feed-contract").description, /contract-valid actions/i);
assert.match(appJs, /id:\s*"loop-guardrail-input-warning"/);
assert.match(appJs, /activeFeedContract\.invalidCount === 0/);
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
assert.equal(shardCostModelBoundary.dataset, "shard-cost-model-boundary.v1");
assert.equal(shardCostModelBoundary.dataCarrier, "ShardUpgradeInfo");
assert.equal(shardCostModelBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.deepEqual(shardCostModelBoundary.sampleCostAccessorWindows[0], {
  label: "earlyWindow",
  start: 0,
  end: 9,
  count: 10,
  accessors: ["get_SU0Cost", "get_SU1Cost", "get_SU2Cost", "get_SU3Cost", "get_SU4Cost", "get_SU5Cost", "get_SU6Cost", "get_SU7Cost", "get_SU8Cost", "get_SU9Cost"]
});
assert.deepEqual(shardCostModelBoundary.sampleCostAccessorWindows[1], {
  label: "lateWindow",
  start: 23,
  end: 29,
  count: 7,
  accessors: ["get_SU23Cost", "get_SU24Cost", "get_SU25Cost", "get_SU26Cost", "get_SU27Cost", "get_SU28Cost", "get_SU29Cost"]
});
assert.ok(shardCostModelBoundary.row0CostFields.includes("SU0StartCost"));
assert.ok(shardCostModelBoundary.row0CostFields.includes("SU0GrowthExponent3"));
assert.ok(shardCostModelBoundary.row0FillFields.includes("SU0Level8Fill"));
assert.ok(shardCostModelBoundary.row0BonusFields.includes("SU0Bonus8"));
assert.ok(shardCostModelBoundary.optimizerBoundary.supportedNow.includes("row-local shard cost-parameter extraction and consistency checks against get_SU*Cost accessors"));
assert.ok(shardCostModelBoundary.optimizerBoundary.blockedNow.includes("exact per-level shard costs"));
assert.ok(shardCostModelBoundary.currentBoundary.some((line) => /Do not derive exact shard cost formulas/.test(line)));
assert.equal(shardMilestoneRowModelBoundary.dataset, "shard-milestone-row-model-boundary.v1");
assert.equal(shardMilestoneRowModelBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.deepEqual(shardMilestoneRowModelBoundary.textCheckerRange, { start: 0, end: 29, count: 30 });
assert.deepEqual(shardMilestoneRowModelBoundary.unlockRequirementRange, { start: 0, end: 29, count: 30 });
assert.deepEqual(shardMilestoneRowModelBoundary.buyHookEvidence.shardLocalDirectHooks, ["BuyMilestone0"]);
assert.deepEqual(shardMilestoneRowModelBoundary.buyHookEvidence.genericNumberedFamily, { family: "ConstructionMilestones, Assembly-CSharp", start: 1, end: 57, count: 57 });
assert.ok(shardMilestoneRowModelBoundary.currentBoundary.some((line) => /Do not infer that rows 0-29 are already mapped/.test(line)));
assert.equal(shardMilestoneTitleEffectBoundary.dataset, "shard-milestone-title-effect-boundary.v1");
assert.ok(shardMilestoneTitleEffectBoundary.titleAssetCandidates.some((entry) => entry.row === 0 && entry.assetName === "SMilestone-0-Eternal(OURO)"));
assert.ok(shardMilestoneTitleEffectBoundary.titleAssetCandidates.some((entry) => entry.row === 29 && entry.assetName === "SMilestone-29-Earthly"));
assert.ok(shardMilestoneTitleEffectBoundary.titleAssetCandidates.some((entry) => entry.row === 30 && entry.assetName === "SMilestone-30-Illuminating"));
assert.equal(shardMilestoneTitleEffectBoundary.titleAssetCandidates.filter((entry) => entry.row === 28).length, 2);
assert.ok(shardMilestoneTitleEffectBoundary.effectPresentationSlots.includes("ShardMilestoneBonus1"));
assert.ok(shardMilestoneTitleEffectBoundary.effectPresentationSlots.includes("ShardMilestoneBonus8"));
assert.ok(shardMilestoneTitleEffectBoundary.sampleBonusCalcAccessors.includes("get_SU1Bonus1Calc"));
assert.ok(shardMilestoneTitleEffectBoundary.sampleBonusCalcAccessors.includes("get_SU5Bonus2Calc"));
assert.ok(shardMilestoneTitleEffectBoundary.findings.some((line) => /row 28 currently has conflicting shipped asset title candidates/i.test(line)));
assert.ok(shardMilestoneTitleEffectBoundary.currentBoundary.some((line) => /Do not treat the title list as fully conflict-free/.test(line)));
assert.equal(shardEffectTextHandlerBoundary.dataset, "shard-effect-text-handler-boundary.v1");
assert.equal(shardEffectTextHandlerBoundary.probableTextHandler, "TextHandlerShardMilestoneBonusesPerLevel/N");
assert.equal(shardEffectTextHandlerBoundary.genericMilestoneWriter, "SetAllMilestoneTexts");
assert.deepEqual(shardEffectTextHandlerBoundary.rowModelCoverage, { start: 0, end: 29, count: 30 });
assert.ok(shardEffectTextHandlerBoundary.presentationFamily.includes("ShardMilestoneBonus1"));
assert.ok(shardEffectTextHandlerBoundary.presentationFamily.includes("ShardMilestoneBonus8"));
assert.ok(shardEffectTextHandlerBoundary.sampleBonusCalcAccessors.includes("get_SU1Bonus1Calc"));
assert.ok(shardEffectTextHandlerBoundary.sampleBonusCalcAccessors.includes("get_SU5Bonus2Calc"));
assert.ok(shardEffectTextHandlerBoundary.uiContextAnchors.includes("LevelText"));
assert.ok(shardEffectTextHandlerBoundary.uiContextAnchors.includes("DescriptionText"));
assert.ok(shardEffectTextHandlerBoundary.currentBoundary.some((line) => /Do not treat this boundary as a recovered row-complete effect-text table/.test(line)));
assert.equal(shardMilestoneRowShellBoundary.dataset, "shard-milestone-row-shell-boundary.v1");
assert.equal(shardMilestoneRowShellBoundary.screenControllerFamily, "ShardMining, Assembly-CSharp");
assert.equal(shardMilestoneRowShellBoundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo");
assert.ok(shardMilestoneRowShellBoundary.controllerShellAnchors.includes("FastBuyButtonMethodShards"));
assert.ok(shardMilestoneRowShellBoundary.unlockHookSamples.includes("UnlockMilestone17"));
assert.ok(shardMilestoneRowShellBoundary.unlockHookSamples.includes("UnlockMilestone29"));
assert.ok(shardMilestoneRowShellBoundary.buyHookSamples.includes("BuyMilestone0"));
assert.ok(shardMilestoneRowShellBoundary.textCheckerSamples.includes("Milestone0TextChecker"));
assert.ok(shardMilestoneRowShellBoundary.textCheckerSamples.includes("Milestone12TextChecker"));
assert.ok(shardMilestoneRowShellBoundary.currentBoundary.some((line) => /Do not treat this partial row shell/.test(line)));
assert.equal(shardMilestoneRowAlignmentBoundary.dataset, "shard-milestone-row-alignment-boundary.v1");
assert.equal(shardMilestoneRowAlignmentBoundary.screenControllerFamily, "ShardMining, Assembly-CSharp");
assert.deepEqual(shardMilestoneRowAlignmentBoundary.unlockHookRange, { start: 17, end: 29, count: 13 });
assert.deepEqual(shardMilestoneRowAlignmentBoundary.textCheckerRange, { start: 0, end: 12, count: 13 });
assert.deepEqual(shardMilestoneRowAlignmentBoundary.buyHookRange, { start: 0, end: 0, count: 1 });
assert.deepEqual(shardMilestoneRowAlignmentBoundary.unlockTextCheckerOverlapIds, []);
assert.deepEqual(shardMilestoneRowAlignmentBoundary.buyTextCheckerOverlapIds, [0]);
assert.ok(shardMilestoneRowAlignmentBoundary.currentBoundary.some((line) => /Do not infer that UnlockMilestone17 already maps/.test(line)));
assert.equal(shardMilestoneHandoffBoundary.dataset, "shard-milestone-handoff-boundary.v1");
assert.equal(shardMilestoneHandoffBoundary.shardControllerFamily, "ShardMining, Assembly-CSharp");
assert.deepEqual(shardMilestoneHandoffBoundary.shardControllerRowShell.unlockHookRange, { start: 17, end: 29, count: 13 });
assert.deepEqual(shardMilestoneHandoffBoundary.shardControllerRowShell.buyHookRange, { start: 0, end: 0, count: 1 });
assert.deepEqual(shardMilestoneHandoffBoundary.shardControllerRowShell.textCheckerRange, { start: 0, end: 12, count: 13 });
assert.equal(shardMilestoneHandoffBoundary.genericMilestoneLead.family, "ConstructionMilestones, Assembly-CSharp");
assert.equal(shardMilestoneHandoffBoundary.genericMilestoneLead.metadataPath, "Assets\\Scripts\\Upgrades\\AcademyData\\ConstructionMilestones.cs");
assert.deepEqual(shardMilestoneHandoffBoundary.genericMilestoneLead.buyHookRange, { start: 1, end: 57, count: 57 });
assert.ok(shardMilestoneHandoffBoundary.genericMilestoneLead.textAndValueAnchors.includes("InitializeMilestones"));
assert.ok(shardMilestoneHandoffBoundary.genericMilestoneLead.textAndValueAnchors.includes("SetAllMilestoneTexts"));
assert.ok(shardMilestoneHandoffBoundary.handoffFindings.some((line) => /BuyMilestone1-57/.test(line)));
assert.ok(shardMilestoneHandoffBoundary.currentBoundary.some((line) => /not recovered player-owned shard milestone state/.test(line)));
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
assert.equal(shardMilestoneSaveOwnerCandidates.dataset, "shard-milestone-save-owner-candidates.v1");
assert.ok(shardMilestoneSaveOwnerCandidates.candidateTypes.length >= 1);
assert.ok(shardMilestoneSaveOwnerCandidates.candidateTypes.some((entry) => entry.id === "player-profile-side-shard-member-shell"));
assert.ok(shardMilestoneSaveOwnerCandidates.candidateTypes.some((entry) => entry.id === "shard-mining-wrapper-or-handoff-shell"));
assert.equal(shardMilestoneSaveOwnerCandidates.checkedOverlapStatistics.ownerShellWithSaveOverlapCount, 0);
assert.equal(shardMilestoneSaveOwnerCandidates.checkedOverlapStatistics.directShardPlayerProfileContext, false);
assert.ok(shardMilestoneSaveOwnerCandidates.warnings.some((line) => /not recovered player-owned shard milestone state/i.test(line)));
assert.ok(shardMilestoneSaveOwnerCandidates.currentBoundary.some((line) => /candidate-narrowing artifact only/i.test(line)));
assert.ok(shardMilestoneSaveOwnerCandidates.currentBoundary.some((line) => /not as recovered player-owned shard milestone state/i.test(line)));
assert.equal(shardSceneMonoBehaviourProbe.dataset, "shard-scene-monobehaviour-probe.v1");
assert.ok(shardSceneMonoBehaviourProbe.monoBehaviours.some((entry) => entry.scriptName === "ShardMining" && entry.pathId === 290724));
assert.ok(shardSceneMonoBehaviourProbe.monoBehaviours.some((entry) => entry.scriptName === "ShardPerLevelTextHandler" && entry.byteSize === 1328));
assert.ok(shardSceneMonoBehaviourProbe.currentBoundary.some((line) => /Do not claim recovered shard numeric fields/.test(line)));
assert.equal(shardCostParameterProbe.dataset, "shard-cost-parameter-probe.v1");
assert.equal(shardCostParameterProbe.metadataFamilies.startCostFields.length, 30);
assert.equal(shardCostParameterProbe.metadataFamilies.costExponentFields.length, 30);
assert.equal(shardCostParameterProbe.metadataFamilies.costAccessors.length, 30);
assert.deepEqual(shardCostParameterProbe.metadataFamilies.overLevelExponentFields, ["OverLevel100Exponent", "OverLevel200Exponent", "OverLevel300Exponent", "OverLevel400Exponent"]);
assert.deepEqual(shardCostParameterProbe.metadataFamilies.overLevelExponentAccessors, ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"]);
assert.equal(shardCostParameterProbe.unlockRequirementBlock?.offset, 1456);
assert.deepEqual(shardCostParameterProbe.unlockRequirementBlock?.values?.slice(0, 8), [0, 0, 5, 10, 20, 30, 40, 50]);
assert.deepEqual(shardCostParameterProbe.unlockRequirementBlock?.values?.slice(-3), [8000, 8050, 8100]);
assert.ok(shardCostParameterProbe.shardMiningCandidateTuples.length >= 7);
assert.equal(shardCostParameterProbe.rowAlignedTupleCandidates.length, 30);
assert.equal(shardCostParameterProbe.row0AlignedTupleCandidate?.row, 0);
assert.equal(shardCostParameterProbe.row0AlignedTupleCandidate?.pointerRefCount, 19);
assert.equal(shardCostParameterProbe.row0AlignedTupleCandidate?.unlockRequirementValue, 0);
assert.equal(shardCostParameterProbe.row0AlignedTupleCandidate?.candidateStartCostInt, 0);
assert.equal(shardCostParameterProbe.row0AlignedTupleCandidate?.bonusCount, 3);
assert.equal(shardCostParameterProbe.row0AlignedTupleCandidate?.numericBlockByteCount, 92);
assert.equal(shardCostParameterProbe.row0AlignedTupleCandidate?.trailingSlackByteCount, 20);
assert.deepEqual(shardCostParameterProbe.row0AlignedTupleCandidate?.bonusPerLevelValues?.map((value) => Number(value.toFixed(3))), [1.1, 1.02, 1.3]);
assert.equal(Number(shardCostParameterProbe.row0AlignedTupleCandidate?.leadingValue), 5);
assert.equal(Number(shardCostParameterProbe.row0AlignedTupleCandidate?.exponentA), 1.3);
assert.equal(Number(shardCostParameterProbe.row0AlignedTupleCandidate?.exponentB), 1.5);
assert.equal(Number(shardCostParameterProbe.row0AlignedTupleCandidate?.tailScalar), 1.1);
assert.deepEqual(shardCostParameterProbe.row0AlignedTupleCandidate?.strongestFieldOrderMapping?.values, { StartCost: 5, CostExponent: 1.3, GrowthExponent: 1.5, GrowthExponent2: 1.1, GrowthExponent3: 2 });
assert.equal(shardCostParameterProbe.row0AlignedTupleCandidate?.strongestFieldOrderMapping?.exactBigDoubleValues?.StartCost?.label, "5.0e0");
assert.ok(shardCostParameterProbe.signatureGroups.length >= 5);
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 19 && entry.unlockRequirementValue === 1400 && entry.intValue === 70 && Number(entry.exponentA) === 2.5 && Number(entry.exponentB) === 4));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 19 && entry.candidateStartCostInt === 70 && JSON.stringify(entry.bonusPerLevelValues.map((value) => Number(value.toFixed(2)))) === JSON.stringify([1.13, 1.15, 1.17])));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 19 && Number(entry.strongestFieldOrderMapping?.values?.StartCost) === 1 && Number(entry.strongestFieldOrderMapping?.values?.CostExponent) === 2.5 && Number(entry.strongestFieldOrderMapping?.values?.GrowthExponent) === 4));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 19 && entry.strongestFieldOrderMapping?.exactBigDoubleValues?.StartCost?.label === "1.0e70" && entry.strongestFieldOrderMapping?.exactBigDoubleValues?.CostExponent?.label === "2.5e0" && entry.strongestFieldOrderMapping?.exactBigDoubleValues?.GrowthExponent?.label === "4.0e-1"));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 27 && entry.unlockRequirementValue === 8000 && entry.intValue === 975 && Number(entry.exponentA) === 2.25 && Number(entry.exponentB) === 4));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 27 && entry.candidateStartCostInt === 975 && JSON.stringify(entry.bonusPerLevelValues.map((value) => Number(value.toFixed(2)))) === JSON.stringify([1.1, 1.19, 1.13])));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 27 && Number(entry.strongestFieldOrderMapping?.values?.StartCost) === 2 && Number(entry.strongestFieldOrderMapping?.values?.CostExponent) === 2.25 && Number(entry.strongestFieldOrderMapping?.values?.GrowthExponent) === 4));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 27 && entry.strongestFieldOrderMapping?.exactBigDoubleValues?.StartCost?.label === "2.0e975" && entry.strongestFieldOrderMapping?.exactBigDoubleValues?.CostExponent?.label === "2.25e0" && entry.strongestFieldOrderMapping?.exactBigDoubleValues?.GrowthExponent?.label === "4.0e-1"));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 29 && entry.intValue === 988 && Number(entry.exponentA) === 2.3 && Number(entry.exponentB) === 4));
assert.ok(shardCostParameterProbe.rowAlignedTupleCandidates.some((entry) => entry.row === 29 && entry.numericBlockByteCount === 60 && entry.trailingSlackByteCount === 48 && JSON.stringify(entry.bonusPerLevelValues.map((value) => Number(value.toFixed(3)))) === JSON.stringify([1.16, 1.018, 1.028])));
assert.deepEqual(shardCostParameterProbe.repeatedCommonRowGroup?.rows, [19, 20, 21]);
assert.equal(shardCostParameterProbe.repeatedCommonRowGroup?.tuples?.length, 3);
assert.ok(shardCostParameterProbe.shardMiningCandidateTuples.every((entry) => typeof entry.tailSentinelA === "number" && typeof entry.tailSentinelB === "number"));
assert.ok(shardCostParameterProbe.currentBoundary.some((line) => /exact serialized ShardMining row fields/.test(line)));
assert.ok(shardCostParameterProbe.currentBoundary.some((line) => /verified get_SU\*Cost formula/.test(line)));
assert.equal(shardCostMethodProbe.dataset, "shard-cost-method-probe.v1");
assert.equal(shardCostMethodProbe.costGetterFamily.count, 30);
assert.equal(shardCostMethodProbe.costGetterFamily.returnType, "BreakInfinity.BigDouble");
assert.ok(shardCostMethodProbe.costGetterFamily.rows.some((entry) => entry.row === 0 && entry.name === "get_SU0Cost" && entry.rva === 38240178));
assert.ok(shardCostMethodProbe.costGetterFamily.rows.some((entry) => entry.row === 19 && entry.estimatedTrackedBodySize === 3258));
assert.ok(shardCostMethodProbe.costGetterFamily.rows.some((entry) => entry.row === 27 && entry.estimatedTrackedBodySize === 2693));
assert.ok(shardCostMethodProbe.helperMethods.some((entry) => entry.name === "UpdateShardCostList" && entry.rva === 38238055));
assert.ok(shardCostMethodProbe.helperMethods.some((entry) => entry.name === "GetShardCostList" && entry.rva === 38349168));
assert.ok(shardCostMethodProbe.helperMethods.some((entry) => entry.name === "SortCostAndBools" && entry.rva === 38348434));
assert.ok(shardCostMethodProbe.helperMethods.some((entry) => entry.name === "CountAffordableShard" && entry.rva === 38351862));
assert.ok(shardCostMethodProbe.helperMethods.some((entry) => entry.name === "get_OverLevel100Exponent" && entry.rva === 38239421));
assert.ok(shardCostMethodProbe.estimatedTrackedBodySizeClusters.some((entry) => entry.estimatedTrackedBodySize === 3258 && JSON.stringify(entry.rows) === JSON.stringify([19, 20, 21])));
assert.ok(shardCostMethodProbe.estimatedTrackedBodySizeClusters.some((entry) => entry.estimatedTrackedBodySize === 2693 && JSON.stringify(entry.rows) === JSON.stringify([27, 28])));
assert.ok(shardCostMethodProbe.findings.some((line) => /real get_SU0-29Cost runtime family/.test(line)));
assert.ok(shardCostMethodProbe.currentBoundary.some((line) => /verified runtime getter family/.test(line)));
assert.equal(shardCostNativeProbe.dataset, "shard-cost-native-probe.v1");
assert.equal(shardCostNativeProbe.rows.length, 30);
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 0 && JSON.stringify(entry.earlyFieldReads.slice(3, 8).map((item) => item.offsetHex)) === JSON.stringify(["0x340", "0x348", "0x350", "0x358", "0x360"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 1 && JSON.stringify(entry.earlyFieldReads.slice(1, 5).map((item) => item.offsetHex)) === JSON.stringify(["0x3e8", "0x3f0", "0x3f8", "0x400"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 1 && JSON.stringify(entry.operandFieldNames) === JSON.stringify(["SU1StartCost", "SU1CostExponent"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 1 && JSON.stringify(entry.costFieldUsage) === JSON.stringify(["SU1StartCost", "SU1CostExponent", "SU1GrowthExponent"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 1 && JSON.stringify(entry.levelGateChecks) === JSON.stringify([200, 100, 300])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 1 && entry.hundredStageStructure?.divideBy100CompilerPattern === true));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 1 && entry.hundredStageStructure?.remainderLane?.powerHelperTarget === "0x24e20d9"));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 1 && JSON.stringify(entry.threeHundredStageCostLane?.stageFieldUsage) === JSON.stringify(["SU1CostExponent", "SU1GrowthExponent"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 19 && JSON.stringify(entry.earlyFieldReads.slice(1, 5).map((item) => item.offsetHex)) === JSON.stringify(["0xd58", "0xd60", "0xd68", "0xd70"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 19 && JSON.stringify(entry.operandFieldNames) === JSON.stringify(["SU19StartCost", "SU19CostExponent"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 19 && JSON.stringify(entry.costFieldUsage) === JSON.stringify(["SU19StartCost", "SU19CostExponent", "SU19GrowthExponent"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 19 && JSON.stringify(entry.levelGateChecks) === JSON.stringify([200, 100, 300])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 19 && entry.hundredStageStructure?.divideBy100CompilerPattern === true));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 19 && JSON.stringify(entry.threeHundredStageCostLane?.stageFieldUsage) === JSON.stringify(["SU19CostExponent", "SU19GrowthExponent"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 27 && JSON.stringify(entry.earlyFieldReads.slice(1, 5).map((item) => item.offsetHex)) === JSON.stringify(["0x1188", "0x1190", "0x1198", "0x11a0"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 27 && JSON.stringify(entry.operandFieldNames) === JSON.stringify(["SU27StartCost", "SU27CostExponent"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 27 && JSON.stringify(entry.costFieldUsage) === JSON.stringify(["SU27StartCost", "SU27CostExponent", "SU27GrowthExponent"])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 27 && JSON.stringify(entry.levelGateChecks) === JSON.stringify([200, 100, 300])));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 27 && entry.hundredStageStructure?.divideBy100CompilerPattern === true));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 27 && JSON.stringify(entry.threeHundredStageCostLane?.stageFieldUsage) === JSON.stringify(["SU27CostExponent", "SU27GrowthExponent"])));
assert.ok(shardCostNativeProbe.earlyCallClusters.some((entry) => JSON.stringify(entry.rows) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])));
assert.ok(shardCostNativeProbe.earlyCallClusters.some((entry) => JSON.stringify(entry.rows) === JSON.stringify([17])));
assert.ok(shardCostNativeProbe.overLevelGetterProfiles.some((entry) => entry.getterName === "get_OverLevel100Exponent" && entry.initialBuilderTarget === "0x24e1d36" && entry.initialIntegerSeed === 2));
assert.ok(shardCostNativeProbe.overLevelGetterProfiles.some((entry) => entry.getterName === "get_OverLevel400Exponent" && entry.fallsIntoExtendedShardLane === true));
assert.equal(shardCostNativeProbe.powerHelperFamily.shardPathEntryTarget, "0x24e20d9");
assert.deepEqual(shardCostNativeProbe.powerHelperFamily.shardPathChain, ["0x24e20d9", "0x24e1a2b", "0x24e1452", "0x24e0faa", "0x24e1ab0"]);
assert.deepEqual(shardCostNativeProbe.powerHelperFamily.nearbySiblingChain, ["0x24e21dc", "0x24e1bba", "0x24e1c3f", "0x24e1cb3"]);
assert.equal(shardCostNativeProbe.genericBigDoubleHelpers.storedCostFieldsUseBigDoubleSlots, true);
assert.equal(shardCostNativeProbe.genericBigDoubleHelpers.rowCostFieldSlotSizeBytes, 16);
assert.equal(shardCostNativeProbe.genericBigDoubleHelpers.multiplyHelperTarget, "0x24e1b33");
assert.equal(shardCostNativeProbe.genericBigDoubleHelpers.addHelperTarget, "0x24e176a");
assert.equal(shardCostNativeProbe.genericBigDoubleHelpers.toDoubleTarget, "0x24e0cda");
assert.equal(shardCostNativeProbe.scalarRemainderSubfamily.entryTarget, "0x24e3620");
assert.equal(shardCostNativeProbe.scalarRemainderSubfamily.integralPartHelperTarget, "0x393469a");
assert.equal(shardCostNativeProbe.scalarRemainderSubfamily.scalarToBigDoubleTarget, "0x24e349c");
assert.equal(shardCostNativeProbe.scalarRemainderSubfamily.scaledPowerBuilderTarget, "0x24e38f9");
assert.equal(shardCostNativeProbe.scalarRemainderSubfamily.unresolvedTransformTarget, "0x393474a");
assert.equal(shardCostNativeProbe.scalarRemainderSubfamily.resolvedTransformKind, "powWrapper");
assert.equal(shardCostNativeProbe.decimalPowerBridge.bigDoubleLog10Target, "0x24e30e4");
assert.equal(shardCostNativeProbe.decimalPowerBridge.scaledPowerBuilderTarget, "0x24e38f9");
assert.equal(shardCostNativeProbe.decimalPowerBridge.powWrapperTarget, "0x393474a");
assert.equal(shardCostNativeProbe.decimalPowerBridge.mathImports.modfImportName, "modf");
assert.equal(shardCostNativeProbe.decimalPowerBridge.mathImports.fmodImportName, "fmod");
assert.equal(shardCostNativeProbe.decimalPowerBridge.mathImports.log10ImportName, "log10");
assert.equal(shardCostNativeProbe.decimalPowerBridge.mathImports.powImportName, "pow");
assert.equal(shardCostNativeProbe.stageAssemblyBoundary.stageDispatcherEntryTarget, "0x24e3620");
assert.equal(shardCostNativeProbe.stageAssemblyBoundary.stageDispatcherBodyTarget, "0x24e368d");
assert.equal(shardCostNativeProbe.stageAssemblyBoundary.scalarCompareTarget, "0x24e2d86");
assert.equal(shardCostNativeProbe.stageAssemblyBoundary.specialCaseGateTarget, "0x24e387a");
assert.equal(shardCostNativeProbe.stageAssemblyBoundary.scalarToBigDoubleTarget, "0x24e349c");
assert.equal(shardCostNativeProbe.stageAssemblyBoundary.decimalPowerBuilderTarget, "0x24e38f9");
assert.equal(shardCostNativeProbe.sampledOffsetFeeders.length, 3);
assert.ok(shardCostNativeProbe.sampledOffsetFeeders.some((entry) => entry.row === 1 && entry.thresholdWindow === "100-plus-window" && entry.levelOffset === 70 && Math.abs(entry.coefficient - 9.765628774403013e-05) < 1e-16 && entry.model === "literalTimesBigDoubleOffsetThenAdd"));
assert.ok(shardCostNativeProbe.sampledOffsetFeeders.some((entry) => entry.row === 19 && entry.thresholdWindow === "100-plus-window" && entry.levelOffset === 70 && Math.abs(entry.coefficient - (-0.00011718430323526263)) < 1e-16 && entry.model === "scalarOffsetTimesCoefficientThenAdd"));
assert.ok(shardCostNativeProbe.sampledOffsetFeeders.some((entry) => entry.row === 27 && entry.thresholdWindow === "100-plus-window" && entry.levelOffset === 82 && Math.abs(entry.coefficient - 8192.001984596252) < 1e-9 && entry.model === "literalTimesBigDoubleOffsetThenAdd"));
assert.deepEqual(shardCostNativeProbe.windowOffsetFamilies.hundredWindowFamilies, [
  { thresholdWindow: "100-plus-window", model: "literalTimesBigDoubleOffsetThenAdd", levelOffset: 70, usesLiteralBuilder: false, usesPreMergeMultiply: true, rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
  { thresholdWindow: "100-plus-window", model: "scalarOffsetTimesCoefficientThenAdd", levelOffset: 70, usesLiteralBuilder: true, usesPreMergeMultiply: false, rows: [19, 20, 21, 22, 23] },
  { thresholdWindow: "100-plus-window", model: "scalarOffsetTimesCoefficientThenAdd", levelOffset: 67, usesLiteralBuilder: true, usesPreMergeMultiply: false, rows: [24, 25, 26] },
  { thresholdWindow: "100-plus-window", model: "literalTimesBigDoubleOffsetThenAdd", levelOffset: 82, usesLiteralBuilder: false, usesPreMergeMultiply: true, rows: [27, 28, 29] },
]);
assert.deepEqual(shardCostNativeProbe.windowOffsetFamilies.twoHundredWindowFamilies, [
  { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 27, 28, 29] },
  { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [180], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 26, 27, 28, 29] },
]);
assert.deepEqual(shardCostNativeProbe.windowOffsetFamilies.threeHundredWindowFamilies, [
  { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29] },
  { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [49], rows: [24] },
  { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [19], rows: [25] },
]);
assert.deepEqual(shardCostNativeProbe.stageWindowProfiles, [
  {
    rows: [0],
    familySignature: [
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [] },
    ],
  },
  {
    rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 27, 28, 29],
    familySignature: [
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
      { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [180] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
    ],
  },
  {
    rows: [18],
    familySignature: [
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
      { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [99] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
    ],
  },
  {
    rows: [19, 20, 21, 22, 23],
    familySignature: [
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
      { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [180] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: true, integerSeeds: [] },
      { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
    ],
  },
  {
    rows: [24],
    familySignature: [
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
      { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [49] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: true, integerSeeds: [] },
      { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: true, integerSeeds: [] },
    ],
  },
  {
    rows: [25],
    familySignature: [
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
      { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [19] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: true, integerSeeds: [] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: true, integerSeeds: [] },
    ],
  },
  {
    rows: [26],
    familySignature: [
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
      { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [180] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: true, integerSeeds: [] },
      { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: true, integerSeeds: [] },
    ],
  },
]);
assert.deepEqual(shardCostNativeProbe.stageProfileCorrelations, [
  { rows: [0], unlockRequirementRange: [0, 0], distinctRarities: ["Unique"], distinctStartCosts: [5], distinctCostExponents: [1.3], distinctGrowthExponents: [1.5] },
  { rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 27, 28, 29], unlockRequirementRange: [0, 8100], distinctRarities: ["Epic", "Rare", "common"], distinctStartCosts: [1.4, 2, 2.4, 3.1, 3.6, 4, 5.6, 6, 8, 9, 9.99], distinctCostExponents: [1.15, 1.22, 1.24, 1.26, 1.4, 1.48, 1.5, 1.6, 1.78, 2, 2.25, 2.29, 2.3, 3, 4], distinctGrowthExponents: [1.2, 1.3, 1.6, 1.8, 2, 2.2, 2.5, 2.6, 2.8, 3.2, 3.4, 3.8, 4, 5, 8] },
  { rows: [18], unlockRequirementRange: [1100, 1100], distinctRarities: ["Legendary"], distinctStartCosts: [1.5], distinctCostExponents: [1], distinctGrowthExponents: [5] },
  { rows: [19, 20, 21, 22, 23], unlockRequirementRange: [1400, 1800], distinctRarities: ["Epic", "Rare", "common"], distinctStartCosts: [1], distinctCostExponents: [1, 2.5, 5], distinctGrowthExponents: [1, 3, 4] },
  { rows: [24], unlockRequirementRange: [3300, 3300], distinctRarities: ["Rare"], distinctStartCosts: [4], distinctCostExponents: [5], distinctGrowthExponents: [5] },
  { rows: [25], unlockRequirementRange: [3600, 3600], distinctRarities: ["Low Pristine"], distinctStartCosts: [3], distinctCostExponents: [2], distinctGrowthExponents: [2] },
  { rows: [26], unlockRequirementRange: [3900, 3900], distinctRarities: ["Mid Pristine"], distinctStartCosts: [5], distinctCostExponents: [2], distinctGrowthExponents: [6] },
]);
assert.deepEqual(shardCostNativeProbe.transitionRowAnalysis.transitionRows.map((entry) => ({ row: entry.row, betweenRows: entry.betweenRows })), [
  { row: 18, betweenRows: [17, 19] },
  { row: 24, betweenRows: [23, 27] },
  { row: 25, betweenRows: [24, 26] },
  { row: 26, betweenRows: [25, 27] },
]);
assert.ok(shardCostNativeProbe.transitionRowAnalysis.transitionRows.some((entry) => entry.row === 18 && entry.neighborContrast.some((line) => /second 100-plus unary feeder/.test(line))));
assert.ok(shardCostNativeProbe.transitionRowAnalysis.transitionRows.some((entry) => entry.row === 24 && entry.neighborContrast.some((line) => /seed 49/.test(line))));
assert.ok(shardCostNativeProbe.transitionRowAnalysis.transitionRows.some((entry) => entry.row === 25 && entry.neighborContrast.some((line) => /seed 19/.test(line))));
assert.ok(shardCostNativeProbe.transitionRowAnalysis.transitionRows.some((entry) => entry.row === 26 && entry.neighborContrast.some((line) => /seed 180/.test(line))));
assert.deepEqual(shardCostNativeProbe.transitionRowAnalysis.row0SpecialCase.costFieldUsage, ["SU0StartCost", "SU0CostExponent", "SU0GrowthExponent", "SU0GrowthExponent2", "SU0GrowthExponent3"]);
assert.deepEqual(shardCostNativeProbe.transitionRowAnalysis.row0SpecialCase.levelGateChecks, [100]);
assert.equal(shardCostNativeProbe.transitionRowAnalysis.row0SpecialCase.thresholdStages.length, 0);
assert.ok(shardCostNativeProbe.transitionRowAnalysis.row0SpecialCase.facts.some((line) => /five serialized cost fields/.test(line)));
assert.deepEqual(shardCostNativeProbe.thresholdStageClasses, [
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21] },
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"], rows: [17, 22, 23] },
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent"], rows: [18, 24, 27, 28, 29] },
  { getterNames: ["get_OverLevel100Exponent"], rows: [25, 26] },
]);
assert.deepEqual(shardCostNativeProbe.representativeClassAnalysis.map((entry) => ({
  getterNames: entry.getterNames,
  rows: entry.rows,
  representativeRows: entry.representatives.map((rep) => rep.row),
})), [
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21], representativeRows: [1, 21] },
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"], rows: [17, 22, 23], representativeRows: [17, 23] },
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent"], rows: [18, 24, 27, 28, 29], representativeRows: [18, 29] },
  { getterNames: ["get_OverLevel100Exponent"], rows: [25, 26], representativeRows: [25, 26] },
]);
assert.ok(shardCostNativeProbe.representativeClassAnalysis.some((entry) => JSON.stringify(entry.getterNames) === JSON.stringify(["get_OverLevel100Exponent", "get_OverLevel200Exponent"]) && entry.representatives.some((rep) => rep.row === 29 && rep.hundredStageStructure.divideBy100CompilerPattern === true)));
assert.deepEqual(shardCostNativeProbe.normalRowStageRecipe.classRecipes.map((entry) => ({ getterNames: entry.getterNames, rows: entry.rows })), [
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21] },
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"], rows: [17, 22, 23] },
  { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent"], rows: [18, 24, 27, 28, 29] },
  { getterNames: ["get_OverLevel100Exponent"], rows: [25, 26] },
]);
assert.ok(shardCostNativeProbe.normalRowStageRecipe.sharedScaffolding.facts.some((line) => /same hundred-stage structure/.test(line)));
assert.deepEqual(shardCostNativeProbe.canonicalSymbolicAssembler.canonicalClass.getterNames, ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"]);
assert.deepEqual(shardCostNativeProbe.canonicalSymbolicAssembler.canonicalClass.rows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21]);
assert.deepEqual(shardCostNativeProbe.canonicalSymbolicAssembler.canonicalClass.symbolicStages.map((entry) => entry.name), ["base-row-fields", "hundred-stage", "two-hundred-stage", "three-hundred-stage", "four-hundred-stage"]);
assert.deepEqual(shardCostNativeProbe.canonicalSymbolicAssembler.canonicalClass.subprofiles.map((entry) => entry.rows), [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], [19, 20, 21]]);
assert.ok(shardCostNativeProbe.canonicalSymbolicAssembler.classDeltas.some((entry) => JSON.stringify(entry.getterNames) === JSON.stringify(["get_OverLevel100Exponent"]) && entry.delta.some((line) => /0x24e1ab0/.test(line))));
assert.deepEqual(shardCostNativeProbe.canonicalMergeConstraints.secondaryHundredPlusSplit.map((entry) => ({ rows: entry.rows, path: entry.path })), [
  { rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], path: "additivePremerge" },
  { rows: [19, 20, 21], path: "literalBuilderAdditive" },
]);
assert.ok(shardCostNativeProbe.canonicalMergeConstraints.sharedConstraints.some((line) => /first 200-plus feeder is stable/.test(line)));
assert.equal(shardCostNativeProbe.formulaApplicationProfiles.rowZero.formulaClass, "row0-special-case");
assert.deepEqual(shardCostNativeProbe.formulaApplicationProfiles.normalRows.map((entry) => ({ rows: entry.rows, formulaClass: entry.formulaClass })), [
  { rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], formulaClass: "canonical-additive-premerge" },
  { rows: [19, 20, 21], formulaClass: "canonical-literal-builder" },
  { rows: [17, 22, 23], formulaClass: "drop-400-stage" },
  { rows: [18, 24, 27, 28, 29], formulaClass: "two-stage-transition-band" },
  { rows: [25, 26], formulaClass: "hundred-stage-short-class" },
]);
assert.deepEqual(shardCostNativeProbe.preThresholdMergeModels.normalProfile.rows, [9, 25]);
assert.match(shardCostNativeProbe.preThresholdMergeModels.normalProfile.symbolicApproximation, /multiply\(StartCost, dispatch\(currentLevel, add\(CostExponent, multiply\(currentLevelBigDouble, GrowthExponent\)\)\)\)/);
assert.ok(shardCostNativeProbe.preThresholdMergeModels.sharedNormalPath.some((line) => /owner-flag-zero pre-threshold structure/.test(line)));
assert.ok(shardCostNativeProbe.preThresholdMergeModels.alternateFlaggedBranchSamples.some((entry) => entry.row === 25 && /integer seed 4/.test(entry.seedBuilder)));
assert.equal(shardCostNativeProbe.dispatcherCompareModel.compareTarget, "0x24e2d86");
assert.ok(shardCostNativeProbe.dispatcherCompareModel.facts.some((line) => /converted BigDouble lane is greater than the original scalar lane/.test(line)));
assert.equal(shardCostNativeProbe.dispatcherAlignmentModel.alignmentCheckTarget, "0x24e3597");
assert.equal(Number(shardCostNativeProbe.dispatcherAlignmentModel.toleranceLiteral), 5.238690707360522e-11);
assert.ok(shardCostNativeProbe.dispatcherAlignmentModel.currentInference.some((line) => /tiny fmod-style alignment gate/.test(line)));
assert.ok(shardCostNativeProbe.dispatcherSelectionModel.facts.some((line) => /selector register equals 1/.test(line)));
assert.ok(shardCostNativeProbe.dispatcherSelectionModel.sampledNormalRows.some((entry) => JSON.stringify(entry.rows) === JSON.stringify([1, 9, 27, 29]) && JSON.stringify(entry.sampledSelectorValues) === JSON.stringify([0])));
assert.ok(shardCostNativeProbe.dispatcherSelectionModel.sampledNormalRows.some((entry) => JSON.stringify(entry.rows) === JSON.stringify([25]) && JSON.stringify(entry.sampledSelectorValues) === JSON.stringify([4])));
assert.ok(shardCostNativeProbe.findings.some((line) => /exact serialized OverLevel\*Base payload values remain unresolved/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /OverLevel100\/200\/300\/400Base metadata names as unresolved typed field clues/.test(line)));
assert.ok(shardCostNativeProbe.overLevelSeedModels.sampledGetters.some((entry) => entry.getterName === "get_OverLevel100Exponent" && entry.baseSeed === 2));
assert.ok(shardCostNativeProbe.overLevelSeedModels.sampledGetters.some((entry) => entry.getterName === "get_OverLevel200Exponent" && Number(entry.baseSeed) === 0));
assert.ok(shardCostNativeProbe.overLevelSeedModels.sampledGetters.some((entry) => entry.getterName === "get_OverLevel300Exponent" && Number(entry.baseSeed) === 0));
assert.ok(shardCostNativeProbe.overLevelSeedModels.sampledGetters.some((entry) => entry.getterName === "get_OverLevel100Exponent" && Number(entry.optionalMmoMergeFloatValue) === 1.264570970563716e-39));
assert.ok(shardCostNativeProbe.overLevelSeedModels.sampledGetters.some((entry) => entry.getterName === "get_OverLevel200Exponent" && Number(entry.optionalMmoMergeFloatValue) === 6.345649113524877e-36));
assert.ok(shardCostNativeProbe.overLevelSeedModels.sampledGetters.some((entry) => entry.getterName === "get_OverLevel400Exponent" && Number(entry.baseSeed) === 0.007812501846152979));
assert.ok(shardCostNativeProbe.overLevelSeedModels.currentInference.some((line) => /100 starts from integer seed 2/.test(line)));
assert.deepEqual(shardCostNativeProbe.secondaryHundredPlusMergeModels.profiles.map((entry) => ({ rows: entry.rows, profile: entry.profile })), [
  { rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 27, 28, 29], profile: "additive-premerge" },
  { rows: [19, 20, 21], profile: "literal-builder-additive" },
]);
assert.ok(shardCostNativeProbe.secondaryHundredPlusMergeModels.sharedFrame.some((line) => /post-200, pre-300 branch/.test(line)));
assert.ok(shardCostNativeProbe.secondaryHundredPlusMergeModels.profiles.some((entry) => entry.profile === "additive-premerge" && /multiply\(levelOffsetBigDouble, preservedScalarLane\)/.test(entry.symbolicApproximation)));
assert.ok(shardCostNativeProbe.secondaryHundredPlusMergeModels.profiles.some((entry) => entry.profile === "additive-premerge" && /OverLevel200Base/.test(entry.laneSources.baseLane)));
assert.ok(shardCostNativeProbe.secondaryHundredPlusMergeModels.profiles.some((entry) => entry.profile === "additive-premerge" && /get_OverLevel200Exponent/.test(entry.laneSources.stageLane)));
assert.ok(shardCostNativeProbe.secondaryHundredPlusMergeModels.profiles.some((entry) => entry.profile === "literal-builder-additive" && entry.preDispatchAssembly.some((line) => /0x24e1a07/.test(line))));
assert.ok(shardCostNativeProbe.secondaryHundredPlusMergeModels.profiles.some((entry) => entry.profile === "literal-builder-additive" && /literalBigDouble\(\(level - offset\) \* coefficient\)/.test(entry.symbolicApproximation)));
assert.ok(shardCostNativeProbe.secondaryHundredPlusMergeModels.profiles.some((entry) => entry.profile === "literal-builder-additive" && /get_OverLevel200Exponent/.test(entry.laneSources.stageLane)));
const shardRow1Native = shardCostNativeProbe.rows.find((entry) => entry.row === 1);
const shardRow19Native = shardCostNativeProbe.rows.find((entry) => entry.row === 19);
const shardRow27Native = shardCostNativeProbe.rows.find((entry) => entry.row === 27);
withRequiredValue(shardRow1Native, "expected native shard row 1 entry", (row) => {
  assert.ok(row.stageDispatchCallFamilies.some((family) => family.usesPreMergeAdd === true && family.usesCurrentLevelBigDouble === true && family.postDispatchMergeTarget === "0x24e1cb3"));
  assert.ok(row.stageDispatchCallFamilies.some((family) => family.usesUnaryThresholdTransform === true && JSON.stringify(family.integerSeeds) === JSON.stringify([100]) && family.thresholdWindow === "100-plus-window" && family.postDispatchMergeTarget === "0x24e1cb3"));
  assert.ok(row.stageDispatchCallFamilies.some((family) => family.usesUnaryThresholdTransform === true && JSON.stringify(family.integerSeeds) === JSON.stringify([180]) && family.thresholdWindow === "200-plus-window" && family.postDispatchMergeTarget === "0x24e1cb3"));
  assert.ok(row.stageDispatchCallFamilies.some((family) => family.thresholdWindow === "300-plus-window" && family.usesPreMergeAdd === true && family.usesUnaryThresholdTransform === false));
});
withRequiredValue(shardRow19Native, "expected native shard row 19 entry", (row) => {
  assert.ok(row.stageDispatchCallFamilies.some((family) => family.usesLiteralBuilder === true && family.usesPreMergeAdd === true && family.thresholdWindow === "100-plus-window" && family.postDispatchMergeTarget === "0x24e1cb3"));
});
withRequiredValue(shardRow27Native, "expected native shard row 27 entry", (row) => {
  assert.ok(row.stageDispatchCallFamilies.some((family) => family.usesPreMergeMultiply === true && family.usesPreMergeAdd === true && family.thresholdWindow === "100-plus-window" && family.postDispatchMergeTarget === "0x24e1cb3"));
});
assert.ok(shardCostNativeProbe.helperTargetSummaries.some((entry) => entry.target === "0x24e1a07" && /double literal/.test(entry.summary)));
assert.ok(shardCostNativeProbe.helperTargetSummaries.some((entry) => entry.target === "0x24e1d36" && /integer input/.test(entry.summary)));
assert.ok(shardCostNativeProbe.findings.some((line) => /row-local ShardMining cost operands/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /stored as checked 16-byte BreakInfinity\.BigDouble slots/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /named ShardMining cost fields/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /touch GrowthExponent later/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /compare gates inside get_SU\*Cost/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /divide-by-100 integer lane/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /CostExponent and GrowthExponent neighborhood/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /checked unary helper chain/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /nearby sibling helper lane/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /0x24e3620 converts a BigDouble pair into a double before dispatching into the remaining scalar remainder subfamily/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /0x393469a now resolves to a modf wrapper/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /0x24e38f9 now preserves a checked decimal power-builder/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /0x24e349c now preserves a checked scalar-to-BigDouble fallback/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /0x393474a is no longer just a pow-like candidate/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /checked BigDouble-to-log10 bridge/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /checked stage dispatcher/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /first 100-plus unary threshold feeder/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /later 200-plus unary threshold feeder/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /300-plus window also preserves a plain additive dispatcher feeder/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /literal-seeded dispatcher feeder inside a 100-plus window/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /Sampled late-window feeder parameters are now preserved directly from the binary/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /clusters sampled rows into reusable late-window families/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /later stage windows now also preserve reusable row-family maps/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /cross-window profile map/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /do not collapse cleanly onto one rarity band/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /transition rows now preserve concrete neighbor contrasts/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /Row 0 is no longer just a weaker version/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /split cleanly by preserved over-level getter coverage/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /Representative rows from each normal-row coverage class/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /shared stage scaffold with class-specific stage coverage/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /canonical symbolic stage assembler/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /secondary 100-plus feeder/.test(line)));
assert.ok(shardCostNativeProbe.findings.some((line) => /narrowest remaining merge breakpoint/.test(line)));
assert.ok(shardCostNativeProbe.rows.some((entry) => entry.row === 1 && JSON.stringify(entry.thresholdStages.map((stage) => stage.getterName)) === JSON.stringify(["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"])));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /row-local ShardMining operands/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /serialized BreakInfinity\.BigDouble pairs/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /level 100, 200, and 300 compare gates/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /divide-by-100 loop/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /shard-path unary transform entry/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /0x24e30e4 as the checked BigDouble-to-log10 bridge/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /0x24e3620 and 0x24e368d as the checked stage dispatcher/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /pre-threshold, 100-plus, 200-plus, and 300-plus windows/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /sampled `\(level - offset\)` feeder parameters/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /100-plus feeder row clusters/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /new 200-plus and 300-plus family maps/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /new cross-window stage profiles/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /row-family switch inside get_SU\*Cost/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /Treat row 0 as a separate shard cost lane/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /preserved over-level getter coverage classes/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /one representative row per coverage class/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /class recipe boundary/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /canonical symbolic assembler/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /secondary 100-plus feeder split inside the canonical class/.test(line)));
assert.ok(shardCostNativeProbe.currentBoundary.some((line) => /sampled 300-plus feeder and both sampled 200-plus feeders as shared canonical-class structure/.test(line)));
assert.equal(shardCostScreenshotCalibration.dataset, "shard-cost-screenshot-calibration.v1");
assert.equal(shardCostScreenshotCalibration.entries.length, 5);
assert.ok(shardCostScreenshotCalibration.entries.some((entry) => entry.row === 1 && entry.observedLevel === 283 && entry.observedCostLabel === "1.89e565"));
assert.ok(shardCostScreenshotCalibration.entries.some((entry) => entry.row === 25 && entry.observedLevel === 16 && entry.observedCostLabel === "5.38e563"));
assert.ok(shardCostScreenshotCalibration.findings.some((line) => /e563-e565/.test(line)));
assert.ok(shardCostScreenshotCalibration.currentBoundary.some((line) => /player/i.test(line)));
assert.equal(shardCostListPathProbe.dataset, "shard-cost-list-path-probe.v1");
assert.equal(shardCostListPathProbe.ownerFields.milestoneCostListField.name, "MilestoneCostList");
assert.equal(shardCostListPathProbe.callOrder[0], "GetShardCostList");
assert.equal(shardCostListPathProbe.callOrder.at(-1), "get_SU29Cost");
assert.ok(shardCostListPathProbe.findings.some((line) => /same getter outputs/.test(line)));
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
assert.deepEqual(shardCostFormulaModel.rowClasses.map((entry) => entry.id), [
  "row0-special-case",
  "canonical-additive-premerge",
  "canonical-literal-builder",
  "drop-400-stage",
  "two-stage-transition-band",
  "hundred-stage-short-class"
]);
assert.equal(shardCostFormulaModel.stageRules.preThreshold.symbolicApproximation, "multiply(StartCost, dispatch(currentLevel, add(CostExponent, multiply(currentLevelBigDouble, GrowthExponent))))");
assert.ok(shardCostFormulaModel.stageRules.hundredPlus.sampledOffsetFeeders.some((entry) => entry.row === 19 && entry.levelOffset === 70 && Math.abs(entry.coefficient - (-0.00011718430323526263)) < 1e-16));
assert.equal(shardCostFormulaModel.verifiedParameters.unlockRequirementBlock.offset, 1456);
assert.equal(shardCostFormulaModel.verifiedParameters.row0FieldShell.exactBigDoubleValues.StartCost, "5.0e0");
assert.ok(shardCostFormulaModel.verifiedParameters.representativeNormalRows.some((entry) => entry.row === 27 && entry.exactBigDoubleValues.StartCost === "2.0e975"));
assert.equal(shardCostFormulaModel.derivedParameters.dispatcherSelectionBoundary.decimalPowerBuilderTarget, "0x24e38f9");
assert.equal(shardCostFormulaModel.calibrationAnchors.length, 5);
assert.equal(shardCostFormulaModel.boundedUncertaintyFlags.row0ExactClosedFormUnresolved, true);
assert.equal(shardCostFormulaModel.boundedUncertaintyFlags.screenshotAnchorsMatchedByAcceptedEvaluator, false);
assert.equal(shardCostFormulaModel.runtimeGetterRules.getterFamily.ownerType, "ShardMining");
assert.equal(shardCostFormulaModel.runtimeGetterRules.getterFamily.stableCallOrder[0], "GetShardCostList");
assert.equal(shardCostFormulaModel.runtimeGetterRules.getterFamily.stableCallOrder.at(-1), "get_SU29Cost");
assert.equal(shardCostFormulaModel.runtimeGetterRules.cacheLifecycle.cacheField, "MilestoneCostList");
assert.equal(shardCostFormulaModel.runtimeGetterRules.cacheLifecycle.orderedGetterOutputsCached, true);
assert.deepEqual(shardCostFormulaModel.runtimeGetterRules.sharedStageLogic.windowOrder, ["pre-threshold", "100-plus-window", "200-plus-window", "300-plus-window", "400-plus-window"]);
assert.deepEqual(shardCostFormulaModel.verifiedParameters.overLevelBaseFieldShells.map((entry) => entry.fieldName), ["OverLevel100Base", "OverLevel200Base", "OverLevel300Base", "OverLevel400Base"]);
assert.equal(shardCostFormulaModel.derivedParameters.overLevelBaseRecoveryPath.status, "deterministic-native-seed-derivation");
assert.equal(shardCostFormulaModel.derivedParameters.overLevelBaseRecoveryPath.exactSerializedValuesRecovered, false);
assert.ok(shardCostFormulaModel.derivedParameters.overLevelBaseRecoveryPath.derivedRuntimeSeedModels.some((entry) => entry.fieldName === "OverLevel100Base" && entry.derivedSeedBigDoubleLabel === "2.0e0"));
assert.ok(shardCostFormulaModel.derivedParameters.overLevelBaseRecoveryPath.derivedRuntimeSeedModels.some((entry) => entry.fieldName === "OverLevel400Base" && entry.derivedSeedBigDoubleLabel === "7.812502e-3"));
assert.ok(shardCostFormulaModel.currentBoundary.some((line) => /Do not expose exact next-level shard costs/.test(line)));
assert.equal(getShardCostFormulaModel().dataset, "shard-cost-formula-model.v1");
assert.equal(getShardCostRowClass(19)?.id, "canonical-literal-builder");
assert.equal(getShardCostRowClass(25)?.id, "hundred-stage-short-class");
assert.deepEqual(getShardCostRuntimeRule(19).thresholdGetterNames, ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"]);
assert.equal(getShardCostRuntimeRule(19).getterName, "get_SU19Cost");
assert.equal(getShardCostRuntimeRule(19).getterCallIndex, 20);
assert.equal(getShardCostRuntimeRule(19).cacheField, "MilestoneCostList");
assert.equal(getShardCostRuntimeRule(19).overLevelBaseModels.length, 4);
assert.equal(getShardCostScreenshotCalibration().dataset, "shard-cost-screenshot-calibration.v1");
assert.equal(formatScientificLabel({ mantissa: 1.2, exponent: 565 }), "1.20e565");
const shardCostCalibrationChecks = runShardCostCalibrationChecks();
assert.equal(shardCostCalibrationChecks.results.length, 5);
assert.equal(shardCostCalibrationChecks.config.scientificLabelMantissaDecimals, 2);
assert.ok(shardCostCalibrationChecks.results.every((entry) => typeof entry.actualLabel === "string" && /e/.test(entry.actualLabel)));
assert.equal(
  isShardCostPlannerSafeFromCalibration(shardCostCalibrationChecks),
  (
    shardCostFormulaModel.completionFlags.automatedCalibrationImplemented === true
    && shardCostCalibrationChecks.allPassed === true
    && shardCostFormulaModel.completionFlags.plannerSafeCostOutputApproved === true
  )
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
assert.deepEqual(shardCostRow19.runtimeRule.windowOrder, ["pre-threshold", "100-plus-window", "200-plus-window", "300-plus-window", "400-plus-window"]);
assert.ok(shardCostRow19.runtimeRule.overLevelBaseModels.some((entry) => entry.fieldName === "OverLevel100Base" && entry.derivedSeedBigDoubleLabel === "2.0e0"));
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
assert.deepEqual(shardCostRow25High.runtimeRule.overLevelBaseModels.map((entry) => entry.fieldName), ["OverLevel100Base"]);
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
  assert.deepEqual(result.adjustments.map((entry) => entry.kind), expected.adjustmentKinds);
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
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family", "three-hundred-plus-family"]
});
assertShardCostWindow(1, 426, {
  rowClassId: "canonical-additive-premerge",
  modeledLevel: 426,
  levelWasClamped: false,
  activeStages: [100, 200, 300, 400],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family", "three-hundred-plus-family", "four-hundred-stage-covered"]
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
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family", "three-hundred-plus-family"]
});
assertShardCostWindow(19, 426, {
  rowClassId: "canonical-literal-builder",
  modeledLevel: 426,
  levelWasClamped: false,
  activeStages: [100, 200, 300, 400],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family", "three-hundred-plus-family", "four-hundred-stage-covered"]
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
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family", "three-hundred-plus-family"]
});
assertShardCostWindow(17, 426, {
  rowClassId: "drop-400-stage",
  modeledLevel: 399,
  levelWasClamped: true,
  activeStages: [100, 200, 300],
  adjustmentKinds: ["base-pre-threshold", "hundred-plus-family", "two-hundred-plus-family", "three-hundred-plus-family"]
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
assert.equal(shardBonusSlotProbe.dataset, "shard-bonus-slot-probe.v1");
assert.equal(shardBonusSlotProbe.rows.length, 30);
assert.ok(shardBonusSlotProbe.rows.some((entry) => entry.row === 0 && entry.bonusFieldCount === 8 && entry.groundedBonusCount === 3));
assert.ok(shardBonusSlotProbe.rows.some((entry) => entry.row === 18 && entry.bonusFieldCount === 6 && entry.calcAccessorCount === 6));
assert.ok(shardBonusSlotProbe.rows.some((entry) => entry.row === 27 && entry.bonusFieldCount === 3 && entry.calcAccessorCount === 3));
assert.ok(shardBonusSlotProbe.currentBoundary.some((line) => /slot counts alone/.test(line)));
assert.equal(shardTypeMetadataProbe.dataset, "shard-type-metadata-probe.v1");
assert.equal(shardTypeMetadataProbe.targets.shardMining.fullName, "ShardMining");
assert.ok(shardTypeMetadataProbe.targets.shardMining.ownerListFields.some((entry) => entry.name === "MilestoneCostList"));
assert.ok(shardTypeMetadataProbe.targets.shardMining.ownerListFields.some((entry) => entry.name === "upgradeInfoList" && entry.type === "System.Collections.Generic.List`1<ShardMining+ShardUpgradeInfo>"));
assert.deepEqual(shardTypeMetadataProbe.targets.shardMining.overLevelBaseFields.map((entry) => entry.name), ["OverLevel100Base", "OverLevel200Base", "OverLevel300Base", "OverLevel400Base"]);
assert.deepEqual(shardTypeMetadataProbe.targets.shardUpgradeInfo.fields.map((entry) => entry.name), ["<Cost>k__BackingField", "<MaxLevel>k__BackingField", "<IsUnlocked>k__BackingField"]);
assert.equal(shardTypeMetadataProbe.rows.length, 30);
assert.ok(shardTypeMetadataProbe.rows.some((entry) => entry.row === 0 && entry.costFieldCount === 5 && entry.bonusFieldCount === 8));
assert.ok(shardTypeMetadataProbe.rows.some((entry) => entry.row === 18 && entry.bonusFieldCount === 6 && entry.bonusTextFieldCount === 6));
assert.ok(shardTypeMetadataProbe.rows.some((entry) => entry.row === 27 && entry.costFieldCount === 3 && entry.bonusTextFieldCount === 3));
assert.equal(shardTypeMetadataProbe.overLevelBaseValueRecovery.exactSerializedValuesRecovered, false);
assert.equal(shardTypeMetadataProbe.overLevelBaseValueRecovery.directMonoBehaviourFieldHitsCount, 0);
assert.ok(shardTypeMetadataProbe.currentBoundary.some((line) => /not as final serialized row values/.test(line)));
assert.equal(extractionCandidateFamilies.dataset, "extraction-candidate-families.v1");
assert.ok(extractionCandidateFamilies.families.length >= 7, "expected seeded extraction candidate families");
assert.ok(extractionCandidateFamilies.families.some((family) => family.id === "shards.milestone-owner-family"));
assert.ok(extractionCandidateFamilies.families.some((family) => family.id === "spend.multiverse-market-save-model"));
assert.equal(extractionCandidateRanking.dataset, "extraction-candidate-ranking.v1");
assert.equal(extractionCandidateRanking.sourceConfig, "data/extraction-candidate-families.v1.json");
assert.equal(extractionCandidateRanking.topCandidate.id, "shards.milestone-owner-family");
assert.equal(extractionCandidateRanking.topCandidate.track, "shard-milestone-payload-recovery");
assert.ok(Array.isArray(extractionCandidateRanking.familyFilter));
assert.equal(extractionCandidateRanking.familyFilter.length, 0);
const topShardCandidate = extractionCandidateRanking.candidates.find((candidate) => candidate.track === "shard-milestone-payload-recovery");
withRequiredValue(topShardCandidate, "expected a PR2-local shard candidate", (candidate) => {
  assert.equal(candidate.id, "shards.milestone-owner-family");
  assert.ok(candidate.heuristicScore >= 500);
  assert.ok(candidate.binaryFileCoverage.includes("workbench/unity/joined/level0"));
  assert.ok(candidate.binaryFileCoverage.includes("workbench/apk/base/global-metadata.dat"));
});
assert.equal(groundedShardMilestones.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.equal(groundedShardObserved.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
assert.equal(groundedShardProvenance.sourceReport, "docs/research/shard-milestones-grounded-2026-03-28.md");
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
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.declaringType, "SaveData");
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.storedAmountField, "BankedTokens");
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.storedAmountFieldType, "System.Single");
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.storedAmountFieldIndex, 214);
assert.equal(tokenBankStateCluesData.exactSaveOwnerRecovery.storedAmountFieldOffset, 1800);
assert.ok(tokenBankStateCluesData.negativeTypedOwnerChecks.includes("SaveData.ClaimableBankTokens"));
assert.ok(tokenBankStateCluesData.negativeTypedOwnerChecks.includes("SaveData.TokenBankCap"));
assert.ok(tokenBankStateCluesData.negativeTypedOwnerChecks.includes("PlayerProfileData.BankedTokens"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("SpaceAcademy"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("SpaceAcademyMain"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("TextHandlerSpaceAcademy"));
assert.ok(dailyTokeniumLaneCluesData.ownerFamilyClues.includes("FarmMissions"));
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.declaringType, "SaveData");
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.storedAmountField, "DailyTokenium");
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.storedAmountFieldType, "System.Double");
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.storedAmountFieldIndex, 2361);
assert.equal(dailyTokeniumLaneCluesData.exactSaveOwnerRecovery.storedAmountFieldOffset, 13032);
assert.equal(dailyTokeniumLaneCluesData.genericTokeniumClaimableBoundary.declaringType, "SaveData");
assert.equal(dailyTokeniumLaneCluesData.genericTokeniumClaimableBoundary.field, "ClaimableTokenium");
assert.equal(dailyTokeniumLaneCluesData.genericTokeniumClaimableBoundary.fieldType, "System.Double");
assert.ok(/broader Tokenium resource cluster/i.test(dailyTokeniumLaneCluesData.genericTokeniumClaimableBoundary.blockedReason));
assert.ok(dailyTokeniumLaneCluesData.negativeTypedOwnerChecks.includes("SaveData.DailyTokeniumCap"));
assert.ok(dailyTokeniumLaneCluesData.negativeTypedOwnerChecks.includes("PlayerProfileData.DailyTokenium"));
assert.ok(dailyTokeniumLaneCluesData.negativeTypedOwnerChecks.includes("PlayerProfileData.DailyTokeniumCap"));
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
assert.equal(multiverseMarketRangeBoundaryData.metadataIsRangeLabel, "IS71Level through IS110Level");
assert.deepEqual(multiverseMarketRangeBoundaryData.overlapIds, [71, 72, 73, 74]);
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
assert.equal(tokenShopRowLevelOwnerData.dataset, "token-shop-row-level-owner");
assert.equal(tokenShopRowLevelOwnerData.typedSaveDataFieldTableRecovery.fieldOwner, "SaveData");
assert.equal(tokenShopRowLevelOwnerData.typedSaveDataFieldTableRecovery.fieldCount, 4461);
assert.equal(tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.saveFieldRange, "ATU1Level through ATU28Level");
assert.ok(tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.saveFieldSamples.includes("ATU1Level"));
assert.ok(tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.saveFieldSamples.includes("ATU28Level"));
assert.ok(tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.adjacentSaveFields.includes("Tier2TokensUnlocked"));
assert.ok(tokenShopRowLevelOwnerData.tokenShopRowLevelFamily.adjacentSaveFields.includes("Tier5TokensUnlocked"));
assert.equal(tokenShopRowLevelOwnerData.compatibilityImportBoundary.targetPath, "compatibility.unmappedSystemState.tokenShop");
assert.ok(tokenShopRowLevelOwnerData.compatibilityImportBoundary.safeImportSubset.includes("ATU1Level through ATU28Level"));
assert.ok(tokenShopRowLevelOwnerData.currentBoundary.some((line) => /SaveData directly declares BankedTokens plus ATU1Level through ATU28Level/.test(line)));
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
assert.deepEqual(
  recoveredInscryptionLevels,
  [71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110]
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
const archivedShardParentTrack = snapshot.researchTracks.find((track) => track.id === "shards-and-loop-guardrails");
withRequiredValue(archivedShardParentTrack, "expected archived shard parent track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(track.currentSlice, /Archived parent/);
  assert.match(track.currentSlice, /superseded by narrower successor work/);
  assert.equal(track.nextSteps.length, 0);
});
const shardTrack = snapshot.researchTracks.find((track) => track.id === "shard-milestone-payload-recovery");
withRequiredValue(shardTrack, "expected shard milestone payload recovery track", (track) => {
  assert.equal(track.status, "active");
  assert.match(track.goal, /Recover the exact shard-side serialized row payload or declaring save-side owner/);
  assert.match(track.currentSlice, /Extend the narrowed ShardMining \/ ShardUpgradeInfo trail/);
  assert.match(track.currentSlice, /checked cost-model, row-model, title\/effect, and effect-text-handler boundaries/);
  assert.match(track.currentSlice, /title\/effect/);
  assert.match(track.exitCondition, /exact serialized shard milestone row payload or declaring save-side owner/);
  assert.match(track.blockedBy, /still do not expose the declaring saved row model itself/);
  assert.match(track.smallestShippableSlice, /checked shard row-owner or save-owner boundary/);
  assert.deepEqual(track.sources, [
    "docs/systems/shards/shard-system-verification.md",
    "docs/systems/shards/shard-owner-family-verification.md",
    "docs/unity/unity-owner-map.md",
    "docs/unity/unity-audit-playbook.md"
  ]);
  assert.deepEqual(track.artifacts, [
    "data/shard-owner-family-boundary.v1.json",
    "data/shard-finalsu-bonus-boundary.v1.json",
    "data/shard-milestone-payload-boundary.v1.json",
    "data/shard-cost-model-boundary.v1.json",
    "data/shard-milestone-row-model-boundary.v1.json",
    "data/shard-milestone-title-effect-boundary.v1.json",
    "data/shard-effect-text-handler-boundary.v1.json",
    "data/shard-milestone-row-shell-boundary.v1.json",
    "data/shard-milestone-row-alignment-boundary.v1.json",
    "data/shard-milestone-handoff-boundary.v1.json",
    "data/shard-save-boundary.v1.json",
    "data/shard-scene-monobehaviour-probe.v1.json",
    "data/shard-cost-parameter-probe.v1.json",
    "data/shard-cost-method-probe.v1.json",
    "data/shard-cost-native-probe.v1.json",
    "data/shard-cost-list-path-probe.v1.json",
    "data/shard-cost-formula-model.v1.json",
    "data/shard-bonus-slot-probe.v1.json",
    "data/shard-type-metadata-probe.v1.json",
    "data/shardmining-metadata-neighborhood.v1.json",
    "data/shardupgradeinfo-metadata-neighborhood.v1.json"
  ]);
  assert.ok(
    track.completedSteps.some((step) => /first recovered shard cost-model shell/.test(step)),
    "expected shard successor track to record the shard cost-model boundary slice"
  );
  assert.ok(
    track.completedSteps.some((step) => /contiguous shard-local Milestone0-29TextChecker and SU0-29UnlockReq shell/.test(step)),
    "expected shard successor track to record the shard row-model boundary slice"
  );
  assert.ok(
    track.completedSteps.some((step) => /SMilestone title assets plus the ShardMilestoneBonus presentation family/.test(step)),
    "expected shard successor track to record the shard title/effect boundary slice"
  );
  assert.ok(
    track.completedSteps.some((step) => /strongest current shard-side effect-text handler clue/.test(step)),
    "expected shard successor track to record the shard effect-text handler boundary slice"
  );
  assert.ok(
    track.completedSteps.some((step) => /partial shard row shell around UnlockMilestone17-29, BuyMilestone0, and Milestone0-12TextChecker/.test(step)),
    "expected shard successor track to record the row-shell boundary slice"
  );
  assert.ok(
    track.completedSteps.some((step) => /row-alignment boundary showing that UnlockMilestone17-29, Milestone0-12TextChecker, and BuyMilestone0 do not yet form one clean shared row-number family/.test(step)),
    "expected shard successor track to record the row-alignment boundary slice"
  );
  assert.ok(
    track.verified.some((line) => /sampled get_SU\*Cost accessors plus a row-local SU0 StartCost or exponent field shell/.test(line)),
    "expected shard successor track to record the shard cost-model shell in verified facts"
  );
  assert.ok(
    track.verified.some((line) => /Milestone0-29TextChecker and SU0-29UnlockReq families/.test(line)),
    "expected shard successor track to record the row-model shell in verified facts"
  );
  assert.ok(
    track.verified.some((line) => /title candidates for rows 0-30 and a generic ShardMilestoneBonus1-8 effect presentation family/.test(line)),
    "expected shard successor track to record the title/effect boundary in verified facts"
  );
  assert.ok(
    track.verified.some((line) => /TextHandlerShardMilestoneBonusesPerLevel\/N/.test(line)),
    "expected shard successor track to record the shard effect-text handler clue in verified facts"
  );
  assert.ok(
    track.verified.some((line) => /partial row shell around UnlockMilestone17-29, BuyMilestone0, and Milestone0-12TextChecker/.test(line)),
    "expected shard successor track to record the partial row shell in verified facts"
  );
  assert.ok(
    track.verified.some((line) => /unlock hooks currently sit at 17-29 while text-checker hooks sit at 0-12/.test(line)),
    "expected shard successor track to record the row-alignment mismatch in verified facts"
  );
  assert.ok(
    track.verified.some((line) => /ShardMining keeps the shard-local row shell while ConstructionMilestones keeps the dense BuyMilestone1-57 family/.test(line)),
    "expected shard successor track to record the narrowed handoff seam in verified facts"
  );
  assert.ok(track.nextSteps.length <= 5, "expected narrowed shard successor next-step count");
});
const spendTrack = snapshot.researchTracks.find((track) => track.id === "spend-planner-from-extracted-data");
withRequiredValue(spendTrack, "expected archived spend parent track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(track.currentSlice, /Archived parent: this broad spend lane is now superseded by narrower successor tracks/);
  assert.ok(
    track.completedSteps.some((step) => /Separate TokenShop cost lanes, action lanes, owner-shell clues, token-bank controller clues, and save-boundary clues into checked artifacts/.test(step)),
    "expected archived spend parent to record TokenShop boundary separation"
  );
  assert.ok(
    track.completedSteps.some((step) => /Separate MultiverseMarket owner-family, action-shell, range-boundary, prefab-remap, metadata-neighborhood, and save-boundary evidence into checked artifacts/.test(step)),
    "expected archived spend parent to record Emporium boundary separation"
  );
  assert.ok(
    track.completedSteps.some((step) => /owner-shell clues, token-bank controller clues, and save-boundary clues into checked artifacts/.test(step)),
    "expected archived spend parent to preserve save-boundary separation"
  );
});
const spendSaveOwnerTrack = snapshot.researchTracks.find((track) => track.id === "spend-multiverse-save-model-recovery");
withRequiredValue(spendSaveOwnerTrack, "expected archived Emporium save-owner track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(track.currentSlice, /Archived owner-recovery lane/);
  assert.equal(track.nextSteps.length, 0);
});
const spendImportSurfaceTrack = snapshot.researchTracks.find((track) => track.id === "spend-multiverse-savedata-import-surface");
withRequiredValue(spendImportSurfaceTrack, "expected Emporium import-surface successor track", (track) => {
  assert.equal(track.status, "active");
  assert.match(track.currentSlice, /`multiverse-market-savedata-import-boundary` artifact/);
  assert.match(track.currentSlice, /`PlayerProfileHandler\.get_Market -> MultiverseMarket`/);
  assert.match(track.currentSlice, /`IS1Level` through `IS110Level` as the compatibility-safe raw Emporium import span/);
  assert.ok(
    track.completedSteps.some((step) => /dedicated `multiverse-market-savedata-import-boundary` artifact/.test(step)),
    "expected Emporium import-surface track to record the dedicated boundary artifact"
  );
  assert.ok(
    track.completedSteps.some((step) => /`InscryptionsDone` classified as wrapper\/export-only/.test(step)),
    "expected Emporium import-surface track to keep InscryptionsDone wrapper-only"
  );
  assert.ok(
    track.completedSteps.some((step) => /`IS71Level` through `IS74Level` classified as verified-but-blocked/.test(step)),
    "expected Emporium import-surface track to keep overlap rows verified-but-blocked"
  );
  assert.ok(
    track.completedSteps.some((step) => /Promote the exact typed `IS1Level` through `IS110Level` span as compatibility-only raw Emporium import truth/.test(step)),
    "expected Emporium import-surface track to record the compatibility-safe IS span"
  );
  assert.ok(
    track.nextSteps.some((step) => /canonical Emporium import-safe subset explicitly empty/.test(step)),
    "expected Emporium import-surface track to keep the canonical subset empty"
  );
  assert.ok(
    track.nextSteps.some((step) => /Leave row `71-74` player-facing identity\/remap work on its separate downstream track/.test(step)),
    "expected Emporium import-surface track to keep row remap separate"
  );
  assert.ok(
    multiverseMarketMarketMemberBoundaryData.missingDirectTypeMapClues.includes("PlayerProfileData|Market") &&
      multiverseMarketMarketMemberBoundaryData.directPlayerProfileFieldSamples.includes("InscryptionsDone") &&
      multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) => /PlayerProfileData directly declares InscryptionsDone/i.test(line)),
    "expected market-member boundary artifact to preserve the PlayerProfileData direct-field versus missing Market type-map boundary"
  );
  assert.ok(
    track.verified.some((line) => /`PlayerProfileHandler\.get_Market -> MultiverseMarket`/.test(line)),
    "expected Emporium import-surface track to record the checked accessor bridge in verified facts"
  );
  assert.ok(
    track.verified.some((line) => /`SaveData` directly declares `IS71Level`, `IS110Level`, `InscryptionsDone`, `EsotericR1Trades`, `NecrumR1Trades`, `Mech1Unlocked`, and `Mech1MissionsCompleted`/.test(line)),
    "expected Emporium import-surface track to record the exact SaveData progression owner in verified facts"
  );
  assert.ok(
    track.verified.some((line) => /No recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import/.test(line)),
    "expected Emporium import-surface track to keep canonical import blocked in verified facts"
  );
  assert.ok(
    track.uncertain.some((line) => /bounded `SaveData`-backed Emporium import slice/.test(line)),
    "expected Emporium import-surface track to keep the bounded import question open"
  );
  assert.ok(
    multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) => /does not place that wider run directly on MultiverseMarket/i.test(line)),
    "expected market-member boundary artifact to keep the broader progression run separate from direct MultiverseMarket ownership"
  );
});
const spendFirstUiSliceTrack = snapshot.researchTracks.find((track) => track.id === "spend-planner-first-ui-slice");
withRequiredValue(spendFirstUiSliceTrack, "expected spend planner first UI slice track", (track) => {
  assert.equal(track.status, "active");
  assert.match(track.goal, /minimal descriptive spend-planner panel/i);
  assert.match(track.currentSlice, /canonical `state\.playerProfile` spend-side inputs/);
  assert.match(track.currentSlice, /exact `SaveData\.BankedTokens` as boundary-backed spend evidence/);
  assert.match(track.blockedBy, /TokenShop row remap, token-bank cap and claimable state, Daily Tokenium saved state, and Emporium owned progression fields/);
  assert.match(track.smallestShippableSlice, /top-level spend-planner panel/);
  assert.ok(
    track.completedSteps.some((step) => /canonical `player\.resources\.\*`, `player\.loop\.loopReset`, and profile-confidence inputs only/.test(step)),
    "expected spend first UI slice track to record canonical-only panel inputs"
  );
  assert.ok(
    track.completedSteps.some((step) => /exact `SaveData\.BankedTokens` as boundary-backed token-bank stored-amount evidence/.test(step)),
    "expected spend first UI slice track to record BankedTokens boundary-backed evidence"
  );
  assert.ok(
    track.completedSteps.some((step) => /Label owner-dependent spend inputs as unavailable/.test(step)),
    "expected spend first UI slice track to record blocked-input labeling"
  );
  assert.ok(
    track.verified.some((line) => /`player\.resources\.tokens`, `player\.resources\.diamonds`, `player\.loop\.loopReset`, and importable `player\.resources\.academyRelics`/.test(line)),
    "expected spend first UI slice track to record available canonical spend inputs"
  );
  assert.ok(
    track.verified.some((line) => /Exact `SaveData\.BankedTokens` recovery now grounds the current token-bank stored amount strongly enough to show it as boundary-backed evidence/.test(line)),
    "expected spend first UI slice track to record BankedTokens as boundary-backed evidence"
  );
  assert.ok(
    track.verified.some((line) => /descriptive spend-planner panel can ship without promoting unresolved save owners or wrapper-only Emporium fields into canonical planner inputs/.test(line)),
    "expected spend first UI slice track to keep unresolved owners and wrapper-only Emporium fields out of canonical inputs"
  );
  assert.ok(track.nextSteps.length <= 3, "expected spend first UI slice next-step count");
});
const tokenBankOwnerTrack = snapshot.researchTracks.find((track) => track.id === "spend-token-bank-state-owner");
withRequiredValue(tokenBankOwnerTrack, "expected token-bank state-owner track", (track) => {
  assert.equal(track.status, "active");
  assert.match(track.currentSlice, /exact `SaveData\.BankedTokens` recovery as the current token-bank stored-amount owner/);
  assert.match(track.currentSlice, /broader `PlayerProfileData` \/ `CloudSavePlayerProfile` persistence-family boundary/);
  assert.ok(
    track.completedSteps.some((step) => /zero direct overlap between the narrowed TokenShop owner shell and the PlayerProfile save-family terms/.test(step)),
    "expected token-bank state-owner track to record TokenShop save-boundary separation"
  );
  assert.ok(
    track.completedSteps.some((step) => /FinalTokenBankCap and FinalTokenBankFillSpeed clustered as output-side accessors and backing fields without save-family joins/.test(step)),
    "expected token-bank state-owner track to record the derived-output non-owner boundary"
  );
  assert.ok(
    track.completedSteps.some((step) => /exact typed `SaveData\.BankedTokens` ownership for the current token-bank stored amount/.test(step)),
    "expected token-bank state-owner track to record exact BankedTokens owner recovery"
  );
  assert.ok(
    track.verified.some((line) => /`SaveData` directly declares `BankedTokens` as the current token-bank stored-amount field/.test(line)),
    "expected token-bank state-owner track to record exact stored-amount owner"
  );
  assert.ok(
    track.verified.some((line) => /do not currently expose `ClaimableBankTokens` or `TokenBankCap` on `SaveData` or `PlayerProfileData`/.test(line)),
    "expected token-bank state-owner track to record typed negative cap and claimable checks"
  );
  assert.ok(
    track.verified.some((line) => /remaining grounded save-side search therefore stays on the broader PlayerProfile persistence-family boundary/.test(line)),
    "expected token-bank state-owner track to record the narrowed broader save-family search path"
  );
  assert.ok(
    track.uncertain.some((line) => /cap or claimable state lives directly on PlayerProfileData or on a narrower nested PlayerProfile-side wrapper/.test(line)),
    "expected token-bank state-owner track to keep the PlayerProfile-side wrapper question unresolved"
  );
});
const feedTrack = snapshot.researchTracks.find((track) => track.id === "unified-feed-and-hardening");
withRequiredValue(feedTrack, "expected unified feed track", (track) => {
  assert.equal(track.status, "active");
  assert.match(track.currentSlice, /quarantine contract-bad shard or loop cards out of the main player feed/);
assert.ok(
  track.completedSteps.some((step) => /Show the bundled dataset refresh hardening path inside the validation surface/.test(step)),
  "expected unified feed track to record in-app refresh hardening"
);
assert.ok(
  track.completedSteps.some((step) => /Show feed-level explainability coverage counts/.test(step)),
  "expected unified feed track to record explainability coverage work"
);
assert.ok(
  track.completedSteps.some((step) => /Show per-card explainability audit status/.test(step)),
  "expected unified feed track to record per-card explainability audit work"
);
assert.ok(
  track.completedSteps.some((step) => /Show feed-level complete-versus-partial explainability audit counts/.test(step)),
  "expected unified feed track to record feed-level explainability audit counts"
);
assert.ok(
  track.completedSteps.some((step) => /Expand representative shard and loop fixtures toward partial-context warning shapes/.test(step)),
  "expected unified feed track to record partial-context fixture coverage"
);
assert.ok(
  track.completedSteps.some((step) => /recommendation contract audit status and per-card contract validity/.test(step)),
  "expected unified feed track to record recommendation contract audit visibility"
);
assert.ok(
  track.completedSteps.some((step) => /Promote recommendation-contract integrity into a shipped validation case/.test(step)),
  "expected unified feed track to record runtime feed contract validation"
);
assert.ok(
  track.completedSteps.some((step) => /explicit player-value benefit lines on active cards/.test(step)),
  "expected unified feed track to record explicit player-value benefit lines"
);
assert.ok(
  track.completedSteps.some((step) => /Quarantine contract-bad shard or loop cards into a labeled support notice/.test(step)),
  "expected unified feed track to record contract-bad card quarantine"
);
assert.ok(
  track.nextSteps.some((step) => /Apply the same refresh discipline when new asset-grounded datasets or owner recoveries are promoted/.test(step)),
  "expected unified feed track to keep refresh discipline as remaining work"
);
assert.ok(
  track.nextSteps.some((step) => /Keep strengthening explainability coverage as new recommendation modules join the feed/.test(step)),
  "expected unified feed track to keep explainability hardening open"
  );
});
const profileTrack = snapshot.researchTracks.find((track) => track.id === "playerprofile-boundary-and-imports");
withRequiredValue(profileTrack, "expected player profile track", (track) => {
  assert.equal(track.status, "archived");
  assert.match(track.currentSlice, /classified alias inventory/);
  assert.match(track.currentSlice, /reduced non-canonical migration surface/);
  assert.equal(track.nextSteps.length, 0);
});
const datasetContractTrack = snapshot.researchTracks.find((track) => track.id === "data-contracts-and-apk-pipeline");
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
  assert.match(track.currentSlice, /uses recovered metadata clues only to narrow persistence neighborhoods/);
});
const automationTrack = snapshot.researchTracks.find((track) => track.id === "input-automation-intake");
withRequiredValue(automationTrack, "expected automation intake track", (track) => {
  assert.equal(track.status, "research");
  assert.equal(track.category, "deferred-infrastructure");
  assert.match(track.currentSlice, /guided import is insufficient without OCR/);
});
const externalModelTrack = snapshot.researchTracks.find((track) => track.id === "external-model-integration-intake");
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
assert.equal(multiverseMarketSaveBoundaryData.probeResults.actionShellWithSaveOverlapCount, 0);
assert.equal(multiverseMarketSaveBoundaryData.probeResults.metadataNeighborhoodHasActionTerms, true);
assert.equal(multiverseMarketSaveBoundaryData.probeResults.metadataNeighborhoodHasSaveTerms, true);
assert.deepEqual(multiverseMarketSaveBoundaryData.crossBoundaryTypedOwnerStatus, {
  status: "declaring-owner-closed-market-wrapper-still-unresolved",
  exactDeclaringOwner: "SaveData",
  scope: "checked InscryptionsDone / IS*Level / trade-counter / early Mech* progression cluster, with the declaring owner closed on SaveData and the remaining seam narrowed to typed Market-wrapper recovery only",
  note: "This artifact still records the action-shell versus save-family split only; the checked typed market-member boundary closes the declaring-owner question on SaveData, preserves the exact PlayerProfileData.InscryptionsDone:System.String versus SaveData.InscryptionsDone:System.Int32 split, and still does not recover a typed Market field or import-ready row mapping."
});
assertCurrentBoundaryIncludes(multiverseMarketSaveBoundaryData.currentBoundary, [
  /zero direct overlap/,
  /closes the declaring-owner question on SaveData/,
  /still does not recover a typed Market field, player-owned row levels/
], "MultiverseMarket save boundary");

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
assert.deepEqual(multiverseMarketMarketMemberBoundaryData.negativeTypedDirectPlayerProfileProgressionChecks, [
  "PlayerProfileData.IS71Level",
  "PlayerProfileData.IS110Level",
  "PlayerProfileData.EsotericR1Trades",
  "PlayerProfileData.NecrumR1Trades",
  "PlayerProfileData.Mech1Unlocked",
  "PlayerProfileData.Mech1MissionsCompleted"
]);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) => /does not place that wider run directly on MultiverseMarket/i.test(line)),
  "expected typed probe to keep the broader progression run off direct MultiverseMarket ownership"
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) => /PlayerProfileData field table has 89 direct fields and 1 method/i.test(line)),
  "expected typed probe to preserve the exact PlayerProfileData field-table recovery"
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) => /none of those direct fields are named IS71Level, IS110Level, EsotericR1Trades, NecrumR1Trades, Mech1Unlocked, or Mech1MissionsCompleted/i.test(line)),
  "expected typed probe to rule out flat direct PlayerProfileData progression ownership"
);
assert.ok(
  multiverseMarketMarketMemberBoundaryData.currentBoundary.some((line) => /first nested MultiverseMarket payload types are .* row-local .* broader saved progression block/i.test(line)),
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
  multiverseMarketMarketMemberBoundaryData.negativeTypedDirectMemberChecks.includes("MultiverseMarket.InscryptionsDone"),
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
  scope: "typed Market-named wrapper recovery beyond the checked accessor bridge, not the declaring owner for the checked InscryptionsDone / IS*Level cluster",
  note: "Exact typed recovery closes the checked declaring-owner question on SaveData for the broader InscryptionsDone / IS*Level / trade-counter / early mech cluster, but still does not recover a typed Market field on PlayerProfileHandler, PlayerProfileData, or SaveData."
});
assertCurrentBoundaryIncludes(multiverseMarketMarketMemberBoundaryData.currentBoundary, [
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
], "MultiverseMarket market-member boundary");

assert.deepEqual(multiverseMarketRangeBoundaryData.validatedRowRanges, ["50-59", "63-74"]);
assert.deepEqual(multiverseMarketRangeBoundaryData.overlapIds, [71, 72, 73, 74]);
assert.equal(multiverseMarketRangeBoundaryData.metadataIsRangeLabel, "IS71Level through IS110Level");
assertCurrentBoundaryIncludes(multiverseMarketRangeBoundaryData.currentBoundary, [
  /first direct overlap/,
  /does not, by itself, prove the declaring save owner/
], "MultiverseMarket range boundary");

assert.equal(multiverseMarketRowTextCoverageData.validatedRowCostTexts.length, 22);
assert.deepEqual(multiverseMarketRowTextCoverageData.sampleBuyHooks, ["BuyIS50", "BuyIS74"]);
assertCurrentBoundaryIncludes(multiverseMarketRowTextCoverageData.currentBoundary, [
  /TextHandlerMarkets cost-text hooks/,
  /text-handler coverage, not saved-state coverage/
], "MultiverseMarket row-text coverage");

assert.deepEqual(multiverseMarketPrefabRemapBoundaryData.validatedIdsWithoutDirectPrefabName, [69, 70, 71, 72, 73, 74]);
assert.equal(multiverseMarketPrefabRemapBoundaryData.explicitPrefabIdOverrides.length, 6);
assert.deepEqual(multiverseMarketPrefabRemapBoundaryData.overrideSerializedIdsOutsideValidatedBlock, [60, 61, 62]);
assertCurrentBoundaryIncludes(multiverseMarketPrefabRemapBoundaryData.currentBoundary, [
  /not a one-to-one player-facing remap/,
  /block any assumption that validated rows 69 through 74 already have final grounded upgrade-number labels/
], "MultiverseMarket prefab remap boundary");

assertDatasetContractEntry("multiverse-market-metadata-neighborhood", "data/multiverse-market-metadata-neighborhood.json");
assertDatasetContractEntry("multiverse-market-range-boundary", "data/multiverse-market-range-boundary.json");
assertDatasetContractEntry("multiverse-market-row-text-coverage", "data/multiverse-market-row-text-coverage.json");
assertDatasetContractEntry("multiverse-market-prefab-remap-boundary", "data/multiverse-market-prefab-remap-boundary.json");
assertDatasetContractEntry("multiverse-market-save-boundary", "data/multiverse-market-save-boundary.json");
assertDatasetContractEntry("multiverse-market-market-member-boundary", "data/multiverse-market-market-member-boundary.json");
assertDatasetContractEntry("multiverse-market-savedata-import-boundary", "data/multiverse-market-savedata-import-boundary.json");
assertDatasetContractEntry("multiverse-market-row69-74-identity-source-boundary", "data/multiverse-market-row69-74-identity-source-boundary.json");
assertDatasetContractEntry("multiverse-market-serialized-label-source-boundary", "data/multiverse-market-serialized-label-source-boundary.json");
assertDatasetContractEntry("multiverse-market-row71-74-identity-boundary", "data/multiverse-market-row71-74-identity-boundary.json");
assertDatasetContractEntry("multiverse-market-row71-74-remap-band", "data/multiverse-market-row71-74-remap-band.json");
assertDatasetContractEntry("multiverse-market-nearby-identity-binding-pattern", "data/multiverse-market-nearby-identity-binding-pattern.json");
assertDatasetContractEntry("multiverse-market-69-74-anomaly-provenance", "data/multiverse-market-69-74-anomaly-provenance.json");
assertDatasetContractEntry("multiverse-market-shell-row-prediction-boundary", "data/multiverse-market-shell-row-prediction-boundary.json");
assert.equal(multiverseMarketSaveDataImportBoundaryData.dataset, "multiverse-market-savedata-import-boundary");
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.importSafeSubset,
  [
    "IS1Level through IS110Level",
    "EsotericR1Trades through EsotericR9Trades",
    "NecrumR1Trades through NecrumR9Trades",
    "Mech1Unlocked through Mech2Unlocked"
  ]
);
assert.equal(
  multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.exactImportSafeSubsetLabel,
  "IS1Level through IS110Level plus separate bounded trade-counter and early-mech quarantine ranges after the dual-declared InscryptionsDone boundary"
);
assert.equal(multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.importTargetPath, "compatibility.unmappedSystemState.multiverseMarket");
assert.deepEqual(multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.canonicalImportSafeSubset, []);
assert.equal(multiverseMarketSaveDataImportBoundaryData.boundedImportConclusion.exactCanonicalImportSafeSubsetLabel, "none");
assert.equal(multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.widerOrderedSet.actionShellBuyHookRange, "BuyIS1 through BuyIS110");
assert.equal(multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.widerOrderedSet.actionShellCostTextRange, "SetIS1CostText through SetIS110CostText");
assert.deepEqual(multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.widerOrderedSet.validatedRowRanges, ["50-59", "63-74"]);
assert.equal(multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.widerOrderedSet.saveDataFieldRange, "IS1Level through IS110Level");
assert.equal(multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.declaringOwner, "SaveData");
assert.equal(multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.contiguousLevelSpan, "IS1Level through IS110Level");
assert.equal(multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.lowerBoundary.includedField, "IS1Level");
assert.equal(multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.lowerBoundary.excludedNeighbor, "IS0Level");
assert.equal(multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.upperBoundary.includedField, "IS110Level");
assert.equal(multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.upperBoundary.excludedNeighbor, "IS111Level");
assert.equal(multiverseMarketSaveDataImportBoundaryData.typedSpanBoundary.upperBoundary.nextTypedNeighbor, "InscryptionsDone");
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.checkedIsToRowOrderBoundary.checkedOrderedMappings.map((entry) => [entry.saveField, entry.orderedInscriptionRow]),
  [["IS71Level", 71], ["IS72Level", 72], ["IS73Level", 73], ["IS74Level", 74]]
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.classifications.safe_import_candidate.map((entry) => entry.entryId),
  ["savedata-owned-is1-110", "savedata-owned-trade-counters", "savedata-owned-adjacent-mech-window"]
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.classifications.wrapper_or_export_only.map((entry) => entry.entryId),
  ["inscryptionsdone-wrapper"]
);
assert.deepEqual(
  multiverseMarketSaveDataImportBoundaryData.classifications.verified_but_blocked.map((entry) => entry.entryId),
  ["checked-row-order-is71-74"]
);
assert.deepEqual(multiverseMarketSaveDataImportBoundaryData.classifications.unresolved, []);
assert.match(multiverseMarketStateVerificationDoc, /## Checked `IS\*Level` to inscription-row boundary/);
assert.match(multiverseMarketStateVerificationDoc, /`IS71Level` -> ordered row `71`/);
assert.match(multiverseMarketStateVerificationDoc, /`IS74Level` -> ordered row `74`/);
assert.match(multiverseMarketStateVerificationDoc, /## Bounded SaveData import classification/);
assert.match(multiverseMarketStateVerificationDoc, /`safe_import_candidate`[\s\S]*`IS1Level` through `IS110Level`/);
assert.match(multiverseMarketStateVerificationDoc, /`safe_import_candidate`[\s\S]*`EsotericR1Trades` through `EsotericR9Trades`[\s\S]*`NecrumR1Trades` through `NecrumR9Trades`/);
assert.match(multiverseMarketStateVerificationDoc, /`safe_import_candidate`[\s\S]*`Mech1Unlocked` through `Mech2Unlocked`/);
assert.match(multiverseMarketStateVerificationDoc, /`wrapper_or_export_only`[\s\S]*`InscryptionsDone`/);
assert.match(multiverseMarketStateVerificationDoc, /`verified_but_blocked`[\s\S]*`IS71Level` through `IS74Level`/);
assert.match(multiverseMarketStateVerificationDoc, /split into separate exact typed quarantine ranges/i);
assert.match(multiverseMarketStateVerificationDoc, /`unresolved`[\s\S]*none/);
assert.match(multiverseMarketStateVerificationDoc, /no recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import/i);
assert.equal(multiverseMarketRow6974IdentitySourceBoundaryData.dataset, "multiverse-market-row69-74-identity-source-boundary");
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.settledBrokenPrefabBand.map((entry) => [entry.orderedInscriptionRow, entry.saveField, entry.serializedIdField, entry.buyHook, entry.costTextHook, entry.prefabName, entry.remappedSerializedId]),
  [
    [69, "IS69Level", "IS69ID", "BuyIS69", "SetIS69CostText", "ChrystosEmporiumUpgrade69-ID57", 57],
    [70, "IS70Level", "IS70ID", "BuyIS70", "SetIS70CostText", "ChrystosEmporiumUpgrade70-ID58", 58],
    [71, "IS71Level", "IS71ID", "BuyIS71", "SetIS71CostText", "ChrystosEmporiumUpgrade71-ID59", 59],
    [72, "IS72Level", "IS72ID", "BuyIS72", "SetIS72CostText", "ChrystosEmporiumUpgrade72-ID60", 60],
    [73, "IS73Level", "IS73ID", "BuyIS73", "SetIS73CostText", "ChrystosEmporiumUpgrade73-ID61", 61],
    [74, "IS74Level", "IS74ID", "BuyIS74", "SetIS74CostText", "ChrystosEmporiumUpgrade74-ID62", 62]
  ]
);
assert.deepEqual(multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.directPlayerFacingStringSearch.searchedLabels, ["Inscryption 69", "Inscryption 70", "Inscryption 71", "Inscryption 72", "Inscryption 73", "Inscryption 74"]);
assert.deepEqual(multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.directPlayerFacingStringSearch.matches, []);
assert.deepEqual(multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.remappedSerializedIdLabelBoundary.remappedSerializedIds, [57, 58, 59, 60, 61, 62]);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.remappedSerializedIdLabelBoundary.earlierDirectPrefabShells,
  ["ChrystosEmporiumUpgrade57", "ChrystosEmporiumUpgrade58", "ChrystosEmporiumUpgrade59", "ChrystosEmporiumUpgrade60", "ChrystosEmporiumUpgrade61", "ChrystosEmporiumUpgrade62"]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.remappedSerializedIdLabelBoundary.searchedLabels,
  ["Inscryption 57", "Inscryption 58", "Inscryption 59", "Inscryption 60", "Inscryption 61", "Inscryption 62"]
);
assert.deepEqual(multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.remappedSerializedIdLabelBoundary.matches, []);
assert.equal(multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.textHandlerCoverage.textHandlerOwner, "TextHandlerMarkets");
assert.deepEqual(multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.actionShellCoverage.buyHooks, ["BuyIS69", "BuyIS70", "BuyIS71", "BuyIS72", "BuyIS73", "BuyIS74"]);
assert.deepEqual(
  [
    multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.metadataJoinCandidates.ownerField,
    multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.metadataJoinCandidates.ownerType,
    multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.metadataJoinCandidates.listField
  ],
  ["THMarkets", "TextHandlerMarkets", "InscryptionsList"]
);
assert.equal(multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.tmpProbeNegativeBoundary.artifact, "tmp-multiverse-row-text-probe.json");
assert.equal(multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.tmpProbeNegativeBoundary.sourceClass, "raw TextHandlerMarkets presentation-probe continuation");
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.checkedNonPrefabIdentitySources.tmpProbeNegativeBoundary.checkedAnchors,
  ["SetIS69BaseBonusText", "ClearISObjects", "ClearISMaxLevelObjects", "SetISMaxLevelObjects", "THMarkets", "InscryptionsList"]
);
assert.deepEqual(
  multiverseMarketRow6974IdentitySourceBoundaryData.playerFacingIdentitySourceBoundary.identitySourceRecovered.map((entry) => [entry.orderedInscriptionRow, entry.playerFacingLabel]),
  [
    [69, "INSCRYPTION #69"],
    [70, "INSCRYPTION #70"],
    [71, "INSCRYPTION #71"],
    [72, "INSCRYPTION #72"],
    [73, "INSCRYPTION #73"],
    [74, "INSCRYPTION #74"]
  ]
);
assert.deepEqual(multiverseMarketRow6974IdentitySourceBoundaryData.playerFacingIdentitySourceBoundary.canonicalImportSafeSubset, []);
assert.equal(multiverseMarketRow6974IdentitySourceBoundaryData.playerFacingIdentitySourceBoundary.helpsRows6974, true);
assert.deepEqual(multiverseMarketRow6974IdentitySourceBoundaryData.playerFacingIdentitySourceBoundary.identityStillBlocked, []);
assert.match(multiverseMarketStateVerificationDoc, /## Checked row `69-74` player-facing identity-source boundary/);
assert.match(multiverseMarketStateVerificationDoc, /no stable repo-local player-facing identity source is currently recoverable for rows `69-74`/i);
assert.match(multiverseMarketStateVerificationDoc, /the supplied live UI screenshots do recover the player-facing identities of rows `69-74` directly/i);
assert.match(multiverseMarketStateVerificationDoc, /serialized ids `57-62`[\s\S]*do not recover direct player-facing strings `Inscryption 57` through `Inscryption 62`/i);
assert.match(multiverseMarketStateVerificationDoc, /tmp-multiverse-row-text-probe\.json[\s\S]*SetIS69BaseBonusText[\s\S]*ClearISObjects[\s\S]*ClearISMaxLevelObjects[\s\S]*SetISMaxLevelObjects/i);
assert.equal(multiverseMarketSerializedLabelSourceBoundaryData.dataset, "multiverse-market-serialized-label-source-boundary");
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.multiverseMarketContainerFields.map((entry) => [entry.name, entry.fieldOffset]),
  [
    ["InscryptionCostList", 10656],
    ["InscryptionAndCostRelations", 10672],
    ["IDChecks", 10688],
    ["inscryptions", 10696],
    ["InscryptionTupleList", 10704]
  ]
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.rowPayloadTypes.map((entry) => entry.typeName),
  ["MultiverseMarket|Inscryption", "MultiverseMarket|InscryptionTupleObject"]
);
assert.deepEqual(multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.labelBearingFieldChecks.recoveredStringOrLabelFields, []);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.indirectJoinSearch.candidateCatalogOrRelationFields,
  ["InscryptionCostList", "InscryptionAndCostRelations", "IDChecks", "inscryptions", "InscryptionTupleList"]
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.indirectJoinSearch.separateUiShellClues,
  ["THMarkets", "InscryptionsList", "TextHandlerMarkets", "SetAllChrystosEmporiumTexts"]
);
assert.deepEqual(
  multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.indirectJoinSearch.repoLocalConsumerSearchSourcesWithoutCandidateHits,
  ["data/unity-probe-report.json", "data/lm244-targeted-probe.json", "data/multiverse-market-metadata-neighborhood.json"]
);
assert.deepEqual(multiverseMarketSerializedLabelSourceBoundaryData.checkedSerializedExportEvidence.indirectJoinSearch.adjacentConsumerOrViewSymbolsRecovered, []);
assert.deepEqual(multiverseMarketSerializedLabelSourceBoundaryData.joinBackAssessment.playerFacingIdentitySourceRecovered, []);
assert.deepEqual(multiverseMarketSerializedLabelSourceBoundaryData.joinBackAssessment.canonicalImportSafeSubset, []);
assert.equal(multiverseMarketSerializedLabelSourceBoundaryData.joinBackAssessment.helpsRows6974, false);
assert.deepEqual(multiverseMarketSerializedLabelSourceBoundaryData.joinBackAssessment.smallestRecoveredPattern, []);
assert.match(multiverseMarketVerificationDoc, /## Alternate serialized-export indirect-join boundary/);
assert.match(multiverseMarketVerificationDoc, /InscryptionCostList/);
assert.match(multiverseMarketVerificationDoc, /no indirect catalog\/relation join is recoverable repo-locally/i);
assert.match(multiverseMarketStateVerificationDoc, /## Alternate serialized-export indirect-join boundary/);
assert.match(multiverseMarketStateVerificationDoc, /InscryptionTupleList/);
assert.match(multiverseMarketStateVerificationDoc, /no indirect catalog\/relation join is recoverable repo-locally/i);
assert.equal(multiverseMarketRow7174IdentityBoundaryData.dataset, "multiverse-market-row71-74-identity-boundary");
assert.deepEqual(
  multiverseMarketRow7174IdentityBoundaryData.settledOrderedMapping.map((entry) => [entry.saveField, entry.orderedInscriptionRow]),
  [["IS71Level", 71], ["IS72Level", 72], ["IS73Level", 73], ["IS74Level", 74]]
);
assert.deepEqual(multiverseMarketRow7174IdentityBoundaryData.playerFacingIdentityBoundary.canonicalImportSafeSubset, []);
assert.deepEqual(
  multiverseMarketRow7174IdentityBoundaryData.playerFacingIdentityBoundary.identityRecovered.map((entry) => [entry.orderedInscriptionRow, entry.playerFacingLabel]),
  [[71, "INSCRYPTION #71"], [72, "INSCRYPTION #72"], [73, "INSCRYPTION #73"], [74, "INSCRYPTION #74"]]
);
assert.deepEqual(multiverseMarketRow7174IdentityBoundaryData.playerFacingIdentityBoundary.identityStillBlocked, []);
assert.deepEqual(
  multiverseMarketRow7174IdentityBoundaryData.playerFacingIdentityBoundary.adjacentKnownPlayerFacingAnchors.map((entry) => [entry.orderedInscriptionRow, entry.label]),
  [[68, "INSCRYPTION #68"], [75, "INSCRYPTION #75"]]
);
assert.match(multiverseMarketStateVerificationDoc, /ChrystosEmporiumUpgrade71-ID59/);
assert.equal(multiverseMarketRow7174RemapBandData.dataset, "multiverse-market-row71-74-remap-band");
assert.deepEqual(
  multiverseMarketRow7174RemapBandData.remapBandRows.map((entry) => [entry.orderedInscriptionRow, entry.serializedIdField, entry.prefabName, entry.remappedSerializedId]),
  [
    [71, "IS71ID", "ChrystosEmporiumUpgrade71-ID59", 59],
    [72, "IS72ID", "ChrystosEmporiumUpgrade72-ID60", 60],
    [73, "IS73ID", "ChrystosEmporiumUpgrade73-ID61", 61],
    [74, "IS74ID", "ChrystosEmporiumUpgrade74-ID62", 62]
  ]
);
assert.deepEqual(
  multiverseMarketRow7174RemapBandData.earlierPrefabShellEvidence.map((entry) => [entry.serializedId, entry.prefabName]),
  [[59, "ChrystosEmporiumUpgrade59"], [60, "ChrystosEmporiumUpgrade60"], [61, "ChrystosEmporiumUpgrade61"], [62, "ChrystosEmporiumUpgrade62"]]
);
assert.deepEqual(
  multiverseMarketRow7174RemapBandData.liveUiComparison.testedRows.map((entry) => [entry.orderedInscriptionRow, entry.playerFacingLabel]),
  [[71, "INSCRYPTION #71"], [72, "INSCRYPTION #72"], [73, "INSCRYPTION #73"], [74, "INSCRYPTION #74"]]
);
assert.deepEqual(multiverseMarketRow7174RemapBandData.canonicalImportSafeSubset, []);
assert.match(multiverseMarketStateVerificationDoc, /## Checked row `71-74` remap-band boundary/);
assert.match(multiverseMarketStateVerificationDoc, /prefab numbers `71-74` are reused as shells for serialized ids `59-62`/i);
assert.match(multiverseMarketVerificationDoc, /## Narrow row 71-74 remap-band boundary/);
assert.match(multiverseMarketVerificationDoc, /ChrystosEmporiumUpgrade71-ID59/);
assert.match(multiverseMarketVerificationDoc, /ChrystosEmporiumUpgrade59/);
assert.match(multiverseMarketVerificationDoc, /the canonical import-safe subset stays empty/i);
assert.equal(multiverseMarketNearbyIdentityBindingPatternData.dataset, "multiverse-market-nearby-identity-binding-pattern");
assert.deepEqual(
  multiverseMarketNearbyIdentityBindingPatternData.checkedPositiveBindings.map((entry) => [entry.orderedInscriptionRow, entry.saveField, entry.serializedIdField, entry.buyHook, entry.prefabName, entry.playerFacingLabel]),
  [
    [78, "IS78Level", "IS78ID", "BuyIS78", "ChrystosEmporiumUpgrade78-ID78", "Inscryption 78: Ouroboros Orbs"],
    [83, "IS83Level", "IS83ID", "BuyIS83", "ChrystosEmporiumUpgrade83-ID83", "Inscryption 83: Fast-Loop ML"]
  ]
);
assert.deepEqual(multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.checkedPositiveRows, [78, 83]);
assert.deepEqual(multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.checkedNegativeCarryoverRows, [69, 70, 71, 72, 73, 74]);
assert.equal(multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.helpsRows6974, false);
assert.deepEqual(multiverseMarketNearbyIdentityBindingPatternData.recoveredPattern.canonicalImportSafeSubset, []);
assert.match(multiverseMarketStateVerificationDoc, /## Nearby checked inscription identity-binding pattern/);
assert.match(multiverseMarketStateVerificationDoc, /ChrystosEmporiumUpgrade78-ID78/);
assert.match(multiverseMarketStateVerificationDoc, /ChrystosEmporiumUpgrade83-ID83/);
assert.match(multiverseMarketVerificationDoc, /## Nearby checked identity-binding pattern/);
assert.match(multiverseMarketVerificationDoc, /IS78Level`, `IS78ID`, `BuyIS78`, `ChrystosEmporiumUpgrade78-ID78`, `Inscryption 78: Ouroboros Orbs`/);
assert.match(multiverseMarketVerificationDoc, /IS83Level`, `IS83ID`, `BuyIS83`, `ChrystosEmporiumUpgrade83-ID83`, `Inscryption 83: Fast-Loop ML`/);
assert.match(multiverseMarketVerificationDoc, /does not ground rows `69-74` by itself/i);
assert.match(multiverseMarketVerificationDoc, /ChrystosEmporiumUpgrade69-ID57[\s\S]*ChrystosEmporiumUpgrade74-ID62/i);
assert.equal(multiverseMarket6974AnomalyProvenanceData.dataset, "multiverse-market-69-74-anomaly-provenance");
assert.deepEqual(multiverseMarket6974AnomalyProvenanceData.settledAnomaly.sameNumberAlignmentLayers, ["IS69Level through IS74Level", "IS69ID through IS74ID", "BuyIS69 through BuyIS74"]);
assert.deepEqual(multiverseMarket6974AnomalyProvenanceData.settledAnomaly.brokenPrefabBandRows, [69, 70, 71, 72, 73, 74]);
assert.deepEqual(multiverseMarket6974AnomalyProvenanceData.settledAnomaly.prefabRemapPairs, ["69->57", "70->58", "71->59", "72->60", "73->61", "74->62"]);
assert.deepEqual(multiverseMarket6974AnomalyProvenanceData.settledAnomaly.playerFacingIdentityRecoveredRowsInBand, [69, 70, 71, 72, 73, 74]);
assert.deepEqual(multiverseMarket6974AnomalyProvenanceData.pipelineStages.map((stage) => [stage.stageId, stage.classification, stage.anomalyPresent]), [
  ["raw-app-side-asset", "raw-app-side", true],
  ["raw-app-side-probe-reports", "raw-app-side", true],
  ["repo-local-derived-boundaries", "repo-local-derived", true]
]);
assert.equal(multiverseMarket6974AnomalyProvenanceData.provenanceConclusion.earliestCheckedAppearanceStage, "raw-app-side-asset");
assert.equal(multiverseMarket6974AnomalyProvenanceData.provenanceConclusion.anomalyOwner, "app-side-inherited");
assert.equal(multiverseMarket6974AnomalyProvenanceData.provenanceConclusion.repoLocalIntroductionDetected, false);
assert.equal(multiverseMarket6974AnomalyProvenanceData.standardizationDecision.standardizationAllowed, false);
assert.equal(multiverseMarket6974AnomalyProvenanceData.standardizationDecision.standardizationApplied, false);
assert.match(multiverseMarketStateVerificationDoc, /## Checked `69-74` anomaly provenance boundary/);
assert.match(multiverseMarketStateVerificationDoc, /the `69-74` anomaly is app-side inherited rather than repo-local/i);
assert.match(multiverseMarketStateVerificationDoc, /live UI evidence now grounds rows `69-74` as player-facing rows `69-74`/i);
assert.match(multiverseMarketVerificationDoc, /## Checked 69-74 anomaly provenance boundary/);
assert.match(multiverseMarketVerificationDoc, /the anomaly must remain represented as inherited source truth/i);
assert.match(multiverseMarket6974AnomalyProvenanceDoc, /earliest checked appearance is raw app-side evidence/i);
assert.match(multiverseMarket6974AnomalyProvenanceDoc, /No dataset standardization is applied in this lane\./);
assert.equal(multiverseMarketShellRowPredictionBoundaryData.dataset, "multiverse-market-shell-row-prediction-boundary");
assert.deepEqual(
  multiverseMarketShellRowPredictionBoundaryData.testedRows.map((entry) => [entry.orderedInscriptionRow, entry.saveDataOwnerChain.saveField, entry.saveDataOwnerChain.serializedIdField, entry.saveDataOwnerChain.buyHook]),
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
  multiverseMarketShellRowPredictionBoundaryData.testedRows.slice(0, 6).map((entry) => [entry.orderedInscriptionRow, entry.rowPayloadChain.recordInscriptionId, entry.rowPayloadChain.bonusValue]),
  [
    [69, 69, 5000000136282112.0],
    [70, 70, 10000000000.0],
    [71, 71, 0.019999999552965164],
    [72, 72, 0.05999999865889549],
    [73, 73, 10.0],
    [74, 74, 40.0]
  ]
);
assert.equal(multiverseMarketShellRowPredictionBoundaryData.testedRows[6].shellMetadata.prefabName, "ChrystosEmporiumUpgrade78-ID78");
assert.deepEqual(multiverseMarketShellRowPredictionBoundaryData.actualStructureConclusion.canonicalImportSafeSubset, []);
assert.equal(multiverseMarketShellRowPredictionBoundaryData.actualStructureConclusion.compatibilityOnlyImportPath, "compatibility.unmappedSystemState.multiverseMarket");
assert.match(multiverseMarketStateVerificationDoc, /## Checked shell-to-SaveData row-prediction boundary/);
assert.match(multiverseMarketStateVerificationDoc, /displayed row number follows the ordered same-number `SaveData` and row-carrier chain, not the prefab shell suffix/i);
assert.match(multiverseMarketVerificationDoc, /## Shell-to-SaveData row-prediction boundary/);
assert.match(multiverseMarketVerificationDoc, /id `57` carries `0\.05`, not row `69`'s `5qa`/i);
assert.match(multiverseMarketVerificationDoc, /id `58` carries `5`, not row `70`'s `10b`/i);
assert.match(multiverseMarketVerificationDoc, /id `59` carries `5`, not row `71`'s `0\.02`/i);
assert.match(tokenBankStateDoc, /LM244` should currently be treated as a presentation or explanation hook, not as the recovered gameplay owner for daily tokenium/);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /checked accessor bridge:/);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /metadata\/member-shell clue:/);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /checked typed-`Market` field result:/);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /deeper typed `Market`-named owner status:/);
assert.match(multiverseMarketMarketMemberBoundaryDoc, /no typed `Market` or `MultiverseMarket` field is recovered on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`/);
assert.match(multiverseMarketStateVerificationDoc, /metadata-only `Market` shell, and the wider save-owner recovery separated/);
assert.match(multiverseMarketStateVerificationDoc, /(does not recover a typed `Market` field|no typed `Market`-named field is recovered) on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`/);
assert.match(multiverseMarketStateVerificationDoc, /`SaveData` remains the exact declaring owner for the checked `IS\*Level` \/ trade-counter \/ mech run/);
assert.match(activeGroundingBoundariesDoc, /the bare `Market` symbol is still only a metadata\/member-shell clue/);
assert.match(activeGroundingBoundariesDoc, /does not recover a typed `Market` or `MultiverseMarket` field on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`/);
assert.doesNotMatch(multiverseMarketMarketMemberBoundaryDoc, /typed `Market` field recovered on `PlayerProfileHandler`/i);
assert.doesNotMatch(multiverseMarketMarketMemberBoundaryDoc, /typed `Market` field recovered on `PlayerProfileData`/i);
assert.doesNotMatch(multiverseMarketMarketMemberBoundaryDoc, /typed `Market` field recovered on `SaveData`/i);
assert.match(tokenBankStateDoc, /## Daily Tokenium lane correction/);
assert.match(tokenBankStateDoc, /Daily Tokenium currently belongs to an Academy or Farm Mission lane that multiple systems touch/);
assert.match(tokenBankStateDoc, /Mission \/ farm mission rewards/);
assert.match(tokenBankStateDoc, /IAP \/ permanent pack modifiers/);
assert.match(dailyTokeniumMissionDoc, /# Daily Tokenium Mission Lane Verification/);
assert.match(dailyTokeniumMissionDoc, /Daily Tokenium currently belongs to the Academy or Farm Mission reward family/);
assert.match(dailyTokeniumMissionDoc, /`SaveData\.DailyTokenium` is now the strongest exact stored-amount recovery for the lane/);
assert.match(dailyTokeniumMissionDoc, /Modifier-family split recovered from this pass/);
assert.match(dailyTokeniumMissionDoc, /Exact save-side narrowing recovered from this pass/);
assert.match(dailyTokeniumMissionDoc, /ClaimableTokenium/);
assert.match(dailyTokeniumMissionDoc, /DailyTokeniumCap/);
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
assert.match(shardVerificationDoc, /data\/shard-cost-model-boundary\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-milestone-row-model-boundary\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-milestone-title-effect-boundary\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-effect-text-handler-boundary\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-scene-monobehaviour-probe\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-cost-parameter-probe\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-cost-method-probe\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-cost-native-probe\.v1\.json/);
assert.match(shardVerificationDoc, /data\/shard-bonus-slot-probe\.v1\.json/);
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
assert.match(shardGroundingBoundaryDoc, /ranking, ROI, ETA, affordability, and best-upgrade claims remain blocked/i);
assert.match(shardPlayerFacingEvidenceDoc, /the grounded app can show shard evidence, watch cards, threshold wording, and loop-reset guardrails today/i);
assert.match(shardPlayerFacingEvidenceDoc, /external-model imports are an interim compatibility path only and stay non-canonical/i);
assert.match(shardPlayerFacingEvidenceDoc, /cannot yet claim exact shard cost math, affordability, ROI, ETA certainty, or best-buy order/i);
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
assert.match(shardOwnerFamilyDoc, /data\/shard-milestone-handoff-boundary\.v1\.json/);
assert.match(shardOwnerFamilyDoc, /splits into `UnlockMilestone17-29`, `Milestone0-12TextChecker`, and `BuyMilestone0`/);
assert.match(shardOwnerFamilyDoc, /data\/shard-save-boundary\.v1\.json/);
assert.match(shardOwnerFamilyDoc, /BuyMilestone1-57/);
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
assert.match(extractionRankingDoc, /spend-multiverse-savedata-import-surface/);
assert.match(extractionRankingDoc, /filter by track or family id/i);
assert.match(playerProfileSchemaDoc, /compatibility\.unmappedSystemState\.shardMilestoneState/);
assert.match(playerProfileSchemaDoc, /The active manual Profile form should only show values a typical player can quickly provide from the game/);
assert.match(playerProfileSchemaDoc, /Academy relics \| `player\.resources\.academyRelics` \| real profile aggregate, but not a direct active-form input/);
assert.match(playerProfileSchemaDoc, /Shard income \/ hour \| `planning\.shards\.ratePerHour` \| descriptive derived helper, not directly visible in game, so removed from the active form/);
assert.match(playerProfileSchemaDoc, /verify the concrete shard milestone save owner or declaring save model/i);
assert.match(playerProfileSchemaDoc, /prove planner-safe use before any recommendation or canonical `player\.\*` promotion/i);
assert.match(playerProfileSchemaDoc, /## Experimental support-surface helpers/);
assert.match(playerProfileSchemaDoc, /systems\.metaProgression\.hunterLevel/);
assert.match(playerProfileSchemaDoc, /stage\.highestShipUnlocked/);
assert.match(playerProfileSchemaDoc, /top-level `power`, `speed`, and `cargo` no longer migrate/);
assert.match(playerProfileSchemaDoc, /planning\.gemNodeBudget`, `planning\.resourceFocus`, `planning\.researchHours`, and their flat helper forms are retired/);
assert.match(playerProfileSchemaDoc, /flat `gemDust`, `hunterLevel`, `traitSphereCount`, and `mechParts` no longer migrate automatically/);
assert.match(playerProfileSchemaDoc, /flat spend-state clues such as `TokenBankCap`, `ClaimableBankTokens`, `FinalTokenBankCap`, `FinalTokenBankFillSpeed`, `DailyTokeniumCap`, `InscryptionsDone`, exact typed SaveData-backed Emporium levels `IS1Level` through `IS110Level`, exact typed Emporium-adjacent trade counters `EsotericR1Trades` through `EsotericR9Trades` and `NecrumR1Trades` through `NecrumR9Trades`, and the bounded early-mech quarantine window `Mech1Unlocked` through `Mech2Unlocked` may be quarantined/);
assert.match(importMappingDoc, /compatibility\.unmappedSystemState/);
assert.match(importMappingDoc, /experimental helper imports now require explicit `externalModels\.experimental\.\*` paths/);
assert.match(importMappingDoc, /externalModels\.communityTools\.shipOptimizer\.v1/);
assert.match(importMappingDoc, /toolName/);
assert.match(importMappingDoc, /sourceReference/);
assert.match(importMappingDoc, /must not silently populate canonical `player\.\*` fields/i);
assert.match(importMappingDoc, /stage\.highestShipUnlocked`, `stage\.manualPhase`, and `systems\.metaProgression\.\*` aliases should normalize into compatibility-only fields/);
assert.match(importMappingDoc, /flat unresolved aliases such as `hunterLevel`, `traitSphereCount`, `mechParts`, and `gemDust` are retired/);
assert.match(importMappingDoc, /top-level `power`, `speed`, and `cargo` are retired/);
assert.match(importMappingDoc, /flat spend-state clues such as `InscryptionsDone`, exact typed SaveData-backed Emporium levels `IS1Level` through `IS110Level`, exact typed Emporium-adjacent trade counters `EsotericR1Trades` through `EsotericR9Trades` and `NecrumR1Trades` through `NecrumR9Trades`, the bounded early-mech quarantine window `Mech1Unlocked` through `Mech2Unlocked`, `ATU\*Level`, `Tier\*TokensUnlocked`, `TokenBankCap`, `ClaimableBankTokens`, or `FinalTokenBankFillSpeed` may also be preserved/);
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
assert.match(html, /Shard Mining and Loop Prestige/);
assert.match(html, /Progression controls/);
assert.match(html, /Choose a progression view/);
assert.doesNotMatch(html, /Refresh progression/);
assert.match(html, /id="progressionSubsystemToggle"/);
assert.doesNotMatch(html, /id="progressionCalibrationPanel"/);
assert.doesNotMatch(html, /<label for="shardFocusMilestoneId">/);
assert.doesNotMatch(html, /<label for="shardFocusMilestoneLevel">/);
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
assert.match(appJs, /"spend-multiverse-savedata-import-surface": "PR 4 successor"/);
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
assert.match(appJs, /function getShardCostModelBoundarySummary/);
assert.match(appJs, /function getShardMilestoneRowModelBoundarySummary/);
assert.match(appJs, /function getShardMilestoneTitleEffectBoundarySummary/);
assert.match(appJs, /function getShardMilestoneRowShellBoundarySummary/);
assert.match(appJs, /function getShardMilestoneRowAlignmentBoundarySummary/);
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
assert.match(appJs, /function getShardFocusLevelForMilestone/);
assert.match(appJs, /function getShardMilestoneGroundedSummary/);
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
assert.match(appJs, /function getProgressionRecommendationFeedPartition\(/);
assert.match(appJs, /function getProgressionSubsystemPartition\(/);
assert.match(appJs, /function getSelectedProgressionSubsystem\(/);
assert.match(appJs, /function renderProgressionSubsystemToggle\(/);
assert.doesNotMatch(appJs, /function renderProgressionCalibrationPanel\(/);
assert.doesNotMatch(appJs, /function getProgressionCalibrationSummary\(/);
assert.match(appJs, /function renderProgressionSubsystemSection\(/);
assert.match(appJs, /function renderShardSubsystemSection\(/);
assert.match(appJs, /Shard Mining/);
assert.match(appJs, /Loop Prestige/);
assert.match(appJs, /Grounding and evidence live in docs/);
assert.match(appJs, /These rows live inside Shard Mining/);
assert.match(appJs, /Observed level/);
assert.doesNotMatch(appJs, /Tracked row/);
assert.match(appJs, /stays in canonical order/);
assert.match(appJs, /Community alias:/);
assert.match(appJs, /function getShardMilestonePanelTitle/);
assert.match(appJs, /THE \${normalizedName\.toUpperCase\(\)} MILESTONE/);
assert.match(appJs, /shard-threshold-pill/);
assert.match(appJs, /Direct row-aligned cost evidence exists for other rows, but this row is not fully mapped yet/);
assert.match(appJs, /Extracted bonus per level/);
assert.doesNotMatch(appJs, /exact serialized cost fields/);
assert.doesNotMatch(appJs, /Unlock req/);
assert.doesNotMatch(appJs, /Extracted row state/);
assert.doesNotMatch(appJs, /Formula profile/);
assert.doesNotMatch(appJs, /Grounding detail/);
assert.doesNotMatch(appJs, /Grounded data/);
assert.match(appJs, /Verified row inputs recovered; exact cost formula still unresolved\./);
assert.match(appJs, /Native cost stages not yet recovered for this row\./);
assert.match(appJs, /Observed value/);
assert.match(appJs, /per-level multiplicative model/);
assert.match(appJs, /Current value unresolved from checked inputs/);
assert.doesNotMatch(appJs, /Title source/);
assert.doesNotMatch(appJs, /Row shell/);
assert.doesNotMatch(appJs, /Effect path/);
assert.doesNotMatch(appJs, /Cost path/);
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
assert.match(appJs, /\.\/data\/shard-scene-monobehaviour-probe\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-cost-parameter-probe\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-cost-native-probe\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-bonus-slot-probe\.v1\.json/);
assert.match(appJs, /Shard milestone manual import stays disabled; this build only uses the bundled grounded descriptive dataset/);
assert.match(appJs, /\.\/data\/shard-milestones\.grounded\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-observed-behaviors\.grounded\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestones-provenance\.grounded\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-asset-grounding\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-owner-family-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-finalsu-bonus-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestone-payload-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-cost-model-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestone-row-model-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestone-title-effect-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-effect-text-handler-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestone-row-shell-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-milestone-row-alignment-boundary\.v1\.json/);
assert.match(appJs, /\.\/data\/shard-save-boundary\.v1\.json/);
assert.doesNotMatch(appJs, /Row-shell boundary/);
assert.doesNotMatch(appJs, /Row-alignment boundary/);
assert.doesNotMatch(appJs, /Cost-model boundary/);
assert.match(appJs, /Shard cost-model boundary/);
assert.match(appJs, /What the grounded app can safely show today: shard watch cards, loop warnings, threshold wording, and evidence-status notes sourced from the checked shard contract\./);
assert.match(appJs, /Interim compatibility path: external-model imports can preserve community-tool context while staying non-canonical and outside grounded shard recommendations\./);
assert.match(appJs, /If a player imports external-model or compatibility data, it is treated as an interim reference path only and not as canonical shard state\./);
assert.doesNotMatch(appJs, /Row-model boundary/);
assert.doesNotMatch(appJs, /Title\/effect boundary/);
assert.doesNotMatch(appJs, /Effect-text handler boundary/);
assert.match(appJs, /Shard effect-text handler boundary/);
assert.match(appJs, /Shard milestone row model/);
assert.match(appJs, /Shard milestone titles and effect shell/);
assert.match(appJs, /TextHandlerShardMilestoneBonusesPerLevel\/N/);
assert.match(appJs, /Shard milestone row shell/);
assert.match(appJs, /Shard milestone row alignment/);
assert.match(appJs, /UnlockMilestone, BuyMilestone, and MilestoneTextChecker row shell/);
assert.match(appJs, /with partial row hooks such as/);
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
assert.match(appJs, /function renderSpendPlannerBoundary/);
assert.match(appJs, /No spend recommendations yet/);
assert.match(appJs, /compatibility\.unmappedSystemState/);
assert.match(appJs, /function getTokeniumNamingSummary/);
assert.match(appJs, /function getTokenBankStateSummary/);
assert.match(appJs, /function getDailyTokeniumLaneSummary/);
assert.match(appJs, /function getTokenBankFormulaBoundarySummary/);
assert.match(appJs, /function formatNumericRanges/);
assert.match(appJs, /function getMultiverseMarketRangeBoundarySummary/);
assert.match(appJs, /function getMultiverseMarketRowTextCoverageSummary/);
assert.match(appJs, /function getMultiverseMarketPrefabRemapBoundarySummary/);
assert.match(appJs, /function getImportedMultiverseMarketPreview\(importedMarketState, multiverseMarket, multiverseMarketRangeBoundary\)/);
assert.match(appJs, /function getMultiverseMarketSaveBoundarySummary/);
assert.match(appJs, /PlayerProfileHandler, playerData, GetPlayerProfileData, FillPlayerProfileData, and ConvertSaveDataToProfileData/);
assert.match(appJs, /MultiverseMarket canonical host narrowing/);
assert.match(appJs, /does not identify the declaring save model or which recovered IS\*Level subset actually maps to the validated MultiverseMarket rows/);
assert.match(appJs, /\.\/data\/tokenium-naming-clues\.json/);
assert.match(appJs, /\.\/data\/token-bank-state-clues\.json/);
assert.match(appJs, /\.\/data\/daily-tokenium-lane-clues\.json/);
assert.match(appJs, /\.\/data\/token-bank-formula-boundary\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-metadata-neighborhood\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-range-boundary\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-row-text-coverage\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-prefab-remap-boundary\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-action-shell\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-owner-family\.json/);
assert.match(appJs, /\.\/data\/token-shop-save-boundary\.json/);
assert.match(appJs, /\.\/data\/multiverse-market-save-boundary\.json/);
assert.match(appJs, /\.\/data\/token-bank-controller-shell\.json/);
assert.match(appJs, /Blocked inputs and unavailable planner actions/);
assert.match(appJs, /Emporium compatibility preview/);
assert.match(appJs, /compatibility-only Emporium import state under <code>\$\{escapeHtml\(preview\.importTargetPath\)\}<\/code>\. It preserves the checked raw <code>\$\{escapeHtml\(preview\.typedSpanLabel\)\}<\/code> span plus separate bounded trade-counter and early-mech quarantine ranges as non-canonical evidence only\./i);
assert.match(appJs, /wrapperOnlyFieldLabel\)\}<\/code> stays wrapper-only and is intentionally excluded from this preview/);
assert.match(appJs, /Imported trade-counter quarantine currently covers \${escapeHtml\(preview\.tradeCounterLabel\)\} with \${preview\.importedTradeCounterCount} recovered fields\./);
assert.match(appJs, /Imported early-mech quarantine currently covers \${escapeHtml\(preview\.earlyMechWindowLabel\)\} with \${preview\.importedEarlyMechCount} recovered fields\./);
assert.match(appJs, /Planner use stays blocked\. These imported levels, trade counters, and early-mech fields remain quarantined compatibility evidence/);
assert.match(appJs, /get_Market, Market, GetPlayerProfileData, FillPlayerProfileData, and the FillPlayerProfileData coroutine shell/);
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
assert.match(appJs, /A checked payload-watch boundary now keeps/);
assert.doesNotMatch(appJs, /Save-side separation/);
assert.doesNotMatch(appJs, /Shard owner trail stays separate from PlayerProfile save clues/);
assert.match(appJs, /Shard owner trail and PlayerProfileData save-family clues stay separate with zero overlap/);
assert.match(appJs, /\.\/data\/token-shop-cost-lanes\.json/);
assert.match(appJs, /\.\/data\/spend-action-lane-clues\.json/);
assert.match(appJs, /\.\/data\/token-shop-owner-shell\.json/);
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
assert.match(appJs, /The remaining grounded save-side search therefore stays on the broader PlayerProfileData and CloudSavePlayerProfile persistence-family boundary, not on TokenShop methods, BigStatisticPrefab\.TokenBankCap, or FinalTokenBank outputs/);
assert.match(appJs, /This is enough to narrow future recovery work, but not enough to identify the exact declaring save model or a narrower PlayerProfile-side wrapper path for token-bank state/);
assert.match(appJs, /function getMultiverseMarketSaveBoundarySummary/);
assert.match(appJs, /MultiverseMarket save boundary/);
assert.match(appJs, /MultiverseMarket action shell and PlayerProfileData save-family clues stay separate with zero overlap/);
assert.match(appJs, /MultiverseMarket canonical host narrowing/);
assert.match(appJs, /PlayerProfileHandler get_Market accessor bridge/);
assert.match(appJs, /get_BM, get_ZN, get_TU/);
assert.match(appJs, /broader progression-payload field cluster/);
assert.match(appJs, /metadata-only \$\{marketMemberSummary\.memberLabel\} shell stays unresolved as an exact typed field/);
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
assert.doesNotMatch(appJs, /Shard milestone mapping status/);
assert.match(appJs, /community-grounded descriptive data/);
assert.match(appJs, /Grounded shard anchors/);
assert.doesNotMatch(appJs, /Title source/);
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
assert.equal(pkg.scripts["contracts:gen-index"], "node ./scripts/contracts/generate-dataset-index.mjs");
assert.equal(pkg.scripts.dev, "node ./scripts/dev-server.mjs");
assert.equal(pkg.scripts["lint:docs"], "node ./scripts/contracts/lint-doc-portability.mjs");
assert.equal(pkg.scripts["probe:build"], "node ./scripts/unity/run_probe.mjs build");
assert.equal(pkg.scripts["verify:data"], "node ./scripts/contracts/validate-datasets.mjs");
assert.equal(pkg.scripts["verify:vendoring"], "node ./scripts/contracts/verify-vendoring-layout.mjs");
assert.equal(pkg.scripts["check:syntax"], "node ./scripts/contracts/check-js-syntax.mjs");
assert.equal(pkg.scripts.test, "node ./tests/smoke.mjs");
assert.equal(pkg.scripts["test:unit"], "node ./scripts/tests/run-unit-tests.mjs");
assert.match(probeRunner, /"build": \[/);
assert.match(probeRunner, /Probe artifact is stale:/);
assert.match(probeRunner, /npm run probe:build/);
assert.match(probeRunner, /dotnet", \["restore", probeProject\]/);
assert.match(probeRunner, /readdirSync\(probeSourceDir\)/);
assert.match(probeRunner, /\.NET 8 SDK was not found on PATH/);
assert.match(unityAuditPlaybook, /`npm run probe:build`/);
assert.match(unityAuditPlaybook, /fails fast and tells you to run `npm run probe:build`/);
assert.match(unityAuditPlaybook, /no longer silently reuses a stale cached build/);
assert.match(unityAuditPlaybook, /api\.nuget\.org/);
assert.deepEqual(await lintDocPortability(repoRoot), []);
const vendoringLayout = await verifyVendoringLayout(repoRoot);
assert.deepEqual(vendoringLayout.regressions, []);
assert.deepEqual(
  vendoringLayout.tolerated,
  [
    { path: ".deps", rule: "top-level .deps/ bucket", classification: "temporary" },
    { path: ".vendor_manual", rule: "top-level .vendor_*/ bucket", classification: "temporary" },
    { path: ".vendor_py", rule: "top-level .vendor_*/ bucket", classification: "temporary" },
    { path: ".wheelhouse", rule: "top-level cache bucket", classification: "temporary" }
  ]
);
assert.match(importMappingDoc, /compatibility-only fields/i);
const datasetContractsDoc = await readFile(new URL("../docs/contracts/dataset-contracts.md", import.meta.url), "utf8");
assert.equal(generatedDatasetIndex, datasetIndexGeneratedDoc);
assert.match(datasetIndexGeneratedDoc, /## Source priority/);
assert.match(datasetIndexGeneratedDoc, /### `snapshot`/);
assert.match(datasetIndexGeneratedDoc, /### `shard-cost-formula-model`/);
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
assert.match(datasetContractsDoc, /data\/shard-milestone-handoff-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-save-boundary\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-scene-monobehaviour-probe\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-cost-parameter-probe\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-cost-method-probe\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-cost-native-probe\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-cost-screenshot-calibration\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-cost-list-path-probe\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-cost-formula-model\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-bonus-slot-probe\.v1\.json/);
assert.match(datasetContractsDoc, /data\/shard-type-metadata-probe\.v1\.json/);
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
assert.match(datasetRefreshChecklistDoc, /Run `npm run check:syntax`/);
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
assert.match(readme, /docs\/tools\/ocr\.md/);
assert.match(readme, /npm run test:unit/);
assert.match(readme, /npm run check:syntax/);

await runBlockingCheck("launcher-mode lifecycle", verifyLauncherModeServerLifecycle);

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
assert.deepEqual(migratedLegacyProfile.planning.shards.observedLevelsByMilestone, { milestone_alpha: 12 });
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
assert.equal(migratedNestedProfile.externalModels.shipPlanner.communityToolState.technical.Meltdown, 12);
assert.equal(migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.toolName, "CiFi Ship Optimizer");
assert.equal(migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.toolVersion, "2026-04-06");
assert.equal(migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.sourceReference, "https://example.com/ship-optimizer");
assert.equal(migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.assumptionsSummary, "Community weights and provisional ship labels.");
assert.equal(migratedNestedProfile.externalModels.communityTools.shipOptimizer.v1.data.selectedShip, "Meltdown");
assert.equal(migratedNestedProfile.externalModels.communityTools.shardOptimizer.v1.data.targetRow, "omega_watch");
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

assert.deepEqual(migratedInvalidCommunityToolProfile.externalModels.communityTools.modTreeOptimizer, {});

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
assert.deepEqual(migratedUnmappedSystemsProfile.planning.shards.observedLevelsByMilestone, { omega_watch: 6 });
assert.deepEqual(migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.shardMilestoneState, {
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
});
assert.deepEqual(
  migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.shardMilestones,
  migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.shardMilestoneState
);
assert.deepEqual(migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.tokenShop, {
  tokenBoostLevel: 4
});
assert.deepEqual(migratedUnmappedSystemsProfile.compatibility.unmappedSystemState.multiverseMarket, {
  inscription51Level: 2
});
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
assert.deepEqual(migratedQuarantinedShardMilestoneProfile.planning.shards.observedLevelsByMilestone, {});
assert.equal(migratedQuarantinedShardMilestoneProfile.compatibility.unmappedSystemState.shardMilestoneState.mappingGate.plannerUseAllowed, false);
assert.equal(migratedQuarantinedShardMilestoneProfile.compatibility.unmappedSystemState.shardMilestoneState.mappingGate.canonicalPromotionBlocked, true);
assert.equal(
  migratedQuarantinedShardMilestoneProfile.compatibility.unmappedSystemState.shardMilestoneState.importedState.observedLevel,
  33
);

const migratedFlatSpendStateProfile = normalizePlayerProfile({
  ATU1Level: "3",
  ATU28Level: 1,
  Tier2TokensUnlocked: true,
  Tier4TokensUnlocked: false,
  TokenBankCap: "1200",
  ClaimableBankTokens: "450",
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

assert.deepEqual(migratedFlatSpendStateProfile.compatibility.unmappedSystemState.tokenShop, {
  ATU1Level: 3,
  ATU28Level: 1,
  Tier2TokensUnlocked: true,
  Tier4TokensUnlocked: false,
  TokenBankCap: 1200,
  ClaimableBankTokens: 450,
  FinalTokenBankFillSpeed: 1.25,
  DailyTokeniumCap: 2000
});
assert.deepEqual(migratedFlatSpendStateProfile.compatibility.unmappedSystemState.multiverseMarket, {
  InscryptionsDone: 98,
  IS1Level: 2,
  IS73Level: 4,
  EsotericR1Trades: 5,
  NecrumR9Trades: 6,
  Mech1Unlocked: true,
  FinalMech1MainBonus: 2500,
  Mech2Unlocked: false
});
assert.equal(migratedFlatSpendStateProfile.compatibility.unmappedSystemState.multiverseMarket.Mech2Units, undefined);
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
      recordSmokeFailure("ok", message, `received ${summarizeValue(value)}`);
    }
  };

  assert.equal = (actual, expected, message = "expected strict equality") => {
    if (!Object.is(actual, expected)) {
      recordSmokeFailure("equal", message, `expected ${summarizeValue(expected)}; received ${summarizeValue(actual)}`);
    }
  };

  assert.deepEqual = (actual, expected, message = "expected deep equality") => {
    if (!isDeepStrictEqual(actual, expected)) {
      recordSmokeFailure("deepEqual", message, summarizeDeepEqualityMismatch(actual, expected));
    }
  };

  assert.match = (actual, expected, message = `expected value to match ${String(expected)}`) => {
    if (!expected.test(String(actual))) {
      recordSmokeFailure("match", message, `pattern ${String(expected)}; actual preview ${summarizeText(actual)}`);
    }
  };

  assert.doesNotMatch = (actual, expected, message = `expected value not to match ${String(expected)}`) => {
    if (expected.test(String(actual))) {
      recordSmokeFailure("doesNotMatch", message, `pattern ${String(expected)} unexpectedly matched ${summarizeText(actual)}`);
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
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) {
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
      const nested = findFirstMismatch(actual[index], expected[index], `${path}[${index}]`, depth + 1);
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
  hardAssert.equal(clientOpen.ok, true);
  hardAssert.equal(clientOpen.launcherMode, true);

  const eventController = new AbortController();
  const eventStream = await fetch(`http://localhost:${testPort}/api/client/events?clientId=smoke-client`, {
    signal: eventController.signal
  });
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

  const clientClose = await postJson(`http://localhost:${testPort}/api/client/close`, { clientId: "smoke-client" });
  hardAssert.equal(clientClose.ok, true);
  eventController.abort();

  await waitForExit(serverProcess, 9000);
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
      console.warn(`Skipping node --check for ${targetFile} because child_process spawn is not permitted here.`);
      return;
    }
    throw error;
  }
}

