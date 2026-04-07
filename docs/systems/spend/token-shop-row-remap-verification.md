# TokenShop Row Remap Verification

This note records the current grounded state of the TokenShop `ATU*Level` row-remap lane after exact `SaveData` ownership was recovered.

## Grounded evidence now preserved

- Raw player-owned row levels are grounded on `SaveData` as `ATU1Level` through `ATU28Level`.
- The grounded `TokenShop` owner payload preserves the same numbering family across row-shell fields such as `ATU1Button` through `ATU28MaxOverlay`.
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
- Some `ATU` rows demonstrably touch token, diamond, daily-token, or shard effect domains.
- Late `ATU` buy hooks also now sit inside a checked named tier-buy neighborhood instead of standing alone.
- That is still not the same as recovering grounded row identity.

The missing piece is still a checked join:

- no checked repo artifact currently joins any `ATU*Button` or `ATU*Content` path id directly to a specific `NewTokenUPGPrefab.*` object identity
- no checked repo artifact currently ties a concrete `ATU` number directly to a final player-facing TokenShop row title string
- no checked repo artifact currently bridges the generic `SetAllTokenShopTexts` or `SetTokenTexts` neighborhood to a specific `ATU` row number
- the repo now has three separate checked local clusters, but they remain unjoined:
  - `ATU`-numbered getter and buy-hook metadata
  - generic TokenShop text-handler hooks
  - prefab names and player-facing row-title strings in `level0`

Because those joins are still missing, the repo should not:

- infer row identity from row order alone
- infer row identity from `OR_*` labels
- infer row identity from community naming
- infer row identity from prefab-only naming without a checked object join

## Allowed implication

- Raw `ATU*Level` fields remain safe only under `compatibility.unmappedSystemState.tokenShop`.
- Canonical `state.playerProfile` promotion remains blocked.
- Planner-safe spend behavior remains blocked on row identity recovery, not on row-level owner recovery.

## Narrowest next slice

Recover one checked identity bridge from `ATU`-numbered TokenShop row shells to either:

- a specific `NewTokenUPGPrefab.*` object, or
- a final player-facing row title

The strongest next candidate is no longer “search for more row labels” in the abstract. It is specifically:

- bridge one `ATU*Button`, `ATU*Content`, or `SetTokenTexts`-side object neighborhood to either one concrete `NewTokenUPGPrefab.*` object or one concrete final row title

If only a subset clears that bar, keep the rest of the `ATU` family quarantined instead of forcing a full remap.
