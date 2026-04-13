export const CI_SUFFIX_EXPONENTS = {
  k: 3,
  m: 6,
  b: 9,
  t: 12,
  qa: 15,
  qi: 18,
  sx: 21,
  sp: 24,
  oc: 27,
  no: 30,
  dc: 33
};

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.replace(/^"|"$/g, ""));
}

export function splitList(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(/[|,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function normalizeImportRow(row, dataset, index = 0) {
  const clean = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim(),
      typeof value === "string" ? value.trim() : value
    ])
  );
  if (dataset === "gemNodes") {
    return {
      id: clean.id || slugify(clean.label || `gem-node-${index + 1}`),
      label: clean.label || `Gem node ${index + 1}`,
      level: Number(clean.level || 0),
      maxLevel: Number(clean.maxLevel || clean.max_level || 10),
      cost: Number(clean.cost || 0),
      value: Number(clean.value || 0),
      tags: splitList(clean.tags)
    };
  }
  if (dataset === "shardMilestones") {
    return {
      id: clean.id || slugify(clean.label || `shard-milestone-${index + 1}`),
      label: clean.label || `Shard milestone ${index + 1}`,
      notes: clean.notes || "",
      sourceLabel: clean.sourceLabel || clean.source || "",
      sourceUrl: clean.sourceUrl || clean.url || "",
      verified: clean.verified === true || clean.verified === "true"
    };
  }
  if (dataset === "validationCases") {
    return {
      id: clean.id || slugify(clean.title || `validation-${index + 1}`),
      module: clean.module || "ship",
      title: clean.title || `Validation ${index + 1}`,
      expected: clean.expected || "",
      description: clean.description || ""
    };
  }
  if (dataset === "researchTracks") {
    return {
      id: clean.id || slugify(clean.title || `research-${index + 1}`),
      title: clean.title || `Track ${index + 1}`,
      goal: clean.goal || "",
      nextSteps: splitList(clean.nextSteps || clean.next_steps)
    };
  }
  return {
    id: clean.id || slugify(clean.name || `ship-loadout-${index + 1}`),
    name: clean.name || `Imported loadout ${index + 1}`,
    resourceBias: clean.resourceBias || clean.resource || "credits",
    powerScale: Number(clean.powerScale || 1),
    speedScale: Number(clean.speedScale || 1),
    cargoScale: Number(clean.cargoScale || 1),
    risk: clean.risk || "balanced",
    notes: clean.notes || ""
  };
}

export function coerceInputValue(value) {
  if (value === "") {
    return null;
  }
  if (typeof value === "string") {
    const normalized = normalizeCiNumberValue(value);
    if (normalized !== null) {
      return normalized;
    }
  }
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? value : numberValue;
}

export function normalizeCiNumberValue(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return "";
  }

  const normalized = raw.replace(/,/g, "").toLowerCase();
  const sciMatch = normalized.match(/^([+-]?\d*\.?\d+)\s*e\s*([+-]?\d+)$/);
  if (sciMatch) {
    return formatCiNormalizedNumber(Number(sciMatch[1]), Number(sciMatch[2]));
  }

  const suffixMatch = normalized.match(/^([+-]?\d*\.?\d+)\s*([a-z]{1,2})$/);
  if (suffixMatch) {
    const suffixExponent = CI_SUFFIX_EXPONENTS[suffixMatch[2]];
    if (suffixExponent !== undefined) {
      return formatCiNormalizedNumber(Number(suffixMatch[1]), suffixExponent);
    }
  }

  const plainNumber = Number(normalized);
  if (!Number.isNaN(plainNumber)) {
    return plainNumber;
  }

  return null;
}

export function formatCiNormalizedNumber(mantissa, exponent) {
  if (!Number.isFinite(mantissa) || !Number.isFinite(exponent)) {
    return "";
  }
  if (mantissa === 0) {
    return 0;
  }
  let nextMantissa = mantissa;
  let nextExponent = exponent;
  while (Math.abs(nextMantissa) >= 10) {
    nextMantissa /= 10;
    nextExponent += 1;
  }
  while (Math.abs(nextMantissa) > 0 && Math.abs(nextMantissa) < 1) {
    nextMantissa *= 10;
    nextExponent -= 1;
  }
  if (nextExponent >= -6 && nextExponent <= 12) {
    const numericValue = nextMantissa * Math.pow(10, nextExponent);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return `${trimTrailingZeros(nextMantissa.toFixed(6))}e${nextExponent}`;
}

export function trimTrailingZeros(value) {
  return String(value)
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "");
}

export function normalizeGeneratorTierKey(value) {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) {
    return null;
  }
  const direct = text.match(/^n([1-9]|10)$/);
  if (direct) {
    return `n${direct[1]}`;
  }
  const mk = text.match(/^mk\s*([1-9]|10)$/);
  if (mk) {
    return `n${mk[1]}`;
  }
  const plain = text.match(/^([1-9]|10)$/);
  if (plain) {
    return `n${plain[1]}`;
  }
  return null;
}
