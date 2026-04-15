import test from "node:test";
import assert from "node:assert/strict";

import { PLAYER_PROFILE_SCHEMA_VERSION, normalizePlayerProfile } from "../player-profile.js";

test("normalizePlayerProfile maps gems into canonical diamonds", () => {
  const profile = normalizePlayerProfile({ gems: 1250 });
  assert.equal(profile.player.resources.diamonds, 1250);
});

test("normalizePlayerProfile parses supported shorthand numeric formats", () => {
  const profile = normalizePlayerProfile({
    shards: "1.23e45",
    shardRatePerHour: "10k",
    resources: { academyRelics: "5m" }
  });

  assert.equal(profile.player.resources.shards, "1.23e45");
  assert.equal(profile.planning.shards.ratePerHour, 10000);
  assert.equal(profile.player.resources.academyRelics, 5000000);
});

test("normalizePlayerProfile converts invalid numeric strings to null", () => {
  const profile = normalizePlayerProfile({
    tokens: "not-a-number",
    systems: { shards: { ratePerHour: "???" } }
  });

  assert.equal(profile.player.resources.tokens, null);
  assert.equal(profile.planning.shards.ratePerHour, null);
});

test("normalizePlayerProfile preserves only allowed meta.dataConfidence values", () => {
  assert.equal(normalizePlayerProfile({ confidence: "verified" }).meta.dataConfidence, "verified");
  assert.equal(normalizePlayerProfile({ confidence: "guessed" }).meta.dataConfidence, "manual");
  assert.equal(
    normalizePlayerProfile({ automationConfidence: "mixed" }).meta.dataConfidence,
    "mixed"
  );
});

test("normalizePlayerProfile keeps only the exact typed bounded multiverse market SaveData ranges quarantined", () => {
  const profile = normalizePlayerProfile({
    IS0Level: 3,
    IS1Level: "4",
    IS24Level: 4,
    IS71Level: 4,
    IS72Level: "5",
    EsotericR1Trades: "6",
    NecrumR9Trades: 7,
    EsotericR10Trades: 8,
    Mech1Unlocked: true,
    Mech1Units: "9",
    FinalMech1MainBonus: "1.25e5",
    Mech2Unlocked: false,
    Mech2Units: 10,
    IS111Level: 6,
    multiverseMarket: { ExistingRow: 8 }
  });

  assert.equal(profile.meta.schemaVersion, PLAYER_PROFILE_SCHEMA_VERSION);
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.status,
    "quarantined-raw-unmapped"
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.mappingGate.plannerUseAllowed,
    false
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.mappingGate
      .canonicalPromotionBlocked,
    true
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.IS0Level,
    undefined
  );
  assert.equal(profile.compatibility.unmappedSystemState.multiverseMarket.importedState.IS1Level, 4);
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.IS24Level,
    4
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.IS71Level,
    4
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.IS72Level,
    5
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.EsotericR1Trades,
    6
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.NecrumR9Trades,
    7
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.EsotericR10Trades,
    undefined
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.Mech1Unlocked,
    true
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.Mech1Units,
    9
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.FinalMech1MainBonus,
    125000
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.Mech2Unlocked,
    false
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.Mech2Units,
    undefined
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.IS111Level,
    undefined
  );
  assert.equal(
    profile.compatibility.unmappedSystemState.multiverseMarket.importedState.ExistingRow,
    8
  );
  assert.equal(profile.player.resources.tokens, null);
  assert.equal(profile.player.resources.diamonds, null);
  assert.equal(profile.player.IS71Level, undefined);
});
