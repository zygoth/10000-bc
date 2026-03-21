import { PLANT_BY_ID, getSeason } from './plantCatalog.mjs';
import {
  calculateSoilSuitability,
  drainageToIndex,
  inBounds,
  isRockTile,
  tileIndex,
} from './simWorld.mjs';

function toleranceDistance(value, min, max) {
  if (value < min) {
    return min - value;
  }
  if (value > max) {
    return value - max;
  }
  return 0;
}

function environmentalStressSeverity(species, tile) {
  const [minPh, maxPh] = species.soil.ph_range;
  const phDistance = toleranceDistance(tile.ph, minPh, maxPh);
  const phStress = Math.min(1, phDistance / 1.2);

  const [drainMin, drainMax] = species.soil.drainage?.tolerance_range || [0, 1];
  const drainIdx = drainageToIndex(tile.drainage);
  const drainageStress = Math.min(1, toleranceDistance(drainIdx, drainMin, drainMax) / 0.34);

  const [fertMin, fertMax] = species.soil.fertility?.tolerance_range || [0, 1];
  const fertilityStress = Math.min(1, toleranceDistance(tile.fertility, fertMin, fertMax));

  const [moistureMin, moistureMax] = species.soil.moisture?.tolerance_range || [0, 1];
  const moistureStress = Math.min(1, toleranceDistance(tile.moisture, moistureMin, moistureMax));

  const [shadeMin, shadeMax] = species.soil.shade?.tolerance_range || [0, 1];
  const effectiveShade = Number.isFinite(tile.effectiveShadeForOccupant)
    ? tile.effectiveShadeForOccupant
    : tile.shade;
  const shadeStress = Math.min(1, toleranceDistance(effectiveShade, shadeMin, shadeMax));

  return Math.max(phStress, drainageStress, fertilityStress, moistureStress, shadeStress);
}

export function applyEnvironmentalVitality(state) {
  const season = getSeason(state.dayOfYear);

  for (const plant of Object.values(state.plants)) {
    if (!plant.alive) {
      continue;
    }

    const species = PLANT_BY_ID[plant.speciesId];
    const tile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
    const stress = environmentalStressSeverity(species, tile);

    if (stress > 0) {
      const vitalityLoss = 0.004 + 0.026 * stress;
      plant.vitality = Math.max(0, plant.vitality - vitalityLoss);
    } else if (species.longevity === 'perennial' && (season === 'spring' || season === 'summer')) {
      plant.vitality = Math.min(1, plant.vitality + 0.1);
    }

    if (plant.vitality <= 0) {
      plant.alive = false;
    }
  }
}

function getActiveStageSize(species, stageName) {
  const stage = species.lifeStages.find((candidate) => candidate.stage === stageName);
  const rawSize = Number.isFinite(stage?.size) ? stage.size : 1;
  return Math.max(1, Math.min(10, Math.round(rawSize)));
}

function shadeRangeForSize(size) {
  if (size <= 2) {
    return 0;
  }
  if (size <= 5) {
    return 1;
  }
  return 2;
}

function shadeStrengthForSize(size) {
  if (size <= 2) {
    return 0;
  }
  return Math.max(0.08, Math.min(0.85, (size - 2) / 8));
}

export function recalculateDynamicShade(state) {
  const shadeAccumulation = new Array(state.tiles.length).fill(0);
  const occupantSizeByTile = new Array(state.tiles.length).fill(0);

  for (const plant of Object.values(state.plants)) {
    if (!plant.alive) {
      continue;
    }

    const species = PLANT_BY_ID[plant.speciesId];
    const size = getActiveStageSize(species, plant.stageName);
    const range = shadeRangeForSize(size);
    const shadeStrength = shadeStrengthForSize(size);
    const homeIndex = tileIndex(plant.x, plant.y, state.width);
    occupantSizeByTile[homeIndex] = Math.max(occupantSizeByTile[homeIndex], size);

    if (range === 0 || shadeStrength <= 0) {
      continue;
    }

    for (let oy = -range; oy <= range; oy += 1) {
      for (let ox = -range; ox <= range; ox += 1) {
        if (ox === 0 && oy === 0) {
          continue;
        }

        const nx = plant.x + ox;
        const ny = plant.y + oy;
        if (!inBounds(nx, ny, state.width, state.height)) {
          continue;
        }

        const distance = Math.abs(ox) + Math.abs(oy);
        if (distance > range || distance === 0) {
          continue;
        }

        let falloff = 0;
        if (distance === 1) {
          falloff = 1;
        } else if (distance === 2 && range >= 2) {
          falloff = 0.5;
        }

        if (falloff <= 0) {
          continue;
        }

        shadeAccumulation[tileIndex(nx, ny, state.width)] += shadeStrength * falloff;
      }
    }
  }

  for (const tile of state.tiles) {
    if (!isRockTile(tile)) {
      continue;
    }

    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        if (ox === 0 && oy === 0) {
          continue;
        }

        const nx = tile.x + ox;
        const ny = tile.y + oy;
        if (!inBounds(nx, ny, state.width, state.height)) {
          continue;
        }

        const isCardinal = (Math.abs(ox) + Math.abs(oy)) === 1;
        shadeAccumulation[tileIndex(nx, ny, state.width)] += isCardinal ? 0.4 : 0.2;
      }
    }
  }

  for (let index = 0; index < state.tiles.length; index += 1) {
    const tile = state.tiles[index];
    if (!Number.isFinite(tile.baseShade)) {
      tile.baseShade = Math.max(0, Math.min(1, Number.isFinite(tile.shade) ? tile.shade : 0.2));
    }

    tile.shade = Math.max(0, Math.min(1, tile.baseShade + shadeAccumulation[index]));
    const occupantSize = occupantSizeByTile[index];
    tile.effectiveShadeForOccupant = occupantSize >= 9 ? Math.min(tile.shade, 0.6) : tile.shade;

    const soilSuitability = calculateSoilSuitability(tile);
    tile.avgSoilMatch = soilSuitability.avgSoilMatch;
    tile.maxSoilMatch = soilSuitability.maxSoilMatch;
  }
}
