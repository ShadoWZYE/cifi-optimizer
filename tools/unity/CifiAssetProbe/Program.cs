using System.Text.Json;
using AssetsTools.NET;
using AssetsTools.NET.Cpp2IL;
using AssetsTools.NET.Extra;

var root = @"C:\Users\Shadow\Desktop\CiFi";
var uabeaDir = Path.Combine(root, "tools", "unity", "UABEA");
var gameRoot = Path.Combine(root, "_cifi_apk_merged", "base");
var dataDir = Path.Combine(gameRoot, "assets", "bin", "Data");
var joinedDir = Path.Combine(root, "_unity_joined");
var metadataPath = Path.Combine(root, "_cifi_apk", "global-metadata.dat");
var il2cppPath = Path.Combine(root, "_cifi_apk", "libil2cpp.so");
var reportPath = Path.Combine(root, "data", "uabea-probe-report.json");
var interestingPattern = new[]
{
    "Upgrade", "Milestone", "Loop", "Shard", "Diamond", "Token",
    "Ouro", "Research", "Borge", "Chrystos", "Emporium", "Bonus", "Cost", "Level",
    "Generator", "Mission", "Prestige", "Reward", "Boon", "Ultima"
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

var manager = new AssetsManager();
manager.LoadClassPackage(Path.Combine(uabeaDir, "classdata.tpk"));
manager.MonoTempGenerator = new Cpp2IlTempGenerator(metadataPath, il2cppPath);

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

Console.WriteLine($"Unity version: {primaryFile.file.Metadata.UnityVersion}");
Console.WriteLine($"Loaded assets files: {loadedFiles.Count}");
Console.WriteLine($"Failed direct loads: {failedFiles.Count}");

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
            else if (info.TypeId == (int)AssetClassID.GameObject || info.TypeId == (int)AssetClassID.MonoBehaviour)
            {
                var baseField = manager.GetBaseField(loaded, info, AssetReadFlags.None);
                var name = baseField["m_Name"].AsString;
                if (MatchesInteresting(name, interestingPattern))
                {
                    namedObjectHits.Add(new
                    {
                        fileName = Path.GetFileName(loaded.path),
                        pathId = info.PathId,
                        typeId = info.TypeId,
                        typeName = ((AssetClassID)info.TypeId).ToString(),
                        name
                    });
                }

                var fieldNames = ChildrenOf(baseField)
                    .Select(child => child.FieldName)
                    .Where(fieldName => !string.IsNullOrWhiteSpace(fieldName))
                    .Distinct(StringComparer.Ordinal)
                    .OrderBy(fieldName => fieldName, StringComparer.Ordinal)
                    .ToArray();

                if (fieldNames.Any(fieldName => MatchesInteresting(fieldName, interestingPattern)))
                {
                    directMonoBehaviourFieldHits.Add(new
                    {
                        fileName = Path.GetFileName(loaded.path),
                        pathId = info.PathId,
                        typeId = info.TypeId,
                        typeName = ((AssetClassID)info.TypeId).ToString(),
                        fieldNames = fieldNames.Where(fieldName => MatchesInteresting(fieldName, interestingPattern)).ToArray()
                    });
                }
            }
        }
        catch
        {
        }
    }
}

var report = new
{
    unityVersion = primaryFile.file.Metadata.UnityVersion,
    loadedFileCount = loadedFiles.Count,
    failedFiles,
    fileTypeSummaries,
    textAssetHits = textAssetHits
        .ToArray(),
    namedObjectHits = namedObjectHits
        .ToArray(),
    directMonoBehaviourFieldHits = directMonoBehaviourFieldHits
        .ToArray()
};

Directory.CreateDirectory(Path.GetDirectoryName(reportPath)!);
await File.WriteAllTextAsync(reportPath, JsonSerializer.Serialize(report, new JsonSerializerOptions
{
    WriteIndented = true
}));

Console.WriteLine(reportPath);
