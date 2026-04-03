import { ANIMAL_CATALOG } from '../../game/animalCatalog.mjs';
import { ITEM_BY_ID } from '../../game/itemCatalog.mjs';
import { PLANT_BY_ID } from '../../game/plantCatalog.mjs';
import { SAP_FILLED_VESSEL_ITEM_ID } from '../../game/simCore.constants.mjs';
import {
  getActionTickCost,
  getItemPickupInventoryBlockReason,
  pickupAddOptionsFromWorldStack,
  validateAction,
} from '../../game/simCore.mjs';
import { annotateContextEntryTickBudget } from './GameModeChromeDisplayLogic.js';

export const NATURE_SIGHT_OVERLAY_OPTIONS = [
  'calorie_heatmap',
  'animal_density',
  'mushroom_zones',
  'plant_compatibility',
  'fishing_hotspots',
];

export const CAMP_STATION_OPTIONS = [
  'raised_sleeping_platform',
  'windbreak_reflector_wall',
  'drying_rack',
  'workbench',
  'thread_spinner',
];

export function inferTileContextActions(tile) {
  if (!tile) {
    return ['inspect', 'move'];
  }

  const actions = ['inspect', 'move', 'item_drop', 'item_pickup', 'marker_place', 'marker_remove'];
  if (tile.plantIds?.length > 0 || tile.rockType || tile.squirrelCache) {
    actions.push('harvest');
  }
  if (tile.plantIds?.length > 0) {
    actions.push('fell_tree');
  }
  if (tile.waterType) {
    actions.push(
      'water_drink',
      'waterskin_fill',
      'fish_rod_cast',
      'trap_place_fish_weir',
      'leaching_basket_place',
      'leaching_basket_retrieve',
    );
  } else {
    actions.push(
      'dig',
      'hoe',
      'trap_place_snare',
      'trap_place_deadfall',
      'auto_rod_place',
      'tap_insert_spout',
      'tap_remove_spout',
      'tap_place_vessel',
      'tap_retrieve_vessel',
    );
  }
  return actions;
}

function resolveCraftTagsForItemInApp(itemId) {
  const item = ITEM_BY_ID[itemId];
  if (item && Array.isArray(item.craft_tags)) {
    return item.craft_tags;
  }

  if (typeof itemId === 'string' && itemId.includes(':')) {
    const parts = itemId.split(':');
    if (parts.length === 3) {
      const [speciesId, partName, subStageId] = parts;
      const species = PLANT_BY_ID[speciesId];
      const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
      const subStage = (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
      if (Array.isArray(subStage?.craft_tags)) {
        return subStage.craft_tags;
      }
    }
    if (parts.length >= 2) {
      const [speciesId, partId] = parts;
      const species = ANIMAL_CATALOG.find((entry) => entry?.id === speciesId) || null;
      const animalPart = (species?.parts || []).find((entry) => entry?.id === partId) || null;
      if (Array.isArray(animalPart?.craft_tags)) {
        return animalPart.craft_tags;
      }
    }
  }

  return [];
}

export function resolveProcessOptionsForItemInApp(itemId) {
  const options = [];
  if (typeof itemId !== 'string' || !itemId) {
    return options;
  }

  if (itemId.includes(':')) {
    const [speciesId, partName, subStageId] = itemId.split(':');
    if (speciesId && partName && subStageId) {
      const species = PLANT_BY_ID[speciesId];
      const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
      const subStage = (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
      for (const option of subStage?.processing_options || []) {
        if (option?.id) {
          options.push({
            processId: option.id,
            location: option.location || 'hand',
          });
        }
      }
    } else if (speciesId && partName) {
      const animal = ANIMAL_CATALOG.find((entry) => entry?.id === speciesId) || null;
      const animalPart = (animal?.parts || []).find((entry) => entry?.id === partName) || null;
      for (const option of animalPart?.processing_options || []) {
        if (option?.id) {
          options.push({
            processId: option.id,
            location: option.location || 'hand',
          });
        }
      }
      if (partName === 'carcass' || partName === 'fish_carcass') {
        options.push({ processId: 'butcher', location: 'hand' });
      }
    }
  }

  const craftTags = resolveCraftTagsForItemInApp(itemId);
  if (craftTags.includes('cordage_fiber')) {
    options.push({ processId: 'spin_cordage', location: 'thread_spinner' });
    options.push({ processId: 'spin_cordage', location: 'hand' });
  }
  if (craftTags.includes('inner_bark_cloth')) {
    options.push({ processId: 'make_barkcloth', location: 'hand' });
    options.push({ processId: 'pound_barkcloth', location: 'hand' });
  }
  if (itemId === SAP_FILLED_VESSEL_ITEM_ID || itemId === 'hide_pitch_vessel:sap_filled') {
    options.push({ processId: 'boil_sap', location: 'sugar_boiling_station' });
  }

  const deduped = [];
  const seen = new Set();
  for (const option of options) {
    const key = `${option.processId}:${option.location}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(option);
  }
  return deduped;
}

export function canDryItemInApp(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return false;
  }
  const item = ITEM_BY_ID[itemId];
  if (item && item.can_dry === true) {
    return true;
  }
  if (!itemId.includes(':')) {
    return false;
  }
  const parts = itemId.split(':');
  if (parts.length === 3) {
    const [speciesId, partName, subStageId] = parts;
    const species = PLANT_BY_ID[speciesId];
    const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
    const subStage = (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
    return subStage?.can_dry === true;
  }
  if (parts.length >= 2) {
    const [speciesId, partId] = parts;
    const species = ANIMAL_CATALOG.find((entry) => entry?.id === speciesId) || null;
    const part = (species?.parts || []).find((entry) => entry?.id === partId) || null;
    return part?.can_dry === true;
  }
  return false;
}

export function isPlayerAdjacentToStation(camp, player, stationId) {
  if (!stationId || !camp?.stationPlacements || typeof camp.stationPlacements !== 'object') {
    return false;
  }
  const placement = camp.stationPlacements[stationId];
  const px = Number(player?.x);
  const py = Number(player?.y);
  if (!Number.isInteger(placement?.x) || !Number.isInteger(placement?.y) || !Number.isInteger(px) || !Number.isInteger(py)) {
    return false;
  }
  return Math.abs(px - placement.x) <= 1 && Math.abs(py - placement.y) <= 1;
}

export function buildDefaultPayload(kind, context) {
  const selectedX = Number.isInteger(context?.selectedX) ? context.selectedX : null;
  const selectedY = Number.isInteger(context?.selectedY) ? context.selectedY : null;
  const tile = context?.tile || null;
  const player = context?.player || {};
  const px = Number.isInteger(player?.x) ? player.x : selectedX;
  const py = Number.isInteger(player?.y) ? player.y : selectedY;
  const dx = Number.isInteger(selectedX) && Number.isInteger(px)
    ? Math.max(-1, Math.min(1, selectedX - px))
    : 0;
  const dy = Number.isInteger(selectedY) && Number.isInteger(py)
    ? Math.max(-1, Math.min(1, selectedY - py))
    : 0;
  const selectedInventoryItemId = context?.selectedInventoryItemId || '';
  const selectedStockpileItemId = context?.selectedStockpileItemId || '';
  const selectedWorldItemId = context?.selectedWorldItemId || '';
  const selectedConditionId = context?.selectedConditionInstanceId || '';
  const selectedVisionItemId = context?.selectedVisionItemId || '';
  const selectedVisionCategory = context?.selectedVisionCategory || '';
  const selectedOverlay = context?.selectedNatureOverlay || NATURE_SIGHT_OVERLAY_OPTIONS[0];
  const selectedInventoryQuantity = Number.isInteger(context?.selectedInventoryQuantity)
    ? Math.max(1, context.selectedInventoryQuantity)
    : 1;
  const selectedStockpileQuantity = Number.isInteger(context?.selectedStockpileQuantity)
    ? Math.max(1, context.selectedStockpileQuantity)
    : 1;
  const selectedWorldItemQuantity = Number.isInteger(context?.selectedWorldItemQuantity)
    ? Math.max(1, context.selectedWorldItemQuantity)
    : 1;

  const sharedTilePayload = Number.isInteger(selectedX) && Number.isInteger(selectedY)
    ? { x: selectedX, y: selectedY }
    : {};

  switch (kind) {
    case 'move':
      return { dx, dy };
    case 'inspect':
    case 'dig':
    case 'hoe':
    case 'trap_place_snare':
    case 'trap_place_deadfall':
    case 'trap_place_fish_weir':
    case 'auto_rod_place':
    case 'trap_check':
    case 'trap_retrieve':
    case 'trap_pickup':
    case 'trap_remove_bait':
    case 'marker_place':
    case 'marker_remove':
    case 'tap_insert_spout':
    case 'tap_remove_spout':
    case 'tap_place_vessel':
    case 'tap_retrieve_vessel':
    case 'leaching_basket_retrieve':
      return sharedTilePayload;
    case 'harvest':
      if (tile?.plantIds?.length > 0) {
        return {
          plantId: tile.plantIds[0],
          partName: 'fruit',
          subStageId: 'ripe',
          actions: 1,
          ...sharedTilePayload,
        };
      }
      return sharedTilePayload;
    case 'fell_tree':
      return tile?.plantIds?.length > 0
        ? { plantId: tile.plantIds[0], ...sharedTilePayload }
        : sharedTilePayload;
    case 'fish_rod_cast':
      return {};
    case 'waterskin_fill':
    case 'waterskin_drink':
      return {};
    case 'water_drink':
      return sharedTilePayload;
    case 'leaching_basket_place':
      return {
        ...sharedTilePayload,
        itemId: selectedInventoryItemId,
        quantity: 1,
      };
    case 'item_pickup':
      return {
        ...sharedTilePayload,
        itemId: selectedWorldItemId,
        quantity: selectedWorldItemQuantity,
      };
    case 'item_drop': {
      const playerDropX = Number.isInteger(player?.x) ? player.x : null;
      const playerDropY = Number.isInteger(player?.y) ? player.y : null;
      const selectedAdjacent = Number.isInteger(selectedX) && Number.isInteger(selectedY)
        && Number.isInteger(playerDropX) && Number.isInteger(playerDropY)
        && Math.abs(selectedX - playerDropX) <= 1
        && Math.abs(selectedY - playerDropY) <= 1;
      const dropTile = selectedAdjacent
        ? { x: selectedX, y: selectedY }
        : (Number.isInteger(playerDropX) && Number.isInteger(playerDropY)
          ? { x: playerDropX, y: playerDropY }
          : {});
      return {
        itemId: selectedInventoryItemId,
        quantity: selectedInventoryQuantity,
        ...dropTile,
      };
    }
    case 'camp_stockpile_add':
    case 'camp_drying_rack_add_inventory':
      return {
        itemId: selectedInventoryItemId,
        quantity: selectedInventoryQuantity,
        ...sharedTilePayload,
      };
    case 'eat':
      return {
        itemId: selectedInventoryItemId,
        quantity: 1,
        ...sharedTilePayload,
      };
    case 'process_item':
      return {
        itemId: selectedInventoryItemId,
        quantity: 1,
        processId: '',
      };
    case 'camp_stockpile_remove':
    case 'camp_drying_rack_add':
      return {
        itemId: selectedStockpileItemId,
        quantity: selectedStockpileQuantity,
      };
    case 'camp_drying_rack_remove':
      return {
        slotIndex: 0,
        quantity: 1,
      };
    case 'meal_plan_set':
      return {
        ingredients: selectedStockpileItemId ? [{ itemId: selectedStockpileItemId, quantity: 1 }] : [],
      };
    case 'meal_plan_commit':
      return {};
    case 'camp_station_build':
      return {
        stationId: CAMP_STATION_OPTIONS[0],
      };
    case 'tool_craft':
      return {
        outputItemId: '',
        outputQuantity: 1,
        materialPlan: [],
      };
    case 'equip_item':
      return {
        itemId: selectedInventoryItemId,
      };
    case 'unequip_item':
      return {
        equipmentSlot: 'gloves',
      };
    case 'debrief_enter':
    case 'debrief_exit':
    case 'partner_vision_request':
      return {};
    case 'partner_medicine_administer':
      return selectedConditionId ? { conditionInstanceId: selectedConditionId } : {};
    case 'partner_vision_confirm':
      return selectedVisionItemId ? { itemId: selectedVisionItemId } : {};
    case 'partner_vision_choose':
      return selectedVisionCategory ? { category: selectedVisionCategory } : {};
    case 'nature_sight_overlay_set':
      return { overlay: selectedOverlay };
    case 'inventory_relocate_stack':
      return {
        stackIndex: Number.isInteger(context?.stackIndex) ? context.stackIndex : -1,
        slotX: Number.isInteger(context?.slotX) ? context.slotX : 0,
        slotY: Number.isInteger(context?.slotY) ? context.slotY : 0,
      };
    default:
      return {};
  }
}

const INVENTORY_QUICK_ACTION_KINDS = ['eat', 'item_drop', 'equip_item', 'camp_stockpile_add', 'camp_drying_rack_add_inventory'];

const INVENTORY_QUICK_LABEL_BY_KIND = {
  eat: 'Eat',
  item_drop: 'Drop',
  equip_item: 'Equip',
  camp_stockpile_add: 'Move to Stockpile',
  camp_drying_rack_add_inventory: 'Move to Drying Rack',
};

/**
 * Headless inventory context rows: one array of menu entries per inventory stack index (matches App ordering).
 */
export function buildInventoryQuickActionsMatrix(params) {
  const {
    gameState,
    playerActor,
    playerInventoryEntries,
    selectedTileX,
    selectedTileY,
    selectedTileEntity,
    selectedStockpileItemId,
    selectedStockpileQuantity,
    selectedWorldItemId,
    selectedWorldItemQuantity,
    selectedConditionInstanceId,
    selectedVisionItemId,
    selectedVisionCategory,
    selectedNatureOverlay,
    formatTokenLabel,
    stationActionLabel,
  } = params;

  return playerInventoryEntries.map((itemEntry) => {
    const baseContext = {
      selectedX: selectedTileX,
      selectedY: selectedTileY,
      tile: selectedTileEntity,
      player: playerActor,
      selectedInventoryItemId: itemEntry.itemId,
      selectedInventoryQuantity: Math.max(1, Number(itemEntry.quantity) || 1),
      selectedStockpileItemId,
      selectedStockpileQuantity,
      selectedWorldItemId,
      selectedWorldItemQuantity,
      selectedConditionInstanceId,
      selectedVisionItemId,
      selectedVisionCategory,
      selectedNatureOverlay,
    };
    const actions = INVENTORY_QUICK_ACTION_KINDS
      .map((kind) => {
        if (kind === 'camp_drying_rack_add_inventory' && !canDryItemInApp(itemEntry.itemId)) {
          return null;
        }
        const payload = buildDefaultPayload(kind, baseContext);
        const validation = validateAction(gameState, { actorId: 'player', kind, payload });
        if (!validation.ok) {
          return null;
        }
        const tickCost = Number(validation.normalizedAction?.tickCost) || getActionTickCost(kind, payload);
        return annotateContextEntryTickBudget({
          kind,
          label: INVENTORY_QUICK_LABEL_BY_KIND[kind] || kind.replace(/_/g, ' '),
          payload,
          tickCost,
        }, playerActor);
      })
      .filter(Boolean);
    const processOptions = resolveProcessOptionsForItemInApp(itemEntry.itemId);
    const stationsAdded = new Set();
    for (const option of processOptions) {
      const stationId = option.location;
      if (!stationId || stationId === 'hand' || stationId === 'camp' || stationsAdded.has(stationId)) {
        continue;
      }
      const stationBuilt = Array.isArray(gameState?.camp?.stationsUnlocked)
        && gameState.camp.stationsUnlocked.includes(stationId);
      if (!stationBuilt || !isPlayerAdjacentToStation(gameState?.camp, playerActor, stationId)) {
        continue;
      }
      stationsAdded.add(stationId);
      actions.push(annotateContextEntryTickBudget({
        kind: 'open_station_process_quantity',
        label: stationActionLabel(stationId),
        payload: {
          stationId,
          itemId: itemEntry.itemId,
          source: 'inventory',
        },
        tickCost: 0,
      }, playerActor));
    }
    const handProcessAdded = new Set();
    for (const option of processOptions) {
      if (option.location !== 'hand' || !option.processId) {
        continue;
      }
      const handKey = `${option.processId}:${option.location}`;
      if (handProcessAdded.has(handKey)) {
        continue;
      }
      const payload = { itemId: itemEntry.itemId, quantity: 1, processId: option.processId };
      if (option.processId === 'spin_cordage' && option.location === 'hand') {
        payload.processLocation = 'hand';
      }
      const validation = validateAction(gameState, { actorId: 'player', kind: 'process_item', payload });
      if (!validation.ok) {
        continue;
      }
      handProcessAdded.add(handKey);
      const tickCost = Number(validation.normalizedAction?.tickCost) || getActionTickCost('process_item', payload);
      actions.push(annotateContextEntryTickBudget({
        kind: 'process_item',
        label: formatTokenLabel(option.processId),
        payload,
        tickCost,
      }, playerActor));
    }
    return actions;
  });
}

const STOCKPILE_QUICK_ACTION_KINDS = ['camp_stockpile_remove', 'camp_drying_rack_add'];

const STOCKPILE_QUICK_LABEL_BY_KIND = {
  camp_stockpile_remove: 'Withdraw',
  camp_drying_rack_add: 'Move to Drying Rack',
};

/**
 * Headless stockpile context rows keyed by itemId (matches App shape).
 */
export function buildStockpileQuickActionsByItemId(params) {
  const {
    gameState,
    playerActor,
    campStockpileEntries,
    campStockpileStacks,
    selectedTileX,
    selectedTileY,
    selectedTileEntity,
    selectedInventoryItemId,
    selectedInventoryQuantity,
    selectedWorldItemId,
    selectedWorldItemQuantity,
    selectedConditionInstanceId,
    selectedVisionItemId,
    selectedVisionCategory,
    selectedNatureOverlay,
  } = params;

  return campStockpileEntries.reduce((acc, itemEntry, entryIdx) => {
    const rawStack = campStockpileStacks[entryIdx] || null;
    const baseContext = {
      selectedX: selectedTileX,
      selectedY: selectedTileY,
      tile: selectedTileEntity,
      player: playerActor,
      selectedInventoryItemId,
      selectedInventoryQuantity,
      selectedStockpileItemId: itemEntry.itemId,
      selectedStockpileQuantity: Math.max(1, Number(itemEntry.quantity) || 1),
      selectedWorldItemId,
      selectedWorldItemQuantity,
      selectedConditionInstanceId,
      selectedVisionItemId,
      selectedVisionCategory,
      selectedNatureOverlay,
    };
    acc[itemEntry.itemId] = STOCKPILE_QUICK_ACTION_KINDS
      .map((kind) => {
        if (kind === 'camp_drying_rack_add' && !canDryItemInApp(itemEntry.itemId)) {
          return null;
        }
        const payload = buildDefaultPayload(kind, baseContext);
        const validation = validateAction(gameState, { actorId: 'player', kind, payload });
        if (!validation.ok) {
          return null;
        }
        let disabled = false;
        let disabledReason = null;
        if (kind === 'camp_stockpile_remove' && rawStack) {
          const withdrawQty = Math.max(
            1,
            Math.floor(Number(validation.normalizedAction?.payload?.quantity) || 1),
          );
          const options = pickupAddOptionsFromWorldStack(rawStack);
          disabledReason = getItemPickupInventoryBlockReason(
            playerActor,
            itemEntry.itemId,
            withdrawQty,
            options,
          );
          disabled = disabledReason != null;
        }
        const tickCost = Number(validation.normalizedAction?.tickCost) || getActionTickCost(kind, payload);
        return annotateContextEntryTickBudget({
          kind,
          label: STOCKPILE_QUICK_LABEL_BY_KIND[kind] || kind.replace(/_/g, ' '),
          payload,
          tickCost,
          ...(disabled ? { disabled: true, disabledReason } : {}),
        }, playerActor);
      })
      .filter(Boolean);
    return acc;
  }, {});
}
