export const PLAYER_PROFILE_SCHEMA_VERSION = 2;

const PROFILE_CONFIDENCE_VALUES = new Set(["manual", "mixed", "verified"]);
const FARMING_FOCUS_VALUES = new Set(["credits", "alloy", "research", "shards"]);

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

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
        ratePerHour: null
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
      }
    }
  };
}

export function normalizePlayerProfile(profile, baselineShipPlayerState = {}) {
  const source = isRecord(profile) ? profile : {};
  const normalized = createDefaultPlayerProfile(baselineShipPlayerState);

  normalized.meta.profileName = coerceNullableString(readFirst(source, [
    ["meta", "profileName"],
    ["profileName"]
  ]));
  normalized.meta.updatedAt = coerceNullableString(readFirst(source, [
    ["meta", "updatedAt"]
  ]));
  normalized.meta.dataConfidence = coerceEnum(
    readFirst(source, [
      ["meta", "dataConfidence"],
      ["confidence"],
      ["automationConfidence"]
    ]),
    PROFILE_CONFIDENCE_VALUES,
    normalized.meta.dataConfidence
  );

  normalized.player.loop.loopReset = coerceNullableNumber(readFirst(source, [
    ["player", "loop", "loopReset"],
    ["systems", "loop", "loopReset"],
    ["loopReset"]
  ]));

  normalized.player.resources.diamonds = coerceNullableNumber(readFirst(source, [
    ["player", "resources", "diamonds"],
    ["resources", "diamonds"],
    ["resources", "gems"],
    ["gems"]
  ]));
  normalized.player.resources.tokens = coerceNullableNumber(readFirst(source, [
    ["player", "resources", "tokens"],
    ["resources", "tokens"],
    ["tokens"]
  ]));
  normalized.player.resources.academyRelics = coerceNullableNumber(readFirst(source, [
    ["player", "resources", "academyRelics"],
    ["resources", "academyRelics"],
    ["resources", "relics"],
    ["relics"]
  ]));
  normalized.player.resources.shards = coerceNullableNumber(readFirst(source, [
    ["player", "resources", "shards"],
    ["resources", "shards"],
    ["shards"]
  ]));

  normalized.planning.shards.ratePerHour = coerceNullableNumber(readFirst(source, [
    ["planning", "shards", "ratePerHour"],
    ["systems", "shards", "ratePerHour"],
    ["shardRatePerHour"]
  ]));

  normalized.notes.profile = coerceNullableString(readFirst(source, [
    ["notes", "profile"],
    ["notes"]
  ]));

  normalized.externalModels.shipPlanner.summary.power = coerceNullableNumber(readFirst(source, [
    ["externalModels", "shipPlanner", "summary", "power"],
    ["systems", "ship", "power"],
    ["power"]
  ]));
  normalized.externalModels.shipPlanner.summary.speed = coerceNullableNumber(readFirst(source, [
    ["externalModels", "shipPlanner", "summary", "speed"],
    ["systems", "ship", "speed"],
    ["speed"]
  ]));
  normalized.externalModels.shipPlanner.summary.cargo = coerceNullableNumber(readFirst(source, [
    ["externalModels", "shipPlanner", "summary", "cargo"],
    ["systems", "ship", "cargo"],
    ["cargo"]
  ]));

  normalized.externalModels.experimental.gemNodes.budget = coerceNullableNumber(readFirst(source, [
    ["externalModels", "experimental", "gemNodes", "budget"],
    ["planning", "gemNodeBudget"],
    ["gemNodeBudget"]
  ]));
  normalized.externalModels.experimental.profileHints.primaryFarmingFocus = coerceEnum(readFirst(source, [
    ["externalModels", "experimental", "profileHints", "primaryFarmingFocus"],
    ["planning", "resourceFocus"],
    ["resourceFocus"]
  ]), FARMING_FOCUS_VALUES);
  normalized.externalModels.experimental.profileHints.researchHours = coerceNullableNumber(readFirst(source, [
    ["externalModels", "experimental", "profileHints", "researchHours"],
    ["planning", "researchHours"],
    ["researchHours"]
  ]));

  normalized.compatibility.legacyStage.highestShipUnlocked = coerceNullableString(readFirst(source, [
    ["compatibility", "legacyStage", "highestShipUnlocked"],
    ["stage", "highestShipUnlocked"]
  ]));
  normalized.compatibility.legacyStage.manualPhase = coerceNullableString(readFirst(source, [
    ["compatibility", "legacyStage", "manualPhase"],
    ["stage", "manualPhase"]
  ]));
  normalized.compatibility.unresolvedProfileFields.gemDust = coerceNullableNumber(readFirst(source, [
    ["compatibility", "unresolvedProfileFields", "gemDust"],
    ["resources", "gemDust"],
    ["gemDust"]
  ]));
  normalized.compatibility.unresolvedProfileFields.hunterLevel = coerceNullableNumber(readFirst(source, [
    ["compatibility", "unresolvedProfileFields", "hunterLevel"],
    ["systems", "metaProgression", "hunterLevel"],
    ["hunterLevel"]
  ]));
  normalized.compatibility.unresolvedProfileFields.traitSphereCount = coerceNullableNumber(readFirst(source, [
    ["compatibility", "unresolvedProfileFields", "traitSphereCount"],
    ["systems", "metaProgression", "traitSphereCount"],
    ["traitSphereCount"]
  ]));
  normalized.compatibility.unresolvedProfileFields.mechParts = coerceNullableNumber(readFirst(source, [
    ["compatibility", "unresolvedProfileFields", "mechParts"],
    ["systems", "metaProgression", "mechParts"],
    ["mechParts"]
  ]));

  const mergedShipToolState = mergeDeep(
    baselineShipPlayerState,
    mergeDeep(
      readFirst(source, [
        ["systems", "ship", "playerState"]
      ]) ?? {},
      readFirst(source, [
        ["externalModels", "shipPlanner", "communityToolState"]
      ]) ?? {}
    )
  );
  normalized.externalModels.shipPlanner.communityToolState = mergedShipToolState;
  normalized.meta.schemaVersion = PLAYER_PROFILE_SCHEMA_VERSION;

  return normalized;
}
