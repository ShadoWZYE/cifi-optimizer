import {
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

export function buildTokenShopDbRowDetailResolver(input = {}) {
  const tokenShopDb = normalizeTokenShopDbBundle(input);
  const contractIndex = getTokenShopDbSubjectMetadata(tokenShopDb)
    ? buildTokenShopDbSubjectMetadataIndex(getTokenShopDbSubjectMetadata(tokenShopDb))
    : null;
  const genericMechanicsIndex = buildTokenShopGenericMechanicsIndex(tokenShopDb.genericMechanics);

  return {
    apply(row) {
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
        return directApplied;
      }
      return supportingContracts.reduce(
        (resolvedRow, contract) => applyTokenShopSupportingContractSignals(resolvedRow, contract),
        directApplied
      );
    }
  };
}
