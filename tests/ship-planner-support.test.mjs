import test from "node:test";
import assert from "node:assert/strict";

import { createShipPlannerSupport } from "../support/ship-planner-support.js";

function createSupport(overrides = {}) {
  const activeLoadout = overrides.activeLoadout ?? {
    ships: { C: [0, 0, 0], Ze: Array(11).fill(0) },
    filters: {
      cells: true,
      gens: true,
      mp: true,
      shards: true,
      rp: true,
      ap: true,
      materials: true
    }
  };
  const shipConfig = overrides.shipConfig ?? {
    weights: {
      CellsAndGens: 1,
      Mods: 3,
      Shards: 2,
      RP: 1,
      AP: 1,
      Mats: 1
    }
  };
  const shipTemplates = overrides.shipTemplates ?? {
    C: {
      installs: [{ effectTypes: ["mods"] }, { effectTypes: ["cells"] }, { effectTypes: ["cells"] }],
      powerTerms: [null, null, null],
      caps: [10, 10, 10],
      reserveThresholds: [0, 0, 0]
    },
    Ze: {
      installs: Array.from({ length: 11 }, () => ({ effectTypes: ["ap"] })),
      powerTerms: Array(11).fill(null),
      caps: Array(11).fill(10),
      reserveThresholds: Array(11).fill(0)
    }
  };
  const communityToolState = overrides.communityToolState ?? {
    academyGears: {},
    innovation: { inno1: true, inno2: false, darkInno: false, softCap: false },
    generators: {},
    techLevels: { MaxGenHWunlocked: 4, MaxGenSWunlocked: 6, S_techs: 0 },
    zagreus: {},
    hephaestus: { tickTimer: 60 },
    demeter: { OpsFromAotC: 2, TicksPerOp: 30 },
    koios: { StudiesPerResBar: 3, TicksPerResBar: 20 },
    zeus: { CappedMissions: 4, LowestUncappedMissionTimer: 10 },
    crew: { Crew: 10, ZeusCrew: 7 },
    technical: { Meltdown: 2, LongRun: false, ShortRunLenMins: 120 }
  };

  return createShipPlannerSupport({
    desmosInstallWeightMaps: overrides.desmosInstallWeightMaps ?? {
      C: [["mods"], ["cells"], ["cells"]]
    },
    getActiveLoadout() {
      return activeLoadout;
    },
    getEffectiveCap(value) {
      return value;
    },
    getShipCommunityToolState() {
      return communityToolState;
    },
    getShipConfig() {
      return shipConfig;
    },
    getShipInstallTotal(shipKey) {
      return activeLoadout.ships[shipKey].reduce((total, value) => total + value, 0);
    },
    getShipTemplate(shipKey) {
      return shipTemplates[shipKey];
    },
    shipInstallIndexLayouts: overrides.shipInstallIndexLayouts ?? { default: [[0, 1], [2]] },
    sum(values) {
      return values.reduce((total, value) => total + Number(value || 0), 0);
    }
  });
}

test("ship planner support preserves run-derived totals and crew or innovation helpers", () => {
  const support = createSupport();

  assert.equal(support.getShipCrew("C"), 10);
  assert.equal(support.getShipInnovationMultiplier("C"), 7);
  assert.equal(support.getTicksRun(), 120);
  assert.equal(support.getOperationsTotal(), 6);
  assert.equal(support.getStudiesTotal(), 18);
  assert.equal(support.getMissionTotal(), 252);
});

test("install weighting normalizes effect lanes and honors the soft-cap fallback", () => {
  const support = createSupport({
    activeLoadout: {
      ships: { C: [0, 0, 0], Ze: Array(11).fill(0) },
      filters: {
        cells: false,
        gens: true,
        mp: true,
        shards: true,
        rp: true,
        ap: true,
        materials: false
      }
    },
    communityToolState: {
      academyGears: {},
      innovation: { inno1: true, inno2: false, darkInno: false, softCap: true },
      generators: {},
      techLevels: { MaxGenHWunlocked: 2, MaxGenSWunlocked: 5, S_techs: 0 },
      zagreus: {},
      hephaestus: { tickTimer: 60 },
      demeter: { OpsFromAotC: 0, TicksPerOp: 30 },
      koios: { StudiesPerResBar: 0, TicksPerResBar: 20 },
      zeus: { CappedMissions: 0, LowestUncappedMissionTimer: 10 },
      crew: { Crew: 1 },
      technical: { Meltdown: 3, LongRun: false, ShortRunLenMins: 60 }
    },
    desmosInstallWeightMaps: { C: [["mods"], ["gens"], ["mats"]] }
  });

  assert.equal(support.scorePowerTerm("HighestGen, 8", {}, 3), 15);
  assert.deepEqual(support.getInstallEffectTypes("C", 2), ["materials"]);
  assert.deepEqual(support.getDisplayEffectTypes(["gens", "mats"]), ["cells", "materials"]);
  assert.equal(support.getPrimaryEffectClass(["gens", "mats"]), "cells");
  assert.equal(support.getEffectWeight(["mats"], { CellsAndGens: 4, Mats: 2 }), 2);
  assert.equal(support.getLanePriority("cells", { CellsAndGens: 4, Mats: 2 }), 0.01);
  assert.equal(support.getInstallWeight("C", 2, { CellsAndGens: 4, Mats: 2 }), 0.01);
});

test("install gain and next-best evaluation preserve weighted scoring and tie indexes", () => {
  const support = createSupport();

  assert.ok(Math.abs(support.getInstallBaseMultiplier("C", 0) - 0.7) < 1e-12);
  assert.deepEqual(support.getInstallGain("C", 0), {
    rawGain: 7,
    weightedGain: 21
  });

  assert.deepEqual(
    support.getBestNextInstall("C", () => 1),
    {
      index: 0,
      score: 21,
      rawGain: 7,
      delta: 1,
      indexes: [0]
    }
  );

  const tieSupport = createSupport({
    activeLoadout: {
      ships: { C: [1, 0, 0], Ze: Array(11).fill(0) },
      filters: {
        cells: true,
        gens: true,
        mp: true,
        shards: true,
        rp: true,
        ap: true,
        materials: true
      }
    },
    shipTemplates: {
      C: {
        installs: [
          { effectTypes: ["mods"] },
          { effectTypes: ["cells"] },
          { effectTypes: ["cells"] }
        ],
        powerTerms: [null, null, null],
        caps: [1, 10, 10],
        reserveThresholds: [0, 0, 0]
      },
      Ze: {
        installs: Array.from({ length: 11 }, () => ({ effectTypes: ["ap"] })),
        powerTerms: Array(11).fill(null),
        caps: Array(11).fill(10),
        reserveThresholds: Array(11).fill(0)
      }
    },
    communityToolState: {
      academyGears: {},
      innovation: { inno1: false, inno2: false, darkInno: false, softCap: false },
      generators: {},
      techLevels: { MaxGenHWunlocked: 0, MaxGenSWunlocked: 0, S_techs: 0 },
      zagreus: {},
      hephaestus: { tickTimer: 60 },
      demeter: { OpsFromAotC: 0, TicksPerOp: 30 },
      koios: { StudiesPerResBar: 0, TicksPerResBar: 20 },
      zeus: { CappedMissions: 0, LowestUncappedMissionTimer: 10 },
      crew: { Crew: 10 },
      technical: { Meltdown: 1, LongRun: false, ShortRunLenMins: 60 }
    },
    desmosInstallWeightMaps: { C: [["mods"], ["cells"], ["cells"]] }
  });

  assert.deepEqual(
    tieSupport.getBestNextInstall("C", () => 1),
    {
      index: 1,
      score: 0.5,
      rawGain: 0.5,
      delta: 1,
      indexes: [1, 2]
    }
  );
});
