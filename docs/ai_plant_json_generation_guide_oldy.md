# AI Plant Object Generation Guide
## 10000 BC Survival Game

This document contains all information needed to generate valid plant object JSON files for the 10000 BC game data pipeline.

---

## Table of Contents

1. [Overview](#overview)
2. [Complete Plant Object Schema](#complete-plant-object-schema)
3. [Field-by-Field Reference](#field-by-field-reference)
4. [Controlled Vocabularies (Enums)](#controlled-vocabularies-enums)
5. [Numeric Constraints](#numeric-constraints)
6. [Validation Rules](#validation-rules)
7. [Complete Working Example](#complete-working-example)
8. [Functional Requirements](#functional-requirements)

---

## Overview

**Source Data:** Indiana Flora Wiki (botanical descriptions, images, habitat information)

**Your Task:** Generate complete plant JSON objects with all fields populated based on botanical reality and game balance.

**Key Principles:**
- Each plant defines its own parts and sub-stages (no fixed part list)
- Sub-stages represent seasonal changes within a single part (e.g., green pod → dry pod)
- Craft tags are assigned at sub-stage level, not part level
- Processing steps create distinct output items in the stockpile
- All pharmacological data lives in the `ingestion` object
- ALL plant parts should be defined--roots, stalks, shoots, leaves, flowers, buds, fruits, seeds, etc.
- Ticks: a tick can be thought of as about a minute of real time for the purposes of harvesting stuff. Enough time to pick a handful of berries or strip a few small plants of leaves.
- **CRITICAL: All day values use IN-GAME DAYS throughout this document** — 1 in-game day ≈ 8 real-world days, 40 in-game days per year. This applies to `min_age_days`, `viable_lifespan_days`, `decay_days`, `regrowth_days`, and all other day-based properties.
- **Calendar system:** The year runs from day 1 (start of spring) to day 40 (end of winter). Days 1-10 = spring, 11-20 = summer, 21-30 = fall, 31-40 = winter. When setting `seasonal_window` ranges, remember that day 1 is the first day of spring.
- **Decay values are adapted for gameplay:** Use minimum 2 in-game days for perishable foods (berries, meat, greens) so items don't decay the same day you collect them. The system operates on whole days, so values below 1 don't make sense.

---

## Complete Plant Object Schema

```json
{
  "id": "string",
  "name": "string",
  "plant_family": "string",
  "physical_description": "string",
  "game_description": "string",
  "age_of_maturity": 0,
  "scent": {
    "strength": 0.0,
    "primary_compound": "string"
  },
  "habitat": ["string"],
  "companion_plants": ["string"],
  "longevity": "string",
  "soil": {
    "ph_range": [0.0, 0.0],
    "drainage": "string",
    "shade_tolerance": "string"
  },
  "ph_effect_on_soil": 0.0,
  "seeding_window": {
    "start": "string",
    "end": "string"
  },
  "dispersal": {
    "method": "string",
    "base_radius_tiles": 0,
    "wind_radius_bonus": 0,
    "water_dispersed": false,
    "animal_dispersed": false,
    "seeds_per_mature_plant": [0, 0],
    "germination_rate": 0.0,
    "germination_season": "string",
    "requires_disturbance": false,
    "pioneer": false,
    "viable_lifespan_days": 0
  },
  "ingestion": null,
  "life_stages": [
    {
      "stage": "string",
      "min_age_days": 0,
      "seasonal_window": null,
      "size": 0,
      "field_description": "string"
    }
  ],
  "parts": [
    {
      "name": "string",
      "available_life_stages": ["string"],
      "sub_stages": [
        {
          "id": "string",
          "seasonal_window": {
            "start": "string",
            "end": "string"
          },
          "field_description": "string",
          "game_description": "string",
          "edibility_score": 0.0,
          "edibility_harshness": 0.0,
          "unit_weight_g": 0.0,
          "nutrition": {
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fat": 0
          },
          "processing_options": [
            {
              "id": "string",
              "ticks": 0,
              "location": "string",
              "outputs": []
            }
          ],
          "texture": "string",
          "taste_notes": ["string"],
          "scent_notes": ["string"],
          "average_fiber_length_cm": 0.0,
          "fiber_strength_modifier": 0.0,
          "fiberous": false,
          "craft_tags": [],
          "ingestion": null,
          "potency_multiplier": null,
          "harvest_base_ticks": 0,
          "harvest_tool_modifiers": {},
          "harvest_yield": {
            "units_per_action": [0, 0],
            "actions_until_depleted": [0, 0],
            "ground_action_fraction": 0.0
          },
          "reach_tier": "string",
          "harvest_damage": 0.0,
          "regrowth_days": null,
          "regrowth_max_harvests": null,
          "dig_ticks_to_discover": 0,
          "decay_days": 0.0,
          "can_dry": false,
          "stew_nutrition_factor": 0.0
        }
      ]
    }
  ]
}
```

---

## Field-by-Field Reference

### Top-Level Fields

**`id`** (string, required)
- Lowercase scientific name with underscores: `"gleditsia_triacanthos"`
- Must be unique across all plants

**`name`** (string, required)
- Common name: `"Honey Locust"`

**`plant_family`** (string, required)
- Botanical family name, lowercase: `"fabaceae"`, `"rosaceae"`, `"asteraceae"`, `"fungi"`
- Open-ended; use actual botanical classification
- Used for nausea similarity scoring

**`physical_description`** (string, required)
- Detailed visual description for sprite generation and player identification
- Include size, distinctive features, bark/stem characteristics
- Example: `"A large deciduous tree with 1-3 inch thorns on trunk and branches. Compound leaves with 15-30 small leaflets. Dark brown furrowed bark."`

**`game_description`** (string, required)
- Post-identification overview of the whole plant
- Describes which parts are useful, when they're available, any hazards, standout properties
- Displayed in inspect panel header once identified
- Life stages inherit and display this text
- **Do not make gameplay value judgments** — avoid terms like "reliable staple", "worthwhile", "good source", "excellent for winter"
- **Do state factual properties** — "high in protein", "stores well", "requires processing", "slow to extract", "thorns are hazardous"
- Example: `"Beans are high in protein and store well through winter, but extracting them in quantity is slow work by hand; a mortar and pestle makes it worthwhile. The thorns are a genuine hazard."`

**`age_of_maturity`** (int, required)
- Plant age in in-game days at which harvest yields reach 100% of specified values
- **MUST exactly match the `min_age_days` of the first mature/reproductive life stage** (e.g., "vegetative", "flowering", "mature", "first_year" for biennials)
- All `harvest_yield` values in the plant JSON represent **mature plant yields**
- Plants younger than this age have yields scaled proportionally: `scaling_factor = max(0.1, current_age / age_of_maturity)`
- Scaling applies to both `units_per_action` and `actions_until_depleted`
- Minimum scaling factor is 0.1 to ensure even very young plants produce something
- **How to determine the value:**
  1. Find the first life stage that is NOT "seedling" (typically "vegetative", "flowering", "mature", "first_year", etc.)
  2. Use that stage's `min_age_days` value as `age_of_maturity`
- **Examples:**
  - Annual with first mature stage at min_age_days: 4 → `age_of_maturity: 4`
  - Perennial with "vegetative" stage at min_age_days: 31 → `age_of_maturity: 31`
  - Tree with "sapling" stage at min_age_days: 240 → `age_of_maturity: 240`
  - Biennial with "first_year" stage at min_age_days: 3 → `age_of_maturity: 3`

**`scent`** (object, required)
- `strength` (float 0.0-1.0): How strongly the plant smells
  - 0.0 = no scent
  - 0.3 = mild scent
  - 0.7 = strong scent
  - 1.0 = overpowering scent
- `primary_compound` (string): Chemical compound name for scent particle icon generation
  - Examples: `"linalool"`, `"eugenol"`, `"limonene"`, `"indole"`
  - Open-ended; use actual chemical compounds

**`habitat`** (array of strings, required)
- **ENUM** - See [Habitat & Terrain Enums](#habitat--terrain-enums)
- List all terrain types where species naturally occurs
- Example: `["forest_edge", "floodplain"]`

**`companion_plants`** (array of strings, required)
- Plant IDs that commonly grow near this species
- Open-ended; based on ecological associations
- Can be empty array `[]` if no strong associations

**`longevity`** (string, required)
- **ENUM**: `"annual"` | `"biennial"` | `"perennial"`
- `annual` — completes lifecycle in one year, dies after seeding
- `biennial` — two-year lifecycle
- `perennial` — lives multiple years

**`soil`** (object, required)
- `ph_range` (array of 2 floats): Valid range [3.0, 9.0]
  - Example: `[6.0, 8.0]` for slightly acidic to slightly alkaline
- `drainage` (string, **ENUM**): `"poor"` | `"moderate"` | `"well"` | `"excellent"`
  - `poor` — waterlogged, anaerobic
  - `moderate` — typical forest floor
  - `well` — drains freely, no standing water
  - `excellent` — sandy or rocky, very fast drainage
- `shade_tolerance` (string, **ENUM**): `"none"` | `"low"` | `"moderate"` | `"high"` | `"full"`
  - `none` — requires full sun; dies in shade
  - `low` — prefers sun, tolerates light shade
  - `moderate` — grows in partial shade
  - `high` — thrives in shade, tolerates some sun
  - `full` — requires deep shade

**`ph_effect_on_soil`** (float, required)
- How this plant affects soil pH over time
- Typical range: -0.3 to +0.3
- Negative = acidifies soil, Positive = alkalizes soil
- Most plants: 0.0 (no effect)

**`seeding_window`** (object or null, required)
- When the plant reproduces and fires seed dispersal during the daily growth pass
- Separate from harvestable part sub-stages — the plant seeds biologically regardless of harvest
- `null` for runner-method species that spread vegetatively only (no seeds)
- For all other plants, object format:
  - `start` (string): Season when seeding begins (use same format as `germination_season`)
  - `end` (string): Season when seeding ends
- Valid season values: `"early_spring"`, `"mid_spring"`, `"late_spring"`, `"early_summer"`, `"mid_summer"`, `"late_summer"`, `"early_fall"`, `"mid_fall"`, `"late_fall"`, `"winter"`
- Only plants at `mature` life stage (or `second_year` for biennials) produce seeds
- Seed output scales with plant vitality (harvest damage reduces seed production)
- **Annuals:** Plant dies the day after `seeding_window.end` closes
- **Biennials:** Plant dies after `seeding_window.end` closes in year 2; no seeding in year 1
- **Perennials:** Seeding window recurs annually once plant reaches maturity
- Example: `{"start": "mid_fall", "end": "late_fall"}`

**`dispersal`** (object, required)
- `method` (string, **ENUM**): See [Dispersal Enums](#dispersal-enums)
- `base_radius_tiles` (int): Typical range 1-30 tiles
  - For `runner` method, this is tiles-per-epoch of vegetative expansion
- `wind_radius_bonus` (int): Additional tiles added in high wind (0-10)
- `water_dispersed` (bool): Seeds can travel downstream if near water
- `animal_dispersed` (bool): Animals contribute to passive spread
- `seeds_per_mature_plant` (array of 2 ints): [min, max] seeds produced
  - Use `[0, 0]` for `runner` method plants (no seeds)
- `germination_rate` (float 0.0-1.0): Fraction of seeds that germinate
- `germination_season` (string, **ENUM**): `"spring"` | `"early_summer"` | `"late_summer"`
  - Controls when dormant seeds of this species wake and attempt germination
- `requires_disturbance` (bool): Only germinates on disturbed tiles
- `pioneer` (bool): Gets 2× germination bonus on disturbed tiles
- `viable_lifespan_days` (int): In-game days a dormant seed survives in the tile pool before being discarded if it has not germinated
  - Short-lived annuals: 8-15 in-game days
  - Typical species: 23-46 in-game days
  - Long-lived hard-coated seeds (honey locust, black locust): 225+ in-game days

**`ingestion`** (object or null, required)
- `null` if plant has no pharmacological effects
- See [Pharmacological System](#pharmacological-system) for full schema
- Contains `preparation`, `pharmacokinetics`, and `dose_response` objects

**`life_stages`** (array of objects, required)
- Defines growth progression through visually distinct phases
- Life stage is determined by combination of plant age (in-game days since germination) and current in-game day of year (1-40)
- **Note:** `"seed"` is NOT a life stage - seeds are modeled in the dormant seed pool system
- **IMPORTANT:** Stages must be ordered by `min_age_days` (ascending). No two stages can have the same `min_age_days` value.
- **Death mechanism:** Plants die when no valid life stage exists for the current day. Annuals and biennials must leave a gap (typically days 39-40) with no valid stage to trigger death. Perennials must cover all 40 days.
- **CRITICAL - Tree Growth Timelines:** Trees (woody perennials) should have realistic multi-year growth periods. Use these guidelines:
  - **Fast-growing trees** (willow, cottonwood, honey locust): Seedling stage 200 days (5 years), reach size 4 by 280-320 days (7-8 years)
  - **Medium-growth trees** (oak, maple, ash): Seedling stage 240 days (6 years), reach size 4 by 320-360 days (8-9 years)
  - **Slow-growing trees** (hickory, walnut): Seedling stage 280 days (7 years), reach size 4 by 360-400 days (9-10 years)
  - **MAXIMUM**: No tree should require more than 400 in-game days (10 years) to reach full mature size (size 4)
  - Trees should have intermediate stages (sapling at size 2-3) between seedling and mature
  - **Do NOT use min_age_days values like 24 or 46 for trees** - these represent less than 2 years and are only appropriate for herbaceous annuals/perennials
- Each stage has:
  - `stage` (string): Stage name (see valid stage names below)
  - `min_age_days` (int, required): Minimum plant age in in-game days to enter this stage
  - `seasonal_window` (object or null, required): When this stage is active during the year
    - `null` = always active when age requirement is met (used for age-gated stages like seedling)
    - `{"start_day": 1, "end_day": 20}` = active only during these in-game days of year (1-40)
    - **CRITICAL:** `start_day` and `end_day` use in-game days (1-40)
  - `size` (int 0-4): Visual size category representing the plant's physical footprint on the tile
    - **For perennial trees:** Once the tree reaches mature size (typically size 4), it should remain that size in all subsequent seasonal stages. Trees don't shrink when they lose leaves in fall/winter - they're still large trees.
    - **For annuals/herbaceous plants:** Size can vary more dramatically through the lifecycle
  - `field_description` (string, required): Visual description of plant at this growth stage; always visible regardless of identification status; should not mention parts not yet present. Should be descriptive of the distinguishing features of the plant even if this repeats text from other life stages.

#### Life Stage Granularity and Sprite Pipeline

Each life stage maps directly to a distinct sprite in the sprite generation pipeline — one sprite per stage, per plant. Stages should therefore be defined wherever the plant looks meaningfully different at a glance, not just where its botanical lifecycle technically changes.

**Primary driver is forager utility:** A player scanning the map should be able to tell at a glance whether a plant is likely to have flowers, fruit, ripe seed pods, or bare stems. 

**Design philosophy:** When in doubt, err toward more stages — a missed visual distinction is a missed forager cue. Stages with identical visual representations should be merged into one stage rather than duplicated.

#### Valid Life Stage Names

Typical stage splits to consider (not all apply to every plant):

- **`seedling`** — young plant before it reaches harvestable size or reproductive maturity; visually small and leaf-only. Don't forget to include this stage in leaf valid stages array, otherwise this stage will have no above-ground parts and can't be rendered.
- **`vegetative`** — full-sized but not yet flowering; leaves and stem structure dominant (use instead of `mature` when a distinct flowering stage follows)
- **`flowering`** — visible flowers present; signals the plant is in bloom and flower parts are available; visually distinct from vegetative state
- **`fruiting`** — flowers have dropped and fruit or berries are forming or ripe; plant silhouette changes with visible fruit clusters
- **`seed_set`** — fruit has matured into dry seed pods, cones, or similar; distinct color/texture shift from `fruiting`; seeds or pods are harvestable
- **`senescent`** — post-seed, dying back; bare or browning stems; signals the plant is done for the season but may still have harvestable roots or bark
- **`dormant`** — above-ground parts gone; only underground parts remain harvestable; no sprite shown on tile (rendering layer suppresses sprite when all active parts are below-ground)
- **`mature`** — use only when a plant does not go through visually distinct phases (e.g. an evergreen tree that looks the same year-round); do not use `mature` as a catch-all when finer stages apply

**For biennials:** `first_year` and `second_year` replace `mature` and may themselves be split further. For example, a biennial that is vegetative in year 1 and flowering → fruiting in year 2 should have `first_year`, `second_year_flowering`, `second_year_fruiting`.

**Biennial-specific stages:**
- **`first_year`** — vegetative stage(s) in year 1; `min_age_days` typically 3-4; can be single stage with `seasonal_window: null` (always active) or split into seasonal stages (e.g., `first_year_vegetative`, `first_year_dormant` for plants like burdock that die back in winter); parts available are vegetative (tap root, rosette leaves); no seeding_window fires
- **`second_year`** — reproductive stage(s) in year 2; `min_age_days` typically 46+; can be single stage with `seasonal_window: null` or split into seasonal stages; flowering and seed parts become available; seeding_window fires normally
- **Critical:** If using seasonal stages in year 1, they must cover all 40 days to prevent premature death. Year 2 stages must leave a gap (days 36-40) to trigger death.
- Can be split: Year 1 with `first_year_vegetative` (days 1-35), `first_year_dormant` (days 36-40); Year 2 with `second_year_vegetative` (days 1-10), `second_year_flowering` (days 11-25), `second_year_seed_set` (days 26-35)
- Each stage must have unique `min_age_days` to enforce sequential progression

#### Life Stage Examples by Plant Type

**Annual (spring ephemeral):**
```json
"life_stages": [
  {"stage": "seedling", "min_age_days": 0, "seasonal_window": null, "size": 1, "field_description": "..."},
  {"stage": "vegetative", "min_age_days": 2, "seasonal_window": {"start_day": 1, "end_day": 10}, "size": 2, "field_description": "..."},
  {"stage": "flowering", "min_age_days": 3, "seasonal_window": {"start_day": 11, "end_day": 20}, "size": 2, "field_description": "..."},
  {"stage": "seed_set", "min_age_days": 4, "seasonal_window": {"start_day": 21, "end_day": 30}, "size": 2, "field_description": "..."},
  {"stage": "senescent", "min_age_days": 5, "seasonal_window": {"start_day": 31, "end_day": 38}, "size": 1, "field_description": "..."}
]
```
Note: Dies on day 39 when no valid life stage exists (gap at days 39-40). The senescent stage allows the plant to persist as a brown stalk after seeding completes.

**Perennial herbaceous plant (seasonal cycling):**
```json
"life_stages": [
  {"stage": "seedling", "min_age_days": 0, "seasonal_window": null, "size": 1, "field_description": "..."},
  {"stage": "vegetative", "min_age_days": 4, "seasonal_window": {"start_day": 1, "end_day": 15}, "size": 3, "field_description": "..."},
  {"stage": "flowering", "min_age_days": 5, "seasonal_window": {"start_day": 16, "end_day": 25}, "size": 3, "field_description": "..."},
  {"stage": "fruiting", "min_age_days": 6, "seasonal_window": {"start_day": 26, "end_day": 35}, "size": 3, "field_description": "..."},
  {"stage": "dormant", "min_age_days": 7, "seasonal_window": {"start_day": 36, "end_day": 40}, "size": 0, "field_description": "..."}
]
```
Note: Cycles through vegetative → flowering → fruiting → dormant annually once age thresholds are reached. This example is for herbaceous perennials (wildflowers, forbs), NOT trees. Trees need much longer min_age_days values.

**Biennial (two-year lifecycle, simple - no seasonal variation in year 1):**
```json
"life_stages": [
  {"stage": "seedling", "min_age_days": 0, "seasonal_window": null, "size": 1, "field_description": "..."},
  {"stage": "first_year", "min_age_days": 3, "seasonal_window": null, "size": 2, "field_description": "..."},
  {"stage": "second_year_vegetative", "min_age_days": 46, "seasonal_window": {"start_day": 1, "end_day": 10}, "size": 3, "field_description": "..."},
  {"stage": "second_year_flowering", "min_age_days": 47, "seasonal_window": {"start_day": 11, "end_day": 25}, "size": 3, "field_description": "..."},
  {"stage": "second_year_seed_set", "min_age_days": 48, "seasonal_window": {"start_day": 26, "end_day": 35}, "size": 3, "field_description": "..."}
]
```
Note: Dies on day 36 of year 2 when no valid life stage exists (gap at days 36-40). The `first_year` stage with `seasonal_window: null` covers all days in year 1, allowing the plant to survive winter. In year 2, the plant is old enough for second_year stages, which only cover days 1-35.

**Biennial (with seasonal stages in year 1 - e.g., burdock with winter die-back):**
```json
"life_stages": [
  {"stage": "seedling", "min_age_days": 0, "seasonal_window": null, "size": 1, "field_description": "..."},
  {"stage": "first_year_vegetative", "min_age_days": 3, "seasonal_window": {"start_day": 1, "end_day": 35}, "size": 2, "field_description": "Large rosette of leaves, green and growing."},
  {"stage": "first_year_dormant", "min_age_days": 4, "seasonal_window": {"start_day": 36, "end_day": 40}, "size": 0, "field_description": "Leaves have died back; only taproot remains underground."},
  {"stage": "second_year_vegetative", "min_age_days": 46, "seasonal_window": {"start_day": 1, "end_day": 10}, "size": 3, "field_description": "..."},
  {"stage": "second_year_flowering", "min_age_days": 47, "seasonal_window": {"start_day": 11, "end_day": 25}, "size": 3, "field_description": "..."},
  {"stage": "second_year_seed_set", "min_age_days": 48, "seasonal_window": {"start_day": 26, "end_day": 35}, "size": 3, "field_description": "..."}
]
```
Note: Year 1 stages cover all 40 days (vegetative days 1-35, dormant days 36-40), preventing premature death. Year 2 stages leave gap at days 36-40, triggering death after seeding.

**Evergreen tree (no seasonal variation):**
```json
"life_stages": [
  {"stage": "seedling", "min_age_days": 0, "seasonal_window": null, "size": 1, "field_description": "..."},
  {"stage": "sapling", "min_age_days": 240, "seasonal_window": null, "size": 2, "field_description": "..."},
  {"stage": "mature", "min_age_days": 360, "seasonal_window": null, "size": 4, "field_description": "..."}
]
```
Note: Single sprite year-round once mature. This example shows a medium-growth tree taking 6 years to reach sapling stage and 9 years to reach full maturity (size 4).

**`parts`** (array of objects, required)
- See [Part Object Structure](#part-object-structure)

---

### Part Object Structure

Each part represents a harvestable component (leaf, root, fruit, bark, etc.)

**`name`** (string, required)
- Part type: `"leaf"`, `"root"`, `"berry"`, `"pod"`, `"bark"`, `"flower"`, `"branch"`, `"stalk"`, `"seed"`, etc.
- Open-ended; define whatever parts the plant has
- **For trees:** Use `"branch"` for woody material, NOT `"twig"` — twigs are too small to be useful in-game
- **For shrubs/bushes:** Use `"stem"` or `"shoot"` depending on age and flexibility

**`available_life_stages`** (array of strings, required)
- Which life stages this part can be harvested from
- Example: `["mature"]` or `["flowering", "fruiting"]`
- **CRITICAL:** Only use stage names that are actually defined in the plant's `life_stages` array. Do NOT invent stage names that don't exist

**`sub_stages`** (array of objects, required)
- Seasonal variations of this part
- **INHERITANCE RULE:** The second and subsequent sub-stages in the array automatically inherit ALL properties from the first sub-stage, except for fields you explicitly override. You only need to specify the fields that change (typically `id`, `seasonal_window`, `field_description`, `game_description`, and the properties that actually differ like `edibility_score`, `texture`, `harvest_yield`, etc.). All other fields are copied from the first sub-stage.
- **IMPORTANT:** If a part's description mentions seasonal changes in properties ("becomes tough later in season", "turns bitter after flowering", "hardens in fall"), you MUST create separate sub-stages to represent those changes. Especially if one sub-stage has edibility and another doesn't, you need multiple sub-stages. With inheritance, this is easy - just add a second sub-stage with only the changed fields.
- See [Sub-Stage Object Structure](#sub-stage-object-structure)

---

### Sub-Stage Object Structure

Each sub-stage represents a seasonal state of a part (green → ripe → dry, etc.) Include these if a plant part has a substantial change in edibility or nutritional value throughout its lifecycle. (for example, old brown milkweed pods are inedible even though the green pods are good.)

**CRITICAL INHERITANCE BEHAVIOR:** When defining multiple sub-stages for a part, the **first sub-stage must be fully specified** with all required fields. **Subsequent sub-stages automatically inherit all properties from the first sub-stage** and only need to specify:
1. Fields that are always required on every sub-stage: `id`, `seasonal_window`, `field_description`, `game_description`
2. Fields that actually change from the first sub-stage (e.g., `edibility_score`, `texture`, `nutrition`, `harvest_yield`, `craft_tags`, etc.)

All other fields are automatically copied from the first sub-stage. This makes it trivial to create seasonal variations - for example, a "tough" leaf sub-stage only needs to override `edibility_score`, `texture`, and descriptions while inheriting everything else from the "young" sub-stage.

**`id`** (string, required)
- Sub-stage identifier: `"green"`, `"ripe"`, `"dry"`, `"young"`, `"mature"`, `"tough"`, `"tender"`, etc.
- Choose descriptive IDs that reflect the actual state of the part
- **If your `game_description` mentions that a part changes properties seasonally, create multiple sub-stages with different IDs to model those changes**

**`seasonal_window`** (object, required)
- `start` (string): Season when this sub-stage begins
- `end` (string): Season when this sub-stage ends
- Valid values: `"early_spring"`, `"mid_spring"`, `"late_spring"`, `"early_summer"`, `"mid_summer"`, `"late_summer"`, `"early_fall"`, `"mid_fall"`, `"late_fall"`, `"winter"`
- Note: For output-only parts (those with `available_life_stages: []`), omit this field

**`field_description`** (string, required)
- Sensory and visual prose describing this sub-stage as observed in the field
- Always visible on inspect and inventory tooltips regardless of identification status
- Focus on observable characteristics: color, size, firmness, appearance, scent when crushed
- Example: `"A flat green pod, soft and slightly glossy, hanging in clusters. Smells faintly grassy when crushed."`

**`game_description`** (string, required)
- Practical game information synthesized from this sub-stage's actual data
- Post-identification only; shown in inspect panel and inventory tooltip
- Covers edibility, processing requirements, storage characteristics, hazards
- AI pipeline should generate this from the sub-stage's stats rather than inventing independently
- **State facts, not value judgments** — describe properties ("high in protein", "decays in 3 days", "requires cooking"), not usefulness ("excellent food", "reliable source", "worthwhile")
- Example: `"Tender and edible raw or cooked. Mild and sweet. No processing needed; can be eaten directly or added to stew."`

**`edibility_score`** (float 0.0-1.0, required)
- How edible this is raw in the field. Also, the maximum portion of a stew that can be this ingredient before nausea prevents adding any more.
- ≥0.85 = field-edible (player will eat raw)
- <0.85 = needs cooking or processing

**`edibility_harshness`** (float 0.0-1.0, required)
- How much this contributes to nausea accumulation
- 0.0 = very mild, 1.0 = extremely harsh

**`unit_weight_g`** (float, required on ALL sub-stages)
- Gram weight of one discrete unit of this sub-stage
- Required even on output-only parts (those with `available_life_stages: []`)
- Set to a natural per-item weight for countable things: a pod, a berry, a bean
- Set to `1.0` for bulk materials where weight and quantity are the same: loose leaves, ground flour
- Must match `output_unit_weight_g` on any output entry within `processing_options` that references this part
- Examples: `25.0` for a green pod, `1.4` for an extracted bean, `1.0` for acorn flour

**`nutrition`** (object, required)
- **Calculate based on `unit_weight_g` and realistic per-100g nutritional data**
- For a 25g green pod: if the plant has ~320 cal/100g, then `calories: 80` (25g × 3.2)
- For a 1.4g bean: if it has ~360 cal/100g, then `calories: 5.0` (1.4g × 3.6) - **use floats for small values**
- **For container parts** (parts that produce other parts via processing): nutrition should be the **combined total** of all sub-parts
  - Example: Honey locust dry pod produces beans (120 cal) + husk (0 cal) → pod nutrition = 120 cal total
  - This represents the actual nutritional content present in the item
  - `stew_nutrition_factor` separately determines what's extractable and any calorie gain from cooking
- `calories` (float): Caloric value per unit
- `protein` (float): Grams of protein per unit
- `carbs` (float): Grams of carbohydrates per unit
- `fat` (float): Grams of fat per unit
- **All values can be small floats** - a 1g item with 3 cal/100g should have `calories: 0.03`, not rounded to 0

**`processing_options`** (array of objects, optional)
- Array of processing methods available for this sub-stage
- **Omit this field entirely** if the sub-stage cannot be processed (no null values needed)
- Most sub-stages will have 0-1 processing options; some may have multiple (e.g., acorns can be cracked OR ground)
- Each processing option object contains:
  - **`id`** (string, required): Action label like `"extract_beans"`, `"crack_shell"`, `"grind"`, `"leach_tannins"`, `"boil_leach"`
  - **`ticks`** (int, required): Time cost, typical range 5-60
  - **`location`** (string, required): Where processing can be done
    - `"hand"` = player or partner, anywhere (immediate for player, queued for partner)
    - `"camp"` = must be done at camp, no special station
    - `"hide_frame"` = requires Hide Frame station
    - `"thread_spinner"` = requires Thread Spinner station
    - `"mortar_pestle"` = requires Mortar & Pestle station (grinding seeds, nuts, dried material)
    - `"leaching_basket"` = requires Leaching Basket tool (placed on water tile, retrieved later)
  - **`outputs`** (array, required): Output parts produced (see below)

**`raw_extraction_efficiency`** (float 0.0-1.0, optional)
- Fraction of nutrition extractable when eating raw in the field
- Defaults to `1.0` if omitted (full nutrition available when eaten raw)
- Set to `0.0` for items that have calories but cannot be digested raw (whole dry beans like honey locust, unshelled nuts, hard seeds)
- Set to `0.1-0.3` for items that are technically chewable but yield almost nothing raw (tough roots, hard pods)
- Applied when player uses "Eat (field)" action on this item
- Example: Honey locust beans have calories in their nutrition data but `raw_extraction_efficiency: 0.0` because they're indigestible raw

**`stew_nutrition_factor`** (float, optional)
- Combined factor representing both extraction efficiency and calorie gain from cooking in stew
- Defaults to `1.0` if omitted (full extraction, no cooking benefit)
- Typical range: 0.0-1.4 (can go higher if needed)
- **Values <1.0**: Incomplete extraction dominates (whole pods, unshelled nuts, roots requiring grinding)
  - `0.0` = cannot be eaten by boiling alone (whole dry honey locust pods with beans inside, fiberous stems)
  - `0.05-0.3` = technically edible but yields almost nothing (cracked acorns still needing leaching)
- **Value =1.0**: Neutral (full extraction, no cooking benefit) - berries, fruit, already-digestible items
- **Values >1.0**: Cooking benefit dominates (cooking unlocks additional calories)
  - `1.05` = slight benefit (leaves, greens)
  - `1.3` = significant benefit (legumes, hard seeds)
  - `1.4` = major benefit (starchy roots, tubers)
- **Edge cases**: When both extraction loss AND cooking benefit apply (e.g., whole legume pod), weigh both factors - the extraction loss typically dominates, resulting in a low value
- Applied to ALL parts added to stew
- Player can add anything to stew; this helps filter out items that have calories but need processing, while also representing calorie gains from cooking

**`cooking_detoxifies`** (bool, optional)
- Whether cooking in stew deactivates or weakens the plant's `ingestion` effects (pharmacology)
- Defaults to `false` if omitted
- When `true`, cooking in stew reduces or eliminates toxic/medicinal effects from the plant-level `ingestion` object
- Implementation can reduce `potency_multiplier` to near-zero or skip ingestion effects entirely when this part is cooked
- Separate from edibility - this affects pharmacological effects, not palatability

**`cooked_edibility_score`** (float or null, optional)
- Edibility score when cooked in stew (0.0-1.0)
- If present, stew system uses this instead of raw `edibility_score`
- If `null` or omitted, stew uses raw `edibility_score`
- Typically set on items that become more palatable when cooked (toxic greens, bitter roots, etc.)
- **CRITICAL USE CASE**: For items that are inedible or toxic raw but become good food when cooked (e.g., honey locust beans, certain legumes), you MUST set both `cooked_edibility_score` and `cooked_harshness` to reflect the cooked state
  - Example: Raw honey locust beans might have `edibility_score: 0.1` (inedible raw) but `cooked_edibility_score: 0.7` (good cooked)
  - This is the ONLY way to represent foods that transform from inedible to edible through cooking
  - Without these fields, the stew system will use the raw values and the food will remain inedible even when cooked

**`cooked_harshness`** (float or null, optional)
- Harshness when cooked in stew (0.0-1.0)
- If present, stew system uses this instead of raw `edibility_harshness`
- If `null` or omitted, stew uses raw `edibility_harshness`
- Typically lower than raw harshness for items that become milder when cooked
- **CRITICAL**: Must be set alongside `cooked_edibility_score` for items that are inedible raw but good cooked
  - Example: Raw honey locust beans might have `edibility_harshness: 0.9` (harsh/toxic raw) but `cooked_harshness: 0.3` (mild cooked)

**Processing outputs format** (within each `processing_options` entry):
- The `outputs` array contains the parts produced by this processing method
- Empty array `[]` if processing produces no distinct output items or if craft tags handle the outputs (e.g., `cordage_fiber` and `inner_bark_cloth` tags generate cordage/cloth directly)
- All listed parts are added to stockpile when processing completes
- Output parts must have `available_life_stages: []` and no `seasonal_window`
- **Do NOT create output parts for cordage or bark cloth** — the game generates these automatically from parts tagged with `cordage_fiber` or `inner_bark_cloth`
- Each entry has one of two yield formats:
  - **Fraction-based**: `{"part": "beans", "yield_fraction": 0.35, "output_unit_weight_g": 1.4}`
    - Output quantity is a fraction of input's total weight
    - System computes: `floor((input_weight_g × yield_fraction) / output_unit_weight_g)`
  - **Fixed-yield**: `{"part": "acorn_flour", "yield_grams": 400, "output_unit_weight_g": 1.0}`
    - Output quantity is fixed regardless of input mass
    - Used when processing adds water or produces quantity not derived from input weight
- `output_unit_weight_g` must match the `unit_weight_g` on the referenced output part's sub-stage
- Fractions across all outputs do not need to sum to 1.0; remainder is implicit waste

**`texture`** (string, required)
- Open-ended sensory description
- Examples: `"tender"`, `"crisp"`, `"fibrous"`, `"hard"`, `"soft"`, `"woody"`, `"juicy"`, `"dry"`, `"mealy"`

**`taste_notes`** (array of strings, required)
- Open-ended flavor descriptors
- Examples: `["sweet", "mild"]`, `["bitter", "astringent"]`, `["starchy", "nutty"]`

**`scent_notes`** (array of strings, required)
- Open-ended aroma descriptors
- Examples: `["fresh", "grassy"]`, `["dry", "nutty"]`, `["pungent", "earthy"]`

**`average_fiber_length_cm`** (float, required)
- Fiber length in centimeters
- Typical range: 1.0-30.0
- Affects cordage quality

**`fiber_strength_modifier`** (float, required)
- Fiber strength multiplier
- Typical range: 0.1-2.0
- >1.0 = high quality cordage material
- <1.0 = weak fiber

**`fiberous`** (bool, required)
- `true` if this sub-stage has usable fiber content
- `false` for most food parts

**`craft_tags`** (array of strings, required)
- **ENUM** - See [Craft Tags](#craft-tags)
- Empty array `[]` if no craft utility
- Can contain multiple tags

**`ingestion`** (object or null, required)
- Sub-stage-specific pharmacology override
- `null` to inherit from top-level plant `ingestion`
- See [Pharmacological System](#pharmacological-system)

**`potency_multiplier`** (float or null, required)
- Concentration multiplier for inherited `ingestion` profile. Remember to set this to 0 if this is obviously edible (like cherries or berries).
- `null` = inherit unchanged (1.0)
- 3.0 = 3× more potent (divide dose thresholds by 3)
- 0.1 = nearly inert
- 0 = use this for obviously edible parts of the plant that don't inherit any medicinal properties

**`harvest_base_ticks`** (int, required)
- Base time to harvest this sub-stage. Usually 1 unless it's more difficult than picking some berries or cutting a stalk
- **For most roots/tubers/bulbs:** Set to `1` — the digging tool modifiers are applied automatically when `dig_ticks_to_discover` is present
- **For tree roots or extremely tough underground parts:** Set to `10-20` to represent the difficulty of extraction
- **For above-ground parts:** Typical range 3-15 ticks depending on difficulty

**`harvest_tool_modifiers`** (object, required)
- Tool speed multipliers for harvest action
- Format: `{"knife": 1.4, "blickey": 1.2}`
- **Do NOT include digging tools** (`"digging_stick"` or `"shovel"`) for underground parts — these are applied automatically when `dig_ticks_to_discover` is present
- Empty object `{}` if no tool bonuses (common for underground parts that rely on automatic digging tool modifiers)
- Valid tool names: `"knife"`, `"blickey"`, `"axe"` (do not use `"shovel"` or `"digging_stick"` here)

**`harvest_yield`** (object or null, required)
- **IMPORTANT: All yield values represent MATURE PLANT yields.** The actual yields for immature plants are automatically scaled based on the plant's age relative to `age_of_maturity`. When setting these values, think about what a fully mature specimen produces.
- Defines how much is harvested per action and how many actions before depletion
- Required on all directly-harvested sub-stages (those with non-empty `available_life_stages`)
- Set to `null` on output-only parts (those with `available_life_stages: []`)
- Object format:
  - `units_per_action` (array of 2 ints `[min, max]`): How many inventory units one harvest action yields
  - `actions_until_depleted` (array of 2 ints `[min, max]`): Rolled once on first harvest; sets cap on total harvest actions before sub-stage is exhausted for the season
- **Realistic yield guidance** (based on actual plant productivity):
  - **Berry bushes** (blackberry, raspberry, elderberry, blueberry): Mature bushes produce 10-20 lbs (900-4,500 berries). Use `units_per_action: [20, 50]`, `actions_until_depleted: [20, 40]` for total yields of 400-2,000 berries per bush
  - **Small berry bushes** (strawberry, low-growing): Much lower yields (~1 lb = 90-225 berries). Use `units_per_action: [5, 15]`, `actions_until_depleted: [6, 12]`
  - **Fruit trees** (cherry, plum, crabapple): Trees are very productive. Use `units_per_action: [30, 80]`, `actions_until_depleted: [15, 30]` for hundreds to thousands of fruits
  - **Large tree fruits** (pawpaw, persimmon): Fewer but larger fruits. Use `units_per_action: [8, 20]`, `actions_until_depleted: [10, 25]`
  - **Nuts** (acorns, hickory): Trees produce heavily. Use `units_per_action: [15, 40]`, `actions_until_depleted: [20, 50]`
  - **Pods** (honey locust, redbud): Use `units_per_action: [3, 8]`, `actions_until_depleted: [4, 10]`
  - **Leaves/greens (herbaceous plants)**: Use `units_per_action: [10, 25]`, `actions_until_depleted: [3, 8]` with regrowth
  - **Tree leaves**: Trees have MUCH more foliage than small plants. Use `units_per_action: [40, 100]`, `actions_until_depleted: [15, 30]` for mature trees. A single mature tree can yield thousands of leaves.
- Example: `{"units_per_action": [20, 50], "actions_until_depleted": [20, 40]}`
- **For tree species only:** Add `ground_action_fraction` to the `harvest_yield` object when `reach_tier` is `"elevated"` or `"canopy"`
  - `ground_action_fraction` (float 0.0-1.0): Fraction of total harvest actions accessible without tools (fallen material, drooping branches, low-hanging fruit)
  - Example: `{"units_per_action": [3, 8], "actions_until_depleted": [4, 10], "ground_action_fraction": 0.15}`
  - See `reach_tier` field below for when this is required

**`reach_tier`** (string enum, conditionally required)
- **Required on all directly-harvested sub-stages of tree species** (any species whose mature life stage has `tile_share: 1.0`)
- **Must be omitted** on all non-tree, underground, and output-only parts
- Values:
  - `"ground"` — accessible without any tool (ground-level parts, fallen material)
  - `"elevated"` — requires stool for full access (small understory trees, shrubs at face height)
  - `"canopy"` — requires ladder for full access (tall canopy trees)
- When `reach_tier` is `"elevated"` or `"canopy"`, you must also add `ground_action_fraction` to the `harvest_yield` object
- When `reach_tier` is `"ground"`, do NOT include `ground_action_fraction` (validation error)
- **Guidance for tree species:**
  - **Pawpaw** (ripe fruit): `"elevated"`, `ground_action_fraction: 0.7-0.8` — small understory tree; fruit hangs at face height
  - **Black walnut** (ripe nut): `"canopy"`, `ground_action_fraction: 0.4-0.5` — tall canopy tree but heavy dropper in fall
  - **Shagbark hickory** (ripe nut): `"canopy"`, `ground_action_fraction: 0.2-0.3` — tall; drops less prolifically than walnut
  - **Honey locust** (green pod): `"elevated"`, `ground_action_fraction: 0.1-0.2` — green pods cling to branches, rarely drop
  - **Honey locust** (dry pod): `"elevated"`, `ground_action_fraction: 0.35-0.45` — dry pods detach more readily; some ground accumulation
  - **Black cherry** (ripe fruit): `"canopy"`, `ground_action_fraction: 0.1-0.2` — fruit clustered near branch tips high up; minimal drop

**`harvest_damage`** (float 0.0-1.0 or null, required)
- How much vitality the plant instance loses when this sub-stage is fully depleted by harvest
- Required on all directly-harvested sub-stages; set to `null` on output-only parts
- 0.0 = no harm (pods, nuts, fruit — removing them doesn't stress the plant)
- 0.3-0.5 = moderate stress (bark stripping, heavy leaf harvest)
- 1.0 = lethal if fully depleted (entire root system, complete defoliation of delicate annual)

**`regrowth_days`** (int or null, required)
- In-game days required for this sub-stage to regrow after depletion
- Set to non-null only for vegetative parts that realistically regrow: leaves, young shoots
- Set to `null` for parts that don't regrow: pods, fruit, bark, roots
- After depletion, plant waits this many days then restores harvest actions

**`regrowth_max_harvests`** (int or null, required)
- How many times this sub-stage can regrow within its seasonal window
- Set to non-null only when `regrowth_days` is also non-null
- Set to `null` for non-regrowing parts
- When this cap is reached, next depletion is final and `harvest_damage` is applied

**`dig_ticks_to_discover`** (int, optional)
- Baseline ticks of digging required to discover this part before harvest action becomes available
- **Present ONLY on underground parts** (roots, tubers, bulbs)
- **Must be omitted on all above-ground parts**
- Scaled by tool and temperature modifiers at runtime during discovery phase
- **Automatically applies digging tool modifiers to harvest tick cost** — do not add `"digging_stick"` or `"shovel"` to `harvest_tool_modifiers`
- **Typical values:**
  - Shallow roots (wild onion, garlic): `15-20`
  - Medium roots (most herbaceous plants): `25-30`
  - Deep roots (tap roots, tubers): `35-40`
  - Tree roots: `40+`
- **Set `harvest_base_ticks` to `1` for most roots** — only use higher values (10-20) for tree roots or extremely tough extractions
- Underground parts are invisible until discovered via dig action

**`decay_days`** (float, required on food sub-stages)
- In-game days to full spoilage at Mild (1.0×) temperature baseline
- Required on all food sub-stages including output-only parts
- **Omitted on non-food parts** (craft materials with no calories)
- **IMPORTANT:** Values are adapted for gameplay fun - minimum 2 in-game days for perishables so items don't decay the same day you collect them
- Realistic values to target:
  - Fresh berries: 2-3 in-game days
  - Fresh meat/fish: 2-3 in-game days
  - Fresh greens/shoots: 2-3 in-game days
  - Cooked stew leftovers: 2 in-game days
  - Dried meat: 8-11 in-game days
  - Dried berries: 5-8 in-game days
  - Acorn flour: 23 in-game days
  - Dry pods: 46+ in-game days
  - Extracted beans: 91+ in-game days

**`can_dry`** (bool, required)
- `true` if this can be preserved by drying
- `false` if drying doesn't work
- Drying significantly extends shelf life (see decay system)
- **IMPORTANT:** The drying system does NOT create separate item objects (e.g., "dried berries" as a distinct part)
  - Drying is a preservation state applied to the existing item, not a processing step that produces new outputs
  - Do NOT add "dried [part]" entries to `processing_outputs` for berries, fruits, or other parts
  - The `can_dry: true` flag is sufficient - the game handles drying automatically without creating new items

**Note:** Calorie gain from cooking and extraction efficiency are now handled by `stew_nutrition_factor` (see above). This single field represents both incomplete extraction (values <1.0) and cooking benefits (values >1.0).

---

## Controlled Vocabularies (Enums)

### Habitat & Terrain Enums

**`habitat`** (plants only) — array of terrain types:
- `"forest"` — mature closed-canopy woodland
- `"forest_edge"` — transition zone; highest biodiversity
- `"meadow"` — open grassland
- `"floodplain"` — low-lying area, periodic flooding, rich soil
- `"wetland"` — saturated soil, standing water seasonally
- `"bog"` — acidic wetland with poor drainage
- `"scrubland"` — shrubby vegetation, dry conditions
- `"riparian"` — streamside or riverbank
- `"upland_ridge"` — dry elevated terrain
- `"disturbed_ground"` — recently cleared or heavily impacted areas

### Dispersal Enums

**`dispersal.method`** — primary seed dispersal mechanism:
- `"gravity"` — seeds drop near parent
- `"wind"` — light seeds carried by air
- `"water"` — seeds float downstream
- `"animal_cached"` — squirrels/jays bury seeds (clustered distribution)
- `"animal_eaten"` — gut-passed, random scatter
- `"explosive"` — plant forcibly ejects seeds
- `"runner"` — vegetative spread via rhizomes/stolons, not seeds

**`dispersal.germination_season`** — when dormant seeds wake:
- `"spring"` — stratification-requiring species
- `"early_summer"` — warm-soil germinators
- `"late_summer"` — fall-seeding species

### Craft Tags

**`craft_tags`** — canonical vocabulary (assign at sub-stage level):
- `"flexible_shoot"` — **Only for naturally pliable woody stems** suitable for weaving/basketry
  - **Use when:** The plant is a shrub or vine with thin, flexible young stems (willows, dogwoods, honeysuckle, grape vine)
  - **Do NOT use for:** Tree stems/branches (even young ones), herbaceous stems, or any plant that doesn't have traditional basketry flexibility
  - Examples: willow green shoot, young dogwood stem, honeysuckle vine, grape vine
- `"weaving_material"` — flat pliable leaf/stem for woven structures
  - Examples: cattail leaf, bulrush stem, sedge blade
- `"bark_sheet"` — flat harvested bark for structure, waterproofing
  - Examples: birch outer bark sheet, tulip poplar bark
- `"cordage_fiber"` — fibrous plant material suitable for twisting into cordage — inner bark strips, stems, or leaf fibers
  - Examples: basswood inner bark, dogbane stem, stinging nettle stalk, milkweed stalk, elm inner bark
  - The game generates cordage directly from parts with this tag using the fiber properties (`average_fiber_length_cm`, `fiber_strength_modifier`)
  - Can be combined with `inner_bark_cloth` on the same sub-stage if suitable for both (see below)
- `"inner_bark_cloth"` — inner bark of woody species suitable for pounding into felted bark cloth material
  - Examples: basswood inner bark, elm inner bark
  - Bark cloth is made by pounding inner bark into a felted material, not by weaving cordage
  - **Can appear together with `cordage_fiber`** on the same sub-stage when the inner bark has long, strong fibers (typically `average_fiber_length_cm` ≥ 20cm)
  - **Never appears on herbaceous species regardless of fiber quality** — bark cloth requires the physical structure of woody inner bark
  - The game generates bark cloth directly from parts with this tag
- `"stiff_stick"` — substantial rigid woody material for tool handles, structure, traps. Herbaceous stalks will almost never fit into this category.
  - **Use for:** Tree branches (thumb-thick or larger), sapling trunks, shrub main stems. Must be substantial enough to make a tool handle or structural component.
  - **Do NOT use for:** Small twigs, thin flexible shoots, or anything less than ~2cm diameter. If it's called a "twig" in the part name, it should NOT have this tag.
  - Examples: hardwood tree branches, sapling trunks, mature shrub main stems
- `"tinder"` — dry, fine, ignitable material
  - Examples: cattail fluff, dry grass, dry birch bark flakes
- `"resin"` — sticky or waterproofing material
  - Examples: pine pitch sub-stage
- `"insulation_material"` — soft, bulky material for coat filling
  - Examples: cattail fluff, milkweed seed fluff, dry moss
- `"large_leaf"` — wide flat leaf for wrapping, padding, structure
  - Examples: skunk cabbage leaf, pawpaw leaf

**Cordage and bark cloth generation:**

The game generates cordage and bark cloth directly from parts tagged with `cordage_fiber` and `inner_bark_cloth`. The `inner_bark_cloth` tag is assigned only to woody inner bark species — it never appears on herbaceous plants regardless of fiber quality. When a woody inner bark sub-stage carries both tags, the player can use that part to make either cordage (twisted/braided fiber) or bark cloth (pounded felted material). No separate processing outputs or intermediate items are needed in the plant JSON — the craft tags and fiber properties handle everything. Basswood and elm inner bark are the canonical sources with both tags.

**Important:** 
- Tags are assigned at sub-stage level, not part level
- Same part can have different tags at different life stages (green willow shoot = `flexible_shoot`, dead dry branch = `stiff_stick`)
- **Most plants do NOT have `flexible_shoot`** — this tag is reserved for species traditionally used in basketry (willows, dogwoods, vines)
- **`stiff_stick` is for substantial branches only** — if the part is too small to be useful for tool handles or construction, omit craft tags entirely

### Processing & Material Enums

**`processing_location`** — where processing occurs:
- `"hand"` — player or partner, anywhere (immediate for player, queued for partner)
- `"camp"` — partner task, no special station required
- `"hide_frame"` — requires Hide Frame station
- `"thread_spinner"` — requires Thread Spinner station
- `"mortar_pestle"` — requires Mortar & Pestle station; used for grinding seeds, nuts, and dried plant material into flour or meal
- `"leaching_basket"` — requires Leaching Basket tool in inventory; player places basket on a water tile and retrieves later

### Pharmacological Enums

**`preparation.processed_methods`** — how plant can be prepared:
- `"poultice"` — external application
- `"tea"` — steeped/boiled infusion
- `"chew"` — direct mastication

**`dose_response` effect types** — physiological effects:
- `"medicinal"` — treats a condition (requires `target` and `modifier`)
- `"health_drain"` — damages health bar at `rate_per_day`
- `"tick_loss"` — reduces next day's tick budget by `value`
- `"nausea_immediate"` — triggers vomiting at `vomit_threshold_grams`
- `"incapacitated"` — player cannot act for `duration_ticks`
- `"hallucinogen"` — triggers vision system (requires sub-object)

**`treatment_tag`** (**ENUM**, required on medicinal dose bands) — medical application for medicinal effects only. Partner auto-treatment logic scans this field to match against active conditions. A medicinal band without a `treatment_tag` has no treatment utility.

| Tag | Treats |
|-----|--------|
| `"antibacterial_poultice"` | Wound infection, bee stings |
| `"anti_inflammatory_poultice"` | Sprain |
| `"fever_tea"` | Fever / flu |
| `"tannin_tea"` | Gut illness |
| `"analgesic"` | Pain / tick cost debuffs |

---

## Numeric Constraints

### Plant Numeric Fields

- `age_of_maturity` — int, required on all plants; minimum 1; must exactly match the `min_age_days` of the first non-seedling life stage
- `scent.strength` — float 0.0-1.0
- `soil.ph_range` — array of 2 floats, valid range [3.0, 9.0]
- `ph_effect_on_soil` — float, typical range -0.3 to +0.3
- `dispersal.base_radius_tiles` — int, typical range 1-30
- `dispersal.germination_rate` — float 0.0-1.0
- `dispersal.seeds_per_mature_plant` — array of 2 ints [min, max]; use [0,0] for runner method
- `dispersal.viable_lifespan_days` — int, required on all species; typical range 60-1800+

### Sub-Stage Numeric Fields

- `edibility_score` — float 0.0-1.0 (≥0.85 = field-edible)
- `edibility_harshness` — float 0.0-1.0
- `unit_weight_g` — float, required on ALL sub-stages; natural per-item weight for countable things, 1.0 for bulk materials
- `nutrition.calories` — float, calculated from `unit_weight_g` and realistic per-100g data; can be small (0.03 for a 1g low-calorie item)
- `nutrition.protein` — float, grams per unit; calculated from unit weight
- `nutrition.carbs` — float, grams per unit; calculated from unit weight
- `nutrition.fat` — float, grams per unit; calculated from unit weight
- `processing_options[].ticks` — int, typical range 5-60 (within each processing option)
- `average_fiber_length_cm` — float, typical range 1.0-30.0
- `fiber_strength_modifier` — float, typical range 0.1-2.0 (>1.0 = high quality)
- `potency_multiplier` — float, typical range 0.1-5.0
- `harvest_base_ticks` — int, usually 1 for underground parts (digging tool modifiers apply automatically when `dig_ticks_to_discover` is present), 3-15 for above-ground parts, 10-20 for tree roots or very difficult underground extractions. Use harvest_yield.units_per_action to scale amount harvested
- `harvest_yield.units_per_action` — array of 2 ints [min, max]; required on directly-harvested sub-stages; null on output-only parts
- `harvest_yield.actions_until_depleted` — array of 2 ints [min, max]; required on directly-harvested sub-stages; null on output-only parts
- `harvest_damage` — float 0.0-1.0; required on directly-harvested sub-stages; null on output-only parts
- `regrowth_days` — int or null; non-null only for regrowing vegetative parts (leaves, shoots)
- `regrowth_max_harvests` — int or null; non-null only when regrowth_days is non-null
- `dig_ticks_to_discover` — int, optional; present only on underground parts; typical range 15-40 (shallow roots 15-20, medium roots 25-30, deep roots 35-40, tree roots 40+)
- `decay_days` — float, required on food sub-stages; days to spoilage at baseline temperature; see field reference for realistic values
- `raw_extraction_efficiency` — float 0.0-1.0, optional; defaults to 1.0
- `stew_nutrition_factor` — float, typical range 0.0-1.4; optional; defaults to 1.0
- `cooking_detoxifies` — bool, optional; defaults to false
- `cooked_edibility_score` — float 0.0-1.0 or null, optional
- `cooked_harshness` — float 0.0-1.0 or null, optional

---

## Validation Rules

### Required Field Combinations

1. **Processing options:** If `processing_options` exists, it must be a non-empty array. Each option must have all four fields: `id`, `ticks`, `location`, `outputs`. Omit the field entirely if no processing is available (don't use null or empty array).
2. **Processing outputs:** All sub-stages must have `unit_weight_g`; `output_unit_weight_g` on each output entry within `processing_options` must match the `unit_weight_g` on the referenced output part's sub-stage
3. **Harvest yield:** Directly-harvested sub-stages (those with non-empty `available_life_stages`) must have `harvest_yield` as an object with `units_per_action` and `actions_until_depleted`; output-only parts (`available_life_stages: []`) must have `harvest_yield: null`
4. **Harvest damage:** Directly-harvested sub-stages must have `harvest_damage` (float 0.0-1.0); output-only parts must have `harvest_damage: null`
5. **Regrowth fields:** Both `regrowth_days` and `regrowth_max_harvests` are required on all sub-stages; set to `null` for non-regrowing parts; set to non-null only for vegetative parts that realistically regrow (leaves, shoots)
6. **Underground parts:** `dig_ticks_to_discover` must be present on all sub-stages of underground parts and must be omitted on all above-ground parts
7. **Food decay:** All food sub-stages (any part with nutritional data) must have `decay_days`; non-food parts (craft tags only, no calories) omit it
8. **Runner plants:** If `dispersal.method` is `"runner"`, then `seeds_per_mature_plant` should be `[0, 0]`
9. **Craft tags:** `craft_tags` array must be present on all sub-stages (can be empty `[]`)
10. **Ingestion inheritance:** If sub-stage has `potency_multiplier`, top-level plant must have non-null `ingestion` object
11. **Medicinal treatment:** Medicinal `dose_response` bands must have `treatment_tag` to be usable by partner
12. **Hallucinogen prep:** Hallucinogen effects require `partner_prep_required: true` for vision system integration
13. **Description fields:** All life stages must have `field_description`; all sub-stages must have both `field_description` and `game_description`
14. **Output-only parts:** Parts with `available_life_stages: []` omit `seasonal_window`, `harvest_base_ticks`, `harvest_yield`, and `harvest_damage`
15. **Container part nutrition:** Parts that produce other parts via `processing_options` should have nutrition equal to the combined total of all output parts
16. **Extraction and cooking factors:** `raw_extraction_efficiency` determines what fraction of nutrition is extractable when eating raw in the field (defaults to 1.0). `stew_nutrition_factor` combines both extraction efficiency and cooking benefit for stew (defaults to 1.0). Values <1.0 represent incomplete extraction (whole pods, unshelled nuts), value =1.0 is neutral, and values >1.0 represent cooking benefits (1.4 for starchy roots, 1.3 for legumes). For example, honey locust beans have `raw_extraction_efficiency: 0.0` (indigestible raw) but `stew_nutrition_factor: 1.3` (digestible when cooked with calorie gain). When present, `cooked_edibility_score` and `cooked_harshness` are used by stew system instead of raw values.
17. **Plant parts:**  If a plant naturally possesses a part at any stage of its life (leaves, stem, fruit, flower, bud, root, etc.), its absence in the parts array is a validation failure. Before outputting the JSON, verify that the parts array contains at least one entry for each of the following anatomical features if the plant possesses them:

    Underground: Roots, tubers, or rhizomes.

    Support: Main stem, trunk, or vine wood.

    Foliage: Leaves or needles.

    Reproduction (Early): Buds or flowers.

    Reproduction (Late): Fruit, berries, nuts, or seed pods.

    Protection: Bark (outer and inner) or thorns.

Plus anything else that makes sense for the plant.

15. **Single part nutrition:** Reasonable defaults for various things: 1 leaf = .01 calories, 1 serviceberry = .6 calories, inner bark = 0.8 calories per gram, most inedible roots = 0.1 calorie per gram (but edibility almost 0), flowers .2 calories per gram.
18. **Tree harvest tiers:** `reach_tier` must be present on all directly-harvested sub-stages of tree species (any species whose mature life stage has `tile_share: 1.0`) and must be omitted on all non-tree, underground, and output-only parts. When `reach_tier` is `"elevated"` or `"canopy"`, the `harvest_yield` object must include `ground_action_fraction` (float 0.0-1.0, cannot be 1.0). When `reach_tier` is `"ground"`, `ground_action_fraction` must NOT be present (validation error if included).
19. **Life stage name consistency:** All stage names used in `available_life_stages` arrays must exactly match stage names defined in the plant's `life_stages` array. Do not use modified or prefixed versions of stage names.
20. **Seasonal sub-stage completeness:** If a part's `game_description` mentions seasonal changes in properties (edibility, texture, toxicity, etc.), the part must have multiple sub-stages with different `seasonal_window` ranges to model those changes. Don't describe variation without modeling it. Remember: later sub-stages inherit from the first, so you only need to specify changed fields.
21. **Sub-stage inheritance:** The first sub-stage in a part's `sub_stages` array must be fully specified. Subsequent sub-stages inherit all fields from the first sub-stage except those explicitly overridden. Always override: `id`, `seasonal_window`, `field_description`, `game_description`. Override other fields only when they actually differ from the first sub-stage.
22. **Annual life stage gaps:** Annuals must have at least one day (typically days 39-40) with no valid life stage to trigger death.
23. **Biennial life stage gaps:** `first_year` stage must have `seasonal_window: null` to cover all days in year 1. Second year stages must leave a gap (typically days 36-40) to trigger death after seeding.
24. **Perennial life stage coverage:** Perennials must have valid life stages covering all 40 days of the year (stages can cycle seasonally, but no gaps allowed).
25. **Seeding window coverage:** `seeding_window` must fall entirely within a valid life stage's seasonal window. A plant cannot seed if it dies before `seeding_window.end` is reached.
26. **Age of maturity alignment:** `age_of_maturity` must be present on all plants and MUST exactly match the `min_age_days` of the first non-seedling life stage (the first mature/reproductive stage such as "vegetative", "flowering", "mature", "first_year", etc.).
27. **Age of maturity minimum:** `age_of_maturity` must be at least 1 (cannot be 0 or negative).

### Field Interdependencies

- `seasonal_window` uses format: `"early_spring"`, `"mid_spring"`, `"late_spring"`, `"early_summer"`, `"mid_summer"`, `"late_summer"`, `"early_fall"`, `"mid_fall"`, `"late_fall"`, `"winter"`
- `available_life_stages` must reference stages defined in `life_stages` array
- `companion_plants` should reference other plant `id` values
- `harvest_tool_modifiers` keys should be valid tool names: `"knife"`, `"blickey"`, `"axe"` (do NOT use `"shovel"` or `"digging_stick"` — these are applied automatically for parts with `dig_ticks_to_discover`)

---

## Pharmacological System

For plants with medicinal, toxic, or hallucinogenic properties, populate the `ingestion` object:

```json
"ingestion": {
  "preparation": {
    "raw_usable": true,
    "processed_methods": ["poultice", "tea", "chew"],
    "partner_prep_required_for": ["tea"]
  },
  "pharmacokinetics": {
    "onset_ticks": 20,
    "peak_ticks": 60,
    "duration_ticks": 120,
    "processing_ticks": 240
  },
  "dose_response": [
    {
      "min_grams": 5,
      "max_grams": 30,
      "treatment_tag": "antibacterial_poultice",
      "effects": [
        {
          "type": "medicinal",
          "target": "wound_infection",
          "modifier": 1.5
        }
      ]
    },
    {
      "min_grams": 31,
      "max_grams": 80,
      "effects": [
        {
          "type": "nausea_immediate",
          "vomit_threshold_grams": 50
        },
        {
          "type": "health_drain",
          "rate_per_day": 0.1
        }
      ]
    },
    {
      "min_grams": 81,
      "max_grams": null,
      "effects": [
        {
          "type": "health_drain",
          "rate_per_day": 0.5
        },
        {
          "type": "incapacitated",
          "duration_ticks": 200
        }
      ]
    }
  ]
}
```

**Pharmacokinetics Fields:**
- `onset_ticks` — delay between consumption and first effects
- `peak_ticks` — ticks after consumption when effects peak
- `duration_ticks` — how long active effects last from peak
- `processing_ticks` — total time substance remains in body (doses accumulate within this window)

**Dose Response Bands:**
- Ordered list from low to high dose
- `max_grams: null` = no ceiling (lethal band)
- Each band has array of `effects`
- Bands should not overlap
- **Medicinal bands must include `treatment_tag`** from the enum above (antibacterial_poultice, anti_inflammatory_poultice, fever_tea, tannin_tea, or analgesic)

**Hallucinogen Effect Example:**
```json
{
  "type": "hallucinogen",
  "vision_categories": ["tech", "plant", "sight"],
  "sight_duration_days": 3,
  "debuff": {
    "type": "tick_loss",
    "value": 30,
    "duration_days": 1
  },
  "partner_prep_required": true
}
```

---

## Complete Working Example

```json
{
  "id": "gleditsia_triacanthos",
  "name": "Honey Locust",
  "plant_family": "fabaceae",
  "physical_description": "A large deciduous tree with 1-3 inch thorns on trunk and branches. Compound leaves with 15-30 small leaflets. Dark brown furrowed bark. Produces long twisted seed pods.",
  "game_description": "Beans are high in protein and store well through winter, but extracting them in quantity is slow work by hand. A mortar and pestle speeds the process.",
  "scent": {
    "strength": 0.2,
    "primary_compound": "linalool"
  },
  "habitat": ["forest_edge", "floodplain"],
  "companion_plants": ["quercus_alba", "carya_ovata", "acer_saccharum"],
  "growth_behavior": "solitary",
  "longevity": "perennial",
  "soil": {
    "ph_range": [6.0, 8.0],
    "drainage": "well",
    "shade_tolerance": "low"
  },
  "ph_effect_on_soil": 0.0,
  "dispersal": {
    "method": "gravity",
    "base_radius_tiles": 3,
    "wind_radius_bonus": 0,
    "water_dispersed": false,
    "animal_dispersed": false,
    "seeds_per_mature_plant": [8, 20],
    "germination_rate": 0.15,
    "germination_season": "spring",
    "requires_disturbance": false,
    "pioneer": false,
    "viable_lifespan_days": 225
  },
  "ingestion": null,
  "life_stages": [
    {
      "stage": "seedling",
      "min_age_days": 0,
      "seasonal_window": null,
      "size": 1,
      "field_description": "A spindly sapling with paired, feathery leaflets. Small thorns are visible on the stem."
    },
    {
      "stage": "vegetative",
      "min_age_days": 23,
      "seasonal_window": {
        "start_day": 1,
        "end_day": 15
      },
      "size": 3,
      "field_description": "A young tree with compound leaves and developing thorns."
    },
    {
      "stage": "flowering",
      "min_age_days": 24,
      "seasonal_window": {
        "start_day": 16,
        "end_day": 20
      },
      "size": 4,
      "field_description": "A large tree with deeply furrowed bark and fierce branching thorns. Small greenish-yellow flower clusters hang from branches among the compound leaves."
    },
    {
      "stage": "fruiting",
      "min_age_days": 25,
      "seasonal_window": {
        "start_day": 21,
        "end_day": 40
      },
      "size": 4,
      "field_description": "A large tree with deeply furrowed bark, compound leaves, and clusters of fierce branching thorns up to three inches long. Long twisted seed pods hang in clusters."
    }
  ],
  "parts": [
    {
      "name": "pod",
      "available_life_stages": ["flowering", "fruiting"],
      "sub_stages": [
        {
          "id": "green",
          "seasonal_window": {
            "start": "early_summer",
            "end": "mid_summer"
          },
          "field_description": "A flat green pod, soft and slightly glossy, hanging in clusters. Smells faintly grassy when crushed.",
          "game_description": "Tender and edible raw or cooked. Mild and sweet. No processing needed; can be eaten directly or added to stew.",
          "edibility_score": 0.9,
          "edibility_harshness": 0.4,
          "poisonous": false,
          "unit_weight_g": 25.0,
          "nutrition": {
            "calories": 80,
            "protein": 4,
            "carbs": 14,
            "fat": 1
          },
          "texture": "tender",
          "taste_notes": ["sweet", "mild"],
          "scent_notes": ["fresh", "grassy"],
          "average_fiber_length_cm": 8.0,
          "fiber_strength_modifier": 0.4,
          "fiberous": false,
          "craft_tags": [],
          "ingestion": null,
          "potency_multiplier": null,
          "harvest_base_ticks": 1,
          "harvest_tool_modifiers": {},
          "harvest_yield": {
            "units_per_action": [2, 5],
            "actions_until_depleted": [3, 7]
          },
          "harvest_damage": 0.0,
          "regrowth_days": null,
          "regrowth_max_harvests": null,
          "decay_days": 2.0,
          "can_dry": false,
          "stew_nutrition_factor": 1.0
        },
        {
          "id": "dry",
          "seasonal_window": {
            "start": "late_summer",
            "end": "fall"
          },
          "field_description": "A hard brown pod, twisted and brittle, rattling audibly when shaken.",
          "game_description": "Contains high-protein beans. Slow to extract by hand; mortar and pestle speeds the process. Dried beans store well through winter.",
          "edibility_score": 0.8,
          "edibility_harshness": 0.5,
          "poisonous": false,
          "unit_weight_g": 40.0,
          "nutrition": {
            "calories": 120,
            "protein": 8,
            "carbs": 20,
            "fat": 2
          },
          "processing_options": [
            {
              "id": "extract_beans",
              "ticks": 30,
              "location": "hand",
              "outputs": [
                {
                  "part": "beans",
                  "yield_fraction": 0.35,
                  "output_unit_weight_g": 1.4
                },
                {
                  "part": "pod_husk",
                  "yield_fraction": 0.55,
                  "output_unit_weight_g": 40.0
                }
              ]
            }
          ],
          "texture": "hard",
          "taste_notes": ["sweet", "starchy"],
          "scent_notes": ["dry", "nutty"],
          "average_fiber_length_cm": 15.5,
          "fiber_strength_modifier": 0.8,
          "fiberous": true,
          "craft_tags": ["stiff_stick"],
          "ingestion": null,
          "potency_multiplier": null,
          "harvest_base_ticks": 1,
          "harvest_tool_modifiers": {
            "knife": 1.4,
            "blickey": 1.2
          },
          "harvest_yield": {
            "units_per_action": [3, 8],
            "actions_until_depleted": [4, 10]
          },
          "harvest_damage": 0.0,
          "regrowth_days": null,
          "regrowth_max_harvests": null,
          "decay_days": 46.0,
          "can_dry": true,
          "stew_nutrition_factor": 1.3
        }
      ]
    },
    {
      "name": "beans",
      "available_life_stages": [],
      "sub_stages": [
        {
          "id": "extracted",
          "field_description": "Small hard reddish-brown beans, smooth and dense.",
          "game_description": "High in protein. Decays slowly. Cooking in stew increases caloric value.",
          "edibility_score": 0.85,
          "edibility_harshness": 0.3,
          "unit_weight_g": 1.4,
          "nutrition": {
            "calories": 120,
            "protein": 8,
            "carbs": 20,
            "fat": 2
          },
          "texture": "hard",
          "taste_notes": ["sweet", "starchy"],
          "scent_notes": ["nutty"],
          "average_fiber_length_cm": 0.0,
          "fiber_strength_modifier": 0.0,
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
          "decay_days": 91.0,
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
          "field_description": "A split brown husk, papery and fibrous.",
          "game_description": "Inedible. Short fibers. Not particularly useful.",
          "edibility_score": 0.0,
          "edibility_harshness": 1.0,
          "unit_weight_g": 40.0,
          "nutrition": {
            "calories": 0,
            "protein": 0,
            "carbs": 0,
            "fat": 0
          },
          "texture": "papery",
          "taste_notes": [],
          "scent_notes": ["dry", "earthy"],
          "average_fiber_length_cm": 2.5,
          "fiber_strength_modifier": 0.8,
          "fiberous": true,
          "craft_tags": ["weaving_material"],
          "ingestion": null,
          "potency_multiplier": null,
          "harvest_base_ticks": null,
          "harvest_tool_modifiers": {},
          "harvest_yield": null,
          "harvest_damage": null,
          "regrowth_days": null,
          "regrowth_max_harvests": null,
          "can_dry": true,
          "stew_nutrition_factor": 1.0
        }
      ]
    }
  ]
}
```

---

## Generation Workflow

1. **Research the plant** from Indiana Flora Wiki
2. **Populate top-level fields** based on botanical reality
   - Include `game_description` (post-ID overview; state facts not value judgments)
   - Add `viable_lifespan_days` to dispersal object
3. **Define life stages** appropriate to plant type
   - Use the life stage granularity guidance above: define stages based on visual distinctiveness and forager utility
   - Set `min_age_days` for each stage (in-game days since germination)
   - **CRITICAL:** Each stage must have unique `min_age_days` - no two stages can share the same age threshold
   - Set `seasonal_window` with `start_day` and `end_day` (in-game days 1-40) for seasonal stages, or `null` for age-only stages
   - Order stages by `min_age_days` ascending
   - Consider all applicable stage types: `seedling`, `vegetative`, `flowering`, `fruiting`, `seed_set`, `senescent`, `dormant`, or `mature`
   - For biennials, use `first_year` (age ~3-4) and `second_year` stages (age 46+), can be split further with seasonal windows
   - For annuals, remember they die when `seeding_window.end` is reached regardless of life stage
   - For perennials, seasonal stages will cycle annually once age threshold is reached
   - When in doubt, err toward more stages — a missed visual distinction is a missed forager cue
   - Add `field_description` to each life stage
4. **Create parts**: Exhaustively model the plant's anatomy. If the real plant has leaves, a stem, and roots, you must generate a leaf, stem, and root part. Do not skip parts just because they lack special craft tags or pharmacology.
5. **Define sub-stages** for seasonal variations
   - Add both `field_description` (always visible) and `game_description` (post-ID)
   - **Important:** In `game_description`, state facts not value judgments ("high in protein" not "excellent food")
   - Set `unit_weight_g` on ALL sub-stages
   - Set `harvest_yield` object on directly-harvested sub-stages; null on output-only parts
   - Set `harvest_damage` (0.0-1.0) on directly-harvested sub-stages; null on output-only parts
   - Set `regrowth_days` and `regrowth_max_harvests` (null for non-regrowing parts)
   - Set `decay_days` on food sub-stages; omit on non-food parts
   - Use `processing_outputs` array instead of deprecated `processing_byproduct`
   - Add `dig_ticks_to_discover` only on underground parts
6. **Assign craft tags** based on material properties
7. **Set nutrition values** realistically
8. **Add pharmacology** if plant has medicinal/toxic properties
9. **Validate** against all rules in this document
10. **Human review** for balance and accuracy

---

## Notes

- **Open-ended fields** (plant_family, taste_notes, scent_notes, texture, physical_description, companion_plants) should be botanically accurate but are not constrained to specific values
- **ENUM fields** must use exact values from this document
- **Craft tags** are the primary way plants interact with crafting recipes
- **Processing steps** create distinct stockpile items via `processing_outputs` array
- **Sub-stage variations** allow realistic seasonal changes (green → ripe → dry)
- **Pharmacology** is optional but adds depth to medicinal and toxic plants
- **Description fields** are split: `field_description` (always visible) vs `game_description` (post-ID only)
- **Output-only parts** (processing products) have `available_life_stages: []` and omit `seasonal_window`

---

**Document Version:** 4.0  
**Last Updated:** Based on GDD v1.38 (Life Stage System Redesign)  
**Source:** 10000 BC Game Design Document

**Major Changes in v4.0:**
- Life stages now use `min_age_days` (in-game days) + `seasonal_window` (in-game days 1-40) instead of `duration_days`
- Enables seasonal cycling for perennials while maintaining age-based progression for annuals/biennials
- Each stage must have unique `min_age_days` to enforce sequential progression
- Annuals die when `seeding_window.end` is reached regardless of life stage
