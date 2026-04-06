# Repo Artifacts Policy

This document defines what may be committed to the repository and what must stay out of Git.

## Default rule

Commit only artifacts that are necessary to support the grounded MVP workflow, validation, or reproducible extraction work.

If an artifact does not have a clear repo-owned purpose, do not commit it.

## May be committed

### Contract-declared datasets

Repo-owned data under `data/` may be committed only when all of the following are true:

- the dataset is declared in `data/bundled-dataset-contract.v1.json`
- the dataset shape and semantics are described in [dataset-contracts](C:\Users\Shadow\Desktop\CiFi\docs\contracts\dataset-contracts.md)
- `npm run verify:data` passes against the committed result
- the data is grounded or explicitly labeled according to the contract classification

Undeclared generated JSON or markdown outputs must not be committed as if they were shipped repo truth.

### Small repo-owned docs and code

The following may be committed when they directly support the repo workflow:

- source code
- validation scripts
- small documentation files
- config files
- provenance notes
- checklists and operator docs

### Explicitly justified binary or extracted inputs

Binary or extracted inputs are disallowed by default. They may be committed only when all of the following are true:

- the repo materially depends on them for grounded extraction or validation work
- the reason they must live in the repo is written down in the relevant doc or provenance note
- their source and role are clear
- they are stored in the smallest practical form, with Git LFS when appropriate
- no smaller derived artifact would satisfy the same repo need

This exception is narrow. "Useful to keep around" is not enough.

## Must not be committed

Do not commit:

- extracted game assets by default
- temporary probe outputs that are not declared dataset artifacts
- temporary caches
- local dependency caches such as `.nuget`, `.dotnet`, `.appdata`, `__pycache__`, `.pytest_cache`, or similar
- ad hoc workbench dumps that are reproducible from committed inputs
- local virtualenvs or package-install targets
- large upstream tool payloads copied from third parties without a clear repo-local need
- duplicate vendored trees spread across multiple directories
- machine-local logs, scratch files, screenshots, or recovery leftovers unless they are explicitly promoted into a documented repo artifact

## Vendoring rule

If vendoring is required:

- consolidate it under `vendor/`
- do not scatter vendored payloads across `.deps/`, `.vendor_*`, `tmp*`, or tool-specific cache folders
- include a short provenance note beside the vendored content

Each vendored package or subtree should record:

- upstream source
- version or commit
- why the repo needs a local copy
- whether it is runtime-critical, extraction-critical, or only a fallback
- any size or licensing constraints that affected the decision

If a vendored payload does not meet that bar, do not commit it.

## Promotion gate

Before committing a new artifact, verify:

1. whether it is repo-owned truth, a checked supporting dataset, vendored support code, or only a local working file
2. whether the artifact is already covered by the dataset contract or needs explicit documentation first
3. whether the same outcome could be achieved by committing a smaller derived file instead
4. whether the artifact belongs in `vendor/` with provenance rather than in an ad hoc folder
5. whether the artifact would still make sense to another contributor cloning the repo fresh

If the answer is unclear, do not commit the artifact yet.

## Current repo direction

The repo prefers:

- committed validated datasets
- compact derived evidence files
- documented provenance
- reproducible extraction scripts

The repo should avoid growing through unchecked binary dumps, cache snapshots, or broad tool vendoring.
