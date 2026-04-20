# Unity Extract Report (Archive Index)

This file used to contain a very large raw keyword-dump from APK and Unity assets. Most of the actionable findings from that dump have already been promoted into narrower docs and checked-in datasets, so the raw exhaustive listing is no longer the best instruction surface.

## What the old dump was used for

- locating candidate owner families
- spotting player-facing labels and serialized field names
- narrowing save/persistence search paths
- identifying which systems were real, adjacent, or only loosely related

## Current sources of truth

Use these first:

- `docs/unity/unity-audit-playbook.md`
- `docs/unity/unity-owner-map.md`
- `docs/unity/cifi-unity-recon.md`
- `docs/systems/spend/token-shop-values.md`
- `docs/systems/spend/multiverse-market-values.md`
- `docs/systems/spend/token-bank-state-verification.md`
- `docs/systems/spend/multiverse-market-verification.md`
- `docs/systems/spend/multiverse-market-state-verification.md`

## Scope reminder

Presence in asset strings does not make a system recommendation-ready. Owner mapping, currencies, labels, and required player-state inputs still need to pass the repo’s system-integration gate.

