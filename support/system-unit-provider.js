export const SYSTEM_UNIT_IDS = ["app-meta", "player-state", "shards", "token-shop", "multiverse-market"];

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

async function loadStaticSystemUnits(fetchJson, systemIds = SYSTEM_UNIT_IDS) {
  const entries = await Promise.all(
    systemIds.map(async (systemId) => [systemId, await fetchJson(STATIC_SYSTEM_UNIT_URLS[systemId])])
  );
  const unitsById = Object.fromEntries(entries);
  return {
    mode: "static-export",
    source: "data/system-units",
    units: {
      appMeta: unitsById["app-meta"] ?? null,
      playerState: unitsById["player-state"] ?? null,
      shards: unitsById.shards ?? null,
      tokenShop: unitsById["token-shop"] ?? null,
      multiverseMarket: unitsById["multiverse-market"] ?? null
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
  systemIds = SYSTEM_UNIT_IDS,
  systemDbScopes = {},
  tokenShopDbScopes = {},
  subjectContractScopes = {},
  genericMechanicsScopes = {}
}) {
  const requestedSystemIds = Array.from(
    new Set(
      (Array.isArray(systemIds) && systemIds.length ? systemIds : SYSTEM_UNIT_IDS).filter(Boolean)
    )
  );
  if (shouldUseDbSystemUnitApi(origin, serverCapabilities)) {
    try {
      const query = new URLSearchParams({ ids: requestedSystemIds.join(",") });
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
        systemDbBuiltAt: {
          tokenShop: resolvedTokenShopBundle?.builtAt ?? null,
          shards: shardSystemDbBundle?.builtAt ?? null,
          multiverseMarket: multiverseMarketSystemDbBundle?.builtAt ?? null
        },
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
          appMeta: requestedSystemIds.includes("app-meta")
            ? payload?.units?.["app-meta"] ?? null
            : null,
          playerState: requestedSystemIds.includes("player-state")
            ? payload?.units?.["player-state"] ?? null
            : null,
          shards: requestedSystemIds.includes("shards")
            ? payload?.units?.shards ?? null
            : null,
          tokenShop: requestedSystemIds.includes("token-shop")
            ? payload?.units?.["token-shop"] ?? null
            : null,
          multiverseMarket: requestedSystemIds.includes("multiverse-market")
            ? payload?.units?.["multiverse-market"] ?? null
            : null
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

  const staticPayload = await loadStaticSystemUnits(fetchJson, requestedSystemIds);
  return {
    ...staticPayload,
    systemDbBuiltAt: {
      tokenShop: null,
      shards: null,
      multiverseMarket: null
    },
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
