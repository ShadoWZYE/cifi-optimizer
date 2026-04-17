# Spend System Verification Gate

This document records what is currently verified about the spend-planner track and what must still be verified before any spend recommendations are added to the app.

It exists to enforce the repo rule that systems must be understood in-game and in the extracted assets before they are integrated into recommendations.

Data being present in the repo is not enough. These systems should be treated as available but unmapped until their currencies, owned-state inputs, and player-facing labels are verified well enough for app integration.

This is also a slice-selection document. Use it to decide the next honest spend lane slice, not to silently bundle every spend lane into one blocker or stop after one bounded pass.

## Integration rule

For any proposed spend slice, verify only the inputs that slice actually consumes.

Do not add spend-planner UI or recommendation logic until the consumed system inputs below have:

1. verified in-game placement
2. verified Unity/APK owner
3. verified spend currency lane
4. verified player-owned state inputs needed for next-purchase logic
5. verified or clearly labeled naming

If any item is missing, the allowed work stays in docs, parser scripts, owner maps, or descriptive placeholders.

## Next-slice contract

Now that the first checked-row affordability preview has shipped, evaluate the next TokenShop-facing slice against this contract:

- User-facing question: What do the grounded upgrades I can already inspect actually do at my current level and on the next level?
- Minimum required inputs:
  - checked TokenShop row identity for the rows shown
  - current imported levels for those same rows
  - checked `StartCost`, `AdditiveCost`, `Bonus`, and known-cap fields for those same rows
- Explicit non-blockers:
  - token-bank cap or claimable-state recovery
  - Daily Tokenium cap or ready-state recovery
  - Emporium state recovery
  - unresolved TokenShop rows outside the checked subset
  - best-buy ranking, ROI math, or next-purchase recommendation logic
- Current true blocker:
  - keeping the row-detail slice subset-bound, fixed-order, and non-optimizer instead of silently widening it into a next-purchase planner
- Largest coherent adjacent slice:
  - a first Progression-side TokenShop editor that shows the checked TokenShop subset, keeps local non-canonical current levels for that subset, uses compatibility import only as prefill, and shows next known cost, known max-level status, and current-vs-next grounded bonus-step change from shipped TokenShop values data only, with no recommendation math
- Default next adjacent step:
  - keep expanding the same spend lane by grounding only the additional checked-row inputs that the Progression-side TokenShop editor directly consumes; if the current evidence path stalls, change the probe or join path before escalating to a broader lane split

## TokenShop

### Verified now

- In-game system family: token bank / token upgrades
- Unity owner: `TokenShop`
- Extracted source:
  - [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
  - [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat)
- Grounded outputs:
  - [`docs/systems/spend/token-shop-values.md`](docs/systems/spend/token-shop-values.md)
  - [`docs/systems/spend/token-shop-row-remap-verification.md`](docs/systems/spend/token-shop-row-remap-verification.md)
  - [`docs/systems/spend/token-bank-state-verification.md`](docs/systems/spend/token-bank-state-verification.md)
  - [`docs/systems/spend/daily-tokenium-mission-lane-verification.md`](docs/systems/spend/daily-tokenium-mission-lane-verification.md)
  - [`data/token-shop-values.json`](data/token-shop-values.json)
  - [`data/token-shop-row-level-owner.json`](data/token-shop-row-level-owner.json)
  - [`data/token-shop-row-remap-boundary.json`](data/token-shop-row-remap-boundary.json)
- Verified extracted fields include:
  - `StartCost`
  - `AdditiveCost`
  - `Bonus`
  - `MaxLevel`
  - `FillMaxLevel`
- Verified save-side row-level owner evidence now includes:
  - exact `SaveData` fields `ATU1Level` through `ATU28Level`
  - adjacent exact `SaveData` fields `Tier2TokensUnlocked` through `Tier5TokensUnlocked`
  - the same grounded `ATU` numbering family on the TokenShop owner payload
- Verified currency-shell evidence now includes:
  - `resourceicons/resource_tokenium`
  - `resourceicons/resource_tokenium_cap`
  - token-bank controller labels such as `TokenBankDescriptionText` and `FinalTokenBankCap`

### Not yet verified enough for broader app recommendations

- final remap from raw `ATU*Level` save fields to grounded player-facing TokenShop row labels
- checked object or title joins from `ATU`-numbered row shells to specific prefab identities or final row titles
- full rule set for moving from first-buy facts to true next-purchase planning

These are broader-planner blockers, not automatic blockers for the first checked-row TokenShop slice above.

### Adjacent systems this signals

TokenShop mapping also points at future system-mapping work outside the raw cost table itself:

- token-bank cap / fill state and related final-stat outputs
- the `DiamondBoost` lane inside TokenShop and how it relates to the broader diamond-upgrade domain
- Meltdown-linked gating objects that appear to control tier activation or visibility
- prefab / label remap work for `NewTokenUPGPrefab.*` families
- notification and unlock shell logic around `ATU*Button`, overlays, and nav badges
- downstream effect domains touched by TokenShop upgrades, including generators, cells, mod points, shards, research points, academy points, loot, missions, and Ouroboros orbs

These are not yet planner-ready integrations. They are dependency notes so future mapping work can recover the right owners and player-state inputs instead of forcing TokenShop into a fake standalone model.

### Current app implication

- It is safe to treat TokenShop as a real system with grounded extracted constants.
- It is safe to describe its cost lane as token-bank token or tokenium spending, rather than as an unnamed generic spend pool.
- It is safe to preserve raw `ATU1Level` through `ATU28Level` and `Tier2TokensUnlocked` through `Tier5TokensUnlocked` under `compatibility.unmappedSystemState.tokenShop`.
- It is safe to say the repo now has grounded non-label clues around some `ATU` rows, including token, diamond, daily-token, shard, and late direct-buy hook evidence.
- It is now also safe to ship one tier-grouped TokenShop row-detail module for all 28 ATU rows (T1: ATU1-12, T2: ATU13-18, T3: ATU19-23, T4: ATU24-25, T5: ATU26-28) with locked tier detection, as long as the module reads imported levels plus checked row constants only and respects tier unlock thresholds.
- It is now also safe to move that checked-row subset into the Progression area as the first real TokenShop editor slice, as long as local row levels stay non-canonical, compatibility import stays prefill-only, and the rest of the family remains quarantined.
- That checked-row subset is enough to answer one next TokenShop-facing player question by showing row identity, checked player-state current level or compatibility fallback, local override when the player edits inside the tool, next known cost, known max-level status, and current-vs-next grounded bonus-step change for those rows only, while staying explicit about uncertainty and keeping the rest of the family quarantined.
- It is not yet safe to generate next-buy recommendations from player token budgets alone.
- It is not yet safe to promote raw `ATU*Level` save fields into canonical `state.playerProfile` fields until the row-by-row remap is grounded.
- The rest of the `ATU*Level` family should stay quarantined even when that small preview is shown; unresolved row identities are still a subset-remap blocker, not a reason to force a full-lane remap.
- TokenShop-connected token-bank cap, fill, claim, and daily tokenium state should remain `available but unmapped` until saved-state owners are recovered, but they are not automatic blockers for a first TokenShop slice unless that slice consumes them.
- `OR_TokenBankCap` and `OR_TokensFromChests` should currently be treated as grounded asset labels, not as recovered formula sources.
- One key split is now grounded: claim actions resolve through `TokenShop`, token-bank cap display resolves through `BigStatisticPrefab.TokenBankCap`, and at least one daily-tokenium text path resolves through `TextHandlerLoopMods.SetLM244BonusText`.
- `LM244` should currently be treated as a loop-mod text or explanation hook for daily tokenium, not as the recovered gameplay owner of that lane.
- The current repo-local owner narrowing is still negative rather than positive: `TokenShop`, `BigStatisticPrefab.TokenBankCap`, and the `FinalTokenBank*` derived-output cluster are not yet recovered saved-state owners, and the checked `PlayerProfileHandler.saveInfoCache` plus `ConvertSaveDataToProfileData(...) -> PlayerProfileData` bridge still only exposes generic `PlayerProfileData.Tokens` and `PlayerProfileData.Tokenium` wrapper strings, so the remaining search should move past that export surface rather than promoting it into canonical state.
- The same narrowed boundary now also records exact `SaveData.ClaimableTokenium` only as a broader generic Tokenium-cluster claimable field, while direct target-type recovery still does not surface `CloudSavePlayerProfile` as a narrower typed wrapper for token-bank cap, claimable-bank, or ready-state ownership.
- Daily Tokenium is now better grounded as an Academy or Farm Mission reward lane that `TokenShop`, `LoopModifiers`, and the Collector pack all touch, not as a TokenShop-only mechanic.
- The current narrowest checked save-side wrapper for that lane is the `SaveData` mission-persistence neighborhood around `MissionsCompleted*`, `*MissionActive`, and `WastaFarmActiveCount`; cap and Daily Tokenium-specific ready or claimable ownership still remain unresolved.
- It is now safe to show imported `compatibility.unmappedSystemState.tokenShop.DailyTokenium` as explicitly labeled boundary-backed evidence in the forked user-surface spend snapshot, but not as canonical `state.playerProfile` and not as planner-ready cap or claimable state.
- It is now also safe to show imported `compatibility.unmappedSystemState.tokenShop.ClaimableTokenium` as explicitly labeled broader generic Tokenium-cluster claimable evidence in that same forked user-surface spend snapshot, but not as token-bank claimable state, Daily Tokenium-specific ready state, or canonical `state.playerProfile`.

## MultiverseMarket

### Verified now

- In-game system family: Chrystos Emporium / Inscryptions
- Unity owner: `MultiverseMarket`
- Extracted source:
  - [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
- Grounded outputs:
  - [`docs/systems/spend/multiverse-market-values.md`](docs/systems/spend/multiverse-market-values.md)
  - [`docs/systems/spend/multiverse-market-verification.md`](docs/systems/spend/multiverse-market-verification.md)
  - [`docs/systems/spend/multiverse-market-state-verification.md`](docs/systems/spend/multiverse-market-state-verification.md)
  - [`data/multiverse-market-values.json`](data/multiverse-market-values.json)
- Verified extracted fields in the validated late block include:
  - `ID`
  - `StartCost`
  - `CostExponent`
  - `Bonus`
  - `MaxLevel`
- Verified spend-lane shell evidence now includes:
  - `CurrencyBox` pointers beside validated inscription rows in the serialized owner payload
  - `CostBox-InscryptionsDone`
  - `AchievementBar-Inscryptions`
  - `MultiverseMarket, Assembly-CSharp` buy handlers such as `BuyIS47`, `BuyIS64`, `BuyIS73`, `BuyIS13`, and `BuyIS105`
- Verified saved-state narrowing now includes:
  - `Assets\Scripts\Data&Saving\Nakama\PlayerProfile\PlayerProfileData.cs`
  - `FillPlayerProfileData`
  - `GetPlayerProfileData`
  - `CloudSavePlayerProfile`
  - exact Emporium-adjacent metadata field clues such as `InscryptionsDone`, `IS1Level`, `IS50Level`, `IS51Level`, `IS64Level`, `IS73Level`, `IS110Level`, and `EsotericR1Trades`
  - a broader progression-style field block around `InscryptionsDone` that also includes `EsotericR*Trades`, `NecrumR*Trades`, and early `Mech*` fields

### Not yet verified enough for app recommendations

- the saved-state owner or runtime balance field behind the `Inscryptions Done` spend lane
- player-owned current inscription levels or equivalent ownership state
- full row coverage beyond the currently validated late block
- final remap from ids like `IS51` to grounded player-facing labels

### Current app implication

- It is safe to treat MultiverseMarket as a real system with partially grounded extracted constants.
- It is safe to stop inferring its spend lane from diamonds, tokens, or other unrelated player resources.
- It is not yet safe to treat `Inscryptions Done` as an import-ready player field even though `SaveData` is now the checked declaring owner for the broader `IS*Level` / trade-counter / mech block and `InscryptionsDone` itself is exactly declared on both `SaveData` and `PlayerProfileData`; the bounded import surface and current owned row levels are still unresolved.
- The current best repo-local saved-state path is the broader `PlayerProfileData` persistence family, not the raw `MultiverseMarket` owner object by itself.
- The repo now has exact metadata field names for this lane, but not the import-ready save contract for `state.playerProfile`.
- The recovered neighborhood now behaves like a wider progression-state field block, which further rules out treating nearby `AchievementInscryptionsReward` or `FinalIS*` symbols as the saved balance owner.

## Next allowed slice

The next spend-track slice should follow the first-slice contract above instead of inheriting every unresolved spend lane.

Priority order:

1. keep the shipped checked-row TokenShop row-detail slice subset-bound and non-optimizer
2. expand TokenShop row remap coverage only when more rows are actually needed by the next slice
3. recover player-owned current-level inputs for any additional TokenShop rows the next slice wants to show
4. recover token-bank, Daily Tokenium, or Emporium state only when a planned slice directly consumes those inputs
5. only after consumed inputs are grounded, consider broader spend recommendations with explicit assumptions

Continue this lane by default while those priorities still fit the same slice contract. Stop only when human input, human validation, or a real cross-lane choice changes the honest next move.
