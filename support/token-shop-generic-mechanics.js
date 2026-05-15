import { TOKEN_SHOP_SCOPE_BY_FIELD } from "./token-shop-scope-map.js";

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function uniqueStrings(values) {
  const seen = new Set();
  return normalizeArray(values).filter((value) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) {
      return false;
    }
    seen.add(text);
    return true;
  });
}

function buildRowDetailFromGenericScope(scopePayload, fieldName) {
  const scope = scopePayload && typeof scopePayload === "object" ? scopePayload : {};
  const subjectEntity = normalizeArray(scope.entities).find(
    (entity) => String(entity?.entityKind || "").trim() !== "row-field"
  );
  const subjectKind = String(subjectEntity?.entityKind || "").trim() || null;
  const subjectId =
    String(subjectEntity?.payload?.subjectId || "").trim() ||
    String(subjectEntity?.entityId || "").trim();
  const rowEntityId = subjectId ? `${subjectId}#${fieldName}` : "";
  if (!rowEntityId) {
    return null;
  }

  const rowFacts = normalizeArray(scope.facts).filter(
    (fact) =>
      String(fact?.entityId || "").trim() === rowEntityId ||
      String(fact?.fieldKey || "").trim() === fieldName
  );
  const rowGaps = normalizeArray(scope.gaps).filter(
    (gap) =>
      String(gap?.entityId || "").trim() === rowEntityId ||
      String(gap?.fieldKey || "").trim() === fieldName
  );
  if (!rowFacts.length && !rowGaps.length) {
    return null;
  }

  const valuesByKind = new Map();
  rowFacts.forEach((fact) => {
    const kind = String(fact?.factKind || "").trim();
    const value = String(fact?.factValue || "").trim();
    if (!kind || !value) {
      return;
    }
    if (!valuesByKind.has(kind)) {
      valuesByKind.set(kind, []);
    }
    valuesByKind.get(kind).push(value);
  });

  const blockedFields = {};
  let isGrounded = null;
  rowGaps.forEach((gap) => {
    const gapKind = String(gap?.gapKind || "").trim();
    const payload = gap?.payload && typeof gap.payload === "object" ? gap.payload : {};
    const reason = String(payload.reason || "").trim();
    const normalizedGapKind = gapKind === "row-detail" ? "rowDetail" : gapKind;
    if (normalizedGapKind && reason) {
      blockedFields[normalizedGapKind] = reason;
    }
    if (typeof payload.isGrounded === "boolean") {
      isGrounded = payload.isGrounded;
    }
  });

  const rowDetail = {
    isGrounded:
      typeof isGrounded === "boolean"
        ? isGrounded
        : Boolean(
            String(valuesByKind.get("identity")?.[0] || "").trim() &&
            String(valuesByKind.get("row-type-label")?.[0] || "").trim()
          ),
    subjectId: subjectId || null,
    subjectKind,
    identity: valuesByKind.get("identity")?.[0] || null,
    identitySource: valuesByKind.get("identity-source")?.[0] || null,
    rowType: valuesByKind.get("row-type")?.[0] || null,
    rowTypeLabel: valuesByKind.get("row-type-label")?.[0] || null,
    detailNote: valuesByKind.get("detail-note")?.[0] || null,
    blockedFields
  };
  const boundedEvidenceTerms = uniqueStrings(valuesByKind.get("bounded-evidence-term") || []);
  if (boundedEvidenceTerms.length) {
    rowDetail.boundedEvidenceTerms = boundedEvidenceTerms;
  }
  const runtimeCostCoverageFact = rowFacts.find(
    (fact) =>
      String(fact?.factKind || "").trim() === "runtime-cost-coverage" &&
      String(fact?.factValue || "").trim()
  );
  if (runtimeCostCoverageFact) {
    const payload =
      runtimeCostCoverageFact.payload && typeof runtimeCostCoverageFact.payload === "object"
        ? runtimeCostCoverageFact.payload
        : {};
    rowDetail.runtimeCostCoverage = {
      status: String(runtimeCostCoverageFact.factValue || "").trim(),
      evidenceSource: String(payload.evidenceSource || "").trim() || null,
      shellField: String(payload.shellField || "").trim() || null,
      ownerFieldStem: String(payload.ownerFieldStem || "").trim() || null,
      ownerFieldBlock: uniqueStrings(payload.ownerFieldBlock || []),
      updaterTerms: uniqueStrings(payload.updaterTerms || []),
      isClosed: true
    };
    delete rowDetail.blockedFields["runtime-cost-coverage"];
  }
  return rowDetail;
}

function normalizeGenericScopesPayload(payload) {
  if (payload?.scopes && typeof payload.scopes === "object") {
    return payload.scopes;
  }
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }
  return {};
}

function getSubjectEntity(scopePayload) {
  return normalizeArray(scopePayload?.entities).find(
    (entity) => String(entity?.entityKind || "").trim() !== "row-field"
  );
}

function getScopeEntries(payload) {
  return Object.entries(normalizeGenericScopesPayload(payload)).filter(
    ([, scopePayload]) => scopePayload
  );
}

function getEntityLabel(entity) {
  const payload = entity?.payload && typeof entity.payload === "object" ? entity.payload : {};
  return (
    String(payload.subjectId || "").trim() ||
    String(payload.label || "").trim() ||
    String(entity?.entityId || "").trim()
  );
}

function getScopeFacts(scopePayload) {
  return normalizeArray(scopePayload?.facts);
}

function getScopeGaps(scopePayload) {
  return normalizeArray(scopePayload?.gaps);
}

function getFactValues(scopePayload, factKind) {
  return getScopeFacts(scopePayload)
    .filter((fact) => String(fact?.factKind || "").trim() === factKind)
    .map((fact) => String(fact?.factValue || "").trim())
    .filter(Boolean);
}

function getGapPayloads(scopePayload, gapKind) {
  return getScopeGaps(scopePayload)
    .filter((gap) => String(gap?.gapKind || "").trim() === gapKind)
    .map((gap) => (gap?.payload && typeof gap.payload === "object" ? gap.payload : {}));
}

function getEdgeKinds(scopePayload, gapKind) {
  return getScopeGaps(scopePayload)
    .filter((gap) => String(gap?.gapKind || "").trim() === gapKind)
    .map((gap) => String(gap?.payload?.edgeType || "").trim())
    .filter(Boolean);
}

function getMissingEdgeKinds(scopePayload) {
  return getEdgeKinds(scopePayload, "missing-edge");
}

function getNextSeamPayload(scopePayload) {
  return (
    getScopeGaps(scopePayload).find((gap) => String(gap?.gapKind || "").trim() === "next-seam")
      ?.payload ?? null
  );
}

function getFirstFactValue(scopePayload, factKind) {
  return getFactValues(scopePayload, factKind)[0] || null;
}

function getScopeByEntityKind(scopeEntries, entityKind, predicate = null) {
  return (
    scopeEntries.find(([, scopePayload]) => {
      const entity = getSubjectEntity(scopePayload);
      if (String(entity?.entityKind || "").trim() !== entityKind) {
        return false;
      }
      return typeof predicate === "function" ? predicate(scopePayload, entity) : true;
    }) ?? null
  );
}

function getFirstLaneBlockedReason(scopePayload, laneId = "") {
  const normalizedLaneId = String(laneId || "").trim();
  const lanePayload = getGapPayloads(scopePayload, "blocked-lane").find((payload) => {
    if (!normalizedLaneId) {
      return true;
    }
    return String(payload?.laneId || "").trim() === normalizedLaneId;
  });
  return String(lanePayload?.reason || "").trim() || null;
}

export function getTokenShopGenericCoverageSummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  if (!scopeEntries.length) {
    return {
      hasCoverage: false,
      coverageSource: null,
      numericGroupCount: 0,
      hasNamedLanes: false,
      namedLaneLabel: "",
      tierLabel: "",
      hasControllerAnchors: false,
      subjectCount: 0,
      rowLocalCount: 0,
      rangeFamilyCount: 0,
      blockedCount: 0,
      subjectLabels: [],
      genericScopeCount: 0,
      unresolvedRowFieldCount: 0
    };
  }

  const subjectEntities = scopeEntries
    .map(([, scopePayload]) => getSubjectEntity(scopePayload))
    .filter(Boolean);
  const rowLocalCount = subjectEntities.filter(
    (entity) => String(entity?.entityKind || "").trim() === "row-local"
  ).length;
  const rangeFamilyCount = subjectEntities.filter(
    (entity) => String(entity?.entityKind || "").trim() === "range-family"
  ).length;
  const subjectLabels = subjectEntities
    .map((entity) => {
      const payloadObject =
        entity?.payload && typeof entity.payload === "object" ? entity.payload : {};
      return (
        String(payloadObject.subjectId || "").trim() ||
        String(entity?.entityId || "").trim() ||
        String(payloadObject.label || "").trim()
      );
    })
    .filter(Boolean);
  const blockedCount = scopeEntries.filter(([, scopePayload]) =>
    normalizeArray(scopePayload?.gaps).some(
      (gap) => String(gap?.gapKind || "").trim() === "missing-edge"
    )
  ).length;
  const unresolvedRowFieldCount = scopeEntries.reduce((count, [, scopePayload]) => {
    const rowDetailGaps = normalizeArray(scopePayload?.gaps).filter(
      (gap) =>
        String(gap?.gapKind || "").trim() === "rowDetail" &&
        gap?.payload &&
        typeof gap.payload === "object" &&
        gap.payload.isGrounded === false
    );
    return count + rowDetailGaps.length;
  }, 0);
  const hasControllerAnchors = scopeEntries.some(([, scopePayload]) =>
    normalizeArray(scopePayload?.facts).some((fact) => {
      const kind = String(fact?.factKind || "").trim();
      return kind === "action-method" || kind === "display-update-hook";
    })
  );

  return {
    hasCoverage: true,
    coverageSource: "generic-mechanics",
    numericGroupCount: scopeEntries.length,
    hasNamedLanes: rowLocalCount > 0 && rangeFamilyCount > 0,
    namedLaneLabel: subjectLabels.slice(0, 4).join(", "),
    tierLabel: `${rowLocalCount} row-local and ${rangeFamilyCount} range-family generic subjects`,
    hasControllerAnchors,
    subjectCount: subjectEntities.length,
    rowLocalCount,
    rangeFamilyCount,
    blockedCount,
    subjectLabels,
    genericScopeCount: scopeEntries.length,
    unresolvedRowFieldCount
  };
}

export function getTokenShopGenericCostLaneSummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  const rowLocalEntry = getScopeByEntityKind(
    scopeEntries,
    "row-local",
    (scopePayload) => getFactValues(scopePayload, "display-update-hook").length > 0
  );
  const rangeFamilyEntry = getScopeByEntityKind(scopeEntries, "range-family", (scopePayload) => {
    const missingEdges = getMissingEdgeKinds(scopePayload);
    const nextSeam = getNextSeamPayload(scopePayload);
    return (
      missingEdges.includes("exact-display-update-path") ||
      String(nextSeam?.seamId || "").trim() === "exact-display-update-path"
    );
  });

  if (!rowLocalEntry && !rangeFamilyEntry) {
    return null;
  }

  const [, rowLocalScope] = rowLocalEntry ?? [null, null];
  const [, rangeFamilyScope] = rangeFamilyEntry ?? [null, null];
  const rowLocalEntity = rowLocalScope ? getSubjectEntity(rowLocalScope) : null;
  const rangeFamilyEntity = rangeFamilyScope ? getSubjectEntity(rangeFamilyScope) : null;
  const displayHooks = rowLocalScope ? getFactValues(rowLocalScope, "display-update-hook") : [];
  const rowLocalMissingEdges = rowLocalScope ? getMissingEdgeKinds(rowLocalScope) : [];
  const rangeFamilyMissingEdges = rangeFamilyScope ? getMissingEdgeKinds(rangeFamilyScope) : [];
  const rangeFamilyNextSeam = rangeFamilyScope ? getNextSeamPayload(rangeFamilyScope) : null;

  return {
    hasLaneSplit: Boolean(rowLocalEntity) && Boolean(rangeFamilyEntity),
    coverageSource: "generic-mechanics",
    keepsDailyTokeniumSeparate: Boolean(rangeFamilyEntity),
    tokenLaneLabel: rowLocalEntity ? getEntityLabel(rowLocalEntity) : "row-local display subject",
    diamondLaneLabel: rowLocalEntity?.entityKind || "row-local",
    dailyLaneLabel: rangeFamilyEntity
      ? getEntityLabel(rangeFamilyEntity)
      : "range-family display subject",
    costShellLabel: displayHooks[0] || "display-hook-unavailable",
    costRenderLabel:
      rangeFamilyMissingEdges[0] ||
      String(rangeFamilyNextSeam?.seamId || "").trim() ||
      "support-surface-unavailable",
    descriptionRenderLabel:
      String(rangeFamilyNextSeam?.seamId || "").trim() || "next-seam-unavailable",
    rowLocalSubjectId: rowLocalEntity ? getEntityLabel(rowLocalEntity) : null,
    rangeFamilySubjectId: rangeFamilyEntity ? getEntityLabel(rangeFamilyEntity) : null,
    rowLocalSubjectKind: rowLocalEntity?.entityKind || null,
    rangeFamilySubjectKind: rangeFamilyEntity?.entityKind || null,
    rowLocalBlockedEdges: rowLocalMissingEdges,
    rangeFamilyKnownEdges: rangeFamilyMissingEdges,
    blockedInputReason:
      (rowLocalScope ? getFirstLaneBlockedReason(rowLocalScope) : null) ||
      (rangeFamilyScope ? getFirstLaneBlockedReason(rangeFamilyScope) : null) ||
      null
  };
}

export function getTokenShopGenericActionLaneSummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  const rowLocalEntry = getScopeByEntityKind(
    scopeEntries,
    "row-local",
    (scopePayload) => getFactValues(scopePayload, "action-method").length > 0
  );
  const rangeFamilyEntry = getScopeByEntityKind(scopeEntries, "range-family", (scopePayload) => {
    const missingEdges = getMissingEdgeKinds(scopePayload);
    const nonblockingEdges = getEdgeKinds(scopePayload, "nonblocking-edge");
    const nextSeam = getNextSeamPayload(scopePayload);
    return (
      missingEdges.includes("exact-shell-to-action-hook") ||
      nonblockingEdges.includes("exact-shell-to-action-hook") ||
      String(nextSeam?.seamId || "").trim() === "exact-shell-to-action-hook"
    );
  });

  if (!rowLocalEntry && !rangeFamilyEntry) {
    return null;
  }

  const [, rowLocalScope] = rowLocalEntry ?? [null, null];
  const [, rangeFamilyScope] = rangeFamilyEntry ?? [null, null];
  const rowLocalEntity = rowLocalScope ? getSubjectEntity(rowLocalScope) : null;
  const rangeFamilyEntity = rangeFamilyScope ? getSubjectEntity(rangeFamilyScope) : null;
  const actionMethods = rowLocalScope ? getFactValues(rowLocalScope, "action-method") : [];
  const nonblockingEdges = rangeFamilyScope
    ? getEdgeKinds(rangeFamilyScope, "nonblocking-edge")
    : [];
  const nextSeam = rangeFamilyScope ? getNextSeamPayload(rangeFamilyScope) : null;
  const purchaseHook =
    (rowLocalScope && getFirstFactValue(rowLocalScope, "daily-tokenium-lane-purchase-hook")) ||
    (rangeFamilyScope &&
      getFirstFactValue(rangeFamilyScope, "daily-tokenium-lane-purchase-hook")) ||
    null;
  const purchaseOwner =
    (rowLocalScope && getFirstFactValue(rowLocalScope, "daily-tokenium-lane-purchase-owner")) ||
    (rangeFamilyScope &&
      getFirstFactValue(rangeFamilyScope, "daily-tokenium-lane-purchase-owner")) ||
    null;

  return {
    hasActionSplit: Boolean(rowLocalEntity) && Boolean(rangeFamilyEntity),
    coverageSource: "generic-mechanics",
    keepsDailyDirectHooksUnrecovered: nonblockingEdges.includes("exact-shell-to-action-hook"),
    tokenHook: rowLocalEntity ? getEntityLabel(rowLocalEntity) : "row-local action subject",
    diamondHook: rowLocalEntity?.entityKind || "row-local",
    loopModifierHook: actionMethods[0] || purchaseHook || "action-hook-unavailable",
    premiumModifierHook:
      purchaseOwner ||
      (rangeFamilyEntity ? getEntityLabel(rangeFamilyEntity) : "range-family action subject"),
    dailyHookT2: purchaseHook || nonblockingEdges[0] || "nonblocking-edge-unavailable",
    dailyHookT3: String(nextSeam?.seamId || "").trim() || "next-seam-unavailable",
    rowLocalSubjectId: rowLocalEntity ? getEntityLabel(rowLocalEntity) : null,
    rangeFamilySubjectId: rangeFamilyEntity ? getEntityLabel(rangeFamilyEntity) : null,
    rowLocalSubjectKind: rowLocalEntity?.entityKind || null,
    rangeFamilySubjectKind: rangeFamilyEntity?.entityKind || null,
    rowLocalKnownEdges: rowLocalScope ? getMissingEdgeKinds(rowLocalScope) : [],
    rangeFamilyKnownEdges: rangeFamilyScope ? getMissingEdgeKinds(rangeFamilyScope) : [],
    rangeFamilyNonblockingEdges: nonblockingEdges,
    blockedInputReason:
      (rowLocalScope ? getFirstLaneBlockedReason(rowLocalScope, "dailyTokeniumLane") : null) ||
      (rangeFamilyScope
        ? getFirstLaneBlockedReason(rangeFamilyScope, "dailyTokeniumLane")
        : null) ||
      null
  };
}

export function getTokenShopGenericOwnerShellSummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  const rowLocalEntry = getScopeByEntityKind(scopeEntries, "row-local", (scopePayload) => {
    return (
      getFactValues(scopePayload, "action-method").length > 0 ||
      getFactValues(scopePayload, "token-bank-controller-claim-method").length > 0
    );
  });
  const rangeFamilyEntry = getScopeByEntityKind(scopeEntries, "range-family");
  const [, rowLocalScope] = rowLocalEntry ?? [null, null];
  const [, rangeFamilyScope] = rangeFamilyEntry ?? [null, null];
  const rowLocalEntity = rowLocalScope ? getSubjectEntity(rowLocalScope) : null;
  const rangeFamilyEntity = rangeFamilyScope ? getSubjectEntity(rangeFamilyScope) : null;
  const bankMethod =
    (rowLocalScope && getFirstFactValue(rowLocalScope, "token-bank-controller-claim-method")) ||
    (rowLocalScope && getFirstFactValue(rowLocalScope, "action-method")) ||
    null;
  const notificationHook =
    (rowLocalScope &&
      getFirstFactValue(rowLocalScope, "token-bank-controller-notification-hook")) ||
    (rowLocalScope && String(getNextSeamPayload(rowLocalScope)?.seamId || "").trim()) ||
    null;
  const deviceHook =
    (rowLocalScope && getFirstFactValue(rowLocalScope, "daily-tokenium-lane-purchase-owner")) ||
    (rangeFamilyScope &&
      getFirstFactValue(rangeFamilyScope, "daily-tokenium-lane-purchase-owner")) ||
    null;

  if (!rowLocalEntity && !bankMethod && !notificationHook && !deviceHook) {
    return null;
  }

  return {
    hasOwnerShell: Boolean(rowLocalEntity) && Boolean(bankMethod),
    coverageSource: "generic-mechanics",
    ownerAnchor: rowLocalEntity ? getEntityLabel(rowLocalEntity) : "row-local subject",
    bankMethod: bankMethod || "action-method-unavailable",
    notificationHook: notificationHook || "notification-hook-unavailable",
    deviceHook:
      deviceHook ||
      (rangeFamilyEntity ? getEntityLabel(rangeFamilyEntity) : "device-hook-unavailable"),
    rowLocalSubjectId: rowLocalEntity ? getEntityLabel(rowLocalEntity) : null,
    rangeFamilySubjectId: rangeFamilyEntity ? getEntityLabel(rangeFamilyEntity) : null,
    rowLocalSubjectKind: rowLocalEntity?.entityKind || null,
    rangeFamilySubjectKind: rangeFamilyEntity?.entityKind || null,
    rowLocalKnownEdges: rowLocalScope ? getMissingEdgeKinds(rowLocalScope) : [],
    rangeKnownEdges: rangeFamilyScope ? getMissingEdgeKinds(rangeFamilyScope) : [],
    rangeBlockedEdges: rangeFamilyScope ? getEdgeKinds(rangeFamilyScope, "blocked-edge") : [],
    blockedInputReason:
      (rowLocalScope ? getFirstLaneBlockedReason(rowLocalScope, "tokenBankController") : null) ||
      (rangeFamilyScope
        ? getFirstLaneBlockedReason(rangeFamilyScope, "tokenBankController")
        : null) ||
      null
  };
}

export function getTokenShopGenericSaveBoundarySummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  const rowLocalEntry = getScopeByEntityKind(scopeEntries, "row-local", (scopePayload) => {
    return (
      getFactValues(scopePayload, "token-bank-state-cloud-save-shell").length > 0 ||
      getFactValues(scopePayload, "token-bank-state-cloud-save-info-routine").length > 0 ||
      getFactValues(scopePayload, "token-bank-state-cloud-save-profile-routine").length > 0 ||
      getFactValues(scopePayload, "token-bank-state-cloud-save-state-machine").length > 0
    );
  });
  const rangeFamilyEntry = getScopeByEntityKind(scopeEntries, "range-family");
  const [, rowLocalScope] = rowLocalEntry ?? [null, null];
  const [, rangeFamilyScope] = rangeFamilyEntry ?? [null, null];
  const rowLocalEntity = rowLocalScope ? getSubjectEntity(rowLocalScope) : null;
  const rangeFamilyEntity = rangeFamilyScope ? getSubjectEntity(rangeFamilyScope) : null;
  const saveAnchor =
    (rowLocalScope && getFirstFactValue(rowLocalScope, "token-bank-state-cloud-save-shell")) ||
    (rowLocalScope &&
      getFirstFactValue(rowLocalScope, "token-bank-state-cloud-save-info-routine")) ||
    (rowLocalScope &&
      getFirstFactValue(rowLocalScope, "token-bank-state-cloud-save-profile-routine")) ||
    (rowLocalScope &&
      getFirstFactValue(rowLocalScope, "token-bank-state-cloud-save-state-machine")) ||
    null;

  if (!rowLocalEntity && !saveAnchor) {
    return null;
  }

  return {
    hasSeparationBoundary: Boolean(rowLocalEntity) && Boolean(saveAnchor),
    coverageSource: "generic-mechanics",
    ownerAnchor: rowLocalEntity ? getEntityLabel(rowLocalEntity) : "row-local subject",
    saveAnchor: saveAnchor || "save-anchor-unavailable",
    overlapLabel: "generic token-bank state/save separation",
    rowLocalSubjectId: rowLocalEntity ? getEntityLabel(rowLocalEntity) : null,
    rangeFamilySubjectId: rangeFamilyEntity ? getEntityLabel(rangeFamilyEntity) : null,
    rowLocalSubjectKind: rowLocalEntity?.entityKind || null,
    rangeFamilySubjectKind: rangeFamilyEntity?.entityKind || null,
    rowLocalBlockedEdges: rowLocalScope ? getEdgeKinds(rowLocalScope, "blocked-edge") : [],
    rangeFamilyBlockedEdges: rangeFamilyScope ? getEdgeKinds(rangeFamilyScope, "blocked-edge") : [],
    blockedInputReason:
      (rowLocalScope ? getFirstLaneBlockedReason(rowLocalScope, "tokenBankState") : null) ||
      (rangeFamilyScope ? getFirstLaneBlockedReason(rangeFamilyScope, "tokenBankState") : null) ||
      null
  };
}

export function getTokenShopGenericTokeniumNamingSummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  const namingEntry =
    scopeEntries.find(([, scopePayload]) => {
      return (
        getFactValues(scopePayload, "tokenium-naming-resource-label").length > 0 ||
        getFactValues(scopePayload, "tokenium-naming-academy-label").length > 0
      );
    }) ?? null;
  if (!namingEntry) {
    return null;
  }
  const [, scopePayload] = namingEntry;
  const entity = getSubjectEntity(scopePayload);
  return {
    hasNamingClues: true,
    coverageSource: "generic-mechanics",
    resourceLabel:
      getFirstFactValue(scopePayload, "tokenium-naming-resource-label") || "Resource_Tokenium",
    academyLabel:
      getFirstFactValue(scopePayload, "tokenium-naming-academy-label") || "Aca.Tokenium553",
    tokenShellLabel:
      getFirstFactValue(scopePayload, "tokenium-naming-token-shell-label") || "CostBox-Tokens",
    tokeniumShellLabel:
      getFirstFactValue(scopePayload, "tokenium-naming-tokenium-shell-label") || "CostBox-Tokenium",
    rowLocalSubjectId: entity ? getEntityLabel(entity) : null,
    rangeFamilySubjectId: null,
    rowLocalSubjectKind: entity?.entityKind || null,
    rangeFamilySubjectKind: null,
    blockedInputReason: getFirstLaneBlockedReason(scopePayload, "tokeniumNaming")
  };
}

export function getTokenShopGenericTokenBankStateSummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  const stateEntry =
    scopeEntries.find(([, scopePayload]) => {
      return (
        getFactValues(scopePayload, "token-bank-state-claim-method").length > 0 ||
        getFactValues(scopePayload, "token-bank-state-cloud-save-shell").length > 0
      );
    }) ?? null;
  if (!stateEntry) {
    return null;
  }
  const [, scopePayload] = stateEntry;
  const entity = getSubjectEntity(scopePayload);
  const claimMethod = getFirstFactValue(scopePayload, "token-bank-state-claim-method");
  const capMethod = getFirstFactValue(scopePayload, "token-bank-state-cap-method");
  const displayShell = getFirstFactValue(scopePayload, "token-bank-state-display-shell");
  const loopHandler = getFirstFactValue(scopePayload, "token-bank-state-loop-handler");
  const loopHook = getFirstFactValue(scopePayload, "token-bank-state-loop-hook");
  const exactSaveOwnerType = getFirstFactValue(
    scopePayload,
    "token-bank-state-exact-save-owner-type"
  );
  const storedAmountField = getFirstFactValue(scopePayload, "token-bank-state-stored-amount-field");
  const genericClaimableFieldOwner = getFirstFactValue(
    scopePayload,
    "token-bank-state-generic-claimable-field-owner"
  );
  const genericClaimableField = getFirstFactValue(
    scopePayload,
    "token-bank-state-generic-claimable-field"
  );
  const profileBridgeOwner = getFirstFactValue(
    scopePayload,
    "token-bank-state-profile-bridge-owner"
  );
  const profileBridgeMethod = getFirstFactValue(
    scopePayload,
    "token-bank-state-profile-bridge-method"
  );
  const profileBridgeReturnType = getFirstFactValue(
    scopePayload,
    "token-bank-state-profile-bridge-return-type"
  );
  const profileCacheField = getFirstFactValue(scopePayload, "token-bank-state-profile-cache-field");
  const cloudSaveShell = getFirstFactValue(scopePayload, "token-bank-state-cloud-save-shell");
  const cloudSaveInfoRoutine = getFirstFactValue(
    scopePayload,
    "token-bank-state-cloud-save-info-routine"
  );
  const cloudSaveProfileRoutine = getFirstFactValue(
    scopePayload,
    "token-bank-state-cloud-save-profile-routine"
  );
  const cloudSaveStateMachine = getFirstFactValue(
    scopePayload,
    "token-bank-state-cloud-save-state-machine"
  );

  return {
    hasControllerSplit: Boolean(claimMethod) && Boolean(capMethod),
    hasExactStoredAmountOwner: Boolean(exactSaveOwnerType) && Boolean(storedAmountField),
    hasGenericClaimableBoundary:
      Boolean(genericClaimableFieldOwner) && Boolean(genericClaimableField),
    hasPlayerProfileBridgeBoundary:
      Boolean(profileBridgeOwner) &&
      Boolean(profileBridgeMethod) &&
      Boolean(profileBridgeReturnType) &&
      Boolean(profileCacheField),
    hasCloudSaveShellBoundary:
      Boolean(cloudSaveShell) &&
      Boolean(cloudSaveInfoRoutine) &&
      Boolean(cloudSaveProfileRoutine) &&
      Boolean(cloudSaveStateMachine),
    coverageSource: "generic-mechanics",
    claimMethod: claimMethod || "ClaimBankedTokens",
    capMethod: capMethod || "get_TokenBankCap",
    displayShell: displayShell || "BigStatisticPrefab.TokenBankCap",
    loopHandler: loopHandler || "TextHandlerLoopMods",
    loopHook: loopHook || "SetLM244BonusText",
    exactSaveOwnerType: exactSaveOwnerType || "SaveData",
    storedAmountField: storedAmountField || "BankedTokens",
    exactSaveOwnerLabel: `${exactSaveOwnerType || "SaveData"}.${storedAmountField || "BankedTokens"}`,
    genericClaimableFieldOwner: genericClaimableFieldOwner || "SaveData",
    genericClaimableField: genericClaimableField || "ClaimableTokenium",
    genericClaimableLabel: `${genericClaimableFieldOwner || "SaveData"}.${genericClaimableField || "ClaimableTokenium"}`,
    profileBridgeOwner: profileBridgeOwner || "PlayerProfileHandler",
    profileBridgeMethod: profileBridgeMethod || "ConvertSaveDataToProfileData",
    profileBridgeReturnType: profileBridgeReturnType || "PlayerProfileData",
    profileCacheField: profileCacheField || "saveInfoCache",
    profileBridgeLabel: `${profileBridgeOwner || "PlayerProfileHandler"}.${profileCacheField || "saveInfoCache"} + ${profileBridgeMethod || "ConvertSaveDataToProfileData"}(...) -> ${profileBridgeReturnType || "PlayerProfileData"}`,
    cloudSaveShell: cloudSaveShell || "CloudSavePlayerProfile",
    cloudSaveInfoRoutine: cloudSaveInfoRoutine || "GetCurrentSaveFileInfo",
    cloudSaveProfileRoutine: cloudSaveProfileRoutine || "GetPlayerProfileInfo",
    cloudSaveStateMachine: cloudSaveStateMachine || "<CloudSavePlayerProfile>d__24",
    rowLocalSubjectId: entity ? getEntityLabel(entity) : null,
    rangeFamilySubjectId: null,
    rowLocalSubjectKind: entity?.entityKind || null,
    rangeFamilySubjectKind: null,
    blockedInputReason: getFirstLaneBlockedReason(scopePayload, "tokenBankState")
  };
}

export function getTokenShopGenericDailyTokeniumLaneSummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  const laneEntry =
    scopeEntries.find(([, scopePayload]) => {
      return (
        getFactValues(scopePayload, "daily-tokenium-lane-owner-family-label").length > 0 ||
        getFactValues(scopePayload, "daily-tokenium-lane-purchase-hook").length > 0
      );
    }) ?? null;
  if (!laneEntry) {
    return null;
  }
  const [, scopePayload] = laneEntry;
  const entity = getSubjectEntity(scopePayload);
  return {
    hasOwnerFamilyClues:
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-owner-family-label")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-academy-controller")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-text-handler")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-mission-family-label")),
    hasModifierBoundary:
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-loop-hook")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-purchase-hook")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-final-bonus-hook")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-purchase-owner")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-premium-cap-bonus")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-premium-mats-bonus")),
    hasPlayerFacingBoundary:
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-progress-string")) &&
      Boolean(getFirstFactValue(scopePayload, "daily-tokenium-lane-cap-description-string")) &&
      Boolean(
        getFirstFactValue(scopePayload, "daily-tokenium-lane-collector-pack-description-string")
      ),
    coverageSource: "generic-mechanics",
    ownerFamilyLabel:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-owner-family-label") || "SpaceAcademy",
    missionFamilyLabel:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-mission-family-label") || "FarmMissions",
    academyController:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-academy-controller") ||
      "SpaceAcademyMain",
    textHandler:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-text-handler") ||
      "TextHandlerSpaceAcademy",
    loopHook:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-loop-hook") || "SetLM244BonusText",
    purchaseHook:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-purchase-hook") || "BuyLM244",
    finalBonusHook:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-final-bonus-hook") ||
      "FinalDailyTokenBonus",
    purchaseOwner:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-purchase-owner") || "BuyCollectorDevice",
    premiumCapBonus:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-premium-cap-bonus") ||
      "CollectorCapBonus",
    premiumMatsBonus:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-premium-mats-bonus") ||
      "CollectorMatsBonus",
    progressString:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-progress-string") ||
      "0 / 2000 Daily Tokenium (from blue farm missions)",
    capDescriptionString:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-cap-description-string") ||
      "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
    collectorPackDescriptionString:
      getFirstFactValue(scopePayload, "daily-tokenium-lane-collector-pack-description-string") ||
      "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu",
    premiumPack: "COLLECTERS PACK",
    rowLocalSubjectId: entity ? getEntityLabel(entity) : null,
    rangeFamilySubjectId: null,
    rowLocalSubjectKind: entity?.entityKind || null,
    rangeFamilySubjectKind: null,
    blockedInputReason: getFirstLaneBlockedReason(scopePayload, "dailyTokeniumLane")
  };
}

export function getTokenShopGenericTokenBankControllerShellSummary(payload) {
  const scopeEntries = getScopeEntries(payload);
  const controllerEntry =
    scopeEntries.find(([, scopePayload]) => {
      return (
        getFactValues(scopePayload, "token-bank-controller-claim-method").length > 0 ||
        getFactValues(scopePayload, "token-bank-controller-notification-hook").length > 0
      );
    }) ?? null;
  if (!controllerEntry) {
    return null;
  }
  const [, scopePayload] = controllerEntry;
  const entity = getSubjectEntity(scopePayload);
  const adjacentTerms = getFactValues(scopePayload, "token-bank-controller-adjacent-terms");

  return {
    hasControllerShell:
      Boolean(getFirstFactValue(scopePayload, "token-bank-controller-claim-method")) &&
      Boolean(getFirstFactValue(scopePayload, "token-bank-controller-fill-method")) &&
      Boolean(getFirstFactValue(scopePayload, "token-bank-controller-fill-field")) &&
      Boolean(getFirstFactValue(scopePayload, "token-bank-controller-description-shell")) &&
      Boolean(getFirstFactValue(scopePayload, "token-bank-controller-notification-hook")) &&
      adjacentTerms.includes("get_TokenBankCap") &&
      adjacentTerms.includes("get_ClaimableBankTokens") &&
      adjacentTerms.includes("IncreaseBankedTokens"),
    coverageSource: "generic-mechanics",
    claimMethod:
      getFirstFactValue(scopePayload, "token-bank-controller-claim-method") || "ClaimBankedTokens",
    fillMethod:
      getFirstFactValue(scopePayload, "token-bank-controller-fill-method") || "SetBankFill",
    fillField: getFirstFactValue(scopePayload, "token-bank-controller-fill-field") || "BankFill",
    descriptionShell:
      getFirstFactValue(scopePayload, "token-bank-controller-description-shell") ||
      "TokenBankDescriptionText",
    notificationHook:
      getFirstFactValue(scopePayload, "token-bank-controller-notification-hook") ||
      "CheckTokenClaimNotification",
    rowLocalSubjectId: entity ? getEntityLabel(entity) : null,
    rangeFamilySubjectId: null,
    rowLocalSubjectKind: entity?.entityKind || null,
    rangeFamilySubjectKind: null,
    adjacentTerms,
    blockedInputReason: getFirstLaneBlockedReason(scopePayload, "tokenBankController")
  };
}

export function buildTokenShopGenericMechanicsIndex(payload) {
  const scopes = normalizeGenericScopesPayload(payload);
  const byScope = new Map(Object.entries(scopes));
  return { byScope };
}

export function getTokenShopGenericRowDetailForField(index, fieldName) {
  const scopeId = TOKEN_SHOP_SCOPE_BY_FIELD[fieldName];
  const preferredScopePayload = scopeId ? index?.byScope?.get(scopeId) : null;
  const preferredRowDetail = buildRowDetailFromGenericScope(preferredScopePayload, fieldName);
  if (preferredRowDetail?.runtimeCostCoverage?.isClosed || preferredRowDetail?.isGrounded) {
    return preferredRowDetail;
  }
  for (const [candidateScopeId, scopePayload] of index?.byScope?.entries?.() || []) {
    if (candidateScopeId === scopeId) {
      continue;
    }
    const candidateRowDetail = buildRowDetailFromGenericScope(scopePayload, fieldName);
    if (candidateRowDetail?.runtimeCostCoverage?.isClosed) {
      return {
        ...candidateRowDetail,
        preferredScopeId: scopeId || null,
        resolvedScopeId: candidateScopeId
      };
    }
  }
  return preferredRowDetail;
}

export function applyTokenShopGenericRowDetailToRow(row, rowDetail) {
  if (!rowDetail || typeof rowDetail !== "object") {
    return row;
  }
  const boundedEvidenceTerms = uniqueStrings(rowDetail.boundedEvidenceTerms || []);
  const boundedEvidenceNote = boundedEvidenceTerms.length
    ? `Bounded row-remap evidence: ${boundedEvidenceTerms.join(", ")}.`
    : null;
  const runtimeCostCoverage =
    rowDetail.runtimeCostCoverage && typeof rowDetail.runtimeCostCoverage === "object"
      ? rowDetail.runtimeCostCoverage
      : null;
  const runtimeCoverageNote = runtimeCostCoverage?.isClosed
    ? `Runtime cost owner coverage closed by DB evidence${
        runtimeCostCoverage.evidenceSource ? ` (${runtimeCostCoverage.evidenceSource})` : ""
      }; exact next-cost formula still follows formula-confidence evidence.`
    : null;
  const currentCostFormulaConfidence =
    String(row?.costFormulaConfidence || "verified").trim() || "verified";
  return {
    ...row,
    subjectId:
      typeof rowDetail.subjectId === "string" && rowDetail.subjectId
        ? rowDetail.subjectId
        : row.subjectId,
    subjectKind:
      typeof rowDetail.subjectKind === "string" && rowDetail.subjectKind
        ? rowDetail.subjectKind
        : row.subjectKind,
    identity:
      typeof rowDetail.identity === "string" && rowDetail.identity
        ? rowDetail.identity
        : row.identity,
    identitySource:
      typeof rowDetail.identitySource === "string" && rowDetail.identitySource
        ? rowDetail.identitySource
        : row.identitySource,
    rowType:
      typeof rowDetail.rowType === "string" && rowDetail.rowType ? rowDetail.rowType : row.rowType,
    rowTypeLabel:
      typeof rowDetail.rowTypeLabel === "string" && rowDetail.rowTypeLabel
        ? rowDetail.rowTypeLabel
        : row.rowTypeLabel,
    note:
      typeof rowDetail.detailNote === "string" && rowDetail.detailNote
        ? rowDetail.detailNote
        : row.note,
    rowDetail,
    runtimeCostCoverage: runtimeCostCoverage || row.runtimeCostCoverage || null,
    costFormulaConfidence:
      runtimeCostCoverage?.isClosed && currentCostFormulaConfidence === "projected"
        ? "verified"
        : row?.costFormulaConfidence,
    blockedInputReason:
      row.blockedInputReason ||
      (typeof rowDetail?.blockedFields?.rowDetail === "string"
        ? rowDetail.blockedFields.rowDetail
        : null),
    dbMetadataSourceLabel:
      row.dbMetadataSourceLabel || row.contractSourceLabel || "Generic mechanics model",
    contractSourceLabel: row.contractSourceLabel || "Generic mechanics model",
    supportingEvidenceNote: row.supportingEvidenceNote || runtimeCoverageNote || boundedEvidenceNote
  };
}
