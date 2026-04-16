import {
  spawnSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync
} from "node:fs";
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
    .map((entry) => path.join(probeSourceDir, entry))
];

const sharedEnv = {
  ...process.env,
  DOTNET_CLI_HOME: path.join(root, ".dotnet"),
  DOTNET_SKIP_FIRST_TIME_EXPERIENCE: "1",
  DOTNET_CLI_TELEMETRY_OPTOUT: "1",
  APPDATA: path.join(root, ".appdata"),
  NUGET_PACKAGES: path.join(root, ".nuget", "packages")
};

// Command sets for probe execution - exposed for inspection
const commandSets = {
  build: [["uabea-rebuild", []]],
  uabea: [
    ["uabea-build", []],
    ["dotnet", [probeDll]]
  ],
  "shards:parameters": [
    ["python", [path.join(root, "scripts", "unity", "shard_cost_parameter_probe.py")]]
  ],
  "shards:type-metadata": [
    ["uabea-build", []],
    ["dotnet", [probeDll]],
    ["python", [path.join(root, "scripts", "unity", "shard_type_metadata_probe.py")]]
  ],
  "shards:method": [
    ["uabea-build", []],
    ["dotnet", [probeDll]],
    ["python", [path.join(root, "scripts", "unity", "shard_cost_method_probe.py")]]
  ],
  "shards:cost-native": [
    ["uabea-build", []],
    ["dotnet", [probeDll]],
    ["python", [path.join(root, "scripts", "unity", "shard_cost_method_probe.py")]],
    ["python", [path.join(root, "scripts", "unity", "shard_cost_parameter_probe.py")]],
    ["python", [path.join(root, "scripts", "unity", "shard_cost_native_probe.py")]]
  ],
  trace: [["python", [path.join(root, "scripts", "unity", "unity_trace_bundle.py")]]],
  compile: [["python", [path.join(root, "scripts", "compile_tokenshop_canonical.py")]]],
  pipeline: [
    ["uabea-build", []],
    ["dotnet", ["run", "--project", "{project}"]],
    ["python", ["scripts/unity/extract_analysis.py"]]
  ]
};

// Output directory for probe artifacts
const PROBE_OUTPUT_DIR = path.join(root, "workbench", "probes");

function ensureProbeOutputDir() {
  if (!existsSync(PROBE_OUTPUT_DIR)) {
    mkdirSync(PROBE_OUTPUT_DIR, { recursive: true });
  }
}

// Parse CLI arguments into a params object
function parseArgs(args) {
  const params = {
    target: null,
    anchors: [],
    family: null,
    level: "both",
    output: null,
    force: false,
    resume: false,
    continueOnError: false,
    chain: [],
    maxSteps: 5
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    if (arg === "--target" && nextArg) {
      params.target = nextArg;
      i++;
    } else if (arg === "--anchor" && nextArg) {
      params.anchors.push(nextArg);
      i++;
    } else if (arg === "--family" && nextArg) {
      params.family = nextArg;
      i++;
    } else if (arg === "--level" && nextArg) {
      params.level = nextArg;
      i++;
    } else if (arg === "--output" && nextArg) {
      params.output = nextArg;
      i++;
    } else if (arg === "--chain" && nextArg) {
      params.chain.push(nextArg);
      i++;
    } else if (arg === "--max-steps") {
      params.maxSteps = parseInt(args[i + 1]) || 5;
      i++;
    } else if (arg === "--force") {
      params.force = true;
    } else if (arg === "--resume") {
      params.resume = true;
    } else if (arg === "--continue-on-error") {
      params.continueOnError = true;
    }
  }

  return params;
}

// Generate timestamp for output naming
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// Generate output path based on convention
function generateOutputPath(params, defaultExt = "json") {
  if (params.output) {
    return path.resolve(root, params.output);
  }

  ensureProbeOutputDir();

  const target = params.target || "default";
  const timestamp = getTimestamp();
  const anchorSuffix =
    params.anchors.length > 0 ? "-" + params.anchors.join("-").replace(/[^a-zA-Z0-9]/g, "") : "";

  const outputDir = path.join(PROBE_OUTPUT_DIR, `${target}${anchorSuffix}`, timestamp);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}

// Command templates with parameter substitution
const commandTemplates = {
  // Build commands
  build: {
    steps: [["dotnet", ["build", "{project}", "-c", "Release", "-o", "{output}"]]],
    defaults: { project: probeProject, output: probeOutputDir }
  },
  "uabea-rebuild": {
    steps: [
      ["dotnet", ["restore", "{project}"]],
      ["dotnet", ["build", "{project}", "-c", "Release", "-o", "{output}"]]
    ],
    requires: ["project", "output"]
  },

  // Generic trace bundle with full parameterization
  trace: {
    steps: [["python", ["scripts/unity/unity_trace_bundle.py"]]],
    passThrough: true // Pass all args through to script
  },

  // Generic compile for canonical dataset
  compile: {
    steps: [["python", ["scripts/compile_tokenshop_canonical.py"]]],
    passThrough: true
  },

  // Generic pipeline for multi-step extraction
  pipeline: {
    steps: [
      ["uabea-build", []],
      ["dotnet", ["run", "--project", "{project}"]],
      ["python", ["scripts/unity/extract_analysis.py"]]
    ],
    requires: ["target", "anchors", "output"]
  },

  // Specialized commands (kept for backwards compatibility reference)
  "shards:parameters": {
    legacy: true,
    steps: [["python", ["scripts/unity/shard_cost_parameter_probe.py"]]]
  },
  "shards:type-metadata": {
    legacy: true,
    steps: [
      ["uabea-build", []],
      ["dotnet", [probeDll]],
      ["python", ["scripts/unity/shard_type_metadata_probe.py"]]
    ]
  },
  "shards:method": {
    legacy: true,
    steps: [
      ["uabea-build", []],
      ["dotnet", [probeDll]],
      ["python", ["scripts/unity/shard_cost_method_probe.py"]]
    ]
  },
  "shards:cost-native": {
    legacy: true,
    steps: [
      ["uabea-build", []],
      ["dotnet", [probeDll]],
      ["python", ["scripts/unity/shard_cost_method_probe.py"]],
      ["python", ["scripts/unity/shard_cost_parameter_probe.py"]],
      ["python", ["scripts/unity/shard_cost_native_probe.py"]]
    ]
  }
};

const commandSets = {
  // Legacy commands mapped to templates
  build: commandTemplates.build,
  uabea: { steps: [["dotnet", [probeDll]]] },
  "shards:parameters": commandTemplates["shards:parameters"],
  "shards:type-metadata": commandTemplates["shards:type-metadata"],
  "shards:method": commandTemplates["shards:method"],
  "shards:cost-native": commandTemplates["shards:cost-native"],

  // New generalized commands
  trace: commandTemplates.trace,
  compile: commandTemplates.compile,
  pipeline: commandTemplates.pipeline
};

function formatRepoPath(targetPath) {
  return path.relative(root, targetPath).split(path.sep).join("/");
}

function getNewestPath(paths) {
  return (
    [...paths]
      .filter((targetPath) => existsSync(targetPath))
      .map((targetPath) => ({ path: targetPath, mtimeMs: statSync(targetPath).mtimeMs }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)[0] ?? null
  );
}

function getProbeFreshness() {
  const missingOutputs = [probeDll, probeRuntimeConfig].filter(
    (targetPath) => !existsSync(targetPath)
  );
  if (missingOutputs.length > 0) {
    return { status: "missing", missingOutputs };
  }

  const newestSource = getNewestPath(probeSourceInputs);
  const builtDll = getNewestPath([probeDll]);
  if (newestSource && builtDll && newestSource.mtimeMs > builtDll.mtimeMs) {
    return { status: "stale", newestSource: newestSource.path, builtDll: builtDll.path };
  }

  return { status: "fresh" };
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
      env: sharedEnv,
      stdio: "ignore"
    });
    if (probe.status === 0) {
      return { command, prefixArgs };
    }
  }

  throw new Error(
    "Python 3 was not found on PATH. Install Python 3.11+ or expose `py -3`/`python` on PATH."
  );
}

function runCommand(command, args, options = {}) {
  const { force = false, continueOnError = false, outputPath = null } = options;

  if (command === "uabea-build") {
    const freshness = getProbeFreshness();
    if (freshness.status === "fresh") {
      console.log("Probe artifact is fresh, skipping build");
      return;
    }
    if (freshness.status === "missing") {
      runCommand("uabea-rebuild", []);
      return;
    }
    throw new Error(
      `Probe artifact is stale: ${formatRepoPath(freshness.newestSource)} is newer than ${formatRepoPath(freshness.builtDll)}. ` +
        "Rebuild with `npm run probe:build` before running probe commands."
    );
  }

  if (command === "uabea-rebuild") {
    runCommand("dotnet", ["restore", probeProject]);
    runCommand("dotnet", [
      "build",
      probeProject,
      "-c",
      "Release",
      "--no-restore",
      "-o",
      probeOutputDir
    ]);
    return;
  }

  const [resolvedCommand, resolvedArgs] =
    command === "python"
      ? (() => {
          const python = resolvePythonCommand();
          return [python.command, [...python.prefixArgs, ...args]];
        })()
      : [command, args];

  // Check for existing output if not forcing
  if (!force && outputPath && existsSync(outputPath)) {
    console.log(`Output exists: ${outputPath}, use --force to overwrite`);
    return;
  }

  const result = spawnSync(resolvedCommand, resolvedArgs, {
    cwd: root,
    env: sharedEnv,
    stdio: "inherit"
  });

  if (result.error) {
    if (result.error.code === "ENOENT" && resolvedCommand === "dotnet") {
      throw new Error(
        ".NET 8 SDK was not found on PATH. Install the .NET 8 SDK, then rerun `npm run probe:build`."
      );
    }
    if (!continueOnError) {
      throw result.error;
    }
    console.warn(`Warning: Command failed but continuing: ${command}`);
  }

  if (result.status !== 0 && !continueOnError) {
    process.exit(result.status ?? 1);
  }
}

function substituteParams(template, params, defaults = {}) {
  let result = template;
  const allParams = { ...defaults, ...params };

  for (const [key, value] of Object.entries(allParams)) {
    if (value !== null && value !== undefined) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, "g"), String(value));
    }
  }

  return result;
}

function printUsage() {
  console.error("Usage: node scripts/unity/run_probe.mjs <command> [options]");
  console.error("");
  console.error("Commands:");
  console.error("  build                 - Build C# probe (uabea)");
  console.error("  uabea                 - Run uabea probe");
  console.error("  trace                 - Run trace bundle (generalized)");
  console.error("  compile               - Compile canonical dataset");
  console.error("  pipeline              - Run multi-step extraction pipeline");
  console.error("");
  console.error("Legacy Commands (backwards compatible):");
  console.error("  shards:parameters     - Extract shard parameter fields");
  console.error("  shards:type-metadata  - Extract shard type metadata");
  console.error("  shards:method         - Extract shard method data");
  console.error("  shards:cost-native   - Full shard cost extraction");
  console.error("");
  console.error("Options:");
  console.error("  --target <id>         - Target identifier (e.g., token-shop-atu3-cells)");
  console.error("  --anchor <value>      - Anchor to trace (can be specified multiple times)");
  console.error(
    "  --family <name>       - Trace family (token-shop, shard-owned-state, multiverse-market)"
  );
  console.error("  --level <level>       - Output level: raw, structured, both (default: both)");
  console.error("  --output <path>       - Output file path");
  console.error("  --chain <script>      - Additional script to run in chain (can repeat)");
  console.error("  --max-steps <n>       - Maximum analysis steps (default: 5)");
  console.error("  --force               - Force regeneration even if output exists");
  console.error("  --resume              - Resume from previous output if available");
  console.error("  --continue-on-error   - Continue pipeline even if a step fails");
  console.error("");
  console.error("Examples:");
  console.error(
    "  node scripts/unity/run_probe.mjs trace --target token-shop-atu3-cells --anchor ATU3Button --family token-shop"
  );
  console.error(
    "  node scripts/unity/run_probe.mjs trace --target shard-owned-state --anchor upgradeInfoList --family shard-owned-state --level structured"
  );
  console.error(
    "  node scripts/unity/run_probe.mjs compile --output data/tokenshop-canonical-v1.json"
  );
  console.error(
    "  node scripts/unity/run_probe.mjs pipeline --target TokenShop --anchors ATU1Button ATU2Button --output data/test.json --force"
  );
}

const commandName = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!commandName || !(commandName in commandSets)) {
  printUsage();
  process.exit(commandName ? 1 : 0);
}

// Parse extra args into params
const params = parseArgs(extraArgs);

// Get output path for this command
const outputPath = generateOutputPath(params);

// Handle pass-through commands (trace, compile)
const commandConfig = commandSets[commandName];
if (commandConfig.passThrough) {
  // Pass all args through to script
  runCommand(commandConfig.steps[0][0], [...commandConfig.steps[0][1], ...extraArgs], {
    force: params.force,
    continueOnError: params.continueOnError,
    outputPath
  });
  process.exit(0);
}

// Handle legacy/simple commands
if ((commandName === "uabea" || commandName.startsWith("shards:")) && !existsSync(probeProject)) {
  throw new Error(`Missing probe project: ${probeProject}`);
}

const pipeline = commandSets[commandName].steps;
for (const [index, [command, templateArgs]] of pipeline.entries()) {
  // Substitute parameters in template
  let args = templateArgs.map((arg) => substituteParams(arg, params, commandConfig.defaults || {}));

  // For last step in pipeline, add extra CLI args
  if (index === pipeline.length - 1 && extraArgs.length > 0) {
    // Filter out options that were already parsed into params
    const rawArgs = extraArgs.filter((arg) => arg.startsWith("--"));
    args = [...args, ...rawArgs];
  }

  console.log(`[${index + 1}/${pipeline.length}] Running: ${command} ${args.join(" ")}`);

  runCommand(command, args, {
    force: params.force,
    continueOnError: params.continueOnError,
    outputPath: index === pipeline.length - 1 ? outputPath : null
  });
}

console.log(`\nDone. Output: ${outputPath}`);
