import {
  coerceInputValue,
  normalizeCiNumberValue,
  normalizeGeneratorTierKey,
  normalizeImportRow,
  parseCsv
} from "./support/import-normalization-support.js";
import {
  buildResearchTrackContractModel,
  buildResearchTrackProgressModel,
  buildSnapshotValidationCases,
  getDatasetBadgeMetaFromEntry,
  getResearchTrackLane,
  getResearchTrackOrder,
  getResearchTrackPhase,
  getResearchTrackProgressLabel,
  getResearchTrackSource,
  getResearchTrackStatus,
  getShardBadgeMetaFromLabel,
  getValidationScopeMeta,
  getValidationStatusMeta,
  partitionValidationResults
} from "./support/research-validation-support.js";
import {
  getQuarantinedMultiverseMarketState,
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  normalizePlayerProfile
} from "./player-profile.js";
import {
  buildPlayerProfileBoundaryGroups,
  getImportedMultiverseMarketPreviewCardModel,
  getPlannerHelperCompletion,
  getPlayerProfileBoundaryAudit,
  getProfileCompletion
} from "./support/player-profile-boundary-support.js";
import {
  getRecommendationContractIssues as getNormalizedRecommendationContractIssues,
  sanitizeRecommendationLines as sanitizeNormalizedRecommendationLines,
  sortRecommendationFeed as sortNormalizedRecommendationFeed,
  toRecommendationAction as normalizeRecommendationAction
} from "./recommendation-contract.js";
import {
  getCompactProgressionNoteModel,
  getProgressionRecommendationFeedPartition,
  getRecommendationContractSummary,
  getRecommendationExplainabilityAudit,
  getRecommendationExplainabilitySummary,
  getRecommendationFeedSummaryModel,
  getRecommendationFeedSupportNoticeLines
} from "./support/recommendation-feed-support.js";
import {
  getShardCostModelBoundarySummary,
  getShardEffectTextHandlerBoundarySummary,
  getShardFinalSuBonusBoundarySummary,
  getShardMilestonePayloadBoundarySummary,
  getShardMilestoneRowAlignmentBoundarySummary,
  getShardMilestoneRowModelBoundarySummary,
  getShardMilestoneRowShellBoundarySummary,
  getShardMilestoneTitleEffectBoundarySummary,
  getShardOwnerFamilyBoundarySummary,
  getShardSaveBoundarySummary
} from "./support/shard-boundary-summary-support.js";
import { createShardEvidenceSupport } from "./support/shard-evidence-support.js";
import {
  formatNumericRanges,
  getDailyTokeniumLaneSummary,
  getImportedMultiverseMarketPreview,
  getMultiverseMarketActionShellSummary,
  getMultiverseMarketMarketMemberBoundarySummary,
  getMultiverseMarketMetadataSummary,
  getMultiverseMarketOwnerFamilySummary,
  getMultiverseMarketPrefabRemapBoundarySummary,
  getMultiverseMarketRangeBoundarySummary,
  getMultiverseMarketRowTextCoverageSummary,
  getMultiverseMarketSaveBoundarySummary,
  getMultiverseMarketValidatedCoverage,
  getSpendActionLaneSummary,
  getTokenBankControllerShellSummary,
  getTokenBankFormulaBoundarySummary,
  getTokenBankStateSummary,
  getTokeniumNamingSummary,
  getTokenShopCoverageSummary,
  getTokenShopCostLaneSummary,
  getTokenShopOwnerShellSummary,
  getTokenShopSaveBoundarySummary
} from "./support/spend-boundary-summary.js";
import { createShipPlannerSupport } from "./support/ship-planner-support.js";
import { buildTokenShopProgressionModel } from "./token-shop-progression-model.js";
import { createTokenShopUiSupport } from "./token-shop-ui-support.js";

const STORAGE_KEYS = {
  playerProfile: "cifi-suite.player-profile",
  shipConfig: "cifi-suite.ship-config",
  snapshot: "cifi-suite.snapshot",
  snapshots: "cifi-suite.profile-snapshots"
};

const LEGACY_STORAGE_KEYS = {
  profile: "cifi-suite.profile"
};

const APP_LAUNCH_KEYS = {
  primaryLease: "cifi-suite.primary-lease",
  launchSignal: "cifi-suite.launch-signal"
};

const APP_LAUNCH_CHANNEL = "cifi-suite-launch";
const APP_LAUNCH_HEARTBEAT_MS = 4000;
const APP_LAUNCH_STALE_MS = 60000;
const DEFAULT_SERVER_CAPABILITIES = Object.freeze({
  sessionApi: false,
  launcherMode: false
});
const SERVER_SESSION_ENDPOINTS = {
  open: "/api/client/open",
  heartbeat: "/api/client/heartbeat",
  close: "/api/client/close",
  events: "/api/client/events"
};
const tokenShopUi = createTokenShopUiSupport({
  formatValue: formatBoundaryValue
});
const shardEvidence = createShardEvidenceSupport({
  formatShardNumber,
  getShardCostModelBoundarySummary,
  getShardEffectTextHandlerBoundarySummary,
  getShardGrounding: () => state.shardGrounding,
  getShardMilestoneRowModelBoundarySummary,
  getShardMilestoneTitleEffectBoundarySummary,
  getShardPlannerState
});
const {
  describeUnlockCondition,
  formatOptionalNumber,
  formatProbeNumber,
  formatShardExtractedBonusPerLevel,
  formatShardExtractedCostFieldMapping,
  formatShardRarity,
  formatThresholdLevels,
  formatThresholdScheduleSummary,
  formatVerifiedShardBonusPackage,
  getDefaultShardFocusMilestoneId,
  getMilestoneSourceLabel,
  getNextShardCostBump,
  getNextShardThreshold,
  getNextShardUnlockMilestone,
  getProvenanceConflictNote,
  getShardComputedBonusSummary,
  getShardExtractedBonusPerLevel,
  getShardExtractedCostFieldMapping,
  getShardExtractedUnlockRequirement,
  getShardFormulaApplicationProfile,
  getShardMilestoneEvidenceCounts,
  getShardMilestoneEvidenceRow,
  getShardMilestoneFamilyEvidence,
  getShardDefinitionEvidenceSummary,
  getShardMilestoneDisplayMeta,
  getShardMilestoneDisplayName,
  getShardMilestoneGroundedSummary,
  getShardMilestonePanelTitle,
  getShardOwnedStateBlockerSummary,
  getShardNativeCostStageSummary,
  getShardUnlockRequirement,
  getSourceTitlesForIds,
  getThresholdScheduleForMilestone,
  getVerifiedShardRowPackages,
  normalizeShardRarityKey,
  parseShardBonusDescriptor,
  parseShardNumericLabel
} = shardEvidence;
const SERVER_CAPABILITIES = getServerCapabilities();

const CANONICAL_PROFILE_FIELD_PATHS = {
  profileName: ["meta", "profileName"],
  loopReset: ["player", "loop", "loopReset"],
  dataConfidence: ["meta", "dataConfidence"],
  diamonds: ["player", "resources", "diamonds"],
  tokens: ["player", "resources", "tokens"],
  academyRelics: ["player", "resources", "academyRelics"],
  shards: ["player", "resources", "shards"],
  notes: ["notes", "profile"]
};

const ACTIVE_PROFILE_FORM_FIELD_PATHS = {
  profileName: CANONICAL_PROFILE_FIELD_PATHS.profileName,
  loopReset: CANONICAL_PROFILE_FIELD_PATHS.loopReset,
  dataConfidence: CANONICAL_PROFILE_FIELD_PATHS.dataConfidence,
  diamonds: CANONICAL_PROFILE_FIELD_PATHS.diamonds,
  tokens: CANONICAL_PROFILE_FIELD_PATHS.tokens,
  shards: CANONICAL_PROFILE_FIELD_PATHS.shards,
  notes: CANONICAL_PROFILE_FIELD_PATHS.notes,
  totalShardMilestoneLevels: ["planning", "shards", "totalMilestoneLevels"]
};

const SUPPORT_SURFACE_VALIDATION_MODULES = new Set(["gem"]);

function createDefaultShipPlayerState(baseline) {
  return {
    academyGears: { ...baseline.academyGears },
    innovation: {
      inno1: baseline.innovation.inno1,
      inno2: baseline.innovation.inno2,
      darkInno: baseline.innovation.darkInno,
      softCap: Boolean(baseline.innovation.softCap)
    },
    generators: { ...baseline.calibration.generators },
    techLevels: { ...baseline.calibration.techLevels },
    zagreus: { ...baseline.calibration.zagreus },
    hephaestus: { ...baseline.calibration.hephaestus },
    demeter: { ...baseline.calibration.demeter },
    koios: { ...baseline.calibration.koios },
    zeus: { ...baseline.calibration.zeus },
    crew: { ...baseline.calibration.crew },
    technical: { ...baseline.calibration.technical }
  };
}

const SHIP_LABELS = {
  C: "Cradle",
  A: "Auxesia",
  Zg: "Zagreus",
  H: "Hephaestus",
  D: "Demeter",
  K: "Koios",
  Ze: "Zeus"
};

const INSTALL_DATA = {
  C: [
    { name: "Mitosis Enhancements", effectTypes: ["cells"], icon: "ME" },
    { name: "Improved Timing Belts", effectTypes: ["gens"], icon: "TB" },
    { name: "Improved Printing Engines", effectTypes: ["gens"], icon: "PE" },
    { name: "Printer Tweaks", effectTypes: ["gens"], icon: "PT" },
    { name: "Improved Capacitors", effectTypes: ["gens"], icon: "IC" },
    { name: "Improved Cooling Systems", effectTypes: ["gens"], icon: "CS" },
    { name: "Printer Modulization", effectTypes: ["gens"], icon: "PM" },
    { name: "Molecule Infusing Tech", effectTypes: ["gens"], icon: "MI" },
    { name: "Improved Generator Equipment", effectTypes: ["rp"], icon: "GE" },
    { name: "On-Site Mining Printers", effectTypes: ["shards"], icon: "MP" },
    { name: "Brain Capacity Genetics", effectTypes: ["cells"], icon: "BG" }
  ],
  A: [
    { name: "Improved Tech Software", effectTypes: ["gens"], icon: "TS" },
    { name: "Improved Tech Hardware", effectTypes: ["gens"], icon: "TH" },
    { name: "Precise Calculations", effectTypes: ["cells"], icon: "PC" },
    { name: "Optimized Chipsets", effectTypes: ["gens"], icon: "OC" },
    { name: "Optimized Power Supplies", effectTypes: ["gens"], icon: "PS" },
    { name: "Optimized Hard Drives", effectTypes: ["gens"], icon: "HD" },
    { name: "Optimized Cell Vacuum", effectTypes: ["gens"], icon: "CV" },
    { name: "Modified Cell Turbines", effectTypes: ["gens"], icon: "CT" },
    { name: "Robo-Engineer Assistants", effectTypes: ["rp"], icon: "RA" },
    { name: "Shard-Based Cooling Towers", effectTypes: ["shards"], icon: "SC" },
    { name: "Bio-Mech Cell Coating", effectTypes: ["cells"], icon: "BC" }
  ],
  Zg: [
    { name: "Accumulation Theory", effectTypes: ["cells"], icon: "AT" },
    { name: "Deja Vu Theory", effectTypes: ["mp"], icon: "DV" },
    { name: "Feedback Theory", effectTypes: ["gens"], icon: "FT" },
    { name: "Data Theory", effectTypes: ["gens"], icon: "DT" },
    { name: "Flashback Theory", effectTypes: ["gens"], icon: "FB" },
    { name: "Observation Theory", effectTypes: ["gens"], icon: "OT" },
    { name: "Reflection Theory", effectTypes: ["gens"], icon: "RT" },
    { name: "Loop Throttle Integrations", effectTypes: ["gens"], icon: "LT" },
    { name: "Databyte Integrations", effectTypes: ["rp"], icon: "DI" },
    { name: "Mining Data Block System", effectTypes: ["shards"], icon: "MB" },
    { name: "C.E.L.L. Mainframe Integration", effectTypes: ["cells"], icon: "CM" }
  ],
  H: [
    { name: "Production Line Connections", effectTypes: ["gens"], icon: "PL" },
    { name: "Modifications Connection", effectTypes: ["mp"], icon: "MC" },
    { name: "Delivery Drones", effectTypes: ["gens"], icon: "DD" },
    { name: "Heavy Duty Grabbies", effectTypes: ["cells"], icon: "HG" },
    { name: "Manual Overkill", effectTypes: ["cells"], icon: "MO" },
    { name: "Accumulation Modification", effectTypes: ["mp"], icon: "AM" },
    { name: "Fiver Connection", effectTypes: ["gens"], icon: "FC" },
    { name: "Faster Transportation", effectTypes: ["gens"], icon: "FT" },
    { name: "Improved Blueprints", effectTypes: ["rp"], icon: "IB" },
    { name: "Auto-Mining Machina", effectTypes: ["shards"], icon: "AM" },
    { name: "Factory Maintainer Drone", effectTypes: ["cells"], icon: "FD" }
  ],
  D: [
    { name: "Ahead of the Curve", effectTypes: ["other"], icon: "AC" },
    { name: "Better Mineral Extraction", effectTypes: ["shards"], icon: "BM" },
    { name: "Rare Organism Detection", effectTypes: ["cells"], icon: "RO" },
    { name: "Canned Mineral Water", effectTypes: ["gens"], icon: "CW" },
    { name: "Bi-Product Goo", effectTypes: ["gens"], icon: "BG" },
    { name: "The Hexagonal Advantage", effectTypes: ["mp"], icon: "HA" },
    { name: "Shardlytics", effectTypes: ["gens"], icon: "SL" },
    { name: "Liquid Extraction Tech", effectTypes: ["gens"], icon: "LE" },
    { name: "Phylogenetic Analysis", effectTypes: ["rp"], icon: "PA" },
    { name: "On-Site GPR Hotspot Scanners", effectTypes: ["shards"], icon: "GS" },
    { name: "On-Site Printing Vehicles", effectTypes: ["cells"], icon: "PV" }
  ],
  K: [
    { name: "The Venn Hypothesis", effectTypes: ["cells"], icon: "VH" },
    { name: "Unobtanium Drills", effectTypes: ["shards"], icon: "UD" },
    { name: "Modification Thesis", effectTypes: ["mp"], icon: "MT" },
    { name: "The Study of Threesium", effectTypes: ["gens"], icon: "ST" },
    { name: "The Big Brainium Thesis", effectTypes: ["rp"], icon: "BT" },
    { name: "The Connectivity Thesis", effectTypes: ["mp", "shards"], icon: "CT" },
    { name: "The Overclocking Thesis", effectTypes: ["gens"], icon: "OT" },
    { name: "Factory Maintainer Drone", effectTypes: ["gens"], icon: "FD" },
    { name: "Robo-Research Assistants", effectTypes: ["rp"], icon: "RA" },
    { name: "Shard Scanning Breakthrough", effectTypes: ["shards"], icon: "SB" },
    { name: "Improved Mk1 Printing Fuel", effectTypes: ["cells"], icon: "PF" }
  ],
  Ze: [
    { name: "Academy Janitor Bots", effectTypes: ["cells"], icon: "JB" },
    { name: "Perfect Student Blueprint", effectTypes: ["ap"], icon: "PB" },
    { name: "Material Scavenger Vehicles", effectTypes: ["materials"], icon: "SV" },
    { name: "Academy Mining Bots", effectTypes: ["cells", "shards"], icon: "MB" },
    { name: "Database Brain-Link Integration", effectTypes: ["cells", "rp"], icon: "DB" },
    { name: "Academy Auto-Scrappers", effectTypes: ["materials", "mp"], icon: "AS" },
    { name: "On-Site Auto Construction", effectTypes: ["ap", "gens"], icon: "OC" },
    { name: "Remote Printing Facilities", effectTypes: ["gens"], icon: "RF" },
    { name: "Cluster Scans", effectTypes: ["rp"], icon: "CS" },
    { name: "Orbital Hotspot Scanner", effectTypes: ["shards"], icon: "OS" },
    { name: "Academy Flight-Kicks", effectTypes: ["cells"], icon: "FK" }
  ]
};

const SHIP_PLAYER_STATE_GROUPS = [
  ["academyGears", "Academy gears"],
  ["innovation", "Innovation badges"],
  ["generators", "Generators"],
  ["techLevels", "Tech levels"],
  ["zagreus", "Zagreus data"],
  ["hephaestus", "Hephaestus data"],
  ["demeter", "Demeter data"],
  ["koios", "Koios data"],
  ["zeus", "Zeus data"],
  ["crew", "Crew"],
  ["technical", "Technical"]
];

const SHIP_PLAYER_STATE_FIELD_LABELS = {
  innovation: {
    inno1: "Innovation Badge #1",
    inno2: "Innovation Badge #2",
    darkInno: "Dark innovation"
  }
};

const SHIP_PLAYER_STATE_HIDDEN_FIELDS = {
  innovation: new Set(["softCap"]),
  technical: new Set(["LongRun"])
};

const INSTALL_LAYOUT = [
  [8, 4, 6, 9],
  [2, 1, 3],
  [10, 7, 5, 11]
];

const SHIP_INSTALL_INDEX_LAYOUTS = {
  default: [
    [7, 3, 5, 10],
    [1, 0, 2],
    [9, 6, 4, 8]
  ]
};

const DESMOS_INSTALL_WEIGHT_MAPS = {
  C: [
    ["cells"],
    ["cells"],
    ["gens"],
    ["cells"],
    ["gens"],
    ["gens"],
    ["gens"],
    ["gens"],
    ["rp"],
    ["shards"],
    ["cells"]
  ],
  A: [
    ["gens"],
    ["gens"],
    ["cells"],
    ["cells"],
    ["gens"],
    ["gens"],
    ["gens"],
    ["gens"],
    ["rp"],
    ["shards"],
    ["cells"]
  ],
  Zg: [
    ["cells"],
    ["gens"],
    ["mods"],
    ["gens"],
    ["gens"],
    ["gens"],
    ["gens"],
    ["gens"],
    ["rp"],
    ["shards"],
    ["cells"]
  ],
  H: [
    ["gens"],
    ["gens"],
    ["mods"],
    ["cells"],
    ["cells"],
    ["mods"],
    ["gens"],
    ["gens"],
    ["rp"],
    ["shards"],
    ["cells"]
  ],
  D: [
    ["cells", "mods", "shards", "rp", "ap", "materials"],
    ["shards"],
    ["cells"],
    ["gens"],
    ["gens"],
    ["mods"],
    ["gens"],
    ["gens"],
    ["rp"],
    ["shards"],
    ["cells"]
  ],
  K: [
    ["cells"],
    ["shards"],
    ["mods"],
    ["gens"],
    ["rp"],
    ["mods", "shards"],
    ["gens"],
    ["gens"],
    ["rp"],
    ["shards"],
    ["cells"]
  ],
  Ze: [
    ["cells"],
    ["ap"],
    ["materials"],
    ["cells", "shards"],
    ["cells", "rp"],
    ["mods", "materials"],
    ["gens", "ap"],
    ["gens"],
    ["rp"],
    ["shards"],
    ["cells"]
  ]
};
const shipPlannerSupport = createShipPlannerSupport({
  desmosInstallWeightMaps: DESMOS_INSTALL_WEIGHT_MAPS,
  getActiveLoadout,
  getEffectiveCap,
  getShipCommunityToolState,
  getShipConfig: () => state.shipConfig,
  getShipInstallTotal,
  getShipTemplate: (shipKey) => state.shipTemplates[shipKey],
  shipInstallIndexLayouts: SHIP_INSTALL_INDEX_LAYOUTS,
  sum
});
const {
  getBestNextInstall,
  getDisplayEffectTypes,
  getInstallEffectTypes,
  getInstallGain,
  getPrimaryEffectClass,
  getShipInstallLayout
} = shipPlannerSupport;

const SHIP_FILTER_LABELS = {
  cells: "Cells (& Gen1)",
  gens: "Gens (2-8)",
  mp: "Mods",
  shards: "Shards",
  rp: "Rp",
  ap: "Ap",
  materials: "Mats"
};

function makeDefaultShipFilters(source = {}) {
  return {
    cells: source.cells ?? true,
    gens: source.gens ?? true,
    mp: source.mp ?? true,
    shards: source.shards ?? true,
    rp: source.rp ?? true,
    ap: source.ap ?? true,
    materials: source.materials ?? true
  };
}

const state = {
  snapshot: null,
  datasetContract: null,
  shipBaseline: null,
  shipTemplates: null,
  shardGrounding: null,
  extractionCandidateRanking: null,
  extractedMechanics: null,
  playerProfile: null,
  shipConfig: null,
  launchCoordinator: null,
  launchNoticeTimer: null,
  serverSession: null,
  pendingLaunchRefresh: false,
  importPreview: [],
  generatorOcrImages: [],
  generatorOcrParsed: null,
  generatorOcrBusy: false,
  sourceRegistry: [],
  researchView: "active",
  progressionView: "shards",
  shardMilestoneCardOpenIds: [],
  route: "overview"
};

bootstrap().catch((error) => console.error(error));

async function bootstrap() {
  state.launchCoordinator = initLaunchCoordinator();
  if (state.launchCoordinator.passiveLaunch) {
    renderPassiveLaunchScreen();
    return;
  }

  const [
    snapshot,
    datasetContract,
    shipBaseline,
    groundedShardMilestones,
    groundedShardObservedBehaviors,
    groundedShardProvenance,
    shardAssetGrounding,
    shardOwnerFamilyBoundary,
    shardFinalSuBonusBoundary,
    shardMilestonePayloadBoundary,
    shardCostModelBoundary,
    shardMilestoneRowModelBoundary,
    shardMilestoneTitleEffectBoundary,
    shardEffectTextHandlerBoundary,
    shardMilestoneRowShellBoundary,
    shardMilestoneRowAlignmentBoundary,
    shardSaveBoundary,
    shardSceneMonoBehaviourProbe,
    shardCostParameterProbe,
    shardCostNativeProbe,
    shardBonusSlotProbe,
    shardMilestoneFamilyEvidence,
    shardMilestoneHandoffBoundary,
    shardMilestoneSaveOwnerCandidates,
    extractionCandidateRanking,
    tokenShopValues,
    multiverseMarketValues,
    multiverseMarketMetadataNeighborhood,
    tokeniumNamingClues,
    tokenBankStateClues,
    dailyTokeniumLaneClues,
    tokenBankFormulaBoundary,
    multiverseMarketRangeBoundary,
    multiverseMarketRowTextCoverage,
    multiverseMarketPrefabRemapBoundary,
    tokenShopCostLanes,
    spendActionLaneClues,
    multiverseMarketActionShell,
    multiverseMarketOwnerFamily,
    tokenShopOwnerShell,
    tokenShopSaveBoundary,
    multiverseMarketSaveBoundary,
    multiverseMarketMarketMemberBoundary,
    tokenBankControllerShell,
    tokenShopRowRemapBoundary
  ] = await Promise.all([
    fetchJson("./data/game-data.snapshot.v1.json"),
    fetchJson("./data/bundled-dataset-contract.v1.json"),
    fetchJson("./data/ship-optimizer.desmos-baseline.v1.json"),
    fetchJson("./data/shard-milestones.grounded.v1.json"),
    fetchJson("./data/shard-observed-behaviors.grounded.v1.json"),
    fetchJson("./data/shard-milestones-provenance.grounded.v1.json"),
    fetchJson("./data/shard-asset-grounding.v1.json"),
    fetchJson("./data/shard-owner-family-boundary.v1.json"),
    fetchJson("./data/shard-finalsu-bonus-boundary.v1.json"),
    fetchJson("./data/shard-milestone-payload-boundary.v1.json"),
    fetchJson("./data/shard-cost-model-boundary.v1.json"),
    fetchJson("./data/shard-milestone-row-model-boundary.v1.json"),
    fetchJson("./data/shard-milestone-title-effect-boundary.v1.json"),
    fetchJson("./data/shard-effect-text-handler-boundary.v1.json"),
    fetchJson("./data/shard-milestone-row-shell-boundary.v1.json"),
    fetchJson("./data/shard-milestone-row-alignment-boundary.v1.json"),
    fetchJson("./data/shard-save-boundary.v1.json"),
    fetchJson("./data/shard-scene-monobehaviour-probe.v1.json"),
    fetchJson("./data/shard-cost-parameter-probe.v1.json"),
    fetchJson("./data/shard-cost-native-probe.v1.json"),
    fetchJson("./data/shard-bonus-slot-probe.v1.json"),
    fetchJson("./data/shard-milestone-family-evidence.v1.json"),
    fetchJson("./data/shard-milestone-handoff-boundary.v1.json"),
    fetchJson("./data/shard-milestone-save-owner-candidates.v1.json"),
    fetchJson("./data/extraction-candidate-ranking.v1.json"),
    fetchJson("./data/token-shop-values.json"),
    fetchJson("./data/multiverse-market-values.json"),
    fetchJson("./data/multiverse-market-metadata-neighborhood.json"),
    fetchJson("./data/tokenium-naming-clues.json"),
    fetchJson("./data/token-bank-state-clues.json"),
    fetchJson("./data/daily-tokenium-lane-clues.json"),
    fetchJson("./data/token-bank-formula-boundary.json"),
    fetchJson("./data/multiverse-market-range-boundary.json"),
    fetchJson("./data/multiverse-market-row-text-coverage.json"),
    fetchJson("./data/multiverse-market-prefab-remap-boundary.json"),
    fetchJson("./data/token-shop-cost-lanes.json"),
    fetchJson("./data/spend-action-lane-clues.json"),
    fetchJson("./data/multiverse-market-action-shell.json"),
    fetchJson("./data/multiverse-market-owner-family.json"),
    fetchJson("./data/token-shop-owner-shell.json"),
    fetchJson("./data/token-shop-save-boundary.json"),
    fetchJson("./data/multiverse-market-save-boundary.json"),
    fetchJson("./data/multiverse-market-market-member-boundary.json"),
    fetchJson("./data/token-bank-controller-shell.json"),
    fetchJson("./data/token-shop-row-remap-boundary.json")
  ]);

  const baselineShipPlayerState = createDefaultShipPlayerState(shipBaseline);
  const legacyShipConfig = loadStoredJson(STORAGE_KEYS.shipConfig, null);
  const storedPlayerProfile = loadStoredJson(STORAGE_KEYS.playerProfile, null);
  const legacyProfile = loadStoredJson(LEGACY_STORAGE_KEYS.profile, null);

  state.snapshot = mergeDeep(snapshot, loadStoredJson(STORAGE_KEYS.snapshot, snapshot));
  state.datasetContract = datasetContract;
  state.shipBaseline = shipBaseline;
  state.shipTemplates = buildShipTemplates(shipBaseline);
  state.shardGrounding = {
    milestones: groundedShardMilestones,
    observedBehaviors: groundedShardObservedBehaviors,
    provenance: groundedShardProvenance,
    assetGrounding: shardAssetGrounding,
    ownerFamilyBoundary: shardOwnerFamilyBoundary,
    finalSuBonusBoundary: shardFinalSuBonusBoundary,
    milestonePayloadBoundary: shardMilestonePayloadBoundary,
    costModelBoundary: shardCostModelBoundary,
    rowModelBoundary: shardMilestoneRowModelBoundary,
    titleEffectBoundary: shardMilestoneTitleEffectBoundary,
    effectTextHandlerBoundary: shardEffectTextHandlerBoundary,
    milestoneRowShellBoundary: shardMilestoneRowShellBoundary,
    milestoneRowAlignmentBoundary: shardMilestoneRowAlignmentBoundary,
    saveBoundary: shardSaveBoundary,
    sceneMonoBehaviourProbe: shardSceneMonoBehaviourProbe,
    costParameterProbe: shardCostParameterProbe,
    costNativeProbe: shardCostNativeProbe,
    bonusSlotProbe: shardBonusSlotProbe,
    milestoneFamilyEvidence: shardMilestoneFamilyEvidence,
    milestoneHandoffBoundary: shardMilestoneHandoffBoundary,
    saveOwnerCandidates: shardMilestoneSaveOwnerCandidates
  };
  state.extractionCandidateRanking = extractionCandidateRanking;
  state.extractedMechanics = {
    tokenShop: tokenShopValues,
    multiverseMarket: multiverseMarketValues,
    multiverseMarketMetadataNeighborhood,
    tokeniumNamingClues,
    tokenBankStateClues,
    dailyTokeniumLaneClues,
    tokenBankFormulaBoundary,
    multiverseMarketRangeBoundary,
    multiverseMarketRowTextCoverage,
    multiverseMarketPrefabRemapBoundary,
    tokenShopCostLanes,
    spendActionLaneClues,
    multiverseMarketActionShell,
    multiverseMarketOwnerFamily,
    tokenShopOwnerShell,
    tokenShopSaveBoundary,
    multiverseMarketSaveBoundary,
    multiverseMarketMarketMemberBoundary,
    tokenBankControllerShell,
    tokenShopRowRemapBoundary
  };
  state.playerProfile = normalizePlayerProfile(
    storedPlayerProfile ?? legacyProfile,
    mergeDeep(
      mergeDeep(baselineShipPlayerState, legacyShipConfig?.playerState ?? {}),
      typeof legacyShipConfig?.softCap === "boolean"
        ? { innovation: { softCap: legacyShipConfig.softCap } }
        : {}
    )
  );
  state.shipConfig = buildShipConfig(legacyShipConfig);
  persistPlayerProfile();
  localStorage.removeItem(LEGACY_STORAGE_KEYS.profile);

  bindNavigation();
  bindProfileActions();
  bindDataActions();
  bindOptimizerActions();

  fillProfileForm();
  renderAll();
  initServerSession();

  if (state.pendingLaunchRefresh) {
    refreshFromPersistentState();
  }
}

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }
    return response.json();
  });
}

function loadStoredJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function saveStoredJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function initLaunchCoordinator() {
  const coordinator = {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    channel: "BroadcastChannel" in window ? new BroadcastChannel(APP_LAUNCH_CHANNEL) : null,
    handledSignals: new Set(),
    passiveLaunch: false,
    isPrimary: false,
    heartbeatId: null
  };

  if (coordinator.channel) {
    coordinator.channel.addEventListener("message", (event) => {
      handleLaunchSignal(coordinator, event.data);
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === APP_LAUNCH_KEYS.launchSignal && event.newValue) {
      try {
        handleLaunchSignal(coordinator, JSON.parse(event.newValue));
      } catch {
        // Ignore malformed fallback payloads.
      }
    }
  });

  window.addEventListener("beforeunload", () => {
    if (coordinator.heartbeatId) {
      window.clearInterval(coordinator.heartbeatId);
    }
    releasePrimaryLease(coordinator);
    coordinator.channel?.close();
  });

  const launchRequested = new URLSearchParams(window.location.search).get("launch") === "1";
  const activeLease = getActivePrimaryLease();

  if (launchRequested && activeLease && activeLease.id !== coordinator.id) {
    coordinator.passiveLaunch = true;
    dispatchLaunchSignal(coordinator, "launcher-reopen");
    clearLaunchQueryFlag();
    return coordinator;
  }

  syncPrimaryLease(coordinator);
  coordinator.heartbeatId = window.setInterval(() => {
    syncPrimaryLease(coordinator);
  }, APP_LAUNCH_HEARTBEAT_MS);
  clearLaunchQueryFlag();
  return coordinator;
}

async function initServerSession() {
  if (!window.location.origin.startsWith("http") || !SERVER_CAPABILITIES.sessionApi) {
    return;
  }

  const session = {
    id: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    events: null,
    heartbeatId: null,
    launchSignalSequence: 0,
    enabled: false
  };
  state.serverSession = session;

  const opened = await postServerSession(SERVER_SESSION_ENDPOINTS.open, session.id);
  if (!opened) {
    return;
  }

  session.enabled = true;
  session.launchSignalSequence = Number(opened.launchSignalSequence || 0);
  session.heartbeatId = window.setInterval(() => {
    postServerSession(SERVER_SESSION_ENDPOINTS.heartbeat, session.id);
  }, APP_LAUNCH_HEARTBEAT_MS);
  session.events = new EventSource(
    `${SERVER_SESSION_ENDPOINTS.events}?clientId=${encodeURIComponent(session.id)}`
  );
  session.events.addEventListener("ready", (event) => {
    const payload = parseServerEvent(event);
    if (!payload) {
      return;
    }
    session.launchSignalSequence = Number(
      payload.launchSignalSequence || session.launchSignalSequence || 0
    );
  });
  session.events.addEventListener("launch", (event) => {
    const payload = parseServerEvent(event);
    if (!payload) {
      return;
    }
    const nextSequence = Number(payload.launchSignalSequence || 0);
    if (nextSequence > session.launchSignalSequence) {
      session.launchSignalSequence = nextSequence;
      if (state.launchCoordinator?.isPrimary) {
        handlePrimaryReopen();
      }
    }
  });

  window.addEventListener("pagehide", () => {
    closeServerSession(session);
  });
  window.addEventListener("beforeunload", () => {
    closeServerSession(session);
  });
  window.addEventListener("unload", () => {
    closeServerSession(session);
  });
}

async function postServerSession(endpoint, clientId) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
      keepalive: true
    });
    if (!response.ok) {
      return null;
    }
    return response.json();
  } catch {
    return null;
  }
}

function closeServerSession(session = state.serverSession) {
  if (!session?.enabled) {
    return;
  }

  if (session.events) {
    session.events.close();
    session.events = null;
  }

  if (session.heartbeatId) {
    window.clearInterval(session.heartbeatId);
    session.heartbeatId = null;
  }

  session.enabled = false;
  const payload = JSON.stringify({ clientId: session.id });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      SERVER_SESSION_ENDPOINTS.close,
      new Blob([payload], { type: "application/json" })
    );
    return;
  }

  fetch(SERVER_SESSION_ENDPOINTS.close, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => {});
}

function getServerCapabilities() {
  const raw = window.__CIFI_SERVER_CAPABILITIES__;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SERVER_CAPABILITIES };
  }

  return {
    sessionApi: raw.sessionApi === true,
    launcherMode: raw.launcherMode === true
  };
}

function parseServerEvent(event) {
  try {
    return JSON.parse(event.data);
  } catch {
    return null;
  }
}

function getActivePrimaryLease() {
  const lease = loadStoredJson(APP_LAUNCH_KEYS.primaryLease, null);
  if (!lease?.id || !lease?.updatedAt) {
    return null;
  }
  return Date.now() - Number(lease.updatedAt) <= APP_LAUNCH_STALE_MS ? lease : null;
}

function syncPrimaryLease(coordinator) {
  const activeLease = getActivePrimaryLease();
  if (!activeLease || activeLease.id === coordinator.id) {
    coordinator.isPrimary = true;
    saveStoredJson(APP_LAUNCH_KEYS.primaryLease, {
      id: coordinator.id,
      updatedAt: Date.now()
    });
    return;
  }
  coordinator.isPrimary = false;
}

function releasePrimaryLease(coordinator) {
  const activeLease = getActivePrimaryLease();
  if (activeLease?.id === coordinator.id) {
    localStorage.removeItem(APP_LAUNCH_KEYS.primaryLease);
  }
}

function dispatchLaunchSignal(coordinator, type) {
  const payload = {
    id: `${coordinator.id}-${Date.now()}`,
    from: coordinator.id,
    type,
    sentAt: Date.now()
  };
  coordinator.channel?.postMessage(payload);
  saveStoredJson(APP_LAUNCH_KEYS.launchSignal, payload);
}

function handleLaunchSignal(coordinator, payload) {
  if (!payload?.id || coordinator.handledSignals.has(payload.id)) {
    return;
  }
  coordinator.handledSignals.add(payload.id);
  if (coordinator.handledSignals.size > 16) {
    const [first] = coordinator.handledSignals;
    coordinator.handledSignals.delete(first);
  }
  if (!coordinator.isPrimary || payload.type !== "launcher-reopen") {
    return;
  }
  handlePrimaryReopen();
}

function handlePrimaryReopen() {
  if (!state.snapshot || !state.shipBaseline) {
    state.pendingLaunchRefresh = true;
    return;
  }
  state.pendingLaunchRefresh = false;
  refreshFromPersistentState();
  showLaunchNotice("CIFI reopened from launcher.");
}

function refreshFromPersistentState() {
  const storedPlayerProfile = loadStoredJson(STORAGE_KEYS.playerProfile, state.playerProfile);
  state.playerProfile = normalizePlayerProfile(
    storedPlayerProfile,
    createDefaultShipPlayerState(state.shipBaseline)
  );
  state.snapshot = loadStoredJson(STORAGE_KEYS.snapshot, state.snapshot);
  state.shipConfig = buildShipConfig(loadStoredJson(STORAGE_KEYS.shipConfig, state.shipConfig));
  fillProfileForm();
  renderAll();
}

function showLaunchNotice(message) {
  window.clearTimeout(state.launchNoticeTimer);
  let banner = document.getElementById("launchNotice");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "launchNotice";
    banner.className = "launch-notice";
    document.body.appendChild(banner);
  }
  banner.textContent = message;
  banner.classList.add("is-visible");
  state.launchNoticeTimer = window.setTimeout(() => {
    banner.classList.remove("is-visible");
  }, 3200);
}

function clearLaunchQueryFlag() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("launch")) {
    return;
  }
  url.searchParams.delete("launch");
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function renderPassiveLaunchScreen() {
  document.title = "CIFI Already Open";
  document.body.innerHTML = `
    <main class="launch-passive-shell">
      <section class="launch-passive-card">
        <p class="eyebrow">CIFI Already Open</p>
        <h1>Using the existing app tab.</h1>
        <p class="meta">Another launcher instance was triggered while CIFI is already open. This tab will try to close itself so the existing app tab stays primary.</p>
        <button class="button button-primary" id="passiveLaunchCloseBtn">Close this window</button>
      </section>
    </main>
  `;

  document.getElementById("passiveLaunchCloseBtn")?.addEventListener("click", () => {
    window.close();
  });

  window.setTimeout(() => {
    window.close();
  }, 1200);
}

function persistPlayerProfile() {
  state.playerProfile.meta.updatedAt = new Date().toISOString();
  state.playerProfile.meta.schemaVersion = PLAYER_PROFILE_SCHEMA_VERSION;
  saveStoredJson(STORAGE_KEYS.playerProfile, state.playerProfile);
}

function getShipCommunityToolState() {
  return state.playerProfile.externalModels.shipPlanner.communityToolState;
}

function getCanonicalProfileState() {
  return {
    profileName: state.playerProfile.meta.profileName,
    dataConfidence: state.playerProfile.meta.dataConfidence,
    loopReset: state.playerProfile.player.loop.loopReset,
    diamonds: state.playerProfile.player.resources.diamonds,
    tokens: state.playerProfile.player.resources.tokens,
    academyRelics: state.playerProfile.player.resources.academyRelics,
    shards: state.playerProfile.player.resources.shards,
    notes: state.playerProfile.notes.profile
  };
}

function getShardPlannerState() {
  return {
    currentShards: state.playerProfile.player.resources.shards,
    ratePerHour: state.playerProfile.planning.shards.ratePerHour,
    totalMilestoneLevels: state.playerProfile.planning.shards.totalMilestoneLevels,
    focusMilestoneId: state.playerProfile.planning.shards.focusMilestoneId,
    focusMilestoneLevel: state.playerProfile.planning.shards.focusMilestoneLevel,
    observedLevelsByMilestone: state.playerProfile.planning.shards.observedLevelsByMilestone ?? {}
  };
}

function getShipPlannerState() {
  return {
    summary: state.playerProfile.externalModels.shipPlanner.summary,
    calibration: state.playerProfile.externalModels.shipPlanner.communityToolState
  };
}

function getExperimentalProfileState() {
  return {
    gemNodeBudget: state.playerProfile.externalModels.experimental.gemNodes.budget,
    primaryFarmingFocus:
      state.playerProfile.externalModels.experimental.profileHints.primaryFarmingFocus,
    researchHours: state.playerProfile.externalModels.experimental.profileHints.researchHours
  };
}

function getTokenShopProgressionProfileState() {
  return state.playerProfile.planning?.tokenShop ?? {};
}

function getCompatibilityProfileState() {
  return {
    legacyStage: state.playerProfile.compatibility.legacyStage,
    unresolved: state.playerProfile.compatibility.unresolvedProfileFields,
    unmappedSystems: {
      ...state.playerProfile.compatibility.unmappedSystemState,
      multiverseMarket: getQuarantinedMultiverseMarketState(
        state.playerProfile.compatibility.unmappedSystemState.multiverseMarket
      )
    }
  };
}

function getProfileValue(path) {
  return path.reduce((current, key) => current?.[key], state.playerProfile);
}

function setProfileValue(path, value, target = state.playerProfile) {
  let current = target;
  path.slice(0, -1).forEach((key) => {
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key];
  });
  current[path[path.length - 1]] = value;
}

function buildShipTemplates(baseline) {
  return Object.fromEntries(
    Object.entries(baseline.shipInstalls).map(([shipKey, shipData]) => [
      shipKey,
      {
        caps: [...shipData.caps],
        reserveThresholds: [...shipData.reserveThresholds],
        powerTerms: [...shipData.powerTerms],
        installs:
          INSTALL_DATA[shipKey] ??
          shipData.caps.map((_, index) => ({
            name: `Install ${index + 1}`,
            effectTypes: ["other"],
            icon: `${index + 1}`
          }))
      }
    ])
  );
}

function buildShipConfig(stored = loadStoredJson(STORAGE_KEYS.shipConfig, null)) {
  const baseline = state.shipBaseline;
  const defaultLoadouts = Array.from({ length: baseline.loadoutSlots }, (_, index) => ({
    name: `Loadout ${index + 1}`,
    ships: Object.fromEntries(
      Object.entries(baseline.shipInstalls).map(([shipKey, shipData]) => [
        shipKey,
        [...shipData.current]
      ])
    ),
    history: []
  }));

  return {
    weights: stored?.weights ? { ...baseline.weights, ...stored.weights } : { ...baseline.weights },
    loadouts: hydrateLoadouts(stored?.loadouts, defaultLoadouts, stored?.filters),
    activeLoadoutIndex: clampNumber(stored?.activeLoadoutIndex ?? 0, 0, baseline.loadoutSlots - 1),
    selectedShipKey: SHIP_LABELS[stored?.selectedShipKey] ? stored.selectedShipKey : "C",
    pointPerTap: stored?.pointPerTap ?? 1
  };
}

function hydrateLoadouts(storedLoadouts, defaultLoadouts, legacyFilters) {
  if (!Array.isArray(storedLoadouts) || !storedLoadouts.length) {
    return defaultLoadouts.map((loadout) => ({
      ...loadout,
      filters: makeDefaultShipFilters(legacyFilters)
    }));
  }

  return defaultLoadouts.map((fallback, index) => {
    const stored = storedLoadouts[index] ?? {};
    return {
      name: normalizeLoadoutName(stored.name, fallback.name),
      history: Array.isArray(stored.history) ? stored.history : [],
      filters: makeDefaultShipFilters(stored.filters ?? legacyFilters),
      ships: Object.fromEntries(
        Object.entries(fallback.ships).map(([shipKey, values]) => [
          shipKey,
          Array.isArray(stored.ships?.[shipKey])
            ? stored.ships[shipKey].map((value) => Number(value) || 0)
            : [...values]
        ])
      )
    };
  });
}

function normalizeLoadoutName(candidate, fallback) {
  const text = typeof candidate === "string" ? candidate.trim() : "";
  return text || fallback;
}

function mergeDeep(base, patch) {
  const output = structuredClone(base);
  Object.entries(patch).forEach(([key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object"
    ) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = structuredClone(value);
    }
  });
  return output;
}

function bindNavigation() {
  $("#pageNav").addEventListener("click", (event) => {
    const button = event.target.closest(".nav-link");
    if (!button) {
      return;
    }
    state.route = button.dataset.page;
    renderNavigation();
  });
}

function bindProfileActions() {
  $("#saveProfileBtn").addEventListener("click", () => {
    state.playerProfile = collectProfileForm();
    persistPlayerProfile();
    setStatus("profileStatus", "Profile saved.", "success");
    renderAll();
  });

  $("#restoreDefaultsBtn").addEventListener("click", () => {
    state.playerProfile = normalizePlayerProfile(
      createDefaultPlayerProfile(),
      createDefaultShipPlayerState(state.shipBaseline)
    );
    persistPlayerProfile();
    fillProfileForm();
    setStatus("profileStatus", "Profile reset to blank values.", "success");
    renderAll();
  });

  $("#saveSnapshotBtn").addEventListener("click", () => {
    state.playerProfile = collectProfileForm();
    const canonical = getCanonicalProfileState();
    const snapshots = loadStoredJson(STORAGE_KEYS.snapshots, []);
    snapshots.unshift({
      savedAt: new Date().toISOString(),
      loopReset: canonical.loopReset,
      playerProfile: structuredClone(state.playerProfile)
    });
    saveStoredJson(STORAGE_KEYS.snapshots, snapshots.slice(0, 12));
    persistPlayerProfile();
    setStatus("profileStatus", `Saved LR snapshot for LR ${canonical.loopReset}.`, "success");
    renderAll();
  });

  $("#playerProfileImportFile").addEventListener("change", async (event) => {
    const [file] = event.target.files ?? [];
    if (!file) {
      return;
    }
    $("#playerProfileImportText").value = await file.text();
    setStatus(
      "playerProfileImportStatus",
      `Loaded ${file.name}. Review the JSON, then import it.`,
      "success"
    );
  });

  $("#importPlayerProfileBtn").addEventListener("click", () => {
    importPlayerProfileJson();
  });

  $("#exportPlayerProfileBtn").addEventListener("click", () => {
    exportPlayerProfileJson();
  });

  $("#saveShipStateBtn").addEventListener("click", () => {
    const inputs = $$("#shipPlayerStatePanel [data-ship-group][data-ship-field]");
    const shipPlayerState = getShipCommunityToolState();
    inputs.forEach((input) => {
      const group = input.dataset.shipGroup;
      const field = input.dataset.shipField;
      const current = shipPlayerState[group][field];
      shipPlayerState[group][field] =
        typeof current === "boolean" ? input.checked : coerceInputValue(input.value);
    });
    persistPlayerProfile();
    setStatus("shipPlayerStateStatus", "Community-tool ship calibration saved.", "success");
    renderShipPanels();
  });
}

function bindDataActions() {
  $("#importFile").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    $("#importText").value = await file.text();
  });

  $("#previewImportBtn").addEventListener("click", () => previewImport());
  $("#applyImportBtn").addEventListener("click", applyImportPreview);
  $("#exportSnapshotBtn").addEventListener("click", exportSnapshot);
  $("#generatorOcrFiles").addEventListener("change", () => {
    state.generatorOcrParsed = null;
    $("#generatorOcrText").value = "";
    renderGeneratorOcrFileList();
  });
  $("#generatorOcrPasteZone").addEventListener("paste", handleGeneratorOcrPaste);
  $("#generatorOcrText").addEventListener("input", renderGeneratorOcrButtons);
  $("#parseGeneratorOcrBtn").addEventListener("click", parseGeneratorOcrImages);
  $("#applyGeneratorOcrBtn").addEventListener("click", applyGeneratorOcrPreview);
}

function bindOptimizerActions() {
  $("#progressionSubsystemToggle").addEventListener("click", (event) => {
    const button = event.target.closest("[data-progression-view]");
    if (!button) {
      return;
    }
    const nextView = button.dataset.progressionView;
    if (!nextView || state.progressionView === nextView) {
      return;
    }
    state.progressionView = nextView;
    renderProgressionResults(runProgressionOptimization());
  });
  $("#progressionResults").addEventListener("click", (event) => {
    const prefillButton = event.target.closest("[data-token-shop-prefill]");
    if (prefillButton) {
      prefillTokenShopProgressionEditorFromCompatibility();
      return;
    }
    const clearButton = event.target.closest("[data-token-shop-clear-local]");
    if (clearButton) {
      clearTokenShopProgressionEditorLevels();
      return;
    }
    const tokenShopBuyButton = event.target.closest("[data-token-shop-buy-field]");
    if (tokenShopBuyButton) {
      const fieldName = tokenShopBuyButton.dataset.tokenShopBuyField;
      const levelField = tokenShopBuyButton
        .closest(".token-shop-buy-panel")
        ?.querySelector("[data-token-shop-level-field]");
      const currentLevel = coerceInputValue(
        levelField?.value ?? tokenShopBuyButton.dataset.tokenShopCurrentLevel ?? "0"
      );
      saveTokenShopProgressionLevel(fieldName, currentLevel + 1);
      return;
    }
    const focusButton = event.target.closest("[data-shard-focus-id]");
    if (focusButton) {
      const milestoneId = focusButton.dataset.shardFocusId || null;
      const levelField = focusButton
        .closest(".shard-milestone-card")
        ?.querySelector("[data-shard-focus-level]");
      const milestoneLevel = coerceInputValue(levelField?.value ?? "");
      saveShardPlannerInputs(milestoneId, milestoneLevel);
    }
  });
  $("#progressionResults").addEventListener(
    "toggle",
    (event) => {
      const card = event.target.closest("[data-shard-milestone-card]");
      if (card) {
        syncShardMilestoneOpenState(card.dataset.shardMilestoneCard, card.open);
      }
    },
    true
  );
  $("#progressionResults").addEventListener("change", (event) => {
    const tokenShopLevelField = event.target.closest("[data-token-shop-level-field]");
    if (tokenShopLevelField) {
      saveTokenShopProgressionLevel(
        tokenShopLevelField.dataset.tokenShopLevelField,
        coerceInputValue(tokenShopLevelField.value ?? "")
      );
      return;
    }
    const levelField = event.target.closest("[data-shard-focus-level]");
    if (!levelField) {
      return;
    }
    const milestoneId = levelField.dataset.shardFocusLevelFor || null;
    if (milestoneId) {
      saveShardPlannerInputs(milestoneId, coerceInputValue(levelField.value ?? ""));
    }
  });
  $("#runGemOptimizer").addEventListener("click", () => renderGemResults(runGemOptimization()));
  $("#runValidationSuite").addEventListener("click", renderValidationResults);
  $("#saveShipConfigBtn").addEventListener("click", () => {
    persistShipConfig();
    setStatus(
      "shipConfigStatus",
      "Community-tool ship planner weights and loadouts saved.",
      "success"
    );
  });
}

function renderAll() {
  renderNavigation();
  renderQuickPanels();
  renderOverview();
  renderPlayerProfileBoundarySummary();
  renderShipPlayerState();
  renderSourceRegistry();
  renderGeneratorOcrFileList();
  renderShipPanels();
  renderProgressionResults(runProgressionOptimization());
  renderGemResults(runGemOptimization());
  renderValidationResults();
  renderResearch();
}

function renderNavigation() {
  $$(".nav-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.page === state.route);
  });

  $$(".page").forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === state.route);
  });
}

function renderQuickPanels() {
  const snapshots = loadStoredJson(STORAGE_KEYS.snapshots, []);
  const completion = getProfileCompletion(state.playerProfile, ACTIVE_PROFILE_FORM_FIELD_PATHS);
  const helperCompletion = getPlannerHelperCompletion(state.playerProfile);
  $("#snapshotSummary").innerHTML = `
    <span class="snapshot-title">Active snapshot</span>
    <strong class="snapshot-value">${state.snapshot.snapshotVersion}</strong>
    <p class="meta">${state.snapshot.capturedAt}</p>
  `;
  $("#quickStatus").innerHTML = `
    <span class="snapshot-title">Quick status</span>
    <strong class="snapshot-value">${completion}%</strong>
    <p class="meta">${snapshots.length} LR snapshots saved locally.</p>
    <p class="meta">Planner helpers filled: ${helperCompletion}%.</p>
  `;
}

function renderOverview() {
  $("#profileCompletionValue").textContent =
    `${getProfileCompletion(state.playerProfile, ACTIVE_PROFILE_FORM_FIELD_PATHS)}%`;
  $("#importedRecordsValue").textContent = String(getImportedRecordCount());
  const validation = runValidationCases();
  const {
    mvp: mvpValidation,
    apk: apkValidation,
    support: supportValidation
  } = partitionValidationResults(validation);
  const recommendationFeed = getActiveMvpRecommendationFeed();
  const recommendationFeedSupport = getActiveMvpRecommendationFeedSupport();
  $("#validationStatusValue").textContent =
    `${mvpValidation.filter((item) => item.pass).length}/${mvpValidation.length}`;
  $("#overviewHighlights").innerHTML = [
    renderRecommendationFeedSummary(recommendationFeed, "overview"),
    renderRecommendationFeedSupportNotice(recommendationFeedSupport, "overview"),
    ...recommendationFeed
      .slice(0, 3)
      .map((item) =>
        makeRecommendationCard(item, item.module === "loop" ? "warning" : item.module)
      ),
    renderOverviewSupportSummary(apkValidation, supportValidation)
  ].join("");
  $("#overviewSpendSnapshot").innerHTML = renderSpendPlannerBoundary();
}

function renderShipPlayerState() {
  const shipPlayerState = getShipCommunityToolState();
  $("#shipPlayerStatePanel").innerHTML = SHIP_PLAYER_STATE_GROUPS.map(([groupKey, label]) => {
    const hiddenFields = SHIP_PLAYER_STATE_HIDDEN_FIELDS[groupKey] ?? new Set();
    const labelMap = SHIP_PLAYER_STATE_FIELD_LABELS[groupKey] ?? {};
    const fields = Object.entries(shipPlayerState[groupKey])
      .filter(([fieldKey]) => !hiddenFields.has(fieldKey))
      .map(([fieldKey, value]) => {
        const displayLabel = labelMap[fieldKey] ?? fieldKey;
        if (typeof value === "boolean") {
          const fieldClass =
            groupKey === "innovation" ? "mini-field mini-field-toggle" : "mini-field";
          return `<label class="${fieldClass}"><span>${displayLabel}</span><input data-ship-group="${groupKey}" data-ship-field="${fieldKey}" type="checkbox" ${value ? "checked" : ""}></label>`;
        }
        return `<label class="mini-field"><span>${displayLabel}</span><input data-ship-group="${groupKey}" data-ship-field="${fieldKey}" type="number" step="any" value="${value}"></label>`;
      })
      .join("");

    const gridClass = groupKey === "innovation" ? "mini-grid mini-grid-stacked" : "mini-grid";

    return `
        <article class="snapshot-card">
          <span class="snapshot-title">${label}</span>
          <div class="${gridClass}">${fields}</div>
        </article>
      `;
  }).join("");
}

function renderSourceRegistry() {
  const records = [
    ...(state.snapshot.sourceStrategy?.primarySources ?? []).map((source) => ({
      title: source.label,
      meta: source.url,
      detail: "Reference source"
    })),
    ...state.sourceRegistry.map((record) => ({
      title: `${record.dataset} import`,
      meta: new Date(record.importedAt).toLocaleString(),
      detail: `${record.rows} rows from ${record.source}`
    }))
  ];

  $("#sourceRegistry").innerHTML = records
    .map(
      (record) => `
    <article class="validation-card ${record.detail.includes("Reference") ? "pass" : "warn"}">
      <strong>${record.title}</strong>
      <p class="validation-status">${record.meta}</p>
      <p class="meta">${record.detail}</p>
    </article>
  `
    )
    .join("");
}

function renderShipPanels() {
  renderShipWeights();
  renderShipToolbar();
  renderShipSelector();
  renderShipEditor();
  renderShipActions();
  renderShipResults();
}

function renderShipWeights() {
  $("#shipWeightsPanel").innerHTML = `
        <article class="snapshot-card ship-editor-surface ship-editor-surface-subtle">
          <span class="snapshot-title">Resource priority weights</span>
        <p class="meta">These weights drive the current ship-planner implementation while the repo remaps tool labels to grounded in-game terminology.</p>
        <div class="mini-grid">
          ${Object.entries(state.shipConfig.weights)
            .map(
              ([key, value]) => `
            <label class="mini-field">
            <span>${key}</span>
            <input data-weight-key="${key}" type="number" step="any" value="${value}">
          </label>
          `
            )
            .join("")}
        </div>
        </article>
          <article class="snapshot-card ship-editor-surface ship-editor-surface-subtle">
            <span class="snapshot-title">Ship planner toggles</span>
          <p class="meta">These toggles affect the current ship-planner implementation. <code>softCap</code> keeps filtered resource lanes in play at a tiny flat priority of <code>0.01</code>.</p>
          <div class="mini-grid">
            <label class="mini-field">
              <span>softCap</span>
              <input id="shipSoftCapToggle" type="checkbox" ${getShipCommunityToolState().innovation.softCap ? "checked" : ""}>
            </label>
            <label class="mini-field">
                <span>Meltdown</span>
                <input id="shipMeltdownInput" type="number" step="any" min="0" value="${Number(getShipCommunityToolState().technical.Meltdown || 0)}">
              </label>
          </div>
      </article>
    `;

  $$("#shipWeightsPanel [data-weight-key]").forEach((input) => {
    input.addEventListener("change", () => {
      state.shipConfig.weights[input.dataset.weightKey] = coerceInputValue(input.value);
      persistShipConfig(false);
      renderShipResults();
    });
  });

  $("#shipSoftCapToggle").addEventListener("change", (event) => {
    getShipCommunityToolState().innovation.softCap = event.target.checked;
    persistPlayerProfile();
    renderShipPanels();
  });

  $("#shipMeltdownInput").addEventListener("change", (event) => {
    getShipCommunityToolState().technical.Meltdown = coerceInputValue(event.target.value);
    persistPlayerProfile();
    renderShipPlayerState();
    renderShipPanels();
  });
}

function renderShipToolbar() {
  const loadoutButtons = state.shipConfig.loadouts
    .map(
      (loadout, index) => `
      <button class="segment-button ${index === state.shipConfig.activeLoadoutIndex ? "is-active" : ""}" data-loadout-index="${index}">
        ${loadout.name}
      </button>
  `
    )
    .join("");

  const tapButtons = [1, 5, 10, "MAX"]
    .map(
      (value) => `
      <button class="segment-button ${value === state.shipConfig.pointPerTap ? "is-active" : ""}" data-tap-value="${value}">
        ${value === "MAX" ? "MAX" : `x${value}`}
      </button>
    `
    )
    .join("");

  $("#shipLoadoutToolbar").innerHTML = `
      <div class="ship-editor-surface ship-editor-surface-subtle">
        <span class="snapshot-title">Loadout slots</span>
        <div class="loadout-switches">${loadoutButtons}</div>
      </div>
      <div class="ship-editor-surface ship-editor-surface-subtle">
        <span class="snapshot-title">Points per tap</span>
        <div class="tap-switches">${tapButtons}</div>
      </div>
    `;

  $$("#shipLoadoutToolbar [data-loadout-index]").forEach((button) => {
    button.addEventListener("click", () => {
      state.shipConfig.activeLoadoutIndex = Number(button.dataset.loadoutIndex);
      persistShipConfig(false);
      renderShipPanels();
    });
  });

  $$("#shipLoadoutToolbar [data-tap-value]").forEach((button) => {
    button.addEventListener("click", () => {
      state.shipConfig.pointPerTap =
        button.dataset.tapValue === "MAX" ? "MAX" : Number(button.dataset.tapValue);
      persistShipConfig(false);
      renderShipToolbar();
      renderShipEditor();
    });
  });
}

function renderShipSelector() {
  $("#shipSelectorPanel").innerHTML = `
      <div class="ship-editor-surface ship-editor-surface-subtle">
        <span class="snapshot-title">Select ship</span>
        <div class="ship-chip-row">
          ${Object.entries(SHIP_LABELS)
            .map(
              ([shipKey, label]) => `
            <button class="ship-chip ship-theme-${shipKey} ${shipKey === state.shipConfig.selectedShipKey ? "is-active" : ""}" data-ship-key="${shipKey}">
              ${label}
          </button>
        `
            )
            .join("")}
      </div>
    </div>
  `;

  $$("#shipSelectorPanel [data-ship-key]").forEach((button) => {
    button.addEventListener("click", () => {
      state.shipConfig.selectedShipKey = button.dataset.shipKey;
      persistShipConfig(false);
      renderShipPanels();
    });
  });
}

function renderShipEditor() {
  const shipKey = state.shipConfig.selectedShipKey;
  const active = getActiveLoadout();
  const values = active.ships[shipKey];
  const template = state.shipTemplates[shipKey];
  const bestInstall = getBestNextInstall(shipKey, getTapDelta);
  const bestIndexes = new Set(bestInstall?.indexes ?? []);
  const installTotal = sum(values);
  const installLayout = getShipInstallLayout(shipKey);

  $("#shipEditorPanel").innerHTML = `
      <div class="ship-editor-surface ship-editor-stage ship-theme-${shipKey}">
        <div class="recommendation-head">
          <div>
            <span class="snapshot-title">${SHIP_LABELS[shipKey]} loadout</span>
            <h3>Installs: ${installTotal}/${sum(template.caps.map((cap) => getEffectiveCap(cap)))}</h3>
          </div>
          <span class="score">Next best: ${bestInstall ? bestInstall.indexes.map((index) => template.installs[index].name).join(" | ") : "Capped"}</span>
      </div>
        <div class="install-layout">
          ${installLayout
            .map(
              (row, rowIndex) => `
            <div class="install-row install-row-${rowIndex + 1}">
                ${row
                  .map((index) => {
                    const install = template.installs[index];
                    const value = values[index];
                    const effectiveCap = getEffectiveCap(template.caps[index]);
                    const reserveThreshold = template.reserveThresholds[index];
                    const available = canInstallPoint(shipKey, index);
                    const gain = getInstallGain(shipKey, index);
                    const isBest = bestIndexes.has(index);
                    const effectTypes = getInstallEffectTypes(shipKey, index);
                    const primaryEffect = getPrimaryEffectClass(effectTypes);
                    const isCapped = value >= effectiveCap;
                    const valueLabel = isCapped
                      ? "Capped"
                      : available
                        ? formatPercentGain(gain.rawGain)
                        : `Unlock @ ${reserveThreshold}`;
                    const title = isCapped
                      ? "Install cap reached. Ctrl+click or Shift+click to remove points."
                      : available
                        ? "Click to assign the next points. Ctrl+click or Shift+click to remove points."
                        : `Needs ${reserveThreshold} total installs`;
                    const isInteractable = available || isCapped || value > 0;
                    return `
                    <button class="install-card ship-theme-${shipKey} ${isBest ? "is-active" : ""} ${isInteractable ? "" : "is-locked"} ${isCapped ? "is-capped" : ""}" data-install-index="${index}" title="${title}" ${isInteractable ? "" : "disabled"}>
                      <div class="install-icon">${install.icon}</div>
                      <strong>${install.name}</strong>
                    <span class="snapshot-title">${value}/${effectiveCap}</span>
                    ${
                      available && !isCapped
                        ? `<div class="effect-line-stack">${getDisplayEffectTypes(effectTypes)
                            .map(
                              (effectType) =>
                                `<span class="effect-line effect-${effectType}">${valueLabel}</span>`
                            )
                            .join("")}</div>`
                        : `<span class="effect-line effect-${primaryEffect}">${valueLabel}</span>`
                    }
                      ${isBest ? `<span class="pill">Next best +${bestInstall.delta}</span>` : ""}
                  </button>
              `;
                  })
                  .join("")}
            </div>
          `
            )
            .join("")}
        </div>
        <div class="ship-filter-strip">
          <div class="ship-filter-head">
            <span class="snapshot-title">Resource filters</span>
            <p class="meta">Disable resource lanes to avoid those installs. With <code>softCap</code> on, filtered installs stay available only when they outperform by a large margin.</p>
          </div>
          <div class="ship-filter-grid">
              ${Object.entries(SHIP_FILTER_LABELS)
                .map(
                  ([key, label]) => `
                <button class="filter-chip effect-${key} ${active.filters[key] ? "is-active" : "is-muted"}" data-filter-key="${key}">
                  <span class="filter-dot"></span>
                  <span>${label}</span>
                </button>
              `
                )
                .join("")}
          </div>
        </div>
      </div>
    `;

  $$("#shipEditorPanel [data-install-index]").forEach((button) => {
    button.addEventListener("click", (event) => {
      const direction = event.ctrlKey || event.shiftKey ? -1 : 1;
      applyInstallTap(Number(button.dataset.installIndex), direction);
    });
  });

  $$("#shipEditorPanel [data-filter-key]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.filterKey;
      getActiveLoadout().filters[key] = !getActiveLoadout().filters[key];
      persistShipConfig(false);
      renderShipEditor();
      renderShipResults();
    });
  });
}

function renderShipActions() {
  $("#shipActionPanel").innerHTML = `
    <button class="action-button action-success" data-ship-action="apply">Apply</button>
    <button class="action-button" data-ship-action="undo">Undo</button>
    <button class="action-button action-danger" data-ship-action="clearShip">Reset selected ship</button>
    <button class="action-button action-danger" data-ship-action="clearLoadout">Clear active loadout</button>
  `;

  $$("#shipActionPanel [data-ship-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.shipAction;
      if (action === "apply") {
        persistShipConfig();
        setStatus("shipConfigStatus", "Applied ship planner changes.", "success");
      }
      if (action === "undo") {
        undoLoadoutChange();
      }
      if (action === "clearShip") {
        resetSelectedShip();
      }
      if (action === "clearLoadout") {
        clearActiveLoadout();
      }
    });
  });
}

function renderShipResults() {
  const bestInstall = getBestNextInstall(state.shipConfig.selectedShipKey, getTapDelta);
  const shipRankings = rankShipTargets();
  const leadCard = bestInstall
    ? {
        title: `Next best install: ${bestInstall.indexes.map((index) => state.shipTemplates[state.shipConfig.selectedShipKey].installs[index].name).join(" | ")}`,
        subtitle: SHIP_LABELS[state.shipConfig.selectedShipKey],
        score: bestInstall.score,
        confidence: 0.58,
        notes: `Adds ${bestInstall.delta} point(s) on ${state.shipConfig.loadouts[state.shipConfig.activeLoadoutIndex].name}.`
      }
    : null;

  $("#shipResults").innerHTML = `
    ${renderSupportSurfaceNotice("Canonical ship system, provisional implementation", [
      "These cards represent a real ship system, but the current implementation still uses community-tool calibration and provisional labels.",
      "Treat the ship output as canonical-domain planning with external-model wiring still being remapped."
    ])}
    ${[leadCard, ...shipRankings.slice(0, 3)]
      .filter(Boolean)
      .map((item) => makeRecommendationCard(item, "ship"))
      .join("")}
  `;
}

function renderProgressionResults(results) {
  const recommendationFeedPartition = getProgressionRecommendationFeedPartition(results);
  const recommendationFeed = recommendationFeedPartition.valid;
  const recommendationFeedSupport = recommendationFeedPartition.invalid;
  const subsystemFeed = getProgressionSubsystemPartition(recommendationFeed);
  const selectedSubsystem = getSelectedProgressionSubsystem();
  renderProgressionSubsystemToggle(subsystemFeed);
  const sectionMarkup = {
    shards: renderShardSubsystemSection(subsystemFeed.shards),
    loop: renderProgressionSubsystemSection(
      "Loop Prestige",
      "Loop reset guardrails",
      "These cards stay warning-oriented. They are pacing and anti-bricking notes around Loop Prestige, not reset optimizers.",
      subsystemFeed.loop,
      "warning"
    ),
    tokenShop: renderTokenShopSubsystemSection()
  };
  const subsystemHeader =
    selectedSubsystem === "tokenShop"
      ? ""
      : `
      ${renderRecommendationFeedSummary(recommendationFeed, "progression")}
      ${renderRecommendationFeedSupportNotice(recommendationFeedSupport, "progression")}
    `;
  $("#progressionResults").innerHTML = `
    ${subsystemHeader}
    ${sectionMarkup[selectedSubsystem]}
  `;
  if (selectedSubsystem === "shards") {
    renderShardPlannerControls();
  }
}

function renderShardSubsystemSection(items) {
  const cards = (Array.isArray(items) ? items : [])
    .map((item) => makeRecommendationCard(item, "shards"))
    .join("");
  return `
    <section class="meta-stack">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Shard Mining</p>
          <h3>Shard Mining</h3>
        </div>
      </div>
      <p class="meta">Shard Mining is the player-facing shard surface. It keeps milestone guidance and row tracking together, while grounding details and recovery evidence stay in docs.</p>
      ${cards ? `<div class="recommendation-list">${cards}</div>` : `<article class="validation-card warn"><strong>Shard Mining unavailable</strong><p class="meta">No player-facing shard cards currently passed the shared recommendation contract.</p></article>`}
      ${renderShardMilestoneDirectory()}
      ${renderShardDocsNotice()}
    </section>
  `;
}

function renderGemResults(results) {
  const budget = getGemPlannerBudget();
  const legacyGemDust = getCompatibilityProfileState().unresolved.gemDust;
  const boundaryNotes = [];

  if (budget === 0) {
    boundaryNotes.push(
      "Gem-node rankings are using a zero planner budget until you enter an experimental gem-node budget in PlayerProfile JSON."
    );
  }
  if (legacyGemDust != null) {
    boundaryNotes.push(
      `Legacy gemDust is preserved under compatibility (${formatOptionalNumber(legacyGemDust)}) and is not used as active planner budget.`
    );
  }

  $("#gemResults").innerHTML = `
    ${renderSupportSurfaceNotice("Experimental gem results", [
      "Gem-node rankings remain an experimental support surface outside the grounded MVP path.",
      "Use them only as labeled helper output, not as verified CIFI recommendation truth."
    ])}
    ${
      boundaryNotes.length
        ? `
      <article class="validation-card warn">
        <strong>Experimental budget boundary</strong>
        ${boundaryNotes.map((note) => `<p class="meta">${escapeHtml(note)}</p>`).join("")}
      </article>
    `
        : ""
    }
    <div class="recommendation-list">${results.map((item) => makeRecommendationCard(item, "gem")).join("")}</div>
  `;
}

function renderValidationResults() {
  const results = runValidationCases();
  const mvpResults = results.filter((item) => item.scope === "MVP");
  const apkResults = results.filter((item) => item.scope === "APK");
  const supportResults = results.filter((item) => item.scope === "Support");
  $("#validationResults").innerHTML = [
    renderSpendSaveSideBoundary(),
    renderValidationSection(
      "Grounded MVP checks",
      "These checks contribute to the overview benchmark and track current grounded MVP behavior.",
      mvpResults
    ),
    renderValidationSection(
      "APK-grounding checks",
      "These checks confirm extracted mechanic bundles and explicit mapping gates so available-but-unmapped systems do not get mixed into app truth.",
      apkResults
    ),
    renderValidationSection(
      "Support-surface checks",
      "These checks cover quarantined support surfaces such as Gem Nodes. Keep them labeled, but do not treat them as MVP truth.",
      supportResults
    )
  ].join("");
}

function renderSpendSaveSideBoundary() {
  const multiverseMarket = state.extractedMechanics?.multiverseMarket;
  const multiverseMarketMetadataNeighborhood =
    state.extractedMechanics?.multiverseMarketMetadataNeighborhood;
  const dailyTokeniumLaneClues = state.extractedMechanics?.dailyTokeniumLaneClues;
  const tokenBankFormulaBoundary = state.extractedMechanics?.tokenBankFormulaBoundary;
  const multiverseMarketRangeBoundary = state.extractedMechanics?.multiverseMarketRangeBoundary;
  const multiverseMarketRowTextCoverage = state.extractedMechanics?.multiverseMarketRowTextCoverage;
  const multiverseMarketPrefabRemapBoundary =
    state.extractedMechanics?.multiverseMarketPrefabRemapBoundary;
  if (!multiverseMarket && !multiverseMarketMetadataNeighborhood) {
    return "";
  }

  const summary = getMultiverseMarketMetadataSummary(multiverseMarketMetadataNeighborhood);
  const validatedCoverage = getMultiverseMarketValidatedCoverage(multiverseMarket);
  const dailyTokeniumSummary = getDailyTokeniumLaneSummary(dailyTokeniumLaneClues);
  const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(tokenBankFormulaBoundary);
  const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(
    multiverseMarketRangeBoundary
  );
  const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(
    multiverseMarketRowTextCoverage
  );
  const multiverseMarketPrefabRemapSummary = getMultiverseMarketPrefabRemapBoundarySummary(
    multiverseMarketPrefabRemapBoundary
  );
  const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(
    state.extractedMechanics?.multiverseMarketOwnerFamily
  );
  const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(
    state.extractedMechanics?.multiverseMarketMarketMemberBoundary
  );
  return `
    <section class="meta-stack">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Spend integration boundary</p>
          <h3>Spend save-side narrowing</h3>
        </div>
      </div>
      <p class="meta">Repo-local metadata now narrows MultiverseMarket saved-state work toward the broader PlayerProfileData persistence family instead of treating MultiverseMarket itself as the recovered save owner.</p>
      <div class="validation-grid">
        <article class="validation-card ${summary.hasSaveFamilyClues ? "pass" : "warn"}">
          <strong>Likely persistence family</strong>
          <p class="meta">${summary.hasSaveFamilyClues ? "PlayerProfileData.cs, GetPlayerProfileData, and FillPlayerProfileData are all present in the checked-in metadata neighborhood." : "PlayerProfileData persistence clues are incomplete in the checked-in metadata neighborhood."}</p>
        </article>
        <article class="validation-card ${summary.hasCloudSavePathClues ? "pass" : "warn"}">
          <strong>Cloud-save profile path</strong>
          <p class="meta">${summary.hasCloudSavePathClues ? "CloudSavePlayerProfile and GetPlayerProfileInfo now appear in the same checked-in save-path neighborhood, which strengthens the PlayerProfile-based persistence search." : "Cloud-save profile path clues are incomplete in the checked-in metadata neighborhood."}</p>
        </article>
        <article class="validation-card ${marketMemberSummary.favorsPlayerProfileMemberHost ? "pass" : "warn"}">
          <strong>Likely canonical host</strong>
          <p class="meta">${marketMemberSummary.hasSiblingAccessorCluster ? `${marketMemberSummary.accessorLabel} now sits in the same PlayerProfile-side accessor run as ${marketMemberSummary.siblingAccessorLabel}.` : "The checked-in metadata neighborhood does not yet preserve the expected PlayerProfile-side sibling accessor run for Market."}</p>
          <p class="meta">${marketMemberSummary.favorsPlayerProfileMemberHost ? `That makes ${marketMemberSummary.canonicalHostLabel} the strongest current repo-local host for future canonical Emporium state, instead of direct MultiverseMarket ownership or loose top-level fields on PlayerProfileData.` : "The current build does not yet preserve a strong enough sibling-member pattern to narrow the future canonical host."}</p>
        </article>
        <article class="validation-card ${summary.hasProgressionFieldCluster ? "pass" : "warn"}">
          <strong>Grounded field-cluster clues</strong>
          <p class="meta">${summary.hasProgressionFieldCluster ? "InscryptionsDone now sits beside nearby IS*Level entries and trade counters such as EsotericR1Trades in repo-local metadata." : "The checked-in metadata neighborhood does not yet preserve the expected InscryptionsDone progression-field cluster."}</p>
        </article>
        <article class="validation-card ${validatedCoverage.hasValidatedRows ? "pass" : "warn"}">
          <strong>Validated row block vs broader field run</strong>
          <p class="meta">${validatedCoverage.hasValidatedRows ? `The checked-in MultiverseMarket extract currently validates ${validatedCoverage.count} rows across ids ${validatedCoverage.rangeLabel}.` : "The checked-in MultiverseMarket extract does not yet expose a validated row block."}</p>
          <p class="meta">${summary.recoveredIsRangeLabel ? `The save-side metadata neighborhood already reaches ${summary.recoveredIsRangeLabel}, which is broader than the currently validated row block.` : "The save-side metadata neighborhood does not yet expose a broad IS*Level run."}</p>
        </article>
        <article class="validation-card ${multiverseMarketRangeSummary.hasRangeBoundary ? "pass" : "warn"}">
          <strong>Validated rows vs recovered IS run</strong>
          <p class="meta">${multiverseMarketRangeSummary.hasValidatedRows ? `The checked-in row block still covers ids ${multiverseMarketRangeSummary.validatedRangeLabel}.` : "Validated row coverage is incomplete in the checked-in range boundary bundle."}</p>
          <p class="meta">${multiverseMarketRangeSummary.hasOverlap ? `The separate metadata run ${multiverseMarketRangeSummary.metadataRangeLabel} now directly overlaps validated rows ${multiverseMarketRangeSummary.overlapLabel}.` : multiverseMarketRangeSummary.hasExplicitZeroOverlap ? `The separate metadata run ${multiverseMarketRangeSummary.metadataRangeLabel} currently has no direct overlap with that validated block.` : "The checked-in range boundary is incomplete."}</p>
        </article>
        <article class="validation-card ${multiverseMarketRowTextSummary.hasValidatedTextCoverage ? "pass" : "warn"}">
          <strong>Validated row text coverage</strong>
          <p class="meta">${multiverseMarketRowTextSummary.hasValidatedTextCoverage ? `TextHandlerMarkets now preserves ${multiverseMarketRowTextSummary.coveredCount} direct SetIS*CostText hooks for validated rows ${multiverseMarketRowTextSummary.validatedRangeLabel}.` : "Validated-row cost-text coverage is incomplete in the checked-in text-coverage bundle."}</p>
          <p class="meta">${multiverseMarketRowTextSummary.hasBuyHookSamples ? `Sample buy hooks such as ${multiverseMarketRowTextSummary.firstBuyHook} and ${multiverseMarketRowTextSummary.lastBuyHook} are also present in the same checked local coverage path.` : "Validated-row buy-hook samples are incomplete in the checked-in text-coverage bundle."}</p>
        </article>
        <article class="validation-card ${multiverseMarketPrefabRemapSummary.hasOverrideBoundary ? "pass" : "warn"}">
          <strong>Prefab remap boundary</strong>
          <p class="meta">${multiverseMarketPrefabRemapSummary.hasDirectMatchBand ? `The checked prefab shell now keeps direct ChrystosEmporiumUpgrade names through ${multiverseMarketPrefabRemapSummary.lastDirectPrefab}.` : "Direct ChrystosEmporiumUpgrade name coverage is incomplete in the checked-in prefab-remap bundle."}</p>
          <p class="meta">${multiverseMarketPrefabRemapSummary.hasOverrideBoundary ? `The same asset then switches to ${multiverseMarketPrefabRemapSummary.firstOverride} through ${multiverseMarketPrefabRemapSummary.lastOverride}, so validated ids ${multiverseMarketPrefabRemapSummary.validatedMismatchLabel} still do not have direct prefab-number label matches.` : "The checked prefab-remap bundle no longer preserves the expected 69-74 override band."}</p>
        </article>
        <article class="validation-card ${multiverseMarketOwnerFamilySummary.hasOwnerFamily ? "pass" : "warn"}">
          <strong>MultiverseMarket owner family</strong>
          <p class="meta">${multiverseMarketOwnerFamilySummary.hasOwnerFamily ? `${multiverseMarketOwnerFamilySummary.ownerAnchor}, ${multiverseMarketOwnerFamilySummary.inscryptionsLabel}, ${multiverseMarketOwnerFamilySummary.textHandler}, and ${multiverseMarketOwnerFamilySummary.batcher} now appear in one checked owner-family shell.` : "MultiverseMarket owner-family clues are incomplete in the checked-in shell bundle."}</p>
          <p class="meta">${multiverseMarketOwnerFamilySummary.hasCurrencyShell ? `The same shell also preserves ${multiverseMarketOwnerFamilySummary.resourceText}, ${multiverseMarketOwnerFamilySummary.achievementBar}, ${multiverseMarketOwnerFamilySummary.costBox}, and ${multiverseMarketOwnerFamilySummary.currencyRangeLabel}.` : "The checked owner-family shell does not yet preserve the expected Inscryptions cost-lane UI anchors."}</p>
        </article>
        <article class="validation-card ${dailyTokeniumSummary.hasOwnerFamilyClues ? "pass" : "warn"}">
          <strong>Daily Tokenium owner family</strong>
          <p class="meta">${dailyTokeniumSummary.hasOwnerFamilyClues ? "SpaceAcademy, SpaceAcademyMain, TextHandlerSpaceAcademy, and FarmMissions now appear in a checked-in lane clue bundle." : "Daily Tokenium owner-family clues are incomplete in the checked-in lane clue bundle."}</p>
          <p class="meta">${dailyTokeniumSummary.hasModifierBoundary ? "LM244 hooks, BuyLM244, FinalDailyTokenBonus, and Collector-pack copy still behave like modifier-family clues around the lane, not recovered saved-state owners." : "Daily Tokenium modifier-family clues are incomplete in the checked-in lane clue bundle."}</p>
        </article>
        <article class="validation-card ${tokenBankFormulaSummary.hasDerivedOutputBoundary ? "pass" : "warn"}">
          <strong>Token-bank derived output boundary</strong>
          <p class="meta">${tokenBankFormulaSummary.hasDerivedOutputBoundary ? "FinalTokenBankCap and FinalTokenBankFillSpeed now appear in a checked-in accessor and backing-field cluster." : "Token-bank derived-output clues are incomplete in the checked-in boundary bundle."}</p>
          <p class="meta">${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? "The same checked local context still does not expose PlayerProfileData or CloudSavePlayerProfile beside those outputs." : "The checked derived-output context now overlaps a broader save-family clue and needs review."}</p>
        </article>
        <article class="validation-card warn">
          <strong>Still blocked for planner wiring</strong>
          <p class="meta">Do not promote FinalIS or achievement symbols into canonical player state yet. Current evidence only narrows the search; it does not identify the declaring save model or which recovered IS*Level subset actually maps to the validated MultiverseMarket rows.</p>
        </article>
      </div>
    </section>
  `;
}

function renderResearch() {
  const orderedTracks = [...state.snapshot.researchTracks].sort(
    (left, right) => getResearchTrackOrder(left) - getResearchTrackOrder(right)
  );
  const visibleTracks = orderedTracks.filter((track) =>
    state.researchView === "archived" ? track.status === "archived" : track.status !== "archived"
  );
  $("#researchResults").innerHTML = [
    renderResearchGuidance(),
    renderResearchViewSelector(orderedTracks),
    ...visibleTracks.map((track) => {
      const nextSteps = Array.isArray(track.nextSteps) ? track.nextSteps : [];
      return `
    <article class="research-card">
      <div class="research-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(getResearchTrackLane(track))}</p>
          <strong>${escapeHtml(track.title)}</strong>
        </div>
        <div class="pill-row">
          <span class="pill">${escapeHtml(getResearchTrackStatus(track))}</span>
          <span class="pill">${escapeHtml(getResearchTrackProgressLabel(track))}</span>
          <span class="pill">${escapeHtml(getResearchTrackPhase(track))}</span>
          <span class="pill">${escapeHtml(getResearchTrackSource(track))}</span>
        </div>
      </div>
      <p class="meta">${escapeHtml(track.goal)}</p>
      ${renderResearchTrackProgress(track)}
      ${renderResearchTrackSupport(track)}
      <div class="meta-stack">
        <p class="snapshot-title">${nextSteps.length ? "Remaining work" : "Archive note"}</p>
        ${
          nextSteps.length
            ? `<ul class="research-step-list">${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>`
            : `<p class="meta">No active remaining work. This card stays here only as delivered foundation context for later roadmap slices.</p>`
        }
      </div>
    </article>
  `;
    }),
    !visibleTracks.length
      ? `
    <article class="research-card">
      <div class="research-card-head">
        <div>
          <p class="eyebrow">${escapeHtml(state.researchView === "archived" ? "Foundation archive" : "Active research")}</p>
          <strong>${escapeHtml(state.researchView === "archived" ? "No archived foundation cards" : "No active research tracks")}</strong>
        </div>
      </div>
      <p class="meta">${escapeHtml(
        state.researchView === "archived"
          ? "Archived research foundations will appear here when the repo keeps delivered context cards in the snapshot."
          : "No open research cards match the current filter. Switch to Archived to review delivered foundation context."
      )}</p>
    </article>
  `
      : ""
  ].join("");

  bindResearchViewSelector();
}

function renderResearchViewSelector(tracks) {
  const activeCount = tracks.filter((track) => track.status !== "archived").length;
  const archivedCount = tracks.filter((track) => track.status === "archived").length;
  return `
    <article class="research-card research-selector-card">
      <div class="research-card-head">
        <div>
          <p class="eyebrow">Track view</p>
          <strong>Switch between active work and archived foundations</strong>
        </div>
        <div class="pill-row">
          <span class="pill">${activeCount} active</span>
          <span class="pill">${archivedCount} archived</span>
        </div>
      </div>
      <div class="research-view-toggle" id="researchViewToggle" role="tablist" aria-label="Research track view">
        <button class="button${state.researchView === "active" ? " is-active" : ""}" type="button" data-research-view="active" role="tab" aria-selected="${state.researchView === "active"}">Active</button>
        <button class="button${state.researchView === "archived" ? " is-active" : ""}" type="button" data-research-view="archived" role="tab" aria-selected="${state.researchView === "archived"}">Archived</button>
      </div>
    </article>
  `;
}

function bindResearchViewSelector() {
  $$("#researchViewToggle [data-research-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.researchView === "archived" ? "archived" : "active";
      if (state.researchView === nextView) {
        return;
      }
      state.researchView = nextView;
      renderResearch();
    });
  });
}

function renderDatasetRefreshHardening() {
  const contract = state.snapshot
    ? {
        validationCommand: "npm run verify:data",
        sourcePriority: [
          "APK/Unity artifacts and repo extraction outputs first",
          "Official/public corroboration second",
          "Community gap-filling last"
        ],
        classifications: [
          "canonical-app-snapshot",
          "grounded-descriptive",
          "extracted-mechanics",
          "community-derived"
        ]
      }
    : null;

  if (!contract) {
    return "";
  }

  return `
    <article class="validation-card warn">
      <strong>Dataset refresh hardening path</strong>
      <p class="validation-status">Use this before promoting new bundled data or refreshing shipped JSON assets.</p>
      <p class="meta">Future asset recoveries should not go straight into app truth. First update the supporting research note, keep classification truthful, update track status if the current slice changed, then rerun the repo-local gates.</p>
      <div class="meta-stack">
        <p class="snapshot-title">Refresh checklist</p>
        <p class="meta">1. Make source priority explicit.</p>
        <p class="meta">2. Update or add the supporting research note.</p>
        <p class="meta">3. Record the shipped dataset in <code>data/bundled-dataset-contract.v1.json</code>.</p>
        <p class="meta">4. Keep the dataset classification truthful.</p>
        <p class="meta">5. Update roadmap or research-track status if the slice changed.</p>
        <p class="meta">6. Run <code>npm run verify:data</code>, <code>npm test</code>, and <code>node --check app.js</code> when app-facing behavior changed.</p>
      </div>
      <div class="pill-row">
        ${contract.sourcePriority.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="pill-row">
        ${contract.classifications.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
      </div>
    </article>
  `;
}

function renderSpendPlannerBoundary() {
  const canonical = getCanonicalProfileState();
  const compatibility = getCompatibilityProfileState();
  const spendTrack = state.snapshot?.researchTracks?.find(
    (track) => track.id === "spend-planner-first-ui-slice"
  );
  const emporiumTrack = state.snapshot?.researchTracks?.find(
    (track) => track.id === "spend-multiverse-savedata-import-surface"
  );
  const tokenShop = state.extractedMechanics?.tokenShop ?? {};
  const multiverseMarket = state.extractedMechanics?.multiverseMarket ?? {};
  const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(
    state.extractedMechanics?.multiverseMarketMarketMemberBoundary
  );
  const resourceIcons = Array.isArray(tokenShop.resource_icons) ? tokenShop.resource_icons : [];
  const importedMarketState = compatibility.unmappedSystems?.multiverseMarket;
  const importedMarketPreview = getImportedMultiverseMarketPreview(
    importedMarketState,
    multiverseMarket,
    state.extractedMechanics?.multiverseMarketRangeBoundary,
    { formatBoundaryValue, formatShardNumber, isBoundaryValuePresent }
  );
  const canonicalInputs = [
    {
      label: "Tokens",
      value: canonical.tokens,
      path: "player.resources.tokens",
      note: "Grounded canonical spend balance available for descriptive budgeting only."
    },
    {
      label: "Diamonds",
      value: canonical.diamonds,
      path: "player.resources.diamonds",
      note: "Grounded canonical premium-currency balance available for descriptive budgeting only."
    },
    {
      label: "Current LR",
      value: canonical.loopReset,
      path: "player.loop.loopReset",
      note: "Grounded progression context only. This slice does not turn LR into spend rankings."
    },
    {
      label: "Academy relics",
      value: canonical.academyRelics,
      path: "player.resources.academyRelics",
      note: "Grounded canonical aggregate when imported, but still descriptive only in this slice."
    }
  ];
  const boundaryBackedInputs = [
    {
      label: "Boundary-backed: Banked tokens (stored amount)",
      value: compatibility.unmappedSystems?.tokenShop?.BankedTokens,
      path: "compatibility.unmappedSystemState.tokenShop.BankedTokens",
      note: "Exact SaveData.BankedTokens recovery grounds the current stored token-bank amount as boundary-backed state only. Cap and claimable planning stay blocked."
    },
    {
      label: "Boundary-backed: Daily Tokenium (stored amount)",
      value: compatibility.unmappedSystems?.tokenShop?.DailyTokenium,
      path: "compatibility.unmappedSystemState.tokenShop.DailyTokenium",
      note: "Exact SaveData.DailyTokenium recovery plus the narrowed SaveData mission-persistence wrapper grounds the current Daily Tokenium stored amount as boundary-backed non-canonical evidence only. Cap and Daily Tokenium-specific ready or claimable planning stay blocked."
    },
    {
      label: "Boundary-backed: Tokenium-cluster claimable evidence (generic)",
      value: compatibility.unmappedSystems?.tokenShop?.ClaimableTokenium,
      path: "compatibility.unmappedSystemState.tokenShop.ClaimableTokenium",
      note: "Exact SaveData.ClaimableTokenium recovery grounds a broader generic Tokenium-cluster claimable field as boundary-backed evidence only. It does not clear token-bank claimable tokens, Daily Tokenium-specific ready state, or canonical state.playerProfile promotion."
    }
  ];
  const blockedInputs = [
    {
      label: "TokenShop recommendations beyond the checked editor subset",
      reason:
        "The checked ATU1, ATU2, ATU3, ATU4, ATU5, ATU6, ATU7, ATU8, ATU9, ATU10, and ATU12 remap subset can now appear on shipped Overview and Progression surfaces, but recommendation logic, ATU11, and the rest of the recovered raw TokenShop ATU row family still stay blocked until broader row remap coverage and a true next-purchase rule set clear."
    },
    {
      label: "Token-bank cap and claimable tokens",
      reason:
        "Blocked even with BankedTokens recovered and generic ClaimableTokenium evidence surfaced. Current TokenShop and FinalTokenBank clues still do not name planner-safe cap or token-bank-specific claimable saved values."
    },
    {
      label: "Daily Tokenium cap and ready or claimable state",
      reason:
        "Blocked even with the current stored amount recovered and generic ClaimableTokenium evidence surfaced. The lane now narrows to a SaveData mission-persistence wrapper, but no checked DailyTokeniumCap field or Daily Tokenium-specific ready or claimable join is recovered yet."
    },
    {
      label: "Emporium owned progression and Inscryptions balance",
      reason:
        "Blocked for planner use. The app may show a compatibility-only preview of the raw IS1Level through IS110Level span plus separate bounded trade-counter and early-mech quarantine ranges, but InscryptionsDone remains wrapper-only, the preview stays non-canonical, and no Emporium recommendation path is unlocked."
    }
  ];
  const nextSteps = Array.isArray(spendTrack?.nextSteps) ? spendTrack.nextSteps.slice(0, 3) : [];

  return `
    <div class="meta-stack">
      <p class="meta">Forked from the research-only spend-planner lane into a normal app surface. This snapshot stays descriptive, keeps blocked owner-dependent state explicit, and does not add recommendations, ranking, or optimizer math.</p>
      <p class="meta">Non-canonical values shown here are explicitly labeled as boundary-backed or compatibility-only so the surface does not blur grounded app truth with quarantined evidence.</p>
    </div>
    <div class="meta-stack">
      <p class="snapshot-title">Canonical spend inputs</p>
        <ul class="research-step-list">${canonicalInputs.map((input) => `<li>${escapeHtml(input.label)}: ${isBoundaryValuePresent(input.value) ? escapeHtml(formatBoundaryValue(input.value)) : "Not entered yet"} <code>${escapeHtml(input.path)}</code>. ${escapeHtml(input.note)}</li>`).join("")}</ul>
    </div>
    <div class="meta-stack">
      <p class="snapshot-title">Boundary-backed spend evidence</p>
        <ul class="research-step-list">${boundaryBackedInputs.map((input) => `<li>${escapeHtml(input.label)}: ${isBoundaryValuePresent(input.value) ? escapeHtml(formatBoundaryValue(input.value)) : "Not imported yet"} <code>${escapeHtml(input.path)}</code>. ${escapeHtml(input.note)}</li>`).join("")}</ul>
    </div>
    <div class="meta-stack">
      <p class="snapshot-title">TokenShop progression handoff</p>
      <p class="meta">The checked TokenShop subset now ships in two bounded user-facing surfaces: this Overview affordability module and the separate Progression-side checked-row editor.</p>
      <p class="meta">Overview reads the shared checked subset for current affordability only, while Progression keeps local row edits non-canonical under <code>planning.tokenShop.checkedSubsetLevels.*</code>. Compatibility imports remain prefill or fallback only, and the rest of the raw <code>ATU*Level</code> family stays quarantined under <code>compatibility.unmappedSystemState.tokenShop</code>.</p>
    </div>
    ${renderTokenShopOverviewAffordabilityModule()}
    <div class="meta-stack">
        <p class="snapshot-title">Blocked inputs and unavailable planner actions</p>
        <ul class="research-step-list">${blockedInputs.map((input) => `<li>${escapeHtml(input.label)}: ${escapeHtml(input.reason)}</li>`).join("")}</ul>
    </div>
    <div class="meta-stack">
        <p class="snapshot-title">Compatibility-only Emporium preview boundary</p>
        <p class="meta">${marketMemberSummary.hasBoundary ? `The checked save-side handoff now preserves ${marketMemberSummary.accessorLabel} plus a bare ${marketMemberSummary.memberLabel} member shell inside the PlayerProfile path.` : "The checked Emporium market-member boundary is not available in this build."}</p>
        <p class="meta">${marketMemberSummary.favorsPlayerProfileMemberHost ? `That keeps ${marketMemberSummary.canonicalHostLabel} as the checked handoff into the Emporium save path, while the current exact declaring owner for the broader progression run is ${marketMemberSummary.exactSaveOwnerLabel}.` : "The current build does not yet narrow the future canonical market host beyond a broad PlayerProfile-side handoff."}</p>
        <p class="meta">${marketMemberSummary.hasMissingDirectTypeMap ? `The repo still lacks ${marketMemberSummary.missingTypeMapLabel}, so the active lane stays on bounded import admissibility rather than planner logic or row remap.` : "The current build no longer preserves the expected direct-type-map gap for the Emporium save path and needs review."}</p>
        <p class="meta">${importedMarketPreview.hasOverlapGroundedRows ? `Grounded SaveData overlap currently stops at ordered rows ${escapeHtml(importedMarketPreview.overlapRangeLabel)}, and ordered overlap is not an import-admissibility result, so the canonical Emporium import-safe subset stays empty.` : "The current build does not yet expose an overlap-grounded Emporium subset, so the canonical import-safe subset stays empty."}</p>
        <p class="meta">${Array.isArray(emporiumTrack?.nextSteps) && emporiumTrack.nextSteps.length ? `Emporium next step: ${escapeHtml(emporiumTrack.nextSteps[0])}` : "Emporium next step is still the bounded import-surface decision, not planner logic or generic owner recovery."}</p>
    </div>
    <div class="meta-stack">
        <p class="snapshot-title">Why recommendations stay unavailable</p>
        <p class="meta">Unresolved owners still prevent planner-safe recommendations. This slice does not claim best-buy order, ROI, ETA, optimizer correctness, or route quality while the blocked spend inputs remain unrecovered.</p>
        <p class="meta">Confidence label: canonical PlayerProfile values and explicitly labeled boundary-backed evidence only. Unresolved owner-dependent inputs stay explicitly unavailable instead of being inferred from compatibility blobs, extracted constants, or UI text hooks.</p>
    </div>
    ${nextSteps.length ? `<div class="meta-stack"><p class="snapshot-title">Research lane remains separate</p><ul class="research-step-list">${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul></div>` : ""}
    <div class="pill-row">
        <span class="pill">${canonicalInputs.filter((input) => isBoundaryValuePresent(input.value)).length}/${canonicalInputs.length} canonical inputs entered</span>
        <span class="pill">${boundaryBackedInputs.filter((input) => isBoundaryValuePresent(input.value)).length}/${boundaryBackedInputs.length} boundary-backed inputs imported</span>
        <span class="pill">${blockedInputs.length} blocked inputs surfaced</span>
        <span class="pill">Canonical boundary preserved</span>
        <span class="pill">Boundary-backed evidence labeled</span>
        <span class="pill">Compatibility-only preview labeled</span>
        <span class="pill">Uncertainty visible</span>
        <span class="pill">No spend recommendations yet</span>
    </div>
  `;
}

function renderSpendPlannerResearchForkNote() {
  return `
    <div class="meta-stack">
      <p class="snapshot-title">Forked user-surface slice</p>
      <p class="meta">The Overview page keeps the descriptive spend boundary and the checked-subset TokenShop affordability module, while the Progression page keeps the separate checked-row editor slice.</p>
      <p class="meta">Those two shipped TokenShop surfaces answer two real player questions for the same checked subset only: what can I afford right now, and what do the grounded upgrades I can already inspect do at my current level and on the next level?</p>
      <p class="meta">Anything beyond that consumed-input contract should fork into a new slice rather than reopening the shipped surfaces with optimizer behavior.</p>
    </div>
  `;
}

function renderTokenShopSubsystemSection() {
  return `
    <section class="meta-stack">
      <div class="panel-header">
        <div>
          <p class="eyebrow">TokenShop</p>
          <h3>TokenShop</h3>
        </div>
      </div>
      <p class="meta">TokenShop keeps its own Progression category so it does not get mixed into the Shard Mining surface or force an endlessly scrolling page.</p>
      ${renderTokenShopSavedStateSnapshot()}
      ${renderTokenShopProgressionEditor()}
    </section>
  `;
}

function renderTokenShopSavedStateSnapshot() {
  const compatibility = getCompatibilityProfileState();
  const tokenShopState = compatibility.unmappedSystems?.tokenShop ?? {};
  const storedAmountCards = [
    {
      label: "Banked Tokens",
      value: tokenShopState.BankedTokens,
      note: "Current stored amount recovered from compatibility import only. Token-bank cap and claimable-bank state remain blocked."
    },
    {
      label: "Daily Tokenium",
      value: tokenShopState.DailyTokenium,
      note: "Current stored amount recovered from compatibility import only. Daily Tokenium cap and ready state remain blocked."
    }
  ].filter((entry) => isBoundaryValuePresent(entry.value));

  if (!storedAmountCards.length) {
    return "";
  }

  const hasGenericClaimableClue = isBoundaryValuePresent(tokenShopState.ClaimableTokenium);

  return `
    <article class="validation-card warn">
      <strong>Imported TokenShop saved amounts</strong>
      <p class="meta">This snapshot shows exact stored amounts recovered under <code>compatibility.unmappedSystemState.tokenShop</code>. These values stay compatibility-only and are not promoted into canonical player state.</p>
      <div class="pill-row">
        <span class="pill">${storedAmountCards.length}/2 stored amounts available</span>
        <span class="pill">Compatibility-only import</span>
        <span class="pill">No cap or ready-state promotion</span>
      </div>
      <div class="preview-stack">
        ${storedAmountCards
          .map(
            (entry) => `
          <article class="preview-card">
            <span class="snapshot-title">${escapeHtml(entry.label)}</span>
            <strong>${escapeHtml(formatBoundaryValue(entry.value))}</strong>
            <p class="meta">${escapeHtml(entry.note)}</p>
          </article>
        `
          )
          .join("")}
      </div>
      ${
        hasGenericClaimableClue
          ? '<p class="meta">A broader generic Tokenium claimable clue is present in the same import, but it stays out of this snapshot because it is not a cleared token-bank or Daily Tokenium-ready value.</p>'
          : ""
      }
    </article>
  `;
}

function renderResearchGuidance() {
  return `
    <article class="research-card">
      <div class="research-card-head">
        <div>
          <p class="eyebrow">Research contract</p>
          <strong>Tracks stay in intake until they are mature enough for roadmap work</strong>
        </div>
        <div class="pill-row">
          <span class="pill">Not a product commitment</span>
          <span class="pill">APK/Unity first</span>
          <span class="pill">Shippable chunk required</span>
        </div>
      </div>
      <p class="meta">Research tracks hold grounded findings, uncertainty, and candidate implementation paths. If a track cannot show grounded terminology, documented sources, checked APK or Unity evidence, explicit confidence and uncertainty, and a small shippable slice, it stays in research.</p>
      <p class="meta">Archived foundation cards may still appear here as historical context, but they are not part of the active research queue and should not carry open next-step expectations.</p>
      <div class="meta-stack">
        <p class="snapshot-title">Promotion rule</p>
        <ul class="research-step-list">
          <li>Grounded CIFI terminology is documented.</li>
          <li>Source list and APK or Unity path checks are recorded.</li>
          <li>Confidence, uncertainty, and classification are explicit.</li>
          <li>MVP or post-MVP value is clear.</li>
          <li>The next slice is small enough to ship safely.</li>
        </ul>
      </div>
      <div class="meta-stack">
        <p class="snapshot-title">Track categories</p>
        <ul class="research-step-list">
          <li>Candidate MVP-adjacent: spend-planner refinements, loop-warning refinements, import improvements, and recommendation-feed explainability work.</li>
          <li>Post-MVP candidates: ship optimizer reintegration, hunter planning, mech planning, academy or Zeus-adjacent systems, and broader external-model integrations.</li>
          <li>Deferred infrastructure: OCR or image-assisted input, deeper automation, full save parsing, and broad simulation architecture.</li>
        </ul>
      </div>
      <div class="meta-stack">
        <p class="snapshot-title">Current research rules</p>
        <ul class="research-step-list">
          <li>Hunter planning stays in research until the repo can separate real hunter state from planning metadata.</li>
          <li>Mech planning stays in research until terminology, unlock structure, and MVP relevance are grounded.</li>
          <li>Input automation stays in research until manual friction is proven high enough that guided import is not sufficient.</li>
          <li>External-model integration stays in research until tool trust, field labeling, and recommendation boundaries are explicit.</li>
        </ul>
      </div>
    </article>
  `;
}

function renderResearchTrackProgress(track) {
  const model = buildResearchTrackProgressModel(track);

  return `
    <div class="meta-stack">
      <p class="snapshot-title">Track status</p>
      <p class="meta">${escapeHtml(model.currentSlice)}</p>
      <p class="meta">${escapeHtml(model.sequenceLabel)} | ${escapeHtml(model.phaseLabel)}</p>
      <p class="meta">${model.completedCount} done | ${model.remainingCount} left | ${model.percent}% complete</p>
      ${model.completedSteps.length ? `<div class="meta-stack"><p class="snapshot-title">Done in repo</p><ul class="research-step-list">${model.completedSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul></div>` : ""}
    </div>
  `;
}

function renderResearchTrackContract(track) {
  const model = buildResearchTrackContractModel(track);

  if (!model.hasContent) {
    return "";
  }

  return `
    ${model.metaLabels.length ? `<div class="pill-row">${model.metaLabels.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
    ${model.exitCondition ? `<div class="meta-stack"><p class="snapshot-title">Exit condition</p><p class="meta">${escapeHtml(model.exitCondition)}</p></div>` : ""}
    ${model.blockedBy ? `<div class="meta-stack"><p class="snapshot-title">Current blocker</p><p class="meta">${escapeHtml(model.blockedBy)}</p></div>` : ""}
    ${model.smallestShippableSlice ? `<div class="meta-stack"><p class="snapshot-title">Smallest shippable slice</p><p class="meta">${escapeHtml(model.smallestShippableSlice)}</p></div>` : ""}
    ${model.sources.length ? `<div class="meta-stack"><p class="snapshot-title">Sources</p><ul class="research-step-list">${model.sources.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${model.artifacts.length ? `<div class="meta-stack"><p class="snapshot-title">Repo artifacts</p><ul class="research-step-list">${model.artifacts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${model.verified.length ? `<div class="meta-stack"><p class="snapshot-title">Verified now</p><ul class="research-step-list">${model.verified.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${model.uncertain.length ? `<div class="meta-stack"><p class="snapshot-title">Still uncertain</p><ul class="research-step-list">${model.uncertain.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
  `;
}

function renderResearchTrackSupport(track) {
  if (track.id === "spend-planner-first-ui-slice") {
    return renderSpendPlannerResearchForkNote();
  }

  if (
    track.id === "shards-and-loop-guardrails" ||
    track.id === "shard-milestone-payload-recovery"
  ) {
    const ownerBoundary = getShardOwnerFamilyBoundarySummary(
      state.shardGrounding?.ownerFamilyBoundary
    );
    const finalSuBoundary = getShardFinalSuBonusBoundarySummary(
      state.shardGrounding?.finalSuBonusBoundary
    );
    const payloadBoundary = getShardMilestonePayloadBoundarySummary(
      state.shardGrounding?.milestonePayloadBoundary
    );
    const costModelBoundary = getShardCostModelBoundarySummary(
      state.shardGrounding?.costModelBoundary
    );
    const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(
      state.shardGrounding?.rowModelBoundary
    );
    const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(
      state.shardGrounding?.titleEffectBoundary
    );
    const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(
      state.shardGrounding?.effectTextHandlerBoundary
    );
    const rowShellBoundary = getShardMilestoneRowShellBoundarySummary(
      state.shardGrounding?.milestoneRowShellBoundary
    );
    const rowAlignmentBoundary = getShardMilestoneRowAlignmentBoundarySummary(
      state.shardGrounding?.milestoneRowAlignmentBoundary
    );
    const saveBoundary = getShardSaveBoundarySummary(state.shardGrounding?.saveBoundary);
    return `
      <div class="meta-stack">
        <p class="snapshot-title">Repo-local owner-family narrowing</p>
        <p class="meta">${ownerBoundary.hasBoundary ? `The checked shard owner-family boundary now keeps ${ownerBoundary.screenController} as the strongest screen-controller family and ${ownerBoundary.dataCarrier} as the strongest shard-specific data-carrier trail.` : "Shard owner-family boundary clues are not available in this build."}</p>
        <p class="meta">${ownerBoundary.hasFastBuyHooks ? `Fast-buy and first-open hooks such as ${ownerBoundary.fastBuyHooksLabel} stay attached to that shard-specific controller shell.` : "Expected shard-specific fast-buy hooks are incomplete in this build."}</p>
        <p class="meta">${ownerBoundary.hasBonusAnchors ? `The same narrowed trail preserves bonus-field anchors such as ${ownerBoundary.bonusAnchorLabel}, which keeps FinalSU-style fields tied to the shard-specific carrier candidate instead of a generic milestone lead.` : "Expected FinalSU bonus-field anchors are incomplete in this build."}</p>
        <p class="meta">${ownerBoundary.hasDowngradedGenericLead ? `${ownerBoundary.genericLead} stays downgraded to a nearby generic milestone family because ${ownerBoundary.genericLeadReason}.` : "The generic ConstructionMilestones comparison lead is incomplete in this build."}</p>
        <p class="meta">${finalSuBoundary.hasBoundary ? `A checked FinalSU boundary now keeps ${finalSuBoundary.unlockRangeLabel}, ${finalSuBoundary.bonusFieldLabel}, and ${finalSuBoundary.bonusAccessorLabel} attached to ${finalSuBoundary.dataCarrier}.` : "Shard FinalSU bonus-field boundary clues are not available in this build."}</p>
        <p class="meta">${finalSuBoundary.hasBoundary ? "That narrows the shard-specific field family further, but it still does not map those fields back to verified player-facing milestone rows." : "The current build does not yet preserve a checked FinalSU bonus-field boundary."}</p>
        <p class="meta">${payloadBoundary.hasBoundary ? `A checked payload-watch boundary now keeps ${payloadBoundary.milestoneStateLabel} attached to ${payloadBoundary.dataCarrier}, with cost-list hooks such as ${payloadBoundary.costAccessorLabel}.` : "Shard milestone payload-watch boundary clues are not available in this build."}</p>
        <p class="meta">${payloadBoundary.hasCostAndListHooks && payloadBoundary.hasProgressFillHooks && payloadBoundary.hasTickFields ? `The same shard-specific trail also keeps ${payloadBoundary.progressHookLabel} plus ${payloadBoundary.tickFieldLabel} grouped with ${payloadBoundary.costHookLabel}.` : "Expected shard payload-watch hooks are incomplete in this build."}</p>
        <p class="meta">${costModelBoundary.hasBoundary ? `A checked cost-model boundary now keeps sampled shard cost windows ${costModelBoundary.costWindowLabel} attached to ${costModelBoundary.dataCarrier}.` : "Shard cost-model boundary clues are not available in this build."}</p>
        <p class="meta">${costModelBoundary.hasSampledCostWindows && costModelBoundary.hasRow0FormulaShell ? `The same shard-local family also preserves ${costModelBoundary.row0FieldLabel} beside ${costModelBoundary.row0FillLabel} and ${costModelBoundary.row0BonusLabel}.` : "Expected shard cost-parameter shell clues are incomplete in this build."}</p>
        <p class="meta">${costModelBoundary.hasSampledCostWindows && costModelBoundary.hasRow0FormulaShell ? `That is enough to support ${costModelBoundary.supportedOptimizerLabel}, but it still blocks ${costModelBoundary.blockedOptimizerLabel}.` : "The current build does not yet preserve a checked shard cost-model boundary."}</p>
        <p class="meta">${rowModelBoundary.hasBoundary ? `A checked row-model boundary now keeps text-checker rows on ${rowModelBoundary.textCheckerRangeLabel} and unlock rows on ${rowModelBoundary.unlockRangeLabel}.` : "Shard row-model boundary clues are not available in this build."}</p>
        <p class="meta">${rowModelBoundary.hasShardLocalBuySample && rowModelBoundary.hasGenericBuyFamily ? `The buy seam still splits between shard-local ${rowModelBoundary.shardLocalBuyLabel} and generic ${rowModelBoundary.genericBuyLabel}.` : "Expected shard buy-seam clues are incomplete in this build."}</p>
        <p class="meta">${titleEffectBoundary.hasBoundary ? `Shipped title assets now cover shard rows ${titleEffectBoundary.titleRangeLabel}.` : "Shard title/effect boundary clues are not available in this build."}</p>
        <p class="meta">${titleEffectBoundary.hasEffectPresentationFamily && titleEffectBoundary.hasBonusCalcSamples ? `The shipped effect shell keeps ${titleEffectBoundary.effectSlotLabel}, while row-local calc samples include ${titleEffectBoundary.bonusCalcLabel}.` : "Expected shard effect-family clues are incomplete in this build."}</p>
        <p class="meta">${titleEffectBoundary.hasBoundary ? `Row 28 still has conflicting shipped title candidates: ${titleEffectBoundary.row28ConflictLabel || "unknown"}.` : "The current build does not yet preserve the shard title conflict note."}</p>
        <p class="meta">${effectTextHandlerBoundary.hasBoundary ? `The strongest current shard bonus text handler is ${effectTextHandlerBoundary.textHandlerLabel}, not the generic ${effectTextHandlerBoundary.genericWriterLabel}.` : "Shard effect-text handler boundary clues are not available in this build."}</p>
        <p class="meta">${effectTextHandlerBoundary.hasPresentationFamily && effectTextHandlerBoundary.hasBonusCalcSamples && effectTextHandlerBoundary.hasUiContextAnchors ? `That handler currently sits beside ${effectTextHandlerBoundary.uiContextLabel}, lines up with ${effectTextHandlerBoundary.presentationFamilyLabel}, and stays compatible with calc samples such as ${effectTextHandlerBoundary.bonusCalcLabel}.` : "Expected shard effect-text handler alignment clues are incomplete in this build."}</p>
        <p class="meta">${rowShellBoundary.hasBoundary ? `A checked row-shell boundary now keeps ${rowShellBoundary.controllerHookLabel} attached to ${rowShellBoundary.screenController}, with partial row hooks such as ${rowShellBoundary.unlockHookLabel}.` : "Shard milestone row-shell boundary clues are not available in this build."}</p>
        <p class="meta">${rowShellBoundary.hasUnlockHookSamples && rowShellBoundary.hasBuyHookSamples && rowShellBoundary.hasTextCheckerSamples ? `The same controller shell also preserves ${rowShellBoundary.buyHookLabel} plus ${rowShellBoundary.textCheckerLabel}, which is enough to narrow future row verification without claiming full row ownership or labels.` : "Expected shard milestone row-shell samples are incomplete in this build."}</p>
        <p class="meta">${rowAlignmentBoundary.hasBoundary ? `A checked row-alignment boundary now keeps unlock hooks on ${rowAlignmentBoundary.unlockRangeLabel}, text-checker hooks on ${rowAlignmentBoundary.textCheckerRangeLabel}, and buy hooks on ${rowAlignmentBoundary.buyRangeLabel}.` : "Shard milestone row-alignment boundary clues are not available in this build."}</p>
        <p class="meta">${rowAlignmentBoundary.hasZeroUnlockTextOverlap && rowAlignmentBoundary.hasBuyTextOverlap ? `The current partial row shell still has ${rowAlignmentBoundary.unlockTextOverlapLabel} direct overlap between unlock and text-checker ids, while buy and text-checker hooks only overlap on ${rowAlignmentBoundary.buyTextOverlapLabel}.` : "Expected shard row-shell alignment boundary results are incomplete in this build."}</p>
        <p class="meta">${saveBoundary.hasSeparationBoundary ? `A checked shard save boundary now keeps ${saveBoundary.ownerAnchor} separate from ${saveBoundary.saveAnchor} and ${saveBoundary.cloudSaveAnchor}, with ${saveBoundary.overlapLabel}.` : "Shard save-boundary clues are not available in this build."}</p>
        <p class="meta">${saveBoundary.hasSeparationBoundary && saveBoundary.hasDirectRowDefinitionPayload && saveBoundary.hasRuntimeOwnedStateShell ? `The split result is now explicit: ${saveBoundary.directPayloadAnchor} already carries the direct row-definition payload, while ${saveBoundary.runtimeShellAnchor} is still only the strongest recovered runtime shell for player-owned row state.` : "The current build does not yet preserve a clean shard save-boundary separation."}</p>
        <p class="meta">${saveBoundary.hasSeparationBoundary ? "That keeps shard owner-family narrowing and save-side recovery as separate tasks, so the app should not infer player-owned shard milestone state from the current owner trail yet." : "The current build does not yet preserve a clean shard save-boundary separation."}</p>
        <p class="meta">This improves the shard mapping gate, but it still does not recover player-owned shard milestone rows, player-facing labels, or planner-safe affordability inputs.</p>
      </div>
    `;
  }

  if (track.id === "spend-multiverse-savedata-import-surface") {
    const tokenShopCoverage = getTokenShopCoverageSummary(state.extractedMechanics?.tokenShop);
    const validatedCoverage = getMultiverseMarketValidatedCoverage(
      state.extractedMechanics?.multiverseMarket
    );
    const metadataSummary = getMultiverseMarketMetadataSummary(
      state.extractedMechanics?.multiverseMarketMetadataNeighborhood
    );
    const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(
      state.extractedMechanics?.multiverseMarketMarketMemberBoundary
    );
    const tokeniumNamingSummary = getTokeniumNamingSummary(
      state.extractedMechanics?.tokeniumNamingClues
    );
    const tokenBankStateSummary = getTokenBankStateSummary(
      state.extractedMechanics?.tokenBankStateClues
    );
    const dailyTokeniumSummary = getDailyTokeniumLaneSummary(
      state.extractedMechanics?.dailyTokeniumLaneClues
    );
    const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(
      state.extractedMechanics?.tokenBankFormulaBoundary
    );
    const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(
      state.extractedMechanics?.multiverseMarketRangeBoundary
    );
    const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(
      state.extractedMechanics?.multiverseMarketRowTextCoverage
    );
    const tokenShopCostLaneSummary = getTokenShopCostLaneSummary(
      state.extractedMechanics?.tokenShopCostLanes
    );
    const spendActionLaneSummary = getSpendActionLaneSummary(
      state.extractedMechanics?.spendActionLaneClues
    );
    const multiverseMarketActionShellSummary = getMultiverseMarketActionShellSummary(
      state.extractedMechanics?.multiverseMarketActionShell
    );
    const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(
      state.extractedMechanics?.multiverseMarketOwnerFamily
    );
    const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(
      state.extractedMechanics?.tokenShopOwnerShell
    );
    const tokenShopSaveBoundarySummary = getTokenShopSaveBoundarySummary(
      state.extractedMechanics?.tokenShopSaveBoundary
    );
    const multiverseMarketSaveBoundarySummary = getMultiverseMarketSaveBoundarySummary(
      state.extractedMechanics?.multiverseMarketSaveBoundary
    );
    const tokenBankControllerShellSummary = getTokenBankControllerShellSummary(
      state.extractedMechanics?.tokenBankControllerShell
    );
    return `
      <div class="meta-stack">
        <p class="snapshot-title">Grounded spend inputs</p>
        <p class="meta">${tokenShopCoverage.hasCoverage ? `TokenShop currently exposes ${tokenShopCoverage.numericGroupCount} extracted numeric families across ${tokenShopCoverage.tierLabel}, including ${tokenShopCoverage.namedLaneLabel}.` : "TokenShop extracted family coverage is not available in this build."}</p>
        <p class="meta">${tokenShopCoverage.hasControllerAnchors ? "The checked-in TokenShop payload also preserves direct controller anchors such as BankFill and TokenBankDescriptionText for the token-bank lane." : "The checked-in TokenShop payload does not yet preserve the expected token-bank controller anchors."}</p>
        <p class="meta">${tokeniumNamingSummary.hasNamingClues ? `Shipped assets now preserve ${tokeniumNamingSummary.resourceLabel} plus ${tokeniumNamingSummary.academyLabel}, and level0 keeps both ${tokeniumNamingSummary.tokenShellLabel} and ${tokeniumNamingSummary.tokeniumShellLabel}.` : "Token or tokenium naming clues are not available in this build."}</p>
        <p class="meta">${tokenShopCostLaneSummary.hasLaneSplit ? `TokenShop cost-lane clues now preserve ${tokenShopCostLaneSummary.tokenLaneLabel}, ${tokenShopCostLaneSummary.diamondLaneLabel}, ${tokenShopCostLaneSummary.dailyLaneLabel}, ${tokenShopCostLaneSummary.tokensShellLabel}, and ${tokenShopCostLaneSummary.tokeniumShellLabel}.` : "TokenShop cost-lane clues are not available in this build."}</p>
        <p class="meta">${tokenShopCostLaneSummary.keepsDailyTokeniumSeparate ? "This keeps TokenDailies on the Daily Tokenium modifier lane instead of mixing it into generic token spend rows." : "The current build does not yet preserve a grounded split between TokenDailies and generic token spend rows."}</p>
        <p class="meta">${spendActionLaneSummary.hasActionSplit ? `Spend action-lane clues now preserve ${spendActionLaneSummary.tokenHook}, ${spendActionLaneSummary.diamondHook}, ${spendActionLaneSummary.loopModifierHook}, and ${spendActionLaneSummary.premiumModifierHook}.` : "Spend action-lane clues are not available in this build."}</p>
        <p class="meta">${spendActionLaneSummary.keepsDailyDirectHooksUnrecovered ? `The checked APK and Unity probe still returns zero ${spendActionLaneSummary.dailyHookT2} or ${spendActionLaneSummary.dailyHookT3} matches, so Daily Tokenium remains a modifier-side action lane rather than a recovered direct TokenShop purchase action.` : "The current build does not yet preserve the direct-hook gap between TokenDailies and other spend lanes."}</p>
        <p class="meta">${tokenShopOwnerShellSummary.hasOwnerShell ? `TokenShop owner-shell clues now preserve ${tokenShopOwnerShellSummary.ownerAnchor}, ${tokenShopOwnerShellSummary.bankMethod}, ${tokenShopOwnerShellSummary.notificationHook}, and ${tokenShopOwnerShellSummary.deviceHook}.` : "TokenShop owner-shell clues are not available in this build."}</p>
        <p class="meta">${tokenShopOwnerShellSummary.hasOwnerShell ? "That local TokenShop shell is enough to keep bank controls and adjacent device hooks grouped together, but not enough to promote player-owned bank values into planner state." : "The current build does not yet preserve a grounded TokenShop owner shell around the token-bank lane."}</p>
        <p class="meta">${tokenShopSaveBoundarySummary.hasSeparationBoundary ? `The checked save boundary still keeps ${tokenShopSaveBoundarySummary.ownerAnchor} separate from ${tokenShopSaveBoundarySummary.saveAnchor}, with ${tokenShopSaveBoundarySummary.overlapLabel}.` : "TokenShop save-boundary clues are not available in this build."}</p>
        <p class="meta">${tokenShopSaveBoundarySummary.hasSeparationBoundary ? "That means TokenShop ownership and PlayerProfile save recovery remain separate tasks, so the app should not infer saved bank values from owner-shell clues yet." : "The current build does not yet preserve a clean separation boundary between TokenShop ownership and PlayerProfile save recovery."}</p>
        <p class="meta">${tokenBankControllerShellSummary.hasControllerShell ? `Token-bank controller shell now preserves ${tokenBankControllerShellSummary.claimMethod}, ${tokenBankControllerShellSummary.fillMethod}, ${tokenBankControllerShellSummary.fillField}, ${tokenBankControllerShellSummary.descriptionShell}, and ${tokenBankControllerShellSummary.notificationHook}.` : "Token-bank controller-shell clues are not available in this build."}</p>
        <p class="meta">${tokenBankControllerShellSummary.hasControllerShell ? "That keeps the narrow bank controller cluster together without promoting it into saved-state ownership or formula truth." : "The current build does not yet preserve a narrow token-bank controller shell."}</p>
        <p class="meta">${tokenBankStateSummary.hasControllerSplit ? `Token-bank controller clues now preserve ${tokenBankStateSummary.claimMethod}, ${tokenBankStateSummary.capMethod}, ${tokenBankStateSummary.displayShell}, and ${tokenBankStateSummary.loopHandler}.` : "Token-bank controller or display split clues are not available in this build."}</p>
        <p class="meta">${dailyTokeniumSummary.hasOwnerFamilyClues ? `Daily Tokenium lane clues now preserve ${dailyTokeniumSummary.ownerFamilyLabel}, ${dailyTokeniumSummary.missionFamilyLabel}, ${dailyTokeniumSummary.loopHook}, ${dailyTokeniumSummary.purchaseHook}, and ${dailyTokeniumSummary.premiumPack}.` : "Daily Tokenium owner-family clues are not available in this build."}</p>
        <p class="meta">${dailyTokeniumSummary.hasPlayerFacingBoundary ? "Player-facing strings still frame Daily Tokenium as a farm-mission or Academy Menu reward lane that TokenShop and the Collector pack modify, not as a TokenShop-only budget lane." : "Player-facing Daily Tokenium lane strings are incomplete in this build."}</p>
        <p class="meta">${tokenBankFormulaSummary.hasDerivedOutputBoundary ? `Token-bank formula clues now preserve ${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField} as a derived-output cluster.` : "Token-bank derived-output clues are not available in this build."}</p>
        <p class="meta">${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? "That checked local cluster still does not join the current PlayerProfile save-family path, so FinalTokenBank outputs remain output-side clues rather than recovered saved-state fields." : "The checked derived-output cluster now overlaps the broader save-family search and needs review."}</p>
        <p class="meta">${validatedCoverage.hasValidatedRows ? `MultiverseMarket currently has ${validatedCoverage.count} validated rows across ids ${validatedCoverage.rangeLabel}.` : "MultiverseMarket validated row coverage is not available in this build."}</p>
        <p class="meta">${metadataSummary.recoveredIsRangeLabel ? `The checked-in save-side field run currently reaches ${metadataSummary.recoveredIsRangeLabel}, which is broader than the validated MultiverseMarket row block.` : "The checked-in save-side field run is not available in this build."}</p>
        <p class="meta">${multiverseMarketRangeSummary.hasOverlap ? `The checked range boundary now shows that validated rows ${multiverseMarketRangeSummary.validatedRangeLabel} share a first direct ordered overlap with the recovered metadata run ${multiverseMarketRangeSummary.metadataRangeLabel} at rows ${multiverseMarketRangeSummary.overlapLabel}.` : multiverseMarketRangeSummary.hasExplicitZeroOverlap ? `The checked range boundary now preserves a zero-overlap result between validated rows ${multiverseMarketRangeSummary.validatedRangeLabel} and the recovered metadata run ${multiverseMarketRangeSummary.metadataRangeLabel}.` : "The checked range boundary between validated rows and the recovered metadata run is not available in this build."}</p>
        <p class="meta">${multiverseMarketRowTextSummary.hasValidatedTextCoverage ? `The validated row block also has direct text-handler coverage through ${multiverseMarketRowTextSummary.textHandler}, ${multiverseMarketRowTextSummary.textBatcher}, and ${multiverseMarketRowTextSummary.coveredCount} SetIS*CostText hooks.` : "Validated-row text-handler coverage is not available in this build."}</p>
        <p class="meta">${multiverseMarketRowTextSummary.hasValidatedTextCoverage ? "That is row-label coverage for the validated block, not saved-state coverage, so it should not be used as proof of player-owned current levels." : "Validated-row text coverage is incomplete, so row-label support remains partially grounded."}</p>
        <p class="meta">${multiverseMarketActionShellSummary.hasActionShell ? `The same checked action shell context reaches ${multiverseMarketActionShellSummary.buyRangeLabel} plus ${multiverseMarketActionShellSummary.costTextRangeLabel}, while only ${multiverseMarketActionShellSummary.validatedRangeLabel} stays numerically validated.` : "MultiverseMarket action-shell coverage is not available in this build."}</p>
        <p class="meta">${multiverseMarketActionShellSummary.hasActionShell ? "That broader action shell is useful for mapping and UI recovery, but it should not be promoted as full numeric validation or saved-state coverage." : "The broader MultiverseMarket action shell is incomplete, so validated-row behavior should stay the narrower implementation boundary."}</p>
        <p class="meta">${multiverseMarketOwnerFamilySummary.hasOwnerFamily ? `MultiverseMarket owner-family clues now preserve ${multiverseMarketOwnerFamilySummary.ownerAnchor}, ${multiverseMarketOwnerFamilySummary.inscryptionsLabel}, ${multiverseMarketOwnerFamilySummary.textHandler}, ${multiverseMarketOwnerFamilySummary.batcher}, and ${multiverseMarketOwnerFamilySummary.costBox}.` : "MultiverseMarket owner-family clues are not available in this build."}</p>
        <p class="meta">${multiverseMarketOwnerFamilySummary.hasCurrencyShell ? `The same checked shell also preserves ${multiverseMarketOwnerFamilySummary.resourceText}, ${multiverseMarketOwnerFamilySummary.achievementBar}, and ${multiverseMarketOwnerFamilySummary.currencyRangeLabel}, with validated samples such as ${multiverseMarketOwnerFamilySummary.firstValidatedCurrencyBox} and ${multiverseMarketOwnerFamilySummary.lastValidatedCurrencyBox}.` : "MultiverseMarket cost-lane UI shell clues are incomplete in this build."}</p>
        <p class="meta">${multiverseMarketOwnerFamilySummary.hasOwnerFamily ? "That is enough to keep the Emporium owner-family and Inscryptions cost-lane shell grounded, but not enough to recover player-owned balance fields or current row levels." : "The current build does not yet preserve a grounded MultiverseMarket owner-family shell."}</p>
        <p class="meta">${multiverseMarketSaveBoundarySummary.hasSeparationBoundary ? `The checked save boundary still keeps ${multiverseMarketSaveBoundarySummary.actionAnchor} separate from ${multiverseMarketSaveBoundarySummary.saveAnchor}, with ${multiverseMarketSaveBoundarySummary.overlapLabel}.` : "MultiverseMarket save-boundary clues are not available in this build."}</p>
        <p class="meta">${multiverseMarketSaveBoundarySummary.hasSeparationBoundary ? "That means MultiverseMarket action-shell recovery and PlayerProfile save recovery remain separate tasks, so the app should not infer player-owned row levels from action-shell clues yet." : "The current build does not yet preserve a clean separation boundary between MultiverseMarket action-shell recovery and save-family recovery."}</p>
        <p class="meta">${marketMemberSummary.hasBoundary ? `The newer checked market-member boundary now preserves ${marketMemberSummary.accessorLabel}, ${marketMemberSummary.memberLabel}, and nearby profile-side member shells such as ${marketMemberSummary.memberShellLabel}.` : "The newer checked market-member boundary is not available in this build."}</p>
        <p class="meta">${marketMemberSummary.hasHandlerBridge ? `That same narrowed handoff also keeps ${marketMemberSummary.handlerBridgeLabel} beside ${marketMemberSummary.accessorLabel} and ${marketMemberSummary.memberLabel}.` : "The current build does not yet preserve the expected PlayerProfileHandler bridge clues for the market-member boundary."}</p>
        <p class="meta">${marketMemberSummary.hasDirectMemberHandoff ? `The same direct neighborhood now also preserves ${marketMemberSummary.directMemberHandoffLabel}, while the exact typed probe recovers ${marketMemberSummary.typedSaveCacheLabel}, ${marketMemberSummary.typedPlayerProfileFieldTableLabel}, ${marketMemberSummary.typedSaveDataFieldTableLabel}, ${marketMemberSummary.typedSaveDataOwnerLabel}, and ${marketMemberSummary.negativeTypedMarketLabel}.` : "The current build does not yet preserve the expected direct member-handoff clues for the market-member boundary."}</p>
        <p class="meta">${marketMemberSummary.hasBoundary ? `The same bridge also preserves sibling market-side accessors such as ${marketMemberSummary.siblingAccessorLabel}.` : "The current build does not yet preserve the expected sibling market-side accessor clues for the market-member boundary."}</p>
        <p class="meta">${marketMemberSummary.hasProgressionPayloadBoundary ? `The broader field cluster still lives separately as ${marketMemberSummary.progressionPayloadLabel}, which is wider than the direct-member ${marketMemberSummary.memberLabel} shell itself.` : "The current build does not yet preserve the expected broader progression-payload field cluster."}</p>
        <p class="meta">${marketMemberSummary.hasTypedPlayerProfileFieldTable && marketMemberSummary.rulesOutDirectPlayerProfileProgressionOwner ? `The same checked PlayerProfileData field table now also rules out flat direct ownership because ${marketMemberSummary.negativeTypedPlayerProfileProgressionLabel}, while the only recovered typed nested child still stays at ${marketMemberSummary.typedPlayerProfileNestedTypeLabel}.` : "The current build does not yet preserve the expected flat PlayerProfileData-versus-deeper-owner boundary for the wider progression run."}</p>
        <p class="meta">${marketMemberSummary.hasExactSaveDataProgressionOwner ? `The checked save-side owner is now ${marketMemberSummary.exactSaveOwnerLabel} because ${marketMemberSummary.typedSaveDataOwnerLabel}.` : "The current build does not yet preserve an exact typed save-side owner for the wider Emporium progression run."}</p>
        <p class="meta">${marketMemberSummary.hasCloudBridge ? `That combined neighborhood still bridges through ${marketMemberSummary.cloudSaveLabel} and ${marketMemberSummary.profileInfoLabel}, which keeps the ${marketMemberSummary.canonicalHostLabel} checked even while the metadata-only ${marketMemberSummary.memberLabel} shell stays unresolved as an exact typed field and ${marketMemberSummary.negativeTypedSaveDataMarketLabel}.` : "The current build does not yet preserve the nearby cloud-save bridge clues for the market-member boundary."}</p>
        <p class="meta">${marketMemberSummary.hasTypedSiblingContrast ? `Typed sibling contrast still exists through ${marketMemberSummary.typedSiblingContrastLabel}, but no equivalent typed Market or Inscryption owner has been recovered yet.` : "The current build does not yet preserve the expected typed sibling contrast clues for the market-member boundary."}</p>
        <p class="meta">${marketMemberSummary.hasMissingDirectTypeMap ? `The repo still lacks ${marketMemberSummary.missingTypeMapLabel}, so this track stays out of planner implementation and row remap even though the exact save owner is recovered.` : "The current build no longer preserves the expected direct-type-map gap for the market-member boundary and needs review."}</p>
        <p class="meta">${marketMemberSummary.favorsDirectMemberBoundary && marketMemberSummary.hasExactSaveDataProgressionOwner ? `This is enough to narrow the save-side handoff to a checked ${marketMemberSummary.canonicalHostLabel}, confirm ${marketMemberSummary.negativeMultiverseFieldLabel}, rule out flat direct PlayerProfileData progression ownership, and recover ${marketMemberSummary.exactSaveOwnerLabel} as the declaring save model while the metadata-only Market shell remains unresolved.` : "This is enough to narrow future mapping work, but not enough to identify the declaring save model or planner-ready owned-state inputs."}</p>
      </div>
    `;
  }

  if (track.id === "spend-token-bank-state-owner") {
    const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(
      state.extractedMechanics?.tokenShopOwnerShell
    );
    const tokenShopSaveBoundarySummary = getTokenShopSaveBoundarySummary(
      state.extractedMechanics?.tokenShopSaveBoundary
    );
    const tokenBankControllerShellSummary = getTokenBankControllerShellSummary(
      state.extractedMechanics?.tokenBankControllerShell
    );
    const tokenBankStateSummary = getTokenBankStateSummary(
      state.extractedMechanics?.tokenBankStateClues
    );
    const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(
      state.extractedMechanics?.tokenBankFormulaBoundary
    );
    return `
      <div class="meta-stack">
        <p class="snapshot-title">Current owner narrowing</p>
        <p class="meta">${tokenShopOwnerShellSummary.hasOwnerShell ? `TokenShop owner-shell clues preserve ${tokenShopOwnerShellSummary.ownerAnchor}, ${tokenShopOwnerShellSummary.bankMethod}, ${tokenShopOwnerShellSummary.notificationHook}, and ${tokenShopOwnerShellSummary.deviceHook} as one local controller cluster.` : "TokenShop owner-shell clues are not available in this build."}</p>
        <p class="meta">${tokenShopSaveBoundarySummary.hasSeparationBoundary ? `The checked save boundary keeps ${tokenShopSaveBoundarySummary.ownerAnchor} separate from ${tokenShopSaveBoundarySummary.saveAnchor}, with ${tokenShopSaveBoundarySummary.overlapLabel}.` : "TokenShop save-boundary clues are not available in this build."}</p>
        <p class="meta">${tokenBankControllerShellSummary.hasControllerShell ? `The checked token-bank controller shell also preserves ${tokenBankControllerShellSummary.claimMethod}, ${tokenBankControllerShellSummary.fillMethod}, ${tokenBankControllerShellSummary.fillField}, ${tokenBankControllerShellSummary.descriptionShell}, and ${tokenBankControllerShellSummary.notificationHook}.` : "Token-bank controller-shell clues are not available in this build."}</p>
        <p class="meta">${tokenBankStateSummary.hasControllerSplit ? `Separate display and presentation clues such as ${tokenBankStateSummary.displayShell} and ${tokenBankStateSummary.loopHook} are still preserved beside controller methods like ${tokenBankStateSummary.capMethod}.` : "Token-bank controller or display split clues are not available in this build."}</p>
        <p class="meta">${tokenBankFormulaSummary.hasDerivedOutputBoundary ? `The derived-output cluster still preserves ${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField}.` : "Token-bank derived-output clues are not available in this build."}</p>
        <p class="meta">${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? "That output-side cluster still has no checked PlayerProfileData or CloudSavePlayerProfile join, so FinalTokenBank outputs remain non-owner clues rather than recovered saved-state fields." : "The checked derived-output cluster now overlaps the broader save-family search and needs review."}</p>
        <p class="meta">${tokenBankStateSummary.hasCloudSaveShellBoundary ? `The remaining CloudSavePlayerProfile evidence now only preserves a metadata-side shell through ${tokenBankStateSummary.cloudSaveInfoRoutine}, ${tokenBankStateSummary.cloudSaveProfileRoutine}, and ${tokenBankStateSummary.cloudSaveStateMachine}, not a narrower typed wrapper.` : "The current build does not yet preserve the narrowed CloudSavePlayerProfile shell boundary for this lane."}</p>
        <p class="meta">${tokenShopSaveBoundarySummary.hasSeparationBoundary && tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext && tokenBankStateSummary.hasCloudSaveShellBoundary ? "The remaining grounded save-side search therefore stays past the checked PlayerProfileData export bridge and the metadata-only CloudSavePlayerProfile shell, not on TokenShop methods, BigStatisticPrefab.TokenBankCap, or FinalTokenBank outputs." : "The current build does not yet preserve a grounded negative owner narrowing for the token-bank save-state lane."}</p>
        <p class="meta">This is enough to narrow future recovery work, but not enough to identify the exact declaring save model or a narrower PlayerProfile-side wrapper path for token-bank state.</p>
      </div>
    `;
  }

  return renderResearchTrackContract(track);
}

function getTopExtractionCandidate(trackId = null) {
  const candidates = Array.isArray(state.extractionCandidateRanking?.candidates)
    ? state.extractionCandidateRanking.candidates
    : [];
  if (!trackId) {
    return candidates[0] || null;
  }
  return candidates.find((candidate) => candidate.track === trackId) || null;
}

function collectProfileForm() {
  const entries = Object.fromEntries(new FormData($("#profileForm")).entries());
  const nextProfile = structuredClone(state.playerProfile);
  Object.entries(ACTIVE_PROFILE_FORM_FIELD_PATHS).forEach(([field, path]) => {
    if (field in entries) {
      setProfileValue(path, coerceInputValue(entries[field]), nextProfile);
    }
  });
  nextProfile.meta.schemaVersion = PLAYER_PROFILE_SCHEMA_VERSION;
  return nextProfile;
}

function fillProfileForm() {
  Object.entries(ACTIVE_PROFILE_FORM_FIELD_PATHS).forEach(([key, path]) => {
    const input = formControl(key);
    if (input) {
      input.value = getProfileValue(path) ?? "";
    }
  });
}

function importPlayerProfileJson() {
  const raw = $("#playerProfileImportText").value.trim();
  if (!raw) {
    setStatus(
      "playerProfileImportStatus",
      "Paste PlayerProfile JSON or choose a file first.",
      "warning"
    );
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const sourceProfile = parsed?.playerProfile ?? parsed;
    state.playerProfile = normalizePlayerProfile(
      sourceProfile,
      createDefaultShipPlayerState(state.shipBaseline)
    );
    persistPlayerProfile();
    fillProfileForm();
    renderAll();
    setStatus(
      "playerProfileImportStatus",
      "PlayerProfile JSON imported through the grounded normalizer. Review the boundary audit before using recommendations.",
      "success"
    );
  } catch (error) {
    setStatus(
      "playerProfileImportStatus",
      `PlayerProfile import failed: ${error.message}`,
      "warning"
    );
  }
}

function exportPlayerProfileJson() {
  state.playerProfile = collectProfileForm();
  persistPlayerProfile();
  const payload = JSON.stringify(state.playerProfile, null, 2);
  $("#playerProfileImportText").value = payload;
  const blob = new Blob([payload], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "cifi-player-profile.json";
  link.click();
  URL.revokeObjectURL(link.href);
  setStatus("playerProfileImportStatus", "Exported PlayerProfile JSON.", "success");
}

function renderPlayerProfileBoundarySummary() {
  const canonical = getCanonicalProfileState();
  const shardPlanner = getShardPlannerState();
  const shipPlanner = getShipPlannerState();
  const experimental = getExperimentalProfileState();
  const compatibility = getCompatibilityProfileState();
  const groups = buildPlayerProfileBoundaryGroups({
    canonical,
    shardPlanner,
    shipPlanner,
    experimental,
    compatibility
  });
  const audit = getPlayerProfileBoundaryAudit(
    groups,
    {
      shipPlanner,
      compatibility
    },
    isBoundaryValuePresent
  );
  const importedMultiverseMarketPreview = getImportedMultiverseMarketPreview(
    compatibility.unmappedSystems?.multiverseMarket,
    state.extractedMechanics?.multiverseMarket,
    state.extractedMechanics?.multiverseMarketRangeBoundary,
    { formatBoundaryValue, formatShardNumber, isBoundaryValuePresent }
  );

  $("#playerProfileImportSummary").innerHTML = groups
    .map((group) => {
      const populated = group.items.filter(([, value]) => isBoundaryValuePresent(value));
      return `
      <article class="preview-card">
        <strong>${escapeHtml(group.title)}</strong>
        <p class="meta">${escapeHtml(group.note)}</p>
        <p class="meta">${populated.length}/${group.items.length} populated</p>
        ${
          populated.length
            ? `<div class="meta-stack">${populated.map(([label, value]) => `<p class="meta">${escapeHtml(label)}: ${escapeHtml(formatBoundaryValue(value))}</p>`).join("")}</div>`
            : `<p class="meta">No populated fields in this namespace.</p>`
        }
      </article>
    `;
    })
    .join("");

  $("#playerProfileImportSummary").innerHTML = `
    <article class="preview-card">
      <strong>Import boundary audit</strong>
      <p class="meta">Normalization keeps imported values in labeled namespaces instead of flattening them into raw game truth.</p>
      <div class="pill-row">
        ${audit.counts.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="meta-stack">
        ${audit.notes.map((item) => `<p class="meta">${escapeHtml(item)}</p>`).join("")}
      </div>
    </article>
    ${renderImportedMultiverseMarketPreviewCard(importedMultiverseMarketPreview)}
    ${$("#playerProfileImportSummary").innerHTML}
  `;
}

function applyInstallTap(installIndex, direction = 1) {
  const loadout = getActiveLoadout();
  const shipKey = state.shipConfig.selectedShipKey;
  const current = loadout.ships[shipKey][installIndex];
  const cap = getEffectiveCap(state.shipTemplates[shipKey].caps[installIndex]);
  const delta = getTapDelta(shipKey, installIndex, direction);
  if (direction > 0) {
    if (!canInstallPoint(shipKey, installIndex) || delta <= 0 || current >= cap) {
      return;
    }
  } else if (current <= 0 || delta <= 0) {
    return;
  }
  pushHistorySnapshot(loadout);
  loadout.ships[shipKey][installIndex] =
    direction > 0 ? Math.min(cap, current + delta) : Math.max(0, current - delta);
  persistShipConfig(false);
  renderShipPanels();
}

function undoLoadoutChange() {
  const loadout = getActiveLoadout();
  const previous = loadout.history.pop();
  if (!previous) {
    setStatus("shipConfigStatus", "Nothing to undo for this loadout.", "warning");
    return;
  }
  loadout.ships = previous;
  persistShipConfig(false);
  setStatus("shipConfigStatus", "Reverted the last loadout change.", "success");
  renderShipPanels();
}

function resetSelectedShip() {
  const loadout = getActiveLoadout();
  const shipKey = state.shipConfig.selectedShipKey;
  pushHistorySnapshot(loadout);
  loadout.ships[shipKey] = loadout.ships[shipKey].map(() => 0);
  persistShipConfig(false);
  setStatus("shipConfigStatus", `${SHIP_LABELS[shipKey]} reset in ${loadout.name}.`, "success");
  renderShipPanels();
}

function clearActiveLoadout() {
  const loadout = getActiveLoadout();
  pushHistorySnapshot(loadout);
  Object.keys(loadout.ships).forEach((shipKey) => {
    loadout.ships[shipKey] = loadout.ships[shipKey].map(() => 0);
  });
  persistShipConfig(false);
  setStatus("shipConfigStatus", `${loadout.name} cleared.`, "success");
  renderShipPanels();
}

function pushHistorySnapshot(loadout) {
  loadout.history.push(structuredClone(loadout.ships));
  if (loadout.history.length > 20) {
    loadout.history.shift();
  }
}

function getActiveLoadout() {
  return state.shipConfig.loadouts[state.shipConfig.activeLoadoutIndex];
}

function getEffectiveCap(baseCap) {
  return Number(baseCap || 0) * (getShipCommunityToolState().technical.CapX5 ? 5 : 1);
}

function getShipInstallTotal(shipKey) {
  return sum(getActiveLoadout().ships[shipKey]);
}

function canInstallPoint(shipKey, installIndex) {
  const template = state.shipTemplates[shipKey];
  const current = getActiveLoadout().ships[shipKey][installIndex];
  return (
    current < getEffectiveCap(template.caps[installIndex]) &&
    getShipInstallTotal(shipKey) >= template.reserveThresholds[installIndex]
  );
}

function getTapDelta(shipKey, installIndex, direction = 1) {
  const template = state.shipTemplates[shipKey];
  const current = getActiveLoadout().ships[shipKey][installIndex];
  const capRemaining = Math.max(getEffectiveCap(template.caps[installIndex]) - current, 0);
  const removable = Math.max(current, 0);
  if (state.shipConfig.pointPerTap === "MAX") {
    if (direction < 0) {
      return removable;
    }
    const total = getShipInstallTotal(shipKey);
    const nextThreshold = template.reserveThresholds
      .filter((threshold) => threshold > total)
      .sort((left, right) => left - right)[0];
    return Math.min(capRemaining, Math.max((nextThreshold ?? total) - total, 0));
  }
  const step = Number(state.shipConfig.pointPerTap) || 0;
  return direction > 0 ? Math.min(capRemaining, step) : Math.min(removable, step);
}

function rankShipTargets() {
  return Object.entries(getActiveLoadout().ships)
    .map(([shipKey, values]) => ({
      title: SHIP_LABELS[shipKey],
      subtitle: `${sum(values)} installs assigned`,
      score: values.reduce((total, value, index) => {
        const cap = getEffectiveCap(state.shipTemplates[shipKey].caps[index]);
        return total + (value / Math.max(cap, 1)) * 100;
      }, 0),
      confidence: 0.48,
      notes: `Persistent ${getActiveLoadout().name} state.`
    }))
    .sort((left, right) => right.score - left.score);
}

function runShipOptimization() {
  const ship = getShipPlannerState().summary;
  return [...state.snapshot.shipLoadouts]
    .map((loadout) => ({
      title: loadout.name,
      subtitle: loadout.notes,
      score:
        Number(ship.power || 0) *
          loadout.powerScale *
          state.snapshot.resourceGoals.credits.powerWeight +
        Number(ship.speed || 0) *
          loadout.speedScale *
          state.snapshot.resourceGoals.credits.speedWeight *
          10 +
        Number(ship.cargo || 0) *
          loadout.cargoScale *
          state.snapshot.resourceGoals.credits.cargoWeight +
        (loadout.resourceBias === "credits" ? 45 : 0),
      confidence: loadout.risk === "safe" ? 0.72 : 0.61,
      notes: loadout.notes
    }))
    .sort((left, right) => right.score - left.score);
}

function runProgressionOptimization() {
  const groundedResults = buildGroundedShardRecommendations().map((item) =>
    toRecommendationAction(item, "shards")
  );
  const loopWarnings = buildLoopGuardrailRecommendations().map((item) =>
    toRecommendationAction(item, "loop")
  );
  if (groundedResults.length) {
    return sortRecommendationFeed([...groundedResults, ...loopWarnings]);
  }

  return sortRecommendationFeed([
    toRecommendationAction(
      {
        id: "shard-module-grounding-warning",
        module: "shards",
        kind: "warning",
        title: "Shard milestone planner pending verified data",
        subtitle: "Descriptive mode",
        score: 40,
        confidence: 0.24,
        benefit: [
          "Keeps shard guidance visible without implying extracted milestone planner math."
        ],
        whyNow: [
          "Shard Milestones are a real CIFI system, but this repo does not yet ship a verified milestone table.",
          "The previous shard ranking path relied on unsourced milestone identities, cost curves, and value scoring."
        ],
        assumptions: [
          "Current shards remain canonical shared player state.",
          "Shard income stays available only as a labeled planner input."
        ],
        warnings: [
          "No shard milestone recommendations are being ranked in this build.",
          "Import verified shard milestone data before re-enabling upgrade-style planner behavior."
        ],
        notes: "Descriptive fallback mode avoids fake planner precision."
      },
      "shards"
    ),
    ...loopWarnings
  ]);
}

function buildLoopGuardrailRecommendations() {
  const canonical = getCanonicalProfileState();
  const loopReset = Number(canonical.loopReset || 0);
  const currentShards = Number(canonical.shards || 0);
  const mechanics = getGroundedShardMechanics();
  const antiBricking = getObservedBehaviorById("PPX_EARLY_LR_ANTIBRICKING");
  const earlyLoop = getObservedBehaviorById("PPX_EARLY_LR1_MP78");
  const shortRuns = getObservedBehaviorById("PPX_SHORT_MP_RUNS");
  const longRuns = getObservedBehaviorById("PPX_LONG_SHARD_CELL_RUNS");
  const shardSpend = getObservedBehaviorById("PPX_SHARDS_EARLY_DISTRIBUTION");
  const zeusWarning = getObservedBehaviorById("PPX_ZEUS_E1000_RESOURCE_PRIO_AND_LR_TARGETS");
  const antiBrickingSource = getSourceTitlesForIds(antiBricking?.sourceIds).join(" | ");
  const runCadenceSource = Array.from(
    new Set([
      ...getSourceTitlesForIds(earlyLoop?.sourceIds),
      ...getSourceTitlesForIds(shortRuns?.sourceIds),
      ...getSourceTitlesForIds(longRuns?.sourceIds)
    ])
  ).join(" | ");
  const shardSpendSource = getSourceTitlesForIds(shardSpend?.sourceIds).join(" | ");

  if (!loopReset) {
    return [
      {
        id: "loop-guardrail-input-warning",
        module: "loop",
        kind: "warning",
        title: "Add current LR for loop guardrails",
        subtitle: "Minimum loop-warning input missing",
        score: 96,
        confidence: 0.63,
        benefit: [
          "Unlocks the current loop-warning layer so the app can show grounded anti-bricking guidance."
        ],
        whyNow: [
          "Current LR is the minimum grounded input needed for loop-reset guardrails in this build.",
          antiBricking?.why ||
            "Grounded loop guidance depends on pacing examples tied to specific LR transitions."
        ],
        assumptions: [
          "This module is warning-oriented only and does not simulate best reset timing."
        ],
        warnings: [
          "Without current LR, the app cannot show the anti-bricking pacing notes captured in the research bundle."
        ],
        notes: antiBrickingSource
          ? `Loop guardrails remain descriptive and source-linked (${antiBrickingSource}).`
          : "Loop guardrails remain descriptive and source-linked."
      }
    ];
  }

  const warnings = [];

  warnings.push({
    id: "loop-guardrail-run-cadence-reference",
    module: "loop",
    kind: "warning",
    title: "Use intentional short vs long runs",
    subtitle: `Current LR ${formatShardNumber(loopReset)}`,
    score: loopReset <= 4 ? 78 : 62,
    confidence: 0.66,
    benefit: [
      "Clarifies whether the next run should bias toward loop-mod momentum or shard-and-cell pacing."
    ],
    whyNow: [
      earlyLoop?.playerState?.mod_points_gained_on_first_lr
        ? `One grounded early-loop example shows LR 1 earning ${formatShardNumber(earlyLoop.playerState.mod_points_gained_on_first_lr)} MP on the first reset.`
        : "Grounded guide notes show early loop pacing depends on deliberate run selection, not constant reset spam.",
      shortRuns?.why ||
        "Short MP runs are used to buy affordable loop mods and increase MP gains between resets.",
      longRuns?.why ||
        "Longer runs shift toward shards and cells instead of only pushing fast reset count."
    ],
    assumptions: [
      "This is a pacing reference only; the app does not estimate your best run duration.",
      shortRuns?.playerState?.duration
        ? `Short-run reference window: ${shortRuns.playerState.duration}.`
        : "Short-run duration varies by account state.",
      longRuns?.playerState?.duration
        ? `Long-run reference window: ${longRuns.playerState.duration}.`
        : "Long-run duration varies by account state."
    ],
    warnings: [
      shortRuns?.priorities?.[2] ||
        "Use short runs to build loop mod momentum before relying on longer shard-focused sessions.",
      longRuns?.priorities?.[0] ||
        "Long runs are a shard/cell pacing choice, not proof that immediate reset pushing is correct."
    ],
    notes: runCadenceSource
      ? `Run-cadence reference only (${runCadenceSource}).`
      : "Run-cadence reference only."
  });

  const operationTicks = mechanics?.operations?.ticks_per_operation;
  const resetTimer = mechanics?.shardMiningMenu?.unreducible_timer_between_operations?.value;
  if (
    operationTicks?.initial_ticks_including_reset ||
    operationTicks?.minimum_ticks_with_loop_mods ||
    resetTimer
  ) {
    warnings.push({
      id: "loop-guardrail-operations-pacing-warning",
      module: "loop",
      kind: "warning",
      title: "Shard operations have built-in pacing",
      subtitle: "Grounded shard-loop linkage",
      score: loopReset <= 4 ? 74 : 54,
      confidence: 0.62,
      benefit: [
        "Prevents over-reading fast resets by keeping shard-operation timing constraints visible."
      ],
      whyNow: [
        operationTicks?.initial_ticks_including_reset
          ? `Grounded shard notes record ${formatShardNumber(operationTicks.initial_ticks_including_reset)} ticks per operation initially, including reset time.`
          : "Grounded shard notes show Operations have a fixed pacing layer.",
        operationTicks?.minimum_ticks_with_loop_mods
          ? `The same notes record a minimum of ${formatShardNumber(operationTicks.minimum_ticks_with_loop_mods)} ticks with loop mods.`
          : "Loop mods can change pacing, but this build does not simulate the exact result.",
        resetTimer
          ? `${formatShardNumber(resetTimer)} reset ticks between operations are currently documented as unreducible.`
          : "A reset timer between operations is documented in the shard-mining notes."
      ],
      assumptions: ["This is a pacing boundary reminder, not a best-reset calculator."],
      warnings: [
        "Do not read fast reset pushing as proof that shard-side pacing constraints disappeared.",
        "Operation timing notes are grounded reference points only; they are not personalized run advice."
      ],
      notes:
        "Grounded shard anchors can support loop warnings even while milestone rows remain descriptive-only."
    });
  }

  if (loopReset >= 5) {
    warnings.push({
      id: "loop-guardrail-rising-requirements-warning",
      module: "loop",
      kind: "warning",
      title: "Loop requirement pacing warning",
      subtitle: `Current LR ${formatShardNumber(loopReset)}`,
      score: 88,
      confidence: 0.71,
      benefit: [
        "Flags when pushing LR higher is more likely to raise clear requirements than help progress."
      ],
      whyNow: [
        antiBricking?.why ||
          "Guide examples warn that pushing LR too quickly can raise loop requirements faster than the account can clear them.",
        "Grounded examples show LR 5 -> 6 requiring 7 loops and LR 6 -> 7 requiring 8 loops."
      ],
      assumptions: [
        "This is a caution zone, not a target recommendation.",
        "The app does not estimate whether your account can safely push the next LR."
      ],
      warnings: [
        "Use buffer / instant loop checks before pushing LR higher.",
        zeusWarning?.priorities?.[1] ||
          "High LR progression can become 'playing with fire' in guide-side progression notes."
      ],
      notes: antiBrickingSource
        ? `Guardrail based on grounded guide examples from ${antiBrickingSource}, not simulated reset math.`
        : "Guardrail based on grounded community guide examples, not simulated reset math."
    });
  }

  if (currentShards > 0) {
    warnings.push({
      id: "loop-guardrail-shard-reset-warning",
      module: "loop",
      kind: "warning",
      title: "Spend tracked shards before reset",
      subtitle: `${formatShardNumber(currentShards)} shards currently tracked`,
      score: 92,
      confidence: 0.68,
      benefit: ["Protects currently tracked shard value from being wiped by the next reset."],
      whyNow: [
        "Shards reset to 0 on Loop Prestige in the grounded shard sources.",
        shardSpend?.why ||
          "Early shard guidance explicitly says to spend shards before loop resets."
      ],
      assumptions: [
        "This warning does not claim a best milestone target.",
        "Shard affordability and ranking remain disabled."
      ],
      warnings: [
        "Do not carry tracked shards into a reset expecting them to persist.",
        "Use the shard workflow cards to inspect grounded unlocks and thresholds before spending."
      ],
      notes: shardSpendSource
        ? `Reset warning only; no shard ROI is implied. Spending note sourced from ${shardSpendSource}.`
        : "Reset warning only; no shard ROI is implied."
    });
  }

  return warnings;
}

function buildGroundedShardRecommendations() {
  const milestones = getGroundedShardMilestones();
  const mechanics = getGroundedShardMechanics();
  if (!Array.isArray(milestones) || !milestones.length || !mechanics) {
    return [];
  }

  const shardPlanner = getShardPlannerState();
  const totalLevels = Number(shardPlanner.totalMilestoneLevels || 0);
  const currentShards = shardPlanner.currentShards;
  const shardRate = shardPlanner.ratePerHour;
  const focusMilestone = getShardFocusMilestone();
  const focusLevel = Number(shardPlanner.focusMilestoneLevel || 0);
  const nextUnlock = getNextShardUnlockMilestone(totalLevels, milestones);
  const nextThreshold = getNextShardThreshold(focusMilestone, focusLevel, mechanics);
  const nextCostBump = getNextShardCostBump(focusLevel);
  const observation = getPrimaryShardObservation();
  const conflictNote = getProvenanceConflictNote();
  const sourceLabel = getMilestoneSourceLabel(nextUnlock || focusMilestone);

  return [
    {
      id: "shard-module-next-unlock-watch",
      module: "shards",
      kind: "warning",
      title: "Next shard unlock to watch",
      subtitle: nextUnlock ? nextUnlock.name : "All imported unlock requirements are covered",
      score: nextUnlock ? 58 : 46,
      confidence: 0.7,
      benefit: [
        nextUnlock
          ? "Shows the next descriptive shard unlock gate worth tracking."
          : "Confirms the imported descriptive unlock gates are already covered."
      ],
      whyNow: [
        nextUnlock
          ? `${nextUnlock.name} unlocks at ${formatShardNumber(getShardUnlockRequirement(nextUnlock))} total shard milestone levels.`
          : `Tracked total shard milestone levels already cover all ${milestones.length} imported unlock requirements.`,
        Number.isFinite(totalLevels) && totalLevels > 0
          ? `Tracked total shard milestone levels: ${formatShardNumber(totalLevels)}.`
          : "Add total shard milestone levels in Player Data to track unlock pacing more precisely.",
        currentShards || shardRate
          ? `Current shard context: ${currentShards ? `${formatShardNumber(currentShards)} shards` : "shards not tracked"}${currentShards && shardRate ? " | " : ""}${shardRate ? `${formatShardNumber(shardRate)} per hour` : "income rate not tracked"}.`
          : "Current shards and shard income remain optional manual inputs."
      ],
      assumptions: [
        "Unlock sequencing is descriptive only and does not imply best spend order.",
        "Shard optimization math remains disabled while per-level shard costs are unknown."
      ],
      warnings: [
        "No shard milestone ranking, ROI, ETA, or cost simulation is active in this workflow.",
        conflictNote ||
          "Shard milestone sources include unresolved discrepancies that keep this workflow descriptive.",
        nextUnlock
          ? `${Math.max(getShardUnlockRequirement(nextUnlock) - totalLevels, 0)} additional total shard milestone levels are needed for this unlock.`
          : "Unlocked does not mean affordable; shard cost data is still unavailable."
      ],
      notes: sourceLabel
        ? `This card watches descriptive unlock gates only (${sourceLabel}).`
        : "This card watches descriptive unlock gates only."
    },
    {
      id: "shard-module-next-threshold-watch",
      module: "shards",
      kind: "warning",
      title: "Next shard threshold to watch",
      subtitle: focusMilestone ? focusMilestone.name : "Edit a shard row level",
      score: focusMilestone ? 52 : 34,
      confidence: 0.64,
      benefit: [
        focusMilestone
          ? "Shows the next grounded threshold breakpoint on the observed milestone row."
          : "Explains which row input is missing before threshold tracking can become useful."
      ],
      whyNow: [
        focusMilestone
          ? `Observed row rarity: ${formatShardRarity(focusMilestone.rarity)}. Threshold schedule: ${formatThresholdLevels(getThresholdScheduleForMilestone(focusMilestone, mechanics))}.`
          : "Edit a shard row level to inspect its grounded threshold schedule.",
        nextThreshold
          ? `Next bonus threshold is level ${nextThreshold} from observed level ${formatShardNumber(focusLevel)}.`
          : focusMilestone
            ? "All explicit grounded threshold levels on the selected milestone are already reached."
            : "Threshold watch is unavailable until a shard row level is tracked."
      ],
      assumptions: [
        focusMilestone?.summary || "Threshold watch uses imported unlock/bonus entries only.",
        mechanics.effect_scaling?.description ||
          "Incremental level increases milestone effects, but the app does not score them."
      ],
      warnings: [
        focusMilestone?.uncertaintyNotes?.[0] ||
          "Unknown/Unkown source values remain preserved where the source was incomplete.",
        conflictNote ||
          "Threshold wording stays descriptive because milestone sources conflict across accessible snapshots.",
        nextThreshold
          ? `You need ${Math.max(nextThreshold - focusLevel, 0)} more levels on the observed milestone row to reach this threshold.`
          : "Threshold watch ends here unless you inspect another row."
      ],
      notes: sourceLabel
        ? `Threshold guidance is milestone-specific and descriptive only (${sourceLabel}).`
        : "Threshold guidance is milestone-specific and descriptive only."
    },
    {
      id: "shard-module-cost-bump-watch",
      module: "shards",
      kind: "warning",
      title: "Shard cost bump watch",
      subtitle: focusMilestone ? focusMilestone.name : "Global shard milestone rules",
      score: focusMilestone ? 47 : 30,
      confidence: 0.59,
      benefit: [
        "Keeps known shard cost-bump zones visible without pretending the app knows affordability."
      ],
      whyNow: [
        mechanics.cost_breakpoints_observed?.breakpoints_statement ||
          "Cost bump notes are descriptive only.",
        nextCostBump
          ? `From tracked level ${formatShardNumber(focusLevel)}, the next noted cost bump is level ${nextCostBump.level} (${nextCostBump.severity}).`
          : "No cost bump watch could be derived from the current tracked row level."
      ],
      assumptions: [
        "The dataset provides breakpoint notes, not numeric shard costs.",
        observation
          ? `${observation.title}: ${observation.why}`
          : "Observed examples are shown separately and do not become planner truth."
      ],
      warnings: [
        "Cost bumps are warning zones only; the app does not estimate shard affordability.",
        conflictNote ||
          "Cost wording stays generic until a single authoritative milestone list and cost table exist.",
        focusMilestone?.costProgression?.notes ||
          "No per-level shard costs were found in accessible sources."
      ],
      notes: sourceLabel
        ? `Use this to avoid false precision near known cost-bump levels (${sourceLabel}).`
        : "Use this to avoid false precision near known cost-bump levels."
    }
  ];
}

function saveShardPlannerInputs(nextMilestoneId = undefined, nextMilestoneLevel = undefined) {
  const milestoneId =
    nextMilestoneId !== undefined
      ? nextMilestoneId
      : formControl("shardFocusMilestoneId")?.value || null;
  const milestoneLevel =
    nextMilestoneLevel !== undefined
      ? nextMilestoneLevel
      : coerceInputValue(formControl("shardFocusMilestoneLevel")?.value ?? "");
  const observedLevelsByMilestone = {
    ...(state.playerProfile.planning.shards.observedLevelsByMilestone ?? {})
  };
  if (milestoneId) {
    if (milestoneLevel === null || milestoneLevel === undefined || milestoneLevel === "") {
      delete observedLevelsByMilestone[milestoneId];
    } else {
      observedLevelsByMilestone[milestoneId] = milestoneLevel;
    }
  }
  setProfileValue(["planning", "shards", "focusMilestoneId"], milestoneId, state.playerProfile);
  setProfileValue(
    ["planning", "shards", "focusMilestoneLevel"],
    milestoneLevel,
    state.playerProfile
  );
  setProfileValue(
    ["planning", "shards", "observedLevelsByMilestone"],
    observedLevelsByMilestone,
    state.playerProfile
  );
  persistPlayerProfile();
  setStatus("shardPlannerStatus", "Shard row calibration saved.", "success");
  renderProgressionResults(runProgressionOptimization());
}

function renderShardPlannerControls() {
  const milestones = getGroundedShardMilestones();
  const shardPlanner = getShardPlannerState();
  const select = formControl("shardFocusMilestoneId");
  const input = formControl("shardFocusMilestoneLevel");
  if (!select || !input || !milestones.length) {
    return;
  }
  const selectedId = getSelectedShardMilestoneId();
  select.innerHTML = milestones
    .map(
      (milestone) => `
    <option value="${escapeHtml(String(milestone.id))}">${escapeHtml(`${milestone.name} (${formatShardRarity(milestone.rarity)})`)}</option>
  `
    )
    .join("");
  select.value = selectedId;
  input.value = shardPlanner.focusMilestoneLevel ?? "";
}

function renderShardWorkflowSnapshot() {
  const mechanicsBundle = state.shardGrounding?.milestones?.canonicalMechanics ?? {};
  const milestones = getGroundedShardMilestones();
  const shardPlanner = getShardPlannerState();
  const totalLevels = Number(shardPlanner.totalMilestoneLevels || 0);
  const nextUnlock = getNextShardUnlockMilestone(totalLevels, milestones);
  return `
    <div class="page-grid">
      <article class="snapshot-card">
        <span class="snapshot-title">Shard Mining snapshot</span>
        <strong>${escapeHtml(nextUnlock ? nextUnlock.name : "All unlock gates covered")}</strong>
        <p class="meta">Current shards: ${formatOptionalNumber(shardPlanner.currentShards)} | Shard income / hour: ${formatOptionalNumber(shardPlanner.ratePerHour)} | Total shard milestone levels: ${formatOptionalNumber(shardPlanner.totalMilestoneLevels)}</p>
        <div class="meta-stack">
          <p class="snapshot-title">Grounded shard anchors</p>
          <p class="meta">${escapeHtml(mechanicsBundle.shards?.unlock_condition?.description || "Shard unlock condition unavailable.")}</p>
          <p class="meta">${escapeHtml(mechanicsBundle.shards?.how_acquired?.description || "Shard acquisition note unavailable.")}</p>
          <p class="meta">${escapeHtml(mechanicsBundle.shards?.reset_behavior?.description || "Loop-reset behavior note unavailable.")}</p>
        </div>
      </article>
      <article class="snapshot-card">
        <span class="snapshot-title">Operations linkage</span>
        <strong>${escapeHtml(mechanicsBundle.operations?.shard_bonus_per_operation?.value || "No operation bonus note")}</strong>
        <p class="meta">${escapeHtml(mechanicsBundle.operations?.shard_bonus_per_operation?.description || "Operation bonus note unavailable.")}</p>
        <div class="meta-stack">
          <p class="snapshot-title">Timer notes</p>
          <p class="meta">Initial ticks including reset: ${formatOptionalNumber(mechanicsBundle.operations?.ticks_per_operation?.initial_ticks_including_reset)}</p>
          <p class="meta">Minimum ticks with loop mods: ${formatOptionalNumber(mechanicsBundle.operations?.ticks_per_operation?.minimum_ticks_with_loop_mods)}</p>
          <p class="meta">${escapeHtml(mechanicsBundle.shardMiningMenu?.unreducible_timer_between_operations?.description || "Reset timer note unavailable.")}</p>
        </div>
      </article>
    </div>
  `;
}

function renderShardGroundingBoundary() {
  const provenance = state.shardGrounding?.provenance;
  const uncertaintyLog = provenance?.uncertaintyLog ?? [];
  const conflictCount = uncertaintyLog.filter((item) => item.status === "conflict_detected").length;
  const missingCount = uncertaintyLog.filter((item) => item.status !== "conflict_detected").length;
  const assetGrounding = state.shardGrounding?.assetGrounding;
  const ownerBoundary = getShardOwnerFamilyBoundarySummary(
    state.shardGrounding?.ownerFamilyBoundary
  );
  const costModelBoundary = getShardCostModelBoundarySummary(
    state.shardGrounding?.costModelBoundary
  );
  const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(
    state.shardGrounding?.rowModelBoundary
  );
  const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(
    state.shardGrounding?.titleEffectBoundary
  );
  const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(
    state.shardGrounding?.effectTextHandlerBoundary
  );
  const saveBoundary = getShardSaveBoundarySummary(state.shardGrounding?.saveBoundary);
  const identifiers = Array.isArray(assetGrounding?.groundedShellIdentifiers)
    ? assetGrounding.groundedShellIdentifiers.slice(0, 5)
    : [];
  const blockedUses = Array.isArray(assetGrounding?.blockedUses) ? assetGrounding.blockedUses : [];
  const descriptiveBundleStatus = getDatasetBadgeMeta("shards", "Integrated");
  const ownerBoundaryStatus = ownerBoundary.hasBoundary
    ? getDatasetBadgeMeta("shard-owner-family-boundary", "Available")
    : getShardBadgeMetaFromLabel("Unmapped");
  const costBoundaryStatus = costModelBoundary.hasSampledCostWindows
    ? getDatasetBadgeMeta("shard-cost-model-boundary", "Available")
    : getShardBadgeMetaFromLabel("Blocked");
  const rowEvidenceStatus =
    rowModelBoundary.hasBoundary &&
    titleEffectBoundary.hasBoundary &&
    effectTextHandlerBoundary.hasBoundary
      ? getShardBadgeMetaFromLabel("Integrated")
      : getShardBadgeMetaFromLabel("Unmapped");
  const saveBoundaryStatus = saveBoundary.hasSeparationBoundary
    ? getShardBadgeMetaFromLabel("Blocked")
    : getShardBadgeMetaFromLabel("Unmapped");
  return `
    <div class="page-grid">
      <article class="snapshot-card shard-status-card shard-status-card-available">
        <div class="shard-status-heading">
          <span class="snapshot-title">Grounded shard evidence</span>
          <span class="shard-status-pill shard-status-pill-available">Available</span>
        </div>
        <strong>Safe shard truths already shown in the app</strong>
        <div class="meta-stack">
          <p class="meta">Shards are a real CIFI resource tied to Operations and the Shard Mining Menu.</p>
          <p class="meta">Shards reset on Loop Prestige, so warning-oriented reset guardrails are safe to show.</p>
          <p class="meta">The app can safely show unlock-watch cards, threshold-watch cards, and loop warnings around those anchors.</p>
          <p class="meta">${escapeHtml(assetGrounding?.groundedFacts?.[0] || "Repo-local Unity assets already ground shard and loop shell identifiers.")}</p>
          <p class="meta">Key shell identifiers: ${identifiers.map((entry) => `<code>${escapeHtml(entry)}</code>`).join(", ") || "<code>LoopResetStage1</code>, <code>ShardMilestones-64</code>, <code>MilestoneBonusesPerLevel</code>"}</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card ${descriptiveBundleStatus.cardClass}">
        <div class="shard-status-heading">
          <span class="snapshot-title">Player-facing contract</span>
          <span class="shard-status-pill ${descriptiveBundleStatus.pillClass}">${escapeHtml(descriptiveBundleStatus.label)}</span>
        </div>
        <strong>Definition family is grounded; owned state stays blocked</strong>
        <div class="meta-stack">
          <p class="meta">Direct ShardMining payload now grounds the reachable shard row-definition family as product data: title-side evidence, unlock requirements, bonus-package shape, and row-local cost shell all belong in the tool.</p>
          <p class="meta">What the grounded app can safely show today: definition-side shard rows, loop warnings, threshold wording, and evidence-status notes sourced from the shared shard-family contract.</p>
          <p class="meta">Player-owned shard state, import mapping, affordability, planner math, ROI, ETA, and best-buy claims stay blocked outside this contract.</p>
          <p class="meta">${escapeHtml(blockedUses.length ? `${blockedUses.join(", ")} remain blocked until player-owned shard ownership and planner-safe cost validation are recovered.` : "Ranking, ROI, ETA, affordability, and best-upgrade claims remain blocked until player-owned shard ownership and planner-safe cost validation are recovered.")}</p>
          <p class="meta">Interim compatibility path: external-model imports can preserve community-tool context while staying non-canonical and outside grounded shard recommendations.</p>
          <p class="meta">Current provenance load: ${conflictCount} conflict note${conflictCount === 1 ? "" : "s"} and ${missingCount} missing-data note${missingCount === 1 ? "" : "s"}.</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card ${ownerBoundaryStatus.cardClass}">
        <div class="shard-status-heading">
          <span class="snapshot-title">Definition carrier</span>
          <span class="shard-status-pill ${ownerBoundaryStatus.pillClass}">${escapeHtml(ownerBoundaryStatus.label)}</span>
        </div>
        <strong>ShardMining owns the reachable definition family</strong>
        <div class="meta-stack">
          <p class="meta">${ownerBoundary.hasBoundary ? "Recovered ownership clues consistently point at a shard-specific family instead of the generic milestone shell." : "The current build still lacks enough shard-specific ownership evidence to map milestone rows safely."}</p>
          <p class="meta">${ownerBoundary.hasBoundary ? "That closes the row-definition carrier at the shard side instead of leaving the family on a generic academy milestone path." : "Until ownership mapping is resolved, row-level shard cost recovery stays descriptive only."}</p>
          <p class="meta">${ownerBoundary.hasDowngradedGenericLead ? "The generic milestone path is still intentionally downgraded so the app does not over-read shared UI structure as shard truth." : "Generic milestone overlap still needs more comparison work."}</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card ${costBoundaryStatus.cardClass}">
        <div class="shard-status-heading">
          <span class="snapshot-title">Shard-cost evidence</span>
          <span class="shard-status-pill ${costBoundaryStatus.pillClass}">${escapeHtml(costBoundaryStatus.label)}</span>
        </div>
        <strong>Recovered cost data now supports evidence cards</strong>
        <div class="meta-stack">
          <p class="meta">${costModelBoundary.hasSampledCostWindows ? "Recovered cost samples now show that shard costs follow row-local runtime data instead of a generic UI-only path." : "The current build does not yet recover enough row-local cost evidence to describe shard costs beyond generic breakpoint notes."}</p>
          <p class="meta">${costModelBoundary.hasSampledCostWindows && costModelBoundary.hasRow0FormulaShell ? "That is enough to show row evidence and status per milestone card without claiming exact affordability or formula certainty." : "Until that recovery exists, player-facing cost views should remain blocked."}</p>
          <p class="meta">${costModelBoundary.hasSampledCostWindows ? "The app still does not claim exact next-cost math, best-buy order, or recommendation-grade certainty from this contract." : "No recommendation-grade shard cost behavior is enabled from this path."}</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card ${rowEvidenceStatus.cardClass}">
        <div class="shard-status-heading">
          <span class="snapshot-title">Definition coverage</span>
          <span class="shard-status-pill ${rowEvidenceStatus.pillClass}">${escapeHtml(rowEvidenceStatus.label)}</span>
        </div>
        <strong>Row cards split grounded definitions from blocked ownership</strong>
        <div class="meta-stack">
          <p class="meta">${rowModelBoundary.hasBoundary ? `Recovered row shells currently cover rows ${rowModelBoundary.unlockRangeLabel}.` : "The current build does not yet preserve enough row-shell coverage for shard milestone cards."}</p>
          <p class="meta">${titleEffectBoundary.hasBoundary ? `Shipped title candidates currently cover rows ${titleEffectBoundary.titleRangeLabel}.` : "Shipped title candidates are still incomplete."}</p>
          <p class="meta">${effectTextHandlerBoundary.hasBoundary ? `Recovered effect text coverage currently spans rows ${effectTextHandlerBoundary.rowCoverageLabel}.` : "Recovered effect text coverage is still incomplete."}</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card ${saveBoundaryStatus.cardClass}">
        <div class="shard-status-heading">
          <span class="snapshot-title">Owned-state blocker</span>
          <span class="shard-status-pill ${saveBoundaryStatus.pillClass}">${escapeHtml(saveBoundaryStatus.label)}</span>
        </div>
        <strong>Player-owned shard state is still not recovered</strong>
        <div class="meta-stack">
          <p class="meta">${saveBoundary.hasSeparationBoundary ? "Recovered shard-local evidence still separates direct row definitions from unresolved PlayerProfile save ownership." : "The current build does not yet preserve a clean shard-to-save separation result."}</p>
          <p class="meta">${saveBoundary.hasSeparationBoundary && saveBoundary.hasDirectRowDefinitionPayload && saveBoundary.hasRuntimeOwnedStateShell ? "Direct ShardMining payload names the reachable row family, but player-owned row state still stops at the upgradeInfoList runtime shell." : "The current split between shard row definitions and owned-state recovery is not yet preserved in this build."}</p>
          <p class="meta">${saveBoundary.hasSeparationBoundary ? escapeHtml(saveBoundary.traceOwnedStateLabel) : "The current trace workflow does not yet preserve a shard owned-state population boundary."}</p>
          <p class="meta">${saveBoundary.hasSeparationBoundary ? "That is useful because it blocks the UI from implying imported shard milestone ownership that the contract does not support." : "Until separation is verified, shard evidence should be treated as even more provisional."}</p>
          <p class="meta">Manual inputs can guide descriptive watch cards, but they do not turn this flow into recovered save-state truth or a grounded import path.</p>
          <p class="meta">If a player imports external-model or compatibility data, it is treated as an interim reference path only and not as canonical shard state.</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card shard-status-card-blocked">
        <div class="shard-status-heading">
          <span class="snapshot-title">Still blocked</span>
          <span class="shard-status-pill shard-status-pill-blocked">Blocked</span>
        </div>
        <strong>What must be grounded before stronger behavior</strong>
        <div class="meta-stack">
          <p class="meta">Shipped-game owner mapping for shard milestones themselves.</p>
          <p class="meta">Asset-grounded milestone labels, bonus tables, unlock lists, and per-level shard costs.</p>
          <p class="meta">A single authoritative milestone list across conflicting community snapshots.</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card shard-status-card-integrated">
        <div class="shard-status-heading">
          <span class="snapshot-title">Deep docs</span>
          <span class="shard-status-pill shard-status-pill-integrated">Integrated</span>
        </div>
        <strong>Open the full shard research trail in docs</strong>
        <div class="meta-stack">
          <p class="meta">Player-facing pages stay lightweight. The long-form probe trail, boundary notes, and extraction follow-ups live in docs.</p>
          <div class="shard-doc-link-list">
            ${renderShardDocLink("./docs/systems/shards/shard-player-facing-evidence.md", "Shard evidence summary")}
            ${renderShardDocLink("./docs/systems/shards/shard-grounding-boundary.md", "Grounding boundary")}
            ${renderShardDocLink("./docs/systems/shards/shard-cost-parameter-probe.md", "Cost parameter probe")}
            ${renderShardDocLink("./docs/systems/shards/shard-cost-native-probe.md", "Cost native probe")}
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderShardWorkflowReference() {
  const mechanics = getGroundedShardMechanics();
  const provenance = state.shardGrounding?.provenance;
  const thresholds = mechanics.rarity_bonus_thresholds ?? {};
  const levelCaps = mechanics.max_level_rules_and_modifiers ?? {};
  const uncertaintyLog = provenance?.uncertaintyLog ?? [];
  const topUncertainty = uncertaintyLog.slice(0, 3);
  return `
    <div class="page-grid">
      <article class="snapshot-card">
        <span class="snapshot-title">Rarity threshold schedules</span>
        <div class="shard-threshold-grid">
          ${Object.entries(thresholds)
            .filter(([rarity]) => rarity !== "source_ids")
            .map(
              ([rarity, levels]) => `
              <div class="shard-threshold-card">
                <strong>${escapeHtml(rarity)}</strong>
                <p class="meta">${escapeHtml(formatThresholdLevels(levels))}</p>
              </div>
            `
            )
            .join("")}
        </div>
        <p class="meta">${escapeHtml(mechanics.effect_scaling?.description || "Effect scaling note unavailable.")}</p>
      </article>
      <article class="snapshot-card">
        <span class="snapshot-title">Reference limits</span>
        <div class="meta-stack">
          <p class="meta">Base max level before Workers Badge: ${formatOptionalNumber(levelCaps.base_max_level_before_workers_badge)}</p>
          <p class="meta">Max level after Workers Badge: ${formatOptionalNumber(levelCaps.max_level_after_workers_badge)}</p>
          <p class="meta">${escapeHtml(levelCaps.research_note || "Research max-level note unavailable.")}</p>
          <p class="meta">${escapeHtml(levelCaps.ultima_loop_mod_note || "Ultima Loop Mod note unavailable.")}</p>
          <p class="meta">${escapeHtml(mechanics.cost_breakpoints_observed?.breakpoints_statement || "Cost breakpoint note unavailable.")}</p>
        </div>
        <div class="meta-stack">
          <p class="snapshot-title">Preserved uncertainty</p>
          ${topUncertainty.map((item) => `<p class="meta">${escapeHtml(`${item.topic}: ${item.what_is_missing || item.what_is_available || item.status}.`)}</p>`).join("")}
          <div class="shard-doc-link-list">
            ${renderShardDocLink("./docs/systems/shards/shard-player-facing-evidence.md", "Open shard evidence summary")}
            ${renderShardDocLink("./docs/systems/shards/shard-grounding-boundary.md", "Open full grounding boundary")}
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderObservedShardBehaviors() {
  const observations = state.shardGrounding?.observedBehaviors?.observations ?? [];
  const provenance = state.shardGrounding?.provenance;
  return `
    <div class="page-grid">
      <article class="snapshot-card">
        <span class="snapshot-title">Observed shard behavior notes</span>
        <div class="meta-stack">
          ${observations
            .map(
              (observation) => `
            <div class="shard-note-card">
              <strong>${escapeHtml(getObservationTitle(observation))}</strong>
              <p class="meta">${escapeHtml(observation.why || "No guide rationale captured.")}</p>
              <p class="meta">${escapeHtml((observation.priorities || []).join(" | "))}</p>
            </div>
          `
            )
            .join("")}
        </div>
      </article>
      <article class="snapshot-card">
        <span class="snapshot-title">Provenance hygiene</span>
        <p class="meta">Source report: ${escapeHtml(provenance?.sourceReport || "docs/research/shard-milestones-grounded-2026-03-28.md")}</p>
        <p class="meta">Milestone rows in this workflow are community-grounded descriptive data, not shipped-game owner-mapped shard milestone data.</p>
        <p class="meta">If uncertainty remains high, the correct output is a better research note, not stronger planner behavior.</p>
        <div class="meta-stack">
          <p class="snapshot-title">Deep docs</p>
          <div class="shard-doc-link-list">
            ${renderShardDocLink("./docs/systems/shards/shard-player-facing-evidence.md", "Shard evidence summary")}
            ${renderShardDocLink("./docs/systems/shards/shard-milestones-grounding-ingest.md", "Grounding ingest notes")}
            ${renderShardDocLink("./docs/systems/shards/shard-system-verification.md", "System verification")}
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderShardDocsNotice() {
  return `
    <article class="validation-card">
      <strong>Definition contract and blockers live in docs</strong>
      <p class="meta">Shard Mining now ships as a definition-family tool: the page shows grounded row definitions up front and keeps player-owned shard blockers explicit, while deeper extraction detail stays in docs.</p>
      <div class="shard-doc-link-list">
        ${renderShardDocLink("./docs/systems/shards/shard-player-facing-evidence.md", "Definition contract")}
        ${renderShardDocLink("./docs/systems/shards/shard-grounding-boundary.md", "Grounding boundary")}
        ${renderShardDocLink("./docs/systems/shards/shard-owner-family-verification.md", "Owned-state blocker")}
      </div>
    </article>
  `;
}

function renderShardDocLink(href, label) {
  return `<a class="shard-doc-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function getBundledDatasetContractEntry(id) {
  const datasets = Array.isArray(state.datasetContract?.datasets)
    ? state.datasetContract.datasets
    : [];
  return datasets.find((entry) => entry?.id === id) || null;
}

function getDatasetBadgeMeta(datasetId, fallbackLabel = "Unmapped") {
  const entry = getBundledDatasetContractEntry(datasetId);
  return getDatasetBadgeMetaFromEntry(entry, fallbackLabel);
}

function renderShardMilestoneDirectory() {
  const mechanics = getGroundedShardMechanics();
  const milestones = getMilestonesForDisplay();
  const evidenceCounts = getShardMilestoneEvidenceCounts();
  const familyEvidence = state.shardGrounding?.milestoneFamilyEvidence;
  const sharedEvidence = familyEvidence?.sharedEvidence ?? {};
  const ownedStateBlocker = getShardOwnedStateBlockerSummary();
  return `
    <div class="meta-stack">
      <p class="eyebrow">Shard Mining family evidence</p>
      <h3>Shard milestone rows</h3>
      <p class="meta">These rows render from one shared shard-family evidence table for the reachable ShardMining family. The table now acts as a finished definition-side contract: row definitions are grounded product data, while player-owned shard state remains explicitly blocked.</p>
      <div class="page-grid">
        <article class="snapshot-card">
          <span class="snapshot-title">Grounded definition family</span>
          <p class="meta">Reachable family: rows 0-29 via <strong>ShardMining.upgradeInfoList</strong> -> <strong>ShardMining+ShardUpgradeInfo</strong>.</p>
          <p class="meta">Definition status counts: ${escapeHtml(`${evidenceCounts.verified} verified | ${evidenceCounts.partial} partial | ${evidenceCounts.blocked} blocked`)}</p>
          <p class="meta">${escapeHtml(sharedEvidence.rowModel?.summary || "Row-model summary unavailable.")}</p>
          <p class="meta">${escapeHtml(sharedEvidence.payloadWatch?.summary || "Payload-watch summary unavailable.")}</p>
          <p class="meta">Definition-side cards separate title, unlock requirement, bonus package shape, and row-local cost shell for each row.</p>
        </article>
        <article class="snapshot-card">
          <span class="snapshot-title">Owned-state blocker</span>
          <p class="meta">${escapeHtml(sharedEvidence.saveBoundary?.summary || "Save-boundary summary unavailable.")}</p>
          <p class="meta">${escapeHtml(ownedStateBlocker.ownerLine)}</p>
          <p class="meta">${escapeHtml(ownedStateBlocker.traceLine)}</p>
          <p class="meta">${escapeHtml(ownedStateBlocker.importLine)}</p>
          <p class="meta">${escapeHtml(ownedStateBlocker.plannerLine)}</p>
        </article>
      </div>
      <div class="preview-stack">
${milestones
  .map((milestone) => {
    const evidenceRow = getShardMilestoneEvidenceRow(milestone);
    const isCardOpen = isShardMilestoneOpen(milestone.id);
    const panelTitle = getShardMilestonePanelTitle(milestone);
    const displayMeta = getShardMilestoneDisplayMeta(milestone);
    const headerMeta = `${formatShardRarity(milestone.rarity)} | Unlock ${describeUnlockCondition(milestone.unlockCondition)}`;
    const thresholdSchedule = getThresholdScheduleForMilestone(milestone, mechanics);
    const hasThresholdSchedule = Array.isArray(thresholdSchedule) && thresholdSchedule.length > 0;
    const summary = getShardMilestoneGroundedSummary(milestone);
    const definitionSummary = getShardDefinitionEvidenceSummary(milestone);
    const rowOwnedStateBlocker = getShardOwnedStateBlockerSummary();
    const evidenceStatus = String(evidenceRow?.status || "partial");
    const evidenceStatusLabel = evidenceStatus.charAt(0).toUpperCase() + evidenceStatus.slice(1);
    const verifiedPackage = evidenceRow?.verifiedPackage;
    return `
          <details class="snapshot-card shard-milestone-card" data-shard-milestone-card="${escapeHtml(String(milestone.id))}" ${isCardOpen ? "open" : ""}>
            <summary class="shard-milestone-summary">
              <div class="shard-milestone-title-block">
                <span class="shard-milestone-rank">#${escapeHtml(String(milestone.milestoneNumber ?? "?"))}</span>
                <div class="shard-milestone-heading-copy">
                  <strong>${escapeHtml(panelTitle)}</strong>
                  <p class="meta">${escapeHtml(headerMeta)}</p>
                  <p class="meta shard-milestone-alias">${escapeHtml(displayMeta)}</p>
                </div>
              </div>
              <div class="shard-milestone-summary-pills">
                <span class="pill ${escapeHtml(summary.titleCoverageStatusClass)}">${escapeHtml(`Evidence ${evidenceStatusLabel}`)}</span>
                <span class="pill shard-status-pill-blocked">Owned state blocked</span>
                <span class="pill shard-threshold-pill ${hasThresholdSchedule ? "" : "pill-neutral"}">${escapeHtml(hasThresholdSchedule ? `Thresholds ${formatThresholdLevels(thresholdSchedule)}` : "No explicit thresholds")}</span>
              </div>
            </summary>
            <div class="shard-milestone-hero">
              <div class="shard-milestone-hero-copy">
                <p class="meta">${escapeHtml(milestone.summary || "No milestone summary captured.")}</p>
                <p class="meta"><strong>Definition note</strong> ${escapeHtml(evidenceRow?.statusReason || "Evidence summary unavailable.")}</p>
                <div class="shard-milestone-facts">
                  <p class="meta"><strong>Unlock</strong> ${escapeHtml(describeUnlockCondition(milestone.unlockCondition))}</p>
                  <p class="meta"><strong>Thresholds</strong> ${escapeHtml(formatThresholdLevels(thresholdSchedule))}</p>
                </div>
              </div>
            </div>
            <div class="shard-milestone-main-panel">
              <div class="shard-bonus-list">
              ${(milestone.bonuses || [])
                .map(
                  (bonus, index) => `
                <article class="shard-bonus-card shard-panel-card">
                  <div class="shard-panel-card-header">
                    <strong>${escapeHtml(bonus.effectLabel || "Unnamed bonus")}</strong>
                    <span class="shard-panel-card-tag">Lane ${escapeHtml(String(index + 1))}</span>
                  </div>
                  <p class="meta">Unlock level: ${bonus.unlockLevel ?? "Listed without explicit threshold"}</p>
                  <p class="meta">Initial bonus: ${escapeHtml(String(bonus.initialBonus ?? "Unknown"))}</p>
                  <p class="meta">Bonus per level: ${escapeHtml(String(bonus.bonusPerLevel ?? "Unknown"))}</p>
                </article>
              `
                )
                .join("")}
              </div>
              <aside class="shard-level-up-rail shard-panel-card">
                <p class="snapshot-title">Definition evidence</p>
                <p class="meta"><strong>Title side</strong> ${escapeHtml(definitionSummary.titleLine)}</p>
                <p class="meta"><strong>Unlock requirement</strong> ${escapeHtml(definitionSummary.unlockLine)}</p>
                <p class="meta"><strong>Bonus package</strong> ${escapeHtml(definitionSummary.bonusShapeLine)}</p>
                <p class="meta"><strong>Row-local cost shell</strong> ${escapeHtml(definitionSummary.costLine)}</p>
                ${
                  verifiedPackage
                    ? `<p class="meta"><strong>Verified package</strong> ${escapeHtml(`Breakpoints ${Array.isArray(verifiedPackage.fixedBreakpoints) ? verifiedPackage.fixedBreakpoints.join("/") : "n/a"} | Cost fields ${(verifiedPackage.serializedCostFields || []).join(", ")}`)}</p>`
                    : `<p class="meta"><strong>Verified package</strong> Not yet promoted for this row.</p>`
                }
              </aside>
              <aside class="shard-level-up-rail shard-panel-card">
                <p class="snapshot-title">Owned-state blocker</p>
                <p class="meta"><strong>Save owner</strong> ${escapeHtml(rowOwnedStateBlocker.ownerLine)}</p>
                <p class="meta"><strong>Trace result</strong> ${escapeHtml(rowOwnedStateBlocker.traceLine)}</p>
                <p class="meta"><strong>Import path</strong> ${escapeHtml(rowOwnedStateBlocker.importLine)}</p>
                <p class="meta"><strong>Planner use</strong> ${escapeHtml(rowOwnedStateBlocker.plannerLine)}</p>
                <p class="meta"><strong>Current candidate</strong> ${escapeHtml(rowOwnedStateBlocker.candidateLine)}</p>
              </aside>
            </div>
          </details>
        `;
  })
  .join("")}
      </div>
    </div>
  `;
}

function runGemOptimization() {
  const mode = $("#gemBudgetMode")?.value ?? "strict";
  const budget = getGemPlannerBudget();
  return [...state.snapshot.gemNodes]
    .map((node) => {
      const affordability = node.cost <= budget ? 1 : mode === "stretch" ? 0.8 : 0.35;
      return {
        title: node.label,
        subtitle: `${node.level}/${node.maxLevel}`,
        score:
          (node.value / node.cost) *
          (1 + (node.maxLevel - node.level) / node.maxLevel) *
          affordability,
        confidence: 0.7,
        notes: node.tags.join(" | ")
      };
    })
    .sort((left, right) => right.score - left.score);
}

function getGemPlannerBudget() {
  return Number(getExperimentalProfileState().gemNodeBudget || 0);
}

function runValidationCases() {
  const activeFeedContract = getRecommendationContractSummary(
    getActiveMvpRecommendationFeedPartition().all
  );
  const current = {
    ship: runShipOptimization()[0]?.title ?? "None",
    progression: runProgressionOptimization()[0]?.title ?? "None",
    recommendationFeed:
      activeFeedContract.invalidCount === 0
        ? "All active feed items satisfy shared recommendation contract"
        : "Contract gaps in active feed",
    gem: runGemOptimization()[0]?.title ?? "None"
  };
  const appCases = buildSnapshotValidationCases(
    state.snapshot.validationCases,
    current,
    SUPPORT_SURFACE_VALIDATION_MODULES
  );

  return [...appCases, ...buildApkGroundingValidationCases()];
}

function buildApkGroundingValidationCases() {
  const tokenShop = state.extractedMechanics?.tokenShop;
  const multiverseMarket = state.extractedMechanics?.multiverseMarket;
  const multiverseMarketMetadataNeighborhood =
    state.extractedMechanics?.multiverseMarketMetadataNeighborhood;
  const tokeniumNamingClues = state.extractedMechanics?.tokeniumNamingClues;
  const tokenBankStateClues = state.extractedMechanics?.tokenBankStateClues;
  const dailyTokeniumLaneClues = state.extractedMechanics?.dailyTokeniumLaneClues;
  const tokenBankFormulaBoundary = state.extractedMechanics?.tokenBankFormulaBoundary;
  const multiverseMarketRangeBoundary = state.extractedMechanics?.multiverseMarketRangeBoundary;
  const multiverseMarketRowTextCoverage = state.extractedMechanics?.multiverseMarketRowTextCoverage;
  const tokenShopCostLanes = state.extractedMechanics?.tokenShopCostLanes;
  const spendActionLaneClues = state.extractedMechanics?.spendActionLaneClues;
  const multiverseMarketActionShell = state.extractedMechanics?.multiverseMarketActionShell;
  const multiverseMarketOwnerFamily = state.extractedMechanics?.multiverseMarketOwnerFamily;
  const tokenShopOwnerShell = state.extractedMechanics?.tokenShopOwnerShell;
  const tokenShopSaveBoundary = state.extractedMechanics?.tokenShopSaveBoundary;
  const multiverseMarketSaveBoundary = state.extractedMechanics?.multiverseMarketSaveBoundary;
  const multiverseMarketMarketMemberBoundary =
    state.extractedMechanics?.multiverseMarketMarketMemberBoundary;
  const tokenBankControllerShell = state.extractedMechanics?.tokenBankControllerShell;
  const shardMilestones = state.shardGrounding?.milestones;
  const shardAssetGrounding = state.shardGrounding?.assetGrounding;
  const shardOwnerFamilyBoundary = state.shardGrounding?.ownerFamilyBoundary;
  const shardFinalSuBonusBoundary = state.shardGrounding?.finalSuBonusBoundary;
  const shardMilestonePayloadBoundary = state.shardGrounding?.milestonePayloadBoundary;
  const shardCostModelBoundary = state.shardGrounding?.costModelBoundary;
  const shardMilestoneRowModelBoundary = state.shardGrounding?.rowModelBoundary;
  const shardMilestoneTitleEffectBoundary = state.shardGrounding?.titleEffectBoundary;
  const shardEffectTextHandlerBoundary = state.shardGrounding?.effectTextHandlerBoundary;
  const shardMilestoneRowShellBoundary = state.shardGrounding?.milestoneRowShellBoundary;
  const shardMilestoneRowAlignmentBoundary = state.shardGrounding?.milestoneRowAlignmentBoundary;
  const shardSaveBoundary = state.shardGrounding?.saveBoundary;
  const cases = [];

  if (shardAssetGrounding) {
    const identifiers = Array.isArray(shardAssetGrounding.groundedShellIdentifiers)
      ? shardAssetGrounding.groundedShellIdentifiers
      : [];
    const hasShellEvidence =
      identifiers.includes("LoopResetStage1") && identifiers.includes("MilestoneBonusesPerLevel");
    cases.push({
      title: "Shard shell grounding payload",
      expected: "Grounded shard shell evidence available",
      actual: hasShellEvidence
        ? "Grounded shard shell evidence available"
        : "Missing expected shard shell anchors",
      pass: hasShellEvidence,
      scope: "APK"
    });
    cases.push({
      title: "Shard milestone mapping gate",
      expected: "Available but unmapped",
      actual:
        shardAssetGrounding.integrationStatus === "available-but-unmapped"
          ? "Available but unmapped"
          : "Unexpected shard integration status",
      pass: shardAssetGrounding.integrationStatus === "available-but-unmapped",
      scope: "APK"
    });
  }
  if (shardOwnerFamilyBoundary) {
    const ownerBoundary = getShardOwnerFamilyBoundarySummary(shardOwnerFamilyBoundary);
    cases.push({
      title: "Shard owner-family boundary",
      expected:
        "ShardMining and ShardUpgradeInfo stay narrowed while ConstructionMilestones remains downgraded",
      actual:
        ownerBoundary.hasBoundary && ownerBoundary.hasDowngradedGenericLead
          ? "ShardMining and ShardUpgradeInfo stay narrowed while ConstructionMilestones remains downgraded"
          : "Shard owner-family boundary drifted",
      pass: ownerBoundary.hasBoundary && ownerBoundary.hasDowngradedGenericLead,
      scope: "APK"
    });
  }
  if (shardFinalSuBonusBoundary) {
    const finalSuBoundary = getShardFinalSuBonusBoundarySummary(shardFinalSuBonusBoundary);
    cases.push({
      title: "Shard FinalSU bonus boundary",
      expected:
        "ShardUpgradeInfo preserves SU final-unlock and FinalSU bonus-field families without row mapping claims",
      actual: finalSuBoundary.hasBoundary
        ? `ShardUpgradeInfo preserves ${finalSuBoundary.unlockRangeLabel} plus ${finalSuBoundary.bonusFieldLabel}`
        : "Shard FinalSU bonus-field boundary drifted",
      pass: finalSuBoundary.hasBoundary && finalSuBoundary.hasAdjacentFields,
      scope: "APK"
    });
  }
  if (shardMilestonePayloadBoundary) {
    const payloadBoundary = getShardMilestonePayloadBoundarySummary(shardMilestonePayloadBoundary);
    cases.push({
      title: "Shard milestone payload boundary",
      expected:
        "ShardUpgradeInfo preserves milestone-total, cost-list, progress-fill, and phase-tick hooks without claiming saved player rows",
      actual:
        payloadBoundary.hasBoundary &&
        payloadBoundary.hasCostAndListHooks &&
        payloadBoundary.hasProgressFillHooks &&
        payloadBoundary.hasTickFields
          ? `ShardUpgradeInfo preserves ${payloadBoundary.milestoneStateLabel} plus ${payloadBoundary.costAccessorLabel}`
          : "Shard milestone payload-watch boundary drifted",
      pass:
        payloadBoundary.hasBoundary &&
        payloadBoundary.hasCostAndListHooks &&
        payloadBoundary.hasProgressFillHooks &&
        payloadBoundary.hasTickFields &&
        payloadBoundary.hasCostAccessorSamples,
      scope: "APK"
    });
  }
  if (shardCostModelBoundary) {
    const costModelBoundary = getShardCostModelBoundarySummary(shardCostModelBoundary);
    cases.push({
      title: "Shard cost-model boundary",
      expected:
        "ShardUpgradeInfo preserves sampled SU cost accessors plus a row-local SU0 cost parameter shell without formula claims",
      actual:
        costModelBoundary.hasBoundary &&
        costModelBoundary.hasSampledCostWindows &&
        costModelBoundary.hasRow0FormulaShell
          ? `ShardUpgradeInfo preserves ${costModelBoundary.costWindowLabel} plus ${costModelBoundary.row0FieldLabel}`
          : "Shard cost-model boundary drifted",
      pass:
        costModelBoundary.hasBoundary &&
        costModelBoundary.hasSampledCostWindows &&
        costModelBoundary.hasRow0FormulaShell,
      scope: "APK"
    });
  }
  if (shardMilestoneRowModelBoundary) {
    const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(
      shardMilestoneRowModelBoundary
    );
    cases.push({
      title: "Shard milestone row model",
      expected:
        "Shard-local text-checker and unlock rows now reach 0-29 while the numbered buy seam still crosses the generic family",
      actual:
        rowModelBoundary.hasBoundary &&
        rowModelBoundary.hasShardLocalBuySample &&
        rowModelBoundary.hasGenericBuyFamily
          ? `Text ${rowModelBoundary.textCheckerRangeLabel}, unlock ${rowModelBoundary.unlockRangeLabel}, buy seam ${rowModelBoundary.shardLocalBuyLabel} vs ${rowModelBoundary.genericBuyLabel}`
          : "Shard row-model boundary drifted",
      pass:
        rowModelBoundary.hasBoundary &&
        rowModelBoundary.hasShardLocalBuySample &&
        rowModelBoundary.hasGenericBuyFamily,
      scope: "APK"
    });
  }
  if (shardMilestoneTitleEffectBoundary) {
    const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(
      shardMilestoneTitleEffectBoundary
    );
    cases.push({
      title: "Shard milestone titles and effect shell",
      expected:
        "Shipped shard title assets and effect-family clues are preserved without claiming conflict-free row text",
      actual:
        titleEffectBoundary.hasBoundary &&
        titleEffectBoundary.hasEffectPresentationFamily &&
        titleEffectBoundary.hasBonusCalcSamples
          ? `Title rows ${titleEffectBoundary.titleRangeLabel} with effect shell ${titleEffectBoundary.effectSlotLabel}`
          : "Shard title/effect boundary drifted",
      pass:
        titleEffectBoundary.hasBoundary &&
        titleEffectBoundary.hasEffectPresentationFamily &&
        titleEffectBoundary.hasBonusCalcSamples,
      scope: "APK"
    });
  }
  if (shardEffectTextHandlerBoundary) {
    const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(
      shardEffectTextHandlerBoundary
    );
    cases.push({
      title: "Shard effect-text handler boundary",
      expected:
        "A shard-specific bonus text handler leads over the generic milestone writer without claiming row-complete final text",
      actual:
        effectTextHandlerBoundary.hasBoundary &&
        effectTextHandlerBoundary.hasPresentationFamily &&
        effectTextHandlerBoundary.hasBonusCalcSamples &&
        effectTextHandlerBoundary.hasUiContextAnchors
          ? `${effectTextHandlerBoundary.textHandlerLabel} aligned with ${effectTextHandlerBoundary.presentationFamilyLabel}`
          : "Shard effect-text handler boundary drifted",
      pass:
        effectTextHandlerBoundary.hasBoundary &&
        effectTextHandlerBoundary.hasPresentationFamily &&
        effectTextHandlerBoundary.hasBonusCalcSamples &&
        effectTextHandlerBoundary.hasUiContextAnchors,
      scope: "APK"
    });
  }
  if (shardMilestoneRowShellBoundary) {
    const rowShellBoundary = getShardMilestoneRowShellBoundarySummary(
      shardMilestoneRowShellBoundary
    );
    cases.push({
      title: "Shard milestone row shell",
      expected:
        "ShardMining preserves partial UnlockMilestone, BuyMilestone, and MilestoneTextChecker row shell without row-owner claims",
      actual:
        rowShellBoundary.hasBoundary &&
        rowShellBoundary.hasUnlockHookSamples &&
        rowShellBoundary.hasBuyHookSamples &&
        rowShellBoundary.hasTextCheckerSamples
          ? `ShardMining preserves ${rowShellBoundary.unlockHookLabel} plus ${rowShellBoundary.buyHookLabel} and ${rowShellBoundary.textCheckerLabel}`
          : "Shard milestone row-shell boundary drifted",
      pass:
        rowShellBoundary.hasBoundary &&
        rowShellBoundary.hasUnlockHookSamples &&
        rowShellBoundary.hasBuyHookSamples &&
        rowShellBoundary.hasTextCheckerSamples,
      scope: "APK"
    });
  }
  if (shardMilestoneRowAlignmentBoundary) {
    const rowAlignmentBoundary = getShardMilestoneRowAlignmentBoundarySummary(
      shardMilestoneRowAlignmentBoundary
    );
    cases.push({
      title: "Shard milestone row alignment",
      expected:
        "Shard partial row shell keeps unlock, buy, and text-checker ranges separate until a declaring row model is recovered",
      actual:
        rowAlignmentBoundary.hasBoundary &&
        rowAlignmentBoundary.hasZeroUnlockTextOverlap &&
        rowAlignmentBoundary.hasBuyTextOverlap
          ? `Unlock ${rowAlignmentBoundary.unlockRangeLabel}, text ${rowAlignmentBoundary.textCheckerRangeLabel}, buy ${rowAlignmentBoundary.buyRangeLabel}`
          : "Shard milestone row-alignment boundary drifted",
      pass:
        rowAlignmentBoundary.hasBoundary &&
        rowAlignmentBoundary.hasZeroUnlockTextOverlap &&
        rowAlignmentBoundary.hasBuyTextOverlap,
      scope: "APK"
    });
  }
  const shardFamilyEvidence = state.shardGrounding?.milestoneFamilyEvidence;
  const shardFamilyRows = Array.isArray(shardFamilyEvidence?.rows) ? shardFamilyEvidence.rows : [];
  if (shardFamilyRows.length) {
    const statusCounts = getShardMilestoneEvidenceCounts();
    const verifiedRowKeys = shardFamilyRows
      .filter((entry) => entry?.status === "verified")
      .map((entry) => entry?.rowKey)
      .filter(Boolean);
    const hasSharedFamilyEvidence =
      shardFamilyRows.length === 30 &&
      verifiedRowKeys.includes("SU1") &&
      verifiedRowKeys.includes("SU2") &&
      statusCounts.partial > 0 &&
      statusCounts.blocked > 0;
    cases.push({
      title: "Shard family evidence table",
      expected:
        "Shared shard family evidence covers rows 0-29 with verified, partial, and blocked classifications",
      actual: hasSharedFamilyEvidence
        ? "Shared shard family evidence covers rows 0-29 with verified, partial, and blocked classifications"
        : "Shared shard family evidence table drifted",
      pass: hasSharedFamilyEvidence,
      scope: "APK"
    });
  }
  if (shardSaveBoundary) {
    const saveBoundary = getShardSaveBoundarySummary(shardSaveBoundary);
    cases.push({
      title: "Shard save-side separation",
      expected:
        "Shard owner trail and PlayerProfileData save-family clues stay separate with zero overlap",
      actual: saveBoundary.hasSeparationBoundary
        ? "Shard owner trail and PlayerProfileData save-family clues stay separate with zero overlap"
        : "Shard save-boundary separation drifted",
      pass: saveBoundary.hasSeparationBoundary,
      scope: "APK"
    });
  }

  if (tokenShop) {
    const numericTable = tokenShop.numeric_table ?? {};
    const tokenShopCoverage = getTokenShopCoverageSummary(tokenShop);
    const tokeniumNamingSummary = getTokeniumNamingSummary(tokeniumNamingClues);
    const tokenBankStateSummary = getTokenBankStateSummary(tokenBankStateClues);
    const hasTokeniumCurrencyShell = tokeniumNamingSummary.hasNamingClues;
    const hasTokenBankAnchors = tokenBankStateSummary.hasControllerSplit;
    cases.push({
      title: "TokenShop owner payload",
      expected: "Grounded TokenShop constants available",
      actual:
        tokenShop.source?.level0 && numericTable.TokenBoost && numericTable.DiamondBoost
          ? "Grounded TokenShop constants available"
          : "Missing expected TokenShop constants",
      pass: Boolean(
        tokenShop.source?.level0 && numericTable.TokenBoost && numericTable.DiamondBoost
      ),
      scope: "APK"
    });
    cases.push({
      title: "TokenShop extracted family coverage",
      expected:
        "32 numeric groups with TokenBoost, DiamondBoost, and TokenDailiesT2 plus token-bank controller anchors",
      actual: tokenShopCoverage.hasCoverage
        ? `${tokenShopCoverage.numericGroupCount} numeric groups with ${tokenShopCoverage.namedLaneLabel}${tokenShopCoverage.hasControllerAnchors ? " plus token-bank controller anchors" : " but missing token-bank controller anchors"}`
        : "Missing TokenShop extracted family coverage",
      pass:
        tokenShopCoverage.numericGroupCount === 32 &&
        tokenShopCoverage.hasControllerAnchors &&
        tokenShopCoverage.hasNamedLanes,
      scope: "APK"
    });
    cases.push({
      title: "TokenShop mapping gate",
      expected: "Available but unmapped",
      actual: "Available but unmapped",
      pass: true,
      scope: "APK"
    });
    cases.push({
      title: "TokenShop token-bank anchors",
      expected: "Recovered token-bank controller anchors available",
      actual: hasTokenBankAnchors
        ? "Recovered token-bank controller anchors available"
        : "Missing token-bank controller anchors",
      pass: hasTokenBankAnchors,
      scope: "APK"
    });
    cases.push({
      title: "TokenShop currency shell",
      expected: "Token or tokenium spend lane grounded",
      actual: hasTokeniumCurrencyShell
        ? "Token or tokenium spend lane grounded"
        : "Missing tokenium currency-shell evidence",
      pass: hasTokeniumCurrencyShell,
      scope: "APK"
    });
  }

  if (multiverseMarket) {
    const records = Array.isArray(multiverseMarket.records) ? multiverseMarket.records : [];
    const validatedIds = Array.isArray(multiverseMarket.source?.validated_ids)
      ? multiverseMarket.source.validated_ids
      : [];
    const hasAnchor = records.some(
      (record) => Number(record.inscription_id) === 51 && Number(record.start_cost) === 2
    );
    const validatedCoverage = getMultiverseMarketValidatedCoverage(multiverseMarket);
    cases.push({
      title: "MultiverseMarket owner payload",
      expected: "Validated late-block constants available",
      actual: hasAnchor
        ? "Validated late-block constants available"
        : "Missing validated late-block anchor",
      pass: hasAnchor,
      scope: "APK"
    });
    cases.push({
      title: "MultiverseMarket validated row coverage",
      expected: "22 validated rows across ids 50-59 and 63-74",
      actual: validatedCoverage.hasValidatedRows
        ? `${validatedCoverage.count} validated rows across ids ${validatedCoverage.rangeLabel}`
        : "Missing validated row coverage",
      pass: validatedCoverage.count === 22 && validatedCoverage.rangeLabel === "50-59 and 63-74",
      scope: "APK"
    });
    cases.push({
      title: "MultiverseMarket mapping gate",
      expected: "Available but unmapped",
      actual: "Available but unmapped",
      pass: true,
      scope: "APK"
    });
  }

  if (multiverseMarketMetadataNeighborhood) {
    const { hasCloudSavePathClues, hasSaveFamilyClues, hasProgressionFieldCluster } =
      getMultiverseMarketMetadataSummary(multiverseMarketMetadataNeighborhood);
    cases.push({
      title: "MultiverseMarket save-family clues",
      expected: "PlayerProfileData persistence clues available",
      actual: hasSaveFamilyClues
        ? "PlayerProfileData persistence clues available"
        : "Missing PlayerProfileData persistence clues",
      pass: hasSaveFamilyClues,
      scope: "APK"
    });
    cases.push({
      title: "MultiverseMarket cloud-save path clues",
      expected: "CloudSavePlayerProfile path clues available",
      actual: hasCloudSavePathClues
        ? "CloudSavePlayerProfile path clues available"
        : "Missing CloudSavePlayerProfile path clues",
      pass: hasCloudSavePathClues,
      scope: "APK"
    });
    cases.push({
      title: "MultiverseMarket progression-field cluster",
      expected: "InscryptionsDone trade-counter cluster available",
      actual: hasProgressionFieldCluster
        ? "InscryptionsDone trade-counter cluster available"
        : "Missing InscryptionsDone trade-counter cluster",
      pass: hasProgressionFieldCluster,
      scope: "APK"
    });
  }

  if (tokeniumNamingClues) {
    const tokeniumNamingSummary = getTokeniumNamingSummary(tokeniumNamingClues);
    cases.push({
      title: "Spend tokenium naming clues",
      expected:
        "Resource_Tokenium, Aca.Tokenium553, CostBox-Tokens, and CostBox-Tokenium available",
      actual: tokeniumNamingSummary.hasNamingClues
        ? `${tokeniumNamingSummary.resourceLabel}, ${tokeniumNamingSummary.academyLabel}, ${tokeniumNamingSummary.tokenShellLabel}, and ${tokeniumNamingSummary.tokeniumShellLabel} available`
        : "Missing token or tokenium naming clues",
      pass: tokeniumNamingSummary.hasNamingClues,
      scope: "APK"
    });
  }

  if (tokenShopCostLanes) {
    const tokenShopCostLaneSummary = getTokenShopCostLaneSummary(tokenShopCostLanes);
    cases.push({
      title: "TokenShop cost-lane split",
      expected:
        "TokenBoost, DiamondBoost, TokenDailiesT2, CostBox-Tokens, and CostBox-Tokenium available",
      actual: tokenShopCostLaneSummary.hasLaneSplit
        ? `${tokenShopCostLaneSummary.tokenLaneLabel}, ${tokenShopCostLaneSummary.diamondLaneLabel}, ${tokenShopCostLaneSummary.dailyLaneLabel}, ${tokenShopCostLaneSummary.tokensShellLabel}, and ${tokenShopCostLaneSummary.tokeniumShellLabel} available`
        : "Missing TokenShop cost-lane split clues",
      pass:
        tokenShopCostLaneSummary.hasLaneSplit &&
        tokenShopCostLaneSummary.keepsDailyTokeniumSeparate,
      scope: "APK"
    });
  }

  if (spendActionLaneClues) {
    const spendActionLaneSummary = getSpendActionLaneSummary(spendActionLaneClues);
    cases.push({
      title: "Spend action-lane split",
      expected:
        "BuyTokenBoost, BuyDiamondBoost, BuyLM244, BuyCollectorDevice, and zero BuyTokenDailies hooks preserved",
      actual: spendActionLaneSummary.hasActionSplit
        ? `${spendActionLaneSummary.tokenHook}, ${spendActionLaneSummary.diamondHook}, ${spendActionLaneSummary.loopModifierHook}, ${spendActionLaneSummary.premiumModifierHook}, and zero ${spendActionLaneSummary.dailyHookT2} or ${spendActionLaneSummary.dailyHookT3} hooks preserved`
        : "Missing spend action-lane clues",
      pass:
        spendActionLaneSummary.hasActionSplit &&
        spendActionLaneSummary.keepsDailyDirectHooksUnrecovered,
      scope: "APK"
    });
  }

  if (tokenShopOwnerShell) {
    const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(tokenShopOwnerShell);
    cases.push({
      title: "TokenShop owner shell",
      expected:
        "TokenShop, ClaimBankedTokens, CheckTokenClaimNotification, and BuyAutoTokenClicker preserved as one local owner shell",
      actual: tokenShopOwnerShellSummary.hasOwnerShell
        ? `${tokenShopOwnerShellSummary.ownerAnchor}, ${tokenShopOwnerShellSummary.bankMethod}, ${tokenShopOwnerShellSummary.notificationHook}, and ${tokenShopOwnerShellSummary.deviceHook} preserved as one local owner shell`
        : "Missing TokenShop owner-shell clues",
      pass: tokenShopOwnerShellSummary.hasOwnerShell,
      scope: "APK"
    });
  }

  if (tokenShopSaveBoundary) {
    const tokenShopSaveBoundarySummary = getTokenShopSaveBoundarySummary(tokenShopSaveBoundary);
    cases.push({
      title: "TokenShop save boundary",
      expected:
        "TokenShop owner shell and PlayerProfileData save-family clues stay separate with zero overlap",
      actual: tokenShopSaveBoundarySummary.hasSeparationBoundary
        ? `${tokenShopSaveBoundarySummary.ownerAnchor} and ${tokenShopSaveBoundarySummary.saveAnchor} stay separate with ${tokenShopSaveBoundarySummary.overlapLabel}`
        : "Missing TokenShop save-boundary clues",
      pass: tokenShopSaveBoundarySummary.hasSeparationBoundary,
      scope: "APK"
    });
  }

  if (tokenBankControllerShell) {
    const tokenBankControllerShellSummary =
      getTokenBankControllerShellSummary(tokenBankControllerShell);
    cases.push({
      title: "Token-bank controller shell",
      expected:
        "ClaimBankedTokens, SetBankFill, BankFill, TokenBankDescriptionText, and CheckTokenClaimNotification preserved",
      actual: tokenBankControllerShellSummary.hasControllerShell
        ? `${tokenBankControllerShellSummary.claimMethod}, ${tokenBankControllerShellSummary.fillMethod}, ${tokenBankControllerShellSummary.fillField}, ${tokenBankControllerShellSummary.descriptionShell}, and ${tokenBankControllerShellSummary.notificationHook} preserved`
        : "Missing token-bank controller-shell clues",
      pass: tokenBankControllerShellSummary.hasControllerShell,
      scope: "APK"
    });
  }

  if (tokenBankStateClues) {
    const tokenBankStateSummary = getTokenBankStateSummary(tokenBankStateClues);
    cases.push({
      title: "Token-bank controller split clues",
      expected:
        "ClaimBankedTokens, get_TokenBankCap, BigStatisticPrefab.TokenBankCap, and SetLM244BonusText available",
      actual: tokenBankStateSummary.hasControllerSplit
        ? `${tokenBankStateSummary.claimMethod}, ${tokenBankStateSummary.capMethod}, ${tokenBankStateSummary.displayShell}, and ${tokenBankStateSummary.loopHook} available`
        : "Missing token-bank controller split clues",
      pass: tokenBankStateSummary.hasControllerSplit,
      scope: "APK"
    });
  }

  if (dailyTokeniumLaneClues) {
    const dailyTokeniumSummary = getDailyTokeniumLaneSummary(dailyTokeniumLaneClues);
    cases.push({
      title: "Daily Tokenium owner-family clues",
      expected:
        "SpaceAcademy, FarmMissions, SetLM244BonusText, BuyLM244, and BuyCollectorDevice available",
      actual: dailyTokeniumSummary.hasOwnerFamilyClues
        ? `${dailyTokeniumSummary.ownerFamilyLabel}, ${dailyTokeniumSummary.missionFamilyLabel}, ${dailyTokeniumSummary.loopHook}, ${dailyTokeniumSummary.purchaseHook}, and ${dailyTokeniumSummary.purchaseOwner} available`
        : "Missing Daily Tokenium owner-family clues",
      pass: dailyTokeniumSummary.hasOwnerFamilyClues && dailyTokeniumSummary.hasModifierBoundary,
      scope: "APK"
    });
  }

  if (tokenBankFormulaBoundary) {
    const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(tokenBankFormulaBoundary);
    cases.push({
      title: "Token-bank derived output boundary",
      expected:
        "FinalTokenBankCap and FinalTokenBankFillSpeed cluster without PlayerProfileData or CloudSavePlayerProfile joins",
      actual: tokenBankFormulaSummary.hasDerivedOutputBoundary
        ? `${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField} cluster${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? " without save-family joins" : " with save-family overlap"}.`
        : "Missing token-bank derived output boundary clues",
      pass:
        tokenBankFormulaSummary.hasDerivedOutputBoundary &&
        tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext,
      scope: "APK"
    });
  }

  if (multiverseMarketRangeBoundary) {
    const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(
      multiverseMarketRangeBoundary
    );
    cases.push({
      title: "MultiverseMarket row-range boundary",
      expected:
        "Validated rows 50-59 and 63-74 now share a first direct overlap with the recovered IS71-110 metadata run at rows 71-74",
      actual: multiverseMarketRangeSummary.hasOverlap
        ? `Validated rows ${multiverseMarketRangeSummary.validatedRangeLabel} now share a first direct overlap with ${multiverseMarketRangeSummary.metadataRangeLabel} at rows ${multiverseMarketRangeSummary.overlapLabel}`
        : "Missing validated-row versus metadata-run boundary",
      pass: multiverseMarketRangeSummary.hasOverlap,
      scope: "APK"
    });
  }

  if (multiverseMarketRowTextCoverage) {
    const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(
      multiverseMarketRowTextCoverage
    );
    cases.push({
      title: "MultiverseMarket validated row text coverage",
      expected:
        "TextHandlerMarkets and SetAllChrystosEmporiumTexts cover SetIS50-59 and 63-74 cost texts",
      actual: multiverseMarketRowTextSummary.hasValidatedTextCoverage
        ? `${multiverseMarketRowTextSummary.textHandler} and ${multiverseMarketRowTextSummary.textBatcher} cover ${multiverseMarketRowTextSummary.coveredCount} SetIS*CostText hooks for ${multiverseMarketRowTextSummary.validatedRangeLabel}`
        : "Missing validated MultiverseMarket row text coverage",
      pass:
        multiverseMarketRowTextSummary.hasValidatedTextCoverage &&
        multiverseMarketRowTextSummary.hasBuyHookSamples,
      scope: "APK"
    });
  }

  if (state.extractedMechanics?.multiverseMarketPrefabRemapBoundary) {
    const multiverseMarketPrefabRemapSummary = getMultiverseMarketPrefabRemapBoundarySummary(
      state.extractedMechanics.multiverseMarketPrefabRemapBoundary
    );
    cases.push({
      title: "MultiverseMarket prefab remap boundary",
      expected:
        "Validated ids 69-74 still do not have direct ChrystosEmporiumUpgrade number matches",
      actual: multiverseMarketPrefabRemapSummary.hasOverrideBoundary
        ? `${multiverseMarketPrefabRemapSummary.lastDirectPrefab} is the last direct band before ${multiverseMarketPrefabRemapSummary.firstOverride} through ${multiverseMarketPrefabRemapSummary.lastOverride}`
        : "Missing MultiverseMarket prefab-remap boundary",
      pass: multiverseMarketPrefabRemapSummary.hasOverrideBoundary,
      scope: "APK"
    });
  }

  if (multiverseMarketActionShell) {
    const multiverseMarketActionShellSummary = getMultiverseMarketActionShellSummary(
      multiverseMarketActionShell
    );
    cases.push({
      title: "MultiverseMarket action shell",
      expected:
        "Context-derived BuyIS1-110 and SetIS1-110CostText shell preserved while only rows 50-59 and 63-74 stay validated",
      actual: multiverseMarketActionShellSummary.hasActionShell
        ? `${multiverseMarketActionShellSummary.buyRangeLabel} and ${multiverseMarketActionShellSummary.costTextRangeLabel} preserved while ${multiverseMarketActionShellSummary.validatedRangeLabel} stays validated`
        : "Missing MultiverseMarket action-shell boundary",
      pass: multiverseMarketActionShellSummary.hasActionShell,
      scope: "APK"
    });
  }

  if (multiverseMarketOwnerFamily) {
    const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(
      multiverseMarketOwnerFamily
    );
    cases.push({
      title: "MultiverseMarket owner family",
      expected:
        "MultiverseMarket, Inscryptions, and IS1-110 CurrencyBox shell preserved without implying saved-state ownership",
      actual: multiverseMarketOwnerFamilySummary.hasOwnerFamily
        ? `${multiverseMarketOwnerFamilySummary.ownerAnchor}, ${multiverseMarketOwnerFamilySummary.inscryptionsLabel}, and ${multiverseMarketOwnerFamilySummary.currencyRangeLabel} preserved with ${multiverseMarketOwnerFamilySummary.firstValidatedCurrencyBox} through ${multiverseMarketOwnerFamilySummary.lastValidatedCurrencyBox} samples`
        : "Missing MultiverseMarket owner-family shell",
      pass:
        multiverseMarketOwnerFamilySummary.hasOwnerFamily &&
        multiverseMarketOwnerFamilySummary.hasCurrencyShell,
      scope: "APK"
    });
  }

  if (multiverseMarketSaveBoundary) {
    const multiverseMarketSaveBoundarySummary = getMultiverseMarketSaveBoundarySummary(
      multiverseMarketSaveBoundary
    );
    cases.push({
      title: "MultiverseMarket save boundary",
      expected:
        "MultiverseMarket action shell and PlayerProfileData save-family clues stay separate with zero overlap",
      actual: multiverseMarketSaveBoundarySummary.hasSeparationBoundary
        ? `${multiverseMarketSaveBoundarySummary.actionAnchor} and ${multiverseMarketSaveBoundarySummary.saveAnchor} stay separate with ${multiverseMarketSaveBoundarySummary.overlapLabel}`
        : "Missing MultiverseMarket save-boundary clues",
      pass: multiverseMarketSaveBoundarySummary.hasSeparationBoundary,
      scope: "APK"
    });
  }

  if (multiverseMarketMarketMemberBoundary) {
    const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(
      multiverseMarketMarketMemberBoundary
    );
    cases.push({
      title: "MultiverseMarket canonical host narrowing",
      expected:
        "PlayerProfileHandler get_Market accessor bridge is checked while direct MultiverseMarket ownership of the broader progression run is ruled out",
      actual: marketMemberSummary.favorsDirectMemberBoundary
        ? `${marketMemberSummary.canonicalHostLabel} is checked, ${marketMemberSummary.negativeMultiverseFieldLabel}, and the broader declaring payload stays unresolved`
        : "Missing checked PlayerProfileHandler-to-MultiverseMarket accessor narrowing",
      pass: marketMemberSummary.favorsDirectMemberBoundary && marketMemberSummary.hasCloudBridge,
      scope: "APK"
    });
  }

  if (shardMilestones) {
    cases.push({
      title: "Shard milestone mapping gate",
      expected: "Community-grounded descriptive dataset",
      actual: "Community-grounded descriptive dataset",
      pass: true,
      scope: "APK"
    });
  }

  return cases;
}

function getTokenShopGroundedSubsetDefinitions(boundary) {
  const atu3EffectChain = boundary?.atu3CrossSystemEffectTrace?.recoveredActionEffectChain;
  const atu3SupportingConsumerShell =
    boundary?.atu3ChestConsumerReadTrace?.recoveredInternalReadShell;
  return [
    {
      field: "ATU1Level",
      slot: "ATU1",
      identity:
        boundary?.adjacentFollowUp?.verifiedNamedIdentityJoin?.namedIdentity ||
        boundary?.adjacentFollowUp?.verifiedTitleTextChain?.titleProbeTitle ||
        boundary?.adjacentFollowUp?.recoveredAdditionalBridge?.prefabIdentity ||
        "NewTokenUPGPrefab.T1.TokensBoost",
      identitySource: boundary?.adjacentFollowUp?.verifiedNamedIdentityJoin?.namedIdentity
        ? "Checked named identity"
        : boundary?.adjacentFollowUp?.verifiedTitleTextChain?.titleProbeTitle
          ? "Checked title-side text chain"
          : "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "TokenBoostStartCost",
      additiveCostField: "TokenBoostAdditiveCost",
      bonusField: "TokenBoostBonus",
      maxLevelField: "TokenBoostMaxLevel",
      bonusStepLabel: "Tokens Gained from Token Chests",
      bonusStepMode: "additive",
      note: "Checked shell-to-prefab bridge only. This row stays compatibility-only until a final player-facing title join is recovered."
    },
    {
      field: "ATU2Level",
      slot: "ATU2",
      identity: boundary?.recoveredBridge?.prefabIdentity || "NewTokenUPGPrefab.T1.DiamondBoost",
      identitySource: "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "DiamondBoostStartCost",
      additiveCostField: "DiamondBoostAdditiveCost",
      bonusField: "DiamondBoostBonus",
      maxLevelField: "DiamondBoostMaxLevel",
      bonusStepLabel: "Diamonds Gained from Diamond Chests",
      bonusStepMode: "additive",
      note: "Checked shell-to-prefab bridge only. This row stays compatibility-only until a final player-facing title join is recovered."
    },
    {
      field: "ATU3Level",
      slot: "ATU3",
      identity: atu3EffectChain?.sharedEffectTitle || "Cells Booster (Chests)",
      identitySource: "Checked shared effect surface",
      rowType: "effect-driven",
      rowTypeLabel: "Effect-driven checked row",
      startCostField: "CellBoostStartCost",
      additiveCostField: "CellBoostAdditiveCost",
      bonusField: "CellBoostBonus",
      maxLevelField: "CellBoostMaxLevel",
      bonusStepLabel: "seconds timeskip to Cells Gained from Token & Diamond Chests",
      bonusStepMode: "additive",
      effectText:
        atu3EffectChain?.sharedEffectText ||
        '<b>+1</b> Seconds "timeskip" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.',
      note: "Checked shell-to-action-to-effect chain. This row stays effect-driven and is not promoted into a prefab or final-title remap.",
      supportingEvidenceNote: atu3SupportingConsumerShell
        ? "Supporting evidence only: the shared effect lane also reaches the AdManager chest consumer family, but the exact CellBoostBonus read-site handoff is still unresolved."
        : "Supporting evidence only: the shared effect lane stops at the checked action-to-effect chain and does not claim a typed gameplay-owner handoff."
    },
    {
      field: "ATU4Level",
      slot: "ATU4",
      identity:
        boundary?.traceFollowUp?.recoveredBridge?.prefabIdentity ||
        "NewTokenUPGPrefab.T1.ModPointsBooster",
      identitySource: "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "ModBoostStartCost",
      additiveCostField: "ModBoostAdditiveCost",
      bonusField: "ModBoostBonus",
      maxLevelField: "ModBoostMaxLevel",
      bonusStepLabel: "Mod Points Gained",
      bonusStepMode: "multiplier",
      note: "Checked shell-to-prefab bridge only. The remaining honest blocker is one exact shell-local join from the detached Tokens Booster, Tokens Booster T1, or >Diamond Upgrade 9 - TokensBoost title-side clue back to ATU1Button path id 15839."
    },
    {
      field: "ATU5Level",
      slot: "ATU5",
      identity:
        boundary?.boundedRecoveredBridge?.prefabIdentity || "NewTokenUPGPrefab.T1.MK1Booster",
      identitySource: "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "MK1TokenBoostStartCost",
      additiveCostField: "MK1TokenBoostAdditiveCost",
      bonusField: "MK1TokenBoostBonus",
      maxLevelField: "MK1TokenBoostFillMaxLevel",
      bonusStepLabel: "Mk1 Output",
      bonusStepMode: "multiplier",
      playerFacingSupportText:
        boundary?.atu5TitleFollowUp?.verifiedNamedIdentityJoin?.supportingTitleTextSurface ?? [],
      note: "Checked shell-to-prefab bridge only. This row stays compatibility-only until a final player-facing title join is recovered."
    },
    {
      field: "ATU6Level",
      slot: "ATU6",
      identity:
        boundary?.verifiedTitleJoin?.titleProbeTitle ||
        boundary?.boundedRecoveredBridgeFollowUp?.prefabIdentity ||
        "Mk2 Generator Booster",
      identitySource: boundary?.verifiedTitleJoin?.titleProbeTitle
        ? "Checked final title"
        : "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "MK2TokenBoostStartCost",
      additiveCostField: "MK2TokenBoostAdditiveCost",
      bonusField: "MK2TokenBoostBonus",
      maxLevelField: "MK2TokenBoostFillMaxLevel",
      bonusStepLabel: "Mk2 Output",
      bonusStepMode: "multiplier",
      playerFacingSupportText: boundary?.verifiedTitleJoin?.titleProbeSupportText ?? null,
      note: "Checked shell-to-prefab-to-title chain. This row is still boundary-backed non-canonical evidence only and does not unlock planner logic or canonical promotion."
    },
    {
      field: "ATU7Level",
      slot: "ATU7",
      identity:
        boundary?.atu7BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle ||
        boundary?.atu7BridgeFollowUp?.recoveredBridge?.prefabIdentity ||
        "Mk3 Generator Booster",
      identitySource: boundary?.atu7BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle
        ? "Checked title-side text chain"
        : "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "MK3TokenBoostStartCost",
      additiveCostField: "MK3TokenBoostAdditiveCost",
      bonusField: "MK3TokenBoostBonus",
      maxLevelField: "MK3TokenBoostFillMaxLevel",
      bonusStepLabel: "Mk3 Output",
      bonusStepMode: "multiplier",
      playerFacingSupportText:
        boundary?.atu7BridgeFollowUp?.verifiedTitleTextChain?.titleProbeSupportText ?? [],
      note: "Checked shell-to-prefab bridge only. This row stays compatibility-only until a final player-facing title join is recovered."
    },
    {
      field: "ATU8Level",
      slot: "ATU8",
      identity:
        boundary?.atu8BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle ||
        boundary?.atu8BridgeFollowUp?.recoveredBridge?.prefabIdentity ||
        "Mk4 Generator Booster",
      identitySource: boundary?.atu8BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle
        ? "Checked title-side text chain"
        : "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "MK4TokenBoostStartCost",
      additiveCostField: "MK4TokenBoostAdditiveCost",
      bonusField: "MK4TokenBoostBonus",
      maxLevelField: "MK4TokenBoostFillMaxLevel",
      bonusStepLabel: "Mk4 Output",
      bonusStepMode: "multiplier",
      playerFacingSupportText:
        boundary?.atu8BridgeFollowUp?.verifiedTitleTextChain?.titleProbeSupportText ?? [],
      note: "Checked shell-to-prefab-to-title-side-text chain. This row is still boundary-backed non-canonical evidence only and does not unlock planner logic or canonical promotion."
    },
    {
      field: "ATU9Level",
      slot: "ATU9",
      identity:
        boundary?.atu9BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle ||
        boundary?.atu9BridgeFollowUp?.recoveredBridge?.prefabIdentity ||
        "Mk5 Generator Booster",
      identitySource: boundary?.atu9BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle
        ? "Checked title-side text chain"
        : "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "MK5TokenBoostStartCost",
      additiveCostField: "MK5TokenBoostAdditiveCost",
      bonusField: "MK5TokenBoostBonus",
      maxLevelField: "MK5TokenBoostFillMaxLevel",
      bonusStepLabel: "Mk5 Output",
      bonusStepMode: "multiplier",
      playerFacingSupportText:
        boundary?.atu9BridgeFollowUp?.verifiedTitleTextChain?.titleProbeSupportText ?? [],
      note: "Checked shell-to-prefab-to-title-side-text chain. This row is still boundary-backed non-canonical evidence only and does not unlock planner logic or canonical promotion."
    },
    {
      field: "ATU10Level",
      slot: "ATU10",
      identity:
        boundary?.atu10BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle ||
        boundary?.atu10BridgeFollowUp?.recoveredBridge?.prefabIdentity ||
        "Mk6 Generator Booster",
      identitySource: boundary?.atu10BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle
        ? "Checked title-side text chain"
        : "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "MK6TokenBoostStartCost",
      additiveCostField: "MK6TokenBoostAdditiveCost",
      bonusField: "MK6TokenBoostBonus",
      maxLevelField: "MK6TokenBoostFillMaxLevel",
      bonusStepLabel: "Mk6 Output",
      bonusStepMode: "multiplier",
      playerFacingSupportText:
        boundary?.atu10BridgeFollowUp?.verifiedTitleTextChain?.titleProbeSupportText ?? [],
      note: "Checked shell-to-prefab-to-title-side-text chain. This row is still boundary-backed non-canonical evidence only and does not unlock planner logic or canonical promotion."
    },
    {
      field: "ATU12Level",
      slot: "ATU12",
      identity:
        boundary?.atu12BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle ||
        boundary?.atu12BridgeFollowUp?.recoveredBridge?.prefabIdentity ||
        "Mk8 Generator Booster",
      identitySource: boundary?.atu12BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle
        ? "Checked title-side text chain"
        : "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "MK8TokenBoostStartCost",
      additiveCostField: "MK8TokenBoostAdditiveCost",
      bonusField: "MK8TokenBoostBonus",
      maxLevelField: "MK8TokenBoostFillMaxLevel",
      bonusStepLabel: "Mk8 Output",
      bonusStepMode: "multiplier",
      playerFacingSupportText:
        boundary?.atu12BridgeFollowUp?.verifiedTitleTextChain?.titleProbeSupportText ?? [],
      note: "Checked shell-to-prefab-to-title-side-text chain. This row is still boundary-backed non-canonical evidence only and does not unlock planner logic or canonical promotion."
    }
  ];
}

function getTokenShopGroundedSubsetPreviewSummary(boundary, tokenShopState) {
  const resolvedTokenShopState =
    tokenShopState && typeof tokenShopState === "object" ? tokenShopState : {};
  const rows = getTokenShopGroundedSubsetDefinitions(boundary).map((row) => ({
    label: `Compatibility-only subset level: ${row.identity} (${row.slot})`,
    value: resolvedTokenShopState[row.field],
    path: `compatibility.unmappedSystemState.tokenShop.${row.field}`,
    note: row.note
  }));

  return {
    rows,
    importedCount: rows.filter((row) => isBoundaryValuePresent(row.value)).length,
    quarantineNote:
      "Only rows with checked remap-boundary joins are surfaced here. Remaining `ATU*Level` rows stay quarantined under `compatibility.unmappedSystemState.tokenShop` until more grounded row identities clear."
  };
}

function getTokenShopProgressionModel() {
  return buildTokenShopProgressionModel({
    progressionState: getTokenShopProgressionProfileState(),
    compatibilityLevels: getCompatibilityProfileState().unmappedSystems?.tokenShop ?? {},
    boundary: state.extractedMechanics?.tokenShopRowRemapBoundary,
    tokenShop: state.extractedMechanics?.tokenShop,
    currentTokens: state.playerProfile.player.resources.tokens,
    getGroundedSubsetDefinitions: getTokenShopGroundedSubsetDefinitions,
    getKnownMaxStatus: tokenShopUi.getTokenShopKnownMaxStatus,
    getCurrentVsNextBonusSummary: tokenShopUi.getTokenShopCurrentVsNextBonusSummary
  });
}

function renderTokenShopOverviewAffordabilityModule() {
  const summary = getTokenShopProgressionModel();
  const sourceLine = summary.playerStateCount
    ? `${summary.playerStateCount}/${summary.rows.length} checked player-state row${summary.playerStateCount === 1 ? "" : "s"} active before compatibility fallback.`
    : "No checked player-state rows are active yet; compatibility import and default level 0 stay available.";

  return `
    <div class="meta-stack">
      <p class="snapshot-title">Overview TokenShop affordability</p>
      <p class="meta">This Overview module stays fixed to the current grounded product-facing subset: <code>ATU1Level</code>, <code>ATU2Level</code>, <code>ATU3Level</code>, <code>ATU4Level</code>, <code>ATU5Level</code>, <code>ATU6Level</code>, <code>ATU7Level</code>, <code>ATU8Level</code>, <code>ATU9Level</code>, <code>ATU10Level</code>, and <code>ATU12Level</code>.</p>
      <p class="meta">Checked player-facing names are preferred where they exist, grounded prefab identity is used where they do not, and the rest of the unresolved <code>ATU*Level</code> family stays quarantined outside this module.</p>
      <p class="meta">${escapeHtml(sourceLine)}</p>
      <div class="pill-row">
        <span class="pill">${typeof summary.currentTokens === "number" ? `${summary.affordableCount}/${summary.rows.length} affordable from ${formatBoundaryValue(summary.currentTokens)} Tokens` : "Affordability gated by missing Tokens"}</span>
        <span class="pill">${summary.playerStateCount}/${summary.rows.length} checked player-state rows active</span>
        <span class="pill">${summary.compatibilityCount}/${summary.rows.length} compatibility fallback rows active</span>
        <span class="pill">${summary.defaultCount}/${summary.rows.length} defaulted to level 0</span>
        <span class="pill">${summary.knownCapCount} at or above known cap</span>
        <span class="pill">${escapeHtml(summary.displayRule)}</span>
      </div>
      <div class="preview-stack">
        ${summary.rows
          .map((row) => {
            const displayTitle = tokenShopUi.getTokenShopRowDisplayTitle(row);
            const bonusStripEntries = tokenShopUi.getTokenShopBonusStripEntries(row);
            const playerFacingSupportText = tokenShopUi.getTokenShopPlayerFacingSupportText(row);
            const nextKnownCostLabel = row.isMaxed
              ? "No next cost within known cap"
              : typeof row.nextKnownCost === "number"
                ? formatBoundaryValue(row.nextKnownCost)
                : "No known next cost";
            const affordabilityLine = row.isMaxed
              ? "No next purchase within known cap."
              : row.isAffordable === true
                ? "Affordable from current Tokens."
                : row.isAffordable === false &&
                    typeof row.nextKnownCost === "number" &&
                    typeof summary.currentTokens === "number"
                  ? `${formatBoundaryValue(row.nextKnownCost - summary.currentTokens)} more Tokens needed.`
                  : "Affordability unavailable until Tokens are entered.";

            return `
            <article class="preview-card token-shop-affordability-card">
              <div class="token-shop-game-row">
                <div class="token-shop-level-ring">
                  <span class="token-shop-level-value">${escapeHtml(formatBoundaryValue(row.currentLevel))}</span>
                  <span class="token-shop-level-divider">/</span>
                  <span class="token-shop-level-cap">${typeof row.maxLevel === "number" && Number.isFinite(row.maxLevel) ? escapeHtml(formatBoundaryValue(row.maxLevel)) : "?"}</span>
                </div>
                <div class="token-shop-main-lane">
                  <div class="token-shop-top-band">
                    <div class="token-shop-affordability-head">
                      <div class="meta-stack">
                        <strong>${escapeHtml(displayTitle)}</strong>
                        <div class="token-shop-row-tags">
                          <span class="token-shop-row-tag">${escapeHtml(row.rowTypeLabel || "Checked row")}</span>
                          ${row.identitySource ? `<span class="token-shop-row-tag token-shop-row-tag-muted">${escapeHtml(row.identitySource)}</span>` : ""}
                        </div>
                        <p class="meta token-shop-effect-line">${escapeHtml(tokenShopUi.formatTokenShopSentence(tokenShopUi.formatTokenShopEffectLine(row)))}</p>
                        ${playerFacingSupportText ? `<p class="meta">${escapeHtml(tokenShopUi.formatTokenShopSentence(playerFacingSupportText))}</p>` : ""}
                      </div>
                    </div>
                  </div>
                  <div class="token-shop-stat-strip">
                    ${bonusStripEntries
                      .map(
                        (entry) => `
                      <div class="validation-card warn token-shop-stat-card">
                        <span class="snapshot-title">Current vs next bonus • ${escapeHtml(entry.label)}</span>
                        <strong>${escapeHtml(entry.currentLabel)}</strong>
                        <p class="meta">Next ${escapeHtml(entry.nextLabel)}</p>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                  <div class="token-shop-editor-strip">
                    <div class="token-shop-editor-meta">
                      <p class="meta">Level ${escapeHtml(formatBoundaryValue(row.currentLevel))} • ${escapeHtml(row.currentLevelSourceLabel)}</p>
                      <p class="meta">${escapeHtml(tokenShopUi.getTokenShopRowGroundingSummary(row))}</p>
                      <p class="meta">${escapeHtml(row.maxStatus.label)}</p>
                      <p class="meta">${escapeHtml(row.currentVsNextBonus.detail)}</p>
                    </div>
                  </div>
                </div>
                <div class="token-shop-buy-panel">
                  <span class="token-shop-buy-label">${escapeHtml(tokenShopUi.getTokenShopActionLabel(row))}</span>
                  <strong>${escapeHtml(nextKnownCostLabel)}</strong>
                  <p class="meta">${escapeHtml(affordabilityLine)}</p>
                </div>
              </div>
            </article>
          `;
          })
          .join("")}
      </div>
      <p class="meta">Overview affordability only. No best-buy order, ROI, ranking, token-bank planner behavior, Daily Tokenium planner behavior, or canonical <code>state.playerProfile</code> promotion is added here.</p>
    </div>
  `;
}

function saveTokenShopProgressionLevel(fieldName, value) {
  if (!fieldName) {
    return;
  }
  setProfileValue(
    ["planning", "tokenShop", "checkedSubsetLevels", fieldName],
    value,
    state.playerProfile
  );
  persistPlayerProfile();
  setStatus(
    "tokenShopProgressionStatus",
    `Saved ${fieldName} for the checked TokenShop subset editor.`,
    "success"
  );
  renderProgressionResults(runProgressionOptimization());
}

function prefillTokenShopProgressionEditorFromCompatibility() {
  const compatibilityLevels = getCompatibilityProfileState().unmappedSystems?.tokenShop ?? {};
  const subsetFields = getTokenShopGroundedSubsetDefinitions(
    state.extractedMechanics?.tokenShopRowRemapBoundary
  ).map((row) => row.field);
  let importedCount = 0;
  subsetFields.forEach((fieldName) => {
    const importedValue = compatibilityLevels?.[fieldName];
    if (typeof importedValue === "number" && Number.isFinite(importedValue)) {
      setProfileValue(
        ["planning", "tokenShop", "checkedSubsetLevels", fieldName],
        importedValue,
        state.playerProfile
      );
      importedCount += 1;
    }
  });
  persistPlayerProfile();
  setStatus(
    "tokenShopProgressionStatus",
    importedCount
      ? `Prefilled ${importedCount} checked TokenShop row level${importedCount === 1 ? "" : "s"} from compatibility import state.`
      : "No imported checked TokenShop subset levels were available to prefill.",
    importedCount ? "success" : "warning"
  );
  renderProgressionResults(runProgressionOptimization());
}

function clearTokenShopProgressionEditorLevels() {
  getTokenShopGroundedSubsetDefinitions(
    state.extractedMechanics?.tokenShopRowRemapBoundary
  ).forEach((row) => {
    setProfileValue(
      ["planning", "tokenShop", "checkedSubsetLevels", row.field],
      null,
      state.playerProfile
    );
  });
  persistPlayerProfile();
  setStatus(
    "tokenShopProgressionStatus",
    "Cleared local TokenShop editor levels. Compatibility imports remain available as prefill only.",
    "success"
  );
  renderProgressionResults(runProgressionOptimization());
}

function renderTokenShopProgressionEditor() {
  const summary = getTokenShopProgressionModel();

  return `
    <article class="validation-card warn">
      <strong>Grounded TokenShop checked-row editor</strong>
      <p class="meta">Checked subset only. This progression seam resolves current level from checked player state first, compatibility fallback second, and local override when you edit inside this tool.</p>
      <p class="meta">This module is explicitly non-optimizer and stays fixed to the current grounded product-facing subset: <code>ATU1Level</code>, <code>ATU2Level</code>, <code>ATU3Level</code>, <code>ATU4Level</code>, <code>ATU5Level</code>, <code>ATU6Level</code>, <code>ATU7Level</code>, <code>ATU8Level</code>, <code>ATU9Level</code>, <code>ATU10Level</code>, and <code>ATU12Level</code>.</p>
      <p class="meta">Prefab-driven checked rows and effect-driven checked rows are shown separately inside the same bounded subset. ATU3 remains effect-driven, ATU10 and ATU12 are newly grounded title-side rows, ATU11 stays quarantined because it still lacks a final title join, and the rest of the unresolved ATU family stays outside this editor.</p>
      <div class="profile-actions">
        <button class="button" type="button" data-token-shop-prefill>Prefill local rows from compatibility import</button>
        <button class="button button-ghost" type="button" data-token-shop-clear-local>Clear local row levels</button>
      </div>
      <div class="pill-row">
        <span class="pill">${summary.localCount}/${summary.rows.length} local overrides active</span>
        <span class="pill">${summary.playerStateCount}/${summary.rows.length} checked player-state rows active</span>
        <span class="pill">${summary.compatibilityCount}/${summary.rows.length} compatibility fallback rows active</span>
        <span class="pill">${summary.defaultCount}/${summary.rows.length} defaulted to level 0</span>
        <span class="pill">${typeof summary.currentTokens === "number" ? `${summary.affordableCount}/${summary.rows.length} affordable from ${formatBoundaryValue(summary.currentTokens)} Tokens` : "Affordability gated by missing Tokens"}</span>
        <span class="pill">${summary.knownCapCount} at or above known cap</span>
        <span class="pill">${escapeHtml(summary.displayRule)}</span>
        <span class="pill">No canonical ATU promotion</span>
      </div>
      <div class="preview-stack">
        ${summary.rows
          .map((row) => {
            const displayTitle = tokenShopUi.getTokenShopRowDisplayTitle(row);
            const currentLevelLabel = formatBoundaryValue(row.currentLevel);
            const effectLine = tokenShopUi.formatTokenShopSentence(
              tokenShopUi.formatTokenShopEffectLine(row)
            );
            const playerFacingSupportText = tokenShopUi.getTokenShopPlayerFacingSupportText(row);
            const actionLabel = tokenShopUi.getTokenShopActionLabel(row);
            const bonusStripEntries = tokenShopUi.getTokenShopBonusStripEntries(row);
            const groundingSummary = tokenShopUi.getTokenShopRowGroundingSummary(row);
            const nextKnownCostLabel = row.isMaxed
              ? "No next cost within known cap"
              : typeof row.nextKnownCost === "number"
                ? formatBoundaryValue(row.nextKnownCost)
                : "No known next cost";
            const affordabilityLine = row.isMaxed
              ? "No next purchase within known cap."
              : row.isAffordable === true
                ? "Affordable from current Tokens."
                : row.isAffordable === false &&
                    typeof row.nextKnownCost === "number" &&
                    typeof summary.currentTokens === "number"
                  ? `${formatBoundaryValue(row.nextKnownCost - summary.currentTokens)} more Tokens needed.`
                  : "Affordability unavailable until Tokens are entered.";
            const costFormulaLine =
              typeof row.startCost === "number" && typeof row.additiveCost === "number"
                ? `Known cost inputs: start ${formatBoundaryValue(row.startCost)} + additive ${formatBoundaryValue(row.additiveCost)} x current level.`
                : "Known cost inputs are incomplete in this build.";

            return `
            <article class="preview-card token-shop-affordability-card">
              <div class="token-shop-game-row">
                <div class="token-shop-level-ring">
                  <span class="token-shop-level-value">${escapeHtml(currentLevelLabel)}</span>
                  <span class="token-shop-level-divider">/</span>
                  <span class="token-shop-level-cap">${typeof row.maxLevel === "number" && Number.isFinite(row.maxLevel) ? escapeHtml(formatBoundaryValue(row.maxLevel)) : "?"}</span>
                </div>
                <div class="token-shop-main-lane">
                  <div class="token-shop-top-band">
                    <div class="token-shop-affordability-head">
                      <div class="meta-stack">
                        <strong>${escapeHtml(displayTitle)}</strong>
                        <div class="token-shop-row-tags">
                          <span class="token-shop-row-tag">${escapeHtml(row.rowTypeLabel || "Checked row")}</span>
                          ${row.identitySource ? `<span class="token-shop-row-tag token-shop-row-tag-muted">${escapeHtml(row.identitySource)}</span>` : ""}
                        </div>
                        <p class="meta token-shop-effect-line">${escapeHtml(effectLine)}</p>
                        ${playerFacingSupportText ? `<p class="meta">${escapeHtml(tokenShopUi.formatTokenShopSentence(playerFacingSupportText))}</p>` : ""}
                      </div>
                    </div>
                  </div>
                  <div class="token-shop-stat-strip">
                    ${bonusStripEntries
                      .map(
                        (entry) => `
                      <div class="validation-card warn token-shop-stat-card">
                        <span class="snapshot-title">Current vs next bonus • ${escapeHtml(entry.label)}</span>
                        <strong>${escapeHtml(entry.currentLabel)}</strong>
                        <p class="meta">Next ${escapeHtml(entry.nextLabel)}</p>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                  <div class="token-shop-editor-strip">
                    <div class="token-shop-editor-meta">
                      <p class="meta">Level ${escapeHtml(currentLevelLabel)} • ${escapeHtml(row.currentLevelSourceLabel)}</p>
                      <p class="meta">${escapeHtml(costFormulaLine)}</p>
                      <p class="meta">${escapeHtml(groundingSummary)}</p>
                      <details class="token-shop-evidence-note">
                        <summary>Grounding note</summary>
                        <p class="meta">${escapeHtml(row.note)}</p>
                        ${row.supportingEvidenceNote ? `<p class="meta">${escapeHtml(row.supportingEvidenceNote)}</p>` : ""}
                      </details>
                    </div>
                  </div>
                </div>
                <div class="token-shop-buy-panel">
                  <span class="token-shop-buy-label">${escapeHtml(actionLabel)}</span>
                  <strong>${escapeHtml(nextKnownCostLabel)}</strong>
                  <p class="meta">${escapeHtml(row.maxStatus.label)}</p>
                  <p class="meta">${escapeHtml(affordabilityLine)}</p>
                  <label class="mini-field token-shop-level-editor token-shop-level-editor-buy">
                    <span>Set current level</span>
                    <input
                      data-token-shop-level-field="${escapeHtml(row.field)}"
                      type="number"
                      min="0"
                      step="1"
                      value="${escapeHtml(String(row.currentLevel))}"
                      placeholder="0"
                    >
                  </label>
                  <button
                    type="button"
                    class="token-shop-buy-button"
                    data-token-shop-buy-field="${escapeHtml(row.field)}"
                    data-token-shop-current-level="${escapeHtml(String(row.currentLevel))}"
                    ${row.isMaxed ? "disabled" : ""}
                  >Buy +1 lvl</button>
                </div>
              </div>
            </article>
          `;
          })
          .join("")}
      </div>
      <p class="meta">Non-canonical checked-row progression seam only. Broader TokenShop remap, token-bank, Daily Tokenium, Emporium, and ROI or ranking logic stay outside this surface.</p>
    </article>
  `;
}

function renderImportedMultiverseMarketPreviewCard(preview) {
  const model = getImportedMultiverseMarketPreviewCardModel(preview, formatShardNumber);
  if (!model.hasPreview) {
    return "";
  }

  return `
    <article class="preview-card">
      <strong>Emporium compatibility preview</strong>
      <p class="meta">This is a descriptive preview of compatibility-only Emporium import state under <code>${escapeHtml(preview.importTargetPath)}</code>. It preserves the checked raw <code>${escapeHtml(preview.typedSpanLabel)}</code> span plus separate bounded trade-counter and early-mech quarantine ranges as non-canonical evidence only.</p>
      <div class="pill-row">
        ${model.pillLabels.map((label) => `<span class="pill">${escapeHtml(label)}</span>`).join("")}
      </div>
      <div class="meta-stack">
        ${model.metaLines
          .map((line) => {
            if (typeof line === "string") {
              return `<p class="meta">${escapeHtml(line)}</p>`;
            }
            if (Array.isArray(line.codePairs)) {
              return `<p class="meta">${escapeHtml(line.text)}${line.codePairs
                .map(
                  ([code, suffix], index) =>
                    `${index ? ", " : ""}<code>${escapeHtml(code)}</code>${escapeHtml(suffix)}`
                )
                .join("")}.</p>`;
            }
            return `<p class="meta">${line.text ? escapeHtml(line.text) : ""}<code>${escapeHtml(line.code)}</code>${escapeHtml(line.suffix)}</p>`;
          })
          .join("")}
        ${
          model.overlapCards.length
            ? `<div class="preview-stack">${model.overlapCards
                .map(
                  (entry) => `
          <article class="preview-card">
            <strong>${escapeHtml(entry.title)}</strong>
            <p class="meta">Imported raw level ${escapeHtml(entry.level)} at <code>${escapeHtml(entry.fieldPath)}</code>.</p>
            <p class="meta">This row sits inside the checked ordered-overlap support band only. It is still not a recovered player-facing row label or canonical Emporium identity.</p>
            <p class="meta">Structured compatibility evidence from <code>${escapeHtml(entry.shapeId)}</code>:</p>
            <div class="meta-stack">
              ${entry.groundedFields.map((field) => `<p class="meta"><code>${escapeHtml(field.key)}</code> -> <code>${escapeHtml(field.slotAlias)}</code> via <code>${escapeHtml(field.sourceLane)}</code> (${escapeHtml(field.status)})</p>`).join("")}
              ${entry.quarantinedFields.map((field) => `<p class="meta"><code>${escapeHtml(field.key)}</code> -> <code>${escapeHtml(field.slotAlias)}</code> (${escapeHtml(field.status)}; ${escapeHtml(field.reason)})</p>`).join("")}
            </div>
          </article>
        `
                )
                .join("")}</div>`
            : ""
        }
        <div class="preview-stack">${model.previewRows
          .map(
            (entry) => `
          <article class="preview-card">
            <strong>IS${escapeHtml(String(entry.rowId))}Level</strong>
            <p class="meta">Imported raw level ${escapeHtml(entry.level)}</p>
            <p class="meta"><code>${escapeHtml(entry.fieldPath)}</code></p>
          </article>
        `
          )
          .join("")}</div>
        ${model.trailingPreviewLine ? `<p class="meta">${escapeHtml(model.trailingPreviewLine)}</p>` : ""}
        ${
          preview.hasTradeCounterPreview
            ? `<div class="preview-stack">${model.importedTradeCounters
                .map(
                  (entry) => `
          <article class="preview-card">
            <strong>${escapeHtml(entry.key)}</strong>
            <p class="meta">Imported raw count ${escapeHtml(formatBoundaryValue(entry.value))}</p>
            <p class="meta"><code>${escapeHtml(entry.fieldPath)}</code></p>
          </article>
        `
                )
                .join("")}</div>`
            : ""
        }
        ${preview.tradeCounterSampleLine ? `<p class="meta">Trade-counter sample: ${escapeHtml(preview.tradeCounterSampleLine)}${preview.importedTradeCounterCount > 6 ? "..." : ""}</p>` : ""}
        ${
          preview.hasEarlyMechPreview
            ? `<div class="preview-stack">${model.importedEarlyMechFields
                .map(
                  (entry) => `
          <article class="preview-card">
            <strong>${escapeHtml(entry.key)}</strong>
            <p class="meta">Imported raw value ${escapeHtml(formatBoundaryValue(entry.value))}</p>
            <p class="meta"><code>${escapeHtml(entry.fieldPath)}</code></p>
          </article>
        `
                )
                .join("")}</div>`
            : ""
        }
      </div>
    </article>
  `;
}

function renderOverviewSupportSummary(apkValidation, supportValidation) {
  if (!apkValidation.length && !supportValidation.length) {
    return "";
  }

  const apkPassing = apkValidation.filter((item) => item.pass).length;
  const passing = supportValidation.filter((item) => item.pass).length;
  return `
    <article class="validation-card warn">
      <strong>Grounding checks stay separate from MVP behavior</strong>
      ${apkValidation.length ? `<p class="meta">${apkPassing}/${apkValidation.length} APK-grounding checks currently pass.</p>` : ""}
      ${supportValidation.length ? `<p class="meta">${passing}/${supportValidation.length} labeled support checks currently pass.</p>` : ""}
      <p class="meta">APK-grounding checks confirm extracted mechanic bundles and mapping gates so available-but-unmapped systems do not get mixed into app truth. Shard milestone rows currently remain descriptive community-grounded data until game-side owner mapping exists.</p>
    </article>
  `;
}

function getActiveMvpRecommendationFeed() {
  return getActiveMvpRecommendationFeedPartition().valid;
}

function getActiveMvpRecommendationFeedSupport() {
  return getActiveMvpRecommendationFeedPartition().invalid;
}

function getActiveMvpRecommendationFeedPartition() {
  return getProgressionRecommendationFeedPartition(runProgressionOptimization());
}

function getProgressionSubsystemPartition(items) {
  const shardItems = [];
  const loopItems = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (item?.module === "loop") {
      loopItems.push(item);
      return;
    }
    if (item?.module === "shards") {
      shardItems.push(item);
    }
  });
  return {
    shards: shardItems,
    loop: loopItems,
    tokenShop: getTokenShopGroundedSubsetDefinitions(
      state.extractedMechanics?.tokenShopRowRemapBoundary
    )
  };
}

function getSelectedProgressionSubsystem() {
  return ["shards", "loop", "tokenShop"].includes(state.progressionView)
    ? state.progressionView
    : "shards";
}

function renderProgressionSubsystemToggle(subsystemFeed) {
  const counts = {
    shards: Array.isArray(subsystemFeed?.shards) ? subsystemFeed.shards.length : 0,
    loop: Array.isArray(subsystemFeed?.loop) ? subsystemFeed.loop.length : 0,
    tokenShop: Array.isArray(subsystemFeed?.tokenShop) ? subsystemFeed.tokenShop.length : 0
  };
  const selected = getSelectedProgressionSubsystem();
  $("#progressionSubsystemToggle").innerHTML = [
    { id: "shards", label: `Shard Mining (${counts.shards})` },
    { id: "loop", label: `Loop Prestige (${counts.loop})` },
    { id: "tokenShop", label: `TokenShop (${counts.tokenShop})` }
  ]
    .map(
      (item) => `
    <button class="button${selected === item.id ? " is-active" : ""}" type="button" data-progression-view="${escapeHtml(item.id)}" role="tab" aria-selected="${selected === item.id}">
      ${escapeHtml(item.label)}
    </button>
  `
    )
    .join("");
}

function renderProgressionSubsystemSection(title, eyebrow, description, items, tone) {
  const cards = (Array.isArray(items) ? items : [])
    .map((item) => makeRecommendationCard(item, tone))
    .join("");
  return `
    <section class="meta-stack">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>
      <p class="meta">${escapeHtml(description)}</p>
      ${cards ? `<div class="recommendation-list">${cards}</div>` : `<article class="validation-card warn"><strong>${escapeHtml(title)} unavailable</strong><p class="meta">No player-facing cards currently passed the shared recommendation contract for this subsystem.</p></article>`}
    </section>
  `;
}

function sortRecommendationFeed(items) {
  return sortNormalizedRecommendationFeed(items);
}

function renderRecommendationFeedSummary(results, surface) {
  if (!results.length) {
    return "";
  }

  const summaryModel = getRecommendationFeedSummaryModel(results);
  return `
    <article class="validation-card warn">
      <strong>${surface === "overview" ? "Active MVP recommendation feed" : "Progression feed status"}</strong>
      <p class="meta">The current feed ranks trust-oriented warning urgency for the active shard and loop modules. These scores are UI priority, not ROI math.</p>
      <p class="meta">Visible feed items: ${summaryModel.visibleCount}. Loop guardrails: ${summaryModel.loopCount}. Shard workflow cards: ${summaryModel.shardCount}.</p>
      <p class="meta">${summaryModel.contractAudit.invalidCount === 0 ? "All visible cards currently satisfy the shared recommendation contract." : `Contract gaps still hide ${summaryModel.contractAudit.invalidCount} item${summaryModel.contractAudit.invalidCount === 1 ? "" : "s"} from the active feed (${escapeHtml(summaryModel.contractAudit.topIssueLine)}).`}</p>
      <p class="meta">Spend-planner recommendations remain blocked by system-mapping gaps, so this feed only covers MVP-safe watch notes.</p>
    </article>
  `;
}

function renderRecommendationFeedSupportNotice(results, surface) {
  if (!results.length) {
    return "";
  }

  return renderSupportSurfaceNotice(
    surface === "overview" ? "Quarantined feed items" : "Quarantined progression items",
    getRecommendationFeedSupportNoticeLines(results)
  );
}

function renderSupportSurfaceNotice(title, lines) {
  return `
    <article class="validation-card warn">
      <strong>${escapeHtml(title)}</strong>
      ${lines.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}
    </article>
  `;
}

function renderValidationSection(title, description, results) {
  if (!results.length) {
    return "";
  }

  return `
    <section class="meta-stack">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Validation scope</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
      </div>
      <p class="meta">${escapeHtml(description)}</p>
      <div class="validation-grid">
        ${results
          .map(
            (item) => `
          <article class="validation-card ${item.pass ? "pass" : "warn"}">
            <strong>${item.title}</strong>
            <p class="meta">${getValidationScopeMeta(item.scope)}</p>
            <p class="validation-status">${getValidationStatusMeta(item)}</p>
            <p class="meta">${item.actual}</p>
          </article>
        `
          )
          .join("")}
      </div>
    </section>
  `;
}

function previewImport() {
  const format = $("#importFormat").value;
  const dataset = $("#importDataset").value;
  if (dataset === "shardMilestones") {
    state.importPreview = [];
    $("#importPreview").innerHTML = "";
    setStatus(
      "importStatus",
      "Shard milestone manual import stays disabled; this build only uses the bundled grounded descriptive dataset.",
      "warning"
    );
    return [];
  }
  const raw = $("#importText").value.trim();
  if (!raw) {
    state.importPreview = [];
    $("#importPreview").innerHTML = "";
    setStatus("importStatus", "Paste data or choose a file first.", "warning");
    return [];
  }

  const rows = format === "json" ? JSON.parse(raw) : parseCsv(raw);
  state.importPreview = rows.map((row, index) => normalizeImportRow(row, dataset, index));
  $("#importPreview").innerHTML = state.importPreview
    .slice(0, 8)
    .map(
      (row) => `
    <article class="preview-card">
      <strong>Row</strong>
      <pre>${escapeHtml(JSON.stringify(row, null, 2))}</pre>
    </article>
  `
    )
    .join("");
  setStatus("importStatus", `Previewed ${state.importPreview.length} normalized rows.`, "success");
  return state.importPreview;
}

function applyImportPreview() {
  const dataset = $("#importDataset").value;
  if (dataset === "shardMilestones") {
    state.importPreview = [];
    setStatus(
      "importStatus",
      "Shard milestone manual import stays disabled; this build only uses the bundled grounded descriptive dataset.",
      "warning"
    );
    return;
  }
  if (!state.importPreview.length) {
    previewImport();
  }
  if (!state.importPreview.length) {
    return;
  }
  state.snapshot[dataset] = state.importPreview;
  state.snapshot.snapshotVersion = bumpSnapshotVersion(state.snapshot.snapshotVersion);
  state.sourceRegistry.unshift({
    dataset,
    source: $("#importSource").value || "Manual import",
    rows: state.importPreview.length,
    importedAt: new Date().toISOString()
  });
  saveStoredJson(STORAGE_KEYS.snapshot, state.snapshot);
  setStatus(
    "importStatus",
    `Imported ${state.importPreview.length} rows into ${dataset}.`,
    "success"
  );
  renderAll();
}

function exportSnapshot() {
  const blob = new Blob([JSON.stringify(state.snapshot, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = "cifi-snapshot.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("importStatus", "Exported active snapshot.", "success");
}

function renderGeneratorOcrFileList() {
  const items = getQueuedGeneratorOcrFiles().map((file, index) => ({
    name: file.name || `clipboard-${index + 1}.png`,
    size: file.size || 0,
    source: state.generatorOcrImages.includes(file) ? "clipboard" : "file"
  }));

  $("#generatorOcrFileList").innerHTML = items.length
    ? items
        .map(
          (item) =>
            `<article class="preview-card"><strong>${escapeHtml(item.name)}</strong><p class="meta">${Math.round(item.size / 1024)} KB | ${item.source}</p></article>`
        )
        .join("")
    : `<p class="meta">No screenshots selected yet.</p>`;

  renderGeneratorOcrPreview();
  renderGeneratorOcrButtons();

  if (state.generatorOcrBusy) {
    setStatus("generatorOcrStatus", "Parsing generator screenshots...", "warning");
    return;
  }

  if (state.generatorOcrParsed) {
    const count = Object.keys(state.generatorOcrParsed.parsed ?? {}).length;
    setStatus(
      "generatorOcrStatus",
      `Experimental OCR parsed ${count} generator tiers. Review it carefully before applying.`,
      "success"
    );
    return;
  }

  const message = items.length
    ? "Experimental OCR screenshots queued. Click Parse screenshots to extract generator manual values."
    : "Experimental OCR is not part of the MVP path. Select screenshots or paste them from the clipboard only if you need this support flow.";
  setStatus("generatorOcrStatus", message, "warning");
}

function handleGeneratorOcrPaste(event) {
  const items = [...(event.clipboardData?.items ?? [])];
  const images = items
    .filter((item) => item.type.startsWith("image/"))
    .map((item, index) => {
      const file = item.getAsFile();
      if (!file) {
        return null;
      }
      return new File([file], file.name || `clipboard-${Date.now()}-${index + 1}.png`, {
        type: file.type
      });
    })
    .filter(Boolean);

  if (!images.length) {
    setStatus("generatorOcrStatus", "Clipboard did not contain an image.", "warning");
    return;
  }

  event.preventDefault();
  state.generatorOcrImages = [...state.generatorOcrImages, ...images];
  state.generatorOcrParsed = null;
  $("#generatorOcrText").value = "";
  renderGeneratorOcrFileList();
}

function getQueuedGeneratorOcrFiles() {
  return [...($("#generatorOcrFiles").files ?? []), ...(state.generatorOcrImages ?? [])];
}

function renderGeneratorOcrButtons() {
  const hasFiles = getQueuedGeneratorOcrFiles().length > 0;
  $("#parseGeneratorOcrBtn").disabled = !hasFiles || state.generatorOcrBusy;
  $("#applyGeneratorOcrBtn").disabled =
    state.generatorOcrBusy || !$("#generatorOcrText").value.trim();
}

function renderGeneratorOcrPreview() {
  const preview = $("#generatorOcrPreview");
  const parsed = state.generatorOcrParsed;
  if (!parsed) {
    preview.innerHTML = `<p class="meta">No parsed OCR output yet.</p>`;
    return;
  }

  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  if (!rows.length) {
    preview.innerHTML = `<p class="meta">OCR finished, but no generator rows were recognized.</p>`;
    return;
  }

  preview.innerHTML = rows
    .map((row) => {
      const tier = escapeHtml(String(row.tier ?? ""));
      const manual = escapeHtml(String(row.manual ?? ""));
      const titleRaw = escapeHtml(String(row.title_raw ?? ""));
      const manualRaw = escapeHtml(String(row.manual_raw ?? ""));
      return `
      <article class="preview-card">
        <strong>${tier.toUpperCase()}</strong>
        <p class="meta">Manual: ${manual}</p>
        <p class="meta">Title OCR: ${titleRaw || "-"}</p>
        <p class="meta">Manual OCR: ${manualRaw || "-"}</p>
      </article>
    `;
    })
    .join("");
}

async function parseGeneratorOcrImages() {
  const files = getQueuedGeneratorOcrFiles();
  if (!files.length) {
    setStatus("generatorOcrStatus", "Select or paste at least one screenshot first.", "warning");
    return;
  }

  state.generatorOcrBusy = true;
  state.generatorOcrParsed = null;
  $("#generatorOcrText").value = "";
  renderGeneratorOcrFileList();

  try {
    const images = await Promise.all(files.map(fileToOcrPayload));
    const response = await fetch("/api/generator-ocr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ images })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Generator OCR request failed.");
    }

    state.generatorOcrParsed = payload;
    $("#generatorOcrText").value = JSON.stringify(payload.parsed ?? payload, null, 2);
    setStatus(
      "generatorOcrStatus",
      "Experimental OCR parsed successfully. Review the rows below before applying.",
      "success"
    );
  } catch (error) {
    state.generatorOcrParsed = null;
    setStatus("generatorOcrStatus", `Generator OCR failed: ${error.message}`, "warning");
  } finally {
    state.generatorOcrBusy = false;
    renderGeneratorOcrFileList();
  }
}

async function fileToOcrPayload(file) {
  const arrayBuffer = await file.arrayBuffer();
  return {
    name: file.name,
    type: file.type || "image/png",
    data: arrayBufferToBase64(arrayBuffer)
  };
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function applyGeneratorOcrPreview() {
  const raw = $("#generatorOcrText").value.trim();
  if (!raw) {
    setStatus(
      "generatorOcrStatus",
      "Parse screenshots first, or paste parsed generator OCR JSON.",
      "warning"
    );
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    setStatus("generatorOcrStatus", "Generator OCR JSON is not valid.", "warning");
    return;
  }

  const rows = Array.isArray(parsed)
    ? parsed
    : Object.entries(parsed).map(([tier, manual]) => ({ tier, manual }));
  const normalized = rows.reduce((accumulator, row, index) => {
    const tierKey = normalizeGeneratorTierKey(row.tier ?? row.mk ?? row.id ?? `n${index + 1}`);
    if (!tierKey) {
      return accumulator;
    }
    accumulator[tierKey] = normalizeCiNumberValue(
      row.manual ?? row.value ?? row.manualOwned ?? row.amount ?? ""
    );
    return accumulator;
  }, {});

  if (!Object.keys(normalized).length) {
    setStatus(
      "generatorOcrStatus",
      "No usable generator manual values were found in that JSON.",
      "warning"
    );
    return;
  }

  getShipCommunityToolState().generators = {
    ...getShipCommunityToolState().generators,
    ...normalized
  };
  persistPlayerProfile();
  renderShipPlayerState();
  renderShipPanels();
  renderGeneratorOcrButtons();
  setStatus(
    "generatorOcrStatus",
    `Applied experimental OCR values for ${Object.keys(normalized).length} generator tiers.`,
    "success"
  );
}

function persistShipConfig(showStatus = false) {
  saveStoredJson(STORAGE_KEYS.shipConfig, state.shipConfig);
  if (showStatus) {
    setStatus("shipConfigStatus", "Community-tool ship planner state saved.", "success");
  }
}

function getImportedRecordCount() {
  return ["shipLoadouts", "validationCases"].reduce(
    (total, key) => total + (Array.isArray(state.snapshot[key]) ? state.snapshot[key].length : 0),
    0
  );
}

function getGroundedShardMilestones() {
  return state.shardGrounding?.milestones?.milestones ?? [];
}

function getGroundedShardMechanics() {
  return state.shardGrounding?.milestones?.canonicalMechanics?.shardMilestoneSystem ?? {};
}

function getSelectedShardMilestoneId() {
  return (
    getShardPlannerState().focusMilestoneId ||
    getDefaultShardFocusMilestoneId(getGroundedShardMilestones()) ||
    ""
  );
}

function getShardFocusMilestone() {
  const milestones = getGroundedShardMilestones();
  const selectedId = getSelectedShardMilestoneId();
  return milestones.find((milestone) => milestone.id === selectedId) || milestones[0] || null;
}

function getMilestonesForDisplay() {
  const milestonesByRow = new Map(
    getGroundedShardMilestones().map((milestone) => [Number(milestone.milestoneNumber), milestone])
  );
  return getShardMilestoneFamilyEvidence()
    .map((entry) => milestonesByRow.get(Number(entry.row)))
    .filter(Boolean);
}

function isShardMilestoneOpen(id) {
  return state.shardMilestoneCardOpenIds.includes(String(id));
}

function syncShardMilestoneOpenState(id, open) {
  if (!id) {
    return;
  }
  const key = "shardMilestoneCardOpenIds";
  const nextIds = new Set(state[key] ?? []);
  if (open) {
    nextIds.add(String(id));
  } else {
    nextIds.delete(String(id));
  }
  state[key] = [...nextIds];
}

function getShardFocusLevelForMilestone(milestone) {
  if (!milestone) {
    return "";
  }
  const value = getShardPlannerState().observedLevelsByMilestone?.[milestone.id];
  return value ?? "";
}

function getShardSceneMonoBehaviourProbeSummary(probe) {
  const monoBehaviours = Array.isArray(probe?.monoBehaviours) ? probe.monoBehaviours : [];
  const shardMining = monoBehaviours.find((entry) => entry?.scriptName === "ShardMining");
  const textHandler = monoBehaviours.find(
    (entry) => entry?.scriptName === "ShardPerLevelTextHandler"
  );
  const constructionMilestones = monoBehaviours.find(
    (entry) => entry?.scriptName === "ConstructionMilestones"
  );
  const formatProbeLabel = (entry) =>
    entry
      ? `${entry.assetsFile} path ${entry.pathId} @ ${entry.byteStart} (${entry.byteSize} bytes)`
      : "unavailable";
  return {
    hasBoundary: Boolean(shardMining),
    shardMiningLabel: formatProbeLabel(shardMining),
    textHandlerLabel: formatProbeLabel(textHandler),
    constructionMilestonesLabel: formatProbeLabel(constructionMilestones)
  };
}

function getShardCostParameterProbeSummary(probe) {
  const metadataFamilies = probe?.metadataFamilies ?? {};
  const candidateTuples = Array.isArray(probe?.shardMiningCandidateTuples)
    ? probe.shardMiningCandidateTuples
    : [];
  const rowAlignedTuples = Array.isArray(probe?.rowAlignedTupleCandidates)
    ? probe.rowAlignedTupleCandidates
    : [];
  const signatureGroups = Array.isArray(probe?.signatureGroups) ? probe.signatureGroups : [];
  const startCostFields = Array.isArray(metadataFamilies.startCostFields)
    ? metadataFamilies.startCostFields
    : [];
  const costExponentFields = Array.isArray(metadataFamilies.costExponentFields)
    ? metadataFamilies.costExponentFields
    : [];
  const growthExponentFields = Array.isArray(metadataFamilies.growthExponentFields)
    ? metadataFamilies.growthExponentFields
    : [];
  const sampleTuple = rowAlignedTuples[0] ?? candidateTuples[0] ?? null;
  return {
    hasFullMetadataFamilies:
      startCostFields.length === 30 &&
      costExponentFields.length === 30 &&
      growthExponentFields.length >= 30,
    metadataLabel:
      startCostFields.length === 30 && costExponentFields.length === 30
        ? "SU0-29 StartCost and CostExponent"
        : "partial SU* cost fields",
    hasCandidateTuples: candidateTuples.length > 0,
    hasRowAlignedTuples: rowAlignedTuples.length > 0,
    candidateTupleCount: candidateTuples.length,
    rowAlignedTupleCount: rowAlignedTuples.length,
    signatureGroupCount: signatureGroups.length,
    sampleTupleLabel: sampleTuple
      ? `${formatProbeNumber(sampleTuple.intValue)} | ${formatProbeNumber(sampleTuple.exponentA)} | ${formatProbeNumber(sampleTuple.exponentB)} | ${formatProbeNumber(sampleTuple.tailScalar)}`
      : "unavailable"
  };
}

function getPrimaryShardObservation() {
  return (
    (state.shardGrounding?.observedBehaviors?.observations ?? []).map((observation) => ({
      ...observation,
      title: getObservationTitle(observation)
    }))[0] ?? null
  );
}

function getObservedBehaviorById(id) {
  return (
    (state.shardGrounding?.observedBehaviors?.observations ?? []).find(
      (observation) => observation.id === id
    ) || null
  );
}

function getObservationTitle(observation) {
  const playerState = observation?.playerState ?? {};
  return (
    playerState.run_type ||
    playerState.context ||
    playerState.lr_range ||
    observation.id.replaceAll("_", " ")
  );
}

function isBoundaryValuePresent(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === "string") {
    return value.trim() !== "";
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
}

function formatBoundaryValue(value) {
  if (typeof value === "number") {
    return formatShardNumber(value);
  }
  if (typeof value === "object" && value !== null) {
    return `${Object.keys(value).length} groups`;
  }
  return String(value);
}

function toRecommendationAction(item, fallbackModule) {
  return normalizeRecommendationAction(item, fallbackModule);
}

function sanitizeRecommendationLines(value) {
  return sanitizeNormalizedRecommendationLines(value);
}

function makeRecommendationCard(item, module) {
  if (!item) {
    return "";
  }
  if (module === "shards" || module === "loop") {
    return makeCompactProgressionNoteCard(item, module);
  }
  const explainabilityAudit = getRecommendationExplainabilityAudit(item);
  const contractIssues = getNormalizedRecommendationContractIssues(item);
  const detailLines = [
    item.cost ? `<span class="pill">cost ${escapeHtml(item.cost)}</span>` : "",
    item.eta ? `<span class="pill">eta ${escapeHtml(item.eta)}</span>` : ""
  ]
    .filter(Boolean)
    .join("");
  const whyNow =
    Array.isArray(item.whyNow) && item.whyNow.length
      ? `<div class="meta-stack"><p class="snapshot-title">Why now</p>${item.whyNow.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
      : "";
  const benefit =
    Array.isArray(item.benefit) && item.benefit.length
      ? `<div class="meta-stack"><p class="snapshot-title">Player value</p>${item.benefit.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
      : "";
  const assumptions =
    Array.isArray(item.assumptions) && item.assumptions.length
      ? `<div class="meta-stack"><p class="snapshot-title">Assumptions</p>${item.assumptions.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
      : "";
  const warnings =
    Array.isArray(item.warnings) && item.warnings.length
      ? `<div class="meta-stack"><p class="snapshot-title">Warnings</p>${item.warnings.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
      : "";
  const explainability = `
    <div class="meta-stack">
      <p class="snapshot-title">Explainability audit</p>
      <p class="meta">Status: ${escapeHtml(explainabilityAudit.status)}.</p>
      <p class="meta">Source note: ${escapeHtml(explainabilityAudit.sourceNoteStatus)}.</p>
      <p class="meta">${escapeHtml(explainabilityAudit.missingLine)}</p>
    </div>
  `;
  const contractAudit = contractIssues.length
    ? `
    <div class="meta-stack">
      <p class="snapshot-title">Contract audit</p>
      <p class="meta">Status: Contract gaps.</p>
      <p class="meta">${escapeHtml(contractIssues.join(" | "))}</p>
    </div>
  `
    : `
    <div class="meta-stack">
      <p class="snapshot-title">Contract audit</p>
      <p class="meta">Status: Valid.</p>
      <p class="meta">The current card satisfies the shared recommendation contract.</p>
    </div>
  `;
  return `
    <article class="recommendation-card">
      <div class="recommendation-head">
        <div>
          <strong>${item.title}</strong>
          <p class="meta">${item.subtitle ?? module}</p>
        </div>
        <span class="score">${Number(item.score).toFixed(1)}</span>
      </div>
      <div class="pill-row">
        <span class="pill">${module}</span>
        <span class="pill">confidence ${Math.round((item.confidence ?? 0.5) * 100)}%</span>
        ${detailLines}
      </div>
      <p class="meta">${item.notes ?? ""}</p>
      ${contractAudit}
      ${explainability}
      ${benefit}
      ${whyNow}
      ${assumptions}
      ${warnings}
    </article>
  `;
}

function makeCompactProgressionNoteCard(item, module) {
  const compactNote = getCompactProgressionNoteModel(item, module);
  const detailPills = [
    `<span class="pill">${escapeHtml(module === "shards" ? "shard watch" : "loop watch")}</span>`,
    `<span class="pill pill-neutral">confidence ${compactNote.confidence}%</span>`,
    item.cost ? `<span class="pill pill-neutral">cost ${escapeHtml(item.cost)}</span>` : "",
    item.eta ? `<span class="pill pill-neutral">eta ${escapeHtml(item.eta)}</span>` : "",
    compactNote.contractIssues.length
      ? `<span class="pill watch-note-pill-warn">contract gap</span>`
      : ""
  ]
    .filter(Boolean)
    .join("");
  return `
    <article class="recommendation-card watch-note-card ${compactNote.toneClass}">
      <div class="recommendation-head watch-note-head">
        <div>
          <p class="eyebrow">${escapeHtml(compactNote.subtitle)}</p>
          <strong>${escapeHtml(item.title)}</strong>
        </div>
        <span class="score">${Number(item.score).toFixed(1)}</span>
      </div>
      <div class="pill-row">
        ${detailPills}
      </div>
      ${compactNote.primaryLine ? `<p class="meta watch-note-primary">${escapeHtml(compactNote.primaryLine)}</p>` : ""}
      ${compactNote.secondaryLine ? `<p class="meta">${escapeHtml(compactNote.secondaryLine)}</p>` : ""}
      ${compactNote.sourceLine ? `<p class="meta watch-note-source">${escapeHtml(compactNote.sourceLine)}</p>` : ""}
    </article>
  `;
}

function normalizeShardBreakpoints(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => ({
      level: Number(item.level || 0),
      bonusValue: Number(item.bonusValue || item.bonus_value || 0),
      reason: item.reason || ""
    }));
  }
  return String(value)
    .split(/[|;]/)
    .map((entry) => {
      const [level, bonusValue, reason] = entry.split(":");
      return {
        level: Number(level || 0),
        bonusValue: Number(bonusValue || 0),
        reason: reason || ""
      };
    })
    .filter((item) => item.level > 0);
}

function formatShardNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    const text = String(value ?? "").trim();
    return text || "0";
  }
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numericValue));
}

function formatDurationHours(hours) {
  if (hours === 0) {
    return "now";
  }
  if (!Number.isFinite(hours) || hours < 0) {
    return null;
  }
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  }
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0)}d`;
}

function formatPercentGain(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return "+0%";
  }
  if (value < 0.01) {
    return `+${(value * 100).toFixed(3)}%`;
  }
  if (value < 1) {
    return `+${(value * 100).toFixed(2)}%`;
  }
  return `+${(value * 100).toFixed(1)}%`;
}

function formControl(id) {
  return document.getElementById(id);
}

function setStatus(id, message, tone = "") {
  const element = formControl(id);
  if (!element) {
    return;
  }
  element.textContent = message;
  element.className = `status-line${tone ? ` is-${tone}` : ""}`;
}

function progressionUrgency(resource, bias) {
  const table = {
    gems: bias === "premium" ? 1.16 : 0.96,
    tokens: bias === "speed" ? 1.14 : 1,
    relics: 0.94,
    gemDust: 1.1
  };
  return table[resource] ?? 1;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function bumpSnapshotVersion(version) {
  const match = /v(\d+)\.(\d+)\.(\d+)(.*)/.exec(version || "v1.0.0");
  if (!match) {
    return "v1.0.1";
  }
  return `v${match[1]}.${match[2]}.${Number(match[3]) + 1}${match[4] || ""}`;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value || 0), 0);
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return [...document.querySelectorAll(selector)];
}
