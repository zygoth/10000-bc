import { PLANT_BY_ID } from './plantCatalog.mjs';
import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { ITEM_BY_ID, resolveCatalogFieldEdibilityScore } from './itemCatalog.mjs';
import {
  STEW_DAILY_CALORIES_ADULT,
  STEW_DAILY_CALORIES_CHILD_DEFAULT,
  STEW_FAT_BONUS_THRESHOLD_GRAMS,
  STEW_NAUSEA_DECAY_ABSENT_PER_DAY,
  STEW_NAUSEA_GAIN_MONOTONOUS,
  STEW_NAUSEA_GAIN_REPETITIVE,
  STEW_NEXT_DAY_TICK_BONUS,
  STEW_PROTEIN_BONUS_THRESHOLD_GRAMS,
  TICKS_PER_DAY,
  NIGHTLY_DEBRIEF_START_TICK,
  HUNGER_BAR_CALORIES,
} from './simCore.constants.mjs';
import { parsePlantPartItemId } from './plantPartDescriptors.mjs';
import { resolveEffectiveReachTier } from './harvestReachTier.mjs';
import { ensureHarvestEntryState } from './harvestEntryState.mjs';
import { checkActorInventoryRelocation } from './inventoryRelocate.mjs';
import {
  landTrapHasBait,
  parseLandTrapBaitPlantSpeciesId,
  plantSpeciesEligibleForDeadfallLandBait,
  plantSpeciesEligibleForSimpleSnareBait,
} from './trapBaitLand.mjs';
import { TECH_RESEARCH_TASK_KIND } from './techResearchCatalog.mjs';
import { CAMP_MAINTENANCE_TASK_KIND } from './campMaintenance.mjs';
import { getTechForestChildResearchBlocker, getTechForestNode } from './techForestGen.mjs';
import { isActorWithinCampFootprint, isTileWithinCampFootprint } from './campFootprint.mjs';
import { resolveStewIngredientDescriptor as resolveStewIngredientDescriptorShared } from './stewIngredientDescriptor.mjs';
import { resolveVisionRecipes } from './medicineDebrief.mjs';

const ACTION_KINDS = [
  'move',
  'harvest',
  'fell_tree',
  'trap_place_snare',
  'trap_place_deadfall',
  'trap_place_fish_weir',
  'auto_rod_place',
  'trap_check',
  'trap_bait',
  'trap_retrieve',
  'trap_pickup',
  'trap_remove_bait',
  'marker_place',
  'marker_remove',
  'fish_rod_cast',
  'inspect',
  'dig',
  'hoe',
  'tap_insert_spout',
  'tap_remove_spout',
  'tap_place_vessel',
  'tap_retrieve_vessel',
  'waterskin_fill',
  'waterskin_drink',
  'water_drink',
  'leaching_basket_place',
  'leaching_basket_retrieve',
  'item_pickup',
  'item_drop',
  'eat',
  'process_item',
  'camp_stockpile_add',
  'camp_stockpile_remove',
  'camp_drying_rack_add',
  'camp_drying_rack_add_inventory',
  'camp_drying_rack_remove',
  'meal_plan_set',
  'meal_plan_commit',
  'camp_station_build',
  'tool_craft',
  'equip_item',
  'unequip_item',
  'partner_task_set',
  'partner_queue_reorder',
  'debrief_enter',
  'debrief_exit',
  'partner_medicine_administer',
  'partner_vision_request',
  'partner_vision_confirm',
  'partner_vision_choose',
  'nature_sight_overlay_set',
  'inventory_relocate_stack',
];

const ACTION_TICK_COST = {
  move: 1,
  harvest: 1,
  fell_tree: 1,
  trap_place_snare: 2,
  trap_place_deadfall: 3,
  trap_place_fish_weir: 4,
  auto_rod_place: 2,
  trap_check: 2,
  trap_bait: 1,
  trap_retrieve: 2,
  trap_pickup: 2,
  trap_remove_bait: 1,
  marker_place: 1,
  marker_remove: 1,
  fish_rod_cast: 5,
  inspect: 1,
  dig: 1,
  hoe: 2,
  tap_insert_spout: 2,
  tap_remove_spout: 1,
  tap_place_vessel: 1,
  tap_retrieve_vessel: 1,
  waterskin_fill: 2,
  waterskin_drink: 1,
  water_drink: 1,
  leaching_basket_place: 2,
  leaching_basket_retrieve: 2,
  item_pickup: 1,
  item_drop: 1,
  eat: 2,
  process_item: 1,
  camp_stockpile_add: 1,
  camp_stockpile_remove: 1,
  camp_drying_rack_add: 1,
  camp_drying_rack_add_inventory: 1,
  camp_drying_rack_remove: 1,
  // Debrief UI actions should not advance global time/hunger.
  // These are planning/confirmation steps that happen during the nightly overlay.
  meal_plan_set: 0,
  meal_plan_commit: 0,
  camp_station_build: 1,
  tool_craft: 1,
  equip_item: 1,
  unequip_item: 1,
  // Queuing partner work is nightly planning; must not spend player ticks or advance dayTick (see actionRunner).
  partner_task_set: 0,
  partner_queue_reorder: 0,
  debrief_enter: 0,
  debrief_exit: 0,
  partner_medicine_administer: 1,
  // Vision flow is nightly debrief UI only (no dayTick / hunger advance); batch-safe in one advanceTick.
  partner_vision_request: 0,
  partner_vision_confirm: 0,
  partner_vision_choose: 0,
  nature_sight_overlay_set: 1,
  inventory_relocate_stack: 0,
};

const EQUIPPABLE_ITEM_TO_SLOT = {
  'tool:gloves': 'gloves',
  'tool:coat': 'coat',
  'tool:sun_hat': 'head',
};

const EQUIPMENT_SLOTS = new Set(['gloves', 'coat', 'head']);

const MIN_FIELD_EDIBILITY_SCORE = 0.85;
const MIN_FISH_ROD_CAST_TICKS = 5;
const NATURE_SIGHT_OVERLAYS = new Set([
  'calorie_heatmap',
  'animal_density',
  'mushroom_zones',
  'plant_compatibility',
  'fishing_hotspots',
]);
const EARTHWORM_ITEM_ID = 'earthworm';
const CRAFT_TAG_ALIASES = {
  bone_tool_material: 'bone_material',
  weaving_material: 'reedy_material',
  sun_hat_reed_material: 'reedy_material',
};

export const CAMP_STATION_RECIPES = {
  raised_sleeping_platform: {
    stationId: 'raised_sleeping_platform',
    craftTicks: 100,
    requiredUnlock: null,
  },
  windbreak_reflector_wall: {
    stationId: 'windbreak_reflector_wall',
    craftTicks: 80,
    requiredUnlock: null,
  },
  drying_rack: {
    stationId: 'drying_rack',
    craftTicks: 120,
    requiredUnlock: 'unlock_station_drying_rack',
  },
  workbench: {
    stationId: 'workbench',
    craftTicks: 150,
    requiredUnlock: 'unlock_station_workbench',
  },
  thread_spinner: {
    stationId: 'thread_spinner',
    craftTicks: 200,
    requiredUnlock: 'unlock_station_thread_spinner',
  },
  hide_frame: {
    stationId: 'hide_frame',
    craftTicks: 80,
    requiredUnlock: 'unlock_station_hide_frame',
  },
  mortar_pestle: {
    stationId: 'mortar_pestle',
    craftTicks: 60,
    requiredUnlock: 'unlock_station_mortar_pestle',
  },
  sugar_boiling_station: {
    stationId: 'sugar_boiling_station',
    craftTicks: 100,
    requiredUnlock: 'unlock_station_sugar_boiling_station',
  },
};

export const TOOL_RECIPES = {
  flint_knife: {
    recipeId: 'flint_knife',
    craftTicks: 30,
    requiredUnlock: null,
    outputItemId: 'tool:flint_knife',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'flint_cobble', quantity: 1 },
      { type: 'item', itemId: 'cordage', quantity: 1 },
    ],
  },
  digging_stick: {
    recipeId: 'digging_stick',
    craftTicks: 10,
    requiredUnlock: null,
    outputItemId: 'tool:digging_stick',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 1 },
    ],
  },
  stool: {
    recipeId: 'stool',
    craftTicks: 15,
    requiredUnlock: null,
    outputItemId: 'tool:stool',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 4 },
    ],
  },
  marker_stick: {
    recipeId: 'marker_stick',
    craftTicks: 5,
    requiredUnlock: null,
    outputItemId: 'tool:marker_stick',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 1 },
    ],
  },
  carved_wooden_spout: {
    recipeId: 'carved_wooden_spout',
    craftTicks: 15,
    requiredUnlock: null,
    outputItemId: 'tool:carved_wooden_spout',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 1 },
    ],
  },
  axe: {
    recipeId: 'axe',
    craftTicks: 50,
    requiredUnlock: 'unlock_tool_axe',
    outputItemId: 'tool:axe',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'flint_cobble', quantity: 1 },
      { type: 'tag', tag: 'stiff_stick', quantity: 1 },
      { type: 'item', itemId: 'cordage', quantity: 2 },
    ],
  },
  ladder: {
    recipeId: 'ladder',
    craftTicks: 60,
    requiredUnlock: 'unlock_tool_ladder',
    outputItemId: 'tool:ladder',
    outputQuantity: 1,
    outputFootprintW: 2,
    outputFootprintH: 4,
    materialRequirements: [
      { type: 'item', itemId: 'pole', quantity: 4 },
      { type: 'item', itemId: 'cordage', quantity: 4 },
    ],
  },
  simple_snare: {
    recipeId: 'simple_snare',
    craftTicks: 8,
    requiredUnlock: 'unlock_tool_simple_snare',
    outputItemId: 'tool:simple_snare',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'cordage', quantity: 3 },
      { type: 'tag', tag: 'stiff_stick', quantity: 1 },
    ],
  },
  dead_fall_trap: {
    recipeId: 'dead_fall_trap',
    craftTicks: 12,
    requiredUnlock: 'unlock_tool_dead_fall_trap',
    outputItemId: 'tool:dead_fall_trap',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'cordage', quantity: 2 },
      { type: 'item', itemId: 'heavy_rock', quantity: 1 },
      { type: 'item', itemId: 'pole', quantity: 1 },
    ],
  },
  basket: {
    recipeId: 'basket',
    craftTicks: 60,
    requiredUnlock: 'unlock_tool_basket',
    outputItemId: 'tool:basket',
    outputQuantity: 1,
    outputFootprintW: 2,
    outputFootprintH: 2,
    materialRequirements: [
      { type: 'item', itemId: 'cordage', quantity: 6 },
      {
        type: 'one_of',
        options: [
          { type: 'tag', tag: 'flexible_shoot', quantity: 12 },
          { type: 'tag', tag: 'reedy_material', quantity: 12 },
        ],
      },
    ],
  },
  blickey: {
    recipeId: 'blickey',
    craftTicks: 20,
    requiredUnlock: 'unlock_tool_blickey',
    outputItemId: 'tool:blickey',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'cordage', quantity: 2 },
      {
        type: 'one_of',
        options: [
          { type: 'tag', tag: 'flexible_shoot', quantity: 1 },
          { type: 'tag', tag: 'reedy_material', quantity: 1 },
          { type: 'tag', tag: 'bark_sheet', quantity: 1 },
          { type: 'item', itemId: 'hide', quantity: 800 },
        ],
      },
    ],
  },
  leaching_basket: {
    recipeId: 'leaching_basket',
    craftTicks: 30,
    requiredUnlock: 'unlock_tool_leaching_basket',
    outputItemId: 'tool:leaching_basket',
    outputQuantity: 1,
    outputFootprintW: 2,
    outputFootprintH: 2,
    materialRequirements: [
      { type: 'item', itemId: 'cordage', quantity: 4 },
      {
        type: 'one_of',
        options: [
          { type: 'tag', tag: 'flexible_shoot', quantity: 3 },
          { type: 'tag', tag: 'reedy_material', quantity: 3 },
        ],
      },
    ],
  },
  cordage_organizer: {
    recipeId: 'cordage_organizer',
    craftTicks: 25,
    requiredUnlock: null,
    outputItemId: 'tool:cordage_organizer',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 2 },
      { type: 'item', itemId: 'cordage', quantity: 1 },
    ],
  },
  shovel: {
    recipeId: 'shovel',
    craftTicks: 40,
    requiredUnlock: 'unlock_tool_shovel',
    outputItemId: 'tool:shovel',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 1 },
      { type: 'item', itemId: 'cordage', quantity: 1 },
      { type: 'item', itemId: 'flat_stone', quantity: 1 },
    ],
  },
  hoe: {
    recipeId: 'hoe',
    craftTicks: 40,
    requiredUnlock: 'unlock_tool_hoe',
    outputItemId: 'tool:hoe',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 1 },
      { type: 'item', itemId: 'flat_stone', quantity: 1 },
      { type: 'item', itemId: 'cordage', quantity: 1 },
    ],
  },
  fish_trap_weir: {
    recipeId: 'fish_trap_weir',
    craftTicks: 50,
    requiredUnlock: 'unlock_tool_fish_trap_weir',
    outputItemId: 'tool:fish_trap_weir',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'cordage', quantity: 6 },
      { type: 'tag', tag: 'stiff_stick', quantity: 8 },
    ],
  },
  bone_hook: {
    recipeId: 'bone_hook',
    craftTicks: 8,
    requiredUnlock: null,
    outputItemId: 'tool:bone_hook',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'bone_material', quantity: 1 },
    ],
  },
  fishing_rod: {
    recipeId: 'fishing_rod',
    craftTicks: 30,
    requiredUnlock: 'unlock_tool_fishing_rod',
    outputItemId: 'tool:fishing_rod',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 1 },
      { type: 'item', itemId: 'cordage', quantity: 3 },
      { type: 'item', itemId: 'tool:bone_hook', quantity: 1 },
    ],
  },
  auto_rod: {
    recipeId: 'auto_rod',
    craftTicks: 40,
    requiredUnlock: 'unlock_tool_auto_rod',
    outputItemId: 'tool:auto_rod',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'tag', tag: 'stiff_stick', quantity: 2 },
      { type: 'item', itemId: 'cordage', quantity: 4 },
      { type: 'item', itemId: 'tool:bone_hook', quantity: 1 },
    ],
  },
  wooden_platform: {
    recipeId: 'wooden_platform',
    craftTicks: 20,
    requiredUnlock: 'unlock_tool_wooden_platform',
    outputItemId: 'tool:wooden_platform',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'pole', quantity: 2 },
      { type: 'item', itemId: 'cordage', quantity: 2 },
    ],
  },
  sled: {
    recipeId: 'sled',
    craftTicks: 80,
    requiredUnlock: 'unlock_tool_sled',
    outputItemId: 'tool:sled',
    outputQuantity: 1,
    outputFootprintW: 2,
    outputFootprintH: 2,
    materialRequirements: [
      { type: 'item', itemId: 'pole', quantity: 2 },
      { type: 'item', itemId: 'cordage', quantity: 6 },
      {
        type: 'one_of',
        options: [
          { type: 'tag', tag: 'bark_sheet', quantity: 1 },
          { type: 'item', itemId: 'hide', quantity: 800 },
        ],
      },
    ],
  },
  waterskin: {
    recipeId: 'waterskin',
    craftTicks: 25,
    requiredUnlock: 'unlock_tool_waterskin',
    outputItemId: 'tool:waterskin',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'hide', quantity: 800 },
      { type: 'item', itemId: 'cordage', quantity: 2 },
      { type: 'tag', tag: 'resin', quantity: 1 },
    ],
  },
  gloves: {
    recipeId: 'gloves',
    craftTicks: 15,
    requiredUnlock: null,
    outputItemId: 'tool:gloves',
    outputQuantity: 1,
    outputFootprintW: 1,
    outputFootprintH: 1,
    materialRequirements: [
      { type: 'item', itemId: 'hide', quantity: 400 },
      { type: 'item', itemId: 'cordage', quantity: 2 },
    ],
  },
  coat: {
    recipeId: 'coat',
    craftTicks: 140,
    requiredUnlock: 'unlock_tool_coat',
    outputItemId: 'tool:coat',
    outputQuantity: 1,
    outputFootprintW: 2,
    outputFootprintH: 2,
    materialRequirements: [
      { type: 'tag', tag: 'insulation_material', quantity: 6 },
      { type: 'item', itemId: 'cordage', quantity: 4 },
      {
        type: 'one_of',
        options: [
          { type: 'item', itemId: 'hide', quantity: 3200 },
          { type: 'item', itemId: 'barkcloth', quantity: 4 },
          { type: 'tag', tag: 'bark_sheet', quantity: 4 },
        ],
      },
    ],
  },
  sun_hat: {
    recipeId: 'sun_hat',
    craftTicks: 35,
    requiredUnlock: null,
    outputItemId: 'tool:sun_hat',
    outputQuantity: 1,
    outputFootprintW: 1,
    outputFootprintH: 1,
    materialRequirements: [
      {
        type: 'one_of',
        options: [
          { type: 'tag', tag: 'reedy_material', quantity: 6 },
          { type: 'item', itemId: 'dried_hide', quantity: 1 },
        ],
      },
      { type: 'item', itemId: 'cordage', quantity: 2 },
    ],
  },
  hide_vessel: {
    recipeId: 'hide_vessel',
    craftTicks: 40,
    requiredUnlock: null,
    outputItemId: 'tool:hide_pitch_vessel',
    outputQuantity: 1,
    materialRequirements: [
      { type: 'item', itemId: 'hide', quantity: 800 },
      { type: 'item', itemId: 'pitch', quantity: 1 },
      { type: 'item', itemId: 'cordage', quantity: 2 },
    ],
  },
};

const ACTION_REQUIRED_UNLOCK = {};
const TAPPABLE_TREE_SPECIES_IDS = new Set([
  'juglans_nigra',
  'acer_saccharum',
  'acer_saccharinum',
  'acer_rubrum',
  'betula_papyrifera',
  'platanus_occidentalis',
]);
const SAP_FILLED_VESSEL_ITEM_ID = 'tool:hide_pitch_vessel_filled_sap';
const SAP_EMPTY_VESSEL_ITEM_ID = 'tool:hide_pitch_vessel';
const WATERSKIN_EMPTY_ITEM_ID = 'tool:waterskin';
const LEACHING_BASKET_ITEM_ID = 'tool:leaching_basket';
const WATERSKIN_FULL_DRINKS = 3;

function waterskinItemIdFor(sourceType, drinks) {
  if (!Number.isInteger(drinks) || drinks <= 0) {
    return WATERSKIN_EMPTY_ITEM_ID;
  }
  if (sourceType !== 'safe' && sourceType !== 'river' && sourceType !== 'pond') {
    return null;
  }
  if (drinks > WATERSKIN_FULL_DRINKS) {
    return null;
  }
  return `tool:waterskin_${sourceType}_${drinks}`;
}

function parseWaterskinItemId(itemId) {
  if (itemId === WATERSKIN_EMPTY_ITEM_ID) {
    return { sourceType: null, drinks: 0 };
  }
  if (typeof itemId !== 'string') {
    return null;
  }

  const match = /^tool:waterskin_(safe|river|pond)_([1-3])$/.exec(itemId);
  if (!match) {
    return null;
  }
  return {
    sourceType: match[1],
    drinks: Number(match[2]),
  };
}

function collectActorWaterskinStacks(actor) {
  const stacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : [];
  return stacks.filter((stack) => {
    const itemId = typeof stack?.itemId === 'string' ? stack.itemId : '';
    return parseWaterskinItemId(itemId) !== null && Math.floor(Number(stack?.quantity) || 0) > 0;
  });
}

function resolveWaterskinFillableStack(actor, preferredItemId = null) {
  const waterskinStacks = collectActorWaterskinStacks(actor);
  if (waterskinStacks.length <= 0) {
    return null;
  }

  if (typeof preferredItemId === 'string' && preferredItemId) {
    const preferred = waterskinStacks.find((stack) => stack.itemId === preferredItemId);
    const state = parseWaterskinItemId(preferred?.itemId);
    if (preferred && state && state.drinks < WATERSKIN_FULL_DRINKS) {
      return preferred;
    }
    return null;
  }

  const priority = [
    WATERSKIN_EMPTY_ITEM_ID,
    waterskinItemIdFor('safe', 1),
    waterskinItemIdFor('river', 1),
    waterskinItemIdFor('pond', 1),
    waterskinItemIdFor('safe', 2),
    waterskinItemIdFor('river', 2),
    waterskinItemIdFor('pond', 2),
  ];
  for (const itemId of priority) {
    const stack = waterskinStacks.find((entry) => entry.itemId === itemId);
    if (stack) {
      return stack;
    }
  }
  return null;
}

function resolveWaterskinDrinkableStack(actor, preferredItemId = null) {
  const waterskinStacks = collectActorWaterskinStacks(actor);
  if (waterskinStacks.length <= 0) {
    return null;
  }

  if (typeof preferredItemId === 'string' && preferredItemId) {
    const preferred = waterskinStacks.find((stack) => stack.itemId === preferredItemId);
    const state = parseWaterskinItemId(preferred?.itemId);
    if (preferred && state && state.drinks > 0) {
      return preferred;
    }
    return null;
  }

  const priority = [
    waterskinItemIdFor('pond', 1),
    waterskinItemIdFor('river', 1),
    waterskinItemIdFor('safe', 1),
    waterskinItemIdFor('pond', 2),
    waterskinItemIdFor('river', 2),
    waterskinItemIdFor('safe', 2),
    waterskinItemIdFor('pond', 3),
    waterskinItemIdFor('river', 3),
    waterskinItemIdFor('safe', 3),
  ];
  for (const itemId of priority) {
    const stack = waterskinStacks.find((entry) => entry.itemId === itemId);
    if (stack) {
      return stack;
    }
  }
  return null;
}

function resolveWaterskinSourceTypeFromWaterTile(tile) {
  if (!tile?.waterType) {
    return null;
  }
  if (tile.waterType === 'pond') {
    return 'pond';
  }
  if (tile.waterType === 'river') {
    return 'river';
  }
  return null;
}

function collectAdjacentDrinkableWaterTargets(state, actor) {
  const actorX = Number(actor?.x);
  const actorY = Number(actor?.y);
  if (!Number.isInteger(actorX) || !Number.isInteger(actorY)) {
    return [];
  }

  const targets = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = actorX + dx;
      const y = actorY + dy;
      if (!inBounds(state, x, y)) {
        continue;
      }

      const tile = getTile(state, x, y);
      if (!tile || !tile.waterType || tile.waterFrozen === true) {
        continue;
      }

      const sourceType = resolveWaterskinSourceTypeFromWaterTile(tile);
      if (!sourceType) {
        continue;
      }

      targets.push({ x, y, sourceType });
    }
  }
  return targets;
}

function validateWaterskinFillAction(state, action, actor) {
  const requestedItemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : null;
  const fillableStack = resolveWaterskinFillableStack(actor, requestedItemId);
  if (!fillableStack) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'waterskin_fill requires an empty or partially filled waterskin in inventory',
      requiredItemId: WATERSKIN_EMPTY_ITEM_ID,
    };
  }

  const targets = collectAdjacentDrinkableWaterTargets(state, actor);
  if (targets.length <= 0) {
    return {
      ok: false,
      code: 'waterskin_fill_invalid_target',
      message: 'waterskin_fill requires at least one current or adjacent unfrozen water tile',
    };
  }

  const sourceTarget = targets[0];
  const toItemId = waterskinItemIdFor(sourceTarget.sourceType, WATERSKIN_FULL_DRINKS);
  if (!toItemId) {
    return {
      ok: false,
      code: 'waterskin_fill_invalid_target',
      message: 'waterskin_fill could not resolve a valid water source type',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        fromItemId: fillableStack.itemId,
        toItemId,
        sourceType: sourceTarget.sourceType,
        waterX: sourceTarget.x,
        waterY: sourceTarget.y,
      },
    },
  };
}

function validateWaterDrinkAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'water_drink_out_of_bounds', message: 'water_drink target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'water_drink target must be on current or adjacent tile',
    };
  }

  if (
    isActorWithinCampFootprint(state, actor)
    && isTileWithinCampFootprint(state, target.x, target.y)
  ) {
    return {
      ok: true,
      code: null,
      message: 'ok',
      normalizedAction: {
        ...action,
        payload: {
          ...action.payload,
          x: target.x,
          y: target.y,
          sourceType: 'safe',
        },
      },
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || !tile.waterType || tile.waterFrozen === true) {
    return {
      ok: false,
      code: 'water_drink_invalid_target',
      message: 'water_drink requires an unfrozen river or pond tile',
    };
  }

  const sourceType = resolveWaterskinSourceTypeFromWaterTile(tile);
  if (!sourceType) {
    return {
      ok: false,
      code: 'water_drink_invalid_target',
      message: 'water_drink could not resolve a valid water source type',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
        sourceType,
      },
    },
  };
}

function validateWaterskinDrinkAction(state, action, actor) {
  const requestedItemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : null;
  const drinkableStack = resolveWaterskinDrinkableStack(actor, requestedItemId);
  if (!drinkableStack) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'waterskin_drink requires a filled waterskin in inventory',
      requiredItemId: waterskinItemIdFor('safe', 1),
    };
  }

  const parsed = parseWaterskinItemId(drinkableStack.itemId);
  if (!parsed || parsed.drinks <= 0 || !parsed.sourceType) {
    return {
      ok: false,
      code: 'invalid_item_reference',
      message: 'waterskin_drink requires a valid waterskin state item',
    };
  }

  const remainingDrinks = parsed.drinks - 1;
  const toItemId = waterskinItemIdFor(parsed.sourceType, remainingDrinks);
  if (!toItemId) {
    return {
      ok: false,
      code: 'invalid_item_reference',
      message: 'waterskin_drink could not resolve next waterskin state',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        itemId: drinkableStack.itemId,
        sourceType: parsed.sourceType,
        drinksBefore: parsed.drinks,
        drinksAfter: remainingDrinks,
        toItemId,
      },
    },
  };
}

function normalizeTickCost(kind, payload) {
  const requested = Number(payload?.tickCost);
  if (Number.isInteger(requested) && requested >= 0) {
    return requested;
  }
  const mapped = ACTION_TICK_COST[kind];
  return Number.isInteger(mapped) && mapped >= 0 ? mapped : 1;
}

function collectAdjacentFishableWaterTargets(state, actor) {
  const actorX = Number(actor?.x);
  const actorY = Number(actor?.y);
  if (!Number.isInteger(actorX) || !Number.isInteger(actorY)) {
    return [];
  }

  const targets = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const x = actorX + dx;
      const y = actorY + dy;
      if (!inBounds(state, x, y)) {
        continue;
      }

      const tile = getTile(state, x, y);
      if (!tile || !tile.waterType || tile.waterFrozen === true) {
        continue;
      }

      targets.push({ x, y });
    }
  }

  return targets;
}

function validateFishRodCastAction(state, action, actor) {
  if (!hasInventoryItem(actor, 'tool:fishing_rod')) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'fish_rod_cast requires tool:fishing_rod in inventory',
      requiredItemId: 'tool:fishing_rod',
    };
  }

  if (!Number.isInteger(action.tickCost) || action.tickCost < MIN_FISH_ROD_CAST_TICKS) {
    return {
      ok: false,
      code: 'invalid_tick_cost',
      message: `fish_rod_cast requires tickCost >= ${MIN_FISH_ROD_CAST_TICKS}`,
      minTickCost: MIN_FISH_ROD_CAST_TICKS,
    };
  }

  if (!actorCanSpendTickBudget(actor, action.tickCost)) {
    return {
      ok: false,
      code: 'no_tick_budget',
      message: `fish_rod_cast would exceed the daily tick overdraft limit (+${MAX_DAILY_TICK_OVERDRAFT})`,
    };
  }

  const targets = collectAdjacentFishableWaterTargets(state, actor);
  if (targets.length <= 0) {
    return {
      ok: false,
      code: 'fish_rod_cast_invalid_target',
      message: 'fish_rod_cast requires at least one adjacent unfrozen water tile',
    };
  }

  const baitItemIdRaw = typeof action.payload?.baitItemId === 'string'
    ? action.payload.baitItemId
    : '';
  const baitItemId = baitItemIdRaw ? baitItemIdRaw : null;
  if (baitItemId !== null) {
    if (baitItemId !== EARTHWORM_ITEM_ID) {
      return {
        ok: false,
        code: 'invalid_bait_item',
        message: `fish_rod_cast baitItemId must be ${EARTHWORM_ITEM_ID}`,
      };
    }

    if (!hasInventoryItem(actor, baitItemId, 1)) {
      return {
        ok: false,
        code: 'insufficient_item_quantity',
        message: `fish_rod_cast requires ${baitItemId} in inventory when baitItemId is provided`,
        requiredItemId: baitItemId,
      };
    }
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        baitItemId,
        fishableTargets: targets,
      },
      tickCost: action.tickCost,
    },
  };
}

function validateItemDropAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'item_drop_out_of_bounds', message: 'item_drop target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'item_drop target must be on current or adjacent tile',
    };
  }

  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  if (!itemId) {
    return {
      ok: false,
      code: 'invalid_item_drop_payload',
      message: 'item_drop requires payload.itemId',
    };
  }

  const quantityRaw = action.payload?.quantity;
  const quantity = quantityRaw == null
    ? 1
    : Number.isInteger(quantityRaw)
      ? quantityRaw
      : Math.floor(Number(quantityRaw));
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      ok: false,
      code: 'invalid_item_drop_payload',
      message: 'item_drop quantity must be a positive integer',
    };
  }

  const inventoryStack = findPreferredStackByItem(actor?.inventory?.stacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(inventoryStack?.quantity) || 0));
  if (available <= 0) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'item_drop requires available item quantity in actor inventory',
      requiredItemId: itemId,
    };
  }

  const dropQuantity = Math.min(quantity, available);
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
        itemId,
        quantity: dropQuantity,
      },
    },
  };
}

function validateItemPickupAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'item_pickup_out_of_bounds', message: 'item_pickup target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'item_pickup target must be on current or adjacent tile',
    };
  }

  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  if (!itemId) {
    return {
      ok: false,
      code: 'invalid_item_pickup_payload',
      message: 'item_pickup requires payload.itemId',
    };
  }

  const quantityRaw = action.payload?.quantity;
  const quantity = quantityRaw == null
    ? 1
    : Number.isInteger(quantityRaw)
      ? quantityRaw
      : Math.floor(Number(quantityRaw));
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      ok: false,
      code: 'invalid_item_pickup_payload',
      message: 'item_pickup quantity must be a positive integer',
    };
  }

  const tileKey = `${target.x},${target.y}`;
  const stacks = Array.isArray(state?.worldItemsByTile?.[tileKey]) ? state.worldItemsByTile[tileKey] : [];
  const stack = findPreferredStackByItem(stacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
  if (available <= 0) {
    return {
      ok: false,
      code: 'item_pickup_missing_item',
      message: 'item_pickup target tile does not contain requested item',
    };
  }

  const pickupQuantity = Math.min(quantity, available);
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
        itemId,
        quantity: pickupQuantity,
      },
    },
  };
}

function resolveEatReturnItems(itemId, quantity) {
  const normalizedQty = Math.max(1, Math.floor(Number(quantity) || 1));
  if (itemId === SAP_FILLED_VESSEL_ITEM_ID) {
    return [{ itemId: SAP_EMPTY_VESSEL_ITEM_ID, quantity: normalizedQty }];
  }

  return [];
}

function validateTapRetrieveVesselAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'tap_retrieve_vessel_out_of_bounds', message: 'tap_retrieve_vessel target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'tap_retrieve_vessel target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile?.sapTap?.hasVessel !== true) {
    return {
      ok: false,
      code: 'tap_retrieve_vessel_missing_vessel',
      message: 'tap_retrieve_vessel target must contain an attached vessel',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        x: target.x,
        y: target.y,
      },
    },
  };
}

function hasCardinalAdjacentFishableWater(state, x, y) {
  const offsets = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(state, nx, ny)) {
      continue;
    }
    const tile = getTile(state, nx, ny);
    if (tile?.waterType && tile.waterFrozen !== true) {
      return true;
    }
  }
  return false;
}

function validateAutoRodPlaceAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'auto_rod_place_out_of_bounds', message: 'auto_rod_place target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'auto_rod_place target must be on current or adjacent tile',
    };
  }

  if (!hasInventoryItem(actor, 'tool:auto_rod')) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'auto_rod_place requires tool:auto_rod in inventory',
      requiredItemId: 'tool:auto_rod',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile.rockType || tile.waterType) {
    return {
      ok: false,
      code: 'auto_rod_place_invalid_target',
      message: 'auto_rod_place target must be a non-rock land tile',
    };
  }

  if (Array.isArray(tile.plantIds) && tile.plantIds.length > 0) {
    return {
      ok: false,
      code: 'auto_rod_place_tile_occupied',
      message: 'auto_rod_place target tile already contains plants',
    };
  }

  if (tile?.autoRod?.active === true) {
    return {
      ok: false,
      code: 'auto_rod_place_already_present',
      message: 'auto_rod_place target already contains an active auto rod',
    };
  }

  if (!hasCardinalAdjacentFishableWater(state, target.x, target.y)) {
    return {
      ok: false,
      code: 'auto_rod_place_invalid_target',
      message: 'auto_rod_place target must be cardinally adjacent to at least one unfrozen water tile',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        x: target.x,
        y: target.y,
      },
    },
  };
}

function validateTrapPlaceFishWeirAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'trap_place_fish_weir_out_of_bounds', message: 'trap_place_fish_weir target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'trap_place_fish_weir target must be on current or adjacent tile',
    };
  }

  if (!hasInventoryItem(actor, 'tool:fish_trap_weir')) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'trap_place_fish_weir requires tool:fish_trap_weir in inventory',
      requiredItemId: 'tool:fish_trap_weir',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile.waterType !== 'river') {
    return {
      ok: false,
      code: 'trap_place_fish_weir_invalid_target',
      message: 'trap_place_fish_weir target must be moving water (river)',
    };
  }

  if (tile.waterFrozen === true) {
    return {
      ok: false,
      code: 'trap_place_fish_weir_invalid_target',
      message: 'trap_place_fish_weir target cannot be frozen water',
    };
  }

  if (tile?.fishTrap?.active === true) {
    return {
      ok: false,
      code: 'trap_place_fish_weir_already_present',
      message: 'trap_place_fish_weir target already contains an active fish trap',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        x: target.x,
        y: target.y,
      },
    },
  };
}

function validateTrapPlaceDeadfallAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'trap_place_deadfall_out_of_bounds', message: 'trap_place_deadfall target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'trap_place_deadfall target must be on current or adjacent tile',
    };
  }

  if (!hasInventoryItem(actor, 'tool:dead_fall_trap')) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'trap_place_deadfall requires tool:dead_fall_trap in inventory',
      requiredItemId: 'tool:dead_fall_trap',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile.rockType || tile.waterType) {
    return {
      ok: false,
      code: 'trap_place_deadfall_invalid_target',
      message: 'trap_place_deadfall target must be a non-rock land tile',
    };
  }

  if (Array.isArray(tile.plantIds) && tile.plantIds.length > 0) {
    return {
      ok: false,
      code: 'trap_place_deadfall_tile_occupied',
      message: 'trap_place_deadfall target tile already contains plants',
    };
  }

  if (tile?.simpleSnare?.active === true || tile?.deadfallTrap?.active === true) {
    return {
      ok: false,
      code: 'trap_place_deadfall_already_present',
      message: 'trap_place_deadfall target already contains an active trap',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        x: target.x,
        y: target.y,
      },
    },
  };
}

function validateTrapCheckAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'trap_check_out_of_bounds', message: 'trap_check target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'trap_check target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  const hasSimpleSnare = tile?.simpleSnare?.active === true;
  const hasDeadfallTrap = tile?.deadfallTrap?.active === true;
  const hasFishTrap = tile?.fishTrap?.active === true;
  const hasAutoRod = tile?.autoRod?.active === true;
  if (!tile || (!hasSimpleSnare && !hasDeadfallTrap && !hasFishTrap && !hasAutoRod)) {
    return {
      ok: false,
      code: 'trap_check_invalid_target',
      message: 'trap_check target must contain an active trap or auto rod',
    };
  }

  const baitItemIdRaw = typeof action.payload?.baitItemId === 'string'
    ? action.payload.baitItemId
    : '';
  const baitItemId = baitItemIdRaw ? baitItemIdRaw : null;
  if (baitItemId !== null) {
    if (!hasAutoRod) {
      return {
        ok: false,
        code: 'trap_check_invalid_target',
        message: 'trap_check baitItemId can only be used on auto rod targets',
      };
    }

    if (baitItemId !== EARTHWORM_ITEM_ID) {
      return {
        ok: false,
        code: 'invalid_bait_item',
        message: `trap_check baitItemId must be ${EARTHWORM_ITEM_ID}`,
      };
    }

    if (!hasInventoryItem(actor, baitItemId, 1)) {
      return {
        ok: false,
        code: 'insufficient_item_quantity',
        message: `trap_check requires ${baitItemId} in inventory when baitItemId is provided`,
        requiredItemId: baitItemId,
      };
    }
  }

  const repair = action.payload?.repair === true;
  if (repair) {
    if (!hasAutoRod) {
      return {
        ok: false,
        code: 'trap_check_invalid_target',
        message: 'trap_check repair can only be used on auto rod targets',
      };
    }

    if (tile?.autoRod?.state !== 'broken') {
      return {
        ok: false,
        code: 'trap_check_invalid_repair_target',
        message: 'trap_check repair requires broken auto rod state',
      };
    }

    if (!hasInventoryItem(actor, 'tool:bone_hook', 1)) {
      return {
        ok: false,
        code: 'insufficient_item_quantity',
        message: 'trap_check repair requires tool:bone_hook in inventory',
        requiredItemId: 'tool:bone_hook',
      };
    }

    if (!hasInventoryItem(actor, 'cordage', 1)) {
      return {
        ok: false,
        code: 'insufficient_item_quantity',
        message: 'trap_check repair requires cordage in inventory',
        requiredItemId: 'cordage',
      };
    }
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        x: target.x,
        y: target.y,
        baitItemId: hasAutoRod ? baitItemId : null,
        repair: hasAutoRod ? repair : null,
      },
    },
  };
}

function validateTrapBaitAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'trap_bait_out_of_bounds', message: 'trap_bait target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'trap_bait target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  const hasSimpleSnare = tile?.simpleSnare?.active === true;
  const hasDeadfallTrap = tile?.deadfallTrap?.active === true;
  if (!tile || (!hasSimpleSnare && !hasDeadfallTrap)) {
    return {
      ok: false,
      code: 'trap_bait_invalid_target',
      message: 'trap_bait target must contain an active simple snare or deadfall trap',
    };
  }

  if (hasSimpleSnare && landTrapHasBait(tile.simpleSnare)) {
    return {
      ok: false,
      code: 'trap_bait_already_baited',
      message: 'trap_bait target already baited',
    };
  }
  if (hasDeadfallTrap && landTrapHasBait(tile.deadfallTrap)) {
    return {
      ok: false,
      code: 'trap_bait_already_baited',
      message: 'trap_bait target already baited',
    };
  }

  const baitItemIdRaw = typeof action.payload?.baitItemId === 'string' ? action.payload.baitItemId : '';
  const baitItemId = baitItemIdRaw ? baitItemIdRaw : null;
  if (!baitItemId) {
    return {
      ok: false,
      code: 'trap_bait_missing_item',
      message: 'trap_bait requires baitItemId (a harvested plant-part item)',
    };
  }
  if (!hasInventoryItem(actor, baitItemId, 1)) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'trap_bait requires the bait item in inventory',
      requiredItemId: baitItemId,
    };
  }

  const plantSpeciesId = parseLandTrapBaitPlantSpeciesId(baitItemId);
  if (!plantSpeciesId) {
    return {
      ok: false,
      code: 'trap_bait_invalid_item',
      message: 'trap_bait requires a harvested plant-part item (species:part:substage)',
    };
  }

  if (hasSimpleSnare && !hasDeadfallTrap) {
    if (!plantSpeciesEligibleForSimpleSnareBait(plantSpeciesId)) {
      return {
        ok: false,
        code: 'trap_bait_not_in_target_diet',
        message: 'trap_bait plant species is not in this trap target\'s diet',
      };
    }
  } else if (hasDeadfallTrap && !hasSimpleSnare) {
    if (!plantSpeciesEligibleForDeadfallLandBait(plantSpeciesId)) {
      return {
        ok: false,
        code: 'trap_bait_not_in_target_diet',
        message: 'trap_bait plant species is not eaten by any animal this deadfall can catch',
      };
    }
  } else {
    return {
      ok: false,
      code: 'trap_bait_invalid_target',
      message: 'trap_bait requires exactly one active land trap on the tile',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        x: target.x,
        y: target.y,
        baitItemId,
      },
    },
  };
}

function validateTrapRetrieveAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'trap_retrieve_out_of_bounds', message: 'trap_retrieve target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'trap_retrieve target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  const snare = tile?.simpleSnare?.active === true ? tile.simpleSnare : null;
  const deadfall = tile?.deadfallTrap?.active === true ? tile.deadfallTrap : null;
  const fishTrap = tile?.fishTrap?.active === true ? tile.fishTrap : null;

  const hasSnareCatch = snare && snare.hasCatch === true;
  const hasDeadfallCatch = deadfall && deadfall.hasCatch === true;
  const fishStored = fishTrap && Array.isArray(fishTrap.storedCatchSpeciesIds)
    ? fishTrap.storedCatchSpeciesIds.filter((id) => typeof id === 'string' && id)
    : [];
  const hasFish = fishStored.length > 0;

  if (!hasSnareCatch && !hasDeadfallCatch && !hasFish) {
    return {
      ok: false,
      code: 'trap_retrieve_nothing',
      message: 'trap_retrieve requires a catch to collect (snare, deadfall, or fish weir)',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: { x: target.x, y: target.y },
      tickCost: ACTION_TICK_COST.trap_retrieve,
    },
  };
}

function validateTrapPickupAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'trap_pickup_out_of_bounds', message: 'trap_pickup target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'trap_pickup target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  const snare = tile?.simpleSnare?.active === true ? tile.simpleSnare : null;
  const deadfall = tile?.deadfallTrap?.active === true ? tile.deadfallTrap : null;
  const fishTrap = tile?.fishTrap?.active === true ? tile.fishTrap : null;
  const autoRod = tile?.autoRod?.active === true ? tile.autoRod : null;

  const nLand = (snare ? 1 : 0) + (deadfall ? 1 : 0);
  const nFish = fishTrap ? 1 : 0;
  const nAutoRod = autoRod ? 1 : 0;
  if (nLand + nFish + nAutoRod !== 1) {
    return {
      ok: false,
      code: 'trap_pickup_invalid_target',
      message: 'trap_pickup requires exactly one active snare, deadfall, fish weir, or auto rod on the tile',
    };
  }

  if (snare) {
    if (snare.hasCatch === true) {
      return {
        ok: false,
        code: 'trap_pickup_blocked_catch',
        message: 'trap_pickup requires retrieving the catch before picking up the snare',
      };
    }
  }
  if (deadfall) {
    if (deadfall.hasCatch === true) {
      return {
        ok: false,
        code: 'trap_pickup_blocked_catch',
        message: 'trap_pickup requires retrieving the catch before picking up the deadfall',
      };
    }
  }
  if (fishTrap) {
    const stored = Array.isArray(fishTrap.storedCatchSpeciesIds)
      ? fishTrap.storedCatchSpeciesIds.filter((id) => typeof id === 'string' && id)
      : [];
    if (stored.length > 0) {
      return {
        ok: false,
        code: 'trap_pickup_blocked_catch',
        message: 'trap_pickup requires retrieving stored fish before picking up the weir',
      };
    }
  }
  if (autoRod) {
    const pending = Array.isArray(autoRod.pendingSpeciesIds)
      ? autoRod.pendingSpeciesIds.filter((id) => typeof id === 'string' && id)
      : [];
    if (pending.length > 0) {
      return {
        ok: false,
        code: 'trap_pickup_blocked_catch',
        message: 'trap_pickup requires checking the auto rod to collect fish before picking it up',
      };
    }
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: { x: target.x, y: target.y },
      tickCost: ACTION_TICK_COST.trap_pickup,
    },
  };
}

function validateTrapRemoveBaitAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'trap_remove_bait_out_of_bounds', message: 'trap_remove_bait target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'trap_remove_bait target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  const snare = tile?.simpleSnare?.active === true ? tile.simpleSnare : null;
  const deadfall = tile?.deadfallTrap?.active === true ? tile.deadfallTrap : null;

  const nLand = (snare ? 1 : 0) + (deadfall ? 1 : 0);
  if (nLand !== 1) {
    return {
      ok: false,
      code: 'trap_remove_bait_invalid_target',
      message: 'trap_remove_bait requires exactly one active snare or deadfall on the tile',
    };
  }

  const trap = snare || deadfall;
  if (!landTrapHasBait(trap)) {
    return {
      ok: false,
      code: 'trap_remove_bait_empty',
      message: 'trap_remove_bait requires bait on the trap',
    };
  }

  if (snare && snare.hasCatch === true) {
    return {
      ok: false,
      code: 'trap_remove_bait_blocked_catch',
      message: 'trap_remove_bait cannot be used while the snare holds a catch',
    };
  }
  if (deadfall && deadfall.hasCatch === true) {
    return {
      ok: false,
      code: 'trap_remove_bait_blocked_catch',
      message: 'trap_remove_bait cannot be used while the deadfall holds a catch',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: { x: target.x, y: target.y },
      tickCost: ACTION_TICK_COST.trap_remove_bait,
    },
  };
}

function validateMarkerPlaceAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'marker_place_out_of_bounds', message: 'marker_place target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'marker_place target must be on current or adjacent tile',
    };
  }

  if (!hasInventoryItem(actor, 'tool:marker_stick', 1)) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'marker_place requires tool:marker_stick in inventory',
      requiredItemId: 'tool:marker_stick',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile) {
    return { ok: false, code: 'marker_place_invalid_target', message: 'marker_place requires a valid tile' };
  }
  if (tile.markerStick === true) {
    return { ok: false, code: 'marker_place_already_present', message: 'marker_place target already has a marker stick' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        x: target.x,
        y: target.y,
      },
    },
  };
}

function validateMarkerRemoveAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'marker_remove_out_of_bounds', message: 'marker_remove target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'marker_remove target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile.markerStick !== true) {
    return { ok: false, code: 'marker_remove_missing', message: 'marker_remove requires an existing marker stick on the target tile' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        x: target.x,
        y: target.y,
      },
    },
  };
}

function validateTrapPlaceSnareAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'trap_place_snare_out_of_bounds', message: 'trap_place_snare target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'trap_place_snare target must be on current or adjacent tile',
    };
  }

  if (!hasInventoryItem(actor, 'tool:simple_snare')) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'trap_place_snare requires tool:simple_snare in inventory',
      requiredItemId: 'tool:simple_snare',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile.rockType || tile.waterType) {
    return {
      ok: false,
      code: 'trap_place_snare_invalid_target',
      message: 'trap_place_snare target must be a non-rock land tile',
    };
  }

  if (Array.isArray(tile.plantIds) && tile.plantIds.length > 0) {
    return {
      ok: false,
      code: 'trap_place_snare_tile_occupied',
      message: 'trap_place_snare target tile already contains plants',
    };
  }

  if (tile?.simpleSnare?.active === true || tile?.deadfallTrap?.active === true) {
    return {
      ok: false,
      code: 'trap_place_snare_already_present',
      message: 'trap_place_snare target already contains an active trap',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
      },
    },
  };
}

function getRequiredUnlockForAction(kind) {
  return typeof ACTION_REQUIRED_UNLOCK[kind] === 'string'
    ? ACTION_REQUIRED_UNLOCK[kind]
    : null;
}

function isActionUnlocked(state, kind) {
  const unlockKey = getRequiredUnlockForAction(kind);
  if (!unlockKey) {
    return { unlocked: true, unlockKey: null };
  }
  return {
    unlocked: isUnlockEnabled(state, unlockKey),
    unlockKey,
  };
}

function validateTapPlaceVesselAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'tap_place_vessel_out_of_bounds', message: 'tap_place_vessel target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'tap_place_vessel target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile?.sapTap?.hasSpout !== true) {
    return {
      ok: false,
      code: 'tap_place_vessel_missing_spout',
      message: 'tap_place_vessel target must contain an inserted spout',
    };
  }

  if (tile?.sapTap?.hasVessel === true) {
    return {
      ok: false,
      code: 'tap_place_vessel_already_present',
      message: 'tap_place_vessel target already has an attached vessel',
    };
  }

  if (!hasInventoryItem(actor, 'tool:hide_pitch_vessel')) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'tap_place_vessel requires tool:hide_pitch_vessel in inventory',
      requiredItemId: 'tool:hide_pitch_vessel',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
      },
    },
  };
}

function validateTapRemoveSpoutAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'tap_remove_spout_out_of_bounds', message: 'tap_remove_spout target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'tap_remove_spout target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile?.sapTap?.hasSpout !== true) {
    return {
      ok: false,
      code: 'tap_remove_spout_missing_spout',
      message: 'tap_remove_spout target must contain an inserted spout',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
      },
    },
  };
}

function hasTappableMatureTreeOnTile(state, tile) {
  const plantIds = Array.isArray(tile?.plantIds) ? tile.plantIds : [];
  for (const plantId of plantIds) {
    const plant = state?.plants?.[plantId];
    if (!plant || plant.alive !== true) {
      continue;
    }
    if (!TAPPABLE_TREE_SPECIES_IDS.has(plant.speciesId)) {
      continue;
    }
    if (typeof plant.stageName !== 'string' || !plant.stageName.startsWith('mature_')) {
      continue;
    }
    return true;
  }
  return false;
}

function validateTapInsertSpoutAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'tap_insert_spout_out_of_bounds', message: 'tap_insert_spout target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'tap_insert_spout target must be on current or adjacent tile',
    };
  }

  if (!hasInventoryItem(actor, 'tool:flint_knife')) {
    return {
      ok: false,
      code: 'missing_required_tool',
      message: 'tap_insert_spout requires tool:flint_knife in inventory',
      requiredToolId: 'tool:flint_knife',
    };
  }

  if (!hasInventoryItem(actor, 'tool:carved_wooden_spout')) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'tap_insert_spout requires tool:carved_wooden_spout in inventory',
      requiredItemId: 'tool:carved_wooden_spout',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || !hasTappableMatureTreeOnTile(state, tile)) {
    return {
      ok: false,
      code: 'tap_insert_spout_invalid_target',
      message: 'tap_insert_spout target must contain a tappable mature tree',
    };
  }

  if (tile?.sapTap?.hasSpout === true) {
    return {
      ok: false,
      code: 'tap_insert_spout_already_present',
      message: 'tap_insert_spout target already has an inserted spout',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
      },
    },
  };
}

function validateHoeAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'hoe_out_of_bounds', message: 'hoe target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'hoe target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile.rockType) {
    return { ok: false, code: 'hoe_blocked_tile', message: 'hoe target must not be a rock tile' };
  }

  if (tile.waterType && tile.waterDepth !== 'shallow') {
    return { ok: false, code: 'hoe_blocked_tile', message: 'hoe target may only be land or shallow water' };
  }

  if (!hasInventoryItem(actor, 'tool:hoe')) {
    return { ok: false, code: 'missing_required_tool', message: 'hoe requires tool:hoe in inventory' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
      },
    },
  };
}

function resolveFieldEdibilityScore(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return 0;
  }

  const parts = itemId.split(':');
  if (parts.length === 3) {
    const [speciesId, partName, subStageId] = parts;
    const species = PLANT_BY_ID[speciesId];
    if (!species) {
      return resolveCatalogFieldEdibilityScore(itemId);
    }

    const sourcePart = (species.parts || []).find((entry) => entry?.name === partName);
    const sourceSubStage = (sourcePart?.subStages || []).find((entry) => entry?.id === subStageId);
    if (!sourcePart || !sourceSubStage) {
      return resolveCatalogFieldEdibilityScore(itemId);
    }

    const score = Number(sourceSubStage.edibility_score);
    return Number.isFinite(score) ? score : 0;
  }

  if (parts.length === 2) {
    const [speciesId, partId] = parts;
    if (partId === 'carcass' || partId === 'fish_carcass') {
      return 0;
    }

    const species = ANIMAL_BY_ID[speciesId];
    if (!species) {
      return resolveCatalogFieldEdibilityScore(itemId);
    }

    const sourcePart = (species.parts || []).find((entry) => entry?.id === partId);
    if (!sourcePart) {
      return resolveCatalogFieldEdibilityScore(itemId);
    }

    const score = Number(sourcePart.edibility_score);
    return Number.isFinite(score) ? score : 0;
  }

  return resolveCatalogFieldEdibilityScore(itemId);
}

function buildCampStockpileQuantityMap(state) {
  const map = {};
  const stacks = Array.isArray(state?.camp?.stockpile?.stacks) ? state.camp.stockpile.stacks : [];
  for (const stack of stacks) {
    const itemId = typeof stack?.itemId === 'string' ? stack.itemId : '';
    const quantity = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
    if (!itemId || quantity <= 0) {
      continue;
    }
    map[itemId] = (map[itemId] || 0) + quantity;
  }
  return map;
}

function normalizeMealIngredients(rawIngredients) {
  if (!Array.isArray(rawIngredients)) {
    return [];
  }
  const byItemId = new Map();
  for (const entry of rawIngredients) {
    const itemId = typeof entry?.itemId === 'string' ? entry.itemId : '';
    const quantity = Number.isInteger(entry?.quantity)
      ? entry.quantity
      : Math.floor(Number(entry?.quantity || 0));
    if (!itemId || quantity <= 0) {
      continue;
    }
    byItemId.set(itemId, (byItemId.get(itemId) || 0) + quantity);
  }
  return Array.from(byItemId.entries()).map(([itemId, quantity]) => ({ itemId, quantity }));
}

function resolveStewIngredientDescriptor(itemId) {
  return resolveStewIngredientDescriptorShared(itemId);
}

function getActorDailyCalorieRequirement(actor) {
  const explicit = Number(actor?.dailyCalorieRequirement);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const ageYears = Number(actor?.ageYears);
  if (Number.isFinite(ageYears) && ageYears >= 0) {
    if (ageYears <= 5) {
      return 800;
    }
    if (ageYears <= 10) {
      return 1200;
    }
    if (ageYears <= 20) {
      return 1600;
    }
  }

  const role = String(actor?.role || '').toLowerCase();
  if (role.includes('child')) {
    return STEW_DAILY_CALORIES_CHILD_DEFAULT;
  }
  return STEW_DAILY_CALORIES_ADULT;
}

function extractActorNauseaCap(actor) {
  const conditions = Array.isArray(actor?.conditions) ? actor.conditions : [];
  let cap = 1;
  for (const condition of conditions) {
    const effects = Array.isArray(condition?.effects) ? condition.effects : [];
    for (const effect of effects) {
      if (effect?.type !== 'nausea_ceiling_cap') {
        continue;
      }
      const value = normalizeUnitInterval(effect?.value);
      if (Number.isFinite(value)) {
        cap = Math.min(cap, value);
      }
    }
  }
  return cap;
}

function computeMealMonotonyScore(ingredientsWithDescriptor) {
  if (ingredientsWithDescriptor.length <= 1) {
    return 80;
  }
  const totalCalories = ingredientsWithDescriptor.reduce((sum, entry) => sum + entry.totalNutrition.calories, 0);
  if (totalCalories <= 0) {
    return 0;
  }

  const familyShares = {};
  const flavorShares = {};
  for (const entry of ingredientsWithDescriptor) {
    const share = entry.totalNutrition.calories / totalCalories;
    familyShares[entry.descriptor.familyKey] = (familyShares[entry.descriptor.familyKey] || 0) + share;
    flavorShares[entry.descriptor.flavorKey] = (flavorShares[entry.descriptor.flavorKey] || 0) + share;
  }

  const familyConcentration = Object.values(familyShares)
    .reduce((sum, share) => sum + (share * share), 0);
  const flavorConcentration = Object.values(flavorShares)
    .reduce((sum, share) => sum + (share * share), 0);
  const score = ((familyConcentration * 0.7) + (flavorConcentration * 0.3)) * 100;
  return Math.max(0, Math.min(100, score));
}

function getMealVarietyBand(monotonyScore) {
  if (monotonyScore <= 25) {
    return { label: 'varied', nauseaGain: 0 };
  }
  if (monotonyScore <= 55) {
    return { label: 'repetitive', nauseaGain: STEW_NAUSEA_GAIN_REPETITIVE };
  }
  return { label: 'monotonous', nauseaGain: STEW_NAUSEA_GAIN_MONOTONOUS };
}

/** Plant-part stew ingredients: scale nutrition by stockpile mass vs catalog `unit_weight_g` (handles age-scaled harvest weight). */
function stockpilePlantPartMassNutritionScale(state, itemId, quantity) {
  const descriptor = parsePlantPartItemId(itemId);
  if (!descriptor) {
    return 1;
  }
  const catalogGrams = Number(descriptor.subStage?.unit_weight_g);
  if (!Number.isFinite(catalogGrams) || catalogGrams <= 0) {
    return 1;
  }
  const catalogKgPerUnit = catalogGrams / 1000;
  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  const expectedKg = q * catalogKgPerUnit;

  const stacks = Array.isArray(state?.camp?.stockpile?.stacks) ? state.camp.stockpile.stacks : [];
  let need = q;
  let actualKg = 0;
  for (const stack of stacks) {
    if (stack?.itemId !== itemId || need <= 0) {
      continue;
    }
    const avail = Math.max(0, Math.floor(Number(stack.quantity) || 0));
    if (avail <= 0) {
      continue;
    }
    const take = Math.min(need, avail);
    const stackKg = Number.isFinite(Number(stack.unitWeightKg)) && Number(stack.unitWeightKg) >= 0
      ? Number(stack.unitWeightKg)
      : catalogKgPerUnit;
    actualKg += take * stackKg;
    need -= take;
  }
  if (need > 0) {
    actualKg += need * catalogKgPerUnit;
  }
  if (expectedKg <= 0) {
    return 1;
  }
  return actualKg / expectedKg;
}

function buildMealPlanPreview(state, normalizedIngredients) {
  const nauseaByIngredient = state?.camp?.nauseaByIngredient && typeof state.camp.nauseaByIngredient === 'object'
    ? state.camp.nauseaByIngredient
    : {};

  const ingredientsWithDescriptor = normalizedIngredients
    .map((ingredient) => {
      const descriptor = resolveStewIngredientDescriptor(ingredient.itemId);
      if (!descriptor) {
        return null;
      }
      const q = Math.max(1, Math.floor(Number(ingredient.quantity) || 1));
      const extraction = Math.max(0, Number(descriptor.extraction) || 0);
      const massScale = stockpilePlantPartMassNutritionScale(state, ingredient.itemId, q);
      return {
        itemId: ingredient.itemId,
        quantity: q,
        descriptor,
        totalNutrition: {
          calories: (Number(descriptor.nutrition.calories) || 0) * q * extraction * massScale * (Number(descriptor.stewNutritionFactor) || 0),
          protein: (Number(descriptor.nutrition.protein) || 0) * q * extraction * massScale * (Number(descriptor.stewNutritionFactor) || 0),
          carbs: (Number(descriptor.nutrition.carbs) || 0) * q * extraction * massScale * (Number(descriptor.stewNutritionFactor) || 0),
          fat: (Number(descriptor.nutrition.fat) || 0) * q * extraction * massScale * (Number(descriptor.stewNutritionFactor) || 0),
        },
      };
    })
    .filter(Boolean);

  const totalNutrition = ingredientsWithDescriptor.reduce((sum, entry) => ({
    calories: sum.calories + entry.totalNutrition.calories,
    protein: sum.protein + entry.totalNutrition.protein,
    carbs: sum.carbs + entry.totalNutrition.carbs,
    fat: sum.fat + entry.totalNutrition.fat,
  }), {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });

  const weighted = ingredientsWithDescriptor.reduce((acc, entry) => {
    const calories = entry.totalNutrition.calories;
    acc.totalCalories += calories;
    acc.edibilityNumerator += (Number(entry.descriptor.edibilityScore) || 0.5) * calories;
    acc.harshnessNumerator += (Number(entry.descriptor.harshness) || 0) * calories;
    const nauseaValue = Math.max(0, Math.min(100, Number(nauseaByIngredient[entry.itemId]) || 0));
    const nauseaCeiling = nauseaValue > 50 ? Math.max(0, 1 - ((nauseaValue - 50) / 50)) : 1;
    acc.nauseaCeiling = Math.min(acc.nauseaCeiling, nauseaCeiling);
    return acc;
  }, {
    totalCalories: 0,
    edibilityNumerator: 0,
    harshnessNumerator: 0,
    nauseaCeiling: 1,
  });

  const weightedEdibility = weighted.totalCalories > 0
    ? weighted.edibilityNumerator / weighted.totalCalories
    : 1;
  const weightedHarshness = weighted.totalCalories > 0
    ? weighted.harshnessNumerator / weighted.totalCalories
    : 0;

  // Edibility model:
  // - `descriptor.edibilityScore` is interpreted as: "maximum fraction of a (dailyCalories) meal
  //   that can come from this ingredient" (composition constraint).
  // - Eating is modeled as consuming a proportional mixture of the stew, so for a target meal size E:
  //     E * (ingredientCalories / totalCalories) <= ingredientEdibility * dailyCalories
  //   => E <= ingredientEdibility * dailyCalories * (totalCalories / ingredientCalories)
  // - We additionally fold in harshness as a small reduction to the ingredient's effective ceiling.
  function ingredientEffectiveCeiling(descriptor) {
    const rawEdibility = Number(descriptor?.edibilityScore);
    const rawHarshness = Number(descriptor?.harshness);
    const e = Number.isFinite(rawEdibility) ? rawEdibility : 0.5;
    const h = Number.isFinite(rawHarshness) ? rawHarshness : 0;
    return Math.max(0, Math.min(1, e - (h * 0.5)));
  }

  function computeEdibilityIntakeCapCalories(dailyCalories) {
    const totalCalories = totalNutrition.calories;
    if (!(totalCalories > 0) || !(dailyCalories > 0)) {
      return Infinity;
    }
    let cap = Infinity;
    for (const entry of ingredientsWithDescriptor) {
      const ingredientCalories = Number(entry?.totalNutrition?.calories) || 0;
      if (!(ingredientCalories > 0)) {
        continue;
      }
      const ceiling = ingredientEffectiveCeiling(entry.descriptor);
      const ingredientMealCap = ceiling * dailyCalories;
      const eMax = ingredientMealCap * (totalCalories / ingredientCalories);
      if (Number.isFinite(eMax)) {
        cap = Math.min(cap, eMax);
      }
    }
    return cap;
  }

  // Keep the weighted values for UI/debugging, but edibility limiting now uses the per-ingredient cap above.
  const edibilityCeiling = Math.max(0, Math.min(1, weightedEdibility - (weightedHarshness * 0.5)));
  const monotonyScore = computeMealMonotonyScore(ingredientsWithDescriptor);
  const varietyBand = getMealVarietyBand(monotonyScore);

  const participants = Object.values(state?.actors || {})
    .filter((actor) => (Number(actor?.health) || 0) > 0)
    .filter((actor) => isActorWithinCampFootprint(state, actor));

  const participantRows = participants.map((actor) => {
    const dailyCalories = getActorDailyCalorieRequirement(actor);
    const hunger = normalizeUnitInterval(actor?.hunger);
    const deficitCalories = Math.max(0, (1 - hunger) * HUNGER_BAR_CALORIES);
    return {
      actorId: actor.id,
      dailyCalories,
      hunger,
      deficitCalories,
      nauseaCap: extractActorNauseaCap(actor),
    };
  });
  const totalRequirement = participantRows.reduce((sum, row) => sum + row.dailyCalories, 0);

  const perActor = participantRows.map((row) => {
    const shareCalories = totalRequirement > 0
      ? totalNutrition.calories * (row.dailyCalories / totalRequirement)
      : 0;
    const nauseaFraction = Math.max(0, Math.min(1, weighted.nauseaCeiling, row.nauseaCap));
    const edibilityIntakeCapCalories = computeEdibilityIntakeCapCalories(row.dailyCalories);
    // Total meal cap is based on hunger deficit (multi-day) and the stew's composition constraints (dailyCalories baseline).
    const intakeCaloriesCap = Math.max(0, Math.min(row.deficitCalories, edibilityIntakeCapCalories)) * nauseaFraction;
    const effectiveCalories = Math.max(0, Math.min(shareCalories, intakeCaloriesCap));
    let limitReason = null;
    if (effectiveCalories < shareCalories) {
      if (effectiveCalories < intakeCaloriesCap - 1e-6) {
        limitReason = 'share_limited';
      } else if (intakeCaloriesCap < row.deficitCalories - 1e-6) {
        limitReason = 'edibility_limited';
      } else {
        limitReason = 'hunger_full';
      }
    }

    return {
      actorId: row.actorId,
      dailyCalories: row.dailyCalories,
      shareCalories,
      effectiveCalories,
      deficitCalories: row.deficitCalories,
      hungerBefore: row.hunger,
      hungerGain: HUNGER_BAR_CALORIES > 0 ? (effectiveCalories / HUNGER_BAR_CALORIES) : 0,
      intakeFraction: nauseaFraction,
      edibilityCeiling,
      nauseaCeiling: weighted.nauseaCeiling,
      nauseaCap: row.nauseaCap,
      edibilityIntakeCapCalories: Number.isFinite(edibilityIntakeCapCalories) ? edibilityIntakeCapCalories : null,
      limitReason,
    };
  });

  const distributedCalories = perActor.reduce((sum, row) => sum + row.effectiveCalories, 0);
  const bonusEligible = totalNutrition.protein >= STEW_PROTEIN_BONUS_THRESHOLD_GRAMS
    && totalNutrition.fat >= STEW_FAT_BONUS_THRESHOLD_GRAMS;

  return {
    ingredients: ingredientsWithDescriptor.map((entry) => ({
      itemId: entry.itemId,
      quantity: entry.quantity,
      nauseaBefore: Math.max(0, Math.min(100, Number(nauseaByIngredient[entry.itemId]) || 0)),
      calories: entry.totalNutrition.calories,
      protein: entry.totalNutrition.protein,
      carbs: entry.totalNutrition.carbs,
      fat: entry.totalNutrition.fat,
    })),
    totalNutrition,
    perActor,
    distributedCalories,
    destroyedCalories: Math.max(0, totalNutrition.calories - distributedCalories),
    edibilityCeiling,
    nauseaCeiling: weighted.nauseaCeiling,
    monotonyScore,
    varietyLabel: varietyBand.label,
    nauseaGainPerUsedIngredient: varietyBand.nauseaGain,
    nauseaDecayPerAbsent: STEW_NAUSEA_DECAY_ABSENT_PER_DAY,
    bonusEligible,
    nextDayTickBonus: STEW_NEXT_DAY_TICK_BONUS,
  };
}

function validateMealPlanIngredientsAgainstCamp(state, normalizedIngredients) {
  const stockpileByItemId = buildCampStockpileQuantityMap(state);
  for (const ingredient of normalizedIngredients) {
    if (ingredient.itemId === 'rotting_organic') {
      return {
        ok: false,
        code: 'invalid_meal_ingredient',
        message: 'meal plan cannot include rotting_organic',
      };
    }
    const descriptor = resolveStewIngredientDescriptor(ingredient.itemId);
    if (!descriptor) {
      return {
        ok: false,
        code: 'invalid_meal_ingredient',
        message: `meal ingredient is not stew-eligible: ${ingredient.itemId}`,
      };
    }
    const available = Math.max(0, Math.floor(Number(stockpileByItemId[ingredient.itemId]) || 0));
    if (available < ingredient.quantity) {
      return {
        ok: false,
        code: 'insufficient_item_quantity',
        message: `camp stockpile has insufficient ${ingredient.itemId} for meal plan`,
        requiredItemId: ingredient.itemId,
      };
    }
    const nausea = Math.max(0, Math.min(100, Number(state?.camp?.nauseaByIngredient?.[ingredient.itemId]) || 0));
    if (nausea > 80) {
      return {
        ok: false,
        code: 'meal_ingredient_nausea_blocked',
        message: `meal ingredient blocked by high nausea: ${ingredient.itemId}`,
        blockedItemId: ingredient.itemId,
      };
    }
  }
  return { ok: true, code: null, message: 'ok' };
}

function validateMealPlanSetAction(state, action, actor) {
  if (!isActorWithinCampFootprint(state, actor)) {
    return {
      ok: false,
      code: 'actor_not_at_camp',
      message: 'meal_plan_set requires actor within camp',
    };
  }

  const normalizedIngredients = normalizeMealIngredients(action.payload?.ingredients);
  const ingredientCheck = validateMealPlanIngredientsAgainstCamp(state, normalizedIngredients);
  if (!ingredientCheck.ok) {
    return ingredientCheck;
  }

  const preview = buildMealPlanPreview(state, normalizedIngredients);
  return {
    ok: true,
    code: null,
    message: 'ok',
    mealPlanPreview: preview,
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        ingredients: normalizedIngredients,
        mealPlanPreview: preview,
      },
    },
  };
}

function validateMealPlanCommitAction(state, action, actor) {
  if (!isActorWithinCampFootprint(state, actor)) {
    return {
      ok: false,
      code: 'actor_not_at_camp',
      message: 'meal_plan_commit requires actor within camp',
    };
  }

  const sourceIngredients = Array.isArray(action.payload?.ingredients)
    ? action.payload.ingredients
    : state?.camp?.mealPlan?.ingredients;
  const normalizedIngredients = normalizeMealIngredients(sourceIngredients);
  const ingredientCheck = validateMealPlanIngredientsAgainstCamp(state, normalizedIngredients);
  if (!ingredientCheck.ok) {
    return ingredientCheck;
  }

  const preview = buildMealPlanPreview(state, normalizedIngredients);
  if (!Array.isArray(preview.perActor) || preview.perActor.length <= 0) {
    return {
      ok: false,
      code: 'no_meal_participants',
      message: 'meal_plan_commit requires at least one living actor at camp',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    mealPlanPreview: preview,
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        ingredients: normalizedIngredients,
        mealPlanPreview: preview,
      },
    },
  };
}

function isDebriefActive(state) {
  return state?.camp?.debrief?.active === true;
}

function validateDebriefEnterAction(state, action, actor) {
  if (!isActorWithinCampFootprint(state, actor)) {
    return {
      ok: false,
      code: 'actor_not_at_camp',
      message: 'debrief_enter requires actor within camp',
    };
  }
  if (isDebriefActive(state)) {
    return {
      ok: false,
      code: 'debrief_already_active',
      message: 'debrief_enter rejected because debrief is already active',
    };
  }
  if ((Number(state?.dayTick) || 0) < NIGHTLY_DEBRIEF_START_TICK) {
    return {
      ok: false,
      code: 'debrief_not_available_yet',
      message: `debrief_enter requires dayTick >= ${NIGHTLY_DEBRIEF_START_TICK}`,
    };
  }
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {},
    },
  };
}

function validateDebriefExitAction(state, action, actor) {
  if (!isActorWithinCampFootprint(state, actor)) {
    return {
      ok: false,
      code: 'actor_not_at_camp',
      message: 'debrief_exit requires actor within camp',
    };
  }
  if (!isDebriefActive(state)) {
    return {
      ok: false,
      code: 'debrief_not_active',
      message: 'debrief_exit rejected because debrief is not active',
    };
  }
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {},
    },
  };
}

function validatePartnerMedicineAdministerAction(state, action, actor) {
  if (!isActorWithinCampFootprint(state, actor)) {
    return {
      ok: false,
      code: 'actor_not_at_camp',
      message: 'partner_medicine_administer requires actor within camp',
    };
  }
  if (!isDebriefActive(state)) {
    return {
      ok: false,
      code: 'medicine_not_in_debrief',
      message: 'partner_medicine_administer requires active nightly debrief',
    };
  }

  const rawConditionInstanceId = typeof action?.payload?.conditionInstanceId === 'string'
    ? action.payload.conditionInstanceId.trim()
    : '';
  const conditionInstanceId = rawConditionInstanceId || null;
  if (conditionInstanceId) {
    let targetCondition = null;
    for (const candidateActor of Object.values(state?.actors || {})) {
      const conditions = Array.isArray(candidateActor?.conditions) ? candidateActor.conditions : [];
      const found = conditions.find((entry) => entry?.instance_id === conditionInstanceId);
      if (found) {
        targetCondition = found;
        break;
      }
    }
    if (!targetCondition) {
      return {
        ok: false,
        code: 'unknown_condition_instance',
        message: `partner_medicine_administer unknown condition instance: ${conditionInstanceId}`,
      };
    }
    if (targetCondition.treated === true) {
      return {
        ok: false,
        code: 'condition_already_treated',
        message: `partner_medicine_administer condition already treated: ${conditionInstanceId}`,
      };
    }
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        conditionInstanceId,
      },
    },
  };
}

function validatePartnerVisionRequestAction(state, action, actor) {
  if (!isActorWithinCampFootprint(state, actor)) {
    return {
      ok: false,
      code: 'actor_not_at_camp',
      message: 'partner_vision_request requires actor within camp',
    };
  }
  if (!isDebriefActive(state)) {
    return {
      ok: false,
      code: 'vision_not_in_debrief',
      message: 'partner_vision_request requires active nightly debrief',
    };
  }
  const usesThisSeason = Number.isInteger(state?.camp?.debrief?.visionUsesThisSeason)
    ? state.camp.debrief.visionUsesThisSeason
    : 0;
  if (usesThisSeason >= 2) {
    return {
      ok: false,
      code: 'vision_cooldown_active',
      message: 'partner_vision_request blocked by seasonal cooldown',
    };
  }
  if (state?.camp?.debrief?.pendingVisionRevelation) {
    return {
      ok: false,
      code: 'vision_revelation_pending',
      message: 'partner_vision_request blocked until pending revelation is chosen',
    };
  }
  if (state?.camp?.debrief?.requiresVisionConfirmation === true) {
    return {
      ok: false,
      code: 'vision_confirmation_pending',
      message: 'partner_vision_request blocked until pending vision confirmation is resolved',
    };
  }
  const visionRecipes = resolveVisionRecipes(state);
  if (!Array.isArray(visionRecipes) || visionRecipes.length <= 0) {
    return {
      ok: false,
      code: 'vision_no_eligible_sources',
      message: 'No vision-eligible plants or ground fungi on the map (partner cannot prepare a vision).',
    };
  }
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {},
    },
  };
}

function validatePartnerVisionConfirmAction(state, action, actor) {
  if (!isActorWithinCampFootprint(state, actor)) {
    return {
      ok: false,
      code: 'actor_not_at_camp',
      message: 'partner_vision_confirm requires actor within camp',
    };
  }
  if (!isDebriefActive(state)) {
    return {
      ok: false,
      code: 'vision_not_in_debrief',
      message: 'partner_vision_confirm requires active nightly debrief',
    };
  }
  if (state?.camp?.debrief?.requiresVisionConfirmation !== true) {
    return {
      ok: false,
      code: 'missing_vision_confirmation',
      message: 'partner_vision_confirm requires pending vision confirmation options',
    };
  }
  const selectedItemId = typeof action?.payload?.itemId === 'string'
    ? action.payload.itemId.trim()
    : '';
  if (!selectedItemId) {
    return {
      ok: false,
      code: 'missing_vision_item_id',
      message: 'partner_vision_confirm requires payload.itemId',
    };
  }
  const options = Array.isArray(state?.camp?.debrief?.visionSelectionOptions)
    ? state.camp.debrief.visionSelectionOptions
    : [];
  const selected = options.find((entry) => entry?.itemId === selectedItemId) || null;
  if (!selected) {
    return {
      ok: false,
      code: 'invalid_vision_item_id',
      message: `partner_vision_confirm itemId is not in confirmation options: ${selectedItemId}`,
    };
  }
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        itemId: selectedItemId,
      },
    },
  };
}

function validatePartnerVisionChooseAction(state, action, actor) {
  if (!isActorWithinCampFootprint(state, actor)) {
    return {
      ok: false,
      code: 'actor_not_at_camp',
      message: 'partner_vision_choose requires actor within camp',
    };
  }
  if (!isDebriefActive(state)) {
    return {
      ok: false,
      code: 'vision_not_in_debrief',
      message: 'partner_vision_choose requires active nightly debrief',
    };
  }
  const categoryRaw = typeof action?.payload?.category === 'string'
    ? action.payload.category.trim().toLowerCase()
    : '';
  const category = categoryRaw || null;
  if (!category) {
    return {
      ok: false,
      code: 'missing_vision_category',
      message: 'partner_vision_choose requires payload.category',
    };
  }
  const pending = state?.camp?.debrief?.pendingVisionRevelation;
  if (!pending || typeof pending !== 'object') {
    return {
      ok: false,
      code: 'missing_pending_vision_revelation',
      message: 'partner_vision_choose requires pending revelation choices',
    };
  }
  const categories = Array.isArray(pending?.visionCategories)
    ? pending.visionCategories.map((entry) => String(entry || '').toLowerCase())
    : [];
  if (!categories.includes(category)) {
    return {
      ok: false,
      code: 'invalid_vision_category',
      message: `partner_vision_choose category is not available: ${category}`,
    };
  }
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        category,
      },
    },
  };
}

function validateNatureSightOverlaySetAction(state, action, actor) {
  const overlayRaw = typeof action?.payload?.overlay === 'string'
    ? action.payload.overlay.trim().toLowerCase()
    : '';
  const overlay = overlayRaw || null;
  if (!overlay || !NATURE_SIGHT_OVERLAYS.has(overlay)) {
    return {
      ok: false,
      code: 'invalid_nature_sight_overlay',
      message: 'nature_sight_overlay_set requires valid payload.overlay',
    };
  }
  const remaining = Number.isInteger(actor?.natureSightDaysRemaining)
    ? actor.natureSightDaysRemaining
    : Math.floor(Number(actor?.natureSightDaysRemaining || 0));
  if (remaining <= 0) {
    return {
      ok: false,
      code: 'nature_sight_not_active',
      message: 'nature_sight_overlay_set requires active Nature Sight',
    };
  }
  const selectedOnDay = Number.isInteger(actor?.natureSightOverlayChosenDay)
    ? actor.natureSightOverlayChosenDay
    : null;
  const currentDay = Number.isInteger(state?.totalDaysSimulated) ? state.totalDaysSimulated : 0;
  const currentOverlay = typeof actor?.natureSightOverlayChoice === 'string'
    ? actor.natureSightOverlayChoice
    : null;
  if (selectedOnDay === currentDay && currentOverlay && currentOverlay !== overlay) {
    return {
      ok: false,
      code: 'nature_sight_overlay_locked_for_day',
      message: 'nature_sight_overlay_set allows one overlay selection per day',
    };
  }
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        overlay,
      },
    },
  };
}

function resolvePlantProcessingOption(itemId, processId) {
  if (typeof itemId !== 'string' || !itemId.includes(':')) {
    return null;
  }
  const [speciesId, partName, subStageId] = itemId.split(':');
  if (!speciesId || !partName || !subStageId) {
    return null;
  }

  const species = PLANT_BY_ID[speciesId];
  if (!species) {
    return null;
  }

  const sourcePart = (species.parts || []).find((entry) => entry?.name === partName);
  const sourceSubStage = (sourcePart?.subStages || []).find((entry) => entry?.id === subStageId);
  const processOption = (sourceSubStage?.processing_options || []).find((entry) => entry?.id === processId);
  if (!processOption) {
    return null;
  }

  return {
    type: 'plant',
    species,
    sourcePart,
    sourceSubStage,
    processOption,
  };
}

function resolveAnimalProcessingOption(itemId, processId) {
  if (typeof itemId !== 'string' || !itemId.includes(':')) {
    return null;
  }
  const [speciesId, partId] = itemId.split(':');
  if (!speciesId || !partId) {
    return null;
  }

  const species = ANIMAL_BY_ID[speciesId];
  if (!species) {
    return null;
  }

  const sourcePart = (species.parts || []).find((entry) => entry?.id === partId);
  if ((partId === 'carcass' || partId === 'fish_carcass') && processId === 'butcher') {
    const carcassOutputs = (species.parts || [])
      .filter((entry) => entry?.id && entry.id !== 'dried_hide')
      .map((entry) => {
        const baseQuantity = Number.isFinite(Number(entry.yield_quantity)) && Number(entry.yield_quantity) > 0
          ? Math.max(1, Math.floor(Number(entry.yield_quantity)))
          : Number.isFinite(Number(entry.yield_grams)) && Number(entry.yield_grams) > 0
            ? Math.max(1, Math.floor(Number(entry.yield_grams)))
            : 1;
        return {
          itemId: `${species.id}:${entry.id}`,
          quantity: baseQuantity,
          freshness: 1,
          decayDaysRemaining: Number.isFinite(Number(entry.decay_days))
            ? Math.max(0, Math.floor(Number(entry.decay_days)))
            : undefined,
        };
      });

    return {
      type: 'animal',
      species,
      sourcePart: {
        id: 'carcass',
        processing_options: [{ id: 'butcher', ticks: 10, location: 'hand', outputs: carcassOutputs }],
      },
      sourceSubStage: null,
      processOption: {
        id: 'butcher',
        ticks: 10,
        location: 'hand',
        outputs: carcassOutputs,
      },
    };
  }

  const processOption = (sourcePart?.processing_options || []).find((entry) => entry?.id === processId);
  if (!processOption) {
    return null;
  }

  return {
    type: 'animal',
    species,
    sourcePart,
    sourceSubStage: null,
    processOption,
  };
}

function resolveSharedProcessingOption(itemId, processId, processLocationHint = null) {
  const itemTags = resolveCraftTagsForItem(itemId);
  if (processId === 'spin_cordage' && itemTags.includes('cordage_fiber')) {
    const useHand = processLocationHint === 'hand';
    return {
      type: 'shared',
      processOption: {
        id: 'spin_cordage',
        location: useHand ? 'hand' : 'thread_spinner',
        ticks: useHand ? 4 : 2,
        outputs: [{ itemId: 'cordage', quantity: 1 }],
      },
    };
  }
  if ((processId === 'make_barkcloth' || processId === 'pound_barkcloth') && itemTags.includes('inner_bark_cloth')) {
    return {
      type: 'shared',
      processOption: {
        id: processId,
        location: 'hand',
        ticks: 30,
        outputs: [{ itemId: 'barkcloth', quantity: 1 }],
      },
    };
  }

  if (itemId === SAP_FILLED_VESSEL_ITEM_ID && processId === 'boil_sap') {
    return {
      type: 'shared',
      processOption: {
        id: 'boil_sap',
        location: 'sugar_boiling_station',
        ticks: 150,
        outputs: [{ itemId: 'tree_sugar', quantity: 1 }],
      },
      returnItems: [{ itemId: SAP_EMPTY_VESSEL_ITEM_ID, quantity: 1 }],
    };
  }

  return null;
}

function resolveProcessingDescriptor(itemId, processId, processLocationHint = null) {
  return resolveSharedProcessingOption(itemId, processId, processLocationHint)
    || resolvePlantProcessingOption(itemId, processId)
    || resolveAnimalProcessingOption(itemId, processId)
    || null;
}

function resolveOutputItemIdFromPart(descriptor, outputPartName) {
  if (!descriptor || !outputPartName) {
    return null;
  }

  if (descriptor.type === 'animal') {
    return `${descriptor.species.id}:${outputPartName}`;
  }

  if (descriptor.type !== 'plant') {
    return null;
  }

  const outputPart = (descriptor.species.parts || []).find((entry) => entry?.name === outputPartName);
  if (!outputPart) {
    return null;
  }
  const subStages = Array.isArray(outputPart.subStages) ? outputPart.subStages : [];
  if (subStages.length === 1 && subStages[0]?.id) {
    return `${descriptor.species.id}:${outputPartName}:${subStages[0].id}`;
  }

  const preferred = subStages.find((entry) => entry?.id === 'raw') || subStages[0];
  if (!preferred?.id) {
    return null;
  }
  return `${descriptor.species.id}:${outputPartName}:${preferred.id}`;
}

/** Per input unit, same rules previously used for quantity === 1 in batch formulas. */
function computePerUnitProcessOutputQuantity(explicitQuantity, yieldFraction) {
  if (Number.isFinite(explicitQuantity) && explicitQuantity > 0) {
    return Math.max(1, Math.floor(explicitQuantity * 1));
  }
  if (Number.isFinite(yieldFraction) && yieldFraction > 0) {
    return Math.max(1, Math.floor(yieldFraction * 1));
  }
  return 1;
}

function applyProcessOutputMetadata(latest, output, outputItemId, descriptor) {
  if (Number.isFinite(Number(output.freshness))) {
    latest.freshness = Math.max(0, Math.min(1, Number(output.freshness)));
  }
  if (Number.isFinite(Number(output.decayDaysRemaining))) {
    latest.decayDaysRemaining = Math.max(0, Math.floor(Number(output.decayDaysRemaining)));
  }
  if (Number.isFinite(Number(output.tanninRemaining))) {
    latest.tanninRemaining = Math.max(0, Math.min(1, Number(output.tanninRemaining)));
  }
  if (
    descriptor.type === 'plant'
    && !Number.isFinite(Number(latest.decayDaysRemaining))
  ) {
    const outPlant = parsePlantPartItemId(outputItemId);
    const catalogDecay = Number(outPlant?.subStage?.decay_days);
    if (Number.isFinite(catalogDecay) && catalogDecay > 0) {
      latest.decayDaysRemaining = Math.max(0, Math.floor(catalogDecay));
    }
  }
}

function computeProcessOutputs(descriptor, quantity) {
  const normalizedQty = Math.max(1, Math.floor(Number(quantity) || 1));
  const outputs = Array.isArray(descriptor?.processOption?.outputs)
    ? descriptor.processOption.outputs
    : [];
  const normalized = [];

  for (const output of outputs) {
    if (!output || typeof output !== 'object') {
      continue;
    }

    const outputItemId = typeof output.itemId === 'string' && output.itemId
      ? output.itemId
      : resolveOutputItemIdFromPart(descriptor, typeof output.part === 'string' ? output.part : '');
    if (!outputItemId) {
      continue;
    }

    const explicitQuantity = Number(output.quantity);
    const yieldFraction = Number(output.yield_fraction);
    const perUnit = computePerUnitProcessOutputQuantity(explicitQuantity, yieldFraction);
    const hasExplicitOrYield = (Number.isFinite(explicitQuantity) && explicitQuantity > 0)
      || (Number.isFinite(yieldFraction) && yieldFraction > 0);
    const outputQuantity = hasExplicitOrYield
      ? perUnit * normalizedQty
      : normalizedQty;

    const latest = { itemId: outputItemId, quantity: outputQuantity };
    applyProcessOutputMetadata(latest, output, outputItemId, descriptor);
    normalized.push(latest);
  }

  return normalized;
}

function validateProcessItemAction(state, action, actor) {
  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  const processId = typeof action.payload?.processId === 'string' ? action.payload.processId : '';
  const quantity = Number.isInteger(action.payload?.quantity)
    ? action.payload.quantity
    : Math.floor(Number(action.payload?.quantity || 1));

  if (!itemId) {
    return { ok: false, code: 'missing_process_item', message: 'process_item requires payload.itemId' };
  }
  if (!processId) {
    return { ok: false, code: 'missing_process_id', message: 'process_item requires payload.processId' };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, code: 'invalid_process_quantity', message: 'process_item payload.quantity must be a positive integer' };
  }

  const inventoryStacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : [];
  const inventoryStack = findPreferredStackByItem(inventoryStacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(inventoryStack?.quantity) || 0));
  if (available < quantity) {
    return { ok: false, code: 'insufficient_item_quantity', message: 'process_item requires available item quantity in actor inventory' };
  }

  const processLocationHint = typeof action.payload?.processLocation === 'string'
    ? action.payload.processLocation
    : null;
  const descriptor = resolveProcessingDescriptor(itemId, processId, processLocationHint);
  if (!descriptor) {
    return { ok: false, code: 'unknown_process_option', message: 'process_item requires known processing option for payload.itemId + payload.processId' };
  }

  if (descriptor.type === 'animal' && descriptor.sourcePart?.id === 'carcass' && processId === 'butcher') {
    if (!hasInventoryItem(actor, 'tool:flint_knife')) {
      return {
        ok: false,
        code: 'missing_required_tool',
        message: 'process_item butcher on carcass requires tool:flint_knife in inventory',
        requiredToolId: 'tool:flint_knife',
      };
    }
  }

  const processLocation = typeof descriptor.processOption.location === 'string'
    ? descriptor.processOption.location
    : 'hand';
  if (processLocation !== 'hand') {
    if (!isActorWithinCampBounds(state, actor)) {
      return { ok: false, code: 'camp_out_of_range', message: `process_item at ${processLocation} requires actor to be within camp bounds` };
    }
    if (processLocation !== 'camp' && !hasCampStationUnlocked(state, processLocation)) {
      return { ok: false, code: 'missing_station', message: `process_item requires station: ${processLocation}`, stationId: processLocation };
    }
    if (processLocation !== 'camp' && !isActorAdjacentToStation(state, actor, processLocation)) {
      return { ok: false, code: 'station_out_of_range', message: `process_item requires adjacency to station: ${processLocation}`, stationId: processLocation };
    }
  }

  const outputs = computeProcessOutputs(descriptor, quantity);
  if (outputs.length === 0) {
    return { ok: false, code: 'process_no_outputs', message: 'process_item resolved no outputs for this processing option' };
  }

  const returnItems = computeProcessOutputs(
    {
      ...descriptor,
      processOption: {
        outputs: Array.isArray(descriptor?.returnItems) ? descriptor.returnItems : [],
      },
    },
    quantity,
  );

  const ticksPerUnit = Number.isFinite(Number(descriptor.processOption.ticks))
    ? Math.max(1, Math.floor(Number(descriptor.processOption.ticks)))
    : 1;
  // Each filled vessel is one boiling session at the station (catalog ticks per unit × batch quantity).
  let ticks = Math.max(1, ticksPerUnit * quantity);

  if (processLocation === 'hand' && actorQualifiesForWorkbenchFieldBonus(state, actor)) {
    ticks = Math.max(1, Math.floor(ticks * 0.8));
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        itemId,
        processId,
        quantity,
        processLocation,
        outputs,
        returnItems,
      },
      tickCost: ticks,
    },
  };
}

/**
 * Build a partner queue task from camp stockpile materials using processing catalog ticks/outputs
 * (same rules as process_item at the station; no workbench field discount — partner works at the station).
 */
export function previewPartnerQueueTaskFromStockpileProcess(state, params) {
  const itemId = typeof params?.itemId === 'string' ? params.itemId : '';
  const processId = typeof params?.processId === 'string' ? params.processId : '';
  const processLocationHint = typeof params?.processLocation === 'string' ? params.processLocation : null;
  const quantityRaw = Number(params?.quantity);
  const quantity = Number.isInteger(quantityRaw) && quantityRaw > 0
    ? quantityRaw
    : Math.max(1, Math.floor(Number(quantityRaw) || 1));

  if (!itemId) {
    return { ok: false, code: 'missing_item', message: 'Select a stockpile item.' };
  }
  if (!processId) {
    return { ok: false, code: 'missing_process', message: 'Select a process.' };
  }

  if (processId === 'spin_cordage') {
    if (!itemId) {
      return { ok: false, code: 'missing_item', message: 'Select a stockpile item.' };
    }
    const spinTags = resolveCraftTagsForItem(itemId);
    if (!spinTags.includes('cordage_fiber')) {
      return { ok: false, code: 'invalid_spin_target', message: 'This item is not cordage fiber.' };
    }
    const stockpileSpin = buildCampStockpileQuantityMap(state);
    const availableSpin = Math.max(0, Math.floor(Number(stockpileSpin[itemId]) || 0));
    if (availableSpin < quantity) {
      return {
        ok: false,
        code: 'insufficient_stockpile_quantity',
        message: `Stockpile needs ${quantity}× ${itemId} (${availableSpin} available).`,
        requiredItemId: itemId,
      };
    }
    const useSpinnerPreview = hasCampStationUnlocked(state, 'thread_spinner');
    const spinDescriptor = resolveProcessingDescriptor(
      itemId,
      'spin_cordage',
      useSpinnerPreview ? 'thread_spinner' : 'hand',
    );
    if (!spinDescriptor?.processOption) {
      return { ok: false, code: 'unknown_process_option', message: 'That item does not support spinning cordage.' };
    }
    const ticksRequiredSpinPreview = getPartnerTaskTicksRequired(state, 'spin_cordage', 4 * quantity);
    const outputsSpinPreview = computeProcessOutputs(spinDescriptor, quantity);
    const taskRequirementsSpinPreview = normalizeTaskRequirements(
      null,
      useSpinnerPreview ? 'thread_spinner' : null,
    );
    const taskInputsSpinPreview = normalizeTaskInputs([{ source: 'camp_stockpile', itemId, quantity }]);
    return {
      ok: true,
      code: null,
      message: 'ok',
      ticksRequired: ticksRequiredSpinPreview,
      task: {
        kind: 'spin_cordage',
        ticksRequired: ticksRequiredSpinPreview,
        inputs: taskInputsSpinPreview,
        requirements: taskRequirementsSpinPreview,
        outputs: normalizeTaskOutputs(outputsSpinPreview),
        meta: {
          source: 'stockpile_process',
          itemId,
          processId: 'spin_cordage',
          quantity,
          processLocation: useSpinnerPreview ? 'thread_spinner' : 'hand',
        },
      },
    };
  }

  const requiredStation = getRequiredStationForPartnerTask(processId);
  if (!requiredStation) {
    return {
      ok: false,
      code: 'unsupported_partner_process',
      message: 'This process is not assigned via partner station tasks.',
    };
  }
  if (!hasCampStationUnlocked(state, requiredStation)) {
    return {
      ok: false,
      code: 'missing_station',
      message: `Partner needs station built first: ${requiredStation}`,
      stationId: requiredStation,
    };
  }

  const stockpileByItemId = buildCampStockpileQuantityMap(state);
  const available = Math.max(0, Math.floor(Number(stockpileByItemId[itemId]) || 0));
  if (available < quantity) {
    return {
      ok: false,
      code: 'insufficient_stockpile_quantity',
      message: `Stockpile needs ${quantity}× ${itemId} (${available} available).`,
      requiredItemId: itemId,
    };
  }

  const descriptor = resolveProcessingDescriptor(itemId, processId, processLocationHint);
  if (!descriptor) {
    return { ok: false, code: 'unknown_process_option', message: 'That item does not support this process.' };
  }

  const loc = typeof descriptor?.processOption?.location === 'string'
    ? descriptor.processOption.location
    : 'hand';
  if (loc !== requiredStation) {
    return {
      ok: false,
      code: 'process_location_mismatch',
      message: 'This process uses a different station for this item.',
    };
  }

  const outputs = computeProcessOutputs(descriptor, quantity);
  if (outputs.length === 0) {
    return { ok: false, code: 'process_no_outputs', message: 'No outputs for that batch size.' };
  }

  const ticksPerUnit = Number.isFinite(Number(descriptor.processOption.ticks))
    ? Math.max(1, Math.floor(Number(descriptor.processOption.ticks)))
    : 1;
  const ticksRaw = Math.max(1, ticksPerUnit * quantity);

  const ticksRequired = getPartnerTaskTicksRequired(state, processId, ticksRaw);
  const taskInputs = normalizeTaskInputs([{ source: 'camp_stockpile', itemId, quantity }]);
  const taskRequirements = normalizeTaskRequirements(null, requiredStation);

  return {
    ok: true,
    code: null,
    message: 'ok',
    ticksRequired,
    task: {
      kind: processId,
      ticksRequired,
      inputs: taskInputs,
      requirements: taskRequirements,
      outputs: normalizeTaskOutputs(outputs),
      meta: {
        source: 'stockpile_process',
        itemId,
        processId,
        quantity,
        processLocation: loc,
      },
    },
  };
}

const FULLY_DRY_EPSILON = 1e-6;

function isDrynessAutoMergeCompatible(existingDryness, incomingDryness) {
  const existing = Number(existingDryness);
  const incoming = Number(incomingDryness);
  if (!Number.isFinite(existing) || !Number.isFinite(incoming)) {
    return true;
  }

  const existingFullyDry = Math.max(0, Math.min(1, existing)) >= (1 - FULLY_DRY_EPSILON);
  const incomingFullyDry = Math.max(0, Math.min(1, incoming)) >= (1 - FULLY_DRY_EPSILON);
  return existingFullyDry === incomingFullyDry;
}

function canDryingRackAcceptItem(state, itemId, footprintWRaw, footprintHRaw, incomingDryness = null) {
  const slots = Array.isArray(state?.camp?.dryingRack?.slots) ? state.camp.dryingRack.slots : [];
  if (slots.some((entry) => entry?.itemId === itemId && isDrynessAutoMergeCompatible(entry?.dryness, incomingDryness))) {
    return true;
  }

  const footprintW = Math.max(1, Number.isInteger(footprintWRaw) ? footprintWRaw : Math.floor(Number(footprintWRaw || 1)));
  const footprintH = Math.max(1, Number.isInteger(footprintHRaw) ? footprintHRaw : Math.floor(Number(footprintHRaw || 1)));
  const gridW = 2;
  const gridH = 2;
  if (footprintW > gridW || footprintH > gridH) {
    return false;
  }

  const occupied = [];
  for (const slot of slots) {
    if (!slot || (Number(slot.quantity) || 0) <= 0) {
      continue;
    }

    const slotX = Number.isInteger(slot.slotX) ? slot.slotX : null;
    const slotY = Number.isInteger(slot.slotY) ? slot.slotY : null;
    const slotW = Math.max(1, Number.isInteger(slot.footprintW) ? slot.footprintW : Math.floor(Number(slot.footprintW || 1)));
    const slotH = Math.max(1, Number.isInteger(slot.footprintH) ? slot.footprintH : Math.floor(Number(slot.footprintH || 1)));
    if (!Number.isInteger(slotX) || !Number.isInteger(slotY)) {
      return slots.length < 4;
    }

    occupied.push({ x: slotX, y: slotY, w: slotW, h: slotH });
  }

  for (let y = 0; y <= (gridH - footprintH); y += 1) {
    for (let x = 0; x <= (gridW - footprintW); x += 1) {
      const candidate = { x, y, w: footprintW, h: footprintH };
      const overlaps = occupied.some((entry) => (
        candidate.x < (entry.x + entry.w)
        && (candidate.x + candidate.w) > entry.x
        && candidate.y < (entry.y + entry.h)
        && (candidate.y + candidate.h) > entry.y
      ));
      if (!overlaps) {
        return true;
      }
    }
  }

  return false;
}

function findPreferredStackByItem(stacks, itemId, requestedQuantity) {
  if (!Array.isArray(stacks)) {
    return null;
  }

  const requested = Math.max(1, Math.floor(Number(requestedQuantity) || 1));
  let fallback = null;
  for (const stack of stacks) {
    if (stack?.itemId !== itemId) {
      continue;
    }

    const available = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
    if (available <= 0) {
      continue;
    }

    if (!fallback) {
      fallback = stack;
    }
    if (available >= requested) {
      return stack;
    }
  }

  return fallback;
}

function hasInventoryItem(actor, itemId) {
  const stack = findPreferredStackByItem(actor?.inventory?.stacks, itemId, 1);
  return Math.max(0, Math.floor(Number(stack?.quantity) || 0)) > 0;
}

function ensureInventoryEquipment(inventory) {
  if (!inventory || typeof inventory !== 'object') {
    return { gloves: null, coat: null, head: null };
  }

  if (!inventory.equipment || typeof inventory.equipment !== 'object') {
    inventory.equipment = { gloves: null, coat: null, head: null };
  }

  if (!Object.prototype.hasOwnProperty.call(inventory.equipment, 'gloves')) {
    inventory.equipment.gloves = null;
  }
  if (!Object.prototype.hasOwnProperty.call(inventory.equipment, 'coat')) {
    inventory.equipment.coat = null;
  }
  if (!Object.prototype.hasOwnProperty.call(inventory.equipment, 'head')) {
    inventory.equipment.head = null;
  }

  return inventory.equipment;
}

function hasEquippedItem(actor, itemId) {
  const slot = EQUIPPABLE_ITEM_TO_SLOT[itemId] || null;
  if (!slot) {
    return false;
  }
  const equipment = ensureInventoryEquipment(actor?.inventory || {});
  return equipment?.[slot]?.itemId === itemId;
}

function resolvePlantSubStageFromItemId(itemId) {
  if (typeof itemId !== 'string') {
    return null;
  }

  const parts = itemId.split(':');
  if (parts.length !== 3) {
    return null;
  }

  const [speciesId, partName, subStageId] = parts;
  const species = PLANT_BY_ID[speciesId] || null;
  const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
  return (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
}

function resolveAnimalPartFromItemId(itemId) {
  if (typeof itemId !== 'string') {
    return null;
  }

  const parts = itemId.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [speciesId, partId] = parts;
  const species = ANIMAL_BY_ID[speciesId] || null;
  return (species?.parts || []).find((entry) => entry?.id === partId) || null;
}

export function resolveCraftTagsForItem(itemId) {
  function collectTags(sourceTags, target) {
    if (!Array.isArray(sourceTags)) {
      return;
    }
    for (const rawTag of sourceTags) {
      if (typeof rawTag !== 'string' || !rawTag) {
        continue;
      }
      target.push(rawTag);
      const alias = CRAFT_TAG_ALIASES[rawTag];
      if (typeof alias === 'string' && alias) {
        target.push(alias);
      }
    }
  }

  const tags = [];
  const item = ITEM_BY_ID[itemId] || null;
  collectTags(item?.craft_tags, tags);

  const subStage = resolvePlantSubStageFromItemId(itemId);
  collectTags(subStage?.craft_tags, tags);

  const animalPart = resolveAnimalPartFromItemId(itemId);
  collectTags(animalPart?.craft_tags, tags);

  return [...new Set(tags)];
}

function cloneAvailabilityMap(map) {
  const cloned = new Map();
  for (const [itemId, quantity] of map.entries()) {
    cloned.set(itemId, quantity);
  }
  return cloned;
}

function consumeRequirementFromAvailability(availability, requirement) {
  const type = typeof requirement?.type === 'string' ? requirement.type : '';
  const quantityRaw = Number(requirement?.quantity);
  const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.floor(quantityRaw)) : 1;

  if (type === 'item') {
    const itemId = typeof requirement?.itemId === 'string' ? requirement.itemId : '';
    const available = Math.max(0, Math.floor(Number(availability.get(itemId) || 0)));
    if (!itemId || available < quantity) {
      return { ok: false, missing: requirement };
    }
    availability.set(itemId, available - quantity);
    return { ok: true, consumed: [{ itemId, quantity }] };
  }

  if (type === 'tag') {
    const tag = typeof requirement?.tag === 'string' ? requirement.tag : '';
    if (!tag) {
      return { ok: false, missing: requirement };
    }

    const candidates = [];
    for (const [itemId, availableRaw] of availability.entries()) {
      const available = Math.max(0, Math.floor(Number(availableRaw) || 0));
      if (available <= 0) {
        continue;
      }
      const tags = resolveCraftTagsForItem(itemId);
      if (!tags.includes(tag)) {
        continue;
      }
      candidates.push({ itemId, available });
    }

    candidates.sort((a, b) => b.available - a.available || a.itemId.localeCompare(b.itemId));
    let remaining = quantity;
    const consumed = [];
    for (const candidate of candidates) {
      if (remaining <= 0) {
        break;
      }
      const take = Math.min(candidate.available, remaining);
      if (take <= 0) {
        continue;
      }
      availability.set(candidate.itemId, candidate.available - take);
      consumed.push({ itemId: candidate.itemId, quantity: take });
      remaining -= take;
    }

    if (remaining > 0) {
      return { ok: false, missing: requirement };
    }
    return { ok: true, consumed };
  }

  if (type === 'one_of') {
    const options = Array.isArray(requirement?.options) ? requirement.options : [];
    for (const option of options) {
      const cloned = cloneAvailabilityMap(availability);
      const optionResult = consumeRequirementFromAvailability(cloned, option);
      if (!optionResult.ok) {
        continue;
      }
      availability.clear();
      for (const [itemId, qty] of cloned.entries()) {
        availability.set(itemId, qty);
      }
      return { ok: true, consumed: optionResult.consumed };
    }
    return { ok: false, missing: requirement };
  }

  return { ok: false, missing: requirement };
}

function buildToolCraftMaterialPlan(actor, recipe) {
  const availability = new Map();
  for (const stack of actor?.inventory?.stacks || []) {
    const itemId = typeof stack?.itemId === 'string' ? stack.itemId : '';
    const quantity = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
    if (!itemId || quantity <= 0) {
      continue;
    }
    availability.set(itemId, (availability.get(itemId) || 0) + quantity);
  }

  const materialRequirements = Array.isArray(recipe?.materialRequirements) ? recipe.materialRequirements : [];
  const planByItem = new Map();
  for (const requirement of materialRequirements) {
    const result = consumeRequirementFromAvailability(availability, requirement);
    if (!result.ok) {
      return { ok: false, missing: result.missing || requirement };
    }
    for (const consumed of result.consumed || []) {
      const itemId = typeof consumed?.itemId === 'string' ? consumed.itemId : '';
      const quantity = Math.max(0, Math.floor(Number(consumed?.quantity) || 0));
      if (!itemId || quantity <= 0) {
        continue;
      }
      planByItem.set(itemId, (planByItem.get(itemId) || 0) + quantity);
    }
  }

  const materialPlan = [];
  for (const [itemId, quantity] of planByItem.entries()) {
    materialPlan.push({ itemId, quantity });
  }
  materialPlan.sort((a, b) => a.itemId.localeCompare(b.itemId));
  return { ok: true, materialPlan };
}

function lifeStageSizeForAction(species, stageName) {
  const stage = species?.lifeStages?.find((candidate) => candidate.stage === stageName);
  if (!Number.isFinite(stage?.size)) {
    return 1;
  }
  return Math.max(1, Math.round(stage.size));
}

function classifyFellTreeOutcome(plantSize) {
  if (plantSize <= 5) {
    return { sizeClass: 'small', tickCost: 15, poleYield: 1 };
  }
  if (plantSize <= 7) {
    return { sizeClass: 'medium', tickCost: 40, poleYield: 3 };
  }
  if (plantSize <= 8) {
    return { sizeClass: 'large', tickCost: 80, poleYield: 6 };
  }
  return { sizeClass: 'very_large', tickCost: 130, poleYield: 10 };
}

const HARVEST_TOOL_INVENTORY_ALIASES = {
  knife: ['tool:flint_knife'],
};

function hasHarvestToolForModifier(actor, toolKey) {
  if (typeof toolKey !== 'string' || !toolKey) {
    return false;
  }

  const aliases = Array.isArray(HARVEST_TOOL_INVENTORY_ALIASES[toolKey])
    ? HARVEST_TOOL_INVENTORY_ALIASES[toolKey]
    : [];
  const candidateItemIds = [`tool:${toolKey}`, ...aliases];
  return candidateItemIds.some((itemId) => {
    const slot = EQUIPPABLE_ITEM_TO_SLOT[itemId] || null;
    if (slot) {
      return hasEquippedItem(actor, itemId);
    }
    return hasInventoryItem(actor, itemId);
  });
}

function validateEquipItemAction(state, action, actor) {
  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  const slot = EQUIPPABLE_ITEM_TO_SLOT[itemId] || null;
  if (!itemId || !slot) {
    return {
      ok: false,
      code: 'invalid_equipment_item',
      message: 'equip_item requires payload.itemId for an equippable item',
    };
  }

  const stack = findPreferredStackByItem(actor?.inventory?.stacks, itemId, 1);
  const available = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
  if (available <= 0) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'equip_item requires the item in actor inventory stacks',
      requiredItemId: itemId,
    };
  }

  const equipment = ensureInventoryEquipment(actor?.inventory || {});
  if (equipment?.[slot]) {
    return {
      ok: false,
      code: 'equipment_slot_occupied',
      message: `equip_item slot already occupied: ${slot}`,
      equipmentSlot: slot,
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        itemId,
        equipmentSlot: slot,
      },
    },
  };
}

function validateUnequipItemAction(state, action, actor) {
  const slot = typeof action.payload?.equipmentSlot === 'string'
    ? action.payload.equipmentSlot
    : typeof action.payload?.slot === 'string' ? action.payload.slot : '';
  if (!EQUIPMENT_SLOTS.has(slot)) {
    return {
      ok: false,
      code: 'invalid_equipment_slot',
      message: 'unequip_item requires payload.equipmentSlot of gloves, coat, or head',
    };
  }

  const equipment = ensureInventoryEquipment(actor?.inventory || {});
  const equipped = equipment?.[slot] || null;
  if (!equipped || typeof equipped.itemId !== 'string' || !equipped.itemId) {
    return {
      ok: false,
      code: 'equipment_slot_empty',
      message: `unequip_item requires occupied slot: ${slot}`,
      equipmentSlot: slot,
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        equipmentSlot: slot,
        itemId: equipped.itemId,
      },
    },
  };
}

function getHarvestTickCostForPlantAction(action, actor, species, partName, subStageId) {
  const fallbackTickCost = Math.max(1, Math.floor(Number(action?.tickCost) || 1));
  const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
  const subStage = (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
  if (!subStage) {
    return fallbackTickCost;
  }

  const baseTickCostRaw = Number(subStage?.harvest_base_ticks);
  const baseTickCost = Number.isFinite(baseTickCostRaw) && baseTickCostRaw > 0
    ? Math.max(1, Math.ceil(baseTickCostRaw))
    : fallbackTickCost;

  const toolModifiers = subStage?.harvest_tool_modifiers && typeof subStage.harvest_tool_modifiers === 'object'
    ? subStage.harvest_tool_modifiers
    : null;
  if (!toolModifiers) {
    return baseTickCost;
  }

  let bestModifier = 1;
  for (const [toolKey, modifierRaw] of Object.entries(toolModifiers)) {
    const modifier = Number(modifierRaw);
    if (!Number.isFinite(modifier) || modifier <= 0) {
      continue;
    }

    if (hasHarvestToolForModifier(actor, toolKey)) {
      bestModifier = Math.min(bestModifier, modifier);
    }
  }

  return Math.max(1, Math.ceil(baseTickCost * bestModifier));
}

function getHarvestSubStageDefinition(species, partName, subStageId) {
  const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
  return (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
}

function normalizeHarvestPoolCount(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }
  return Math.max(0, Math.floor(Number(value)));
}

function getHarvestActionPoolState(entry, reachTierRaw) {
  const reachTier = typeof reachTierRaw === 'string' ? reachTierRaw : 'ground';
  const remainingActions = normalizeHarvestPoolCount(entry?.remainingActions);
  let remainingActionsGround = normalizeHarvestPoolCount(entry?.remainingActionsGround);
  let remainingActionsElevated = normalizeHarvestPoolCount(entry?.remainingActionsElevated);
  let remainingActionsCanopy = normalizeHarvestPoolCount(entry?.remainingActionsCanopy);

  if (remainingActionsGround === null && remainingActionsElevated === null && remainingActionsCanopy === null && remainingActions !== null) {
    if (reachTier === 'ground') {
      remainingActionsGround = remainingActions;
      remainingActionsElevated = 0;
      remainingActionsCanopy = 0;
    } else if (reachTier === 'canopy') {
      remainingActionsGround = 0;
      remainingActionsElevated = 0;
      remainingActionsCanopy = remainingActions;
    } else {
      remainingActionsGround = 0;
      remainingActionsElevated = remainingActions;
      remainingActionsCanopy = 0;
    }
  }

  if (remainingActionsGround === null && remainingActionsElevated === null && remainingActionsCanopy === null) {
    const initialGround = normalizeHarvestPoolCount(entry?.initialActionsGround);
    const initialElevated = normalizeHarvestPoolCount(entry?.initialActionsElevated);
    const initialCanopy = normalizeHarvestPoolCount(entry?.initialActionsCanopy);
    const hasInitialPools = initialGround !== null || initialElevated !== null || initialCanopy !== null;
    if (hasInitialPools) {
      remainingActionsGround = initialGround ?? 0;
      remainingActionsElevated = initialElevated ?? 0;
      remainingActionsCanopy = initialCanopy ?? 0;
    } else {
      const fallbackActions = normalizeHarvestPoolCount(entry?.initialActionsRoll) ?? 1;
      if (reachTier === 'ground') {
        remainingActionsGround = fallbackActions;
        remainingActionsElevated = 0;
        remainingActionsCanopy = 0;
      } else if (reachTier === 'canopy') {
        remainingActionsGround = 0;
        remainingActionsElevated = 0;
        remainingActionsCanopy = fallbackActions;
      } else {
        remainingActionsGround = 0;
        remainingActionsElevated = fallbackActions;
        remainingActionsCanopy = 0;
      }
    }
  }

  if (remainingActionsGround === null) {
    remainingActionsGround = 0;
  }
  if (remainingActionsElevated === null) {
    remainingActionsElevated = 0;
  }
  if (remainingActionsCanopy === null) {
    remainingActionsCanopy = 0;
  }

  return {
    remainingActionsGround,
    remainingActionsElevated,
    remainingActionsCanopy,
    remainingActionsTotal: remainingActionsGround + remainingActionsElevated + remainingActionsCanopy,
    remainingActionsCanopyCascade: remainingActionsCanopy + remainingActionsElevated + remainingActionsGround,
    remainingActionsElevatedCascade: remainingActionsElevated + remainingActionsGround,
  };
}

function getHarvestReachToolState(actor) {
  const hasLadder = hasInventoryItem(actor, 'tool:ladder');
  const hasStool = hasInventoryItem(actor, 'tool:stool');
  return {
    hasLadder,
    hasStool,
    canAccessElevatedPool: hasLadder || hasStool,
    canAccessCanopyPool: hasLadder,
  };
}

/** Dig action tick-cost multiplier (lower = faster dig). Unearth progress per game tick uses its reciprocal — see `getDigUnearthProgressPerTick` in advanceTick/digRevealProgress.mjs (keep multipliers in sync). */
function getDigToolModifier(actor) {
  if (hasInventoryItem(actor, 'tool:shovel')) {
    return 0.35;
  }
  if (hasInventoryItem(actor, 'tool:digging_stick')) {
    return 0.6;
  }
  return 1;
}

function validateCampDryingRackAddInventoryAction(state, action, actor) {
  if (!isActorWithinCampBounds(state, actor)) {
    return {
      ok: false,
      code: 'camp_out_of_range',
      message: 'camp_drying_rack_add_inventory requires actor to be within camp bounds',
    };
  }

  if (!hasCampStationUnlocked(state, 'drying_rack')) {
    return {
      ok: false,
      code: 'missing_station',
      message: 'camp_drying_rack_add_inventory requires drying_rack station',
    };
  }

  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  const quantity = Number.isInteger(action.payload?.quantity)
    ? action.payload.quantity
    : Math.floor(Number(action.payload?.quantity || 1));
  if (!itemId) {
    return { ok: false, code: 'missing_stockpile_item', message: 'camp_drying_rack_add_inventory requires payload.itemId' };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, code: 'invalid_stockpile_quantity', message: 'camp_drying_rack_add_inventory payload.quantity must be a positive integer' };
  }

  const invStacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : [];
  const invStack = findPreferredStackByItem(invStacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(invStack?.quantity) || 0));
  if (available < quantity) {
    return { ok: false, code: 'insufficient_item_quantity', message: 'camp_drying_rack_add_inventory requires available item quantity in actor inventory' };
  }

  const incomingFootprintW = Number.isInteger(invStack?.footprintW) ? invStack.footprintW : 1;
  const incomingFootprintH = Number.isInteger(invStack?.footprintH) ? invStack.footprintH : 1;
  if (!canDryingRackAcceptItem(state, itemId, incomingFootprintW, incomingFootprintH, invStack?.dryness)) {
    return { ok: false, code: 'drying_rack_full', message: 'camp_drying_rack_add_inventory requires free 2x2 rack space for item footprint' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        itemId,
        quantity,
      },
    },
  };
}

function validateCampDryingRackAddAction(state, action, actor) {
  if (!isActorWithinCampBounds(state, actor)) {
    return {
      ok: false,
      code: 'camp_out_of_range',
      message: 'camp_drying_rack_add requires actor to be within camp bounds',
    };
  }

  if (!hasCampStationUnlocked(state, 'drying_rack')) {
    return {
      ok: false,
      code: 'missing_station',
      message: 'camp_drying_rack_add requires drying_rack station',
    };
  }

  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  const quantity = Number.isInteger(action.payload?.quantity)
    ? action.payload.quantity
    : Math.floor(Number(action.payload?.quantity || 1));
  if (!itemId) {
    return { ok: false, code: 'missing_stockpile_item', message: 'camp_drying_rack_add requires payload.itemId' };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, code: 'invalid_stockpile_quantity', message: 'camp_drying_rack_add payload.quantity must be a positive integer' };
  }

  const campStacks = Array.isArray(state?.camp?.stockpile?.stacks) ? state.camp.stockpile.stacks : [];
  const campStack = findPreferredStackByItem(campStacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(campStack?.quantity) || 0));
  if (available < quantity) {
    return { ok: false, code: 'insufficient_stockpile_quantity', message: 'camp_drying_rack_add requires available item quantity in camp stockpile' };
  }

  const incomingFootprintW = Number.isInteger(campStack?.footprintW) ? campStack.footprintW : 1;
  const incomingFootprintH = Number.isInteger(campStack?.footprintH) ? campStack.footprintH : 1;
  if (!canDryingRackAcceptItem(state, itemId, incomingFootprintW, incomingFootprintH, campStack?.dryness)) {
    return { ok: false, code: 'drying_rack_full', message: 'camp_drying_rack_add requires free 2x2 rack space for item footprint' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        itemId,
        quantity,
      },
    },
  };
}

function validateCampDryingRackRemoveAction(state, action, actor) {
  if (!isActorWithinCampBounds(state, actor)) {
    return {
      ok: false,
      code: 'camp_out_of_range',
      message: 'camp_drying_rack_remove requires actor to be within camp bounds',
    };
  }

  if (!hasCampStationUnlocked(state, 'drying_rack')) {
    return {
      ok: false,
      code: 'missing_station',
      message: 'camp_drying_rack_remove requires drying_rack station',
    };
  }

  const slotIndex = Number.isInteger(action.payload?.slotIndex)
    ? action.payload.slotIndex
    : Math.floor(Number(action.payload?.slotIndex));
  const quantity = Number.isInteger(action.payload?.quantity)
    ? action.payload.quantity
    : Math.floor(Number(action.payload?.quantity || 1));

  if (!Number.isInteger(slotIndex) || slotIndex < 0) {
    return { ok: false, code: 'invalid_drying_rack_slot', message: 'camp_drying_rack_remove requires payload.slotIndex >= 0' };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, code: 'invalid_stockpile_quantity', message: 'camp_drying_rack_remove payload.quantity must be a positive integer' };
  }

  const slots = Array.isArray(state?.camp?.dryingRack?.slots) ? state.camp.dryingRack.slots : [];
  const slot = slots[slotIndex];
  const available = Math.max(0, Math.floor(Number(slot?.quantity) || 0));
  if (available < quantity) {
    return { ok: false, code: 'insufficient_drying_rack_quantity', message: 'camp_drying_rack_remove requires available quantity in selected drying rack slot' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        slotIndex,
        quantity,
      },
    },
  };
}

function isUnlockEnabled(state, unlockKey) {
  if (typeof unlockKey !== 'string' || !unlockKey) {
    return true;
  }
  const value = state?.techUnlocks?.[unlockKey];
  if (state?.techForest?.version != null) {
    return value === true;
  }
  return value !== false;
}

function hasCampStationUnlocked(state, stationId) {
  return Array.isArray(state?.camp?.stationsUnlocked)
    && state.camp.stationsUnlocked.includes(stationId);
}

function getCampFootprintBounds(state) {
  const anchorX = Number(state?.camp?.anchorX);
  const anchorY = Number(state?.camp?.anchorY);
  if (!Number.isInteger(anchorX) || !Number.isInteger(anchorY)) {
    return null;
  }
  return {
    minX: anchorX - 1,
    maxX: anchorX + 2,
    minY: anchorY - 1,
    maxY: anchorY + 2,
    anchorX,
    anchorY,
  };
}

/** First free camp tile for a new station: in-bounds, not the anchor fire tile, not already occupied. */
function findFirstDefaultCampStationPlacement(state, campBounds) {
  if (!campBounds) {
    return null;
  }
  for (let y = campBounds.minY; y <= campBounds.maxY; y += 1) {
    for (let x = campBounds.minX; x <= campBounds.maxX; x += 1) {
      if (x === campBounds.anchorX && y === campBounds.anchorY) {
        continue;
      }
      if (!inBounds(state, x, y)) {
        continue;
      }
      if (isTileOccupiedByCampStation(state, x, y)) {
        continue;
      }
      return { x, y };
    }
  }
  return null;
}

function getCampStationPlacement(state, stationId) {
  const placement = state?.camp?.stationPlacements?.[stationId];
  if (!Number.isInteger(placement?.x) || !Number.isInteger(placement?.y)) {
    return null;
  }
  return { x: placement.x, y: placement.y };
}

function isTileOccupiedByCampStation(state, x, y) {
  if (!state?.camp?.stationPlacements || typeof state.camp.stationPlacements !== 'object') {
    return false;
  }
  return Object.values(state.camp.stationPlacements).some((placement) => (
    Number.isInteger(placement?.x)
    && Number.isInteger(placement?.y)
    && placement.x === x
    && placement.y === y
  ));
}

function isActorAdjacentToStation(state, actor, stationId) {
  const actorX = Number(actor?.x);
  const actorY = Number(actor?.y);
  const placement = getCampStationPlacement(state, stationId);
  if (!Number.isInteger(actorX) || !Number.isInteger(actorY) || !placement) {
    return false;
  }
  return Math.abs(actorX - placement.x) <= 1 && Math.abs(actorY - placement.y) <= 1;
}

/**
 * 20% tick reduction when the workbench is built (tile placement), not research-unlock alone.
 * Used for `tool_craft` and for any `process_item` whose resolved location is `hand` (in camp or adjacent to workbench).
 */
function actorQualifiesForWorkbenchFieldBonus(state, actor) {
  if (!getCampStationPlacement(state, 'workbench')) {
    return false;
  }
  if (isActorWithinCampBounds(state, actor)) {
    return true;
  }
  return isActorAdjacentToStation(state, actor, 'workbench');
}

const THREAD_SPINNER_TASK_KINDS = new Set([
  'spin_cordage',
]);

// Centralized partner-task station-gating table.
// Keep this in sync with station-specific regression tests in run-sim-tests.mjs.
const PARTNER_TASK_STATION_RULES = [
  { taskKind: 'scrape_and_dry', stationId: 'hide_frame' },
  { taskKind: 'crack_shell', stationId: 'mortar_pestle' },
  { taskKind: 'boil_sap', stationId: 'sugar_boiling_station' },
];

const PARTNER_TASK_REQUIRED_STATION = Object.fromEntries(
  PARTNER_TASK_STATION_RULES.map((rule) => [rule.taskKind, rule.stationId]),
);

function getRequiredStationForPartnerTask(taskKind) {
  return typeof PARTNER_TASK_REQUIRED_STATION[taskKind] === 'string'
    ? PARTNER_TASK_REQUIRED_STATION[taskKind]
    : null;
}

function getPartnerTaskTicksRequired(state, taskKind, ticksRequiredRaw) {
  const baseTicks = Number.isInteger(ticksRequiredRaw)
    ? ticksRequiredRaw
    : Math.floor(Number(ticksRequiredRaw || 0));
  if (!Number.isInteger(baseTicks) || baseTicks <= 0) {
    return baseTicks;
  }

  if (!THREAD_SPINNER_TASK_KINDS.has(taskKind)) {
    return baseTicks;
  }

  if (!hasCampStationUnlocked(state, 'thread_spinner')) {
    return baseTicks;
  }

  return Math.max(1, Math.ceil(baseTicks * 0.5));
}

function getToolCraftTickCost(state, actor, recipe) {
  const baseCost = Number.isInteger(recipe?.craftTicks) ? recipe.craftTicks : 1;
  if (!actorQualifiesForWorkbenchFieldBonus(state, actor)) {
    return baseCost;
  }

  return Math.max(1, Math.floor(baseCost * 0.8));
}

function getActor(state, actorId) {
  return state?.actors?.[actorId] || null;
}

function getActorBudgetCurrent(actor) {
  if (!actor) {
    return 0;
  }

  if (Number.isFinite(actor.tickBudgetCurrent)) {
    return Number(actor.tickBudgetCurrent);
  }

  if (Number.isFinite(actor.tickBudgetBase)) {
    return Number(actor.tickBudgetBase);
  }

  return 0;
}

/** Matches GDD: up to 40 overdraft ticks/day before pass-out (tickBudgetCurrent may reach -40). */
export const MAX_DAILY_TICK_OVERDRAFT = 40;

/**
 * Preview spending `tickCost` from a tick budget value (typically actor.tickBudgetCurrent).
 * Used by UI context menus to warn on overdraft or disable when the spend would pass the daily limit.
 */
export function previewTickBudgetImpact(tickBudgetCurrent, tickCost) {
  const current = Number.isFinite(Number(tickBudgetCurrent)) ? Number(tickBudgetCurrent) : 0;
  const cost = Number.isInteger(tickCost) ? tickCost : Math.floor(Number(tickCost) || 0);
  if (!Number.isFinite(cost) || cost < 1) {
    return {
      tickCost: cost,
      budgetAfter: current,
      wouldOverdraft: false,
      exceedsDailyOverdraftLimit: false,
    };
  }
  const budgetAfter = current - cost;
  return {
    tickCost: cost,
    budgetAfter,
    wouldOverdraft: budgetAfter < 0,
    exceedsDailyOverdraftLimit: budgetAfter < -MAX_DAILY_TICK_OVERDRAFT,
  };
}

function actorCanSpendTickBudget(actor, tickCost) {
  const current = getActorBudgetCurrent(actor);
  const preview = previewTickBudgetImpact(current, tickCost);
  return !preview.exceedsDailyOverdraftLimit;
}

function gateActorTickBudget(actor, validation) {
  if (!validation || !validation.ok) {
    return validation;
  }
  const kind = validation.normalizedAction?.kind;
  if (kind === 'debrief_enter' || kind === 'debrief_exit') {
    return validation;
  }
  const tickCost = Number(validation.normalizedAction?.tickCost);
  if (!Number.isInteger(tickCost) || tickCost < 1) {
    return validation;
  }
  if (!actorCanSpendTickBudget(actor, tickCost)) {
    const actorId = typeof actor?.id === 'string' ? actor.id : '(unknown)';
    return {
      ok: false,
      code: 'no_tick_budget',
      message: `actor ${actorId} would exceed the daily tick overdraft limit (+${MAX_DAILY_TICK_OVERDRAFT})`,
    };
  }
  return validation;
}

function isActorWithinCampBounds(state, actor) {
  const bounds = getCampFootprintBounds(state);
  const actorX = Number(actor?.x);
  const actorY = Number(actor?.y);
  if (!bounds || !Number.isInteger(actorX) || !Number.isInteger(actorY)) {
    return false;
  }
  return actorX >= bounds.minX
    && actorX <= bounds.maxX
    && actorY >= bounds.minY
    && actorY <= bounds.maxY;
}

function inBounds(state, x, y) {
  return Number.isInteger(x)
    && Number.isInteger(y)
    && x >= 0
    && y >= 0
    && x < Number(state?.width)
    && y < Number(state?.height);
}

function normalizeActionEnvelope(action, fallbackIssuedAtTick = 0) {
  const actorId = typeof action?.actorId === 'string' ? action.actorId : '';
  const kind = typeof action?.kind === 'string' ? action.kind : '';
  const payload = action?.payload && typeof action.payload === 'object' ? action.payload : {};
  const issuedAtTick = Number.isInteger(action?.issuedAtTick)
    ? action.issuedAtTick
    : Number.isInteger(fallbackIssuedAtTick) ? fallbackIssuedAtTick : 0;
  const actionId = typeof action?.actionId === 'string'
    ? action.actionId
    : `${actorId || 'unknown'}:${kind || 'unknown'}:${issuedAtTick}`;

  return {
    actionId,
    actorId,
    kind,
    payload,
    issuedAtTick,
    tickCost: normalizeTickCost(kind, payload),
    clientMeta: action?.clientMeta && typeof action.clientMeta === 'object' ? action.clientMeta : null,
  };
}

function normalizeTaskOutputs(outputs) {
  if (!Array.isArray(outputs)) {
    return [];
  }

  const normalized = [];
  for (const output of outputs) {
    const itemId = typeof output?.itemId === 'string' ? output.itemId : '';
    const quantity = Number.isInteger(output?.quantity)
      ? output.quantity
      : Math.floor(Number(output?.quantity || 0));
    if (!itemId || quantity <= 0) {
      continue;
    }

    const freshnessRaw = Number(output?.freshness);
    const decayDaysRemainingRaw = Number(output?.decayDaysRemaining);
    const normalizedOutput = { itemId, quantity };

    if (Number.isFinite(freshnessRaw)) {
      normalizedOutput.freshness = Math.max(0, Math.min(1, freshnessRaw));
    }
    if (Number.isFinite(decayDaysRemainingRaw) && decayDaysRemainingRaw >= 0) {
      normalizedOutput.decayDaysRemaining = decayDaysRemainingRaw;
    }

    normalized.push(normalizedOutput);
  }
  return normalized;
}

function normalizeTaskInputs(inputs) {
  if (!Array.isArray(inputs)) {
    return [];
  }

  const normalized = [];
  for (const input of inputs) {
    const itemId = typeof input?.itemId === 'string' ? input.itemId : '';
    const quantity = Number.isInteger(input?.quantity)
      ? input.quantity
      : Math.floor(Number(input?.quantity || 0));
    if (!itemId || quantity <= 0) {
      continue;
    }

    const sourceRaw = typeof input?.source === 'string' ? input.source : 'camp_stockpile';
    const source = sourceRaw === 'camp_stockpile' ? sourceRaw : '';
    if (!source) {
      continue;
    }

    normalized.push({
      source,
      itemId,
      quantity,
      required: input?.required !== false,
    });
  }

  return normalized;
}

function normalizeTaskRequirements(requirements, requiredStationId = null) {
  const stationsRaw = Array.isArray(requirements?.stations) ? requirements.stations : [];
  const unlocksRaw = Array.isArray(requirements?.unlocks) ? requirements.unlocks : [];
  const stations = [...new Set(stationsRaw.filter((entry) => typeof entry === 'string' && entry))];
  const unlocks = [...new Set(unlocksRaw.filter((entry) => typeof entry === 'string' && entry))];
  if (requiredStationId && !stations.includes(requiredStationId)) {
    stations.push(requiredStationId);
  }
  return { stations, unlocks };
}

function getTile(state, x, y) {
  if (!inBounds(state, x, y)) {
    return null;
  }

  const width = Number(state?.width) || 0;
  const idx = (y * width) + x;
  return state?.tiles?.[idx] || null;
}

function resolveTargetCoordinates(state, actor, payload) {
  const explicitX = Number(payload?.x);
  const explicitY = Number(payload?.y);
  if (Number.isInteger(explicitX) && Number.isInteger(explicitY)) {
    return { x: explicitX, y: explicitY };
  }

  const dx = Number(payload?.dx);
  const dy = Number(payload?.dy);
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) {
    return null;
  }

  return {
    x: Number(actor?.x) + dx,
    y: Number(actor?.y) + dy,
  };
}

function isInteractionTargetInRange(actor, target) {
  const actorX = Number(actor?.x);
  const actorY = Number(actor?.y);
  if (!Number.isInteger(actorX) || !Number.isInteger(actorY)) {
    return false;
  }
  if (!target || !Number.isInteger(target.x) || !Number.isInteger(target.y)) {
    return false;
  }

  return Math.abs(target.x - actorX) <= 1 && Math.abs(target.y - actorY) <= 1;
}

function normalizeUnitInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return null;
  }
  return Math.max(0, Math.min(1, n));
}

function resolvePlantSubStageByItemId(itemId) {
  if (typeof itemId !== 'string') {
    return null;
  }
  const parts = itemId.split(':');
  if (parts.length !== 3) {
    return null;
  }
  const [speciesId, partName, subStageId] = parts;
  const species = PLANT_BY_ID[speciesId] || null;
  const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
  const subStage = (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
  if (!subStage) {
    return null;
  }
  return { speciesId, partName, subStageId, subStage };
}

function resolveLeachingBasketTanninStart(stack) {
  const explicit = normalizeUnitInterval(stack?.tanninRemaining);
  if (explicit !== null) {
    return explicit;
  }

  const source = resolvePlantSubStageByItemId(stack?.itemId);
  if (!source) {
    return null;
  }
  return normalizeUnitInterval(source.subStage?.tannin_level);
}

function validateLeachingBasketPlaceAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'leaching_basket_place_out_of_bounds', message: 'leaching_basket_place target is out of bounds' };
  }
  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'leaching_basket_place target must be on current or adjacent tile',
    };
  }

  if (!hasInventoryItem(actor, LEACHING_BASKET_ITEM_ID)) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'leaching_basket_place requires tool:leaching_basket in inventory',
      requiredItemId: LEACHING_BASKET_ITEM_ID,
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || !tile.waterType || tile.waterFrozen === true) {
    return {
      ok: false,
      code: 'leaching_basket_place_invalid_target',
      message: 'leaching_basket_place target must be an unfrozen water tile',
    };
  }
  if (tile?.leachingBasket?.active === true) {
    return {
      ok: false,
      code: 'leaching_basket_place_already_present',
      message: 'leaching_basket_place target already contains an active leaching basket',
    };
  }

  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  const quantity = Number.isInteger(action.payload?.quantity)
    ? action.payload.quantity
    : Math.floor(Number(action.payload?.quantity || 1));
  if (!itemId || !Number.isInteger(quantity) || quantity <= 0) {
    return {
      ok: false,
      code: 'invalid_leaching_basket_payload',
      message: 'leaching_basket_place requires payload.itemId and positive payload.quantity',
    };
  }

  const stack = findPreferredStackByItem(actor?.inventory?.stacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
  if (available < quantity) {
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'leaching_basket_place requires available item quantity in actor inventory',
      requiredItemId: itemId,
    };
  }

  const tanninRemaining = resolveLeachingBasketTanninStart(stack);
  if (tanninRemaining === null) {
    return {
      ok: false,
      code: 'missing_tannin_metadata',
      message: 'leaching_basket_place requires source item with tanninRemaining or plant sub-stage tannin_level',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
        itemId,
        quantity: Math.min(quantity, available),
        tanninRemaining,
      },
    },
  };
}

function validateLeachingBasketRetrieveAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'leaching_basket_retrieve_out_of_bounds', message: 'leaching_basket_retrieve target is out of bounds' };
  }
  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'leaching_basket_retrieve target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  const basketState = tile?.leachingBasket;
  if (!tile || !basketState || basketState.active !== true) {
    return {
      ok: false,
      code: 'leaching_basket_retrieve_invalid_target',
      message: 'leaching_basket_retrieve target must contain an active leaching basket',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
      },
    },
  };
}

const ROCK_HARVEST_YIELD_BY_TYPE = Object.freeze({
  glacial_erratic: Object.freeze({
    heavy_rock: Object.freeze({
      rockYield: 'heavy_rock',
      outputItemId: 'heavy_rock',
      tickCost: 3,
      outputFootprintW: 2,
      outputFootprintH: 2,
    }),
    flat_stone: Object.freeze({
      rockYield: 'flat_stone',
      outputItemId: 'flat_stone',
      tickCost: 2,
      outputFootprintW: 1,
      outputFootprintH: 1,
    }),
  }),
  flint_cobble_scatter: Object.freeze({
    flint_cobble: Object.freeze({
      rockYield: 'flint_cobble',
      outputItemId: 'flint_cobble',
      tickCost: 5,
      outputFootprintW: 1,
      outputFootprintH: 1,
    }),
    flat_stone: Object.freeze({
      rockYield: 'flat_stone',
      outputItemId: 'flat_stone',
      tickCost: 3,
      outputFootprintW: 1,
      outputFootprintH: 1,
    }),
  }),
});

function resolveRockHarvestYieldEntry(rockType, rockYieldRaw) {
  const byType = ROCK_HARVEST_YIELD_BY_TYPE[rockType];
  if (!byType) {
    return null;
  }
  const fallbackKey = rockType === 'glacial_erratic' ? 'heavy_rock' : 'flint_cobble';
  const key = typeof rockYieldRaw === 'string' && rockYieldRaw !== '' ? rockYieldRaw : fallbackKey;
  return byType[key] || null;
}

/** Labels + tick costs for tile context menus (GDD rock split: heavy vs flat vs flint). */
export function listRockHarvestYieldChoices(rockType) {
  const byType = ROCK_HARVEST_YIELD_BY_TYPE[rockType];
  if (!byType) {
    return [];
  }
  const order = rockType === 'glacial_erratic'
    ? ['heavy_rock', 'flat_stone']
    : ['flint_cobble', 'flat_stone'];
  return order
    .map((k) => byType[k])
    .filter(Boolean)
    .map((entry) => ({
      rockYield: entry.rockYield,
      label: entry.rockYield === 'heavy_rock'
        ? 'Harvest heavy rock'
        : entry.rockYield === 'flat_stone'
          ? 'Harvest flat stone'
          : 'Harvest flint cobbles',
      tickCost: entry.tickCost,
    }));
}

function validateHarvestAction(state, action, actor) {
  const plantId = typeof action.payload?.plantId === 'string' ? action.payload.plantId : '';
  if (plantId) {
    const partName = typeof action.payload?.partName === 'string' ? action.payload.partName : '';
    const subStageId = typeof action.payload?.subStageId === 'string' ? action.payload.subStageId : '';
    const requestedActions = Number.isInteger(action.payload?.actions)
      ? action.payload.actions
      : Math.floor(Number(action.payload?.actions || 1));

    if (!partName || !subStageId) {
      return { ok: false, code: 'missing_harvest_target', message: 'harvest requires payload.partName and payload.subStageId' };
    }
    if (!Number.isInteger(requestedActions) || requestedActions <= 0) {
      return { ok: false, code: 'invalid_harvest_actions', message: 'harvest payload.actions must be a positive integer' };
    }

    const plant = state?.plants?.[plantId];
    if (!plant || plant.alive !== true) {
      return { ok: false, code: 'missing_harvest_plant', message: 'harvest target plant does not exist or is not alive' };
    }

    const plantX0 = Number(plant?.x);
    const plantY0 = Number(plant?.y);
    if (!Number.isInteger(plantX0) || !Number.isInteger(plantY0) || !inBounds(state, plantX0, plantY0)) {
      return { ok: false, code: 'missing_harvest_plant', message: 'harvest target plant has no valid map position' };
    }
    if (!isInteractionTargetInRange(actor, { x: plantX0, y: plantY0 })) {
      return {
        ok: false,
        code: 'interaction_out_of_range',
        message: 'harvest target must be on current or adjacent tile',
      };
    }

    const species = PLANT_BY_ID[plant.speciesId] || null;
    const subStageDef = getHarvestSubStageDefinition(species, partName, subStageId);
    const subStageEntry = Array.isArray(plant.activeSubStages)
      ? plant.activeSubStages.find((entry) => entry?.partName === partName && entry?.subStageId === subStageId) || null
      : null;
    if (!subStageEntry) {
      return { ok: false, code: 'inactive_harvest_sub_stage', message: 'harvest target sub-stage is not active' };
    }

    ensureHarvestEntryState(subStageEntry, subStageDef, plant, species);

    const requiresDigDiscovery = Number.isFinite(Number(subStageDef?.dig_ticks_to_discover))
      && Number(subStageDef.dig_ticks_to_discover) > 0;
    if (requiresDigDiscovery) {
      const need = Math.max(1, Number(subStageDef.dig_ticks_to_discover));
      const applied = Math.max(0, Number(subStageEntry.digRevealTicksApplied) || 0);
      if (applied + 1e-9 < need) {
        return {
          ok: false,
          code: 'harvest_target_underground',
          message: `harvest target is still underground (${applied.toFixed(1)}/${need} dig progress)`,
        };
      }
    }

    const reachTier = resolveEffectiveReachTier(subStageDef, plant.stageName);
    const reachTools = getHarvestReachToolState(actor);
    const poolState = getHarvestActionPoolState(subStageEntry, reachTier);
    if (reachTier === 'canopy' && !reachTools.canAccessCanopyPool) {
      const g = poolState.remainingActionsGround;
      const e = poolState.remainingActionsElevated;
      const c = poolState.remainingActionsCanopy;
      if (g <= 0 && e > 0 && !reachTools.canAccessElevatedPool) {
        return {
          ok: false,
          code: 'missing_required_tool',
          message: 'harvest canopy sub-stage requires tool:stool or tool:ladder for elevated pool actions',
          requiredToolId: 'tool:stool',
          ...poolState,
        };
      }
      if (g <= 0 && (e <= 0 || !reachTools.canAccessElevatedPool) && c > 0) {
        return {
          ok: false,
          code: 'missing_required_tool',
          message: 'harvest reach tier canopy requires tool:ladder in inventory',
          requiredToolId: 'tool:ladder',
          ...poolState,
        };
      }
    }
    if (reachTier === 'canopy' && poolState.remainingActionsCanopyCascade <= 0) {
      return {
        ok: false,
        code: 'no_actions_remaining',
        message: 'harvest canopy sub-stage has no remaining canopy/elevated/ground actions',
        ...poolState,
      };
    }
    if (reachTier === 'elevated') {
      if (!reachTools.canAccessElevatedPool && poolState.remainingActionsGround <= 0) {
        if (poolState.remainingActionsElevated > 0) {
          return {
            ok: false,
            code: 'missing_required_tool',
            message: 'harvest elevated pool requires tool:stool or tool:ladder after ground actions are exhausted',
            requiredToolId: 'tool:stool',
            ...poolState,
          };
        }
        return {
          ok: false,
          code: 'no_actions_remaining',
          message: 'harvest elevated sub-stage has no remaining actions',
          ...poolState,
        };
      }
      if (reachTools.canAccessElevatedPool && poolState.remainingActionsTotal <= 0) {
        return {
          ok: false,
          code: 'no_actions_remaining',
          message: 'harvest elevated sub-stage has no remaining actions',
          ...poolState,
        };
      }
      if (reachTools.canAccessElevatedPool && poolState.remainingActionsElevatedCascade <= 0) {
        return {
          ok: false,
          code: 'no_actions_remaining',
          message: 'harvest elevated sub-stage has no remaining elevated/ground actions',
          ...poolState,
        };
      }
    }
    if (reachTier === 'ground' && poolState.remainingActionsGround <= 0) {
      return {
        ok: false,
        code: 'no_actions_remaining',
        message: 'harvest ground sub-stage has no remaining ground actions',
        ...poolState,
      };
    }

    const harvestTickCost = getHarvestTickCostForPlantAction(action, actor, species, partName, subStageId);

    return {
      ok: true,
      code: null,
      message: 'ok',
      normalizedAction: {
        ...action,
        payload: {
          ...action.payload,
          targetType: 'plant',
          plantId,
          partName,
          subStageId,
          actions: requestedActions,
          reachTier,
          canAccessElevatedPool: reachTools.canAccessElevatedPool,
          canAccessCanopyPool: reachTools.canAccessCanopyPool,
          remainingActionsGround: poolState.remainingActionsGround,
          remainingActionsElevated: poolState.remainingActionsElevated,
          remainingActionsCanopy: poolState.remainingActionsCanopy,
          remainingActionsTotal: poolState.remainingActionsTotal,
        },
        tickCost: harvestTickCost,
      },
    };
  }

  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'missing_harvest_plant', message: 'harvest requires payload.plantId or tile coordinates' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'harvest target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  const rockYieldRaw = typeof action.payload?.rockYield === 'string' ? action.payload.rockYield : '';
  if (tile?.rockType === 'glacial_erratic' || tile?.rockType === 'flint_cobble_scatter') {
    const sel = resolveRockHarvestYieldEntry(tile.rockType, rockYieldRaw);
    if (!sel) {
      return {
        ok: false,
        code: 'invalid_rock_yield',
        message: 'harvest payload.rockYield is missing or not valid for this rock tile',
      };
    }
    return {
      ok: true,
      code: null,
      message: 'ok',
      normalizedAction: {
        ...action,
        payload: {
          ...action.payload,
          targetType: 'rock',
          x: target.x,
          y: target.y,
          rockType: tile.rockType,
          rockYield: sel.rockYield,
          outputItemId: sel.outputItemId,
          outputQuantity: 1,
          outputFootprintW: sel.outputFootprintW,
          outputFootprintH: sel.outputFootprintH,
        },
        tickCost: sel.tickCost,
      },
    };
  }

  const activeLogFungi = Array.isArray(tile?.deadLog?.fungi)
    ? tile.deadLog.fungi
      .filter((entry) => Number(entry?.yield_current_grams) > 0 && typeof entry?.species_id === 'string' && entry.species_id)
    : [];
  if (activeLogFungi.length > 0) {
    const requestedSpeciesId = typeof action.payload?.speciesId === 'string' ? action.payload.speciesId : '';
    const selectedFungus = requestedSpeciesId
      ? activeLogFungi.find((entry) => entry.species_id === requestedSpeciesId) || activeLogFungi[0]
      : activeLogFungi[0];
    const harvestGrams = Math.max(1, Math.floor(Number(selectedFungus?.yield_current_grams) || 0));
    return {
      ok: true,
      code: null,
      message: 'ok',
      normalizedAction: {
        ...action,
        payload: {
          ...action.payload,
          targetType: 'log_fungus',
          x: target.x,
          y: target.y,
          speciesId: selectedFungus.species_id,
          harvestGrams,
          outputItemId: `log_fungus:${selectedFungus.species_id}:fruiting_body`,
          outputUnitWeightKg: 0.001,
        },
        tickCost: 2,
      },
    };
  }

  const cache = tile?.squirrelCache;
  if (!cache || cache.discovered !== true) {
    return { ok: false, code: 'missing_squirrel_cache', message: 'harvest cache target requires discovered squirrel cache on target tile' };
  }

  const availableGrams = Number(cache.nutContentGrams);
  if (!Number.isFinite(availableGrams) || availableGrams <= 0) {
    return { ok: false, code: 'empty_squirrel_cache', message: 'squirrel cache has no remaining content' };
  }

  const plantPartItemId = `${cache.cachedSpeciesId}:${cache.cachedPartName}:${cache.cachedSubStageId}`;
  const cachePartDescriptor = parsePlantPartItemId(plantPartItemId);
  if (!cachePartDescriptor) {
    return {
      ok: false,
      code: 'invalid_squirrel_cache_plant_part',
      message: 'squirrel cache does not resolve to a known plant part item',
    };
  }

  const gramsPerUnit = Number(cachePartDescriptor.subStage?.unit_weight_g);
  if (!Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0) {
    return {
      ok: false,
      code: 'invalid_squirrel_cache_unit_weight',
      message: 'cached plant part has no usable unit weight for inventory',
    };
  }

  const maxWholeUnits = Math.floor(availableGrams / gramsPerUnit);
  if (maxWholeUnits < 1) {
    return {
      ok: false,
      code: 'squirrel_cache_insufficient_mass',
      message: 'cached mass is less than one plant part unit',
    };
  }

  const requestedGrams = Math.max(1, Math.floor(availableGrams));

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        targetType: 'squirrel_cache',
        x: target.x,
        y: target.y,
        cacheGrams: requestedGrams,
        plantPartItemId,
      },
    },
  };
}

function validateFellTreeAction(state, action, actor) {
  const plantId = typeof action.payload?.plantId === 'string' ? action.payload.plantId : '';
  if (!plantId) {
    return { ok: false, code: 'missing_fell_tree_target', message: 'fell_tree requires payload.plantId' };
  }

  const plant = state?.plants?.[plantId];
  if (!plant || plant.alive !== true) {
    return { ok: false, code: 'missing_fell_tree_target', message: 'fell_tree target plant does not exist or is not alive' };
  }

  const species = PLANT_BY_ID[plant.speciesId] || null;
  if (!species || species.longevity !== 'perennial') {
    return { ok: false, code: 'fell_tree_invalid_target', message: 'fell_tree target must be a perennial woody plant' };
  }

  const target = { x: Number(plant.x), y: Number(plant.y) };
  if (!Number.isInteger(target.x) || !Number.isInteger(target.y) || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'missing_fell_tree_target', message: 'fell_tree target plant coordinates are invalid' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'fell_tree target must be on current or adjacent tile',
    };
  }

  if (!hasInventoryItem(actor, 'tool:axe')) {
    return {
      ok: false,
      code: 'missing_required_tool',
      message: 'fell_tree requires tool:axe in inventory',
      requiredToolId: 'tool:axe',
    };
  }

  const plantSize = lifeStageSizeForAction(species, plant.stageName);
  if (plantSize < 5) {
    return {
      ok: false,
      code: 'fell_tree_invalid_target',
      message: 'fell_tree target must be at least sapling size',
    };
  }

  const outcome = classifyFellTreeOutcome(plantSize);
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        plantId,
        x: target.x,
        y: target.y,
        plantSize,
        sizeClass: outcome.sizeClass,
        poleYield: outcome.poleYield,
      },
      tickCost: outcome.tickCost,
    },
  };
}

function validateInspectAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'inspect_out_of_bounds', message: 'inspect target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'inspect target must be on current or adjacent tile',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
      },
    },
  };
}

function validateDigAction(state, action, actor) {
  const target = resolveTargetCoordinates(state, actor, action.payload);
  if (!target || !inBounds(state, target.x, target.y)) {
    return { ok: false, code: 'dig_out_of_bounds', message: 'dig target is out of bounds' };
  }

  if (!isInteractionTargetInRange(actor, target)) {
    return {
      ok: false,
      code: 'interaction_out_of_range',
      message: 'dig target must be on current or adjacent tile',
    };
  }

  const tile = getTile(state, target.x, target.y);
  if (!tile || tile.rockType) {
    return { ok: false, code: 'dig_blocked_tile', message: 'dig target must not be a rock tile' };
  }

  if (tile.waterType && tile.waterDepth !== 'shallow') {
    return { ok: false, code: 'dig_blocked_tile', message: 'dig target may only be land or shallow water' };
  }

  const cacheInterruption = tile?.squirrelCache && tile.squirrelCache.discovered !== true;
  const requestedTickCost = Number.isFinite(Number(action.payload?.tickCost))
    ? Number(action.payload.tickCost)
    : Number(action.tickCost);
  const digBaseTickCost = cacheInterruption ? 3 : (requestedTickCost || 1);
  const digToolModifier = getDigToolModifier(actor);
  const normalizedTickCost = Math.max(1, Math.ceil(digBaseTickCost * digToolModifier));
  if (!Number.isInteger(normalizedTickCost) || normalizedTickCost <= 0) {
    return { ok: false, code: 'invalid_tick_cost', message: 'dig action tickCost must be a positive integer' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        x: target.x,
        y: target.y,
        interruptedBySquirrelCache: cacheInterruption,
      },
      tickCost: normalizedTickCost,
    },
  };
}

function validateEatAction(state, action, actor) {
  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  const quantity = Number.isInteger(action.payload?.quantity)
    ? action.payload.quantity
    : Math.floor(Number(action.payload?.quantity || 1));
  if (!itemId) {
    return { ok: false, code: 'missing_eat_item', message: 'eat requires payload.itemId' };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, code: 'invalid_eat_quantity', message: 'eat payload.quantity must be a positive integer' };
  }

  const stacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : [];
  const stack = findPreferredStackByItem(stacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
  if (available < quantity) {
    return { ok: false, code: 'insufficient_item_quantity', message: 'eat requires available item quantity in inventory' };
  }

  const fieldEdibilityScore = resolveFieldEdibilityScore(itemId);
  if (fieldEdibilityScore < MIN_FIELD_EDIBILITY_SCORE) {
    return {
      ok: false,
      code: 'item_not_field_edible',
      message: 'eat item edibility_score must be >= 0.85 for field eating',
      edibilityScore: fieldEdibilityScore,
      minFieldEdibilityScore: MIN_FIELD_EDIBILITY_SCORE,
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        itemId,
        quantity,
        returnItems: resolveEatReturnItems(itemId, quantity),
      },
    },
  };
}

function validateCampStockpileAddAction(state, action, actor) {
  if (!isActorWithinCampBounds(state, actor)) {
    return {
      ok: false,
      code: 'camp_out_of_range',
      message: 'camp_stockpile_add requires actor to be within camp bounds',
    };
  }

  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  const quantity = Number.isInteger(action.payload?.quantity)
    ? action.payload.quantity
    : Math.floor(Number(action.payload?.quantity || 1));
  if (!itemId) {
    return { ok: false, code: 'missing_stockpile_item', message: 'camp_stockpile_add requires payload.itemId' };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, code: 'invalid_stockpile_quantity', message: 'camp_stockpile_add payload.quantity must be a positive integer' };
  }

  const inventoryStacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : [];
  const inventoryStack = findPreferredStackByItem(inventoryStacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(inventoryStack?.quantity) || 0));
  if (available < quantity) {
    return { ok: false, code: 'insufficient_item_quantity', message: 'camp_stockpile_add requires available item quantity in actor inventory' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        itemId,
        quantity,
      },
    },
  };
}

function validateCampStockpileRemoveAction(state, action) {
  const actor = getActor(state, action.actorId);
  if (!isActorWithinCampBounds(state, actor)) {
    return {
      ok: false,
      code: 'camp_out_of_range',
      message: 'camp_stockpile_remove requires actor to be within camp bounds',
    };
  }

  const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
  const quantity = Number.isInteger(action.payload?.quantity)
    ? action.payload.quantity
    : Math.floor(Number(action.payload?.quantity || 1));
  if (!itemId) {
    return { ok: false, code: 'missing_stockpile_item', message: 'camp_stockpile_remove requires payload.itemId' };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { ok: false, code: 'invalid_stockpile_quantity', message: 'camp_stockpile_remove payload.quantity must be a positive integer' };
  }

  const campStacks = Array.isArray(state?.camp?.stockpile?.stacks) ? state.camp.stockpile.stacks : [];
  const campStack = findPreferredStackByItem(campStacks, itemId, quantity);
  const available = Math.max(0, Math.floor(Number(campStack?.quantity) || 0));
  if (available < quantity) {
    return { ok: false, code: 'insufficient_stockpile_quantity', message: 'camp_stockpile_remove requires available item quantity in camp stockpile' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        itemId,
        quantity,
      },
    },
  };
}

function validateCampStationBuildAction(state, action, actor) {
  if (!isActorWithinCampBounds(state, actor)) {
    return {
      ok: false,
      code: 'camp_out_of_range',
      message: 'camp_station_build requires actor to be within camp bounds',
    };
  }

  const stationId = typeof action.payload?.stationId === 'string' ? action.payload.stationId : '';
  const recipe = CAMP_STATION_RECIPES[stationId] || null;
  if (!recipe) {
    return {
      ok: false,
      code: 'unknown_station_recipe',
      message: 'camp_station_build requires known payload.stationId',
    };
  }

  if (!isUnlockEnabled(state, recipe.requiredUnlock)) {
    return {
      ok: false,
      code: 'missing_unlock',
      message: `camp_station_build recipe requires unlock: ${recipe.requiredUnlock}`,
      unlockKey: recipe.requiredUnlock,
    };
  }

  const alreadyBuilt = Array.isArray(state?.camp?.stationsUnlocked)
    && state.camp.stationsUnlocked.includes(recipe.stationId);
  if (alreadyBuilt) {
    return {
      ok: false,
      code: 'station_already_built',
      message: `station already built: ${recipe.stationId}`,
    };
  }

  const campBounds = getCampFootprintBounds(state);
  if (!campBounds) {
    return {
      ok: false,
      code: 'invalid_camp_anchor',
      message: 'camp_station_build requires a valid camp anchor',
    };
  }

  const hasExplicitX = Number.isInteger(action.payload?.x);
  const hasExplicitY = Number.isInteger(action.payload?.y);
  let placementX;
  let placementY;
  if (hasExplicitX && hasExplicitY) {
    placementX = action.payload.x;
    placementY = action.payload.y;
  } else if (!hasExplicitX && !hasExplicitY) {
    const auto = findFirstDefaultCampStationPlacement(state, campBounds);
    if (!auto) {
      return {
        ok: false,
        code: 'no_free_station_tile',
        message: 'camp_station_build has no free camp tile for station placement',
      };
    }
    placementX = auto.x;
    placementY = auto.y;
  } else {
    return {
      ok: false,
      code: 'invalid_station_placement',
      message: 'camp_station_build requires both payload.x and payload.y when specifying placement',
    };
  }

  if (
    placementX < campBounds.minX || placementX > campBounds.maxX
    || placementY < campBounds.minY || placementY > campBounds.maxY
  ) {
    return {
      ok: false,
      code: 'station_out_of_camp_bounds',
      message: 'camp_station_build requires placement within camp bounds',
    };
  }
  if (placementX === campBounds.anchorX && placementY === campBounds.anchorY) {
    return {
      ok: false,
      code: 'station_on_camp_anchor',
      message: 'camp_station_build cannot place a station on the camp anchor tile',
    };
  }
  if (!inBounds(state, placementX, placementY)) {
    return {
      ok: false,
      code: 'station_out_of_bounds',
      message: 'camp_station_build placement tile is out of world bounds',
    };
  }
  if (isTileOccupiedByCampStation(state, placementX, placementY)) {
    return {
      ok: false,
      code: 'station_tile_occupied',
      message: 'camp_station_build requires an unoccupied camp tile (one station per tile)',
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        stationId: recipe.stationId,
        x: placementX,
        y: placementY,
      },
      tickCost: recipe.craftTicks,
    },
  };
}

function validateToolCraftAction(state, action, actor) {
  const recipeId = typeof action.payload?.recipeId === 'string'
    ? action.payload.recipeId
    : typeof action.payload?.toolId === 'string' ? action.payload.toolId : '';
  const recipe = TOOL_RECIPES[recipeId] || null;
  if (!recipe) {
    return {
      ok: false,
      code: 'unknown_tool_recipe',
      message: 'tool_craft requires known payload.recipeId',
    };
  }

  if (!isUnlockEnabled(state, recipe.requiredUnlock)) {
    return {
      ok: false,
      code: 'missing_unlock',
      message: `tool_craft recipe requires unlock: ${recipe.requiredUnlock}`,
      unlockKey: recipe.requiredUnlock,
    };
  }

  if (recipe.recipeId === 'carved_wooden_spout' && !hasInventoryItem(actor, 'tool:flint_knife')) {
    return {
      ok: false,
      code: 'missing_required_tool',
      message: 'tool_craft carved_wooden_spout requires tool:flint_knife in inventory',
      requiredToolId: 'tool:flint_knife',
    };
  }

  if (recipe.recipeId === 'bone_hook' && !hasInventoryItem(actor, 'tool:flint_knife')) {
    return {
      ok: false,
      code: 'missing_required_tool',
      message: 'tool_craft bone_hook requires tool:flint_knife in inventory',
      requiredToolId: 'tool:flint_knife',
    };
  }

  const materialPlanResult = buildToolCraftMaterialPlan(actor, recipe);
  if (!materialPlanResult.ok) {
    const missingType = typeof materialPlanResult?.missing?.type === 'string' ? materialPlanResult.missing.type : '';
    const requiredItemId = missingType === 'item' ? materialPlanResult.missing.itemId : null;
    const requiredCraftTag = missingType === 'tag' ? materialPlanResult.missing.tag : null;
    return {
      ok: false,
      code: 'insufficient_item_quantity',
      message: 'tool_craft requires recipe materials in inventory',
      ...(requiredItemId ? { requiredItemId } : {}),
      ...(requiredCraftTag ? { requiredCraftTag } : {}),
    };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        recipeId: recipe.recipeId,
        outputItemId: recipe.outputItemId,
        outputQuantity: recipe.outputQuantity,
        ...(Number.isInteger(recipe.outputFootprintW) && recipe.outputFootprintW > 0
          ? { outputFootprintW: recipe.outputFootprintW }
          : {}),
        ...(Number.isInteger(recipe.outputFootprintH) && recipe.outputFootprintH > 0
          ? { outputFootprintH: recipe.outputFootprintH }
          : {}),
        materialPlan: materialPlanResult.materialPlan,
      },
      tickCost: getToolCraftTickCost(state, actor, recipe),
    },
  };
}

function countIdMultiset(ids) {
  const m = new Map();
  for (const id of ids) {
    m.set(id, (m.get(id) || 0) + 1);
  }
  return m;
}

function multisetsEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const [k, v] of a) {
    if (b.get(k) !== v) {
      return false;
    }
  }
  return true;
}

function validatePartnerQueueReorderAction(state, action) {
  const partner = getActor(state, 'partner');
  if (!partner) {
    return { ok: false, code: 'missing_partner', message: 'partner actor is required for partner_queue_reorder' };
  }
  if ((Number(partner.health) || 0) <= 0) {
    return { ok: false, code: 'partner_unavailable', message: 'partner actor is unavailable (health <= 0)' };
  }
  if (state?.camp?.debrief?.active !== true) {
    return {
      ok: false,
      code: 'partner_queue_reorder_debrief_only',
      message: 'Partner queue reorder is only available during nightly debrief.',
    };
  }
  const queue = state?.camp?.partnerTaskQueue;
  const queued = Array.isArray(queue?.queued) ? queue.queued : [];
  const rawIds = action.payload?.orderedTaskIds;
  if (!Array.isArray(rawIds) || rawIds.length !== queued.length) {
    return {
      ok: false,
      code: 'invalid_partner_queue_reorder',
      message: 'orderedTaskIds must list every queued partner task exactly once.',
    };
  }
  const orderedTaskIds = rawIds.map((id) => (typeof id === 'string' ? id : ''));
  if (orderedTaskIds.some((id) => !id)) {
    return {
      ok: false,
      code: 'invalid_partner_queue_reorder',
      message: 'Each orderedTaskIds entry must be a non-empty string (taskId).',
    };
  }
  const currentIds = queued.map((t) => (typeof t?.taskId === 'string' ? t.taskId : ''));
  if (currentIds.some((id) => !id)) {
    return {
      ok: false,
      code: 'invalid_partner_queue_reorder',
      message: 'All queued partner tasks must have a taskId before reordering.',
    };
  }
  if (!multisetsEqual(countIdMultiset(currentIds), countIdMultiset(orderedTaskIds))) {
    return {
      ok: false,
      code: 'invalid_partner_queue_reorder',
      message: 'orderedTaskIds must be a reorder of the current queue (same taskIds).',
    };
  }
  const maint = queued.find((t) => t?.kind === CAMP_MAINTENANCE_TASK_KIND);
  if (maint && orderedTaskIds[0] !== maint.taskId) {
    return {
      ok: false,
      code: 'maintenance_must_lead',
      message: 'Camp maintenance must remain first in the partner queue.',
    };
  }
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: { orderedTaskIds },
    },
  };
}

function validatePartnerTaskSetAction(state, action) {
  const partner = getActor(state, 'partner');
  if (!partner) {
    return { ok: false, code: 'missing_partner', message: 'partner actor is required for partner_task_set actions' };
  }
  if ((Number(partner.health) || 0) <= 0) {
    return { ok: false, code: 'partner_unavailable', message: 'partner actor is unavailable (health <= 0)' };
  }

  const rawTask = action.payload?.task && typeof action.payload.task === 'object'
    ? action.payload.task
    : action.payload;
  const taskKind = typeof rawTask?.kind === 'string'
    ? rawTask.kind
    : typeof rawTask?.taskKind === 'string' ? rawTask.taskKind : '';
  const ticksRequiredRaw = Number.isInteger(rawTask?.ticksRequired)
    ? rawTask.ticksRequired
    : Math.floor(Number(rawTask?.ticksRequired || 0));
  if (!taskKind) {
    return { ok: false, code: 'invalid_partner_task_kind', message: 'partner_task_set requires payload.task.kind (string)' };
  }

  const rawQueuePolicyHead = typeof action.payload?.queuePolicy === 'string'
    ? action.payload.queuePolicy
    : typeof rawTask?.queuePolicy === 'string' ? rawTask.queuePolicy : 'append';
  if (rawQueuePolicyHead === 'replace') {
    const activePartnerTask = state?.camp?.partnerTaskQueue?.active;
    if (activePartnerTask?.kind === CAMP_MAINTENANCE_TASK_KIND) {
      return {
        ok: false,
        code: 'maintenance_active',
        message: 'Finish camp maintenance before replacing the active partner task.',
      };
    }
  }

  if (taskKind === TECH_RESEARCH_TASK_KIND) {
    const meta = rawTask?.meta && typeof rawTask.meta === 'object' ? rawTask.meta : {};
    const unlockKey = typeof meta.unlockKey === 'string' ? meta.unlockKey : '';
    if (!unlockKey) {
      return { ok: false, code: 'invalid_tech_research', message: 'tech_research requires meta.unlockKey' };
    }
    const node = getTechForestNode(state?.techForest, unlockKey);
    if (!node) {
      return { ok: false, code: 'unknown_tech_unlock', message: `unknown tech unlock: ${unlockKey}` };
    }
    const visionGranted = state?.techUnlockVisionGranted && typeof state.techUnlockVisionGranted === 'object'
      ? state.techUnlockVisionGranted
      : null;
    const partnerResearched = state?.techUnlockPartnerResearch && typeof state.techUnlockPartnerResearch === 'object'
      ? state.techUnlockPartnerResearch
      : null;
    const solidifyingVisionGrant = isUnlockEnabled(state, unlockKey)
      && visionGranted?.[unlockKey] === true
      && partnerResearched?.[unlockKey] !== true;
    if (isUnlockEnabled(state, unlockKey) && !solidifyingVisionGrant) {
      return { ok: false, code: 'tech_already_researched', message: `already researched: ${unlockKey}` };
    }
    if (node.parentUnlockKey) {
      const childBlock = getTechForestChildResearchBlocker(
        state?.techForest,
        state?.techUnlocks,
        node.parentUnlockKey,
        visionGranted,
        partnerResearched,
      );
      if (childBlock) {
        return {
          ok: false,
          code: 'tech_prerequisite_missing',
          message: childBlock.reason === 'vision_parent'
            ? `research requires partner camp research on prerequisite: ${childBlock.blockerKey}`
            : `research requires prerequisite: ${childBlock.blockerKey}`,
          unlockKey: childBlock.blockerKey,
        };
      }
    }
    if (!Number.isInteger(ticksRequiredRaw) || ticksRequiredRaw <= 0) {
      return { ok: false, code: 'invalid_partner_task_ticks', message: 'partner_task_set requires payload.task.ticksRequired (positive integer)' };
    }
    if (ticksRequiredRaw !== node.researchTicks) {
      return {
        ok: false,
        code: 'tech_research_tick_mismatch',
        message: `tech research ticks must be ${node.researchTicks}`,
      };
    }
    const taskInputsTech = normalizeTaskInputs(rawTask?.inputs);
    if (taskInputsTech.length > 0) {
      return { ok: false, code: 'invalid_tech_research', message: 'tech_research must not include stockpile inputs' };
    }

    const rawQueuePolicyTech = typeof action.payload?.queuePolicy === 'string'
      ? action.payload.queuePolicy
      : typeof rawTask?.queuePolicy === 'string' ? rawTask.queuePolicy : 'append';
    const queuePolicyTech = rawQueuePolicyTech === 'replace' || rawQueuePolicyTech === 'append'
      ? rawQueuePolicyTech
      : '';
    if (!queuePolicyTech) {
      return {
        ok: false,
        code: 'invalid_partner_task_queue_policy',
        message: 'partner_task_set payload.queuePolicy must be "append" or "replace"',
      };
    }

    const taskIdTech = typeof rawTask?.taskId === 'string' && rawTask.taskId
      ? rawTask.taskId
      : `${action.actionId}:task`;

    const emptyReq = { stations: [], unlocks: [] };
    return {
      ok: true,
      code: null,
      message: 'ok',
      normalizedAction: {
        ...action,
        payload: {
          ...action.payload,
          queuePolicy: queuePolicyTech,
          task: {
            taskId: taskIdTech,
            kind: taskKind,
            ticksRequired: ticksRequiredRaw,
            inputs: [],
            requirements: emptyReq,
            outputs: [],
            status: 'queued',
            failureReason: null,
            meta: { ...meta, unlockKey },
          },
        },
      },
    };
  }

  if (taskKind === CAMP_MAINTENANCE_TASK_KIND) {
    return {
      ok: false,
      code: 'reserved_task_kind',
      message: 'Camp maintenance is scheduled automatically and cannot be set manually.',
    };
  }

  if (taskKind === 'spin_cordage') {
    const taskInputsSpin = normalizeTaskInputs(rawTask?.inputs);
    const fiberLines = [];
    for (const input of taskInputsSpin) {
      if (input.source !== 'camp_stockpile' || input.required === false) {
        continue;
      }
      if (!resolveCraftTagsForItem(input.itemId).includes('cordage_fiber')) {
        return {
          ok: false,
          code: 'invalid_spin_input',
          message: 'spin_cordage stockpile inputs must be cordage fiber material.',
        };
      }
      fiberLines.push(input);
    }
    if (fiberLines.length < 1) {
      return {
        ok: false,
        code: 'spin_requires_fiber',
        message: 'spin_cordage requires cordage fiber from the camp stockpile.',
      };
    }
    const fiberItemIds = new Set(fiberLines.map((line) => line.itemId));
    if (fiberItemIds.size !== 1) {
      return {
        ok: false,
        code: 'spin_single_fiber',
        message: 'spin_cordage supports one fiber item type per batch.',
      };
    }
    const fiberItemId = fiberLines[0].itemId;
    const fiberUnits = fiberLines.reduce(
      (sum, line) => sum + Math.max(0, Math.floor(Number(line.quantity) || 0)),
      0,
    );
    if (fiberUnits < 1) {
      return {
        ok: false,
        code: 'spin_requires_fiber',
        message: 'spin_cordage requires a positive fiber quantity.',
      };
    }

    const stockpileByItemIdSpin = buildCampStockpileQuantityMap(state);
    for (const input of fiberLines) {
      const available = Math.max(0, Math.floor(Number(stockpileByItemIdSpin[input.itemId]) || 0));
      const q = Math.max(0, Math.floor(Number(input.quantity) || 0));
      if (available < q) {
        return {
          ok: false,
          code: 'insufficient_stockpile_quantity',
          message: `partner_task_set requires ${q}x ${input.itemId} in camp stockpile`,
          requiredItemId: input.itemId,
        };
      }
    }

    const useSpinner = hasCampStationUnlocked(state, 'thread_spinner');
    const spinHint = useSpinner ? 'thread_spinner' : 'hand';
    const spinDescriptor = resolveProcessingDescriptor(fiberItemId, 'spin_cordage', spinHint);
    if (!spinDescriptor?.processOption) {
      return {
        ok: false,
        code: 'unknown_process_option',
        message: 'That fiber cannot be spun into cordage.',
      };
    }

    const ticksRequiredSpin = getPartnerTaskTicksRequired(state, 'spin_cordage', 4 * fiberUnits);
    const outputsSpin = computeProcessOutputs(spinDescriptor, fiberUnits);
    const taskRequirementsSpin = normalizeTaskRequirements(null, useSpinner ? 'thread_spinner' : null);

    const rawQueuePolicySpin = typeof action.payload?.queuePolicy === 'string'
      ? action.payload.queuePolicy
      : typeof rawTask?.queuePolicy === 'string' ? rawTask.queuePolicy : 'append';
    const queuePolicySpin = rawQueuePolicySpin === 'replace' || rawQueuePolicySpin === 'append'
      ? rawQueuePolicySpin
      : '';
    if (!queuePolicySpin) {
      return {
        ok: false,
        code: 'invalid_partner_task_queue_policy',
        message: 'partner_task_set payload.queuePolicy must be "append" or "replace"',
      };
    }

    const taskIdSpin = typeof rawTask?.taskId === 'string' && rawTask.taskId
      ? rawTask.taskId
      : `${action.actionId}:task`;

    return {
      ok: true,
      code: null,
      message: 'ok',
      normalizedAction: {
        ...action,
        payload: {
          ...action.payload,
          queuePolicy: queuePolicySpin,
          task: {
            taskId: taskIdSpin,
            kind: taskKind,
            ticksRequired: ticksRequiredSpin,
            inputs: taskInputsSpin,
            requirements: taskRequirementsSpin,
            outputs: normalizeTaskOutputs(outputsSpin),
            status: 'queued',
            failureReason: null,
            meta: {
              ...(rawTask?.meta && typeof rawTask.meta === 'object' ? rawTask.meta : {}),
              source: 'stockpile_process',
              itemId: fiberItemId,
              processId: 'spin_cordage',
              quantity: fiberUnits,
              processLocation: useSpinner ? 'thread_spinner' : 'hand',
            },
          },
        },
      },
    };
  }

  const requiredStationId = getRequiredStationForPartnerTask(taskKind);
  const taskRequirements = normalizeTaskRequirements(rawTask?.requirements, requiredStationId);
  for (const stationId of taskRequirements.stations) {
    if (hasCampStationUnlocked(state, stationId)) {
      continue;
    }
    return {
      ok: false,
      code: 'missing_station',
      message: `partner_task_set task kind ${taskKind} requires station: ${stationId}`,
      stationId,
    };
  }
  for (const unlockKey of taskRequirements.unlocks) {
    if (isUnlockEnabled(state, unlockKey)) {
      continue;
    }
    return {
      ok: false,
      code: 'missing_unlock',
      message: `partner_task_set task kind ${taskKind} requires unlock: ${unlockKey}`,
      unlockKey,
    };
  }

  if (!Number.isInteger(ticksRequiredRaw) || ticksRequiredRaw <= 0) {
    return { ok: false, code: 'invalid_partner_task_ticks', message: 'partner_task_set requires payload.task.ticksRequired (positive integer)' };
  }

  const ticksRequired = getPartnerTaskTicksRequired(state, taskKind, ticksRequiredRaw);
  const taskInputs = normalizeTaskInputs(rawTask?.inputs);
  const stockpileByItemId = buildCampStockpileQuantityMap(state);
  for (const input of taskInputs) {
    if (input.source !== 'camp_stockpile' || input.required === false) {
      continue;
    }
    const available = Math.max(0, Math.floor(Number(stockpileByItemId[input.itemId]) || 0));
    if (available >= input.quantity) {
      continue;
    }
    return {
      ok: false,
      code: 'insufficient_stockpile_quantity',
      message: `partner_task_set requires ${input.quantity}x ${input.itemId} in camp stockpile`,
      requiredItemId: input.itemId,
    };
  }

  const rawQueuePolicy = typeof action.payload?.queuePolicy === 'string'
    ? action.payload.queuePolicy
    : typeof rawTask?.queuePolicy === 'string' ? rawTask.queuePolicy : 'append';
  const queuePolicy = rawQueuePolicy === 'replace' || rawQueuePolicy === 'append'
    ? rawQueuePolicy
    : '';
  if (!queuePolicy) {
    return {
      ok: false,
      code: 'invalid_partner_task_queue_policy',
      message: 'partner_task_set payload.queuePolicy must be "append" or "replace"',
    };
  }

  const taskId = typeof rawTask?.taskId === 'string' && rawTask.taskId
    ? rawTask.taskId
    : `${action.actionId}:task`;

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        queuePolicy,
        task: {
          taskId,
          kind: taskKind,
          ticksRequired,
          inputs: taskInputs,
          requirements: taskRequirements,
          outputs: normalizeTaskOutputs(rawTask?.outputs),
          status: 'queued',
          failureReason: null,
          meta: rawTask?.meta && typeof rawTask.meta === 'object' ? { ...rawTask.meta } : null,
        },
      },
    },
  };
}

export function getActionTickCost(kind, payload = {}) {
  return normalizeTickCost(kind, payload);
}

function validateInventoryRelocateStackAction(state, action, actor) {
  const stackIndex = Number.isInteger(action.payload?.stackIndex)
    ? action.payload.stackIndex
    : Math.floor(Number(action.payload?.stackIndex));
  const slotX = Number.isInteger(action.payload?.slotX)
    ? action.payload.slotX
    : Math.floor(Number(action.payload?.slotX));
  const slotY = Number.isInteger(action.payload?.slotY)
    ? action.payload.slotY
    : Math.floor(Number(action.payload?.slotY));
  if (!Number.isInteger(stackIndex)) {
    return {
      ok: false,
      code: 'invalid_relocation_payload',
      message: 'inventory_relocate_stack requires integer payload.stackIndex',
    };
  }
  if (!Number.isInteger(slotX) || !Number.isInteger(slotY)) {
    return {
      ok: false,
      code: 'invalid_relocation_payload',
      message: 'inventory_relocate_stack requires integer payload.slotX and payload.slotY',
    };
  }
  const check = checkActorInventoryRelocation(actor, stackIndex, slotX, slotY);
  if (!check.ok) {
    return {
      ok: false,
      code: check.code,
      message: check.message,
    };
  }
  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        stackIndex,
        slotX,
        slotY,
      },
    },
  };
}

function validateMoveAction(state, action, actor) {
  const dx = Number(action.payload?.dx);
  const dy = Number(action.payload?.dy);
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) {
    return { ok: false, code: 'invalid_move_payload', message: 'move requires integer dx and dy payload values' };
  }

  const nextX = Number(actor.x) + dx;
  const nextY = Number(actor.y) + dy;
  if (!inBounds(state, nextX, nextY)) {
    return { ok: false, code: 'move_out_of_bounds', message: 'move target is out of bounds' };
  }
  const tile = getTile(state, nextX, nextY);
  if (!tile || tile.rockType) {
    return { ok: false, code: 'move_blocked_tile', message: 'move target must not be a rock tile' };
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        dx,
        dy,
      },
    },
  };
}

export function validateAction(state, rawAction, options = {}) {
  const fallbackIssuedAtTick = Number.isInteger(options?.fallbackIssuedAtTick)
    ? options.fallbackIssuedAtTick
    : Number(state?.dayTick) || 0;
  const action = normalizeActionEnvelope(rawAction, fallbackIssuedAtTick);

  if (!ACTION_KINDS.includes(action.kind)) {
    return { ok: false, code: 'unknown_action_kind', message: `unknown action kind: ${action.kind || '(empty)'}` };
  }

  if (!action.actorId) {
    return { ok: false, code: 'missing_actor_id', message: 'action actorId is required' };
  }

  const actor = getActor(state, action.actorId);
  if (!actor) {
    return { ok: false, code: 'missing_actor', message: `actor does not exist: ${action.actorId}` };
  }

  if ((Number(actor.health) || 0) <= 0) {
    return { ok: false, code: 'actor_unavailable', message: `actor ${action.actorId} is unavailable (health <= 0)` };
  }

  const unlockCheck = isActionUnlocked(state, action.kind);
  if (!unlockCheck.unlocked) {
    return {
      ok: false,
      code: 'missing_unlock',
      message: `${action.kind} requires unlock: ${unlockCheck.unlockKey}`,
      unlockKey: unlockCheck.unlockKey,
    };
  }

  if (!Number.isInteger(action.tickCost) || action.tickCost < 0) {
    return { ok: false, code: 'invalid_tick_cost', message: 'action tickCost must be a non-negative integer' };
  }

  let validationResult;
  if (action.kind === 'move') {
    validationResult = validateMoveAction(state, action, actor);
  } else if (action.kind === 'harvest') {
    validationResult = validateHarvestAction(state, action, actor);
  } else if (action.kind === 'fell_tree') {
    validationResult = validateFellTreeAction(state, action, actor);
  } else if (action.kind === 'trap_place_snare') {
    validationResult = validateTrapPlaceSnareAction(state, action, actor);
  } else if (action.kind === 'trap_place_deadfall') {
    validationResult = validateTrapPlaceDeadfallAction(state, action, actor);
  } else if (action.kind === 'trap_place_fish_weir') {
    validationResult = validateTrapPlaceFishWeirAction(state, action, actor);
  } else if (action.kind === 'auto_rod_place') {
    validationResult = validateAutoRodPlaceAction(state, action, actor);
  } else if (action.kind === 'trap_check') {
    validationResult = validateTrapCheckAction(state, action, actor);
  } else if (action.kind === 'trap_bait') {
    validationResult = validateTrapBaitAction(state, action, actor);
  } else if (action.kind === 'trap_retrieve') {
    validationResult = validateTrapRetrieveAction(state, action, actor);
  } else if (action.kind === 'trap_pickup') {
    validationResult = validateTrapPickupAction(state, action, actor);
  } else if (action.kind === 'trap_remove_bait') {
    validationResult = validateTrapRemoveBaitAction(state, action, actor);
  } else if (action.kind === 'marker_place') {
    validationResult = validateMarkerPlaceAction(state, action, actor);
  } else if (action.kind === 'marker_remove') {
    validationResult = validateMarkerRemoveAction(state, action, actor);
  } else if (action.kind === 'fish_rod_cast') {
    validationResult = validateFishRodCastAction(state, action, actor);
  } else if (action.kind === 'inspect') {
    validationResult = validateInspectAction(state, action, actor);
  } else if (action.kind === 'dig') {
    validationResult = validateDigAction(state, action, actor);
  } else if (action.kind === 'hoe') {
    validationResult = validateHoeAction(state, action, actor);
  } else if (action.kind === 'tap_insert_spout') {
    validationResult = validateTapInsertSpoutAction(state, action, actor);
  } else if (action.kind === 'tap_remove_spout') {
    validationResult = validateTapRemoveSpoutAction(state, action, actor);
  } else if (action.kind === 'tap_place_vessel') {
    validationResult = validateTapPlaceVesselAction(state, action, actor);
  } else if (action.kind === 'tap_retrieve_vessel') {
    validationResult = validateTapRetrieveVesselAction(state, action, actor);
  } else if (action.kind === 'waterskin_fill') {
    validationResult = validateWaterskinFillAction(state, action, actor);
  } else if (action.kind === 'waterskin_drink') {
    validationResult = validateWaterskinDrinkAction(state, action, actor);
  } else if (action.kind === 'water_drink') {
    validationResult = validateWaterDrinkAction(state, action, actor);
  } else if (action.kind === 'leaching_basket_place') {
    validationResult = validateLeachingBasketPlaceAction(state, action, actor);
  } else if (action.kind === 'leaching_basket_retrieve') {
    validationResult = validateLeachingBasketRetrieveAction(state, action, actor);
  } else if (action.kind === 'item_pickup') {
    validationResult = validateItemPickupAction(state, action, actor);
  } else if (action.kind === 'item_drop') {
    validationResult = validateItemDropAction(state, action, actor);
  } else if (action.kind === 'eat') {
    validationResult = validateEatAction(state, action, actor);
  } else if (action.kind === 'process_item') {
    validationResult = validateProcessItemAction(state, action, actor);
  } else if (action.kind === 'camp_stockpile_add') {
    validationResult = validateCampStockpileAddAction(state, action, actor);
  } else if (action.kind === 'camp_stockpile_remove') {
    validationResult = validateCampStockpileRemoveAction(state, action);
  } else if (action.kind === 'camp_drying_rack_add') {
    validationResult = validateCampDryingRackAddAction(state, action, actor);
  } else if (action.kind === 'camp_drying_rack_add_inventory') {
    validationResult = validateCampDryingRackAddInventoryAction(state, action, actor);
  } else if (action.kind === 'camp_drying_rack_remove') {
    validationResult = validateCampDryingRackRemoveAction(state, action, actor);
  } else if (action.kind === 'meal_plan_set') {
    validationResult = validateMealPlanSetAction(state, action, actor);
  } else if (action.kind === 'meal_plan_commit') {
    validationResult = validateMealPlanCommitAction(state, action, actor);
  } else if (action.kind === 'camp_station_build') {
    validationResult = validateCampStationBuildAction(state, action, actor);
  } else if (action.kind === 'tool_craft') {
    validationResult = validateToolCraftAction(state, action, actor);
  } else if (action.kind === 'equip_item') {
    validationResult = validateEquipItemAction(state, action, actor);
  } else if (action.kind === 'unequip_item') {
    validationResult = validateUnequipItemAction(state, action, actor);
  } else if (action.kind === 'partner_task_set') {
    validationResult = validatePartnerTaskSetAction(state, action);
  } else if (action.kind === 'partner_queue_reorder') {
    validationResult = validatePartnerQueueReorderAction(state, action);
  } else if (action.kind === 'debrief_enter') {
    validationResult = validateDebriefEnterAction(state, action, actor);
  } else if (action.kind === 'debrief_exit') {
    validationResult = validateDebriefExitAction(state, action, actor);
  } else if (action.kind === 'partner_medicine_administer') {
    validationResult = validatePartnerMedicineAdministerAction(state, action, actor);
  } else if (action.kind === 'partner_vision_request') {
    validationResult = validatePartnerVisionRequestAction(state, action, actor);
  } else if (action.kind === 'partner_vision_confirm') {
    validationResult = validatePartnerVisionConfirmAction(state, action, actor);
  } else if (action.kind === 'partner_vision_choose') {
    validationResult = validatePartnerVisionChooseAction(state, action, actor);
  } else if (action.kind === 'nature_sight_overlay_set') {
    validationResult = validateNatureSightOverlaySetAction(state, action, actor);
  } else if (action.kind === 'inventory_relocate_stack') {
    validationResult = validateInventoryRelocateStackAction(state, action, actor);
  } else {
    validationResult = {
      ok: true,
      code: null,
      message: 'ok',
      normalizedAction: action,
    };
  }

  return gateActorTickBudget(actor, validationResult);
}

export function previewAction(state, rawAction, options = {}) {
  const fallbackIssuedAtTick = Number.isInteger(options?.fallbackIssuedAtTick)
    ? options.fallbackIssuedAtTick
    : Number(state?.dayTick) || 0;
  const envelope = normalizeActionEnvelope(rawAction, fallbackIssuedAtTick);
  const validation = validateAction(state, rawAction, options);

  if (validation.ok) {
    const tc = Number(validation?.normalizedAction?.tickCost);
    return {
      ...validation,
      tickCost: Number.isInteger(tc) ? tc : 1,
    };
  }

  const envTc = Number(envelope.tickCost);
  return {
    ...validation,
    tickCost: Number.isInteger(envTc) ? envTc : 1,
    normalizedAction: envelope,
  };
}

export function getAllActions(state, actorId) {
  const actor = getActor(state, actorId);
  if (!actor || (Number(actor.health) || 0) <= 0) {
    return ACTION_KINDS.map((kind) => ({
      kind,
      available: false,
      reason: !actor ? 'missing_actor' : 'actor_unavailable',
      tickCost: ACTION_TICK_COST[kind] ?? 1,
    }));
  }

  return ACTION_KINDS.map((kind) => {
    const tickCost = ACTION_TICK_COST[kind] ?? 1;
    if (!actorCanSpendTickBudget(actor, tickCost)) {
      return {
        kind,
        available: false,
        reason: 'no_tick_budget',
        tickCost,
      };
    }
    const unlockCheck = isActionUnlocked(state, kind);
    return {
      kind,
      available: unlockCheck.unlocked,
      reason: unlockCheck.unlocked ? null : 'missing_unlock',
      unlockKey: unlockCheck.unlocked ? null : unlockCheck.unlockKey,
      tickCost,
    };
  });
}

export function sortActionsDeterministically(actions) {
  return [...(actions || [])].sort((a, b) => {
    const tickA = Number.isInteger(a?.issuedAtTick) ? a.issuedAtTick : 0;
    const tickB = Number.isInteger(b?.issuedAtTick) ? b.issuedAtTick : 0;
    if (tickA !== tickB) {
      return tickA - tickB;
    }

    const actorCompare = String(a?.actorId || '').localeCompare(String(b?.actorId || ''));
    if (actorCompare !== 0) {
      return actorCompare;
    }

    return String(a?.actionId || '').localeCompare(String(b?.actionId || ''));
  });
}

export function defaultActors(width, height) {
  const spawnX = Math.max(0, Math.floor(Number(width) / 2));
  const spawnY = Math.max(0, Math.floor(Number(height) / 2));

  return {
    player: {
      id: 'player',
      role: 'player',
      x: spawnX,
      y: spawnY,
      hunger: 1,
      thirst: 1,
      health: 1,
      tickBudgetBase: 200,
      tickBudgetCurrent: 200,
      overdraftTicks: 0,
      visionNextDayTickPenalty: 0,
      natureSightDaysRemaining: 0,
      natureSightPendingDays: 0,
      natureSightOverlayChoice: null,
      natureSightOverlayChosenDay: null,
      natureSightPlantSpeciesId: null,
      natureSightAnimalSpeciesId: null,
      natureSightFishSpeciesId: null,
      visionRewardCounts: {
        plant: 0,
        tech: 0,
        sight: 0,
      },
      inventory: {
        gridWidth: 6,
        gridHeight: 4,
        maxCarryWeightKg: 15,
        stacks: [],
        equipment: {
          gloves: null,
          coat: null,
          head: null,
        },
      },
    },
    partner: {
      id: 'partner',
      role: 'partner',
      x: spawnX,
      y: spawnY,
      hunger: 1,
      thirst: 1,
      health: 1,
      tickBudgetBase: 200,
      tickBudgetCurrent: 200,
      overdraftTicks: 0,
      visionNextDayTickPenalty: 0,
      natureSightDaysRemaining: 0,
      natureSightPendingDays: 0,
      natureSightOverlayChoice: null,
      natureSightOverlayChosenDay: null,
      natureSightPlantSpeciesId: null,
      natureSightAnimalSpeciesId: null,
      natureSightFishSpeciesId: null,
      visionRewardCounts: {
        plant: 0,
        tech: 0,
        sight: 0,
      },
      inventory: {
        gridWidth: 6,
        gridHeight: 4,
        maxCarryWeightKg: 15,
        stacks: [],
        equipment: {
          gloves: null,
          coat: null,
          head: null,
        },
      },
      taskQueue: {
        active: null,
        queued: [],
      },
    },
  };
}

export function cloneActors(actors) {
  const cloned = {};
  for (const [actorId, actor] of Object.entries(actors || {})) {
    cloned[actorId] = {
      ...actor,
      natureSightOverlayChosenDay: Number.isInteger(actor?.natureSightOverlayChosenDay)
        ? actor.natureSightOverlayChosenDay
        : null,
      natureSightPlantSpeciesId: typeof actor?.natureSightPlantSpeciesId === 'string'
        ? actor.natureSightPlantSpeciesId
        : null,
      natureSightAnimalSpeciesId: typeof actor?.natureSightAnimalSpeciesId === 'string'
        ? actor.natureSightAnimalSpeciesId
        : null,
      natureSightFishSpeciesId: typeof actor?.natureSightFishSpeciesId === 'string'
        ? actor.natureSightFishSpeciesId
        : null,
      visionRewardCounts: actor?.visionRewardCounts && typeof actor.visionRewardCounts === 'object'
        ? {
          plant: Math.max(0, Math.floor(Number(actor.visionRewardCounts.plant) || 0)),
          tech: Math.max(0, Math.floor(Number(actor.visionRewardCounts.tech) || 0)),
          sight: Math.max(0, Math.floor(Number(actor.visionRewardCounts.sight) || 0)),
        }
        : {
          plant: 0,
          tech: 0,
          sight: 0,
        },
      inventory: actor?.inventory
        ? {
          ...actor.inventory,
          stacks: Array.isArray(actor.inventory.stacks)
            ? actor.inventory.stacks.map((entry) => ({ ...entry }))
            : [],
          equipment: {
            gloves: actor.inventory?.equipment?.gloves
              ? { ...actor.inventory.equipment.gloves }
              : null,
            coat: actor.inventory?.equipment?.coat
              ? { ...actor.inventory.equipment.coat }
              : null,
            head: actor.inventory?.equipment?.head
              ? { ...actor.inventory.equipment.head }
              : null,
          },
        }
        : null,
      taskQueue: actor?.taskQueue
        ? {
          active: actor.taskQueue.active ? { ...actor.taskQueue.active } : null,
          queued: Array.isArray(actor.taskQueue.queued)
            ? actor.taskQueue.queued.map((task) => ({ ...task }))
            : [],
        }
        : null,
    };
  }
  return cloned;
}
