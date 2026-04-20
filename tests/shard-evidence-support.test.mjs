import test from "node:test";
import assert from "node:assert/strict";

import { createShardEvidenceSupport } from "../support/shard-evidence-support.js";

function createTestSupport(overrides = {}) {
  const grounding = overrides.grounding ?? {};
  const plannerState = overrides.plannerState ?? {};
  const shardSystemView = {
    family: {
      grounded: {
        milestones: grounding.milestones ?? null,
        observedBehaviors: grounding.observedBehaviors ?? null,
        provenance: grounding.provenance ?? null
      },
      familyEvidence: grounding.milestoneFamilyEvidence ?? null
    },
    cost: {
      bonusSlotProbe: grounding.bonusSlotProbe ?? null,
      costParameterProbe: grounding.costParameterProbe ?? null,
      costNativeProbe: grounding.costNativeProbe ?? null
    },
    ownedState: {
      saveBoundary: grounding.saveBoundary ?? null,
      saveOwnerCandidates: grounding.saveOwnerCandidates ?? null
    }
  };
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
    getShardSystemView() {
      return shardSystemView;
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

test("shared shard family evidence drives verified rows and milestone naming", () => {
  const support = createTestSupport({
    grounding: {
      milestoneFamilyEvidence: {
        rows: [
          {
            row: 3,
            rowKey: "SU3",
            status: "partial",
            titleBinding: { titleCandidates: ["Gamma"], playerFacingName: "Gamma" }
          },
          {
            row: 1,
            rowKey: "SU1",
            status: "verified",
            titleBinding: {
              titleCandidates: ["The Alpha Milestone"],
              playerFacingName: "Alpha"
            },
            verifiedPackage: { fixedBreakpoints: [1, 25, 50] }
          },
          {
            row: 2,
            rowKey: "",
            status: "verified",
            titleBinding: { titleCandidates: ["Broken"], playerFacingName: "Broken" }
          }
        ]
      }
    }
  });

  assert.deepEqual(
    support.getVerifiedShardRowPackages().map((entry) => entry.verifiedRow.row),
    [1]
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
    "Evidence status: Verified"
  );
  assert.deepEqual(support.getShardMilestoneEvidenceCounts(), {
    verified: 2,
    partial: 1,
    blocked: 0
  });
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
      milestoneFamilyEvidence: {
        rows: [
          {
            row: 4,
            rowKey: "SU4",
            status: "partial",
            statusReason: "Row 4 stays descriptive.",
            titleBinding: { titleCandidates: ["Delta"], playerFacingName: "Delta Milestone" },
            effectBinding: {
              bonusFieldCount: 3,
              handler: "TextHandlerShardMilestoneBonusesPerLevel/N"
            },
            costShell: { getterName: "get_SU4Cost" }
          }
        ]
      },
      provenance: {
        sources: {
          report_a: { title: "Report A" },
          report_b: { title: "Report B" }
        },
        uncertaintyLog: [{ status: "conflict_detected", what_is_missing: "Row owner unresolved." }]
      },
      saveBoundary: {
        boundaryEvidence: {
          saveSideOwnerRecovered: false,
          ownedStateOutcomeKind: "non-local-injection-seam"
        },
        recoveredDeclaringRowModel: {
          ownerType: "ShardMining",
          rowModelType: {
            fullName: "ShardMining+ShardUpgradeInfo"
          }
        }
      },
      saveOwnerCandidates: {
        remainingSaveOwnerCandidates: [{ label: "PlayerProfile-side shard member shell" }]
      },
      rowModelBoundary: { hasBoundary: true }
    }
  });

  const summary = support.getShardMilestoneGroundedSummary({
    milestoneNumber: 4,
    sourceIds: ["report_a", "report_b"]
  });

  assert.equal(summary.titleCoverageStatusLabel, "Partial");
  assert.match(summary.effectLine, /bonus slots/);
  const definitionSummary = support.getShardDefinitionEvidenceSummary({
    milestoneNumber: 4,
    unlockCondition: { type: "total_milestone_levels_required", value: 40 }
  });
  assert.match(definitionSummary.unlockLine, /Unlock requirement: 40 total milestone levels/);
  assert.match(definitionSummary.bonusShapeLine, /Recovered bonus package shape/);
  const ownedStateBlocker = support.getShardOwnedStateBlockerSummary();
  assert.match(ownedStateBlocker.ownerLine, /No checked save-side owner is recovered/);
  assert.match(ownedStateBlocker.traceLine, /non-local injection seam/);
  assert.match(ownedStateBlocker.importLine, /No grounded import path is available/);
  assert.match(ownedStateBlocker.candidateLine, /PlayerProfile-side shard member shell/);
  assert.equal(
    support.getMilestoneSourceLabel({ sourceIds: ["report_a", "report_b"] }),
    "Report A | Report B"
  );
  assert.equal(support.getProvenanceConflictNote(), "Row owner unresolved.");
});
