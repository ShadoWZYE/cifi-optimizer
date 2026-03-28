$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$uabeaDir = Join-Path $root "tools\UABEA"
$gameRoot = Join-Path $root "_cifi_apk_merged\base"
$dataDir = Join-Path $gameRoot "assets\bin\Data"
$mainFile = Join-Path $dataDir "globalgamemanagers"
$reportPath = Join-Path $root "data\uabea-probe-report.json"
$metadataPath = Join-Path $root "_cifi_apk\global-metadata.dat"
$il2cppPath = Join-Path $root "_cifi_apk\libil2cpp.so"

[void][System.Reflection.Assembly]::LoadFrom((Join-Path $uabeaDir "AssetsTools.NET.dll"))
[void][System.Reflection.Assembly]::LoadFrom((Join-Path $uabeaDir "AssetsTools.NET.Cpp2IL.dll"))

$manager = [AssetsTools.NET.Extra.AssetsManager]::new()
$manager.LoadClassPackage((Join-Path $uabeaDir "classdata.tpk")) | Out-Null

$afileInst = $manager.LoadAssetsFile($mainFile, $true)
$afile = $afileInst.file

$uv = $afile.Metadata.UnityVersion
$manager.LoadClassDatabaseFromPackage($uv) | Out-Null

$cpp2il = [AssetsTools.NET.Cpp2IL.Cpp2IlTempGenerator]::new(
    $metadataPath,
    $il2cppPath
)
$cpp2il.SetUnityVersion($uv)
$cpp2il.InitializeCpp2IL()
$manager.MonoTempGenerator = $cpp2il

$classIds = [AssetsTools.NET.Extra.AssetClassID]

$monoScriptByPath = @{}
$monoScriptSummaries = New-Object System.Collections.Generic.List[object]

foreach ($scriptInfo in $afile.GetAssetsOfType($classIds::MonoScript)) {
    try {
        $baseField = $manager.GetBaseField($afileInst, $scriptInfo, [AssetsTools.NET.Extra.AssetReadFlags]::None)
        $scriptName = $baseField["m_Name"].AsString
        $className = $baseField["m_ClassName"].AsString
        $namespaceName = $baseField["m_Namespace"].AsString
        $assemblyName = $baseField["m_AssemblyName"].AsString
        $record = [pscustomobject]@{
            pathId = $scriptInfo.PathId
            scriptName = $scriptName
            className = $className
            namespaceName = $namespaceName
            assemblyName = $assemblyName
        }
        $monoScriptByPath[$scriptInfo.PathId] = $record
        $monoScriptSummaries.Add($record)
    } catch {
    }
}

$interestingPattern = 'Upgrade|Milestone|Loop|Shard|Diamond|Token|Ouro|Research|Borge|Chrystos|Emporium|Bonus|Cost|Level'
$interestingScripts =
    $monoScriptSummaries |
    Where-Object {
        $_.scriptName -match $interestingPattern -or
        $_.className -match $interestingPattern -or
        $_.namespaceName -match $interestingPattern
    } |
    Sort-Object className, scriptName

$monoBehaviours = New-Object System.Collections.Generic.List[object]

foreach ($mbInfo in $afile.GetAssetsOfType($classIds::MonoBehaviour)) {
    try {
        $baseField = $manager.GetBaseField($afileInst, $mbInfo, [AssetsTools.NET.Extra.AssetReadFlags]::None)
        if ($null -eq $baseField) {
            continue
        }

        $scriptPtr = $baseField["m_Script"]
        $scriptPathId = $scriptPtr["m_PathID"].AsLong
        $scriptMeta = $monoScriptByPath[$scriptPathId]
        if ($null -eq $scriptMeta) {
            continue
        }

        if (
            $scriptMeta.scriptName -notmatch $interestingPattern -and
            $scriptMeta.className -notmatch $interestingPattern -and
            $scriptMeta.namespaceName -notmatch $interestingPattern
        ) {
            continue
        }

        $fieldNames = New-Object System.Collections.Generic.List[string]
        foreach ($child in $baseField) {
            if ($child.Name -notin @("m_ObjectHideFlags", "m_CorrespondingSourceObject", "m_PrefabInstance", "m_PrefabAsset", "m_GameObject", "m_Enabled", "m_EditorHideFlags", "m_Script", "m_Name")) {
                $fieldNames.Add($child.Name)
            }
        }

        $monoBehaviours.Add([pscustomobject]@{
            pathId = $mbInfo.PathId
            classId = $mbInfo.ClassId
            scriptPathId = $scriptPathId
            scriptName = $scriptMeta.scriptName
            className = $scriptMeta.className
            namespaceName = $scriptMeta.namespaceName
            assemblyName = $scriptMeta.assemblyName
            fieldNames = @($fieldNames)
        })
    } catch {
    }
}

$report = [pscustomobject]@{
    unityVersion = $uv
    monoScriptCount = $monoScriptSummaries.Count
    monoBehaviourCount = $monoBehaviours.Count
    interestingScripts = @($interestingScripts)
    interestingMonoBehaviours = @($monoBehaviours | Sort-Object className, scriptName, pathId)
}

$report | ConvertTo-Json -Depth 8 | Set-Content -Path $reportPath
$reportPath
