#!/usr/bin/env python3
"""
Check token-shop-values.json for formula-related fields
"""

import json

with open('data/token-shop-values.json', 'r') as f:
    data = json.load(f)

fields = data.get('fields', [])

formula_keywords = ['Exponent', 'Growth', 'Multiplier', 'Factor', 'Curve', 'Power', 'Scale', 'Rate', 'Step']

print('=== Fields that might be formula-related ===')
for f in fields:
    name = f.get('field', '')
    for kw in formula_keywords:
        if kw.lower() in name.lower():
            print(f"  {name}: offset={f.get('object_offset')}, value={f.get('value')}")

# Also print all unique field name suffixes to see pattern
print('\n=== Field name with Cost ===')
for f in fields:
    name = f.get('field', '')
    if 'Cost' in name:
        print(f"  {name}")