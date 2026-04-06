from __future__ import annotations

import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "data" / "shard-milestone-save-owner-candidates.v1.json"


def build_dataset() -> dict[str, object]:
    return {
        "dataset": "shard-milestone-save-owner-candidates.v1",
        "generatedAt": str(date.today()),
        "sources": {
            "shardSaveBoundary": "data/shard-save-boundary.v1.json",
            "ownerFamilyBoundary": "data/shard-owner-family-boundary.v1.json",
            "payloadBoundary": "data/shard-milestone-payload-boundary.v1.json",
            "typeMetadataProbe": "data/shard-type-metadata-probe.v1.json",
            "extractionCandidateFamilies": "data/extraction-candidate-families.v1.json",
            "globalMetadata": "workbench/apk/base/global-metadata.dat",
            "level0": "workbench/unity/joined/level0"
        },
        "candidateTypes": [
            {
                "id": "player-profile-side-shard-member-shell",
                "label": "PlayerProfile-side shard member shell",
                "kind": "save-model-shell",
                "confidence": "low",
                "why": [
                    "Shard save-boundary checks still show zero direct overlap between the narrowed shard-local owner trail and PlayerProfileData save-family anchors.",
                    "A PlayerProfile-side shard member shell remains a viable unresolved class of owner because shard state still has to land somewhere save-side even though no direct declaring type is recovered yet."
                ],
                "candidateFieldClusters": [
                    "PlayerProfileData",
                    "GetPlayerProfileData",
                    "FillPlayerProfileData",
                    "CloudSavePlayerProfile"
                ],
                "checkedOverlapStats": {
                    "ownerShellWithSaveOverlapCount": 0,
                    "metadataNeighborhoodHasSaveTerms": False,
                    "level0HasSaveTerms": False,
                    "directShardPlayerProfileContext": False
                }
            },
            {
                "id": "shard-mining-wrapper-or-handoff-shell",
                "label": "ShardMining wrapper or handoff shell",
                "kind": "owner-handoff-shell",
                "confidence": "medium-low",
                "why": [
                    "ShardMining and ShardUpgradeInfo still preserve the strongest shard-local runtime and row-payload clues.",
                    "The unresolved seam may be a wrapper, handoff object, or adjacent shell that bridges runtime shard rows to any saved player-owned milestone state without reusing the visible shard-local owner names directly."
                ],
                "candidateFieldClusters": [
                    "ShardMining",
                    "ShardUpgradeInfo",
                    "upgradeInfoList",
                    "TotalMilestoneLevels",
                    "MilestoneCostList"
                ],
                "checkedOverlapStats": {
                    "shardOwnerFamiliesChecked": 2,
                    "typedOwnerListHooksRecovered": 2,
                    "typedShardUpgradeInfoFieldsRecovered": 3,
                    "recoveredDirectSaveDeclaringType": False
                }
            }
        ],
        "confidenceNotes": [
            "This artifact only narrows likely save-owner classes; it does not recover a concrete declaring save type for player-owned shard milestone state.",
            "The current evidence still separates shard-local runtime owners from save-family anchors, so confidence remains intentionally bounded."
        ],
        "checkedOverlapStatistics": {
            "saveFamilyTermsChecked": 4,
            "shardOwnerShellTermsChecked": 12,
            "ownerShellWithSaveOverlapCount": 0,
            "directShardPlayerProfileContext": False,
            "candidateTypeCount": 2
        },
        "warnings": [
            "Candidate narrowing is not recovered player-owned shard milestone state.",
            "Do not wire planner logic, affordability logic, or import logic to these candidates."
        ],
        "currentBoundary": [
            "Treat this dataset as a candidate-narrowing artifact only, not as recovered player-owned shard milestone state or a verified save owner.",
            "The current repo evidence still preserves zero checked overlap between narrowed shard-local owner clues and PlayerProfileData save-family anchors.",
            "Use these candidates to focus future extraction work, not to enable planner-safe shard state, recommendation logic, or import mapping."
        ]
    }


def main() -> None:
    dataset = build_dataset()
    OUTPUT_PATH.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()
