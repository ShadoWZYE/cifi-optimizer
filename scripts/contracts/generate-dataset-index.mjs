import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const contractPath = path.join(repoRoot, "data", "bundled-dataset-contract.v1.json");
const outputPath = path.join(repoRoot, "docs", "contracts", "dataset-index.generated.md");

export async function generateDatasetIndex(rootDir = repoRoot) {
  const resolvedContractPath = path.join(rootDir, "data", "bundled-dataset-contract.v1.json");
  const resolvedOutputPath = path.join(rootDir, "docs", "contracts", "dataset-index.generated.md");
  const contract = JSON.parse(await readFile(resolvedContractPath, "utf8"));
  const markdown = renderDatasetIndex(contract);

  await writeFile(resolvedOutputPath, markdown, "utf8");
  return markdown;
}

export function renderDatasetIndex(contract) {
  const lines = [
    "# Dataset Index",
    "",
    "> Generated from `data/bundled-dataset-contract.v1.json`. Do not edit by hand.",
    "",
    `Contract version: \`${contract.contractVersion}\``,
    `Updated at: \`${contract.updatedAt}\``,
    `Validation command: \`${contract.validationCommand}\``,
    "",
    "## Source priority",
    ""
  ];

  for (const source of contract.sourcePriority) {
    lines.push(`${source.rank}. \`${source.id}\` - ${source.label}`);
    lines.push(`   ${source.description}`);
  }

  lines.push("", "## Datasets", "");

  for (const dataset of contract.datasets) {
    lines.push(`### \`${dataset.id}\``);
    lines.push("");
    lines.push(`- Label: ${dataset.label}`);
    lines.push(`- Classification: \`${dataset.classification}\``);
    lines.push("- Files:");
    for (const file of dataset.files) {
      lines.push(`  - \`${file}\``);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateDatasetIndex();
  console.log(`Wrote ${path.relative(repoRoot, outputPath).split(path.sep).join("/")}`);
}
