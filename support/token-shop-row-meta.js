function buff(label, tone = "neutral") {
  return Object.freeze({ label, tone });
}

export const TOKEN_SHOP_ROW_META = Object.freeze({
  ATU1Level: Object.freeze({
    title: "Tokens Booster T1",
    progressionFamily: "token-chest",
    storeLane: "Chest income",
    storeBuffTargets: [buff("Tokens", "token")]
  }),
  ATU2Level: Object.freeze({
    title: "Diamonds Booster",
    progressionFamily: "diamond-chest",
    storeLane: "Diamond income",
    storeBuffTargets: [buff("Diamonds", "diamond")]
  }),
  ATU3Level: Object.freeze({
    title: "Cells Booster (Chests)",
    progressionFamily: "cells-chest",
    storeLane: "Chest cells",
    storeBuffTargets: [buff("Cells", "cells")]
  }),
  ATU4Level: Object.freeze({
    title: "Mod Points Booster",
    progressionFamily: "mod-points",
    storeLane: "Mod points",
    storeBuffTargets: [buff("Mod Points", "mod")]
  }),
  ATU5Level: Object.freeze({
    title: "Mk1 Generator Booster",
    progressionFamily: "generator-output",
    storeLane: "Generator output",
    storeBuffTargets: [buff("Mk1", "generator")]
  }),
  ATU6Level: Object.freeze({
    title: "Mk2 Generator Booster",
    progressionFamily: "generator-output",
    storeLane: "Generator output",
    storeBuffTargets: [buff("Mk2", "generator")]
  }),
  ATU7Level: Object.freeze({
    title: "Mk3 Generator Booster",
    progressionFamily: "generator-output",
    storeLane: "Generator output",
    storeBuffTargets: [buff("Mk3", "generator")]
  }),
  ATU8Level: Object.freeze({
    title: "Mk4 Generator Booster",
    progressionFamily: "generator-output",
    storeLane: "Generator output",
    storeBuffTargets: [buff("Mk4", "generator")]
  }),
  ATU9Level: Object.freeze({
    title: "Mk5 Generator Booster",
    progressionFamily: "generator-output",
    storeLane: "Generator output",
    storeBuffTargets: [buff("Mk5", "generator")]
  }),
  ATU10Level: Object.freeze({
    title: "Mk6 Generator Booster",
    progressionFamily: "generator-output",
    storeLane: "Generator output",
    storeBuffTargets: [buff("Mk6", "generator")]
  }),
  ATU11Level: Object.freeze({
    title: "Mk7 Generator Booster",
    progressionFamily: "generator-output",
    storeLane: "Generator output",
    storeBuffTargets: [buff("Mk7", "generator")]
  }),
  ATU12Level: Object.freeze({
    title: "Mk8 Generator Booster",
    progressionFamily: "generator-output",
    storeLane: "Generator output",
    storeBuffTargets: [buff("Mk8", "generator")]
  }),
  ATU13Level: Object.freeze({
    title: "Tokens Booster T2",
    progressionFamily: "token-chest",
    storeLane: "Chest income",
    storeBuffTargets: [buff("Tokens", "token")]
  }),
  ATU14Level: Object.freeze({
    title: "Daily Tokens T2",
    progressionFamily: "daily-tokenium",
    storeLane: "Daily Tokenium",
    storeBuffTargets: [buff("Daily Tokens", "token")]
  }),
  ATU15Level: Object.freeze({
    title: "Duo Booster One",
    progressionFamily: "duo-booster",
    storeLane: "Duo chain",
    storeEffectText: "x1.02 to Tokens Gained & Diamonds Gained.",
    storeBuffTargets: [buff("Tokens", "token"), buff("Diamonds", "diamond")]
  }),
  ATU16Level: Object.freeze({
    title: "Duo Booster Two",
    progressionFamily: "duo-booster",
    storeLane: "Duo chain",
    storeEffectText: "x1.02 to Mk1 Output & Mk2 Output.",
    storeBuffTargets: [buff("Mk1", "generator"), buff("Mk2", "generator")]
  }),
  ATU17Level: Object.freeze({
    title: "Duo Booster Three",
    progressionFamily: "duo-booster",
    storeLane: "Duo chain",
    storeEffectText: "x1.02 to Mk3 Output & Mk4 Output.",
    storeBuffTargets: [buff("Mk3", "generator"), buff("Mk4", "generator")]
  }),
  ATU18Level: Object.freeze({
    title: "Duo Booster Four",
    progressionFamily: "duo-booster",
    storeLane: "Duo chain",
    storeEffectText: "x1.02 to Mk5 Output & Mk6 Output.",
    storeBuffTargets: [buff("Mk5", "generator"), buff("Mk6", "generator")]
  }),
  ATU19Level: Object.freeze({
    title: "Duo Booster Five",
    progressionFamily: "duo-booster",
    storeLane: "Duo chain",
    storeEffectText: "x1.02 to Mk7 Output & Mk8 Output.",
    storeBuffTargets: [buff("Mk7", "generator"), buff("Mk8", "generator")]
  }),
  ATU20Level: Object.freeze({
    title: "Tokens Booster T3",
    progressionFamily: "token-chest",
    storeLane: "Chest income",
    storeBuffTargets: [buff("Tokens", "token")]
  }),
  ATU21Level: Object.freeze({
    title: "Daily Tokens T3",
    progressionFamily: "daily-tokenium",
    storeLane: "Daily Tokenium",
    storeBuffTargets: [buff("Daily Tokens", "token")]
  }),
  ATU22Level: Object.freeze({
    title: "Trinity Booster One",
    progressionFamily: "trinity-booster",
    storeLane: "Trinity chain",
    storeEffectText: "x1.03 to All Generators Output, MP Gained & RP Gained.",
    storeBuffTargets: [buff("Output", "generator"), buff("MP", "mod"), buff("RP", "rp")]
  }),
  ATU23Level: Object.freeze({
    title: "Trinity Booster Two",
    progressionFamily: "trinity-booster",
    storeLane: "Trinity chain",
    storeEffectText: "x1.03 to All Generators Output, Shards Gained & AP Gained.",
    storeBuffTargets: [buff("Output", "generator"), buff("Shards", "shard"), buff("AP", "ap")]
  }),
  ATU24Level: Object.freeze({
    title: "Token Ultima",
    progressionFamily: "late-ultima",
    storeLane: "Late shelf",
    storeShell: "late-shelf",
    storeEffectText:
      "Every level in any token upgrade provides a boost to Cells, MP, Shards, RP, and AP.",
    storeBuffTargets: [
      buff("Cells", "cells"),
      buff("MP", "mod"),
      buff("Shards", "shard"),
      buff("RP", "rp"),
      buff("AP", "ap")
    ],
    unresolvedBuffLane: true
  }),
  ATU25Level: Object.freeze({
    title: "Daily Tokens T4",
    progressionFamily: "late-ultima",
    storeLane: "Late shelf",
    storeShell: "late-shelf",
    storeEffectText: "+50% to Tokens Gained from Daily Rewards & Events (additive).",
    storeBuffTargets: [buff("Daily Tokens", "token")]
  }),
  ATU26Level: Object.freeze({
    title: "Tier 1 Max Level Increaser",
    progressionFamily: "late-ultima",
    storeLane: "Late shelf",
    storeShell: "late-shelf",
    storeEffectText: "+1000 Max Levels to Tier 1 Upgrades.",
    storeBuffTargets: [buff("Tier 1 Max", "uplift")]
  }),
  ATU27Level: Object.freeze({
    title: "Tier 2 Max Level Increaser",
    progressionFamily: "late-ultima",
    storeLane: "Late shelf",
    storeShell: "late-shelf",
    storeEffectText: "+500 Max Levels to Tier 2 Upgrades.",
    storeBuffTargets: [buff("Tier 2 Max", "uplift")]
  }),
  ATU28Level: Object.freeze({
    title: "Tier 3 Max Level Increaser",
    progressionFamily: "late-ultima",
    storeLane: "Late shelf",
    storeShell: "late-shelf",
    storeEffectText: "+250 Max Levels to Tier 3 Upgrades.",
    storeBuffTargets: [buff("Tier 3 Max", "uplift")]
  })
});

export function getTokenShopRowMeta(fieldName) {
  return TOKEN_SHOP_ROW_META[String(fieldName || "").trim()] || null;
}

export function getTokenShopRowTitle(fieldName, fallback = "TokenShop row") {
  return getTokenShopRowMeta(fieldName)?.title || fallback;
}
