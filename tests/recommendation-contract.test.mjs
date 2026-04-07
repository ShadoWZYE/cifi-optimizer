import test from "node:test";
import assert from "node:assert/strict";

import {
  getRecommendationContractIssues,
  sortRecommendationFeed
} from "../recommendation-contract.js";

test("getRecommendationContractIssues reports missing id, module, and title", () => {
  const issues = getRecommendationContractIssues({
    kind: "warning",
    score: 10,
    confidence: 0.5,
    benefit: ["b"],
    whyNow: ["w"],
    assumptions: ["a"],
    warnings: ["warn"]
  });

  assert.ok(issues.includes("Recommendation action requires a non-empty id."));
  assert.ok(issues.includes("Recommendation action requires a non-empty module."));
  assert.ok(issues.includes("Recommendation action requires a non-empty title."));
});

test("getRecommendationContractIssues rejects invalid score and confidence values", () => {
  const issues = getRecommendationContractIssues({
    id: "bad-values",
    module: "test",
    kind: "upgrade",
    title: "Broken",
    score: Number.NaN,
    confidence: 1.5,
    benefit: ["b"],
    whyNow: ["w"],
    assumptions: ["a"],
    warnings: ["warn"]
  });

  assert.ok(issues.includes("Recommendation action score must be a finite number."));
  assert.ok(issues.includes("Recommendation action confidence must be between 0 and 1."));
});

test("sortRecommendationFeed keeps warnings first, then score, then confidence, then title", () => {
  const sorted = sortRecommendationFeed([
    { kind: "upgrade", score: 8, confidence: 0.9, title: "Zulu" },
    { kind: "warning", score: 6, confidence: 0.2, title: "Beta" },
    { kind: "warning", score: 6, confidence: 0.8, title: "Alpha" },
    { kind: "warning", score: 10, confidence: 0.1, title: "Gamma" },
    { kind: "upgrade", score: 8, confidence: 0.9, title: "Alpha" }
  ]);

  assert.deepEqual(
    sorted.map((item) => item.title),
    ["Gamma", "Alpha", "Beta", "Alpha", "Zulu"]
  );
});
