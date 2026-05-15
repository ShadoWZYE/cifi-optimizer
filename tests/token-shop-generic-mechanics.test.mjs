import assert from "node:assert/strict";
import test from "node:test";

import { applyTokenShopGenericRowDetailToRow } from "../support/token-shop-generic-mechanics.js";

test("runtime cost-owner coverage upgrades projected formulas when DB closure exists", () => {
  const row = applyTokenShopGenericRowDetailToRow(
    {
      field: "ATU26Level",
      costFormulaConfidence: "projected",
      blockedInputReason: "runtime-cost-coverage"
    },
    {
      subjectId: "token-shop-late-atu-family#ATU26Level",
      runtimeCostCoverage: {
        status: "closed-by-db-term-bridge",
        evidenceSource: "db-graph-frontier",
        isClosed: true
      },
      blockedFields: {}
    }
  );

  assert.equal(row.costFormulaConfidence, "verified");
  assert.equal(row.blockedInputReason, "runtime-cost-coverage");
  assert.equal(row.runtimeCostCoverage.isClosed, true);
  assert.match(
    row.supportingEvidenceNote,
    /exact next-cost formula still follows formula-confidence/i
  );
});
