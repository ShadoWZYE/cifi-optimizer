from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")


def extract_strings(blob: bytes) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []

    for match in ASCII_RE.finditer(blob):
        entries.append(
            {
                "offset": match.start(),
                "encoding": "ascii",
                "value": match.group().decode("ascii", errors="ignore"),
            }
        )

    for match in UTF16_RE.finditer(blob):
        entries.append(
            {
                "offset": match.start(),
                "encoding": "utf16le",
                "value": match.group().decode("utf-16le", errors="ignore"),
            }
        )

    return sorted(entries, key=lambda entry: int(entry["offset"]))


def find_matches(entries: list[dict[str, object]], anchor: str, context: int) -> list[dict[str, object]]:
    matches: list[dict[str, object]] = []
    anchor_lower = anchor.lower()

    for index, entry in enumerate(entries):
        value = str(entry["value"])
        if anchor_lower not in value.lower():
            continue

        start = max(index - context, 0)
        end = min(index + context + 1, len(entries))
        matches.append(
            {
                "anchor": anchor,
                "match_index": index,
                "match_offset": entry["offset"],
                "match_value": value,
                "context": entries[start:end],
            }
        )
    return matches


def render_markdown(results: list[dict[str, object]], metadata_path: Path) -> str:
    lines = [
        "# Metadata Neighborhood Probe",
        "",
        f"Source: `{metadata_path}`",
        "",
    ]

    for result in results:
        lines.append(f"## {result['anchor']}")
        lines.append("")
        if not result["matches"]:
            lines.append("- No matches found.")
            lines.append("")
            continue

        for idx, match in enumerate(result["matches"], start=1):
            lines.append(f"### Match {idx}")
            lines.append("")
            lines.append(f"- Match offset: `{match['match_offset']}`")
            lines.append(f"- Match value: `{match['match_value']}`")
            lines.append("- Nearby strings:")
            for entry in match["context"]:
                lines.append(
                    f"  - offset `{entry['offset']}` [{entry['encoding']}] `{entry['value']}`"
                )
            lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--metadata", required=True, type=Path)
    parser.add_argument("--anchors", nargs="+", required=True)
    parser.add_argument("--context", type=int, default=8)
    parser.add_argument("--json-out", required=True, type=Path)
    parser.add_argument("--md-out", required=True, type=Path)
    args = parser.parse_args()

    blob = args.metadata.read_bytes()
    entries = extract_strings(blob)

    results = []
    for anchor in args.anchors:
        results.append(
            {
                "anchor": anchor,
                "matches": find_matches(entries, anchor, args.context),
            }
        )

    payload = {
        "metadata": str(args.metadata),
        "anchor_count": len(args.anchors),
        "context": args.context,
        "results": results,
    }

    args.json_out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    args.md_out.write_text(render_markdown(results, args.metadata), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
