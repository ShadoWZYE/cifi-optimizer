from __future__ import annotations

import argparse
import json
import re
import zipfile
from collections import defaultdict
from pathlib import Path

from portable_paths import repo_relative


ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")

KEYWORDS = [
    "backup",
    "save",
    "load",
    "cloud",
    "playerprofile",
    "profile",
    "shard",
    "diamond",
    "token",
    "loop",
    "ouro",
    "milestone",
    "upgrade",
    "mission",
    "research",
    "ultima",
    "reward",
    "prefs",
    "serializer",
    "deserialize",
    "obscured",
]

INTERESTING_MEMBERS = (
    "assets/bin/Data/Managed/Metadata/global-metadata.dat",
    "assets/bin/Data/globalgamemanagers",
)

INTERESTING_PREFIXES = (
    "assets/bin/Data/sharedassets0.assets",
    "assets/bin/Data/level0",
)


def printable_strings(blob: bytes) -> list[str]:
    values: list[str] = []
    values.extend(match.group().decode("ascii", errors="ignore") for match in ASCII_RE.finditer(blob))
    values.extend(match.group().decode("utf-16le", errors="ignore") for match in UTF16_RE.finditer(blob))
    return values


def keyword_hits(strings: list[str]) -> dict[str, list[str]]:
    hits: dict[str, set[str]] = defaultdict(set)
    for value in strings:
        lower = value.lower()
        for keyword in KEYWORDS:
            if keyword in lower:
                hits[keyword].add(value)
    return {keyword: sorted(values)[:80] for keyword, values in sorted(hits.items())}


def scan_blob(name: str, blob: bytes) -> dict[str, object]:
    strings = printable_strings(blob)
    hits = keyword_hits(strings)
    return {
        "name": name,
        "size": len(blob),
        "string_count": len(strings),
        "keyword_hits": hits,
    }


def load_zip_members(apk_path: Path) -> dict[str, bytes]:
    blobs: dict[str, bytes] = {}
    with zipfile.ZipFile(apk_path) as zf:
        for info in zf.infolist():
            name = info.filename
            if name in INTERESTING_MEMBERS or any(name.startswith(prefix) for prefix in INTERESTING_PREFIXES):
                blobs[name] = zf.read(name)
    return blobs


def scan_files(paths: list[Path]) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for path in paths:
        if path.exists() and path.is_file():
            results.append(scan_blob(repo_relative(path), path.read_bytes()))
    return results


def render_markdown(apk_results: list[dict[str, object]], file_results: list[dict[str, object]]) -> str:
    lines = ["# Unity Probe Report", ""]

    for section_name, results in (("APK assets", apk_results), ("Local extracted files", file_results)):
        lines.append(f"## {section_name}")
        lines.append("")
        for result in results:
            lines.append(f"### {result['name']}")
            lines.append("")
            lines.append(f"- Size: `{result['size']}` bytes")
            lines.append(f"- Extracted strings: `{result['string_count']}`")
            hits = result["keyword_hits"]
            if not hits:
                lines.append("- Keyword hits: none")
                lines.append("")
                continue
            lines.append("- Keyword hits:")
            for keyword, values in hits.items():
                preview = ", ".join(f"`{value[:80]}`" for value in values[:10])
                lines.append(f"  - `{keyword}`: {preview}")
            lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--files", nargs="*", type=Path, default=[])
    parser.add_argument("--json-out", type=Path, required=True)
    parser.add_argument("--md-out", type=Path, required=True)
    args = parser.parse_args()

    apk_blobs = load_zip_members(args.apk)
    apk_results = [scan_blob(name, blob) for name, blob in sorted(apk_blobs.items())]
    file_results = scan_files(args.files)

    payload = {
        "apk": repo_relative(args.apk),
        "apk_results": apk_results,
        "file_results": file_results,
        "keywords": KEYWORDS,
    }

    args.json_out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    args.md_out.write_text(render_markdown(apk_results, file_results), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
