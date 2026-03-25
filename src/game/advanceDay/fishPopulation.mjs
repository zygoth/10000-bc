import { ANIMAL_BY_ID } from '../animalCatalog.mjs';
import { FISH_DAILY_RECOVERY_RATIO, MIN_DAYS_FOR_FISH_POPULATION_GENERATION } from '../simCore.constants.mjs';
import { deterministicFishTileVariationFactor } from './fishNoise.mjs';
import { buildWaterBodyMap, fishTileDensityMultiplier, tileMatchesFishHabitat } from './waterBodies.mjs';
import { inBounds, tileIndex } from '../simWorld.mjs';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function cloneFishDensityByTile(input) {
  const cloned = {};
  for (const [speciesId, byTile] of Object.entries(input || {})) {
    cloned[speciesId] = { ...(byTile || {}) };
  }
  return cloned;
}

export function canGenerateFishPopulationsInternal(state) {
  if (state?.fishPopulationsGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_FISH_POPULATION_GENERATION;
}

export function generateFishPopulationsInternal(state) {
  if (state.fishPopulationsGenerated) {
    return;
  }

  const fishSpecies = Object.values(ANIMAL_BY_ID).filter((animal) => animal.animalClass === 'fish');
  const waterBodies = buildWaterBodyMap(state);
  const densityBySpecies = {};

  for (const fish of fishSpecies) {
    const speciesDensity = {};
    const startingDensity = Math.max(0, Number(fish.population?.startingDensity ?? 0));

    for (const tile of state.tiles || []) {
      if (!tile?.waterType) {
        continue;
      }

      const key = tileKey(tile.x, tile.y);
      const bodyId = waterBodies.tileToBodyId[key];
      const waterBody = waterBodies.bodiesById[bodyId];
      if (!waterBody || !tileMatchesFishHabitat(fish, tile, waterBody)) {
        speciesDensity[key] = 0;
        continue;
      }

      const bodyBase = waterBody.waterBodyKind === 'pond'
        ? startingDensity * 0.8
        : startingDensity;
      const tileMultiplier = fishTileDensityMultiplier(tile);
      const variationFactor = deterministicFishTileVariationFactor(state, fish.id, tile);
      speciesDensity[key] = clamp01(bodyBase * tileMultiplier * variationFactor);
    }

    densityBySpecies[fish.id] = speciesDensity;
  }

  state.fishWaterBodyByTile = waterBodies.tileToBodyId;
  state.fishWaterBodies = waterBodies.bodiesById;
  state.fishDensityByTile = densityBySpecies;
  state.fishEquilibriumByTile = cloneFishDensityByTile(densityBySpecies);
  state.fishPopulationsGenerated = true;
}

export function applyFishPopulationRecovery(state) {
  if (!state?.fishPopulationsGenerated) {
    return;
  }

  const equilibriumBySpecies = state.fishEquilibriumByTile || {};
  for (const [speciesId, equilibriumByTile] of Object.entries(equilibriumBySpecies)) {
    if (!state.fishDensityByTile[speciesId]) {
      state.fishDensityByTile[speciesId] = {};
    }

    for (const [key, equilibriumDensityRaw] of Object.entries(equilibriumByTile || {})) {
      const equilibriumDensity = clamp01(Number(equilibriumDensityRaw) || 0);
      if (equilibriumDensity <= 0) {
        state.fishDensityByTile[speciesId][key] = 0;
        continue;
      }

      const currentDensity = clamp01(Number(state.fishDensityByTile[speciesId][key]) || 0);
      const recoveredDensity = Math.min(
        equilibriumDensity,
        currentDensity + (equilibriumDensity * FISH_DAILY_RECOVERY_RATIO),
      );
      state.fishDensityByTile[speciesId][key] = clamp01(recoveredDensity);
    }
  }
}

export function getFishDensityAtTile(state, speciesId, x, y) {
  if (!state?.fishPopulationsGenerated || !speciesId) {
    return 0;
  }
  if (!inBounds(x, y, state.width, state.height)) {
    return 0;
  }
  const tile = state.tiles[tileIndex(x, y, state.width)];
  if (!tile?.waterType) {
    return 0;
  }
  const key = tileKey(x, y);
  return clamp01(Number(state?.fishDensityByTile?.[speciesId]?.[key]) || 0);
}
