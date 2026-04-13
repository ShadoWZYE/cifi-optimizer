export function toRecommendationAction(item, fallbackModule) {
  return {
    id: normalizeRecommendationId(item?.id, fallbackModule),
    module: normalizeRecommendationModule(item?.module, fallbackModule),
    kind: item?.kind === "upgrade" ? "upgrade" : "warning",
    title: String(item?.title || "Untitled recommendation"),
    score: normalizeFiniteNumber(item?.score),
    confidence: normalizeUnitInterval(item?.confidence),
    cost: item?.cost,
    eta: item?.eta,
    benefit: sanitizeRecommendationLines(item?.benefit),
    whyNow: sanitizeRecommendationLines(item?.whyNow),
    assumptions: sanitizeRecommendationLines(item?.assumptions),
    warnings: sanitizeRecommendationLines(item?.warnings),
    subtitle: item?.subtitle ?? null,
    notes: item?.notes ?? null
  };
}

export function sanitizeRecommendationLines(value) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
}

export function sortRecommendationFeed(items) {
  return [...items].sort((left, right) => {
    const kindRank = getRecommendationKindRank(right.kind) - getRecommendationKindRank(left.kind);
    if (kindRank !== 0) {
      return kindRank;
    }
    const scoreDiff = normalizeFiniteNumber(right.score) - normalizeFiniteNumber(left.score);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    const confidenceDiff =
      normalizeUnitInterval(right.confidence) - normalizeUnitInterval(left.confidence);
    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }
    return String(left.title || "").localeCompare(String(right.title || ""));
  });
}

export function getRecommendationContractIssues(item) {
  const issues = [];
  if (!item || typeof item !== "object") {
    return ["Recommendation action must be an object."];
  }
  if (!String(item.id || "").trim()) {
    issues.push("Recommendation action requires a non-empty id.");
  }
  if (!String(item.module || "").trim()) {
    issues.push("Recommendation action requires a non-empty module.");
  }
  if (!["warning", "upgrade"].includes(item.kind)) {
    issues.push("Recommendation action kind must be warning or upgrade.");
  }
  if (!String(item.title || "").trim()) {
    issues.push("Recommendation action requires a non-empty title.");
  }
  if (!Number.isFinite(Number(item.score))) {
    issues.push("Recommendation action score must be a finite number.");
  }
  if (
    !Number.isFinite(Number(item.confidence)) ||
    Number(item.confidence) < 0 ||
    Number(item.confidence) > 1
  ) {
    issues.push("Recommendation action confidence must be between 0 and 1.");
  }
  for (const key of ["benefit", "whyNow", "assumptions", "warnings"]) {
    if (
      !Array.isArray(item[key]) ||
      item[key].some((entry) => typeof entry !== "string" || !entry.trim())
    ) {
      issues.push(`Recommendation action ${key} must be an array of non-empty strings.`);
    }
  }
  return issues;
}

function getRecommendationKindRank(kind) {
  return kind === "warning" ? 2 : 1;
}

function normalizeRecommendationId(value, fallbackModule) {
  const text = String(value || "").trim();
  if (text) {
    return text;
  }
  return `${fallbackModule || "module"}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRecommendationModule(value, fallbackModule) {
  const text = String(value || fallbackModule || "module").trim();
  return text || "module";
}

function normalizeFiniteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeUnitInterval(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.min(Math.max(numeric, 0), 1);
}
