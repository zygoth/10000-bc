const ANIMAL_CATALOG_SOURCE = [
  {
    "id": "catostomus_commersonii",
    "name": "White Sucker",
    "animal_class": "fish",
    "physical_description": "Bottom-feeding sucker with subterminal mouth and bronze-olive body.",
    "habitat": [
      "slow_river",
      "fast_river"
    ],
    "water_required": true,
    "weight_range_g": [
      300,
      1500
    ],
    "behaviors": [
      "schooling",
      "bottom_feeder",
      "spawning_run"
    ],
    "diet": [
      "detritus",
      "insect_larvae",
      "benthic_invertebrates"
    ],
    "population": {
      "starting_density": 1,
      "density_per_catch": -0.014,
      "daily_recovery": 0.055,
      "spillover_rate": 0.1,
      "depletion_threshold": 0.15,
      "hibernates": false,
      "season_modifiers": {
        "spring": 2.5,
        "summer": 1,
        "fall": 0.8,
        "winter": 0.5
      }
    },
    "base_catch_rate": 0.62,
    "rod_compatible": false,
    "current_sensitivity": 0.9,
    "parts": [
      {
        "id": "meat",
        "yield_grams": 605,
        "unit_weight_g": 1,
        "cooked_edibility_score": 0.85,
        "cooked_harshness": 0.05,
        "nutrition": {
          "calories": 740,
          "protein": 102,
          "carbs": 0,
          "fat": 21
        },
        "processing_options": [
          {
            "id": "clean",
            "ticks": 5,
            "location": "hand",
            "outputs": []
          }
        ],
        "decay_days": 2,
        "can_dry": true,
        "can_freeze": true,
        "stew_nutrition_factor": 1.1,
        "flavor_profile": [
          "savory",
          "earthy"
        ],
        "nausea_family": "fish"
      }
    ]
  },
  {
    "id": "esox_lucius",
    "name": "Northern Pike",
    "animal_class": "fish",
    "physical_description": "Long-bodied ambush predator with duckbill snout and pale oval spots.",
    "habitat": [
      "slow_river",
      "pond"
    ],
    "water_required": true,
    "weight_range_g": [
      800,
      5000
    ],
    "behaviors": [
      "ambush_predator",
      "solitary"
    ],
    "diet": [
      "small_fish",
      "amphibians",
      "crayfish"
    ],
    "population": {
      "starting_density": 0.75,
      "density_per_catch": -0.02,
      "daily_recovery": 0.04,
      "spillover_rate": 0.07,
      "depletion_threshold": 0.15,
      "hibernates": false,
      "season_modifiers": {
        "spring": 1.1,
        "summer": 0.9,
        "fall": 1,
        "winter": 0.45
      }
    },
    "base_catch_rate": 0.4,
    "rod_compatible": true,
    "current_sensitivity": 0.4,
    "parts": [
      {
        "id": "meat",
        "yield_grams": 1885,
        "unit_weight_g": 1,
        "cooked_edibility_score": 0.85,
        "cooked_harshness": 0.05,
        "nutrition": {
          "calories": 1980,
          "protein": 255,
          "carbs": 0,
          "fat": 62
        },
        "processing_options": [
          {
            "id": "clean",
            "ticks": 7,
            "location": "hand",
            "outputs": []
          }
        ],
        "decay_days": 2,
        "can_dry": true,
        "can_freeze": true,
        "stew_nutrition_factor": 1.1,
        "flavor_profile": [
          "savory",
          "rich"
        ],
        "nausea_family": "fish"
      }
    ]
  },
  {
    "id": "ictalurus_punctatus",
    "name": "Channel Catfish",
    "animal_class": "fish",
    "physical_description": "Whiskered river catfish with spotted juvenile pattern and forked tail.",
    "habitat": [
      "slow_river",
      "fast_river"
    ],
    "water_required": true,
    "weight_range_g": [
      500,
      4000
    ],
    "behaviors": [
      "bottom_feeder",
      "nocturnal"
    ],
    "diet": [
      "insect_larvae",
      "small_fish",
      "detritus",
      "crayfish"
    ],
    "population": {
      "starting_density": 0.95,
      "density_per_catch": -0.017,
      "daily_recovery": 0.05,
      "spillover_rate": 0.09,
      "depletion_threshold": 0.15,
      "hibernates": false,
      "season_modifiers": {
        "spring": 0.95,
        "summer": 1.1,
        "fall": 0.9,
        "winter": 0.5
      }
    },
    "base_catch_rate": 0.5,
    "rod_compatible": true,
    "current_sensitivity": 0.6,
    "parts": [
      {
        "id": "meat",
        "yield_grams": 1530,
        "unit_weight_g": 1,
        "cooked_edibility_score": 0.85,
        "cooked_harshness": 0.05,
        "nutrition": {
          "calories": 1910,
          "protein": 260,
          "carbs": 0,
          "fat": 58
        },
        "processing_options": [
          {
            "id": "clean",
            "ticks": 7,
            "location": "hand",
            "outputs": []
          }
        ],
        "decay_days": 2,
        "can_dry": true,
        "can_freeze": true,
        "stew_nutrition_factor": 1.1,
        "flavor_profile": [
          "savory",
          "fatty"
        ],
        "nausea_family": "fish"
      }
    ]
  },
  {
    "id": "lepomis_macrochirus",
    "name": "Bluegill",
    "animal_class": "fish",
    "physical_description": "Small deep-bodied sunfish with olive flanks and orange-yellow belly.",
    "habitat": [
      "pond",
      "slow_river"
    ],
    "water_required": true,
    "weight_range_g": [
      90,
      450
    ],
    "behaviors": [
      "schooling",
      "bottom_feeder"
    ],
    "diet": [
      "insect_larvae",
      "gammarus_sp",
      "aquatic_vegetation"
    ],
    "population": {
      "starting_density": 1,
      "density_per_catch": -0.015,
      "daily_recovery": 0.05,
      "spillover_rate": 0.08,
      "depletion_threshold": 0.15,
      "hibernates": false,
      "season_modifiers": {
        "spring": 0.9,
        "summer": 1,
        "fall": 0.8,
        "winter": 0.5
      }
    },
    "base_catch_rate": 0.55,
    "rod_compatible": true,
    "current_sensitivity": 0.2,
    "parts": [
      {
        "id": "meat",
        "yield_grams": 175,
        "unit_weight_g": 1,
        "cooked_edibility_score": 0.85,
        "cooked_harshness": 0.05,
        "nutrition": {
          "calories": 200,
          "protein": 33,
          "carbs": 0,
          "fat": 9
        },
        "processing_options": [
          {
            "id": "clean",
            "ticks": 5,
            "location": "hand",
            "outputs": []
          }
        ],
        "decay_days": 2,
        "can_dry": true,
        "can_freeze": true,
        "stew_nutrition_factor": 1.1,
        "flavor_profile": [
          "mild",
          "savory"
        ],
        "nausea_family": "fish"
      }
    ]
  },
  {
    "id": "micropterus_salmoides",
    "name": "Largemouth Bass",
    "animal_class": "fish",
    "physical_description": "Large predatory bass with a broad mouth and olive-green lateral stripe.",
    "habitat": [
      "pond",
      "slow_river"
    ],
    "water_required": true,
    "weight_range_g": [
      500,
      3000
    ],
    "behaviors": [
      "ambush_predator",
      "structure_oriented"
    ],
    "diet": [
      "small_fish",
      "insect_larvae",
      "crayfish"
    ],
    "population": {
      "starting_density": 0.9,
      "density_per_catch": -0.018,
      "daily_recovery": 0.045,
      "spillover_rate": 0.08,
      "depletion_threshold": 0.15,
      "hibernates": false,
      "season_modifiers": {
        "spring": 1.1,
        "summer": 1,
        "fall": 1.1,
        "winter": 0.45
      }
    },
    "base_catch_rate": 0.48,
    "rod_compatible": true,
    "current_sensitivity": 0.3,
    "parts": [
      {
        "id": "meat",
        "yield_grams": 1140,
        "unit_weight_g": 1,
        "cooked_edibility_score": 0.85,
        "cooked_harshness": 0.05,
        "nutrition": {
          "calories": 1480,
          "protein": 210,
          "carbs": 0,
          "fat": 46
        },
        "processing_options": [
          {
            "id": "clean",
            "ticks": 6,
            "location": "hand",
            "outputs": []
          }
        ],
        "decay_days": 2,
        "can_dry": true,
        "can_freeze": true,
        "stew_nutrition_factor": 1.1,
        "flavor_profile": [
          "savory",
          "rich"
        ],
        "nausea_family": "fish"
      }
    ]
  },
  {
    "id": "sciurus_carolinensis",
    "name": "Eastern Gray Squirrel",
    "animal_class": "mammal",
    "physical_description": "Tree-dwelling squirrel with gray coat and bushy tail; common in mixed hardwood forests.",
    "habitat": [
      "deciduous_forest",
      "forest_edge",
      "riparian_woods"
    ],
    "water_required": false,
    "weight_range_g": [
      350,
      800
    ],
    "behaviors": [
      "arboreal",
      "cache_builder",
      "diurnal"
    ],
    "diet": [
      "juglans_nigra",
      "quercus_alba",
      "quercus_macrocarpa",
      "quercus_rubra",
      "carya_ovata",
      "carya_cordiformis",
      "fagus_grandifolia",
      "ulmus_americana",
      "ulmus_rubra",
      "acer_saccharum",
      "acer_rubrum",
      "tilia_americana",
      "corylus_americana",
      "prunus_serotina",
      "prunus_americana",
      "malus_coronaria",
      "rubus_allegheniensis",
      "rubus_occidentalis",
      "vitis_riparia",
      "cornus_florida",
      "sambucus_canadensis",
      "asimina_triloba",
      "diospyros_virginiana",
      "celtis_occidentalis",
      "morus_rubra",
      "pinus_strobus",
      "pinus_resinosa",
      "helianthus_annuus",
      "ambrosia_trifida",
      "daucus_carota"
    ],
    "population": {
      "starting_density": 0.6,
      "density_per_catch": -0.025,
      "daily_recovery": 0.012,
      "spillover_rate": 0.04,
      "depletion_threshold": 0.2,
      "hibernates": false,
      "season_modifiers": {
        "spring": 1,
        "summer": 1,
        "fall": 1,
        "winter": 0.4
      }
    },
    "base_catch_rate": 0.2,
    "parts": [
      {
        "id": "meat",
        "yield_grams": 360,
        "unit_weight_g": 1,
        "cooked_edibility_score": 0.85,
        "cooked_harshness": 0.05,
        "nutrition": {
          "calories": 390,
          "protein": 45,
          "carbs": 0,
          "fat": 16
        },
        "processing_options": [
          {
            "id": "butcher",
            "ticks": 9,
            "location": "hand",
            "outputs": []
          }
        ],
        "decay_days": 3,
        "can_dry": true,
        "can_freeze": true,
        "stew_nutrition_factor": 1.2,
        "flavor_profile": [
          "savory",
          "lean"
        ],
        "nausea_family": "lean_game"
      },
      {
        "id": "hide",
        "yield_grams": 420,
        "unit_weight_g": 1,
        "processing_options": [
          {
            "id": "scrape_and_dry",
            "ticks": 70,
            "location": "hide_frame",
            "outputs": [
              {
                "itemId": "dried_hide",
                "yield_fraction": 0.82,
                "output_unit_weight_g": 1
              }
            ]
          }
        ]
      },
      {
        "id": "bone",
        "yield_quantity": 1,
        "yield_grams": 90,
        "unit_weight_g": 90,
        "nutrition": {
          "calories": 45,
          "protein": 7,
          "carbs": 0,
          "fat": 1
        },
        "can_dry": false,
        "can_freeze": true,
        "craft_tags": [
          "bone_tool_material"
        ]
      },
      {
        "id": "fat",
        "yield_grams": 45,
        "unit_weight_g": 1,
        "nutrition": {
          "calories": 70,
          "protein": 0,
          "carbs": 0,
          "fat": 13
        }
      },
      {
        "id": "dried_hide",
        "available_life_stages": [],
        "unit_weight_g": 1,
        "can_dry": false,
        "craft_tags": [
          "hide_material"
        ]
      }
    ]
  },
  {
    "id": "semotilus_atromaculatus",
    "name": "Creek Chub",
    "animal_class": "fish",
    "physical_description": "Small stream minnow with dark lateral stripe and terminal mouth.",
    "habitat": [
      "stream",
      "slow_river"
    ],
    "water_required": true,
    "weight_range_g": [
      50,
      200
    ],
    "behaviors": [
      "schooling",
      "opportunistic_feeder"
    ],
    "diet": [
      "insect_larvae",
      "aquatic_insects",
      "detritus"
    ],
    "population": {
      "starting_density": 1.05,
      "density_per_catch": -0.012,
      "daily_recovery": 0.055,
      "spillover_rate": 0.1,
      "depletion_threshold": 0.15,
      "hibernates": false,
      "season_modifiers": {
        "spring": 1,
        "summer": 1.05,
        "fall": 0.85,
        "winter": 0.45
      }
    },
    "base_catch_rate": 0.58,
    "rod_compatible": true,
    "current_sensitivity": 0.7,
    "parts": [
      {
        "id": "meat",
        "yield_grams": 80,
        "unit_weight_g": 1,
        "cooked_edibility_score": 0.85,
        "cooked_harshness": 0.05,
        "nutrition": {
          "calories": 85,
          "protein": 13,
          "carbs": 0,
          "fat": 3
        },
        "processing_options": [
          {
            "id": "clean",
            "ticks": 4,
            "location": "hand",
            "outputs": []
          }
        ],
        "decay_days": 2,
        "can_dry": true,
        "can_freeze": true,
        "stew_nutrition_factor": 1.1,
        "flavor_profile": [
          "mild",
          "savory"
        ],
        "nausea_family": "fish"
      }
    ]
  },
  {
    "id": "sylvilagus_floridanus",
    "name": "Eastern Cottontail",
    "animal_class": "mammal",
    "physical_description": "Small brown rabbit with a white cotton tail; common in field edges and open brush.",
    "habitat": [
      "meadow",
      "forest_edge",
      "scrubland"
    ],
    "water_required": false,
    "weight_range_g": [
      400,
      1400
    ],
    "behaviors": [
      "ground_dwelling",
      "trail_runner",
      "crepuscular"
    ],
    "diet": [
      "daucus_carota",
      "trifolium_repens",
      "trifolium_pratense",
      "taraxacum_officinale",
      "plantago_major",
      "poa_pratensis",
      "elymus_virginicus",
      "ambrosia_artemisiifolia",
      "solidago_canadensis",
      "fragaria_virginiana",
      "rubus_allegheniensis",
      "rubus_occidentalis",
      "symphoricarpos_albus",
      "salix_interior",
      "salix_nigra",
      "acer_saccharum",
      "acer_rubrum",
      "quercus_alba",
      "quercus_macrocarpa",
      "ulmus_americana",
      "urtica_dioica",
      "lactuca_canadensis",
      "amaranthus_retroflexus",
      "chenopodium_album",
      "polygonum_pensylvanicum",
      "medicago_sativa",
      "achillea_millefolium",
      "asclepias_syriaca",
      "cirsium_discolor",
      "parthenocissus_quinquefolia"
    ],
    "population": {
      "starting_density": 0.7,
      "density_per_catch": -0.03,
      "daily_recovery": 0.015,
      "spillover_rate": 0.05,
      "depletion_threshold": 0.2,
      "hibernates": false,
      "season_modifiers": {
        "spring": 1,
        "summer": 1,
        "fall": 1,
        "winter": 1
      }
    },
    "base_catch_rate": 0.25,
    "parts": [
      {
        "id": "meat",
        "yield_grams": 520,
        "unit_weight_g": 1,
        "cooked_edibility_score": 0.85,
        "cooked_harshness": 0.05,
        "nutrition": {
          "calories": 520,
          "protein": 59,
          "carbs": 0,
          "fat": 20
        },
        "processing_options": [
          {
            "id": "butcher",
            "ticks": 10,
            "location": "hand",
            "outputs": []
          }
        ],
        "decay_days": 3,
        "can_dry": true,
        "can_freeze": true,
        "stew_nutrition_factor": 1.2,
        "flavor_profile": [
          "savory",
          "lean"
        ],
        "nausea_family": "lean_game"
      },
      {
        "id": "hide",
        "yield_grams": 650,
        "unit_weight_g": 1,
        "processing_options": [
          {
            "id": "scrape_and_dry",
            "ticks": 90,
            "location": "hide_frame",
            "outputs": [
              {
                "itemId": "dried_hide",
                "yield_fraction": 0.85,
                "output_unit_weight_g": 1
              }
            ]
          }
        ]
      },
      {
        "id": "bone",
        "yield_quantity": 1,
        "yield_grams": 120,
        "unit_weight_g": 120,
        "nutrition": {
          "calories": 70,
          "protein": 10,
          "carbs": 0,
          "fat": 3
        },
        "can_dry": false,
        "can_freeze": true,
        "craft_tags": [
          "bone_tool_material"
        ]
      },
      {
        "id": "fat",
        "yield_grams": 60,
        "unit_weight_g": 1,
        "nutrition": {
          "calories": 90,
          "protein": 0,
          "carbs": 0,
          "fat": 16
        }
      },
      {
        "id": "dried_hide",
        "available_life_stages": [],
        "unit_weight_g": 1,
        "can_dry": false,
        "craft_tags": [
          "hide_material"
        ]
      }
    ]
  }
];

export default ANIMAL_CATALOG_SOURCE;
