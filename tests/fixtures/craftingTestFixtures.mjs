import { ANIMAL_CATALOG } from '../../src/game/animalCatalog.mjs';
import { ITEM_CATALOG } from '../../src/game/itemCatalog.mjs';
import { PLANT_CATALOG } from '../../src/game/plantCatalog.mjs';
import { CAMP_STATION_RECIPES, TOOL_RECIPES, resolveCraftTagsForItem } from '../../src/game/simActions.mjs';
import { buildDefaultCampStockpileStackFields } from '../../src/game/stockpileDefaultStackOptions.mjs';
import { TECH_RESEARCHABLE_UNLOCK_KEYS } from '../../src/game/techResearchCatalog.mjs';
import { advanceTick, validateAction } from '../../src/game/simCore.mjs';

const TEST_DEFERRED_TOOL_RECIPE_IDS = new Set([
  // Intentionally deferred feature work; tracked in recipe catalog but excluded from generic craftability e2e sweeps.
  'wooden_platform',
]);

export function findRepresentativeItemForTag(tag) {
  if (typeof tag !== 'string' || !tag) {
    return null;
  }
  const matches = (itemId) => {
    try {
      return resolveCraftTagsForItem(itemId).includes(tag);
    } catch {
      return false;
    }
  };
  for (const item of ITEM_CATALOG) {
    if (item?.id && matches(item.id)) {
      return item.id;
    }
  }
  for (const species of PLANT_CATALOG) {
    for (const part of species.parts || []) {
      for (const subStage of part.subStages || []) {
        const itemId = `${species.id}:${part.name}:${subStage.id}`;
        if (matches(itemId)) {
          return itemId;
        }
      }
    }
  }
  for (const species of ANIMAL_CATALOG) {
    for (const part of species.parts || []) {
      const itemId = `${species.id}:${part.id}`;
      if (matches(itemId)) {
        return itemId;
      }
    }
  }
  return null;
}

function addToMap(map, itemId, quantity) {
  if (!itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return;
  }
  const q = Math.max(1, Math.floor(quantity));
  map.set(itemId, (map.get(itemId) || 0) + q);
}

/**
 * Expand one material requirement into itemId -> qty for stockpile (minimal).
 * For one_of, uses the first satisfiable option (first listed option).
 */
export function expandMaterialRequirementToItems(requirement) {
  const map = new Map();
  if (!requirement || typeof requirement !== 'object') {
    return map;
  }
  const type = requirement.type;
  if (type === 'item') {
    addToMap(map, requirement.itemId, requirement.quantity);
    return map;
  }
  if (type === 'tag') {
    const id = findRepresentativeItemForTag(requirement.tag);
    if (id) {
      addToMap(map, id, requirement.quantity);
    }
    return map;
  }
  if (type === 'one_of') {
    const options = Array.isArray(requirement.options) ? requirement.options : [];
    for (const opt of options) {
      const sub = expandMaterialRequirementToItems(opt);
      if (sub.size > 0) {
        for (const [k, v] of sub) {
          addToMap(map, k, v);
        }
        break;
      }
    }
  }
  return map;
}

/** Minimal item quantities to craft one recipe (merged map). */
export function materialItemQuantitiesForToolRecipe(recipeId) {
  const recipe = TOOL_RECIPES[recipeId];
  const merged = new Map();
  if (!recipe || !Array.isArray(recipe.materialRequirements)) {
    return merged;
  }
  for (const req of recipe.materialRequirements) {
    const part = expandMaterialRequirementToItems(req);
    for (const [itemId, qty] of part) {
      addToMap(merged, itemId, qty);
    }
  }
  return merged;
}

export function stockpileStacksFromItemMap(itemMap) {
  const stacks = [];
  for (const [itemId, quantity] of itemMap.entries()) {
    stacks.push({
      itemId,
      quantity,
      ...buildDefaultCampStockpileStackFields(itemId),
    });
  }
  stacks.sort((a, b) => a.itemId.localeCompare(b.itemId));
  return stacks;
}

/** Stockpile stacks sufficient to craft `recipeId` once (does not include prerequisite tools). */
export function buildStockpileStacksForToolRecipe(recipeId) {
  return stockpileStacksFromItemMap(materialItemQuantitiesForToolRecipe(recipeId));
}

export function applyAllResearchUnlocks(state) {
  if (!state.techUnlocks || typeof state.techUnlocks !== 'object') {
    state.techUnlocks = {};
  }
  for (const key of TECH_RESEARCHABLE_UNLOCK_KEYS) {
    state.techUnlocks[key] = true;
  }
  return state;
}

export function ensureAllCampStationsUnlocked(state) {
  const ids = [...new Set(Object.values(CAMP_STATION_RECIPES).map((r) => r.stationId).filter(Boolean))];
  const cur = Array.isArray(state.camp?.stationsUnlocked) ? state.camp.stationsUnlocked : [];
  state.camp.stationsUnlocked = [...new Set([...cur, ...ids])];
  return state;
}

export function boostPlayerForTests(state) {
  const p = state.actors.player;
  p.tickBudgetCurrent = 50000;
  p.tickBudgetBase = Math.max(Number(p.tickBudgetBase) || 0, 50000);
  p.overdraftTicks = 0;
  if (p.inventory && typeof p.inventory === 'object') {
    p.inventory.maxCarryWeightKg = Math.max(Number(p.inventory.maxCarryWeightKg) || 0, 500);
    p.inventory.gridWidth = Math.max(Number(p.inventory.gridWidth) || 6, 12);
    p.inventory.gridHeight = Math.max(Number(p.inventory.gridHeight) || 4, 8);
  }
  return state;
}

function requirementExpandableInCatalog(requirement) {
  if (!requirement || typeof requirement !== 'object') {
    return false;
  }
  if (requirement.type === 'item') {
    return typeof requirement.itemId === 'string' && requirement.itemId.length > 0;
  }
  if (requirement.type === 'tag') {
    return findRepresentativeItemForTag(requirement.tag) != null;
  }
  if (requirement.type === 'one_of') {
    const options = Array.isArray(requirement.options) ? requirement.options : [];
    return options.some((opt) => requirementExpandableInCatalog(opt));
  }
  return false;
}

/** Recipes whose material tags resolve to real catalog item ids (current plant/animal data). */
export function toolRecipeIdsResolvableFromCatalog() {
  const unlockKeys = new Set(TECH_RESEARCHABLE_UNLOCK_KEYS);
  return Object.keys(TOOL_RECIPES).filter((recipeId) => {
    if (TEST_DEFERRED_TOOL_RECIPE_IDS.has(recipeId)) {
      return false;
    }
    const recipe = TOOL_RECIPES[recipeId];
    if (recipe?.requiredUnlock && !unlockKeys.has(recipe.requiredUnlock)) {
      return false;
    }
    const reqs = Array.isArray(recipe?.materialRequirements) ? recipe.materialRequirements : [];
    return reqs.every((req) => requirementExpandableInCatalog(req));
  });
}

/**
 * Prerequisite crafted tools that must exist in inventory before `recipeId` can validate.
 */
export function craftedPrerequisitesForRecipe(recipeId) {
  if (recipeId === 'fishing_rod' || recipeId === 'auto_rod') {
    return ['bone_hook'];
  }
  if (recipeId === 'bone_hook' || recipeId === 'carved_wooden_spout') {
    return ['flint_knife'];
  }
  return [];
}

export function inventoryQuantityForItem(actor, itemId) {
  let sum = 0;
  for (const st of actor?.inventory?.stacks || []) {
    if (st?.itemId === itemId) {
      sum += Math.max(0, Math.floor(Number(st.quantity) || 0));
    }
  }
  return sum;
}

/**
 * Withdraw every stack from camp stockpile into player inventory (one tick, multiple actions).
 */
export function withdrawAllStockpile(state) {
  const stacks = Array.isArray(state.camp?.stockpile?.stacks) ? [...state.camp.stockpile.stacks] : [];
  const actions = [];
  let i = 0;
  for (const stack of stacks) {
    const itemId = stack?.itemId;
    const qty = Math.max(0, Math.floor(Number(stack.quantity) || 0));
    if (!itemId || qty <= 0) {
      continue;
    }
    const v = validateAction(state, {
      actorId: 'player',
      kind: 'camp_stockpile_remove',
      payload: { itemId, quantity: qty },
    });
    if (!v.ok) {
      continue;
    }
    actions.push({
      actionId: `withdraw-${i}-${itemId}`,
      actorId: 'player',
      kind: 'camp_stockpile_remove',
      payload: v.normalizedAction.payload,
    });
    i += 1;
  }
  if (actions.length === 0) {
    return state;
  }
  return advanceTick(state, { actions });
}

export function advanceToolCraft(state, recipeId) {
  const v = validateAction(state, {
    actorId: 'player',
    kind: 'tool_craft',
    payload: { recipeId },
  });
  if (!v.ok) {
    return state;
  }
  return advanceTick(state, {
    actions: [
      {
        actionId: `craft-${recipeId}-${Date.now()}`,
        actorId: 'player',
        kind: 'tool_craft',
        payload: v.normalizedAction.payload,
      },
    ],
  });
}

function loadMaterialsFromStockpile(state, recipeId) {
  const matMap = materialItemQuantitiesForToolRecipe(recipeId);
  state.camp.stockpile = { stacks: stockpileStacksFromItemMap(matMap) };
  return withdrawAllStockpile(state);
}

/** Craft `recipeId` if its output is not already in inventory (used for dependency chain). */
function ensureToolCrafted(state, recipeId) {
  const recipe = TOOL_RECIPES[recipeId];
  const out = recipe?.outputItemId;
  const need = Math.max(1, Math.floor(Number(recipe?.outputQuantity) || 1));
  if (out && inventoryQuantityForItem(state.actors.player, out) >= need) {
    return state;
  }
  for (const pre of craftedPrerequisitesForRecipe(recipeId)) {
    state = ensureToolCrafted(state, pre);
  }
  state = loadMaterialsFromStockpile(state, recipeId);
  return advanceToolCraft(state, recipeId);
}

/**
 * Prerequisite tools crafted if needed; then stockpile materials for `recipeId` and withdraw.
 * Does not craft `recipeId` — ready for menu/tool_craft validation.
 */
export function prepareStateForToolRecipeCraft(state, recipeId) {
  boostPlayerForTests(state);
  applyAllResearchUnlocks(state);
  const ax = state.camp?.anchorX;
  const ay = state.camp?.anchorY;
  if (Number.isInteger(ax) && Number.isInteger(ay)) {
    state.actors.player.x = ax;
    state.actors.player.y = ay;
  }
  for (const pre of craftedPrerequisitesForRecipe(recipeId)) {
    state = ensureToolCrafted(state, pre);
    boostPlayerForTests(state);
  }
  state = loadMaterialsFromStockpile(state, recipeId);
  boostPlayerForTests(state);
  return state;
}
