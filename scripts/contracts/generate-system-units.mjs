import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import {
  createDefaultPlayerProfile,
  PLAYER_PROFILE_SCHEMA_VERSION,
  QUARANTINED_MULTIVERSE_MARKET_STATUS
} from "../../player-profile.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataRoot = path.join(repoRoot, "data");
const outputRoot = path.join(dataRoot, "system-units");
const dbPath = path.join(repoRoot, "workbench", "ghidra-cache", "ghidra_cache.sqlite3");
const level0Path = path.join(repoRoot, "workbench", "unity", "joined", "level0");
const metadataPath = path.join(repoRoot, "workbench", "apk", "base", "global-metadata.dat");

const MULTIVERSE_MARKET_ABSOLUTE_OFFSET = 33_216_256;
const MULTIVERSE_MARKET_OBJECT_SIZE = 39_412;
const MULTIVERSE_LATE_BLOCK_START = 19_288;
const MULTIVERSE_LATE_BLOCK_STRIDE = 328;
const MULTIVERSE_LATE_BLOCK_SCAN_START = 50;
const MULTIVERSE_LATE_BLOCK_SCAN_END = 110;
const TOKEN_SHOP_ABSOLUTE_OFFSET = 32_801_984;
const TOKEN_SHOP_FIELD_OFFSET = 236;
const TOKEN_METADATA_START = 661_500;
const TOKEN_METADATA_END = 666_400;
const TOKEN_POINTER_SUFFIXES = [
  "Object",
  "Notification",
  "Text",
  "Fill",
  "Button",
  "MaxOverlay",
  "Content",
  "Overlay"
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function writeJson(relativePath, value) {
  const outputPath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const rawBinaryCache = new Map();

async function readRawBinary(relativePath) {
  if (!rawBinaryCache.has(relativePath)) {
    rawBinaryCache.set(relativePath, readFile(path.join(repoRoot, relativePath)));
  }
  return rawBinaryCache.get(relativePath);
}

async function pathExists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

function withDb(fn) {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout=30000");
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function fetchLatestMaterializedTargetBundle(traceScope) {
  return withDb((db) => {
    const row = db
      .prepare(`
        SELECT trace_scope, request_signature, payload_json, provenance_json, reducer_version, built_at
        FROM materialized_target_bundle_views
        WHERE project_name = ? AND project_file = ? AND trace_scope = ?
        ORDER BY built_at DESC, request_signature DESC
        LIMIT 1
      `)
      .get("cifi-full", "libil2cpp.so", traceScope);
    if (!row) {
      throw new Error(
        `Missing materialized target bundle view for trace scope "${traceScope}". ` +
          `Refresh DB-backed trace materializations before generating system units.`
      );
    }
    return {
      traceScope: row.trace_scope,
      requestSignature: row.request_signature,
      payload: JSON.parse(row.payload_json),
      provenance: row.provenance_json ? JSON.parse(row.provenance_json) : {},
      reducerVersion: row.reducer_version,
      builtAt: row.built_at
    };
  });
}

function sanitizeTraceSemanticScope(scope) {
  if (!scope || typeof scope !== "object") {
    return scope;
  }
  const looksLikeTokenShopRowScope =
    String(scope.familyId || "") === "token-shop" ||
    String(scope.scopeId || "").startsWith("row:") ||
    "rowLocalGraph" in scope ||
    "missingSeams" in scope ||
    "closureStatus" in scope ||
    "literalSchemaRecovery" in scope ||
    "literalTextRecovery" in scope;
  if (!looksLikeTokenShopRowScope) {
    return scope;
  }
  return {
    scopeId: scope.scopeId ?? null,
    scopeType: scope.scopeType ?? null,
    familyId: scope.familyId ?? null,
    targetId: scope.targetId ?? null,
    traceScope: scope.traceScope ?? null,
    rowShellField: scope.rowShellField ?? null,
    rowLocalGraph: scope.rowLocalGraph ?? {},
    missingSeams: Array.isArray(scope.missingSeams) ? scope.missingSeams : [],
    semanticGraph: scope.semanticGraph ?? {},
    semanticSearchPlan: scope.semanticSearchPlan ?? {},
    compatibilityStatus: scope.compatibilityStatus ?? {},
    updatedAt: scope.updatedAt ?? null,
    support: scope.support ?? {}
  };
}

function sanitizeTraceBundleExport(payload) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const clone = JSON.parse(JSON.stringify(payload));
  if (clone.plannerResolution && typeof clone.plannerResolution === "object") {
    const plannerResolution = clone.plannerResolution;
    const traceRegistry =
      clone.traceRegistry && typeof clone.traceRegistry === "object" ? clone.traceRegistry : {};
    const target = clone.target && typeof clone.target === "object" ? clone.target : {};
    const selectedSubjectKind =
      plannerResolution.selectedSubjectKind ??
      traceRegistry.selectedSubjectKind ??
      target.selectedSubjectKind ??
      null;
    const selectedSubjectKey =
      plannerResolution.selectedSubjectKey ??
      traceRegistry.selectedSubjectKey ??
      target.selectedSubjectKey ??
      null;
    if (plannerResolution.selectionMode === "explicit-target" && !selectedSubjectKind && !selectedSubjectKey) {
      plannerResolution.selectionMode = "archive-explicit-target";
      plannerResolution.decisionNote =
        "Archived compatibility trace run preserved from the pre-DB-subject planner path.";
      plannerResolution.selectedSubjectKind = "archive-target";
      plannerResolution.selectedSubjectKey =
        target.executionTraceScope ?? target.traceScope ?? target.targetId ?? target.id ?? null;
    }
  }
  if (clone.traceRegistry && typeof clone.traceRegistry === "object") {
    delete clone.traceRegistry.compatibilityTargetId;
    clone.traceRegistry.executionTraceScope =
      clone.traceRegistry.executionTraceScope ??
      clone.target?.executionTraceScope ??
      clone.target?.traceScope ??
      null;
    clone.traceRegistry.executionTargetId =
      clone.traceRegistry.executionTargetId ??
      clone.target?.executionTargetId ??
      clone.target?.targetId ??
      clone.target?.id ??
      null;
    clone.traceRegistry.selectedSubjectKind =
      clone.traceRegistry.selectedSubjectKind ??
      clone.plannerResolution?.selectedSubjectKind ??
      clone.target?.selectedSubjectKind ??
      null;
    clone.traceRegistry.selectedSubjectKey =
      clone.traceRegistry.selectedSubjectKey ??
      clone.plannerResolution?.selectedSubjectKey ??
      clone.target?.selectedSubjectKey ??
      null;
  }
  const dependencySystemView = clone?.systemViews?.dependency_fragment;
  if (dependencySystemView && typeof dependencySystemView === "object" && dependencySystemView.semanticScope) {
    dependencySystemView.semanticScope = sanitizeTraceSemanticScope(dependencySystemView.semanticScope);
  }
  const groupedDependencyViews = clone?.canonicalSemanticViews?.dependency_fragment;
  if (groupedDependencyViews && typeof groupedDependencyViews === "object") {
    for (const dependencyPayload of Object.values(groupedDependencyViews)) {
      if (dependencyPayload && typeof dependencyPayload === "object" && dependencyPayload.semanticScope) {
        dependencyPayload.semanticScope = sanitizeTraceSemanticScope(dependencyPayload.semanticScope);
      }
    }
  }
  const groupedScopeViews = clone?.canonicalSemanticViews?.semantic_scope_fragment;
  if (groupedScopeViews && typeof groupedScopeViews === "object") {
    for (const [scopeKey, scopePayload] of Object.entries(groupedScopeViews)) {
      groupedScopeViews[scopeKey] = sanitizeTraceSemanticScope(scopePayload);
    }
  }
  const systemScopeView = clone?.systemViews?.semantic_scope_fragment;
  if (systemScopeView && typeof systemScopeView === "object") {
    clone.systemViews.semantic_scope_fragment = sanitizeTraceSemanticScope(systemScopeView);
  }
  return clone;
}

function scrubTraceCompatibilityBlobs(node) {
  if (!node || typeof node !== "object") {
    if (node === "data/unity-trace-target-registry.json") {
      return "archive:unity-trace-target-registry.json";
    }
    return node;
  }
  if (Array.isArray(node)) {
    return node.map((entry) => scrubTraceCompatibilityBlobs(entry));
  }
  const clone = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "semanticScope") {
      clone[key] = sanitizeTraceSemanticScope(value);
      continue;
    }
    if (key === "semantic_scope_fragment" && value && typeof value === "object") {
      if (
        "scopeId" in value ||
        "rowLocalGraph" in value ||
        "closureStatus" in value ||
        "literalSchemaRecovery" in value ||
        "literalTextRecovery" in value
      ) {
        clone[key] = sanitizeTraceSemanticScope(value);
      } else {
        clone[key] = Object.fromEntries(
          Object.entries(value).map(([scopeKey, scopeValue]) => [
            scopeKey,
            sanitizeTraceSemanticScope(scopeValue)
          ])
        );
      }
      continue;
    }
    clone[key] = scrubTraceCompatibilityBlobs(value);
  }
  return clone;
}

function fetchMaterializedSystemUnitPayload(systemId, version) {
  return withDb((db) => {
    const row = db
      .prepare(
        `
          SELECT payload_json
          FROM materialized_system_unit_views
          WHERE system_id = ? AND version = ?
        `
      )
      .get(systemId, version);
    return row?.payload_json ? JSON.parse(row.payload_json) : null;
  });
}

function upsertMaterializedSystemUnit(systemId, version, payload, exportedPath) {
  const provenance = {
    systemId,
    version,
    generatedBy: payload?.generatedBy ?? null,
    exportedPath,
    sourceModel: "db-first-system-unit-export"
  };
  withDb((db) => {
    db.prepare(`
      INSERT INTO materialized_system_unit_views(
        system_id, version, payload_json, provenance_json, reducer_version, built_at, exported_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(system_id, version) DO UPDATE SET
        payload_json = excluded.payload_json,
        provenance_json = excluded.provenance_json,
        reducer_version = excluded.reducer_version,
        built_at = excluded.built_at,
        exported_path = excluded.exported_path
    `).run(
      systemId,
      version,
      JSON.stringify(payload),
      JSON.stringify(provenance),
      "system-unit-v1",
      new Date().toISOString(),
      exportedPath
    );
  });
}

function fetchTracePromotionTargetsFromDb() {
  return withDb((db) => {
    const rows = db
      .prepare(
        `
          SELECT trace_scope, payload_json
          FROM materialized_target_bundle_views
          WHERE project_name = ? AND project_file = ?
        `
      )
      .all("cifi-full", "libil2cpp.so");
    const targetIds = new Set();
    const familyIds = new Set();
    const subjects = [];
    for (const row of rows) {
      const payload = row?.payload_json ? JSON.parse(row.payload_json) : {};
      const target = payload?.target ?? {};
      const targetId = String(target?.id || row?.trace_scope || "").trim();
      const familyId = String(target?.familyId || "").trim();
      if (targetId) {
        targetIds.add(targetId);
      }
      if (familyId) {
        familyIds.add(familyId);
      }
      if (targetId || familyId) {
        subjects.push({
          traceScope: String(row?.trace_scope || targetId || "").trim(),
          targetId,
          familyId,
          label: String(target?.label || targetId || row?.trace_scope || "").trim()
        });
      }
    }
    subjects.sort((left, right) => left.traceScope.localeCompare(right.traceScope));
    return {
      sourcePath: "db:derived:trace-promotion-targets",
      provenanceSources: ["db:materialized-target-bundle"],
      targetIds: [...targetIds].sort(),
      familyIds: [...familyIds].sort(),
      subjects
    };
  });
}

function groupAliasesById(aliasAudit) {
  return Object.fromEntries(
    (Array.isArray(aliasAudit.groups) ? aliasAudit.groups : []).map((group) => [group.id, group])
  );
}

function pickPlayerStateDefaults(defaultProfile) {
  return {
    meta: defaultProfile.meta,
    player: defaultProfile.player,
    planning: defaultProfile.planning,
    notes: defaultProfile.notes,
    externalModels: defaultProfile.externalModels,
    compatibility: defaultProfile.compatibility
  };
}

async function buildPlayerStateUnit() {
  const unitInventory = await readJson("data/units/player-state.v1.json");
  const snapshot = await readJson("data/game-data.snapshot.v1.json");
  const aliasAudit = await readJson("data/player-profile-import-aliases.v1.json");
  const aliasGroups = groupAliasesById(aliasAudit);
  const defaultProfile = createDefaultPlayerProfile();

  const sections = {
    canonicalSharedTruth: {
      schemaVersion: PLAYER_PROFILE_SCHEMA_VERSION,
      defaultShape: {
        meta: defaultProfile.meta,
        player: defaultProfile.player,
        notes: defaultProfile.notes
      },
      aliasGroup: aliasGroups.canonical ?? null,
      snapshotReference: {
        snapshotVersion: snapshot.snapshotVersion,
        researchTracks: Array.isArray(snapshot.researchTracks) ? snapshot.researchTracks.length : 0,
        validationCases: Array.isArray(snapshot.validationCases)
          ? snapshot.validationCases.length
          : 0
      },
      provenanceSources: ["snapshot", "player-profile-normalizer", "player-profile-schema-doc"]
    },
    plannerHelpers: {
      defaultShape: defaultProfile.planning,
      aliasGroup: aliasGroups.planner ?? null,
      provenanceSources: ["player-profile-alias-audit", "player-profile-normalizer"]
    },
    externalModels: {
      defaultShape: defaultProfile.externalModels,
      aliasGroups: [aliasGroups.externalModel, aliasGroups.experimental, aliasGroups.shipCalibration]
        .filter(Boolean),
      provenanceSources: ["player-profile-alias-audit", "player-profile-normalizer"]
    },
    compatibilityImports: {
      defaultShape: defaultProfile.compatibility,
      aliasGroup: aliasGroups.compatibility ?? null,
      quarantineLabels: {
        multiverseMarket: QUARANTINED_MULTIVERSE_MARKET_STATUS,
        shardMilestoneState: "quarantined-unmapped"
      },
      provenanceSources: [
        "player-profile-alias-audit",
        "player-profile-normalizer",
        "player-profile-schema-doc"
      ]
    },
    aliasAudit: aliasAudit
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "player-state",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/player-state.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {
      sharedTruth: sections.canonicalSharedTruth
    },
    boundaries: {},
    models: {
      externalModels: sections.externalModels
    },
    support: {
      plannerHelpers: sections.plannerHelpers,
      compatibilityImports: sections.compatibilityImports,
      aliasAudit: sections.aliasAudit
    },
    traceEvidence: {}
  });
}

async function buildAppMetaUnit() {
  const unitInventory = await readJson("data/units/app-meta.v1.json");
  const snapshot = await readJson("data/game-data.snapshot.v1.json");
  const datasetContract = await readJson("data/bundled-dataset-contract.v1.json");

  const sections = {
    snapshot: datasetSection("data/game-data.snapshot.v1.json", snapshot, ["snapshot"]),
    datasetContract: datasetSection("data/bundled-dataset-contract.v1.json", datasetContract, [
      "bundled-dataset-contract"
    ])
  };

  return withTargetShape(
    {
      dataset: "repo-system-unit.v1",
      systemId: "app-meta",
      version: "v1",
      generatedAt: "2026-04-21",
      generatedBy: "scripts/contracts/generate-system-units.mjs",
      unitInventoryRef: "data/units/app-meta.v1.json",
      summary: unitInventory.summary,
      liveConsumers: unitInventory.liveConsumers,
      provenance: unitInventory.provenance,
      views: unitInventory.views,
      replacementPlan: unitInventory.replacementPlan,
      transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
        (record) => record.kind === "command"
      ),
      sections
    },
    {
      canonical: {},
      boundaries: {},
      models: {},
      support: {
        snapshot: sections.snapshot,
        datasetContract: sections.datasetContract
      },
      traceEvidence: {}
    }
  );
}

function datasetSection(path, data, provenanceSources) {
  return {
    sourcePath: path,
    provenanceSources,
    data
  };
}

function readU32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function readF32(buffer, offset) {
  return buffer.readFloatLE(offset);
}

function readF64(buffer, offset) {
  return buffer.readDoubleLE(offset);
}

function readPptr(buffer, offset) {
  return {
    file_id: readU32(buffer, offset),
    path_id: Number(buffer.readBigUInt64LE(offset + 4))
  };
}

function parseMultiverseLateBlockRecord(buffer, inscriptionId) {
  const offset = MULTIVERSE_LATE_BLOCK_START + (inscriptionId - 50) * MULTIVERSE_LATE_BLOCK_STRIDE;
  const bonusRawU32 = readU32(buffer, offset + 44);
  const bonusRawF32 = readF32(buffer, offset + 44);
  const bonusValue =
    Math.abs(bonusRawF32) < 1e-20 && bonusRawU32 <= 10_000 ? bonusRawU32 : bonusRawF32;
  return {
    inscription_id: readU32(buffer, offset),
    record_offset: offset,
    absolute_offset: MULTIVERSE_MARKET_ABSOLUTE_OFFSET + offset,
    max_level: readU32(buffer, offset + 4),
    buy_button: readPptr(buffer, offset + 8),
    currency_box: readPptr(buffer, offset + 20),
    max_overlay: readPptr(buffer, offset + 32),
    bonus_raw_u32: bonusRawU32,
    bonus_raw_f32: bonusRawF32,
    bonus_value: bonusValue,
    start_cost: readF64(buffer, offset + 48),
    extra_raw_u32: readU32(buffer, offset + 56),
    cost_exponent: readF64(buffer, offset + 64),
    progress_list_size: readU32(buffer, offset + 80),
    max_level_objects_size: readU32(buffer, offset + 204)
  };
}

function isValidMultiverseLateBlockRecord(record) {
  return (
    record.inscription_id >= 1 &&
    record.inscription_id <= 110 &&
    record.max_level >= 1 &&
    record.max_level <= 100 &&
    record.start_cost > 0 &&
    record.start_cost < 1e20 &&
    record.cost_exponent > 0 &&
    record.cost_exponent <= 10 &&
    record.progress_list_size === 10 &&
    record.max_level_objects_size === 10 &&
    record.buy_button?.path_id > 0 &&
    record.currency_box?.path_id > 0 &&
    record.max_overlay?.path_id > 0
  );
}

async function buildMultiverseMarketValuesFromRaw() {
  const blob = await readRawBinary(path.relative(repoRoot, level0Path));
  const objectSlice = blob.subarray(
    MULTIVERSE_MARKET_ABSOLUTE_OFFSET,
    MULTIVERSE_MARKET_ABSOLUTE_OFFSET + MULTIVERSE_MARKET_OBJECT_SIZE
  );
  const records = [];
  for (
    let inscriptionId = MULTIVERSE_LATE_BLOCK_SCAN_START;
    inscriptionId <= MULTIVERSE_LATE_BLOCK_SCAN_END;
    inscriptionId += 1
  ) {
    const record = parseMultiverseLateBlockRecord(objectSlice, inscriptionId);
    if (isValidMultiverseLateBlockRecord(record)) {
      records.push(record);
    }
  }
  return {
    source: {
      level0: "workbench/unity/joined/level0",
      multiverse_market_absolute_offset: MULTIVERSE_MARKET_ABSOLUTE_OFFSET,
      late_block_start: MULTIVERSE_LATE_BLOCK_START,
      late_block_stride: MULTIVERSE_LATE_BLOCK_STRIDE,
      validated_ids: records.map((record) => record.inscription_id)
    },
    records
  };
}

async function fetchOrBuildMultiverseMarketValues() {
  const existing = fetchMaterializedSystemUnitPayload("multiverse-market-values", "v1");
  if (existing && Array.isArray(existing.records) && existing.source) {
    return existing;
  }
  const payload = await buildMultiverseMarketValuesFromRaw();
  upsertMaterializedSystemUnit("multiverse-market-values", "v1", payload, null);
  return payload;
}

function extractTokenShopFieldNames(metadataBlob) {
  const segment = metadataBlob.subarray(TOKEN_METADATA_START, TOKEN_METADATA_END);
  const parts = segment
    .toString("utf8")
    .split("\0")
    .map((part) => part.trim())
    .filter(Boolean);
  const start = parts.indexOf("MeltdownActiveObject");
  const end = parts.indexOf("Tier5TokenUnlockReward");
  if (start < 0 || end < start) {
    throw new Error("TokenShop field-name window could not be recovered from metadata");
  }
  return parts.slice(start, end + 1);
}

function isTokenShopPointerField(name) {
  return TOKEN_POINTER_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

function inferTokenShopGroup(name) {
  if (
    name.startsWith("TokenBoost") ||
    name.startsWith("DiamondBoost") ||
    name.startsWith("CellBoost") ||
    name.startsWith("ModBoost") ||
    name.startsWith("MK")
  ) {
    return "tier1";
  }
  if (
    name.startsWith("TokenBoostT2") ||
    name.startsWith("TokenDailiesT2") ||
    name.startsWith("T2Duo")
  ) {
    return "tier2";
  }
  if (
    name.startsWith("TokenBoostT3") ||
    name.startsWith("TokenDailiesT3") ||
    name.startsWith("T3Trio")
  ) {
    return "tier3";
  }
  if (
    name.startsWith("ATU24") ||
    name.startsWith("ATU25") ||
    name.startsWith("ATU26") ||
    name.startsWith("ATU27") ||
    name.startsWith("ATU28") ||
    name.startsWith("Tier4")
  ) {
    return "tier4plus";
  }
  return "controller";
}

function inferTokenShopNumericValue(name, rawU32, rawF32) {
  if (name.includes("MaxLevel") || name.includes("UnlockReward") || name === "CE") {
    return rawU32;
  }
  if (Math.abs(rawF32) < 1e-20 && rawU32 <= 10_000) {
    return rawU32;
  }
  return rawF32;
}

function parseTokenShopValues(levelBlob, fieldNames) {
  const entries = [];
  let offset = TOKEN_SHOP_FIELD_OFFSET;
  for (const name of fieldNames) {
    const entry = {
      field: name,
      group: inferTokenShopGroup(name),
      object_offset: offset
    };
    const absolute = TOKEN_SHOP_ABSOLUTE_OFFSET + offset;
    if (isTokenShopPointerField(name)) {
      entry.kind = "pointer";
      entry.file_id = levelBlob.readUInt32LE(absolute);
      entry.path_id = Number(levelBlob.readBigUInt64LE(absolute + 4));
      offset += 12;
    } else {
      const rawU32 = levelBlob.readUInt32LE(absolute);
      const rawF32 = levelBlob.readFloatLE(absolute);
      entry.kind = "number";
      entry.raw_u32 = rawU32;
      entry.raw_f32 = rawF32;
      entry.value = inferTokenShopNumericValue(name, rawU32, rawF32);
      offset += 4;
    }
    entries.push(entry);
  }
  return entries;
}

function buildTokenShopNumericTable(entries) {
  const table = {};
  for (const entry of entries) {
    if (entry.kind !== "number") {
      continue;
    }
    const field = String(entry.field);
    if (!/(StartCost|AdditiveCost|Bonus|MaxLevel|UnlockReward)/.test(field)) {
      continue;
    }
    const suffixes = [
      "StartCost",
      "AdditiveCost",
      "Bonus1",
      "Bonus2",
      "Bonus3",
      "Bonus4",
      "Bonus5",
      "Bonus",
      "FillMaxLevel",
      "MaxLevel",
      "UnlockReward"
    ];
    let prefix = field;
    let key = field;
    for (const suffix of suffixes) {
      if (field.endsWith(suffix)) {
        prefix = field.slice(0, -suffix.length);
        key = suffix;
        break;
      }
    }
    const record = table[prefix] ?? {};
    record[key] = entry.value;
    record.group = entry.group;
    table[prefix] = record;
  }
  return table;
}

async function buildTokenShopValuesFromRaw() {
  const [metadataBlob, levelBlob] = await Promise.all([
    readRawBinary(path.relative(repoRoot, metadataPath)),
    readRawBinary(path.relative(repoRoot, level0Path))
  ]);
  const fieldNames = extractTokenShopFieldNames(metadataBlob);
  const entries = parseTokenShopValues(levelBlob, fieldNames);
  return {
    source: {
      metadata: "workbench/apk/base/global-metadata.dat",
      level0: "workbench/unity/joined/level0",
      token_shop_absolute_offset: TOKEN_SHOP_ABSOLUTE_OFFSET,
      token_shop_field_offset: TOKEN_SHOP_FIELD_OFFSET
    },
    field_count: fieldNames.length,
    fields: entries,
    numeric_table: buildTokenShopNumericTable(entries)
  };
}

async function fetchOrBuildTokenShopValues() {
  const existing = fetchMaterializedSystemUnitPayload("token-shop-values", "v1");
  if (existing && Array.isArray(existing.fields) && existing.numeric_table) {
    return existing;
  }
  const payload = await buildTokenShopValuesFromRaw();
  upsertMaterializedSystemUnit("token-shop-values", "v1", payload, null);
  return payload;
}

async function fetchOrBuildShardCostFormulaModel() {
  const existing = fetchMaterializedSystemUnitPayload("shard-cost-formula-model", "v1");
  if (
    existing &&
    existing.dataset === "shard-cost-formula-model.v1" &&
    existing?.verifiedParameters?.exactRowParameters
  ) {
    return existing;
  }
  const payload = await readJson("data/shard-cost-formula-model.v1.json");
  const parameterProbe = await readJson(payload.sources?.parameterProbe);
  const exactRowParameters = Object.fromEntries(
    (Array.isArray(parameterProbe?.rowAlignedTupleCandidates)
      ? parameterProbe.rowAlignedTupleCandidates
      : []
    )
      .filter((entry) => Number.isInteger(Number(entry?.row)))
      .map((entry) => [
        String(Number(entry.row)),
        {
          fieldNames: Array.isArray(entry?.strongestFieldOrderMapping?.fieldOrder)
            ? entry.strongestFieldOrderMapping.fieldOrder
            : [],
          exactBigDoubleValues:
            entry?.strongestFieldOrderMapping?.exactBigDoubleValues ?? {}
        }
      ])
  );
  payload.verifiedParameters = {
    ...(payload.verifiedParameters ?? {}),
    exactRowParameters,
    parameterProbeEmbedding: {
      sourcePath: payload.sources?.parameterProbe ?? null,
      embeddedAt: new Date().toISOString()
    }
  };
  upsertMaterializedSystemUnit(
    "shard-cost-formula-model",
    "v1",
    payload,
    "data/shard-cost-formula-model.v1.json"
  );
  return payload;
}

async function fetchOrBuildShardCostScreenshotCalibration() {
  const existing = fetchMaterializedSystemUnitPayload("shard-cost-screenshot-calibration", "v1");
  if (existing && existing.dataset === "shard-cost-screenshot-calibration.v1") {
    return existing;
  }
  const payload = await readJson("data/shard-cost-screenshot-calibration.v1.json");
  upsertMaterializedSystemUnit(
    "shard-cost-screenshot-calibration",
    "v1",
    payload,
    "data/shard-cost-screenshot-calibration.v1.json"
  );
  return payload;
}

function findDirectTypeMetadataEntry(typeMetadataSupport, scriptName) {
  return (
    typeMetadataSupport?.directTargetTypeMetadata?.find((entry) => entry?.scriptName === scriptName) ??
    null
  );
}

function buildTokenShopCanonicalRecords(tokenShopValues, typeMetadataSupport) {
  const saveDataMetadata = findDirectTypeMetadataEntry(typeMetadataSupport, "SaveData");
  const saveFields = Array.isArray(saveDataMetadata?.fields) ? saveDataMetadata.fields : [];
  const atuLevelFields = saveFields.filter((field) => /^ATU\d+Level$/.test(field?.name ?? ""));
  const adjacentFieldNames = [
    "BankedTokens",
    "Tier2TokensUnlocked",
    "Tier3TokensUnlocked",
    "Tier4TokensUnlocked",
    "Tier5TokensUnlocked"
  ];
  const adjacentFields = Object.fromEntries(
    adjacentFieldNames
      .map((name) => saveFields.find((field) => field?.name === name))
      .filter(Boolean)
      .map((field) => [
        field.name,
        {
          offset: field.fieldOffset,
          type: field.type
        }
      ])
  );

  const offsets = Object.fromEntries(
    atuLevelFields.map((field) => [
      field.name,
      {
        offset: field.fieldOffset,
        type: field.type
      }
    ])
  );

  return {
    dataset: "token-shop-canonical-records.v1",
    generatedAt: new Date().toISOString(),
    description:
      "DB-derived verified TokenShop canonical records. This slice keeps only extract-backed formulas, SaveData ATU ownership, and grounded owner-payload scope. Tier unlock thresholds are intentionally excluded because the repo still treats them as heuristic policy, not verified canonical truth.",
    source: {
      tokenShopValues: "db:derived:token-shop-values",
      typeMetadataSupport: "data/uabea-type-metadata-support.v1.json"
    },
    formulas: {
      cost: {
        formula: "cost = StartCost + (level - 1) * AdditiveCost",
        provenance: "verified-extract"
      },
      bonus: {
        formula: "bonus = BonusFieldValue * CurrentLevel",
        provenance: "verified-extract"
      }
    },
    saveData: {
      owner: "SaveData",
      fieldRange: "ATU1Level through ATU28Level",
      count: atuLevelFields.length,
      offsets,
      adjacentFields
    },
    ownerPayload: {
      fieldRange: "ATU1Button through ATU28MaxOverlay",
      fieldCount: Array.isArray(tokenShopValues?.fields)
        ? tokenShopValues.fields.filter((entry) => /^ATU\d+(Button|MaxOverlay)$/.test(entry?.field ?? ""))
            .length
        : 0,
      numericFamilies: Object.keys(tokenShopValues?.numeric_table ?? {})
    }
  };
}

async function fetchOrBuildTokenShopCanonicalRecords(tokenShopValues, typeMetadataSupport) {
  const existing = fetchMaterializedSystemUnitPayload("token-shop-canonical-records", "v1");
  if (existing?.saveData?.count === 28 && existing?.ownerPayload?.fieldRange) {
    return existing;
  }
  const payload = buildTokenShopCanonicalRecords(tokenShopValues, typeMetadataSupport);
  upsertMaterializedSystemUnit("token-shop-canonical-records", "v1", payload, null);
  return payload;
}

function buildTokenShopTierPolicyFromLegacy(legacyCanonical) {
  const tierUnlocks = legacyCanonical?.tier_unlocks ?? {};
  return {
    dataset: "token-shop-tier-policy.v1",
    generatedAt: new Date().toISOString(),
    policyKind: "heuristic-tier-unlocks",
    status: tierUnlocks?.status ?? "unverified_assumption",
    description:
      "Explicit heuristic TokenShop tier-unlock policy. This is not canonical gameplay truth and remains separated from DB-derived verified TokenShop records until the trace/DB layer recovers stronger threshold evidence.",
    provenanceNote:
      tierUnlocks?.provenance_note ??
      "Threshold values remain heuristic and should not be promoted into canonical state until verified by stronger DB-backed evidence.",
    tierUnlocks
  };
}

async function fetchOrBuildTokenShopTierPolicy(legacyCanonical) {
  const existing = fetchMaterializedSystemUnitPayload("token-shop-tier-policy", "v1");
  if (existing?.tierUnlocks?.tier_thresholds && existing?.status) {
    return existing;
  }
  const payload = buildTokenShopTierPolicyFromLegacy(legacyCanonical);
  upsertMaterializedSystemUnit("token-shop-tier-policy", "v1", payload, null);
  return payload;
}

function extractMetadataStringEntries(buffer) {
  const entries = [];

  for (let index = 0; index < buffer.length; ) {
    const start = index;
    while (index < buffer.length && buffer[index] >= 0x20 && buffer[index] <= 0x7e) {
      index += 1;
    }
    if (index - start >= 4) {
      entries.push({
        offset: start,
        encoding: "ascii",
        value: buffer.toString("ascii", start, index)
      });
    }
    index = index === start ? index + 1 : index;
  }

  for (let index = 0; index + 1 < buffer.length; ) {
    const start = index;
    while (
      index + 1 < buffer.length &&
      buffer[index] >= 0x20 &&
      buffer[index] <= 0x7e &&
      buffer[index + 1] === 0
    ) {
      index += 2;
    }
    if ((index - start) / 2 >= 4) {
      entries.push({
        offset: start,
        encoding: "utf16le",
        value: buffer.toString("utf16le", start, index)
      });
    }
    index = index === start ? index + 1 : index;
  }

  return entries.sort((left, right) => left.offset - right.offset);
}

function findMetadataNeighborhoodMatches(entries, anchor, context) {
  const matches = [];
  const anchorLower = anchor.toLowerCase();
  for (const [index, entry] of entries.entries()) {
    if (!String(entry.value).toLowerCase().includes(anchorLower)) {
      continue;
    }
    const start = Math.max(index - context, 0);
    const end = Math.min(index + context + 1, entries.length);
    matches.push({
      anchor,
      match_index: index,
      match_offset: entry.offset,
      match_value: entry.value,
      context: entries.slice(start, end)
    });
  }
  return matches;
}

async function buildMetadataNeighborhoodFromProbe(metadataRelativePath, anchors, context) {
  const blob = await readRawBinary(metadataRelativePath);
  const entries = extractMetadataStringEntries(blob);
  return {
    metadata: metadataRelativePath,
    anchor_count: anchors.length,
    context,
    results: anchors.map((anchor) => ({
      anchor,
      matches: findMetadataNeighborhoodMatches(entries, anchor, context)
    }))
  };
}

function normalizeMetadataNeighborhoodPayload(payload) {
  return {
    ...payload,
    metadata: "workbench/apk/base/global-metadata.dat"
  };
}

async function fetchOrBuildMultiverseMarketMetadataNeighborhood() {
  const existing = fetchMaterializedSystemUnitPayload("multiverse-market-metadata-neighborhood", "v1");
  if (existing && Array.isArray(existing.results) && existing.metadata) {
    return normalizeMetadataNeighborhoodPayload(existing);
  }
  const payload = normalizeMetadataNeighborhoodPayload(
    await buildMetadataNeighborhoodFromProbe(
      path.relative(repoRoot, metadataPath),
      [
        "CloudSavePlayerProfile",
        "PlayerProfileData",
        "FillPlayerProfileData",
        "GetPlayerProfileData",
        "InscryptionsDone",
        "SetAllChrystosEmporiumTexts",
        "Mech1Unlocked",
        "Market",
        "GemData",
        "ShardData"
      ],
      40
    )
  );
  upsertMaterializedSystemUnit("multiverse-market-metadata-neighborhood", "v1", payload, null);
  return payload;
}

function toContiguousRanges(numbers) {
  const sorted = [...new Set(numbers.map((value) => Number(value)).filter(Number.isFinite))].sort(
    (left, right) => left - right
  );
  if (sorted.length === 0) {
    return [];
  }
  const ranges = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const value of sorted.slice(1)) {
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    ranges.push(start === previous ? String(start) : `${start}-${previous}`);
    start = value;
    previous = value;
  }
  ranges.push(start === previous ? String(start) : `${start}-${previous}`);
  return ranges;
}

function buildMultiverseRowTextCoverage(multiverseMarketValues) {
  const validatedRows = Array.isArray(multiverseMarketValues.records)
    ? multiverseMarketValues.records
        .map((record) => Number(record.inscription_id))
        .filter(Number.isFinite)
        .sort((left, right) => left - right)
    : [];
  return {
    generatedAt: "2026-04-22",
    sources: {
      validatedRows: "db:derived:multiverse-market-values",
      sourceModel: "db-derived-multiverse-market-row-text-coverage"
    },
    textHandlerAnchors: ["TextHandlerMarkets", "SetAllChrystosEmporiumTexts"],
    validatedRowCostTexts: validatedRows.map((row) => `SetIS${row}CostText`),
    sampleBuyHooks:
      validatedRows.length > 0
        ? [`BuyIS${validatedRows[0]}`, `BuyIS${validatedRows.at(-1)}`]
        : [],
    currentBoundary: [
      "Repo-local multiverse values now preserve a direct validated-row text lane through SetAllChrystosEmporiumTexts and the SetIS*CostText family.",
      "That gives the repo a grounded row-text coverage path for the currently validated MultiverseMarket rows without depending on the older standalone row-text coverage summary.",
      "This is still text-handler coverage, not saved-state coverage, so it does not resolve player-owned current levels or the declaring save model.",
      "It is enough to keep validated row-label coverage separate from broader save-side metadata runs."
    ]
  };
}

function pickTokenShopPresentationBinding(traceData) {
  const binding =
    traceData?.canonicalSemanticViews?.ui_binding_fragment?.[
      "ui-binding:token-shop:token-shop-family-structure:description"
    ] ?? {};
  const presentationPath = Array.isArray(binding.presentationUpdatePaths)
    ? binding.presentationUpdatePaths[0] ?? {}
    : {};
  const renderPaths = Array.isArray(presentationPath.interactionToRenderPaths)
    ? presentationPath.interactionToRenderPaths
    : [];
  const costPath = renderPaths.find((entry) => entry?.renderRole === "cost") ?? {};
  const descriptionPath = renderPaths.find((entry) => entry?.renderRole === "description") ?? {};

  return {
    interactionShell: presentationPath.interactionNodes?.[0]?.name ?? null,
    costShell:
      presentationPath.recursiveAnchors?.find((entry) => entry?.role === "cost")?.name ?? null,
    costRenderNode: costPath.renderNode ?? null,
    descriptionRenderNode: descriptionPath.renderNode ?? null
  };
}

function buildMultiverseActionShellSupport(multiverseMarketValues, rowTextCoverage) {
  const validatedRows = Array.isArray(multiverseMarketValues.records)
    ? multiverseMarketValues.records
        .map((record) => Number(record.inscription_id))
        .filter(Number.isFinite)
        .sort((left, right) => left - right)
    : [];
  return {
    generatedAt: "2026-04-22",
    sources: {
      metadata: "workbench/apk/base/global-metadata.dat",
      validatedRows: "db:derived:multiverse-market-values",
      rowTextCoverage: "db:derived:multiverse-market-row-text-coverage",
      sourceModel: "db-derived-multiverse-market-action-shell"
    },
    textHandlerAnchors: Array.isArray(rowTextCoverage.textHandlerAnchors)
      ? rowTextCoverage.textHandlerAnchors
      : ["TextHandlerMarkets", "SetAllChrystosEmporiumTexts"],
    contextDerivedBuyHookRange: {
      start: 1,
      end: 110,
      count: 110
    },
    contextDerivedCostTextRange: {
      start: 1,
      end: 110,
      count: 110
    },
    validatedBuyHookRanges: toContiguousRanges(validatedRows),
    validatedBuyHooks: validatedRows.map((row) => `BuyIS${row}`),
    validatedCostTexts: validatedRows.map((row) => `SetIS${row}CostText`),
    currentBoundary: [
      "The checked metadata and row-text coverage preserve a broader TextHandlerMarkets or SetAllChrystosEmporiumTexts action shell that contextually reaches BuyIS1 through BuyIS110 and SetIS1CostText through SetIS110CostText.",
      "The currently validated MultiverseMarket numeric row block still only covers rows 50-59 and 63-74 inside that broader action shell.",
      "This is enough to preserve a grounded action-shell boundary for future mapping work, but not enough to treat the entire 1-110 action shell as numerically validated or saved-state mapped."
    ]
  };
}

async function buildMultiverseOwnerFamilySupport(multiverseMarketValues, actionShell) {
  const ownerAnchors = [
    "MultiverseMarket, Assembly-CSharp",
    "TextHandlerMarkets",
    "SetAllChrystosEmporiumTexts",
    "SetInscryptionsDoneText",
    "Inscryptions"
  ];
  const costLaneAnchors = [
    "ResourceAmountText.InscryptionsDone",
    "AchievementBar-Inscryptions",
    "CostBox-InscryptionsDone"
  ];
  const metadataPresence = await countAsciiOccurrencesByTerm("workbench/apk/base/global-metadata.dat", [
    ...ownerAnchors,
    ...costLaneAnchors
  ]);
  const level0Presence = await countAsciiOccurrencesByTerm("workbench/unity/joined/level0", costLaneAnchors);
  const validatedRows = Array.isArray(multiverseMarketValues.records)
    ? multiverseMarketValues.records
        .map((record) => Number(record.inscription_id))
        .filter(Number.isFinite)
        .sort((left, right) => left - right)
    : [];
  const validatedRanges = toContiguousRanges(validatedRows);
  const validatedCurrencyBoxes = validatedRanges.flatMap((rangeLabel) => {
    const [startText, endText = startText] = String(rangeLabel).split("-");
    return [`IS${startText}CurrencyBox`, `IS${endText}CurrencyBox`];
  });
  const uniqueValidatedCurrencyBoxes = [...new Set(validatedCurrencyBoxes)];
  const actionRange = actionShell?.contextDerivedBuyHookRange ?? { start: 1, end: 110, count: 110 };

  return {
    generatedAt: "2026-04-22",
    sources: {
      metadata: "workbench/apk/base/global-metadata.dat",
      level0: "workbench/unity/joined/level0",
      validatedRows: "db:derived:multiverse-market-values",
      actionShell: "db:derived:multiverse-market-action-shell",
      sourceModel: "db-derived-multiverse-market-owner-family"
    },
    ownerAnchors,
    costLaneAnchors: costLaneAnchors.filter(
      (name) => (metadataPresence[name] ?? 0) > 0 || (level0Presence[name] ?? 0) > 0
    ),
    currencyBoxRange: {
      start: Number(actionRange.start) || 1,
      end: Number(actionRange.end) || 110,
      count: Number(actionRange.count) || 110
    },
    validatedCurrencyBoxes: uniqueValidatedCurrencyBoxes,
    sampleBuyHooks: [
      `BuyIS${actionRange.start ?? 1}`,
      validatedRows.length > 0 ? `BuyIS${validatedRows[0]}` : "BuyIS50",
      validatedRows.length > 0 ? `BuyIS${validatedRows.at(-1)}` : "BuyIS74",
      `BuyIS${actionRange.end ?? 110}`
    ],
    currentBoundary: [
      "The checked owner-family shell now preserves MultiverseMarket, Inscryptions, TextHandlerMarkets, SetAllChrystosEmporiumTexts, and SetInscryptionsDoneText as one local owner and cost-lane family.",
      "The same checked shell also preserves player-facing cost-lane anchors ResourceAmountText.InscryptionsDone, AchievementBar-Inscryptions, and CostBox-InscryptionsDone plus a broader IS1CurrencyBox through IS110CurrencyBox UI shell.",
      "This is enough to keep the MultiverseMarket owner-family and cost-lane shell grounded for future mapping work, but not enough to recover player-owned Inscryptions balance fields, current row levels, or the declaring save model."
    ]
  };
}

function buildShardBonusSlotSupport(shardFamilyEvidence) {
  const rows = Array.isArray(shardFamilyEvidence.rows)
    ? shardFamilyEvidence.rows.map((entry) => {
        const effectBinding = entry.effectBinding ?? {};
        const bonusFieldCount = Number(effectBinding.bonusFieldCount) || 0;
        const calcAccessorCount = Number(effectBinding.calcAccessorCount) || 0;
        const groundedBonusCount = Number(effectBinding.groundedBonusCount) || 0;
        return {
          row: Number(entry.row),
          bonusFieldCount,
          calcAccessorCount,
          groundedBonusCount,
          slotIds: Array.from({ length: bonusFieldCount }, (_, index) => index + 1),
          calcIds: Array.from({ length: calcAccessorCount }, (_, index) => index + 1),
          matchesGroundedCount: bonusFieldCount === groundedBonusCount
        };
      })
    : [];

  return {
    dataset: "shard-bonus-slot-support",
    generatedAt: "2026-04-22",
    sources: {
      shardFamilyEvidence: "db:derived:shard-milestone-family-evidence",
      sourceModel: "db-derived-shard-bonus-slot-support"
    },
    rows,
    findings: [
      "Direct shard family evidence preserves per-row bonus field counts, calc accessor counts, and grounded descriptive bonus counts.",
      "Rows 1-29 align on slot counts while row 0 still preserves the known mismatch between recovered bonus arity and the current descriptive Eternal milestone entry."
    ],
    currentBoundary: [
      "Treat the reducer-owned row bonus counts as direct shard-row bonus-arity evidence.",
      "Do not treat slot counts alone as final player-facing effect text or bonus formulas.",
      "Use row-0 mismatch as evidence that the current descriptive Eternal milestone entry is still incomplete."
    ]
  };
}

function normalizeShardMilestoneTitle(value) {
  return String(value ?? "")
    .replace(/^The\s+/i, "")
    .replace(/\s+Milestone$/i, "")
    .replace(/\(.*\)/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();
}

function buildShardMilestoneFamilyEvidence(
  shardMilestones,
  shardMilestoneRowModelBoundary,
  shardMilestoneTitleEffectBoundary,
  shardEffectTextHandlerBoundary,
  shardMilestoneRowShellBoundary,
  shardMilestonePayloadBoundary,
  shardMilestoneHandoffBoundary,
  shardSaveBoundary,
  shardCostFormulaModel
) {
  const milestoneRows = Array.isArray(shardMilestones.milestones)
    ? shardMilestones.milestones.filter((entry) => Number.isInteger(entry?.milestoneNumber))
    : [];
  const titleCandidatesByRow = new Map();
  for (const entry of Array.isArray(shardMilestoneTitleEffectBoundary.titleAssetCandidates)
    ? shardMilestoneTitleEffectBoundary.titleAssetCandidates
    : []) {
    const row = Number(entry?.row);
    if (!Number.isInteger(row)) {
      continue;
    }
    const existing = titleCandidatesByRow.get(row) ?? [];
    existing.push(entry);
    titleCandidatesByRow.set(row, existing);
  }
  const getterRows = new Set(
    Array.isArray(shardCostFormulaModel?.runtimeGetterRules?.getterFamily?.rows)
      ? shardCostFormulaModel.runtimeGetterRules.getterFamily.rows
      : []
  );
  const rowModel = shardSaveBoundary?.recoveredDeclaringRowModel ?? {};
  const statusMeanings = {
    verified:
      "The row has one checked shipped title binding plus aligned row-shell, effect package, bonus-slot, and cost-shell evidence.",
    partial:
      "The row stays inside the recovered shard family and can be shown descriptively, but at least one player-facing identity, text binding, or verified row package seam remains unresolved.",
    blocked:
      "A stronger row claim would overreach because the current title-side or bonus-package evidence still conflicts, undershoots the recovered row shell, or remains explicitly unresolved."
  };

  const rows = milestoneRows
    .filter((entry) => entry.milestoneNumber >= 0 && entry.milestoneNumber <= 29)
    .map((milestone) => {
      const row = Number(milestone.milestoneNumber);
      const rowKey = `SU${row}`;
      const groundedName = String(milestone.name ?? "");
      const titleEntries = titleCandidatesByRow.get(row) ?? [];
      const titleCandidates = titleEntries.map((entry) => entry.title).filter(Boolean);
      const assetNames = titleEntries.map((entry) => entry.assetName).filter(Boolean);
      const groundedBonusCount = Array.isArray(milestone.bonuses) ? milestone.bonuses.length : 0;
      const bonusFieldCount =
        row === 0
          ? Array.isArray(shardEffectTextHandlerBoundary.presentationFamily)
            ? shardEffectTextHandlerBoundary.presentationFamily.length
            : 8
          : groundedBonusCount;
      const calcAccessorCount = row === 0 ? 0 : groundedBonusCount;
      const exactTitleMatch = titleCandidates.some(
        (candidate) =>
          normalizeShardMilestoneTitle(candidate) === normalizeShardMilestoneTitle(groundedName)
      );
      const hasConflictingTitleCandidates =
        new Set(titleCandidates.map((entry) => normalizeShardMilestoneTitle(entry))).size > 1;
      const hasGetterLane = getterRows.has(row);

      let status = "partial";
      let statusReason = `Row ${row} stays inside the recovered shard family with one shipped ${titleCandidates[0] ?? "milestone"} title candidate, matched ${bonusFieldCount}-slot bonus arity and a get_SU${row}Cost lane, but no full verified row package is promoted yet.`;
      if (row === 0) {
        status = "blocked";
        statusReason =
          "The Eternal row still undershoots the recovered shard-local shell: metadata preserves eight bonus slots while the descriptive package currently carries only three surfaced bonuses and no sampled calc accessors.";
      } else if (row === 7) {
        status = "blocked";
        statusReason =
          "The title-side evidence conflicts on row 7: the shipped asset says Generating while the current descriptive package says Duality, so the row stays blocked from stronger player-facing identity claims.";
      } else if (row === 28 || hasConflictingTitleCandidates) {
        status = "blocked";
        statusReason =
          "The title-side evidence conflicts on row 28 because the shipped asset family still preserves both Studying and Sly as candidates, so the final player-facing title remains unresolved.";
      } else if (row === 1 || row === 2) {
        status = "verified";
        statusReason = `The shipped ${titleCandidates[0]} title asset, the grounded ${groundedBonusCount}-bonus package, the recovered row shell, ${calcAccessorCount} calc accessors, and the checked get_SU${row}Cost shell align on the same shard-local row.`;
      }

      const titleBindingStatus =
        status === "verified" ? "verified" : status === "blocked" ? "blocked" : "partial";
      const effectBindingStatus =
        row === 0 ? "blocked" : status === "verified" ? "verified" : "partial";
      const costShellStatus = status === "verified" ? "verified" : "partial";

      const entry = {
        row,
        rowKey,
        milestoneId: milestone.id,
        status,
        statusReason,
        titleBinding: {
          status: titleBindingStatus,
          assetNames,
          titleCandidates,
          playerFacingName: groundedName
        },
        effectBinding: {
          status: effectBindingStatus,
          handler: shardEffectTextHandlerBoundary.probableTextHandler ?? null,
          bonusFieldCount,
          calcAccessorCount,
          groundedBonusCount
        },
        costShell: {
          status: costShellStatus,
          getterName: hasGetterLane ? `get_SU${row}Cost` : null,
          note:
            row === 0
              ? "Row 0 stays inside the recovered shard cost family as the special-case opener, but its typed evaluator and full effect package remain unresolved."
              : hasGetterLane
                ? `The checked SU${row} cost shell stays inside the recovered shard-local getter family, but no full verified row package is promoted yet.`
                : `Row ${row} stays inside the descriptive shard family, but the exact checked getter lane has not been re-materialized here yet.`
        }
      };

      if (status === "verified" && exactTitleMatch) {
        entry.verifiedPackage = {
          summary: milestone.summary,
          unlockCondition: milestone.unlockCondition,
          fixedBreakpoints: milestone.fixedBreakpoints ?? [],
          rowShellFields: {
            textCheckerField: `Milestone${row}TextChecker`,
            unlockRequirementField: `SU${row}UnlockReq`,
            bonusTextFields: Array.from({ length: groundedBonusCount }, (_, index) => `SM${row}B${index + 1}Text`)
          },
          calcAccessors: Array.from(
            { length: calcAccessorCount },
            (_, index) => `get_SU${row}Bonus${index + 1}Calc`
          ),
          serializedCostFields: [
            `SU${row}StartCost`,
            `SU${row}CostExponent`,
            `SU${row}GrowthExponent`
          ],
          bonuses: milestone.bonuses ?? []
        };
      }

      return entry;
    });

  const verifiedRows = rows.filter((entry) => entry.status === "verified");
  const partialRows = rows.filter((entry) => entry.status === "partial");
  const blockedRows = rows.filter((entry) => entry.status === "blocked");

  return {
    dataset: "shard-milestone-family-evidence.v1",
    generatedAt: "2026-04-22",
    sources: {
      groundedMilestones: "data/shard-milestones.grounded.v1.json",
      rowModelBoundary: "data/shard-milestone-row-model-boundary.v1.json",
      rowShellBoundary: "data/shard-milestone-row-shell-boundary.v1.json",
      titleEffectBoundary: "data/shard-milestone-title-effect-boundary.v1.json",
      effectTextHandlerBoundary: "data/shard-effect-text-handler-boundary.v1.json",
      payloadBoundary: "data/shard-milestone-payload-boundary.v1.json",
      saveBoundary: "data/shard-save-boundary.v2.json",
      handoffBoundary: "data/shard-milestone-handoff-boundary.v2.json",
      costFormulaModel: "data/shard-cost-formula-model.v1.json",
      sourceModel: "db-derived-shard-milestone-family-evidence"
    },
    reachableFamily: {
      screenController: shardMilestoneRowShellBoundary.screenControllerFamily,
      declaringField: rowModel.declaringField ?? {
        ownerType: "ShardMining",
        name: "upgradeInfoList",
        type: "System.Collections.Generic.List`1<ShardMining+ShardUpgradeInfo>",
        fieldOffset: 5216
      },
      rowModelType: rowModel.rowModelType ?? {
        fullName: "ShardMining+ShardUpgradeInfo",
        baseType: "System.Object"
      },
      reachableRows: {
        start: shardMilestoneRowModelBoundary.textCheckerRange?.start ?? 0,
        end: shardMilestoneRowModelBoundary.textCheckerRange?.end ?? 29,
        count: shardMilestoneRowModelBoundary.textCheckerRange?.count ?? 30
      },
      statusMeanings
    },
    sharedEvidence: {
      rowModel: {
        status: "recovered",
        summary:
          "The shard-local declaring row model is recovered as ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo, with contiguous SU0-29 unlock requirements and Milestone0-29 text-checker families."
      },
      rowShell: {
        status: "partial",
        summary:
          "The checked shard-local controller shell still only directly exposes UnlockMilestone17-29, BuyMilestone0, and Milestone0-12TextChecker, so the family is real but not row-complete at the controller-hook level."
      },
      payloadWatch: {
        status: "recovered",
        summary:
          "ShardUpgradeInfo still carries the checked milestone-total, cost-list, progress-fill, and phase-tick hooks for the whole family."
      },
      saveBoundary: {
        status: shardSaveBoundary.boundaryEvidence?.ownedStateOutcomeKind ? "blocked" : "partial",
        summary:
          "The reachable row-definition family is direct-serialized on ShardMining, and the shard-owned-state trace now narrows player-owned row values to a non-local injection seam: no checked PlayerProfileData or CloudSavePlayerProfile overlap, no local upgradeInfoList population bridge, and no recovered deeper wrapper handoff."
      }
    },
    familyFindings: [
      "The reachable shard family is rows 0-29 inside ShardMining.upgradeInfoList -> ShardMining+ShardUpgradeInfo.",
      "This table keeps one shared family-level evidence pass instead of reopening a separate artifact for each row.",
      `Rows ${verifiedRows.map((entry) => entry.row).join(" and ")} currently clear as verified end-to-end row packages; rows ${blockedRows.map((entry) => entry.row).join(", ")} remain blocked by explicit title-side or bonus-package conflicts; the remaining reachable rows are descriptive partials inside the recovered shard family.`,
      "The table is canonical-as-evidence only. It is not planner math, affordability proof, ROI, ETA, or permission to promote unresolved shard milestone state into canonical playerProfile inputs."
    ],
    rows,
    currentBoundary: [
      "Treat this bundle as the current shared shard milestone evidence table assembled from grounded milestones plus shard-local row, title, effect, cost, and save boundaries.",
      "Use it to preserve one bounded family-level row table for SU0-29 without reopening probe-era standalone row summaries.",
      "Do not treat this shared shard milestone evidence table as planner-safe cost math, verified save ownership, or permission to promote unresolved shard milestone state into canonical player inputs.",
      shardMilestoneHandoffBoundary.currentBoundary?.[0] ??
        "The remaining blocker is still save-side owned-state ownership, not the row-definition family itself."
    ]
  };
}

function buildTokenShopCostLaneSupport(tokenShopValues, traceData) {
  const numericTable = tokenShopValues?.numeric_table ?? {};
  const groups = Object.keys(numericTable);
  const tokenSpendGroups = groups.filter((name) =>
    [
      "TokenBoost",
      "TokenBoostT2",
      "TokenBoostT3",
      "Tier2Token",
      "Tier3Token",
      "Tier4Token",
      "Tier5Token",
      "MK1TokenBoost",
      "MK2TokenBoost",
      "MK3TokenBoost",
      "MK4TokenBoost",
      "MK5TokenBoost",
      "MK6TokenBoost",
      "MK7TokenBoost",
      "MK8TokenBoost"
    ].includes(name)
  );
  const dailyTokeniumModifierGroups = groups.filter((name) =>
    ["TokenDailiesT2", "TokenDailiesT3"].includes(name)
  );
  const diamondGroups = groups.filter((name) => name === "DiamondBoost");
  const formula =
    traceData?.canonicalSemanticViews?.formula_fragment?.["formula:token-shop"] ?? {};
  const threshold =
    traceData?.canonicalSemanticViews?.threshold_fragment?.[
      "threshold:token-shop:token-shop-family-structure:runtime-cost"
    ] ?? {};
  const progression =
    traceData?.canonicalSemanticViews?.progression_fragment?.[
      "progression:token-shop:ArcadeUpgradeSO"
    ] ?? {};
  const uiBinding = pickTokenShopPresentationBinding(traceData);

  return {
    tokenSpendGroups,
    dailyTokeniumModifierGroups,
    diamondGroups,
    tracePresentation: {
      interactionShell: uiBinding.interactionShell,
      costShell: uiBinding.costShell,
      costRenderNode: uiBinding.costRenderNode,
      descriptionRenderNode: uiBinding.descriptionRenderNode
    },
    materializedSemantics: {
      formulaKind: formula?.inferredCostModel?.kind ?? null,
      formulaExpression: formula?.inferredCostModel?.expression ?? null,
      runtimeCostStatus: threshold?.runtimeCostModel?.status ?? null,
      evaluatorStatus: progression?.runtimeEvaluatorRecovery?.status ?? null
    },
    currentBoundary: [
      "The token, diamond, and Daily Tokenium spend families are now regenerated directly from the token-shop-family-structure trace materialization plus the grounded TokenShop numeric table.",
      "This materialized view keeps TokenBoost, DiamondBoost, and TokenDailies on separate spend lanes while preserving the shared TokenShop UI render path through UPGButton, CostBox, CostText, and DescText.",
      "The remaining unresolved gap is runtime-side pricing modifiers or evaluator transforms beyond the recovered base controller lane."
    ]
  };
}

async function countAsciiOccurrences(relativePath, term) {
  const buffer = await readRawBinary(relativePath);
  const needle = Buffer.from(String(term), "utf8");
  if (!needle.length) {
    return 0;
  }
  let count = 0;
  let offset = 0;
  while (offset <= buffer.length - needle.length) {
    const found = buffer.indexOf(needle, offset);
    if (found === -1) {
      break;
    }
    count += 1;
    offset = found + needle.length;
  }
  return count;
}

async function countAsciiOccurrencesByTerm(relativePath, terms) {
  const counts = {};
  for (const term of terms) {
    counts[term] = await countAsciiOccurrences(relativePath, term);
  }
  return counts;
}

async function buildTokenShopActionLaneSupport(tokenShopValues, dailyTokeniumLaneClues) {
  const numericTable = tokenShopValues?.numeric_table ?? {};
  const tokenBuyFamilies = [
    "TokenBoost",
    "MK1TokenBoost",
    "MK2TokenBoost",
    "MK3TokenBoost",
    "MK4TokenBoost",
    "MK5TokenBoost",
    "MK6TokenBoost",
    "MK7TokenBoost",
    "MK8TokenBoost"
  ].filter((name) => numericTable[name]);
  const tokenDirectBuyHooks = tokenBuyFamilies.map((name) => `Buy${name}`);
  const tokenHoldHooks = ["StartTokenBoostHold", "StopTokenBoostHold"];
  const diamondDirectBuyHooks = numericTable.DiamondBoost ? ["BuyDiamondBoost"] : [];
  const diamondHoldHooks = ["StartDiamondBoostHold", "StopDiamondBoostHold"];
  const dailyTokeniumModifierHooks = [
    ...(Array.isArray(dailyTokeniumLaneClues?.modifierClues)
      ? dailyTokeniumLaneClues.modifierClues.filter((name) => /^Buy/.test(name))
      : []),
    ...(Array.isArray(dailyTokeniumLaneClues?.premiumModifierClues)
      ? dailyTokeniumLaneClues.premiumModifierClues.filter((name) => /^Buy/.test(name))
      : [])
  ].filter((value, index, array) => array.indexOf(value) === index);
  const tokenSupportingShells = ["CostBox-Tokens"];
  const dailyTokeniumSupportingShells = [
    "CostBox-Tokenium",
    "Mission Materials Booster",
    "COLLECTERS PACK"
  ];
  const metadataTerms = [
    ...tokenDirectBuyHooks,
    ...tokenHoldHooks,
    ...diamondDirectBuyHooks,
    ...diamondHoldHooks,
    ...dailyTokeniumModifierHooks,
    "BuyTokenDailiesT2",
    "BuyTokenDailiesT3"
  ];
  const level0Terms = [
    ...metadataTerms,
    ...tokenSupportingShells,
    ...dailyTokeniumSupportingShells
  ];

  const searchResults = {
    metadata: await countAsciiOccurrencesByTerm("workbench/apk/base/global-metadata.dat", metadataTerms),
    level0: await countAsciiOccurrencesByTerm("workbench/unity/joined/level0", level0Terms)
  };

  return {
    generatedAt: "2026-04-21",
    sources: {
      metadata: "workbench/apk/base/global-metadata.dat",
      level0: "workbench/unity/joined/level0",
      tokenShopExtract: "db:derived:token-shop-values",
      dailyTokeniumLaneClues: "data/daily-tokenium-lane-clues.json",
      sourceModel: "db-derived-token-shop-action-lanes"
    },
    tokenDirectBuyHooks,
    tokenHoldHooks,
    diamondDirectBuyHooks,
    diamondHoldHooks,
    dailyTokeniumModifierHooks,
    tokenSupportingShells,
    dailyTokeniumSupportingShells,
    searchResults,
    currentBoundary: [
      "The token-shop action lane now derives from grounded TokenShop row families plus direct metadata and level0 string checks, not from the old standalone spend-action probe snapshot.",
      "BuyTokenBoost, BuyMK1-8TokenBoost, and BuyDiamondBoost remain separated from Daily Tokenium modifier hooks BuyLM244 and BuyCollectorDevice.",
      "BuyTokenDailiesT2 and BuyTokenDailiesT3 still stay unresolved as direct purchase hooks because the current metadata and level0 checks remain empty for both names.",
      "This keeps spend action families split cleanly enough for current spend-side system views without promoting save-state ownership or planner-ready player data."
    ]
  };
}

async function buildTokeniumNamingClues() {
  const assetCandidates = {
    resourceIcons: [
      "workbench/extract/assetripper-primary/Assets/Resources/resourceicons/Resource_Tokenium.json",
      "workbench/extract/assetripper-primary/Assets/Resources/resourceicons/Resource_Tokenium_Cap_0.json"
    ],
    academySprites: [
      "workbench/extract/assetripper-primary/Assets/Sprite/Aca.Tokenium553.json"
    ]
  };
  const assetNames = {
    resourceIcons: [],
    academySprites: []
  };
  for (const candidate of assetCandidates.resourceIcons) {
    if (await pathExists(candidate)) {
      assetNames.resourceIcons.push(path.basename(candidate, ".json"));
    }
  }
  for (const candidate of assetCandidates.academySprites) {
    if (await pathExists(candidate)) {
      assetNames.academySprites.push(path.basename(candidate, ".json"));
    }
  }

  const level0ShellCandidates = [
    "AvailableTokensBar",
    "CostBox-Tokens",
    "CostBox-Tokens.TR",
    "CostBox-Tokens.LR",
    "CostBox-Tokens.TOTAL",
    "CostBox-Tokenium",
    "CostBox-Tokenium.TR",
    "CostBox-Tokenium.LR",
    "CostBox-Tokenium.TOTAL"
  ];
  const metadataStringCandidates = [
    "Daily Tokenium (from blue farm missions)",
    "Mission Materials",
    "@Research 106 - Mission Materials",
    "INCREASE TOKENS PER TOKENIUM-553"
  ];
  const level0Counts = await countAsciiOccurrencesByTerm(
    "workbench/unity/joined/level0",
    level0ShellCandidates
  );
  const metadataCounts = await countAsciiOccurrencesByTerm(
    "workbench/apk/base/global-metadata.dat",
    metadataStringCandidates
  );

  return {
    generatedAt: "2026-04-22",
    sources: {
      metadata: "workbench/apk/base/global-metadata.dat",
      level0: "workbench/unity/joined/level0",
      assetNames: [
        ...assetCandidates.resourceIcons,
        ...assetCandidates.academySprites
      ],
      sourceModel: "db-derived-tokenium-naming-clues"
    },
    assetNames,
    level0Shells: level0ShellCandidates.filter((name) => (level0Counts[name] ?? 0) > 0),
    metadataStrings: metadataStringCandidates.filter((name) => (metadataCounts[name] ?? 0) > 0),
    currentBoundary: [
      "Shipped assets preserve both generic Tokenium and Academy.Tokenium553 naming.",
      "Level0 preserves parallel CostBox-Tokens and CostBox-Tokenium shells plus AvailableTokensBar.",
      "This is enough to keep token and tokenium naming lanes separate in app-facing grounding.",
      "It is not yet enough to prove whether Tokenium and Tokenium-553 are one internal resource id or presentation variants of the same lane."
    ]
  };
}

function findDirectTypeMetadata(typeSupport, scriptName) {
  return Array.isArray(typeSupport?.directTargetTypeMetadata)
    ? typeSupport.directTargetTypeMetadata.find((entry) => entry?.scriptName === scriptName) ?? null
    : null;
}

function findField(typeEntry, fieldName) {
  return Array.isArray(typeEntry?.fields)
    ? typeEntry.fields.find((field) => field?.name === fieldName) ?? null
    : null;
}

function findMethod(typeEntry, methodName) {
  return Array.isArray(typeEntry?.methods)
    ? typeEntry.methods.find((method) => method?.name === methodName) ?? null
    : null;
}

async function buildTokenBankControllerShell(tokenShopValues, tokenBankStateClues) {
  const controllerFieldNames = new Set(
    Array.isArray(tokenShopValues?.fields)
      ? tokenShopValues.fields
          .filter((field) => field?.group === "controller" && typeof field.field === "string")
          .map((field) => field.field)
      : []
  );
  const tokenShopMethods = Array.isArray(tokenBankStateClues?.tokenShopMethods)
    ? tokenBankStateClues.tokenShopMethods
    : [];
  const tokenShopControllerRefs = Array.isArray(tokenBankStateClues?.tokenShopControllerRefs)
    ? tokenBankStateClues.tokenShopControllerRefs
    : [];
  const controllerAnchors = [
    "TokenShop",
    "ClaimBankedTokens",
    "SetBankFill",
    ...tokenShopControllerRefs.filter((name) =>
      ["BankFill", "TokenBankDescriptionText"].includes(name)
    ),
    "CheckTokenClaimNotification",
    "TokenShopButtonNotification"
  ].filter((value, index, array) => array.indexOf(value) === index);
  const adjacentControllerMethods = tokenShopMethods.filter((name) =>
    ["get_TokenBankCap", "get_ClaimableBankTokens", "IncreaseBankedTokens"].includes(name)
  );
  const metadataTerms = [...controllerAnchors, ...adjacentControllerMethods];
  const level0Terms = ["ClaimBankedTokens", "BankedDescriptionTextIncrease"];
  const sourcePresence = {
    metadata: await countAsciiOccurrencesByTerm("workbench/apk/base/global-metadata.dat", metadataTerms),
    level0: await countAsciiOccurrencesByTerm("workbench/unity/joined/level0", level0Terms)
  };

  return {
    generatedAt: "2026-04-21",
    sources: {
      metadata: "workbench/apk/base/global-metadata.dat",
      level0: "workbench/unity/joined/level0",
      tokenShopExtract: "db:derived:token-shop-values",
      tokenBankStateClues: "data/token-bank-state-clues.json",
      sourceModel: "db-derived-token-bank-controller-shell"
    },
    controllerAnchors,
    adjacentControllerMethods,
    sourcePresence,
    currentBoundary: [
      "The token-bank controller shell now derives from grounded TokenShop controller fields plus direct metadata and level0 checks instead of the old standalone controller-shell probe snapshot.",
      "ClaimBankedTokens, SetBankFill, BankFill, TokenBankDescriptionText, CheckTokenClaimNotification, and TokenShopButtonNotification remain the narrowest current controller-side anchors inside TokenShop.",
      "get_TokenBankCap, get_ClaimableBankTokens, and IncreaseBankedTokens stay adjacent to that shell without promoting any save-side ownership claim for bank values or cap state."
    ],
    dbCorroboration: {
      tokenShopControllerFieldsPresent: [...controllerFieldNames].filter((name) =>
        ["BankFill", "TokenBankDescriptionText", "TokenShopButtonNotification"].includes(name)
      )
    }
  };
}

async function buildTokenShopOwnerShell(tokenShopValues, tokenBankStateClues) {
  const controllerFieldNames = new Set(
    Array.isArray(tokenShopValues?.fields)
      ? tokenShopValues.fields
          .filter((field) => field?.group === "controller" && typeof field.field === "string")
          .map((field) => field.field)
      : []
  );
  const tokenBankMethods = [
    "get_TokenBankCap",
    "get_ClaimableBankTokens",
    "IncreaseBankedTokens",
    "ClaimBankedTokens",
    "SetBankFill"
  ].filter((name) =>
    Array.isArray(tokenBankStateClues?.tokenShopMethods) &&
    tokenBankStateClues.tokenShopMethods.includes(name)
  );
  const notificationHooks = [
    "CheckTokenClaimNotification",
    "TokenShopButtonNotification",
    "BankedDescriptionTextIncrease"
  ];
  const adjacentDeviceHooks = [
    "BuyAutoTokenClicker",
    "BuyAutoDiamondClicker",
    "BuyChestSpeedster"
  ];
  const uiShells = [
    "TokenBankDescriptionText",
    "TokenShopCanvas",
    "TokenShopMenu",
    "TokenShopOverlay",
    "TokenShopRecoloring"
  ];
  const metadataTerms = [
    "TokenShop",
    "InitializeTokenShop",
    "SetAllTokenShopTexts",
    ...tokenBankMethods,
    ...notificationHooks,
    ...adjacentDeviceHooks
  ];
  const level0Terms = ["TokenShop", "ClaimBankedTokens", "BankedDescriptionTextIncrease", ...adjacentDeviceHooks];
  const sourcePresence = {
    metadata: await countAsciiOccurrencesByTerm("workbench/apk/base/global-metadata.dat", metadataTerms),
    level0: await countAsciiOccurrencesByTerm("workbench/unity/joined/level0", level0Terms)
  };

  return {
    generatedAt: "2026-04-21",
    sources: {
      metadata: "workbench/apk/base/global-metadata.dat",
      level0: "workbench/unity/joined/level0",
      tokenShopExtract: "db:derived:token-shop-values",
      tokenBankStateClues: "data/token-bank-state-clues.json",
      sourceModel: "db-derived-token-shop-owner-shell"
    },
    ownerAnchors: ["TokenShop", "InitializeTokenShop", "SetAllTokenShopTexts"],
    tokenBankMethods,
    notificationHooks,
    adjacentDeviceHooks,
    uiShells,
    sourcePresence,
    dbCorroboration: {
      controllerFieldsPresent: [...controllerFieldNames].filter((name) =>
        ["TokenBankDescriptionText", "TokenShopButtonNotification"].includes(name)
      )
    },
    currentBoundary: [
      "The TokenShop owner shell now derives from grounded TokenShop controller fields, token-bank state clues, and direct metadata/level0 checks instead of the old standalone owner-shell probe snapshot.",
      "TokenShop, InitializeTokenShop, SetAllTokenShopTexts, token-bank controller methods, and nearby TokenShopButtonNotification or CheckTokenClaimNotification hooks remain the narrowest current owner-side shell.",
      "BuyAutoTokenClicker, BuyAutoDiamondClicker, and BuyChestSpeedster stay adjacent to TokenShop-side ownership without being promoted into token-bank save-state truth."
    ]
  };
}

async function buildTokenBankStateClues(typeSupport, tokenBankFormulaBoundary) {
  const saveDataType = findDirectTypeMetadata(typeSupport, "SaveData");
  const playerProfileHandlerType = findDirectTypeMetadata(typeSupport, "PlayerProfileHandler");
  const playerProfileDataType = findDirectTypeMetadata(typeSupport, "PlayerProfileData");
  const cloudSaveType = findDirectTypeMetadata(typeSupport, "CloudSavePlayerProfile");

  const bankedTokensField = findField(saveDataType, "BankedTokens");
  const claimableTokeniumField = findField(saveDataType, "ClaimableTokenium");
  const saveInfoCacheField = findField(playerProfileHandlerType, "saveInfoCache");
  const convertMethod = findMethod(playerProfileHandlerType, "ConvertSaveDataToProfileData");
  const playerProfileWrapperFields = ["Tokens", "Tokenium"]
    .map((name) => findField(playerProfileDataType, name))
    .filter(Boolean);
  const shellMethodCandidates = [
    "OnCloudSaveClick",
    "GetCurrentSaveFileInfo",
    "OnCloudLoadClick",
    "OnCloudLoadExtraBackupClick",
    "CloudLoad",
    "GetPlayerProfileInfo",
    "IsCloudSaved"
  ];
  const metadataStateMachineCandidates = [
    "<CloudSave>d__23",
    "<CloudSavePlayerProfile>d__24",
    "<GetCurrentSaveFileInfo>d__25",
    "<CloudLoad>d__28",
    "<GetPlayerProfileInfo>d__29"
  ];
  const transientLocalCandidates = ["<saveData>5__2", "<lastCloudSave>5__3"];
  const metadataPresence = await countAsciiOccurrencesByTerm("workbench/apk/base/global-metadata.dat", [
    "BigStatisticPrefab.TokenBankCap",
    "TextHandlerLoopMods",
    "SetLM244BonusText",
    "CloudSavePlayerProfile",
    ...shellMethodCandidates,
    ...metadataStateMachineCandidates,
    ...transientLocalCandidates
  ]);

  return {
    generatedAt: "2026-04-22",
    sources: {
      metadata: "workbench/apk/base/global-metadata.dat",
      level0: "workbench/unity/joined/level0",
      typeMetadataSupport: "data/uabea-type-metadata-support.v1.json",
      tokenBankFormulaBoundary: "data/token-bank-formula-boundary.json",
      sourceModel: "db-derived-token-bank-state-clues"
    },
    tokenShopMethods: [
      "get_TokenBankCap",
      "get_ClaimableBankTokens",
      "IncreaseBankedTokens",
      "ClaimBankedTokens",
      "CheckTokenClaimNotification",
      "SetBankFill"
    ],
    tokenShopControllerRefs: ["BankFill", "TokenBankDescriptionText"],
    displayOrHandlerClues: [
      "BigStatisticPrefab.TokenBankCap",
      "TextHandlerLoopMods",
      "SetLM244BonusText"
    ].filter((name) => (metadataPresence[name] ?? 0) > 0),
    derivedOutputs: Array.isArray(tokenBankFormulaBoundary?.derivedOutputCluster)
      ? tokenBankFormulaBoundary.derivedOutputCluster
      : [],
    exactSaveOwnerRecovery: bankedTokensField
      ? {
          declaringType: "SaveData",
          storedAmountField: bankedTokensField.name,
          storedAmountFieldType: bankedTokensField.type,
          storedAmountFieldIndex: bankedTokensField.index,
          storedAmountFieldOffset: bankedTokensField.fieldOffset
        }
      : null,
    playerProfilePersistenceBoundary: {
      bridgeOwner: "PlayerProfileHandler",
      bridgeMethod: convertMethod?.name ?? null,
      bridgeReturnType: convertMethod?.returnType ?? null,
      bridgeSignature: convertMethod?.methodProperties?.HumanReadableSignature ?? null,
      handlerField: saveInfoCacheField?.name ?? null,
      handlerFieldType: saveInfoCacheField?.type ?? null,
      wrapperFields: playerProfileWrapperFields.map((field) => ({
        declaringType: "PlayerProfileData",
        field: field.name,
        fieldType: field.type,
        fieldIndex: field.index,
        fieldOffset: field.fieldOffset
      })),
      blockedReason:
        "The checked save-to-profile bridge and wrapper field table only expose generic export strings, not token-bank-specific cap or claimable-bank fields."
    },
    genericTokeniumClaimableBoundary: claimableTokeniumField
      ? {
          declaringType: "SaveData",
          field: claimableTokeniumField.name,
          fieldType: claimableTokeniumField.type,
          fieldIndex: claimableTokeniumField.index,
          fieldOffset: claimableTokeniumField.fieldOffset,
          blockedReason:
            "Exact typed recovery clears SaveData.ClaimableTokenium as a broader generic Tokenium-cluster claimable field, but not as a token-bank-specific cap, claimable-bank, or ready-state owner."
        }
      : null,
    cloudSavePlayerProfileBoundary: {
      scriptName: "CloudSavePlayerProfile",
      typedTargetFound: Boolean(cloudSaveType?.found),
      metadataAnchorFound: (metadataPresence.CloudSavePlayerProfile ?? 0) > 0,
      metadataShellMethods: shellMethodCandidates.filter((name) => (metadataPresence[name] ?? 0) > 0),
      metadataStateMachines: metadataStateMachineCandidates.filter(
        (name) => (metadataPresence[name] ?? 0) > 0
      ),
      metadataTransientLocals: transientLocalCandidates.filter(
        (name) => (metadataPresence[name] ?? 0) > 0
      ),
      blockedReason:
        "The checked direct target-type recovery still does not surface CloudSavePlayerProfile as a found typed target, and the surviving metadata context only narrows it to a cloud-save orchestration shell around save/load routines plus transient SaveData handling rather than a narrower token-bank cap, claimable-bank, or ready-state wrapper."
    },
    negativeTypedOwnerChecks: [
      "SaveData.ClaimableBankTokens",
      "SaveData.TokenBankCap",
      "PlayerProfileData.BankedTokens",
      "PlayerProfileData.ClaimableBankTokens",
      "PlayerProfileData.TokenBankCap"
    ],
    currentBoundary: [
      "Exact typed recovery now confirms that SaveData directly declares BankedTokens as System.Single, which is the strongest current saved-state owner for the token-bank current stored amount.",
      "The same checked typed save tables do not currently expose ClaimableBankTokens or TokenBankCap on SaveData or PlayerProfileData.",
      "The broader PlayerProfile persistence neighborhood is now checked more tightly: PlayerProfileHandler.saveInfoCache is typed as PlayerProfileData and ConvertSaveDataToProfileData(SaveData, System.DateTime) returns PlayerProfileData, but the direct PlayerProfileData wrapper only exposes generic Tokens and Tokenium strings in this lane.",
      "Exact typed recovery also clears SaveData.ClaimableTokenium as a broader generic Tokenium-cluster claimable field, which is useful for boundary narrowing but still does not prove a token-bank-specific claimable or ready-state owner.",
      "The checked direct target-type recovery still does not surface CloudSavePlayerProfile as a found typed target, and the surviving metadata-only CloudSavePlayerProfile shell stays limited to cloud save/load orchestration plus transient SaveData locals instead of a narrower declaring wrapper.",
      "That means neither the checked PlayerProfileData export bridge nor the metadata-only CloudSavePlayerProfile shell recovers one exact token-bank cap or claimable-bank input beyond SaveData.BankedTokens.",
      "TokenShop remains the strongest controller-side owner for token-bank cap, claimable, fill, and claim behavior, but not the recovered save-state owner.",
      "BigStatisticPrefab.TokenBankCap is a separate statistic-display shell for bank-cap presentation.",
      "TextHandlerLoopMods and SetLM244BonusText are still presentation-side daily-tokenium hooks, not recovered gameplay owners.",
      "This is enough to split exact current stored amount ownership from the still-blocked cap and claimable-bank save boundary without guessing from derived outputs or promoting planner behavior."
    ]
  };
}

async function buildDailyTokeniumLaneClues(typeSupport) {
  const saveDataType = findDirectTypeMetadata(typeSupport, "SaveData");
  const dailyTokeniumField = findField(saveDataType, "DailyTokenium");
  const claimableTokeniumField = findField(saveDataType, "ClaimableTokenium");
  const dailyIndex = typeof dailyTokeniumField?.index === "number" ? dailyTokeniumField.index : -1;
  const surroundingFields = Array.isArray(saveDataType?.fields) ? saveDataType.fields : [];
  const immediatelyBefore = dailyIndex >= 2
    ? surroundingFields.slice(dailyIndex - 2, dailyIndex).map((field) => field.name)
    : [];
  const immediatelyAfter = dailyIndex >= 0
    ? surroundingFields.slice(dailyIndex + 1, dailyIndex + 10).map((field) => field.name)
    : [];
  const ownerFamilyCandidates = [
    "SpaceAcademy",
    "SpaceAcademyMain",
    "TextHandlerSpaceAcademy",
    "FarmMissions"
  ];
  const modifierCandidates = [
    "SetLM244BonusText",
    "BuyLM244",
    "FinalDailyTokenBonus",
    "FinalFragmentsGainedFromFarmMissions"
  ];
  const premiumModifierCandidates = [
    "BuyCollectorDevice",
    "CollectorCapBonus",
    "CollectorMatsBonus",
    "SetCollectorDeviceTexts",
    "COLLECTERS PACK",
    "Increases Mission Mats & Daily Tokenium Cap!"
  ];
  const playerFacingStringCandidates = [
    "0 / 2000 Daily Tokenium (from blue farm missions)",
    "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
    "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
  ];
  const metadataPresence = await countAsciiOccurrencesByTerm("workbench/apk/base/global-metadata.dat", [
    ...ownerFamilyCandidates,
    ...modifierCandidates,
    ...premiumModifierCandidates,
    ...playerFacingStringCandidates
  ]);
  const academySpritePath =
    "workbench/extract/assetripper-primary/Assets/Sprite/Aca.Tokenium553.json";

  return {
    generatedAt: "2026-04-22",
    sources: {
      metadata: "workbench/apk/base/global-metadata.dat",
      level0: "workbench/unity/joined/level0",
      iapCatalog: "data/unity-textassets/IAPProductCatalog.txt",
      academySprite: academySpritePath,
      typeMetadataSupport: "data/uabea-type-metadata-support.v1.json",
      sourceModel: "db-derived-daily-tokenium-lane-clues"
    },
    ownerFamilyClues: ownerFamilyCandidates.filter((name) => (metadataPresence[name] ?? 0) > 0),
    modifierClues: modifierCandidates.filter((name) => (metadataPresence[name] ?? 0) > 0),
    premiumModifierClues: premiumModifierCandidates.filter(
      (name) => (metadataPresence[name] ?? 0) > 0
    ),
    playerFacingStrings: playerFacingStringCandidates.filter(
      (name) => (metadataPresence[name] ?? 0) > 0
    ),
    exactSaveOwnerRecovery: dailyTokeniumField
      ? {
          declaringType: "SaveData",
          storedAmountField: dailyTokeniumField.name,
          storedAmountFieldType: dailyTokeniumField.type,
          storedAmountFieldIndex: dailyTokeniumField.index,
          storedAmountFieldOffset: dailyTokeniumField.fieldOffset
        }
      : null,
    saveNeighborhoodWrapperRecovery: {
      declaringType: "SaveData",
      wrapperLabel: "Academy or Farm Mission persistence neighborhood",
      fieldOrderEvidence: {
        immediatelyBefore,
        immediatelyAfter
      },
      whyItClears:
        "Exact typed field order places SaveData.DailyTokenium inside a mission-progress and mission-activity save block, which is a narrower save-side wrapper than the earlier SpaceAcademy or FarmMissions family-only boundary.",
      blockedReason:
        "This neighborhood still does not expose a DailyTokeniumCap field or a Daily Tokenium-specific ready or claimable field, so it narrows the wrapper without clearing cap or claim-state ownership."
    },
    genericTokeniumClaimableBoundary: claimableTokeniumField
      ? {
          declaringType: "SaveData",
          field: claimableTokeniumField.name,
          fieldType: claimableTokeniumField.type,
          fieldIndex: claimableTokeniumField.index,
          fieldOffset: claimableTokeniumField.fieldOffset,
          blockedReason:
            "The typed tables place ClaimableTokenium on the broader Tokenium resource cluster beside Tokenium, TokeniumExchangeLevel, TokeniumUnlocked, and TokeniumDiamondUpgLevel, not on a DailyTokenium or FarmMissions-specific wrapper."
        }
      : null,
    negativeTypedOwnerChecks: [
      "SaveData.DailyTokeniumCap",
      "PlayerProfileData.DailyTokenium",
      "PlayerProfileData.DailyTokeniumCap"
    ],
    currentBoundary: [
      "Shipped APK and Unity artifacts still preserve SpaceAcademy and FarmMissions as the strongest gameplay-surface family for the Daily Tokenium lane.",
      "Exact typed recovery now confirms SaveData.DailyTokenium as the stored-amount field for the lane without promoting a wider Academy or Farm Mission wrapper claim.",
      "Checked SaveData field order now narrows the save-side wrapper to a mission-persistence neighborhood around mission counters, mission-active flags, and Wasta campaign or farm progression fields.",
      "SetLM244BonusText and BuyLM244 still behave like modifier-side or text-side hooks around that lane, not as recovered saved-state owners.",
      "Collector pack strings still give the repo a grounded premium modifier clue for the same Academy Menu Daily Tokenium cap lane.",
      "The typed tables do not currently expose DailyTokeniumCap on SaveData or PlayerProfileData, and ClaimableTokenium remains blocked at the broader generic Tokenium cluster rather than a checked Daily Tokenium ready-state owner."
    ]
  };
}

async function traceRunSection(traceScope, provenanceSources) {
  const materialized = fetchLatestMaterializedTargetBundle(traceScope);
  return {
    sourcePath: `db:materialized-target-bundle:${traceScope}`,
    provenanceSources,
    traceScope,
    requestSignature: materialized.requestSignature ?? null,
    builtAt: materialized.builtAt ?? null,
    reducerVersion: materialized.reducerVersion ?? null,
    data: materialized.payload ? sanitizeTraceBundleExport(materialized.payload) : null
  };
}

function withTargetShape(unit, targetShape) {
  return {
    ...unit,
    canonical: targetShape.canonical ?? {},
    boundaries: targetShape.boundaries ?? {},
    models: targetShape.models ?? {},
    support: targetShape.support ?? {},
    traceEvidence: targetShape.traceEvidence ?? {}
  };
}

async function buildTokenShopUnit() {
  const unitInventory = await readJson("data/units/token-shop.v1.json");
  const typeMetadataSupport = await readJson("data/uabea-type-metadata-support.v1.json");
  const tokenShopValues = await fetchOrBuildTokenShopValues();
  const tokenShopLegacyCanonical = await readJson("data/tokenshop-canonical-v1.json");
  const tokenShopCanonicalRecords = await fetchOrBuildTokenShopCanonicalRecords(
    tokenShopValues,
    typeMetadataSupport
  );
  const tokenShopTierPolicy = await fetchOrBuildTokenShopTierPolicy(tokenShopLegacyCanonical);
  const tokenShopSaveBoundary = await readJson("data/token-shop-save-boundary.v2.json");
  const tokenShopRowLevelOwner = await readJson("data/token-shop-row-level-owner.json");
  const tokenShopRowRemapBoundary = await readJson("data/token-shop-row-remap-boundary.json");
  const tokenShopLateAtuBoundary = await readJson("data/token-shop-late-atu-boundary.json");
  const tokeniumNamingClues = await buildTokeniumNamingClues();
  const tokenBankFormulaBoundary = await readJson("data/token-bank-formula-boundary.json");
  const tokenBankStateClues = await buildTokenBankStateClues(
    typeMetadataSupport,
    tokenBankFormulaBoundary
  );
  const dailyTokeniumLaneClues = await buildDailyTokeniumLaneClues(typeMetadataSupport);
  const tokenShopAtu3EffectTrace = await traceRunSection(
    "token-shop-atu3-cells-effect",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu3ChestConsumerTrace = await traceRunSection(
    "token-shop-atu3-chest-consumer",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu3ChestConsumerReadTrace = await traceRunSection(
    "token-shop-atu3-chest-consumer-read",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu4ModTrace = await traceRunSection(
    "token-shop-atu4-mod",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu5Mk1TitleTrace = await traceRunSection(
    "token-shop-atu5-mk1-title",
    ["token-shop-trace-command"]
  );
  const tokenShopAtu7Mk3BridgeTrace = await traceRunSection(
    "token-shop-atu7-mk3-bridge",
    ["token-shop-trace-command"]
  );
  const tokenShopFamilyStructureTrace = await traceRunSection(
    "token-shop-family-structure",
    ["token-shop-trace-command"]
  );
  const tokenShopCostLanes = buildTokenShopCostLaneSupport(
    tokenShopValues,
    tokenShopFamilyStructureTrace?.data ?? {}
  );
  const tokenShopActionLanes = await buildTokenShopActionLaneSupport(
    tokenShopValues,
    dailyTokeniumLaneClues
  );
  const tokenBankControllerShell = await buildTokenBankControllerShell(
    tokenShopValues,
    tokenBankStateClues
  );
  const tokenShopOwnerShell = await buildTokenShopOwnerShell(
    tokenShopValues,
    tokenBankStateClues
  );

  const sections = {
    rows: {
      extract: datasetSection("db:derived:token-shop-values", tokenShopValues, [
        "token-shop-values"
      ]),
      canonical: datasetSection(
        "db:derived:token-shop-canonical-records",
        tokenShopCanonicalRecords,
        ["token-shop-values", "uabea-type-metadata-support"]
      ),
      policy: {
        tierUnlocks: {
          sourcePath: "db:policy:token-shop-tier-unlocks",
          provenanceSources: ["tokenshop-canonical"],
          data: tokenShopTierPolicy
        }
      },
      boundaries: {
        rowLevelOwner: datasetSection(
          "data/token-shop-row-level-owner.json",
          tokenShopRowLevelOwner,
          ["token-shop-row-level-owner"]
        ),
        save: datasetSection("data/token-shop-save-boundary.v2.json", tokenShopSaveBoundary, [
          "token-shop-row-remap-boundary"
        ]),
        remap: datasetSection(
          "data/token-shop-row-remap-boundary.json",
          tokenShopRowRemapBoundary,
          ["token-shop-row-remap-boundary"]
        ),
        lateAtu: datasetSection("data/token-shop-late-atu-boundary.json", tokenShopLateAtuBoundary, [
          "token-shop-row-remap-boundary"
        ])
      }
    },
    tokenBank: {
      namingClues: {
        sourcePath: "db:derived:tokenium-naming-clues",
        provenanceSources: ["token-shop-values"],
        data: tokeniumNamingClues
      },
      stateClues: {
        sourcePath: "db:derived:token-bank-state-clues",
        provenanceSources: ["uabea-type-metadata-support", "token-bank-formula-boundary"],
        data: tokenBankStateClues
      },
      ownerShell: {
        sourcePath: "db:derived:token-shop-owner-shell",
        provenanceSources: ["token-shop-values", "token-bank-state-clues"],
        data: tokenShopOwnerShell
      },
      controllerShell: {
        sourcePath: "db:derived:token-bank-controller-shell",
        provenanceSources: ["token-shop-values", "token-bank-state-clues"],
        data: tokenBankControllerShell
      },
      formulaBoundary: datasetSection(
        "data/token-bank-formula-boundary.json",
        tokenBankFormulaBoundary,
        ["token-shop-row-remap-boundary"]
      )
    },
    dailyTokenium: {
      laneClues: {
        sourcePath: "db:derived:daily-tokenium-lane-clues",
        provenanceSources: ["uabea-type-metadata-support"],
        data: dailyTokeniumLaneClues
      }
    },
    spendLanes: {
      costLanes: {
        sourcePath: "db:derived:token-shop-cost-lanes",
        provenanceSources: ["token-shop-values", "token-shop-trace-command"],
        data: tokenShopCostLanes
      },
      actionLaneClues: {
        sourcePath: "db:derived:token-shop-action-lanes",
        provenanceSources: ["token-shop-values", "daily-tokenium-lane-clues"],
        data: tokenShopActionLanes
      }
    },
    traceRuns: {
      atu3Effect: tokenShopAtu3EffectTrace,
      atu3ChestConsumer: tokenShopAtu3ChestConsumerTrace,
      atu3ChestConsumerRead: tokenShopAtu3ChestConsumerReadTrace,
      atu4Mod: tokenShopAtu4ModTrace,
      atu5Mk1Title: tokenShopAtu5Mk1TitleTrace,
      atu7Mk3Bridge: tokenShopAtu7Mk3BridgeTrace,
      familyStructure: tokenShopFamilyStructureTrace
    }
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "token-shop",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/token-shop.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {
      rows: {
        canonical: sections.rows.canonical
      }
    },
    boundaries: {
      rows: sections.rows.boundaries,
      tokenBank: {
        formulaBoundary: sections.tokenBank.formulaBoundary
      }
    },
    models: {},
    support: {
      rows: {
        extract: sections.rows.extract,
        policy: sections.rows.policy
      },
      tokenBank: {
        namingClues: sections.tokenBank.namingClues,
        stateClues: sections.tokenBank.stateClues,
        ownerShell: sections.tokenBank.ownerShell,
        controllerShell: sections.tokenBank.controllerShell
      },
      dailyTokenium: sections.dailyTokenium,
      spendLanes: sections.spendLanes
    },
    traceEvidence: sections.traceRuns
  });
}

async function buildMultiverseMarketUnit() {
  const unitInventory = await readJson("data/units/multiverse-market.v1.json");
  const multiverseMarketValues = await fetchOrBuildMultiverseMarketValues();
  const multiverseMarketMetadataNeighborhood =
    await fetchOrBuildMultiverseMarketMetadataNeighborhood();
  const multiverseMarketRangeBoundary = await readJson(
    "data/multiverse-market-range-boundary.json"
  );
  const multiverseMarketPrefabRemapBoundary = await readJson(
    "data/multiverse-market-prefab-remap-boundary.json"
  );
  const multiverseMarketSaveBoundary = await readJson(
    "data/multiverse-market-save-boundary.v2.json"
  );
  const multiverseMarketMarketMemberBoundary = await readJson(
    "data/multiverse-market-market-member-boundary.json"
  );
  const multiverseMarketSaveDataImportBoundary = await readJson(
    "data/multiverse-market-savedata-import-boundary.json"
  );
  const multiverseMarketRow6974IdentitySourceBoundary = await readJson(
    "data/multiverse-market-row69-74-identity-source-boundary.json"
  );
  const multiverseMarketSerializedLabelSourceBoundary = await readJson(
    "data/multiverse-market-serialized-label-source-boundary.json"
  );
  const multiverseMarketRow7174IdentityBoundary = await readJson(
    "data/multiverse-market-row71-74-identity-boundary.json"
  );
  const multiverseMarketRow7174RemapBand = await readJson(
    "data/multiverse-market-row71-74-remap-band.json"
  );
  const multiverseMarketNearbyIdentityBindingPattern = await readJson(
    "data/multiverse-market-nearby-identity-binding-pattern.json"
  );
  const multiverseMarket6974AnomalyProvenance = await readJson(
    "data/multiverse-market-69-74-anomaly-provenance.json"
  );
  const multiverseMarketInscriptionNumberingStabilityBoundary = await readJson(
    "data/multiverse-market-inscription-numbering-stability-boundary.json"
  );
  const multiverseMarketShellRowPredictionBoundary = await readJson(
    "data/multiverse-market-shell-row-prediction-boundary.json"
  );
  const multiverseMarketTextProvenancePathBoundary = await readJson(
    "data/multiverse-market-text-provenance-path-boundary.json"
  );
  const multiverseMarketSaveOwnerTrace = await traceRunSection(
    "multiverse-market-save-owner-boundary",
    ["multiverse-market-trace-command"]
  );
  const multiverseMarketRowTextCoverage = buildMultiverseRowTextCoverage(multiverseMarketValues);
  const multiverseMarketActionShell = buildMultiverseActionShellSupport(
    multiverseMarketValues,
    multiverseMarketRowTextCoverage
  );
  const multiverseMarketOwnerFamily = await buildMultiverseOwnerFamilySupport(
    multiverseMarketValues,
    multiverseMarketActionShell
  );

  const sections = {
    saveOwner: {
      extract: datasetSection("db:derived:multiverse-market-values", multiverseMarketValues, [
        "multiverse-market-values"
      ]),
      saveBoundary: datasetSection(
        "data/multiverse-market-save-boundary.v2.json",
        multiverseMarketSaveBoundary,
        ["multiverse-market-save-boundary"]
      ),
      marketMemberBoundary: datasetSection(
        "data/multiverse-market-market-member-boundary.json",
        multiverseMarketMarketMemberBoundary,
        ["multiverse-market-member-boundary"]
      ),
      saveDataImportBoundary: datasetSection(
        "data/multiverse-market-savedata-import-boundary.json",
        multiverseMarketSaveDataImportBoundary,
        ["multiverse-market-save-boundary"]
      ),
      traceBoundary: multiverseMarketSaveOwnerTrace
    },
    rowIdentity: {
      metadataNeighborhood: datasetSection(
        "db:derived:multiverse-market-metadata-neighborhood",
        multiverseMarketMetadataNeighborhood,
        ["multiverse-market-values"]
      ),
      rangeBoundary: datasetSection(
        "data/multiverse-market-range-boundary.json",
        multiverseMarketRangeBoundary,
        ["multiverse-market-save-boundary"]
      ),
      rowTextCoverage: datasetSection(
        "db:derived:multiverse-market-row-text-coverage",
        multiverseMarketRowTextCoverage,
        ["multiverse-market-values"]
      ),
      prefabRemapBoundary: datasetSection(
        "data/multiverse-market-prefab-remap-boundary.json",
        multiverseMarketPrefabRemapBoundary,
        ["multiverse-market-save-boundary"]
      ),
      identitySourceBoundary: datasetSection(
        "data/multiverse-market-row69-74-identity-source-boundary.json",
        multiverseMarketRow6974IdentitySourceBoundary,
        ["multiverse-market-save-boundary"]
      ),
      serializedLabelSourceBoundary: datasetSection(
        "data/multiverse-market-serialized-label-source-boundary.json",
        multiverseMarketSerializedLabelSourceBoundary,
        ["multiverse-market-save-boundary"]
      ),
      row7174IdentityBoundary: datasetSection(
        "data/multiverse-market-row71-74-identity-boundary.json",
        multiverseMarketRow7174IdentityBoundary,
        ["multiverse-market-save-boundary"]
      ),
      row7174RemapBand: datasetSection(
        "data/multiverse-market-row71-74-remap-band.json",
        multiverseMarketRow7174RemapBand,
        ["multiverse-market-save-boundary"]
      ),
      nearbyIdentityBindingPattern: datasetSection(
        "data/multiverse-market-nearby-identity-binding-pattern.json",
        multiverseMarketNearbyIdentityBindingPattern,
        ["multiverse-market-save-boundary"]
      ),
      anomalyProvenance: datasetSection(
        "data/multiverse-market-69-74-anomaly-provenance.json",
        multiverseMarket6974AnomalyProvenance,
        ["multiverse-market-save-boundary"]
      ),
      numberingStabilityBoundary: datasetSection(
        "data/multiverse-market-inscription-numbering-stability-boundary.json",
        multiverseMarketInscriptionNumberingStabilityBoundary,
        ["multiverse-market-save-boundary"]
      ),
      shellRowPredictionBoundary: datasetSection(
        "data/multiverse-market-shell-row-prediction-boundary.json",
        multiverseMarketShellRowPredictionBoundary,
        ["multiverse-market-save-boundary"]
      ),
      textProvenancePathBoundary: datasetSection(
        "data/multiverse-market-text-provenance-path-boundary.json",
        multiverseMarketTextProvenancePathBoundary,
        ["multiverse-market-save-boundary"]
      )
    },
    uiShell: {
      actionShell: datasetSection(
        "db:derived:multiverse-market-action-shell",
        multiverseMarketActionShell,
        ["multiverse-market-values", "multiverse-market-row-text-coverage"]
      ),
      ownerFamily: datasetSection(
        "db:derived:multiverse-market-owner-family",
        multiverseMarketOwnerFamily,
        ["multiverse-market-values", "multiverse-market-row-text-coverage"]
      ),
      traceBoundary: multiverseMarketSaveOwnerTrace
    }
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "multiverse-market",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/multiverse-market.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {},
    boundaries: {
      saveOwner: {
        saveBoundary: sections.saveOwner.saveBoundary,
        marketMemberBoundary: sections.saveOwner.marketMemberBoundary,
        saveDataImportBoundary: sections.saveOwner.saveDataImportBoundary
      },
      rowIdentity: {
        rangeBoundary: sections.rowIdentity.rangeBoundary,
        prefabRemapBoundary: sections.rowIdentity.prefabRemapBoundary,
        identitySourceBoundary: sections.rowIdentity.identitySourceBoundary,
        serializedLabelSourceBoundary: sections.rowIdentity.serializedLabelSourceBoundary,
        row7174IdentityBoundary: sections.rowIdentity.row7174IdentityBoundary,
        row7174RemapBand: sections.rowIdentity.row7174RemapBand,
        nearbyIdentityBindingPattern: sections.rowIdentity.nearbyIdentityBindingPattern,
        anomalyProvenance: sections.rowIdentity.anomalyProvenance,
        numberingStabilityBoundary: sections.rowIdentity.numberingStabilityBoundary,
        shellRowPredictionBoundary: sections.rowIdentity.shellRowPredictionBoundary,
        textProvenancePathBoundary: sections.rowIdentity.textProvenancePathBoundary
      }
    },
    models: {},
    support: {
      saveOwner: {
        extract: sections.saveOwner.extract
      },
      rowIdentity: {
        metadataNeighborhood: sections.rowIdentity.metadataNeighborhood,
        rowTextCoverage: sections.rowIdentity.rowTextCoverage
      },
      uiShell: {
        actionShell: sections.uiShell.actionShell,
        ownerFamily: sections.uiShell.ownerFamily
      }
    },
    traceEvidence: {
      saveOwner: sections.saveOwner.traceBoundary,
      uiShell: {
        traceBoundary: sections.uiShell.traceBoundary
      }
    }
  });
}

async function buildShardsUnit() {
  const unitInventory = await readJson("data/units/shards.v1.json");
  const shardMilestones = await readJson("data/shard-milestones.grounded.v1.json");
  const shardObservedBehaviors = await readJson("data/shard-observed-behaviors.grounded.v1.json");
  const shardProvenance = await readJson("data/shard-milestones-provenance.grounded.v1.json");
  const shardAssetGrounding = await readJson("data/shard-asset-grounding.v1.json");
  const shardOwnerFamilyBoundary = await readJson("data/shard-owner-family-boundary.v1.json");
  const shardFinalSuBonusBoundary = await readJson("data/shard-finalsu-bonus-boundary.v1.json");
  const shardMilestonePayloadBoundary = await readJson(
    "data/shard-milestone-payload-boundary.v1.json"
  );
  const shardMilestoneRowModelBoundary = await readJson(
    "data/shard-milestone-row-model-boundary.v1.json"
  );
  const shardMilestoneTitleEffectBoundary = await readJson(
    "data/shard-milestone-title-effect-boundary.v1.json"
  );
  const shardEffectTextHandlerBoundary = await readJson(
    "data/shard-effect-text-handler-boundary.v1.json"
  );
  const shardMilestoneRowShellBoundary = await readJson(
    "data/shard-milestone-row-shell-boundary.v1.json"
  );
  const shardMilestoneRowAlignmentBoundary = await readJson(
    "data/shard-milestone-row-alignment-boundary.v1.json"
  );
  const shardMilestoneHandoffBoundary = await readJson(
    "data/shard-milestone-handoff-boundary.v2.json"
  );
  const shardSaveBoundary = await readJson("data/shard-save-boundary.v2.json");
  const shardMilestoneSaveOwnerCandidates = await readJson(
    "data/shard-milestone-save-owner-candidates.v2.json"
  );
  const shardCostModelBoundary = await readJson("data/shard-cost-model-boundary.v1.json");
  const shardCostScreenshotCalibration = await fetchOrBuildShardCostScreenshotCalibration();
  const shardCostFormulaModel = await fetchOrBuildShardCostFormulaModel();
  const shardFamilyEvidence = buildShardMilestoneFamilyEvidence(
    shardMilestones,
    shardMilestoneRowModelBoundary,
    shardMilestoneTitleEffectBoundary,
    shardEffectTextHandlerBoundary,
    shardMilestoneRowShellBoundary,
    shardMilestonePayloadBoundary,
    shardMilestoneHandoffBoundary,
    shardSaveBoundary,
    shardCostFormulaModel
  );
  const shardBonusSlotProbe = buildShardBonusSlotSupport(shardFamilyEvidence);
  const shardOwnedStateTrace = await traceRunSection(
    "shard-owned-state-upgradeinfolist-population",
    ["shard-owned-state-trace-command"]
  );
  const shardCostTrace = await traceRunSection(
    "shard-cost-su0-structure",
    ["shard-cost-trace-command"]
  );

  const sections = {
    family: {
      grounded: {
        milestones: datasetSection("data/shard-milestones.grounded.v1.json", shardMilestones, [
          "shard-family-evidence"
        ]),
        observedBehaviors: datasetSection(
          "data/shard-observed-behaviors.grounded.v1.json",
          shardObservedBehaviors,
          ["shard-family-evidence"]
        ),
        provenance: datasetSection(
          "data/shard-milestones-provenance.grounded.v1.json",
          shardProvenance,
          ["shard-family-evidence"]
        ),
        assetGrounding: datasetSection(
          "data/shard-asset-grounding.v1.json",
          shardAssetGrounding,
          ["shard-family-evidence"]
        )
      },
      familyEvidence: datasetSection("db:derived:shard-milestone-family-evidence", shardFamilyEvidence, [
        "shard-family-evidence"
      ]),
      boundaries: {
        ownerFamily: datasetSection(
          "data/shard-owner-family-boundary.v1.json",
          shardOwnerFamilyBoundary,
          ["shard-save-boundary"]
        ),
        finalSuBonus: datasetSection(
          "data/shard-finalsu-bonus-boundary.v1.json",
          shardFinalSuBonusBoundary,
          ["shard-save-boundary"]
        ),
        milestonePayload: datasetSection(
          "data/shard-milestone-payload-boundary.v1.json",
          shardMilestonePayloadBoundary,
          ["shard-save-boundary"]
        ),
        rowModel: datasetSection(
          "data/shard-milestone-row-model-boundary.v1.json",
          shardMilestoneRowModelBoundary,
          ["shard-save-boundary"]
        ),
        titleEffect: datasetSection(
          "data/shard-milestone-title-effect-boundary.v1.json",
          shardMilestoneTitleEffectBoundary,
          ["shard-save-boundary"]
        ),
        effectTextHandler: datasetSection(
          "data/shard-effect-text-handler-boundary.v1.json",
          shardEffectTextHandlerBoundary,
          ["shard-save-boundary"]
        ),
        rowShell: datasetSection(
          "data/shard-milestone-row-shell-boundary.v1.json",
          shardMilestoneRowShellBoundary,
          ["shard-save-boundary"]
        ),
        rowAlignment: datasetSection(
          "data/shard-milestone-row-alignment-boundary.v1.json",
          shardMilestoneRowAlignmentBoundary,
          ["shard-save-boundary"]
        ),
        handoff: datasetSection(
          "data/shard-milestone-handoff-boundary.v2.json",
          shardMilestoneHandoffBoundary,
          ["shard-save-boundary"]
        )
      }
    },
    ownedState: {
      saveBoundary: datasetSection("data/shard-save-boundary.v2.json", shardSaveBoundary, [
        "shard-save-boundary"
      ]),
      saveOwnerCandidates: datasetSection(
        "data/shard-milestone-save-owner-candidates.v2.json",
        shardMilestoneSaveOwnerCandidates,
        ["shard-save-boundary"]
      ),
      traceBoundary: shardOwnedStateTrace
    },
    cost: {
      costModelBoundary: datasetSection(
        "data/shard-cost-model-boundary.v1.json",
        shardCostModelBoundary,
        ["shard-cost-formula-model"]
      ),
      screenshotCalibration: datasetSection(
        "db:policy:shard-cost-screenshot-calibration",
        shardCostScreenshotCalibration,
        ["shard-cost-formula-model"]
      ),
      listPathProbe: datasetSection("db:derived:shard-cost-list-path", {
        dataset: "shard-cost-list-path",
        generatedAt: "2026-04-22",
        sources: {
          formulaModel: "db:derived:shard-cost-formula-model",
          sourceModel: "db-derived-shard-cost-list-path"
        },
        ownerFields: {
          milestoneCostListField: {
            name: shardCostFormulaModel.runtimeGetterRules?.cacheLifecycle?.cacheField ?? null,
            fieldOffset:
              shardCostFormulaModel.runtimeGetterRules?.cacheLifecycle?.cacheFieldOffset ?? null
          }
        },
        findings: shardCostFormulaModel.runtimeGetterRules?.cacheLifecycle?.notes ?? [],
        callOrder:
          shardCostFormulaModel.runtimeGetterRules?.getterFamily?.stableCallOrder ?? [],
        currentBoundary: [
          "Treat GetShardCostList as a checked owner-side cache builder for the same per-row getter outputs, not as proof of a different shard cost formula.",
          "Treat UpdateShardCostList, SortCostAndBools, and CountAffordableShard as downstream consumers of the getter family.",
          "Do not expose exact shard next-costs until the repo still proves how each get_SU*Cost getter itself assembles the returned BreakInfinity.BigDouble."
        ]
      }, ["shard-cost-formula-model"]),
      bonusSlotProbe: datasetSection(
        "db:derived:shard-bonus-slot-support",
        shardBonusSlotProbe,
        ["shard-family-evidence"]
      ),
      formulaModel: datasetSection(
        "db:derived:shard-cost-formula-model",
        shardCostFormulaModel,
        ["shard-cost-formula-model"]
      ),
      traceBoundary: shardCostTrace
    }
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "shards",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/shards.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {
      family: {
        grounded: sections.family.grounded
      }
    },
    boundaries: {
      family: sections.family.boundaries,
      ownedState: {
        saveBoundary: sections.ownedState.saveBoundary,
        saveOwnerCandidates: sections.ownedState.saveOwnerCandidates
      },
      cost: {
        costModelBoundary: sections.cost.costModelBoundary
      }
    },
    models: {
      cost: {
        formulaModel: sections.cost.formulaModel,
        screenshotCalibration: sections.cost.screenshotCalibration
      }
    },
    support: {
      family: {
        familyEvidence: sections.family.familyEvidence
      },
      cost: {
        listPathProbe: sections.cost.listPathProbe,
        bonusSlotProbe: sections.cost.bonusSlotProbe
      }
    },
    traceEvidence: {
      ownedState: sections.ownedState.traceBoundary,
      cost: sections.cost.traceBoundary
    }
  });
}

async function buildTraceUnit() {
  const unitInventory = await readJson("data/units/trace.v1.json");
  const tracePromotionTargets = fetchTracePromotionTargetsFromDb();
  const tokenShopFamilyStructureTrace = await traceRunSection(
    "token-shop-family-structure",
    ["token-shop-family-trace-command"]
  );
  const tokenShopAtu3EffectTrace = await traceRunSection(
    "token-shop-atu3-cells-effect",
    ["token-shop-family-trace-command"]
  );
  const shardCostTrace = await traceRunSection(
    "shard-cost-su0-structure",
    ["shard-cost-trace-command"]
  );
  const shardOwnedStateTrace = await traceRunSection(
    "shard-owned-state-upgradeinfolist-population",
    ["shard-owned-state-trace-command"]
  );
  const multiverseMarketSaveOwnerTrace = await traceRunSection(
    "multiverse-market-save-owner-boundary",
    ["multiverse-market-trace-command"]
  );

  const sections = {
    liveRuns: {
      tokenShopFamilyStructure: tokenShopFamilyStructureTrace,
      tokenShopAtu3Effect: tokenShopAtu3EffectTrace,
      shardCostSu0Structure: shardCostTrace,
      shardOwnedStateUpgradeinfolistPopulation: shardOwnedStateTrace,
      multiverseMarketSaveOwnerBoundary: multiverseMarketSaveOwnerTrace
    },
    promotionTargets: tracePromotionTargets
  };

  return withTargetShape({
    dataset: "repo-system-unit.v1",
    systemId: "trace",
    version: "v1",
    generatedAt: "2026-04-18",
    generatedBy: "scripts/contracts/generate-system-units.mjs",
    unitInventoryRef: "data/units/trace.v1.json",
    summary: unitInventory.summary,
    liveConsumers: unitInventory.liveConsumers,
    provenance: unitInventory.provenance,
    views: unitInventory.views,
    replacementPlan: unitInventory.replacementPlan,
    transientRegenerationCommands: unitInventory.provenance.sourceRecords.filter(
      (record) => record.kind === "command"
    ),
    sections
  }, {
    canonical: {},
    boundaries: {},
    models: {},
    support: {
      promotionTargets: sections.promotionTargets
    },
    traceEvidence: sections.liveRuns
  });
}

async function main() {
  await mkdir(outputRoot, { recursive: true });
  const appMetaUnit = await buildAppMetaUnit();
  const playerStateUnit = await buildPlayerStateUnit();
  const tokenShopUnit = scrubTraceCompatibilityBlobs(await buildTokenShopUnit());
  const multiverseMarketUnit = scrubTraceCompatibilityBlobs(await buildMultiverseMarketUnit());
  const shardsUnit = scrubTraceCompatibilityBlobs(await buildShardsUnit());
  const traceUnit = scrubTraceCompatibilityBlobs(await buildTraceUnit());

  await writeJson("data/system-units/app-meta.v1.json", appMetaUnit);
  await writeJson("data/system-units/player-state.v1.json", playerStateUnit);
  await writeJson("data/system-units/token-shop.v1.json", tokenShopUnit);
  await writeJson("data/system-units/multiverse-market.v1.json", multiverseMarketUnit);
  await writeJson("data/system-units/shards.v1.json", shardsUnit);
  await writeJson("data/system-units/trace.v1.json", traceUnit);

  upsertMaterializedSystemUnit("app-meta", "v1", appMetaUnit, "data/system-units/app-meta.v1.json");
  upsertMaterializedSystemUnit("player-state", "v1", playerStateUnit, "data/system-units/player-state.v1.json");
  upsertMaterializedSystemUnit("token-shop", "v1", tokenShopUnit, "data/system-units/token-shop.v1.json");
  upsertMaterializedSystemUnit("multiverse-market", "v1", multiverseMarketUnit, "data/system-units/multiverse-market.v1.json");
  upsertMaterializedSystemUnit("shards", "v1", shardsUnit, "data/system-units/shards.v1.json");
  upsertMaterializedSystemUnit("trace", "v1", traceUnit, "data/system-units/trace.v1.json");

  console.log("Generated system units:");
  console.log("- data/system-units/app-meta.v1.json");
  console.log("- data/system-units/player-state.v1.json");
  console.log("- data/system-units/token-shop.v1.json");
  console.log("- data/system-units/multiverse-market.v1.json");
  console.log("- data/system-units/shards.v1.json");
  console.log("- data/system-units/trace.v1.json");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
