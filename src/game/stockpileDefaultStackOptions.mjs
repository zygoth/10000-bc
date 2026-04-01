import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { ITEM_BY_ID } from './itemCatalog.mjs';
import { PLANT_BY_ID } from './plantCatalog.mjs';
import { ITEM_FOOTPRINT_OVERRIDES } from './simCore.constants.mjs';
import { parsePlantPartItemId } from './plantPartDescriptors.mjs';

/** Test-bootstrap `bark:inner_bark` when no woody inner_bark exists in plant data yet. */
const SYNTHETIC_INNER_BARK_UNIT_WEIGHT_KG = 40 / 1000;

export function landCarcassUnitWeightKgFromSpecies(species) {
  if (!species || typeof species !== 'object') {
    return null;
  }
  const range = Array.isArray(species.weightRangeGrams)
    ? species.weightRangeGrams
    : (Array.isArray(species.weight_range_g) ? species.weight_range_g : null);
  if (Array.isArray(range) && range.length >= 2) {
    const lo = Number(range[0]);
    const hi = Number(range[1]);
    if (Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo && lo > 0) {
      return (lo + hi) / 2 / 1000;
    }
  }
  let yieldSumG = 0;
  for (const part of species.parts || []) {
    if (!part?.id || part.id === 'dried_hide') {
      continue;
    }
    const y = Number(part.yield_grams);
    if (Number.isFinite(y) && y > 0) {
      yieldSumG += y;
    }
  }
  if (yieldSumG > 0) {
    return yieldSumG / 1000;
  }
  return null;
}

/** Synthetic `bark:inner_bark` + plant inner_bark parts when present in data. */
export function resolveInnerBarkUnitWeightKgForItem() {
  for (const species of Object.values(PLANT_BY_ID)) {
    for (const part of species?.parts || []) {
      if (part?.name !== 'inner_bark') {
        continue;
      }
      for (const sub of Array.isArray(part.subStages) ? part.subStages : []) {
        const g = Number(sub.unit_weight_g);
        if (Number.isFinite(g) && g > 0) {
          return g / 1000;
        }
      }
    }
  }
  return SYNTHETIC_INNER_BARK_UNIT_WEIGHT_KG;
}

function baseFootprintForItemId(itemId) {
  const override = ITEM_FOOTPRINT_OVERRIDES[itemId] || null;
  if (override) {
    return { footprintW: override.w, footprintH: override.h };
  }
  const item = ITEM_BY_ID[itemId] || null;
  const footprintW = Number.isInteger(item?.footprintW) && item.footprintW > 0 ? item.footprintW : 1;
  const footprintH = Number.isInteger(item?.footprintH) && item.footprintH > 0 ? item.footprintH : 1;
  return { footprintW, footprintH };
}

/**
 * Default stack fields for camp stockpile, aligned with normal gameplay (harvest, trap catch,
 * inventory → stockpile). Used by manual test bootstrap so seeded stacks match real items.
 */
export function buildDefaultCampStockpileStackFields(itemId) {
  if (typeof itemId !== 'string' || !itemId) {
    return {};
  }

  const out = { ...baseFootprintForItemId(itemId) };

  if (itemId === 'bark:inner_bark') {
    out.unitWeightKg = resolveInnerBarkUnitWeightKgForItem();
    return out;
  }

  if (itemId.endsWith(':fish_carcass')) {
    const speciesId = itemId.slice(0, -':fish_carcass'.length);
    const meat = (ANIMAL_BY_ID[speciesId]?.parts || []).find((p) => p?.id === 'meat') || null;
    const decayDays = Number.isFinite(Number(meat?.decay_days))
      ? Math.max(0, Math.floor(Number(meat.decay_days)))
      : 2;
    out.freshness = 1;
    out.decayDaysRemaining = decayDays;
    const meatG = Number(meat?.unit_weight_g);
    if (Number.isFinite(meatG) && meatG > 0) {
      out.unitWeightKg = meatG / 1000;
    }
    return out;
  }

  if (itemId.endsWith(':carcass')) {
    out.freshness = 1;
    out.decayDaysRemaining = 3;
    const speciesId = itemId.slice(0, -':carcass'.length);
    const carcassKg = landCarcassUnitWeightKgFromSpecies(ANIMAL_BY_ID[speciesId]);
    if (carcassKg != null && carcassKg > 0) {
      out.unitWeightKg = carcassKg;
    }
    return out;
  }

  const plant = parsePlantPartItemId(itemId);
  if (plant?.subStage) {
    const sub = plant.subStage;
    const decay = Number(sub.decay_days);
    if (Number.isFinite(decay) && decay > 0) {
      out.decayDaysRemaining = Math.floor(decay);
    }
    const grams = Number(sub.unit_weight_g);
    if (Number.isFinite(grams) && grams > 0) {
      out.unitWeightKg = grams / 1000;
    }
    const tanninRaw = sub.tannin_level;
    if (tanninRaw != null && Number.isFinite(Number(tanninRaw))) {
      out.tanninRemaining = Math.max(0, Math.min(1, Number(tanninRaw)));
    }
    return out;
  }

  const catalogItem = ITEM_BY_ID[itemId];
  if (catalogItem) {
    const decay = Number(catalogItem.decay_days);
    if (Number.isFinite(decay) && decay > 0) {
      out.decayDaysRemaining = Math.floor(decay);
    }
    const grams = Number(catalogItem.unit_weight_g);
    if (Number.isFinite(grams) && grams > 0) {
      out.unitWeightKg = grams / 1000;
    }
    return out;
  }

  const segments = itemId.split(':');
  if (segments.length === 2) {
    const [speciesId, partId] = segments;
    const species = ANIMAL_BY_ID[speciesId] || null;
    const part = (species?.parts || []).find((p) => p?.id === partId) || null;
    if (part) {
      const decay = Number(part.decay_days);
      if (Number.isFinite(decay) && decay > 0) {
        out.decayDaysRemaining = Math.floor(decay);
      }
      const grams = Number(part.unit_weight_g);
      if (Number.isFinite(grams) && grams > 0) {
        out.unitWeightKg = grams / 1000;
      }
    }
  }

  return out;
}
