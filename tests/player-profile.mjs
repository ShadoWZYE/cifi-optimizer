import assert from "node:assert/strict";
import {
  PLAYER_PROFILE_SCHEMA_VERSION,
  createDefaultPlayerProfile,
  createDefaultShipPlayerState,
  normalizePlayerProfile
} from "../player-profile.js";

const shipBaseline = {
  academyGears: { G1: 0 },
  innovation: { inno1: false, inno2: false, darkInno: false, softCap: false },
  calibration: {
    generators: { n1: 0 },
    techLevels: { MaxGenHWunlocked: 0, MaxGenSWunlocked: 0 },
    zagreus: { S_mod: 0 },
    hephaestus: { S_automt: 0, tickTimer: 1 },
    demeter: { OpsFromAotC: 0, TicksPerOp: 1 },
    koios: { StudiesPerResBar: 0, TicksPerResBar: 1 },
    zeus: { CappedMissions: 0, LowestUncappedMissionTimer: 1 },
    crew: { Crew: 0 },
    technical: { LongRun: false, LongRunLenDays: 0, ShortRunLenMins: 0, Meltdown: 0 }
  }
};

const baselineShipPlayerState = createDefaultShipPlayerState(shipBaseline);
const defaults = createDefaultPlayerProfile();

assert.equal(defaults.meta.schemaVersion, PLAYER_PROFILE_SCHEMA_VERSION);
assert.equal(defaults.meta.dataConfidence, "manual");
assert.equal(defaults.player.loop.loopReset, null);
assert.equal(defaults.planning.shardRatePerHour, null);
assert.equal(defaults.notes.profile, null);

const legacyProfile = {
  profileName: "Legacy main",
  automationConfidence: "verified",
  notes: "Migrated from schema v1",
  gems: 15,
  tokens: 4,
  relics: 2,
  gemDust: 300,
  shards: 1800,
  resourceFocus: "shards",
  gemNodeBudget: 120,
  researchHours: 6,
  loopReset: 42,
  shardRatePerHour: 95,
  hunterLevel: 17,
  traitSphereCount: 8,
  mechParts: 3,
  power: 500,
  speed: 2.5,
  cargo: 1200,
  stage: {
    highestShipUnlocked: "Demeter",
    manualPhase: "midgame"
  },
  systems: {
    ship: {
      playerState: {
        innovation: {
          inno1: true
        }
      }
    }
  },
  externalModels: {
    shipPlanner: {
      communityToolState: {
        crew: {
          Crew: 7
        }
      }
    }
  }
};

const normalizedLegacy = normalizePlayerProfile(legacyProfile, baselineShipPlayerState);

assert.equal(normalizedLegacy.meta.schemaVersion, PLAYER_PROFILE_SCHEMA_VERSION);
assert.equal(normalizedLegacy.meta.profileName, "Legacy main");
assert.equal(normalizedLegacy.meta.dataConfidence, "verified");
assert.equal(normalizedLegacy.player.resources.shards, 1800);
assert.equal(normalizedLegacy.player.loop.loopReset, 42);
assert.equal(normalizedLegacy.player.ship.power, 500);
assert.equal(normalizedLegacy.player.deferred.metaProgression.hunterLevel, 17);
assert.equal(normalizedLegacy.player.deferred.stage.highestShipUnlocked, "Demeter");
assert.equal(normalizedLegacy.planning.resourceFocus, "shards");
assert.equal(normalizedLegacy.planning.gemNodeBudget, 120);
assert.equal(normalizedLegacy.planning.shardRatePerHour, 95);
assert.equal(normalizedLegacy.planning.compatibility.researchHours, 6);
assert.equal(normalizedLegacy.notes.profile, "Migrated from schema v1");
assert.equal(normalizedLegacy.externalModels.shipPlanner.communityToolState.innovation.inno1, true);
assert.equal(normalizedLegacy.externalModels.shipPlanner.communityToolState.crew.Crew, 7);
assert.equal(normalizedLegacy.externalModels.shipPlanner.communityToolState.technical.LongRun, false);

const currentProfile = {
  meta: {
    schemaVersion: 2,
    profileName: "Current main",
    dataConfidence: "mixed"
  },
  player: {
    resources: {
      gems: 1,
      shards: 900
    },
    loop: {
      loopReset: 9
    },
    ship: {
      power: 50,
      speed: 1.2,
      cargo: 80
    }
  },
  planning: {
    resourceFocus: "credits",
    shardRatePerHour: 12
  },
  notes: {
    profile: "Current note"
  },
  externalModels: {
    shipPlanner: {
      communityToolState: {
        innovation: {
          darkInno: true
        }
      }
    }
  }
};

const normalizedCurrent = normalizePlayerProfile(currentProfile, baselineShipPlayerState);
assert.equal(normalizedCurrent.meta.profileName, "Current main");
assert.equal(normalizedCurrent.meta.dataConfidence, "mixed");
assert.equal(normalizedCurrent.player.resources.shards, 900);
assert.equal(normalizedCurrent.planning.shardRatePerHour, 12);
assert.equal(normalizedCurrent.notes.profile, "Current note");
assert.equal(normalizedCurrent.externalModels.shipPlanner.communityToolState.innovation.darkInno, true);
assert.equal(normalizedCurrent.externalModels.shipPlanner.communityToolState.generators.n1, 0);

console.log("Player profile schema tests passed.");
