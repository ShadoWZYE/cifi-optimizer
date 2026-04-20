const SYSTEM_UNIT_IDS = ["player-state", "shards", "token-shop", "multiverse-market"];

const STATIC_SYSTEM_UNIT_URLS = Object.freeze({
  "player-state": "./data/system-units/player-state.v1.json",
  shards: "./data/system-units/shards.v1.json",
  "token-shop": "./data/system-units/token-shop.v1.json",
  "multiverse-market": "./data/system-units/multiverse-market.v1.json"
});

function shouldUseDbSystemUnitApi(origin, serverCapabilities) {
  return String(origin || "").startsWith("http") && serverCapabilities?.systemUnitApi === true;
}

async function loadStaticSystemUnits(fetchJson) {
  const [playerState, shards, tokenShop, multiverseMarket] = await Promise.all(
    SYSTEM_UNIT_IDS.map((systemId) => fetchJson(STATIC_SYSTEM_UNIT_URLS[systemId]))
  );
  return {
    mode: "static-export",
    source: "data/system-units",
    units: {
      playerState,
      shards,
      tokenShop,
      multiverseMarket
    }
  };
}

export async function loadSystemUnits({ fetchJson, origin, serverCapabilities }) {
  if (shouldUseDbSystemUnitApi(origin, serverCapabilities)) {
    try {
      const query = new URLSearchParams({ ids: SYSTEM_UNIT_IDS.join(",") });
      const payload = await fetchJson(`/api/system-units?${query.toString()}`);
      return {
        mode: "db",
        source: "materialized_system_unit_views",
        builtAt: payload?.builtAt ?? null,
        units: {
          playerState: payload?.units?.["player-state"] ?? null,
          shards: payload?.units?.shards ?? null,
          tokenShop: payload?.units?.["token-shop"] ?? null,
          multiverseMarket: payload?.units?.["multiverse-market"] ?? null
        }
      };
    } catch (error) {
      console.warn("Falling back to static system-unit exports after DB-backed load failed.", error);
    }
  }

  return loadStaticSystemUnits(fetchJson);
}
