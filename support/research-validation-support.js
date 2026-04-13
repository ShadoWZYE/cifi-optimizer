export function getResearchTrackOrder(track) {
  const order = [
    "data-contracts-and-apk-pipeline",
    "playerprofile-boundary-and-imports",
    "shard-milestone-payload-recovery",
    "shards-and-loop-guardrails",
    "unified-feed-and-hardening",
    "spend-planner-first-ui-slice",
    "spend-multiverse-savedata-import-surface",
    "spend-multiverse-save-model-recovery",
    "hunter-related-planning",
    "mech-related-planning",
    "input-automation-intake",
    "external-model-integration-intake"
  ];
  const index = order.indexOf(track.id);
  return index === -1 ? order.length : index;
}

export function getResearchTrackSequenceLabel(track) {
  const labelsById = {
    "data-contracts-and-apk-pipeline": "Sequence 1/5",
    "playerprofile-boundary-and-imports": "Sequence 1/5",
    "shard-milestone-payload-recovery": "Sequence 2/5",
    "shards-and-loop-guardrails": "Sequence 2/5",
    "unified-feed-and-hardening": "Sequence 3/5",
    "spend-planner-first-ui-slice": "Sequence 4/5",
    "spend-multiverse-savedata-import-surface": "Sequence 4/5",
    "spend-multiverse-save-model-recovery": "Sequence 4/5",
    "hunter-related-planning": "Research intake",
    "mech-related-planning": "Research intake",
    "input-automation-intake": "Research intake",
    "external-model-integration-intake": "Research intake"
  };
  return labelsById[track.id] || "Research";
}

export function getResearchTrackLane(track) {
  if (track.status === "archived") {
    return "Foundation archive";
  }
  if (track.status === "active") {
    return "Active roadmap slice";
  }
  return "Queued behind mapping gate";
}

export function getResearchTrackStatus(track) {
  const statusById = {
    active: "Active",
    queued: "Queued after gate",
    research: "In research",
    archived: "Archived"
  };
  return statusById[track.status] || "Queued after gate";
}

export function getResearchTrackPhase(track) {
  const phaseById = {
    "data-contracts-and-apk-pipeline": "PR 1",
    "playerprofile-boundary-and-imports": "PR 1",
    "shard-milestone-payload-recovery": "PR 2 successor",
    "shards-and-loop-guardrails": "PR 2",
    "unified-feed-and-hardening": "PR 3 then PR 5 hardening",
    "spend-planner-first-ui-slice": "PR 6 prep slice",
    "spend-multiverse-savedata-import-surface": "PR 4 successor",
    "spend-multiverse-save-model-recovery": "PR 4 successor",
    "hunter-related-planning": "Research intake only",
    "mech-related-planning": "Research intake only",
    "input-automation-intake": "Research intake only",
    "external-model-integration-intake": "Research intake only"
  };
  return phaseById[track.id] || "Research";
}

export function getResearchTrackSource(track) {
  const sourceById = {
    "data-contracts-and-apk-pipeline": "APK/Unity first",
    "playerprofile-boundary-and-imports": "Schema boundary",
    "shard-milestone-payload-recovery": "Grounded shard data",
    "shards-and-loop-guardrails": "Grounded shard data",
    "spend-planner-first-ui-slice": "Canonical PlayerProfile spend inputs",
    "spend-multiverse-savedata-import-surface": "Extracted Emporium save-side data",
    "spend-multiverse-save-model-recovery": "Extracted Emporium save-side data",
    "unified-feed-and-hardening": "Integration contract",
    "hunter-related-planning": "Research intake",
    "mech-related-planning": "Research intake",
    "input-automation-intake": "Research intake",
    "external-model-integration-intake": "Research intake"
  };
  return sourceById[track.id] || "Research";
}

export function getResearchTrackProgressLabel(track) {
  const completedSteps = Array.isArray(track.completedSteps) ? track.completedSteps.length : 0;
  const remainingSteps = Array.isArray(track.nextSteps) ? track.nextSteps.length : 0;
  const totalSteps = completedSteps + remainingSteps;
  return `${completedSteps}/${totalSteps} done`;
}

export function buildResearchTrackProgressModel(track) {
  const completedSteps = Array.isArray(track.completedSteps) ? track.completedSteps : [];
  const remainingSteps = Array.isArray(track.nextSteps) ? track.nextSteps : [];
  const totalSteps = completedSteps.length + remainingSteps.length;
  const percent = totalSteps ? Math.round((completedSteps.length / totalSteps) * 100) : 0;

  return {
    currentSlice: track.currentSlice || "Current slice not recorded yet.",
    sequenceLabel: getResearchTrackSequenceLabel(track),
    phaseLabel: getResearchTrackPhase(track),
    completedSteps,
    remainingSteps,
    completedCount: completedSteps.length,
    remainingCount: remainingSteps.length,
    percent,
    progressLabel: getResearchTrackProgressLabel(track)
  };
}

export function buildResearchTrackContractModel(track) {
  const sources = Array.isArray(track.sources) ? track.sources : [];
  const artifacts = Array.isArray(track.artifacts) ? track.artifacts : [];
  const verified = Array.isArray(track.verified) ? track.verified : [];
  const uncertain = Array.isArray(track.uncertain) ? track.uncertain : [];
  const metaLabels = [
    track.classification || null,
    track.category || null,
    track.implementationRelevance || null,
    typeof track.apkUnityPathChecked === "boolean"
      ? track.apkUnityPathChecked
        ? "APK/Unity first"
        : "APK/Unity not yet checked"
      : null
  ].filter(Boolean);

  return {
    metaLabels,
    exitCondition: track.exitCondition || "",
    blockedBy: track.blockedBy || "",
    smallestShippableSlice: track.smallestShippableSlice || "",
    sources,
    artifacts,
    verified,
    uncertain,
    hasContent:
      metaLabels.length > 0 ||
      Boolean(track.exitCondition) ||
      Boolean(track.blockedBy) ||
      Boolean(track.smallestShippableSlice) ||
      sources.length > 0 ||
      artifacts.length > 0 ||
      verified.length > 0 ||
      uncertain.length > 0
  };
}

export function mapDatasetClassificationToShardStatus(classification, fallback = "Unmapped") {
  const statusByClassification = {
    "canonical-app-snapshot": "Integrated",
    "grounded-descriptive": "Integrated",
    "extracted-mechanics": "Available",
    "community-derived": "Unmapped"
  };
  return statusByClassification[classification] || fallback;
}

export function getShardBadgeMetaFromLabel(label, classification = null) {
  return {
    label,
    cardClass: `shard-status-card-${label.toLowerCase()}`,
    pillClass: `shard-status-pill-${label.toLowerCase()}`,
    classification
  };
}

export function getDatasetBadgeMetaFromEntry(entry, fallbackLabel = "Unmapped") {
  const label = mapDatasetClassificationToShardStatus(entry?.classification, fallbackLabel);
  return getShardBadgeMetaFromLabel(label, entry?.classification || null);
}

export function buildSnapshotValidationCases(validationCases, current, supportSurfaceModules) {
  const cases = Array.isArray(validationCases) ? validationCases : [];
  const supportModules = supportSurfaceModules ?? new Set();
  return cases.map((item) => ({
    title: item.title,
    expected: item.expected,
    actual: current[item.module],
    pass: item.expected === current[item.module],
    scope: supportModules.has(item.module) ? "Support" : "MVP"
  }));
}

export function partitionValidationResults(results) {
  return {
    mvp: results.filter((item) => item.scope === "MVP"),
    apk: results.filter((item) => item.scope === "APK"),
    support: results.filter((item) => item.scope === "Support")
  };
}

export function getValidationScopeMeta(scope) {
  return `${scope} ${
    scope === "Support"
      ? "| quarantined support surface"
      : scope === "APK"
        ? "| extracted grounding gate"
        : "| grounded MVP surface"
  }`;
}

export function getValidationStatusMeta(item) {
  return `${item.pass ? "PASS" : "WARN"} | Expected: ${item.expected}`;
}
