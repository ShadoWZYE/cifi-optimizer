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

  contracts.forEach((contract) => {
    const subjectId = String(contract?.subjectId || "").trim();
    if (subjectId) {
      bySubjectId.set(subjectId, contract);
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
    bySubjectId
  };
}

export function getTokenShopSubjectContractForField(contractIndex, fieldName) {
  const scopeId = TOKEN_SHOP_SCOPE_BY_FIELD[fieldName];
  if (!scopeId || !contractIndex?.byAlias) {
    return null;
  }
  return contractIndex.byAlias.get(scopeId) ?? null;
}

export function applyTokenShopSubjectContractToRow(row, contract) {
  if (!contract) {
    return row;
  }

  const supportSummary = contract?.supportSummary ?? {};
  const provenanceSummary = contract?.provenanceSummary ?? {};
  const groundedFields = contract?.groundedFields ?? {};
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
    knownEdges: normalizeArray(contract?.knownEdges),
    missingEdges: normalizeArray(contract?.missingEdges),
    blockedEdges: normalizeArray(contract?.blockedEdges),
    nonblockingEdges: normalizeArray(contract?.nonblockingEdges),
    nextSeam,
    groundedFields,
    rowDetail,
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

export const TOKEN_SHOP_CONTRACT_SCOPE_IDS = TOKEN_SHOP_SCOPE_IDS;
