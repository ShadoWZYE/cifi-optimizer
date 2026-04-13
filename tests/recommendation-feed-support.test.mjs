import test from "node:test";
import assert from "node:assert/strict";

import {
  getCompactProgressionNoteModel,
  getProgressionRecommendationFeedPartition,
  getRecommendationExplainabilityAudit,
  getRecommendationFeedSupportNoticeLines,
  getRecommendationFeedSummaryModel
} from "../support/recommendation-feed-support.js";

test("getProgressionRecommendationFeedPartition keeps only valid shard and loop items in the main feed", () => {
  const partition = getProgressionRecommendationFeedPartition([
    {
      id: "loop-good",
      module: "loop",
      kind: "warning",
      title: "Loop guardrail",
      score: 9,
      confidence: 0.7,
      whyNow: ["Now"],
      assumptions: ["Assume"],
      benefit: ["Benefit"],
      warnings: ["Warn"],
      notes: "Source"
    },
    {
      module: "shards",
      kind: "warning",
      title: "Broken shard card",
      score: 8,
      confidence: 0.6,
      whyNow: ["Now"],
      assumptions: ["Assume"],
      benefit: ["Benefit"],
      warnings: ["Warn"],
      notes: "Source"
    },
    {
      id: "ship-ignore",
      module: "ship",
      kind: "warning",
      title: "Ship item",
      score: 5,
      confidence: 0.5,
      whyNow: ["Now"],
      assumptions: ["Assume"],
      benefit: ["Benefit"],
      warnings: ["Warn"],
      notes: "Source"
    }
  ]);

  assert.equal(partition.all.length, 2);
  assert.equal(partition.valid.length, 1);
  assert.equal(partition.invalid.length, 1);
  assert.equal(partition.valid[0].id, "loop-good");
  assert.equal(partition.invalid[0].title, "Broken shard card");
});

test("recommendation feed summary and support notice preserve audit counts and titles", () => {
  const results = [
    {
      id: "loop-watch",
      module: "loop",
      kind: "warning",
      title: "Loop watch",
      score: 7,
      confidence: 0.7,
      benefit: ["Benefit"],
      whyNow: ["Why now"],
      assumptions: ["Assumption"],
      warnings: ["Warning"],
      notes: "Source"
    },
    {
      id: "shard-watch",
      module: "shards",
      kind: "warning",
      title: "Shard watch",
      score: 6,
      confidence: 0.6,
      benefit: ["Benefit"],
      whyNow: ["Why now"],
      assumptions: ["Assumption"],
      warnings: ["Warning"],
      notes: "Source"
    },
    {
      module: "shards",
      title: "Broken shard card",
      id: "",
      kind: "warning",
      score: 5,
      confidence: 0.4
    }
  ];

  const summary = getRecommendationFeedSummaryModel(results);
  const lines = getRecommendationFeedSupportNoticeLines([{ title: "Broken shard card" }]);

  assert.equal(summary.visibleCount, 3);
  assert.equal(summary.loopCount, 1);
  assert.equal(summary.shardCount, 2);
  assert.equal(summary.contractAudit.invalidCount, 1);
  assert.match(summary.contractAudit.topIssueLine, /non-empty id/i);
  assert.equal(lines[1], "Quarantined titles: Broken shard card.");
});

test("compact progression note model and explainability audit keep the selected text lines", () => {
  const item = {
    id: "loop-warning",
    module: "loop",
    kind: "warning",
    title: "Loop warning",
    subtitle: "",
    score: 7,
    confidence: 0.66,
    whyNow: ["Why now line", "Second why"],
    assumptions: ["Assumption line"],
    benefit: ["Benefit line"],
    warnings: ["Primary warning"],
    notes: ""
  };

  const compact = getCompactProgressionNoteModel(item, "loop");
  const audit = getRecommendationExplainabilityAudit(item);

  assert.equal(compact.toneClass, "watch-note-warn");
  assert.equal(compact.subtitle, "");
  assert.equal(compact.primaryLine, "Primary warning");
  assert.equal(compact.secondaryLine, "Why now line");
  assert.equal(compact.sourceLine, "Assumption line");
  assert.equal(compact.confidence, 66);
  assert.equal(audit.status, "Partial context");
  assert.equal(audit.sourceNoteStatus, "Missing");
  assert.equal(audit.missingLine, "Missing: Source note.");
});
