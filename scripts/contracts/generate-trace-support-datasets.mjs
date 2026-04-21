import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(repoRoot, relativePath), "utf8"));
}

async function writeJson(relativePath, value) {
  const outputPath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function pickPresentationBinding(traceData) {
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
  const descriptionPath =
    renderPaths.find((entry) => entry?.renderRole === "description") ?? {};

  return {
    interactionShell: presentationPath.interactionNodes?.[0]?.name ?? null,
    costShell: presentationPath.recursiveAnchors?.find((entry) => entry?.role === "cost")?.name ?? null,
    costRenderNode: costPath.renderNode ?? null,
    descriptionRenderNode: descriptionPath.renderNode ?? null
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
  const uiBinding = pickPresentationBinding(traceData);

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
      "The token, diamond, and Daily Tokenium spend families are now regenerated from the token-shop-family-structure trace materialization plus the grounded TokenShop numeric table instead of a standalone probe JSON.",
      "This materialized view keeps TokenBoost, DiamondBoost, and TokenDailies on separate spend lanes while preserving the shared TokenShop UI render path through UPGButton, CostBox, CostText, and DescText.",
      "The remaining unresolved gap is runtime-side pricing modifiers or evaluator transforms beyond the recovered base controller lane."
    ]
  };
}

async function main() {
  const traceUnit = await readJson("data/system-units/trace.v1.json");
  const tokenShopValues = await readJson("data/token-shop-values.json");
  const traceData = traceUnit.sections?.liveRuns?.tokenShopFamilyStructure?.data ?? {};

  const tokenShopTraceSupport = {
    dataset: "token-shop-trace-support.v1",
    generatedAt: "2026-04-20",
    source: {
      traceScope: "token-shop-family-structure",
      traceBundle: "data/system-units/trace.v1.json",
      tokenShopValues: "data/token-shop-values.json",
      regenerationCommand:
        "python scripts\\unity\\unity_trace_bundle.py --family token-shop --level structured"
    },
    purpose:
      "Trace-produced support core for TokenShop lane semantics that are now reproducible from the DB-first semantic materialization path. This replaces the old standalone cost-lane probe dataset while leaving save-owner and action-shell evidence on their narrower canonical support paths until trace coverage closes those gaps.",
    spendLanes: {
      costLanes: buildTokenShopCostLaneSupport(tokenShopValues, traceData)
    },
    replaceabilityReview: [
      {
        path: "data/token-shop-cost-lanes.json",
        status: "replaced-by-trace-support",
        reason:
          "The token, diamond, and Daily Tokenium cost-lane split is reproducible from token-shop-family-structure plus the grounded TokenShop numeric table."
      },
      {
        path: "data/spend-action-lane-clues.json",
        status: "partially-regenerable-gap-open",
        reason:
          "The committed trace bundle still does not preserve the full BuyDiamondBoost, BuyLM244, BuyCollectorDevice, and hold-hook cluster, so this remains separate support data for now."
      },
      {
        path: "data/token-shop-owner-shell.json",
        status: "partially-regenerable-gap-open",
        reason:
          "The committed trace bundle preserves only part of the wider TokenShop owner shell; the broader notification and adjacent-device hook cluster is not fully materialized yet."
      },
      {
        path: "data/token-bank-controller-shell.json",
        status: "partially-regenerable-gap-open",
        reason:
          "The committed trace bundle does not yet preserve the full ClaimBankedTokens and SetBankFill controller shell as one materialized surface."
      }
    ]
  };

  await writeJson("data/token-shop-trace-support.v1.json", tokenShopTraceSupport);
  console.log("Generated trace support datasets:");
  console.log("- data/token-shop-trace-support.v1.json");
}

await main();
