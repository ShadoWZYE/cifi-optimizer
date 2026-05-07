import { TOKEN_SHOP_ROW_META } from "./token-shop-row-meta.js";

export const PROGRESSION_MODEL_VERSION = "0.1.0";
export const DEFAULT_SPEND_OBJECTIVE_ID = "objective:token-shop-short-run";

function uniqueStrings(values) {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter((value) => {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) {
      return false;
    }
    seen.add(text);
    return true;
  });
}

function groupTokenShopRowsByFamily() {
  const families = new Map();
  for (const [field, meta] of Object.entries(TOKEN_SHOP_ROW_META)) {
    const familyId = String(meta?.progressionFamily || "unknown").trim();
    if (!familyId) {
      continue;
    }
    if (!families.has(familyId)) {
      families.set(familyId, {
        familyId,
        rowFields: [],
        rowTitles: [],
        buffTargets: [],
        lanes: []
      });
    }
    const family = families.get(familyId);
    family.rowFields.push(field);
    family.rowTitles.push(String(meta?.title || field).trim());
    family.lanes.push(String(meta?.storeLane || "").trim());
    for (const target of Array.isArray(meta?.storeBuffTargets) ? meta.storeBuffTargets : []) {
      const label = String(target?.label || "").trim();
      if (label) {
        family.buffTargets.push(label);
      }
    }
  }
  return Array.from(families.values()).map((family) => ({
    ...family,
    rowFields: uniqueStrings(family.rowFields),
    rowTitles: uniqueStrings(family.rowTitles),
    buffTargets: uniqueStrings(family.buffTargets),
    lanes: uniqueStrings(family.lanes)
  }));
}

function createCarrier({
  id,
  label,
  category,
  status,
  provenance,
  systems,
  sourceRefs,
  notes = []
}) {
  return {
    id,
    label,
    category,
    status,
    provenance,
    systems: uniqueStrings(systems),
    sourceRefs: uniqueStrings(sourceRefs),
    notes: uniqueStrings(notes)
  };
}

function createTransform({
  id,
  from,
  to,
  kind,
  status,
  provenance,
  sourceRefs,
  notes = []
}) {
  return {
    id,
    from,
    to,
    kind,
    status,
    provenance,
    sourceRefs: uniqueStrings(sourceRefs),
    notes: uniqueStrings(notes)
  };
}

function tokenShopCanonicalSourceRefs(tokenShopSystemUnit) {
  const refs = [];
  if (tokenShopSystemUnit?.sections?.rows?.canonical?.sourcePath) {
    refs.push(tokenShopSystemUnit.sections.rows.canonical.sourcePath);
  }
  if (tokenShopSystemUnit?.sections?.rows?.extract?.sourcePath) {
    refs.push(tokenShopSystemUnit.sections.rows.extract.sourcePath);
  }
  if (tokenShopSystemUnit?.sections?.spendLanes?.costLanes?.sourcePath) {
    refs.push(tokenShopSystemUnit.sections.spendLanes.costLanes.sourcePath);
  }
  if (tokenShopSystemUnit?.sections?.spendLanes?.actionLaneClues?.sourcePath) {
    refs.push(tokenShopSystemUnit.sections.spendLanes.actionLaneClues.sourcePath);
  }
  if (tokenShopSystemUnit?.sections?.tokenBank?.stateClues?.sourcePath) {
    refs.push(tokenShopSystemUnit.sections.tokenBank.stateClues.sourcePath);
  }
  if (tokenShopSystemUnit?.sections?.dailyTokenium?.laneClues?.sourcePath) {
    refs.push(tokenShopSystemUnit.sections.dailyTokenium.laneClues.sourcePath);
  }
  return uniqueStrings(refs);
}

function buildTokenShopFamilyTransforms(tokenShopSystemUnit) {
  const sourceRefs = tokenShopCanonicalSourceRefs(tokenShopSystemUnit);
  const familyGroups = groupTokenShopRowsByFamily();
  const transforms = [];
  for (const family of familyGroups) {
    let targetCarrierId = "";
    let kind = "influences";
    let status = "verified";
    let provenance = "verified-extract";
    const notes = [
      `${family.rowFields.length} grounded TokenShop rows currently map into this family.`,
      `Visible row titles: ${family.rowTitles.join(", ")}.`
    ];
    switch (family.familyId) {
      case "token-chest":
        targetCarrierId = "carrier:token-chest-income";
        kind = "increases-income";
        break;
      case "diamond-chest":
        targetCarrierId = "carrier:diamond-chest-income";
        kind = "increases-income";
        break;
      case "cells-chest":
        targetCarrierId = "carrier:cells-from-chests";
        kind = "increases-income";
        break;
      case "mod-points":
        targetCarrierId = "carrier:mod-points-gain";
        kind = "increases-gain";
        break;
      case "generator-output":
        targetCarrierId = "carrier:generator-output";
        kind = "multiplies-output";
        notes.push(`Affected generator shells: ${family.buffTargets.join(", ")}.`);
        break;
      case "daily-tokenium":
        targetCarrierId = "carrier:daily-tokenium-lane";
        kind = "modifies-lane";
        status = "bounded";
        provenance = "bounded-runtime-lane";
        notes.push(
          "The lane owner, hooks, and stored wallet are grounded, but the full runtime cap/gain transform is still only partially reconstructed."
        );
        break;
      case "duo-booster":
        targetCarrierId = "carrier:mid-tier-composite-growth";
        kind = "multiplies-composite";
        status = "bounded";
        provenance = "row-effect-label";
        notes.push(`Current visible buff targets: ${family.buffTargets.join(", ")}.`);
        break;
      case "trinity-booster":
        targetCarrierId = "carrier:late-tier-composite-growth";
        kind = "multiplies-composite";
        status = "bounded";
        provenance = "row-effect-label";
        notes.push(`Current visible buff targets: ${family.buffTargets.join(", ")}.`);
        break;
      case "late-ultima":
        targetCarrierId = "carrier:max-level-and-ultima-growth";
        kind = "extends-caps-or-composite";
        status = "bounded";
        provenance = "compatibility-row-clue";
        notes.push(
          "Late shelf identity and final shell-to-title joins still carry compatibility-grade clues, so this family must stay bounded."
        );
        break;
      default:
        continue;
    }
    transforms.push(
      createTransform({
        id: `transform:token-shop-family:${family.familyId}`,
        from: `source:token-shop-family:${family.familyId}`,
        to: targetCarrierId,
        kind,
        status,
        provenance,
        sourceRefs,
        notes
      })
    );
  }
  return transforms;
}

function buildCoreCarriers(tokenShopSystemUnit, multiverseMarketSystemUnit) {
  const tokenRefs = tokenShopCanonicalSourceRefs(tokenShopSystemUnit);
  const multiverseRefs = uniqueStrings([
    multiverseMarketSystemUnit?.sections?.saveOwner?.saveBoundary?.sourcePath,
    multiverseMarketSystemUnit?.sections?.rowIdentity?.rangeBoundary?.sourcePath,
    multiverseMarketSystemUnit?.sections?.rowIdentity?.prefabRemapBoundary?.sourcePath
  ]);
  return [
    createCarrier({
      id: "carrier:token-bank-balance",
      label: "Banked Tokens",
      category: "wallet",
      status: "verified",
      provenance: "verified-extract",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Exact stored owner recovered as SaveData.BankedTokens."]
    }),
    createCarrier({
      id: "carrier:token-bank-claimable",
      label: "Claimable Bank Tokens",
      category: "wallet",
      status: "bounded",
      provenance: "controller-boundary",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Controller hooks are grounded, but the full runtime-ready state remains bounded."]
    }),
    createCarrier({
      id: "carrier:token-bank-cap",
      label: "Token Bank Cap",
      category: "cap",
      status: "bounded",
      provenance: "bounded-formula",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["The cap is derived at runtime and is not stored directly in SaveData."]
    }),
    createCarrier({
      id: "carrier:daily-tokenium-wallet",
      label: "Daily Tokenium Wallet",
      category: "wallet",
      status: "verified",
      provenance: "verified-extract",
      systems: ["token-shop", "academy"],
      sourceRefs: tokenRefs,
      notes: ["Exact stored owner recovered as SaveData.DailyTokenium."]
    }),
    createCarrier({
      id: "carrier:daily-tokenium-lane",
      label: "Daily Tokenium Lane",
      category: "income",
      status: "bounded",
      provenance: "bounded-runtime-lane",
      systems: ["token-shop", "academy", "farm-missions"],
      sourceRefs: tokenRefs,
      notes: [
        "Owner family, purchase hooks, and premium modifiers are grounded.",
        "Full cap and gain transforms are still not canonical-runtime-closed."
      ]
    }),
    createCarrier({
      id: "carrier:token-chest-income",
      label: "Tokens From Chests",
      category: "income",
      status: "verified",
      provenance: "verified-extract",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Player-facing effect labels and base row cost/bonus fields are extracted."]
    }),
    createCarrier({
      id: "carrier:diamond-chest-income",
      label: "Diamonds From Chests",
      category: "income",
      status: "verified",
      provenance: "verified-extract",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Diamond chest booster family is grounded as a direct row family."]
    }),
    createCarrier({
      id: "carrier:cells-from-chests",
      label: "Cells From Chests",
      category: "income",
      status: "bounded",
      provenance: "effect-lane-boundary",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["ATU3 remains bounded on consumer/effect-side reconstruction."]
    }),
    createCarrier({
      id: "carrier:mod-points-gain",
      label: "Mod Points Gain",
      category: "income",
      status: "verified",
      provenance: "verified-extract",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Mod point row-local bridge is grounded enough for row-level value recovery."]
    }),
    createCarrier({
      id: "carrier:generator-output",
      label: "Generator Output",
      category: "income",
      status: "verified",
      provenance: "verified-extract",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Mk1-Mk8 generator booster families are grounded row-local lanes."]
    }),
    createCarrier({
      id: "carrier:mid-tier-composite-growth",
      label: "Mid-tier Composite Growth",
      category: "composite",
      status: "bounded",
      provenance: "row-effect-label",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Duo rows affect multiple carriers at once, but a canonical shared unit is not yet defined."]
    }),
    createCarrier({
      id: "carrier:late-tier-composite-growth",
      label: "Late-tier Composite Growth",
      category: "composite",
      status: "bounded",
      provenance: "row-effect-label",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Trinity rows affect multiple later-game carriers at once, but cross-system normalization is unresolved."]
    }),
    createCarrier({
      id: "carrier:max-level-and-ultima-growth",
      label: "Max-Level And Ultima Growth",
      category: "cap",
      status: "bounded",
      provenance: "compatibility-row-clue",
      systems: ["token-shop"],
      sourceRefs: tokenRefs,
      notes: ["Late T4/T5 shelf remains partially compatibility-labeled and not ready for exact ROI."]
    }),
    createCarrier({
      id: "carrier:multiverse-market-progression",
      label: "Multiverse Market Progression",
      category: "spend-progression",
      status: "bounded",
      provenance: "compatibility-safe-raw-import",
      systems: ["multiverse-market"],
      sourceRefs: multiverseRefs,
      notes: ["Exact IS1-IS110 span is preserved, but canonical import-safe identity stays bounded."]
    })
  ];
}

function buildCoreTransforms(tokenShopSystemUnit, multiverseMarketSystemUnit) {
  const tokenRefs = tokenShopCanonicalSourceRefs(tokenShopSystemUnit);
  const multiverseRefs = uniqueStrings([
    multiverseMarketSystemUnit?.sections?.saveOwner?.traceBoundary?.sourcePath,
    multiverseMarketSystemUnit?.sections?.saveOwner?.saveBoundary?.sourcePath
  ]);
  return [
    createTransform({
      id: "transform:token-bank-wallet-to-spend",
      from: "carrier:token-bank-balance",
      to: "carrier:token-chest-income",
      kind: "funds-upgrades",
      status: "verified",
      provenance: "controller-boundary",
      sourceRefs: tokenRefs,
      notes: ["Banked Tokens are a grounded spend-side wallet for TokenShop purchases."]
    }),
    createTransform({
      id: "transform:token-bank-cap-runtime",
      from: "carrier:token-bank-cap",
      to: "carrier:token-bank-balance",
      kind: "caps-storage",
      status: "bounded",
      provenance: "bounded-formula",
      sourceRefs: tokenRefs,
      notes: ["Cap calculation is derived but not fully canonical-runtime-closed."]
    }),
    createTransform({
      id: "transform:generator-output-to-token-progression",
      from: "carrier:generator-output",
      to: "carrier:token-bank-balance",
      kind: "feeds-progression",
      status: "blocked",
      provenance: "missing-cross-system-transform",
      sourceRefs: tokenRefs,
      notes: [
        "The repo knows generator-output boosters exist, but it does not yet ground the time-based conversion from generator output into future token purchasing power."
      ]
    }),
    createTransform({
      id: "transform:daily-tokenium-wallet-to-token-shop",
      from: "carrier:daily-tokenium-wallet",
      to: "carrier:daily-tokenium-lane",
      kind: "funds-side-lane",
      status: "bounded",
      provenance: "bounded-runtime-lane",
      sourceRefs: tokenRefs,
      notes: ["Stored DailyTokenium is exact, but claim/cap/reward cadence is still only partially reconstructed."]
    }),
    createTransform({
      id: "transform:mid-tier-composite-normalization",
      from: "carrier:mid-tier-composite-growth",
      to: "carrier:token-bank-balance",
      kind: "normalizes-to-roi",
      status: "blocked",
      provenance: "missing-shared-progression-unit",
      sourceRefs: tokenRefs,
      notes: ["Duo-row effects span multiple outputs, but the shared objective unit is not defined yet."]
    }),
    createTransform({
      id: "transform:late-tier-composite-normalization",
      from: "carrier:late-tier-composite-growth",
      to: "carrier:token-bank-balance",
      kind: "normalizes-to-roi",
      status: "blocked",
      provenance: "missing-shared-progression-unit",
      sourceRefs: tokenRefs,
      notes: ["Trinity-row effects span outputs and currencies whose exchange into progression is not yet grounded."]
    }),
    createTransform({
      id: "transform:max-level-cap-to-growth",
      from: "carrier:max-level-and-ultima-growth",
      to: "carrier:generator-output",
      kind: "extends-ceiling",
      status: "blocked",
      provenance: "missing-cap-value-model",
      sourceRefs: tokenRefs,
      notes: ["Max-level increasers need a canonical cap-value model before they can participate in ROI."]
    }),
    createTransform({
      id: "transform:multiverse-market-to-shared-progress",
      from: "carrier:multiverse-market-progression",
      to: "carrier:token-bank-balance",
      kind: "cross-system-progress-link",
      status: "blocked",
      provenance: "missing-cross-system-transform",
      sourceRefs: multiverseRefs,
      notes: ["The Emporium progression block is preserved, but its shared progression weight is not canonicalized."]
    })
  ];
}

function buildObjectiveModes() {
  return [
    {
      id: "objective:token-shop-short-run",
      label: "Short-run Token Acceleration",
      status: "bounded",
      primaryCarrierIds: ["carrier:token-bank-balance", "carrier:token-chest-income"],
      carrierPriority: {
        "carrier:token-bank-balance": 1.2,
        "carrier:token-chest-income": 1.15,
        "carrier:diamond-chest-income": 0.7,
        "carrier:cells-from-chests": 0.75,
        "carrier:mod-points-gain": 0.9,
        "carrier:generator-output": 0.95,
        "carrier:daily-tokenium-lane": 0.6,
        "carrier:mid-tier-composite-growth": 0.7,
        "carrier:late-tier-composite-growth": 0.55,
        "carrier:max-level-and-ultima-growth": 0.45,
        "carrier:multiverse-market-progression": 0.25
      },
      blockedTransformIds: [
        "transform:generator-output-to-token-progression",
        "transform:mid-tier-composite-normalization",
        "transform:late-tier-composite-normalization"
      ],
      notes: [
        "This mode can compare direct token-chest rows honestly.",
        "It cannot yet normalize generator or composite rows into the same progression unit."
      ]
    },
    {
      id: "objective:generator-compounding",
      label: "Generator Compounding",
      status: "blocked",
      primaryCarrierIds: ["carrier:generator-output"],
      carrierPriority: {
        "carrier:generator-output": 1.25,
        "carrier:token-bank-balance": 0.8,
        "carrier:token-chest-income": 0.7
      },
      blockedTransformIds: ["transform:generator-output-to-token-progression"],
      notes: [
        "Generator rows are grounded, but their time-based contribution to future purchasing power is not yet canonicalized."
      ]
    },
    {
      id: "objective:daily-tokenium-side-lane",
      label: "Daily Tokenium Side Lane",
      status: "bounded",
      primaryCarrierIds: ["carrier:daily-tokenium-wallet", "carrier:daily-tokenium-lane"],
      carrierPriority: {
        "carrier:daily-tokenium-wallet": 1.1,
        "carrier:daily-tokenium-lane": 1.15,
        "carrier:token-bank-balance": 0.55
      },
      blockedTransformIds: [],
      notes: [
        "Wallet and lane clues are grounded enough for descriptive planning.",
        "Full cap and reward-cadence modeling are still bounded."
      ]
    },
    {
      id: "objective:broad-account-growth",
      label: "Broad Account Growth",
      status: "blocked",
      primaryCarrierIds: [
        "carrier:token-bank-balance",
        "carrier:generator-output",
        "carrier:mod-points-gain",
        "carrier:mid-tier-composite-growth",
        "carrier:late-tier-composite-growth",
        "carrier:max-level-and-ultima-growth",
        "carrier:multiverse-market-progression"
      ],
      carrierPriority: {
        "carrier:token-bank-balance": 1,
        "carrier:generator-output": 1,
        "carrier:mod-points-gain": 0.95,
        "carrier:mid-tier-composite-growth": 0.95,
        "carrier:late-tier-composite-growth": 0.9,
        "carrier:max-level-and-ultima-growth": 0.8,
        "carrier:multiverse-market-progression": 0.75
      },
      blockedTransformIds: [
        "transform:generator-output-to-token-progression",
        "transform:mid-tier-composite-normalization",
        "transform:late-tier-composite-normalization",
        "transform:max-level-cap-to-growth",
        "transform:multiverse-market-to-shared-progress"
      ],
      notes: [
        "The repo is still missing a shared progression unit that can compare currencies, output multipliers, cap extensions, and market progression honestly."
      ]
    }
  ];
}

export function buildSpendProgressionModel({
  tokenShopSystemUnit,
  multiverseMarketSystemUnit
}) {
  const carriers = buildCoreCarriers(tokenShopSystemUnit, multiverseMarketSystemUnit);
  const transforms = [
    ...buildTokenShopFamilyTransforms(tokenShopSystemUnit),
    ...buildCoreTransforms(tokenShopSystemUnit, multiverseMarketSystemUnit)
  ];
  const objectiveModes = buildObjectiveModes();
  const unresolvedQuestions = [
    "How does generator output convert into future Token purchasing power over time?",
    "How should multi-output rows (Duo, Trinity, Ultima, max-level increasers) normalize into one progression unit?",
    "Which cross-system quantities actually define account-wide progress: Tokens, generator output, MP, RP, AP, Shards, Daily Tokenium, or another shared unit?",
    "How should bounded multiverse-market progression participate in a shared progression objective?"
  ];
  const blockedTransformCount = transforms.filter((item) => item.status === "blocked").length;
  return {
    version: PROGRESSION_MODEL_VERSION,
    readiness: {
      hasCanonicalCarrierGraph: carriers.length > 0,
      hasGroundedObjectiveModes: objectiveModes.length > 0,
      trueRoiReady: blockedTransformCount === 0,
      blockedTransformCount,
      unresolvedQuestionCount: unresolvedQuestions.length
    },
    carriers,
    transforms,
    objectiveModes,
    unresolvedQuestions
  };
}

function getProgressionStatusScale(status) {
  switch (String(status || "").trim()) {
    case "verified":
      return 1;
    case "bounded":
      return 0.75;
    case "blocked":
      return 0.2;
    default:
      return 0.6;
  }
}

export function getSpendObjectiveMode(progressionModel, objectiveId = DEFAULT_SPEND_OBJECTIVE_ID) {
  const objectiveModes = Array.isArray(progressionModel?.objectiveModes)
    ? progressionModel.objectiveModes
    : [];
  return (
    objectiveModes.find((mode) => mode?.id === objectiveId) ||
    objectiveModes.find((mode) => mode?.id === DEFAULT_SPEND_OBJECTIVE_ID) ||
    null
  );
}

export function getTokenShopFamilyProgressionLens(
  progressionModel,
  objectiveId = DEFAULT_SPEND_OBJECTIVE_ID
) {
  const transforms = Array.isArray(progressionModel?.transforms) ? progressionModel.transforms : [];
  const carriers = Array.isArray(progressionModel?.carriers) ? progressionModel.carriers : [];
  const objective = getSpendObjectiveMode(progressionModel, objectiveId);
  const carrierById = new Map(carriers.map((carrier) => [carrier.id, carrier]));
  const blockedTransformIds = new Set(objective?.blockedTransformIds || []);
  const carrierPriority = objective?.carrierPriority || {};
  const lens = new Map();

  for (const transform of transforms) {
    const sourceMatch = /^source:token-shop-family:(.+)$/.exec(String(transform?.from || ""));
    if (!sourceMatch) {
      continue;
    }
    const familyId = sourceMatch[1];
    const carrier = carrierById.get(transform.to) || null;
    const transformScale = getProgressionStatusScale(transform?.status);
    const carrierScale = getProgressionStatusScale(carrier?.status);
    const objectiveScale = getProgressionStatusScale(objective?.status);
    const blockedPenalty = blockedTransformIds.has(transform.id) ? 0.5 : 1;
    const priority =
      typeof carrierPriority[transform.to] === "number"
        ? carrierPriority[transform.to]
        : Array.isArray(objective?.primaryCarrierIds) && objective.primaryCarrierIds.includes(transform.to)
          ? 1.05
          : 0.9;
    const scoreMultiplier = priority * transformScale * carrierScale * objectiveScale * blockedPenalty;
    lens.set(familyId, {
      familyId,
      carrierId: transform.to,
      carrierLabel: carrier?.label || transform.to,
      transformStatus: transform?.status || "unknown",
      carrierStatus: carrier?.status || "unknown",
      objectiveId: objective?.id || DEFAULT_SPEND_OBJECTIVE_ID,
      objectiveLabel: objective?.label || "Short-run Token Acceleration",
      objectiveStatus: objective?.status || "bounded",
      scoreMultiplier,
      confidenceLabel:
        transform?.status === "verified" && carrier?.status === "verified"
          ? "Grounded"
          : transform?.status === "blocked" || carrier?.status === "blocked"
            ? "Blocked"
            : "Bounded",
      notes: uniqueStrings([
        ...(Array.isArray(transform?.notes) ? transform.notes : []),
        ...(Array.isArray(carrier?.notes) ? carrier.notes : []),
        ...(Array.isArray(objective?.notes) ? objective.notes : [])
      ])
    });
  }

  return lens;
}
