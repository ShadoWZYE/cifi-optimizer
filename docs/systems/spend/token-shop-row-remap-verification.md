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

## Grounded conclusion

- The repo can now say more than “ATU is unnamed.”
- Two exact shell-side bridges are now recovered:
  - `ATU1Button` -> TokenShop `TokenBoost` / `NewTokenUPGPrefab.T1.TokensBoost`
  - `ATU2Button` -> `NewTokenUPGPrefab.T1.DiamondBoost`
- Some `ATU` rows demonstrably touch token, diamond, daily-token, or shard effect domains.
- Late `ATU` buy hooks also now sit inside a checked named tier-buy neighborhood instead of standing alone.
- That is still not the same as recovering grounded row identity for the whole family.
- The immediate adjacency test does not justify a reusable “neighbor rows follow the same remap pattern” rule:
  - `ATU1` clears because the repo has one more three-surface convergence across owner fields, effect hooks, action hooks, and prefab identity.
  - `ATU3Button` still sits beside the `CellBoost*` field family, but the committed repo evidence now narrows the blocker more sharply than simple adjacency.
  - the nearest named action surface is `BuyCellBoost`, not an `ATU3`-specific buy hook.
  - the surviving named cells-domain identity clues split across separate checked clusters instead of converging:
    - diamond-special surface: `NewDiamondUPGPrefab.Specials.CellsBoost` and `>Diamond Upgrade 10 - CellsBoost`
    - token-prefab and title surface: `NewTokenUPGPrefab.T1.CellsPerChestBooster`, `NewTokenUPGPrefab.T5.UltimaCells`, and `Token Ultima: Cells`
  - none of those committed surfaces currently provides a checked object or text join back to `ATU3Button` path id `15810`.

The remaining missing pieces are still checked joins:

- no checked repo artifact currently ties `ATU1Button` or `ATU2Button` directly to a final player-facing TokenShop row title string
- no checked repo artifact currently joins the remaining `ATU*Button` or `ATU*Content` path ids directly to specific `NewTokenUPGPrefab.*` object identities
- no checked repo artifact currently ties the remaining concrete `ATU` numbers directly to final player-facing TokenShop row titles
- no checked repo artifact currently bridges the generic `SetAllTokenShopTexts` or `SetTokenTexts` neighborhood to a specific `ATU` row number
- the repo still has separate checked local clusters around most rows:
  - most `ATU`-numbered getter and buy-hook metadata
  - generic TokenShop text-handler hooks
  - most prefab names and player-facing row-title strings in `level0`

Because those joins are still missing, the repo should not:

- infer row identity from row order alone
- infer row identity from `OR_*` labels
- infer row identity from community naming
- infer row identity from prefab-only naming without a checked object join

## Grounded ATU3 follow-up conclusion

- `ATU3Button` does not yet clear as one grounded bridge.
- The repo now has a tighter blocked conclusion for this exact shell:
  - committed evidence proves a cells-domain split, not a resolved row identity
  - `CellBoost*` still grounds the adjacent owner-field block on the `TokenShop` payload
  - `BuyCellBoost` proves a generic named buy surface exists for the same cells domain
  - `NewDiamondUPGPrefab.Specials.CellsBoost` with `>Diamond Upgrade 10 - CellsBoost` proves one separate diamond-special identity surface
  - `NewTokenUPGPrefab.T1.CellsPerChestBooster`, `NewTokenUPGPrefab.T5.UltimaCells`, and `Token Ultima: Cells` prove separate token-prefab and title surfaces
  - no checked repo artifact joins any of those named cells surfaces directly to `ATU3Button` or path id `15810`

## Allowed implication

- Raw `ATU*Level` fields remain safe only under `compatibility.unmappedSystemState.tokenShop`.
- Canonical `state.playerProfile` promotion remains blocked for the unrecovered rows.
- Planner-safe spend behavior remains blocked on row identity recovery, not on row-level owner recovery.

## Narrowest next slice

Recover one more checked identity bridge from the still-unresolved `ATU`-numbered TokenShop row shells to either:

- a specific `NewTokenUPGPrefab.*` object, or
- a final player-facing row title

The strongest next candidate is no longer “find any first bridge.” It is specifically:

- for `ATU3`, run a cells-domain disambiguation pass that tries to join `ATU3Button` path id `15810` to one of three exact committed surfaces:
  - `BuyCellBoost`
  - the diamond-special `CellsBoost` prefab or title surface
  - the separate token-prefab or `Token Ultima: Cells` title surface

If only one additional subset clears that bar, keep the rest of the `ATU` family quarantined instead of forcing a full remap.
