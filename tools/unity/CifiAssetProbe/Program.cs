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
var explicitTerms = new List<string>();
var explicitSeeds = new List<string>();
string reportPath = Path.Combine(root, "data", "uabea-probe-report.json");
string? runtimeReportPath = null;
var disableInterestingPatternFilter = false;

for (var index = 0; index < args.Length; index++)
{
    switch (args[index])
    {
        case "--report":
            if (index + 1 >= args.Length)
            {
                throw new ArgumentException("Expected a value after --report.");
            }
            reportPath = Path.GetFullPath(Path.Combine(root, args[++index]));
            break;
        case "--runtime-report":
            if (index + 1 >= args.Length)
            {
                throw new ArgumentException("Expected a value after --runtime-report.");
            }
            runtimeReportPath = Path.GetFullPath(Path.Combine(root, args[++index]));
            break;
        case "--term":
            if (index + 1 >= args.Length)
            {
                throw new ArgumentException("Expected a value after --term.");
            }
            explicitTerms.Add(args[++index]);
            break;
        case "--seed":
            if (index + 1 >= args.Length)
            {
                throw new ArgumentException("Expected a value after --seed.");
            }
            explicitSeeds.Add(args[++index]);
            break;
        case "--no-interesting-filter":
            disableInterestingPatternFilter = true;
            break;
        default:
            throw new ArgumentException($"Unknown argument: {args[index]}");
    }
}

var interestingPattern = new[]
{
    "Upgrade", "Milestone", "Loop", "Shard", "Diamond", "Token",
    "Ouro", "Research", "Borge", "Chrystos", "Emporium", "Bonus", "Cost", "Level",
    "Generator", "Mission", "Prestige", "Reward", "Boon", "Ultima"
};
var effectiveInterestingPattern = interestingPattern
    .Concat(explicitTerms)
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();
var explicitTermSet = new HashSet<string>(explicitTerms.Where(term => !string.IsNullOrWhiteSpace(term)), StringComparer.OrdinalIgnoreCase);
var parsedSeeds = ParseSeedKeys(explicitSeeds).ToArray();
var seedKeySet = new HashSet<string>(parsedSeeds.Select(seed => MakeAssetKey(seed.fileName, seed.pathId)), StringComparer.OrdinalIgnoreCase);
var seededOnlyMode = seedKeySet.Count > 0 && explicitTermSet.Count == 0;
var shardTargetScriptNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "ShardMining",
    "ShardPerLevelTextHandler",
    "TextHandlerShardMilestoneBonusesPerLevel",
    "ShardUpgradeInfo",
    "TextHandlerMarkets"
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
        reportKey = "playerProfileHandler",
        lookupNames = new[] { "PlayerProfileHandler" },
        methodPatterns = new[] { "get_Market", "GetPlayerProfileData", "FillPlayerProfileData", "ConvertSaveDataToProfileData" }
    },
    new
    {
        reportKey = "playerProfileData",
        lookupNames = new[] { "PlayerProfileData" },
        methodPatterns = new[] { "get_Market", "get_BM", "get_ZN", "get_TU" }
    },
    new
    {
        reportKey = "saveData",
        lookupNames = new[] { "SaveData" },
        methodPatterns = Array.Empty<string>()
    },
    new
    {
        reportKey = "cloudSavePlayerProfile",
        lookupNames = new[] { "CloudSavePlayerProfile" },
        methodPatterns = new[] { "GetCurrentSaveFileInfo", "GetPlayerProfileInfo", "CloudLoad" }
    },
    new
    {
        reportKey = "multiverseMarket",
        lookupNames = new[] { "MultiverseMarket" },
        methodPatterns = new[] { "get_InscryptionsDone", "set_InscryptionsDone", "BuyIS", "SetInscryptionsDoneText" }
    },
    new
    {
        reportKey = "textHandlerMarkets",
        lookupNames = new[] { "TextHandlerMarkets" },
        methodPatterns = new[] { "SetAllChrystosEmporiumTexts", "SetAllBaseBonusTexts", "SetIS", "ClearISObjects", "SetISMaxLevelObjects" }
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

static bool MatchesExplicitTerm(string? value, HashSet<string> terms) =>
    !string.IsNullOrWhiteSpace(value) &&
    terms.Any(term => value.Contains(term, StringComparison.OrdinalIgnoreCase));

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

static IEnumerable<object> CollectPathReferences(AssetTypeValueField field, int depth = 0, string prefix = "")
{
    if (depth > 4)
    {
        yield break;
    }

    foreach (var child in field)
    {
        var fieldPath = string.IsNullOrWhiteSpace(prefix) ? child.FieldName : $"{prefix}.{child.FieldName}";
        long? pathId = null;
        int? fileId = null;
        string? targetType = null;
        try
        {
            var pathField = child["m_PathID"];
            pathId = pathField.AsLong;
            try
            {
                fileId = child["m_FileID"].AsInt;
            }
            catch
            {
            }
            try
            {
                targetType = child.TypeName;
            }
            catch
            {
            }
        }
        catch
        {
        }

        if (pathId.HasValue && pathId.Value != 0)
        {
            yield return new
            {
                fieldPath,
                fileId,
                pathId,
                targetType
            };
        }

        foreach (var nested in CollectPathReferences(child, depth + 1, fieldPath))
        {
            yield return nested;
        }
    }
}

static string MakeAssetKey(string fileName, long pathId) => $"{fileName}:{pathId}";

static IEnumerable<(string fileName, long pathId)> ParseSeedKeys(IEnumerable<string> values)
{
    foreach (var value in values)
    {
        var parts = value.Split(':', 2, StringSplitOptions.TrimEntries);
        if (parts.Length != 2 || !long.TryParse(parts[1], out var pathId))
        {
            throw new ArgumentException($"Invalid --seed value '{value}'. Expected format <fileName>:<pathId>.");
        }

        yield return (parts[0], pathId);
    }
}

static object? ResolveLocalReference(string fileName, int? fileId, long pathId, Dictionary<string, object> knownObjectLookup)
{
    if (fileId.HasValue && fileId.Value != 0)
    {
        return null;
    }

    knownObjectLookup.TryGetValue(MakeAssetKey(fileName, pathId), out var resolved);
    return resolved;
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

static object BuildRuntimeTypeMetadata(
    string reportKey,
    string assemblyName,
    LibCpp2IL.Metadata.Il2CppTypeDefinition? type,
    string[] methodPatterns)
{
    if (type is null)
    {
        return new
        {
            reportKey,
            assemblyName,
            found = false
        };
    }

    return new
    {
        reportKey,
        assemblyName,
        found = true,
        scriptName = type.Name,
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
            .Where(method => methodPatterns.Length == 0 ||
                             methodPatterns.Any(pattern => method.Name.Contains(pattern, StringComparison.Ordinal)))
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
    };
}

static object BuildRuntimeAssemblySearchMetadata(
    string assemblyName,
    IEnumerable<LibCpp2IL.Metadata.Il2CppTypeDefinition> types,
    string[] fieldPatterns,
    string[] methodPatterns)
{
    var matches = types
        .Select(type =>
        {
            var fieldHits = type.Fields
                .Select((field, index) => new { field, index })
                .Where(entry =>
                    fieldPatterns.Any(pattern =>
                        entry.field.Name.Contains(pattern, StringComparison.OrdinalIgnoreCase)))
                .Select(entry => new
                {
                    index = entry.index,
                    name = entry.field.Name,
                    type = entry.field.FieldType?.ToString()
                })
                .ToArray();

            var methodHits = type.Methods
                .Where(method =>
                    methodPatterns.Any(pattern =>
                        method.Name.Contains(pattern, StringComparison.OrdinalIgnoreCase)))
                .Select((method, index) => new
                {
                    index,
                    name = method.Name,
                    returnType = method.ReturnType?.ToString(),
                    methodProperties = ReflectSerializablePublicProperties(method)
                })
                .ToArray();

            return new
            {
                typeName = type.Name,
                fullName = type.FullName,
                fieldHits,
                methodHits
            };
        })
        .Where(entry => entry.fieldHits.Length > 0 || entry.methodHits.Length > 0)
        .OrderBy(entry => entry.fullName, StringComparer.Ordinal)
        .ToArray();

    return new
    {
        assemblyName,
        fieldPatterns,
        methodPatterns,
        matchCount = matches.Length,
        matches
    };
}

static object BuildFilteredRuntimeAssemblySearchMetadata(
    string assemblyName,
    IEnumerable<LibCpp2IL.Metadata.Il2CppTypeDefinition> types,
    string[] typeNamePatterns,
    string[] fieldPatterns,
    string[] methodPatterns)
{
    var filteredTypes = types
        .Where(type =>
            typeNamePatterns.Length == 0 ||
            typeNamePatterns.Any(pattern =>
                type.FullName.Contains(pattern, StringComparison.OrdinalIgnoreCase) ||
                type.Name.Contains(pattern, StringComparison.OrdinalIgnoreCase)))
        .ToArray();

    return BuildRuntimeAssemblySearchMetadata(assemblyName, filteredTypes, fieldPatterns, methodPatterns);
}

static object BuildRuntimeRvaLookupMetadata(
    IEnumerable<LibCpp2IL.Metadata.Il2CppAssemblyDefinition> assemblies,
    IEnumerable<int> rvas)
{
    var requestedRvas = rvas
        .Select(value => (ulong)value)
        .Distinct()
        .OrderBy(value => value)
        .ToArray();

    var methodByRva = assemblies
        .SelectMany(assembly =>
            (assembly.Image.Types ?? Array.Empty<LibCpp2IL.Metadata.Il2CppTypeDefinition>())
                .SelectMany(type => type.Methods
                    .Select(method => new { assembly, type, method })))
        .Where(entry => entry.method.Rva > 0)
        .GroupBy(entry => entry.method.Rva)
        .ToDictionary(
            group => group.Key,
            group => group
                .Select(entry => new
                {
                    assemblyName = entry.assembly.AssemblyName.Name,
                    typeName = entry.type.Name,
                    fullTypeName = entry.type.FullName,
                    methodName = entry.method.Name,
                    returnType = entry.method.ReturnType?.ToString(),
                    methodProperties = ReflectSerializablePublicProperties(entry.method),
                    parameters = entry.method.Parameters?.Select(parameter => ReflectSerializablePublicProperties(parameter)).ToArray() ?? Array.Empty<object>()
                })
                .ToArray());

    return new
    {
        requestedRvas,
        resolved = requestedRvas
            .Select(rva => new
            {
                rva,
                matches = methodByRva.TryGetValue(rva, out var matches) ? matches : Array.Empty<object>()
            })
            .ToArray()
    };
}

var manager = new AssetsManager();
manager.LoadClassPackage(Path.Combine(uabeaDir, "classdata.tpk"));

var primaryCandidatePath = Path.Combine(dataDir, "globalgamemanagers");
var primaryFile = manager.LoadAssetsFile(primaryCandidatePath, false);
manager.LoadClassDatabaseFromPackage(primaryFile.file.Metadata.UnityVersion);

if (runtimeReportPath is not null)
{
    var runtimeProbe = new Dictionary<string, object?>
    {
        ["dataset"] = "unity-runtime-surface-probe",
        ["generatedAt"] = DateTime.UtcNow.ToString("yyyy-MM-dd"),
        ["sources"] = new
        {
            metadata = Path.GetRelativePath(root, metadataPath).Replace('\\', '/'),
            libIl2cpp = Path.GetRelativePath(root, il2cppPath).Replace('\\', '/'),
            unityVersion = primaryFile.file.Metadata.UnityVersion
        }
    };

    try
    {
        var unityVersion = AssetRipper.Primitives.UnityVersion.Parse(primaryFile.file.Metadata.UnityVersion);
        var loadResult = LibCpp2IlMain.LoadFromFile(il2cppPath, metadataPath, unityVersion);
        runtimeProbe["loadFromFileResult"] = loadResult;
        runtimeProbe["binaryNullAfterLoad"] = LibCpp2IlMain.Binary is null;
        runtimeProbe["metadataNullAfterLoad"] = LibCpp2IlMain.TheMetadata is null;

        if (loadResult && LibCpp2IlMain.TheMetadata is not null)
        {
            var assemblies = LibCpp2IlMain.TheMetadata.AssemblyDefinitions
                .ToDictionary(asm => asm.AssemblyName.Name, StringComparer.Ordinal);

            var runtimeTargets = new[]
            {
                new { reportKey = "textHandlerMarkets", assemblyName = "Assembly-CSharp", lookupNames = new[] { "TextHandlerMarkets" }, methodPatterns = new[] { "SetAllChrystosEmporiumTexts", "SetAllMarketTexts", "SetAllCostTexts", "SetAllBaseBonusTexts", "SetAllBonusTexts", "SetAllIDTexts", "SetIS", "ClearISObjects", "SetISMaxLevelObjects" } },
                new { reportKey = "textHandlerShopNpcs", assemblyName = "Assembly-CSharp", lookupNames = new[] { "TextHandlerShopNPCs" }, methodPatterns = new[] { "DisplayTextEmporium", "Emporium", "DisplayText" } },
                new { reportKey = "navigationManager", assemblyName = "Assembly-CSharp", lookupNames = new[] { "NavigationManager" }, methodPatterns = new[] { "UpdateInscryptionUI", "Inscrypt", "Emporium" } },
                new { reportKey = "multiverseMarket", assemblyName = "Assembly-CSharp", lookupNames = new[] { "MultiverseMarket" }, methodPatterns = Array.Empty<string>() },
                new { reportKey = "unityUiText", assemblyName = "UnityEngine.UI", lookupNames = new[] { "UnityEngine.UI.Text", "Text" }, methodPatterns = new[] { "set_text", "get_text", "set_supportRichText", "OnPopulateMesh" } },
                new { reportKey = "string", assemblyName = "mscorlib", lookupNames = new[] { "System.String", "String" }, methodPatterns = new[] { "Concat", "Format" } }
            };

            var results = new List<object>();
            foreach (var target in runtimeTargets)
            {
                if (!assemblies.TryGetValue(target.assemblyName, out var assembly))
                {
                    results.Add(new { target.reportKey, target.assemblyName, found = false, assemblyMissing = true });
                    continue;
                }

                var type = (assembly.Image.Types ?? Array.Empty<LibCpp2IL.Metadata.Il2CppTypeDefinition>())
                    .FirstOrDefault(t =>
                        target.lookupNames.Any(lookupName =>
                            string.Equals(t.Name, lookupName, StringComparison.Ordinal) ||
                            string.Equals(t.FullName, lookupName, StringComparison.Ordinal) ||
                            t.FullName.EndsWith("." + lookupName, StringComparison.Ordinal)));
                results.Add(BuildRuntimeTypeMetadata(target.reportKey, target.assemblyName, type, target.methodPatterns));
            }

            runtimeProbe["targets"] = results.ToArray();

            if (assemblies.TryGetValue("Assembly-CSharp", out var assemblyCSharp))
            {
                IEnumerable<LibCpp2IL.Metadata.Il2CppTypeDefinition> assemblyTypes =
                    assemblyCSharp.Image.Types ?? Array.Empty<LibCpp2IL.Metadata.Il2CppTypeDefinition>();
                runtimeProbe["assemblySearches"] = new[]
                {
                    BuildRuntimeAssemblySearchMetadata(
                        "Assembly-CSharp",
                        assemblyTypes,
                        new[]
                        {
                            "CurrentBonusText",
                            "ActualBonusText",
                            "TotalBonusText",
                            "BonusText1",
                            "CurrentBonusPerLevelText"
                        },
                        new[]
                        {
                            "SetCurrentBonus",
                            "CurrentBonus",
                            "ActualBonus",
                            "TotalBonus",
                            "BonusText1"
                        }),
                    BuildRuntimeAssemblySearchMetadata(
                        "Assembly-CSharp",
                        assemblyTypes,
                        new[]
                        {
                            "CurrentBonusText",
                            "BonusDescriptionText",
                            "PerLevelBonusText",
                            "DescriptionText",
                            "IDText",
                            "IconBox"
                        },
                        new[]
                        {
                            "SetCurrentBonusText",
                            "SetBonusDescriptionText",
                            "SetPerLevelBonusText",
                            "SetDescriptionText",
                            "SetIDText"
                        }),
                    BuildFilteredRuntimeAssemblySearchMetadata(
                        "Assembly-CSharp",
                        assemblyTypes,
                        new[]
                        {
                            "Market",
                            "Inscrypt",
                            "Chrystos",
                            "Emporium"
                        },
                        new[]
                        {
                            "Current",
                            "ActualBonus",
                            "TotalBonus",
                            "BonusText",
                            "DescriptionText",
                            "IDText"
                        },
                        new[]
                        {
                            "Current",
                            "BonusText",
                            "DescriptionText",
                            "IDText",
                            "SetAll"
                        })
                };

                runtimeProbe["rvaLookups"] = BuildRuntimeRvaLookupMetadata(
                    LibCpp2IlMain.TheMetadata.AssemblyDefinitions,
                    new[]
                    {
                        31777557,
                        31777729,
                        31777861,
                        31779625,
                        28277222,
                        28277761,
                        30997230,
                        59968580
                    });
            }
        }
    }
    catch (Exception ex)
    {
        runtimeProbe["error"] = DescribeException(ex);
    }

    Directory.CreateDirectory(Path.GetDirectoryName(runtimeReportPath)!);
    await File.WriteAllTextAsync(runtimeReportPath, JsonSerializer.Serialize(runtimeProbe, new JsonSerializerOptions
    {
        WriteIndented = true
    }));
    Console.WriteLine(runtimeReportPath);
    return;
}

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

primaryFile = loadedFiles.First(f => string.Equals(Path.GetFileName(f.path), "globalgamemanagers", StringComparison.OrdinalIgnoreCase));
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
    ["attempted"] = !seededOnlyMode
};
var directTargetTypeMetadata = new List<object>();
if (!seededOnlyMode)
{
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

                directLibCpp2IlProbe["assemblySearches"] = new[]
                {
                    BuildRuntimeAssemblySearchMetadata(
                        "Assembly-CSharp",
                        assemblyTypes,
                        new[]
                        {
                            "CurrentBonusText",
                            "ActualBonusText",
                            "TotalBonusText",
                            "BonusText1",
                            "CurrentBonusPerLevelText"
                        },
                        new[]
                        {
                            "SetCurrentBonus",
                            "CurrentBonus",
                            "ActualBonus",
                            "TotalBonus",
                            "BonusText1"
                        })
                };
            }
        }
    }
    catch (Exception ex)
    {
        directLibCpp2IlProbe["loadFromFileResult"] = false;
        directLibCpp2IlProbe["error"] = DescribeException(ex);
    }
}
else
{
    directLibCpp2IlProbe["skippedForSeededMode"] = true;
}

Cpp2IlTempGenerator? generator = null;
if (!seededOnlyMode)
{
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
}
else
{
    cpp2IlStatus["initialized"] = false;
    cpp2IlStatus["skippedForSeededMode"] = true;
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
var targetedReferenceWalkHits = new List<object>();
var monoScriptByPath = new Dictionary<long, object>();
var monoScriptHits = new List<object>();
var shardTargetTypeTrees = new List<object>();
var targetScriptForceFromCldbReads = new List<object>();
var objectLookup = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
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
var seedDetails = new List<object>();
var seededAssignmentSiteHits = new List<object>();
var assetInfoLookup = loadedFiles.ToDictionary(
    loaded => Path.GetFileName(loaded.path),
    loaded => loaded.file.AssetInfos.ToDictionary(info => info.PathId, info => info));

object SummarizeAsset(AssetsFileInstance loaded, AssetFileInfo info, AssetsManager assetManager, Dictionary<long, object> monoScriptsByPath, Dictionary<string, object> knownObjectLookup)
{
    var readFlags = info.TypeId == (int)AssetClassID.MonoBehaviour
        ? AssetReadFlags.ForceFromCldb
        : AssetReadFlags.None;
    var baseField = assetManager.GetBaseField(loaded, info, readFlags);
    var fileName = Path.GetFileName(loaded.path);
    var name = "";
    try
    {
        name = baseField["m_Name"].AsString;
    }
    catch
    {
    }

    long scriptPathId = 0;
    string? scriptName = null;
    ushort? scriptIndex = null;
    long gameObjectPathId = 0;
    if (info.TypeId == (int)AssetClassID.MonoBehaviour)
    {
        try
        {
            scriptIndex = info.GetScriptIndex(loaded.file);
        }
        catch
        {
        }
        try
        {
            scriptPathId = baseField["m_Script"]["m_PathID"].AsLong;
            monoScriptsByPath.TryGetValue(scriptPathId, out var scriptSummary);
            scriptName = scriptSummary?.GetType().GetProperty("scriptName")?.GetValue(scriptSummary) as string;
        }
        catch
        {
        }
        try
        {
            gameObjectPathId = baseField["m_GameObject"]["m_PathID"].AsLong;
        }
        catch
        {
        }
    }
    else if (info.TypeId == (int)AssetClassID.GameObject)
    {
        gameObjectPathId = info.PathId;
    }

    knownObjectLookup[MakeAssetKey(fileName, info.PathId)] = new
    {
        fileName,
        pathId = info.PathId,
        typeId = info.TypeId,
        typeName = ((AssetClassID)info.TypeId).ToString(),
        name,
        scriptPathId = scriptPathId == 0 ? (long?)null : scriptPathId,
        scriptName,
        scriptIndex,
        gameObjectPathId = gameObjectPathId == 0 ? (long?)null : gameObjectPathId
    };

    var references = CollectPathReferences(baseField)
        .Cast<dynamic>()
        .Select(reference =>
        {
            return new
            {
                fieldPath = (string)reference.fieldPath,
                fileId = (int?)reference.fileId,
                pathId = (long?)reference.pathId,
                targetType = (string?)reference.targetType,
                resolved = ResolveLocalReference(fileName, (int?)reference.fileId, (long)reference.pathId, knownObjectLookup)
            };
        })
        .ToArray();

    return new
    {
        fileName,
        pathId = info.PathId,
        typeId = info.TypeId,
        typeName = ((AssetClassID)info.TypeId).ToString(),
        name,
        scriptPathId = scriptPathId == 0 ? (long?)null : scriptPathId,
        scriptName,
        scriptIndex,
        gameObjectPathId = gameObjectPathId == 0 ? (long?)null : gameObjectPathId,
        fieldNames = ChildrenOf(baseField)
            .Select(child => child.FieldName)
            .Where(fieldName => !string.IsNullOrWhiteSpace(fieldName))
            .Distinct(StringComparer.Ordinal)
            .Take(80)
            .ToArray(),
        references,
        matchedStrings = FlattenStrings(baseField)
            .Where(value => MatchesExplicitTerm(value, explicitTermSet))
            .Distinct(StringComparer.Ordinal)
            .Take(40)
            .ToArray()
    };
}

if (seededOnlyMode)
{
    foreach (var loaded in loadedFiles)
    {
        foreach (var info in loaded.file.GetAssetsOfType(AssetClassID.MonoScript))
        {
            try
            {
                var baseField = manager.GetBaseField(loaded, info, AssetReadFlags.None);
                var assemblyName = "";
                var namespaceName = "";
                var className = "";
                try
                {
                    assemblyName = baseField["m_AssemblyName"].AsString;
                    namespaceName = baseField["m_Namespace"].AsString;
                    className = baseField["m_ClassName"].AsString;
                }
                catch
                {
                }

                monoScriptByPath[info.PathId] = new
                {
                    fileName = Path.GetFileName(loaded.path),
                    pathId = info.PathId,
                    scriptName = className,
                    namespaceName,
                    assemblyName
                };
            }
            catch
            {
            }
        }
    }
}

foreach (var loaded in loadedFiles)
{
    var assetInfos = seededOnlyMode
        ? loaded.file.AssetInfos.Where(info => seedKeySet.Contains(MakeAssetKey(Path.GetFileName(loaded.path), info.PathId)))
        : loaded.file.AssetInfos;
    foreach (var info in assetInfos)
    {
        try
        {
            var fileName = Path.GetFileName(loaded.path);
            if (seedKeySet.Count > 0 && seedKeySet.Contains(MakeAssetKey(fileName, info.PathId)))
            {
                seedDetails.Add(SummarizeAsset(loaded, info, manager, monoScriptByPath, objectLookup));
            }

            if (seededOnlyMode)
            {
                continue;
            }

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
                var gameObjectPathId = info.TypeId == (int)AssetClassID.MonoBehaviour
                    ? baseField["m_GameObject"]["m_PathID"].AsLong
                    : info.PathId;

                objectLookup[$"{Path.GetFileName(loaded.path)}:{info.PathId}"] = new
                {
                    fileName = Path.GetFileName(loaded.path),
                    pathId = info.PathId,
                    typeId = info.TypeId,
                    typeName = ((AssetClassID)info.TypeId).ToString(),
                    name,
                    scriptName,
                    scriptPathId = scriptPathId == 0 ? (long?)null : scriptPathId,
                    gameObjectPathId = gameObjectPathId == 0 ? (long?)null : gameObjectPathId
                };

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

                var flattenedStrings = FlattenStrings(baseField)
                    .Where(value => disableInterestingPatternFilter || MatchesInteresting(value, effectiveInterestingPattern))
                    .Distinct(StringComparer.Ordinal)
                    .Take(80)
                    .ToArray();
                var explicitStringMatches = flattenedStrings
                    .Where(value => MatchesExplicitTerm(value, explicitTermSet))
                    .Take(40)
                    .ToArray();
                var explicitFieldMatches = fieldNames
                    .Where(fieldName => MatchesExplicitTerm(fieldName, explicitTermSet))
                    .Take(40)
                    .ToArray();
                var explicitNameMatch = MatchesExplicitTerm(name, explicitTermSet);
                var explicitScriptMatch = MatchesExplicitTerm(scriptName, explicitTermSet);

                if (explicitTermSet.Count > 0 && (explicitNameMatch || explicitScriptMatch || explicitFieldMatches.Length > 0 || explicitStringMatches.Length > 0))
                {
                    var references = CollectPathReferences(baseField)
                        .Cast<dynamic>()
                        .Select(reference =>
                        {
                            var key = $"{Path.GetFileName(loaded.path)}:{reference.pathId}";
                            objectLookup.TryGetValue(key, out var referencedObject);
                            return new
                            {
                                fieldPath = (string)reference.fieldPath,
                                fileId = (int?)reference.fileId,
                                pathId = (long?)reference.pathId,
                                targetType = (string?)reference.targetType,
                                resolved = (int?)reference.fileId == 0 || (int?)reference.fileId is null
                                    ? referencedObject
                                    : null
                            };
                        })
                        .Take(120)
                        .ToArray();

                    targetedReferenceWalkHits.Add(new
                    {
                        fileName = Path.GetFileName(loaded.path),
                        pathId = info.PathId,
                        typeId = info.TypeId,
                        typeName = ((AssetClassID)info.TypeId).ToString(),
                        name,
                        scriptName,
                        scriptPathId = scriptPathId == 0 ? (long?)null : scriptPathId,
                        scriptIndex = scriptIndex == ushort.MaxValue ? (ushort?)null : scriptIndex,
                        gameObjectPathId = gameObjectPathId == 0 ? (long?)null : gameObjectPathId,
                        explicitNameMatch,
                        explicitScriptMatch,
                        explicitFieldMatches,
                        explicitStringMatches,
                        references
                    });
                }
            }
        }
        catch
        {
        }
    }
}

if (seedKeySet.Count > 0)
{
    var pending = new Queue<(string fileName, long pathId, int depth)>();
    var visited = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    foreach (var seed in parsedSeeds)
    {
        pending.Enqueue((seed.fileName, seed.pathId, 0));
    }

    var expanded = new List<object>();
    while (pending.Count > 0)
    {
        var current = pending.Dequeue();
        var currentKey = MakeAssetKey(current.fileName, current.pathId);
        if (!visited.Add(currentKey))
        {
            continue;
        }

        if (!assetInfoLookup.TryGetValue(current.fileName, out var byPathId) || !byPathId.TryGetValue(current.pathId, out var info))
        {
            continue;
        }

        var loaded = loadedFiles.First(file => string.Equals(Path.GetFileName(file.path), current.fileName, StringComparison.OrdinalIgnoreCase));
        var summary = SummarizeAsset(loaded, info, manager, monoScriptByPath, objectLookup);
        expanded.Add(summary);

        if (current.depth >= 4)
        {
            continue;
        }

        var references = summary.GetType().GetProperty("references")?.GetValue(summary) as System.Collections.IEnumerable;
        if (references is null)
        {
            continue;
        }

        foreach (var reference in references)
        {
            var pathIdValue = reference.GetType().GetProperty("pathId")?.GetValue(reference);
            if (pathIdValue is long pathId && pathId != 0)
            {
                pending.Enqueue((current.fileName, pathId, current.depth + 1));
            }
        }
    }

    seedDetails = expanded;

    var slotObjectNames = new HashSet<string>(new[]
    {
        "CurrentBonusText",
        "BonusDescriptionText",
        "PerLevelBonusText",
        "DescriptionText",
        "IDText",
        "IconBox"
    }, StringComparer.Ordinal);
    var candidateProducerScripts = new HashSet<string>(new[]
    {
        "TextHandlerMarkets",
        "MultiverseMarket"
    }, StringComparer.OrdinalIgnoreCase);
    var seededVisitedKeys = new HashSet<string>(
        seedDetails
            .Select(summary =>
            {
                var fileName = summary.GetType().GetProperty("fileName")?.GetValue(summary) as string;
                var pathId = summary.GetType().GetProperty("pathId")?.GetValue(summary);
                return fileName is not null && pathId is long longPathId
                    ? MakeAssetKey(fileName, longPathId)
                    : null;
            })
            .Where(key => key is not null)!
            .Cast<string>(),
        StringComparer.OrdinalIgnoreCase);
    var slotObjectKeys = new HashSet<string>(
        seedDetails
            .Where(summary =>
            {
                var typeName = summary.GetType().GetProperty("typeName")?.GetValue(summary) as string;
                var name = summary.GetType().GetProperty("name")?.GetValue(summary) as string;
                return string.Equals(typeName, "GameObject", StringComparison.Ordinal) && slotObjectNames.Contains(name ?? string.Empty);
            })
            .Select(summary =>
            {
                var fileName = summary.GetType().GetProperty("fileName")?.GetValue(summary) as string;
                var pathId = summary.GetType().GetProperty("pathId")?.GetValue(summary);
                return fileName is not null && pathId is long longPathId
                    ? MakeAssetKey(fileName, longPathId)
                    : null;
            })
            .Where(key => key is not null)!
            .Cast<string>(),
        StringComparer.OrdinalIgnoreCase);
    var slotGameObjectIds = new HashSet<long>(
        seedDetails
            .Where(summary =>
            {
                var typeName = summary.GetType().GetProperty("typeName")?.GetValue(summary) as string;
                var name = summary.GetType().GetProperty("name")?.GetValue(summary) as string;
                return string.Equals(typeName, "GameObject", StringComparison.Ordinal) && slotObjectNames.Contains(name ?? string.Empty);
            })
            .Select(summary => summary.GetType().GetProperty("pathId")?.GetValue(summary))
            .Where(value => value is long)
            .Cast<long>());
    var assignmentTargetKeys = new HashSet<string>(slotObjectKeys, StringComparer.OrdinalIgnoreCase);
    foreach (var summary in seedDetails)
    {
        var typeName = summary.GetType().GetProperty("typeName")?.GetValue(summary) as string;
        var scriptName = summary.GetType().GetProperty("scriptName")?.GetValue(summary) as string;
        var fileName = summary.GetType().GetProperty("fileName")?.GetValue(summary) as string;
        var pathIdValue = summary.GetType().GetProperty("pathId")?.GetValue(summary);
        var gameObjectPathIdValue = summary.GetType().GetProperty("gameObjectPathId")?.GetValue(summary);
        if (!string.Equals(typeName, "MonoBehaviour", StringComparison.Ordinal) ||
            fileName is null ||
            pathIdValue is not long pathId ||
            gameObjectPathIdValue is not long gameObjectPathId ||
            !slotGameObjectIds.Contains(gameObjectPathId))
        {
            continue;
        }

        if (string.Equals(scriptName, "Text", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(scriptName, "Image", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(scriptName, "Outline", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(scriptName, "Shadow", StringComparison.OrdinalIgnoreCase))
        {
            assignmentTargetKeys.Add(MakeAssetKey(fileName, pathId));
        }
    }

    var assignmentScanTypeIds = new HashSet<int>
    {
        (int)AssetClassID.MonoBehaviour,
        (int)AssetClassID.GameObject,
        (int)AssetClassID.RectTransform,
        (int)AssetClassID.CanvasRenderer
    };

    foreach (var loaded in loadedFiles)
    {
        var fileName = Path.GetFileName(loaded.path);
        foreach (var info in loaded.file.AssetInfos.Where(info => assignmentScanTypeIds.Contains(info.TypeId)))
        {
            try
            {
                var summary = SummarizeAsset(loaded, info, manager, monoScriptByPath, objectLookup);
                var references = summary.GetType().GetProperty("references")?.GetValue(summary) as System.Collections.IEnumerable;
                if (references is null)
                {
                    continue;
                }

                var matchingReferences = new List<object>();
                foreach (var reference in references)
                {
                    var fileIdValue = reference.GetType().GetProperty("fileId")?.GetValue(reference);
                    var pathIdValue = reference.GetType().GetProperty("pathId")?.GetValue(reference);
                    if (pathIdValue is not long refPathId)
                    {
                        continue;
                    }

                    var refFileId = fileIdValue as int?;
                    if (refFileId.HasValue && refFileId.Value != 0)
                    {
                        continue;
                    }

                    if (!assignmentTargetKeys.Contains(MakeAssetKey(fileName, refPathId)))
                    {
                        continue;
                    }

                    matchingReferences.Add(reference);
                }

                if (matchingReferences.Count == 0)
                {
                    continue;
                }

                var sourceKey = MakeAssetKey(fileName, info.PathId);
                var sourceScriptName = summary.GetType().GetProperty("scriptName")?.GetValue(summary) as string;
                seededAssignmentSiteHits.Add(new
                {
                    fileName,
                    pathId = info.PathId,
                    typeId = info.TypeId,
                    typeName = summary.GetType().GetProperty("typeName")?.GetValue(summary) as string,
                    name = summary.GetType().GetProperty("name")?.GetValue(summary) as string,
                    scriptName = sourceScriptName,
                    gameObjectPathId = summary.GetType().GetProperty("gameObjectPathId")?.GetValue(summary),
                    sourceInsideSeededWalk = seededVisitedKeys.Contains(sourceKey),
                    candidateProducerScript = !string.IsNullOrWhiteSpace(sourceScriptName) && candidateProducerScripts.Contains(sourceScriptName),
                    matchingReferences = matchingReferences.ToArray()
                });
            }
            catch
            {
            }
        }
    }
}

if (!seededOnlyMode)
{
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
    queryTerms = explicitTerms.ToArray(),
    interestingPatternBypassed = disableInterestingPatternFilter,
    monoScriptHits = monoScriptHits.ToArray(),
    shardTargetTypeTrees = shardTargetTypeTrees.ToArray(),
    textAssetHits = textAssetHits
        .ToArray(),
    namedObjectHits = namedObjectHits
        .ToArray(),
    directMonoBehaviourFieldHits = directMonoBehaviourFieldHits
        .ToArray(),
    targetedReferenceWalkHits = targetedReferenceWalkHits
        .ToArray(),
    seededReferenceWalk = seedDetails.ToArray(),
    seededAssignmentSiteHits = seededAssignmentSiteHits.ToArray(),
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
