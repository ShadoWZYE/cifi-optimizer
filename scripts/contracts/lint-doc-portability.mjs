import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ABSOLUTE_PATH_PATTERNS = [
  { label: "C:\\", regex: /C:\\/g },
  { label: "D:\\", regex: /D:\\/g },
  { label: "/Users/", regex: /\/Users\//g },
  { label: "/home/", regex: /\/home\//g }
];

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export async function lintDocPortability(rootDir = repoRoot) {
  const docsRoot = path.join(rootDir, "docs");
  const markdownFiles = await collectMarkdownFiles(docsRoot);
  const issues = [];

  for (const filePath of markdownFiles) {
    const source = await readFile(filePath, "utf8");

    for (const pattern of ABSOLUTE_PATH_PATTERNS) {
      if (pattern.regex.test(source)) {
        issues.push({
          filePath: path.relative(rootDir, filePath).split(path.sep).join("/"),
          pattern: pattern.label
        });
      }
      pattern.regex.lastIndex = 0;
    }
  }

  return issues;
}

async function collectMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectMarkdownFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const issues = await lintDocPortability();

  if (issues.length > 0) {
    console.error("Docs portability lint failed. Absolute machine paths found:");
    for (const issue of issues) {
      console.error(`- ${issue.filePath}: matched ${issue.pattern}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Docs portability lint passed.");
  }
}
