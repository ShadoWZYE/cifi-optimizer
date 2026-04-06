$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$project = Join-Path $root "tools\unity\CifiAssetProbe\CifiAssetProbe.csproj"
$outputDir = Join-Path $root "tools\unity\CifiAssetProbe\bin\probe-run"
$dllPath = Join-Path $outputDir "CifiAssetProbe.dll"

$env:DOTNET_CLI_HOME = Join-Path $root ".dotnet"
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"
$env:DOTNET_CLI_TELEMETRY_OPTOUT = "1"
$env:APPDATA = Join-Path $root ".appdata"
$env:NUGET_PACKAGES = Join-Path $root ".nuget\packages"

dotnet build $project -c Release --no-restore -o $outputDir | Out-Null
dotnet $dllPath
