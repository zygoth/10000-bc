const PLANT_CATALOG_SOURCE = [
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
                3
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
                5,
                15
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
            "harvest_base_ticks": 2,
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
            "harvest_base_ticks": 2,
            "harvest_tool_modifiers": {
              "knife": 1.2
            },
            "harvest_yield": {
              "units_per_action": [
                2,
                5
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
            "harvest_base_ticks": 3,
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
                4,
                8
              ],
              "actions_until_depleted": [
                2,
                4
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
                2
              ],
              "actions_until_depleted": [
                1,
                3
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
