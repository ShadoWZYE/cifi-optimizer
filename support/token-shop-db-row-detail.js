import {
  getTokenShopDbSubjectMetadata,
  normalizeTokenShopDbBundle
} from "./token-shop-db-bundle.js";
import {
  applyTokenShopDbSubjectMetadataToRow,
  buildTokenShopDbSubjectMetadataIndex,
  getTokenShopDbSubjectMetadataForField
} from "./token-shop-db-subject-metadata.js";
import {
  applyTokenShopGenericRowDetailToRow,
  buildTokenShopGenericMechanicsIndex,
  getTokenShopGenericRowDetailForField
} from "./token-shop-generic-mechanics.js";

export function buildTokenShopDbRowDetailResolver(input = {}) {
  const tokenShopDb = normalizeTokenShopDbBundle(input);
  const contractIndex = getTokenShopDbSubjectMetadata(tokenShopDb)
    ? buildTokenShopDbSubjectMetadataIndex(getTokenShopDbSubjectMetadata(tokenShopDb))
    : null;
  const genericMechanicsIndex = buildTokenShopGenericMechanicsIndex(tokenShopDb.genericMechanics);

  return {
    apply(row) {
      const genericRowDetail = getTokenShopGenericRowDetailForField(genericMechanicsIndex, row?.field);
      const genericApplied = applyTokenShopGenericRowDetailToRow(row, genericRowDetail);
      const subjectContract = getTokenShopDbSubjectMetadataForField(contractIndex, row?.field);
      if (!subjectContract) {
        return genericApplied;
      }
      return applyTokenShopDbSubjectMetadataToRow(genericApplied, subjectContract);
    }
  };
}
