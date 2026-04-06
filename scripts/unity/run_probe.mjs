import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..", "..");

const probeProject = path.join(root, "tools", "unity", "CifiAssetProbe", "CifiAssetProbe.csproj");
const probeOutputDir = path.join(root, "tools", "unity", "CifiAssetProbe", "bin", "probe-run");
const probeDll = path.join(probeOutputDir, "CifiAssetProbe.dll");

const sharedEnv = {
  ...process.env,
  DOTNET_CLI_HOME: path.join(root, ".dotnet"),
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
  DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  APPDATA: path.join(root, ".appdata"),
  NUGET_PACKAGES: path.join(root, ".nuget", "packages"),
};

const commandSets = {
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
};

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
    if (existsSync(probeDll)) {
      return;
    }
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
