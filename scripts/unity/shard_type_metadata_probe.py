from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
UABEA_REPORT_PATH = ROOT / "data" / "uabea-probe-report.json"
JSON_OUT = ROOT / "data" / "shard-type-metadata-probe.v1.json"
MD_OUT = ROOT / "docs" / "systems" / "shards" / "shard-type-metadata-probe.md"


ROW_FIELD_PATTERN = re.compile(r"^SU(?P<row>\d+)(?P<kind>UnlockReq|StartCost|CostExponent|GrowthExponent\d*|Bonus\d+)$")
TEXT_FIELD_PATTERN = re.compile(r"^SM(?P<row>\d+)B(?P<slot>\d+)Text$")


def load_probe() -> dict[str, object]:
    return json.loads(UABEA_REPORT_PATH.read_text(encoding="utf8"))


def get_target(targets: list[dict[str, object]], script_name: str) -> dict[str, object]:
    for entry in targets:
        if entry.get("scriptName") == script_name:
            return entry
    raise KeyError(f"Missing directTargetTypeMetadata entry for {script_name}")


def build_rows(shard_mining_fields: list[dict[str, object]], text_handler_fields: list[dict[str, object]]) -> list[dict[str, object]]:
    rows: dict[int, dict[str, object]] = defaultdict(
        lambda: {
            "row": None,
            "unlockRequirementField": None,
            "costFields": [],
            "bonusFields": [],
            "bonusTextFields": [],
        }
    )

    for field in shard_mining_fields:
        field_name = str(field.get("name", ""))
        match = ROW_FIELD_PATTERN.match(field_name)
        if not match:
            continue
        row = int(match.group("row"))
        kind = match.group("kind")
        row_entry = rows[row]
        row_entry["row"] = row
        compact = {
            "name": field_name,
            "type": field.get("type"),
            "fieldOffset": field.get("fieldOffset"),
        }
        if kind == "UnlockReq":
            row_entry["unlockRequirementField"] = compact
        elif kind.startswith("Bonus"):
            row_entry["bonusFields"].append(compact)
        else:
            row_entry["costFields"].append(compact)

    for field in text_handler_fields:
        field_name = str(field.get("name", ""))
        match = TEXT_FIELD_PATTERN.match(field_name)
        if not match:
            continue
        row = int(match.group("row"))
        row_entry = rows[row]
        row_entry["row"] = row
        row_entry["bonusTextFields"].append(
            {
                "name": field_name,
                "type": field.get("type"),
                "fieldOffset": field.get("fieldOffset"),
            }
        )

    output = []
    for row in sorted(rows):
        row_entry = rows[row]
        row_entry["costFields"] = sorted(row_entry["costFields"], key=lambda item: int(item["fieldOffset"]))
        row_entry["bonusFields"] = sorted(row_entry["bonusFields"], key=lambda item: int(item["fieldOffset"]))
        row_entry["bonusTextFields"] = sorted(row_entry["bonusTextFields"], key=lambda item: int(item["fieldOffset"]))
        row_entry["costFieldCount"] = len(row_entry["costFields"])
        row_entry["bonusFieldCount"] = len(row_entry["bonusFields"])
        row_entry["bonusTextFieldCount"] = len(row_entry["bonusTextFields"])
        output.append(row_entry)
    return output


def build_dataset() -> dict[str, object]:
    probe = load_probe()
    targets = list(probe.get("directTargetTypeMetadata", []))
    shard_mining = get_target(targets, "ShardMining")
    shard_text_handler = get_target(targets, "ShardPerLevelTextHandler")
    shard_upgrade_info = get_target(targets, "ShardUpgradeInfo")

    shard_mining_fields = list(shard_mining.get("fields", []))
    shard_text_handler_fields = list(shard_text_handler.get("fields", []))
    shard_upgrade_info_fields = list(shard_upgrade_info.get("fields", []))
    rows = build_rows(shard_mining_fields, shard_text_handler_fields)
    over_level_base_fields = [
        {
            "name": field.get("name"),
            "type": field.get("type"),
            "fieldOffset": field.get("fieldOffset"),
            "defaultValue": field.get("defaultValue"),
        }
        for field in shard_mining_fields
        if str(field.get("name", "")).startswith("OverLevel") and str(field.get("name", "")).endswith("Base")
    ]

    owner_list_fields = [
        {
            "name": field.get("name"),
            "type": field.get("type"),
            "fieldOffset": field.get("fieldOffset"),
        }
        for field in shard_mining_fields
        if str(field.get("name", "")) in {"MilestoneCostList", "upgradeInfoList", "UnlockedMilestonesList", "MaxedMilestonesList"}
    ]

    return {
        "dataset": "shard-type-metadata-probe.v1",
        "generatedAt": str(date.today()),
        "source": {
            "uabeaProbeReport": str(UABEA_REPORT_PATH),
            "probeMethod": "direct LibCpp2IL Assembly-CSharp type reflection via CifiAssetProbe",
        },
        "targets": {
            "shardMining": {
                "fullName": shard_mining.get("fullName"),
                "baseType": shard_mining.get("baseType"),
                "fieldCount": shard_mining.get("fieldCount"),
                "ownerListFields": owner_list_fields,
                "overLevelBaseFields": over_level_base_fields,
            },
            "shardUpgradeInfo": {
                "fullName": shard_upgrade_info.get("fullName"),
                "baseType": shard_upgrade_info.get("baseType"),
                "fieldCount": shard_upgrade_info.get("fieldCount"),
                "fields": [
                    {
                        "name": field.get("name"),
                        "type": field.get("type"),
                        "fieldOffset": field.get("fieldOffset"),
                    }
                    for field in shard_upgrade_info_fields
                ],
            },
            "shardPerLevelTextHandler": {
                "fullName": shard_text_handler.get("fullName"),
                "baseType": shard_text_handler.get("baseType"),
                "fieldCount": shard_text_handler.get("fieldCount"),
            },
        },
        "rows": rows,
        "overLevelBaseValueRecovery": {
            "typedFieldShells": over_level_base_fields,
            "uabeaDefaultValuesPresent": False,
            "directMonoBehaviourFieldHitsCount": len(probe.get("directMonoBehaviourFieldHits", [])),
            "shardTargetMonoBehavioursCount": len(probe.get("shardTargetMonoBehaviours", [])),
            "exactSerializedValuesRecovered": False,
            "currentBestRead": [
                "The direct asset probe currently preserves typed OverLevel100Base, OverLevel200Base, OverLevel300Base, and OverLevel400Base field shells on ShardMining, but not concrete serialized values.",
                "The UABEA report records null default values for those fields and zero direct MonoBehaviour field hits for shard targets in this repo snapshot.",
                "That blocks exact payload recovery from the current .NET asset probe output and keeps the field shells as owner/type evidence only.",
            ],
        },
        "findings": [
            "Direct LibCpp2IL metadata reflection now exposes typed ShardMining row fields instead of only string-shell clues.",
            "ShardMining keeps row-local SU0-29 UnlockReq, StartCost, CostExponent, GrowthExponent, and Bonus field families directly on the MonoBehaviour type.",
            "ShardMining also keeps an upgradeInfoList typed as List<ShardMining+ShardUpgradeInfo>, and the nested ShardUpgradeInfo type currently exposes Cost, MaxLevel, and IsUnlocked fields.",
            "ShardMining also preserves typed OverLevel100Base, OverLevel200Base, OverLevel300Base, and OverLevel400Base BigDouble field shells on the owner MonoBehaviour.",
            "The current UABEA asset probe does not recover concrete serialized OverLevel*Base values: default values stay null and direct shard MonoBehaviour field hits remain empty.",
            "ShardPerLevelTextHandler keeps row-local SM*B*Text fields for shard bonus text slots, which is a stronger typed UI-text lead than generic milestone writers.",
        ],
        "currentBoundary": [
            "Treat this as a typed shard schema probe, not as final serialized row values.",
            "The field table proves where typed shard cost, bonus, and runtime state fields live, but it does not yet decode concrete serialized values from level0.",
            "Treat OverLevel*Base as typed owner-field shells only until a future asset probe or direct serialized parser can recover concrete payload values.",
            "Do not claim a verified get_SU*Cost formula or a row-complete player-facing effect-text table from the type schema alone.",
        ],
    }


def write_markdown(dataset: dict[str, object]) -> None:
    rows = dataset["rows"]
    target_shard_mining = dataset["targets"]["shardMining"]
    target_upgrade = dataset["targets"]["shardUpgradeInfo"]
    owner_fields = target_shard_mining["ownerListFields"]
    row0 = next(entry for entry in rows if entry["row"] == 0)
    row18 = next(entry for entry in rows if entry["row"] == 18)
    row27 = next(entry for entry in rows if entry["row"] == 27)

    lines = [
        "# Shard Type Metadata Probe",
        "",
        "This probe reduces the direct `LibCpp2IL` shard type reflection into a compact typed schema artifact.",
        "",
        "## Key findings",
        "",
        *[f"- {line}" for line in dataset["findings"]],
        "",
        "## Typed owner/state fields",
        "",
        f"- `ShardMining` field count: `{target_shard_mining['fieldCount']}`",
        f"- `ShardUpgradeInfo` field count: `{target_upgrade['fieldCount']}`",
        "- `ShardMining` list/state hooks:",
        *[
            f"  - `{entry['name']}`: `{entry['type']}` @ `{entry['fieldOffset']}`"
            for entry in owner_fields
        ],
        "- `ShardMining` over-level base field shells:",
        *[
            f"  - `{entry['name']}`: `{entry['type']}` @ `{entry['fieldOffset']}`; `defaultValue={entry['defaultValue']}`"
            for entry in target_shard_mining["overLevelBaseFields"]
        ],
        "- `ShardUpgradeInfo` fields:",
        *[
            f"  - `{entry['name']}`: `{entry['type']}` @ `{entry['fieldOffset']}`"
            for entry in target_upgrade["fields"]
        ],
        "",
        "## Row examples",
        "",
        f"- Row `0`: `{row0['costFieldCount']}` cost fields, `{row0['bonusFieldCount']}` bonus fields, `{row0['bonusTextFieldCount']}` typed text slots",
        f"- Row `18`: `{row18['costFieldCount']}` cost fields, `{row18['bonusFieldCount']}` bonus fields, `{row18['bonusTextFieldCount']}` typed text slots",
        f"- Row `27`: `{row27['costFieldCount']}` cost fields, `{row27['bonusFieldCount']}` bonus fields, `{row27['bonusTextFieldCount']}` typed text slots",
        "",
        "## Current boundary",
        "",
        *[f"- {line}" for line in dataset["currentBoundary"]],
        "",
    ]
    MD_OUT.write_text("\n".join(lines), encoding="utf8")


def main() -> None:
    dataset = build_dataset()
    JSON_OUT.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf8")
    write_markdown(dataset)


if __name__ == "__main__":
    main()
