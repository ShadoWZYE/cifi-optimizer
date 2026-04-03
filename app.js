import {
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  normalizePlayerProfile
} from "./player-profile.js";
import {
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
const SERVER_SESSION_ENDPOINTS = {
  open: "/api/client/open",
  heartbeat: "/api/client/heartbeat",
  close: "/api/client/close",
  events: "/api/client/events"
};

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

const PROFILE_FORM_FIELD_PATHS = {
  ...CANONICAL_PROFILE_FIELD_PATHS,
  shardRatePerHour: ["planning", "shards", "ratePerHour"],
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
  shipBaseline: null,
  shipTemplates: null,
  shardGrounding: null,
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
  route: "overview"
};

bootstrap().catch((error) => console.error(error));

async function bootstrap() {
  state.launchCoordinator = initLaunchCoordinator();
  if (state.launchCoordinator.passiveLaunch) {
    renderPassiveLaunchScreen();
    return;
  }

  const [snapshot, shipBaseline, groundedShardMilestones, groundedShardObservedBehaviors, groundedShardProvenance, tokenShopValues, multiverseMarketValues, multiverseMarketMetadataNeighborhood, tokeniumNamingClues, tokenBankStateClues, dailyTokeniumLaneClues, tokenBankFormulaBoundary, multiverseMarketRangeBoundary, multiverseMarketRowTextCoverage, tokenShopCostLanes, spendActionLaneClues, multiverseMarketActionShell, tokenShopOwnerShell, tokenShopSaveBoundary, multiverseMarketSaveBoundary, tokenBankControllerShell] = await Promise.all([
    fetchJson("./data/game-data.snapshot.v1.json"),
    fetchJson("./data/ship-optimizer.desmos-baseline.v1.json"),
    fetchJson("./data/shard-milestones.grounded.v1.json"),
    fetchJson("./data/shard-observed-behaviors.grounded.v1.json"),
    fetchJson("./data/shard-milestones-provenance.grounded.v1.json"),
    fetchJson("./data/token-shop-values.json"),
    fetchJson("./data/multiverse-market-values.json"),
    fetchJson("./data/multiverse-market-metadata-neighborhood.json"),
    fetchJson("./data/tokenium-naming-clues.json"),
    fetchJson("./data/token-bank-state-clues.json"),
    fetchJson("./data/daily-tokenium-lane-clues.json"),
    fetchJson("./data/token-bank-formula-boundary.json"),
    fetchJson("./data/multiverse-market-range-boundary.json"),
    fetchJson("./data/multiverse-market-row-text-coverage.json"),
    fetchJson("./data/token-shop-cost-lanes.json"),
    fetchJson("./data/spend-action-lane-clues.json"),
    fetchJson("./data/multiverse-market-action-shell.json"),
    fetchJson("./data/token-shop-owner-shell.json"),
    fetchJson("./data/token-shop-save-boundary.json"),
    fetchJson("./data/multiverse-market-save-boundary.json"),
    fetchJson("./data/token-bank-controller-shell.json")
  ]);

  const baselineShipPlayerState = createDefaultShipPlayerState(shipBaseline);
  const legacyShipConfig = loadStoredJson(STORAGE_KEYS.shipConfig, null);
  const storedPlayerProfile = loadStoredJson(STORAGE_KEYS.playerProfile, null);
  const legacyProfile = loadStoredJson(LEGACY_STORAGE_KEYS.profile, null);

  state.snapshot = mergeDeep(snapshot, loadStoredJson(STORAGE_KEYS.snapshot, snapshot));
  state.shipBaseline = shipBaseline;
  state.shipTemplates = buildShipTemplates(shipBaseline);
  state.shardGrounding = {
    milestones: groundedShardMilestones,
    observedBehaviors: groundedShardObservedBehaviors,
    provenance: groundedShardProvenance
  };
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
    tokenShopCostLanes,
    spendActionLaneClues,
    multiverseMarketActionShell,
    tokenShopOwnerShell,
    tokenShopSaveBoundary,
    multiverseMarketSaveBoundary,
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
  if (!window.location.origin.startsWith("http")) {
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
    focusMilestoneLevel: state.playerProfile.planning.shards.focusMilestoneLevel
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
  $("#runProgressionOptimizer").addEventListener("click", () => renderProgressionResults(runProgressionOptimization()));
  $("#saveShardPlannerBtn").addEventListener("click", saveShardPlannerInputs);
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
  $("#validationStatusValue").textContent = `${mvpValidation.filter((item) => item.pass).length}/${mvpValidation.length}`;
  $("#overviewHighlights").innerHTML = [
    renderRecommendationFeedSummary(recommendationFeed, "overview"),
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
            <span class="snapshot-title">Ship optimizer toggles</span>
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
  const recommendationFeed = getActiveMvpRecommendationFeed();
  renderShardPlannerControls();
  $("#progressionResults").innerHTML = `
    <article class="validation-card warn">
      <strong>Shard milestone mapping status</strong>
      <p class="meta">System-level shard anchors are grounded enough for repo truth, but the current milestone list is still community-grounded descriptive data.</p>
      <p class="meta">Do not treat milestone names, unlock rows, or bonus labels here as shipped-game extracted truth until shard owner mapping is completed.</p>
    </article>
    ${renderRecommendationFeedSummary(recommendationFeed, "progression")}
    <div class="recommendation-list">${results.map((item) => makeRecommendationCard(item, item.module === "loop" ? "warning" : "shards")).join("")}</div>
    ${renderShardWorkflowSnapshot()}
    ${renderShardWorkflowReference()}
    ${renderObservedShardBehaviors()}
    ${renderShardMilestoneDirectory()}
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
  if (!multiverseMarket && !multiverseMarketMetadataNeighborhood) {
    return "";
  }

  const summary = getMultiverseMarketMetadataSummary(multiverseMarketMetadataNeighborhood);
  const validatedCoverage = getMultiverseMarketValidatedCoverage(multiverseMarket);
  const dailyTokeniumSummary = getDailyTokeniumLaneSummary(dailyTokeniumLaneClues);
  const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(tokenBankFormulaBoundary);
  const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(multiverseMarketRangeBoundary);
  const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(multiverseMarketRowTextCoverage);
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
        <article class="validation-card ${summary.hasProgressionFieldCluster ? "pass" : "warn"}">
          <strong>Grounded field-cluster clues</strong>
          <p class="meta">${summary.hasProgressionFieldCluster ? "InscryptionsDone now sits beside nearby IS*Level entries and trade counters such as EsotericR1Trades in repo-local metadata." : "The checked-in metadata neighborhood does not yet preserve the expected InscryptionsDone progression-field cluster."}</p>
        </article>
        <article class="validation-card ${validatedCoverage.hasValidatedRows ? "pass" : "warn"}">
          <strong>Validated row block vs broader field run</strong>
          <p class="meta">${validatedCoverage.hasValidatedRows ? `The checked-in MultiverseMarket extract currently validates ${validatedCoverage.count} rows across ids ${validatedCoverage.rangeLabel}.` : "The checked-in MultiverseMarket extract does not yet expose a validated row block."}</p>
          <p class="meta">${summary.recoveredIsRangeLabel ? `The save-side metadata neighborhood already reaches ${summary.recoveredIsRangeLabel}, which is broader than the currently validated row block.` : "The save-side metadata neighborhood does not yet expose a broad IS*Level run."}</p>
        </article>
        <article class="validation-card ${multiverseMarketRangeSummary.hasExplicitZeroOverlap ? "pass" : "warn"}">
          <strong>Validated rows vs recovered IS run</strong>
          <p class="meta">${multiverseMarketRangeSummary.hasValidatedRows ? `The checked-in row block still covers ids ${multiverseMarketRangeSummary.validatedRangeLabel}.` : "Validated row coverage is incomplete in the checked-in range boundary bundle."}</p>
          <p class="meta">${multiverseMarketRangeSummary.hasExplicitZeroOverlap ? `The separate metadata run ${multiverseMarketRangeSummary.metadataRangeLabel} currently has no direct overlap with that validated block.` : "The checked-in range boundary no longer preserves the current zero-overlap result."}</p>
        </article>
        <article class="validation-card ${multiverseMarketRowTextSummary.hasValidatedTextCoverage ? "pass" : "warn"}">
          <strong>Validated row text coverage</strong>
          <p class="meta">${multiverseMarketRowTextSummary.hasValidatedTextCoverage ? `TextHandlerMarkets now preserves ${multiverseMarketRowTextSummary.coveredCount} direct SetIS*CostText hooks for validated rows ${multiverseMarketRowTextSummary.validatedRangeLabel}.` : "Validated-row cost-text coverage is incomplete in the checked-in text-coverage bundle."}</p>
          <p class="meta">${multiverseMarketRowTextSummary.hasBuyHookSamples ? `Sample buy hooks such as ${multiverseMarketRowTextSummary.firstBuyHook} and ${multiverseMarketRowTextSummary.lastBuyHook} are also present in the same checked local coverage path.` : "Validated-row buy-hook samples are incomplete in the checked-in text-coverage bundle."}</p>
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
  $("#researchResults").innerHTML = orderedTracks.map((track) => `
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
        <p class="snapshot-title">Remaining work</p>
        <ul class="research-step-list">${track.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul>
      </div>
    </article>
  `).join("");
}

function getResearchTrackOrder(track) {
  const order = [
    "data-contracts-and-apk-pipeline",
    "playerprofile-boundary-and-imports",
    "shards-and-loop-guardrails",
    "unified-feed-and-hardening",
    "spend-planner-from-extracted-data"
  ];
  const index = order.indexOf(track.id);
  return index === -1 ? order.length : index;
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
      <p class="meta">${completedSteps.length} done | ${remainingSteps.length} left | ${percent}% complete</p>
      ${completedSteps.length ? `<div class="meta-stack"><p class="snapshot-title">Done in repo</p><ul class="research-step-list">${completedSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ul></div>` : ""}
    </div>
  `;
}

function renderResearchTrackSupport(track) {
  if (track.id === "spend-planner-from-extracted-data") {
    const tokenShopCoverage = getTokenShopCoverageSummary(state.extractedMechanics?.tokenShop);
    const validatedCoverage = getMultiverseMarketValidatedCoverage(state.extractedMechanics?.multiverseMarket);
    const metadataSummary = getMultiverseMarketMetadataSummary(state.extractedMechanics?.multiverseMarketMetadataNeighborhood);
    const tokeniumNamingSummary = getTokeniumNamingSummary(state.extractedMechanics?.tokeniumNamingClues);
    const tokenBankStateSummary = getTokenBankStateSummary(state.extractedMechanics?.tokenBankStateClues);
    const dailyTokeniumSummary = getDailyTokeniumLaneSummary(state.extractedMechanics?.dailyTokeniumLaneClues);
    const tokenBankFormulaSummary = getTokenBankFormulaBoundarySummary(state.extractedMechanics?.tokenBankFormulaBoundary);
    const multiverseMarketRangeSummary = getMultiverseMarketRangeBoundarySummary(state.extractedMechanics?.multiverseMarketRangeBoundary);
    const multiverseMarketRowTextSummary = getMultiverseMarketRowTextCoverageSummary(state.extractedMechanics?.multiverseMarketRowTextCoverage);
    const tokenShopCostLaneSummary = getTokenShopCostLaneSummary(state.extractedMechanics?.tokenShopCostLanes);
    const spendActionLaneSummary = getSpendActionLaneSummary(state.extractedMechanics?.spendActionLaneClues);
    const multiverseMarketActionShellSummary = getMultiverseMarketActionShellSummary(state.extractedMechanics?.multiverseMarketActionShell);
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
        <p class="meta">${multiverseMarketRangeSummary.hasExplicitZeroOverlap ? `The checked range boundary now preserves a zero-overlap result between validated rows ${multiverseMarketRangeSummary.validatedRangeLabel} and the recovered metadata run ${multiverseMarketRangeSummary.metadataRangeLabel}.` : "The checked range boundary between validated rows and the recovered metadata run is not available in this build."}</p>
        <p class="meta">${multiverseMarketRowTextSummary.hasValidatedTextCoverage ? `The validated row block also has direct text-handler coverage through ${multiverseMarketRowTextSummary.textHandler}, ${multiverseMarketRowTextSummary.textBatcher}, and ${multiverseMarketRowTextSummary.coveredCount} SetIS*CostText hooks.` : "Validated-row text-handler coverage is not available in this build."}</p>
        <p class="meta">${multiverseMarketRowTextSummary.hasValidatedTextCoverage ? "That is row-label coverage for the validated block, not saved-state coverage, so it should not be used as proof of player-owned current levels." : "Validated-row text coverage is incomplete, so row-label support remains partially grounded."}</p>
        <p class="meta">${multiverseMarketActionShellSummary.hasActionShell ? `The same checked action shell context reaches ${multiverseMarketActionShellSummary.buyRangeLabel} plus ${multiverseMarketActionShellSummary.costTextRangeLabel}, while only ${multiverseMarketActionShellSummary.validatedRangeLabel} stays numerically validated.` : "MultiverseMarket action-shell coverage is not available in this build."}</p>
        <p class="meta">${multiverseMarketActionShellSummary.hasActionShell ? "That broader action shell is useful for mapping and UI recovery, but it should not be promoted as full numeric validation or saved-state coverage." : "The broader MultiverseMarket action shell is incomplete, so validated-row behavior should stay the narrower implementation boundary."}</p>
        <p class="meta">${multiverseMarketSaveBoundarySummary.hasSeparationBoundary ? `The checked save boundary still keeps ${multiverseMarketSaveBoundarySummary.actionAnchor} separate from ${multiverseMarketSaveBoundarySummary.saveAnchor}, with ${multiverseMarketSaveBoundarySummary.overlapLabel}.` : "MultiverseMarket save-boundary clues are not available in this build."}</p>
        <p class="meta">${multiverseMarketSaveBoundarySummary.hasSeparationBoundary ? "That means MultiverseMarket action-shell recovery and PlayerProfile save recovery remain separate tasks, so the app should not infer player-owned row levels from action-shell clues yet." : "The current build does not yet preserve a clean separation boundary between MultiverseMarket action-shell recovery and save-family recovery."}</p>
        <p class="meta">This is enough to narrow future mapping work, but not enough to identify the declaring save model or planner-ready owned-state inputs.</p>
      </div>
    `;
  }

  if (track.id !== "data-contracts-and-apk-pipeline") {
    return "";
  }

  return `
    <div class="meta-stack">
      <p class="snapshot-title">Validation path</p>
      <p class="meta">The checked-in contract lives in <code>data/bundled-dataset-contract.v1.json</code>. Run <code>npm run verify:data</code> before promoting bundled snapshot, shard, token-shop, or multiverse-market dataset changes.</p>
      <div class="pill-row">
        <span class="pill">Snapshot</span>
        <span class="pill">Shards</span>
        <span class="pill">Token shop</span>
        <span class="pill">Multiverse market</span>
      </div>
    </div>
  `;
}

function getResearchTrackLane(track) {
  const index = getResearchTrackOrder(track);
  if (index === 0) {
    return "Start Here";
  }
  if (index > 0 && index < 4) {
    return "Next Up";
  }
  return "Queue";
}

function getResearchTrackStatus(track) {
  const statusById = {
    active: "Active",
    queued: "Queued",
    completed: "Completed"
  };
  return statusById[track.status] || "Queued";
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
    "shards-and-loop-guardrails": "PR 2",
    "unified-feed-and-hardening": "PR 3",
    "spend-planner-from-extracted-data": "PR 4"
  };
  return phaseById[track.id] || "Research";
}

function getResearchTrackSource(track) {
  const sourceById = {
    "data-contracts-and-apk-pipeline": "APK-first",
    "playerprofile-boundary-and-imports": "Schema",
    "shards-and-loop-guardrails": "Grounded data",
    "spend-planner-from-extracted-data": "Extracted data",
    "unified-feed-and-hardening": "Integration"
  };
  return sourceById[track.id] || "Research";
}

function collectProfileForm() {
  const entries = Object.fromEntries(new FormData($("#profileForm")).entries());
  const nextProfile = structuredClone(state.playerProfile);
  Object.entries(PROFILE_FORM_FIELD_PATHS).forEach(([field, path]) => {
    if (field in entries) {
      setProfileValue(path, coerceInputValue(entries[field]), nextProfile);
    }
  });
  nextProfile.meta.schemaVersion = PLAYER_PROFILE_SCHEMA_VERSION;
  return nextProfile;
}

function fillProfileForm() {
  Object.entries(PROFILE_FORM_FIELD_PATHS).forEach(([key, path]) => {
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
    setStatus("playerProfileImportStatus", "PlayerProfile JSON imported through the grounded normalizer.", "success");
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
        ["Academy relics", canonical.academyRelics],
        ["Current shards", canonical.shards],
        ["Profile notes", canonical.notes]
      ]
    },
    {
      title: "Planner-only helpers",
      note: "Manual helper inputs used by descriptive planners, not canonical account truth.",
      items: [
        ["Shard income / hour", shardPlanner.ratePerHour],
        ["Total shard milestone levels", shardPlanner.totalMilestoneLevels],
        ["Focus milestone", shardPlanner.focusMilestoneId],
        ["Focus milestone level", shardPlanner.focusMilestoneLevel]
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
      "Import verified shard milestone data before re-enabling optimizer behavior."
    ],
    notes: "Descriptive fallback mode avoids fake optimizer precision."
  }, "shards"), ...loopWarnings]);
}

function buildLoopGuardrailRecommendations() {
  const canonical = getCanonicalProfileState();
  const loopReset = Number(canonical.loopReset || 0);
  const currentShards = Number(canonical.shards || 0);
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

  if (loopReset >= 5) {
    warnings.push({
      id: "loop-guardrail-rising-requirements-warning",
      module: "loop",
      kind: "warning",
      title: "Loop requirement pacing warning",
      subtitle: `Current LR ${formatShardNumber(loopReset)}`,
      score: 88,
      confidence: 0.71,
      whyNow: [
        antiBricking?.why || "Guide examples warn that pushing LR too quickly can raise loop requirements faster than the account can clear them.",
        "Grounded examples show LR 5 -> 6 requiring 7 loops and LR 6 -> 7 requiring 8 loops."
      ],
      assumptions: [
        "This is a caution zone, not an optimizer target.",
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
      subtitle: focusMilestone ? focusMilestone.name : "Select a focus milestone",
      score: focusMilestone ? 52 : 34,
      confidence: 0.64,
      whyNow: [
        focusMilestone
          ? `Focus milestone rarity: ${formatShardRarity(focusMilestone.rarity)}. Threshold schedule: ${formatThresholdLevels(getThresholdScheduleForMilestone(focusMilestone, mechanics))}.`
          : "Choose a focus milestone to inspect its grounded threshold schedule.",
        nextThreshold
          ? `Next bonus threshold is level ${nextThreshold} from tracked level ${formatShardNumber(focusLevel)}.`
          : focusMilestone
            ? "All explicit grounded threshold levels on the selected milestone are already reached."
            : "Threshold watch is unavailable until a focus milestone is selected."
      ],
      assumptions: [
        focusMilestone?.summary || "Threshold watch uses imported unlock/bonus entries only.",
        mechanics.effect_scaling?.description || "Incremental level increases milestone effects, but the app does not score them."
      ],
      warnings: [
        focusMilestone?.uncertaintyNotes?.[0] || "Unknown/Unkown source values remain preserved where the source was incomplete.",
        conflictNote || "Threshold wording stays descriptive because milestone sources conflict across accessible snapshots.",
        nextThreshold ? `You need ${Math.max(nextThreshold - focusLevel, 0)} more levels on the selected milestone to reach this threshold.` : "Threshold watch ends here unless you switch milestones."
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
      whyNow: [
        mechanics.cost_breakpoints_observed?.breakpoints_statement || "Cost bump notes are descriptive only.",
        nextCostBump
          ? `From tracked level ${formatShardNumber(focusLevel)}, the next noted cost bump is level ${nextCostBump.level} (${nextCostBump.severity}).`
          : "No cost bump watch could be derived from the current focus level."
      ],
      assumptions: [
        "The dataset provides breakpoint notes, not numeric shard costs.",
        observation ? `${observation.title}: ${observation.why}` : "Observed examples are shown separately and do not become optimizer truths."
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

function saveShardPlannerInputs() {
  const milestoneId = formControl("shardFocusMilestoneId")?.value || null;
  const milestoneLevel = coerceInputValue(formControl("shardFocusMilestoneLevel")?.value ?? "");
  setProfileValue(["planning", "shards", "focusMilestoneId"], milestoneId, state.playerProfile);
  setProfileValue(["planning", "shards", "focusMilestoneLevel"], milestoneLevel, state.playerProfile);
  persistPlayerProfile();
  setStatus("shardPlannerStatus", "Shard workflow inputs saved.", "success");
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
        <span class="snapshot-title">Shard workflow snapshot</span>
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

function renderShardWorkflowReference() {
  const mechanics = getGroundedShardMechanics();
  const provenance = state.shardGrounding?.provenance;
  const thresholds = mechanics.rarity_bonus_thresholds ?? {};
  const levelCaps = mechanics.max_level_rules_and_modifiers ?? {};
  const uncertaintyLog = provenance?.uncertaintyLog ?? [];
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
        <span class="snapshot-title">Max-level and cost-breakpoint notes</span>
        <div class="meta-stack">
          <p class="meta">Base max level before Workers Badge: ${formatOptionalNumber(levelCaps.base_max_level_before_workers_badge)}</p>
          <p class="meta">Max level after Workers Badge: ${formatOptionalNumber(levelCaps.max_level_after_workers_badge)}</p>
          <p class="meta">${escapeHtml(levelCaps.research_note || "Research max-level note unavailable.")}</p>
          <p class="meta">${escapeHtml(levelCaps.ultima_loop_mod_note || "Ultima Loop Mod note unavailable.")}</p>
          <p class="meta">${escapeHtml(mechanics.cost_breakpoints_observed?.breakpoints_statement || "Cost breakpoint note unavailable.")}</p>
        </div>
        <div class="meta-stack">
          <p class="snapshot-title">Preserved uncertainty</p>
          ${uncertaintyLog.map((item) => `<p class="meta">${escapeHtml(`${item.topic}: ${item.what_is_missing || item.what_is_available || item.status}.`)}</p>`).join("")}
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
        <div class="meta-stack">
          <p class="snapshot-title">Review sources</p>
          ${Object.values(provenance?.sources || {}).slice(0, 5).map((source) => `
            <p class="meta">${escapeHtml(source.title)}${source.last_edited_in_source ? ` (${escapeHtml(source.last_edited_in_source)})` : ""}</p>
          `).join("")}
        </div>
      </article>
    </div>
  `;
}

function renderShardMilestoneDirectory() {
  const mechanics = getGroundedShardMechanics();
  const milestones = getMilestonesForDisplay();
  return `
    <div class="meta-stack">
      <p class="eyebrow">Descriptive directory</p>
      <h3>Shard milestones</h3>
      <p class="meta">These milestone rows are sourced from named community references with preserved uncertainty and conflicts. They are not yet mapped from shipped-game shard milestone owners.</p>
      <div class="preview-stack">
        ${milestones.map((milestone) => `
          <details class="snapshot-card shard-milestone-card" ${milestone.id === getSelectedShardMilestoneId() ? "open" : ""}>
            <summary class="shard-milestone-summary">
              <div>
                <strong>${escapeHtml(milestone.name)}</strong>
                <p class="meta">${escapeHtml(`${formatShardRarity(milestone.rarity)} | Unlock ${describeUnlockCondition(milestone.unlockCondition)}`)}</p>
              </div>
              <span class="pill">${escapeHtml(formatThresholdLevels(getThresholdScheduleForMilestone(milestone, mechanics)))}</span>
            </summary>
            <div class="meta-stack">
              <p class="meta">${escapeHtml(milestone.summary || "No milestone summary captured.")}</p>
              <p class="meta">Unlock condition: ${escapeHtml(describeUnlockCondition(milestone.unlockCondition))}</p>
              <p class="meta">Threshold schedule: ${escapeHtml(formatThresholdLevels(getThresholdScheduleForMilestone(milestone, mechanics)))}</p>
              <p class="meta">${escapeHtml(milestone.costProgression?.notes || "No cost progression note available.")}</p>
            </div>
            <div class="shard-bonus-list">
              ${(milestone.bonuses || []).map((bonus) => `
                <article class="shard-bonus-card">
                  <strong>${escapeHtml(bonus.effectLabel || "Unnamed bonus")}</strong>
                  <p class="meta">Unlock level: ${bonus.unlockLevel ?? "Listed without explicit threshold"}</p>
                  <p class="meta">Initial bonus: ${escapeHtml(String(bonus.initialBonus ?? "Unknown"))}</p>
                  <p class="meta">Bonus per level: ${escapeHtml(String(bonus.bonusPerLevel ?? "Unknown"))}</p>
                </article>
              `).join("")}
            </div>
            ${(milestone.uncertaintyNotes || []).length ? `
              <div class="meta-stack">
                <p class="snapshot-title">Uncertainty notes</p>
                ${milestone.uncertaintyNotes.map((note) => `<p class="meta">${escapeHtml(note)}</p>`).join("")}
              </div>
            ` : ""}
          </details>
        `).join("")}
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
  const current = {
    ship: runShipOptimization()[0]?.title ?? "None",
    progression: runProgressionOptimization()[0]?.title ?? "None",
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
  const tokenShopOwnerShell = state.extractedMechanics?.tokenShopOwnerShell;
  const tokenShopSaveBoundary = state.extractedMechanics?.tokenShopSaveBoundary;
  const multiverseMarketSaveBoundary = state.extractedMechanics?.multiverseMarketSaveBoundary;
  const tokenBankControllerShell = state.extractedMechanics?.tokenBankControllerShell;
  const shardMilestones = state.shardGrounding?.milestones;
  const cases = [];

  if (tokenShop) {
    const numericTable = tokenShop.numeric_table ?? {};
    const tokenShopCoverage = getTokenShopCoverageSummary(tokenShop);
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
  }

  if (multiverseMarket) {
    const records = Array.isArray(multiverseMarket.records) ? multiverseMarket.records : [];
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
      expected: "Validated rows 50-59 and 63-74 do not overlap the recovered IS99-110 metadata run",
      actual: multiverseMarketRangeSummary.hasExplicitZeroOverlap
        ? `Validated rows ${multiverseMarketRangeSummary.validatedRangeLabel} do not overlap ${multiverseMarketRangeSummary.metadataRangeLabel}`
        : "Missing validated-row versus metadata-run boundary",
      pass: multiverseMarketRangeSummary.hasExplicitZeroOverlap,
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
    hasValidatedRows: validatedRowRanges.length > 0,
    hasExplicitZeroOverlap: validatedRowRanges.length > 0 && metadataIsRangeLabel.length > 0 && overlapIds.length === 0,
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

function getMultiverseMarketValidatedCoverage(multiverseMarket) {
  const validatedIds = Array.isArray(multiverseMarket?.source?.validated_ids)
    ? [...new Set(multiverseMarket.source.validated_ids.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((left, right) => left - right))]
    : [];
  const ranges = [];
  let rangeStart = null;
  let previous = null;

  validatedIds.forEach((value) => {
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

  return {
    hasValidatedRows: validatedIds.length > 0,
    count: validatedIds.length,
    rangeLabel: ranges.join(" and ")
  };
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
  return runProgressionOptimization().filter((item) => item.module === "shards" || item.module === "loop");
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
  return `
    <article class="validation-card warn">
      <strong>${surface === "overview" ? "Active MVP recommendation feed" : "Progression feed status"}</strong>
      <p class="meta">The current feed ranks trust-oriented warning urgency for the active shard and loop modules. These scores are UI priority, not optimizer ROI.</p>
      <p class="meta">Visible feed items: ${results.length}. Loop guardrails: ${loopCount}. Shard workflow cards: ${shardCount}.</p>
      <p class="meta">Spend-planner recommendations are still blocked by system-mapping gaps, so this feed currently covers the MVP-safe guidance surfaces only.</p>
    </article>
  `;
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
  const selectedId = getSelectedShardMilestoneId();
  return [...getGroundedShardMilestones()].sort((left, right) => {
    if (left.id === selectedId) {
      return -1;
    }
    if (right.id === selectedId) {
      return 1;
    }
    return Number(left.milestoneNumber || 0) - Number(right.milestoneNumber || 0);
  });
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
  const filled = Object.values(CANONICAL_PROFILE_FIELD_PATHS)
    .filter((path) => String(path.reduce((current, key) => current?.[key], profile) ?? "").trim() !== "").length;
  const fields = Object.keys(CANONICAL_PROFILE_FIELD_PATHS);
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
    ["planning", "shards", "ratePerHour"],
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
  const detailLines = [
    item.cost ? `<span class="pill">cost ${escapeHtml(item.cost)}</span>` : "",
    item.eta ? `<span class="pill">eta ${escapeHtml(item.eta)}</span>` : ""
  ].filter(Boolean).join("");
  const whyNow = Array.isArray(item.whyNow) && item.whyNow.length
    ? `<div class="meta-stack"><p class="snapshot-title">Why now</p>${item.whyNow.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
    : "";
  const assumptions = Array.isArray(item.assumptions) && item.assumptions.length
    ? `<div class="meta-stack"><p class="snapshot-title">Assumptions</p>${item.assumptions.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
    : "";
  const warnings = Array.isArray(item.warnings) && item.warnings.length
    ? `<div class="meta-stack"><p class="snapshot-title">Warnings</p>${item.warnings.map((line) => `<p class="meta">${escapeHtml(line)}</p>`).join("")}</div>`
    : "";
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
      ${whyNow}
      ${assumptions}
      ${warnings}
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
  return Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(Number(value || 0)));
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
