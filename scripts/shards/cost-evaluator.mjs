import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { queryOne } from "../contracts/sqlite-compat.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = path.join(repoRoot, "workbench", "ghidra-cache", "ghidra_cache.sqlite3");

function loadShardCostFormulaModel() {
  {
    const materializedRow = queryOne(
      dbPath,
      `
          SELECT payload_json
          FROM materialized_system_unit_views
          WHERE system_id = ? AND version = ?
        `,
      ["shard-cost-formula-model", "v1"]
    );
    if (materializedRow?.payload_json) {
      const payload = JSON.parse(materializedRow.payload_json);
      if (payload?.dataset === "shard-cost-formula-model.v1") {
        return payload;
      }
    }

    const shardUnitRow = queryOne(
      dbPath,
      `
          SELECT payload_json
          FROM materialized_system_unit_views
          WHERE system_id = ? AND version = ?
        `,
      ["shards", "v1"]
    );
    if (shardUnitRow?.payload_json) {
      const shardUnit = JSON.parse(shardUnitRow.payload_json);
      const payload = shardUnit?.sections?.cost?.formulaModel?.data ?? null;
      if (payload?.dataset === "shard-cost-formula-model.v1") {
        return payload;
      }
    }
  }

  throw new Error(
    'Missing DB-backed shard cost formula model. Run "node scripts/contracts/generate-system-units.mjs" first.'
  );
}

const formulaModel = loadShardCostFormulaModel();
const rowClassByRow = new Map();
for (const rowClass of formulaModel.rowClasses) {
  for (const row of rowClass.rows) {
    rowClassByRow.set(row, rowClass);
  }
}

const runtimeGetterRules = formulaModel.runtimeGetterRules || {};
const getterFamily = runtimeGetterRules.getterFamily || {};
const cacheLifecycle = runtimeGetterRules.cacheLifecycle || {};
const sharedStageLogic = runtimeGetterRules.sharedStageLogic || {};
const stableGetterCallOrder = Array.isArray(getterFamily.stableCallOrder)
  ? getterFamily.stableCallOrder
  : [];
const thresholdCoverageClasses = Array.isArray(sharedStageLogic.thresholdCoverageClasses)
  ? sharedStageLogic.thresholdCoverageClasses
  : [];
const overLevelBaseRecoveryPath = formulaModel.derivedParameters?.overLevelBaseRecoveryPath || {};
const derivedOverLevelBaseModels = Array.isArray(overLevelBaseRecoveryPath.derivedRuntimeSeedModels)
  ? overLevelBaseRecoveryPath.derivedRuntimeSeedModels
  : [];

const exactParametersByRow = new Map();
for (const [rowKey, entry] of Object.entries(
  formulaModel?.verifiedParameters?.exactRowParameters ?? {}
)) {
  const row = Number(rowKey);
  exactParametersByRow.set(row, readExactFields(entry, row === 0));
}

const hundredPlusFamilies = formulaModel.stageRules?.hundredPlus?.sharedWindowFamilies || [];
const sampledOffsetFeeders = formulaModel.stageRules?.hundredPlus?.sampledOffsetFeeders || [];
const twoHundredFamilies = formulaModel.stageRules?.twoHundredPlus?.sharedFamilies || [];
const threeHundredFamilies = formulaModel.stageRules?.threeHundredPlus?.sharedFamilies || [];

export function getShardCostFormulaModel() {
  return formulaModel;
}

export function getShardCostRowClass(row) {
  assertRow(row);
  return rowClassByRow.get(row) || null;
}

export function getShardCostRuntimeRule(row) {
  assertRow(row);
  const getterName =
    stableGetterCallOrder.find((name) => name === `get_SU${row}Cost`) || `get_SU${row}Cost`;
  const coverageClass = findThresholdCoverageClass(row);
  return {
    getterName,
    getterCallIndex: stableGetterCallOrder.indexOf(getterName),
    ownerType: getterFamily.ownerType || null,
    returnType: getterFamily.returnType || null,
    listBuilderMethod: cacheLifecycle.listBuilderMethod || null,
    refreshMethod: cacheLifecycle.refreshMethod || null,
    cacheField: cacheLifecycle.cacheField || null,
    cacheFieldOffset: Number(cacheLifecycle.cacheFieldOffset ?? 0) || null,
    sortedConsumerMethod: cacheLifecycle.sortedConsumerMethod || null,
    affordabilityConsumerMethod: cacheLifecycle.affordabilityConsumerMethod || null,
    orderedGetterOutputsCached: cacheLifecycle.orderedGetterOutputsCached === true,
    alternateFormulaPathFound: cacheLifecycle.alternateFormulaPathFound === true,
    windowOrder: Array.isArray(sharedStageLogic.windowOrder)
      ? [...sharedStageLogic.windowOrder]
      : [],
    thresholdGetterNames: coverageClass?.getterNames ? [...coverageClass.getterNames] : [],
    overLevelBaseModels: findOverLevelBaseModelsForRow(coverageClass)
  };
}

export function isShardCostPlannerSafeFromCalibration(calibrationChecks) {
  return (
    formulaModel.completionFlags.automatedCalibrationImplemented === true &&
    calibrationChecks?.allPassed === true &&
    formulaModel.completionFlags.plannerSafeCostOutputApproved === true
  );
}

export async function isShardCostPlannerSafe() {
  const { runShardCostCalibrationChecks } = await import("./calibration-check.mjs");
  return isShardCostPlannerSafeFromCalibration(runShardCostCalibrationChecks());
}

export function evaluateShardCost({ row, level }) {
  assertRow(row);
  const normalizedLevel = normalizeLevel(level);
  const rowClass = getRequiredRowClass(row);
  const params = getRequiredRowParameters(row);
  const runtimeRule = getShardCostRuntimeRule(row);
  const modeledLevel = Math.min(normalizedLevel, getMaxModeledLevel(rowClass));

  let cost = cloneBigDouble(params.StartCost);
  const activeStages = [];
  const adjustments = [];

  if (row === 0) {
    cost = multiplyByPow10(
      cost,
      scalar(params.CostExponent) + modeledLevel * scalar(params.GrowthExponent)
    );
    adjustments.push({
      kind: "base-pre-threshold",
      fieldNames: ["StartCost", "CostExponent", "GrowthExponent"]
    });
    if (modeledLevel >= 100 && params.GrowthExponent2) {
      const delta = (modeledLevel - 99) * scalar(params.GrowthExponent2);
      cost = multiplyByPow10(cost, delta);
      activeStages.push(100);
      adjustments.push({
        kind: "row0-hundred-stage",
        threshold: 100,
        delta
      });
    }
    if (modeledLevel >= 200 && params.GrowthExponent3) {
      const delta = (modeledLevel - 199) * scalar(params.GrowthExponent3);
      cost = multiplyByPow10(cost, delta);
      activeStages.push(200);
      adjustments.push({
        kind: "row0-two-hundred-stage",
        threshold: 200,
        delta
      });
    }
  } else {
    cost = multiplyByPow10(
      cost,
      scalar(params.CostExponent) + modeledLevel * scalar(params.GrowthExponent)
    );
    adjustments.push({
      kind: "base-pre-threshold",
      formula: formulaModel.stageRules.preThreshold.symbolicApproximation
    });

    if (modeledLevel >= 100) {
      activeStages.push(100);
      const family = findStageFamily(hundredPlusFamilies, row);
      const sampledFeeder = findSampledOffsetFeeder(row, family);
      const levelOffset = Number(sampledFeeder?.levelOffset ?? family?.levelOffset ?? 100);
      const remainder = Math.max(0, modeledLevel - levelOffset);
      const coefficient = Number(
        sampledFeeder?.coefficient ?? (levelOffset > 0 ? 1 / levelOffset : 0)
      );
      const stageScalar = 1 + Math.abs(coefficient) * remainder;
      cost = multiplyByScalar(cost, stageScalar);
      adjustments.push({
        kind: "hundred-plus-family",
        profile: family?.model ?? null,
        levelOffset,
        coefficient,
        remainder,
        stageScalar
      });
    }

    if (modeledLevel >= 200 && rowClass.stageCoverage.includes(200)) {
      activeStages.push(200);
      const seededFamily = findSeededFamily(twoHundredFamilies, row);
      const stageScalar = seededFamily
        ? computeSeededStageScalar(seededFamily.integerSeeds, modeledLevel, 200)
        : 1;
      cost = multiplyByScalar(cost, stageScalar);
      adjustments.push({
        kind: "two-hundred-plus-family",
        integerSeeds: seededFamily?.integerSeeds ?? [],
        stageScalar
      });
    }

    if (modeledLevel >= 300 && rowClass.stageCoverage.includes(300)) {
      activeStages.push(300);
      const seededFamily = findSeededFamily(threeHundredFamilies, row);
      const stageScalar = seededFamily
        ? computeSeededStageScalar(seededFamily.integerSeeds, modeledLevel, 300)
        : 1;
      cost = multiplyByScalar(cost, stageScalar);
      adjustments.push({
        kind: "three-hundred-plus-family",
        integerSeeds: seededFamily?.integerSeeds ?? [],
        stageScalar
      });
    }

    if (modeledLevel >= 400 && rowClass.stageCoverage.includes(400)) {
      activeStages.push(400);
      adjustments.push({
        kind: "four-hundred-stage-covered",
        threshold: 400
      });
    }
  }

  cost = normalizeBigDouble(cost.mantissa, cost.exponent);

  return {
    kind: formulaModel.implementation.outputKind,
    deterministic: true,
    status: "bounded-uncertain",
    row,
    requestedLevel: normalizedLevel,
    modeledLevel,
    levelWasClamped: modeledLevel !== normalizedLevel,
    rowClassId: rowClass.id,
    formulaClass: rowClass.nativeFormulaClass,
    stageCoverage: [...rowClass.stageCoverage],
    activeStages,
    runtimeRule,
    normalizedCost: cost,
    inputs: {
      startCost: cloneBigDouble(params.StartCost),
      costExponent: cloneBigDouble(params.CostExponent),
      growthExponent: cloneBigDouble(params.GrowthExponent),
      growthExponent2: params.GrowthExponent2 ? cloneBigDouble(params.GrowthExponent2) : null,
      growthExponent3: params.GrowthExponent3 ? cloneBigDouble(params.GrowthExponent3) : null
    },
    adjustments,
    boundedUncertainty: { ...formulaModel.boundedUncertaintyFlags }
  };
}

function assertRow(row) {
  assert.ok(
    Number.isInteger(row) && row >= 0 && row <= 29,
    "row must be an integer between 0 and 29"
  );
}

function normalizeLevel(level) {
  const numeric = Number(level);
  assert.ok(Number.isFinite(numeric) && numeric >= 0, "level must be a finite non-negative number");
  return Math.floor(numeric);
}

function getRequiredRowClass(row) {
  const rowClass = rowClassByRow.get(row);
  assert.ok(rowClass, `missing row class for row ${row}`);
  return rowClass;
}

function getRequiredRowParameters(row) {
  const params = exactParametersByRow.get(row);
  assert.ok(params, `missing exact parameters for row ${row}`);
  return params;
}

function readExactFields(entry, isRowZero) {
  const exact = entry?.exactBigDoubleValues || {};
  return {
    StartCost: parseBigDoubleLabel(extractBigDoubleLabel(exact.StartCost)),
    CostExponent: parseBigDoubleLabel(extractBigDoubleLabel(exact.CostExponent)),
    GrowthExponent: parseBigDoubleLabel(extractBigDoubleLabel(exact.GrowthExponent)),
    GrowthExponent2:
      isRowZero && exact.GrowthExponent2
        ? parseBigDoubleLabel(extractBigDoubleLabel(exact.GrowthExponent2))
        : null,
    GrowthExponent3:
      isRowZero && exact.GrowthExponent3
        ? parseBigDoubleLabel(extractBigDoubleLabel(exact.GrowthExponent3))
        : null
  };
}

function parseBigDoubleLabel(label) {
  const match = String(label || "").match(/^([+-]?\d+(?:\.\d+)?)e([+-]?\d+)$/u);
  assert.ok(match, `invalid BigDouble label: ${label}`);
  return normalizeBigDouble(Number(match[1]), Number(match[2]));
}

function extractBigDoubleLabel(value) {
  if (value && typeof value === "object" && typeof value.label === "string") {
    return value.label;
  }
  return value;
}

function scalar(value) {
  return value.mantissa * Math.pow(10, value.exponent);
}

function getMaxModeledLevel(rowClass) {
  const maxStage = Math.max(0, ...(rowClass.stageCoverage || []));
  return maxStage > 0 ? maxStage + 99 : 99;
}

function findStageFamily(families, row) {
  return families.find((entry) => Array.isArray(entry.rows) && entry.rows.includes(row)) || null;
}

function findThresholdCoverageClass(row) {
  return (
    thresholdCoverageClasses.find(
      (entry) => Array.isArray(entry.rows) && entry.rows.includes(row)
    ) || null
  );
}

function findOverLevelBaseModelsForRow(coverageClass) {
  const getterNames = Array.isArray(coverageClass?.getterNames) ? coverageClass.getterNames : [];
  return derivedOverLevelBaseModels
    .filter((entry) => getterNames.includes(String(entry.getterName)))
    .map((entry) => ({
      fieldName: String(entry.fieldName),
      getterName: String(entry.getterName),
      derivationKind: String(entry.derivationKind),
      baseSeedModel: String(entry.baseSeedModel),
      derivedSeedBigDoubleLabel: String(entry.derivedSeedBigDoubleLabel),
      optionalMergeFloatValue: Number(entry.optionalMergeFloatValue),
      provenance: String(entry.provenance)
    }));
}

function findSampledOffsetFeeder(row, family) {
  const direct = sampledOffsetFeeders.find((entry) => Number(entry.row) === row);
  if (direct) {
    return direct;
  }
  if (!family) {
    return null;
  }
  return (
    sampledOffsetFeeders.find(
      (entry) =>
        String(entry.model) === String(family.model) &&
        Number(entry.levelOffset) === Number(family.levelOffset)
    ) || null
  );
}

function findSeededFamily(families, row) {
  return (
    families.find(
      (entry) =>
        Array.isArray(entry.rows) &&
        entry.rows.includes(row) &&
        Array.isArray(entry.integerSeeds) &&
        entry.integerSeeds.length > 0
    ) || null
  );
}

function computeSeededStageScalar(integerSeeds, level, threshold) {
  const seedTotal = integerSeeds.reduce((sum, value) => sum + Number(value || 0), 0);
  const progress = Math.min(1, Math.max(0, (level - threshold + 1) / 100));
  return 1 + (seedTotal / 100) * progress;
}

function multiplyByPow10(value, power) {
  if (!Number.isFinite(power) || power === 0) {
    return cloneBigDouble(value);
  }
  const integerPart = power >= 0 ? Math.floor(power) : Math.ceil(power);
  const fractionalPart = power - integerPart;
  const nextMantissa = value.mantissa * Math.pow(10, fractionalPart);
  return normalizeBigDouble(nextMantissa, value.exponent + integerPart);
}

function multiplyByScalar(value, scalarValue) {
  if (!Number.isFinite(scalarValue) || scalarValue <= 0) {
    return cloneBigDouble(value);
  }
  return normalizeBigDouble(value.mantissa * scalarValue, value.exponent);
}

function normalizeBigDouble(mantissa, exponent) {
  if (!Number.isFinite(mantissa) || !Number.isFinite(exponent) || mantissa === 0) {
    return {
      mantissa: 0,
      exponent: 0,
      label: "0"
    };
  }
  let nextMantissa = mantissa;
  let nextExponent = exponent;
  while (Math.abs(nextMantissa) >= 10) {
    nextMantissa /= 10;
    nextExponent += 1;
  }
  while (Math.abs(nextMantissa) > 0 && Math.abs(nextMantissa) < 1) {
    nextMantissa *= 10;
    nextExponent -= 1;
  }
  return {
    mantissa: Number(nextMantissa.toPrecision(12)),
    exponent: Math.trunc(nextExponent),
    label: `${trimTrailingZeros(Number(nextMantissa.toFixed(6)))}e${Math.trunc(nextExponent)}`
  };
}

function cloneBigDouble(value) {
  return {
    mantissa: Number(value.mantissa),
    exponent: Number(value.exponent),
    label: String(value.label)
  };
}

function trimTrailingZeros(value) {
  return String(value)
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "");
}
