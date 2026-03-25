import { ANIMAL_BY_ID } from '../animalCatalog.mjs';
import { PLANT_BY_ID } from '../plantCatalog.mjs';
import { ANIMAL_DENSITY_RADIUS_TILES } from '../simCore.constants.mjs';
import { computeAnimalPlantContribution, distanceFalloffWeight } from '../simAnimalZoneGeneration.mjs';
import { animalTileDensityKey } from '../simAnimalZones.mjs';
import { isRockTile } from '../simWorld.mjs';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function buildSquirrelDensityByTile(state, options = {}) {
  const existingDensity = state?.animalDensityByZone?.sciurus_carolinensis;
  if (existingDensity && typeof existingDensity === 'object' && Object.keys(existingDensity).length > 0) {
    return existingDensity;
  }

  const lifeStageSize = typeof options?.lifeStageSize === 'function'
    ? options.lifeStageSize
    : () => 0;
  const squirrelNutTreeSpecies = options?.squirrelNutTreeSpecies instanceof Set
    ? options.squirrelNutTreeSpecies
    : new Set();
  const squirrelNutTreeMaturitySize = Number(options?.squirrelNutTreeMaturitySize) || 0;

  const alivePlants = [];
  for (const plant of Object.values(state.plants || {})) {
    if (!plant?.alive) {
      continue;
    }
    const species = PLANT_BY_ID[plant.speciesId];
    if (!species) {
      continue;
    }
    alivePlants.push({
      plant,
      species,
      size: lifeStageSize(species, plant.stageName),
    });
  }

  const rawByTile = {};
  let maxRaw = 0;

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType || isRockTile(tile)) {
      continue;
    }

    const tileKey = animalTileDensityKey(tile.x, tile.y);
    let support = 0;
    for (const { plant, species, size } of alivePlants) {
      const dx = plant.x - tile.x;
      const dy = plant.y - tile.y;
      const distance = Math.sqrt((dx * dx) + (dy * dy));
      const weight = distanceFalloffWeight(distance, ANIMAL_DENSITY_RADIUS_TILES);
      if (weight <= 0) {
        continue;
      }
      const contribution = computeAnimalPlantContribution('sciurus_carolinensis', plant, species, size, {
        squirrelNutTreeSpecies,
        squirrelNutTreeMaturitySize,
      });
      if (contribution <= 0) {
        continue;
      }
      support += contribution * weight;
    }
    rawByTile[tileKey] = support;
    maxRaw = Math.max(maxRaw, support);
  }

  const squirrel = ANIMAL_BY_ID.sciurus_carolinensis;
  const baseDensity = clamp01(Number(squirrel?.population?.startingDensity) || 0);
  const densityByTile = {};

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType || isRockTile(tile)) {
      continue;
    }
    const tileKey = animalTileDensityKey(tile.x, tile.y);
    const raw = Number(rawByTile[tileKey] || 0);
    const normalizedSupport = maxRaw > 0 ? raw / maxRaw : 0;
    densityByTile[tileKey] = clamp01(baseDensity * 0.2 + normalizedSupport * 0.8);
  }

  return densityByTile;
}

export function computeSquirrelCacheTargetCount(state, squirrelDensityByTile, totalCandidateCount) {
  let densitySum = 0;
  let densityPeak = 0;
  let densitySamples = 0;

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType || isRockTile(tile)) {
      continue;
    }
    const tileKey = animalTileDensityKey(tile.x, tile.y);
    const density = clamp01(Number(squirrelDensityByTile[tileKey]) || 0);
    densitySum += density;
    densityPeak = Math.max(densityPeak, density);
    densitySamples += 1;
  }

  const avgDensity = densitySamples > 0 ? densitySum / densitySamples : 0;
  const densitySignal = clamp01(avgDensity * 0.62 + densityPeak * 0.38);
  const coverage = 0.0028 + (0.009 * densitySignal);
  const desiredCount = Math.round(totalCandidateCount * coverage);
  return Math.max(1, Math.min(totalCandidateCount, desiredCount));
}
