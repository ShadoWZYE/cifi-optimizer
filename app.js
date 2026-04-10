import {
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  normalizePlayerProfile
} from "./player-profile.js";
import {
  getRecommendationContractIssues as getNormalizedRecommendationContractIssues,
  sanitizeRecommendationLines as sanitizeNormalizedRecommendationLines,
  sortRecommendationFeed as sortNormalizedRecommendationFeed,
  toRecommendationAction as normalizeRecommendationAction
} from "./recommendation-contract.js";

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

const SHIP_FILTER_LABELS = {
  cells: "Cells (& Gen1)",
  gens: "Gens (2-8)",
  mp: "Mods",
  shards: "Shards",
  rp: "Rp",
  ap: "Ap",
  materials: "Mats"
};

const CI_SUFFIX_EXPONENTS = {
  k: 3,
  m: 6,
  b: 9,
  t: 12,
  qa: 15,
  qi: 18,
  sx: 21,
  sp: 24,
  oc: 27,
  no: 30,
  dc: 33
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

  const [snapshot, datasetContract, shipBaseline, groundedShardMilestones, groundedShardObservedBehaviors, groundedShardProvenance, shardAssetGrounding, shardOwnerFamilyBoundary, shardFinalSuBonusBoundary, shardMilestonePayloadBoundary, shardCostModelBoundary, shardMilestoneRowModelBoundary, shardMilestoneTitleEffectBoundary, shardEffectTextHandlerBoundary, shardMilestoneRowShellBoundary, shardMilestoneRowAlignmentBoundary, shardSaveBoundary, shardSceneMonoBehaviourProbe, shardCostParameterProbe, shardCostNativeProbe, shardBonusSlotProbe, extractionCandidateRanking, tokenShopValues, multiverseMarketValues, multiverseMarketMetadataNeighborhood, tokeniumNamingClues, tokenBankStateClues, dailyTokeniumLaneClues, tokenBankFormulaBoundary, multiverseMarketRangeBoundary, multiverseMarketRowTextCoverage, multiverseMarketPrefabRemapBoundary, tokenShopCostLanes, spendActionLaneClues, multiverseMarketActionShell, multiverseMarketOwnerFamily, tokenShopOwnerShell, tokenShopSaveBoundary, multiverseMarketSaveBoundary, multiverseMarketMarketMemberBoundary, tokenBankControllerShell] = await Promise.all([
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
    fetchJson("./data/token-bank-controller-shell.json")
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
    bonusSlotProbe: shardBonusSlotProbe
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
    tokenBankControllerShell
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
  session.events = new EventSource(`${SERVER_SESSION_ENDPOINTS.events}?clientId=${encodeURIComponent(session.id)}`);
  session.events.addEventListener("ready", (event) => {
    const payload = parseServerEvent(event);
    if (!payload) {
      return;
    }
    session.launchSignalSequence = Number(payload.launchSignalSequence || session.launchSignalSequence || 0);
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
    navigator.sendBeacon(SERVER_SESSION_ENDPOINTS.close, new Blob([payload], { type: "application/json" }));
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
  return (Date.now() - Number(lease.updatedAt)) <= APP_LAUNCH_STALE_MS ? lease : null;
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
  state.playerProfile = normalizePlayerProfile(storedPlayerProfile, createDefaultShipPlayerState(state.shipBaseline));
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
    primaryFarmingFocus: state.playerProfile.externalModels.experimental.profileHints.primaryFarmingFocus,
    researchHours: state.playerProfile.externalModels.experimental.profileHints.researchHours
  };
}

function getCompatibilityProfileState() {
  return {
    legacyStage: state.playerProfile.compatibility.legacyStage,
    unresolved: state.playerProfile.compatibility.unresolvedProfileFields,
    unmappedSystems: state.playerProfile.compatibility.unmappedSystemState
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
        installs: INSTALL_DATA[shipKey] ?? shipData.caps.map((_, index) => ({
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
      Object.entries(baseline.shipInstalls).map(([shipKey, shipData]) => [shipKey, [...shipData.current]])
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
          Array.isArray(stored.ships?.[shipKey]) ? stored.ships[shipKey].map((value) => Number(value) || 0) : [...values]
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
    if (value && typeof value === "object" && !Array.isArray(value) && output[key] && typeof output[key] === "object") {
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
    state.playerProfile = normalizePlayerProfile(createDefaultPlayerProfile(), createDefaultShipPlayerState(state.shipBaseline));
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
    setStatus("playerProfileImportStatus", `Loaded ${file.name}. Review the JSON, then import it.`, "success");
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
      shipPlayerState[group][field] = typeof current === "boolean" ? input.checked : coerceInputValue(input.value);
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
    const focusButton = event.target.closest("[data-shard-focus-id]");
    if (focusButton) {
      const milestoneId = focusButton.dataset.shardFocusId || null;
      const levelField = focusButton.closest(".shard-milestone-card")?.querySelector("[data-shard-focus-level]");
      const milestoneLevel = coerceInputValue(levelField?.value ?? "");
      saveShardPlannerInputs(milestoneId, milestoneLevel);
    }
  });
  $("#progressionResults").addEventListener("toggle", (event) => {
    const card = event.target.closest("[data-shard-milestone-card]");
    if (card) {
      syncShardMilestoneOpenState(card.dataset.shardMilestoneCard, card.open);
    }
  }, true);
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
  $("#runGemOptimizer").addEventListener("click", () => renderGemResults(runGemOptimization()));
  $("#runValidationSuite").addEventListener("click", renderValidationResults);
  $("#saveShipConfigBtn").addEventListener("click", () => {
    persistShipConfig();
    setStatus("shipConfigStatus", "Community-tool ship planner weights and loadouts saved.", "success");
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
  const completion = getProfileCompletion(state.playerProfile);
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
  $("#profileCompletionValue").textContent = `${getProfileCompletion(state.playerProfile)}%`;
  $("#importedRecordsValue").textContent = String(getImportedRecordCount());
  const validation = runValidationCases();
  const mvpValidation = validation.filter((item) => item.scope === "MVP");
  const apkValidation = validation.filter((item) => item.scope === "APK");
  const supportValidation = validation.filter((item) => item.scope === "Support");
  const recommendationFeed = getActiveMvpRecommendationFeed();
  const recommendationFeedSupport = getActiveMvpRecommendationFeedSupport();
  $("#validationStatusValue").textContent = `${mvpValidation.filter((item) => item.pass).length}/${mvpValidation.length}`;
  $("#overviewHighlights").innerHTML = [
    renderRecommendationFeedSummary(recommendationFeed, "overview"),
    renderRecommendationFeedSupportNotice(recommendationFeedSupport, "overview"),
    ...recommendationFeed.slice(0, 3).map((item) => makeRecommendationCard(item, item.module === "loop" ? "warning" : item.module)),
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
        const fieldClass = groupKey === "innovation" ? "mini-field mini-field-toggle" : "mini-field";
        return `<label class="${fieldClass}"><span>${displayLabel}</span><input data-ship-group="${groupKey}" data-ship-field="${fieldKey}" type="checkbox" ${value ? "checked" : ""}></label>`;
        }
      return `<label class="mini-field"><span>${displayLabel}</span><input data-ship-group="${groupKey}" data-ship-field="${fieldKey}" type="number" step="any" value="${value}"></label>`;
      }).join("");

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

  $("#sourceRegistry").innerHTML = records.map((record) => `
    <article class="validation-card ${record.detail.includes("Reference") ? "pass" : "warn"}">
      <strong>${record.title}</strong>
      <p class="validation-status">${record.meta}</p>
      <p class="meta">${record.detail}</p>
    </article>
  `).join("");
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
          ${Object.entries(state.shipConfig.weights).map(([key, value]) => `
            <label class="mini-field">
            <span>${key}</span>
            <input data-weight-key="${key}" type="number" step="any" value="${value}">
          </label>
          `).join("")}
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
    const loadoutButtons = state.shipConfig.loadouts.map((loadout, index) => `
      <button class="segment-button ${index === state.shipConfig.activeLoadoutIndex ? "is-active" : ""}" data-loadout-index="${index}">
        ${loadout.name}
      </button>
  `).join("");

    const tapButtons = [1, 5, 10, "MAX"].map((value) => `
      <button class="segment-button ${value === state.shipConfig.pointPerTap ? "is-active" : ""}" data-tap-value="${value}">
        ${value === "MAX" ? "MAX" : `x${value}`}
      </button>
    `).join("");

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
      state.shipConfig.pointPerTap = button.dataset.tapValue === "MAX" ? "MAX" : Number(button.dataset.tapValue);
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
          ${Object.entries(SHIP_LABELS).map(([shipKey, label]) => `
            <button class="ship-chip ship-theme-${shipKey} ${shipKey === state.shipConfig.selectedShipKey ? "is-active" : ""}" data-ship-key="${shipKey}">
              ${label}
          </button>
        `).join("")}
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
      const bestInstall = getBestNextInstall(shipKey);
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
          ${installLayout.map((row, rowIndex) => `
            <div class="install-row install-row-${rowIndex + 1}">
                ${row.map((index) => {
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
                    ${available && !isCapped
                      ? `<div class="effect-line-stack">${getDisplayEffectTypes(effectTypes).map((effectType) => `<span class="effect-line effect-${effectType}">${valueLabel}</span>`).join("")}</div>`
                      : `<span class="effect-line effect-${primaryEffect}">${valueLabel}</span>`}
                      ${isBest ? `<span class="pill">Next best +${bestInstall.delta}</span>` : ""}
                  </button>
              `;
            }).join("")}
            </div>
          `).join("")}
        </div>
        <div class="ship-filter-strip">
          <div class="ship-filter-head">
            <span class="snapshot-title">Resource filters</span>
            <p class="meta">Disable resource lanes to avoid those installs. With <code>softCap</code> on, filtered installs stay available only when they outperform by a large margin.</p>
          </div>
          <div class="ship-filter-grid">
              ${Object.entries(SHIP_FILTER_LABELS).map(([key, label]) => `
                <button class="filter-chip effect-${key} ${active.filters[key] ? "is-active" : "is-muted"}" data-filter-key="${key}">
                  <span class="filter-dot"></span>
                  <span>${label}</span>
                </button>
              `).join("")}
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
    const bestInstall = getBestNextInstall(state.shipConfig.selectedShipKey);
    const shipRankings = rankShipTargets();
    const leadCard = bestInstall ? {
      title: `Next best install: ${bestInstall.indexes.map((index) => state.shipTemplates[state.shipConfig.selectedShipKey].installs[index].name).join(" | ")}`,
      subtitle: SHIP_LABELS[state.shipConfig.selectedShipKey],
      score: bestInstall.score,
      confidence: 0.58,
      notes: `Adds ${bestInstall.delta} point(s) on ${state.shipConfig.loadouts[state.shipConfig.activeLoadoutIndex].name}.`
  } : null;

  $("#shipResults").innerHTML = `
    ${renderSupportSurfaceNotice(
      "Canonical ship system, provisional implementation",
      [
        "These cards represent a real ship system, but the current implementation still uses community-tool calibration and provisional labels.",
        "Treat the ship output as canonical-domain planning with external-model wiring still being remapped."
      ]
    )}
    ${[leadCard, ...shipRankings.slice(0, 3)].filter(Boolean).map((item) => makeRecommendationCard(item, "ship")).join("")}
  `;
}

function renderProgressionResults(results) {
  const recommendationFeedPartition = getProgressionRecommendationFeedPartition(results);
  const recommendationFeed = recommendationFeedPartition.valid;
  const recommendationFeedSupport = recommendationFeedPartition.invalid;
  const subsystemFeed = getProgressionSubsystemPartition(recommendationFeed);
  const selectedSubsystem = getSelectedProgressionSubsystem();
  renderShardPlannerControls();
  renderProgressionSubsystemToggle(subsystemFeed);
  const sectionMarkup = {
    shards: renderShardSubsystemSection(subsystemFeed.shards),
    loop: renderProgressionSubsystemSection(
      "Loop Prestige",
      "Loop reset guardrails",
      "These cards stay warning-oriented. They are pacing and anti-bricking notes around Loop Prestige, not reset optimizers.",
      subsystemFeed.loop,
      "warning"
    )
  };
  $("#progressionResults").innerHTML = `
    ${renderRecommendationFeedSummary(recommendationFeed, "progression")}
    ${renderRecommendationFeedSupportNotice(recommendationFeedSupport, "progression")}
    ${sectionMarkup[selectedSubsystem]}
  `;
}

function renderShardSubsystemSection(items) {
  const cards = (Array.isArray(items) ? items : []).map((item) => makeRecommendationCard(item, "shards")).join("");
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
    boundaryNotes.push("Gem-node rankings are using a zero planner budget until you enter an experimental gem-node budget in PlayerProfile JSON.");
  }
  if (legacyGemDust != null) {
    boundaryNotes.push(`Legacy gemDust is preserved under compatibility (${formatOptionalNumber(legacyGemDust)}) and is not used as active planner budget.`);
  }

  $("#gemResults").innerHTML = `
    ${renderSupportSurfaceNotice(
      "Experimental gem results",
      [
        "Gem-node rankings remain an experimental support surface outside the grounded MVP path.",
        "Use them only as labeled helper output, not as verified CIFI recommendation truth."
      ]
    )}
    ${boundaryNotes.length ? `
      <article class="validation-card warn">
        <strong>Experimental budget boundary</strong>
        ${boundaryNotes.map((note) => `<p class="meta">${escapeHtml(note)}</p>`).join("")}
      </article>
    ` : ""}
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
  const multiverseMarketMetadataNeighborhood = state.extractedMechanics?.multiverseMarketMetadataNeighborhood;
  const dailyTokeniumLaneClues = state.extractedMechanics?.dailyTokeniumLaneClues;
  const tokenBankFormulaBoundary = state.extractedMechanics?.tokenBankFormulaBoundary;
  const multiverseMarketRangeBoundary = state.extractedMechanics?.multiverseMarketRangeBoundary;
  const multiverseMarketRowTextCoverage = state.extractedMechanics?.multiverseMarketRowTextCoverage;
  const multiverseMarketPrefabRemapBoundary = state.extractedMechanics?.multiverseMarketPrefabRemapBoundary;
  if (!multiverseMarket && !multiverseMarketMetadataNeighborhood) {
    return "";
  }

  const summary = getMultiverseMarketMetadataSummary(multiverseMarketMetadataNeighborhood);
  const validatedCoverage = getMultiverseMarketValidatedCoverage(multiverseMarket);
  const dailyTokeniumSummary = getDailyTokeniumLaneSummary(dailyTokeniumLaneClues);
  const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(tokenBankFormulaBoundary);
  const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(multiverseMarketRangeBoundary);
  const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(multiverseMarketRowTextCoverage);
  const multiverseMarketPrefabRemapSummary = getMultiverseMarketPrefabRemapBoundarySummary(multiverseMarketPrefabRemapBoundary);
  const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(state.extractedMechanics?.multiverseMarketOwnerFamily);
  const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(state.extractedMechanics?.multiverseMarketMarketMemberBoundary);
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
        ${nextSteps.length
          ? `<ul class="research-step-list">${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>`
          : `<p class="meta">No active remaining work. This card stays here only as delivered foundation context for later roadmap slices.</p>`}
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
      <p class="meta">${escapeHtml(state.researchView === "archived"
        ? "Archived research foundations will appear here when the repo keeps delivered context cards in the snapshot."
        : "No open research cards match the current filter. Switch to Archived to review delivered foundation context.")}</p>
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
  const contract = state.snapshot ? {
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
  } : null;

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
  const spendTrack = state.snapshot?.researchTracks?.find((track) => track.id === "spend-planner-first-ui-slice");
  const emporiumTrack = state.snapshot?.researchTracks?.find((track) => track.id === "spend-multiverse-savedata-import-surface");
  const tokenShop = state.extractedMechanics?.tokenShop ?? {};
  const multiverseMarket = state.extractedMechanics?.multiverseMarket ?? {};
  const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(state.extractedMechanics?.multiverseMarketMarketMemberBoundary);
  const resourceIcons = Array.isArray(tokenShop.resource_icons) ? tokenShop.resource_icons : [];
  const importedMarketState = compatibility.unmappedSystems?.multiverseMarket;
  const importedMarketPreview = getImportedMultiverseMarketPreview(
    importedMarketState,
    multiverseMarket,
    state.extractedMechanics?.multiverseMarketRangeBoundary
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
      label: "Banked tokens (stored amount)",
      value: compatibility.unmappedSystems?.tokenShop?.BankedTokens,
      path: "compatibility.unmappedSystemState.tokenShop.BankedTokens",
      note: "Exact SaveData.BankedTokens recovery grounds the current stored token-bank amount as boundary-backed state only. Cap and claimable planning stay blocked."
    }
  ];
  const blockedInputs = [
    {
      label: "TokenShop current row levels",
      reason: "Blocked until the recovered raw TokenShop ATU row levels are remapped onto grounded row identities. The save-side owner is now recovered, but canonical planner use is still blocked."
    },
    {
      label: "Token-bank cap and claimable tokens",
      reason: "Blocked even with BankedTokens recovered. Current TokenShop and FinalTokenBank clues still do not name planner-safe cap or claimable saved values."
    },
    {
      label: "Daily Tokenium current amount or cap",
      reason: "Blocked until the Academy or Farm Mission save owner is recovered. The lane is grounded, but the saved reward state is still unresolved."
    },
    {
      label: "Emporium owned progression and Inscryptions balance",
      reason: "Blocked for planner use. The app may show a compatibility-only preview of the raw IS1Level through IS110Level span plus separate bounded trade-counter and early-mech quarantine ranges, but InscryptionsDone remains wrapper-only, the preview stays non-canonical, and no Emporium recommendation path is unlocked."
    }
  ];
  const nextSteps = Array.isArray(spendTrack?.nextSteps) ? spendTrack.nextSteps.slice(0, 3) : [];

  return `
    <article class="validation-card warn">
      <strong>Spend planner first slice</strong>
      <p class="validation-status">Bounded preview only. This panel separates grounded canonical inputs, evidence-backed boundary inputs, and blocked planner inputs while owner recovery and remap work remain unresolved.</p>
      <div class="meta-stack">
        <p class="snapshot-title">Grounded canonical inputs available now</p>
        <ul class="research-step-list">${canonicalInputs.map((input) => `<li>${escapeHtml(input.label)}: ${isBoundaryValuePresent(input.value) ? escapeHtml(formatBoundaryValue(input.value)) : "Not entered yet"} <code>${escapeHtml(input.path)}</code>. ${escapeHtml(input.note)}</li>`).join("")}</ul>
      </div>
      <div class="meta-stack">
        <p class="snapshot-title">Evidence-backed boundary inputs available now</p>
        <ul class="research-step-list">${boundaryBackedInputs.map((input) => `<li>${escapeHtml(input.label)}: ${isBoundaryValuePresent(input.value) ? escapeHtml(formatBoundaryValue(input.value)) : "Not imported yet"} <code>${escapeHtml(input.path)}</code>. ${escapeHtml(input.note)}</li>`).join("")}</ul>
      </div>
      <div class="meta-stack">
        <p class="snapshot-title">Blocked inputs and unavailable planner actions</p>
        <ul class="research-step-list">${blockedInputs.map((input) => `<li>${escapeHtml(input.label)}: ${escapeHtml(input.reason)}</li>`).join("")}</ul>
      </div>
      <div class="meta-stack">
        <p class="snapshot-title">Active Emporium import-surface decision</p>
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
      ${nextSteps.length ? `<div class="meta-stack"><p class="snapshot-title">Current lane next steps</p><ul class="research-step-list">${nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul></div>` : ""}
      <div class="pill-row">
        <span class="pill">${canonicalInputs.filter((input) => isBoundaryValuePresent(input.value)).length}/${canonicalInputs.length} canonical inputs entered</span>
        <span class="pill">${boundaryBackedInputs.filter((input) => isBoundaryValuePresent(input.value)).length}/${boundaryBackedInputs.length} boundary-backed inputs imported</span>
        <span class="pill">${blockedInputs.length} blocked inputs surfaced</span>
        <span class="pill">Canonical boundary preserved</span>
        <span class="pill">Boundary-backed evidence labeled</span>
        <span class="pill">Uncertainty visible</span>
        <span class="pill">No spend recommendations yet</span>
      </div>
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

function getResearchTrackOrder(track) {
  const order = [
    "data-contracts-and-apk-pipeline",
    "playerprofile-boundary-and-imports",
    "shard-milestone-payload-recovery",
    "shards-and-loop-guardrails",
    "unified-feed-and-hardening",
    "spend-planner-first-ui-slice",
    "spend-multiverse-savedata-import-surface",
    "spend-multiverse-save-model-recovery",
    "hunter-related-planning",
    "mech-related-planning",
    "input-automation-intake",
    "external-model-integration-intake"
  ];
  const index = order.indexOf(track.id);
  return index === -1 ? order.length : index;
}

function getResearchTrackSequenceLabel(track) {
  const labelsById = {
    "data-contracts-and-apk-pipeline": "Sequence 1/5",
    "playerprofile-boundary-and-imports": "Sequence 1/5",
    "shard-milestone-payload-recovery": "Sequence 2/5",
    "shards-and-loop-guardrails": "Sequence 2/5",
    "unified-feed-and-hardening": "Sequence 3/5",
    "spend-planner-first-ui-slice": "Sequence 4/5",
    "spend-multiverse-savedata-import-surface": "Sequence 4/5",
    "spend-multiverse-save-model-recovery": "Sequence 4/5",
    "hunter-related-planning": "Research intake",
    "mech-related-planning": "Research intake",
    "input-automation-intake": "Research intake",
    "external-model-integration-intake": "Research intake"
  };
  return labelsById[track.id] || "Research";
}

function renderResearchTrackProgress(track) {
  const completedSteps = Array.isArray(track.completedSteps) ? track.completedSteps : [];
  const remainingSteps = Array.isArray(track.nextSteps) ? track.nextSteps : [];
  const totalSteps = completedSteps.length + remainingSteps.length;
  const percent = totalSteps ? Math.round((completedSteps.length / totalSteps) * 100) : 0;

  return `
    <div class="meta-stack">
      <p class="snapshot-title">Track status</p>
      <p class="meta">${escapeHtml(track.currentSlice || "Current slice not recorded yet.")}</p>
      <p class="meta">${escapeHtml(getResearchTrackSequenceLabel(track))} | ${escapeHtml(getResearchTrackPhase(track))}</p>
      <p class="meta">${completedSteps.length} done | ${remainingSteps.length} left | ${percent}% complete</p>
      ${completedSteps.length ? `<div class="meta-stack"><p class="snapshot-title">Done in repo</p><ul class="research-step-list">${completedSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul></div>` : ""}
    </div>
  `;
}

function renderResearchTrackContract(track) {
  const sources = Array.isArray(track.sources) ? track.sources : [];
  const artifacts = Array.isArray(track.artifacts) ? track.artifacts : [];
  const verified = Array.isArray(track.verified) ? track.verified : [];
  const uncertain = Array.isArray(track.uncertain) ? track.uncertain : [];
  const metaBits = [
    track.classification ? `<span class="pill">${escapeHtml(track.classification)}</span>` : "",
    track.category ? `<span class="pill">${escapeHtml(track.category)}</span>` : "",
    track.implementationRelevance ? `<span class="pill">${escapeHtml(track.implementationRelevance)}</span>` : "",
    typeof track.apkUnityPathChecked === "boolean"
      ? `<span class="pill">${escapeHtml(track.apkUnityPathChecked ? "APK/Unity first" : "APK/Unity not yet checked")}</span>`
      : ""
  ].filter(Boolean);

  if (
    !metaBits.length
    && !track.exitCondition
    && !track.blockedBy
    && !track.smallestShippableSlice
    && !sources.length
    && !artifacts.length
    && !verified.length
    && !uncertain.length
  ) {
    return "";
  }

  return `
    ${metaBits.length ? `<div class="pill-row">${metaBits.join("")}</div>` : ""}
    ${track.exitCondition ? `<div class="meta-stack"><p class="snapshot-title">Exit condition</p><p class="meta">${escapeHtml(track.exitCondition)}</p></div>` : ""}
    ${track.blockedBy ? `<div class="meta-stack"><p class="snapshot-title">Current blocker</p><p class="meta">${escapeHtml(track.blockedBy)}</p></div>` : ""}
    ${track.smallestShippableSlice ? `<div class="meta-stack"><p class="snapshot-title">Smallest shippable slice</p><p class="meta">${escapeHtml(track.smallestShippableSlice)}</p></div>` : ""}
    ${sources.length ? `<div class="meta-stack"><p class="snapshot-title">Sources</p><ul class="research-step-list">${sources.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${artifacts.length ? `<div class="meta-stack"><p class="snapshot-title">Repo artifacts</p><ul class="research-step-list">${artifacts.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${verified.length ? `<div class="meta-stack"><p class="snapshot-title">Verified now</p><ul class="research-step-list">${verified.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
    ${uncertain.length ? `<div class="meta-stack"><p class="snapshot-title">Still uncertain</p><ul class="research-step-list">${uncertain.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>` : ""}
  `;
}

function renderResearchTrackSupport(track) {
  if (track.id === "shards-and-loop-guardrails" || track.id === "shard-milestone-payload-recovery") {
    const ownerBoundary = getShardOwnerFamilyBoundarySummary(state.shardGrounding?.ownerFamilyBoundary);
    const finalSuBoundary = getShardFinalSuBonusBoundarySummary(state.shardGrounding?.finalSuBonusBoundary);
    const payloadBoundary = getShardMilestonePayloadBoundarySummary(state.shardGrounding?.milestonePayloadBoundary);
    const costModelBoundary = getShardCostModelBoundarySummary(state.shardGrounding?.costModelBoundary);
    const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(state.shardGrounding?.rowModelBoundary);
    const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(state.shardGrounding?.titleEffectBoundary);
    const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(state.shardGrounding?.effectTextHandlerBoundary);
    const rowShellBoundary = getShardMilestoneRowShellBoundarySummary(state.shardGrounding?.milestoneRowShellBoundary);
    const rowAlignmentBoundary = getShardMilestoneRowAlignmentBoundarySummary(state.shardGrounding?.milestoneRowAlignmentBoundary);
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
        <p class="meta">${saveBoundary.hasSeparationBoundary ? "That keeps shard owner-family narrowing and save-side recovery as separate tasks, so the app should not infer player-owned shard milestone state from the current owner trail yet." : "The current build does not yet preserve a clean shard save-boundary separation."}</p>
        <p class="meta">This improves the shard mapping gate, but it still does not recover player-owned shard milestone rows, player-facing labels, or planner-safe affordability inputs.</p>
      </div>
    `;
  }

  if (track.id === "spend-multiverse-savedata-import-surface") {
    const tokenShopCoverage = getTokenShopCoverageSummary(state.extractedMechanics?.tokenShop);
    const validatedCoverage = getMultiverseMarketValidatedCoverage(state.extractedMechanics?.multiverseMarket);
    const metadataSummary = getMultiverseMarketMetadataSummary(state.extractedMechanics?.multiverseMarketMetadataNeighborhood);
    const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(state.extractedMechanics?.multiverseMarketMarketMemberBoundary);
    const tokeniumNamingSummary = getTokeniumNamingSummary(state.extractedMechanics?.tokeniumNamingClues);
    const tokenBankStateSummary = getTokenBankStateSummary(state.extractedMechanics?.tokenBankStateClues);
    const dailyTokeniumSummary = getDailyTokeniumLaneSummary(state.extractedMechanics?.dailyTokeniumLaneClues);
    const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(state.extractedMechanics?.tokenBankFormulaBoundary);
    const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(state.extractedMechanics?.multiverseMarketRangeBoundary);
    const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(state.extractedMechanics?.multiverseMarketRowTextCoverage);
    const tokenShopCostLaneSummary = getTokenShopCostLaneSummary(state.extractedMechanics?.tokenShopCostLanes);
    const spendActionLaneSummary = getSpendActionLaneSummary(state.extractedMechanics?.spendActionLaneClues);
    const multiverseMarketActionShellSummary = getMultiverseMarketActionShellSummary(state.extractedMechanics?.multiverseMarketActionShell);
    const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(state.extractedMechanics?.multiverseMarketOwnerFamily);
    const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(state.extractedMechanics?.tokenShopOwnerShell);
    const tokenShopSaveBoundarySummary = getTokenShopSaveBoundarySummary(state.extractedMechanics?.tokenShopSaveBoundary);
    const multiverseMarketSaveBoundarySummary = getMultiverseMarketSaveBoundarySummary(state.extractedMechanics?.multiverseMarketSaveBoundary);
    const tokenBankControllerShellSummary = getTokenBankControllerShellSummary(state.extractedMechanics?.tokenBankControllerShell);
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
    const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(state.extractedMechanics?.tokenShopOwnerShell);
    const tokenShopSaveBoundarySummary = getTokenShopSaveBoundarySummary(state.extractedMechanics?.tokenShopSaveBoundary);
    const tokenBankControllerShellSummary = getTokenBankControllerShellSummary(state.extractedMechanics?.tokenBankControllerShell);
    const tokenBankStateSummary = getTokenBankStateSummary(state.extractedMechanics?.tokenBankStateClues);
    const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(state.extractedMechanics?.tokenBankFormulaBoundary);
    return `
      <div class="meta-stack">
        <p class="snapshot-title">Current owner narrowing</p>
        <p class="meta">${tokenShopOwnerShellSummary.hasOwnerShell ? `TokenShop owner-shell clues preserve ${tokenShopOwnerShellSummary.ownerAnchor}, ${tokenShopOwnerShellSummary.bankMethod}, ${tokenShopOwnerShellSummary.notificationHook}, and ${tokenShopOwnerShellSummary.deviceHook} as one local controller cluster.` : "TokenShop owner-shell clues are not available in this build."}</p>
        <p class="meta">${tokenShopSaveBoundarySummary.hasSeparationBoundary ? `The checked save boundary keeps ${tokenShopSaveBoundarySummary.ownerAnchor} separate from ${tokenShopSaveBoundarySummary.saveAnchor}, with ${tokenShopSaveBoundarySummary.overlapLabel}.` : "TokenShop save-boundary clues are not available in this build."}</p>
        <p class="meta">${tokenBankControllerShellSummary.hasControllerShell ? `The checked token-bank controller shell also preserves ${tokenBankControllerShellSummary.claimMethod}, ${tokenBankControllerShellSummary.fillMethod}, ${tokenBankControllerShellSummary.fillField}, ${tokenBankControllerShellSummary.descriptionShell}, and ${tokenBankControllerShellSummary.notificationHook}.` : "Token-bank controller-shell clues are not available in this build."}</p>
        <p class="meta">${tokenBankStateSummary.hasControllerSplit ? `Separate display and presentation clues such as ${tokenBankStateSummary.displayShell} and ${tokenBankStateSummary.loopHook} are still preserved beside controller methods like ${tokenBankStateSummary.capMethod}.` : "Token-bank controller or display split clues are not available in this build."}</p>
        <p class="meta">${tokenBankFormulaSummary.hasDerivedOutputBoundary ? `The derived-output cluster still preserves ${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField}.` : "Token-bank derived-output clues are not available in this build."}</p>
        <p class="meta">${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? "That output-side cluster still has no checked PlayerProfileData or CloudSavePlayerProfile join, so FinalTokenBank outputs remain non-owner clues rather than recovered saved-state fields." : "The checked derived-output cluster now overlaps the broader save-family search and needs review."}</p>
        <p class="meta">${tokenShopSaveBoundarySummary.hasSeparationBoundary && tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? "The remaining grounded save-side search therefore stays on the broader PlayerProfileData and CloudSavePlayerProfile persistence-family boundary, not on TokenShop methods, BigStatisticPrefab.TokenBankCap, or FinalTokenBank outputs." : "The current build does not yet preserve a grounded negative owner narrowing for the token-bank save-state lane."}</p>
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

function getResearchTrackLane(track) {
  if (track.status === "archived") {
    return "Foundation archive";
  }
  if (track.status === "active") {
    return "Active roadmap slice";
  }
  return "Queued behind mapping gate";
}

function getResearchTrackStatus(track) {
  const statusById = {
    active: "Active",
    queued: "Queued after gate",
    research: "In research",
    archived: "Archived"
  };
  return statusById[track.status] || "Queued after gate";
}

function getResearchTrackProgressLabel(track) {
  const completedSteps = Array.isArray(track.completedSteps) ? track.completedSteps.length : 0;
  const remainingSteps = Array.isArray(track.nextSteps) ? track.nextSteps.length : 0;
  const totalSteps = completedSteps + remainingSteps;
  return `${completedSteps}/${totalSteps} done`;
}

function getResearchTrackPhase(track) {
  const phaseById = {
    "data-contracts-and-apk-pipeline": "PR 1",
    "playerprofile-boundary-and-imports": "PR 1",
    "shard-milestone-payload-recovery": "PR 2 successor",
    "shards-and-loop-guardrails": "PR 2",
    "unified-feed-and-hardening": "PR 3 then PR 5 hardening",
    "spend-planner-first-ui-slice": "PR 6 prep slice",
    "spend-multiverse-savedata-import-surface": "PR 4 successor",
    "spend-multiverse-save-model-recovery": "PR 4 successor",
    "hunter-related-planning": "Research intake only",
    "mech-related-planning": "Research intake only",
    "input-automation-intake": "Research intake only",
    "external-model-integration-intake": "Research intake only"
  };
  return phaseById[track.id] || "Research";
}

function getResearchTrackSource(track) {
  const sourceById = {
    "data-contracts-and-apk-pipeline": "APK/Unity first",
    "playerprofile-boundary-and-imports": "Schema boundary",
    "shard-milestone-payload-recovery": "Grounded shard data",
    "shards-and-loop-guardrails": "Grounded shard data",
    "spend-planner-first-ui-slice": "Canonical PlayerProfile spend inputs",
    "spend-multiverse-savedata-import-surface": "Extracted Emporium save-side data",
    "spend-multiverse-save-model-recovery": "Extracted Emporium save-side data",
    "unified-feed-and-hardening": "Integration contract",
    "hunter-related-planning": "Research intake",
    "mech-related-planning": "Research intake",
    "input-automation-intake": "Research intake",
    "external-model-integration-intake": "Research intake"
  };
  return sourceById[track.id] || "Research";
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
    setStatus("playerProfileImportStatus", "Paste PlayerProfile JSON or choose a file first.", "warning");
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const sourceProfile = parsed?.playerProfile ?? parsed;
    state.playerProfile = normalizePlayerProfile(sourceProfile, createDefaultShipPlayerState(state.shipBaseline));
    persistPlayerProfile();
    fillProfileForm();
    renderAll();
    setStatus("playerProfileImportStatus", "PlayerProfile JSON imported through the grounded normalizer. Review the boundary audit before using recommendations.", "success");
  } catch (error) {
    setStatus("playerProfileImportStatus", `PlayerProfile import failed: ${error.message}`, "warning");
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
  const groups = [
    {
      title: "Canonical shared truth",
      note: "Grounded account state and metadata that the shared MVP profile can treat as first-class truth.",
      items: [
        ["Profile name", canonical.profileName],
        ["Data confidence", canonical.dataConfidence],
        ["Current LR", canonical.loopReset],
        ["Diamonds", canonical.diamonds],
        ["Tokens", canonical.tokens],
        ["Current shards", canonical.shards],
        ["Profile notes", canonical.notes]
      ]
    },
    {
      title: "Import-only or aggregated profile fields",
      note: "Real profile values that are not currently direct active-form inputs because they are aggregated, derived, or not quickly readable in-game.",
      items: [
        ["Academy relics", canonical.academyRelics]
      ]
    },
    {
      title: "Planner-only helpers",
      note: "Manual helper inputs used by descriptive planners, not canonical account truth. Derived values that are not directly visible in game stay out of the active form.",
      items: [
        ["Total shard milestone levels", shardPlanner.totalMilestoneLevels],
        ["Threshold watch row", shardPlanner.focusMilestoneId],
        ["Threshold watch row level", shardPlanner.focusMilestoneLevel],
        ["Observed shard rows", Object.keys(shardPlanner.observedLevelsByMilestone ?? {}).length]
      ]
    },
    {
      title: "External-model implementation state",
      note: "Current implementation data for canonical systems that stays isolated from shared profile truth. Imports must use explicit systems.ship or externalModels.shipPlanner paths.",
      items: [
        ["Ship planner power", shipPlanner.summary.power],
        ["Ship planner speed", shipPlanner.summary.speed],
        ["Ship planner cargo", shipPlanner.summary.cargo],
        ["Ship calibration groups", Object.keys(shipPlanner.calibration || {}).length]
      ]
    },
    {
      title: "Experimental support-surface helpers",
      note: "Non-MVP experimental or prototype helpers that stay outside canonical shared truth and outside canonical-system implementation state. Loose planning and flat helper aliases are retired.",
      items: [
        ["Gem-node budget", experimental.gemNodeBudget],
        ["Primary farming focus", experimental.primaryFarmingFocus],
        ["Research hours", experimental.researchHours]
      ]
    },
    {
      title: "Compatibility leftovers",
      note: "Preserved migration values and quarantined unmapped system blobs that are not treated as active shared truth. Loose top-level compatibility aliases are retired in favor of explicit compatibility or namespaced legacy paths.",
      items: [
        ["Legacy highest ship unlocked", compatibility.legacyStage.highestShipUnlocked],
        ["Legacy manual phase", compatibility.legacyStage.manualPhase],
        ["Legacy gemDust", compatibility.unresolved.gemDust],
        ["Legacy hunter level", compatibility.unresolved.hunterLevel],
        ["Legacy trait sphere count", compatibility.unresolved.traitSphereCount],
        ["Legacy mech parts", compatibility.unresolved.mechParts],
        ["Unmapped shard milestone state", compatibility.unmappedSystems.shardMilestones],
        ["Unmapped TokenShop state", compatibility.unmappedSystems.tokenShop],
        ["Unmapped MultiverseMarket state", compatibility.unmappedSystems.multiverseMarket]
      ]
    }
  ];
  const audit = getPlayerProfileBoundaryAudit(groups, {
    shipPlanner,
    compatibility
  });
  const importedMultiverseMarketPreview = getImportedMultiverseMarketPreview(
    compatibility.unmappedSystems?.multiverseMarket,
    state.extractedMechanics?.multiverseMarket,
    state.extractedMechanics?.multiverseMarketRangeBoundary
  );

  $("#playerProfileImportSummary").innerHTML = groups.map((group) => {
    const populated = group.items.filter(([, value]) => isBoundaryValuePresent(value));
    return `
      <article class="preview-card">
        <strong>${escapeHtml(group.title)}</strong>
        <p class="meta">${escapeHtml(group.note)}</p>
        <p class="meta">${populated.length}/${group.items.length} populated</p>
        ${populated.length
          ? `<div class="meta-stack">${populated.map(([label, value]) => `<p class="meta">${escapeHtml(label)}: ${escapeHtml(formatBoundaryValue(value))}</p>`).join("")}</div>`
          : `<p class="meta">No populated fields in this namespace.</p>`}
      </article>
    `;
  }).join("");

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

function getPlayerProfileBoundaryAudit(groups, context) {
  const counts = groups.map((group) => {
    const populated = group.items.filter(([, value]) => isBoundaryValuePresent(value)).length;
    return `${group.title}: ${populated}/${group.items.length}`;
  });
  const unmappedSystemEntries = Object.entries(context.compatibility.unmappedSystems || {})
    .filter(([, value]) => isBoundaryValuePresent(value))
    .map(([key]) => key);
  const unresolvedEntries = Object.entries(context.compatibility.unresolved || {})
    .filter(([, value]) => isBoundaryValuePresent(value))
    .map(([key]) => key);
  const notes = [];

  if (unmappedSystemEntries.length) {
    notes.push(`Quarantined unmapped system blobs preserved: ${unmappedSystemEntries.join(", ")}. Keep these descriptive until owner mapping and player-owned inputs are grounded.`);
  } else {
    notes.push("No quarantined unmapped system blobs are present in this import.");
  }

  if (Object.values(context.shipPlanner.summary || {}).some((value) => isBoundaryValuePresent(value))) {
    notes.push("Ship planner values are preserved as external-model implementation state, not as canonical shared profile truth.");
  }

  if (unresolvedEntries.length) {
    notes.push(`Compatibility-only leftovers preserved: ${unresolvedEntries.join(", ")}. These remain migration sinks, not active recommendation inputs.`);
  } else {
    notes.push("No compatibility-only leftover fields were populated by this import.");
  }

  return { counts, notes };
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
  loadout.ships[shipKey][installIndex] = direction > 0
    ? Math.min(cap, current + delta)
    : Math.max(0, current - delta);
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
  return current < getEffectiveCap(template.caps[installIndex]) && getShipInstallTotal(shipKey) >= template.reserveThresholds[installIndex];
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
    const nextThreshold = template.reserveThresholds.filter((threshold) => threshold > total).sort((left, right) => left - right)[0];
    return Math.min(capRemaining, Math.max((nextThreshold ?? total) - total, 0));
  }
  const step = Number(state.shipConfig.pointPerTap) || 0;
  return direction > 0 ? Math.min(capRemaining, step) : Math.min(removable, step);
}

  function getInstallGain(shipKey, installIndex) {
    const crew = getShipCrew(shipKey);
    const baseMultiplier = getInstallBaseMultiplier(shipKey, installIndex);
    const exponent = scorePowerTerm(state.shipTemplates[shipKey].powerTerms[installIndex], state.shipConfig.weights, Number(getShipCommunityToolState().technical.Meltdown || 0));
    const currentLevel = getActiveLoadout().ships[shipKey][installIndex];
    const denom = (crew * baseMultiplier * currentLevel) + 1;
    const numer = (crew * baseMultiplier * (currentLevel + 1)) + 1;
    const rawGain = canInstallPoint(shipKey, installIndex) ? (Math.pow(numer / denom, exponent) - 1) : 0;
    const weightedGain = rawGain * getInstallWeight(shipKey, installIndex, state.shipConfig.weights);
    return { rawGain, weightedGain };
  }

  function getBestNextInstall(shipKey) {
    const active = getActiveLoadout();
    const current = active.ships[shipKey];
    const scored = current.map((_, index) => {
      if (!canInstallPoint(shipKey, index)) {
      return null;
    }
    const gain = getInstallGain(shipKey, index);
      const delta = getTapDelta(shipKey, index);
      return { index, score: gain.weightedGain * Math.max(delta, 1), rawGain: gain.rawGain, delta };
    }).filter(Boolean);

    const sorted = scored.sort((left, right) => right.score - left.score);
    const leader = sorted[0];
    if (!leader) {
      return null;
    }
    const epsilon = Math.max(Math.abs(leader.score) * 1e-9, 1e-12);
    const ties = sorted.filter((item) => Math.abs(item.score - leader.score) <= epsilon);
    return {
      ...leader,
      indexes: ties.map((item) => item.index)
    };
  }

function rankShipTargets() {
  return Object.entries(getActiveLoadout().ships).map(([shipKey, values]) => ({
    title: SHIP_LABELS[shipKey],
    subtitle: `${sum(values)} installs assigned`,
    score: values.reduce((total, value, index) => {
      const cap = getEffectiveCap(state.shipTemplates[shipKey].caps[index]);
      return total + ((value / Math.max(cap, 1)) * 100);
    }, 0),
    confidence: 0.48,
    notes: `Persistent ${getActiveLoadout().name} state.`
  })).sort((left, right) => right.score - left.score);
}

function runShipOptimization() {
  const ship = getShipPlannerState().summary;
  return [...state.snapshot.shipLoadouts].map((loadout) => ({
    title: loadout.name,
    subtitle: loadout.notes,
    score:
      (Number(ship.power || 0) * loadout.powerScale * state.snapshot.resourceGoals.credits.powerWeight) +
      (Number(ship.speed || 0) * loadout.speedScale * state.snapshot.resourceGoals.credits.speedWeight * 10) +
      (Number(ship.cargo || 0) * loadout.cargoScale * state.snapshot.resourceGoals.credits.cargoWeight) +
      (loadout.resourceBias === "credits" ? 45 : 0),
    confidence: loadout.risk === "safe" ? 0.72 : 0.61,
    notes: loadout.notes
  })).sort((left, right) => right.score - left.score);
}

function runProgressionOptimization() {
  const groundedResults = buildGroundedShardRecommendations().map((item) => toRecommendationAction(item, "shards"));
  const loopWarnings = buildLoopGuardrailRecommendations().map((item) => toRecommendationAction(item, "loop"));
  if (groundedResults.length) {
    return sortRecommendationFeed([...groundedResults, ...loopWarnings]);
  }

  return sortRecommendationFeed([toRecommendationAction({
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
  }, "shards"), ...loopWarnings]);
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
  const runCadenceSource = Array.from(new Set([
    ...getSourceTitlesForIds(earlyLoop?.sourceIds),
    ...getSourceTitlesForIds(shortRuns?.sourceIds),
    ...getSourceTitlesForIds(longRuns?.sourceIds)
  ])).join(" | ");
  const shardSpendSource = getSourceTitlesForIds(shardSpend?.sourceIds).join(" | ");

  if (!loopReset) {
    return [{
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
        antiBricking?.why || "Grounded loop guidance depends on pacing examples tied to specific LR transitions."
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
    }];
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
      shortRuns?.why || "Short MP runs are used to buy affordable loop mods and increase MP gains between resets.",
      longRuns?.why || "Longer runs shift toward shards and cells instead of only pushing fast reset count."
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
      shortRuns?.priorities?.[2] || "Use short runs to build loop mod momentum before relying on longer shard-focused sessions.",
      longRuns?.priorities?.[0] || "Long runs are a shard/cell pacing choice, not proof that immediate reset pushing is correct."
    ],
    notes: runCadenceSource
      ? `Run-cadence reference only (${runCadenceSource}).`
      : "Run-cadence reference only."
  });

  const operationTicks = mechanics?.operations?.ticks_per_operation;
  const resetTimer = mechanics?.shardMiningMenu?.unreducible_timer_between_operations?.value;
  if (operationTicks?.initial_ticks_including_reset || operationTicks?.minimum_ticks_with_loop_mods || resetTimer) {
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
      assumptions: [
        "This is a pacing boundary reminder, not a best-reset calculator."
      ],
      warnings: [
        "Do not read fast reset pushing as proof that shard-side pacing constraints disappeared.",
        "Operation timing notes are grounded reference points only; they are not personalized run advice."
      ],
      notes: "Grounded shard anchors can support loop warnings even while milestone rows remain descriptive-only."
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
        antiBricking?.why || "Guide examples warn that pushing LR too quickly can raise loop requirements faster than the account can clear them.",
        "Grounded examples show LR 5 -> 6 requiring 7 loops and LR 6 -> 7 requiring 8 loops."
      ],
      assumptions: [
        "This is a caution zone, not a target recommendation.",
        "The app does not estimate whether your account can safely push the next LR."
      ],
      warnings: [
        "Use buffer / instant loop checks before pushing LR higher.",
        zeusWarning?.priorities?.[1] || "High LR progression can become 'playing with fire' in guide-side progression notes."
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
      benefit: [
        "Protects currently tracked shard value from being wiped by the next reset."
      ],
      whyNow: [
        "Shards reset to 0 on Loop Prestige in the grounded shard sources.",
        shardSpend?.why || "Early shard guidance explicitly says to spend shards before loop resets."
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
        conflictNote || "Shard milestone sources include unresolved discrepancies that keep this workflow descriptive.",
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
        mechanics.effect_scaling?.description || "Incremental level increases milestone effects, but the app does not score them."
      ],
      warnings: [
        focusMilestone?.uncertaintyNotes?.[0] || "Unknown/Unkown source values remain preserved where the source was incomplete.",
        conflictNote || "Threshold wording stays descriptive because milestone sources conflict across accessible snapshots.",
        nextThreshold ? `You need ${Math.max(nextThreshold - focusLevel, 0)} more levels on the observed milestone row to reach this threshold.` : "Threshold watch ends here unless you inspect another row."
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
        mechanics.cost_breakpoints_observed?.breakpoints_statement || "Cost bump notes are descriptive only.",
        nextCostBump
          ? `From tracked level ${formatShardNumber(focusLevel)}, the next noted cost bump is level ${nextCostBump.level} (${nextCostBump.severity}).`
          : "No cost bump watch could be derived from the current tracked row level."
      ],
      assumptions: [
        "The dataset provides breakpoint notes, not numeric shard costs.",
        observation ? `${observation.title}: ${observation.why}` : "Observed examples are shown separately and do not become planner truth."
      ],
      warnings: [
        "Cost bumps are warning zones only; the app does not estimate shard affordability.",
        conflictNote || "Cost wording stays generic until a single authoritative milestone list and cost table exist.",
        focusMilestone?.costProgression?.notes || "No per-level shard costs were found in accessible sources."
      ],
      notes: sourceLabel
        ? `Use this to avoid false precision near known cost-bump levels (${sourceLabel}).`
        : "Use this to avoid false precision near known cost-bump levels."
    }
  ];
}

function saveShardPlannerInputs(nextMilestoneId = undefined, nextMilestoneLevel = undefined) {
  const milestoneId = nextMilestoneId !== undefined
    ? nextMilestoneId
    : formControl("shardFocusMilestoneId")?.value || null;
  const milestoneLevel = nextMilestoneLevel !== undefined
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
  setProfileValue(["planning", "shards", "focusMilestoneLevel"], milestoneLevel, state.playerProfile);
  setProfileValue(["planning", "shards", "observedLevelsByMilestone"], observedLevelsByMilestone, state.playerProfile);
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
  select.innerHTML = milestones.map((milestone) => `
    <option value="${escapeHtml(String(milestone.id))}">${escapeHtml(`${milestone.name} (${formatShardRarity(milestone.rarity)})`)}</option>
  `).join("");
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
  const ownerBoundary = getShardOwnerFamilyBoundarySummary(state.shardGrounding?.ownerFamilyBoundary);
  const costModelBoundary = getShardCostModelBoundarySummary(state.shardGrounding?.costModelBoundary);
  const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(state.shardGrounding?.rowModelBoundary);
  const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(state.shardGrounding?.titleEffectBoundary);
  const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(state.shardGrounding?.effectTextHandlerBoundary);
  const saveBoundary = getShardSaveBoundarySummary(state.shardGrounding?.saveBoundary);
  const identifiers = Array.isArray(assetGrounding?.groundedShellIdentifiers) ? assetGrounding.groundedShellIdentifiers.slice(0, 5) : [];
  const blockedUses = Array.isArray(assetGrounding?.blockedUses) ? assetGrounding.blockedUses : [];
  const descriptiveBundleStatus = getDatasetBadgeMeta("shards", "Integrated");
  const ownerBoundaryStatus = ownerBoundary.hasBoundary
    ? getDatasetBadgeMeta("shard-owner-family-boundary", "Available")
    : getShardBadgeMetaFromLabel("Unmapped");
  const costBoundaryStatus = costModelBoundary.hasSampledCostWindows
    ? getDatasetBadgeMeta("shard-cost-model-boundary", "Available")
    : getShardBadgeMetaFromLabel("Blocked");
  const rowEvidenceStatus = rowModelBoundary.hasBoundary && titleEffectBoundary.hasBoundary && effectTextHandlerBoundary.hasBoundary
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
        <strong>Recovered shard-cost evidence stays descriptive</strong>
        <div class="meta-stack">
          <p class="meta">Milestone names, unlock tables, effect lists, threshold wording, and cost evidence are shown as descriptive support, not as spend recommendations.</p>
          <p class="meta">What the grounded app can safely show today: shard watch cards, loop warnings, threshold wording, and evidence-status notes sourced from the checked shard contract.</p>
          <p class="meta">The UI does not rank spend order, ROI, ETA, or per-level affordability from this recovery path.</p>
          <p class="meta">${escapeHtml(blockedUses.length ? `${blockedUses.join(", ")} remain blocked until shard owner mapping, save-state inputs, and planner-safe cost validation are recovered.` : "Ranking, ROI, ETA, affordability, and best-upgrade claims remain blocked until shard owner mapping, save-state inputs, and planner-safe cost validation are recovered.")}</p>
          <p class="meta">Interim compatibility path: external-model imports can preserve community-tool context while staying non-canonical and outside grounded shard recommendations.</p>
          <p class="meta">Current provenance load: ${conflictCount} conflict note${conflictCount === 1 ? "" : "s"} and ${missingCount} missing-data note${missingCount === 1 ? "" : "s"}.</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card ${ownerBoundaryStatus.cardClass}">
        <div class="shard-status-heading">
          <span class="snapshot-title">Ownership mapping</span>
          <span class="shard-status-pill ${ownerBoundaryStatus.pillClass}">${escapeHtml(ownerBoundaryStatus.label)}</span>
        </div>
        <strong>Shard-specific ownership evidence is narrowed, not resolved</strong>
        <div class="meta-stack">
          <p class="meta">${ownerBoundary.hasBoundary ? "Recovered ownership clues consistently point at a shard-specific family instead of the generic milestone shell." : "The current build still lacks enough shard-specific ownership evidence to map milestone rows safely."}</p>
          <p class="meta">${ownerBoundary.hasBoundary ? "That improves confidence that the cost trail is shard-local." : "Until ownership mapping is resolved, row-level shard cost recovery stays descriptive only."}</p>
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
          <span class="snapshot-title">Row evidence coverage</span>
          <span class="shard-status-pill ${rowEvidenceStatus.pillClass}">${escapeHtml(rowEvidenceStatus.label)}</span>
        </div>
        <strong>Titles, effect lanes, and row shells feed evidence cards</strong>
        <div class="meta-stack">
          <p class="meta">${rowModelBoundary.hasBoundary ? `Recovered row shells currently cover rows ${rowModelBoundary.unlockRangeLabel}.` : "The current build does not yet preserve enough row-shell coverage for shard milestone cards."}</p>
          <p class="meta">${titleEffectBoundary.hasBoundary ? `Shipped title candidates currently cover rows ${titleEffectBoundary.titleRangeLabel}.` : "Shipped title candidates are still incomplete."}</p>
          <p class="meta">${effectTextHandlerBoundary.hasBoundary ? `Recovered effect text coverage currently spans rows ${effectTextHandlerBoundary.rowCoverageLabel}.` : "Recovered effect text coverage is still incomplete."}</p>
        </div>
      </article>
      <article class="snapshot-card shard-status-card ${saveBoundaryStatus.cardClass}">
        <div class="shard-status-heading">
          <span class="snapshot-title">Save-side mapping</span>
          <span class="shard-status-pill ${saveBoundaryStatus.pillClass}">${escapeHtml(saveBoundaryStatus.label)}</span>
        </div>
        <strong>Player-owned shard state is still not recovered</strong>
        <div class="meta-stack">
          <p class="meta">${saveBoundary.hasSeparationBoundary ? "Recovered shard-local evidence remains separated from PlayerProfile save ownership." : "The current build does not yet preserve a clean shard-to-save separation result."}</p>
          <p class="meta">${saveBoundary.hasSeparationBoundary ? "That is useful because it blocks the UI from implying imported shard milestone ownership that the contract does not support." : "Until separation is verified, shard evidence should be treated as even more provisional."}</p>
          <p class="meta">Manual inputs can guide descriptive watch cards, but they do not turn this flow into recovered save-state truth.</p>
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
            .map(([rarity, levels]) => `
              <div class="shard-threshold-card">
                <strong>${escapeHtml(rarity)}</strong>
                <p class="meta">${escapeHtml(formatThresholdLevels(levels))}</p>
              </div>
            `).join("")}
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
          ${observations.map((observation) => `
            <div class="shard-note-card">
              <strong>${escapeHtml(getObservationTitle(observation))}</strong>
              <p class="meta">${escapeHtml(observation.why || "No guide rationale captured.")}</p>
              <p class="meta">${escapeHtml((observation.priorities || []).join(" | "))}</p>
            </div>
          `).join("")}
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
      <strong>Grounding and evidence live in docs</strong>
      <p class="meta">Shard Mining keeps the player-facing workflow lightweight. Deep grounding, cost recovery, and probe detail have been moved out of the page.</p>
      <div class="shard-doc-link-list">
        ${renderShardDocLink("./docs/systems/shards/shard-player-facing-evidence.md", "Shard evidence summary")}
        ${renderShardDocLink("./docs/systems/shards/shard-grounding-boundary.md", "Grounding boundary")}
        ${renderShardDocLink("./docs/systems/shards/shard-cost-parameter-probe.md", "Cost parameter probe")}
      </div>
    </article>
  `;
}

function renderShardDocLink(href, label) {
  return `<a class="shard-doc-link" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function getBundledDatasetContractEntry(id) {
  const datasets = Array.isArray(state.datasetContract?.datasets) ? state.datasetContract.datasets : [];
  return datasets.find((entry) => entry?.id === id) || null;
}

function mapDatasetClassificationToShardStatus(classification, fallback = "Unmapped") {
  const statusByClassification = {
    "canonical-app-snapshot": "Integrated",
    "grounded-descriptive": "Integrated",
    "extracted-mechanics": "Available",
    "community-derived": "Unmapped"
  };
  return statusByClassification[classification] || fallback;
}

function getDatasetBadgeMeta(datasetId, fallbackLabel = "Unmapped") {
  const entry = getBundledDatasetContractEntry(datasetId);
  const label = mapDatasetClassificationToShardStatus(entry?.classification, fallbackLabel);
  return getShardBadgeMetaFromLabel(label, entry?.classification || null);
}

function getShardBadgeMetaFromLabel(label, classification = null) {
  return {
    label,
    cardClass: `shard-status-card-${label.toLowerCase()}`,
    pillClass: `shard-status-pill-${label.toLowerCase()}`,
    classification
  };
}

function renderShardMilestoneDirectory() {
  const mechanics = getGroundedShardMechanics();
  const milestones = getMilestonesForDisplay();
  return `
    <div class="meta-stack">
      <p class="eyebrow">Shard Mining rows</p>
      <h3>Shard milestone rows</h3>
      <p class="meta">These rows live inside Shard Mining. Each card keeps its own observed level, stays in canonical order, and focuses on player-facing row tracking rather than in-page grounding detail.</p>
      <div class="preview-stack">
${milestones.map((milestone) => {
          const trackedLevel = getShardFocusLevelForMilestone(milestone);
          const isCardOpen = isShardMilestoneOpen(milestone.id);
          const panelTitle = getShardMilestonePanelTitle(milestone);
          const displayMeta = getShardMilestoneDisplayMeta(milestone);
          const headerMeta = `${formatShardRarity(milestone.rarity)} | Unlock ${describeUnlockCondition(milestone.unlockCondition)}`;
          const thresholdSchedule = getThresholdScheduleForMilestone(milestone, mechanics);
          const hasThresholdSchedule = Array.isArray(thresholdSchedule) && thresholdSchedule.length > 0;
          const extractedBonusValues = (milestone.bonuses || [])
            .map((bonus, index) => {
              const extracted = getShardExtractedBonusPerLevel(milestone.milestoneNumber, index);
              return Number.isFinite(extracted) ? `${bonus.effectLabel || `Bonus ${index + 1}`}: ${formatShardExtractedBonusPerLevel(extracted)}` : null;
            })
            .filter(Boolean);
          const levelRailSummary = getShardMilestoneLevelRailSummary(milestone);
          const formulaProfile = getShardFormulaApplicationProfile(milestone.milestoneNumber);
          return `
          <details class="snapshot-card shard-milestone-card" data-shard-milestone-card="${escapeHtml(String(milestone.id))}" ${isCardOpen ? "open" : ""}>
            <summary class="shard-milestone-summary">
              <div class="shard-milestone-title-block">
                <span class="shard-milestone-rank">#${escapeHtml(String(milestone.milestoneNumber ?? "?"))}</span>
                <div class="shard-milestone-heading-copy">
                  <strong>${escapeHtml(panelTitle)}</strong>
                  <p class="meta">${escapeHtml(headerMeta)}</p>
                  ${displayMeta.startsWith("Community alias:")
                    ? `<p class="meta shard-milestone-alias">${escapeHtml(displayMeta)}</p>`
                    : ""}
                </div>
              </div>
              <div class="shard-milestone-summary-pills">
                <span class="pill shard-threshold-pill ${hasThresholdSchedule ? "" : "pill-neutral"}">${escapeHtml(hasThresholdSchedule ? `Thresholds ${formatThresholdLevels(thresholdSchedule)}` : "No explicit thresholds")}</span>
              </div>
            </summary>
            <div class="shard-milestone-hero">
              <div class="shard-milestone-hero-copy">
                <p class="meta">${escapeHtml(milestone.summary || "No milestone summary captured.")}</p>
                <div class="shard-milestone-facts">
                  <p class="meta"><strong>Unlock</strong> ${escapeHtml(describeUnlockCondition(milestone.unlockCondition))}</p>
                  <p class="meta"><strong>Thresholds</strong> ${escapeHtml(formatThresholdLevels(thresholdSchedule))}</p>
                  <p class="meta"><strong>Formula class</strong> ${escapeHtml(levelRailSummary.formulaLabel)}</p>
                </div>
              </div>
            </div>
            <div class="shard-milestone-main-panel">
              <div class="shard-bonus-list">
              ${(milestone.bonuses || []).map((bonus, index) => {
                const computedBonus = getShardComputedBonusSummary(milestone, bonus, trackedLevel);
                const extractedBonusPerLevel = getShardExtractedBonusPerLevel(milestone.milestoneNumber, index);
                return `
                <article class="shard-bonus-card shard-panel-card">
                  <div class="shard-panel-card-header">
                    <strong>${escapeHtml(bonus.effectLabel || "Unnamed bonus")}</strong>
                    <span class="shard-panel-card-tag">Lane ${escapeHtml(String(index + 1))}</span>
                  </div>
                  <p class="meta">Unlock level: ${bonus.unlockLevel ?? "Listed without explicit threshold"}</p>
                  <p class="meta">Initial bonus: ${escapeHtml(String(bonus.initialBonus ?? "Unknown"))}</p>
                  <p class="meta">Bonus per level: ${escapeHtml(String(bonus.bonusPerLevel ?? "Unknown"))}</p>
                  <p class="meta"><strong>Extracted bonus per level</strong> ${escapeHtml(Number.isFinite(extractedBonusPerLevel) ? formatShardExtractedBonusPerLevel(extractedBonusPerLevel) : "Not recovered in direct row payload")}</p>
                  <p class="meta"><strong>Observed value</strong> ${escapeHtml(computedBonus.currentLabel)}</p>
                  <p class="meta"><strong>Next level</strong> ${escapeHtml(computedBonus.nextLabel)}</p>
                </article>
              `;
              }).join("")}
              </div>
              <aside class="shard-level-up-rail shard-panel-card">
                <p class="snapshot-title">Level up</p>
                <label class="mini-field shard-row-focus-field shard-level-up-observed">
                  <span>Observed level</span>
                  <input data-shard-focus-level data-shard-focus-level-for="${escapeHtml(String(milestone.id))}" type="number" min="0" step="1" value="${trackedLevel ?? ""}" placeholder="0">
                </label>
                <div class="shard-level-up-summary">
                  <p class="meta"><strong>Formula class</strong> ${escapeHtml(levelRailSummary.formulaLabel)}</p>
                  <p class="meta"><strong>Stage path</strong> ${escapeHtml(levelRailSummary.stageLabel)}</p>
                  <p class="meta"><strong>Next stage</strong> ${escapeHtml(levelRailSummary.nextStageLabel)}</p>
                  ${formulaProfile ? `<p class="meta"><strong>Cost staging note</strong> ${escapeHtml(formulaProfile.summary)}</p>` : ""}
                </div>
                <p class="shard-level-up-cost">${escapeHtml(levelRailSummary.costLabel)}</p>
                <button class="button ghost shard-level-up-button" type="button" disabled>${escapeHtml(levelRailSummary.buttonLabel)}</button>
              </aside>
            </div>
          </details>
        `;
        }).join("")}
      </div>
    </div>
  `;
}

function runGemOptimization() {
  const mode = $("#gemBudgetMode")?.value ?? "strict";
  const budget = getGemPlannerBudget();
  return [...state.snapshot.gemNodes].map((node) => {
    const affordability = node.cost <= budget ? 1 : mode === "stretch" ? 0.8 : 0.35;
    return {
      title: node.label,
      subtitle: `${node.level}/${node.maxLevel}`,
      score: (node.value / node.cost) * (1 + (node.maxLevel - node.level) / node.maxLevel) * affordability,
      confidence: 0.7,
      notes: node.tags.join(" | ")
    };
  }).sort((left, right) => right.score - left.score);
}

function getGemPlannerBudget() {
  return Number(getExperimentalProfileState().gemNodeBudget || 0);
}

function runValidationCases() {
  const activeFeedContract = getRecommendationContractSummary(getActiveMvpRecommendationFeedPartition().all);
  const current = {
    ship: runShipOptimization()[0]?.title ?? "None",
    progression: runProgressionOptimization()[0]?.title ?? "None",
    recommendationFeed: activeFeedContract.invalidCount === 0
      ? "All active feed items satisfy shared recommendation contract"
      : "Contract gaps in active feed",
    gem: runGemOptimization()[0]?.title ?? "None"
  };
  const appCases = state.snapshot.validationCases.map((item) => ({
    title: item.title,
    expected: item.expected,
    actual: current[item.module],
    pass: item.expected === current[item.module],
    scope: SUPPORT_SURFACE_VALIDATION_MODULES.has(item.module) ? "Support" : "MVP"
  }));

  return [...appCases, ...buildApkGroundingValidationCases()];
}

function buildApkGroundingValidationCases() {
  const tokenShop = state.extractedMechanics?.tokenShop;
  const multiverseMarket = state.extractedMechanics?.multiverseMarket;
  const multiverseMarketMetadataNeighborhood = state.extractedMechanics?.multiverseMarketMetadataNeighborhood;
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
  const multiverseMarketMarketMemberBoundary = state.extractedMechanics?.multiverseMarketMarketMemberBoundary;
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
    const identifiers = Array.isArray(shardAssetGrounding.groundedShellIdentifiers) ? shardAssetGrounding.groundedShellIdentifiers : [];
    const hasShellEvidence = identifiers.includes("LoopResetStage1") && identifiers.includes("MilestoneBonusesPerLevel");
    cases.push({
      title: "Shard shell grounding payload",
      expected: "Grounded shard shell evidence available",
      actual: hasShellEvidence ? "Grounded shard shell evidence available" : "Missing expected shard shell anchors",
      pass: hasShellEvidence,
      scope: "APK"
    });
    cases.push({
      title: "Shard milestone mapping gate",
      expected: "Available but unmapped",
      actual: shardAssetGrounding.integrationStatus === "available-but-unmapped" ? "Available but unmapped" : "Unexpected shard integration status",
      pass: shardAssetGrounding.integrationStatus === "available-but-unmapped",
      scope: "APK"
    });
  }
  if (shardOwnerFamilyBoundary) {
    const ownerBoundary = getShardOwnerFamilyBoundarySummary(shardOwnerFamilyBoundary);
    cases.push({
      title: "Shard owner-family boundary",
      expected: "ShardMining and ShardUpgradeInfo stay narrowed while ConstructionMilestones remains downgraded",
      actual: ownerBoundary.hasBoundary && ownerBoundary.hasDowngradedGenericLead
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
      expected: "ShardUpgradeInfo preserves SU final-unlock and FinalSU bonus-field families without row mapping claims",
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
      expected: "ShardUpgradeInfo preserves milestone-total, cost-list, progress-fill, and phase-tick hooks without claiming saved player rows",
      actual: payloadBoundary.hasBoundary && payloadBoundary.hasCostAndListHooks && payloadBoundary.hasProgressFillHooks && payloadBoundary.hasTickFields
        ? `ShardUpgradeInfo preserves ${payloadBoundary.milestoneStateLabel} plus ${payloadBoundary.costAccessorLabel}`
        : "Shard milestone payload-watch boundary drifted",
      pass: payloadBoundary.hasBoundary && payloadBoundary.hasCostAndListHooks && payloadBoundary.hasProgressFillHooks && payloadBoundary.hasTickFields && payloadBoundary.hasCostAccessorSamples,
      scope: "APK"
    });
  }
  if (shardCostModelBoundary) {
    const costModelBoundary = getShardCostModelBoundarySummary(shardCostModelBoundary);
    cases.push({
      title: "Shard cost-model boundary",
      expected: "ShardUpgradeInfo preserves sampled SU cost accessors plus a row-local SU0 cost parameter shell without formula claims",
      actual: costModelBoundary.hasBoundary && costModelBoundary.hasSampledCostWindows && costModelBoundary.hasRow0FormulaShell
        ? `ShardUpgradeInfo preserves ${costModelBoundary.costWindowLabel} plus ${costModelBoundary.row0FieldLabel}`
        : "Shard cost-model boundary drifted",
      pass: costModelBoundary.hasBoundary && costModelBoundary.hasSampledCostWindows && costModelBoundary.hasRow0FormulaShell,
      scope: "APK"
    });
  }
  if (shardMilestoneRowModelBoundary) {
    const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(shardMilestoneRowModelBoundary);
    cases.push({
      title: "Shard milestone row model",
      expected: "Shard-local text-checker and unlock rows now reach 0-29 while the numbered buy seam still crosses the generic family",
      actual: rowModelBoundary.hasBoundary && rowModelBoundary.hasShardLocalBuySample && rowModelBoundary.hasGenericBuyFamily
        ? `Text ${rowModelBoundary.textCheckerRangeLabel}, unlock ${rowModelBoundary.unlockRangeLabel}, buy seam ${rowModelBoundary.shardLocalBuyLabel} vs ${rowModelBoundary.genericBuyLabel}`
        : "Shard row-model boundary drifted",
      pass: rowModelBoundary.hasBoundary && rowModelBoundary.hasShardLocalBuySample && rowModelBoundary.hasGenericBuyFamily,
      scope: "APK"
    });
  }
  if (shardMilestoneTitleEffectBoundary) {
    const titleEffectBoundary = getShardMilestoneTitleEffectBoundarySummary(shardMilestoneTitleEffectBoundary);
    cases.push({
      title: "Shard milestone titles and effect shell",
      expected: "Shipped shard title assets and effect-family clues are preserved without claiming conflict-free row text",
      actual: titleEffectBoundary.hasBoundary && titleEffectBoundary.hasEffectPresentationFamily && titleEffectBoundary.hasBonusCalcSamples
        ? `Title rows ${titleEffectBoundary.titleRangeLabel} with effect shell ${titleEffectBoundary.effectSlotLabel}`
        : "Shard title/effect boundary drifted",
      pass: titleEffectBoundary.hasBoundary && titleEffectBoundary.hasEffectPresentationFamily && titleEffectBoundary.hasBonusCalcSamples,
      scope: "APK"
    });
  }
  if (shardEffectTextHandlerBoundary) {
    const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(shardEffectTextHandlerBoundary);
    cases.push({
      title: "Shard effect-text handler boundary",
      expected: "A shard-specific bonus text handler leads over the generic milestone writer without claiming row-complete final text",
      actual: effectTextHandlerBoundary.hasBoundary && effectTextHandlerBoundary.hasPresentationFamily && effectTextHandlerBoundary.hasBonusCalcSamples && effectTextHandlerBoundary.hasUiContextAnchors
        ? `${effectTextHandlerBoundary.textHandlerLabel} aligned with ${effectTextHandlerBoundary.presentationFamilyLabel}`
        : "Shard effect-text handler boundary drifted",
      pass: effectTextHandlerBoundary.hasBoundary && effectTextHandlerBoundary.hasPresentationFamily && effectTextHandlerBoundary.hasBonusCalcSamples && effectTextHandlerBoundary.hasUiContextAnchors,
      scope: "APK"
    });
  }
  if (shardMilestoneRowShellBoundary) {
    const rowShellBoundary = getShardMilestoneRowShellBoundarySummary(shardMilestoneRowShellBoundary);
    cases.push({
      title: "Shard milestone row shell",
      expected: "ShardMining preserves partial UnlockMilestone, BuyMilestone, and MilestoneTextChecker row shell without row-owner claims",
      actual: rowShellBoundary.hasBoundary && rowShellBoundary.hasUnlockHookSamples && rowShellBoundary.hasBuyHookSamples && rowShellBoundary.hasTextCheckerSamples
        ? `ShardMining preserves ${rowShellBoundary.unlockHookLabel} plus ${rowShellBoundary.buyHookLabel} and ${rowShellBoundary.textCheckerLabel}`
        : "Shard milestone row-shell boundary drifted",
      pass: rowShellBoundary.hasBoundary && rowShellBoundary.hasUnlockHookSamples && rowShellBoundary.hasBuyHookSamples && rowShellBoundary.hasTextCheckerSamples,
      scope: "APK"
    });
  }
  if (shardMilestoneRowAlignmentBoundary) {
    const rowAlignmentBoundary = getShardMilestoneRowAlignmentBoundarySummary(shardMilestoneRowAlignmentBoundary);
    cases.push({
      title: "Shard milestone row alignment",
      expected: "Shard partial row shell keeps unlock, buy, and text-checker ranges separate until a declaring row model is recovered",
      actual: rowAlignmentBoundary.hasBoundary && rowAlignmentBoundary.hasZeroUnlockTextOverlap && rowAlignmentBoundary.hasBuyTextOverlap
        ? `Unlock ${rowAlignmentBoundary.unlockRangeLabel}, text ${rowAlignmentBoundary.textCheckerRangeLabel}, buy ${rowAlignmentBoundary.buyRangeLabel}`
        : "Shard milestone row-alignment boundary drifted",
      pass: rowAlignmentBoundary.hasBoundary && rowAlignmentBoundary.hasZeroUnlockTextOverlap && rowAlignmentBoundary.hasBuyTextOverlap,
      scope: "APK"
    });
  }
  if (shardSaveBoundary) {
    const saveBoundary = getShardSaveBoundarySummary(shardSaveBoundary);
    cases.push({
      title: "Shard save-side separation",
      expected: "Shard owner trail and PlayerProfileData save-family clues stay separate with zero overlap",
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
      actual: tokenShop.source?.level0 && numericTable.TokenBoost && numericTable.DiamondBoost
        ? "Grounded TokenShop constants available"
        : "Missing expected TokenShop constants",
      pass: Boolean(tokenShop.source?.level0 && numericTable.TokenBoost && numericTable.DiamondBoost),
      scope: "APK"
    });
    cases.push({
      title: "TokenShop extracted family coverage",
      expected: "32 numeric groups with TokenBoost, DiamondBoost, and TokenDailiesT2 plus token-bank controller anchors",
      actual: tokenShopCoverage.hasCoverage
        ? `${tokenShopCoverage.numericGroupCount} numeric groups with ${tokenShopCoverage.namedLaneLabel}${tokenShopCoverage.hasControllerAnchors ? " plus token-bank controller anchors" : " but missing token-bank controller anchors"}`
        : "Missing TokenShop extracted family coverage",
      pass:
        tokenShopCoverage.numericGroupCount === 32
        && tokenShopCoverage.hasControllerAnchors
        && tokenShopCoverage.hasNamedLanes,
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
    const validatedIds = Array.isArray(multiverseMarket.source?.validated_ids) ? multiverseMarket.source.validated_ids : [];
    const hasAnchor = records.some((record) => Number(record.inscription_id) === 51 && Number(record.start_cost) === 2);
    const validatedCoverage = getMultiverseMarketValidatedCoverage(multiverseMarket);
    cases.push({
      title: "MultiverseMarket owner payload",
      expected: "Validated late-block constants available",
      actual: hasAnchor ? "Validated late-block constants available" : "Missing validated late-block anchor",
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
    const { hasCloudSavePathClues, hasSaveFamilyClues, hasProgressionFieldCluster } = getMultiverseMarketMetadataSummary(multiverseMarketMetadataNeighborhood);
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
      expected: "Resource_Tokenium, Aca.Tokenium553, CostBox-Tokens, and CostBox-Tokenium available",
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
      expected: "TokenBoost, DiamondBoost, TokenDailiesT2, CostBox-Tokens, and CostBox-Tokenium available",
      actual: tokenShopCostLaneSummary.hasLaneSplit
        ? `${tokenShopCostLaneSummary.tokenLaneLabel}, ${tokenShopCostLaneSummary.diamondLaneLabel}, ${tokenShopCostLaneSummary.dailyLaneLabel}, ${tokenShopCostLaneSummary.tokensShellLabel}, and ${tokenShopCostLaneSummary.tokeniumShellLabel} available`
        : "Missing TokenShop cost-lane split clues",
      pass: tokenShopCostLaneSummary.hasLaneSplit && tokenShopCostLaneSummary.keepsDailyTokeniumSeparate,
      scope: "APK"
    });
  }

  if (spendActionLaneClues) {
    const spendActionLaneSummary = getSpendActionLaneSummary(spendActionLaneClues);
    cases.push({
      title: "Spend action-lane split",
      expected: "BuyTokenBoost, BuyDiamondBoost, BuyLM244, BuyCollectorDevice, and zero BuyTokenDailies hooks preserved",
      actual: spendActionLaneSummary.hasActionSplit
        ? `${spendActionLaneSummary.tokenHook}, ${spendActionLaneSummary.diamondHook}, ${spendActionLaneSummary.loopModifierHook}, ${spendActionLaneSummary.premiumModifierHook}, and zero ${spendActionLaneSummary.dailyHookT2} or ${spendActionLaneSummary.dailyHookT3} hooks preserved`
        : "Missing spend action-lane clues",
      pass: spendActionLaneSummary.hasActionSplit && spendActionLaneSummary.keepsDailyDirectHooksUnrecovered,
      scope: "APK"
    });
  }

  if (tokenShopOwnerShell) {
    const tokenShopOwnerShellSummary = getTokenShopOwnerShellSummary(tokenShopOwnerShell);
    cases.push({
      title: "TokenShop owner shell",
      expected: "TokenShop, ClaimBankedTokens, CheckTokenClaimNotification, and BuyAutoTokenClicker preserved as one local owner shell",
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
      expected: "TokenShop owner shell and PlayerProfileData save-family clues stay separate with zero overlap",
      actual: tokenShopSaveBoundarySummary.hasSeparationBoundary
        ? `${tokenShopSaveBoundarySummary.ownerAnchor} and ${tokenShopSaveBoundarySummary.saveAnchor} stay separate with ${tokenShopSaveBoundarySummary.overlapLabel}`
        : "Missing TokenShop save-boundary clues",
      pass: tokenShopSaveBoundarySummary.hasSeparationBoundary,
      scope: "APK"
    });
  }

  if (tokenBankControllerShell) {
    const tokenBankControllerShellSummary = getTokenBankControllerShellSummary(tokenBankControllerShell);
    cases.push({
      title: "Token-bank controller shell",
      expected: "ClaimBankedTokens, SetBankFill, BankFill, TokenBankDescriptionText, and CheckTokenClaimNotification preserved",
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
      expected: "ClaimBankedTokens, get_TokenBankCap, BigStatisticPrefab.TokenBankCap, and SetLM244BonusText available",
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
      expected: "SpaceAcademy, FarmMissions, SetLM244BonusText, BuyLM244, and BuyCollectorDevice available",
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
      expected: "FinalTokenBankCap and FinalTokenBankFillSpeed cluster without PlayerProfileData or CloudSavePlayerProfile joins",
      actual: tokenBankFormulaSummary.hasDerivedOutputBoundary
        ? `${tokenBankFormulaSummary.capAccessor}, ${tokenBankFormulaSummary.fillAccessor}, ${tokenBankFormulaSummary.capField}, and ${tokenBankFormulaSummary.fillField} cluster${tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext ? " without save-family joins" : " with save-family overlap"}.`
        : "Missing token-bank derived output boundary clues",
      pass: tokenBankFormulaSummary.hasDerivedOutputBoundary && tokenBankFormulaSummary.hasNoSaveJoinInDerivedContext,
      scope: "APK"
    });
  }

  if (multiverseMarketRangeBoundary) {
    const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(multiverseMarketRangeBoundary);
    cases.push({
      title: "MultiverseMarket row-range boundary",
      expected: "Validated rows 50-59 and 63-74 now share a first direct overlap with the recovered IS71-110 metadata run at rows 71-74",
      actual: multiverseMarketRangeSummary.hasOverlap
        ? `Validated rows ${multiverseMarketRangeSummary.validatedRangeLabel} now share a first direct overlap with ${multiverseMarketRangeSummary.metadataRangeLabel} at rows ${multiverseMarketRangeSummary.overlapLabel}`
        : "Missing validated-row versus metadata-run boundary",
      pass: multiverseMarketRangeSummary.hasOverlap,
      scope: "APK"
    });
  }

  if (multiverseMarketRowTextCoverage) {
    const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(multiverseMarketRowTextCoverage);
    cases.push({
      title: "MultiverseMarket validated row text coverage",
      expected: "TextHandlerMarkets and SetAllChrystosEmporiumTexts cover SetIS50-59 and 63-74 cost texts",
      actual: multiverseMarketRowTextSummary.hasValidatedTextCoverage
        ? `${multiverseMarketRowTextSummary.textHandler} and ${multiverseMarketRowTextSummary.textBatcher} cover ${multiverseMarketRowTextSummary.coveredCount} SetIS*CostText hooks for ${multiverseMarketRowTextSummary.validatedRangeLabel}`
        : "Missing validated MultiverseMarket row text coverage",
      pass: multiverseMarketRowTextSummary.hasValidatedTextCoverage && multiverseMarketRowTextSummary.hasBuyHookSamples,
      scope: "APK"
    });
  }

  if (state.extractedMechanics?.multiverseMarketPrefabRemapBoundary) {
    const multiverseMarketPrefabRemapSummary = getMultiverseMarketPrefabRemapBoundarySummary(state.extractedMechanics.multiverseMarketPrefabRemapBoundary);
    cases.push({
      title: "MultiverseMarket prefab remap boundary",
      expected: "Validated ids 69-74 still do not have direct ChrystosEmporiumUpgrade number matches",
      actual: multiverseMarketPrefabRemapSummary.hasOverrideBoundary
        ? `${multiverseMarketPrefabRemapSummary.lastDirectPrefab} is the last direct band before ${multiverseMarketPrefabRemapSummary.firstOverride} through ${multiverseMarketPrefabRemapSummary.lastOverride}`
        : "Missing MultiverseMarket prefab-remap boundary",
      pass: multiverseMarketPrefabRemapSummary.hasOverrideBoundary,
      scope: "APK"
    });
  }

  if (multiverseMarketActionShell) {
    const multiverseMarketActionShellSummary = getMultiverseMarketActionShellSummary(multiverseMarketActionShell);
    cases.push({
      title: "MultiverseMarket action shell",
      expected: "Context-derived BuyIS1-110 and SetIS1-110CostText shell preserved while only rows 50-59 and 63-74 stay validated",
      actual: multiverseMarketActionShellSummary.hasActionShell
        ? `${multiverseMarketActionShellSummary.buyRangeLabel} and ${multiverseMarketActionShellSummary.costTextRangeLabel} preserved while ${multiverseMarketActionShellSummary.validatedRangeLabel} stays validated`
        : "Missing MultiverseMarket action-shell boundary",
      pass: multiverseMarketActionShellSummary.hasActionShell,
      scope: "APK"
    });
  }

  if (multiverseMarketOwnerFamily) {
    const multiverseMarketOwnerFamilySummary = getMultiverseMarketOwnerFamilySummary(multiverseMarketOwnerFamily);
    cases.push({
      title: "MultiverseMarket owner family",
      expected: "MultiverseMarket, Inscryptions, and IS1-110 CurrencyBox shell preserved without implying saved-state ownership",
      actual: multiverseMarketOwnerFamilySummary.hasOwnerFamily
        ? `${multiverseMarketOwnerFamilySummary.ownerAnchor}, ${multiverseMarketOwnerFamilySummary.inscryptionsLabel}, and ${multiverseMarketOwnerFamilySummary.currencyRangeLabel} preserved with ${multiverseMarketOwnerFamilySummary.firstValidatedCurrencyBox} through ${multiverseMarketOwnerFamilySummary.lastValidatedCurrencyBox} samples`
        : "Missing MultiverseMarket owner-family shell",
      pass: multiverseMarketOwnerFamilySummary.hasOwnerFamily && multiverseMarketOwnerFamilySummary.hasCurrencyShell,
      scope: "APK"
    });
  }

  if (multiverseMarketSaveBoundary) {
    const multiverseMarketSaveBoundarySummary = getMultiverseMarketSaveBoundarySummary(multiverseMarketSaveBoundary);
    cases.push({
      title: "MultiverseMarket save boundary",
      expected: "MultiverseMarket action shell and PlayerProfileData save-family clues stay separate with zero overlap",
      actual: multiverseMarketSaveBoundarySummary.hasSeparationBoundary
        ? `${multiverseMarketSaveBoundarySummary.actionAnchor} and ${multiverseMarketSaveBoundarySummary.saveAnchor} stay separate with ${multiverseMarketSaveBoundarySummary.overlapLabel}`
        : "Missing MultiverseMarket save-boundary clues",
      pass: multiverseMarketSaveBoundarySummary.hasSeparationBoundary,
      scope: "APK"
    });
  }

  if (multiverseMarketMarketMemberBoundary) {
    const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(multiverseMarketMarketMemberBoundary);
    cases.push({
      title: "MultiverseMarket canonical host narrowing",
      expected: "PlayerProfileHandler get_Market accessor bridge is checked while direct MultiverseMarket ownership of the broader progression run is ruled out",
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

function getTokenShopCoverageSummary(tokenShop) {
  const numericTable = tokenShop?.numeric_table ?? {};
  const numericKeys = Object.keys(numericTable);
  const fields = Array.isArray(tokenShop?.fields) ? tokenShop.fields : [];
  const controllerFieldNames = new Set(fields.filter((entry) => entry.group === "controller").map((entry) => entry.field));
  const groups = [...new Set(
    numericKeys
      .map((key) => numericTable[key]?.group)
      .filter((value) => typeof value === "string" && value.length)
  )].sort();
  const namedLanes = ["TokenBoost", "DiamondBoost", "TokenDailiesT2"].filter((key) => key in numericTable);

  return {
    hasCoverage: numericKeys.length > 0,
    numericGroupCount: numericKeys.length,
    hasNamedLanes: namedLanes.length === 3,
    namedLaneLabel: namedLanes.join(", "),
    tierLabel: groups.join(", "),
    hasControllerAnchors:
      controllerFieldNames.has("BankFill")
      && controllerFieldNames.has("TokenBankDescriptionText")
  };
}

function getShardOwnerFamilyBoundarySummary(boundary) {
  const screenControllers = Array.isArray(boundary?.screenControllerFamilies) ? boundary.screenControllerFamilies : [];
  const dataCarriers = Array.isArray(boundary?.dataCarrierCandidates) ? boundary.dataCarrierCandidates : [];
  const fastBuyHooks = Array.isArray(boundary?.screenControlAnchors) ? boundary.screenControlAnchors : [];
  const bonusAnchors = Array.isArray(boundary?.bonusFieldAnchors) ? boundary.bonusFieldAnchors : [];
  const genericLead = boundary?.downgradedGenericLead ?? {};
  const genericLeadReasons = Array.isArray(genericLead.reasons) ? genericLead.reasons : [];
  return {
    hasBoundary: screenControllers.includes("ShardMining, Assembly-CSharp") && dataCarriers.includes("ShardMining|ShardUpgradeInfo"),
    hasFastBuyHooks: ["CheckFirstTimeShardMilestoneOpened", "AttachFastBuyButton", "FastBuyButtonMethodShards", "StartFastBuyButtonHold"]
      .every((name) => fastBuyHooks.includes(name)),
    hasBonusAnchors: ["TotalMilestoneLevels", "get_IsUnlocked", "FinalSU1Bonus1", "FinalSU29Bonus2", "FinalSU29Bonus3"]
      .every((name) => bonusAnchors.includes(name)),
    hasDowngradedGenericLead: genericLead.family === "ConstructionMilestones, Assembly-CSharp" && genericLeadReasons.length > 0,
    screenController: screenControllers[0] || "ShardMining, Assembly-CSharp",
    dataCarrier: dataCarriers[0] || "ShardMining|ShardUpgradeInfo",
    fastBuyHooksLabel: fastBuyHooks.slice(0, 4).join(", "),
    bonusAnchorLabel: bonusAnchors.filter((name) => ["TotalMilestoneLevels", "get_IsUnlocked", "FinalSU1Bonus1", "FinalSU29Bonus2", "FinalSU29Bonus3"].includes(name)).join(", "),
    genericLead: genericLead.family || "ConstructionMilestones, Assembly-CSharp",
    genericLeadReason: genericLeadReasons[0] || "its current evidence is still generic rather than shard-specific"
  };
}

function getShardFinalSuBonusBoundarySummary(boundary) {
  const unlockRequirementAccessors = Array.isArray(boundary?.unlockRequirementAccessors) ? boundary.unlockRequirementAccessors : [];
  const bonusFieldSamples = Array.isArray(boundary?.bonusFieldSamples) ? boundary.bonusFieldSamples : [];
  const bonusAccessorSamples = Array.isArray(boundary?.bonusAccessorSamples) ? boundary.bonusAccessorSamples : [];
  const adjacentFields = Array.isArray(boundary?.adjacentFields) ? boundary.adjacentFields : [];
  return {
    hasBoundary:
      boundary?.dataCarrier === "ShardUpgradeInfo"
      && boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo"
      && ["get_SU1FinalUnlockReq", "get_SU29FinalUnlockReq"].every((name) => unlockRequirementAccessors.includes(name))
      && ["FinalSU1Bonus1", "FinalSU29Bonus2", "FinalSU29Bonus3"].every((name) => bonusFieldSamples.includes(name))
      && ["get_FinalSU1Bonus1", "get_FinalSU29Bonus2", "get_FinalSU29Bonus3"].every((name) => bonusAccessorSamples.includes(name)),
    hasAdjacentFields: ["TotalMilestoneLevels", "get_IsUnlocked", "OverLevel100Exponent", "OverLevel400Exponent", "<FastBuyEnum>d__1429"]
      .every((name) => adjacentFields.includes(name)),
    dataCarrier: boundary?.dataCarrier || "ShardUpgradeInfo",
    unlockRangeLabel: unlockRequirementAccessors.join(", "),
    bonusFieldLabel: bonusFieldSamples.join(", "),
    bonusAccessorLabel: bonusAccessorSamples.join(", "),
    adjacentFieldLabel: adjacentFields.join(", ")
  };
}

function getShardMilestonePayloadBoundarySummary(boundary) {
  const milestoneStateFields = Array.isArray(boundary?.milestoneStateFields) ? boundary.milestoneStateFields : [];
  const costAndListHooks = Array.isArray(boundary?.costAndListHooks) ? boundary.costAndListHooks : [];
  const progressFillHooks = Array.isArray(boundary?.progressFillHooks) ? boundary.progressFillHooks : [];
  const tickFields = Array.isArray(boundary?.tickFields) ? boundary.tickFields : [];
  const sampleCostAccessors = Array.isArray(boundary?.sampleCostAccessors) ? boundary.sampleCostAccessors : [];
  return {
    hasBoundary:
      boundary?.dataCarrier === "ShardUpgradeInfo"
      && boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo"
      && ["TotalMilestoneLevels", "get_IsUnlocked", "set_IsUnlocked", "<IsUnlocked>k__BackingField"]
        .every((name) => milestoneStateFields.includes(name)),
    hasCostAndListHooks: ["get_TotalMilestoneLevels", "UpdateShardCostList", "GetShardCostList", "CountAffordableShard", "InitializeShards"]
      .every((name) => costAndListHooks.includes(name)),
    hasProgressFillHooks: ["CheckAllMilestoneLevelFills", "CheckMilestone0ProgressFill", "CheckMilestone1ProgressFill", "CheckMilestone9ProgressFill"]
      .every((name) => progressFillHooks.includes(name)),
    hasTickFields: ["Phase1Tick", "Phase6Tick", "CooldownTick"].every((name) => tickFields.includes(name)),
    hasCostAccessorSamples: ["get_SU23Cost", "get_SU29Cost"].every((name) => sampleCostAccessors.includes(name)),
    dataCarrier: boundary?.dataCarrier || "ShardUpgradeInfo",
    milestoneStateLabel: milestoneStateFields.join(", "),
    costHookLabel: costAndListHooks.join(", "),
    progressHookLabel: progressFillHooks.join(", "),
    tickFieldLabel: tickFields.join(", "),
    costAccessorLabel: sampleCostAccessors.join(", ")
  };
}

function getShardCostModelBoundarySummary(boundary) {
  const sampleCostAccessorWindows = Array.isArray(boundary?.sampleCostAccessorWindows) ? boundary.sampleCostAccessorWindows : [];
  const row0CostFields = Array.isArray(boundary?.row0CostFields) ? boundary.row0CostFields : [];
  const row0FillFields = Array.isArray(boundary?.row0FillFields) ? boundary.row0FillFields : [];
  const row0BonusFields = Array.isArray(boundary?.row0BonusFields) ? boundary.row0BonusFields : [];
  const optimizerBoundary = typeof boundary?.optimizerBoundary === "object" && boundary.optimizerBoundary ? boundary.optimizerBoundary : {};
  const supportedNow = Array.isArray(optimizerBoundary.supportedNow) ? optimizerBoundary.supportedNow : [];
  const blockedNow = Array.isArray(optimizerBoundary.blockedNow) ? optimizerBoundary.blockedNow : [];
  const earlyWindow = sampleCostAccessorWindows.find((window) => window?.label === "earlyWindow") || {};
  const lateWindow = sampleCostAccessorWindows.find((window) => window?.label === "lateWindow") || {};
  const earlyAccessors = Array.isArray(earlyWindow.accessors) ? earlyWindow.accessors : [];
  const lateAccessors = Array.isArray(lateWindow.accessors) ? lateWindow.accessors : [];
  return {
    hasBoundary:
      boundary?.dataCarrier === "ShardUpgradeInfo"
      && boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo",
    hasSampledCostWindows:
      earlyWindow.start === 0
      && earlyWindow.end === 9
      && earlyWindow.count === 10
      && ["get_SU0Cost", "get_SU9Cost"].every((name) => earlyAccessors.includes(name))
      && lateWindow.start === 23
      && lateWindow.end === 29
      && lateWindow.count === 7
      && ["get_SU23Cost", "get_SU29Cost"].every((name) => lateAccessors.includes(name)),
    hasRow0FormulaShell:
      ["SU0StartCost", "SU0CostExponent", "SU0GrowthExponent", "SU0GrowthExponent2", "SU0GrowthExponent3"].every((name) => row0CostFields.includes(name))
      && ["SU0Level1Fill", "SU0Level8Fill"].every((name) => row0FillFields.includes(name))
      && ["SU0Bonus1", "SU0Bonus8"].every((name) => row0BonusFields.includes(name)),
    dataCarrier: boundary?.dataCarrier || "ShardUpgradeInfo",
    costWindowLabel: [earlyAccessors.join(", "), lateAccessors.join(", ")].filter(Boolean).join(" | "),
    row0FieldLabel: row0CostFields.join(", "),
    row0FillLabel: row0FillFields.join(", "),
    row0BonusLabel: row0BonusFields.join(", "),
    supportedOptimizerLabel: supportedNow.join(", "),
    blockedOptimizerLabel: blockedNow.join(", ")
  };
}

function getShardMilestoneRowModelBoundarySummary(boundary) {
  const textCheckerRange = typeof boundary?.textCheckerRange === "object" && boundary.textCheckerRange ? boundary.textCheckerRange : {};
  const unlockRequirementRange = typeof boundary?.unlockRequirementRange === "object" && boundary.unlockRequirementRange ? boundary.unlockRequirementRange : {};
  const buyHookEvidence = typeof boundary?.buyHookEvidence === "object" && boundary.buyHookEvidence ? boundary.buyHookEvidence : {};
  const shardLocalDirectHooks = Array.isArray(buyHookEvidence.shardLocalDirectHooks) ? buyHookEvidence.shardLocalDirectHooks : [];
  const genericNumberedFamily = typeof buyHookEvidence.genericNumberedFamily === "object" && buyHookEvidence.genericNumberedFamily ? buyHookEvidence.genericNumberedFamily : {};
  return {
    hasBoundary:
      boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo"
      && textCheckerRange.start === 0
      && textCheckerRange.end === 29
      && textCheckerRange.count === 30
      && unlockRequirementRange.start === 0
      && unlockRequirementRange.end === 29
      && unlockRequirementRange.count === 30,
    hasShardLocalBuySample: shardLocalDirectHooks.includes("BuyMilestone0"),
    hasGenericBuyFamily:
      genericNumberedFamily.family === "ConstructionMilestones, Assembly-CSharp"
      && genericNumberedFamily.start === 1
      && genericNumberedFamily.end === 57
      && genericNumberedFamily.count === 57,
    textCheckerRangeLabel: `${textCheckerRange.start ?? "?"}-${textCheckerRange.end ?? "?"}`,
    unlockRangeLabel: `${unlockRequirementRange.start ?? "?"}-${unlockRequirementRange.end ?? "?"}`,
    shardLocalBuyLabel: shardLocalDirectHooks.join(", "),
    genericBuyLabel: `${genericNumberedFamily.family || "ConstructionMilestones, Assembly-CSharp"} ${genericNumberedFamily.start ?? "?"}-${genericNumberedFamily.end ?? "?"}`
  };
}

function getShardMilestoneTitleEffectBoundarySummary(boundary) {
  const titleAssetCandidates = Array.isArray(boundary?.titleAssetCandidates) ? boundary.titleAssetCandidates : [];
  const effectPresentationSlots = Array.isArray(boundary?.effectPresentationSlots) ? boundary.effectPresentationSlots : [];
  const sampleBonusCalcAccessors = Array.isArray(boundary?.sampleBonusCalcAccessors) ? boundary.sampleBonusCalcAccessors : [];
  const uniqueRows = [...new Set(titleAssetCandidates.map((entry) => entry?.row).filter((value) => Number.isInteger(value)))].sort((a, b) => a - b);
  const row28Candidates = titleAssetCandidates.filter((entry) => entry?.row === 28).map((entry) => entry.title);
  return {
    hasBoundary: uniqueRows.includes(0) && uniqueRows.includes(29) && uniqueRows.includes(30),
    hasEffectPresentationFamily: ["ShardMilestoneBonus1", "ShardMilestoneBonus8"].every((name) => effectPresentationSlots.includes(name)),
    hasBonusCalcSamples: ["get_SU1Bonus1Calc", "get_SU5Bonus2Calc"].every((name) => sampleBonusCalcAccessors.includes(name)),
    titleRangeLabel: uniqueRows.length ? `${uniqueRows[0]}-${uniqueRows[uniqueRows.length - 1]}` : "unknown",
    effectSlotLabel: effectPresentationSlots.join(", "),
    bonusCalcLabel: sampleBonusCalcAccessors.join(", "),
    row28ConflictLabel: row28Candidates.join(", ")
  };
}

function getShardEffectTextHandlerBoundarySummary(boundary) {
  const presentationFamily = Array.isArray(boundary?.presentationFamily) ? boundary.presentationFamily : [];
  const sampleBonusCalcAccessors = Array.isArray(boundary?.sampleBonusCalcAccessors) ? boundary.sampleBonusCalcAccessors : [];
  const uiContextAnchors = Array.isArray(boundary?.uiContextAnchors) ? boundary.uiContextAnchors : [];
  const rowModelCoverage = typeof boundary?.rowModelCoverage === "object" && boundary?.rowModelCoverage ? boundary.rowModelCoverage : {};
  return {
    hasBoundary:
      boundary?.probableTextHandler === "TextHandlerShardMilestoneBonusesPerLevel/N"
      && boundary?.genericMilestoneWriter === "SetAllMilestoneTexts"
      && rowModelCoverage.start === 0
      && rowModelCoverage.end === 29
      && rowModelCoverage.count === 30,
    hasPresentationFamily: ["ShardMilestoneBonus1", "ShardMilestoneBonus8"].every((name) => presentationFamily.includes(name)),
    hasBonusCalcSamples: ["get_SU1Bonus1Calc", "get_SU5Bonus2Calc"].every((name) => sampleBonusCalcAccessors.includes(name)),
    hasUiContextAnchors: ["LevelText", "DescText", "ValueText", "DescriptionText"].every((name) => uiContextAnchors.includes(name)),
    textHandlerLabel: boundary?.probableTextHandler || "TextHandlerShardMilestoneBonusesPerLevel/N",
    genericWriterLabel: boundary?.genericMilestoneWriter || "SetAllMilestoneTexts",
    presentationFamilyLabel: presentationFamily.join(", "),
    bonusCalcLabel: sampleBonusCalcAccessors.join(", "),
    uiContextLabel: uiContextAnchors.join(", "),
    rowCoverageLabel: `${rowModelCoverage.start ?? "?"}-${rowModelCoverage.end ?? "?"}`
  };
}

function getShardMilestoneRowShellBoundarySummary(boundary) {
  const controllerShellAnchors = Array.isArray(boundary?.controllerShellAnchors) ? boundary.controllerShellAnchors : [];
  const unlockHookSamples = Array.isArray(boundary?.unlockHookSamples) ? boundary.unlockHookSamples : [];
  const buyHookSamples = Array.isArray(boundary?.buyHookSamples) ? boundary.buyHookSamples : [];
  const textCheckerSamples = Array.isArray(boundary?.textCheckerSamples) ? boundary.textCheckerSamples : [];
  return {
    hasBoundary:
      boundary?.screenControllerFamily === "ShardMining, Assembly-CSharp"
      && boundary?.dataCarrierTieIn === "ShardMining|ShardUpgradeInfo"
      && ["AttachFastBuyButton", "StartFastBuyButtonHold", "FastBuyButtonMethodShards"].every((name) => controllerShellAnchors.includes(name)),
    hasUnlockHookSamples: ["UnlockMilestone17", "UnlockMilestone29"].every((name) => unlockHookSamples.includes(name)),
    hasBuyHookSamples: buyHookSamples.includes("BuyMilestone0"),
    hasTextCheckerSamples: ["Milestone0TextChecker", "Milestone9TextChecker", "Milestone12TextChecker"].every((name) => textCheckerSamples.includes(name)),
    screenController: boundary?.screenControllerFamily || "ShardMining, Assembly-CSharp",
    tieIn: boundary?.dataCarrierTieIn || "ShardMining|ShardUpgradeInfo",
    controllerHookLabel: controllerShellAnchors.join(", "),
    unlockHookLabel: unlockHookSamples.join(", "),
    buyHookLabel: buyHookSamples.join(", "),
    textCheckerLabel: textCheckerSamples.join(", ")
  };
}

function getShardMilestoneRowAlignmentBoundarySummary(boundary) {
  const unlockHookRange = typeof boundary?.unlockHookRange === "object" && boundary.unlockHookRange ? boundary.unlockHookRange : {};
  const textCheckerRange = typeof boundary?.textCheckerRange === "object" && boundary.textCheckerRange ? boundary.textCheckerRange : {};
  const buyHookRange = typeof boundary?.buyHookRange === "object" && boundary.buyHookRange ? boundary.buyHookRange : {};
  const unlockTextCheckerOverlapIds = Array.isArray(boundary?.unlockTextCheckerOverlapIds) ? boundary.unlockTextCheckerOverlapIds : [];
  const buyTextCheckerOverlapIds = Array.isArray(boundary?.buyTextCheckerOverlapIds) ? boundary.buyTextCheckerOverlapIds : [];
  return {
    hasBoundary:
      boundary?.screenControllerFamily === "ShardMining, Assembly-CSharp"
      && unlockHookRange.start === 17
      && unlockHookRange.end === 29
      && unlockHookRange.count === 13
      && textCheckerRange.start === 0
      && textCheckerRange.end === 12
      && textCheckerRange.count === 13
      && buyHookRange.start === 0
      && buyHookRange.end === 0
      && buyHookRange.count === 1,
    hasZeroUnlockTextOverlap: unlockTextCheckerOverlapIds.length === 0,
    hasBuyTextOverlap: buyTextCheckerOverlapIds.length === 1 && buyTextCheckerOverlapIds[0] === 0,
    unlockRangeLabel: `${unlockHookRange.start ?? "?"}-${unlockHookRange.end ?? "?"}`,
    textCheckerRangeLabel: `${textCheckerRange.start ?? "?"}-${textCheckerRange.end ?? "?"}`,
    buyRangeLabel: `${buyHookRange.start ?? "?"}-${buyHookRange.end ?? "?"}`,
    unlockTextOverlapLabel: unlockTextCheckerOverlapIds.length ? unlockTextCheckerOverlapIds.join(", ") : "none",
    buyTextOverlapLabel: buyTextCheckerOverlapIds.length ? buyTextCheckerOverlapIds.join(", ") : "none"
  };
}

function getShardSaveBoundarySummary(boundary) {
  const ownerShellTermsChecked = Array.isArray(boundary?.ownerShellTermsChecked) ? boundary.ownerShellTermsChecked : [];
  const saveFamilyTermsChecked = Array.isArray(boundary?.saveFamilyTermsChecked) ? boundary.saveFamilyTermsChecked : [];
  const probeResults = typeof boundary?.probeResults === "object" && boundary.probeResults ? boundary.probeResults : {};
  return {
    hasSeparationBoundary:
      probeResults.metadataNeighborhoodHasSaveTerms === false
      && probeResults.level0HasSaveTerms === false
      && probeResults.ownerShellWithSaveOverlapCount === 0
      && probeResults.directShardPlayerProfileContext === false
      && saveFamilyTermsChecked.includes("PlayerProfileData")
      && saveFamilyTermsChecked.includes("CloudSavePlayerProfile"),
    ownerAnchor: "ShardMining / ShardUpgradeInfo",
    saveAnchor: "PlayerProfileData",
    cloudSaveAnchor: "CloudSavePlayerProfile",
    overlapLabel: "zero direct overlap",
    ownerTermCount: ownerShellTermsChecked.length
  };
}

function getTokeniumNamingSummary(clues) {
  const resourceIcons = Array.isArray(clues?.assetNames?.resourceIcons) ? clues.assetNames.resourceIcons : [];
  const academySprites = Array.isArray(clues?.assetNames?.academySprites) ? clues.assetNames.academySprites : [];
  const level0Shells = Array.isArray(clues?.level0Shells) ? clues.level0Shells : [];

  return {
    hasNamingClues:
      resourceIcons.includes("Resource_Tokenium")
      && academySprites.includes("Aca.Tokenium553")
      && level0Shells.includes("CostBox-Tokens")
      && level0Shells.includes("CostBox-Tokenium"),
    resourceLabel: resourceIcons.find((value) => value === "Resource_Tokenium") || "Resource_Tokenium",
    academyLabel: academySprites.find((value) => value === "Aca.Tokenium553") || "Aca.Tokenium553",
    tokenShellLabel: level0Shells.find((value) => value === "CostBox-Tokens") || "CostBox-Tokens",
    tokeniumShellLabel: level0Shells.find((value) => value === "CostBox-Tokenium") || "CostBox-Tokenium"
  };
}

function getTokenShopCostLaneSummary(clues) {
  const tokenSpendGroups = Array.isArray(clues?.tokenSpendGroups) ? clues.tokenSpendGroups : [];
  const dailyTokeniumModifierGroups = Array.isArray(clues?.dailyTokeniumModifierGroups) ? clues.dailyTokeniumModifierGroups : [];
  const diamondGroups = Array.isArray(clues?.diamondGroups) ? clues.diamondGroups : [];
  const playerFacingClues = Array.isArray(clues?.playerFacingClues) ? clues.playerFacingClues : [];

  return {
    hasLaneSplit:
      tokenSpendGroups.includes("TokenBoost")
      && diamondGroups.includes("DiamondBoost")
      && dailyTokeniumModifierGroups.includes("TokenDailiesT2")
      && playerFacingClues.includes("CostBox-Tokens")
      && playerFacingClues.includes("CostBox-Tokenium"),
    keepsDailyTokeniumSeparate:
      dailyTokeniumModifierGroups.includes("TokenDailiesT2")
      && dailyTokeniumModifierGroups.includes("TokenDailiesT3")
      && playerFacingClues.includes("Mission Materials Booster"),
    tokenLaneLabel: "TokenBoost",
    diamondLaneLabel: "DiamondBoost",
    dailyLaneLabel: "TokenDailiesT2",
    tokensShellLabel: "CostBox-Tokens",
    tokeniumShellLabel: "CostBox-Tokenium"
  };
}

function getSpendActionLaneSummary(clues) {
  const tokenDirectBuyHooks = Array.isArray(clues?.tokenDirectBuyHooks) ? clues.tokenDirectBuyHooks : [];
  const diamondDirectBuyHooks = Array.isArray(clues?.diamondDirectBuyHooks) ? clues.diamondDirectBuyHooks : [];
  const dailyTokeniumModifierHooks = Array.isArray(clues?.dailyTokeniumModifierHooks) ? clues.dailyTokeniumModifierHooks : [];
  const searchMetadata = typeof clues?.searchResults?.metadata === "object" && clues.searchResults.metadata
    ? clues.searchResults.metadata
    : {};
  const searchLevel0 = typeof clues?.searchResults?.level0 === "object" && clues.searchResults.level0
    ? clues.searchResults.level0
    : {};

  return {
    hasActionSplit:
      tokenDirectBuyHooks.includes("BuyTokenBoost")
      && diamondDirectBuyHooks.includes("BuyDiamondBoost")
      && dailyTokeniumModifierHooks.includes("BuyLM244")
      && dailyTokeniumModifierHooks.includes("BuyCollectorDevice"),
    keepsDailyDirectHooksUnrecovered:
      searchMetadata.BuyTokenDailiesT2 === 0
      && searchMetadata.BuyTokenDailiesT3 === 0
      && searchLevel0.BuyTokenDailiesT2 === 0
      && searchLevel0.BuyTokenDailiesT3 === 0,
    tokenHook: "BuyTokenBoost",
    diamondHook: "BuyDiamondBoost",
    loopModifierHook: "BuyLM244",
    premiumModifierHook: "BuyCollectorDevice",
    dailyHookT2: "BuyTokenDailiesT2",
    dailyHookT3: "BuyTokenDailiesT3"
  };
}

function getTokenBankStateSummary(clues) {
  const tokenShopMethods = Array.isArray(clues?.tokenShopMethods) ? clues.tokenShopMethods : [];
  const displayOrHandlerClues = Array.isArray(clues?.displayOrHandlerClues) ? clues.displayOrHandlerClues : [];

  return {
    hasControllerSplit:
      tokenShopMethods.includes("ClaimBankedTokens")
      && tokenShopMethods.includes("get_TokenBankCap")
      && displayOrHandlerClues.includes("BigStatisticPrefab.TokenBankCap")
      && displayOrHandlerClues.includes("SetLM244BonusText"),
    claimMethod: "ClaimBankedTokens",
    capMethod: "get_TokenBankCap",
    displayShell: "BigStatisticPrefab.TokenBankCap",
    loopHandler: "TextHandlerLoopMods",
    loopHook: "SetLM244BonusText"
  };
}

function getDailyTokeniumLaneSummary(clues) {
  const ownerFamilyClues = Array.isArray(clues?.ownerFamilyClues) ? clues.ownerFamilyClues : [];
  const modifierClues = Array.isArray(clues?.modifierClues) ? clues.modifierClues : [];
  const premiumModifierClues = Array.isArray(clues?.premiumModifierClues) ? clues.premiumModifierClues : [];
  const playerFacingStrings = Array.isArray(clues?.playerFacingStrings) ? clues.playerFacingStrings : [];

  return {
    hasOwnerFamilyClues:
      ownerFamilyClues.includes("SpaceAcademy")
      && ownerFamilyClues.includes("SpaceAcademyMain")
      && ownerFamilyClues.includes("TextHandlerSpaceAcademy")
      && ownerFamilyClues.includes("FarmMissions"),
    hasModifierBoundary:
      modifierClues.includes("SetLM244BonusText")
      && modifierClues.includes("BuyLM244")
      && modifierClues.includes("FinalDailyTokenBonus")
      && premiumModifierClues.includes("BuyCollectorDevice")
      && premiumModifierClues.includes("CollectorCapBonus")
      && premiumModifierClues.includes("CollectorMatsBonus"),
    hasPlayerFacingBoundary:
      playerFacingStrings.includes("0 / 2000 Daily Tokenium (from blue farm missions)")
      && playerFacingStrings.includes("This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)")
      && playerFacingStrings.includes("The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"),
    ownerFamilyLabel: "SpaceAcademy",
    missionFamilyLabel: "FarmMissions",
    academyController: "SpaceAcademyMain",
    textHandler: "TextHandlerSpaceAcademy",
    loopHook: "SetLM244BonusText",
    purchaseHook: "BuyLM244",
    purchaseOwner: "BuyCollectorDevice",
    premiumPack: "COLLECTERS PACK"
  };
}

function getTokenBankFormulaBoundarySummary(clues) {
  const derivedOutputCluster = Array.isArray(clues?.derivedOutputCluster) ? clues.derivedOutputCluster : [];
  const saveFamilyCluesInDerivedContext = Array.isArray(clues?.saveFamilyCluesInDerivedContext)
    ? clues.saveFamilyCluesInDerivedContext
    : [];

  return {
    hasDerivedOutputBoundary:
      derivedOutputCluster.includes("get_FinalTokenBankCap")
      && derivedOutputCluster.includes("get_FinalTokenBankFillSpeed")
      && derivedOutputCluster.includes("<FinalTokenBankCap>k__BackingField")
      && derivedOutputCluster.includes("<FinalTokenBankFillSpeed>k__BackingField"),
    hasNoSaveJoinInDerivedContext: saveFamilyCluesInDerivedContext.length === 0,
    capAccessor: "get_FinalTokenBankCap",
    fillAccessor: "get_FinalTokenBankFillSpeed",
    capField: "<FinalTokenBankCap>k__BackingField",
    fillField: "<FinalTokenBankFillSpeed>k__BackingField"
  };
}

function getMultiverseMarketRangeBoundarySummary(boundary) {
  const validatedRowRanges = Array.isArray(boundary?.validatedRowRanges) ? boundary.validatedRowRanges : [];
  const overlapIds = Array.isArray(boundary?.overlapIds) ? boundary.overlapIds : [];
  const metadataIsRangeLabel = typeof boundary?.metadataIsRangeLabel === "string" ? boundary.metadataIsRangeLabel : "";

  return {
    hasRangeBoundary: validatedRowRanges.length > 0 && metadataIsRangeLabel.length > 0,
    hasValidatedRows: validatedRowRanges.length > 0,
    hasOverlap: overlapIds.length > 0,
    hasExplicitZeroOverlap: validatedRowRanges.length > 0 && metadataIsRangeLabel.length > 0 && overlapIds.length === 0,
    overlapLabel: formatNumericRanges(overlapIds),
    validatedRangeLabel: validatedRowRanges.join(" and "),
    metadataRangeLabel: metadataIsRangeLabel
  };
}

function getMultiverseMarketRowTextCoverageSummary(coverage) {
  const textHandlerAnchors = Array.isArray(coverage?.textHandlerAnchors) ? coverage.textHandlerAnchors : [];
  const validatedRowCostTexts = Array.isArray(coverage?.validatedRowCostTexts) ? coverage.validatedRowCostTexts : [];
  const sampleBuyHooks = Array.isArray(coverage?.sampleBuyHooks) ? coverage.sampleBuyHooks : [];

  return {
    hasValidatedTextCoverage:
      textHandlerAnchors.includes("TextHandlerMarkets")
      && textHandlerAnchors.includes("SetAllChrystosEmporiumTexts")
      && validatedRowCostTexts.length === 22
      && validatedRowCostTexts.includes("SetIS50CostText")
      && validatedRowCostTexts.includes("SetIS74CostText"),
    hasBuyHookSamples:
      sampleBuyHooks.includes("BuyIS50")
      && sampleBuyHooks.includes("BuyIS74"),
    coveredCount: validatedRowCostTexts.length,
    validatedRangeLabel: "50-59 and 63-74",
    textHandler: "TextHandlerMarkets",
    textBatcher: "SetAllChrystosEmporiumTexts",
    firstBuyHook: "BuyIS50",
    lastBuyHook: "BuyIS74"
  };
}

function getMultiverseMarketActionShellSummary(shell) {
  const textHandlerAnchors = Array.isArray(shell?.textHandlerAnchors) ? shell.textHandlerAnchors : [];
  const validatedBuyHookRanges = Array.isArray(shell?.validatedBuyHookRanges) ? shell.validatedBuyHookRanges : [];
  const validatedBuyHooks = Array.isArray(shell?.validatedBuyHooks) ? shell.validatedBuyHooks : [];
  const validatedCostTexts = Array.isArray(shell?.validatedCostTexts) ? shell.validatedCostTexts : [];
  const buyRange = shell?.contextDerivedBuyHookRange ?? {};
  const costTextRange = shell?.contextDerivedCostTextRange ?? {};

  return {
    hasActionShell:
      textHandlerAnchors.includes("TextHandlerMarkets")
      && textHandlerAnchors.includes("SetAllChrystosEmporiumTexts")
      && buyRange.start === 1
      && buyRange.end === 110
      && buyRange.count === 110
      && costTextRange.start === 1
      && costTextRange.end === 110
      && costTextRange.count === 110
      && validatedBuyHookRanges.join(" and ") === "50-59 and 63-74"
      && validatedBuyHooks.length === 22
      && validatedCostTexts.length === 22,
    buyRangeLabel: "BuyIS1-110",
    costTextRangeLabel: "SetIS1-110CostText",
    validatedRangeLabel: validatedBuyHookRanges.join(" and ") || "50-59 and 63-74"
  };
}

function getMultiverseMarketPrefabRemapBoundarySummary(boundary) {
  const directPrefabNumberMatches = Array.isArray(boundary?.directPrefabNumberMatches) ? boundary.directPrefabNumberMatches : [];
  const explicitPrefabIdOverrides = Array.isArray(boundary?.explicitPrefabIdOverrides) ? boundary.explicitPrefabIdOverrides : [];
  const validatedIdsWithoutDirectPrefabName = Array.isArray(boundary?.validatedIdsWithoutDirectPrefabName) ? boundary.validatedIdsWithoutDirectPrefabName : [];

  return {
    hasDirectMatchBand:
      directPrefabNumberMatches.includes(50)
      && directPrefabNumberMatches.includes(68),
    hasOverrideBoundary:
      explicitPrefabIdOverrides.map((entry) => `${entry.prefabNumber}->${entry.serializedId}`).join(",") === "69->57,70->58,71->59,72->60,73->61,74->62"
      && validatedIdsWithoutDirectPrefabName.join(",") === "69,70,71,72,73,74",
    lastDirectPrefab: "ChrystosEmporiumUpgrade68",
    firstOverride: "ChrystosEmporiumUpgrade69-ID57",
    lastOverride: "ChrystosEmporiumUpgrade74-ID62",
    validatedMismatchLabel: "69-74"
  };
}

function getMultiverseMarketOwnerFamilySummary(family) {
  const ownerAnchors = Array.isArray(family?.ownerAnchors) ? family.ownerAnchors : [];
  const costLaneAnchors = Array.isArray(family?.costLaneAnchors) ? family.costLaneAnchors : [];
  const validatedCurrencyBoxes = Array.isArray(family?.validatedCurrencyBoxes) ? family.validatedCurrencyBoxes : [];
  const sampleBuyHooks = Array.isArray(family?.sampleBuyHooks) ? family.sampleBuyHooks : [];
  const currencyBoxRange = typeof family?.currencyBoxRange === "object" && family.currencyBoxRange ? family.currencyBoxRange : {};

  return {
    hasOwnerFamily:
      ownerAnchors.includes("MultiverseMarket, Assembly-CSharp")
      && ownerAnchors.includes("TextHandlerMarkets")
      && ownerAnchors.includes("SetAllChrystosEmporiumTexts")
      && ownerAnchors.includes("SetInscryptionsDoneText")
      && ownerAnchors.includes("Inscryptions")
      && costLaneAnchors.includes("ResourceAmountText.InscryptionsDone")
      && costLaneAnchors.includes("AchievementBar-Inscryptions")
      && costLaneAnchors.includes("CostBox-InscryptionsDone")
      && currencyBoxRange.start === 1
      && currencyBoxRange.end === 110
      && currencyBoxRange.count === 110
      && sampleBuyHooks.includes("BuyIS64")
      && sampleBuyHooks.includes("BuyIS105"),
    hasCurrencyShell:
      validatedCurrencyBoxes.includes("IS50CurrencyBox")
      && validatedCurrencyBoxes.includes("IS74CurrencyBox"),
    ownerAnchor: "MultiverseMarket",
    inscryptionsLabel: "Inscryptions",
    textHandler: "TextHandlerMarkets",
    batcher: "SetAllChrystosEmporiumTexts",
    resourceText: "ResourceAmountText.InscryptionsDone",
    achievementBar: "AchievementBar-Inscryptions",
    costBox: "CostBox-InscryptionsDone",
    currencyRangeLabel: "IS1-110 CurrencyBox shell",
    firstValidatedCurrencyBox: "IS50CurrencyBox",
    lastValidatedCurrencyBox: "IS74CurrencyBox"
  };
}

function getTokenShopOwnerShellSummary(shell) {
  const ownerAnchors = Array.isArray(shell?.ownerAnchors) ? shell.ownerAnchors : [];
  const tokenBankMethods = Array.isArray(shell?.tokenBankMethods) ? shell.tokenBankMethods : [];
  const notificationHooks = Array.isArray(shell?.notificationHooks) ? shell.notificationHooks : [];
  const adjacentDeviceHooks = Array.isArray(shell?.adjacentDeviceHooks) ? shell.adjacentDeviceHooks : [];

  return {
    hasOwnerShell:
      ownerAnchors.includes("TokenShop")
      && ownerAnchors.includes("InitializeTokenShop")
      && tokenBankMethods.includes("ClaimBankedTokens")
      && notificationHooks.includes("CheckTokenClaimNotification")
      && adjacentDeviceHooks.includes("BuyAutoTokenClicker"),
    ownerAnchor: "TokenShop",
    bankMethod: "ClaimBankedTokens",
    notificationHook: "CheckTokenClaimNotification",
    deviceHook: "BuyAutoTokenClicker"
  };
}

function getTokenShopSaveBoundarySummary(boundary) {
  const ownerShellTermsChecked = Array.isArray(boundary?.ownerShellTermsChecked) ? boundary.ownerShellTermsChecked : [];
  const saveFamilyTermsChecked = Array.isArray(boundary?.saveFamilyTermsChecked) ? boundary.saveFamilyTermsChecked : [];
  const probeResults = typeof boundary?.probeResults === "object" && boundary.probeResults ? boundary.probeResults : {};

  return {
    hasSeparationBoundary:
      ownerShellTermsChecked.includes("TokenShop")
      && saveFamilyTermsChecked.includes("PlayerProfileData")
      && probeResults.metadataHasSaveTerms === true
      && probeResults.level0HasSaveTerms === false
      && probeResults.ownerShellWithSaveOverlapCount === 0
      && probeResults.directTokenShopPlayerProfileContext === false,
    ownerAnchor: "TokenShop",
    saveAnchor: "PlayerProfileData",
    overlapLabel: "zero overlap"
  };
}

function getTokenBankControllerShellSummary(shell) {
  const controllerAnchors = Array.isArray(shell?.controllerAnchors) ? shell.controllerAnchors : [];
  const adjacentControllerMethods = Array.isArray(shell?.adjacentControllerMethods) ? shell.adjacentControllerMethods : [];

  return {
    hasControllerShell:
      controllerAnchors.includes("ClaimBankedTokens")
      && controllerAnchors.includes("SetBankFill")
      && controllerAnchors.includes("BankFill")
      && controllerAnchors.includes("TokenBankDescriptionText")
      && controllerAnchors.includes("CheckTokenClaimNotification")
      && controllerAnchors.includes("TokenShopButtonNotification")
      && adjacentControllerMethods.includes("get_TokenBankCap")
      && adjacentControllerMethods.includes("get_ClaimableBankTokens")
      && adjacentControllerMethods.includes("IncreaseBankedTokens"),
    claimMethod: "ClaimBankedTokens",
    fillMethod: "SetBankFill",
    fillField: "BankFill",
    descriptionShell: "TokenBankDescriptionText",
    notificationHook: "CheckTokenClaimNotification"
  };
}

function getMultiverseMarketSaveBoundarySummary(boundary) {
  const actionShellTermsChecked = Array.isArray(boundary?.actionShellTermsChecked) ? boundary.actionShellTermsChecked : [];
  const saveFamilyTermsChecked = Array.isArray(boundary?.saveFamilyTermsChecked) ? boundary.saveFamilyTermsChecked : [];
  const probeResults = typeof boundary?.probeResults === "object" && boundary.probeResults ? boundary.probeResults : {};

  return {
    hasSeparationBoundary:
      actionShellTermsChecked.includes("TextHandlerMarkets")
      && saveFamilyTermsChecked.includes("PlayerProfileData")
      && probeResults.actionShellWithSaveOverlapCount === 0
      && probeResults.metadataNeighborhoodHasActionTerms === true
      && probeResults.metadataNeighborhoodHasSaveTerms === true
      && probeResults.metadataProbeHasSaveTerms === false
      && probeResults.level0ProbeHasSaveTerms === false,
    actionAnchor: "TextHandlerMarkets",
    saveAnchor: "PlayerProfileData",
    overlapLabel: "zero overlap"
  };
}

function getMultiverseMarketMarketMemberBoundarySummary(boundary) {
  const accessorClues = Array.isArray(boundary?.playerProfileAccessorClues) ? boundary.playerProfileAccessorClues : [];
  const memberShellClues = Array.isArray(boundary?.playerProfileMemberShellClues) ? boundary.playerProfileMemberShellClues : [];
  const handlerBridgeClues = Array.isArray(boundary?.playerProfileHandlerBridgeClues) ? boundary.playerProfileHandlerBridgeClues : [];
  const directMemberHandoffClues = Array.isArray(boundary?.directMemberHandoffClues) ? boundary.directMemberHandoffClues : [];
  const typedSiblingContrastClues = Array.isArray(boundary?.typedSiblingContrastClues) ? boundary.typedSiblingContrastClues : [];
  const progressionPayloadFieldClues = Array.isArray(boundary?.progressionPayloadFieldClues) ? boundary.progressionPayloadFieldClues : [];
  const cloudSaveBridgeClues = Array.isArray(boundary?.cloudSaveBridgeClues) ? boundary.cloudSaveBridgeClues : [];
  const missingDirectTypeMapClues = Array.isArray(boundary?.missingDirectTypeMapClues) ? boundary.missingDirectTypeMapClues : [];
  const typedPlayerProfileNestedTypeChecks = Array.isArray(boundary?.typedPlayerProfileNestedTypeChecks) ? boundary.typedPlayerProfileNestedTypeChecks : [];
  const negativeTypedDirectPlayerProfileProgressionChecks = Array.isArray(boundary?.negativeTypedDirectPlayerProfileProgressionChecks) ? boundary.negativeTypedDirectPlayerProfileProgressionChecks : [];
  const negativeTypedDirectMemberChecks = Array.isArray(boundary?.negativeTypedDirectMemberChecks) ? boundary.negativeTypedDirectMemberChecks : [];
  const negativeTypedSaveDataMarketChecks = Array.isArray(boundary?.negativeTypedSaveDataMarketChecks) ? boundary.negativeTypedSaveDataMarketChecks : [];
  const typedBridgeRecovery = typeof boundary?.typedBridgeRecovery === "object" && boundary.typedBridgeRecovery ? boundary.typedBridgeRecovery : {};
  const typedHandlerFieldRecovery = typeof boundary?.typedHandlerFieldRecovery === "object" && boundary.typedHandlerFieldRecovery ? boundary.typedHandlerFieldRecovery : {};
  const typedPlayerProfileFieldTableRecovery = typeof boundary?.typedPlayerProfileFieldTableRecovery === "object" && boundary?.typedPlayerProfileFieldTableRecovery ? boundary.typedPlayerProfileFieldTableRecovery : {};
  const typedSaveDataFieldTableRecovery = typeof boundary?.typedSaveDataFieldTableRecovery === "object" && boundary?.typedSaveDataFieldTableRecovery ? boundary.typedSaveDataFieldTableRecovery : {};
  const typedSaveDataProgressionOwnerSamples = Array.isArray(boundary?.typedSaveDataProgressionOwnerSamples) ? boundary.typedSaveDataProgressionOwnerSamples : [];
  const siblingAccessorClues = ["get_Market", "get_BM", "get_ZN", "get_TU", "get_Relics", "get_CellData", "get_ModPointData", "get_ShardData", "get_ResearchPointData", "get_AcademyPointData"];
  const siblingMemberShellClues = ["Market", "Relics", "CellData", "ModPointData", "ShardData", "ResearchPointData", "AcademyPointData"];
  const handlerBridgeRequirement = ["PlayerProfileHandler", "playerData", "GetPlayerProfileData", "FillPlayerProfileData", "ConvertSaveDataToProfileData"];
  const directMemberHandoffRequirement = ["get_Market", "Market", "GetPlayerProfileData", "FillPlayerProfileData", "<FillPlayerProfileData>d__45"];
  const typedSiblingContrastRequirement = ["PlayerProfileData|GemData", "PlayerProfileData|GemNodeCombo"];
  const payloadFieldRequirement = ["InscryptionsDone", "EsotericR1Trades", "NecrumR1Trades", "Mech1Unlocked"];
  const negativeTypedMarketRequirement = ["PlayerProfileHandler.Market", "PlayerProfileData.Market", "PlayerProfileData.MultiverseMarket"];
  const negativeTypedPlayerProfileProgressionRequirement = ["PlayerProfileData.IS71Level", "PlayerProfileData.IS110Level", "PlayerProfileData.EsotericR1Trades", "PlayerProfileData.NecrumR1Trades", "PlayerProfileData.Mech1Unlocked", "PlayerProfileData.Mech1MissionsCompleted"];
  const negativeDirectMultiverseRequirement = ["MultiverseMarket.InscryptionsDone", "MultiverseMarket.IS71Level", "MultiverseMarket.IS110Level", "MultiverseMarket.EsotericR1Trades", "MultiverseMarket.NecrumR1Trades", "MultiverseMarket.Mech1Unlocked", "MultiverseMarket.Mech1MissionsCompleted"];
  const preservedSiblingAccessorCount = siblingAccessorClues.filter((name) => accessorClues.includes(name)).length;
  const preservedSiblingMemberCount = siblingMemberShellClues.filter((name) => memberShellClues.includes(name)).length;

  return {
    hasBoundary:
      accessorClues.includes("get_Market")
      && memberShellClues.includes("Market")
      && memberShellClues.includes("ShardData")
      && memberShellClues.includes("ResearchPointData"),
    hasCloudBridge:
      cloudSaveBridgeClues.includes("CloudSavePlayerProfile")
      && cloudSaveBridgeClues.includes("GetPlayerProfileInfo")
      && cloudSaveBridgeClues.includes("CloudLoad"),
    hasHandlerBridge:
      handlerBridgeRequirement.every((name) => handlerBridgeClues.includes(name)),
    hasDirectMemberHandoff:
      directMemberHandoffRequirement.every((name) => directMemberHandoffClues.includes(name)),
    hasTypedAccessorBridge:
      typedBridgeRecovery.bridgeOwner === "PlayerProfileHandler"
      && typedBridgeRecovery.bridgeAccessor === "get_Market"
      && typedBridgeRecovery.bridgeReturnType === "MultiverseMarket",
    hasTypedSaveCacheField:
      typedHandlerFieldRecovery.fieldOwner === "PlayerProfileHandler"
      && typedHandlerFieldRecovery.fieldName === "saveInfoCache"
      && typedHandlerFieldRecovery.fieldType === "PlayerProfileData",
    hasTypedPlayerProfileFieldTable:
      typedPlayerProfileFieldTableRecovery.fieldOwner === "PlayerProfileData"
      && Number.isInteger(typedPlayerProfileFieldTableRecovery.fieldCount)
      && Number.isInteger(typedPlayerProfileFieldTableRecovery.methodCount),
    hasTypedSaveDataFieldTable:
      typedSaveDataFieldTableRecovery.fieldOwner === "SaveData"
      && Number.isInteger(typedSaveDataFieldTableRecovery.fieldCount)
      && Number.isInteger(typedSaveDataFieldTableRecovery.methodCount),
    hasTypedSiblingContrast:
      typedSiblingContrastRequirement.every((name) => typedSiblingContrastClues.includes(name)),
    hasProgressionPayloadBoundary:
      payloadFieldRequirement.every((name) => progressionPayloadFieldClues.includes(name)),
    rulesOutTypedMarketField:
      negativeTypedMarketRequirement.every((name) => negativeTypedDirectMemberChecks.includes(name)),
    rulesOutDirectPlayerProfileProgressionOwner:
      negativeTypedPlayerProfileProgressionRequirement.every((name) => negativeTypedDirectPlayerProfileProgressionChecks.includes(name)),
    rulesOutDirectMultiverseFieldOwner:
      negativeDirectMultiverseRequirement.every((name) => negativeTypedDirectMemberChecks.includes(name)),
    rulesOutTypedSaveDataMarketField:
      ["SaveData.Market", "SaveData.MultiverseMarket"].every((name) => negativeTypedSaveDataMarketChecks.includes(name)),
    hasExactSaveDataProgressionOwner:
      typedSaveDataFieldTableRecovery.fieldOwner === "SaveData"
      && typedSaveDataProgressionOwnerSamples.includes("IS71Level")
      && typedSaveDataProgressionOwnerSamples.includes("IS110Level")
      && typedSaveDataProgressionOwnerSamples.includes("InscryptionsDone")
      && typedSaveDataProgressionOwnerSamples.includes("EsotericR1Trades")
      && typedSaveDataProgressionOwnerSamples.includes("NecrumR1Trades")
      && typedSaveDataProgressionOwnerSamples.includes("Mech1Unlocked")
      && typedSaveDataProgressionOwnerSamples.includes("Mech1MissionsCompleted"),
    hasMissingDirectTypeMap:
      missingDirectTypeMapClues.includes("PlayerProfileData|Market")
      && missingDirectTypeMapClues.includes("PlayerProfileData|Inscryption")
      && missingDirectTypeMapClues.includes("PlayerProfileData|MultiverseMarket"),
    hasSiblingAccessorCluster:
      siblingAccessorClues.every((name) => accessorClues.includes(name))
      && siblingMemberShellClues.every((name) => memberShellClues.includes(name)),
    favorsPlayerProfileMemberHost:
      accessorClues.includes("get_Market")
      && memberShellClues.includes("Market")
      && siblingAccessorClues.filter((name) => accessorClues.includes(name)).length >= 6
      && siblingMemberShellClues.filter((name) => memberShellClues.includes(name)).length >= 6
      && handlerBridgeRequirement.every((name) => handlerBridgeClues.includes(name))
      && missingDirectTypeMapClues.includes("PlayerProfileData|Market")
      && missingDirectTypeMapClues.includes("PlayerProfileData|Inscryption"),
    favorsIntermediateWrapper:
      accessorClues.includes("get_Market")
      && accessorClues.includes("get_BM")
      && accessorClues.includes("get_ZN")
      && accessorClues.includes("get_TU")
      && memberShellClues.includes("Market")
      && payloadFieldRequirement.every((name) => progressionPayloadFieldClues.includes(name))
      && missingDirectTypeMapClues.includes("PlayerProfileData|Market")
      && missingDirectTypeMapClues.includes("PlayerProfileData|Inscryption"),
    favorsDirectMemberBoundary:
      typedBridgeRecovery.bridgeOwner === "PlayerProfileHandler"
      && typedBridgeRecovery.bridgeAccessor === "get_Market"
      && typedBridgeRecovery.bridgeReturnType === "MultiverseMarket"
      && directMemberHandoffRequirement.every((name) => directMemberHandoffClues.includes(name))
      && typedSiblingContrastRequirement.every((name) => typedSiblingContrastClues.includes(name))
      && typedHandlerFieldRecovery.fieldOwner === "PlayerProfileHandler"
      && typedHandlerFieldRecovery.fieldName === "saveInfoCache"
      && typedHandlerFieldRecovery.fieldType === "PlayerProfileData"
      && typedPlayerProfileFieldTableRecovery.fieldOwner === "PlayerProfileData"
      && negativeTypedPlayerProfileProgressionRequirement.every((name) => negativeTypedDirectPlayerProfileProgressionChecks.includes(name))
      && negativeTypedMarketRequirement.every((name) => negativeTypedDirectMemberChecks.includes(name))
      && negativeDirectMultiverseRequirement.every((name) => negativeTypedDirectMemberChecks.includes(name))
      && missingDirectTypeMapClues.includes("PlayerProfileData|Market")
      && missingDirectTypeMapClues.includes("PlayerProfileData|Inscryption"),
    preservedSiblingAccessorCount,
    preservedSiblingMemberCount,
    accessorLabel: "get_Market",
    memberLabel: "Market",
    handlerBridgeLabel: "PlayerProfileHandler, playerData, GetPlayerProfileData, FillPlayerProfileData, and ConvertSaveDataToProfileData",
    directMemberHandoffLabel: "get_Market, Market, GetPlayerProfileData, FillPlayerProfileData, and the FillPlayerProfileData coroutine shell",
    memberShellLabel: "Relics, ShardData, ResearchPointData, and AcademyPointData",
    siblingAccessorLabel: "get_BM, get_ZN, get_TU, get_Relics, get_CellData, get_ModPointData, get_ShardData, get_ResearchPointData, and get_AcademyPointData",
    siblingMemberLabel: "Relics, CellData, ModPointData, ShardData, ResearchPointData, and AcademyPointData",
    progressionPayloadLabel: "InscryptionsDone, EsotericR1Trades, NecrumR1Trades, and Mech1Unlocked",
    typedSiblingContrastLabel: "PlayerProfileData|GemData and PlayerProfileData|GemNodeCombo",
    typedSaveCacheLabel: "PlayerProfileHandler.saveInfoCache: PlayerProfileData",
    typedPlayerProfileFieldTableLabel: "PlayerProfileData field table: 89 direct fields and 1 method",
    typedSaveDataFieldTableLabel: "SaveData field table: 4461 direct fields and 1 method",
    typedSaveDataOwnerLabel: "SaveData directly declares IS71Level, IS110Level, InscryptionsDone, EsotericR1Trades, NecrumR1Trades, Mech1Unlocked, and Mech1MissionsCompleted",
    typedPlayerProfileNestedTypeLabel: "PlayerProfileData+GemData",
    negativeTypedMarketLabel: "no typed Market or MultiverseMarket field recovered on PlayerProfileHandler or PlayerProfileData",
    negativeTypedSaveDataMarketLabel: "no typed Market or MultiverseMarket field recovered on SaveData",
    negativeTypedPlayerProfileProgressionLabel: "PlayerProfileData does not directly declare IS71Level, IS110Level, EsotericR1Trades, NecrumR1Trades, Mech1Unlocked, or Mech1MissionsCompleted in the checked typed field table",
    negativeMultiverseFieldLabel: "MultiverseMarket does not directly declare InscryptionsDone, IS71Level, IS110Level, EsotericR1Trades, NecrumR1Trades, Mech1Unlocked, or Mech1MissionsCompleted in the checked typed probe",
    cloudSaveLabel: "CloudSavePlayerProfile",
    profileInfoLabel: "GetPlayerProfileInfo",
    missingTypeMapLabel: "PlayerProfileData|Market, PlayerProfileData|Inscryption, and PlayerProfileData|MultiverseMarket",
    canonicalHostLabel: "PlayerProfileHandler get_Market accessor bridge",
    exactSaveOwnerLabel: "SaveData"
  };
}

function getMultiverseMarketMetadataSummary(neighborhood) {
  const results = Array.isArray(neighborhood?.results) ? neighborhood.results : [];
  const findAnchor = (anchor) => results.find((entry) => entry.anchor === anchor);
  const flattenStrings = (matches = []) => matches.flatMap((entry) => [
    entry.match_value,
    ...(Array.isArray(entry.context) ? entry.context.map((item) => item.value) : [])
  ]);
  const cloudSaveStrings = flattenStrings(findAnchor("CloudSavePlayerProfile")?.matches ?? []);
  const playerProfileStrings = flattenStrings(findAnchor("PlayerProfileData")?.matches ?? []);
  const inscryptionsStrings = flattenStrings(findAnchor("InscryptionsDone")?.matches ?? []);
  const recoveredIsLevels = [...new Set(
    inscryptionsStrings
      .flatMap((value) => Array.from(String(value).matchAll(/IS(\d+)Level/g), (match) => Number(match[1])))
      .filter((value) => Number.isFinite(value))
      .sort((left, right) => left - right)
  )];

  return {
    hasCloudSavePathClues:
      cloudSaveStrings.some((value) => String(value).includes("CloudSavePlayerProfile"))
      && cloudSaveStrings.some((value) => String(value).includes("GetPlayerProfileInfo")),
    hasSaveFamilyClues:
      playerProfileStrings.some((value) => String(value).includes("PlayerProfileData.cs"))
      && playerProfileStrings.some((value) => String(value).includes("GetPlayerProfileData"))
      && playerProfileStrings.some((value) => String(value).includes("FillPlayerProfileData")),
    hasProgressionFieldCluster:
      inscryptionsStrings.some((value) => String(value).includes("InscryptionsDone"))
      && inscryptionsStrings.some((value) => String(value).includes("EsotericR1Trades")),
    recoveredIsRangeLabel: recoveredIsLevels.length
      ? `IS${recoveredIsLevels[0]}Level through IS${recoveredIsLevels[recoveredIsLevels.length - 1]}Level`
      : ""
  };
}

function formatNumericRanges(values) {
  const normalizedValues = Array.isArray(values)
    ? [...new Set(values.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((left, right) => left - right))]
    : [];
  const ranges = [];
  let rangeStart = null;
  let previous = null;

  normalizedValues.forEach((value) => {
    if (rangeStart === null) {
      rangeStart = value;
      previous = value;
      return;
    }
    if (value === previous + 1) {
      previous = value;
      return;
    }
    ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`);
    rangeStart = value;
    previous = value;
  });

  if (rangeStart !== null) {
    ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`);
  }

  return ranges.join(" and ");
}

function getMultiverseMarketValidatedCoverage(multiverseMarket) {
  const validatedIds = Array.isArray(multiverseMarket?.source?.validated_ids)
    ? [...new Set(multiverseMarket.source.validated_ids.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((left, right) => left - right))]
    : [];

  return {
    hasValidatedRows: validatedIds.length > 0,
    count: validatedIds.length,
    rangeLabel: formatNumericRanges(validatedIds)
  };
}

function getImportedMultiverseMarketPreview(importedMarketState, multiverseMarket, multiverseMarketRangeBoundary) {
  const overlapIds = Array.isArray(multiverseMarketRangeBoundary?.overlapIds)
    ? [...new Set(multiverseMarketRangeBoundary.overlapIds.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((left, right) => left - right))]
    : [];
  const importedState = typeof importedMarketState === "object" && importedMarketState ? importedMarketState : {};
  const overlapIdSet = new Set(overlapIds);
  const importedSpanRows = Object.entries(importedState)
    .map(([key, value]) => {
      const match = /^IS(\d+)Level$/u.exec(String(key));
      if (!match) {
        return null;
      }
      const rowId = Number(match[1]);
      const level = Number(value);
      if (!Number.isFinite(rowId) || rowId < 1 || rowId > 110 || !Number.isFinite(level)) {
        return null;
      }
      return {
        rowId,
        level,
        fieldPath: `compatibility.unmappedSystemState.multiverseMarket.IS${rowId}Level`
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.rowId - right.rowId);
  const importedSpanIds = new Set(importedSpanRows.map((entry) => entry.rowId));
  const importedOverlapRows = importedSpanRows.filter((entry) => overlapIdSet.has(entry.rowId));
  const missingOverlapRows = overlapIds.filter((rowId) => !importedSpanIds.has(rowId));
  const missingSpanRows = [];
  for (let rowId = 1; rowId <= 110; rowId += 1) {
    if (!importedSpanIds.has(rowId)) {
      missingSpanRows.push(rowId);
    }
  }
  const previewRows = importedSpanRows.slice(0, 12);
  const trailingPreviewRows = importedSpanRows.slice(-4);
  const importedTradeCounters = Object.entries(importedState)
    .map(([key, value]) => {
      const match = /^(Esoteric|Necrum)R([1-9])Trades$/u.exec(String(key));
      if (!match) {
        return null;
      }
      return {
        family: match[1],
        rank: Number(match[2]),
        key,
        value,
        fieldPath: `compatibility.unmappedSystemState.multiverseMarket.${key}`
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.family !== right.family) {
        return left.family.localeCompare(right.family);
      }
      return left.rank - right.rank;
    });
  const expectedTradeCounterKeys = [
    ...Array.from({ length: 9 }, (_, index) => `EsotericR${index + 1}Trades`),
    ...Array.from({ length: 9 }, (_, index) => `NecrumR${index + 1}Trades`)
  ];
  const importedTradeKeySet = new Set(importedTradeCounters.map((entry) => entry.key));
  const missingTradeCounterKeys = expectedTradeCounterKeys.filter((key) => !importedTradeKeySet.has(key));
  const tradeCounterFamilies = {
    Esoteric: importedTradeCounters.filter((entry) => entry.family === "Esoteric"),
    Necrum: importedTradeCounters.filter((entry) => entry.family === "Necrum")
  };
  const earlyMechWindowKeys = [
    "Mech1Unlocked",
    "Mech1Units",
    "Mech1Upg1Level",
    "Mech1Upg2Level",
    "Mech1MissionsProgress",
    "FinalMech1MainBonus",
    "Mech1MissionsCompleted",
    "Mech2Unlocked"
  ];
  const importedEarlyMechFields = earlyMechWindowKeys
    .map((key) => {
      const value = importedState[key];
      if (!isBoundaryValuePresent(value)) {
        return null;
      }
      return {
        key,
        value,
        fieldPath: `compatibility.unmappedSystemState.multiverseMarket.${key}`
      };
    })
    .filter(Boolean);
  const importedEarlyMechKeySet = new Set(importedEarlyMechFields.map((entry) => entry.key));
  const missingEarlyMechFields = earlyMechWindowKeys.filter((key) => !importedEarlyMechKeySet.has(key));
  const supportedTextModel = {
    effectLabelLane: "BonusDescriptionText",
    baseBonusLane: "PerLevelBonusText",
    idLane: "IDText",
    quarantinedCurrentValueLane: "CurrentBonusText"
  };
  const rowSummaryShape = {
    shapeId: "multiverse-market-row-local-text-summary",
    groundedFields: [
      {
        key: "effectLabel",
        slotAlias: supportedTextModel.effectLabelLane,
        sourceLane: "SetAllBonusTexts -> SetISNBonusText"
      },
      {
        key: "baseBonus",
        slotAlias: supportedTextModel.baseBonusLane,
        sourceLane: "SetAllChrystosEmporiumTexts -> SetAllBaseBonusTexts -> SetISNBaseBonusText"
      },
      {
        key: "rowIdLabel",
        slotAlias: supportedTextModel.idLane,
        sourceLane: "SetIS1IDText through SetIS110IDText"
      }
    ],
    quarantinedFields: [
      {
        key: "currentValueDisplay",
        slotAlias: supportedTextModel.quarantinedCurrentValueLane,
        status: "quarantined-unrecovered-runtime-only-display-lane"
      }
    ]
  };
  const overlapRowSummaries = importedOverlapRows.map((entry) => ({
    rowId: entry.rowId,
    level: entry.level,
    fieldPath: entry.fieldPath,
    shapeId: rowSummaryShape.shapeId,
    groundedFields: rowSummaryShape.groundedFields.map((field) => ({
      ...field,
      status: "grounded-compatibility-evidence"
    })),
    quarantinedFields: rowSummaryShape.quarantinedFields.map((field) => ({
      ...field,
      reason: "Distinct unrecovered runtime-only display lane"
    }))
  }));

  return {
    hasImportedCompatibilityPreview: importedSpanRows.length > 0 || importedTradeCounters.length > 0 || importedEarlyMechFields.length > 0,
    hasImportedSpanPreview: importedSpanRows.length > 0,
    importTargetPath: "compatibility.unmappedSystemState.multiverseMarket",
    wrapperOnlyFieldLabel: "InscryptionsDone",
    typedSpanLabel: "IS1Level through IS110Level",
    tradeCounterLabel: "EsotericR1Trades through EsotericR9Trades and NecrumR1Trades through NecrumR9Trades",
    earlyMechWindowLabel: "Mech1Unlocked through Mech2Unlocked",
    importedSpanRowCount: importedSpanRows.length,
    totalSpanRowCount: 110,
    importedRangeLabel: importedSpanRows.length ? formatNumericRanges(importedSpanRows.map((entry) => entry.rowId)) : "",
    firstImportedRowLabel: importedSpanRows.length ? `IS${importedSpanRows[0].rowId}Level` : "",
    lastImportedRowLabel: importedSpanRows.length ? `IS${importedSpanRows[importedSpanRows.length - 1].rowId}Level` : "",
    missingSpanRows,
    missingSpanCount: missingSpanRows.length,
    missingSpanLabel: missingSpanRows.length
      ? missingSpanRows.slice(0, 12).map((rowId) => `IS${rowId}Level`).join(", ")
      : "none",
    importedSpanRows,
    hasOverlapGroundedRows: overlapIds.length > 0,
    overlapRangeLabel: formatNumericRanges(overlapIds),
    overlapRowCount: overlapIds.length,
    hasOverlapLevelPreview: importedOverlapRows.length > 0,
    importedOverlapRowCount: importedOverlapRows.length,
    overlapPreviewRows: importedOverlapRows.slice(0, 4),
    overlapRowSummaries: overlapRowSummaries.slice(0, 4),
    missingOverlapRows,
    missingOverlapLabel: missingOverlapRows.length
      ? missingOverlapRows.map((rowId) => `IS${rowId}Level`).join(", ")
      : "none",
    hasTradeCounterPreview: importedTradeCounters.length > 0,
    importedTradeCounters,
    importedTradeCounterCount: importedTradeCounters.length,
    totalTradeCounterCount: expectedTradeCounterKeys.length,
    missingTradeCounterKeys,
    missingTradeCounterLabel: missingTradeCounterKeys.length ? missingTradeCounterKeys.slice(0, 12).join(", ") : "none",
    tradeCounterFamilies,
    tradeCounterSampleLine: importedTradeCounters.length
      ? importedTradeCounters.slice(0, 6).map((entry) => `${entry.key} ${formatBoundaryValue(entry.value)}`).join(" | ")
      : "",
    hasEarlyMechPreview: importedEarlyMechFields.length > 0,
    importedEarlyMechFields,
    importedEarlyMechCount: importedEarlyMechFields.length,
    totalEarlyMechCount: earlyMechWindowKeys.length,
    missingEarlyMechFields,
    missingEarlyMechLabel: missingEarlyMechFields.length ? missingEarlyMechFields.join(", ") : "none",
    previewRows,
    trailingPreviewRows,
    supportedTextModel,
    rowSummaryShape,
    sampleLine: previewRows.length
      ? previewRows.map((entry) => `IS${entry.rowId}Level ${formatShardNumber(entry.level)}`).join(" | ")
      : ""
  };
}

function renderImportedMultiverseMarketPreviewCard(preview) {
  if (!preview.hasImportedCompatibilityPreview) {
    return "";
  }

  return `
    <article class="preview-card">
      <strong>Emporium compatibility preview</strong>
      <p class="meta">This is a descriptive preview of compatibility-only Emporium import state under <code>${escapeHtml(preview.importTargetPath)}</code>. It preserves the checked raw <code>${escapeHtml(preview.typedSpanLabel)}</code> span plus separate bounded trade-counter and early-mech quarantine ranges as non-canonical evidence only.</p>
      <div class="pill-row">
        <span class="pill">${preview.importedSpanRowCount}/${preview.totalSpanRowCount} raw IS rows imported</span>
        <span class="pill">${preview.importedTradeCounterCount}/${preview.totalTradeCounterCount} trade counters imported</span>
        <span class="pill">${preview.importedEarlyMechCount}/${preview.totalEarlyMechCount} early-mech fields imported</span>
        ${preview.hasOverlapGroundedRows ? `<span class="pill">${preview.importedOverlapRowCount}/${preview.overlapRowCount} ordered-overlap rows imported</span>` : ""}
        <span class="pill">Compatibility only</span>
        <span class="pill">Planner blocked</span>
      </div>
      <div class="meta-stack">
        <p class="meta">Only compatibility-only evidence from the checked SaveData quarantine is shown here. This card does not reopen row-label recovery, row remap, planner logic, or canonical PlayerProfile promotion.</p>
        <p class="meta"><code>${escapeHtml(preview.wrapperOnlyFieldLabel)}</code> stays wrapper-only and is intentionally excluded from this preview even when it exists in the imported compatibility blob.</p>
        <p class="meta">The grounded Emporium text model is split: <code>${escapeHtml(preview.supportedTextModel.effectLabelLane)}</code> is the recovered effect-label lane, <code>${escapeHtml(preview.supportedTextModel.baseBonusLane)}</code> is the recovered base-bonus lane, and <code>${escapeHtml(preview.supportedTextModel.idLane)}</code> is the recovered id lane.</p>
        <p class="meta"><code>${escapeHtml(preview.supportedTextModel.quarantinedCurrentValueLane)}</code> remains a distinct unrecovered runtime-only display lane. It is explicitly quarantined from the preview and is not treated as grounded Emporium truth, planner input, or canonical player state.</p>
        <p class="meta">App-side Emporium row summaries now normalize only the grounded lanes into <code>${escapeHtml(preview.rowSummaryShape.shapeId)}</code>: ${preview.rowSummaryShape.groundedFields.map((field) => `<code>${escapeHtml(field.key)}</code> from <code>${escapeHtml(field.slotAlias)}</code>`).join(", ")}. ${preview.rowSummaryShape.quarantinedFields.map((field) => `<code>${escapeHtml(field.key)}</code> stays quarantined as <code>${escapeHtml(field.slotAlias)}</code>`).join(", ")}.</p>
        <p class="meta">${preview.importedRangeLabel ? `Imported raw Emporium levels currently cover ${escapeHtml(preview.firstImportedRowLabel)} through ${escapeHtml(preview.lastImportedRowLabel)} across rows ${escapeHtml(preview.importedRangeLabel)}.` : "No raw Emporium level fields are currently imported from the checked compatibility span."}</p>
        <p class="meta">${preview.missingSpanCount ? `Missing raw span fields still absent from this import: ${escapeHtml(preview.missingSpanLabel)}${preview.missingSpanCount > 12 ? "..." : ""}.` : "All raw fields in the checked IS1Level through IS110Level compatibility span are present in this import."}</p>
        <p class="meta">${preview.hasTradeCounterPreview ? `Imported trade-counter quarantine currently covers ${escapeHtml(preview.tradeCounterLabel)} with ${preview.importedTradeCounterCount} recovered fields.` : "No adjacent trade-counter quarantine fields are currently imported from the checked compatibility envelope."}</p>
        <p class="meta">${preview.missingTradeCounterKeys.length ? `Missing trade-counter quarantine fields: ${escapeHtml(preview.missingTradeCounterLabel)}${preview.missingTradeCounterKeys.length > 12 ? "..." : ""}.` : "All checked Esoteric and Necrum trade-counter quarantine fields are present in this import."}</p>
        <p class="meta">${preview.hasEarlyMechPreview ? `Imported early-mech quarantine currently covers ${escapeHtml(preview.earlyMechWindowLabel)} with ${preview.importedEarlyMechCount} recovered fields.` : "No early-mech quarantine fields are currently imported from the checked compatibility envelope."}</p>
        <p class="meta">${preview.missingEarlyMechFields.length ? `Missing early-mech quarantine fields: ${escapeHtml(preview.missingEarlyMechLabel)}.` : "All checked early-mech quarantine fields are present in this import."}</p>
        <p class="meta">${preview.hasOverlapGroundedRows ? `The checked ordered-overlap support rows ${escapeHtml(preview.overlapRangeLabel)} are tracked only as boundary evidence. Missing ordered-overlap imports: ${escapeHtml(preview.missingOverlapLabel)}.` : "No ordered-overlap support rows are available in this build."}</p>
        <p class="meta">Planner use stays blocked. These imported levels, trade counters, and early-mech fields remain quarantined compatibility evidence, not canonical player truth, not row-label claims, not complete live-text bindings, and not recommendation inputs.</p>
        ${preview.hasOverlapLevelPreview ? `<div class="preview-stack">${preview.overlapRowSummaries.map((entry) => `
          <article class="preview-card">
            <strong>IS${escapeHtml(String(entry.rowId))}Level overlap support</strong>
            <p class="meta">Imported raw level ${escapeHtml(formatShardNumber(entry.level))} at <code>${escapeHtml(entry.fieldPath)}</code>.</p>
            <p class="meta">This row sits inside the checked ordered-overlap support band only. It is still not a recovered player-facing row label or canonical Emporium identity.</p>
            <p class="meta">Structured compatibility evidence from <code>${escapeHtml(entry.shapeId)}</code>:</p>
            <div class="meta-stack">
              ${entry.groundedFields.map((field) => `<p class="meta"><code>${escapeHtml(field.key)}</code> -> <code>${escapeHtml(field.slotAlias)}</code> via <code>${escapeHtml(field.sourceLane)}</code> (${escapeHtml(field.status)})</p>`).join("")}
              ${entry.quarantinedFields.map((field) => `<p class="meta"><code>${escapeHtml(field.key)}</code> -> <code>${escapeHtml(field.slotAlias)}</code> (${escapeHtml(field.status)}; ${escapeHtml(field.reason)})</p>`).join("")}
            </div>
          </article>
        `).join("")}</div>` : ""}
        <div class="preview-stack">${preview.previewRows.map((entry) => `
          <article class="preview-card">
            <strong>IS${escapeHtml(String(entry.rowId))}Level</strong>
            <p class="meta">Imported raw level ${escapeHtml(formatShardNumber(entry.level))}</p>
            <p class="meta"><code>${escapeHtml(entry.fieldPath)}</code></p>
          </article>
        `).join("")}</div>
        ${preview.trailingPreviewRows.length && preview.importedSpanRowCount > preview.previewRows.length ? `<p class="meta">Trailing imported raw rows: ${escapeHtml(preview.trailingPreviewRows.map((entry) => `IS${entry.rowId}Level ${formatShardNumber(entry.level)}`).join(" | "))}</p>` : ""}
        ${preview.hasTradeCounterPreview ? `<div class="preview-stack">${preview.importedTradeCounters.slice(0, 8).map((entry) => `
          <article class="preview-card">
            <strong>${escapeHtml(entry.key)}</strong>
            <p class="meta">Imported raw count ${escapeHtml(formatBoundaryValue(entry.value))}</p>
            <p class="meta"><code>${escapeHtml(entry.fieldPath)}</code></p>
          </article>
        `).join("")}</div>` : ""}
        ${preview.tradeCounterSampleLine ? `<p class="meta">Trade-counter sample: ${escapeHtml(preview.tradeCounterSampleLine)}${preview.importedTradeCounterCount > 6 ? "..." : ""}</p>` : ""}
        ${preview.hasEarlyMechPreview ? `<div class="preview-stack">${preview.importedEarlyMechFields.map((entry) => `
          <article class="preview-card">
            <strong>${escapeHtml(entry.key)}</strong>
            <p class="meta">Imported raw value ${escapeHtml(formatBoundaryValue(entry.value))}</p>
            <p class="meta"><code>${escapeHtml(entry.fieldPath)}</code></p>
          </article>
        `).join("")}</div>` : ""}
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

function getProgressionRecommendationFeedPartition(items) {
  const all = Array.isArray(items) ? items.filter((item) => item?.module === "shards" || item?.module === "loop") : [];
  const valid = [];
  const invalid = [];
  all.forEach((item) => {
    if (getNormalizedRecommendationContractIssues(item).length) {
      invalid.push(item);
      return;
    }
    valid.push(item);
  });
  return { all, valid, invalid };
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
    loop: loopItems
  };
}

function getSelectedProgressionSubsystem() {
  return ["shards", "loop"].includes(state.progressionView) ? state.progressionView : "shards";
}

function renderProgressionSubsystemToggle(subsystemFeed) {
  const counts = {
    shards: Array.isArray(subsystemFeed?.shards) ? subsystemFeed.shards.length : 0,
    loop: Array.isArray(subsystemFeed?.loop) ? subsystemFeed.loop.length : 0
  };
  const selected = getSelectedProgressionSubsystem();
  $("#progressionSubsystemToggle").innerHTML = [
    { id: "shards", label: `Shard Mining (${counts.shards})` },
    { id: "loop", label: `Loop Prestige (${counts.loop})` }
  ].map((item) => `
    <button class="button${selected === item.id ? " is-active" : ""}" type="button" data-progression-view="${escapeHtml(item.id)}" role="tab" aria-selected="${selected === item.id}">
      ${escapeHtml(item.label)}
    </button>
  `).join("");
}

function renderProgressionSubsystemSection(title, eyebrow, description, items, tone) {
  const cards = (Array.isArray(items) ? items : []).map((item) => makeRecommendationCard(item, tone)).join("");
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

  const loopCount = results.filter((item) => item.module === "loop").length;
  const shardCount = results.filter((item) => item.module === "shards").length;
  const contractAudit = getRecommendationContractSummary(results);
  return `
    <article class="validation-card warn">
      <strong>${surface === "overview" ? "Active MVP recommendation feed" : "Progression feed status"}</strong>
      <p class="meta">The current feed ranks trust-oriented warning urgency for the active shard and loop modules. These scores are UI priority, not ROI math.</p>
      <p class="meta">Visible feed items: ${results.length}. Loop guardrails: ${loopCount}. Shard workflow cards: ${shardCount}.</p>
      <p class="meta">${contractAudit.invalidCount === 0 ? "All visible cards currently satisfy the shared recommendation contract." : `Contract gaps still hide ${contractAudit.invalidCount} item${contractAudit.invalidCount === 1 ? "" : "s"} from the active feed (${escapeHtml(contractAudit.topIssueLine)}).`}</p>
      <p class="meta">Spend-planner recommendations remain blocked by system-mapping gaps, so this feed only covers MVP-safe watch notes.</p>
    </article>
  `;
}

function renderRecommendationFeedSupportNotice(results, surface) {
  if (!results.length) {
    return "";
  }

  const titles = results.map((item) => item.title).filter(Boolean);
  return renderSupportSurfaceNotice(
    surface === "overview" ? "Quarantined feed items" : "Quarantined progression items",
    [
      `${results.length} recommendation item${results.length === 1 ? "" : "s"} failed the shared recommendation contract and were removed from the main feed.`,
      titles.length ? `Quarantined titles: ${titles.join(", ")}.` : "Quarantined items are missing expected titles.",
      "Use the contract audit details to repair those cards before treating them as player-facing guidance."
    ]
  );
}

function getRecommendationExplainabilitySummary(results) {
  const withWhyNow = results.filter((item) => Array.isArray(item.whyNow) && item.whyNow.length).length;
  const withAssumptions = results.filter((item) => Array.isArray(item.assumptions) && item.assumptions.length).length;
  const withWarnings = results.filter((item) => Array.isArray(item.warnings) && item.warnings.length).length;
  const withNotes = results.filter((item) => String(item.notes || "").trim()).length;
  const withFullContext = results.filter((item) =>
    Array.isArray(item.whyNow) && item.whyNow.length
    && Array.isArray(item.assumptions) && item.assumptions.length
    && Array.isArray(item.warnings) && item.warnings.length
    && String(item.notes || "").trim()
  ).length;
  const averageConfidence = Math.round(
    (results.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / results.length) * 100
  );
  const partialContext = results.length - withFullContext;
  const missingSourceNotes = results.length - withNotes;

  return {
    withWhyNow,
    withAssumptions,
    withWarnings,
    withNotes,
    withFullContext,
    averageConfidence,
    partialContext,
    missingSourceNotes
  };
}

function getRecommendationContractSummary(results) {
  const issueCounts = new Map();
  let invalidCount = 0;

  results.forEach((item) => {
    const issues = getNormalizedRecommendationContractIssues(item);
    if (!issues.length) {
      return;
    }
    invalidCount += 1;
    issues.forEach((issue) => {
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    });
  });

  const sortedIssues = [...issueCounts.entries()].sort((left, right) => right[1] - left[1]);
  return {
    validCount: results.length - invalidCount,
    invalidCount,
    topIssueLine: sortedIssues.length
      ? `${sortedIssues[0][0]} (${sortedIssues[0][1]} item${sortedIssues[0][1] === 1 ? "" : "s"})`
      : "No contract gaps in the active feed"
  };
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
        ${results.map((item) => `
          <article class="validation-card ${item.pass ? "pass" : "warn"}">
            <strong>${item.title}</strong>
            <p class="meta">${item.scope} ${item.scope === "Support" ? "| quarantined support surface" : item.scope === "APK" ? "| extracted grounding gate" : "| grounded MVP surface"}</p>
            <p class="validation-status">${item.pass ? "PASS" : "WARN"} | Expected: ${item.expected}</p>
            <p class="meta">${item.actual}</p>
          </article>
        `).join("")}
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
    setStatus("importStatus", "Shard milestone manual import stays disabled; this build only uses the bundled grounded descriptive dataset.", "warning");
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
  $("#importPreview").innerHTML = state.importPreview.slice(0, 8).map((row) => `
    <article class="preview-card">
      <strong>Row</strong>
      <pre>${escapeHtml(JSON.stringify(row, null, 2))}</pre>
    </article>
  `).join("");
  setStatus("importStatus", `Previewed ${state.importPreview.length} normalized rows.`, "success");
  return state.importPreview;
}

function normalizeImportRow(row, dataset, index = 0) {
  const clean = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), typeof value === "string" ? value.trim() : value]));
  if (dataset === "gemNodes") {
    return {
      id: clean.id || slugify(clean.label || `gem-node-${index + 1}`),
      label: clean.label || `Gem node ${index + 1}`,
      level: Number(clean.level || 0),
      maxLevel: Number(clean.maxLevel || clean.max_level || 10),
      cost: Number(clean.cost || 0),
      value: Number(clean.value || 0),
      tags: splitList(clean.tags)
    };
  }
  if (dataset === "shardMilestones") {
    return {
      id: clean.id || slugify(clean.label || `shard-milestone-${index + 1}`),
      label: clean.label || `Shard milestone ${index + 1}`,
      notes: clean.notes || "",
      sourceLabel: clean.sourceLabel || clean.source || "",
      sourceUrl: clean.sourceUrl || clean.url || "",
      verified: clean.verified === true || clean.verified === "true"
    };
  }
  if (dataset === "validationCases") {
    return {
      id: clean.id || slugify(clean.title || `validation-${index + 1}`),
      module: clean.module || "ship",
      title: clean.title || `Validation ${index + 1}`,
      expected: clean.expected || "",
      description: clean.description || ""
    };
  }
  if (dataset === "researchTracks") {
    return {
      id: clean.id || slugify(clean.title || `research-${index + 1}`),
      title: clean.title || `Track ${index + 1}`,
      goal: clean.goal || "",
      nextSteps: splitList(clean.nextSteps || clean.next_steps)
    };
  }
  return {
    id: clean.id || slugify(clean.name || `ship-loadout-${index + 1}`),
    name: clean.name || `Imported loadout ${index + 1}`,
    resourceBias: clean.resourceBias || clean.resource || "credits",
    powerScale: Number(clean.powerScale || 1),
    speedScale: Number(clean.speedScale || 1),
    cargoScale: Number(clean.cargoScale || 1),
    risk: clean.risk || "balanced",
    notes: clean.notes || ""
  };
}

function applyImportPreview() {
  const dataset = $("#importDataset").value;
  if (dataset === "shardMilestones") {
    state.importPreview = [];
    setStatus("importStatus", "Shard milestone manual import stays disabled; this build only uses the bundled grounded descriptive dataset.", "warning");
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
  setStatus("importStatus", `Imported ${state.importPreview.length} rows into ${dataset}.`, "success");
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
    ? items.map((item) => `<article class="preview-card"><strong>${escapeHtml(item.name)}</strong><p class="meta">${Math.round(item.size / 1024)} KB | ${item.source}</p></article>`).join("")
    : `<p class="meta">No screenshots selected yet.</p>`;

  renderGeneratorOcrPreview();
  renderGeneratorOcrButtons();

  if (state.generatorOcrBusy) {
    setStatus("generatorOcrStatus", "Parsing generator screenshots...", "warning");
    return;
  }

  if (state.generatorOcrParsed) {
    const count = Object.keys(state.generatorOcrParsed.parsed ?? {}).length;
    setStatus("generatorOcrStatus", `Experimental OCR parsed ${count} generator tiers. Review it carefully before applying.`, "success");
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
      return new File([file], file.name || `clipboard-${Date.now()}-${index + 1}.png`, { type: file.type });
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
  $("#applyGeneratorOcrBtn").disabled = state.generatorOcrBusy || !$("#generatorOcrText").value.trim();
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

  preview.innerHTML = rows.map((row) => {
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
  }).join("");
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
    setStatus("generatorOcrStatus", "Experimental OCR parsed successfully. Review the rows below before applying.", "success");
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
    setStatus("generatorOcrStatus", "Parse screenshots first, or paste parsed generator OCR JSON.", "warning");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    setStatus("generatorOcrStatus", "Generator OCR JSON is not valid.", "warning");
    return;
  }

  const rows = Array.isArray(parsed) ? parsed : Object.entries(parsed).map(([tier, manual]) => ({ tier, manual }));
  const normalized = rows.reduce((accumulator, row, index) => {
    const tierKey = normalizeGeneratorTierKey(row.tier ?? row.mk ?? row.id ?? `n${index + 1}`);
    if (!tierKey) {
      return accumulator;
    }
    accumulator[tierKey] = normalizeCiNumberValue(row.manual ?? row.value ?? row.manualOwned ?? row.amount ?? "");
    return accumulator;
  }, {});

  if (!Object.keys(normalized).length) {
    setStatus("generatorOcrStatus", "No usable generator manual values were found in that JSON.", "warning");
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
  setStatus("generatorOcrStatus", `Applied experimental OCR values for ${Object.keys(normalized).length} generator tiers.`, "success");
}

function persistShipConfig(showStatus = false) {
  saveStoredJson(STORAGE_KEYS.shipConfig, state.shipConfig);
  if (showStatus) {
    setStatus("shipConfigStatus", "Community-tool ship planner state saved.", "success");
  }
}

function getImportedRecordCount() {
  return ["shipLoadouts", "validationCases"]
    .reduce((total, key) => total + (Array.isArray(state.snapshot[key]) ? state.snapshot[key].length : 0), 0);
}

function formatThresholdScheduleSummary(thresholds = {}) {
  return Object.entries(thresholds)
    .filter(([rarity]) => rarity !== "source_ids")
    .map(([rarity, levels]) => `${rarity} ${Array.isArray(levels) ? levels.join("/") : ""}`)
    .join("; ");
}

function getGroundedShardMilestones() {
  return state.shardGrounding?.milestones?.milestones ?? [];
}

function getGroundedShardMechanics() {
  return state.shardGrounding?.milestones?.canonicalMechanics?.shardMilestoneSystem ?? {};
}

function getSelectedShardMilestoneId() {
  return getShardPlannerState().focusMilestoneId
    || getDefaultShardFocusMilestoneId(getGroundedShardMilestones())
    || "";
}

function getDefaultShardFocusMilestoneId(milestones) {
  if (!milestones.length) {
    return "";
  }
  const totalLevels = Number(getShardPlannerState().totalMilestoneLevels || 0);
  return getNextShardUnlockMilestone(totalLevels, milestones)?.id || milestones[0].id;
}

function getShardFocusMilestone() {
  const milestones = getGroundedShardMilestones();
  const selectedId = getSelectedShardMilestoneId();
  return milestones.find((milestone) => milestone.id === selectedId) || milestones[0] || null;
}

function getMilestonesForDisplay() {
  return [...getGroundedShardMilestones()].sort((left, right) => {
    return Number(left.milestoneNumber || 0) - Number(right.milestoneNumber || 0);
  });
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
  const textHandler = monoBehaviours.find((entry) => entry?.scriptName === "ShardPerLevelTextHandler");
  const constructionMilestones = monoBehaviours.find((entry) => entry?.scriptName === "ConstructionMilestones");
  const formatProbeLabel = (entry) => entry
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
    const candidateTuples = Array.isArray(probe?.shardMiningCandidateTuples) ? probe.shardMiningCandidateTuples : [];
    const rowAlignedTuples = Array.isArray(probe?.rowAlignedTupleCandidates) ? probe.rowAlignedTupleCandidates : [];
    const signatureGroups = Array.isArray(probe?.signatureGroups) ? probe.signatureGroups : [];
    const startCostFields = Array.isArray(metadataFamilies.startCostFields) ? metadataFamilies.startCostFields : [];
    const costExponentFields = Array.isArray(metadataFamilies.costExponentFields) ? metadataFamilies.costExponentFields : [];
    const growthExponentFields = Array.isArray(metadataFamilies.growthExponentFields) ? metadataFamilies.growthExponentFields : [];
    const sampleTuple = rowAlignedTuples[0] ?? candidateTuples[0] ?? null;
    return {
    hasFullMetadataFamilies: startCostFields.length === 30 && costExponentFields.length === 30 && growthExponentFields.length >= 30,
    metadataLabel: startCostFields.length === 30 && costExponentFields.length === 30
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

function getShardBonusSlotRowSummary(row) {
  const rows = Array.isArray(state.shardGrounding?.bonusSlotProbe?.rows) ? state.shardGrounding.bonusSlotProbe.rows : [];
  return rows.find((entry) => Number(entry.row) === Number(row)) || null;
}

function getShardRowAlignedCostTuple(row) {
  const tuples = Array.isArray(state.shardGrounding?.costParameterProbe?.rowAlignedTupleCandidates)
    ? state.shardGrounding.costParameterProbe.rowAlignedTupleCandidates
    : [];
  return tuples.find((entry) => Number(entry.row) === Number(row)) || null;
}

function getShardRowDirectValues(row) {
  if (Number(row) === 0) {
    const row0 = state.shardGrounding?.costParameterProbe?.row0PreludeCandidate;
    return Number(row0?.row) === 0 ? row0 : null;
  }
  return getShardRowAlignedCostTuple(row);
}

function getShardExtractedUnlockRequirement(row) {
  const values = Array.isArray(state.shardGrounding?.costParameterProbe?.unlockRequirementBlock?.values)
    ? state.shardGrounding.costParameterProbe.unlockRequirementBlock.values
    : [];
  const value = values[Number(row)];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function getShardExtractedBonusPerLevel(row, bonusIndex) {
  const directValues = getShardRowDirectValues(row);
  const bonusValues = Array.isArray(directValues?.bonusPerLevelValues) ? directValues.bonusPerLevelValues : [];
  const value = bonusValues[bonusIndex];
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function getShardExtractedCostFieldMapping(row) {
  const directValues = getShardRowDirectValues(row);
  return directValues?.strongestFieldOrderMapping || null;
}

function getShardNativeCostRowSummary(row) {
  const rows = Array.isArray(state.shardGrounding?.costNativeProbe?.rows) ? state.shardGrounding.costNativeProbe.rows : [];
  return rows.find((entry) => Number(entry.row) === Number(row)) || null;
}

function formatShardNativeThresholdStage(stage) {
  const minimumLevel = Number(stage?.minimumLevel);
  const getterName = stage?.getterName || "Unknown getter";
  const baseFieldName = stage?.baseFieldName || "Unknown base";
  if (!Number.isFinite(minimumLevel)) {
    return `${getterName} | ${baseFieldName}`;
  }
  return `${formatShardNumber(minimumLevel)}+ via ${getterName} and ${baseFieldName}`;
}

function getShardNativeCostStageSummary(row, level = 0) {
  const nativeRow = getShardNativeCostRowSummary(row);
  const stages = Array.isArray(nativeRow?.thresholdStages) ? nativeRow.thresholdStages : [];
  if (!stages.length) {
    return {
      stageLabel: "Native cost stages not yet recovered for this row.",
      nextStageLabel: "No higher native over-level stage recovered.",
      thresholdStageLabel: ""
    };
  }
  const orderedStages = stages
    .filter((stage) => Number.isFinite(Number(stage?.minimumLevel)))
    .sort((left, right) => Number(left.minimumLevel) - Number(right.minimumLevel));
  const stageLabel = orderedStages.map((stage) => formatShardNativeThresholdStage(stage)).join(" | ");
  const nextStage = orderedStages.find((stage) => Number(stage.minimumLevel) > Number(level)) || null;
  return {
    stageLabel,
    nextStageLabel: nextStage
      ? `Next native cost stage: ${formatShardNativeThresholdStage(nextStage)}`
      : "No higher native over-level stage recovered.",
    thresholdStageLabel: orderedStages.length
      ? `Verified stage order: base lane -> ${orderedStages.map((stage) => `${formatShardNumber(stage.minimumLevel)}+`).join(" -> ")}`
      : ""
  };
}

function getShardFormulaApplicationProfile(row) {
  const profiles = state.shardGrounding?.costNativeProbe?.formulaApplicationProfiles;
  if (!profiles) {
    return null;
  }
  if (Number(row) === 0) {
    return profiles.rowZero || null;
  }
  const normalRows = Array.isArray(profiles.normalRows) ? profiles.normalRows : [];
  return normalRows.find((entry) => Array.isArray(entry?.rows) && entry.rows.includes(Number(row))) || null;
}

function formatShardFormulaClassLabel(formulaClass) {
  const labels = {
    "row0-special-case": "Row 0 special case",
    "canonical-additive-premerge": "Canonical full recipe",
    "canonical-literal-builder": "Canonical full recipe",
    "drop-400-stage": "Drops 400+ stage",
    "two-stage-transition-band": "100/200 transition band",
    "hundred-stage-short-class": "100-only short class"
  };
  return labels[formulaClass] || "Unresolved native class";
}

function formatShardExtractedBonusPerLevel(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(3).replace(/\.?0+$/u, "")}x` : "Unknown";
}

function formatShardExtractedCostFieldMapping(mapping) {
  if (!mapping || typeof mapping !== "object" || !mapping.values) {
    return "Not recovered in direct row payload";
  }
  const fieldNames = Array.isArray(mapping.fieldNames) ? mapping.fieldNames : Object.keys(mapping.values);
  const parts = fieldNames
    .filter((fieldName) => Number.isFinite(Number(mapping.values?.[fieldName])))
    .map((fieldName) => `${fieldName} ${formatProbeNumber(mapping.values[fieldName])}`);
  if (!parts.length) {
    return "Not recovered in direct row payload";
  }
  const auxValue = mapping.auxiliaryIntCandidate;
  if (Number.isFinite(Number(auxValue))) {
    parts.push(`aux int ${formatProbeNumber(auxValue)}`);
  }
  return parts.join(" | ");
}

function getShardMilestoneGroundedSummary(milestone) {
  const row = Number(milestone?.milestoneNumber);
  const rowModelBoundary = getShardMilestoneRowModelBoundarySummary(state.shardGrounding?.rowModelBoundary);
  const titleEffectBoundary = state.shardGrounding?.titleEffectBoundary;
  const titleEffectSummary = getShardMilestoneTitleEffectBoundarySummary(titleEffectBoundary);
  const effectTextHandlerBoundary = getShardEffectTextHandlerBoundarySummary(state.shardGrounding?.effectTextHandlerBoundary);
  const costModelBoundary = getShardCostModelBoundarySummary(state.shardGrounding?.costModelBoundary);
  const costParameterProbe = getShardCostParameterProbeSummary(state.shardGrounding?.costParameterProbe);
  const bonusSlotSummary = getShardBonusSlotRowSummary(row);
  const directRowValues = getShardRowDirectValues(row);
  const extractedUnlockRequirement = getShardExtractedUnlockRequirement(row);
  const titleCandidates = (Array.isArray(titleEffectBoundary?.titleAssetCandidates) ? titleEffectBoundary.titleAssetCandidates : [])
    .filter((entry) => entry?.row === row)
    .map((entry) => entry.title);
  const uniqueTitles = [...new Set(titleCandidates)];
  const bonusCalcAccessors = (Array.isArray(titleEffectBoundary?.sampleBonusCalcAccessors) ? titleEffectBoundary.sampleBonusCalcAccessors : [])
    .filter((name) => name.startsWith(`get_SU${row}Bonus`));
  const hasRowCostAccessor = rowModelBoundary.hasBoundary
    && (((row >= 0 && row <= 9) || (row >= 23 && row <= 29)));
  const titleCoverageStatusLabel = uniqueTitles.length ? "Available" : "Unmapped";
  const rowShellStatusLabel = rowModelBoundary.hasBoundary ? "Unmapped" : "Blocked";
  const effectStatusLabel = effectTextHandlerBoundary.hasBoundary && titleEffectSummary.hasEffectPresentationFamily ? "Available" : "Blocked";
  const costStatusLabel = directRowValues
    ? "Available"
    : (row === 0 || hasRowCostAccessor || costParameterProbe.hasRowAlignedTuples || costParameterProbe.hasCandidateTuples || costModelBoundary.hasSampledCostWindows)
      ? "Integrated"
      : "Blocked";
  return {
    titleCoverageTone: uniqueTitles.length ? "pass" : "warn",
    titleCoverageStatusLabel,
    titleCoverageStatusClass: `shard-status-pill-${titleCoverageStatusLabel.toLowerCase()}`,
    titleCoverageLine: uniqueTitles.length > 1
      ? `Row ${row} has multiple shipped title candidates, so the UI keeps the label descriptive: ${uniqueTitles.join(" | ")}.`
      : uniqueTitles.length === 1
        ? `Row ${row} has a shipped title candidate: ${uniqueTitles[0]}.`
        : `Row ${row} does not yet have a preserved shipped title candidate in the checked bundle.`,
    rowShellTone: rowModelBoundary.hasBoundary ? "pass" : "warn",
    rowShellStatusLabel,
    rowShellStatusClass: `shard-status-pill-${rowShellStatusLabel.toLowerCase()}`,
    rowShellLine: rowModelBoundary.hasBoundary
      ? `Row ${row} sits on a recovered shard-local row shell, but its final player-owned owner mapping is still unresolved.`
      : `The checked row-model bundle is not strong enough to map row ${row} safely yet.`,
    effectTone: effectTextHandlerBoundary.hasBoundary && titleEffectSummary.hasEffectPresentationFamily ? "pass" : "warn",
    effectStatusLabel,
    effectStatusClass: `shard-status-pill-${effectStatusLabel.toLowerCase()}`,
    effectLine: bonusCalcAccessors.length
      ? `Recovered shard-side effect evidence preserves ${bonusSlotSummary?.bonusFieldCount ?? bonusCalcAccessors.length} row-local bonus slots for this row.`
      : effectTextHandlerBoundary.hasBoundary && titleEffectSummary.hasEffectPresentationFamily
        ? `Recovered shard-side effect evidence is attached to this row.${bonusSlotSummary ? ` Metadata also preserves ${bonusSlotSummary.bonusFieldCount} bonus slots.` : ""}${bonusSlotSummary && !bonusSlotSummary.matchesGroundedCount ? " Descriptive bonus entries still undershoot the recovered slot count." : ""}`
        : `The current build does not preserve a strong enough shard-side effect path for row ${row}.`,
    costTone: row === 0 || hasRowCostAccessor || directRowValues ? "pass" : "warn",
    costStatusLabel,
    costStatusClass: `shard-status-pill-${costStatusLabel.toLowerCase()}`,
    costLine: row === 0 && costModelBoundary.hasRow0FormulaShell
      ? `${costParameterProbe.hasFullMetadataFamilies ? "Recovered metadata preserves the full row-local shard-cost family." : "Recovered metadata preserves part of the row-local shard-cost family."} ${directRowValues ? "Row 0 also preserves direct serialized cost values." : costParameterProbe.hasRowAlignedTuples ? `Other rows already preserve ${costParameterProbe.rowAlignedTupleCount} direct row-aligned cost value groups.` : costParameterProbe.hasCandidateTuples ? "Additional numeric shard-cost evidence is present but not yet row-complete." : "Numeric row values are still blocked."} The app shows this as descriptive evidence only, not exact next-cost certainty.`
      : hasRowCostAccessor && costModelBoundary.hasSampledCostWindows
        ? `${directRowValues ? "This row preserves direct serialized shard-cost values and bonus-per-level evidence." : costParameterProbe.hasRowAlignedTuples ? "Nearby rows preserve row-aligned shard-cost value groups, which supports this row's cost lane." : "The row-specific cost lane is identified, but its direct numeric values are still blocked."} The app keeps this evidence descriptive until owner mapping and exact cost math are verified.`
      : directRowValues
          ? `This row preserves direct shard-cost values, which is enough for a descriptive evidence note but not enough for exact affordability or best-buy claims.`
          : `${costParameterProbe.hasFullMetadataFamilies ? "Recovered shard-cost field families exist globally." : "Only a partial shard-cost shell is recovered so far."} ${costParameterProbe.hasRowAlignedTuples ? "Direct row-aligned cost evidence exists for other rows, but this row is not fully mapped yet." : costParameterProbe.hasCandidateTuples ? "Unmapped numeric shard-cost evidence exists, but it is not attached to this row yet." : "Only generic cost-bump notes remain available."}`
    ,
    extractedUnlockRequirement
  };
}

function getShardMilestoneDisplayName(milestone) {
  const row = Number(milestone?.milestoneNumber);
  const titleCandidates = (Array.isArray(state.shardGrounding?.titleEffectBoundary?.titleAssetCandidates)
    ? state.shardGrounding.titleEffectBoundary.titleAssetCandidates
    : [])
    .filter((entry) => entry?.row === row)
    .map((entry) => String(entry.title || "").trim())
    .filter(Boolean);
  const uniqueTitles = [...new Set(titleCandidates)];
  if (uniqueTitles.length === 1) {
    return uniqueTitles[0];
  }
  return milestone?.name || `Milestone ${row}`;
}

function getShardMilestonePanelTitle(milestone) {
    const row = Number(milestone?.milestoneNumber ?? 0);
    const displayName = getShardMilestoneDisplayName(milestone);
    const normalizedName = String(displayName || "")
      .replace(/^The\s+/i, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+Milestone$/i, "")
      .trim();
    return `#${row} THE ${normalizedName.toUpperCase()} MILESTONE`;
  }

function getShardMilestoneLevelRailSummary(milestone) {
  const row = Number(milestone?.milestoneNumber ?? 0);
  const directValues = getShardRowDirectValues(row);
  const profile = getShardFormulaApplicationProfile(row);
  const nativeSummary = getShardNativeCostStageSummary(row, getShardFocusLevelForMilestone(milestone));
  return {
    buttonLabel: "Level up",
    costLabel: directValues
      ? "Verified row inputs recovered; exact cost formula still unresolved."
      : "Current cost formula not yet verified.",
    formulaLabel: profile
      ? `${formatShardFormulaClassLabel(profile.formulaClass)}${profile.stageCoverage ? ` (${profile.stageCoverage})` : ""}`
      : (row === 0 ? "Row 0 special case" : "Unresolved native class"),
    stageLabel: nativeSummary.thresholdStageLabel || nativeSummary.stageLabel,
    nextStageLabel: nativeSummary.nextStageLabel
  };
}

function getShardMilestoneDisplayMeta(milestone) {
  const preferredTitle = getShardMilestoneDisplayName(milestone);
  const sourceTitle = milestone?.name || "";
  if (preferredTitle && sourceTitle && preferredTitle !== sourceTitle) {
    return `Community alias: ${sourceTitle}`;
  }
  return `Unlock ${describeUnlockCondition(milestone?.unlockCondition)}`;
}

function parseShardNumericLabel(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const normalized = text.replace(",", ".").replace(/\s+/g, "");
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)$/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseShardBonusDescriptor(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const normalized = text.replace(",", ".").replace(/\s+/g, "");
  const multiplierMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)x$/i);
  if (multiplierMatch) {
    return {
      kind: "multiplier",
      value: Number(multiplierMatch[1])
    };
  }
  const secondsPerLevelMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)s\/level$/i);
  if (secondsPerLevelMatch) {
    return {
      kind: "seconds-per-level",
      value: Number(secondsPerLevelMatch[1])
    };
  }
  const secondsMatch = normalized.match(/^([0-9]+(?:\.[0-9]+)?)s$/i);
  if (secondsMatch) {
    return {
      kind: "seconds",
      value: Number(secondsMatch[1])
    };
  }
  return null;
}

function formatShardComputedMultiplier(value) {
  if (!Number.isFinite(value)) {
    return "Unresolved";
  }
  if (Math.abs(value) >= 1000) {
    return `x${formatShardNumber(value)}`;
  }
  if (Math.abs(value) >= 1) {
    return `x${Number(value.toFixed(3)).toString()}`;
  }
  return `x${Number(value.toPrecision(4)).toString()}`;
}

function formatShardComputedSeconds(value) {
  if (!Number.isFinite(value)) {
    return "Unresolved";
  }
  return `${Number(value.toFixed(3)).toString()}s`;
}

function getShardComputedBonusSummary(milestone, bonus, observedLevelValue) {
  const observedLevel = Number(observedLevelValue || 0);
  if (!Number.isFinite(observedLevel) || observedLevel <= 0) {
    return {
      currentLabel: "Enter an observed level",
      nextLabel: "Enter an observed level"
    };
  }
  const unlockLevel = Number.isFinite(Number(bonus?.unlockLevel)) ? Number(bonus.unlockLevel) : null;
  if (unlockLevel !== null && observedLevel < unlockLevel) {
    return {
      currentLabel: `Locked until level ${formatShardNumber(unlockLevel)}`,
      nextLabel: `Locked until level ${formatShardNumber(unlockLevel)}`
    };
  }
  const activeLevels = unlockLevel === null ? observedLevel : Math.max(observedLevel - unlockLevel + 1, 0);
  const nextActiveLevels = unlockLevel === null ? observedLevel + 1 : Math.max(observedLevel + 1 - unlockLevel + 1, 0);
  const initialDescriptor = parseShardBonusDescriptor(bonus?.initialBonus);
  const bonusIndex = Array.isArray(milestone?.bonuses) ? milestone.bonuses.indexOf(bonus) : -1;
  const extractedPerLevelValue = bonusIndex >= 0 ? getShardExtractedBonusPerLevel(milestone?.milestoneNumber, bonusIndex) : null;
  const perLevelDescriptor = Number.isFinite(extractedPerLevelValue)
    ? { kind: "multiplier", value: extractedPerLevelValue }
    : parseShardBonusDescriptor(bonus?.bonusPerLevel);
  if (perLevelDescriptor?.kind === "multiplier") {
    if (initialDescriptor?.kind === "multiplier") {
      const current = initialDescriptor.value * Math.pow(perLevelDescriptor.value, Math.max(activeLevels - 1, 0));
      const next = initialDescriptor.value * Math.pow(perLevelDescriptor.value, Math.max(nextActiveLevels - 1, 0));
      return {
        currentLabel: `${formatShardComputedMultiplier(current)} (descriptive model)`,
        nextLabel: `${formatShardComputedMultiplier(next)}`
      };
    }
    if (unlockLevel === null || unlockLevel === 1) {
      const current = Math.pow(perLevelDescriptor.value, observedLevel);
      const next = Math.pow(perLevelDescriptor.value, observedLevel + 1);
      return {
        currentLabel: `${formatShardComputedMultiplier(current)} (per-level multiplicative model)`,
        nextLabel: `${formatShardComputedMultiplier(next)}`
      };
    }
  }
  if (initialDescriptor?.kind === "seconds" && perLevelDescriptor?.kind === "seconds-per-level") {
    const current = initialDescriptor.value + perLevelDescriptor.value * Math.max(activeLevels - 1, 0);
    const next = initialDescriptor.value + perLevelDescriptor.value * Math.max(nextActiveLevels - 1, 0);
    return {
      currentLabel: `${formatShardComputedSeconds(current)} (descriptive model)`,
      nextLabel: formatShardComputedSeconds(next)
    };
  }
  return {
    currentLabel: "Current value unresolved from checked inputs",
    nextLabel: "Need typed bonus model or known initial value"
  };
}

function getShardUnlockRequirement(milestone) {
  if (milestone?.unlockCondition?.type === "total_milestone_levels_required") {
    return Number(milestone.unlockCondition.value || 0);
  }
  return 0;
}

function getNextShardUnlockMilestone(totalLevels, milestones = getGroundedShardMilestones()) {
  return milestones
    .filter((milestone) => milestone.unlockCondition?.type === "total_milestone_levels_required")
    .sort((left, right) => getShardUnlockRequirement(left) - getShardUnlockRequirement(right))
    .find((milestone) => getShardUnlockRequirement(milestone) > totalLevels)
    || null;
}

function getThresholdScheduleForMilestone(milestone, mechanics = getGroundedShardMechanics()) {
  if (Array.isArray(milestone?.fixedBreakpoints) && milestone.fixedBreakpoints.length) {
    return milestone.fixedBreakpoints;
  }
  const rarity = normalizeShardRarityKey(milestone?.rarity);
  return Object.entries(mechanics.rarity_bonus_thresholds ?? {})
    .filter(([key]) => key !== "source_ids")
    .find(([key]) => normalizeShardRarityKey(key) === rarity)?.[1] ?? [];
}

function getNextShardThreshold(milestone, currentLevel, mechanics = getGroundedShardMechanics()) {
  return getThresholdScheduleForMilestone(milestone, mechanics).find((level) => Number(level) > Number(currentLevel || 0)) ?? null;
}

function getNextShardCostBump(currentLevel) {
  const level = Number(currentLevel || 0);
  const nextHundred = Math.floor(level / 100) * 100 + 100;
  if (!Number.isFinite(nextHundred) || nextHundred <= 0) {
    return null;
  }
  let severity = "larger bump";
  if (nextHundred === 100 || nextHundred === 400) {
    severity = "large bump";
  } else if (nextHundred === 200 || nextHundred === 300) {
    severity = "small bump";
  }
  return { level: nextHundred, severity };
}

function getPrimaryShardObservation() {
  return (state.shardGrounding?.observedBehaviors?.observations ?? [])
    .map((observation) => ({
      ...observation,
      title: getObservationTitle(observation)
    }))[0] ?? null;
}

function getObservedBehaviorById(id) {
  return (state.shardGrounding?.observedBehaviors?.observations ?? []).find((observation) => observation.id === id) || null;
}

function getSourceTitlesForIds(sourceIds = []) {
  const sourceMap = state.shardGrounding?.provenance?.sources ?? {};
  return sourceIds
    .map((sourceId) => sourceMap[sourceId]?.title)
    .filter(Boolean);
}

function getMilestoneSourceLabel(milestone) {
  const titles = getSourceTitlesForIds(milestone?.sourceIds || []);
  return titles.length ? titles.join(" | ") : "";
}

function getProvenanceConflictNote() {
  return (state.shardGrounding?.provenance?.uncertaintyLog ?? []).find((entry) => entry.status === "conflict_detected")?.what_is_missing || "";
}

function getObservationTitle(observation) {
  const playerState = observation?.playerState ?? {};
  return playerState.run_type
    || playerState.context
    || playerState.lr_range
    || observation.id.replaceAll("_", " ");
}

function describeUnlockCondition(unlockCondition = {}) {
  if (unlockCondition.type === "total_milestone_levels_required") {
    return `${formatShardNumber(unlockCondition.value)} total milestone levels`;
  }
  if (unlockCondition.type === "event") {
    return String(unlockCondition.value || "Event unlock");
  }
  return "No grounded unlock condition captured";
}

function normalizeShardRarityKey(value) {
  return String(value || "").trim().toLowerCase();
}

function formatShardRarity(value) {
  const text = String(value || "").trim();
  return text ? text.replace(/\b\w/g, (char) => char.toUpperCase()) : "Unknown";
}

function formatThresholdLevels(levels) {
  return Array.isArray(levels) && levels.length ? levels.join(" / ") : "No explicit thresholds captured";
}

function formatOptionalNumber(value) {
  return value === null || value === undefined || value === "" || Number.isNaN(Number(value))
    ? "Not tracked"
    : formatShardNumber(value);
}

function formatProbeNumber(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return "Not tracked";
  }
  if (Math.abs(numericValue) >= 1000) {
    return formatShardNumber(numericValue);
  }
  if (Math.abs(numericValue) >= 1) {
    return Number(numericValue.toFixed(3)).toString();
  }
  return Number(numericValue.toPrecision(4)).toString();
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

function getProfileCompletion(profile) {
  const filled = Object.values(ACTIVE_PROFILE_FORM_FIELD_PATHS)
    .filter((path) => String(path.reduce((current, key) => current?.[key], profile) ?? "").trim() !== "").length;
  const fields = Object.keys(ACTIVE_PROFILE_FORM_FIELD_PATHS);
  return Math.round((filled / fields.length) * 100);
}

function toRecommendationAction(item, fallbackModule) {
  return normalizeRecommendationAction(item, fallbackModule);
}

function sanitizeRecommendationLines(value) {
  return sanitizeNormalizedRecommendationLines(value);
}

function getPlannerHelperCompletion(profile) {
  const plannerPaths = [
    ["planning", "shards", "totalMilestoneLevels"]
  ];
  const filled = plannerPaths
    .filter((path) => String(path.reduce((current, key) => current?.[key], profile) ?? "").trim() !== "").length;
  return Math.round((filled / plannerPaths.length) * 100);
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
  ].filter(Boolean).join("");
  const whyNow = Array.isArray(item.whyNow) && item.whyNow.length
    ? `<div class="meta-stack"><p class="snapshot-title">Why now</p>${item.whyNow.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
    : "";
  const benefit = Array.isArray(item.benefit) && item.benefit.length
    ? `<div class="meta-stack"><p class="snapshot-title">Player value</p>${item.benefit.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
    : "";
  const assumptions = Array.isArray(item.assumptions) && item.assumptions.length
    ? `<div class="meta-stack"><p class="snapshot-title">Assumptions</p>${item.assumptions.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
    : "";
  const warnings = Array.isArray(item.warnings) && item.warnings.length
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
  const contractIssues = getNormalizedRecommendationContractIssues(item);
  const confidence = Math.round((item.confidence ?? 0.5) * 100);
  const toneClass = module === "loop" || item.kind === "warning" ? "watch-note-warn" : "watch-note-pass";
  const subtitle = item.subtitle ?? (module === "shards" ? "Shard Mining" : "Loop Prestige");
  const primaryLine = getCompactProgressionNoteLine(item.warnings)
    || getCompactProgressionNoteLine(item.whyNow)
    || item.notes
    || "";
  const secondaryLine = getCompactProgressionNoteLine(item.whyNow, primaryLine)
    || getCompactProgressionNoteLine(item.assumptions, primaryLine)
    || getCompactProgressionNoteLine(item.benefit, primaryLine)
    || "";
  const sourceLine = item.notes || getCompactProgressionNoteLine(item.assumptions) || "";
  const detailPills = [
    `<span class="pill">${escapeHtml(module === "shards" ? "shard watch" : "loop watch")}</span>`,
    `<span class="pill pill-neutral">confidence ${confidence}%</span>`,
    item.cost ? `<span class="pill pill-neutral">cost ${escapeHtml(item.cost)}</span>` : "",
    item.eta ? `<span class="pill pill-neutral">eta ${escapeHtml(item.eta)}</span>` : "",
    contractIssues.length ? `<span class="pill watch-note-pill-warn">contract gap</span>` : ""
  ].filter(Boolean).join("");
  return `
    <article class="recommendation-card watch-note-card ${toneClass}">
      <div class="recommendation-head watch-note-head">
        <div>
          <p class="eyebrow">${escapeHtml(subtitle)}</p>
          <strong>${escapeHtml(item.title)}</strong>
        </div>
        <span class="score">${Number(item.score).toFixed(1)}</span>
      </div>
      <div class="pill-row">
        ${detailPills}
      </div>
      ${primaryLine ? `<p class="meta watch-note-primary">${escapeHtml(primaryLine)}</p>` : ""}
      ${secondaryLine ? `<p class="meta">${escapeHtml(secondaryLine)}</p>` : ""}
      ${sourceLine ? `<p class="meta watch-note-source">${escapeHtml(sourceLine)}</p>` : ""}
    </article>
  `;
}

function getCompactProgressionNoteLine(lines, exclude = "") {
  const list = Array.isArray(lines) ? lines : [];
  return list.find((line) => line && line !== exclude) || "";
}

function getRecommendationExplainabilityAudit(item) {
  const missing = [];
  if (!Array.isArray(item.whyNow) || !item.whyNow.length) {
    missing.push("Why now");
  }
  if (!Array.isArray(item.assumptions) || !item.assumptions.length) {
    missing.push("Assumptions");
  }
  if (!Array.isArray(item.warnings) || !item.warnings.length) {
    missing.push("Warnings");
  }
  if (!String(item.notes || "").trim()) {
    missing.push("Source note");
  }

  return {
    status: missing.length ? "Partial context" : "Complete context",
    sourceNoteStatus: String(item.notes || "").trim() ? "Present" : "Missing",
    missingLine: missing.length ? `Missing: ${missing.join(", ")}.` : "Missing: none."
  };
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
  return String(value).split(/[|;]/).map((entry) => {
    const [level, bonusValue, reason] = entry.split(":");
    return {
      level: Number(level || 0),
      bonusValue: Number(bonusValue || 0),
      reason: reason || ""
    };
  }).filter((item) => item.level > 0);
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

function scorePowerTerm(term, weights, meltdown) {
  if (!term) {
    return 1;
  }
  if (term.includes("Mods+Shards")) {
    return Math.max(Number(weights.Mods || 0) + Number(weights.Shards || 0), 1);
  }
  if (term.includes("HighestGen")) {
    const highest = getHighestGen();
    const limit = /,\s*(\d+)/.exec(term);
    return Math.max(Math.min(highest, Number(limit?.[1] || 8)) * meltdown, 1e-9);
  }
  if (term.includes("MaxGenHWunlocked+MaxGenSWunlocked")) {
    const total = Number(getShipCommunityToolState().techLevels.MaxGenHWunlocked || 0) + Number(getShipCommunityToolState().techLevels.MaxGenSWunlocked || 0);
    return Math.max(Math.min(total, 16) * meltdown, 1e-9);
  }
  if (term.includes("MaxGenHWunlocked")) {
    return Math.max(Math.min(Number(getShipCommunityToolState().techLevels.MaxGenHWunlocked || 0), 8) * meltdown, 1e-9);
  }
  if (term.includes("MaxGenSWunlocked")) {
    return Math.max(Math.min(Number(getShipCommunityToolState().techLevels.MaxGenSWunlocked || 0), 8) * meltdown, 1e-9);
  }
  if (term.includes("Meltdown")) {
    return Math.max(meltdown, 1e-9);
  }
  return 1;
}

  function getEffectWeight(effectTypes, weights) {
    const map = {
      cells: Number(weights.CellsAndGens || 1),
      gens: Number(weights.CellsAndGens || 1),
      mp: Number(weights.Mods || 1),
      shards: Number(weights.Shards || 1),
    rp: Number(weights.RP || 1),
    ap: Number(weights.AP || 1),
      materials: Number(weights.Mats || 1),
      other: Math.max(Number(weights.CellsAndGens || 1), Number(weights.Mats || 1))
    };
      const list = Array.isArray(effectTypes) ? effectTypes : [effectTypes];
      return Math.max(...list.map((effectType) => Math.max(map[normalizeEffectType(effectType)] || 1, 1)));
    }

  function getLanePriority(effectType, weights) {
      const normalized = normalizeEffectType(effectType);
      const enabled = getActiveLoadout().filters?.[normalized];
      if (enabled !== false) {
        return getEffectWeight(normalized, weights);
      }
      if (getShipCommunityToolState().innovation.softCap) {
        return 0.01;
      }
      return 0;
  }

  function getInstallEffectTypes(shipKey, installIndex) {
      const effectTypes = DESMOS_INSTALL_WEIGHT_MAPS[shipKey]?.[installIndex]
        ?? state.shipTemplates[shipKey].installs[installIndex].effectTypes
        ?? ["other"];
      return (Array.isArray(effectTypes) ? effectTypes : [effectTypes]).map(normalizeEffectType);
    }

  function getInstallWeight(shipKey, installIndex, weights) {
      const effectTypes = getInstallEffectTypes(shipKey, installIndex);
      return Math.max(
        ...effectTypes.map((effectType) => {
          return getLanePriority(effectType, weights);
        })
      );
    }

  function getShipInstallLayout(shipKey) {
    return SHIP_INSTALL_INDEX_LAYOUTS[shipKey] ?? SHIP_INSTALL_INDEX_LAYOUTS.default;
  }

  function normalizeEffectType(effectType) {
    if (effectType === "mods") {
      return "mp";
    }
    if (effectType === "mats") {
      return "materials";
    }
    return effectType;
  }

  function getDisplayEffectTypes(effectTypes) {
    const list = Array.isArray(effectTypes) ? effectTypes : [effectTypes];
    return [...new Set(list.map((effectType) => {
      const normalized = normalizeEffectType(effectType);
      return normalized === "gens" ? "cells" : normalized;
    }))];
  }

  function getPrimaryEffectClass(effectTypes) {
    return getDisplayEffectTypes(effectTypes)[0];
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

function getHighestGen() {
  return Math.max(
    Number(getShipCommunityToolState().techLevels.MaxGenHWunlocked || 0),
    Number(getShipCommunityToolState().techLevels.MaxGenSWunlocked || 0)
  );
}

function getShipCrew(shipKey) {
  const crew = getShipCommunityToolState().crew;
  const map = {
    C: Number(crew.Crew || 0),
    A: Number(crew.AuxesiaCrew || 0),
    Zg: Number(crew.ZagreusCrew || 0),
    H: Number(crew.HephaestusCrew || 0),
    D: Number(crew.DemeterCrew || 0),
    K: Number(crew.KoiosCrew || 0),
    Ze: Number(crew.ZeusCrew || 0)
  };
  return map[shipKey] || 0;
}

function getShipInnovationMultiplier(shipKey) {
  const innovation = getShipCommunityToolState().innovation;
  const dark = innovation.darkInno ? 3 : 1;
  const main = ["C", "A", "Zg", "H"].includes(shipKey)
    ? (innovation.inno1 ? 7 : 1)
    : (innovation.inno2 ? 222 : 1);
  return main * dark;
}

function getInstallBaseMultiplier(shipKey, installIndex) {
  const shipPlayerState = getShipCommunityToolState();
  const gears = shipPlayerState.academyGears;
  const generators = shipPlayerState.generators;
  const tech = shipPlayerState.techLevels;
  const zagreus = shipPlayerState.zagreus;
  const hephaestus = shipPlayerState.hephaestus;
  const demeter = shipPlayerState.demeter;
  const koios = shipPlayerState.koios;
  const zeus = shipPlayerState.zeus;
  const innovation = getShipInnovationMultiplier(shipKey);
  const ticksRun = getTicksRun();
  const ops = getOperationsTotal();
  const studies = getStudiesTotal();
  const missions = getMissionTotal();
  const totalGenerators = sum(Object.values(generators));
  const sTechs = Number(tech.S_techs || 0);
  const sHw = Math.round(0.998 * sTechs / 2);
  const sSw = Math.round(1.002 * sTechs / 2);

  const formulas = {
    C: [
      0.1 * Math.pow(1.01, Number(gears.G13 || 0)),
      0.05,
      0.05,
      0.005 * Number(generators.n2 || 0),
      0.03,
      0.03,
      0.004 * Number(generators.n3 || 0),
      0.00005 * totalGenerators,
      0.00007 * totalGenerators,
      0.00006 * totalGenerators,
      0.00027 * totalGenerators
    ],
    A: [
      0.01 * Math.pow(1.02, Number(gears.G6 || 0)),
      0.01 * Math.pow(1.01, Number(gears.G18 || 0)) * Math.pow(1.02, Number(gears.G7 || 0)),
      0.001 * sTechs,
      0.001 * sTechs * Math.pow(1.02, Number(gears.G4 || 0)),
      0.001 * sTechs * Math.pow(1.02, Number(gears.G5 || 0)),
      0.0005 * sTechs * Math.pow(1.02, Number(gears.G3 || 0)),
      0.0005 * sTechs,
      0.0004 * sHw,
      0.0008 * sSw,
      0.0003 * sHw,
      0.0132 * sSw
    ],
    Zg: [
      0.005 * Number(zagreus.S_mod || 0) * Math.pow(1.02, Number(gears.G11 || 0)),
      0.001 * Number(zagreus.S_loopFill || 0) * Math.pow(1.01, Number(gears.G10 || 0)) * Math.pow(1.01, Number(gears.G14 || 0)),
      0.001 * Number(zagreus.S_loopReset || 0) * Math.pow(1.02, Number(gears.G8 || 0)),
      0.0005 * Number(zagreus.S_mod || 0) * Math.pow(1.02, Number(gears.G9 || 0)),
      0.0005 * Number(zagreus.S_mod || 0) * Math.pow(1.02, Number(gears.G10 || 0)),
      0.0001 * Number(zagreus.S_mod || 0) * Math.pow(1.02, Number(gears.G12 || 0)),
      0.0001 * Number(zagreus.S_mod || 0) * Math.pow(1.01, Number(gears.G11 || 0)),
      0.0001 * Number(zagreus.S_mod || 0),
      0.0005 * Number(zagreus.S_loopFill || 0),
      0.0004 * Number(zagreus.S_mod || 0),
      0.1 * Number(zagreus.S_loopFill || 0)
    ],
    H: [
      0.04 * Number(hephaestus.S_automt || 0) * Math.pow(1.01, Number(gears.G8 || 0)) * Math.pow(1.02, Number(gears.G15 || 0)),
      0.000003 * ticksRun * Math.pow(1.02, Number(gears.G17 || 0)),
      0.002 * Number(hephaestus.S_automt || 0) * Math.pow(1.01, Number(gears.G21 || 0)) * Math.pow(1.02, Number(gears.G2 || 0)),
      0.05 * Number(hephaestus.S_automt || 0) * Math.pow(1.01, Number(gears.G17 || 0)),
      0.001 * totalGenerators * Math.pow(1.01, Number(gears.G20 || 0)) * Math.pow(1.02, Number(gears.G13 || 0)),
      0.00001 * totalGenerators * Math.pow(1.02, Number(gears.G14 || 0)),
      0.02 * Number(hephaestus.S_automt || 0) * Math.pow(1.02, Number(gears.G16 || 0)),
      0.01,
      0.000002 * ticksRun,
      0.000001 * ticksRun,
      0.00001 * ticksRun
    ],
    D: [
      Math.pow(10, 100) * Math.pow(1.01, Number(gears.G9 || 0)) * Math.pow(1.02, Number(gears.G19 || 0)),
      0.01 * Math.pow(1.01, Number(gears.G19 || 0)) * Math.pow(1.02, Number(gears.G1 || 0)),
      0.002 * ops * Math.pow(1.02, Number(gears.G18 || 0)),
      0.0002 * ops * Math.pow(1.02, Number(gears.G20 || 0)),
      0.0002 * ops * Math.pow(1.02, Number(gears.G22 || 0)),
      0.00001 * ops * Math.pow(1.01, Number(gears.G12 || 0)) * Math.pow(1.01, Number(gears.G16 || 0)) * Math.pow(1.01, Number(gears.G22 || 0)),
      0.001 * ops * Math.pow(1.02, Number(gears.G21 || 0)),
      0.025,
      0.0004 * ops,
      0.0008 * ops,
      0.03 * ops
    ],
    K: [
      0.0025 * (ops + studies),
      0.00003 * studies * Math.pow(1.01, Number(gears.G7 || 0)),
      0.0025 * Number(koios.S_fullRes || 0) * Math.pow(1.01, Number(gears.G5 || 0)),
      0.005 * Number(koios.S_resLvl || 0) * Math.pow(1.01, Number(gears.G2 || 0)),
      0.00001 * studies * Math.pow(1.01, Number(gears.G3 || 0)) * Math.pow(1.01, Number(gears.G15 || 0)),
      0.01 * Math.pow(1.01, Number(gears.G1 || 0)) * Math.pow(1.01, Number(gears.G6 || 0)),
      0.001 * studies * Math.pow(1.01, Number(gears.G4 || 0)),
      0.03,
      0.0002 * studies,
      0.0001 * studies,
      0.01 * studies
    ],
    Ze: [
      0.5 * missions,
      0.1,
      0.25,
      0.005 * missions,
      0.005 * missions,
      0.1,
      0.01,
      0.01 * missions,
      0.01 * missions,
      0.01 * missions,
      0.05 * missions
    ]
  };

  return (formulas[shipKey]?.[installIndex] ?? 0) * innovation;
}

function getTicksRun() {
  const shipPlayerState = getShipCommunityToolState();
  const technical = shipPlayerState.technical;
  const runHours = technical.LongRun ? Number(technical.LongRunLenDays || 0) * 24 : Number(technical.ShortRunLenMins || 0) / 60;
  const tickTimer = Number(shipPlayerState.hephaestus.tickTimer || 1);
  return Math.floor((runHours * 3600) / Math.max(tickTimer, 0.001));
}

function getOperationsTotal() {
  const demeter = getShipCommunityToolState().demeter;
  const efficiency = 1;
  return Number(demeter.OpsFromAotC || 0) + (Math.floor(getTicksRun() / Math.max(Number(demeter.TicksPerOp || 1), 1)) * efficiency);
}

function getStudiesTotal() {
  const koios = getShipCommunityToolState().koios;
  const efficiency = 1;
  return Math.floor(getTicksRun() * Number(koios.StudiesPerResBar || 0) / Math.max(Number(koios.TicksPerResBar || 1), 1)) * efficiency;
}

function getMissionTotal() {
  const shipPlayerState = getShipCommunityToolState();
  const technical = shipPlayerState.technical;
  const zeus = shipPlayerState.zeus;
  const runMinutes = technical.LongRun ? Number(technical.LongRunLenDays || 0) * 24 * 60 : Number(technical.ShortRunLenMins || 0);
  return Math.floor(runMinutes * ((Number(zeus.CappedMissions || 0) / 2) + (1 / Math.max(Number(zeus.LowestUncappedMissionTimer || 1), 1))));
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

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.replace(/^"|"$/g, ""));
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

function splitList(value) {
  if (!value) {
    return [];
  }
  return String(value).split(/[|,;]/).map((item) => item.trim()).filter(Boolean);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
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

function coerceInputValue(value) {
  if (value === "") {
    return null;
  }
  if (typeof value === "string") {
    const normalized = normalizeCiNumberValue(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? value : numberValue;
}

function normalizeCiNumberValue(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return "";
  }

  const normalized = raw.replace(/,/g, "").toLowerCase();
  const sciMatch = normalized.match(/^([+-]?\d*\.?\d+)\s*e\s*([+-]?\d+)$/);
  if (sciMatch) {
    return formatCiNormalizedNumber(Number(sciMatch[1]), Number(sciMatch[2]));
  }

  const suffixMatch = normalized.match(/^([+-]?\d*\.?\d+)\s*([a-z]{1,2})$/);
  if (suffixMatch) {
    const suffixExponent = CI_SUFFIX_EXPONENTS[suffixMatch[2]];
    if (suffixExponent !== undefined) {
      return formatCiNormalizedNumber(Number(suffixMatch[1]), suffixExponent);
    }
  }

  const plainNumber = Number(normalized);
  if (!Number.isNaN(plainNumber)) {
    return plainNumber;
  }

  return null;
}

function formatCiNormalizedNumber(mantissa, exponent) {
  if (!Number.isFinite(mantissa) || !Number.isFinite(exponent)) {
    return "";
  }
  if (mantissa === 0) {
    return 0;
  }
  let nextMantissa = mantissa;
  let nextExponent = exponent;
  while (Math.abs(nextMantissa) >= 10) {
    nextMantissa /= 10;
    nextExponent += 1;
  }
  while (Math.abs(nextMantissa) > 0 && Math.abs(nextMantissa) < 1) {
    nextMantissa *= 10;
    nextExponent -= 1;
  }
  if (nextExponent >= -6 && nextExponent <= 12) {
    const numericValue = nextMantissa * Math.pow(10, nextExponent);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return `${trimTrailingZeros(nextMantissa.toFixed(6))}e${nextExponent}`;
}

function trimTrailingZeros(value) {
  return String(value).replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

function normalizeGeneratorTierKey(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) {
    return null;
  }
  const direct = text.match(/^n([1-9]|10)$/);
  if (direct) {
    return `n${direct[1]}`;
  }
  const mk = text.match(/^mk\s*([1-9]|10)$/);
  if (mk) {
    return `n${mk[1]}`;
  }
  const plain = text.match(/^([1-9]|10)$/);
  if (plain) {
    return `n${plain[1]}`;
  }
  return null;
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
