import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  createGeneratorOcrStageError,
  createMissingGeneratorOcrScriptError,
  resolveGeneratorOcrScriptPath
} from "../scripts/ocr/generator-ocr-support.mjs";

test("resolveGeneratorOcrScriptPath prefers the current scripts/ocr location", async () => {
  const root = await mkdtemp(join(tmpdir(), "cifi-ocr-path-"));
  await mkdir(join(root, "scripts", "ocr"), { recursive: true });
  await writeFile(join(root, "scripts", "ocr", "generator-ocr.ps1"), "Write-Output '{}'");

  const resolution = resolveGeneratorOcrScriptPath(root);
  assert.equal(resolution.resolvedPath, join(root, "scripts", "ocr", "generator-ocr.ps1"));
  assert.deepEqual(resolution.checkedPaths, [
    join(root, "scripts", "ocr", "generator-ocr.ps1"),
    join(root, "scripts", "generator-ocr.ps1")
  ]);
});

test("resolveGeneratorOcrScriptPath falls back to the legacy location", async () => {
  const root = await mkdtemp(join(tmpdir(), "cifi-ocr-path-legacy-"));
  await mkdir(join(root, "scripts"), { recursive: true });
  await writeFile(join(root, "scripts", "generator-ocr.ps1"), "Write-Output '{}'");

  const resolution = resolveGeneratorOcrScriptPath(root);
  assert.equal(resolution.resolvedPath, join(root, "scripts", "generator-ocr.ps1"));
});

test("createMissingGeneratorOcrScriptError names every checked path", () => {
  const payload = createMissingGeneratorOcrScriptError("C:\\repo");
  assert.equal(payload.stage, "powershell");
  assert.match(payload.error, /scripts[\\/]+ocr[\\/]+generator-ocr\.ps1/);
  assert.match(payload.error, /scripts[\\/]+generator-ocr\.ps1/);
  assert.ok(payload.hints.some((hint) => hint.includes("PowerShell")));
});

test("createGeneratorOcrStageError classifies python and tesseract hints", () => {
  const payload = createGeneratorOcrStageError("python", new Error("No module named cv2"), {
    stderr: "pytesseract could not find tesseract.exe"
  });

  assert.equal(payload.stage, "python");
  assert.ok(payload.hints.some((hint) => hint.includes("Python")));
  assert.ok(payload.hints.some((hint) => hint.includes("opencv-python")));
  assert.ok(payload.hints.some((hint) => hint.includes("Tesseract")));
  assert.match(payload.stderr, /tesseract\.exe/i);
});
