function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unwrapEntryMap(payload) {
  const normalized = normalizeObject(payload);
  if (!normalized) {
    return null;
  }
  const contracts = normalizeObject(normalized.contracts);
  const scopes = normalizeObject(normalized.scopes);
  const boundaries = normalizeObject(normalized.boundaries);
  return contracts || scopes || boundaries || normalized;
}

export function composeDbCoverageSource({
  hasGenericMechanics = false,
  hasBoundaryModel = false,
  hasSubjectMetadata = false
} = {}) {
  const labels = [];
  if (hasGenericMechanics) {
    labels.push("generic-mechanics");
  }
  if (hasBoundaryModel) {
    labels.push("boundary-model");
  }
  if (hasSubjectMetadata) {
    labels.push("db-subject-metadata");
  }
  return labels.length ? labels.join("+") : null;
}

export function normalizeDbSystemBundle(input = {}) {
  const directBundle = normalizeObject(input) || {};
  const nestedBundle = normalizeObject(directBundle.db) || directBundle;
  const subjectMetadataPayload = normalizeObject(nestedBundle.subjectMetadata);
  const genericMechanicsPayload = normalizeObject(nestedBundle.genericMechanics);
  const boundariesPayload = normalizeObject(nestedBundle.boundaries);
  const subjectMetadata = unwrapEntryMap(subjectMetadataPayload);
  const genericScopes = unwrapEntryMap(genericMechanicsPayload);
  const boundaries = unwrapEntryMap(boundariesPayload);
  const hasAny = Boolean(
    (subjectMetadata && Object.keys(subjectMetadata).length) ||
      (genericScopes && Object.keys(genericScopes).length) ||
      (boundaries && Object.keys(boundaries).length)
  );

  return {
    subjectMetadataPayload,
    genericMechanicsPayload,
    boundariesPayload,
    subjectMetadata,
    genericScopes,
    boundaries,
    hasAny
  };
}

export function hasDbSystemBundle(input) {
  return normalizeDbSystemBundle(input).hasAny;
}

export function getDbSystemSubjectMetadata(input) {
  return normalizeDbSystemBundle(input).subjectMetadata;
}

export function getDbSystemGenericScopes(input) {
  return normalizeDbSystemBundle(input).genericScopes;
}

export function getDbSystemBoundaries(input) {
  return normalizeDbSystemBundle(input).boundaries;
}

export function getDbSystemSubjectMetadataEntries(input) {
  const subjectMetadata = getDbSystemSubjectMetadata(input);
  if (subjectMetadata && typeof subjectMetadata === "object" && !Array.isArray(subjectMetadata)) {
    return Object.values(subjectMetadata).filter(Boolean);
  }
  return [];
}

export function getDbSystemSubjectMetadataEntry(input, subjectId) {
  const normalizedSubjectId = String(subjectId || "").trim();
  if (!normalizedSubjectId) {
    return null;
  }
  return (
    getDbSystemSubjectMetadataEntries(input).find(
      (entry) =>
        String(entry?.subjectId || "").trim() === normalizedSubjectId ||
        String(entry?.subjectKey || "").trim() === normalizedSubjectId
    ) ?? null
  );
}

export function getDbSystemGenericSubjectSummaries(input) {
  const scopes = getDbSystemGenericScopes(input);
  if (!scopes || typeof scopes !== "object") {
    return [];
  }
  return Object.entries(scopes)
    .map(([traceScope, scopePayload]) => {
      const entities = Array.isArray(scopePayload?.entities) ? scopePayload.entities : [];
      const facts = Array.isArray(scopePayload?.facts) ? scopePayload.facts : [];
      const relations = Array.isArray(scopePayload?.relations) ? scopePayload.relations : [];
      const gaps = Array.isArray(scopePayload?.gaps) ? scopePayload.gaps : [];
      const subjectEntity =
        entities.find((entity) =>
          ["target", "family-graph", "range-family", "row-local"].includes(
            String(entity?.entityKind || "")
          )
        ) ?? null;
      const subjectId = String(subjectEntity?.entityId || traceScope || "").trim();
      if (!subjectId) {
        return null;
      }
      const factsByKind = {};
      for (const fact of facts) {
        const factKind = String(fact?.factKind || "").trim();
        const factValue = String(fact?.factValue || "").trim();
        if (!factKind || !factValue) {
          continue;
        }
        if (!Array.isArray(factsByKind[factKind])) {
          factsByKind[factKind] = [];
        }
        factsByKind[factKind].push(factValue);
      }
      const relationsByKind = {};
      for (const relation of relations) {
        const relationKind = String(relation?.relationKind || "").trim();
        const sourceEntityId = String(relation?.sourceEntityId || "").trim();
        const targetEntityId = String(relation?.targetEntityId || "").trim();
        if (!relationKind || (!sourceEntityId && !targetEntityId)) {
          continue;
        }
        if (!Array.isArray(relationsByKind[relationKind])) {
          relationsByKind[relationKind] = [];
        }
        relationsByKind[relationKind].push({
          sourceEntityId,
          targetEntityId,
          payload: relation?.payload && typeof relation.payload === "object" ? relation.payload : {}
        });
      }
      const nextSeamIds = gaps
        .filter((gap) => String(gap?.gapKind || "").trim() === "next-seam")
        .map((gap) => String(gap?.payload?.seamId || "").trim())
        .filter(Boolean);
      return {
        traceScope,
        subjectId,
        factsByKind,
        relationsByKind,
        factCount: facts.length,
        relationCount: relations.length,
        gapCount: gaps.length,
        nextSeamIds: [...new Set(nextSeamIds)]
      };
    })
    .filter(Boolean);
}

export function getDbSystemGenericSubjectSummary(input, subjectId) {
  const normalizedSubjectId = String(subjectId || "").trim();
  if (!normalizedSubjectId) {
    return null;
  }
  return (
    getDbSystemGenericSubjectSummaries(input).find(
      (entry) => String(entry?.subjectId || "").trim() === normalizedSubjectId
    ) ?? null
  );
}

export function getDbSystemBoundaryEntries(input) {
  const boundaries = getDbSystemBoundaries(input);
  if (boundaries && typeof boundaries === "object" && !Array.isArray(boundaries)) {
    return Object.values(boundaries).filter(Boolean);
  }
  return [];
}

export function getDbSystemBoundaryEntry(input, subjectId, boundaryKind = "") {
  const normalizedSubjectId = String(subjectId || "").trim();
  const normalizedBoundaryKind = String(boundaryKind || "").trim();
  if (!normalizedSubjectId) {
    return null;
  }
  return (
    getDbSystemBoundaryEntries(input).find((entry) => {
      const entrySubjectId = String(entry?.subjectId || "").trim();
      const entryBoundaryKind = String(entry?.boundaryKind || "").trim();
      return entrySubjectId === normalizedSubjectId && (!normalizedBoundaryKind || entryBoundaryKind === normalizedBoundaryKind);
    }) ?? null
  );
}

export function getDbSystemCoverageSummary(input, options = {}) {
  const includeSubjectMetadata = options.includeSubjectMetadata !== false;
  const subjectMetadataEntries = includeSubjectMetadata
    ? getDbSystemSubjectMetadataEntries(input)
    : [];
  const genericSubjectSummaries = getDbSystemGenericSubjectSummaries(input);
  const boundaryEntries = getDbSystemBoundaryEntries(input);
  const subjectFilter =
    typeof options.subjectFilter === "function" ? options.subjectFilter : () => true;
  const filteredMetadata = subjectMetadataEntries.filter((entry) => subjectFilter(entry?.subjectId, entry));
  const filteredGeneric = genericSubjectSummaries.filter((entry) =>
    subjectFilter(entry?.subjectId, entry)
  );
  const filteredBoundaries = boundaryEntries.filter((entry) =>
    subjectFilter(entry?.subjectId, entry)
  );
  const subjectLabels = [
    ...new Set(
      filteredMetadata
        .map((entry) => String(entry?.subjectId || entry?.subjectKey || "").trim())
        .filter(Boolean)
        .concat(filteredGeneric.map((entry) => entry.subjectId))
        .concat(filteredBoundaries.map((entry) => String(entry?.subjectId || "").trim()))
    )
  ];
  const nextSeamIds = [
    ...new Set(
      filteredMetadata
        .map((entry) => String(entry?.nextSeam?.id || "").trim())
        .filter(Boolean)
        .concat(filteredGeneric.flatMap((entry) => entry.nextSeamIds || []))
        .concat(
          filteredBoundaries
            .map((entry) => String(entry?.nextSeamId || "").trim())
            .filter(Boolean)
        )
    )
  ];
  const genericFactCount = filteredGeneric.reduce(
    (total, entry) => total + Number(entry?.factCount || 0),
    0
  );
  const genericGapCount = filteredGeneric.reduce(
    (total, entry) => total + Number(entry?.gapCount || 0),
    0
  );
  const hasGeneric = filteredGeneric.length > 0;
  const hasBoundaryModel = filteredBoundaries.length > 0;
  const hasSubjectMetadata = filteredMetadata.length > 0;
  return {
    hasCoverage: hasGeneric || hasSubjectMetadata || hasBoundaryModel,
    coverageSource: composeDbCoverageSource({
      hasGenericMechanics: hasGeneric,
      hasBoundaryModel,
      hasSubjectMetadata
    }),
    subjectCount: subjectLabels.length,
    subjectLabels,
    nextSeamIds,
    nextSeamLabel: nextSeamIds.join(", "),
    genericFactCount,
    genericGapCount,
    boundaryCount: filteredBoundaries.length,
    boundaryEntries: filteredBoundaries,
    subjectMetadataEntries: filteredMetadata,
    genericSubjectSummaries: filteredGeneric
  };
}

export function hasDbSystemCoverageForSubjects(
  input,
  {
    subjectIds = [],
    traceScopes = []
  } = {}
) {
  const normalizedSubjectIds = new Set(
    (Array.isArray(subjectIds) ? subjectIds : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const normalizedTraceScopes = new Set(
    (Array.isArray(traceScopes) ? traceScopes : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  if (!normalizedSubjectIds.size && !normalizedTraceScopes.size) {
    return false;
  }

  const matchesSubject = (value) =>
    normalizedSubjectIds.has(String(value || "").trim());
  const matchesTraceScope = (value) =>
    normalizedTraceScopes.has(String(value || "").trim());

  const genericScopes = getDbSystemGenericScopes(input) || {};
  for (const [traceScope, scopePayload] of Object.entries(genericScopes)) {
    if (matchesTraceScope(traceScope)) {
      return true;
    }
    const entities = Array.isArray(scopePayload?.entities) ? scopePayload.entities : [];
    if (entities.some((entity) => matchesSubject(entity?.entityId))) {
      return true;
    }
  }

  if (getDbSystemBoundaryEntries(input).some((entry) => matchesSubject(entry?.subjectId))) {
    return true;
  }
  if (
    getDbSystemSubjectMetadataEntries(input).some(
      (entry) => matchesSubject(entry?.subjectId) || matchesSubject(entry?.subjectKey)
    )
  ) {
    return true;
  }
  return false;
}
