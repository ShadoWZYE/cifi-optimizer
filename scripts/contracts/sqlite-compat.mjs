import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const queryScriptPath = path.join(repoRoot, "scripts", "contracts", "sqlite_json_query.py");
let DatabaseSync = null;

try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  DatabaseSync = null;
}

function candidatePythonCommands() {
  const explicit = process.env.PYTHON || process.env.PYTHON3;
  return [explicit, "python3", "python", "py"].filter(Boolean);
}

function runPythonSqlite(dbPath, mode, sql, params = []) {
  let lastFailure = null;
  for (const command of candidatePythonCommands()) {
    const result = spawnSync(
      command,
      [queryScriptPath, dbPath, mode, sql, JSON.stringify(params)],
      {
        encoding: "utf8"
      }
    );
    if (result.error) {
      lastFailure = result.error;
      continue;
    }
    if (result.status !== 0) {
      lastFailure = new Error(
        result.stderr || result.stdout || `sqlite helper failed via ${command}`
      );
      continue;
    }
    return result.stdout ? JSON.parse(result.stdout) : null;
  }
  throw new Error(
    `Unable to execute sqlite helper script. Last failure: ${lastFailure instanceof Error ? lastFailure.message : String(lastFailure)}`
  );
}

export function queryOne(dbPath, sql, params = []) {
  if (DatabaseSync) {
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA busy_timeout=30000");
    try {
      return db.prepare(sql).get(...params);
    } finally {
      db.close();
    }
  }
  return runPythonSqlite(dbPath, "one", sql, params);
}

export function queryAll(dbPath, sql, params = []) {
  if (DatabaseSync) {
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA busy_timeout=30000");
    try {
      return db.prepare(sql).all(...params);
    } finally {
      db.close();
    }
  }
  return runPythonSqlite(dbPath, "all", sql, params);
}
