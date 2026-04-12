# TokenShop Row Remap Verification

This note records the current grounded state of the TokenShop `ATU*Level` row-remap lane after exact `SaveData` ownership was recovered.

## Grounded evidence now preserved

- Raw player-owned row levels are grounded on `SaveData` as `ATU1Level` through `ATU28Level`.
- The grounded `TokenShop` owner payload preserves the same numbering family across row-shell fields such as `ATU1Button` through `ATU28MaxOverlay`.
- One concrete shell-to-prefab bridge is now recovered:
  - `ATU2Button` sits directly between the exact `DiamondBoost*` owner fields and the next named family in the checked `TokenShop` payload alignment.
  - broader checked probe output also preserves `ATU2DiamondsBonus`.
  - the checked `level0` prefab roster separately preserves `NewTokenUPGPrefab.T1.DiamondBoost`.
  - taken together, that is enough to ground `ATU2Button` to `NewTokenUPGPrefab.T1.DiamondBoost` without relying on community naming, `OR_*` labels, or generic row-order similarity alone.
- One immediate adjacent follow-up bridge also clears:
  - `ATU1Button` sits directly after the exact `TokenBoost*` owner fields and immediately before the recovered `DiamondBoost*` block in the checked `TokenShop` payload alignment.
  - broader checked probe output also preserves `ATU1TokenBonus`.
  - checked action-lane clues preserve the matching direct token buy family through `BuyTokenBoost`.
  - the checked `level0` prefab roster separately preserves `NewTokenUPGPrefab.T1.TokensBoost`.
  - taken together, that is enough to ground `ATU1Button` to the TokenShop `TokenBoost` or `NewTokenUPGPrefab.T1.TokensBoost` row family without relying on community naming, `OR_*` labels, or generic row-order similarity alone.
- One additional bounded shell-to-prefab bridge also clears:
  - `ATU5Button` sits directly after the exact `MK1TokenBoost*` owner fields in the checked `TokenShop` payload alignment.
  - checked action-lane clues preserve the matching direct buy hook through `BuyMK1TokenBoost`.
  - the checked `level0` prefab roster separately preserves `NewTokenUPGPrefab.T1.MK1Booster`.
  - taken together, that is enough to ground `ATU5Button` to `NewTokenUPGPrefab.T1.MK1Booster` without forcing a full T1 generator-booster lane remap or inventing a final player-facing row title.
- One more bounded shell-to-prefab bridge also clears:
  - `ATU4Button` sits directly after the exact `ModBoost*` owner fields in the checked `TokenShop` payload alignment.
  - checked action-lane clues preserve the matching direct buy hook through `BuyModBoost`.
  - the checked prefab roster separately preserves `NewTokenUPGPrefab.T1.ModPointsBooster`.
  - taken together, that is enough to ground `ATU4Button` to `NewTokenUPGPrefab.T1.ModPointsBooster` without forcing a full mod-domain title remap or inventing a final player-facing row title.
- One more bounded shell-to-prefab bridge also clears:
  - `ATU6Button` sits directly after the exact `MK2TokenBoost*` owner fields in the checked `TokenShop` payload alignment.
  - checked action-lane clues preserve the matching direct buy hook through `BuyMK2TokenBoost`.
  - the checked `level0` prefab roster separately preserves `NewTokenUPGPrefab.T1.MK2Booster`.
  - taken together, that is enough to ground `ATU6Button` to `NewTokenUPGPrefab.T1.MK2Booster` without forcing a full T1 generator-booster lane remap or inventing a final player-facing row title.
- One more bounded shell-to-prefab bridge also clears:
  - `ATU7Button` sits directly after the exact `MK3TokenBoost*` owner fields in the checked `TokenShop` payload alignment.
  - checked action-lane clues preserve the matching direct buy hook through `BuyMK3TokenBoost`.
  - the checked prefab roster separately preserves `NewTokenUPGPrefab.T1.MK3Booster`.
  - taken together, that is enough to ground `ATU7Button` to `NewTokenUPGPrefab.T1.MK3Booster` without forcing a full T1 generator-booster lane remap or inventing a final player-facing row title.
- One concrete shell-to-prefab-to-title chain now also clears on the same row:
  - the already grounded `ATU6Button` -> `NewTokenUPGPrefab.T1.MK2Booster` bridge now has one checked title-side follow-through.
  - the TokenShop text-handler search surface still runs through `SetAllTokenShopTexts` and `SetTokenTexts`, while the narrower checked title-side probe preserves the final player-facing title `Mk2 Generator Booster`.
  - that same checked title-side surface also preserves matching MK2-generator upgrade text: `This upgrade provides a 30% increase to the output of MK2 Generators.`
  - taken together, that is enough to preserve one concrete `ATU6Button` -> `NewTokenUPGPrefab.T1.MK2Booster` -> `Mk2 Generator Booster` chain without widening the rest of the unresolved `ATU` family.
- Checked probe output also preserves grounded non-label clues around some `ATU` rows:
  - effect hooks such as `ATU1TokenBonus`, `ATU2DiamondsBonus`, `ATU14TokenDailiesBonus`, `ATU20TokenBonus`, `ATU21TokenDailiesBonus`, and `ATU24Bonus3Shards`
  - late direct-buy hooks such as `BuyATU24`, `BuyATU25`, `BuyATU26`, `BuyATU27`, and `BuyATU28`
- Checked repo artifacts also preserve:
  - a prefab roster including `NewTokenUPGPrefab.T1.TokensBoost`, `NewTokenUPGPrefab.T2.DailyTokens`, `NewTokenUPGPrefab.T3.TrinityBoosterOne`, `NewTokenUPGPrefab.T4.Ultima`, and `NewTokenUPGPrefab.T5.CampaignFragments`
  - player-facing row strings including `Tokens Booster T2`, `Duo Booster Four`, `Trinity Booster One`, `Academy Booster`, `Trinity Oom Booster`, and `Tokens Booster T3`
- Checked metadata neighborhoods now preserve a tighter late-row action shell:
  - `BuyATU24` through `BuyATU28` sit beside named tier-buy hooks such as `BuyTokenT3`, `BuyTokenDailyT3`, `BuyTrio1Boost`, and `BuyTrio2Boost`
  - the same metadata block also keeps `ATU1TokenBonus`, `ATU2DiamondsBonus`, `ATU14TokenDailiesBonus`, `ATU24Bonus3Shards`, `get_ATU24Cost` through `get_ATU28Cost`, and `get_TotalT1TokenLevels` through `get_TotalT5TokenLevels` in one ATU-numbered family
- Checked `level0` neighborhoods also preserve three separate local clusters:
  - generic TokenShop text hooks such as `SetAllTokenShopTexts` and `SetTokenTexts`
  - the `NewTokenUPGPrefab.*` named-object roster
  - the player-facing row-title roster containing strings such as `Trinity Booster One`, `Academy Booster`, `Tokens Booster T3`, and `Campaign Fragments`
- A tighter committed read now narrows the text-hook surface further:
  - `SetAllTokenShopTexts` and `SetTokenTexts` sit in the checked `token` neighborhood with `CheckFirstTokenMenuTime`, `ClaimTokenium`, multiple `Tokens In Bank` formula strings, `TokenClaimRecolor`, and `TokenShopRecoloring`
  - that same checked neighborhood does not preserve any `ATU*Button` or `ATU*Content` shell
  - that same checked neighborhood does not preserve any `NewTokenUPGPrefab.*` object identity
  - that same checked neighborhood does not preserve any final player-facing TokenShop row title

## Grounded conclusion

- The repo can now say more than “ATU is unnamed.”
- Six exact shell-side bridges are now recovered:
  - `ATU1Button` -> TokenShop `TokenBoost` / `NewTokenUPGPrefab.T1.TokensBoost`
  - `ATU2Button` -> `NewTokenUPGPrefab.T1.DiamondBoost`
  - `ATU4Button` -> `NewTokenUPGPrefab.T1.ModPointsBooster`
  - `ATU5Button` -> `NewTokenUPGPrefab.T1.MK1Booster`
  - `ATU6Button` -> `NewTokenUPGPrefab.T1.MK2Booster`
  - `ATU7Button` -> `NewTokenUPGPrefab.T1.MK3Booster`
- One exact shell-to-prefab-to-final-title chain is now recovered:
  - `ATU6Button` -> `NewTokenUPGPrefab.T1.MK2Booster` -> `Mk2 Generator Booster`
- Some `ATU` rows demonstrably touch token, diamond, daily-token, or shard effect domains.
- Late `ATU` buy hooks also now sit inside a checked named tier-buy neighborhood instead of standing alone.
- The generic TokenShop text-hook surface does not recover one additional shell-to-title or shell-to-prefab bridge.
- That is still not the same as recovering grounded row identity for the whole family.
- The immediate adjacency test does not justify a reusable “neighbor rows follow the same remap pattern” rule:
  - `ATU1` clears because the repo has one more three-surface convergence across owner fields, effect hooks, action hooks, and prefab identity.
  - `ATU3Button` still sits beside the `CellBoost*` field family, but the committed repo evidence now narrows the blocker more sharply than simple adjacency.
  - the nearest named action surface is `BuyCellBoost`, not an `ATU3`-specific buy hook.
  - the surviving named cells-domain identity clues split across separate checked clusters instead of converging:
    - diamond-special surface: `NewDiamondUPGPrefab.Specials.CellsBoost` and `>Diamond Upgrade 10 - CellsBoost`
    - token-prefab and title surface: `NewTokenUPGPrefab.T1.CellsPerChestBooster`, `NewTokenUPGPrefab.T5.UltimaCells`, and `Token Ultima: Cells`
  - none of those committed surfaces currently provides a checked object or text join back to `ATU3Button` path id `15810`.
  - the bounded ATU3 cells-domain disambiguation pass also now stays negative across the exact named candidates:
    - `BuyCellBoost` stays a generic TokenShop action cluster with `StartCellBostHold` and `StopCellBostHold`, not a direct ATU3 identity bridge
    - the diamond-special `CellsBoost` prefab and `>Diamond Upgrade 10 - CellsBoost` title remain a separate diamond lane
    - the token-side `NewTokenUPGPrefab.T1.CellsPerChestBooster`, `NewTokenUPGPrefab.T5.UltimaCells`, and `Token Ultima: Cells` clues remain a separate token lane
    - none of those checked surfaces crosses back to `ATU3Button` path id `15810`
  - `ATU4`, `ATU5`, `ATU6`, and `ATU7` clearing do not change that rule for the rest of the lane:
    - they clear because one exact owner-field block, one exact buy hook, and one exact token prefab converge on the same `ModBoost`, `MK1`, `MK2`, or `MK3` family
    - `ATU4Button` now clears the same shell-to-prefab bar through `BuyModBoost` and `NewTokenUPGPrefab.T1.ModPointsBooster`, but still does not have a checked final player-facing row title
    - the repo now has one checked final title join for `ATU6Button`, but still does not have one for `ATU5Button`
    - `ATU7Button` now clears the same shell-to-prefab bar through `BuyMK3TokenBoost` and `NewTokenUPGPrefab.T1.MK3Booster`, but this pass does not attempt a final player-facing row title
    - the neighboring `MK4` through `MK8` token rows stay unresolved until their own shell joins are checked individually

The remaining missing pieces are still checked joins:

- no checked repo artifact currently ties `ATU1Button` or `ATU2Button` directly to a final player-facing TokenShop row title string
- no checked repo artifact currently ties `ATU1Button`, `ATU2Button`, `ATU4Button`, `ATU5Button`, or `ATU7Button` directly to a final player-facing TokenShop row title string
- no checked repo artifact currently joins the remaining `ATU*Button` or `ATU*Content` path ids directly to specific `NewTokenUPGPrefab.*` object identities
- no checked repo artifact currently ties the remaining concrete `ATU` numbers directly to final player-facing TokenShop row titles
- no checked repo artifact currently bridges the generic `SetAllTokenShopTexts` or `SetTokenTexts` token-menu or token-bank neighborhood to a specific `ATU` row number
- the repo still has separate checked local clusters around most rows:
  - most `ATU`-numbered getter and buy-hook metadata
  - generic TokenShop text-handler hooks in a token-menu or token-bank cluster
  - most prefab names and player-facing row-title strings in `level0`

Because those joins are still missing, the repo should not:

- infer row identity from row order alone
- infer row identity from `OR_*` labels
- infer row identity from community naming
- infer row identity from prefab-only naming without a checked object join

## Grounded ATU3 follow-up conclusion

- `ATU3Button` does not yet clear as one grounded bridge.
- `SetAllTokenShopTexts` and `SetTokenTexts` also do not clear as a grounded bridge surface for any unresolved `ATU` shell.
- The repo now has a tighter blocked conclusion for this exact shell:
  - committed evidence proves a cells-domain split, not a resolved row identity
  - `CellBoost*` still grounds the adjacent owner-field block on the `TokenShop` payload
  - `BuyCellBoost` proves a generic named buy surface exists for the same cells domain
  - `NewDiamondUPGPrefab.Specials.CellsBoost` with `>Diamond Upgrade 10 - CellsBoost` proves one separate diamond-special identity surface
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster`, `NewTokenUPGPrefab.T5.UltimaCells`, and `Token Ultima: Cells` prove separate token-prefab and title surfaces
  - no checked repo artifact joins any of those named cells surfaces directly to `ATU3Button` or path id `15810`
- The new bounded ATU3 disambiguation pass does not change that blocked conclusion:
  - the checked `BuyCellBoost` lane still preserves only a generic TokenShop action cluster with `StartCellBostHold`, `StopCellBostHold`, and nearby unlabeled percent strings
  - the checked diamond-special surface still preserves `NewDiamondUPGPrefab.Specials.CellsBoost` and `>Diamond Upgrade 10 - CellsBoost` as a separate lane
  - the checked token-side surface still preserves `NewTokenUPGPrefab.T1.CellsPerChestBooster`, `NewTokenUPGPrefab.T5.UltimaCells`, and `Token Ultima: Cells` as a separate lane
  - none of those exact candidate surfaces yields one concrete object or title join back to `ATU3Button` path id `15810`
- The repo now also preserves one separate ATU3 effect-driven trace that does clear, but only as a cross-system gameplay lane instead of a standard prefab-or-title row remap:
  - the exact `TokenShop` owner payload still keeps `ATU3Button` path id `15810` directly beside the `CellBoost*` owner block
  - the checked action lane preserves `BuyCellBoost`
  - the shared effect-title surface preserves `Cells Booster <size="22"><i><color=#B5B5B5>(Chests)</i></color></size>`
  - the checked player-facing effect text preserves `<b>+1</b> Seconds "timeskip" to Cells Gained from Token & Diamond Chests.`
  - the raw parameter surface preserves `CellBoostBonus = 1` and `CellBoostMaxLevel = 60`, which is consistent with the surviving `+1` second derived effect text and the bounded level cap for the same row family
  - that is enough to preserve one bounded `ATU3Button` -> `BuyCellBoost` -> shared chest-effect lane chain, while still keeping the older diamond-side `CellsBoost` and token-side `CellsPerChestBooster` / `Token Ultima: Cells` clues as detached contrast surfaces
  - the remaining honest blocker is narrower: no committed source yet names the exact typed gameplay owner or chest-reward applier that consumes the `CellBoostBonus` parameter inside that shared Token & Diamond chest cells-gain system
- The next bounded ATU3 consumer-seam pass now tightens that break one step further without converting the row back into a prefab-or-title promotion:
  - the same shared `Cells Booster (Chests)` lane now has one checked handoff into the concrete `AdManager, Assembly-CSharp` chest consumer family
  - that consumer family preserves `StartTokenRoutine`, `<TokenChestRoutine>d__149`, `GoToClosedTokenChest`, `StartDiamondRoutine`, `<DiamondChestRoutine>d__155`, and `GoToClosedDiamondChest`
  - the same runtime shell also preserves `get_SmallAdCellGains`, `get_BigAdCellGains`, `<FinalAdTokenChestBonus>k__BackingField`, and `<FinalDiamondChestBonus>k__BackingField`
  - committed object output also preserves the concrete `TokenChest` and `DiamondChest` game objects for the same family
  - that is enough to preserve one bounded shared-effect-to-consumer-family handoff for ATU3, while the remaining honest blocker is now only the exact `CellBoostBonus` read or typed field handoff inside that consumer family
- The upgraded join-preservation probe also now makes the current extraction state explicit instead of scattering it across multiple artifacts:
  - the generated `data/unity-trace-bundle.json` artifact now preserves one bounded TokenShop family-structure trace audit inside the generic `probe:trace` workflow
  - that audit now groups the solved `ATU1`, `ATU2`, `ATU4`, `ATU5`, and `ATU6` shells beside the bounded `ATU3` and late `ATU24`-`ATU28` negatives so repeated proved edges and repeated missing edges can be judged from one checked bundle
  - the strongest repeated solved pattern is still shell adjacency plus one row-family proxy hook and one exact prefab identity, while `ATU6Button` remains the only exact shell-to-prefab-to-title exemplar through `Mk2 Generator Booster`
  - the repeated missing pattern is still title localization: `ATU1Button`, `ATU2Button`, `ATU4Button`, `ATU5Button`, and `ATU7Button` still stop short of one final player-facing row title join, while `ATU3Button` and the late `ATU24`-`ATU28` block still fail exact prefab-or-title identity localization outright
  - the shell-side owner window still survives only in `data/token-shop-values.json`
  - the `BuyCellBoost` action cluster still survives only in `data/daily-tokenium-lane-probe.json`
  - the surviving prefab identities still survive only as detached `lm244`, `UABEA`, or `unity-probe` hits
  - the surviving player-facing titles, support text, and generic `SetAllTokenShopTexts` or `SetTokenTexts` hooks still survive only as detached owner-probe or unity-probe string buckets
  - the same generic trace workflow still keeps the older ATU3 cells split negative, because no committed source carries one exact ATU3 shell id together with one exact prefab identity or final title in the same local container
- The bounded ATU4 title-side pass now stays negative across the exact mod-domain title surfaces:
  - the generic TokenShop text-hook surface still preserves `SetAllTokenShopTexts` and `SetTokenTexts`, but does not preserve any `ATU4Button` shell, path id `15796`, or exact row-local title join
  - the token-side mod title clue `Token Ultima: MP` still survives only as a detached title surface
  - the diamond-side mod title clue `:Diamond Upgrade 11 - ModBoost` still survives only as a separate title surface
  - none of those committed title-side surfaces crosses back to `ATU4Button` or path id `15796`
- The bounded ATU5 title-side pass also now stays negative across the exact MK1 generator title surfaces:
  - the generic TokenShop text-hook surface still preserves `SetAllTokenShopTexts` and `SetTokenTexts`, but does not preserve any `ATU5Button` shell, path id `15831`, or exact row-local title join
  - the surviving MK1 generator title-side clues still preserve only detached support text such as `1. MK1 Generator Output,`, `This upgrade divides the cost of MK1 Generators by 1500.`, and `This upgrade provides a 1% increase to MK1 Generator Output for each Loop Reset you've done (multiplicative)`
  - the checked owner-side generator title roster still preserves neighboring `Mk2 Generator Booster`, `Mk3 Generator Booster`, and `Mk5 Generator Booster` titles, but does not preserve one exact `Mk1 Generator Booster`
  - none of those committed title-side surfaces crosses back to `ATU5Button` or path id `15831`
- The bounded ATU7 bridge-only pass now clears without reopening title localization:
  - the exact `TokenShop` owner payload keeps `ATU7Button` path id `15792` directly beside the `MK3TokenBoost*` owner block
  - the checked action lane preserves `BuyMK3TokenBoost`
  - checked prefab surfaces preserve `NewTokenUPGPrefab.T1.MK3Booster` across `UABEA`, `unity-probe`, and `lm244` artifacts
  - that is enough to preserve one bounded `ATU7Button` -> `NewTokenUPGPrefab.T1.MK3Booster` bridge without making any final player-facing title claim
- The repo also now has a tighter blocked conclusion for the generic text-hook search surface:
  - committed `level0` evidence places `SetAllTokenShopTexts` and `SetTokenTexts` in a token-menu or token-bank text-handler cluster
  - that cluster includes `CheckFirstTokenMenuTime`, `ClaimTokenium`, `LV. 1 - (Tokens In Bank)^1.05`, `LV. 1 - Token Bank Capacity x2`, `TokenClaimRecolor`, and `TokenShopRecoloring`
  - the checked prefab roster remains separate and includes names such as `NewTokenUPGPrefab.T2.DailyTokens`, `NewTokenUPGPrefab.T2.DuoBoosterFour`, `NewTokenUPGPrefab.T3.TrinityBoosterOne`, `NewTokenUPGPrefab.T5.CampaignFragments`, and `NewTokenUPGPrefab.T5.UltimaCells`
  - the checked player-facing title roster remains separate and includes names such as `Token Ultima: Cells`, `Tokens Booster T2`, `Tokens Booster T3`, `Trinity Booster One`, and `Academy Booster`
  - no checked repo artifact crosses from that generic text-hook cluster to one concrete `ATU` shell, exact prefab identity, or final player-facing row title

## Grounded late-shell follow-up conclusion

- The late `ATU24` through `ATU28` shell neighborhood also does not yet clear as one grounded bridge.
- The repo now has a tighter late-shell negative result than the older generic “late ATU clues exist” summary:
  - committed TokenShop owner payload data preserves the exact shell-side neighborhood through `ATU24Button` path id `15797`, `ATU25Button` `15820`, `ATU26Button` `15840`, `ATU27Button` `15832`, and `ATU28Button` `15813`
  - the same checked neighborhood also preserves direct `StartATU24Hold` through `StartATU28Hold`, matching `StopATU24Hold` through `StopATU28Hold`, and direct `BuyATU24` through `BuyATU28`
  - committed `level0` title neighborhoods preserve one tighter local roster with `Duo Booster Four`, `Trinity Booster One`, `Academy Booster`, `Trinity Oom Booster`, `Tokens Booster T3`, and `Tier 3 Max Level Increaser`
  - committed `level0` object neighborhoods preserve one tighter local prefab roster with `NewTokenUPGPrefab.T3.TokensBoost`, `NewTokenUPGPrefab.T4.Tier3MaxLevelIncreaser`, `NewTokenUPGPrefab.T3.TrinityBoosterOne`, `NewTokenUPGPrefab.T5.TrinityOomBooster`, and `NewTokenUPGPrefab.T2.DuoBoosterFour`, while `NewTokenUPGPrefab.T5.CampaignFragments` remains on a separate effect-side surface
  - committed effect-side probes also preserve narrower late-lane clues such as `ATU24Bonus3Shards`, `LV. 1 - x1.1 Campaign Fragments`, and `LV. 3 - Academy Points x3`
- That still does not clear one concrete late-row remap:
  - no checked repo artifact crosses the late title roster back to `ATU24Button` through `ATU28Button`
  - no checked repo artifact crosses the late prefab roster back to `ATU24Button` through `ATU28Button`
  - the late title roster and late prefab roster are also not one clean shell-local one-to-one match, because `Academy Booster` survives in the local title cluster while `Campaign Fragments` survives on a separate effect-side prefab and text surface
  - that means the repo still cannot honestly map `ATU24` through `ATU28` from row order, title similarity, prefab-only naming, or effect-text similarity

## Allowed implication

- Raw `ATU*Level` fields remain safe only under `compatibility.unmappedSystemState.tokenShop`.
- Canonical `state.playerProfile` promotion remains blocked for the unrecovered rows and for the recovered shell-to-prefab bridges unless a separate player-facing row-title join clears.
- Planner-safe spend behavior remains blocked on row identity recovery, not on row-level owner recovery.
- The remaining unrecovered `ATU` family should stay compatibility-only and out of planner logic until its own row-specific joins clear.
- The new `ATU6Button` title join does not promote broader planner or canonical use by itself; it only preserves one checked final-title chain while the rest of the family stays blocked.

## Narrowest next slice

Recover one more checked identity bridge from the still-unresolved `ATU`-numbered TokenShop row shells to either:

- a specific `NewTokenUPGPrefab.*` object, or
- a final player-facing row title

The strongest next candidate is no longer “find any first bridge.” The generic text-hook surface is now a bounded negative result, the bounded ATU3 prefab-or-title pass is negative, the separate ATU3 effect-driven chain now reaches the concrete `AdManager` chest routine family, and the late ATU24-ATU28 shell neighborhood is now a tighter negative result too, so the next honest candidate is:

- either tighten the remaining exact `CellBoostBonus` read or typed field handoff inside the preserved `ATU3Button` consumer family without promoting a prefab-or-title remap, or move to a different unresolved `ATU` shell and recover one more exact shell-to-prefab or shell-to-title bridge without reopening the already-bounded ATU3 identity split unless a new committed artifact explicitly crosses back to path id `15810`

If only one additional subset clears that bar, keep the rest of the `ATU` family quarantined instead of forcing a full remap.
