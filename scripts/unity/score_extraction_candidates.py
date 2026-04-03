from __future__ import annotations

import argparse
import json
import re
from bisect import bisect_left
from pathlib import Path


ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")
PARAGRAPH_SPLIT_RE = re.compile(r"\n\s*\n")


def collect_strings(blob: bytes) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for match in ASCII_RE.finditer(blob):
        entries.append(
            {
                "offset": match.start(),
                "kind": "ascii",
                "value": match.group().decode("ascii", errors="ignore"),
            }
        )
    for match in UTF16_RE.finditer(blob):
        entries.append(
            {
                "offset": match.start(),
                "kind": "utf16",
                "value": match.group().decode("utf-16le", errors="ignore"),
            }
        )
    entries.sort(key=lambda item: int(item["offset"]))
    return entries


def find_nearby(entries: list[dict[str, object]], anchor_offset: int, byte_radius: int) -> list[dict[str, object]]:
    offsets = [int(entry["offset"]) for entry in entries]
    start = bisect_left(offsets, anchor_offset - byte_radius)
    end = bisect_left(offsets, anchor_offset + byte_radius)
    return entries[start:end]


def normalize_term(term: str) -> str:
    return term.strip().lower()


def split_text_segments(text: str) -> list[str]:
    return [segment.strip() for segment in PARAGRAPH_SPLIT_RE.split(text) if segment.strip()]


def filter_families(families: list[dict[str, object]], filters: list[str]) -> list[dict[str, object]]:
    if not filters:
        return families

    lowered_filters = [normalize_term(item) for item in filters]
    selected: list[dict[str, object]] = []
    for family in families:
        family_id = normalize_term(str(family["id"]))
        track = normalize_term(str(family.get("track", "")))
        if any(
            family_id == item
            or family_id.startswith(f"{item}.")
            or track == item
            for item in lowered_filters
        ):
            selected.append(family)
    return selected


def score_candidate(summary: dict[str, object]) -> int:
    unresolved_mentions = int(summary["unresolvedMentionCount"])
    mention_count = int(summary["textMentionCount"])
    mention_files = int(summary["textFilesWithMentions"])
    unresolved_files = int(summary["textFilesWithUnresolvedMentions"])
    unique_anchor_terms_found = int(summary["uniqueAnchorTermsFound"])
    binary_files = int(summary["binaryFilesWithAnchorHits"])
    nearby_context_term_count = int(summary["nearbyContextTermCount"])
    anchor_hit_count = int(summary["anchorHitCount"])
    metadata_anchor_hits = int(summary["metadataAnchorHits"])
    scene_anchor_hits = int(summary["sceneAnchorHits"])
    return (
        min(unresolved_mentions, 12) * 40
        + unresolved_files * 10
        + min(mention_count, 20) * 4
        + mention_files * 6
        + unique_anchor_terms_found * 20
        + binary_files * 10
        + min(nearby_context_term_count, 10) * 4
        + min(anchor_hit_count, 20) * 2
        + min(metadata_anchor_hits, 8) * 2
        + min(scene_anchor_hits, 8) * 2
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--json-out", type=Path, required=True)
    parser.add_argument("--byte-radius", type=int, default=2048)
    parser.add_argument("--family", action="append", default=[])
    args = parser.parse_args()

    config = json.loads(args.config.read_text(encoding="utf-8"))
    repo_root = args.config.resolve().parent.parent

    binary_paths = [(repo_root / relative_path).resolve() for relative_path in config["binaryFiles"]]
    binary_entries: dict[str, list[dict[str, object]]] = {}
    for path in binary_paths:
        if not path.exists():
            raise FileNotFoundError(path)
        binary_entries[str(path)] = collect_strings(path.read_bytes())

    text_paths = [(repo_root / relative_path).resolve() for relative_path in config["textFiles"]]
    text_entries: dict[str, list[str]] = {}
    for path in text_paths:
        if not path.exists():
            raise FileNotFoundError(path)
        text_entries[str(path)] = split_text_segments(path.read_text(encoding="utf-8", errors="ignore"))

    families = filter_families(config["families"], args.family)
    global_context_terms = [normalize_term(term) for term in config["globalContextTerms"]]
    unresolved_markers = [normalize_term(term) for term in config["unresolvedMarkers"]]
    candidates_output: list[dict[str, object]] = []

    for family in families:
        anchors = [normalize_term(term) for term in family["anchors"]]
        terms = [normalize_term(term) for term in family.get("terms", [])]
        search_terms = sorted(set(anchors + terms))

        anchor_hits: list[dict[str, object]] = []
        binary_files_with_anchor_hits: set[str] = set()
        unique_anchor_terms_found: set[str] = set()
        nearby_context_terms_found: set[str] = set()
        metadata_anchor_hits = 0
        scene_anchor_hits = 0

        for file_path, entries in binary_entries.items():
            for entry in entries:
                value = str(entry["value"])
                lowered = value.lower()
                matched_anchors = [anchor for anchor in anchors if anchor in lowered]
                if not matched_anchors:
                    continue

                binary_files_with_anchor_hits.add(file_path)
                unique_anchor_terms_found.update(matched_anchors)
                if file_path.endswith("global-metadata.dat"):
                    metadata_anchor_hits += 1
                else:
                    scene_anchor_hits += 1

                nearby = find_nearby(entries, int(entry["offset"]), args.byte_radius)
                nearby_context_matches: list[str] = []
                for nearby_entry in nearby:
                    nearby_value = str(nearby_entry["value"]).lower()
                    matched_context = [term for term in global_context_terms if term in nearby_value]
                    for matched in matched_context:
                        nearby_context_terms_found.add(matched)
                    if matched_context:
                        nearby_context_matches.append(str(nearby_entry["value"]))

                anchor_hits.append(
                    {
                        "file": str(Path(file_path).relative_to(repo_root)).replace("\\", "/"),
                        "offset": int(entry["offset"]),
                        "kind": entry["kind"],
                        "value": value,
                        "matchedAnchors": matched_anchors,
                        "nearbyContextExamples": nearby_context_matches[:5],
                    }
                )

        text_mentions = 0
        unresolved_mentions = 0
        text_files_with_mentions: set[str] = set()
        text_files_with_unresolved_mentions: set[str] = set()
        unresolved_excerpts: list[dict[str, object]] = []

        for file_path, segments in text_entries.items():
            for segment in segments:
                lowered = segment.lower()
                if not any(term in lowered for term in search_terms):
                    continue
                text_mentions += 1
                text_files_with_mentions.add(file_path)
                if any(marker in lowered for marker in unresolved_markers):
                    unresolved_mentions += 1
                    text_files_with_unresolved_mentions.add(file_path)
                    if len(unresolved_excerpts) < 6:
                        excerpt = " ".join(segment.split())
                        unresolved_excerpts.append(
                            {
                                "file": str(Path(file_path).relative_to(repo_root)).replace("\\", "/"),
                                "excerpt": excerpt[:260],
                            }
                        )

        summary = {
            "id": family["id"],
            "label": family["label"],
            "track": family.get("track"),
            "terms": family.get("terms", []),
            "anchors": family["anchors"],
            "textMentionCount": text_mentions,
            "unresolvedMentionCount": unresolved_mentions,
            "textFilesWithMentions": len(text_files_with_mentions),
            "textFilesWithUnresolvedMentions": len(text_files_with_unresolved_mentions),
            "unresolvedExcerpts": unresolved_excerpts,
            "anchorHitCount": len(anchor_hits),
            "binaryFilesWithAnchorHits": len(binary_files_with_anchor_hits),
            "binaryFileCoverage": sorted(str(Path(path).relative_to(repo_root)).replace("\\", "/") for path in binary_files_with_anchor_hits),
            "uniqueAnchorTermsFound": len(unique_anchor_terms_found),
            "nearbyContextTermCount": len(nearby_context_terms_found),
            "nearbyContextTerms": sorted(nearby_context_terms_found),
            "metadataAnchorHits": metadata_anchor_hits,
            "sceneAnchorHits": scene_anchor_hits,
            "topAnchorHits": anchor_hits[:6],
        }
        summary["heuristicScore"] = score_candidate(summary)
        candidates_output.append(summary)

    candidates_output.sort(
        key=lambda item: (
            -int(item["heuristicScore"]),
            -int(item["unresolvedMentionCount"]),
            -int(item["anchorHitCount"]),
            str(item["label"]),
        )
    )

    top_candidate = candidates_output[0] if candidates_output else None
    report = {
        "dataset": "extraction-candidate-ranking.v1",
        "generatedAt": config["generatedAt"],
        "sourceConfig": str(args.config.resolve().relative_to(repo_root)).replace("\\", "/"),
        "byteRadius": args.byte_radius,
        "globalContextTerms": config["globalContextTerms"],
        "unresolvedMarkers": config["unresolvedMarkers"],
        "binaryFiles": config["binaryFiles"],
        "textFiles": config["textFiles"],
        "familyFilter": args.family,
        "topCandidate": {
            "id": top_candidate["id"],
            "label": top_candidate["label"],
            "track": top_candidate.get("track"),
            "heuristicScore": top_candidate["heuristicScore"],
        } if top_candidate else None,
        "candidates": candidates_output,
    }
    args.json_out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
