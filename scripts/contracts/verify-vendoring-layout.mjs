import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const TOP_LEVEL_BUCKET_RULES = [
  { label: "top-level .deps/ bucket", test: (name) => name === ".deps" },
  { label: "top-level .vendor_*/ bucket", test: (name) => /^\.vendor_.+/.test(name) },
  { label: "top-level tmp*/ bucket", test: (name) => /^tmp/i.test(name) },
  { label: "top-level cache bucket", test: (name) => [".appdata", ".cache", ".local", ".wheelhouse", "__pycache__", ".pytest_cache"].includes(name) },
  { label: "top-level dependency cache bucket", test: (name) => [".dotnet", ".nuget"].includes(name) }
];

const IGNORED_LOCAL_BUCKETS = new Set([
  ".appdata",
  ".cache",
  ".dotnet",
  ".local",
  ".nuget",
  ".pytest_cache",
  "__pycache__"
]);

const TOLERATED_LEGACY_PATHS = new Map([
  [".deps", "temporary"],
  [".vendor_manual", "temporary"],
  [".vendor_py", "temporary"],
  [".wheelhouse", "temporary"]
]);

export async function verifyVendoringLayout(rootDir = repoRoot) {
  const topLevelDirectories = await listTopLevelDirectories(rootDir);
  const tolerated = [];
  const regressions = [];

  for (const directory of topLevelDirectories) {
    if (IGNORED_LOCAL_BUCKETS.has(directory)) {
      continue;
    }

    const matchedRule = TOP_LEVEL_BUCKET_RULES.find((rule) => rule.test(directory));
    if (!matchedRule) {
      continue;
    }

    const record = {
      path: directory,
      rule: matchedRule.label,
      classification: TOLERATED_LEGACY_PATHS.get(directory) ?? null
    };

    if (record.classification) {
      tolerated.push(record);
    } else {
      regressions.push(record);
    }
  }

  tolerated.sort((left, right) => left.path.localeCompare(right.path));
  regressions.sort((left, right) => left.path.localeCompare(right.path));

  return {
    tolerated,
    regressions
  };
}

async function listTopLevelDirectories(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await verifyVendoringLayout();

  if (result.regressions.length > 0) {
    console.error("Vendoring layout verification failed. New scattered cache/vendor buckets found:");
    for (const regression of result.regressions) {
      console.error(`- ${regression.path}: ${regression.rule}`);
    }
    if (result.tolerated.length > 0) {
      console.error("Tolerated legacy exceptions:");
      for (const tolerated of result.tolerated) {
        console.error(`- ${tolerated.path}: ${tolerated.rule} (${tolerated.classification})`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log("Vendoring layout verification passed.");
    if (result.tolerated.length > 0) {
      console.log("Tolerated legacy exceptions:");
      for (const tolerated of result.tolerated) {
        console.log(`- ${tolerated.path}: ${tolerated.rule} (${tolerated.classification})`);
      }
    }
  }
}
