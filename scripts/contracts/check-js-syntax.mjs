import { relative } from "node:path";
import { cwd } from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = cwd();
const ignoredPrefixes = [
  ".appdata/",
  ".deps/",
  ".dotnet/",
  ".local/",
  ".nuget/",
  ".vendor_py/",
  ".wheelhouse/",
  "_worktrees/",
  "tools/",
  "workbench/"
];

const files = await collectTrackedFirstPartyJsFiles(root);
const failures = [];

for (const file of files) {
  try {
    await execFileAsync(process.execPath, ["--check", file], { cwd: root });
  } catch (error) {
    failures.push({
      file: relative(root, file),
      stderr: String(error.stderr || error.stdout || error.message || "").trim()
    });
  }
}

if (failures.length) {
  console.error("JavaScript syntax check failed:");
  for (const failure of failures) {
    console.error(`- ${failure.file}`);
    if (failure.stderr) {
      console.error(`  ${failure.stderr.replace(/\r?\n/g, "\n  ")}`);
    }
  }
  process.exit(1);
}

console.log(`Syntax OK for ${files.length} first-party JS/MJS files.`);

async function collectTrackedFirstPartyJsFiles(directory) {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.js", "*.mjs"], { cwd: directory });
  return stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !ignoredPrefixes.some((prefix) => file.startsWith(prefix)))
    .map((file) => `${directory}/${file.replace(/\\/g, "/")}`)
    .sort();
}
