export function createTokenShopUiSupport({ formatValue }) {
  function formatTokenShopBonusStep(row, bonusValue) {
    if (typeof bonusValue !== "number" || !Number.isFinite(bonusValue)) {
      return "Unknown bonus step";
    }
    if (row?.bonusStepMode === "additive") {
      return `+${formatValue(bonusValue)} ${row.bonusStepLabel}`;
    }
    return `x${formatValue(bonusValue)} to ${row?.bonusStepLabel || "the grounded lane"}`;
  }

  function getTokenShopKnownMaxStatus(currentLevel, maxLevel) {
    if (typeof maxLevel !== "number" || !Number.isFinite(maxLevel)) {
      return {
        label: "Known max unavailable",
        note: "The checked TokenShop values payload does not expose a usable max-level field for this row in the current build."
      };
    }
    if (currentLevel >= maxLevel) {
      return {
        label: "At or above known cap",
        note: `Imported level ${formatValue(currentLevel)} already meets or exceeds the checked max ${formatValue(maxLevel)} in the current values payload.`
      };
    }
    return {
      label: "Below known cap",
      note: `${formatValue(maxLevel - currentLevel)} known level(s) remain before the checked cap ${formatValue(maxLevel)}.`
    };
  }

  function getTokenShopCurrentVsNextBonusSummary(row, currentLevel, maxLevel, bonusValue) {
    const bonusStep = formatTokenShopBonusStep(row, bonusValue);
    const stepLabel =
      row?.rowType === "effect-driven" ? "checked effect step(s)" : "extracted bonus step(s)";
    if (typeof maxLevel === "number" && Number.isFinite(maxLevel) && currentLevel >= maxLevel) {
      return {
        currentLabel: `${formatValue(currentLevel)} ${stepLabel} of ${bonusStep}`,
        nextLabel: "No next bonus within known cap",
        detail: `The imported level already meets or exceeds the checked cap ${formatValue(maxLevel)}, so the row-detail tool stops at the current ${row?.rowType === "effect-driven" ? "checked effect-step" : "extracted bonus-step"} count instead of inventing overflow behavior.`
      };
    }

    const nextLevel = currentLevel + 1;
    return {
      currentLabel: `${formatValue(currentLevel)} ${stepLabel} of ${bonusStep}`,
      nextLabel: `${formatValue(nextLevel)} ${stepLabel} of ${bonusStep}`,
      detail: `Current level ${formatValue(currentLevel)} to next level ${formatValue(nextLevel)} adds one more ${row?.rowType === "effect-driven" ? "checked effect step" : "extracted bonus step"} only. This view does not infer compounding, best-buy value, or optimizer math.`
    };
  }

  function sanitizeTokenShopRichText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTokenShopRowDisplayTitle(row) {
    if (
      (typeof row?.identitySource === "string" &&
        /(final title|title-side text chain|named identity)/i.test(row.identitySource)) ||
      row?.rowType === "effect-driven"
    ) {
      if (row?.identity) {
        return sanitizeTokenShopRichText(row.identity);
      }
    }
    if (
      (row?.identitySource === "Checked final title" || row?.rowType === "effect-driven") &&
      row?.identity
    ) {
      return sanitizeTokenShopRichText(row.identity);
    }
    const rawIdentity = sanitizeTokenShopRichText(row?.identity || "")
      .split(".")
      .pop()
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .trim();
    return rawIdentity || row?.slot || "TokenShop row";
  }

  function formatTokenShopEffectLine(row) {
    if (row?.rowType === "effect-driven" && row?.effectText) {
      return sanitizeTokenShopRichText(row.effectText);
    }
    return formatTokenShopBonusStep(row, row?.bonusValue);
  }

  function getTokenShopRowGroundingSummary(row) {
    if (row?.rowType === "effect-driven") {
      return "Grounded as an effect-driven row from checked shell, action, and shared-effect evidence.";
    }
    if (
      typeof row?.identitySource === "string" &&
      /(final title|title-side text chain|named identity)/i.test(row.identitySource)
    ) {
      return "Grounded as a checked shell-to-prefab-to-player-facing-title row.";
    }
    return "Grounded as a checked shell-to-prefab row while the final title remains unresolved.";
  }

  function formatTokenShopSentence(value) {
    const text = sanitizeTokenShopRichText(value);
    if (!text) {
      return "";
    }
    return /[.!?]$/u.test(text) ? text : `${text}.`;
  }

  function getTokenShopActionLabel(row) {
    return row?.isMaxed ? "MAXED" : "BUY";
  }

  function formatTokenShopBonusMagnitude(value, mode) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return mode === "multiplier" ? "x?" : "?";
    }
    if (mode === "multiplier") {
      return `x${value.toFixed(2)}`;
    }
    return value.toFixed(2);
  }

  function getTokenShopBonusStripEntries(row) {
    const currentLevel =
      typeof row?.currentLevel === "number" && Number.isFinite(row.currentLevel)
        ? row.currentLevel
        : 0;
    const bonusValue =
      typeof row?.bonusValue === "number" && Number.isFinite(row.bonusValue) ? row.bonusValue : 0;
    const currentMagnitude =
      row?.bonusStepMode === "multiplier"
        ? Math.pow(bonusValue || 1, currentLevel)
        : bonusValue * currentLevel;
    const nextMagnitude = row?.isMaxed
      ? null
      : row?.bonusStepMode === "multiplier"
        ? Math.pow(bonusValue || 1, currentLevel + 1)
        : bonusValue * (currentLevel + 1);

    return [
      {
        label: row?.bonusStepLabel || "Bonus",
        currentLabel: formatTokenShopBonusMagnitude(currentMagnitude, row?.bonusStepMode),
        nextLabel:
          nextMagnitude === null
            ? "MAX"
            : formatTokenShopBonusMagnitude(nextMagnitude, row?.bonusStepMode)
      }
    ];
  }

  return Object.freeze({
    formatTokenShopBonusStep,
    getTokenShopKnownMaxStatus,
    getTokenShopCurrentVsNextBonusSummary,
    sanitizeTokenShopRichText,
    getTokenShopRowDisplayTitle,
    formatTokenShopEffectLine,
    getTokenShopRowGroundingSummary,
    formatTokenShopSentence,
    getTokenShopActionLabel,
    getTokenShopBonusStripEntries
  });
}
