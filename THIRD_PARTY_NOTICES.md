# Third-Party Notices

This repository includes repo-owned code and data plus some third-party tools,
packages, and vendored support material needed for extraction and validation
work. The root [`LICENSE`](LICENSE) applies to repo-owned material only. It
does not replace the licenses of third-party software included in, referenced
by, or installed for this repository.

## Current third-party license locations in this repo

### Python-style vendored and cached dependencies

The repo currently contains temporary legacy dependency buckets that include
their own upstream license files:

- `.deps/`
- `.vendor_manual/`
- `.vendor_py/`
- `.wheelhouse/`

Examples of license-bearing paths that exist in the repo today:

- `.deps/unitypy-1.25.0.dist-info/licenses/LICENSE`
- `.deps/pyelftools-0.32.dist-info/LICENSE`
- `.deps/capstone-5.0.7.dist-info/LICENSE.TXT`
- `.deps/archspec-0.2.5.dist-info/LICENSE-MIT`
- `.deps/archspec-0.2.5.dist-info/LICENSE-APACHE`
- `.deps/archspec-0.2.5.dist-info/NOTICE`
- `.vendor_manual/pyelftools-0.32.dist-info/LICENSE`
- `.vendor_manual/capstone-5.0.7.dist-info/LICENSE.TXT`
- `.vendor_py/pyelftools-0.32.dist-info/LICENSE`
- `.vendor_py/capstone-5.0.7.dist-info/LICENSE.TXT`

When using material from those paths, preserve the upstream license file and
any notice file that shipped with that package.

### npm dependencies

The JavaScript dependency inventory for this repo lives in:

- `package.json`
- `package-lock.json`

This repo does not currently commit `node_modules/`. For npm packages, the
lockfile is the committed inventory, while package-specific license text is
normally provided by the installed package contents or the upstream package
source.

### GitHub Actions dependencies

GitHub-hosted workflow dependencies are referenced from:

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`

Those actions are not vendored into this repo. Their licenses live in their
upstream action repositories.

### Third-party tool payloads

The repo also contains third-party tool payload directories under:

- `tools/unity/AssetRipper/`
- `tools/unity/UABEA/`

If those payloads are refreshed or replaced, keep their upstream provenance and
license materials together with the tool payload or in an adjacent provenance
note.

## Vendoring expectation

When vendoring third-party material into this repo:

- keep the upstream license and notice files with the vendored content
- record the upstream source, version or commit, and why the repo needs a local copy
- prefer a single documented vendored location over scattered duplicate trees
- preserve provenance when copying binaries, source snapshots, or package contents

The repo's standing expectation is already documented in
`docs/repo/artifacts.md`: new vendored material should be consolidated and
carry a short provenance note rather than appearing as an undocumented cache or
ad hoc dump.
