export const PLAYER_PROFILE_SCHEMA_VERSION = 2;

export function createDefaultPlayerProfile() {
  return {
    meta: {
      schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
      profileName: null,
      updatedAt: null,
      dataConfidence: "manual"
    },
    player: {
      resources: {
        gems: null,
        tokens: null,
        relics: null,
        gemDust: null,
        shards: null
      },
      loop: {
        loopReset: null
      },
      ship: {
        power: null,
        speed: null,
        cargo: null
      },
      deferred: {
        stage: {
          highestShipUnlocked: null,
          manualPhase: null
        },
        metaProgression: {
          hunterLevel: null,
          traitSphereCount: null,
          mechParts: null
        }
      }
    },
    planning: {
      resourceFocus: null,
      gemNodeBudget: null,
      shardRatePerHour: null,
      compatibility: {
        researchHours: null
      }
    },
    notes: {
      profile: null
    },
    externalModels: {
      shipPlanner: {
        communityToolState: {}
      }
    }
  };
}

export function createDefaultShipPlayerState(baseline) {
  return {
    academyGears: { ...baseline.academyGears },
    innovation: {
      inno1: baseline.innovation.inno1,
      inno2: baseline.innovation.inno2,
      darkInno: baseline.innovation.darkInno,
      softCap: Boolean(baseline.innovation.softCap)
    },
    generators: { ...baseline.calibration.generators },
    techLevels: { ...baseline.calibration.techLevels },
    zagreus: { ...baseline.calibration.zagreus },
    hephaestus: { ...baseline.calibration.hephaestus },
    demeter: { ...baseline.calibration.demeter },
    koios: { ...baseline.calibration.koios },
    zeus: { ...baseline.calibration.zeus },
    crew: { ...baseline.calibration.crew },
    technical: { ...baseline.calibration.technical }
  };
}

export function normalizePlayerProfile(profile, baselineShipPlayerState) {
  const defaults = createDefaultPlayerProfile();
  const source = isRecord(profile) ? profile : {};
  const normalized = createDefaultPlayerProfile();

  normalized.meta.profileName = pickFirst(
    source.meta?.profileName,
    source.profileName,
    defaults.meta.profileName
  );
  normalized.meta.updatedAt = pickFirst(
    source.meta?.updatedAt,
    defaults.meta.updatedAt
  );
  normalized.meta.dataConfidence = pickFirst(
    source.meta?.dataConfidence,
    source.confidence,
    source.automationConfidence,
    defaults.meta.dataConfidence
  );

  normalized.player.resources.gems = normalizeNullableNumber(
    pickFirst(source.player?.resources?.gems, source.resources?.gems, source.gems)
  );
  normalized.player.resources.tokens = normalizeNullableNumber(
    pickFirst(source.player?.resources?.tokens, source.resources?.tokens, source.tokens)
  );
  normalized.player.resources.relics = normalizeNullableNumber(
    pickFirst(source.player?.resources?.relics, source.resources?.relics, source.relics)
  );
  normalized.player.resources.gemDust = normalizeNullableNumber(
    pickFirst(source.player?.resources?.gemDust, source.resources?.gemDust, source.gemDust)
  );
  normalized.player.resources.shards = normalizeNullableNumber(
    pickFirst(source.player?.resources?.shards, source.resources?.shards, source.shards)
  );

  normalized.player.loop.loopReset = normalizeNullableNumber(
    pickFirst(source.player?.loop?.loopReset, source.systems?.loop?.loopReset, source.loopReset)
  );

  normalized.player.ship.power = normalizeNullableNumber(
    pickFirst(source.player?.ship?.power, source.systems?.ship?.power, source.power)
  );
  normalized.player.ship.speed = normalizeNullableNumber(
    pickFirst(source.player?.ship?.speed, source.systems?.ship?.speed, source.speed)
  );
  normalized.player.ship.cargo = normalizeNullableNumber(
    pickFirst(source.player?.ship?.cargo, source.systems?.ship?.cargo, source.cargo)
  );

  normalized.player.deferred.stage.highestShipUnlocked = pickFirst(
    source.player?.deferred?.stage?.highestShipUnlocked,
    source.stage?.highestShipUnlocked,
    defaults.player.deferred.stage.highestShipUnlocked
  );
  normalized.player.deferred.stage.manualPhase = pickFirst(
    source.player?.deferred?.stage?.manualPhase,
    source.stage?.manualPhase,
    defaults.player.deferred.stage.manualPhase
  );
  normalized.player.deferred.metaProgression.hunterLevel = normalizeNullableNumber(
    pickFirst(
      source.player?.deferred?.metaProgression?.hunterLevel,
      source.systems?.metaProgression?.hunterLevel,
      source.hunterLevel
    )
  );
  normalized.player.deferred.metaProgression.traitSphereCount = normalizeNullableNumber(
    pickFirst(
      source.player?.deferred?.metaProgression?.traitSphereCount,
      source.systems?.metaProgression?.traitSphereCount,
      source.traitSphereCount
    )
  );
  normalized.player.deferred.metaProgression.mechParts = normalizeNullableNumber(
    pickFirst(
      source.player?.deferred?.metaProgression?.mechParts,
      source.systems?.metaProgression?.mechParts,
      source.mechParts
    )
  );

  normalized.planning.resourceFocus = pickFirst(
    source.planning?.resourceFocus,
    source.resourceFocus,
    defaults.planning.resourceFocus
  );
  normalized.planning.gemNodeBudget = normalizeNullableNumber(
    pickFirst(source.planning?.gemNodeBudget, source.gemNodeBudget)
  );
  normalized.planning.shardRatePerHour = normalizeNullableNumber(
    pickFirst(source.planning?.shardRatePerHour, source.systems?.shards?.ratePerHour, source.shardRatePerHour)
  );
  normalized.planning.compatibility.researchHours = normalizeNullableNumber(
    pickFirst(
      source.planning?.compatibility?.researchHours,
      source.planning?.researchHours,
      source.researchHours
    )
  );

  normalized.notes.profile = pickFirst(
    source.notes?.profile,
    typeof source.notes === "string" ? source.notes : undefined,
    source.profileNotes,
    defaults.notes.profile
  );

  const baselineState = isRecord(baselineShipPlayerState) ? baselineShipPlayerState : {};
  normalized.externalModels.shipPlanner.communityToolState = mergeDeep(
    baselineState,
    mergeDeep(
      source.systems?.ship?.playerState ?? {},
      source.externalModels?.shipPlanner?.communityToolState ?? {}
    )
  );

  return normalized;
}

function pickFirst(...values) {
  return values.find((value) => value !== undefined);
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(base, patch) {
  const output = structuredClone(base ?? {});
  Object.entries(patch ?? {}).forEach(([key, value]) => {
    if (isRecord(value) && isRecord(output[key])) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = structuredClone(value);
    }
  });
  return output;
}
