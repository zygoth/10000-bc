import ITEM_CATALOG_SOURCE from './itemCatalog.source.mjs';

function normalizeNutrition(rawNutrition) {
  if (!rawNutrition || typeof rawNutrition !== 'object') {
    return null;
  }

  return {
    calories: Number(rawNutrition.calories ?? 0),
    protein: Number(rawNutrition.protein ?? 0),
    carbs: Number(rawNutrition.carbs ?? 0),
    fat: Number(rawNutrition.fat ?? 0),
  };
}

function normalizeItem(rawItem) {
  return {
    id: rawItem.id,
    name: rawItem.name || rawItem.id,
    category: rawItem.category || 'intermediate',
    unit_weight_g: Number(rawItem.unit_weight_g ?? 1),
    decay_days: Number.isFinite(Number(rawItem.decay_days)) ? Number(rawItem.decay_days) : null,
    can_dry: rawItem.can_dry === true,
    can_freeze: rawItem.can_freeze !== false,
    craft_tags: Array.isArray(rawItem.craft_tags) ? [...rawItem.craft_tags] : [],
    nutrition: normalizeNutrition(rawItem.nutrition),
  };
}

export const ITEM_CATALOG = ITEM_CATALOG_SOURCE.map(normalizeItem);
export const ITEM_BY_ID = Object.fromEntries(ITEM_CATALOG.map((item) => [item.id, item]));

export function assertKnownItemId(itemId, contextLabel = 'item reference') {
  if (typeof itemId !== 'string' || !itemId || !ITEM_BY_ID[itemId]) {
    throw new Error(`Unknown ${contextLabel}: ${itemId || '(empty)'}`);
  }
  return itemId;
}
