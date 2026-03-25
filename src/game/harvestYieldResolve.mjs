/** Floor for harvest yield scale so immature plants still have a non-zero budget. */
export const HARVEST_YIELD_MIN_SCALE = 0.1;

function plantAgeDays(plant) {
  if (!plant) {
    return 0;
  }
  if (Number.isFinite(Number(plant.age))) {
    return Math.max(0, Math.floor(Number(plant.age)));
  }
  if (Number.isFinite(Number(plant.ageDays))) {
    return Math.max(0, Math.floor(Number(plant.ageDays)));
  }
  return 0;
}

export function harvestYieldFullAgeRefDays(species, subStage) {
  const raw = subStage?.harvest_yield_full_age_days ?? subStage?.harvestYieldFullAgeDays;
  if (raw === 0 || raw === false) {
    return 0;
  }
  if (Number.isFinite(Number(raw)) && Number(raw) > 0) {
    return Math.max(1, Math.floor(Number(raw)));
  }
  const aom = Number(species?.ageOfMaturity);
  if (Number.isFinite(aom) && aom > 0) {
    return Math.max(1, Math.floor(aom));
  }
  return 1;
}

export function harvestYieldScaleFactor(plant, species, subStage) {
  const ref = harvestYieldFullAgeRefDays(species, subStage);
  if (ref <= 0) {
    return 1;
  }
  const age = plantAgeDays(plant);
  const raw = age / ref;
  return Math.max(HARVEST_YIELD_MIN_SCALE, Math.min(1, raw));
}

function midpointFromHarvestRange(range, fallback = 1) {
  if (!Array.isArray(range) || range.length < 2) {
    return Math.max(1, fallback);
  }
  const min = Math.floor(Number(range[0]));
  const max = Math.floor(Number(range[1]));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return Math.max(1, fallback);
  }
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.max(1, Math.round((low + high) / 2));
}

export function catalogHarvestActionsMidpoint(subStage) {
  return midpointFromHarvestRange(subStage?.harvest_yield?.actions_until_depleted, 1);
}

export function scaledHarvestActionsCap(subStage, species, plant) {
  const fullMid = catalogHarvestActionsMidpoint(subStage);
  const scale = harvestYieldScaleFactor(plant, species, subStage);
  return Math.max(1, Math.round(fullMid * scale));
}

export function unitsPerHarvestActionCatalogMidpoint(subStage) {
  const range = subStage?.harvest_yield?.units_per_action;
  if (!Array.isArray(range) || range.length < 2) {
    return 1;
  }
  const lo = Number(range[0]);
  const hi = Number(range[1]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return 1;
  }
  const low = Math.min(lo, hi);
  const high = Math.max(lo, hi);
  return Math.max(1, Math.round((low + high) / 2));
}

export function scaledUnitsPerHarvestActionMidpoint(subStage, species, plant) {
  const baseMid = unitsPerHarvestActionCatalogMidpoint(subStage);
  const scale = harvestYieldScaleFactor(plant, species, subStage);
  return Math.max(1, Math.round(baseMid * scale));
}
