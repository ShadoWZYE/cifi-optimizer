import {
  getDbSystemGenericScopes,
  getDbSystemSubjectMetadata,
  hasDbSystemBundle,
  normalizeDbSystemBundle
} from "./db-system-bundle.js";

export function normalizeTokenShopDbBundle(input) {
  const normalized = normalizeDbSystemBundle(input);
  return {
    ...normalized,
    genericMechanics: normalized.genericScopes
  };
}

export function hasTokenShopDbBundle(input) {
  return hasDbSystemBundle(input);
}

export function getTokenShopDbSubjectMetadata(input) {
  return getDbSystemSubjectMetadata(input);
}

export function getTokenShopDbGenericScopes(input) {
  return getDbSystemGenericScopes(input);
}
