# Ghidra Cleanup 2026-04-17

## Supported Path

The supported Ghidra path in this repo is now:

- persistent analyzed project under `workbench/ghidra-projects/`
- headless wrapper in `scripts/unity/ghidra_headless.py`
- repo-owned Jython post-script mirrored into Ghidra's built-in Jython script directory at runtime

## Removed or Demoted Paths

The following were experiment paths and should not be treated as supported workflow:

- standalone `pyghidra_*` scripts under `scripts/unity/`
- old Java script experiments under `scripts/unity/ghidra_scripts/`
- ad hoc one-project-per-job Ghidra imports as the main operating model

## Repository Decision

We **can** build a general reusable code layer over analyzed native code, but it should focus on:

- native compare/immediate search
- field-offset access search
- write-site tracing
- xref clustering around known anchors

We should **not** try to use Ghidra as a generic Unity object/model recovery system.
