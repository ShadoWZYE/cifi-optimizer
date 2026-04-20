import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeMultiverseMarketSaveBoundary,
  normalizeShardMilestoneSaveOwnerCandidates,
  normalizeShardSaveBoundary,
  normalizeTokenShopSaveBoundary
} from "../support/boundary-contract-normalizers.js";

test("normalizeShardSaveBoundary maps legacy probeResults and trace-owned fields to canonical names", () => {
  const normalized = normalizeShardSaveBoundary({
    sources: {
      ownedStateTraceRun: "workbench/trace-runs/example.json"
    },
    probeResults: {
      traceRegistryHasOwnedStateTarget: true,
      traceWorkflowHasOwnedStatePopulationBridge: false,
      traceOwnedStateOutcomeKind: "non-local-injection-seam",
      traceOwnedStateOutcomeLabel: "Non-local injection seam",
      traceHasDeeperWrapperHandoff: false,
      traceHasNonLocalInjectionSeam: true,
      saveSideOwnerRecovered: false
    }
  });

  assert.equal(
    normalized.sources.ownedStateTargetBundle,
    "workbench/trace-runs/example.json"
  );
  assert.equal(normalized.boundaryEvidence.ownedStateTargetRecovered, true);
  assert.equal(normalized.boundaryEvidence.ownedStatePopulationBridgeRecovered, false);
  assert.equal(normalized.boundaryEvidence.ownedStateOutcomeKind, "non-local-injection-seam");
  assert.equal(normalized.boundaryEvidence.nonLocalInjectionSeamRecovered, true);
});

test("normalizeTokenShopSaveBoundary and normalizeMultiverseMarketSaveBoundary accept v1 fields", () => {
  const token = normalizeTokenShopSaveBoundary({
    probeResults: {
      metadataHasSaveTerms: true,
      level0HasSaveTerms: false,
      ownerShellWithSaveOverlapCount: 0,
      directTokenShopPlayerProfileContext: false
    }
  });
  const multiverse = normalizeMultiverseMarketSaveBoundary({
    probeResults: {
      actionShellWithSaveOverlapCount: 0,
      metadataNeighborhoodHasActionTerms: true,
      metadataNeighborhoodHasSaveTerms: true,
      metadataProbeHasSaveTerms: false,
      level0ProbeHasSaveTerms: false
    }
  });

  assert.equal(token.boundaryEvidence.metadataHasSaveTerms, true);
  assert.equal(token.boundaryEvidence.level0HasSaveTerms, false);
  assert.equal(multiverse.boundaryEvidence.metadataDirectCheckHasSaveTerms, false);
  assert.equal(multiverse.boundaryEvidence.level0DirectCheckHasSaveTerms, false);
});

test("normalizeShardMilestoneSaveOwnerCandidates maps historical overlap stats to canonical names", () => {
  const normalized = normalizeShardMilestoneSaveOwnerCandidates({
    sources: {
      ownedStateTraceRun: "workbench/trace-runs/example.json"
    },
    checkedOverlapStatistics: {
      traceWorkflowHasOwnedStatePopulationBridge: false,
      traceOwnedStateOutcomeKind: "non-local-injection-seam"
    }
  });

  assert.equal(
    normalized.sources.ownedStateTargetBundle,
    "workbench/trace-runs/example.json"
  );
  assert.equal(normalized.checkedOverlapStatistics.ownedStatePopulationBridgeRecovered, false);
  assert.equal(
    normalized.checkedOverlapStatistics.ownedStateOutcomeKind,
    "non-local-injection-seam"
  );
});
