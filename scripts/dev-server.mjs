import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { cwd, execPath } from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import {
  createGeneratorOcrStageError,
  createMissingGeneratorOcrScriptError,
  resolveGeneratorOcrScriptPath
} from "./ocr/generator-ocr-support.mjs";

const root = cwd();
const port = Number(process.env.PORT || 4173);
const cacheDbPath = join(root, "workbench", "ghidra-cache", "ghidra_cache.sqlite3");
const appStateDbPath = process.env.CIFI_APP_STATE_DB_PATH
  ? normalize(process.env.CIFI_APP_STATE_DB_PATH)
  : join(root, "workbench", "app-state.sqlite3");
const systemUnitsDir = join(root, "data", "system-units");
const launcherMode =
  process.env.CIFI_LAUNCH_MODE === "1" || process.argv.includes("--launcher-mode");
const servedSystemUnitIds = ["app-meta", "player-state", "shards", "token-shop", "multiverse-market"];
const clientLeaseTtlMs = 60000;
const launcherIdleCheckMs = 2000;
const clientSessions = new Map();
let launcherSignalSequence = 0;
let launcherSawClient = false;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};
const serverCapabilitiesScript = `<script>window.__CIFI_SERVER_CAPABILITIES__ = ${JSON.stringify({
  sessionApi: true,
  launcherMode,
  systemUnitApi: true,
  systemUnitRefreshApi: true,
  systemDbBundleApi: true,
  traceGapApi: true,
  serverControlApi: true,
  playerProfileApi: true
})};</script>`;
const traceGapLogLimit = 240;
let traceGapRun = createTraceGapRunState();
const traceGapStreams = new Set();

const server = createServer(async (request, response) => {
  const requestUrl = new URL(
    request.url || "/",
    `http://${request.headers.host || `localhost:${port}`}`
  );

  if (request.method === "GET" && requestUrl.pathname === "/api/healthz") {
    writeJson(response, 200, {
      ok: true,
      port,
      launcherMode,
      clientCount: getActiveClientCount(),
      launchSignalSequence: launcherSignalSequence
    });
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/client/open") {
    await handleClientSessionTouch(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/client/heartbeat") {
    await handleClientSessionTouch(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/client/events") {
    handleClientEvents(request, response, requestUrl);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/client/close") {
    await handleClientSessionClose(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/launcher/reopen") {
    handleLauncherReopen(response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/generator-ocr") {
    await handleGeneratorOcr(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/system-units") {
    handleSystemUnits(response, requestUrl);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/system-units/refresh") {
    await handleSystemUnitsRefresh(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/player-profile") {
    handlePlayerProfileGet(response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/player-profile") {
    await handlePlayerProfileUpsert(request, response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/token-shop-db") {
    handleTokenShopDb(response, requestUrl);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/system-db") {
    handleSystemDb(response, requestUrl);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/subject-metadata") {
    handleSubjectMetadata(response, requestUrl);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/generic-mechanics") {
    handleGenericMechanics(response, requestUrl);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/trace-gap/status") {
    handleTraceGapStatus(response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/trace-gap/events") {
    handleTraceGapEvents(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/trace-gap/run") {
    await handleTraceGapRun(request, response);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/trace-gap/stop") {
    handleTraceGapStop(response);
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/trace-gap/overview") {
    handleTraceGapOverview(response, requestUrl);
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/server/restart") {
    handleServerRestart(response);
    return;
  }

  const urlPath = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  try {
    let body = await readFile(filePath);
    if (extname(filePath) === ".html") {
      body = Buffer.from(
        body
          .toString("utf8")
          .replace(
            /<script>\s*window\.__CIFI_SERVER_CAPABILITIES__\s*=\s*\{[\s\S]*?\};\s*<\/script>/,
            serverCapabilitiesScript
          ),
        "utf8"
      );
    }
    const contentType = mimeTypes[extname(filePath)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

async function handleGeneratorOcr(request, response) {
  try {
    const payload = await readJsonBody(request);
    const images = Array.isArray(payload?.images) ? payload.images : [];
    if (!images.length) {
      writeJson(response, 400, { error: "No images were provided for OCR." });
      return;
    }

    const tempDir = await mkdtemp(join(tmpdir(), "cifi-generator-ocr-"));
    const imagePaths = [];

    try {
      for (const [index, image] of images.entries()) {
        const extension = getImageExtension(image.type, image.name, index);
        const filename = sanitizeFileName(image.name || `generator-${index + 1}${extension}`);
        const filePath = join(
          tempDir,
          filename.endsWith(extension) ? filename : `${filename}${extension}`
        );
        const base64 = String(image.data || "").replace(/^data:[^;]+;base64,/, "");
        await writeFile(filePath, Buffer.from(base64, "base64"));
        imagePaths.push(filePath);
      }

      const { resolvedPath: scriptPath } = resolveGeneratorOcrScriptPath(root);
      if (!scriptPath) {
        writeJson(response, 500, createMissingGeneratorOcrScriptError(root));
        return;
      }

      let result;
      try {
        result = await runProcess("powershell", [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          scriptPath,
          ...imagePaths
        ]);
      } catch (error) {
        writeJson(
          response,
          500,
          createGeneratorOcrStageError(
            detectOcrFailureStage(
              `${error?.message || ""}\n${error?.stderr || ""}\n${error?.stdout || ""}`
            ),
            error,
            error
          )
        );
        return;
      }

      if (result.stderr && /python|pytesseract|cv2|numpy|tesseract/i.test(result.stderr)) {
        writeJson(
          response,
          500,
          createGeneratorOcrStageError(
            detectOcrFailureStage(result.stderr),
            new Error("OCR tooling failed before JSON output."),
            result
          )
        );
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(result.stdout || "{}");
      } catch {
        writeJson(
          response,
          500,
          createGeneratorOcrStageError(
            "powershell",
            new Error("OCR script returned invalid JSON."),
            result
          )
        );
        return;
      }

      if (parsed && typeof parsed === "object" && parsed.error) {
        writeJson(
          response,
          500,
          createGeneratorOcrStageError(
            detectOcrFailureStage(`${parsed.error}\n${result.stderr}\n${result.stdout}`),
            new Error(String(parsed.error)),
            result
          )
        );
        return;
      }

      writeJson(response, 200, parsed);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    writeJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

function withCacheDb(fn) {
  const db = new DatabaseSync(cacheDbPath);
  db.exec("PRAGMA busy_timeout=30000");
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function withAppStateDb(fn) {
  const db = new DatabaseSync(appStateDbPath);
  db.exec("PRAGMA busy_timeout=30000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_profiles (
      profile_id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      source_label TEXT NOT NULL DEFAULT 'app'
    );
  `);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function loadSystemUnitSnapshots(systemIds) {
  const units = {};
  const missing = [];
  let latestGeneratedAt = null;

  for (const systemId of systemIds) {
    const snapshotPath = join(systemUnitsDir, `${systemId}.v1.json`);
    if (!existsSync(snapshotPath)) {
      missing.push(systemId);
      continue;
    }

    const payload = JSON.parse(readFileSync(snapshotPath, "utf8"));
    units[systemId] = payload;
    if (!latestGeneratedAt || String(payload.generatedAt) > latestGeneratedAt) {
      latestGeneratedAt = String(payload.generatedAt);
    }
  }

  return { units, missing, builtAt: latestGeneratedAt };
}

function handleSystemUnits(response, requestUrl) {
  const requestedIds = String(requestUrl.searchParams.get("ids") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const systemIds = requestedIds.length
    ? requestedIds
    : servedSystemUnitIds;
  const loadFromDb = () =>
    withCacheDb((db) => {
      const statement = db.prepare(`
        SELECT system_id, version, payload_json, provenance_json, reducer_version, built_at, exported_path
        FROM materialized_system_unit_views
        WHERE system_id = ? AND version = 'v1'
      `);
      const units = {};
      const missing = [];
      let latestBuiltAt = null;
      for (const systemId of systemIds) {
        const row = statement.get(systemId);
        if (!row) {
          missing.push(systemId);
          continue;
        }
        units[systemId] = JSON.parse(row.payload_json);
        if (!latestBuiltAt || String(row.built_at) > latestBuiltAt) {
          latestBuiltAt = String(row.built_at);
        }
      }
      return { units, missing, builtAt: latestBuiltAt };
    });

  const loadFromSnapshots = () => loadSystemUnitSnapshots(systemIds);

  try {
    if (existsSync(cacheDbPath)) {
      const result = loadFromDb();
      if (!result.missing.length) {
        writeJson(response, 200, {
          source: "materialized_system_unit_views",
          mode: "db",
          builtAt: result.builtAt,
          units: result.units
        });
        return;
      }
    }
  } catch {}

  try {
    const snapshotResult = loadFromSnapshots();
    if (snapshotResult.missing.length) {
      writeJson(response, 503, {
        error: "Missing served system-unit snapshots.",
        source: "data/system-units",
        missingIds: snapshotResult.missing
      });
      return;
    }
    writeJson(response, 200, {
      source: "data/system-units",
      mode: "snapshot",
      builtAt: snapshotResult.builtAt,
      units: snapshotResult.units
    });
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
      source: "system-unit-server"
    });
  }
}

async function handleSystemUnitsRefresh(request, response) {
  try {
    const payload = await readJsonBody(request);
    const requestedSystemIds = Array.from(
      new Set(
        (Array.isArray(payload?.systemIds) ? payload.systemIds : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    );
    const refreshResult = await runProcess(execPath, ["scripts/contracts/generate-system-units.mjs"]);
    const refreshed = withCacheDb((db) => {
      const filteredSystemIds = requestedSystemIds.length
        ? requestedSystemIds.filter((systemId) => servedSystemUnitIds.includes(systemId))
        : servedSystemUnitIds;
      const statement = db.prepare(`
        SELECT system_id, built_at
        FROM materialized_system_unit_views
        WHERE version = 'v1' AND system_id = ?
      `);
      return filteredSystemIds
        .map((systemId) => statement.get(systemId))
        .filter(Boolean);
    });
    writeJson(response, 200, {
      ok: true,
      refreshedSystemIds: requestedSystemIds.length ? requestedSystemIds : servedSystemUnitIds,
      builtAt: maxBuiltAt(refreshed.map((row) => row.built_at)),
      stdout: String(refreshResult.stdout || "").trim() || null,
      stderr: String(refreshResult.stderr || "").trim() || null
    });
  } catch (error) {
    writeJson(response, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      stdout: error?.stdout ? String(error.stdout) : null,
      stderr: error?.stderr ? String(error.stderr) : null
    });
  }
}

function maxBuiltAt(...values) {
  return values
    .flat()
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

function handlePlayerProfileGet(response) {
  try {
    const result = withAppStateDb((db) => {
      const row = db
        .prepare(
          `
            SELECT profile_id, payload_json, updated_at, source_label
            FROM player_profiles
            WHERE profile_id = 'active'
          `
        )
        .get();
      if (!row) {
        return null;
      }
      return {
        profileId: row.profile_id,
        profile: JSON.parse(row.payload_json),
        updatedAt: row.updated_at,
        sourceLabel: row.source_label
      };
    });
    if (!result) {
      writeJson(response, 404, { error: "No DB-backed player profile is stored yet." });
      return;
    }
    writeJson(response, 200, result);
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
      source: "player-profile-server"
    });
  }
}

async function handlePlayerProfileUpsert(request, response) {
  try {
    const payload = await readJsonBody(request);
    const profile =
      payload?.profile && typeof payload.profile === "object" && !Array.isArray(payload.profile)
        ? payload.profile
        : null;
    if (!profile) {
      writeJson(response, 400, { error: "profile object is required." });
      return;
    }
    const updatedAt =
      typeof profile?.meta?.updatedAt === "string" && profile.meta.updatedAt.trim()
        ? profile.meta.updatedAt.trim()
        : new Date().toISOString();
    const sourceLabel =
      typeof payload?.sourceLabel === "string" && payload.sourceLabel.trim()
        ? payload.sourceLabel.trim()
        : "app";
    withAppStateDb((db) => {
      db.prepare(
        `
          INSERT INTO player_profiles (profile_id, payload_json, updated_at, source_label)
          VALUES ('active', ?, ?, ?)
          ON CONFLICT(profile_id) DO UPDATE SET
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at,
            source_label = excluded.source_label
        `
      ).run(JSON.stringify(profile), updatedAt, sourceLabel);
    });
    writeJson(response, 200, {
      ok: true,
      profileId: "active",
      updatedAt,
      sourceLabel
    });
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
      source: "player-profile-server"
    });
  }
}

function handleSubjectMetadata(response, requestUrl) {
  const result = querySystemSubjectMetadata(requestUrl);
  writeJson(response, result.statusCode, result.body);
}

function querySystemSubjectMetadata(requestUrl) {
  const systemId = String(requestUrl.searchParams.get("systemId") || "").trim();
  const requestedScopes = String(requestUrl.searchParams.get("scopes") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const mode = String(requestUrl.searchParams.get("mode") || "core").trim().toLowerCase();
  if (!systemId) {
    return {
      statusCode: 400,
      body: { error: "systemId is required." }
    };
  }
  if (!requestedScopes.length) {
    return {
      statusCode: 400,
      body: { error: "scopes is required." }
    };
  }

  try {
    if (!existsSync(cacheDbPath)) {
      return {
      statusCode: 503,
      body: { error: "Missing cache DB for subject-metadata API." }
      };
    }
    const result = withCacheDb((db) => {
      const statement = db.prepare(`
        SELECT trace_scope, payload_json, built_at
        FROM materialized_subject_contract_views
        WHERE project_name = ? AND project_file = ? AND trace_scope = ?
        ORDER BY built_at DESC
        LIMIT 1
      `);
      const contracts = {};
      const missing = [];
      let latestBuiltAt = null;
      for (const traceScope of requestedScopes) {
        const row = statement.get("cifi-full", "libil2cpp.so", traceScope);
        if (!row) {
          missing.push(traceScope);
          continue;
        }
        const payload = JSON.parse(row.payload_json);
        contracts[traceScope] =
          mode === "full" ? payload : payload?.core || payload;
        if (!latestBuiltAt || String(row.built_at) > latestBuiltAt) {
          latestBuiltAt = String(row.built_at);
        }
      }
      return { contracts, missing, builtAt: latestBuiltAt };
    });
    return {
      statusCode: 200,
      body: {
        source: "materialized_db_subject_metadata_views",
        systemId,
        mode: "db",
        contractMode: mode,
        builtAt: result.builtAt,
        missingScopes: result.missing,
        contracts: result.contracts
      }
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        error: error instanceof Error ? error.message : String(error),
        source: "db-subject-metadata-server"
      }
    };
  }
}

function handleGenericMechanics(response, requestUrl) {
  const result = querySystemGenericMechanics(requestUrl);
  writeJson(response, result.statusCode, result.body);
}

function querySystemGenericMechanics(requestUrl) {
  const systemId = String(requestUrl.searchParams.get("systemId") || "").trim();
  const requestedScopes = String(requestUrl.searchParams.get("scopes") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!systemId) {
    return {
      statusCode: 400,
      body: { error: "systemId is required." }
    };
  }

  try {
    if (!existsSync(cacheDbPath)) {
      return {
        statusCode: 503,
        body: { error: "Missing cache DB for generic mechanics API." }
      };
    }
    const result = withCacheDb((db) => {
      const scopeFilter =
        requestedScopes.length > 0
          ? ` AND trace_scope IN (${requestedScopes.map(() => "?").join(",")})`
          : "";
      const params = ["cifi-full", "libil2cpp.so", ...requestedScopes];
      const entityRows = db
        .prepare(
          `SELECT trace_scope, entity_id, entity_kind, payload_json, built_at
           FROM materialized_entity_views
           WHERE project_name = ? AND project_file = ?${scopeFilter}
           ORDER BY trace_scope ASC, entity_kind ASC, entity_id ASC`
        )
        .all(...params);
      const factRows = db
        .prepare(
          `SELECT trace_scope, entity_id, field_key, fact_kind, fact_value, payload_json, built_at
           FROM materialized_fact_views
           WHERE project_name = ? AND project_file = ?${scopeFilter}
           ORDER BY trace_scope ASC, entity_id ASC, field_key ASC, fact_kind ASC, fact_value ASC`
        )
        .all(...params);
      const relationRows = db
        .prepare(
          `SELECT trace_scope, source_entity_id, field_key, relation_kind, target_entity_id, payload_json, built_at
           FROM materialized_relation_views
           WHERE project_name = ? AND project_file = ?${scopeFilter}
           ORDER BY trace_scope ASC, source_entity_id ASC, field_key ASC, relation_kind ASC, target_entity_id ASC`
        )
        .all(...params);
      const gapRows = db
        .prepare(
          `SELECT trace_scope, entity_id, field_key, gap_kind, payload_json, built_at
           FROM materialized_gap_views
           WHERE project_name = ? AND project_file = ?${scopeFilter}
           ORDER BY trace_scope ASC, entity_id ASC, field_key ASC, gap_kind ASC`
        )
        .all(...params);

      const scopes = {};
      let latestBuiltAt = null;
      const ensureScope = (traceScope) => {
        const key = String(traceScope || "").trim();
        if (!key) {
          return null;
        }
        if (!scopes[key]) {
          scopes[key] = {
            entities: [],
            facts: [],
            relations: [],
            gaps: []
          };
        }
        return scopes[key];
      };

      entityRows.forEach((row) => {
        latestBuiltAt = maxBuiltAt(latestBuiltAt, row.built_at);
        const scope = ensureScope(row.trace_scope);
        if (!scope) {
          return;
        }
        scope.entities.push({
          entityId: row.entity_id,
          entityKind: row.entity_kind,
          payload: JSON.parse(row.payload_json || "{}"),
          builtAt: row.built_at
        });
      });
      factRows.forEach((row) => {
        latestBuiltAt = maxBuiltAt(latestBuiltAt, row.built_at);
        const scope = ensureScope(row.trace_scope);
        if (!scope) {
          return;
        }
        scope.facts.push({
          entityId: row.entity_id,
          fieldKey: row.field_key,
          factKind: row.fact_kind,
          factValue: row.fact_value,
          payload: JSON.parse(row.payload_json || "{}"),
          builtAt: row.built_at
        });
      });
      relationRows.forEach((row) => {
        latestBuiltAt = maxBuiltAt(latestBuiltAt, row.built_at);
        const scope = ensureScope(row.trace_scope);
        if (!scope) {
          return;
        }
        scope.relations.push({
          sourceEntityId: row.source_entity_id,
          fieldKey: row.field_key,
          relationKind: row.relation_kind,
          targetEntityId: row.target_entity_id,
          payload: JSON.parse(row.payload_json || "{}"),
          builtAt: row.built_at
        });
      });
      gapRows.forEach((row) => {
        latestBuiltAt = maxBuiltAt(latestBuiltAt, row.built_at);
        const scope = ensureScope(row.trace_scope);
        if (!scope) {
          return;
        }
        scope.gaps.push({
          entityId: row.entity_id,
          fieldKey: row.field_key,
          gapKind: row.gap_kind,
          payload: JSON.parse(row.payload_json || "{}"),
          builtAt: row.built_at
        });
      });

      return {
        systemId,
        scopeCount: Object.keys(scopes).length,
        builtAt: latestBuiltAt,
        scopes
      };
    });
    return {
      statusCode: 200,
      body: result
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        error: error instanceof Error ? error.message : String(error),
        source: "generic-mechanics-server"
      }
    };
  }
}

function handleTokenShopDb(response, requestUrl) {
  const result = querySystemDbBundle(requestUrl);
  if (result.statusCode >= 400) {
    writeJson(response, result.statusCode, {
      error: "Failed to load Token Shop DB mechanics bundle.",
      genericMechanics: result.body?.genericMechanics ?? null,
      subjectMetadata: result.body?.subjectMetadata ?? null
    });
    return;
  }
  writeJson(response, result.statusCode, {
    ...result.body,
    source: "token-shop-db-bundle"
  });
}

function handleSystemDb(response, requestUrl) {
  const result = querySystemDbBundle(requestUrl);
  writeJson(response, result.statusCode, result.body);
}

function querySystemDbBundle(requestUrl) {
  const contractsUrl = new URL(requestUrl.toString());
  if (!contractsUrl.searchParams.get("mode")) {
    contractsUrl.searchParams.set("mode", "core");
  }
  const contractResult = querySystemSubjectMetadata(contractsUrl);
  const genericResult = querySystemGenericMechanics(requestUrl);
  const boundaryResult = querySystemBoundaries(requestUrl);
  if (genericResult.statusCode >= 400 && contractResult.statusCode >= 400 && boundaryResult.statusCode >= 400) {
    return {
      statusCode:
        contractResult.statusCode >= 400
          ? contractResult.statusCode
          : genericResult.statusCode >= 400
            ? genericResult.statusCode
            : boundaryResult.statusCode,
      body: {
        error: "Failed to load system DB bundle.",
        subjectMetadata: contractResult.body,
        genericMechanics: genericResult.body,
        boundaries: boundaryResult.body
      }
    };
  }
  return {
    statusCode: 200,
    body: {
      source: "system-db-bundle",
      systemId: String(requestUrl.searchParams.get("systemId") || "").trim(),
      mode: "db",
      builtAt: maxBuiltAt(
        contractResult.statusCode < 400 ? contractResult.body?.builtAt ?? null : null,
        genericResult.statusCode < 400 ? genericResult.body?.builtAt ?? null : null,
        boundaryResult.statusCode < 400 ? boundaryResult.body?.builtAt ?? null : null
      ),
      subjectMetadata: contractResult.statusCode < 400 ? contractResult.body : null,
      genericMechanics: genericResult.statusCode < 400 ? genericResult.body : null,
      boundaries: boundaryResult.statusCode < 400 ? boundaryResult.body : null
    }
  };
}

function querySystemBoundaries(requestUrl) {
  const systemId = String(requestUrl.searchParams.get("systemId") || "").trim();
  const requestedScopes = String(requestUrl.searchParams.get("scopes") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!systemId) {
    return {
      statusCode: 400,
      body: { error: "systemId is required." }
    };
  }

  try {
    if (!existsSync(cacheDbPath)) {
      return {
        statusCode: 503,
        body: { error: "Missing cache DB for boundary API." }
      };
    }
    const result = withCacheDb((db) => {
      const scopeFilter =
        requestedScopes.length > 0
          ? ` AND trace_scope IN (${requestedScopes.map(() => "?").join(",")})`
          : "";
      const params = ["cifi-full", "libil2cpp.so", ...requestedScopes];
      const boundaryRows = db
        .prepare(
          `SELECT trace_scope, subject_id, boundary_kind, verdict, payload_json, built_at
           FROM materialized_boundary_views
           WHERE project_name = ? AND project_file = ?${scopeFilter}
           ORDER BY trace_scope ASC, subject_id ASC, boundary_kind ASC`
        )
        .all(...params);

      const boundaries = {};
      let latestBuiltAt = null;
      for (const row of boundaryRows) {
        latestBuiltAt = maxBuiltAt(latestBuiltAt, row.built_at);
        const key = String(row.subject_id || "").trim();
        if (!key) {
          continue;
        }
        boundaries[key] = {
          traceScope: row.trace_scope,
          subjectId: row.subject_id,
          boundaryKind: row.boundary_kind,
          verdict: row.verdict,
          ...(JSON.parse(row.payload_json || "{}") || {}),
          builtAt: row.built_at
        };
      }

      return {
        systemId,
        boundaryCount: Object.keys(boundaries).length,
        builtAt: latestBuiltAt,
        boundaries
      };
    });
    return {
      statusCode: 200,
      body: result
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: {
        error: error instanceof Error ? error.message : String(error),
        source: "boundary-server"
      }
    };
  }
}

function detectOcrFailureStage(text) {
  if (/tesseract/i.test(text)) {
    return "tesseract";
  }
  if (/python|pytesseract|cv2|numpy/i.test(text)) {
    return "python";
  }
  return "powershell";
}

function createTraceGapRunState(overrides = {}) {
  return {
    runId: null,
    status: "idle",
    mode: "execute",
    repeat: 1,
    startedAt: null,
    finishedAt: null,
    exitCode: null,
    command: [],
    activityLabel: "Idle",
    selectedTarget: "",
    selectedLabel: "",
    selectedSeam: "",
    subject: "",
    subjectLabel: "",
    executionScope: "",
    family: "",
    unresolvedAnchor: "",
    blockedEdges: "",
    verdict: "",
    summary: "",
    recoveredSummary: "",
    tracedSummary: "",
    attemptedSummary: "",
    missingSummary: "",
    newEdgesSummary: "",
    progressSummary: "",
    cumulativeRecovered: [],
    cumulativeTraced: [],
    cumulativeAttempted: [],
    cumulativeMissing: [],
    cumulativeNewEdges: [],
    progressDetected: false,
    rerankCount: 0,
    currentIteration: 0,
    lastOutputAt: null,
    stopRequestedAt: null,
    logEntries: [],
    lineCount: 0,
    stdoutBuffer: "",
    stderrBuffer: "",
    child: null,
    ...overrides
  };
}

function parseTraceGapSummaryList(value) {
  const text = String(value || "").trim();
  if (!text || text === "none") {
    return [];
  }
  return text
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function mergeTraceGapSummaryList(existing, value) {
  const next = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(next.map((item) => String(item)));
  for (const item of parseTraceGapSummaryList(value)) {
    if (seen.has(item)) {
      continue;
    }
    seen.add(item);
    next.push(item);
  }
  return next;
}

function formatTraceGapSummaryList(values) {
  return Array.isArray(values) && values.length ? values.join(",") : "none";
}

function updateTraceGapCumulativeSummary(fields) {
  if ("recovered" in fields) {
    traceGapRun.cumulativeRecovered = mergeTraceGapSummaryList(traceGapRun.cumulativeRecovered, fields.recovered);
    traceGapRun.recoveredSummary = formatTraceGapSummaryList(traceGapRun.cumulativeRecovered);
  }
  if ("traced" in fields) {
    traceGapRun.cumulativeTraced = mergeTraceGapSummaryList(traceGapRun.cumulativeTraced, fields.traced);
    traceGapRun.tracedSummary = formatTraceGapSummaryList(traceGapRun.cumulativeTraced);
  }
  if ("attempted" in fields) {
    traceGapRun.cumulativeAttempted = mergeTraceGapSummaryList(traceGapRun.cumulativeAttempted, fields.attempted);
    traceGapRun.attemptedSummary = formatTraceGapSummaryList(traceGapRun.cumulativeAttempted);
  }
  if ("missing" in fields) {
    traceGapRun.cumulativeMissing = mergeTraceGapSummaryList(traceGapRun.cumulativeMissing, fields.missing);
    traceGapRun.missingSummary = formatTraceGapSummaryList(traceGapRun.cumulativeMissing);
  }
  if ("newEdges" in fields) {
    traceGapRun.cumulativeNewEdges = mergeTraceGapSummaryList(traceGapRun.cumulativeNewEdges, fields.newEdges);
    traceGapRun.newEdgesSummary = formatTraceGapSummaryList(traceGapRun.cumulativeNewEdges);
  }
  if ("netProgress" in fields) {
    const nextProgress = String(fields.netProgress || "").trim().toLowerCase();
    if (nextProgress === "yes") {
      traceGapRun.progressDetected = true;
    }
    if (traceGapRun.progressDetected) {
      traceGapRun.progressSummary = "yes";
    } else if (nextProgress) {
      traceGapRun.progressSummary = nextProgress;
    }
  }
}

function getPublicTraceGapRun() {
  const {
    child,
    stdoutBuffer,
    stderrBuffer,
    ...publicRun
  } = traceGapRun;
  return {
    ...publicRun,
    isRunning: publicRun.status === "running",
    hasMoreLogs: publicRun.lineCount > publicRun.logEntries.length
  };
}

function broadcastTraceGapState() {
  const payload = JSON.stringify({ run: getPublicTraceGapRun() });
  const message = `event: run\ndata: ${payload}\n\n`;
  for (const stream of Array.from(traceGapStreams)) {
    try {
      if (stream.destroyed || stream.writableEnded) {
        traceGapStreams.delete(stream);
        continue;
      }
      stream.write(message);
    } catch {
      traceGapStreams.delete(stream);
    }
  }
}

function resolvePythonCommand() {
  const candidates =
    process.platform === "win32"
      ? [
          ["python", []],
          ["py", ["-3"]]
        ]
      : [
          ["python3", []],
          ["python", []]
        ];

  for (const [command, prefixArgs] of candidates) {
    const probe = spawnSync(command, [...prefixArgs, "--version"], {
      cwd: root,
      stdio: "ignore"
    });
    if (probe.status === 0) {
      return { command, prefixArgs };
    }
  }

  throw new Error("Python 3 was not found on PATH.");
}

function appendTraceGapLog(stream, chunk) {
  const bufferKey = stream === "stderr" ? "stderrBuffer" : "stdoutBuffer";
  const existing = traceGapRun[bufferKey] || "";
  const combined = `${existing}${chunk.toString("utf8")}`;
  const lines = combined.split(/\r?\n/);
  traceGapRun[bufferKey] = lines.pop() ?? "";
  for (const line of lines) {
    pushTraceGapLogLine(stream, line);
  }
}

function flushTraceGapLogBuffer(stream) {
  const bufferKey = stream === "stderr" ? "stderrBuffer" : "stdoutBuffer";
  const remainder = String(traceGapRun[bufferKey] || "");
  if (remainder) {
    pushTraceGapLogLine(stream, remainder);
  }
  traceGapRun[bufferKey] = "";
}

function pushTraceGapLogLine(stream, line) {
  const text = String(line || "");
  traceGapRun.lineCount += 1;
  traceGapRun.lastOutputAt = new Date().toISOString();
  traceGapRun.logEntries.push({
    index: traceGapRun.lineCount,
    stream,
    text,
    at: traceGapRun.lastOutputAt
  });
  if (traceGapRun.logEntries.length > traceGapLogLimit) {
    traceGapRun.logEntries.splice(0, traceGapRun.logEntries.length - traceGapLogLimit);
  }
  updateTraceGapRunSummary(text);
  broadcastTraceGapState();
}

function updateTraceGapRunSummary(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) {
    return;
  }
  const progressSummaryMatch =
    /^recovered=(.*?)\s+traced=(.*?)\s+attempted=(.*?)\s+missing=(.*?)\s+newEdges=(.*?)\s+netProgress=(\S+)$/.exec(
      trimmed
    );
  if (progressSummaryMatch) {
    updateTraceGapCumulativeSummary({
      recovered: progressSummaryMatch[1],
      traced: progressSummaryMatch[2],
      attempted: progressSummaryMatch[3],
      missing: progressSummaryMatch[4],
      newEdges: progressSummaryMatch[5],
      netProgress: progressSummaryMatch[6]
    });
    return;
  }
  if (trimmed.startsWith("[phase ")) {
    const match = /^\[phase\s+\d+\]\s+(.+?)(?:\.\.\.| done in .+)?$/.exec(trimmed);
    if (match?.[1]) {
      traceGapRun.activityLabel = match[1].trim();
    }
    return;
  }
  if (trimmed.startsWith("[progress] ")) {
    traceGapRun.activityLabel = trimmed.replace(/^\[progress\]\s*/, "").trim() || traceGapRun.activityLabel;
    return;
  }
  if (trimmed.startsWith("Best current acquisition gap:")) {
    const match = /^Best current acquisition gap:\s+(.+?)\s+\((.+)\)$/.exec(trimmed);
    traceGapRun.selectedTarget = match?.[1] || traceGapRun.selectedTarget;
    traceGapRun.selectedLabel = match?.[2] || traceGapRun.selectedLabel;
    traceGapRun.activityLabel = "Best-gap target selected";
    return;
  }
  if (trimmed === "Dry run only.") {
    traceGapRun.activityLabel = "Dry-run plan materialized";
    return;
  }
  if (trimmed.startsWith("Trace run completed")) {
    traceGapRun.activityLabel = trimmed;
    const match = /\((\d+)\/(\d+)\)/.exec(trimmed);
    if (match) {
      traceGapRun.currentIteration = Number(match[1] || traceGapRun.currentIteration || 0);
    }
    return;
  }
  if (trimmed.startsWith("Refreshing best-gap selection from DB-backed materialized state")) {
    traceGapRun.rerankCount += 1;
    traceGapRun.currentIteration = Math.min(traceGapRun.repeat, traceGapRun.rerankCount + 1);
    traceGapRun.activityLabel = `Refreshing best-gap selection (${traceGapRun.currentIteration}/${traceGapRun.repeat})`;
    return;
  }
  const keyValue = /^([A-Za-z][A-Za-z0-9]+)=(.*)$/.exec(trimmed);
  if (!keyValue) {
    return;
  }
  const key = keyValue[1];
  const value = keyValue[2].trim();
  if (key === "unresolvedAnchor") {
    traceGapRun.unresolvedAnchor = value;
  } else if (key === "subject") {
    traceGapRun.subject = value;
  } else if (key === "subjectLabel") {
    traceGapRun.subjectLabel = value;
  } else if (key === "executionScope") {
    traceGapRun.executionScope = value;
  } else if (key === "family") {
    traceGapRun.family = value;
  } else if (key === "nextSeam" || key === "seam") {
    traceGapRun.selectedSeam = value;
  } else if (key === "blocked") {
    traceGapRun.blockedEdges = value;
  } else if (key === "summary") {
    traceGapRun.summary = value;
  } else if (key === "recovered") {
    updateTraceGapCumulativeSummary({ recovered: value });
  } else if (key === "traced") {
    updateTraceGapCumulativeSummary({ traced: value });
  } else if (key === "attempted") {
    updateTraceGapCumulativeSummary({ attempted: value });
  } else if (key === "missing") {
    updateTraceGapCumulativeSummary({ missing: value });
  } else if (key === "newEdges") {
    updateTraceGapCumulativeSummary({ newEdges: value });
  } else if (key === "netProgress") {
    updateTraceGapCumulativeSummary({ netProgress: value });
  } else if (key === "verdict") {
    traceGapRun.verdict = value;
  }
}

function handleTraceGapStatus(response) {
  writeJson(
    response,
    200,
    { run: getPublicTraceGapRun() },
    { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" }
  );
}

function handleTraceGapEvents(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  traceGapStreams.add(response);
  response.write(`event: ready\ndata: ${JSON.stringify({ run: getPublicTraceGapRun() })}\n\n`);
  request.on("close", () => {
    traceGapStreams.delete(response);
  });
}

function handleTraceGapOverview(response, requestUrl) {
  try {
    if (!existsSync(cacheDbPath)) {
      writeJson(response, 503, { error: "Missing cache DB for trace-gap overview." });
      return;
    }
    const scopeHint = String(requestUrl.searchParams.get("scope") || "").trim();
    const overview = withCacheDb((db) => {
      const tables = [
        {
          key: "targetBundles",
          label: "Target bundles",
          table: "materialized_target_bundle_views",
          columns: ["trace_scope", "request_signature"]
        },
        {
          key: "resolverTargets",
          label: "Resolver targets",
          table: "materialized_resolver_target_views",
          columns: ["trace_scope"]
        },
        {
          key: "subjectStates",
          label: "Subject states",
          table: "materialized_subject_state_views",
          columns: ["trace_scope", "subject_id"]
        },
        {
          key: "subjectMetadata",
          label: "DB subject metadata",
          table: "materialized_subject_contract_views",
          columns: ["trace_scope", "subject_id"]
        },
        {
          key: "entities",
          label: "Generic entities",
          table: "materialized_entity_views",
          columns: ["trace_scope", "entity_id"]
        },
        {
          key: "facts",
          label: "Generic facts",
          table: "materialized_fact_views",
          columns: ["trace_scope", "entity_id", "field_key", "fact_kind"]
        },
        {
          key: "relations",
          label: "Generic relations",
          table: "materialized_relation_views",
          columns: ["trace_scope", "source_entity_id", "field_key", "relation_kind"]
        },
        {
          key: "gaps",
          label: "Generic gaps",
          table: "materialized_gap_views",
          columns: ["trace_scope", "entity_id", "field_key", "gap_kind"]
        },
        {
          key: "boundaries",
          label: "Inferred boundaries",
          table: "materialized_boundary_views",
          columns: ["trace_scope", "subject_id", "boundary_kind", "verdict"]
        },
        {
          key: "nativeTraceViews",
          label: "Native trace views",
          table: "materialized_native_trace_views",
          columns: ["request_signature"]
        },
        {
          key: "acquisitionDiagnostics",
          label: "Acquisition diagnostics",
          table: "materialized_acquisition_diagnostics_views",
          columns: ["trace_scope", "request_signature"]
        },
        {
          key: "materializationStages",
          label: "Materialization stages",
          table: "materialization_stage_views",
          columns: ["trace_scope", "subject_id", "stage_kind"]
        }
      ];

      const tableRows = Object.fromEntries(
        tables.map((tableConfig) => {
          const count = Number(
            db
              .prepare(
                `SELECT COUNT(*) AS count FROM ${tableConfig.table} WHERE project_name = ? AND project_file = ?`
              )
              .get("cifi-full", "libil2cpp.so").count || 0
          );
          const selectColumns = ["built_at", ...tableConfig.columns].join(", ");
          const latestRow =
            db
              .prepare(
                `SELECT ${selectColumns} FROM ${tableConfig.table} WHERE project_name = ? AND project_file = ? ORDER BY built_at DESC LIMIT 1`
              )
              .get("cifi-full", "libil2cpp.so") || null;
          let scopeCount = null;
          let scopeLatestRow = null;
          if (scopeHint && tableConfig.columns.includes("trace_scope")) {
            scopeCount = Number(
              db
                .prepare(
                  `SELECT COUNT(*) AS count FROM ${tableConfig.table} WHERE project_name = ? AND project_file = ? AND trace_scope = ?`
                )
                .get("cifi-full", "libil2cpp.so", scopeHint).count || 0
            );
            scopeLatestRow =
              db
                .prepare(
                  `SELECT ${selectColumns} FROM ${tableConfig.table} WHERE project_name = ? AND project_file = ? AND trace_scope = ? ORDER BY built_at DESC LIMIT 1`
                )
                .get("cifi-full", "libil2cpp.so", scopeHint) || null;
          }
          return [
            tableConfig.key,
            {
              label: tableConfig.label,
              count,
              latestBuiltAt: latestRow?.built_at || null,
              latestTraceScope: latestRow?.trace_scope || null,
              latestSubjectId: latestRow?.subject_id || null,
              latestRequestSignature: latestRow?.request_signature || null,
              scopeHint,
              scopeCount,
              scopeLatestBuiltAt: scopeLatestRow?.built_at || null,
              scopeLatestSubjectId: scopeLatestRow?.subject_id || null
            }
          ];
        })
      );
      return {
        dbPath: cacheDbPath,
        scopeHint,
        generatedAt: new Date().toISOString(),
        tables: tableRows,
        stages: (() => {
          const stageRows = scopeHint
            ? db
                .prepare(
                  `SELECT trace_scope, subject_id, stage_kind, stage_status, upstream_signature, built_at
                   FROM materialization_stage_views
                   WHERE project_name = ? AND project_file = ? AND trace_scope = ?
                   ORDER BY built_at DESC, trace_scope ASC, subject_id ASC, stage_kind ASC`
                )
                .all("cifi-full", "libil2cpp.so", scopeHint)
            : db
                .prepare(
                  `SELECT trace_scope, subject_id, stage_kind, stage_status, upstream_signature, built_at
                   FROM materialization_stage_views
                   WHERE project_name = ? AND project_file = ?
                   ORDER BY built_at DESC, trace_scope ASC, subject_id ASC, stage_kind ASC`
                )
                .all("cifi-full", "libil2cpp.so");
          const latestByStage = Object.create(null);
          for (const row of stageRows) {
            if (!latestByStage[row.stage_kind]) {
              latestByStage[row.stage_kind] = {
                stageKind: row.stage_kind,
                stageStatus: row.stage_status,
                traceScope: row.trace_scope,
                subjectId: row.subject_id,
                builtAt: row.built_at,
                upstreamSignature: row.upstream_signature
              };
            }
          }
          return {
            count: stageRows.length,
            latestByStage
          };
        })(),
        scopeStageSummary: (() => {
          if (!scopeHint) {
            return null;
          }
          const rows = db
            .prepare(
              `SELECT trace_scope, subject_id, stage_kind, stage_status, built_at
               FROM materialization_stage_views
               WHERE project_name = ? AND project_file = ? AND trace_scope = ?
               ORDER BY built_at DESC, stage_kind ASC`
            )
            .all("cifi-full", "libil2cpp.so", scopeHint);
          const stages = Object.create(null);
          let latestSubjectId = null;
          let latestBuiltAt = null;
          for (const row of rows) {
            if (!stages[row.stage_kind]) {
              stages[row.stage_kind] = row.stage_status;
            }
            if (!latestSubjectId) {
              latestSubjectId = row.subject_id || null;
            }
            if (!latestBuiltAt) {
              latestBuiltAt = row.built_at || null;
            }
          }
          return {
            traceScope: scopeHint,
            latestSubjectId,
            latestBuiltAt,
            stages
          };
        })(),
        genericMechanics: (() => {
          const baseParams = ["cifi-full", "libil2cpp.so"];
          const scopeParams = scopeHint ? [...baseParams, scopeHint] : baseParams;
          const scopeClause = scopeHint ? " AND trace_scope = ?" : "";
          const counts = {
            entities: Number(
              db
                .prepare(
                  `SELECT COUNT(*) AS count FROM materialized_entity_views WHERE project_name = ? AND project_file = ?${scopeClause}`
                )
                .get(...scopeParams).count || 0
            ),
            facts: Number(
              db
                .prepare(
                  `SELECT COUNT(*) AS count FROM materialized_fact_views WHERE project_name = ? AND project_file = ?${scopeClause}`
                )
                .get(...scopeParams).count || 0
            ),
            relations: Number(
              db
                .prepare(
                  `SELECT COUNT(*) AS count FROM materialized_relation_views WHERE project_name = ? AND project_file = ?${scopeClause}`
                )
                .get(...scopeParams).count || 0
            ),
            gaps: Number(
              db
                .prepare(
                  `SELECT COUNT(*) AS count FROM materialized_gap_views WHERE project_name = ? AND project_file = ?${scopeClause}`
                )
                .get(...scopeParams).count || 0
            )
          };
          const gapStateCounts = (() => {
            if (scopeHint) {
              return {
                open: counts.gaps,
                closedOnly: 0,
                orphan: 0,
                total: counts.gaps
              };
            }
            const subjectRows = db
              .prepare(
                `SELECT mssv.trace_scope, mssv.payload_json
                 FROM materialized_subject_state_views AS mssv
                 INNER JOIN (
                   SELECT trace_scope, subject_id, MAX(built_at) AS max_built_at
                   FROM materialized_subject_state_views
                   WHERE project_name = ? AND project_file = ?
                   GROUP BY trace_scope, subject_id
                 ) AS latest
                   ON latest.trace_scope = mssv.trace_scope
                  AND latest.subject_id = mssv.subject_id
                  AND latest.max_built_at = mssv.built_at
                 WHERE mssv.project_name = ? AND mssv.project_file = ?`
              )
              .all("cifi-full", "libil2cpp.so", "cifi-full", "libil2cpp.so");
            const openScopes = new Set();
            const knownScopes = new Set();
            for (const row of subjectRows) {
              knownScopes.add(row.trace_scope);
              let payload = {};
              try {
                payload = JSON.parse(row.payload_json || "{}");
              } catch {}
              const nextSeam = payload.nextSeam && payload.nextSeam.id;
              const blockedEdges = Array.isArray(payload.blockedEdges) ? payload.blockedEdges : [];
              const missingEdges = Array.isArray(payload.missingEdges) ? payload.missingEdges : [];
              if (nextSeam || blockedEdges.length || missingEdges.length) {
                openScopes.add(row.trace_scope);
              }
            }
            const gapScopeRows = db
              .prepare(
                `SELECT trace_scope, COUNT(*) AS count
                 FROM materialized_gap_views
                 WHERE project_name = ? AND project_file = ?
                 GROUP BY trace_scope`
              )
              .all("cifi-full", "libil2cpp.so");
            const result = { open: 0, closedOnly: 0, orphan: 0, total: counts.gaps };
            for (const row of gapScopeRows) {
              const count = Number(row.count || 0);
              if (openScopes.has(row.trace_scope)) {
                result.open += count;
              } else if (knownScopes.has(row.trace_scope)) {
                result.closedOnly += count;
              } else {
                result.orphan += count;
              }
            }
            return result;
          })();
          const gapKindCounts = (scopeHint
            ? db
                .prepare(
                  `SELECT gap_kind, COUNT(*) AS count
                   FROM materialized_gap_views
                   WHERE project_name = ? AND project_file = ? AND trace_scope = ?
                   GROUP BY gap_kind
                   ORDER BY count DESC, gap_kind ASC`
                )
                .all("cifi-full", "libil2cpp.so", scopeHint)
            : db
                .prepare(
                  `SELECT gap_kind, COUNT(*) AS count
                   FROM materialized_gap_views
                   WHERE project_name = ? AND project_file = ?
                   GROUP BY gap_kind
                   ORDER BY count DESC, gap_kind ASC
                   LIMIT 12`
                )
                .all("cifi-full", "libil2cpp.so")).map((row) => ({
            gapKind: row.gap_kind,
            count: Number(row.count || 0)
          }));
          const latestGapRows = (scopeHint
            ? db
                .prepare(
                  `SELECT entity_id, field_key, gap_kind, payload_json, built_at
                   FROM materialized_gap_views
                   WHERE project_name = ? AND project_file = ? AND trace_scope = ?
                   ORDER BY built_at DESC, entity_id ASC, field_key ASC, gap_kind ASC
                   LIMIT 12`
                )
                .all("cifi-full", "libil2cpp.so", scopeHint)
            : db
                .prepare(
                  `SELECT trace_scope, entity_id, field_key, gap_kind, payload_json, built_at
                   FROM materialized_gap_views
                   WHERE project_name = ? AND project_file = ?
                   ORDER BY built_at DESC, trace_scope ASC, entity_id ASC, field_key ASC, gap_kind ASC
                   LIMIT 12`
                )
                .all("cifi-full", "libil2cpp.so")).map((row) => ({
            traceScope: row.trace_scope || scopeHint || null,
            entityId: row.entity_id,
            fieldKey: row.field_key || null,
            gapKind: row.gap_kind,
            payload: JSON.parse(row.payload_json || "{}"),
            builtAt: row.built_at || null
          }));
          const latestFactRows = (scopeHint
            ? db
                .prepare(
                  `SELECT entity_id, field_key, fact_kind, fact_value, built_at
                   FROM materialized_fact_views
                   WHERE project_name = ? AND project_file = ? AND trace_scope = ?
                   ORDER BY built_at DESC, entity_id ASC, field_key ASC, fact_kind ASC
                   LIMIT 12`
                )
                .all("cifi-full", "libil2cpp.so", scopeHint)
            : db
                .prepare(
                  `SELECT trace_scope, entity_id, field_key, fact_kind, fact_value, built_at
                   FROM materialized_fact_views
                   WHERE project_name = ? AND project_file = ?
                   ORDER BY built_at DESC, trace_scope ASC, entity_id ASC, field_key ASC, fact_kind ASC
                   LIMIT 12`
                )
                .all("cifi-full", "libil2cpp.so")).map((row) => ({
            traceScope: row.trace_scope || scopeHint || null,
            entityId: row.entity_id,
            fieldKey: row.field_key || null,
            factKind: row.fact_kind,
            factValue: row.fact_value,
            builtAt: row.built_at || null
          }));
          return {
            counts,
            gapStateCounts,
            gapKindCounts,
            latestGapRows,
            latestFactRows
          };
        })()
      };
    });
    writeJson(
      response,
      200,
      overview,
      { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" }
    );
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function handleServerRestart(response) {
  try {
    const serverScriptPath = join(root, "scripts", "dev-server.mjs");
    const restartLogPath = join(root, ".codex-server-restart.log");
    const restartErrLogPath = join(root, ".codex-server-restart.err.log");
    const restartEnv = {
      ...process.env,
      CIFI_LAUNCH_MODE: "0"
    };
    writeJson(response, 202, {
      ok: true,
      restarting: true,
      spawnedPid: null
    });
    setTimeout(() => {
      const helperScript = `
const fs = require("node:fs");
const net = require("node:net");
const { spawn } = require("node:child_process");
const execPath = ${JSON.stringify(execPath)};
const serverScriptPath = ${JSON.stringify(serverScriptPath)};
const root = ${JSON.stringify(root)};
const port = ${JSON.stringify(port)};
const logPath = ${JSON.stringify(restartLogPath)};
const errPath = ${JSON.stringify(restartErrLogPath)};
const restartEnv = { ...process.env, CIFI_LAUNCH_MODE: "0" };
const deadline = Date.now() + 30000;
const launchReplacement = () => {
  try { fs.rmSync(logPath, { force: true }); } catch {}
  try { fs.rmSync(errPath, { force: true }); } catch {}
  const stdoutFd = fs.openSync(logPath, "a");
  const stderrFd = fs.openSync(errPath, "a");
  const child = spawn(execPath, [serverScriptPath], {
    cwd: root,
    env: restartEnv,
    detached: true,
    stdio: ["ignore", stdoutFd, stderrFd],
    windowsHide: true
  });
  child.unref();
  process.exit(0);
};
const waitForPortRelease = () => {
  if (Date.now() >= deadline) {
    try { fs.appendFileSync(errPath, "Restart helper timed out waiting for port to close.\\n"); } catch {}
    process.exit(1);
    return;
  }
  const socket = net.connect({ host: "127.0.0.1", port, timeout: 200 });
  let settled = false;
  const complete = (fn) => {
    if (settled) return;
    settled = true;
    try { socket.destroy(); } catch {}
    fn();
  };
  socket.on("connect", () => complete(() => setTimeout(waitForPortRelease, 250)));
  socket.on("timeout", () => complete(launchReplacement));
  socket.on("error", () => complete(launchReplacement));
};
waitForPortRelease();
`;
      const child = spawn(execPath, ["-e", helperScript], {
        cwd: root,
        env: restartEnv,
        detached: true,
        stdio: "ignore",
        windowsHide: true
      });
      child.unref();
      server.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 3000).unref();
    }, 150).unref();
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

async function handleTraceGapRun(request, response) {
  try {
    if (traceGapRun.status === "running" || traceGapRun.status === "stopping") {
      writeJson(response, 409, {
        error: "A trace-gap run is already active.",
        run: getPublicTraceGapRun()
      });
      return;
    }
    const payload = await readJsonBody(request);
    const mode = payload?.mode === "dry-run" ? "dry-run" : "execute";
    const repeat = Math.min(50, Math.max(1, Number(payload?.repeat || 1)));
    const python = resolvePythonCommand();
    const args = [
      ...python.prefixArgs,
      "-u",
      "scripts/unity/unity_trace_bundle.py",
      "--best-gap",
      "--profile-timing",
      "--repeat",
      String(repeat)
    ];
    if (mode === "dry-run") {
      args.push("--dry-run");
    } else {
      args.push("--level", "structured");
    }

    traceGapRun = createTraceGapRunState({
      runId: `trace-gap-${Date.now()}`,
      status: "running",
      mode,
      repeat,
      startedAt: new Date().toISOString(),
      command: [python.command, ...args],
      activityLabel:
        mode === "dry-run"
          ? "Launching DB-backed best-gap dry run"
          : "Launching DB-backed best-gap execution",
      currentIteration: mode === "dry-run" ? 0 : 1
    });
    broadcastTraceGapState();

    const child = spawn(python.command, args, {
      cwd: root,
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    traceGapRun.child = child;

    child.stdout.on("data", (chunk) => appendTraceGapLog("stdout", chunk));
    child.stderr.on("data", (chunk) => appendTraceGapLog("stderr", chunk));
    child.on("error", (error) => {
      traceGapRun.status = "failed";
      traceGapRun.finishedAt = new Date().toISOString();
      traceGapRun.exitCode = -1;
      traceGapRun.activityLabel = "Trace-gap launch failed";
      pushTraceGapLogLine("stderr", error instanceof Error ? error.message : String(error));
      traceGapRun.child = null;
      broadcastTraceGapState();
    });
    child.on("close", (code) => {
      flushTraceGapLogBuffer("stdout");
      flushTraceGapLogBuffer("stderr");
      traceGapRun.status = traceGapRun.stopRequestedAt ? "stopped" : code === 0 ? "completed" : "failed";
      traceGapRun.exitCode = code ?? 1;
      traceGapRun.finishedAt = new Date().toISOString();
      if (traceGapRun.status === "stopped") {
        traceGapRun.activityLabel = "Trace-gap run stopped";
      } else if (!traceGapRun.summary && traceGapRun.mode === "dry-run" && !traceGapRun.selectedTarget) {
        traceGapRun.activityLabel = "Dry-run completed without a selected target";
      } else if (traceGapRun.status === "completed") {
        traceGapRun.activityLabel =
          traceGapRun.mode === "dry-run" ? "Dry-run completed" : "Trace-gap execution completed";
      } else {
        traceGapRun.activityLabel = "Trace-gap execution failed";
      }
      traceGapRun.child = null;
      broadcastTraceGapState();
    });

    writeJson(response, 202, { ok: true, run: getPublicTraceGapRun() });
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
      run: getPublicTraceGapRun()
    });
  }
}

function handleTraceGapStop(response) {
  if (traceGapRun.status === "stopping") {
    writeJson(response, 202, { ok: true, run: getPublicTraceGapRun() });
    return;
  }
  if (traceGapRun.status !== "running" || !traceGapRun.child) {
    writeJson(response, 409, {
      error: "No trace-gap run is active.",
      run: getPublicTraceGapRun()
    });
    return;
  }

  traceGapRun.status = "stopping";
  traceGapRun.stopRequestedAt = new Date().toISOString();
  traceGapRun.activityLabel = "Stopping trace-gap run";
  pushTraceGapLogLine("stdout", "[control] Stop requested from trace-gap UI.");
  stopTraceGapProcess(traceGapRun.child);
  broadcastTraceGapState();
  writeJson(response, 202, { ok: true, run: getPublicTraceGapRun() });
}

function stopTraceGapProcess(child) {
  if (!child || child.killed) {
    return;
  }
  if (process.platform === "win32" && child.pid) {
    const result = spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      cwd: root,
      stdio: "ignore"
    });
    if (result.status === 0) {
      return;
    }
  }
  try {
    child.kill("SIGTERM");
  } catch {}
  setTimeout(() => {
    if (child.exitCode !== null || child.killed) {
      return;
    }
    try {
      child.kill("SIGKILL");
    } catch {}
  }, 2500).unref();
}

async function handleClientSessionTouch(request, response) {
  try {
    const payload = await readJsonBody(request);
    const clientId = String(payload?.clientId || "").trim();
    if (!clientId) {
      writeJson(response, 400, { error: "clientId is required." });
      return;
    }

    launcherSawClient = true;
    const existingSession = clientSessions.get(clientId) || {};
    clientSessions.set(clientId, {
      ...existingSession,
      clientId,
      lastSeenAt: Date.now()
    });
    writeJson(response, 200, {
      ok: true,
      launcherMode,
      launchSignalSequence: launcherSignalSequence
    });
  } catch (error) {
    writeJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

async function handleClientSessionClose(request, response) {
  try {
    const payload = await readJsonBody(request);
    const clientId = String(payload?.clientId || "").trim();
    if (clientId) {
      const session = clientSessions.get(clientId);
      if (session?.stream) {
        try {
          session.stream.end();
        } catch {}
      }
      clientSessions.delete(clientId);
    }
    writeJson(response, 200, {
      ok: true,
      remainingClients: getActiveClientCount()
    });
  } catch (error) {
    writeJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
  }
}

function handleLauncherReopen(response) {
  if (!getActiveClientCount()) {
    writeJson(response, 409, { ok: false, reason: "no-active-clients" });
    return;
  }

  launcherSignalSequence += 1;
  broadcastLauncherEvent({
    type: "launcher-reopen",
    launchSignalSequence: launcherSignalSequence
  });
  writeJson(response, 202, {
    ok: true,
    launchSignalSequence: launcherSignalSequence
  });
}

function handleClientEvents(request, response, requestUrl) {
  const clientId = String(requestUrl.searchParams.get("clientId") || "").trim();
  if (!clientId) {
    writeJson(response, 400, { error: "clientId is required." });
    return;
  }

  launcherSawClient = true;
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });
  response.write(
    `event: ready\ndata: ${JSON.stringify({ launchSignalSequence: launcherSignalSequence })}\n\n`
  );

  const existingSession = clientSessions.get(clientId) || {};
  clientSessions.set(clientId, {
    ...existingSession,
    clientId,
    lastSeenAt: Date.now(),
    stream: response
  });

  request.on("close", () => {
    const session = clientSessions.get(clientId);
    if (session?.stream === response) {
      clientSessions.delete(clientId);
      checkLauncherIdleState();
    }
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const error = new Error(stderr || stdout || `Process exited with code ${code}.`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function getImageExtension(type = "", name = "", index = 0) {
  const extFromName = extname(name);
  if (extFromName) {
    return extFromName;
  }
  const map = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp"
  };
  return map[type] || `.img${index + 1}`;
}

function sanitizeFileName(value) {
  return value.replace(/[^a-z0-9._-]+/gi, "-");
}

function writeJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function getActiveClientCount() {
  const cutoff = Date.now() - clientLeaseTtlMs;
  let count = 0;
  for (const session of clientSessions.values()) {
    const hasLiveStream =
      session?.stream && !session.stream.destroyed && !session.stream.writableEnded;
    const hasRecentHeartbeat = Number(session?.lastSeenAt || 0) >= cutoff;
    if (hasLiveStream || hasRecentHeartbeat) {
      count += 1;
    }
  }
  return count;
}

function broadcastLauncherEvent(payload) {
  const message = `event: launch\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const [clientId, session] of clientSessions.entries()) {
    const stream = session?.stream;
    if (!stream || stream.destroyed || stream.writableEnded) {
      clientSessions.delete(clientId);
      continue;
    }
    stream.write(message);
  }
}

function checkLauncherIdleState() {
  if (!launcherMode || !launcherSawClient || getActiveClientCount() > 0) {
    return;
  }

  console.log("Launcher-mode server is idle. Shutting down.");
  idleTimer && clearInterval(idleTimer);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}

const idleTimer = launcherMode ? setInterval(checkLauncherIdleState, launcherIdleCheckMs) : null;

server.listen(port, () => {
  console.log(`CIFI Optimization Suite running at http://localhost:${port}`);
});
