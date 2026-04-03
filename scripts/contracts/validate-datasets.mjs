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

function validateExtractionCandidateFamilies(families) {
  expectNonEmptyString(families.dataset, "extraction candidate families dataset id must be present");
  expectNonEmptyString(families.generatedAt, "extraction candidate families generatedAt must be present");
  expectArray(families.binaryFiles, "extraction candidate families binaryFiles must be an array");
  expectArray(families.textFiles, "extraction candidate families textFiles must be an array");
  expectArray(families.globalContextTerms, "extraction candidate families globalContextTerms must be an array");
  expectArray(families.unresolvedMarkers, "extraction candidate families unresolvedMarkers must be an array");
  expectArray(families.families, "extraction candidate families families must be an array");
  assert.ok(families.families.length >= 8, "extraction candidate families must preserve the seeded family set");
  families.families.forEach((entry, index) => {
    expectNonEmptyString(entry.id, `extraction candidate families[${index}].id must be present`);
    expectNonEmptyString(entry.label, `extraction candidate families[${index}].label must be present`);
    expectNonEmptyString(entry.track, `extraction candidate families[${index}].track must be present`);
    expectArray(entry.terms, `extraction candidate families[${index}].terms must be an array`);
    expectArray(entry.anchors, `extraction candidate families[${index}].anchors must be an array`);
  });
  assert.ok(families.families.some((entry) => entry.id === "shards.milestone-owner-family"), "extraction candidate families must preserve the shard milestone owner family");
  assert.ok(families.families.some((entry) => entry.id === "spend.multiverse-market-owner-family"), "extraction candidate families must preserve the MultiverseMarket owner family");

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
  assert.ok(ranking.candidates.length >= 8, "extraction candidate ranking must preserve the scored candidate set");
  expectNonEmptyString(ranking.topCandidate.id, "extraction candidate ranking topCandidate.id must be present");
  expectNonEmptyString(ranking.topCandidate.track, "extraction candidate ranking topCandidate.track must be present");
  assert.equal(typeof ranking.topCandidate.heuristicScore, "number", "extraction candidate ranking topCandidate.heuristicScore must be numeric");
  assert.equal(ranking.topCandidate.id, "spend.multiverse-market-owner-family", "extraction candidate ranking topCandidate.id drifted");
  assert.equal(ranking.topCandidate.track, "spend-planner-from-extracted-data", "extraction candidate ranking topCandidate.track drifted");
  const shardCandidate = ranking.candidates.find((entry) => entry.track === "shards-and-loop-guardrails");
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
  assert.ok(neighborhood.results.length >= 7, "multiverse metadata neighborhood should preserve the narrowed anchor set");

  const anchors = neighborhood.results.map((entry) => entry.anchor);
  ["CloudSavePlayerProfile", "PlayerProfileData", "FillPlayerProfileData", "GetPlayerProfileData", "InscryptionsDone", "SetAllChrystosEmporiumTexts", "Mech1Unlocked"].forEach((anchor) => {
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

  return {
    id: "multiverse-market-metadata-neighborhood",
    label: "Multiverse market metadata neighborhood",
    classification: "extracted-mechanics",
    stats: [
      `${neighborhood.anchor_count} probe anchors`,
      `${neighborhood.results.length} tracked anchor groups`,
      "CloudSavePlayerProfile, PlayerProfileData, and InscryptionsDone save-side clues"
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
  expectArray(clues.tokenShopMethods, "token-bank state clues tokenShopMethods must be an array");
  expectArray(clues.tokenShopControllerRefs, "token-bank state clues tokenShopControllerRefs must be an array");
  expectArray(clues.displayOrHandlerClues, "token-bank state clues displayOrHandlerClues must be an array");
  expectArray(clues.derivedOutputs, "token-bank state clues derivedOutputs must be an array");
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

  return {
    id: "token-bank-state-clues",
    label: "Token-bank state clues",
    classification: "extracted-mechanics",
    stats: [
      `${clues.tokenShopMethods.length} token-bank controller methods`,
      `${clues.displayOrHandlerClues.length} display or handler clues`,
      "TokenShop, TokenBankCap, and LM244 split clues"
    ]
  };
}

function validateDailyTokeniumLaneClues(clues) {
  expectNonEmptyString(clues.generatedAt, "daily tokenium lane clues generatedAt must be present");
  expectRecord(clues.sources, "daily tokenium lane clues sources must be an object");
  ["metadata", "level0", "iapCatalog", "probe", "academySprite"].forEach((field) => {
    expectNonEmptyString(clues.sources[field], `daily tokenium lane clues sources.${field} must be present`);
  });
  expectArray(clues.ownerFamilyClues, "daily tokenium lane clues ownerFamilyClues must be an array");
  expectArray(clues.modifierClues, "daily tokenium lane clues modifierClues must be an array");
  expectArray(clues.premiumModifierClues, "daily tokenium lane clues premiumModifierClues must be an array");
  expectArray(clues.playerFacingStrings, "daily tokenium lane clues playerFacingStrings must be an array");
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

  return {
    id: "daily-tokenium-lane-clues",
    label: "Daily Tokenium lane clues",
    classification: "extracted-mechanics",
    stats: [
      `${clues.ownerFamilyClues.length} academy or mission owner clues`,
      `${clues.modifierClues.length} lane modifier clues`,
      "SpaceAcademy, FarmMissions, and Collector pack lane clues"
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
  assert.deepEqual(boundary.metadataIsLevels, [99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110], "multiverse market range boundary metadataIsLevels drifted");
  assert.equal(boundary.metadataIsRangeLabel, "IS99Level through IS110Level", "multiverse market range boundary metadataIsRangeLabel drifted");
  assert.equal(boundary.overlapIds.length, 0, "multiverse market range boundary should preserve the current zero-overlap result");

  return {
    id: "multiverse-market-range-boundary",
    label: "Multiverse market range boundary",
    classification: "extracted-mechanics",
    stats: [
      `${boundary.validatedRowIds.length} validated row ids`,
      `${boundary.metadataIsLevels.length} recovered metadata IS levels`,
      "Validated row block and recovered IS run do not currently overlap"
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
  assert.equal(contract.datasets.length, 22, "bundled dataset contract must track the twenty-two shipped dataset groups");

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
  const shardAssetGrounding = await readJson("../../data/shard-asset-grounding.v1.json");
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
  const tokenShopCostLanes = await readJson("../../data/token-shop-cost-lanes.json");
  const spendActionLaneClues = await readJson("../../data/spend-action-lane-clues.json");
  const multiverseMarketActionShell = await readJson("../../data/multiverse-market-action-shell.json");
  const multiverseMarketOwnerFamily = await readJson("../../data/multiverse-market-owner-family.json");
  const tokenShopOwnerShell = await readJson("../../data/token-shop-owner-shell.json");
  const tokenShopSaveBoundary = await readJson("../../data/token-shop-save-boundary.json");
  const multiverseMarketSaveBoundary = await readJson("../../data/multiverse-market-save-boundary.json");
  const tokenBankControllerShell = await readJson("../../data/token-bank-controller-shell.json");

  const summaries = [
    validateSnapshot(snapshot),
    validateShardDatasets(shardMilestones, shardObserved, shardProvenance),
    validateShardAssetGrounding(shardAssetGrounding),
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
    validateTokenShopCostLanes(tokenShopCostLanes),
    validateSpendActionLaneClues(spendActionLaneClues),
    validateMultiverseMarketActionShell(multiverseMarketActionShell),
    validateMultiverseMarketOwnerFamily(multiverseMarketOwnerFamily),
    validateTokenShopOwnerShell(tokenShopOwnerShell),
    validateTokenShopSaveBoundary(tokenShopSaveBoundary),
    validateMultiverseMarketSaveBoundary(multiverseMarketSaveBoundary),
    validateTokenBankControllerShell(tokenBankControllerShell)
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
