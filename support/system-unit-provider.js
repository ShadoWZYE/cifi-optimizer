const SYSTEM_UNIT_IDS = ["app-meta", "player-state", "shards", "token-shop", "multiverse-market"];

const STATIC_SYSTEM_UNIT_URLS = Object.freeze({
  "app-meta": "./data/system-units/app-meta.v1.json",
  "player-state": "./data/system-units/player-state.v1.json",
  shards: "./data/system-units/shards.v1.json",
  "token-shop": "./data/system-units/token-shop.v1.json",
  "multiverse-market": "./data/system-units/multiverse-market.v1.json"
});

function shouldUseDbSystemUnitApi(origin, serverCapabilities) {
  return String(origin || "").startsWith("http") && serverCapabilities?.systemUnitApi === true;
}

function shouldAllowStaticFallback(origin, serverCapabilities, allowStaticFallback) {
  if (typeof allowStaticFallback === "boolean") {
    return allowStaticFallback;
  }
  return !shouldUseDbSystemUnitApi(origin, serverCapabilities);
}

async function loadStaticSystemUnits(fetchJson) {
  const [appMeta, playerState, shards, tokenShop, multiverseMarket] = await Promise.all(
    SYSTEM_UNIT_IDS.map((systemId) => fetchJson(STATIC_SYSTEM_UNIT_URLS[systemId]))
  );
  return {
    mode: "static-export",
    source: "data/system-units",
    units: {
      appMeta,
      playerState,
      shards,
      tokenShop,
      multiverseMarket
    }
  };
}

export async function loadSystemUnits({
  fetchJson,
  origin,
  serverCapabilities,
  allowStaticFallback
}) {
  if (shouldUseDbSystemUnitApi(origin, serverCapabilities)) {
    try {
      const query = new URLSearchParams({ ids: SYSTEM_UNIT_IDS.join(",") });
      const payload = await fetchJson(`/api/system-units?${query.toString()}`);
      return {
        mode: "db",
        source: "materialized_system_unit_views",
        builtAt: payload?.builtAt ?? null,
        units: {
          appMeta: payload?.units?.["app-meta"] ?? null,
          playerState: payload?.units?.["player-state"] ?? null,
          shards: payload?.units?.shards ?? null,
          tokenShop: payload?.units?.["token-shop"] ?? null,
          multiverseMarket: payload?.units?.["multiverse-market"] ?? null
        }
      };
    } catch (error) {
      if (!shouldAllowStaticFallback(origin, serverCapabilities, allowStaticFallback)) {
        throw new Error(
          "DB-backed system-unit load failed while the local server advertised the DB runtime path.",
          { cause: error }
        );
      }
      console.warn(
        "Falling back to static system-unit exports after DB-backed load failed.",
        error
      );
    }
  }

  return loadStaticSystemUnits(fetchJson);
}
