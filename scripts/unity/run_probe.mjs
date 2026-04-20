import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const primaryRunner = path.join(__dirname, "run_extract.mjs");

console.warn(
  "[deprecated] scripts/unity/run_probe.mjs is now a compatibility wrapper. " +
    "Use scripts/unity/run_extract.mjs or the npm extract:* commands."
);

const result = spawnSync(process.execPath, [primaryRunner, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
