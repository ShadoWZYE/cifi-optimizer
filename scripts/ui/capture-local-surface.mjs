import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const STORAGE_MARKERS = [
  "cifi-suite.player-profile",
  "cifi-suite.snapshot",
  "cifi-suite.route"
];
const STATE_CACHE_PATH = path.resolve("workbench", "capture-local-surface-state-cache.json");

const BROWSER_TARGETS = [
  {
    id: "chrome",
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    userDataDir: path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "User Data")
  },
  {
    id: "edge-x86",
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    userDataDir: path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "User Data")
  },
  {
    id: "edge",
    executablePath: "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    userDataDir: path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "User Data")
  }
];

function getArg(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function resolveBrowserTarget() {
  const explicit = getArg("--browser");
  if (explicit) {
    const matched = BROWSER_TARGETS.find((target) => target.executablePath === explicit);
    return matched
      ? matched
      : {
          id: "custom",
          executablePath: explicit,
          userDataDir: getArg("--user-data-dir")
        };
  }
  return BROWSER_TARGETS.find(
    (candidate) => candidate.executablePath && existsSync(candidate.executablePath)
  );
}

function getSubsystemTabName(subsystem) {
  if (!subsystem) {
    return null;
  }
  const normalized = String(subsystem).trim().toLowerCase();
  if (normalized === "tokenshop" || normalized === "token-shop") {
    return /TokenShop/i;
  }
  if (normalized === "shards" || normalized === "shard-mining") {
    return /Shard Mining/i;
  }
  if (normalized === "loop" || normalized === "loop-prestige") {
    return /Loop Prestige/i;
  }
  return new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function isLikelyProfileDirectory(name) {
  return name === "Default" || /^Profile \d+$/i.test(name);
}

async function pathExists(targetPath) {
  try {
    await readdir(targetPath);
    return true;
  } catch {
    return existsSync(targetPath);
  }
}

async function fetchServerBackedLocalStorageEntries(baseUrl) {
  try {
    const origin = new URL(baseUrl).origin;
    const profileResponse = await fetch(`${origin}/api/player-profile`, { cache: "no-store" }).catch(
      () => null
    );
    const entries = {};
    if (profileResponse?.ok) {
      const payload = await profileResponse.json();
      if (payload?.profile && typeof payload.profile === "object") {
        entries["cifi-suite.player-profile"] = JSON.stringify(payload.profile);
      }
    }
    return entries;
  } catch {
    return {};
  }
}

async function seedServerBackedPlayerProfileIfMissing(baseUrl, entries) {
  const rawProfile = entries?.["cifi-suite.player-profile"];
  if (!rawProfile) {
    return false;
  }
  try {
    const origin = new URL(baseUrl).origin;
    const existingResponse = await fetch(`${origin}/api/player-profile`, {
      cache: "no-store"
    }).catch(() => null);
    if (existingResponse?.ok) {
      return false;
    }
    if (existingResponse && existingResponse.status !== 404) {
      return false;
    }
    const profile = JSON.parse(rawProfile);
    const upsertResponse = await fetch(`${origin}/api/player-profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceLabel: "capture-browser-fallback",
        profile
      })
    }).catch(() => null);
    return upsertResponse?.ok === true;
  } catch {
    return false;
  }
}

async function listProfileDirectories(userDataDir) {
  if (!userDataDir || !(await pathExists(userDataDir))) {
    return [];
  }
  const entries = await readdir(userDataDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && isLikelyProfileDirectory(entry.name))
    .map((entry) => entry.name);
}

async function fileContainsMarker(filePath, markers) {
  try {
    const bytes = await readFile(filePath);
    const content = bytes.toString("latin1");
    return markers.some((marker) => content.includes(marker));
  } catch {
    return false;
  }
}

function findJsonTokenEnd(content, startIndex) {
  const opener = content[startIndex];
  if (!opener) {
    return -1;
  }
  if (opener === "\"") {
    let escaped = false;
    for (let index = startIndex + 1; index < content.length; index += 1) {
      const char = content[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        return index + 1;
      }
    }
    return -1;
  }
  if (opener === "{" || opener === "[") {
    const closer = opener === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = startIndex; index < content.length; index += 1) {
      const char = content[index];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "\"") {
          inString = false;
        }
        continue;
      }
      if (char === "\"") {
        inString = true;
        continue;
      }
      if (char === opener) {
        depth += 1;
        continue;
      }
      if (char === closer) {
        depth -= 1;
        if (depth === 0) {
          return index + 1;
        }
      }
    }
    return -1;
  }
  const scalarMatch = content.slice(startIndex).match(/^(true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
  return scalarMatch ? startIndex + scalarMatch[0].length : -1;
}

function extractMarkerValues(content, marker) {
  let searchIndex = 0;
  const values = [];
  while (searchIndex < content.length) {
    const markerIndex = content.indexOf(marker, searchIndex);
    if (markerIndex === -1) {
      break;
    }
    let valueStart = markerIndex + marker.length;
    while (valueStart < content.length) {
      const char = content[valueStart];
      if (char === "{" || char === "[" || char === "\"" || /[tfn0-9-]/.test(char)) {
        break;
      }
      valueStart += 1;
    }
    const valueEnd = findJsonTokenEnd(content, valueStart);
    if (valueEnd !== -1) {
      const candidate = content.slice(valueStart, valueEnd);
      try {
        const parsed = JSON.parse(candidate);
        if (marker === "cifi-suite.player-profile") {
          const isProfileObject =
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed) &&
            (parsed.player || parsed.planning || parsed.meta);
          if (!isProfileObject) {
            searchIndex = markerIndex + marker.length;
            continue;
          }
        }
        if (marker === "cifi-suite.snapshot") {
          const isSnapshotObject =
            parsed &&
            typeof parsed === "object" &&
            !Array.isArray(parsed);
          if (!isSnapshotObject) {
            searchIndex = markerIndex + marker.length;
            continue;
          }
        }
        if (marker === "cifi-suite.route" && typeof parsed !== "string") {
          searchIndex = markerIndex + marker.length;
          continue;
        }
        values.push(candidate);
      } catch {
        // Ignore malformed binary-adjacent slices.
      }
    }
    searchIndex = markerIndex + marker.length;
  }
  return values;
}

function scoreStoredValue(marker, candidate) {
  let score = candidate.length;
  try {
    const parsed = JSON.parse(candidate);
    if (marker === "cifi-suite.player-profile" && parsed && typeof parsed === "object") {
      const tokens = parsed?.player?.resources?.tokens;
      const levels = parsed?.planning?.tokenShop?.checkedSubsetPlayerState;
      const populatedLevels = levels && typeof levels === "object"
        ? Object.values(levels).filter((value) => typeof value === "number" && Number.isFinite(value)).length
        : 0;
      const profileName = parsed?.meta?.profileName;
      if (typeof tokens === "number" && Number.isFinite(tokens)) {
        score += 10_000;
        score += Math.max(0, Math.log10(Math.max(1, tokens))) * 5_000;
      }
      if (levels && typeof levels === "object") {
        score += Object.keys(levels).length * 500;
      }
      score += populatedLevels * 2_500;
      if (typeof profileName === "string" && profileName.trim()) {
        score += 2_000;
      }
    }
    if (marker === "cifi-suite.snapshot" && parsed && typeof parsed === "object") {
      if (parsed?.snapshotVersion) {
        score += 5_000;
      }
      if (Array.isArray(parsed?.importedRecords)) {
        score += parsed.importedRecords.length * 50;
      }
    }
    if (marker === "cifi-suite.route" && typeof parsed === "string") {
      score += 100;
    }
  } catch {
    // Validity already checked earlier; fallback to length score only.
  }
  return score;
}

function synthesizePlayerProfileFromContent(content) {
  const profileName = content.match(/"profileName":"([^"]+)"/)?.[1] ?? "Imported browser profile";
  const loopResetRaw = content.match(/"loopReset":(-?\d+)/)?.[1];
  const diamondsRaw = content.match(/"diamonds":(-?\d+)/)?.[1];
  const tokensRaw = content.match(/"tokens":(-?\d+)/)?.[1];
  const shardsRaw = content.match(/"shards":"([^"]+)"/)?.[1] ?? null;
  const levels = {};
  for (const match of content.matchAll(/"ATU(\d+)Level":(-?\d+|null)/g)) {
    const field = `ATU${match[1]}Level`;
    const parsedValue = match[2] === "null" ? null : Number(match[2]);
    if (typeof parsedValue !== "number" || !Number.isFinite(parsedValue)) {
      continue;
    }
    if (!(field in levels) || parsedValue > levels[field]) {
      levels[field] = parsedValue;
    }
  }
  if (!Object.keys(levels).length && !tokensRaw && !diamondsRaw && !loopResetRaw) {
    return null;
  }
  return JSON.stringify({
    meta: {
      profileName,
      dataConfidence: "manual"
    },
    player: {
      loop: {
        loopReset: loopResetRaw ? Number(loopResetRaw) : null
      },
      resources: {
        diamonds: diamondsRaw ? Number(diamondsRaw) : null,
        tokens: tokensRaw ? Number(tokensRaw) : null,
        academyRelics: null,
        shards: shardsRaw
      }
    },
    planning: {
      tokenShop: {
        checkedSubsetPlayerState: levels
      }
    }
  });
}

function describeStoredValue(marker, candidate) {
  try {
    const parsed = JSON.parse(candidate);
    if (marker === "cifi-suite.player-profile" && parsed && typeof parsed === "object") {
      const tokens = parsed?.player?.resources?.tokens;
      const levels = parsed?.planning?.tokenShop?.checkedSubsetPlayerState;
      const populatedLevels = levels && typeof levels === "object"
        ? Object.values(levels).filter((value) => typeof value === "number" && Number.isFinite(value)).length
        : 0;
      return `tokens=${tokens ?? "null"} populatedLevels=${populatedLevels} profile=${parsed?.meta?.profileName ?? "unknown"}`;
    }
    if (marker === "cifi-suite.route") {
      return `route=${String(parsed)}`;
    }
    if (marker === "cifi-suite.snapshot" && parsed && typeof parsed === "object") {
      return `snapshotVersion=${parsed?.snapshotVersion ?? "unknown"}`;
    }
  } catch {
    // Ignore description failures.
  }
  return `length=${candidate.length}`;
}

async function profileStorageScore(userDataDir, profileDirectory) {
  const levelDbDir = path.join(userDataDir, profileDirectory, "Local Storage", "leveldb");
  if (!(await pathExists(levelDbDir))) {
    return 0;
  }
  const entries = await readdir(levelDbDir, { withFileTypes: true });
  let score = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(log|ldb|sst)$/i.test(entry.name)) {
      continue;
    }
    const hasMarker = await fileContainsMarker(path.join(levelDbDir, entry.name), STORAGE_MARKERS);
    if (hasMarker) {
      score += 1;
    }
    if (score >= 2) {
      break;
    }
  }
  return score;
}

async function autoDetectStateSource(preferredTarget) {
  const candidateTargets = preferredTarget?.userDataDir
    ? [
        preferredTarget,
        ...BROWSER_TARGETS.filter(
          (target) => target.userDataDir && target.userDataDir !== preferredTarget.userDataDir
        )
      ]
    : BROWSER_TARGETS;
  const candidates = [];
  for (const target of candidateTargets) {
    if (!target.userDataDir || !(await pathExists(target.userDataDir))) {
      continue;
    }
    const profiles = await listProfileDirectories(target.userDataDir);
    for (const profileDirectory of profiles) {
      const score = await profileStorageScore(target.userDataDir, profileDirectory);
      if (score > 0) {
        candidates.push({
          userDataDir: target.userDataDir,
          profileDirectory,
          score
        });
      }
    }
  }
  candidates.sort((left, right) => right.score - left.score);
  return candidates[0] ?? null;
}

async function extractStoredLocalStorageEntries(sourceUserDataDir, profileDirectory) {
  const levelDbDir = path.join(sourceUserDataDir, profileDirectory, "Local Storage", "leveldb");
  if (!(await pathExists(levelDbDir))) {
    return {};
  }
  const entries = await readdir(levelDbDir, { withFileTypes: true });
  const extracted = {};
  const candidateMap = new Map(STORAGE_MARKERS.map((marker) => [marker, []]));
  const candidateFiles = entries
    .filter((entry) => entry.isFile() && /\.(log|ldb|sst)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  for (const fileName of candidateFiles) {
    const content = (await readFile(path.join(levelDbDir, fileName))).toString("latin1");
    const extractedProfileCountBefore =
      candidateMap.get("cifi-suite.player-profile")?.length ?? 0;
    for (const marker of STORAGE_MARKERS) {
      const values = extractMarkerValues(content, marker);
      if (values.length) {
        candidateMap.get(marker)?.push(...values);
      }
    }
    const synthesizedProfile = synthesizePlayerProfileFromContent(content);
    const extractedProfileCountAfter =
      candidateMap.get("cifi-suite.player-profile")?.length ?? 0;
    if (synthesizedProfile && extractedProfileCountAfter === extractedProfileCountBefore) {
      candidateMap.get("cifi-suite.player-profile")?.push(synthesizedProfile);
    }
  }
  for (const marker of STORAGE_MARKERS) {
    const values = candidateMap.get(marker) || [];
    if (!values.length) {
      continue;
    }
    values.sort((left, right) => scoreStoredValue(marker, right) - scoreStoredValue(marker, left));
    extracted[marker] = values[0];
    process.stderr.write(`Selected ${marker}: ${describeStoredValue(marker, values[0])}\n`);
  }
  return extracted;
}

async function loadCachedExtractedEntries() {
  try {
    const raw = await readFile(STATE_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function persistCachedExtractedEntries(entries) {
  try {
    await mkdir(path.dirname(STATE_CACHE_PATH), { recursive: true });
    await writeFile(STATE_CACHE_PATH, JSON.stringify(entries, null, 2));
  } catch {
    // Validation cache is best-effort only.
  }
}

function mergeExtractedEntriesWithCache(extractedEntries, cachedEntries) {
  const merged = { ...(cachedEntries && typeof cachedEntries === "object" ? cachedEntries : {}) };
  for (const marker of STORAGE_MARKERS) {
    const extractedValue = extractedEntries?.[marker];
    const cachedValue = cachedEntries?.[marker];
    if (!extractedValue) {
      continue;
    }
    if (!cachedValue) {
      merged[marker] = extractedValue;
      continue;
    }
    if (scoreStoredValue(marker, extractedValue) >= scoreStoredValue(marker, cachedValue)) {
      merged[marker] = extractedValue;
    }
  }
  return merged;
}

async function main() {
  const browserTarget = resolveBrowserTarget();
  if (!browserTarget?.executablePath) {
    throw new Error("No local Chrome/Edge executable found. Pass --browser <path>.");
  }

  const url = getArg("--url", "http://127.0.0.1:4173");
  const outputPath = path.resolve(getArg("--output", "workbench/local-surface.png"));
  const surface = getArg("--surface");
  const subsystem = getArg("--subsystem");
  const tier = getArg("--tier");
  const waitMs = Number(getArg("--wait-ms", "2500")) || 2500;
  const fullPage = hasFlag("--full-page");
  const fresh = hasFlag("--fresh");
  const explicitUserDataDir = getArg("--user-data-dir");
  const explicitProfileDirectory = getArg("--profile-directory", "Default");

  await mkdir(path.dirname(outputPath), { recursive: true });

  let context = null;
  let browser = null;

  try {
    const stateSource =
      fresh
        ? null
        : explicitUserDataDir
          ? {
              userDataDir: explicitUserDataDir,
              profileDirectory: explicitProfileDirectory
            }
          : await autoDetectStateSource(browserTarget);

    const serverBackedEntries = fresh ? {} : await fetchServerBackedLocalStorageEntries(url);
    const extractedEntries =
      stateSource?.userDataDir
        ? await extractStoredLocalStorageEntries(stateSource.userDataDir, stateSource.profileDirectory)
        : {};
    const cachedEntries = fresh ? {} : await loadCachedExtractedEntries();
    if (!fresh && !serverBackedEntries["cifi-suite.player-profile"]) {
      const seeded = await seedServerBackedPlayerProfileIfMissing(url, extractedEntries);
      if (seeded) {
        serverBackedEntries["cifi-suite.player-profile"] =
          extractedEntries["cifi-suite.player-profile"];
        process.stderr.write("Seeded DB-backed player profile from browser fallback state.\n");
      }
    }
    const mergedEntries = mergeExtractedEntriesWithCache(
      {
        ...extractedEntries,
        ...serverBackedEntries
      },
      cachedEntries
    );
    if (!fresh && Object.keys(mergedEntries).length) {
      await persistCachedExtractedEntries(mergedEntries);
    }

    browser = await chromium.launch({
      executablePath: browserTarget.executablePath,
      headless: true,
      args: ["--disable-gpu", "--use-angle=swiftshader", "--use-gl=swiftshader"]
    });
    context = await browser.newContext({ viewport: { width: 1600, height: 1800 } });
    if (Object.keys(mergedEntries).length > 0) {
      await context.addInitScript((entries) => {
        for (const [key, rawValue] of Object.entries(entries)) {
          window.localStorage.setItem(key, rawValue);
        }
      }, mergedEntries);
      if (serverBackedEntries["cifi-suite.player-profile"]) {
        process.stderr.write("Injected DB-backed player profile from local server.\n");
      } else if (stateSource?.userDataDir) {
        process.stderr.write(
          `Injected saved app state from ${stateSource.userDataDir} [${stateSource.profileDirectory}]\n`
        );
      }
    } else {
      process.stderr.write("Using a fresh browser state.\n");
    }

    const page = await context.newPage();
    page.setDefaultTimeout(120000);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(waitMs);

    if (surface && /progression/i.test(surface)) {
      await page.getByRole("button", { name: /Progression Bay/i }).click();
      await page.waitForTimeout(1500);
    }

    const subsystemTabName = getSubsystemTabName(subsystem);
    if (subsystemTabName) {
      await page.getByRole("tab", { name: subsystemTabName }).click();
      await page.waitForTimeout(2000);
    }

    if (tier && subsystemTabName && /tokenshop|token-shop/i.test(String(subsystem))) {
      await page.locator(`[data-token-shop-tier="${String(tier).trim().toLowerCase()}"]`).click({ force: true });
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: outputPath, fullPage });
    process.stdout.write(`${outputPath}\n`);
  } finally {
    await context?.close();
    await browser?.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
