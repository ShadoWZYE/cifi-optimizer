import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const REQUIRED_PROBE_DOC_PAIRS = [
  {
    datasetPath: "data/shard-cost-native-probe.v1.json",
    docPath: "docs/systems/shards/shard-cost-native-probe.md"
  },
  {
    datasetPath: "data/shard-cost-method-probe.v1.json",
    docPath: "docs/systems/shards/shard-cost-method-probe.md"
  },
  {
    datasetPath: "data/shard-cost-parameter-probe.v1.json",
    docPath: "docs/systems/shards/shard-cost-parameter-probe.md"
  }
];

async function readJson(relativePath) {
  const fileUrl = new URL(relativePath, import.meta.url);
  return JSON.parse(await readFile(fileUrl, "utf8"));
}

async function readText(relativePath) {
  const fileUrl = new URL(relativePath, import.meta.url);
  return readFile(fileUrl, "utf8");
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

function validateShardAssetGrounding(grounding) {
  expectNonEmptyString(grounding.dataset, "shard asset grounding dataset id must be present");
  expectNonEmptyString(grounding.generatedAt, "shard asset grounding generatedAt must be present");
  expectNonEmptyString(grounding.sourceReport, "shard asset grounding sourceReport must be present");
  expectArray(grounding.sourceArtifacts, "shard asset grounding sourceArtifacts must be an array");
  expectNonEmptyString(grounding.classification, "shard asset grounding classification must be present");
  expectRecord(grounding.system, "shard asset grounding system must be an object");
  expectNonEmptyString(grounding.system.id, "shard asset grounding system.id must be present");
  expectNonEmptyString(grounding.system.label, "shard asset grounding system.label must be present");
  expectArray(grounding.groundedShellIdentifiers, "shard asset grounding groundedShellIdentifiers must be an array");
  expectArray(grounding.groundedFacts, "shard asset grounding groundedFacts must be an array");
  expectArray(grounding.appSafeUses, "shard asset grounding appSafeUses must be an array");
  expectArray(grounding.blockedUses, "shard asset grounding blockedUses must be an array");
  expectArray(grounding.unresolvedGaps, "shard asset grounding unresolvedGaps must be an array");
  expectNonEmptyString(grounding.integrationStatus, "shard asset grounding integrationStatus must be present");
  assert.ok(grounding.groundedShellIdentifiers.includes("LoopResetStage1"), "shard asset grounding must preserve LoopResetStage1");
  assert.ok(grounding.groundedShellIdentifiers.includes("MilestoneBonusesPerLevel"), "shard asset grounding must preserve MilestoneBonusesPerLevel");
  assert.ok(grounding.groundedFacts.some((fact) => String(fact).includes("ShardUpgradeInfo")), "shard asset grounding must mention ShardUpgradeInfo");
  assert.ok(grounding.unresolvedGaps.includes("exact milestone data object or serialized row payload"), "shard asset grounding must preserve the unresolved milestone payload gap");
  assert.equal(grounding.integrationStatus, "available-but-unmapped", "shard asset grounding must stay available-but-unmapped");

  return {
    id: "shard-asset-grounding",
    label: "Shard asset grounding",
    classification: "extracted-mechanics",
    stats: [
      `${grounding.groundedShellIdentifiers.length} grounded shell identifiers`,
      `${grounding.groundedFacts.length} grounded facts`,
      `${grounding.integrationStatus} integration status`
    ]
  };
}

function validateShardOwnerFamilyBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard owner-family boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard owner-family boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard owner-family boundary sources must be an object");
  ["ownerProbe", "constructionComparisonProbe", "shardMiningMetadataNeighborhood", "shardUpgradeInfoMetadataNeighborhood", "level0", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard owner-family boundary sources.${field} must be present`);
  });
  expectArray(boundary.screenControllerFamilies, "shard owner-family boundary screenControllerFamilies must be an array");
  expectArray(boundary.dataCarrierCandidates, "shard owner-family boundary dataCarrierCandidates must be an array");
  expectArray(boundary.screenControlAnchors, "shard owner-family boundary screenControlAnchors must be an array");
  expectArray(boundary.bonusFieldAnchors, "shard owner-family boundary bonusFieldAnchors must be an array");
  expectRecord(boundary.downgradedGenericLead, "shard owner-family boundary downgradedGenericLead must be an object");
  expectNonEmptyString(boundary.downgradedGenericLead.family, "shard owner-family boundary downgradedGenericLead.family must be present");
  expectArray(boundary.downgradedGenericLead.anchors, "shard owner-family boundary downgradedGenericLead.anchors must be an array");
  expectArray(boundary.downgradedGenericLead.reasons, "shard owner-family boundary downgradedGenericLead.reasons must be an array");
  expectArray(boundary.currentBoundary, "shard owner-family boundary currentBoundary must be an array");

  assert.ok(boundary.screenControllerFamilies.includes("ShardMining, Assembly-CSharp"), "shard owner-family boundary must preserve ShardMining, Assembly-CSharp");
  assert.ok(boundary.dataCarrierCandidates.includes("ShardMining|ShardUpgradeInfo"), "shard owner-family boundary must preserve ShardMining|ShardUpgradeInfo");
  assert.ok(boundary.dataCarrierCandidates.includes("ShardUpgradeInfo"), "shard owner-family boundary must preserve ShardUpgradeInfo");
  ["CheckFirstTimeShardMilestoneOpened", "AttachFastBuyButton", "FastBuyButtonMethodShards", "StartFastBuyButtonHold"].forEach((name) => {
    assert.ok(boundary.screenControlAnchors.includes(name), `shard owner-family boundary missing ${name}`);
  });
  ["TotalMilestoneLevels", "get_IsUnlocked", "get_SU1FinalUnlockReq", "get_SU29FinalUnlockReq", "FinalSU1Bonus1", "FinalSU29Bonus2", "FinalSU29Bonus3", "<FastBuyEnum>d__1429"].forEach((name) => {
    assert.ok(boundary.bonusFieldAnchors.includes(name), `shard owner-family boundary missing ${name}`);
  });
  assert.equal(boundary.downgradedGenericLead.family, "ConstructionMilestones, Assembly-CSharp", "shard owner-family boundary generic lead drifted");
  ["InitializeMilestones", "BuyMilestone1", "BuyMilestone57", "ClaimDiamondMilestone", "ConstructionMilestonesSum"].forEach((name) => {
    assert.ok(boundary.downgradedGenericLead.anchors.includes(name), `shard owner-family boundary generic lead anchors missing ${name}`);
  });
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not promote player-facing milestone labels")), "shard owner-family boundary must preserve blocked-use framing");

  return {
    id: "shard-owner-family-boundary",
    label: "Shard owner-family boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.screenControllerFamilies.length} shard screen-controller family`,
      `${boundary.bonusFieldAnchors.length} shard bonus-field anchors`,
      "ShardMining and ShardUpgradeInfo stay narrowed while ConstructionMilestones remains downgraded"
    ]
  };
}

function validateShardFinalSuBonusBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard FinalSU bonus boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard FinalSU bonus boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard FinalSU bonus boundary sources must be an object");
  ["shardUpgradeInfoMetadataNeighborhood", "shardMiningMetadataNeighborhood", "ownerFamilyVerification", "systemVerification", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard FinalSU bonus boundary sources.${field} must be present`);
  });
  expectNonEmptyString(boundary.dataCarrier, "shard FinalSU bonus boundary dataCarrier must be present");
  expectNonEmptyString(boundary.dataCarrierTieIn, "shard FinalSU bonus boundary dataCarrierTieIn must be present");
  expectArray(boundary.unlockRequirementAccessors, "shard FinalSU bonus boundary unlockRequirementAccessors must be an array");
  expectArray(boundary.bonusFieldSamples, "shard FinalSU bonus boundary bonusFieldSamples must be an array");
  expectArray(boundary.bonusAccessorSamples, "shard FinalSU bonus boundary bonusAccessorSamples must be an array");
  expectArray(boundary.adjacentFields, "shard FinalSU bonus boundary adjacentFields must be an array");
  expectArray(boundary.currentBoundary, "shard FinalSU bonus boundary currentBoundary must be an array");

  assert.equal(boundary.dataCarrier, "ShardUpgradeInfo", "shard FinalSU bonus boundary dataCarrier drifted");
  assert.equal(boundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo", "shard FinalSU bonus boundary dataCarrierTieIn drifted");
  ["get_SU1FinalUnlockReq", "get_SU29FinalUnlockReq"].forEach((name) => {
    assert.ok(boundary.unlockRequirementAccessors.includes(name), `shard FinalSU bonus boundary missing ${name}`);
  });
  ["FinalSU1Bonus1", "FinalSU1Bonus2", "FinalSU2Bonus1", "FinalSU29Bonus2", "FinalSU29Bonus3"].forEach((name) => {
    assert.ok(boundary.bonusFieldSamples.includes(name), `shard FinalSU bonus boundary missing ${name}`);
  });
  ["get_FinalSU1Bonus1", "get_FinalSU1Bonus2", "get_FinalSU2Bonus1", "get_FinalSU29Bonus2", "get_FinalSU29Bonus3"].forEach((name) => {
    assert.ok(boundary.bonusAccessorSamples.includes(name), `shard FinalSU bonus boundary missing ${name}`);
  });
  ["TotalMilestoneLevels", "get_IsUnlocked", "OverLevel100Exponent", "OverLevel400Exponent", "<FastBuyEnum>d__1429"].forEach((name) => {
    assert.ok(boundary.adjacentFields.includes(name), `shard FinalSU bonus boundary missing ${name}`);
  });
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not map FinalSU fields directly")), "shard FinalSU bonus boundary must preserve blocked-use framing");

  return {
    id: "shard-finalsu-bonus-boundary",
    label: "Shard FinalSU bonus boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.unlockRequirementAccessors.length} shard unlock accessors`,
      `${boundary.bonusFieldSamples.length} shard bonus-field samples`,
      "FinalSU bonus and SU unlock fields stay tied to ShardUpgradeInfo until row mapping is recovered"
    ]
  };
}

function validateShardMilestonePayloadBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard milestone payload boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard milestone payload boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard milestone payload boundary sources must be an object");
  ["shardMiningMetadataNeighborhood", "shardUpgradeInfoMetadataNeighborhood", "ownerFamilyBoundary", "finalSuBonusBoundary", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard milestone payload boundary sources.${field} must be present`);
  });
  expectNonEmptyString(boundary.dataCarrier, "shard milestone payload boundary dataCarrier must be present");
  expectNonEmptyString(boundary.dataCarrierTieIn, "shard milestone payload boundary dataCarrierTieIn must be present");
  expectArray(boundary.milestoneStateFields, "shard milestone payload boundary milestoneStateFields must be an array");
  expectArray(boundary.costAndListHooks, "shard milestone payload boundary costAndListHooks must be an array");
  expectArray(boundary.progressFillHooks, "shard milestone payload boundary progressFillHooks must be an array");
  expectArray(boundary.tickFields, "shard milestone payload boundary tickFields must be an array");
  expectArray(boundary.sampleCostAccessors, "shard milestone payload boundary sampleCostAccessors must be an array");
  expectArray(boundary.currentBoundary, "shard milestone payload boundary currentBoundary must be an array");

  assert.equal(boundary.dataCarrier, "ShardUpgradeInfo", "shard milestone payload boundary dataCarrier drifted");
  assert.equal(boundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo", "shard milestone payload boundary dataCarrierTieIn drifted");
  ["TotalMilestoneLevels", "get_IsUnlocked", "set_IsUnlocked", "<IsUnlocked>k__BackingField"].forEach((name) => {
    assert.ok(boundary.milestoneStateFields.includes(name), `shard milestone payload boundary missing ${name}`);
  });
  ["get_TotalMilestoneLevels", "InitializeMaxLevelBools", "UpdateMaxedMilestonesList", "UpdateUnlockedMilestonesList", "SortCostAndBools", "CountAffordableShard", "UpdateShardCostList", "GetShardCostList", "InitializeShards"].forEach((name) => {
    assert.ok(boundary.costAndListHooks.includes(name), `shard milestone payload boundary missing ${name}`);
  });
  ["CheckAllMilestoneLevelFills", "CheckMilestone0ProgressFill", "CheckMilestone1ProgressFill", "CheckMilestone9ProgressFill"].forEach((name) => {
    assert.ok(boundary.progressFillHooks.includes(name), `shard milestone payload boundary missing ${name}`);
  });
  ["Phase1Tick", "Phase2Tick", "Phase3Tick", "Phase4Tick", "Phase5Tick", "Phase6Tick", "CooldownTick"].forEach((name) => {
    assert.ok(boundary.tickFields.includes(name), `shard milestone payload boundary missing ${name}`);
  });
  ["get_SU23Cost", "get_SU24Cost", "get_SU25Cost", "get_SU26Cost", "get_SU27Cost", "get_SU28Cost", "get_SU29Cost"].forEach((name) => {
    assert.ok(boundary.sampleCostAccessors.includes(name), `shard milestone payload boundary missing ${name}`);
  });
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not treat these hooks as recovered serialized player-owned milestone rows")), "shard milestone payload boundary must preserve blocked-use framing");

  return {
    id: "shard-milestone-payload-boundary",
    label: "Shard milestone payload boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.milestoneStateFields.length} shard milestone-state fields`,
      `${boundary.costAndListHooks.length} shard cost-list hooks`,
      "Shard payload-watch hooks stay tied to ShardUpgradeInfo until saved player rows are recovered"
    ]
  };
}

function validateShardCostModelBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard cost-model boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard cost-model boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard cost-model boundary sources must be an object");
  ["shardUpgradeInfoMetadataNeighborhood", "ownerFamilyProbe", "milestonePayloadBoundary", "finalSuBonusBoundary", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard cost-model boundary sources.${field} must be present`);
  });
  expectNonEmptyString(boundary.dataCarrier, "shard cost-model boundary dataCarrier must be present");
  expectNonEmptyString(boundary.dataCarrierTieIn, "shard cost-model boundary dataCarrierTieIn must be present");
  expectArray(boundary.sampleCostAccessorWindows, "shard cost-model boundary sampleCostAccessorWindows must be an array");
  expectArray(boundary.row0CostFields, "shard cost-model boundary row0CostFields must be an array");
  expectArray(boundary.row0FillFields, "shard cost-model boundary row0FillFields must be an array");
  expectArray(boundary.row0BonusFields, "shard cost-model boundary row0BonusFields must be an array");
  expectArray(boundary.costModelFindings, "shard cost-model boundary costModelFindings must be an array");
  expectRecord(boundary.optimizerBoundary, "shard cost-model boundary optimizerBoundary must be an object");
  expectArray(boundary.optimizerBoundary.supportedNow, "shard cost-model boundary optimizerBoundary.supportedNow must be an array");
  expectArray(boundary.optimizerBoundary.blockedNow, "shard cost-model boundary optimizerBoundary.blockedNow must be an array");
  expectArray(boundary.currentBoundary, "shard cost-model boundary currentBoundary must be an array");

  assert.equal(boundary.dataCarrier, "ShardUpgradeInfo", "shard cost-model boundary dataCarrier drifted");
  assert.equal(boundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo", "shard cost-model boundary dataCarrierTieIn drifted");
  assert.deepEqual(
    boundary.sampleCostAccessorWindows,
    [
      {
        label: "earlyWindow",
        start: 0,
        end: 9,
        count: 10,
        accessors: ["get_SU0Cost", "get_SU1Cost", "get_SU2Cost", "get_SU3Cost", "get_SU4Cost", "get_SU5Cost", "get_SU6Cost", "get_SU7Cost", "get_SU8Cost", "get_SU9Cost"]
      },
      {
        label: "lateWindow",
        start: 23,
        end: 29,
        count: 7,
        accessors: ["get_SU23Cost", "get_SU24Cost", "get_SU25Cost", "get_SU26Cost", "get_SU27Cost", "get_SU28Cost", "get_SU29Cost"]
      }
    ],
    "shard cost-model boundary accessor windows drifted"
  );
  ["SU0StartCost", "SU0CostExponent", "SU0GrowthExponent", "SU0GrowthExponent2", "SU0GrowthExponent3"].forEach((name) => {
    assert.ok(boundary.row0CostFields.includes(name), `shard cost-model boundary missing ${name}`);
  });
  ["SU0Level1Fill", "SU0Level8Fill"].forEach((name) => {
    assert.ok(boundary.row0FillFields.includes(name), `shard cost-model boundary missing ${name}`);
  });
  ["SU0Bonus1", "SU0Bonus8"].forEach((name) => {
    assert.ok(boundary.row0BonusFields.includes(name), `shard cost-model boundary missing ${name}`);
  });
  assert.ok(boundary.optimizerBoundary.supportedNow.includes("row-local shard cost-parameter extraction and consistency checks against get_SU*Cost accessors"), "shard cost-model boundary must preserve supported extraction wording");
  assert.ok(boundary.optimizerBoundary.blockedNow.includes("exact per-level shard costs"), "shard cost-model boundary must preserve exact-cost blocking");
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not derive exact shard cost formulas")), "shard cost-model boundary must preserve blocked-use framing");

  return {
    id: "shard-cost-model-boundary",
    label: "Shard cost-model boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.sampleCostAccessorWindows.length} sampled shard cost windows`,
      `${boundary.row0CostFields.length} SU0 cost-shell fields`,
      "Shard cost-model evidence now preserves a row-local parameter shell without exact formula claims"
    ]
  };
}

function validateShardMilestoneRowModelBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard milestone row-model boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard milestone row-model boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard milestone row-model boundary sources must be an object");
  ["ownerFamilyProbe", "rowShellBoundary", "rowAlignmentBoundary", "costModelBoundary", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard milestone row-model boundary sources.${field} must be present`);
  });
  expectNonEmptyString(boundary.dataCarrierTieIn, "shard milestone row-model boundary dataCarrierTieIn must be present");
  expectRecord(boundary.textCheckerRange, "shard milestone row-model boundary textCheckerRange must be an object");
  expectRecord(boundary.unlockRequirementRange, "shard milestone row-model boundary unlockRequirementRange must be an object");
  expectRecord(boundary.buyHookEvidence, "shard milestone row-model boundary buyHookEvidence must be an object");
  expectArray(boundary.buyHookEvidence.shardLocalDirectHooks, "shard milestone row-model boundary shardLocalDirectHooks must be an array");
  expectRecord(boundary.buyHookEvidence.genericNumberedFamily, "shard milestone row-model boundary genericNumberedFamily must be an object");
  expectArray(boundary.rowModelFindings, "shard milestone row-model boundary rowModelFindings must be an array");
  expectArray(boundary.currentBoundary, "shard milestone row-model boundary currentBoundary must be an array");

  assert.equal(boundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo", "shard milestone row-model boundary dataCarrierTieIn drifted");
  assert.deepEqual(boundary.textCheckerRange, { start: 0, end: 29, count: 30 }, "shard milestone row-model boundary textCheckerRange drifted");
  assert.deepEqual(boundary.unlockRequirementRange, { start: 0, end: 29, count: 30 }, "shard milestone row-model boundary unlockRequirementRange drifted");
  assert.deepEqual(boundary.buyHookEvidence.shardLocalDirectHooks, ["BuyMilestone0"], "shard milestone row-model boundary shardLocalDirectHooks drifted");
  assert.deepEqual(
    boundary.buyHookEvidence.genericNumberedFamily,
    { family: "ConstructionMilestones, Assembly-CSharp", start: 1, end: 57, count: 57 },
    "shard milestone row-model boundary genericNumberedFamily drifted"
  );
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not infer that rows 0-29 are already mapped")), "shard milestone row-model boundary must preserve blocked-use framing");

  return {
    id: "shard-milestone-row-model-boundary",
    label: "Shard milestone row-model boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.textCheckerRange.count} shard-local text-checker rows`,
      `${boundary.unlockRequirementRange.count} shard-local unlock rows`,
      "Shard row-model evidence now preserves a contiguous 0-29 shell while the buy seam stays unresolved"
    ]
  };
}

function validateShardMilestoneTitleEffectBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard milestone title/effect boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard milestone title/effect boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard milestone title/effect boundary sources must be an object");
  ["unityProbeReport", "ownerFamilyProbe", "shardUpgradeInfoMetadataNeighborhood", "rowModelBoundary", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard milestone title/effect boundary sources.${field} must be present`);
  });
  expectArray(boundary.titleAssetCandidates, "shard milestone title/effect boundary titleAssetCandidates must be an array");
  expectArray(boundary.effectPresentationSlots, "shard milestone title/effect boundary effectPresentationSlots must be an array");
  expectArray(boundary.sampleBonusCalcAccessors, "shard milestone title/effect boundary sampleBonusCalcAccessors must be an array");
  expectArray(boundary.findings, "shard milestone title/effect boundary findings must be an array");
  expectArray(boundary.currentBoundary, "shard milestone title/effect boundary currentBoundary must be an array");

  assert.ok(boundary.titleAssetCandidates.some((entry) => entry.row === 0 && entry.assetName === "SMilestone-0-Eternal(OURO)"), "shard milestone title/effect boundary missing row 0 title asset");
  assert.ok(boundary.titleAssetCandidates.some((entry) => entry.row === 29 && entry.assetName === "SMilestone-29-Earthly"), "shard milestone title/effect boundary missing row 29 title asset");
  assert.ok(boundary.titleAssetCandidates.some((entry) => entry.row === 30 && entry.assetName === "SMilestone-30-Illuminating"), "shard milestone title/effect boundary missing row 30 title asset");
  assert.equal(boundary.titleAssetCandidates.filter((entry) => entry.row === 28).length, 2, "shard milestone title/effect boundary should preserve both row 28 title candidates");
  ["ShardMilestoneBonus1", "ShardMilestoneBonus8"].forEach((name) => {
    assert.ok(boundary.effectPresentationSlots.includes(name), `shard milestone title/effect boundary missing ${name}`);
  });
  ["get_SU1Bonus1Calc", "get_SU5Bonus2Calc"].forEach((name) => {
    assert.ok(boundary.sampleBonusCalcAccessors.includes(name), `shard milestone title/effect boundary missing ${name}`);
  });
  assert.ok(boundary.findings.some((line) => /row 28 currently has conflicting shipped asset title candidates/i.test(String(line))), "shard milestone title/effect boundary must preserve the row 28 conflict");
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not treat the title list as fully conflict-free")), "shard milestone title/effect boundary must preserve blocked-use framing");

  return {
    id: "shard-milestone-title-effect-boundary",
    label: "Shard milestone title/effect boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.titleAssetCandidates.length} shipped shard title candidates`,
      `${boundary.effectPresentationSlots.length} shard effect presentation slots`,
      "Shard title assets and effect-family clues are preserved without claiming row-complete text mapping"
    ]
  };
}

function validateShardEffectTextHandlerBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard effect-text handler boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard effect-text handler boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard effect-text handler boundary sources must be an object");
  ["unityProbeReport", "targetedStringProbe", "ownerComparisonProbe", "titleEffectBoundary", "rowModelBoundary"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard effect-text handler boundary sources.${field} must be present`);
  });
  expectNonEmptyString(boundary.probableTextHandler, "shard effect-text handler boundary probableTextHandler must be present");
  expectArray(boundary.presentationFamily, "shard effect-text handler boundary presentationFamily must be an array");
  expectArray(boundary.sampleBonusCalcAccessors, "shard effect-text handler boundary sampleBonusCalcAccessors must be an array");
  expectArray(boundary.uiContextAnchors, "shard effect-text handler boundary uiContextAnchors must be an array");
  expectNonEmptyString(boundary.genericMilestoneWriter, "shard effect-text handler boundary genericMilestoneWriter must be present");
  expectRecord(boundary.rowModelCoverage, "shard effect-text handler boundary rowModelCoverage must be an object");
  expectArray(boundary.currentBoundary, "shard effect-text handler boundary currentBoundary must be an array");

  assert.equal(boundary.probableTextHandler, "TextHandlerShardMilestoneBonusesPerLevel/N", "shard effect-text handler boundary probableTextHandler drifted");
  ["ShardMilestoneBonus1", "ShardMilestoneBonus8"].forEach((name) => {
    assert.ok(boundary.presentationFamily.includes(name), `shard effect-text handler boundary missing ${name}`);
  });
  ["get_SU1Bonus1Calc", "get_SU5Bonus2Calc"].forEach((name) => {
    assert.ok(boundary.sampleBonusCalcAccessors.includes(name), `shard effect-text handler boundary missing ${name}`);
  });
  ["LevelText", "DescText", "ValueText", "DescriptionText"].forEach((name) => {
    assert.ok(boundary.uiContextAnchors.includes(name), `shard effect-text handler boundary missing ${name}`);
  });
  assert.equal(boundary.genericMilestoneWriter, "SetAllMilestoneTexts", "shard effect-text handler boundary genericMilestoneWriter drifted");
  assert.deepEqual(boundary.rowModelCoverage, { start: 0, end: 29, count: 30 }, "shard effect-text handler boundary rowModelCoverage drifted");
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not treat this boundary as a recovered row-complete effect-text table")), "shard effect-text handler boundary must preserve blocked-use framing");

  return {
    id: "shard-effect-text-handler-boundary",
    label: "Shard effect-text handler boundary",
    classification: "extracted-mechanics",
    stats: [
      boundary.probableTextHandler,
      `${boundary.presentationFamily.length} shard effect presentation slots`,
      "Shard bonus text recovery now has a leading shard-specific handler clue without claiming row-complete final text"
    ]
  };
}

function validateShardMilestoneRowShellBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard milestone row-shell boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard milestone row-shell boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard milestone row-shell boundary sources must be an object");
  ["shardMiningMetadataNeighborhood", "ownerFamilyBoundary", "payloadBoundary", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard milestone row-shell boundary sources.${field} must be present`);
  });
  expectNonEmptyString(boundary.screenControllerFamily, "shard milestone row-shell boundary screenControllerFamily must be present");
  expectNonEmptyString(boundary.dataCarrierTieIn, "shard milestone row-shell boundary dataCarrierTieIn must be present");
  expectArray(boundary.controllerShellAnchors, "shard milestone row-shell boundary controllerShellAnchors must be an array");
  expectArray(boundary.unlockHookSamples, "shard milestone row-shell boundary unlockHookSamples must be an array");
  expectArray(boundary.buyHookSamples, "shard milestone row-shell boundary buyHookSamples must be an array");
  expectArray(boundary.textCheckerSamples, "shard milestone row-shell boundary textCheckerSamples must be an array");
  expectArray(boundary.currentBoundary, "shard milestone row-shell boundary currentBoundary must be an array");

  assert.equal(boundary.screenControllerFamily, "ShardMining, Assembly-CSharp", "shard milestone row-shell boundary screenControllerFamily drifted");
  assert.equal(boundary.dataCarrierTieIn, "ShardMining|ShardUpgradeInfo", "shard milestone row-shell boundary dataCarrierTieIn drifted");
  ["AttachFastBuyButton", "StartFastBuyButtonHold", "FastBuyButtonMethodShards"].forEach((name) => {
    assert.ok(boundary.controllerShellAnchors.includes(name), `shard milestone row-shell boundary missing ${name}`);
  });
  ["UnlockMilestone17", "UnlockMilestone29"].forEach((name) => {
    assert.ok(boundary.unlockHookSamples.includes(name), `shard milestone row-shell boundary missing ${name}`);
  });
  assert.ok(boundary.buyHookSamples.includes("BuyMilestone0"), "shard milestone row-shell boundary missing BuyMilestone0");
  ["Milestone0TextChecker", "Milestone9TextChecker", "Milestone12TextChecker"].forEach((name) => {
    assert.ok(boundary.textCheckerSamples.includes(name), `shard milestone row-shell boundary missing ${name}`);
  });
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not treat this partial row shell")), "shard milestone row-shell boundary must preserve blocked-use framing");

  return {
    id: "shard-milestone-row-shell-boundary",
    label: "Shard milestone row-shell boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.unlockHookSamples.length} shard unlock-hook samples`,
      `${boundary.textCheckerSamples.length} shard text-checker samples`,
      "Partial shard row shell stays attached to the narrowed ShardMining trail without row-owner claims"
    ]
  };
}

function validateShardMilestoneRowAlignmentBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard milestone row-alignment boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard milestone row-alignment boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard milestone row-alignment boundary sources must be an object");
  ["shardMiningMetadataNeighborhood", "rowShellBoundary", "ownerFamilyBoundary", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard milestone row-alignment boundary sources.${field} must be present`);
  });
  expectNonEmptyString(boundary.screenControllerFamily, "shard milestone row-alignment boundary screenControllerFamily must be present");
  expectRecord(boundary.unlockHookRange, "shard milestone row-alignment boundary unlockHookRange must be an object");
  expectRecord(boundary.textCheckerRange, "shard milestone row-alignment boundary textCheckerRange must be an object");
  expectRecord(boundary.buyHookRange, "shard milestone row-alignment boundary buyHookRange must be an object");
  expectArray(boundary.unlockTextCheckerOverlapIds, "shard milestone row-alignment boundary unlockTextCheckerOverlapIds must be an array");
  expectArray(boundary.buyTextCheckerOverlapIds, "shard milestone row-alignment boundary buyTextCheckerOverlapIds must be an array");
  expectArray(boundary.currentBoundary, "shard milestone row-alignment boundary currentBoundary must be an array");

  assert.equal(boundary.screenControllerFamily, "ShardMining, Assembly-CSharp", "shard milestone row-alignment boundary screenControllerFamily drifted");
  assert.deepEqual(boundary.unlockHookRange, { start: 17, end: 29, count: 13 }, "shard milestone row-alignment boundary unlockHookRange drifted");
  assert.deepEqual(boundary.textCheckerRange, { start: 0, end: 12, count: 13 }, "shard milestone row-alignment boundary textCheckerRange drifted");
  assert.deepEqual(boundary.buyHookRange, { start: 0, end: 0, count: 1 }, "shard milestone row-alignment boundary buyHookRange drifted");
  assert.deepEqual(boundary.unlockTextCheckerOverlapIds, [], "shard milestone row-alignment boundary unlockTextCheckerOverlapIds drifted");
  assert.deepEqual(boundary.buyTextCheckerOverlapIds, [0], "shard milestone row-alignment boundary buyTextCheckerOverlapIds drifted");
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("Do not infer that UnlockMilestone17 already maps")), "shard milestone row-alignment boundary must preserve blocked-use framing");

  return {
    id: "shard-milestone-row-alignment-boundary",
    label: "Shard milestone row-alignment boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.unlockHookRange.count} unlock-hook ids`,
      `${boundary.textCheckerRange.count} text-checker ids`,
      "Partial shard row shell still does not form one clean shared row-number family"
    ]
  };
}

function validateShardSaveBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard save boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard save boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard save boundary sources must be an object");
  ["shardMiningMetadataNeighborhood", "shardUpgradeInfoMetadataNeighborhood", "shardMetadataNeighborhood", "ownerFamilyBoundary", "payloadBoundary", "globalMetadata", "level0"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard save boundary sources.${field} must be present`);
  });
  expectArray(boundary.ownerShellTermsChecked, "shard save boundary ownerShellTermsChecked must be an array");
  expectArray(boundary.saveFamilyTermsChecked, "shard save boundary saveFamilyTermsChecked must be an array");
  expectRecord(boundary.probeResults, "shard save boundary probeResults must be an object");
  expectArray(boundary.currentBoundary, "shard save boundary currentBoundary must be an array");

  ["ShardMining", "ShardUpgradeInfo", "TotalMilestoneLevels", "UpdateShardCostList", "GetShardCostList", "CheckAllMilestoneLevelFills", "get_SU1FinalUnlockReq", "FinalSU29Bonus2"].forEach((name) => {
    assert.ok(boundary.ownerShellTermsChecked.includes(name), `shard save boundary missing ${name}`);
  });
  ["PlayerProfileData", "GetPlayerProfileData", "FillPlayerProfileData", "CloudSavePlayerProfile"].forEach((name) => {
    assert.ok(boundary.saveFamilyTermsChecked.includes(name), `shard save boundary missing ${name}`);
  });
  assert.equal(boundary.probeResults.metadataNeighborhoodHasSaveTerms, false, "shard save boundary metadataNeighborhoodHasSaveTerms drifted");
  assert.equal(boundary.probeResults.level0HasSaveTerms, false, "shard save boundary level0HasSaveTerms drifted");
  assert.equal(boundary.probeResults.ownerShellWithSaveOverlapCount, 0, "shard save boundary ownerShellWithSaveOverlapCount drifted");
  assert.equal(boundary.probeResults.directShardPlayerProfileContext, false, "shard save boundary directShardPlayerProfileContext drifted");
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("zero checked overlap")), "shard save boundary must preserve zero-overlap framing");

  return {
    id: "shard-save-boundary",
    label: "Shard save boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.ownerShellTermsChecked.length} shard owner-shell terms checked`,
      `${boundary.saveFamilyTermsChecked.length} save-family terms checked`,
      "Shard owner trail still stays separate from recovered save-family clues"
    ]
  };
}

function validateShardMilestoneSaveOwnerCandidates(candidates) {
  expectNonEmptyString(candidates.dataset, "shard milestone save-owner candidates dataset id must be present");
  expectNonEmptyString(candidates.generatedAt, "shard milestone save-owner candidates generatedAt must be present");
  expectRecord(candidates.sources, "shard milestone save-owner candidates sources must be an object");
  ["shardSaveBoundary", "ownerFamilyBoundary", "payloadBoundary", "typeMetadataProbe", "extractionCandidateFamilies", "globalMetadata", "level0"].forEach((field) => {
    expectNonEmptyString(candidates.sources[field], `shard milestone save-owner candidates sources.${field} must be present`);
  });
  expectArray(candidates.candidateTypes, "shard milestone save-owner candidates candidateTypes must be an array");
  assert.ok(candidates.candidateTypes.length >= 1, "shard milestone save-owner candidates must preserve at least one candidate");
  candidates.candidateTypes.forEach((entry, index) => {
    expectNonEmptyString(entry.id, `shard milestone save-owner candidates[${index}].id must be present`);
    expectNonEmptyString(entry.label, `shard milestone save-owner candidates[${index}].label must be present`);
    expectNonEmptyString(entry.kind, `shard milestone save-owner candidates[${index}].kind must be present`);
    expectNonEmptyString(entry.confidence, `shard milestone save-owner candidates[${index}].confidence must be present`);
    expectArray(entry.why, `shard milestone save-owner candidates[${index}].why must be an array`);
    expectArray(entry.candidateFieldClusters, `shard milestone save-owner candidates[${index}].candidateFieldClusters must be an array`);
    expectRecord(entry.checkedOverlapStats, `shard milestone save-owner candidates[${index}].checkedOverlapStats must be an object`);
  });
  expectArray(candidates.confidenceNotes, "shard milestone save-owner candidates confidenceNotes must be an array");
  expectRecord(candidates.checkedOverlapStatistics, "shard milestone save-owner candidates checkedOverlapStatistics must be an object");
  expectArray(candidates.warnings, "shard milestone save-owner candidates warnings must be an array");
  expectArray(candidates.currentBoundary, "shard milestone save-owner candidates currentBoundary must be an array");

  assert.ok(candidates.candidateTypes.some((entry) => entry.id === "player-profile-side-shard-member-shell"), "shard milestone save-owner candidates must preserve the PlayerProfile-side candidate");
  assert.ok(candidates.candidateTypes.some((entry) => entry.id === "shard-mining-wrapper-or-handoff-shell"), "shard milestone save-owner candidates must preserve the shard wrapper candidate");
  assert.equal(candidates.checkedOverlapStatistics.ownerShellWithSaveOverlapCount, 0, "shard milestone save-owner candidates overlap count drifted");
  assert.equal(candidates.checkedOverlapStatistics.directShardPlayerProfileContext, false, "shard milestone save-owner candidates direct save context drifted");
  assert.ok(candidates.warnings.some((line) => String(line).includes("not recovered player-owned shard milestone state")), "shard milestone save-owner candidates must preserve warning framing");
  assert.ok(candidates.currentBoundary.some((line) => String(line).includes("candidate-narrowing artifact only")), "shard milestone save-owner candidates must preserve candidate-only framing");
  assert.ok(candidates.currentBoundary.some((line) => String(line).includes("not as recovered player-owned shard milestone state")), "shard milestone save-owner candidates must preserve save-state boundary framing");

  return {
    id: "shard-milestone-save-owner-candidates",
    label: "Shard milestone save-owner candidates",
    classification: "extracted-mechanics",
    stats: [
      `${candidates.candidateTypes.length} candidate types`,
      `${candidates.checkedOverlapStatistics.ownerShellWithSaveOverlapCount} checked save-overlap hits`,
      "Save-owner candidates stay narrowed without claiming recovered player-owned shard milestone state"
    ]
  };
}

function validateShardSceneMonoBehaviourProbe(probe) {
  expectNonEmptyString(probe.dataset, "shard scene MonoBehaviour probe dataset id must be present");
  expectNonEmptyString(probe.generatedAt, "shard scene MonoBehaviour probe generatedAt must be present");
  expectRecord(probe.source, "shard scene MonoBehaviour probe source must be an object");
  ["unityJoinedDir", "probeMethod"].forEach((field) => {
    expectNonEmptyString(probe.source[field], `shard scene MonoBehaviour probe source.${field} must be present`);
  });
  expectArray(probe.monoBehaviours, "shard scene MonoBehaviour probe monoBehaviours must be an array");
  expectArray(probe.findings, "shard scene MonoBehaviour probe findings must be an array");
  expectArray(probe.currentBoundary, "shard scene MonoBehaviour probe currentBoundary must be an array");

  assert.equal(probe.dataset, "shard-scene-monobehaviour-probe.v1", "shard scene MonoBehaviour probe dataset drifted");
  assert.ok(probe.monoBehaviours.some((entry) => entry.scriptName === "ShardMining" && entry.assetsFile === "level0"), "shard scene MonoBehaviour probe must preserve ShardMining level0 target");
  assert.ok(probe.monoBehaviours.some((entry) => entry.scriptName === "ShardPerLevelTextHandler" && entry.assetsFile === "level0"), "shard scene MonoBehaviour probe must preserve shard text handler target");
  assert.ok(probe.monoBehaviours.some((entry) => entry.scriptName === "ConstructionMilestones" && entry.assetsFile === "level0"), "shard scene MonoBehaviour probe must preserve ConstructionMilestones level0 target");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("Do not claim recovered shard numeric fields")), "shard scene MonoBehaviour probe must preserve blocked-use framing");

  return {
    id: "shard-scene-monobehaviour-probe",
    label: "Shard scene MonoBehaviour probe",
    classification: "extracted-mechanics",
    stats: [
      `${probe.monoBehaviours.length} shard scene-object targets`,
      "ShardMining and shard text-handler byte ranges are now preserved directly from level0",
      "Scene-object narrowing is preserved without claiming typed shard values"
    ]
  };
}

function validateShardCostParameterProbe(probe) {
  expectNonEmptyString(probe.dataset, "shard cost parameter probe dataset id must be present");
  expectNonEmptyString(probe.generatedAt, "shard cost parameter probe generatedAt must be present");
  expectRecord(probe.source, "shard cost parameter probe source must be an object");
  ["metadata", "level0"].forEach((field) => {
    expectNonEmptyString(probe.source[field], `shard cost parameter probe source.${field} must be present`);
  });
  expectRecord(probe.metadataFamilies, "shard cost parameter probe metadataFamilies must be an object");
  ["startCostFields", "costExponentFields", "growthExponentFields", "costAccessors"].forEach((field) => {
    expectArray(probe.metadataFamilies[field], `shard cost parameter probe metadataFamilies.${field} must be an array`);
  });
  ["overLevelExponentFields", "overLevelExponentAccessors"].forEach((field) => {
    expectArray(probe.metadataFamilies[field], `shard cost parameter probe metadataFamilies.${field} must be an array`);
  });
  expectArray(probe.shardMiningCandidateTuples, "shard cost parameter probe shardMiningCandidateTuples must be an array");
  expectArray(probe.rowAlignedTupleCandidates, "shard cost parameter probe rowAlignedTupleCandidates must be an array");
  expectArray(probe.signatureGroups, "shard cost parameter probe signatureGroups must be an array");
  expectArray(probe.findings, "shard cost parameter probe findings must be an array");
  expectArray(probe.currentBoundary, "shard cost parameter probe currentBoundary must be an array");

  assert.equal(probe.dataset, "shard-cost-parameter-probe.v1", "shard cost parameter probe dataset drifted");
  assert.equal(probe.metadataFamilies.startCostFields.length, 30, "shard cost parameter probe startCostFields drifted");
  assert.equal(probe.metadataFamilies.costExponentFields.length, 30, "shard cost parameter probe costExponentFields drifted");
  assert.ok(probe.metadataFamilies.growthExponentFields.length >= 30, "shard cost parameter probe growthExponentFields regressed");
  assert.equal(probe.metadataFamilies.costAccessors.length, 30, "shard cost parameter probe costAccessors drifted");
  assert.deepEqual(probe.metadataFamilies.overLevelExponentFields, ["OverLevel100Exponent", "OverLevel200Exponent", "OverLevel300Exponent", "OverLevel400Exponent"], "shard cost parameter probe overLevelExponentFields drifted");
  assert.deepEqual(probe.metadataFamilies.overLevelExponentAccessors, ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], "shard cost parameter probe overLevelExponentAccessors drifted");
  assert.equal(probe.unlockRequirementBlock?.offset, 1456, "shard cost parameter probe unlockRequirementBlock offset drifted");
  assert.deepEqual(probe.unlockRequirementBlock?.values?.slice(0, 8), [0, 0, 5, 10, 20, 30, 40, 50], "shard cost parameter probe early unlock requirements drifted");
  assert.deepEqual(probe.unlockRequirementBlock?.values?.slice(-3), [8000, 8050, 8100], "shard cost parameter probe late unlock requirements drifted");
  assert.ok(probe.shardMiningCandidateTuples.length >= 7, "shard cost parameter probe candidate tuples regressed");
  assert.equal(probe.rowAlignedTupleCandidates.length, 30, "shard cost parameter probe rowAlignedTupleCandidates drifted");
  assert.equal(probe.row0AlignedTupleCandidate?.row, 0, "shard cost parameter probe row0AlignedTupleCandidate row drifted");
  assert.equal(probe.row0AlignedTupleCandidate?.pointerRefCount, 19, "shard cost parameter probe row0AlignedTupleCandidate pointerRefCount drifted");
  assert.equal(probe.row0AlignedTupleCandidate?.unlockRequirementValue, 0, "shard cost parameter probe row0AlignedTupleCandidate unlockRequirementValue drifted");
  assert.equal(probe.row0AlignedTupleCandidate?.bonusCount, 3, "shard cost parameter probe row0AlignedTupleCandidate bonusCount drifted");
  assert.equal(probe.row0AlignedTupleCandidate?.numericBlockByteCount, 92, "shard cost parameter probe row0AlignedTupleCandidate numericBlockByteCount drifted");
  assert.equal(probe.row0AlignedTupleCandidate?.trailingSlackByteCount, 20, "shard cost parameter probe row0AlignedTupleCandidate trailingSlackByteCount drifted");
  assert.equal(Number(probe.row0AlignedTupleCandidate?.leadingValue), 5, "shard cost parameter probe row0AlignedTupleCandidate leadingValue drifted");
  assert.equal(Number(probe.row0AlignedTupleCandidate?.exponentA), 1.3, "shard cost parameter probe row0AlignedTupleCandidate exponentA drifted");
  assert.equal(Number(probe.row0AlignedTupleCandidate?.exponentB), 1.5, "shard cost parameter probe row0AlignedTupleCandidate exponentB drifted");
  assert.equal(Number(probe.row0AlignedTupleCandidate?.tailScalar), 1.1, "shard cost parameter probe row0AlignedTupleCandidate tailScalar drifted");
  assert.deepEqual(probe.row0AlignedTupleCandidate?.strongestFieldOrderMapping?.values, {
    StartCost: 5,
    CostExponent: 1.3,
    GrowthExponent: 1.5,
    GrowthExponent2: 1.1,
    GrowthExponent3: 2
  }, "shard cost parameter probe row0AlignedTupleCandidate strongestFieldOrderMapping drifted");
  assert.equal(probe.row0AlignedTupleCandidate?.strongestFieldOrderMapping?.exactBigDoubleValues?.StartCost?.label, "5.0e0", "shard cost parameter probe row0 StartCost BigDouble label drifted");
  assert.deepEqual(probe.row0AlignedTupleCandidate?.bonusPerLevelValues?.map((value) => Number(value.toFixed(3))), [1.1, 1.02, 1.3], "shard cost parameter probe row0 bonusPerLevelValues drifted");
  assert.ok(probe.signatureGroups.length >= 5, "shard cost parameter probe signatureGroups regressed");
  assert.ok(probe.rowAlignedTupleCandidates.some((entry) => entry?.row === 19 && entry?.unlockRequirementValue === 1400 && entry?.intValue === 70 && Number(entry?.exponentA) === 2.5 && Number(entry?.exponentB) === 4), "shard cost parameter probe row 19 tuple drifted");
  assert.ok(probe.rowAlignedTupleCandidates.some((entry) => entry?.row === 27 && entry?.unlockRequirementValue === 8000 && entry?.intValue === 975 && Number(entry?.exponentA) === 2.25 && Number(entry?.exponentB) === 4), "shard cost parameter probe row 27 tuple drifted");
  assert.ok(probe.rowAlignedTupleCandidates.some((entry) => entry?.row === 29 && entry?.intValue === 988 && Number(entry?.exponentA) === 2.3 && Number(entry?.exponentB) === 4), "shard cost parameter probe row 29 tuple drifted");
  assert.ok(probe.rowAlignedTupleCandidates.some((entry) => entry?.row === 19
    && Number(entry?.strongestFieldOrderMapping?.values?.StartCost) === 1
    && Number(entry?.strongestFieldOrderMapping?.values?.CostExponent) === 2.5
    && Number(entry?.strongestFieldOrderMapping?.values?.GrowthExponent) === 4
    && Number(entry?.strongestFieldOrderMapping?.auxiliaryIntCandidate) === 70), "shard cost parameter probe row 19 strongestFieldOrderMapping drifted");
  assert.ok(probe.rowAlignedTupleCandidates.some((entry) => entry?.row === 19
    && entry?.strongestFieldOrderMapping?.exactBigDoubleValues?.StartCost?.label === "1.0e70"
    && entry?.strongestFieldOrderMapping?.exactBigDoubleValues?.CostExponent?.label === "2.5e0"
    && entry?.strongestFieldOrderMapping?.exactBigDoubleValues?.GrowthExponent?.label === "4.0e-1"), "shard cost parameter probe row 19 exact BigDouble mapping drifted");
  assert.ok(probe.rowAlignedTupleCandidates.some((entry) => entry?.row === 27
    && Number(entry?.strongestFieldOrderMapping?.values?.StartCost) === 2
    && Number(entry?.strongestFieldOrderMapping?.values?.CostExponent) === 2.25
    && Number(entry?.strongestFieldOrderMapping?.values?.GrowthExponent) === 4
    && Number(entry?.strongestFieldOrderMapping?.auxiliaryIntCandidate) === 975), "shard cost parameter probe row 27 strongestFieldOrderMapping drifted");
  assert.ok(probe.rowAlignedTupleCandidates.some((entry) => entry?.row === 27
    && entry?.strongestFieldOrderMapping?.exactBigDoubleValues?.StartCost?.label === "2.0e975"
    && entry?.strongestFieldOrderMapping?.exactBigDoubleValues?.CostExponent?.label === "2.25e0"
    && entry?.strongestFieldOrderMapping?.exactBigDoubleValues?.GrowthExponent?.label === "4.0e-1"), "shard cost parameter probe row 27 exact BigDouble mapping drifted");
  assert.ok(probe.rowAlignedTupleCandidates.some((entry) => entry?.row === 29
    && entry?.numericBlockByteCount === 60
    && entry?.trailingSlackByteCount === 48
    && JSON.stringify(entry?.bonusPerLevelValues?.map((value) => Number(value.toFixed(3)))) === JSON.stringify([1.16, 1.018, 1.028])), "shard cost parameter probe row 29 bounded block drifted");
  assert.deepEqual(probe.repeatedCommonRowGroup?.rows, [19, 20, 21], "shard cost parameter probe repeatedCommonRowGroup rows drifted");
  assert.equal(probe.repeatedCommonRowGroup?.tuples?.length, 3, "shard cost parameter probe repeatedCommonRowGroup tuple count drifted");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("exact serialized ShardMining row fields")), "shard cost parameter probe must preserve serialized-field framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("not as a verified get_SU*Cost formula")), "shard cost parameter probe must preserve formula-block framing");

  return {
    id: "shard-cost-parameter-probe",
    label: "Shard cost parameter probe",
    classification: "extracted-mechanics",
    stats: [
      `${probe.metadataFamilies.startCostFields.length} StartCost fields`,
      `${probe.metadataFamilies.costAccessors.length} cost accessors`,
      `${probe.shardMiningCandidateTuples.length} raw numeric tuples`,
      `${probe.signatureGroups.length} direct signature groups`
    ]
  };
}

function validateShardCostMethodProbe(probe) {
  expectNonEmptyString(probe.dataset, "shard cost method probe dataset id must be present");
  expectNonEmptyString(probe.generatedAt, "shard cost method probe generatedAt must be present");
  expectRecord(probe.source, "shard cost method probe source must be an object");
  ["uabeaProbeReport", "libIl2cpp"].forEach((field) => {
    expectNonEmptyString(probe.source[field], `shard cost method probe source.${field} must be present`);
  });
  expectRecord(probe.costGetterFamily, "shard cost method probe costGetterFamily must be an object");
  expectArray(probe.costGetterFamily.rows, "shard cost method probe costGetterFamily.rows must be an array");
  expectArray(probe.helperMethods, "shard cost method probe helperMethods must be an array");
  expectArray(probe.estimatedTrackedBodySizeClusters, "shard cost method probe estimatedTrackedBodySizeClusters must be an array");
  expectArray(probe.findings, "shard cost method probe findings must be an array");
  expectArray(probe.currentBoundary, "shard cost method probe currentBoundary must be an array");

  assert.equal(probe.dataset, "shard-cost-method-probe.v1", "shard cost method probe dataset drifted");
  assert.equal(probe.costGetterFamily.count, 30, "shard cost method probe getter count drifted");
  assert.equal(probe.costGetterFamily.returnType, "BreakInfinity.BigDouble", "shard cost method probe return type drifted");
  assert.equal(probe.costGetterFamily.rows.length, 30, "shard cost method probe row count drifted");
  assert.ok(probe.costGetterFamily.rows.some((entry) => entry?.row === 0 && entry?.name === "get_SU0Cost" && entry?.rva === 38240178), "shard cost method probe row 0 drifted");
  assert.ok(probe.costGetterFamily.rows.some((entry) => entry?.row === 19 && entry?.name === "get_SU19Cost" && entry?.estimatedTrackedBodySize === 3258), "shard cost method probe row 19 drifted");
  assert.ok(probe.costGetterFamily.rows.some((entry) => entry?.row === 27 && entry?.name === "get_SU27Cost" && entry?.estimatedTrackedBodySize === 2693), "shard cost method probe row 27 drifted");
  assert.ok(probe.helperMethods.some((entry) => entry?.name === "UpdateShardCostList" && entry?.rva === 38238055), "shard cost method probe missing UpdateShardCostList");
  assert.ok(probe.helperMethods.some((entry) => entry?.name === "GetShardCostList" && entry?.rva === 38349168), "shard cost method probe missing GetShardCostList");
  assert.ok(probe.helperMethods.some((entry) => entry?.name === "SortCostAndBools" && entry?.rva === 38348434), "shard cost method probe missing SortCostAndBools");
  assert.ok(probe.helperMethods.some((entry) => entry?.name === "CountAffordableShard" && entry?.rva === 38351862), "shard cost method probe missing CountAffordableShard");
  assert.ok(probe.helperMethods.some((entry) => entry?.name === "get_OverLevel100Exponent" && entry?.rva === 38239421), "shard cost method probe missing get_OverLevel100Exponent");
  assert.ok(probe.estimatedTrackedBodySizeClusters.some((entry) => entry?.estimatedTrackedBodySize === 3258 && JSON.stringify(entry?.rows) === JSON.stringify([19, 20, 21])), "shard cost method probe 19-21 cluster drifted");
  assert.ok(probe.estimatedTrackedBodySizeClusters.some((entry) => entry?.estimatedTrackedBodySize === 2693 && JSON.stringify(entry?.rows) === JSON.stringify([27, 28])), "shard cost method probe 27-28 cluster drifted");
  assert.ok(probe.findings.some((line) => String(line).includes("real get_SU0-29Cost runtime family")), "shard cost method probe must preserve the getter-family finding");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("verified runtime getter family")), "shard cost method probe must preserve runtime boundary framing");

  return {
    id: "shard-cost-method-probe",
    label: "Shard cost method probe",
    classification: "extracted-mechanics",
    stats: [
      `${probe.costGetterFamily.count} cost getters`,
      `${probe.helperMethods.length} helper methods`,
      `${probe.estimatedTrackedBodySizeClusters.length} tracked size clusters`
    ]
  };
}

function validateShardCostNativeProbe(probe) {
  expectNonEmptyString(probe.dataset, "shard cost native probe dataset id must be present");
  expectNonEmptyString(probe.generatedAt, "shard cost native probe generatedAt must be present");
  expectRecord(probe.source, "shard cost native probe source must be an object");
  ["methodProbe", "uabeaProbeReport", "libIl2cpp", "vendorManual"].forEach((field) => {
    expectNonEmptyString(probe.source[field], `shard cost native probe source.${field} must be present`);
  });
  expectArray(probe.rows, "shard cost native probe rows must be an array");
  expectArray(probe.earlyCallClusters, "shard cost native probe earlyCallClusters must be an array");
  expectArray(probe.helperTargetSummaries, "shard cost native probe helperTargetSummaries must be an array");
  expectRecord(probe.powerHelperFamily, "shard cost native probe powerHelperFamily must be an object");
  expectArray(probe.overLevelGetterProfiles, "shard cost native probe overLevelGetterProfiles must be an array");
  expectArray(probe.findings, "shard cost native probe findings must be an array");
  expectArray(probe.currentBoundary, "shard cost native probe currentBoundary must be an array");
  expectRecord(probe.spotChecks, "shard cost native probe spotChecks must be an object");

  assert.equal(probe.dataset, "shard-cost-native-probe.v1", "shard cost native probe dataset drifted");
  assert.equal(probe.rows.length, 30, "shard cost native probe row count drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 0 && JSON.stringify(entry?.earlyFieldReads?.slice(3, 8).map((item) => item.offsetHex)) === JSON.stringify(["0x340", "0x348", "0x350", "0x358", "0x360"])), "shard cost native probe row 0 field shell drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 1 && JSON.stringify(entry?.earlyFieldReads?.slice(1, 5).map((item) => item.offsetHex)) === JSON.stringify(["0x3e8", "0x3f0", "0x3f8", "0x400"])), "shard cost native probe row 1 operand bridge drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 1 && JSON.stringify(entry?.operandFieldNames) === JSON.stringify(["SU1StartCost", "SU1CostExponent"])), "shard cost native probe row 1 operand fields drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 1 && JSON.stringify(entry?.costFieldUsage) === JSON.stringify(["SU1StartCost", "SU1CostExponent", "SU1GrowthExponent"])), "shard cost native probe row 1 cost field usage drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 1 && JSON.stringify(entry?.levelGateChecks) === JSON.stringify([200, 100, 300])), "shard cost native probe row 1 level gates drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 1 && entry?.hundredStageStructure?.divideBy100CompilerPattern === true), "shard cost native probe row 1 hundred-stage divide-by-100 drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 1 && entry?.hundredStageStructure?.remainderLane?.powerHelperTarget === "0x24e20d9"), "shard cost native probe row 1 hundred-stage power helper drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 1 && JSON.stringify(entry?.threeHundredStageCostLane?.stageFieldUsage) === JSON.stringify(["SU1CostExponent", "SU1GrowthExponent"])), "shard cost native probe row 1 three-hundred-stage lane drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 19 && JSON.stringify(entry?.earlyFieldReads?.slice(1, 5).map((item) => item.offsetHex)) === JSON.stringify(["0xd58", "0xd60", "0xd68", "0xd70"])), "shard cost native probe row 19 operand bridge drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 19 && JSON.stringify(entry?.operandFieldNames) === JSON.stringify(["SU19StartCost", "SU19CostExponent"])), "shard cost native probe row 19 operand fields drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 19 && JSON.stringify(entry?.costFieldUsage) === JSON.stringify(["SU19StartCost", "SU19CostExponent", "SU19GrowthExponent"])), "shard cost native probe row 19 cost field usage drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 19 && JSON.stringify(entry?.levelGateChecks) === JSON.stringify([200, 100, 300])), "shard cost native probe row 19 level gates drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 19 && entry?.hundredStageStructure?.divideBy100CompilerPattern === true), "shard cost native probe row 19 hundred-stage divide-by-100 drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 19 && JSON.stringify(entry?.threeHundredStageCostLane?.stageFieldUsage) === JSON.stringify(["SU19CostExponent", "SU19GrowthExponent"])), "shard cost native probe row 19 three-hundred-stage lane drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 27 && JSON.stringify(entry?.earlyFieldReads?.slice(1, 5).map((item) => item.offsetHex)) === JSON.stringify(["0x1188", "0x1190", "0x1198", "0x11a0"])), "shard cost native probe row 27 operand bridge drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 27 && JSON.stringify(entry?.operandFieldNames) === JSON.stringify(["SU27StartCost", "SU27CostExponent"])), "shard cost native probe row 27 operand fields drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 27 && JSON.stringify(entry?.costFieldUsage) === JSON.stringify(["SU27StartCost", "SU27CostExponent", "SU27GrowthExponent"])), "shard cost native probe row 27 cost field usage drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 27 && JSON.stringify(entry?.levelGateChecks) === JSON.stringify([200, 100, 300])), "shard cost native probe row 27 level gates drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 27 && entry?.hundredStageStructure?.divideBy100CompilerPattern === true), "shard cost native probe row 27 hundred-stage divide-by-100 drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 27 && JSON.stringify(entry?.threeHundredStageCostLane?.stageFieldUsage) === JSON.stringify(["SU27CostExponent", "SU27GrowthExponent"])), "shard cost native probe row 27 three-hundred-stage lane drifted");
  assert.ok(probe.earlyCallClusters.some((entry) => JSON.stringify(entry?.rows) === JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), "shard cost native probe early cluster for rows 1-12 drifted");
  assert.ok(probe.earlyCallClusters.some((entry) => JSON.stringify(entry?.rows) === JSON.stringify([17])), "shard cost native probe row 17 outlier drifted");
  assert.ok(probe.helperTargetSummaries.some((entry) => entry?.target === "0x24e1a07" && String(entry?.summary).includes("double literal")), "shard cost native probe literal helper summary drifted");
  assert.ok(probe.helperTargetSummaries.some((entry) => entry?.target === "0x24e1d36" && String(entry?.summary).includes("integer input")), "shard cost native probe int helper summary drifted");
  assert.equal(probe.powerHelperFamily?.shardPathEntryTarget, "0x24e20d9", "shard cost native probe power-helper shard path entry drifted");
  assert.deepEqual(probe.powerHelperFamily?.shardPathChain, ["0x24e20d9", "0x24e1a2b", "0x24e1452", "0x24e0faa", "0x24e1ab0"], "shard cost native probe shard-path helper chain drifted");
  assert.deepEqual(probe.powerHelperFamily?.nearbySiblingChain, ["0x24e21dc", "0x24e1bba", "0x24e1c3f", "0x24e1cb3"], "shard cost native probe sibling helper chain drifted");
  assert.equal(probe.genericBigDoubleHelpers?.storedCostFieldsUseBigDoubleSlots, true, "shard cost native probe must preserve BigDouble cost-slot interpretation");
  assert.equal(probe.genericBigDoubleHelpers?.rowCostFieldSlotSizeBytes, 16, "shard cost native probe BigDouble slot size drifted");
  assert.equal(probe.genericBigDoubleHelpers?.multiplyHelperTarget, "0x24e1b33", "shard cost native probe multiply helper drifted");
  assert.equal(probe.genericBigDoubleHelpers?.addHelperTarget, "0x24e176a", "shard cost native probe add helper drifted");
  assert.equal(probe.genericBigDoubleHelpers?.toDoubleTarget, "0x24e0cda", "shard cost native probe to-double helper drifted");
  assert.equal(probe.scalarRemainderSubfamily?.entryTarget, "0x24e3620", "shard cost native probe scalar remainder entry drifted");
  assert.equal(probe.scalarRemainderSubfamily?.integralPartHelperTarget, "0x393469a", "shard cost native probe scalar integral-part helper drifted");
  assert.equal(probe.scalarRemainderSubfamily?.scalarToBigDoubleTarget, "0x24e349c", "shard cost native probe scalar-to-BigDouble helper drifted");
  assert.equal(probe.scalarRemainderSubfamily?.scaledPowerBuilderTarget, "0x24e38f9", "shard cost native probe scalar power-builder helper drifted");
  assert.equal(probe.scalarRemainderSubfamily?.unresolvedTransformTarget, "0x393474a", "shard cost native probe unresolved scalar transform drifted");
  assert.equal(probe.scalarRemainderSubfamily?.resolvedTransformKind, "powWrapper", "shard cost native probe resolved transform kind drifted");
  assert.equal(probe.decimalPowerBridge?.bigDoubleLog10Target, "0x24e30e4", "shard cost native probe BigDouble-to-log10 bridge drifted");
  assert.equal(probe.decimalPowerBridge?.scaledPowerBuilderTarget, "0x24e38f9", "shard cost native probe decimal power-builder drifted");
  assert.equal(probe.decimalPowerBridge?.powWrapperTarget, "0x393474a", "shard cost native probe pow-wrapper target drifted");
  assert.equal(probe.decimalPowerBridge?.mathImports?.modfImportName, "modf", "shard cost native probe modf import drifted");
  assert.equal(probe.decimalPowerBridge?.mathImports?.fmodImportName, "fmod", "shard cost native probe fmod import drifted");
  assert.equal(probe.decimalPowerBridge?.mathImports?.log10ImportName, "log10", "shard cost native probe log10 import drifted");
  assert.equal(probe.decimalPowerBridge?.mathImports?.powImportName, "pow", "shard cost native probe pow import drifted");
  assert.equal(probe.stageAssemblyBoundary?.stageDispatcherEntryTarget, "0x24e3620", "shard cost native probe stage dispatcher entry drifted");
  assert.equal(probe.stageAssemblyBoundary?.stageDispatcherBodyTarget, "0x24e368d", "shard cost native probe stage dispatcher body drifted");
  assert.equal(probe.stageAssemblyBoundary?.scalarCompareTarget, "0x24e2d86", "shard cost native probe scalar compare helper drifted");
  assert.equal(probe.stageAssemblyBoundary?.specialCaseGateTarget, "0x24e387a", "shard cost native probe special-case gate drifted");
  assert.equal(probe.stageAssemblyBoundary?.scalarToBigDoubleTarget, "0x24e349c", "shard cost native probe stage scalar-to-BigDouble lane drifted");
  assert.equal(probe.stageAssemblyBoundary?.decimalPowerBuilderTarget, "0x24e38f9", "shard cost native probe stage decimal power-builder drifted");
  assert.equal(probe.sampledOffsetFeeders?.length, 3, "shard cost native probe sampled offset feeder count drifted");
  assert.ok(probe.sampledOffsetFeeders?.some((entry) => entry?.row === 1 && entry?.thresholdWindow === "100-plus-window" && entry?.levelOffset === 70 && Math.abs(Number(entry?.coefficient) - 9.765628774403013e-05) < 1e-16 && entry?.model === "literalTimesBigDoubleOffsetThenAdd"), "shard cost native probe row 1 sampled offset feeder drifted");
  assert.ok(probe.sampledOffsetFeeders?.some((entry) => entry?.row === 19 && entry?.thresholdWindow === "100-plus-window" && entry?.levelOffset === 70 && Math.abs(Number(entry?.coefficient) - (-0.00011718430323526263)) < 1e-16 && entry?.model === "scalarOffsetTimesCoefficientThenAdd"), "shard cost native probe row 19 sampled offset feeder drifted");
  assert.ok(probe.sampledOffsetFeeders?.some((entry) => entry?.row === 27 && entry?.thresholdWindow === "100-plus-window" && entry?.levelOffset === 82 && Math.abs(Number(entry?.coefficient) - 8192.001984596252) < 1e-9 && entry?.model === "literalTimesBigDoubleOffsetThenAdd"), "shard cost native probe row 27 sampled offset feeder drifted");
  assert.deepEqual(probe.windowOffsetFamilies?.hundredWindowFamilies, [
    { thresholdWindow: "100-plus-window", model: "literalTimesBigDoubleOffsetThenAdd", levelOffset: 70, usesLiteralBuilder: false, usesPreMergeMultiply: true, rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
    { thresholdWindow: "100-plus-window", model: "scalarOffsetTimesCoefficientThenAdd", levelOffset: 70, usesLiteralBuilder: true, usesPreMergeMultiply: false, rows: [19, 20, 21, 22, 23] },
    { thresholdWindow: "100-plus-window", model: "scalarOffsetTimesCoefficientThenAdd", levelOffset: 67, usesLiteralBuilder: true, usesPreMergeMultiply: false, rows: [24, 25, 26] },
    { thresholdWindow: "100-plus-window", model: "literalTimesBigDoubleOffsetThenAdd", levelOffset: 82, usesLiteralBuilder: false, usesPreMergeMultiply: true, rows: [27, 28, 29] },
  ], "shard cost native probe hundred-window family clusters drifted");
  assert.deepEqual(probe.windowOffsetFamilies?.twoHundredWindowFamilies, [
    { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 27, 28, 29] },
    { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [180], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 26, 27, 28, 29] },
  ], "shard cost native probe two-hundred-window family clusters drifted");
  assert.deepEqual(probe.windowOffsetFamilies?.threeHundredWindowFamilies, [
    { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29] },
    { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [49], rows: [24] },
    { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesCurrentLevelBigDouble: true, usesLiteralBuilder: false, integerSeeds: [19], rows: [25] },
  ], "shard cost native probe three-hundred-window family clusters drifted");
  assert.deepEqual(probe.stageWindowProfiles, [
    {
      rows: [0],
      familySignature: [
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [] },
      ],
    },
    {
      rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 27, 28, 29],
      familySignature: [
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
        { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [180] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      ],
    },
    {
      rows: [18],
      familySignature: [
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
        { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [99] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      ],
    },
    {
      rows: [19, 20, 21, 22, 23],
      familySignature: [
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
        { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [180] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: true, integerSeeds: [] },
        { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
      ],
    },
    {
      rows: [24],
      familySignature: [
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
        { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [49] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: true, integerSeeds: [] },
        { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: true, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: true, integerSeeds: [] },
      ],
    },
    {
      rows: [25],
      familySignature: [
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
        { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [19] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: true, integerSeeds: [] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: true, integerSeeds: [] },
      ],
    },
    {
      rows: [26],
      familySignature: [
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [100] },
        { thresholdWindow: "300-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: false, integerSeeds: [] },
        { thresholdWindow: "200-plus-window", usesUnaryThresholdTransform: true, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: false, integerSeeds: [180] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: true, usesLiteralBuilder: true, integerSeeds: [] },
        { thresholdWindow: "100-plus-window", usesUnaryThresholdTransform: false, usesPreMergeMultiply: false, usesPreMergeAdd: false, usesLiteralBuilder: true, integerSeeds: [] },
      ],
    },
  ], "shard cost native probe stage-window profile map drifted");
  assert.deepEqual(probe.stageProfileCorrelations, [
    { rows: [0], unlockRequirementRange: [0, 0], distinctRarities: ["Unique"], distinctStartCosts: [5], distinctCostExponents: [1.3], distinctGrowthExponents: [1.5] },
    { rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 27, 28, 29], unlockRequirementRange: [0, 8100], distinctRarities: ["Epic", "Rare", "common"], distinctStartCosts: [1.4, 2, 2.4, 3.1, 3.6, 4, 5.6, 6, 8, 9, 9.99], distinctCostExponents: [1.15, 1.22, 1.24, 1.26, 1.4, 1.48, 1.5, 1.6, 1.78, 2, 2.25, 2.29, 2.3, 3, 4], distinctGrowthExponents: [1.2, 1.3, 1.6, 1.8, 2, 2.2, 2.5, 2.6, 2.8, 3.2, 3.4, 3.8, 4, 5, 8] },
    { rows: [18], unlockRequirementRange: [1100, 1100], distinctRarities: ["Legendary"], distinctStartCosts: [1.5], distinctCostExponents: [1], distinctGrowthExponents: [5] },
    { rows: [19, 20, 21, 22, 23], unlockRequirementRange: [1400, 1800], distinctRarities: ["Epic", "Rare", "common"], distinctStartCosts: [1], distinctCostExponents: [1, 2.5, 5], distinctGrowthExponents: [1, 3, 4] },
    { rows: [24], unlockRequirementRange: [3300, 3300], distinctRarities: ["Rare"], distinctStartCosts: [4], distinctCostExponents: [5], distinctGrowthExponents: [5] },
    { rows: [25], unlockRequirementRange: [3600, 3600], distinctRarities: ["Low Pristine"], distinctStartCosts: [3], distinctCostExponents: [2], distinctGrowthExponents: [2] },
    { rows: [26], unlockRequirementRange: [3900, 3900], distinctRarities: ["Mid Pristine"], distinctStartCosts: [5], distinctCostExponents: [2], distinctGrowthExponents: [6] },
  ], "shard cost native probe stage-profile correlation map drifted");
  assert.deepEqual(probe.transitionRowAnalysis?.transitionRows?.map((entry) => ({ row: entry?.row, betweenRows: entry?.betweenRows })), [
    { row: 18, betweenRows: [17, 19] },
    { row: 24, betweenRows: [23, 27] },
    { row: 25, betweenRows: [24, 26] },
    { row: 26, betweenRows: [25, 27] },
  ], "shard cost native probe transition-row anchors drifted");
  assert.ok(probe.transitionRowAnalysis?.transitionRows?.some((entry) => entry?.row === 18 && entry?.neighborContrast?.some((line) => String(line).includes("second 100-plus unary feeder"))), "shard cost native probe row 18 transition contrast drifted");
  assert.ok(probe.transitionRowAnalysis?.transitionRows?.some((entry) => entry?.row === 24 && entry?.neighborContrast?.some((line) => String(line).includes("300-plus unary feeder with integer seed 49"))), "shard cost native probe row 24 transition contrast drifted");
  assert.ok(probe.transitionRowAnalysis?.transitionRows?.some((entry) => entry?.row === 25 && entry?.neighborContrast?.some((line) => String(line).includes("seed 19"))), "shard cost native probe row 25 transition contrast drifted");
  assert.ok(probe.transitionRowAnalysis?.transitionRows?.some((entry) => entry?.row === 26 && entry?.neighborContrast?.some((line) => String(line).includes("seed 180"))), "shard cost native probe row 26 transition contrast drifted");
  assert.deepEqual(probe.transitionRowAnalysis?.row0SpecialCase?.costFieldUsage, ["SU0StartCost", "SU0CostExponent", "SU0GrowthExponent", "SU0GrowthExponent2", "SU0GrowthExponent3"], "shard cost native probe row 0 cost-field shell drifted");
  assert.deepEqual(probe.transitionRowAnalysis?.row0SpecialCase?.levelGateChecks, [100], "shard cost native probe row 0 level-gate shell drifted");
  assert.equal(probe.transitionRowAnalysis?.row0SpecialCase?.thresholdStages?.length, 0, "shard cost native probe row 0 threshold-stage shell drifted");
  assert.ok(probe.transitionRowAnalysis?.row0SpecialCase?.facts?.some((line) => String(line).includes("five serialized cost fields")), "shard cost native probe row 0 special-case fact drifted");
  assert.deepEqual(probe.thresholdStageClasses, [
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21] },
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"], rows: [17, 22, 23] },
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent"], rows: [18, 24, 27, 28, 29] },
    { getterNames: ["get_OverLevel100Exponent"], rows: [25, 26] },
  ], "shard cost native probe threshold-stage classes drifted");
  assert.deepEqual(probe.representativeClassAnalysis?.map((entry) => ({
    getterNames: entry?.getterNames,
    rows: entry?.rows,
    representativeRows: entry?.representatives?.map((rep) => rep?.row),
  })), [
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21], representativeRows: [1, 21] },
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"], rows: [17, 22, 23], representativeRows: [17, 23] },
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent"], rows: [18, 24, 27, 28, 29], representativeRows: [18, 29] },
    { getterNames: ["get_OverLevel100Exponent"], rows: [25, 26], representativeRows: [25, 26] },
  ], "shard cost native probe representative class analysis drifted");
  assert.ok(probe.representativeClassAnalysis?.some((entry) => JSON.stringify(entry?.getterNames) === JSON.stringify(["get_OverLevel100Exponent", "get_OverLevel200Exponent"]) && entry?.representatives?.some((rep) => rep?.row === 29 && rep?.hundredStageStructure?.divideBy100CompilerPattern === true)), "shard cost native probe representative hundred-stage structure drifted");
  assert.deepEqual(probe.normalRowStageRecipe?.classRecipes?.map((entry) => ({ getterNames: entry?.getterNames, rows: entry?.rows })), [
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21] },
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"], rows: [17, 22, 23] },
    { getterNames: ["get_OverLevel100Exponent", "get_OverLevel200Exponent"], rows: [18, 24, 27, 28, 29] },
    { getterNames: ["get_OverLevel100Exponent"], rows: [25, 26] },
  ], "shard cost native probe normal-row stage recipe drifted");
  assert.ok(probe.normalRowStageRecipe?.sharedScaffolding?.facts?.some((line) => String(line).includes("same hundred-stage structure")), "shard cost native probe shared stage scaffolding drifted");
  assert.deepEqual(probe.canonicalSymbolicAssembler?.canonicalClass?.getterNames, ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], "shard cost native probe canonical symbolic assembler getter coverage drifted");
  assert.deepEqual(probe.canonicalSymbolicAssembler?.canonicalClass?.rows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21], "shard cost native probe canonical symbolic assembler rows drifted");
  assert.deepEqual(probe.canonicalSymbolicAssembler?.canonicalClass?.symbolicStages?.map((entry) => entry?.name), ["base-row-fields", "hundred-stage", "two-hundred-stage", "three-hundred-stage", "four-hundred-stage"], "shard cost native probe canonical symbolic assembler stages drifted");
  assert.deepEqual(probe.canonicalSymbolicAssembler?.canonicalClass?.subprofiles?.map((entry) => entry?.rows), [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], [19, 20, 21]], "shard cost native probe canonical symbolic assembler subprofiles drifted");
  assert.ok(probe.canonicalSymbolicAssembler?.classDeltas?.some((entry) => JSON.stringify(entry?.getterNames) === JSON.stringify(["get_OverLevel100Exponent"]) && entry?.delta?.some((line) => String(line).includes("0x24e1ab0"))), "shard cost native probe canonical symbolic assembler short-class delta drifted");
  assert.deepEqual(probe.canonicalMergeConstraints?.secondaryHundredPlusSplit?.map((entry) => ({ rows: entry?.rows, path: entry?.path })), [
    { rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], path: "additivePremerge" },
    { rows: [19, 20, 21], path: "literalBuilderAdditive" },
  ], "shard cost native probe canonical merge constraints drifted");
  assert.ok(probe.canonicalMergeConstraints?.sharedConstraints?.some((line) => String(line).includes("first 200-plus feeder is stable")), "shard cost native probe canonical merge shared constraint drifted");
  assert.equal(probe.formulaApplicationProfiles?.rowZero?.formulaClass, "row0-special-case", "shard cost native probe row-zero formula profile drifted");
  assert.deepEqual(probe.formulaApplicationProfiles?.normalRows?.map((entry) => ({ rows: entry?.rows, formulaClass: entry?.formulaClass })), [
    { rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], formulaClass: "canonical-additive-premerge" },
    { rows: [19, 20, 21], formulaClass: "canonical-literal-builder" },
    { rows: [17, 22, 23], formulaClass: "drop-400-stage" },
    { rows: [18, 24, 27, 28, 29], formulaClass: "two-stage-transition-band" },
    { rows: [25, 26], formulaClass: "hundred-stage-short-class" },
  ], "shard cost native probe formula application profiles drifted");
  assert.deepEqual(probe.preThresholdMergeModels?.normalProfile?.rows, [9, 25], "shard cost native probe pre-threshold sample rows drifted");
  assert.ok(String(probe.preThresholdMergeModels?.normalProfile?.symbolicApproximation).includes("multiply(StartCost, dispatch(currentLevel, add(CostExponent, multiply(currentLevelBigDouble, GrowthExponent))))"), "shard cost native probe pre-threshold symbolic approximation drifted");
  assert.ok(probe.preThresholdMergeModels?.sharedNormalPath?.some((line) => String(line).includes("owner-flag-zero pre-threshold structure")), "shard cost native probe pre-threshold shared-path framing drifted");
  assert.ok(probe.preThresholdMergeModels?.alternateFlaggedBranchSamples?.some((entry) => entry?.row === 25 && String(entry?.seedBuilder).includes("integer seed 4")), "shard cost native probe pre-threshold alternate branch drifted");
  assert.equal(probe.dispatcherCompareModel?.compareTarget, "0x24e2d86", "shard cost native probe dispatcher compare target drifted");
  assert.ok(probe.dispatcherCompareModel?.facts?.some((line) => String(line).includes("converted BigDouble lane is greater than the original scalar lane")), "shard cost native probe dispatcher compare semantics drifted");
  assert.equal(probe.dispatcherAlignmentModel?.alignmentCheckTarget, "0x24e3597", "shard cost native probe dispatcher alignment target drifted");
  assert.equal(Number(probe.dispatcherAlignmentModel?.toleranceLiteral), 5.238690707360522e-11, "shard cost native probe dispatcher alignment tolerance drifted");
  assert.ok(probe.dispatcherAlignmentModel?.currentInference?.some((line) => String(line).includes("tiny fmod-style alignment gate")), "shard cost native probe dispatcher alignment inference drifted");
  assert.ok(probe.dispatcherSelectionModel?.facts?.some((line) => String(line).includes("selector register equals 1")), "shard cost native probe dispatcher selection gate drifted");
  assert.ok(probe.dispatcherSelectionModel?.sampledNormalRows?.some((entry) => JSON.stringify(entry?.rows) === JSON.stringify([1, 9, 27, 29]) && JSON.stringify(entry?.sampledSelectorValues) === JSON.stringify([0])), "shard cost native probe dispatcher sampled zero-selector rows drifted");
  assert.ok(probe.dispatcherSelectionModel?.sampledNormalRows?.some((entry) => JSON.stringify(entry?.rows) === JSON.stringify([25]) && JSON.stringify(entry?.sampledSelectorValues) === JSON.stringify([4])), "shard cost native probe dispatcher sampled short-class selector drifted");
  assert.ok(probe.findings?.some((line) => String(line).includes("exact serialized OverLevel*Base payload values remain unresolved")), "shard cost native probe over-level base unresolved finding drifted");
  assert.ok(probe.currentBoundary?.some((line) => String(line).includes("OverLevel100/200/300/400Base metadata names as unresolved typed field clues")), "shard cost native probe over-level base boundary drifted");
  assert.ok(probe.overLevelSeedModels?.sampledGetters?.some((entry) => entry?.getterName === "get_OverLevel100Exponent" && entry?.baseSeed === 2), "shard cost native probe over-level 100 seed drifted");
  assert.ok(probe.overLevelSeedModels?.sampledGetters?.some((entry) => entry?.getterName === "get_OverLevel200Exponent" && Number(entry?.baseSeed) === 0), "shard cost native probe over-level 200 seed drifted");
  assert.ok(probe.overLevelSeedModels?.sampledGetters?.some((entry) => entry?.getterName === "get_OverLevel300Exponent" && Number(entry?.baseSeed) === 0), "shard cost native probe over-level 300 seed drifted");
  assert.ok(probe.overLevelSeedModels?.sampledGetters?.some((entry) => entry?.getterName === "get_OverLevel100Exponent" && Number(entry?.optionalMmoMergeFloatValue) === 1.264570970563716e-39), "shard cost native probe over-level 100 merge float drifted");
  assert.ok(probe.overLevelSeedModels?.sampledGetters?.some((entry) => entry?.getterName === "get_OverLevel200Exponent" && Number(entry?.optionalMmoMergeFloatValue) === 6.345649113524877e-36), "shard cost native probe over-level 200 merge float drifted");
  assert.ok(probe.overLevelSeedModels?.sampledGetters?.some((entry) => entry?.getterName === "get_OverLevel400Exponent" && Number(entry?.baseSeed) === 0.007812501846152979), "shard cost native probe over-level 400 seed drifted");
  assert.ok(probe.overLevelSeedModels?.currentInference?.some((line) => String(line).includes("100 starts from integer seed 2")), "shard cost native probe over-level seed inference drifted");
  assert.deepEqual(probe.secondaryHundredPlusMergeModels?.profiles?.map((entry) => ({ rows: entry?.rows, profile: entry?.profile })), [
    { rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 27, 28, 29], profile: "additive-premerge" },
    { rows: [19, 20, 21], profile: "literal-builder-additive" },
  ], "shard cost native probe secondary hundred-plus merge models drifted");
  assert.ok(probe.secondaryHundredPlusMergeModels?.sharedFrame?.some((line) => String(line).includes("post-200, pre-300 branch")), "shard cost native probe secondary hundred-plus branch framing drifted");
  assert.ok(probe.secondaryHundredPlusMergeModels?.profiles?.some((entry) => entry?.profile === "additive-premerge" && String(entry?.symbolicApproximation).includes("multiply(levelOffsetBigDouble, preservedScalarLane)")), "shard cost native probe additive-premerge symbolic approximation drifted");
  assert.ok(probe.secondaryHundredPlusMergeModels?.profiles?.some((entry) => entry?.profile === "additive-premerge" && String(entry?.laneSources?.baseLane).includes("OverLevel200Base")), "shard cost native probe additive-premerge base-lane source drifted");
  assert.ok(probe.secondaryHundredPlusMergeModels?.profiles?.some((entry) => entry?.profile === "additive-premerge" && String(entry?.laneSources?.stageLane).includes("get_OverLevel200Exponent")), "shard cost native probe additive-premerge stage-lane helper drifted");
  assert.ok(probe.secondaryHundredPlusMergeModels?.profiles?.some((entry) => entry?.profile === "literal-builder-additive" && entry?.preDispatchAssembly?.some((line) => String(line).includes("0x24e1a07"))), "shard cost native probe literal-builder merge model drifted");
  assert.ok(probe.secondaryHundredPlusMergeModels?.profiles?.some((entry) => entry?.profile === "literal-builder-additive" && String(entry?.symbolicApproximation).includes("literalBigDouble((level - offset) * coefficient)")), "shard cost native probe literal-builder symbolic approximation drifted");
  assert.ok(probe.secondaryHundredPlusMergeModels?.profiles?.some((entry) => entry?.profile === "literal-builder-additive" && String(entry?.laneSources?.stageLane).includes("get_OverLevel200Exponent")), "shard cost native probe literal-builder stage-lane source drifted");
  const row1 = probe.rows?.find((entry) => entry?.row === 1);
  const row19 = probe.rows?.find((entry) => entry?.row === 19);
  const row27 = probe.rows?.find((entry) => entry?.row === 27);
  assert.ok(row1?.stageDispatchCallFamilies?.some((family) => family?.usesPreMergeAdd === true && family?.usesCurrentLevelBigDouble === true && family?.postDispatchMergeTarget === "0x24e1cb3"), "shard cost native probe row 1 must preserve opening additive dispatcher feeder");
  assert.ok(row1?.stageDispatchCallFamilies?.some((family) => family?.usesUnaryThresholdTransform === true && JSON.stringify(family?.integerSeeds) === JSON.stringify([100]) && family?.thresholdWindow === "100-plus-window" && family?.postDispatchMergeTarget === "0x24e1cb3"), "shard cost native probe row 1 must preserve 100-seed dispatcher feeder");
  assert.ok(row1?.stageDispatchCallFamilies?.some((family) => family?.usesUnaryThresholdTransform === true && JSON.stringify(family?.integerSeeds) === JSON.stringify([180]) && family?.thresholdWindow === "200-plus-window" && family?.postDispatchMergeTarget === "0x24e1cb3"), "shard cost native probe row 1 must preserve 180-seed dispatcher feeder");
  assert.ok(row1?.stageDispatchCallFamilies?.some((family) => family?.thresholdWindow === "300-plus-window" && family?.usesPreMergeAdd === true && family?.usesUnaryThresholdTransform === false), "shard cost native probe row 1 must preserve plain 300-plus dispatcher feeder");
  assert.ok(row19?.stageDispatchCallFamilies?.some((family) => family?.usesLiteralBuilder === true && family?.usesPreMergeAdd === true && family?.thresholdWindow === "100-plus-window" && family?.postDispatchMergeTarget === "0x24e1cb3"), "shard cost native probe row 19 must preserve literal-seeded dispatcher feeder");
  assert.ok(row27?.stageDispatchCallFamilies?.some((family) => family?.usesPreMergeMultiply === true && family?.usesPreMergeAdd === true && family?.thresholdWindow === "100-plus-window" && family?.postDispatchMergeTarget === "0x24e1cb3"), "shard cost native probe row 27 must preserve stacked additive-premerge feeder");
  assert.ok(probe.overLevelGetterProfiles.some((entry) => entry?.getterName === "get_OverLevel100Exponent" && entry?.initialBuilderTarget === "0x24e1d36" && entry?.initialIntegerSeed === 2), "shard cost native probe OverLevel100 getter profile drifted");
  assert.ok(probe.overLevelGetterProfiles.some((entry) => entry?.getterName === "get_OverLevel400Exponent" && entry?.fallsIntoExtendedShardLane === true), "shard cost native probe OverLevel400 getter profile drifted");
  assert.ok(probe.findings.some((line) => String(line).includes("row-local ShardMining cost operands")), "shard cost native probe must preserve operand finding");
  assert.ok(probe.findings.some((line) => String(line).includes("stored as checked 16-byte BreakInfinity.BigDouble slots")), "shard cost native probe must preserve BigDouble slot finding");
  assert.ok(probe.findings.some((line) => String(line).includes("named ShardMining cost fields")), "shard cost native probe must preserve named field finding");
  assert.ok(probe.findings.some((line) => String(line).includes("touch GrowthExponent later")), "shard cost native probe must preserve growth exponent finding");
  assert.ok(probe.findings.some((line) => String(line).includes("compare gates inside get_SU*Cost")), "shard cost native probe must preserve compare-gate finding");
  assert.ok(probe.findings.some((line) => String(line).includes("divide-by-100 integer lane")), "shard cost native probe must preserve hundred-stage divide finding");
  assert.ok(probe.findings.some((line) => String(line).includes("CostExponent and GrowthExponent neighborhood")), "shard cost native probe must preserve three-hundred-stage lane finding");
  assert.ok(probe.findings.some((line) => String(line).includes("checked unary helper chain")), "shard cost native probe must preserve unary helper-chain finding");
  assert.ok(probe.findings.some((line) => String(line).includes("nearby sibling helper lane")), "shard cost native probe must preserve sibling helper-lane finding");
  assert.ok(probe.findings.some((line) => String(line).includes("0x24e3620 converts a BigDouble pair into a double before dispatching into the remaining scalar remainder subfamily")), "shard cost native probe must preserve scalar remainder finding");
  assert.ok(probe.findings.some((line) => String(line).includes("0x393469a now resolves to a modf wrapper")), "shard cost native probe must preserve modf-wrapper finding");
  assert.ok(probe.findings.some((line) => String(line).includes("0x24e38f9 now preserves a checked decimal power-builder")), "shard cost native probe must preserve decimal power-builder finding");
  assert.ok(probe.findings.some((line) => String(line).includes("0x24e349c now preserves a checked scalar-to-BigDouble fallback")), "shard cost native probe must preserve scalar-to-BigDouble fallback finding");
  assert.ok(probe.findings.some((line) => String(line).includes("0x393474a is no longer just a pow-like candidate")), "shard cost native probe must preserve pow-wrapper finding");
  assert.ok(probe.findings.some((line) => String(line).includes("checked BigDouble-to-log10 bridge")), "shard cost native probe must preserve BigDouble log10 bridge finding");
  assert.ok(probe.findings.some((line) => String(line).includes("checked stage dispatcher")), "shard cost native probe must preserve stage-dispatcher finding");
  assert.ok(probe.findings.some((line) => String(line).includes("first 100-plus unary threshold feeder")), "shard cost native probe must preserve 100-plus dispatcher finding");
  assert.ok(probe.findings.some((line) => String(line).includes("later 200-plus unary threshold feeder")), "shard cost native probe must preserve 200-plus dispatcher finding");
  assert.ok(probe.findings.some((line) => String(line).includes("300-plus window also preserves a plain additive dispatcher feeder")), "shard cost native probe must preserve 300-plus dispatcher finding");
  assert.ok(probe.findings.some((line) => String(line).includes("literal-seeded dispatcher feeder inside a 100-plus window")), "shard cost native probe must preserve row-19 dispatcher outlier finding");
  assert.ok(probe.findings.some((line) => String(line).includes("Sampled late-window feeder parameters are now preserved directly from the binary")), "shard cost native probe must preserve sampled feeder-parameter finding");
  assert.ok(probe.findings.some((line) => String(line).includes("clusters sampled rows into reusable late-window families")), "shard cost native probe must preserve hundred-window family finding");
  assert.ok(probe.findings.some((line) => String(line).includes("later stage windows now also preserve reusable row-family maps")), "shard cost native probe must preserve later-window family finding");
  assert.ok(probe.findings.some((line) => String(line).includes("cross-window profile map")), "shard cost native probe must preserve cross-window profile finding");
  assert.ok(probe.findings.some((line) => String(line).includes("do not collapse cleanly onto one rarity band")), "shard cost native probe must preserve stage-profile correlation finding");
  assert.ok(probe.findings.some((line) => String(line).includes("transition rows now preserve concrete neighbor contrasts")), "shard cost native probe must preserve transition-row finding");
  assert.ok(probe.findings.some((line) => String(line).includes("Row 0 is no longer just a weaker version")), "shard cost native probe must preserve row-0 special-case finding");
  assert.ok(probe.findings.some((line) => String(line).includes("split cleanly by preserved over-level getter coverage")), "shard cost native probe must preserve threshold-stage class finding");
  assert.ok(probe.findings.some((line) => String(line).includes("Representative rows from each normal-row coverage class")), "shard cost native probe must preserve representative-class finding");
  assert.ok(probe.findings.some((line) => String(line).includes("shared stage scaffold with class-specific stage coverage")), "shard cost native probe must preserve normal-row recipe finding");
  assert.ok(probe.findings.some((line) => String(line).includes("canonical symbolic stage assembler")), "shard cost native probe must preserve symbolic-assembler finding");
  assert.ok(probe.findings.some((line) => String(line).includes("secondary 100-plus feeder")), "shard cost native probe must preserve canonical subprofile finding");
  assert.ok(probe.findings.some((line) => String(line).includes("narrowest remaining merge breakpoint")), "shard cost native probe must preserve canonical merge finding");
  assert.ok(probe.rows.some((entry) => entry?.row === 1 && JSON.stringify(entry?.thresholdStages?.map((stage) => stage.getterName)) === JSON.stringify(["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"])), "shard cost native probe row 1 threshold stages drifted");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("row-local ShardMining operands")), "shard cost native probe must preserve current boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("serialized BreakInfinity.BigDouble pairs")), "shard cost native probe must preserve BigDouble-pair boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("level 100, 200, and 300 compare gates")), "shard cost native probe must preserve compare-gate boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("divide-by-100 loop")), "shard cost native probe must preserve staged-structure boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("shard-path unary transform entry")), "shard cost native probe must preserve helper-family boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("0x24e30e4 as the checked BigDouble-to-log10 bridge")), "shard cost native probe must preserve BigDouble log10 boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("0x24e3620 and 0x24e368d as the checked stage dispatcher")), "shard cost native probe must preserve stage-dispatcher boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("pre-threshold, 100-plus, 200-plus, and 300-plus windows")), "shard cost native probe must preserve stage-window boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("sampled `(level - offset)` feeder parameters")), "shard cost native probe must preserve sampled feeder boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("100-plus feeder row clusters")), "shard cost native probe must preserve hundred-window family boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("new 200-plus and 300-plus family maps")), "shard cost native probe must preserve later-window family boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("new cross-window stage profiles")), "shard cost native probe must preserve cross-window profile boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("row-family switch inside get_SU*Cost")), "shard cost native probe must preserve stage-profile correlation boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("Treat row 0 as a separate shard cost lane")), "shard cost native probe must preserve row-0 special-case boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("preserved over-level getter coverage classes")), "shard cost native probe must preserve threshold-stage class boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("one representative row per coverage class")), "shard cost native probe must preserve representative-class boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("class recipe boundary")), "shard cost native probe must preserve normal-row recipe boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("canonical symbolic assembler")), "shard cost native probe must preserve symbolic-assembler boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("secondary 100-plus feeder split inside the canonical class")), "shard cost native probe must preserve canonical subprofile boundary framing");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("sampled 300-plus feeder and both sampled 200-plus feeders as shared canonical-class structure")), "shard cost native probe must preserve canonical merge boundary framing");

  return {
    id: "shard-cost-native-probe",
    label: "Shard cost native probe",
    classification: "extracted-mechanics",
    stats: [
      `${probe.rows.length} native getter rows`,
      `${probe.earlyCallClusters.length} early call clusters`,
      "Getter entry operands stay tied to row-local shard fields"
    ]
  };
}

function validateShardCostScreenshotCalibration(probe) {
  expectNonEmptyString(probe.dataset, "shard cost screenshot calibration dataset id must be present");
  expectNonEmptyString(probe.generatedAt, "shard cost screenshot calibration generatedAt must be present");
  expectRecord(probe.source, "shard cost screenshot calibration source must be an object");
  expectArray(probe.entries, "shard cost screenshot calibration entries must be an array");
  expectArray(probe.findings, "shard cost screenshot calibration findings must be an array");
  expectArray(probe.currentBoundary, "shard cost screenshot calibration currentBoundary must be an array");

  assert.equal(probe.dataset, "shard-cost-screenshot-calibration.v1", "shard cost screenshot calibration dataset drifted");
  assert.equal(probe.entries.length, 5, "shard cost screenshot calibration row count drifted");
  assert.ok(probe.entries.some((entry) => Number(entry.row) === 1 && Number(entry.observedLevel) === 283 && String(entry.observedCostLabel) === "1.89e565"), "shard cost screenshot calibration row 1 checkpoint drifted");
  assert.ok(probe.entries.some((entry) => Number(entry.row) === 21 && Number(entry.observedLevel) === 126 && String(entry.observedCostLabel) === "1.20e565"), "shard cost screenshot calibration row 21 checkpoint drifted");
  assert.ok(probe.findings.some((line) => String(line).includes("e563-e565")), "shard cost screenshot calibration must preserve magnitude finding");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("player")), "shard cost screenshot calibration must preserve screenshot-source framing");

  return {
    id: "shard-cost-screenshot-calibration",
    label: "Shard cost screenshot calibration",
    classification: "extracted-mechanics",
    stats: [
      `${probe.entries.length} in-game cost checkpoints`,
      "Rows 1, 9, 14, 21, and 25",
      "Screenshot costs now anchor shard formula calibration"
    ]
  };
}

function validateShardCostListPathProbe(probe) {
  expectNonEmptyString(probe.dataset, "shard cost list-path probe dataset id must be present");
  expectNonEmptyString(probe.generatedAt, "shard cost list-path probe generatedAt must be present");
  expectRecord(probe.source, "shard cost list-path probe source must be an object");
  ["methodProbe", "uabeaProbeReport", "libIl2cpp"].forEach((field) => {
    expectNonEmptyString(probe.source[field], `shard cost list-path probe source.${field} must be present`);
  });
  expectRecord(probe.ownerFields, "shard cost list-path probe ownerFields must be an object");
  expectArray(probe.findings, "shard cost list-path probe findings must be an array");
  expectArray(probe.callOrder, "shard cost list-path probe callOrder must be an array");
  expectArray(probe.currentBoundary, "shard cost list-path probe currentBoundary must be an array");

  assert.equal(probe.dataset, "shard-cost-list-path-probe.v1", "shard cost list-path probe dataset drifted");
  assert.equal(probe.ownerFields.milestoneCostListField?.name, "MilestoneCostList", "shard cost list-path probe MilestoneCostList field drifted");
  assert.equal(Number(probe.ownerFields.milestoneCostListField?.fieldOffset), 5160, "shard cost list-path probe MilestoneCostList offset drifted");
  assert.equal(probe.callOrder[0], "GetShardCostList", "shard cost list-path probe call order must start at GetShardCostList");
  assert.equal(probe.callOrder[1], "get_SU0Cost", "shard cost list-path probe must preserve get_SU0Cost as first appended getter");
  assert.equal(probe.callOrder.at(-1), "get_SU29Cost", "shard cost list-path probe must preserve get_SU29Cost as final appended getter");
  assert.ok(probe.findings.some((line) => String(line).includes("same getter outputs")), "shard cost list-path probe must preserve cache-builder finding");
  assert.ok(probe.findings.some((line) => String(line).includes("affordability")), "shard cost list-path probe must preserve affordability finding");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("cache builder")), "shard cost list-path probe must preserve blocked-use framing");

  return {
    id: "shard-cost-list-path-probe",
    label: "Shard cost list-path probe",
    classification: "extracted-mechanics",
    stats: [
      `${probe.callOrder.length - 1} appended row getters`,
      "MilestoneCostList caches the per-row getter family",
      "No alternate list-builder formula path found"
    ]
  };
}

function validateShardCostFormulaModel(model) {
  expectNonEmptyString(model.dataset, "shard cost formula model dataset id must be present");
  expectNonEmptyString(model.generatedAt, "shard cost formula model generatedAt must be present");
  expectRecord(model.sources, "shard cost formula model sources must be an object");
  ["costModelBoundary", "parameterProbe", "methodProbe", "nativeProbe", "screenshotCalibration", "listPathProbe"].forEach((field) => {
    expectNonEmptyString(model.sources[field], `shard cost formula model sources.${field} must be present`);
  });
  expectNonEmptyString(model.modelIntent, "shard cost formula model modelIntent must be present");
  expectRecord(model.completionFlags, "shard cost formula model completionFlags must be an object");
  expectRecord(model.implementation, "shard cost formula model implementation must be an object");
  expectRecord(model.calibrationCheckConfig, "shard cost formula model calibrationCheckConfig must be an object");
  expectRecord(model.runtimeGetterRules, "shard cost formula model runtimeGetterRules must be an object");
  expectArray(model.rowClasses, "shard cost formula model rowClasses must be an array");
  expectRecord(model.stageRules, "shard cost formula model stageRules must be an object");
  expectRecord(model.verifiedParameters, "shard cost formula model verifiedParameters must be an object");
  expectRecord(model.derivedParameters, "shard cost formula model derivedParameters must be an object");
  expectArray(model.calibrationAnchors, "shard cost formula model calibrationAnchors must be an array");
  expectArray(model.provenanceNotes, "shard cost formula model provenanceNotes must be an array");
  expectRecord(model.boundedUncertaintyFlags, "shard cost formula model boundedUncertaintyFlags must be an object");
  expectArray(model.blockedUses, "shard cost formula model blockedUses must be an array");
  expectArray(model.currentBoundary, "shard cost formula model currentBoundary must be an array");

  assert.equal(model.dataset, "shard-cost-formula-model.v1", "shard cost formula model dataset drifted");
  assert.equal(model.completionFlags.canonicalDatasetShipped, true, "shard cost formula model must stay shipped");
  assert.equal(model.completionFlags.deterministicEvaluatorImplemented, true, "shard cost formula model must preserve the deterministic evaluator flag");
  assert.equal(model.completionFlags.automatedCalibrationImplemented, false, "shard cost formula model must not claim automated calibration");
  assert.equal(model.completionFlags.plannerSafeCostOutputApproved, false, "shard cost formula model must keep planner-safe cost output blocked");
  assert.equal(model.implementation.module, "scripts/shards/cost-evaluator.mjs", "shard cost formula model implementation module drifted");
  assert.equal(model.implementation.outputKind, "normalized-bigdouble-like", "shard cost formula model implementation outputKind drifted");
  assert.equal(model.implementation.deterministic, true, "shard cost formula model implementation must stay deterministic");
  assert.equal(model.calibrationCheckConfig.scientificLabelMantissaDecimals, 2, "shard cost formula model calibration mantissa decimals drifted");
  assert.equal(model.calibrationCheckConfig.requiredExponentDelta, 0, "shard cost formula model calibration requiredExponentDelta drifted");
  assert.equal(model.calibrationCheckConfig.mantissaAbsoluteTolerance, 0.005, "shard cost formula model calibration mantissaAbsoluteTolerance drifted");
  assert.equal(model.calibrationCheckConfig.mantissaRelativeTolerance, 0.005, "shard cost formula model calibration mantissaRelativeTolerance drifted");
  assert.equal(model.runtimeGetterRules.getterFamily.ownerType, "ShardMining", "shard cost formula model getter ownerType drifted");
  assert.equal(model.runtimeGetterRules.getterFamily.returnType, "BreakInfinity.BigDouble", "shard cost formula model getter returnType drifted");
  assert.equal(model.runtimeGetterRules.getterFamily.getterNamePattern, "get_SU{row}Cost", "shard cost formula model getterNamePattern drifted");
  assert.deepEqual(model.runtimeGetterRules.getterFamily.rows, Array.from({ length: 30 }, (_, index) => index), "shard cost formula model getter-family rows drifted");
  assert.equal(model.runtimeGetterRules.getterFamily.stableCallOrder[0], "GetShardCostList", "shard cost formula model stableCallOrder start drifted");
  assert.equal(model.runtimeGetterRules.getterFamily.stableCallOrder[1], "get_SU0Cost", "shard cost formula model stableCallOrder getter start drifted");
  assert.equal(model.runtimeGetterRules.getterFamily.stableCallOrder.at(-1), "get_SU29Cost", "shard cost formula model stableCallOrder end drifted");
  assert.ok(model.runtimeGetterRules.getterFamily.bodySizeClusterRules.some((entry) => entry.estimatedTrackedBodySize === 3258 && JSON.stringify(entry.rows) === JSON.stringify([19, 20, 21])), "shard cost formula model getter body-size cluster drifted");
  assert.equal(model.runtimeGetterRules.cacheLifecycle.refreshMethod, "UpdateShardCostList", "shard cost formula model cache refreshMethod drifted");
  assert.equal(model.runtimeGetterRules.cacheLifecycle.listBuilderMethod, "GetShardCostList", "shard cost formula model cache listBuilderMethod drifted");
  assert.equal(model.runtimeGetterRules.cacheLifecycle.cacheField, "MilestoneCostList", "shard cost formula model cacheField drifted");
  assert.equal(model.runtimeGetterRules.cacheLifecycle.cacheFieldOffset, 5160, "shard cost formula model cacheFieldOffset drifted");
  assert.equal(model.runtimeGetterRules.cacheLifecycle.sortedConsumerMethod, "SortCostAndBools", "shard cost formula model sortedConsumerMethod drifted");
  assert.equal(model.runtimeGetterRules.cacheLifecycle.affordabilityConsumerMethod, "CountAffordableShard", "shard cost formula model affordabilityConsumerMethod drifted");
  assert.equal(model.runtimeGetterRules.cacheLifecycle.orderedGetterOutputsCached, true, "shard cost formula model orderedGetterOutputsCached drifted");
  assert.equal(model.runtimeGetterRules.cacheLifecycle.alternateFormulaPathFound, false, "shard cost formula model alternateFormulaPathFound drifted");
  assert.deepEqual(model.runtimeGetterRules.sharedStageLogic.windowOrder, ["pre-threshold", "100-plus-window", "200-plus-window", "300-plus-window", "400-plus-window"], "shard cost formula model windowOrder drifted");
  assert.equal(model.runtimeGetterRules.sharedStageLogic.dispatcherTargets.stageDispatcherEntryTarget, "0x24e3620", "shard cost formula model stageDispatcherEntryTarget drifted");
  assert.equal(model.runtimeGetterRules.sharedStageLogic.dispatcherTargets.decimalPowerBuilderTarget, "0x24e38f9", "shard cost formula model decimalPowerBuilderTarget drifted");
  assert.deepEqual(model.runtimeGetterRules.sharedStageLogic.thresholdCoverageClasses.map((entry) => entry.getterNames), [
    ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"],
    ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent"],
    ["get_OverLevel100Exponent", "get_OverLevel200Exponent"],
    ["get_OverLevel100Exponent"]
  ], "shard cost formula model thresholdCoverageClasses drifted");
  assert.deepEqual(model.runtimeGetterRules.sharedStageLogic.formulaApplicationProfiles.map((entry) => ({ formulaClass: entry.formulaClass, rows: entry.rows })), [
    { formulaClass: "row0-special-case", rows: [0] },
    { formulaClass: "canonical-additive-premerge", rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
    { formulaClass: "canonical-literal-builder", rows: [19, 20, 21] },
    { formulaClass: "drop-400-stage", rows: [17, 22, 23] },
    { formulaClass: "two-stage-transition-band", rows: [18, 24, 27, 28, 29] },
    { formulaClass: "hundred-stage-short-class", rows: [25, 26] }
  ], "shard cost formula model formulaApplicationProfiles drifted");

  assert.deepEqual(
    model.rowClasses.map((entry) => entry.id),
    [
      "row0-special-case",
      "canonical-additive-premerge",
      "canonical-literal-builder",
      "drop-400-stage",
      "two-stage-transition-band",
      "hundred-stage-short-class"
    ],
    "shard cost formula model row-class ids drifted"
  );
  assert.deepEqual(model.rowClasses[0].rows, [0], "shard cost formula model row0 class drifted");
  assert.deepEqual(model.rowClasses[1].stageCoverage, [100, 200, 300, 400], "shard cost formula model canonical-additive-premerge stage coverage drifted");
  assert.deepEqual(model.rowClasses[2].rows, [19, 20, 21], "shard cost formula model canonical-literal-builder rows drifted");
  assert.deepEqual(model.rowClasses[3].rows, [17, 22, 23], "shard cost formula model drop-400-stage rows drifted");
  assert.deepEqual(model.rowClasses[4].rows, [18, 24, 27, 28, 29], "shard cost formula model two-stage-transition-band rows drifted");
  assert.deepEqual(model.rowClasses[5].rows, [25, 26], "shard cost formula model hundred-stage-short-class rows drifted");

  assert.equal(
    model.stageRules.preThreshold.symbolicApproximation,
    "multiply(StartCost, dispatch(currentLevel, add(CostExponent, multiply(currentLevelBigDouble, GrowthExponent))))",
    "shard cost formula model pre-threshold symbolic approximation drifted"
  );
  assert.deepEqual(model.stageRules.preThreshold.sampledRows, [9, 25], "shard cost formula model pre-threshold sampled rows drifted");
  assert.equal(model.stageRules.hundredPlus.sampledOffsetFeeders.length, 3, "shard cost formula model sampled offset feeder count drifted");
  assert.ok(model.stageRules.hundredPlus.sampledOffsetFeeders.some((entry) => entry.row === 1 && entry.levelOffset === 70 && Math.abs(Number(entry.coefficient) - 9.765628774403013e-05) < 1e-16), "shard cost formula model row 1 feeder drifted");
  assert.ok(model.stageRules.hundredPlus.sampledOffsetFeeders.some((entry) => entry.row === 19 && entry.levelOffset === 70 && Math.abs(Number(entry.coefficient) - (-0.00011718430323526263)) < 1e-16), "shard cost formula model row 19 feeder drifted");
  assert.ok(model.stageRules.hundredPlus.sampledOffsetFeeders.some((entry) => entry.row === 27 && entry.levelOffset === 82 && Math.abs(Number(entry.coefficient) - 8192.001984596252) < 1e-9), "shard cost formula model row 27 feeder drifted");
  assert.deepEqual(model.stageRules.twoHundredPlus.sharedFamilies[1].integerSeeds, [180], "shard cost formula model 200-plus unary seed drifted");
  assert.deepEqual(model.stageRules.threeHundredPlus.sharedFamilies[1].integerSeeds, [49], "shard cost formula model 300-plus row 24 seed drifted");
  assert.deepEqual(model.stageRules.threeHundredPlus.sharedFamilies[2].integerSeeds, [19], "shard cost formula model 300-plus row 25 seed drifted");

  assert.equal(model.verifiedParameters.unlockRequirementBlock.offset, 1456, "shard cost formula model unlock requirement offset drifted");
  assert.deepEqual(model.verifiedParameters.unlockRequirementBlock.firstEightValues, [0, 0, 5, 10, 20, 30, 40, 50], "shard cost formula model unlock requirement prefix drifted");
  assert.deepEqual(model.verifiedParameters.unlockRequirementBlock.lastThreeValues, [8000, 8050, 8100], "shard cost formula model unlock requirement suffix drifted");
  assert.equal(model.verifiedParameters.row0FieldShell.exactBigDoubleValues.StartCost, "5.0e0", "shard cost formula model row0 StartCost drifted");
  assert.ok(model.verifiedParameters.representativeNormalRows.some((entry) => entry.row === 19 && entry.exactBigDoubleValues.StartCost === "1.0e70"), "shard cost formula model row 19 exact StartCost drifted");
  assert.ok(model.verifiedParameters.representativeNormalRows.some((entry) => entry.row === 27 && entry.exactBigDoubleValues.StartCost === "2.0e975"), "shard cost formula model row 27 exact StartCost drifted");
  assert.ok(model.verifiedParameters.representativeNormalRows.some((entry) => entry.row === 29 && entry.exactBigDoubleValues.StartCost === "6.0e988"), "shard cost formula model row 29 exact StartCost drifted");
  assert.deepEqual(model.verifiedParameters.overLevelExponentAccessors, ["get_OverLevel100Exponent", "get_OverLevel200Exponent", "get_OverLevel300Exponent", "get_OverLevel400Exponent"], "shard cost formula model over-level accessors drifted");
  assert.deepEqual(model.verifiedParameters.overLevelBaseFieldShells.map((entry) => entry.fieldName), ["OverLevel100Base", "OverLevel200Base", "OverLevel300Base", "OverLevel400Base"], "shard cost formula model over-level base field shells drifted");
  assert.deepEqual(model.verifiedParameters.overLevelBaseFieldShells.map((entry) => entry.fieldOffset), [5080, 5096, 5112, 5128], "shard cost formula model over-level base field offsets drifted");
  assert.equal(model.verifiedParameters.listPathTieIn.milestoneCostListField, "MilestoneCostList", "shard cost formula model MilestoneCostList field drifted");
  assert.equal(model.verifiedParameters.listPathTieIn.milestoneCostListFieldOffset, 5160, "shard cost formula model MilestoneCostList offset drifted");
  assert.equal(model.verifiedParameters.listPathTieIn.callOrderStart, "GetShardCostList", "shard cost formula model callOrderStart drifted");
  assert.equal(model.verifiedParameters.listPathTieIn.callOrderEnd, "get_SU29Cost", "shard cost formula model callOrderEnd drifted");

  assert.deepEqual(model.derivedParameters.repeatedCommonRowGroup.rows, [19, 20, 21], "shard cost formula model repeated common-row group drifted");
  assert.equal(model.derivedParameters.dispatcherSelectionBoundary.decimalPowerBuilderTarget, "0x24e38f9", "shard cost formula model decimalPowerBuilderTarget drifted");
  assert.equal(model.derivedParameters.dispatcherSelectionBoundary.bigDoubleLog10BridgeTarget, "0x24e30e4", "shard cost formula model bigDoubleLog10BridgeTarget drifted");
  assert.ok(model.derivedParameters.overLevelSeedModels.some((entry) => entry.getterName === "get_OverLevel100Exponent" && entry.baseSeed === 2), "shard cost formula model 100 seed drifted");
  assert.ok(model.derivedParameters.overLevelSeedModels.some((entry) => entry.getterName === "get_OverLevel200Exponent" && Number(entry.baseSeed) === 0), "shard cost formula model 200 seed drifted");
  assert.ok(model.derivedParameters.overLevelSeedModels.some((entry) => entry.getterName === "get_OverLevel400Exponent" && Math.abs(Number(entry.baseSeed) - 0.007812501846152979) < 1e-18), "shard cost formula model 400 seed drifted");
  assert.equal(model.derivedParameters.overLevelBaseRecoveryPath.status, "deterministic-native-seed-derivation", "shard cost formula model over-level base recovery status drifted");
  assert.equal(model.derivedParameters.overLevelBaseRecoveryPath.exactSerializedValuesRecovered, false, "shard cost formula model must not claim exact over-level base extraction");
  assert.equal(model.derivedParameters.overLevelBaseRecoveryPath.assetExtractionAttempt.uabeaDefaultValuesPresent, false, "shard cost formula model over-level asset default-value status drifted");
  assert.equal(model.derivedParameters.overLevelBaseRecoveryPath.assetExtractionAttempt.directMonoBehaviourFieldHitsCount, 0, "shard cost formula model over-level directMonoBehaviourFieldHitsCount drifted");
  assert.equal(model.derivedParameters.overLevelBaseRecoveryPath.assetExtractionAttempt.shardTargetMonoBehavioursCount, 0, "shard cost formula model over-level shardTargetMonoBehavioursCount drifted");
  assert.deepEqual(model.derivedParameters.overLevelBaseRecoveryPath.derivedRuntimeSeedModels.map((entry) => entry.fieldName), ["OverLevel100Base", "OverLevel200Base", "OverLevel300Base", "OverLevel400Base"], "shard cost formula model over-level derivedRuntimeSeedModels drifted");
  assert.ok(model.derivedParameters.overLevelBaseRecoveryPath.currentBoundary.some((line) => String(line).includes("not recovered serialized owner-field payload values")), "shard cost formula model over-level recovery boundary drifted");

  assert.equal(model.calibrationAnchors.length, 5, "shard cost formula model calibration anchor count drifted");
  assert.ok(model.calibrationAnchors.some((entry) => entry.row === 1 && entry.level === 283 && entry.observedCostLabel === "1.89e565"), "shard cost formula model calibration row 1 drifted");
  assert.ok(model.calibrationAnchors.some((entry) => entry.row === 21 && entry.level === 126 && entry.observedCostLabel === "1.20e565"), "shard cost formula model calibration row 21 drifted");

  assert.equal(model.boundedUncertaintyFlags.row0ExactClosedFormUnresolved, true, "shard cost formula model must keep row0 uncertainty explicit");
  assert.equal(model.boundedUncertaintyFlags.normalRowNumericMergeRuleUnresolved, true, "shard cost formula model must keep normal-row uncertainty explicit");
  assert.equal(model.boundedUncertaintyFlags.secondaryHundredPlusScalarLaneMeaningUnresolved, true, "shard cost formula model must keep secondary hundred-plus uncertainty explicit");
  assert.equal(model.boundedUncertaintyFlags.overLevelBasePayloadValuesUnresolved, true, "shard cost formula model must keep over-level base uncertainty explicit");
  assert.equal(model.boundedUncertaintyFlags.dispatcherLaneSelectionFullyProven, false, "shard cost formula model must not claim full dispatcher proof");
  assert.equal(model.boundedUncertaintyFlags.screenshotAnchorsMatchedByAcceptedEvaluator, false, "shard cost formula model must not claim screenshot-matched evaluator");

  assert.ok(model.blockedUses.includes("exact next-level shard costs"), "shard cost formula model must block exact next-level shard costs");
  assert.ok(model.blockedUses.includes("planner-safe affordability outputs"), "shard cost formula model must block affordability outputs");
  assert.ok(model.currentBoundary.some((line) => String(line).includes("single canonical shard-cost evaluator structure model")), "shard cost formula model must preserve canonical-dataset framing");
  assert.ok(model.currentBoundary.some((line) => String(line).includes("Do not expose exact next-level shard costs")), "shard cost formula model must preserve blocked-use framing");

  return {
    id: "shard-cost-formula-model",
    label: "Shard cost formula model",
    classification: "extracted-mechanics",
    stats: [
      `${model.rowClasses.length} row classes`,
      `${model.calibrationAnchors.length} calibration anchors`,
      "Canonical evaluator-model dataset and deterministic evaluator exist, but automated calibration remains blocked"
    ]
  };
}

function validateShardBonusSlotProbe(probe) {
  expectNonEmptyString(probe.dataset, "shard bonus slot probe dataset id must be present");
  expectNonEmptyString(probe.generatedAt, "shard bonus slot probe generatedAt must be present");
  expectRecord(probe.source, "shard bonus slot probe source must be an object");
  ["metadata", "groundedMilestones"].forEach((field) => {
    expectNonEmptyString(probe.source[field], `shard bonus slot probe source.${field} must be present`);
  });
  expectArray(probe.rows, "shard bonus slot probe rows must be an array");
  expectArray(probe.findings, "shard bonus slot probe findings must be an array");
  expectArray(probe.currentBoundary, "shard bonus slot probe currentBoundary must be an array");

  assert.equal(probe.dataset, "shard-bonus-slot-probe.v1", "shard bonus slot probe dataset drifted");
  assert.equal(probe.rows.length, 30, "shard bonus slot probe row count drifted");
  assert.ok(probe.rows.some((entry) => Number(entry.row) === 0 && Number(entry.bonusFieldCount) === 8 && Number(entry.groundedBonusCount) === 3), "shard bonus slot probe must preserve the Eternal row mismatch");
  assert.ok(probe.rows.some((entry) => Number(entry.row) === 18 && Number(entry.bonusFieldCount) === 6 && Number(entry.calcAccessorCount) === 6), "shard bonus slot probe must preserve row 18 bonus-slot coverage");
  assert.ok(probe.rows.some((entry) => Number(entry.row) === 27 && Number(entry.bonusFieldCount) === 3 && Number(entry.calcAccessorCount) === 3), "shard bonus slot probe must preserve late common row slot coverage");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("slot counts alone")), "shard bonus slot probe must preserve blocked-use framing");

  return {
    id: "shard-bonus-slot-probe",
    label: "Shard bonus slot probe",
    classification: "extracted-mechanics",
    stats: [
      `${probe.rows.length} shard rows`,
      "Exact SU*Bonus* slot counts now survive for rows 0-29",
      "Row 0 still undershoots metadata in grounded descriptive coverage"
    ]
  };
}

function validateShardTypeMetadataProbe(probe) {
  expectNonEmptyString(probe.dataset, "shard type metadata probe dataset id must be present");
  expectNonEmptyString(probe.generatedAt, "shard type metadata probe generatedAt must be present");
  expectRecord(probe.source, "shard type metadata probe source must be an object");
  expectNonEmptyString(probe.source.uabeaProbeReport, "shard type metadata probe source.uabeaProbeReport must be present");
  expectNonEmptyString(probe.source.probeMethod, "shard type metadata probe source.probeMethod must be present");
  expectRecord(probe.targets, "shard type metadata probe targets must be an object");
  expectRecord(probe.targets.shardMining, "shard type metadata probe shardMining target must be an object");
  expectRecord(probe.targets.shardUpgradeInfo, "shard type metadata probe shardUpgradeInfo target must be an object");
  expectRecord(probe.targets.shardPerLevelTextHandler, "shard type metadata probe shardPerLevelTextHandler target must be an object");
  expectArray(probe.targets.shardMining.ownerListFields, "shard type metadata probe shardMining.ownerListFields must be an array");
  expectArray(probe.targets.shardUpgradeInfo.fields, "shard type metadata probe shardUpgradeInfo.fields must be an array");
  expectArray(probe.rows, "shard type metadata probe rows must be an array");
  expectArray(probe.findings, "shard type metadata probe findings must be an array");
  expectArray(probe.currentBoundary, "shard type metadata probe currentBoundary must be an array");

  assert.equal(probe.dataset, "shard-type-metadata-probe.v1", "shard type metadata probe dataset drifted");
  assert.equal(probe.targets.shardMining.fullName, "ShardMining", "shard type metadata probe ShardMining fullName drifted");
  assert.equal(probe.targets.shardMining.baseType, "UnityEngine.MonoBehaviour", "shard type metadata probe ShardMining baseType drifted");
  assert.equal(probe.targets.shardPerLevelTextHandler.fullName, "ShardPerLevelTextHandler", "shard type metadata probe text handler fullName drifted");
  assert.equal(probe.targets.shardUpgradeInfo.fullName, "ShardMining+ShardUpgradeInfo", "shard type metadata probe ShardUpgradeInfo fullName drifted");
  assert.ok(probe.targets.shardMining.ownerListFields.some((entry) => entry?.name === "MilestoneCostList" && entry?.type === "System.Collections.Generic.List`1<BreakInfinity.BigDouble>"), "shard type metadata probe must preserve MilestoneCostList");
  assert.ok(probe.targets.shardMining.ownerListFields.some((entry) => entry?.name === "upgradeInfoList" && entry?.type === "System.Collections.Generic.List`1<ShardMining+ShardUpgradeInfo>"), "shard type metadata probe must preserve upgradeInfoList");
  assert.deepEqual(probe.targets.shardMining.overLevelBaseFields.map((entry) => entry?.name), ["OverLevel100Base", "OverLevel200Base", "OverLevel300Base", "OverLevel400Base"], "shard type metadata probe over-level base fields drifted");
  assert.deepEqual(probe.targets.shardMining.overLevelBaseFields.map((entry) => entry?.fieldOffset), [5080, 5096, 5112, 5128], "shard type metadata probe over-level base field offsets drifted");
  assert.deepEqual(probe.targets.shardUpgradeInfo.fields.map((entry) => entry?.name), ["<Cost>k__BackingField", "<MaxLevel>k__BackingField", "<IsUnlocked>k__BackingField"], "shard type metadata probe ShardUpgradeInfo field list drifted");
  assert.equal(probe.rows.length, 30, "shard type metadata probe row count drifted");
  assert.ok(probe.rows.some((entry) => entry?.row === 0 && entry?.costFieldCount === 5 && entry?.bonusFieldCount === 8), "shard type metadata probe must preserve row 0 schema");
  assert.ok(probe.rows.some((entry) => entry?.row === 18 && entry?.bonusFieldCount === 6 && entry?.bonusTextFieldCount === 6), "shard type metadata probe must preserve row 18 bonus/text schema");
  assert.ok(probe.rows.some((entry) => entry?.row === 27 && entry?.costFieldCount === 3 && entry?.bonusFieldCount === 3 && entry?.bonusTextFieldCount === 3), "shard type metadata probe must preserve row 27 schema");
  assert.equal(probe.overLevelBaseValueRecovery.uabeaDefaultValuesPresent, false, "shard type metadata probe over-level default values status drifted");
  assert.equal(probe.overLevelBaseValueRecovery.directMonoBehaviourFieldHitsCount, 0, "shard type metadata probe over-level directMonoBehaviourFieldHitsCount drifted");
  assert.equal(probe.overLevelBaseValueRecovery.shardTargetMonoBehavioursCount, 0, "shard type metadata probe over-level shardTargetMonoBehavioursCount drifted");
  assert.equal(probe.overLevelBaseValueRecovery.exactSerializedValuesRecovered, false, "shard type metadata probe must not claim exact over-level values");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("OverLevel*Base as typed owner-field shells only")), "shard type metadata probe over-level boundary drifted");
  assert.ok(probe.currentBoundary.some((line) => String(line).includes("not as final serialized row values")), "shard type metadata probe must preserve blocked-use framing");

  return {
    id: "shard-type-metadata-probe",
    label: "Shard type metadata probe",
    classification: "extracted-mechanics",
    stats: [
      `${probe.rows.length} typed shard rows`,
      `${probe.targets.shardMining.ownerListFields.length} typed shard list or state hooks`,
      "Direct LibCpp2IL shard type reflection is now preserved without claiming decoded serialized values"
    ]
  };
}

function validateShardMilestoneHandoffBoundary(boundary) {
  expectNonEmptyString(boundary.dataset, "shard milestone handoff boundary dataset id must be present");
  expectNonEmptyString(boundary.generatedAt, "shard milestone handoff boundary generatedAt must be present");
  expectRecord(boundary.sources, "shard milestone handoff boundary sources must be an object");
  ["shardMiningMetadataNeighborhood", "shardMetadataNeighborhood", "ownerFamilyBoundary", "rowShellBoundary", "rowAlignmentBoundary", "globalMetadata"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `shard milestone handoff boundary sources.${field} must be present`);
  });
  expectNonEmptyString(boundary.shardControllerFamily, "shard milestone handoff boundary shardControllerFamily must be present");
  expectRecord(boundary.shardControllerRowShell, "shard milestone handoff boundary shardControllerRowShell must be an object");
  expectRecord(boundary.shardControllerRowShell.unlockHookRange, "shard milestone handoff boundary unlockHookRange must be an object");
  expectRecord(boundary.shardControllerRowShell.buyHookRange, "shard milestone handoff boundary buyHookRange must be an object");
  expectRecord(boundary.shardControllerRowShell.textCheckerRange, "shard milestone handoff boundary textCheckerRange must be an object");
  expectRecord(boundary.genericMilestoneLead, "shard milestone handoff boundary genericMilestoneLead must be an object");
  expectNonEmptyString(boundary.genericMilestoneLead.family, "shard milestone handoff boundary genericMilestoneLead.family must be present");
  expectNonEmptyString(boundary.genericMilestoneLead.metadataPath, "shard milestone handoff boundary genericMilestoneLead.metadataPath must be present");
  expectRecord(boundary.genericMilestoneLead.buyHookRange, "shard milestone handoff boundary genericMilestoneLead.buyHookRange must be an object");
  expectArray(boundary.genericMilestoneLead.textAndValueAnchors, "shard milestone handoff boundary genericMilestoneLead.textAndValueAnchors must be an array");
  expectArray(boundary.handoffFindings, "shard milestone handoff boundary handoffFindings must be an array");
  expectArray(boundary.currentBoundary, "shard milestone handoff boundary currentBoundary must be an array");

  assert.equal(boundary.shardControllerFamily, "ShardMining, Assembly-CSharp", "shard milestone handoff boundary shardControllerFamily drifted");
  assert.deepEqual(boundary.shardControllerRowShell.unlockHookRange, { start: 17, end: 29, count: 13 }, "shard milestone handoff boundary unlockHookRange drifted");
  assert.deepEqual(boundary.shardControllerRowShell.buyHookRange, { start: 0, end: 0, count: 1 }, "shard milestone handoff boundary buyHookRange drifted");
  assert.deepEqual(boundary.shardControllerRowShell.textCheckerRange, { start: 0, end: 12, count: 13 }, "shard milestone handoff boundary textCheckerRange drifted");
  assert.equal(boundary.genericMilestoneLead.family, "ConstructionMilestones, Assembly-CSharp", "shard milestone handoff boundary genericMilestoneLead.family drifted");
  assert.equal(boundary.genericMilestoneLead.metadataPath, "Assets\\Scripts\\Upgrades\\AcademyData\\ConstructionMilestones.cs", "shard milestone handoff boundary genericMilestoneLead.metadataPath drifted");
  assert.deepEqual(boundary.genericMilestoneLead.buyHookRange, { start: 1, end: 57, count: 57 }, "shard milestone handoff boundary genericMilestoneLead.buyHookRange drifted");
  ["InitializeMilestones", "SetAllMilestoneTexts", "GetMilestoneDiamondValue", "GetMilestoneTokenValue", "GetClaimedMilestonesAmount"].forEach((name) => {
    assert.ok(boundary.genericMilestoneLead.textAndValueAnchors.includes(name), `shard milestone handoff boundary missing ${name}`);
  });
  assert.ok(boundary.handoffFindings.some((line) => String(line).includes("BuyMilestone1-57")), "shard milestone handoff boundary must preserve generic buy-family narrowing");
  assert.ok(boundary.currentBoundary.some((line) => String(line).includes("not recovered player-owned shard milestone state")), "shard milestone handoff boundary must preserve blocked-use framing");

  return {
    id: "shard-milestone-handoff-boundary",
    label: "Shard milestone handoff boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.handoffFindings.length} handoff findings`,
      `${boundary.genericMilestoneLead.textAndValueAnchors.length} generic milestone helper anchors`,
      "The shard row-owner seam is narrowed to the ShardMining-to-ConstructionMilestones handoff"
    ]
  };
}

function validateExtractionCandidateFamilies(families) {
  expectNonEmptyString(families.dataset, "extraction candidate families dataset id must be present");
  expectNonEmptyString(families.generatedAt, "extraction candidate families generatedAt must be present");
  expectArray(families.binaryFiles, "extraction candidate families binaryFiles must be an array");
  expectArray(families.textFiles, "extraction candidate families textFiles must be an array");
  expectArray(families.globalContextTerms, "extraction candidate families globalContextTerms must be an array");
  expectArray(families.unresolvedMarkers, "extraction candidate families unresolvedMarkers must be an array");
  expectArray(families.families, "extraction candidate families families must be an array");
  assert.ok(families.families.length >= 7, "extraction candidate families must preserve the seeded family set");
  families.families.forEach((entry, index) => {
    expectNonEmptyString(entry.id, `extraction candidate families[${index}].id must be present`);
    expectNonEmptyString(entry.label, `extraction candidate families[${index}].label must be present`);
    expectNonEmptyString(entry.track, `extraction candidate families[${index}].track must be present`);
    expectArray(entry.terms, `extraction candidate families[${index}].terms must be an array`);
    expectArray(entry.anchors, `extraction candidate families[${index}].anchors must be an array`);
  });
  assert.ok(families.families.some((entry) => entry.id === "shards.milestone-owner-family"), "extraction candidate families must preserve the shard milestone owner family");
  assert.ok(families.families.some((entry) => entry.id === "spend.multiverse-market-save-model"), "extraction candidate families must preserve the MultiverseMarket save-model family");
  assert.ok(!families.families.some((entry) => entry.id === "spend.multiverse-market-owner-family"), "extraction candidate families should not keep the resolved MultiverseMarket owner-family candidate active");

  return {
    id: "extraction-candidate-families",
    label: "Extraction candidate families",
    classification: "extracted-mechanics",
    stats: [
      `${families.families.length} candidate families`,
      `${families.binaryFiles.length} binary files`,
      `${families.textFiles.length} text files`
    ]
  };
}

function validateExtractionCandidateRanking(ranking) {
  expectNonEmptyString(ranking.dataset, "extraction candidate ranking dataset id must be present");
  expectNonEmptyString(ranking.generatedAt, "extraction candidate ranking generatedAt must be present");
  expectNonEmptyString(ranking.sourceConfig, "extraction candidate ranking sourceConfig must be present");
  expectPositiveInteger(ranking.byteRadius, "extraction candidate ranking byteRadius must be positive");
  expectArray(ranking.globalContextTerms, "extraction candidate ranking globalContextTerms must be an array");
  expectArray(ranking.unresolvedMarkers, "extraction candidate ranking unresolvedMarkers must be an array");
  expectArray(ranking.binaryFiles, "extraction candidate ranking binaryFiles must be an array");
  expectArray(ranking.textFiles, "extraction candidate ranking textFiles must be an array");
  expectArray(ranking.familyFilter, "extraction candidate ranking familyFilter must be an array");
  expectRecord(ranking.topCandidate, "extraction candidate ranking topCandidate must be an object");
  expectArray(ranking.candidates, "extraction candidate ranking candidates must be an array");
  assert.ok(ranking.candidates.length >= 7, "extraction candidate ranking must preserve the scored candidate set");
  expectNonEmptyString(ranking.topCandidate.id, "extraction candidate ranking topCandidate.id must be present");
  expectNonEmptyString(ranking.topCandidate.track, "extraction candidate ranking topCandidate.track must be present");
  assert.equal(typeof ranking.topCandidate.heuristicScore, "number", "extraction candidate ranking topCandidate.heuristicScore must be numeric");
  assert.equal(ranking.topCandidate.id, "shards.milestone-owner-family", "extraction candidate ranking topCandidate.id drifted");
  assert.equal(ranking.topCandidate.track, "shard-milestone-payload-recovery", "extraction candidate ranking topCandidate.track drifted");
  const shardCandidate = ranking.candidates.find((entry) => entry.track === "shard-milestone-payload-recovery");
  assert.ok(shardCandidate, "extraction candidate ranking must preserve a shard-local candidate");
  assert.equal(shardCandidate.id, "shards.milestone-owner-family", "extraction candidate ranking top shard candidate drifted");
  assert.ok(shardCandidate.heuristicScore >= 500, "extraction candidate ranking top shard candidate heuristicScore regressed");

  return {
    id: "extraction-candidate-ranking",
    label: "Extraction candidate ranking",
    classification: "extracted-mechanics",
    stats: [
      `${ranking.candidates.length} ranked candidates`,
      `${ranking.topCandidate.id} top candidate`,
      `${ranking.topCandidate.heuristicScore} top heuristic score`
    ]
  };
}

function validateTokenShop(tokenShop) {
  expectRecord(tokenShop.source, "token shop source must be an object");
  expectNonEmptyString(tokenShop.source.metadata, "token shop metadata path must be present");
  expectNonEmptyString(tokenShop.source.level0, "token shop level0 path must be present");
  expectArray(tokenShop.fields, "token shop fields must be an array");
  expectRecord(tokenShop.numeric_table, "token shop numeric_table must be an object");
  expectArray(tokenShop.resource_icons, "token shop resource_icons must be an array");
  assert.ok(tokenShop.fields.length >= 50, "token shop fields should include the extracted payload");
  ["TokenBoost", "DiamondBoost", "TokenBoostT2", "ATU25"].forEach((key) => {
    expectRecord(tokenShop.numeric_table[key], `token shop numeric_table.${key} must be present`);
  });
  ["resourceicons/resource_tokenium", "resourceicons/resource_tokenium_cap"].forEach((icon) => {
    assert.ok(tokenShop.resource_icons.includes(icon), `token shop resource_icons must include ${icon}`);
  });
  return {
    id: "token-shop",
    label: "Token shop extract",
    classification: "extracted-mechanics",
    stats: [
      `${tokenShop.fields.length} extracted fields`,
      `${Object.keys(tokenShop.numeric_table).length} numeric groups`,
      `${tokenShop.resource_icons.length} resource icons`
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

function validateMultiverseMarketMetadataNeighborhood(neighborhood) {
  expectNonEmptyString(neighborhood.metadata, "multiverse metadata neighborhood path must be present");
  expectPositiveInteger(neighborhood.anchor_count, "multiverse metadata neighborhood anchor_count must be positive");
  expectPositiveInteger(neighborhood.context, "multiverse metadata neighborhood context must be positive");
  expectArray(neighborhood.results, "multiverse metadata neighborhood results must be an array");
  assert.ok(neighborhood.results.length >= 10, "multiverse metadata neighborhood should preserve the narrowed anchor set");

  const anchors = neighborhood.results.map((entry) => entry.anchor);
  ["CloudSavePlayerProfile", "PlayerProfileData", "FillPlayerProfileData", "GetPlayerProfileData", "InscryptionsDone", "SetAllChrystosEmporiumTexts", "Mech1Unlocked", "Market", "GemData", "ShardData"].forEach((anchor) => {
    assert.ok(anchors.includes(anchor), `multiverse metadata neighborhood missing ${anchor} anchor`);
  });

  const cloudSaveMatches = neighborhood.results.find((entry) => entry.anchor === "CloudSavePlayerProfile")?.matches ?? [];
  const cloudSaveStrings = cloudSaveMatches.flatMap((entry) => [
    entry.match_value,
    ...(Array.isArray(entry.context) ? entry.context.map((item) => item.value) : [])
  ]);
  assert.ok(
    cloudSaveStrings.some((value) => String(value).includes("CloudSavePlayerProfile")),
    "multiverse metadata neighborhood must preserve CloudSavePlayerProfile clues"
  );
  assert.ok(
    cloudSaveStrings.some((value) => String(value).includes("GetPlayerProfileInfo")),
    "multiverse metadata neighborhood must preserve GetPlayerProfileInfo clues"
  );

  const playerProfileMatches = neighborhood.results.find((entry) => entry.anchor === "PlayerProfileData")?.matches ?? [];
  const playerProfileStrings = playerProfileMatches.flatMap((entry) => [
    entry.match_value,
    ...(Array.isArray(entry.context) ? entry.context.map((item) => item.value) : [])
  ]);
  assert.ok(
    playerProfileStrings.some((value) => String(value).includes("PlayerProfileData.cs")),
    "multiverse metadata neighborhood must preserve PlayerProfileData.cs path clues"
  );
  assert.ok(
    playerProfileStrings.some((value) => String(value).includes("GetPlayerProfileData")),
    "multiverse metadata neighborhood must preserve GetPlayerProfileData clues"
  );
  assert.ok(
    playerProfileStrings.some((value) => String(value).includes("FillPlayerProfileData")),
    "multiverse metadata neighborhood must preserve FillPlayerProfileData clues"
  );
  assert.ok(
    playerProfileStrings.some((value) => String(value).includes("get_Market")),
    "multiverse metadata neighborhood must preserve get_Market clues"
  );
  assert.ok(
    !playerProfileStrings.some((value) => String(value).includes("PlayerProfileData|Market")),
    "multiverse metadata neighborhood should not yet claim a direct PlayerProfileData|Market type-map clue"
  );

  const inscryptionsMatches = neighborhood.results.find((entry) => entry.anchor === "InscryptionsDone")?.matches ?? [];
  const inscryptionsStrings = inscryptionsMatches.flatMap((entry) => [
    entry.match_value,
    ...(Array.isArray(entry.context) ? entry.context.map((item) => item.value) : [])
  ]);
  assert.ok(
    inscryptionsStrings.some((value) => String(value).includes("InscryptionsDone")),
    "multiverse metadata neighborhood must preserve InscryptionsDone clues"
  );
  assert.ok(
    inscryptionsStrings.some((value) => String(value).includes("EsotericR1Trades")),
    "multiverse metadata neighborhood must preserve EsotericR1Trades clues"
  );
  assert.ok(
    inscryptionsStrings.some((value) => String(value).includes("SetAllChrystosEmporiumTexts")),
    "multiverse metadata neighborhood must preserve SetAllChrystosEmporiumTexts clues"
  );

  const mechMatches = neighborhood.results.find((entry) => entry.anchor === "Mech1Unlocked")?.matches ?? [];
  const mechStrings = mechMatches.flatMap((entry) => [
    entry.match_value,
    ...(Array.isArray(entry.context) ? entry.context.map((item) => item.value) : [])
  ]);
  assert.ok(
    mechStrings.some((value) => String(value).includes("Mech1Unlocked")),
    "multiverse metadata neighborhood must preserve Mech1Unlocked clues"
  );

  const marketMatches = neighborhood.results.find((entry) => entry.anchor === "Market")?.matches ?? [];
  const marketStrings = marketMatches.flatMap((entry) => [
    entry.match_value,
    ...(Array.isArray(entry.context) ? entry.context.map((item) => item.value) : [])
  ]);
  assert.ok(
    marketStrings.some((value) => String(value).includes("get_Market")),
    "multiverse metadata neighborhood must preserve get_Market accessors in the market-side clue bundle"
  );
  assert.ok(
    marketStrings.some((value) => String(value).includes("MultiverseMarket|Inscryption")),
    "multiverse metadata neighborhood must preserve MultiverseMarket|Inscryption type clues"
  );
  assert.ok(
    !marketStrings.some((value) => String(value).includes("PlayerProfileData|Market")),
    "multiverse metadata neighborhood should not yet claim a direct PlayerProfileData|Market relation"
  );

  return {
    id: "multiverse-market-metadata-neighborhood",
    label: "Multiverse market metadata neighborhood",
    classification: "extracted-mechanics",
    stats: [
      `${neighborhood.anchor_count} probe anchors`,
      `${neighborhood.results.length} tracked anchor groups`,
      "CloudSavePlayerProfile, PlayerProfileData, get_Market, and InscryptionsDone save-side clues"
    ]
  };
}

function validateTokeniumNamingClues(clues) {
  expectNonEmptyString(clues.generatedAt, "tokenium naming clues generatedAt must be present");
  expectRecord(clues.sources, "tokenium naming clues sources must be an object");
  expectNonEmptyString(clues.sources.metadata, "tokenium naming clues metadata path must be present");
  expectNonEmptyString(clues.sources.level0, "tokenium naming clues level0 path must be present");
  expectArray(clues.sources.assetNames, "tokenium naming clues sources.assetNames must be an array");
  expectRecord(clues.assetNames, "tokenium naming clues assetNames must be an object");
  expectArray(clues.assetNames.resourceIcons, "tokenium naming clues resourceIcons must be an array");
  expectArray(clues.assetNames.academySprites, "tokenium naming clues academySprites must be an array");
  expectArray(clues.level0Shells, "tokenium naming clues level0Shells must be an array");
  expectArray(clues.metadataStrings, "tokenium naming clues metadataStrings must be an array");
  expectArray(clues.currentBoundary, "tokenium naming clues currentBoundary must be an array");

  ["Resource_Tokenium", "Resource_Tokenium_Cap_0"].forEach((name) => {
    assert.ok(clues.assetNames.resourceIcons.includes(name), `tokenium naming clues missing ${name}`);
  });
  assert.ok(clues.assetNames.academySprites.includes("Aca.Tokenium553"), "tokenium naming clues missing Aca.Tokenium553");
  ["AvailableTokensBar", "CostBox-Tokens", "CostBox-Tokenium"].forEach((name) => {
    assert.ok(clues.level0Shells.includes(name), `tokenium naming clues missing ${name}`);
  });
  ["Daily Tokenium (from blue farm missions)", "Mission Materials", "INCREASE TOKENS PER TOKENIUM-553"].forEach((value) => {
    assert.ok(clues.metadataStrings.includes(value), `tokenium naming clues missing ${value}`);
  });

  return {
    id: "tokenium-naming-clues",
    label: "Tokenium naming clues",
    classification: "extracted-mechanics",
    stats: [
      `${clues.assetNames.resourceIcons.length} tokenium icon names`,
      `${clues.level0Shells.length} token or tokenium cost shells`,
      "Tokenium, Tokenium553, and CostBox naming clues"
    ]
  };
}

function validateTokenBankStateClues(clues) {
  expectNonEmptyString(clues.generatedAt, "token-bank state clues generatedAt must be present");
  expectRecord(clues.sources, "token-bank state clues sources must be an object");
  expectNonEmptyString(clues.sources.metadata, "token-bank state clues metadata path must be present");
  expectNonEmptyString(clues.sources.level0, "token-bank state clues level0 path must be present");
  expectNonEmptyString(clues.sources.probe, "token-bank state clues probe path must be present");
  expectNonEmptyString(clues.sources.uabeaProbe, "token-bank state clues uabeaProbe path must be present");
  expectArray(clues.tokenShopMethods, "token-bank state clues tokenShopMethods must be an array");
  expectArray(clues.tokenShopControllerRefs, "token-bank state clues tokenShopControllerRefs must be an array");
  expectArray(clues.displayOrHandlerClues, "token-bank state clues displayOrHandlerClues must be an array");
  expectArray(clues.derivedOutputs, "token-bank state clues derivedOutputs must be an array");
  expectRecord(clues.exactSaveOwnerRecovery, "token-bank state clues exactSaveOwnerRecovery must be an object");
  expectArray(clues.negativeTypedOwnerChecks, "token-bank state clues negativeTypedOwnerChecks must be an array");
  expectArray(clues.currentBoundary, "token-bank state clues currentBoundary must be an array");

  ["get_TokenBankCap", "get_ClaimableBankTokens", "IncreaseBankedTokens", "ClaimBankedTokens", "SetBankFill"].forEach((name) => {
    assert.ok(clues.tokenShopMethods.includes(name), `token-bank state clues missing ${name}`);
  });
  ["BankFill", "TokenBankDescriptionText"].forEach((name) => {
    assert.ok(clues.tokenShopControllerRefs.includes(name), `token-bank state clues missing ${name}`);
  });
  ["BigStatisticPrefab.TokenBankCap", "TextHandlerLoopMods", "SetLM244BonusText"].forEach((name) => {
    assert.ok(clues.displayOrHandlerClues.includes(name), `token-bank state clues missing ${name}`);
  });
  ["FinalTokenBankFillSpeed", "<FinalTokenBankFillSpeed>k__BackingField"].forEach((name) => {
    assert.ok(clues.derivedOutputs.includes(name), `token-bank state clues missing ${name}`);
  });
  assert.equal(clues.exactSaveOwnerRecovery.declaringType, "SaveData", "token-bank state clues declaringType drifted");
  assert.equal(clues.exactSaveOwnerRecovery.storedAmountField, "BankedTokens", "token-bank state clues storedAmountField drifted");
  assert.equal(clues.exactSaveOwnerRecovery.storedAmountFieldType, "System.Single", "token-bank state clues storedAmountFieldType drifted");
  assert.equal(clues.exactSaveOwnerRecovery.storedAmountFieldIndex, 214, "token-bank state clues storedAmountFieldIndex drifted");
  assert.equal(clues.exactSaveOwnerRecovery.storedAmountFieldOffset, 1800, "token-bank state clues storedAmountFieldOffset drifted");
  [
    "SaveData.ClaimableBankTokens",
    "SaveData.TokenBankCap",
    "PlayerProfileData.BankedTokens",
    "PlayerProfileData.ClaimableBankTokens",
    "PlayerProfileData.TokenBankCap"
  ].forEach((name) => {
    assert.ok(clues.negativeTypedOwnerChecks.includes(name), `token-bank state clues missing ${name}`);
  });

  return {
    id: "token-bank-state-clues",
    label: "Token-bank state clues",
    classification: "extracted-mechanics",
    stats: [
      `${clues.tokenShopMethods.length} token-bank controller methods`,
      `${clues.displayOrHandlerClues.length} display or handler clues`,
      "Exact SaveData.BankedTokens owner plus blocked cap or claimable typed checks"
    ]
  };
}

function validateDailyTokeniumLaneClues(clues) {
  expectNonEmptyString(clues.generatedAt, "daily tokenium lane clues generatedAt must be present");
  expectRecord(clues.sources, "daily tokenium lane clues sources must be an object");
  ["metadata", "level0", "iapCatalog", "probe", "academySprite", "uabeaProbe"].forEach((field) => {
    expectNonEmptyString(clues.sources[field], `daily tokenium lane clues sources.${field} must be present`);
  });
  expectArray(clues.ownerFamilyClues, "daily tokenium lane clues ownerFamilyClues must be an array");
  expectArray(clues.modifierClues, "daily tokenium lane clues modifierClues must be an array");
  expectArray(clues.premiumModifierClues, "daily tokenium lane clues premiumModifierClues must be an array");
  expectArray(clues.playerFacingStrings, "daily tokenium lane clues playerFacingStrings must be an array");
  expectRecord(clues.exactSaveOwnerRecovery, "daily tokenium lane clues exactSaveOwnerRecovery must be an object");
  expectRecord(clues.genericTokeniumClaimableBoundary, "daily tokenium lane clues genericTokeniumClaimableBoundary must be an object");
  expectArray(clues.negativeTypedOwnerChecks, "daily tokenium lane clues negativeTypedOwnerChecks must be an array");
  expectArray(clues.currentBoundary, "daily tokenium lane clues currentBoundary must be an array");

  ["SpaceAcademy", "SpaceAcademyMain", "TextHandlerSpaceAcademy", "FarmMissions"].forEach((name) => {
    assert.ok(clues.ownerFamilyClues.includes(name), `daily tokenium lane clues missing ${name}`);
  });
  ["SetLM244BonusText", "BuyLM244", "FinalDailyTokenBonus", "FinalFragmentsGainedFromFarmMissions"].forEach((name) => {
    assert.ok(clues.modifierClues.includes(name), `daily tokenium lane clues missing ${name}`);
  });
  ["BuyCollectorDevice", "CollectorCapBonus", "CollectorMatsBonus", "SetCollectorDeviceTexts"].forEach((name) => {
    assert.ok(clues.premiumModifierClues.includes(name), `daily tokenium lane clues missing ${name}`);
  });
  [
    "0 / 2000 Daily Tokenium (from blue farm missions)",
    "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
    "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
  ].forEach((value) => {
    assert.ok(clues.playerFacingStrings.includes(value), `daily tokenium lane clues missing ${value}`);
  });
  assert.equal(clues.exactSaveOwnerRecovery.declaringType, "SaveData", "daily tokenium lane clues declaringType drifted");
  assert.equal(clues.exactSaveOwnerRecovery.storedAmountField, "DailyTokenium", "daily tokenium lane clues storedAmountField drifted");
  assert.equal(clues.exactSaveOwnerRecovery.storedAmountFieldType, "System.Double", "daily tokenium lane clues storedAmountFieldType drifted");
  assert.equal(clues.exactSaveOwnerRecovery.storedAmountFieldIndex, 2361, "daily tokenium lane clues storedAmountFieldIndex drifted");
  assert.equal(clues.exactSaveOwnerRecovery.storedAmountFieldOffset, 13032, "daily tokenium lane clues storedAmountFieldOffset drifted");
  assert.equal(clues.genericTokeniumClaimableBoundary.declaringType, "SaveData", "daily tokenium lane clues claimable declaringType drifted");
  assert.equal(clues.genericTokeniumClaimableBoundary.field, "ClaimableTokenium", "daily tokenium lane clues claimable field drifted");
  assert.equal(clues.genericTokeniumClaimableBoundary.fieldType, "System.Double", "daily tokenium lane clues claimable fieldType drifted");
  assert.equal(clues.genericTokeniumClaimableBoundary.fieldIndex, 2022, "daily tokenium lane clues claimable fieldIndex drifted");
  assert.equal(clues.genericTokeniumClaimableBoundary.fieldOffset, 12064, "daily tokenium lane clues claimable fieldOffset drifted");
  [
    "SaveData.DailyTokeniumCap",
    "PlayerProfileData.DailyTokenium",
    "PlayerProfileData.DailyTokeniumCap"
  ].forEach((name) => {
    assert.ok(clues.negativeTypedOwnerChecks.includes(name), `daily tokenium lane clues missing ${name}`);
  });

  return {
    id: "daily-tokenium-lane-clues",
    label: "Daily Tokenium lane clues",
    classification: "extracted-mechanics",
    stats: [
      `${clues.ownerFamilyClues.length} academy or mission owner clues`,
      `${clues.modifierClues.length} lane modifier clues`,
      "Exact SaveData.DailyTokenium owner plus blocked cap and generic ClaimableTokenium boundary"
    ]
  };
}

function validateTokenBankFormulaBoundary(clues) {
  expectNonEmptyString(clues.generatedAt, "token-bank formula boundary generatedAt must be present");
  expectRecord(clues.sources, "token-bank formula boundary sources must be an object");
  ["metadata", "level0", "probe"].forEach((field) => {
    expectNonEmptyString(clues.sources[field], `token-bank formula boundary sources.${field} must be present`);
  });
  expectArray(clues.derivedOutputCluster, "token-bank formula boundary derivedOutputCluster must be an array");
  expectArray(clues.controllerSideAnchors, "token-bank formula boundary controllerSideAnchors must be an array");
  expectArray(clues.saveFamilyCluesChecked, "token-bank formula boundary saveFamilyCluesChecked must be an array");
  expectArray(clues.saveFamilyCluesInDerivedContext, "token-bank formula boundary saveFamilyCluesInDerivedContext must be an array");
  expectArray(clues.currentBoundary, "token-bank formula boundary currentBoundary must be an array");

  [
    "get_FinalTokenBankCap",
    "set_FinalTokenBankCap",
    "get_FinalTokenBankFillSpeed",
    "set_FinalTokenBankFillSpeed",
    "<FinalTokenBankCap>k__BackingField",
    "<FinalTokenBankFillSpeed>k__BackingField",
    "FinalTokenBankCap",
    "FinalTokenBankFillSpeed"
  ].forEach((name) => {
    assert.ok(clues.derivedOutputCluster.includes(name), `token-bank formula boundary missing ${name}`);
  });
  ["TokenShop", "get_ClaimableBankTokens", "IncreaseBankedTokens", "ClaimBankedTokens", "SetBankFill"].forEach((name) => {
    assert.ok(clues.controllerSideAnchors.includes(name), `token-bank formula boundary missing ${name}`);
  });
  ["PlayerProfileData", "GetPlayerProfileData", "FillPlayerProfileData", "CloudSavePlayerProfile"].forEach((name) => {
    assert.ok(clues.saveFamilyCluesChecked.includes(name), `token-bank formula boundary missing ${name}`);
  });
  assert.equal(
    clues.saveFamilyCluesInDerivedContext.length,
    0,
    "token-bank formula boundary should preserve the current lack of save-family joins in the derived-output context"
  );

  return {
    id: "token-bank-formula-boundary",
    label: "Token-bank formula boundary",
    classification: "extracted-mechanics",
    stats: [
      `${clues.derivedOutputCluster.length} derived-output symbols`,
      `${clues.controllerSideAnchors.length} controller-side anchors`,
      "FinalTokenBank outputs remain separate from checked save-family clues"
    ]
  };
}

function validateMultiverseMarketRangeBoundary(boundary) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market range boundary generatedAt must be present");
  expectRecord(boundary.sources, "multiverse market range boundary sources must be an object");
  expectNonEmptyString(boundary.sources.validatedRows, "multiverse market range boundary validatedRows source must be present");
  expectNonEmptyString(boundary.sources.metadataNeighborhood, "multiverse market range boundary metadataNeighborhood source must be present");
  expectArray(boundary.validatedRowIds, "multiverse market range boundary validatedRowIds must be an array");
  expectArray(boundary.validatedRowRanges, "multiverse market range boundary validatedRowRanges must be an array");
  expectArray(boundary.metadataIsLevels, "multiverse market range boundary metadataIsLevels must be an array");
  expectNonEmptyString(boundary.metadataIsRangeLabel, "multiverse market range boundary metadataIsRangeLabel must be present");
  expectArray(boundary.overlapIds, "multiverse market range boundary overlapIds must be an array");
  expectArray(boundary.currentBoundary, "multiverse market range boundary currentBoundary must be an array");

  assert.deepEqual(boundary.validatedRowRanges, ["50-59", "63-74"], "multiverse market range boundary validatedRowRanges drifted");
  assert.deepEqual(boundary.metadataIsLevels, [71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110], "multiverse market range boundary metadataIsLevels drifted");
  assert.equal(boundary.metadataIsRangeLabel, "IS71Level through IS110Level", "multiverse market range boundary metadataIsRangeLabel drifted");
  assert.deepEqual(boundary.overlapIds, [71, 72, 73, 74], "multiverse market range boundary overlapIds drifted");

  return {
    id: "multiverse-market-range-boundary",
    label: "Multiverse market range boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.validatedRowIds.length} validated row ids`,
      `${boundary.metadataIsLevels.length} recovered metadata IS levels`,
      "Validated row block and recovered IS run now share a first direct overlap at rows 71-74"
    ]
  };
}

function validateMultiverseMarketRowTextCoverage(coverage) {
  expectNonEmptyString(coverage.generatedAt, "multiverse market row text coverage generatedAt must be present");
  expectRecord(coverage.sources, "multiverse market row text coverage sources must be an object");
  ["metadata", "level0", "probe", "validatedRows"].forEach((field) => {
    expectNonEmptyString(coverage.sources[field], `multiverse market row text coverage sources.${field} must be present`);
  });
  expectArray(coverage.textHandlerAnchors, "multiverse market row text coverage textHandlerAnchors must be an array");
  expectArray(coverage.validatedRowCostTexts, "multiverse market row text coverage validatedRowCostTexts must be an array");
  expectArray(coverage.sampleBuyHooks, "multiverse market row text coverage sampleBuyHooks must be an array");
  expectArray(coverage.currentBoundary, "multiverse market row text coverage currentBoundary must be an array");

  ["TextHandlerMarkets", "SetAllChrystosEmporiumTexts"].forEach((name) => {
    assert.ok(coverage.textHandlerAnchors.includes(name), `multiverse market row text coverage missing ${name}`);
  });
  ["SetIS50CostText", "SetIS59CostText", "SetIS63CostText", "SetIS74CostText"].forEach((name) => {
    assert.ok(coverage.validatedRowCostTexts.includes(name), `multiverse market row text coverage missing ${name}`);
  });
  assert.equal(coverage.validatedRowCostTexts.length, 22, "multiverse market row text coverage should preserve 22 validated row cost texts");
  ["BuyIS50", "BuyIS74"].forEach((name) => {
    assert.ok(coverage.sampleBuyHooks.includes(name), `multiverse market row text coverage missing ${name}`);
  });

  return {
    id: "multiverse-market-row-text-coverage",
    label: "Multiverse market row text coverage",
    classification: "extracted-mechanics",
    stats: [
      `${coverage.validatedRowCostTexts.length} validated row cost texts`,
      `${coverage.textHandlerAnchors.length} text-handler anchors`,
      "Validated MultiverseMarket rows now have direct TextHandlerMarkets cost-text coverage"
    ]
  };
}

function validateTokenShopCostLanes(lanes) {
  expectNonEmptyString(lanes.generatedAt, "token shop cost lanes generatedAt must be present");
  expectRecord(lanes.sources, "token shop cost lanes sources must be an object");
  ["tokenShopExtract", "level0", "probe"].forEach((field) => {
    expectNonEmptyString(lanes.sources[field], `token shop cost lanes sources.${field} must be present`);
  });
  expectArray(lanes.tokenSpendGroups, "token shop cost lanes tokenSpendGroups must be an array");
  expectArray(lanes.dailyTokeniumModifierGroups, "token shop cost lanes dailyTokeniumModifierGroups must be an array");
  expectArray(lanes.diamondGroups, "token shop cost lanes diamondGroups must be an array");
  expectArray(lanes.playerFacingClues, "token shop cost lanes playerFacingClues must be an array");
  expectArray(lanes.currentBoundary, "token shop cost lanes currentBoundary must be an array");

  ["TokenBoost", "TokenBoostT2", "TokenBoostT3", "Tier2Token", "Tier5Token", "MK8TokenBoost"].forEach((name) => {
    assert.ok(lanes.tokenSpendGroups.includes(name), `token shop cost lanes missing ${name}`);
  });
  ["TokenDailiesT2", "TokenDailiesT3"].forEach((name) => {
    assert.ok(lanes.dailyTokeniumModifierGroups.includes(name), `token shop cost lanes missing ${name}`);
  });
  assert.deepEqual(lanes.diamondGroups, ["DiamondBoost"], "token shop cost lanes diamondGroups drifted");
  ["CostBox-Tokens", "CostBox-Tokenium", "Tokens Booster T1", "Tokens Booster T2", "Mission Materials Booster"].forEach((name) => {
    assert.ok(lanes.playerFacingClues.includes(name), `token shop cost lanes missing ${name}`);
  });

  return {
    id: "token-shop-cost-lanes",
    label: "Token shop cost lanes",
    classification: "extracted-mechanics",
    stats: [
      `${lanes.tokenSpendGroups.length} token spend groups`,
      `${lanes.dailyTokeniumModifierGroups.length} Daily Tokenium modifier groups`,
      "TokenBoost, DiamondBoost, and TokenDailies stay on separate grounded cost lanes"
    ]
  };
}

function validateSpendActionLaneClues(clues) {
  expectNonEmptyString(clues.generatedAt, "spend action lane clues generatedAt must be present");
  expectRecord(clues.sources, "spend action lane clues sources must be an object");
  ["probe", "metadata", "level0", "tokenShopExtract", "iapCatalog"].forEach((field) => {
    expectNonEmptyString(clues.sources[field], `spend action lane clues sources.${field} must be present`);
  });
  expectArray(clues.tokenDirectBuyHooks, "spend action lane clues tokenDirectBuyHooks must be an array");
  expectArray(clues.tokenHoldHooks, "spend action lane clues tokenHoldHooks must be an array");
  expectArray(clues.diamondDirectBuyHooks, "spend action lane clues diamondDirectBuyHooks must be an array");
  expectArray(clues.diamondHoldHooks, "spend action lane clues diamondHoldHooks must be an array");
  expectArray(clues.dailyTokeniumModifierHooks, "spend action lane clues dailyTokeniumModifierHooks must be an array");
  expectArray(clues.tokenSupportingShells, "spend action lane clues tokenSupportingShells must be an array");
  expectArray(clues.dailyTokeniumSupportingShells, "spend action lane clues dailyTokeniumSupportingShells must be an array");
  expectRecord(clues.searchResults, "spend action lane clues searchResults must be an object");
  expectRecord(clues.searchResults.metadata, "spend action lane clues searchResults.metadata must be an object");
  expectRecord(clues.searchResults.level0, "spend action lane clues searchResults.level0 must be an object");
  expectArray(clues.currentBoundary, "spend action lane clues currentBoundary must be an array");

  ["BuyTokenBoost", "BuyMK1TokenBoost", "BuyMK8TokenBoost"].forEach((name) => {
    assert.ok(clues.tokenDirectBuyHooks.includes(name), `spend action lane clues missing ${name}`);
  });
  ["StartTokenBoostHold", "StopTokenBoostHold"].forEach((name) => {
    assert.ok(clues.tokenHoldHooks.includes(name), `spend action lane clues missing ${name}`);
  });
  assert.deepEqual(clues.diamondDirectBuyHooks, ["BuyDiamondBoost"], "spend action lane clues diamondDirectBuyHooks drifted");
  ["StartDiamondBoostHold", "StopDiamondBoostHold"].forEach((name) => {
    assert.ok(clues.diamondHoldHooks.includes(name), `spend action lane clues missing ${name}`);
  });
  ["BuyLM244", "BuyCollectorDevice"].forEach((name) => {
    assert.ok(clues.dailyTokeniumModifierHooks.includes(name), `spend action lane clues missing ${name}`);
  });
  assert.ok(clues.tokenSupportingShells.includes("CostBox-Tokens"), "spend action lane clues missing CostBox-Tokens");
  ["CostBox-Tokenium", "Mission Materials Booster", "COLLECTERS PACK"].forEach((name) => {
    assert.ok(clues.dailyTokeniumSupportingShells.includes(name), `spend action lane clues missing ${name}`);
  });
  assert.ok(clues.searchResults.metadata.BuyTokenBoost > 0, "spend action lane clues must preserve metadata BuyTokenBoost matches");
  assert.ok(clues.searchResults.metadata.BuyDiamondBoost > 0, "spend action lane clues must preserve metadata BuyDiamondBoost matches");
  assert.ok(clues.searchResults.metadata.BuyLM244 > 0, "spend action lane clues must preserve metadata BuyLM244 matches");
  assert.ok(clues.searchResults.metadata.BuyCollectorDevice > 0, "spend action lane clues must preserve metadata BuyCollectorDevice matches");
  assert.equal(clues.searchResults.metadata.BuyTokenDailiesT2, 0, "spend action lane clues metadata BuyTokenDailiesT2 should stay unresolved");
  assert.equal(clues.searchResults.metadata.BuyTokenDailiesT3, 0, "spend action lane clues metadata BuyTokenDailiesT3 should stay unresolved");
  assert.ok(clues.searchResults.level0.BuyTokenBoost > 0, "spend action lane clues must preserve level0 BuyTokenBoost matches");
  assert.ok(clues.searchResults.level0.BuyDiamondBoost > 0, "spend action lane clues must preserve level0 BuyDiamondBoost matches");
  assert.ok(clues.searchResults.level0.BuyLM244 > 0, "spend action lane clues must preserve level0 BuyLM244 matches");
  assert.ok(clues.searchResults.level0.BuyCollectorDevice > 0, "spend action lane clues must preserve level0 BuyCollectorDevice matches");
  assert.equal(clues.searchResults.level0.BuyTokenDailiesT2, 0, "spend action lane clues level0 BuyTokenDailiesT2 should stay unresolved");
  assert.equal(clues.searchResults.level0.BuyTokenDailiesT3, 0, "spend action lane clues level0 BuyTokenDailiesT3 should stay unresolved");
  assert.ok(clues.searchResults.level0["CostBox-Tokens"] > 0, "spend action lane clues must preserve CostBox-Tokens shells");
  assert.ok(clues.searchResults.level0["CostBox-Tokenium"] > 0, "spend action lane clues must preserve CostBox-Tokenium shells");
  assert.ok(clues.searchResults.level0["Mission Materials Booster"] > 0, "spend action lane clues must preserve Mission Materials Booster shells");

  return {
    id: "spend-action-lane-clues",
    label: "Spend action lane clues",
    classification: "extracted-mechanics",
    stats: [
      `${clues.tokenDirectBuyHooks.length} token direct buy hooks`,
      `${clues.dailyTokeniumModifierHooks.length} Daily Tokenium modifier hooks`,
      "Token and diamond buy hooks stay separate from unresolved TokenDailies direct actions"
    ]
  };
}

function validateMultiverseMarketActionShell(shell) {
  expectNonEmptyString(shell.generatedAt, "multiverse market action shell generatedAt must be present");
  expectRecord(shell.sources, "multiverse market action shell sources must be an object");
  ["probe", "metadata", "validatedRows"].forEach((field) => {
    expectNonEmptyString(shell.sources[field], `multiverse market action shell sources.${field} must be present`);
  });
  expectArray(shell.textHandlerAnchors, "multiverse market action shell textHandlerAnchors must be an array");
  expectRecord(shell.contextDerivedBuyHookRange, "multiverse market action shell contextDerivedBuyHookRange must be an object");
  expectRecord(shell.contextDerivedCostTextRange, "multiverse market action shell contextDerivedCostTextRange must be an object");
  expectArray(shell.validatedBuyHookRanges, "multiverse market action shell validatedBuyHookRanges must be an array");
  expectArray(shell.validatedBuyHooks, "multiverse market action shell validatedBuyHooks must be an array");
  expectArray(shell.validatedCostTexts, "multiverse market action shell validatedCostTexts must be an array");
  expectArray(shell.currentBoundary, "multiverse market action shell currentBoundary must be an array");

  ["TextHandlerMarkets", "SetAllChrystosEmporiumTexts"].forEach((name) => {
    assert.ok(shell.textHandlerAnchors.includes(name), `multiverse market action shell missing ${name}`);
  });
  assert.equal(shell.contextDerivedBuyHookRange.start, 1, "multiverse market action shell buy range start drifted");
  assert.equal(shell.contextDerivedBuyHookRange.end, 110, "multiverse market action shell buy range end drifted");
  assert.equal(shell.contextDerivedBuyHookRange.count, 110, "multiverse market action shell buy range count drifted");
  assert.equal(shell.contextDerivedCostTextRange.start, 1, "multiverse market action shell cost-text range start drifted");
  assert.equal(shell.contextDerivedCostTextRange.end, 110, "multiverse market action shell cost-text range end drifted");
  assert.equal(shell.contextDerivedCostTextRange.count, 110, "multiverse market action shell cost-text range count drifted");
  assert.deepEqual(shell.validatedBuyHookRanges, ["50-59", "63-74"], "multiverse market action shell validatedBuyHookRanges drifted");
  ["BuyIS50", "BuyIS59", "BuyIS63", "BuyIS74"].forEach((name) => {
    assert.ok(shell.validatedBuyHooks.includes(name), `multiverse market action shell missing ${name}`);
  });
  ["SetIS50CostText", "SetIS59CostText", "SetIS63CostText", "SetIS74CostText"].forEach((name) => {
    assert.ok(shell.validatedCostTexts.includes(name), `multiverse market action shell missing ${name}`);
  });
  assert.equal(shell.validatedBuyHooks.length, 22, "multiverse market action shell should preserve 22 validated buy hooks");
  assert.equal(shell.validatedCostTexts.length, 22, "multiverse market action shell should preserve 22 validated cost texts");

  return {
    id: "multiverse-market-action-shell",
    label: "Multiverse market action shell",
    classification: "extracted-mechanics",
    stats: [
      `${shell.contextDerivedBuyHookRange.count} context-derived BuyIS hooks`,
      `${shell.validatedBuyHooks.length} validated BuyIS hooks`,
      "Broader MultiverseMarket action shell stays separate from numerically validated rows"
    ]
  };
}

function validateMultiverseMarketPrefabRemapBoundary(boundary) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market prefab remap boundary generatedAt must be present");
  expectRecord(boundary.sources, "multiverse market prefab remap boundary sources must be an object");
  expectNonEmptyString(boundary.sources.level0, "multiverse market prefab remap boundary sources.level0 must be present");
  expectNonEmptyString(boundary.sources.validatedRows, "multiverse market prefab remap boundary sources.validatedRows must be present");
  expectArray(boundary.validatedSerializedIds, "multiverse market prefab remap boundary validatedSerializedIds must be an array");
  expectArray(boundary.directPrefabNumberMatches, "multiverse market prefab remap boundary directPrefabNumberMatches must be an array");
  expectArray(boundary.explicitPrefabIdOverrides, "multiverse market prefab remap boundary explicitPrefabIdOverrides must be an array");
  expectArray(boundary.validatedIdsWithoutDirectPrefabName, "multiverse market prefab remap boundary validatedIdsWithoutDirectPrefabName must be an array");
  expectArray(boundary.overrideSerializedIdsOutsideValidatedBlock, "multiverse market prefab remap boundary overrideSerializedIdsOutsideValidatedBlock must be an array");
  expectArray(boundary.currentBoundary, "multiverse market prefab remap boundary currentBoundary must be an array");

  assert.deepEqual(
    boundary.validatedIdsWithoutDirectPrefabName,
    [69, 70, 71, 72, 73, 74],
    "multiverse market prefab remap boundary validatedIdsWithoutDirectPrefabName drifted"
  );
  assert.deepEqual(
    boundary.overrideSerializedIdsOutsideValidatedBlock,
    [60, 61, 62],
    "multiverse market prefab remap boundary overrideSerializedIdsOutsideValidatedBlock drifted"
  );
  [50, 59, 63, 68].forEach((id) => {
    assert.ok(
      boundary.directPrefabNumberMatches.includes(id),
      `multiverse market prefab remap boundary missing direct prefab match ${id}`
    );
  });
  assert.deepEqual(
    boundary.explicitPrefabIdOverrides.map((entry) => `${entry.prefabNumber}->${entry.serializedId}`),
    ["69->57", "70->58", "71->59", "72->60", "73->61", "74->62"],
    "multiverse market prefab remap boundary explicitPrefabIdOverrides drifted"
  );

  return {
    id: "multiverse-market-prefab-remap-boundary",
    label: "Multiverse market prefab remap boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.directPrefabNumberMatches.length} direct prefab-number matches`,
      `${boundary.explicitPrefabIdOverrides.length} explicit prefab-id overrides`,
      "Validated ids 69-74 still do not have direct prefab-number label matches"
    ]
  };
}

function validateMultiverseMarketOwnerFamily(family) {
  expectNonEmptyString(family.generatedAt, "multiverse market owner family generatedAt must be present");
  expectRecord(family.sources, "multiverse market owner family sources must be an object");
  ["probe", "metadata", "level0", "validatedRows"].forEach((field) => {
    expectNonEmptyString(family.sources[field], `multiverse market owner family sources.${field} must be present`);
  });
  expectArray(family.ownerAnchors, "multiverse market owner family ownerAnchors must be an array");
  expectArray(family.costLaneAnchors, "multiverse market owner family costLaneAnchors must be an array");
  expectRecord(family.currencyBoxRange, "multiverse market owner family currencyBoxRange must be an object");
  expectArray(family.validatedCurrencyBoxes, "multiverse market owner family validatedCurrencyBoxes must be an array");
  expectArray(family.sampleBuyHooks, "multiverse market owner family sampleBuyHooks must be an array");
  expectArray(family.currentBoundary, "multiverse market owner family currentBoundary must be an array");

  ["MultiverseMarket, Assembly-CSharp", "TextHandlerMarkets", "SetAllChrystosEmporiumTexts", "SetInscryptionsDoneText", "Inscryptions"].forEach((name) => {
    assert.ok(family.ownerAnchors.includes(name), `multiverse market owner family missing ${name}`);
  });
  ["ResourceAmountText.InscryptionsDone", "AchievementBar-Inscryptions", "CostBox-InscryptionsDone"].forEach((name) => {
    assert.ok(family.costLaneAnchors.includes(name), `multiverse market owner family missing ${name}`);
  });
  assert.equal(family.currencyBoxRange.start, 1, "multiverse market owner family currencyBoxRange.start drifted");
  assert.equal(family.currencyBoxRange.end, 110, "multiverse market owner family currencyBoxRange.end drifted");
  assert.equal(family.currencyBoxRange.count, 110, "multiverse market owner family currencyBoxRange.count drifted");
  ["IS50CurrencyBox", "IS59CurrencyBox", "IS63CurrencyBox", "IS74CurrencyBox"].forEach((name) => {
    assert.ok(family.validatedCurrencyBoxes.includes(name), `multiverse market owner family missing ${name}`);
  });
  ["BuyIS47", "BuyIS64", "BuyIS73", "BuyIS105"].forEach((name) => {
    assert.ok(family.sampleBuyHooks.includes(name), `multiverse market owner family missing ${name}`);
  });

  return {
    id: "multiverse-market-owner-family",
    label: "Multiverse market owner family",
    classification: "extracted-mechanics",
    stats: [
      `${family.ownerAnchors.length} owner-family anchors`,
      `${family.currencyBoxRange.count} IS*CurrencyBox shells`,
      "MultiverseMarket owner-family and cost-lane shell stay separate from save recovery"
    ]
  };
}

function validateTokenShopOwnerShell(shell) {
  expectNonEmptyString(shell.generatedAt, "token shop owner shell generatedAt must be present");
  expectRecord(shell.sources, "token shop owner shell sources must be an object");
  ["probe", "metadata", "level0"].forEach((field) => {
    expectNonEmptyString(shell.sources[field], `token shop owner shell sources.${field} must be present`);
  });
  expectArray(shell.ownerAnchors, "token shop owner shell ownerAnchors must be an array");
  expectArray(shell.tokenBankMethods, "token shop owner shell tokenBankMethods must be an array");
  expectArray(shell.notificationHooks, "token shop owner shell notificationHooks must be an array");
  expectArray(shell.adjacentDeviceHooks, "token shop owner shell adjacentDeviceHooks must be an array");
  expectArray(shell.uiShells, "token shop owner shell uiShells must be an array");
  expectRecord(shell.sourcePresence, "token shop owner shell sourcePresence must be an object");
  expectRecord(shell.sourcePresence.metadata, "token shop owner shell sourcePresence.metadata must be an object");
  expectRecord(shell.sourcePresence.level0, "token shop owner shell sourcePresence.level0 must be an object");
  expectArray(shell.currentBoundary, "token shop owner shell currentBoundary must be an array");

  ["TokenShop", "InitializeTokenShop", "SetAllTokenShopTexts"].forEach((name) => {
    assert.ok(shell.ownerAnchors.includes(name), `token shop owner shell missing ${name}`);
  });
  ["get_TokenBankCap", "get_ClaimableBankTokens", "IncreaseBankedTokens", "ClaimBankedTokens", "SetBankFill"].forEach((name) => {
    assert.ok(shell.tokenBankMethods.includes(name), `token shop owner shell missing ${name}`);
  });
  ["CheckTokenClaimNotification", "TokenShopButtonNotification", "BankedDescriptionTextIncrease"].forEach((name) => {
    assert.ok(shell.notificationHooks.includes(name), `token shop owner shell missing ${name}`);
  });
  ["BuyAutoTokenClicker", "BuyAutoDiamondClicker", "BuyChestSpeedster"].forEach((name) => {
    assert.ok(shell.adjacentDeviceHooks.includes(name), `token shop owner shell missing ${name}`);
  });
  ["TokenBankDescriptionText", "TokenShopCanvas", "TokenShopMenu", "TokenShopOverlay", "TokenShopRecoloring"].forEach((name) => {
    assert.ok(shell.uiShells.includes(name), `token shop owner shell missing ${name}`);
  });
  ["TokenShop", "get_TokenBankCap", "get_ClaimableBankTokens", "IncreaseBankedTokens", "ClaimBankedTokens", "CheckTokenClaimNotification", "TokenShopButtonNotification", "BankedDescriptionTextIncrease", "BuyAutoTokenClicker", "BuyAutoDiamondClicker", "BuyChestSpeedster"].forEach((name) => {
    assert.equal(shell.sourcePresence.metadata[name], 1, `token shop owner shell metadata presence drifted for ${name}`);
  });
  ["TokenShop", "ClaimBankedTokens", "BankedDescriptionTextIncrease", "BuyAutoTokenClicker", "BuyAutoDiamondClicker", "BuyChestSpeedster"].forEach((name) => {
    assert.equal(shell.sourcePresence.level0[name], 1, `token shop owner shell level0 presence drifted for ${name}`);
  });

  return {
    id: "token-shop-owner-shell",
    label: "Token shop owner shell",
    classification: "extracted-mechanics",
    stats: [
      `${shell.tokenBankMethods.length} token-bank methods`,
      `${shell.adjacentDeviceHooks.length} adjacent device hooks`,
      "TokenShop owner shell keeps bank controls separate from unresolved save ownership"
    ]
  };
}

function validateTokenShopSaveBoundary(boundary) {
  expectNonEmptyString(boundary.generatedAt, "token shop save boundary generatedAt must be present");
  expectRecord(boundary.sources, "token shop save boundary sources must be an object");
  ["probe", "metadata", "level0"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `token shop save boundary sources.${field} must be present`);
  });
  expectArray(boundary.ownerShellTermsChecked, "token shop save boundary ownerShellTermsChecked must be an array");
  expectArray(boundary.saveFamilyTermsChecked, "token shop save boundary saveFamilyTermsChecked must be an array");
  expectRecord(boundary.probeResults, "token shop save boundary probeResults must be an object");
  expectArray(boundary.currentBoundary, "token shop save boundary currentBoundary must be an array");

  ["TokenShop", "InitializeTokenShop", "ClaimBankedTokens", "BuyAutoTokenClicker"].forEach((name) => {
    assert.ok(boundary.ownerShellTermsChecked.includes(name), `token shop save boundary missing ${name}`);
  });
  ["PlayerProfileData", "GetPlayerProfileData", "FillPlayerProfileData", "CloudSavePlayerProfile"].forEach((name) => {
    assert.ok(boundary.saveFamilyTermsChecked.includes(name), `token shop save boundary missing ${name}`);
  });
  assert.equal(boundary.probeResults.metadataHasSaveTerms, true, "token shop save boundary metadataHasSaveTerms drifted");
  assert.equal(boundary.probeResults.level0HasSaveTerms, false, "token shop save boundary level0HasSaveTerms drifted");
  assert.equal(boundary.probeResults.ownerShellWithSaveOverlapCount, 0, "token shop save boundary overlap count drifted");
  assert.equal(boundary.probeResults.directTokenShopPlayerProfileContext, false, "token shop save boundary directTokenShopPlayerProfileContext drifted");

  return {
    id: "token-shop-save-boundary",
    label: "Token shop save boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.ownerShellTermsChecked.length} owner-shell terms checked`,
      `${boundary.saveFamilyTermsChecked.length} save-family terms checked`,
      "TokenShop owner shell still stays separate from recovered save-family clues"
    ]
  };
}

function validateTokenShopRowLevelOwner(boundary) {
  expectNonEmptyString(boundary.generatedAt, "token shop row-level owner generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "token shop row-level owner dataset must be present");
  expectRecord(boundary.sources, "token shop row-level owner sources must be an object");
  ["uabeaProbe", "tokenShopExtract", "metadata", "level0"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `token shop row-level owner sources.${field} must be present`);
  });
  expectRecord(boundary.typedSaveDataFieldTableRecovery, "token shop row-level owner typedSaveDataFieldTableRecovery must be an object");
  expectRecord(boundary.tokenShopRowLevelFamily, "token shop row-level owner tokenShopRowLevelFamily must be an object");
  expectRecord(boundary.compatibilityImportBoundary, "token shop row-level owner compatibilityImportBoundary must be an object");
  expectArray(boundary.tokenShopRowLevelFamily.saveFieldSamples, "token shop row-level owner saveFieldSamples must be an array");
  expectArray(boundary.tokenShopRowLevelFamily.adjacentSaveFields, "token shop row-level owner adjacentSaveFields must be an array");
  expectArray(boundary.tokenShopRowLevelFamily.groundedTokenShopNumericSamples, "token shop row-level owner groundedTokenShopNumericSamples must be an array");
  expectArray(boundary.compatibilityImportBoundary.safeImportSubset, "token shop row-level owner safeImportSubset must be an array");
  expectArray(boundary.compatibilityImportBoundary.blockedCanonicalPromotionBy, "token shop row-level owner blockedCanonicalPromotionBy must be an array");
  expectArray(boundary.currentBoundary, "token shop row-level owner currentBoundary must be an array");

  assert.equal(boundary.dataset, "token-shop-row-level-owner", "token shop row-level owner dataset id drifted");
  assert.equal(boundary.typedSaveDataFieldTableRecovery.fieldOwner, "SaveData", "token shop row-level owner typed field owner drifted");
  assert.equal(boundary.typedSaveDataFieldTableRecovery.fieldCount, 4461, "token shop row-level owner SaveData field count drifted");
  assert.equal(boundary.typedSaveDataFieldTableRecovery.methodCount, 1, "token shop row-level owner SaveData method count drifted");
  assert.equal(boundary.tokenShopRowLevelFamily.saveFieldRange, "ATU1Level through ATU28Level", "token shop row-level owner save field range drifted");
  ["ATU1Level", "ATU14Level", "ATU24Level", "ATU28Level"].forEach((name) => {
    assert.ok(boundary.tokenShopRowLevelFamily.saveFieldSamples.includes(name), `token shop row-level owner missing save field sample ${name}`);
  });
  ["BankedTokens", "Tier2TokensUnlocked", "Tier3TokensUnlocked", "Tier4TokensUnlocked", "Tier5TokensUnlocked"].forEach((name) => {
    assert.ok(boundary.tokenShopRowLevelFamily.adjacentSaveFields.includes(name), `token shop row-level owner missing adjacent save field ${name}`);
  });
  assert.equal(boundary.tokenShopRowLevelFamily.groundedTokenShopFieldRange, "ATU1Button through ATU28MaxOverlay", "token shop row-level owner grounded field range drifted");
  ["ATU24StartCost", "ATU25MaxLevel", "ATU26Fill", "ATU28Bonus"].forEach((name) => {
    assert.ok(boundary.tokenShopRowLevelFamily.groundedTokenShopNumericSamples.includes(name), `token shop row-level owner missing grounded numeric sample ${name}`);
  });
  assert.equal(boundary.compatibilityImportBoundary.targetPath, "compatibility.unmappedSystemState.tokenShop", "token shop row-level owner target path drifted");
  ["ATU1Level through ATU28Level", "Tier2TokensUnlocked", "Tier3TokensUnlocked", "Tier4TokensUnlocked", "Tier5TokensUnlocked"].forEach((name) => {
    assert.ok(boundary.compatibilityImportBoundary.safeImportSubset.includes(name), `token shop row-level owner missing safe import subset ${name}`);
  });
  assert.ok(boundary.compatibilityImportBoundary.blockedCanonicalPromotionBy.some((line) => /row-by-row remap/i.test(line)), "token shop row-level owner must preserve remap blocker");
  assert.ok(boundary.currentBoundary.some((line) => /SaveData directly declares BankedTokens plus ATU1Level through ATU28Level/i.test(line)), "token shop row-level owner must preserve SaveData declaring-owner conclusion");
  assert.ok(boundary.currentBoundary.some((line) => /same ATU numbering family/i.test(line)), "token shop row-level owner must preserve shared ATU numbering-family conclusion");
  assert.ok(boundary.currentBoundary.some((line) => /not yet enough to promote those raw ATU fields into canonical playerProfile state/i.test(line)), "token shop row-level owner must preserve canonical-blocked conclusion");

  return {
    id: "token-shop-row-level-owner",
    label: "Token shop row-level owner",
    classification: "extracted-mechanics",
    stats: [
      boundary.tokenShopRowLevelFamily.saveFieldRange,
      `${boundary.compatibilityImportBoundary.safeImportSubset.length} compatibility-safe raw field groups`,
      "SaveData now anchors raw TokenShop ATU row levels while canonical promotion stays blocked on row remap"
    ]
  };
}

function validateTokenShopRowRemapBoundary(boundary) {
  expectNonEmptyString(boundary.generatedAt, "token shop row remap boundary generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "token shop row remap boundary dataset must be present");
  expectRecord(boundary.sources, "token shop row remap boundary sources must be an object");
  ["tokenShopExtract", "uabeaProbe", "unityProbe", "dailyTokeniumLaneProbe"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `token shop row remap boundary sources.${field} must be present`);
  });
  expectRecord(boundary.rawSaveFamily, "token shop row remap boundary rawSaveFamily must be an object");
  expectRecord(boundary.groundedNonLabelClues, "token shop row remap boundary groundedNonLabelClues must be an object");
  expectRecord(boundary.recoveredBridge, "token shop row remap boundary recoveredBridge must be an object");
  expectRecord(boundary.adjacentFollowUp, "token shop row remap boundary adjacentFollowUp must be an object");
  expectRecord(boundary.blockedIdentityJoin, "token shop row remap boundary blockedIdentityJoin must be an object");
  expectArray(boundary.groundedNonLabelClues.effectHookSamples, "token shop row remap boundary effectHookSamples must be an array");
  expectArray(boundary.groundedNonLabelClues.prefabRosterSamples, "token shop row remap boundary prefabRosterSamples must be an array");
  expectArray(boundary.groundedNonLabelClues.playerFacingStringSamples, "token shop row remap boundary playerFacingStringSamples must be an array");
  expectArray(boundary.groundedNonLabelClues.directBuyHookSamples, "token shop row remap boundary directBuyHookSamples must be an array");
  expectArray(boundary.blockedIdentityJoin.missingLinks, "token shop row remap boundary missingLinks must be an array");
  expectArray(boundary.blockedIdentityJoin.unsafeInferenceSources, "token shop row remap boundary unsafeInferenceSources must be an array");
  expectArray(boundary.currentBoundary, "token shop row remap boundary currentBoundary must be an array");

  assert.equal(boundary.dataset, "token-shop-row-remap-boundary", "token shop row remap boundary dataset id drifted");
  assert.equal(boundary.rawSaveFamily.fieldRange, "ATU1Level through ATU28Level", "token shop row remap boundary field range drifted");
  assert.equal(boundary.rawSaveFamily.owner, "SaveData", "token shop row remap boundary owner drifted");
  assert.equal(boundary.rawSaveFamily.groundedOwnerPayloadRange, "ATU1Button through ATU28MaxOverlay", "token shop row remap boundary grounded owner payload range drifted");
  assert.equal(boundary.recoveredBridge.shellField, "ATU2Button", "token shop row remap boundary recovered bridge shell drifted");
  assert.equal(boundary.recoveredBridge.shellPathId, 15804, "token shop row remap boundary recovered bridge shell path drifted");
  assert.deepEqual(
    boundary.recoveredBridge.ownerFieldBlock,
    [
      "DiamondBoostStartCost",
      "DiamondBoostAdditiveCost",
      "DiamondBoostBonus",
      "DiamondBoostMaxLevel",
      "DiamondBoostFill"
    ],
    "token shop row remap boundary recovered bridge owner field block drifted"
  );
  assert.equal(boundary.recoveredBridge.supportingEffectHook, "ATU2DiamondsBonus", "token shop row remap boundary recovered bridge effect hook drifted");
  assert.equal(boundary.recoveredBridge.prefabIdentity, "NewTokenUPGPrefab.T1.DiamondBoost", "token shop row remap boundary recovered bridge prefab drifted");
  assert.match(boundary.recoveredBridge.groundedConclusion, /ATU2Button now has one checked bridge to NewTokenUPGPrefab\.T1\.DiamondBoost/i, "token shop row remap boundary recovered bridge conclusion drifted");
  assert.deepEqual(boundary.adjacentFollowUp.testedNeighbors, ["ATU1Button", "ATU3Button"], "token shop row remap boundary tested neighbor set drifted");
  assert.equal(boundary.adjacentFollowUp.recoveredAdditionalBridge.shellField, "ATU1Button", "token shop row remap boundary adjacent recovered bridge shell drifted");
  assert.equal(boundary.adjacentFollowUp.recoveredAdditionalBridge.shellPathId, 15839, "token shop row remap boundary adjacent recovered bridge shell path drifted");
  assert.equal(boundary.adjacentFollowUp.recoveredAdditionalBridge.supportingEffectHook, "ATU1TokenBonus", "token shop row remap boundary adjacent recovered bridge effect hook drifted");
  assert.equal(boundary.adjacentFollowUp.recoveredAdditionalBridge.supportingActionHook, "BuyTokenBoost", "token shop row remap boundary adjacent recovered bridge action hook drifted");
  assert.equal(boundary.adjacentFollowUp.recoveredAdditionalBridge.prefabIdentity, "NewTokenUPGPrefab.T1.TokensBoost", "token shop row remap boundary adjacent recovered bridge prefab drifted");
  assert.equal(boundary.adjacentFollowUp.blockedAdjacentShell.shellField, "ATU3Button", "token shop row remap boundary blocked adjacent shell drifted");
  assert.equal(boundary.adjacentFollowUp.blockedAdjacentShell.shellPathId, 15810, "token shop row remap boundary blocked adjacent shell path drifted");
  assert.equal(boundary.adjacentFollowUp.blockedAdjacentShell.nearestNamedActionHook, "BuyCellBoost", "token shop row remap boundary blocked adjacent named action drifted");
  assert.equal(boundary.adjacentFollowUp.blockedAdjacentShell.splitCellIdentitySurfaces.diamondSpecialPrefab, "NewDiamondUPGPrefab.Specials.CellsBoost", "token shop row remap boundary blocked adjacent diamond special prefab drifted");
  assert.equal(boundary.adjacentFollowUp.blockedAdjacentShell.splitCellIdentitySurfaces.diamondSpecialTitle, ">Diamond Upgrade 10 - CellsBoost", "token shop row remap boundary blocked adjacent diamond special title drifted");
  assert.deepEqual(
    boundary.adjacentFollowUp.blockedAdjacentShell.splitCellIdentitySurfaces.tokenPrefabCandidates,
    ["NewTokenUPGPrefab.T1.CellsPerChestBooster", "NewTokenUPGPrefab.T5.UltimaCells"],
    "token shop row remap boundary blocked adjacent token prefab candidates drifted"
  );
  assert.equal(boundary.adjacentFollowUp.blockedAdjacentShell.splitCellIdentitySurfaces.tokenTitleCandidate, "Token Ultima: Cells", "token shop row remap boundary blocked adjacent token title candidate drifted");
  assert.match(boundary.adjacentFollowUp.blockedAdjacentShell.groundedConclusion, /ATU3Button does not yet clear/i, "token shop row remap boundary blocked adjacent conclusion drifted");
  assert.equal(boundary.adjacentFollowUp.result, "one more grounded bridge recovered", "token shop row remap boundary adjacent follow-up result drifted");
  ["ATU1TokenBonus", "ATU2DiamondsBonus", "ATU14TokenDailiesBonus", "ATU24Bonus3Shards"].forEach((name) => {
    assert.ok(boundary.groundedNonLabelClues.effectHookSamples.includes(name), `token shop row remap boundary missing effect hook sample ${name}`);
  });
  ["NewTokenUPGPrefab.T1.TokensBoost", "NewTokenUPGPrefab.T4.Ultima", "NewTokenUPGPrefab.T5.CampaignFragments"].forEach((name) => {
    assert.ok(boundary.groundedNonLabelClues.prefabRosterSamples.includes(name), `token shop row remap boundary missing prefab roster sample ${name}`);
  });
  ["Tokens Booster T2", "Duo Booster Four", "Trinity Booster One", "Tokens Booster T3"].forEach((name) => {
    assert.ok(boundary.groundedNonLabelClues.playerFacingStringSamples.includes(name), `token shop row remap boundary missing player-facing string sample ${name}`);
  });
  ["BuyATU24", "BuyATU25", "BuyATU26", "BuyATU27", "BuyATU28"].forEach((name) => {
    assert.ok(boundary.groundedNonLabelClues.directBuyHookSamples.includes(name), `token shop row remap boundary missing direct buy hook sample ${name}`);
  });
  assert.ok(boundary.blockedIdentityJoin.missingLinks.some((line) => /remaining ATU\*Button or ATU\*Content/i.test(line)), "token shop row remap boundary must preserve narrowed remaining ATU button join blocker");
  ["row-order similarity alone", "OR_* labels", "community naming", "prefab-only naming without a checked object join"].forEach((name) => {
    assert.ok(boundary.blockedIdentityJoin.unsafeInferenceSources.includes(name), `token shop row remap boundary missing unsafe inference source ${name}`);
  });
  assert.ok(boundary.currentBoundary.some((line) => /ATU2Button aligns directly with the DiamondBoost owner-field block/i.test(line)), "token shop row remap boundary must preserve recovered ATU2 bridge conclusion");
  assert.ok(boundary.currentBoundary.some((line) => /remaining ATU number/i.test(line)), "token shop row remap boundary must preserve blocked identity conclusion for remaining rows");

  return {
    id: "token-shop-row-remap-boundary",
    label: "Token shop row remap boundary",
    classification: "extracted-mechanics",
    stats: [
      boundary.rawSaveFamily.fieldRange,
      `${boundary.groundedNonLabelClues.effectHookSamples.length} grounded non-label effect clues`,
      "Two ATU bridges are recovered; adjacency still does not generalize"
    ]
  };
}

function validateMultiverseMarketSaveBoundary(boundary) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market save boundary generatedAt must be present");
  expectRecord(boundary.sources, "multiverse market save boundary sources must be an object");
  ["actionShellProbe", "metadataNeighborhood", "metadata", "level0"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market save boundary sources.${field} must be present`);
  });
  expectArray(boundary.actionShellTermsChecked, "multiverse market save boundary actionShellTermsChecked must be an array");
  expectArray(boundary.saveFamilyTermsChecked, "multiverse market save boundary saveFamilyTermsChecked must be an array");
  expectRecord(boundary.probeResults, "multiverse market save boundary probeResults must be an object");
  expectArray(boundary.currentBoundary, "multiverse market save boundary currentBoundary must be an array");

  ["TextHandlerMarkets", "SetAllChrystosEmporiumTexts", "SetInscryptionsDoneText"].forEach((name) => {
    assert.ok(boundary.actionShellTermsChecked.includes(name), `multiverse market save boundary missing ${name}`);
  });
  ["PlayerProfileData", "GetPlayerProfileData", "FillPlayerProfileData", "CloudSavePlayerProfile"].forEach((name) => {
    assert.ok(boundary.saveFamilyTermsChecked.includes(name), `multiverse market save boundary missing ${name}`);
  });
  assert.equal(boundary.probeResults.actionShellWithSaveOverlapCount, 0, "multiverse market save boundary overlap count drifted");
  assert.equal(boundary.probeResults.metadataNeighborhoodHasActionTerms, true, "multiverse market save boundary metadataNeighborhoodHasActionTerms drifted");
  assert.equal(boundary.probeResults.metadataNeighborhoodHasSaveTerms, true, "multiverse market save boundary metadataNeighborhoodHasSaveTerms drifted");
  assert.equal(boundary.probeResults.metadataProbeHasSaveTerms, false, "multiverse market save boundary metadataProbeHasSaveTerms drifted");
  assert.equal(boundary.probeResults.level0ProbeHasSaveTerms, false, "multiverse market save boundary level0ProbeHasSaveTerms drifted");
  expectRecord(boundary.crossBoundaryTypedOwnerStatus, "multiverse market save boundary crossBoundaryTypedOwnerStatus must be an object");
  assert.equal(boundary.crossBoundaryTypedOwnerStatus.status, "declaring-owner-closed-market-wrapper-still-unresolved", "multiverse market save boundary cross-boundary typed owner status drifted");
  assert.equal(boundary.crossBoundaryTypedOwnerStatus.exactDeclaringOwner, "SaveData", "multiverse market save boundary exact declaring owner drifted");
  assert.match(boundary.crossBoundaryTypedOwnerStatus.scope, /InscryptionsDone/i, "multiverse market save boundary typed owner scope must preserve InscryptionsDone");
  assert.match(boundary.crossBoundaryTypedOwnerStatus.scope, /IS\*Level/, "multiverse market save boundary typed owner scope must preserve the IS*Level cluster");
  assert.match(boundary.crossBoundaryTypedOwnerStatus.scope, /typed Market-wrapper recovery only/i, "multiverse market save boundary typed owner scope must preserve the narrowed remaining seam");
  assert.match(boundary.crossBoundaryTypedOwnerStatus.note, /does not recover a typed Market field/i, "multiverse market save boundary typed owner note must preserve the typed Market-field blocker");
  assert.match(boundary.crossBoundaryTypedOwnerStatus.note, /PlayerProfileData\.InscryptionsDone:System\.String/i, "multiverse market save boundary typed owner note must preserve the PlayerProfileData InscryptionsDone type");
  assert.match(boundary.crossBoundaryTypedOwnerStatus.note, /SaveData\.InscryptionsDone:System\.Int32/i, "multiverse market save boundary typed owner note must preserve the SaveData InscryptionsDone type");

  return {
    id: "multiverse-market-save-boundary",
    label: "Multiverse market save boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.actionShellTermsChecked.length} action-shell terms checked`,
      `${boundary.saveFamilyTermsChecked.length} save-family terms checked`,
      "MultiverseMarket action shell still stays separate from recovered save-family clues"
    ]
  };
}

function validateMultiverseMarketMarketMemberBoundary(boundary) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market market-member boundary generatedAt must be present");
  expectRecord(boundary.sources, "multiverse market market-member boundary sources must be an object");
  ["probeScript", "metadataNeighborhood", "typedProbeReport", "metadata", "nativeBinary"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market market-member boundary sources.${field} must be present`);
  });
  expectArray(boundary.playerProfileAccessorClues, "multiverse market market-member boundary playerProfileAccessorClues must be an array");
  expectArray(boundary.playerProfileMemberShellClues, "multiverse market market-member boundary playerProfileMemberShellClues must be an array");
  expectArray(boundary.playerProfileHandlerBridgeClues, "multiverse market market-member boundary playerProfileHandlerBridgeClues must be an array");
  expectArray(boundary.directMemberHandoffClues, "multiverse market market-member boundary directMemberHandoffClues must be an array");
  expectArray(boundary.typedSiblingContrastClues, "multiverse market market-member boundary typedSiblingContrastClues must be an array");
  expectArray(boundary.cloudSaveBridgeClues, "multiverse market market-member boundary cloudSaveBridgeClues must be an array");
  expectArray(boundary.missingDirectTypeMapClues, "multiverse market market-member boundary missingDirectTypeMapClues must be an array");
  expectArray(boundary.marketWrapperTypeClues, "multiverse market market-member boundary marketWrapperTypeClues must be an array");
  expectRecord(boundary.typedBridgeRecovery, "multiverse market market-member boundary typedBridgeRecovery must be an object");
  expectRecord(boundary.typedHandlerFieldRecovery, "multiverse market market-member boundary typedHandlerFieldRecovery must be an object");
  expectRecord(boundary.typedProfileConversionRecovery, "multiverse market market-member boundary typed profile conversion recovery must be an object");
  expectRecord(boundary.typedPlayerProfileFieldTableRecovery, "multiverse market market-member boundary typedPlayerProfileFieldTableRecovery must be an object");
  expectRecord(boundary.typedSaveDataFieldTableRecovery, "multiverse market market-member boundary typedSaveDataFieldTableRecovery must be an object");
  expectArray(boundary.directPlayerProfileFieldSamples, "multiverse market market-member boundary directPlayerProfileFieldSamples must be an array");
  expectRecord(boundary.typedInscryptionsDoneDualDeclaration, "multiverse market market-member boundary typedInscryptionsDoneDualDeclaration must be an object");
  expectArray(boundary.typedSaveDataProgressionOwnerSamples, "multiverse market market-member boundary typedSaveDataProgressionOwnerSamples must be an array");
  expectArray(boundary.typedPlayerProfileNestedTypeChecks, "multiverse market market-member boundary typedPlayerProfileNestedTypeChecks must be an array");
  expectArray(boundary.firstNestedMarketTypeChecks, "multiverse market market-member boundary firstNestedMarketTypeChecks must be an array");
  expectArray(boundary.firstNestedMarketFieldSamples, "multiverse market market-member boundary firstNestedMarketFieldSamples must be an array");
  expectArray(boundary.negativeProgressionOwnerChecks, "multiverse market market-member boundary negativeProgressionOwnerChecks must be an array");
  expectArray(boundary.negativeTypedDirectPlayerProfileProgressionChecks, "multiverse market market-member boundary negativeTypedDirectPlayerProfileProgressionChecks must be an array");
  expectArray(boundary.negativeTypedDirectMemberChecks, "multiverse market market-member boundary negativeTypedDirectMemberChecks must be an array");
  expectArray(boundary.negativeTypedSaveDataMarketChecks, "multiverse market market-member boundary negativeTypedSaveDataMarketChecks must be an array");
  expectRecord(boundary.typedMarketFieldBoundary, "multiverse market market-member boundary typedMarketFieldBoundary must be an object");
  expectRecord(boundary.deeperMarketOwnerStatus, "multiverse market market-member boundary deeperMarketOwnerStatus must be an object");
  expectArray(boundary.progressionPayloadFieldClues, "multiverse market market-member boundary progressionPayloadFieldClues must be an array");
  expectArray(boundary.currentBoundary, "multiverse market market-member boundary currentBoundary must be an array");

  ["get_Market", "get_BM", "get_ZN", "get_TU", "get_ShardData", "get_ResearchPointData", "get_AcademyPointData"].forEach((name) => {
    assert.ok(boundary.playerProfileAccessorClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });
  ["Market", "Relics", "CellData", "ModPointData", "ShardData", "ResearchPointData", "AcademyPointData", "BlueprintsThisTR"].forEach((name) => {
    assert.ok(boundary.playerProfileMemberShellClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });
  ["PlayerProfileHandler", "playerData", "GetPlayerProfileData", "FillPlayerProfileData", "ConvertSaveDataToProfileData"].forEach((name) => {
    assert.ok(boundary.playerProfileHandlerBridgeClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });
  ["get_Market", "Market", "GetPlayerProfileData", "FillPlayerProfileData", "<FillPlayerProfileData>d__45"].forEach((name) => {
    assert.ok(boundary.directMemberHandoffClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });
  ["PlayerProfileData|GemData", "PlayerProfileData|GemNodeCombo"].forEach((name) => {
    assert.ok(boundary.typedSiblingContrastClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });
  ["CloudSavePlayerProfile", "GetCurrentSaveFileInfo", "GetPlayerProfileInfo", "CloudLoad"].forEach((name) => {
    assert.ok(boundary.cloudSaveBridgeClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });
  ["PlayerProfileData|Market", "PlayerProfileData|Inscryption", "PlayerProfileData|MultiverseMarket"].forEach((name) => {
    assert.ok(boundary.missingDirectTypeMapClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });
  ["MultiverseMarket", "MultiverseMarket|InscryptionTupleObject", "MultiverseMarket|Inscryption", "NecrumExchange", "OuroborosResetter", "TraitSpheres", "ZeimarrNautallium", "ResearchLaboratory", "ResearchUltimas", "RewardLanes", "ShardMining"].forEach((name) => {
    assert.ok(boundary.marketWrapperTypeClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });
  assert.equal(boundary.typedBridgeRecovery.bridgeOwner, "PlayerProfileHandler", "multiverse market market-member boundary typed bridge owner drifted");
  assert.equal(boundary.typedBridgeRecovery.bridgeAccessor, "get_Market", "multiverse market market-member boundary typed bridge accessor drifted");
  assert.equal(boundary.typedBridgeRecovery.bridgeReturnType, "MultiverseMarket", "multiverse market market-member boundary typed bridge return type drifted");
  assert.equal(boundary.typedHandlerFieldRecovery.fieldOwner, "PlayerProfileHandler", "multiverse market market-member boundary typed handler field owner drifted");
  assert.equal(boundary.typedHandlerFieldRecovery.fieldName, "saveInfoCache", "multiverse market market-member boundary typed handler field name drifted");
  assert.equal(boundary.typedHandlerFieldRecovery.fieldType, "PlayerProfileData", "multiverse market market-member boundary typed handler field type drifted");
  assert.equal(boundary.typedProfileConversionRecovery.bridgeOwner, "PlayerProfileHandler", "multiverse market market-member boundary typed profile conversion owner drifted");
  assert.equal(boundary.typedProfileConversionRecovery.bridgeMethod, "ConvertSaveDataToProfileData", "multiverse market market-member boundary typed profile conversion method drifted");
  assert.equal(boundary.typedProfileConversionRecovery.sourceType, "SaveData", "multiverse market market-member boundary typed profile conversion source type drifted");
  assert.equal(boundary.typedProfileConversionRecovery.returnType, "PlayerProfileData", "multiverse market market-member boundary typed profile conversion return type drifted");
  assert.equal(boundary.typedProfileConversionRecovery.extraParameterType, "System.DateTime", "multiverse market market-member boundary typed profile conversion extra parameter type drifted");
  assert.equal(boundary.typedPlayerProfileFieldTableRecovery.fieldOwner, "PlayerProfileData", "multiverse market market-member boundary typed PlayerProfile field-table owner drifted");
  assert.equal(boundary.typedPlayerProfileFieldTableRecovery.fieldCount, 89, "multiverse market market-member boundary typed PlayerProfile field-count drifted");
  assert.equal(boundary.typedPlayerProfileFieldTableRecovery.methodCount, 1, "multiverse market market-member boundary typed PlayerProfile method-count drifted");
  assert.equal(boundary.typedSaveDataFieldTableRecovery.fieldOwner, "SaveData", "multiverse market market-member boundary typed SaveData field-table owner drifted");
  assert.equal(boundary.typedSaveDataFieldTableRecovery.fieldCount, 4461, "multiverse market market-member boundary typed SaveData field-count drifted");
  assert.equal(boundary.typedSaveDataFieldTableRecovery.methodCount, 1, "multiverse market market-member boundary typed SaveData method-count drifted");
  ["InscryptionsDone", "MechsOwned", "GadgetLevels"].forEach((name) => {
    assert.ok(boundary.directPlayerProfileFieldSamples.includes(name), `multiverse market market-member boundary missing direct PlayerProfileData field sample ${name}`);
  });
  assert.deepEqual(
    boundary.typedInscryptionsDoneDualDeclaration,
    {
      playerProfileData: {
        fieldOwner: "PlayerProfileData",
        fieldName: "InscryptionsDone",
        fieldType: "System.String",
        fieldIndex: 62
      },
      saveData: {
        fieldOwner: "SaveData",
        fieldName: "InscryptionsDone",
        fieldType: "System.Int32",
        fieldIndex: 3038
      }
    },
    "multiverse market market-member boundary typed InscryptionsDone dual declaration drifted"
  );
  ["IS71Level", "IS110Level", "InscryptionsDone", "EsotericR1Trades", "NecrumR1Trades", "Mech1Unlocked", "Mech1MissionsCompleted"].forEach((name) => {
    assert.ok(boundary.typedSaveDataProgressionOwnerSamples.includes(name), `multiverse market market-member boundary missing typed SaveData progression-owner sample ${name}`);
  });
  assert.deepEqual(boundary.typedPlayerProfileNestedTypeChecks, ["PlayerProfileData+GemData"], "multiverse market market-member boundary typed PlayerProfile nested-type checks drifted");
  ["MultiverseMarket|Inscryption", "MultiverseMarket|InscryptionTupleObject"].forEach((name) => {
    assert.ok(boundary.firstNestedMarketTypeChecks.includes(name), `multiverse market market-member boundary missing first nested market type check ${name}`);
  });
  ["<ID>k__BackingField", "<Cost>k__BackingField", "<Level>k__BackingField", "<MaxLevel>k__BackingField", "<ISObject>k__BackingField", "transform"].forEach((name) => {
    assert.ok(boundary.firstNestedMarketFieldSamples.includes(name), `multiverse market market-member boundary missing first nested market field sample ${name}`);
  });
  ["IS71Level", "IS110Level", "EsotericR1Trades", "NecrumR1Trades", "Mech1Unlocked", "Mech1MissionsCompleted"].forEach((name) => {
    assert.ok(boundary.negativeProgressionOwnerChecks.includes(name), `multiverse market market-member boundary missing negative owner check ${name}`);
  });
  ["PlayerProfileData.IS71Level", "PlayerProfileData.IS110Level", "PlayerProfileData.EsotericR1Trades", "PlayerProfileData.NecrumR1Trades", "PlayerProfileData.Mech1Unlocked", "PlayerProfileData.Mech1MissionsCompleted"].forEach((name) => {
    assert.ok(boundary.negativeTypedDirectPlayerProfileProgressionChecks.includes(name), `multiverse market market-member boundary missing negative typed PlayerProfile progression check ${name}`);
  });
  ["PlayerProfileHandler.Market", "PlayerProfileData.Market", "PlayerProfileData.MultiverseMarket", "MultiverseMarket.InscryptionsDone", "MultiverseMarket.IS71Level", "MultiverseMarket.IS110Level", "MultiverseMarket.EsotericR1Trades", "MultiverseMarket.NecrumR1Trades", "MultiverseMarket.Mech1Unlocked", "MultiverseMarket.Mech1MissionsCompleted"].forEach((name) => {
    assert.ok(boundary.negativeTypedDirectMemberChecks.includes(name), `multiverse market market-member boundary missing negative typed direct-member check ${name}`);
  });
  ["SaveData.Market", "SaveData.MultiverseMarket"].forEach((name) => {
    assert.ok(boundary.negativeTypedSaveDataMarketChecks.includes(name), `multiverse market market-member boundary missing negative typed SaveData market check ${name}`);
  });
  assert.equal(boundary.typedMarketFieldBoundary.checkedAccessorBridge, "PlayerProfileHandler.get_Market -> MultiverseMarket", "multiverse market market-member boundary checked accessor bridge drifted");
  assert.equal(boundary.typedMarketFieldBoundary.metadataMemberShell, "Market", "multiverse market market-member boundary metadata member shell drifted");
  assert.deepEqual(boundary.typedMarketFieldBoundary.checkedTypedFieldOwners, ["PlayerProfileHandler", "PlayerProfileData", "SaveData"], "multiverse market market-member boundary checked typed field owners drifted");
  assert.deepEqual(boundary.typedMarketFieldBoundary.checkedNegativeTypedFieldRecoveries, ["PlayerProfileHandler.Market", "PlayerProfileData.Market", "PlayerProfileData.MultiverseMarket", "SaveData.Market", "SaveData.MultiverseMarket"], "multiverse market market-member boundary checked negative typed field recoveries drifted");
  assert.equal(boundary.typedMarketFieldBoundary.conclusion, "negative-typed-market-field-in-checked-boundary", "multiverse market market-member boundary typed Market field conclusion drifted");
  assert.equal(boundary.typedMarketFieldBoundary.currentUse, "accessor-member-shell-naming-only", "multiverse market market-member boundary typed Market field current-use drifted");
  assert.equal(boundary.deeperMarketOwnerStatus.status, "declaring-owner-closed-market-wrapper-still-unresolved", "multiverse market market-member boundary deeper market owner status drifted");
  assert.equal(boundary.deeperMarketOwnerStatus.scope, "typed Market-named wrapper recovery beyond the checked accessor bridge, not the declaring owner for the checked InscryptionsDone / IS*Level cluster", "multiverse market market-member boundary deeper market owner scope drifted");
  assert.match(boundary.deeperMarketOwnerStatus.note, /SaveData/i, "multiverse market market-member boundary deeper market owner note must mention SaveData");
  assert.match(boundary.deeperMarketOwnerStatus.note, /does not recover a typed Market field/i, "multiverse market market-member boundary deeper market owner note must preserve the negative typed Market result");
  ["IS71Level", "IS110Level", "InscryptionsDone", "EsotericR1Trades", "NecrumR1Trades", "Mech1Unlocked", "Mech1MissionsCompleted"].forEach((name) => {
    assert.ok(boundary.progressionPayloadFieldClues.includes(name), `multiverse market market-member boundary missing ${name}`);
  });

  return {
    id: "multiverse-market-market-member-boundary",
    label: "Multiverse market market-member boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.playerProfileAccessorClues.length} PlayerProfile-side accessor clues`,
      `${boundary.playerProfileMemberShellClues.length} PlayerProfile-side member-shell clues`,
      `${boundary.playerProfileHandlerBridgeClues.length} PlayerProfileHandler bridge clues`,
      `${boundary.directMemberHandoffClues.length} direct member-handoff clues`,
      "PlayerProfileHandler saveInfoCache field is recovered as PlayerProfileData while no typed Market field is recovered on PlayerProfileHandler or PlayerProfileData",
      "PlayerProfileHandler.ConvertSaveDataToProfileData bridges SaveData back into PlayerProfileData without recovering a typed Market field",
      "PlayerProfileData direct field table is recovered as 89 flat fields and 1 method with no direct IS/trade/mech members",
      "InscryptionsDone now has an exact typed split: PlayerProfileData exposes System.String while SaveData exposes System.Int32",
      "SaveData direct field table is recovered as 4461 fields and 1 method with direct IS/trade/mech ownership plus a wider InscryptionsDone declaration",
      `${boundary.directPlayerProfileFieldSamples.length} direct PlayerProfileData field samples`,
      `${boundary.typedSaveDataProgressionOwnerSamples.length} typed SaveData progression-owner samples`,
      `${boundary.firstNestedMarketTypeChecks.length} first nested market type checks`,
      `${boundary.progressionPayloadFieldClues.length} progression-payload field clues`,
      `${boundary.marketWrapperTypeClues.length} nearby market-wrapper type clues`,
      "MultiverseMarket save-side handoff is narrowed to a checked PlayerProfileHandler.get_Market-to-MultiverseMarket bridge with SaveData recovered as the checked IS/trade/mech owner and InscryptionsDone split out as a dual declaration"
    ]
  };
}

function validateMultiverseMarketMarketShellDocs(boundaryDoc, stateDoc, activeBoundariesDoc) {
  const combinedDocs = [boundaryDoc, stateDoc, activeBoundariesDoc].join("\n");
  assert.match(boundaryDoc, /checked accessor bridge:/, "multiverse market market-member boundary doc must split the checked accessor bridge");
  assert.match(boundaryDoc, /metadata\/member-shell clue:/, "multiverse market market-member boundary doc must split the metadata member shell clue");
  assert.match(boundaryDoc, /checked typed-`Market` field result:/, "multiverse market market-member boundary doc must split the checked typed Market field result");
  assert.match(boundaryDoc, /deeper typed `Market`-named owner status:/, "multiverse market market-member boundary doc must preserve deeper Market owner status");
  assert.match(combinedDocs, /`PlayerProfileHandler\.get_Market -> MultiverseMarket`/, "multiverse market docs must preserve the checked accessor bridge");
  assert.match(combinedDocs, /metadata-only `Market` shell/, "multiverse market docs must preserve the metadata-only Market shell phrasing");
  assert.match(combinedDocs, /(does not recover a typed `Market` field|no typed `Market`(?:-named)?(?: or `MultiverseMarket`)? field is recovered) on `PlayerProfileHandler`, `PlayerProfileData`, or `SaveData`/, "multiverse market docs must preserve the negative typed Market recovery");
  assert.match(combinedDocs, /`PlayerProfileData\.InscryptionsDone`(?: is|:)? (?:recovered as )?`?System\.String`?[\s\S]*`SaveData\.InscryptionsDone`(?: is|:)? (?:recovered as )?`?System\.Int32`?/i, "multiverse market docs must preserve the exact InscryptionsDone type split");
  assert.match(combinedDocs, /(remaining unresolved seam is only .*typed `Market`(?:-wrapper|` wrapper)|only a typed `Market`-wrapper recovery beyond the checked accessor bridge remains unresolved)/i, "multiverse market docs must preserve the narrowed remaining seam");
  assert.match(combinedDocs, /accessor\/member-shell naming only/, "multiverse market docs must preserve accessor/member-shell-only use");
  assert.doesNotMatch(combinedDocs, /typed `Market` field recovered on `PlayerProfileHandler`/i, "multiverse market docs must not claim typed Market recovery on PlayerProfileHandler");
  assert.doesNotMatch(combinedDocs, /typed `Market` field recovered on `PlayerProfileData`/i, "multiverse market docs must not claim typed Market recovery on PlayerProfileData");
  assert.doesNotMatch(combinedDocs, /typed `Market` field recovered on `SaveData`/i, "multiverse market docs must not claim typed Market recovery on SaveData");
}

function validateMultiverseMarketSaveDataImportBoundary(boundary, stateDoc) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market SaveData import boundary generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "multiverse market SaveData import boundary dataset id must be present");
  expectRecord(boundary.sources, "multiverse market SaveData import boundary sources must be an object");
  ["marketMemberBoundary", "rangeBoundary", "rowTextCoverage", "actionShell", "metadataNeighborhood", "validatedRows", "typedProbeReport", "stateVerificationDoc"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market SaveData import boundary sources.${field} must be present`);
  });
  expectRecord(boundary.canonicalSplit, "multiverse market SaveData import boundary canonicalSplit must be an object");
  expectRecord(boundary.checkedIsToRowOrderBoundary, "multiverse market SaveData import boundary checkedIsToRowOrderBoundary must be an object");
  expectRecord(boundary.boundedImportConclusion, "multiverse market SaveData import boundary boundedImportConclusion must be an object");
  expectRecord(boundary.classifications, "multiverse market SaveData import boundary classifications must be an object");
  expectRecord(boundary.checkedIsToRowOrderBoundary.widerOrderedSet, "multiverse market SaveData import boundary widerOrderedSet must be an object");
  expectArray(boundary.checkedIsToRowOrderBoundary.checkedOrderedMappings, "multiverse market SaveData import boundary checkedOrderedMappings must be an array");
  expectArray(boundary.checkedIsToRowOrderBoundary.blockedWiderMapping, "multiverse market SaveData import boundary blockedWiderMapping must be an array");
  expectArray(boundary.boundedImportConclusion.importSafeSubset, "multiverse market SaveData import boundary importSafeSubset must be an array");
  expectNonEmptyString(boundary.boundedImportConclusion.exactImportSafeSubsetLabel, "multiverse market SaveData import boundary exactImportSafeSubsetLabel must be present");
  expectNonEmptyString(boundary.boundedImportConclusion.importTargetPath, "multiverse market SaveData import boundary importTargetPath must be present");
  expectArray(boundary.boundedImportConclusion.canonicalImportSafeSubset, "multiverse market SaveData import boundary canonicalImportSafeSubset must be an array");
  expectNonEmptyString(boundary.boundedImportConclusion.exactCanonicalImportSafeSubsetLabel, "multiverse market SaveData import boundary exactCanonicalImportSafeSubsetLabel must be present");
  expectNonEmptyString(boundary.boundedImportConclusion.currentBoundary, "multiverse market SaveData import boundary currentBoundary must be present");
  expectArray(boundary.boundedImportConclusion.blockedBy, "multiverse market SaveData import boundary blockedBy must be an array");
  expectArray(boundary.classifications.safe_import_candidate, "multiverse market SaveData import boundary safe_import_candidate must be an array");
  expectArray(boundary.classifications.wrapper_or_export_only, "multiverse market SaveData import boundary wrapper_or_export_only must be an array");
  expectArray(boundary.classifications.verified_but_blocked, "multiverse market SaveData import boundary verified_but_blocked must be an array");
  expectArray(boundary.classifications.unresolved, "multiverse market SaveData import boundary unresolved must be an array");

  assert.equal(boundary.dataset, "multiverse-market-savedata-import-boundary", "multiverse market SaveData import boundary dataset id drifted");
  assert.equal(boundary.canonicalSplit.accessorBridge, "PlayerProfileHandler.get_Market -> MultiverseMarket", "multiverse market SaveData import boundary accessor bridge drifted");
  assert.equal(boundary.canonicalSplit.metadataMemberShell, "Market", "multiverse market SaveData import boundary metadata member shell drifted");
  assert.equal(boundary.canonicalSplit.widerSaveOwner, "SaveData", "multiverse market SaveData import boundary wider save owner drifted");
  assert.equal(boundary.checkedIsToRowOrderBoundary.widerOrderedSet.actionShellBuyHookRange, "BuyIS1 through BuyIS110", "multiverse market SaveData import boundary actionShellBuyHookRange drifted");
  assert.equal(boundary.checkedIsToRowOrderBoundary.widerOrderedSet.actionShellCostTextRange, "SetIS1CostText through SetIS110CostText", "multiverse market SaveData import boundary actionShellCostTextRange drifted");
  assert.deepEqual(boundary.checkedIsToRowOrderBoundary.widerOrderedSet.validatedRowRanges, ["50-59", "63-74"], "multiverse market SaveData import boundary validatedRowRanges drifted");
  assert.equal(boundary.checkedIsToRowOrderBoundary.widerOrderedSet.saveDataFieldRange, "IS1Level through IS110Level", "multiverse market SaveData import boundary saveDataFieldRange drifted");
  expectRecord(boundary.typedSpanBoundary, "multiverse market SaveData import boundary typedSpanBoundary must be an object");
  expectNonEmptyString(boundary.typedSpanBoundary.declaringOwner, "multiverse market SaveData import boundary typedSpanBoundary.declaringOwner must be present");
  expectNonEmptyString(boundary.typedSpanBoundary.contiguousLevelSpan, "multiverse market SaveData import boundary typedSpanBoundary.contiguousLevelSpan must be present");
  expectRecord(boundary.typedSpanBoundary.lowerBoundary, "multiverse market SaveData import boundary typedSpanBoundary.lowerBoundary must be an object");
  expectRecord(boundary.typedSpanBoundary.upperBoundary, "multiverse market SaveData import boundary typedSpanBoundary.upperBoundary must be an object");
  expectArray(boundary.typedSpanBoundary.evidence, "multiverse market SaveData import boundary typedSpanBoundary.evidence must be an array");
  assert.equal(boundary.typedSpanBoundary.declaringOwner, "SaveData", "multiverse market SaveData import boundary typed span declaringOwner drifted");
  assert.equal(boundary.typedSpanBoundary.contiguousLevelSpan, "IS1Level through IS110Level", "multiverse market SaveData import boundary typed contiguous span drifted");
  assert.equal(boundary.typedSpanBoundary.lowerBoundary.includedField, "IS1Level", "multiverse market SaveData import boundary typed lower included field drifted");
  assert.equal(boundary.typedSpanBoundary.lowerBoundary.excludedNeighbor, "IS0Level", "multiverse market SaveData import boundary typed lower excluded neighbor drifted");
  assert.equal(boundary.typedSpanBoundary.upperBoundary.includedField, "IS110Level", "multiverse market SaveData import boundary typed upper included field drifted");
  assert.equal(boundary.typedSpanBoundary.upperBoundary.excludedNeighbor, "IS111Level", "multiverse market SaveData import boundary typed upper excluded neighbor drifted");
  assert.equal(boundary.typedSpanBoundary.upperBoundary.nextTypedNeighbor, "InscryptionsDone", "multiverse market SaveData import boundary typed upper next neighbor drifted");
  assert.deepEqual(
    boundary.checkedIsToRowOrderBoundary.checkedOrderedMappings.map((entry) => entry.saveField),
    ["IS71Level", "IS72Level", "IS73Level", "IS74Level"],
    "multiverse market SaveData import boundary checkedOrderedMappings saveField order drifted"
  );
  assert.deepEqual(
    boundary.checkedIsToRowOrderBoundary.checkedOrderedMappings.map((entry) => entry.orderedInscriptionRow),
    [71, 72, 73, 74],
    "multiverse market SaveData import boundary checkedOrderedMappings row ids drifted"
  );
  boundary.checkedIsToRowOrderBoundary.checkedOrderedMappings.forEach((entry, index) => {
    expectArray(entry.evidence, `multiverse market SaveData import boundary checkedOrderedMappings[${index}].evidence must be an array`);
    assert.equal(entry.evidence.length, 4, `multiverse market SaveData import boundary checkedOrderedMappings[${index}] should preserve four evidence links`);
  });
  assert.equal(boundary.checkedIsToRowOrderBoundary.blockedWiderMapping.length, 2, "multiverse market SaveData import boundary blockedWiderMapping count drifted");
  assert.deepEqual(
    boundary.boundedImportConclusion.importSafeSubset,
    [
      "IS1Level through IS110Level",
      "EsotericR1Trades through EsotericR9Trades",
      "NecrumR1Trades through NecrumR9Trades",
      "Mech1Unlocked through Mech2Unlocked"
    ],
    "multiverse market SaveData import boundary importSafeSubset drifted"
  );
  assert.equal(
    boundary.boundedImportConclusion.exactImportSafeSubsetLabel,
    "IS1Level through IS110Level plus separate bounded trade-counter and early-mech quarantine ranges after the dual-declared InscryptionsDone boundary",
    "multiverse market SaveData import boundary exactImportSafeSubsetLabel drifted"
  );
  assert.equal(boundary.boundedImportConclusion.importTargetPath, "compatibility.unmappedSystemState.multiverseMarket", "multiverse market SaveData import boundary importTargetPath drifted");
  assert.deepEqual(boundary.boundedImportConclusion.canonicalImportSafeSubset, [], "multiverse market SaveData import boundary canonicalImportSafeSubset must remain empty in this slice");
  assert.equal(boundary.boundedImportConclusion.exactCanonicalImportSafeSubsetLabel, "none", "multiverse market SaveData import boundary exactCanonicalImportSafeSubsetLabel drifted");
  assert.match(boundary.boundedImportConclusion.currentBoundary, /IS1Level through IS110Level/i, "multiverse market SaveData import boundary currentBoundary must preserve the exact import-safe span");
  assert.match(boundary.boundedImportConclusion.currentBoundary, /IS1Level rather than IS0Level/i, "multiverse market SaveData import boundary currentBoundary must preserve the typed lower boundary");
  assert.match(boundary.boundedImportConclusion.currentBoundary, /IS110Level before the dual-declared InscryptionsDone boundary/i, "multiverse market SaveData import boundary currentBoundary must preserve the typed upper boundary");
  assert.match(boundary.boundedImportConclusion.currentBoundary, /EsotericR1Trades through EsotericR9Trades/i, "multiverse market SaveData import boundary currentBoundary must preserve the bounded trade-counter range");
  assert.match(boundary.boundedImportConclusion.currentBoundary, /NecrumR1Trades through NecrumR9Trades/i, "multiverse market SaveData import boundary currentBoundary must preserve the bounded trade-counter range");
  assert.match(boundary.boundedImportConclusion.currentBoundary, /Mech1Unlocked through Mech2Unlocked/i, "multiverse market SaveData import boundary currentBoundary must preserve the bounded early-mech window");
  assert.match(boundary.boundedImportConclusion.currentBoundary, /compatibility-only/i, "multiverse market SaveData import boundary currentBoundary must preserve the compatibility-only conclusion");
  assert.match(boundary.boundedImportConclusion.currentBoundary, /no recovered SaveData field is currently safe to promote into canonical PlayerProfile import/i, "multiverse market SaveData import boundary currentBoundary must preserve the canonical block");
  ["do not reopen the metadata-only Market typed-field question without new direct evidence", "do not treat the compatibility-safe IS1Level through IS110Level import span or the ordered overlap at rows 71-74 as canonical import admissibility or row-identity recovery", "do not claim a broader IS*Level to inscription-row remap until repo-local evidence checks more than the ordered 71-74 overlap", "do not do planner integration from the recovered SaveData block in this slice"].forEach((line) => {
    assert.ok(boundary.boundedImportConclusion.blockedBy.includes(line), `multiverse market SaveData import boundary missing blockedBy line ${line}`);
  });

  assert.equal(boundary.classifications.safe_import_candidate.length, 3, "multiverse market SaveData import boundary safe_import_candidate count drifted");
  assert.equal(boundary.classifications.wrapper_or_export_only.length, 1, "multiverse market SaveData import boundary wrapper_or_export_only count drifted");
  assert.equal(boundary.classifications.verified_but_blocked.length, 1, "multiverse market SaveData import boundary verified_but_blocked count drifted");
  assert.equal(boundary.classifications.unresolved.length, 0, "multiverse market SaveData import boundary unresolved count drifted");

  const safeById = new Map(boundary.classifications.safe_import_candidate.map((entry) => [entry.entryId, entry]));
  assert.deepEqual(
    [...safeById.keys()],
    ["savedata-owned-is1-110", "savedata-owned-trade-counters", "savedata-owned-adjacent-mech-window"],
    "multiverse market SaveData import boundary safe_import_candidate entry ids drifted"
  );
  assert.deepEqual(safeById.get("savedata-owned-is1-110")?.fieldNames, ["IS1Level through IS110Level"], "multiverse market SaveData import boundary IS span fieldNames drifted");
  assert.deepEqual(
    safeById.get("savedata-owned-trade-counters")?.fieldNames,
    ["EsotericR1Trades through EsotericR9Trades", "NecrumR1Trades through NecrumR9Trades"],
    "multiverse market SaveData import boundary trade counter safe fieldNames drifted"
  );
  assert.deepEqual(
    safeById.get("savedata-owned-adjacent-mech-window")?.fieldNames,
    ["Mech1Unlocked through Mech2Unlocked"],
    "multiverse market SaveData import boundary early-mech safe fieldNames drifted"
  );
  [...safeById.values()].forEach((entry) => {
    assert.equal(entry.targetPath, "compatibility.unmappedSystemState.multiverseMarket", "multiverse market SaveData import boundary safe targetPath drifted");
  });
  assert.match(safeById.get("savedata-owned-is1-110")?.why || "", /compatibility-only raw Emporium import truth/i, "multiverse market SaveData import boundary IS span safe rationale drifted");
  assert.match(safeById.get("savedata-owned-trade-counters")?.why || "", /separate bounded quarantine ranges/i, "multiverse market SaveData import boundary trade safe rationale drifted");
  assert.match(safeById.get("savedata-owned-adjacent-mech-window")?.why || "", /broader Mech2\* continuation/i, "multiverse market SaveData import boundary mech safe rationale drifted");

  const wrapperEntry = boundary.classifications.wrapper_or_export_only[0];
  assert.equal(wrapperEntry.entryId, "inscryptionsdone-wrapper", "multiverse market SaveData import boundary wrapper entry id drifted");
  assert.deepEqual(wrapperEntry.fieldNames, ["InscryptionsDone"], "multiverse market SaveData import boundary wrapper fieldNames drifted");
  assert.match(wrapperEntry.why, /PlayerProfileData already exposes InscryptionsDone/i, "multiverse market SaveData import boundary wrapper rationale drifted");

  const blockedById = new Map(boundary.classifications.verified_but_blocked.map((entry) => [entry.entryId, entry]));
  assert.deepEqual(
    [...blockedById.keys()],
    ["checked-row-order-is71-74"],
    "multiverse market SaveData import boundary verified_but_blocked entry ids drifted"
  );
  assert.deepEqual(blockedById.get("checked-row-order-is71-74")?.fieldNames, ["IS71Level", "IS72Level", "IS73Level", "IS74Level"], "multiverse market SaveData import boundary checked row-order fieldNames drifted");
  assert.match(blockedById.get("checked-row-order-is71-74")?.why || "", /ordered row-position mapping/i, "multiverse market SaveData import boundary checked row-order rationale must mention ordered row-position mapping");

  const combinedDoc = stateDoc;
  assert.match(combinedDoc, /## Checked `IS\*Level` to inscription-row boundary/, "multiverse market state verification doc must expose the checked IS-to-row boundary section");
  assert.match(combinedDoc, /`IS71Level` -> ordered row `71`/, "multiverse market state verification doc must preserve the checked IS71 ordered row mapping");
  assert.match(combinedDoc, /`IS74Level` -> ordered row `74`/, "multiverse market state verification doc must preserve the checked IS74 ordered row mapping");
  assert.match(combinedDoc, /## Bounded SaveData import classification/, "multiverse market state verification doc must expose the bounded SaveData import classification");
  assert.match(combinedDoc, /`safe_import_candidate`[\s\S]*`IS1Level` through `IS110Level`/, "multiverse market state verification doc must preserve the exact compatibility-safe IS span");
  assert.match(combinedDoc, /`safe_import_candidate`[\s\S]*`EsotericR1Trades` through `EsotericR9Trades`[\s\S]*`NecrumR1Trades` through `NecrumR9Trades`/, "multiverse market state verification doc must preserve the compatibility-safe trade counter entries");
  assert.match(combinedDoc, /`safe_import_candidate`[\s\S]*`Mech1Unlocked` through `Mech2Unlocked`/, "multiverse market state verification doc must preserve the compatibility-safe early-mech window");
  assert.match(combinedDoc, /`wrapper_or_export_only`[\s\S]*`InscryptionsDone`/, "multiverse market state verification doc must preserve the wrapper/export-only InscryptionsDone entry");
  assert.match(combinedDoc, /`verified_but_blocked`[\s\S]*`IS71Level` through `IS74Level`/, "multiverse market state verification doc must preserve the blocked overlap IS71-74 entry");
  assert.match(combinedDoc, /split into separate exact typed quarantine ranges/i, "multiverse market state verification doc must preserve the split-envelope conclusion");
  assert.match(combinedDoc, /`unresolved`[\s\S]*none/, "multiverse market state verification doc must preserve an empty unresolved subset");
  assert.match(combinedDoc, /no recovered field from the checked `SaveData` Emporium-adjacent block is currently safe to promote into canonical `PlayerProfile` import/i, "multiverse market state verification doc must preserve the no-safe-import conclusion");

  return {
    id: "multiverse-market-savedata-import-boundary",
    label: "Multiverse market SaveData import boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.checkedIsToRowOrderBoundary.checkedOrderedMappings.length} checked IS-to-row ordered mappings`,
      `${boundary.classifications.safe_import_candidate.length} safe import candidates`,
      `${boundary.classifications.wrapper_or_export_only.length} wrapper-or-export-only entries`,
      `${boundary.classifications.verified_but_blocked.length} verified-but-blocked entries`,
      "Canonical Emporium import remains blocked even though the exact IS1-110 span is compatibility-safe raw import"
    ]
  };
}

function validateMultiverseMarketRow6974IdentitySourceBoundary(boundary, stateDoc, verificationDoc) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market row 69-74 identity-source boundary generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "multiverse market row 69-74 identity-source boundary dataset id must be present");
  expectRecord(boundary.sources, "multiverse market row 69-74 identity-source boundary sources must be an object");
  ["inscriptionNumberingStabilityBoundary", "prefabRemapBoundary", "rowTextCoverage", "actionShell", "metadataNeighborhood", "unityProbeReport", "uabeaProbeReport", "verificationDoc"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market row 69-74 identity-source boundary sources.${field} must be present`);
  });
  expectArray(boundary.settledBrokenPrefabBand, "multiverse market row 69-74 identity-source boundary settledBrokenPrefabBand must be an array");
  expectRecord(boundary.checkedNonPrefabIdentitySources, "multiverse market row 69-74 identity-source boundary checkedNonPrefabIdentitySources must be an object");
  expectRecord(boundary.checkedNonPrefabIdentitySources.directPlayerFacingStringSearch, "multiverse market row 69-74 identity-source boundary directPlayerFacingStringSearch must be an object");
  expectArray(boundary.checkedNonPrefabIdentitySources.directPlayerFacingStringSearch.searchedLabels, "multiverse market row 69-74 identity-source boundary searchedLabels must be an array");
  expectArray(boundary.checkedNonPrefabIdentitySources.directPlayerFacingStringSearch.matches, "multiverse market row 69-74 identity-source boundary direct string matches must be an array");
  expectRecord(boundary.checkedNonPrefabIdentitySources.textHandlerCoverage, "multiverse market row 69-74 identity-source boundary textHandlerCoverage must be an object");
  expectArray(boundary.checkedNonPrefabIdentitySources.textHandlerCoverage.costTextHooks, "multiverse market row 69-74 identity-source boundary costTextHooks must be an array");
  expectRecord(boundary.checkedNonPrefabIdentitySources.actionShellCoverage, "multiverse market row 69-74 identity-source boundary actionShellCoverage must be an object");
  expectArray(boundary.checkedNonPrefabIdentitySources.actionShellCoverage.buyHooks, "multiverse market row 69-74 identity-source boundary buyHooks must be an array");
  expectRecord(boundary.checkedNonPrefabIdentitySources.metadataJoinCandidates, "multiverse market row 69-74 identity-source boundary metadataJoinCandidates must be an object");
  expectArray(boundary.checkedNonPrefabIdentitySources.nearbyPositiveBindingAnchors, "multiverse market row 69-74 identity-source boundary nearbyPositiveBindingAnchors must be an array");
  expectRecord(boundary.playerFacingIdentitySourceBoundary, "multiverse market row 69-74 identity-source boundary playerFacingIdentitySourceBoundary must be an object");
  expectArray(boundary.playerFacingIdentitySourceBoundary.identitySourceRecovered, "multiverse market row 69-74 identity-source boundary identitySourceRecovered must be an array");
  expectArray(boundary.playerFacingIdentitySourceBoundary.canonicalImportSafeSubset, "multiverse market row 69-74 identity-source boundary canonicalImportSafeSubset must be an array");
  expectArray(boundary.playerFacingIdentitySourceBoundary.identityStillBlocked, "multiverse market row 69-74 identity-source boundary identityStillBlocked must be an array");
  expectArray(boundary.playerFacingIdentitySourceBoundary.currentBoundary, "multiverse market row 69-74 identity-source boundary currentBoundary must be an array");

  assert.equal(boundary.dataset, "multiverse-market-row69-74-identity-source-boundary", "multiverse market row 69-74 identity-source boundary dataset id drifted");
  assert.deepEqual(
    boundary.settledBrokenPrefabBand.map((entry) => [entry.orderedInscriptionRow, entry.saveField, entry.serializedIdField, entry.buyHook, entry.costTextHook, entry.prefabName, entry.remappedSerializedId]),
    [
      [69, "IS69Level", "IS69ID", "BuyIS69", "SetIS69CostText", "ChrystosEmporiumUpgrade69-ID57", 57],
      [70, "IS70Level", "IS70ID", "BuyIS70", "SetIS70CostText", "ChrystosEmporiumUpgrade70-ID58", 58],
      [71, "IS71Level", "IS71ID", "BuyIS71", "SetIS71CostText", "ChrystosEmporiumUpgrade71-ID59", 59],
      [72, "IS72Level", "IS72ID", "BuyIS72", "SetIS72CostText", "ChrystosEmporiumUpgrade72-ID60", 60],
      [73, "IS73Level", "IS73ID", "BuyIS73", "SetIS73CostText", "ChrystosEmporiumUpgrade73-ID61", 61],
      [74, "IS74Level", "IS74ID", "BuyIS74", "SetIS74CostText", "ChrystosEmporiumUpgrade74-ID62", 62]
    ],
    "multiverse market row 69-74 identity-source boundary settledBrokenPrefabBand drifted"
  );
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.directPlayerFacingStringSearch.searchedLabels,
    ["Inscryption 69", "Inscryption 70", "Inscryption 71", "Inscryption 72", "Inscryption 73", "Inscryption 74"],
    "multiverse market row 69-74 identity-source boundary searchedLabels drifted"
  );
  assert.deepEqual(boundary.checkedNonPrefabIdentitySources.directPlayerFacingStringSearch.matches, [], "multiverse market row 69-74 identity-source boundary direct string matches must remain empty");
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.remappedSerializedIdLabelBoundary.remappedSerializedIds,
    [57, 58, 59, 60, 61, 62],
    "multiverse market row 69-74 identity-source boundary remappedSerializedIds drifted"
  );
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.remappedSerializedIdLabelBoundary.earlierDirectPrefabShells,
    [
      "ChrystosEmporiumUpgrade57",
      "ChrystosEmporiumUpgrade58",
      "ChrystosEmporiumUpgrade59",
      "ChrystosEmporiumUpgrade60",
      "ChrystosEmporiumUpgrade61",
      "ChrystosEmporiumUpgrade62"
    ],
    "multiverse market row 69-74 identity-source boundary earlierDirectPrefabShells drifted"
  );
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.remappedSerializedIdLabelBoundary.searchedLabels,
    ["Inscryption 57", "Inscryption 58", "Inscryption 59", "Inscryption 60", "Inscryption 61", "Inscryption 62"],
    "multiverse market row 69-74 identity-source boundary remapped serialized searchedLabels drifted"
  );
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.remappedSerializedIdLabelBoundary.matches,
    [],
    "multiverse market row 69-74 identity-source boundary remapped serialized string matches must remain empty"
  );
  assert.equal(boundary.checkedNonPrefabIdentitySources.textHandlerCoverage.textHandlerOwner, "TextHandlerMarkets", "multiverse market row 69-74 identity-source boundary textHandlerOwner drifted");
  assert.equal(boundary.checkedNonPrefabIdentitySources.textHandlerCoverage.textHandlerScriptPath, "9\\Assets\\Scripts\\Text\\Text Ouroboros\\TextHandlerMarkets.cs", "multiverse market row 69-74 identity-source boundary textHandlerScriptPath drifted");
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.textHandlerCoverage.costTextHooks,
    ["SetIS69CostText", "SetIS70CostText", "SetIS71CostText", "SetIS72CostText", "SetIS73CostText", "SetIS74CostText"],
    "multiverse market row 69-74 identity-source boundary costTextHooks drifted"
  );
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.actionShellCoverage.buyHooks,
    ["BuyIS69", "BuyIS70", "BuyIS71", "BuyIS72", "BuyIS73", "BuyIS74"],
    "multiverse market row 69-74 identity-source boundary buyHooks drifted"
  );
  assert.deepEqual(
    [
      boundary.checkedNonPrefabIdentitySources.metadataJoinCandidates.ownerField,
      boundary.checkedNonPrefabIdentitySources.metadataJoinCandidates.ownerType,
      boundary.checkedNonPrefabIdentitySources.metadataJoinCandidates.listField,
      boundary.checkedNonPrefabIdentitySources.metadataJoinCandidates.listType
    ],
    ["THMarkets", "TextHandlerMarkets", "InscryptionsList", "System.Collections.Generic.List`1<UnityEngine.GameObject>"],
    "multiverse market row 69-74 identity-source boundary metadataJoinCandidates drifted"
  );
  assert.equal(
    boundary.checkedNonPrefabIdentitySources.tmpProbeNegativeBoundary.artifact,
    "tmp-multiverse-row-text-probe.json",
    "multiverse market row 69-74 identity-source boundary last unchecked artifact drifted"
  );
  assert.equal(
    boundary.checkedNonPrefabIdentitySources.tmpProbeNegativeBoundary.sourceClass,
    "raw TextHandlerMarkets presentation-probe continuation",
    "multiverse market row 69-74 identity-source boundary last unchecked sourceClass drifted"
  );
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.tmpProbeNegativeBoundary.checkedAnchors,
    ["SetIS69BaseBonusText", "ClearISObjects", "ClearISMaxLevelObjects", "SetISMaxLevelObjects", "THMarkets", "InscryptionsList"],
    "multiverse market row 69-74 identity-source boundary tmp probe anchors drifted"
  );
  assert.deepEqual(
    boundary.checkedNonPrefabIdentitySources.nearbyPositiveBindingAnchors.map((entry) => [entry.orderedInscriptionRow, entry.prefabName, entry.playerFacingLabel]),
    [[78, "ChrystosEmporiumUpgrade78-ID78", "Inscryption 78: Ouroboros Orbs"], [83, "ChrystosEmporiumUpgrade83-ID83", "Inscryption 83: Fast-Loop ML"]],
    "multiverse market row 69-74 identity-source boundary nearbyPositiveBindingAnchors drifted"
  );
  assert.deepEqual(boundary.playerFacingIdentitySourceBoundary.identitySourceRecovered, [], "multiverse market row 69-74 identity-source boundary identitySourceRecovered must remain empty");
  assert.deepEqual(boundary.playerFacingIdentitySourceBoundary.canonicalImportSafeSubset, [], "multiverse market row 69-74 identity-source boundary canonicalImportSafeSubset must remain empty");
  assert.equal(boundary.playerFacingIdentitySourceBoundary.helpsRows6974, false, "multiverse market row 69-74 identity-source boundary helpsRows6974 must remain false");
  assert.deepEqual(
    boundary.playerFacingIdentitySourceBoundary.identityStillBlocked.map((entry) => entry.orderedInscriptionRow),
    [69, 70, 71, 72, 73, 74],
    "multiverse market row 69-74 identity-source boundary blocked row order drifted"
  );
  boundary.playerFacingIdentitySourceBoundary.identityStillBlocked.forEach((entry, index) => {
    assert.equal(entry.status, "unresolved", `multiverse market row 69-74 identity-source boundary blocked entry ${index} status drifted`);
    expectArray(entry.checkedEvidence, `multiverse market row 69-74 identity-source boundary blocked entry ${index} checkedEvidence must be an array`);
    expectArray(entry.blockedBy, `multiverse market row 69-74 identity-source boundary blocked entry ${index} blockedBy must be an array`);
  });

  assert.match(stateDoc, /## Checked row `69-74` player-facing identity-source boundary/, "multiverse market state verification doc must expose the row 69-74 identity-source boundary section");
  assert.match(stateDoc, /no stable player-facing identity source is currently recoverable repo-locally for rows `69-74`/i, "multiverse market state verification doc must preserve the unresolved row 69-74 identity-source conclusion");
  assert.match(stateDoc, /serialized ids `57-62`[\s\S]*do not recover direct player-facing strings `Inscryption 57` through `Inscryption 62`/i, "multiverse market state verification doc must preserve the remapped serialized-id blocker");
  assert.match(stateDoc, /tmp-multiverse-row-text-probe\.json[\s\S]*SetIS69BaseBonusText[\s\S]*ClearISObjects[\s\S]*ClearISMaxLevelObjects[\s\S]*SetISMaxLevelObjects/i, "multiverse market state verification doc must preserve the tmp probe negative boundary");
  assert.match(verificationDoc, /## Narrow row 69-74 identity-source boundary/, "multiverse market verification doc must expose the narrow row 69-74 identity-source boundary section");
  assert.match(verificationDoc, /THMarkets: TextHandlerMarkets/, "multiverse market verification doc must preserve the THMarkets metadata join clue");
  assert.match(verificationDoc, /InscryptionsList: List<GameObject>/, "multiverse market verification doc must preserve the InscryptionsList metadata join clue");
  assert.match(verificationDoc, /the checked repo-local probe artifacts do not recover direct player-facing strings `Inscryption 69` through `Inscryption 74`/i, "multiverse market verification doc must preserve the direct string negative boundary");
  assert.match(verificationDoc, /direct shells `ChrystosEmporiumUpgrade57` through `ChrystosEmporiumUpgrade62`[\s\S]*do not recover direct player-facing strings `Inscryption 57` through `Inscryption 62`/i, "multiverse market verification doc must preserve the remapped serialized-id negative boundary");
  assert.match(verificationDoc, /tmp-multiverse-row-text-probe\.json[\s\S]*SetIS69BaseBonusText[\s\S]*ClearISObjects[\s\S]*ClearISMaxLevelObjects[\s\S]*SetISMaxLevelObjects/i, "multiverse market verification doc must preserve the tmp probe negative boundary");

  return {
    id: "multiverse-market-row69-74-identity-source-boundary",
    label: "Multiverse market row 69-74 identity-source boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.settledBrokenPrefabBand.length} checked broken-band rows`,
      `${boundary.playerFacingIdentitySourceBoundary.identitySourceRecovered.length} recovered player-facing identity sources`,
      `${boundary.playerFacingIdentitySourceBoundary.identityStillBlocked.length} unresolved row identities`,
      "Rows 69-74 remain unresolved because neither the broken-band rows, remapped ids 57-62, nor the checked tmp TextHandlerMarkets seam recover a repo-local player-facing identity source"
    ]
  };
}

function validateMultiverseMarketSerializedLabelSourceBoundary(boundary, stateDoc, verificationDoc, boundaryDoc) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market serialized label-source boundary generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "multiverse market serialized label-source boundary dataset id must be present");
  expectRecord(boundary.sources, "multiverse market serialized label-source boundary sources must be an object");
  ["row6974IdentitySourceBoundary", "marketMemberBoundary", "uabeaProbeReport", "stateVerificationDoc", "verificationDoc"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market serialized label-source boundary sources.${field} must be present`);
  });
  expectRecord(boundary.checkedSerializedExportEvidence, "multiverse market serialized label-source boundary checkedSerializedExportEvidence must be an object");
  expectArray(boundary.checkedSerializedExportEvidence.multiverseMarketContainerFields, "multiverse market serialized label-source boundary multiverseMarketContainerFields must be an array");
  expectArray(boundary.checkedSerializedExportEvidence.rowPayloadTypes, "multiverse market serialized label-source boundary rowPayloadTypes must be an array");
  expectRecord(boundary.checkedSerializedExportEvidence.labelBearingFieldChecks, "multiverse market serialized label-source boundary labelBearingFieldChecks must be an object");
  expectArray(boundary.checkedSerializedExportEvidence.labelBearingFieldChecks.checkedAbsentFieldNames, "multiverse market serialized label-source boundary checkedAbsentFieldNames must be an array");
  expectArray(boundary.checkedSerializedExportEvidence.labelBearingFieldChecks.recoveredStringOrLabelFields, "multiverse market serialized label-source boundary recoveredStringOrLabelFields must be an array");
  expectRecord(boundary.checkedSerializedExportEvidence.indirectJoinSearch, "multiverse market serialized label-source boundary indirectJoinSearch must be an object");
  expectArray(boundary.checkedSerializedExportEvidence.indirectJoinSearch.candidateCatalogOrRelationFields, "multiverse market serialized label-source boundary candidateCatalogOrRelationFields must be an array");
  expectArray(boundary.checkedSerializedExportEvidence.indirectJoinSearch.separateUiShellClues, "multiverse market serialized label-source boundary separateUiShellClues must be an array");
  expectArray(boundary.checkedSerializedExportEvidence.indirectJoinSearch.repoLocalConsumerSearchSourcesWithoutCandidateHits, "multiverse market serialized label-source boundary repoLocalConsumerSearchSourcesWithoutCandidateHits must be an array");
  expectArray(boundary.checkedSerializedExportEvidence.indirectJoinSearch.adjacentConsumerOrViewSymbolsRecovered, "multiverse market serialized label-source boundary adjacentConsumerOrViewSymbolsRecovered must be an array");
  expectRecord(boundary.joinBackAssessment, "multiverse market serialized label-source boundary joinBackAssessment must be an object");
  expectArray(boundary.joinBackAssessment.distinctFromSettledCheckedPath, "multiverse market serialized label-source boundary distinctFromSettledCheckedPath must be an array");
  expectArray(boundary.joinBackAssessment.structuralCarryover, "multiverse market serialized label-source boundary structuralCarryover must be an array");
  expectArray(boundary.joinBackAssessment.playerFacingIdentitySourceRecovered, "multiverse market serialized label-source boundary playerFacingIdentitySourceRecovered must be an array");
  expectArray(boundary.joinBackAssessment.canonicalImportSafeSubset, "multiverse market serialized label-source boundary canonicalImportSafeSubset must be an array");
  expectArray(boundary.joinBackAssessment.smallestRecoveredPattern, "multiverse market serialized label-source boundary smallestRecoveredPattern must be an array");
  expectArray(boundary.joinBackAssessment.blockedBy, "multiverse market serialized label-source boundary blockedBy must be an array");
  expectArray(boundary.joinBackAssessment.currentBoundary, "multiverse market serialized label-source boundary currentBoundary must be an array");

  assert.equal(boundary.dataset, "multiverse-market-serialized-label-source-boundary", "multiverse market serialized label-source boundary dataset id drifted");
  assert.deepEqual(
    boundary.checkedSerializedExportEvidence.multiverseMarketContainerFields.map((entry) => [entry.name, entry.type, entry.fieldOffset]),
    [
      ["InscryptionCostList", "System.Collections.Generic.List`1<BreakInfinity.BigDouble>", 10656],
      ["InscryptionAndCostRelations", "System.Collections.Generic.Dictionary`2<System.Int32, BreakInfinity.BigDouble>", 10672],
      ["IDChecks", "System.Collections.Generic.List`1<System.Int32>", 10688],
      ["inscryptions", "System.Collections.Generic.List`1<MultiverseMarket+Inscryption>", 10696],
      ["InscryptionTupleList", "System.Collections.Generic.List`1<MultiverseMarket+InscryptionTupleObject>", 10704]
    ],
    "multiverse market serialized label-source boundary container fields drifted"
  );
  assert.deepEqual(
    boundary.checkedSerializedExportEvidence.rowPayloadTypes.map((entry) => [entry.typeName, entry.fields]),
    [
      ["MultiverseMarket|Inscryption", ["<ID>k__BackingField", "<Cost>k__BackingField", "<Level>k__BackingField", "<MaxLevel>k__BackingField", "<ISObject>k__BackingField", "transform"]],
      ["MultiverseMarket|InscryptionTupleObject", ["<ID>k__BackingField", "<Cost>k__BackingField", "<Level>k__BackingField", "<MaxLevel>k__BackingField", "<ISObject>k__BackingField"]]
    ],
    "multiverse market serialized label-source boundary row payload types drifted"
  );
  assert.deepEqual(
    boundary.checkedSerializedExportEvidence.labelBearingFieldChecks.checkedAbsentFieldNames,
    ["Name", "Label", "Title", "Description", "Text", "LocalizationKey", "StringId"],
    "multiverse market serialized label-source boundary checkedAbsentFieldNames drifted"
  );
  assert.deepEqual(boundary.checkedSerializedExportEvidence.labelBearingFieldChecks.recoveredStringOrLabelFields, [], "multiverse market serialized label-source boundary recoveredStringOrLabelFields must remain empty");
  assert.match(boundary.checkedSerializedExportEvidence.labelBearingFieldChecks.conclusion, /structural row containers and GameObject carriers only/i, "multiverse market serialized label-source boundary conclusion drifted");
  assert.deepEqual(
    boundary.checkedSerializedExportEvidence.indirectJoinSearch.candidateCatalogOrRelationFields,
    ["InscryptionCostList", "InscryptionAndCostRelations", "IDChecks", "inscryptions", "InscryptionTupleList"],
    "multiverse market serialized label-source boundary candidateCatalogOrRelationFields drifted"
  );
  assert.deepEqual(
    boundary.checkedSerializedExportEvidence.indirectJoinSearch.separateUiShellClues,
    ["THMarkets", "InscryptionsList", "TextHandlerMarkets", "SetAllChrystosEmporiumTexts"],
    "multiverse market serialized label-source boundary separateUiShellClues drifted"
  );
  assert.deepEqual(
    boundary.checkedSerializedExportEvidence.indirectJoinSearch.repoLocalConsumerSearchSourcesWithoutCandidateHits,
    ["data/unity-probe-report.json", "data/lm244-targeted-probe.json", "data/multiverse-market-metadata-neighborhood.json"],
    "multiverse market serialized label-source boundary repoLocalConsumerSearchSourcesWithoutCandidateHits drifted"
  );
  assert.deepEqual(boundary.checkedSerializedExportEvidence.indirectJoinSearch.adjacentConsumerOrViewSymbolsRecovered, [], "multiverse market serialized label-source boundary adjacentConsumerOrViewSymbolsRecovered must remain empty");
  assert.match(boundary.checkedSerializedExportEvidence.indirectJoinSearch.conclusion, /does not recover a consumer path that reads those carriers back into player-facing inscription labels/i, "multiverse market serialized label-source boundary indirectJoinSearch conclusion drifted");
  assert.deepEqual(boundary.joinBackAssessment.playerFacingIdentitySourceRecovered, [], "multiverse market serialized label-source boundary playerFacingIdentitySourceRecovered must remain empty");
  assert.deepEqual(boundary.joinBackAssessment.canonicalImportSafeSubset, [], "multiverse market serialized label-source boundary canonicalImportSafeSubset must remain empty");
  assert.equal(boundary.joinBackAssessment.helpsRows6974, false, "multiverse market serialized label-source boundary helpsRows6974 must remain false");
  assert.deepEqual(boundary.joinBackAssessment.smallestRecoveredPattern, [], "multiverse market serialized label-source boundary smallestRecoveredPattern must remain empty");
  assert.deepEqual(
    boundary.joinBackAssessment.structuralCarryover,
    ["InscryptionCostList", "InscryptionAndCostRelations", "IDChecks", "inscryptions", "InscryptionTupleList", "<ID>k__BackingField", "<ISObject>k__BackingField"],
    "multiverse market serialized label-source boundary structuralCarryover drifted"
  );

  const combinedDocs = [stateDoc, verificationDoc, boundaryDoc].join("\n");
  assert.match(boundaryDoc, /checked UABEA field-table export/i, "serialized label-source boundary doc must mention the checked UABEA field-table export");
  assert.match(boundaryDoc, /no indirect row-to-label join pattern is currently recoverable/i, "serialized label-source boundary doc must preserve the indirect-join negative boundary");
  assert.match(verificationDoc, /## Alternate serialized-export indirect-join boundary/, "multiverse market verification doc must expose the alternate serialized-export indirect-join boundary section");
  assert.match(verificationDoc, /InscryptionCostList/, "multiverse market verification doc must preserve the InscryptionCostList evidence");
  assert.match(verificationDoc, /no indirect catalog\/relation join is recoverable repo-locally/i, "multiverse market verification doc must preserve the indirect join negative boundary");
  assert.match(stateDoc, /## Alternate serialized-export indirect-join boundary/, "multiverse market state verification doc must expose the alternate serialized-export indirect-join boundary section");
  assert.match(stateDoc, /InscryptionTupleList/, "multiverse market state verification doc must preserve the InscryptionTupleList evidence");
  assert.match(stateDoc, /no indirect catalog\/relation join is recoverable repo-locally/i, "multiverse market state verification doc must preserve the indirect join negative boundary");
  assert.match(combinedDocs, /the canonical import-safe subset stays empty/i, "serialized label-source boundary docs must preserve the empty canonical subset conclusion");

  return {
    id: "multiverse-market-serialized-label-source-boundary",
    label: "Multiverse market serialized label-source boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.checkedSerializedExportEvidence.multiverseMarketContainerFields.length} checked serialized container fields`,
      `${boundary.checkedSerializedExportEvidence.rowPayloadTypes.length} checked row payload types`,
      `${boundary.joinBackAssessment.playerFacingIdentitySourceRecovered.length} recovered player-facing identity sources`,
      "Alternate serialized export adds structural carriers only and does not resolve rows 69-74"
    ]
  };
}

function validateMultiverseMarketRow7174IdentityBoundary(boundary, stateDoc, verificationDoc) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market row 71-74 identity boundary generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "multiverse market row 71-74 identity boundary dataset id must be present");
  expectRecord(boundary.sources, "multiverse market row 71-74 identity boundary sources must be an object");
  ["saveDataImportBoundary", "validatedRows", "rowTextCoverage", "actionShell", "prefabRemapBoundary", "unityProbeReport", "uabeaProbeReport", "verificationDoc"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market row 71-74 identity boundary sources.${field} must be present`);
  });
  expectArray(boundary.settledOrderedMapping, "multiverse market row 71-74 identity boundary settledOrderedMapping must be an array");
  expectRecord(boundary.playerFacingIdentityBoundary, "multiverse market row 71-74 identity boundary playerFacingIdentityBoundary must be an object");
  expectArray(boundary.playerFacingIdentityBoundary.canonicalImportSafeSubset, "multiverse market row 71-74 identity boundary canonicalImportSafeSubset must be an array");
  expectArray(boundary.playerFacingIdentityBoundary.identityRecovered, "multiverse market row 71-74 identity boundary identityRecovered must be an array");
  expectArray(boundary.playerFacingIdentityBoundary.identityStillBlocked, "multiverse market row 71-74 identity boundary identityStillBlocked must be an array");
  expectArray(boundary.playerFacingIdentityBoundary.adjacentKnownPlayerFacingAnchors, "multiverse market row 71-74 identity boundary adjacentKnownPlayerFacingAnchors must be an array");
  expectArray(boundary.playerFacingIdentityBoundary.currentBoundary, "multiverse market row 71-74 identity boundary currentBoundary must be an array");

  assert.equal(boundary.dataset, "multiverse-market-row71-74-identity-boundary", "multiverse market row 71-74 identity boundary dataset id drifted");
  assert.deepEqual(
    boundary.settledOrderedMapping.map((entry) => [entry.saveField, entry.orderedInscriptionRow]),
    [["IS71Level", 71], ["IS72Level", 72], ["IS73Level", 73], ["IS74Level", 74]],
    "multiverse market row 71-74 identity boundary settledOrderedMapping drifted"
  );
  assert.deepEqual(boundary.playerFacingIdentityBoundary.canonicalImportSafeSubset, [], "multiverse market row 71-74 identity boundary canonicalImportSafeSubset must remain empty");
  assert.deepEqual(boundary.playerFacingIdentityBoundary.identityRecovered, [], "multiverse market row 71-74 identity boundary identityRecovered must remain empty");
  assert.deepEqual(
    boundary.playerFacingIdentityBoundary.identityStillBlocked.map((entry) => entry.orderedInscriptionRow),
    [71, 72, 73, 74],
    "multiverse market row 71-74 identity boundary blocked row order drifted"
  );
  assert.deepEqual(
    boundary.playerFacingIdentityBoundary.identityStillBlocked.map((entry) => entry.saveField),
    ["IS71Level", "IS72Level", "IS73Level", "IS74Level"],
    "multiverse market row 71-74 identity boundary blocked saveField order drifted"
  );
  boundary.playerFacingIdentityBoundary.identityStillBlocked.forEach((entry, index) => {
    assert.equal(entry.status, "unresolved", `multiverse market row 71-74 identity boundary blocked entry ${index} status drifted`);
    expectArray(entry.checkedEvidence, `multiverse market row 71-74 identity boundary blocked entry ${index} checkedEvidence must be an array`);
    expectArray(entry.blockedBy, `multiverse market row 71-74 identity boundary blocked entry ${index} blockedBy must be an array`);
  });
  assert.deepEqual(
    boundary.playerFacingIdentityBoundary.adjacentKnownPlayerFacingAnchors.map((entry) => [entry.orderedInscriptionRow, entry.label]),
    [[78, "Inscryption 78: Ouroboros Orbs"], [83, "Inscryption 83: Fast-Loop ML"]],
    "multiverse market row 71-74 identity boundary adjacent anchors drifted"
  );

  const combinedStateDoc = stateDoc;
  assert.match(combinedStateDoc, /ChrystosEmporiumUpgrade71-ID59/, "multiverse market state verification doc must preserve the row 71 prefab override evidence");
  assert.match(verificationDoc, /ChrystosEmporiumUpgrade71-ID59/, "multiverse market verification doc must preserve the row 71 prefab override evidence");
  assert.match(verificationDoc, /Inscryption 78: Ouroboros Orbs/, "multiverse market verification doc must preserve the adjacent row 78 anchor");
  assert.match(verificationDoc, /the canonical import-safe subset stays empty/i, "multiverse market verification doc must preserve the empty canonical subset conclusion");

  return {
    id: "multiverse-market-row71-74-identity-boundary",
    label: "Multiverse market row 71-74 identity boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.settledOrderedMapping.length} settled ordered mappings`,
      `${boundary.playerFacingIdentityBoundary.identityRecovered.length} grounded player-facing identities`,
      `${boundary.playerFacingIdentityBoundary.identityStillBlocked.length} blocked row identities`,
      "Rows 71-74 remain ordered-only because player-facing identity is still unresolved"
    ]
  };
}

function validateMultiverseMarketRow7174RemapBand(boundary, stateDoc, verificationDoc) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market row 71-74 remap band generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "multiverse market row 71-74 remap band dataset id must be present");
  expectRecord(boundary.sources, "multiverse market row 71-74 remap band sources must be an object");
  ["row7174IdentityBoundary", "prefabRemapBoundary", "metadataNeighborhood", "rowTextCoverage", "actionShell", "uabeaProbeReport", "unityProbeReport", "verificationDoc"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market row 71-74 remap band sources.${field} must be present`);
  });
  expectArray(boundary.remapBandRows, "multiverse market row 71-74 remap band remapBandRows must be an array");
  expectArray(boundary.earlierPrefabShellEvidence, "multiverse market row 71-74 remap band earlierPrefabShellEvidence must be an array");
  expectRecord(boundary.nearbyUiBindingEvidence, "multiverse market row 71-74 remap band nearbyUiBindingEvidence must be an object");
  expectRecord(boundary.recoveredRelationship, "multiverse market row 71-74 remap band recoveredRelationship must be an object");
  expectArray(boundary.canonicalImportSafeSubset, "multiverse market row 71-74 remap band canonicalImportSafeSubset must be an array");
  expectArray(boundary.currentBoundary, "multiverse market row 71-74 remap band currentBoundary must be an array");

  assert.equal(boundary.dataset, "multiverse-market-row71-74-remap-band", "multiverse market row 71-74 remap band dataset id drifted");
  assert.deepEqual(
    boundary.remapBandRows.map((entry) => [
      entry.orderedInscriptionRow,
      entry.saveField,
      entry.serializedIdField,
      entry.buyHook,
      entry.costTextHook,
      entry.prefabNumber,
      entry.prefabName,
      entry.remappedSerializedId
    ]),
    [
      [71, "IS71Level", "IS71ID", "BuyIS71", "SetIS71CostText", 71, "ChrystosEmporiumUpgrade71-ID59", 59],
      [72, "IS72Level", "IS72ID", "BuyIS72", "SetIS72CostText", 72, "ChrystosEmporiumUpgrade72-ID60", 60],
      [73, "IS73Level", "IS73ID", "BuyIS73", "SetIS73CostText", 73, "ChrystosEmporiumUpgrade73-ID61", 61],
      [74, "IS74Level", "IS74ID", "BuyIS74", "SetIS74CostText", 74, "ChrystosEmporiumUpgrade74-ID62", 62]
    ],
    "multiverse market row 71-74 remap band row mapping drifted"
  );
  assert.deepEqual(
    boundary.earlierPrefabShellEvidence.map((entry) => [entry.serializedId, entry.prefabName]),
    [[59, "ChrystosEmporiumUpgrade59"], [60, "ChrystosEmporiumUpgrade60"], [61, "ChrystosEmporiumUpgrade61"], [62, "ChrystosEmporiumUpgrade62"]],
    "multiverse market row 71-74 remap band earlier prefab shell evidence drifted"
  );
  assert.equal(boundary.nearbyUiBindingEvidence.textHandlerOwner, "TextHandlerMarkets", "multiverse market row 71-74 remap band textHandlerOwner drifted");
  assert.equal(boundary.nearbyUiBindingEvidence.textHandlerScriptPath, "9\\Assets\\Scripts\\Text\\Text Ouroboros\\TextHandlerMarkets.cs", "multiverse market row 71-74 remap band textHandlerScriptPath drifted");
  assert.deepEqual(boundary.nearbyUiBindingEvidence.nearestPositiveSameNumberRows, [78, 83], "multiverse market row 71-74 remap band nearestPositiveSameNumberRows drifted");
  assert.deepEqual(boundary.nearbyUiBindingEvidence.nearestPositiveSameNumberLabels, ["Inscryption 78: Ouroboros Orbs", "Inscryption 83: Fast-Loop ML"], "multiverse market row 71-74 remap band nearestPositiveSameNumberLabels drifted");
  assert.deepEqual(boundary.canonicalImportSafeSubset, [], "multiverse market row 71-74 remap band canonicalImportSafeSubset must remain empty");

  assert.match(stateDoc, /## Checked row `71-74` remap-band boundary/, "multiverse market state verification doc must expose the row 71-74 remap-band boundary section");
  assert.match(stateDoc, /prefab numbers `71-74` are reused as shells for serialized ids `59-62`/i, "multiverse market state verification doc must preserve the remap-band relationship");
  assert.match(verificationDoc, /## Narrow row 71-74 remap-band boundary/, "multiverse market verification doc must expose the row 71-74 remap-band boundary section");
  assert.match(verificationDoc, /ChrystosEmporiumUpgrade59/, "multiverse market verification doc must preserve the earlier shell evidence for id 59");
  assert.match(verificationDoc, /this recovers the remap-band relationship but not player-facing identity/i, "multiverse market verification doc must preserve the remap-band limitation");

  return {
    id: "multiverse-market-row71-74-remap-band",
    label: "Multiverse market row 71-74 remap band",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.remapBandRows.length} checked remap-band rows`,
      `${boundary.earlierPrefabShellEvidence.length} earlier prefab shell anchors`,
      "Rows 71-74 keep same-number row and ISNID fields while prefab numbering remaps to ids 59-62"
    ]
  };
}

function validateMultiverseMarketNearbyIdentityBindingPattern(pattern, stateDoc, verificationDoc) {
  expectNonEmptyString(pattern.generatedAt, "multiverse market nearby identity-binding pattern generatedAt must be present");
  expectNonEmptyString(pattern.dataset, "multiverse market nearby identity-binding pattern dataset id must be present");
  expectRecord(pattern.sources, "multiverse market nearby identity-binding pattern sources must be an object");
  ["row6974IdentitySourceBoundary", "metadataNeighborhood", "uabeaProbeReport", "unityProbeReport", "verificationDoc"].forEach((field) => {
    expectNonEmptyString(pattern.sources[field], `multiverse market nearby identity-binding pattern sources.${field} must be present`);
  });
  expectArray(pattern.checkedPositiveBindings, "multiverse market nearby identity-binding pattern checkedPositiveBindings must be an array");
  expectRecord(pattern.recoveredPattern, "multiverse market nearby identity-binding pattern recoveredPattern must be an object");
  expectArray(pattern.recoveredPattern.playerFacingIdentityBindingRule, "multiverse market nearby identity-binding pattern playerFacingIdentityBindingRule must be an array");
  expectArray(pattern.recoveredPattern.checkedPositiveRows, "multiverse market nearby identity-binding pattern checkedPositiveRows must be an array");
  expectArray(pattern.recoveredPattern.checkedNegativeCarryoverRows, "multiverse market nearby identity-binding pattern checkedNegativeCarryoverRows must be an array");
  expectArray(pattern.recoveredPattern.whyNotRows6974, "multiverse market nearby identity-binding pattern whyNotRows6974 must be an array");
  expectArray(pattern.recoveredPattern.canonicalImportSafeSubset, "multiverse market nearby identity-binding pattern canonicalImportSafeSubset must be an array");
  expectArray(pattern.currentBoundary, "multiverse market nearby identity-binding pattern currentBoundary must be an array");

  assert.equal(pattern.dataset, "multiverse-market-nearby-identity-binding-pattern", "multiverse market nearby identity-binding pattern dataset id drifted");
  assert.deepEqual(
    pattern.checkedPositiveBindings.map((entry) => [entry.orderedInscriptionRow, entry.saveField, entry.serializedIdField, entry.buyHook, entry.prefabName, entry.playerFacingLabel]),
    [
      [78, "IS78Level", "IS78ID", "BuyIS78", "ChrystosEmporiumUpgrade78-ID78", "Inscryption 78: Ouroboros Orbs"],
      [83, "IS83Level", "IS83ID", "BuyIS83", "ChrystosEmporiumUpgrade83-ID83", "Inscryption 83: Fast-Loop ML"]
    ],
    "multiverse market nearby identity-binding pattern checkedPositiveBindings drifted"
  );
  pattern.checkedPositiveBindings.forEach((entry, index) => {
    assert.equal(entry.textHandlerOwner, "TextHandlerMarkets", `multiverse market nearby identity-binding pattern entry ${index} textHandlerOwner drifted`);
    assert.equal(entry.textHandlerScriptPath, "9\\Assets\\Scripts\\Text\\Text Ouroboros\\TextHandlerMarkets.cs", `multiverse market nearby identity-binding pattern entry ${index} textHandlerScriptPath drifted`);
    expectArray(entry.evidence, `multiverse market nearby identity-binding pattern entry ${index} evidence must be an array`);
  });
  assert.equal(pattern.recoveredPattern.patternName, "same-number nearby identity binding", "multiverse market nearby identity-binding pattern patternName drifted");
  assert.equal(pattern.recoveredPattern.orderedRowMappingStatus, "separate-input", "multiverse market nearby identity-binding pattern orderedRowMappingStatus drifted");
  assert.deepEqual(pattern.recoveredPattern.checkedPositiveRows, [78, 83], "multiverse market nearby identity-binding pattern checkedPositiveRows drifted");
  assert.deepEqual(pattern.recoveredPattern.checkedNegativeCarryoverRows, [69, 70, 71, 72, 73, 74], "multiverse market nearby identity-binding pattern checkedNegativeCarryoverRows drifted");
  assert.equal(pattern.recoveredPattern.helpsRows6974, false, "multiverse market nearby identity-binding pattern helpsRows6974 must remain false");
  assert.deepEqual(pattern.recoveredPattern.canonicalImportSafeSubset, [], "multiverse market nearby identity-binding pattern canonicalImportSafeSubset must remain empty");

  assert.match(stateDoc, /## Nearby checked inscription identity-binding pattern/, "multiverse market state verification doc must expose the nearby inscription identity-binding pattern section");
  assert.match(stateDoc, /ChrystosEmporiumUpgrade78-ID78/, "multiverse market state verification doc must preserve the row 78 direct prefab binding");
  assert.match(stateDoc, /ChrystosEmporiumUpgrade83-ID83/, "multiverse market state verification doc must preserve the row 83 direct prefab binding");
  assert.match(stateDoc, /the canonical import-safe subset stays empty/i, "multiverse market state verification doc must preserve the empty canonical subset conclusion for the nearby binding pattern");
  assert.match(verificationDoc, /## Nearby checked identity-binding pattern/, "multiverse market verification doc must expose the nearby identity-binding pattern section");
  assert.match(verificationDoc, /IS78Level`, `IS78ID`, `BuyIS78`, `ChrystosEmporiumUpgrade78-ID78`, `Inscryption 78: Ouroboros Orbs`/, "multiverse market verification doc must preserve the row 78 same-number binding chain");
  assert.match(verificationDoc, /IS83Level`, `IS83ID`, `BuyIS83`, `ChrystosEmporiumUpgrade83-ID83`, `Inscryption 83: Fast-Loop ML`/, "multiverse market verification doc must preserve the row 83 same-number binding chain");
  assert.match(verificationDoc, /does not ground rows `69-74`/i, "multiverse market verification doc must preserve the negative carryover for rows 69-74");
  assert.match(verificationDoc, /ChrystosEmporiumUpgrade69-ID57[\s\S]*ChrystosEmporiumUpgrade74-ID62/i, "multiverse market verification doc must preserve the recovered remap-band explanation");

  return {
    id: "multiverse-market-nearby-identity-binding-pattern",
    label: "Multiverse market nearby identity-binding pattern",
    classification: "extracted-mechanics",
    stats: [
      `${pattern.checkedPositiveBindings.length} checked positive binding examples`,
      `${pattern.recoveredPattern.checkedNegativeCarryoverRows.length} unresolved carryover rows`,
      "Nearby identity binding now checks direct same-number joins without widening row 69-74 identity"
    ]
  };
}

function validateMultiverseMarketInscriptionNumberingStabilityBoundary(boundary, stateDoc, verificationDoc) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market inscription numbering-stability boundary generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "multiverse market inscription numbering-stability boundary dataset id must be present");
  expectRecord(boundary.sources, "multiverse market inscription numbering-stability boundary sources must be an object");
  ["prefabRemapBoundary", "row7174RemapBand", "metadataNeighborhood", "uabeaProbeReport", "unityProbeReport", "nearbyIdentityBindingPattern", "verificationDoc"].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market inscription numbering-stability boundary sources.${field} must be present`);
  });
  expectRecord(boundary.checkedFieldStability, "multiverse market inscription numbering-stability boundary checkedFieldStability must be an object");
  expectRecord(boundary.checkedFieldStability.orderedSaveFieldRun, "multiverse market inscription numbering-stability boundary orderedSaveFieldRun must be an object");
  expectRecord(boundary.checkedFieldStability.serializedIdFieldRun, "multiverse market inscription numbering-stability boundary serializedIdFieldRun must be an object");
  expectRecord(boundary.checkedFieldStability.buyHookRun, "multiverse market inscription numbering-stability boundary buyHookRun must be an object");
  expectRecord(boundary.checkedFieldStability.prefabNumbering, "multiverse market inscription numbering-stability boundary prefabNumbering must be an object");
  expectRecord(boundary.checkedFieldStability.playerFacingStringAnchors, "multiverse market inscription numbering-stability boundary playerFacingStringAnchors must be an object");
  expectArray(boundary.checkedFieldStability.playerFacingStringAnchors.checkedAnchorRows, "multiverse market inscription numbering-stability boundary checkedAnchorRows must be an array");
  expectArray(boundary.checkedFieldStability.playerFacingStringAnchors.sameNumberPositiveRowsInsideStableResume, "multiverse market inscription numbering-stability boundary sameNumberPositiveRowsInsideStableResume must be an array");
  expectArray(boundary.brokenPrefabBand, "multiverse market inscription numbering-stability boundary brokenPrefabBand must be an array");
  expectArray(boundary.stableResumeEvidence, "multiverse market inscription numbering-stability boundary stableResumeEvidence must be an array");
  expectRecord(boundary.identityBindingBoundary, "multiverse market inscription numbering-stability boundary identityBindingBoundary must be an object");
  expectArray(boundary.identityBindingBoundary.brokenSameNumberPrefabBand, "multiverse market inscription numbering-stability boundary brokenSameNumberPrefabBand must be an array");
  expectArray(boundary.identityBindingBoundary.playerFacingIdentityRecoveredRows, "multiverse market inscription numbering-stability boundary playerFacingIdentityRecoveredRows must be an array");
  expectArray(boundary.identityBindingBoundary.playerFacingIdentityStillUnresolvedRows, "multiverse market inscription numbering-stability boundary playerFacingIdentityStillUnresolvedRows must be an array");
  expectArray(boundary.identityBindingBoundary.canonicalImportSafeSubset, "multiverse market inscription numbering-stability boundary canonicalImportSafeSubset must be an array");
  expectArray(boundary.currentBoundary, "multiverse market inscription numbering-stability boundary currentBoundary must be an array");

  assert.equal(boundary.dataset, "multiverse-market-inscription-numbering-stability-boundary", "multiverse market inscription numbering-stability boundary dataset id drifted");
  assert.deepEqual(
    [
      boundary.checkedFieldStability.orderedSaveFieldRun.fieldPattern,
      boundary.checkedFieldStability.orderedSaveFieldRun.stableStartRow,
      boundary.checkedFieldStability.orderedSaveFieldRun.stableEndRow,
      boundary.checkedFieldStability.orderedSaveFieldRun.status
    ],
    ["ISNLevel", 69, 110, "same-number-stable"],
    "multiverse market inscription numbering-stability boundary orderedSaveFieldRun drifted"
  );
  assert.deepEqual(
    [
      boundary.checkedFieldStability.serializedIdFieldRun.fieldPattern,
      boundary.checkedFieldStability.serializedIdFieldRun.stableStartRow,
      boundary.checkedFieldStability.serializedIdFieldRun.stableEndRow,
      boundary.checkedFieldStability.serializedIdFieldRun.status
    ],
    ["ISNID", 69, 110, "same-number-stable"],
    "multiverse market inscription numbering-stability boundary serializedIdFieldRun drifted"
  );
  assert.deepEqual(
    [
      boundary.checkedFieldStability.buyHookRun.fieldPattern,
      boundary.checkedFieldStability.buyHookRun.stableStartRow,
      boundary.checkedFieldStability.buyHookRun.stableEndRow,
      boundary.checkedFieldStability.buyHookRun.status
    ],
    ["BuyISN", 69, 110, "same-number-stable"],
    "multiverse market inscription numbering-stability boundary buyHookRun drifted"
  );
  assert.deepEqual(
    [
      boundary.checkedFieldStability.prefabNumbering.stableThroughRow,
      boundary.checkedFieldStability.prefabNumbering.brokenBandStartRow,
      boundary.checkedFieldStability.prefabNumbering.brokenBandEndRow,
      boundary.checkedFieldStability.prefabNumbering.stableResumeRow,
      boundary.checkedFieldStability.prefabNumbering.stableResumeEndRow
    ],
    [68, 69, 74, 75, 110],
    "multiverse market inscription numbering-stability boundary prefabNumbering drifted"
  );
  assert.deepEqual(boundary.checkedFieldStability.playerFacingStringAnchors.checkedAnchorRows, [25, 46, 78, 83], "multiverse market inscription numbering-stability boundary checkedAnchorRows drifted");
  assert.deepEqual(boundary.checkedFieldStability.playerFacingStringAnchors.sameNumberPositiveRowsInsideStableResume, [78, 83], "multiverse market inscription numbering-stability boundary sameNumberPositiveRowsInsideStableResume drifted");
  assert.equal(boundary.checkedFieldStability.playerFacingStringAnchors.status, "sparse-direct-anchors-only", "multiverse market inscription numbering-stability boundary playerFacingStringAnchors status drifted");
  assert.deepEqual(
    boundary.brokenPrefabBand.map((entry) => [entry.orderedInscriptionRow, entry.saveField, entry.serializedIdField, entry.buyHook, entry.prefabName, entry.remappedSerializedId]),
    [
      [69, "IS69Level", "IS69ID", "BuyIS69", "ChrystosEmporiumUpgrade69-ID57", 57],
      [70, "IS70Level", "IS70ID", "BuyIS70", "ChrystosEmporiumUpgrade70-ID58", 58],
      [71, "IS71Level", "IS71ID", "BuyIS71", "ChrystosEmporiumUpgrade71-ID59", 59],
      [72, "IS72Level", "IS72ID", "BuyIS72", "ChrystosEmporiumUpgrade72-ID60", 60],
      [73, "IS73Level", "IS73ID", "BuyIS73", "ChrystosEmporiumUpgrade73-ID61", 61],
      [74, "IS74Level", "IS74ID", "BuyIS74", "ChrystosEmporiumUpgrade74-ID62", 62]
    ],
    "multiverse market inscription numbering-stability boundary brokenPrefabBand drifted"
  );
  assert.deepEqual(
    boundary.stableResumeEvidence.map((entry) => [entry.orderedInscriptionRow, entry.saveField, entry.serializedIdField, entry.buyHook, entry.prefabName, entry.playerFacingLabel ?? null]),
    [
      [75, "IS75Level", "IS75ID", "BuyIS75", "ChrystosEmporiumUpgrade75-ID75", null],
      [78, "IS78Level", "IS78ID", "BuyIS78", "ChrystosEmporiumUpgrade78-ID78", "Inscryption 78: Ouroboros Orbs"],
      [83, "IS83Level", "IS83ID", "BuyIS83", "ChrystosEmporiumUpgrade83-ID83", "Inscryption 83: Fast-Loop ML"],
      [110, "IS110Level", "IS110ID", "BuyIS110", "ChrystosEmporiumUpgrade110-ID110", null]
    ],
    "multiverse market inscription numbering-stability boundary stableResumeEvidence drifted"
  );
  assert.equal(boundary.identityBindingBoundary.earliestBrokenSameNumberPrefabRow, 69, "multiverse market inscription numbering-stability boundary earliestBrokenSameNumberPrefabRow drifted");
  assert.deepEqual(boundary.identityBindingBoundary.brokenSameNumberPrefabBand, [69, 74], "multiverse market inscription numbering-stability boundary brokenSameNumberPrefabBand drifted");
  assert.equal(boundary.identityBindingBoundary.sameNumberPrefabResumesAtRow, 75, "multiverse market inscription numbering-stability boundary sameNumberPrefabResumesAtRow drifted");
  assert.equal(boundary.identityBindingBoundary.sameNumberPrefabStableThroughRow, 110, "multiverse market inscription numbering-stability boundary sameNumberPrefabStableThroughRow drifted");
  assert.deepEqual(boundary.identityBindingBoundary.playerFacingIdentityRecoveredRows, [78, 83], "multiverse market inscription numbering-stability boundary playerFacingIdentityRecoveredRows drifted");
  assert.equal(boundary.identityBindingBoundary.helpsUnresolvedRows7174, false, "multiverse market inscription numbering-stability boundary helpsUnresolvedRows7174 must remain false");
  assert.deepEqual(boundary.identityBindingBoundary.canonicalImportSafeSubset, [], "multiverse market inscription numbering-stability boundary canonicalImportSafeSubset must remain empty");

  assert.match(stateDoc, /## Checked wider inscription numbering-stability boundary/, "multiverse market state verification doc must expose the wider numbering-stability boundary section");
  assert.match(stateDoc, /same-number prefab numbering is stable through row `68`/i, "multiverse market state verification doc must preserve the stable-through-68 conclusion");
  assert.match(stateDoc, /same-number prefab numbering is broken from rows `69-74`/i, "multiverse market state verification doc must preserve the broken 69-74 conclusion");
  assert.match(stateDoc, /same-number prefab numbering resumes at row `75` and stays direct through row `110`/i, "multiverse market state verification doc must preserve the resumed 75-110 conclusion");
  assert.match(verificationDoc, /## Wider checked inscription numbering-stability boundary/, "multiverse market verification doc must expose the wider numbering-stability boundary section");
  assert.match(verificationDoc, /ChrystosEmporiumUpgrade69-ID57/, "multiverse market verification doc must preserve the earliest broken prefab row");
  assert.match(verificationDoc, /ChrystosEmporiumUpgrade110-ID110/, "multiverse market verification doc must preserve the far-end stable resume evidence");
  assert.match(verificationDoc, /this wider numbering boundary still does not ground new player-facing identity for unresolved rows, including `69-74`/i, "multiverse market verification doc must preserve the unresolved identity conclusion");

  return {
    id: "multiverse-market-inscription-numbering-stability-boundary",
    label: "Multiverse market inscription numbering-stability boundary",
    classification: "extracted-mechanics",
    stats: [
      "Same-number save, id, and buy hooks stay stable across checked IS69-110",
      "Prefab numbering breaks only in the checked 69-74 band and resumes at 75-110",
      "Player-facing identity remains directly anchored only at rows 78 and 83"
    ]
  };
}

function validateMultiverseMarket6974AnomalyProvenance(boundary, stateDoc, verificationDoc, provenanceDoc) {
  expectNonEmptyString(boundary.generatedAt, "multiverse market 69-74 anomaly provenance generatedAt must be present");
  expectNonEmptyString(boundary.dataset, "multiverse market 69-74 anomaly provenance dataset id must be present");
  expectRecord(boundary.sources, "multiverse market 69-74 anomaly provenance sources must be an object");
  [
    "rawAppSideAsset",
    "rawUnityProbeReport",
    "rawUabeaProbeReport",
    "derivedPrefabRemapBoundary",
    "derivedRow7174RemapBand",
    "derivedNumberingStabilityBoundary",
    "derivedRow6974IdentitySourceBoundary",
    "verificationDoc",
    "stateVerificationDoc"
  ].forEach((field) => {
    expectNonEmptyString(boundary.sources[field], `multiverse market 69-74 anomaly provenance sources.${field} must be present`);
  });
  expectRecord(boundary.settledAnomaly, "multiverse market 69-74 anomaly provenance settledAnomaly must be an object");
  expectArray(boundary.settledAnomaly.sameNumberAlignmentLayers, "multiverse market 69-74 anomaly provenance sameNumberAlignmentLayers must be an array");
  expectArray(boundary.settledAnomaly.brokenPrefabBandRows, "multiverse market 69-74 anomaly provenance brokenPrefabBandRows must be an array");
  expectArray(boundary.settledAnomaly.prefabRemapPairs, "multiverse market 69-74 anomaly provenance prefabRemapPairs must be an array");
  expectArray(boundary.settledAnomaly.playerFacingIdentityRecoveredRowsInBand, "multiverse market 69-74 anomaly provenance playerFacingIdentityRecoveredRowsInBand must be an array");
  expectArray(boundary.pipelineStages, "multiverse market 69-74 anomaly provenance pipelineStages must be an array");
  expectRecord(boundary.provenanceConclusion, "multiverse market 69-74 anomaly provenance provenanceConclusion must be an object");
  expectRecord(boundary.standardizationDecision, "multiverse market 69-74 anomaly provenance standardizationDecision must be an object");
  expectArray(boundary.currentBoundary, "multiverse market 69-74 anomaly provenance currentBoundary must be an array");

  assert.equal(boundary.dataset, "multiverse-market-69-74-anomaly-provenance", "multiverse market 69-74 anomaly provenance dataset id drifted");
  assert.deepEqual(
    boundary.settledAnomaly.sameNumberAlignmentLayers,
    ["IS69Level through IS74Level", "IS69ID through IS74ID", "BuyIS69 through BuyIS74"],
    "multiverse market 69-74 anomaly provenance sameNumberAlignmentLayers drifted"
  );
  assert.deepEqual(boundary.settledAnomaly.brokenPrefabBandRows, [69, 70, 71, 72, 73, 74], "multiverse market 69-74 anomaly provenance brokenPrefabBandRows drifted");
  assert.deepEqual(boundary.settledAnomaly.prefabRemapPairs, ["69->57", "70->58", "71->59", "72->60", "73->61", "74->62"], "multiverse market 69-74 anomaly provenance prefabRemapPairs drifted");
  assert.deepEqual(boundary.settledAnomaly.playerFacingIdentityRecoveredRowsInBand, [], "multiverse market 69-74 anomaly provenance playerFacingIdentityRecoveredRowsInBand must stay empty");
  assert.deepEqual(
    boundary.pipelineStages.map((stage) => [stage.stageId, stage.classification, stage.anomalyPresent]),
    [
      ["raw-app-side-asset", "raw-app-side", true],
      ["raw-app-side-probe-reports", "raw-app-side", true],
      ["repo-local-derived-boundaries", "repo-local-derived", true]
    ],
    "multiverse market 69-74 anomaly provenance pipelineStages drifted"
  );
  assert.equal(boundary.provenanceConclusion.earliestCheckedAppearanceStage, "raw-app-side-asset", "multiverse market 69-74 anomaly provenance earliestCheckedAppearanceStage drifted");
  assert.equal(boundary.provenanceConclusion.anomalyOwner, "app-side-inherited", "multiverse market 69-74 anomaly provenance anomalyOwner drifted");
  assert.equal(boundary.provenanceConclusion.repoLocalIntroductionDetected, false, "multiverse market 69-74 anomaly provenance repoLocalIntroductionDetected must remain false");
  assert.equal(boundary.provenanceConclusion.firstRepoLocalTransformationThatIntroducesAnomaly, null, "multiverse market 69-74 anomaly provenance firstRepoLocalTransformationThatIntroducesAnomaly must remain null");
  assert.equal(boundary.standardizationDecision.standardizationAllowed, false, "multiverse market 69-74 anomaly provenance standardizationAllowed must remain false");
  assert.equal(boundary.standardizationDecision.standardizationApplied, false, "multiverse market 69-74 anomaly provenance standardizationApplied must remain false");
  assert.match(boundary.standardizationDecision.boundary, /Preserve the anomaly/i, "multiverse market 69-74 anomaly provenance boundary text drifted");
  assert.match(boundary.standardizationDecision.reason, /already present in preserved app-side asset and probe evidence/i, "multiverse market 69-74 anomaly provenance reason drifted");

  assert.match(stateDoc, /## Checked `69-74` anomaly provenance boundary/, "multiverse market state verification doc must expose the anomaly provenance section");
  assert.match(stateDoc, /app-side inherited rather than repo-local/i, "multiverse market state verification doc must preserve the app-side inherited conclusion");
  assert.match(verificationDoc, /## Checked 69-74 anomaly provenance boundary/, "multiverse market verification doc must expose the anomaly provenance section");
  assert.match(verificationDoc, /earliest checked appearance of the `69-74` anomaly is raw app-side evidence/i, "multiverse market verification doc must preserve the raw-source earliest appearance conclusion");
  assert.match(provenanceDoc, /earliest checked appearance is raw app-side evidence/i, "multiverse market anomaly provenance doc must preserve the earliest checked appearance conclusion");
  assert.match(provenanceDoc, /No dataset standardization is applied in this lane\./, "multiverse market anomaly provenance doc must preserve the no-standardization conclusion");

  return {
    id: "multiverse-market-69-74-anomaly-provenance",
    label: "Multiverse market 69-74 anomaly provenance",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.pipelineStages.length} checked pipeline stages`,
      `${boundary.settledAnomaly.prefabRemapPairs.length} settled prefab remap pairs`,
      "69-74 anomaly is inherited from raw app-side evidence, so no standardization is applied"
    ]
  };
}

function validateTokenBankControllerShell(shell) {
  expectNonEmptyString(shell.generatedAt, "token-bank controller shell generatedAt must be present");
  expectRecord(shell.sources, "token-bank controller shell sources must be an object");
  ["probe", "metadata", "level0"].forEach((field) => {
    expectNonEmptyString(shell.sources[field], `token-bank controller shell sources.${field} must be present`);
  });
  expectArray(shell.controllerAnchors, "token-bank controller shell controllerAnchors must be an array");
  expectArray(shell.adjacentControllerMethods, "token-bank controller shell adjacentControllerMethods must be an array");
  expectRecord(shell.sourcePresence, "token-bank controller shell sourcePresence must be an object");
  expectRecord(shell.sourcePresence.metadata, "token-bank controller shell sourcePresence.metadata must be an object");
  expectRecord(shell.sourcePresence.level0, "token-bank controller shell sourcePresence.level0 must be an object");
  expectArray(shell.currentBoundary, "token-bank controller shell currentBoundary must be an array");

  ["TokenShop", "ClaimBankedTokens", "SetBankFill", "BankFill", "TokenBankDescriptionText", "CheckTokenClaimNotification", "TokenShopButtonNotification"].forEach((name) => {
    assert.ok(shell.controllerAnchors.includes(name), `token-bank controller shell missing ${name}`);
  });
  ["get_TokenBankCap", "get_ClaimableBankTokens", "IncreaseBankedTokens"].forEach((name) => {
    assert.ok(shell.adjacentControllerMethods.includes(name), `token-bank controller shell missing ${name}`);
  });
  ["TokenShop", "ClaimBankedTokens", "SetBankFill", "BankFill", "TokenBankDescriptionText", "CheckTokenClaimNotification", "TokenShopButtonNotification", "get_TokenBankCap", "get_ClaimableBankTokens", "IncreaseBankedTokens"].forEach((name) => {
    assert.equal(shell.sourcePresence.metadata[name], 1, `token-bank controller shell metadata presence drifted for ${name}`);
  });
  assert.equal(shell.sourcePresence.level0.ClaimBankedTokens, 1, "token-bank controller shell level0 ClaimBankedTokens drifted");
  assert.equal(shell.sourcePresence.level0.BankedDescriptionTextIncrease, 1, "token-bank controller shell level0 BankedDescriptionTextIncrease drifted");

  return {
    id: "token-bank-controller-shell",
    label: "Token-bank controller shell",
    classification: "extracted-mechanics",
    stats: [
      `${shell.controllerAnchors.length} controller anchors`,
      `${shell.adjacentControllerMethods.length} adjacent controller methods`,
      "Token-bank controller shell now preserves its narrow TokenShop-side cluster"
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
  assert.equal(contract.datasets.length, 55, "bundled dataset contract must track the fifty-five shipped dataset groups");

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

async function validateRequiredProbeDocPairs() {
  for (const pair of REQUIRED_PROBE_DOC_PAIRS) {
    const datasetUrl = new URL(`../../${pair.datasetPath}`, import.meta.url);
    const docUrl = new URL(`../../${pair.docPath}`, import.meta.url);

    await access(datasetUrl);
    try {
      await access(docUrl);
    } catch (error) {
      throw new Error(
        `Required probe doc is missing for ${pair.datasetPath}: expected ${pair.docPath}`,
        { cause: error }
      );
    }
  }
}

export async function validateBundledDatasets() {
  const bundledDatasetContract = await validateBundledDatasetContract(
    await readJson("../../data/bundled-dataset-contract.v1.json")
  );
  await validateRequiredProbeDocPairs();
  const snapshot = await readJson("../../data/game-data.snapshot.v1.json");
  const shardMilestones = await readJson("../../data/shard-milestones.grounded.v1.json");
  const shardObserved = await readJson("../../data/shard-observed-behaviors.grounded.v1.json");
  const shardProvenance = await readJson("../../data/shard-milestones-provenance.grounded.v1.json");
  const shardAssetGrounding = await readJson("../../data/shard-asset-grounding.v1.json");
  const shardOwnerFamilyBoundary = await readJson("../../data/shard-owner-family-boundary.v1.json");
  const shardFinalSuBonusBoundary = await readJson("../../data/shard-finalsu-bonus-boundary.v1.json");
  const shardMilestonePayloadBoundary = await readJson("../../data/shard-milestone-payload-boundary.v1.json");
  const shardCostModelBoundary = await readJson("../../data/shard-cost-model-boundary.v1.json");
  const shardMilestoneRowModelBoundary = await readJson("../../data/shard-milestone-row-model-boundary.v1.json");
  const shardMilestoneTitleEffectBoundary = await readJson("../../data/shard-milestone-title-effect-boundary.v1.json");
  const shardEffectTextHandlerBoundary = await readJson("../../data/shard-effect-text-handler-boundary.v1.json");
  const shardMilestoneRowShellBoundary = await readJson("../../data/shard-milestone-row-shell-boundary.v1.json");
  const shardMilestoneRowAlignmentBoundary = await readJson("../../data/shard-milestone-row-alignment-boundary.v1.json");
  const shardMilestoneHandoffBoundary = await readJson("../../data/shard-milestone-handoff-boundary.v1.json");
  const shardSaveBoundary = await readJson("../../data/shard-save-boundary.v1.json");
  const shardMilestoneSaveOwnerCandidates = await readJson("../../data/shard-milestone-save-owner-candidates.v1.json");
  const shardSceneMonoBehaviourProbe = await readJson("../../data/shard-scene-monobehaviour-probe.v1.json");
  const shardCostParameterProbe = await readJson("../../data/shard-cost-parameter-probe.v1.json");
  const shardCostMethodProbe = await readJson("../../data/shard-cost-method-probe.v1.json");
  const shardCostNativeProbe = await readJson("../../data/shard-cost-native-probe.v1.json");
  const shardCostScreenshotCalibration = await readJson("../../data/shard-cost-screenshot-calibration.v1.json");
  const shardCostListPathProbe = await readJson("../../data/shard-cost-list-path-probe.v1.json");
  const shardCostFormulaModel = await readJson("../../data/shard-cost-formula-model.v1.json");
  const shardBonusSlotProbe = await readJson("../../data/shard-bonus-slot-probe.v1.json");
  const shardTypeMetadataProbe = await readJson("../../data/shard-type-metadata-probe.v1.json");
  const extractionCandidateFamilies = await readJson("../../data/extraction-candidate-families.v1.json");
  const extractionCandidateRanking = await readJson("../../data/extraction-candidate-ranking.v1.json");
  const tokenShop = await readJson("../../data/token-shop-values.json");
  const multiverseMarket = await readJson("../../data/multiverse-market-values.json");
  const multiverseMarketMetadataNeighborhood = await readJson("../../data/multiverse-market-metadata-neighborhood.json");
  const tokeniumNamingClues = await readJson("../../data/tokenium-naming-clues.json");
  const tokenBankStateClues = await readJson("../../data/token-bank-state-clues.json");
  const dailyTokeniumLaneClues = await readJson("../../data/daily-tokenium-lane-clues.json");
  const tokenBankFormulaBoundary = await readJson("../../data/token-bank-formula-boundary.json");
  const multiverseMarketRangeBoundary = await readJson("../../data/multiverse-market-range-boundary.json");
  const multiverseMarketRowTextCoverage = await readJson("../../data/multiverse-market-row-text-coverage.json");
  const multiverseMarketPrefabRemapBoundary = await readJson("../../data/multiverse-market-prefab-remap-boundary.json");
  const tokenShopCostLanes = await readJson("../../data/token-shop-cost-lanes.json");
  const spendActionLaneClues = await readJson("../../data/spend-action-lane-clues.json");
  const multiverseMarketActionShell = await readJson("../../data/multiverse-market-action-shell.json");
  const multiverseMarketOwnerFamily = await readJson("../../data/multiverse-market-owner-family.json");
  const tokenShopOwnerShell = await readJson("../../data/token-shop-owner-shell.json");
  const tokenShopSaveBoundary = await readJson("../../data/token-shop-save-boundary.json");
  const tokenShopRowLevelOwner = await readJson("../../data/token-shop-row-level-owner.json");
  const tokenShopRowRemapBoundary = await readJson("../../data/token-shop-row-remap-boundary.json");
  const multiverseMarketSaveBoundary = await readJson("../../data/multiverse-market-save-boundary.json");
  const multiverseMarketMarketMemberBoundary = await readJson("../../data/multiverse-market-market-member-boundary.json");
  const multiverseMarketSaveDataImportBoundary = await readJson("../../data/multiverse-market-savedata-import-boundary.json");
  const multiverseMarketRow6974IdentitySourceBoundary = await readJson("../../data/multiverse-market-row69-74-identity-source-boundary.json");
  const multiverseMarketSerializedLabelSourceBoundary = await readJson("../../data/multiverse-market-serialized-label-source-boundary.json");
  const multiverseMarketRow7174IdentityBoundary = await readJson("../../data/multiverse-market-row71-74-identity-boundary.json");
  const multiverseMarketRow7174RemapBand = await readJson("../../data/multiverse-market-row71-74-remap-band.json");
  const multiverseMarketNearbyIdentityBindingPattern = await readJson("../../data/multiverse-market-nearby-identity-binding-pattern.json");
  const multiverseMarketInscriptionNumberingStabilityBoundary = await readJson("../../data/multiverse-market-inscription-numbering-stability-boundary.json");
  const multiverseMarket6974AnomalyProvenance = await readJson("../../data/multiverse-market-69-74-anomaly-provenance.json");
  const tokenBankControllerShell = await readJson("../../data/token-bank-controller-shell.json");
  const multiverseMarketMarketMemberBoundaryDoc = await readText("../../docs/systems/spend/multiverse-market-market-member-boundary.md");
  const multiverseMarketStateVerificationDoc = await readText("../../docs/systems/spend/multiverse-market-state-verification.md");
  const multiverseMarketVerificationDoc = await readText("../../docs/systems/spend/multiverse-market-verification.md");
  const multiverseMarketSerializedLabelSourceBoundaryDoc = await readText("../../docs/systems/spend/multiverse-market-serialized-label-source-boundary.md");
  const multiverseMarket6974AnomalyProvenanceDoc = await readText("../../docs/systems/spend/multiverse-market-69-74-anomaly-provenance.md");
  const activeGroundingBoundariesDoc = await readText("../../docs/roadmap/active-grounding-boundaries.md");

  const summaries = [
    validateSnapshot(snapshot),
    validateShardDatasets(shardMilestones, shardObserved, shardProvenance),
    validateShardAssetGrounding(shardAssetGrounding),
    validateShardOwnerFamilyBoundary(shardOwnerFamilyBoundary),
    validateShardFinalSuBonusBoundary(shardFinalSuBonusBoundary),
    validateShardMilestonePayloadBoundary(shardMilestonePayloadBoundary),
    validateShardCostModelBoundary(shardCostModelBoundary),
    validateShardMilestoneRowModelBoundary(shardMilestoneRowModelBoundary),
    validateShardMilestoneTitleEffectBoundary(shardMilestoneTitleEffectBoundary),
    validateShardEffectTextHandlerBoundary(shardEffectTextHandlerBoundary),
    validateShardMilestoneRowShellBoundary(shardMilestoneRowShellBoundary),
    validateShardMilestoneRowAlignmentBoundary(shardMilestoneRowAlignmentBoundary),
    validateShardMilestoneHandoffBoundary(shardMilestoneHandoffBoundary),
    validateShardSaveBoundary(shardSaveBoundary),
    validateShardMilestoneSaveOwnerCandidates(shardMilestoneSaveOwnerCandidates),
    validateShardSceneMonoBehaviourProbe(shardSceneMonoBehaviourProbe),
    validateShardCostParameterProbe(shardCostParameterProbe),
    validateShardCostMethodProbe(shardCostMethodProbe),
    validateShardCostNativeProbe(shardCostNativeProbe),
    validateShardCostScreenshotCalibration(shardCostScreenshotCalibration),
    validateShardCostListPathProbe(shardCostListPathProbe),
    validateShardCostFormulaModel(shardCostFormulaModel),
    validateShardBonusSlotProbe(shardBonusSlotProbe),
    validateShardTypeMetadataProbe(shardTypeMetadataProbe),
    validateExtractionCandidateFamilies(extractionCandidateFamilies),
    validateExtractionCandidateRanking(extractionCandidateRanking),
    validateTokenShop(tokenShop),
    validateMultiverseMarket(multiverseMarket),
    validateMultiverseMarketMetadataNeighborhood(multiverseMarketMetadataNeighborhood),
    validateTokeniumNamingClues(tokeniumNamingClues),
    validateTokenBankStateClues(tokenBankStateClues),
    validateDailyTokeniumLaneClues(dailyTokeniumLaneClues),
    validateTokenBankFormulaBoundary(tokenBankFormulaBoundary),
    validateMultiverseMarketRangeBoundary(multiverseMarketRangeBoundary),
    validateMultiverseMarketRowTextCoverage(multiverseMarketRowTextCoverage),
    validateMultiverseMarketPrefabRemapBoundary(multiverseMarketPrefabRemapBoundary),
    validateTokenShopCostLanes(tokenShopCostLanes),
    validateSpendActionLaneClues(spendActionLaneClues),
    validateMultiverseMarketActionShell(multiverseMarketActionShell),
    validateMultiverseMarketOwnerFamily(multiverseMarketOwnerFamily),
    validateTokenShopOwnerShell(tokenShopOwnerShell),
    validateTokenShopSaveBoundary(tokenShopSaveBoundary),
    validateTokenShopRowLevelOwner(tokenShopRowLevelOwner),
    validateTokenShopRowRemapBoundary(tokenShopRowRemapBoundary),
    validateMultiverseMarketSaveBoundary(multiverseMarketSaveBoundary),
    validateMultiverseMarketMarketMemberBoundary(multiverseMarketMarketMemberBoundary),
    validateMultiverseMarketSaveDataImportBoundary(multiverseMarketSaveDataImportBoundary, multiverseMarketStateVerificationDoc),
    validateMultiverseMarketRow6974IdentitySourceBoundary(multiverseMarketRow6974IdentitySourceBoundary, multiverseMarketStateVerificationDoc, multiverseMarketVerificationDoc),
    validateMultiverseMarketSerializedLabelSourceBoundary(multiverseMarketSerializedLabelSourceBoundary, multiverseMarketStateVerificationDoc, multiverseMarketVerificationDoc, multiverseMarketSerializedLabelSourceBoundaryDoc),
    validateMultiverseMarketRow7174IdentityBoundary(multiverseMarketRow7174IdentityBoundary, multiverseMarketStateVerificationDoc, multiverseMarketVerificationDoc),
    validateMultiverseMarketRow7174RemapBand(multiverseMarketRow7174RemapBand, multiverseMarketStateVerificationDoc, multiverseMarketVerificationDoc),
    validateMultiverseMarketNearbyIdentityBindingPattern(multiverseMarketNearbyIdentityBindingPattern, multiverseMarketStateVerificationDoc, multiverseMarketVerificationDoc),
    validateMultiverseMarketInscriptionNumberingStabilityBoundary(multiverseMarketInscriptionNumberingStabilityBoundary, multiverseMarketStateVerificationDoc, multiverseMarketVerificationDoc),
    validateMultiverseMarket6974AnomalyProvenance(multiverseMarket6974AnomalyProvenance, multiverseMarketStateVerificationDoc, multiverseMarketVerificationDoc, multiverseMarket6974AnomalyProvenanceDoc),
    validateTokenBankControllerShell(tokenBankControllerShell)
  ];

  validateMultiverseMarketMarketShellDocs(
    multiverseMarketMarketMemberBoundaryDoc,
    multiverseMarketStateVerificationDoc,
    activeGroundingBoundariesDoc
  );

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
