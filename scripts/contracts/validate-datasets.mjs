import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

function expectPositiveInteger(value, message) {
  assert.equal(typeof value, "number", message);
  assert.ok(Number.isInteger(value) && value > 0, message);
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

async function validateBundledDatasetContract(contract) {
  expectNonEmptyString(contract.contractVersion, "bundled dataset contract version must be present");
  expectNonEmptyString(contract.updatedAt, "bundled dataset contract updatedAt must be present");
  expectNonEmptyString(contract.validationCommand, "bundled dataset contract validationCommand must be present");
  assert.equal(
    contract.validationCommand,
    "npm run verify:data",
    "bundled dataset contract must keep npm run verify:data as the validation command"
  );

  expectArray(contract.sourcePriority, "bundled dataset contract sourcePriority must be an array");
  assert.equal(contract.sourcePriority.length, 3, "bundled dataset contract must define the three source-priority tiers");
  contract.sourcePriority.forEach((entry, index) => {
    expectPositiveInteger(entry.rank, `sourcePriority[${index}].rank must be a positive integer`);
    expectNonEmptyString(entry.id, `sourcePriority[${index}].id must be present`);
    expectNonEmptyString(entry.label, `sourcePriority[${index}].label must be present`);
    expectNonEmptyString(entry.description, `sourcePriority[${index}].description must be present`);
    assert.equal(entry.rank, index + 1, `sourcePriority[${index}].rank must stay in source-priority order`);
  });
  assert.deepEqual(
    contract.sourcePriority.map((entry) => entry.id),
    ["apk-unity-artifacts", "official-public-corroboration", "community-gap-filling"],
    "bundled dataset contract sourcePriority ids drifted"
  );

  expectArray(contract.datasets, "bundled dataset contract datasets must be an array");
  assert.equal(contract.datasets.length, 4, "bundled dataset contract must track the four shipped dataset groups");

  for (const [index, dataset] of contract.datasets.entries()) {
    expectNonEmptyString(dataset.id, `datasets[${index}].id must be present`);
    expectNonEmptyString(dataset.label, `datasets[${index}].label must be present`);
    expectNonEmptyString(dataset.classification, `datasets[${index}].classification must be present`);
    expectArray(dataset.files, `datasets[${index}].files must be an array`);
    assert.ok(dataset.files.length >= 1, `datasets[${index}].files must not be empty`);
    for (const [fileIndex, relativePath] of dataset.files.entries()) {
      expectNonEmptyString(relativePath, `datasets[${index}].files[${fileIndex}] must be present`);
      const fileUrl = new URL(`../../${relativePath}`, import.meta.url);
      await access(fileUrl);
    }
  }

  return contract;
}

function assertContractMatchesValidation(contract, summaries) {
  const contractById = new Map(contract.datasets.map((dataset) => [dataset.id, dataset]));
  assert.deepEqual(
    summaries.map((entry) => entry.id),
    contract.datasets.map((dataset) => dataset.id),
    "bundled dataset validation order must match the checked-in contract manifest"
  );

  summaries.forEach((summary) => {
    const expected = contractById.get(summary.id);
    assert.ok(expected, `bundled dataset contract is missing ${summary.id}`);
    assert.equal(summary.label, expected.label, `bundled dataset label drifted for ${summary.id}`);
    assert.equal(
      summary.classification,
      expected.classification,
      `bundled dataset classification drifted for ${summary.id}`
    );
  });
}

export async function validateBundledDatasets() {
  const bundledDatasetContract = await validateBundledDatasetContract(
    await readJson("../../data/bundled-dataset-contract.v1.json")
  );
  const snapshot = await readJson("../../data/game-data.snapshot.v1.json");
  const shardMilestones = await readJson("../../data/shard-milestones.grounded.v1.json");
  const shardObserved = await readJson("../../data/shard-observed-behaviors.grounded.v1.json");
  const shardProvenance = await readJson("../../data/shard-milestones-provenance.grounded.v1.json");
  const tokenShop = await readJson("../../data/token-shop-values.json");
  const multiverseMarket = await readJson("../../data/multiverse-market-values.json");

  const summaries = [
    validateSnapshot(snapshot),
    validateShardDatasets(shardMilestones, shardObserved, shardProvenance),
    validateTokenShop(tokenShop),
    validateMultiverseMarket(multiverseMarket)
  ];

  assertContractMatchesValidation(bundledDatasetContract, summaries);
  return summaries;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bundledDatasetContract = await readJson("../../data/bundled-dataset-contract.v1.json");
  const summaries = await validateBundledDatasets();
  console.log(`Bundled dataset contracts validated against ${bundledDatasetContract.contractVersion}:`);
  console.log(`- Validation command: ${bundledDatasetContract.validationCommand}`);
  console.log(
    `- Source priority: ${bundledDatasetContract.sourcePriority
      .map((entry) => `${entry.rank}. ${entry.label}`)
      .join(" | ")}`
  );
  summaries.forEach((entry) => {
    console.log(`- ${entry.label} [${entry.classification}]`);
    entry.stats.forEach((stat) => console.log(`  - ${stat}`));
  });
}
