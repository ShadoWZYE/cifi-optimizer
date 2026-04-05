from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"
GROUNDED_PATH = ROOT / "data" / "shard-milestones.grounded.v1.json"
JSON_OUT = ROOT / "data" / "shard-bonus-slot-probe.v1.json"
MD_OUT = ROOT / "docs" / "systems" / "shards" / "shard-bonus-slot-probe.md"


def main() -> int:
    metadata_text = METADATA_PATH.read_bytes().decode("latin1", errors="ignore")
    grounded = json.loads(GROUNDED_PATH.read_text(encoding="utf-8"))
    grounded_rows = {int(item["milestoneNumber"]): item for item in grounded["milestones"]}
    rows = []
    for row in range(30):
        bonus_slots = sorted(set(re.findall(rf"SU{row}Bonus(\d+)", metadata_text)))
        calc_slots = sorted(set(re.findall(rf"get_SU{row}Bonus(\d+)Calc", metadata_text)))
        grounded_bonus_count = len(grounded_rows.get(row, {}).get("bonuses", []))
        rows.append(
            {
                "row": row,
                "bonusFieldCount": len(bonus_slots),
                "calcAccessorCount": len(calc_slots),
                "groundedBonusCount": grounded_bonus_count,
                "slotIds": [int(value) for value in bonus_slots],
                "calcIds": [int(value) for value in calc_slots],
                "matchesGroundedCount": grounded_bonus_count == len(bonus_slots),
            }
        )

    payload = {
        "dataset": "shard-bonus-slot-probe.v1",
        "generatedAt": "2026-04-04",
        "source": {
            "metadata": str(METADATA_PATH),
            "groundedMilestones": str(GROUNDED_PATH),
        },
        "rows": rows,
        "findings": [
            "Metadata preserves explicit SU0-29 bonus-field families, which yields exact bonus-slot counts for each shard row.",
            "Rows 1-29 currently match the grounded descriptive bonus-entry counts.",
            "Row 0 is the main mismatch: metadata preserves eight bonus slots while the grounded descriptive dataset currently carries only three surfaced bonus entries.",
        ],
        "currentBoundary": [
            "Treat the metadata slot counts as direct shard-row bonus-arity evidence.",
            "Do not treat slot counts alone as final player-facing effect text or bonus formulas.",
            "Use row-0 mismatch as evidence that the current descriptive Eternal milestone entry is still incomplete.",
        ],
    }

    lines = [
        "# Shard Bonus Slot Probe",
        "",
        "Source: [`workbench/apk/base/global-metadata.dat`](C:\\Users\\Shadow\\Desktop\\CiFi\\workbench\\apk\\base\\global-metadata.dat) compared against [`data/shard-milestones.grounded.v1.json`](C:\\Users\\Shadow\\Desktop\\CiFi\\data\\shard-milestones.grounded.v1.json).",
        "",
        "## Grounded conclusions",
        "",
        "- Metadata preserves exact `SU*Bonus*` slot families for rows 0-29.",
        "- Rows 1-29 currently match the grounded descriptive bonus-entry counts.",
        "- Row 0 remains incomplete in the grounded descriptive dataset: metadata preserves eight slots while only three bonus entries are currently surfaced.",
        "",
        "## Row counts",
        "",
    ]
    for row in rows:
        lines.append(
            f"- `SU{row['row']}`: "
            f"`bonusFields={row['bonusFieldCount']}`; "
            f"`calcAccessors={row['calcAccessorCount']}`; "
            f"`groundedEntries={row['groundedBonusCount']}`; "
            f"`matches={str(row['matchesGroundedCount']).lower()}`"
        )
    lines.append("")

    JSON_OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    MD_OUT.write_text("\n".join(lines), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
