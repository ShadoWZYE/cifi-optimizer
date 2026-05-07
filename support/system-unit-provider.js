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

function shouldUseDbSystemBundleApi(origin, serverCapabilities) {
  return String(origin || "").startsWith("http") && serverCapabilities?.systemDbBundleApi === true;
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

async function loadDbSystemBundle(fetchJson, systemId, scopes) {
  if (!scopes.length) {
    return {
      subjectMetadata: null,
      genericMechanics: null
    };
  }
  const query = new URLSearchParams({
    systemId,
    scopes: scopes.join(","),
    mode: "core"
  });
  return fetchJson(`/api/system-db?${query.toString()}`);
}

function getResolvedSystemDbScopes(systemDbScopes = {}, tokenShopDbScopes = {}) {
  const resolved = {};
  for (const [systemId, scopes] of Object.entries(systemDbScopes)) {
    if (Array.isArray(scopes) && scopes.length) {
      resolved[systemId] = Array.from(new Set(scopes.filter(Boolean)));
    }
  }
  for (const [systemId, scopes] of Object.entries(tokenShopDbScopes)) {
    if (!resolved[systemId] && Array.isArray(scopes) && scopes.length) {
      resolved[systemId] = Array.from(new Set(scopes.filter(Boolean)));
    }
  }
  return resolved;
}

export async function loadSystemUnits({
  fetchJson,
  origin,
  serverCapabilities,
  allowStaticFallback,
  systemDbScopes = {},
  tokenShopDbScopes = {},
  subjectContractScopes = {},
  genericMechanicsScopes = {}
}) {
  if (shouldUseDbSystemUnitApi(origin, serverCapabilities)) {
    try {
      const query = new URLSearchParams({ ids: SYSTEM_UNIT_IDS.join(",") });
      const useGenericSystemDbBundleApi = shouldUseDbSystemBundleApi(origin, serverCapabilities);
      const resolvedSystemDbScopes = getResolvedSystemDbScopes(systemDbScopes, tokenShopDbScopes);
      const tokenShopScopes =
        resolvedSystemDbScopes.tokenShop ??
        Array.from(
          new Set([
            ...(Array.isArray(subjectContractScopes?.tokenShop) ? subjectContractScopes.tokenShop : []),
            ...(Array.isArray(genericMechanicsScopes?.tokenShop) ? genericMechanicsScopes.tokenShop : [])
          ].filter(Boolean))
        );
      const multiverseMarketScopes = resolvedSystemDbScopes.multiverseMarket ?? [];
      const shardScopes = resolvedSystemDbScopes.shards ?? [];
      const [
        payload,
        tokenShopSystemDbBundle,
        multiverseMarketSystemDbBundle,
        shardSystemDbBundle
      ] = await Promise.all([
        fetchJson(`/api/system-units?${query.toString()}`),
        useGenericSystemDbBundleApi
          ? loadDbSystemBundle(fetchJson, "token-shop", tokenShopScopes).catch(() => null)
          : Promise.resolve(null),
        useGenericSystemDbBundleApi
          ? loadDbSystemBundle(
              fetchJson,
              "multiverse-market",
              multiverseMarketScopes
            ).catch(() => null)
          : Promise.resolve(null),
        useGenericSystemDbBundleApi
          ? loadDbSystemBundle(fetchJson, "shards", shardScopes).catch(() => null)
          : Promise.resolve(null)
      ]);
      const resolvedTokenShopBundle = tokenShopSystemDbBundle;
      return {
        mode: "db",
        source: "materialized_system_unit_views",
        builtAt: payload?.builtAt ?? null,
        systemDb: {
          tokenShop: {
            subjectMetadata:
              resolvedTokenShopBundle?.subjectMetadata ?? null,
            genericMechanics:
              resolvedTokenShopBundle?.genericMechanics ?? null
          },
          shards: {
            subjectMetadata: shardSystemDbBundle?.subjectMetadata ?? null,
            genericMechanics: shardSystemDbBundle?.genericMechanics ?? null
          },
          multiverseMarket: {
            subjectMetadata:
              multiverseMarketSystemDbBundle?.subjectMetadata ?? null,
            genericMechanics: multiverseMarketSystemDbBundle?.genericMechanics ?? null
          }
        },
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

  const staticPayload = await loadStaticSystemUnits(fetchJson);
  return {
    ...staticPayload,
    systemDb: {
      tokenShop: {
        subjectMetadata: null,
        genericMechanics: null
      },
      shards: {
        subjectMetadata: null,
        genericMechanics: null
      },
      multiverseMarket: {
        subjectMetadata: null,
        genericMechanics: null
      }
    }
  };
}
