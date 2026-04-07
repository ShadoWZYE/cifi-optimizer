import { existsSync } from "node:fs";
import { join } from "node:path";

const GENERATOR_OCR_SCRIPT_CANDIDATES = [
  ["scripts", "ocr", "generator-ocr.ps1"],
  ["scripts", "generator-ocr.ps1"]
];

function buildStageError(stage, error, details = {}) {
  const message = error instanceof Error ? error.message : String(error);
  const stdout = clipOutput(details.stdout);
  const stderr = clipOutput(details.stderr);
  return {
    error: message,
    stage,
    stdout,
    stderr,
    hints: getGeneratorOcrHints(stage, `${message}\n${stdout}\n${stderr}`)
  };
}

export function resolveGeneratorOcrScriptPath(root) {
  const checkedPaths = GENERATOR_OCR_SCRIPT_CANDIDATES.map((segments) => join(root, ...segments));
  const resolvedPath = checkedPaths.find((candidatePath) => existsSync(candidatePath)) || null;
  return {
    resolvedPath,
    checkedPaths
  };
}

export function createMissingGeneratorOcrScriptError(root) {
  const resolution = resolveGeneratorOcrScriptPath(root);
  return buildStageError(
    "powershell",
    new Error(`Generator OCR script not found. Checked: ${resolution.checkedPaths.join(", ")}`),
    resolution
  );
}

export function createGeneratorOcrStageError(stage, error, details = {}) {
  return buildStageError(stage, error, details);
}

function clipOutput(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const collapsed = text.replace(/\s+/g, " ");
  return collapsed.length > 280 ? `${collapsed.slice(0, 277)}...` : collapsed;
}

function getGeneratorOcrHints(stage, combinedText) {
  const text = String(combinedText || "").toLowerCase();
  const hints = new Set();

  if (stage === "powershell") {
    hints.add("Ensure PowerShell is available on PATH and the OCR script exists under scripts/ocr.");
  }

  if (
    text.includes("python")
    || text.includes("pytesseract")
    || text.includes("cv2")
    || text.includes("numpy")
    || stage === "python"
  ) {
    hints.add("Ensure Python is installed and available on PATH for optional OCR tooling.");
    hints.add("Install the OCR Python packages required by scripts/ocr/generator-ocr.py: opencv-python, pytesseract, and numpy.");
  }

  if (text.includes("tesseract")) {
    hints.add("Install Tesseract OCR and ensure the executable path used by scripts/ocr/generator-ocr.py is valid on this machine.");
  }

  if (hints.size === 0) {
    hints.add("OCR tooling is optional. Core MVP usage should still work without configuring OCR.");
  }

  return [...hints];
}
