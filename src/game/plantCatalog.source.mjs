const PLANT_CATALOG_SOURCE = [
  {
    "id": "daucus_carota",
    "name": "Wild Carrot",
    "longevity": "biennial",
    "age_of_maturity": 3,
    "soil": {
      "ph_range": [
        5.5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.45,
          1
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.2,
          0.8
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.25,
          0.75
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.45
        ]
      }
    },
    "seeding_window": {
      "start": "mid_fall",
      "end": "late_fall"
    },
    "dispersal": {
      "method": "wind",
      "base_radius_tiles": 5,
      "wind_radius_bonus": 5,
      "water_dispersed": false,
      "animal_dispersed": true,
      "seeds_per_mature_plant": [
        500,
        2000
      ],
      "germination_rate": 0.4,
      "germination_season": "spring",
      "requires_disturbance": true,
      "pioneer": true,
      "viable_lifespan_days": 1500
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "Tiny lacy cotyledons barely visible above the soil."
      },
      {
        "stage": "first_year_vegetative",
        "min_age_days": 3,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 35
        },
        "size": 2,
        "field_description": "A low-growing rosette of finely divided, lacy, fern-like green leaves."
      },
      {
        "stage": "first_year_dormant",
        "min_age_days": 4,
        "seasonal_window": {
          "start_day": 36,
          "end_day": 40
        },
        "size": 1,
        "field_description": "Leaves have died back completely; only the taproot remains alive underground."
      },
      {
        "stage": "second_year_vegetative",
        "min_age_days": 46,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 15
        },
        "size": 3,
        "field_description": "A tall, solid green stem covered in fine hairs rises from the lacy rosette of leaves."
      },
      {
        "stage": "second_year_flowering",
        "min_age_days": 47,
        "seasonal_window": {
          "start_day": 16,
          "end_day": 25
        },
        "size": 3,
        "field_description": "The hairy stem is topped with flat umbels of small white flowers, featuring a single dark purple flower in the center."
      },
      {
        "stage": "second_year_seed_set",
        "min_age_days": 48,
        "seasonal_window": {
          "start_day": 26,
          "end_day": 35
        },
        "size": 3,
        "field_description": "The flower umbels have folded inward to form a concave 'bird's nest' shape, holding small bristly seeds. The stalk is browning."
      }
    ],
    "parts": [
      {
        "name": "root",
        "available_life_stages": [
          "seedling",
          "first_year_vegetative",
          "first_year_dormant",
          "second_year_vegetative",
          "second_year_flowering",
          "second_year_seed_set"
        ],
        "sub_stages": [
          {
            "id": "first_year",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A pale whitish taproot, fleshy and smelling strongly of carrot.",
            "game_description": "First-year root. Contains starches. Caloric extraction is significantly improved by cooking in a stew.",
            "edibility_score": 0.8,
            "edibility_harshness": 0.2,
            "unit_weight_g": 30,
            "nutrition": {
              "calories": 12,
              "protein": 0.3,
              "carbs": 2.8,
              "fat": 0.1
            },
            "texture": "crisp",
            "taste_notes": [
              "sweet",
              "earthy"
            ],
            "scent_notes": [
              "earthy",
              "pungent"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield_full_age_days": 20,
            "harvest_unit_weight_scales_with_age": true,
            "harvest_yield": {
              "units_per_action": [
                1,
                1
              ],
              "actions_until_depleted": [
                1,
                1
              ]
            },
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 5,
            "decay_days": 14,
            "can_dry": false,
            "stew_nutrition_factor": 1.4,
            "cooked_edibility_score": 0.95,
            "cooked_harshness": 0
          },
          {
            "id": "second_year",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_fall"
            },
            "field_description": "A pale whitish taproot, split, hard, and extremely woody.",
            "game_description": "Second-year root. Highly fibrous structure prevents meaningful caloric extraction raw or cooked.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.5,
            "nutrition": {
              "calories": 3,
              "protein": 0.1,
              "carbs": 0.6,
              "fat": 0
            },
            "texture": "woody",
            "taste_notes": [
              "bitter",
              "earthy"
            ],
            "raw_extraction_efficiency": 0.1,
            "stew_nutrition_factor": 0.2,
            "cooked_edibility_score": 0.2,
            "cooked_harshness": 0.3
          }
        ]
      },
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "first_year_vegetative",
          "second_year_vegetative",
          "second_year_flowering"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "mid_fall"
            },
            "field_description": "Finely divided, lacy, fern-like green leaves.",
            "game_description": "Contains minimal calories. Can be added to stews without harshness.",
            "edibility_score": 0.7,
            "edibility_harshness": 0.1,
            "unit_weight_g": 2,
            "nutrition": {
              "calories": 0.4,
              "protein": 0.05,
              "carbs": 0.05,
              "fat": 0
            },
            "texture": "tender",
            "taste_notes": [
              "grassy",
              "earthy"
            ],
            "scent_notes": [
              "fresh",
              "carrot-like"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                5,
                12
              ],
              "actions_until_depleted": [
                2,
                4
              ]
            },
            "harvest_damage": 0.3,
            "regrowth_days": 10,
            "regrowth_max_harvests": 2,
            "decay_days": 3,
            "can_dry": false,
            "stew_nutrition_factor": 1.1
          }
        ]
      },
      {
        "name": "stem",
        "available_life_stages": [
          "second_year_vegetative",
          "second_year_flowering",
          "second_year_seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "mid_summer"
            },
            "field_description": "A sturdy, solid green stem covered in fine hairs.",
            "game_description": "Highly fibrous and inedible. Identifying this solid, hairy stem is critical to distinguish the plant from smooth-stemmed poison hemlock.",
            "edibility_score": 0,
            "edibility_harshness": 0.6,
            "unit_weight_g": 15,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "fibrous",
            "taste_notes": [
              "bitter"
            ],
            "scent_notes": [
              "grassy"
            ],
            "average_fiber_length_cm": 5,
            "fiber_strength_modifier": 0.3,
            "fiberous": true,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 5,
            "harvest_tool_modifiers": {
              "knife": 1.5,
              "blickey": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                4,
                4
              ]
            },
            "harvest_damage": 0.8,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_dry": false,
            "stew_nutrition_factor": 0
          },
          {
            "id": "dry",
            "seasonal_window": {
              "start": "late_summer",
              "end": "winter"
            },
            "field_description": "A dry, brown, hollowed-out stalk.",
            "game_description": "A brittle dry stalk that can be used as tinder.",
            "edibility_harshness": 1,
            "texture": "brittle",
            "taste_notes": [],
            "scent_notes": [
              "dusty"
            ],
            "craft_tags": [
              "tinder"
            ]
          }
        ]
      },
      {
        "name": "flower",
        "available_life_stages": [
          "second_year_flowering"
        ],
        "sub_stages": [
          {
            "id": "fresh",
            "seasonal_window": {
              "start": "early_summer",
              "end": "mid_summer"
            },
            "field_description": "A flat umbel of tiny white flowers, with a single dark purple floret in the exact center.",
            "game_description": "Contains trace calories. Mild and safely consumable.",
            "edibility_score": 0.85,
            "edibility_harshness": 0.1,
            "unit_weight_g": 3,
            "nutrition": {
              "calories": 0.6,
              "protein": 0,
              "carbs": 0.1,
              "fat": 0
            },
            "texture": "tender",
            "taste_notes": [
              "mild",
              "floral"
            ],
            "scent_notes": [
              "floral",
              "carrot-like"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                2,
                4
              ]
            },
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 2,
            "can_dry": false,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "seed",
        "available_life_stages": [
          "second_year_seed_set"
        ],
        "sub_stages": [
          {
            "id": "dry",
            "seasonal_window": {
              "start": "late_summer",
              "end": "late_fall"
            },
            "field_description": "Small, strongly ribbed seeds covered in tiny bristles, gathered in a dry 'bird's nest' cup.",
            "game_description": "Highly aromatic seeds. Contains minor calories but requires significant harvesting time for small yields.",
            "edibility_score": 0.6,
            "edibility_harshness": 0.2,
            "unit_weight_g": 0.5,
            "nutrition": {
              "calories": 1.5,
              "protein": 0.05,
              "carbs": 0.2,
              "fat": 0.1
            },
            "texture": "hard",
            "taste_notes": [
              "pungent",
              "piney"
            ],
            "scent_notes": [
              "piney",
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                10,
                30
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "does_blickey_help_harvest": true,
            "decay_days": 120,
            "can_dry": true,
            "stew_nutrition_factor": 1
          }
        ]
      }
    ]
  },
  {
    "id": "juglans_nigra",
    "name": "Black Walnut",
    "longevity": "perennial",
    "age_of_maturity": 360,
    "soil": {
      "ph_range": [
        6,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.45,
          0.9
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.5,
          1
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.45,
          0.9
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.2
        ]
      }
    },
    "seeding_window": {
      "start": "mid_fall",
      "end": "late_fall"
    },
    "dispersal": {
      "method": "animal_cached",
      "base_radius_tiles": 15,
      "wind_radius_bonus": 0,
      "water_dispersed": true,
      "animal_dispersed": true,
      "seeds_per_mature_plant": [
        50,
        150
      ],
      "germination_rate": 0.2,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": false,
      "viable_lifespan_days": 300
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A young, single-stemmed sapling with large pinnately compound leaves. It emits a pungent, spicy-citrus odor when bruised."
      },
      {
        "stage": "sapling",
        "min_age_days": 280,
        "seasonal_window": null,
        "size": 5,
        "field_description": "A slender young tree with smooth, gray-brown bark and a few sturdy branches bearing long compound leaves."
      },
      {
        "stage": "mature_vegetative",
        "min_age_days": 360,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 15
        },
        "size": 9,
        "field_description": "A towering canopy tree with dark, deeply furrowed bark. Its large compound leaves form a high, dappled canopy."
      },
      {
        "stage": "mature_fruiting",
        "min_age_days": 361,
        "seasonal_window": {
          "start_day": 16,
          "end_day": 25
        },
        "size": 9,
        "field_description": "A towering canopy tree. Round, bright green fruits hang heavily among the large compound leaves."
      },
      {
        "stage": "mature_seed_set",
        "min_age_days": 362,
        "seasonal_window": {
          "start_day": 26,
          "end_day": 30
        },
        "size": 9,
        "field_description": "The tree's leaves turn yellow and begin to drop. Large, yellowish-green to blackish fruits are visible on the branches and the ground."
      },
      {
        "stage": "mature_dormant",
        "min_age_days": 363,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 40
        },
        "size": 9,
        "field_description": "A massive, bare silhouette. Its dark, deeply furrowed bark forms interlacing diamond patterns on the thick trunk."
      }
    ],
    "parts": [
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "sapling",
          "mature_vegetative",
          "mature_fruiting",
          "mature_seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "early_fall"
            },
            "field_description": "Long compound leaves with many small leaflets. Strong spicy-citrus scent when crushed.",
            "game_description": "Contains strong tannins and juglone. Inedible, but can be crushed for a mild antibacterial poultice.",
            "edibility_score": 0,
            "edibility_harshness": 0.8,
            "unit_weight_g": 5,
            "nutrition": {
              "calories": 0.05,
              "protein": 0,
              "carbs": 0.01,
              "fat": 0
            },
            "texture": "fibrous",
            "taste_notes": [
              "bitter",
              "astringent"
            ],
            "scent_notes": [
              "pungent",
              "citrus",
              "spicy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                20,
                50
              ],
              "actions_until_depleted": [
                15,
                30
              ]
            },
            "reach_tier": "canopy",
            "reach_tier_by_life_stage": {
              "seedling": "ground",
              "sapling": "ground"
            },
            "harvest_damage": 0.05,
            "regrowth_days": 15,
            "regrowth_max_harvests": 1,
            "decay_days": 3,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          },
          {
            "id": "yellow",
            "seasonal_window": {
              "start": "mid_fall",
              "end": "late_fall"
            },
            "field_description": "Yellow, drying compound leaves preparing to drop from the tree.",
            "game_description": "Drying leaves with diminished potency. Largely useless.",
            "edibility_score": 0,
            "edibility_harshness": 0.6,
            "potency_multiplier": 0.1,
            "reach_tier": "canopy",
            "reach_tier_by_life_stage": {
              "seedling": "ground",
              "sapling": "ground"
            },
            "harvest_yield": {
              "units_per_action": [
                20,
                50
              ],
              "actions_until_depleted": [
                15,
                30
              ]
            },
            "harvest_damage": 0.05,
            "decay_days": 5,
            "can_dry": true
          }
        ]
      },
      {
        "name": "branch",
        "available_life_stages": [
          "sapling",
          "mature_vegetative",
          "mature_fruiting",
          "mature_seed_set",
          "mature_dormant"
        ],
        "sub_stages": [
          {
            "id": "wood",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "Stout, dark brown branches bearing prominent leaf scars.",
            "game_description": "Strong, heavy wood that is excellent for structural components and sturdy tool handles.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 1000,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "woody",
            "taste_notes": [],
            "scent_notes": [
              "earthy",
              "dry"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [
              "stiff_stick"
            ],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 30,
            "harvest_tool_modifiers": {
              "axe": 3,
              "knife": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                5,
                15
              ]
            },
            "reach_tier": "canopy",
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 360,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          }
        ]
      },
      {
        "name": "bark",
        "available_life_stages": [
          "sapling",
          "mature_vegetative",
          "mature_fruiting",
          "mature_seed_set",
          "mature_dormant"
        ],
        "sub_stages": [
          {
            "id": "rough",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "Thick, deeply furrowed dark bark forming an interlacing diamond pattern.",
            "game_description": "Rich in tannins and juglone. Can be used for a dark dye or a medicinal tea.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 50,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "woody",
            "taste_notes": [
              "bitter"
            ],
            "scent_notes": [
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 10,
            "harvest_tool_modifiers": {
              "axe": 1.5,
              "knife": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                2,
                6
              ],
              "actions_until_depleted": [
                4,
                10
              ]
            },
            "reach_tier": "elevated",
            "harvest_damage": 0.3,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 300,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          }
        ]
      },
      {
        "name": "root",
        "available_life_stages": [
          "seedling",
          "sapling",
          "mature_vegetative",
          "mature_fruiting",
          "mature_seed_set",
          "mature_dormant"
        ],
        "sub_stages": [
          {
            "id": "woody",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A thick, deep taproot branching into dark, heavy lateral roots.",
            "game_description": "Tough, woody roots. Inedible and exceptionally difficult to dig up.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 500,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "woody",
            "taste_notes": [],
            "scent_notes": [
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 15,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                2,
                5
              ]
            },
            "harvest_damage": 0.8,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 45,
            "decay_days": 100,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          }
        ]
      },
      {
        "name": "whole_fruit",
        "available_life_stages": [
          "mature_fruiting",
          "mature_seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "mid_summer",
              "end": "early_fall"
            },
            "field_description": "A large, heavy, bright green sphere. The thick fleshy husk smells sharply of citrus and spice.",
            "game_description": "The thick green husk surrounds a hard shell and must be extracted before cracking. The green husk is highly toxic to eat but can be used as a strong medicinal poultice or dye. Extremely staining.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 100,
            "nutrition": {
              "calories": 33,
              "protein": 1.2,
              "carbs": 0.7,
              "fat": 3.3
            },
            "processing_options": [
              {
                "id": "remove_husk",
                "ticks": 20,
                "location": "hand",
                "outputs": [
                  {
                    "part": "husked_nut",
                    "yield_fraction": 0.25,
                    "output_unit_weight_g": 25
                  },
                  {
                    "part": "husk",
                    "yield_fraction": 0.75,
                    "output_unit_weight_g": 75
                  }
                ]
              }
            ],
            "texture": "firm",
            "taste_notes": [
              "bitter",
              "astringent"
            ],
            "scent_notes": [
              "pungent",
              "citrus"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 2,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                8,
                20
              ],
              "actions_until_depleted": [
                15,
                30
              ]
            },
            "reach_tier": "canopy",
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 10,
            "can_dry": false,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0,
            "cooked_edibility_score": 0,
            "cooked_harshness": 1,
            "cooking_detoxifies": false
          },
          {
            "id": "black",
            "seasonal_window": {
              "start": "mid_fall",
              "end": "winter"
            },
            "field_description": "A dark brown to black, mushy or dried spherical husk. It smells pungent and earthy.",
            "game_description": "The black husk surrounds a hard shell. Must be extracted before cracking. The rotting husk stains intensely.",
            "edibility_score": 0,
            "edibility_harshness": 0.9,
            "potency_multiplier": 1,
            "reach_tier": "canopy",
            "harvest_yield": {
              "units_per_action": [
                8,
                20
              ],
              "actions_until_depleted": [
                15,
                30
              ]
            },
            "harvest_damage": 0,
            "decay_days": 20,
            "can_dry": true
          }
        ]
      },
      {
        "name": "husked_nut",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "whole",
            "field_description": "A very hard, heavily ridged, dark brown nut shell.",
            "game_description": "Extremely difficult to crack open. Requires a mortar and pestle or heavy tool. Contains calorie-dense, oily nut meat.",
            "edibility_score": 0,
            "edibility_harshness": 0.5,
            "unit_weight_g": 25,
            "nutrition": {
              "calories": 33,
              "protein": 1.2,
              "carbs": 0.7,
              "fat": 3.3
            },
            "processing_options": [
              {
                "id": "crack_shell",
                "ticks": 40,
                "location": "mortar_pestle",
                "outputs": [
                  {
                    "part": "walnut_meat",
                    "yield_fraction": 0.2,
                    "output_unit_weight_g": 5
                  },
                  {
                    "part": "nutshell",
                    "yield_fraction": 0.8,
                    "output_unit_weight_g": 20
                  }
                ]
              }
            ],
            "texture": "hard",
            "taste_notes": [
              "woody"
            ],
            "scent_notes": [
              "dry"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_squirrel_cache": true,
            "decay_days": 300,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          }
        ]
      },
      {
        "name": "walnut_meat",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "raw",
            "field_description": "Rich, oily, intricately folded nut meat. Darker than most nuts.",
            "game_description": "Highly nutritious, oily, and calorie-dense. Excellent raw or cooked. Stores very well once extracted.",
            "edibility_score": 1,
            "edibility_harshness": 0,
            "unit_weight_g": 5,
            "nutrition": {
              "calories": 33,
              "protein": 1.2,
              "carbs": 0.7,
              "fat": 3.3
            },
            "texture": "crunchy",
            "taste_notes": [
              "rich",
              "nutty",
              "earthy"
            ],
            "scent_notes": [
              "nutty",
              "oily"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 120,
            "can_dry": true,
            "stew_nutrition_factor": 1,
            "raw_extraction_efficiency": 1
          }
        ]
      },
      {
        "name": "husk",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "raw",
            "field_description": "Chunks of thick, fibrous green or black husk. Stains everything it touches a dark brown.",
            "game_description": "Highly astringent and toxic to consume. Can be used to make a medicinal poultice or dark dye.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 75,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "fleshy",
            "taste_notes": [
              "bitter",
              "astringent"
            ],
            "scent_notes": [
              "pungent",
              "citrus"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 2,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 15,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          }
        ]
      },
      {
        "name": "nutshell",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "broken",
            "field_description": "Thick, woody, deeply ridged shell fragments.",
            "game_description": "Inedible. The hard woody fragments make decent, slow-burning tinder.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 20,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "hard",
            "taste_notes": [
              "woody"
            ],
            "scent_notes": [
              "dry"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [
              "tinder"
            ],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 500,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          }
        ]
      }
    ]
  },
  {
    "id": "urtica_dioica",
    "name": "Stinging Nettle",
    "longevity": "perennial",
    "age_of_maturity": 10,
    "soil": {
      "ph_range": [
        5.5,
        8
      ],
      "drainage": {
        "tolerance_range": [
          0.1,
          0.75
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.55,
          1
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.5,
          1
        ]
      },
      "shade": {
        "tolerance_range": [
          0.15,
          0.85
        ]
      }
    },
    "seeding_window": {
      "start": "late_summer",
      "end": "early_fall"
    },
    "dispersal": {
      "method": "wind",
      "base_radius_tiles": 4,
      "wind_radius_bonus": 3,
      "water_dispersed": true,
      "animal_dispersed": true,
      "seeds_per_mature_plant": [
        500,
        2000
      ],
      "germination_rate": 0.4,
      "germination_season": "spring",
      "requires_disturbance": true,
      "pioneer": true,
      "viable_lifespan_days": 1800
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "Small opposite leaves with prominent veins emerging from the soil. Even at this size, stinging hairs are visible along the stems and leaves."
      },
      {
        "stage": "vegetative",
        "min_age_days": 10,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 15
        },
        "size": 2,
        "field_description": "A rapidly growing upright stalk bearing heavily veined, serrated green leaves covered in fine, glass-like bristles."
      },
      {
        "stage": "flowering",
        "min_age_days": 11,
        "seasonal_window": {
          "start_day": 16,
          "end_day": 25
        },
        "size": 3,
        "field_description": "Tall leafy stalks with tiny, drooping clusters of greenish-white flowers emerging from the leaf axils. The plant is dense and bristling with stinging hairs."
      },
      {
        "stage": "seed_set",
        "min_age_days": 12,
        "seasonal_window": {
          "start_day": 26,
          "end_day": 30
        },
        "size": 3,
        "field_description": "The drooping flower clusters have turned into dense, heavy strings of tiny green and brown seeds."
      },
      {
        "stage": "senescent",
        "min_age_days": 13,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 35
        },
        "size": 2,
        "field_description": "The leaves are yellowing, curling, and dropping off, leaving behind tough, fibrous stalks."
      },
      {
        "stage": "dormant",
        "min_age_days": 14,
        "seasonal_window": {
          "start_day": 36,
          "end_day": 40
        },
        "size": 1,
        "field_description": "The above-ground plant has died back completely, leaving only a network of yellow rhizomes beneath the soil."
      }
    ],
    "parts": [
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "young",
            "seasonal_window": {
              "start": "early_spring",
              "end": "mid_spring"
            },
            "field_description": "Tender, bright green leaves covered in fine, glass-like hairs.",
            "game_description": "Painful to eat raw due to stinging hairs, causing harshness. Cooking completely destroys the sting, making it an edible and nutritious green.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.9,
            "cooked_edibility_score": 0.9,
            "cooked_harshness": 0.1,
            "unit_weight_g": 2,
            "nutrition": {
              "calories": 0.8,
              "protein": 0.05,
              "carbs": 0.14,
              "fat": 0.01
            },
            "texture": "tender",
            "taste_notes": [
              "earthy",
              "spinach-like"
            ],
            "scent_notes": [
              "green",
              "fresh"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {
              "knife": 1.5,
              "blickey": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                10,
                25
              ],
              "actions_until_depleted": [
                3,
                6
              ]
            },
            "harvest_damage": 0.2,
            "on_harvest_injury": {
              "type": "sting",
              "base_probability": 0.7,
              "health_hit": 0.02,
              "infection_chance": null,
              "debuff": null,
              "tool_probability_modifiers": {
                "knife": 0.4,
                "gloves": 0
              }
            },
            "regrowth_days": 5,
            "regrowth_max_harvests": 3,
            "decay_days": 3,
            "can_dry": true,
            "stew_nutrition_factor": 1.1,
            "cooking_detoxifies": true
          },
          {
            "id": "mature",
            "seasonal_window": {
              "start": "late_spring",
              "end": "late_summer"
            },
            "field_description": "Darker green leaves, slightly tough, with potent stinging hairs.",
            "game_description": "Tougher than spring leaves but still edible when cooked. The stings are more potent, causing severe harshness if eaten raw.",
            "edibility_harshness": 1,
            "unit_weight_g": 3,
            "nutrition": {
              "calories": 1.2,
              "protein": 0.08,
              "carbs": 0.2,
              "fat": 0.02
            },
            "texture": "fibrous",
            "taste_notes": [
              "earthy",
              "bitter"
            ],
            "scent_notes": [
              "green",
              "pungent"
            ],
            "potency_multiplier": 1.5,
            "harvest_damage": 0.3
          }
        ]
      },
      {
        "name": "stalk",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "seed_set",
          "senescent"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "mid_spring",
              "end": "mid_summer"
            },
            "field_description": "A sturdy, square-ish green stalk bristling with stinging hairs.",
            "game_description": "Contains strong fibers, but they are difficult to separate while the stalk is still green and alive.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 40,
            "nutrition": {
              "calories": 0.5,
              "protein": 0.02,
              "carbs": 0.1,
              "fat": 0
            },
            "texture": "fibrous",
            "taste_notes": [
              "bitter"
            ],
            "scent_notes": [
              "grassy",
              "pungent"
            ],
            "average_fiber_length_cm": 40,
            "fiber_strength_modifier": 1.5,
            "fiberous": true,
            "craft_tags": [
              "cordage_fiber"
            ],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 5,
            "harvest_tool_modifiers": {
              "knife": 2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                3
              ]
            },
            "harvest_damage": 0.8,
            "regrowth_days": 15,
            "regrowth_max_harvests": 1,
            "decay_days": 10,
            "can_dry": true,
            "stew_nutrition_factor": 0
          },
          {
            "id": "dry",
            "seasonal_window": {
              "start": "late_summer",
              "end": "winter"
            },
            "field_description": "A brown, dry, hollow stalk. The stinging hairs have mostly fallen off.",
            "game_description": "A source of strong, long fibers for cordage. Much easier to process than green stalks.",
            "unit_weight_g": 15,
            "nutrition": {
              "calories": 0.2,
              "protein": 0,
              "carbs": 0.05,
              "fat": 0
            },
            "texture": "woody",
            "taste_notes": [],
            "scent_notes": [
              "dry",
              "dusty"
            ],
            "potency_multiplier": 0.1,
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 60
          }
        ]
      },
      {
        "name": "root",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "seed_set",
          "senescent",
          "dormant"
        ],
        "sub_stages": [
          {
            "id": "rhizome",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "Creeping, bright yellow roots spreading horizontally through the soil.",
            "game_description": "Tough and fibrous. Contains minimal calories but can be steeped for mild medicinal effects.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.4,
            "unit_weight_g": 15,
            "nutrition": {
              "calories": 5,
              "protein": 0.1,
              "carbs": 1,
              "fat": 0
            },
            "texture": "tough",
            "taste_notes": [
              "earthy",
              "astringent"
            ],
            "scent_notes": [
              "dirt",
              "musky"
            ],
            "average_fiber_length_cm": 5,
            "fiber_strength_modifier": 0.2,
            "fiberous": true,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                2,
                5
              ],
              "actions_until_depleted": [
                2,
                4
              ]
            },
            "harvest_damage": 0.5,
            "regrowth_days": 20,
            "regrowth_max_harvests": 1,
            "dig_ticks_to_discover": 20,
            "decay_days": 14,
            "can_dry": true,
            "stew_nutrition_factor": 0.2
          }
        ]
      },
      {
        "name": "flower",
        "available_life_stages": [
          "flowering"
        ],
        "sub_stages": [
          {
            "id": "bloom",
            "seasonal_window": {
              "start": "mid_summer",
              "end": "late_summer"
            },
            "field_description": "Tiny, inconspicuous greenish-white flowers hanging in string-like clusters from the leaf axils.",
            "game_description": "Insignificant for food, though they can be steeped in tea.",
            "edibility_score": 0.2,
            "edibility_harshness": 0.3,
            "unit_weight_g": 0.5,
            "nutrition": {
              "calories": 0.1,
              "protein": 0,
              "carbs": 0.02,
              "fat": 0
            },
            "texture": "soft",
            "taste_notes": [
              "bland"
            ],
            "scent_notes": [
              "faint",
              "green"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {
              "knife": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                5,
                10
              ],
              "actions_until_depleted": [
                1,
                3
              ]
            },
            "harvest_damage": 0.05,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 2,
            "can_dry": true,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "seed",
        "available_life_stages": [
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "cluster",
            "seasonal_window": {
              "start": "late_summer",
              "end": "early_fall"
            },
            "field_description": "Drooping clusters of tiny, flat, oval-shaped green and brown seeds.",
            "game_description": "Very tiny but packed with calories. Can be eaten raw or added to stews, though gathering in quantity is slow work.",
            "edibility_score": 0.8,
            "edibility_harshness": 0.1,
            "unit_weight_g": 1,
            "nutrition": {
              "calories": 3.5,
              "protein": 0.2,
              "carbs": 0.5,
              "fat": 0.1
            },
            "texture": "gritty",
            "taste_notes": [
              "nutty"
            ],
            "scent_notes": [
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.2,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {
              "knife": 1.1
            },
            "harvest_yield": {
              "units_per_action": [
                5,
                15
              ],
              "actions_until_depleted": [
                2,
                4
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "does_blickey_help_harvest": true,
            "decay_days": 30,
            "can_dry": true,
            "stew_nutrition_factor": 1.2
          }
        ]
      }
    ]
  }
];

export default PLANT_CATALOG_SOURCE;
