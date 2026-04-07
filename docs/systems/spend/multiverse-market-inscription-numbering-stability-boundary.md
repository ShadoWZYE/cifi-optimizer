# Multiverse Market Inscription Numbering-Stability Boundary

This note records the smallest checked wider boundary for where same-number inscription identity binding stays structurally stable and where it fails across the larger `IS*` set.

## Checked wider numbering boundary

- Across the checked `IS69-110` run, repo-local probes preserve same-number:
  - `ISNLevel`
  - `ISNID`
  - `BuyISN`
- Prefab numbering is the first checked layer that breaks:
  - stable through row `68`
  - broken from rows `69-74`
  - same-number form resumes at rows `75-110`
- The broken band is explicit in repo-local prefab names:
  - `ChrystosEmporiumUpgrade69-ID57`
  - `ChrystosEmporiumUpgrade70-ID58`
  - `ChrystosEmporiumUpgrade71-ID59`
  - `ChrystosEmporiumUpgrade72-ID60`
  - `ChrystosEmporiumUpgrade73-ID61`
  - `ChrystosEmporiumUpgrade74-ID62`
- The resumed same-number chain is also explicit in repo-local probes:
  - `ChrystosEmporiumUpgrade75-ID75`
  - `ChrystosEmporiumUpgrade78-ID78`
  - `ChrystosEmporiumUpgrade83-ID83`
  - `ChrystosEmporiumUpgrade110-ID110`

## Player-facing anchor limit

- Direct player-facing string anchors in the checked repo-local probes remain sparse:
  - `Inscryption 25: Shard Gains`
  - `Inscryption 46: Shards Gained`
  - `Inscryption 78: Ouroboros Orbs`
  - `Inscryption 83: Fast-Loop ML`
- Inside the resumed `75-110` same-number prefab run, only rows `78` and `83` currently complete the checked same-number identity-binding chain.
- Rows `71-74` remain settled as ordered-only mappings, and this wider boundary does not recover new player-facing identity for them.

Current grounded conclusion:

- the earliest checked same-number prefab failure is row `69`
- the checked broken same-number prefab band is rows `69-74`
- the checked same-number prefab chain resumes at row `75` and stays direct through row `110`
- this still does not ground new player-facing labels for unresolved rows
- the canonical import-safe subset stays empty
