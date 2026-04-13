export function buildPlayerProfileBoundaryGroups({
  canonical,
  shardPlanner,
  shipPlanner,
  experimental,
  compatibility
}) {
  return [
    {
      title: "Canonical shared truth",
      note: "Grounded account state and metadata that the shared MVP profile can treat as first-class truth.",
      items: [
        ["Profile name", canonical.profileName],
        ["Data confidence", canonical.dataConfidence],
        ["Current LR", canonical.loopReset],
        ["Diamonds", canonical.diamonds],
        ["Tokens", canonical.tokens],
        ["Current shards", canonical.shards],
        ["Profile notes", canonical.notes]
      ]
    },
    {
      title: "Import-only or aggregated profile fields",
      note: "Real profile values that are not currently direct active-form inputs because they are aggregated, derived, or not quickly readable in-game.",
      items: [["Academy relics", canonical.academyRelics]]
    },
    {
      title: "Planner-only helpers",
      note: "Manual helper inputs used by descriptive planners, not canonical account truth. Derived values that are not directly visible in game stay out of the active form.",
      items: [
        ["Total shard milestone levels", shardPlanner.totalMilestoneLevels],
        ["Threshold watch row", shardPlanner.focusMilestoneId],
        ["Threshold watch row level", shardPlanner.focusMilestoneLevel],
        ["Observed shard rows", Object.keys(shardPlanner.observedLevelsByMilestone ?? {}).length]
      ]
    },
    {
      title: "External-model implementation state",
      note: "Current implementation data for canonical systems that stays isolated from shared profile truth. Imports must use explicit systems.ship or externalModels.shipPlanner paths.",
      items: [
        ["Ship planner power", shipPlanner.summary.power],
        ["Ship planner speed", shipPlanner.summary.speed],
        ["Ship planner cargo", shipPlanner.summary.cargo],
        ["Ship calibration groups", Object.keys(shipPlanner.calibration || {}).length]
      ]
    },
    {
      title: "Experimental support-surface helpers",
      note: "Non-MVP experimental or prototype helpers that stay outside canonical shared truth and outside canonical-system implementation state. Loose planning and flat helper aliases are retired.",
      items: [
        ["Gem-node budget", experimental.gemNodeBudget],
        ["Primary farming focus", experimental.primaryFarmingFocus],
        ["Research hours", experimental.researchHours]
      ]
    },
    {
      title: "Compatibility leftovers",
      note: "Preserved migration values and quarantined unmapped system blobs that are not treated as active shared truth. Loose top-level compatibility aliases are retired in favor of explicit compatibility or namespaced legacy paths.",
      items: [
        ["Legacy highest ship unlocked", compatibility.legacyStage.highestShipUnlocked],
        ["Legacy manual phase", compatibility.legacyStage.manualPhase],
        ["Legacy gemDust", compatibility.unresolved.gemDust],
        ["Legacy hunter level", compatibility.unresolved.hunterLevel],
        ["Legacy trait sphere count", compatibility.unresolved.traitSphereCount],
        ["Legacy mech parts", compatibility.unresolved.mechParts],
        ["Unmapped shard milestone state", compatibility.unmappedSystems.shardMilestones],
        ["Unmapped TokenShop state", compatibility.unmappedSystems.tokenShop],
        ["Unmapped MultiverseMarket state", compatibility.unmappedSystems.multiverseMarket]
      ]
    }
  ];
}

export function getPlayerProfileBoundaryAudit(groups, context, isBoundaryValuePresent) {
  const counts = groups.map((group) => {
    const populated = group.items.filter(([, value]) => isBoundaryValuePresent(value)).length;
    return `${group.title}: ${populated}/${group.items.length}`;
  });
  const unmappedSystemEntries = Object.entries(context.compatibility.unmappedSystems || {})
    .filter(([, value]) => isBoundaryValuePresent(value))
    .map(([key]) => key);
  const unresolvedEntries = Object.entries(context.compatibility.unresolved || {})
    .filter(([, value]) => isBoundaryValuePresent(value))
    .map(([key]) => key);
  const notes = [];

  if (unmappedSystemEntries.length) {
    notes.push(
      `Quarantined unmapped system blobs preserved: ${unmappedSystemEntries.join(", ")}. Keep these descriptive until owner mapping and player-owned inputs are grounded.`
    );
  } else {
    notes.push("No quarantined unmapped system blobs are present in this import.");
  }

  if (
    Object.values(context.shipPlanner.summary || {}).some((value) => isBoundaryValuePresent(value))
  ) {
    notes.push(
      "Ship planner values are preserved as external-model implementation state, not as canonical shared profile truth."
    );
  }

  if (unresolvedEntries.length) {
    notes.push(
      `Compatibility-only leftovers preserved: ${unresolvedEntries.join(", ")}. These remain migration sinks, not active recommendation inputs.`
    );
  } else {
    notes.push("No compatibility-only leftover fields were populated by this import.");
  }

  return { counts, notes };
}

export function getProfileCompletion(profile, activeProfileFormFieldPaths) {
  const filled = Object.values(activeProfileFormFieldPaths).filter(
    (path) => String(path.reduce((current, key) => current?.[key], profile) ?? "").trim() !== ""
  ).length;
  const fields = Object.keys(activeProfileFormFieldPaths);
  return Math.round((filled / fields.length) * 100);
}

export function getPlannerHelperCompletion(
  profile,
  plannerPaths = [["planning", "shards", "totalMilestoneLevels"]]
) {
  const filled = plannerPaths.filter(
    (path) => String(path.reduce((current, key) => current?.[key], profile) ?? "").trim() !== ""
  ).length;
  return Math.round((filled / plannerPaths.length) * 100);
}

export function getImportedMultiverseMarketPreviewCardModel(preview, formatShardNumber) {
  if (!preview?.hasImportedCompatibilityPreview) {
    return {
      hasPreview: false
    };
  }

  return {
    hasPreview: true,
    pillLabels: [
      `${preview.importedSpanRowCount}/${preview.totalSpanRowCount} raw IS rows imported`,
      `${preview.importedTradeCounterCount}/${preview.totalTradeCounterCount} trade counters imported`,
      `${preview.importedEarlyMechCount}/${preview.totalEarlyMechCount} early-mech fields imported`,
      preview.hasOverlapGroundedRows
        ? `${preview.importedOverlapRowCount}/${preview.overlapRowCount} ordered-overlap rows imported`
        : null,
      "Compatibility only",
      "Planner blocked"
    ].filter(Boolean),
    metaLines: [
      "Only compatibility-only evidence from the checked SaveData quarantine is shown here. This card does not reopen row-label recovery, row remap, planner logic, or canonical PlayerProfile promotion.",
      {
        code: preview.wrapperOnlyFieldLabel,
        suffix:
          " stays wrapper-only and is intentionally excluded from this preview even when it exists in the imported compatibility blob."
      },
      {
        text: `The grounded Emporium text model is split: `,
        codePairs: [
          [preview.supportedTextModel.effectLabelLane, " is the recovered effect-label lane"],
          [preview.supportedTextModel.baseBonusLane, " is the recovered base-bonus lane"],
          [preview.supportedTextModel.idLane, " is the recovered id lane"]
        ]
      },
      {
        code: preview.supportedTextModel.quarantinedCurrentValueLane,
        suffix:
          " remains a distinct unrecovered runtime-only display lane. It is explicitly quarantined from the preview and is not treated as grounded Emporium truth, planner input, or canonical player state."
      },
      {
        text: `App-side Emporium row summaries now normalize only the grounded lanes into `,
        code: preview.rowSummaryShape.shapeId,
        suffix: `: ${preview.rowSummaryShape.groundedFields
          .map((field) => `${field.key} from ${field.slotAlias}`)
          .join(", ")}. ${preview.rowSummaryShape.quarantinedFields
          .map((field) => `${field.key} stays quarantined as ${field.slotAlias}`)
          .join(", ")}.`
      },
      preview.importedRangeLabel
        ? `Imported raw Emporium levels currently cover ${preview.firstImportedRowLabel} through ${preview.lastImportedRowLabel} across rows ${preview.importedRangeLabel}.`
        : "No raw Emporium level fields are currently imported from the checked compatibility span.",
      preview.missingSpanCount
        ? `Missing raw span fields still absent from this import: ${preview.missingSpanLabel}${preview.missingSpanCount > 12 ? "..." : ""}.`
        : "All raw fields in the checked IS1Level through IS110Level compatibility span are present in this import.",
      preview.hasTradeCounterPreview
        ? `Imported trade-counter quarantine currently covers ${preview.tradeCounterLabel} with ${preview.importedTradeCounterCount} recovered fields.`
        : "No adjacent trade-counter quarantine fields are currently imported from the checked compatibility envelope.",
      preview.missingTradeCounterKeys.length
        ? `Missing trade-counter quarantine fields: ${preview.missingTradeCounterLabel}${preview.missingTradeCounterKeys.length > 12 ? "..." : ""}.`
        : "All checked Esoteric and Necrum trade-counter quarantine fields are present in this import.",
      preview.hasEarlyMechPreview
        ? `Imported early-mech quarantine currently covers ${preview.earlyMechWindowLabel} with ${preview.importedEarlyMechCount} recovered fields.`
        : "No early-mech quarantine fields are currently imported from the checked compatibility envelope.",
      preview.missingEarlyMechFields.length
        ? `Missing early-mech quarantine fields: ${preview.missingEarlyMechLabel}.`
        : "All checked early-mech quarantine fields are present in this import.",
      preview.hasOverlapGroundedRows
        ? `The checked ordered-overlap support rows ${preview.overlapRangeLabel} are tracked only as boundary evidence. Missing ordered-overlap imports: ${preview.missingOverlapLabel}.`
        : "No ordered-overlap support rows are available in this build.",
      "Planner use stays blocked. These imported levels, trade counters, and early-mech fields remain quarantined compatibility evidence, not canonical player truth, not row-label claims, not complete live-text bindings, and not recommendation inputs."
    ],
    overlapCards: preview.hasOverlapLevelPreview
      ? preview.overlapRowSummaries.map((entry) => ({
          title: `IS${entry.rowId}Level overlap support`,
          level: formatShardNumber(entry.level),
          fieldPath: entry.fieldPath,
          shapeId: entry.shapeId,
          groundedFields: entry.groundedFields.map((field) => ({
            key: field.key,
            slotAlias: field.slotAlias,
            sourceLane: field.sourceLane,
            status: field.status
          })),
          quarantinedFields: entry.quarantinedFields.map((field) => ({
            key: field.key,
            slotAlias: field.slotAlias,
            status: field.status,
            reason: field.reason
          }))
        }))
      : [],
    previewRows: preview.previewRows.map((entry) => ({
      rowId: entry.rowId,
      level: formatShardNumber(entry.level),
      fieldPath: entry.fieldPath
    })),
    trailingPreviewLine:
      preview.trailingPreviewRows.length && preview.importedSpanRowCount > preview.previewRows.length
        ? `Trailing imported raw rows: ${preview.trailingPreviewRows
            .map((entry) => `IS${entry.rowId}Level ${formatShardNumber(entry.level)}`)
            .join(" | ")}`
        : "",
    importedTradeCounters: preview.importedTradeCounters.slice(0, 8),
    importedEarlyMechFields: preview.importedEarlyMechFields.slice(0, 8)
  };
}
