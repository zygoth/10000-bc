import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { PLANT_BY_ID } from './plantCatalog.mjs';
import { ANIMAL_DENSITY_RADIUS_TILES } from './simCore.constants.mjs';
import { animalTileDensityKey } from './simAnimalZones.mjs';

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

export function computeAnimalPlantContribution(animalId, plant, plantSpecies, plantSize, options = {}) {
  if (!animalId || !plant || !plantSpecies) {
    return 0;
  }

  const squirrelNutTreeSpecies = options?.squirrelNutTreeSpecies instanceof Set
    ? options.squirrelNutTreeSpecies
    : new Set();
  const squirrelNutTreeMaturitySize = Number(options?.squirrelNutTreeMaturitySize) || 0;

  const diet = ANIMAL_BY_ID[animalId]?.diet || [];
  const inDiet = diet.includes(plant.speciesId);

  if (animalId === 'sylvilagus_floridanus') {
    let contribution = inDiet ? 1 : 0;
    if (plant.speciesId === 'daucus_carota') {
      contribution += 4;
    }
    if (plantSize <= 3) {
      contribution += 0.35;
    }
    if (plant.speciesId === 'urtica_dioica') {
      contribution += 0.5;
    }
    return contribution;
  }

  if (animalId === 'sciurus_carolinensis') {
    if (squirrelNutTreeSpecies.has(plant.speciesId) && plantSize < squirrelNutTreeMaturitySize) {
      return 0;
    }

    let contribution = inDiet ? 0.8 : 0;
    if (plantSize >= 6) {
      contribution += 0.4;
    }
    if (plantSize >= 8) {
      contribution += 2.4;
    }
    if (plant.speciesId === 'juglans_nigra') {
      contribution += 6;
    }
    return contribution;
  }

  return 0;
}

export function distanceFalloffWeight(distance, radius) {
  if (distance > radius) {
    return 0;
  }
  return (radius - distance + 1) / (radius + 1);
}

export function generateAnimalZonesInternal(state, options = {}) {
  if (state.animalZonesGenerated) {
    return;
  }

  const lifeStageSize = typeof options?.lifeStageSize === 'function'
    ? options.lifeStageSize
    : () => 0;

  const animalIds = ['sylvilagus_floridanus', 'sciurus_carolinensis'].filter((id) => Boolean(ANIMAL_BY_ID[id]));
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

  const rawSupportBySpecies = {};
  const densityBySpecies = {};

  for (const animalId of animalIds) {
    rawSupportBySpecies[animalId] = {};
    densityBySpecies[animalId] = {};
  }

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType) {
      continue;
    }

    const tileKey = animalTileDensityKey(tile.x, tile.y);

    for (const animalId of animalIds) {
      let support = 0;
      for (const { plant, species, size } of alivePlants) {
        const dx = plant.x - tile.x;
        const dy = plant.y - tile.y;
        const distance = Math.sqrt((dx * dx) + (dy * dy));
        const weight = distanceFalloffWeight(distance, ANIMAL_DENSITY_RADIUS_TILES);
        if (weight <= 0) {
          continue;
        }
        const contribution = computeAnimalPlantContribution(animalId, plant, species, size, options);
        if (contribution <= 0) {
          continue;
        }
        support += contribution * weight;
      }
      rawSupportBySpecies[animalId][tileKey] = support;
    }
  }

  for (const animalId of animalIds) {
    const animal = ANIMAL_BY_ID[animalId];
    const baseDensity = clamp01(Number(animal?.population?.startingDensity) || 0);
    const rawByTile = rawSupportBySpecies[animalId] || {};
    const maxRaw = Math.max(0, ...Object.values(rawByTile).map((value) => Number(value) || 0));

    for (const tile of state.tiles || []) {
      if (!tile || tile.waterType) {
        continue;
      }
      const tileKey = animalTileDensityKey(tile.x, tile.y);
      const raw = Number(rawByTile[tileKey] || 0);
      const normalizedSupport = maxRaw > 0 ? raw / maxRaw : 0;
      const seededDensity = clamp01(baseDensity * 0.2 + normalizedSupport * 0.8);
      densityBySpecies[animalId][tileKey] = seededDensity;
    }
  }

  state.animalZoneGrid = null;
  state.animalDensityByZone = densityBySpecies;
  state.animalZonesGenerated = true;
}
