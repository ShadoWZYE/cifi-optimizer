import json
import re

# Compile complete canonical dataset - FIXED VERSION
# Sources:
# 1. uabea-probe-report.json - exact field offsets and method RVAs (ground truth)
# 2. tokenshop-cost-model.json - extracted cost/bonus values per ATU
# 3. tokenshop-model-recovery.json - verified formulas

uabea_report = json.load(open('data/uabea-probe-report.json'))
cost_model = json.load(open('data/tokenshop-cost-model.json'))
model_recovery = json.load(open('data/tokenshop-model-recovery.json'))

# Find types
save_data_type = None
token_shop_type = None
for entry in uabea_report.get('directTargetTypeMetadata', []):
    if entry.get('reportKey') == 'saveData':
        save_data_type = entry
    if entry.get('reportKey') == 'tokenShop':
        token_shop_type = entry

# Save data level fields
save_data_level_fields = {}
for f in save_data_type.get('fields', []):
    name = f.get('name', '')
    if 'ATU' in name and 'Level' in name:
        save_data_level_fields[name] = {
            'offset': f.get('fieldOffset'),
            'type': f.get('type')
        }

# TokenShop all fields
token_shop_fields = {f.get('name'): {'offset': f.get('fieldOffset'), 'type': f.get('type')} 
                    for f in token_shop_type.get('fields', [])}

# TokenShop methods
token_shop_methods = {}
for m in token_shop_type.get('methods', []):
    name = m.get('name', '')
    if 'ATU' in name:
        token_shop_methods[name] = m.get('methodProperties', {}).get('Rva')

# Build canonical dataset
canonical = {
    'dataset': 'tokenshop-canonical-v1',
    'generated': '2026-04-16',
    'description': 'Grounded TokenShop dataset - all fields verified from APK analysis',
    
    'source_priority': [
        'uabea-probe-report.json (field offsets, method RVAs)',
        'tokenshop-cost-model.json (extracted cost/bonus values)',
        'tokenshop-model-recovery.json (verified formulas)'
    ],
    
    'formulas': {
        'cost': {
            'formula': 'cost = StartCost + (level - 1) * AdditiveCost',
            'verified_via': 'Native code disassembly at get_ATU*Cost method RVAs'
        },
        'bonus': {
            'formula': 'bonus = BonusFieldValue * CurrentLevel',
            'verified_via': 'Native code disassembly at get_*Bonus method RVAs'
        }
    },
    
    'save_data': {
        'description': 'ATU upgrade levels stored in SaveData class',
        'source': 'uabea-probe-report.json -> saveData type',
        'count': 28,
        'offsets': save_data_level_fields,
        'adjacent_fields': {
            'BankedTokens': {'offset': 1800, 'type': 'System.Single'},
            'Tier2TokensUnlocked': {'offset': 1788, 'type': 'System.Boolean'}
        }
    },
    
    'token_shop': {
        'description': 'TokenShop controller class - holds cost/bonus field values',
        'source': 'uabea-probe-report.json -> tokenShop type',
        
        'cost_field_offsets': {},
        'bonus_field_offsets': {},
        'methods': token_shop_methods
    },
    
    'atu_rows': {}
}

# Add cost field offsets
for name in sorted(token_shop_fields.keys()):
    if 'StartCost' in name or 'AdditiveCost' in name:
        canonical['token_shop']['cost_field_offsets'][name] = token_shop_fields[name]

# Add bonus field offsets
for name in sorted(token_shop_fields.keys()):
    if 'Bonus' in name:
        canonical['token_shop']['bonus_field_offsets'][name] = token_shop_fields[name]

# Parse ATU rows from tokenshop-cost-model.json
for field_name, row_data in cost_model.items():
    # Extract ATU number: ATU1Button -> 1
    match = re.match(r'ATU(\d+)Button', field_name)
    if not match:
        continue
    atu_num = match.group(1)
    
    # Get level offset
    level_field = f'ATU{atu_num}Level'
    level_offset = save_data_level_fields.get(level_field, {}).get('offset', 'unknown')
    
    # Get method RVAs for this ATU - FIXED: match exact patterns
    row_methods = {}
    for method_name, rva in token_shop_methods.items():
        # Match patterns like: get_ATU1Cost, get_ATU1TokenBonus, get_ATU24Bonus1Cells
        # But NOT get_ATU10Cost (that would match ATU1)
        exact_patterns = [
            f'^get_ATU{atu_num}Cost$',
            f'^get_ATU{atu_num}[A-Z].*$',  # get_ATU1TokenBonus, get_ATU24Bonus1Cells
            f'^get_ATU{atu_num}Bonus\d+.*$'  # get_ATU24Bonus1Cells
        ]
        for pattern in exact_patterns:
            if re.match(pattern, method_name):
                row_methods[method_name] = rva
                break
    
    canonical['atu_rows'][atu_num] = {
        'field_name': field_name,
        'level_field': level_field,
        'level_offset': level_offset,
        'path_id': row_data.get('path_id'),
        'tier': row_data.get('tier'),
        'type': row_data.get('type'),
        'prefab': row_data.get('prefab'),
        
        # Cost model
        'start_cost': row_data.get('start_cost'),
        'additive_cost': row_data.get('additive_cost'),
        'max_level': row_data.get('max_level'),
        'bonus_value': row_data.get('bonus'),
        'cost_formula': row_data.get('formula'),
        
        # Computed values
        'cost_at_level_1': row_data.get('start_cost'),
        'cost_at_level_2': row_data.get('start_cost') + row_data.get('additive_cost') if row_data.get('additive_cost') else None,
        
        # Method RVAs
        'methods': row_methods
    }

print(f"Parsed {len(canonical['atu_rows'])} ATU rows from tokenshop-cost-model.json")

# Verify ATU1 methods
print("\nATU1 methods:")
for name in canonical['atu_rows']['1']['methods']:
    print(f"  {name}")

# Save
output_path = 'data/tokenshop-canonical-v1.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(canonical, f, indent=2, default=str)

print(f"\nSaved to {output_path}")
print(f"Summary:")
print(f"  - {len(canonical['save_data']['offsets'])} save data level fields")
print(f"  - {len(canonical['atu_rows'])} ATU rows with cost/bonus values")
print(f"  - {len(canonical['token_shop']['methods'])} methods with RVAs")
print(f"  - {len(canonical['token_shop']['cost_field_offsets'])} cost field offsets")
print(f"  - {len(canonical['token_shop']['bonus_field_offsets'])} bonus field offsets")