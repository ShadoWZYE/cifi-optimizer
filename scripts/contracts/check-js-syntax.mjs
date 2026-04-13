import { readdir, readFile } from "node:fs/promises";
import path, { relative } from "node:path";
import { cwd } from "node:process";
import { Linter } from "eslint";

const root = cwd();
const ignoredDirectories = new Set([
  ".appdata",
  ".deps",
  ".dotnet",
  ".git",
  ".local",
  ".nuget",
  ".vendor_manual",
  ".vendor_py",
  ".wheelhouse",
  "_worktrees",
  "data",
  "node_modules",
  "tools",
  "workbench"
]);
const includedRootFiles = new Set([
  "app.js",
  "player-profile.js",
  "recommendation-contract.js",
]);
const includedRootDirectories = new Set(["scripts", "support", "tests"]);
const syntaxLinter = new Linter();

const files = await collectFirstPartyJsFiles(root);
const failures = [];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const messages = syntaxLinter.verify(
    source,
    {
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      },
      rules: {}
    },
    file
  );
  const parseFailures = messages.filter((message) => message.fatal);
  if (parseFailures.length) {
    failures.push({
      file: relative(root, file),
      stderr: parseFailures
        .map((message) => `${message.message} (${message.line ?? 0}:${message.column ?? 0})`)
        .join("\n")
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

async function collectFirstPartyJsFiles(directory) {
  const files = [];
  await walkDirectory(directory, "", files);
  return files.sort();
}

async function walkDirectory(currentDirectory, relativeDirectory, files) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentDirectory, entry.name);
    const entryRelativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name, relativeDirectory)) {
        continue;
      }
      await walkDirectory(entryPath, entryRelativePath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!isIncludedFile(entryRelativePath)) {
      continue;
    }

    files.push(entryPath);
  }
}

function shouldSkipDirectory(directoryName, relativeDirectory) {
  if (!relativeDirectory && ignoredDirectories.has(directoryName)) {
    return true;
  }

  if (!relativeDirectory) {
    return !includedRootDirectories.has(directoryName);
  }

  return false;
}

function isIncludedFile(relativePath) {
  if (!relativePath.endsWith(".js") && !relativePath.endsWith(".mjs")) {
    return false;
  }

  if (!relativePath.includes("/")) {
    return includedRootFiles.has(relativePath);
  }

  return relativePath.startsWith("scripts/") || relativePath.startsWith("tests/");
}
