import {
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  normalizePlayerProfile
} from "./player-profile.js";

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
const APP_LAUNCH_STALE_MS = 15000;

const CANONICAL_PROFILE_FIELD_PATHS = {
  profileName: ["meta", "profileName"],
  dataConfidence: ["meta", "dataConfidence"],
  loopReset: ["player", "loop", "loopReset"],
  diamonds: ["player", "resources", "diamonds"],
  tokens: ["player", "resources", "tokens"],
  academyRelics: ["player", "resources", "academyRelics"],
  shards: ["player", "resources", "shards"],
  notes: ["notes", "profile"]
};

const PLANNER_PROFILE_FIELD_PATHS = {
  shardRatePerHour: ["planning", "shards", "ratePerHour"]
};

const PROFILE_FIELD_PATHS = {
  ...CANONICAL_PROFILE_FIELD_PATHS,
  ...PLANNER_PROFILE_FIELD_PATHS
};

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
  playerProfile: null,
  shipConfig: null,
  launchCoordinator: null,
  launchNoticeTimer: null,
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

  const [snapshot, shipBaseline, groundedShardMilestones, groundedShardObservedBehaviors, groundedShardProvenance] = await Promise.all([
    fetchJson("./data/game-data.snapshot.v1.json"),
    fetchJson("./data/ship-optimizer.desmos-baseline.v1.json"),
    fetchJson("./data/shard-milestones.grounded.v1.json"),
    fetchJson("./data/shard-observed-behaviors.grounded.v1.json"),
    fetchJson("./data/shard-milestones-provenance.grounded.v1.json")
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
  document.body.innerHTML = `
    <main class="launch-passive-shell">
      <section class="launch-passive-card">
        <p class="eyebrow">CIFI Already Open</p>
        <h1>Using the existing app tab.</h1>
        <p class="meta">The launcher signaled the active CIFI tab to refresh. This window stays idle so you do not end up with two competing app instances.</p>
        <button class="button button-primary" id="passiveLaunchCloseBtn">Close this window</button>
      </section>
    </main>
  `;

  document.getElementById("passiveLaunchCloseBtn")?.addEventListener("click", () => {
    window.close();
  });
}

function persistPlayerProfile() {
  state.playerProfile.meta.updatedAt = new Date().toISOString();
  state.playerProfile.meta.schemaVersion = PLAYER_PROFILE_SCHEMA_VERSION;
  saveStoredJson(STORAGE_KEYS.playerProfile, state.playerProfile);
}

function getShipCommunityToolState() {
  return state.playerProfile.externalModels.shipPlanner.communityToolState;
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
      name: stored.name || fallback.name,
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
    const snapshots = loadStoredJson(STORAGE_KEYS.snapshots, []);
    snapshots.unshift({
      savedAt: new Date().toISOString(),
      loopReset: state.playerProfile.player.loop.loopReset,
      playerProfile: structuredClone(state.playerProfile)
    });
    saveStoredJson(STORAGE_KEYS.snapshots, snapshots.slice(0, 12));
    persistPlayerProfile();
    setStatus("profileStatus", `Saved LR snapshot for LR ${state.playerProfile.player.loop.loopReset}.`, "success");
    renderAll();
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
  $("#snapshotSummary").innerHTML = `
    <span class="snapshot-title">Active snapshot</span>
    <strong class="snapshot-value">${state.snapshot.snapshotVersion}</strong>
    <p class="meta">${state.snapshot.capturedAt}</p>
  `;
  $("#quickStatus").innerHTML = `
    <span class="snapshot-title">Quick status</span>
    <strong class="snapshot-value">${completion}%</strong>
    <p class="meta">${snapshots.length} LR snapshots saved locally.</p>
  `;
}

function renderOverview() {
  $("#profileCompletionValue").textContent = `${getProfileCompletion(state.playerProfile)}%`;
  $("#importedRecordsValue").textContent = String(getImportedRecordCount());
  const validation = runValidationCases();
  $("#validationStatusValue").textContent = `${validation.filter((item) => item.pass).length}/${validation.length}`;
  $("#overviewHighlights").innerHTML = [
    makeRecommendationCard(runProgressionOptimization()[0], "shards"),
    makeRecommendationCard({
      id: "non-mvp-modules-warning",
      module: "warning",
      kind: "warning",
      title: "Non-MVP modules are quarantined",
      subtitle: "Community-tool and experimental surfaces",
      score: 0,
      confidence: 0.84,
      whyNow: [
        "Gem Nodes, Research, and OCR remain available only as non-MVP support surfaces.",
        "Ship planner calibration is preserved, but labeled as community-tool state rather than raw in-game state."
      ],
      warnings: [
        "These modules are not part of the grounded MVP path.",
        "Do not treat them as verified CIFI recommendations."
      ],
      notes: "The primary MVP flow centers on PlayerProfile, imports, shard safety, validation, and explainable recommendations."
    }, "warning")
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
        <p class="meta">These community-tool weights drive the quarantined ship planner recommendation and highlighted next best install.</p>
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
          <p class="meta">These toggles affect only the community-tool ship planner. <code>softCap</code> keeps filtered resource lanes in play at a tiny flat priority of <code>0.01</code>.</p>
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
        setStatus("shipConfigStatus", "Applied community-tool ship planner changes.", "success");
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

  $("#shipResults").innerHTML = [leadCard, ...shipRankings.slice(0, 3)].filter(Boolean).map((item) => makeRecommendationCard(item, "ship")).join("");
}

function renderProgressionResults(results) {
  $("#progressionResults").innerHTML = results.map((item) => makeRecommendationCard(item, "shards")).join("");
}

function renderGemResults(results) {
  $("#gemResults").innerHTML = results.map((item) => makeRecommendationCard(item, "gem")).join("");
}

function renderValidationResults() {
  const results = runValidationCases();
  $("#validationResults").innerHTML = results.map((item) => `
    <article class="validation-card ${item.pass ? "pass" : "warn"}">
      <strong>${item.title}</strong>
      <p class="validation-status">${item.pass ? "PASS" : "WARN"} | Expected: ${item.expected}</p>
      <p class="meta">${item.actual}</p>
    </article>
  `).join("");
}

function renderResearch() {
  $("#researchResults").innerHTML = state.snapshot.researchTracks.map((track) => `
    <article class="research-card">
      <strong>${track.title}</strong>
      <p class="meta">Non-MVP research track. ${track.goal}</p>
      <ul>${track.nextSteps.map((step) => `<li>${step}</li>`).join("")}</ul>
    </article>
  `).join("");
}

function collectProfileForm() {
  const entries = Object.fromEntries(new FormData($("#profileForm")).entries());
  const nextProfile = structuredClone(state.playerProfile);
  Object.entries(PROFILE_FIELD_PATHS).forEach(([field, path]) => {
    if (field in entries) {
      setProfileValue(path, coerceInputValue(entries[field]), nextProfile);
    }
  });
  nextProfile.meta.schemaVersion = PLAYER_PROFILE_SCHEMA_VERSION;
  return nextProfile;
}

function fillProfileForm() {
  Object.entries(PROFILE_FIELD_PATHS).forEach(([key, path]) => {
    const input = formControl(key);
    if (input) {
      input.value = getProfileValue(path) ?? "";
    }
  });
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
  const ship = state.playerProfile.externalModels.shipPlanner.summary;
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
  const groundedResults = buildGroundedShardRecommendations();
  if (groundedResults.length) {
    return groundedResults;
  }

  return [{
    id: "shard-module-grounding-warning",
    module: "shards",
    kind: "warning",
    title: "Shard milestone planner pending verified data",
    subtitle: "Descriptive mode",
    score: 0,
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
    notes: "Grounded fallback mode avoids fake optimizer precision."
  }];
}

function buildGroundedShardRecommendations() {
  const milestones = state.shardGrounding?.milestones?.milestones;
  const mechanics = state.shardGrounding?.milestones?.canonicalMechanics?.shardMilestoneSystem;
  const observedBehaviors = state.shardGrounding?.observedBehaviors?.observations;
  const uncertaintyLog = state.shardGrounding?.provenance?.uncertaintyLog;
  if (!Array.isArray(milestones) || !milestones.length || !mechanics) {
    return [];
  }

  const thresholdSummary = formatThresholdScheduleSummary(mechanics.rarity_bonus_thresholds);
  const levelCapRules = mechanics.max_level_rules_and_modifiers ?? {};
  const levelCapNotes = [
    Number.isFinite(levelCapRules.base_max_level_before_workers_badge)
      ? `Base max level before Workers Badge: ${levelCapRules.base_max_level_before_workers_badge}.`
      : null,
    Number.isFinite(levelCapRules.max_level_after_workers_badge)
      ? `Workers Badge raises shard milestone max level to ${levelCapRules.max_level_after_workers_badge}.`
      : null,
    levelCapRules.research_note || null,
    levelCapRules.ultima_loop_mod_note || null
  ].filter(Boolean);
  const uncertaintyNotes = Array.isArray(uncertaintyLog)
    ? uncertaintyLog.slice(0, 3).map((item) => `${item.topic}: ${item.what_is_missing || item.what_is_available || item.status}.`)
    : [];

  return [
    {
      id: "shard-module-grounded-descriptive-mode",
      module: "shards",
      kind: "warning",
      title: "Grounded shard milestones loaded",
      subtitle: "Descriptive mode only",
      score: 0,
      confidence: 0.63,
      whyNow: [
        `${milestones.length} grounded shard milestones are bundled into this build for descriptive reference.`,
        `Rarity threshold schedules are loaded: ${thresholdSummary}.`,
        "Current shards live in shared player truth, while shard income remains a planner-only helper field."
      ],
      assumptions: [
        "This dataset is used for grounded copy and explainability, not ranking.",
        "Observed player behaviors remain separate from canonical shard mechanics."
      ],
      warnings: [
        "Shard milestone ranking remains disabled because numeric shard costs per level are still unknown.",
        mechanics.cost_breakpoints_observed?.breakpoints_statement || "Only descriptive cost breakpoint notes are available."
      ],
      notes: "Grounded shard output now references imported milestone data without re-enabling optimizer math."
    },
    {
      id: "shard-module-grounded-facts",
      module: "shards",
      kind: "warning",
      title: "Shard milestone mechanics snapshot",
      subtitle: "Grounded facts and preserved uncertainty",
      score: 0,
      confidence: 0.58,
      whyNow: levelCapNotes,
      assumptions: [
        mechanics.effect_scaling?.description || "Incremental level increases milestone effects, but this build does not convert that into score math."
      ],
      warnings: uncertaintyNotes,
      notes: `Observed examples bundled separately: ${Array.isArray(observedBehaviors) ? observedBehaviors.length : 0} non-authoritative player behavior snapshots.`
    }
  ];
}

function runGemOptimization() {
  const mode = $("#gemBudgetMode")?.value ?? "strict";
  const budget = Number(
    state.playerProfile.externalModels.experimental.gemNodes.budget
    || state.playerProfile.compatibility.unresolvedProfileFields.gemDust
    || 0
  );
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

function runValidationCases() {
  const current = {
    ship: runShipOptimization()[0]?.title ?? "None",
    progression: runProgressionOptimization()[0]?.title ?? "None",
    gem: runGemOptimization()[0]?.title ?? "None"
  };
  return state.snapshot.validationCases.map((item) => ({
    title: item.title,
    expected: item.expected,
    actual: current[item.module],
    pass: item.expected === current[item.module]
  }));
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
    .map(([rarity, levels]) => `${rarity} ${Array.isArray(levels) ? levels.join("/") : ""}`)
    .join("; ");
}

function getProfileCompletion(profile) {
  const filled = Object.values(CANONICAL_PROFILE_FIELD_PATHS)
    .filter((path) => String(path.reduce((current, key) => current?.[key], profile) ?? "").trim() !== "").length;
  const fields = Object.keys(CANONICAL_PROFILE_FIELD_PATHS);
  return Math.round((filled / fields.length) * 100);
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
