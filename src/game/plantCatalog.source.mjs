const PLANT_CATALOG_SOURCE = [
  {
    "id": "aquilegia_canadensis",
    "name": "Red Columbine",
    "longevity": "perennial",
    "age_of_maturity": 41,
    "soil": {
      "ph_range": [
        5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.3,
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
          0.1,
          0.6
        ]
      },
      "shade": {
        "tolerance_range": [
          0.2,
          0.9
        ]
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.15
        ]
      }
    },
    "seeding_window": {
      "start": "late_summer",
      "end": "early_fall"
    },
    "dispersal": {
      "method": "gravity",
      "base_radius_tiles": 1,
      "wind_radius_bonus": 2,
      "water_dispersed": false,
      "animal_dispersed": false,
      "seeds_per_mature_plant": [
        40,
        150
      ],
      "germination_rate": 0.35,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": false,
      "viable_lifespan_days": 120
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A small cluster of delicate, lobed green leaflets emerging from the soil."
      },
      {
        "stage": "vegetative",
        "min_age_days": 41,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 10
        },
        "size": 3,
        "field_description": "A low, bushy array of compound, fern-like green leaves on slender, reddish stems."
      },
      {
        "stage": "flowering",
        "min_age_days": 42,
        "seasonal_window": {
          "start_day": 11,
          "end_day": 20
        },
        "size": 4,
        "field_description": "Tall, wiry stalks rise above the lobed foliage, bearing striking, nodding red and yellow flowers with long nectar spurs."
      },
      {
        "stage": "seed_set",
        "min_age_days": 43,
        "seasonal_window": {
          "start_day": 21,
          "end_day": 30
        },
        "size": 4,
        "field_description": "Upright, paper-thin follicle pods stand at the tips of the branching stems."
      },
      {
        "stage": "dormant",
        "min_age_days": 44,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 40
        },
        "size": 1,
        "field_description": "Only a small, dried remnant of a base is visible at the soil level."
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
              "end": "late_spring"
            },
            "field_description": "Delicate, light green compound leaves with rounded lobes, soft to the touch.",
            "game_description": "These greens contain harsh, toxic compounds that cause nausea when eaten raw. Cooking heavily reduces the toxicity, but they remain extremely poor food.",
            "edibility_score": 0.2,
            "edibility_harshness": 0.8,
            "unit_weight_g": 0.5,
            "nutrition": {
              "calories": 0.1,
              "protein": 0.01,
              "carbs": 0.02,
              "fat": 0
            },
            "texture": "tender",
            "taste_notes": [
              "bitter",
              "astringent"
            ],
            "scent_notes": [
              "green",
              "pungent"
            ],
            "average_fiber_length_cm": 1.5,
            "fiber_strength_modifier": 0.2,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.8,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
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
            "regrowth_days": 10,
            "regrowth_max_harvests": 2,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 3,
            "can_dry": true,
            "raw_extraction_efficiency": 0.8,
            "stew_nutrition_factor": 1.2,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.4,
            "cooked_harshness": 0.3
          },
          {
            "id": "mature",
            "seasonal_window": {
              "start": "early_summer",
              "end": "late_fall"
            },
            "field_description": "Darker green leaves, slightly tougher and more deeply lobed, supported by thin reddish stems.",
            "game_description": "Older leaves are more fibrous and have stronger toxic compounds. Best avoided even when cooked.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.9,
            "texture": "fibrous",
            "taste_notes": [
              "very bitter",
              "acrid"
            ],
            "potency_multiplier": 1.2,
            "cooked_edibility_score": 0.2,
            "cooked_harshness": 0.6
          }
        ]
      },
      {
        "name": "stem",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "mid_summer"
            },
            "field_description": "A slender, wiry stem with a reddish-purple hue.",
            "game_description": "Inedible, fibrous stalk with weak strands. Contains mild toxic compounds.",
            "edibility_score": 0.05,
            "edibility_harshness": 0.95,
            "unit_weight_g": 3,
            "nutrition": {
              "calories": 0.5,
              "protein": 0.02,
              "carbs": 0.1,
              "fat": 0
            },
            "texture": "fibrous",
            "taste_notes": [
              "bitter",
              "woody"
            ],
            "scent_notes": [
              "faintly green"
            ],
            "average_fiber_length_cm": 5,
            "fiber_strength_modifier": 0.3,
            "fibrous": true,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
            "harvest_requires_any_tools": [],
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
            "harvest_damage": 0.3,
            "regrowth_days": 15,
            "regrowth_max_harvests": 1,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 4,
            "can_dry": true,
            "raw_extraction_efficiency": 0.2,
            "stew_nutrition_factor": 0.4,
            "cooking_detoxifies": true
          },
          {
            "id": "dry",
            "seasonal_window": {
              "start": "late_summer",
              "end": "late_fall"
            },
            "field_description": "A brown, dry, and brittle stalk, hollow and easily snapped.",
            "game_description": "Inedible dry stalk. Can be crushed and used as a small amount of tinder.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 2,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "brittle",
            "taste_notes": [],
            "scent_notes": [
              "dusty"
            ],
            "craft_tags": [
              "tinder"
            ],
            "potency_multiplier": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "raw_extraction_efficiency": 0,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "root",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "seed_set",
          "dormant"
        ],
        "sub_stages": [
          {
            "id": "fibrous",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A pale, branching taproot system with many fine hairs. Smells sharp and earthy when broken.",
            "game_description": "Highly concentrated with bitter toxins, rendering it entirely inedible. However, very small, carefully measured portions can be brewed into an analgesic tea.",
            "edibility_score": 0.1,
            "edibility_harshness": 1,
            "unit_weight_g": 15,
            "nutrition": {
              "calories": 6,
              "protein": 0.1,
              "carbs": 1.4,
              "fat": 0
            },
            "texture": "woody",
            "taste_notes": [
              "extremely bitter",
              "burning"
            ],
            "scent_notes": [
              "sharp",
              "earthy"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.2,
            "fibrous": true,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 2,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
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
            "dig_ticks_to_discover": 25,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 14,
            "can_dry": true,
            "raw_extraction_efficiency": 0.1,
            "stew_nutrition_factor": 0.4,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.15,
            "cooked_harshness": 0.8
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
            "id": "blooming",
            "seasonal_window": {
              "start": "mid_spring",
              "end": "mid_summer"
            },
            "field_description": "A complex, nodding flower with vibrant red sepals and yellow petals that extend upward into distinctive spurs containing nectar.",
            "game_description": "The nectar spurs are sweet, but the flower still contains mild toxic compounds. Best enjoyed sparingly.",
            "edibility_score": 0.6,
            "edibility_harshness": 0.4,
            "unit_weight_g": 0.2,
            "nutrition": {
              "calories": 0.1,
              "protein": 0,
              "carbs": 0.02,
              "fat": 0
            },
            "texture": "soft",
            "taste_notes": [
              "sweet",
              "slightly bitter"
            ],
            "scent_notes": [
              "floral",
              "sweet"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.3,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                2,
                5
              ]
            },
            "harvest_damage": 0.05,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 2,
            "can_dry": false,
            "raw_extraction_efficiency": 1,
            "stew_nutrition_factor": 1,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.7,
            "cooked_harshness": 0.1
          }
        ]
      },
      {
        "name": "pod",
        "available_life_stages": [
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "mid_summer",
              "end": "late_summer"
            },
            "field_description": "A cluster of five upright, light green follicles, fused at the base and swelling with developing seeds.",
            "game_description": "Inedible green seed capsules containing toxic precursors. Let them dry to harvest the seeds for medicinal use.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 0.8,
            "nutrition": {
              "calories": 0.4,
              "protein": 0.02,
              "carbs": 0.08,
              "fat": 0.02
            },
            "texture": "leathery",
            "taste_notes": [
              "extremely bitter"
            ],
            "scent_notes": [
              "acrid",
              "green"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": {
              "units_per_action": [
                1,
                4
              ],
              "actions_until_depleted": [
                1,
                3
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 4,
            "can_dry": true,
            "raw_extraction_efficiency": 0,
            "stew_nutrition_factor": 0
          },
          {
            "id": "dry",
            "seasonal_window": {
              "start": "early_fall",
              "end": "late_fall"
            },
            "field_description": "Brown, papery, upright follicles that have split open slightly at the top, exposing tiny black seeds inside.",
            "game_description": "Dry capsules holding potent, medicinally useful seeds. Must be processed by hand to extract the tiny seeds.",
            "unit_weight_g": 0.5,
            "nutrition": {
              "calories": 0.4,
              "protein": 0.02,
              "carbs": 0.04,
              "fat": 0.02
            },
            "texture": "papery",
            "scent_notes": [
              "dry",
              "dusty"
            ],
            "processing_options": [
              {
                "id": "extract_seeds",
                "ticks": 15,
                "location": "hand",
                "outputs": [
                  {
                    "part": "seed",
                    "yield_fraction": 0.2,
                    "output_unit_weight_g": 0.1
                  },
                  {
                    "part": "pod_husk",
                    "yield_fraction": 0.8,
                    "output_unit_weight_g": 0.4
                  }
                ]
              }
            ],
            "decay_days": 120
          }
        ]
      },
      {
        "name": "seed",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "extracted",
            "field_description": "Tiny, glossy black seeds.",
            "game_description": "Potent seeds that can relieve pain if brewed into a tea in very small doses. Larger quantities will induce severe vomiting.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 0.1,
            "nutrition": {
              "calories": 0.4,
              "protein": 0.02,
              "carbs": 0.04,
              "fat": 0.02
            },
            "texture": "hard",
            "taste_notes": [
              "sharp",
              "bitter"
            ],
            "scent_notes": [
              "faintly peppery"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 4,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 180,
            "can_dry": true,
            "raw_extraction_efficiency": 0.2,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "pod_husk",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "empty",
            "field_description": "The dried, empty brown shell of a columbine follicle.",
            "game_description": "Inedible papery waste. It has no practical use.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 0.4,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "papery",
            "taste_notes": [],
            "scent_notes": [
              "dusty"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.1,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "can_dry": true,
            "raw_extraction_efficiency": 0,
            "stew_nutrition_factor": 0
          }
        ]
      }
    ],
    "physical_description": "A delicate woodland perennial with fern-like, compound foliage. It produces striking nodding flowers with vivid red sepals and yellow petals that feature elongated, upward-pointing nectar spurs.",
    "game_description": "While visually striking, most parts of this plant contain bitter, toxic compounds that cause severe nausea if consumed in quantity. The tiny seeds and roots possess mild medicinal properties, serving as a pain reliever if carefully dosed, but it remains a hazard to unwary foragers.",
    "scent": {
      "strength": 0.1,
      "primary_compound": "caryophyllene"
    }
  },
  {
    "id": "asarum_canadense",
    "name": "Wild Ginger",
    "longevity": "perennial",
    "age_of_maturity": 41,
    "soil": {
      "ph_range": [
        5,
        7
      ],
      "drainage": {
        "tolerance_range": [
          0.4,
          0.8
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.5,
          0.9
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.5,
          0.9
        ]
      },
      "shade": {
        "tolerance_range": [
          0.6,
          1
        ]
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.1
        ]
      }
    },
    "seeding_window": {
      "start": "early_fall",
      "end": "mid_fall"
    },
    "dispersal": {
      "method": "animal_cached",
      "base_radius_tiles": 2,
      "wind_radius_bonus": 0,
      "water_dispersed": false,
      "animal_dispersed": true,
      "seeds_per_mature_plant": [
        10,
        30
      ],
      "germination_rate": 0.4,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": false,
      "viable_lifespan_days": 90
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A tiny plant with a single pair of fuzzy green leaves near the soil."
      },
      {
        "stage": "vegetative",
        "min_age_days": 41,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 10
        },
        "size": 1,
        "field_description": "A low plant with two large, velvety, heart-shaped leaves on hairy stalks."
      },
      {
        "stage": "flowering",
        "min_age_days": 42,
        "seasonal_window": {
          "start_day": 11,
          "end_day": 20
        },
        "size": 1,
        "field_description": "Two large fuzzy leaves shade a single maroon, bell-shaped flower resting near the ground."
      },
      {
        "stage": "fruiting",
        "min_age_days": 43,
        "seasonal_window": {
          "start_day": 21,
          "end_day": 30
        },
        "size": 1,
        "field_description": "The maroon flower has been replaced by a fleshy capsule containing seeds, still hidden under the large leaves."
      },
      {
        "stage": "dormant",
        "min_age_days": 44,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 40
        },
        "size": 1,
        "field_description": "Above-ground parts have died back entirely, leaving only the creeping rhizomes hidden beneath the soil."
      }
    ],
    "parts": [
      {
        "name": "root",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "fruiting",
          "dormant"
        ],
        "sub_stages": [
          {
            "id": "rhizome",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A knobby, branching rhizome with a pale interior. Emits a strong spicy scent when snapped.",
            "game_description": "The highly aromatic root can be used as a spice or brewed into a medicinal tea to break fevers, but contains compounds that are toxic to the kidneys if consumed in quantity.",
            "edibility_score": 0.3,
            "edibility_harshness": 0.8,
            "cooked_edibility_score": 0.6,
            "cooked_harshness": 0.5,
            "unit_weight_g": 10,
            "nutrition": {
              "calories": 3,
              "protein": 0.1,
              "carbs": 0.6,
              "fat": 0.05
            },
            "raw_extraction_efficiency": 0.2,
            "stew_nutrition_factor": 1.2,
            "texture": "crisp and fibrous",
            "taste_notes": [
              "spicy",
              "pungent",
              "bitter"
            ],
            "scent_notes": [
              "ginger",
              "aromatic",
              "earthy"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.2,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0.8,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 20,
            "decay_days": 14,
            "can_dry": true
          }
        ]
      },
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "fruiting"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_fall"
            },
            "field_description": "A large, soft, heart-shaped leaf covered in fine hairs.",
            "game_description": "The large leaves are fuzzy and somewhat unpleasant to eat, but they can be used to wrap small items.",
            "edibility_score": 0.5,
            "edibility_harshness": 0.4,
            "cooked_edibility_score": 0.7,
            "cooked_harshness": 0.2,
            "unit_weight_g": 4,
            "nutrition": {
              "calories": 0.8,
              "protein": 0.1,
              "carbs": 0.1,
              "fat": 0
            },
            "stew_nutrition_factor": 1.05,
            "texture": "fuzzy",
            "taste_notes": [
              "mild",
              "bitter"
            ],
            "scent_notes": [
              "green",
              "faintly spicy"
            ],
            "average_fiber_length_cm": 1,
            "fiber_strength_modifier": 0.1,
            "fibrous": false,
            "craft_tags": [
              "large_leaf"
            ],
            "ingestion": null,
            "potency_multiplier": 0.1,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {
              "knife": 1.2,
              "blickey": 1.1
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0.3,
            "regrowth_days": 15,
            "regrowth_max_harvests": 2,
            "decay_days": 3,
            "can_dry": true
          }
        ]
      },
      {
        "name": "stem",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "fruiting"
        ],
        "sub_stages": [
          {
            "id": "petiole",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_fall"
            },
            "field_description": "A short, hairy green stalk supporting the leaf.",
            "game_description": "Fibrous and minimally nutritious. Can be chewed or added to stew, but lacks strong utility.",
            "edibility_score": 0.4,
            "edibility_harshness": 0.3,
            "cooked_edibility_score": 0.6,
            "cooked_harshness": 0.1,
            "unit_weight_g": 2,
            "nutrition": {
              "calories": 0.4,
              "protein": 0,
              "carbs": 0.1,
              "fat": 0
            },
            "texture": "fibrous and fuzzy",
            "taste_notes": [
              "bland",
              "green"
            ],
            "scent_notes": [
              "faintly spicy"
            ],
            "average_fiber_length_cm": 3,
            "fiber_strength_modifier": 0.3,
            "fibrous": true,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.1,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0.2,
            "regrowth_days": 15,
            "regrowth_max_harvests": 2,
            "decay_days": 4,
            "can_dry": false
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
              "start": "early_summer",
              "end": "late_summer"
            },
            "field_description": "A small, three-pointed, bell-shaped flower, maroon or brown in color, resting near the soil surface.",
            "game_description": "An unusual ground-level flower. Edible in a pinch, but barely provides a bite.",
            "edibility_score": 0.6,
            "edibility_harshness": 0.2,
            "unit_weight_g": 1,
            "nutrition": {
              "calories": 0.2,
              "protein": 0,
              "carbs": 0.05,
              "fat": 0
            },
            "texture": "velvety",
            "taste_notes": [
              "earthy",
              "bland"
            ],
            "scent_notes": [
              "musty"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
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
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 2,
            "can_dry": false
          }
        ]
      },
      {
        "name": "fruit",
        "available_life_stages": [
          "fruiting"
        ],
        "sub_stages": [
          {
            "id": "capsule",
            "seasonal_window": {
              "start": "early_fall",
              "end": "late_fall"
            },
            "field_description": "A fleshy, round capsule containing several seeds.",
            "game_description": "A small seed capsule. It is edible but has very low caloric value.",
            "edibility_score": 0.6,
            "edibility_harshness": 0.3,
            "unit_weight_g": 3,
            "nutrition": {
              "calories": 1.5,
              "protein": 0.1,
              "carbs": 0.2,
              "fat": 0.1
            },
            "texture": "fleshy",
            "taste_notes": [
              "bland",
              "slightly bitter"
            ],
            "scent_notes": [
              "green"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.1,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
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
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 3,
            "can_dry": false
          }
        ]
      }
    ],
    "physical_description": "A low-growing herbaceous perennial with a pair of large, velvety, heart-shaped leaves. A single reddish-brown, bell-shaped flower hides close to the ground near the stem base. The creeping rhizomes smell strongly of ginger.",
    "game_description": "The root can be used as a strong, spicy flavoring or brewed into a medicinal tea to break fevers. However, consuming large quantities over time causes kidney damage. Its large fuzzy leaves provide minimal nutrition but can serve as light wrapping material.",
    "scent": {
      "strength": 0.8,
      "primary_compound": "asarone"
    }
  },
  {
    "id": "asclepias_syriaca",
    "name": "Common Milkweed",
    "longevity": "perennial",
    "age_of_maturity": 10,
    "soil": {
      "ph_range": [
        5.5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0,
          1
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.3,
          0.9
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.3,
          0.8
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.3
        ]
      },
      "salinity": {
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
      "method": "wind",
      "base_radius_tiles": 20,
      "wind_radius_bonus": 10,
      "water_dispersed": false,
      "animal_dispersed": false,
      "seeds_per_mature_plant": [
        100,
        300
      ],
      "germination_rate": 0.4,
      "germination_season": "spring",
      "requires_disturbance": true,
      "pioneer": true,
      "viable_lifespan_days": 240
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A small green shoot with a few oval leaves."
      },
      {
        "stage": "vegetative",
        "min_age_days": 10,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 10
        },
        "size": 3,
        "field_description": "Full plant from soil line to top: one stout unbranched green stem with large thick oval leaves in opposite pairs; vegetative milkweed with leaves and stem only, no buds, flowers, or pods."
      },
      {
        "stage": "flowering",
        "min_age_days": 11,
        "seasonal_window": {
          "start_day": 11,
          "end_day": 18
        },
        "size": 4,
        "field_description": "A stout stalk with large leaves and drooping umbels of complex, sweet-smelling pinkish-purple flowers."
      },
      {
        "stage": "fruiting",
        "min_age_days": 19,
        "seasonal_window": {
          "start_day": 19,
          "end_day": 24
        },
        "size": 4,
        "field_description": "A tall stalk bearing large teardrop-shaped green pods covered in soft bumps."
      },
      {
        "stage": "seed_set",
        "min_age_days": 25,
        "seasonal_window": {
          "start_day": 25,
          "end_day": 30
        },
        "size": 4,
        "field_description": "The large pods have dried, turning brown and beginning to split down one side to reveal tightly packed seeds and white fluff."
      },
      {
        "stage": "senescent",
        "min_age_days": 31,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 35
        },
        "size": 3,
        "field_description": "A dead, dry, greyish stalk standing in the wind. Empty, split pod husks cling to the top."
      },
      {
        "stage": "dormant",
        "min_age_days": 36,
        "seasonal_window": {
          "start_day": 36,
          "end_day": 40
        },
        "size": 1,
        "field_description": "Nothing remains above ground; only the deep rhizomes wait beneath the soil."
      }
    ],
    "parts": [
      {
        "name": "shoot",
        "available_life_stages": [
          "vegetative"
        ],
        "sub_stages": [
          {
            "id": "young",
            "seasonal_window": {
              "start": "early_spring",
              "end": "mid_spring"
            },
            "field_description": "A single short tender thick green shoot emerging straight from visible soil with only small folded baby leaves at the tip; one young sprout, not a mature branched plant.",
            "game_description": "Highly toxic and nauseating raw, but transforms into an excellent, mild vegetable when cooked in a stew.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.9,
            "unit_weight_g": 25,
            "nutrition": {
              "calories": 7.5,
              "protein": 0.8,
              "carbs": 1.2,
              "fat": 0.1
            },
            "texture": "tender",
            "taste_notes": [
              "bitter",
              "milky"
            ],
            "scent_notes": [
              "fresh",
              "green"
            ],
            "average_fiber_length_cm": 5,
            "fiber_strength_modifier": 0.5,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
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
            "harvest_damage": 0.5,
            "regrowth_days": 15,
            "regrowth_max_harvests": 1,
            "decay_days": 3,
            "can_dry": false,
            "stew_nutrition_factor": 1.1,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.85,
            "cooked_harshness": 0.1
          }
        ]
      },
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "fruiting",
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "young",
            "seasonal_window": {
              "start": "early_spring",
              "end": "early_summer"
            },
            "field_description": "Thick, downy, bright green leaves. A milky latex wells up immediately when torn.",
            "game_description": "Toxic raw, but the youngest leaves become edible and nutritious if cooked.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.9,
            "unit_weight_g": 3,
            "nutrition": {
              "calories": 1,
              "protein": 0.1,
              "carbs": 0.2,
              "fat": 0
            },
            "texture": "soft",
            "taste_notes": [
              "bitter"
            ],
            "scent_notes": [
              "green"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.3,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                2,
                8
              ],
              "actions_until_depleted": [
                3,
                6
              ]
            },
            "harvest_damage": 0.2,
            "regrowth_days": 10,
            "regrowth_max_harvests": 2,
            "decay_days": 3,
            "can_dry": false,
            "stew_nutrition_factor": 1.1,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.7,
            "cooked_harshness": 0.2
          },
          {
            "id": "mature",
            "seasonal_window": {
              "start": "mid_summer",
              "end": "mid_fall"
            },
            "field_description": "Large, dark green, somewhat leathery leaves that snap crisply, leaking copious white sap.",
            "game_description": "Too tough, bitter, and highly toxic to eat, even when cooked extensively.",
            "cooked_edibility_score": 0,
            "cooked_harshness": 1,
            "potency_multiplier": 3,
            "texture": "leathery",
            "cooking_detoxifies": false
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
            "id": "fresh",
            "seasonal_window": {
              "start": "early_summer",
              "end": "mid_summer"
            },
            "field_description": "A dense, heavy umbel of intricate pink and purple star-like flowers. Intensely fragrant.",
            "game_description": "The flower clusters can be cooked down into a sweet, slightly thick addition to stews.",
            "edibility_score": 0.3,
            "edibility_harshness": 0.5,
            "unit_weight_g": 10,
            "nutrition": {
              "calories": 3,
              "protein": 0.1,
              "carbs": 0.6,
              "fat": 0
            },
            "texture": "soft",
            "taste_notes": [
              "sweet",
              "floral"
            ],
            "scent_notes": [
              "sweet",
              "overpowering"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 1,
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
            "stew_nutrition_factor": 1.2,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.85,
            "cooked_harshness": 0.1
          }
        ]
      },
      {
        "name": "pod",
        "available_life_stages": [
          "fruiting",
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "late_summer",
              "end": "early_fall"
            },
            "field_description": "A firm, pale green pod shaped like a teardrop, covered in soft, fleshy spikes. Small immature seeds inside.",
            "game_description": "Firm and entirely inedible raw, but cooking the green pods transforms them into a mild, tender food similar to okra.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.9,
            "unit_weight_g": 25,
            "nutrition": {
              "calories": 8,
              "protein": 0.5,
              "carbs": 1.5,
              "fat": 0.1
            },
            "texture": "firm",
            "taste_notes": [
              "bitter"
            ],
            "scent_notes": [
              "green"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.2,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {
              "knife": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                2,
                6
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 4,
            "can_dry": false,
            "stew_nutrition_factor": 1.1,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.9,
            "cooked_harshness": 0.05
          },
          {
            "id": "dry",
            "seasonal_window": {
              "start": "mid_fall",
              "end": "late_fall"
            },
            "field_description": "A large, brown, splitting pod packed tightly with hundreds of flat seeds and brilliant white, silky fluff.",
            "game_description": "The dry pod has no food value, but breaking it open yields exceptional tinder and insulation material from the fluff.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 20,
            "nutrition": {
              "calories": 30,
              "protein": 1,
              "carbs": 3,
              "fat": 1
            },
            "processing_options": [
              {
                "id": "extract_fluff",
                "ticks": 20,
                "location": "hand",
                "outputs": [
                  {
                    "part": "seed",
                    "yield_fraction": 0.3,
                    "output_unit_weight_g": 0.1
                  },
                  {
                    "part": "fluff",
                    "yield_fraction": 0.2,
                    "output_unit_weight_g": 0.1
                  },
                  {
                    "part": "pod_husk",
                    "yield_fraction": 0.5,
                    "output_unit_weight_g": 10
                  }
                ]
              }
            ],
            "texture": "dry",
            "taste_notes": [
              "dusty"
            ],
            "scent_notes": [
              "dusty"
            ],
            "decay_days": 90,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "cooking_detoxifies": false,
            "cooked_edibility_score": 0,
            "cooked_harshness": 1
          }
        ]
      },
      {
        "name": "stalk",
        "available_life_stages": [
          "senescent"
        ],
        "sub_stages": [
          {
            "id": "dry",
            "seasonal_window": {
              "start": "early_winter",
              "end": "winter"
            },
            "field_description": "A tall, dead, greyish-white stalk. The outer skin is beginning to peel away in long, incredibly strong silver threads.",
            "game_description": "Inedible. The dried winter stalk contains some of the strongest natural bast fibers available, perfect for twisting into durable cordage.",
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
            "taste_notes": [],
            "scent_notes": [
              "dry"
            ],
            "average_fiber_length_cm": 25,
            "fiber_strength_modifier": 1.8,
            "craft_tags": [
              "cordage_fiber"
            ],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {
              "knife": 1.5,
              "axe": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                1
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "root",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "fruiting",
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
            "field_description": "A deeply buried, tough, creeping pale rhizome that rapidly oozes white latex when cut.",
            "game_description": "Extremely bitter, woody, and intensely toxic. Provides no food or utility.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 40,
            "nutrition": {
              "calories": 20,
              "protein": 0.5,
              "carbs": 4,
              "fat": 0.2
            },
            "texture": "woody",
            "taste_notes": [
              "acrid",
              "bitter"
            ],
            "scent_notes": [
              "earthy",
              "pungent"
            ],
            "average_fiber_length_cm": 3,
            "fiber_strength_modifier": 0.4,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 5,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 25,
            "decay_days": 15,
            "can_dry": false,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "seed",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "dry",
            "field_description": "A small, flat, reddish-brown seed.",
            "game_description": "Toxic and bitter, offering almost no calories. Not worth eating.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 0.1,
            "nutrition": {
              "calories": 0.5,
              "protein": 0.01,
              "carbs": 0.05,
              "fat": 0.02
            },
            "texture": "hard",
            "taste_notes": [
              "bitter"
            ],
            "scent_notes": [],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 3,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 90,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "fluff",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "dry",
            "field_description": "A brilliantly white, incredibly soft and weightless bundle of silky fibers.",
            "game_description": "Inedible, but serves as peerless insulation for coats and catches a spark beautifully as tinder.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 0.1,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "soft",
            "taste_notes": [],
            "scent_notes": [],
            "average_fiber_length_cm": 4,
            "fiber_strength_modifier": 0.1,
            "craft_tags": [
              "insulation_material",
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
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "pod_husk",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "dry",
            "field_description": "One empty dry brittle curved brown milkweed pod shell after seeds have gone; no seeds, no white fluff, no seed mass visible.",
            "game_description": "Inedible and largely useless, though it could be burned.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 10,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "papery",
            "taste_notes": [],
            "scent_notes": [
              "dusty"
            ],
            "average_fiber_length_cm": 1,
            "fiber_strength_modifier": 0.1,
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
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      }
    ],
    "physical_description": "A stout, upright herbaceous perennial with large, thick, broad, oppositely arranged leaves. Exudes a thick white milky sap when broken. Globular clusters of complex pinkish-purple flowers bloom in summer. Produces large teardrop-shaped green pods that dry and split to release flat seeds with silky white tufts.",
    "game_description": "A highly versatile plant offering food, high-quality fiber, and superb insulation. Young shoots, leaves, and green pods are excellent food when boiled, but cooking is absolutely required to neutralize the toxic, bitter sap. Mature parts are too toxic even when cooked. The dead winter stalks yield superior cordage fiber, and the pod fluff is unmatched tinder and coat insulation.",
    "scent": {
      "strength": 0.6,
      "primary_compound": "linalool"
    }
  },
  {
    "id": "corylus_americana",
    "name": "American Hazelnut",
    "longevity": "perennial",
    "age_of_maturity": 120,
    "soil": {
      "ph_range": [
        5.5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.3,
          0.8
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.3,
          0.9
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.3,
          0.8
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.6
        ]
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.15
        ]
      }
    },
    "seeding_window": {
      "start": "late_summer",
      "end": "early_fall"
    },
    "dispersal": {
      "method": "animal_cached",
      "base_radius_tiles": 15,
      "wind_radius_bonus": 0,
      "water_dispersed": false,
      "animal_dispersed": true,
      "seeds_per_mature_plant": [
        20,
        60
      ],
      "germination_rate": 0.3,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": true,
      "viable_lifespan_days": 360
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A small sapling with a few oval, fuzzy leaves."
      },
      {
        "stage": "sapling",
        "min_age_days": 120,
        "seasonal_window": null,
        "size": 4,
        "field_description": "A multi-stemmed young shrub with oval leaves, but no catkins or nuts."
      },
      {
        "stage": "mature_flowering",
        "min_age_days": 201,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 10
        },
        "size": 6,
        "field_description": "A mature shrub with bare stems displaying long, yellowish-brown drooping male catkins."
      },
      {
        "stage": "mature_fruiting",
        "min_age_days": 202,
        "seasonal_window": {
          "start_day": 11,
          "end_day": 25
        },
        "size": 6,
        "field_description": "A dense shrub with broad oval leaves. Clusters of green, leafy involucres surround the nuts."
      },
      {
        "stage": "mature_seed_set",
        "min_age_days": 203,
        "seasonal_window": {
          "start_day": 26,
          "end_day": 30
        },
        "size": 6,
        "field_description": "A dense shrub. The leafy husks enclosing the nuts have turned brown and are beginning to open and drop their seeds."
      },
      {
        "stage": "mature_dormant",
        "min_age_days": 204,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 40
        },
        "size": 6,
        "field_description": "A bare, multi-stemmed shrub resting for the winter. Small, tight buds are visible on the twigs."
      }
    ],
    "parts": [
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "sapling",
          "mature_flowering",
          "mature_fruiting",
          "mature_seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "mid_spring",
              "end": "late_summer"
            },
            "field_description": "A broadly oval leaf with a pointed tip and doubly toothed edges, slightly fuzzy.",
            "game_description": "Tough and unpalatable. Has almost no nutritional value.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.3,
            "unit_weight_g": 2,
            "nutrition": {
              "calories": 0.02,
              "protein": 0,
              "carbs": 0.01,
              "fat": 0
            },
            "texture": "fuzzy and tough",
            "taste_notes": [
              "bitter",
              "leafy"
            ],
            "scent_notes": [
              "green"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                5,
                10
              ],
              "actions_until_depleted": [
                4,
                8
              ],
              "ground_action_fraction": 0.65
            },
            "reach_tier": "elevated",
            "harvest_damage": 0.1,
            "regrowth_days": 15,
            "regrowth_max_harvests": 2,
            "decay_days": 3,
            "can_dry": false,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "nut",
        "available_life_stages": [
          "mature_fruiting",
          "mature_seed_set"
        ],
        "sub_stages": [
          {
            "id": "green_in_husk",
            "seasonal_window": {
              "start": "early_summer",
              "end": "late_summer"
            },
            "field_description": "A small hard nut completely hidden inside a fuzzy, green leafy bract.",
            "game_description": "Unripe and firmly enclosed in its husk. Not ready for harvest or consumption.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.6,
            "unit_weight_g": 8,
            "nutrition": {
              "calories": 5,
              "protein": 0.1,
              "carbs": 1,
              "fat": 0.2
            },
            "texture": "hard",
            "taste_notes": [
              "astringent",
              "bitter"
            ],
            "scent_notes": [
              "green"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                8,
                12
              ],
              "actions_until_depleted": [
                8,
                12
              ],
              "ground_action_fraction": 0.65
            },
            "reach_tier": "elevated",
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "does_blickey_help_harvest": true,
            "can_squirrel_cache": false,
            "decay_days": 15,
            "can_dry": false,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          },
          {
            "id": "ripe_in_husk",
            "seasonal_window": {
              "start": "early_fall",
              "end": "late_fall"
            },
            "field_description": "A hard brown nut resting inside a dried, papery brown husk.",
            "game_description": "Ripe hazelnuts. The husk can be easily removed by hand to get to the nut inside.",
            "edibility_score": 0.1,
            "unit_weight_g": 6,
            "nutrition": {
              "calories": 9.4,
              "protein": 0.22,
              "carbs": 0.25,
              "fat": 0.9
            },
            "processing_options": [
              {
                "id": "hull",
                "ticks": 10,
                "location": "hand",
                "outputs": [
                  {
                    "part": "hazelnut_in_shell",
                    "yield_fraction": 0.58,
                    "output_unit_weight_g": 3.5
                  }
                ]
              }
            ],
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                8,
                12
              ],
              "actions_until_depleted": [
                8,
                12
              ],
              "ground_action_fraction": 0.65
            },
            "reach_tier": "elevated",
            "harvest_damage": 0,
            "decay_days": 30,
            "can_dry": true
          }
        ]
      },
      {
        "name": "hazelnut_in_shell",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "whole",
            "field_description": "A smooth, hard, light-brown nutshell.",
            "game_description": "A whole hazelnut. The shell is too hard to bite through; use a rock or tool to crack it open.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 3.5,
            "nutrition": {
              "calories": 9.4,
              "protein": 0.22,
              "carbs": 0.25,
              "fat": 0.9
            },
            "processing_options": [
              {
                "id": "crack_shell",
                "ticks": 15,
                "location": "hand",
                "outputs": [
                  {
                    "part": "hazelnut_kernel",
                    "yield_fraction": 0.42,
                    "output_unit_weight_g": 1.5
                  },
                  {
                    "part": "hazelnut_shell",
                    "yield_fraction": 0.57,
                    "output_unit_weight_g": 2
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
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_squirrel_cache": true,
            "decay_days": 180,
            "can_dry": true,
            "stew_nutrition_factor": 0,
            "raw_extraction_efficiency": 0
          }
        ]
      },
      {
        "name": "hazelnut_kernel",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "raw",
            "field_description": "A plump, pale kernel with a thin, flaky brown skin.",
            "game_description": "A delicious, high-fat nut kernel. Extremely nutritious and stores well through winter.",
            "edibility_score": 0.95,
            "edibility_harshness": 0,
            "unit_weight_g": 1.5,
            "nutrition": {
              "calories": 9.4,
              "protein": 0.22,
              "carbs": 0.25,
              "fat": 0.9
            },
            "texture": "crunchy",
            "taste_notes": [
              "sweet",
              "nutty",
              "rich"
            ],
            "scent_notes": [
              "nutty"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_squirrel_cache": true,
            "decay_days": 180,
            "can_dry": true,
            "stew_nutrition_factor": 1,
            "raw_extraction_efficiency": 1
          }
        ]
      },
      {
        "name": "hazelnut_shell",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "cracked",
            "field_description": "Fragments of hard, brown hazelnut shell.",
            "game_description": "Inedible shell fragments. Has no practical use.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 2,
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
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "branch",
        "available_life_stages": [
          "sapling",
          "mature_flowering",
          "mature_fruiting",
          "mature_seed_set",
          "mature_dormant"
        ],
        "sub_stages": [
          {
            "id": "green_shoot",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_summer"
            },
            "field_description": "A long, straight, young woody shoot, very pliant.",
            "game_description": "Flexible young hazel shoots are excellent for weaving baskets or making wattle structures.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 150,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "woody and flexible",
            "taste_notes": [
              "woody"
            ],
            "scent_notes": [
              "green wood"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [
              "flexible_shoot"
            ],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 10,
            "harvest_tool_modifiers": {
              "knife": 1.5,
              "axe": 2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                2,
                5
              ],
              "ground_action_fraction": 0.65
            },
            "reach_tier": "elevated",
            "harvest_damage": 0.2,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_dry": true,
            "stew_nutrition_factor": 0
          },
          {
            "id": "stiff_branch",
            "seasonal_window": {
              "start": "early_fall",
              "end": "winter"
            },
            "field_description": "A mature, rigid branch with brown bark.",
            "game_description": "Sturdy hazelwood branches. Useful as rigid sticks for tools or structural frames.",
            "texture": "hard wood",
            "craft_tags": [
              "stiff_stick"
            ]
          }
        ]
      },
      {
        "name": "outer_bark",
        "available_life_stages": [
          "sapling",
          "mature_flowering",
          "mature_fruiting",
          "mature_seed_set",
          "mature_dormant"
        ],
        "sub_stages": [
          {
            "id": "mature",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "Thin, smooth brown bark, occasionally peeling slightly.",
            "game_description": "Outer bark of the hazel. Has minimal use in crafting or survival.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 50,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "papery to woody",
            "taste_notes": [
              "bitter"
            ],
            "scent_notes": [
              "wood"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 6,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
            "harvest_requires_any_tools": [
              "knife",
              "axe"
            ],
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                2,
                5
              ],
              "ground_action_fraction": 0.65
            },
            "reach_tier": "elevated",
            "harvest_damage": 0.2,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "inner_bark",
        "available_life_stages": [
          "sapling",
          "mature_flowering",
          "mature_fruiting",
          "mature_seed_set",
          "mature_dormant"
        ],
        "sub_stages": [
          {
            "id": "spring_cambium",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_spring"
            },
            "field_description": "Pale, slightly moist cambium scraped from beneath the outer bark.",
            "game_description": "Contains minor calories during the spring sap run. Can be processed into rough cordage.",
            "edibility_score": 0.15,
            "edibility_harshness": 0.8,
            "unit_weight_g": 10,
            "nutrition": {
              "calories": 8,
              "protein": 0.1,
              "carbs": 1.5,
              "fat": 0.1
            },
            "texture": "moist fibrous",
            "taste_notes": [
              "mild",
              "woody"
            ],
            "scent_notes": [
              "fresh sap"
            ],
            "average_fiber_length_cm": 12,
            "fiber_strength_modifier": 0.8,
            "craft_tags": [
              "cordage_fiber"
            ],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 8,
            "harvest_tool_modifiers": {
              "knife": 1.4
            },
            "harvest_requires_any_tools": [
              "knife",
              "axe"
            ],
            "harvest_yield": {
              "units_per_action": [
                2,
                4
              ],
              "actions_until_depleted": [
                2,
                4
              ],
              "ground_action_fraction": 0.65
            },
            "reach_tier": "elevated",
            "harvest_damage": 0.4,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 4,
            "can_dry": false,
            "stew_nutrition_factor": 1.05,
            "raw_extraction_efficiency": 0.6
          },
          {
            "id": "late_season_inner_bark",
            "seasonal_window": {
              "start": "early_summer",
              "end": "winter"
            },
            "field_description": "Dry, pale inner bark strips.",
            "game_description": "Tough and fibrous, better suited for cordage than as an emergency food.",
            "edibility_score": 0.05,
            "edibility_harshness": 0.95,
            "nutrition": {
              "calories": 4,
              "protein": 0.05,
              "carbs": 0.8,
              "fat": 0.05
            },
            "texture": "dry fibrous",
            "average_fiber_length_cm": 14,
            "fiber_strength_modifier": 1,
            "decay_days": 10,
            "stew_nutrition_factor": 0.4,
            "raw_extraction_efficiency": 0.2
          }
        ]
      },
      {
        "name": "root",
        "available_life_stages": [
          "seedling",
          "sapling",
          "mature_flowering",
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
            "field_description": "Tough, branching woody roots.",
            "game_description": "Inedible and highly difficult to dig up. Very little practical use.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 500,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "hard and fibrous",
            "taste_notes": [
              "earthy",
              "bitter"
            ],
            "scent_notes": [
              "dirt",
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 15,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 40,
            "can_dry": false,
            "stew_nutrition_factor": 0
          }
        ]
      }
    ],
    "physical_description": "A multi-stemmed deciduous shrub reaching 1.5 to 3 meters in height. It has broadly oval, toothed leaves and produces distinctive edible nuts enclosed in leafy, hairy bracts called involucres.",
    "game_description": "Valued for its highly nutritious and calorie-dense nuts, which ripen in the fall and store exceptionally well. The flexible young shoots are useful for weaving, and the mature stems provide sturdy sticks.",
    "scent": {
      "strength": 0.1,
      "primary_compound": "hexanal"
    }
  },
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
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.42
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
        "center_anchored_sprite": true,
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
        "size": 4,
        "field_description": "A tall, solid green stem covered in fine hairs rises from the lacy rosette of leaves."
      },
      {
        "stage": "second_year_flowering",
        "min_age_days": 47,
        "seasonal_window": {
          "start_day": 16,
          "end_day": 25
        },
        "size": 4,
        "field_description": "The hairy stem is topped with flat umbels of small white flowers, featuring a single dark purple flower in the center."
      },
      {
        "stage": "second_year_seed_set",
        "min_age_days": 48,
        "seasonal_window": {
          "start_day": 26,
          "end_day": 35
        },
        "size": 4,
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
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                2,
                6
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
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                5,
                15
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
    ],
    "physical_description": "A herbaceous biennial plant. In its first year, it forms a low rosette of finely divided, lacy, fern-like leaves. In the second year, it produces a solid, green stem covered in fine hairs, topped with flat umbels of small white flowers, often with a single dark red or purple floret in the center. The root is a pale taproot.",
    "game_description": "The ancestor of the domesticated carrot. First-year roots contain starches that extract well when cooked. In the second year, the root becomes highly fibrous. Closely resembles deadly poison hemlock; positive identification relies on the hairy stem and distinctive scent.",
    "scent": {
      "strength": 0.6,
      "primary_compound": "carotol"
    }
  },
  {
    "id": "echinacea_purpurea",
    "name": "Purple Coneflower",
    "longevity": "perennial",
    "age_of_maturity": 5,
    "soil": {
      "ph_range": [
        6,
        8
      ],
      "drainage": {
        "tolerance_range": [
          0.3,
          0.9
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
          0.2,
          0.7
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.4
        ]
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.24
        ]
      }
    },
    "seeding_window": {
      "start": "mid_fall",
      "end": "late_fall"
    },
    "dispersal": {
      "method": "gravity",
      "base_radius_tiles": 2,
      "wind_radius_bonus": 2,
      "water_dispersed": false,
      "animal_dispersed": true,
      "seeds_per_mature_plant": [
        20,
        60
      ],
      "germination_rate": 0.35,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": true,
      "viable_lifespan_days": 150
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A small cluster of rough, dark green oval leaves low to the ground."
      },
      {
        "stage": "vegetative",
        "min_age_days": 5,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 15
        },
        "size": 3,
        "field_description": "A sturdy herbaceous plant with rough, bristly stems and lance-shaped green leaves."
      },
      {
        "stage": "flowering",
        "min_age_days": 16,
        "seasonal_window": {
          "start_day": 16,
          "end_day": 25
        },
        "size": 4,
        "field_description": "Tall, stiff stems topped with large flowers featuring drooping purple-pink petals and a prominent spiky orange-brown central cone."
      },
      {
        "stage": "seed_set",
        "min_age_days": 26,
        "seasonal_window": {
          "start_day": 26,
          "end_day": 35
        },
        "size": 4,
        "field_description": "The petals have wilted and dropped, leaving dark, stiff, and prickly dome-shaped seed heads atop drying stalks."
      },
      {
        "stage": "dormant",
        "min_age_days": 36,
        "seasonal_window": {
          "start_day": 36,
          "end_day": 40
        },
        "size": 1,
        "field_description": "The above-ground foliage has died back to the soil line; only the fibrous roots remain alive underground."
      }
    ],
    "parts": [
      {
        "name": "root",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "seed_set",
          "dormant"
        ],
        "sub_stages": [
          {
            "id": "mature",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A dark, fibrous, and somewhat woody root mass. When scraped, it smells pungent and slightly sweet.",
            "game_description": "The most medically potent part of the coneflower. Can be chewed raw to numb the mouth or prepared into strong poultices and teas. Far too woody and harsh for food.",
            "edibility_score": 0.05,
            "edibility_harshness": 0.8,
            "unit_weight_g": 35,
            "nutrition": {
              "calories": 4,
              "protein": 0.1,
              "carbs": 0.8,
              "fat": 0
            },
            "texture": "woody",
            "taste_notes": [
              "bitter",
              "numbing",
              "pungent"
            ],
            "scent_notes": [
              "earthy",
              "spicy"
            ],
            "average_fiber_length_cm": 3,
            "fiber_strength_modifier": 0.2,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 3,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                1
              ]
            },
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 25,
            "decay_days": 15,
            "can_dry": true,
            "stew_nutrition_factor": 0.1
          }
        ]
      },
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
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "mid_fall"
            },
            "field_description": "A rough, slightly hairy dark green leaf with a lance-like shape.",
            "game_description": "Contains mild medicinal properties. Unpleasant to eat due to its bristly texture, but can be added to stews in a pinch or used for weak tea.",
            "edibility_score": 0.3,
            "edibility_harshness": 0.2,
            "unit_weight_g": 2.5,
            "nutrition": {
              "calories": 0.05,
              "protein": 0.01,
              "carbs": 0.01,
              "fat": 0
            },
            "texture": "hairy",
            "taste_notes": [
              "green",
              "mildly numbing"
            ],
            "scent_notes": [
              "grassy"
            ],
            "average_fiber_length_cm": 1.5,
            "fiber_strength_modifier": 0.1,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                1
              ]
            },
            "harvest_damage": 0.2,
            "regrowth_days": 7,
            "regrowth_max_harvests": 2,
            "decay_days": 3,
            "can_dry": true,
            "stew_nutrition_factor": 1,
            "cooked_edibility_score": 0.6,
            "cooked_harshness": 0.1
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
            "id": "fresh",
            "seasonal_window": {
              "start": "mid_summer",
              "end": "early_fall"
            },
            "field_description": "A large, showy flower head with purple-pink ray petals surrounding a stiff, spiky orange-brown cone.",
            "game_description": "Potent medicine. Contains strong immune-boosting compounds and produces a strong tingling effect when chewed. Highly effective in teas.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.4,
            "unit_weight_g": 8,
            "nutrition": {
              "calories": 1.5,
              "protein": 0,
              "carbs": 0.3,
              "fat": 0
            },
            "texture": "spiky",
            "taste_notes": [
              "numbing",
              "floral",
              "bitter"
            ],
            "scent_notes": [
              "sweet",
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 2,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {
              "knife": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                1,
                3
              ]
            },
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 3.5,
            "can_dry": true,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "stalk",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "mid_spring",
              "end": "early_fall"
            },
            "field_description": "A tough, bristly green stem supporting the plant.",
            "game_description": "Tough and fibrous. Contains trace medicinal properties but is mostly useless for food or high-quality medicine.",
            "edibility_score": 0,
            "edibility_harshness": 0.5,
            "unit_weight_g": 20,
            "nutrition": {
              "calories": 2,
              "protein": 0,
              "carbs": 0.4,
              "fat": 0
            },
            "texture": "fibrous",
            "taste_notes": [
              "green",
              "bitter"
            ],
            "scent_notes": [
              "grassy"
            ],
            "average_fiber_length_cm": 8,
            "fiber_strength_modifier": 0.3,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.1,
            "harvest_base_ticks": 5,
            "harvest_tool_modifiers": {
              "knife": 2
            },
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
            "harvest_damage": 0.5,
            "regrowth_days": 15,
            "regrowth_max_harvests": 1,
            "decay_days": 5,
            "can_dry": true,
            "stew_nutrition_factor": 0.1
          },
          {
            "id": "dry",
            "seasonal_window": {
              "start": "mid_fall",
              "end": "winter"
            },
            "field_description": "A brittle, stiff brown stalk, completely dried out by the autumn air.",
            "game_description": "A dry, dead plant stalk. Too brittle for construction, but works as passable tinder.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 15,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "brittle",
            "taste_notes": [
              "dusty"
            ],
            "scent_notes": [
              "dry"
            ],
            "craft_tags": [
              "tinder"
            ],
            "decay_days": 46,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "seed_head",
        "available_life_stages": [
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "dry",
            "seasonal_window": {
              "start": "mid_fall",
              "end": "late_fall"
            },
            "field_description": "A stiff, prickly, dark brown cone packed with small seeds.",
            "game_description": "The dried flower cone. Can be crushed by hand to extract the small seeds, or used whole for weak medicinal effects.",
            "edibility_score": 0,
            "edibility_harshness": 0.6,
            "unit_weight_g": 10,
            "nutrition": {
              "calories": 4,
              "protein": 0.2,
              "carbs": 0.6,
              "fat": 0.1
            },
            "processing_options": [
              {
                "id": "extract_seeds",
                "ticks": 15,
                "location": "hand",
                "outputs": [
                  {
                    "part": "seed",
                    "yield_fraction": 0.3,
                    "output_unit_weight_g": 0.1
                  }
                ]
              }
            ],
            "texture": "prickly",
            "taste_notes": [
              "dusty",
              "faintly numbing"
            ],
            "scent_notes": [
              "dry",
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                1,
                3
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 46,
            "can_dry": true,
            "stew_nutrition_factor": 0.1
          }
        ]
      },
      {
        "name": "seed",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "extracted",
            "field_description": "Tiny, elongated dark seeds with a slightly rough texture.",
            "game_description": "Small edible seeds. Very tedious to gather in bulk for calories, but they store exceptionally well.",
            "edibility_score": 0.6,
            "edibility_harshness": 0.1,
            "unit_weight_g": 0.1,
            "nutrition": {
              "calories": 0.4,
              "protein": 0.02,
              "carbs": 0.04,
              "fat": 0.02
            },
            "texture": "hard",
            "taste_notes": [
              "nutty"
            ],
            "scent_notes": [
              "faint"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 150,
            "can_dry": true,
            "stew_nutrition_factor": 1.2
          }
        ]
      }
    ],
    "physical_description": "An herbaceous perennial with rough, somewhat hairy stems. It features striking large flower heads with drooping purple-to-pink ray petals surrounding a prominent, spiky, dome-shaped orange-brown central cone.",
    "game_description": "A highly valued medicinal plant. The roots and flower heads can be chewed or made into teas and poultices to boost immunity, treat wounds, and reduce fever, though they cause a distinct numbing and tingling sensation in the mouth.",
    "scent": {
      "strength": 0.3,
      "primary_compound": "caryophyllene"
    }
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
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.22
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
              ],
              "ground_action_fraction": 0.1,
              "elevated_action_fraction": 0.1
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
              ],
              "ground_action_fraction": 0.1,
              "elevated_action_fraction": 0.1
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
            "craft_tags": [
              "stiff_stick"
            ],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 2,
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
              ],
              "ground_action_fraction": 0.1,
              "elevated_action_fraction": 0.1
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
            "game_description": "Thick protective bark that can be stripped in sheets. Rich in tannins and juglone; not edible.",
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
            "craft_tags": [
              "bark_sheet"
            ],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 10,
            "harvest_tool_modifiers": {
              "axe": 1.5,
              "knife": 1.2
            },
            "harvest_requires_any_tools": [
              "axe",
              "knife"
            ],
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
            "reach_tier": "ground",
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
        "name": "inner_bark",
        "available_life_stages": [
          "sapling",
          "mature_vegetative",
          "mature_fruiting",
          "mature_seed_set",
          "mature_dormant"
        ],
        "sub_stages": [
          {
            "id": "spring_cambium",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_spring"
            },
            "field_description": "A moist, pale cambium layer just beneath the bark, with a sharp walnut scent.",
            "game_description": "Most edible during spring sap flow, but still bitter and harsh. Carries juglone effects at lower potency than husk.",
            "edibility_score": 0.12,
            "edibility_harshness": 0.95,
            "unit_weight_g": 20,
            "nutrition": {
              "calories": 16,
              "protein": 0.2,
              "carbs": 3.2,
              "fat": 0.1
            },
            "texture": "moist fibrous",
            "taste_notes": [
              "bitter",
              "astringent",
              "woody"
            ],
            "scent_notes": [
              "green wood",
              "spicy",
              "earthy"
            ],
            "average_fiber_length_cm": 8,
            "fiber_strength_modifier": 0.6,
            "craft_tags": [
              "cordage_fiber"
            ],
            "ingestion": null,
            "potency_multiplier": 0.8,
            "harvest_base_ticks": 8,
            "harvest_tool_modifiers": {
              "axe": 1.5,
              "knife": 1.4
            },
            "harvest_requires_any_tools": [
              "axe",
              "knife"
            ],
            "harvest_yield": {
              "units_per_action": [
                2,
                5
              ],
              "actions_until_depleted": [
                3,
                8
              ]
            },
            "reach_tier": "ground",
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 3,
            "can_dry": false,
            "stew_nutrition_factor": 0.25,
            "raw_extraction_efficiency": 0.2,
            "cooked_edibility_score": 0.18,
            "cooked_harshness": 0.75,
            "cooking_detoxifies": false
          },
          {
            "id": "late_season_inner_bark",
            "seasonal_window": {
              "start": "early_fall",
              "end": "winter"
            },
            "field_description": "Drier, stringier inner bark strips with less sap and a stronger bitter walnut odor.",
            "game_description": "Past cambium peak. Less edible, more fibrous, and chemically harsher than spring cambium.",
            "edibility_score": 0.05,
            "edibility_harshness": 1,
            "unit_weight_g": 20,
            "nutrition": {
              "calories": 8,
              "protein": 0.1,
              "carbs": 1.6,
              "fat": 0
            },
            "texture": "dry fibrous",
            "taste_notes": [
              "very bitter",
              "astringent",
              "woody"
            ],
            "scent_notes": [
              "earthy",
              "tannic",
              "spicy"
            ],
            "average_fiber_length_cm": 12,
            "fiber_strength_modifier": 0.8,
            "craft_tags": [
              "cordage_fiber"
            ],
            "ingestion": null,
            "potency_multiplier": 1.3,
            "harvest_base_ticks": 8,
            "harvest_tool_modifiers": {
              "axe": 1.5,
              "knife": 1.4
            },
            "harvest_requires_any_tools": [
              "axe",
              "knife"
            ],
            "harvest_yield": {
              "units_per_action": [
                2,
                5
              ],
              "actions_until_depleted": [
                3,
                8
              ]
            },
            "reach_tier": "ground",
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 5,
            "can_dry": true,
            "stew_nutrition_factor": 0.05,
            "raw_extraction_efficiency": 0.05,
            "cooked_edibility_score": 0.08,
            "cooked_harshness": 0.9,
            "cooking_detoxifies": false
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
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 5,
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
                "ticks": 5,
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
                "ticks": 10,
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
    ],
    "physical_description": "A large canopy deciduous tree reaching up to 130 feet tall. It has dark, deeply furrowed bark forming diamond patterns, and large compound leaves with 15-23 leaflets. It produces large, spherical green fruits that house heavily ridged, hard-shelled nuts.",
    "game_description": "Produces highly nutritious and calorie-dense nuts, but processing them requires significant effort to remove the thick, staining husks and crack the extremely hard shells. The wood makes excellent structural material. Husks contain juglone which can be used medicinally but causes severe nausea if ingested.",
    "scent": {
      "strength": 0.6,
      "primary_compound": "juglone"
    }
  },
  {
    "id": "lathyrus_japonicus",
    "name": "Beach Pea",
    "longevity": "perennial",
    "age_of_maturity": 31,
    "soil": {
      "ph_range": [
        5.5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.6,
          1
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.1,
          0.6
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.1,
          0.6
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.3
        ]
      }
    },
    "seeding_window": {
      "start": "early_fall",
      "end": "late_fall"
    },
    "dispersal": {
      "method": "explosive",
      "base_radius_tiles": 2,
      "wind_radius_bonus": 0,
      "water_dispersed": true,
      "animal_dispersed": false,
      "seeds_per_mature_plant": [
        10,
        30
      ],
      "germination_rate": 0.4,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": true,
      "viable_lifespan_days": 1800
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A small fleshy green sprout with a couple of blue-green leaflets and a delicate tendril."
      },
      {
        "stage": "vegetative",
        "min_age_days": 31,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 10
        },
        "size": 2,
        "field_description": "A sprawling blue-green vine extending over the ground, featuring multiple compound leaves ending in grasping tendrils."
      },
      {
        "stage": "flowering",
        "min_age_days": 32,
        "seasonal_window": {
          "start_day": 11,
          "end_day": 20
        },
        "size": 2,
        "field_description": "A sprawling blue-green vine dotted with bright purple and pinkish-blue pea flowers."
      },
      {
        "stage": "fruiting",
        "min_age_days": 33,
        "seasonal_window": {
          "start_day": 21,
          "end_day": 30
        },
        "size": 2,
        "field_description": "A sprawling blue-green vine heavily laden with flat pea pods that turn from green to brown as they mature."
      },
      {
        "stage": "dormant",
        "min_age_days": 34,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 40
        },
        "size": 1,
        "field_description": "A few withered, brown, straggling stems lying flat against the soil. Most of the plant has died back to its root system."
      }
    ],
    "parts": [
      {
        "name": "root",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "fruiting",
          "dormant"
        ],
        "sub_stages": [
          {
            "id": "rhizome",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A deep, tough rhizome anchor adapted to shifting sands.",
            "game_description": "Fibrous and dense. It has minor caloric value but is extremely tough to chew.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.3,
            "unit_weight_g": 30,
            "nutrition": {
              "calories": 15,
              "protein": 0.4,
              "carbs": 3,
              "fat": 0.1
            },
            "texture": "fibrous",
            "taste_notes": [
              "earthy",
              "starchy"
            ],
            "scent_notes": [
              "earthy"
            ],
            "average_fiber_length_cm": 4,
            "fiber_strength_modifier": 0.3,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                1
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 25,
            "on_harvest_injury": null,
            "decay_days": 14,
            "can_dry": false,
            "stew_nutrition_factor": 0.4
          }
        ]
      },
      {
        "name": "stem",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "fruiting"
        ],
        "sub_stages": [
          {
            "id": "young_shoot",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_spring"
            },
            "field_description": "Tender, bright green growing tips of the sprawling vine.",
            "game_description": "Young shoots are tender enough to eat raw or add to a stew without toxicity concerns.",
            "edibility_score": 0.85,
            "edibility_harshness": 0.2,
            "unit_weight_g": 15,
            "nutrition": {
              "calories": 3,
              "protein": 0.4,
              "carbs": 0.5,
              "fat": 0
            },
            "texture": "crisp",
            "taste_notes": [
              "green",
              "slightly sweet"
            ],
            "scent_notes": [
              "fresh",
              "grassy"
            ],
            "average_fiber_length_cm": 3,
            "fiber_strength_modifier": 0.2,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
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
            "harvest_damage": 0.3,
            "regrowth_days": 15,
            "regrowth_max_harvests": 2,
            "on_harvest_injury": null,
            "decay_days": 3,
            "can_dry": false,
            "stew_nutrition_factor": 1.1
          },
          {
            "id": "mature_vine",
            "seasonal_window": {
              "start": "early_summer",
              "end": "late_fall"
            },
            "field_description": "Thickened, blue-green stems trailing aggressively across the ground.",
            "game_description": "The mature vine is stringy, fibrous, and unpalatable.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.5,
            "unit_weight_g": 20,
            "nutrition": {
              "calories": 2,
              "protein": 0.2,
              "carbs": 0.4,
              "fat": 0
            },
            "texture": "stringy",
            "taste_notes": [
              "bitter",
              "green"
            ],
            "scent_notes": [
              "grassy"
            ],
            "average_fiber_length_cm": 8,
            "fiber_strength_modifier": 0.6,
            "craft_tags": [],
            "potency_multiplier": 0.1,
            "harvest_damage": 0.4,
            "decay_days": 4,
            "can_dry": false,
            "stew_nutrition_factor": 0.2
          }
        ]
      },
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "fruiting"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_fall"
            },
            "field_description": "Fleshy, pinnate leaves with a distinct blue-green waxy coating.",
            "game_description": "Edible as a green, though slightly fibrous as the season progresses.",
            "edibility_score": 0.75,
            "edibility_harshness": 0.2,
            "unit_weight_g": 1,
            "nutrition": {
              "calories": 0.2,
              "protein": 0.02,
              "carbs": 0.03,
              "fat": 0
            },
            "texture": "fleshy",
            "taste_notes": [
              "green",
              "mild"
            ],
            "scent_notes": [
              "fresh"
            ],
            "average_fiber_length_cm": 1.5,
            "fiber_strength_modifier": 0.1,
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
                3,
                6
              ]
            },
            "harvest_damage": 0.15,
            "regrowth_days": 12,
            "regrowth_max_harvests": 3,
            "on_harvest_injury": null,
            "decay_days": 3,
            "can_dry": false,
            "stew_nutrition_factor": 1.1
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
            "id": "fresh",
            "seasonal_window": {
              "start": "early_summer",
              "end": "mid_summer"
            },
            "field_description": "Bright clusters of papilionaceous flowers varying from purple to pinkish-blue.",
            "game_description": "Delicate edible flowers that can be eaten directly or added to food.",
            "edibility_score": 0.95,
            "edibility_harshness": 0,
            "unit_weight_g": 0.5,
            "nutrition": {
              "calories": 0.1,
              "protein": 0.01,
              "carbs": 0.02,
              "fat": 0
            },
            "texture": "tender",
            "taste_notes": [
              "sweet",
              "floral"
            ],
            "scent_notes": [
              "floral"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                3,
                8
              ],
              "actions_until_depleted": [
                2,
                5
              ]
            },
            "harvest_damage": 0.05,
            "regrowth_days": 8,
            "regrowth_max_harvests": 1,
            "on_harvest_injury": null,
            "decay_days": 2,
            "can_dry": false,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "pod",
        "available_life_stages": [
          "fruiting"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "mid_summer",
              "end": "early_fall"
            },
            "field_description": "A flat, fleshy green pea pod.",
            "game_description": "Tender young pods are edible whole, much like snow peas. They have not yet developed toxins.",
            "edibility_score": 0.9,
            "edibility_harshness": 0.1,
            "unit_weight_g": 10,
            "nutrition": {
              "calories": 4,
              "protein": 0.3,
              "carbs": 0.7,
              "fat": 0.05
            },
            "texture": "crisp",
            "taste_notes": [
              "sweet",
              "green"
            ],
            "scent_notes": [
              "fresh",
              "grassy"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.1,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                2,
                6
              ],
              "actions_until_depleted": [
                3,
                8
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "decay_days": 4,
            "can_dry": false,
            "stew_nutrition_factor": 1.1
          },
          {
            "id": "dry",
            "seasonal_window": {
              "start": "mid_fall",
              "end": "winter"
            },
            "field_description": "A brittle, brownish pod that coils and rattles when shaken.",
            "game_description": "The pod is inedible, but contains mature seeds. Requires processing by hand to extract the peas.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 7,
            "nutrition": {
              "calories": 16,
              "protein": 1.1,
              "carbs": 2.7,
              "fat": 0.1
            },
            "processing_options": [
              {
                "id": "extract_peas",
                "ticks": 15,
                "location": "hand",
                "outputs": [
                  {
                    "part": "pea",
                    "yield_fraction": 0.65,
                    "output_unit_weight_g": 1.5
                  },
                  {
                    "part": "pod_husk",
                    "yield_fraction": 0.35,
                    "output_unit_weight_g": 2.45
                  }
                ]
              }
            ],
            "texture": "papery",
            "taste_notes": [],
            "scent_notes": [
              "dry",
              "earthy"
            ],
            "average_fiber_length_cm": 3,
            "fiber_strength_modifier": 0.2,
            "craft_tags": [],
            "potency_multiplier": 1,
            "decay_days": 60,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "pea",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "extracted",
            "field_description": "Small, dense, round seeds ranging from pale olive to mottled brown.",
            "game_description": "High in protein but contains harsh toxins. Cannot be eaten raw. Cooking the peas thoroughly in a stew completely neutralizes the toxins.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.9,
            "unit_weight_g": 1.5,
            "nutrition": {
              "calories": 5.1,
              "protein": 0.35,
              "carbs": 0.9,
              "fat": 0.02
            },
            "raw_extraction_efficiency": 0,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.85,
            "cooked_harshness": 0.1,
            "texture": "hard",
            "taste_notes": [
              "starchy",
              "bitter"
            ],
            "scent_notes": [
              "dry",
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "can_squirrel_cache": true,
            "decay_days": 180,
            "can_dry": true,
            "stew_nutrition_factor": 1.3
          }
        ]
      },
      {
        "name": "pod_husk",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "dry",
            "field_description": "A twisted, empty brown husk from a beach pea pod.",
            "game_description": "A dry, empty husk. Completely inedible.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 2.45,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "papery",
            "taste_notes": [],
            "scent_notes": [
              "dry",
              "dusty"
            ],
            "average_fiber_length_cm": 1.5,
            "fiber_strength_modifier": 0.1,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 60,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      }
    ],
    "physical_description": "A low-growing, trailing perennial vine often found in sandy or gravelly coastal soils. It has fleshy, blue-green pinnate leaves that end in curling tendrils. It bears clusters of prominent purple to pinkish-blue pea-like flowers that mature into flattened pods.",
    "game_description": "A hardy coastal legume. The young shoots and green pods are edible, but the mature peas contain toxins that cause severe illness and weakness if eaten raw. Cooking the mature peas in a stew completely neutralizes the toxins.",
    "scent": {
      "strength": 0.2,
      "primary_compound": "linalool"
    }
  },
  {
    "id": "moehringia_lateriflora",
    "name": "Bluntleaf Sandwort",
    "longevity": "perennial",
    "age_of_maturity": 20,
    "soil": {
      "ph_range": [
        5.5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.3,
          0.7
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.3,
          0.8
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.4,
          0.8
        ]
      },
      "shade": {
        "tolerance_range": [
          0.4,
          0.9
        ]
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.15
        ]
      }
    },
    "seeding_window": {
      "start": "late_summer",
      "end": "early_fall"
    },
    "dispersal": {
      "method": "gravity",
      "base_radius_tiles": 1,
      "wind_radius_bonus": 0,
      "water_dispersed": false,
      "animal_dispersed": false,
      "seeds_per_mature_plant": [
        10,
        30
      ],
      "germination_rate": 0.25,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": false,
      "viable_lifespan_days": 360
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A microscopic pair of opposite leaves emerging close to the soil surface."
      },
      {
        "stage": "vegetative",
        "min_age_days": 20,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 15
        },
        "size": 1,
        "field_description": "A sprawling, delicate mat of fine stems with small, rounded, opposite leaves."
      },
      {
        "stage": "flowering",
        "min_age_days": 21,
        "seasonal_window": {
          "start_day": 16,
          "end_day": 25
        },
        "size": 1,
        "field_description": "A delicate mat of fine stems dotted with tiny, bright white flowers with five distinct petals."
      },
      {
        "stage": "seed_set",
        "min_age_days": 22,
        "seasonal_window": {
          "start_day": 26,
          "end_day": 30
        },
        "size": 1,
        "field_description": "Minute green seed capsules sit among the blunt-tipped leaves."
      },
      {
        "stage": "dormant",
        "min_age_days": 23,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 40
        },
        "size": 1,
        "field_description": "Bare soil or leaf litter; shallow rhizomes remain below ground."
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
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_fall"
            },
            "field_description": "A tiny, blunt-tipped oval leaf, extremely thin and somewhat delicate.",
            "game_description": "Offers nearly no caloric value, but can theoretically be added to stews in an emergency.",
            "edibility_score": 0.4,
            "edibility_harshness": 0.1,
            "unit_weight_g": 0.1,
            "nutrition": {
              "calories": 0.03,
              "protein": 0.002,
              "carbs": 0.005,
              "fat": 0.001
            },
            "texture": "soft",
            "taste_notes": [
              "bland",
              "grassy"
            ],
            "scent_notes": [
              "faintly green"
            ],
            "average_fiber_length_cm": 1,
            "fiber_strength_modifier": 0.1,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                2,
                5
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0.3,
            "regrowth_days": 10,
            "regrowth_max_harvests": 1,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 2,
            "can_dry": true,
            "raw_extraction_efficiency": 0.8,
            "stew_nutrition_factor": 1.05
          }
        ]
      },
      {
        "name": "stem",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_fall"
            },
            "field_description": "A thread-like green stem, slightly hairy to the touch.",
            "game_description": "A highly fibrous, tiny stem with almost zero food utility.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.3,
            "unit_weight_g": 0.2,
            "nutrition": {
              "calories": 0.05,
              "protein": 0.001,
              "carbs": 0.01,
              "fat": 0
            },
            "texture": "stringy",
            "taste_notes": [
              "bland",
              "woody"
            ],
            "scent_notes": [
              "earthy"
            ],
            "average_fiber_length_cm": 3,
            "fiber_strength_modifier": 0.2,
            "fiberous": true,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {
              "knife": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0.6,
            "regrowth_days": 10,
            "regrowth_max_harvests": 1,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 3,
            "can_dry": true,
            "raw_extraction_efficiency": 0.2,
            "stew_nutrition_factor": 0.8
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
          "dormant"
        ],
        "sub_stages": [
          {
            "id": "rhizome",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A very thin, pale, creeping underground rhizome with small rootlets.",
            "game_description": "Extremely sparse and stringy roots. They require too much effort to dig for the negligible calories they provide.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.2,
            "unit_weight_g": 0.5,
            "nutrition": {
              "calories": 0.2,
              "protein": 0.01,
              "carbs": 0.04,
              "fat": 0.005
            },
            "texture": "fibrous",
            "taste_notes": [
              "earthy",
              "bland"
            ],
            "scent_notes": [
              "dirt"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.3,
            "fiberous": true,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 15,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 5,
            "can_dry": true,
            "raw_extraction_efficiency": 0.1,
            "stew_nutrition_factor": 0.6
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
              "start": "early_summer",
              "end": "mid_summer"
            },
            "field_description": "A very small, delicate star-shaped flower with five white petals.",
            "game_description": "An incredibly small flower with practically no food value.",
            "edibility_score": 0.5,
            "edibility_harshness": 0,
            "unit_weight_g": 0.05,
            "nutrition": {
              "calories": 0.01,
              "protein": 0,
              "carbs": 0.002,
              "fat": 0
            },
            "texture": "soft",
            "taste_notes": [
              "faintly sweet"
            ],
            "scent_notes": [
              "mild floral"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0.05,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 2,
            "can_dry": false,
            "raw_extraction_efficiency": 1,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "seed_capsule",
        "available_life_stages": [
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "late_summer",
              "end": "early_fall"
            },
            "field_description": "A microscopic green capsule containing developing seeds.",
            "game_description": "Far too small to be worth collecting for food.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.4,
            "unit_weight_g": 0.05,
            "nutrition": {
              "calories": 0.02,
              "protein": 0.001,
              "carbs": 0.003,
              "fat": 0.001
            },
            "processing_options": [
              {
                "id": "extract_seeds",
                "ticks": 5,
                "location": "hand",
                "outputs": [
                  {
                    "part": "seed",
                    "yield_fraction": 0.5,
                    "output_unit_weight_g": 0.01
                  }
                ]
              }
            ],
            "texture": "crisp",
            "taste_notes": [
              "bland"
            ],
            "scent_notes": [
              "faintly green"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 4,
            "can_dry": true,
            "raw_extraction_efficiency": 0.5,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "seed",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "dry",
            "field_description": "A microscopic dark seed.",
            "game_description": "Too tiny to be of any practical use.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.1,
            "unit_weight_g": 0.01,
            "nutrition": {
              "calories": 0.01,
              "protein": 0,
              "carbs": 0.002,
              "fat": 0
            },
            "texture": "hard",
            "taste_notes": [
              "bland"
            ],
            "scent_notes": [],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 100,
            "can_dry": true,
            "raw_extraction_efficiency": 0.1,
            "stew_nutrition_factor": 1
          }
        ]
      }
    ],
    "physical_description": "A delicate, low-growing herbaceous perennial with fine creeping rhizomes. Its slender, slightly hairy stems bear pairs of blunt-tipped oval leaves. During bloom, it produces tiny, star-like white flowers with five distinct petals.",
    "game_description": "A tiny woodland groundcover plant. Its thread-like stems and leaves are fibrous and offer virtually no nutritional value, though they are completely harmless if eaten. It is generally too small to be practically useful for crafts or food.",
    "scent": {
      "strength": 0.1,
      "primary_compound": "hexanal"
    }
  },
  {
    "id": "quercus_alba",
    "name": "White Oak",
    "longevity": "perennial",
    "age_of_maturity": 240,
    "soil": {
      "ph_range": [
        5.5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.3,
          0.9
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.3,
          0.9
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.3,
          0.8
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.6
        ]
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.15
        ]
      }
    },
    "seeding_window": {
      "start": "early_fall",
      "end": "mid_fall"
    },
    "dispersal": {
      "method": "animal_cached",
      "base_radius_tiles": 10,
      "wind_radius_bonus": 0,
      "water_dispersed": false,
      "animal_dispersed": true,
      "seeds_per_mature_plant": [
        100,
        500
      ],
      "germination_rate": 0.4,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": false,
      "viable_lifespan_days": 60
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 2,
        "field_description": "A small woody shoot with a few deeply lobed, pale green leaves."
      },
      {
        "stage": "sapling",
        "min_age_days": 240,
        "seasonal_window": null,
        "size": 6,
        "field_description": "A young tree with light gray, slightly scaly bark and a spreading crown of lobed leaves."
      },
      {
        "stage": "vegetative",
        "min_age_days": 360,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 10
        },
        "size": 10,
        "field_description": "A massive hardwood tree. Its wide canopy is densely packed with bright green, deeply lobed leaves."
      },
      {
        "stage": "flowering",
        "min_age_days": 361,
        "seasonal_window": {
          "start_day": 11,
          "end_day": 15
        },
        "size": 10,
        "field_description": "A massive hardwood tree. Small, yellowish-green catkins hang from the branches among the spring foliage."
      },
      {
        "stage": "fruiting",
        "min_age_days": 362,
        "seasonal_window": {
          "start_day": 16,
          "end_day": 25
        },
        "size": 10,
        "field_description": "A massive hardwood tree with a full canopy. Elongated green and brown acorns are visible among the lobed leaves."
      },
      {
        "stage": "senescent",
        "min_age_days": 363,
        "seasonal_window": {
          "start_day": 26,
          "end_day": 30
        },
        "size": 10,
        "field_description": "A massive hardwood tree turning deep red and brown as autumn progresses. Many leaves still cling to the branches."
      },
      {
        "stage": "winter_bare",
        "min_age_days": 364,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 40
        },
        "size": 10,
        "field_description": "A massive, leafless hardwood tree. Its pale, ashy-gray bark and thick, rugged branching structure are completely exposed."
      }
    ],
    "parts": [
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "sapling",
          "vegetative",
          "flowering",
          "fruiting",
          "senescent"
        ],
        "sub_stages": [
          {
            "id": "spring_green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_summer"
            },
            "field_description": "A bright green leaf with 7 to 9 smooth, rounded lobes. Matte on top and slightly paler underneath.",
            "game_description": "Oak leaves are intensely astringent and inedible, but can be boiled into a medicinal tea to treat gut illness.",
            "edibility_score": 0,
            "edibility_harshness": 0.9,
            "unit_weight_g": 1.2,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "leathery",
            "taste_notes": [
              "intensely bitter",
              "astringent"
            ],
            "scent_notes": [
              "green",
              "tannic"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.8,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": {
              "units_per_action": [
                20,
                50
              ],
              "actions_until_depleted": [
                15,
                30
              ],
              "ground_action_fraction": 0.1
            },
            "reach_tier": "canopy",
            "reach_tier_by_life_stage": {
              "seedling": "ground",
              "sapling": "elevated"
            },
            "harvest_damage": 0.05,
            "regrowth_days": 15,
            "regrowth_max_harvests": 2,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "can_dry": true,
            "stew_nutrition_factor": 0
          },
          {
            "id": "fall_dry",
            "seasonal_window": {
              "start": "early_fall",
              "end": "late_fall"
            },
            "field_description": "A dry, brown oak leaf with smooth rounded lobes. Crispy and brittle.",
            "game_description": "Dry oak leaves offer less medicinal value than green ones, but can still be boiled for a weak tannin tea.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "texture": "brittle",
            "taste_notes": [
              "dry",
              "dusty",
              "bitter"
            ],
            "potency_multiplier": 0.3,
            "harvest_yield": {
              "units_per_action": [
                20,
                50
              ],
              "actions_until_depleted": [
                10,
                20
              ],
              "ground_action_fraction": 0.3
            },
            "regrowth_days": null,
            "regrowth_max_harvests": null
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
            "id": "catkins",
            "seasonal_window": {
              "start": "mid_spring",
              "end": "late_spring"
            },
            "field_description": "Clustered strings of tiny, yellowish-green pollen flowers hanging from the twigs.",
            "game_description": "Oak catkins are harmless but provide almost no nutritional or practical value.",
            "edibility_score": 0.2,
            "edibility_harshness": 0.4,
            "unit_weight_g": 0.5,
            "nutrition": {
              "calories": 0.1,
              "protein": 0.01,
              "carbs": 0.02,
              "fat": 0
            },
            "texture": "soft",
            "taste_notes": [
              "bland",
              "dusty"
            ],
            "scent_notes": [
              "pollen",
              "faintly floral"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": {
              "units_per_action": [
                10,
                25
              ],
              "actions_until_depleted": [
                5,
                10
              ],
              "ground_action_fraction": 0.05
            },
            "reach_tier": "canopy",
            "harvest_damage": 0.01,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 3,
            "can_dry": false,
            "stew_nutrition_factor": 1
          }
        ]
      },
      {
        "name": "acorn",
        "available_life_stages": [
          "fruiting"
        ],
        "sub_stages": [
          {
            "id": "ripe",
            "seasonal_window": {
              "start": "late_summer",
              "end": "late_fall"
            },
            "field_description": "An elongated, light brown nut seated in a shallow, knobby cap.",
            "game_description": "White oak acorns have fewer tannins than red oaks but still require cracking and leaching or heavy boiling to become a good food source. Squirrels eagerly cache these.",
            "edibility_score": 0.2,
            "edibility_harshness": 0.7,
            "unit_weight_g": 6,
            "nutrition": {
              "calories": 17.1,
              "protein": 0.3,
              "carbs": 2.5,
              "fat": 1.1
            },
            "processing_options": [
              {
                "id": "crack_shell",
                "ticks": 15,
                "location": "hand",
                "outputs": [
                  {
                    "part": "seed",
                    "yield_fraction": 0.75,
                    "output_unit_weight_g": 4.5
                  },
                  {
                    "part": "acorn_shell",
                    "yield_fraction": 0.25,
                    "output_unit_weight_g": 1.5
                  }
                ]
              }
            ],
            "raw_extraction_efficiency": 0,
            "stew_nutrition_factor": 0.3,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.6,
            "cooked_harshness": 0.3,
            "texture": "hard",
            "taste_notes": [
              "astringent",
              "nutty"
            ],
            "scent_notes": [
              "earthy",
              "woody"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.1,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": {
              "units_per_action": [
                15,
                40
              ],
              "actions_until_depleted": [
                20,
                50
              ],
              "ground_action_fraction": 0.6
            },
            "reach_tier": "canopy",
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": true,
            "decay_days": 60,
            "can_dry": true
          }
        ]
      },
      {
        "name": "seed",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "raw_meat",
            "seasonal_window": null,
            "field_description": "A pale, dense acorn nutmeat, free of its shell.",
            "game_description": "Can be eaten raw in a pinch due to lower tannins, but much better leached in a basket or boiled heavily in stew.",
            "edibility_score": 0.4,
            "edibility_harshness": 0.5,
            "unit_weight_g": 4.5,
            "nutrition": {
              "calories": 17.1,
              "protein": 0.3,
              "carbs": 2.5,
              "fat": 1.1
            },
            "raw_extraction_efficiency": 0.6,
            "stew_nutrition_factor": 1.2,
            "cooking_detoxifies": true,
            "cooked_edibility_score": 0.8,
            "cooked_harshness": 0.1,
            "texture": "dense",
            "taste_notes": [
              "starchy",
              "mildly astringent",
              "sweet"
            ],
            "scent_notes": [
              "nutty"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": true,
            "decay_days": 30,
            "can_dry": true
          }
        ]
      },
      {
        "name": "leached_acorn",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "ready_to_eat",
            "seasonal_window": null,
            "field_description": "Water-logged, darkened acorn meat that has been leached of its bitter tannins.",
            "game_description": "A highly nutritious, mildly sweet staple food. The tannins are gone, making it perfectly safe and palatable raw or cooked.",
            "edibility_score": 0.9,
            "edibility_harshness": 0,
            "unit_weight_g": 4.5,
            "nutrition": {
              "calories": 17.1,
              "protein": 0.3,
              "carbs": 2.5,
              "fat": 1.1
            },
            "raw_extraction_efficiency": 1,
            "stew_nutrition_factor": 1.3,
            "texture": "soft",
            "taste_notes": [
              "sweet",
              "starchy",
              "nutty"
            ],
            "scent_notes": [
              "earthy",
              "clean"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 5,
            "can_dry": true
          }
        ]
      },
      {
        "name": "acorn_shell",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "fragments",
            "seasonal_window": null,
            "field_description": "Brittle, fragmented husks of acorn shells.",
            "game_description": "Inedible debris left over from cracking acorns.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 1.5,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "woody",
            "taste_notes": [
              "astringent"
            ],
            "scent_notes": [
              "woody"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "outer_bark",
        "available_life_stages": [
          "sapling",
          "vegetative",
          "flowering",
          "fruiting",
          "senescent",
          "winter_bare"
        ],
        "sub_stages": [
          {
            "id": "mature_bark",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "Thick, light ashy-gray bark that scales and peels in overlapping plates.",
            "game_description": "Tough protective outer bark. Rich in tannins, it can be steeped into a medicinal tea to treat gut illness, but has little other craft utility.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 50,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "rough",
            "taste_notes": [
              "intensely bitter",
              "woody"
            ],
            "scent_notes": [
              "dry wood",
              "tannic"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 10,
            "harvest_tool_modifiers": {
              "axe": 1.5,
              "knife": 1.2
            },
            "harvest_requires_any_tools": [
              "axe",
              "knife"
            ],
            "harvest_yield": {
              "units_per_action": [
                5,
                15
              ],
              "actions_until_depleted": [
                4,
                10
              ]
            },
            "reach_tier": "ground",
            "harvest_damage": 0.3,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "inner_bark",
        "available_life_stages": [
          "sapling",
          "vegetative",
          "flowering",
          "fruiting",
          "senescent",
          "winter_bare"
        ],
        "sub_stages": [
          {
            "id": "spring_cambium",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_spring"
            },
            "field_description": "A pale, moist layer of cambium scraped from just beneath the bark. Pliable and smelling of fresh sap.",
            "game_description": "During spring sap flow, the inner bark is slightly sweet but still tannic. It yields usable cordage fiber.",
            "edibility_score": 0.2,
            "edibility_harshness": 0.7,
            "unit_weight_g": 10,
            "nutrition": {
              "calories": 8,
              "protein": 0.2,
              "carbs": 1.7,
              "fat": 0.1
            },
            "raw_extraction_efficiency": 0.5,
            "stew_nutrition_factor": 1.1,
            "texture": "moist fibrous",
            "taste_notes": [
              "mildly sweet",
              "astringent",
              "woody"
            ],
            "scent_notes": [
              "fresh sap"
            ],
            "average_fiber_length_cm": 15,
            "fiber_strength_modifier": 0.8,
            "craft_tags": [
              "cordage_fiber"
            ],
            "ingestion": null,
            "potency_multiplier": 0.6,
            "harvest_base_ticks": 10,
            "harvest_tool_modifiers": {
              "axe": 1.5,
              "knife": 1.2
            },
            "harvest_requires_any_tools": [
              "axe",
              "knife"
            ],
            "harvest_yield": {
              "units_per_action": [
                10,
                20
              ],
              "actions_until_depleted": [
                2,
                5
              ]
            },
            "reach_tier": "ground",
            "harvest_damage": 0.5,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 3,
            "can_dry": false
          },
          {
            "id": "late_season_inner_bark",
            "seasonal_window": {
              "start": "early_summer",
              "end": "winter"
            },
            "field_description": "Tough, dry strips of inner bark, highly fibrous and pale yellow-brown.",
            "game_description": "Too tough and astringent to eat, but an excellent material for cordage and coarse bark cloth. Retains medicinal tannin properties.",
            "edibility_score": 0.05,
            "edibility_harshness": 0.9,
            "nutrition": {
              "calories": 4,
              "protein": 0.1,
              "carbs": 0.8,
              "fat": 0
            },
            "raw_extraction_efficiency": 0.2,
            "stew_nutrition_factor": 0.5,
            "texture": "dry fibrous",
            "taste_notes": [
              "intensely bitter",
              "woody"
            ],
            "scent_notes": [
              "dry wood"
            ],
            "average_fiber_length_cm": 18,
            "fiber_strength_modifier": 1.1,
            "craft_tags": [
              "cordage_fiber",
              "inner_bark_cloth"
            ],
            "potency_multiplier": 1.2,
            "decay_days": 5
          }
        ]
      },
      {
        "name": "branch",
        "available_life_stages": [
          "seedling",
          "sapling",
          "vegetative",
          "flowering",
          "fruiting",
          "senescent",
          "winter_bare"
        ],
        "sub_stages": [
          {
            "id": "wood",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A sturdy, solid limb of oak wood with light gray bark.",
            "game_description": "White oak wood is incredibly dense, heavy, and rot-resistant, making excellent durable tool handles and structural material.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 500,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "hard woody",
            "taste_notes": [
              "woody"
            ],
            "scent_notes": [
              "dry wood"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [
              "stiff_stick"
            ],
            "ingestion": null,
            "potency_multiplier": 0,
            "harvest_base_ticks": 15,
            "harvest_tool_modifiers": {
              "axe": 1.5
            },
            "harvest_requires_any_tools": [
              "axe"
            ],
            "harvest_yield": {
              "units_per_action": [
                2,
                5
              ],
              "actions_until_depleted": [
                5,
                10
              ],
              "ground_action_fraction": 0.2
            },
            "reach_tier": "canopy",
            "reach_tier_by_life_stage": {
              "seedling": "ground",
              "sapling": "elevated"
            },
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      },
      {
        "name": "root",
        "available_life_stages": [
          "seedling",
          "sapling",
          "vegetative",
          "flowering",
          "fruiting",
          "senescent",
          "winter_bare"
        ],
        "sub_stages": [
          {
            "id": "tree_root",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A thick, gnarly wooden root covered in dirt.",
            "game_description": "Extremely difficult to extract and practically inedible, though it contains medicinal tannins.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 200,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "hard woody",
            "taste_notes": [
              "earthy",
              "bitter"
            ],
            "scent_notes": [
              "dirt",
              "woody"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1.5,
            "harvest_base_ticks": 15,
            "harvest_tool_modifiers": {},
            "harvest_requires_any_tools": [],
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                5,
                10
              ]
            },
            "harvest_damage": 0.8,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "dig_ticks_to_discover": 45,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "can_dry": true,
            "stew_nutrition_factor": 0
          }
        ]
      }
    ],
    "physical_description": "A massive, broad-canopied deciduous tree with light, ashy-gray bark that peels in loose plates. Leaves have 7 to 9 rounded lobes. Produces distinctively elongated acorns with shallow caps.",
    "game_description": "A slow-growing hardwood providing vital resources. Acorns are highly nutritious but require shelling and leaching or extended boiling in stew to remove mild tannins. Bark is useful for medicine and cordage, while branches provide sturdy wood.",
    "scent": {
      "strength": 0.1,
      "primary_compound": "hexanal"
    }
  },
  {
    "id": "saxifraga_virginiensis",
    "name": "Early Saxifrage",
    "longevity": "perennial",
    "age_of_maturity": 40,
    "soil": {
      "ph_range": [
        5.5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.5,
          1
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.2,
          0.7
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.2,
          0.6
        ]
      },
      "shade": {
        "tolerance_range": [
          0.2,
          0.8
        ]
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.15
        ]
      }
    },
    "seeding_window": {
      "start": "early_summer",
      "end": "mid_summer"
    },
    "dispersal": {
      "method": "gravity",
      "base_radius_tiles": 1,
      "wind_radius_bonus": 1,
      "water_dispersed": false,
      "animal_dispersed": false,
      "seeds_per_mature_plant": [
        50,
        200
      ],
      "germination_rate": 0.3,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": true,
      "viable_lifespan_days": 120
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A tiny rosette of fuzzy green leaves hugging the ground."
      },
      {
        "stage": "mature_flowering",
        "min_age_days": 40,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 10
        },
        "size": 2,
        "field_description": "A basal rosette of green, hairy leaves with a central hairy stalk topped by a cluster of small white, five-petaled flowers."
      },
      {
        "stage": "mature_seed_set",
        "min_age_days": 41,
        "seasonal_window": {
          "start_day": 11,
          "end_day": 20
        },
        "size": 2,
        "field_description": "Tiny dry seed capsules sit on a browning stalk. The basal leaves remain."
      },
      {
        "stage": "mature_vegetative",
        "min_age_days": 42,
        "seasonal_window": {
          "start_day": 21,
          "end_day": 40
        },
        "size": 1,
        "field_description": "A flat-lying rosette of dark green, somewhat tough basal leaves."
      }
    ],
    "parts": [
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "mature_flowering",
          "mature_seed_set",
          "mature_vegetative"
        ],
        "sub_stages": [
          {
            "id": "spring_rosette",
            "seasonal_window": {
              "start": "early_spring",
              "end": "mid_summer"
            },
            "field_description": "A small, fuzzy green leaf with toothed edges from a basal rosette.",
            "game_description": "Tender but fuzzy. Can be eaten raw in small amounts, but cooking makes them much more palatable.",
            "edibility_score": 0.6,
            "edibility_harshness": 0.2,
            "cooked_edibility_score": 0.8,
            "cooked_harshness": 0.1,
            "unit_weight_g": 1.5,
            "nutrition": {
              "calories": 0.3,
              "protein": 0.03,
              "carbs": 0.04,
              "fat": 0
            },
            "raw_extraction_efficiency": 0.7,
            "stew_nutrition_factor": 1.1,
            "texture": "fuzzy",
            "taste_notes": [
              "mild",
              "slightly bitter"
            ],
            "scent_notes": [
              "green"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.1,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                3
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0.2,
            "regrowth_days": 12,
            "regrowth_max_harvests": 2,
            "decay_days": 3,
            "can_dry": true
          },
          {
            "id": "late_season_rosette",
            "seasonal_window": {
              "start": "late_summer",
              "end": "winter"
            },
            "field_description": "A dark green, somewhat leathery and fibrous basal leaf.",
            "game_description": "Older leaves are tough and fibrous, offering very little nutritional value.",
            "edibility_score": 0.2,
            "edibility_harshness": 0.4,
            "cooked_edibility_score": 0.4,
            "cooked_harshness": 0.2,
            "texture": "leathery",
            "taste_notes": [
              "bitter",
              "earthy"
            ],
            "regrowth_days": null,
            "regrowth_max_harvests": null
          }
        ]
      },
      {
        "name": "stalk",
        "available_life_stages": [
          "mature_flowering",
          "mature_seed_set"
        ],
        "sub_stages": [
          {
            "id": "green_stalk",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_spring"
            },
            "field_description": "A short, green, very hairy stem.",
            "game_description": "Too hairy and fibrous to be good food, but technically edible.",
            "edibility_score": 0.3,
            "edibility_harshness": 0.3,
            "unit_weight_g": 3,
            "nutrition": {
              "calories": 0.5,
              "protein": 0.02,
              "carbs": 0.1,
              "fat": 0
            },
            "stew_nutrition_factor": 0.5,
            "texture": "hairy and fibrous",
            "taste_notes": [
              "bland"
            ],
            "scent_notes": [
              "grassy"
            ],
            "average_fiber_length_cm": 5,
            "fiber_strength_modifier": 0.2,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
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
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 4,
            "can_dry": false
          },
          {
            "id": "dry_stalk",
            "seasonal_window": {
              "start": "early_summer",
              "end": "mid_summer"
            },
            "field_description": "A thin, brittle, brown stalk.",
            "game_description": "A dead stalk. Offers no nutritional or crafting value.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 1,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "brittle",
            "decay_days": 20
          }
        ]
      },
      {
        "name": "flower",
        "available_life_stages": [
          "mature_flowering"
        ],
        "sub_stages": [
          {
            "id": "fresh_bloom",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_spring"
            },
            "field_description": "A small white flower with five petals, growing in a branched cluster.",
            "game_description": "Delicate and mild. Can be eaten raw or tossed into a stew.",
            "edibility_score": 0.9,
            "edibility_harshness": 0.05,
            "unit_weight_g": 0.2,
            "nutrition": {
              "calories": 0.05,
              "protein": 0,
              "carbs": 0.01,
              "fat": 0
            },
            "stew_nutrition_factor": 1,
            "texture": "delicate",
            "taste_notes": [
              "mild",
              "faintly sweet"
            ],
            "scent_notes": [
              "faint floral"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                3,
                8
              ],
              "actions_until_depleted": [
                1,
                1
              ]
            },
            "harvest_damage": 0.05,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 2,
            "can_dry": false
          }
        ]
      },
      {
        "name": "seed_capsule",
        "available_life_stages": [
          "mature_seed_set"
        ],
        "sub_stages": [
          {
            "id": "dry_capsule",
            "seasonal_window": {
              "start": "early_summer",
              "end": "mid_summer"
            },
            "field_description": "A tiny, dry brownish capsule containing dust-like seeds.",
            "game_description": "Too small to provide any meaningful nutrition.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 0.3,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "stew_nutrition_factor": 0,
            "texture": "dry",
            "taste_notes": [
              "dusty"
            ],
            "scent_notes": [
              "none"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                2,
                5
              ],
              "actions_until_depleted": [
                1,
                1
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 60,
            "can_dry": true
          }
        ]
      },
      {
        "name": "root",
        "available_life_stages": [
          "mature_flowering",
          "mature_seed_set",
          "mature_vegetative"
        ],
        "sub_stages": [
          {
            "id": "rhizome",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A small, stringy root mass with fine rootlets.",
            "game_description": "Fibrous and tiny. Not worth the effort to dig and eat.",
            "edibility_score": 0.1,
            "edibility_harshness": 0.6,
            "unit_weight_g": 5,
            "nutrition": {
              "calories": 0.5,
              "protein": 0.01,
              "carbs": 0.1,
              "fat": 0
            },
            "stew_nutrition_factor": 0.3,
            "texture": "tough and stringy",
            "taste_notes": [
              "earthy",
              "bland"
            ],
            "scent_notes": [
              "dirt"
            ],
            "average_fiber_length_cm": 3,
            "fiber_strength_modifier": 0.3,
            "fiberous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
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
            "dig_ticks_to_discover": 20,
            "decay_days": 8,
            "can_dry": false
          }
        ]
      }
    ],
    "physical_description": "A small perennial herb featuring a basal rosette of toothed, slightly fleshy, and hairy leaves. In early spring, it produces a leafless, hairy stalk topped with a branched cluster of small, five-petaled white flowers.",
    "game_description": "A small early-spring plant often found on rocky slopes. Its young basal leaves and flowers can be eaten in a pinch, but they are very small and quickly become fibrous. It serves as a reliable indicator of early spring.",
    "scent": {
      "strength": 0.1,
      "primary_compound": "hexanal"
    }
  },
  {
    "id": "typha_latifolia",
    "name": "Broadleaf Cattail",
    "longevity": "perennial",
    "age_of_maturity": 10,
    "soil": {
      "ph_range": [
        5.5,
        8.5
      ],
      "drainage": {
        "tolerance_range": [
          0,
          0.4
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.2,
          1
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.8,
          1
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.3
        ]
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.2
        ]
      }
    },
    "seeding_window": {
      "start": "early_fall",
      "end": "late_fall"
    },
    "dispersal": {
      "method": "wind",
      "base_radius_tiles": 10,
      "wind_radius_bonus": 10,
      "water_dispersed": true,
      "animal_dispersed": false,
      "seeds_per_mature_plant": [
        500,
        1000
      ],
      "germination_rate": 0.4,
      "germination_season": "spring",
      "requires_disturbance": false,
      "pioneer": true,
      "viable_lifespan_days": 300
    },
    "life_stages": [
      {
        "stage": "seedling",
        "min_age_days": 0,
        "seasonal_window": null,
        "size": 1,
        "field_description": "A small cluster of flat green shoots emerging from the mud or shallow water."
      },
      {
        "stage": "vegetative",
        "min_age_days": 10,
        "seasonal_window": {
          "start_day": 1,
          "end_day": 10
        },
        "size": 4,
        "field_description": "Tall, flat, strap-like leaves growing in a dense, vibrant green stand."
      },
      {
        "stage": "flowering",
        "min_age_days": 11,
        "seasonal_window": {
          "start_day": 11,
          "end_day": 20
        },
        "size": 4,
        "field_description": "Tall green leaves with a central stalk bearing a firm, green, cylindrical flower spike."
      },
      {
        "stage": "seed_set",
        "min_age_days": 12,
        "seasonal_window": {
          "start_day": 21,
          "end_day": 30
        },
        "size": 5,
        "field_description": "Tall leaves surrounding stiff stalks topped with dense, brown, cylindrical seed heads."
      },
      {
        "stage": "senescent",
        "min_age_days": 13,
        "seasonal_window": {
          "start_day": 31,
          "end_day": 35
        },
        "size": 4,
        "field_description": "Browning leaves with the brown seed heads beginning to burst into fluffy white masses."
      },
      {
        "stage": "dormant",
        "min_age_days": 14,
        "seasonal_window": {
          "start_day": 36,
          "end_day": 40
        },
        "size": 1,
        "field_description": "Dead, broken brown stalks standing above the water or mud. The starchy rhizomes remain alive beneath the surface."
      }
    ],
    "parts": [
      {
        "name": "rhizome",
        "available_life_stages": [
          "vegetative",
          "flowering",
          "seed_set",
          "senescent",
          "dormant"
        ],
        "sub_stages": [
          {
            "id": "mature",
            "seasonal_window": {
              "start": "early_spring",
              "end": "winter"
            },
            "field_description": "A thick, spongy, mud-covered root. It is extremely fibrous but heavy with dense starch.",
            "game_description": "Highly caloric but too fibrous to eat raw effectively. Can be roasted to chew out the starch, but best pounded into flour.",
            "edibility_score": 0.2,
            "edibility_harshness": 0.1,
            "cooked_edibility_score": 0.7,
            "cooked_harshness": 0,
            "unit_weight_g": 100,
            "nutrition": {
              "calories": 70,
              "protein": 1.5,
              "carbs": 16,
              "fat": 0.2
            },
            "raw_extraction_efficiency": 0.1,
            "stew_nutrition_factor": 0.8,
            "processing_options": [
              {
                "id": "extract_starch",
                "ticks": 45,
                "location": "mortar_pestle",
                "outputs": [
                  {
                    "part": "cattail_flour",
                    "yield_fraction": 0.3,
                    "output_unit_weight_g": 1
                  }
                ]
              }
            ],
            "texture": "spongy and extremely fibrous",
            "taste_notes": [
              "starchy",
              "muddy",
              "mildly sweet"
            ],
            "scent_notes": [
              "earthy",
              "muddy"
            ],
            "average_fiber_length_cm": 10,
            "fiber_strength_modifier": 0.5,
            "fibrous": true,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 1,
            "dig_ticks_to_discover": 30,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                2
              ],
              "actions_until_depleted": [
                2,
                4
              ]
            },
            "harvest_damage": 1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 14,
            "can_dry": true
          }
        ]
      },
      {
        "name": "cattail_flour",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "dry",
            "field_description": "A fine, starchy, pale tan flour pounded from rhizomes.",
            "game_description": "Calorie-dense starch extracted from cattail rhizomes. Excellent for thickening stews or baking.",
            "edibility_score": 0.5,
            "edibility_harshness": 0,
            "cooked_edibility_score": 0.95,
            "cooked_harshness": 0,
            "unit_weight_g": 1,
            "nutrition": {
              "calories": 3.5,
              "protein": 0.05,
              "carbs": 0.8,
              "fat": 0.01
            },
            "raw_extraction_efficiency": 0.8,
            "stew_nutrition_factor": 1.4,
            "texture": "powdery",
            "taste_notes": [
              "bland",
              "starchy"
            ],
            "scent_notes": [
              "earthy"
            ],
            "average_fiber_length_cm": 0,
            "fiber_strength_modifier": 0,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 180,
            "can_dry": true
          }
        ]
      },
      {
        "name": "shoot",
        "available_life_stages": [
          "vegetative"
        ],
        "sub_stages": [
          {
            "id": "young",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_spring"
            },
            "field_description": "The tender, pale green inner core of a young cattail stalk.",
            "game_description": "Tender and field-edible raw. Crisp, refreshing, and cucumber-like.",
            "edibility_score": 0.95,
            "edibility_harshness": 0,
            "unit_weight_g": 40,
            "nutrition": {
              "calories": 10,
              "protein": 0.5,
              "carbs": 2,
              "fat": 0
            },
            "raw_extraction_efficiency": 1,
            "stew_nutrition_factor": 1,
            "texture": "crisp",
            "taste_notes": [
              "mild",
              "sweet",
              "cucumber-like"
            ],
            "scent_notes": [
              "fresh",
              "green"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.2,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
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
                1,
                2
              ]
            },
            "harvest_damage": 0.8,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 4,
            "can_dry": false
          }
        ]
      },
      {
        "name": "leaf",
        "available_life_stages": [
          "seedling",
          "vegetative",
          "flowering",
          "seed_set",
          "senescent"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_spring",
              "end": "late_summer"
            },
            "field_description": "A long, flat, strap-like green leaf. Spongy at the base and highly pliable.",
            "game_description": "Excellent pliable material for weaving mats and baskets. Too fibrous to eat.",
            "edibility_score": 0,
            "edibility_harshness": 0.8,
            "unit_weight_g": 15,
            "nutrition": {
              "calories": 1,
              "protein": 0.1,
              "carbs": 0.2,
              "fat": 0
            },
            "raw_extraction_efficiency": 0,
            "stew_nutrition_factor": 0,
            "texture": "smooth and pliable",
            "taste_notes": [
              "grassy"
            ],
            "scent_notes": [
              "green"
            ],
            "average_fiber_length_cm": 60,
            "fiber_strength_modifier": 1.2,
            "fibrous": true,
            "craft_tags": [
              "weaving_material"
            ],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {
              "knife": 1.5,
              "blickey": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                2,
                5
              ],
              "actions_until_depleted": [
                3,
                6
              ]
            },
            "harvest_damage": 0.2,
            "regrowth_days": 10,
            "regrowth_max_harvests": 2,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 5,
            "can_dry": true
          },
          {
            "id": "dry",
            "seasonal_window": {
              "start": "early_fall",
              "end": "winter"
            },
            "field_description": "A dry, tan, papery strap-like leaf.",
            "game_description": "Dry material suitable for weaving mats and other reedy crafts.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 5,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "texture": "papery and stiff",
            "craft_tags": [
              "reedy_material"
            ],
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "decay_days": 40
          }
        ]
      },
      {
        "name": "flower_spike",
        "available_life_stages": [
          "flowering"
        ],
        "sub_stages": [
          {
            "id": "green",
            "seasonal_window": {
              "start": "early_summer",
              "end": "mid_summer"
            },
            "field_description": "A firm, bright green cylindrical spike atop a tall stalk.",
            "game_description": "Can be boiled and eaten like corn on the cob. Starchy and nutritious.",
            "edibility_score": 0.3,
            "edibility_harshness": 0.1,
            "cooked_edibility_score": 0.9,
            "cooked_harshness": 0,
            "unit_weight_g": 45,
            "nutrition": {
              "calories": 20,
              "protein": 1.5,
              "carbs": 4,
              "fat": 0.1
            },
            "raw_extraction_efficiency": 0.5,
            "stew_nutrition_factor": 1.2,
            "texture": "firm and granular",
            "taste_notes": [
              "corn-like",
              "sweet"
            ],
            "scent_notes": [
              "fresh",
              "grassy"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0.2,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                1
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0.1,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 3,
            "can_dry": false
          }
        ]
      },
      {
        "name": "seed_spike",
        "available_life_stages": [
          "seed_set"
        ],
        "sub_stages": [
          {
            "id": "brown",
            "seasonal_window": {
              "start": "late_summer",
              "end": "early_fall"
            },
            "field_description": "The iconic dark brown 'corn dog' of the cattail, densely packed with thousands of seeds and tightly compressed fluff.",
            "game_description": "Inedible. Can be harvested whole and processed by hand to extract large amounts of insulating fluff.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 30,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "raw_extraction_efficiency": 0,
            "stew_nutrition_factor": 0,
            "processing_options": [
              {
                "id": "extract_fluff",
                "ticks": 15,
                "location": "hand",
                "outputs": [
                  {
                    "part": "fluff",
                    "yield_fraction": 0.8,
                    "output_unit_weight_g": 1
                  }
                ]
              }
            ],
            "texture": "dense and velvety",
            "taste_notes": [],
            "scent_notes": [
              "dry",
              "dusty"
            ],
            "average_fiber_length_cm": 1,
            "fiber_strength_modifier": 0.1,
            "fibrous": false,
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {
              "knife": 1.5
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                1
              ],
              "actions_until_depleted": [
                1,
                2
              ]
            },
            "harvest_damage": 0,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 60,
            "can_dry": true
          }
        ]
      },
      {
        "name": "fluff",
        "available_life_stages": [],
        "sub_stages": [
          {
            "id": "dry",
            "field_description": "A massive, expanding handful of downy white seed fluff.",
            "game_description": "Premium soft insulation for stuffing clothing.",
            "edibility_score": 0,
            "edibility_harshness": 1,
            "unit_weight_g": 1,
            "nutrition": {
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0
            },
            "raw_extraction_efficiency": 0,
            "stew_nutrition_factor": 0,
            "texture": "soft and downy",
            "taste_notes": [],
            "scent_notes": [
              "dusty"
            ],
            "average_fiber_length_cm": 2,
            "fiber_strength_modifier": 0,
            "fibrous": false,
            "craft_tags": [
              "insulation_material"
            ],
            "ingestion": null,
            "potency_multiplier": null,
            "harvest_base_ticks": null,
            "harvest_tool_modifiers": {},
            "harvest_yield": null,
            "harvest_damage": null,
            "regrowth_days": null,
            "regrowth_max_harvests": null,
            "on_harvest_injury": null,
            "does_blickey_help_harvest": false,
            "can_squirrel_cache": false,
            "decay_days": 180,
            "can_dry": true
          }
        ]
      }
    ],
    "physical_description": "A tall, reedy aquatic plant with long, flat, strap-like leaves and a distinctive brown cylindrical seed head. Spreads densely via underwater rhizomes.",
    "game_description": "A highly versatile wetland survival plant. Young shoots are crisp and edible raw, and the starchy roots provide dense calories when pounded or cooked. The leaves are excellent for weaving mats and baskets, and the mature seed fluff is excellent insulation for clothing.",
    "scent": {
      "strength": 0.1,
      "primary_compound": "geosmin"
    }
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
      },
      "salinity": {
        "tolerance_range": [
          0,
          0.28
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
                3,
                8
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
                1
              ],
              "actions_until_depleted": [
                1,
                1
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
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 1,
            "harvest_base_ticks": 1,
            "harvest_tool_modifiers": {},
            "harvest_yield": {
              "units_per_action": [
                1,
                2
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
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.5,
            "harvest_base_ticks": 3,
            "harvest_tool_modifiers": {
              "knife": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                1,
                3
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
            "craft_tags": [],
            "ingestion": null,
            "potency_multiplier": 0.2,
            "harvest_base_ticks": 4,
            "harvest_tool_modifiers": {
              "knife": 1.1
            },
            "harvest_yield": {
              "units_per_action": [
                2,
                6
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
    ],
    "physical_description": "An upright herbaceous perennial reaching 1 to 2 meters tall. Its deeply veined, serrated leaves are arranged oppositely on a fibrous green stalk. The entire plant is covered in tiny, stiff, hollow hairs.",
    "game_description": "The leaves are high in vitamins and make a good cooked green, as boiling completely destroys the stinging hairs. In late summer and fall, the mature stalks provide strong, high-quality fiber for cordage. Harvesting bare-handed will cause painful stings.",
    "scent": {
      "strength": 0.3,
      "primary_compound": "hexenal"
    }
  }
];

export default PLANT_CATALOG_SOURCE;
