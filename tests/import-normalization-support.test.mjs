import test from "node:test";
import assert from "node:assert/strict";

import {
  coerceInputValue,
  formatCiNormalizedNumber,
  normalizeCiNumberValue,
  normalizeGeneratorTierKey,
  normalizeImportRow,
  parseCsv,
  slugify
} from "../import-normalization-support.js";

test("parseCsv keeps quoted commas and normalizeImportRow shapes import datasets", () => {
  assert.deepEqual(parseCsv('title,goal\n"Track, Alpha",Focus'), [
    { title: "Track, Alpha", goal: "Focus" }
  ]);

  assert.deepEqual(
    normalizeImportRow(
      {
        label: " Gamma Node ",
        tags: "alpha| beta ; gamma",
        max_level: "12"
      },
      "gemNodes",
      2
    ),
    {
      id: "gamma_node",
      label: "Gamma Node",
      level: 0,
      maxLevel: 12,
      cost: 0,
      value: 0,
      tags: ["alpha", "beta", "gamma"]
    }
  );

  assert.deepEqual(
    normalizeImportRow(
      {
        title: " Validation ",
        module: "",
        expected: "pass"
      },
      "validationCases",
      0
    ),
    {
      id: "validation",
      module: "ship",
      title: "Validation",
      expected: "pass",
      description: ""
    }
  );
});

test("slug and CI-number normalization preserve import utility behavior", () => {
  assert.equal(slugify("  Alpha/Beta Loadout  "), "alpha_beta_loadout");
  assert.equal(normalizeCiNumberValue("5.8k"), 5800);
  assert.equal(normalizeCiNumberValue("7.15e549"), "7.15e549");
  assert.equal(formatCiNormalizedNumber(71.5, 548), "7.15e549");
  assert.equal(normalizeCiNumberValue(""), "");
  assert.equal(coerceInputValue("9.8t"), 9800000000000);
  assert.equal(coerceInputValue("manual"), "manual");
  assert.equal(coerceInputValue(""), null);
});

test("generator tier key normalization accepts n, mk, and plain numeric forms", () => {
  assert.equal(normalizeGeneratorTierKey("n7"), "n7");
  assert.equal(normalizeGeneratorTierKey("MK 10"), "n10");
  assert.equal(normalizeGeneratorTierKey("3"), "n3");
  assert.equal(normalizeGeneratorTierKey("tier-x"), null);
});
