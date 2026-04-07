using System.Text.Json;
using AssetsTools.NET;
using AssetsTools.NET.Cpp2IL;
using AssetsTools.NET.Extra;
using LibCpp2IL;

static string ResolveRepoRoot()
{
    var candidates = new[]
    {
        Directory.GetCurrentDirectory(),
        AppContext.BaseDirectory
    };

    foreach (var candidate in candidates)
    {
        var current = new DirectoryInfo(candidate);
        while (current is not null)
        {
            var hasTools = Directory.Exists(Path.Combine(current.FullName, "tools", "unity", "UABEA"));
            var hasWorkbench = Directory.Exists(Path.Combine(current.FullName, "workbench"));
            if (hasTools && hasWorkbench)
            {
                return current.FullName;
            }
            current = current.Parent;
        }
    }

    throw new DirectoryNotFoundException("Could not resolve repo root from current directory or app base directory.");
}

var root = ResolveRepoRoot();
var uabeaDir = Path.Combine(root, "tools", "unity", "UABEA");
var gameRoot = Path.Combine(root, "workbench", "apk", "merged", "base");
var dataDir = Path.Combine(gameRoot, "assets", "bin", "Data");
var joinedDir = Path.Combine(root, "workbench", "unity", "joined");
var metadataPath = Path.Combine(root, "workbench", "apk", "base", "global-metadata.dat");
var il2cppPath = Path.Combine(root, "workbench", "apk", "base", "libil2cpp.so");
var reportPath = Path.Combine(root, "data", "uabea-probe-report.json");
var interestingPattern = new[]
{
    "Upgrade", "Milestone", "Loop", "Shard", "Diamond", "Token",
    "Ouro", "Research", "Borge", "Chrystos", "Emporium", "Bonus", "Cost", "Level",
    "Generator", "Mission", "Prestige", "Reward", "Boon", "Ultima"
};
var shardTargetScriptNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "ShardMining",
    "ShardPerLevelTextHandler",
    "TextHandlerShardMilestoneBonusesPerLevel",
    "ShardUpgradeInfo"
};
var shardTargetMethodPatterns = new[]
{
    "get_SU",
    "get_OverLevel",
    "UpdateShardCostList",
    "GetShardCostList",
    "CountAffordableShard",
    "SortCostAndBools"
};
var directTypeTargets = new[]
{
    new
    {
        reportKey = "shardMining",
        lookupNames = new[] { "ShardMining" },
        methodPatterns = shardTargetMethodPatterns
    },
    new
    {
        reportKey = "shardPerLevelTextHandler",
        lookupNames = new[] { "ShardPerLevelTextHandler" },
        methodPatterns = Array.Empty<string>()
    },
    new
    {
        reportKey = "textHandlerShardMilestoneBonusesPerLevel",
        lookupNames = new[] { "TextHandlerShardMilestoneBonusesPerLevel" },
        methodPatterns = Array.Empty<string>()
    },
    new
    {
        reportKey = "shardUpgradeInfo",
        lookupNames = new[] { "ShardUpgradeInfo", "ShardMining+ShardUpgradeInfo" },
        methodPatterns = Array.Empty<string>()
    },
    new
    {
        reportKey = "playerProfileData",
        lookupNames = new[] { "PlayerProfileData" },
        methodPatterns = new[] { "get_Market", "get_BM", "get_ZN", "get_TU" }
    },
    new
    {
        reportKey = "multiverseMarket",
        lookupNames = new[] { "MultiverseMarket" },
        methodPatterns = new[] { "get_InscryptionsDone", "set_InscryptionsDone", "BuyIS", "SetInscryptionsDoneText" }
    },
    new
    {
        reportKey = "multiverseMarketInscryption",
        lookupNames = new[] { "Inscryption", "MultiverseMarket+Inscryption" },
        methodPatterns = Array.Empty<string>()
    },
    new
    {
        reportKey = "multiverseMarketInscryptionTupleObject",
        lookupNames = new[] { "InscryptionTupleObject", "MultiverseMarket+InscryptionTupleObject" },
        methodPatterns = Array.Empty<string>()
    }
};
var targetFileNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "globalgamemanagers",
    "globalgamemanagers.assets",
    "level0",
    "sharedassets0.assets"
};

static bool MatchesInteresting(string? value, string[] patterns) =>
    !string.IsNullOrWhiteSpace(value) &&
    patterns.Any(pattern => value.Contains(pattern, StringComparison.OrdinalIgnoreCase));

static IEnumerable<AssetTypeValueField> ChildrenOf(AssetTypeValueField field)
{
    foreach (AssetTypeValueField child in field)
    {
        yield return child;
    }
}

static IEnumerable<string> FlattenStrings(AssetTypeValueField field)
{
    foreach (var child in field)
    {
        string? value = null;
        try
        {
            value = child.AsString;
        }
        catch
        {
        }

        if (!string.IsNullOrWhiteSpace(value))
        {
            yield return value;
        }

        foreach (var nested in FlattenStrings(child))
        {
            yield return nested;
        }
    }
}

static string GetNodeName(TypeTreeType typeTree, TypeTreeNode node) =>
    node.GetNameString(typeTree.StringBufferBytes, TypeTreeType.COMMON_STRING_TABLE);

static string GetNodeType(TypeTreeType typeTree, TypeTreeNode node) =>
    node.GetTypeString(typeTree.StringBufferBytes, TypeTreeType.COMMON_STRING_TABLE);

static Dictionary<string, object?> ReflectPublicProperties(object instance)
{
    var values = new Dictionary<string, object?>(StringComparer.Ordinal);
    foreach (var property in instance.GetType().GetProperties())
    {
        if (!property.CanRead || property.GetIndexParameters().Length != 0)
        {
            continue;
        }

        try
        {
            values[property.Name] = property.GetValue(instance);
        }
        catch
        {
        }
    }
    return values;
}

static object? ToSerializableScalar(object? value)
{
    if (value is null)
    {
        return null;
    }

    var type = value.GetType();
    if (type.IsPrimitive || value is string || value is decimal)
    {
        return value;
    }

    return value.ToString();
}

static Dictionary<string, object?> ReflectSerializablePublicProperties(object instance)
{
    var values = new Dictionary<string, object?>(StringComparer.Ordinal);
    foreach (var property in instance.GetType().GetProperties())
    {
        if (!property.CanRead || property.GetIndexParameters().Length != 0)
        {
            continue;
        }

        try
        {
            values[property.Name] = ToSerializableScalar(property.GetValue(instance));
        }
        catch
        {
        }
    }
    return values;
}

static Dictionary<string, object?> DescribeException(Exception ex)
{
    var values = new Dictionary<string, object?>(StringComparer.Ordinal)
    {
        ["type"] = ex.GetType().FullName,
        ["message"] = ex.Message
    };

    if (ex.InnerException is not null)
    {
        values["inner"] = DescribeException(ex.InnerException);
    }

    return values;
}

var manager = new AssetsManager();
manager.LoadClassPackage(Path.Combine(uabeaDir, "classdata.tpk"));

var candidateFiles = Directory
    .EnumerateFiles(joinedDir)
    .Concat(Directory.EnumerateFiles(dataDir)
        .Where(path =>
        {
            var name = Path.GetFileName(path);
            return name != "app.info" &&
                   !name.EndsWith(".resource", StringComparison.OrdinalIgnoreCase) &&
                   !name.EndsWith(".resS", StringComparison.OrdinalIgnoreCase) &&
                   !name.Contains(".split", StringComparison.OrdinalIgnoreCase);
        }))
    .Where(path => targetFileNames.Contains(Path.GetFileName(path)))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
    .ToArray();

var loadedFiles = new List<AssetsFileInstance>();
var failedFiles = new List<object>();
foreach (var path in candidateFiles)
{
    try
    {
        loadedFiles.Add(manager.LoadAssetsFile(path, false));
    }
    catch (Exception ex)
    {
        failedFiles.Add(new
        {
            fileName = Path.GetFileName(path),
            error = ex.Message
        });
    }
}

var primaryFile = loadedFiles.First(f => string.Equals(Path.GetFileName(f.path), "globalgamemanagers", StringComparison.OrdinalIgnoreCase));
manager.LoadClassDatabaseFromPackage(primaryFile.file.Metadata.UnityVersion);

var cpp2IlStatus = new Dictionary<string, object?>
{
    ["configured"] = true,
    ["generatorType"] = typeof(Cpp2IlTempGenerator).FullName,
    ["generatorAssembly"] = typeof(Cpp2IlTempGenerator).Assembly.GetName().Version?.ToString(),
    ["libCpp2IlAssembly"] = AppDomain.CurrentDomain.GetAssemblies()
        .FirstOrDefault(asm => string.Equals(asm.GetName().Name, "LibCpp2IL", StringComparison.OrdinalIgnoreCase))
        ?.GetName().Version?.ToString()
};

var directLibCpp2IlProbe = new Dictionary<string, object?>
{
    ["attempted"] = true
};
var directTargetTypeMetadata = new List<object>();
try
{
    var unityVersion = AssetRipper.Primitives.UnityVersion.Parse(primaryFile.file.Metadata.UnityVersion);
    var directLoadResult = LibCpp2IlMain.LoadFromFile(il2cppPath, metadataPath, unityVersion);
    directLibCpp2IlProbe["loadFromFileResult"] = directLoadResult;
    directLibCpp2IlProbe["binaryNullAfterLoad"] = LibCpp2IlMain.Binary is null;
    directLibCpp2IlProbe["metadataNullAfterLoad"] = LibCpp2IlMain.TheMetadata is null;

    if (directLoadResult && LibCpp2IlMain.TheMetadata is not null)
    {
        var assemblyCSharp = LibCpp2IlMain.TheMetadata.AssemblyDefinitions
            .FirstOrDefault(asm => string.Equals(asm.AssemblyName.Name, "Assembly-CSharp", StringComparison.Ordinal));
        directLibCpp2IlProbe["assemblyCSharpFound"] = assemblyCSharp is not null;

        if (assemblyCSharp is not null)
        {
            IEnumerable<LibCpp2IL.Metadata.Il2CppTypeDefinition> assemblyTypes =
                assemblyCSharp.Image.Types ?? Array.Empty<LibCpp2IL.Metadata.Il2CppTypeDefinition>();
            foreach (var target in directTypeTargets)
            {
                var type = assemblyTypes.FirstOrDefault(t =>
                    target.lookupNames.Any(lookupName =>
                        string.Equals(t.Name, lookupName, StringComparison.Ordinal) ||
                        string.Equals(t.FullName, lookupName, StringComparison.Ordinal) ||
                        t.FullName.EndsWith("." + lookupName, StringComparison.Ordinal)));

                if (type is null)
                {
                    directTargetTypeMetadata.Add(new
                    {
                        reportKey = target.reportKey,
                        scriptName = target.lookupNames[0],
                        found = false
                    });
                    continue;
                }

                directTargetTypeMetadata.Add(new
                {
                    reportKey = target.reportKey,
                    scriptName = target.lookupNames[0],
                    found = true,
                    fullName = type.FullName,
                    baseType = type.BaseType?.ToString(),
                    fieldCount = type.Fields.Length,
                    methodCount = type.Methods.Length,
                    fields = type.Fields
                        .Select((field, index) => new
                        {
                            index,
                            name = field.Name,
                            type = field.FieldType?.ToString(),
                            attributes = type.FieldAttributes[index].ToString(),
                            defaultValue = type.FieldDefaults.Length > index && type.FieldDefaults[index] is not null
                                ? type.FieldDefaults[index]!.ToString()
                                : null,
                            fieldOffset = type.FieldInfos.Length > index
                                ? type.FieldInfos[index].FieldOffset
                                : (int?)null
                        })
                        .ToArray(),
                    methods = type.Methods
                        .Where(method => target.methodPatterns.Any(pattern => method.Name.Contains(pattern, StringComparison.Ordinal)))
                        .Select((method, index) => new
                        {
                            index,
                            name = method.Name,
                            returnType = method.ReturnType?.ToString(),
                            parameterCount = method.Parameters?.Length ?? 0,
                            methodProperties = ReflectSerializablePublicProperties(method),
                            parameters = method.Parameters?.Select(parameter => ReflectSerializablePublicProperties(parameter)).ToArray() ?? Array.Empty<object>()
                        })
                        .ToArray()
                });
            }
        }
    }
}
catch (Exception ex)
{
    directLibCpp2IlProbe["loadFromFileResult"] = false;
    directLibCpp2IlProbe["error"] = DescribeException(ex);
}

Cpp2IlTempGenerator? generator = null;
try
{
    generator = new Cpp2IlTempGenerator(metadataPath, il2cppPath);
    manager.MonoTempGenerator = generator;
    cpp2IlStatus["initialized"] = true;
}
catch (Exception ex)
{
    cpp2IlStatus["initialized"] = false;
    cpp2IlStatus["errorType"] = ex.GetType().FullName;
    cpp2IlStatus["error"] = ex.Message;
}

if (generator is not null)
{
    try
    {
        generator.InitializeCpp2IL();
        cpp2IlStatus["initializeCallSucceeded"] = true;
    }
    catch (Exception ex)
    {
        cpp2IlStatus["initializeCallSucceeded"] = false;
        cpp2IlStatus["initializeCallError"] = DescribeException(ex);
    }
}

Console.WriteLine($"Unity version: {primaryFile.file.Metadata.UnityVersion}");
Console.WriteLine($"Loaded assets files: {loadedFiles.Count}");
Console.WriteLine($"Failed direct loads: {failedFiles.Count}");
Console.WriteLine($"Cpp2IL initialized: {cpp2IlStatus["initialized"]}");

var fileTypeSummaries = loadedFiles
    .Select(loaded => new
    {
        fileName = Path.GetFileName(loaded.path),
        assetCount = loaded.file.AssetInfos.Count,
        types = loaded.file.AssetInfos
            .GroupBy(info => info.TypeId)
            .Select(group => new
            {
                typeId = group.Key,
                count = group.Count()
            })
            .OrderByDescending(group => group.count)
            .ThenBy(group => group.typeId)
            .ToArray()
    })
    .OrderBy(entry => entry.fileName, StringComparer.Ordinal)
    .ToArray();

var textAssetHits = new List<object>();
var namedObjectHits = new List<object>();
var directMonoBehaviourFieldHits = new List<object>();
var monoScriptByPath = new Dictionary<long, object>();
var monoScriptHits = new List<object>();
var shardTargetTypeTrees = new List<object>();
var targetScriptForceFromCldbReads = new List<object>();
var fileScriptTypeSummaries = loadedFiles
    .Select(loaded => new
    {
        fileName = Path.GetFileName(loaded.path),
        scriptTypeCount = loaded.file.Metadata.ScriptTypes.Count,
        scriptTypes = loaded.file.Metadata.ScriptTypes
            .Select((scriptType, index) => new
            {
                scriptIndex = index,
                properties = ReflectPublicProperties(scriptType)
            })
            .ToArray()
    })
    .ToArray();

var targetScriptIndexLookups = new List<object>();
var targetScriptMonoBehaviourCounts = new List<object>();

foreach (var loaded in loadedFiles)
{
    foreach (var info in loaded.file.AssetInfos)
    {
        try
        {
            if (info.TypeId == (int)AssetClassID.TextAsset)
            {
                var baseField = manager.GetBaseField(loaded, info, AssetReadFlags.None);
                var name = baseField["m_Name"].AsString;
                var payloadStrings = FlattenStrings(baseField)
                    .Where(value => MatchesInteresting(value, interestingPattern))
                    .Distinct(StringComparer.Ordinal)
                    .Take(20)
                    .ToArray();

                if (MatchesInteresting(name, interestingPattern) || payloadStrings.Length > 0)
                {
                    textAssetHits.Add(new
                    {
                        fileName = Path.GetFileName(loaded.path),
                        pathId = info.PathId,
                        name,
                        strings = payloadStrings
                    });
                }
            }
            else if (info.TypeId == (int)AssetClassID.MonoScript)
            {
                var baseField = manager.GetBaseField(loaded, info, AssetReadFlags.None);
                var scriptName = baseField["m_Name"].AsString;
                var className = baseField["m_ClassName"].AsString;
                var namespaceName = baseField["m_Namespace"].AsString;
                var assemblyName = baseField["m_AssemblyName"].AsString;
                var summary = new
                {
                    fileName = Path.GetFileName(loaded.path),
                    pathId = info.PathId,
                    scriptName,
                    className,
                    namespaceName,
                    assemblyName
                };
                monoScriptByPath[info.PathId] = summary;

                if (shardTargetScriptNames.Contains(scriptName) ||
                    MatchesInteresting(scriptName, interestingPattern) ||
                    MatchesInteresting(className, interestingPattern) ||
                    MatchesInteresting(namespaceName, interestingPattern))
                {
                    monoScriptHits.Add(summary);
                }
            }
            else if (info.TypeId == (int)AssetClassID.GameObject || info.TypeId == (int)AssetClassID.MonoBehaviour)
            {
                var scriptIndex = info.TypeId == (int)AssetClassID.MonoBehaviour
                    ? info.GetScriptIndex(loaded.file)
                    : ushort.MaxValue;
                var readFlags = info.TypeId == (int)AssetClassID.MonoBehaviour
                    ? AssetReadFlags.ForceFromCldb
                    : AssetReadFlags.None;
                var baseField = manager.GetBaseField(loaded, info, readFlags);
                var name = baseField["m_Name"].AsString;
                var scriptPathId = info.TypeId == (int)AssetClassID.MonoBehaviour
                    ? baseField["m_Script"]["m_PathID"].AsLong
                    : 0;
                monoScriptByPath.TryGetValue(scriptPathId, out var scriptSummary);
                var scriptName = scriptSummary?.GetType().GetProperty("scriptName")?.GetValue(scriptSummary) as string;

                if ((shardTargetScriptNames.Contains(scriptName ?? string.Empty) || scriptIndex != ushort.MaxValue) &&
                    info.TypeId == (int)AssetClassID.MonoBehaviour)
                {
                    try
                    {
                        var typeTree = loaded.file.Metadata.FindTypeTreeTypeByScriptIndex(scriptIndex);
                        if (typeTree is not null || shardTargetScriptNames.Contains(scriptName ?? string.Empty))
                        {
                            shardTargetTypeTrees.Add(new
                            {
                                fileName = Path.GetFileName(loaded.path),
                                pathId = info.PathId,
                                scriptPathId,
                                scriptIndex,
                                scriptName,
                                typeTreeFound = typeTree is not null,
                                nodeCount = typeTree?.Nodes.Count ?? 0,
                                fieldNames = typeTree?.Nodes
                                    .Select(node => GetNodeName(typeTree, node))
                                    .Where(nodeName => !string.IsNullOrWhiteSpace(nodeName))
                                    .Distinct(StringComparer.Ordinal)
                                    .ToArray() ?? Array.Empty<string>(),
                                fieldTypes = typeTree?.Nodes
                                    .Select(node => GetNodeType(typeTree, node))
                                    .Where(typeName => !string.IsNullOrWhiteSpace(typeName))
                                    .Distinct(StringComparer.Ordinal)
                                    .ToArray() ?? Array.Empty<string>()
                            });
                        }
                    }
                    catch
                    {
                    }
                }

                if (MatchesInteresting(name, interestingPattern) || shardTargetScriptNames.Contains(scriptName ?? string.Empty))
                {
                    namedObjectHits.Add(new
                    {
                        fileName = Path.GetFileName(loaded.path),
                        pathId = info.PathId,
                        typeId = info.TypeId,
                        typeName = ((AssetClassID)info.TypeId).ToString(),
                        name,
                        scriptPathId = scriptPathId == 0 ? (long?)null : scriptPathId,
                        scriptName,
                        scriptIndex = scriptIndex == ushort.MaxValue ? (ushort?)null : scriptIndex
                    });
                }

                var fieldNames = ChildrenOf(baseField)
                    .Select(child => child.FieldName)
                    .Where(fieldName => !string.IsNullOrWhiteSpace(fieldName))
                    .Distinct(StringComparer.Ordinal)
                    .OrderBy(fieldName => fieldName, StringComparer.Ordinal)
                    .ToArray();

                var isShardTarget = shardTargetScriptNames.Contains(scriptName ?? string.Empty);
                if (isShardTarget ||
                    fieldNames.Any(fieldName => MatchesInteresting(fieldName, interestingPattern)))
                {
                    directMonoBehaviourFieldHits.Add(new
                    {
                        fileName = Path.GetFileName(loaded.path),
                        pathId = info.PathId,
                        typeId = info.TypeId,
                        typeName = ((AssetClassID)info.TypeId).ToString(),
                        scriptPathId = scriptPathId == 0 ? (long?)null : scriptPathId,
                        scriptName,
                        scriptIndex = scriptIndex == ushort.MaxValue ? (ushort?)null : scriptIndex,
                        fieldNames = isShardTarget
                            ? fieldNames
                            : fieldNames.Where(fieldName => MatchesInteresting(fieldName, interestingPattern)).ToArray()
                    });
                }
            }
        }
        catch
        {
        }
    }
}

foreach (var loaded in loadedFiles)
{
    if (loaded.file.Metadata.ScriptTypes.Count == 0)
    {
        continue;
    }

    var fileName = Path.GetFileName(loaded.path);
    foreach (var scriptType in loaded.file.Metadata.ScriptTypes.Select((scriptType, index) => new { scriptType, index }))
    {
        var properties = ReflectPublicProperties(scriptType.scriptType);
        if (!properties.TryGetValue("PathId", out var pathIdValue) || pathIdValue is null)
        {
            continue;
        }

        var pathId = Convert.ToInt64(pathIdValue);
        if (!monoScriptByPath.TryGetValue(pathId, out var scriptSummary))
        {
            continue;
        }

        var scriptName = scriptSummary.GetType().GetProperty("scriptName")?.GetValue(scriptSummary) as string;
        if (string.IsNullOrWhiteSpace(scriptName) || !shardTargetScriptNames.Contains(scriptName))
        {
            continue;
        }

        var monoBehaviours = loaded.file.GetAssetsOfType(AssetClassID.MonoBehaviour, (ushort)scriptType.index);
        targetScriptIndexLookups.Add(new
        {
            fileName,
            scriptIndex = scriptType.index,
            scriptPathId = pathId,
            scriptName,
            monoBehaviourCount = monoBehaviours.Count
        });

        try
        {
            var typeTree = loaded.file.Metadata.FindTypeTreeTypeByScriptIndex((ushort)scriptType.index);
            targetScriptMonoBehaviourCounts.Add(new
            {
                fileName,
                scriptIndex = scriptType.index,
                scriptPathId = pathId,
                scriptName,
                monoBehaviourPathIds = monoBehaviours.Select(info => info.PathId).Take(50).ToArray(),
                typeTreeFound = typeTree is not null,
                typeTreeNodeCount = typeTree?.Nodes.Count ?? 0,
                typeTreeFieldNames = typeTree?.Nodes
                    .Select(node => GetNodeName(typeTree, node))
                    .Where(nodeName => !string.IsNullOrWhiteSpace(nodeName))
                    .Distinct(StringComparer.Ordinal)
                    .Take(200)
                    .ToArray() ?? Array.Empty<string>()
            });
        }
        catch
        {
            targetScriptMonoBehaviourCounts.Add(new
            {
                fileName,
                scriptIndex = scriptType.index,
                scriptPathId = pathId,
                scriptName,
                monoBehaviourPathIds = monoBehaviours.Select(info => info.PathId).Take(50).ToArray(),
                typeTreeFound = false,
                typeTreeNodeCount = 0,
                typeTreeFieldNames = Array.Empty<string>()
            });
        }

        foreach (var monoBehaviour in monoBehaviours.Take(10))
        {
            try
            {
                var baseField = manager.GetBaseField(loaded, monoBehaviour, AssetReadFlags.ForceFromCldb);
                var fieldNames = ChildrenOf(baseField)
                    .Select(child => child.FieldName)
                    .Where(fieldName => !string.IsNullOrWhiteSpace(fieldName))
                    .Distinct(StringComparer.Ordinal)
                    .Take(100)
                    .ToArray();
                targetScriptForceFromCldbReads.Add(new
                {
                    fileName,
                    scriptIndex = scriptType.index,
                    scriptPathId = pathId,
                    scriptName,
                    monoBehaviourPathId = monoBehaviour.PathId,
                    success = true,
                    fieldCount = fieldNames.Length,
                    fieldNames
                });
            }
            catch (Exception ex)
            {
                targetScriptForceFromCldbReads.Add(new
                {
                    fileName,
                    scriptIndex = scriptType.index,
                    scriptPathId = pathId,
                    scriptName,
                    monoBehaviourPathId = monoBehaviour.PathId,
                    success = false,
                    error = DescribeException(ex)
                });
            }
        }
    }
}

var report = new
{
    unityVersion = primaryFile.file.Metadata.UnityVersion,
    loadedFileCount = loadedFiles.Count,
    cpp2IlStatus,
    directLibCpp2IlProbe,
    directTargetTypeMetadata = directTargetTypeMetadata.ToArray(),
    failedFiles,
    fileTypeSummaries,
    fileScriptTypeSummaries,
    targetScriptIndexLookups,
    targetScriptMonoBehaviourCounts,
    targetScriptForceFromCldbReads,
    monoScriptHits = monoScriptHits.ToArray(),
    shardTargetTypeTrees = shardTargetTypeTrees.ToArray(),
    textAssetHits = textAssetHits
        .ToArray(),
    namedObjectHits = namedObjectHits
        .ToArray(),
    directMonoBehaviourFieldHits = directMonoBehaviourFieldHits
        .ToArray(),
    shardTargetMonoBehaviours = directMonoBehaviourFieldHits
        .Where(hit =>
        {
            var scriptName = hit.GetType().GetProperty("scriptName")?.GetValue(hit) as string;
            return !string.IsNullOrWhiteSpace(scriptName) && shardTargetScriptNames.Contains(scriptName);
        })
        .ToArray()
};

Directory.CreateDirectory(Path.GetDirectoryName(reportPath)!);
await File.WriteAllTextAsync(reportPath, JsonSerializer.Serialize(report, new JsonSerializerOptions
{
    WriteIndented = true
}));

Console.WriteLine(reportPath);
