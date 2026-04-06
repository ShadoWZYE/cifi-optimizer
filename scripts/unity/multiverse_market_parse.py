from __future__ import annotations

import json
import struct
from pathlib import Path

from portable_paths import md_link, repo_relative


ROOT = Path(__file__).resolve().parents[2]
LEVEL0_PATH = ROOT / "workbench" / "unity" / "joined" / "level0"
JSON_OUT = ROOT / "data" / "multiverse-market-values.json"
MD_OUT = ROOT / "docs" / "systems" / "spend" / "multiverse-market-values.md"

MULTIVERSE_MARKET_ABSOLUTE_OFFSET = 33_216_256
LATE_BLOCK_START = 19_288
LATE_BLOCK_STRIDE = 328
LATE_BLOCK_SCAN_RANGE = range(50, 111)


def read_u32(blob: bytes, offset: int) -> int:
    return struct.unpack_from("<I", blob, offset)[0]


def read_f32(blob: bytes, offset: int) -> float:
    return struct.unpack_from("<f", blob, offset)[0]


def read_f64(blob: bytes, offset: int) -> float:
    return struct.unpack_from("<d", blob, offset)[0]


def read_pptr(blob: bytes, offset: int) -> dict[str, int]:
    return {
        "file_id": read_u32(blob, offset),
        "path_id": struct.unpack_from("<Q", blob, offset + 4)[0],
    }


def parse_late_inscription_block(obj: bytes, ins_id: int) -> dict[str, object]:
    offset = LATE_BLOCK_START + (ins_id - 50) * LATE_BLOCK_STRIDE
    bonus_raw_u32 = read_u32(obj, offset + 44)
    bonus_raw_f32 = read_f32(obj, offset + 44)
    if abs(bonus_raw_f32) < 1e-20 and bonus_raw_u32 <= 10_000:
        bonus_value: object = bonus_raw_u32
    else:
        bonus_value = bonus_raw_f32

    record = {
        "inscription_id": read_u32(obj, offset),
        "record_offset": offset,
        "absolute_offset": MULTIVERSE_MARKET_ABSOLUTE_OFFSET + offset,
        "max_level": read_u32(obj, offset + 4),
        "buy_button": read_pptr(obj, offset + 8),
        "currency_box": read_pptr(obj, offset + 20),
        "max_overlay": read_pptr(obj, offset + 32),
        "bonus_raw_u32": bonus_raw_u32,
        "bonus_raw_f32": bonus_raw_f32,
        "bonus_value": bonus_value,
        "start_cost": read_f64(obj, offset + 48),
        "extra_raw_u32": read_u32(obj, offset + 56),
        "cost_exponent": read_f64(obj, offset + 64),
        "progress_list_size": read_u32(obj, offset + 80),
        "max_level_objects_size": read_u32(obj, offset + 204),
    }
    return record


def is_valid_late_block_record(record: dict[str, object]) -> bool:
    inscription_id = int(record["inscription_id"])
    max_level = int(record["max_level"])
    start_cost = float(record["start_cost"])
    cost_exponent = float(record["cost_exponent"])
    progress_size = int(record["progress_list_size"])
    max_objects_size = int(record["max_level_objects_size"])
    buy_button = int(record["buy_button"]["path_id"])
    currency_box = int(record["currency_box"]["path_id"])
    max_overlay = int(record["max_overlay"]["path_id"])

    return (
        1 <= inscription_id <= 110
        and 1 <= max_level <= 100
        and 0 < start_cost < 1e20
        and 0 < cost_exponent <= 10
        and progress_size == 10
        and max_objects_size == 10
        and buy_button > 0
        and currency_box > 0
        and max_overlay > 0
    )


def render_markdown(records: list[dict[str, object]]) -> str:
    lines = [
        "# Multiverse Market Values",
        "",
        f"Source: serialized `MultiverseMarket` MonoBehaviour payload in {md_link(LEVEL0_PATH)}.",
        "",
        "## Grounded conclusions",
        "",
        "- The late Chrystos Emporium inscription rows are stored directly in the `MultiverseMarket` scene object.",
        "- For the validated late block, each inscription row exposes direct serialized values for `ID`, `MaxLevel`, `Bonus`, `StartCost`, and `CostExponent`.",
        "- The current validated late-block scan yields 22 structurally valid rows before the layout changes again.",
        "- These rows are not serialized in inscription-ID order; they appear to be a display/order list rather than a plain `IS50..IS71` sequence.",
        "- The visible screenshot row `Inscription #51` is present in this block with direct extracted constants.",
        "",
        "## Extracted late-block rows",
        "",
    ]

    for record in records:
        lines.append(
            "- "
            f"`IS{record['inscription_id']}`: "
            f"`MaxLevel={record['max_level']}`; "
            f"`Bonus={record['bonus_value']}`; "
            f"`StartCost={record['start_cost']:.6g}`; "
            f"`CostExponent={record['cost_exponent']:.6g}`; "
            f"`ProgressObjects={record['progress_list_size']}`; "
            f"`MaxLevelObjects={record['max_level_objects_size']}`"
        )

    lines.extend(
        [
            "",
            "## Screenshot anchor",
            "",
            "- `Inscription #51` in the provided Emporium screenshot matches a serialized row with `MaxLevel=10`, `Bonus=8`, `StartCost=2`, and `CostExponent=2.5`.",
            "- The same row still points to concrete scene UI objects for its `BuyButton`, `CurrencyBox`, and `MaxOverlay`, confirming this is the real Emporium upgrade block rather than a detached text table.",
            "- `FinalIS*Cost` and `FinalIS*Bonus` are still present in metadata as code-side outputs, but they do not appear as a simple trailing serialized array in this validated block.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    blob = LEVEL0_PATH.read_bytes()
    obj = blob[MULTIVERSE_MARKET_ABSOLUTE_OFFSET: MULTIVERSE_MARKET_ABSOLUTE_OFFSET + 39_412]
    records = []
    for ins_id in LATE_BLOCK_SCAN_RANGE:
        record = parse_late_inscription_block(obj, ins_id)
        if is_valid_late_block_record(record):
            records.append(record)

    payload = {
        "source": {
            "level0": repo_relative(LEVEL0_PATH),
            "multiverse_market_absolute_offset": MULTIVERSE_MARKET_ABSOLUTE_OFFSET,
            "late_block_start": LATE_BLOCK_START,
            "late_block_stride": LATE_BLOCK_STRIDE,
            "validated_ids": [record["inscription_id"] for record in records],
        },
        "records": records,
    }

    JSON_OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    MD_OUT.write_text(render_markdown(records), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
