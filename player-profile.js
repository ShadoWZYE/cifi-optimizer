export const PLAYER_PROFILE_SCHEMA_VERSION = 2;
export const PLAYER_PROFILE_IMPORT_ALIASES = {
  meta: {
    profileName: [["meta", "profileName"], ["profileName"]],
    updatedAt: [["meta", "updatedAt"]],
    dataConfidence: [["meta", "dataConfidence"], ["confidence"], ["automationConfidence"]]
  },
  canonical: {
    loopReset: [["player", "loop", "loopReset"], ["systems", "loop", "loopReset"], ["loopReset"]],
    diamonds: [["player", "resources", "diamonds"], ["resources", "diamonds"], ["resources", "gems"], ["gems"]],
    tokens: [["player", "resources", "tokens"], ["resources", "tokens"], ["tokens"]],
    academyRelics: [["player", "resources", "academyRelics"], ["resources", "academyRelics"], ["resources", "relics"], ["relics"]],
    shards: [["player", "resources", "shards"], ["resources", "shards"], ["shards"]],
    notes: [["notes", "profile"], ["notes"]]
  },
  planner: {
    shardRatePerHour: [["planning", "shards", "ratePerHour"], ["systems", "shards", "ratePerHour"], ["shardRatePerHour"]],
    totalShardMilestoneLevels: [["planning", "shards", "totalMilestoneLevels"], ["systems", "shards", "totalMilestoneLevels"], ["totalShardMilestoneLevels"]],
    shardFocusMilestoneId: [["planning", "shards", "focusMilestoneId"], ["systems", "shards", "focusMilestoneId"], ["planning", "shardFocusMilestoneId"], ["shardFocusMilestoneId"]],
    shardFocusMilestoneLevel: [["planning", "shards", "focusMilestoneLevel"], ["systems", "shards", "focusMilestoneLevel"], ["planning", "shardFocusMilestoneLevel"], ["shardFocusMilestoneLevel"]],
    shardObservedLevelsByMilestone: [["planning", "shards", "observedLevelsByMilestone"], ["systems", "shards", "observedLevelsByMilestone"]]
  },
  externalModel: {
    shipPower: [["externalModels", "shipPlanner", "summary", "power"], ["systems", "ship", "power"]],
    shipSpeed: [["externalModels", "shipPlanner", "summary", "speed"], ["systems", "ship", "speed"]],
    shipCargo: [["externalModels", "shipPlanner", "summary", "cargo"], ["systems", "ship", "cargo"]]
  },
  experimental: {
    gemNodeBudget: [["externalModels", "experimental", "gemNodes", "budget"]],
    primaryFarmingFocus: [["externalModels", "experimental", "profileHints", "primaryFarmingFocus"]],
    researchHours: [["externalModels", "experimental", "profileHints", "researchHours"]]
  },
  compatibility: {
    highestShipUnlocked: [["compatibility", "legacyStage", "highestShipUnlocked"], ["stage", "highestShipUnlocked"]],
    manualPhase: [["compatibility", "legacyStage", "manualPhase"], ["stage", "manualPhase"]],
    gemDust: [["compatibility", "unresolvedProfileFields", "gemDust"], ["resources", "gemDust"]],
    hunterLevel: [["compatibility", "unresolvedProfileFields", "hunterLevel"], ["systems", "metaProgression", "hunterLevel"]],
    traitSphereCount: [["compatibility", "unresolvedProfileFields", "traitSphereCount"], ["systems", "metaProgression", "traitSphereCount"]],
    mechParts: [["compatibility", "unresolvedProfileFields", "mechParts"], ["systems", "metaProgression", "mechParts"]],
    shardMilestoneState: [["compatibility", "unmappedSystemState", "shardMilestoneState"], ["compatibility", "unmappedSystemState", "shardMilestones"], ["systems", "shardMilestones"]],
    tokenShop: [["compatibility", "unmappedSystemState", "tokenShop"], ["systems", "tokenShop"], ["systems", "tokenBank"], ["tokenShop"], ["tokenBank"]],
    multiverseMarket: [["compatibility", "unmappedSystemState", "multiverseMarket"], ["systems", "multiverseMarket"], ["multiverseMarket"]],
    tokenShopStateClues: [
      ["TokenBankCap"],
      ["ClaimableBankTokens"],
      ["BankedTokens"],
      ["DailyTokenium"],
      ["DailyTokeniumCap"],
      ["FinalTokenBankCap"],
      ["FinalTokenBankFillSpeed"],
      ["FinalDailyTokenBonus"]
    ],
    multiverseMarketStateClues: [["InscryptionsDone"]]
  },
  shipCalibration: {
    communityToolState: [["externalModels", "shipPlanner", "communityToolState"]],
    legacyShipPlayerState: [["systems", "ship", "playerState"]]
  }
};

const PROFILE_CONFIDENCE_VALUES = new Set(["manual", "mixed", "verified"]);
const FARMING_FOCUS_VALUES = new Set(["credits", "alloy", "research", "shards"]);
const CI_SUFFIX_EXPONENTS = {
  k: 3,
  m: 6,
  b: 9,
  t: 12,
  qa: 15,
  qi: 18,
  sx: 21,
  sp: 24,
  oc: 27,
  no: 30,
  dc: 33
};

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function mergeDeep(base, patch) {
  const output = cloneValue(base);
  if (!isRecord(patch)) {
    return output;
  }

  Object.entries(patch).forEach(([key, value]) => {
    if (isRecord(value) && isRecord(output[key])) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = cloneValue(value);
    }
  });

  return output;
}

function readPath(source, path) {
  return path.reduce((current, key) => current?.[key], source);
}

function readFirst(source, paths) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function coerceNullableNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const normalized = normalizeCiNumberValue(value);
  if (typeof normalized === "number") {
    return Number.isFinite(normalized) ? normalized : null;
  }
  if (typeof normalized === "string") {
    return normalized;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCiNumberValue(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(/,/g, "").toLowerCase();
  const sciMatch = normalized.match(/^([+-]?\d*\.?\d+)\s*e\s*([+-]?\d+)$/);
  if (sciMatch) {
    return formatCiNormalizedNumber(Number(sciMatch[1]), Number(sciMatch[2]));
  }

  const suffixMatch = normalized.match(/^([+-]?\d*\.?\d+)\s*([a-z]{1,2})$/);
  if (suffixMatch) {
    const suffixExponent = CI_SUFFIX_EXPONENTS[suffixMatch[2]];
    if (suffixExponent !== undefined) {
      return formatCiNormalizedNumber(Number(suffixMatch[1]), suffixExponent);
    }
  }

  const plainNumber = Number(normalized);
  return Number.isNaN(plainNumber) ? null : plainNumber;
}

function formatCiNormalizedNumber(mantissa, exponent) {
  if (!Number.isFinite(mantissa) || !Number.isFinite(exponent)) {
    return null;
  }
  if (mantissa === 0) {
    return 0;
  }

  let nextMantissa = mantissa;
  let nextExponent = exponent;
  while (Math.abs(nextMantissa) >= 10) {
    nextMantissa /= 10;
    nextExponent += 1;
  }
  while (Math.abs(nextMantissa) > 0 && Math.abs(nextMantissa) < 1) {
    nextMantissa *= 10;
    nextExponent -= 1;
  }

  if (nextExponent >= -6 && nextExponent <= 12) {
    const numericValue = nextMantissa * Math.pow(10, nextExponent);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }

  return `${trimTrailingZeros(nextMantissa.toFixed(6))}e${nextExponent}`;
}

function trimTrailingZeros(value) {
  return String(value).replace(/(\.\d*?[1-9])0+$/u, "$1").replace(/\.0+$/u, "");
}

function coerceNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const next = String(value).trim();
  return next ? next : null;
}

function coerceEnum(value, allowedValues, fallback = null) {
  const next = coerceNullableString(value);
  return next && allowedValues.has(next) ? next : fallback;
}

function coerceRecordOrNull(value) {
  return isRecord(value) ? cloneValue(value) : null;
}

function coerceCommunityToolPayload(value) {
  if (!isRecord(value)) {
    return null;
  }

  const toolName = coerceNullableString(value.toolName);
  const toolVersion = coerceNullableString(value.toolVersion);
  const sourceReference = coerceNullableString(value.sourceReference);
  const assumptionsSummary = coerceNullableString(value.assumptionsSummary);
  const data = isRecord(value.data) || Array.isArray(value.data) ? cloneValue(value.data) : null;

  if (!toolName || !toolVersion || !sourceReference || !assumptionsSummary || data === null) {
    return null;
  }

  return {
    toolName,
    toolVersion,
    sourceReference,
    assumptionsSummary,
    data
  };
}

function coerceCommunityTools(value) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce((record, [toolKey, versions]) => {
    if (!isRecord(versions)) {
      return record;
    }

    const normalizedVersions = Object.entries(versions).reduce((versionRecord, [versionKey, payload]) => {
      const normalizedPayload = coerceCommunityToolPayload(payload);
      if (normalizedPayload) {
        versionRecord[versionKey] = normalizedPayload;
      }
      return versionRecord;
    }, {});

    if (Object.keys(normalizedVersions).length > 0) {
      record[toolKey] = normalizedVersions;
    }
    return record;
  }, {});
}

function coerceObservedShardLevels(value) {
  if (!isRecord(value)) {
    return {};
  }
  return Object.entries(value).reduce((record, [key, raw]) => {
    const normalizedKey = coerceNullableString(key);
    const normalizedValue = coerceNullableNumber(raw);
    if (normalizedKey && normalizedValue !== null) {
      record[normalizedKey] = normalizedValue;
    }
    return record;
  }, {});
}

function coerceQuarantinedShardMilestoneState(value) {
  const importedState = isRecord(value?.importedState) ? cloneValue(value.importedState) : (isRecord(value) ? cloneValue(value) : null);
  if (!importedState) {
    return null;
  }

  return {
    status: "quarantined-unmapped",
    importedState,
    mappingGate: {
      plannerUseAllowed: false,
      canonicalPromotionBlocked: true,
      requiredBeforeCanonicalPromotion: [
        "Verify the concrete shard milestone save owner or declaring save model.",
        "Recover a grounded field-to-label mapping for player-owned shard milestone state.",
        "Approve planner-safe recommendation use only after grounded save-state verification."
      ]
    },
    currentBoundary: [
      "Imported shard milestone state stays quarantined until the save owner, field mapping, and planner-safe interpretation are verified.",
      "Do not treat this blob as canonical player truth or grounded planner input."
    ]
  };
}

function coerceCompatibilityValue(value) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value) || isRecord(value)) {
    return cloneValue(value);
  }

  const numeric = coerceNullableNumber(value);
  if (numeric !== null) {
    return numeric;
  }

  return coerceNullableString(value);
}

function collectAliasedCompatibilityFields(source, fieldMap) {
  return Object.entries(fieldMap).reduce((record, [fieldName, aliases]) => {
    const value = coerceCompatibilityValue(readAliasedValue(source, aliases));
    if (value !== undefined && value !== null) {
      record[fieldName] = value;
    }
    return record;
  }, {});
}

function collectTopLevelCompatibilityPattern(source, pattern) {
  return Object.entries(source).reduce((record, [key, value]) => {
    if (!pattern.test(key)) {
      return record;
    }
    const coercedValue = coerceCompatibilityValue(value);
    if (coercedValue !== undefined && coercedValue !== null) {
      record[key] = coercedValue;
    }
    return record;
  }, {});
}

function mergeCompatibilityRecord(baseRecord, patchRecord) {
  const nextBase = isRecord(baseRecord) ? baseRecord : {};
  const nextPatch = isRecord(patchRecord) ? patchRecord : {};
  const merged = mergeDeep(nextBase, nextPatch);
  return Object.keys(merged).length ? merged : null;
}

export function createDefaultPlayerProfile(baselineShipPlayerState = {}) {
  return {
    meta: {
      schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
      profileName: null,
      updatedAt: null,
      dataConfidence: "manual"
    },
    player: {
      loop: {
        loopReset: null
      },
      resources: {
        diamonds: null,
        tokens: null,
        academyRelics: null,
        shards: null
      }
    },
    planning: {
      shards: {
        ratePerHour: null,
        totalMilestoneLevels: null,
        focusMilestoneId: null,
        focusMilestoneLevel: null,
        observedLevelsByMilestone: {}
      }
    },
    notes: {
      profile: null
    },
    externalModels: {
      shipPlanner: {
        summary: {
          power: null,
          speed: null,
          cargo: null
        },
        communityToolState: cloneValue(baselineShipPlayerState) ?? {}
      },
      experimental: {
        gemNodes: {
          budget: null
        },
        profileHints: {
          primaryFarmingFocus: null,
          researchHours: null
        }
      },
      communityTools: {
        shipOptimizer: {},
        shardOptimizer: {},
        modTreeOptimizer: {}
      }
    },
    compatibility: {
      legacyStage: {
        highestShipUnlocked: null,
        manualPhase: null
      },
      unresolvedProfileFields: {
        gemDust: null,
        hunterLevel: null,
        traitSphereCount: null,
        mechParts: null
      },
      unmappedSystemState: {
        shardMilestoneState: null,
        shardMilestones: null,
        tokenShop: null,
        multiverseMarket: null
      }
    }
  };
}

export function normalizePlayerProfile(profile, baselineShipPlayerState = {}) {
  const source = isRecord(profile) ? profile : {};
  const normalized = createDefaultPlayerProfile(baselineShipPlayerState);

  normalized.meta.profileName = coerceNullableString(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.meta.profileName));
  normalized.meta.updatedAt = coerceNullableString(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.meta.updatedAt));
  normalized.meta.dataConfidence = coerceEnum(
    readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.meta.dataConfidence),
    PROFILE_CONFIDENCE_VALUES,
    normalized.meta.dataConfidence
  );

  normalized.player.loop.loopReset = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.canonical.loopReset));
  normalized.player.resources.diamonds = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.canonical.diamonds));
  normalized.player.resources.tokens = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.canonical.tokens));
  normalized.player.resources.academyRelics = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.canonical.academyRelics));
  normalized.player.resources.shards = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.canonical.shards));

  normalized.planning.shards.ratePerHour = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.planner.shardRatePerHour));
  normalized.planning.shards.totalMilestoneLevels = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.planner.totalShardMilestoneLevels));
  normalized.planning.shards.focusMilestoneId = coerceNullableString(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.planner.shardFocusMilestoneId));
  normalized.planning.shards.focusMilestoneLevel = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.planner.shardFocusMilestoneLevel));
  normalized.planning.shards.observedLevelsByMilestone = coerceObservedShardLevels(
    readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.planner.shardObservedLevelsByMilestone)
  );
  if (
    normalized.planning.shards.focusMilestoneId
    && normalized.planning.shards.focusMilestoneLevel !== null
    && normalized.planning.shards.observedLevelsByMilestone[normalized.planning.shards.focusMilestoneId] === undefined
  ) {
    normalized.planning.shards.observedLevelsByMilestone[normalized.planning.shards.focusMilestoneId] = normalized.planning.shards.focusMilestoneLevel;
  }

  normalized.notes.profile = coerceNullableString(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.canonical.notes));

  normalized.externalModels.shipPlanner.summary.power = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.externalModel.shipPower));
  normalized.externalModels.shipPlanner.summary.speed = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.externalModel.shipSpeed));
  normalized.externalModels.shipPlanner.summary.cargo = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.externalModel.shipCargo));

  normalized.externalModels.experimental.gemNodes.budget = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.experimental.gemNodeBudget));
  normalized.externalModels.experimental.profileHints.primaryFarmingFocus = coerceEnum(
    readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.experimental.primaryFarmingFocus),
    FARMING_FOCUS_VALUES
  );
  normalized.externalModels.experimental.profileHints.researchHours = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.experimental.researchHours));
  normalized.externalModels.communityTools = mergeDeep(
    normalized.externalModels.communityTools,
    coerceCommunityTools(source.externalModels?.communityTools)
  );

  normalized.compatibility.legacyStage.highestShipUnlocked = coerceNullableString(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.highestShipUnlocked));
  normalized.compatibility.legacyStage.manualPhase = coerceNullableString(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.manualPhase));
  normalized.compatibility.unresolvedProfileFields.gemDust = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.gemDust));
  normalized.compatibility.unresolvedProfileFields.hunterLevel = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.hunterLevel));
  normalized.compatibility.unresolvedProfileFields.traitSphereCount = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.traitSphereCount));
  normalized.compatibility.unresolvedProfileFields.mechParts = coerceNullableNumber(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.mechParts));
  normalized.compatibility.unmappedSystemState.shardMilestoneState = coerceQuarantinedShardMilestoneState(
    readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.shardMilestoneState)
  );
  normalized.compatibility.unmappedSystemState.shardMilestones = cloneValue(
    normalized.compatibility.unmappedSystemState.shardMilestoneState
  );

  const tokenShopStateAliases = Object.fromEntries(
    PLAYER_PROFILE_IMPORT_ALIASES.compatibility.tokenShopStateClues.map((path) => [path[path.length - 1], [path]])
  );
  const importedTokenShopRecord = coerceRecordOrNull(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.tokenShop));
  const importedTokenShopStateClues = collectAliasedCompatibilityFields(source, tokenShopStateAliases);
  const importedTokenShopLevels = collectTopLevelCompatibilityPattern(source, /^ATU\d+Level$/u);
  const importedTokenShopTierUnlocks = collectTopLevelCompatibilityPattern(source, /^Tier[2-5]TokensUnlocked$/u);
  normalized.compatibility.unmappedSystemState.tokenShop = mergeCompatibilityRecord(
    importedTokenShopRecord,
    mergeCompatibilityRecord(importedTokenShopStateClues, mergeCompatibilityRecord(importedTokenShopLevels, importedTokenShopTierUnlocks))
  );

  const importedMultiverseMarketRecord = coerceRecordOrNull(readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.compatibility.multiverseMarket));
  const importedMultiverseMarketStateClues = collectAliasedCompatibilityFields(source, {
    InscryptionsDone: PLAYER_PROFILE_IMPORT_ALIASES.compatibility.multiverseMarketStateClues
  });
  const importedMultiverseMarketLevels = collectTopLevelCompatibilityPattern(source, /^IS\d+Level$/u);
  normalized.compatibility.unmappedSystemState.multiverseMarket = mergeCompatibilityRecord(
    importedMultiverseMarketRecord,
    mergeCompatibilityRecord(importedMultiverseMarketStateClues, importedMultiverseMarketLevels)
  );

  const mergedShipToolState = mergeDeep(
    baselineShipPlayerState,
    mergeDeep(
      readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.shipCalibration.legacyShipPlayerState) ?? {},
      readAliasedValue(source, PLAYER_PROFILE_IMPORT_ALIASES.shipCalibration.communityToolState) ?? {}
    )
  );
  normalized.externalModels.shipPlanner.communityToolState = mergedShipToolState;
  normalized.meta.schemaVersion = PLAYER_PROFILE_SCHEMA_VERSION;

  return normalized;
}

function readAliasedValue(source, aliases) {
  return readFirst(source, aliases);
}
