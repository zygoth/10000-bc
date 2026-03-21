const LOG_FUNGUS_CATALOG_SOURCE = [
  {
    "id": "grifola_frondosa",
    "type": "log_fungus",
    "common_name": "Hen of the Woods",
    "latin_name": "Grifola frondosa",
    "host_trees": [
      "any_hardwood"
    ],
    "preferred_decay_stages": [
      3,
      4
    ],
    "base_spawn_chance": 0.2,
    "fruiting_windows": [
      {
        "start": "early_fall",
        "end": "late_fall"
      }
    ],
    "per_log_yield_range": [
      350,
      950
    ]
  },
  {
    "id": "pleurotus_ostreatus",
    "type": "log_fungus",
    "common_name": "Oyster Mushroom",
    "latin_name": "Pleurotus ostreatus",
    "host_trees": [
      "any_hardwood"
    ],
    "preferred_decay_stages": [
      2,
      3
    ],
    "base_spawn_chance": 0.4,
    "fruiting_windows": [
      {
        "start": "mid_fall",
        "end": "early_winter"
      },
      {
        "start": "early_spring",
        "end": "mid_spring"
      }
    ],
    "per_log_yield_range": [
      400,
      900
    ]
  },
  {
    "id": "trametes_versicolor",
    "type": "log_fungus",
    "common_name": "Turkey Tail",
    "latin_name": "Trametes versicolor",
    "host_trees": [
      "any_hardwood"
    ],
    "preferred_decay_stages": [
      2,
      3,
      4
    ],
    "base_spawn_chance": 0.55,
    "fruiting_windows": [
      {
        "start": "mid_spring",
        "end": "late_fall"
      }
    ],
    "per_log_yield_range": [
      120,
      320
    ]
  }
];

export default LOG_FUNGUS_CATALOG_SOURCE;
