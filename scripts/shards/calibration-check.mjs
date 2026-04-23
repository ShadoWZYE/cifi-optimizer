import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { evaluateShardCost, getShardCostFormulaModel } from "./cost-evaluator.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = path.join(repoRoot, "workbench", "ghidra-cache", "ghidra_cache.sqlite3");

function loadShardCostScreenshotCalibration() {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout=30000");
  try {
    const materializedRow = db
      .prepare(
        `
          SELECT payload_json
          FROM materialized_system_unit_views
          WHERE system_id = ? AND version = ?
        `
      )
      .get("shard-cost-screenshot-calibration", "v1");
    if (materializedRow?.payload_json) {
      const payload = JSON.parse(materializedRow.payload_json);
      if (payload?.dataset === "shard-cost-screenshot-calibration.v1") {
        return payload;
      }
    }

    const shardUnitRow = db
      .prepare(
        `
          SELECT payload_json
          FROM materialized_system_unit_views
          WHERE system_id = ? AND version = ?
        `
      )
      .get("shards", "v1");
    if (shardUnitRow?.payload_json) {
      const shardUnit = JSON.parse(shardUnitRow.payload_json);
      const payload = shardUnit?.sections?.cost?.screenshotCalibration?.data ?? null;
      if (payload?.dataset === "shard-cost-screenshot-calibration.v1") {
        return payload;
      }
    }
  } finally {
    db.close();
  }

  throw new Error(
    'Missing DB-backed shard screenshot calibration. Run "node scripts/contracts/generate-system-units.mjs" first.'
  );
}

let screenshotCalibration = null;

export function getShardCostScreenshotCalibration() {
  if (!screenshotCalibration) {
    screenshotCalibration = loadShardCostScreenshotCalibration();
  }
  return screenshotCalibration;
}

export function formatScientificLabel(
  value,
  decimals = getShardCostFormulaModel().calibrationCheckConfig.scientificLabelMantissaDecimals
) {
  const mantissa = Number(value?.mantissa);
  const exponent = Number(value?.exponent);
  assert.ok(Number.isFinite(mantissa), "scientific label mantissa must be finite");
  assert.ok(Number.isFinite(exponent), "scientific label exponent must be finite");
  return `${mantissa.toFixed(decimals)}e${Math.trunc(exponent)}`;
}

export function parseScientificLabel(label) {
  const match = String(label || "").match(/^([+-]?\d+(?:\.\d+)?)e([+-]?\d+)$/u);
  assert.ok(match, `invalid scientific label: ${label}`);
  return {
    mantissa: Number(match[1]),
    exponent: Number(match[2])
  };
}

export function compareScientificLabels(
  expectedLabel,
  actualValue,
  config = getShardCostFormulaModel().calibrationCheckConfig
) {
  const expected = parseScientificLabel(expectedLabel);
  const actual = parseScientificLabel(
    formatScientificLabel(actualValue, config.scientificLabelMantissaDecimals)
  );
  const exponentDelta = actual.exponent - expected.exponent;
  const mantissaDelta = actual.mantissa - expected.mantissa;
  const mantissaAbsoluteDelta = Math.abs(mantissaDelta);
  const mantissaRelativeDelta =
    expected.mantissa === 0
      ? mantissaAbsoluteDelta
      : mantissaAbsoluteDelta / Math.abs(expected.mantissa);
  const passed =
    Math.abs(exponentDelta) <= Number(config.requiredExponentDelta) &&
    mantissaAbsoluteDelta <= Number(config.mantissaAbsoluteTolerance) &&
    mantissaRelativeDelta <= Number(config.mantissaRelativeTolerance);
  return {
    expected,
    actual,
    expectedLabel,
    actualLabel: formatScientificLabel(actualValue, config.scientificLabelMantissaDecimals),
    exponentDelta,
    mantissaDelta,
    mantissaAbsoluteDelta,
    mantissaRelativeDelta,
    passed
  };
}

export function runShardCostCalibrationChecks() {
  const formulaModel = getShardCostFormulaModel();
  const config = formulaModel.calibrationCheckConfig;
  const calibration = getShardCostScreenshotCalibration();
  const entries = Array.isArray(calibration.entries) ? calibration.entries : [];
  const results = entries.map((entry) => {
    const evaluation = evaluateShardCost({
      row: Number(entry.row),
      level: Number(entry.observedLevel)
    });
    const comparison = compareScientificLabels(
      entry.observedCostLabel,
      evaluation.normalizedCost,
      config
    );
    return {
      row: Number(entry.row),
      level: Number(entry.observedLevel),
      title: String(entry.title),
      expectedLabel: String(entry.observedCostLabel),
      actualLabel: comparison.actualLabel,
      passed: comparison.passed,
      exponentDelta: comparison.exponentDelta,
      mantissaAbsoluteDelta: comparison.mantissaAbsoluteDelta,
      mantissaRelativeDelta: comparison.mantissaRelativeDelta,
      evaluation
    };
  });
  return {
    config: { ...config },
    automatedCalibrationImplemented:
      formulaModel.completionFlags.automatedCalibrationImplemented === true,
    results,
    allPassed: results.every((entry) => entry.passed),
    failureCount: results.filter((entry) => !entry.passed).length
  };
}
