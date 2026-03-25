import { MIN_DAYS_FOR_ANIMAL_ZONE_GENERATION } from './simCore.constants.mjs';
import { inBounds } from './simWorld.mjs';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function animalTileDensityKey(x, y) {
  return `${x},${y}`;
}

export function canGenerateAnimalZonesInternal(state) {
  if (state?.animalZonesGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_ANIMAL_ZONE_GENERATION;
}

export function getAnimalDensityAtTile(state, animalId, x, y) {
  if (!state?.animalZonesGenerated || !animalId) {
    return 0;
  }
  if (!inBounds(x, y, state.width, state.height)) {
    return 0;
  }
  const tileKey = animalTileDensityKey(x, y);
  return clamp01(Number(state?.animalDensityByZone?.[animalId]?.[tileKey]) || 0);
}
