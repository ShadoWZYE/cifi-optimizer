import { TOKEN_SHOP_SCOPE_BY_FIELD, TOKEN_SHOP_SCOPE_IDS } from "./token-shop-scope-map.js";

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getCanonicalIdentity(contract, fallbackIdentity, rowDetail = null) {
  const groundedFields = contract?.groundedFields ?? {};
  const effectiveRowDetail = rowDetail ?? groundedFields.rowDetail ?? {};
  if (typeof effectiveRowDetail.identity === "string" && effectiveRowDetail.identity) {
    return {
      identity: effectiveRowDetail.identity,
      identitySource: effectiveRowDetail.identitySource || "DB subject metadata"
    };
  }
  if (typeof groundedFields.literalTitleText === "string" && groundedFields.literalTitleText) {
    return {
      identity: groundedFields.literalTitleText,
      identitySource: "DB subject metadata title"
    };
  }

  const prefabCandidate = normalizeArray(groundedFields.prefabCandidates)[0];
  if (typeof prefabCandidate === "string" && prefabCandidate) {
    return {
      identity: prefabCandidate,
      identitySource: "DB-backed TokenShop mechanics"
    };
  }

  return {
    identity: fallbackIdentity,
    identitySource: null
  };
}

export function buildTokenShopSubjectContractIndex(payload) {
  const contractMap =
    payload?.contracts && typeof payload.contracts === "object"
      ? payload.contracts
      : payload && typeof payload === "object"
        ? payload
        : {};
  const contracts = Object.values(contractMap).filter(Boolean);
  const byAlias = new Map();
  const bySubjectId = new Map();
  const rangeFamilies = [];

  contracts.forEach((contract) => {
    const subjectId = String(contract?.subjectId || "").trim();
    if (subjectId) {
      bySubjectId.set(subjectId, contract);
    }
    if (String(contract?.subjectKind || "").trim() === "range-family") {
      rangeFamilies.push(contract);
    }
    normalizeArray(contract?.targetAliases).forEach((alias) => {
      byAlias.set(String(alias), contract);
    });
    const traceScope = String(contract?.traceScope || "").trim();
    if (traceScope) {
      byAlias.set(traceScope, contract);
    }
  });

  return {
    byAlias,
    bySubjectId,
    rangeFamilies
  };
}

function getTokenShopSupportingRangeContracts(contractIndex, fieldName) {
  const normalizedFieldName = String(fieldName || "").trim();
  const fieldMatch = normalizedFieldName.match(/^ATU(\d+)Level$/i);
  const fieldIndex = fieldMatch ? Number.parseInt(fieldMatch[1], 10) : Number.NaN;
  return (Array.isArray(contractIndex?.rangeFamilies) ? contractIndex.rangeFamilies : [])
    .filter((contract) => {
      const groundedFields = contract?.groundedFields ?? {};
      const rowDetailsByField = groundedFields.rowDetailsByField ?? {};
      if (rowDetailsByField && typeof rowDetailsByField[normalizedFieldName] === "object") {
        return true;
      }
      if (!Number.isFinite(fieldIndex)) {
        return false;
      }
      const subjectId = String(contract?.subjectId || "").trim();
      const rangeMatch = subjectId.match(/^range:token-shop:ATU(\d+)Button-ATU(\d+)Button$/i);
      if (!rangeMatch) {
        return false;
      }
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = Number.parseInt(rangeMatch[2], 10);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return false;
      }
      return fieldIndex >= Math.min(start, end) && fieldIndex <= Math.max(start, end);
    })
    .sort((left, right) => String(left?.traceScope || "").localeCompare(String(right?.traceScope || "")));
}

export function getTokenShopSubjectContractForField(contractIndex, fieldName) {
  const scopeId = TOKEN_SHOP_SCOPE_BY_FIELD[fieldName];
  if (!scopeId || !contractIndex?.byAlias) {
    return null;
  }
  return contractIndex.byAlias.get(scopeId) ?? null;
}

export function getTokenShopSupportingContractsForField(contractIndex, fieldName) {
  const directContract = getTokenShopSubjectContractForField(contractIndex, fieldName);
  return getTokenShopSupportingRangeContracts(contractIndex, fieldName).filter(
    (contract) => contract !== directContract
  );
}

export function applyTokenShopSubjectContractToRow(row, contract) {
  if (!contract) {
    return row;
  }

  const supportSummary = contract?.supportSummary ?? {};
  const provenanceSummary = contract?.provenanceSummary ?? {};
  const groundedFields = contract?.groundedFields ?? {};
  const knownEdges = normalizeArray(contract?.knownEdges);
  const missingEdges = normalizeArray(contract?.missingEdges);
  const blockedEdges = normalizeArray(contract?.blockedEdges);
  const nonblockingEdges = normalizeArray(contract?.nonblockingEdges);
  const rowDetailsByField = groundedFields.rowDetailsByField ?? {};
  const contractRowDetail =
    (row?.field &&
      typeof rowDetailsByField[row.field] === "object" &&
      rowDetailsByField[row.field]) ||
    groundedFields.rowDetail ||
    {};
  const existingRowDetail = row?.rowDetail && typeof row.rowDetail === "object" ? row.rowDetail : {};
  const genericPrimarySource = String(
    row?.dbMetadataSourceLabel || row?.contractSourceLabel || ""
  ).trim();
  const genericPrimary =
    genericPrimarySource === "Generic mechanics model" ||
    genericPrimarySource.startsWith("Generic mechanics +");
  const rowDetail = {
    ...existingRowDetail,
    ...contractRowDetail,
    blockedFields: {
      ...(existingRowDetail.blockedFields && typeof existingRowDetail.blockedFields === "object"
        ? existingRowDetail.blockedFields
        : {}),
      ...(contractRowDetail.blockedFields && typeof contractRowDetail.blockedFields === "object"
        ? contractRowDetail.blockedFields
        : {})
    }
  };
  const identity = getCanonicalIdentity(contract, row.identity, rowDetail);
  const shouldPromoteContractIdentity =
    !genericPrimary ||
    existingRowDetail.isGrounded !== true ||
    !String(row?.identity || "").trim() ||
    !String(row?.rowType || "").trim();
  const nextSeam = contract?.nextSeam ?? null;
  const hasClosedEdge = (edgeId) => {
    const normalizedEdgeId = String(edgeId || "").trim();
    if (!normalizedEdgeId) {
      return false;
    }
    return (
      knownEdges.includes(normalizedEdgeId) &&
      !missingEdges.includes(normalizedEdgeId) &&
      !blockedEdges.includes(normalizedEdgeId)
    );
  };
  const blockedInputReason =
    typeof contract?.blockedInputReason === "string" && contract.blockedInputReason
      ? contract.blockedInputReason
      : typeof rowDetail?.blockedFields?.rowDetail === "string" && rowDetail.blockedFields.rowDetail
        ? rowDetail.blockedFields.rowDetail
        : typeof row?.blockedInputReason === "string" && row.blockedInputReason
          ? row.blockedInputReason
          : null;

  const supportLabel = normalizeArray(supportSummary.supportSurfaceLabels).join(", ");
  const proofCount =
    typeof supportSummary.proofCount === "number" && Number.isFinite(supportSummary.proofCount)
      ? supportSummary.proofCount
      : 0;
  const boundedEvidenceTerms = normalizeArray(rowDetail?.boundedEvidenceTerms);
  const boundedEvidenceNote = boundedEvidenceTerms.length
    ? `Bounded row-remap evidence: ${boundedEvidenceTerms.join(", ")}.`
    : null;
  const existingSourceLabel = String(row?.dbMetadataSourceLabel || row?.contractSourceLabel || "").trim();
  const mergedSourceLabel =
    existingSourceLabel === "Generic mechanics model" || existingSourceLabel.startsWith("Generic mechanics +")
      ? contract?.subjectId && contract?.subjectKind
        ? `Generic mechanics + ${contract.subjectKind} subject metadata`
        : "Generic mechanics + DB subject metadata"
      : contract?.subjectId && contract?.subjectKind
        ? `${contract.subjectKind} subject metadata`
        : "DB subject metadata";
  const currentCostFormulaConfidence =
    String(row?.costFormulaConfidence || "verified").trim() || "verified";
  const runtimeFormulaRecovered = hasClosedEdge("runtime-next-cost-formula");
  const displayPathRecovered = hasClosedEdge("exact-display-update-path");
  const nextCostFormulaConfidence =
    runtimeFormulaRecovered && currentCostFormulaConfidence === "projected"
      ? "verified"
      : row?.costFormulaConfidence;
  const nextStorefrontBuffDisplayMode =
    displayPathRecovered && String(row?.storefrontBuffDisplayMode || "").trim() === "runtime-unresolved"
      ? null
      : row?.storefrontBuffDisplayMode;

  return {
    ...row,
    identity: shouldPromoteContractIdentity ? identity.identity : row.identity,
    identitySource:
      shouldPromoteContractIdentity ? identity.identitySource || row.identitySource : row.identitySource,
    rowType:
      shouldPromoteContractIdentity &&
      typeof rowDetail.rowType === "string" &&
      rowDetail.rowType
        ? rowDetail.rowType
        : row.rowType,
    rowTypeLabel:
      shouldPromoteContractIdentity &&
      typeof rowDetail.rowTypeLabel === "string" &&
      rowDetail.rowTypeLabel
        ? rowDetail.rowTypeLabel
        : row.rowTypeLabel,
    note:
      shouldPromoteContractIdentity &&
      typeof rowDetail.detailNote === "string" &&
      rowDetail.detailNote
        ? rowDetail.detailNote
        : row.note,
    subjectId:
      genericPrimary && typeof row?.subjectId === "string" && row.subjectId
        ? row.subjectId
        : contract?.subjectId ?? row?.subjectId ?? null,
    subjectKind:
      genericPrimary && typeof row?.subjectKind === "string" && row.subjectKind
        ? row.subjectKind
        : contract?.subjectKind ?? row?.subjectKind ?? null,
    knownEdges,
    missingEdges,
    blockedEdges,
    nonblockingEdges,
    nextSeam,
    groundedFields,
    rowDetail,
    costFormulaConfidence: nextCostFormulaConfidence,
    storefrontBuffDisplayMode: nextStorefrontBuffDisplayMode,
    supportSummary,
    provenanceSummary,
    blockedInputReason,
    dbMetadataSupportLabel: supportLabel || null,
    dbMetadataProofCount: proofCount,
    dbMetadataSourceLabel: mergedSourceLabel,
    contractSupportLabel: supportLabel || null,
    contractProofCount: proofCount,
    contractSourceLabel: mergedSourceLabel,
    supportingEvidenceNote:
      row.supportingEvidenceNote ||
      boundedEvidenceNote ||
      (supportLabel ? `DB support surfaces: ${supportLabel}.` : null)
  };
}

export function applyTokenShopSupportingContractSignals(row, contract) {
  if (!contract) {
    return row;
  }
  const knownEdges = normalizeArray(contract?.knownEdges);
  const missingEdges = normalizeArray(contract?.missingEdges);
  const blockedEdges = normalizeArray(contract?.blockedEdges);
  const nonblockingEdges = normalizeArray(contract?.nonblockingEdges);
  const currentCostFormulaConfidence =
    String(row?.costFormulaConfidence || "verified").trim() || "verified";
  const currentBuffDisplayMode = String(row?.storefrontBuffDisplayMode || "").trim();
  const currentCapDisplayMode = String(row?.storefrontCapDisplayMode || "").trim();
  const runtimeFormulaRecovered =
    knownEdges.includes("runtime-next-cost-formula") &&
    !missingEdges.includes("runtime-next-cost-formula") &&
    !blockedEdges.includes("runtime-next-cost-formula");
  const displayPathRecovered =
    knownEdges.includes("exact-display-update-path") &&
    !missingEdges.includes("exact-display-update-path") &&
    !blockedEdges.includes("exact-display-update-path");
  const mergedKnownEdges = [...new Set([...(Array.isArray(row?.knownEdges) ? row.knownEdges : []), ...knownEdges])];
  const mergedMissingEdges = [...new Set([...(Array.isArray(row?.missingEdges) ? row.missingEdges : []), ...missingEdges])];
  const mergedBlockedEdges = [...new Set([...(Array.isArray(row?.blockedEdges) ? row.blockedEdges : []), ...blockedEdges])];
  const mergedNonblockingEdges = [...new Set([...(Array.isArray(row?.nonblockingEdges) ? row.nonblockingEdges : []), ...nonblockingEdges])];
  const supportingRows = Array.isArray(row?.supportingSubjectIds) ? row.supportingSubjectIds : [];
  return {
    ...row,
    knownEdges: mergedKnownEdges,
    missingEdges: mergedMissingEdges,
    blockedEdges: mergedBlockedEdges,
    nonblockingEdges: mergedNonblockingEdges,
    costFormulaConfidence:
      runtimeFormulaRecovered && currentCostFormulaConfidence === "projected"
        ? "verified"
        : row?.costFormulaConfidence,
    storefrontBuffDisplayMode:
      displayPathRecovered && currentBuffDisplayMode === "runtime-unresolved"
        ? null
        : row?.storefrontBuffDisplayMode,
    storefrontCapDisplayMode:
      displayPathRecovered && currentCapDisplayMode === "runtime-unresolved"
        ? null
        : row?.storefrontCapDisplayMode,
    supportingSubjectIds: [...new Set([...supportingRows, String(contract?.subjectId || "").trim()].filter(Boolean))]
  };
}

export const TOKEN_SHOP_CONTRACT_SCOPE_IDS = TOKEN_SHOP_SCOPE_IDS;
