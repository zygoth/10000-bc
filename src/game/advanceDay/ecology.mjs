import { PLANT_BY_ID, getSeason } from '../plantCatalog.mjs';
import {
  calculateSoilSuitability,
  drainageToIndex,
  getTileForWrite,
  inBounds,
  isRockTile,
  tileIndex,
} from '../simWorld.mjs';

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

  for (const plantId of Object.keys(state.plants || {})) {
    const plant = typeof state.getMutablePlant === 'function'
      ? state.getMutablePlant(plantId)
      : state.plants[plantId];
    if (!plant?.alive) {
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

/** Offsets from a receiver tile to candidate plant home tiles (Manhattan 1..2). Matches max `shadeRangeForSize` of 2. */
const PLANT_SHADE_CANDIDATE_OFFSETS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [2, 0], [-2, 0], [0, 2], [0, -2],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Shade this plant casts onto neighbor tile (rx, ry); 0 if same cell or out of range (mirrors applyShadeAndSoilToTiles ring logic). */
function plantShadeContributionToReceiver(plant, species, rx, ry) {
  const ox = rx - plant.x;
  const oy = ry - plant.y;
  if (ox === 0 && oy === 0) {
    return 0;
  }

  const distance = Math.abs(ox) + Math.abs(oy);
  const size = getActiveStageSize(species, plant.stageName);
  const range = shadeRangeForSize(size);
  const shadeStrength = shadeStrengthForSize(size);
  if (range === 0 || shadeStrength <= 0) {
    return 0;
  }
  if (distance > range || distance === 0) {
    return 0;
  }

  let falloff = 0;
  if (distance === 1) {
    falloff = 1;
  } else if (distance === 2 && range >= 2) {
    falloff = 0.5;
  }
  if (falloff <= 0) {
    return 0;
  }

  return shadeStrength * falloff;
}

function rockNeighborShadeAtTile(state, tx, ty) {
  let sum = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }

      const rx = tx - ox;
      const ry = ty - oy;
      if (!inBounds(rx, ry, state.width, state.height)) {
        continue;
      }

      const rockTile = state.tiles[tileIndex(rx, ry, state.width)];
      if (!isRockTile(rockTile)) {
        continue;
      }

      const isCardinal = (Math.abs(ox) + Math.abs(oy)) === 1;
      sum += isCardinal ? 0.4 : 0.2;
    }
  }
  return sum;
}

function collectTileIndicesForLifeStageSizeFootprint(state, plantX, plantY, lifeStageSizeValue) {
  const indices = [];
  const w = state.width;
  const h = state.height;
  const push = (x, y) => {
    if (inBounds(x, y, w, h)) {
      indices.push(tileIndex(x, y, w));
    }
  };

  push(plantX, plantY);

  if (!Number.isFinite(lifeStageSizeValue) || lifeStageSizeValue <= 0) {
    return indices;
  }

  const range = shadeRangeForSize(lifeStageSizeValue);
  if (range === 0) {
    return indices;
  }

  for (let oy = -range; oy <= range; oy += 1) {
    for (let ox = -range; ox <= range; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }

      const distance = Math.abs(ox) + Math.abs(oy);
      if (distance > range || distance === 0) {
        continue;
      }

      push(plantX + ox, plantY + oy);
    }
  }

  return indices;
}

export function collectTileIndicesForPlantCanopySizeChange(state, plantX, plantY, oldSize, newSize) {
  const set = new Set();
  for (const idx of collectTileIndicesForLifeStageSizeFootprint(state, plantX, plantY, oldSize)) {
    set.add(idx);
  }
  if (newSize !== oldSize) {
    for (const idx of collectTileIndicesForLifeStageSizeFootprint(state, plantX, plantY, newSize)) {
      set.add(idx);
    }
  }
  return set;
}

/** One-time shade + soil fields for tiles that can differ from map defaults (rock neighbors, plant canopy). */
export function bootstrapDynamicShade(state) {
  const indices = new Set();

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

        indices.add(tileIndex(nx, ny, state.width));
      }
    }
  }

  for (const plant of Object.values(state.plants)) {
    if (!plant.alive) {
      continue;
    }

    const species = PLANT_BY_ID[plant.speciesId];
    if (!species) {
      continue;
    }

    const size = getActiveStageSize(species, plant.stageName);
    for (const idx of collectTileIndicesForLifeStageSizeFootprint(state, plant.x, plant.y, size)) {
      indices.add(idx);
    }
  }

  applyShadeAndSoilToTiles(state, indices);
}

export function applyShadeAndSoilToTiles(state, tileIndices) {
  const dirty = new Set();
  for (const raw of tileIndices) {
    const index = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(index) || index < 0 || index >= state.tiles.length) {
      continue;
    }
    dirty.add(index);
  }

  if (dirty.size === 0) {
    return;
  }

  const plantShadeSum = new Map();
  for (const index of dirty) {
    plantShadeSum.set(index, 0);
  }

  const w = state.width;
  const h = state.height;

  for (const dIdx of dirty) {
    const recvTile = state.tiles[dIdx];
    if (!recvTile) {
      continue;
    }
    const rx = recvTile.x;
    const ry = recvTile.y;

    for (let oi = 0; oi < PLANT_SHADE_CANDIDATE_OFFSETS.length; oi += 1) {
      const [dx, dy] = PLANT_SHADE_CANDIDATE_OFFSETS[oi];
      const px = rx + dx;
      const py = ry + dy;
      if (!inBounds(px, py, w, h)) {
        continue;
      }

      const hostTile = state.tiles[tileIndex(px, py, w)];
      const ids = Array.isArray(hostTile?.plantIds) ? hostTile.plantIds : [];
      if (ids.length === 0) {
        continue;
      }

      for (let pi = 0; pi < ids.length; pi += 1) {
        const plant = state.plants[ids[pi]];
        if (!plant?.alive || plant.x !== px || plant.y !== py) {
          continue;
        }

        const species = PLANT_BY_ID[plant.speciesId];
        if (!species) {
          continue;
        }

        const contrib = plantShadeContributionToReceiver(plant, species, rx, ry);
        if (contrib > 0) {
          plantShadeSum.set(dIdx, plantShadeSum.get(dIdx) + contrib);
        }
      }
    }
  }

  const occupantMaxByIndex = new Map();
  for (const index of dirty) {
    occupantMaxByIndex.set(index, 0);
    const homeTile = state.tiles[index];
    if (!homeTile) {
      continue;
    }

    const ids = Array.isArray(homeTile.plantIds) ? homeTile.plantIds : [];
    for (let pi = 0; pi < ids.length; pi += 1) {
      const plant = state.plants[ids[pi]];
      if (!plant?.alive || plant.x !== homeTile.x || plant.y !== homeTile.y) {
        continue;
      }

      const species = PLANT_BY_ID[plant.speciesId];
      if (!species) {
        continue;
      }

      const size = getActiveStageSize(species, plant.stageName);
      occupantMaxByIndex.set(index, Math.max(occupantMaxByIndex.get(index), size));
    }
  }

  for (const index of dirty) {
    const rawTile = state.tiles[index];
    if (!rawTile) {
      continue;
    }

    const tile = getTileForWrite(state, rawTile.x, rawTile.y);

    const rockShade = rockNeighborShadeAtTile(state, tile.x, tile.y);
    const plantShade = plantShadeSum.get(index) || 0;
    const occupantSize = occupantMaxByIndex.get(index) || 0;

    if (!Number.isFinite(tile.baseShade)) {
      tile.baseShade = 0;
    }
    tile.shade = Math.max(0, Math.min(1, tile.baseShade + rockShade + plantShade));
    tile.effectiveShadeForOccupant = occupantSize >= 9 ? Math.min(tile.shade, 0.6) : tile.shade;

    const soilSuitability = calculateSoilSuitability(tile);
    tile.avgSoilMatch = soilSuitability.avgSoilMatch;
    tile.maxSoilMatch = soilSuitability.maxSoilMatch;
  }
}

export function refreshDynamicShadeAfterPlantCanopyChange(state, plantX, plantY, oldLifeStageSize, newLifeStageSize) {
  const indices = collectTileIndicesForPlantCanopySizeChange(
    state,
    plantX,
    plantY,
    oldLifeStageSize,
    newLifeStageSize,
  );
  applyShadeAndSoilToTiles(state, indices);
}

export function refreshDynamicShadeAfterPlantRemoval(state, plant) {
  if (!plant || !Number.isInteger(plant.x) || !Number.isInteger(plant.y)) {
    return;
  }
  if (!inBounds(plant.x, plant.y, state.width, state.height)) {
    return;
  }

  const species = PLANT_BY_ID[plant.speciesId];
  const size = species ? getActiveStageSize(species, plant.stageName) : 1;
  refreshDynamicShadeAfterPlantCanopyChange(state, plant.x, plant.y, size, 0);
}
