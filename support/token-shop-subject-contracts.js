const TOKEN_SHOP_CONTRACT_SCOPE_IDS = Object.freeze([
  "token-shop-atu3-cells-effect",
  "token-shop-atu4-mod",
  "token-shop-atu5-mk1-title",
  "token-shop-atu7-mk3-bridge",
  "token-shop-family-structure",
  "token-shop-daily-tokenium-family",
  "token-shop-late-atu-family",
  "token-shop-t3-trio-family"
]);

const TOKEN_SHOP_CONTRACT_SCOPE_BY_FIELD = Object.freeze({
  ATU3Level: "token-shop-atu3-cells-effect",
  ATU4Level: "token-shop-atu4-mod",
  ATU5Level: "token-shop-atu5-mk1-title",
  ATU6Level: "token-shop-family-structure",
  ATU7Level: "token-shop-atu7-mk3-bridge",
  ATU8Level: "token-shop-family-structure",
  ATU9Level: "token-shop-family-structure",
  ATU10Level: "token-shop-family-structure",
  ATU11Level: "token-shop-family-structure",
  ATU12Level: "token-shop-family-structure",
  ATU14Level: "token-shop-daily-tokenium-family",
  ATU15Level: "token-shop-daily-tokenium-family",
  ATU16Level: "token-shop-daily-tokenium-family",
  ATU17Level: "token-shop-daily-tokenium-family",
  ATU18Level: "token-shop-daily-tokenium-family",
  ATU19Level: "token-shop-daily-tokenium-family",
  ATU21Level: "token-shop-t3-trio-family",
  ATU22Level: "token-shop-t3-trio-family",
  ATU23Level: "token-shop-t3-trio-family",
  ATU24Level: "token-shop-late-atu-family",
  ATU25Level: "token-shop-late-atu-family",
  ATU26Level: "token-shop-late-atu-family",
  ATU27Level: "token-shop-late-atu-family",
  ATU28Level: "token-shop-late-atu-family"
});

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function getCanonicalIdentity(contract, fallbackIdentity, rowDetail = null) {
  const groundedFields = contract?.groundedFields ?? {};
  const effectiveRowDetail = rowDetail ?? groundedFields.rowDetail ?? {};
  if (typeof effectiveRowDetail.identity === "string" && effectiveRowDetail.identity) {
    return {
      identity: effectiveRowDetail.identity,
      identitySource: effectiveRowDetail.identitySource || "Canonical DB subject"
    };
  }
  if (typeof groundedFields.literalTitleText === "string" && groundedFields.literalTitleText) {
    return {
      identity: groundedFields.literalTitleText,
      identitySource: "Canonical DB subject title"
    };
  }

  const prefabCandidate = normalizeArray(groundedFields.prefabCandidates)[0];
  if (typeof prefabCandidate === "string" && prefabCandidate) {
    return {
      identity: prefabCandidate,
      identitySource: "Canonical DB subject contract"
    };
  }

  return {
    identity: fallbackIdentity,
    identitySource: null
  };
}

export function buildTokenShopSubjectContractIndex(payload) {
  const contracts = Object.values(payload?.contracts ?? {}).filter(Boolean);
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
  const scopeId = TOKEN_SHOP_CONTRACT_SCOPE_BY_FIELD[fieldName];
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
  const rowDetail =
    (row?.field &&
      typeof rowDetailsByField[row.field] === "object" &&
      rowDetailsByField[row.field]) ||
    groundedFields.rowDetail ||
    {};
  const identity = getCanonicalIdentity(contract, row.identity, rowDetail);
  const nextSeam = contract?.nextSeam ?? null;
  const blockedInputReason =
    typeof contract?.blockedInputReason === "string" && contract.blockedInputReason
      ? contract.blockedInputReason
      : typeof rowDetail?.blockedFields?.rowDetail === "string" && rowDetail.blockedFields.rowDetail
        ? rowDetail.blockedFields.rowDetail
        : null;

  const supportLabel = normalizeArray(supportSummary.supportSurfaceLabels).join(", ");
  const proofCount =
    typeof supportSummary.proofCount === "number" && Number.isFinite(supportSummary.proofCount)
      ? supportSummary.proofCount
      : 0;

  return {
    ...row,
    identity: identity.identity,
    identitySource: identity.identitySource || row.identitySource,
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
    subjectId: contract?.subjectId ?? null,
    subjectKind: contract?.subjectKind ?? null,
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
    contractSupportLabel: supportLabel || null,
    contractProofCount: proofCount,
    contractSourceLabel:
      contract?.subjectId && contract?.subjectKind
        ? `Canonical ${contract.subjectKind} subject`
        : "Canonical DB subject",
    supportingEvidenceNote:
      row.supportingEvidenceNote || (supportLabel ? `DB support surfaces: ${supportLabel}.` : null)
  };
}

export { TOKEN_SHOP_CONTRACT_SCOPE_IDS };
