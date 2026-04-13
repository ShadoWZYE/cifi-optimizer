import test from "node:test";
import assert from "node:assert/strict";

import { createShardEvidenceSupport } from "../shard-evidence-support.js";

function createTestSupport(overrides = {}) {
  const grounding = overrides.grounding ?? {};
  const plannerState = overrides.plannerState ?? {};
  return createShardEvidenceSupport({
    formatShardNumber(value) {
      return String(value);
    },
    getShardCostModelBoundarySummary(boundary) {
      return boundary ?? { hasSampledCostWindows: false, hasRow0FormulaShell: false };
    },
    getShardEffectTextHandlerBoundarySummary(boundary) {
      return boundary ?? { hasBoundary: false };
    },
    getShardGrounding() {
      return grounding;
    },
    getShardMilestoneRowModelBoundarySummary(boundary) {
      return (
        boundary ?? {
          hasBoundary: false
        }
      );
    },
    getShardMilestoneTitleEffectBoundarySummary(boundary) {
      return boundary ?? { hasEffectPresentationFamily: false };
    },
    getShardPlannerState() {
      return plannerState;
    }
  });
}

test("verified shard rows and milestone naming prefer the single player-facing title binding", () => {
  const support = createTestSupport({
    grounding: {
      verifiedRows: [
        { verifiedRow: { row: 3, rowKey: "SU3", titleBinding: { playerFacingName: "Gamma" } } },
        { verifiedRow: { row: 1, rowKey: "SU1", titleBinding: { playerFacingName: "Alpha" } } },
        { verifiedRow: { row: 2, rowKey: "", titleBinding: { playerFacingName: "Broken" } } }
      ],
      titleEffectBoundary: {
        titleAssetCandidates: [{ row: 1, title: "The Alpha Milestone" }]
      }
    }
  });

  assert.deepEqual(
    support.getVerifiedShardRowPackages().map((entry) => entry.verifiedRow.row),
    [1, 3]
  );
  assert.equal(
    support.getShardMilestoneDisplayName({ milestoneNumber: 1, name: "Fallback One" }),
    "The Alpha Milestone"
  );
  assert.equal(
    support.getShardMilestonePanelTitle({ milestoneNumber: 1, name: "Fallback One" }),
    "#1 THE ALPHA MILESTONE"
  );
  assert.equal(
    support.getShardMilestoneDisplayMeta({
      milestoneNumber: 1,
      name: "Fallback One",
      unlockCondition: { type: "total_milestone_levels_required", value: 10 }
    }),
    "Community alias: Fallback One"
  );
});

test("threshold, unlock, and computed bonus helpers preserve descriptive shard evidence behavior", () => {
  const support = createTestSupport({
    grounding: {
      milestones: {
        canonicalMechanics: {
          shardMilestoneSystem: {
            rarity_bonus_thresholds: {
              common: [5, 10],
              source_ids: ["doc"]
            }
          }
        }
      },
      costParameterProbe: {
        unlockRequirementBlock: { values: [0, 25] },
        rowAlignedTupleCandidates: [
          {
            row: 1,
            bonusPerLevelValues: [1.5]
          }
        ]
      }
    }
  });

  const milestone = {
    id: "su1",
    milestoneNumber: 1,
    rarity: "Common",
    unlockCondition: { type: "total_milestone_levels_required", value: 25 },
    bonuses: [{ initialBonus: "2x", bonusPerLevel: "1.1x", unlockLevel: 1 }]
  };

  assert.deepEqual(support.getThresholdScheduleForMilestone(milestone), [5, 10]);
  assert.equal(support.getNextShardThreshold(milestone, 6), 10);
  assert.equal(support.getShardUnlockRequirement(milestone), 25);
  assert.deepEqual(support.getNextShardCostBump(145), { level: 200, severity: "small bump" });
  assert.deepEqual(support.getShardComputedBonusSummary(milestone, milestone.bonuses[0], 2), {
    currentLabel: "x3 (descriptive model)",
    nextLabel: "x4.5"
  });
});

test("grounded summary and provenance helpers keep descriptive evidence labels", () => {
  const support = createTestSupport({
    grounding: {
      provenance: {
        sources: {
          report_a: { title: "Report A" },
          report_b: { title: "Report B" }
        },
        uncertaintyLog: [{ status: "conflict_detected", what_is_missing: "Row owner unresolved." }]
      },
      rowModelBoundary: { hasBoundary: true },
      titleEffectBoundary: {
        hasEffectPresentationFamily: true,
        titleAssetCandidates: [{ row: 4, title: "Delta" }],
        sampleBonusCalcAccessors: ["get_SU4BonusA"]
      },
      effectTextHandlerBoundary: { hasBoundary: true },
      costModelBoundary: { hasSampledCostWindows: true, hasRow0FormulaShell: false },
      costParameterProbe: {
        metadataFamilies: {
          startCostFields: Array.from({ length: 30 }, () => "x"),
          costExponentFields: Array.from({ length: 30 }, () => "y"),
          growthExponentFields: Array.from({ length: 30 }, () => "z")
        },
        rowAlignedTupleCandidates: [{ row: 4 }],
        signatureGroups: [1]
      },
      bonusSlotProbe: {
        rows: [{ row: 4, bonusFieldCount: 3, matchesGroundedCount: true }]
      }
    }
  });

  const summary = support.getShardMilestoneGroundedSummary({
    milestoneNumber: 4,
    sourceIds: ["report_a", "report_b"]
  });

  assert.equal(summary.titleCoverageStatusLabel, "Available");
  assert.match(summary.effectLine, /row-local bonus slots/);
  assert.equal(
    support.getMilestoneSourceLabel({ sourceIds: ["report_a", "report_b"] }),
    "Report A | Report B"
  );
  assert.equal(support.getProvenanceConflictNote(), "Row owner unresolved.");
});
