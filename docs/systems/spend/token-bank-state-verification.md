# Token Bank State Verification Gate

This document records what is currently grounded about the TokenShop-connected token-bank state lane: bank capacity, fill or claim flow, daily tokenium signals, and chest-related token collection hooks.

It exists because TokenShop upgrade constants alone are not enough to integrate the system truthfully. The app also needs to understand the state lane those upgrades modify.

## Verified now

- `TokenShop` code-side methods expose an explicit token-bank state surface:
  - `get_TokenBankCap`
  - `get_ClaimableBankTokens`
  - `ClaimBankedTokens`
  - `IncreaseBankedTokens`
  - `SetBankFill`
  - `CheckTokenClaimNotification`
- The serialized `TokenShop` owner includes direct bank-related scene references:
  - `BankFill`
  - `TokenBankDescriptionText`
  - `TokenShopButtonNotification`
  - `NavButtonNotification`
- The APK or Unity strings expose bank and claim terminology that belongs to the real in-game lane:
  - `CLAIM BANKED TOKENS`
  - `ClaimBankedTokens`
  - `Total Tokens Harvested:`
  - `THE TOKEN BANK`
  - `LV. 1 - Token Bank Capacity x2`
  - `OR_TokenBankCap`
  - `OR_TokensFromChests`
- The same string pool also exposes chest and daily-token hooks tied to this lane:
  - `+0.2 Tokens Gained from Token Chests`
  - `+0.5 Tokens Gained from Token Chests`
  - `+1 Tokens Gained from Token Chests`
  - `+20% Tokens Gained from Daily Rewards & Events`
  - `+50% Tokens Gained from Daily Rewards & Events`
  - `0 / 2000 Daily Tokenium (from blue farm missions)`
  - `This upgrade increases the Daily Tokenium-553 cap by +200 per level`
- The metadata exposes derived token-bank outputs:
  - `<FinalDailyTokenBonus>k__BackingField`
  - `<FinalTokenBankCap>k__BackingField`
  - `<FinalTokenBankFillSpeed>k__BackingField`

## Grounded conclusions

- TokenShop is connected to a real token-bank accumulation and claim flow, not only a flat list of upgrade rows.
- There is a distinct cap concept for the token bank, and the build tracks final or derived cap state.
- There is a distinct fill or claimable amount concept for banked tokens, and the build tracks final fill-speed state.
- Exact typed save recovery now confirms `SaveData.BankedTokens` as the strongest current saved-state owner for the token-bank current stored amount.
- Token acquisition is split across at least:
  - banked tokens
  - token chests
  - daily tokenium
  - missions or events feeding daily tokenium
- TokenShop upgrades and nearby systems clearly modify this lane, but the exact saved owner for token-bank cap and claimable or ready state is still not recovered.
- Daily Tokenium should no longer be treated as a purely TokenShop-owned sub-lane. The stronger current evidence places it in the Academy or Farm Mission reward family that TokenShop modifies.

## Source narrowing from this pass

This pass did not close the full save boundary, but it did recover one exact current-state owner and narrow the remaining save-side search.

- `SaveData.BankedTokens`
  - Exact typed recovery in `data/archive/uabea-extract-report.json` now shows `BankedTokens` as a direct `SaveData` field with type `System.Single`.
  - Why it matters: this is the first exact save-side owner recovered for the token-bank lane itself, and it grounds the current stored token-bank amount without promoting any wider planner behavior.
- `ClaimableBankTokens` and `TokenBankCap`
  - The same checked typed save tables do not currently expose `ClaimableBankTokens` or `TokenBankCap` on `SaveData` or `PlayerProfileData`.
  - Why it matters: cap and claimable or ready state remain blocked even though `BankedTokens` is now grounded, so the repo should not collapse the whole lane into one resolved owner claim.
- `SaveData.ClaimableTokenium`
  - Exact typed recovery also exposes `ClaimableTokenium` as a direct `SaveData` field with type `System.Double`.
  - Why it matters: this is one concrete saved claimable field beyond `BankedTokens`, but it sits on the broader generic Tokenium cluster rather than on a checked token-bank-specific cap, claimable-bank, or ready-state wrapper.
- broader `PlayerProfile` persistence neighborhood
  - Exact typed recovery now also preserves `PlayerProfileHandler.saveInfoCache: PlayerProfileData` and `PlayerProfileHandler.ConvertSaveDataToProfileData(SaveData, System.DateTime) -> PlayerProfileData`.
  - The same checked direct `PlayerProfileData` field table still only exposes generic `Tokens: System.String` and `Tokenium: System.String` wrapper fields in this lane, not `BankedTokens`, `ClaimableBankTokens`, or `TokenBankCap`.
  - Why it matters: the broader save-to-profile bridge is now checked tightly enough to rule out the obvious `PlayerProfileData` export surface as the missing exact bank-cap or claimable-bank owner.
- `CloudSavePlayerProfile`
  - The checked direct target-type recovery does not surface `CloudSavePlayerProfile` as a found typed target in this pass.
  - The surviving metadata neighborhood only preserves cloud-save orchestration terms such as `OnCloudSaveClick`, `GetCurrentSaveFileInfo`, `CloudLoad`, `GetPlayerProfileInfo`, `<CloudSavePlayerProfile>d__24`, and transient locals like `<saveData>5__2` plus `<lastCloudSave>5__3`.
  - Why it matters: this narrows the cloud-save side one step further into a metadata-only save/load shell instead of a deeper declaring wrapper for token-bank cap, claimable-bank, or ready-state ownership.

- `OR_TokenBankCap` and `OR_TokensFromChests`
  - Current evidence points to these being mechanic-named resource assets in `sharedassets0.assets`, not the underlying numeric formula objects.
  - Why: the byte shape matches the same width or height or payload pattern seen in other `OR_*` resource entries, and the formula probe already showed these names behaving like asset resources rather than compact balance tables.
- `TokenShop`
  - Still the strongest known controller-side owner for the token-bank lane because it exposes `get_TokenBankCap`, `get_ClaimableBankTokens`, `ClaimBankedTokens`, `IncreaseBankedTokens`, and `SetBankFill`.
- `level0` scene and UI wiring
  - Still the strongest remaining search area for claim, fill, and text-handler joins, because current evidence places bank strings, claim strings, and the `TokenShop` MonoBehaviour there.

Safe repo conclusion:

- treat `SaveData.BankedTokens` as the current exact saved-state owner for token-bank stored amount only
- do not treat that exact `BankedTokens` recovery as proof that cap or claimable or ready state are recovered too
- do not treat exact `SaveData.ClaimableTokenium` recovery as proof of token-bank-specific claimable or ready-state ownership
- do not treat `PlayerProfileData.Tokens` or `PlayerProfileData.Tokenium` as token-bank cap or claimable-bank owners; they are still only generic wrapper or export strings in the checked persistence neighborhood
- do not treat the metadata-only `CloudSavePlayerProfile` save/load shell as a hidden wrapper clearance
- do not treat `OR_TokenBankCap` or `OR_TokensFromChests` as recovered formulas
- treat them as grounded naming or asset-family clues
- keep the next extraction pass focused on the remaining save-side owner for token-bank cap and claimable state instead of reopening controller-only, derived-output, or cloud-save orchestration surfaces

## Handler split recovered from this pass

One key point is now grounded enough to record: the token-bank lane is not represented by a single visible scene family.

- `TokenShop, Assembly-CSharp`
  - Evidence: `ClaimBankedTokens` appears directly beside `TokenShop, Assembly-CSharp`
  - What it closes: claim behavior is concretely attached to the TokenShop controller path, not just to generic token UI.
- `BigStatisticPrefab.TokenBankCap`
  - Evidence: `BigStatisticPrefab.TokenBankCap` sits in the same `level0` prefab family as other statistic cards like `BigStatisticPrefab.TokenExponent`
  - What it closes: token-bank cap has a dedicated statistic-display shell in `level0`, separate from the controller method names.
- `TextHandlerLoopMods, Assembly-CSharp` -> `SetLM244BonusText`
  - Evidence: the string `0 / 2000 Daily Tokenium (from blue farm missions)` appears directly beside `TextHandlerLoopMods, Assembly-CSharp` and `SetLM244BonusText`
  - What it closes: at least one daily-tokenium presentation path is currently attached to a loop-mod text handler, not only to TokenShop.
- `Collector` pack presentation
  - Evidence: `(x2 Daily Tokenium Max Cap)` appears beside `YOU HAVE ACQUIRED THE COLLECTORS PACK`
  - What it closes: daily-tokenium cap is also modified by a separate IAP bonus lane, not only by baseline TokenShop progression.

Safe repo conclusion:

- `ClaimBankedTokens` belongs to the TokenShop controller lane.
- token-bank cap display belongs to a `BigStatisticPrefab` statistic shell.
- daily-tokenium cap messaging is at least partly wired through loop-mod and IAP presentation paths.
- this is enough to stop treating the token-bank lane as one unmapped monolith, even though the saved-state owner is still unresolved.

## LM244 conclusion from this pass

This pass closes one specific open question: `LM244` should currently be treated as a presentation or explanation hook, not as the recovered gameplay owner for daily tokenium.

Evidence:

- the strongest `LM244` hit in `level0` is `TextHandlerLoopMods, Assembly-CSharp` -> `SetLM244BonusText`
- the nearby context is dominated by UI-facing strings and handlers:
  - `ButtonRecoloring, Assembly-CSharp`
  - `LM244Recolor`
  - `PlayOpenTooltipSound`
  - `SetActive`
  - the rendered string `0 / 2000 Daily Tokenium (from blue farm missions)`
- no nearby recovered string points to a saved-state field, numeric bank-cap field, or dedicated token-bank controller method the way `ClaimBankedTokens` does for `TokenShop`

Safe repo conclusion:

- `LM244` is currently grounded as a loop-mod text path for explaining or displaying a daily-tokenium bonus
- `LM244` is not yet grounded as the gameplay owner of daily tokenium itself
- future saved-state recovery should keep looking past `LM244` toward the real mission, tokenium, or player-state owners

## Daily Tokenium lane correction

This pass also closes a broader track question: Daily Tokenium currently belongs to an Academy or Farm Mission lane that multiple systems touch.

Evidence:

- `SpaceAcademy` exists as a real scene shell beside `TokenShopButton` and `LoopModifiers`
- `FarmMissions`, `FarmMission1`, `FarmMission2`, `FarmMission3`, and `FarmMission4-C12` exist as real mission-prefab labels
- `0 / 2000 Daily Tokenium (from blue farm missions)` ties the reward directly to farm missions
- `This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)` ties one modifier path back to the mission lane
- `The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu` ties a premium modifier to the same Academy-facing lane

Safe repo conclusion:

- the underlying lane is currently best modeled as an Academy or Farm Mission reward family
- `TokenShop` is one modifier family on that lane
- `LoopModifiers` is an unlock or presentation family on that lane
- the Collector pack is another modifier family on that lane

See also: [`docs/systems/spend/daily-tokenium-mission-lane-verification.md`](docs/daily-tokenium-mission-lane-verification.md)

## Not yet verified enough for app integration

- the actual saved player-owned fields for:
  - current claimable bank tokens
  - current bank cap
  - any distinct saved fill or ready-state field beyond `SaveData.BankedTokens`
  - current daily tokenium amount or daily tokenium cap
- whether `BankFill` is only a UI progress object or also directly mirrors serialized state
- the exact relationship between:
  - token chests
  - banked tokens
  - ad tokens
  - `Tokenium` or `Tokenium-553`
  - daily tokenium from missions or events
- the owner object or formula source behind `FinalTokenBankCap`, `FinalTokenBankFillSpeed`, and `FinalDailyTokenBonus`
- the exact `level0` handler or serialized object that joins TokenShop methods to those final derived outputs
- which non-TokenShop systems feed this lane directly, versus only modifying it indirectly
- the actual gameplay owner behind the daily-tokenium mission lane now that `LM244` has been narrowed to a text or explanation surface
- the actual saved-state owner for the Academy or Farm Mission reward lane that Daily Tokenium belongs to

## Related systems signaled for later mapping

This lane already points to several future owner families that matter beyond the current spend track:

- `Mission / farm mission rewards`
  - Evidence: `0 / 2000 Daily Tokenium (from blue farm missions)`
  - Why it matters: daily tokenium is not only a shop-side concept; it appears to depend on mission systems too.
- `Chest systems`
  - Evidence: token chest gain strings, `GoToClosedTokenChest`, `AUTO-COLLECTION OF TOKEN CHESTS`, `TokenAd`, `AdTokens-*`
  - Why it matters: the bank lane and chest lane likely share currency sources or modifiers, but they are not yet mapped to a single owner.
- `IAP / permanent pack modifiers`
  - Evidence: `collector` pack description `Increases Mission Mats & Daily Tokenium Cap!`, plus `tokenauto` and `chestspeedster` product ids
  - Why it matters: permanent purchase modifiers can change the same token-bank or chest lane and must stay labeled separately from canonical base-state progression.
- `Resource and UI shell families`
  - Evidence: `Resource_Tokenium`, `Resource_Tokenium_Cap`, `AvailableTokensBar`, `CostBox-Tokenium`, `CostBox-Tokens`
  - Why it matters: the repo will eventually need a clean label map between tokens, tokenium, banked tokens, and ad-token presentation.

## Current app implication

- It is now safe to say TokenShop sits on top of a real token-bank state lane with cap, fill, and claim concepts.
- It is now safe to say the current token-bank stored amount is grounded more narrowly as `SaveData.BankedTokens`, while cap and claimable or ready state remain blocked.
- It is now also safe to say `SaveData.ClaimableTokenium` is a broader generic claimable Tokenium field, not a cleared token-bank-specific claimable-bank or ready-state owner.
- It is still not safe to put token-bank values into `state.playerProfile` as canonical fields until the saved-state owner and naming are recovered.
- It is now safe to treat the TokenShop controller shell, the `BigStatisticPrefab.TokenBankCap` display shell, and the `FinalTokenBank*` derived-output cluster as non-owner surfaces for save-state recovery.
- It is now safe to keep token-bank cap and claimable or ready-state recovery beyond the checked `PlayerProfileHandler.saveInfoCache` / `ConvertSaveDataToProfileData(...) -> PlayerProfileData` export bridge instead of treating `TokenShop` methods, direct `PlayerProfileData.Tokens` or `Tokenium` wrapper strings, the broader generic `SaveData.ClaimableTokenium` field, the metadata-only `CloudSavePlayerProfile` save/load shell, or `FinalTokenBank*` symbols as recovered saved-state owners.
- Any future planner or import work should treat token-bank state as `available but unmapped` until those owned fields are proven from assets.



