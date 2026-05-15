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
  buildAppMetaSystemView,
  buildPlayerStateSystemView,
  buildShardSystemView,
  buildSpendSystemView
} from "./support/system-unit-projections.js";
import {
  loadSystemUnits,
  refreshSystemUnits,
  SYSTEM_UNIT_IDS
} from "./support/system-unit-provider.js";
import { hasTokenShopDbBundle } from "./support/token-shop-db-bundle.js";
import { MULTIVERSE_MARKET_SCOPE_IDS } from "./support/multiverse-market-scope-map.js";
import { SHARD_SCOPE_IDS } from "./support/shard-scope-map.js";
import { TOKEN_SHOP_SCOPE_IDS } from "./support/token-shop-scope-map.js";
import { buildTokenShopDbRowDetailResolver } from "./support/token-shop-db-row-detail.js";
import {
  getShardDbCoverageSummary,
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
  getMultiverseMarketBroadRowRemapSummary,
  getMultiverseMarketCanonicalImportSummary,
  getMultiverseMarketDbCoverageSummary,
  getMultiverseMarketMarketMemberBoundarySummary,
  getMultiverseMarketMetadataSummary,
  getMultiverseMarketOwnerFamilySummary,
  getMultiverseMarketPrefabRemapBoundarySummary,
  getMultiverseMarketRangeBoundarySummary,
  getMultiverseMarketRowTextCoverageSummary,
  getMultiverseMarketSaveBoundarySummary,
  getMultiverseMarketTypedOwnerSummary,
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
import { getFullUpgradeAnalysis } from "./support/token-shop-optimizer.js";
import { getTokenShopRowMeta, getTokenShopRowTitle } from "./support/token-shop-row-meta.js";
import { buildTokenShopProgressionModel } from "./token-shop-progression-model.js";
import { createTokenShopUiSupport } from "./token-shop-ui-support.js";

const STORAGE_KEYS = {
  playerProfile: "cifi-suite.player-profile",
  shipConfig: "cifi-suite.ship-config",
  snapshot: "cifi-suite.snapshot",
  snapshots: "cifi-suite.profile-snapshots",
  route: "cifi-suite.route",
  traceGapUi: "cifi-suite.trace-gap-ui"
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
  launcherMode: false,
  systemUnitApi: false,
  systemUnitRefreshApi: false,
  systemDbBundleApi: false,
  traceGapApi: false,
  serverControlApi: false,
  playerProfileApi: false
});

function hasDbCoverage(summary) {
  const coverageSource = String(summary?.coverageSource || "").trim();
  return (
    coverageSource === "db-subject-metadata" ||
    coverageSource.includes("boundary-model") ||
    coverageSource.includes("generic-mechanics")
  );
}

function hasTokenShopDbCoverage(summary) {
  return hasDbCoverage(summary);
}

function hasTokenShopDbSurface(tokenShop) {
  return hasTokenShopDbBundle(tokenShop);
}

const SERVER_SESSION_ENDPOINTS = {
  open: "/api/client/open",
  heartbeat: "/api/client/heartbeat",
  close: "/api/client/close",
  events: "/api/client/events"
};
const TRACE_GAP_EVENTS_ENDPOINT = "/api/trace-gap/events";
const tokenShopUi = createTokenShopUiSupport({
  formatValue: formatBoundaryValue
});
const shardEvidence = createShardEvidenceSupport({
  formatShardNumber,
  getShardCostModelBoundarySummary,
  getShardEffectTextHandlerBoundarySummary,
  getShardSaveBoundarySummary,
  getShardSystemView: () => getCurrentShardSystemView(),
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
  totalShardMilestoneLevels: ["planning", "shards", "totalMilestoneLevels"],
  ATU1Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU1Level"],
  ATU2Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU2Level"],
  ATU3Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU3Level"],
  ATU4Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU4Level"],
  ATU5Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU5Level"],
  ATU6Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU6Level"],
  ATU7Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU7Level"],
  ATU8Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU8Level"],
  ATU9Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU9Level"],
  ATU10Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU10Level"],
  ATU11Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU11Level"],
  ATU12Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU12Level"],
  ATU13Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU13Level"],
  ATU14Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU14Level"],
  ATU15Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU15Level"],
  ATU16Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU16Level"],
  ATU17Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU17Level"],
  ATU18Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU18Level"],
  ATU19Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU19Level"],
  ATU20Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU20Level"],
  ATU21Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU21Level"],
  ATU22Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU22Level"],
  ATU23Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU23Level"],
  ATU24Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU24Level"],
  ATU25Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU25Level"],
  ATU26Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU26Level"],
  ATU27Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU27Level"],
  ATU28Level: ["planning", "tokenShop", "checkedSubsetPlayerState", "ATU28Level"]
};

const TOKEN_SHOP_TIER_CONFIG = Object.freeze({
  t1: {
    rows: [
      "ATU1Level",
      "ATU2Level",
      "ATU3Level",
      "ATU4Level",
      "ATU5Level",
      "ATU6Level",
      "ATU7Level",
      "ATU8Level",
      "ATU9Level",
      "ATU10Level",
      "ATU11Level",
      "ATU12Level"
    ],
    label: "T1"
  },
  t2: {
    rows: [
      "ATU13Level",
      "ATU14Level",
      "ATU15Level",
      "ATU16Level",
      "ATU17Level",
      "ATU18Level",
      "ATU19Level"
    ],
    label: "T2"
  },
  t3: { rows: ["ATU20Level", "ATU21Level", "ATU22Level", "ATU23Level"], label: "T3" },
  t4: { rows: ["ATU24Level", "ATU25Level", "ATU26Level", "ATU27Level", "ATU28Level"], label: "T4" }
});

const TOKEN_SHOP_TIER_SEQUENCE = Object.freeze(["t1", "t2", "t3", "t4"]);

function getTokenShopTierForField(field) {
  for (const [tierKey, tierConfig] of Object.entries(TOKEN_SHOP_TIER_CONFIG)) {
    if (tierConfig.rows.includes(field)) {
      return tierKey;
    }
  }
  return "t1";
}

function getTokenShopRowLabel(row) {
  return tokenShopUi.getTokenShopRowDisplayTitle(row);
}

function calculateTokenShopTierUnlockStates(thresholds, levelMap = {}) {
  const levelForField = (field) => {
    const value = levelMap?.[field];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };

  const totalForTier = (tierKey) =>
    (TOKEN_SHOP_TIER_CONFIG[tierKey]?.rows || []).reduce(
      (sum, field) => sum + levelForField(field),
      0
    );

  const t1Total = totalForTier("t1");
  const t2Total = totalForTier("t2");
  const t3Total = totalForTier("t3");

  return {
    t1: true,
    t2: t1Total >= (thresholds.t2?.min_levels || 25),
    t3: t1Total + t2Total >= (thresholds.t3?.min_levels || 50),
    t4: t1Total + t2Total + t3Total >= (thresholds.t4?.min_levels || 100)
  };
}

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

const ROUTE_METADATA = {
  overview: {
    section: "Pilot tools",
    title: "Command Center",
    summary:
      "Start from shared state, review grounded next steps, and move into the right tool lane without drifting into research surfaces.",
    badge: "Core surface"
  },
  profile: {
    section: "Pilot tools",
    title: "Player Profile",
    summary:
      "Capture canonical account state, keep helpers labeled, and use the guided PlayerProfile import path when manual entry is not enough.",
    badge: "Canonical state"
  },
  progression: {
    section: "Pilot tools",
    title: "Progression Bay",
    summary:
      "Use shard, loop, and TokenShop player-facing tools together while keeping each real subsystem on its own surface.",
    badge: "Planner surface"
  },
  data: {
    section: "Pilot tools",
    title: "Import Hangar",
    summary:
      "Bring labeled data into the local snapshot, review normalized records, and keep OCR or other assisted flows visibly quarantined.",
    badge: "Import surface"
  },
  ship: {
    section: "Support tools",
    title: "Ship Workbench",
    summary:
      "The ship system stays canonical, but planner calibration remains isolated from shared PlayerProfile truth.",
    badge: "Planner support"
  },
  validation: {
    section: "Support tools",
    title: "Grounding Console",
    summary:
      "Run product, APK, and support checks with enough separation that verification does not overstate current product truth.",
    badge: "Verification"
  },
  research: {
    section: "Reference and exploration",
    title: "Research Archive",
    summary:
      "Review grounded findings, open blockers, and future lanes before anything graduates into a product surface.",
    badge: "Reference lane"
  },
  traceGap: {
    section: "Reference and exploration",
    title: "Trace Gap Deck",
    summary:
      "Launch DB-backed best-gap preflights and execution runs with visible diagnostics instead of a blind shell window.",
    badge: "Dev trace"
  },
  gem: {
    section: "Reference and exploration",
    title: "Gem Node Lab",
    summary: "This planner remains experimental and quarantined away from the grounded MVP path.",
    badge: "Experimental"
  }
};

const SYSTEM_UNIT_STATE_KEYS = Object.freeze({
  "app-meta": "appMeta",
  "player-state": "playerState",
  shards: "shards",
  "token-shop": "tokenShop",
  "multiverse-market": "multiverseMarket"
});

const ROUTE_SYSTEM_REFRESH_CONTEXT = Object.freeze({
  profile: {
    systemIds: ["player-state"]
  }
});

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
  systemUnits: null,
  systemUnitSource: null,
  systemUnitBuiltAtById: {},
  systemDbBuiltAtById: {},
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
  systemDb: null,
  traceGapRun: null,
  traceGapOverview: null,
  traceGapPollId: null,
  traceGapEvents: null,
  traceGapRepeat: 1,
  traceGapOverviewScope: "",
  traceGapOverviewFetchedAt: 0,
  traceGapUi: {
    diagnosticsOpen: false,
    commandOpen: false
  },
  sourceRegistry: [],
  researchView: "active",
  progressionView: "shards",
  shardMilestoneCardOpenIds: [],
  route: "overview",
  tokenShopStorefrontTier: "t1",
  serverRestartBusy: false
};

let profileAutoSaveTimer = null;
let shipCalibrationAutoSaveTimer = null;
let playerProfileServerSyncTimer = null;
let pendingPlayerProfileServerSyncPayload = null;

bootstrap().catch((error) => console.error(error));

async function bootstrap() {
  state.launchCoordinator = initLaunchCoordinator();
  if (state.launchCoordinator.passiveLaunch) {
    renderPassiveLaunchScreen();
    return;
  }

  const [shipBaseline, loadedSystemUnits] = await Promise.all([
    fetchJson("./data/ship-optimizer.desmos-baseline.v1.json"),
    loadSystemUnits({
      fetchJson,
      origin: window.location.origin,
      serverCapabilities: SERVER_CAPABILITIES,
      allowStaticFallback: false,
      systemDbScopes: {
        shards: SHARD_SCOPE_IDS,
        tokenShop: TOKEN_SHOP_SCOPE_IDS,
        multiverseMarket: MULTIVERSE_MARKET_SCOPE_IDS
      }
    })
  ]);
  const {
    units: {
      appMeta: appMetaSystemUnit,
      playerState: playerStateSystemUnit,
      shards: shardsSystemUnit,
      tokenShop: tokenShopSystemUnit,
      multiverseMarket: multiverseMarketSystemUnit
    },
    mode: systemUnitSource,
    systemDb,
    builtAt,
    systemDbBuiltAt
  } = loadedSystemUnits;
  const appMetaView = buildAppMetaSystemView(appMetaSystemUnit);

  const baselineShipPlayerState = createDefaultShipPlayerState(shipBaseline);
  const playerStateView = buildPlayerStateSystemView(playerStateSystemUnit, mergeDeep);
  const playerProfileDefaults = playerStateView.defaults;
  const legacyShipConfig = loadStoredJson(STORAGE_KEYS.shipConfig, null);
  const dbBackedPlayerProfile = await loadServerPlayerProfile();
  const storedPlayerProfile = loadStoredJson(STORAGE_KEYS.playerProfile, null);
  const legacyProfile = loadStoredJson(LEGACY_STORAGE_KEYS.profile, null);

  state.snapshot = mergeDeep(
    appMetaView.snapshot,
    loadStoredJson(STORAGE_KEYS.snapshot, appMetaView.snapshot)
  );
  state.datasetContract = appMetaView.datasetContract;
  state.shipBaseline = shipBaseline;
  state.shipTemplates = buildShipTemplates(shipBaseline);
  state.systemUnits = {
    appMeta: appMetaSystemUnit,
    playerState: playerStateSystemUnit,
    shards: shardsSystemUnit,
    tokenShop: tokenShopSystemUnit,
    multiverseMarket: multiverseMarketSystemUnit
  };
  state.systemDb = systemDb ?? null;
  state.systemUnitSource = systemUnitSource;
  state.systemUnitBuiltAtById = buildSystemUnitBuiltAtMap(SYSTEM_UNIT_IDS, builtAt);
  state.systemDbBuiltAtById = systemDbBuiltAt ?? {};
  state.playerProfile = normalizePlayerProfile(
    dbBackedPlayerProfile ?? storedPlayerProfile ?? legacyProfile ?? playerProfileDefaults,
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
  state.route = getStoredRoute();
  state.traceGapUi = {
    ...state.traceGapUi,
    ...loadStoredJson(STORAGE_KEYS.traceGapUi, state.traceGapUi)
  };
  await probeTraceGapApiAvailability();

  bindNavigation();
  bindProfileActions();
  bindDataActions();
  bindOptimizerActions();
  bindTraceGapActions();

  fillProfileForm();
  renderAll();
  initServerSession();
  startTraceGapPolling();

  if (state.pendingLaunchRefresh) {
    await refreshFromPersistentState();
  }
}

async function probeTraceGapApiAvailability() {
  if (SERVER_CAPABILITIES.traceGapApi || !window.location.origin.startsWith("http")) {
    return;
  }
  try {
    const response = await fetch("/api/trace-gap/status", { cache: "no-store" });
    if (response.ok) {
      SERVER_CAPABILITIES.traceGapApi = true;
    }
  } catch {}
}

function fetchJson(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }
    return response.json();
  });
}

function hasPlayerProfileServerCapability() {
  return window.location.origin.startsWith("http") && SERVER_CAPABILITIES.playerProfileApi === true;
}

async function loadServerPlayerProfile() {
  if (!hasPlayerProfileServerCapability()) {
    return null;
  }
  try {
    const response = await fetch("/api/player-profile", { cache: "no-store" });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to load /api/player-profile (${response.status})`);
    }
    const payload = await response.json();
    return payload?.profile && typeof payload.profile === "object" ? payload.profile : null;
  } catch {
    return null;
  }
}

function getCurrentPlayerStateView() {
  return buildPlayerStateSystemView(state.systemUnits?.playerState, mergeDeep);
}

function buildSystemUnitBuiltAtMap(systemIds, builtAt) {
  const builtAtMap = {};
  for (const systemId of systemIds || []) {
    if (systemId) {
      builtAtMap[systemId] = builtAt ?? null;
    }
  }
  return builtAtMap;
}

function getSystemUnitStateKey(systemId) {
  return SYSTEM_UNIT_STATE_KEYS[systemId] ?? null;
}

function getSystemDbStateKey(systemId) {
  return SYSTEM_UNIT_STATE_KEYS[systemId] ?? null;
}

function getProgressionSystemRefreshContext() {
  const subsystem = getSelectedProgressionSubsystem();
  if (subsystem === "shards") {
    return {
      systemIds: ["shards"],
      systemDbScopes: { shards: SHARD_SCOPE_IDS }
    };
  }
  if (subsystem === "tokenShop") {
    return {
      systemIds: ["token-shop"],
      systemDbScopes: { tokenShop: TOKEN_SHOP_SCOPE_IDS }
    };
  }
  return null;
}

function getRouteSystemRefreshContext(route = state.route) {
  if (route === "progression") {
    return getProgressionSystemRefreshContext();
  }
  return ROUTE_SYSTEM_REFRESH_CONTEXT[route] ?? null;
}

function hasSystemRefreshCapability() {
  return window.location.origin.startsWith("http") && SERVER_CAPABILITIES.systemUnitApi === true;
}

function hasSystemUnitRematerializeCapability() {
  return (
    window.location.origin.startsWith("http") && SERVER_CAPABILITIES.systemUnitRefreshApi === true
  );
}

function getLatestLoadedBuiltAtForSystemIds(systemIds = []) {
  let latest = 0;
  for (const systemId of systemIds) {
    const builtAt = Date.parse(state.systemUnitBuiltAtById?.[systemId] || "");
    if (Number.isFinite(builtAt)) {
      latest = Math.max(latest, builtAt);
    }
  }
  return latest;
}

function getLatestLoadedDbBuiltAtForSystemIds(systemIds = []) {
  let latest = 0;
  for (const systemId of systemIds) {
    const dbKey = getSystemDbStateKey(systemId);
    const builtAt = Date.parse(state.systemDbBuiltAtById?.[dbKey] || "");
    if (Number.isFinite(builtAt)) {
      latest = Math.max(latest, builtAt);
    }
  }
  return latest;
}

function getSystemFreshnessSummary(systemId) {
  const stateKey = getSystemUnitStateKey(systemId);
  const unitBuiltAt = state.systemUnitBuiltAtById?.[systemId] || null;
  const dbBuiltAt = stateKey ? state.systemDbBuiltAtById?.[stateKey] || null : null;
  const dbBundle = stateKey ? state.systemDb?.[stateKey] : null;
  return {
    source: state.systemUnitSource || "unknown",
    unitBuiltAt,
    dbBuiltAt,
    dbBundleLoaded: Boolean(
      dbBundle?.subjectMetadata || dbBundle?.genericMechanics || dbBundle?.boundaries
    )
  };
}

function shouldApplyLoadedSystemUnits(loadedSystemUnits, systemIds = []) {
  if (!loadedSystemUnits || !Array.isArray(systemIds) || !systemIds.length) {
    return false;
  }
  const incomingBuiltAt = Date.parse(loadedSystemUnits.builtAt || "");
  const currentBuiltAt = getLatestLoadedBuiltAtForSystemIds(systemIds);
  if (Number.isFinite(incomingBuiltAt) && incomingBuiltAt > currentBuiltAt) {
    return true;
  }
  const incomingDbBuiltAts = systemIds
    .map((systemId) => {
      const dbKey = getSystemDbStateKey(systemId);
      return Date.parse(loadedSystemUnits.systemDbBuiltAt?.[dbKey] || "");
    })
    .filter(Number.isFinite);
  const incomingDbBuiltAt = incomingDbBuiltAts.length ? Math.max(...incomingDbBuiltAts) : NaN;
  const currentDbBuiltAt = getLatestLoadedDbBuiltAtForSystemIds(systemIds);
  if (Number.isFinite(incomingDbBuiltAt) && incomingDbBuiltAt > currentDbBuiltAt) {
    return true;
  }
  return systemIds.some((systemId) => {
    const stateKey = getSystemUnitStateKey(systemId);
    return stateKey && !state.systemUnits?.[stateKey];
  });
}

function applyLoadedSystemUnits(loadedSystemUnits, systemIds = []) {
  if (!loadedSystemUnits || !Array.isArray(systemIds) || !systemIds.length) {
    return;
  }
  const nextUnits = { ...(state.systemUnits || {}) };
  for (const systemId of systemIds) {
    const stateKey = getSystemUnitStateKey(systemId);
    if (!stateKey) {
      continue;
    }
    const incomingUnit = loadedSystemUnits.units?.[stateKey];
    if (incomingUnit) {
      nextUnits[stateKey] = incomingUnit;
    }
  }
  state.systemUnits = nextUnits;
  if (loadedSystemUnits.systemDb) {
    state.systemDb = {
      ...(state.systemDb || {}),
      ...Object.fromEntries(
        Object.entries(loadedSystemUnits.systemDb).filter(([, value]) => value != null)
      )
    };
  }
  if (loadedSystemUnits.mode) {
    state.systemUnitSource = loadedSystemUnits.mode;
  }
  const builtAtMap = buildSystemUnitBuiltAtMap(systemIds, loadedSystemUnits.builtAt ?? null);
  state.systemUnitBuiltAtById = {
    ...(state.systemUnitBuiltAtById || {}),
    ...builtAtMap
  };
  if (loadedSystemUnits.systemDbBuiltAt) {
    state.systemDbBuiltAtById = {
      ...(state.systemDbBuiltAtById || {}),
      ...loadedSystemUnits.systemDbBuiltAt
    };
  }
}

async function ensureFreshSystemViewOnAccess(route = state.route) {
  const refreshContext = getRouteSystemRefreshContext(route);
  if (!refreshContext?.systemIds?.length || !hasSystemRefreshCapability()) {
    return false;
  }
  if (hasSystemUnitRematerializeCapability()) {
    try {
      await refreshSystemUnits({
        origin: window.location.origin,
        serverCapabilities: SERVER_CAPABILITIES,
        systemIds: refreshContext.systemIds
      });
    } catch (error) {
      console.warn("System-unit rematerialization failed before route refresh.", error);
    }
  }
  const loadedSystemUnits = await loadSystemUnits({
    fetchJson,
    origin: window.location.origin,
    serverCapabilities: SERVER_CAPABILITIES,
    allowStaticFallback: false,
    systemIds: refreshContext.systemIds,
    systemDbScopes: refreshContext.systemDbScopes || {}
  });
  if (!shouldApplyLoadedSystemUnits(loadedSystemUnits, refreshContext.systemIds)) {
    return false;
  }
  applyLoadedSystemUnits(loadedSystemUnits, refreshContext.systemIds);
  renderAll();
  return true;
}

async function navigateToRoute(targetRoute) {
  if (!targetRoute) {
    return;
  }
  if (state.route !== targetRoute) {
    state.route = targetRoute;
    persistRoute();
    renderNavigation();
  }
  await ensureFreshSystemViewOnAccess(targetRoute);
}

function getCurrentPlayerProfileDefaults() {
  return getCurrentPlayerStateView().defaults;
}

function getCurrentSpendSystemView() {
  return buildSpendSystemView({
    tokenShopSystemUnit: state.systemUnits?.tokenShop,
    multiverseMarketSystemUnit: state.systemUnits?.multiverseMarket,
    systemDb: state.systemDb
  });
}

function getCurrentShardSystemView() {
  return buildShardSystemView(state.systemUnits?.shards, state.systemDb?.shards);
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

function initTokenShopTierTabs() {
  const helper = $("#tokenShopHelper");
  const grid = $("#tokenshopLevelsGrid");
  if (!helper || !grid) return;
  const tabButtons = [...helper.querySelectorAll("[data-token-shop-helper-tier]")];

  function getTierLabels() {
    const remapBoundary = getCurrentSpendSystemView()?.tokenShop?.rows?.boundaries?.remap;
    return Object.fromEntries(
      getTokenShopGroundedSubsetDefinitions(remapBoundary).map((row) => [
        row.field,
        getTokenShopRowLabel(row)
      ])
    );
  }

  function renderTier(tier) {
    const tierConfig = TOKEN_SHOP_TIER_CONFIG[tier];
    if (!tierConfig) return;
    const tierLabels = getTierLabels();
    const currentTokenShopLevels =
      state.playerProfile?.planning?.tokenShop?.checkedSubsetPlayerState || {};

    const tierUnlocks =
      getCurrentSpendSystemView()?.tokenShop?.rows?.policy?.tierUnlocks?.tierUnlocks;
    const thresholds = tierUnlocks?.tier_thresholds || {};
    const tierUnlockStates = calculateTierUnlockStates(thresholds);

    grid.innerHTML = tierConfig.rows
      .map((field) => {
        const label = tierLabels[field] || field;
        const tierForField = getTierForField(field);
        const isLocked = tierForField !== "t1" && !tierUnlockStates[tierForField];
        const currentValue = currentTokenShopLevels[field];
        const valueAttribute =
          typeof currentValue === "number" && Number.isFinite(currentValue)
            ? ` value="${escapeHtml(String(currentValue))}"`
            : "";
        return `
          <div class="field-group${isLocked ? " locked" : ""}">
            <label for="${field}">${label}${isLocked ? " (locked)" : ""}</label>
            <input
              id="${field}"
              name="${field}"
              type="text"
              inputmode="decimal"
              placeholder="0"
              ${valueAttribute}
              ${isLocked ? "disabled" : ""}
            />
          </div>
        `;
      })
      .join("");

    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tokenShopHelperTier === tier);
      const tabTier = btn.dataset.tokenShopHelperTier;
      btn.classList.toggle("disabled", tabTier !== "t1" && !tierUnlockStates[tabTier]);
    });
  }

  function calculateTierUnlockStates(thresholds) {
    const profile = state.playerProfile?.planning?.tokenShop?.checkedSubsetPlayerState || {};
    return calculateTokenShopTierUnlockStates(thresholds, profile);
  }

  function getTierForField(field) {
    return getTokenShopTierForField(field);
  }

  renderTier("t1");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      renderTier(btn.dataset.tokenShopHelperTier);
    });
  });
}

function initServerSession() {
  if (!window.location.origin.startsWith("http") || !SERVER_CAPABILITIES.sessionApi) {
    return;
  }

  return (async () => {
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
  })();
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

function getStoredRoute() {
  const candidate = loadStoredJson(STORAGE_KEYS.route, "overview");
  return ROUTE_METADATA[candidate] ? candidate : "overview";
}

function persistRoute() {
  saveStoredJson(STORAGE_KEYS.route, state.route);
}

function persistTraceGapUiState() {
  saveStoredJson(STORAGE_KEYS.traceGapUi, state.traceGapUi);
}

function getServerCapabilities() {
  const raw = window.__CIFI_SERVER_CAPABILITIES__;
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_SERVER_CAPABILITIES };
  }

  return {
    sessionApi: raw.sessionApi === true,
    launcherMode: raw.launcherMode === true,
    systemUnitApi: raw.systemUnitApi === true,
    systemUnitRefreshApi: raw.systemUnitRefreshApi === true,
    systemDbBundleApi: raw.systemDbBundleApi === true,
    traceGapApi: raw.traceGapApi === true,
    serverControlApi: raw.serverControlApi === true,
    playerProfileApi: raw.playerProfileApi === true
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

async function handlePrimaryReopen() {
  if (!state.snapshot || !state.shipBaseline) {
    state.pendingLaunchRefresh = true;
    return;
  }
  state.pendingLaunchRefresh = false;
  await refreshFromPersistentState();
  showLaunchNotice("CIFI reopened from launcher.");
}

async function refreshFromPersistentState() {
  const dbBackedPlayerProfile = await loadServerPlayerProfile();
  const storedPlayerProfile = loadStoredJson(STORAGE_KEYS.playerProfile, state.playerProfile);
  state.playerProfile = normalizePlayerProfile(
    dbBackedPlayerProfile ?? storedPlayerProfile,
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
  queuePlayerProfileServerSync();
}

function queuePlayerProfileServerSync() {
  if (!hasPlayerProfileServerCapability()) {
    return;
  }
  pendingPlayerProfileServerSyncPayload = structuredClone(state.playerProfile);
  window.clearTimeout(playerProfileServerSyncTimer);
  playerProfileServerSyncTimer = window.setTimeout(async () => {
    const profilePayload = pendingPlayerProfileServerSyncPayload;
    pendingPlayerProfileServerSyncPayload = null;
    if (!profilePayload) {
      return;
    }
    try {
      await fetch("/api/player-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLabel: "app-local-profile",
          profile: profilePayload
        })
      });
    } catch {}
  }, 180);
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
  $("#pageNav").addEventListener("click", async (event) => {
    const button = event.target.closest(".nav-link");
    if (!button) {
      return;
    }
    await navigateToRoute(button.dataset.page);
  });

  $(".workspace").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-route-target]");
    if (!button) {
      return;
    }
    const target = button.dataset.routeTarget;
    if (!target) {
      return;
    }
    await navigateToRoute(target);
  });
}

function bindProfileActions() {
  initTokenShopTierTabs();

  $("#profileForm").addEventListener("input", () => scheduleProfileAutoSave());
  $("#profileForm").addEventListener("change", () => scheduleProfileAutoSave(0));

  $("#restoreDefaultsBtn").addEventListener("click", () => {
    state.playerProfile = normalizePlayerProfile(
      getCurrentPlayerProfileDefaults() ?? createDefaultPlayerProfile(),
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
  $("#progressionSubsystemToggle").addEventListener("click", async (event) => {
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
    await ensureFreshSystemViewOnAccess("progression");
  });
  $("#progressionResults").addEventListener("click", (event) => {
    const tokenShopTierButton = event.target.closest("[data-token-shop-tier]");
    if (tokenShopTierButton) {
      const nextTier = tokenShopTierButton.dataset.tokenShopTier;
      if (TOKEN_SHOP_TIER_CONFIG[nextTier] && state.tokenShopStorefrontTier !== nextTier) {
        state.tokenShopStorefrontTier = nextTier;
        renderProgressionResults(runProgressionOptimization());
      }
      return;
    }
    const tokenShopApplyButton = event.target.closest("[data-token-shop-apply-row]");
    if (tokenShopApplyButton) {
      applyTokenShopRecommendedPurchase(tokenShopApplyButton.dataset.tokenShopApplyRow);
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
    const levelField = event.target.closest("[data-shard-focus-level]");
    if (!levelField) {
      return;
    }
    const milestoneId = levelField.dataset.shardFocusLevelFor || null;
    if (milestoneId) {
      saveShardPlannerInputs(milestoneId, coerceInputValue(levelField.value ?? ""));
    }
  });
  $("#progressionResults").addEventListener("keydown", (event) => {
    const tokenShopActionSurface = event.target.closest("[data-token-shop-apply-row]");
    if (!tokenShopActionSurface) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      tokenShopActionSurface.click();
    }
  });
  $("#runGemOptimizer").addEventListener("click", () => renderGemResults(runGemOptimization()));
  $("#runValidationSuite").addEventListener("click", renderValidationResults);
}

function bindTraceGapActions() {
  $("#traceGapRepeat")?.addEventListener("input", (event) => {
    state.traceGapRepeat = clampNumber(event.target.value || 1, 1, 50);
  });
  $("#traceGapDryRunBtn")?.addEventListener("click", () => runTraceGap("dry-run"));
  $("#traceGapRunBtn")?.addEventListener("click", () => {
    if (isTraceGapActive(state.traceGapRun)) {
      stopTraceGap();
      return;
    }
    runTraceGap("execute");
  });
  $("#traceGapRestartServerBtn")?.addEventListener("click", () => restartLocalServer());
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
  renderTraceGapPanel();
}

function renderNavigation() {
  $$(".nav-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.page === state.route);
  });

  $$(".page").forEach((page) => {
    page.classList.toggle("is-active", page.dataset.page === state.route);
  });

  renderWorkspaceHero();
}

function renderWorkspaceHero() {
  const metadata = ROUTE_METADATA[state.route] ?? ROUTE_METADATA.overview;
  $("#workspaceSectionTag").textContent = metadata.section;
  $("#workspaceTitle").textContent = metadata.title;
  $("#workspaceSummary").textContent = metadata.summary;
  $("#workspaceRouteBadge").textContent = metadata.badge;
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
      .slice(0, 5)
      .map((item) =>
        makeRecommendationCard(item, item.module === "loop" ? "warning" : item.module)
      ),
    renderOverviewSupportSummary(apkValidation, supportValidation)
  ].join("");
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

  $$("#shipPlayerStatePanel [data-ship-group][data-ship-field]").forEach((input) => {
    const eventName = input.type === "checkbox" ? "change" : "input";
    input.addEventListener(eventName, () =>
      scheduleShipCalibrationAutoSave(input.type === "checkbox" ? 0 : 250)
    );
    if (input.type !== "checkbox") {
      input.addEventListener("change", () => scheduleShipCalibrationAutoSave(0));
    }
  });
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

  if (!records.length) {
    $("#sourceRegistry").innerHTML = `
      <article class="validation-card warn">
        <strong>No source records yet</strong>
        <p class="meta">Imported datasets and bundled reference sources will appear here once this snapshot starts collecting them.</p>
      </article>
    `;
    return;
  }

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
          <span class="snapshot-title">Planner toggles</span>
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
    <button class="action-button" data-ship-action="undo">Undo</button>
    <button class="action-button action-danger" data-ship-action="clearShip">Reset selected ship</button>
    <button class="action-button action-danger" data-ship-action="clearLoadout">Clear active loadout</button>
  `;

  $$("#shipActionPanel [data-ship-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.shipAction;
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
      "These cards represent a real ship system, but the current implementation still uses planner calibration and some provisional labels.",
      "Treat the ship output as canonical-domain planning with implementation wiring still being remapped."
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
  const selectedLabels = {
    shards: "Shard Mining keeps milestone and owned-state guidance together.",
    loop: "Loop Prestige keeps warning-oriented pacing and anti-bricking notes separate from reset optimization.",
    tokenShop: ""
  };
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
  const subsystemLead =
    selectedSubsystem === "tokenShop"
      ? ""
      : `
    <article class="preview-card">
      <strong>${escapeHtml(
        selectedSubsystem === "loop" ? "Loop Prestige surface" : "Shard Mining surface"
      )}</strong>
      <p class="meta">${escapeHtml(selectedLabels[selectedSubsystem])}</p>
    </article>
  `;
  $("#progressionResults").innerHTML = `
    ${subsystemLead}
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
  $("#validationMvpResults").innerHTML = renderValidationCards(mvpResults);
  $("#validationApkResults").innerHTML = renderValidationCards(apkResults);
  $("#validationSupportResults").innerHTML = renderValidationCards(supportResults);
}

function startTraceGapPolling() {
  if (!SERVER_CAPABILITIES.traceGapApi) {
    return;
  }
  if (!state.traceGapEvents && window.location.origin.startsWith("http")) {
    const events = new EventSource(TRACE_GAP_EVENTS_ENDPOINT);
    events.addEventListener("ready", (event) => {
      const payload = parseServerEvent(event);
      if (!payload) {
        return;
      }
      state.traceGapRun = payload.run ?? state.traceGapRun;
      renderTraceGapPanel();
    });
    events.addEventListener("run", (event) => {
      const payload = parseServerEvent(event);
      if (!payload) {
        return;
      }
      state.traceGapRun = payload.run ?? state.traceGapRun;
      renderTraceGapPanel();
    });
    state.traceGapEvents = events;
  }
  if (state.traceGapPollId) {
    window.clearInterval(state.traceGapPollId);
  }
  fetchTraceGapStatus({ silent: true });
  fetchTraceGapOverview({ silent: true });
  state.traceGapPollId = window.setInterval(() => {
    const isRunning = isTraceGapActive(state.traceGapRun);
    if (isRunning || state.route === "traceGap") {
      fetchTraceGapStatus({ silent: true });
      const scope = state.traceGapRun?.executionScope || state.traceGapRun?.selectedTarget || "";
      const scopeChanged = scope !== (state.traceGapOverviewScope || "");
      const now = Date.now();
      const refreshIntervalMs = isRunning ? 10000 : 1500;
      const staleOverview = now - Number(state.traceGapOverviewFetchedAt || 0) >= refreshIntervalMs;
      if (scopeChanged || staleOverview || state.route === "traceGap") {
        fetchTraceGapOverview({ silent: true });
      }
    }
  }, 1500);
}

async function fetchTraceGapStatus({ silent = false } = {}) {
  if (!SERVER_CAPABILITIES.traceGapApi) {
    return null;
  }
  try {
    const response = await fetch("/api/trace-gap/status", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Trace-gap status request failed.");
    }
    state.traceGapRun = payload.run ?? null;
    renderTraceGapPanel();
    return state.traceGapRun;
  } catch (error) {
    if (!silent) {
      setStatus("traceGapStatus", `Trace-gap status failed: ${error.message}`, "warning");
    }
    return null;
  }
}

async function fetchTraceGapOverview({ silent = false } = {}) {
  if (!SERVER_CAPABILITIES.traceGapApi) {
    return null;
  }
  try {
    const scope = state.traceGapRun?.executionScope || state.traceGapRun?.selectedTarget || "";
    const url = scope
      ? `/api/trace-gap/overview?scope=${encodeURIComponent(scope)}`
      : "/api/trace-gap/overview";
    const response = await fetch(url, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Trace-gap overview request failed.");
    }
    state.traceGapOverview = payload;
    state.traceGapOverviewScope = scope;
    state.traceGapOverviewFetchedAt = Date.now();
    renderTraceGapPanel();
    return payload;
  } catch (error) {
    if (!silent) {
      setStatus("traceGapStatus", `Trace-gap DB overview failed: ${error.message}`, "warning");
    }
    return null;
  }
}

async function runTraceGap(mode = "execute") {
  if (!SERVER_CAPABILITIES.traceGapApi) {
    setStatus("traceGapStatus", "Trace-gap API is unavailable on this app launch.", "warning");
    return;
  }
  const repeat = clampNumber($("#traceGapRepeat")?.value || state.traceGapRepeat || 1, 1, 50);
  state.traceGapRepeat = repeat;
  setStatus(
    "traceGapStatus",
    mode === "dry-run"
      ? "Starting DB-backed best-gap preflight..."
      : "Starting DB-backed best-gap execution...",
    ""
  );
  renderTraceGapPanel();
  try {
    const response = await fetch("/api/trace-gap/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mode, repeat })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Trace-gap launch failed.");
    }
    state.traceGapRun = payload.run ?? null;
    setStatus(
      "traceGapStatus",
      mode === "dry-run"
        ? "Best-gap preflight is running. Open diagnostics for live output."
        : "Best-gap execution is running. Diagnostics update automatically.",
      "success"
    );
    renderTraceGapPanel();
    fetchTraceGapStatus({ silent: true });
    fetchTraceGapOverview({ silent: true });
  } catch (error) {
    setStatus("traceGapStatus", `Trace-gap launch failed: ${error.message}`, "warning");
  }
}

async function stopTraceGap() {
  if (!SERVER_CAPABILITIES.traceGapApi) {
    setStatus("traceGapStatus", "Trace-gap API is unavailable on this app launch.", "warning");
    return;
  }
  if (!isTraceGapActive(state.traceGapRun)) {
    return;
  }
  setStatus("traceGapStatus", "Stopping trace-gap execution...", "");
  renderTraceGapPanel();
  try {
    const response = await fetch("/api/trace-gap/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Trace-gap stop failed.");
    }
    state.traceGapRun = payload.run ?? state.traceGapRun;
    setStatus("traceGapStatus", "Trace-gap stop requested. Waiting for the process to exit.", "");
    renderTraceGapPanel();
    fetchTraceGapStatus({ silent: true });
  } catch (error) {
    setStatus("traceGapStatus", `Trace-gap stop failed: ${error.message}`, "warning");
    renderTraceGapPanel();
  }
}

function isTraceGapActive(run) {
  return run?.status === "running" || run?.status === "stopping";
}

async function restartLocalServer() {
  if (!SERVER_CAPABILITIES.serverControlApi) {
    setStatus(
      "traceGapStatus",
      "Server restart control is unavailable on this app launch. Restart the local dev server manually once, then this control will work on future runs.",
      "warning"
    );
    return;
  }
  if (state.serverRestartBusy) {
    return;
  }
  state.serverRestartBusy = true;
  persistRoute();
  setStatus("traceGapStatus", "Restarting local server and waiting for it to come back...", "");
  renderTraceGapPanel();
  try {
    const response = await fetch("/api/server/restart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Server restart request failed.");
    }
  } catch (error) {
    state.serverRestartBusy = false;
    setStatus("traceGapStatus", `Server restart failed: ${error.message}`, "warning");
    renderTraceGapPanel();
    return;
  }

  const startedAt = Date.now();
  const maxWaitMs = 20000;
  const pollDelayMs = 500;
  while (Date.now() - startedAt < maxWaitMs) {
    await new Promise((resolve) => window.setTimeout(resolve, pollDelayMs));
    try {
      const health = await fetch("/api/healthz", { cache: "no-store" });
      if (health.ok) {
        window.location.reload();
        return;
      }
    } catch {}
  }
  state.serverRestartBusy = false;
  setStatus(
    "traceGapStatus",
    "The server restart was requested, but the app did not reconnect within 20 seconds. Reload this tab manually.",
    "warning"
  );
  renderTraceGapPanel();
}

function renderTraceGapPanel() {
  const repeatInput = $("#traceGapRepeat");
  const dryRunBtn = $("#traceGapDryRunBtn");
  const runBtn = $("#traceGapRunBtn");
  const restartServerBtn = $("#traceGapRestartServerBtn");
  const pills = $("#traceGapPills");
  const summary = $("#traceGapSummary");
  const dbOverview = $("#traceGapDbOverview");
  const diagnostics = $("#traceGapDiagnostics");
  if (
    !repeatInput ||
    !dryRunBtn ||
    !runBtn ||
    !restartServerBtn ||
    !pills ||
    !summary ||
    !dbOverview ||
    !diagnostics
  ) {
    return;
  }

  repeatInput.value = String(clampNumber(state.traceGapRepeat || 1, 1, 50));

  if (!SERVER_CAPABILITIES.traceGapApi) {
    dryRunBtn.disabled = true;
    runBtn.disabled = true;
    restartServerBtn.disabled = state.serverRestartBusy;
    pills.innerHTML = `<span class="pill pill-neutral">trace-gap API unavailable</span>`;
    const launchHint = window.location.origin.startsWith("http")
      ? `Current origin: ${window.location.origin}. Refresh this tab if the local dev server was restarted after the page opened.`
      : "This page is not running from the local server. Open `launch-cifi.vbs` or browse to `http://localhost:4173`.";
    setContainerHtmlPreserveSelection(
      summary,
      `<article class="preview-card"><p class="meta">This app launch is not connected to the local trace-gap API.</p><p class="meta">${escapeHtml(launchHint)}</p></article>`
    );
    setContainerHtmlPreserveSelection(dbOverview, "");
    setContainerHtmlPreserveSelection(diagnostics, "");
    return;
  }

  const run = state.traceGapRun;
  const isRunning = run?.status === "running";
  const isStopping = run?.status === "stopping";
  const isActive = isTraceGapActive(run);
  repeatInput.disabled = isActive;
  dryRunBtn.disabled = isActive;
  runBtn.disabled = isStopping;
  runBtn.textContent = isActive ? (isStopping ? "Stopping trace" : "Stop trace") : "Run best gap";
  runBtn.classList.toggle("button-primary", !isActive);
  runBtn.classList.toggle("button-danger", isActive);
  restartServerBtn.disabled = state.serverRestartBusy || isActive;

  if (!run) {
    pills.innerHTML = `
      <span class="pill pill-neutral">idle</span>
      <span class="pill pill-neutral">repeat ${escapeHtml(String(state.traceGapRepeat || 1))}</span>
    `;
    setContainerHtmlPreserveSelection(
      summary,
      `
      <article class="preview-card">
        <strong>No trace-gap run started yet.</strong>
        <p class="meta">Use Plan best gap for a DB-backed dry run, or Run best gap for a structured execution pass.</p>
      </article>
    `
    );
    setContainerHtmlPreserveSelection(dbOverview, renderTraceGapDbOverview());
    setContainerHtmlPreserveSelection(diagnostics, "");
    return;
  }

  const statusTone =
    run.status === "failed" ? "warning" : run.status === "completed" ? "success" : "";
  setStatus(
    "traceGapStatus",
    run.activityLabel || (run.status === "running" ? "Trace-gap run active." : "Trace-gap ready."),
    statusTone
  );
  pills.innerHTML = [
    `<span class="pill ${run.status === "running" ? "" : "pill-neutral"}">${escapeHtml(run.status || "idle")}</span>`,
    `<span class="pill pill-neutral">${escapeHtml(run.mode || "execute")}</span>`,
    `<span class="pill pill-neutral">repeat ${escapeHtml(String(run.repeat || 1))}</span>`,
    run.selectedSeam
      ? `<span class="pill pill-neutral">${escapeHtml(run.selectedSeam)}</span>`
      : "",
    run.verdict ? `<span class="pill pill-neutral">${escapeHtml(run.verdict)}</span>` : ""
  ]
    .filter(Boolean)
    .join("");

  const lastOutputNote =
    run.status === "running" && !run.lastOutputAt
      ? "No line output yet. The DB-backed refresh may still be materializing subject views before the first planner summary prints."
      : run.lastOutputAt
        ? `Last output ${escapeHtml(formatUiDateTime(run.lastOutputAt))}.`
        : "No diagnostic output captured yet.";
  setContainerHtmlPreserveSelection(
    summary,
    `
    <article class="preview-card trace-gap-summary-card">
      <div class="recommendation-head">
        <div>
          <strong>${escapeHtml(run.selectedLabel || run.selectedTarget || "Current trace-gap run")}</strong>
          <p class="meta">${escapeHtml(run.activityLabel || "Trace-gap run state")}</p>
        </div>
        <span class="score">${escapeHtml(run.status || "idle")}</span>
      </div>
      <div class="pill-row">
        ${run.selectedTarget ? `<span class="pill pill-neutral">${escapeHtml(run.selectedTarget)}</span>` : ""}
        ${run.executionScope ? `<span class="pill pill-neutral">${escapeHtml(run.executionScope)}</span>` : ""}
        ${run.family ? `<span class="pill pill-neutral">${escapeHtml(run.family)}</span>` : ""}
      </div>
      <p class="meta">${escapeHtml(run.summary || "No planner summary captured yet.")}</p>
      <div class="validation-grid">
        ${makeTraceGapInfoCard("Selected seam", run.selectedSeam || "Pending planner seam")}
        ${makeTraceGapInfoCard("Subject", run.subjectLabel || run.subject || "Pending subject selection")}
        ${makeTraceGapInfoCard("Blocked edges", run.blockedEdges || "none")}
        ${makeTraceGapInfoCard("Unresolved anchor", run.unresolvedAnchor || "none")}
        ${makeTraceGapInfoCard("Recovered", run.recoveredSummary || "none")}
        ${makeTraceGapInfoCard("Traced", run.tracedSummary || "none")}
        ${makeTraceGapInfoCard("New edges", run.newEdgesSummary || "none")}
        ${makeTraceGapInfoCard("Net progress", run.progressSummary || "unknown")}
        ${makeTraceGapInfoCard("Started", formatUiDateTime(run.startedAt))}
        ${makeTraceGapInfoCard("Finished", formatUiDateTime(run.finishedAt))}
      </div>
      <p class="meta">${lastOutputNote}</p>
    </article>
  `
  );
  setContainerHtmlPreserveSelection(dbOverview, renderTraceGapDbOverview());

  const commandText = Array.isArray(run.command) ? run.command.join(" ") : "";
  renderTraceGapDiagnostics(diagnostics, run, commandText);
}

function renderTraceGapDiagnostics(container, run, commandText) {
  if (!container) {
    return;
  }
  const existingDiagnostics = container.querySelector(
    'details[data-trace-gap-section="diagnostics"]'
  );
  const existingCommand = container.querySelector('details[data-trace-gap-section="command"]');
  if (existingDiagnostics) {
    state.traceGapUi.diagnosticsOpen = existingDiagnostics.open;
  }
  if (existingCommand) {
    state.traceGapUi.commandOpen = existingCommand.open;
  }
  if (!existingDiagnostics || !existingCommand) {
    const logMarkup =
      Array.isArray(run.logEntries) && run.logEntries.length
        ? run.logEntries
            .map(
              (entry) =>
                `<div class="trace-gap-log-line ${entry.stream === "stderr" ? "is-stderr" : ""}"><span class="trace-gap-log-meta">${escapeHtml(String(entry.index))} ${escapeHtml(entry.stream)}</span><span>${escapeHtml(entry.text)}</span></div>`
            )
            .join("")
        : `<p class="meta">No diagnostic lines captured yet.</p>`;
    setContainerHtmlPreserveSelection(
      container,
      `
      <details class="field-collapse" data-trace-gap-section="diagnostics" ${state.traceGapUi.diagnosticsOpen ? "open" : ""}>
        <summary>Open live diagnostics</summary>
        <p class="meta">The output below is the live local process stream for this DB-backed best-gap run.</p>
        <div class="trace-gap-log">${logMarkup}</div>
      </details>
      <details class="field-collapse" data-trace-gap-section="command" ${state.traceGapUi.commandOpen ? "open" : ""}>
        <summary>Open command and run metadata</summary>
        <div class="preview-card">
          <p class="meta">Run id: <code>${escapeHtml(run.runId || "unknown")}</code></p>
          <p class="meta">Command:</p>
          <pre>${escapeHtml(commandText || "Unavailable")}</pre>
          <p class="meta">Captured lines: ${escapeHtml(String(run.lineCount || 0))}</p>
          <p class="meta">Best-gap reranks observed: ${escapeHtml(String(run.rerankCount || 0))}</p>
          <p class="meta">Current iteration: ${escapeHtml(String(run.currentIteration || 0))}</p>
          <p class="meta">Recovered (cumulative): ${escapeHtml(run.recoveredSummary || "none")}</p>
          <p class="meta">Traced (cumulative): ${escapeHtml(run.tracedSummary || "none")}</p>
          <p class="meta">New edges (cumulative): ${escapeHtml(run.newEdgesSummary || "none")}</p>
          <p class="meta">Net progress: ${escapeHtml(run.progressSummary || "unknown")}</p>
          <p class="meta">Exit code: ${escapeHtml(run.exitCode === null || run.exitCode === undefined ? "running" : String(run.exitCode))}</p>
        </div>
      </details>
    `
    );
    bindTraceGapDiagnosticsUi(container);
    return;
  }

  const logContainer = existingDiagnostics.querySelector(".trace-gap-log");
  if (logContainer) {
    const wasNearBottom =
      logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight < 24;
    const nextMarkup =
      Array.isArray(run.logEntries) && run.logEntries.length
        ? run.logEntries
            .map(
              (entry) =>
                `<div class="trace-gap-log-line ${entry.stream === "stderr" ? "is-stderr" : ""}"><span class="trace-gap-log-meta">${escapeHtml(String(entry.index))} ${escapeHtml(entry.stream)}</span><span>${escapeHtml(entry.text)}</span></div>`
            )
            .join("")
        : `<p class="meta">No diagnostic lines captured yet.</p>`;
    if (logContainer.innerHTML !== nextMarkup) {
      setContainerHtmlPreserveSelection(logContainer, nextMarkup);
      if (wasNearBottom) {
        logContainer.scrollTop = logContainer.scrollHeight;
      }
    }
  }

  const commandCard = existingCommand.querySelector(".preview-card");
  if (commandCard) {
    setContainerHtmlPreserveSelection(
      commandCard,
      `
      <p class="meta">Run id: <code>${escapeHtml(run.runId || "unknown")}</code></p>
      <p class="meta">Command:</p>
      <pre>${escapeHtml(commandText || "Unavailable")}</pre>
      <p class="meta">Captured lines: ${escapeHtml(String(run.lineCount || 0))}</p>
      <p class="meta">Best-gap reranks observed: ${escapeHtml(String(run.rerankCount || 0))}</p>
      <p class="meta">Current iteration: ${escapeHtml(String(run.currentIteration || 0))}</p>
      <p class="meta">Recovered (cumulative): ${escapeHtml(run.recoveredSummary || "none")}</p>
      <p class="meta">Traced (cumulative): ${escapeHtml(run.tracedSummary || "none")}</p>
      <p class="meta">New edges (cumulative): ${escapeHtml(run.newEdgesSummary || "none")}</p>
      <p class="meta">Net progress: ${escapeHtml(run.progressSummary || "unknown")}</p>
      <p class="meta">Exit code: ${escapeHtml(run.exitCode === null || run.exitCode === undefined ? "running" : String(run.exitCode))}</p>
    `
    );
  }
  bindTraceGapDiagnosticsUi(container);
}

function bindTraceGapDiagnosticsUi(container) {
  if (!container) {
    return;
  }
  container.querySelectorAll("details[data-trace-gap-section]").forEach((details) => {
    if (details.dataset.traceGapBound === "true") {
      return;
    }
    details.addEventListener("toggle", () => {
      const section = details.dataset.traceGapSection;
      if (section === "diagnostics") {
        state.traceGapUi.diagnosticsOpen = details.open;
      } else if (section === "command") {
        state.traceGapUi.commandOpen = details.open;
      } else {
        return;
      }
      persistTraceGapUiState();
    });
    details.dataset.traceGapBound = "true";
  });
}

function renderTraceGapDbOverview() {
  const overview = state.traceGapOverview;
  if (!overview?.tables) {
    return `<article class="validation-card"><strong>DB overview pending</strong><p class="meta">Refresh status or start a run to load materializer health.</p></article>`;
  }
  const scopeStageSummary = overview.scopeStageSummary;
  const summaryCard = scopeStageSummary
    ? `
        <article class="validation-card">
          <strong>${escapeHtml(`Scope materialization: ${scopeStageSummary.traceScope || "unknown"}`)}</strong>
          <p class="meta">Latest subject: ${escapeHtml(String(scopeStageSummary.latestSubjectId || "n/a"))}</p>
          <p class="meta">Latest write: ${escapeHtml(formatUiDateTime(scopeStageSummary.latestBuiltAt))}</p>
          <p class="meta">Stages: ${escapeHtml(
            Object.entries(scopeStageSummary.stages || {})
              .map(([stageKind, stageStatus]) => `${stageKind}=${stageStatus}`)
              .join(" | ") || "none"
          )}</p>
        </article>
      `
    : "";
  const tableCards = Object.values(overview.tables)
    .map((table) => {
      const scopeLabel =
        table.scopeHint && table.scopeCount !== null
          ? `Scope ${table.scopeHint}: ${table.scopeCount} row${table.scopeCount === 1 ? "" : "s"}`
          : "No active scope filter";
      const latestScope =
        table.latestTraceScope || table.latestSubjectId || table.latestRequestSignature || "n/a";
      return `
        <article class="validation-card">
          <strong>${escapeHtml(table.label || "Trace table")}</strong>
          <p class="meta">Total rows: ${escapeHtml(String(table.count ?? 0))}</p>
          <p class="meta">Latest write: ${escapeHtml(formatUiDateTime(table.latestBuiltAt))}</p>
          <p class="meta">Latest scope or key: ${escapeHtml(String(latestScope))}</p>
          <p class="meta">${escapeHtml(scopeLabel)}</p>
          <p class="meta">Scope latest write: ${escapeHtml(formatUiDateTime(table.scopeLatestBuiltAt))}</p>
        </article>
      `;
    })
    .join("");
  const stageCards = Object.values(overview.stages?.latestByStage || {})
    .map((stage) => {
      return `
        <article class="validation-card">
          <strong>${escapeHtml(`Stage: ${stage.stageKind || "unknown"}`)}</strong>
          <p class="meta">Status: ${escapeHtml(String(stage.stageStatus || "unknown"))}</p>
          <p class="meta">Scope: ${escapeHtml(String(stage.traceScope || "n/a"))}</p>
          <p class="meta">Subject: ${escapeHtml(String(stage.subjectId || "n/a"))}</p>
          <p class="meta">Latest write: ${escapeHtml(formatUiDateTime(stage.builtAt))}</p>
        </article>
      `;
    })
    .join("");
  const genericMechanics = overview.genericMechanics || {};
  const genericCounts = genericMechanics.counts || {};
  const genericGapStateCounts = genericMechanics.gapStateCounts || {};
  const genericGapKinds = Array.isArray(genericMechanics.gapKindCounts)
    ? genericMechanics.gapKindCounts
    : [];
  const genericGapRows = Array.isArray(genericMechanics.latestGapRows)
    ? genericMechanics.latestGapRows
    : [];
  const genericFactRows = Array.isArray(genericMechanics.latestFactRows)
    ? genericMechanics.latestFactRows
    : [];
  const genericCard =
    Object.keys(genericCounts).length || genericGapRows.length || genericFactRows.length
      ? `
          <article class="validation-card">
            <strong>Generic mechanics model</strong>
            <p class="meta">Entities: ${escapeHtml(String(genericCounts.entities ?? 0))} | Facts: ${escapeHtml(String(genericCounts.facts ?? 0))} | Relations: ${escapeHtml(String(genericCounts.relations ?? 0))} | Gaps: ${escapeHtml(String(genericGapStateCounts.open ?? genericCounts.gaps ?? 0))} active / ${escapeHtml(String(genericGapStateCounts.total ?? genericCounts.gaps ?? 0))} total</p>
            <p class="meta">Gap state: closed-only ${escapeHtml(String(genericGapStateCounts.closedOnly ?? 0))} | orphan ${escapeHtml(String(genericGapStateCounts.orphan ?? 0))}</p>
            <p class="meta">Gap kinds: ${escapeHtml(
              genericGapKinds.map((item) => `${item.gapKind}=${item.count}`).join(" | ") || "none"
            )}</p>
            <p class="meta">Latest gaps: ${escapeHtml(
              genericGapRows
                .slice(0, 5)
                .map((item) => `${item.fieldKey || item.entityId}:${item.gapKind}`)
                .join(" | ") || "none"
            )}</p>
            <p class="meta">Latest facts: ${escapeHtml(
              genericFactRows
                .slice(0, 5)
                .map(
                  (item) => `${item.fieldKey || item.entityId}:${item.factKind}=${item.factValue}`
                )
                .join(" | ") || "none"
            )}</p>
          </article>
        `
      : "";
  return `${summaryCard}${genericCard}${tableCards}${stageCards}`;
}

function makeTraceGapInfoCard(title, value) {
  return `
    <article class="validation-card">
      <strong>${escapeHtml(title)}</strong>
      <p class="meta">${escapeHtml(value || "n/a")}</p>
    </article>
  `;
}

function snapshotTextSelectionWithin(container) {
  if (!container || typeof window.getSelection !== "function") {
    return null;
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const commonAncestor =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  if (!commonAncestor || !container.contains(commonAncestor)) {
    return null;
  }
  const start = getTextOffsetWithinContainer(container, range.startContainer, range.startOffset);
  const end = getTextOffsetWithinContainer(container, range.endContainer, range.endOffset);
  if (start === null || end === null) {
    return null;
  }
  return { start, end };
}

function getTextOffsetWithinContainer(container, targetNode, targetOffset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (node === targetNode) {
      return offset + Math.min(targetOffset, length);
    }
    offset += length;
    node = walker.nextNode();
  }
  return null;
}

function resolveTextOffsetWithinContainer(container, targetOffset) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let traversed = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (targetOffset <= traversed + length) {
      return { node, offset: Math.max(0, targetOffset - traversed) };
    }
    traversed += length;
    node = walker.nextNode();
  }
  return null;
}

function restoreTextSelectionWithin(container, snapshot) {
  if (!container || !snapshot || typeof window.getSelection !== "function") {
    return;
  }
  const startPoint = resolveTextOffsetWithinContainer(container, snapshot.start);
  const endPoint = resolveTextOffsetWithinContainer(container, snapshot.end);
  if (!startPoint || !endPoint) {
    return;
  }
  const selection = window.getSelection();
  if (!selection) {
    return;
  }
  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  selection.removeAllRanges();
  selection.addRange(range);
}

function setContainerHtmlPreserveSelection(container, markup) {
  if (!container) {
    return;
  }
  const nextMarkup = String(markup ?? "");
  if (container.innerHTML === nextMarkup) {
    return;
  }
  const selectionSnapshot = snapshotTextSelectionWithin(container);
  container.innerHTML = nextMarkup;
  if (selectionSnapshot) {
    restoreTextSelectionWithin(container, selectionSnapshot);
  }
}

function formatUiDateTime(value) {
  if (!value) {
    return "n/a";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleString();
}

function renderSpendSaveSideBoundary() {
  const spendSystem = getCurrentSpendSystemView();
  const tokenShop = spendSystem?.tokenShop;
  const market = spendSystem?.multiverseMarket;
  const multiverseMarket = market?.saveOwner?.extract;
  const multiverseMarketMetadataNeighborhood = market?.rowIdentity?.metadataNeighborhood;
  const dailyTokeniumLaneClues = tokenShop?.dailyTokenium?.laneClues;
  const tokenBankFormulaBoundary = tokenShop?.tokenBank?.formulaBoundary;
  const multiverseMarketRangeBoundary = market?.rowIdentity?.rangeBoundary;
  const multiverseMarketRowTextCoverage = market?.rowIdentity?.rowTextCoverage;
  const multiverseMarketPrefabRemapBoundary = market?.rowIdentity?.prefabRemapBoundary;
  if (!multiverseMarket && !multiverseMarketMetadataNeighborhood) {
    return "";
  }

  const summary = getMultiverseMarketMetadataSummary(multiverseMarketMetadataNeighborhood, market);
  const typedOwnerSummary = getMultiverseMarketTypedOwnerSummary(market);
  const validatedCoverage = getMultiverseMarketValidatedCoverage(multiverseMarket);
  const dailyTokeniumSummary = getDailyTokeniumLaneSummary(tokenShop);
  const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(tokenShop);
  const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(
    multiverseMarketRangeBoundary,
    market
  );
  const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(
    multiverseMarketRowTextCoverage,
    market
  );
  const multiverseMarketPrefabRemapSummary = getMultiverseMarketPrefabRemapBoundarySummary(
    multiverseMarketPrefabRemapBoundary,
    market
  );
  const multiverseCanonicalImportSummary = getMultiverseMarketCanonicalImportSummary(market);
  const multiverseBroadRowRemapSummary = getMultiverseMarketBroadRowRemapSummary(market);
  const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(
    market?.uiShell?.ownerFamily,
    market
  );
  const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(market);
  const multiverseDbCoverage = getMultiverseMarketDbCoverageSummary(market);
  return `
    <section class="meta-stack">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Spend integration boundary</p>
          <h3>Spend save-side narrowing</h3>
        </div>
      </div>
      <p class="meta">Repo-local metadata now narrows MultiverseMarket saved-state work toward the broader PlayerProfileData persistence family instead of treating MultiverseMarket itself as the recovered save owner.</p>
      <p class="meta">${multiverseDbCoverage.hasCoverage ? `DB-backed multiverse coverage now tracks ${multiverseDbCoverage.subjectCount} subject${multiverseDbCoverage.subjectCount === 1 ? "" : "s"} via ${multiverseDbCoverage.coverageSource}, with next seams ${multiverseDbCoverage.nextSeamLabel || "unrecorded"}.` : "DB-backed multiverse coverage is not available in this build."}</p>
      <div class="validation-grid">
        <article class="validation-card ${summary.hasSaveFamilyClues ? "pass" : "warn"}">
          <strong>Likely persistence family</strong>
          <p class="meta">${summary.hasSaveFamilyClues ? "PlayerProfileData.cs, GetPlayerProfileData, and FillPlayerProfileData are all present in the checked-in metadata neighborhood." : "PlayerProfileData persistence clues are incomplete in the checked-in metadata neighborhood."}</p>
        </article>
        <article class="validation-card ${typedOwnerSummary.hasTypedOwnerAnchors ? "pass" : "warn"}">
          <strong>Typed owner lane</strong>
          <p class="meta">${typedOwnerSummary.hasTypedOwnerAnchors ? `The DB-backed typed-owner slice now preserves host anchors ${typedOwnerSummary.typedHostLabel || "n/a"}${typedOwnerSummary.recoveredIsRangeLabel ? ` across ${typedOwnerSummary.recoveredIsRangeLabel}` : ""}.` : "Typed owner host anchors are not yet present in the DB-backed multiverse slice."}</p>
          <p class="meta">${typedOwnerSummary.hasTypedConversionAnchors ? `Conversion anchors ${typedOwnerSummary.typedConversionLabel || "n/a"} and field samples such as ${typedOwnerSummary.typedFieldSampleLabel || "n/a"} are present, but ${typedOwnerSummary.negativeTypedOwnerLabel}.` : typedOwnerSummary.negativeTypedOwnerLabel}</p>
        </article>
        <article class="validation-card ${summary.hasCloudSavePathClues ? "pass" : "warn"}">
          <strong>Cloud-save profile path</strong>
          <p class="meta">${summary.hasCloudSavePathClues ? "CloudSavePlayerProfile and GetPlayerProfileInfo now appear in the same checked-in save-path neighborhood, which strengthens the PlayerProfile-based persistence search." : "Cloud-save profile path clues are incomplete in the checked-in metadata neighborhood."}</p>
        </article>
        <article class="validation-card ${marketMemberSummary.favorsPlayerProfileMemberHost ? "pass" : "warn"}">
          <strong>Likely canonical host</strong>
          <p class="meta">${marketMemberSummary.hasSiblingAccessorCluster ? `${marketMemberSummary.accessorLabel} now sits in the same PlayerProfile-side accessor run as ${marketMemberSummary.siblingAccessorLabel}.` : "The checked-in metadata neighborhood does not yet preserve the expected PlayerProfile-side sibling accessor run for Market."}</p>
          <p class="meta">${marketMemberSummary.favorsPlayerProfileMemberHost ? `That makes ${marketMemberSummary.canonicalHostLabel} the strongest current repo-local host for future canonical Emporium state, instead of direct MultiverseMarket ownership or loose top-level fields on PlayerProfileData.` : "The current build does not yet preserve a strong enough sibling-member pattern to narrow the future canonical host."}</p>
          <p class="meta">${hasDbCoverage(marketMemberSummary) && (marketMemberSummary.genericFactCount || marketMemberSummary.genericGapCount) ? `The DB-backed multiverse bundle currently preserves ${marketMemberSummary.genericFactCount || 0} generic fact row${marketMemberSummary.genericFactCount === 1 ? "" : "s"} and ${marketMemberSummary.genericGapCount || 0} generic gap row${marketMemberSummary.genericGapCount === 1 ? "" : "s"} for this save-owner slice.` : "Generic multiverse fact/gap coverage is not yet materialized for this save-owner slice."}</p>
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
          <p class="meta">${multiverseMarketPrefabRemapSummary.hasOverrideBoundary ? (multiverseMarketPrefabRemapSummary.overridePairs?.length ? `The DB-backed remap slice now preserves bounded override pairs ${multiverseMarketPrefabRemapSummary.overridePairs.join(", ")}, so validated ids ${multiverseMarketPrefabRemapSummary.validatedMismatchLabel} stay explicitly quarantined instead of implied from archived remap notes.` : `The same asset then switches to ${multiverseMarketPrefabRemapSummary.firstOverride} through ${multiverseMarketPrefabRemapSummary.lastOverride}, so validated ids ${multiverseMarketPrefabRemapSummary.validatedMismatchLabel} still do not have direct prefab-number label matches.`) : "The checked prefab-remap bundle no longer preserves the expected 69-74 override band."}</p>
        </article>
        <article class="validation-card ${multiverseCanonicalImportSummary.hasCanonicalImportBoundary ? "pass" : "warn"}">
          <strong>Canonical import admissibility</strong>
          <p class="meta">${multiverseCanonicalImportSummary.hasCanonicalImportBoundary ? `The DB-backed canonical-import slice keeps compatibility import quarantined at ${multiverseCanonicalImportSummary.compatibilityImportTargetPath || "n/a"} with safe subset ${multiverseCanonicalImportSummary.safeSubsetLabel}.` : "Canonical import admissibility is not yet surfaced on the DB-backed multiverse bundle."}</p>
          <p class="meta">${multiverseCanonicalImportSummary.overlapLabel ? `The remaining ordered overlap is still ${multiverseCanonicalImportSummary.overlapLabel}, and ${multiverseCanonicalImportSummary.negativeCanonicalImportLabel}.` : multiverseCanonicalImportSummary.negativeCanonicalImportLabel}</p>
          <p class="meta">${multiverseCanonicalImportSummary.candidateImportAnchorCount ? `The live DB now preserves ${multiverseCanonicalImportSummary.candidateImportAnchorCount} candidate import-anchor relation${multiverseCanonicalImportSummary.candidateImportAnchorCount === 1 ? "" : "s"}${multiverseCanonicalImportSummary.candidateImportAnchorLabel ? ` via ${multiverseCanonicalImportSummary.candidateImportAnchorLabel}` : ""}, ${multiverseCanonicalImportSummary.candidateCanonicalHostFieldCount || 0} candidate canonical host-field relation${multiverseCanonicalImportSummary.candidateCanonicalHostFieldCount === 1 ? "" : "s"}${multiverseCanonicalImportSummary.candidateCanonicalHostFieldLabel ? ` across ${multiverseCanonicalImportSummary.candidateCanonicalHostFieldLabel}` : ""}, ${multiverseCanonicalImportSummary.candidateImportLaneCount || 0} candidate import-lane relation${multiverseCanonicalImportSummary.candidateImportLaneCount === 1 ? "" : "s"}, and ${multiverseCanonicalImportSummary.candidateImportOverlapCount || 0} overlap-row relation${multiverseCanonicalImportSummary.candidateImportOverlapCount === 1 ? "" : "s"}. It also now carries ${multiverseCanonicalImportSummary.supportCanonicalHostFieldCount || 0} host-field support relation${multiverseCanonicalImportSummary.supportCanonicalHostFieldCount === 1 ? "" : "s"}, ${multiverseCanonicalImportSummary.supportCanonicalLaneCount || 0} lane-support relation${multiverseCanonicalImportSummary.supportCanonicalLaneCount === 1 ? "" : "s"}, ${multiverseCanonicalImportSummary.supportCanonicalOverlapCount || 0} overlap-row support relation${multiverseCanonicalImportSummary.supportCanonicalOverlapCount === 1 ? "" : "s"}, ${multiverseCanonicalImportSummary.boundedImportLaneCount || 0} exact bounded-lane relation${multiverseCanonicalImportSummary.boundedImportLaneCount === 1 ? "" : "s"}, and ${multiverseCanonicalImportSummary.boundedImportOverlapCount || 0} exact bounded-overlap relation${multiverseCanonicalImportSummary.boundedImportOverlapCount === 1 ? "" : "s"}, but no admissible canonical import bridge yet.` : "Candidate import-anchor relations are not yet materialized for this multiverse boundary."}</p>
        </article>
        <article class="validation-card ${multiverseBroadRowRemapSummary.hasBroadRowRemapBoundary ? "pass" : "warn"}">
          <strong>Broader row identity remap</strong>
          <p class="meta">${multiverseBroadRowRemapSummary.hasBroadRowRemapBoundary ? `${multiverseBroadRowRemapSummary.remapStatusLabel}` : "Broader row remap boundary is not yet surfaced on the DB-backed multiverse bundle."}</p>
          <p class="meta">${multiverseBroadRowRemapSummary.overlapLabel ? `Current checked overlap is ${multiverseBroadRowRemapSummary.overlapLabel}; buy hooks cover ${multiverseBroadRowRemapSummary.buyRangeLabel || "n/a"} and cost text covers ${multiverseBroadRowRemapSummary.costTextRangeLabel || "n/a"}, but ${multiverseBroadRowRemapSummary.negativeBroadRemapLabel}.` : multiverseBroadRowRemapSummary.negativeBroadRemapLabel}</p>
          <p class="meta">${multiverseBroadRowRemapSummary.candidateRowRemapCount ? `The live DB now preserves ${multiverseBroadRowRemapSummary.candidateRowRemapCount} candidate row-remap relation${multiverseBroadRowRemapSummary.candidateRowRemapCount === 1 ? "" : "s"} across rows ${multiverseBroadRowRemapSummary.candidateRowRemapLabel || "n/a"}, ${multiverseBroadRowRemapSummary.candidateOverrideIdRemapCount || 0} override-id remap relation${multiverseBroadRowRemapSummary.candidateOverrideIdRemapCount === 1 ? "" : "s"}${multiverseBroadRowRemapSummary.candidateOverrideIdRemapLabel ? ` via ${multiverseBroadRowRemapSummary.candidateOverrideIdRemapLabel}` : ""}, plus ${multiverseBroadRowRemapSummary.supportRowRemapCount || 0} row-side support relation${multiverseBroadRowRemapSummary.supportRowRemapCount === 1 ? "" : "s"}, ${multiverseBroadRowRemapSummary.supportRowTextLaneCount || 0} text-lane support relation${multiverseBroadRowRemapSummary.supportRowTextLaneCount === 1 ? "" : "s"}, ${multiverseBroadRowRemapSummary.supportBoundedRowRemapCount || 0} bounded override support relation${multiverseBroadRowRemapSummary.supportBoundedRowRemapCount === 1 ? "" : "s"}, ${multiverseBroadRowRemapSummary.boundedRowTextLaneCount || 0} exact bounded text-lane relation${multiverseBroadRowRemapSummary.boundedRowTextLaneCount === 1 ? "" : "s"}, and ${multiverseBroadRowRemapSummary.boundedRowRemapCount || 0} exact bounded remap relation${multiverseBroadRowRemapSummary.boundedRowRemapCount === 1 ? "" : "s"}.` : "Candidate row-remap relations are not yet materialized for this multiverse boundary."}</p>
        </article>
        <article class="validation-card ${multiverseMarketOwnerFamilySummary.hasOwnerFamily ? "pass" : "warn"}">
          <strong>MultiverseMarket owner family</strong>
          <p class="meta">${multiverseMarketOwnerFamilySummary.hasOwnerFamily ? `${multiverseMarketOwnerFamilySummary.ownerAnchor}, ${multiverseMarketOwnerFamilySummary.inscryptionsLabel}, ${multiverseMarketOwnerFamilySummary.textHandler}, and ${multiverseMarketOwnerFamilySummary.batcher} now appear in one checked owner-family shell.` : "MultiverseMarket owner-family clues are incomplete in the checked-in shell bundle."}</p>
          <p class="meta">${multiverseMarketOwnerFamilySummary.hasCurrencyShell ? `The same shell also preserves ${multiverseMarketOwnerFamilySummary.resourceText}, ${multiverseMarketOwnerFamilySummary.achievementBar}, ${multiverseMarketOwnerFamilySummary.costBox}, and ${multiverseMarketOwnerFamilySummary.currencyRangeLabel}.` : multiverseMarketOwnerFamilySummary.resourceText ? `The DB-backed owner-family slice already preserves ${multiverseMarketOwnerFamilySummary.resourceText}${multiverseMarketOwnerFamilySummary.inscryptionsLabel ? ` with wrapper field ${multiverseMarketOwnerFamilySummary.inscryptionsLabel}` : ""}, but the broader currency-shell range is still unrecovered.` : "The checked owner-family shell does not yet preserve the expected Inscryptions cost-lane UI anchors."}</p>
        </article>
        <article class="validation-card ${dailyTokeniumSummary.hasOwnerFamilyClues ? "pass" : "warn"}">
          <strong>Daily Tokenium owner family</strong>
          <p class="meta">${dailyTokeniumSummary.hasOwnerFamilyClues ? (hasTokenShopDbCoverage(dailyTokeniumSummary) ? `DB-backed TokenShop mechanics now preserve ${dailyTokeniumSummary.rangeFamilySubjectId || dailyTokeniumSummary.rowLocalSubjectId || "the Daily Tokenium lane"} with ${dailyTokeniumSummary.ownerFamilyLabel}, ${dailyTokeniumSummary.academyController}, ${dailyTokeniumSummary.textHandler}, and ${dailyTokeniumSummary.missionFamilyLabel}.` : "SpaceAcademy, SpaceAcademyMain, TextHandlerSpaceAcademy, and FarmMissions now appear in a checked-in lane clue bundle.") : "Daily Tokenium owner-family clues are incomplete in the checked-in lane clue bundle."}</p>
          <p class="meta">${dailyTokeniumSummary.hasModifierBoundary ? (hasTokenShopDbCoverage(dailyTokeniumSummary) ? `${dailyTokeniumSummary.loopHook}, ${dailyTokeniumSummary.purchaseHook}, ${dailyTokeniumSummary.finalBonusHook}, ${dailyTokeniumSummary.purchaseOwner}, and collector-pack copy are now grounded on the canonical Daily Tokenium lane contract rather than read from legacy clue bundles.` : "LM244 hooks, BuyLM244, FinalDailyTokenBonus, and Collector-pack copy still behave like modifier-family clues around the lane, not recovered saved-state owners.") : "Daily Tokenium modifier-family clues are incomplete in the checked-in lane clue bundle."}</p>
        </article>
        <article class="validation-card ${tokenBankFormulaSummary.hasDerivedOutputBoundary ? "pass" : "warn"}">
          <strong>Token-bank derived output boundary</strong>
          <p class="meta">${tokenBankFormulaSummary.hasDerivedOutputBoundary ? (hasTokenShopDbCoverage(tokenBankFormulaSummary) ? `${tokenBankFormulaSummary.rowLocalSubjectId || tokenBankFormulaSummary.rangeFamilySubjectId || "DB-backed TokenShop subject"} now preserves ${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField} on the DB-backed mechanics surface.` : "FinalTokenBankCap and FinalTokenBankFillSpeed now appear in a checked-in accessor and backing-field cluster.") : "Token-bank derived-output clues are incomplete in the checked-in boundary bundle."}</p>
          <p class="meta">${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? (hasTokenShopDbCoverage(tokenBankFormulaSummary) ? "The DB-backed derived-output lane still records no save-family overlap in the grounded context." : "The same checked local context still does not expose PlayerProfileData or CloudSavePlayerProfile beside those outputs.") : "The checked derived-output context now overlaps a broader save-family clue and needs review."}</p>
        </article>
        <article class="validation-card warn">
          <strong>Still blocked for planner wiring</strong>
        <p class="meta">Do not promote FinalIS or achievement symbols into canonical player state yet. Current evidence now identifies the declaring save model, but it still does not prove which recovered IS*Level subset should be promoted as planner-safe validated MultiverseMarket rows.</p>
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
  $("#researchGuidancePanel").innerHTML = renderResearchGuidance();
  $("#researchViewPanel").innerHTML = renderResearchViewSelector(orderedTracks);
  $("#researchResults").innerHTML = [
    ...visibleTracks.map((track) => {
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
        </div>
      </div>
      <p class="meta">${escapeHtml(track.goal)}</p>
      ${renderResearchTrackSummary(track)}
      <details class="field-collapse">
        <summary>${escapeHtml(track.status === "archived" ? "Open foundation detail" : "Open evidence and track detail")}</summary>
        ${renderResearchTrackProgress(track)}
        ${renderResearchTrackSupport(track)}
      </details>
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
  const spendTrack = state.snapshot?.researchTracks?.find(
    (track) => track.id === "spend-planner-first-ui-slice"
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
  const blockedInputs = [
    {
      label: "TokenShop row levels and recommendation math",
      reason:
        "This panel intentionally does not read checked TokenShop row levels, compatibility-backed ATU imports, or the Progression-side storefront lane. The checked subset tools stay separate, non-canonical, and blocked from planner behavior until broader row remap coverage and a truthful next-purchase rule set clear."
    },
    {
      label: "Token-bank state",
      reason:
        "Blocked for planner use. Banked amount, cap, fill, and claimable-bank state remain owner-dependent seams outside this canonical spend panel, so the app does not auto-apply imported token-bank values or unlock token-bank actions here."
    },
    {
      label: "Daily Tokenium lane state",
      reason:
        "Blocked for planner use. Stored amount, cap, and ready or claimable state stay outside the consumed contract until the Academy or Farm Mission owner lane is grounded strongly enough for planner-safe use."
    },
    {
      label: "Emporium owned progression and Inscryptions balance",
      reason:
        "Intentionally parked. The spend planner does not consume Emporium import previews, raw IS levels, or wrapper-only Inscryptions fields here; owned progression stays blocked until a separate import-safe contract is ready without leaking row-remap or save-owner archaeology into planner behavior."
    }
  ];
  const disabledActions = [
    {
      label: "Recommend next spend",
      note: "Disabled until blocked owner-dependent inputs graduate into planner-safe canonical behavior."
    },
    {
      label: "Use imported spend state",
      note: "Disabled here by design. This panel reads canonical state.playerProfile spend inputs only."
    },
    {
      label: "Rank TokenShop or Emporium buys",
      note: "Disabled while row levels, caps, claimable state, and owned progression remain blocked seams."
    }
  ];
  const nextSteps = Array.isArray(spendTrack?.nextSteps) ? spendTrack.nextSteps.slice(0, 3) : [];

  return `
    <div class="meta-stack">
      <p class="meta">Forked from the research-only spend-planner lane into a normal app surface. The active spend panel now stays tools first, import later: it reads canonical spend inputs already present in <code>state.playerProfile</code>, keeps blocked owner-dependent seams visible, and does not add recommendations, ranking, or optimizer math.</p>
      <p class="meta">Anything that still depends on TokenShop row ownership, token-bank or Daily Tokenium save owners, or Emporium import safety stays out of this panel instead of being inferred from compatibility blobs, extracted constants, or archaeology-only traces.</p>
    </div>
    <div class="meta-stack">
      <p class="snapshot-title">Canonical spend inputs available now</p>
      <p class="meta">These are the only spend-side values this panel consumes today.</p>
        <ul class="research-step-list">${canonicalInputs.map((input) => `<li>${escapeHtml(input.label)}: ${isBoundaryValuePresent(input.value) ? escapeHtml(formatBoundaryValue(input.value)) : "Not entered yet"} <code>${escapeHtml(input.path)}</code>. ${escapeHtml(input.note)}</li>`).join("")}</ul>
    </div>
    <div class="meta-stack">
      <p class="snapshot-title">Blocked owner-dependent spend seams</p>
      <p class="meta">The panel stays descriptive by surfacing blocked seams directly instead of partially consuming non-canonical state.</p>
      <ul class="research-step-list">${blockedInputs.map((input) => `<li>${escapeHtml(input.label)}: ${escapeHtml(input.reason)}</li>`).join("")}</ul>
    </div>
    <div class="meta-stack">
      <p class="snapshot-title">Disabled planner actions</p>
      <p class="meta">Recommendation-safe actions stay disabled until blocked fields clear on their own lanes.</p>
      <div class="preview-stack">
        ${disabledActions
          .map(
            (action) => `
          <article class="validation-card warn">
            <button class="button button-ghost" type="button" disabled>${escapeHtml(action.label)}</button>
            <p class="meta">${escapeHtml(action.note)}</p>
          </article>
        `
          )
          .join("")}
      </div>
    </div>
    <div class="meta-stack">
      <p class="snapshot-title">Why recommendations stay unavailable</p>
      <p class="meta">Unresolved owners still prevent planner-safe recommendations. This slice does not claim best-buy order, ROI, ETA, optimizer correctness, or route quality while the blocked spend inputs remain unrecovered.</p>
      <p class="meta">Confidence label: canonical PlayerProfile spend values only. Unresolved owner-dependent inputs stay explicitly unavailable instead of being inferred from compatibility imports, extracted constants, or UI text hooks.</p>
    </div>
    ${nextSteps.length ? `<div class="meta-stack"><p class="snapshot-title">Research lane remains separate</p><ul class="research-step-list">${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul></div>` : ""}
    <div class="pill-row">
        <span class="pill">${canonicalInputs.filter((input) => isBoundaryValuePresent(input.value)).length}/${canonicalInputs.length} canonical inputs entered</span>
        <span class="pill">${blockedInputs.length} blocked seams surfaced</span>
        <span class="pill">${disabledActions.length} planner actions disabled</span>
        <span class="pill">Canonical boundary preserved</span>
        <span class="pill">Tools first, import later</span>
        <span class="pill">Owner-dependent inputs blocked</span>
        <span class="pill">Uncertainty visible</span>
        <span class="pill">No spend recommendations yet</span>
    </div>
  `;
}

function renderSpendPlannerResearchForkNote() {
  return `
    <div class="meta-stack">
      <p class="snapshot-title">Forked user-surface slice</p>
      <p class="meta">The Overview page now keeps a canonical-only descriptive spend panel, while row-level TokenShop tools and compatibility imports stay on separate non-canonical surfaces.</p>
      <p class="meta">That keeps the product stance obvious: use grounded tools first, import later, and do not quietly turn blocked owner-dependent seams into planner behavior.</p>
      <p class="meta">Anything beyond that consumed-input contract should fork into a new slice rather than reopening the spend panel with optimizer behavior or parked import archaeology.</p>
    </div>
  `;
}

function renderTokenShopSubsystemSection() {
  return `
    <section class="meta-stack">
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

function renderResearchTrackSummary(track) {
  const contractModel = buildResearchTrackContractModel(track);
  const progressModel = buildResearchTrackProgressModel(track);
  const nextSteps = Array.isArray(track.nextSteps) ? track.nextSteps : [];

  return `
    <div class="meta-stack">
      <p class="snapshot-title">${track.status === "archived" ? "Foundation status" : "Focus now"}</p>
      <p class="meta">${escapeHtml(progressModel.currentSlice)}</p>
      ${contractModel.blockedBy ? `<p class="meta"><strong>Blocker:</strong> ${escapeHtml(contractModel.blockedBy)}</p>` : ""}
      ${contractModel.smallestShippableSlice ? `<p class="meta"><strong>Next slice:</strong> ${escapeHtml(contractModel.smallestShippableSlice)}</p>` : ""}
      ${
        nextSteps.length
          ? `<div class="meta-stack"><p class="snapshot-title">Remaining work</p><ul class="research-step-list">${nextSteps
              .slice(0, 3)
              .map((step) => `<li>${escapeHtml(step)}</li>`)
              .join("")}</ul></div>`
          : '<p class="meta">No active remaining work. This card stays here only as delivered foundation context for later roadmap slices.</p>'
      }
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
    const shardSystem = getCurrentShardSystemView();
    const shardDbCoverage = getShardDbCoverageSummary(shardSystem);
    const ownerBoundary = getShardOwnerFamilyBoundarySummary(shardSystem);
    const finalSuBoundary = getShardFinalSuBonusBoundarySummary(shardSystem);
    const payloadBoundary = getShardMilestonePayloadBoundarySummary(shardSystem);
    const costModelBoundary = getShardCostModelBoundarySummary(shardSystem);
    const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(shardSystem);
    const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(shardSystem);
    const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(shardSystem);
    const rowShellBoundary = getShardMilestoneRowShellBoundarySummary(shardSystem);
    const rowAlignmentBoundary = getShardMilestoneRowAlignmentBoundarySummary(shardSystem);
    const saveBoundary = getShardSaveBoundarySummary(shardSystem);
    const shardOwnerNotes = [
      shardDbCoverage.hasCoverage
        ? `DB-backed shard boundary coverage currently exposes ${shardDbCoverage.subjectLabels.join(", ")}, with next seams ${shardDbCoverage.nextSeamLabel || "unrecorded"}.`
        : "DB-backed shard boundary coverage is not available in this build.",
      ownerBoundary.hasBoundary
        ? hasDbCoverage(ownerBoundary)
          ? `DB-backed shard owner-family coverage now preserves ${ownerBoundary.subjectId || "family-graph:shards-owner-family"} through ${ownerBoundary.runtimeShell || ownerBoundary.dataCarrier}${ownerBoundary.boundaryVerdict ? ` under ${ownerBoundary.boundaryVerdict} verdict` : ""}.`
          : `Owner-family boundary keeps ${ownerBoundary.screenController} as the strongest screen-controller family and ${ownerBoundary.dataCarrier} as the strongest shard-specific carrier trail.`
        : "Shard owner-family boundary clues are not available in this build.",
      ownerBoundary.hasStructure
        ? `Live shard structure now keeps ${ownerBoundary.ownerField || "the owner field"} on ${ownerBoundary.rowModelType || ownerBoundary.dataCarrier}, with row-state fields ${ownerBoundary.rowStateFieldLabel || "still unrecorded"}.`
        : "Expected shard owner-family structure is incomplete in this build.",
      ownerBoundary.sourceTraceScope || ownerBoundary.sourceSubjectId
        ? `This owner-family view is currently derived from ${ownerBoundary.sourceTraceScope || "a live trace scope"}${ownerBoundary.sourceSubjectId ? ` via ${ownerBoundary.sourceSubjectId}` : ""}.`
        : "The current build does not yet expose the live source trace for shard owner-family.",
      ownerBoundary.hasSupportingEdges
        ? `Supporting edges such as ${ownerBoundary.supportingEdgeLabel} are grounded, while blocked seams remain ${ownerBoundary.blockedEdgeLabel || ownerBoundary.nextSeamId || "unrecorded"}.`
        : ownerBoundary.outcomeStatement ||
          "The shard owner-family blocker surface is incomplete in this build.",
      ownerBoundary.groundedConclusion
        ? ownerBoundary.groundedConclusion
        : ownerBoundary.outcomeStatement ||
          "The current build still lacks a grounded shard owner-family conclusion."
    ];
    const shardBoundaryNotes = [
      finalSuBoundary.hasBoundary
        ? `FinalSU boundary keeps ${finalSuBoundary.unlockRangeLabel}, ${finalSuBoundary.bonusFieldLabel}, and ${finalSuBoundary.bonusAccessorLabel} attached to ${finalSuBoundary.dataCarrier}.`
        : "Shard FinalSU bonus-field boundary clues are not available in this build.",
      payloadBoundary.hasBoundary
        ? `Payload-watch boundary keeps ${payloadBoundary.milestoneStateLabel} attached to ${payloadBoundary.dataCarrier}, with cost-list hooks such as ${payloadBoundary.costAccessorLabel}.`
        : "Shard milestone payload-watch boundary clues are not available in this build.",
      costModelBoundary.hasBoundary
        ? hasDbCoverage(costModelBoundary)
          ? `DB-backed shard cost subject ${costModelBoundary.subjectId || "shard-cost-su0-structure"} keeps ${costModelBoundary.costWindowLabel} on ${costModelBoundary.dataCarrier}, with next seam ${costModelBoundary.nextSeamId || "unrecorded"}.`
          : `Cost-model boundary keeps sampled shard cost windows ${costModelBoundary.costWindowLabel} attached to ${costModelBoundary.dataCarrier}.`
        : "Shard cost-model boundary clues are not available in this build.",
      rowModelBoundary.hasBoundary
        ? `Row-model boundary keeps text-checker rows on ${rowModelBoundary.textCheckerRangeLabel} and unlock rows on ${rowModelBoundary.unlockRangeLabel}.`
        : "Shard row-model boundary clues are not available in this build."
    ];
    const shardOpenIssues = [
      rowModelBoundary.hasShardLocalBuySample && rowModelBoundary.hasGenericBuyFamily
        ? `The buy seam still splits between shard-local ${rowModelBoundary.shardLocalBuyLabel} and generic ${rowModelBoundary.genericBuyLabel}.`
        : "Expected shard buy-seam clues are incomplete in this build.",
      titleEffectBoundary.hasBoundary
        ? `Shipped title assets cover shard rows ${titleEffectBoundary.titleRangeLabel}, but row 28 still has conflicting shipped title candidates: ${titleEffectBoundary.row28ConflictLabel || "unknown"}.`
        : "Shard title/effect boundary clues are not available in this build.",
      effectTextHandlerBoundary.hasBoundary
        ? `The strongest current shard bonus text handler is ${effectTextHandlerBoundary.textHandlerLabel}, not the generic ${effectTextHandlerBoundary.genericWriterLabel}.`
        : "Shard effect-text handler boundary clues are not available in this build.",
      saveBoundary.hasSeparationBoundary
        ? hasDbCoverage(saveBoundary)
          ? `DB-backed shard owned-state subject ${saveBoundary.subjectId || "shard-owned-state-upgradeinfolist-population"} keeps ${saveBoundary.ownerAnchor} separate from ${saveBoundary.saveAnchor}, but still stops at ${saveBoundary.nextSeamId || "an unrecorded seam"}.`
          : `Shard save boundary keeps ${saveBoundary.ownerAnchor} separate from ${saveBoundary.saveAnchor} and ${saveBoundary.cloudSaveAnchor}, with ${saveBoundary.overlapLabel}.`
        : "Shard save-boundary clues are not available in this build.",
      "This improves the shard mapping gate, but it still does not recover player-owned shard milestone rows, player-facing labels, or planner-safe affordability inputs."
    ];
    return `
      <div class="meta-stack">
        <p class="snapshot-title">Repo-local owner-family narrowing</p>
        <div class="meta-stack">
          <p class="snapshot-title">Owner-family trail</p>
          <ul class="research-step-list">${shardOwnerNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div class="meta-stack">
          <p class="snapshot-title">Recovered boundaries</p>
          <ul class="research-step-list">${shardBoundaryNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div class="meta-stack">
          <p class="snapshot-title">Still blocked</p>
          <ul class="research-step-list">${shardOpenIssues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </div>
    `;
  }

  if (track.id === "spend-multiverse-savedata-import-surface") {
    const spendSystem = getCurrentSpendSystemView();
    const tokenShop = spendSystem?.tokenShop;
    const market = spendSystem?.multiverseMarket;
    const tokenShopCoverage = getTokenShopCoverageSummary(tokenShop);
    const validatedCoverage = getMultiverseMarketValidatedCoverage(market?.saveOwner?.extract);
    const metadataSummary = getMultiverseMarketMetadataSummary(
      market?.rowIdentity?.metadataNeighborhood,
      market
    );
    const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(market);
    const tokeniumNamingSummary = getTokeniumNamingSummary(tokenShop);
    const tokenBankStateSummary = getTokenBankStateSummary(tokenShop);
    const dailyTokeniumSummary = getDailyTokeniumLaneSummary(tokenShop);
    const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(tokenShop);
    const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(
      market?.rowIdentity?.rangeBoundary,
      market
    );
    const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(
      market?.rowIdentity?.rowTextCoverage,
      market
    );
    const tokenShopCostLaneSummary = getTokenShopCostLaneSummary(tokenShop);
    const spendActionLaneSummary = getSpendActionLaneSummary(tokenShop);
    const multiverseMarketActionShellSummary = getMultiverseMarketActionShellSummary(
      market?.uiShell?.actionShell,
      market
    );
    const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(
      market?.uiShell?.ownerFamily,
      market
    );
    const multiverseDbCoverage = getMultiverseMarketDbCoverageSummary(market);
    const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(tokenShop);
    const tokenShopSaveBoundarySummary = getTokenShopSaveBoundarySummary(tokenShop);
    const multiverseMarketSaveBoundarySummary = getMultiverseMarketSaveBoundarySummary(market);
    const tokenBankControllerShellSummary = getTokenBankControllerShellSummary(tokenShop);
    const spendInputNotes = [
      tokenShopCoverage.hasCoverage
        ? hasTokenShopDbCoverage(tokenShopCoverage)
          ? `TokenShop currently exposes ${tokenShopCoverage.subjectCount} DB-backed subjects across ${tokenShopCoverage.tierLabel}, including ${tokenShopCoverage.namedLaneLabel}.`
          : `TokenShop currently exposes ${tokenShopCoverage.numericGroupCount} extracted numeric families across ${tokenShopCoverage.tierLabel}, including ${tokenShopCoverage.namedLaneLabel}.`
        : "TokenShop extracted family coverage is not available in this build.",
      tokenShopCostLaneSummary.hasLaneSplit
        ? hasTokenShopDbCoverage(tokenShopCostLaneSummary)
          ? `DB-backed TokenShop subjects now preserve ${tokenShopCostLaneSummary.rowLocalSubjectId} plus ${tokenShopCostLaneSummary.rangeFamilySubjectId}, with blocked input ${tokenShopCostLaneSummary.blockedInputReason || "explicitly recorded"}.`
          : `Cost-lane support preserves ${tokenShopCostLaneSummary.tokenLaneLabel}, ${tokenShopCostLaneSummary.diamondLaneLabel}, ${tokenShopCostLaneSummary.dailyLaneLabel}, ${tokenShopCostLaneSummary.costShellLabel}, and ${tokenShopCostLaneSummary.descriptionRenderLabel}.`
        : "TokenShop trace-produced cost-lane support is not available in this build.",
      spendActionLaneSummary.hasActionSplit
        ? hasTokenShopDbCoverage(spendActionLaneSummary)
          ? `Canonical TokenShop action coverage now preserves ${spendActionLaneSummary.rowLocalSubjectId} via ${spendActionLaneSummary.loopModifierHook}, while ${spendActionLaneSummary.rangeFamilySubjectId} keeps ${spendActionLaneSummary.dailyHookT2} recorded with blocked input ${spendActionLaneSummary.blockedInputReason || "explicitly de-scoped"}.`
          : `Action-lane clues preserve ${spendActionLaneSummary.tokenHook}, ${spendActionLaneSummary.diamondHook}, ${spendActionLaneSummary.loopModifierHook}, and ${spendActionLaneSummary.premiumModifierHook}.`
        : "Spend action-lane clues are not available in this build.",
      validatedCoverage.hasValidatedRows
        ? `MultiverseMarket currently has ${validatedCoverage.count} validated rows across ids ${validatedCoverage.rangeLabel}.`
        : "MultiverseMarket validated row coverage is not available in this build.",
      multiverseDbCoverage.hasCoverage
        ? `DB-backed multiverse coverage now tracks ${multiverseDbCoverage.subjectCount} subject${multiverseDbCoverage.subjectCount === 1 ? "" : "s"} via ${multiverseDbCoverage.coverageSource}, with next seams ${multiverseDbCoverage.nextSeamLabel || "unrecorded"}.`
        : "DB-backed multiverse coverage is not available in this build."
    ];
    const spendBoundaryNotes = [
      tokenShopOwnerShellSummary.hasOwnerShell
        ? hasTokenShopDbCoverage(tokenShopOwnerShellSummary)
          ? `DB-backed TokenShop subjects now preserve ${tokenShopOwnerShellSummary.rowLocalSubjectId} plus ${tokenShopOwnerShellSummary.rangeFamilySubjectId}, with row-local action hook ${tokenShopOwnerShellSummary.bankMethod}.`
          : `TokenShop owner-shell clues preserve ${tokenShopOwnerShellSummary.ownerAnchor}, ${tokenShopOwnerShellSummary.bankMethod}, ${tokenShopOwnerShellSummary.notificationHook}, and ${tokenShopOwnerShellSummary.deviceHook}.`
        : "TokenShop owner-shell clues are not available in this build.",
      tokenShopSaveBoundarySummary.hasSeparationBoundary
        ? hasTokenShopDbCoverage(tokenShopSaveBoundarySummary)
          ? `DB-backed TokenShop subject-state keeps ${tokenShopSaveBoundarySummary.rowLocalSubjectId} separate from ${tokenShopSaveBoundarySummary.rangeFamilySubjectId}, with blocked input ${tokenShopSaveBoundarySummary.blockedInputReason}.`
          : `TokenShop save boundary keeps ${tokenShopSaveBoundarySummary.ownerAnchor} separate from ${tokenShopSaveBoundarySummary.saveAnchor}, with ${tokenShopSaveBoundarySummary.overlapLabel}.`
        : "TokenShop save-boundary clues are not available in this build.",
      multiverseMarketOwnerFamilySummary.hasOwnerFamily
        ? `MultiverseMarket owner-family clues preserve ${multiverseMarketOwnerFamilySummary.ownerAnchor}, ${multiverseMarketOwnerFamilySummary.inscryptionsLabel}, ${multiverseMarketOwnerFamilySummary.textHandler}, and ${multiverseMarketOwnerFamilySummary.batcher}${multiverseMarketOwnerFamilySummary.costBox ? `, with ${multiverseMarketOwnerFamilySummary.costBox}` : ""}.`
        : "MultiverseMarket owner-family clues are not available in this build.",
      multiverseMarketSaveBoundarySummary.hasSeparationBoundary
        ? `MultiverseMarket save boundary keeps ${multiverseMarketSaveBoundarySummary.actionAnchor} separate from ${multiverseMarketSaveBoundarySummary.saveAnchor}, with ${multiverseMarketSaveBoundarySummary.overlapLabel}${multiverseMarketSaveBoundarySummary.typedSpanLabel ? ` across ${multiverseMarketSaveBoundarySummary.typedSpanLabel}` : ""}${multiverseMarketSaveBoundarySummary.boundaryVerdict ? ` under ${multiverseMarketSaveBoundarySummary.boundaryVerdict} verdict` : ""}${hasDbCoverage(multiverseMarketSaveBoundarySummary) && (multiverseMarketSaveBoundarySummary.genericFactCount || multiverseMarketSaveBoundarySummary.genericGapCount) ? `, plus ${multiverseMarketSaveBoundarySummary.genericFactCount || 0} generic fact row${multiverseMarketSaveBoundarySummary.genericFactCount === 1 ? "" : "s"} and ${multiverseMarketSaveBoundarySummary.genericGapCount || 0} generic gap row${multiverseMarketSaveBoundarySummary.genericGapCount === 1 ? "" : "s"}` : ""}.`
        : "MultiverseMarket save-boundary clues are not available in this build."
    ];
    const spendOpenIssues = [
      marketMemberSummary.hasExactSaveDataProgressionOwner
        ? `Save-side owner narrows to ${marketMemberSummary.exactSaveOwnerLabel}${marketMemberSummary.compatibilityImportTargetPath ? `, with compatibility import still quarantined at ${marketMemberSummary.compatibilityImportTargetPath}` : ""}, but planner-ready owned-state inputs and canonical row-level imports remain blocked.`
        : "Exact save-side owner recovery is still incomplete for the wider Emporium progression run.",
      multiverseMarketRangeSummary.hasOverlap
        ? `Validated rows ${multiverseMarketRangeSummary.validatedRangeLabel} only overlap the recovered metadata run ${multiverseMarketRangeSummary.metadataRangeLabel} at ${multiverseMarketRangeSummary.overlapLabel}.`
        : "The checked range boundary between validated rows and the recovered metadata run is not available in this build.",
      dailyTokeniumSummary.hasPlayerFacingBoundary
        ? "Daily Tokenium still behaves like a modifier-side reward lane, not a recovered TokenShop-only budget lane."
        : "Player-facing Daily Tokenium lane strings are incomplete in this build.",
      "This is enough to narrow future mapping work, but not enough to promote planner-ready owned-state inputs or canonical row-level imports yet."
    ];
    return `
      <div class="meta-stack">
        <p class="snapshot-title">Grounded spend inputs</p>
        <div class="meta-stack">
          <p class="snapshot-title">Current grounded inputs</p>
          <ul class="research-step-list">${spendInputNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div class="meta-stack">
          <p class="snapshot-title">Recovered boundaries</p>
          <ul class="research-step-list">${spendBoundaryNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div class="meta-stack">
          <p class="snapshot-title">Still blocked</p>
          <ul class="research-step-list">${spendOpenIssues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </div>
    `;
  }

  if (track.id === "spend-token-bank-state-owner") {
    const tokenShop = getCurrentSpendSystemView()?.tokenShop;
    const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(tokenShop);
    const tokenShopSaveBoundarySummary = getTokenShopSaveBoundarySummary(tokenShop);
    const tokenBankControllerShellSummary = getTokenBankControllerShellSummary(tokenShop);
    const tokenBankStateSummary = getTokenBankStateSummary(tokenShop);
    const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(tokenShop);
    const tokenBankOwnerNotes = [
      tokenShopOwnerShellSummary.hasOwnerShell
        ? hasTokenShopDbCoverage(tokenShopOwnerShellSummary)
          ? `DB-backed TokenShop subjects now preserve ${tokenShopOwnerShellSummary.rowLocalSubjectId} plus ${tokenShopOwnerShellSummary.rangeFamilySubjectId}, while the remaining blocked input stays ${tokenShopOwnerShellSummary.blockedInputReason || "explicitly recorded"}.`
          : `TokenShop owner-shell clues preserve ${tokenShopOwnerShellSummary.ownerAnchor}, ${tokenShopOwnerShellSummary.bankMethod}, ${tokenShopOwnerShellSummary.notificationHook}, and ${tokenShopOwnerShellSummary.deviceHook} as one local controller cluster.`
        : "TokenShop owner-shell clues are not available in this build.",
      tokenShopSaveBoundarySummary.hasSeparationBoundary
        ? hasTokenShopDbCoverage(tokenShopSaveBoundarySummary)
          ? `Canonical subject-state keeps ${tokenShopSaveBoundarySummary.rowLocalSubjectId} separate from ${tokenShopSaveBoundarySummary.rangeFamilySubjectId}, while blocked input stays ${tokenShopSaveBoundarySummary.blockedInputReason}.`
          : `The checked save boundary keeps ${tokenShopSaveBoundarySummary.ownerAnchor} separate from ${tokenShopSaveBoundarySummary.saveAnchor}, with ${tokenShopSaveBoundarySummary.overlapLabel}.`
        : "TokenShop save-boundary clues are not available in this build.",
      tokenBankControllerShellSummary.hasControllerShell
        ? hasTokenShopDbCoverage(tokenBankControllerShellSummary)
          ? `DB-backed TokenShop mechanics now preserve token-bank controller shell on ${tokenBankControllerShellSummary.rowLocalSubjectId}, with ${tokenBankControllerShellSummary.claimMethod}, ${tokenBankControllerShellSummary.fillMethod}, ${tokenBankControllerShellSummary.fillField}, ${tokenBankControllerShellSummary.descriptionShell}, and ${tokenBankControllerShellSummary.notificationHook}.`
          : `The token-bank controller shell preserves ${tokenBankControllerShellSummary.claimMethod}, ${tokenBankControllerShellSummary.fillMethod}, ${tokenBankControllerShellSummary.fillField}, ${tokenBankControllerShellSummary.descriptionShell}, and ${tokenBankControllerShellSummary.notificationHook}.`
        : "Token-bank controller-shell clues are not available in this build.",
      tokenBankStateSummary.hasControllerSplit
        ? hasTokenShopDbCoverage(tokenBankStateSummary)
          ? `DB-backed TokenShop mechanics now preserve token-bank state on ${tokenBankStateSummary.rowLocalSubjectId || tokenBankStateSummary.rangeFamilySubjectId || "the current TokenShop subject"}, with ${tokenBankStateSummary.claimMethod}, ${tokenBankStateSummary.capMethod}, ${tokenBankStateSummary.displayShell}, and ${tokenBankStateSummary.loopHook}.`
          : `Display clues such as ${tokenBankStateSummary.displayShell} and ${tokenBankStateSummary.loopHook} stay beside controller methods like ${tokenBankStateSummary.capMethod}.`
        : "Token-bank controller or display split clues are not available in this build.",
      tokenBankStateSummary.hasExactStoredAmountOwner
        ? hasTokenShopDbCoverage(tokenBankStateSummary)
          ? `DB-backed TokenShop state now keeps ${tokenBankStateSummary.exactSaveOwnerLabel} as the exact stored-amount owner for this lane without promoting cap or ready-state ownership.`
          : `Exact typed recovery keeps ${tokenBankStateSummary.exactSaveOwnerLabel} as the current stored-amount owner for this lane.`
        : "The exact stored-amount owner is not available in this build.",
      tokenBankStateSummary.hasPlayerProfileBridgeBoundary
        ? hasTokenShopDbCoverage(tokenBankStateSummary)
          ? `The checked save bridge still narrows through ${tokenBankStateSummary.profileBridgeLabel}, which keeps the search past the generic PlayerProfile export wrapper instead of treating it as a recovered bank-cap owner.`
          : `The checked PlayerProfile bridge still narrows through ${tokenBankStateSummary.profileBridgeLabel}.`
        : "The checked PlayerProfile save bridge is not available in this build."
    ];
    const tokenBankBlockedNotes = [
      tokenBankStateSummary.hasGenericClaimableBoundary
        ? hasTokenShopDbCoverage(tokenBankStateSummary)
          ? `${tokenBankStateSummary.genericClaimableLabel} is still only preserved as a broader generic Tokenium-cluster claimable field, not as token-bank claimable or ready-state ownership.`
          : `${tokenBankStateSummary.genericClaimableLabel} remains a broader generic Tokenium-cluster claimable clue, not a token-bank-specific owner.`
        : "No broader generic Tokenium-cluster claimable clue is preserved in this build.",
      tokenBankFormulaSummary.hasDerivedOutputBoundary
        ? hasTokenShopDbCoverage(tokenBankFormulaSummary)
          ? `${tokenBankFormulaSummary.rowLocalSubjectId || tokenBankFormulaSummary.rangeFamilySubjectId || "DB-backed TokenShop subject"} preserves ${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField} on the DB-backed mechanics surface.`
          : `Derived-output cluster preserves ${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField}.`
        : "Token-bank derived-output clues are not available in this build.",
      tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext
        ? hasTokenShopDbCoverage(tokenBankFormulaSummary)
          ? "The DB-backed derived-output lane still records no save-family overlap in the grounded context."
          : "FinalTokenBank outputs remain non-owner clues rather than recovered saved-state fields."
        : "The checked derived-output cluster now overlaps the broader save-family search and needs review.",
      tokenBankStateSummary.hasCloudSaveShellBoundary
        ? hasTokenShopDbCoverage(tokenBankStateSummary)
          ? `DB-backed TokenShop mechanics still keep the CloudSavePlayerProfile shell narrowed through ${tokenBankStateSummary.cloudSaveInfoRoutine}, ${tokenBankStateSummary.cloudSaveProfileRoutine}, and ${tokenBankStateSummary.cloudSaveStateMachine}.`
          : `Remaining CloudSavePlayerProfile evidence only preserves a metadata-side shell through ${tokenBankStateSummary.cloudSaveInfoRoutine}, ${tokenBankStateSummary.cloudSaveProfileRoutine}, and ${tokenBankStateSummary.cloudSaveStateMachine}.`
        : "The narrowed CloudSavePlayerProfile shell boundary is not available in this build.",
      "This is enough to narrow future recovery work, but not enough to identify the exact declaring save model or a narrower PlayerProfile-side wrapper path for token-bank state."
    ];
    return `
      <div class="meta-stack">
        <p class="snapshot-title">Current owner narrowing</p>
        <div class="meta-stack">
          <p class="snapshot-title">Recovered ownership trail</p>
          <ul class="research-step-list">${tokenBankOwnerNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
        <div class="meta-stack">
          <p class="snapshot-title">Still blocked</p>
          <ul class="research-step-list">${tokenBankBlockedNotes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </div>
    `;
  }

  return renderResearchTrackContract(track);
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

function scheduleProfileAutoSave(delay = 250) {
  clearTimeout(profileAutoSaveTimer);
  profileAutoSaveTimer = setTimeout(() => {
    state.playerProfile = collectProfileForm();
    persistPlayerProfile();
    renderQuickPanels();
    renderOverview();
    renderPlayerProfileBoundarySummary();
    setStatus("profileStatus", "Profile updates saved automatically.", "success");
  }, delay);
}

function scheduleShipCalibrationAutoSave(delay = 250) {
  clearTimeout(shipCalibrationAutoSaveTimer);
  shipCalibrationAutoSaveTimer = setTimeout(() => {
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
    setStatus("shipPlayerStateStatus", "Planner calibration saved automatically.", "success");
  }, delay);
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
  const market = getCurrentSpendSystemView()?.multiverseMarket;
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
    market?.saveOwner?.extract,
    market?.rowIdentity?.rangeBoundary,
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
  const shardDbCoverage = getShardDbCoverageSummary(getCurrentShardSystemView());
  const mechanicsBundle =
    getCurrentShardSystemView()?.family?.grounded?.milestones?.canonicalMechanics ?? {};
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
          <p class="meta">${shardDbCoverage.hasCoverage ? `DB-backed shard coverage now tracks ${escapeHtml(String(shardDbCoverage.subjectCount || 0))} subject${shardDbCoverage.subjectCount === 1 ? "" : "s"} via ${escapeHtml(shardDbCoverage.coverageSource || "db coverage")}, with next seams ${escapeHtml(shardDbCoverage.nextSeamLabel || "unrecorded")}.` : "DB-backed shard coverage has not been materialized yet in this build."}</p>
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
  const shardSystem = getCurrentShardSystemView();
  const shardDbCoverage = getShardDbCoverageSummary(shardSystem);
  const provenance = shardSystem?.family?.grounded?.provenance;
  const uncertaintyLog = provenance?.uncertaintyLog ?? [];
  const conflictCount = uncertaintyLog.filter((item) => item.status === "conflict_detected").length;
  const missingCount = uncertaintyLog.filter((item) => item.status !== "conflict_detected").length;
  const assetGrounding = shardSystem?.family?.grounded?.assetGrounding;
  const ownerBoundary = getShardOwnerFamilyBoundarySummary(shardSystem);
  const costModelBoundary = getShardCostModelBoundarySummary(shardSystem);
  const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(shardSystem);
  const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(shardSystem);
  const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(shardSystem);
  const saveBoundary = getShardSaveBoundarySummary(shardSystem);
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
          <p class="meta">${shardDbCoverage.hasCoverage ? `DB-backed shard boundary coverage now includes ${shardDbCoverage.subjectLabels.join(", ")}.` : "DB-backed shard boundary coverage has not been materialized yet in this build."}</p>
          <p class="meta">${shardDbCoverage.hasCoverage && (shardDbCoverage.genericFactCount || shardDbCoverage.genericGapCount) ? `Current generic shard mechanics preserve ${escapeHtml(String(shardDbCoverage.genericFactCount || 0))} fact row${shardDbCoverage.genericFactCount === 1 ? "" : "s"} and ${escapeHtml(String(shardDbCoverage.genericGapCount || 0))} gap row${shardDbCoverage.genericGapCount === 1 ? "" : "s"} for the active shard bundle.` : "Generic shard fact/gap rows are not yet available for this build."}</p>
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
          <p class="meta">Direct ${escapeHtml(saveBoundary.directPayloadAnchor || ownerBoundary.screenController || "shard")} payload now grounds the reachable shard row-definition family as product data: title-side evidence, unlock requirements, bonus-package shape, and row-local cost shell all belong in the tool.</p>
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
        <strong>${escapeHtml(ownerBoundary.screenController || "Shard owner-family")} owns the reachable definition family</strong>
        <div class="meta-stack">
          <p class="meta">${ownerBoundary.hasBoundary ? "Recovered ownership clues consistently point at a shard-specific family instead of the generic milestone shell." : "The current build still lacks enough shard-specific ownership evidence to map milestone rows safely."}</p>
          <p class="meta">${ownerBoundary.hasBoundary ? (hasDbCoverage(ownerBoundary) ? `DB-backed shard owner-family coverage now preserves ${escapeHtml(ownerBoundary.subjectId || "family-graph:shards-owner-family")} through ${escapeHtml(ownerBoundary.runtimeShell || ownerBoundary.dataCarrier || "its runtime shell")}, with next seam ${escapeHtml(ownerBoundary.nextSeamId || "unrecorded")}${ownerBoundary.boundaryVerdict ? ` under ${escapeHtml(ownerBoundary.boundaryVerdict)} verdict` : ""}.` : "That closes the row-definition carrier at the shard side instead of leaving the family on a generic academy milestone path.") : "Until ownership mapping is resolved, row-level shard cost recovery stays descriptive only."}</p>
          <p class="meta">${ownerBoundary.hasStructure ? `The live fragment structure keeps ${escapeHtml(ownerBoundary.ownerField || "the owner field")} attached to ${escapeHtml(ownerBoundary.rowModelType || ownerBoundary.dataCarrier || "the shard row model")}, with ${escapeHtml(ownerBoundary.rowStateFieldLabel || "unrecorded row-state fields")} preserved for future owner binding.` : ownerBoundary.outcomeStatement ? escapeHtml(ownerBoundary.outcomeStatement) : "Shard owner-family structure still needs deeper recovery."}</p>
          <p class="meta">${ownerBoundary.sourceTraceScope || ownerBoundary.sourceSubjectId ? `This owner-family model is derived from ${escapeHtml(ownerBoundary.sourceTraceScope || "a live trace scope")}${ownerBoundary.sourceSubjectId ? ` via ${escapeHtml(ownerBoundary.sourceSubjectId)}` : ""}, rather than from the archived shard boundary artifact.` : "The current build does not yet expose the live source trace for shard owner-family."}</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card ${costBoundaryStatus.cardClass}">
        <div class="shard-status-heading">
          <span class="snapshot-title">Shard-cost evidence</span>
          <span class="shard-status-pill ${costBoundaryStatus.pillClass}">${escapeHtml(costBoundaryStatus.label)}</span>
        </div>
        <strong>Recovered cost data now supports evidence cards</strong>
        <div class="meta-stack">
          <p class="meta">${costModelBoundary.hasSampledCostWindows ? (hasDbCoverage(costModelBoundary) ? `DB-backed shard boundary coverage now preserves ${costModelBoundary.subjectId || "the shard cost boundary"} with ${costModelBoundary.costWindowLabel}${costModelBoundary.boundaryVerdict ? ` under ${costModelBoundary.boundaryVerdict} verdict` : ""}.` : "Recovered cost samples now show that shard costs follow row-local runtime data instead of a generic UI-only path.") : "The current build does not yet recover enough row-local cost evidence to describe shard costs beyond generic breakpoint notes."}</p>
          <p class="meta">${costModelBoundary.hasSampledCostWindows && costModelBoundary.hasRow0FormulaShell ? (hasDbCoverage(costModelBoundary) ? `The same shard DB surface keeps ${costModelBoundary.row0FieldLabel} attached to ${costModelBoundary.dataCarrier}, with next seam ${costModelBoundary.nextSeamId || "unrecorded"}${costModelBoundary.genericGapCount ? ` and ${costModelBoundary.genericGapCount} explicit generic gap row${costModelBoundary.genericGapCount === 1 ? "" : "s"}` : ""}.` : "That is enough to show row evidence and status per milestone card without claiming exact affordability or formula certainty.") : "Until that recovery exists, player-facing cost views should remain blocked."}</p>
          <p class="meta">${costModelBoundary.hasSampledCostWindows ? (hasDbCoverage(costModelBoundary) ? `Planner-safe shard cost output remains blocked at ${costModelBoundary.blockedOptimizerLabel || "an explicit metadata seam"}, so the app still does not claim exact next-cost math or best-buy order.` : "The app still does not claim exact next-cost math, best-buy order, or recommendation-grade certainty from this contract.") : "No recommendation-grade shard cost behavior is enabled from this path."}</p>
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
          <p class="meta">${saveBoundary.hasSeparationBoundary ? (hasDbCoverage(saveBoundary) ? `DB-backed shard boundary coverage now preserves ${saveBoundary.subjectId || "the shard owned-state boundary"} and still separates ${saveBoundary.ownerAnchor} from ${saveBoundary.saveAnchor}${saveBoundary.boundaryVerdict ? ` under ${saveBoundary.boundaryVerdict} verdict` : ""}.` : "Recovered shard-local evidence still separates direct row definitions from unresolved PlayerProfile save ownership.") : "The current build does not yet preserve a clean shard-to-save separation result."}</p>
          <p class="meta">${saveBoundary.hasSeparationBoundary && saveBoundary.hasDirectRowDefinitionPayload && saveBoundary.hasRuntimeOwnedStateShell ? (hasDbCoverage(saveBoundary) ? `Direct ${saveBoundary.directPayloadAnchor} payload reaches ${saveBoundary.runtimeShellAnchor}, but the owned-state bridge is still blocked at ${saveBoundary.nextSeamId || "an unrecorded seam"}${saveBoundary.genericGapCount ? ` with ${saveBoundary.genericGapCount} explicit generic gap row${saveBoundary.genericGapCount === 1 ? "" : "s"}` : ""}.` : `Direct ${saveBoundary.directPayloadAnchor || "shard"} payload names the reachable row family, but player-owned row state still stops at ${saveBoundary.runtimeShellAnchor || "the runtime shell"}.`) : "The current split between shard row definitions and owned-state recovery is not yet preserved in this build."}</p>
          <p class="meta">${saveBoundary.hasSeparationBoundary ? escapeHtml(saveBoundary.ownedStateStatusLabel) : "The current build does not yet preserve a shard owned-state population boundary."}</p>
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
            ${renderShardDocLink("./docs/systems/shards/shard-cost-pr23-audit.md", "Cost model audit")}
            ${renderShardDocLink("./docs/systems/shards/shard-cost-screenshot-calibration.md", "Cost calibration")}
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderShardWorkflowReference() {
  const shardSystem = getCurrentShardSystemView();
  const mechanics = getGroundedShardMechanics();
  const provenance = shardSystem?.family?.grounded?.provenance;
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
          <p class="meta">${shardDbCoverage.hasCoverage ? `DB-backed shard boundary coverage currently exposes ${shardDbCoverage.subjectCount} subject${shardDbCoverage.subjectCount === 1 ? "" : "s"}: ${shardDbCoverage.subjectLabels.join(", ")}.` : "DB-backed shard boundary coverage is not available in this build."}</p>
          <p class="meta">Base max level before Workers Badge: ${formatOptionalNumber(levelCaps.base_max_level_before_workers_badge)}</p>
          <p class="meta">Max level after Workers Badge: ${formatOptionalNumber(levelCaps.max_level_after_workers_badge)}</p>
          <p class="meta">${escapeHtml(levelCaps.research_note || "Research max-level note unavailable.")}</p>
          <p class="meta">${escapeHtml(levelCaps.ultima_loop_mod_note || "Ultima Loop Mod note unavailable.")}</p>
          <p class="meta">${escapeHtml(mechanics.cost_breakpoints_observed?.breakpoints_statement || "Cost breakpoint note unavailable.")}</p>
          <p class="meta">${shardDbCoverage.hasCoverage && shardDbCoverage.nextSeamLabel ? `Current DB next seams: ${shardDbCoverage.nextSeamLabel}.` : "No DB next-seam coverage is currently available for shard boundaries."}</p>
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
  const shardSystem = getCurrentShardSystemView();
  const observations = shardSystem?.family?.grounded?.observedBehaviors?.observations ?? [];
  const provenance = shardSystem?.family?.grounded?.provenance;
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
  const shardSystem = getCurrentShardSystemView();
  const shardDbCoverage = getShardDbCoverageSummary(shardSystem);
  const ownerBoundary = getShardOwnerFamilyBoundarySummary(shardSystem);
  const saveBoundary = getShardSaveBoundarySummary(shardSystem);
  const familyEvidence = shardSystem?.family?.familyEvidence;
  const sharedEvidence = familyEvidence?.sharedEvidence ?? {};
  const ownedStateBlocker = getShardOwnedStateBlockerSummary();
  return `
    <div class="meta-stack">
      <p class="eyebrow">Shard Mining family evidence</p>
      <h3>Shard milestone rows</h3>
      <p class="meta">These rows render from one shared shard-family evidence table for the reachable ${escapeHtml(ownerBoundary.screenController || "shard")} family. The table now acts as a finished definition-side contract: row definitions are grounded product data, while player-owned shard state remains explicitly blocked.</p>
      <div class="page-grid">
        <article class="snapshot-card">
          <span class="snapshot-title">Grounded definition family</span>
          <p class="meta">Reachable family: rows 0-29 via <strong>${escapeHtml(saveBoundary.runtimeShellAnchor || "ShardMining.upgradeInfoList")}</strong> with <strong>${escapeHtml(saveBoundary.ownerAnchor || "ShardMining / ShardUpgradeInfo")}</strong>.</p>
          <p class="meta">${shardDbCoverage.hasCoverage ? `DB-backed shard boundary coverage now tracks ${shardDbCoverage.subjectLabels.join(", ")}.` : "DB-backed shard boundary coverage is not available in this build."}</p>
          <p class="meta">${shardDbCoverage.hasCoverage && (shardDbCoverage.genericFactCount || shardDbCoverage.genericGapCount) ? `Generic shard mechanics currently preserve ${escapeHtml(String(shardDbCoverage.genericFactCount || 0))} fact row${shardDbCoverage.genericFactCount === 1 ? "" : "s"} and ${escapeHtml(String(shardDbCoverage.genericGapCount || 0))} gap row${shardDbCoverage.genericGapCount === 1 ? "" : "s"} across that shard bundle.` : "Generic shard mechanics are not yet exposing fact/gap rows for this build."}</p>
          <p class="meta">Definition status counts: ${escapeHtml(`${evidenceCounts.verified} verified | ${evidenceCounts.partial} partial | ${evidenceCounts.blocked} blocked`)}</p>
          <p class="meta">${escapeHtml(sharedEvidence.rowModel?.summary || "Row-model summary unavailable.")}</p>
          <p class="meta">${escapeHtml(sharedEvidence.payloadWatch?.summary || "Payload-watch summary unavailable.")}</p>
          <p class="meta">Definition-side cards separate title, unlock requirement, bonus package shape, and row-local cost shell for each row.</p>
        </article>
        <article class="snapshot-card">
          <span class="snapshot-title">Owned-state blocker</span>
          <p class="meta">${escapeHtml(sharedEvidence.saveBoundary?.summary || "Save-boundary summary unavailable.")}</p>
          <p class="meta">${shardDbCoverage.hasCoverage && shardDbCoverage.nextSeamLabel ? `Current DB next seams: ${escapeHtml(shardDbCoverage.nextSeamLabel)}.` : "No DB next-seam coverage is currently available for shard boundaries."}</p>
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
  const spendSystem = getCurrentSpendSystemView();
  const shardSystem = getCurrentShardSystemView();
  const tokenShop = spendSystem?.tokenShop;
  const market = spendSystem?.multiverseMarket;
  const hasTokenShopDbRead = hasTokenShopDbSurface(tokenShop);
  const multiverseMarket = market?.saveOwner?.extract;
  const multiverseMarketMetadataNeighborhood = market?.rowIdentity?.metadataNeighborhood;
  const multiverseMarketRangeBoundary = market?.rowIdentity?.rangeBoundary;
  const multiverseMarketRowTextCoverage = market?.rowIdentity?.rowTextCoverage;
  const multiverseMarketPrefabRemapBoundary = market?.rowIdentity?.prefabRemapBoundary;
  const multiverseMarketActionShell = market?.uiShell?.actionShell;
  const multiverseMarketOwnerFamily = market?.uiShell?.ownerFamily;
  const multiverseMarketSaveBoundary = market?.saveOwner?.saveBoundary;
  const multiverseMarketMarketMemberBoundary = market?.saveOwner?.marketMemberBoundary;
  const shardMilestones = shardSystem?.family?.grounded?.milestones;
  const shardAssetGrounding = shardSystem?.family?.grounded?.assetGrounding;
  const shardCostModelBoundary = shardSystem?.cost?.costModelBoundary;
  const shardSaveBoundary = shardSystem?.ownedState?.saveBoundary;
  const tokeniumNamingSummary = getTokeniumNamingSummary(tokenShop);
  const tokenShopCostLaneSummary = getTokenShopCostLaneSummary(tokenShop);
  const spendActionLaneSummary = getSpendActionLaneSummary(tokenShop);
  const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(tokenShop);
  const tokenShopSaveBoundarySummary = getTokenShopSaveBoundarySummary(tokenShop);
  const tokenBankControllerShellSummary = getTokenBankControllerShellSummary(tokenShop);
  const tokenBankStateSummary = getTokenBankStateSummary(tokenShop);
  const dailyTokeniumSummary = getDailyTokeniumLaneSummary(tokenShop);
  const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(tokenShop);
  const hasTokeniumNamingRead = hasTokenShopDbRead || Boolean(tokenShop?.tokenBank?.namingClues);
  const hasTokenShopCostLaneRead = hasTokenShopDbRead || Boolean(tokenShop?.spendLanes?.costLanes);
  const hasSpendActionLaneRead =
    hasTokenShopDbRead || Boolean(tokenShop?.spendLanes?.actionLaneClues);
  const hasTokenShopOwnerShellRead =
    hasTokenShopDbRead || Boolean(tokenShop?.tokenBank?.ownerShell);
  const hasTokenShopSaveBoundaryRead =
    hasTokenShopDbRead || Boolean(tokenShop?.rows?.boundaries?.save);
  const hasTokenBankControllerShellRead =
    hasTokenShopDbRead || Boolean(tokenShop?.tokenBank?.controllerShell);
  const hasTokenBankStateRead = hasTokenShopDbRead || Boolean(tokenShop?.tokenBank?.stateClues);
  const hasDailyTokeniumLaneRead =
    hasTokenShopDbRead || Boolean(tokenShop?.dailyTokenium?.laneClues);
  const hasTokenBankFormulaRead =
    hasTokenShopDbRead || Boolean(tokenShop?.tokenBank?.formulaBoundary);
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
  if (shardSystem) {
    const ownerBoundary = getShardOwnerFamilyBoundarySummary(shardSystem);
    cases.push({
      title: "Shard owner-family boundary",
      expected: `${ownerBoundary.screenController} keeps ${ownerBoundary.ownerField || "the owner field"} attached to ${ownerBoundary.rowModelType || ownerBoundary.dataCarrier} while ${ownerBoundary.nextSeamId || ownerBoundary.blockedEdgeLabel || "the current owner seam"} remains blocked`,
      actual:
        ownerBoundary.hasBoundary && ownerBoundary.hasStructure
          ? `${ownerBoundary.screenController} keeps ${ownerBoundary.ownerField || "the owner field"} attached to ${ownerBoundary.rowModelType || ownerBoundary.dataCarrier} while ${ownerBoundary.nextSeamId || ownerBoundary.blockedEdgeLabel || "the current owner seam"} remains blocked`
          : "Shard owner-family boundary drifted",
      pass: ownerBoundary.hasBoundary && ownerBoundary.hasStructure,
      scope: "APK"
    });
  }
  if (shardSystem) {
    const finalSuBoundary = getShardFinalSuBonusBoundarySummary(shardSystem);
    cases.push({
      title: "Shard FinalSU bonus boundary",
      expected: `${finalSuBoundary.dataCarrier} preserves SU final-unlock and FinalSU bonus-field families without row mapping claims`,
      actual: finalSuBoundary.hasBoundary
        ? `${finalSuBoundary.dataCarrier} preserves ${finalSuBoundary.unlockRangeLabel} plus ${finalSuBoundary.bonusFieldLabel}`
        : "Shard FinalSU bonus-field boundary drifted",
      pass: finalSuBoundary.hasBoundary && finalSuBoundary.hasAdjacentFields,
      scope: "APK"
    });
  }
  if (shardSystem) {
    const payloadBoundary = getShardMilestonePayloadBoundarySummary(shardSystem);
    cases.push({
      title: "Shard milestone payload boundary",
      expected: `${payloadBoundary.dataCarrier} preserves milestone-total, cost-list, progress-fill, and phase-tick hooks without claiming saved player rows`,
      actual:
        payloadBoundary.hasBoundary &&
        payloadBoundary.hasCostAndListHooks &&
        payloadBoundary.hasProgressFillHooks &&
        payloadBoundary.hasTickFields
          ? `${payloadBoundary.dataCarrier} preserves ${payloadBoundary.milestoneStateLabel} plus ${payloadBoundary.costAccessorLabel}`
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
  if (shardSystem?.db?.hasAny || shardCostModelBoundary) {
    const costModelBoundary = getShardCostModelBoundarySummary(shardSystem);
    cases.push({
      title: "Shard cost-model boundary",
      expected: `${costModelBoundary.dataCarrier} preserves sampled SU cost accessors plus a row-local SU0 cost parameter shell without formula claims`,
      actual:
        costModelBoundary.hasBoundary &&
        costModelBoundary.hasSampledCostWindows &&
        costModelBoundary.hasRow0FormulaShell
          ? `${costModelBoundary.dataCarrier} preserves ${costModelBoundary.costWindowLabel} plus ${costModelBoundary.row0FieldLabel}`
          : "Shard cost-model boundary drifted",
      pass:
        costModelBoundary.hasBoundary &&
        costModelBoundary.hasSampledCostWindows &&
        costModelBoundary.hasRow0FormulaShell,
      scope: "APK"
    });
  }
  if (shardSystem) {
    const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(shardSystem);
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
  if (shardSystem) {
    const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(shardSystem);
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
  if (shardSystem) {
    const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(shardSystem);
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
  if (shardSystem) {
    const rowShellBoundary = getShardMilestoneRowShellBoundarySummary(shardSystem);
    cases.push({
      title: "Shard milestone row shell",
      expected: `${rowShellBoundary.screenController} preserves partial UnlockMilestone, BuyMilestone, and MilestoneTextChecker row shell without row-owner claims`,
      actual:
        rowShellBoundary.hasBoundary &&
        rowShellBoundary.hasUnlockHookSamples &&
        rowShellBoundary.hasBuyHookSamples &&
        rowShellBoundary.hasTextCheckerSamples
          ? `${rowShellBoundary.screenController} preserves ${rowShellBoundary.unlockHookLabel} plus ${rowShellBoundary.buyHookLabel} and ${rowShellBoundary.textCheckerLabel}`
          : "Shard milestone row-shell boundary drifted",
      pass:
        rowShellBoundary.hasBoundary &&
        rowShellBoundary.hasUnlockHookSamples &&
        rowShellBoundary.hasBuyHookSamples &&
        rowShellBoundary.hasTextCheckerSamples,
      scope: "APK"
    });
  }
  if (shardSystem) {
    const rowAlignmentBoundary = getShardMilestoneRowAlignmentBoundarySummary(shardSystem);
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
  const shardFamilyEvidence = getCurrentShardSystemView()?.family?.familyEvidence;
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
  if (shardSystem?.db?.hasAny || shardSaveBoundary) {
    const saveBoundary = getShardSaveBoundarySummary(shardSystem);
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
    const tokenShopCoverage = getTokenShopCoverageSummary(getCurrentSpendSystemView()?.tokenShop);
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
        "DB-backed TokenShop subject coverage or extracted family coverage remains available with token-bank controller anchors",
      actual: tokenShopCoverage.hasCoverage
        ? hasTokenShopDbCoverage(tokenShopCoverage)
          ? `${tokenShopCoverage.subjectCount} DB-backed subjects with ${tokenShopCoverage.rowLocalCount} row-local / ${tokenShopCoverage.rangeFamilyCount} range-family entries${tokenShopCoverage.hasControllerAnchors ? " plus DB-grounded action/controller anchors" : " but missing DB-grounded action/controller anchors"}`
          : `${tokenShopCoverage.numericGroupCount} numeric groups with ${tokenShopCoverage.namedLaneLabel}${tokenShopCoverage.hasControllerAnchors ? " plus token-bank controller anchors" : " but missing token-bank controller anchors"}`
        : "Missing TokenShop extracted family coverage",
      pass: hasTokenShopDbCoverage(tokenShopCoverage)
        ? tokenShopCoverage.subjectCount >= 2 &&
          tokenShopCoverage.rowLocalCount >= 1 &&
          tokenShopCoverage.rangeFamilyCount >= 1
        : tokenShopCoverage.numericGroupCount === 32 &&
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

  if (market?.db?.hasAny || multiverseMarketMetadataNeighborhood) {
    const { hasCloudSavePathClues, hasSaveFamilyClues, hasProgressionFieldCluster } =
      getMultiverseMarketMetadataSummary(multiverseMarketMetadataNeighborhood, market);
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

  if (hasTokeniumNamingRead) {
    cases.push({
      title: "Spend tokenium naming clues",
      expected:
        "Resource_Tokenium, Aca.Tokenium553, CostBox-Tokens, and CostBox-Tokenium available",
      actual: tokeniumNamingSummary.hasNamingClues
        ? hasTokenShopDbCoverage(tokeniumNamingSummary)
          ? `${tokeniumNamingSummary.rangeFamilySubjectId || tokeniumNamingSummary.rowLocalSubjectId || "DB-backed TokenShop subject"} preserves ${tokeniumNamingSummary.resourceLabel}, ${tokeniumNamingSummary.academyLabel}, ${tokeniumNamingSummary.tokenShellLabel}, and ${tokeniumNamingSummary.tokeniumShellLabel}`
          : `${tokeniumNamingSummary.resourceLabel}, ${tokeniumNamingSummary.academyLabel}, ${tokeniumNamingSummary.tokenShellLabel}, and ${tokeniumNamingSummary.tokeniumShellLabel} available`
        : "Missing token or tokenium naming clues",
      pass: tokeniumNamingSummary.hasNamingClues,
      scope: "APK"
    });
  }

  if (hasTokenShopCostLaneRead) {
    cases.push({
      title: "TokenShop cost-lane split",
      expected:
        "DB-backed TokenShop display coverage or legacy cost-lane coverage remains available",
      actual: tokenShopCostLaneSummary.hasLaneSplit
        ? hasTokenShopDbCoverage(tokenShopCostLaneSummary)
          ? `${tokenShopCostLaneSummary.rowLocalSubjectId} plus ${tokenShopCostLaneSummary.rangeFamilySubjectId} preserve DB-backed display coverage`
          : `${tokenShopCostLaneSummary.tokenLaneLabel}, ${tokenShopCostLaneSummary.diamondLaneLabel}, ${tokenShopCostLaneSummary.dailyLaneLabel}, ${tokenShopCostLaneSummary.costShellLabel}, and ${tokenShopCostLaneSummary.descriptionRenderLabel} available`
        : "Missing TokenShop trace-produced cost-lane support",
      pass:
        tokenShopCostLaneSummary.hasLaneSplit &&
        tokenShopCostLaneSummary.keepsDailyTokeniumSeparate,
      scope: "APK"
    });
  }

  if (hasSpendActionLaneRead) {
    cases.push({
      title: "Spend action-lane split",
      expected: "DB-backed TokenShop action coverage or legacy spend action-lane clues preserved",
      actual: spendActionLaneSummary.hasActionSplit
        ? hasTokenShopDbCoverage(spendActionLaneSummary)
          ? `${spendActionLaneSummary.rowLocalSubjectId} preserves ${spendActionLaneSummary.loopModifierHook} while ${spendActionLaneSummary.rangeFamilySubjectId} keeps ${spendActionLaneSummary.dailyHookT2}`
          : `${spendActionLaneSummary.tokenHook}, ${spendActionLaneSummary.diamondHook}, ${spendActionLaneSummary.loopModifierHook}, ${spendActionLaneSummary.premiumModifierHook}, and zero ${spendActionLaneSummary.dailyHookT2} or ${spendActionLaneSummary.dailyHookT3} hooks preserved`
        : "Missing spend action-lane clues",
      pass:
        spendActionLaneSummary.hasActionSplit &&
        spendActionLaneSummary.keepsDailyDirectHooksUnrecovered,
      scope: "APK"
    });
  }

  if (hasTokenShopOwnerShellRead) {
    cases.push({
      title: "TokenShop owner shell",
      expected: "DB-backed TokenShop owner shell or legacy local owner shell preserved",
      actual: tokenShopOwnerShellSummary.hasOwnerShell
        ? hasTokenShopDbCoverage(tokenShopOwnerShellSummary)
          ? `${tokenShopOwnerShellSummary.rowLocalSubjectId} plus ${tokenShopOwnerShellSummary.rangeFamilySubjectId} preserved as DB-backed TokenShop subject coverage`
          : `${tokenShopOwnerShellSummary.ownerAnchor}, ${tokenShopOwnerShellSummary.bankMethod}, ${tokenShopOwnerShellSummary.notificationHook}, and ${tokenShopOwnerShellSummary.deviceHook} preserved as one local owner shell`
        : "Missing TokenShop owner-shell clues",
      pass: tokenShopOwnerShellSummary.hasOwnerShell,
      scope: "APK"
    });
  }

  if (hasTokenShopSaveBoundaryRead) {
    cases.push({
      title: "TokenShop save boundary",
      expected:
        "DB-backed TokenShop subject-state separation or legacy save-boundary separation remains available",
      actual: tokenShopSaveBoundarySummary.hasSeparationBoundary
        ? hasTokenShopDbCoverage(tokenShopSaveBoundarySummary)
          ? `${tokenShopSaveBoundarySummary.rowLocalSubjectId} and ${tokenShopSaveBoundarySummary.rangeFamilySubjectId} stay separate with blocked input ${tokenShopSaveBoundarySummary.blockedInputReason}`
          : `${tokenShopSaveBoundarySummary.ownerAnchor} and ${tokenShopSaveBoundarySummary.saveAnchor} stay separate with ${tokenShopSaveBoundarySummary.overlapLabel}`
        : "Missing TokenShop save-boundary clues",
      pass: tokenShopSaveBoundarySummary.hasSeparationBoundary,
      scope: "APK"
    });
  }

  if (hasTokenBankControllerShellRead) {
    cases.push({
      title: "Token-bank controller shell",
      expected:
        "DB-backed TokenShop controller shell or legacy token-bank controller shell preserved",
      actual: tokenBankControllerShellSummary.hasControllerShell
        ? hasTokenShopDbCoverage(tokenBankControllerShellSummary)
          ? `${tokenBankControllerShellSummary.rowLocalSubjectId} preserves ${tokenBankControllerShellSummary.claimMethod}, ${tokenBankControllerShellSummary.fillMethod}, ${tokenBankControllerShellSummary.fillField}, ${tokenBankControllerShellSummary.descriptionShell}, and ${tokenBankControllerShellSummary.notificationHook}`
          : `${tokenBankControllerShellSummary.claimMethod}, ${tokenBankControllerShellSummary.fillMethod}, ${tokenBankControllerShellSummary.fillField}, ${tokenBankControllerShellSummary.descriptionShell}, and ${tokenBankControllerShellSummary.notificationHook} preserved`
        : "Missing token-bank controller-shell clues",
      pass: tokenBankControllerShellSummary.hasControllerShell,
      scope: "APK"
    });
  }

  if (hasTokenBankStateRead) {
    cases.push({
      title: "Token-bank controller split clues",
      expected:
        "ClaimBankedTokens, get_TokenBankCap, BigStatisticPrefab.TokenBankCap, and SetLM244BonusText available",
      actual: tokenBankStateSummary.hasControllerSplit
        ? hasTokenShopDbCoverage(tokenBankStateSummary)
          ? `${tokenBankStateSummary.rowLocalSubjectId || tokenBankStateSummary.rangeFamilySubjectId || "DB-backed TokenShop subject"} preserves ${tokenBankStateSummary.claimMethod}, ${tokenBankStateSummary.capMethod}, ${tokenBankStateSummary.displayShell}, and ${tokenBankStateSummary.loopHook}`
          : `${tokenBankStateSummary.claimMethod}, ${tokenBankStateSummary.capMethod}, ${tokenBankStateSummary.displayShell}, and ${tokenBankStateSummary.loopHook} available`
        : "Missing token-bank controller split clues",
      pass: tokenBankStateSummary.hasControllerSplit,
      scope: "APK"
    });
  }

  if (hasDailyTokeniumLaneRead) {
    cases.push({
      title: "Daily Tokenium owner-family clues",
      expected:
        "SpaceAcademy, FarmMissions, SetLM244BonusText, BuyLM244, and BuyCollectorDevice available",
      actual: dailyTokeniumSummary.hasOwnerFamilyClues
        ? hasTokenShopDbCoverage(dailyTokeniumSummary)
          ? `${dailyTokeniumSummary.rangeFamilySubjectId || dailyTokeniumSummary.rowLocalSubjectId || "DB-backed TokenShop subject"} preserves ${dailyTokeniumSummary.ownerFamilyLabel}, ${dailyTokeniumSummary.missionFamilyLabel}, ${dailyTokeniumSummary.loopHook}, ${dailyTokeniumSummary.purchaseHook}, and ${dailyTokeniumSummary.purchaseOwner}`
          : `${dailyTokeniumSummary.ownerFamilyLabel}, ${dailyTokeniumSummary.missionFamilyLabel}, ${dailyTokeniumSummary.loopHook}, ${dailyTokeniumSummary.purchaseHook}, and ${dailyTokeniumSummary.purchaseOwner} available`
        : "Missing Daily Tokenium owner-family clues",
      pass: dailyTokeniumSummary.hasOwnerFamilyClues && dailyTokeniumSummary.hasModifierBoundary,
      scope: "APK"
    });
  }

  if (hasTokenBankFormulaRead) {
    cases.push({
      title: "Token-bank derived output boundary",
      expected:
        "FinalTokenBankCap and FinalTokenBankFillSpeed cluster without PlayerProfileData or CloudSavePlayerProfile joins",
      actual: tokenBankFormulaSummary.hasDerivedOutputBoundary
        ? hasTokenShopDbCoverage(tokenBankFormulaSummary)
          ? `${tokenBankFormulaSummary.rowLocalSubjectId || tokenBankFormulaSummary.rangeFamilySubjectId || "DB-backed TokenShop subject"} preserves ${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField}${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? " without save-family joins" : " with save-family overlap"}.`
          : `${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField} cluster${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? " without save-family joins" : " with save-family overlap"}.`
        : "Missing token-bank derived output boundary clues",
      pass:
        tokenBankFormulaSummary.hasDerivedOutputBoundary &&
        tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext,
      scope: "APK"
    });
  }

  if (market?.db?.hasAny || multiverseMarketRangeBoundary) {
    const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(
      multiverseMarketRangeBoundary,
      market
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

  if (market?.db?.hasAny || multiverseMarketRowTextCoverage) {
    const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(
      multiverseMarketRowTextCoverage,
      market
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

  if (market?.db?.hasAny || multiverseMarketPrefabRemapBoundary) {
    const multiverseMarketPrefabRemapSummary = getMultiverseMarketPrefabRemapBoundarySummary(
      multiverseMarketPrefabRemapBoundary,
      market
    );
    cases.push({
      title: "MultiverseMarket prefab remap boundary",
      expected:
        "Validated ids 69-74 still do not have direct ChrystosEmporiumUpgrade number matches",
      actual: multiverseMarketPrefabRemapSummary.hasOverrideBoundary
        ? multiverseMarketPrefabRemapSummary.overridePairs?.length
          ? `Bounded override pairs ${multiverseMarketPrefabRemapSummary.overridePairs.join(", ")} preserved from the live multiverse fragment lane`
          : `${multiverseMarketPrefabRemapSummary.lastDirectPrefab} is the last direct band before ${multiverseMarketPrefabRemapSummary.firstOverride} through ${multiverseMarketPrefabRemapSummary.lastOverride}`
        : "Missing MultiverseMarket prefab-remap boundary",
      pass: multiverseMarketPrefabRemapSummary.hasOverrideBoundary,
      scope: "APK"
    });
  }

  if (market?.db?.hasAny || multiverseMarketActionShell) {
    const multiverseMarketActionShellSummary = getMultiverseMarketActionShellSummary(
      multiverseMarketActionShell,
      market
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

  if (market?.db?.hasAny || multiverseMarketOwnerFamily) {
    const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(
      multiverseMarketOwnerFamily,
      market
    );
    cases.push({
      title: "MultiverseMarket owner family",
      expected:
        "MultiverseMarket, Inscryptions, and IS1-110 CurrencyBox shell preserved without implying saved-state ownership",
      actual: multiverseMarketOwnerFamilySummary.hasOwnerFamily
        ? `${multiverseMarketOwnerFamilySummary.ownerAnchor}, ${multiverseMarketOwnerFamilySummary.inscryptionsLabel}, and ${multiverseMarketOwnerFamilySummary.textHandler} preserved${multiverseMarketOwnerFamilySummary.currencyRangeLabel ? ` with ${multiverseMarketOwnerFamilySummary.currencyRangeLabel}` : ""}`
        : "Missing MultiverseMarket owner-family shell",
      pass: multiverseMarketOwnerFamilySummary.hasOwnerFamily,
      scope: "APK"
    });
  }

  if (market?.db?.hasAny || multiverseMarketSaveBoundary) {
    const multiverseDbCoverage = getMultiverseMarketDbCoverageSummary(market);
    const multiverseMarketSaveBoundarySummary = getMultiverseMarketSaveBoundarySummary(market);
    cases.push({
      title: "MultiverseMarket save boundary",
      expected:
        "MultiverseMarket action shell and PlayerProfileData save-family clues stay separate with zero overlap",
      actual: multiverseMarketSaveBoundarySummary.hasSeparationBoundary
        ? `${multiverseMarketSaveBoundarySummary.actionAnchor} and ${multiverseMarketSaveBoundarySummary.saveAnchor} stay separate with ${multiverseMarketSaveBoundarySummary.overlapLabel}${multiverseDbCoverage.hasCoverage ? ` while ${multiverseDbCoverage.coverageSource} keeps ${multiverseDbCoverage.subjectCount} subject${multiverseDbCoverage.subjectCount === 1 ? "" : "s"}` : ""}`
        : "Missing MultiverseMarket save-boundary clues",
      pass: multiverseMarketSaveBoundarySummary.hasSeparationBoundary,
      scope: "APK"
    });
  }

  if (market?.db?.hasAny || multiverseMarketMarketMemberBoundary) {
    const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(market);
    cases.push({
      title: "MultiverseMarket canonical host narrowing",
      expected:
        "PlayerProfileHandler get_Market accessor bridge is checked while direct MultiverseMarket ownership of the broader progression run is ruled out",
      actual: marketMemberSummary.favorsDirectMemberBoundary
        ? `${marketMemberSummary.canonicalHostLabel} is checked, ${marketMemberSummary.negativeMultiverseFieldLabel}${marketMemberSummary.compatibilityImportTargetPath ? `, and compatibility import remains quarantined at ${marketMemberSummary.compatibilityImportTargetPath}` : ""}`
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
  const spendView = getCurrentSpendSystemView()?.tokenShop;
  const dbRowDetailResolver = buildTokenShopDbRowDetailResolver(spendView?.db);
  const rows = [
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
      bonusPlateSuffix: " sec",
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
      storefrontDisplayTitle: "Mod Points Booster",
      storefrontEffectText: "x1.01 to MP Gained.",
      storefrontBuffTargets: [{ label: "MP", tone: "mod" }],
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
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
      note: "Checked shell-to-prefab bridge only. The remaining honest blocker is the exact runtime display-update path and runtime model for the ATU4 row, so the storefront keeps the per-level effect but does not pretend the cumulative plate total is verified."
    },
    {
      field: "ATU5Level",
      slot: "ATU5",
      storefrontDisplayTitle: "Mk1 Generator Booster",
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
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
      storefrontDisplayTitle: "Mk2 Generator Booster",
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
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
      storefrontDisplayTitle: "Mk3 Generator Booster",
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
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
      storefrontDisplayTitle: "Mk4 Generator Booster",
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
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
      storefrontDisplayTitle: "Mk5 Generator Booster",
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
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
      storefrontDisplayTitle: "Mk6 Generator Booster",
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
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
      storefrontDisplayTitle: "Mk8 Generator Booster",
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
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
    },
    {
      field: "ATU11Level",
      slot: "ATU11",
      storefrontDisplayTitle: "Mk7 Generator Booster",
      storefrontBuffDisplayMode: "runtime-unresolved",
      costFormulaConfidence: "projected",
      identity:
        boundary?.atu11BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle ||
        boundary?.atu11BridgeFollowUp?.recoveredBridge?.prefabIdentity ||
        "Mk7 Generator Booster",
      identitySource: boundary?.atu11BridgeFollowUp?.verifiedTitleTextChain?.titleProbeTitle
        ? "Checked title-side text chain"
        : "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "MK7TokenBoostStartCost",
      additiveCostField: "MK7TokenBoostAdditiveCost",
      bonusField: "MK7TokenBoostBonus",
      maxLevelField: "MK7TokenBoostFillMaxLevel",
      bonusStepLabel: "Mk7 Output",
      bonusStepMode: "multiplier",
      note: "Checked shell-to-prefab bridge only. This row stays compatibility-only until a final player-facing title join is recovered."
    },
    {
      field: "ATU13Level",
      slot: "ATU13",
      identity:
        boundary?.atu13BridgeFollowUp?.recoveredBridge?.prefabIdentity ||
        "NewTokenUPGPrefab.T2.TokensBoost",
      identitySource: "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "TokenBoostT2StartCost",
      additiveCostField: "TokenBoostT2AdditiveCost",
      bonusField: "TokenBoostT2Bonus",
      maxLevelField: "TokenBoostT2MaxLevel",
      bonusStepLabel: "Tokens Gained from Token Chests",
      bonusStepMode: "additive",
      note: "Checked shell-to-prefab bridge only. The detached Tokens Booster T2 title-side clue still does not preserve one exact shell-local final-title join."
    },
    {
      field: "ATU14Level",
      slot: "ATU14",
      displayTitle: "ATU14 Shell (TokenDailiesT2 clue)",
      storefrontDisplayTitle: "Daily Tokens T2",
      storefrontEffectText: "+20% to Tokens Gained from Daily Rewards & Events (additive).",
      storefrontBuffTargets: [{ label: "Daily Tokens", tone: "token" }],
      identity: "TokenDailiesT2",
      identitySource: "DB-backed owner-order numeric family clue",
      rowType: "prefab-driven",
      rowTypeLabel: "DB-backed Daily Tokenium family clue row",
      startCostField: "TokenDailiesT2StartCost",
      additiveCostField: "TokenDailiesT2AdditiveCost",
      bonusField: "TokenDailiesT2Bonus",
      maxLevelField: "TokenDailiesT2MaxLevel",
      bonusStepLabel: "to Tokens Gained from Daily Rewards & Events",
      bonusStepMode: "additive",
      bonusValueDisplayMode: "percent-total-multiplier",
      note: "DB-backed Daily Tokenium-family compatibility row. TokenDailiesT2 plus ATU14TokenDailiesBonus now anchor the owner-side row family, but direct purchase-hook recovery and the final player-facing title or runtime display path still stay quarantined."
    },
    {
      field: "ATU15Level",
      slot: "ATU15",
      displayTitle: "ATU15 Shell (T2Duo1 clue)",
      storefrontDisplayTitle: "Duo Booster One",
      storefrontEffectText: "x1.02 to MP Gained & Shards Gained.",
      storefrontBuffTargets: [
        { label: "MP", tone: "mod" },
        { label: "Shards", tone: "shard" }
      ],
      storefrontBuffDisplayMode: "runtime-unresolved",
      identity: "T2Duo1",
      identitySource: "DB-backed owner-order numeric family clue",
      rowType: "prefab-driven",
      rowTypeLabel: "DB-backed Daily Tokenium family clue row",
      startCostField: "T2Duo1StartCost",
      additiveCostField: "T2Duo1AdditiveCost",
      bonusField: "T2Duo1Bonus",
      maxLevelField: "T2Duo1MaxLevel",
      bonusStepLabel: "the checked T2 duo-family lane",
      bonusStepMode: "multiplier",
      note: "DB-backed Daily Tokenium-family clue row. The owner-side shell order now anchors this row on the T2Duo1 numeric block, but the final player-facing title, exact effect lane, and runtime display path still stay quarantined."
    },
    {
      field: "ATU16Level",
      slot: "ATU16",
      displayTitle: "ATU16 Shell (T2Duo2 clue)",
      storefrontDisplayTitle: "Duo Booster Two",
      storefrontEffectText: "x1.02 to Mk1 Output & Mk2 Output.",
      storefrontBuffTargets: [
        { label: "Mk1", tone: "generator" },
        { label: "Mk2", tone: "generator" }
      ],
      storefrontBuffDisplayMode: "runtime-unresolved",
      identity: "T2Duo2",
      identitySource: "DB-backed owner-order numeric family clue",
      rowType: "prefab-driven",
      rowTypeLabel: "DB-backed Daily Tokenium family clue row",
      startCostField: "T2Duo2StartCost",
      additiveCostField: "T2Duo2AdditiveCost",
      bonusField: "T2Duo2Bonus",
      maxLevelField: "T2Duo2MaxLevel",
      bonusStepLabel: "the checked T2 duo-family lane",
      bonusStepMode: "multiplier",
      note: "DB-backed Daily Tokenium-family clue row. The owner-side shell order now anchors this row on the T2Duo2 numeric block, but the final player-facing title, exact effect lane, and runtime display path still stay quarantined."
    },
    {
      field: "ATU17Level",
      slot: "ATU17",
      displayTitle: "ATU17 Shell (T2Duo3 clue)",
      storefrontDisplayTitle: "Duo Booster Three",
      storefrontEffectText: "x1.02 to Mk3 Output & Mk4 Output.",
      storefrontBuffTargets: [
        { label: "Mk3", tone: "generator" },
        { label: "Mk4", tone: "generator" }
      ],
      storefrontBuffDisplayMode: "runtime-unresolved",
      identity: "T2Duo3",
      identitySource: "DB-backed owner-order numeric family clue",
      rowType: "prefab-driven",
      rowTypeLabel: "DB-backed Daily Tokenium family clue row",
      startCostField: "T2Duo3StartCost",
      additiveCostField: "T2Duo3AdditiveCost",
      bonusField: "T2Duo3Bonus",
      maxLevelField: "T2Duo3MaxLevel",
      bonusStepLabel: "the checked T2 duo-family lane",
      bonusStepMode: "multiplier",
      note: "DB-backed Daily Tokenium-family clue row. The owner-side shell order now anchors this row on the T2Duo3 numeric block, but the final player-facing title, exact effect lane, and runtime display path still stay quarantined."
    },
    {
      field: "ATU18Level",
      slot: "ATU18",
      displayTitle: "ATU18 Shell (T2Duo4 clue)",
      storefrontDisplayTitle: "Duo Booster Four",
      storefrontEffectText: "x1.02 to Mk5 Output & Mk6 Output.",
      storefrontBuffTargets: [
        { label: "Mk5", tone: "generator" },
        { label: "Mk6", tone: "generator" }
      ],
      storefrontBuffDisplayMode: "runtime-unresolved",
      identity: "T2Duo4",
      identitySource: "DB-backed owner-order numeric family clue",
      rowType: "prefab-driven",
      rowTypeLabel: "DB-backed Daily Tokenium family clue row",
      startCostField: "T2Duo4StartCost",
      additiveCostField: "T2Duo4AdditiveCost",
      bonusField: "T2Duo4Bonus",
      maxLevelField: "T2Duo4MaxLevel",
      bonusStepLabel: "the checked T2 duo-family lane",
      bonusStepMode: "multiplier",
      note: "DB-backed Daily Tokenium-family clue row. The owner-side shell order now anchors this row on the T2Duo4 numeric block, but the final player-facing title, exact effect lane, and runtime display path still stay quarantined."
    },
    {
      field: "ATU19Level",
      slot: "ATU19",
      displayTitle: "ATU19 Shell (T2Duo5 clue)",
      storefrontDisplayTitle: "Duo Booster Five",
      storefrontEffectText: "x1.02 to Mk7 Output & Mk8 Output.",
      storefrontBuffTargets: [
        { label: "Mk7", tone: "generator" },
        { label: "Mk8", tone: "generator" }
      ],
      storefrontBuffDisplayMode: "runtime-unresolved",
      identity: "T2Duo5",
      identitySource: "DB-backed owner-order numeric family clue",
      rowType: "prefab-driven",
      rowTypeLabel: "DB-backed Daily Tokenium family clue row",
      startCostField: "T2Duo5StartCost",
      additiveCostField: "T2Duo5AdditiveCost",
      bonusField: "T2Duo5Bonus",
      maxLevelField: "T2Duo5MaxLevel",
      bonusStepLabel: "the checked T2 duo-family lane",
      bonusStepMode: "multiplier",
      note: "DB-backed Daily Tokenium-family clue row. The old ATU19 equals ATU20 duplicate claim no longer clears on owner-field order, but the final player-facing title, exact effect lane, or runtime display path still stays quarantined."
    },
    {
      field: "ATU20Level",
      slot: "ATU20",
      identity:
        boundary?.atu20BridgeFollowUp?.recoveredBridge?.prefabIdentity ||
        "NewTokenUPGPrefab.T3.TokensBoost",
      identitySource: "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      startCostField: "TokenBoostT3StartCost",
      additiveCostField: "TokenBoostT3AdditiveCost",
      bonusField: "TokenBoostT3Bonus",
      maxLevelField: "TokenBoostT3MaxLevel",
      bonusStepLabel: "Tokens Gained from Token Chests",
      bonusStepMode: "additive",
      note: "Checked shell-to-prefab bridge only. The detached Tokens Booster T3 title-side clue still does not preserve one exact shell-local final-title join."
    },
    {
      field: "ATU21Level",
      slot: "ATU21",
      displayTitle: "ATU21 Shell (T3Trio1 clue)",
      storefrontDisplayTitle: "Daily Tokens T3",
      storefrontEffectText: "+20% to Tokens Gained from Daily Rewards & Events (additive).",
      storefrontBuffTargets: [{ label: "Daily Tokens", tone: "token" }],
      identity: "T3Trio1",
      identitySource: "DB-backed owner-order numeric family clue",
      rowType: "prefab-driven",
      rowTypeLabel: "T3 trio family clue row",
      startCostField: "TokenDailiesT3StartCost",
      additiveCostField: "TokenDailiesT3AdditiveCost",
      bonusField: "TokenDailiesT3Bonus",
      maxLevelField: "TokenDailiesT3MaxLevel",
      bonusStepLabel: "Tokens Gained from Daily Rewards & Events",
      bonusStepMode: "additive",
      bonusValueDisplayMode: "percent-total-multiplier",
      note: "The owner-side shell order in the committed trio-family extract stays noisy, but the extracted T3 Daily Tokenium value lane is grounded. The storefront therefore uses the recovered Daily Tokens T3 cost and bonus fields while leaving the broader trio-family row-identity join as compatibility-only."
    },
    {
      field: "ATU22Level",
      slot: "ATU22",
      displayTitle: "ATU22 Shell (T3Trio2 clue)",
      storefrontDisplayTitle: "Trinity Booster One",
      storefrontEffectText: "x1.03 to All Generators Output, MP Gained & RP Gained.",
      storefrontBuffTargets: [
        { label: "Output", tone: "generator" },
        { label: "MP", tone: "mod" },
        { label: "RP", tone: "rp" }
      ],
      storefrontBuffDisplayMode: "runtime-unresolved",
      identity: "T3Trio2",
      identitySource: "DB-backed owner-order numeric family clue",
      rowType: "prefab-driven",
      rowTypeLabel: "T3 trio family clue row",
      startCostField: "T3Trio2StartCost",
      additiveCostField: "T3Trio2AdditiveCost",
      bonusField: "T3Trio2Bonus",
      maxLevelField: "T3Trio2MaxLevel",
      bonusStepLabel: "the checked T3 trio-family lane",
      bonusStepMode: "multiplier",
      note: "DB-backed T3 trio-family clue row. The owner-side shell order anchors ATU22 on the T3Trio2 numeric block, while the exact player-facing row identity and runtime display mapping still depend on stronger row-local joins."
    },
    {
      field: "ATU23Level",
      slot: "ATU23",
      displayTitle: "ATU23 Shell (bounded placeholder clue)",
      storefrontDisplayTitle: "Trinity Booster Two",
      storefrontEffectText: "x1.03 to All Generators Output, Shards Gained & AP Gained.",
      storefrontBuffTargets: [
        { label: "Output", tone: "generator" },
        { label: "Shards", tone: "shard" },
        { label: "AP", tone: "ap" }
      ],
      storefrontBuffDisplayMode: "runtime-unresolved",
      identity: "ATU23 shell placeholder",
      identitySource: "DB-backed bounded placeholder clue",
      rowType: "prefab-driven",
      rowTypeLabel: "T3 trio bounded placeholder row",
      bonusStepLabel: "the unresolved ATU23 trio-family lane",
      bonusStepMode: "additive",
      note: "Bounded T3 trio placeholder row. The committed owner-side extract advances from ATU22 directly into the ATU23 shell and then into ATU24 without a surviving third T3 trio owner block, so this row stays unresolved until a stronger display-side or runtime join clears."
    },
    {
      field: "ATU24Level",
      slot: "ATU24",
      displayTitle: "ATU24 Shell (Token Ultima clue)",
      storefrontDisplayTitle: "Token Ultima",
      storefrontEffectLines: [
        "Every level in any Token Upgrade provides:",
        "- x1.001 to Cells Gained.",
        "- x1.0005 to MP Gained.",
        "- x1.0003 to Shards Gained.",
        "- x1.0002 to RP Gained.",
        "- x1.0001 to AP Gained."
      ],
      storefrontBuffTargets: [
        { label: "Cells", tone: "cells", mode: "multiplier" },
        { label: "MP", tone: "mod", mode: "multiplier" },
        { label: "Shards", tone: "shard", mode: "multiplier" },
        { label: "RP", tone: "rp", mode: "multiplier" },
        { label: "AP", tone: "ap", mode: "multiplier" }
      ],
      storefrontBuffDisplayMode: "runtime-unresolved",
      identity: "Token Ultima",
      identitySource: "Late-shelf title clue",
      rowType: "prefab-driven",
      rowTypeLabel: "Late-shelf compatibility row",
      startCostField: "ATU24StartCost",
      bonusField: "ATU24Bonus3",
      bonusFields: ["ATU24Bonus1", "ATU24Bonus2", "ATU24Bonus3", "ATU24Bonus4", "ATU24Bonus5"],
      bonusStepLabel: "Late shelf composite bonus lane",
      bonusStepMode: "multi",
      costFormulaType: "start-only",
      note: "Late-shelf compatibility row using DB-derived TokenShop extract numerics; the current build grounds the first-purchase ATU24 start cost plus five separate bonus lanes, but not a reusable additive-cost or max-level formula."
    },
    {
      field: "ATU25Level",
      slot: "ATU25",
      displayTitle: "ATU25 Shell (Daily Tokens T4 clue)",
      storefrontDisplayTitle: "Daily Tokens T4",
      storefrontEffectText: "+50% to Tokens Gained from Daily Rewards & Events (additive).",
      storefrontBuffTargets: [{ label: "Daily Tokens", tone: "token" }],
      identity: "Daily Tokens T4",
      identitySource: "Late-shelf title clue",
      rowType: "prefab-driven",
      rowTypeLabel: "Late-shelf compatibility row",
      startCostField: "ATU25StartCost",
      additiveCostField: "ATU25AdditiveCost",
      bonusField: "ATU25Bonus",
      maxLevelField: "ATU25MaxLevel",
      costFormulaConfidence: "projected",
      bonusStepLabel: "Tokens Gained from Daily Rewards & Events",
      bonusStepMode: "additive",
      bonusValueDisplayMode: "percent-total-multiplier",
      note: "Late-shelf compatibility row using DB-derived TokenShop extract numerics; the visible shelf title clue aligns this shell with a Daily Tokens T4 lane, but the exact shell-to-title join and runtime cost formula are still unresolved."
    },
    {
      field: "ATU26Level",
      slot: "ATU26",
      displayTitle: "ATU26 Shell (Tier 1 Max Level Increaser clue)",
      storefrontDisplayTitle: "Tier 1 Max Level Increaser",
      storefrontEffectText: "+1000 Max Levels to Tier 1 Upgrades (Some Upgrades Excluded).",
      storefrontBuffTargets: [{ label: "Tier 1 Upgrades", tone: "uplift" }],
      identity: "Tier 1 Max Level Increaser",
      identitySource: "Late-shelf title clue",
      rowType: "prefab-driven",
      rowTypeLabel: "Late-shelf compatibility row",
      startCostField: "ATU26StartCost",
      additiveCostField: "ATU26AdditiveCost",
      bonusField: "ATU26Bonus",
      maxLevelField: "ATU26MaxLevel",
      costFormulaConfidence: "projected",
      bonusStepLabel: "Tier 1 Max Levels",
      bonusStepMode: "additive",
      note: "Late-shelf compatibility row using DB-derived TokenShop extract numerics; the visible shelf clue suggests a Tier 1 max-level lane, but the exact shell-to-title join and runtime cost formula remain unresolved, so the extracted linear projection is not treated as a verified next-buy cost."
    },
    {
      field: "ATU27Level",
      slot: "ATU27",
      displayTitle: "ATU27 Shell (Tier 2 Max Level Increaser clue)",
      storefrontDisplayTitle: "Tier 2 Max Level Increaser",
      storefrontEffectText: "+500 Max Levels to Tier 2 Upgrades (Some Upgrades Excluded).",
      storefrontBuffTargets: [{ label: "Tier 2 Upgrades", tone: "uplift" }],
      identity: "Tier 2 Max Level Increaser",
      identitySource: "Late-shelf title clue",
      rowType: "prefab-driven",
      rowTypeLabel: "Late-shelf compatibility row",
      startCostField: "ATU27StartCost",
      additiveCostField: "ATU27AdditiveCost",
      bonusField: "ATU27Bonus",
      maxLevelField: "ATU27MaxLevel",
      costFormulaConfidence: "projected",
      bonusStepLabel: "Tier 2 Max Levels",
      bonusStepMode: "additive",
      note: "Late-shelf compatibility row using DB-derived TokenShop extract numerics; the visible shelf clue suggests a Tier 2 max-level lane, but the exact shell-to-title join and runtime cost formula remain unresolved, so the extracted linear projection is not treated as a verified next-buy cost."
    },
    {
      field: "ATU28Level",
      slot: "ATU28",
      displayTitle: "ATU28 Shell (Tier 3 Max Level Increaser clue)",
      storefrontDisplayTitle: "Tier 3 Max Level Increaser",
      storefrontEffectText: "+500 Max Levels to Tier 3 Upgrades (Some Upgrades Excluded).",
      storefrontBuffTargets: [{ label: "Tier 3 Upgrades", tone: "uplift" }],
      identity: "Tier 3 Max Level Increaser",
      identitySource: "Late-shelf title clue",
      rowType: "prefab-driven",
      rowTypeLabel: "Late-shelf compatibility row",
      startCostField: "ATU28StartCost",
      additiveCostField: "ATU28AdditiveCost",
      bonusField: "ATU28Bonus",
      maxLevelField: "ATU28MaxLevel",
      costFormulaConfidence: "projected",
      bonusStepLabel: "Tier 3 Max Levels",
      bonusStepMode: "additive",
      note: "Late-shelf compatibility row using DB-derived TokenShop extract numerics; the visible shelf clue suggests a Tier 3 max-level lane, but the exact shell-to-title join and runtime cost formula remain unresolved, so the extracted linear projection is not treated as a verified next-buy cost."
    }
  ];
  return rows.map((row) => dbRowDetailResolver.apply(row));
}

function getTokenShopGroundedSubsetPreviewSummary(boundary, tokenShopState) {
  const resolvedTokenShopState =
    tokenShopState && typeof tokenShopState === "object" ? tokenShopState : {};
  const rows = getTokenShopGroundedSubsetDefinitions(boundary).map((row) => ({
    label: row?.rowDetail?.isGrounded
      ? `${row.dbMetadataSourceLabel || row.contractSourceLabel || "DB-backed TokenShop mechanics"} with compatibility level import: ${row.identity} (${row.slot})`
      : `Compatibility-only subset level: ${row.identity} (${row.slot})`,
    value: resolvedTokenShopState[row.field],
    path: `compatibility.unmappedSystemState.tokenShop.${row.field}`,
    note: row.note
  }));

  return {
    rows,
    importedCount: rows.filter((row) => isBoundaryValuePresent(row.value)).length,
    quarantineNote:
      "Compatibility imports remain the level source here, but generic mechanics now render grounded TokenShop row detail first and contracts only add DB-backed subject metadata when present. Remaining `ATU*Level` rows stay quarantined under `compatibility.unmappedSystemState.tokenShop` until more grounded row identities clear."
  };
}

function getTokenShopProgressionModel() {
  const spendSystem = getCurrentSpendSystemView();
  const tokenShop = spendSystem?.tokenShop;
  return buildTokenShopProgressionModel({
    progressionState: getTokenShopProgressionProfileState(),
    compatibilityLevels: getCompatibilityProfileState().unmappedSystems?.tokenShop ?? {},
    boundary: tokenShop?.rows?.boundaries?.remap,
    tokenShop: tokenShop?.rows?.extract,
    currentTokens: state.playerProfile.player.resources.tokens,
    getGroundedSubsetDefinitions: getTokenShopGroundedSubsetDefinitions,
    getKnownMaxStatus: tokenShopUi.getTokenShopKnownMaxStatus,
    getCurrentVsNextBonusSummary: tokenShopUi.getTokenShopCurrentVsNextBonusSummary
  });
}

function getTokenShopTierUnlockSummary(summary) {
  const tierUnlocks =
    getCurrentSpendSystemView()?.tokenShop?.rows?.policy?.tierUnlocks?.tierUnlocks;
  const thresholds = tierUnlocks?.tier_thresholds || {};
  const levelMap = Object.fromEntries(summary.rows.map((row) => [row.field, row.currentLevel]));
  return {
    thresholds,
    states: calculateTokenShopTierUnlockStates(thresholds, levelMap)
  };
}

function getTokenShopTierThresholdLabel(tierKey, thresholds) {
  if (tierKey === "t1") {
    return "Available from the first TokenShop tier.";
  }
  const fallbackThresholds = {
    t2: 25,
    t3: 50,
    t4: 100,
    t5: 150
  };
  const threshold = thresholds?.[tierKey]?.min_levels || fallbackThresholds[tierKey] || 0;
  return `Heuristic unlock threshold: ${formatBoundaryValue(threshold)} total prior-tier levels.`;
}

function getTokenShopRowCoverageSummary(rows) {
  const normalizedRows = Array.isArray(rows) ? rows : [];
  const isCompatibilityMapped = (row) =>
    /compatibility-mapped/i.test(String(row?.identitySource || "").trim()) ||
    /compatibility row/i.test(String(row?.rowTypeLabel || "").trim()) ||
    /compatibility-mapped/i.test(String(row?.note || "").trim());

  const exactCount = normalizedRows.filter(
    (row) =>
      row?.rowDetail?.isGrounded === true && !row?.blockedInputReason && !isCompatibilityMapped(row)
  ).length;
  const boundedCount =
    normalizedRows.filter((row) => {
      if (isCompatibilityMapped(row)) {
        return false;
      }
      if (row?.rowDetail?.isGrounded === true && row?.blockedInputReason) {
        return true;
      }
      return Boolean(row?.subjectId);
    }).length - exactCount;
  const compatibilityCount = normalizedRows.filter(isCompatibilityMapped).length;

  return {
    exactCount,
    boundedCount: Math.max(0, boundedCount),
    compatibilityCount
  };
}

function getTokenShopTierRecommendationModel(summary, tierRows, tierUnlocked) {
  const spendSystem = getCurrentSpendSystemView();
  const progressionModel = spendSystem?.progressionModel || null;
  const activeObjective =
    progressionModel?.objectiveModes?.find(
      (mode) => mode.id === "objective:token-shop-short-run"
    ) || null;
  const { states, thresholds } = getTokenShopTierUnlockSummary(summary);
  if (!tierUnlocked) {
    return {
      blockedReason: "Tier is still gated by the current checked threshold policy.",
      nextBest: null,
      ranked: []
    };
  }
  if (typeof summary?.currentTokens !== "number" || !Number.isFinite(summary.currentTokens)) {
    return {
      blockedReason: "Tokens are missing from the profile, so no grounded purchase can be applied.",
      nextBest: null,
      ranked: []
    };
  }
  const upgradeList = (Array.isArray(tierRows) ? tierRows : [])
    .filter((row) => !row?.isMaxed && typeof row?.currentLevel === "number")
    .map((row) => ({
      row: {
        ...row,
        storeTier: getTokenShopTierForField(row.field)
      },
      currentLevel: row.currentLevel
    }));
  const analysis = getFullUpgradeAnalysis(upgradeList, summary.currentTokens, {
    progressionModel,
    objectiveId: "objective:token-shop-short-run",
    tierStates: states,
    tierThresholds: thresholds,
    tierLevelsRemaining: getTokenShopTierLevelsRemaining(summary, thresholds)
  });
  const ranked = (analysis?.ranked || []).map((entry) => ({
    ...entry,
    row: tierRows.find((row) => row.field === entry.rowId) || null
  }));
  return {
    activeObjective,
    blockedReason: ranked.length
      ? ""
      : "No affordable grounded next level is currently available in this tier.",
    nextBest: ranked[0] || null,
    ranked
  };
}

function getTokenShopTierLevelsRemaining(summary, thresholds) {
  const levelByField = Object.fromEntries(
    (summary?.rows || []).map((row) => [row.field, row.currentLevel])
  );
  const totalForTier = (tierKey) =>
    (TOKEN_SHOP_TIER_CONFIG[tierKey]?.rows || []).reduce((sum, field) => {
      const value = levelByField[field];
      return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
    }, 0);
  const t1Total = totalForTier("t1");
  const t2Total = totalForTier("t2");
  const t3Total = totalForTier("t3");
  return {
    t2: Math.max(0, (thresholds?.t2?.min_levels || 25) - t1Total),
    t3: Math.max(0, (thresholds?.t3?.min_levels || 50) - (t1Total + t2Total)),
    t4: Math.max(0, (thresholds?.t4?.min_levels || 100) - (t1Total + t2Total + t3Total))
  };
}

function getTokenShopStorefrontRecommendationModel(summary) {
  const spendSystem = getCurrentSpendSystemView();
  const progressionModel = spendSystem?.progressionModel || null;
  const activeObjective =
    progressionModel?.objectiveModes?.find(
      (mode) => mode.id === "objective:token-shop-short-run"
    ) || null;
  const { states, thresholds } = getTokenShopTierUnlockSummary(summary);
  if (typeof summary?.currentTokens !== "number" || !Number.isFinite(summary.currentTokens)) {
    return {
      blockedReason:
        "Tokens are missing from the profile, so no grounded recommendation can be applied.",
      nextBest: null,
      ranked: [],
      states
    };
  }
  const unlockedRows = (summary?.rows || []).filter((row) => {
    const tierKey = getTokenShopTierForField(row?.field);
    return tierKey === "t1" || states[tierKey];
  });
  const upgradeList = unlockedRows
    .filter((row) => !row?.isMaxed && typeof row?.currentLevel === "number")
    .map((row) => ({
      row: {
        ...row,
        storeTier: getTokenShopTierForField(row.field)
      },
      currentLevel: row.currentLevel
    }));
  const analysis = getFullUpgradeAnalysis(upgradeList, summary.currentTokens, {
    progressionModel,
    objectiveId: "objective:token-shop-short-run",
    tierStates: states,
    tierThresholds: thresholds,
    tierLevelsRemaining: getTokenShopTierLevelsRemaining(summary, thresholds)
  });
  const ranked = (analysis?.ranked || []).map((entry) => ({
    ...entry,
    row: unlockedRows.find((row) => row.field === entry.rowId) || null
  }));
  return {
    activeObjective,
    blockedReason: ranked.length
      ? ""
      : "No affordable grounded next level is currently available in the visible unlocked store tiers.",
    nextBest: ranked[0] || null,
    ranked,
    states
  };
}

function formatTokenShopRecommendationScore(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }
  return value >= 0.1 ? value.toFixed(2) : value.toFixed(4);
}

function applyTokenShopRecommendedPurchase(rowField) {
  const summary = getTokenShopProgressionModel();
  const { states } = getTokenShopTierUnlockSummary(summary);
  const row = summary.rows.find((entry) => entry.field === rowField);
  if (!row) {
    return;
  }
  const tierKey = getTokenShopTierForField(rowField);
  if (tierKey !== "t1" && !states[tierKey]) {
    setStatus(
      "profileStatus",
      `${TOKEN_SHOP_TIER_CONFIG[tierKey].label} is still gated.`,
      "warning"
    );
    return;
  }
  if (row.isMaxed) {
    setStatus(
      "profileStatus",
      `${getTokenShopRowLabel(row)} is already at its known cap.`,
      "warning"
    );
    return;
  }
  if (typeof row.nextKnownCost !== "number" || !Number.isFinite(row.nextKnownCost)) {
    setStatus(
      "profileStatus",
      `No grounded next cost is available for ${getTokenShopRowLabel(row)}.`,
      "warning"
    );
    return;
  }
  const currentTokens = summary.currentTokens;
  if (typeof currentTokens !== "number" || currentTokens < row.nextKnownCost) {
    setStatus(
      "profileStatus",
      `${getTokenShopRowLabel(row)} needs ${formatBoundaryValue(row.nextKnownCost)} Tokens.`,
      "warning"
    );
    return;
  }

  setProfileValue(
    ["planning", "tokenShop", "checkedSubsetPlayerState", row.field],
    row.currentLevel + 1,
    state.playerProfile
  );
  setProfileValue(
    ["player", "resources", "tokens"],
    currentTokens - row.nextKnownCost,
    state.playerProfile
  );
  persistPlayerProfile();
  fillProfileForm();
  renderAll();
  setStatus(
    "profileStatus",
    `Applied ${getTokenShopRowLabel(row)} -> level ${formatBoundaryValue(row.currentLevel + 1)} for ${formatBoundaryValue(row.nextKnownCost)} Tokens.`,
    "success"
  );
}

function renderTokenShopStorefrontRow(row, summary, tierKey, tierUnlocked, recommendation) {
  const displayTitle = getTokenShopRowLabel(row);
  const rowMeta = getTokenShopRowMeta(row?.field);
  const isLateShelfRow = rowMeta?.storeShell === "late-shelf";
  const runtimeUnresolvedBuffs =
    String(row?.storefrontBuffDisplayMode || "").trim() === "runtime-unresolved";
  const runtimeUnresolvedCap =
    String(row?.storefrontCapDisplayMode || "").trim() === "runtime-unresolved" ||
    (runtimeUnresolvedBuffs &&
      typeof row.currentLevel === "number" &&
      typeof row.maxLevel === "number" &&
      Number.isFinite(row.currentLevel) &&
      Number.isFinite(row.maxLevel) &&
      row.currentLevel > row.maxLevel);
  const displayMaxLevel = runtimeUnresolvedCap ? null : row.maxLevel;
  const displayIsMaxed = runtimeUnresolvedCap ? false : row.isMaxed;
  const displayMaxStatusLabel = runtimeUnresolvedCap
    ? "Waiting on grounded max-level coverage."
    : row.maxStatus.label;
  const currentLevelLabel = formatBoundaryValue(row.currentLevel);
  const capLabel =
    typeof displayMaxLevel === "number" && Number.isFinite(displayMaxLevel)
      ? formatBoundaryValue(displayMaxLevel)
      : "n/a";
  const effectLine = tokenShopUi.formatTokenShopSentence(
    tokenShopUi.formatTokenShopEffectLine(row)
  );
  const storefrontEffectLines = tokenShopUi.getTokenShopStorefrontEffectLines(row);
  const effectLineHtml = renderTokenShopEffectLineHtml(effectLine);
  const effectLinesMarkup = storefrontEffectLines.length
    ? storefrontEffectLines
        .map(
          (line, index) =>
            `<p class="token-shop-effect-line${index > 0 ? " token-shop-effect-line-secondary" : ""}${String(line).trim().startsWith("-") ? " token-shop-effect-line-bullet" : ""}">${renderTokenShopEffectLineHtml(
              tokenShopUi.formatTokenShopSentence(line)
            )}</p>`
        )
        .join("")
    : `<p class="token-shop-effect-line">${effectLineHtml}</p>`;
  const playerFacingSupportText = tokenShopUi.getTokenShopPlayerFacingSupportText(row);
  const bonusStripEntries = tokenShopUi.getTokenShopBonusStripEntries(row);
  const groundingSummary = tokenShopUi.getTokenShopRowGroundingSummary(row);
  const contractMetaLine = tokenShopUi.getTokenShopContractMetaLine(row);
  const nextKnownCostLabel = displayIsMaxed
    ? "No next cost within known cap"
    : typeof row.nextKnownCost === "number"
      ? formatBoundaryValue(row.nextKnownCost)
      : "Research";
  const affordabilityLine = displayIsMaxed
    ? "No next purchase within known cap."
    : row.isAffordable === true
      ? "Affordable from current Tokens."
      : row.isAffordable === false &&
          typeof row.nextKnownCost === "number" &&
          typeof summary.currentTokens === "number"
        ? `${formatBoundaryValue(row.nextKnownCost - summary.currentTokens)} more Tokens needed.`
        : typeof row.nextKnownCost === "number"
          ? "Tokens unavailable in checked profile."
          : "Waiting on grounded runtime cost coverage.";
  const costFormulaLine =
    typeof row.costFormulaLabel === "string" && row.costFormulaLabel
      ? row.costFormulaLabel
      : typeof row.startCost === "number" && typeof row.additiveCost === "number"
        ? `Known cost inputs: start ${formatBoundaryValue(row.startCost)} + additive ${formatBoundaryValue(row.additiveCost)} x current level.`
        : "Known cost inputs are incomplete in this build.";
  const actionLabel = tierUnlocked
    ? displayIsMaxed
      ? "MAXED"
      : typeof row.nextKnownCost === "number"
        ? "NEXT"
        : "RESEARCH"
    : "LOCKED";
  const tierGateLine = tierUnlocked
    ? `${TOKEN_SHOP_TIER_CONFIG[tierKey]?.label || tierKey.toUpperCase()} is currently available under the checked tier policy.`
    : `${TOKEN_SHOP_TIER_CONFIG[tierKey]?.label || tierKey.toUpperCase()} remains gated by the checked heuristic tier policy.`;
  const isRecommended = recommendation?.nextBest?.rowId === row.field;
  const canPurchase =
    tierUnlocked && !displayIsMaxed && row.isAffordable && typeof row.nextKnownCost === "number";
  const isResearchPanel =
    tierUnlocked && !displayIsMaxed && !canPurchase && typeof row.nextKnownCost !== "number";
  const buyPanelAttrs = canPurchase
    ? ` data-token-shop-apply-row="${escapeHtml(row.field)}" role="button" tabindex="0" aria-label="${escapeHtml(`Buy ${displayTitle} next level`)}"`
    : "";
  const requirementOverlay = !tierUnlocked
    ? `<div class="token-shop-overlay-ribbon"><span class="token-shop-overlay-label">LOCKED</span><p>${escapeHtml(getTokenShopTierThresholdLabel(tierKey, getTokenShopTierUnlockSummary(summary).thresholds))}</p></div>`
    : displayIsMaxed
      ? `<div class="token-shop-overlay-ribbon maxed"><span class="token-shop-overlay-label">MAXED</span><p>${escapeHtml(displayMaxStatusLabel)}</p></div>`
      : "";
  const buffStrip = bonusStripEntries.length
    ? `
      <div class="token-shop-buff-strip${bonusStripEntries.length === 1 ? " single-lane" : ""}" aria-label="Current upgrade buffs" style="grid-template-columns:repeat(${Math.max(1, bonusStripEntries.length)}, minmax(0, 1fr));">
        ${bonusStripEntries
          .map(
            (entry) => `
              <div class="token-shop-buff-plate${entry.isCollapsedResearch ? " is-collapsed-research" : ""}" data-tone="${escapeHtml(entry.tone || "neutral")}">
                <strong class="token-shop-buff-value">${escapeHtml(entry.currentLabel)}</strong>
                <span class="token-shop-buff-label">${escapeHtml(entry.label)}</span>
              </div>
            `
          )
          .join("")}
      </div>
    `
    : "";
  const buyPanelBody = displayIsMaxed
    ? `
      <span class="token-shop-buy-star" aria-hidden="true">★</span>
      <span class="token-shop-buy-label">MAXED</span>
    `
    : isResearchPanel
      ? `
      <span class="token-shop-buy-label">RESEARCH</span>
      <strong>Unresolved</strong>
      <span class="token-shop-buy-hint">${escapeHtml(affordabilityLine)}</span>
    `
      : `
      <span class="token-shop-buy-label">${escapeHtml(canPurchase ? "BUY" : actionLabel)}</span>
      <strong>${escapeHtml(nextKnownCostLabel)}</strong>
      ${canPurchase ? `<span class="token-shop-buy-cta">${escapeHtml(isRecommended ? "BEST PICK" : "AVAILABLE")}</span>` : `<span class="token-shop-buy-hint">${escapeHtml(tierUnlocked ? affordabilityLine : tierGateLine)}</span>`}
    `;

  return `
    <article class="preview-card token-shop-affordability-card${isRecommended ? " recommended" : ""}${isLateShelfRow ? " late-shelf" : ""}">
      <div class="token-shop-shell-card">
        ${requirementOverlay}
        <div class="token-shop-title-box">
          <strong>${escapeHtml(displayTitle)}</strong>
        </div>
        <div class="token-shop-shell-content">
          ${effectLinesMarkup}
          ${buffStrip}
        </div>
        <div class="token-shop-progress-cluster">
          <div class="token-shop-level-ring">
            <span class="token-shop-level-caption">LV</span>
            <span class="token-shop-level-value">${escapeHtml(currentLevelLabel)}</span>
            <span class="token-shop-level-divider">/</span>
            <span class="token-shop-level-cap">${escapeHtml(capLabel)}</span>
          </div>
        <div class="token-shop-fill-track">
          <div class="token-shop-fill-track-rail"></div>
          <div class="token-shop-fill-track-core" style="width:${escapeHtml(String(Math.max(8, Math.min(100, typeof displayMaxLevel === "number" && displayMaxLevel > 0 ? (row.currentLevel / displayMaxLevel) * 100 : row.currentLevel > 0 ? 18 : 8))))}%"></div>
        </div>
      </div>
        <div class="token-shop-buy-panel${displayIsMaxed ? " maxed" : ""}${canPurchase ? " actionable" : ""}${isRecommended ? " recommended" : ""}${isResearchPanel ? " is-research" : ""}"${buyPanelAttrs}>
          ${buyPanelBody}
        </div>
        <details class="token-shop-evidence-note">
          <summary>Details</summary>
          <div class="token-shop-support-strip">
            <span class="token-shop-row-tag">${escapeHtml(row.currentLevelSourceLabel)}</span>
            ${row.identitySource ? `<span class="token-shop-row-tag token-shop-row-tag-muted">${escapeHtml(row.identitySource)}</span>` : ""}
            ${isLateShelfRow ? `<span class="token-shop-row-tag token-shop-row-tag-muted">Late shelf clue lane</span>` : ""}
          </div>
          <p class="meta">${escapeHtml(groundingSummary)}</p>
          <p class="meta">${escapeHtml(costFormulaLine)}</p>
          <p class="meta">${escapeHtml(row.note)}</p>
          ${contractMetaLine ? `<p class="meta">${escapeHtml(contractMetaLine)}</p>` : ""}
          ${playerFacingSupportText ? `<p class="meta">${escapeHtml(tokenShopUi.formatTokenShopSentence(playerFacingSupportText))}</p>` : ""}
          ${row.supportingEvidenceNote ? `<p class="meta">${escapeHtml(row.supportingEvidenceNote)}</p>` : ""}
          ${row.blockedInputReason ? `<p class="meta">Blocked input: ${escapeHtml(row.blockedInputReason)}</p>` : ""}
          ${row.dbMetadataSupportLabel || row.contractSupportLabel ? `<p class="meta">Support surfaces: ${escapeHtml(row.dbMetadataSupportLabel || row.contractSupportLabel)}</p>` : ""}
        </details>
      </div>
    </article>
  `;
}

function renderTokenShopTierSection(
  tierKey,
  tierRows,
  tierUnlocked,
  thresholds,
  summary,
  storefrontRecommendation
) {
  const tierRecommendation = getTokenShopTierRecommendationModel(summary, tierRows, tierUnlocked);
  const nextBestTitle = storefrontRecommendation?.nextBest?.row
    ? getTokenShopRowLabel(storefrontRecommendation.nextBest.row)
    : "";
  const bestBuyTierKey = storefrontRecommendation?.nextBest?.row
    ? getTokenShopTierForField(storefrontRecommendation.nextBest.row.field)
    : "";
  const recommendationNote = storefrontRecommendation?.nextBest?.row
    ? bestBuyTierKey === tierKey
      ? ""
      : `Best next purchase currently lives in ${TOKEN_SHOP_TIER_CONFIG[bestBuyTierKey]?.label || "another tier"}: ${nextBestTitle}.`
    : tierRecommendation.blockedReason;
  const tierGateNote = tierUnlocked ? "" : getTokenShopTierThresholdLabel(tierKey, thresholds);
  const tierLead = recommendationNote || tierGateNote;

  return `
    <section class="token-shop-shelf-section${tierUnlocked ? "" : " locked"}">
      ${tierLead ? `<div class="token-shop-shelf-status"><p class="meta">${escapeHtml(tierLead)}</p></div>` : ""}
      <div class="token-shop-shelf-grid">
        ${tierRows.map((row) => renderTokenShopStorefrontRow(row, summary, tierKey, tierUnlocked, storefrontRecommendation)).join("")}
      </div>
    </section>
  `;
}

function getSelectedTokenShopStorefrontTier(states) {
  const requestedTier = TOKEN_SHOP_TIER_CONFIG[state.tokenShopStorefrontTier]
    ? state.tokenShopStorefrontTier
    : "t1";
  if (requestedTier === "t1" || states?.[requestedTier]) {
    return requestedTier;
  }
  return "t1";
}

function renderTokenShopStorefrontTierTabs(states, tierRows) {
  const selectedTier = getSelectedTokenShopStorefrontTier(states);
  return `
    <div class="tier-tabs token-shop-storefront-tabs" role="tablist" aria-label="TokenShop tiers">
      ${TOKEN_SHOP_TIER_SEQUENCE.map((tierKey) => {
        const tierConfig = TOKEN_SHOP_TIER_CONFIG[tierKey];
        const isActive = selectedTier === tierKey;
        const isLocked = tierKey !== "t1" && !states?.[tierKey];
        const tierOrdinal = tierConfig.label.replace(/[^0-9]/g, "") || tierConfig.label;
        const tabLabel = `${tierConfig.label}${isLocked ? " locked" : ""}, ${tierConfig.rows.length} visible rows`;
        return `
          <button
            type="button"
            class="tier-tab${isActive ? " active" : ""}${isLocked ? " disabled" : ""}"
            data-token-shop-tier="${escapeHtml(tierKey)}"
            role="tab"
            aria-selected="${isActive}"
            aria-disabled="${isLocked}"
            aria-label="${escapeHtml(tabLabel)}"
            ${isLocked ? 'title="Locked by current heuristic tier threshold"' : ""}
          >
            <span class="token-shop-tier-index">${escapeHtml(tierOrdinal)}</span>
            <span class="token-shop-tier-count">${escapeHtml(String(tierConfig.rows.length))}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function sortTokenShopTierRows(tierKey, rows) {
  const configuredOrder = TOKEN_SHOP_TIER_CONFIG[tierKey]?.rows || [];
  const indexByField = new Map(configuredOrder.map((field, index) => [field, index]));
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const leftIndex = indexByField.has(left?.field)
      ? indexByField.get(left.field)
      : Number.MAX_SAFE_INTEGER;
    const rightIndex = indexByField.has(right?.field)
      ? indexByField.get(right.field)
      : Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return String(left?.field || "").localeCompare(String(right?.field || ""));
  });
}

function renderTokenShopProgressionEditor() {
  const summary = getTokenShopProgressionModel();
  const freshness = getSystemFreshnessSummary("token-shop");
  const { thresholds, states } = getTokenShopTierUnlockSummary(summary);
  const storefrontRecommendation = getTokenShopStorefrontRecommendationModel(summary);
  const coverageSummary = getTokenShopRowCoverageSummary(summary.rows);
  const recommendedCost = storefrontRecommendation.nextBest?.cost;
  const currentTokens = typeof summary.currentTokens === "number" ? summary.currentTokens : null;
  const bankProgressPercent =
    typeof currentTokens === "number" && typeof recommendedCost === "number" && recommendedCost > 0
      ? Math.max(0, Math.min(100, (currentTokens / recommendedCost) * 100))
      : typeof currentTokens === "number" && currentTokens > 0
        ? 100
        : 0;
  const bankMeterMeta =
    typeof currentTokens === "number" && typeof recommendedCost === "number"
      ? `${formatBoundaryValue(currentTokens)} / ${formatBoundaryValue(recommendedCost)} Tokens toward the current recommendation`
      : typeof currentTokens === "number"
        ? `${formatBoundaryValue(currentTokens)} Tokens available in the checked profile`
        : "Tokens unavailable in the checked profile";
  const tierRows = Object.fromEntries(
    TOKEN_SHOP_TIER_SEQUENCE.map((tierKey) => [
      tierKey,
      sortTokenShopTierRows(
        tierKey,
        summary.rows.filter((row) => getTokenShopTierForField(row.field) === tierKey)
      )
    ])
  );
  const selectedTier = getSelectedTokenShopStorefrontTier(states);

  return `
    <section class="token-shop-bank-shell">
      <header class="token-shop-bank-header">
        <div class="token-shop-bank-title">
          <strong>THE TOKEN BANK</strong>
          <div class="token-shop-bank-meter" aria-label="Current bank progress toward the recommended purchase">
            <div class="token-shop-bank-meter-track">
              <div class="token-shop-bank-meter-fill" style="width:${escapeHtml(String(bankProgressPercent))}%"></div>
            </div>
            <p class="meta">${escapeHtml(bankMeterMeta)}</p>
          </div>
        </div>
        <div class="token-shop-bank-hero">
          <span class="token-shop-bank-hero-label">Best Buy</span>
          <strong>${escapeHtml(storefrontRecommendation.nextBest?.row ? getTokenShopRowLabel(storefrontRecommendation.nextBest.row) : "No grounded next buy")}</strong>
          <p class="meta">${escapeHtml(storefrontRecommendation.nextBest?.row ? `${formatBoundaryValue(storefrontRecommendation.nextBest.cost)} Tokens` : storefrontRecommendation.blockedReason)}</p>
        </div>
      </header>
      <div class="token-shop-bank-status">
        <span class="pill">${typeof summary.currentTokens === "number" ? `${formatBoundaryValue(summary.currentTokens)} Tokens` : "Tokens unavailable"}</span>
        <span class="pill">${summary.playerStateCount}/${summary.rows.length} active • ${coverageSummary.boundedCount}/${summary.rows.length} bounded</span>
        <span class="pill">Source: ${escapeHtml(freshness.source)}${freshness.dbBundleLoaded ? " + DB bundle" : ""}</span>
        <span class="pill">DB ${escapeHtml(formatUiDateTime(freshness.dbBuiltAt) || "not loaded")}</span>
      </div>
      ${renderTokenShopStorefrontTierTabs(states, tierRows)}
      <div class="token-shop-store-list">
        ${renderTokenShopTierSection(
          selectedTier,
          tierRows[selectedTier],
          states[selectedTier],
          thresholds,
          summary,
          storefrontRecommendation
        )}
      </div>
      <details class="token-shop-store-details">
        <summary>Optimizer and grounding detail</summary>
        <p class="meta">Checked subset only. This TokenShop lane resolves current level from checked player state first and compatibility fallback second. Local override rows are removed from the active storefront path.</p>
        <p class="meta">Refresh status: system-unit <code>${escapeHtml(formatUiDateTime(freshness.unitBuiltAt) || "not loaded")}</code>; DB mechanics bundle <code>${escapeHtml(formatUiDateTime(freshness.dbBuiltAt) || "not loaded")}</code>. If the DB timestamp changes but rows do not, the refresh worked and the visible storefront data did not materially change.</p>
        <p class="meta">The surface stays fixed to the grounded ATU subset: T1: ATU1-12, T2: ATU13-19, T3: ATU20-23, T4: ATU24-28.</p>
        <div class="pill-row">
          <span class="pill">${summary.defaultCount}/${summary.rows.length} defaulted to level 0</span>
          <span class="pill">${coverageSummary.compatibilityCount}/${summary.rows.length} compatibility-mapped lanes</span>
          <span class="pill">${summary.knownCapCount} at or above known cap</span>
          ${storefrontRecommendation.activeObjective?.label ? `<span class="pill">Objective: ${escapeHtml(storefrontRecommendation.activeObjective.label)}</span>` : ""}
          ${storefrontRecommendation.nextBest?.progressionConfidenceLabel ? `<span class="pill">${escapeHtml(storefrontRecommendation.nextBest.progressionConfidenceLabel)} recommendation</span>` : ""}
          <span class="pill">${escapeHtml(summary.displayRule)}</span>
          <span class="pill">Manual levels live under checked player state</span>
          <span class="pill">Recommended buys stay helper-only, not canonical truth</span>
          ${storefrontRecommendation.nextBest?.row ? `<span class="pill">Weighted helper score ${escapeHtml(formatTokenShopRecommendationScore(storefrontRecommendation.nextBest.value))}</span>` : ""}
        </div>
        <p class="meta">${escapeHtml(storefrontRecommendation.nextBest?.recommendationReason || "Grounded helper weighting prefers the strongest visible progression lane per Token cost.")}</p>
        ${storefrontRecommendation.nextBest?.progressionCarrierLabel ? `<p class="meta">Current recommendation primarily targets <strong>${escapeHtml(storefrontRecommendation.nextBest.progressionCarrierLabel)}</strong> under the active spend objective.</p>` : ""}
        ${Array.isArray(storefrontRecommendation.nextBest?.progressionNotes) && storefrontRecommendation.nextBest.progressionNotes.length ? `<p class="meta">${escapeHtml(storefrontRecommendation.nextBest.progressionNotes[0])}</p>` : ""}
        <p class="meta">Prefab-driven checked rows and effect-driven checked rows are rendered as one storefront lane. The purchase plates write back into checked player state and deduct Tokens from the profile, so this behaves like a mechanics-backed optimizer without reviving the old local override editor.</p>
      </details>
    </section>
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
      <p class="meta">This is a descriptive preview of quarantined Emporium import state under <code>${escapeHtml(preview.importTargetPath)}</code>. It preserves only the checked raw <code>${escapeHtml(preview.typedSpanLabel)}</code> span from <code>${escapeHtml(preview.saveAnchor || "SaveData")}</code> as non-canonical evidence, while broader progression neighbors past <code>${escapeHtml(preview.wrapperOnlyFieldLabel || "InscryptionsDone")}</code> stay outside the admitted import slice.</p>
      <p class="meta">${preview.coverageSource ? `DB-backed multiverse coverage currently reports ${escapeHtml(preview.coverageSource)}${preview.nextSeamLabel ? ` with next seams ${escapeHtml(preview.nextSeamLabel)}` : ""}.` : "DB-backed multiverse coverage is not available for this preview."}</p>
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
      getCurrentSpendSystemView()?.tokenShop?.rows?.boundaries?.remap
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

function renderValidationCards(results) {
  if (!results.length) {
    return "";
  }

  return `
    <div class="validation-lane-cards">
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
  setStatus(
    "shipConfigStatus",
    showStatus ? "Ship planner state saved." : "Ship planner updates saved automatically.",
    "success"
  );
}

function getImportedRecordCount() {
  return ["shipLoadouts", "validationCases"].reduce(
    (total, key) => total + (Array.isArray(state.snapshot[key]) ? state.snapshot[key].length : 0),
    0
  );
}

function getGroundedShardMilestones() {
  return getCurrentShardSystemView()?.family?.grounded?.milestones?.milestones ?? [];
}

function getGroundedShardMechanics() {
  return (
    getCurrentShardSystemView()?.family?.grounded?.milestones?.canonicalMechanics
      ?.shardMilestoneSystem ?? {}
  );
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
    (getCurrentShardSystemView()?.family?.grounded?.observedBehaviors?.observations ?? []).map(
      (observation) => ({
        ...observation,
        title: getObservationTitle(observation)
      })
    )[0] ?? null
  );
}

function getObservedBehaviorById(id) {
  return (
    (getCurrentShardSystemView()?.family?.grounded?.observedBehaviors?.observations ?? []).find(
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
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const TOKEN_SHOP_EFFECT_HIGHLIGHTS = [
  { pattern: /All Generators Output/g, tone: "generator" },
  { pattern: /Mk[1-8] Output/g, tone: "generator" },
  { pattern: /MP Gained/g, tone: "mod" },
  { pattern: /Mod Points Gained/g, tone: "mod" },
  { pattern: /Diamonds Gained/g, tone: "diamond" },
  { pattern: /Tokens Gained/g, tone: "token" },
  { pattern: /Cells Gained/g, tone: "cells" },
  { pattern: /Shards Gained/g, tone: "shard" },
  { pattern: /\bRP Gained\b/g, tone: "rp" },
  { pattern: /\bAP Gained\b/g, tone: "ap" },
  { pattern: /Daily Rewards & Events/g, tone: "source" },
  { pattern: /Token & Diamond Chests/g, tone: "source" },
  { pattern: /Diamond Chests/g, tone: "diamond" },
  { pattern: /Token Chests/g, tone: "token" },
  { pattern: /Mod Points|MP\b/g, tone: "mod" },
  { pattern: /Diamonds?/g, tone: "diamond" },
  { pattern: /Tokens?/g, tone: "token" },
  { pattern: /Cells?/g, tone: "cells" },
  { pattern: /Shards?/g, tone: "shard" },
  { pattern: /\bRP\b/g, tone: "rp" },
  { pattern: /\bAP\b/g, tone: "ap" },
  { pattern: /Output/g, tone: "generator" }
];

function replaceTokenShopEffectTextNodes(html, pattern, replacer) {
  return html
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") ? part : part.replace(pattern, replacer)))
    .join("");
}

function renderTokenShopEffectLineHtml(effectLine) {
  let html = escapeHtml(effectLine);
  html = replaceTokenShopEffectTextNodes(
    html,
    /(^|[\s(])([+x-]?\d+(?:\.\d+)?%?(?:e\d+)?)(?=$|[\s).,&])/g,
    (match, prefix, value) =>
      `${prefix}<span class="token-shop-effect-key token-shop-effect-key--value">${escapeHtml(value)}</span>`
  );
  html = replaceTokenShopEffectTextNodes(
    html,
    /\((additive|multiplicative)\)/gi,
    (match) =>
      `<span class="token-shop-effect-key token-shop-effect-key--qualifier">${escapeHtml(match.toLowerCase())}</span>`
  );
  for (const { pattern, tone } of TOKEN_SHOP_EFFECT_HIGHLIGHTS) {
    html = replaceTokenShopEffectTextNodes(
      html,
      pattern,
      (match) =>
        `<span class="token-shop-effect-key token-shop-effect-key--${escapeHtml(tone)}">${escapeHtml(match)}</span>`
    );
  }
  return html
    .replace(
      /<\/span>\s+(?=<span class="token-shop-effect-key token-shop-effect-key--qualifier">)/g,
      " "
    )
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?=<span class="token-shop-effect-key")/g, "$1 ");
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
