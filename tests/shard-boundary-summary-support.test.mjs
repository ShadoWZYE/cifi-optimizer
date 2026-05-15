import test from "node:test";
import assert from "node:assert/strict";

import {
  getShardCostModelBoundarySummary,
  getShardEffectTextHandlerBoundarySummary,
  getShardFinalSuBonusBoundarySummary,
  getShardMilestonePayloadBoundarySummary,
  getShardMilestoneRowAlignmentBoundarySummary,
  getShardMilestoneRowModelBoundarySummary,
  getShardMilestoneRowShellBoundarySummary,
  getShardMilestoneTitleEffectBoundarySummary,
  getShardOwnerFamilyBoundarySummary,
  getShardSaveBoundarySummary
} from "../support/shard-boundary-summary-support.js";
import { buildShardSystemView } from "../support/system-unit-projections.js";

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

  const saveSummary = getShardSaveBoundarySummary({
    ownerShellTermsChecked: ["ShardMining"],
    saveFamilyTermsChecked: ["PlayerProfileData", "CloudSavePlayerProfile"],
    boundaryEvidence: {
      metadataNeighborhoodHasSaveTerms: false,
      level0HasSaveTerms: false,
      ownerShellWithSaveOverlapCount: 0,
      directShardPlayerProfileContext: false,
      directSerializedRowDefinitionRecovered: true,
      runtimeOwnedStateShellRecovered: true,
      ownedStateTargetRecovered: true,
      ownedStateOutcomeKind: "non-local-injection-seam"
    },
    recoveredDirectRowDefinitionPayload: {
      ownerType: "ShardMining"
    },
    recoveredDeclaringRowModel: {
      ownerType: "ShardMining"
    }
  });
  assert.deepEqual(saveSummary, {
    hasSeparationBoundary: true,
    hasDirectRowDefinitionPayload: true,
    hasRuntimeOwnedStateShell: true,
    hasOwnedStateTarget: true,
    hasOwnedStatePopulationBridge: false,
    ownedStateOutcomeKind: "non-local-injection-seam",
    ownerAnchor: "ShardMining / ShardUpgradeInfo",
    saveAnchor: "PlayerProfileData",
    cloudSaveAnchor: "CloudSavePlayerProfile",
    directPayloadAnchor: "ShardMining",
    runtimeShellAnchor: "ShardMining.upgradeInfoList",
    ownedStateStatusLabel:
      "Trace rules out a local upgradeInfoList bridge and still cannot name a deeper wrapper handoff; owned state stays at a non-local injection seam",
    overlapLabel: "zero direct overlap",
    ownerTermCount: 1,
    coverageSource: "compatibility-boundary-export",
    fallbackMode: "compatibility-save-boundary",
    usesLegacyCompatibilityFallback: true
  });
});

test("shard owner-family summary prefers DB-backed generic mechanics and inferred boundary when present", () => {
  const summary = getShardOwnerFamilyBoundarySummary({
    genericMechanics: {
      scopes: {
        "shard-owner-family-boundary": {
          entities: [
            {
              entityId: "family-graph:shards-owner-family",
              entityKind: "family-graph",
              payload: {}
            }
          ],
          facts: [
            { factKind: "screen-controller-family", factValue: "ShardMining", payload: {} },
            {
              factKind: "data-carrier-candidate",
              factValue: "ShardMining|ShardUpgradeInfo",
              payload: {}
            },
            {
              factKind: "runtime-shell",
              factValue: "ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo",
              payload: {}
            },
            { factKind: "owner-field", factValue: "upgradeInfoList", payload: {} },
            { factKind: "row-model-type", factValue: "ShardMining+ShardUpgradeInfo", payload: {} },
            { factKind: "row-state-field", factValue: "<Cost>k__BackingField", payload: {} },
            { factKind: "row-state-field", factValue: "<MaxLevel>k__BackingField", payload: {} },
            { factKind: "row-state-field", factValue: "<IsUnlocked>k__BackingField", payload: {} },
            {
              factKind: "supporting-edge-type",
              factValue: "definition-to-runtime-shell",
              payload: {}
            },
            {
              factKind: "supporting-edge-type",
              factValue: "runtime-shell-to-owner-lists",
              payload: {}
            },
            {
              factKind: "blocked-edge-type",
              factValue: "local-runtime-population-bridge",
              payload: {}
            },
            {
              factKind: "blocked-edge-type",
              factValue: "deeper-wrapper-handoff-recovery",
              payload: {}
            },
            {
              factKind: "grounded-conclusion",
              factValue:
                "Automatic native reconstruction ties this lane to InitializeShards via isUnlocked, get_isUnlocked, get_maxLevel and MaxLevel.",
              payload: {}
            },
            {
              factKind: "outcome-statement",
              factValue:
                "The raw trace now narrows the owned-state path to a non-local seam: direct definitions and the runtime shell are recovered locally, but owned-state values still arrive from a source the repo cannot yet name.",
              payload: {}
            },
            {
              factKind: "source-trace-scope",
              factValue: "shard-owned-state-upgradeinfolist-population",
              payload: {}
            },
            {
              factKind: "source-subject-id",
              factValue: "shard-owned-state-upgradeinfolist-population",
              payload: {}
            }
          ],
          relations: [],
          gaps: [{ gapKind: "next-seam", payload: { seamId: "local-runtime-population-bridge" } }]
        }
      }
    },
    boundaries: {
      owner: {
        subjectId: "family-graph:shards-owner-family",
        boundaryKind: "subject-boundary",
        verdict: "quarantine",
        nextSeamId: "local-runtime-population-bridge",
        blockedInputReason: "player-owned milestone save-state inputs remain unresolved",
        genericFactCount: 13,
        genericGapCount: 1
      }
    }
  });

  assert.equal(summary.hasBoundary, true);
  assert.equal(summary.hasStructure, true);
  assert.equal(summary.hasRowStateFields, true);
  assert.equal(summary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(summary.boundaryVerdict, "quarantine");
  assert.equal(summary.nextSeamId, "local-runtime-population-bridge");
  assert.equal(summary.screenController, "ShardMining");
  assert.equal(summary.dataCarrier, "ShardMining|ShardUpgradeInfo");
  assert.equal(summary.ownerField, "upgradeInfoList");
  assert.equal(summary.rowModelType, "ShardMining+ShardUpgradeInfo");
  assert.match(summary.rowStateFieldLabel, /<Cost>k__BackingField/);
  assert.match(summary.blockedEdgeLabel, /local-runtime-population-bridge/);
  assert.equal(summary.sourceTraceScope, "shard-owned-state-upgradeinfolist-population");
  assert.equal(summary.sourceSubjectId, "shard-owned-state-upgradeinfolist-population");
});

test("shard owner-family summary still falls back through a system view when DB coverage is absent", () => {
  const shardSystem = buildShardSystemView(
    {
      sections: {
        family: {
          boundaries: {
            ownerFamily: {
              data: {
                screenControllerFamilies: ["ShardMining, Assembly-CSharp"],
                dataCarrierCandidates: ["ShardMining|ShardUpgradeInfo"],
                screenControlAnchors: ["FastBuyButtonMethodShards"],
                bonusFieldAnchors: ["FinalSU29Bonus2"],
                downgradedGenericLead: {
                  family: "ConstructionMilestones, Assembly-CSharp",
                  reasons: ["generic numbering only"]
                }
              }
            }
          }
        }
      }
    },
    null
  );

  const summary = getShardOwnerFamilyBoundarySummary(shardSystem);
  assert.equal(summary.hasBoundary, true);
  assert.equal(summary.screenController, "ShardMining, Assembly-CSharp");
  assert.equal(summary.dataCarrier, "ShardMining|ShardUpgradeInfo");
});

test("buildShardSystemView keeps shard owner-family artifact only as compatibility fallback when DB coverage exists", () => {
  const shardSystem = buildShardSystemView(
    {
      sections: {
        family: {
          boundaries: {
            ownerFamily: {
              data: {
                screenControllerFamilies: ["ShardMining, Assembly-CSharp"]
              }
            }
          }
        }
      }
    },
    {
      genericMechanics: {
        scopes: {
          "shard-owner-family-boundary": {
            entities: [
              { entityId: "family-graph:shards-owner-family", entityKind: "family-graph" }
            ],
            facts: [],
            relations: [],
            gaps: []
          }
        }
      },
      boundaries: {
        owner: {
          subjectId: "family-graph:shards-owner-family",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  );

  assert.equal(shardSystem.family.boundaries.ownerFamily, null);
  assert.deepEqual(shardSystem.family.compatibilityBoundaries.ownerFamily, {
    screenControllerFamilies: ["ShardMining, Assembly-CSharp"]
  });
});

test("shard save and cost summaries still fall back through a system view when DB coverage is absent", () => {
  const shardSystem = buildShardSystemView(
    {
      sections: {
        ownedState: {
          saveBoundary: {
            data: {
              ownerShellTermsChecked: ["ShardMining"],
              saveFamilyTermsChecked: ["PlayerProfileData", "CloudSavePlayerProfile"],
              boundaryEvidence: {
                metadataNeighborhoodHasSaveTerms: false,
                level0HasSaveTerms: false,
                ownerShellWithSaveOverlapCount: 0,
                directShardPlayerProfileContext: false,
                directSerializedRowDefinitionRecovered: true,
                runtimeOwnedStateShellRecovered: true,
                ownedStateTargetRecovered: true,
                ownedStateOutcomeKind: "non-local-injection-seam"
              },
              recoveredDirectRowDefinitionPayload: {
                ownerType: "ShardMining"
              },
              recoveredDeclaringRowModel: {
                ownerType: "ShardMining"
              }
            }
          }
        },
        cost: {
          costModelBoundary: {
            data: {
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
            }
          }
        }
      }
    },
    null
  );

  const saveSummary = getShardSaveBoundarySummary(shardSystem);
  const costSummary = getShardCostModelBoundarySummary(shardSystem);
  assert.equal(saveSummary.hasSeparationBoundary, true);
  assert.equal(saveSummary.ownerAnchor, "ShardMining / ShardUpgradeInfo");
  assert.equal(costSummary.hasBoundary, true);
  assert.equal(costSummary.dataCarrier, "ShardUpgradeInfo");
});

test("buildShardSystemView keeps shard save and cost artifacts only as compatibility fallback when DB coverage exists", () => {
  const shardSystem = buildShardSystemView(
    {
      sections: {
        ownedState: {
          saveBoundary: {
            data: { ownerShellTermsChecked: ["ShardMining"] }
          }
        },
        cost: {
          costModelBoundary: {
            data: { dataCarrier: "ShardUpgradeInfo" }
          }
        }
      }
    },
    {
      genericMechanics: {
        scopes: {
          "shard-owned-state-upgradeinfolist-population": {
            entities: [
              {
                entityId: "shard-owned-state-upgradeinfolist-population",
                entityKind: "family-graph"
              }
            ],
            facts: [],
            relations: [],
            gaps: []
          },
          "shard-cost-su0-structure": {
            entities: [{ entityId: "shard-cost-su0-structure", entityKind: "family-graph" }],
            facts: [],
            relations: [],
            gaps: []
          }
        }
      },
      boundaries: {
        save: {
          subjectId: "shard-owned-state-upgradeinfolist-population",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        },
        cost: {
          subjectId: "shard-cost-su0-structure",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  );

  assert.equal(shardSystem.ownedState.saveBoundary, null);
  assert.equal(shardSystem.cost.costModelBoundary, null);
  assert.deepEqual(shardSystem.ownedState.compatibilityBoundaries.saveBoundary, {
    ownerShellTermsChecked: ["ShardMining"]
  });
  assert.deepEqual(shardSystem.cost.compatibilityBoundaries.costModelBoundary, {
    dataCarrier: "ShardUpgradeInfo"
  });
});

test("shard milestone payload and row-model summaries prefer DB-backed generic mechanics and inferred boundaries when present", () => {
  const shardSystem = {
    genericMechanics: {
      scopes: {
        "shard-milestone-payload-boundary": {
          entities: [
            { entityId: "family-graph:shards-milestone-payload", entityKind: "family-graph" }
          ],
          facts: [
            {
              factKind: "data-carrier-candidate",
              factValue: "ShardMining|ShardUpgradeInfo",
              payload: {}
            },
            { factKind: "row-state-field", factValue: "<IsUnlocked>k__BackingField", payload: {} },
            { factKind: "milestone-payload-hook", factValue: "UpdateShardCostList", payload: {} },
            { factKind: "progress-hook", factValue: "CheckAllMilestoneLevelFills", payload: {} },
            { factKind: "cost-accessor", factValue: "get_SU0Cost", payload: {} },
            { factKind: "parameter-shell-field", factValue: "SU0StartCost", payload: {} },
            {
              factKind: "save-candidate",
              factValue: "PlayerProfile-side shard member shell",
              payload: {}
            }
          ],
          relations: [],
          gaps: [{ gapKind: "next-seam", payload: { seamId: "local-runtime-population-bridge" } }]
        },
        "shard-milestone-row-model-boundary": {
          entities: [
            { entityId: "family-graph:shards-milestone-row-model", entityKind: "family-graph" }
          ],
          facts: [
            {
              factKind: "data-carrier-candidate",
              factValue: "ShardMining|ShardUpgradeInfo",
              payload: {}
            },
            {
              factKind: "runtime-shell",
              factValue: "ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo",
              payload: {}
            },
            { factKind: "row-model-type", factValue: "ShardMining+ShardUpgradeInfo", payload: {} },
            {
              factKind: "generic-buy-family",
              factValue: "ConstructionMilestones, Assembly-CSharp",
              payload: {}
            }
          ],
          relations: [],
          gaps: [{ gapKind: "next-seam", payload: { seamId: "local-runtime-population-bridge" } }]
        }
      }
    },
    boundaries: {
      payload: {
        subjectId: "family-graph:shards-milestone-payload",
        boundaryKind: "subject-boundary",
        verdict: "quarantine",
        nextSeamId: "local-runtime-population-bridge",
        blockedInputReason:
          "Shard milestone payload still lacks dedicated row-local trace coverage",
        genericFactCount: 7,
        genericGapCount: 1
      },
      rowModel: {
        subjectId: "family-graph:shards-milestone-row-model",
        boundaryKind: "subject-boundary",
        verdict: "quarantine",
        nextSeamId: "local-runtime-population-bridge",
        blockedInputReason:
          "Shard milestone row model still lacks dedicated row-local trace coverage",
        genericFactCount: 4,
        genericGapCount: 1
      }
    }
  };

  const payloadSummary = getShardMilestonePayloadBoundarySummary(shardSystem);
  const rowModelSummary = getShardMilestoneRowModelBoundarySummary(shardSystem);
  assert.equal(payloadSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(payloadSummary.hasBoundary, true);
  assert.equal(payloadSummary.hasCostAndListHooks, true);
  assert.equal(payloadSummary.hasCostAccessorSamples, true);
  assert.equal(payloadSummary.nextSeamId, "local-runtime-population-bridge");
  assert.equal(rowModelSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(rowModelSummary.hasBoundary, true);
  assert.equal(rowModelSummary.hasGenericBuyFamily, true);
  assert.equal(
    rowModelSummary.runtimeShell,
    "ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo"
  );
});

test("buildShardSystemView keeps shard milestone payload and row-model artifacts only as compatibility fallback when DB coverage exists", () => {
  const shardSystem = buildShardSystemView(
    {
      sections: {
        family: {
          boundaries: {
            milestonePayload: {
              data: { dataCarrier: "ShardUpgradeInfo" }
            },
            rowModel: {
              data: { dataCarrierTieIn: "ShardMining|ShardUpgradeInfo" }
            }
          }
        }
      }
    },
    {
      genericMechanics: {
        scopes: {
          "shard-milestone-payload-boundary": {
            entities: [
              { entityId: "family-graph:shards-milestone-payload", entityKind: "family-graph" }
            ],
            facts: [],
            relations: [],
            gaps: []
          },
          "shard-milestone-row-model-boundary": {
            entities: [
              { entityId: "family-graph:shards-milestone-row-model", entityKind: "family-graph" }
            ],
            facts: [],
            relations: [],
            gaps: []
          }
        }
      },
      boundaries: {
        payload: {
          subjectId: "family-graph:shards-milestone-payload",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        },
        rowModel: {
          subjectId: "family-graph:shards-milestone-row-model",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  );

  assert.equal(shardSystem.family.boundaries.milestonePayload, null);
  assert.equal(shardSystem.family.boundaries.rowModel, null);
  assert.deepEqual(shardSystem.family.compatibilityBoundaries.milestonePayload, {
    dataCarrier: "ShardUpgradeInfo"
  });
  assert.deepEqual(shardSystem.family.compatibilityBoundaries.rowModel, {
    dataCarrierTieIn: "ShardMining|ShardUpgradeInfo"
  });
});

test("shard row-shell and row-alignment summaries prefer DB-backed generic mechanics and inferred boundaries when present", () => {
  const shardSystem = {
    genericMechanics: {
      scopes: {
        "shard-milestone-row-shell-boundary": {
          entities: [
            { entityId: "family-graph:shards-milestone-row-shell", entityKind: "family-graph" }
          ],
          facts: [
            { factKind: "screen-controller-family", factValue: "ShardMining", payload: {} },
            {
              factKind: "data-carrier-candidate",
              factValue: "ShardMining|ShardUpgradeInfo",
              payload: {}
            },
            {
              factKind: "runtime-shell",
              factValue: "ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo",
              payload: {}
            },
            {
              factKind: "generic-buy-family",
              factValue: "ConstructionMilestones, Assembly-CSharp",
              payload: {}
            }
          ],
          relations: [],
          gaps: [{ gapKind: "next-seam", payload: { seamId: "local-runtime-population-bridge" } }]
        },
        "shard-milestone-row-alignment-boundary": {
          entities: [
            { entityId: "family-graph:shards-milestone-row-alignment", entityKind: "family-graph" }
          ],
          facts: [
            { factKind: "screen-controller-family", factValue: "ShardMining", payload: {} },
            {
              factKind: "generic-buy-family",
              factValue: "ConstructionMilestones, Assembly-CSharp",
              payload: {}
            }
          ],
          relations: [],
          gaps: [{ gapKind: "next-seam", payload: { seamId: "local-runtime-population-bridge" } }]
        }
      }
    },
    boundaries: {
      rowShell: {
        subjectId: "family-graph:shards-milestone-row-shell",
        boundaryKind: "subject-boundary",
        verdict: "quarantine",
        nextSeamId: "local-runtime-population-bridge",
        blockedInputReason:
          "Shard milestone row shell still lacks dedicated row-local trace coverage",
        genericFactCount: 4,
        genericGapCount: 1
      },
      rowAlignment: {
        subjectId: "family-graph:shards-milestone-row-alignment",
        boundaryKind: "subject-boundary",
        verdict: "quarantine",
        nextSeamId: "local-runtime-population-bridge",
        blockedInputReason:
          "Shard milestone row alignment still lacks dedicated row-local trace coverage",
        genericFactCount: 2,
        genericGapCount: 1
      }
    }
  };

  const rowShellSummary = getShardMilestoneRowShellBoundarySummary(shardSystem);
  const rowAlignmentSummary = getShardMilestoneRowAlignmentBoundarySummary(shardSystem);
  assert.equal(rowShellSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(rowShellSummary.hasBoundary, true);
  assert.equal(rowShellSummary.hasBuyHookSamples, true);
  assert.equal(rowShellSummary.nextSeamId, "local-runtime-population-bridge");
  assert.equal(rowAlignmentSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(rowAlignmentSummary.hasBoundary, true);
  assert.equal(rowAlignmentSummary.buyRangeLabel, "generic-numbered-family");
});

test("buildShardSystemView keeps shard row-shell and row-alignment artifacts only as compatibility fallback when DB coverage exists", () => {
  const shardSystem = buildShardSystemView(
    {
      sections: {
        family: {
          boundaries: {
            rowShell: {
              data: { screenControllerFamily: "ShardMining, Assembly-CSharp" }
            },
            rowAlignment: {
              data: { screenControllerFamily: "ShardMining, Assembly-CSharp" }
            }
          }
        }
      }
    },
    {
      genericMechanics: {
        scopes: {
          "shard-milestone-row-shell-boundary": {
            entities: [
              { entityId: "family-graph:shards-milestone-row-shell", entityKind: "family-graph" }
            ],
            facts: [],
            relations: [],
            gaps: []
          },
          "shard-milestone-row-alignment-boundary": {
            entities: [
              {
                entityId: "family-graph:shards-milestone-row-alignment",
                entityKind: "family-graph"
              }
            ],
            facts: [],
            relations: [],
            gaps: []
          }
        }
      },
      boundaries: {
        rowShell: {
          subjectId: "family-graph:shards-milestone-row-shell",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        },
        rowAlignment: {
          subjectId: "family-graph:shards-milestone-row-alignment",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  );

  assert.equal(shardSystem.family.boundaries.rowShell, null);
  assert.equal(shardSystem.family.boundaries.rowAlignment, null);
  assert.deepEqual(shardSystem.family.compatibilityBoundaries.rowShell, {
    screenControllerFamily: "ShardMining, Assembly-CSharp"
  });
  assert.deepEqual(shardSystem.family.compatibilityBoundaries.rowAlignment, {
    screenControllerFamily: "ShardMining, Assembly-CSharp"
  });
});

test("shard FinalSU, title/effect, and text-handler summaries prefer DB-backed generic mechanics and inferred boundaries when present", () => {
  const shardSystem = {
    genericMechanics: {
      scopes: {
        "shard-finalsu-bonus-boundary": {
          entities: [{ entityId: "family-graph:shards-finalsu-bonus", entityKind: "family-graph" }],
          facts: [
            {
              factKind: "data-carrier-candidate",
              factValue: "ShardMining|ShardUpgradeInfo",
              payload: {}
            },
            {
              factKind: "unlock-requirement-accessor",
              factValue: "get_SU1FinalUnlockReq",
              payload: {}
            },
            { factKind: "bonus-field-sample", factValue: "FinalSU29Bonus2", payload: {} },
            { factKind: "bonus-accessor-sample", factValue: "get_FinalSU29Bonus2", payload: {} },
            { factKind: "adjacent-field", factValue: "OverLevel100Exponent", payload: {} }
          ],
          relations: [],
          gaps: [{ gapKind: "next-seam", payload: { seamId: "local-runtime-population-bridge" } }]
        },
        "shard-milestone-title-effect-boundary": {
          entities: [
            { entityId: "family-graph:shards-milestone-title-effect", entityKind: "family-graph" }
          ],
          facts: [
            { factKind: "bonus-calc-accessor", factValue: "get_SU29Bonus2Calc", payload: {} }
          ],
          relations: [],
          gaps: [{ gapKind: "next-seam", payload: { seamId: "local-runtime-population-bridge" } }]
        },
        "shard-effect-text-handler-boundary": {
          entities: [
            { entityId: "family-graph:shards-effect-text-handler", entityKind: "family-graph" }
          ],
          facts: [
            {
              factKind: "generic-milestone-writer",
              factValue: "SetAllMilestoneTexts",
              payload: {}
            },
            { factKind: "bonus-calc-accessor", factValue: "get_SU29Bonus2Calc", payload: {} },
            { factKind: "ui-context-anchor", factValue: "DescriptionText", payload: {} }
          ],
          relations: [],
          gaps: [{ gapKind: "next-seam", payload: { seamId: "local-runtime-population-bridge" } }]
        }
      }
    },
    boundaries: {
      finalSu: {
        subjectId: "family-graph:shards-finalsu-bonus",
        boundaryKind: "subject-boundary",
        verdict: "quarantine",
        nextSeamId: "local-runtime-population-bridge",
        blockedInputReason: "Shard FinalSU bonus remains quarantined",
        genericFactCount: 5,
        genericGapCount: 1
      },
      titleEffect: {
        subjectId: "family-graph:shards-milestone-title-effect",
        boundaryKind: "subject-boundary",
        verdict: "quarantine",
        nextSeamId: "local-runtime-population-bridge",
        blockedInputReason: "Shard milestone title effect remains quarantined",
        genericFactCount: 1,
        genericGapCount: 1
      },
      handler: {
        subjectId: "family-graph:shards-effect-text-handler",
        boundaryKind: "subject-boundary",
        verdict: "quarantine",
        nextSeamId: "local-runtime-population-bridge",
        blockedInputReason: "Shard effect text handler remains quarantined",
        genericFactCount: 3,
        genericGapCount: 1
      }
    }
  };

  const finalSuSummary = getShardFinalSuBonusBoundarySummary(shardSystem);
  const titleEffectSummary = getShardMilestoneTitleEffectBoundarySummary(shardSystem);
  const handlerSummary = getShardEffectTextHandlerBoundarySummary(shardSystem);
  assert.equal(finalSuSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(finalSuSummary.hasBoundary, true);
  assert.equal(titleEffectSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(titleEffectSummary.hasBonusCalcSamples, true);
  assert.equal(handlerSummary.coverageSource, "generic-mechanics+boundary-model");
  assert.equal(handlerSummary.hasBoundary, true);
  assert.equal(handlerSummary.genericWriterLabel, "SetAllMilestoneTexts");
});

test("buildShardSystemView keeps shard FinalSU, title/effect, and text-handler artifacts only as compatibility fallback when DB coverage exists", () => {
  const shardSystem = buildShardSystemView(
    {
      sections: {
        family: {
          boundaries: {
            finalSuBonus: {
              data: { dataCarrier: "ShardUpgradeInfo" }
            },
            titleEffect: {
              data: { titleAssetCandidates: [] }
            },
            effectTextHandler: {
              data: { probableTextHandler: "TextHandlerShardMilestoneBonusesPerLevel/N" }
            }
          }
        }
      }
    },
    {
      genericMechanics: {
        scopes: {
          "shard-finalsu-bonus-boundary": {
            entities: [
              { entityId: "family-graph:shards-finalsu-bonus", entityKind: "family-graph" }
            ],
            facts: [],
            relations: [],
            gaps: []
          },
          "shard-milestone-title-effect-boundary": {
            entities: [
              { entityId: "family-graph:shards-milestone-title-effect", entityKind: "family-graph" }
            ],
            facts: [],
            relations: [],
            gaps: []
          },
          "shard-effect-text-handler-boundary": {
            entities: [
              { entityId: "family-graph:shards-effect-text-handler", entityKind: "family-graph" }
            ],
            facts: [],
            relations: [],
            gaps: []
          }
        }
      },
      boundaries: {
        finalSu: {
          subjectId: "family-graph:shards-finalsu-bonus",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        },
        titleEffect: {
          subjectId: "family-graph:shards-milestone-title-effect",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        },
        handler: {
          subjectId: "family-graph:shards-effect-text-handler",
          boundaryKind: "subject-boundary",
          verdict: "quarantine"
        }
      }
    }
  );

  assert.equal(shardSystem.family.boundaries.finalSuBonus, null);
  assert.equal(shardSystem.family.boundaries.titleEffect, null);
  assert.equal(shardSystem.family.boundaries.effectTextHandler, null);
  assert.deepEqual(shardSystem.family.compatibilityBoundaries.finalSuBonus, {
    dataCarrier: "ShardUpgradeInfo"
  });
  assert.deepEqual(shardSystem.family.compatibilityBoundaries.titleEffect, {
    titleAssetCandidates: []
  });
  assert.deepEqual(shardSystem.family.compatibilityBoundaries.effectTextHandler, {
    probableTextHandler: "TextHandlerShardMilestoneBonusesPerLevel/N"
  });
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

test("static shard family boundary exports are labeled as compatibility-only surfaces", () => {
  const finalSu = getShardFinalSuBonusBoundarySummary({
    dataCarrier: "ShardUpgradeInfo",
    dataCarrierTieIn: "ShardMining|ShardUpgradeInfo",
    unlockRequirementAccessors: ["get_SU1FinalUnlockReq", "get_SU29FinalUnlockReq"],
    bonusFieldSamples: ["FinalSU1Bonus1", "FinalSU29Bonus2", "FinalSU29Bonus3"],
    bonusAccessorSamples: ["get_FinalSU1Bonus1", "get_FinalSU29Bonus2", "get_FinalSU29Bonus3"],
    adjacentFields: [
      "TotalMilestoneLevels",
      "get_IsUnlocked",
      "OverLevel100Exponent",
      "OverLevel400Exponent",
      "<FastBuyEnum>d__1429"
    ]
  });
  const rowModel = getShardMilestoneRowModelBoundarySummary({
    dataCarrierTieIn: "ShardMining|ShardUpgradeInfo",
    textCheckerRange: { start: 0, end: 29, count: 30 },
    unlockRequirementRange: { start: 0, end: 29, count: 30 },
    buyHookEvidence: {
      shardLocalDirectHooks: ["BuyMilestone0"],
      genericNumberedFamily: {
        family: "ConstructionMilestones, Assembly-CSharp",
        start: 1,
        end: 57,
        count: 57
      }
    }
  });

  assert.equal(finalSu.coverageSource, "compatibility-boundary-export");
  assert.equal(finalSu.fallbackMode, "compatibility-finalsu-bonus");
  assert.equal(finalSu.usesLegacyCompatibilityFallback, true);
  assert.equal(rowModel.coverageSource, "compatibility-boundary-export");
  assert.equal(rowModel.fallbackMode, "compatibility-row-model");
  assert.equal(rowModel.usesLegacyCompatibilityFallback, true);
});
