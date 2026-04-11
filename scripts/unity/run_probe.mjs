import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const probeProject = path.join(root, "tools", "unity", "CifiAssetProbe", "CifiAssetProbe.csproj");
const probeSourceDir = path.join(root, "tools", "unity", "CifiAssetProbe");
const probeOutputDir = path.join(root, "tools", "unity", "CifiAssetProbe", "bin", "probe-run");
const probeDll = path.join(probeOutputDir, "CifiAssetProbe.dll");
const probeRuntimeConfig = path.join(probeOutputDir, "CifiAssetProbe.runtimeconfig.json");
const probeSourceInputs = [
  probeProject,
  path.join(probeSourceDir, "NuGet.Config"),
  ...readdirSync(probeSourceDir)
    .filter((entry) => entry.toLowerCase().endsWith(".cs"))
    .map((entry) => path.join(probeSourceDir, entry)),
];

const sharedEnv = {
  ...process.env,
  DOTNET_CLI_HOME: path.join(root, ".dotnet"),
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
  DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  APPDATA: path.join(root, ".appdata"),
  NUGET_PACKAGES: path.join(root, ".nuget", "packages"),
};

const commandSets = {
  "build": [
    ["uabea-rebuild", []],
  ],
  "uabea": [
    ["uabea-build", []],
    ["dotnet", [probeDll]],
  ],
  "shards:parameters": [
    ["python", [path.join(root, "scripts", "unity", "shard_cost_parameter_probe.py")]],
  ],
  "shards:type-metadata": [
    ["uabea-build", []],
    ["dotnet", [probeDll]],
    ["python", [path.join(root, "scripts", "unity", "shard_type_metadata_probe.py")]],
  ],
  "shards:method": [
    ["uabea-build", []],
    ["dotnet", [probeDll]],
    ["python", [path.join(root, "scripts", "unity", "shard_cost_method_probe.py")]],
  ],
  "shards:cost-native": [
    ["uabea-build", []],
    ["dotnet", [probeDll]],
    ["python", [path.join(root, "scripts", "unity", "shard_cost_method_probe.py")]],
    ["python", [path.join(root, "scripts", "unity", "shard_cost_parameter_probe.py")]],
    ["python", [path.join(root, "scripts", "unity", "shard_cost_native_probe.py")]],
  ],
  "token-shop:remap-joins": [
    ["python", [path.join(root, "scripts", "unity", "token_shop_remap_join_probe.py")]],
  ],
};

function formatRepoPath(targetPath) {
  return path.relative(root, targetPath).split(path.sep).join("/");
}

function getNewestPath(paths) {
  return [...paths]
    .filter((targetPath) => existsSync(targetPath))
    .map((targetPath) => ({ path: targetPath, mtimeMs: statSync(targetPath).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0] ?? null;
}

function getProbeFreshness() {
  const missingOutputs = [probeDll, probeRuntimeConfig].filter((targetPath) => !existsSync(targetPath));
  if (missingOutputs.length > 0) {
    return {
      status: "missing",
      missingOutputs,
    };
  }

  const newestSource = getNewestPath(probeSourceInputs);
  const builtDll = getNewestPath([probeDll]);
  if (newestSource && builtDll && newestSource.mtimeMs > builtDll.mtimeMs) {
    return {
      status: "stale",
      newestSource: newestSource.path,
      builtDll: builtDll.path,
    };
  }

  return { status: "fresh" };
}

function resolvePythonCommand() {
  const candidates = process.platform === "win32"
    ? [["python", []], ["py", ["-3"]]]
    : [["python3", []], ["python", []]];

  for (const [command, prefixArgs] of candidates) {
    const probe = spawnSync(command, [...prefixArgs, "--version"], {
      cwd: root,
      env: sharedEnv,
      stdio: "ignore",
    });
    if (probe.status === 0) {
      return { command, prefixArgs };
    }
  }

  throw new Error("Python 3 was not found on PATH. Install Python 3.11+ or expose `py -3`/`python` on PATH.");
}

function runCommand(command, args) {
  if (command === "uabea-build") {
    const freshness = getProbeFreshness();
    if (freshness.status === "fresh") {
      return;
    }
    if (freshness.status === "missing") {
      runCommand("uabea-rebuild", []);
      return;
    }
    throw new Error(
      `Probe artifact is stale: ${formatRepoPath(freshness.newestSource)} is newer than ${formatRepoPath(freshness.builtDll)}. `
      + "Rebuild with `npm run probe:build` before running probe commands."
    );
  }

  if (command === "uabea-rebuild") {
    runCommand("dotnet", ["restore", probeProject]);
    runCommand("dotnet", ["build", probeProject, "-c", "Release", "--no-restore", "-o", probeOutputDir]);
    return;
  }

  const [resolvedCommand, resolvedArgs] = command === "python"
    ? (() => {
        const python = resolvePythonCommand();
        return [python.command, [...python.prefixArgs, ...args]];
      })()
    : [command, args];

  const result = spawnSync(resolvedCommand, resolvedArgs, {
    cwd: root,
    env: sharedEnv,
    stdio: "inherit",
  });

  if (result.error) {
    if (result.error.code === "ENOENT" && resolvedCommand === "dotnet") {
      throw new Error(
        ".NET 8 SDK was not found on PATH. Install the .NET 8 SDK, then rerun `npm run probe:build`."
      );
    }
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function printUsage() {
  console.error("Usage: node scripts/unity/run_probe.mjs <command>");
  console.error("");
  console.error("Commands:");
  for (const name of Object.keys(commandSets)) {
    console.error(`  ${name}`);
  }
}

const commandName = process.argv[2];
if (!commandName || !(commandName in commandSets)) {
  printUsage();
  process.exit(commandName ? 1 : 0);
}

if ((commandName === "uabea" || commandName.startsWith("shards:")) && !existsSync(probeProject)) {
  throw new Error(`Missing probe project: ${probeProject}`);
}

for (const [command, args] of commandSets[commandName]) {
  runCommand(command, args);
}
