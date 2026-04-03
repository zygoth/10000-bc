const GROUND_FUNGUS_CATALOG_SOURCE = [
  {
    "id": "agaricus_campestris",
    "type": "ground_fungus",
    "common_name": "Meadow Mushroom",
    "latin_name": "Agaricus campestris",
    "zone_count_range": [
      18,
      36
    ],
    "zone_radius_range": [
      2,
      4
    ],
    "annual_fruit_chance": 0.42,
    "soil_requirements": {
      "ph_range": [
        6,
        7.6
      ],
      "drainage": {
        "tolerance_range": [
          0.4,
          0.95
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.35,
          1
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.3,
          0.72
        ]
      },
      "shade": {
        "tolerance_range": [
          0,
          0.35
        ]
      }
    },
    "fruiting_windows": [
      {
        "start": "late_summer",
        "end": "mid_fall"
      }
    ],
    "per_tile_yield_range": [
      20,
      88
    ]
  },
  {
    "id": "amanita_bisporigera",
    "type": "ground_fungus",
    "common_name": "Destroying Angel",
    "latin_name": "Amanita bisporigera",
    "zone_count_range": [
      14,
      24
    ],
    "zone_radius_range": [
      2,
      4
    ],
    "annual_fruit_chance": 0.5,
    "soil_requirements": {
      "ph_range": [
        5.5,
        7.5
      ],
      "drainage": {
        "tolerance_range": [
          0.35,
          0.85
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
          0.35,
          0.75
        ]
      },
      "shade": {
        "tolerance_range": [
          0.3,
          1
        ]
      }
    },
    "fruiting_windows": [
      {
        "start": "early_summer",
        "end": "early_fall"
      }
    ],
    "per_tile_yield_range": [
      20,
      80
    ]
  },
  {
    "id": "cantharellus_cibarius",
    "type": "ground_fungus",
    "common_name": "Chanterelle",
    "latin_name": "Cantharellus cibarius",
    "zone_count_range": [
      16,
      30
    ],
    "zone_radius_range": [
      2,
      5
    ],
    "annual_fruit_chance": 0.34,
    "soil_requirements": {
      "ph_range": [
        5.2,
        6.8
      ],
      "drainage": {
        "tolerance_range": [
          0.3,
          0.82
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.25,
          0.78
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.42,
          0.82
        ]
      },
      "shade": {
        "tolerance_range": [
          0.35,
          0.95
        ]
      }
    },
    "fruiting_windows": [
      {
        "start": "mid_summer",
        "end": "early_fall"
      }
    ],
    "per_tile_yield_range": [
      16,
      74
    ]
  },
  {
    "id": "morchella_americana",
    "type": "ground_fungus",
    "common_name": "Morel",
    "latin_name": "Morchella americana",
    "zone_count_range": [
      15,
      28
    ],
    "zone_radius_range": [
      2,
      4
    ],
    "annual_fruit_chance": 0.38,
    "soil_requirements": {
      "ph_range": [
        5.7,
        7.2
      ],
      "drainage": {
        "tolerance_range": [
          0.35,
          0.85
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.3,
          0.85
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.38,
          0.78
        ]
      },
      "shade": {
        "tolerance_range": [
          0.2,
          0.7
        ]
      }
    },
    "fruiting_windows": [
      {
        "start": "mid_spring",
        "end": "late_spring"
      }
    ],
    "per_tile_yield_range": [
      18,
      80
    ]
  },
  {
    "id": "psilocybe_caerulipes",
    "type": "ground_fungus",
    "common_name": "Blue-foot Psilocybe",
    "latin_name": "Psilocybe caerulipes",
    "zone_count_range": [
      10,
      22
    ],
    "zone_radius_range": [
      2,
      4
    ],
    "annual_fruit_chance": 0.28,
    "soil_requirements": {
      "ph_range": [
        5.5,
        7
      ],
      "drainage": {
        "tolerance_range": [
          0.35,
          0.88
        ]
      },
      "fertility": {
        "tolerance_range": [
          0.25,
          0.82
        ]
      },
      "moisture": {
        "tolerance_range": [
          0.42,
          0.85
        ]
      },
      "shade": {
        "tolerance_range": [
          0.35,
          0.95
        ]
      }
    },
    "fruiting_windows": [
      {
        "start": "mid_summer",
        "end": "late_fall"
      }
    ],
    "per_tile_yield_range": [
      12,
      48
    ],
    "game_tags": [
      "psilocybin"
    ],
    "ingestion": {
      "vision_item": {
        "quantity_per_dose": 1
      },
      "dose_response": [
        {
          "effects": [
            {
              "type": "hallucinogen",
              "partner_prep_required": true,
              "vision_categories": [
                "plant",
                "tech",
                "sight"
              ],
              "sight_duration_days": 5
            }
          ]
        }
      ]
    }
  }
];

export default GROUND_FUNGUS_CATALOG_SOURCE;
