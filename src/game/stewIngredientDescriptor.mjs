import { ITEM_BY_ID } from './itemCatalog.mjs';
import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { PLANT_BY_ID } from './plantCatalog.mjs';
import { parsePlantPartItemId } from './plantPartDescriptors.mjs';

function normalizeUnitInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(1, n));
}

function descriptorForAnimalPart(itemId, speciesId, partId) {
  const species = ANIMAL_BY_ID[speciesId] || null;
  const part = (species?.parts || []).find((entry) => entry?.id === partId) || null;
  const nutrition = part?.nutrition || null;
  if (!nutrition) {
    return null;
  }
  const stewNutritionFactor = Number.isFinite(Number(part?.stew_nutrition_factor))
    ? Number(part.stew_nutrition_factor)
    : 1;
  const extraction = Number.isFinite(Number(part?.stew_extraction_efficiency))
    ? Number(part.stew_extraction_efficiency)
    : 1;
  const edibilityScoreRaw = Number.isFinite(Number(part?.cooked_edibility_score))
    ? Number(part.cooked_edibility_score)
    : Number(part?.edibility_score);
  const harshnessRaw = Number.isFinite(Number(part?.cooked_harshness))
    ? Number(part.cooked_harshness)
    : Number(part?.edibility_harshness);
  const familyRaw = part?.nausea_family || speciesId;
  const flavorRaw = part?.flavor_profile || familyRaw;
  return {
    itemId,
    nutrition: {
      calories: Number(nutrition.calories) || 0,
      protein: Number(nutrition.protein) || 0,
      carbs: Number(nutrition.carbs) || 0,
      fat: Number(nutrition.fat) || 0,
    },
    stewNutritionFactor,
    extraction: Math.max(0, extraction),
    edibilityScore: normalizeUnitInterval(edibilityScoreRaw),
    harshness: normalizeUnitInterval(harshnessRaw),
    familyKey: `animal:${String(familyRaw)}`,
    flavorKey: `flavor:${String(flavorRaw)}`,
  };
}

/**
 * Resolve nutrition + stew behavior for an ingredient itemId.
 *
 * Supported formats:
 * - Catalog item ids that have `nutrition` (e.g. 'fat')
 * - Plant part ids: `${speciesId}:${partName}:${subStageId}`
 * - Animal parts: `${speciesId}:${partId}` (e.g. 'rabbit:meat')
 * - Carcasses: `${speciesId}:carcass` and `${speciesId}:fish_carcass` (treated as meat for stew preview)
 */
export function resolveStewIngredientDescriptor(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return null;
  }

  const item = ITEM_BY_ID[itemId];
  if (item?.nutrition) {
    return {
      itemId,
      nutrition: {
        calories: Number(item.nutrition.calories) || 0,
        protein: Number(item.nutrition.protein) || 0,
        carbs: Number(item.nutrition.carbs) || 0,
        fat: Number(item.nutrition.fat) || 0,
      },
      stewNutritionFactor: 1,
      extraction: 1,
      edibilityScore: 1,
      harshness: 0,
      familyKey: `item:${item.category || 'misc'}`,
      flavorKey: `item:${item.category || 'misc'}`,
    };
  }

  if (itemId.endsWith(':carcass')) {
    const speciesId = itemId.slice(0, -':carcass'.length);
    return descriptorForAnimalPart(itemId, speciesId, 'meat');
  }
  if (itemId.endsWith(':fish_carcass')) {
    const speciesId = itemId.slice(0, -':fish_carcass'.length);
    return descriptorForAnimalPart(itemId, speciesId, 'meat');
  }

  const parts = itemId.split(':');
  if (parts.length === 3) {
    const descriptor = parsePlantPartItemId(itemId);
    if (!descriptor) {
      return null;
    }
    const speciesId = descriptor.speciesId;
    const partName = descriptor.partName;
    const subStageId = descriptor.subStageId;
    const species = PLANT_BY_ID[speciesId] || null;
    const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
    const subStage = (part?.sub_stages || []).find((entry) => entry?.id === subStageId) || null;
    const nutrition = subStage?.nutrition || null;
    if (!nutrition) {
      return null;
    }
    const stewNutritionFactor = Number.isFinite(Number(subStage?.stew_nutrition_factor))
      ? Number(subStage.stew_nutrition_factor)
      : Number.isFinite(Number(part?.stew_nutrition_factor))
        ? Number(part.stew_nutrition_factor)
        : 1;
    const extraction = Number.isFinite(Number(subStage?.stew_extraction_efficiency))
      ? Number(subStage.stew_extraction_efficiency)
      : Number.isFinite(Number(part?.stew_extraction_efficiency))
        ? Number(part.stew_extraction_efficiency)
        : 1;
    const edibilityScoreRaw = Number.isFinite(Number(subStage?.cooked_edibility_score))
      ? Number(subStage.cooked_edibility_score)
      : Number(subStage?.edibility_score ?? part?.edibility_score);
    const harshnessRaw = Number.isFinite(Number(subStage?.cooked_harshness))
      ? Number(subStage.cooked_harshness)
      : Number(subStage?.edibility_harshness ?? part?.edibility_harshness);
    const familyRaw = subStage?.nausea_family || part?.nausea_family || speciesId;
    const flavorRaw = subStage?.flavor_profile || part?.flavor_profile || familyRaw;
    return {
      itemId,
      nutrition: {
        calories: Number(nutrition.calories) || 0,
        protein: Number(nutrition.protein) || 0,
        carbs: Number(nutrition.carbs) || 0,
        fat: Number(nutrition.fat) || 0,
      },
      stewNutritionFactor,
      extraction: Math.max(0, Number(extraction) || 0),
      edibilityScore: normalizeUnitInterval(edibilityScoreRaw),
      harshness: normalizeUnitInterval(harshnessRaw),
      familyKey: `plant:${String(familyRaw)}`,
      flavorKey: `flavor:${String(flavorRaw)}`,
    };
  }

  if (parts.length === 2) {
    const [speciesId, partId] = parts;
    return descriptorForAnimalPart(itemId, speciesId, partId);
  }

  return null;
}

