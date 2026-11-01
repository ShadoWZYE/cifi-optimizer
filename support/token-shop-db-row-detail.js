import {
  getTokenShopDbConsumerProjections,
  getTokenShopDbSubjectMetadata,
  normalizeTokenShopDbBundle
} from "./token-shop-db-bundle.js";
import {
  applyTokenShopSupportingContractSignals,
  applyTokenShopDbSubjectMetadataToRow,
  buildTokenShopDbSubjectMetadataIndex,
  getTokenShopDbSubjectMetadataForField,
  getTokenShopSupportingContractsForField
} from "./token-shop-db-subject-metadata.js";
import {
  applyTokenShopGenericRowDetailToRow,
  buildTokenShopGenericMechanicsIndex,
  getTokenShopGenericRowDetailForField
} from "./token-shop-generic-mechanics.js";

function uniqueStrings(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
}

function fieldToTokenShopButtonId(fieldName) {
  const normalizedField = String(fieldName || "").trim();
  const match = normalizedField.match(/^(ATU\d+)Level$/);
  if (!match) {
    return "";
  }
  return `${match[1]}Button`;
}

function buildTokenShopV2ProjectionIndex(tokenShopDb) {
  const projections = Array.isArray(getTokenShopDbConsumerProjections(tokenShopDb))
    ? getTokenShopDbConsumerProjections(tokenShopDb)
    : [];
  const index = new Map();
  for (const projection of projections) {
    if (String(projection?.projectionKind || "").trim() !== "token-shop-row-structure") {
      continue;
    }
    const subjectId = String(projection?.subjectId || "").trim();
    if (!subjectId) {
      continue;
    }
    index.set(subjectId, projection);
  }
  return index;
}

function appendRowNote(row, addition) {
  const nextAddition = String(addition || "").trim();
  if (!nextAddition) {
    return row;
  }
  const currentNote = String(row?.note || "").trim();
  if (!currentNote) {
    return { ...row, note: nextAddition };
  }
  if (currentNote.includes(nextAddition)) {
    return row;
  }
  return { ...row, note: `${currentNote} ${nextAddition}` };
}

function firstMatchingField(rowValueFields, suffixes) {
  const normalizedFields = uniqueStrings(rowValueFields || []);
  const normalizedSuffixes = Array.isArray(suffixes) ? suffixes : [];
  return (
    normalizedFields.find((fieldName) =>
      normalizedSuffixes.some((suffix) => fieldName.endsWith(String(suffix || "").trim()))
    ) || ""
  );
}

function inferRowFormulaFields(rowValueFields) {
  return {
    startCostField: firstMatchingField(rowValueFields, ["StartCost"]),
    additiveCostField: firstMatchingField(rowValueFields, ["AdditiveCost"]),
    bonusField: firstMatchingField(rowValueFields, ["Bonus", "Bonus1", "Bonus3"]),
    maxLevelField: firstMatchingField(rowValueFields, ["MaxLevel", "FillMaxLevel"]),
    fillField: firstMatchingField(rowValueFields, ["Fill"])
  };
}

function applyTokenShopV2ProjectionToRow(row, projection) {
  const payload =
    projection?.payload && typeof projection.payload === "object" ? projection.payload : {};
  const actionHook = String(payload.actionHook || "").trim();
  const prefabs = uniqueStrings(payload.prefabs || []);
  const displayUpdaters = uniqueStrings(payload.displayUpdaters || []);
  const uiSlots = uniqueStrings(payload.uiSlots || []);
  const rowValueFields = uniqueStrings(payload.rowValueFields || []);
  const resolvedPrefab = String(payload.resolvedPrefab || "").trim();
  const resolvedDisplayUpdater = String(payload.resolvedDisplayUpdater || "").trim();
  const resolvedUiSlot = String(payload.resolvedUiSlot || "").trim();
  const projectionCompleteness = String(payload.projectionCompleteness || "").trim() || "partial";
  const runtimeProjection =
    payload.runtimeProjection && typeof payload.runtimeProjection === "object"
      ? payload.runtimeProjection
      : null;
  if (
    !actionHook &&
    !prefabs.length &&
    !displayUpdaters.length &&
    !uiSlots.length &&
    !rowValueFields.length
  ) {
    return runtimeProjection
      ? { ...row, runtimeProjection: row?.runtimeProjection || runtimeProjection }
      : row;
  }
  const inferredFields = inferRowFormulaFields(rowValueFields);
  const hasGroundedCostFields =
    Boolean(inferredFields.startCostField) &&
    (Boolean(inferredFields.additiveCostField) ||
      String(row?.costFormulaType || "").trim() === "start-only");
  const hasGroundedBonusField = Boolean(inferredFields.bonusField);
  const hasGroundedMaxField = Boolean(inferredFields.maxLevelField);
  const hasGroundedFormulaBlock =
    projectionCompleteness === "structured" &&
    rowValueFields.length > 0 &&
    (hasGroundedCostFields || hasGroundedBonusField || hasGroundedMaxField);
  const updatedRow = {
    ...row,
    startCostField: inferredFields.startCostField || row?.startCostField,
    additiveCostField: inferredFields.additiveCostField || row?.additiveCostField,
    bonusField: inferredFields.bonusField || row?.bonusField,
    maxLevelField: inferredFields.maxLevelField || row?.maxLevelField,
    fillField: inferredFields.fillField || row?.fillField,
    costFormulaConfidence:
      hasGroundedCostFields && String(row?.costFormulaConfidence || "").trim() === "projected"
        ? "verified"
        : row?.costFormulaConfidence,
    storefrontBuffDisplayMode:
      hasGroundedFormulaBlock &&
      String(row?.storefrontBuffDisplayMode || "").trim() === "runtime-unresolved"
        ? null
        : row?.storefrontBuffDisplayMode,
    storefrontCapDisplayMode:
      hasGroundedMaxField &&
      String(row?.storefrontCapDisplayMode || "").trim() === "runtime-unresolved"
        ? null
        : row?.storefrontCapDisplayMode,
    v2GraphStructure: {
      rowButton: String(payload.rowButton || projection?.subjectId || "").trim() || null,
      actionHook: actionHook || null,
      prefabCandidates: prefabs,
      displayUpdaterCandidates: displayUpdaters,
      uiSlots,
      rowValueFields,
      groundedFormulaFields: {
        startCostField: inferredFields.startCostField || null,
        additiveCostField: inferredFields.additiveCostField || null,
        bonusField: inferredFields.bonusField || null,
        maxLevelField: inferredFields.maxLevelField || null,
        fillField: inferredFields.fillField || null
      },
      projectionCompleteness
    },
    runtimeProjection: row?.runtimeProjection || runtimeProjection || row?.runtimeProjection || null
  };
  const structureSummaryBits = [];
  if (actionHook) {
    structureSummaryBits.push(`action ${actionHook}`);
  }
  if (resolvedPrefab) {
    structureSummaryBits.push(`prefab ${resolvedPrefab}`);
  } else if (prefabs.length > 1) {
    structureSummaryBits.push(`prefab candidates ${prefabs.length}`);
  }
  if (resolvedDisplayUpdater) {
    structureSummaryBits.push(`updater ${resolvedDisplayUpdater}`);
  } else if (displayUpdaters.length > 1) {
    structureSummaryBits.push(`updater candidates ${displayUpdaters.length}`);
  }
  if (resolvedUiSlot) {
    structureSummaryBits.push(`slot ${resolvedUiSlot}`);
  } else if (uiSlots.length > 1) {
    structureSummaryBits.push(`slot candidates ${uiSlots.length}`);
  }
  if (rowValueFields.length) {
    structureSummaryBits.push(`value fields ${rowValueFields.length}`);
  }
  return appendRowNote(
    updatedRow,
    structureSummaryBits.length ? `V2 graph structure: ${structureSummaryBits.join(", ")}.` : ""
  );
}

export function buildTokenShopDbRowDetailResolver(input = {}) {
  const tokenShopDb = normalizeTokenShopDbBundle(input);
  const contractIndex = getTokenShopDbSubjectMetadata(tokenShopDb)
    ? buildTokenShopDbSubjectMetadataIndex(getTokenShopDbSubjectMetadata(tokenShopDb))
    : null;
  const genericMechanicsIndex = buildTokenShopGenericMechanicsIndex(tokenShopDb.genericMechanics);
  const v2ProjectionIndex = buildTokenShopV2ProjectionIndex(tokenShopDb);

  return {
    apply(row) {
      const buttonId = fieldToTokenShopButtonId(row?.field);
      const v2Projection = buttonId ? (v2ProjectionIndex.get(buttonId) ?? null) : null;
      const genericRowDetail = getTokenShopGenericRowDetailForField(
        genericMechanicsIndex,
        row?.field
      );
      const genericApplied = applyTokenShopGenericRowDetailToRow(row, genericRowDetail);
      const directContract = getTokenShopDbSubjectMetadataForField(contractIndex, row?.field);
      const supportingContracts = getTokenShopSupportingContractsForField(
        contractIndex,
        row?.field
      );
      const directApplied = directContract
        ? applyTokenShopDbSubjectMetadataToRow(genericApplied, directContract)
        : genericApplied;
      if (!supportingContracts.length) {
        return v2Projection
          ? applyTokenShopV2ProjectionToRow(directApplied, v2Projection)
          : directApplied;
      }
      const resolvedRow = supportingContracts.reduce(
        (resolvedRow, contract) => applyTokenShopSupportingContractSignals(resolvedRow, contract),
        directApplied
      );
      return v2Projection
        ? applyTokenShopV2ProjectionToRow(resolvedRow, v2Projection)
        : resolvedRow;
    }
  };
}
