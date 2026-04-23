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
# Raw single-term dump for inspecting what Ghidra headless returns before
# repo-side bridge/reconstruction filtering.
#@category Examples.Python
#@runtime Jython

import json
import re
import time
from ghidra.program.model.scalar import Scalar


args = getScriptArgs()
output_file = args[0] if len(args) > 0 else "raw_term_dump.json"
marker_file = args[1] if len(args) > 1 else output_file + ".done"
search_terms = [term for term in args[2:] if term]


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
            if token:
                tokens.append(token)
    return tokens


def collect_instruction_preview(function, max_instructions=80):
    preview = []
    try:
        listing = currentProgram.getListing()
        iterator = listing.getInstructions(function.getBody(), True)
        count = 0
        while iterator.hasNext() and count < max_instructions:
            instruction = iterator.next()
            preview.append({
                "address": str(instruction.getAddress()),
                "text": str(instruction),
            })
            count += 1
    except:
        pass
    return preview


def collect_function_details(function):
    callers = []
    callees = []
    scalar_constants = []
    mnemonics = []
    instruction_preview = collect_instruction_preview(function)
    try:
        for caller in function.getCallingFunctions(monitor):
            callers.append({
                "name": caller.getName(),
                "entry": str(caller.getEntryPoint()),
            })
    except:
        pass

    try:
        for callee in function.getCalledFunctions(monitor):
            callees.append({
                "name": callee.getName(),
                "entry": str(callee.getEntryPoint()),
            })
    except:
        pass

    try:
        listing = currentProgram.getListing()
        iterator = listing.getInstructions(function.getBody(), True)
        seen_scalars = set()
        seen_mnemonics = set()
        while iterator.hasNext():
            instruction = iterator.next()
            mnemonic = instruction.getMnemonicString()
            if mnemonic not in seen_mnemonics:
                seen_mnemonics.add(mnemonic)
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
    except:
        pass

    return {
        "callers": callers,
        "callees": callees,
        "scalarConstants": scalar_constants,
        "mnemonics": mnemonics,
        "instructionPreview": instruction_preview,
    }


def function_summary(function):
    summary = {
        "name": function.getName(),
        "entry": str(function.getEntryPoint()),
        "bodyMin": str(function.getBody().getMinAddress()),
        "bodyMax": str(function.getBody().getMaxAddress()),
        "signature": function.getSignature().getPrototypeString(),
    }
    summary.update(collect_function_details(function))
    return summary


def collect_string_hits(term):
    hits = []
    memory = currentProgram.getMemory()
    pattern = term.encode("ascii")
    for block in memory.getBlocks():
        if not block.isInitialized():
            continue
        try:
            addr = memory.findBytes(block.getStart(), pattern, None, True, monitor)
            while addr is not None and addr.compareTo(block.getEnd()) <= 0:
                hits.append({
                    "block": block.getName(),
                    "address": str(addr),
                })
                next_addr = addr.add(1)
                if next_addr.compareTo(block.getEnd()) > 0:
                    break
                addr = memory.findBytes(next_addr, pattern, None, True, monitor)
        except:
            pass
    return hits


def collect_references_for_hits(hits):
    reference_manager = currentProgram.getReferenceManager()
    function_manager = currentProgram.getFunctionManager()
    references = []
    for hit in hits:
        address_text = hit.get("address")
        if not address_text:
            continue
        try:
            address = toAddr(address_text)
        except:
            continue
        iterator = reference_manager.getReferencesTo(address)
        while iterator.hasNext():
            xref = iterator.next()
            from_address = xref.getFromAddress()
            function = function_manager.getFunctionContaining(from_address)
            references.append({
                "toAddress": address_text,
                "fromAddress": str(from_address),
                "referenceType": str(xref.getReferenceType()),
                "operandIndex": xref.getOperandIndex(),
                "isPrimary": xref.isPrimary(),
                "containingFunction": function_summary(function) if function is not None else None,
            })
    return references


def collect_symbol_matches(term):
    direct_matches = []
    fuzzy_matches = []
    function_manager = currentProgram.getFunctionManager()
    iterator = function_manager.getFunctions(True)
    normalized_term = normalize_text(term)
    prepared_tokens = [token.lower() for token in split_term_tokens(term)]

    while iterator.hasNext():
        function = iterator.next()
        name = function.getName()
        normalized_name = normalize_text(name)
        lower_name = name.lower()
        name_tokens = [token.lower() for token in split_term_tokens(name)]
        if normalized_term and normalized_term in normalized_name:
            direct_matches.append(function_summary(function))
            continue
        matched_tokens = [token for token in prepared_tokens if token in name_tokens or token in lower_name]
        if matched_tokens:
            item = function_summary(function)
            item["matchedTokens"] = matched_tokens
            fuzzy_matches.append(item)

    return {
        "direct": direct_matches,
        "fuzzy": fuzzy_matches,
    }


result = {
    "binary": currentProgram.getName(),
    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
    "searchTerms": search_terms,
    "functionCount": currentProgram.getFunctionManager().getFunctionCount(),
    "terms": {},
    "errors": [],
}

for term in search_terms:
    string_hits = collect_string_hits(term)
    symbol_matches = collect_symbol_matches(term)
    references = collect_references_for_hits(string_hits)
    result["terms"][term] = {
        "stringHits": string_hits,
        "references": references,
        "symbolMatches": symbol_matches,
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

print "CiFiRawTermDumpPy wrote " + output_file
