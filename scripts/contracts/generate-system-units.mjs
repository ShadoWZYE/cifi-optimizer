import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createDefaultPlayerProfile,
  PLAYER_PROFILE_SCHEMA_VERSION,
  QUARANTINED_MULTIVERSE_MARKET_STATUS
} from "../../player-profile.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataRoot = path.join(repoRoot, "data");
const outputRoot = path.join(dataRoot, "system-units");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function writeJson(relativePath, value) {
  const outputPath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function groupAliasesById(aliasAudit) {
  return Object.fromEntries(
    (Array.isArray(aliasAudit.groups) ? aliasAudit.groups : []).map((group) => [group.id, group])
  );
}

function pickPlayerStateDefaults(defaultProfile) {
  return {
    meta: defaultProfile.meta,
    player: defaultProfile.player,
    planning: defaultProfile.planning,
    notes: defaultProfile.notes,
    externalModels: defaultProfile.externalModels,
    compatibility: defaultProfile.compatibility
  };
}

async function buildPlayerStateUnit() {
  const unitInventory = await readJson("data/units/player-state.v1.json");
  const snapshot = await readJson("data/game-data.snapshot.v1.json");
  const aliasAudit = await readJson("data/player-profile-import-aliases.v1.json");
  const aliasGroups = groupAliasesById(aliasAudit);
  const defaultProfile = createDefaultPlayerProfile();

  const sections = {
    canonicalSharedTruth: {
      schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
      defaultShape: {
        meta: defaultProfile.meta,
        player: defaultProfile.player,
        notes: defaultProfile.notes
      },
      aliasGroup: aliasGroups.canonical ?? null,
      snapshotReference: {
        snapshotVersion: snapshot.snapshotVersion,
        researchTracks: Array.isArray(snapshot.researchTracks) ? snapshot.researchTracks.length : 0,
        validationCases: Array.isArray(snapshot.validationCases)
          ? snapshot.validationCases.length
          : 0
      },
      provenanceSources: ["snapshot", "player-profile-normalizer", "player-profile-schema-doc"]
    },
    plannerHelpers: {
      defaultShape: defaultProfile.planning,
      aliasGroup: aliasGroups.planner ?? null,
      provenanceSources: ["player-profile-alias-audit", "player-profile-normalizer"]
    },
    externalModels: {
      defaultShape: defaultProfile.externalModels,
      aliasGroups: [aliasGroups.externalModel, aliasGroups.experimental, aliasGroups.shipCalibration]
        .filter(Boolean),
      provenanceSources: ["player-profile-alias-audit", "player-profile-normalizer"]
    },
    compatibilityImports: {
      defaultShape: defaultProfile.compatibility,
      aliasGroup: aliasGroups.compatibility ?? null,
      quarantineLabels: {
        multiverseMarket: QUARANTINED_MULTIVERSE_MARKET_STATUS,
        shardMilestoneState: "quarantined-unmapped"
      },
      provenanceSources: [
        "player-profile-alias-audit",
        "player-profile-normalizer",
        "player-profile-schema-doc"
      ]
    },
    aliasAudit: aliasAudit
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "player-state",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/player-state.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {
      sharedTruth: sections.canonicalSharedTruth
    },
    boundaries: {},
    models: {
      externalModels: sections.externalModels
    },
    support: {
      plannerHelpers: sections.plannerHelpers,
      compatibilityImports: sections.compatibilityImports,
      aliasAudit: sections.aliasAudit
    },
    traceEvidence: {}
  });
}

function datasetSection(path, data, provenanceSources) {
  return {
    sourcePath: path,
    provenanceSources,
    data
  };
}

async function traceRunSection(relativePath, provenanceSources) {
  return datasetSection(relativePath, await readJson(relativePath), provenanceSources);
}

function withTargetShape(unit, targetShape) {
  return {
    ...unit,
    canonical: targetShape.canonical ?? {},
    boundaries: targetShape.boundaries ?? {},
    models: targetShape.models ?? {},
    support: targetShape.support ?? {},
    traceEvidence: targetShape.traceEvidence ?? {}
  };
}

async function buildTokenShopUnit() {
  const unitInventory = await readJson("data/units/token-shop.v1.json");
  const tokenShopValues = await readJson("data/token-shop-values.json");
  const tokenShopCanonical = await readJson("data/tokenshop-canonical-v1.json");
  const tokenShopSaveBoundary = await readJson("data/token-shop-save-boundary.json");
  const tokenShopRowLevelOwner = await readJson("data/token-shop-row-level-owner.json");
  const tokenShopRowRemapBoundary = await readJson("data/token-shop-row-remap-boundary.json");
  const tokenShopLateAtuBoundary = await readJson("data/token-shop-late-atu-boundary.json");
  const tokeniumNamingClues = await readJson("data/tokenium-naming-clues.json");
  const tokenBankStateClues = await readJson("data/token-bank-state-clues.json");
  const dailyTokeniumLaneClues = await readJson("data/daily-tokenium-lane-clues.json");
  const tokenBankFormulaBoundary = await readJson("data/token-bank-formula-boundary.json");
  const tokenShopCostLanes = await readJson("data/token-shop-cost-lanes.json");
  const spendActionLaneClues = await readJson("data/spend-action-lane-clues.json");
  const tokenShopOwnerShell = await readJson("data/token-shop-owner-shell.json");
  const tokenBankControllerShell = await readJson("data/token-bank-controller-shell.json");
  const tokenShopAtu3EffectTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-atu3-cells-effect.json",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu3ChestConsumerTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-atu3-chest-consumer.json",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu3ChestConsumerReadTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-atu3-chest-consumer-read.json",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu4ModTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-atu4-mod.json",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu5Mk1TitleTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-atu5-mk1-title.json",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu7Mk3BridgeTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-atu7-mk3-bridge.json",
    ["token-shop-trace-command"]
  );
  const tokenShopFamilyStructureTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-family-structure.json",
    ["token-shop-trace-command"]
  );

  const sections = {
    rows: {
      extract: datasetSection("data/token-shop-values.json", tokenShopValues, [
        "token-shop-values"
      ]),
      canonical: datasetSection("data/tokenshop-canonical-v1.json", tokenShopCanonical, [
        "tokenshop-canonical"
      ]),
      boundaries: {
        rowLevelOwner: datasetSection(
          "data/token-shop-row-level-owner.json",
          tokenShopRowLevelOwner,
          ["token-shop-row-level-owner"]
        ),
        save: datasetSection("data/token-shop-save-boundary.json", tokenShopSaveBoundary, [
          "token-shop-row-remap-boundary"
        ]),
        remap: datasetSection(
          "data/token-shop-row-remap-boundary.json",
          tokenShopRowRemapBoundary,
          ["token-shop-row-remap-boundary"]
        ),
        lateAtu: datasetSection("data/token-shop-late-atu-boundary.json", tokenShopLateAtuBoundary, [
          "token-shop-row-remap-boundary"
        ])
      }
    },
    tokenBank: {
      namingClues: datasetSection("data/tokenium-naming-clues.json", tokeniumNamingClues, [
        "token-shop-values"
      ]),
      stateClues: datasetSection("data/token-bank-state-clues.json", tokenBankStateClues, [
        "token-shop-values"
      ]),
      ownerShell: datasetSection("data/token-shop-owner-shell.json", tokenShopOwnerShell, [
        "token-shop-values"
      ]),
      controllerShell: datasetSection(
        "data/token-bank-controller-shell.json",
        tokenBankControllerShell,
        ["token-shop-values"]
      ),
      formulaBoundary: datasetSection(
        "data/token-bank-formula-boundary.json",
        tokenBankFormulaBoundary,
        ["token-shop-row-remap-boundary"]
      )
    },
    dailyTokenium: {
      laneClues: datasetSection(
        "data/daily-tokenium-lane-clues.json",
        dailyTokeniumLaneClues,
        ["token-shop-values"]
      )
    },
    spendLanes: {
      costLanes: datasetSection("data/token-shop-cost-lanes.json", tokenShopCostLanes, [
        "token-shop-values"
      ]),
      actionLaneClues: datasetSection(
        "data/spend-action-lane-clues.json",
        spendActionLaneClues,
        ["token-shop-values"]
      )
    },
    traceRuns: {
      atu3Effect: tokenShopAtu3EffectTrace,
      atu3ChestConsumer: tokenShopAtu3ChestConsumerTrace,
      atu3ChestConsumerRead: tokenShopAtu3ChestConsumerReadTrace,
      atu4Mod: tokenShopAtu4ModTrace,
      atu5Mk1Title: tokenShopAtu5Mk1TitleTrace,
      atu7Mk3Bridge: tokenShopAtu7Mk3BridgeTrace,
      familyStructure: tokenShopFamilyStructureTrace
    }
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "token-shop",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/token-shop.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {
      rows: {
        canonical: sections.rows.canonical
      }
    },
    boundaries: {
      rows: sections.rows.boundaries,
      tokenBank: {
        formulaBoundary: sections.tokenBank.formulaBoundary
      }
    },
    models: {},
    support: {
      rows: {
        extract: sections.rows.extract
      },
      tokenBank: {
        namingClues: sections.tokenBank.namingClues,
        stateClues: sections.tokenBank.stateClues,
        ownerShell: sections.tokenBank.ownerShell,
        controllerShell: sections.tokenBank.controllerShell
      },
      dailyTokenium: sections.dailyTokenium,
      spendLanes: sections.spendLanes
    },
    traceEvidence: sections.traceRuns
  });
}

async function buildMultiverseMarketUnit() {
  const unitInventory = await readJson("data/units/multiverse-market.v1.json");
  const multiverseMarketValues = await readJson("data/multiverse-market-values.json");
  const multiverseMarketMetadataNeighborhood = await readJson(
    "data/multiverse-market-metadata-neighborhood.json"
  );
  const multiverseMarketRangeBoundary = await readJson(
    "data/multiverse-market-range-boundary.json"
  );
  const multiverseMarketRowTextCoverage = await readJson(
    "data/multiverse-market-row-text-coverage.json"
  );
  const multiverseMarketPrefabRemapBoundary = await readJson(
    "data/multiverse-market-prefab-remap-boundary.json"
  );
  const multiverseMarketActionShell = await readJson(
    "data/multiverse-market-action-shell.json"
  );
  const multiverseMarketOwnerFamily = await readJson(
    "data/multiverse-market-owner-family.json"
  );
  const multiverseMarketSaveBoundary = await readJson(
    "data/multiverse-market-save-boundary.json"
  );
  const multiverseMarketMarketMemberBoundary = await readJson(
    "data/multiverse-market-market-member-boundary.json"
  );
  const multiverseMarketSaveDataImportBoundary = await readJson(
    "data/multiverse-market-savedata-import-boundary.json"
  );
  const multiverseMarketRow6974IdentitySourceBoundary = await readJson(
    "data/multiverse-market-row69-74-identity-source-boundary.json"
  );
  const multiverseMarketSerializedLabelSourceBoundary = await readJson(
    "data/multiverse-market-serialized-label-source-boundary.json"
  );
  const multiverseMarketRow7174IdentityBoundary = await readJson(
    "data/multiverse-market-row71-74-identity-boundary.json"
  );
  const multiverseMarketRow7174RemapBand = await readJson(
    "data/multiverse-market-row71-74-remap-band.json"
  );
  const multiverseMarketNearbyIdentityBindingPattern = await readJson(
    "data/multiverse-market-nearby-identity-binding-pattern.json"
  );
  const multiverseMarket6974AnomalyProvenance = await readJson(
    "data/multiverse-market-69-74-anomaly-provenance.json"
  );
  const multiverseMarketInscriptionNumberingStabilityBoundary = await readJson(
    "data/multiverse-market-inscription-numbering-stability-boundary.json"
  );
  const multiverseMarketShellRowPredictionBoundary = await readJson(
    "data/multiverse-market-shell-row-prediction-boundary.json"
  );
  const multiverseMarketTextProvenancePathBoundary = await readJson(
    "data/multiverse-market-text-provenance-path-boundary.json"
  );
  const multiverseMarketSaveOwnerTrace = await traceRunSection(
    "workbench/trace-runs/multiverse-market-save-owner-boundary.json",
    ["multiverse-market-trace-command"]
  );

  const sections = {
    saveOwner: {
      extract: datasetSection("data/multiverse-market-values.json", multiverseMarketValues, [
        "multiverse-market-values"
      ]),
      saveBoundary: datasetSection(
        "data/multiverse-market-save-boundary.json",
        multiverseMarketSaveBoundary,
        ["multiverse-market-save-boundary"]
      ),
      marketMemberBoundary: datasetSection(
        "data/multiverse-market-market-member-boundary.json",
        multiverseMarketMarketMemberBoundary,
        ["multiverse-market-member-boundary"]
      ),
      saveDataImportBoundary: datasetSection(
        "data/multiverse-market-savedata-import-boundary.json",
        multiverseMarketSaveDataImportBoundary,
        ["multiverse-market-save-boundary"]
      ),
      traceBoundary: multiverseMarketSaveOwnerTrace
    },
    rowIdentity: {
      metadataNeighborhood: datasetSection(
        "data/multiverse-market-metadata-neighborhood.json",
        multiverseMarketMetadataNeighborhood,
        ["multiverse-market-values"]
      ),
      rangeBoundary: datasetSection(
        "data/multiverse-market-range-boundary.json",
        multiverseMarketRangeBoundary,
        ["multiverse-market-save-boundary"]
      ),
      rowTextCoverage: datasetSection(
        "data/multiverse-market-row-text-coverage.json",
        multiverseMarketRowTextCoverage,
        ["multiverse-market-values"]
      ),
      prefabRemapBoundary: datasetSection(
        "data/multiverse-market-prefab-remap-boundary.json",
        multiverseMarketPrefabRemapBoundary,
        ["multiverse-market-save-boundary"]
      ),
      identitySourceBoundary: datasetSection(
        "data/multiverse-market-row69-74-identity-source-boundary.json",
        multiverseMarketRow6974IdentitySourceBoundary,
        ["multiverse-market-save-boundary"]
      ),
      serializedLabelSourceBoundary: datasetSection(
        "data/multiverse-market-serialized-label-source-boundary.json",
        multiverseMarketSerializedLabelSourceBoundary,
        ["multiverse-market-save-boundary"]
      ),
      row7174IdentityBoundary: datasetSection(
        "data/multiverse-market-row71-74-identity-boundary.json",
        multiverseMarketRow7174IdentityBoundary,
        ["multiverse-market-save-boundary"]
      ),
      row7174RemapBand: datasetSection(
        "data/multiverse-market-row71-74-remap-band.json",
        multiverseMarketRow7174RemapBand,
        ["multiverse-market-save-boundary"]
      ),
      nearbyIdentityBindingPattern: datasetSection(
        "data/multiverse-market-nearby-identity-binding-pattern.json",
        multiverseMarketNearbyIdentityBindingPattern,
        ["multiverse-market-save-boundary"]
      ),
      anomalyProvenance: datasetSection(
        "data/multiverse-market-69-74-anomaly-provenance.json",
        multiverseMarket6974AnomalyProvenance,
        ["multiverse-market-save-boundary"]
      ),
      numberingStabilityBoundary: datasetSection(
        "data/multiverse-market-inscription-numbering-stability-boundary.json",
        multiverseMarketInscriptionNumberingStabilityBoundary,
        ["multiverse-market-save-boundary"]
      ),
      shellRowPredictionBoundary: datasetSection(
        "data/multiverse-market-shell-row-prediction-boundary.json",
        multiverseMarketShellRowPredictionBoundary,
        ["multiverse-market-save-boundary"]
      ),
      textProvenancePathBoundary: datasetSection(
        "data/multiverse-market-text-provenance-path-boundary.json",
        multiverseMarketTextProvenancePathBoundary,
        ["multiverse-market-save-boundary"]
      )
    },
    uiShell: {
      actionShell: datasetSection(
        "data/multiverse-market-action-shell.json",
        multiverseMarketActionShell,
        ["multiverse-market-values"]
      ),
      ownerFamily: datasetSection(
        "data/multiverse-market-owner-family.json",
        multiverseMarketOwnerFamily,
        ["multiverse-market-values"]
      ),
      traceBoundary: multiverseMarketSaveOwnerTrace
    }
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "multiverse-market",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/multiverse-market.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {},
    boundaries: {
      saveOwner: {
        saveBoundary: sections.saveOwner.saveBoundary,
        marketMemberBoundary: sections.saveOwner.marketMemberBoundary,
        saveDataImportBoundary: sections.saveOwner.saveDataImportBoundary
      },
      rowIdentity: {
        rangeBoundary: sections.rowIdentity.rangeBoundary,
        prefabRemapBoundary: sections.rowIdentity.prefabRemapBoundary,
        identitySourceBoundary: sections.rowIdentity.identitySourceBoundary,
        serializedLabelSourceBoundary: sections.rowIdentity.serializedLabelSourceBoundary,
        row7174IdentityBoundary: sections.rowIdentity.row7174IdentityBoundary,
        row7174RemapBand: sections.rowIdentity.row7174RemapBand,
        nearbyIdentityBindingPattern: sections.rowIdentity.nearbyIdentityBindingPattern,
        anomalyProvenance: sections.rowIdentity.anomalyProvenance,
        numberingStabilityBoundary: sections.rowIdentity.numberingStabilityBoundary,
        shellRowPredictionBoundary: sections.rowIdentity.shellRowPredictionBoundary,
        textProvenancePathBoundary: sections.rowIdentity.textProvenancePathBoundary
      }
    },
    models: {},
    support: {
      saveOwner: {
        extract: sections.saveOwner.extract
      },
      rowIdentity: {
        metadataNeighborhood: sections.rowIdentity.metadataNeighborhood,
        rowTextCoverage: sections.rowIdentity.rowTextCoverage
      },
      uiShell: {
        actionShell: sections.uiShell.actionShell,
        ownerFamily: sections.uiShell.ownerFamily
      }
    },
    traceEvidence: {
      saveOwner: sections.saveOwner.traceBoundary,
      uiShell: {
        traceBoundary: sections.uiShell.traceBoundary
      }
    }
  });
}

async function buildShardsUnit() {
  const unitInventory = await readJson("data/units/shards.v1.json");
  const shardMilestones = await readJson("data/shard-milestones.grounded.v1.json");
  const shardObservedBehaviors = await readJson("data/shard-observed-behaviors.grounded.v1.json");
  const shardProvenance = await readJson("data/shard-milestones-provenance.grounded.v1.json");
  const shardAssetGrounding = await readJson("data/shard-asset-grounding.v1.json");
  const shardFamilyEvidence = await readJson("data/shard-milestone-family-evidence.v1.json");
  const shardOwnerFamilyBoundary = await readJson("data/shard-owner-family-boundary.v1.json");
  const shardFinalSuBonusBoundary = await readJson("data/shard-finalsu-bonus-boundary.v1.json");
  const shardMilestonePayloadBoundary = await readJson(
    "data/shard-milestone-payload-boundary.v1.json"
  );
  const shardMilestoneRowModelBoundary = await readJson(
    "data/shard-milestone-row-model-boundary.v1.json"
  );
  const shardMilestoneTitleEffectBoundary = await readJson(
    "data/shard-milestone-title-effect-boundary.v1.json"
  );
  const shardEffectTextHandlerBoundary = await readJson(
    "data/shard-effect-text-handler-boundary.v1.json"
  );
  const shardMilestoneRowShellBoundary = await readJson(
    "data/shard-milestone-row-shell-boundary.v1.json"
  );
  const shardMilestoneRowAlignmentBoundary = await readJson(
    "data/shard-milestone-row-alignment-boundary.v1.json"
  );
  const shardMilestoneHandoffBoundary = await readJson(
    "data/shard-milestone-handoff-boundary.v1.json"
  );
  const shardSaveBoundary = await readJson("data/shard-save-boundary.v1.json");
  const shardMilestoneSaveOwnerCandidates = await readJson(
    "data/shard-milestone-save-owner-candidates.v1.json"
  );
  const shardCostModelBoundary = await readJson("data/shard-cost-model-boundary.v1.json");
  const shardCostScreenshotCalibration = await readJson(
    "data/shard-cost-screenshot-calibration.v1.json"
  );
  const shardCostListPathProbe = await readJson("data/shard-cost-list-path-probe.v1.json");
  const shardBonusSlotProbe = await readJson("data/shard-bonus-slot-probe.v1.json");
  const shardCostParameterProbe = await readJson("data/shard-cost-parameter-probe.v1.json");
  const shardCostNativeProbe = await readJson("data/shard-cost-native-probe.v1.json");
  const shardCostFormulaModel = await readJson("data/shard-cost-formula-model.v1.json");
  const shardTypeMetadataProbe = await readJson("data/shard-type-metadata-probe.v1.json");
  const shardOwnedStateTrace = await traceRunSection(
    "workbench/trace-runs/shard-owned-state-upgradeinfolist-population.json",
    ["shard-owned-state-trace-command"]
  );
  const shardCostTrace = await traceRunSection(
    "workbench/trace-runs/shard-cost-su0-structure.json",
    ["shard-cost-trace-command"]
  );

  const sections = {
    family: {
      grounded: {
        milestones: datasetSection("data/shard-milestones.grounded.v1.json", shardMilestones, [
          "shard-family-evidence"
        ]),
        observedBehaviors: datasetSection(
          "data/shard-observed-behaviors.grounded.v1.json",
          shardObservedBehaviors,
          ["shard-family-evidence"]
        ),
        provenance: datasetSection(
          "data/shard-milestones-provenance.grounded.v1.json",
          shardProvenance,
          ["shard-family-evidence"]
        ),
        assetGrounding: datasetSection(
          "data/shard-asset-grounding.v1.json",
          shardAssetGrounding,
          ["shard-family-evidence"]
        )
      },
      familyEvidence: datasetSection(
        "data/shard-milestone-family-evidence.v1.json",
        shardFamilyEvidence,
        ["shard-family-evidence"]
      ),
      typeMetadataProbe: datasetSection(
        "data/shard-type-metadata-probe.v1.json",
        shardTypeMetadataProbe,
        ["shard-family-evidence"]
      ),
      boundaries: {
        ownerFamily: datasetSection(
          "data/shard-owner-family-boundary.v1.json",
          shardOwnerFamilyBoundary,
          ["shard-save-boundary"]
        ),
        finalSuBonus: datasetSection(
          "data/shard-finalsu-bonus-boundary.v1.json",
          shardFinalSuBonusBoundary,
          ["shard-save-boundary"]
        ),
        milestonePayload: datasetSection(
          "data/shard-milestone-payload-boundary.v1.json",
          shardMilestonePayloadBoundary,
          ["shard-save-boundary"]
        ),
        rowModel: datasetSection(
          "data/shard-milestone-row-model-boundary.v1.json",
          shardMilestoneRowModelBoundary,
          ["shard-save-boundary"]
        ),
        titleEffect: datasetSection(
          "data/shard-milestone-title-effect-boundary.v1.json",
          shardMilestoneTitleEffectBoundary,
          ["shard-save-boundary"]
        ),
        effectTextHandler: datasetSection(
          "data/shard-effect-text-handler-boundary.v1.json",
          shardEffectTextHandlerBoundary,
          ["shard-save-boundary"]
        ),
        rowShell: datasetSection(
          "data/shard-milestone-row-shell-boundary.v1.json",
          shardMilestoneRowShellBoundary,
          ["shard-save-boundary"]
        ),
        rowAlignment: datasetSection(
          "data/shard-milestone-row-alignment-boundary.v1.json",
          shardMilestoneRowAlignmentBoundary,
          ["shard-save-boundary"]
        ),
        handoff: datasetSection(
          "data/shard-milestone-handoff-boundary.v1.json",
          shardMilestoneHandoffBoundary,
          ["shard-save-boundary"]
        )
      }
    },
    ownedState: {
      saveBoundary: datasetSection("data/shard-save-boundary.v1.json", shardSaveBoundary, [
        "shard-save-boundary"
      ]),
      saveOwnerCandidates: datasetSection(
        "data/shard-milestone-save-owner-candidates.v1.json",
        shardMilestoneSaveOwnerCandidates,
        ["shard-save-boundary"]
      ),
      traceBoundary: shardOwnedStateTrace
    },
    cost: {
      costModelBoundary: datasetSection(
        "data/shard-cost-model-boundary.v1.json",
        shardCostModelBoundary,
        ["shard-cost-formula-model"]
      ),
      screenshotCalibration: datasetSection(
        "data/shard-cost-screenshot-calibration.v1.json",
        shardCostScreenshotCalibration,
        ["shard-cost-formula-model"]
      ),
      listPathProbe: datasetSection(
        "data/shard-cost-list-path-probe.v1.json",
        shardCostListPathProbe,
        ["shard-cost-formula-model"]
      ),
      bonusSlotProbe: datasetSection(
        "data/shard-bonus-slot-probe.v1.json",
        shardBonusSlotProbe,
        ["shard-family-evidence"]
      ),
      costParameterProbe: datasetSection(
        "data/shard-cost-parameter-probe.v1.json",
        shardCostParameterProbe,
        ["shard-cost-formula-model"]
      ),
      costNativeProbe: datasetSection(
        "data/shard-cost-native-probe.v1.json",
        shardCostNativeProbe,
        ["shard-cost-trace-command"]
      ),
      formulaModel: datasetSection(
        "data/shard-cost-formula-model.v1.json",
        shardCostFormulaModel,
        ["shard-cost-formula-model"]
      ),
      traceBoundary: shardCostTrace
    }
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "shards",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/shards.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {
      family: {
        grounded: sections.family.grounded
      }
    },
    boundaries: {
      family: sections.family.boundaries,
      ownedState: {
        saveBoundary: sections.ownedState.saveBoundary,
        saveOwnerCandidates: sections.ownedState.saveOwnerCandidates
      },
      cost: {
        costModelBoundary: sections.cost.costModelBoundary
      }
    },
    models: {
      cost: {
        formulaModel: sections.cost.formulaModel,
        screenshotCalibration: sections.cost.screenshotCalibration
      }
    },
    support: {
      family: {
        familyEvidence: sections.family.familyEvidence,
        typeMetadataProbe: sections.family.typeMetadataProbe
      },
      cost: {
        listPathProbe: sections.cost.listPathProbe,
        bonusSlotProbe: sections.cost.bonusSlotProbe,
        costParameterProbe: sections.cost.costParameterProbe,
        costNativeProbe: sections.cost.costNativeProbe
      }
    },
    traceEvidence: {
      ownedState: sections.ownedState.traceBoundary,
      cost: sections.cost.traceBoundary
    }
  });
}

async function buildTraceUnit() {
  const unitInventory = await readJson("data/units/trace.v1.json");
  const traceRegistry = await readJson("data/unity-trace-target-registry.json");
  const tokenShopFamilyStructureTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-family-structure.json",
    ["token-shop-family-trace-command"]
  );
  const tokenShopAtu3EffectTrace = await traceRunSection(
    "workbench/trace-runs/token-shop-atu3-cells-effect.json",
    ["token-shop-family-trace-command"]
  );
  const shardCostTrace = await traceRunSection(
    "workbench/trace-runs/shard-cost-su0-structure.json",
    ["shard-cost-trace-command"]
  );
  const shardOwnedStateTrace = await traceRunSection(
    "workbench/trace-runs/shard-owned-state-upgradeinfolist-population.json",
    ["shard-owned-state-trace-command"]
  );
  const multiverseMarketSaveOwnerTrace = await traceRunSection(
    "workbench/trace-runs/multiverse-market-save-owner-boundary.json",
    ["multiverse-market-trace-command"]
  );

  const sections = {
    registry: datasetSection("data/unity-trace-target-registry.json", traceRegistry, [
      "trace-registry"
    ]),
    liveRuns: {
      tokenShopFamilyStructure: tokenShopFamilyStructureTrace,
      tokenShopAtu3Effect: tokenShopAtu3EffectTrace,
      shardCostSu0Structure: shardCostTrace,
      shardOwnedStateUpgradeinfolistPopulation: shardOwnedStateTrace,
      multiverseMarketSaveOwnerBoundary: multiverseMarketSaveOwnerTrace
    },
    promotionTargets: {
      targetIds: Object.keys(traceRegistry.targets ?? {}),
      familyIds: Object.keys(traceRegistry.sourceFamilies ?? {}),
      provenanceSources: ["trace-registry"]
    }
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "trace",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/trace.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {},
    boundaries: {},
    models: {},
    support: {
      registry: sections.registry,
      promotionTargets: sections.promotionTargets
    },
    traceEvidence: sections.liveRuns
  });
}

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const playerStateUnit = await buildPlayerStateUnit();
  const tokenShopUnit = await buildTokenShopUnit();
  const multiverseMarketUnit = await buildMultiverseMarketUnit();
  const shardsUnit = await buildShardsUnit();
  const traceUnit = await buildTraceUnit();

  await writeJson("data/system-units/player-state.v1.json", playerStateUnit);
  await writeJson("data/system-units/token-shop.v1.json", tokenShopUnit);
  await writeJson("data/system-units/multiverse-market.v1.json", multiverseMarketUnit);
  await writeJson("data/system-units/shards.v1.json", shardsUnit);
  await writeJson("data/system-units/trace.v1.json", traceUnit);

  console.log("Generated system units:");
  console.log("- data/system-units/player-state.v1.json");
  console.log("- data/system-units/token-shop.v1.json");
  console.log("- data/system-units/multiverse-market.v1.json");
  console.log("- data/system-units/shards.v1.json");
  console.log("- data/system-units/trace.v1.json");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
