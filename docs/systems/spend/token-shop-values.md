# Token Shop Values

Source: serialized `TokenShop` MonoBehaviour payload in [`workbench/unity/joined/level0`](workbench/unity/joined/level0), aligned to declaration-order field names recovered from [`workbench/apk/base/global-metadata.dat`](workbench/apk/base/global-metadata.dat).

## Grounded conclusions

- The token shop values are stored directly in the `TokenShop` scene object, not only in UI strings.
- The field layout confirms a named `StartCost`, `AdditiveCost`, `Bonus`, `MaxLevel` model for early token tiers.
- Tier-1 generator token boosts use `FillMaxLevel` instead of plain `MaxLevel`.
- Late token upgrades `ATU24` through `ATU28` are also serialized in the same object.

## Integration status

Verified enough for repo truth:

- `TokenShop` is a real owner for token-bank mechanics.
- Early and late token-upgrade constants are directly serialized.
- The extracted cost lane is now grounded as a token or tokenium lane, not as diamonds, shards, or another borrowed currency lane.

Not yet verified enough for app recommendations:

- current player-owned levels for these upgrades
- final remap from serialized ids to grounded player-facing labels
- full next-purchase logic beyond extracted constants

## Adjacent systems still to map

The extracted `TokenShop` payload is not isolated. Its field names and nearby Unity labels show several adjacent system families that should be mapped before TokenShop can become a native planner surface:

- `Token bank state`
  - Evidence: `BankFill`, `TokenBankDescriptionText`, `get_TokenBankCap`, `FinalTokenBankCap`, `FinalTokenBankFillSpeed`
  - Why it matters: next-purchase logic likely depends on current bank fill, cap, or token generation context, not only upgrade costs.
- `Academy / farm mission tokenium lane`
  - Evidence: `This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)`, plus `0 / 2000 Daily Tokenium (from blue farm missions)` and `The Collectors Pack increases Mission Materials gained & the Daily Cap of farmable Tokenium in the Academy Menu`
  - Why it matters: Daily Tokenium should currently be treated as an Academy or Farm Mission reward lane that TokenShop modifies, not as a TokenShop-only budget lane.
- `Diamond-related upgrade lane inside TokenShop`
  - Evidence: `DiamondBoostStartCost`, `DiamondBoostAdditiveCost`, `DiamondBoostBonus`, `DiamondBoostMaxLevel`, `NewTokenUPGPrefab.T1.DiamondBoost`
  - Why it matters: TokenShop contains at least one upgrade family whose effect naming crosses into the diamond domain, so the final label and effect mapping cannot be assumed from the serialized id alone.
- `Meltdown gating / tier state`
  - Evidence: `MeltdownActiveObject`, `MeltdownT2ActiveObject`, `MeltdownT3ActiveObject`, plus repeated `"The Meltdown" is a temporary system failure affecting your Token and Diamond up` strings in Unity probe output
  - Why it matters: tier availability, upgrade visibility, or modifier state may depend on a separate Meltdown system that is not yet mapped.
- `Upgrade prefab identity and player-facing labels`
  - Evidence: `NewTokenUPGPrefab.T1.*`, `NewTokenUPGPrefab.T2.*`, `NewTokenUPGPrefab.T3.*`, `NewTokenUPGPrefab.T4.*`, `NewTokenUPGPrefab.T5.*`
  - Why it matters: these prefab names are the strongest current bridge from serialized ids like `ATU24` or `T2Duo3` to real in-game names, but that remap is still incomplete.
- `Navigation, notification, and progression shell`
  - Evidence: `TokenShopButtonNotification`, `NavButtonNotification`, `ATU*Button`, `ATU*MaxOverlay`, `ATU*Content`, `ATU*Overlay`
  - Why it matters: these fields suggest there is separate unlock or notification logic around the shop, and that logic may expose missing owned-state inputs or gating conditions.

These adjacent systems should be treated as mapping dependencies, not as verified mechanics. Their presence is useful because it tells the repo which owner families and UI shells must be audited next.

## Currency-lane grounding

The repo can now make one narrower naming claim about the TokenShop spend lane without overselling planner readiness:

- `TokenShop` upgrade rows sit beside explicit token or tokenium naming evidence in shipped assets.
- The strongest current evidence is:
  - resource icons: `resourceicons/resource_tokenium` and `resourceicons/resource_tokenium_cap`
  - controller labels: `TokenBankDescriptionText`, `get_TokenBankCap`, `FinalTokenBankCap`, `FinalTokenBankFillSpeed`
  - mission-lane strings that stay adjacent but separate: `0 / 2000 Daily Tokenium (from blue farm missions)` and `This upgrade increases the Daily Tokenium-553 cap by +200 per level (allows you to farm more Tokenium-553 from Farm Missions)`
- Safe repo conclusion:
  - base TokenShop costs should currently be described as a token-bank token or tokenium spend lane
  - Daily Tokenium should stay separated as the Academy or Farm Mission reward lane that TokenShop modifies
  - this does not yet recover the final player-facing label for every upgrade row, nor the saved owned-state needed for next-buy planning

This closes one specific ambiguity from earlier passes: the repo should stop treating TokenShop costs as an unnamed generic spend pool.

## Future mapping signals

Based on current evidence, the next TokenShop-adjacent mapping passes should look for:

- player-owned current upgrade levels or equivalent saved state for `TokenShop` upgrade rows
- the owner or formula source for token-bank cap/fill progression
- the gameplay owner and saved-state family for the Academy or Farm Mission Daily Tokenium lane that TokenShop modifies
- the exact role of `DiamondBoost` inside the token shop versus the broader diamond-upgrade family
- the system that controls Meltdown active objects and whether it gates shop tiers
- the player-facing labels behind `ATU24` through `ATU28`, `T2Duo*`, and `T3Trio*`

## Downstream systems TokenShop upgrades appear to affect

The extracted TokenShop families do not only touch token income. Unity title/effect text shows that TokenShop upgrades likely feed into many other game systems. These links should be treated as mapping notes for future work, not as fully integrated mechanic truth.

- `Generators / base output`
  - Evidence: `Mk1 Generator Booster` through `Mk11 Generator Booster`, `All Gens Booster`, `Duo Booster*`, `Trinity Booster*`
  - Confirmed effect text includes: `x1.01 to Mk1 Output`, `x1.02 to Mk1 Output & Mk2 Output`, `x1.15 to All Generators Output (All Gens)`
  - Mapping implication: TokenShop cannot be modeled in isolation from generator-output terminology and owned generator state.
- `Token chest and token-bank economy`
  - Evidence: `Tokens Booster T1`, `Tokens Booster T2`, `TokenBoost*`, `get_ClaimableBankTokens`, `ClaimBankedTokens`
  - Confirmed effect text includes: `+0.2 Tokens Gained from Token Chests`, `+0.5 Tokens Gained from Token Chests`, `+1 Tokens Gained from Token Chests`
  - Mapping implication: planner work needs the actual relationship between chests, banked tokens, daily token bonuses, and claim flow.
- `Diamond chest economy`
  - Evidence: `DiamondBoost*`, `NewTokenUPGPrefab.T1.DiamondBoost`
  - Confirmed effect text includes: `+1 Diamonds Gained from Diamond Chests`
  - Mapping implication: the TokenShop touches a diamond-related reward lane, so diamond-chest systems must be understood before this upgrade family can be labeled or valued correctly.
- `Cells`
  - Evidence: `CellBoost*`, `Token Ultima: Cells`
  - Confirmed effect text includes: `x1.25 to Cells Gained`, `x1.0018 to Cells Gained for every level in any token upgrade`, `+1 Seconds timeskip to Cells Gained from Token & Diamond Chests`
  - Mapping implication: TokenShop contributes to both direct cell gain and cross-system scaling from total token levels.
- `Mod Points`
  - Evidence: `ModBoost*`, `Token Ultima: MP`
  - Confirmed effect text includes: `x1.01 to MP Gained`, `x1.0008 to MP Gained for every level in any token upgrade`, `x10 to MP Gained, Shards Gained & RP Gained`
  - Mapping implication: loop/mod systems are downstream of TokenShop, so those labels and ownership paths matter for any later valuation model.
- `Shards`
  - Evidence: `Shards Booster`, `Token Ultima: Shards`, `x1.0008 to Shards Gained for every level in any token upgrade`
  - Confirmed effect text includes: `x1.07 to Shards Gained`, `x1.02 to MP Gained & Shards Gained`
  - Mapping implication: shard gains are influenced by TokenShop, but that does not make shard milestones or shard planning grounded; it means shard-system mapping and TokenShop mapping will eventually have to meet at a verified interface.
- `Research Points`
  - Evidence: `Token Ultima: RP`, `Daily Tokens` / higher-tier effect strings
  - Confirmed effect text includes: `x1.1 to Research Points Gained (RP)`, `x1.0008 to RP Gained for every level in any token upgrade`
  - Mapping implication: research gain effects need their own grounded owner map before TokenShop effects can be ranked against them.
- `Academy Points`
  - Evidence: `x1.03 to All Generators Output, Shards Gained & AP Gained`, `x1.0008 to AP Gained for every level in any token upgrade`
  - Mapping implication: AP is another downstream lane touched by TokenShop totals, so future profile/state mapping needs a clean place for it.
- `Hunter / loot systems`
  - Evidence: `Hunter Loot Booster`, `Borge Loot`, `Ozzy Loot`, `Knox Loot`
  - Confirmed effect text includes: `+2.5% to Hunter Loot Gained`, `-3 seconds to Hunter Revive Time`, `x1.01 Loot Gained on Planet Exon-12 (Borge)`, `x1.01 Loot Gained on Planet Endo-Prime (Ozzy)`, `x1.01 Loot Gained on Planet Sirene-6 (Knox)`
  - Mapping implication: TokenShop interacts with multiple hunt/planet loot subsystems that are not yet owner-mapped in this repo.
- `Campaign missions / fragments`
  - Evidence: `CampaignFragments`
  - Confirmed effect text includes: `x1.02 to Fragments Gained from Campaign Missions`
  - Mapping implication: any future TokenShop planner will need mission/fragments terminology mapped before it can explain why that upgrade matters.
- `Ouroboros / orb economy`
  - Evidence: token effect text includes `+1% to Ouroboros Orbs Gained`
  - Mapping implication: TokenShop reaches into Ouroboros progression too, which confirms the user’s point that these systems are cross-interacting and need explicit boundaries.

The safe repo conclusion is that TokenShop is a canonical cross-system modifier hub. That makes system mapping more important, not less: every downstream label above needs a verified owner and naming path before TokenShop recommendations can be truthful.

## Selected values

- `TokenBoost`: `StartCost=20`, `AdditiveCost=5`, `Bonus=0.2`, `MaxLevel=20`
- `DiamondBoost`: `StartCost=200`, `AdditiveCost=300`, `Bonus=1`, `MaxLevel=2`
- `CellBoost`: `StartCost=1`, `AdditiveCost=0.25`, `Bonus=1`, `MaxLevel=60`
- `ModBoost`: `StartCost=10`, `AdditiveCost=2`, `Bonus=1.01`, `MaxLevel=200`
- `MK1TokenBoost`: `StartCost=1`, `AdditiveCost=0.1`, `Bonus=1.01`, `FillMaxLevel=5000`
- `MK2TokenBoost`: `StartCost=2`, `AdditiveCost=0.12`, `Bonus=1.01`, `FillMaxLevel=5000`
- `MK3TokenBoost`: `StartCost=3`, `AdditiveCost=0.13`, `Bonus=1.01`, `FillMaxLevel=5000`
- `TokenBoostT2`: `StartCost=1000`, `AdditiveCost=500`, `Bonus=0.5`, `MaxLevel=10`
- `TokenDailiesT2`: `StartCost=1000`, `AdditiveCost=800`, `Bonus=0.2`, `MaxLevel=10`
- `T2Duo3`: `StartCost=100`, `AdditiveCost=3`, `Bonus=1.02`, `MaxLevel=2500`
- `TokenBoostT3`: `StartCost=2500`, `AdditiveCost=750`, `Bonus=1`, `MaxLevel=25`
- `T3Trio1`: `StartCost=7000`, `AdditiveCost=100`, `Bonus=1.03`, `MaxLevel=2000`
- `ATU24`: `StartCost=40000000`, `Bonus1=1.001`, `Bonus2=1.0005`, `Bonus3=1.0003`, `Bonus4=1.0002`, `Bonus5=1.0001`
- `ATU25`: `StartCost=1000000`, `AdditiveCost=25000`, `Bonus=0.5`, `MaxLevel=50`
- `ATU26`: `StartCost=10000000`, `AdditiveCost=1000000`, `Bonus=1000`, `MaxLevel=15`
- `ATU27`: `StartCost=50000000`, `AdditiveCost=10000000`, `Bonus=500`, `MaxLevel=15`
- `ATU28`: `StartCost=250000000`, `AdditiveCost=50000000`, `Bonus=500`, `MaxLevel=15`

## Raw field alignment

The following early fields show the exact byte alignment between metadata names and serialized object data:

- offset `236` `MeltdownActiveObject` -> path `34124`
- offset `248` `MeltdownT2ActiveObject` -> path `34125`
- offset `260` `MeltdownT3ActiveObject` -> path `34129`
- offset `272` `BankFill` -> path `309975`
- offset `284` `TokenShopButtonNotification` -> path `899`
- offset `296` `NavButtonNotification` -> path `13639`
- offset `308` `TokenBankDescriptionText` -> path `290364`
- offset `320` `TokenBoostStartCost` -> 20
- offset `324` `TokenBoostAdditiveCost` -> 5
- offset `328` `TokenBoostBonus` -> 0.2
- offset `332` `TokenBoostMaxLevel` -> 20
- offset `336` `TokenBoostFill` -> path `294959`
- offset `348` `ATU1Button` -> path `15839`
- offset `360` `ATU1MaxOverlay` -> path `49520`
- offset `372` `DiamondBoostStartCost` -> 200
- offset `376` `DiamondBoostAdditiveCost` -> 300
- offset `380` `DiamondBoostBonus` -> 1
- offset `384` `DiamondBoostMaxLevel` -> 2
- offset `388` `DiamondBoostFill` -> path `295016`
- offset `400` `ATU2Button` -> path `15804`
- offset `412` `ATU2MaxOverlay` -> path `49464`
- offset `424` `CellBoostStartCost` -> 1
- offset `428` `CellBoostAdditiveCost` -> 0.25
- offset `432` `CellBoostBonus` -> 1
- offset `436` `CellBoostMaxLevel` -> 60
- offset `440` `CellBoostFill` -> path `294990`
- offset `452` `ATU3Button` -> path `15810`
- offset `464` `ATU3MaxOverlay` -> path `49488`
- offset `476` `ModBoostStartCost` -> 10
- offset `480` `ModBoostAdditiveCost` -> 2
- offset `484` `ModBoostBonus` -> 1.01
- offset `488` `ModBoostMaxLevel` -> 200
- offset `492` `ModBoostFill` -> path `295004`
- offset `504` `ATU4Button` -> path `15796`
- offset `516` `ATU4MaxOverlay` -> path `49474`
- offset `528` `ATU4Content` -> path `33007`

## Formula evidence

- `T2Duo3StartCost=100`, `T2Duo3AdditiveCost=3`, `T2Duo3Bonus=1.02`, `T2Duo3MaxLevel=2500`.
- This matches the in-game `Duo Booster Three` screenshots: cost at level `1722` is `100 + 3 * 1722 = 5266`, displayed as `5.27k` after rounding.

