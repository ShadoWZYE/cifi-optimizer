import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPlayerProfileBoundaryGroups,
  getImportedMultiverseMarketPreviewCardModel,
  getPlannerHelperCompletion,
  getPlayerProfileBoundaryAudit,
  getProfileCompletion
} from "../support/player-profile-boundary-support.js";
import { QUARANTINED_MULTIVERSE_MARKET_STATUS } from "../player-profile.js";

test("player profile boundary groups preserve canonical, planner, and compatibility slices", () => {
  const groups = buildPlayerProfileBoundaryGroups({
    canonical: {
      profileName: "Pilot",
      dataConfidence: "manual",
      loopReset: 7,
      diamonds: 12,
      tokens: 34,
      shards: 56,
      notes: "ready",
      academyRelics: 9
    },
    shardPlanner: {
      totalMilestoneLevels: 21,
      focusMilestoneId: "su1",
      focusMilestoneLevel: 4,
      observedLevelsByMilestone: { su1: 4, su2: 2 }
    },
    shipPlanner: {
      summary: { power: 10, speed: 11, cargo: 12 },
      calibration: { crew: {}, techLevels: {} }
    },
    experimental: {
      gemNodeBudget: 99,
      primaryFarmingFocus: "cells",
      researchHours: 8
    },
    compatibility: {
      legacyStage: { highestShipUnlocked: "K", manualPhase: "late" },
      unresolved: { gemDust: 123, hunterLevel: 45, traitSphereCount: null, mechParts: 6 },
      unmappedSystems: {
        shardMilestones: { selectedMilestone: "su3" },
        tokenShop: { ATU1Level: 2 },
        multiverseMarket: {
          status: QUARANTINED_MULTIVERSE_MARKET_STATUS,
          importedState: { IS71Level: 3 },
          mappingGate: {
            plannerUseAllowed: false,
            canonicalPromotionBlocked: true
          },
          currentBoundary: ["compatibility-only"]
        }
      }
    }
  });

  assert.equal(groups.length, 6);
  assert.equal(groups[0].title, "Canonical shared truth");
  assert.deepEqual(groups[2].items[0], ["Total shard milestone levels", 21]);
  assert.deepEqual(groups[3].items[3], ["Ship calibration groups", 2]);
  assert.deepEqual(groups[5].items.at(-1), [
    "Raw/unmapped MultiverseMarket state",
    {
      status: QUARANTINED_MULTIVERSE_MARKET_STATUS,
      importedState: { IS71Level: 3 },
      mappingGate: {
        plannerUseAllowed: false,
        canonicalPromotionBlocked: true
      },
      currentBoundary: ["compatibility-only"]
    }
  ]);
});

test("boundary audit and completion helpers keep labeled import summaries", () => {
  const groups = [
    {
      title: "Canonical shared truth",
      items: [
        ["Profile name", "Pilot"],
        ["Diamonds", 12]
      ]
    },
    {
      title: "Compatibility leftovers",
      items: [
        ["Legacy gemDust", null],
        ["Raw/unmapped MultiverseMarket state", null]
      ]
    }
  ];
  const audit = getPlayerProfileBoundaryAudit(
    groups,
    {
      shipPlanner: { summary: { power: 10, speed: null } },
      compatibility: {
        unresolved: { gemDust: 123, hunterLevel: null },
        unmappedSystems: { tokenShop: {}, multiverseMarket: { IS71Level: 3 } }
      }
    },
    (value) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === "object") {
        return Object.keys(value).length > 0;
      }
      return String(value).trim() !== "";
    }
  );

  assert.deepEqual(audit.counts, ["Canonical shared truth: 2/2", "Compatibility leftovers: 0/2"]);
  assert.match(audit.notes[0], /No quarantined unmapped system blobs/);
  assert.match(audit.notes[1], /external-model implementation state/);
  assert.match(audit.notes[2], /gemDust/);
  assert.match(audit.notes[3], /Ignored one unlabeled MultiverseMarket compatibility payload/);

  const profile = {
    meta: { profileName: "Pilot", dataConfidence: "manual" },
    player: { loop: { loopReset: 7 }, resources: { diamonds: 12, tokens: null, shards: 56 } },
    notes: { profile: "ready" },
    planning: { shards: { totalMilestoneLevels: 21 } }
  };
  const activePaths = {
    profileName: ["meta", "profileName"],
    loopReset: ["player", "loop", "loopReset"],
    dataConfidence: ["meta", "dataConfidence"],
    diamonds: ["player", "resources", "diamonds"],
    tokens: ["player", "resources", "tokens"],
    shards: ["player", "resources", "shards"],
    notes: ["notes", "profile"],
    totalShardMilestoneLevels: ["planning", "shards", "totalMilestoneLevels"]
  };

  assert.equal(getProfileCompletion(profile, activePaths), 88);
  assert.equal(getPlannerHelperCompletion(profile), 100);
});

test("Emporium import preview card model preserves compatibility-only summary lines", () => {
  const model = getImportedMultiverseMarketPreviewCardModel(
    {
      hasImportedCompatibilityPreview: true,
      importTargetPath: "compatibility.unmappedSystemState.multiverseMarket",
      typedSpanLabel: "IS1Level through IS110Level",
      importedSpanRowCount: 2,
      totalSpanRowCount: 110,
      importedTradeCounterCount: 1,
      totalTradeCounterCount: 8,
      importedEarlyMechCount: 1,
      totalEarlyMechCount: 4,
      hasOverlapGroundedRows: true,
      importedOverlapRowCount: 1,
      overlapRowCount: 4,
      wrapperOnlyFieldLabel: "InscryptionsDone",
      supportedTextModel: {
        effectLabelLane: "CurrentEffectLabel",
        baseBonusLane: "CurrentBonusText",
        idLane: "ISNID",
        quarantinedCurrentValueLane: "CurrentValueText"
      },
      rowSummaryShape: {
        shapeId: "grounded-compatibility-evidence",
        groundedFields: [{ key: "effectLabel", slotAlias: "CurrentEffectLabel" }],
        quarantinedFields: [{ key: "currentValue", slotAlias: "CurrentValueText" }]
      },
      importedRangeLabel: "71-72",
      firstImportedRowLabel: "IS71Level",
      lastImportedRowLabel: "IS72Level",
      missingSpanCount: 0,
      missingSpanLabel: "",
      hasTradeCounterPreview: true,
      tradeCounterLabel: "EsotericR1Trades",
      missingTradeCounterKeys: [],
      missingTradeCounterLabel: "",
      hasEarlyMechPreview: true,
      earlyMechWindowLabel: "Mech1Unlocked through Mech2Unlocked",
      missingEarlyMechFields: [],
      missingEarlyMechLabel: "",
      overlapRangeLabel: "71-74",
      missingOverlapLabel: "IS74Level",
      hasOverlapLevelPreview: true,
      overlapRowSummaries: [
        {
          rowId: 71,
          level: 3,
          fieldPath: "compatibility.unmappedSystemState.multiverseMarket.importedState.IS71Level",
          shapeId: "grounded-compatibility-evidence",
          groundedFields: [
            {
              key: "effectLabel",
              slotAlias: "CurrentEffectLabel",
              sourceLane: "effect-label",
              status: "grounded"
            }
          ],
          quarantinedFields: [
            {
              key: "currentValue",
              slotAlias: "CurrentValueText",
              status: "quarantined",
              reason: "runtime-only"
            }
          ]
        }
      ],
      previewRows: [{ rowId: 71, level: 3, fieldPath: "path.a" }],
      trailingPreviewRows: [{ rowId: 72, level: 4 }],
      importedTradeCounters: [{ key: "EsotericR1Trades", value: 9, fieldPath: "path.b" }],
      tradeCounterSampleLine: "EsotericR1Trades 9",
      importedEarlyMechFields: [{ key: "Mech1Unlocked", value: true, fieldPath: "path.c" }]
    },
    (value) => `#${value}`
  );

  assert.equal(model.hasPreview, true);
  assert.equal(model.pillLabels[0], "2/110 raw IS rows imported");
  assert.match(model.metaLines[0], /compatibility-only evidence/);
  assert.equal(model.overlapCards[0].level, "#3");
  assert.equal(model.previewRows[0].level, "#3");
  assert.equal(model.trailingPreviewLine, "Trailing imported raw rows: IS72Level #4");
  assert.deepEqual(model.importedTradeCounters[0], {
    key: "EsotericR1Trades",
    value: 9,
    fieldPath: "path.b"
  });
});
