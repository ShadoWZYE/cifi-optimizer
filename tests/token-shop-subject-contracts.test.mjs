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
          prefabCandidates: ["NewTokenUPGPrefab.T1.ModPointsBooster"],
          rowDetail: {
            isGrounded: true,
            identity: "NewTokenUPGPrefab.T1.ModPointsBooster",
            identitySource: "Canonical DB subject contract",
            rowType: "prefab-driven",
            rowTypeLabel: "Canonical row local contract row",
            detailNote:
              "Canonical subject contract is active here; the remaining honest seam is exact-display-update-path."
          }
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
  assert.equal(row.rowType, "prefab-driven");
  assert.equal(row.rowTypeLabel, "Canonical row local contract row");
  assert.match(row.note, /remaining honest seam is exact-display-update-path/i);
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

test("range-family TokenShop field-specific row detail can ground a subset while leaving unresolved rows on fallback", () => {
  const index = buildTokenShopSubjectContractIndex({
    contracts: {
      "token-shop-t3-trio-family": {
        traceScope: "token-shop-t3-trio-family",
        subjectId: "range:token-shop:ATU21Button-ATU23Button",
        subjectKind: "range-family",
        targetAliases: ["token-shop-t3-trio-family"],
        knownEdges: [],
        missingEdges: [],
        blockedEdges: [],
        nonblockingEdges: [],
        groundedFields: {
          rowDetailsByField: {
            ATU21Level: {
              isGrounded: true,
              identity: "Trinity Booster One",
              identitySource: "Canonical range-family title surface",
              rowType: "prefab-driven",
              rowTypeLabel: "Canonical range family contract row",
              detailNote:
                "Canonical range-family contract is active here; row identity is grounded through the T3 trio shell range and title or prefab surfaces."
            },
            ATU22Level: {
              isGrounded: true,
              identity: "Trinity Oom Booster",
              identitySource: "Canonical range-family title surface",
              rowType: "prefab-driven",
              rowTypeLabel: "Canonical range family contract row",
              detailNote:
                "Canonical range-family contract is active here; row identity is grounded through the T3 trio shell range and title or prefab surfaces."
            },
            ATU23Level: {
              isGrounded: false,
              blockedFields: {
                rowDetail: "missing-db-row-detail-evidence:t3-trio-third-row-identity"
              }
            }
          }
        },
        supportSummary: {
          supportSurfaceLabels: ["t3 trio shell range", "t3 trio title and text surfaces"],
          proofCount: 2
        },
        provenanceSummary: {
          proofs: [{ sourceId: "graph-links" }]
        }
      }
    }
  });

  const groundedRow = applyTokenShopSubjectContractToRow(
    {
      field: "ATU21Level",
      identity: "Legacy Trinity Booster One",
      identitySource: "Compatibility",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven compatibility row",
      note: "Legacy trio row."
    },
    getTokenShopSubjectContractForField(index, "ATU21Level")
  );
  const blockedRow = applyTokenShopSubjectContractToRow(
    {
      field: "ATU23Level",
      identity: "Legacy Daily Tokens T3",
      identitySource: "Compatibility",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven compatibility row",
      note: "Legacy trio row."
    },
    getTokenShopSubjectContractForField(index, "ATU23Level")
  );

  assert.equal(groundedRow.subjectId, "range:token-shop:ATU21Button-ATU23Button");
  assert.equal(groundedRow.identity, "Trinity Booster One");
  assert.equal(groundedRow.identitySource, "Canonical range-family title surface");
  assert.equal(groundedRow.rowTypeLabel, "Canonical range family contract row");
  assert.match(groundedRow.note, /Canonical range-family contract is active here/i);

  assert.equal(blockedRow.subjectId, "range:token-shop:ATU21Button-ATU23Button");
  assert.equal(blockedRow.identity, "Legacy Daily Tokens T3");
  assert.equal(blockedRow.identitySource, "Compatibility");
  assert.equal(blockedRow.rowTypeLabel, "Prefab-driven compatibility row");
  assert.equal(blockedRow.note, "Legacy trio row.");
});

test("Token Shop family contract can ground ATU6 while leaving the remaining MK chain on explicit fallback", () => {
  const index = buildTokenShopSubjectContractIndex({
    contracts: {
      "token-shop-family-structure": {
        traceScope: "token-shop-family-structure",
        subjectId: "range:token-shop:ATU1Button-ATU28Button",
        subjectKind: "range-family",
        targetAliases: ["token-shop-family-structure"],
        knownEdges: [],
        missingEdges: [],
        blockedEdges: [],
        nonblockingEdges: [],
        groundedFields: {
          rowDetailsByField: {
            ATU6Level: {
              isGrounded: true,
              identity: "Mk2 Generator Booster",
              identitySource: "Canonical Token Shop family title surface",
              rowType: "prefab-driven",
              rowTypeLabel: "Canonical range family contract row",
              detailNote:
                "Canonical range-family contract is active here; the MK chain row identity is grounded through the Token Shop family shell, proxy, prefab, and title surfaces."
            },
            ATU8Level: {
              isGrounded: false,
              blockedFields: {
                rowDetail:
                  "missing-db-row-detail-evidence:mk-chain-field-specific-support:ATU8Level"
              }
            }
          }
        },
        supportSummary: {
          supportSurfaceLabels: [
            "Family shell range",
            "Bridge-proxy lane",
            "Prefab identity roster",
            "Title and text surfaces"
          ],
          proofCount: 4
        },
        provenanceSummary: {
          proofs: [{ sourceId: "canonical-term-view" }]
        }
      }
    }
  });

  const groundedRow = applyTokenShopSubjectContractToRow(
    {
      field: "ATU6Level",
      identity: "Legacy Mk2 Generator Booster",
      identitySource: "Compatibility",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven compatibility row",
      note: "Legacy MK chain row."
    },
    getTokenShopSubjectContractForField(index, "ATU6Level")
  );
  const blockedRow = applyTokenShopSubjectContractToRow(
    {
      field: "ATU8Level",
      identity: "Legacy Mk4 Generator Booster",
      identitySource: "Compatibility",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven compatibility row",
      note: "Legacy MK chain row."
    },
    getTokenShopSubjectContractForField(index, "ATU8Level")
  );

  assert.equal(groundedRow.subjectId, "range:token-shop:ATU1Button-ATU28Button");
  assert.equal(groundedRow.identity, "Mk2 Generator Booster");
  assert.equal(groundedRow.identitySource, "Canonical Token Shop family title surface");
  assert.equal(groundedRow.rowTypeLabel, "Canonical range family contract row");
  assert.match(groundedRow.note, /MK chain row identity is grounded/i);

  assert.equal(blockedRow.subjectId, "range:token-shop:ATU1Button-ATU28Button");
  assert.equal(blockedRow.identity, "Legacy Mk4 Generator Booster");
  assert.equal(blockedRow.identitySource, "Compatibility");
  assert.equal(blockedRow.rowTypeLabel, "Prefab-driven compatibility row");
  assert.equal(
    blockedRow.blockedInputReason,
    "missing-db-row-detail-evidence:mk-chain-field-specific-support:ATU8Level"
  );
  assert.equal(blockedRow.note, "Legacy MK chain row.");
});

test("legacy TokenShop row detail stays intact when contract row-detail block is absent", () => {
  const row = applyTokenShopSubjectContractToRow(
    {
      field: "ATU5Level",
      identity: "Legacy MK1 Identity",
      identitySource: "Checked prefab identity",
      rowType: "prefab-driven",
      rowTypeLabel: "Prefab-driven checked row",
      note: "Legacy checked row detail."
    },
    {
      subjectId: "row:ATU5Button",
      subjectKind: "row-local",
      targetAliases: ["token-shop-atu5-mk1-title"],
      knownEdges: [],
      missingEdges: [],
      blockedEdges: [],
      nonblockingEdges: [],
      groundedFields: {},
      supportSummary: {},
      provenanceSummary: {}
    }
  );

  assert.equal(row.identity, "Legacy MK1 Identity");
  assert.equal(row.identitySource, "Checked prefab identity");
  assert.equal(row.rowTypeLabel, "Prefab-driven checked row");
  assert.equal(row.note, "Legacy checked row detail.");
});
