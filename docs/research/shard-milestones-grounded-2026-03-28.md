# Grounded Shard Milestone Mechanics and Player Progression for CIFI

## Scope and evidence policy

This report builds a **grounded, dataset-oriented** reference for **Cell: Idle Factory Incremental (CIFI)** shard milestones and shard-related player progression behaviors, using **only mechanics that are directly stated in trusted community references** (wiki pages and guides explicitly sourced from the Official CIFI Discord in several cases), plus what is directly observable in those sources. citeturn13view0turn14view0turn27view0turn28view0turn29view0

Key evidence rules applied throughout:
- If a numeric value is shown as “Unknown” or is missing in the cited sources, it is kept as **null / "Unknown"** with an uncertainty note (no extrapolation). citeturn13view0turn14view0
- **Shard milestone costs per level** are **not provided as explicit numbers** in accessible sources; therefore, this report **does not invent** cost tables or formulas. The only cost-related facts included are those explicitly stated (e.g., “cost bump every 100 levels”). citeturn14view0
- **No ROI logic** or “optimizer” reasoning is included; the output is strictly a grounded mechanics + behavior dataset. citeturn27view0turn28view0turn29view0

## Findings from the connected CIFI optimizer repository

In the connected repository `ShadoWZYE/cifi-optimizer`, the current game-data snapshot includes an empty `shardMilestones` array (i.e., shard milestone definitions have not yet been imported into the tool’s dataset). fileciteturn5file0L1-L1

The repo’s “verified spec” establishes a strict grounding standard (“no guessing / no extrapolation”) and emphasizes that only verified mechanics should be encoded. fileciteturn4file0L1-L1

Because the repository snapshot does not currently contain shard milestone definitions, this report grounds milestone mechanics using **public community references** that expose milestone names, unlock requirements, level thresholds, and (in many cases) bonus-per-level values. citeturn13view0turn14view0turn21view0turn22view0

## Verified shard milestone mechanics

### Shards, Operations, and reset behavior

Shards are unlocked by purchasing **The Demeter**, obtained by doing **Operations**, used to upgrade **Shard Milestones**, and reset to **0** on **Loop Prestige**. citeturn25view0

Operations are unlocked when **The Demeter** is purchased and (per the community wiki) initially require **65 ticks**, including **10 ticks** to reset the mining operation; this can be reduced to **29 ticks per operation** via specific loop modifications. citeturn23view0

Finishing an Operation grants shards and a stacking **0.5% (additive) bonus to Shards gained**. citeturn23view0

The Shard Mining Menu is unlocked after purchasing **The Demeter** and includes an Operations Overview and a Shard Milestones list; it also states there is always a **10-tick reset timer between Operations** that cannot be reduced. citeturn24view0

### Shard milestone unlock thresholds and effect scaling

Both the CIFI community wikis state that shard milestones have **rarity-based bonus threshold levels**, and that as you level a milestone you unlock additional bonus “slots” at those thresholds:
- Common: bonuses at levels **1, 25, 50**
- Rare: **1, 25, 50, 75**
- Epic: **1, 10, 25, 50, 75**
- Legendary: **1, 5, 10, 25, 50, 75**
- Low Pristine: **1, 30, 60**
- Mid Pristine: **1, 30, 60, 90, 120** citeturn14view0turn21view0

The shard milestone pages also state that aside from threshold unlocks, **incremental level increases the effect of each bonus multiplicatively**. citeturn13view0turn21view0

### Max-level rules and observable cost breakpoints

A key shard-milestone mechanics section on the community (Fandom) wiki states:
- All milestones have a maximum level of **100** until a **Workers Badge** is unlocked; then max level becomes **200**. citeturn14view0
- A “Mining Tech Analysis 6 (Should be 7), Level 1 Research” can double the maximum level of milestones to **400**. citeturn14view0
- “Ultima Loop Mod: Rule of Hard Work” can increase max level of all shard milestones by **2% (Additive) per level**, up to **50 levels**, and “when maxed” increases max level to **800**. citeturn14view0
- Shard milestones “experience a cost bump every 100 levels” with **large cost bumps at level 100 and 400** and **small cost bumps at level 200 and 300**, with larger bumps every 100 afterwards. citeturn14view0

These are the only **explicitly stated** cost-scaling “breakpoints” found in accessible sources; **no numeric shard cost-per-level table** (or closed-form cost function) was available in the sources that could be accessed. citeturn14view0

## Player progression examples

The examples below are captured as **player-reported or community-guide behaviors** (often credited to official Discord users in the Game-Vault wiki pages). They are included as “what people did / recommend doing,” not as optimizer advice.

Early-game Loop Reset guidance: the Beginners Guide warns not to rush Loop Resets (LRs), gives a first-LR example (“On my first LR I got **78 Mod Points**”), and recommends the first LR take **4–8 hours**. It also lists a concrete priority set: “Get Fast Loop mod, Daily rewards, Arcade, Time dilation, MK1+MK2 duo output…” and warns not to save multiple LRs for a single Loop Mod. citeturn27view0

The same guide documents a “bricking” risk via loop requirements, giving explicit examples: to perform LR **5 → 6** you should fill at least **7 loops**, and for LR **6 → 7** it is **8 loops**, with loop requirements growing as LRs increase. It provides a practical “buffer” heuristic (a check involving instant loop fills) to avoid bricking. citeturn27view0

Short vs long run cadence: a dedicated guide defines “Short MP runs” as one tick loop up to **1–2 hours** with the goal of buying affordable loop mods, and “Long shard/cell runs” as **12+ hours** with goals including “Farm shards and prioritize MP/shard milestones,” plus specific switching criteria that reference the shard bonus reset from operations. citeturn28view0

Shard-spending behavior from the shards page includes: do longer runs to leverage the Operations shard bonus multiplier, “evenly distribute Shards among Shard Milestones” early (starting with those that boost Mod Points and Shards), and spend shards in shard milestones before performing loop resets. citeturn26view0

Mid/late progression (Zeus era) player guide behavior: the E1000+MP Zeus Breakthrough Guide explicitly sets a resource priority: “Mats are king… Mats>AP>Shards>RP,” defines “Short run= mp run,” “Mid run = shards run (1–48 hours),” and “Long run = mats run (+48 hours).” It also provides shard-relevant loop reset targets tied to Mod Point magnitude, e.g., “Before 2nd burst e1300 MP: **970 LR**; After 2nd burst e1700 MP: **1000 LR**; E1800 MP: **1050 LR**; E1880 MP: **1100+ LR**.” citeturn29view0

## Uncertainty and gaps

Shard milestone **per-level shard costs** (numeric cost tables) and exact cost formulas were **not found in accessible sources**. The only explicit cost structure captured is the statement about **cost bumps per 100 levels** and the specific “large vs small” bump levels. citeturn14view0

Several shard milestone bonus fields on the shard milestone list include “Unknown” as the initial bonus value, and at least one entry appears to have formatting truncation (e.g., “The Sly Milestone” line lacks closing parentheses), so those values are carried through as-is without repair. citeturn14view0

There is a **source discrepancy** between the older Game-Vault shard milestone list (last edited June 2023) and the Fandom shard milestone list (recently crawled) for multiple milestones (names/rarities/bonus slots differ). This report records the Fandom definition as primary (because it contains the required “initial bonus / bonus-per-level” fields) and attaches the Game-Vault definition as an alternate where available. citeturn14view0turn22view0

## JSON dataset

```json
{
  "meta": {
    "game_title": "Cell: Idle Factory Incremental (CIFI)",
    "dataset_generated_date": "2026-03-28",
    "timezone_basis": "Europe/Bucharest",
    "evidence_policy": {
      "only_direct_observations": true,
      "no_extrapolation": true,
      "no_roi_or_optimization_logic": true,
      "unknown_values_preserved": true
    },
    "repo_context": {
      "repo": "ShadoWZYE/cifi-optimizer",
      "repo_snapshot_note": "Repository snapshot file shows shardMilestones as an empty list at time of snapshot; milestone definitions not yet imported.",
      "repo_files": [
        {
          "path": "data/game-data.snapshot.v1.json",
          "evidence": "file_search_citation_required_in_report_text",
          "note": "Referenced in narrative with filecite; included here as repo provenance only."
        }
      ]
    }
  },
  "sources": {
    "SRC_FANDOM_SHARDS": {
      "type": "community_wiki",
      "title": "Shards | Cell: Idle Factory Incremental Wiki | Fandom",
      "url": "https://cifi.fandom.com/wiki/Shards"
    },
    "SRC_FANDOM_OPERATIONS": {
      "type": "community_wiki",
      "title": "Operations | Cell: Idle Factory Incremental Wiki | Fandom",
      "url": "https://cifi.fandom.com/wiki/Operations"
    },
    "SRC_FANDOM_SHARD_MINING_MENU": {
      "type": "community_wiki",
      "title": "Shard Mining Menu | Cell: Idle Factory Incremental Wiki | Fandom",
      "url": "https://cifi.fandom.com/wiki/Shard_Mining_Menu"
    },
    "SRC_FANDOM_SHARD_MILESTONES": {
      "type": "community_wiki",
      "title": "Shard Milestones | Cell: Idle Factory Incremental Wiki | Fandom",
      "url": "https://cifi.fandom.com/wiki/Shard_Milestones"
    },
    "SRC_GV_SHARD_MILESTONES_2023": {
      "type": "community_wiki_snapshot",
      "title": "Shard Milestones - CIFI - Cell: Idle Factory Incremental Wiki (Game-Vault; oldid=790)",
      "url": "https://cifi.game-vault.net/w/index.php?title=Shard_Milestones&oldid=790",
      "last_edited_in_source": "2023-06-18"
    },
    "SRC_GV_SHARDS_2023": {
      "type": "community_wiki_snapshot",
      "title": "Shards - CIFI - Cell: Idle Factory Incremental Wiki (Game-Vault; oldid=493)",
      "url": "https://cifi.game-vault.net/w/index.php?title=Shards&oldid=493",
      "last_edited_in_source": "2023-04-01"
    },
    "SRC_GV_SHARD_MINING_2023": {
      "type": "community_wiki_snapshot",
      "title": "Shard Mining - CIFI - Cell: Idle Factory Incremental Wiki (Game-Vault; oldid=780)",
      "url": "https://cifi.game-vault.net/w/index.php?title=Shard_Mining&oldid=780",
      "last_edited_in_source": "2023-05-21"
    },
    "SRC_FANDOM_LOOP_MODIFICATIONS": {
      "type": "community_wiki",
      "title": "Loop Modifications | Cell: Idle Factory Incremental Wiki | Fandom",
      "url": "https://cifi.fandom.com/wiki/Loop_Modifications"
    },
    "SRC_GV_BEGINNERS_GUIDE_2024": {
      "type": "community_guide_snapshot",
      "title": "Guide:Beginners Guide - CIFI - Cell: Idle Factory Incremental Wiki (Game-Vault; oldid=888)",
      "url": "https://cifi.game-vault.net/w/index.php?title=Guide:Beginners_Guide&oldid=888",
      "last_edited_in_source": "2024-10-26",
      "attribution_in_source": "Guide by kingarthur_666 @ Official CIFI Discord"
    },
    "SRC_GV_SHORT_LONG_RUNS_GUIDE_2024": {
      "type": "community_guide_snapshot",
      "title": "Guide:Short and Long Runs Guide - CIFI - Cell: Idle Factory Incremental Wiki (Game-Vault; oldid=889)",
      "url": "https://cifi.game-vault.net/w/index.php?title=Guide:Short_and_Long_Runs_Guide&oldid=889",
      "last_edited_in_source": "2024-10-26",
      "attribution_in_source": "Sources used: Kongren#0001's write up from Official CIFI Discord"
    },
    "SRC_GV_ZEUS_E1000_GUIDE_2024": {
      "type": "community_guide_snapshot",
      "title": "Guide:E1000+MP Zeus Breakthrough Guide - CIFI - Cell: Idle Factory Incremental Wiki (Game-Vault; oldid=852)",
      "url": "https://cifi.game-vault.net/w/index.php?title=Guide:E1000%2BMP_Zeus_Breakthrough_Guide&oldid=852",
      "last_edited_in_source": "2024-02-24",
      "attribution_in_source": "Made by Darth[SW], Originally posted by wsxandres"
    }
  },
  "core_mechanics_observed": {
    "shards": {
      "unlock_condition": {
        "description": "Unlocked by purchasing The Demeter ship.",
        "source_ids": ["SRC_FANDOM_SHARDS"]
      },
      "how_acquired": {
        "description": "Obtained by doing Operations.",
        "source_ids": ["SRC_FANDOM_SHARDS", "SRC_FANDOM_OPERATIONS"]
      },
      "uses": {
        "description": "Used to upgrade Shard Milestones for bonuses (including shards per operation).",
        "source_ids": ["SRC_FANDOM_SHARDS"]
      },
      "reset_behavior": {
        "description": "Reset back to 0 every Loop Prestige.",
        "source_ids": ["SRC_FANDOM_SHARDS"]
      }
    },
    "operations": {
      "unlock_condition": {
        "description": "Unlocked once The Demeter ship is purchased.",
        "source_ids": ["SRC_FANDOM_OPERATIONS"]
      },
      "ticks_per_operation": {
        "initial_ticks_including_reset": 65,
        "includes_reset_ticks": 10,
        "minimum_ticks_with_loop_mods": 29,
        "source_ids": ["SRC_FANDOM_OPERATIONS"],
        "uncertainty_notes": []
      },
      "shard_bonus_per_operation": {
        "description": "Each completed operation grants shards and a stacking 0.5% (additive) bonus to shards gained.",
        "value": "0.5% (additive) per operation completed",
        "source_ids": ["SRC_FANDOM_OPERATIONS"]
      }
    },
    "shard_mining_menu": {
      "unlock_condition": {
        "description": "Unlocked after purchasing The Demeter ship.",
        "source_ids": ["SRC_FANDOM_SHARD_MINING_MENU"]
      },
      "unreducible_timer_between_operations": {
        "description": "There will always be a 10 tick reset timer in between operations; cannot be reduced.",
        "value": 10,
        "source_ids": ["SRC_FANDOM_SHARD_MINING_MENU"]
      }
    }
  },
  "shard_milestone_system": {
    "rarity_bonus_thresholds": {
      "Common": [1, 25, 50],
      "Rare": [1, 25, 50, 75],
      "Epic": [1, 10, 25, 50, 75],
      "Legendary": [1, 5, 10, 25, 50, 75],
      "Low Pristine": [1, 30, 60],
      "Mid Pristine": [1, 30, 60, 90, 120],
      "source_ids": ["SRC_FANDOM_SHARD_MILESTONES", "SRC_GV_SHARD_MILESTONES_2023"]
    },
    "effect_scaling": {
      "description": "Besides thresholds, incremental level increases the effect of each bonus (multiplicatively).",
      "source_ids": ["SRC_FANDOM_SHARD_MILESTONES", "SRC_GV_SHARD_MILESTONES_2023"]
    },
    "max_level_rules_and_modifiers": {
      "base_max_level_before_workers_badge": 100,
      "max_level_after_workers_badge": 200,
      "research_note": "Mining Tech Analysis 6 (Should be 7) Level 1 Research can double the maximum level of milestones to 400.",
      "ultima_loop_mod_note": "Ultima Loop Mod: Rule of Hard Work can increase Max level of all Shard Milestone by 2% (Additive) each level (Maximum of 50 Level), When maxed, will increase the maximum of all Shard Milestone to 800.",
      "source_ids": ["SRC_FANDOM_SHARD_MILESTONES"]
    },
    "cost_breakpoints_observed": {
      "numeric_costs_available": false,
      "breakpoints_statement": "Shard Milestones experience a cost bump every 100 levels (Large cost bump at level 100 and 400 and small cost bump at level 200 and 300, Larger Bumps every 100 afterwards).",
      "source_ids": ["SRC_FANDOM_SHARD_MILESTONES"]
    }
  },
  "shard_milestones": [
    {
      "milestone_number": 0,
      "name_label": "Eternal Milestone",
      "rarity": "Unique",
      "what_it_does_plain": "Provides multiple bonuses including Cells & Ouro Orbs gained and bonuses tied to Attraction gem quality tiers (as listed in the source).",
      "unlock_condition": {
        "type": "event",
        "value": "First traversal completed"
      },
      "level_structure": {
        "bonus_entries_have_explicit_thresholds": false,
        "notes": "Source lists bonuses without explicit level thresholds for this milestone."
      },
      "bonuses": [
        {
          "unlock_level": null,
          "effect_label": "Cells & Ouro Orbs gained",
          "initial_bonus": "1.1x",
          "bonus_per_level": "1.1x"
        },
        {
          "unlock_level": null,
          "effect_label": "Attraction gem quality 1 - Ozzy & Borge Loot",
          "initial_bonus": "Unknown",
          "bonus_per_level": "1.02x"
        },
        {
          "unlock_level": null,
          "effect_label": "Attraction gem quality 2 - Mod Points, Shards and Research Points gained",
          "initial_bonus": "Unkown",
          "bonus_per_level": "1.3x"
        }
      ],
      "cost_per_level": null,
      "cost_progression": {
        "observable_numeric_progression": false,
        "notes": "No per-level shard costs provided for this milestone in accessible sources; only global cost-bump statements exist."
      },
      "fixed_breakpoints": [],
      "sources": [
        {
          "source_id": "SRC_FANDOM_SHARD_MILESTONES",
          "url": "https://cifi.fandom.com/wiki/Shard_Milestones"
        }
      ],
      "uncertainty_notes": [
        "No explicit level thresholds shown for this milestone in the source.",
        "Some fields are spelled 'Unkown' / shown as 'Unknown' in the source; preserved verbatim."
      ]
    },
    {
      "milestone_number": 1,
      "name_label": "Alpha Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts Cells gained, MK5 output, and Shards gained at milestone level thresholds.",
      "unlock_condition": {
        "type": "total_milestone_levels_required",
        "value": 0
      },
      "level_structure": {
        "bonus_unlock_levels": [1, 25, 50]
      },
      "bonuses": [
        {
          "unlock_level": 1,
          "effect_label": "Cells Gained",
          "initial_bonus": "1.06x",
          "bonus_per_level": "1.06x"
        },
        {
          "unlock_level": 25,
          "effect_label": "MK5 Output",
          "initial_bonus": "1.34x",
          "bonus_per_level": "1.06x"
        },
        {
          "unlock_level": 50,
          "effect_label": "Shards Gained",
          "initial_bonus": "Unknown",
          "bonus_per_level": "1.06x"
        }
      ],
      "cost_per_level": null,
      "cost_progression": {
        "observable_numeric_progression": false,
        "notes": "No per-level shard costs provided; only global cost-bump statements exist."
      },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [
        {
          "source_id": "SRC_FANDOM_SHARD_MILESTONES",
          "url": "https://cifi.fandom.com/wiki/Shard_Milestones"
        }
      ],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 1,
          "name_label": "Aqua Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Cells Gained" },
            { "unlock_level": 25, "effect_label": "Mod Points Gained" },
            { "unlock_level": 50, "effect_label": "Shards Gained" }
          ],
          "unlock_requirement_raw": "None"
        }
      ],
      "uncertainty_notes": [
        "Name/bonus mismatch versus older Game-Vault snapshot (Aqua vs Alpha; MK5 Output vs Mod Points at level 25)."
      ]
    },
    {
      "milestone_number": 2,
      "name_label": "Aquarius Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts Mod Points gained, MK4 output, and Cells gained at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 5 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Mod Points Gained", "initial_bonus": "1.06x", "bonus_per_level": "1.06x" },
        { "unlock_level": 25, "effect_label": "MK4 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 50, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 2,
          "name_label": "Aquarius Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Mod Points Gained" },
            { "unlock_level": 25, "effect_label": "MK4 Output" },
            { "unlock_level": 50, "effect_label": "Cells Gained" }
          ],
          "unlock_requirement_raw": "5"
        }
      ],
      "uncertainty_notes": ["Initial bonus values are Unknown for some bonuses per source."]
    },
    {
      "milestone_number": 3,
      "name_label": "Libra Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts MK1, MK2, and MK3 output at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 10 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK1 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 25, "effect_label": "MK2 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 50, "effect_label": "MK3 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.08x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 3,
          "name_label": "Libra Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK1 Output" },
            { "unlock_level": 25, "effect_label": "MK2 Output" },
            { "unlock_level": 50, "effect_label": "MK3 Output" }
          ],
          "unlock_requirement_raw": "10"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },
    {
      "milestone_number": 4,
      "name_label": "Modifying Milestone",
      "rarity": "Rare",
      "what_it_does_plain": "Boosts Mod Points gained at multiple thresholds and provides a Tick Speed bonus at level 75 with a stated cap.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 20 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 25, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.05x" },
        { "unlock_level": 50, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.04x" },
        { "unlock_level": 75, "effect_label": "Tick Speed", "initial_bonus": "0.05s", "bonus_per_level": "0.01s/level", "cap_note": "0.30s max" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 4,
          "name_label": "Modifying Milestone",
          "rarity": "Rare",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Mod Points Gained" },
            { "unlock_level": 25, "effect_label": "Mod Points Gained" },
            { "unlock_level": 50, "effect_label": "Mod Points Gained" },
            { "unlock_level": 75, "effect_label": "Tick Speed Increase" }
          ],
          "unlock_requirement_raw": "20"
        }
      ],
      "uncertainty_notes": ["Initial bonus values for Mod Points bonuses are Unknown per source."]
    },

    {
      "milestone_number": 5,
      "name_label": "Flowering Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts Shards gained, Cells gained, and MK5 output at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 30 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Shards Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.05x" },
        { "unlock_level": 25, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 50, "effect_label": "MK5 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.08x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 5,
          "name_label": "Flowering Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Shards Gained" },
            { "unlock_level": 25, "effect_label": "Cells Gained" },
            { "unlock_level": 50, "effect_label": "MK5 Output" }
          ],
          "unlock_requirement_raw": "30"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 6,
      "name_label": "Connecting Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts MK2, MK3, and MK4 output at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 40 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK2 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 25, "effect_label": "MK3 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 50, "effect_label": "MK4 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.08x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 6,
          "name_label": "Connecting Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK2 Output" },
            { "unlock_level": 25, "effect_label": "MK3 Output" },
            { "unlock_level": 50, "effect_label": "MK4 Output" }
          ],
          "unlock_requirement_raw": "40"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 7,
      "name_label": "Duality Milestone",
      "rarity": "Rare",
      "what_it_does_plain": "Boosts Cells gained and Mod Points gained at alternating thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 50 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.09x" },
        { "unlock_level": 25, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.11x" },
        { "unlock_level": 50, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.13x" },
        { "unlock_level": 75, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.15x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 7,
          "name_label": "Duality Milestone",
          "rarity": "Rare",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Cells Gained" },
            { "unlock_level": 25, "effect_label": "Mod Points Gained" },
            { "unlock_level": 50, "effect_label": "Cells Gained" },
            { "unlock_level": 75, "effect_label": "Mod Points Gained" }
          ],
          "unlock_requirement_raw": "50"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 8,
      "name_label": "Morphing Milestone",
      "rarity": "Epic",
      "what_it_does_plain": "Boosts Cells gained and multiple generator outputs at several thresholds, including a level 10 threshold.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 120 },
      "level_structure": { "bonus_unlock_levels": [1, 10, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.40x" },
        { "unlock_level": 10, "effect_label": "MK1 & MK2 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.20x" },
        { "unlock_level": 25, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.80x" },
        { "unlock_level": 50, "effect_label": "MK3 & Mk4 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.20x" },
        { "unlock_level": 75, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "2.00x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 10, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 8,
          "name_label": "Morphing MIlestone",
          "rarity": "Rare",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Cells Gained" },
            { "unlock_level": 10, "effect_label": "MK1 & MK2 Output" },
            { "unlock_level": 25, "effect_label": "Cells Gained" },
            { "unlock_level": 50, "effect_label": "MK3 & MK4 Output" },
            { "unlock_level": 75, "effect_label": "Cells Gained" }
          ],
          "unlock_requirement_raw": "120"
        }
      ],
      "uncertainty_notes": [
        "Rarity differs in older Game-Vault snapshot (Rare) vs Fandom (Epic)."
      ]
    },

    {
      "milestone_number": 9,
      "name_label": "Producing Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts MK5 output, MK4 output, and MK3 output at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 150 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK5 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 25, "effect_label": "MK4 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 50, "effect_label": "MK3 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.08x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 9,
          "name_label": "Producing Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK5 Output" },
            { "unlock_level": 25, "effect_label": "MK4 Output" },
            { "unlock_level": 50, "effect_label": "MK3 Output" }
          ],
          "unlock_requirement_raw": "150"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 10,
      "name_label": "Expanding Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts MK2 output, MK1 output, and MK6 output at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 180 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK2 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 25, "effect_label": "MK1 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 50, "effect_label": "MK6 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.08x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 10,
          "name_label": "Expanding Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK2 Output" },
            { "unlock_level": 25, "effect_label": "MK1 Output" },
            { "unlock_level": 50, "effect_label": "MK6 Output" }
          ],
          "unlock_requirement_raw": "180"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 11,
      "name_label": "Triangular Milestone",
      "rarity": "Rare",
      "what_it_does_plain": "Boosts MK3 output at all thresholds (multiple separate MK3 output bonuses).",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 340 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK3 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.40x" },
        { "unlock_level": 25, "effect_label": "MK3 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.50x" },
        { "unlock_level": 50, "effect_label": "MK3 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.60x" },
        { "unlock_level": 75, "effect_label": "MK3 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.70x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 11,
          "name_label": "Triangular Milestone",
          "rarity": "Rare",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK3 Output" },
            { "unlock_level": 25, "effect_label": "MK3 Output" },
            { "unlock_level": 50, "effect_label": "MK3 Output" },
            { "unlock_level": 75, "effect_label": "MK3 Output" }
          ],
          "unlock_requirement_raw": "340"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 12,
      "name_label": "Extracting Milestone",
      "rarity": "Epic",
      "what_it_does_plain": "Boosts Shards gained, Mod Points gained, combined Shards & Mod Points gained, and MK6 output across multiple thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 520 },
      "level_structure": { "bonus_unlock_levels": [1, 10, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Shards Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.20x" },
        { "unlock_level": 10, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.15x" },
        { "unlock_level": 25, "effect_label": "Shards & Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.10x" },
        { "unlock_level": 50, "effect_label": "MK6 Output", "initial_bonus": "Unknown", "bonus_per_level": "2.00x" },
        { "unlock_level": 75, "effect_label": "Shards & Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.25x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 10, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 12,
          "name_label": "Extracting Milestone",
          "rarity": "Epic",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Shards Gained" },
            { "unlock_level": 10, "effect_label": "Mod Points Gained" },
            { "unlock_level": 25, "effect_label": "Shards & Mod Points Gained" },
            { "unlock_level": 50, "effect_label": "MK6 Output" },
            { "unlock_level": 75, "effect_label": "Shards & Mod Points Gained" }
          ],
          "unlock_requirement_raw": "520"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 13,
      "name_label": "Seeding Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts Cells gained across all thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 560 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 25, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 50, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.08x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 13,
          "name_label": "Seeding Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Cells Gained" },
            { "unlock_level": 25, "effect_label": "Cells Gained" },
            { "unlock_level": 50, "effect_label": "Cells Gained" }
          ],
          "unlock_requirement_raw": "560"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 14,
      "name_label": "Pathing Milestone",
      "rarity": "Rare",
      "what_it_does_plain": "Boosts MK3/MK4/MK5 output and provides a Tick Speed Increase bonus at level 75 with a stated cap.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 700 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK3 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.15x" },
        { "unlock_level": 25, "effect_label": "MK4 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.18x" },
        { "unlock_level": 50, "effect_label": "MK5 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.21x" },
        { "unlock_level": 75, "effect_label": "Tick Speed Increase", "initial_bonus": "0.05s", "bonus_per_level": "0.01s/level", "cap_note": "0.30s max" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 14,
          "name_label": "Pathing Milestone",
          "rarity": "Rare",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK3 Output" },
            { "unlock_level": 25, "effect_label": "MK4 Output" },
            { "unlock_level": 50, "effect_label": "MK5 Output" },
            { "unlock_level": 75, "effect_label": "Tick Speed Increase" }
          ],
          "unlock_requirement_raw": "700"
        }
      ],
      "uncertainty_notes": ["Initial bonus values are Unknown for several bonuses per source."]
    },

    {
      "milestone_number": 15,
      "name_label": "Ritualistic Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts MK6 output across all thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 800 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK6 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 25, "effect_label": "MK6 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" },
        { "unlock_level": 50, "effect_label": "MK6 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.06x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 15,
          "name_label": "Ritualistic Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK6 Output" },
            { "unlock_level": 25, "effect_label": "MK6 Output" },
            { "unlock_level": 50, "effect_label": "MK6 Output" }
          ],
          "unlock_requirement_raw": "800"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 16,
      "name_label": "Modulistic Milestone",
      "rarity": "Rare",
      "what_it_does_plain": "Boosts Mod Points gained and MK5 output at multiple thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 900 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.05x" },
        { "unlock_level": 25, "effect_label": "MK5 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.25x" },
        { "unlock_level": 50, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.05x" },
        { "unlock_level": 75, "effect_label": "MK5 Output", "initial_bonus": "3.71x", "bonus_per_level": "1.30x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 16,
          "name_label": "Modulistic Milestone",
          "rarity": "Rare",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Mod Points Gained" },
            { "unlock_level": 25, "effect_label": "MK5 Output" },
            { "unlock_level": 50, "effect_label": "Mod Points Gained" },
            { "unlock_level": 75, "effect_label": "MK5 Output" }
          ],
          "unlock_requirement_raw": "900"
        }
      ],
      "uncertainty_notes": ["Some initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 17,
      "name_label": "Machining Milestone",
      "rarity": "Epic",
      "what_it_does_plain": "Boosts Cells gained, Research Points gained, combined Shards & Research Points gained, and combined Mod Points & Research Points gained at multiple thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 1000 },
      "level_structure": { "bonus_unlock_levels": [1, 10, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "2.20x" },
        { "unlock_level": 10, "effect_label": "Research Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.09x" },
        { "unlock_level": 25, "effect_label": "Shards & Research Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 50, "effect_label": "Research Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.13x" },
        { "unlock_level": 75, "effect_label": "Mod Points & Research Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.09x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 10, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 17,
          "name_label": "Machining Milestone",
          "rarity": "Epic",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Cells Gained" },
            { "unlock_level": 10, "effect_label": "Research Points Gained" },
            { "unlock_level": 25, "effect_label": "Shards & Research Points Gained" },
            { "unlock_level": 50, "effect_label": "Research Points Gained" },
            { "unlock_level": 75, "effect_label": "Mod Points & Research Points Gained" }
          ],
          "unlock_requirement_raw": "1000"
        }
      ],
      "uncertainty_notes": ["Initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 18,
      "name_label": "Studying Milestone",
      "rarity": "Legendary",
      "what_it_does_plain": "Boosts Research Points gained, Cells gained, Mod Points gained, Shards gained, and combined Research Points & Academy Points gained at multiple thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 1100 },
      "level_structure": { "bonus_unlock_levels": [1, 5, 10, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Research Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.15x" },
        { "unlock_level": 5, "effect_label": "Research Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.16x" },
        { "unlock_level": 10, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "6.00x" },
        { "unlock_level": 25, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.37x" },
        { "unlock_level": 50, "effect_label": "Shards Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.59x" },
        { "unlock_level": 75, "effect_label": "Research Points & Academy Points Gained", "initial_bonus": "5.19x", "bonus_per_level": "1.39x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 5, 10, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 18,
          "name_label": "Studying Milestone",
          "rarity": "Legendary",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Research Points Gained" },
            { "unlock_level": 5, "effect_label": "Research Points Gained" },
            { "unlock_level": 10, "effect_label": "Cells Gained" },
            { "unlock_level": 25, "effect_label": "Mod Points Gained" },
            { "unlock_level": 50, "effect_label": "Shards Gained" },
            { "unlock_level": 75, "effect_label": "Research Points & Academy Points Gained" }
          ],
          "unlock_requirement_raw": "1100"
        }
      ],
      "uncertainty_notes": ["Many initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 19,
      "name_label": "Lucky Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts MK7 output across all thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 1400 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK7 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.13x" },
        { "unlock_level": 25, "effect_label": "MK7 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.15x" },
        { "unlock_level": 50, "effect_label": "MK7 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.17x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 19,
          "name_label": "Lucky Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK7 Output" },
            { "unlock_level": 25, "effect_label": "MK7 Output" },
            { "unlock_level": 50, "effect_label": "MK7 Output" }
          ],
          "unlock_requirement_raw": "1400"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 20,
      "name_label": "Duplicating Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts Cells gained, MK2 output, and Shards gained at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 1500 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Cells Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.15x" },
        { "unlock_level": 25, "effect_label": "MK 2 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.20x" },
        { "unlock_level": 50, "effect_label": "Shards Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 20,
          "name_label": "Duplicating Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Cells Gained" },
            { "unlock_level": 25, "effect_label": "Mod Points Gained" },
            { "unlock_level": 50, "effect_label": "Research Points Gained" }
          ],
          "unlock_requirement_raw": "1500"
        }
      ],
      "uncertainty_notes": [
        "Definition differs substantially versus older Game-Vault snapshot (bonus set differs).",
        "All initial bonus values are Unknown per source."
      ]
    },

    {
      "milestone_number": 21,
      "name_label": "Targeting Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts Academy Points gained, Mod Points gained, and Research Points gained at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 1600 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Academy Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.02x" },
        { "unlock_level": 25, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 50, "effect_label": "Research Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.12x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 21,
          "name_label": "Targeting Milestone",
          "rarity": "Common",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Academy Points Gained" },
            { "unlock_level": 25, "effect_label": "Mod Points Gained" },
            { "unlock_level": 50, "effect_label": "Research Points Gained" }
          ],
          "unlock_requirement_raw": "1600"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 22,
      "name_label": "Quadratic Milestone",
      "rarity": "Rare",
      "what_it_does_plain": "Boosts MK4 Output at all thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 1700 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MK4 Output", "initial_bonus": "Unknown", "bonus_per_level": "2.20x" },
        { "unlock_level": 25, "effect_label": "MK4 Output", "initial_bonus": "Unknown", "bonus_per_level": "2.30x" },
        { "unlock_level": 50, "effect_label": "MK4 Output", "initial_bonus": "Unknown", "bonus_per_level": "2.40x" },
        { "unlock_level": 75, "effect_label": "MK4 Output", "initial_bonus": "Unknown", "bonus_per_level": "2.50x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 22,
          "name_label": "Quadratic Milestone",
          "rarity": "Rare",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "MK4 Output" },
            { "unlock_level": 25, "effect_label": "MK4 Output" },
            { "unlock_level": 50, "effect_label": "MK4 Output" },
            { "unlock_level": 75, "effect_label": "MK4 Output" }
          ],
          "unlock_requirement_raw": "1700"
        }
      ],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 23,
      "name_label": "Layering Milestone",
      "rarity": "Epic",
      "what_it_does_plain": "Boosts All Generator Output, Mod Points gained, All Generator Output (additional), Academy Points gained, and All Generator Output (additional) at multiple thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 1800 },
      "level_structure": { "bonus_unlock_levels": [1, 10, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "All Generator Output", "initial_bonus": "Unknown", "bonus_per_level": "1.12x" },
        { "unlock_level": 10, "effect_label": "Mod Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.12x" },
        { "unlock_level": 25, "effect_label": "All Generator Output", "initial_bonus": "2.29x", "bonus_per_level": "1.18x" },
        { "unlock_level": 50, "effect_label": "Academy Points Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 75, "effect_label": "All Generator Output", "initial_bonus": "4.48x", "bonus_per_level": "1.35x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 10, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 23,
          "name_label": "Layering Milestone",
          "rarity": "Epic",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "All Generators Outputs" },
            { "unlock_level": 10, "effect_label": "Mod Points Gained" },
            { "unlock_level": 25, "effect_label": "All Generators Output" },
            { "unlock_level": 50, "effect_label": "Academy Points Gained" },
            { "unlock_level": 75, "effect_label": "All Generators Output" }
          ],
          "unlock_requirement_raw": "1800"
        }
      ],
      "uncertainty_notes": ["Some initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 24,
      "name_label": "Torn Milestone",
      "rarity": "Rare",
      "what_it_does_plain": "Boosts Mod Points gained and Shards gained at multiple thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 3300 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50, 75] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Mod Points Gained", "initial_bonus": "1.55x", "bonus_per_level": "1.55x" },
        { "unlock_level": 25, "effect_label": "Mod Points & Shards Gained", "initial_bonus": "7.59x", "bonus_per_level": "1.50x" },
        { "unlock_level": 50, "effect_label": "Shards Gained", "initial_bonus": "28.2x", "bonus_per_level": "1.95x" },
        { "unlock_level": 75, "effect_label": "Mod Points Gained", "initial_bonus": "36.21x", "bonus_per_level": "2.05x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50, 75],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 24,
          "name_label": "Torn Milestone",
          "rarity": "Rare",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Mod Points Gained" },
            { "unlock_level": 25, "effect_label": "Mod Points % Shards Gained" },
            { "unlock_level": 50, "effect_label": "Shards Gained" },
            { "unlock_level": 75, "effect_label": "Mod Points" }
          ],
          "unlock_requirement_raw": "3300"
        }
      ],
      "uncertainty_notes": [
        "Older Game-Vault snapshot expresses the level-25 effect differently ('Mod Points % Shards Gained') and truncates the level-75 label."
      ]
    },

    {
      "milestone_number": 25,
      "name_label": "Fabricating Milestone",
      "rarity": "Low Pristine",
      "what_it_does_plain": "Boosts combined Mod Points/Research Points/Shards gained, All Generators Output, and Mod Points gained at specific thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 3600 },
      "level_structure": { "bonus_unlock_levels": [1, 30, 60] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Mod Points, Research Points, & Shards Gained", "initial_bonus": "1.22x", "bonus_per_level": "1.22x" },
        { "unlock_level": 30, "effect_label": "All Generators Output", "initial_bonus": "269.39x", "bonus_per_level": "1.75x" },
        { "unlock_level": 60, "effect_label": "Mod Points Gained", "initial_bonus": "90.16x", "bonus_per_level": "1.35x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 30, 60],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 25,
          "name_label": "Fabricating Milestone",
          "rarity": "Low Pristine",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Mod Points, Research Points & Shards Gained" },
            { "unlock_level": 30, "effect_label": "All Generator Output" },
            { "unlock_level": 60, "effect_label": "Mod Points & All Generators Output" }
          ],
          "unlock_requirement_raw": "3600"
        }
      ],
      "uncertainty_notes": []
    },

    {
      "milestone_number": 26,
      "name_label": "Wonderous Milestone",
      "rarity": "Mid Pristine",
      "what_it_does_plain": "Boosts combined Mod Points/Research Points/Cells gained, Academy Points gained, Mission Materials gained, and All Generators Output at multiple thresholds (including 90 and 120).",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 3900 },
      "level_structure": { "bonus_unlock_levels": [1, 30, 60, 90, 120] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "Mod Points, Research Points, & Cells Gained", "initial_bonus": "2.20x", "bonus_per_level": "2.20x" },
        { "unlock_level": 30, "effect_label": "Academy Points Gained", "initial_bonus": "1.36x", "bonus_per_level": "1.064x" },
        { "unlock_level": 60, "effect_label": "Mission Materials Gained & All Generators Output", "initial_bonus": "Unknown", "bonus_per_level": "1.044x" },
        { "unlock_level": 90, "effect_label": "Mission Materials Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.068x" },
        { "unlock_level": 120, "effect_label": "Academy Points Gained & All Generators Output", "initial_bonus": "Unknown", "bonus_per_level": "1,072x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 30, 60, 90, 120],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "alternate_definitions": [
        {
          "source_id": "SRC_GV_SHARD_MILESTONES_2023",
          "milestone_number_in_source": 26,
          "name_label": "Wonderous Milestone",
          "rarity": "Mid Pristine",
          "bonuses": [
            { "unlock_level": 1, "effect_label": "Mod Points, Research Points & Cells Gained" },
            { "unlock_level": 30, "effect_label": "Academy Pionts Gained" },
            { "unlock_level": 60, "effect_label": "Mission Materials & All Generators Output" },
            { "unlock_level": 90, "effect_label": "N/A" },
            { "unlock_level": 120, "effect_label": "N/A" }
          ],
          "unlock_requirement_raw": "3900"
        }
      ],
      "uncertainty_notes": [
        "Fandom entry includes values for levels 90 and 120, while older Game-Vault snapshot lists N/A at those levels.",
        "Fandom shows '1,072x' (comma included); preserved verbatim."
      ]
    },

    {
      "milestone_number": 27,
      "name_label": "The Sharp Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts MP gained, MK8 output, and RP gained at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 8000 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "MP Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.10x" },
        { "unlock_level": 25, "effect_label": "MK8 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.19x" },
        { "unlock_level": 50, "effect_label": "RP Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.13x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    },

    {
      "milestone_number": 28,
      "name_label": "The Sly Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts AP gained, MK1 output, and Shards gained at milestone level thresholds (formatting partially incomplete in source).",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 8050 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "AP Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.07x" },
        { "unlock_level": 25, "effect_label": "MK1 Output", "initial_bonus": "Unknown", "bonus_per_level": "1.28x" },
        { "unlock_level": 50, "effect_label": "Shards gained", "initial_bonus": "Unknown", "bonus_per_level": "1.12x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "uncertainty_notes": [
        "Source formatting appears truncated (missing closing parentheses in the displayed text); values preserved as best-effort transcription without repair."
      ]
    },

    {
      "milestone_number": 29,
      "name_label": "The Earthly Milestone",
      "rarity": "common",
      "what_it_does_plain": "Boosts RP gained and Mission Materials gained at milestone level thresholds.",
      "unlock_condition": { "type": "total_milestone_levels_required", "value": 8100 },
      "level_structure": { "bonus_unlock_levels": [1, 25, 50] },
      "bonuses": [
        { "unlock_level": 1, "effect_label": "RP Gained", "initial_bonus": "Unknown", "bonus_per_level": "1.16x" },
        { "unlock_level": 25, "effect_label": "Mission Materials gained", "initial_bonus": "Unknown", "bonus_per_level": "1.018x" },
        { "unlock_level": 50, "effect_label": "Mission Materials gained", "initial_bonus": "Unknown", "bonus_per_level": "1.028x" }
      ],
      "cost_per_level": null,
      "cost_progression": { "observable_numeric_progression": false, "notes": "No per-level shard costs provided." },
      "fixed_breakpoints": [1, 25, 50],
      "sources": [{ "source_id": "SRC_FANDOM_SHARD_MILESTONES", "url": "https://cifi.fandom.com/wiki/Shard_Milestones" }],
      "uncertainty_notes": ["All initial bonus values are Unknown per source."]
    }
  ],
  "player_progression_examples": [
    {
      "example_id": "PPX_EARLY_LR1_MP78",
      "player_state": {
        "lr_label_meaning": "Loop Reset",
        "loop_reset_number": 1,
        "mod_points_gained_on_first_lr": 78,
        "run_duration_estimate": "4-8 hours",
        "shards": null,
        "notes": "Shards not specified for this example."
      },
      "priorities": [
        "Fast Loop mod",
        "Daily rewards",
        "Arcade",
        "Time dilation",
        "MK1+MK2 duo output",
        "Then additional time dilation and MK1/MK2 enhancements (as written)"
      ],
      "why": "Guide frames this as a way to make early Loop Resets meaningful and build MP efficiently for progression.",
      "source_ids": ["SRC_GV_BEGINNERS_GUIDE_2024"]
    },
    {
      "example_id": "PPX_EARLY_LR_ANTIBRICKING",
      "player_state": {
        "lr_range": "Early game",
        "loop_requirement_examples": [
          { "transition": "LR 5 -> 6", "loops_required": 7 },
          { "transition": "LR 6 -> 7", "loops_required": 8 }
        ],
        "shards": null
      },
      "priorities": ["Avoid rapid LR increases that raise loop requirements too fast", "Use buffer / instant loop checks to avoid bricking"],
      "why": "Guide explicitly warns that too-fast LR progression can brick the player by making loop requirements grow beyond what they can complete quickly.",
      "source_ids": ["SRC_GV_BEGINNERS_GUIDE_2024"]
    },
    {
      "example_id": "PPX_SHORT_MP_RUNS",
      "player_state": {
        "run_type": "Short MP run",
        "duration": "From one tick loop up to 1-2 hours",
        "lr": null,
        "shards": null
      },
      "priorities": ["Buy as many affordable loop mods", "Increase MP gains every reset", "Start buying shard mods towards end of MP farming session"],
      "why": "Guide positions this as part of alternating short vs long runs to progress; switching criteria includes readiness to compensate for shard bonus resets from completed operations.",
      "source_ids": ["SRC_GV_SHORT_LONG_RUNS_GUIDE_2024"]
    },
    {
      "example_id": "PPX_LONG_SHARD_CELL_RUNS",
      "player_state": {
        "run_type": "Long shard/cell run",
        "duration": "12+ hours",
        "lr": null,
        "shards": null
      },
      "priorities": ["Farm shards", "Prioritize MP/shard milestones", "Push cells for ship evolutions/levels/LP achievement"],
      "why": "Guide frames longer runs as shard/cell focused, and provides switching rules based on progress/pacing.",
      "source_ids": ["SRC_GV_SHORT_LONG_RUNS_GUIDE_2024"]
    },
    {
      "example_id": "PPX_ZEUS_E1000_RESOURCE_PRIO_AND_LR_TARGETS",
      "player_state": {
        "context": "e1000+MP Zeus progression",
        "resource_priority_declared": "Mats>AP>Shards>RP",
        "run_type_notes": {
          "short_run": "mp run (just instant loops)",
          "mid_run": "shards run (maybe 1-48 hours)",
          "long_run": "mats run (+48 hours)"
        },
        "loop_reset_goals_by_mp": [
          { "mp_level": "e1300 (before 2nd burst)", "lr_goal": 970 },
          { "mp_level": "e1700 (after 2nd burst)", "lr_goal": 1000 },
          { "mp_level": "e1800", "lr_goal": 1050 },
          { "mp_level": "e1880", "lr_goal": "1100+"
          }
        ],
        "shards": null
      },
      "priorities": ["Materials-focused play with shards as a mid-priority resource", "Manage LR cautiously (explicit warning about high LR being 'playing with fire')"],
      "why": "Guide explicitly defines a mats-first roadmap and ties LR targets to MP breakpoints for pacing.",
      "source_ids": ["SRC_GV_ZEUS_E1000_GUIDE_2024"]
    },
    {
      "example_id": "PPX_SHARDS_EARLY_DISTRIBUTION",
      "player_state": {
        "lr": null,
        "shards": null,
        "context": "Early shard milestone spending guidance"
      },
      "priorities": ["Evenly distribute shards among shard milestones early", "Start with milestones that give Mod Points and Shard bonuses", "Spend shards before Loop Resets"],
      "why": "Guide frames this as early best strategy and emphasizes shard reset on loop resets (in that wiki snapshot).",
      "source_ids": ["SRC_GV_SHARDS_2023"]
    }
  ],
  "uncertainty_log": [
    {
      "topic": "Shard milestone shard-cost-per-level tables",
      "status": "missing_in_accessible_sources",
      "what_is_missing": "Numeric cost per level for each shard milestone, and/or a confirmed cost formula.",
      "what_is_available": "Global statement about cost bumps every 100 levels with specified large/small bump points.",
      "inference_used": false,
      "source_ids": ["SRC_FANDOM_SHARD_MILESTONES"]
    },
    {
      "topic": "Unknown initial bonus values in shard milestone list",
      "status": "partially_missing_in_source",
      "what_is_missing": "Many initial bonus values are displayed as 'Unknown' / 'Unkown'.",
      "inference_used": false,
      "source_ids": ["SRC_FANDOM_SHARD_MILESTONES"]
    },
    {
      "topic": "Source discrepancies between Game-Vault (2023) and Fandom shard milestone lists",
      "status": "conflict_detected",
      "what_is_missing": "A single authoritative, version-tagged milestone list covering updates between 2023 and present with official patch provenance (not available in the sources accessed).",
      "inference_used": false,
      "source_ids": ["SRC_FANDOM_SHARD_MILESTONES", "SRC_GV_SHARD_MILESTONES_2023"]
    }
  ]
}
```

