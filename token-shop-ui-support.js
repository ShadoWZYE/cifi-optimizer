import { getTokenShopRowMeta } from "./support/token-shop-row-meta.js";

export function createTokenShopUiSupport({ formatValue }) {
  const TOKEN_SHOP_PLATE_SUFFIXES = [
    { value: 1e24, label: "sp" },
    { value: 1e21, label: "sx" },
    { value: 1e18, label: "qi" },
    { value: 1e15, label: "qa" },
    { value: 1e12, label: "t" },
    { value: 1e9, label: "b" },
    { value: 1e6, label: "m" },
    { value: 1e3, label: "k" }
  ];
  const TOKEN_SHOP_MAX_SUFFIX_VALUE = TOKEN_SHOP_PLATE_SUFFIXES[0].value;
  const TOKEN_SHOP_PLATE_SCIENTIFIC_THRESHOLD = TOKEN_SHOP_MAX_SUFFIX_VALUE * 1000;

  function isCompatibilityGradeTokenShopRow(row) {
    const source = String(row?.identitySource || "").trim();
    const note = String(row?.note || "").trim();
    return (
      /compatibility|owner-order|prefab identity|late-shelf title clue/i.test(source) ||
      /quarantined|unresolved|still unresolved|still stay quarantined/i.test(note)
    );
  }

  function formatTokenShopScientificNumber(value, digits = 2) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "?";
    }
    return value.toExponential(digits).replace(/e\+?/i, "e");
  }

  function formatCompactTokenShopNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "?";
    }
    const absolute = Math.abs(value);
    if (absolute === 0) {
      return "0";
    }
    if (absolute >= 1e6 || (absolute > 0 && absolute < 0.01)) {
      return formatTokenShopScientificNumber(value);
    }
    if (Number.isInteger(value)) {
      return formatValue(value);
    }
    return value.toFixed(2).replace(/\.?0+$/, "");
  }

  function formatTokenShopPlateNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "?";
    }
    const absolute = Math.abs(value);
    if (absolute === 0) {
      return "0.00";
    }
    if (absolute >= TOKEN_SHOP_PLATE_SCIENTIFIC_THRESHOLD || absolute < 0.01) {
      return formatTokenShopScientificNumber(value);
    }
    const suffixMeta = TOKEN_SHOP_PLATE_SUFFIXES.find((entry) => absolute >= entry.value);
    if (suffixMeta) {
      return `${(value / suffixMeta.value).toFixed(2).replace(/\.?0+$/, "")}${suffixMeta.label}`;
    }
    return value.toFixed(2);
  }

  function formatTokenShopPercentValue(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "?%";
    }
    const percentValue = value * 100;
    if (Math.abs(percentValue) >= 1000 || (Math.abs(percentValue) > 0 && Math.abs(percentValue) < 0.01)) {
      return `${formatTokenShopScientificNumber(percentValue)}%`;
    }
    if (Number.isInteger(percentValue)) {
      return `${formatValue(percentValue)}%`;
    }
    return `${percentValue.toFixed(2).replace(/\.?0+$/, "")}%`;
  }

  function formatTokenShopDisplayedBonusValue(row, bonusValue) {
    if (row?.bonusValueDisplayMode === "percent") {
      return formatTokenShopPercentValue(bonusValue);
    }
    return formatCompactTokenShopNumber(bonusValue);
  }

  function getTokenShopDisplayedBonusMagnitude(row, level, bonusValue) {
    if (typeof level !== "number" || !Number.isFinite(level)) {
      return null;
    }
    if (typeof bonusValue !== "number" || !Number.isFinite(bonusValue)) {
      return null;
    }
    if (row?.bonusStepMode === "multiplier") {
      return Math.pow(bonusValue || 1, level);
    }
    if (row?.bonusValueDisplayMode === "percent-total-multiplier") {
      return 1 + bonusValue * level;
    }
    return bonusValue * level;
  }

  function formatTokenShopBonusStep(row, bonusValue) {
    if (row?.bonusStepMode === "multi" || (Array.isArray(row?.bonusValues) && row.bonusValues.length > 1)) {
      return row?.bonusStepLabel || "Composite late-bonus lane";
    }
    if (typeof bonusValue !== "number" || !Number.isFinite(bonusValue)) {
      return "Unknown bonus step";
    }
    const formattedBonusValue = formatTokenShopDisplayedBonusValue(row, bonusValue);
    if (row?.bonusStepMode === "additive") {
      const additiveLabel = String(row?.bonusStepLabel || "").trim();
      const normalizedAdditiveLabel = /^to\b/i.test(additiveLabel)
        ? additiveLabel
        : `to ${additiveLabel}`;
      return `+${formattedBonusValue} ${normalizedAdditiveLabel}`.trim();
    }
    return `x${formattedBonusValue} to ${row?.bonusStepLabel || "the grounded lane"}`;
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
    if (row?.bonusStepMode === "multi" || (Array.isArray(row?.bonusValues) && row.bonusValues.length > 1)) {
      return {
        currentLabel: `Level ${formatValue(currentLevel)} in ${bonusStep}`,
        nextLabel: "Per-lane next-step scaling remains unresolved",
        detail:
          "This row preserves multiple grounded bonus lanes at once. The current storefront can show the late-shelf shell and first-purchase cost, but it does not yet invent a single compounded next-step formula across the mixed bonus lanes."
      };
    }
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
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getTokenShopRowDisplayTitle(row) {
    const rowMeta = getTokenShopRowMeta(row?.field);
    if (row?.storefrontDisplayTitle) {
      return sanitizeTokenShopRichText(row.storefrontDisplayTitle);
    }
    if (
      row?.displayTitle &&
      isCompatibilityGradeTokenShopRow(row)
    ) {
      return sanitizeTokenShopRichText(row.displayTitle);
    }
    if (
      (typeof row?.identitySource === "string" &&
        /(final title|title-side text chain|named identity|title surface)/i.test(row.identitySource)) ||
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
    if (
      typeof rowMeta?.title === "string" &&
      rowMeta.title.trim() &&
      row?.rowType === "prefab-driven"
    ) {
      return sanitizeTokenShopRichText(rowMeta.title);
    }
    const rawIdentity = sanitizeTokenShopRichText(row?.identity || "")
      .split(".")
      .pop()
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .trim();
    return rawIdentity || row?.slot || "TokenShop row";
  }

  function formatTokenShopEffectLine(row) {
    if (typeof row?.storefrontEffectText === "string" && row.storefrontEffectText.trim()) {
      return sanitizeTokenShopRichText(row.storefrontEffectText);
    }
    const rowMeta = getTokenShopRowMeta(row?.field);
    const canUseMetaEffectText =
      typeof rowMeta?.storeEffectText === "string" &&
      rowMeta.storeEffectText.trim() &&
      !isCompatibilityGradeTokenShopRow(row) &&
      ((typeof row?.identitySource === "string" &&
        /(final title|named identity|title surface)/i.test(row.identitySource)) ||
        row?.rowType === "effect-driven");
    if (canUseMetaEffectText) {
      return rowMeta.storeEffectText.trim();
    }
    if (row?.rowType === "effect-driven" && row?.effectText) {
      return sanitizeTokenShopRichText(row.effectText);
    }
    return formatTokenShopBonusStep(row, row?.bonusValue);
  }

  function getTokenShopStorefrontEffectLines(row) {
    if (Array.isArray(row?.storefrontEffectLines) && row.storefrontEffectLines.length) {
      return row.storefrontEffectLines
        .map((entry) => sanitizeTokenShopRichText(entry))
        .filter(Boolean);
    }
    const singleLine = formatTokenShopEffectLine(row);
    return singleLine ? [singleLine] : [];
  }

  function getTokenShopPlayerFacingSupportText(row) {
    const value = row?.playerFacingSupportText;
    if (Array.isArray(value)) {
      return value
        .map((entry) => sanitizeTokenShopRichText(entry))
        .filter(Boolean)
        .join(" ");
    }
    if (typeof value === "string") {
      return sanitizeTokenShopRichText(value);
    }
    return "";
  }

  function getTokenShopRowGroundingSummary(row) {
    if (row?.subjectId) {
      const blockedLine =
        typeof row?.blockedInputReason === "string" && row.blockedInputReason
          ? ` Blocked input: ${row.blockedInputReason}.`
          : "";
      return `Grounded through canonical ${row.subjectKind || "subject"} ${row.subjectId}.${blockedLine}`.trim();
    }
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

  function getTokenShopContractMetaLine(row) {
    if (!row?.subjectId) {
      return "";
    }
    const edgeBits = [];
    if (Array.isArray(row.knownEdges) && row.knownEdges.length) {
      edgeBits.push(`${row.knownEdges.length} known`);
    }
    if (Array.isArray(row.blockedEdges) && row.blockedEdges.length) {
      edgeBits.push(`${row.blockedEdges.length} blocked`);
    }
    if (Array.isArray(row.nonblockingEdges) && row.nonblockingEdges.length) {
      edgeBits.push(`${row.nonblockingEdges.length} nonblocking`);
    }
    return `${row.subjectKind || "subject"} • ${row.subjectId}${edgeBits.length ? ` • ${edgeBits.join(" / ")}` : ""}`;
  }

  function hasTokenShopRuntimeDisplayGap(row) {
    if (String(row?.storefrontBuffDisplayMode || "").trim() === "runtime-unresolved") {
      return true;
    }
    const blockedInputReason = String(row?.blockedInputReason || "").trim();
    const nextSeamId = String(row?.nextSeam?.seamId || "").trim();
    return (
      /runtime-model-gap|runtime display|runtime formula|displayed-cost evaluator|finalSetValue|costExponent|calculationType/i.test(
        blockedInputReason
      ) ||
      nextSeamId === "runtime-model-gap"
    );
  }

  function hasTokenShopUnresolvedBuffPresentation(row, rowMeta, runtimeDisplayGap) {
    return runtimeDisplayGap || rowMeta?.unresolvedBuffLane === true;
  }

  function formatTokenShopBonusMagnitude(value, mode) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return mode === "multiplier" ? "x?" : "?";
    }
    if (mode === "multiplier") {
      return `x${formatCompactTokenShopNumber(value)}`;
    }
    return formatCompactTokenShopNumber(value);
  }

  function formatTokenShopBonusMagnitudeForRow(row, value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return row?.bonusStepMode === "multiplier" ? "x?" : row?.bonusValueDisplayMode === "percent" ? "?%" : "?";
    }
    if (row?.bonusValueDisplayMode === "percent-total-multiplier") {
      return `x${formatTokenShopPlateNumber(value)}`;
    }
    if (row?.bonusStepMode === "multiplier") {
      return `x${formatTokenShopPlateNumber(value)}`;
    }
    if (row?.bonusValueDisplayMode === "percent") {
      return formatTokenShopPercentValue(value);
    }
    if (typeof row?.bonusPlateSuffix === "string" && row.bonusPlateSuffix.trim()) {
      const sign = value < 0 ? "-" : "+";
      const roundedValue = Math.abs(value);
      const formattedValue = Number.isInteger(roundedValue)
        ? formatValue(roundedValue)
        : formatTokenShopPlateNumber(roundedValue);
      return `${sign}${formattedValue}${row.bonusPlateSuffix}`;
    }
    const sign = value < 0 ? "-" : "+";
    return `${sign}${formatTokenShopPlateNumber(Math.abs(value))}`;
  }

  function getTokenShopBonusStripEntries(row) {
    const rowMeta = getTokenShopRowMeta(row?.field);
    const currentLevel =
      typeof row?.currentLevel === "number" && Number.isFinite(row.currentLevel)
        ? row.currentLevel
        : 0;
    const bonusValue =
      typeof row?.bonusValue === "number" && Number.isFinite(row.bonusValue) ? row.bonusValue : 0;
    const currentMagnitude = getTokenShopDisplayedBonusMagnitude(row, currentLevel, bonusValue);
    const nextMagnitude = row?.isMaxed
      ? null
      : getTokenShopDisplayedBonusMagnitude(row, currentLevel + 1, bonusValue);
    const currentLabel = formatTokenShopBonusMagnitudeForRow(row, currentMagnitude);
    const nextLabel =
      nextMagnitude === null
        ? "MAX"
        : formatTokenShopBonusMagnitudeForRow(row, nextMagnitude);
    const buffTargets = Array.isArray(row?.storefrontBuffTargets) && row.storefrontBuffTargets.length
      ? row.storefrontBuffTargets
      : Array.isArray(rowMeta?.storeBuffTargets) && rowMeta.storeBuffTargets.length
        ? rowMeta.storeBuffTargets
        : [{ label: row?.bonusStepLabel || "Bonus", tone: "neutral" }];
    const runtimeDisplayGap = hasTokenShopRuntimeDisplayGap(row);
    const unresolvedBuffPresentation = hasTokenShopUnresolvedBuffPresentation(
      row,
      rowMeta,
      runtimeDisplayGap
    );
    const preferStepBonusPresentation =
      unresolvedBuffPresentation &&
      (row?.bonusStepMode === "multiplier" || row?.bonusStepMode === "multi");
    const hasDirectSingleBonusValue = typeof bonusValue === "number" && Number.isFinite(bonusValue);
    const hasDirectCompositeBonusValues =
      Array.isArray(row?.bonusValues) &&
      row.bonusValues.length > 0 &&
      row.bonusValues.every((entry) => typeof entry?.value === "number" && Number.isFinite(entry.value));
    const canComputeBuffPresentation = hasDirectSingleBonusValue || hasDirectCompositeBonusValues;

    if (
      row?.bonusStepMode === "multi" &&
      Array.isArray(row?.bonusValues) &&
      row.bonusValues.length &&
      buffTargets.length === row.bonusValues.length
    ) {
      if (unresolvedBuffPresentation && !hasDirectCompositeBonusValues) {
        const primaryTarget = buffTargets[0];
        const hiddenCount = Math.max(0, buffTargets.length - 1);
        return [
          {
            label:
              hiddenCount > 0
                ? `${String(primaryTarget?.label || "Bonus").trim()} +${hiddenCount} more`
                : String(primaryTarget?.label || "Bonus").trim(),
            tone: String(primaryTarget?.tone || "neutral").trim(),
            currentLabel: "Research",
            nextLabel: "Research",
            isPrimary: true,
            isCollapsedResearch: true
          }
        ];
      }
      return buffTargets.map((target, index) => {
        const stepValue = row.bonusValues[index]?.value;
        if (typeof stepValue !== "number" || !Number.isFinite(stepValue)) {
          return {
            label: String(target?.label || `Bonus ${index + 1}`).trim(),
            tone: String(target?.tone || "neutral").trim(),
            currentLabel: "Research",
            nextLabel: "Research",
            isPrimary: index === 0
          };
        }
        const targetRow = {
          ...row,
          bonusStepMode: String(target?.mode || "multiplier").trim() || "multiplier",
          bonusValueDisplayMode: String(target?.valueDisplayMode || row?.bonusValueDisplayMode || "").trim()
        };
        const targetCurrentMagnitude = getTokenShopDisplayedBonusMagnitude(
          targetRow,
          currentLevel,
          stepValue
        );
        const targetResolvedCurrentMagnitude = preferStepBonusPresentation
          ? stepValue
          : targetCurrentMagnitude;
        return {
          label: String(target?.label || `Bonus ${index + 1}`).trim(),
          tone: String(target?.tone || "neutral").trim(),
          currentLabel: formatTokenShopBonusMagnitudeForRow(targetRow, targetResolvedCurrentMagnitude),
          nextLabel:
            row?.isMaxed
              ? "MAX"
              : formatTokenShopBonusMagnitudeForRow(targetRow, preferStepBonusPresentation
                  ? stepValue
                  : getTokenShopDisplayedBonusMagnitude(targetRow, currentLevel + 1, stepValue)),
          isPrimary: index === 0
        };
      });
    }

    return buffTargets.map((target, index) => ({
      label: String(target?.label || row?.bonusStepLabel || "Bonus").trim(),
      tone: String(target?.tone || "neutral").trim(),
      currentLabel:
        unresolvedBuffPresentation && !canComputeBuffPresentation
          ? "Research"
          : preferStepBonusPresentation
            ? formatTokenShopBonusMagnitudeForRow(row, bonusValue)
            : currentLabel,
      nextLabel:
        unresolvedBuffPresentation && !canComputeBuffPresentation
          ? "Research"
          : preferStepBonusPresentation
            ? formatTokenShopBonusMagnitudeForRow(row, bonusValue)
            : nextLabel,
      isPrimary: index === 0
    }));
  }

  return Object.freeze({
    formatTokenShopBonusStep,
    getTokenShopKnownMaxStatus,
    getTokenShopCurrentVsNextBonusSummary,
    sanitizeTokenShopRichText,
    getTokenShopRowDisplayTitle,
    formatTokenShopEffectLine,
    getTokenShopStorefrontEffectLines,
    getTokenShopPlayerFacingSupportText,
    getTokenShopRowGroundingSummary,
    getTokenShopContractMetaLine,
    formatTokenShopSentence,
    getTokenShopBonusStripEntries,
    isCompatibilityGradeTokenShopRow
  });
}
