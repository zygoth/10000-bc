import { ANIMAL_CATALOG } from './animalCatalog.mjs';
import { ITEM_CATALOG } from './itemCatalog.mjs';
import { PLANT_CATALOG } from './plantCatalog.mjs';
import { CAMP_STATION_RECIPES, TOOL_RECIPES } from './simActions.mjs';
import { TECH_RESEARCHABLE_UNLOCK_KEYS } from './techResearchCatalog.mjs';
import { SAP_FILLED_VESSEL_ITEM_ID } from './simCore.constants.mjs';
import { buildDefaultCampStockpileStackFields } from './stockpileDefaultStackOptions.mjs';

/** Camp stockpile item for partner vision confirm (catalog ground fungus; see tests/sim vision flow). */
export const DEBUG_VISION_HALLUCINOGEN_ITEM_ID = 'psilocybe_caerulipes:fruiting_body:whole';

export function defaultManualTestBootstrapOptions() {
  return {
    enabled: false,
    seedAllResearch: true,
    seedAllStations: true,
    seedToolSet: true,
    seedStationBuildMaterials: true,
    seedCraftingProcessInputs: true,
  };
}

function asPositiveInt(value, fallback = 0) {
  const parsed = Math.floor(Number(value));
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function addItemQuantity(stockpileByItemId, itemId, quantity) {
  if (typeof itemId !== 'string' || !itemId) {
    return;
  }
  const safeQuantity = asPositiveInt(quantity, 0);
  if (safeQuantity <= 0) {
    return;
  }
  stockpileByItemId.set(itemId, Math.max(0, asPositiveInt(stockpileByItemId.get(itemId), 0)) + safeQuantity);
}

function buildStockpileMap(stacks) {
  const stockpileByItemId = new Map();
  for (const stack of Array.isArray(stacks) ? stacks : []) {
    const itemId = typeof stack?.itemId === 'string' ? stack.itemId : '';
    if (!itemId) {
      continue;
    }
    addItemQuantity(stockpileByItemId, itemId, stack.quantity);
  }
  return stockpileByItemId;
}

function findRepresentativeItemForTag(tag) {
  if (typeof tag !== 'string' || !tag) {
    return null;
  }

  for (const item of ITEM_CATALOG) {
    if (Array.isArray(item?.craft_tags) && item.craft_tags.includes(tag)) {
      return item.id;
    }
  }

  for (const species of PLANT_CATALOG) {
    for (const part of species.parts || []) {
      for (const subStage of part.subStages || []) {
        if (Array.isArray(subStage?.craft_tags) && subStage.craft_tags.includes(tag)) {
          return `${species.id}:${part.name}:${subStage.id}`;
        }
      }
    }
  }

  for (const species of ANIMAL_CATALOG) {
    for (const part of species.parts || []) {
      if (Array.isArray(part?.craft_tags) && part.craft_tags.includes(tag)) {
        return `${species.id}:${part.id}`;
      }
    }
  }

  return null;
}

function collectToolUnlocks() {
  const unlocks = new Set();
  for (const recipe of Object.values(TOOL_RECIPES)) {
    if (typeof recipe?.requiredUnlock === 'string' && recipe.requiredUnlock) {
      unlocks.add(recipe.requiredUnlock);
    }
  }
  return unlocks;
}

function collectStationUnlocks() {
  const unlocks = new Set();
  for (const recipe of Object.values(CAMP_STATION_RECIPES)) {
    if (typeof recipe?.requiredUnlock === 'string' && recipe.requiredUnlock) {
      unlocks.add(recipe.requiredUnlock);
    }
  }
  return unlocks;
}

function collectToolOutputItems(stockpileByItemId) {
  for (const recipe of Object.values(TOOL_RECIPES)) {
    addItemQuantity(stockpileByItemId, recipe?.outputItemId, asPositiveInt(recipe?.outputQuantity, 1));
  }
}

function collectToolCraftMaterials(stockpileByItemId) {
  for (const recipe of Object.values(TOOL_RECIPES)) {
    for (const requirement of Array.isArray(recipe?.materialRequirements) ? recipe.materialRequirements : []) {
      const quantity = Math.max(2, asPositiveInt(requirement?.quantity, 1) * 3);
      if (requirement?.type === 'item') {
        addItemQuantity(stockpileByItemId, requirement.itemId, quantity);
        continue;
      }
      if (requirement?.type === 'tag') {
        const representativeItemId = findRepresentativeItemForTag(requirement.tag);
        if (representativeItemId) {
          addItemQuantity(stockpileByItemId, representativeItemId, quantity);
        }
      }
    }
  }
}

function collectProcessingInputItems(stockpileByItemId) {
  for (const species of PLANT_CATALOG) {
    for (const part of species.parts || []) {
      for (const subStage of part.subStages || []) {
        if (!Array.isArray(subStage?.processing_options) || subStage.processing_options.length === 0) {
          continue;
        }
        addItemQuantity(stockpileByItemId, `${species.id}:${part.name}:${subStage.id}`, 4);
      }
    }
  }

  for (const species of ANIMAL_CATALOG) {
    for (const part of species.parts || []) {
      if (Array.isArray(part?.processing_options) && part.processing_options.length > 0) {
        addItemQuantity(stockpileByItemId, `${species.id}:${part.id}`, 3);
      }
    }
    addItemQuantity(stockpileByItemId, `${species.id}:carcass`, 2);
  }

  // Stew-friendly “filler” ingredients for debugging meal caps and variety.
  // These are catalog items with explicit nutrition and no edibility/harshness ceilings in stew.
  addItemQuantity(stockpileByItemId, 'fat', 30);
  addItemQuantity(stockpileByItemId, 'tree_sugar', 20);

  addItemQuantity(stockpileByItemId, SAP_FILLED_VESSEL_ITEM_ID, 4);
  addItemQuantity(stockpileByItemId, 'bark:inner_bark', 10);
  for (const species of PLANT_CATALOG) {
    for (const part of species.parts || []) {
      for (const subStage of part.subStages || []) {
        if (!Array.isArray(subStage?.craft_tags) || !subStage.craft_tags.includes('cordage_fiber')) {
          continue;
        }
        addItemQuantity(stockpileByItemId, `${species.id}:${part.name}:${subStage.id}`, 12);
      }
    }
  }
}

function mapToStockpileStacks(stockpileByItemId) {
  const stacks = [];
  for (const [itemId, quantity] of stockpileByItemId.entries()) {
    const safeQuantity = asPositiveInt(quantity, 0);
    if (safeQuantity <= 0) {
      continue;
    }
    stacks.push({
      itemId,
      quantity: safeQuantity,
      ...buildDefaultCampStockpileStackFields(itemId),
    });
  }
  stacks.sort((a, b) => a.itemId.localeCompare(b.itemId));
  return stacks;
}

function buildDefaultStationPlacements(anchorX, anchorY, stationIds) {
  const placements = {};
  const offsets = [
    [-1, -1], [0, -1], [1, -1], [2, -1],
    [-1, 0], [1, 0], [2, 0],
    [-1, 1], [0, 1], [1, 1], [2, 1],
    [-1, 2], [0, 2], [1, 2], [2, 2],
  ];
  stationIds.forEach((stationId, index) => {
    const [dx, dy] = offsets[index % offsets.length] || [1, 1];
    const ring = Math.floor(index / offsets.length);
    placements[stationId] = {
      x: anchorX + dx + (ring > 0 ? ring : 0),
      y: anchorY + dy + (ring > 0 ? ring : 0),
    };
  });
  return placements;
}

export function applyManualTestBootstrap(baseState, options = {}) {
  const mergedOptions = {
    ...defaultManualTestBootstrapOptions(),
    ...(options && typeof options === 'object' ? options : {}),
  };
  if (!mergedOptions.enabled) {
    return baseState;
  }

  const nextState = {
    ...baseState,
    techUnlocks: {
      ...(baseState?.techUnlocks || {}),
    },
    camp: {
      ...(baseState?.camp || {}),
      stockpile: {
        ...(baseState?.camp?.stockpile || {}),
        stacks: [...(baseState?.camp?.stockpile?.stacks || [])],
      },
      stationsUnlocked: Array.isArray(baseState?.camp?.stationsUnlocked)
        ? [...baseState.camp.stationsUnlocked]
        : [],
      stationPlacements: baseState?.camp?.stationPlacements && typeof baseState.camp.stationPlacements === 'object'
        ? Object.fromEntries(
          Object.entries(baseState.camp.stationPlacements)
            .filter(([stationId, placement]) => (
              typeof stationId === 'string'
              && stationId
              && Number.isInteger(placement?.x)
              && Number.isInteger(placement?.y)
            ))
            .map(([stationId, placement]) => [stationId, { x: placement.x, y: placement.y }]),
        )
        : {},
    },
  };

  if (mergedOptions.seedAllResearch) {
    for (const unlock of TECH_RESEARCHABLE_UNLOCK_KEYS) {
      nextState.techUnlocks[unlock] = true;
    }
    for (const unlock of collectStationUnlocks()) {
      nextState.techUnlocks[unlock] = true;
    }
    for (const unlock of collectToolUnlocks()) {
      nextState.techUnlocks[unlock] = true;
    }
  }

  if (mergedOptions.seedAllStations) {
    const stationIds = new Set(nextState.camp.stationsUnlocked);
    for (const recipe of Object.values(CAMP_STATION_RECIPES)) {
      if (typeof recipe?.stationId === 'string' && recipe.stationId) {
        stationIds.add(recipe.stationId);
      }
    }
    const orderedStationIds = Array.from(stationIds).sort();
    nextState.camp.stationsUnlocked = orderedStationIds;
    nextState.camp.stationPlacements = buildDefaultStationPlacements(
      Number.isInteger(nextState?.camp?.anchorX) ? nextState.camp.anchorX : 0,
      Number.isInteger(nextState?.camp?.anchorY) ? nextState.camp.anchorY : 0,
      orderedStationIds,
    );
  }

  const stockpileByItemId = buildStockpileMap(nextState.camp.stockpile.stacks);
  if (mergedOptions.seedToolSet) {
    collectToolOutputItems(stockpileByItemId);
  }
  if (mergedOptions.seedStationBuildMaterials) {
    collectToolCraftMaterials(stockpileByItemId);
  }
  if (mergedOptions.seedCraftingProcessInputs) {
    collectProcessingInputItems(stockpileByItemId);
  }
  // Enough for two seasonal vision confirms in play view (debrief) without foraging.
  addItemQuantity(stockpileByItemId, DEBUG_VISION_HALLUCINOGEN_ITEM_ID, 4);
  nextState.camp.stockpile.stacks = mapToStockpileStacks(stockpileByItemId);

  return nextState;
}
