$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $root "scripts\unity\run_extract.mjs"

node $runner uabea
