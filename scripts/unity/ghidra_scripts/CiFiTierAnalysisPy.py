## ###
#  IP: GHIDRA
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
##
# Repo-local headless extraction script for CiFi.
#@category Examples.Python
#@runtime Jython

import json
import re
import time
from ghidra.program.model.scalar import Scalar


args = getScriptArgs()
output_file = args[0] if len(args) > 0 else "tier_analysis.json"
marker_file = args[1] if len(args) > 1 else output_file + ".done"
search_csv = args[2] if len(args) > 2 else ""
search_terms = []
if len(args) > 2:
    search_terms = [term for term in args[2:] if term]
elif search_csv:
    search_terms = [term for term in search_csv.split(",") if term]

def normalize_text(value):
    return re.sub(r"[^a-z0-9]+", "", value.lower())

def split_term_tokens(value):
    pieces = re.split(r"[^A-Za-z0-9]+", value)
    tokens = []
    for piece in pieces:
        if not piece:
            continue
        parts = re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+", piece)
        for part in parts:
            token = part.strip()
            if len(token) >= 3:
                tokens.append(token)
    return tokens

def collect_string_hits(terms):
    hits = {}
    memory = currentProgram.getMemory()
    for term in terms:
        refs = []
        pattern = term.encode("ascii")
        for block in memory.getBlocks():
            if not block.isInitialized():
                continue
            try:
                addr = memory.findBytes(block.getStart(), pattern, None, True, monitor)
                while addr is not None and addr.compareTo(block.getEnd()) <= 0 and len(refs) < 10:
                    refs.append({
                        "block": block.getName(),
                        "address": str(addr)
                    })
                    next_addr = addr.add(1)
                    if next_addr.compareTo(block.getEnd()) > 0:
                        break
                    addr = memory.findBytes(next_addr, pattern, None, True, monitor)
            except:
                pass
            if len(refs) >= 10:
                break
        if len(refs) > 0:
            hits[term] = refs
    return hits

def collect_function_details(function):
    callers = []
    callees = []
    scalar_constants = []
    mnemonics = []
    try:
        for caller in function.getCallingFunctions(monitor):
            callers.append({
                "name": caller.getName(),
                "entry": str(caller.getEntryPoint()),
            })
            if len(callers) >= 8:
                break
    except:
        pass

    try:
        for callee in function.getCalledFunctions(monitor):
            callees.append({
                "name": callee.getName(),
                "entry": str(callee.getEntryPoint()),
            })
            if len(callees) >= 8:
                break
    except:
        pass

    try:
        listing = currentProgram.getListing()
        iterator = listing.getInstructions(function.getBody(), True)
        seen_scalars = set()
        while iterator.hasNext():
            instruction = iterator.next()
            mnemonic = instruction.getMnemonicString()
            if mnemonic not in mnemonics:
                mnemonics.append(mnemonic)
            for op_index in range(instruction.getNumOperands()):
                objects = instruction.getOpObjects(op_index)
                for obj in objects:
                    if isinstance(obj, Scalar):
                        value = "0x%x" % obj.getValue()
                        if value in seen_scalars:
                            continue
                        seen_scalars.add(value)
                        scalar_constants.append(value)
                        if len(scalar_constants) >= 12:
                            break
                if len(scalar_constants) >= 12:
                    break
            if len(scalar_constants) >= 12 and len(mnemonics) >= 12:
                break
    except:
        pass

    return {
        "callers": callers,
        "callees": callees,
        "scalarConstants": scalar_constants,
        "mnemonics": mnemonics[:12],
    }


def function_summary(function):
    summary = {
        "name": function.getName(),
        "entry": str(function.getEntryPoint()),
        "bodyMin": str(function.getBody().getMinAddress()),
        "bodyMax": str(function.getBody().getMaxAddress()),
    }
    details = collect_function_details(function)
    summary.update(details)
    return summary

def collect_symbol_function_matches(terms):
    direct_matches = {}
    fuzzy_matches = {}
    function_manager = currentProgram.getFunctionManager()
    iterator = function_manager.getFunctions(True)
    total_functions = 0

    prepared = []
    for term in terms:
        prepared.append({
            "term": term,
            "normalized": normalize_text(term),
            "tokens": [token.lower() for token in split_term_tokens(term)],
        })

    while iterator.hasNext():
        function = iterator.next()
        total_functions += 1
        name = function.getName()
        normalized_name = normalize_text(name)
        lower_name = name.lower()
        name_tokens = [token.lower() for token in split_term_tokens(name)]

        for prepared_term in prepared:
            term = prepared_term["term"]
            direct_bucket = direct_matches.setdefault(term, [])
            fuzzy_bucket = fuzzy_matches.setdefault(term, [])
            is_direct = prepared_term["normalized"] and prepared_term["normalized"] in normalized_name
            token_overlap = [token for token in prepared_term["tokens"] if token in name_tokens or token in lower_name]

            if is_direct and len(direct_bucket) < 12:
                direct_bucket.append(function_summary(function))
                continue

            if token_overlap:
                min_overlap = 1 if len(prepared_term["tokens"]) <= 1 else 2
                if len(token_overlap) >= min_overlap and len(fuzzy_bucket) < 12:
                    item = function_summary(function)
                    item["matchedTokens"] = token_overlap
                    fuzzy_bucket.append(item)

    return direct_matches, fuzzy_matches, total_functions

def collect_ref_functions(string_hits):
    bridge_functions = {}
    reference_manager = currentProgram.getReferenceManager()
    function_manager = currentProgram.getFunctionManager()

    for term, refs in string_hits.items():
        functions = []
        seen = set()
        for ref in refs:
            address_text = ref.get("address")
            if not address_text:
                continue
            try:
                address = toAddr(address_text)
            except:
                continue

            iterator = reference_manager.getReferencesTo(address)
            while iterator.hasNext() and len(functions) < 12:
                xref = iterator.next()
                from_address = xref.getFromAddress()
                function = function_manager.getFunctionContaining(from_address)
                if function is None:
                    continue
                key = str(function.getEntryPoint())
                if key in seen:
                    continue
                seen.add(key)
                item = function_summary(function)
                item["referenceFrom"] = str(from_address)
                functions.append(item)

        if functions:
            bridge_functions[term] = functions

    return bridge_functions

def merge_function_buckets(*buckets):
    merged = {}
    for bucket in buckets:
        for term, functions in bucket.items():
            current = merged.setdefault(term, [])
            seen = set([item.get("entry") for item in current])
            for function in functions:
                key = function.get("entry")
                if key in seen:
                    continue
                seen.add(key)
                current.append(function)
    return merged

def classify_term_bridge(term, string_hits, direct_matches, fuzzy_matches, ref_functions):
    metadata_hits = len(string_hits.get(term, []))
    direct_count = len(direct_matches.get(term, []))
    fuzzy_count = len(fuzzy_matches.get(term, []))
    ref_count = len(ref_functions.get(term, []))
    managed_like = term.startswith("get_") or term.startswith("set_") or ("." in term) or term[:1].isupper()

    if metadata_hits and ref_count:
        kind = "string-xref-bridge"
        note = "String hit survived in program memory and referenced functions were recovered."
    elif direct_count:
        kind = "native-symbol-match"
        note = "One or more native functions matched the requested term directly."
    elif fuzzy_count:
        kind = "token-bridge"
        note = "No direct symbol match, but token-overlap native candidates were recovered."
    elif metadata_hits and managed_like:
        kind = "metadata-only"
        note = "Managed identifier was found as a string, but no native xref or symbol bridge was recovered."
    else:
        kind = "unresolved"
        note = "No native bridge was recovered for this term."

    return {
        "term": term,
        "managedLike": managed_like,
        "metadataStringHitCount": metadata_hits,
        "directSymbolMatchCount": direct_count,
        "fuzzySymbolMatchCount": fuzzy_count,
        "referenceFunctionCount": ref_count,
        "bridgeKind": kind,
        "note": note,
    }

string_hits = collect_string_hits(search_terms)
direct_function_matches, fuzzy_function_matches, function_count = collect_symbol_function_matches(search_terms)
reference_functions = collect_ref_functions(string_hits)
term_bridges = {}
for term in search_terms:
    term_bridges[term] = classify_term_bridge(
        term,
        string_hits,
        direct_function_matches,
        fuzzy_function_matches,
        reference_functions,
    )

result = {
    "binary": currentProgram.getName(),
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "strings": string_hits,
    "functions": merge_function_buckets(direct_function_matches, reference_functions),
    "fuzzyFunctions": fuzzy_function_matches,
    "referenceFunctions": reference_functions,
    "termBridges": term_bridges,
    "functionCount": function_count,
    "errors": [],
}

handle = open(output_file, "w")
try:
    handle.write(json.dumps(result, indent=2))
finally:
    handle.close()

marker = open(marker_file, "w")
try:
    marker.write("completed")
finally:
    marker.close()

print "CiFiTierAnalysisPy wrote " + output_file
