from __future__ import annotations

import json
import struct
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
METADATA_PATH = ROOT / "_cifi_apk" / "global-metadata.dat"
LEVEL0_PATH = ROOT / "_unity_joined" / "level0"
JSON_OUT = ROOT / "data" / "token-shop-values.json"
MD_OUT = ROOT / "docs" / "token-shop-values.md"

TOKEN_SHOP_ABSOLUTE_OFFSET = 32_801_984
TOKEN_SHOP_FIELD_OFFSET = 236
TOKEN_METADATA_START = 661_500
TOKEN_METADATA_END = 666_400

PTR_SUFFIXES = (
    "Object",
    "Notification",
    "Text",
    "Fill",
    "Button",
    "MaxOverlay",
    "Content",
    "Overlay",
)


def extract_field_names(metadata_blob: bytes) -> list[str]:
    segment = metadata_blob[TOKEN_METADATA_START:TOKEN_METADATA_END]
    parts = [part.decode("utf-8", errors="ignore") for part in segment.split(b"\x00") if part]
    start = parts.index("MeltdownActiveObject")
    end = parts.index("Tier5TokenUnlockReward") + 1
    return parts[start:end]


def is_pointer_field(name: str) -> bool:
    return any(name.endswith(suffix) for suffix in PTR_SUFFIXES)


def infer_group(name: str) -> str:
    if name.startswith("TokenBoost") or name.startswith("DiamondBoost") or name.startswith("CellBoost") or name.startswith("ModBoost") or name.startswith("MK"):
        return "tier1"
    if name.startswith("TokenBoostT2") or name.startswith("TokenDailiesT2") or name.startswith("T2Duo"):
        return "tier2"
    if name.startswith("TokenBoostT3") or name.startswith("TokenDailiesT3") or name.startswith("T3Trio"):
        return "tier3"
    if name.startswith("ATU24") or name.startswith("ATU25") or name.startswith("ATU26") or name.startswith("ATU27") or name.startswith("ATU28") or name.startswith("Tier4"):
        return "tier4plus"
    return "controller"


def infer_numeric_value(name: str, raw_u32: int, raw_f32: float) -> object:
    if "MaxLevel" in name or "UnlockReward" in name or name == "CE":
        return raw_u32
    if abs(raw_f32) < 1e-20 and raw_u32 <= 10_000:
        return raw_u32
    return raw_f32


def parse_token_shop(level_blob: bytes, field_names: list[str]) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    offset = TOKEN_SHOP_FIELD_OFFSET
    for name in field_names:
        entry: dict[str, object] = {
            "field": name,
            "group": infer_group(name),
            "object_offset": offset,
        }
        absolute = TOKEN_SHOP_ABSOLUTE_OFFSET + offset
        if is_pointer_field(name):
            file_id = struct.unpack_from("<I", level_blob, absolute)[0]
            path_id = struct.unpack_from("<Q", level_blob, absolute + 4)[0]
            entry["kind"] = "pointer"
            entry["file_id"] = file_id
            entry["path_id"] = path_id
            offset += 12
        else:
            raw_u32 = struct.unpack_from("<I", level_blob, absolute)[0]
            raw_f32 = struct.unpack_from("<f", level_blob, absolute)[0]
            entry["kind"] = "number"
            entry["raw_u32"] = raw_u32
            entry["raw_f32"] = raw_f32
            entry["value"] = infer_numeric_value(name, raw_u32, raw_f32)
            offset += 4
        entries.append(entry)
    return entries


def build_numeric_table(entries: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    table: dict[str, dict[str, object]] = {}
    for entry in entries:
        if entry["kind"] != "number":
            continue
        field = str(entry["field"])
        if not any(marker in field for marker in ("StartCost", "AdditiveCost", "Bonus", "MaxLevel", "UnlockReward")):
            continue

        prefix = field
        for suffix in ("StartCost", "AdditiveCost", "Bonus1", "Bonus2", "Bonus3", "Bonus4", "Bonus5", "Bonus", "FillMaxLevel", "MaxLevel", "UnlockReward"):
            if field.endswith(suffix):
                prefix = field[: -len(suffix)]
                key = suffix
                break
        else:
            key = field

        record = table.setdefault(prefix, {})
        record[key] = entry["value"]
        record["group"] = entry["group"]
    return table


def format_value(value: object) -> str:
    if isinstance(value, float):
        if value.is_integer():
            return str(int(value))
        return f"{value:.6g}"
    return str(value)


def render_markdown(entries: list[dict[str, object]], table: dict[str, dict[str, object]]) -> str:
    lines = [
        "# Token Shop Values",
        "",
        "Source: serialized `TokenShop` MonoBehaviour payload in [`_unity_joined/level0`](C:\\Users\\Shadow\\Desktop\\CiFi\\_unity_joined\\level0), aligned to declaration-order field names recovered from [`_cifi_apk/global-metadata.dat`](C:\\Users\\Shadow\\Desktop\\CiFi\\_cifi_apk\\global-metadata.dat).",
        "",
        "## Grounded conclusions",
        "",
        "- The token shop values are stored directly in the `TokenShop` scene object, not only in UI strings.",
        "- The field layout confirms a named `StartCost`, `AdditiveCost`, `Bonus`, `MaxLevel` model for early token tiers.",
        "- Tier-1 generator token boosts use `FillMaxLevel` instead of plain `MaxLevel`.",
        "- Late token upgrades `ATU24` through `ATU28` are also serialized in the same object.",
        "",
        "## Selected values",
        "",
    ]

    selected_prefixes = [
        "TokenBoost",
        "DiamondBoost",
        "CellBoost",
        "ModBoost",
        "MK1TokenBoost",
        "MK2TokenBoost",
        "MK3TokenBoost",
        "TokenBoostT2",
        "TokenDailiesT2",
        "T2Duo3",
        "TokenBoostT3",
        "T3Trio1",
        "ATU24",
        "ATU25",
        "ATU26",
        "ATU27",
        "ATU28",
    ]
    for prefix in selected_prefixes:
        if prefix not in table:
            continue
        record = table[prefix]
        parts = [f"`{key}={format_value(value)}`" for key, value in record.items() if key != "group"]
        lines.append(f"- `{prefix}`: " + ", ".join(parts))

    lines.extend(
        [
            "",
            "## Raw field alignment",
            "",
            "The following early fields show the exact byte alignment between metadata names and serialized object data:",
            "",
        ]
    )

    for entry in entries[:36]:
        if entry["kind"] == "pointer":
            value_text = f"path `{entry['path_id']}`"
        else:
            value_text = format_value(entry["value"])
        lines.append(f"- offset `{entry['object_offset']}` `{entry['field']}` -> {value_text}")

    lines.append("")
    lines.append("## Formula evidence")
    lines.append("")
    lines.append("- `T2Duo3StartCost=100`, `T2Duo3AdditiveCost=3`, `T2Duo3Bonus=1.02`, `T2Duo3MaxLevel=2500`.")
    lines.append("- This matches the in-game `Duo Booster Three` screenshots: cost at level `1722` is `100 + 3 * 1722 = 5266`, displayed as `5.27k` after rounding.")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    metadata_blob = METADATA_PATH.read_bytes()
    level_blob = LEVEL0_PATH.read_bytes()
    field_names = extract_field_names(metadata_blob)
    entries = parse_token_shop(level_blob, field_names)
    table = build_numeric_table(entries)

    payload = {
        "source": {
            "metadata": str(METADATA_PATH),
            "level0": str(LEVEL0_PATH),
            "token_shop_absolute_offset": TOKEN_SHOP_ABSOLUTE_OFFSET,
            "token_shop_field_offset": TOKEN_SHOP_FIELD_OFFSET,
        },
        "field_count": len(field_names),
        "fields": entries,
        "numeric_table": table,
    }

    JSON_OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    MD_OUT.write_text(render_markdown(entries, table), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
