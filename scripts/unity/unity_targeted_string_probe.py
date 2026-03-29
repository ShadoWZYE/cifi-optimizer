from __future__ import annotations

import argparse
import json
import re
from bisect import bisect_left
from pathlib import Path


ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")


def collect_strings(blob: bytes) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for match in ASCII_RE.finditer(blob):
        value = match.group().decode("ascii", errors="ignore")
        entries.append({"offset": match.start(), "kind": "ascii", "value": value})
    for match in UTF16_RE.finditer(blob):
        value = match.group().decode("utf-16le", errors="ignore")
        entries.append({"offset": match.start(), "kind": "utf16", "value": value})
    entries.sort(key=lambda item: int(item["offset"]))
    return entries


def slice_context(entries: list[dict[str, object]], center_index: int, radius: int) -> list[dict[str, object]]:
    start = max(0, center_index - radius)
    end = min(len(entries), center_index + radius + 1)
    return entries[start:end]


def find_nearby(entries: list[dict[str, object]], anchor_offset: int, byte_radius: int) -> list[dict[str, object]]:
    offsets = [int(entry["offset"]) for entry in entries]
    start = bisect_left(offsets, anchor_offset - byte_radius)
    end = bisect_left(offsets, anchor_offset + byte_radius)
    return entries[start:end]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--files", nargs="+", type=Path, required=True)
    parser.add_argument("--terms", nargs="+", required=True)
    parser.add_argument("--json-out", type=Path, required=True)
    parser.add_argument("--context-radius", type=int, default=8)
    parser.add_argument("--byte-radius", type=int, default=2048)
    args = parser.parse_args()

    lowered_terms = [term.lower() for term in args.terms]
    report: list[dict[str, object]] = []

    for path in args.files:
        blob = path.read_bytes()
        entries = collect_strings(blob)
        matches: list[dict[str, object]] = []
        for index, entry in enumerate(entries):
            value = str(entry["value"])
            lower = value.lower()
            matched = [term for term in lowered_terms if term in lower]
            if not matched:
                continue
            matches.append(
                {
                    "offset": entry["offset"],
                    "kind": entry["kind"],
                    "value": value,
                    "matched_terms": matched,
                    "entry_context": slice_context(entries, index, args.context_radius),
                    "byte_context": find_nearby(entries, int(entry["offset"]), args.byte_radius),
                }
            )

        report.append(
            {
                "file": str(path),
                "string_count": len(entries),
                "match_count": len(matches),
                "matches": matches,
            }
        )

    args.json_out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
