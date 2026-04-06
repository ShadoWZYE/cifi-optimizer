from __future__ import annotations

import json
import sys
import types
from pathlib import Path

from portable_paths import md_link, repo_relative


ROOT = Path(__file__).resolve().parents[2]
UNITY_JOINED_DIR = ROOT / "workbench" / "unity" / "joined"
JSON_OUT = ROOT / "data" / "shard-scene-monobehaviour-probe.v1.json"
MD_OUT = ROOT / "docs" / "systems" / "shards" / "shard-scene-monobehaviour-probe.md"
TARGET_SCRIPTS = {
    "ShardMining",
    "ShardPerLevelTextHandler",
    "ConstructionMilestones",
}


def install_optional_dependency_stubs() -> None:
    brotli = types.ModuleType("brotli")
    brotli.decompress = lambda data: data
    brotli.compress = lambda data, *args, **kwargs: data

    lz4 = types.ModuleType("lz4")
    lz4_block = types.ModuleType("lz4.block")
    lz4_block.decompress = lambda data, uncompressed_size=None: data
    lz4_block.compress = lambda data, **kwargs: data
    lz4.block = lz4_block

    pil = types.ModuleType("PIL")
    pil_image = types.ModuleType("PIL.Image")
    pil_image.open = lambda *args, **kwargs: None
    pil.Image = pil_image

    sys.modules.setdefault("brotli", brotli)
    sys.modules.setdefault("lz4", lz4)
    sys.modules.setdefault("lz4.block", lz4_block)
    sys.modules.setdefault("PIL", pil)
    sys.modules.setdefault("PIL.Image", pil_image)


def load_environment():
    install_optional_dependency_stubs()
    sys.path.insert(0, str((ROOT / ".deps").resolve()))
    from UnityPy import Environment  # type: ignore

    env = Environment()
    env.load_folder(str(UNITY_JOINED_DIR))
    return env


def build_script_map(env) -> dict[int, str]:
    script_map: dict[int, str] = {}
    for obj in env.objects:
        if obj.type.name != "MonoScript":
            continue
        try:
            data = obj.read()
        except Exception:
            continue
        script_map[obj.path_id] = getattr(data, "m_Name", "") or ""
    return script_map


def probe_shard_monobehaviours(env, script_map: dict[int, str]) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            data = obj.read(check_read=False)
        except TypeError:
            try:
                data = obj.read()
            except Exception:
                continue
        except Exception:
            continue

        script = getattr(data, "m_Script", None)
        script_path_id = getattr(script, "path_id", None)
        if script_path_id is None:
            continue

        script_name = script_map.get(script_path_id, "")
        if script_name not in TARGET_SCRIPTS:
            continue

        results.append(
            {
                "pathId": obj.path_id,
                "scriptName": script_name,
                "objectName": getattr(data, "m_Name", "") or "",
                "assetsFile": getattr(getattr(obj, "assets_file", None), "name", "") or "",
                "byteStart": getattr(obj, "byte_start", None),
                "byteSize": getattr(obj, "byte_size", None),
                "scriptFileId": getattr(script, "file_id", None),
                "scriptPathId": script_path_id,
            }
        )
    return sorted(results, key=lambda entry: (str(entry["assetsFile"]), str(entry["scriptName"]), int(entry["pathId"])))


def render_markdown(mono_behaviours: list[dict[str, object]]) -> str:
    lines = [
        "# Shard Scene MonoBehaviour Probe",
        "",
        f"Source: direct `MonoBehaviour` inventory from {md_link(UNITY_JOINED_DIR)}, read with vendored `UnityPy` plus local optional-dependency stubs so plain serialized-file reads still work in this repo.",
        "",
        "## Grounded conclusions",
        "",
        "- `level0` contains a direct `ShardMining` MonoBehaviour object, not just shard-related strings.",
        "- `level0` also contains a direct shard bonus text handler object (`ShardPerLevelTextHandler`) and a separate `ConstructionMilestones` object in the same scene file.",
        "- The current direct parser target for shard cost/value extraction is therefore the exact `ShardMining` byte range preserved below.",
        "- This probe narrows the byte target for future cost extraction, but it does not yet recover typed numeric field values from the `ShardMining` payload.",
        "",
        "## Extracted scene objects",
        "",
    ]
    for entry in mono_behaviours:
        lines.append(
            f"- `{entry['scriptName']}`: `pathId={entry['pathId']}`; `assetsFile={entry['assetsFile']}`; "
            f"`byteStart={entry['byteStart']}`; `byteSize={entry['byteSize']}`; `scriptPathId={entry['scriptPathId']}`"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    env = load_environment()
    script_map = build_script_map(env)
    mono_behaviours = probe_shard_monobehaviours(env, script_map)
    payload = {
        "dataset": "shard-scene-monobehaviour-probe.v1",
        "generatedAt": "2026-04-04",
        "source": {
            "unityJoinedDir": repo_relative(UNITY_JOINED_DIR),
            "probeMethod": "UnityPy MonoBehaviour inventory with local dependency stubs",
        },
        "monoBehaviours": mono_behaviours,
        "findings": [
            "level0 preserves a direct ShardMining MonoBehaviour object with a stable path id and byte range.",
            "level0 also preserves a direct ShardPerLevelTextHandler object beside the shard menu object.",
            "ConstructionMilestones is present in the same scene file, which keeps the academy-side numbered family visible while ShardMining remains the shard-local parser target.",
        ],
        "currentBoundary": [
            "Treat this probe as a byte-target narrowing step for future shard parsing work.",
            "Use it to target direct ShardMining and ShardPerLevelTextHandler scene objects in level0.",
            "Do not claim recovered shard numeric fields, formulas, or typed row payloads from this probe alone.",
        ],
    }

    JSON_OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    MD_OUT.write_text(render_markdown(mono_behaviours), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
