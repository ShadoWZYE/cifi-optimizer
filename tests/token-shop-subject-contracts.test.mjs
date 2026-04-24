import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTokenShopSubjectContractToRow,
  buildTokenShopSubjectContractIndex,
  getTokenShopSubjectContractForField
} from "../support/token-shop-subject-contracts.js";

test("row-local TokenShop contract adapter surfaces canonical row subject fields", () => {
  const index = buildTokenShopSubjectContractIndex({
    contracts: {
      "token-shop-atu4-mod": {
        traceScope: "token-shop-atu4-mod",
        subjectId: "row:ATU4Button",
        subjectKind: "row-local",
        targetAliases: ["token-shop-atu4-mod"],
        knownEdges: ["exact-shell-to-prefab"],
        missingEdges: [],
        blockedEdges: ["exact-display-update-path"],
        nonblockingEdges: [],
        nextSeam: { edgeType: "exact-display-update-path", status: "blocked" },
        groundedFields: {
          prefabCandidates: ["NewTokenUPGPrefab.T1.ModPointsBooster"]
        },
        supportSummary: {
          supportSurfaceLabels: ["prefab lane"],
          proofCount: 2
        },
        provenanceSummary: {
          proofs: [{ sourceId: "canonical-term-view" }]
        },
        blockedInputReason: "assessment:blocked-edge"
      }
    }
  });

  const contract = getTokenShopSubjectContractForField(index, "ATU4Level");
  const row = applyTokenShopSubjectContractToRow(
    {
      field: "ATU4Level",
      identity: "Old Identity",
      identitySource: "Compatibility"
    },
    contract
  );

  assert.equal(row.subjectId, "row:ATU4Button");
  assert.equal(row.subjectKind, "row-local");
  assert.equal(row.identity, "NewTokenUPGPrefab.T1.ModPointsBooster");
  assert.equal(row.identitySource, "Canonical DB subject contract");
  assert.deepEqual(row.blockedEdges, ["exact-display-update-path"]);
  assert.equal(row.blockedInputReason, "assessment:blocked-edge");
});

test("range-family TokenShop contract adapter preserves canonical family subject fields", () => {
  const index = buildTokenShopSubjectContractIndex({
    contracts: {
      "token-shop-late-atu-family": {
        traceScope: "token-shop-late-atu-family",
        subjectId: "range:token-shop:ATU24Button-ATU28Button",
        subjectKind: "range-family",
        targetAliases: ["token-shop-late-atu-family"],
        knownEdges: ["repeated-serialized-shell-adjacency"],
        missingEdges: ["exact-shell-to-title"],
        blockedEdges: ["exact-shell-to-title"],
        nonblockingEdges: [],
        nextSeam: { edgeType: "exact-shell-to-title", status: "blocked" },
        groundedFields: {},
        supportSummary: {
          supportRows: ["ATU24Button", "ATU25Button", "ATU26Button", "ATU27Button", "ATU28Button"],
          supportSurfaceLabels: ["late-family-shells"],
          proofCount: 3
        },
        provenanceSummary: {
          proofs: [{ sourceId: "graph-links" }]
        },
        blockedInputReason: "reconstruction:baseline-gap"
      }
    }
  });

  const contract = getTokenShopSubjectContractForField(index, "ATU24Level");
  const row = applyTokenShopSubjectContractToRow(
    {
      field: "ATU24Level",
      identity: "Late Identity",
      identitySource: "Compatibility"
    },
    contract
  );

  assert.equal(row.subjectId, "range:token-shop:ATU24Button-ATU28Button");
  assert.equal(row.subjectKind, "range-family");
  assert.equal(row.identity, "Late Identity");
  assert.deepEqual(row.blockedEdges, ["exact-shell-to-title"]);
  assert.equal(row.contractSupportLabel, "late-family-shells");
  assert.equal(row.blockedInputReason, "reconstruction:baseline-gap");
});
