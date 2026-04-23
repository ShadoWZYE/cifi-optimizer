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

  // Direct C# AssetProbe execution with performance flags
  asset: {
    steps: [["dotnet", ["run", "--project", probeProject, "--no-build"]]],
    passThrough: true
  },

  // Build and run C# AssetProbe
  "asset:run": {
    steps: [
      ["dotnet", ["build", probeProject, "-c", "Release", "-o", probeOutputDir]],
      ["dotnet", ["run", "--project", probeProject, "--no-build", "--"]]
    ],
    passThrough: true,
    passThroughOnStep: 1 // Only pass args to second step
  },

  // Compile active exported system units from committed data plus DB-backed views
  compile: {
    steps: [["node", ["scripts/contracts/generate-system-units.mjs"]]],
    passThrough: true
  }
};

const commandSets = {
  // Legacy commands mapped to templates
  build: commandTemplates.build,
  uabea: { steps: [["dotnet", [probeDll]]] },

  // New generalized commands
  trace: commandTemplates.trace,
  compile: commandTemplates.compile,

  // C# AssetProbe commands
  asset: commandTemplates.asset,
  "asset:run": commandTemplates["asset:run"]
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
      `Extraction artifact is stale: ${formatRepoPath(freshness.newestSource)} is newer than ${formatRepoPath(freshness.builtDll)}. ` +
        "Rebuild with `npm run extract:build` before running asset extraction commands."
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
        ".NET 8 SDK was not found on PATH. Install the .NET 8 SDK, then rerun `npm run extract:build`."
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

function parseArgs(args) {
  const params = { force: false, continueOnError: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--force") {
      params.force = true;
    } else if (arg === "--continue-on-error") {
      params.continueOnError = true;
    } else if (arg === "--target" && args[i + 1]) {
      params.target = args[i + 1];
      i++;
    } else if (arg === "--anchors" || arg === "--anchor") {
      if (!params.anchors) params.anchors = [];
      params.anchors.push(args[i + 1]);
      i++;
    } else if (arg === "--family" && args[i + 1]) {
      params.family = args[i + 1];
      i++;
    } else if (arg === "--level" && args[i + 1]) {
      params.level = args[i + 1];
      i++;
    } else if (arg === "--output" && args[i + 1]) {
      params.output = args[i + 1];
      i++;
    } else if (arg === "--query" && args[i + 1]) {
      params.query = args[i + 1];
      i++;
    }
  }
  return params;
}

function printUsage() {
  console.error("Usage: node scripts/unity/run_extract.mjs <command> [options]");
  console.error("");
  console.error("Primary commands:");
  console.error("  build                 - Build the C# asset extractor");
  console.error("  uabea                 - Run the built C# asset extractor");
  console.error("  asset                 - Run C# asset extraction directly (requires build)");
  console.error("  asset:run             - Build and run C# asset extraction in one command");
  console.error("  trace                 - Materialize a DB-backed target bundle");
  console.error("  compile               - Export active system-unit datasets");
  console.error("");
  console.error("C# asset extraction performance flags (use with asset/asset:run):");
  console.error("  --quick               - Metadata only, no fields/methods (fastest)");
  console.error("  --no-metadata         - Skip Cpp2IL load, use cache if available");
  console.error("  --term <name>          - Only process types matching name");
  console.error("");
  console.error("Options:");
  console.error("  --target <id>         - Target identifier (e.g., token-shop-atu3-cells-effect)");
  console.error("  --family <name>       - Family shortcut (e.g., token-shop, shard-cost)");
  console.error("  --anchor <value>      - Anchor to trace (can be specified multiple times)");
  console.error("  --level <level>       - Output level: raw, structured, both (default: both)");
  console.error("  --output <path>       - Output file path");
  console.error("  --force               - Force regeneration even if output exists");
  console.error("  --resume              - Resume from previous output if available");
  console.error("");
  console.error("Examples:");
  console.error(
    "  node scripts/unity/run_extract.mjs trace --target token-shop-atu3-cells-effect --anchor ATU3Button --family token-shop"
  );
  console.error("  node scripts/unity/run_extract.mjs trace --family token-shop");
  console.error("  node scripts/unity/run_extract.mjs compile");
  console.error(
    "  node scripts/unity/run_extract.mjs asset:run --quick -- --report data/archive/uabea-extract-report.json"
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

// Handle pass-through commands (trace, compile)
const commandConfig = commandSets[commandName];
if (commandConfig.passThrough) {
  // Determine which step gets the pass-through args
  const targetStepIndex = commandConfig.passThroughOnStep ?? 0;
  const targetStep = commandConfig.steps[targetStepIndex];

  // For probe commands, pass raw args through after --
  // Extract raw args (everything after -- if present)
  const dashDashIndex = extraArgs.indexOf("--");
  const rawArgs = dashDashIndex >= 0 ? extraArgs.slice(dashDashIndex + 1) : extraArgs;

  runCommand(targetStep[0], [...targetStep[1], ...rawArgs], {
    force: params.force,
    continueOnError: params.continueOnError,
    outputPath: params.output || null
  });
  process.exit(0);
}

// Get output path for this command
const outputPath = params.output || null;

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
