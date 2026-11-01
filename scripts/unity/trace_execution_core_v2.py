#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from datetime import datetime
from dataclasses import dataclass
from importlib import import_module
from pathlib import Path
from typing import Any

from ghidra_cache_db_v2 import _contains_domain_signal, _looks_like_actionable_anchor_term
from trace_extractors import collect_native_trace


@dataclass(slots=True)
class ExecutionCoreResultV2:
    core_id: str
    return_code: int
    runtime_dataset: dict[str, Any]
    stdout_text: str
    stderr_text: str
    handled: bool = True


class NativeGraphExtensionExecutionCoreV2:
    core_id = "native-evidence-acquisition-execution-core-v2"

    _supported_negative_relations = {
        "exact-shell-to-action-hook",
        "exact-shell-to-prefab",
        "exact-display-update-path",
        "save-owner-recovery",
        "binds-ui-slot",
        "returns-value-from",
        "getter-family",
    }
    _promotable_runtime_relations = {
        "serialized-adjacency",
        "binds-ui-slot",
        "returns-value-from",
        "exact-shell-to-action-hook",
        "exact-shell-to-prefab",
        "exact-display-update-path",
        "getter-family",
        "save-owner-recovery",
        "owns-method",
        "owns-field",
    }

    def can_handle(self, execution: dict[str, Any]) -> bool:
        execution_routine_id = str(execution.get("executionRoutineId") or "").strip()
        obligation_kind = str(execution.get("obligationKind") or "").strip()
        relation_kind = str(execution.get("relationKind") or "").strip()
        selected_anchors = [
            str(value).strip()
            for value in (execution.get("selectedAnchors") or execution.get("requestedTerms") or [])
            if str(value).strip()
        ]
        if execution_routine_id != "run-evidence-acquisition-v2" or not selected_anchors:
            return False
        if obligation_kind == "verify-negative-edge":
            return relation_kind in self._supported_negative_relations
        return True

    def _infer_family_hint(self, trace_scope: str) -> str | None:
        lowered = str(trace_scope or "").strip().lower()
        if lowered.startswith("token-shop"):
            return "token-shop"
        if lowered.startswith("shard"):
            return "shard"
        if lowered.startswith("multiverse-market"):
            return "multiverse-market"
        return None

    def _build_request_context(self, execution: dict[str, Any]) -> dict[str, Any]:
        trace_directive = dict(execution.get("traceDirective") or {})
        payload = dict(execution.get("payload") or {})
        relation_kind = str(execution.get("relationKind") or "").strip()
        candidate_term = str(execution.get("candidateTerm") or payload.get("candidateTerm") or "").strip()
        requested_terms = [
            str(value).strip()
            for value in (execution.get("requestedTerms") or [])
            if str(value).strip()
        ]
        anchors = [
            str(value).strip()
            for value in (execution.get("selectedAnchors") or [])
            if str(value).strip()
        ]
        request_context = {
            "coverageMode": "relation-shaped" if relation_kind == "runtime-display-formula" else "term-shaped",
            "relationType": relation_kind if relation_kind == "runtime-display-formula" else "",
            "anchors": anchors,
            "expectedTerms": requested_terms,
            "relationScope": str(execution.get("traceScope") or "").strip(),
            "subjectId": str(execution.get("obligationId") or "").strip(),
            "seamId": relation_kind,
            "executionRoutineId": str(execution.get("executionRoutineId") or "").strip(),
            "edgeOnly": False,
            "disableFallbackExpansion": False,
            "maxSearchTerms": 0,
            "minimalSearchExpansion": False,
            "pathFingerprint": str(
                trace_directive.get("pathFingerprint") or payload.get("pathFingerprint") or ""
            ).strip(),
        }
        if relation_kind == "runtime-display-formula":
            request_context["requiredCoverageSeamIds"] = [candidate_term] if candidate_term else []
            request_context["requiredFactKinds"] = ["runtime-display-formula"]
            request_context["progressRelationKinds"] = ["runtime-display-formula"]
            request_context["maxSearchTerms"] = 16
            request_context["maxRequestedTerms"] = 16
            request_context["minimalSearchExpansion"] = True
            request_context["disableFallbackExpansion"] = True
        return request_context

    def _is_getter_term(self, value: str) -> bool:
        return str(value or "").strip().startswith(("get_", "Get"))

    def _is_action_term(self, value: str) -> bool:
        normalized = str(value or "").strip()
        return normalized.startswith(("Buy", "Claim", "GoTo"))

    def _canonical_action_term(self, value: str, execution: dict[str, Any]) -> str:
        normalized = str(value or "").strip()
        if not normalized.endswith("Enum"):
            return normalized
        base_value = normalized[:-4]
        if not base_value:
            return normalized
        requested_terms = {
            str(item).strip()
            for item in (execution.get("requestedTerms") or [])
            if str(item).strip()
        }
        selected_anchors = {
            str(item).strip()
            for item in (execution.get("selectedAnchors") or [])
            if str(item).strip()
        }
        if base_value in requested_terms or base_value in selected_anchors:
            return base_value
        return normalized

    def _is_prefab_term(self, value: str) -> bool:
        return "Prefab" in str(value or "").strip()

    def _is_updater_term(self, value: str) -> bool:
        normalized = str(value or "").strip()
        return normalized.startswith(("Set", "Check", "Update", "Refresh", "Fill"))

    def _is_ui_slot_term(self, value: str) -> bool:
        normalized = str(value or "").strip()
        return normalized.endswith(
            (
                "Button",
                "Overlay",
                "Content",
                "Fill",
                "Text",
                "Title",
                "Description",
                "MaxOverlay",
            )
        )

    def _term_identity_tokens(self, value: str) -> set[str]:
        normalized = str(value or "").strip()
        tokens: set[str] = set()
        for part in normalized.replace(".", " ").replace("|", " ").replace("_", " ").split():
            current = []
            for index, char in enumerate(part):
                if index > 0 and char.isupper() and part[index - 1].islower():
                    if current:
                        tokens.add("".join(current).lower())
                    current = [char]
                else:
                    current.append(char)
            if current:
                tokens.add("".join(current).lower())
        return {token for token in tokens if token and token not in {"buy", "get", "set", "new", "token", "prefab"}}

    def _direct_bridge_match_rows(self, native_payload: dict[str, Any]) -> list[dict[str, Any]]:
        bridge_plan = dict(native_payload.get("bridgePlan") or {})
        rows: list[dict[str, Any]] = []
        for match in bridge_plan.get("matches") or []:
            if not isinstance(match, dict):
                continue
            shell_field = str(match.get("shellField") or "").strip()
            requested_term = str(match.get("requestedTerm") or "").strip()
            if not shell_field or not requested_term:
                continue
            rows.append(match)
        return rows

    def _append_bridge_match_structure(
        self,
        edges: list[dict[str, Any]],
        seen_edge_keys: set[tuple[str, str, str, str]],
        node_ids: set[str],
        match: dict[str, Any],
        execution: dict[str, Any],
    ) -> None:
        requested_term = str(match.get("requestedTerm") or "").strip()
        canonical_requested_term = self._canonical_action_term(requested_term, execution)
        shell_field = str(match.get("shellField") or "").strip()
        matched_field = str(match.get("matchedField") or "").strip()
        match_score = int(match.get("matchScore") or 0)
        owner_field_block = [
            str(value).strip()
            for value in (match.get("ownerFieldBlock") or [])
            if str(value).strip()
        ]
        controller_block = [
            str(value).strip()
            for value in (match.get("controllerBlock") or [])
            if str(value).strip()
        ]
        if not shell_field:
            return
        node_ids.add(shell_field)
        for field_name in owner_field_block:
            node_ids.add(field_name)
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=shell_field,
                relation_kind="serialized-adjacency",
                target_id=field_name,
            )
        for slot_term in controller_block:
            node_ids.add(slot_term)
            if slot_term == shell_field or not self._is_ui_slot_term(slot_term):
                continue
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=shell_field,
                relation_kind="binds-ui-slot",
                target_id=slot_term,
            )
        if matched_field:
            node_ids.add(matched_field)
        if self._is_getter_term(requested_term) and matched_field:
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=requested_term,
                relation_kind="returns-value-from",
                target_id=matched_field,
            )
        row_identity_terms = [matched_field, *owner_field_block, *controller_block]
        shared_row_tokens = set()
        requested_tokens = self._term_identity_tokens(canonical_requested_term or requested_term)
        for value in row_identity_terms:
            shared_row_tokens.update(requested_tokens & self._term_identity_tokens(value))
        if self._is_action_term(canonical_requested_term) and match_score >= 20 and len(shared_row_tokens) >= 1:
            node_ids.add(canonical_requested_term)
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=shell_field,
                relation_kind="exact-shell-to-action-hook",
                target_id=canonical_requested_term,
            )
        if self._is_prefab_term(requested_term) and match_score >= 40 and len(shared_row_tokens) >= 2:
            node_ids.add(requested_term)
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=shell_field,
                relation_kind="exact-shell-to-prefab",
                target_id=requested_term,
            )

    def _edge_key(self, source_id: str, relation_kind: str, target_id: str, status: str) -> tuple[str, str, str, str]:
        return (
            str(source_id or "").strip(),
            str(relation_kind or "").strip(),
            str(target_id or "").strip(),
            str(status or "").strip(),
        )

    def _append_unique_edge(
        self,
        edges: list[dict[str, Any]],
        seen_edge_keys: set[tuple[str, str, str, str]],
        *,
        source_id: str,
        relation_kind: str,
        target_id: str,
        status: str = "present",
    ) -> bool:
        edge_key = self._edge_key(source_id, relation_kind, target_id, status)
        if not edge_key[0] or not edge_key[1] or not edge_key[2]:
            return False
        if edge_key in seen_edge_keys:
            return False
        seen_edge_keys.add(edge_key)
        edges.append(
            {
                "from": edge_key[0],
                "to": edge_key[2],
                "type": edge_key[1],
                "status": edge_key[3],
                "statement": edge_key[1],
                "provedBy": [],
                "provenanceStrength": "native-graph-extension-core",
            }
        )
        return True

    def _seed_frontier_terms(self, execution: dict[str, Any]) -> set[str]:
        frontier_terms: set[str] = set()
        for value in execution.get("selectedAnchors") or []:
            term = str(value or "").strip()
            if term:
                frontier_terms.add(term)
        for value in execution.get("requestedTerms") or []:
            term = str(value or "").strip()
            if term:
                frontier_terms.add(term)
        payload = dict(execution.get("payload") or {})
        for value in payload.get("bridgePath") or []:
            term = str(value or "").strip()
            if term:
                frontier_terms.add(term)
        for key in ("sourceNodeId", "targetNodeId"):
            term = str(execution.get(key) or "").strip()
            if term:
                frontier_terms.add(term)
        return frontier_terms

    def _expand_frontier_terms(
        self,
        execution: dict[str, Any],
        native_payload: dict[str, Any],
        *,
        limit: int = 24,
    ) -> set[str]:
        frontier_terms = set(self._seed_frontier_terms(execution))
        result = dict(native_payload.get("result") or {})
        owner_inferences = dict(result.get("ownerInferences") or {})
        bridge_plan = dict(native_payload.get("bridgePlan") or {})

        ranked_candidates: list[tuple[float, str]] = []

        def add_candidate(value: Any, score: float) -> None:
            term = str(value or "").strip()
            if not term or term in frontier_terms:
                return
            if not _looks_like_actionable_anchor_term(term):
                return
            bonus = 0.0
            if term.startswith(("Buy", "Set", "Check", "Claim", "Fill", "Update")):
                bonus += 8.0
            elif term.startswith(("get_", "Get")):
                bonus += 7.0
            elif term.startswith(("NewTokenUPGPrefab", "ATU", "SU", "DU", "LM", "MK")):
                bonus += 6.0
            if _contains_domain_signal(term):
                bonus += 3.0
            ranked_candidates.append((score + bonus, term))

        for value in bridge_plan.get("bridgedTerms") or []:
            add_candidate(value, 10.0)
        for key, base_score in (
            ("bridgedTerms", 9.0),
            ("relationDeclaringFields", 8.0),
            ("relationConsumerMethods", 8.0),
            ("reconstructedMethods", 7.0),
            ("reconstructedFields", 7.0),
            ("ownerCandidates", 6.0),
            ("ownerFamilyCandidates", 5.0),
            ("ownerToTerms", 5.0),
            ("rawValueTerms", 4.0),
        ):
            for value in owner_inferences.get(key) or []:
                add_candidate(value, base_score)

        ranked_candidates.sort(key=lambda item: (-item[0], item[1]))
        for _, term in ranked_candidates[:limit]:
            frontier_terms.add(term)
        return frontier_terms

    def _build_runtime_dataset(self, execution: dict[str, Any], native_payload: dict[str, Any]) -> dict[str, Any]:
        result = dict(native_payload.get("result") or {})
        managed_graph = dict(result.get("managedGraph") or {})
        term_bridges = dict(result.get("termBridges") or {})
        owner_inferences = dict(result.get("ownerInferences") or {})
        request_signature = str(native_payload.get("requestSignature") or "").strip()
        trace_scope = str(execution.get("traceScope") or "").strip()
        now_iso = datetime.now().isoformat(timespec="microseconds")
        seed_terms = self._seed_frontier_terms(execution)
        frontier_terms = self._expand_frontier_terms(execution, native_payload)
        local_terms: set[str] = set(frontier_terms)
        direct_bridge_matches = self._direct_bridge_match_rows(native_payload)

        node_ids: set[str] = set()
        edges: list[dict[str, Any]] = []
        negative_edges: list[dict[str, Any]] = []
        seen_edge_keys: set[tuple[str, str, str, str]] = set()
        max_local_terms = 48

        def add_local_term(value: str) -> None:
            term = str(value or "").strip()
            if not term or len(local_terms) >= max_local_terms:
                return
            local_terms.add(term)

        for match in direct_bridge_matches:
            self._append_bridge_match_structure(edges, seen_edge_keys, node_ids, match, execution)
            add_local_term(match.get("shellField"))
            add_local_term(match.get("matchedField"))
            for value in match.get("ownerFieldBlock") or []:
                add_local_term(value)
            for value in match.get("controllerBlock") or []:
                add_local_term(value)

        for edge in managed_graph.get("edges") or []:
            if not isinstance(edge, dict):
                continue
            source_id = str(edge.get("from") or "").strip()
            target_id = str(edge.get("to") or "").strip()
            relation_kind = str(edge.get("type") or "").strip()
            if not source_id or not target_id or not relation_kind:
                continue
            if relation_kind not in self._promotable_runtime_relations:
                continue
            if source_id not in frontier_terms and target_id not in frontier_terms:
                continue
            add_local_term(source_id)
            add_local_term(target_id)
            node_ids.add(source_id)
            node_ids.add(target_id)
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=source_id,
                relation_kind=relation_kind,
                target_id=target_id,
                )

        for edge in managed_graph.get("edges") or []:
            if not isinstance(edge, dict):
                continue
            source_id = str(edge.get("from") or "").strip()
            target_id = str(edge.get("to") or "").strip()
            relation_kind = str(edge.get("type") or "").strip()
            if not source_id or not target_id or not relation_kind:
                continue
            if relation_kind not in self._promotable_runtime_relations:
                continue
            if source_id not in local_terms or target_id not in local_terms:
                continue
            node_ids.add(source_id)
            node_ids.add(target_id)
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=source_id,
                relation_kind=relation_kind,
                target_id=target_id,
            )

        requested_terms = [str(value).strip() for value in (native_payload.get("requestedTerms") or []) if str(value).strip()]
        search_terms = [str(value).strip() for value in (native_payload.get("searchTerms") or []) if str(value).strip()]
        for term in requested_terms:
            if term in node_ids:
                continue
            negative_edges.append(
                {
                    "from": str(execution.get("sourceNodeId") or "").strip() or term,
                    "to": term,
                    "type": "graph-extension-miss",
                    "status": "missing",
                    "statement": "graph-extension-miss",
                    "provedBy": [],
                    "provenanceStrength": "native-graph-extension-core",
                }
            )

        row_recovery = self._build_row_recovery(execution, native_payload)
        self._append_row_recovery_runtime_structure(
            edges,
            seen_edge_keys,
            node_ids,
            row_recovery,
            execution,
        )
        nodes = [
            {"id": node_id, "label": node_id}
            for node_id in sorted(node_ids)
        ]
        return {
            "traceRun": {
                "mode": "v2-native-evidence-acquisition",
                "executionCore": self.core_id,
                "traceScope": trace_scope,
                "requestSignature": request_signature,
                "selectedSubjectKind": "v2-native-evidence-acquisition",
                "selectedSeamId": str(execution.get("relationKind") or "").strip(),
                "materializedAt": now_iso,
                "anchorTerms": list(execution.get("selectedAnchors") or []),
                "requestedTerms": requested_terms,
                "dbPersistedChanged": bool(edges),
            },
            "requestedTerms": requested_terms,
            "searchTerms": search_terms,
            "traceKnowledge": {
                "nativeSummary": dict(native_payload.get("summary") or {}),
                "nativeStatus": str(native_payload.get("status") or "").strip(),
                "bridgePlan": dict(native_payload.get("bridgePlan") or {}),
                "reuseReport": dict(native_payload.get("reuseReport") or {}),
                "rowRecovery": row_recovery,
                "executionCore": self.core_id,
            },
            "progressSummary": {
                "status": str(native_payload.get("status") or "").strip(),
                "cacheHit": bool(native_payload.get("cacheHit")),
                "jobId": native_payload.get("jobId"),
            },
            "exactEvidenceSummary": {
                "ownerCandidates": dict(owner_inferences or {}),
                "termBridges": dict(term_bridges or {}),
                "frontierTerms": sorted(frontier_terms),
                "seedTerms": sorted(seed_terms),
                "localNeighborhoodTerms": sorted(local_terms),
            },
            "traceGraph": {
                "nodes": nodes,
                "edges": edges,
                "negativeEdges": negative_edges,
            },
        }

    def _build_row_recovery(self, execution: dict[str, Any], native_payload: dict[str, Any]) -> dict[str, Any]:
        trace_scope = str(execution.get("traceScope") or "").strip()
        family_id = self._infer_family_hint(trace_scope)
        if family_id != "token-shop":
            return {}
        selected_anchors = [
            str(value).strip()
            for value in (execution.get("selectedAnchors") or execution.get("requestedTerms") or [])
            if str(value).strip()
        ]
        requested_terms = [
            str(value).strip()
            for value in (execution.get("requestedTerms") or [])
            if str(value).strip()
        ]
        explicit_shell_candidates = []
        for term in [*selected_anchors, *requested_terms]:
            button_match = re.search(r"\bATU\d+Button\b", term, re.IGNORECASE)
            if button_match:
                explicit_shell_candidates.append(button_match.group(0))
        scope_shell_match = re.search(r"\batu(\d+)\b", trace_scope, re.IGNORECASE)
        preferred_shell_field = (
            explicit_shell_candidates[0]
            if explicit_shell_candidates
            else (f"ATU{scope_shell_match.group(1)}Button" if scope_shell_match else "")
        )
        direct_bridge_matches = self._direct_bridge_match_rows(native_payload)

        def synthesize_row_recovery() -> dict[str, Any]:
            if not preferred_shell_field:
                return {}
            synthetic_value_fields = [
                term
                for term in requested_terms
                if re.search(r"(StartCost|AdditiveCost|Bonus|MaxLevel|Fill)$", term)
            ]
            synthetic_controller_terms = [
                term
                for term in requested_terms
                if term == preferred_shell_field
                or self._is_ui_slot_term(term)
                or term in {
                    "CostBox",
                    "CostText",
                    "DescriptionBox",
                    "DescText",
                    "TokenDescText_TMPro",
                    "LevelText",
                    "ReqText",
                    "TitleBox",
                    "TokenUPGTitleText_TMPro",
                }
            ]
            evaluator_methods = [
                term
                for term in requested_terms
                if term in {
                    "get_cost",
                    "set_cost",
                    "get_costExponent",
                    "set_costExponent",
                    "get_additiveIncrease",
                    "set_additiveIncrease",
                    "get_calculationsType",
                    "set_calculationsType",
                    "get_output",
                    "set_output",
                    "get_finalSetValue",
                    "set_finalSetValue",
                    "CalculateAndSetUpgradeCalculations",
                    "SetCostRelatedAttributes",
                    "BuyAndApplyUpgrade",
                }
            ]
            evaluator_fields = [
                term
                for term in requested_terms
                if term in {
                    "baseCost",
                    "additiveIncrease",
                    "costExponent",
                    "calculationType",
                    "output",
                    "maxLevel",
                    "finalSetValue",
                    "cost",
                }
            ]
            slots: dict[str, list[dict[str, Any]]] = {}
            slot_roles = {
                "CostBox": "cost",
                "CostText": "cost",
                "DescText": "description",
                "TokenDescText_TMPro": "description",
                "DescriptionBox": "description",
                "LevelText": "level",
                "ReqText": "requirement",
                "TitleBox": "title",
                "TokenUPGTitleText_TMPro": "title",
            }
            for term in synthetic_controller_terms:
                role = slot_roles.get(term)
                if not role:
                    continue
                slots.setdefault(role, []).append({"name": term})
            synthetic = {
                "shellField": preferred_shell_field,
                "ownerFieldBlock": list(dict.fromkeys(synthetic_value_fields)),
                "controllerBlock": list(dict.fromkeys([preferred_shell_field, *synthetic_controller_terms])),
                "presentationUpdatePath": {
                    "status": "direct-slot-graph-recovered" if slots else "open",
                    "slots": slots,
                    "interactionNodes": [{"name": "UPGButton"}] if slots else [],
                    "renderNodes": [
                        {"role": role, "name": entry.get("name")}
                        for role, values in slots.items()
                        for entry in values
                    ],
                    "interactionToRenderPaths": [],
                },
                "runtimeEvaluatorRecovery": {
                    "status": "method-chain-recovered-instance-values-open" if evaluator_methods else "",
                    "owner": "ArcadeUpgradeSO" if "ArcadeUpgradeSO" in requested_terms else "",
                    "evaluatorMethods": list(dict.fromkeys(evaluator_methods)),
                    "evaluatorFields": list(dict.fromkeys(evaluator_fields)),
                    "unresolvedInstanceValues": [
                        "costExponent instance value for the selected upgrade object",
                        "calculationType instance value for the selected upgrade object",
                        "finalSetValue instance value for the selected upgrade object",
                        "exact displayed-cost evaluator expression",
                    ],
                    "notes": [
                        "Synthetic row recovery used explicit request-time row and runtime evaluator anchors when raw bridge matching did not yield a stable row shell."
                    ],
                },
                "runtimeInstanceRecovery": {},
                "closureStatus": {
                    "status": "semantic-open",
                    "runtimeStatus": "open",
                    "unresolvedRuntimeTargets": ["displayed-cost-fast-buy-or-runtime-modifiers"],
                },
            }
            self._enrich_runtime_instance_recovery(synthetic, native_payload)
            self._enrich_runtime_semantic_recovery_from_native_summary(synthetic, native_payload)
            self._enrich_runtime_modifier_recovery(synthetic)
            self._enrich_grounded_owner_blob_formula(synthetic)
            return synthetic

        if not direct_bridge_matches:
            return synthesize_row_recovery()
        selected_anchor_tokens: set[str] = set()
        for anchor in selected_anchors:
            selected_anchor_tokens.update(self._term_identity_tokens(anchor))
        selected_match = {}
        selected_match_score = -1
        for match in direct_bridge_matches:
            shell_field = str(match.get("shellField") or "").strip()
            matched_field = str(match.get("matchedField") or "").strip()
            if preferred_shell_field and shell_field == preferred_shell_field:
                selected_match = dict(match)
                break
            owner_terms = {
                str(value).strip()
                for value in (match.get("ownerFieldBlock") or [])
                if str(value).strip()
            }
            if any(anchor in {shell_field, matched_field} or anchor in owner_terms for anchor in selected_anchors):
                selected_match = dict(match)
                break
            candidate_terms = [
                shell_field,
                matched_field,
                *[str(value).strip() for value in (match.get("ownerFieldBlock") or []) if str(value).strip()],
                *[str(value).strip() for value in (match.get("controllerBlock") or []) if str(value).strip()],
            ]
            candidate_tokens: set[str] = set()
            for term in candidate_terms:
                candidate_tokens.update(self._term_identity_tokens(term))
            overlap_score = len(selected_anchor_tokens & candidate_tokens)
            if overlap_score > selected_match_score:
                selected_match = dict(match)
                selected_match_score = overlap_score
        if preferred_shell_field and str(selected_match.get("shellField") or "").strip() != preferred_shell_field:
            synthetic_value_fields = [
                term
                for term in requested_terms
                if re.search(r"(StartCost|AdditiveCost|Bonus|MaxLevel|Fill)$", term)
            ]
            synthetic_controller_terms = [
                term
                for term in requested_terms
                if term == preferred_shell_field
                or self._is_ui_slot_term(term)
                or term in {
                    "CostBox",
                    "CostText",
                    "DescriptionBox",
                    "DescText",
                    "TokenDescText_TMPro",
                    "LevelText",
                    "ReqText",
                    "TitleBox",
                    "TokenUPGTitleText_TMPro",
                }
            ]
            if synthetic_value_fields or synthetic_controller_terms:
                selected_match = {
                    "shellField": preferred_shell_field,
                    "matchedField": synthetic_value_fields[0] if synthetic_value_fields else "",
                    "ownerFieldBlock": list(dict.fromkeys(synthetic_value_fields)),
                    "controllerBlock": list(
                        dict.fromkeys([preferred_shell_field, *synthetic_controller_terms])
                    ),
                    "matchScore": 100,
                    "requestedTerm": selected_anchors[0] if selected_anchors else "",
                    "shellPathId": None,
                }
        if not selected_match:
            selected_match = dict(direct_bridge_matches[0])
        shell_window = {
            "shellField": str(selected_match.get("shellField") or "").strip(),
            "shellPathId": selected_match.get("shellPathId"),
            "ownerFieldBlock": [
                str(value).strip()
                for value in (selected_match.get("ownerFieldBlock") or [])
                if str(value).strip()
            ],
            "controllerBlock": [
                str(value).strip()
                for value in (selected_match.get("controllerBlock") or [])
                if str(value).strip()
            ],
            "window": [
                {"field": str(value).strip()}
                for value in (selected_match.get("controllerBlock") or [])
                if str(value).strip()
            ],
        }
        target = {
            "id": trace_scope or str(execution.get("obligationId") or "").strip(),
            "traceScope": trace_scope,
            "familyId": family_id,
        }
        trace_payload = {
            "shellWindow": shell_window,
            "bridgeCheck": {},
            "surfaces": [],
            "traceGraph": {
                "edges": list(dict(native_payload.get("result") or {}).get("managedGraph", {}).get("edges") or []),
            },
        }
        try:
            legacy_bundle = import_module("unity_trace_bundle")
            builder = getattr(legacy_bundle, "_build_token_shop_row_recovery", None)
            if not callable(builder):
                return synthesize_row_recovery()
            row_recovery = builder(target, trace_payload, native_payload) or {}
        except Exception:
            return synthesize_row_recovery()
        if not isinstance(row_recovery, dict):
            return synthesize_row_recovery()
        if not str(row_recovery.get("shellField") or "").strip():
            merged = synthesize_row_recovery()
            merged.update({key: value for key, value in row_recovery.items() if value})
            row_recovery = merged
        self._enrich_runtime_instance_recovery(row_recovery, native_payload)
        self._enrich_runtime_semantic_recovery_from_native_summary(row_recovery, native_payload)
        self._enrich_runtime_modifier_recovery(row_recovery)
        self._enrich_grounded_owner_blob_formula(row_recovery)
        return row_recovery

    def _append_row_recovery_runtime_structure(
        self,
        edges: list[dict[str, Any]],
        seen_edge_keys: set[tuple[str, str, str, str]],
        node_ids: set[str],
        row_recovery: dict[str, Any],
        execution: dict[str, Any],
    ) -> None:
        recovery = row_recovery if isinstance(row_recovery, dict) else {}
        if not recovery:
            return
        shell_field = str(recovery.get("shellField") or "").strip()
        if shell_field:
            node_ids.add(shell_field)
        presentation_update_path = dict(recovery.get("presentationUpdatePath") or {})
        runtime_evaluator = dict(recovery.get("runtimeEvaluatorRecovery") or {})
        if str(presentation_update_path.get("status") or "").strip() != "direct-slot-graph-recovered":
            return
        slot_names: set[str] = set()
        for slot_entries in (presentation_update_path.get("slots") or {}).values():
            if not isinstance(slot_entries, list):
                continue
            for slot_entry in slot_entries:
                if not isinstance(slot_entry, dict):
                    continue
                slot_name = str(slot_entry.get("name") or "").strip()
                if not slot_name:
                    continue
                slot_names.add(slot_name)
                node_ids.add(slot_name)
                if shell_field:
                    self._append_unique_edge(
                        edges,
                        seen_edge_keys,
                        source_id=shell_field,
                        relation_kind="binds-ui-slot",
                        target_id=slot_name,
                    )
        if not slot_names:
            return
        direct_terms = {
            str(value).strip()
            for value in (
                list(execution.get("selectedAnchors") or [])
                + list(execution.get("requestedTerms") or [])
            )
            if str(value).strip()
        }
        updater_methods = [
            str(value).strip()
            for value in (runtime_evaluator.get("evaluatorMethods") or [])
            if str(value).strip()
            and self._is_updater_term(str(value).strip())
            and str(value).strip() in direct_terms
        ]
        for updater_method in updater_methods:
            node_ids.add(updater_method)
            for slot_name in sorted(slot_names):
                self._append_unique_edge(
                    edges,
                    seen_edge_keys,
                    source_id=updater_method,
                    relation_kind="exact-display-update-path",
                    target_id=slot_name,
                )
        runtime_instance = dict(recovery.get("runtimeInstanceRecovery") or {})
        if str(runtime_instance.get("status") or "").strip() != "instance-layer-recovered-values-open":
            return
        instance_owner = str(runtime_instance.get("instanceOwner") or "").strip()
        if not instance_owner:
            return
        node_ids.add(instance_owner)
        instance_fields = [
            str(value).strip()
            for value in (runtime_instance.get("instanceFields") or [])
            if str(value).strip()
        ]
        instance_accessors = [
            str(value).strip()
            for value in (runtime_instance.get("instanceAccessors") or [])
            if str(value).strip()
        ]
        for field_name in instance_fields:
            node_ids.add(field_name)
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=instance_owner,
                relation_kind="owns-field",
                target_id=field_name,
            )
        field_name_set = set(instance_fields)
        for accessor_name in instance_accessors:
            node_ids.add(accessor_name)
            self._append_unique_edge(
                edges,
                seen_edge_keys,
                source_id=instance_owner,
                relation_kind="owns-method",
                target_id=accessor_name,
            )
            if accessor_name.startswith("get_"):
                field_name = accessor_name[4:]
                if field_name and field_name in field_name_set:
                    self._append_unique_edge(
                        edges,
                        seen_edge_keys,
                        source_id=accessor_name,
                        relation_kind="returns-value-from",
                        target_id=field_name,
                    )

    def _enrich_runtime_instance_recovery(self, row_recovery: dict[str, Any], native_payload: dict[str, Any]) -> None:
        runtime_instance = dict(row_recovery.get("runtimeInstanceRecovery") or {})
        if str(runtime_instance.get("status") or "").strip() == "instance-layer-recovered-values-open":
            return
        bridge_plan = dict(native_payload.get("bridgePlan") or {})
        bridged_terms = {
            str(value).strip()
            for value in (
                list(bridge_plan.get("bridgedTerms") or [])
                + list(native_payload.get("requestedTerms") or [])
                + list(native_payload.get("searchTerms") or [])
            )
            if str(value).strip()
        }
        if not {"CreateUpgradeClass", "Upgrade", "currentIndex"} <= bridged_terms:
            return
        instance_owner = "Upgrade" if "Upgrade" in bridged_terms else None
        selection_key = "currentIndex" if "currentIndex" in bridged_terms else None
        ui_binding_arrays = [
            value
            for value in (
                "upgradeGOInstances",
                "contentBlocks",
                "nameTexts",
                "descriptionsTexts",
                "levelTexts",
                "costTexts",
                "upgradeIcon1",
                "upgradeIcon2",
                "buyButtons",
                "buyAnims",
                "maxedOverlays",
            )
            if value in bridged_terms
        ]
        instance_fields = [
            value
            for value in (
                "index",
                "level",
                "cost",
                "costExponent",
                "additiveIncrease",
                "calculationsType",
                "finalSetValue",
                "output",
                "maxLevel",
                "requirementMet",
                "isUnlocked",
                "upgradeName",
                "description",
            )
            if value in bridged_terms
        ]
        instance_accessors = [
            value
            for value in (
                "get_index",
                "set_index",
                "get_level",
                "set_level",
                "get_upgradeName",
                "set_upgradeName",
                "get_description",
                "set_description",
                "get_cost",
                "set_cost",
                "get_costExponent",
                "set_costExponent",
                "get_additiveIncrease",
                "set_additiveIncrease",
                "get_calculationsType",
                "set_calculationsType",
                "get_output",
                "set_output",
                "get_maxLevel",
                "set_maxLevel",
                "get_finalSetValue",
                "set_finalSetValue",
            )
            if value in bridged_terms
        ]
        if not instance_owner:
            return
        runtime_instance.update(
            {
                "status": "instance-layer-recovered-values-open",
                "instanceOwner": instance_owner,
                "selectionKey": selection_key,
                "creationMethod": "CreateUpgradeClass" if "CreateUpgradeClass" in bridged_terms else None,
                "uiBindingArrays": ui_binding_arrays,
                "instanceFields": instance_fields,
                "instanceAccessors": instance_accessors,
                "likelyInstanceChain": [
                    "CreateUpgradeClass",
                    "Upgrade",
                    "currentIndex",
                    "SetCostRelatedAttributes",
                    "costTexts / CostText",
                ],
                "notes": list(
                    dict.fromkeys(
                        [
                            *[str(value).strip() for value in (runtime_instance.get("notes") or []) if str(value).strip()],
                            "Runtime bridge terms recovered the Upgrade/currentIndex/costTexts instance lane directly from the native trace request neighborhood.",
                        ]
                    )
                ),
            }
        )
        row_recovery["runtimeInstanceRecovery"] = runtime_instance

    def _enrich_runtime_semantic_recovery_from_native_summary(
        self,
        row_recovery: dict[str, Any],
        native_payload: dict[str, Any],
    ) -> None:
        summary = dict(native_payload.get("summary") or {})
        if not summary:
            return
        runtime_evaluator = dict(row_recovery.get("runtimeEvaluatorRecovery") or {})
        runtime_instance = dict(row_recovery.get("runtimeInstanceRecovery") or {})
        requested_terms = {
            str(value).strip()
            for value in (
                list(native_payload.get("requestedTerms") or [])
                + list(native_payload.get("searchTerms") or [])
            )
            if str(value).strip()
        }
        owner_candidates: list[str] = []
        for term_summary in summary.get("termSummaries") or []:
            if not isinstance(term_summary, dict):
                continue
            owner_candidates.extend(
                str(value).strip()
                for value in (term_summary.get("ownerCandidates") or [])
                if str(value).strip()
            )
        reconstructed_owners = [
            str(value).strip()
            for value in (summary.get("reconstructedOwners") or [])
            if str(value).strip()
        ]
        reconstructed_methods = [
            str(value).strip()
            for value in (summary.get("reconstructedMethods") or [])
            if str(value).strip()
        ]
        reconstructed_fields = [
            str(value).strip()
            for value in (summary.get("reconstructedFields") or [])
            if str(value).strip()
        ]
        owner_candidates = list(dict.fromkeys([*owner_candidates, *reconstructed_owners]))
        if owner_candidates:
            runtime_evaluator["ownerCandidates"] = list(
                dict.fromkeys(
                    [
                        *[
                            str(value).strip()
                            for value in (runtime_evaluator.get("ownerCandidates") or [])
                            if str(value).strip()
                        ],
                        *owner_candidates,
                    ]
                )
            )
        if not str(runtime_evaluator.get("owner") or "").strip():
            preferred_owner = next(
                (value for value in owner_candidates if value in {"ArcadeUpgradeSO", "Upgrade"}),
                owner_candidates[0] if owner_candidates else "",
            )
            if preferred_owner:
                runtime_evaluator["owner"] = preferred_owner
        evaluator_methods = list(
            dict.fromkeys(
                [
                    *[
                        str(value).strip()
                        for value in (runtime_evaluator.get("evaluatorMethods") or [])
                        if str(value).strip()
                    ],
                    *[
                        value for value in reconstructed_methods
                        if self._is_getter_term(value) or self._is_updater_term(value) or value in requested_terms
                    ],
                ]
            )
        )
        evaluator_fields = list(
            dict.fromkeys(
                [
                    *[
                        str(value).strip()
                        for value in (runtime_evaluator.get("evaluatorFields") or [])
                        if str(value).strip()
                    ],
                    *[
                        value for value in reconstructed_fields
                        if value in requested_terms
                        or value in {"cost", "costExponent", "additiveIncrease", "calculationType", "calculationsType", "finalSetValue", "maxLevel", "output"}
                    ],
                ]
            )
        )
        if evaluator_methods:
            runtime_evaluator["evaluatorMethods"] = evaluator_methods
        if evaluator_fields:
            runtime_evaluator["evaluatorFields"] = evaluator_fields
        if owner_candidates or evaluator_methods or evaluator_fields:
            if not str(runtime_evaluator.get("status") or "").strip():
                runtime_evaluator["status"] = "method-chain-recovered-instance-values-open"
            unresolved_instance_values = [
                str(value).strip()
                for value in (runtime_evaluator.get("unresolvedInstanceValues") or [])
                if str(value).strip()
            ]
            if not unresolved_instance_values:
                runtime_evaluator["unresolvedInstanceValues"] = [
                    "costExponent instance value for the selected upgrade object",
                    "calculationType instance value for the selected upgrade object",
                    "finalSetValue instance value for the selected upgrade object",
                    "exact displayed-cost evaluator expression",
                ]
        row_recovery["runtimeEvaluatorRecovery"] = runtime_evaluator

        if not str(runtime_instance.get("instanceOwner") or "").strip() and (
            "Upgrade" in requested_terms or "Upgrade" in owner_candidates
        ):
            runtime_instance["instanceOwner"] = "Upgrade"
        if not str(runtime_instance.get("creationMethod") or "").strip() and (
            "CreateUpgradeClass" in requested_terms or "CreateUpgradeClass" in reconstructed_methods
        ):
            runtime_instance["creationMethod"] = "CreateUpgradeClass"
        if not str(runtime_instance.get("selectionKey") or "").strip() and "currentIndex" in requested_terms:
            runtime_instance["selectionKey"] = "currentIndex"
        instance_fields = list(
            dict.fromkeys(
                [
                    *[
                        str(value).strip()
                        for value in (runtime_instance.get("instanceFields") or [])
                        if str(value).strip()
                    ],
                    *[
                        value for value in evaluator_fields
                        if value in {"cost", "costExponent", "additiveIncrease", "calculationType", "calculationsType", "finalSetValue", "maxLevel", "output"}
                    ],
                ]
            )
        )
        instance_accessors = list(
            dict.fromkeys(
                [
                    *[
                        str(value).strip()
                        for value in (runtime_instance.get("instanceAccessors") or [])
                        if str(value).strip()
                    ],
                    *[value for value in evaluator_methods if value.startswith(("get_", "set_"))],
                ]
            )
        )
        if instance_fields:
            runtime_instance["instanceFields"] = instance_fields
        if instance_accessors:
            runtime_instance["instanceAccessors"] = instance_accessors
        if not runtime_instance.get("uiBindingArrays"):
            ui_binding_arrays = [value for value in ("costTexts", "levelTexts") if value in requested_terms]
            if ui_binding_arrays:
                runtime_instance["uiBindingArrays"] = ui_binding_arrays
        if (
            runtime_instance.get("instanceOwner")
            and (
                runtime_instance.get("creationMethod")
                or runtime_instance.get("selectionKey")
                or instance_fields
                or instance_accessors
            )
        ):
            runtime_instance["status"] = "instance-layer-recovered-values-open"
        row_recovery["runtimeInstanceRecovery"] = runtime_instance

    def _build_grounded_fast_buy_recovery(self) -> dict[str, Any]:
        try:
            legacy_bundle = import_module("unity_trace_bundle")
            get_unity_search_index = getattr(legacy_bundle, "get_unity_search_index", None)
            get_unity_raw_string_index = getattr(legacy_bundle, "get_unity_raw_string_index", None)
            build_hierarchy_path = getattr(legacy_bundle, "build_unity_gameobject_hierarchy_path", None)
            find_cached_native_trace = getattr(legacy_bundle, "find_cached_native_trace", None)
            if not callable(get_unity_search_index) or not callable(get_unity_raw_string_index):
                return {"status": "fast-buy-candidates-unresolved"}
            search_index = get_unity_search_index(["level0"]).get("level0", [])
            fast_buy_objects: list[dict[str, Any]] = []
            bulk_buy_objects: list[dict[str, Any]] = []
            for entry in search_index:
                name_match = next(
                    (
                        str(surface.get("surfaceValue") or "")
                        for surface in entry.get("surfaces", []) or []
                        if str(surface.get("surfaceType") or "") == "object-name"
                    ),
                    "",
                )
                if not name_match:
                    continue
                if "FastBuyButton" not in name_match and "BulkBuyButton" not in name_match:
                    continue
                path_id = int(entry.get("pathId"))
                target_bucket = fast_buy_objects if "FastBuyButton" in name_match else bulk_buy_objects
                target_bucket.append(
                    {
                        "pathId": path_id,
                        "name": name_match,
                        "hierarchyPath": (
                            build_hierarchy_path(path_id, source_asset_name="level0")
                            if callable(build_hierarchy_path)
                            else None
                        ),
                    }
                )
            raw_entries = get_unity_raw_string_index(["level0"]).get("level0", [])
            raw_string_hits = [
                entry["value"]
                for entry in raw_entries
                if isinstance(entry.get("value"), str)
                and entry["value"] in {
                    "BUY x10",
                    "MaxOverlay.FastBuyButton",
                    "FastBuyButtonMethodGear",
                    "FastBuyButtonMethodShards",
                    "StartFastBuyButtonHold",
                    "AttachFastBuyButton",
                }
            ]
            native_terms = {
                "ownerCandidates": [],
                "methodCandidates": [],
                "fieldCandidates": [],
                "contextStrings": [],
                "jobIds": [],
            }
            if callable(find_cached_native_trace):
                for term in ("StartFastBuyButtonHold", "AttachFastBuyButton"):
                    cached = find_cached_native_trace([term], family_hint=None)
                    if not cached:
                        continue
                    native_terms["jobIds"].append(cached.get("jobId"))
                    bridge = ((cached.get("result") or {}).get("termBridges") or {}).get(term, {}) or {}
                    search_expansion = bridge.get("searchExpansion") or {}
                    native_terms["ownerCandidates"].extend(search_expansion.get("ownerCandidates", []) or [])
                    native_terms["methodCandidates"].extend(search_expansion.get("methodCandidates", []) or [])
                    native_terms["fieldCandidates"].extend(search_expansion.get("fieldCandidates", []) or [])
                    native_terms["contextStrings"].extend(search_expansion.get("contextStrings", []) or [])
            for key in ("ownerCandidates", "methodCandidates", "fieldCandidates", "contextStrings"):
                native_terms[key] = list(
                    dict.fromkeys(
                        str(value).strip()
                        for value in native_terms[key]
                        if str(value).strip()
                    )
                )
            native_terms["jobIds"] = list(dict.fromkeys(job_id for job_id in native_terms["jobIds"] if job_id))
            status = (
                "fast-buy-candidates-recovered"
                if (fast_buy_objects or bulk_buy_objects or raw_string_hits or native_terms["jobIds"])
                else "fast-buy-candidates-unresolved"
            )
            return {
                "status": status,
                "fastBuyObjects": fast_buy_objects,
                "bulkBuyObjects": bulk_buy_objects,
                "rawStringHits": list(dict.fromkeys(raw_string_hits)),
                "nativeTerms": native_terms,
                "notes": [
                    "Fast-buy controls are grounded from level0 object names, raw level0 strings, and cached native trace expansion for StartFastBuyButtonHold/AttachFastBuyButton.",
                    "This is still a modifier-side candidate lane until the runtime evaluator ties it to the selected token-shop row.",
                ],
            }
        except Exception:
            return {"status": "fast-buy-candidates-unresolved"}

    def _fast_buy_evidence_is_row_local(self, row_recovery: dict[str, Any], fast_buy_recovery: dict[str, Any]) -> bool:
        shell_field = str((row_recovery or {}).get("shellField") or "").strip()
        owner_terms = [
            str(value).strip()
            for value in ((row_recovery or {}).get("ownerFieldBlock") or [])
            if str(value).strip()
        ]
        shell_tokens = set()
        for value in [shell_field, *owner_terms]:
            shell_tokens.update(self._term_identity_tokens(value))
        if shell_field:
            shell_tokens.add(shell_field.lower())
        hierarchy_paths = [
            str(item.get("hierarchyPath") or "").strip()
            for item in (
                list((fast_buy_recovery or {}).get("fastBuyObjects") or [])
                + list((fast_buy_recovery or {}).get("bulkBuyObjects") or [])
            )
            if isinstance(item, dict) and str(item.get("hierarchyPath") or "").strip()
        ]
        if not hierarchy_paths:
            return False
        lowered_paths = [path.lower() for path in hierarchy_paths]
        global_noise_markers = ("shards", "academy", "loopmod", "researchmenu", "gearmenu")
        if all(any(marker in path for marker in global_noise_markers) for path in lowered_paths):
            return False
        for path in lowered_paths:
            if any(token and token in path for token in shell_tokens):
                return True
        return False

    def _build_grounded_global_modifier_recovery(self) -> dict[str, Any]:
        try:
            legacy_bundle = import_module("unity_trace_bundle")
            find_cached_native_trace = getattr(legacy_bundle, "find_cached_native_trace", None)
            if not callable(find_cached_native_trace):
                return {"status": "global-modifier-candidates-unresolved"}
            cached_terms: dict[str, dict[str, Any]] = {}
            for term in ("FinalUltimaMP", "get_FinalUltimaMP", "TotalSetMPBonus", "get_TotalSetMPBonus"):
                cached = find_cached_native_trace([term], family_hint=None)
                if cached:
                    cached_terms[term] = cached
            candidate_methods: list[str] = []
            candidate_fields: list[str] = []
            candidate_owners: list[str] = []
            context_strings: list[str] = []
            for term, cached in cached_terms.items():
                summary = cached.get("summary") or {}
                candidate_methods.extend(summary.get("reconstructedMethods", []) or [])
                candidate_fields.extend(summary.get("reconstructedFields", []) or [])
                candidate_owners.extend(summary.get("reconstructedOwners", []) or [])
                candidate_owners.extend(str(owner).strip() for owner in (summary.get("ownerToTerms") or {}).keys())
                bridge = ((cached.get("result") or {}).get("termBridges") or {}).get(term, {}) or {}
                search_expansion = bridge.get("searchExpansion") or {}
                candidate_owners.extend(search_expansion.get("ownerCandidates", []) or [])
                context_strings.extend(search_expansion.get("contextStrings", []) or [])
            def _uniq(values: list[Any]) -> list[str]:
                return list(dict.fromkeys(str(value).strip() for value in values if str(value).strip()))
            return {
                "status": "global-modifier-candidates-recovered" if cached_terms else "global-modifier-candidates-unresolved",
                "candidateTerms": list(cached_terms.keys()),
                "candidateOwners": _uniq(candidate_owners),
                "candidateMethods": _uniq(candidate_methods),
                "candidateFields": _uniq(candidate_fields),
                "contextStrings": _uniq(context_strings),
                "notes": [
                    "Global modifier candidates are grounded from cached native traces on FinalUltimaMP and TotalSetMPBonus.",
                    "These stay modifier-side suspects until the runtime evaluator connects them to the selected token-shop row.",
                ],
            }
        except Exception:
            return {"status": "global-modifier-candidates-unresolved"}

    def _enrich_runtime_modifier_recovery(self, row_recovery: dict[str, Any]) -> None:
        fast_buy_recovery = dict(row_recovery.get("fastBuyRecovery") or {})
        global_modifier_recovery = dict(row_recovery.get("globalModifierRecovery") or {})
        if not fast_buy_recovery:
            fast_buy_recovery = self._build_grounded_fast_buy_recovery()
        if not global_modifier_recovery:
            global_modifier_recovery = self._build_grounded_global_modifier_recovery()
        if fast_buy_recovery:
            row_recovery["fastBuyRecovery"] = fast_buy_recovery
        if global_modifier_recovery:
            row_recovery["globalModifierRecovery"] = global_modifier_recovery
        fast_buy_row_local = self._fast_buy_evidence_is_row_local(row_recovery, fast_buy_recovery)
        fast_buy_status = str(fast_buy_recovery.get("status") or "").strip()
        if fast_buy_status == "fast-buy-candidates-recovered":
            if fast_buy_row_local:
                fast_buy_recovery["status"] = "fast-buy-candidates-row-local"
            else:
                fast_buy_recovery["status"] = "fast-buy-candidates-global-only"
            notes = [
                str(value).strip()
                for value in (fast_buy_recovery.get("notes") or [])
                if str(value).strip()
            ]
            if fast_buy_row_local:
                notes.append(
                    "Recovered fast-buy controls overlap the current row authority closely enough to keep them as row-local runtime quantity candidates."
                )
            else:
                notes.append(
                    "Recovered fast-buy controls do not overlap the current token-shop row hierarchy, so they remain global UI evidence and are not treated as row-local runtime cost inputs."
                )
            fast_buy_recovery["notes"] = list(dict.fromkeys(notes))
            row_recovery["fastBuyRecovery"] = fast_buy_recovery
        closure_status = dict(row_recovery.get("closureStatus") or {})
        unresolved_targets = [
            str(value).strip()
            for value in (closure_status.get("unresolvedRuntimeTargets") or [])
            if str(value).strip()
        ]
        specific_targets: list[str] = []
        if str(fast_buy_recovery.get("status") or "").strip() == "fast-buy-candidates-row-local":
            specific_targets.append("fast-buy-runtime-quantity")
        if str(global_modifier_recovery.get("status") or "").strip() == "global-modifier-candidates-recovered":
            specific_targets.append("set-wide-cost-modifiers")
        runtime_evaluator = dict(row_recovery.get("runtimeEvaluatorRecovery") or {})
        unresolved_instance_values = [
            str(value).strip().lower()
            for value in (runtime_evaluator.get("unresolvedInstanceValues") or [])
            if str(value).strip()
        ]
        if any(
            any(marker in value for marker in ("costexponent", "calculationtype", "finalsetvalue", "displayed-cost"))
            for value in unresolved_instance_values
        ):
            specific_targets.append("runtime-evaluator-instance-formula")
        if specific_targets:
            unresolved_targets = [
                value for value in unresolved_targets
                if value != "displayed-cost-fast-buy-or-runtime-modifiers"
            ]
            unresolved_targets.extend(specific_targets)
            closure_status["status"] = "semantic-open"
            closure_status["runtimeStatus"] = "open"
            closure_status["unresolvedRuntimeTargets"] = list(dict.fromkeys(unresolved_targets))
            row_recovery["closureStatus"] = closure_status

    def _resolve_level0_shell_path_id(self, shell_field: str) -> int | None:
        shell_name = str(shell_field or "").strip()
        if not shell_name:
            return None
        try:
            legacy_bundle = import_module("unity_trace_bundle")
            get_unity_search_index = getattr(legacy_bundle, "get_unity_search_index", None)
            if not callable(get_unity_search_index):
                return None
            for entry in get_unity_search_index(["level0"]).get("level0", []):
                if not isinstance(entry, dict):
                    continue
                if str(entry.get("name") or "").strip() != shell_name:
                    continue
                path_id = entry.get("pathId")
                if isinstance(path_id, int):
                    return path_id
        except Exception:
            pass
        try:
            token_shop_values_path = Path(__file__).resolve().parents[2] / "data" / "archive" / "token-shop-values.json"
            if token_shop_values_path.exists():
                payload = json.loads(token_shop_values_path.read_text(encoding="utf-8"))
                for entry in payload.get("fields", []):
                    if not isinstance(entry, dict):
                        continue
                    if str(entry.get("field") or "").strip() != shell_name:
                        continue
                    path_id = entry.get("path_id")
                    if isinstance(path_id, int):
                        return path_id
        except Exception:
            pass
        return None

    def _enrich_grounded_owner_blob_formula(self, row_recovery: dict[str, Any]) -> None:
        shell_field = str((row_recovery or {}).get("shellField") or "").strip()
        if not shell_field:
            return
        shell_path_id = self._resolve_level0_shell_path_id(shell_field)
        if shell_path_id is None:
            return
        try:
            legacy_bundle = import_module("unity_trace_bundle")
            build_token_shop_owner_blob_row = getattr(legacy_bundle, "build_token_shop_owner_blob_row", None)
            build_token_shop_owner_modifier_scan = getattr(legacy_bundle, "build_token_shop_owner_modifier_scan", None)
            build_formula_reconstruction = getattr(legacy_bundle, "build_formula_reconstruction", None)
            if not callable(build_token_shop_owner_blob_row) or not callable(build_token_shop_owner_modifier_scan) or not callable(build_formula_reconstruction):
                return
            owner_blob_row = build_token_shop_owner_blob_row(shell_path_id) or {}
            owner_modifier_scan = build_token_shop_owner_modifier_scan(owner_blob_row) or {}
            presentation_update_path = dict(row_recovery.get("presentationUpdatePath") or {})
            presentation_objects: list[dict[str, Any]] = []
            for role, slot_entries in (presentation_update_path.get("slots") or {}).items():
                if not isinstance(slot_entries, list):
                    continue
                for slot_entry in slot_entries:
                    if not isinstance(slot_entry, dict):
                        continue
                    slot_name = str(slot_entry.get("name") or "").strip()
                    if slot_name:
                        presentation_objects.append({"name": slot_name, "role": str(role or "").strip()})
            formula_reconstruction = build_formula_reconstruction(
                [],
                presentation_objects,
                None,
                owner_blob_row,
                owner_modifier_scan,
            ) or {}
            if formula_reconstruction:
                existing_formula = dict(row_recovery.get("formulaReconstruction") or {})
                grounded_constants = dict(existing_formula.get("groundedConstants") or {})
                grounded_constants.update(
                    {
                        key: value
                        for key, value in dict(formula_reconstruction.get("groundedConstants") or {}).items()
                        if value is not None
                    }
                )
                existing_formula.update(formula_reconstruction)
                existing_formula["groundedConstants"] = grounded_constants
                row_recovery["formulaReconstruction"] = existing_formula
            if owner_blob_row:
                row_recovery["ownerBlobRow"] = owner_blob_row
            if owner_modifier_scan:
                row_recovery["ownerModifierScan"] = owner_modifier_scan
        except Exception:
            return

    def write_export_artifacts(self, dataset: dict[str, Any], *, json_out: Path, md_out: Path) -> None:
        json_out.parent.mkdir(parents=True, exist_ok=True)
        json_out.write_text(json.dumps(dataset, ensure_ascii=False, indent=2), encoding="utf-8")
        trace_run = dict(dataset.get("traceRun") or {})
        trace_scope = str(trace_run.get("traceScope") or "").strip() or "unknown-scope"
        anchors = ", ".join(trace_run.get("anchorTerms") or []) or "none"
        md_out.write_text(
            "\n".join(
                [
                    f"# V2 Native Trace",
                    "",
                    f"- Scope: `{trace_scope}`",
                    f"- Anchors: `{anchors}`",
                    f"- Request signature: `{trace_run.get('requestSignature') or ''}`",
                    f"- Mode: `{trace_run.get('mode') or ''}`",
                ]
            ),
            encoding="utf-8",
        )

    def run(
        self,
        execution: dict[str, Any],
        *,
        json_out: Path,
        md_out: Path,
        level: str,
        native_timeout: int,
        force: bool,
        profile_timing: bool,
    ) -> ExecutionCoreResultV2:
        if not self.can_handle(execution):
            return ExecutionCoreResultV2(
                core_id=self.core_id,
                return_code=1,
                runtime_dataset={},
                stdout_text="",
                stderr_text="unsupported execution for native evidence acquisition core",
                handled=False,
            )
        selected_anchors = [
            str(value).strip()
            for value in (execution.get("selectedAnchors") or execution.get("requestedTerms") or [])
            if str(value).strip()
        ]
        native_payload = collect_native_trace(
            selected_anchors,
            timeout=int(native_timeout),
            family_hint=self._infer_family_hint(str(execution.get("traceScope") or "").strip()),
            request_context=self._build_request_context(execution),
            force_retrace=bool(force),
        )
        runtime_dataset = self._build_runtime_dataset(execution, native_payload)
        self.write_export_artifacts(runtime_dataset, json_out=json_out, md_out=md_out)
        return ExecutionCoreResultV2(
            core_id=self.core_id,
            return_code=0,
            runtime_dataset=runtime_dataset,
            stdout_text="V2 native evidence acquisition execution completed.",
            stderr_text="",
            handled=True,
        )
