import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResearchTrackContractModel,
  buildResearchTrackProgressModel,
  buildSnapshotValidationCases,
  getDatasetBadgeMetaFromEntry,
  getResearchTrackLane,
  getResearchTrackOrder,
  getResearchTrackSource,
  getValidationScopeMeta,
  getValidationStatusMeta,
  partitionValidationResults
} from "../support/research-validation-support.js";

test("research track helpers preserve ordering and progress or contract shaping", () => {
  const track = {
    id: "playerprofile-boundary-and-imports",
    status: "active",
    currentSlice: "Import helpers",
    completedSteps: ["schema"],
    nextSteps: ["support module"],
    classification: "candidate-mvp-adjacent",
    category: "imports",
    implementationRelevance: "high",
    apkUnityPathChecked: true,
    blockedBy: "none",
    smallestShippableSlice: "Extract one helper cluster",
    sources: ["report"],
    artifacts: ["data/player-profile.json"],
    verified: ["field labels"],
    uncertain: ["late-game imports"]
  };

  assert.equal(getResearchTrackOrder(track), 1);
  assert.equal(getResearchTrackLane(track), "Active roadmap slice");
  assert.equal(getResearchTrackSource(track), "Schema boundary");

  assert.deepEqual(buildResearchTrackProgressModel(track), {
    currentSlice: "Import helpers",
    sequenceLabel: "Sequence 1/5",
    phaseLabel: "PR 1",
    completedSteps: ["schema"],
    remainingSteps: ["support module"],
    completedCount: 1,
    remainingCount: 1,
    percent: 50,
    progressLabel: "1/2 done"
  });

  assert.deepEqual(buildResearchTrackContractModel(track), {
    metaLabels: ["candidate-mvp-adjacent", "imports", "high", "APK/Unity first"],
    exitCondition: "",
    blockedBy: "none",
    smallestShippableSlice: "Extract one helper cluster",
    sources: ["report"],
    artifacts: ["data/player-profile.json"],
    verified: ["field labels"],
    uncertain: ["late-game imports"],
    hasContent: true
  });
});

test("dataset badge and validation case helpers preserve support-surface shaping", () => {
  assert.deepEqual(
    getDatasetBadgeMetaFromEntry({ classification: "extracted-mechanics" }, "Blocked"),
    {
      label: "Available",
      cardClass: "shard-status-card-available",
      pillClass: "shard-status-pill-available",
      classification: "extracted-mechanics"
    }
  );

  const results = buildSnapshotValidationCases(
    [
      { title: "Feed", module: "recommendationFeed", expected: "ok" },
      { title: "Ship", module: "ship", expected: "warn" }
    ],
    {
      recommendationFeed: "ok",
      ship: "fine"
    },
    new Set(["recommendationFeed"])
  );

  assert.deepEqual(results, [
    {
      title: "Feed",
      expected: "ok",
      actual: "ok",
      pass: true,
      scope: "Support"
    },
    {
      title: "Ship",
      expected: "warn",
      actual: "fine",
      pass: false,
      scope: "MVP"
    }
  ]);

  assert.deepEqual(partitionValidationResults([...results, { scope: "APK", pass: true }]), {
    mvp: [results[1]],
    apk: [{ scope: "APK", pass: true }],
    support: [results[0]]
  });
  assert.equal(getValidationScopeMeta("Support"), "Support | quarantined support surface");
  assert.equal(getValidationScopeMeta("APK"), "APK | extracted grounding gate");
  assert.equal(getValidationStatusMeta(results[1]), "WARN | Expected: warn");
});
