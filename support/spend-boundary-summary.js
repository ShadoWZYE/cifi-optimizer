export function formatNumericRanges(values) {
  const normalizedValues = Array.isArray(values)
    ? [
        ...new Set(
          values
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .sort((left, right) => left - right)
        )
      ]
    : [];
  const ranges = [];
  let rangeStart = null;
  let previous = null;

  normalizedValues.forEach((value) => {
    if (rangeStart === null) {
      rangeStart = value;
      previous = value;
      return;
    }
    if (value === previous + 1) {
      previous = value;
      return;
    }
    ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`);
    rangeStart = value;
    previous = value;
  });

  if (rangeStart !== null) {
    ranges.push(rangeStart === previous ? `${rangeStart}` : `${rangeStart}-${previous}`);
  }

  return ranges.join(" and ");
}

function markLegacyTokenShopFallback(summary, coverageSource) {
  return {
    ...summary,
    coverageSource,
    fallbackMode: "export-debug-compatibility",
    usesLegacyCompatibilityFallback: true
  };
}

export function getTokenShopCostLaneSummary(clues) {
  const genericSummary = getTokenShopGenericCostLaneSummary(
    getTokenShopDbGenericScopes(clues)
  );
  const contracts = normalizeTokenShopSubjectMetadata(clues);
  if (genericSummary) {
    return genericSummary;
  }
  if (contracts.length) {
    const rowLocal =
      contracts.find((contract) => {
        const knownEdges = Array.isArray(contract?.knownEdges) ? contract.knownEdges : [];
        const blockedEdges = Array.isArray(contract?.blockedEdges) ? contract.blockedEdges : [];
        return (
          contract?.subjectKind === "row-local" &&
          (knownEdges.includes("exact-display-update-path") ||
            blockedEdges.includes("exact-display-update-path") ||
            Array.isArray(contract?.groundedFields?.displayUpdateHooks))
        );
      }) ?? null;
    const rangeFamily =
      contracts.find((contract) => {
        const knownEdges = Array.isArray(contract?.knownEdges) ? contract.knownEdges : [];
        return (
          contract?.subjectKind === "range-family" &&
          (knownEdges.includes("exact-display-update-path") ||
            knownEdges.includes("row-family-effect-hook"))
        );
      }) ?? null;
    const displayHooks = Array.isArray(rowLocal?.groundedFields?.displayUpdateHooks)
      ? rowLocal.groundedFields.displayUpdateHooks
      : [];
    const rangeSupport = rangeFamily?.supportSummary ?? {};

    return {
      hasLaneSplit: Boolean(rowLocal?.subjectId) && Boolean(rangeFamily?.subjectId),
      coverageSource: getTokenShopDbCoverageSource(clues, contracts.length > 0),
      keepsDailyTokeniumSeparate: Boolean(rangeFamily?.subjectId),
      tokenLaneLabel: rowLocal?.subjectId || "row-local display subject",
      diamondLaneLabel: rowLocal?.subjectKind || "row-local",
      dailyLaneLabel: rangeFamily?.subjectId || "range-family display subject",
      costShellLabel: displayHooks[0] || "display-hook-unavailable",
      costRenderLabel:
        Array.isArray(rangeSupport.supportSurfaceLabels) && rangeSupport.supportSurfaceLabels[0]
          ? rangeSupport.supportSurfaceLabels[0]
          : "support-surface-unavailable",
      descriptionRenderLabel:
        rowLocal?.nextSeam?.id || rangeFamily?.nextSeam?.id || "next-seam-unavailable",
      rowLocalSubjectId: rowLocal?.subjectId || null,
      rangeFamilySubjectId: rangeFamily?.subjectId || null,
      rowLocalSubjectKind: rowLocal?.subjectKind || null,
      rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
      rowLocalBlockedEdges: Array.isArray(rowLocal?.blockedEdges) ? rowLocal.blockedEdges : [],
      rangeFamilyKnownEdges: Array.isArray(rangeFamily?.knownEdges) ? rangeFamily.knownEdges : [],
      blockedInputReason:
        (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
        (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
        null
    };
  }

  const tokenSpendGroups = Array.isArray(clues?.tokenSpendGroups) ? clues.tokenSpendGroups : [];
  const dailyTokeniumModifierGroups = Array.isArray(clues?.dailyTokeniumModifierGroups)
    ? clues.dailyTokeniumModifierGroups
    : [];
  const diamondGroups = Array.isArray(clues?.diamondGroups) ? clues.diamondGroups : [];
  const tracePresentation =
    typeof clues?.tracePresentation === "object" && clues.tracePresentation
      ? clues.tracePresentation
      : {};

  // Compatibility-only fallback: active UI reads should use DB-backed TokenShop mechanics when
  // they are present. This branch remains only for export/debug views or when DB-backed surfaces
  // are absent from the caller payload.
  return markLegacyTokenShopFallback(
    {
      hasLaneSplit:
        tokenSpendGroups.includes("TokenBoost") &&
        diamondGroups.includes("DiamondBoost") &&
        dailyTokeniumModifierGroups.includes("TokenDailiesT2") &&
        tracePresentation.costShell === "CostBox" &&
        tracePresentation.descriptionRenderNode === "DescText",
      keepsDailyTokeniumSeparate:
        dailyTokeniumModifierGroups.includes("TokenDailiesT2") &&
        dailyTokeniumModifierGroups.includes("TokenDailiesT3") &&
        tracePresentation.costRenderNode === "CostText",
      tokenLaneLabel: "TokenBoost",
      diamondLaneLabel: "DiamondBoost",
      dailyLaneLabel: "TokenDailiesT2",
      costShellLabel: tracePresentation.costShell ?? "CostBox",
      costRenderLabel: tracePresentation.costRenderNode ?? "CostText",
      descriptionRenderLabel: tracePresentation.descriptionRenderNode ?? "DescText"
    },
    "legacy-cost-lanes"
  );
}

export function getSpendActionLaneSummary(tokenShop) {
  const genericSummary = getTokenShopGenericActionLaneSummary(
    getTokenShopDbGenericScopes(tokenShop)
  );
  const contracts = normalizeTokenShopSubjectMetadata(tokenShop);
  if (genericSummary) {
    return genericSummary;
  }
  if (contracts.length) {
    const rowLocal =
      contracts.find((contract) => {
        const knownEdges = Array.isArray(contract?.knownEdges) ? contract.knownEdges : [];
        const actionMethods = Array.isArray(contract?.groundedFields?.actionMethods)
          ? contract.groundedFields.actionMethods
          : [];
        return (
          contract?.subjectKind === "row-local" &&
          (knownEdges.includes("exact-shell-to-action-hook") || actionMethods.length > 0)
        );
      }) ?? null;
    const rangeFamily =
      contracts.find((contract) => {
        const knownEdges = Array.isArray(contract?.knownEdges) ? contract.knownEdges : [];
        const nonblockingEdges = Array.isArray(contract?.nonblockingEdges)
          ? contract.nonblockingEdges
          : [];
        return (
          contract?.subjectKind === "range-family" &&
          (knownEdges.includes("row-family-action-hook") ||
            knownEdges.includes("exact-shell-to-action-hook") ||
            nonblockingEdges.includes("exact-shell-to-action-hook"))
        );
      }) ?? null;
    const rowLocalActionHooks = Array.isArray(rowLocal?.groundedFields?.actionMethods)
      ? rowLocal.groundedFields.actionMethods
      : [];
    const rangeFamilyKnownEdges = Array.isArray(rangeFamily?.knownEdges)
      ? rangeFamily.knownEdges
      : [];
    const rangeFamilyNonblockingEdges = Array.isArray(rangeFamily?.nonblockingEdges)
      ? rangeFamily.nonblockingEdges
      : [];

    return {
      hasActionSplit: Boolean(rowLocal?.subjectId) && Boolean(rangeFamily?.subjectId),
      coverageSource: getTokenShopDbCoverageSource(tokenShop, contracts.length > 0),
      keepsDailyDirectHooksUnrecovered: rangeFamilyNonblockingEdges.includes(
        "exact-shell-to-action-hook"
      ),
      tokenHook: rowLocal?.subjectId || "row-local action subject",
      diamondHook: rowLocal?.subjectKind || "row-local",
      loopModifierHook: rowLocalActionHooks[0] || "action-hook-unavailable",
      premiumModifierHook: rangeFamily?.subjectId || "range-family action subject",
      dailyHookT2: rangeFamilyNonblockingEdges[0] || "nonblocking-edge-unavailable",
      dailyHookT3: rangeFamily?.nextSeam?.id || "next-seam-unavailable",
      rowLocalSubjectId: rowLocal?.subjectId || null,
      rangeFamilySubjectId: rangeFamily?.subjectId || null,
      rowLocalSubjectKind: rowLocal?.subjectKind || null,
      rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
      rowLocalKnownEdges: Array.isArray(rowLocal?.knownEdges) ? rowLocal.knownEdges : [],
      rangeFamilyKnownEdges,
      rangeFamilyNonblockingEdges,
      blockedInputReason:
        (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
        (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
        null
    };
  }

  const clues = tokenShop?.spendLanes?.actionLaneClues ?? tokenShop;
  const tokenDirectBuyHooks = Array.isArray(clues?.tokenDirectBuyHooks)
    ? clues.tokenDirectBuyHooks
    : [];
  const diamondDirectBuyHooks = Array.isArray(clues?.diamondDirectBuyHooks)
    ? clues.diamondDirectBuyHooks
    : [];
  const dailyTokeniumModifierHooks = Array.isArray(clues?.dailyTokeniumModifierHooks)
    ? clues.dailyTokeniumModifierHooks
    : [];
  const searchMetadata =
    typeof clues?.searchResults?.metadata === "object" && clues.searchResults.metadata
      ? clues.searchResults.metadata
      : {};
  const searchLevel0 =
    typeof clues?.searchResults?.level0 === "object" && clues.searchResults.level0
      ? clues.searchResults.level0
      : {};

  // Compatibility-only fallback: active UI reads should use DB-backed TokenShop mechanics when
  // they are present. This branch remains only for export/debug views or when DB-backed surfaces
  // are absent from the caller payload.
  return markLegacyTokenShopFallback(
    {
      hasActionSplit:
        tokenDirectBuyHooks.includes("BuyTokenBoost") &&
        diamondDirectBuyHooks.includes("BuyDiamondBoost") &&
        dailyTokeniumModifierHooks.includes("BuyLM244") &&
        dailyTokeniumModifierHooks.includes("BuyCollectorDevice"),
      keepsDailyDirectHooksUnrecovered:
        searchMetadata.BuyTokenDailiesT2 === 0 &&
        searchMetadata.BuyTokenDailiesT3 === 0 &&
        searchLevel0.BuyTokenDailiesT2 === 0 &&
        searchLevel0.BuyTokenDailiesT3 === 0,
      tokenHook: "BuyTokenBoost",
      diamondHook: "BuyDiamondBoost",
      loopModifierHook: "BuyLM244",
      premiumModifierHook: "BuyCollectorDevice",
      dailyHookT2: "BuyTokenDailiesT2",
      dailyHookT3: "BuyTokenDailiesT3"
    },
    "legacy-action-lane"
  );
}

export function getTokenBankStateSummary(clues) {
  const genericSummary = getTokenShopGenericTokenBankStateSummary(
    getTokenShopDbGenericScopes(clues)
  );
  const contracts = normalizeTokenShopSubjectMetadata(clues);
  if (genericSummary) {
    return genericSummary;
  }
  if (contracts.length) {
    const rowLocal =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "row-local" &&
          typeof contract?.groundedFields?.tokenBankState === "object" &&
          contract.groundedFields.tokenBankState
      ) ?? null;
    const rangeFamily =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "range-family" &&
          typeof contract?.groundedFields?.tokenBankState === "object" &&
          contract.groundedFields.tokenBankState
      ) ?? null;
    const stateFields =
      rowLocal?.groundedFields?.tokenBankState ?? rangeFamily?.groundedFields?.tokenBankState ?? {};
    const blockedInputReason =
      (typeof rowLocal?.blockedInputReasons?.tokenBankState === "string" &&
        rowLocal.blockedInputReasons.tokenBankState) ||
      (typeof rangeFamily?.blockedInputReasons?.tokenBankState === "string" &&
        rangeFamily.blockedInputReasons.tokenBankState) ||
      (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
      (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
      null;
    const canUseContract =
      blockedInputReason === null &&
      typeof stateFields.claimMethod === "string" &&
      typeof stateFields.capMethod === "string" &&
      typeof stateFields.displayShell === "string" &&
      typeof stateFields.loopHook === "string" &&
      typeof stateFields.cloudSaveShell === "string" &&
      typeof stateFields.cloudSaveInfoRoutine === "string" &&
      typeof stateFields.cloudSaveProfileRoutine === "string" &&
      typeof stateFields.cloudSaveStateMachine === "string";

    if (canUseContract) {
      return {
        hasControllerSplit: true,
        hasExactStoredAmountOwner:
          typeof stateFields.exactSaveOwnerType === "string" &&
          typeof stateFields.storedAmountField === "string",
        hasGenericClaimableBoundary:
          typeof stateFields.genericClaimableFieldOwner === "string" &&
          typeof stateFields.genericClaimableField === "string",
        hasPlayerProfileBridgeBoundary:
          typeof stateFields.profileBridgeOwner === "string" &&
          typeof stateFields.profileBridgeMethod === "string" &&
          typeof stateFields.profileBridgeReturnType === "string" &&
          typeof stateFields.profileCacheField === "string",
        hasCloudSaveShellBoundary: true,
        coverageSource: getTokenShopDbCoverageSource(clues, contracts.length > 0),
        claimMethod: stateFields.claimMethod,
        capMethod: stateFields.capMethod,
        displayShell: stateFields.displayShell,
        loopHandler: stateFields.loopHandler || "TextHandlerLoopMods",
        loopHook: stateFields.loopHook,
        exactSaveOwnerType: stateFields.exactSaveOwnerType || "SaveData",
        storedAmountField: stateFields.storedAmountField || "BankedTokens",
        exactSaveOwnerLabel: `${stateFields.exactSaveOwnerType || "SaveData"}.${stateFields.storedAmountField || "BankedTokens"}`,
        genericClaimableFieldOwner: stateFields.genericClaimableFieldOwner || "SaveData",
        genericClaimableField: stateFields.genericClaimableField || "ClaimableTokenium",
        genericClaimableLabel: `${stateFields.genericClaimableFieldOwner || "SaveData"}.${stateFields.genericClaimableField || "ClaimableTokenium"}`,
        profileBridgeOwner: stateFields.profileBridgeOwner || "PlayerProfileHandler",
        profileBridgeMethod: stateFields.profileBridgeMethod || "ConvertSaveDataToProfileData",
        profileBridgeReturnType: stateFields.profileBridgeReturnType || "PlayerProfileData",
        profileCacheField: stateFields.profileCacheField || "saveInfoCache",
        profileBridgeLabel: `${stateFields.profileBridgeOwner || "PlayerProfileHandler"}.${stateFields.profileCacheField || "saveInfoCache"} + ${stateFields.profileBridgeMethod || "ConvertSaveDataToProfileData"}(...) -> ${stateFields.profileBridgeReturnType || "PlayerProfileData"}`,
        cloudSaveShell: stateFields.cloudSaveShell,
        cloudSaveInfoRoutine: stateFields.cloudSaveInfoRoutine,
        cloudSaveProfileRoutine: stateFields.cloudSaveProfileRoutine,
        cloudSaveStateMachine: stateFields.cloudSaveStateMachine,
        rowLocalSubjectId: rowLocal?.subjectId || null,
        rangeFamilySubjectId: rangeFamily?.subjectId || null,
        rowLocalSubjectKind: rowLocal?.subjectKind || null,
        rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
        blockedInputReason
      };
    }
  }

  const tokenShopMethods = Array.isArray(clues?.tokenShopMethods) ? clues.tokenShopMethods : [];
  const displayOrHandlerClues = Array.isArray(clues?.displayOrHandlerClues)
    ? clues.displayOrHandlerClues
    : [];
  const cloudSaveBoundary =
    typeof clues?.cloudSavePlayerProfileBoundary === "object" &&
    clues.cloudSavePlayerProfileBoundary
      ? clues.cloudSavePlayerProfileBoundary
      : {};
  const cloudSaveShellMethods = Array.isArray(cloudSaveBoundary.metadataShellMethods)
    ? cloudSaveBoundary.metadataShellMethods
    : [];
  const cloudSaveStateMachines = Array.isArray(cloudSaveBoundary.metadataStateMachines)
    ? cloudSaveBoundary.metadataStateMachines
    : [];
  const exactSaveOwnerRecovery =
    typeof clues?.exactSaveOwnerRecovery === "object" && clues.exactSaveOwnerRecovery
      ? clues.exactSaveOwnerRecovery
      : {};
  const genericClaimableBoundary =
    typeof clues?.genericTokeniumClaimableBoundary === "object" &&
    clues.genericTokeniumClaimableBoundary
      ? clues.genericTokeniumClaimableBoundary
      : {};
  const playerProfilePersistenceBoundary =
    typeof clues?.playerProfilePersistenceBoundary === "object" &&
    clues.playerProfilePersistenceBoundary
      ? clues.playerProfilePersistenceBoundary
      : {};

  // Required compatibility fallback: keep this path until tokenBankState contracts are both
  // present and unblocked. Blocked cases are expected to fall back rather than presenting partial
  // contract truth as grounded.
  return markLegacyTokenShopFallback(
    {
      hasControllerSplit:
        tokenShopMethods.includes("ClaimBankedTokens") &&
        tokenShopMethods.includes("get_TokenBankCap") &&
        displayOrHandlerClues.includes("BigStatisticPrefab.TokenBankCap") &&
        displayOrHandlerClues.includes("SetLM244BonusText"),
      hasExactStoredAmountOwner:
        exactSaveOwnerRecovery.declaringType === "SaveData" &&
        exactSaveOwnerRecovery.storedAmountField === "BankedTokens",
      hasGenericClaimableBoundary:
        genericClaimableBoundary.declaringType === "SaveData" &&
        genericClaimableBoundary.field === "ClaimableTokenium",
      hasPlayerProfileBridgeBoundary:
        playerProfilePersistenceBoundary.bridgeOwner === "PlayerProfileHandler" &&
        playerProfilePersistenceBoundary.bridgeMethod === "ConvertSaveDataToProfileData" &&
        playerProfilePersistenceBoundary.bridgeReturnType === "PlayerProfileData" &&
        playerProfilePersistenceBoundary.handlerField === "saveInfoCache",
      hasCloudSaveShellBoundary:
        cloudSaveBoundary.scriptName === "CloudSavePlayerProfile" &&
        cloudSaveBoundary.typedTargetFound === false &&
        cloudSaveBoundary.metadataAnchorFound === true &&
        cloudSaveShellMethods.includes("GetCurrentSaveFileInfo") &&
        cloudSaveShellMethods.includes("GetPlayerProfileInfo") &&
        cloudSaveStateMachines.includes("<CloudSavePlayerProfile>d__24"),
      claimMethod: "ClaimBankedTokens",
      capMethod: "get_TokenBankCap",
      displayShell: "BigStatisticPrefab.TokenBankCap",
      loopHandler: "TextHandlerLoopMods",
      loopHook: "SetLM244BonusText",
      exactSaveOwnerType: "SaveData",
      storedAmountField: "BankedTokens",
      exactSaveOwnerLabel: "SaveData.BankedTokens",
      genericClaimableFieldOwner: "SaveData",
      genericClaimableField: "ClaimableTokenium",
      genericClaimableLabel: "SaveData.ClaimableTokenium",
      profileBridgeOwner: "PlayerProfileHandler",
      profileBridgeMethod: "ConvertSaveDataToProfileData",
      profileBridgeReturnType: "PlayerProfileData",
      profileCacheField: "saveInfoCache",
      profileBridgeLabel:
        "PlayerProfileHandler.saveInfoCache + ConvertSaveDataToProfileData(...) -> PlayerProfileData",
      cloudSaveShell: "CloudSavePlayerProfile",
      cloudSaveInfoRoutine: "GetCurrentSaveFileInfo",
      cloudSaveProfileRoutine: "GetPlayerProfileInfo",
      cloudSaveStateMachine: "<CloudSavePlayerProfile>d__24"
    },
    "legacy-token-bank-state"
  );
}

export function getDailyTokeniumLaneSummary(clues) {
  const genericSummary = getTokenShopGenericDailyTokeniumLaneSummary(
    getTokenShopDbGenericScopes(clues)
  );
  const contracts = normalizeTokenShopSubjectMetadata(clues);
  if (genericSummary) {
    return genericSummary;
  }
  if (contracts.length) {
    const rowLocal =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "row-local" &&
          typeof contract?.groundedFields?.dailyTokeniumLane === "object" &&
          contract.groundedFields.dailyTokeniumLane
      ) ?? null;
    const rangeFamily =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "range-family" &&
          typeof contract?.groundedFields?.dailyTokeniumLane === "object" &&
          contract.groundedFields.dailyTokeniumLane
      ) ?? null;
    const laneFields =
      rowLocal?.groundedFields?.dailyTokeniumLane ??
      rangeFamily?.groundedFields?.dailyTokeniumLane ??
      {};
    const blockedInputReason =
      (typeof rowLocal?.blockedInputReasons?.dailyTokeniumLane === "string" &&
        rowLocal.blockedInputReasons.dailyTokeniumLane) ||
      (typeof rangeFamily?.blockedInputReasons?.dailyTokeniumLane === "string" &&
        rangeFamily.blockedInputReasons.dailyTokeniumLane) ||
      (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
      (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
      null;

    return {
      hasOwnerFamilyClues:
        typeof laneFields.ownerFamilyLabel === "string" &&
        typeof laneFields.academyController === "string" &&
        typeof laneFields.textHandler === "string" &&
        typeof laneFields.missionFamilyLabel === "string",
      hasModifierBoundary:
        typeof laneFields.loopHook === "string" &&
        typeof laneFields.purchaseHook === "string" &&
        typeof laneFields.finalBonusHook === "string" &&
        typeof laneFields.purchaseOwner === "string" &&
        typeof laneFields.premiumCapBonus === "string" &&
        typeof laneFields.premiumMatsBonus === "string",
      hasPlayerFacingBoundary:
        typeof laneFields.progressString === "string" &&
        typeof laneFields.capDescriptionString === "string" &&
        typeof laneFields.collectorPackDescriptionString === "string",
      coverageSource: getTokenShopDbCoverageSource(clues, contracts.length > 0),
      ownerFamilyLabel: laneFields.ownerFamilyLabel || "SpaceAcademy",
      missionFamilyLabel: laneFields.missionFamilyLabel || "FarmMissions",
      academyController: laneFields.academyController || "SpaceAcademyMain",
      textHandler: laneFields.textHandler || "TextHandlerSpaceAcademy",
      loopHook: laneFields.loopHook || "SetLM244BonusText",
      purchaseHook: laneFields.purchaseHook || "BuyLM244",
      finalBonusHook: laneFields.finalBonusHook || "FinalDailyTokenBonus",
      purchaseOwner: laneFields.purchaseOwner || "BuyCollectorDevice",
      premiumCapBonus: laneFields.premiumCapBonus || "CollectorCapBonus",
      premiumMatsBonus: laneFields.premiumMatsBonus || "CollectorMatsBonus",
      progressString:
        laneFields.progressString || "0 / 2000 Daily Tokenium (from blue farm missions)",
      capDescriptionString:
        laneFields.capDescriptionString ||
        "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)",
      collectorPackDescriptionString:
        laneFields.collectorPackDescriptionString ||
        "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu",
      premiumPack: "COLLECTERS PACK",
      rowLocalSubjectId: rowLocal?.subjectId || null,
      rangeFamilySubjectId: rangeFamily?.subjectId || null,
      rowLocalSubjectKind: rowLocal?.subjectKind || null,
      rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
      blockedInputReason
    };
  }

  const laneClues = clues?.dailyTokenium?.laneClues ?? clues;
  const ownerFamilyClues = Array.isArray(laneClues?.ownerFamilyClues)
    ? laneClues.ownerFamilyClues
    : [];
  const modifierClues = Array.isArray(laneClues?.modifierClues) ? laneClues.modifierClues : [];
  const premiumModifierClues = Array.isArray(laneClues?.premiumModifierClues)
    ? laneClues.premiumModifierClues
    : [];
  const playerFacingStrings = Array.isArray(laneClues?.playerFacingStrings)
    ? laneClues.playerFacingStrings
    : [];

  // Compatibility-only fallback: active UI reads should use DB-backed TokenShop mechanics when
  // they are present. This branch remains only for export/debug views or when DB-backed surfaces
  // are absent from the caller payload.
  return markLegacyTokenShopFallback(
    {
      hasOwnerFamilyClues:
        ownerFamilyClues.includes("SpaceAcademy") &&
        ownerFamilyClues.includes("SpaceAcademyMain") &&
        ownerFamilyClues.includes("TextHandlerSpaceAcademy") &&
        ownerFamilyClues.includes("FarmMissions"),
      hasModifierBoundary:
        modifierClues.includes("SetLM244BonusText") &&
        modifierClues.includes("BuyLM244") &&
        modifierClues.includes("FinalDailyTokenBonus") &&
        premiumModifierClues.includes("BuyCollectorDevice") &&
        premiumModifierClues.includes("CollectorCapBonus") &&
        premiumModifierClues.includes("CollectorMatsBonus"),
      hasPlayerFacingBoundary:
        playerFacingStrings.includes("0 / 2000 Daily Tokenium (from blue farm missions)") &&
        playerFacingStrings.includes(
          "This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)"
        ) &&
        playerFacingStrings.includes(
          "The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu"
        ),
      ownerFamilyLabel: "SpaceAcademy",
      missionFamilyLabel: "FarmMissions",
      academyController: "SpaceAcademyMain",
      textHandler: "TextHandlerSpaceAcademy",
      loopHook: "SetLM244BonusText",
      purchaseHook: "BuyLM244",
      purchaseOwner: "BuyCollectorDevice",
      premiumPack: "COLLECTERS PACK"
    },
    "legacy-daily-tokenium-lane"
  );
}

export function getTokenBankFormulaBoundarySummary(clues) {
  const contracts = normalizeTokenShopSubjectMetadata(clues);
  if (contracts.length) {
    const rowLocal =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "row-local" &&
          typeof contract?.groundedFields?.tokenBankFormula === "object" &&
          contract.groundedFields.tokenBankFormula
      ) ?? null;
    const rangeFamily =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "range-family" &&
          typeof contract?.groundedFields?.tokenBankFormula === "object" &&
          contract.groundedFields.tokenBankFormula
      ) ?? null;
    const formulaFields =
      rowLocal?.groundedFields?.tokenBankFormula ??
      rangeFamily?.groundedFields?.tokenBankFormula ??
      {};
    const blockedInputReason =
      (typeof rowLocal?.blockedInputReasons?.tokenBankFormula === "string" &&
        rowLocal.blockedInputReasons.tokenBankFormula) ||
      (typeof rangeFamily?.blockedInputReasons?.tokenBankFormula === "string" &&
        rangeFamily.blockedInputReasons.tokenBankFormula) ||
      (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
      (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
      null;

    const canUseContract =
      blockedInputReason === null &&
      typeof formulaFields.capAccessor === "string" &&
      typeof formulaFields.fillAccessor === "string" &&
      typeof formulaFields.capField === "string" &&
      typeof formulaFields.fillField === "string" &&
      formulaFields.saveFamilyOverlapClear === true;

    if (canUseContract) {
      return {
        hasDerivedOutputBoundary: true,
        hasNoSaveJoinInDerivedContext: true,
        coverageSource: getTokenShopDbCoverageSource(clues, contracts.length > 0),
        capAccessor: formulaFields.capAccessor || "get_FinalTokenBankCap",
        fillAccessor: formulaFields.fillAccessor || "get_FinalTokenBankFillSpeed",
        capField: formulaFields.capField || "<FinalTokenBankCap>k__BackingField",
        fillField: formulaFields.fillField || "<FinalTokenBankFillSpeed>k__BackingField",
        rowLocalSubjectId: rowLocal?.subjectId || null,
        rangeFamilySubjectId: rangeFamily?.subjectId || null,
        rowLocalSubjectKind: rowLocal?.subjectKind || null,
        rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
        blockedInputReason
      };
    }
  }
  const source = clues?.tokenBank?.formulaBoundary ?? clues;
  const derivedOutputCluster = Array.isArray(source?.derivedOutputCluster)
    ? source.derivedOutputCluster
    : [];
  const saveFamilyCluesInDerivedContext = Array.isArray(source?.saveFamilyCluesInDerivedContext)
    ? source.saveFamilyCluesInDerivedContext
    : [];

  // Required compatibility fallback: keep this path until tokenBankFormula contracts are both
  // present and unblocked. Blocked or incomplete formula contracts should fall back explicitly.
  return markLegacyTokenShopFallback(
    {
      hasDerivedOutputBoundary:
        derivedOutputCluster.includes("get_FinalTokenBankCap") &&
        derivedOutputCluster.includes("get_FinalTokenBankFillSpeed") &&
        derivedOutputCluster.includes("<FinalTokenBankCap>k__BackingField") &&
        derivedOutputCluster.includes("<FinalTokenBankFillSpeed>k__BackingField"),
      hasNoSaveJoinInDerivedContext: saveFamilyCluesInDerivedContext.length === 0,
      capAccessor: "get_FinalTokenBankCap",
      fillAccessor: "get_FinalTokenBankFillSpeed",
      capField: "<FinalTokenBankCap>k__BackingField",
      fillField: "<FinalTokenBankFillSpeed>k__BackingField"
    },
    "legacy-token-bank-formula"
  );
}

export function calculateTokenBankCap(tierUnlocks) {
  const baseCap = 2000;
  const tierBonus = 500;

  const tier2Unlocked = tierUnlocks?.tier2 === true;
  const tier3Unlocked = tierUnlocks?.tier3 === true;
  const tier4Unlocked = tierUnlocks?.tier4 === true;
  const tier5Unlocked = tierUnlocks?.tier5 === true;

  const tierCount = [tier2Unlocked, tier3Unlocked, tier4Unlocked, tier5Unlocked].filter(
    Boolean
  ).length;

  return baseCap + tierCount * tierBonus;
}

export function calculateDailyTokeniumCap(tierUnlocks, upgradeLevels = {}) {
  const baseCap = 2000;
  const perLevelBonus = 200;

  let totalCap = baseCap;

  if (tierUnlocks?.tier2) {
    totalCap += (upgradeLevels?.ATU14Level || 0) * perLevelBonus;
  }

  if (tierUnlocks?.tier3) {
    totalCap += (upgradeLevels?.ATU21Level || 0) * perLevelBonus;
  }

  return totalCap;
}

export function getMultiverseMarketRangeBoundarySummary(boundary, multiverseMarket = null) {
  const fallbackBoundary =
    boundary ??
    multiverseMarket?.rowIdentity?.compatibilityBoundaries?.rangeBoundary ??
    null;
  const genericBoundary = getMultiverseMarketGenericBoundarySummary(multiverseMarket);
  const validatedCoverage = getMultiverseMarketValidatedCoverage(
    multiverseMarket?.saveOwner?.extract ?? multiverseMarket
  );
  const validatedRowRanges = Array.isArray(fallbackBoundary?.validatedRowRanges)
    ? fallbackBoundary.validatedRowRanges
    : validatedCoverage.hasValidatedRows
      ? [validatedCoverage.rangeLabel]
      : [];
  const overlapIds = Array.isArray(fallbackBoundary?.overlapIds)
    ? fallbackBoundary.overlapIds
    : Array.isArray(genericBoundary?.factsByKind?.["ordered-overlap-row-id"])
      ? genericBoundary.factsByKind["ordered-overlap-row-id"]
      : [];
  const metadataIsRangeLabel =
    typeof fallbackBoundary?.metadataIsRangeLabel === "string"
      ? fallbackBoundary.metadataIsRangeLabel
      : String(genericBoundary?.factsByKind?.["typed-span"]?.[0] || "");

  return {
    hasRangeBoundary: validatedRowRanges.length > 0 && metadataIsRangeLabel.length > 0,
    hasValidatedRows: validatedRowRanges.length > 0,
    hasOverlap: overlapIds.length > 0,
    hasExplicitZeroOverlap:
      validatedRowRanges.length > 0 && metadataIsRangeLabel.length > 0 && overlapIds.length === 0,
    overlapLabel: formatNumericRanges(overlapIds),
    validatedRangeLabel: validatedRowRanges.join(" and "),
    metadataRangeLabel: metadataIsRangeLabel
  };
}

export function getMultiverseMarketRowTextCoverageSummary(coverage, multiverseMarket = null) {
  const genericSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-row-text"
  );
  const coverageSummary = getDbSystemCoverageSummary(multiverseMarket, {
    includeSubjectMetadata: false,
    subjectFilter: (subjectId) => subjectId === "family-graph:multiverse-market-row-text"
  });
  if (genericSummary) {
    const textHandlerAnchors = genericSummary.factsByKind?.["owner-anchor"] || [];
    const validatedRowCostTexts = genericSummary.factsByKind?.["cost-text-sample"] || [];
    const sampleBuyHooks = genericSummary.factsByKind?.["buy-hook-sample"] || [];
    const costTextRowIds = (genericSummary.factsByKind?.["cost-text-row-id"] || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const validatedCoverage = getMultiverseMarketValidatedCoverage(
      multiverseMarket?.saveOwner?.extract ?? multiverseMarket
    );
    const validatedIds = Array.isArray(multiverseMarket?.saveOwner?.extract?.source?.validated_ids)
      ? multiverseMarket.saveOwner.extract.source.validated_ids
      : [];
    const validatedTextIds = costTextRowIds.filter((value) => validatedIds.includes(value));
    return {
      hasValidatedTextCoverage:
        textHandlerAnchors.includes("TextHandlerMarkets") &&
        textHandlerAnchors.includes("SetAllChrystosEmporiumTexts") &&
        validatedTextIds.length > 0,
      hasBuyHookSamples: sampleBuyHooks.length > 0,
      coverageSource: coverageSummary.coverageSource,
      coveredCount: validatedRowCostTexts.length,
      validatedRangeLabel:
        validatedTextIds.length > 0
          ? formatNumericRanges(validatedTextIds)
          : validatedCoverage.rangeLabel || "",
      textHandler: "TextHandlerMarkets",
      textBatcher: "SetAllChrystosEmporiumTexts",
      firstBuyHook: sampleBuyHooks[0] || "",
      lastBuyHook: sampleBuyHooks[sampleBuyHooks.length - 1] || "",
      subjectCount: coverageSummary.subjectCount,
      genericFactCount: coverageSummary.genericFactCount,
      genericGapCount: coverageSummary.genericGapCount
    };
  }
  const fallbackCoverage =
    coverage ??
    multiverseMarket?.rowIdentity?.compatibilityBoundaries?.rowTextCoverage ??
    null;
  const textHandlerAnchors = Array.isArray(fallbackCoverage?.textHandlerAnchors)
    ? fallbackCoverage.textHandlerAnchors
    : [];
  const validatedRowCostTexts = Array.isArray(fallbackCoverage?.validatedRowCostTexts)
    ? fallbackCoverage.validatedRowCostTexts
    : [];
  const sampleBuyHooks = Array.isArray(fallbackCoverage?.sampleBuyHooks)
    ? fallbackCoverage.sampleBuyHooks
    : [];

  return {
    hasValidatedTextCoverage:
      textHandlerAnchors.includes("TextHandlerMarkets") &&
      textHandlerAnchors.includes("SetAllChrystosEmporiumTexts") &&
      validatedRowCostTexts.length === 22 &&
      validatedRowCostTexts.includes("SetIS50CostText") &&
      validatedRowCostTexts.includes("SetIS74CostText"),
    hasBuyHookSamples: sampleBuyHooks.includes("BuyIS50") && sampleBuyHooks.includes("BuyIS74"),
    coveredCount: validatedRowCostTexts.length,
    validatedRangeLabel: "50-59 and 63-74",
    textHandler: "TextHandlerMarkets",
    textBatcher: "SetAllChrystosEmporiumTexts",
    firstBuyHook: "BuyIS50",
    lastBuyHook: "BuyIS74"
  };
}

export function getMultiverseMarketActionShellSummary(shell, multiverseMarket = null) {
  const genericSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-action-shell"
  );
  const coverageSummary = getDbSystemCoverageSummary(multiverseMarket, {
    includeSubjectMetadata: false,
    subjectFilter: (subjectId) => subjectId === "family-graph:multiverse-market-action-shell"
  });
  if (genericSummary) {
    const textHandlerAnchors = genericSummary.factsByKind?.["owner-anchor"] || [];
    const validatedBuyHooks = genericSummary.factsByKind?.["buy-hook-sample"] || [];
    const validatedCostTexts = genericSummary.factsByKind?.["cost-text-sample"] || [];
    const buyHookRowIds = (genericSummary.factsByKind?.["buy-hook-row-id"] || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const costTextRowIds = (genericSummary.factsByKind?.["cost-text-row-id"] || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    return {
      hasActionShell:
        textHandlerAnchors.includes("TextHandlerMarkets") &&
        textHandlerAnchors.includes("SetAllChrystosEmporiumTexts") &&
        buyHookRowIds.length > 0 &&
        costTextRowIds.length > 0,
      coverageSource: coverageSummary.coverageSource,
      buyRangeLabel: buyHookRowIds.length ? `BuyIS${formatNumericRanges(buyHookRowIds)}` : "",
      costTextRangeLabel: costTextRowIds.length
        ? `SetIS${formatNumericRanges(costTextRowIds)}CostText`
        : "",
      validatedRangeLabel: buyHookRowIds.length ? formatNumericRanges(buyHookRowIds) : "",
      subjectCount: coverageSummary.subjectCount,
      genericFactCount: coverageSummary.genericFactCount,
      genericGapCount: coverageSummary.genericGapCount,
      firstBuyHook: validatedBuyHooks[0] || "",
      lastBuyHook: validatedBuyHooks[validatedBuyHooks.length - 1] || "",
      coveredCount: validatedCostTexts.length
    };
  }
  const fallbackShell =
    shell ??
    multiverseMarket?.uiShell?.compatibilityBoundaries?.actionShell ??
    null;
  const textHandlerAnchors = Array.isArray(fallbackShell?.textHandlerAnchors)
    ? fallbackShell.textHandlerAnchors
    : [];
  const validatedBuyHookRanges = Array.isArray(fallbackShell?.validatedBuyHookRanges)
    ? fallbackShell.validatedBuyHookRanges
    : [];
  const validatedBuyHooks = Array.isArray(fallbackShell?.validatedBuyHooks)
    ? fallbackShell.validatedBuyHooks
    : [];
  const validatedCostTexts = Array.isArray(fallbackShell?.validatedCostTexts)
    ? fallbackShell.validatedCostTexts
    : [];
  const buyRange = fallbackShell?.contextDerivedBuyHookRange ?? {};
  const costTextRange = fallbackShell?.contextDerivedCostTextRange ?? {};

  return {
    hasActionShell:
      textHandlerAnchors.includes("TextHandlerMarkets") &&
      textHandlerAnchors.includes("SetAllChrystosEmporiumTexts") &&
      buyRange.start === 1 &&
      buyRange.end === 110 &&
      buyRange.count === 110 &&
      costTextRange.start === 1 &&
      costTextRange.end === 110 &&
      costTextRange.count === 110 &&
      validatedBuyHookRanges.join(" and ") === "50-59 and 63-74" &&
      validatedBuyHooks.length === 22 &&
      validatedCostTexts.length === 22,
    buyRangeLabel: "BuyIS1-110",
    costTextRangeLabel: "SetIS1-110CostText",
    validatedRangeLabel: validatedBuyHookRanges.join(" and ") || "50-59 and 63-74"
  };
}

export function getMultiverseMarketPrefabRemapBoundarySummary(boundary, multiverseMarket = null) {
  const genericSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-prefab-remap"
  );
  const coverageSummary = getDbSystemCoverageSummary(multiverseMarket, {
    includeSubjectMetadata: false,
    subjectFilter: (subjectId) => subjectId === "family-graph:multiverse-market-prefab-remap"
  });
  if (genericSummary) {
    const prefabRowIds = (genericSummary.factsByKind?.["prefab-row-id"] || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const serializedIds = (genericSummary.factsByKind?.["serialized-id-row-id"] || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const prefabSamples = genericSummary.factsByKind?.["prefab-sample"] || [];
    const overridePairs = genericSummary.factsByKind?.["prefab-override-pair"] || [];
    return {
      hasDirectMatchBand: false,
      hasOverrideBoundary: prefabRowIds.length > 0 && serializedIds.length > 0,
      coverageSource: coverageSummary.coverageSource,
      lastDirectPrefab: "",
      firstOverride: prefabSamples[0] || "",
      lastOverride: prefabSamples[prefabSamples.length - 1] || "",
      validatedMismatchLabel: prefabRowIds.length ? formatNumericRanges(prefabRowIds) : "",
      firstSerializedId: serializedIds.length ? `ID${serializedIds[0]}` : "",
      lastSerializedId: serializedIds.length ? `ID${serializedIds[serializedIds.length - 1]}` : "",
      overridePairs,
      subjectCount: coverageSummary.subjectCount,
      genericFactCount: coverageSummary.genericFactCount,
      genericGapCount: coverageSummary.genericGapCount
    };
  }
  const fallbackBoundary =
    boundary ??
    multiverseMarket?.rowIdentity?.compatibilityBoundaries?.prefabRemapBoundary ??
    null;
  const directPrefabNumberMatches = Array.isArray(fallbackBoundary?.directPrefabNumberMatches)
    ? fallbackBoundary.directPrefabNumberMatches
    : [];
  const explicitPrefabIdOverrides = Array.isArray(fallbackBoundary?.explicitPrefabIdOverrides)
    ? fallbackBoundary.explicitPrefabIdOverrides
    : [];
  const validatedIdsWithoutDirectPrefabName = Array.isArray(
    fallbackBoundary?.validatedIdsWithoutDirectPrefabName
  )
    ? fallbackBoundary.validatedIdsWithoutDirectPrefabName
    : [];

  return {
    hasDirectMatchBand:
      directPrefabNumberMatches.includes(50) && directPrefabNumberMatches.includes(68),
    hasOverrideBoundary:
      explicitPrefabIdOverrides
        .map((entry) => `${entry.prefabNumber}->${entry.serializedId}`)
        .join(",") === "69->57,70->58,71->59,72->60,73->61,74->62" &&
      validatedIdsWithoutDirectPrefabName.join(",") === "69,70,71,72,73,74",
    lastDirectPrefab: "ChrystosEmporiumUpgrade68",
    firstOverride: "ChrystosEmporiumUpgrade69-ID57",
    lastOverride: "ChrystosEmporiumUpgrade74-ID62",
    validatedMismatchLabel: "69-74"
  };
}

export function getMultiverseMarketOwnerFamilySummary(family, multiverseMarket = null) {
  const genericSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-owner-family"
  );
  const coverageSummary = getDbSystemCoverageSummary(multiverseMarket, {
    includeSubjectMetadata: false,
    subjectFilter: (subjectId) => subjectId === "family-graph:multiverse-market-owner-family"
  });
  if (genericSummary) {
    const ownerAnchors = genericSummary.factsByKind?.["owner-anchor"] || [];
    const resourceAnchors = genericSummary.factsByKind?.["resource-anchor"] || [];
    const wrapperField = String(
      genericSummary.factsByKind?.["wrapper-only-field-label"]?.[0] || "InscryptionsDone"
    );
    return {
      hasOwnerFamily:
        ownerAnchors.includes("MultiverseMarket") &&
        ownerAnchors.includes("TextHandlerMarkets") &&
        ownerAnchors.includes("SetAllChrystosEmporiumTexts"),
      hasCurrencyShell: false,
      coverageSource: coverageSummary.coverageSource,
      ownerAnchor: "MultiverseMarket",
      inscryptionsLabel: wrapperField,
      textHandler: "TextHandlerMarkets",
      batcher: "SetAllChrystosEmporiumTexts",
      resourceText: resourceAnchors[0] || "ResourceAmountText",
      achievementBar: "",
      costBox: "",
      currencyRangeLabel: "",
      firstValidatedCurrencyBox: "",
      lastValidatedCurrencyBox: "",
      subjectCount: coverageSummary.subjectCount,
      genericFactCount: coverageSummary.genericFactCount,
      genericGapCount: coverageSummary.genericGapCount
    };
  }
  const fallbackFamily =
    family ??
    multiverseMarket?.uiShell?.compatibilityBoundaries?.ownerFamily ??
    null;
  const ownerAnchors = Array.isArray(fallbackFamily?.ownerAnchors) ? fallbackFamily.ownerAnchors : [];
  const costLaneAnchors = Array.isArray(fallbackFamily?.costLaneAnchors)
    ? fallbackFamily.costLaneAnchors
    : [];
  const validatedCurrencyBoxes = Array.isArray(fallbackFamily?.validatedCurrencyBoxes)
    ? fallbackFamily.validatedCurrencyBoxes
    : [];
  const sampleBuyHooks = Array.isArray(fallbackFamily?.sampleBuyHooks) ? fallbackFamily.sampleBuyHooks : [];
  const currencyBoxRange =
    typeof fallbackFamily?.currencyBoxRange === "object" && fallbackFamily.currencyBoxRange
      ? fallbackFamily.currencyBoxRange
      : {};

  return {
    hasOwnerFamily:
      ownerAnchors.includes("MultiverseMarket, Assembly-CSharp") &&
      ownerAnchors.includes("TextHandlerMarkets") &&
      ownerAnchors.includes("SetAllChrystosEmporiumTexts") &&
      ownerAnchors.includes("SetInscryptionsDoneText") &&
      ownerAnchors.includes("Inscryptions") &&
      costLaneAnchors.includes("ResourceAmountText.InscryptionsDone") &&
      costLaneAnchors.includes("AchievementBar-Inscryptions") &&
      costLaneAnchors.includes("CostBox-InscryptionsDone") &&
      currencyBoxRange.start === 1 &&
      currencyBoxRange.end === 110 &&
      currencyBoxRange.count === 110 &&
      sampleBuyHooks.includes("BuyIS64") &&
      sampleBuyHooks.includes("BuyIS105"),
    hasCurrencyShell:
      validatedCurrencyBoxes.includes("IS50CurrencyBox") &&
      validatedCurrencyBoxes.includes("IS74CurrencyBox"),
    ownerAnchor: "MultiverseMarket",
    inscryptionsLabel: "Inscryptions",
    textHandler: "TextHandlerMarkets",
    batcher: "SetAllChrystosEmporiumTexts",
    resourceText: "ResourceAmountText.InscryptionsDone",
    achievementBar: "AchievementBar-Inscryptions",
    costBox: "CostBox-InscryptionsDone",
    currencyRangeLabel: "IS1-110 CurrencyBox shell",
    firstValidatedCurrencyBox: "IS50CurrencyBox",
    lastValidatedCurrencyBox: "IS74CurrencyBox"
  };
}

export function getTokenShopOwnerShellSummary(shell) {
  const genericSummary = getTokenShopGenericOwnerShellSummary(
    getTokenShopDbGenericScopes(shell)
  );
  const contracts = normalizeTokenShopSubjectMetadata(shell);
  if (genericSummary) {
    return genericSummary;
  }
  if (contracts.length) {
    const rowLocal = contracts.find((contract) => contract?.subjectKind === "row-local") ?? null;
    const rangeFamily =
      contracts.find((contract) => contract?.subjectKind === "range-family") ?? null;
    const rowLocalActionMethods = Array.isArray(rowLocal?.groundedFields?.actionMethods)
      ? rowLocal.groundedFields.actionMethods
      : [];
    const rowLocalKnownEdges = Array.isArray(rowLocal?.knownEdges) ? rowLocal.knownEdges : [];
    const rangeKnownEdges = Array.isArray(rangeFamily?.knownEdges) ? rangeFamily.knownEdges : [];
    const rangeBlockedEdges = Array.isArray(rangeFamily?.blockedEdges)
      ? rangeFamily.blockedEdges
      : [];

    const blockedInputReason =
      (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
      (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
      null;
    const canUseContract =
      blockedInputReason === null &&
      Boolean(rowLocal?.subjectId) &&
      rowLocalKnownEdges.includes("exact-shell-to-action-hook") &&
      Boolean(rangeFamily?.subjectId);

    if (canUseContract) {
      return {
        hasOwnerShell: true,
        coverageSource: getTokenShopDbCoverageSource(shell, contracts.length > 0),
        ownerAnchor: rowLocal?.subjectId || "row-local subject",
        bankMethod: rowLocalActionMethods[0] || "action-method-unavailable",
        notificationHook: rowLocal?.nextSeam?.id || "next-seam-unavailable",
        deviceHook: rangeFamily?.subjectId || "range-family subject",
        rowLocalSubjectId: rowLocal?.subjectId || null,
        rangeFamilySubjectId: rangeFamily?.subjectId || null,
        rowLocalSubjectKind: rowLocal?.subjectKind || null,
        rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
        rowLocalKnownEdges,
        rangeKnownEdges,
        rangeBlockedEdges,
        blockedInputReason
      };
    }
  }

  const ownerAnchors = Array.isArray(shell?.ownerAnchors) ? shell.ownerAnchors : [];
  const tokenBankMethods = Array.isArray(shell?.tokenBankMethods) ? shell.tokenBankMethods : [];
  const notificationHooks = Array.isArray(shell?.notificationHooks) ? shell.notificationHooks : [];
  const adjacentDeviceHooks = Array.isArray(shell?.adjacentDeviceHooks)
    ? shell.adjacentDeviceHooks
    : [];

  // Required compatibility fallback: keep this path until owner-shell contracts are present and
  // unblocked for both the row-local and range-family subjects used by the summary.
  return markLegacyTokenShopFallback(
    {
      hasOwnerShell:
        ownerAnchors.includes("TokenShop") &&
        ownerAnchors.includes("InitializeTokenShop") &&
        tokenBankMethods.includes("ClaimBankedTokens") &&
        notificationHooks.includes("CheckTokenClaimNotification") &&
        adjacentDeviceHooks.includes("BuyAutoTokenClicker"),
      ownerAnchor: "TokenShop",
      bankMethod: "ClaimBankedTokens",
      notificationHook: "CheckTokenClaimNotification",
      deviceHook: "BuyAutoTokenClicker"
    },
    "legacy-owner-shell"
  );
}

export function getTokenShopSaveBoundarySummary(boundary) {
  const genericSummary = getTokenShopGenericSaveBoundarySummary(
    getTokenShopDbGenericScopes(boundary)
  );
  const contracts = normalizeTokenShopSubjectMetadata(boundary);
  if (genericSummary) {
    return genericSummary;
  }
  if (contracts.length) {
    const rowLocal = contracts.find((contract) => contract?.subjectKind === "row-local") ?? null;
    const rangeFamily =
      contracts.find((contract) => contract?.subjectKind === "range-family") ?? null;
    const blockedInputReason =
      (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
      (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
      null;

    const canUseContract =
      Boolean(rowLocal?.subjectId) &&
      Boolean(rangeFamily?.subjectId) &&
      typeof blockedInputReason === "string" &&
      blockedInputReason.length > 0;

    if (canUseContract) {
      return {
        hasSeparationBoundary: true,
        coverageSource: getTokenShopDbCoverageSource(boundary, contracts.length > 0),
        ownerAnchor: rowLocal?.subjectId || "row-local subject",
        saveAnchor: rangeFamily?.subjectId || "range-family subject",
        overlapLabel: "db-backed subject-state separation",
        rowLocalSubjectId: rowLocal?.subjectId || null,
        rangeFamilySubjectId: rangeFamily?.subjectId || null,
        rowLocalSubjectKind: rowLocal?.subjectKind || null,
        rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
        rowLocalBlockedEdges: Array.isArray(rowLocal?.blockedEdges) ? rowLocal.blockedEdges : [],
        rangeFamilyBlockedEdges: Array.isArray(rangeFamily?.blockedEdges)
          ? rangeFamily.blockedEdges
          : [],
        blockedInputReason
      };
    }
  }

  const ownerShellTermsChecked = Array.isArray(boundary?.ownerShellTermsChecked)
    ? boundary.ownerShellTermsChecked
    : [];
  const saveFamilyTermsChecked = Array.isArray(boundary?.saveFamilyTermsChecked)
    ? boundary.saveFamilyTermsChecked
    : [];
  const boundaryEvidence =
    typeof boundary?.boundaryEvidence === "object" && boundary.boundaryEvidence
      ? boundary.boundaryEvidence
      : {};

  // Compatibility-only fallback: active UI reads should use DB-backed TokenShop mechanics when
  // they are present. This branch remains only for export/debug views or when DB-backed surfaces
  // are absent from the caller payload.
  return markLegacyTokenShopFallback(
    {
      hasSeparationBoundary:
        ownerShellTermsChecked.includes("TokenShop") &&
        saveFamilyTermsChecked.includes("PlayerProfileData") &&
        boundaryEvidence.metadataHasSaveTerms === true &&
        boundaryEvidence.level0HasSaveTerms === false &&
        boundaryEvidence.ownerShellWithSaveOverlapCount === 0 &&
        boundaryEvidence.directTokenShopPlayerProfileContext === false,
      ownerAnchor: "TokenShop",
      saveAnchor: "PlayerProfileData",
      overlapLabel: "zero overlap"
    },
    "legacy-save-boundary"
  );
}

export function getTokenBankControllerShellSummary(shell) {
  const genericSummary = getTokenShopGenericTokenBankControllerShellSummary(
    getTokenShopDbGenericScopes(shell)
  );
  const contracts = normalizeTokenShopSubjectMetadata(shell);
  if (genericSummary) {
    return genericSummary;
  }
  if (contracts.length) {
    const rowLocal =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "row-local" &&
          typeof contract?.groundedFields?.tokenBankController === "object" &&
          contract.groundedFields.tokenBankController
      ) ?? null;
    const rangeFamily =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "range-family" &&
          typeof contract?.groundedFields?.tokenBankController === "object" &&
          contract.groundedFields.tokenBankController
      ) ?? null;
    const controllerFields =
      rowLocal?.groundedFields?.tokenBankController ??
      rangeFamily?.groundedFields?.tokenBankController ??
      {};
    const adjacentTerms = Array.isArray(controllerFields?.adjacentTerms)
      ? controllerFields.adjacentTerms
      : [];
    const blockedInputReason =
      (typeof rowLocal?.blockedInputReasons?.tokenBankController === "string" &&
        rowLocal.blockedInputReasons.tokenBankController) ||
      (typeof rangeFamily?.blockedInputReasons?.tokenBankController === "string" &&
        rangeFamily.blockedInputReasons.tokenBankController) ||
      (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
      (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
      null;

    const canUseContract =
      blockedInputReason === null &&
      typeof controllerFields.claimMethod === "string" &&
      typeof controllerFields.fillMethod === "string" &&
      typeof controllerFields.fillField === "string" &&
      typeof controllerFields.descriptionShell === "string" &&
      typeof controllerFields.notificationHook === "string" &&
      adjacentTerms.includes("get_TokenBankCap") &&
      adjacentTerms.includes("get_ClaimableBankTokens") &&
      adjacentTerms.includes("IncreaseBankedTokens");

    if (canUseContract) {
      return {
        hasControllerShell: true,
        coverageSource: getTokenShopDbCoverageSource(shell, contracts.length > 0),
        claimMethod: controllerFields.claimMethod || "ClaimBankedTokens",
        fillMethod: controllerFields.fillMethod || "SetBankFill",
        fillField: controllerFields.fillField || "BankFill",
        descriptionShell: controllerFields.descriptionShell || "TokenBankDescriptionText",
        notificationHook: controllerFields.notificationHook || "CheckTokenClaimNotification",
        rowLocalSubjectId: rowLocal?.subjectId || null,
        rangeFamilySubjectId: rangeFamily?.subjectId || null,
        rowLocalSubjectKind: rowLocal?.subjectKind || null,
        rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
        adjacentTerms,
        blockedInputReason
      };
    }
  }

  const controllerAnchors = Array.isArray(shell?.controllerAnchors) ? shell.controllerAnchors : [];
  const adjacentControllerMethods = Array.isArray(shell?.adjacentControllerMethods)
    ? shell.adjacentControllerMethods
    : [];

  // Required compatibility fallback: keep this path until tokenBankController contracts are both
  // present and unblocked. Blocked or incomplete controller contracts should fall back explicitly.
  return markLegacyTokenShopFallback(
    {
      hasControllerShell:
        controllerAnchors.includes("ClaimBankedTokens") &&
        controllerAnchors.includes("SetBankFill") &&
        controllerAnchors.includes("BankFill") &&
        controllerAnchors.includes("TokenBankDescriptionText") &&
        controllerAnchors.includes("CheckTokenClaimNotification") &&
        controllerAnchors.includes("TokenShopButtonNotification") &&
        adjacentControllerMethods.includes("get_TokenBankCap") &&
        adjacentControllerMethods.includes("get_ClaimableBankTokens") &&
        adjacentControllerMethods.includes("IncreaseBankedTokens"),
      claimMethod: "ClaimBankedTokens",
      fillMethod: "SetBankFill",
      fillField: "BankFill",
      descriptionShell: "TokenBankDescriptionText",
      notificationHook: "CheckTokenClaimNotification"
    },
    "legacy-token-bank-controller"
  );
}

export function getMultiverseMarketSaveBoundarySummary(boundary) {
  const compatibilityBoundary =
    boundary?.saveOwner?.compatibilityBoundaries?.saveBoundary ??
    boundary?.saveOwner?.saveBoundary ??
    boundary;
  const genericBoundary = getMultiverseMarketGenericBoundarySummary(boundary);
  const inferredBoundary =
    getDbSystemBoundaryEntry(boundary, "multiverse-market-save-owner-boundary", "subject-boundary") ||
    getDbSystemBoundaryEntry(boundary, "family-graph:multiverse-market-save-owner", "subject-boundary");
  const saveOwnerMetadata =
    getDbSystemSubjectMetadataEntry(boundary, "multiverse-market-save-owner-boundary") ||
    getDbSystemSubjectMetadataEntry(boundary, "family-graph:multiverse-market-save-owner");
  const useMetadataFallback = !inferredBoundary && !genericBoundary && Boolean(saveOwnerMetadata);
  if (inferredBoundary || genericBoundary || useMetadataFallback) {
    const knownEdges = Array.isArray(inferredBoundary?.knownEdges)
      ? inferredBoundary.knownEdges
      : useMetadataFallback && Array.isArray(saveOwnerMetadata?.knownEdges)
        ? saveOwnerMetadata.knownEdges
        : [];
    const missingEdges = Array.isArray(inferredBoundary?.missingEdges)
      ? inferredBoundary.missingEdges
      : useMetadataFallback && Array.isArray(saveOwnerMetadata?.missingEdges)
        ? saveOwnerMetadata.missingEdges
        : [];
    const actionAnchor = String(
      genericBoundary?.factsByKind?.["accessor-bridge"]?.[0] || "get_Market"
    ).trim();
    const saveAnchor = String(
      genericBoundary?.factsByKind?.["save-owner"]?.[0] || "SaveData"
    ).trim();
    const typedSpanLabel = String(
      genericBoundary?.factsByKind?.["typed-span"]?.[0] || ""
    ).trim();
    return {
      hasSeparationBoundary:
        knownEdges.includes("accessor-bridge") && knownEdges.includes("typed-save-owner"),
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericBoundary),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: useMetadataFallback
      }),
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      actionAnchor,
      saveAnchor,
      typedSpanLabel: typedSpanLabel || null,
      overlapLabel: knownEdges.includes("ordered-row-overlap")
        ? "ordered overlap only"
        : "overlap-unavailable",
      subjectId: inferredBoundary?.subjectId || (useMetadataFallback ? saveOwnerMetadata?.subjectId : null) || null,
      subjectKind:
        inferredBoundary?.subjectKind || (useMetadataFallback ? saveOwnerMetadata?.subjectKind : null) || null,
      knownEdges,
      missingEdges,
      blockedInputReason:
        typeof inferredBoundary?.blockedInputReason === "string"
          ? inferredBoundary.blockedInputReason
          : useMetadataFallback && typeof saveOwnerMetadata?.blockedInputReason === "string"
          ? saveOwnerMetadata.blockedInputReason
          : null,
      nextSeamId:
        (typeof inferredBoundary?.nextSeamId === "string"
          ? inferredBoundary.nextSeamId
          : useMetadataFallback && typeof saveOwnerMetadata?.nextSeam?.id === "string"
          ? saveOwnerMetadata.nextSeam.id
          : null) ||
        genericBoundary?.nextSeamIds?.[0] ||
        null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericBoundary?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericBoundary?.gapCount || 0
    };
  }
  const actionShellTermsChecked = Array.isArray(compatibilityBoundary?.actionShellTermsChecked)
    ? compatibilityBoundary.actionShellTermsChecked
    : [];
  const saveFamilyTermsChecked = Array.isArray(compatibilityBoundary?.saveFamilyTermsChecked)
    ? compatibilityBoundary.saveFamilyTermsChecked
    : [];
  const boundaryEvidence =
    typeof compatibilityBoundary?.boundaryEvidence === "object" && compatibilityBoundary.boundaryEvidence
      ? compatibilityBoundary.boundaryEvidence
      : {};

  return {
    hasSeparationBoundary:
      actionShellTermsChecked.includes("TextHandlerMarkets") &&
      saveFamilyTermsChecked.includes("PlayerProfileData") &&
      boundaryEvidence.actionShellWithSaveOverlapCount === 0 &&
      boundaryEvidence.metadataNeighborhoodHasActionTerms === true &&
      boundaryEvidence.metadataNeighborhoodHasSaveTerms === true &&
      boundaryEvidence.metadataDirectCheckHasSaveTerms === false &&
      boundaryEvidence.level0DirectCheckHasSaveTerms === false,
    actionAnchor: "TextHandlerMarkets",
    saveAnchor: "PlayerProfileData",
    overlapLabel: "zero overlap"
  };
}

export function getMultiverseMarketMarketMemberBoundarySummary(boundary) {
  const compatibilityBoundary =
    boundary?.saveOwner?.compatibilityBoundaries?.marketMemberBoundary ??
    boundary?.saveOwner?.marketMemberBoundary ??
    boundary;
  const genericBoundary = getMultiverseMarketGenericBoundarySummary(boundary);
  const inferredBoundary =
    getDbSystemBoundaryEntry(boundary, "multiverse-market-save-owner-boundary", "subject-boundary") ||
    getDbSystemBoundaryEntry(boundary, "family-graph:multiverse-market-save-owner", "subject-boundary");
  const saveOwnerMetadata =
    getDbSystemSubjectMetadataEntry(boundary, "multiverse-market-save-owner-boundary") ||
    getDbSystemSubjectMetadataEntry(boundary, "family-graph:multiverse-market-save-owner");
  const typedOwnerSummary = getMultiverseMarketTypedOwnerSummary(boundary);
  const useMetadataFallback = !inferredBoundary && !genericBoundary && Boolean(saveOwnerMetadata);
  if (inferredBoundary || genericBoundary || useMetadataFallback) {
    const knownEdges = Array.isArray(inferredBoundary?.knownEdges)
      ? inferredBoundary.knownEdges
      : useMetadataFallback && Array.isArray(saveOwnerMetadata?.knownEdges)
        ? saveOwnerMetadata.knownEdges
        : [];
    const missingEdges = Array.isArray(inferredBoundary?.missingEdges)
      ? inferredBoundary.missingEdges
      : useMetadataFallback && Array.isArray(saveOwnerMetadata?.missingEdges)
        ? saveOwnerMetadata.missingEdges
        : [];
    const accessorLabel = String(
      genericBoundary?.factsByKind?.["accessor-bridge"]?.[0] || "get_Market"
    ).trim();
    const exactSaveOwnerLabel = String(
      genericBoundary?.factsByKind?.["save-owner"]?.[0] || "SaveData"
    ).trim();
    const compatibilityImportTargetPath = String(
      genericBoundary?.factsByKind?.["compatibility-import-target-path"]?.[0] || ""
    ).trim();
    return {
      coverageSource: composeDbCoverageSource({
        hasGenericMechanics: Boolean(genericBoundary),
        hasBoundaryModel: Boolean(inferredBoundary),
        hasSubjectMetadata: useMetadataFallback
      }),
      boundaryVerdict: String(inferredBoundary?.verdict || "").trim() || null,
      hasSiblingAccessorCluster: knownEdges.includes("accessor-bridge"),
      favorsPlayerProfileMemberHost:
        knownEdges.includes("accessor-bridge") && knownEdges.includes("typed-save-owner"),
      favorsDirectMemberBoundary:
        knownEdges.includes("typed-save-owner") && knownEdges.includes("ordered-row-overlap"),
      hasCloudBridge:
        knownEdges.includes("compatibility-import-span") || Boolean(compatibilityImportTargetPath),
      hasExactSaveDataProgressionOwner: knownEdges.includes("typed-save-owner"),
      accessorLabel,
      memberLabel: "Market",
      canonicalHostLabel: `${accessorLabel} accessor bridge`,
      siblingAccessorLabel: "the adjacent PlayerProfile-side accessor cluster",
      exactSaveOwnerLabel,
      compatibilityImportTargetPath: compatibilityImportTargetPath || null,
      negativeMultiverseFieldLabel:
        typedOwnerSummary.coverageSource !== "compatibility-boundary-export"
          ? typedOwnerSummary.negativeTypedOwnerLabel
          : missingEdges.includes("typed-market-field-recovery")
          ? "typed-market-field-recovery remains open"
          : "typed market field recovery status unavailable",
      subjectId: inferredBoundary?.subjectId || (useMetadataFallback ? saveOwnerMetadata?.subjectId : null) || null,
      subjectKind:
        inferredBoundary?.subjectKind || (useMetadataFallback ? saveOwnerMetadata?.subjectKind : null) || null,
      knownEdges,
      missingEdges,
      blockedInputReason:
        typeof inferredBoundary?.blockedInputReason === "string"
          ? inferredBoundary.blockedInputReason
          : useMetadataFallback && typeof saveOwnerMetadata?.blockedInputReason === "string"
          ? saveOwnerMetadata.blockedInputReason
          : null,
      nextSeamId:
        typedOwnerSummary.nextSeamId ||
        (typeof inferredBoundary?.nextSeamId === "string"
          ? inferredBoundary.nextSeamId
          : useMetadataFallback && typeof saveOwnerMetadata?.nextSeam?.id === "string"
          ? saveOwnerMetadata.nextSeam.id
          : null) ||
        genericBoundary?.nextSeamIds?.[0] ||
        null,
      genericFactCount:
        Number(inferredBoundary?.genericFactCount || 0) || genericBoundary?.factCount || 0,
      genericGapCount:
        Number(inferredBoundary?.genericGapCount || 0) || genericBoundary?.gapCount || 0
    };
  }
  const accessorClues = Array.isArray(compatibilityBoundary?.playerProfileAccessorClues)
    ? compatibilityBoundary.playerProfileAccessorClues
    : [];
  const memberShellClues = Array.isArray(compatibilityBoundary?.playerProfileMemberShellClues)
    ? compatibilityBoundary.playerProfileMemberShellClues
    : [];
  const handlerBridgeClues = Array.isArray(compatibilityBoundary?.playerProfileHandlerBridgeClues)
    ? compatibilityBoundary.playerProfileHandlerBridgeClues
    : [];
  const directMemberHandoffClues = Array.isArray(compatibilityBoundary?.directMemberHandoffClues)
    ? compatibilityBoundary.directMemberHandoffClues
    : [];
  const typedSiblingContrastClues = Array.isArray(compatibilityBoundary?.typedSiblingContrastClues)
    ? compatibilityBoundary.typedSiblingContrastClues
    : [];
  const progressionPayloadFieldClues = Array.isArray(compatibilityBoundary?.progressionPayloadFieldClues)
    ? compatibilityBoundary.progressionPayloadFieldClues
    : [];
  const cloudSaveBridgeClues = Array.isArray(compatibilityBoundary?.cloudSaveBridgeClues)
    ? compatibilityBoundary.cloudSaveBridgeClues
    : [];
  const missingDirectTypeMapClues = Array.isArray(compatibilityBoundary?.missingDirectTypeMapClues)
    ? compatibilityBoundary.missingDirectTypeMapClues
    : [];
  const negativeTypedDirectPlayerProfileProgressionChecks = Array.isArray(
    compatibilityBoundary?.negativeTypedDirectPlayerProfileProgressionChecks
  )
    ? compatibilityBoundary.negativeTypedDirectPlayerProfileProgressionChecks
    : [];
  const negativeTypedDirectMemberChecks = Array.isArray(compatibilityBoundary?.negativeTypedDirectMemberChecks)
    ? compatibilityBoundary.negativeTypedDirectMemberChecks
    : [];
  const negativeTypedSaveDataMarketChecks = Array.isArray(
    compatibilityBoundary?.negativeTypedSaveDataMarketChecks
  )
    ? compatibilityBoundary.negativeTypedSaveDataMarketChecks
    : [];
  const typedBridgeRecovery =
    typeof compatibilityBoundary?.typedBridgeRecovery === "object" && compatibilityBoundary.typedBridgeRecovery
      ? compatibilityBoundary.typedBridgeRecovery
      : {};
  const typedHandlerFieldRecovery =
    typeof compatibilityBoundary?.typedHandlerFieldRecovery === "object" && compatibilityBoundary.typedHandlerFieldRecovery
      ? compatibilityBoundary.typedHandlerFieldRecovery
      : {};
  const typedPlayerProfileFieldTableRecovery =
    typeof compatibilityBoundary?.typedPlayerProfileFieldTableRecovery === "object" &&
    compatibilityBoundary?.typedPlayerProfileFieldTableRecovery
      ? compatibilityBoundary.typedPlayerProfileFieldTableRecovery
      : {};
  const typedSaveDataFieldTableRecovery =
    typeof compatibilityBoundary?.typedSaveDataFieldTableRecovery === "object" &&
    compatibilityBoundary?.typedSaveDataFieldTableRecovery
      ? compatibilityBoundary.typedSaveDataFieldTableRecovery
      : {};
  const typedSaveDataProgressionOwnerSamples = Array.isArray(
    compatibilityBoundary?.typedSaveDataProgressionOwnerSamples
  )
    ? compatibilityBoundary.typedSaveDataProgressionOwnerSamples
    : [];
  const siblingAccessorClues = [
    "get_Market",
    "get_BM",
    "get_ZN",
    "get_TU",
    "get_Relics",
    "get_CellData",
    "get_ModPointData",
    "get_ShardData",
    "get_ResearchPointData",
    "get_AcademyPointData"
  ];
  const siblingMemberShellClues = [
    "Market",
    "Relics",
    "CellData",
    "ModPointData",
    "ShardData",
    "ResearchPointData",
    "AcademyPointData"
  ];
  const handlerBridgeRequirement = [
    "PlayerProfileHandler",
    "playerData",
    "GetPlayerProfileData",
    "FillPlayerProfileData",
    "ConvertSaveDataToProfileData"
  ];
  const directMemberHandoffRequirement = [
    "get_Market",
    "Market",
    "GetPlayerProfileData",
    "FillPlayerProfileData",
    "<FillPlayerProfileData>d__45"
  ];
  const typedSiblingContrastRequirement = [
    "PlayerProfileData|GemData",
    "PlayerProfileData|GemNodeCombo"
  ];
  const payloadFieldRequirement = [
    "InscryptionsDone",
    "EsotericR1Trades",
    "NecrumR1Trades",
    "Mech1Unlocked"
  ];
  const negativeTypedMarketRequirement = [
    "PlayerProfileHandler.Market",
    "PlayerProfileData.Market",
    "PlayerProfileData.MultiverseMarket"
  ];
  const negativeTypedPlayerProfileProgressionRequirement = [
    "PlayerProfileData.IS71Level",
    "PlayerProfileData.IS110Level",
    "PlayerProfileData.EsotericR1Trades",
    "PlayerProfileData.NecrumR1Trades",
    "PlayerProfileData.Mech1Unlocked",
    "PlayerProfileData.Mech1MissionsCompleted"
  ];
  const negativeDirectMultiverseRequirement = [
    "MultiverseMarket.InscryptionsDone",
    "MultiverseMarket.IS71Level",
    "MultiverseMarket.IS110Level",
    "MultiverseMarket.EsotericR1Trades",
    "MultiverseMarket.NecrumR1Trades",
    "MultiverseMarket.Mech1Unlocked",
    "MultiverseMarket.Mech1MissionsCompleted"
  ];
  const preservedSiblingAccessorCount = siblingAccessorClues.filter((name) =>
    accessorClues.includes(name)
  ).length;
  const preservedSiblingMemberCount = siblingMemberShellClues.filter((name) =>
    memberShellClues.includes(name)
  ).length;

  return {
    hasBoundary:
      accessorClues.includes("get_Market") &&
      memberShellClues.includes("Market") &&
      memberShellClues.includes("ShardData") &&
      memberShellClues.includes("ResearchPointData"),
    hasCloudBridge:
      cloudSaveBridgeClues.includes("CloudSavePlayerProfile") &&
      cloudSaveBridgeClues.includes("GetPlayerProfileInfo") &&
      cloudSaveBridgeClues.includes("CloudLoad"),
    hasHandlerBridge: handlerBridgeRequirement.every((name) => handlerBridgeClues.includes(name)),
    hasDirectMemberHandoff: directMemberHandoffRequirement.every((name) =>
      directMemberHandoffClues.includes(name)
    ),
    hasTypedAccessorBridge:
      typedBridgeRecovery.bridgeOwner === "PlayerProfileHandler" &&
      typedBridgeRecovery.bridgeAccessor === "get_Market" &&
      typedBridgeRecovery.bridgeReturnType === "MultiverseMarket",
    hasTypedSaveCacheField:
      typedHandlerFieldRecovery.fieldOwner === "PlayerProfileHandler" &&
      typedHandlerFieldRecovery.fieldName === "saveInfoCache" &&
      typedHandlerFieldRecovery.fieldType === "PlayerProfileData",
    hasTypedPlayerProfileFieldTable:
      typedPlayerProfileFieldTableRecovery.fieldOwner === "PlayerProfileData" &&
      Number.isInteger(typedPlayerProfileFieldTableRecovery.fieldCount) &&
      Number.isInteger(typedPlayerProfileFieldTableRecovery.methodCount),
    hasTypedSaveDataFieldTable:
      typedSaveDataFieldTableRecovery.fieldOwner === "SaveData" &&
      Number.isInteger(typedSaveDataFieldTableRecovery.fieldCount) &&
      Number.isInteger(typedSaveDataFieldTableRecovery.methodCount),
    hasTypedSiblingContrast: typedSiblingContrastRequirement.every((name) =>
      typedSiblingContrastClues.includes(name)
    ),
    hasProgressionPayloadBoundary: payloadFieldRequirement.every((name) =>
      progressionPayloadFieldClues.includes(name)
    ),
    rulesOutTypedMarketField: negativeTypedMarketRequirement.every((name) =>
      negativeTypedDirectMemberChecks.includes(name)
    ),
    rulesOutDirectPlayerProfileProgressionOwner:
      negativeTypedPlayerProfileProgressionRequirement.every((name) =>
        negativeTypedDirectPlayerProfileProgressionChecks.includes(name)
      ),
    rulesOutDirectMultiverseFieldOwner: negativeDirectMultiverseRequirement.every((name) =>
      negativeTypedDirectMemberChecks.includes(name)
    ),
    rulesOutTypedSaveDataMarketField: ["SaveData.Market", "SaveData.MultiverseMarket"].every(
      (name) => negativeTypedSaveDataMarketChecks.includes(name)
    ),
    hasExactSaveDataProgressionOwner:
      typedSaveDataFieldTableRecovery.fieldOwner === "SaveData" &&
      typedSaveDataProgressionOwnerSamples.includes("IS71Level") &&
      typedSaveDataProgressionOwnerSamples.includes("IS110Level") &&
      typedSaveDataProgressionOwnerSamples.includes("InscryptionsDone") &&
      typedSaveDataProgressionOwnerSamples.includes("EsotericR1Trades") &&
      typedSaveDataProgressionOwnerSamples.includes("NecrumR1Trades") &&
      typedSaveDataProgressionOwnerSamples.includes("Mech1Unlocked") &&
      typedSaveDataProgressionOwnerSamples.includes("Mech1MissionsCompleted"),
    hasMissingDirectTypeMap:
      missingDirectTypeMapClues.includes("PlayerProfileData|Market") &&
      missingDirectTypeMapClues.includes("PlayerProfileData|Inscryption") &&
      missingDirectTypeMapClues.includes("PlayerProfileData|MultiverseMarket"),
    hasSiblingAccessorCluster:
      siblingAccessorClues.every((name) => accessorClues.includes(name)) &&
      siblingMemberShellClues.every((name) => memberShellClues.includes(name)),
    favorsPlayerProfileMemberHost:
      accessorClues.includes("get_Market") &&
      memberShellClues.includes("Market") &&
      siblingAccessorClues.filter((name) => accessorClues.includes(name)).length >= 6 &&
      siblingMemberShellClues.filter((name) => memberShellClues.includes(name)).length >= 6 &&
      handlerBridgeRequirement.every((name) => handlerBridgeClues.includes(name)) &&
      missingDirectTypeMapClues.includes("PlayerProfileData|Market") &&
      missingDirectTypeMapClues.includes("PlayerProfileData|Inscryption"),
    favorsIntermediateWrapper:
      accessorClues.includes("get_Market") &&
      accessorClues.includes("get_BM") &&
      accessorClues.includes("get_ZN") &&
      accessorClues.includes("get_TU") &&
      memberShellClues.includes("Market") &&
      payloadFieldRequirement.every((name) => progressionPayloadFieldClues.includes(name)) &&
      missingDirectTypeMapClues.includes("PlayerProfileData|Market") &&
      missingDirectTypeMapClues.includes("PlayerProfileData|Inscryption"),
    favorsDirectMemberBoundary:
      typedBridgeRecovery.bridgeOwner === "PlayerProfileHandler" &&
      typedBridgeRecovery.bridgeAccessor === "get_Market" &&
      typedBridgeRecovery.bridgeReturnType === "MultiverseMarket" &&
      directMemberHandoffRequirement.every((name) => directMemberHandoffClues.includes(name)) &&
      typedSiblingContrastRequirement.every((name) => typedSiblingContrastClues.includes(name)) &&
      typedHandlerFieldRecovery.fieldOwner === "PlayerProfileHandler" &&
      typedHandlerFieldRecovery.fieldName === "saveInfoCache" &&
      typedHandlerFieldRecovery.fieldType === "PlayerProfileData" &&
      typedPlayerProfileFieldTableRecovery.fieldOwner === "PlayerProfileData" &&
      negativeTypedPlayerProfileProgressionRequirement.every((name) =>
        negativeTypedDirectPlayerProfileProgressionChecks.includes(name)
      ) &&
      negativeTypedMarketRequirement.every((name) =>
        negativeTypedDirectMemberChecks.includes(name)
      ) &&
      negativeDirectMultiverseRequirement.every((name) =>
        negativeTypedDirectMemberChecks.includes(name)
      ) &&
      missingDirectTypeMapClues.includes("PlayerProfileData|Market") &&
      missingDirectTypeMapClues.includes("PlayerProfileData|Inscryption"),
    preservedSiblingAccessorCount,
    preservedSiblingMemberCount,
    accessorLabel: "get_Market",
    memberLabel: "Market",
    handlerBridgeLabel:
      "PlayerProfileHandler, playerData, GetPlayerProfileData, FillPlayerProfileData, and ConvertSaveDataToProfileData",
    directMemberHandoffLabel:
      "get_Market, Market, GetPlayerProfileData, FillPlayerProfileData, and the FillPlayerProfileData coroutine shell",
    memberShellLabel: "Relics, ShardData, ResearchPointData, and AcademyPointData",
    siblingAccessorLabel:
      "get_BM, get_ZN, get_TU, get_Relics, get_CellData, get_ModPointData, get_ShardData, get_ResearchPointData, and get_AcademyPointData",
    siblingMemberLabel:
      "Relics, CellData, ModPointData, ShardData, ResearchPointData, and AcademyPointData",
    progressionPayloadLabel:
      "InscryptionsDone, EsotericR1Trades, NecrumR1Trades, and Mech1Unlocked",
    typedSiblingContrastLabel: "PlayerProfileData|GemData and PlayerProfileData|GemNodeCombo",
    typedSaveCacheLabel: "PlayerProfileHandler.saveInfoCache: PlayerProfileData",
    typedPlayerProfileFieldTableLabel:
      "PlayerProfileData field table: 89 direct fields and 1 method",
    typedSaveDataFieldTableLabel: "SaveData field table: 4461 direct fields and 1 method",
    typedSaveDataOwnerLabel:
      "SaveData directly declares IS71Level, IS110Level, InscryptionsDone, EsotericR1Trades, NecrumR1Trades, Mech1Unlocked, and Mech1MissionsCompleted",
    typedPlayerProfileNestedTypeLabel: "PlayerProfileData+GemData",
    negativeTypedMarketLabel:
      "no typed Market or MultiverseMarket field recovered on PlayerProfileHandler or PlayerProfileData",
    negativeTypedSaveDataMarketLabel:
      "no typed Market or MultiverseMarket field recovered on SaveData",
    negativeTypedPlayerProfileProgressionLabel:
      "PlayerProfileData does not directly declare IS71Level, IS110Level, EsotericR1Trades, NecrumR1Trades, Mech1Unlocked, or Mech1MissionsCompleted in the checked typed field table",
    negativeMultiverseFieldLabel:
      "MultiverseMarket does not directly declare InscryptionsDone, IS71Level, IS110Level, EsotericR1Trades, NecrumR1Trades, Mech1Unlocked, or Mech1MissionsCompleted in the checked typed probe",
    cloudSaveLabel: "CloudSavePlayerProfile",
    profileInfoLabel: "GetPlayerProfileInfo",
    missingTypeMapLabel:
      "PlayerProfileData|Market, PlayerProfileData|Inscryption, and PlayerProfileData|MultiverseMarket",
    canonicalHostLabel: "PlayerProfileHandler get_Market accessor bridge",
    exactSaveOwnerLabel: "SaveData"
  };
}

export function getMultiverseMarketMetadataSummary(neighborhood, multiverseMarket = null) {
  const genericSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-metadata-neighborhood"
  );
  const typedOwnerSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-typed-owner"
  );
  if (genericSummary || typedOwnerSummary) {
    const metadataAnchors = genericSummary?.factsByKind?.["metadata-anchor"] || [];
    const typedHostAnchors = typedOwnerSummary?.factsByKind?.["typed-host-anchor"] || [];
    const typedConversionAnchors = typedOwnerSummary?.factsByKind?.["typed-conversion-anchor"] || [];
    const typedFieldSamples = typedOwnerSummary?.factsByKind?.["typed-field-sample"] || [];
    const typedSpan =
      String(typedOwnerSummary?.factsByKind?.["typed-span"]?.[0] || "") ||
      String(genericSummary?.factsByKind?.["typed-span"]?.[0] || "");
    return {
      hasCloudSavePathClues:
        metadataAnchors.includes("CloudSavePlayerProfile") &&
        metadataAnchors.includes("GetPlayerProfileInfo"),
      hasSaveFamilyClues:
        (typedHostAnchors.includes("PlayerProfileData") ||
          metadataAnchors.includes("PlayerProfileData")) &&
        (typedConversionAnchors.includes("FillPlayerProfileData") ||
          typedConversionAnchors.includes("ConvertSaveDataToProfileData") ||
          metadataAnchors.includes("FillPlayerProfileData") ||
          metadataAnchors.includes("ConvertSaveDataToProfileData")),
      hasProgressionFieldCluster:
        (typedFieldSamples.includes("InscryptionsDone") ||
          metadataAnchors.includes("InscryptionsDone")) &&
        (typedFieldSamples.includes("EsotericR1Trades") ||
          metadataAnchors.includes("EsotericR1Trades")),
      recoveredIsRangeLabel: typedSpan,
      coverageSource: getDbSystemCoverageSummary(multiverseMarket, {
        includeSubjectMetadata: false,
        subjectFilter: (subjectId) =>
          subjectId === "family-graph:multiverse-market-metadata-neighborhood" ||
          subjectId === "family-graph:multiverse-market-typed-owner"
      }).coverageSource
    };
  }
  const fallbackNeighborhood =
    neighborhood ??
    multiverseMarket?.rowIdentity?.compatibilityBoundaries?.metadataNeighborhood ??
    null;
  const results = Array.isArray(fallbackNeighborhood?.results) ? fallbackNeighborhood.results : [];
  const findAnchor = (anchor) => results.find((entry) => entry.anchor === anchor);
  const flattenStrings = (matches = []) =>
    matches.flatMap((entry) => [
      entry.match_value,
      ...(Array.isArray(entry.context) ? entry.context.map((item) => item.value) : [])
    ]);
  const cloudSaveStrings = flattenStrings(findAnchor("CloudSavePlayerProfile")?.matches ?? []);
  const playerProfileStrings = flattenStrings(findAnchor("PlayerProfileData")?.matches ?? []);
  const inscryptionsStrings = flattenStrings(findAnchor("InscryptionsDone")?.matches ?? []);
  const recoveredIsLevels = [
    ...new Set(
      inscryptionsStrings
        .flatMap((value) =>
          Array.from(String(value).matchAll(/IS(\d+)Level/g), (match) => Number(match[1]))
        )
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right)
    )
  ];

  return {
    hasCloudSavePathClues:
      cloudSaveStrings.some((value) => String(value).includes("CloudSavePlayerProfile")) &&
      cloudSaveStrings.some((value) => String(value).includes("GetPlayerProfileInfo")),
    hasSaveFamilyClues:
      playerProfileStrings.some((value) => String(value).includes("PlayerProfileData.cs")) &&
      playerProfileStrings.some((value) => String(value).includes("GetPlayerProfileData")) &&
      playerProfileStrings.some((value) => String(value).includes("FillPlayerProfileData")),
    hasProgressionFieldCluster:
      inscryptionsStrings.some((value) => String(value).includes("InscryptionsDone")) &&
      inscryptionsStrings.some((value) => String(value).includes("EsotericR1Trades")),
    recoveredIsRangeLabel: recoveredIsLevels.length
      ? `IS${recoveredIsLevels[0]}Level through IS${recoveredIsLevels[recoveredIsLevels.length - 1]}Level`
      : ""
  };
}

export function getMultiverseMarketTypedOwnerSummary(multiverseMarket = null) {
  const genericSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-typed-owner"
  );
  const coverageSummary = getDbSystemCoverageSummary(multiverseMarket, {
    includeSubjectMetadata: false,
    subjectFilter: (subjectId) => subjectId === "family-graph:multiverse-market-typed-owner"
  });
  if (genericSummary) {
    const hostAnchors = genericSummary.factsByKind?.["typed-host-anchor"] || [];
    const conversionAnchors = genericSummary.factsByKind?.["typed-conversion-anchor"] || [];
    const fieldSamples = genericSummary.factsByKind?.["typed-field-sample"] || [];
    const typedSpan = String(genericSummary.factsByKind?.["typed-span"]?.[0] || "");
    const missingEdges = Array.isArray(genericSummary.missingEdges) ? genericSummary.missingEdges : [];
    const nextSeamId = genericSummary.nextSeamIds?.[0] || null;
    return {
      hasTypedOwnerAnchors: hostAnchors.length > 0,
      hasTypedConversionAnchors: conversionAnchors.length > 0,
      hasTypedFieldSamples: fieldSamples.length > 0,
      coverageSource: coverageSummary.coverageSource,
      typedHostLabel: hostAnchors.join(", "),
      typedConversionLabel: conversionAnchors.join(", "),
      typedFieldSampleLabel: fieldSamples.slice(0, 6).join(", "),
      recoveredIsRangeLabel: typedSpan,
      nextSeamId,
      negativeTypedOwnerLabel:
        missingEdges.includes("typed-market-field-recovery") || nextSeamId === "typed-market-field-recovery"
        ? "exact typed Market or MultiverseMarket field host remains unrecovered"
        : "typed market field recovery status unavailable",
      genericFactCount: genericSummary.factCount || 0,
      genericGapCount: genericSummary.gapCount || 0
    };
  }
  return {
    hasTypedOwnerAnchors: false,
    hasTypedConversionAnchors: false,
    hasTypedFieldSamples: false,
    coverageSource: "compatibility-boundary-export",
    typedHostLabel: "",
    typedConversionLabel: "",
    typedFieldSampleLabel: "",
    recoveredIsRangeLabel: "",
    nextSeamId: null,
    negativeTypedOwnerLabel: "typed owner DB coverage unavailable",
    genericFactCount: 0,
    genericGapCount: 0
  };
}

export function getMultiverseMarketCanonicalImportSummary(multiverseMarket = null) {
  const genericSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-canonical-import"
  );
  const coverageSummary = getDbSystemCoverageSummary(multiverseMarket, {
    includeSubjectMetadata: false,
    subjectFilter: (subjectId) => subjectId === "family-graph:multiverse-market-canonical-import"
  });
  if (genericSummary) {
    const compatibilityImportTargetPath = String(
      genericSummary.factsByKind?.["compatibility-import-target-path"]?.[0] || ""
    ).trim();
    const safeSubsetLabel = String(
      genericSummary.factsByKind?.["canonical-import-safe-subset-label"]?.[0] || ""
    ).trim();
    const overlapIds = (genericSummary.factsByKind?.["ordered-overlap-row-id"] || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const importTargetRelations = Array.isArray(
      genericSummary.relationsByKind?.["candidate-canonical-import-target"]
    )
      ? genericSummary.relationsByKind["candidate-canonical-import-target"]
      : [];
    const importAnchorRelations = Array.isArray(
      genericSummary.relationsByKind?.["candidate-import-anchor"]
    )
      ? genericSummary.relationsByKind["candidate-import-anchor"]
      : [];
    const canonicalHostFieldRelations = Array.isArray(
      genericSummary.relationsByKind?.["candidate-canonical-host-field"]
    )
      ? genericSummary.relationsByKind["candidate-canonical-host-field"]
      : [];
    const importLaneRelations = Array.isArray(
      genericSummary.relationsByKind?.["candidate-import-preserves-lane"]
    )
      ? genericSummary.relationsByKind["candidate-import-preserves-lane"]
      : [];
    const importOverlapRelations = Array.isArray(
      genericSummary.relationsByKind?.["candidate-import-overlap-row"]
    )
      ? genericSummary.relationsByKind["candidate-import-overlap-row"]
      : [];
    const supportedCanonicalHostFieldRelations = Array.isArray(
      genericSummary.relationsByKind?.["supports-canonical-import-host-field"]
    )
      ? genericSummary.relationsByKind["supports-canonical-import-host-field"]
      : [];
    const supportedCanonicalLaneRelations = Array.isArray(
      genericSummary.relationsByKind?.["supports-canonical-import-lane"]
    )
      ? genericSummary.relationsByKind["supports-canonical-import-lane"]
      : [];
    const supportedCanonicalOverlapRelations = Array.isArray(
      genericSummary.relationsByKind?.["supports-canonical-import-overlap-row"]
    )
      ? genericSummary.relationsByKind["supports-canonical-import-overlap-row"]
      : [];
    const boundedImportOverlapRelations = Array.isArray(
      genericSummary.relationsByKind?.["bounded-import-overlap-row"]
    )
      ? genericSummary.relationsByKind["bounded-import-overlap-row"]
      : [];
    const boundedImportLaneRelations = Array.isArray(
      genericSummary.relationsByKind?.["bounded-import-lane"]
    )
      ? genericSummary.relationsByKind["bounded-import-lane"]
      : [];
    const missingEdges = Array.isArray(genericSummary.missingEdges) ? genericSummary.missingEdges : [];
    const nextSeamId = genericSummary.nextSeamIds?.[0] || null;
    return {
      hasCanonicalImportBoundary: true,
      coverageSource: coverageSummary.coverageSource,
      compatibilityImportTargetPath: compatibilityImportTargetPath || null,
      safeSubsetLabel: safeSubsetLabel || "none",
      overlapLabel: formatNumericRanges(overlapIds),
      candidateImportTargetCount: importTargetRelations.length,
      candidateImportAnchorCount: importAnchorRelations.length,
      candidateImportAnchorLabel: importAnchorRelations
        .map((entry) => String(entry?.payload?.anchor || "").trim())
        .filter(Boolean)
        .join(", "),
      candidateCanonicalHostFieldCount: canonicalHostFieldRelations.length,
      candidateCanonicalHostFieldLabel: canonicalHostFieldRelations
        .map((entry) => String(entry?.payload?.claim || "").trim())
        .filter(Boolean)
        .join(", "),
      supportCanonicalHostFieldCount: supportedCanonicalHostFieldRelations.length,
      supportCanonicalLaneCount: supportedCanonicalLaneRelations.length,
      supportCanonicalOverlapCount: supportedCanonicalOverlapRelations.length,
      boundedImportLaneCount: boundedImportLaneRelations.length,
      boundedImportOverlapCount: boundedImportOverlapRelations.length,
      candidateImportLaneCount: importLaneRelations.length,
      candidateImportOverlapCount: importOverlapRelations.length,
      nextSeamId,
      negativeCanonicalImportLabel:
        missingEdges.includes("canonical-import-admissibility") ||
        nextSeamId === "canonical-import-admissibility"
          ? "canonical import admissibility remains unrecovered"
          : "canonical import boundary status unavailable",
      genericFactCount: genericSummary.factCount || 0,
      genericRelationCount: genericSummary.relationCount || 0,
      genericGapCount: genericSummary.gapCount || 0
    };
  }
  return {
    hasCanonicalImportBoundary: false,
    coverageSource: "compatibility-boundary-export",
    compatibilityImportTargetPath: null,
    safeSubsetLabel: "none",
    overlapLabel: "",
    candidateImportTargetCount: 0,
    candidateImportAnchorCount: 0,
    candidateImportAnchorLabel: "",
    candidateCanonicalHostFieldCount: 0,
    candidateCanonicalHostFieldLabel: "",
    candidateImportLaneCount: 0,
    candidateImportOverlapCount: 0,
    nextSeamId: null,
    negativeCanonicalImportLabel: "canonical import DB coverage unavailable",
    genericFactCount: 0,
    genericRelationCount: 0,
    genericGapCount: 0
  };
}

export function getMultiverseMarketBroadRowRemapSummary(multiverseMarket = null) {
  const genericSummary = getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "family-graph:multiverse-market-broad-row-remap"
  );
  const coverageSummary = getDbSystemCoverageSummary(multiverseMarket, {
    includeSubjectMetadata: false,
    subjectFilter: (subjectId) => subjectId === "family-graph:multiverse-market-broad-row-remap"
  });
  if (genericSummary) {
    const buyHooks = genericSummary.factsByKind?.["buy-hook-sample"] || [];
    const costTexts = genericSummary.factsByKind?.["cost-text-sample"] || [];
    const remapStatus = String(
      genericSummary.factsByKind?.["broader-row-remap-status"]?.[0] || ""
    ).trim();
    const overlapIds = (genericSummary.factsByKind?.["ordered-overlap-row-id"] || [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
    const candidateRowRemaps = Array.isArray(genericSummary.relationsByKind?.["candidate-row-remap"])
      ? genericSummary.relationsByKind["candidate-row-remap"]
      : [];
    const supportRowRemaps = Array.isArray(genericSummary.relationsByKind?.["supports-row-remap"])
      ? genericSummary.relationsByKind["supports-row-remap"]
      : [];
    const supportRowTextLanes = Array.isArray(genericSummary.relationsByKind?.["supports-row-text-lane"])
      ? genericSummary.relationsByKind["supports-row-text-lane"]
      : [];
    const overrideIdRemaps = Array.isArray(genericSummary.relationsByKind?.["candidate-override-id-remap"])
      ? genericSummary.relationsByKind["candidate-override-id-remap"]
      : [];
    const boundedRowRemapSupport = Array.isArray(genericSummary.relationsByKind?.["supports-bounded-row-remap"])
      ? genericSummary.relationsByKind["supports-bounded-row-remap"]
      : [];
    const boundedRowRemaps = Array.isArray(genericSummary.relationsByKind?.["bounded-row-remap"])
      ? genericSummary.relationsByKind["bounded-row-remap"]
      : [];
    const boundedRowTextLanes = Array.isArray(genericSummary.relationsByKind?.["bounded-row-text-lane"])
      ? genericSummary.relationsByKind["bounded-row-text-lane"]
      : [];
    const missingEdges = Array.isArray(genericSummary.missingEdges) ? genericSummary.missingEdges : [];
    const nextSeamId = genericSummary.nextSeamIds?.[0] || null;
    return {
      hasBroadRowRemapBoundary: true,
      coverageSource: coverageSummary.coverageSource,
      overlapLabel: formatNumericRanges(overlapIds),
      buyRangeLabel: formatNumericRanges(
        buyHooks
          .map((value) => Number(String(value).replace(/\D+/g, "")))
          .filter((value) => Number.isFinite(value))
      ),
      costTextRangeLabel: formatNumericRanges(
        costTexts
          .map((value) => Number(String(value).replace(/\D+/g, "")))
          .filter((value) => Number.isFinite(value))
      ),
      remapStatusLabel: remapStatus || "broader row remap status unavailable",
      candidateRowRemapCount: candidateRowRemaps.length,
      supportRowRemapCount: supportRowRemaps.length,
      supportRowTextLaneCount: supportRowTextLanes.length,
      candidateOverrideIdRemapCount: overrideIdRemaps.length,
      supportBoundedRowRemapCount: boundedRowRemapSupport.length,
      boundedRowRemapCount: boundedRowRemaps.length,
      boundedRowTextLaneCount: boundedRowTextLanes.length,
      candidateOverrideIdRemapLabel: overrideIdRemaps
        .map((entry) => String(entry?.payload?.pair || "").trim())
        .filter(Boolean)
        .join(", "),
      candidateRowRemapLabel: formatNumericRanges(
        candidateRowRemaps
          .map((entry) => Number(entry?.payload?.rowId))
          .filter((value) => Number.isFinite(value))
      ),
      nextSeamId,
      negativeBroadRemapLabel:
        missingEdges.includes("broad-row-identity-remap") ||
        nextSeamId === "broad-row-identity-remap"
          ? "broader row identity remap remains unrecovered outside the checked overlap"
          : "broad row remap status unavailable",
      genericFactCount: genericSummary.factCount || 0,
      genericRelationCount: genericSummary.relationCount || 0,
      genericGapCount: genericSummary.gapCount || 0
    };
  }
  return {
    hasBroadRowRemapBoundary: false,
    coverageSource: "compatibility-boundary-export",
    overlapLabel: "",
    buyRangeLabel: "",
    costTextRangeLabel: "",
    remapStatusLabel: "broader row remap DB coverage unavailable",
    candidateRowRemapCount: 0,
    supportRowRemapCount: 0,
    supportRowTextLaneCount: 0,
    candidateOverrideIdRemapCount: 0,
    candidateOverrideIdRemapLabel: "",
    candidateRowRemapLabel: "",
    nextSeamId: null,
    negativeBroadRemapLabel: "broader row remap DB coverage unavailable",
    genericFactCount: 0,
    genericRelationCount: 0,
    genericGapCount: 0
  };
}

import {
  getTokenShopGenericActionLaneSummary,
  getTokenShopGenericCostLaneSummary,
  getTokenShopGenericCoverageSummary,
  getTokenShopGenericDailyTokeniumLaneSummary,
  getTokenShopGenericOwnerShellSummary,
  getTokenShopGenericSaveBoundarySummary,
  getTokenShopGenericTokenBankControllerShellSummary,
  getTokenShopGenericTokenBankStateSummary,
  getTokenShopGenericTokeniumNamingSummary
} from "./token-shop-generic-mechanics.js";
import {
  composeDbCoverageSource,
  getDbSystemBoundaryEntry,
  getDbSystemCoverageSummary,
  getDbSystemGenericSubjectSummary,
  getDbSystemSubjectMetadataEntry,
  getDbSystemSubjectMetadataEntries
} from "./db-system-bundle.js";
import {
  getTokenShopDbGenericScopes,
  getTokenShopDbSubjectMetadata,
} from "./token-shop-db-bundle.js";
import { getQuarantinedMultiverseMarketImportedState } from "../player-profile.js";

export function getMultiverseMarketValidatedCoverage(multiverseMarket) {
  const validatedIds = Array.isArray(multiverseMarket?.source?.validated_ids)
    ? [
        ...new Set(
          multiverseMarket.source.validated_ids
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .sort((left, right) => left - right)
        )
      ]
    : [];

  return {
    hasValidatedRows: validatedIds.length > 0,
    count: validatedIds.length,
    rangeLabel: formatNumericRanges(validatedIds)
  };
}

export function getTokeniumNamingSummary(clues) {
  const genericSummary = getTokenShopGenericTokeniumNamingSummary(
    getTokenShopDbGenericScopes(clues)
  );
  const contracts = normalizeTokenShopSubjectMetadata(clues);
  if (genericSummary) {
    return genericSummary;
  }
  if (contracts.length) {
    const rowLocal =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "row-local" &&
          typeof contract?.groundedFields?.tokeniumNaming === "object" &&
          contract.groundedFields.tokeniumNaming
      ) ?? null;
    const rangeFamily =
      contracts.find(
        (contract) =>
          contract?.subjectKind === "range-family" &&
          typeof contract?.groundedFields?.tokeniumNaming === "object" &&
          contract.groundedFields.tokeniumNaming
      ) ?? null;
    const namingFields =
      rowLocal?.groundedFields?.tokeniumNaming ?? rangeFamily?.groundedFields?.tokeniumNaming ?? {};
    const blockedInputReason =
      (typeof rowLocal?.blockedInputReasons?.tokeniumNaming === "string" &&
        rowLocal.blockedInputReasons.tokeniumNaming) ||
      (typeof rangeFamily?.blockedInputReasons?.tokeniumNaming === "string" &&
        rangeFamily.blockedInputReasons.tokeniumNaming) ||
      (typeof rowLocal?.blockedInputReason === "string" && rowLocal.blockedInputReason) ||
      (typeof rangeFamily?.blockedInputReason === "string" && rangeFamily.blockedInputReason) ||
      null;
    const canUseContract =
      blockedInputReason === null &&
      typeof namingFields.resourceLabel === "string" &&
      typeof namingFields.academyLabel === "string" &&
      typeof namingFields.tokenShellLabel === "string" &&
      typeof namingFields.tokeniumShellLabel === "string";

    if (canUseContract) {
      return {
        hasNamingClues: true,
        coverageSource: getTokenShopDbCoverageSource(clues, contracts.length > 0),
        resourceLabel: namingFields.resourceLabel,
        academyLabel: namingFields.academyLabel,
        tokenShellLabel: namingFields.tokenShellLabel,
        tokeniumShellLabel: namingFields.tokeniumShellLabel,
        rowLocalSubjectId: rowLocal?.subjectId || null,
        rangeFamilySubjectId: rangeFamily?.subjectId || null,
        rowLocalSubjectKind: rowLocal?.subjectKind || null,
        rangeFamilySubjectKind: rangeFamily?.subjectKind || null,
        blockedInputReason
      };
    }
  }
  const resourceIcons = Array.isArray(clues?.assetNames?.resourceIcons)
    ? clues.assetNames.resourceIcons
    : [];
  const academySprites = Array.isArray(clues?.assetNames?.academySprites)
    ? clues.assetNames.academySprites
    : [];
  const level0Shells = Array.isArray(clues?.level0Shells) ? clues.level0Shells : [];

  // Required compatibility fallback: keep this path until tokeniumNaming contracts are both
  // present and unblocked. Blocked naming contracts should fall back explicitly.
  return markLegacyTokenShopFallback(
    {
      hasNamingClues:
        resourceIcons.includes("Resource_Tokenium") &&
        academySprites.includes("Aca.Tokenium553") &&
        level0Shells.includes("CostBox-Tokens") &&
        level0Shells.includes("CostBox-Tokenium"),
      resourceLabel:
        resourceIcons.find((value) => value === "Resource_Tokenium") || "Resource_Tokenium",
      academyLabel:
        academySprites.find((value) => value === "Aca.Tokenium553") || "Aca.Tokenium553",
      tokenShellLabel: level0Shells.find((value) => value === "CostBox-Tokens") || "CostBox-Tokens",
      tokeniumShellLabel:
        level0Shells.find((value) => value === "CostBox-Tokenium") || "CostBox-Tokenium"
    },
    "legacy-tokenium-naming"
  );
}

function normalizeTokenShopSubjectMetadata(tokenShop) {
  const contracts = getTokenShopDbSubjectMetadata(tokenShop);
  if (contracts && typeof contracts === "object" && !Array.isArray(contracts)) {
    return Object.values(contracts).filter(Boolean);
  }
  return [];
}

function getMultiverseMarketSubjectMetadata(multiverseMarket) {
  return getDbSystemSubjectMetadataEntries(multiverseMarket);
}

function getMultiverseMarketGenericBoundarySummary(multiverseMarket) {
  return getDbSystemGenericSubjectSummary(
    multiverseMarket,
    "multiverse-market-save-owner-boundary"
  );
}

export function getMultiverseMarketDbCoverageSummary(multiverseMarket) {
  return getDbSystemCoverageSummary(multiverseMarket, {
    subjectFilter: (subjectId) =>
      String(subjectId || "").startsWith("multiverse-market-") ||
      String(subjectId || "").startsWith("family-graph:multiverse-market-")
  });
}

function hasTokenShopGenericMechanics(tokenShop) {
  const scopes = getTokenShopDbGenericScopes(tokenShop);
  return Boolean(scopes && typeof scopes === "object" && Object.keys(scopes).length > 0);
}

function getTokenShopDbCoverageSource(tokenShop, hasSubjectMetadata = true) {
  const hasGeneric = hasTokenShopGenericMechanics(tokenShop);
  return composeDbCoverageSource({
    hasGenericMechanics: hasGeneric,
    hasSubjectMetadata
  });
}

export function getTokenShopCoverageSummary(tokenShop) {
  const subjectMetadataEntries = normalizeTokenShopSubjectMetadata(tokenShop);
  const genericCoverage = getTokenShopGenericCoverageSummary(
    getTokenShopDbGenericScopes(tokenShop)
  );
  if (genericCoverage.hasCoverage) {
    return genericCoverage;
  }
  const rowLocalEntries = subjectMetadataEntries.filter((contract) => contract?.subjectKind === "row-local");
  const rangeFamilyEntries = subjectMetadataEntries.filter(
    (contract) => contract?.subjectKind === "range-family"
  );
  const blockedEntries = subjectMetadataEntries.filter(
    (contract) => Array.isArray(contract?.blockedEdges) && contract.blockedEdges.length > 0
  );
  const namedEntries = subjectMetadataEntries.filter(
    (contract) =>
      typeof contract?.subjectId === "string" &&
      contract.subjectId &&
      (Array.isArray(contract?.knownEdges) || Array.isArray(contract?.blockedEdges))
  );

  if (subjectMetadataEntries.length) {
    const subjectIds = namedEntries.map((contract) => contract.subjectId);
    return {
      hasCoverage: true,
      coverageSource: getTokenShopDbCoverageSource(tokenShop, subjectMetadataEntries.length > 0),
      numericGroupCount: subjectMetadataEntries.length,
      hasNamedLanes: rowLocalEntries.length > 0 && rangeFamilyEntries.length > 0,
      namedLaneLabel: subjectIds.slice(0, 4).join(", "),
      tierLabel: `${rowLocalEntries.length} row-local and ${rangeFamilyEntries.length} range-family DB-backed subjects`,
      hasControllerAnchors: rowLocalEntries.some((contract) =>
        Array.isArray(contract?.groundedFields?.actionMethods)
      ),
      subjectCount: subjectMetadataEntries.length,
      rowLocalCount: rowLocalEntries.length,
      rangeFamilyCount: rangeFamilyEntries.length,
      blockedCount: blockedEntries.length,
      subjectLabels: subjectIds,
      genericScopeCount: genericCoverage.genericScopeCount || 0,
      unresolvedRowFieldCount: genericCoverage.unresolvedRowFieldCount || 0
    };
  }

  const extract = tokenShop?.rows?.extract ?? tokenShop;
  const numericTable = extract?.numeric_table ?? {};
  const numericKeys = Object.keys(numericTable);
  const fields = Array.isArray(extract?.fields) ? extract.fields : [];
  const controllerFieldNames = new Set(
    fields.filter((entry) => entry.group === "controller").map((entry) => entry.field)
  );
  const groups = [
    ...new Set(
      numericKeys
        .map((key) => numericTable[key]?.group)
        .filter((value) => typeof value === "string" && value.length)
    )
  ].sort();
  const namedLanes = ["TokenBoost", "DiamondBoost", "TokenDailiesT2"].filter(
    (key) => key in numericTable
  );

  // Compatibility-only fallback: active UI reads should use DB-backed TokenShop mechanics when
  // they are present. This branch remains only for export/debug views or when DB-backed surfaces
  // are absent from the caller payload.
  return markLegacyTokenShopFallback(
    {
      hasCoverage: numericKeys.length > 0,
      numericGroupCount: numericKeys.length,
      hasNamedLanes: namedLanes.length === 3,
      namedLaneLabel: namedLanes.join(", "),
      tierLabel: groups.join(", "),
      hasControllerAnchors:
        controllerFieldNames.has("BankFill") && controllerFieldNames.has("TokenBankDescriptionText")
    },
    "legacy-extract"
  );
}

export function getImportedMultiverseMarketPreview(
  importedMarketState,
  multiverseMarket,
  multiverseMarketRangeBoundary,
  { formatBoundaryValue, formatShardNumber, isBoundaryValuePresent }
) {
  void formatBoundaryValue;
  void isBoundaryValuePresent;
  const saveBoundarySummary = getMultiverseMarketSaveBoundarySummary(multiverseMarket);
  const marketMemberSummary = getMultiverseMarketMarketMemberBoundarySummary(multiverseMarket);
  const multiverseDbCoverage = getMultiverseMarketDbCoverageSummary(multiverseMarket);
  const genericBoundary = getMultiverseMarketGenericBoundarySummary(multiverseMarket);
  const getGenericBoundaryFact = (factKind, fallback = "") =>
    String(genericBoundary?.factsByKind?.[factKind]?.[0] || fallback).trim() || fallback;
  const overlapIdSource = Array.isArray(multiverseMarketRangeBoundary?.overlapIds)
    ? multiverseMarketRangeBoundary.overlapIds
    : genericBoundary?.factsByKind?.["ordered-overlap-row-id"] || [];
  const overlapIds = [
    ...new Set(
      overlapIdSource
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((left, right) => left - right)
    )
  ];
  const importedState = getQuarantinedMultiverseMarketImportedState(importedMarketState) ?? {};
  const overlapIdSet = new Set(overlapIds);
  const importedSpanRows = Object.entries(importedState)
    .map(([key, value]) => {
      const match = /^IS(\d+)Level$/u.exec(String(key));
      if (!match) {
        return null;
      }
      const rowId = Number(match[1]);
      const level = Number(value);
      if (!Number.isFinite(rowId) || rowId < 1 || rowId > 110 || !Number.isFinite(level)) {
        return null;
      }
      return {
        rowId,
        level,
        fieldPath: `compatibility.unmappedSystemState.multiverseMarket.importedState.IS${rowId}Level`
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.rowId - right.rowId);
  const importedSpanIds = new Set(importedSpanRows.map((entry) => entry.rowId));
  const importedOverlapRows = importedSpanRows.filter((entry) => overlapIdSet.has(entry.rowId));
  const missingOverlapRows = overlapIds.filter((rowId) => !importedSpanIds.has(rowId));
  const missingSpanRows = [];
  for (let rowId = 1; rowId <= 110; rowId += 1) {
    if (!importedSpanIds.has(rowId)) {
      missingSpanRows.push(rowId);
    }
  }
  const previewRows = importedSpanRows.slice(0, 12);
  const trailingPreviewRows = importedSpanRows.slice(-4);
  const supportedTextModel = {
    effectLabelLane: getGenericBoundaryFact("grounded-text-lane-effect-label", "BonusDescriptionText"),
    effectLabelSourceLane: getGenericBoundaryFact(
      "grounded-text-lane-effect-source",
      "SetAllBonusTexts -> SetISNBonusText"
    ),
    baseBonusLane: getGenericBoundaryFact("grounded-text-lane-base-bonus", "PerLevelBonusText"),
    baseBonusSourceLane: getGenericBoundaryFact(
      "grounded-text-lane-base-bonus-source",
      "SetAllChrystosEmporiumTexts -> SetAllBaseBonusTexts -> SetISNBaseBonusText"
    ),
    idLane: getGenericBoundaryFact("grounded-text-lane-row-id", "IDText"),
    idSourceLane: getGenericBoundaryFact(
      "grounded-text-lane-row-id-source",
      "SetIS1IDText through SetIS110IDText"
    ),
    quarantinedCurrentValueLane: getGenericBoundaryFact(
      "quarantined-text-lane-current-value",
      "CurrentBonusText"
    )
  };
  const rowSummaryShape = {
    shapeId: "multiverse-market-row-local-text-summary",
    groundedFields: [
      {
        key: "effectLabel",
        slotAlias: supportedTextModel.effectLabelLane,
        sourceLane: supportedTextModel.effectLabelSourceLane
      },
      {
        key: "baseBonus",
        slotAlias: supportedTextModel.baseBonusLane,
        sourceLane: supportedTextModel.baseBonusSourceLane
      },
      {
        key: "rowIdLabel",
        slotAlias: supportedTextModel.idLane,
        sourceLane: supportedTextModel.idSourceLane
      }
    ],
    quarantinedFields: [
      {
        key: "currentValueDisplay",
        slotAlias: supportedTextModel.quarantinedCurrentValueLane,
        status: "quarantined-unrecovered-runtime-only-display-lane"
      }
    ]
  };
  const overlapRowSummaries = importedOverlapRows.map((entry) => ({
    rowId: entry.rowId,
    level: entry.level,
    fieldPath: entry.fieldPath,
    shapeId: rowSummaryShape.shapeId,
    groundedFields: rowSummaryShape.groundedFields.map((field) => ({
      ...field,
      status: "grounded-compatibility-evidence"
    })),
    quarantinedFields: rowSummaryShape.quarantinedFields.map((field) => ({
      ...field,
      reason: "Distinct unrecovered runtime-only display lane"
    }))
  }));

  return {
    hasImportedCompatibilityPreview: importedSpanRows.length > 0,
    hasImportedSpanPreview: importedSpanRows.length > 0,
    saveAnchor: saveBoundarySummary.saveAnchor || "SaveData",
    importTargetPath:
      marketMemberSummary.compatibilityImportTargetPath ||
      "compatibility.unmappedSystemState.multiverseMarket",
    wrapperOnlyFieldLabel: getGenericBoundaryFact("wrapper-only-field-label", "InscryptionsDone"),
    typedSpanLabel: saveBoundarySummary.typedSpanLabel || "IS1Level through IS110Level",
    coverageSource: multiverseDbCoverage.coverageSource || null,
    nextSeamLabel: multiverseDbCoverage.nextSeamLabel || "",
    canonicalImportSafeSubsetLabel:
      String(
        genericBoundary?.factsByKind?.["canonical-import-safe-subset-label"]?.[0] || "none"
      ).trim() || "none",
    broaderRowRemapStatus:
      String(genericBoundary?.factsByKind?.["broader-row-remap-status"]?.[0] || "").trim() || "",
    importedSpanRowCount: importedSpanRows.length,
    totalSpanRowCount: 110,
    importedRangeLabel: importedSpanRows.length
      ? formatNumericRanges(importedSpanRows.map((entry) => entry.rowId))
      : "",
    firstImportedRowLabel: importedSpanRows.length ? `IS${importedSpanRows[0].rowId}Level` : "",
    lastImportedRowLabel: importedSpanRows.length
      ? `IS${importedSpanRows[importedSpanRows.length - 1].rowId}Level`
      : "",
    missingSpanRows,
    missingSpanCount: missingSpanRows.length,
    missingSpanLabel: missingSpanRows.length
      ? missingSpanRows
          .slice(0, 12)
          .map((rowId) => `IS${rowId}Level`)
          .join(", ")
      : "none",
    importedSpanRows,
    hasOverlapGroundedRows: overlapIds.length > 0,
    overlapRangeLabel: formatNumericRanges(overlapIds),
    overlapRowCount: overlapIds.length,
    hasOverlapLevelPreview: importedOverlapRows.length > 0,
    importedOverlapRowCount: importedOverlapRows.length,
    overlapPreviewRows: importedOverlapRows.slice(0, 4),
    overlapRowSummaries: overlapRowSummaries.slice(0, 4),
    missingOverlapRows,
    missingOverlapLabel: missingOverlapRows.length
      ? missingOverlapRows.map((rowId) => `IS${rowId}Level`).join(", ")
      : "none",
    previewRows,
    trailingPreviewRows,
    supportedTextModel,
    rowSummaryShape,
    sampleLine: previewRows.length
      ? previewRows
          .map((entry) => `IS${entry.rowId}Level ${formatShardNumber(entry.level)}`)
          .join(" | ")
      : ""
  };
}
