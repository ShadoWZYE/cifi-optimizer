import test from "node:test";
import assert from "node:assert/strict";

import {
  getShardCostModelBoundarySummary,
  getShardOwnerFamilyBoundarySummary,
  getShardSaveBoundarySummary
} from "../support/shard-boundary-summary-support.js";

test("shard owner-family and save-boundary summaries preserve descriptive gate labels", () => {
  assert.deepEqual(
    getShardOwnerFamilyBoundarySummary({
      screenControllerFamilies: ["ShardMining, Assembly-CSharp"],
      dataCarrierCandidates: ["ShardMining|ShardUpgradeInfo"],
      screenControlAnchors: [
        "CheckFirstTimeShardMilestoneOpened",
        "AttachFastBuyButton",
        "FastBuyButtonMethodShards",
        "StartFastBuyButtonHold"
      ],
      bonusFieldAnchors: [
        "TotalMilestoneLevels",
        "get_IsUnlocked",
        "FinalSU1Bonus1",
        "FinalSU29Bonus2",
        "FinalSU29Bonus3"
      ],
      downgradedGenericLead: {
        family: "ConstructionMilestones, Assembly-CSharp",
        reasons: ["generic numbering only"]
      }
    }).hasBoundary,
    true
  );

  assert.deepEqual(
    getShardSaveBoundarySummary({
      ownerShellTermsChecked: ["ShardMining"],
      saveFamilyTermsChecked: ["PlayerProfileData", "CloudSavePlayerProfile"],
      probeResults: {
        metadataNeighborhoodHasSaveTerms: false,
        level0HasSaveTerms: false,
        ownerShellWithSaveOverlapCount: 0,
        directShardPlayerProfileContext: false,
        directSerializedRowDefinitionRecovered: true,
        runtimeOwnedStateShellRecovered: true
      },
      recoveredDirectRowDefinitionPayload: {
        ownerType: "ShardMining"
      },
      recoveredDeclaringRowModel: {
        ownerType: "ShardMining"
      }
    }),
    {
      hasSeparationBoundary: true,
      hasDirectRowDefinitionPayload: true,
      hasRuntimeOwnedStateShell: true,
      ownerAnchor: "ShardMining / ShardUpgradeInfo",
      saveAnchor: "PlayerProfileData",
      cloudSaveAnchor: "CloudSavePlayerProfile",
      directPayloadAnchor: "ShardMining",
      runtimeShellAnchor: "ShardMining.upgradeInfoList",
      overlapLabel: "zero direct overlap",
      ownerTermCount: 1
    }
  );
});

test("shard cost-model summary preserves sampled window and row-shell labels", () => {
  const summary = getShardCostModelBoundarySummary({
    dataCarrier: "ShardUpgradeInfo",
    dataCarrierTieIn: "ShardMining|ShardUpgradeInfo",
    sampleCostAccessorWindows: [
      {
        label: "earlyWindow",
        start: 0,
        end: 9,
        count: 10,
        accessors: ["get_SU0Cost", "get_SU9Cost"]
      },
      {
        label: "lateWindow",
        start: 23,
        end: 29,
        count: 7,
        accessors: ["get_SU23Cost", "get_SU29Cost"]
      }
    ],
    row0CostFields: [
      "SU0StartCost",
      "SU0CostExponent",
      "SU0GrowthExponent",
      "SU0GrowthExponent2",
      "SU0GrowthExponent3"
    ],
    row0FillFields: ["SU0Level1Fill", "SU0Level8Fill"],
    row0BonusFields: ["SU0Bonus1", "SU0Bonus8"],
    optimizerBoundary: {
      supportedNow: ["descriptive cards"],
      blockedNow: ["optimizer automation"]
    }
  });

  assert.equal(summary.hasBoundary, true);
  assert.equal(summary.hasSampledCostWindows, true);
  assert.equal(summary.hasRow0FormulaShell, true);
  assert.match(summary.costWindowLabel, /get_SU0Cost/);
  assert.match(summary.costWindowLabel, /get_SU29Cost/);
  assert.equal(summary.supportedOptimizerLabel, "descriptive cards");
  assert.equal(summary.blockedOptimizerLabel, "optimizer automation");
});
