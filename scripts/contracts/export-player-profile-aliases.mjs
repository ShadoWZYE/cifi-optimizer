import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PLAYER_PROFILE_IMPORT_ALIASES } from "../../player-profile.js";

const GROUP_METADATA = {
  meta: {
    title: "Metadata",
    classification: "metadata",
    purpose: "Shared profile metadata accepted by the normalizer."
  },
  canonical: {
    title: "Canonical Shared Truth",
    classification: "canonical",
    purpose: "Grounded MVP profile inputs that belong in shared PlayerProfile truth."
  },
  planner: {
    title: "Planner-only Helpers",
    classification: "planner",
    purpose: "Descriptive helper inputs that stay outside canonical account truth."
  },
  externalModel: {
    title: "External-model Implementation State",
    classification: "external-model",
    purpose: "Canonical-system implementation state kept separate from shared truth."
  },
  experimental: {
    title: "Experimental Support Helpers",
    classification: "experimental",
    purpose: "Non-MVP support-surface helpers preserved as labeled imports only."
  },
  compatibility: {
    title: "Compatibility-only Migration Sinks",
    classification: "compatibility",
    purpose: "Legacy or unmapped values preserved for migration safety only."
  },
  shipCalibration: {
    title: "Ship Calibration Preservation",
    classification: "external-model",
    purpose: "Community-tool ship payloads preserved alongside the ship implementation surface."
  }
};

const TARGET_PATHS = {
  meta: {
    profileName: "meta.profileName",
    updatedAt: "meta.updatedAt",
    dataConfidence: "meta.dataConfidence"
  },
  canonical: {
    loopReset: "player.loop.loopReset",
    diamonds: "player.resources.diamonds",
    tokens: "player.resources.tokens",
    academyRelics: "player.resources.academyRelics",
    shards: "player.resources.shards",
    notes: "notes.profile"
  },
  planner: {
    shardRatePerHour: "planning.shards.ratePerHour",
    totalShardMilestoneLevels: "planning.shards.totalMilestoneLevels",
    shardFocusMilestoneId: "planning.shards.focusMilestoneId",
    shardFocusMilestoneLevel: "planning.shards.focusMilestoneLevel"
  },
  externalModel: {
    shipPower: "externalModels.shipPlanner.summary.power",
    shipSpeed: "externalModels.shipPlanner.summary.speed",
    shipCargo: "externalModels.shipPlanner.summary.cargo"
  },
  experimental: {
    gemNodeBudget: "externalModels.experimental.gemNodes.budget",
    primaryFarmingFocus: "externalModels.experimental.profileHints.primaryFarmingFocus",
    researchHours: "externalModels.experimental.profileHints.researchHours"
  },
  compatibility: {
    highestShipUnlocked: "compatibility.legacyStage.highestShipUnlocked",
    manualPhase: "compatibility.legacyStage.manualPhase",
    gemDust: "compatibility.unresolvedProfileFields.gemDust",
    hunterLevel: "compatibility.unresolvedProfileFields.hunterLevel",
    traitSphereCount: "compatibility.unresolvedProfileFields.traitSphereCount",
    mechParts: "compatibility.unresolvedProfileFields.mechParts",
    shardMilestones: "compatibility.unmappedSystemState.shardMilestones",
    tokenShop: "compatibility.unmappedSystemState.tokenShop",
    multiverseMarket: "compatibility.unmappedSystemState.multiverseMarket",
    tokenShopStateClues: "compatibility.unmappedSystemState.tokenShop",
    multiverseMarketStateClues: "compatibility.unmappedSystemState.multiverseMarket"
  },
  shipCalibration: {
    communityToolState: "externalModels.shipPlanner.communityToolState",
    legacyShipPlayerState: "externalModels.shipPlanner.communityToolState"
  }
};

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const groups = Object.entries(PLAYER_PROFILE_IMPORT_ALIASES).map(([groupId, aliases]) => ({
  id: groupId,
  title: GROUP_METADATA[groupId]?.title || groupId,
  classification: GROUP_METADATA[groupId]?.classification || "unknown",
  purpose: GROUP_METADATA[groupId]?.purpose || "",
  aliases: Object.entries(aliases).map(([field, paths]) => ({
    field,
    targetPath: TARGET_PATHS[groupId]?.[field] || "",
    acceptedPaths: paths.map((path) => path.join("."))
  })),
  acceptedPathCount: Object.values(aliases).reduce((count, paths) => count + paths.length, 0)
}));

const payload = {
  version: "v1",
  generatedFrom: "player-profile.js",
  groupCount: groups.length,
  aliasCount: groups.reduce((count, group) => count + group.aliases.length, 0),
  acceptedPathCount: groups.reduce((count, group) => count + group.acceptedPathCount, 0),
  groups
};

const markdown = [
  "# PlayerProfile Import Aliases",
  "",
  "This document is generated from `PLAYER_PROFILE_IMPORT_ALIASES` in `player-profile.js`.",
  "",
  ...groups.flatMap((group) => [
    `## ${group.title}`,
    "",
    `Classification: \`${group.classification}\``,
    "",
    group.purpose,
    "",
    `Accepted alias paths: ${group.acceptedPathCount}`,
    "",
    "| Field | Target path | Accepted aliases |",
    "|---|---|---|",
    ...group.aliases.map((alias) => `| \`${alias.field}\` | \`${alias.targetPath}\` | ${alias.acceptedPaths.map((path) => `\`${path}\``).join(", ")} |`),
    ""
  ])
].join("\n");

await writeFile(new URL("../../data/player-profile-import-aliases.v1.json", import.meta.url), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(new URL("../../docs/contracts/player-profile-import-aliases.md", import.meta.url), `${markdown}\n`, "utf8");

console.log(`PlayerProfile alias audit written under ${repoRoot}`);

