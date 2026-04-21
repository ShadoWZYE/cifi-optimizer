import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function writeJson(relativePath, value) {
  const outputPath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compactCpp2IlStatus(status = {}) {
  return {
    configured: Boolean(status.configured),
    generatorType: status.generatorType ?? null,
    libCpp2IlAssembly: status.libCpp2IlAssembly ?? null,
    initialized: Boolean(status.initialized),
    initializeCallSucceeded: Boolean(status.initializeCallSucceeded),
    initializeCallError: status.initializeCallError?.message ?? null
  };
}

function buildUabeaTypeMetadataSupport(report) {
  const targets = Array.isArray(report.directTargetTypeMetadata)
    ? report.directTargetTypeMetadata
    : [];
  const retainedTypeMetadata = targets.filter((entry) =>
    [
      "ShardMining",
      "ShardPerLevelTextHandler",
      "TextHandlerShardMilestoneBonusesPerLevel",
      "ShardUpgradeInfo",
      "PlayerProfileHandler",
      "PlayerProfileData",
      "SaveData",
      "CloudSavePlayerProfile",
      "MultiverseMarket",
      "Inscryption",
      "InscryptionTupleObject"
    ].includes(entry?.scriptName)
  );

  return {
    dataset: "uabea-type-metadata-support.v1",
    generatedAt: "2026-04-20",
    source: {
      rawReport: "data/uabea-extract-report.json",
      extractionCommand:
        "node scripts/unity/run_extract.mjs asset:run --quick -- --report data/uabea-extract-report.json"
    },
    purpose:
      "Compact typed-metadata support core derived from the larger UABEA extract report. This preserves the typed type, field, and method slices still referenced by extractor/debug workflows without keeping the full raw object-hit export on the active support surface.",
    unityVersion: report.unityVersion ?? null,
    loadedFileCount: report.loadedFileCount ?? null,
    cpp2IlStatus: compactCpp2IlStatus(report.cpp2IlStatus),
    directLibCpp2IlProbe: {
      attempted: Boolean(report.directLibCpp2IlProbe?.attempted),
      loadFromFileResult: Boolean(report.directLibCpp2IlProbe?.loadFromFileResult),
      assemblyCSharpFound: Boolean(report.directLibCpp2IlProbe?.assemblyCSharpFound)
    },
    retainedTypeCount: retainedTypeMetadata.length,
    retainedTextAssets: (Array.isArray(report.textAssetHits) ? report.textAssetHits : []).map(
      (entry) => ({
        name: entry?.name ?? entry?.objectName ?? null,
        assetsFile: entry?.assetsFile ?? null,
        size: entry?.size ?? null
      })
    ),
    directTargetTypeMetadata: retainedTypeMetadata,
    currentBoundary: [
      "Treat this file as the committed typed support core for extractor/debug workflows that still need exact LibCpp2IL field or method tables.",
      "Treat data/uabea-extract-report.json as the larger raw export and historical derivation source, not as the default active support surface.",
      "Do not expand app/runtime consumers back to the full raw report when the reduced boundary/support datasets already preserve the needed semantics."
    ]
  };
}

async function main() {
  const uabeaReport = await readJson("data/uabea-extract-report.json");
  const uabeaSupport = buildUabeaTypeMetadataSupport(uabeaReport);
  await writeJson("data/uabea-type-metadata-support.v1.json", uabeaSupport);
  console.log("Generated extract-report support datasets:");
  console.log("- data/uabea-type-metadata-support.v1.json");
}

await main();
