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

export function getTokenShopCostLaneSummary(clues) {
  const tokenSpendGroups = Array.isArray(clues?.tokenSpendGroups) ? clues.tokenSpendGroups : [];
  const dailyTokeniumModifierGroups = Array.isArray(clues?.dailyTokeniumModifierGroups)
    ? clues.dailyTokeniumModifierGroups
    : [];
  const diamondGroups = Array.isArray(clues?.diamondGroups) ? clues.diamondGroups : [];
  const tracePresentation =
    typeof clues?.tracePresentation === "object" && clues.tracePresentation
      ? clues.tracePresentation
      : {};

  return {
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
  };
}

export function getSpendActionLaneSummary(clues) {
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

  return {
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
  };
}

export function getTokenBankStateSummary(clues) {
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

  return {
    hasControllerSplit:
      tokenShopMethods.includes("ClaimBankedTokens") &&
      tokenShopMethods.includes("get_TokenBankCap") &&
      displayOrHandlerClues.includes("BigStatisticPrefab.TokenBankCap") &&
      displayOrHandlerClues.includes("SetLM244BonusText"),
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
    cloudSaveShell: "CloudSavePlayerProfile",
    cloudSaveInfoRoutine: "GetCurrentSaveFileInfo",
    cloudSaveProfileRoutine: "GetPlayerProfileInfo",
    cloudSaveStateMachine: "<CloudSavePlayerProfile>d__24"
  };
}

export function getDailyTokeniumLaneSummary(clues) {
  const ownerFamilyClues = Array.isArray(clues?.ownerFamilyClues) ? clues.ownerFamilyClues : [];
  const modifierClues = Array.isArray(clues?.modifierClues) ? clues.modifierClues : [];
  const premiumModifierClues = Array.isArray(clues?.premiumModifierClues)
    ? clues.premiumModifierClues
    : [];
  const playerFacingStrings = Array.isArray(clues?.playerFacingStrings)
    ? clues.playerFacingStrings
    : [];

  return {
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
  };
}

export function getTokenBankFormulaBoundarySummary(clues) {
  const derivedOutputCluster = Array.isArray(clues?.derivedOutputCluster)
    ? clues.derivedOutputCluster
    : [];
  const saveFamilyCluesInDerivedContext = Array.isArray(clues?.saveFamilyCluesInDerivedContext)
    ? clues.saveFamilyCluesInDerivedContext
    : [];

  return {
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
  };
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

export function getMultiverseMarketRangeBoundarySummary(boundary) {
  const validatedRowRanges = Array.isArray(boundary?.validatedRowRanges)
    ? boundary.validatedRowRanges
    : [];
  const overlapIds = Array.isArray(boundary?.overlapIds) ? boundary.overlapIds : [];
  const metadataIsRangeLabel =
    typeof boundary?.metadataIsRangeLabel === "string" ? boundary.metadataIsRangeLabel : "";

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

export function getMultiverseMarketRowTextCoverageSummary(coverage) {
  const textHandlerAnchors = Array.isArray(coverage?.textHandlerAnchors)
    ? coverage.textHandlerAnchors
    : [];
  const validatedRowCostTexts = Array.isArray(coverage?.validatedRowCostTexts)
    ? coverage.validatedRowCostTexts
    : [];
  const sampleBuyHooks = Array.isArray(coverage?.sampleBuyHooks) ? coverage.sampleBuyHooks : [];

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

export function getMultiverseMarketActionShellSummary(shell) {
  const textHandlerAnchors = Array.isArray(shell?.textHandlerAnchors)
    ? shell.textHandlerAnchors
    : [];
  const validatedBuyHookRanges = Array.isArray(shell?.validatedBuyHookRanges)
    ? shell.validatedBuyHookRanges
    : [];
  const validatedBuyHooks = Array.isArray(shell?.validatedBuyHooks) ? shell.validatedBuyHooks : [];
  const validatedCostTexts = Array.isArray(shell?.validatedCostTexts)
    ? shell.validatedCostTexts
    : [];
  const buyRange = shell?.contextDerivedBuyHookRange ?? {};
  const costTextRange = shell?.contextDerivedCostTextRange ?? {};

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

export function getMultiverseMarketPrefabRemapBoundarySummary(boundary) {
  const directPrefabNumberMatches = Array.isArray(boundary?.directPrefabNumberMatches)
    ? boundary.directPrefabNumberMatches
    : [];
  const explicitPrefabIdOverrides = Array.isArray(boundary?.explicitPrefabIdOverrides)
    ? boundary.explicitPrefabIdOverrides
    : [];
  const validatedIdsWithoutDirectPrefabName = Array.isArray(
    boundary?.validatedIdsWithoutDirectPrefabName
  )
    ? boundary.validatedIdsWithoutDirectPrefabName
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

export function getMultiverseMarketOwnerFamilySummary(family) {
  const ownerAnchors = Array.isArray(family?.ownerAnchors) ? family.ownerAnchors : [];
  const costLaneAnchors = Array.isArray(family?.costLaneAnchors) ? family.costLaneAnchors : [];
  const validatedCurrencyBoxes = Array.isArray(family?.validatedCurrencyBoxes)
    ? family.validatedCurrencyBoxes
    : [];
  const sampleBuyHooks = Array.isArray(family?.sampleBuyHooks) ? family.sampleBuyHooks : [];
  const currencyBoxRange =
    typeof family?.currencyBoxRange === "object" && family.currencyBoxRange
      ? family.currencyBoxRange
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
  const ownerAnchors = Array.isArray(shell?.ownerAnchors) ? shell.ownerAnchors : [];
  const tokenBankMethods = Array.isArray(shell?.tokenBankMethods) ? shell.tokenBankMethods : [];
  const notificationHooks = Array.isArray(shell?.notificationHooks) ? shell.notificationHooks : [];
  const adjacentDeviceHooks = Array.isArray(shell?.adjacentDeviceHooks)
    ? shell.adjacentDeviceHooks
    : [];

  return {
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
  };
}

export function getTokenShopSaveBoundarySummary(boundary) {
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

  return {
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
  };
}

export function getTokenBankControllerShellSummary(shell) {
  const controllerAnchors = Array.isArray(shell?.controllerAnchors) ? shell.controllerAnchors : [];
  const adjacentControllerMethods = Array.isArray(shell?.adjacentControllerMethods)
    ? shell.adjacentControllerMethods
    : [];

  return {
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
  };
}

export function getMultiverseMarketSaveBoundarySummary(boundary) {
  const actionShellTermsChecked = Array.isArray(boundary?.actionShellTermsChecked)
    ? boundary.actionShellTermsChecked
    : [];
  const saveFamilyTermsChecked = Array.isArray(boundary?.saveFamilyTermsChecked)
    ? boundary.saveFamilyTermsChecked
    : [];
  const boundaryEvidence =
    typeof boundary?.boundaryEvidence === "object" && boundary.boundaryEvidence
      ? boundary.boundaryEvidence
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
  const accessorClues = Array.isArray(boundary?.playerProfileAccessorClues)
    ? boundary.playerProfileAccessorClues
    : [];
  const memberShellClues = Array.isArray(boundary?.playerProfileMemberShellClues)
    ? boundary.playerProfileMemberShellClues
    : [];
  const handlerBridgeClues = Array.isArray(boundary?.playerProfileHandlerBridgeClues)
    ? boundary.playerProfileHandlerBridgeClues
    : [];
  const directMemberHandoffClues = Array.isArray(boundary?.directMemberHandoffClues)
    ? boundary.directMemberHandoffClues
    : [];
  const typedSiblingContrastClues = Array.isArray(boundary?.typedSiblingContrastClues)
    ? boundary.typedSiblingContrastClues
    : [];
  const progressionPayloadFieldClues = Array.isArray(boundary?.progressionPayloadFieldClues)
    ? boundary.progressionPayloadFieldClues
    : [];
  const cloudSaveBridgeClues = Array.isArray(boundary?.cloudSaveBridgeClues)
    ? boundary.cloudSaveBridgeClues
    : [];
  const missingDirectTypeMapClues = Array.isArray(boundary?.missingDirectTypeMapClues)
    ? boundary.missingDirectTypeMapClues
    : [];
  const negativeTypedDirectPlayerProfileProgressionChecks = Array.isArray(
    boundary?.negativeTypedDirectPlayerProfileProgressionChecks
  )
    ? boundary.negativeTypedDirectPlayerProfileProgressionChecks
    : [];
  const negativeTypedDirectMemberChecks = Array.isArray(boundary?.negativeTypedDirectMemberChecks)
    ? boundary.negativeTypedDirectMemberChecks
    : [];
  const negativeTypedSaveDataMarketChecks = Array.isArray(
    boundary?.negativeTypedSaveDataMarketChecks
  )
    ? boundary.negativeTypedSaveDataMarketChecks
    : [];
  const typedBridgeRecovery =
    typeof boundary?.typedBridgeRecovery === "object" && boundary.typedBridgeRecovery
      ? boundary.typedBridgeRecovery
      : {};
  const typedHandlerFieldRecovery =
    typeof boundary?.typedHandlerFieldRecovery === "object" && boundary.typedHandlerFieldRecovery
      ? boundary.typedHandlerFieldRecovery
      : {};
  const typedPlayerProfileFieldTableRecovery =
    typeof boundary?.typedPlayerProfileFieldTableRecovery === "object" &&
    boundary?.typedPlayerProfileFieldTableRecovery
      ? boundary.typedPlayerProfileFieldTableRecovery
      : {};
  const typedSaveDataFieldTableRecovery =
    typeof boundary?.typedSaveDataFieldTableRecovery === "object" &&
    boundary?.typedSaveDataFieldTableRecovery
      ? boundary.typedSaveDataFieldTableRecovery
      : {};
  const typedSaveDataProgressionOwnerSamples = Array.isArray(
    boundary?.typedSaveDataProgressionOwnerSamples
  )
    ? boundary.typedSaveDataProgressionOwnerSamples
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

export function getMultiverseMarketMetadataSummary(neighborhood) {
  const results = Array.isArray(neighborhood?.results) ? neighborhood.results : [];
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
  const resourceIcons = Array.isArray(clues?.assetNames?.resourceIcons)
    ? clues.assetNames.resourceIcons
    : [];
  const academySprites = Array.isArray(clues?.assetNames?.academySprites)
    ? clues.assetNames.academySprites
    : [];
  const level0Shells = Array.isArray(clues?.level0Shells) ? clues.level0Shells : [];

  return {
    hasNamingClues:
      resourceIcons.includes("Resource_Tokenium") &&
      academySprites.includes("Aca.Tokenium553") &&
      level0Shells.includes("CostBox-Tokens") &&
      level0Shells.includes("CostBox-Tokenium"),
    resourceLabel:
      resourceIcons.find((value) => value === "Resource_Tokenium") || "Resource_Tokenium",
    academyLabel: academySprites.find((value) => value === "Aca.Tokenium553") || "Aca.Tokenium553",
    tokenShellLabel: level0Shells.find((value) => value === "CostBox-Tokens") || "CostBox-Tokens",
    tokeniumShellLabel:
      level0Shells.find((value) => value === "CostBox-Tokenium") || "CostBox-Tokenium"
  };
}

export function getTokenShopCoverageSummary(tokenShop) {
  const numericTable = tokenShop?.numeric_table ?? {};
  const numericKeys = Object.keys(numericTable);
  const fields = Array.isArray(tokenShop?.fields) ? tokenShop.fields : [];
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

  return {
    hasCoverage: numericKeys.length > 0,
    numericGroupCount: numericKeys.length,
    hasNamedLanes: namedLanes.length === 3,
    namedLaneLabel: namedLanes.join(", "),
    tierLabel: groups.join(", "),
    hasControllerAnchors:
      controllerFieldNames.has("BankFill") && controllerFieldNames.has("TokenBankDescriptionText")
  };
}

export function getImportedMultiverseMarketPreview(
  importedMarketState,
  multiverseMarket,
  multiverseMarketRangeBoundary,
  { formatBoundaryValue, formatShardNumber, isBoundaryValuePresent }
) {
  void multiverseMarket;
  void formatBoundaryValue;
  void isBoundaryValuePresent;
  const overlapIds = Array.isArray(multiverseMarketRangeBoundary?.overlapIds)
    ? [
        ...new Set(
          multiverseMarketRangeBoundary.overlapIds
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value))
            .sort((left, right) => left - right)
        )
      ]
    : [];
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
    effectLabelLane: "BonusDescriptionText",
    baseBonusLane: "PerLevelBonusText",
    idLane: "IDText",
    quarantinedCurrentValueLane: "CurrentBonusText"
  };
  const rowSummaryShape = {
    shapeId: "multiverse-market-row-local-text-summary",
    groundedFields: [
      {
        key: "effectLabel",
        slotAlias: supportedTextModel.effectLabelLane,
        sourceLane: "SetAllBonusTexts -> SetISNBonusText"
      },
      {
        key: "baseBonus",
        slotAlias: supportedTextModel.baseBonusLane,
        sourceLane: "SetAllChrystosEmporiumTexts -> SetAllBaseBonusTexts -> SetISNBaseBonusText"
      },
      {
        key: "rowIdLabel",
        slotAlias: supportedTextModel.idLane,
        sourceLane: "SetIS1IDText through SetIS110IDText"
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
    importTargetPath: "compatibility.unmappedSystemState.multiverseMarket",
    wrapperOnlyFieldLabel: "InscryptionsDone",
    typedSpanLabel: "IS1Level through IS110Level",
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
