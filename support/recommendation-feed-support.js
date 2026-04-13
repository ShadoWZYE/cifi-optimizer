import { getRecommendationContractIssues } from "../recommendation-contract.js";

export function getProgressionRecommendationFeedPartition(items) {
  const all = Array.isArray(items)
    ? items.filter((item) => item?.module === "shards" || item?.module === "loop")
    : [];
  const valid = [];
  const invalid = [];
  all.forEach((item) => {
    if (getRecommendationContractIssues(item).length) {
      invalid.push(item);
      return;
    }
    valid.push(item);
  });
  return { all, valid, invalid };
}

export function getRecommendationExplainabilitySummary(results) {
  const withWhyNow = results.filter(
    (item) => Array.isArray(item.whyNow) && item.whyNow.length
  ).length;
  const withAssumptions = results.filter(
    (item) => Array.isArray(item.assumptions) && item.assumptions.length
  ).length;
  const withWarnings = results.filter(
    (item) => Array.isArray(item.warnings) && item.warnings.length
  ).length;
  const withNotes = results.filter((item) => String(item.notes || "").trim()).length;
  const withFullContext = results.filter(
    (item) =>
      Array.isArray(item.whyNow) &&
      item.whyNow.length &&
      Array.isArray(item.assumptions) &&
      item.assumptions.length &&
      Array.isArray(item.warnings) &&
      item.warnings.length &&
      String(item.notes || "").trim()
  ).length;
  const averageConfidence = Math.round(
    (results.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / results.length) * 100
  );
  const partialContext = results.length - withFullContext;
  const missingSourceNotes = results.length - withNotes;

  return {
    withWhyNow,
    withAssumptions,
    withWarnings,
    withNotes,
    withFullContext,
    averageConfidence,
    partialContext,
    missingSourceNotes
  };
}

export function getRecommendationContractSummary(results) {
  const issueCounts = new Map();
  let invalidCount = 0;

  results.forEach((item) => {
    const issues = getRecommendationContractIssues(item);
    if (!issues.length) {
      return;
    }
    invalidCount += 1;
    issues.forEach((issue) => {
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    });
  });

  const sortedIssues = [...issueCounts.entries()].sort((left, right) => right[1] - left[1]);
  return {
    validCount: results.length - invalidCount,
    invalidCount,
    topIssueLine: sortedIssues.length
      ? `${sortedIssues[0][0]} (${sortedIssues[0][1]} item${sortedIssues[0][1] === 1 ? "" : "s"})`
      : "No contract gaps in the active feed"
  };
}

export function getRecommendationFeedSummaryModel(results) {
  const loopCount = results.filter((item) => item.module === "loop").length;
  const shardCount = results.filter((item) => item.module === "shards").length;
  return {
    visibleCount: results.length,
    loopCount,
    shardCount,
    contractAudit: getRecommendationContractSummary(results)
  };
}

export function getRecommendationFeedSupportNoticeLines(results) {
  const titles = results.map((item) => item.title).filter(Boolean);
  return [
    `${results.length} recommendation item${results.length === 1 ? "" : "s"} failed the shared recommendation contract and were removed from the main feed.`,
    titles.length
      ? `Quarantined titles: ${titles.join(", ")}.`
      : "Quarantined items are missing expected titles.",
    "Use the contract audit details to repair those cards before treating them as player-facing guidance."
  ];
}

export function getCompactProgressionNoteLine(lines, exclude = "") {
  const list = Array.isArray(lines) ? lines : [];
  return list.find((line) => line && line !== exclude) || "";
}

export function getCompactProgressionNoteModel(item, module) {
  const contractIssues = getRecommendationContractIssues(item);
  const confidence = Math.round((item.confidence ?? 0.5) * 100);
  const toneClass =
    module === "loop" || item.kind === "warning" ? "watch-note-warn" : "watch-note-pass";
  const subtitle = item.subtitle ?? (module === "shards" ? "Shard Mining" : "Loop Prestige");
  const primaryLine =
    getCompactProgressionNoteLine(item.warnings) ||
    getCompactProgressionNoteLine(item.whyNow) ||
    item.notes ||
    "";
  const secondaryLine =
    getCompactProgressionNoteLine(item.whyNow, primaryLine) ||
    getCompactProgressionNoteLine(item.assumptions, primaryLine) ||
    getCompactProgressionNoteLine(item.benefit, primaryLine) ||
    "";
  const sourceLine = item.notes || getCompactProgressionNoteLine(item.assumptions) || "";

  return {
    contractIssues,
    confidence,
    toneClass,
    subtitle,
    primaryLine,
    secondaryLine,
    sourceLine
  };
}

export function getRecommendationExplainabilityAudit(item) {
  const missing = [];
  if (!Array.isArray(item.whyNow) || !item.whyNow.length) {
    missing.push("Why now");
  }
  if (!Array.isArray(item.assumptions) || !item.assumptions.length) {
    missing.push("Assumptions");
  }
  if (!Array.isArray(item.warnings) || !item.warnings.length) {
    missing.push("Warnings");
  }
  if (!String(item.notes || "").trim()) {
    missing.push("Source note");
  }

  return {
    status: missing.length ? "Partial context" : "Complete context",
    sourceNoteStatus: String(item.notes || "").trim() ? "Present" : "Missing",
    missingLine: missing.length ? `Missing: ${missing.join(", ")}.` : "Missing: none."
  };
}
