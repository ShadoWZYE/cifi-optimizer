import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

async function readJson(relativePath) {
  const fileUrl = new URL(relativePath, import.meta.url);
  return JSON.parse(await readFile(fileUrl, "utf8"));
}

function expectRecord(value, message) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), message);
}

function expectNonEmptyString(value, message) {
  assert.equal(typeof value, "string", message);
  assert.ok(value.trim().length > 0, message);
}

function expectArray(value, message) {
  assert.ok(Array.isArray(value), message);
}

function expectSourceIds(sourceIds, knownSources, message) {
  expectArray(sourceIds, message);
  sourceIds.forEach((sourceId) => {
    expectNonEmptyString(sourceId, `${message}: invalid source id`);
    assert.ok(knownSources.has(sourceId), `${message}: unknown source id ${sourceId}`);
  });
}

function validateSnapshot(snapshot) {
  expectNonEmptyString(snapshot.snapshotVersion, "snapshotVersion must be a non-empty string");
  expectNonEmptyString(snapshot.capturedAt, "capturedAt must be a non-empty string");
  expectRecord(snapshot.sourceStrategy, "sourceStrategy must be an object");
  expectArray(snapshot.shipLoadouts, "shipLoadouts must be an array");
  assert.ok(snapshot.shipLoadouts.length >= 4, "shipLoadouts should include the shipped baseline set");
  snapshot.shipLoadouts.forEach((loadout, index) => {
    expectNonEmptyString(loadout.id, `shipLoadouts[${index}].id must be a string`);
    expectNonEmptyString(loadout.name, `shipLoadouts[${index}].name must be a string`);
    expectNonEmptyString(loadout.resourceBias, `shipLoadouts[${index}].resourceBias must be a string`);
    ["powerScale", "speedScale", "cargoScale"].forEach((field) => {
      assert.equal(typeof loadout[field], "number", `shipLoadouts[${index}].${field} must be numeric`);
    });
  });
  expectArray(snapshot.shardMilestones, "snapshot.shardMilestones must be an array");
  assert.equal(snapshot.shardMilestones.length, 0, "snapshot shardMilestones must remain quarantined");
  expectArray(snapshot.validationCases, "validationCases must be an array");
  expectArray(snapshot.researchTracks, "researchTracks must be an array");
  assert.ok(snapshot.researchTracks.some((track) => track.id === "data-contracts-and-apk-pipeline"), "researchTracks must include the dataset-contracts lane");
  return {
    id: "snapshot",
    label: "App snapshot",
    classification: "canonical-app-snapshot",
    stats: [
      `${snapshot.shipLoadouts.length} ship loadouts`,
      `${snapshot.validationCases.length} validation cases`,
      `${snapshot.researchTracks.length} research tracks`
    ]
  };
}

function validateShardDatasets(milestones, observed, provenance) {
  expectNonEmptyString(milestones.dataset, "shard milestones dataset id must be present");
  expectNonEmptyString(milestones.generatedAt, "shard milestones generatedAt must be present");
  expectNonEmptyString(milestones.sourceReport, "shard milestones sourceReport must be present");
  expectRecord(milestones.canonicalMechanics, "canonicalMechanics must be an object");
  expectArray(milestones.milestones, "shard milestones list must be an array");
  assert.ok(milestones.milestones.length >= 20, "shard milestones list must keep the grounded baseline set");

  expectNonEmptyString(observed.dataset, "observed behavior dataset id must be present");
  expectNonEmptyString(observed.sourceReport, "observed behavior sourceReport must be present");
  expectArray(observed.observations, "observations must be an array");
  assert.ok(observed.observations.length >= 4, "observations should include the grounded examples");

  expectNonEmptyString(provenance.dataset, "provenance dataset id must be present");
  expectNonEmptyString(provenance.sourceReport, "provenance sourceReport must be present");
  expectRecord(provenance.sources, "provenance.sources must be an object");
  expectArray(provenance.uncertaintyLog, "uncertaintyLog must be an array");
  assert.ok(provenance.uncertaintyLog.length >= 2, "uncertaintyLog should preserve the known gaps");

  const knownSources = new Set(Object.keys(provenance.sources));
  milestones.milestones.forEach((milestone, index) => {
    expectNonEmptyString(milestone.id, `milestones[${index}].id must be present`);
    expectNonEmptyString(milestone.name, `milestones[${index}].name must be present`);
    expectNonEmptyString(milestone.rarity, `milestones[${index}].rarity must be present`);
    expectRecord(milestone.unlockCondition, `milestones[${index}].unlockCondition must be an object`);
    expectArray(milestone.bonuses, `milestones[${index}].bonuses must be an array`);
    expectSourceIds(milestone.sourceIds, knownSources, `milestones[${index}].sourceIds`);
  });
  observed.observations.forEach((entry, index) => {
    expectNonEmptyString(entry.id, `observations[${index}].id must be present`);
    expectArray(entry.priorities, `observations[${index}].priorities must be an array`);
    expectNonEmptyString(entry.why, `observations[${index}].why must be present`);
    expectSourceIds(entry.sourceIds, knownSources, `observations[${index}].sourceIds`);
  });
  provenance.uncertaintyLog.forEach((entry, index) => {
    expectNonEmptyString(entry.topic, `uncertaintyLog[${index}].topic must be present`);
    expectNonEmptyString(entry.status, `uncertaintyLog[${index}].status must be present`);
    expectSourceIds(entry.source_ids, knownSources, `uncertaintyLog[${index}].source_ids`);
  });

  return {
    id: "shards",
    label: "Grounded shard bundle",
    classification: "grounded-descriptive",
    stats: [
      `${milestones.milestones.length} milestones`,
      `${observed.observations.length} observed behavior notes`,
      `${provenance.uncertaintyLog.length} uncertainty notes`
    ]
  };
}

function validateTokenShop(tokenShop) {
  expectRecord(tokenShop.source, "token shop source must be an object");
  expectNonEmptyString(tokenShop.source.metadata, "token shop metadata path must be present");
  expectNonEmptyString(tokenShop.source.level0, "token shop level0 path must be present");
  expectArray(tokenShop.fields, "token shop fields must be an array");
  expectRecord(tokenShop.numeric_table, "token shop numeric_table must be an object");
  assert.ok(tokenShop.fields.length >= 50, "token shop fields should include the extracted payload");
  ["TokenBoost", "DiamondBoost", "TokenBoostT2", "ATU25"].forEach((key) => {
    expectRecord(tokenShop.numeric_table[key], `token shop numeric_table.${key} must be present`);
  });
  return {
    id: "token-shop",
    label: "Token shop extract",
    classification: "extracted-mechanics",
    stats: [
      `${tokenShop.fields.length} extracted fields`,
      `${Object.keys(tokenShop.numeric_table).length} numeric groups`
    ]
  };
}

function validateMultiverseMarket(multiverseMarket) {
  expectRecord(multiverseMarket.source, "multiverse market source must be an object");
  expectArray(multiverseMarket.source.validated_ids, "validated_ids must be an array");
  expectArray(multiverseMarket.records, "multiverse market records must be an array");
  assert.ok(multiverseMarket.records.length >= 20, "multiverse market records should include the validated late block");
  assert.equal(
    multiverseMarket.source.validated_ids.length,
    multiverseMarket.records.length,
    "validated_ids length must match record count"
  );
  multiverseMarket.records.forEach((record, index) => {
    assert.equal(typeof record.inscription_id, "number", `records[${index}].inscription_id must be numeric`);
    assert.equal(typeof record.max_level, "number", `records[${index}].max_level must be numeric`);
    assert.equal(typeof record.start_cost, "number", `records[${index}].start_cost must be numeric`);
    assert.equal(typeof record.cost_exponent, "number", `records[${index}].cost_exponent must be numeric`);
  });
  return {
    id: "multiverse-market",
    label: "Multiverse market extract",
    classification: "extracted-mechanics",
    stats: [
      `${multiverseMarket.records.length} validated rows`,
      `${multiverseMarket.source.validated_ids[0]}-${multiverseMarket.source.validated_ids.at(-1)} id coverage snapshot`
    ]
  };
}

export async function validateBundledDatasets() {
  const snapshot = await readJson("../data/game-data.snapshot.v1.json");
  const shardMilestones = await readJson("../data/shard-milestones.grounded.v1.json");
  const shardObserved = await readJson("../data/shard-observed-behaviors.grounded.v1.json");
  const shardProvenance = await readJson("../data/shard-milestones-provenance.grounded.v1.json");
  const tokenShop = await readJson("../data/token-shop-values.json");
  const multiverseMarket = await readJson("../data/multiverse-market-values.json");

  return [
    validateSnapshot(snapshot),
    validateShardDatasets(shardMilestones, shardObserved, shardProvenance),
    validateTokenShop(tokenShop),
    validateMultiverseMarket(multiverseMarket)
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const summaries = await validateBundledDatasets();
  console.log("Bundled dataset contracts validated:");
  summaries.forEach((entry) => {
    console.log(`- ${entry.label} [${entry.classification}]`);
    entry.stats.forEach((stat) => console.log(`  - ${stat}`));
  });
}
