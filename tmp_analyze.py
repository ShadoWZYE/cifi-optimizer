import sys
sys.path.insert(0, 'scripts/unity')
from token_shop_scene_probe import load_environment

env = load_environment()

for obj in env.objects:
    if obj.path_id == 283631 and obj.type.name == 'MonoBehaviour':
        raw = obj.get_raw_data()
        
        import struct
        
        # Let's analyze each ATU row's value region more carefully
        # Different ATU types might have different field counts/structure
        
        button_refs = [352, 404, 456, 508, 584, 660, 736, 812, 888, 964, 1040, 1116, 1192, 1244, 1296, 1348, 1400, 1452, 1504, 1556, 1608, 1660, 1712, 1772, 1824, 1876, 1928, 1980]
        atu_names = [f"ATU{i}Button" for i in range(1, 29)]
        
        print("Analyzing each ATU row's value region (from offset 300 to 500):\n")
        
        for i, (atu, btn_off) in enumerate(zip(atu_names, button_refs)):
            # Each ATU row's values are spread across a region
            # Let's look at the first ~100 bytes after the button ref starts being relevant
            
            # Calculate the approximate region where this ATU's values are
            # Based on pattern: ATU1 starts ~320, ATU2 starts ~372, etc.
            value_start = 320 + i * 52  # approximate
            value_end = value_start + 48  # 12 potential 4-byte fields
            
            print(f"\n=== {atu} (value region {value_start}-{value_end}) ===")
            
            values_in_region = []
            for off in range(value_start, min(value_end, len(raw)), 4):
                val_i = struct.unpack('<I', raw[off:off+4])[0]
                val_f = struct.unpack('<f', raw[off:off+4])[0]
                
                # Filter path_ids and zeros
                if val_i == 0:
                    continue
                if 15000 <= val_i <= 16000:
                    continue
                if 48000 <= val_i <= 50000:
                    continue
                if 290000 <= val_i <= 300000:  # more path_ids
                    continue
                if 49000 <= val_i <= 50000:  # more path_ids  
                    continue
                    
                values_in_region.append((off, val_i, val_f))
            
            # Show what we found
            for off, val_i, val_f in values_in_region[:6]:  # first 6 values
                # Determine if int or float
                if val_i < 1000:
                    print(f"  offset {off}: int={val_i}")
                else:
                    print(f"  offset {off}: float={val_f:.4f}")