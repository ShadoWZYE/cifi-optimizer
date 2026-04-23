import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { cwd } from "node:process";
import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import {
  createGeneratorOcrStageError,
  createMissingGeneratorOcrScriptError,
  resolveGeneratorOcrScriptPath
} from "./ocr/generator-ocr-support.mjs";

const root = cwd();
const port = Number(process.env.PORT || 4173);
const cacheDbPath = join(root, "workbench", "ghidra-cache", "ghidra_cache.sqlite3");
const launcherMode =
  process.env.CIFI_LAUNCH_MODE === "1" || process.argv.includes("--launcher-mode");
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
  systemUnitApi: true
})};</script>`;

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

function handleSystemUnits(response, requestUrl) {
  const requestedIds = String(requestUrl.searchParams.get("ids") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const systemIds = requestedIds.length
    ? requestedIds
    : ["app-meta", "player-state", "shards", "token-shop", "multiverse-market"];
  try {
    const result = withCacheDb((db) => {
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
    if (result.missing.length) {
      writeJson(response, 503, {
        error: "Missing DB-backed system-unit views.",
        source: "materialized_system_unit_views",
        missingIds: result.missing
      });
      return;
    }
    writeJson(response, 200, {
      source: "materialized_system_unit_views",
      mode: "db",
      builtAt: result.builtAt,
      units: result.units
    });
  } catch (error) {
    writeJson(response, 500, {
      error: error instanceof Error ? error.message : String(error),
      source: "materialized_system_unit_views"
    });
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
    const child = spawn(command, args, { cwd: root });
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

function writeJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
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
