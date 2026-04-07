# Multiverse Market 69-74 Anomaly Provenance

This note records where the settled `69-74` inscription anomaly first appears in checked repo-local evidence and whether the repo itself introduces it.

## Checked source split

- Raw app-side evidence preserved repo-locally already contains the anomaly:
  - [`workbench/unity/joined/level0`](workbench/unity/joined/level0)
  - [`data/unity-probe-report.json`](data/unity-probe-report.json)
  - [`data/uabea-probe-report.json`](data/uabea-probe-report.json)
- Repo-local derived summaries preserve that same split without changing its meaning:
  - [`data/multiverse-market-prefab-remap-boundary.json`](data/multiverse-market-prefab-remap-boundary.json)
  - [`data/multiverse-market-row71-74-remap-band.json`](data/multiverse-market-row71-74-remap-band.json)
  - [`data/multiverse-market-inscription-numbering-stability-boundary.json`](data/multiverse-market-inscription-numbering-stability-boundary.json)
  - [`data/multiverse-market-row69-74-identity-source-boundary.json`](data/multiverse-market-row69-74-identity-source-boundary.json)

## Earliest checked appearance

- The preserved `level0` asset already carries the broken prefab-band names:
  - `ChrystosEmporiumUpgrade69-ID57`
  - direct earlier shells `ChrystosEmporiumUpgrade59` through `ChrystosEmporiumUpgrade62`
- The raw probe reports preserve both sides of the split together:
  - same-number save-side and hook-side fields `IS69Level` through `IS74Level`, `IS69ID` through `IS74ID`, and `BuyIS69` through `BuyIS74`
  - remapped prefab shells `ChrystosEmporiumUpgrade69-ID57` through `ChrystosEmporiumUpgrade74-ID62`

Current grounded conclusion:

- the earliest checked appearance is raw app-side evidence, not a repo-local derived boundary
- the repo-local derived datasets inherit and describe the anomaly; they do not introduce it

## Standardization boundary

- No dataset standardization is applied in this lane.
- The reason is provenance, not preference:
  - normalizing the derived datasets to a newer canonical same-number prefab structure would erase inherited app-side truth
  - the repo must keep the anomaly represented until stronger app-side evidence proves the prefab layer itself changed

## Current grounded conclusion

- the `69-74` anomaly is app-side inherited
- rows `69-74` still have no grounded player-facing identity
- drift checks must therefore enforce alignment between raw app-side evidence, derived datasets, and verification docs without rewriting the inherited shape
