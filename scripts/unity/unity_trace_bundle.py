from __future__ import annotations

import argparse
import json
import re
import sys
import types
from datetime import date
from pathlib import Path
from typing import Any

from portable_paths import md_link, repo_relative


ROOT = Path(__file__).resolve().parents[2]
JSON_OUT = ROOT / "data" / "unity-trace-bundle.json"
MD_OUT = ROOT / "docs" / "unity" / "unity-trace-bundle.md"
REGISTRY_PATH = ROOT / "data" / "unity-trace-target-registry.json"
METADATA_PATH = ROOT / "workbench" / "apk" / "base" / "global-metadata.dat"
UNITY_JOINED_DIR = ROOT / "workbench" / "unity" / "joined"

UNITY_ENV: Any = None


def install_unitypy_stubs() -> None:
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


def get_unity_env():
    global UNITY_ENV
    if UNITY_ENV is None:
        install_unitypy_stubs()
        sys.path.insert(0, str((ROOT / ".deps").resolve()))
        from UnityPy import Environment
        UNITY_ENV = Environment()
        UNITY_ENV.load_folder(str(UNITY_JOINED_DIR))
    return UNITY_ENV


ASCII_RE = re.compile(rb"[ -~]{4,}")
UTF16_RE = re.compile(rb"(?:[\x20-\x7E]\x00){4,}")
NUMERIC_RE = re.compile(r"^\d+$")
METHOD_RE = re.compile(r"^(?:get_|set_|Buy|Claim|Check|Start|Stop|Set|Fill|Open|Close|Display|Convert|Attach|Initialize|Update|On)[A-Za-z0-9_<>]+$")
CLASSLIKE_RE = re.compile(r"^[A-Z][A-Za-z0-9_<>]+$")

ALL_SOURCE_PATHS = {
    "metadata": METADATA_PATH,
    "level0": ROOT / "workbench" / "unity" / "joined" / "level0",
    "sharedassets0": ROOT / "workbench" / "unity" / "joined" / "sharedassets0.assets",
    "globalgamemanagers": ROOT / "workbench" / "unity" / "joined" / "globalgamemanagers.assets",
    "tokenShopExtract": ROOT / "data" / "token-shop-values.json",
    "tokenShopRowRemapBoundary": ROOT / "data" / "token-shop-row-remap-boundary.json",
    "tokenShopLateAtuBoundary": ROOT / "data" / "token-shop-late-atu-boundary.json",
    "dailyTokeniumLaneProbe": ROOT / "data" / "daily-tokenium-lane-probe.json",
    "dailyTokeniumOwnerProbe": ROOT / "data" / "daily-tokenium-owner-probe.json",
    "uabeaProbe": ROOT / "data" / "uabea-probe-report.json",
    "unityProbe": ROOT / "data" / "unity-probe-report.json",
    "lm244TargetedProbe": ROOT / "data" / "lm244-targeted-probe.json",
    "shardCostModelBoundary": ROOT / "data" / "shard-cost-model-boundary.v1.json",
    "shardCostParameterProbe": ROOT / "data" / "shard-cost-parameter-probe.v1.json",
    "shardCostMethodProbe": ROOT / "data" / "shard-cost-method-probe.v1.json",
    "shardCostNativeProbe": ROOT / "data" / "shard-cost-native-probe.v1.json",
    "shardCostFormulaModel": ROOT / "data" / "shard-cost-formula-model.v1.json",
    "shardSaveBoundary": ROOT / "data" / "shard-save-boundary.v1.json",
    "shardMilestonePayloadBoundary": ROOT / "data" / "shard-milestone-payload-boundary.v1.json",
    "shardMilestoneHandoffBoundary": ROOT / "data" / "shard-milestone-handoff-boundary.v1.json",
    "shardTypeMetadataProbe": ROOT / "data" / "shard-type-metadata-probe.v1.json",
    "shardSceneMonoBehaviourProbe": ROOT / "data" / "shard-scene-monobehaviour-probe.v1.json",
    "shardMilestoneSaveOwnerCandidates": ROOT / "data" / "shard-milestone-save-owner-candidates.v1.json",
    "multiverseMarketMemberBoundary": ROOT / "data" / "multiverse-market-market-member-boundary.json",
    "multiverseMarketSaveDataImportBoundary": ROOT / "data" / "multiverse-market-savedata-import-boundary.json",
    "multiverseMarketRangeBoundary": ROOT / "data" / "multiverse-market-range-boundary.json",
    "multiverseMarketRowTextCoverage": ROOT / "data" / "multiverse-market-row-text-coverage.json",
    "multiverseMarketActionShell": ROOT / "data" / "multiverse-market-action-shell.json",
}

SOURCE_ROLE_TEXT = {
    "metadata": "Preserves raw declaration-side string neighborhoods from global-metadata.dat.",
    "level0": "Direct Unity scene extraction from level0 (TokenShop, ShardMining, MultiverseMarket objects).",
    "sharedassets0": "Direct Unity shared assets extraction (prefabs, materials).",
    "globalgamemanagers": "Direct Unity global managers assets extraction.",
    "tokenShopExtract": "Preserves exact owner-payload shell windows and path ids recovered from the TokenShop parser.",
    "tokenShopRowRemapBoundary": "Preserves one already-cleared TokenShop row bridge and the checked blocked ATU3 comparison notes used for solved-vs-blocked diffing.",
    "tokenShopLateAtuBoundary": "Preserves the checked late ATU24-ATU28 shell neighborhood and its bounded negative title or prefab join result.",
    "dailyTokeniumLaneProbe": "Preserves named action-hook neighborhoods from the committed targeted string probe outputs.",
    "dailyTokeniumOwnerProbe": "Preserves committed owner-side TokenShop title and support-text neighborhoods from the local level0 probe lane.",
    "uabeaProbe": "Preserves UABEA or CifiAssetProbe object and type output such as named prefab identities or typed field tables.",
    "unityProbe": "Preserves broader committed unity string buckets including title or text-hook surfaces.",
    "lm244TargetedProbe": "Preserves targeted string-hit neighborhoods from the local lm244 follow-up probe lane.",
    "shardCostModelBoundary": "Preserves the grounded shard cost-model boundary around ShardUpgradeInfo, sampled get_SU* accessors, and the SU0 parameter shell.",
    "shardCostParameterProbe": "Preserves direct shard cost parameter offsets and field names recovered from committed APK/Unity evidence.",
    "shardCostMethodProbe": "Preserves the getter-family and helper-method structure for shard cost accessors.",
    "shardCostNativeProbe": "Preserves native getter field-read evidence tying get_SU* methods to specific shard cost parameters.",
    "shardCostFormulaModel": "Preserves the canonical shard-cost evaluator structure model and completion flags without claiming planner-safe closure.",
    "shardSaveBoundary": "Preserves the split between direct ShardMining row-definition payload and the still-unresolved owned-state path behind upgradeInfoList.",
    "shardMilestonePayloadBoundary": "Preserves the shard-local watcher hooks and payload-watch clusters without promoting them into a recovered owned-state source.",
    "shardMilestoneHandoffBoundary": "Preserves the current shard-local versus academy-side handoff narrowing around upgradeInfoList and generic ConstructionMilestones helpers.",
    "shardTypeMetadataProbe": "Preserves typed shard owner-list fields plus ShardMining+ShardUpgradeInfo row-state fields recovered from direct type reflection.",
    "shardSceneMonoBehaviourProbe": "Preserves the exact level0 ShardMining MonoBehaviour object that holds the direct shard definition payload.",
    "shardMilestoneSaveOwnerCandidates": "Preserves the still-blocked shard save-owner candidate narrowing used to keep structural cost work separate from save-side promotion.",
    "multiverseMarketMemberBoundary": "Preserves the checked PlayerProfileHandler.get_Market to MultiverseMarket accessor bridge and the exact SaveData owner boundary clues.",
    "multiverseMarketSaveDataImportBoundary": "Preserves the bounded compatibility-only Emporium import decision and the blocked canonical-import framing.",
    "multiverseMarketRangeBoundary": "Preserves the checked row-range overlap between validated Emporium rows and the wider IS* typed span.",
    "multiverseMarketRowTextCoverage": "Preserves the checked SetIS* cost-text coverage that anchors ordered row overlap without claiming full row identity recovery.",
    "multiverseMarketActionShell": "Preserves the checked BuyIS* action-shell coverage across the wider Emporium row family.",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_registry() -> dict[str, Any]:
    registry = load_json(REGISTRY_PATH)
    if registry.get("dataset") != "unity-trace-target-registry":
        raise ValueError("unity trace target registry dataset id drifted")
    return registry


def normalize_planner_term(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def unique_strings(values: list[str]) -> list[str]:
    output: list[str] = []
    seen: set[str] = set()
    for value in values:
        trimmed = value.strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        output.append(trimmed)
    return output


def infer_anchor_kind(value: str) -> str:
    if NUMERIC_RE.fullmatch(value):
        return "path id"
    if METHOD_RE.fullmatch(value) or (value.startswith("<") and ">" in value):
        return "method"
    if CLASSLIKE_RE.fullmatch(value):
        return "class"
    return "string"


def build_anchor_specs(values: list[str], origin: str) -> list[dict[str, Any]]:
    specs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for value in values:
        trimmed = value.strip()
        if not trimmed or trimmed in seen:
            continue
        seen.add(trimmed)
        specs.append(
            {
                "value": trimmed,
                "kind": infer_anchor_kind(trimmed),
                "origin": origin,
            }
        )
    return specs


def get_signal_tier(score: int) -> str:
    if score >= 100:
        return "high-signal"
    if score >= 65:
        return "supporting"
    return "incidental"


def get_source_search_modes(source_id: str) -> list[str]:
    return ["exact-structured"] if source_id != "metadata" else ["exact-string", "bounded-containment"]


def is_obvious_noise(value: str) -> list[str]:
    lower_value = value.lower()
    flags: list[str] = []
    if "publickey=" in lower_value:
        flags.append("assembly-public-key-blob")
    if "begin certificate" in lower_value or "end certificate" in lower_value:
        flags.append("certificate-blob")
    if len(value) >= 280:
        flags.append("long-string-blob")
    return flags


def format_signal_reason(match_mode: str, source_id: str, matched_anchor_values: list[str], noise_flags: list[str], local_signal: str | None = None) -> str:
    anchor_label = ", ".join(matched_anchor_values)
    parts = [f"{match_mode} match on {anchor_label} via {source_id}"]
    if local_signal:
        parts.append(local_signal)
    if noise_flags:
        parts.append(f"noise flags: {', '.join(noise_flags)}")
    return "; ".join(parts)


def format_anchor_specs(anchor_specs: list[dict[str, Any]]) -> str:
    return ", ".join(f"{item['value']} ({item['kind']})" for item in anchor_specs)


def flatten_planner_terms(family_plan: dict[str, Any]) -> list[str]:
    values = list(family_plan.get("queryTerms", [])) + list(family_plan.get("anchorExpansionTerms", []))
    for term_list in family_plan.get("synonymSets", {}).values():
        values.extend(term_list)
    return unique_strings(values)


def score_planner_family(family_id: str, family_plan: dict[str, Any], inputs: list[str]) -> dict[str, Any]:
    matched_terms: list[str] = []
    matched_inputs: list[str] = []
    score = 0
    for term in flatten_planner_terms(family_plan):
        normalized_term = normalize_planner_term(term)
        if not normalized_term:
            continue
        best_input: str | None = None
        best_score = 0
        for input_value in inputs:
            normalized_input = normalize_planner_term(input_value)
            if not normalized_input:
                continue
            if normalized_input == normalized_term:
                best_input = input_value
                best_score = 6
                break
            if normalized_input in normalized_term or normalized_term in normalized_input:
                if best_score < 3:
                    best_input = input_value
                    best_score = 3
        if best_input is None:
            continue
        score += best_score
        matched_terms.append(term)
        if best_input not in matched_inputs:
            matched_inputs.append(best_input)
    return {
        "familyId": family_id,
        "score": score,
        "matchedTerms": matched_terms,
        "matchedInputs": matched_inputs,
    }


def choose_best_family(registry: dict[str, Any], inputs: list[str]) -> dict[str, Any]:
    planner = registry["planner"]
    scored = [
        score_planner_family(family_id, planner["families"][family_id], inputs)
        for family_id in planner["familyOrder"]
    ]
    scored.sort(key=lambda item: (-int(item["score"]), -len(item["matchedTerms"]), planner["familyOrder"].index(item["familyId"])))
    best = scored[0]
    if int(best["score"]) <= 0:
        available = ", ".join(planner["familyOrder"])
        raise ValueError(f"Could not resolve a trace family from query inputs {inputs}. Checked planner families: {available}.")
    return best


def pick_synonym_sets(family_plan: dict[str, Any], inputs: list[str], matched_terms: list[str]) -> list[dict[str, Any]]:
    matched_set = set(matched_terms)
    selected: list[dict[str, Any]] = []
    for set_id, terms in family_plan.get("synonymSets", {}).items():
        set_matches = [term for term in terms if term in matched_set]
        if not set_matches:
            normalized_terms = [normalize_planner_term(term) for term in terms]
            set_matches = [
                term
                for term, normalized_term in zip(terms, normalized_terms)
                if any(normalized_term and normalized_term in normalize_planner_term(input_value) for input_value in inputs)
            ]
        if not set_matches:
            continue
        selected.append({"id": set_id, "matchedTerms": unique_strings(set_matches), "terms": terms})
    return selected


def choose_run_mode(family_plan: dict[str, Any], inputs: list[str], explicit_target: bool) -> str:
    if explicit_target:
        return "trace"
    normalized_inputs = [normalize_planner_term(value) for value in inputs if normalize_planner_term(value)]
    direct_terms = [normalize_planner_term(term) for term in family_plan.get("directTraceTerms", [])]
    compare_terms = [normalize_planner_term(term) for term in family_plan.get("compareTerms", [])]
    if any(term and term in normalized_inputs for term in direct_terms):
        return "trace"
    if any(term and term in normalized_inputs for term in compare_terms):
        return "compare"
    return str(family_plan["defaultRunMode"])


def expand_anchor_terms(target: dict[str, Any], family_plan: dict[str, Any], queries: list[str], anchors: list[str], synonym_sets_used: list[dict[str, Any]]) -> list[str]:
    values = list(target["defaultAnchors"]) + queries + anchors + list(family_plan.get("anchorExpansionTerms", []))
    for synonym_set in synonym_sets_used:
        values.extend(synonym_set["terms"])
    return unique_strings(values)


def build_planner_decision_note(
    selection_mode: str,
    family_plan: dict[str, Any],
    resolution: dict[str, Any],
    target: dict[str, Any],
) -> str:
    family_label = family_plan["label"]
    selected_target_id = resolution["selectedTargetId"]
    if selection_mode == "explicit-target":
        return (
            f"Used explicit target {selected_target_id} in the {family_label} family and kept family-aware anchor expansion "
            f"so the backend records the same checked synonym surface deterministically."
        )
    matched_inputs = ", ".join(resolution["matchedInputs"]) if resolution["matchedInputs"] else family_label
    synonym_labels = ", ".join(item["id"] for item in resolution["synonymSetsUsed"]) or "family defaults"
    if resolution["runMode"] == "compare":
        return (
            f"Matched {matched_inputs} to {family_label} through {synonym_labels} and chose the bounded "
            f"{target['comparisonPresetId']} compare run because this query is better grounded as one checked solved-vs-blocked family trace."
        )
    return (
        f"Matched {matched_inputs} to {family_label} through {synonym_labels} and chose the single "
        f"{selected_target_id} trace because the query already points at one checked family target."
    )


def resolve_planner_selection(
    registry: dict[str, Any],
    explicit_target_id: str | None,
    queries: list[str],
    anchors: list[str],
) -> dict[str, Any]:
    requested_queries = unique_strings(queries)
    requested_anchors = unique_strings(anchors)
    if explicit_target_id:
        target = registry["targets"][explicit_target_id]
        family_id = target["familyId"]
        family_plan = registry["planner"]["families"][family_id]
        combined_inputs = unique_strings([*requested_queries, *requested_anchors])
        synonym_sets_used = pick_synonym_sets(family_plan, combined_inputs, combined_inputs)
        expanded_anchors = expand_anchor_terms(target, family_plan, requested_queries, requested_anchors, synonym_sets_used)
        resolution = {
            "selectionMode": "explicit-target",
            "requestedQueries": requested_queries,
            "requestedAnchors": requested_anchors,
            "matchedInputs": combined_inputs,
            "matchedTerms": combined_inputs,
            "matchedFamilyId": family_id,
            "matchedFamilyLabel": family_plan["label"],
            "selectedTargetId": explicit_target_id,
            "selectedRunMode": choose_run_mode(family_plan, combined_inputs, explicit_target=True),
            "selectedComparePresetId": None,
            "synonymSetsUsed": synonym_sets_used,
            "expandedAnchors": expanded_anchors,
        }
        resolution["decisionNote"] = build_planner_decision_note("explicit-target", family_plan, {
            "selectedTargetId": resolution["selectedTargetId"],
            "matchedInputs": resolution["matchedInputs"],
            "synonymSetsUsed": resolution["synonymSetsUsed"],
            "runMode": resolution["selectedRunMode"],
        }, target)
        return resolution

    combined_inputs = unique_strings([*requested_queries, *requested_anchors])
    if not combined_inputs:
        raise ValueError("Pass --target or at least one --query/--anchor to resolve a unity trace.")
    best_family = choose_best_family(registry, combined_inputs)
    family_id = best_family["familyId"]
    family_plan = registry["planner"]["families"][family_id]
    target_id = family_plan["defaultTargetId"]
    target = registry["targets"][target_id]
    synonym_sets_used = pick_synonym_sets(family_plan, combined_inputs, best_family["matchedTerms"])
    run_mode = choose_run_mode(family_plan, combined_inputs, explicit_target=False)
    expanded_anchors = expand_anchor_terms(target, family_plan, requested_queries, requested_anchors, synonym_sets_used)
    resolution = {
        "selectionMode": "query-planner",
        "requestedQueries": requested_queries,
        "requestedAnchors": requested_anchors,
        "matchedInputs": best_family["matchedInputs"],
        "matchedTerms": best_family["matchedTerms"],
        "matchedFamilyId": family_id,
        "matchedFamilyLabel": family_plan["label"],
        "selectedTargetId": target_id,
        "selectedRunMode": run_mode,
        "selectedComparePresetId": target["comparisonPresetId"] if run_mode == "compare" else None,
        "synonymSetsUsed": synonym_sets_used,
        "expandedAnchors": expanded_anchors,
    }
    resolution["decisionNote"] = build_planner_decision_note("query-planner", family_plan, {
        "selectedTargetId": resolution["selectedTargetId"],
        "matchedInputs": resolution["matchedInputs"],
        "synonymSetsUsed": resolution["synonymSetsUsed"],
        "runMode": resolution["selectedRunMode"],
    }, target)
    return resolution


def resolve_source_catalog(registry: dict[str, Any], family_ids: list[str]) -> tuple[dict[str, Path], list[dict[str, Any]]]:
    source_paths: dict[str, Path] = {}
    source_roles: list[dict[str, Any]] = []
    seen: set[str] = set()
    for family_id in family_ids:
        family = registry["sourceFamilies"][family_id]
        for source_id in family["sourceIds"]:
            if source_id in seen:
                continue
            seen.add(source_id)
            source_paths[source_id] = ALL_SOURCE_PATHS[source_id]
            source_roles.append(
                {
                    "sourceId": source_id,
                    "path": repo_relative(ALL_SOURCE_PATHS[source_id]),
                    "familyId": family_id,
                    "familyLabel": family["label"],
                    "role": SOURCE_ROLE_TEXT[source_id],
                }
            )
    return source_paths, source_roles


def extract_strings(blob: bytes) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for match in ASCII_RE.finditer(blob):
        entries.append({"offset": match.start(), "encoding": "ascii", "value": match.group().decode("ascii", errors="ignore")})
    for match in UTF16_RE.finditer(blob):
        entries.append({"offset": match.start(), "encoding": "utf16le", "value": match.group().decode("utf-16le", errors="ignore")})
    return sorted(entries, key=lambda entry: int(entry["offset"]))


def collect_metadata_hits(anchor_specs: list[dict[str, Any]], context: int = 8) -> tuple[list[dict[str, Any]], int]:
    entries = extract_strings(METADATA_PATH.read_bytes())
    hits: list[dict[str, Any]] = []
    executable_specs = [spec for spec in anchor_specs if spec["kind"] != "path id"]
    counts: dict[str, int] = {spec["value"]: 0 for spec in executable_specs}
    suppressed_count = 0
    for index, entry in enumerate(entries):
        value = str(entry["value"])
        matched_specs: list[dict[str, Any]] = []
        match_modes: list[str] = []
        for spec in executable_specs:
            anchor = spec["value"]
            if value == anchor:
                matched_specs.append(spec)
                match_modes.append("exact-string")
                continue
            if anchor.lower() in value.lower():
                matched_specs.append(spec)
                match_modes.append("bounded-containment")
        if not matched_specs:
            continue
        matched_anchor_values = [spec["value"] for spec in matched_specs]
        if all(counts[anchor] >= 4 for anchor in matched_anchor_values):
            continue
        noise_flags = is_obvious_noise(value)
        score = max(90 if mode == "exact-string" else 45 for mode in match_modes)
        if noise_flags:
            score -= 40
        if score < 20:
            suppressed_count += 1
            continue
        start = max(index - context, 0)
        end = min(index + context + 1, len(entries))
        hits.append(
            {
                "term": value,
                "matchedTerms": matched_anchor_values,
                "matchedAnchorKinds": unique_strings([spec["kind"] for spec in matched_specs]),
                "matchMode": "exact-string" if "exact-string" in match_modes else "bounded-containment",
                "offset": entry["offset"],
                "context": entries[start:end],
                "signalScore": score,
                "signalTier": get_signal_tier(score),
                "noiseFlags": noise_flags,
                "signalReason": format_signal_reason(
                    "exact-string" if "exact-string" in match_modes else "bounded-containment",
                    "metadata",
                    matched_anchor_values,
                    noise_flags,
                ),
            }
        )
        for matched_term in matched_anchor_values:
            counts[matched_term] += 1
        if all(count >= 4 for count in counts.values()):
            break
    hits.sort(key=lambda item: (-int(item["signalScore"]), int(item["offset"])))
    return hits, suppressed_count


def path_to_string(path_parts: list[str | int]) -> str:
    output = "$"
    for part in path_parts:
        output += f"[{part}]" if isinstance(part, int) else f".{part}"
    return output


def is_scalar(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool)) or value is None


def summarize_parent(parent: Any, key_or_index: str | int) -> dict[str, Any]:
    if isinstance(parent, dict):
        scalars = []
        for sibling_key, sibling_value in parent.items():
            if len(scalars) >= 8:
                break
            if is_scalar(sibling_value):
                scalars.append({"key": sibling_key, "value": sibling_value})
        return {"containerType": "object", "matchedKey": key_or_index, "scalarEntries": scalars}
    if isinstance(parent, list) and isinstance(key_or_index, int):
        window = []
        for index in range(max(0, key_or_index - 3), min(len(parent), key_or_index + 4)):
            value = parent[index]
            if is_scalar(value):
                window.append({"index": index, "value": value})
        return {"containerType": "array", "matchedIndex": key_or_index, "nearbyScalarValues": window}
    return {"containerType": type(parent).__name__}


def walk_json(value: Any, path_parts: list[str | int], parent: Any, key_or_index: str | int | None, exact_terms: set[str], hits: list[dict[str, Any]]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            walk_json(child, [*path_parts, key], value, key, exact_terms, hits)
        return
    if isinstance(value, list):
        for index, child in enumerate(value):
            walk_json(child, [*path_parts, index], value, index, exact_terms, hits)
        return
    if not isinstance(value, str) and not isinstance(value, int):
        return
    if str(value) not in exact_terms:
        return
    hits.append(
        {
            "term": str(value),
            "jsonPath": path_to_string(path_parts),
            "containerSummary": summarize_parent(parent, key_or_index) if parent is not None else None,
        }
    )


def collect_exact_hits(document: Any, anchor_specs: list[dict[str, Any]], source_id: str, shell_window: dict[str, Any] | None, max_hits_per_term: int = 4) -> tuple[list[dict[str, Any]], int]:
    hits: list[dict[str, Any]] = []
    exact_terms = [spec["value"] for spec in anchor_specs]
    walk_json(document, [], None, None, set(exact_terms), hits)
    spec_by_value = {spec["value"]: spec for spec in anchor_specs}
    counts: dict[str, int] = {}
    filtered: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    suppressed_count = 0
    for hit in hits:
        identity = (hit["term"], hit["jsonPath"])
        if identity in seen:
            continue
        seen.add(identity)
        counts.setdefault(hit["term"], 0)
        if counts[hit["term"]] >= max_hits_per_term:
            continue
        spec = spec_by_value[hit["term"]]
        container_text = json.dumps(hit.get("containerSummary") or {}, sort_keys=True)
        shell_field = str(shell_window["shellField"]) if shell_window else None
        shell_path = str(shell_window["shellPathId"]) if shell_window else None
        owner_fields = set(shell_window["ownerFieldBlock"]) if shell_window else set()
        local_signal: str | None = None
        score = 85
        if spec["kind"] == "path id":
            score += 15
        if source_id == "tokenShopExtract":
            score += 25
        elif source_id in {"dailyTokeniumLaneProbe", "uabeaProbe"}:
            score += 15
        else:
            score += 10
        if shell_field and hit["term"] == shell_field:
            score += 25
            local_signal = "shell-local exact anchor"
        elif shell_path and hit["term"] == shell_path:
            score += 30
            local_signal = "shell-local path id"
        elif hit["term"] in owner_fields:
            score += 25
            local_signal = "owner-local exact field"
        elif shell_field and shell_field in container_text:
            score += 10
            local_signal = "container keeps shell anchor nearby"
        elif owner_fields and any(field in container_text for field in owner_fields):
            score += 10
            local_signal = "container keeps owner-local fields nearby"
        noise_flags = is_obvious_noise(hit["term"])
        if noise_flags:
            score -= 40
        if score < 20:
            suppressed_count += 1
            continue
        hit["matchedTerms"] = [spec["value"]]
        hit["matchedAnchorKinds"] = [spec["kind"]]
        hit["matchMode"] = "exact-structured"
        hit["signalScore"] = score
        hit["signalTier"] = get_signal_tier(score)
        hit["noiseFlags"] = noise_flags
        hit["signalReason"] = format_signal_reason("exact-structured", source_id, [spec["value"]], noise_flags, local_signal)
        counts[hit["term"]] += 1
        filtered.append(hit)
    filtered.sort(key=lambda item: (-int(item["signalScore"]), item["jsonPath"]))
    return filtered, suppressed_count


def get_shell_window(token_shop_extract: dict[str, Any], shell_field: str, radius: int) -> dict[str, Any]:
    fields = list(token_shop_extract.get("fields", []))
    shell_index = next(index for index, field in enumerate(fields) if field.get("field") == shell_field)
    shell_entry = fields[shell_index]
    window = []
    for field in fields[max(0, shell_index - radius): min(len(fields), shell_index + radius + 1)]:
        compact = {"field": field.get("field"), "group": field.get("group"), "kind": field.get("kind")}
        if "object_offset" in field:
            compact["objectOffset"] = field.get("object_offset")
        if "path_id" in field:
            compact["pathId"] = field.get("path_id")
        if "value" in field and is_scalar(field.get("value")):
            compact["value"] = field.get("value")
        window.append(compact)
    return {
        "source": repo_relative(ALL_SOURCE_PATHS["tokenShopExtract"]),
        "shellField": shell_entry.get("field"),
        "shellPathId": shell_entry.get("path_id"),
        "shellObjectOffset": shell_entry.get("object_offset"),
        "ownerFieldBlock": [entry.get("field") for entry in fields[max(0, shell_index - 5):shell_index]],
        "window": window,
    }


def collect_source_hits(documents: dict[str, Any], source_id: str, anchor_specs: list[dict[str, Any]], shell_window: dict[str, Any] | None = None) -> dict[str, Any]:
    if source_id == "metadata":
        hits, suppressed_count = collect_metadata_hits(anchor_specs)
        return {
            "sourceId": source_id,
            "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
            "searchModes": get_source_search_modes(source_id),
            "hitCount": len(hits),
            "highSignalHitCount": sum(1 for hit in hits if hit["signalTier"] == "high-signal"),
            "supportingHitCount": sum(1 for hit in hits if hit["signalTier"] == "supporting"),
            "incidentalHitCount": sum(1 for hit in hits if hit["signalTier"] == "incidental"),
            "suppressedNoiseCount": suppressed_count,
            "hits": hits,
        }
    if source_id in ("level0", "sharedassets0", "globalgamemanagers"):
        hits, suppressed_count = collect_unity_hits(source_id, anchor_specs)
        return {
            "sourceId": source_id,
            "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
            "searchModes": ["object-name", "class-name", "component-type", "text-content"],
            "hitCount": len(hits),
            "highSignalHitCount": sum(1 for hit in hits if hit.get("signalTier") == "high-signal"),
            "supportingHitCount": sum(1 for hit in hits if hit.get("signalTier") == "supporting"),
            "incidentalHitCount": sum(1 for hit in hits if hit.get("signalTier") == "incidental"),
            "suppressedNoiseCount": suppressed_count,
            "hits": hits,
        }
    hits, suppressed_count = collect_exact_hits(documents[source_id], anchor_specs, source_id, shell_window)
    return {
        "sourceId": source_id,
        "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
        "searchModes": get_source_search_modes(source_id),
        "hitCount": len(hits),
        "highSignalHitCount": sum(1 for hit in hits if hit["signalTier"] == "high-signal"),
        "supportingHitCount": sum(1 for hit in hits if hit["signalTier"] == "supporting"),
        "incidentalHitCount": sum(1 for hit in hits if hit["signalTier"] == "incidental"),
        "suppressedNoiseCount": suppressed_count,
        "hits": hits,
    }


def collect_unity_hits(source_id: str, anchor_specs: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """Collect hits from Unity files using UnityPy"""
    hits: list[dict[str, Any]] = []
    suppressed_count = 0
    exact_terms = {spec["value"] for spec in anchor_specs}

    env = get_unity_env()

    for obj in env.objects:
        if source_id not in (obj.assets_file.name, "resources"):
            continue

        search_surfaces = []

        if obj.type.name == "MonoBehaviour":
            try:
                data = obj.read()
                script = getattr(data, "m_Script", None)
                if script:
                    try:
                        script_data = script.read()
                        class_name = getattr(script_data, "m_Name", "")
                        search_surfaces.append(("class-name", class_name, 90))
                    except Exception:
                        pass
                obj_name = getattr(data, "m_Name", "") or ""
                if obj_name:
                    search_surfaces.append(("object-name", obj_name, 80))
            except Exception:
                pass
        elif obj.type.name == "GameObject":
            try:
                data = obj.read()
                name = getattr(data, "m_Name", "") or ""
                if name:
                    search_surfaces.append(("object-name", name, 85))
            except Exception:
                pass
        elif obj.type.name in ("Text", "TextMeshProUGUI", "TextMeshPro"):
            try:
                data = obj.read()
                text_field = "m_text" if obj.type.name in ("TextMeshProUGUI", "TextMeshPro") else "m_Text"
                text_content = getattr(data, text_field, "") or ""
                if text_content:
                    search_surfaces.append(("text-content", text_content, 70))
            except Exception:
                pass

        for surface_type, surface_value, base_score in search_surfaces:
            str_value = str(surface_value)
            for term in exact_terms:
                matched = False
                match_mode = ""
                if str_value == term:
                    matched = True
                    match_mode = "exact-string"
                elif term.lower() in str_value.lower():
                    matched = True
                    match_mode = "bounded-containment"

                if matched:
                    signal_tier = "high-signal" if match_mode == "exact-string" else "supporting"
                    hits.append({
                        "term": term,
                        "matchedValue": str_value[:200],
                        "surfaceType": surface_type,
                        "pathId": obj.path_id,
                        "objectType": obj.type.name,
                        "signalTier": signal_tier,
                        "matchMode": match_mode,
                        "score": base_score if match_mode == "exact-string" else base_score // 2,
                    })
                    break

    return hits, suppressed_count


def find_surface(surfaces: list[dict[str, Any]], surface_id: str) -> dict[str, Any]:
    return next(surface for surface in surfaces if surface["id"] == surface_id)


def find_source_entry(surface: dict[str, Any], source_id: str) -> dict[str, Any]:
    return next(source for source in surface["sources"] if source["sourceId"] == source_id)


def find_hit(source_entry: dict[str, Any], term: str) -> dict[str, Any]:
    return next(
        hit
        for hit in source_entry["hits"]
        if hit["term"] == term or term in hit.get("matchedTerms", [])
    )


def cite_hit(source_entry: dict[str, Any], hit: dict[str, Any], note: str | None = None) -> dict[str, Any]:
    locator = f"metadata offset {hit['offset']}" if source_entry["sourceId"] == "metadata" else hit["jsonPath"]
    citation = {
        "sourceId": source_entry["sourceId"],
        "sourcePath": source_entry["sourcePath"],
        "term": hit["term"],
        "locator": locator,
    }
    if note:
        citation["note"] = note
    return citation


def cite_row_boundary(source_id: str, path: str, detail: str, note: str | None = None) -> dict[str, Any]:
    citation = {
        "sourceId": source_id,
        "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
        "term": detail,
        "locator": path,
    }
    if note:
        citation["note"] = note
    return citation


def make_node(node_id: str, node_type: str, label: str, status: str, summary: str) -> dict[str, Any]:
    return {
        "id": node_id,
        "type": node_type,
        "label": label,
        "status": status,
        "summary": summary,
    }


def make_edge(
    edge_id: str,
    from_node: str,
    to_node: str,
    edge_type: str,
    status: str,
    provenance_strength: str,
    statement: str,
    proved_by: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "id": edge_id,
        "from": from_node,
        "to": to_node,
        "type": edge_type,
        "status": status,
        "provenanceStrength": provenance_strength,
        "statement": statement,
        "provedBy": proved_by,
    }


def build_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    diamond_surface = find_surface(surfaces, "diamond-special")
    token_surface = find_surface(surfaces, "token-lane")
    text_surface = find_surface(surfaces, "text-hooks")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "dailyTokeniumLaneProbe")
    unity_diamond_source = find_source_entry(diamond_surface, "unityProbe")
    unity_token_source = find_source_entry(token_surface, "unityProbe")
    uabea_token_source = find_source_entry(token_surface, "uabeaProbe")
    unity_text_source = find_source_entry(text_surface, "unityProbe")
    lm244_source = find_source_entry(diamond_surface, "lm244TargetedProbe")

    metadata_atu3_hit = find_hit(metadata_source, "ATU3Button")
    metadata_cell_hit = find_hit(metadata_source, "CellBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyCellBoost")
    diamond_prefab_hit = find_hit(unity_diamond_source, "NewDiamondUPGPrefab.Specials.CellsBoost")
    diamond_title_hit = find_hit(unity_diamond_source, ">Diamond Upgrade 10 - CellsBoost")
    token_prefab_hit = find_hit(uabea_token_source, "NewTokenUPGPrefab.T1.CellsPerChestBooster")
    token_prefab_alt_hit = find_hit(unity_token_source, "NewTokenUPGPrefab.T5.UltimaCells")
    token_title_hit = find_hit(unity_token_source, "Token Ultima: Cells")
    text_hook_hit = find_hit(unity_text_source, "SetAllTokenShopTexts")
    text_hook_alt_hit = find_hit(unity_text_source, "SetTokenTexts")

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "generic-action-hook"
    diamond_prefab_node = "diamond-special-prefab"
    diamond_title_node = "diamond-special-title"
    token_prefab_node = "token-prefab-candidates"
    token_title_node = "token-title-candidate"
    text_hook_node = "generic-text-hooks"

    nodes = [
        make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
        make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
        make_node(metadata_node, "metadata-neighborhood", "ATU3Button + CellBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and cells-family declaration area together."),
        make_node(action_node, "action-hook-cluster", "BuyCellBoost generic cells-domain action cluster", "present", "The committed lane probe keeps the generic buy hook but not an ATU3-specific exact join."),
        make_node(diamond_prefab_node, "prefab-candidate", "NewDiamondUPGPrefab.Specials.CellsBoost", "present", "A detached diamond-special prefab candidate is preserved."),
        make_node(diamond_title_node, "title-candidate", ">Diamond Upgrade 10 - CellsBoost", "present", "A detached diamond-special title candidate is preserved."),
        make_node(token_prefab_node, "prefab-candidate", "NewTokenUPGPrefab.T1.CellsPerChestBooster and NewTokenUPGPrefab.T5.UltimaCells", "present", "Detached token-side prefab candidates are preserved."),
        make_node(token_title_node, "title-candidate", "Token Ultima: Cells", "present", "A detached token-side title candidate is preserved."),
        make_node(text_hook_node, "text-hook-cluster", "SetAllTokenShopTexts / SetTokenTexts", "present", "The generic TokenShop text side is preserved as a separate surface."),
    ]

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract.",
            [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        ),
        make_edge(
            "owner-block-to-metadata",
            owner_node,
            metadata_node,
            "declaration-neighborhood",
            "present",
            "contextual",
            "The metadata neighborhood keeps ATU3Button and the CellBoost declaration block in one raw declaration area.",
            [
                cite_hit(metadata_source, metadata_cell_hit),
                cite_hit(metadata_source, metadata_atu3_hit),
            ],
        ),
        make_edge(
            "owner-block-to-action-cluster",
            owner_node,
            action_node,
            "family-action-cluster",
            "present",
            "supporting",
            "The cells-domain action lane preserves BuyCellBoost as the nearest named buy hook for the same family, but only as a generic cluster.",
            [cite_hit(action_source, action_buy_hit)],
        ),
        make_edge(
            "diamond-surface-prefab",
            metadata_node,
            diamond_prefab_node,
            "candidate-prefab-surface",
            "present",
            "direct",
            "A separate diamond-special CellsBoost prefab candidate is preserved on committed probe surfaces.",
            [
                cite_hit(unity_diamond_source, diamond_prefab_hit),
                cite_hit(lm244_source, find_hit(lm244_source, "NewDiamondUPGPrefab.Specials.CellsBoost")),
            ],
        ),
        make_edge(
            "diamond-surface-title",
            diamond_prefab_node,
            diamond_title_node,
            "candidate-title-surface",
            "present",
            "direct",
            "The same detached diamond-special surface also preserves one final title candidate.",
            [cite_hit(unity_diamond_source, diamond_title_hit)],
        ),
        make_edge(
            "token-surface-prefab",
            action_node,
            token_prefab_node,
            "candidate-prefab-surface",
            "present",
            "direct",
            "Separate token-side prefab identities for cells-domain upgrades are preserved, but not joined back to the target shell.",
            [
                cite_hit(uabea_token_source, token_prefab_hit),
                cite_hit(unity_token_source, token_prefab_alt_hit),
            ],
        ),
        make_edge(
            "token-surface-title",
            token_prefab_node,
            token_title_node,
            "candidate-title-surface",
            "present",
            "direct",
            "The token-side candidate surface also preserves one detached title clue.",
            [cite_hit(unity_token_source, token_title_hit)],
        ),
        make_edge(
            "text-hook-surface",
            action_node,
            text_hook_node,
            "generic-text-hook-cluster",
            "present",
            "supporting",
            "The generic TokenShop text hooks are preserved as a separate surface, but they do not close the ATU3 join.",
            [
                cite_hit(unity_text_source, text_hook_hit),
                cite_hit(unity_text_source, text_hook_alt_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-shell-to-exact-action",
            shell_node,
            action_node,
            "exact-shell-to-action-hook",
            "missing",
            "negative",
            "No committed source proves one ATU3-specific direct buy or effect hook; the nearest named action surface stays the generic BuyCellBoost cluster.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    "No checked repo artifact in this lane currently preserves an ATU3-specific effect hook.",
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    "No checked repo artifact in this lane currently preserves an ATU3-specific direct buy hook.",
                ),
            ],
        ),
        make_edge(
            "missing-shell-to-diamond-prefab",
            shell_node,
            diamond_prefab_node,
            "exact-shell-to-prefab",
            "missing",
            "negative",
            "No committed source proves that the ATU3 shell or path id 15810 crosses directly into the detached diamond-special CellsBoost prefab candidate.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.testedSurfaces[1].missingJoin",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["testedSurfaces"][1]["missingJoin"],
                )
            ],
        ),
        make_edge(
            "missing-shell-to-token-prefab",
            shell_node,
            token_prefab_node,
            "exact-shell-to-prefab",
            "missing",
            "negative",
            "No committed source proves that the ATU3 shell or path id 15810 crosses directly into one exact token-side prefab identity.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]["missingLinks"][2],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.testedSurfaces[2].missingJoin",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["testedSurfaces"][2]["missingJoin"],
                ),
            ],
        ),
        make_edge(
            "missing-shell-to-title",
            shell_node,
            token_title_node,
            "exact-shell-to-title",
            "missing",
            "negative",
            "No committed source proves one exact ATU3 shell-to-final-title join across either the diamond-special or token-side title candidates.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        ),
    ]

    claim_ledger = [
        {
            "id": "claim-shell-window",
            "status": "proved",
            "statement": "The exact ATU3 shell window exists in committed TokenShop data.",
            "edgeIds": ["shell-to-owner-block"],
            "provedBy": edges[0]["provedBy"],
        },
        {
            "id": "claim-metadata-neighborhood",
            "status": "proved",
            "statement": "The metadata neighborhood keeps ATU3Button in the same declaration area as the CellBoost family.",
            "edgeIds": ["owner-block-to-metadata"],
            "provedBy": edges[1]["provedBy"],
        },
        {
            "id": "claim-cells-action-cluster",
            "status": "proved",
            "statement": "The generic cells-domain action cluster preserves BuyCellBoost, but not as an exact ATU3-specific join.",
            "edgeIds": ["owner-block-to-action-cluster"],
            "provedBy": edges[2]["provedBy"],
        },
        {
            "id": "claim-detached-candidate-surfaces",
            "status": "proved",
            "statement": "Detached prefab, title, and text-hook candidate surfaces still exist on committed probes.",
            "edgeIds": ["diamond-surface-prefab", "diamond-surface-title", "token-surface-prefab", "token-surface-title", "text-hook-surface"],
            "provedBy": [citation for edge in edges[3:] for citation in edge["provedBy"]],
        },
        {
            "id": "claim-missing-bridge",
            "status": "missing",
            "statement": "The exact shell-to-action, shell-to-prefab, and shell-to-title joins required to clear the ATU3 bridge are still missing.",
            "edgeIds": [edge["id"] for edge in negative_edges],
            "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
        },
    ]

    return {
        "nodes": nodes,
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": claim_ledger,
    }


def build_mod_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-lane")
    title_surface = find_surface(surfaces, "title-lane")
    text_surface = find_surface(surfaces, "text-hooks")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "dailyTokeniumLaneProbe")
    uabea_prefab_source = find_source_entry(prefab_surface, "uabeaProbe")
    unity_title_source = find_source_entry(title_surface, "unityProbe")
    unity_text_source = find_source_entry(text_surface, "unityProbe")

    metadata_shell_hit = find_hit(metadata_source, "ATU4Button")
    metadata_owner_hit = find_hit(metadata_source, "ModBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyModBoost")
    prefab_hit = find_hit(uabea_prefab_source, "NewTokenUPGPrefab.T1.ModPointsBooster")
    title_hit = find_hit(unity_title_source, "Token Ultima: MP")
    diamond_title_hit = find_hit(unity_title_source, ":Diamond Upgrade 11 - ModBoost")
    text_hook_hit = find_hit(unity_text_source, "SetAllTokenShopTexts")

    trace_bridge = row_remap_boundary["traceFollowUp"]["recoveredBridge"]
    unresolved_title = row_remap_boundary["traceFollowUp"]["blockedTitleJoin"]

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "action-hook"
    prefab_node = "prefab-identity"
    title_node = "title-candidate"
    text_node = "text-hook-cluster"

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the ModBoost owner-field block in the committed TokenShop extract.",
            [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        ),
        make_edge(
            "owner-block-to-metadata",
            owner_node,
            metadata_node,
            "declaration-neighborhood",
            "present",
            "contextual",
            "The metadata neighborhood keeps ATU4Button and the ModBoost declaration block in one raw declaration area.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
            ],
        ),
        make_edge(
            "shell-to-action-hook",
            shell_node,
            action_node,
            "exact-shell-to-action-hook",
            "present",
            "supporting",
            "The checked action lane preserves the matching direct buy hook BuyModBoost for the same ModBoost row family.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.traceFollowUp.recoveredBridge.supportingActionHook",
                    trace_bridge["supportingActionHook"],
                ),
                cite_hit(action_source, action_buy_hit),
            ],
        ),
        make_edge(
            "action-hook-to-prefab",
            action_node,
            prefab_node,
            "exact-shell-to-prefab",
            "present",
            "direct",
            "The checked prefab roster preserves the exact ModPointsBooster identity on the same traced row family.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.traceFollowUp.recoveredBridge.prefabIdentity",
                    trace_bridge["prefabIdentity"],
                ),
                cite_hit(uabea_prefab_source, prefab_hit),
            ],
        ),
        make_edge(
            "prefab-to-title-candidate",
            prefab_node,
            title_node,
            "title-candidate-surface",
            "present",
            "supporting",
            "A separate mod-domain title candidate is still preserved, but only as a detached title surface.",
            [
                cite_hit(unity_title_source, title_hit),
                cite_hit(unity_title_source, diamond_title_hit),
            ],
        ),
        make_edge(
            "prefab-to-text-hook-cluster",
            prefab_node,
            text_node,
            "generic-text-hook-cluster",
            "present",
            "supporting",
            "The generic TokenShop text hooks survive as a separate title-side surface, but they do not close the ATU4 title join.",
            [
                cite_hit(unity_text_source, text_hook_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-shell-to-title",
            shell_node,
            title_node,
            "exact-shell-to-title",
            "missing",
            "negative",
            "No committed source proves one exact ATU4 shell-to-final-title join; the surviving generic text hooks plus the Token Ultima: MP and :Diamond Upgrade 11 - ModBoost title candidates remain detached from the shell-side row neighborhood.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.traceFollowUp.blockedTitleJoin.missingJoin",
                    unresolved_title["missingJoin"],
                ),
                cite_hit(unity_title_source, title_hit),
                cite_hit(unity_title_source, diamond_title_hit),
                cite_hit(unity_text_source, text_hook_hit),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(metadata_node, "metadata-neighborhood", "ATU4Button + ModBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and ModBoost declaration area together."),
            make_node(action_node, "action-hook", "BuyModBoost", "present", "The committed probe set preserves the matching ModBoost buy hook."),
            make_node(prefab_node, "prefab-identity", "NewTokenUPGPrefab.T1.ModPointsBooster", "present", "The exact token prefab identity is preserved."),
            make_node(title_node, "title-candidate", "Token Ultima: MP", "present", "A detached mod-domain title candidate is preserved."),
            make_node(text_node, "text-hook-cluster", "SetAllTokenShopTexts / SetTokenTexts", "present", "The generic TokenShop text hooks survive as a separate title-side surface."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-trace-recovered-bridge",
                "status": "proved",
                "statement": "The ATU4 trace now preserves one exact shell-to-prefab bridge through the ModBoost row family.",
                "edgeIds": ["shell-to-owner-block", "shell-to-action-hook", "action-hook-to-prefab"],
                "provedBy": [citation for edge in edges[:4] for citation in edge["provedBy"]],
            },
            {
                "id": "claim-missing-title-join",
                "status": "missing",
                "statement": "The exact shell-to-final-title join for ATU4 is still missing across the detached title and generic text-hook surfaces.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_mk1_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-lane")
    support_surface = find_surface(surfaces, "support-text-lane")
    roster_surface = find_surface(surfaces, "title-roster-gap")
    text_surface = find_surface(surfaces, "text-hooks")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "dailyTokeniumLaneProbe")
    uabea_prefab_source = find_source_entry(prefab_surface, "uabeaProbe")
    owner_support_source = find_source_entry(support_surface, "dailyTokeniumOwnerProbe")
    owner_roster_source = find_source_entry(roster_surface, "dailyTokeniumOwnerProbe")
    unity_text_source = find_source_entry(text_surface, "unityProbe")

    metadata_shell_hit = find_hit(metadata_source, "ATU5Button")
    metadata_owner_hit = find_hit(metadata_source, "MK1TokenBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyMK1TokenBoost")
    prefab_hit = find_hit(uabea_prefab_source, "NewTokenUPGPrefab.T1.MK1Booster")
    support_hit = find_hit(owner_support_source, "1. MK1 Generator Output,")
    alt_support_hit = find_hit(owner_support_source, "This upgrade divides the cost of MK1 Generators by 1500.")
    roster_hit = find_hit(owner_roster_source, "Mk2 Generator Booster")
    text_hook_hit = find_hit(unity_text_source, "SetAllTokenShopTexts")

    trace_bridge = row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]
    unresolved_title = row_remap_boundary["atu5TitleFollowUp"]["blockedTitleJoin"]

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "action-hook"
    prefab_node = "prefab-identity"
    support_node = "support-text-cluster"
    roster_node = "neighbor-title-roster"
    text_node = "text-hook-cluster"

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the MK1TokenBoost owner-field block in the committed TokenShop extract.",
            [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        ),
        make_edge(
            "owner-block-to-metadata",
            owner_node,
            metadata_node,
            "declaration-neighborhood",
            "present",
            "contextual",
            "The metadata neighborhood keeps ATU5Button and the MK1TokenBoost declaration block in one raw declaration area.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
            ],
        ),
        make_edge(
            "shell-to-action-hook",
            shell_node,
            action_node,
            "exact-shell-to-action-hook",
            "present",
            "supporting",
            "The checked action lane preserves the matching direct buy hook BuyMK1TokenBoost for the same MK1 row family.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.recoveredBridge.supportingActionHook",
                    trace_bridge["supportingActionHook"],
                ),
                cite_hit(action_source, action_buy_hit),
            ],
        ),
        make_edge(
            "action-hook-to-prefab",
            action_node,
            prefab_node,
            "exact-shell-to-prefab",
            "present",
            "direct",
            "The checked prefab roster preserves the exact MK1Booster identity on the same traced row family.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.recoveredBridge.prefabIdentity",
                    trace_bridge["prefabIdentity"],
                ),
                cite_hit(uabea_prefab_source, prefab_hit),
            ],
        ),
        make_edge(
            "prefab-to-support-text",
            prefab_node,
            support_node,
            "title-candidate-surface",
            "present",
            "supporting",
            "Separate MK1 generator support text still survives, but only as a detached title-side surface.",
            [
                cite_hit(owner_support_source, support_hit),
                cite_hit(owner_support_source, alt_support_hit),
            ],
        ),
        make_edge(
            "prefab-to-title-roster",
            prefab_node,
            roster_node,
            "neighbor-title-roster",
            "present",
            "supporting",
            "The owner-side title roster still preserves neighboring generator-booster titles, but not an exact MK1 title join.",
            [
                cite_hit(owner_roster_source, roster_hit),
            ],
        ),
        make_edge(
            "prefab-to-text-hook-cluster",
            prefab_node,
            text_node,
            "generic-text-hook-cluster",
            "present",
            "supporting",
            "The generic TokenShop text hooks survive as a separate title-side surface, but they do not close the ATU5 title join.",
            [
                cite_hit(unity_text_source, text_hook_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-shell-to-title",
            shell_node,
            support_node,
            "exact-shell-to-title",
            "missing",
            "negative",
            "No committed source proves one exact ATU5 shell-to-final-title join; the surviving generic text hooks, detached MK1 generator support text, and neighboring generator-booster title roster all remain detached from the shell-side row neighborhood.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.blockedTitleJoin.missingJoin",
                    unresolved_title["missingJoin"],
                ),
                cite_hit(owner_support_source, support_hit),
                cite_hit(owner_support_source, alt_support_hit),
                cite_hit(owner_roster_source, roster_hit),
                cite_hit(unity_text_source, text_hook_hit),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(metadata_node, "metadata-neighborhood", "ATU5Button + MK1TokenBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and MK1TokenBoost declaration area together."),
            make_node(action_node, "action-hook", "BuyMK1TokenBoost", "present", "The committed probe set preserves the matching MK1 buy hook."),
            make_node(prefab_node, "prefab-identity", "NewTokenUPGPrefab.T1.MK1Booster", "present", "The exact token prefab identity is preserved."),
            make_node(support_node, "title-candidate", "1. MK1 Generator Output,", "present", "A detached MK1 generator support-text candidate is preserved."),
            make_node(roster_node, "neighbor-title-roster", "Mk2 Generator Booster", "present", "Neighboring generator-booster titles remain preserved in the owner-side roster."),
            make_node(text_node, "text-hook-cluster", "SetAllTokenShopTexts / SetTokenTexts", "present", "The generic TokenShop text hooks survive as a separate title-side surface."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-trace-recovered-bridge",
                "status": "proved",
                "statement": "The ATU5 trace now preserves one exact shell-to-prefab bridge through the MK1TokenBoost row family.",
                "edgeIds": ["shell-to-owner-block", "shell-to-action-hook", "action-hook-to-prefab"],
                "provedBy": [citation for edge in edges[:4] for citation in edge["provedBy"]],
            },
            {
                "id": "claim-missing-title-join",
                "status": "missing",
                "statement": "The exact shell-to-final-title join for ATU5 is still missing across the detached support-text, neighboring title-roster, and generic text-hook surfaces.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_mk3_bridge_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    prefab_surface = find_surface(surfaces, "prefab-lane")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "dailyTokeniumLaneProbe")
    uabea_prefab_source = find_source_entry(prefab_surface, "uabeaProbe")
    unity_prefab_source = find_source_entry(prefab_surface, "unityProbe")
    lm244_prefab_source = find_source_entry(prefab_surface, "lm244TargetedProbe")

    metadata_shell_hit = find_hit(metadata_source, "ATU7Button")
    metadata_owner_hit = find_hit(metadata_source, "MK3TokenBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyMK3TokenBoost")
    uabea_prefab_hit = find_hit(uabea_prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")
    unity_prefab_hit = find_hit(unity_prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")
    lm244_prefab_hit = find_hit(lm244_prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")

    trace_bridge = row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    metadata_node = "metadata-neighborhood"
    action_node = "action-hook"
    prefab_node = "prefab-identity"
    corroboration_node = "prefab-corroboration"

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the MK3TokenBoost owner-field block in the committed TokenShop extract.",
            [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        ),
        make_edge(
            "owner-block-to-metadata",
            owner_node,
            metadata_node,
            "declaration-neighborhood",
            "present",
            "contextual",
            "The metadata neighborhood keeps ATU7Button and the MK3TokenBoost declaration block in one raw declaration area.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
            ],
        ),
        make_edge(
            "shell-to-action-hook",
            shell_node,
            action_node,
            "exact-shell-to-action-hook",
            "present",
            "supporting",
            "The checked action lane preserves the matching direct buy hook BuyMK3TokenBoost for the same MK3 row family.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu7BridgeFollowUp.recoveredBridge.supportingActionHook",
                    trace_bridge["supportingActionHook"],
                ),
                cite_hit(action_source, action_buy_hit),
            ],
        ),
        make_edge(
            "action-hook-to-prefab",
            action_node,
            prefab_node,
            "exact-shell-to-prefab",
            "present",
            "direct",
            "The checked prefab roster preserves the exact MK3Booster identity on the same traced row family.",
            [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu7BridgeFollowUp.recoveredBridge.prefabIdentity",
                    trace_bridge["prefabIdentity"],
                ),
                cite_hit(uabea_prefab_source, uabea_prefab_hit),
            ],
        ),
        make_edge(
            "prefab-corroboration",
            prefab_node,
            corroboration_node,
            "multi-probe-prefab-corroboration",
            "present",
            "supporting",
            "Independent unity-probe and LM244-targeted surfaces preserve the same MK3Booster prefab identity, strengthening the bounded shell-to-prefab join without opening title-side inference.",
            [
                cite_hit(unity_prefab_source, unity_prefab_hit),
                cite_hit(lm244_prefab_source, lm244_prefab_hit),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(metadata_node, "metadata-neighborhood", "ATU7Button + MK3TokenBoost metadata neighborhood", "present", "Metadata still keeps the shell anchor and MK3TokenBoost declaration area together."),
            make_node(action_node, "action-hook", "BuyMK3TokenBoost", "present", "The committed probe set preserves the matching MK3 buy hook."),
            make_node(prefab_node, "prefab-identity", "NewTokenUPGPrefab.T1.MK3Booster", "present", "The exact token prefab identity is preserved."),
            make_node(corroboration_node, "prefab-corroboration", "unity-probe + lm244 MK3Booster hits", "present", "Multiple checked prefab surfaces preserve the same MK3Booster identity."),
        ],
        "edges": edges,
        "negativeEdges": [],
        "claimLedger": [
            {
                "id": "claim-trace-recovered-bridge",
                "status": "proved",
                "statement": "The ATU7 trace now preserves one exact shell-to-prefab bridge through the MK3TokenBoost row family.",
                "edgeIds": [edge["id"] for edge in edges],
                "provedBy": [citation for edge in edges for citation in edge["provedBy"]],
            }
        ],
    }


def build_atu3_effect_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    action_surface = find_surface(surfaces, "action-lane")
    title_surface = find_surface(surfaces, "shared-effect-title")
    text_surface = find_surface(surfaces, "shared-effect-text")
    detached_surface = find_surface(surfaces, "detached-identity-surfaces")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    action_source = find_source_entry(action_surface, "dailyTokeniumLaneProbe")
    owner_title_source = find_source_entry(title_surface, "dailyTokeniumOwnerProbe")
    lane_text_source = find_source_entry(text_surface, "dailyTokeniumLaneProbe")
    unity_text_source = find_source_entry(text_surface, "unityProbe")
    lm244_detached_source = find_source_entry(detached_surface, "lm244TargetedProbe")
    unity_detached_source = find_source_entry(detached_surface, "unityProbe")
    uabea_detached_source = find_source_entry(detached_surface, "uabeaProbe")

    metadata_shell_hit = find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = find_hit(metadata_source, "CellBoostStartCost")
    action_buy_hit = find_hit(action_source, "BuyCellBoost")
    title_hit = find_hit(owner_title_source, "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>")
    lane_text_hit = find_hit(lane_text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")
    unity_text_hit = find_hit(unity_text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")
    diamond_prefab_hit = find_hit(unity_detached_source, "NewDiamondUPGPrefab.Specials.CellsBoost")
    diamond_title_hit = find_hit(unity_detached_source, ">Diamond Upgrade 10 - CellsBoost")
    token_prefab_hit = find_hit(uabea_detached_source, "NewTokenUPGPrefab.T1.CellsPerChestBooster")
    token_ultima_hit = find_hit(unity_detached_source, "NewTokenUPGPrefab.T5.UltimaCells")
    token_title_hit = find_hit(unity_detached_source, "Token Ultima: Cells")
    buy_cells_boost_hit = find_hit(lm244_detached_source, "BuyCellsBoost")

    effect_trace = row_remap_boundary["atu3CrossSystemEffectTrace"]["recoveredActionEffectChain"]
    detached_identities = row_remap_boundary["atu3CrossSystemEffectTrace"]["detachedIdentitySurfaces"]
    missing_owner = row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    action_node = "action-hook"
    shared_system_node = "shared-effect-system"
    effect_text_node = "player-effect-text"
    parameter_node = "parameter-surface"
    detached_node = "detached-identity-surfaces"

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract.",
            [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        ),
        make_edge(
            "owner-block-to-action-hook",
            owner_node,
            action_node,
            "exact-shell-to-action-hook",
            "present",
            "supporting",
            "The metadata neighborhood and checked lane probe preserve BuyCellBoost as the exact named action hook for the same CellBoost family.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.supportingActionHook", effect_trace["supportingActionHook"]),
                cite_hit(action_source, action_buy_hit),
            ],
        ),
        make_edge(
            "action-hook-to-shared-effect-system",
            action_node,
            shared_system_node,
            "shared-effect-system",
            "present",
            "direct",
            "The checked cross-system effect surface preserves the shared Cells Booster (Chests) title for the same cells-from-chests gameplay lane.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectTitle", effect_trace["sharedEffectTitle"]),
                cite_hit(owner_title_source, title_hit),
            ],
        ),
        make_edge(
            "shared-effect-system-to-player-effect-text",
            shared_system_node,
            effect_text_node,
            "derived-player-effect-surface",
            "present",
            "direct",
            "The same shared effect lane preserves one exact player-facing effect string for cells gained from Token and Diamond chests.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectText", effect_trace["sharedEffectText"]),
                cite_hit(lane_text_source, lane_text_hit),
                cite_hit(unity_text_source, unity_text_hit),
            ],
        ),
        make_edge(
            "owner-block-to-parameter-surface",
            owner_node,
            parameter_node,
            "parameter-surface",
            "present",
            "direct",
            "The raw CellBoost parameter surface preserves the bonus value and max-level cap that bound the shared chest-effect lane.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.derivedReading", effect_trace["parameterSurface"]["derivedReading"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.field", effect_trace["parameterSurface"]["field"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.supportingField", effect_trace["parameterSurface"]["supportingField"]),
            ],
        ),
        make_edge(
            "action-hook-to-detached-identity-surfaces",
            action_node,
            detached_node,
            "detached-identity-contrast",
            "present",
            "supporting",
            "The older diamond-side and token-side Cells identity surfaces still survive as detached contrast evidence, but they are no longer the main success criterion for this ATU3 pass.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.detachedIdentitySurfaces.groundedConclusion", detached_identities["groundedConclusion"]),
                cite_hit(lm244_detached_source, buy_cells_boost_hit),
                cite_hit(unity_detached_source, diamond_prefab_hit),
                cite_hit(unity_detached_source, diamond_title_hit),
                cite_hit(uabea_detached_source, token_prefab_hit),
                cite_hit(unity_detached_source, token_ultima_hit),
                cite_hit(unity_detached_source, token_title_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-typed-effect-owner",
            shared_system_node,
            effect_text_node,
            "typed-shared-effect-owner",
            "missing",
            "negative",
            "No committed source currently names the exact runtime chest-reward applier or typed gameplay owner that consumes CellBoostBonus inside the shared Token and Diamond chest cells-gain system.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin", missing_owner["missingJoin"]),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(action_node, "action-hook", "BuyCellBoost", "present", "The committed probe set preserves the matching cells buy hook."),
            make_node(shared_system_node, "shared-effect-system", "Cells Booster (Chests)", "present", "A shared cells-from-chests gameplay effect surface is preserved."),
            make_node(effect_text_node, "player-effect-text", "+1 Seconds timeskip to Cells Gained from Token & Diamond Chests", "present", "The player-facing effect text survives on the same shared chest-effect lane."),
            make_node(parameter_node, "parameter-surface", "CellBoostBonus = 1, CellBoostMaxLevel = 60", "present", "The raw CellBoost parameter surface bounds the effect lane without naming the applier."),
            make_node(detached_node, "detached-identity-surfaces", "diamond CellsBoost + token CellsPerChestBooster / Token Ultima: Cells", "present", "Older detached identity surfaces remain preserved as contrast evidence."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-atu3-effect-chain",
                "status": "proved",
                "statement": "ATU3 now preserves one shell-to-action-hook-to-shared-effect chain into the cells-from-chests gameplay lane.",
                "edgeIds": ["shell-to-owner-block", "owner-block-to-action-hook", "action-hook-to-shared-effect-system", "shared-effect-system-to-player-effect-text", "owner-block-to-parameter-surface"],
                "provedBy": [citation for edge in edges[:5] for citation in edge["provedBy"]],
            },
            {
                "id": "claim-detached-identity-surfaces",
                "status": "proved",
                "statement": "The older diamond-side and token-side Cells identity surfaces still survive, but only as detached contrast evidence.",
                "edgeIds": ["action-hook-to-detached-identity-surfaces"],
                "provedBy": list(edges[5]["provedBy"]),
            },
            {
                "id": "claim-missing-typed-owner",
                "status": "missing",
                "statement": "The exact typed gameplay owner or chest-effect applier still is not recovered.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_solved_vs_blocked_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU1Button sits directly after the TokenBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.recoveredAdditionalBridge.ownerFieldBlock",
                    ", ".join(baseline["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "supporting-effect-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one exact ATU1-specific effect hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.recoveredAdditionalBridge.supportingEffectHook",
                    baseline["supportingEffectHook"],
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one checked row-specific buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.recoveredAdditionalBridge.supportingActionHook",
                    baseline["supportingActionHook"],
                )
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.recoveredAdditionalBridge.prefabIdentity",
                    baseline["prefabIdentity"],
                )
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly beside the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-specific effect or buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    blocked["missingLinks"][0],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                ),
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-prefab identity join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    blocked["missingLinks"][2],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        },
    ]
    shared_present = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        }.intersection(
            {
                edge["type"]
                for edge in blocked_edges
                if edge["status"] == "present"
            }
        )
    )
    baseline_only = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        } - set(shared_present)
    )
    blocked_missing = [edge["type"] for edge in blocked_edges if edge["status"] == "missing"]

    return {
        "baseline": {
            "id": "atu1-checked-row-bridge",
            "label": "ATU1 checked row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both rows preserve the direct serialized shell-to-owner-block adjacency.",
                "The solved ATU1 baseline also preserves one exact row-specific effect hook, one checked row-specific buy hook, and one exact prefab identity.",
                "The blocked ATU3 target stays missing the exact shell-to-action-hook, shell-to-prefab, and shell-to-title joins, so the cells-domain clues remain split instead of forming one checked bridge.",
            ],
        },
    }


def build_mod_vs_blocked_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["traceFollowUp"]["recoveredBridge"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU4Button sits directly after the ModBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.traceFollowUp.recoveredBridge.ownerFieldBlock",
                    ", ".join(baseline["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one checked row-specific buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.traceFollowUp.recoveredBridge.supportingActionHook",
                    baseline["supportingActionHook"],
                )
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.traceFollowUp.recoveredBridge.prefabIdentity",
                    baseline["prefabIdentity"],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU4 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.traceFollowUp.blockedTitleJoin.missingJoin",
                    row_remap_boundary["traceFollowUp"]["blockedTitleJoin"]["missingJoin"],
                )
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly beside the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-specific effect or buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    blocked["missingLinks"][0],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                ),
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-prefab identity join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    blocked["missingLinks"][2],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        },
    ]
    shared_present = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        }.intersection(
            {
                edge["type"]
                for edge in blocked_edges
                if edge["status"] == "present"
            }
        )
    )
    baseline_only = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        } - set(shared_present)
    )
    blocked_missing = [edge["type"] for edge in blocked_edges if edge["status"] == "missing"]

    return {
        "baseline": {
            "id": "atu4-trace-row-bridge",
            "label": "ATU4 trace-backed row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both rows preserve the direct serialized shell-to-owner-block adjacency.",
                "The solved ATU4 trace now preserves one checked row-specific buy hook and one exact ModPointsBooster prefab identity.",
                "ATU4 still lacks a final title join, but ATU3 remains narrower and more blocked because its action, prefab, and title clues still do not converge on one exact shell join.",
            ],
        },
    }


def build_mk1_vs_blocked_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU5Button sits directly after the MK1TokenBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.recoveredBridge.ownerFieldBlock",
                    ", ".join(baseline["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one checked row-specific buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.recoveredBridge.supportingActionHook",
                    baseline["supportingActionHook"],
                )
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.recoveredBridge.prefabIdentity",
                    baseline["prefabIdentity"],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU5 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu5TitleFollowUp.blockedTitleJoin.missingJoin",
                    row_remap_boundary["atu5TitleFollowUp"]["blockedTitleJoin"]["missingJoin"],
                )
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly beside the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-specific effect or buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    blocked["missingLinks"][0],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                ),
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-prefab identity join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    blocked["missingLinks"][2],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        },
    ]
    shared_present = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        }.intersection(
            {
                edge["type"]
                for edge in blocked_edges
                if edge["status"] == "present"
            }
        )
    )
    baseline_only = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        } - set(shared_present)
    )
    blocked_missing = [edge["type"] for edge in blocked_edges if edge["status"] == "missing"]

    return {
        "baseline": {
            "id": "atu5-trace-row-bridge",
            "label": "ATU5 trace-backed row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both rows preserve the direct serialized shell-to-owner-block adjacency.",
                "The solved ATU5 trace now preserves one checked row-specific buy hook and one exact MK1Booster prefab identity.",
                "ATU5 still lacks a final title join, but ATU3 remains narrower and more blocked because its action, prefab, and title clues still do not converge on one exact shell join.",
            ],
        },
    }


def build_mk3_vs_blocked_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU7Button sits directly after the MK3TokenBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu7BridgeFollowUp.recoveredBridge.ownerFieldBlock",
                    ", ".join(baseline["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge preserves one checked row-specific buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu7BridgeFollowUp.recoveredBridge.supportingActionHook",
                    baseline["supportingActionHook"],
                )
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The solved bridge preserves one exact prefab identity on the same row family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu7BridgeFollowUp.recoveredBridge.prefabIdentity",
                    baseline["prefabIdentity"],
                )
            ],
        },
        {
            "type": "multi-probe-prefab-corroboration",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The solved bridge is corroborated by multiple checked prefab surfaces.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu7BridgeFollowUp.recoveredBridge.groundedConclusion",
                    baseline["groundedConclusion"],
                )
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly beside the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-specific effect or buy hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[0]",
                    blocked["missingLinks"][0],
                ),
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                ),
            ],
        },
        {
            "type": "exact-shell-to-prefab",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-prefab identity join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]",
                    blocked["missingLinks"][2],
                )
            ],
        },
        {
            "type": "exact-shell-to-title",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "ATU3 still lacks one exact shell-to-final-title join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        },
    ]
    shared_present = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        }.intersection(
            {
                edge["type"]
                for edge in blocked_edges
                if edge["status"] == "present"
            }
        )
    )
    baseline_only = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        } - set(shared_present)
    )
    blocked_missing = [edge["type"] for edge in blocked_edges if edge["status"] == "missing"]

    return {
        "baseline": {
            "id": "atu7-trace-row-bridge",
            "label": "ATU7 trace-backed row bridge",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both rows preserve the direct serialized shell-to-owner-block adjacency.",
                "The solved ATU7 trace now preserves one checked row-specific buy hook, one exact MK3Booster prefab identity, and multi-probe prefab corroboration.",
                "ATU3 remains narrower and more blocked because its action, prefab, and title clues still do not converge on one exact shell join.",
            ],
        },
    }


def build_atu3_effect_vs_split_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["atu3CrossSystemEffectTrace"]["recoveredActionEffectChain"]
    blocked = row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly after the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.ownerFieldBlock",
                    ", ".join(baseline["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The effect-driven trace now preserves one checked row-family action hook.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.supportingActionHook",
                    baseline["supportingActionHook"],
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves one shared cells-from-chests effect system surface.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectTitle",
                    baseline["sharedEffectTitle"],
                )
            ],
        },
        {
            "type": "derived-player-effect-surface",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves one exact player-facing effect string for the shared chest-effect lane.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectText",
                    baseline["sharedEffectText"],
                )
            ],
        },
        {
            "type": "parameter-surface",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The effect-driven trace now preserves a bounded CellBoost parameter surface.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.parameterSurface.derivedReading",
                    baseline["parameterSurface"]["derivedReading"],
                )
            ],
        },
        {
            "type": "typed-shared-effect-owner",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The exact typed gameplay owner for the shared chest-effect applier still remains unresolved.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly beside the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock",
                    ", ".join(blocked["adjacentOwnerFieldBlock"]),
                )
            ],
        },
        {
            "type": "exact-shell-to-action-hook",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace only preserved a generic action cluster, not an effect-chain verdict.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[1]",
                    blocked["missingLinks"][1],
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace did not preserve one checked shared effect-system join.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        },
        {
            "type": "derived-player-effect-surface",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older split trace did not treat the surviving player-facing effect as one checked derived surface.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CellsDisambiguationPass.groundedConclusion",
                    row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"],
                )
            ],
        },
    ]
    shared_present = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        }.intersection(
            {
                edge["type"]
                for edge in blocked_edges
                if edge["status"] == "present"
            }
        )
    )
    baseline_only = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        } - set(shared_present)
    )
    blocked_missing = [edge["type"] for edge in blocked_edges if edge["status"] == "missing"]

    return {
        "baseline": {
            "id": "atu3-effect-driven-chain",
            "label": "ATU3 effect-driven chain",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": "ATU3 prefab/title split",
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both ATU3 traces preserve the direct serialized shell-to-owner-block adjacency.",
                "The new effect-driven trace adds one checked BuyCellBoost-to-shared-cells-effect chain plus a bounded parameter surface.",
                "The older split trace still remains useful as detached identity contrast, but it does not clear the shared chest-effect lane or the derived player-facing effect surface.",
            ],
        },
    }


def build_atu3_chest_consumer_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    title_surface = find_surface(surfaces, "shared-effect-title")
    text_surface = find_surface(surfaces, "shared-effect-text")
    consumer_surface = find_surface(surfaces, "consumer-family")
    routine_surface = find_surface(surfaces, "consumer-routines")
    chest_surface = find_surface(surfaces, "chest-objects")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    title_source = find_source_entry(title_surface, "dailyTokeniumOwnerProbe")
    lane_text_source = find_source_entry(text_surface, "dailyTokeniumLaneProbe")
    unity_text_source = find_source_entry(text_surface, "unityProbe")
    lane_consumer_source = find_source_entry(consumer_surface, "dailyTokeniumLaneProbe")
    lm244_consumer_source = find_source_entry(consumer_surface, "lm244TargetedProbe")
    unity_routine_source = find_source_entry(routine_surface, "unityProbe")
    metadata_routine_source = find_source_entry(routine_surface, "metadata")
    chest_source = find_source_entry(chest_surface, "uabeaProbe")

    metadata_shell_hit = find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = find_hit(metadata_source, "CellBoostStartCost")
    title_hit = find_hit(title_source, "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>")
    lane_text_hit = find_hit(lane_text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")
    unity_text_hit = find_hit(unity_text_source, "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>.")
    ad_manager_hit = find_hit(lane_consumer_source, "AdManager, Assembly-CSharp")
    set_texts_hit = find_hit(lane_consumer_source, "SetAdChestTexts")
    offline_hit = find_hit(lm244_consumer_source, "OfflineManager, Assembly-CSharp")
    checker_hit = find_hit(lm244_consumer_source, "DailyAndAdCounterChecker")
    start_token_hit = find_hit(metadata_routine_source, "StartTokenRoutine")
    token_routine_hit = find_hit(unity_routine_source, "<TokenChestRoutine>d__149")
    closed_token_hit = find_hit(metadata_routine_source, "GoToClosedTokenChest")
    start_diamond_hit = find_hit(metadata_routine_source, "StartDiamondRoutine")
    diamond_routine_hit = find_hit(unity_routine_source, "<DiamondChestRoutine>d__155")
    closed_diamond_hit = find_hit(metadata_routine_source, "GoToClosedDiamondChest")
    small_cells_hit = find_hit(metadata_routine_source, "get_SmallAdCellGains")
    big_cells_hit = find_hit(metadata_routine_source, "get_BigAdCellGains")
    final_token_bonus_hit = find_hit(unity_routine_source, "<FinalAdTokenChestBonus>k__BackingField")
    final_diamond_bonus_hit = find_hit(unity_routine_source, "<FinalDiamondChestBonus>k__BackingField")
    token_chest_hit = find_hit(chest_source, "TokenChest")
    diamond_chest_hit = find_hit(chest_source, "DiamondChest")

    consumer_trace = row_remap_boundary["atu3ChestConsumerTrace"]["recoveredConsumerHandoff"]
    missing_seam = row_remap_boundary["atu3ChestConsumerTrace"]["missingParameterConsumerSeam"]

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    shared_effect_node = "shared-effect-lane"
    consumer_family_node = "consumer-family"
    routine_family_node = "chest-routine-family"
    bonus_shell_node = "consumer-bonus-shell"
    chest_objects_node = "chest-objects"

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract.",
            [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        ),
        make_edge(
            "owner-block-to-shared-effect",
            owner_node,
            shared_effect_node,
            "shared-effect-system",
            "present",
            "direct",
            "The already-grounded ATU3 effect lane preserves the shared Cells Booster (Chests) title and player-facing chest-effect text.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
                cite_hit(title_source, title_hit),
                cite_hit(lane_text_source, lane_text_hit),
                cite_hit(unity_text_source, unity_text_hit),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.sharedEffectTitle", consumer_trace["sharedEffectTitle"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.sharedEffectText", consumer_trace["sharedEffectText"]),
            ],
        ),
        make_edge(
            "shared-effect-to-consumer-family",
            shared_effect_node,
            consumer_family_node,
            "shared-effect-to-consumer-family",
            "present",
            "direct",
            "The ATU3 shared chest-effect lane now hands off into the concrete AdManager chest consumer family.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerSystem", consumer_trace["consumerSystem"]),
                cite_hit(lane_consumer_source, ad_manager_hit),
                cite_hit(lane_consumer_source, set_texts_hit),
                cite_hit(lm244_consumer_source, offline_hit),
                cite_hit(lm244_consumer_source, checker_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-routines",
            consumer_family_node,
            routine_family_node,
            "consumer-family-to-chest-routines",
            "present",
            "direct",
            "The same consumer family preserves the token and diamond chest routine neighborhood.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerMethodFamily", ", ".join(consumer_trace["consumerMethodFamily"])),
                cite_hit(metadata_routine_source, start_token_hit),
                cite_hit(unity_routine_source, token_routine_hit),
                cite_hit(metadata_routine_source, closed_token_hit),
                cite_hit(metadata_routine_source, start_diamond_hit),
                cite_hit(unity_routine_source, diamond_routine_hit),
                cite_hit(metadata_routine_source, closed_diamond_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-bonus-shell",
            consumer_family_node,
            bonus_shell_node,
            "consumer-family-to-bonus-shell",
            "present",
            "direct",
            "The same runtime shell preserves the chest-reward bonus and cell-gain shell adjacent to the ATU3 consumer family.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerBonusShell", ", ".join(consumer_trace["consumerBonusShell"])),
                cite_hit(metadata_routine_source, small_cells_hit),
                cite_hit(metadata_routine_source, big_cells_hit),
                cite_hit(unity_routine_source, final_token_bonus_hit),
                cite_hit(unity_routine_source, final_diamond_bonus_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-chest-objects",
            consumer_family_node,
            chest_objects_node,
            "consumer-family-to-chest-objects",
            "present",
            "supporting",
            "Committed object output preserves the concrete token and diamond chest objects used by the same consumer family.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.supportingChestObjects", ", ".join(consumer_trace["supportingChestObjects"])),
                cite_hit(chest_source, token_chest_hit),
                cite_hit(chest_source, diamond_chest_hit),
            ],
        ),
        make_edge(
            "shared-effect-to-routine-family",
            shared_effect_node,
            routine_family_node,
            "derived-player-effect-surface",
            "present",
            "supporting",
            "The preserved +1 seconds cells-from-chests effect surface now narrows onto the same token and diamond chest routine family rather than floating as detached text.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.groundedConclusion", consumer_trace["groundedConclusion"]),
                cite_hit(title_source, title_hit),
                cite_hit(unity_routine_source, token_routine_hit),
                cite_hit(unity_routine_source, diamond_routine_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "missing-exact-cellboost-consumer-method",
            owner_node,
            bonus_shell_node,
            "exact-cellboost-consumer-method",
            "missing",
            "negative",
            "No committed source yet shows the exact CellBoostBonus read or typed field handoff inside the AdManager chest routine family that applies the ATU3 cells-from-chests timeskip effect.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerTrace.missingParameterConsumerSeam.missingJoin", missing_seam["missingJoin"]),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(shared_effect_node, "shared-effect-system", "Cells Booster (Chests) + +1 seconds cells-from-chests text", "present", "The ATU3 row now preserves one grounded shared chest-effect lane."),
            make_node(consumer_family_node, "consumer-family", "AdManager, Assembly-CSharp + chest support systems", "present", "The concrete chest consumer family is preserved in committed probe artifacts."),
            make_node(routine_family_node, "consumer-routine-family", "TokenChestRoutine + DiamondChestRoutine neighborhood", "present", "The token and diamond chest routine family is preserved."),
            make_node(bonus_shell_node, "consumer-bonus-shell", "get_SmallAdCellGains/get_BigAdCellGains + Final chest bonus fields", "present", "The chest reward bonus shell survives beside the consumer family."),
            make_node(chest_objects_node, "chest-objects", "TokenChest + DiamondChest", "present", "Committed object output preserves the concrete chest game objects."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-atu3-consumer-family",
                "status": "proved",
                "statement": "ATU3 now preserves one shared-effect-to-consumer-family handoff into the concrete AdManager chest reward neighborhood.",
                "edgeIds": [edge["id"] for edge in edges],
                "provedBy": [citation for edge in edges for citation in edge["provedBy"]],
            },
            {
                "id": "claim-missing-exact-cellboost-handoff",
                "status": "missing",
                "statement": "The exact CellBoostBonus read or typed field handoff inside the consumer family still is not recovered.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }

def build_atu3_chest_consumer_read_trace_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
) -> dict[str, Any]:
    metadata_surface = find_surface(surfaces, "metadata-neighborhood")
    consumer_surface = find_surface(surfaces, "consumer-family")
    routine_surface = find_surface(surfaces, "consumer-routines")
    getter_surface = find_surface(surfaces, "cell-gain-getters")
    booster_surface = find_surface(surfaces, "booster-bonus-shell")
    final_surface = find_surface(surfaces, "final-chest-bonus-shell")

    metadata_source = find_source_entry(metadata_surface, "metadata")
    lane_consumer_source = find_source_entry(consumer_surface, "dailyTokeniumLaneProbe")
    lm244_consumer_source = find_source_entry(consumer_surface, "lm244TargetedProbe")
    metadata_routine_source = find_source_entry(routine_surface, "metadata")
    unity_routine_source = find_source_entry(routine_surface, "unityProbe")
    getter_source = find_source_entry(getter_surface, "metadata")
    booster_source = find_source_entry(booster_surface, "metadata")
    final_source = find_source_entry(final_surface, "unityProbe")

    metadata_shell_hit = find_hit(metadata_source, "ATU3Button")
    metadata_owner_hit = find_hit(metadata_source, "CellBoostStartCost")
    ad_manager_hit = find_hit(lane_consumer_source, "AdManager, Assembly-CSharp")
    set_texts_hit = find_hit(lane_consumer_source, "SetAdChestTexts")
    offline_hit = find_hit(lm244_consumer_source, "OfflineManager, Assembly-CSharp")
    checker_hit = find_hit(lm244_consumer_source, "DailyAndAdCounterChecker")
    start_token_hit = find_hit(metadata_routine_source, "StartTokenRoutine")
    token_routine_hit = find_hit(unity_routine_source, "<TokenChestRoutine>d__149")
    start_diamond_hit = find_hit(metadata_routine_source, "StartDiamondRoutine")
    diamond_routine_hit = find_hit(unity_routine_source, "<DiamondChestRoutine>d__155")
    small_getter_hit = find_hit(getter_source, "get_SmallAdCellGains")
    big_getter_hit = find_hit(getter_source, "get_BigAdCellGains")
    set_booster_hit = find_hit(booster_source, "SetBoosterAdBonus")
    final_booster_getter_hit = find_hit(booster_source, "get_FinalBoosterAdBonus")
    small_cells_hit = find_hit(booster_source, "SmallAdCellGains")
    big_cells_hit = find_hit(booster_source, "BigAdCellGains")
    final_booster_hit = find_hit(booster_source, "FinalBoosterAdBonus")
    set_final_booster_hit = find_hit(booster_source, "set_FinalBoosterAdBonus")
    final_booster_field_hit = find_hit(booster_source, "<FinalBoosterAdBonus>k__BackingField")
    booster_routine_hit = find_hit(booster_source, "<BoosterAdRoutine>d__158")
    final_token_bonus_hit = find_hit(final_source, "<FinalAdTokenChestBonus>k__BackingField")
    final_diamond_bonus_hit = find_hit(final_source, "<FinalDiamondChestBonus>k__BackingField")

    read_trace = row_remap_boundary["atu3ChestConsumerReadTrace"]["recoveredInternalReadShell"]
    missing_seam = row_remap_boundary["atu3ChestConsumerReadTrace"]["missingExactReadSiteSeam"]

    shell_node = "target-shell"
    owner_node = "owner-field-block"
    consumer_family_node = "consumer-family"
    routine_family_node = "chest-routine-family"
    getter_node = "cell-gain-getters"
    booster_node = "booster-bonus-shell"
    final_bonus_node = "final-chest-bonus-shell"

    edges = [
        make_edge(
            "shell-to-owner-block",
            shell_node,
            owner_node,
            "serialized-adjacency",
            "present",
            "direct",
            "The target shell still sits directly beside the CellBoost owner-field block in the committed TokenShop extract.",
            [
                cite_row_boundary(
                    "tokenShopExtract",
                    "$.fields",
                    f"{shell_window['shellField']} path_id {shell_window['shellPathId']}",
                    "Shell window recovered from the exact TokenShop payload.",
                )
            ],
        ),
        make_edge(
            "owner-block-to-consumer-family",
            owner_node,
            consumer_family_node,
            "shared-effect-to-consumer-family",
            "present",
            "derived",
            "The already checked ATU3 effect-driven lane remains grounded inside the AdManager chest consumer family.",
            [
                cite_hit(metadata_source, metadata_shell_hit),
                cite_hit(metadata_source, metadata_owner_hit),
                cite_hit(lane_consumer_source, ad_manager_hit),
                cite_hit(lane_consumer_source, set_texts_hit),
                cite_hit(lm244_consumer_source, offline_hit),
                cite_hit(lm244_consumer_source, checker_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-routines",
            consumer_family_node,
            routine_family_node,
            "consumer-family-to-chest-routines",
            "present",
            "direct",
            "The consumer family still preserves the token and diamond chest routine neighborhood.",
            [
                cite_hit(metadata_routine_source, start_token_hit),
                cite_hit(unity_routine_source, token_routine_hit),
                cite_hit(metadata_routine_source, start_diamond_hit),
                cite_hit(unity_routine_source, diamond_routine_hit),
            ],
        ),
        make_edge(
            "consumer-family-to-getters",
            consumer_family_node,
            getter_node,
            "consumer-family-to-cell-gain-getters",
            "present",
            "direct",
            "The same internal runtime neighborhood preserves both chest cell-gain getters.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.cellGainGetterFamily", ", ".join(read_trace["cellGainGetterFamily"])),
                cite_hit(getter_source, small_getter_hit),
                cite_hit(getter_source, big_getter_hit),
            ],
        ),
        make_edge(
            "getters-to-booster-shell",
            getter_node,
            booster_node,
            "cell-gain-getters-to-booster-bonus-shell",
            "present",
            "direct",
            "Committed metadata preserves the cell-gain getters beside the booster bonus aggregation shell.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.boosterAdBonusShell", ", ".join(read_trace["boosterAdBonusShell"])),
                cite_hit(booster_source, set_booster_hit),
                cite_hit(booster_source, final_booster_getter_hit),
                cite_hit(booster_source, small_cells_hit),
                cite_hit(booster_source, big_cells_hit),
                cite_hit(booster_source, final_booster_hit),
                cite_hit(booster_source, booster_routine_hit),
            ],
        ),
        make_edge(
            "booster-shell-to-final-shell",
            booster_node,
            final_bonus_node,
            "booster-bonus-shell-to-final-chest-bonus-shell",
            "present",
            "derived",
            "The booster bonus aggregation shell remains adjacent to the final token and diamond chest bonus backing-field shell preserved in probe output.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerReadTrace.recoveredInternalReadShell.finalChestBonusShell", ", ".join(read_trace["finalChestBonusShell"])),
                cite_hit(final_source, final_token_bonus_hit),
                cite_hit(final_source, final_diamond_bonus_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "cellboost-read-site-break",
            owner_node,
            booster_node,
            "exact-cellboost-to-booster-bonus-handoff",
            "missing",
            "negative",
            missing_seam["missingJoin"],
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3ChestConsumerReadTrace.missingExactReadSiteSeam.missingJoin", missing_seam["missingJoin"]),
                cite_hit(getter_source, small_getter_hit),
                cite_hit(getter_source, big_getter_hit),
                cite_hit(booster_source, set_booster_hit),
                cite_hit(booster_source, final_booster_getter_hit),
                cite_hit(booster_source, set_final_booster_hit),
                cite_hit(booster_source, final_booster_hit),
                cite_hit(booster_source, final_booster_field_hit),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-anchor", f"{shell_window['shellField']} path_id {shell_window['shellPathId']}", "present", "The exact target shell survives in the committed TokenShop payload."),
            make_node(owner_node, "owner-field-block", ", ".join(shell_window["ownerFieldBlock"]), "present", "The exact adjacent owner-field block remains serialized next to the target shell."),
            make_node(consumer_family_node, "consumer-family", "AdManager, Assembly-CSharp + chest support systems", "present", "The concrete chest consumer family is preserved in committed probe artifacts."),
            make_node(routine_family_node, "consumer-routine-family", "TokenChestRoutine + DiamondChestRoutine neighborhood", "present", "The token and diamond chest routine family is preserved."),
            make_node(getter_node, "cell-gain-getter-shell", "get_SmallAdCellGains + get_BigAdCellGains", "present", "The chest cell-gain getter shell survives in committed metadata."),
            make_node(booster_node, "booster-bonus-shell", "SetBoosterAdBonus + get_FinalBoosterAdBonus + FinalBoosterAdBonus", "present", "The internal booster bonus aggregation shell is preserved."),
            make_node(final_bonus_node, "final-chest-bonus-shell", "Final token + diamond chest bonus backing fields", "present", "The final chest bonus shell is preserved in committed probe output."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-atu3-consumer-internal-shell",
                "status": "proved",
                "statement": "ATU3 now preserves one internal bonus-aggregation shell inside the concrete AdManager chest consumer family.",
                "edgeIds": [edge["id"] for edge in edges],
                "provedBy": [citation for edge in edges for citation in edge["provedBy"]],
            },
            {
                "id": "claim-missing-exact-cellboost-read-site",
                "status": "missing",
                "statement": "The exact CellBoostBonus read site or typed field handoff anywhere inside the checked internal bonus-aggregation family still is not recovered.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_atu3_consumer_vs_effect_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["atu3ChestConsumerTrace"]["recoveredConsumerHandoff"]
    blocked = row_remap_boundary["atu3CrossSystemEffectTrace"]["recoveredActionEffectChain"]
    baseline_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly after the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.ownerFieldBlock",
                    ", ".join(blocked["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The shared Cells Booster (Chests) effect lane remains preserved.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.sharedEffectTitle",
                    baseline["sharedEffectTitle"],
                )
            ],
        },
        {
            "type": "shared-effect-to-consumer-family",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves one handoff into the AdManager chest consumer family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerSystem",
                    baseline["consumerSystem"],
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-routines",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves the token and diamond chest routine family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerMethodFamily",
                    ", ".join(baseline["consumerMethodFamily"]),
                )
            ],
        },
        {
            "type": "consumer-family-to-bonus-shell",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The new trace now preserves the final chest-bonus shell.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.consumerBonusShell",
                    ", ".join(baseline["consumerBonusShell"]),
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-objects",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The new trace now preserves the concrete token and diamond chest objects.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.recoveredConsumerHandoff.supportingChestObjects",
                    ", ".join(baseline["supportingChestObjects"]),
                )
            ],
        },
        {
            "type": "exact-cellboost-consumer-method",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The exact CellBoostBonus read or typed field handoff inside the consumer family still remains unresolved.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3ChestConsumerTrace.missingParameterConsumerSeam.missingJoin",
                    row_remap_boundary["atu3ChestConsumerTrace"]["missingParameterConsumerSeam"]["missingJoin"],
                )
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "serialized-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU3Button still sits directly after the CellBoost owner-field block.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.ownerFieldBlock",
                    ", ".join(blocked["ownerFieldBlock"]),
                )
            ],
        },
        {
            "type": "shared-effect-system",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The older effect-driven trace already preserved the shared Cells Booster (Chests) effect lane.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.recoveredActionEffectChain.sharedEffectTitle",
                    blocked["sharedEffectTitle"],
                )
            ],
        },
        {
            "type": "shared-effect-to-consumer-family",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace stopped at the shared effect surface and did not preserve one concrete consumer-family handoff.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-routines",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the token and diamond chest routine family.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
            ],
        },
        {
            "type": "consumer-family-to-bonus-shell",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the concrete chest-bonus shell.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
            ],
        },
        {
            "type": "consumer-family-to-chest-objects",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The older effect trace did not preserve the concrete chest-object handoff.",
            "provedBy": [
                cite_row_boundary(
                    "tokenShopRowRemapBoundary",
                    "$.atu3CrossSystemEffectTrace.missingTypedEffectOwner.missingJoin",
                    row_remap_boundary["atu3CrossSystemEffectTrace"]["missingTypedEffectOwner"]["missingJoin"],
                )
            ],
        },
    ]
    shared_present = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        }.intersection(
            {
                edge["type"]
                for edge in blocked_edges
                if edge["status"] == "present"
            }
        )
    )
    baseline_only = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        } - set(shared_present)
    )
    blocked_missing = [edge["type"] for edge in blocked_edges if edge["status"] == "missing"]

    return {
        "baseline": {
            "id": "atu3-chest-consumer-handoff",
            "label": "ATU3 chest consumer handoff",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": "atu3-effect-driven-chain",
            "label": "ATU3 effect-driven chain",
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both ATU3 traces preserve the direct serialized shell-to-owner-block adjacency and the shared Cells Booster (Chests) effect lane.",
                "The new consumer-seam trace adds one checked handoff into the AdManager chest consumer family, its chest-routine neighborhood, the final chest-bonus shell, and the concrete chest objects.",
                "The remaining honest blocker is now only the exact CellBoostBonus read or typed field handoff inside that consumer family.",
            ],
        },
    }


def build_family_structure_graph(
    shell_window: dict[str, Any],
    surfaces: list[dict[str, Any]],
    row_remap_boundary: dict[str, Any],
    late_boundary: dict[str, Any],
) -> dict[str, Any]:
    shell_surface = find_surface(surfaces, "family-shells")
    proxy_surface = find_surface(surfaces, "bridge-proxies")
    prefab_surface = find_surface(surfaces, "prefab-roster")
    title_surface = find_surface(surfaces, "title-text-surfaces")
    unresolved_surface = find_surface(surfaces, "negative-neighborhoods")

    extract_source = find_source_entry(shell_surface, "tokenShopExtract")
    proxy_lane_source = find_source_entry(proxy_surface, "dailyTokeniumLaneProbe")
    uabea_prefab_source = find_source_entry(prefab_surface, "uabeaProbe")
    owner_title_source = find_source_entry(title_surface, "dailyTokeniumOwnerProbe")
    unity_title_source = find_source_entry(title_surface, "unityProbe")
    unresolved_lane_source = find_source_entry(unresolved_surface, "dailyTokeniumLaneProbe")

    atu1_shell_hit = find_hit(extract_source, "ATU1Button")
    atu6_shell_hit = find_hit(extract_source, "ATU6Button")
    atu7_shell_hit = find_hit(extract_source, "ATU7Button")
    atu24_shell_hit = find_hit(extract_source, "ATU24Button")
    buy_token_hit = find_hit(proxy_lane_source, "BuyTokenBoost")
    buy_mk1_hit = find_hit(proxy_lane_source, "BuyMK1TokenBoost")
    buy_mk2_hit = find_hit(proxy_lane_source, "BuyMK2TokenBoost")
    buy_mk3_hit = find_hit(proxy_lane_source, "BuyMK3TokenBoost")
    buy_mod_hit = find_hit(proxy_lane_source, "BuyModBoost")
    buy_late_hit = find_hit(unresolved_lane_source, "BuyATU24")
    prefab_token_hit = find_hit(uabea_prefab_source, "NewTokenUPGPrefab.T1.TokensBoost")
    prefab_mk2_hit = find_hit(uabea_prefab_source, "NewTokenUPGPrefab.T1.MK2Booster")
    prefab_mk3_hit = find_hit(uabea_prefab_source, "NewTokenUPGPrefab.T1.MK3Booster")
    title_mk2_hit = find_hit(owner_title_source, "Mk2 Generator Booster")
    text_hook_hit = find_hit(unity_title_source, "SetAllTokenShopTexts")
    mod_title_hit = find_hit(unity_title_source, "Token Ultima: MP")
    mk1_support_hit = find_hit(owner_title_source, "1. MK1 Generator Output,")

    shell_node = "atu-family-shells"
    solved_node = "solved-shell-subset"
    proxy_node = "row-family-proxy-lane"
    prefab_node = "prefab-roster"
    title_node = "title-text-surfaces"
    exemplar_node = "atu6-title-exemplar"
    unresolved_node = "bounded-unresolved-neighborhoods"

    edges = [
        make_edge(
            "family-shell-adjacency",
            shell_node,
            solved_node,
            "repeated-serialized-shell-adjacency",
            "present",
            "direct",
            "The committed TokenShop payload repeatedly preserves exact ATU shell ids and adjacent owner neighborhoods across both solved and still-unresolved rows.",
            [
                cite_hit(extract_source, atu1_shell_hit),
                cite_hit(extract_source, atu6_shell_hit),
                cite_hit(extract_source, atu7_shell_hit),
                cite_hit(extract_source, atu24_shell_hit),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.targetNeighborhood.shellFieldRange", late_boundary["targetNeighborhood"]["shellFieldRange"]),
            ],
        ),
        make_edge(
            "family-proxy-lane",
            solved_node,
            proxy_node,
            "repeated-row-family-proxy-lane",
            "present",
            "supporting",
            "The strongest solved subset repeatedly preserves one row-family proxy lane through buy hooks or effect hooks rather than raw row-order similarity.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.recoveredAdditionalBridge.supportingActionHook", row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]["supportingActionHook"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.recoveredBridge.supportingEffectHook", row_remap_boundary["recoveredBridge"]["supportingEffectHook"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.traceFollowUp.recoveredBridge.supportingActionHook", row_remap_boundary["traceFollowUp"]["recoveredBridge"]["supportingActionHook"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu5TitleFollowUp.recoveredBridge.supportingActionHook", row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]["supportingActionHook"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.boundedRecoveredBridgeFollowUp.supportingActionHook", row_remap_boundary["boundedRecoveredBridgeFollowUp"]["supportingActionHook"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu7BridgeFollowUp.recoveredBridge.supportingActionHook", row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]["supportingActionHook"]),
                cite_hit(proxy_lane_source, buy_token_hit),
                cite_hit(proxy_lane_source, buy_mod_hit),
                cite_hit(proxy_lane_source, buy_mk1_hit),
                cite_hit(proxy_lane_source, buy_mk2_hit),
                cite_hit(proxy_lane_source, buy_mk3_hit),
            ],
        ),
        make_edge(
            "family-prefab-subset",
            solved_node,
            prefab_node,
            "repeated-shell-to-prefab-subset",
            "present",
            "direct",
            "The same solved subset repeatedly reaches exact prefab identities on committed sources, even when final titles still do not localize.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.recoveredAdditionalBridge.prefabIdentity", row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]["prefabIdentity"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.recoveredBridge.prefabIdentity", row_remap_boundary["recoveredBridge"]["prefabIdentity"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.traceFollowUp.recoveredBridge.prefabIdentity", row_remap_boundary["traceFollowUp"]["recoveredBridge"]["prefabIdentity"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu5TitleFollowUp.recoveredBridge.prefabIdentity", row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]["prefabIdentity"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.boundedRecoveredBridgeFollowUp.prefabIdentity", row_remap_boundary["boundedRecoveredBridgeFollowUp"]["prefabIdentity"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu7BridgeFollowUp.recoveredBridge.prefabIdentity", row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]["prefabIdentity"]),
                cite_hit(uabea_prefab_source, prefab_token_hit),
                cite_hit(uabea_prefab_source, prefab_mk2_hit),
                cite_hit(uabea_prefab_source, prefab_mk3_hit),
            ],
        ),
        make_edge(
            "family-title-text-surfaces",
            solved_node,
            title_node,
            "repeated-title-text-surface",
            "present",
            "supporting",
            "Generic TokenShop text hooks and row-adjacent title or support-text surfaces repeatedly survive, but they usually remain detached from exact shell ids.",
            [
                cite_hit(unity_title_source, text_hook_hit),
                cite_hit(unity_title_source, mod_title_hit),
                cite_hit(owner_title_source, mk1_support_hit),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.titleRosterBoundary.localTitleCluster[2].title", late_boundary["titleRosterBoundary"]["localTitleCluster"][2]["title"]),
            ],
        ),
        make_edge(
            "family-title-exemplar",
            solved_node,
            exemplar_node,
            "exact-shell-to-title-exemplar",
            "present",
            "direct",
            "ATU6 remains the standout strongest row neighborhood because the repo preserves one exact shell-to-prefab-to-title chain there.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.verifiedTitleJoin.titleProbeTitle", row_remap_boundary["verifiedTitleJoin"]["titleProbeTitle"]),
                cite_hit(owner_title_source, title_mk2_hit),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.verifiedTitleJoin.prefabIdentity", row_remap_boundary["verifiedTitleJoin"]["prefabIdentity"]),
            ],
        ),
        make_edge(
            "family-unresolved-bounds",
            shell_node,
            unresolved_node,
            "bounded-unresolved-neighborhood-coverage",
            "present",
            "supporting",
            "The still-unresolved neighborhoods are already checked as bounded negatives rather than open-ended unknowns.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CellsDisambiguationPass.groundedConclusion", row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.groundedConclusion", late_boundary["groundedConclusion"]),
                cite_hit(unresolved_lane_source, buy_late_hit),
            ],
        ),
    ]

    negative_edges = [
        make_edge(
            "family-missing-title-localization",
            solved_node,
            title_node,
            "repeated-shell-to-title-localization-gap",
            "missing",
            "negative",
            "Outside ATU6, the solved shell subset still does not repeatedly localize final player-facing row titles: ATU1, ATU2, ATU4, ATU5, and ATU7 all stop short of one exact shell-to-title join.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.blockedIdentityJoin.missingLinks[1]", row_remap_boundary["blockedIdentityJoin"]["missingLinks"][1]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.traceFollowUp.blockedTitleJoin.missingJoin", row_remap_boundary["traceFollowUp"]["blockedTitleJoin"]["missingJoin"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu5TitleFollowUp.blockedTitleJoin.missingJoin", row_remap_boundary["atu5TitleFollowUp"]["blockedTitleJoin"]["missingJoin"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu7BridgeFollowUp.recoveredBridge.groundedConclusion", row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]["groundedConclusion"]),
            ],
        ),
        make_edge(
            "family-missing-unresolved-identity",
            shell_node,
            unresolved_node,
            "repeated-unresolved-shell-identity-gap",
            "missing",
            "negative",
            "The unresolved ATU3 and late ATU24-ATU28 neighborhoods still fail the exact shell-to-prefab or shell-to-title localization step entirely, even though shell-side serialization and nearby hooks survive.",
            [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CellsDisambiguationPass.groundedConclusion", row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.result", late_boundary["result"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.groundedConclusion", late_boundary["groundedConclusion"]),
            ],
        ),
    ]

    return {
        "nodes": [
            make_node(shell_node, "shell-family", shell_window["shellField"], "present", "The ATU shell family is preserved as one exact serialized TokenShop range."),
            make_node(solved_node, "solved-shell-subset", "ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU7Button", "present", "Six shell neighborhoods now preserve checked row-family structure."),
            make_node(proxy_node, "row-family-proxy-lane", "BuyTokenBoost, ATU2DiamondsBonus, BuyModBoost, BuyMK1TokenBoost, BuyMK2TokenBoost, BuyMK3TokenBoost", "present", "Row-family proxy hooks survive on the strongest solved subset."),
            make_node(prefab_node, "prefab-roster", "TokensBoost, DiamondBoost, ModPointsBooster, MK1Booster, MK2Booster, MK3Booster", "present", "Exact prefab identities survive for the solved subset."),
            make_node(title_node, "title-text-surfaces", "SetAllTokenShopTexts, SetTokenTexts, Token Ultima: MP, 1. MK1 Generator Output,", "present", "Title and text surfaces survive repeatedly, but usually as detached clusters."),
            make_node(exemplar_node, "exact-title-exemplar", "ATU6Button -> Mk2 Generator Booster", "present", "ATU6 is the only fully localized shell-to-prefab-to-title chain."),
            make_node(unresolved_node, "bounded-unresolved-neighborhoods", "ATU3Button plus ATU24Button through ATU28Button", "present", "The main unresolved neighborhoods are already checked as bounded negatives."),
        ],
        "edges": edges,
        "negativeEdges": negative_edges,
        "claimLedger": [
            {
                "id": "claim-repeated-solved-structure",
                "status": "proved",
                "statement": "The strongest solved TokenShop rows repeatedly preserve shell adjacency, one row-family proxy lane, and one exact prefab identity.",
                "edgeIds": ["family-shell-adjacency", "family-proxy-lane", "family-prefab-subset"],
                "provedBy": [citation for edge in edges[:3] for citation in edge["provedBy"]],
            },
            {
                "id": "claim-atu6-standout",
                "status": "proved",
                "statement": "ATU6 is structurally stronger than the rest because it alone clears one exact shell-to-prefab-to-title chain.",
                "edgeIds": ["family-title-exemplar"],
                "provedBy": list(edges[4]["provedBy"]),
            },
            {
                "id": "claim-repeated-gaps",
                "status": "missing",
                "statement": "The family still repeatedly fails the final title-localization step, and unresolved neighborhoods still fail exact identity localization outright.",
                "edgeIds": [edge["id"] for edge in negative_edges],
                "provedBy": [citation for edge in negative_edges for citation in edge["provedBy"]],
            },
        ],
    }


def build_family_structure_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any], late_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline_edges = [
        {
            "type": "repeated-serialized-shell-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The strongest solved subset repeatedly preserves exact serialized shell adjacency.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.recoveredAdditionalBridge.ownerFieldBlock", ", ".join(row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]["ownerFieldBlock"])),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.traceFollowUp.recoveredBridge.ownerFieldBlock", ", ".join(row_remap_boundary["traceFollowUp"]["recoveredBridge"]["ownerFieldBlock"])),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu5TitleFollowUp.recoveredBridge.ownerFieldBlock", ", ".join(row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]["ownerFieldBlock"])),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu7BridgeFollowUp.recoveredBridge.ownerFieldBlock", ", ".join(row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]["ownerFieldBlock"])),
            ],
        },
        {
            "type": "repeated-row-family-proxy-lane",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "The strongest solved subset repeatedly preserves one row-family proxy hook lane.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.recoveredAdditionalBridge.supportingActionHook", row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]["supportingActionHook"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.recoveredBridge.supportingEffectHook", row_remap_boundary["recoveredBridge"]["supportingEffectHook"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.boundedRecoveredBridgeFollowUp.supportingActionHook", row_remap_boundary["boundedRecoveredBridgeFollowUp"]["supportingActionHook"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu7BridgeFollowUp.recoveredBridge.supportingActionHook", row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]["supportingActionHook"]),
            ],
        },
        {
            "type": "repeated-shell-to-prefab-subset",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The strongest solved subset repeatedly preserves exact prefab identities.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.recoveredAdditionalBridge.prefabIdentity", row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]["prefabIdentity"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.recoveredBridge.prefabIdentity", row_remap_boundary["recoveredBridge"]["prefabIdentity"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.verifiedTitleJoin.prefabIdentity", row_remap_boundary["verifiedTitleJoin"]["prefabIdentity"]),
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu7BridgeFollowUp.recoveredBridge.prefabIdentity", row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]["prefabIdentity"]),
            ],
        },
        {
            "type": "exact-shell-to-title-exemplar",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "ATU6 contributes one exact shell-to-prefab-to-title exemplar.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.verifiedTitleJoin.titleProbeTitle", row_remap_boundary["verifiedTitleJoin"]["titleProbeTitle"]),
            ],
        },
    ]
    blocked_edges = [
        {
            "type": "repeated-serialized-shell-adjacency",
            "status": "present",
            "provenanceStrength": "direct",
            "statement": "The unresolved neighborhoods still preserve exact serialized shell-side neighborhoods.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.blockedAdjacentShell.adjacentOwnerFieldBlock", ", ".join(row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]["adjacentOwnerFieldBlock"])),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.targetNeighborhood.shellFieldRange", late_boundary["targetNeighborhood"]["shellFieldRange"]),
            ],
        },
        {
            "type": "repeated-row-family-proxy-lane",
            "status": "present",
            "provenanceStrength": "supporting",
            "statement": "Some unresolved neighborhoods still preserve nearby generic or late buy-hook shells.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.blockedAdjacentShell.nearestNamedActionHook", row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]["nearestNamedActionHook"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.actionNeighborhood.preservedLateHooks[0]", late_boundary["actionNeighborhood"]["preservedLateHooks"][0]),
            ],
        },
        {
            "type": "repeated-shell-to-prefab-subset",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The unresolved neighborhoods still do not preserve exact shell-to-prefab localization.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.adjacentFollowUp.blockedAdjacentShell.missingLinks[2]", row_remap_boundary["adjacentFollowUp"]["blockedAdjacentShell"]["missingLinks"][2]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.result", late_boundary["result"]),
            ],
        },
        {
            "type": "exact-shell-to-title-exemplar",
            "status": "missing",
            "provenanceStrength": "negative",
            "statement": "The unresolved neighborhoods still do not preserve one exact shell-to-final-title chain.",
            "provedBy": [
                cite_row_boundary("tokenShopRowRemapBoundary", "$.atu3CellsDisambiguationPass.groundedConclusion", row_remap_boundary["atu3CellsDisambiguationPass"]["groundedConclusion"]),
                cite_row_boundary("tokenShopLateAtuBoundary", "$.groundedConclusion", late_boundary["groundedConclusion"]),
            ],
        },
    ]
    shared_present = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        }.intersection(
            {
                edge["type"]
                for edge in blocked_edges
                if edge["status"] == "present"
            }
        )
    )
    baseline_only = sorted(
        {
            edge["type"]
            for edge in baseline_edges
            if edge["status"] == "present"
        } - set(shared_present)
    )
    blocked_missing = [edge["type"] for edge in blocked_edges if edge["status"] == "missing"]
    return {
        "baseline": {
            "id": "token-shop-family-structure",
            "label": "TokenShop solved family structure",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": "ATU1Button, ATU2Button, ATU4Button, ATU5Button, ATU6Button, ATU7Button",
            "shellPathId": "solved-subset",
            "comparisonShape": baseline_edges,
            "groundedConclusion": "The strongest solved TokenShop subset repeatedly preserves shell adjacency, one row-family proxy lane, and one exact prefab identity, with ATU6 adding one exact title-chain exemplar.",
        },
        "blockedTarget": {
            "id": target_id,
            "label": target["label"],
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopLateAtuBoundary"]),
            "shellField": "ATU3Button plus ATU24Button through ATU28Button",
            "shellPathId": "bounded-unresolved-neighborhoods",
            "comparisonShape": blocked_edges,
            "groundedConclusion": "The unresolved TokenShop neighborhoods still preserve shell-side serialization and some proxy hooks, but exact prefab and title localization remain blocked.",
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both the solved and unresolved neighborhoods still preserve shell-side ATU serialization.",
                "The strongest solved subset adds repeated row-family proxy hooks and exact prefab identities, while ATU6 alone adds one exact title-chain exemplar.",
                "The unresolved neighborhoods still stop before exact prefab or final-title localization, so the family audit remains descriptive rather than promotive.",
            ],
        },
    }


def has_exact_bridge(shell_window: dict[str, Any], surfaces: list[dict[str, Any]], candidate_terms: list[str]) -> tuple[bool, list[dict[str, Any]]]:
    shell_signatures = {str(shell_window["shellField"]), str(shell_window["shellPathId"])}
    bridge_hits: list[dict[str, Any]] = []
    for surface in surfaces:
        for source_entry in surface["sources"]:
            for hit in source_entry["hits"]:
                text = json.dumps(hit, sort_keys=True)
                if any(signature in text for signature in shell_signatures) and any(term in text for term in candidate_terms):
                    bridge_hits.append(
                        {
                            "surfaceId": surface["id"],
                            "sourcePath": source_entry["sourcePath"],
                            "term": hit["term"],
                        }
                    )
    return len(bridge_hits) > 0, bridge_hits


def make_surface_source(source_id: str, hits: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "sourceId": source_id,
        "sourcePath": repo_relative(ALL_SOURCE_PATHS[source_id]),
        "searchModes": get_source_search_modes(source_id),
        "hitCount": len(hits),
        "highSignalHitCount": len(hits),
        "supportingHitCount": 0,
        "incidentalHitCount": 0,
        "suppressedNoiseCount": 0,
        "hits": hits,
    }


def make_surface_hit(term: str, json_path: str) -> dict[str, Any]:
    return {
        "term": term,
        "jsonPath": json_path,
        "signalTier": "high-signal",
        "signalScore": 100,
        "matchMode": "exact-structured",
    }


def build_token_shop_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = []
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        anchor_specs = build_anchor_specs(terms, "surface-search")
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "anchorSpecs": anchor_specs,
                "sources": [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in surface["sourceIds"]],
            }
        )
    bridge_cleared, bridge_hits = has_exact_bridge(shell_window, surfaces, config["bridgeCandidateTerms"])
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_trace_graph(shell_window, surfaces, documents["tokenShopRowRemapBoundary"]),
        "bridgePromotionRule": "Only promote a remap or owner boundary when one committed artifact preserves an exact shell-side anchor together with one exact prefab identity or final player-facing title in the same local container.",
        "bridgeCheck": {
            "candidateTerms": config["bridgeCandidateTerms"],
            "bridgeCleared": bridge_cleared,
            "bridgeHits": bridge_hits,
            "result": "checked object-or-title bridge recovered" if bridge_cleared else "no checked object-or-title bridge recovered",
        },
        "solvedVsBlockedDiff": build_solved_vs_blocked_diff(target_id, target, documents["tokenShopRowRemapBoundary"]),
        "lostStructure": config["lostStructure"],
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a remap promotion by itself.",
            "It now keeps declaration anchors, owner-payload shells, action hooks, targeted string hits, prefab or title surfaces, and explicit typed graph edges in one checked artifact bundle so unresolved joins can be judged from one place.",
            "The graph records both proved joins and negative joins, with provenance-strength tags and source citations for each claim.",
            "If no committed source preserves both the shell-side anchor and one exact prefab or title candidate in the same local container, the result stays negative and downstream boundaries should not advance.",
        ],
    }


def build_token_shop_mod_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = []
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        anchor_specs = build_anchor_specs(terms, "surface-search")
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "anchorSpecs": anchor_specs,
                "sources": [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in surface["sourceIds"]],
            }
        )

    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    trace_bridge = row_remap_boundary["traceFollowUp"]["recoveredBridge"]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_mod_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only promote a TokenShop row remap past compatibility-only import when one checked shell-side owner block, one row-specific action hook, and one exact prefab or final-title surface converge on the same row family.",
        "bridgeCheck": {
            "candidateTerms": [trace_bridge["supportingActionHook"], trace_bridge["prefabIdentity"]],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumLaneProbe"]), "term": trace_bridge["supportingActionHook"]},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["uabeaProbe"]), "term": trace_bridge["prefabIdentity"]},
            ],
            "result": "checked object bridge recovered",
        },
        "solvedVsBlockedDiff": build_mod_vs_blocked_diff(target_id, target, row_remap_boundary),
        "lostStructure": config["lostStructure"],
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a full-lane TokenShop remap promotion by itself.",
            "It now preserves one exact ATU4 shell-to-action-hook-to-prefab bridge in the same checked trace bundle while keeping the title-side text-hook and title-candidate surfaces explicit.",
            "Keep the recovered ATU4 bridge quarantined to row-remap evidence until a separate final player-facing title join clears.",
        ],
    }


def build_token_shop_mk1_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = []
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        anchor_specs = build_anchor_specs(terms, "surface-search")
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "anchorSpecs": anchor_specs,
                "sources": [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in surface["sourceIds"]],
            }
        )
    trace_bridge = row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_mk1_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only promote the traced ATU5 row past quarantine when one exact shell-to-final-title join is recovered; prefab-only and support-text-only evidence remains remap-only.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], trace_bridge["supportingActionHook"], trace_bridge["prefabIdentity"]],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumLaneProbe"]), "term": trace_bridge["supportingActionHook"]},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["uabeaProbe"]), "term": trace_bridge["prefabIdentity"]},
            ],
            "result": "checked object bridge recovered",
        },
        "solvedVsBlockedDiff": build_mk1_vs_blocked_diff(target_id, target, row_remap_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a full-lane TokenShop remap promotion by itself.",
            "It now preserves one exact ATU5 shell-to-action-hook-to-prefab bridge in the same checked trace bundle while keeping the MK1 support-text, neighboring generator title-roster, and generic text-hook surfaces explicit.",
            "Keep the recovered ATU5 bridge quarantined to row-remap evidence until a separate final player-facing title join clears.",
        ],
    }


def build_token_shop_mk3_bridge_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = []
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        anchor_specs = build_anchor_specs(terms, "surface-search")
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "anchorSpecs": anchor_specs,
                "sources": [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in surface["sourceIds"]],
            }
        )
    trace_bridge = row_remap_boundary["atu7BridgeFollowUp"]["recoveredBridge"]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_mk3_bridge_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only promote the traced ATU7 row as one bounded remap bridge when one checked shell-side owner block, one row-specific action hook, and one exact prefab identity converge on the same row family; do not infer any final title from this pass.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], trace_bridge["supportingActionHook"], trace_bridge["prefabIdentity"]],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumLaneProbe"]), "term": trace_bridge["supportingActionHook"]},
                {"surfaceId": "prefab-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["uabeaProbe"]), "term": trace_bridge["prefabIdentity"]},
            ],
            "result": "checked object bridge recovered",
        },
        "solvedVsBlockedDiff": build_mk3_vs_blocked_diff(target_id, target, row_remap_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a full-lane TokenShop remap promotion by itself.",
            "It now preserves one exact ATU7 shell-to-action-hook-to-prefab bridge in the same checked trace bundle without reopening title-side localization first.",
            "Keep the recovered ATU7 bridge bounded to row-remap evidence and leave the rest of the unresolved MK-family shells quarantined until their own exact joins clear.",
        ],
    }


def build_token_shop_atu3_effect_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = []
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        anchor_specs = build_anchor_specs(terms, "surface-search")
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "anchorSpecs": anchor_specs,
                "sources": [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in surface["sourceIds"]],
            }
        )
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_atu3_effect_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only preserve ATU3 as an effect-driven row when one checked shell-side owner block, one exact row-family action hook, and one shared chest-effect title or text surface converge on the same cells-from-chests lane; keep typed gameplay owner claims blocked unless the applier is recovered explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], "BuyCellBoost", "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>", "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>."],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "action-lane", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumLaneProbe"]), "term": "BuyCellBoost"},
                {"surfaceId": "shared-effect-title", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumOwnerProbe"]), "term": "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>"},
                {"surfaceId": "shared-effect-text", "sourcePath": repo_relative(ALL_SOURCE_PATHS["unityProbe"]), "term": "<b>+1</b> Seconds \"timeskip\" to <color=#4DFEC4>Cells Gained</color> from <b>Token & Diamond Chests</b>."},
            ],
            "result": "checked action-to-shared-effect chain recovered",
        },
        "solvedVsBlockedDiff": build_atu3_effect_vs_split_diff(target_id, target, row_remap_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven trace workflow, not a standard prefab-or-title TokenShop remap promotion by itself.",
            "It now preserves one exact ATU3 shell-to-action-hook-to-shared-effect chain for the cells-from-chests gameplay lane while keeping the detached diamond-side and token-side identity surfaces explicit as contrast evidence.",
            "Keep the ATU3 result quarantined to effect-driven remap evidence until the exact typed gameplay owner or chest-effect applier is recovered.",
        ],
    }


def build_token_shop_atu3_chest_consumer_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = []
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        anchor_specs = build_anchor_specs(terms, "surface-search")
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "anchorSpecs": anchor_specs,
                "sources": [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in surface["sourceIds"]],
            }
        )
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_atu3_chest_consumer_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only preserve ATU3 as a consumer-seam row when one checked shared chest-effect lane, one concrete chest consumer family, one chest-routine neighborhood, and one chest-bonus shell converge on the same cells-from-chests lane; keep exact CellBoostBonus consumer-method claims blocked unless that handoff is recovered explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>", "AdManager, Assembly-CSharp", "<TokenChestRoutine>d__149", "<FinalDiamondChestBonus>k__BackingField"],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "shared-effect-title", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumOwnerProbe"]), "term": "Cells Booster <size=\"22\"><i><color=#B5B5B5>(Chests)</i></color></size>"},
                {"surfaceId": "consumer-family", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumLaneProbe"]), "term": "AdManager, Assembly-CSharp"},
                {"surfaceId": "consumer-routines", "sourcePath": repo_relative(ALL_SOURCE_PATHS["unityProbe"]), "term": "<TokenChestRoutine>d__149"},
                {"surfaceId": "consumer-routines", "sourcePath": repo_relative(ALL_SOURCE_PATHS["unityProbe"]), "term": "<FinalDiamondChestBonus>k__BackingField"},
            ],
            "result": "checked shared-effect-to-consumer-family handoff recovered",
        },
        "solvedVsBlockedDiff": build_atu3_consumer_vs_effect_diff(target_id, target, row_remap_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven cross-system trace workflow, not a standard prefab-or-title TokenShop remap promotion by itself.",
            "It now preserves one exact ATU3 shared-effect-to-consumer-family handoff into the AdManager chest routine neighborhood while keeping the exact CellBoostBonus read or typed field handoff explicit as the only remaining break.",
            "Keep the ATU3 result quarantined to effect-driven remap evidence until one committed source recovers the exact CellBoostBonus consumer method or typed field handoff.",
        ],
    }


def build_atu3_consumer_read_vs_consumer_diff(target_id: str, target: dict[str, Any], row_remap_boundary: dict[str, Any]) -> dict[str, Any]:
    baseline = row_remap_boundary["atu3ChestConsumerReadTrace"]["recoveredInternalReadShell"]
    blocked = row_remap_boundary["atu3ChestConsumerTrace"]["recoveredConsumerHandoff"]
    baseline_edges = [
        "serialized-adjacency",
        "shared-effect-to-consumer-family",
        "consumer-family-to-chest-routines",
        "consumer-family-to-cell-gain-getters",
        "cell-gain-getters-to-booster-bonus-shell",
        "booster-bonus-shell-to-final-chest-bonus-shell",
    ]
    blocked_edges = [
        "serialized-adjacency",
        "shared-effect-to-consumer-family",
        "consumer-family-to-chest-routines",
        "consumer-family-to-bonus-shell",
    ]
    shared_present = [edge for edge in baseline_edges if edge in blocked_edges]
    baseline_only = [edge for edge in baseline_edges if edge not in blocked_edges]
    blocked_missing = ["exact-cellboost-to-booster-bonus-handoff"]
    return {
        "baseline": {
            "id": "atu3-consumer-internal-read",
            "label": "ATU3 consumer-internal read shell",
            "status": "cleared",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": baseline["shellField"],
            "shellPathId": baseline["shellPathId"],
            "comparisonShape": baseline_edges,
            "groundedConclusion": baseline["groundedConclusion"],
        },
        "blockedTarget": {
            "id": target_id,
            "label": "ATU3 chest consumer seam",
            "status": "blocked",
            "sourcePath": repo_relative(ALL_SOURCE_PATHS["tokenShopRowRemapBoundary"]),
            "shellField": blocked["shellField"],
            "shellPathId": blocked["shellPathId"],
            "comparisonShape": blocked_edges,
            "groundedConclusion": blocked["groundedConclusion"],
        },
        "delta": {
            "sharedPresentEdgeTypes": shared_present,
            "baselineOnlyPresentEdgeTypes": baseline_only,
            "blockedMissingEdgeTypes": blocked_missing,
            "solvedVsBlockedSummary": [
                "Both ATU3 consumer traces preserve the direct serialized shell-to-owner-block adjacency and the shared effect-to-consumer-family handoff.",
                "The new internal read trace adds one checked getter-to-booster bonus aggregation shell inside the AdManager chest consumer family.",
                "The remaining bounded break is no longer the outer chest routine family but the exact CellBoostBonus read-site handoff into that internal bonus shell.",
            ],
        },
    }


def build_token_shop_atu3_chest_consumer_read_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    shell_window = get_shell_window(documents["tokenShopExtract"], config["shellField"], config["shellWindowRadius"])
    surfaces = []
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        anchor_specs = build_anchor_specs(terms, "surface-search")
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "anchorSpecs": anchor_specs,
                "sources": [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in surface["sourceIds"]],
            }
        )
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_atu3_chest_consumer_read_trace_graph(shell_window, surfaces, row_remap_boundary),
        "bridgePromotionRule": "Only preserve ATU3 as a consumer-internal read trace when one checked chest consumer family, one chest routine neighborhood, one cell-gain getter shell, and one booster bonus aggregation shell converge on the same cells-from-chests lane; keep the exact CellBoostBonus runtime read blocked unless that handoff is recovered explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["shellField"], "AdManager, Assembly-CSharp", "get_SmallAdCellGains", "SetBoosterAdBonus", "get_FinalBoosterAdBonus"],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "consumer-family", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumLaneProbe"]), "term": "AdManager, Assembly-CSharp"},
                {"surfaceId": "cell-gain-getters", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "get_SmallAdCellGains"},
                {"surfaceId": "booster-bonus-shell", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "SetBoosterAdBonus"},
                {"surfaceId": "booster-bonus-shell", "sourcePath": repo_relative(ALL_SOURCE_PATHS["metadata"]), "term": "get_FinalBoosterAdBonus"},
            ],
            "result": "checked consumer-internal bonus shell recovered",
        },
        "solvedVsBlockedDiff": build_atu3_consumer_read_vs_consumer_diff(target_id, target, row_remap_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a target-driven cross-system trace workflow, not a standard prefab-or-title TokenShop remap promotion by itself.",
            "It now preserves one exact ATU3 consumer-internal bonus shell inside the AdManager chest consumer family while also closing the checked outer chest routines, final token-or-diamond chest bonus backing fields, remaining getter-or-booster aggregation family, and FinalBoosterAdBonus setter-or-backing-field surfaces as a bounded negative result for one exact CellBoostBonus handoff.",
            "Keep the ATU3 result quarantined to effect-chain completion evidence and do not reopen this closed AdManager bonus-aggregation cluster unless a new committed artifact lands.",
        ],
    }


def build_token_shop_family_structure_trace(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    row_remap_boundary = documents["tokenShopRowRemapBoundary"]
    late_boundary = documents["tokenShopLateAtuBoundary"]
    surfaces = []
    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["tokenShopExtract"]),
        "shellField": config["shellField"],
        "shellPathId": config["shellPathId"],
        "shellObjectOffset": None,
        "ownerFieldBlock": [
            "TokenBoost / DiamondBoost / ModBoost / MK1TokenBoost / MK2TokenBoost solved-row windows",
            "ATU3 cells-domain split window",
            "ATU24Button through ATU28Button late shell neighborhood",
        ],
        "window": [
            {"field": "ATU1Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["adjacentFollowUp"]["recoveredAdditionalBridge"]["shellPathId"]},
            {"field": "ATU2Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["recoveredBridge"]["shellPathId"]},
            {"field": "ATU4Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["traceFollowUp"]["recoveredBridge"]["shellPathId"]},
            {"field": "ATU5Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["atu5TitleFollowUp"]["recoveredBridge"]["shellPathId"]},
            {"field": "ATU6Button", "group": "solved-shell", "kind": "pointer", "pathId": row_remap_boundary["verifiedTitleJoin"]["shellPathId"]},
            {"field": "ATU3Button", "group": "blocked-shell", "kind": "pointer", "pathId": row_remap_boundary["atu3CellsDisambiguationPass"]["shellPathId"]},
            {"field": "ATU24Button through ATU28Button", "group": "blocked-shell", "kind": "range", "pathId": late_boundary["targetNeighborhood"]["shellFieldRange"]},
        ],
    }
    for surface in config["surfaces"]:
        terms = list(dict.fromkeys([*surface["terms"], *anchors]))
        anchor_specs = build_anchor_specs(terms, "surface-search")
        surfaces.append(
            {
                "id": surface["id"],
                "label": surface["label"],
                "terms": terms,
                "anchorSpecs": anchor_specs,
                "sources": [collect_source_hits(documents, source_id, anchor_specs, shell_window) for source_id in surface["sourceIds"]],
            }
        )

    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": build_family_structure_graph(shell_window, surfaces, row_remap_boundary, late_boundary),
        "bridgePromotionRule": "This target is a bounded family audit only. Do not promote any new TokenShop row remaps, planner behavior, or player-facing labels from it.",
        "bridgeCheck": {
            "candidateTerms": [
                "ATU1Button",
                "ATU2Button",
                "ATU4Button",
                "ATU5Button",
                "ATU6Button",
                "ATU3Button",
                "ATU24Button",
            ],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "bridge-proxies", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumLaneProbe"]), "term": "BuyTokenBoost"},
                {"surfaceId": "bridge-proxies", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumLaneProbe"]), "term": "BuyMK1TokenBoost"},
                {"surfaceId": "prefab-roster", "sourcePath": repo_relative(ALL_SOURCE_PATHS["uabeaProbe"]), "term": "NewTokenUPGPrefab.T1.MK2Booster"},
                {"surfaceId": "title-text-surfaces", "sourcePath": repo_relative(ALL_SOURCE_PATHS["dailyTokeniumOwnerProbe"]), "term": "Mk2 Generator Booster"},
            ],
            "result": "checked family structure audit recovered",
        },
        "solvedVsBlockedDiff": build_family_structure_diff(target_id, target, row_remap_boundary, late_boundary),
        "lostStructure": list(config["lostStructure"]),
        "groundedConclusion": config["groundedConclusion"],
        "currentBoundary": [
            "This is a bounded TokenShop family structure audit, not a remap promotion pass.",
            "The audit groups the solved ATU1, ATU2, ATU4, ATU5, ATU6, and ATU7 shells alongside the bounded ATU3 and late ATU24-ATU28 negatives so repeated joins and repeated gaps can be compared in one checked bundle.",
            "Do not infer new row identity from row order, loose title-roster similarity, generic text hooks, or this audit alone.",
        ],
    }


def build_shard_cost_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    cost_model = documents["shardCostModelBoundary"]
    parameter_probe = documents["shardCostParameterProbe"]
    native_probe = documents["shardCostNativeProbe"]
    formula_model = documents["shardCostFormulaModel"]
    save_owner_candidates = documents["shardMilestoneSaveOwnerCandidates"]
    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["shardCostModelBoundary"]),
        "shellField": config["accessor"],
        "shellPathId": "runtime-getter",
        "shellObjectOffset": None,
        "ownerFieldBlock": config["parameterShell"],
        "window": [{"field": field, "group": "row0-parameter-shell", "kind": "field"} for field in config["parameterShell"]],
    }
    surfaces = [
        {
            "id": "cost-model-boundary",
            "label": "Shard cost-model boundary",
            "terms": anchors,
            "sources": [
                make_surface_source(
                    "shardCostModelBoundary",
                    [
                        make_surface_hit(config["ownerType"], "$.dataCarrier"),
                        make_surface_hit(config["accessor"], "$.sampleCostAccessorWindows[0].accessors[0]"),
                        *[make_surface_hit(field, "$.row0CostFields") for field in config["parameterShell"][:3]],
                    ],
                )
            ],
        },
        {
            "id": "native-getter",
            "label": "Shard native getter probe",
            "terms": [config["accessor"], *config["parameterShell"][:3]],
            "sources": [
                make_surface_source(
                    "shardCostNativeProbe",
                    [
                        make_surface_hit(config["accessor"], "$.rows[0].name"),
                        *[make_surface_hit(field, "$.rows[0].operandFieldNames") for field in native_probe["rows"][0]["operandFieldNames"]],
                    ],
                )
            ],
        },
        {
            "id": "formula-model",
            "label": "Shard formula model",
            "terms": ["GetShardCostList", "UpdateShardCostList", "MilestoneCostList"],
            "sources": [
                make_surface_source(
                    "shardCostFormulaModel",
                    [
                        make_surface_hit("GetShardCostList", "$.runtimeGetterRules.cacheLifecycle.listBuilderMethod"),
                        make_surface_hit("UpdateShardCostList", "$.runtimeGetterRules.cacheLifecycle.refreshMethod"),
                        make_surface_hit("MilestoneCostList", "$.runtimeGetterRules.cacheLifecycle.cacheField"),
                    ],
                )
            ],
        },
    ]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": {
            "nodes": [
                make_node("shard-owner", "owner-type", config["ownerType"], "present", "ShardUpgradeInfo remains the checked shard-local data carrier."),
                make_node("shard-getter", "getter", config["accessor"], "present", "The row0 shard cost accessor is preserved in committed structure probes."),
                make_node("shard-parameter-shell", "parameter-shell", ", ".join(config["parameterShell"]), "present", "The row0 shard parameter shell is preserved as direct field names."),
                make_node("shard-evaluator", "evaluator-structure", "deterministic evaluator structure", "present", "The canonical shard-cost structure model and deterministic evaluator exist."),
            ],
            "edges": [
                make_edge(
                    "shard-owner-to-getter",
                    "shard-owner",
                    "shard-getter",
                    "getter-family",
                    "present",
                    "direct",
                    "The cost-model boundary preserves get_SU0Cost on the ShardUpgradeInfo mechanic family.",
                    [
                        cite_row_boundary("shardCostModelBoundary", "$.dataCarrier", cost_model["dataCarrier"]),
                        cite_row_boundary("shardCostModelBoundary", "$.sampleCostAccessorWindows[0].accessors[0]", config["accessor"]),
                    ],
                ),
                make_edge(
                    "shard-getter-to-parameter-shell",
                    "shard-getter",
                    "shard-parameter-shell",
                    "getter-to-parameter-shell",
                    "present",
                    "direct",
                    "The checked shard boundary preserves the SU0 cost parameter shell beside get_SU0Cost.",
                    [
                        cite_row_boundary("shardCostModelBoundary", "$.row0CostFields", ", ".join(cost_model["row0CostFields"])),
                        cite_row_boundary("shardCostParameterProbe", "$.dataset", parameter_probe["dataset"]),
                    ],
                ),
                make_edge(
                    "shard-native-to-parameter-shell",
                    "shard-getter",
                    "shard-parameter-shell",
                    "native-parameter-read",
                    "present",
                    "direct",
                    "The native getter probe directly reads SU0StartCost, SU0CostExponent, and SU0GrowthExponent from the row0 getter body.",
                    [cite_row_boundary("shardCostNativeProbe", "$.rows[0].operandFieldNames", ", ".join(native_probe["rows"][0]["operandFieldNames"]))],
                ),
                make_edge(
                    "shard-parameter-shell-to-evaluator",
                    "shard-parameter-shell",
                    "shard-evaluator",
                    "deterministic-evaluator",
                    "present",
                    "supporting",
                    "The canonical shard-cost formula model and deterministic evaluator preserve the same getter family as a checked structural model.",
                    [
                        cite_row_boundary("shardCostFormulaModel", "$.completionFlags.canonicalDatasetShipped", str(formula_model["completionFlags"]["canonicalDatasetShipped"])),
                        cite_row_boundary("shardCostFormulaModel", "$.completionFlags.deterministicEvaluatorImplemented", str(formula_model["completionFlags"]["deterministicEvaluatorImplemented"])),
                    ],
                ),
            ],
            "negativeEdges": [
                make_edge("shard-missing-calibration", "shard-evaluator", "shard-evaluator", "automated-calibration-closure", "missing", "negative", "Automated calibration is not yet implemented, so the structural evaluator is not calibration-closed.", [cite_row_boundary("shardCostFormulaModel", "$.completionFlags.automatedCalibrationImplemented", str(formula_model["completionFlags"]["automatedCalibrationImplemented"]))]),
                make_edge("shard-missing-planner-safe-output", "shard-evaluator", "shard-evaluator", "planner-safe-cost-output", "missing", "negative", "Planner-safe shard cost output is still explicitly unapproved.", [cite_row_boundary("shardCostFormulaModel", "$.completionFlags.plannerSafeCostOutputApproved", str(formula_model["completionFlags"]["plannerSafeCostOutputApproved"]))]),
                make_edge("shard-missing-save-owner", "shard-owner", "shard-evaluator", "save-owner-recovery", "missing", "negative", "Shard save-owner recovery is still unresolved and must stay separate from the structural cost model.", [cite_row_boundary("shardMilestoneSaveOwnerCandidates", "$.warnings[0]", save_owner_candidates["warnings"][0])]),
            ],
            "claimLedger": [],
        },
        "bridgePromotionRule": "Only promote shard cost output past descriptive quarantine when calibration closure, planner-safe approval, and save-owner boundaries are all checked explicitly.",
        "bridgeCheck": {
            "candidateTerms": config["parameterShell"],
            "bridgeCleared": True,
            "bridgeHits": [{"surfaceId": "native-getter", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostNativeProbe"]), "term": config["accessor"]}],
            "result": "checked getter-to-parameter-shell structure recovered",
        },
        "solvedVsBlockedDiff": {
            "baseline": {"id": "shard-cost-su0-structure", "label": "Shard SU0 structural baseline", "status": "cleared", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostFormulaModel"]), "shellField": config["accessor"], "shellPathId": "runtime-getter", "comparisonShape": [{"type": "getter-family", "status": "present"}, {"type": "getter-to-parameter-shell", "status": "present"}, {"type": "native-parameter-read", "status": "present"}, {"type": "deterministic-evaluator", "status": "present"}], "groundedConclusion": "The shard SU0 getter-to-parameter-shell structure is grounded enough to preserve as a quarantined structural baseline."},
            "blockedTarget": {"id": "shard-cost-planner-safe-output", "label": "Shard planner-safe cost output", "status": "blocked", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardCostFormulaModel"]), "shellField": config["accessor"], "shellPathId": "planner-output", "comparisonShape": [{"type": "automated-calibration-closure", "status": "missing"}, {"type": "planner-safe-cost-output", "status": "missing"}, {"type": "save-owner-recovery", "status": "missing"}], "groundedConclusion": "The shard planner-safe output target remains blocked by calibration, approval, and save-owner recovery."},
            "delta": {
                "sharedPresentEdgeTypes": ["getter-family", "getter-to-parameter-shell", "native-parameter-read"],
                "baselineOnlyPresentEdgeTypes": ["deterministic-evaluator"],
                "blockedMissingEdgeTypes": ["automated-calibration-closure", "planner-safe-cost-output", "save-owner-recovery"],
                "solvedVsBlockedSummary": [
                    "The solved shard baseline preserves one direct getter-family, parameter-shell, and native-field-read chain.",
                    "The same family also preserves one deterministic evaluator structure model.",
                    "Planner-safe output stays blocked because calibration, approval, and save-owner recovery are still explicitly negative.",
                ],
            },
        },
        "lostStructure": [cost_model["optimizerBoundary"]["blockedNow"][0], cost_model["optimizerBoundary"]["blockedNow"][1], save_owner_candidates["warnings"][0]],
        "groundedConclusion": "The shard SU0 cost trace is structurally grounded. The repo preserves one checked getter-to-parameter-shell chain and one deterministic evaluator structure, but calibration closure, planner-safe cost output, and save-owner recovery all remain blocked.",
        "currentBoundary": [
            "This target preserves shard-cost structure only.",
            "It is appropriate for descriptive or quarantined structural reads, not planner-safe cost output or save-owner promotion.",
            "Keep shard cost structure separated from shard save-owner recovery until direct save-side evidence appears.",
        ],
    }


def build_shard_owned_state_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    save_boundary = documents["shardSaveBoundary"]
    payload_boundary = documents["shardMilestonePayloadBoundary"]
    handoff_boundary = documents["shardMilestoneHandoffBoundary"]
    type_probe = documents["shardTypeMetadataProbe"]
    scene_probe = documents["shardSceneMonoBehaviourProbe"]
    save_owner_candidates = documents["shardMilestoneSaveOwnerCandidates"]

    recovered_runtime_shell = save_boundary["recoveredDeclaringRowModel"]
    row_state_fields = [field["name"] for field in recovered_runtime_shell["rowStateFields"]]
    owner_list_fields = [
        field["name"]
        for field in type_probe["targets"]["shardMining"]["ownerListFields"]
        if field["name"] in {"MaxedMilestonesList", "UnlockedMilestonesList", "MilestoneCostList", "upgradeInfoList"}
    ]
    shard_scene = next(
        item for item in scene_probe["monoBehaviours"] if item["scriptName"] == "ShardMining"
    )
    local_hooks_checked = list(save_boundary["runtimeConstructionBoundary"]["localHooksChecked"])

    local_bridge_recovered = save_boundary["probeResults"].get("runtimePopulationLocalProducerRecovered") is True
    wrapper_handoff_recovered = save_boundary["probeResults"].get("saveSideOwnerRecovered") is True
    if local_bridge_recovered:
        outcome_kind = "local-runtime-population-bridge"
        outcome_label = "Local runtime population bridge"
        outcome_summary = (
            "The trace now preserves one shard-local construction bridge that populates upgradeInfoList owned-state values directly."
        )
        outcome_node_label = "Local ShardMining population bridge"
        outcome_statement = (
            "Committed shard boundary evidence now preserves one local ShardMining-side producer that fills upgradeInfoList owned-state values."
        )
        outcome_citations = [
            cite_row_boundary(
                "shardSaveBoundary",
                "$.runtimeConstructionBoundary.traceResult",
                save_boundary["runtimeConstructionBoundary"]["traceResult"][1],
            )
        ]
        bridge_result = "checked local runtime population bridge recovered"
    elif wrapper_handoff_recovered:
        outcome_kind = "deeper-wrapper-handoff"
        outcome_label = "Deeper wrapper handoff"
        outcome_summary = (
            "The trace now preserves a deeper save-side wrapper handoff for player-owned shard row state even though it does not stop on a local ShardMining producer."
        )
        outcome_node_label = "Recovered deeper save-side wrapper"
        outcome_statement = (
            "Committed shard boundary evidence now preserves one deeper wrapper handoff for player-owned shard row state behind upgradeInfoList."
        )
        outcome_citations = [
            cite_row_boundary(
                "shardMilestoneSaveOwnerCandidates",
                "$.currentBoundary",
                save_owner_candidates["currentBoundary"][0],
            )
        ]
        bridge_result = "checked deeper wrapper handoff recovered"
    else:
        outcome_kind = "non-local-injection-seam"
        outcome_label = "Non-local injection seam"
        outcome_summary = (
            "The trace rules out a local upgradeInfoList population bridge and still cannot name a deeper wrapper handoff, so owned-state values remain bounded as a non-local injection seam."
        )
        outcome_node_label = "Non-local save-side injection seam"
        outcome_statement = (
            "The committed shard boundary set now narrows the owned-state path to a non-local seam: direct definitions and the runtime shell are recovered locally, but owned-state values still arrive from a source the repo cannot yet name."
        )
        outcome_citations = [
            cite_row_boundary(
                "shardSaveBoundary",
                "$.currentBoundary[2]",
                save_boundary["currentBoundary"][2],
            ),
            cite_row_boundary(
                "shardMilestoneSaveOwnerCandidates",
                "$.confidenceNotes[1]",
                save_owner_candidates["confidenceNotes"][1],
            ),
        ]
        bridge_result = "checked non-local injection seam preserved"

    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["shardSaveBoundary"]),
        "shellField": recovered_runtime_shell["declaringField"]["name"],
        "shellPathId": recovered_runtime_shell["declaringField"]["fieldOffset"],
        "shellObjectOffset": shard_scene["pathId"],
        "ownerFieldBlock": row_state_fields,
        "window": [
            {"field": recovered_runtime_shell["declaringField"]["name"], "group": "runtime-shell", "kind": "field", "value": recovered_runtime_shell["declaringField"]["type"]},
            *[
                {"field": field["name"], "group": "runtime-row-state", "kind": "field", "value": field["type"]}
                for field in recovered_runtime_shell["rowStateFields"]
            ],
        ],
    }

    surfaces = [
        {
            "id": "scene-owner",
            "label": "Direct scene owner",
            "terms": [config["sceneOwner"], config["runtimeShell"], *anchors],
            "sources": [
                make_surface_source(
                    "shardSceneMonoBehaviourProbe",
                    [
                        make_surface_hit("ShardMining", "$.monoBehaviours[1].scriptName"),
                        make_surface_hit(str(shard_scene["pathId"]), "$.monoBehaviours[1].pathId"),
                    ],
                ),
                make_surface_source(
                    "shardSaveBoundary",
                    [
                        make_surface_hit(
                            save_boundary["recoveredDirectRowDefinitionPayload"]["ownerType"],
                            "$.recoveredDirectRowDefinitionPayload.ownerType",
                        ),
                        make_surface_hit(
                            recovered_runtime_shell["declaringField"]["name"],
                            "$.recoveredDeclaringRowModel.declaringField.name",
                        ),
                    ],
                ),
            ],
        },
        {
            "id": "runtime-shell",
            "label": "upgradeInfoList runtime shell",
            "terms": [config["runtimeShell"], *row_state_fields, *anchors],
            "sources": [
                make_surface_source(
                    "shardSaveBoundary",
                    [
                        make_surface_hit(
                            recovered_runtime_shell["declaringField"]["name"],
                            "$.recoveredDeclaringRowModel.declaringField.name",
                        ),
                        make_surface_hit(
                            recovered_runtime_shell["rowModelType"]["fullName"],
                            "$.recoveredDeclaringRowModel.rowModelType.fullName",
                        ),
                        *[
                            make_surface_hit(
                                field["name"],
                                "$.recoveredDeclaringRowModel.rowStateFields",
                            )
                            for field in recovered_runtime_shell["rowStateFields"]
                        ],
                    ],
                ),
                make_surface_source(
                    "shardTypeMetadataProbe",
                    [
                        make_surface_hit("upgradeInfoList", "$.targets.shardMining.ownerListFields"),
                        *[
                            make_surface_hit(field["name"], "$.targets.shardUpgradeInfo.fields")
                            for field in type_probe["targets"]["shardUpgradeInfo"]["fields"]
                        ],
                    ],
                ),
            ],
        },
        {
            "id": "owner-list-watchers",
            "label": "Shard-local watcher and list shells",
            "terms": [*local_hooks_checked, *owner_list_fields, *anchors],
            "sources": [
                make_surface_source(
                    "shardMilestonePayloadBoundary",
                    [
                        *[
                            make_surface_hit(name, "$.costAndListHooks")
                            for name in payload_boundary["costAndListHooks"][:4]
                        ],
                        *[
                            make_surface_hit(name, "$.progressFillHooks")
                            for name in payload_boundary["progressFillHooks"][:2]
                        ],
                    ],
                ),
                make_surface_source(
                    "shardTypeMetadataProbe",
                    [
                        *[
                            make_surface_hit(name, "$.targets.shardMining.ownerListFields")
                            for name in owner_list_fields
                        ],
                    ],
                ),
            ],
        },
        {
            "id": "handoff-boundary",
            "label": "Controller versus wrapper handoff boundary",
            "terms": [config["genericLead"], "ConstructionMilestones", *anchors],
            "sources": [
                make_surface_source(
                    "shardMilestoneHandoffBoundary",
                    [
                        make_surface_hit("ShardMining", "$.shardControllerFamily"),
                        make_surface_hit(
                            handoff_boundary["genericMilestoneLead"]["family"],
                            "$.genericMilestoneLead.family",
                        ),
                        make_surface_hit(
                            recovered_runtime_shell["declaringField"]["name"],
                            "$.handoffFindings[3]",
                        ),
                    ],
                )
            ],
        },
        {
            "id": "save-gap",
            "label": "Save-side blocker",
            "terms": [config["saveCandidate"], "PlayerProfileData", "CloudSavePlayerProfile", *anchors],
            "sources": [
                make_surface_source(
                    "shardMilestoneSaveOwnerCandidates",
                    [
                        make_surface_hit(
                            save_owner_candidates["remainingSaveOwnerCandidates"][0]["label"],
                            "$.remainingSaveOwnerCandidates[0].label",
                        ),
                        make_surface_hit("PlayerProfileData", "$.remainingSaveOwnerCandidates[0].candidateFieldClusters"),
                        make_surface_hit("CloudSavePlayerProfile", "$.remainingSaveOwnerCandidates[0].candidateFieldClusters"),
                    ],
                ),
                make_surface_source(
                    "shardSaveBoundary",
                    [
                        make_surface_hit("PlayerProfileData", "$.saveFamilyTermsChecked"),
                        make_surface_hit("CloudSavePlayerProfile", "$.saveFamilyTermsChecked"),
                    ],
                ),
            ],
        },
    ]
    for surface in surfaces:
        surface["anchorSpecs"] = build_anchor_specs(surface["terms"], "surface-search")

    trace_graph = {
        "nodes": [
            make_node("shard-scene-owner", "scene-owner", f"{config['sceneOwner']} path_id {shard_scene['pathId']}", "present", "The direct level0 ShardMining MonoBehaviour object is preserved."),
            make_node("shard-definition-family", "definition-payload", "Direct ShardMining SU0-29 definition payload", "present", "The reachable row-definition family is preserved directly on the ShardMining scene object."),
            make_node("shard-runtime-shell", "runtime-shell", config["runtimeShell"], "present", "The owned-state shell is preserved as upgradeInfoList -> ShardMining+ShardUpgradeInfo."),
            make_node("shard-owner-list-shell", "owner-list-shell", ", ".join(owner_list_fields), "present", "ShardMining preserves adjacent list shells that watch milestone cost and bool state."),
            make_node("shard-local-hooks", "watcher-hooks", ", ".join(local_hooks_checked), "present", "Shard-local watcher hooks around costs, unlock lists, max-level lists, and progress fills are preserved."),
            make_node("shard-owned-state-outcome", "owned-state-outcome", outcome_node_label, "present", outcome_summary),
        ],
        "edges": [
            make_edge(
                "shard-scene-to-definition",
                "shard-scene-owner",
                "shard-definition-family",
                "direct-scene-definition-payload",
                "present",
                "direct",
                "The direct level0 ShardMining MonoBehaviour object still holds the reachable shard definition family locally.",
                [
                    cite_row_boundary("shardSceneMonoBehaviourProbe", "$.monoBehaviours[1].pathId", str(shard_scene["pathId"])),
                    cite_row_boundary("shardSaveBoundary", "$.recoveredDirectRowDefinitionPayload.ownerType", save_boundary["recoveredDirectRowDefinitionPayload"]["ownerType"]),
                ],
            ),
            make_edge(
                "shard-definition-to-runtime-shell",
                "shard-definition-family",
                "shard-runtime-shell",
                "definition-to-runtime-shell",
                "present",
                "direct",
                "The same ShardMining owner that carries direct row definitions also declares upgradeInfoList -> ShardMining+ShardUpgradeInfo as the recovered runtime row shell.",
                [
                    cite_row_boundary("shardSaveBoundary", "$.recoveredDeclaringRowModel.declaringField.name", recovered_runtime_shell["declaringField"]["name"]),
                    cite_row_boundary("shardSaveBoundary", "$.recoveredDeclaringRowModel.rowModelType.fullName", recovered_runtime_shell["rowModelType"]["fullName"]),
                ],
            ),
            make_edge(
                "shard-runtime-to-owner-lists",
                "shard-runtime-shell",
                "shard-owner-list-shell",
                "runtime-shell-to-owner-lists",
                "present",
                "direct",
                "Type reflection preserves upgradeInfoList beside MaxedMilestonesList, UnlockedMilestonesList, and MilestoneCostList on ShardMining.",
                [
                    cite_row_boundary("shardTypeMetadataProbe", "$.targets.shardMining.ownerListFields", ", ".join(owner_list_fields)),
                ],
            ),
            make_edge(
                "shard-runtime-to-local-hooks",
                "shard-runtime-shell",
                "shard-local-hooks",
                "runtime-shell-to-local-hooks",
                "present",
                "supporting",
                "The shard payload-watch boundary keeps InitializeShards, list refresh hooks, and milestone progress-fill hooks attached to the same shard-local runtime shell.",
                [
                    cite_row_boundary("shardMilestonePayloadBoundary", "$.costAndListHooks", ", ".join(payload_boundary["costAndListHooks"][:5])),
                    cite_row_boundary("shardMilestonePayloadBoundary", "$.progressFillHooks", ", ".join(payload_boundary["progressFillHooks"])),
                ],
            ),
            make_edge(
                "shard-runtime-to-outcome",
                "shard-runtime-shell",
                "shard-owned-state-outcome",
                outcome_kind,
                "present",
                "derived",
                outcome_statement,
                outcome_citations,
            ),
        ],
        "negativeEdges": [],
        "claimLedger": [],
    }

    if not local_bridge_recovered:
        trace_graph["negativeEdges"].append(
            make_edge(
                "shard-missing-local-bridge",
                "shard-local-hooks",
                "shard-runtime-shell",
                "local-runtime-population-bridge",
                "missing",
                "negative",
                "The checked shard-local watcher hooks still do not recover any exact write, constructor, or setup path that populates upgradeInfoList owned-state values locally.",
                [
                    cite_row_boundary(
                        "shardSaveBoundary",
                        "$.runtimeConstructionBoundary.traceResult[1]",
                        save_boundary["runtimeConstructionBoundary"]["traceResult"][1],
                    ),
                    cite_row_boundary(
                        "shardMilestonePayloadBoundary",
                        "$.currentBoundary[1]",
                        payload_boundary["currentBoundary"][1],
                    ),
                ],
            )
        )

    if not wrapper_handoff_recovered:
        trace_graph["negativeEdges"].append(
            make_edge(
                "shard-missing-wrapper-handoff",
                "shard-runtime-shell",
                "shard-owned-state-outcome",
                "deeper-wrapper-handoff-recovery",
                "missing",
                "negative",
                "The repo still does not recover an exact deeper wrapper or save-side owner behind upgradeInfoList even though a PlayerProfile-side shard member shell remains the leading unresolved candidate.",
                [
                    cite_row_boundary(
                        "shardMilestoneSaveOwnerCandidates",
                        "$.remainingSaveOwnerCandidates[0].label",
                        save_owner_candidates["remainingSaveOwnerCandidates"][0]["label"],
                    ),
                    cite_row_boundary(
                        "shardMilestoneSaveOwnerCandidates",
                        "$.currentBoundary[0]",
                        save_owner_candidates["currentBoundary"][0],
                    ),
                ],
            )
        )

    comparison_shape = [
        {"type": "direct-scene-definition-payload", "status": "present"},
        {"type": "definition-to-runtime-shell", "status": "present"},
        {"type": "runtime-shell-to-owner-lists", "status": "present"},
        {"type": "runtime-shell-to-local-hooks", "status": "present"},
        {"type": outcome_kind, "status": "present"},
    ]
    blocked_shape = []
    if not local_bridge_recovered:
        blocked_shape.append({"type": "local-runtime-population-bridge", "status": "missing"})
    if not wrapper_handoff_recovered:
        blocked_shape.append({"type": "deeper-wrapper-handoff-recovery", "status": "missing"})

    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": trace_graph,
        "outcome": {
            "kind": outcome_kind,
            "label": outcome_label,
            "summary": outcome_summary,
        },
        "bridgePromotionRule": "Only promote player-owned shard state past descriptive quarantine when one exact local population bridge or deeper save-side wrapper handoff is recovered explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["runtimeShell"], *row_state_fields, *local_hooks_checked[:4]],
            "bridgeCleared": True,
            "bridgeHits": [
                {"surfaceId": "runtime-shell", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardSaveBoundary"]), "term": recovered_runtime_shell["declaringField"]["name"]},
                {"surfaceId": "owner-list-watchers", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardMilestonePayloadBoundary"]), "term": local_hooks_checked[0]},
                {"surfaceId": "save-gap", "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardMilestoneSaveOwnerCandidates"]), "term": save_owner_candidates["remainingSaveOwnerCandidates"][0]["label"]},
            ],
            "result": bridge_result,
        },
        "solvedVsBlockedDiff": {
            "baseline": {
                "id": "shard-owned-state-upgradeinfolist-population",
                "label": "Shard owned-state population boundary",
                "status": "cleared",
                "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardSaveBoundary"]),
                "shellField": recovered_runtime_shell["declaringField"]["name"],
                "shellPathId": recovered_runtime_shell["declaringField"]["fieldOffset"],
                "comparisonShape": comparison_shape,
                "groundedConclusion": outcome_summary,
            },
            "blockedTarget": {
                "id": "shard-owned-state-local-bridge",
                "label": "Shard local owned-state producer",
                "status": "blocked",
                "sourcePath": repo_relative(ALL_SOURCE_PATHS["shardMilestonePayloadBoundary"]),
                "shellField": recovered_runtime_shell["declaringField"]["name"],
                "shellPathId": "owned-state-bridge",
                "comparisonShape": blocked_shape,
                "groundedConclusion": "A recovered local producer or deeper wrapper handoff is still required before player-owned shard state can be named safely.",
            },
            "delta": {
                "sharedPresentEdgeTypes": [
                    "direct-scene-definition-payload",
                    "definition-to-runtime-shell",
                    "runtime-shell-to-owner-lists",
                    "runtime-shell-to-local-hooks",
                ],
                "baselineOnlyPresentEdgeTypes": [outcome_kind],
                "blockedMissingEdgeTypes": [entry["type"] for entry in blocked_shape],
                "solvedVsBlockedSummary": [
                    "The current shard trace preserves one direct scene owner, one direct row-definition family, one recovered runtime row shell, and one shard-local watcher/list cluster.",
                    outcome_summary,
                    "Player-owned shard import stays blocked until a real local producer or exact deeper wrapper handoff is recovered.",
                ],
            },
        },
        "lostStructure": [
            "Shard-local watcher hooks still sit beside upgradeInfoList, UnlockedMilestonesList, MaxedMilestonesList, and MilestoneCostList without one committed write path into IsUnlocked, MaxLevel, or current milestone progress.",
            "The leading PlayerProfile-side shard member shell remains an unresolved candidate rather than a recovered declaring wrapper or serialized payload owner.",
            "Keep the owned-state result quarantined to blocker evidence only; it does not reopen planner math, affordability, ROI, ETA, or canonical state.playerProfile promotion.",
        ],
        "groundedConclusion": outcome_summary,
        "currentBoundary": [
            "This target preserves the shard owned-state population boundary only.",
            "It keeps direct ShardMining row definitions, the recovered upgradeInfoList runtime shell, and local watcher/list clusters visible in one trace bundle without promoting them into a recovered import path.",
            "Treat the result as blocker evidence for player-owned shard state, not as planner-safe state, canonical import, or row-package verification.",
        ],
    }


def build_multiverse_market_save_owner_trace(target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    config = target["strategyConfig"]
    member_boundary = documents["multiverseMarketMemberBoundary"]
    import_boundary = documents["multiverseMarketSaveDataImportBoundary"]
    range_boundary = documents["multiverseMarketRangeBoundary"]
    row_text_coverage = documents["multiverseMarketRowTextCoverage"]
    action_shell = documents["multiverseMarketActionShell"]
    shell_window = {
        "source": repo_relative(ALL_SOURCE_PATHS["multiverseMarketMemberBoundary"]),
        "shellField": config["accessorBridge"],
        "shellPathId": "typed-accessor",
        "shellObjectOffset": None,
        "ownerFieldBlock": [config["saveOwner"], config["typedSpan"], "InscryptionsDone"],
        "window": [
            {"field": "bridgeAccessor", "group": "typed-boundary", "kind": "method", "value": config["accessorBridge"]},
            {"field": "declaringOwner", "group": "typed-boundary", "kind": "type", "value": config["saveOwner"]},
            {"field": "typedSpan", "group": "typed-boundary", "kind": "field-range", "value": config["typedSpan"]},
        ],
    }
    surfaces = [
        {
            "id": "accessor-bridge",
            "label": "Accessor bridge",
            "terms": anchors,
            "sources": [
                make_surface_source(
                    "multiverseMarketMemberBoundary",
                    [
                        make_surface_hit("PlayerProfileHandler", "$.typedBridgeRecovery.bridgeOwner"),
                        make_surface_hit("get_Market", "$.typedBridgeRecovery.bridgeAccessor"),
                        make_surface_hit("MultiverseMarket", "$.typedBridgeRecovery.bridgeReturnType"),
                    ],
                )
            ],
        },
        {
            "id": "save-owner-span",
            "label": "SaveData owner span",
            "terms": [config["saveOwner"], config["typedSpan"], "InscryptionsDone"],
            "sources": [
                make_surface_source(
                    "multiverseMarketSaveDataImportBoundary",
                    [
                        make_surface_hit(config["saveOwner"], "$.typedSpanBoundary.declaringOwner"),
                        make_surface_hit(config["typedSpan"], "$.typedSpanBoundary.contiguousLevelSpan"),
                        make_surface_hit("compatibility.unmappedSystemState.multiverseMarket", "$.boundedImportConclusion.importTargetPath"),
                    ],
                )
            ],
        },
        {
            "id": "ordered-overlap",
            "label": "Ordered overlap",
            "terms": [str(item) for item in config["orderedOverlap"]],
            "sources": [
                make_surface_source("multiverseMarketRangeBoundary", [make_surface_hit(str(item), "$.overlapIds") for item in range_boundary["overlapIds"]]),
                make_surface_source("multiverseMarketRowTextCoverage", [make_surface_hit("SetIS71CostText", "$.validatedRowCostTexts")]),
                make_surface_source("multiverseMarketActionShell", [make_surface_hit("BuyIS71", "$.validatedBuyHooks")]),
            ],
        },
    ]
    return {
        "shellWindow": shell_window,
        "surfaces": surfaces,
        "traceGraph": {
            "nodes": [
                make_node("market-accessor", "accessor-bridge", config["accessorBridge"], "present", "The checked PlayerProfileHandler.get_Market accessor bridge is preserved."),
                make_node("market-owner", "declaring-owner", config["saveOwner"], "present", "SaveData remains the exact checked wider owner."),
                make_node("market-span", "typed-span", config["typedSpan"], "present", "The exact contiguous IS1Level through IS110Level span is preserved."),
                make_node("market-import", "compatibility-import", "compatibility.unmappedSystemState.multiverseMarket", "present", "The compatibility-only import target is preserved."),
            ],
            "edges": [
                make_edge("market-accessor-to-owner", "market-accessor", "market-owner", "accessor-bridge", "present", "direct", "The checked accessor bridge still leads from PlayerProfileHandler.get_Market to MultiverseMarket while wider typed ownership stays on SaveData.", [cite_row_boundary("multiverseMarketMemberBoundary", "$.typedBridgeRecovery.bridgeAccessor", member_boundary["typedBridgeRecovery"]["bridgeAccessor"]), cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.typedSpanBoundary.declaringOwner", import_boundary["typedSpanBoundary"]["declaringOwner"])]),
                make_edge("market-owner-to-span", "market-owner", "market-span", "typed-save-owner", "present", "direct", "SaveData directly preserves the contiguous IS1Level through IS110Level span.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.typedSpanBoundary.contiguousLevelSpan", import_boundary["typedSpanBoundary"]["contiguousLevelSpan"])]),
                make_edge("market-span-to-import", "market-span", "market-import", "compatibility-import-span", "present", "supporting", "The exact IS span is preserved as compatibility-only raw Emporium truth, not canonical PlayerProfile import.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.boundedImportConclusion.importTargetPath", import_boundary["boundedImportConclusion"]["importTargetPath"])]),
                make_edge("market-overlap-support", "market-span", "market-import", "ordered-row-overlap", "present", "supporting", "Rows 71-74 still anchor the wider IS span to checked Emporium ordering and cost-text/action surfaces.", [cite_row_boundary("multiverseMarketRangeBoundary", "$.overlapIds", ", ".join(str(item) for item in range_boundary["overlapIds"])), cite_row_boundary("multiverseMarketRowTextCoverage", "$.validatedRowCostTexts", "SetIS71CostText"), cite_row_boundary("multiverseMarketActionShell", "$.validatedBuyHooks", "BuyIS71")]),
            ],
            "negativeEdges": [
                make_edge("market-missing-typed-market-field", "market-accessor", "market-owner", "typed-market-field-recovery", "missing", "negative", "No typed Market or MultiverseMarket field is recovered directly on PlayerProfileHandler, PlayerProfileData, or SaveData.", [cite_row_boundary("multiverseMarketMemberBoundary", "$.negativeTypedSaveDataMarketChecks", ", ".join(member_boundary["negativeTypedSaveDataMarketChecks"]))]),
                make_edge("market-missing-canonical-import", "market-span", "market-import", "canonical-import-admissibility", "missing", "negative", "Canonical import remains explicitly empty even though the compatibility-only import target is preserved.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.boundedImportConclusion.exactCanonicalImportSafeSubsetLabel", import_boundary["boundedImportConclusion"]["exactCanonicalImportSafeSubsetLabel"])]),
                make_edge("market-missing-broad-row-remap", "market-span", "market-import", "broad-row-identity-remap", "missing", "negative", "Broader row identity or remap stays blocked outside the checked 71-74 ordered overlap.", [cite_row_boundary("multiverseMarketSaveDataImportBoundary", "$.checkedIsToRowOrderBoundary.blockedWiderMapping[0]", import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][0])]),
            ],
            "claimLedger": [],
        },
        "bridgePromotionRule": "Only promote the Emporium save-owner boundary past compatibility quarantine when canonical import admissibility and broader row identity are both checked explicitly.",
        "bridgeCheck": {
            "candidateTerms": [config["accessorBridge"], config["saveOwner"], config["typedSpan"]],
            "bridgeCleared": True,
            "bridgeHits": [{"surfaceId": "accessor-bridge", "sourcePath": repo_relative(ALL_SOURCE_PATHS["multiverseMarketMemberBoundary"]), "term": config["accessorBridge"]}],
            "result": "checked accessor-to-save-owner boundary recovered",
        },
        "solvedVsBlockedDiff": {
            "baseline": {"id": "multiverse-market-save-owner-boundary", "label": "Emporium save-owner boundary", "status": "cleared", "sourcePath": repo_relative(ALL_SOURCE_PATHS["multiverseMarketSaveDataImportBoundary"]), "shellField": config["accessorBridge"], "shellPathId": "typed-accessor", "comparisonShape": [{"type": "accessor-bridge", "status": "present"}, {"type": "typed-save-owner", "status": "present"}, {"type": "compatibility-import-span", "status": "present"}], "groundedConclusion": "The Emporium accessor-to-SaveData owner boundary is grounded enough to preserve as compatibility-only truth."},
            "blockedTarget": {"id": "multiverse-market-canonical-import", "label": "Emporium canonical import", "status": "blocked", "sourcePath": repo_relative(ALL_SOURCE_PATHS["multiverseMarketSaveDataImportBoundary"]), "shellField": config["saveOwner"], "shellPathId": "canonical-import", "comparisonShape": [{"type": "typed-market-field-recovery", "status": "missing"}, {"type": "canonical-import-admissibility", "status": "missing"}, {"type": "broad-row-identity-remap", "status": "missing"}], "groundedConclusion": "Canonical import remains blocked even though the wider save-owner boundary is grounded."},
            "delta": {
                "sharedPresentEdgeTypes": ["accessor-bridge", "typed-save-owner"],
                "baselineOnlyPresentEdgeTypes": ["compatibility-import-span"],
                "blockedMissingEdgeTypes": ["typed-market-field-recovery", "canonical-import-admissibility", "broad-row-identity-remap"],
                "solvedVsBlockedSummary": [
                    "The solved save-owner baseline preserves the typed accessor bridge and exact SaveData-owned IS span.",
                    "The same target also preserves one compatibility-only import span for quarantined state.",
                    "Canonical import stays blocked because typed Market field recovery, canonical admissibility, and broader row identity are still negative.",
                ],
            },
        },
        "lostStructure": [import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][0], import_boundary["checkedIsToRowOrderBoundary"]["blockedWiderMapping"][1], import_boundary["boundedImportConclusion"]["blockedBy"][2]],
        "groundedConclusion": "The multiverse-market save-owner trace is grounded enough to preserve a checked accessor-to-SaveData owner boundary and a compatibility-only IS1Level through IS110Level span, but canonical import and broader row identity remain blocked.",
        "currentBoundary": [
            "This target preserves save-owner and compatibility-import truth only.",
            "Do not promote canonical PlayerProfile import, planner behavior, or row remap claims from this target alone.",
            "Keep the checked accessor bridge, exact SaveData owner, and bounded compatibility-only import span separate from downstream row identity or planner work.",
        ],
    }


def build_trace_payload(target_id: str, target: dict[str, Any], anchors: list[str], documents: dict[str, Any]) -> dict[str, Any]:
    strategy = target["strategy"]
    if strategy == "token-shop-atu3-cells":
        return build_token_shop_trace(target_id, target, anchors, documents)
    if strategy == "token-shop-atu4-mod":
        return build_token_shop_mod_trace(target_id, target, anchors, documents)
    if strategy == "token-shop-atu5-mk1-title":
        return build_token_shop_mk1_trace(target_id, target, anchors, documents)
    if strategy == "token-shop-atu7-mk3-bridge":
        return build_token_shop_mk3_bridge_trace(target_id, target, anchors, documents)
    if strategy == "token-shop-atu3-cells-effect":
        return build_token_shop_atu3_effect_trace(target_id, target, anchors, documents)
    if strategy == "token-shop-atu3-chest-consumer":
        return build_token_shop_atu3_chest_consumer_trace(target_id, target, anchors, documents)
    if strategy == "token-shop-atu3-chest-consumer-read":
        return build_token_shop_atu3_chest_consumer_read_trace(target_id, target, anchors, documents)
    if strategy == "token-shop-family-structure":
        return build_token_shop_family_structure_trace(target_id, target, anchors, documents)
    if strategy == "shard-cost-su0-structure":
        return build_shard_cost_trace(target, anchors, documents)
    if strategy == "shard-owned-state-upgradeinfolist-population":
        return build_shard_owned_state_trace(target, anchors, documents)
    if strategy == "multiverse-market-save-owner-boundary":
        return build_multiverse_market_save_owner_trace(target, anchors, documents)
    raise ValueError(f"Unsupported unity trace strategy: {strategy}")


def build_decision_summary(target: dict[str, Any], trace_payload: dict[str, Any]) -> dict[str, Any]:
    proved_edges = list(trace_payload["traceGraph"]["edges"])
    negative_edges = list(trace_payload["traceGraph"]["negativeEdges"])
    diff = trace_payload["solvedVsBlockedDiff"]["delta"]
    rules = target["outputSummaryRules"]
    negative_types = [edge["type"] for edge in negative_edges]
    wire = rules["wire"]
    quarantine = rules["quarantine"]
    if len(proved_edges) >= int(wire["minPresentEdges"]) and len(negative_edges) <= int(wire["maxNegativeEdges"]):
        verdict = "wire"
    elif len(proved_edges) >= int(quarantine["minPresentEdges"]) and all(edge_type in quarantine["allowedNegativeEdgeTypes"] for edge_type in negative_types):
        verdict = "quarantine"
    else:
        verdict = "keep researching"
    return {
        "verdict": verdict,
        "summary": rules["messages"]["research" if verdict == "keep researching" else verdict],
        "provedEdgeCount": len(proved_edges),
        "negativeEdgeCount": len(negative_edges),
        "baselineGap": diff["blockedMissingEdgeTypes"],
        "supportingEdgeTypes": [edge["type"] for edge in proved_edges],
        "blockedEdgeTypes": negative_types,
    }


def build_dataset(target_id: str | None, queries: list[str], extra_anchors: list[str]) -> dict[str, Any]:
    registry = load_registry()
    planner_resolution = resolve_planner_selection(registry, target_id, queries, extra_anchors)
    selected_target_id = str(planner_resolution["selectedTargetId"])
    target = registry["targets"][selected_target_id]
    family_plan = registry["planner"]["families"][target["familyId"]]
    anchors = unique_strings([*target["defaultAnchors"], *extra_anchors, *family_plan.get("anchorExpansionTerms", [])])
    execution_anchor_specs = build_anchor_specs(anchors, "execution-anchor")
    expanded_anchor_specs = build_anchor_specs(planner_resolution["expandedAnchors"], "planner-expanded-anchor")
    source_paths, source_roles = resolve_source_catalog(registry, target["requiredSourceFamilies"])
    json_sources = {"metadata", "level0", "sharedassets0", "globalgamemanagers"}
    documents = {source_id: load_json(path) for source_id, path in source_paths.items() if source_id not in json_sources}
    trace_payload = build_trace_payload(selected_target_id, target, anchors, documents)
    return {
        "dataset": "unity-trace-bundle",
        "generatedAt": str(date.today()),
        "traceWorkflow": {
            "command": "node scripts/unity/run_probe.mjs trace [--target <target-id>] [--query <query>] [--anchor <anchor>]",
            "directExample": "node scripts/unity/run_probe.mjs trace --target <target-id> --anchor <anchor>",
            "plannerExample": "node scripts/unity/run_probe.mjs trace --query <query> --anchor <anchor>",
            "acceptedAnchors": target["acceptedAnchors"],
            "targetResolution": "explicit target or checked query planner plus family-aware anchor expansion",
            "readsCommittedSourcesOnly": True,
        },
        "plannerResolution": {
            "selectionMode": planner_resolution["selectionMode"],
            "requestedQueries": planner_resolution["requestedQueries"],
            "requestedAnchors": planner_resolution["requestedAnchors"],
            "matchedInputs": planner_resolution["matchedInputs"],
            "matchedTerms": planner_resolution["matchedTerms"],
            "matchedFamilyId": planner_resolution["matchedFamilyId"],
            "matchedFamilyLabel": planner_resolution["matchedFamilyLabel"],
            "runMode": planner_resolution["selectedRunMode"],
            "comparePresetId": planner_resolution["selectedComparePresetId"],
            "synonymSetsUsed": planner_resolution["synonymSetsUsed"],
            "expandedAnchors": planner_resolution["expandedAnchors"],
            "expandedAnchorSpecs": expanded_anchor_specs,
            "decisionNote": planner_resolution["decisionNote"],
        },
        "executionAnchors": execution_anchor_specs,
        "traceRegistry": {
            "path": repo_relative(REGISTRY_PATH),
            "selectedTargetId": selected_target_id,
            "selectedFamilyId": target["familyId"],
            "requiredSourceFamilies": target["requiredSourceFamilies"],
            "solvedBaselineTargetId": target["solvedBaselineTargetId"],
            "blockedTargetId": target["blockedTargetId"],
            "comparisonPreset": registry["comparisonPresets"][target["comparisonPresetId"]],
        },
        "sources": {source_id: repo_relative(path) for source_id, path in source_paths.items()},
        "sourceRoles": source_roles,
        "target": {
            "id": selected_target_id,
            "label": target["label"],
            "familyId": target["familyId"],
            "anchors": anchors,
            "joinGoal": target["joinGoal"],
            "requiredSourceFamilies": target["requiredSourceFamilies"],
            "solvedBaselineTargetId": target["solvedBaselineTargetId"],
            "blockedTargetId": target["blockedTargetId"],
        },
        "shellWindow": trace_payload["shellWindow"],
        "surfaces": trace_payload["surfaces"],
        "traceGraph": trace_payload["traceGraph"],
        "outcome": trace_payload.get("outcome"),
        "decisionSummary": build_decision_summary(target, trace_payload),
        "bridgePromotionRule": trace_payload["bridgePromotionRule"],
        "bridgeCheck": trace_payload["bridgeCheck"],
        "solvedVsBlockedDiff": trace_payload["solvedVsBlockedDiff"],
        "lostStructure": trace_payload["lostStructure"],
        "groundedConclusion": trace_payload["groundedConclusion"],
        "currentBoundary": trace_payload["currentBoundary"],
    }


def write_markdown(dataset: dict[str, Any]) -> None:
    lines = [
        "# Unity Trace Bundle",
        "",
        f"- Target: `{dataset['target']['id']}`",
        f"- Label: {dataset['target']['label']}",
        f"- Anchors: `{', '.join(dataset['target']['anchors'])}`",
        f"- Join goal: {dataset['target']['joinGoal']}",
        "",
        "## Planner resolution",
        "",
        f"- Selection mode: `{dataset['plannerResolution']['selectionMode']}`",
        f"- Matched family: `{dataset['plannerResolution']['matchedFamilyId']}` ({dataset['plannerResolution']['matchedFamilyLabel']})",
        f"- Run mode: `{dataset['plannerResolution']['runMode']}`",
        f"- Requested queries: `{', '.join(dataset['plannerResolution']['requestedQueries']) or 'none'}`",
        f"- Requested anchors: `{', '.join(dataset['plannerResolution']['requestedAnchors']) or 'none'}`",
        f"- Expanded anchor kinds: `{format_anchor_specs(dataset['plannerResolution']['expandedAnchorSpecs'])}`",
        f"- Decision note: {dataset['plannerResolution']['decisionNote']}",
        "",
        "## Execution anchors",
        "",
        f"- Typed execution anchors: `{format_anchor_specs(dataset['executionAnchors'])}`",
        "",
        "## Workflow",
        "",
        f"- Command: `{dataset['traceWorkflow']['command']}`",
        f"- Direct example: `{dataset['traceWorkflow']['directExample']}`",
        f"- Planner example: `{dataset['traceWorkflow']['plannerExample']}`",
        f"- Accepted anchor kinds: `{', '.join(dataset['traceWorkflow']['acceptedAnchors'])}`",
        "- Purpose: preserve cross-surface joins across metadata neighborhoods, UABEA/CifiAssetProbe output, targeted string hits, and nearby prefab or title surfaces in one checked bundle.",
        f"- Registry target: `{dataset['traceRegistry']['selectedTargetId']}` from `{dataset['traceRegistry']['selectedFamilyId']}` via {md_link(ROOT / dataset['traceRegistry']['path'])}",
        "",
    ]
    if dataset.get("outcome"):
        lines.extend(
            [
                "## Outcome",
                "",
                f"- Kind: `{dataset['outcome']['kind']}`",
                f"- Label: {dataset['outcome']['label']}",
                f"- Summary: {dataset['outcome']['summary']}",
                "",
            ]
        )
    lines.extend(
        [
        "## Source reads",
        "",
        ]
    )
    for source_role in dataset["sourceRoles"]:
        lines.append(f"- `{source_role['sourceId']}`: {md_link(ROOT / source_role['path'])}")
        lines.append(f"  - {source_role['role']}")
    lines.extend([
        "",
        "## Shell window",
        "",
        f"- Shell field: `{dataset['shellWindow']['shellField']}`",
        f"- Shell path id: `{dataset['shellWindow']['shellPathId']}`",
        f"- Owner field block: `{', '.join(dataset['shellWindow']['ownerFieldBlock'])}`",
        "",
        "## Surface traces",
        "",
    ])
    for surface in dataset["surfaces"]:
        lines.append(f"### {surface['label']}")
        lines.append("")
        lines.append(f"- Search terms: `{', '.join(surface['terms'])}`")
        lines.append(f"- Typed anchors: `{format_anchor_specs(surface.get('anchorSpecs', []))}`")
        for source_entry in surface["sources"]:
            lines.append(f"- Source: {md_link(ROOT / source_entry['sourcePath'])} ({source_entry['hitCount']} hits)")
            lines.append(
                f"  - Signal summary: {source_entry['highSignalHitCount']} high-signal, "
                f"{source_entry['supportingHitCount']} supporting, {source_entry['incidentalHitCount']} incidental, "
                f"{source_entry['suppressedNoiseCount']} suppressed-noise"
            )
            for hit in source_entry["hits"]:
                if source_entry["sourceId"] == "metadata":
                    lines.append(
                        f"  - `{hit['term']}` at metadata offset `{hit['offset']}` "
                        f"[{hit['signalTier']}, score {hit['signalScore']}, {hit['matchMode']}]"
                    )
                elif source_entry["sourceId"] in ("level0", "sharedassets0", "globalgamemanagers"):
                    lines.append(
                        f"  - `{hit['term']}` at path_id `{hit['pathId']}` ({hit['objectType']}, {hit['surfaceType']}) "
                        f"[{hit['signalTier']}, score {hit['score']}, {hit['matchMode']}]"
                    )
                else:
                    lines.append(
                        f"  - `{hit['term']}` at `{hit['jsonPath']}` "
                        f"[{hit['signalTier']}, score {hit['signalScore']}, {hit['matchMode']}]"
                    )
        lines.append("")
    lines.extend([
        "## Bridge check",
        "",
        f"- Result: `{dataset['bridgeCheck']['result']}`",
    ])
    if not dataset["bridgeCheck"]["bridgeHits"]:
        lines.append("- No committed source keeps the shell-side anchor and one exact prefab or title in the same local container.")
    lines.extend([
        "",
        "## Trace graph",
        "",
        f"- Present typed edges: `{len(dataset['traceGraph']['edges'])}`",
        f"- Negative typed edges: `{len(dataset['traceGraph']['negativeEdges'])}`",
        "",
        "### Proved joins",
        "",
    ])
    for edge in dataset["traceGraph"]["edges"]:
        lines.append(f"- `{edge['type']}`: {edge['statement']} [{edge['provenanceStrength']}]")
        for citation in edge["provedBy"]:
            lines.append(f"  - `{citation['sourceId']}` at `{citation['locator']}` proves `{citation['term']}`")
    lines.extend([
        "",
        "### Missing joins",
        "",
    ])
    for edge in dataset["traceGraph"]["negativeEdges"]:
        lines.append(f"- `{edge['type']}`: {edge['statement']} [{edge['provenanceStrength']}]")
        for citation in edge["provedBy"]:
            lines.append(f"  - `{citation['sourceId']}` at `{citation['locator']}` records `{citation['term']}`")
    lines.extend([
        "",
        "## Solved vs blocked",
        "",
        f"- Baseline: `{dataset['solvedVsBlockedDiff']['baseline']['shellField']}` path id `{dataset['solvedVsBlockedDiff']['baseline']['shellPathId']}` stays cleared as the comparison shape.",
        f"- Blocked target: `{dataset['solvedVsBlockedDiff']['blockedTarget']['shellField']}` path id `{dataset['solvedVsBlockedDiff']['blockedTarget']['shellPathId']}` stays blocked.",
        f"- Shared present edge types: `{', '.join(dataset['solvedVsBlockedDiff']['delta']['sharedPresentEdgeTypes'])}`",
        f"- Baseline-only present edge types: `{', '.join(dataset['solvedVsBlockedDiff']['delta']['baselineOnlyPresentEdgeTypes'])}`",
        f"- Blocked missing edge types: `{', '.join(dataset['solvedVsBlockedDiff']['delta']['blockedMissingEdgeTypes'])}`",
        "",
    ])
    lines.extend(f"- {line}" for line in dataset["solvedVsBlockedDiff"]["delta"]["solvedVsBlockedSummary"])
    lines.extend([
        "",
        "## Decision summary",
        "",
        f"- Verdict: `{dataset['decisionSummary']['verdict']}`",
        f"- Summary: {dataset['decisionSummary']['summary']}",
        f"- Proved edges: `{dataset['decisionSummary']['provedEdgeCount']}`",
        f"- Negative edges: `{dataset['decisionSummary']['negativeEdgeCount']}`",
        f"- Baseline gap: `{', '.join(dataset['decisionSummary']['baselineGap'])}`",
        "",
        "## Current loss",
        "",
    ])
    lines.extend(f"- {line}" for line in dataset["lostStructure"])
    lines.extend([
        "",
        "## Conclusion",
        "",
        f"- {dataset['groundedConclusion']}",
        "",
    ])
    MD_OUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    registry = load_registry()
    parser = argparse.ArgumentParser(
        description="Unity Trace Bundle Generator - Extract and analyze Unity objects"
    )
    
    # Target specification (from registry or custom)
    parser.add_argument("--target", 
                        choices=sorted(registry["targets"].keys()),
                        help="Target ID from trace registry (e.g., token-shop-atu3-cells)")
    parser.add_argument("--query", action="append", default=[],
                        help="Query term to search for (can specify multiple)")
    parser.add_argument("--anchor", action="append", default=[],
                        help="Anchor to trace (class, method, string, path id - can specify multiple)")
    
    # Family specification for custom targets
    parser.add_argument("--family",
                        choices=["token-shop", "shard-owned-state", "multiverse-market", "custom"],
                        help="Trace family for custom targets")
    
    # Hierarchy level control
    parser.add_argument("--level",
                        choices=["raw", "structured", "both"],
                        default="both",
                        help="Output level: raw (extracted), structured (analyzed), both (combined)")
    
    # Output control
    parser.add_argument("--json-out", type=Path, default=JSON_OUT,
                        help="Output JSON path")
    parser.add_argument("--md-out", type=Path, default=MD_OUT,
                        help="Output markdown path")
    
    # Pipeline control
    parser.add_argument("--max-steps", type=int, default=5,
                        help="Maximum analysis steps in chain")
    parser.add_argument("--chain", action="append", default=[],
                        help="Additional probe scripts to run in sequence")
    parser.add_argument("--continue-on-error", action="store_true",
                        help="Continue pipeline even if a step fails")
    
    # Output behavior
    parser.add_argument("--force", action="store_true",
                        help="Force regeneration even if output exists")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from previous output if available")
    
    # Anchor kind specification
    parser.add_argument("--anchor-kind",
                        choices=["class", "method", "string", "path id", "prefab"],
                        help="Kind of anchor being traced")
    
    args = parser.parse_args()
    
    # Validate arguments
    if not args.target and not args.query and not args.anchor:
        parser.error("pass --target or at least one --query/--anchor")
    
    # Handle custom target (not from registry)
    if args.target and args.target not in registry["targets"]:
        # Custom target - create temporary registry entry
        custom_target = {
            "id": args.target,
            "anchors": args.anchor,
            "family": args.family or "custom"
        }
        print(f"Using custom target: {args.target} (family: {args.family})")
    
    # Determine output level
    if args.level == "raw":
        output_mode = "raw_only"
    elif args.level == "structured":
        output_mode = "structured_only"
    else:
        output_mode = "both"
    
    # Build dataset with appropriate level
    dataset = build_dataset(args.target, args.query, args.anchor, output_mode=output_mode)
    
    # Add metadata about the trace parameters
    dataset["traceParams"] = {
        "target": args.target,
        "anchors": args.anchor,
        "family": args.family,
        "level": args.level,
        "anchorKind": args.anchor_kind,
        "maxSteps": args.max_steps
    }
    
    # Write outputs
    args.json_out.write_text(json.dumps(dataset, indent=2) + "\n", encoding="utf-8")
    write_markdown(dataset)
    
    print(f"Trace bundle generated: {args.json_out}")
    print(f"Markdown: {args.md_out}")


if __name__ == "__main__":
    main()
