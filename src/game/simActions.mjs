import { PLANT_BY_ID } from './plantCatalog.mjs';
import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { ITEM_BY_ID } from './itemCatalog.mjs';

const ACTION_KINDS = [
  'move',
  'harvest',
  'fell_tree',
  'trap_place_snare',
  'trap_place_deadfall',
  'trap_place_fish_weir',
  'auto_rod_place',
  'trap_check',
  'fish_rod_cast',
  'inspect',
  'dig',
  'hoe',
  'tap_insert_spout',
  'tap_remove_spout',
  'tap_place_vessel',
  'tap_retrieve_vessel',
  'item_pickup',
  'item_drop',
  'eat',
  'process_item',
  'camp_stockpile_add',
  'camp_stockpile_remove',
  'camp_drying_rack_add',
  'camp_drying_rack_add_inventory',
  'camp_drying_rack_remove',
  'camp_station_build',
  'tool_craft',
  'partner_task_set',
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
  fish_rod_cast: 5,
  inspect: 1,
  dig: 1,
  hoe: 2,
  tap_insert_spout: 2,
  tap_remove_spout: 1,
  tap_place_vessel: 1,
  tap_retrieve_vessel: 1,
  item_pickup: 1,
  item_drop: 1,
  eat: 2,
  process_item: 1,
  camp_stockpile_add: 1,
  camp_stockpile_remove: 1,
  camp_drying_rack_add: 1,
  camp_drying_rack_add_inventory: 1,
  camp_drying_rack_remove: 1,
  camp_station_build: 1,
  tool_craft: 1,
  partner_task_set: 1,
};

const MIN_FIELD_EDIBILITY_SCORE = 0.85;
const MIN_FISH_ROD_CAST_TICKS = 5;
const EARTHWORM_ITEM_ID = 'earthworm';

const CAMP_STATION_RECIPES = {
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

const TOOL_RECIPES = {
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
      { type: 'tag', tag: 'flexible_shoot', quantity: 12 },
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
          { type: 'tag', tag: 'bark_sheet', quantity: 1 },
          { type: 'item', itemId: 'hide', quantity: 800 },
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

function normalizeTickCost(kind, payload) {
  const requested = Number(payload?.tickCost);
  if (Number.isInteger(requested) && requested > 0) {
    return requested;
  }
  return ACTION_TICK_COST[kind] || 1;
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

  const actorBudget = getActorBudgetCurrent(actor);
  if (action.tickCost > actorBudget) {
    return {
      ok: false,
      code: 'invalid_tick_cost',
      message: 'fish_rod_cast tickCost cannot exceed actor current budget',
      maxTickCost: actorBudget,
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

  const unlockValue = state?.techUnlocks?.[unlockKey];
  return {
    unlocked: unlockValue !== false,
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
  if (typeof itemId !== 'string' || !itemId.includes(':')) {
    return null;
  }

  const parts = itemId.split(':');
  if (parts.length === 3) {
    const [speciesId, partName, subStageId] = parts;
    const species = PLANT_BY_ID[speciesId];
    if (!species) {
      return null;
    }

    const sourcePart = (species.parts || []).find((entry) => entry?.name === partName);
    const sourceSubStage = (sourcePart?.subStages || []).find((entry) => entry?.id === subStageId);
    const score = Number(sourceSubStage?.edibility_score);
    return Number.isFinite(score) ? score : null;
  }

  if (parts.length === 2) {
    const [speciesId, partId] = parts;
    if (partId === 'carcass' || partId === 'fish_carcass') {
      return 0;
    }

    const species = ANIMAL_BY_ID[speciesId];
    if (!species) {
      return null;
    }

    const sourcePart = (species.parts || []).find((entry) => entry?.id === partId);
    const score = Number(sourcePart?.edibility_score);
    return Number.isFinite(score) ? score : null;
  }

  return null;
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
  if (partId === 'carcass' && processId === 'butcher') {
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

function resolveSharedProcessingOption(itemId, processId) {
  const itemTags = resolveCraftTagsForItem(itemId);
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

function resolveProcessingDescriptor(itemId, processId) {
  return resolveSharedProcessingOption(itemId, processId)
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
    let outputQuantity;
    if (Number.isFinite(explicitQuantity) && explicitQuantity > 0) {
      outputQuantity = Math.max(1, Math.floor(explicitQuantity * normalizedQty));
    } else if (Number.isFinite(yieldFraction) && yieldFraction > 0) {
      outputQuantity = Math.max(1, Math.floor(yieldFraction * normalizedQty));
    } else {
      outputQuantity = normalizedQty;
    }

    normalized.push({ itemId: outputItemId, quantity: outputQuantity });
    const latest = normalized[normalized.length - 1];
    if (Number.isFinite(Number(output.freshness))) {
      latest.freshness = Math.max(0, Math.min(1, Number(output.freshness)));
    }
    if (Number.isFinite(Number(output.decayDaysRemaining))) {
      latest.decayDaysRemaining = Math.max(0, Math.floor(Number(output.decayDaysRemaining)));
    }
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

  const descriptor = resolveProcessingDescriptor(itemId, processId);
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

  const ticks = Number.isFinite(Number(descriptor.processOption.ticks))
    ? Math.max(1, Math.floor(Number(descriptor.processOption.ticks)))
    : 1;

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

function resolveCraftTagsForItem(itemId) {
  const tags = [];
  const item = ITEM_BY_ID[itemId] || null;
  if (Array.isArray(item?.craft_tags)) {
    tags.push(...item.craft_tags.filter((tag) => typeof tag === 'string' && tag));
  }

  const subStage = resolvePlantSubStageFromItemId(itemId);
  if (Array.isArray(subStage?.craft_tags)) {
    tags.push(...subStage.craft_tags.filter((tag) => typeof tag === 'string' && tag));
  }

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
  return candidateItemIds.some((itemId) => hasInventoryItem(actor, itemId));
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

function canActorHarvestReachTier(actor, reachTierRaw) {
  const reachTier = typeof reachTierRaw === 'string' ? reachTierRaw : 'ground';
  if (reachTier === 'canopy') {
    return hasInventoryItem(actor, 'tool:ladder');
  }
  if (reachTier === 'elevated') {
    return hasInventoryItem(actor, 'tool:ladder') || hasInventoryItem(actor, 'tool:stool');
  }
  return true;
}

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

  return state?.techUnlocks?.[unlockKey] !== false;
}

function hasCampStationUnlocked(state, stationId) {
  return Array.isArray(state?.camp?.stationsUnlocked)
    && state.camp.stationsUnlocked.includes(stationId);
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
  if (!isActorWithinCampBounds(state, actor)) {
    return baseCost;
  }

  if (!hasCampStationUnlocked(state, 'workbench')) {
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

function isActorWithinCampBounds(state, actor) {
  const campX = Number(state?.camp?.anchorX);
  const campY = Number(state?.camp?.anchorY);
  const actorX = Number(actor?.x);
  const actorY = Number(actor?.y);
  if (!Number.isInteger(campX) || !Number.isInteger(campY) || !Number.isInteger(actorX) || !Number.isInteger(actorY)) {
    return false;
  }

  return Math.abs(actorX - campX) <= 1 && Math.abs(actorY - campY) <= 1;
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

    const hasSubStage = Array.isArray(plant.activeSubStages)
      && plant.activeSubStages.some((entry) => entry?.partName === partName && entry?.subStageId === subStageId);
    if (!hasSubStage) {
      return { ok: false, code: 'inactive_harvest_sub_stage', message: 'harvest target sub-stage is not active' };
    }

    const species = PLANT_BY_ID[plant.speciesId] || null;
    const subStageDef = getHarvestSubStageDefinition(species, partName, subStageId);
    const reachTier = typeof subStageDef?.reach_tier === 'string' ? subStageDef.reach_tier : 'ground';
    if (!canActorHarvestReachTier(actor, reachTier)) {
      const requiredToolId = reachTier === 'canopy' ? 'tool:ladder' : 'tool:stool';
      return {
        ok: false,
        code: 'missing_required_tool',
        message: `harvest reach tier ${reachTier} requires ${requiredToolId} in inventory`,
        requiredToolId,
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
  if (tile?.rockType === 'glacial_erratic' || tile?.rockType === 'flint_cobble_scatter') {
    const outputItemId = tile.rockType === 'glacial_erratic' ? 'heavy_rock' : 'flint_cobble';
    const tickCost = tile.rockType === 'glacial_erratic' ? 3 : 5;
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
          outputItemId,
          outputQuantity: 1,
          outputFootprintW: outputItemId === 'heavy_rock' ? 2 : 1,
          outputFootprintH: outputItemId === 'heavy_rock' ? 2 : 1,
        },
        tickCost,
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

  const requestedGrams = Number.isInteger(action.payload?.cacheGrams)
    ? action.payload.cacheGrams
    : Math.floor(Number(action.payload?.cacheGrams || 100));
  if (!Number.isInteger(requestedGrams) || requestedGrams <= 0) {
    return { ok: false, code: 'invalid_cache_harvest_grams', message: 'harvest payload.cacheGrams must be a positive integer' };
  }

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
  const digBaseTickCost = cacheInterruption ? 3 : (Number(action.tickCost) || 1);
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
  if (Number.isFinite(fieldEdibilityScore) && fieldEdibilityScore < MIN_FIELD_EDIBILITY_SCORE) {
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

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: {
      ...action,
      payload: {
        ...action.payload,
        stationId: recipe.stationId,
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

  const requiredStationId = getRequiredStationForPartnerTask(taskKind);
  if (requiredStationId && !hasCampStationUnlocked(state, requiredStationId)) {
    return {
      ok: false,
      code: 'missing_station',
      message: `partner_task_set task kind ${taskKind} requires station: ${requiredStationId}`,
      stationId: requiredStationId,
    };
  }

  if (!Number.isInteger(ticksRequiredRaw) || ticksRequiredRaw <= 0) {
    return { ok: false, code: 'invalid_partner_task_ticks', message: 'partner_task_set requires payload.task.ticksRequired (positive integer)' };
  }

  const ticksRequired = getPartnerTaskTicksRequired(state, taskKind, ticksRequiredRaw);

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
          outputs: normalizeTaskOutputs(rawTask?.outputs),
          meta: rawTask?.meta && typeof rawTask.meta === 'object' ? { ...rawTask.meta } : null,
        },
      },
    },
  };
}

export function getActionTickCost(kind, payload = {}) {
  return normalizeTickCost(kind, payload);
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

  if (getActorBudgetCurrent(actor) <= 0) {
    return { ok: false, code: 'no_tick_budget', message: `actor ${action.actorId} has no remaining tick budget` };
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

  if (!Number.isInteger(action.tickCost) || action.tickCost < 1) {
    return { ok: false, code: 'invalid_tick_cost', message: 'action tickCost must be a positive integer' };
  }

  if (action.kind === 'move') {
    return validateMoveAction(state, action, actor);
  }

  if (action.kind === 'harvest') {
    return validateHarvestAction(state, action, actor);
  }

  if (action.kind === 'fell_tree') {
    return validateFellTreeAction(state, action, actor);
  }

  if (action.kind === 'trap_place_snare') {
    return validateTrapPlaceSnareAction(state, action, actor);
  }

  if (action.kind === 'trap_place_deadfall') {
    return validateTrapPlaceDeadfallAction(state, action, actor);
  }

  if (action.kind === 'trap_place_fish_weir') {
    return validateTrapPlaceFishWeirAction(state, action, actor);
  }

  if (action.kind === 'auto_rod_place') {
    return validateAutoRodPlaceAction(state, action, actor);
  }

  if (action.kind === 'trap_check') {
    return validateTrapCheckAction(state, action, actor);
  }

  if (action.kind === 'fish_rod_cast') {
    return validateFishRodCastAction(state, action, actor);
  }

  if (action.kind === 'inspect') {
    return validateInspectAction(state, action, actor);
  }

  if (action.kind === 'dig') {
    return validateDigAction(state, action, actor);
  }

  if (action.kind === 'hoe') {
    return validateHoeAction(state, action, actor);
  }

  if (action.kind === 'tap_insert_spout') {
    return validateTapInsertSpoutAction(state, action, actor);
  }

  if (action.kind === 'tap_remove_spout') {
    return validateTapRemoveSpoutAction(state, action, actor);
  }

  if (action.kind === 'tap_place_vessel') {
    return validateTapPlaceVesselAction(state, action, actor);
  }

  if (action.kind === 'tap_retrieve_vessel') {
    return validateTapRetrieveVesselAction(state, action, actor);
  }

  if (action.kind === 'item_pickup') {
    return validateItemPickupAction(state, action, actor);
  }

  if (action.kind === 'item_drop') {
    return validateItemDropAction(state, action, actor);
  }

  if (action.kind === 'eat') {
    return validateEatAction(state, action, actor);
  }

  if (action.kind === 'process_item') {
    return validateProcessItemAction(state, action, actor);
  }

  if (action.kind === 'camp_stockpile_add') {
    return validateCampStockpileAddAction(state, action, actor);
  }

  if (action.kind === 'camp_stockpile_remove') {
    return validateCampStockpileRemoveAction(state, action);
  }

  if (action.kind === 'camp_drying_rack_add') {
    return validateCampDryingRackAddAction(state, action, actor);
  }

  if (action.kind === 'camp_drying_rack_add_inventory') {
    return validateCampDryingRackAddInventoryAction(state, action, actor);
  }

  if (action.kind === 'camp_drying_rack_remove') {
    return validateCampDryingRackRemoveAction(state, action, actor);
  }

  if (action.kind === 'camp_station_build') {
    return validateCampStationBuildAction(state, action, actor);
  }

  if (action.kind === 'tool_craft') {
    return validateToolCraftAction(state, action, actor);
  }

  if (action.kind === 'partner_task_set') {
    return validatePartnerTaskSetAction(state, action);
  }

  return {
    ok: true,
    code: null,
    message: 'ok',
    normalizedAction: action,
  };
}

export function previewAction(state, rawAction, options = {}) {
  const fallbackIssuedAtTick = Number.isInteger(options?.fallbackIssuedAtTick)
    ? options.fallbackIssuedAtTick
    : Number(state?.dayTick) || 0;
  const envelope = normalizeActionEnvelope(rawAction, fallbackIssuedAtTick);
  const validation = validateAction(state, rawAction, options);

  if (validation.ok) {
    return {
      ...validation,
      tickCost: Number(validation?.normalizedAction?.tickCost) || 1,
    };
  }

  return {
    ...validation,
    tickCost: Number(envelope.tickCost) || 1,
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
      tickCost: ACTION_TICK_COST[kind] || 1,
    }));
  }

  if (getActorBudgetCurrent(actor) <= 0) {
    return ACTION_KINDS.map((kind) => ({
      kind,
      available: false,
      reason: 'no_tick_budget',
      tickCost: ACTION_TICK_COST[kind] || 1,
    }));
  }

  return ACTION_KINDS.map((kind) => {
    const unlockCheck = isActionUnlocked(state, kind);
    return {
      kind,
      available: unlockCheck.unlocked,
      reason: unlockCheck.unlocked ? null : 'missing_unlock',
      unlockKey: unlockCheck.unlocked ? null : unlockCheck.unlockKey,
      tickCost: ACTION_TICK_COST[kind] || 1,
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
      inventory: {
        gridWidth: 6,
        gridHeight: 4,
        maxCarryWeightKg: 15,
        stacks: [],
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
      inventory: {
        gridWidth: 6,
        gridHeight: 4,
        maxCarryWeightKg: 15,
        stacks: [],
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
      inventory: actor?.inventory
        ? {
          ...actor.inventory,
          stacks: Array.isArray(actor.inventory.stacks)
            ? actor.inventory.stacks.map((entry) => ({ ...entry }))
            : [],
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
