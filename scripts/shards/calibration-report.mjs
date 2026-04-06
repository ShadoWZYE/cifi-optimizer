import { getShardCostFormulaModel, getShardCostRowClass } from "./cost-evaluator.mjs";
import { runShardCostCalibrationChecks } from "./calibration-check.mjs";

function formatStageList(values) {
  return Array.isArray(values) && values.length > 0 ? values.join(", ") : "none";
}

function formatPassFail(value) {
  return value ? "PASS" : "FAIL";
}

function buildReport() {
  const formulaModel = getShardCostFormulaModel();
  const calibration = runShardCostCalibrationChecks();
  const lines = [
    "Shard Cost Calibration Report",
    `Dataset: ${formulaModel.dataset}`,
    `Generated at: ${formulaModel.generatedAt}`,
    `Automated calibration implemented: ${calibration.automatedCalibrationImplemented ? "yes" : "no"}`,
    `Anchors checked: ${calibration.results.length}`,
    `Failures: ${calibration.failureCount}`,
    ""
  ];

  for (const result of calibration.results) {
    const rowClass = getShardCostRowClass(result.row);
    lines.push(`Row ${result.row} | Level ${result.level} | ${formatPassFail(result.passed)}`);
    lines.push(`  Title: ${result.title}`);
    lines.push(`  Expected: ${result.expectedLabel}`);
    lines.push(`  Actual: ${result.actualLabel}`);
    lines.push(`  Row class: ${rowClass?.id ?? "unknown"} (${rowClass?.nativeFormulaClass ?? "unknown"})`);
    lines.push(`  Stage coverage: ${formatStageList(result.evaluation.stageCoverage)}`);
    lines.push(`  Active stages: ${formatStageList(result.evaluation.activeStages)}`);
    lines.push(`  Runtime getter: ${result.evaluation.runtimeRule.getterName}`);
    lines.push(`  Window order: ${formatStageList(result.evaluation.runtimeRule.windowOrder)}`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  process.stdout.write(buildReport());
}
