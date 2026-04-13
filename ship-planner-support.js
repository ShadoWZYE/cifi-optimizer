export function normalizeEffectType(effectType) {
  if (effectType === "mods") {
    return "mp";
  }
  if (effectType === "mats") {
    return "materials";
  }
  return effectType;
}

export function getDisplayEffectTypes(effectTypes) {
  const list = Array.isArray(effectTypes) ? effectTypes : [effectTypes];
  return [
    ...new Set(
      list.map((effectType) => {
        const normalized = normalizeEffectType(effectType);
        return normalized === "gens" ? "cells" : normalized;
      })
    )
  ];
}

export function getPrimaryEffectClass(effectTypes) {
  return getDisplayEffectTypes(effectTypes)[0];
}

export function createShipPlannerSupport({
  desmosInstallWeightMaps,
  getActiveLoadout,
  getEffectiveCap,
  getShipCommunityToolState,
  getShipConfig,
  getShipInstallTotal,
  getShipTemplate,
  shipInstallIndexLayouts,
  sum
}) {
  function getHighestGen() {
    return Math.max(
      Number(getShipCommunityToolState().techLevels.MaxGenHWunlocked || 0),
      Number(getShipCommunityToolState().techLevels.MaxGenSWunlocked || 0)
    );
  }

  function getInstallEffectTypes(shipKey, installIndex) {
    const effectTypes =
      desmosInstallWeightMaps[shipKey]?.[installIndex] ??
      getShipTemplate(shipKey).installs[installIndex].effectTypes ??
      ["other"];
    return (Array.isArray(effectTypes) ? effectTypes : [effectTypes]).map(normalizeEffectType);
  }

  function getShipInstallLayout(shipKey) {
    return shipInstallIndexLayouts[shipKey] ?? shipInstallIndexLayouts.default;
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
      const total =
        Number(getShipCommunityToolState().techLevels.MaxGenHWunlocked || 0) +
        Number(getShipCommunityToolState().techLevels.MaxGenSWunlocked || 0);
      return Math.max(Math.min(total, 16) * meltdown, 1e-9);
    }
    if (term.includes("MaxGenHWunlocked")) {
      return Math.max(
        Math.min(Number(getShipCommunityToolState().techLevels.MaxGenHWunlocked || 0), 8) *
          meltdown,
        1e-9
      );
    }
    if (term.includes("MaxGenSWunlocked")) {
      return Math.max(
        Math.min(Number(getShipCommunityToolState().techLevels.MaxGenSWunlocked || 0), 8) *
          meltdown,
        1e-9
      );
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
    return Math.max(
      ...list.map((effectType) => Math.max(map[normalizeEffectType(effectType)] || 1, 1))
    );
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

  function getInstallWeight(shipKey, installIndex, weights) {
    const effectTypes = getInstallEffectTypes(shipKey, installIndex);
    return Math.max(...effectTypes.map((effectType) => getLanePriority(effectType, weights)));
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
      ? innovation.inno1
        ? 7
        : 1
      : innovation.inno2
        ? 222
        : 1;
    return main * dark;
  }

  function getTicksRun() {
    const shipPlayerState = getShipCommunityToolState();
    const technical = shipPlayerState.technical;
    const runHours = technical.LongRun
      ? Number(technical.LongRunLenDays || 0) * 24
      : Number(technical.ShortRunLenMins || 0) / 60;
    const tickTimer = Number(shipPlayerState.hephaestus.tickTimer || 1);
    return Math.floor((runHours * 3600) / Math.max(tickTimer, 0.001));
  }

  function getOperationsTotal() {
    const demeter = getShipCommunityToolState().demeter;
    const efficiency = 1;
    return (
      Number(demeter.OpsFromAotC || 0) +
      Math.floor(getTicksRun() / Math.max(Number(demeter.TicksPerOp || 1), 1)) * efficiency
    );
  }

  function getStudiesTotal() {
    const koios = getShipCommunityToolState().koios;
    const efficiency = 1;
    return (
      Math.floor(
        (getTicksRun() * Number(koios.StudiesPerResBar || 0)) /
          Math.max(Number(koios.TicksPerResBar || 1), 1)
      ) * efficiency
    );
  }

  function getMissionTotal() {
    const shipPlayerState = getShipCommunityToolState();
    const technical = shipPlayerState.technical;
    const zeus = shipPlayerState.zeus;
    const runMinutes = technical.LongRun
      ? Number(technical.LongRunLenDays || 0) * 24 * 60
      : Number(technical.ShortRunLenMins || 0);
    return Math.floor(
      runMinutes *
        (Number(zeus.CappedMissions || 0) / 2 +
          1 / Math.max(Number(zeus.LowestUncappedMissionTimer || 1), 1))
    );
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
    const sHw = Math.round((0.998 * sTechs) / 2);
    const sSw = Math.round((1.002 * sTechs) / 2);

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
        0.001 *
          Number(zagreus.S_loopFill || 0) *
          Math.pow(1.01, Number(gears.G10 || 0)) *
          Math.pow(1.01, Number(gears.G14 || 0)),
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
        0.04 *
          Number(hephaestus.S_automt || 0) *
          Math.pow(1.01, Number(gears.G8 || 0)) *
          Math.pow(1.02, Number(gears.G15 || 0)),
        0.000003 * ticksRun * Math.pow(1.02, Number(gears.G17 || 0)),
        0.002 *
          Number(hephaestus.S_automt || 0) *
          Math.pow(1.01, Number(gears.G21 || 0)) *
          Math.pow(1.02, Number(gears.G2 || 0)),
        0.05 * Number(hephaestus.S_automt || 0) * Math.pow(1.01, Number(gears.G17 || 0)),
        0.001 *
          totalGenerators *
          Math.pow(1.01, Number(gears.G20 || 0)) *
          Math.pow(1.02, Number(gears.G13 || 0)),
        0.00001 * totalGenerators * Math.pow(1.02, Number(gears.G14 || 0)),
        0.02 * Number(hephaestus.S_automt || 0) * Math.pow(1.02, Number(gears.G16 || 0)),
        0.01,
        0.000002 * ticksRun,
        0.000001 * ticksRun,
        0.00001 * ticksRun
      ],
      D: [
        Math.pow(10, 100) *
          Math.pow(1.01, Number(gears.G9 || 0)) *
          Math.pow(1.02, Number(gears.G19 || 0)),
        0.01 * Math.pow(1.01, Number(gears.G19 || 0)) * Math.pow(1.02, Number(gears.G1 || 0)),
        0.002 * ops * Math.pow(1.02, Number(gears.G18 || 0)),
        0.0002 * ops * Math.pow(1.02, Number(gears.G20 || 0)),
        0.0002 * ops * Math.pow(1.02, Number(gears.G22 || 0)),
        0.00001 *
          ops *
          Math.pow(1.01, Number(gears.G12 || 0)) *
          Math.pow(1.01, Number(gears.G16 || 0)) *
          Math.pow(1.01, Number(gears.G22 || 0)),
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
        0.00001 *
          studies *
          Math.pow(1.01, Number(gears.G3 || 0)) *
          Math.pow(1.01, Number(gears.G15 || 0)),
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

  function getInstallGain(shipKey, installIndex) {
    const crew = getShipCrew(shipKey);
    const baseMultiplier = getInstallBaseMultiplier(shipKey, installIndex);
    const exponent = scorePowerTerm(
      getShipTemplate(shipKey).powerTerms[installIndex],
      getShipConfig().weights,
      Number(getShipCommunityToolState().technical.Meltdown || 0)
    );
    const currentLevel = getActiveLoadout().ships[shipKey][installIndex];
    const denom = crew * baseMultiplier * currentLevel + 1;
    const numer = crew * baseMultiplier * (currentLevel + 1) + 1;
    const rawGain =
      currentLevel < getEffectiveCap(getShipTemplate(shipKey).caps[installIndex]) &&
      getShipInstallTotal(shipKey) >= getShipTemplate(shipKey).reserveThresholds[installIndex]
        ? Math.pow(numer / denom, exponent) - 1
        : 0;
    const weightedGain = rawGain * getInstallWeight(shipKey, installIndex, getShipConfig().weights);
    return { rawGain, weightedGain };
  }

  function getBestNextInstall(shipKey, getTapDelta) {
    const current = getActiveLoadout().ships[shipKey];
    const scored = current
      .map((_, index) => {
        const canInstall =
          current[index] < getEffectiveCap(getShipTemplate(shipKey).caps[index]) &&
          getShipInstallTotal(shipKey) >= getShipTemplate(shipKey).reserveThresholds[index];
        if (!canInstall) {
          return null;
        }
        const gain = getInstallGain(shipKey, index);
        const delta = getTapDelta(shipKey, index);
        return { index, score: gain.weightedGain * Math.max(delta, 1), rawGain: gain.rawGain, delta };
      })
      .filter(Boolean);

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

  return {
    getBestNextInstall,
    getDisplayEffectTypes,
    getEffectWeight,
    getInstallBaseMultiplier,
    getInstallEffectTypes,
    getInstallGain,
    getInstallWeight,
    getLanePriority,
    getMissionTotal,
    getOperationsTotal,
    getPrimaryEffectClass,
    getShipCrew,
    getShipInnovationMultiplier,
    getShipInstallLayout,
    getStudiesTotal,
    getTicksRun,
    normalizeEffectType,
    scorePowerTerm
  };
}
