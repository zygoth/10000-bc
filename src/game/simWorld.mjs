import { PLANT_CATALOG } from './plantCatalog.mjs';
import { generateWater } from './waterGen.js';

const DRAINAGE_BY_INDEX = ['poor', 'moderate', 'well', 'excellent'];
const FORCE_COARSE_NOISE_ONLY = false;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function drainageToIndex(drainage) {
  const classIndex = DRAINAGE_BY_INDEX.indexOf(drainage);
  if (classIndex === -1) {
    return 0.5;
  }

  return classIndex / (DRAINAGE_BY_INDEX.length - 1);
}

export function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hashNoise(seed, x, y) {
  const h = Math.sin((x + 1) * 12.9898 + (y + 1) * 78.233 + seed * 0.345) * 43758.5453;
  return h - Math.floor(h);
}

function smoothStep01(t) {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function coherentValueNoise(seed, x, y, cellSize) {
  const safeCellSize = Math.max(1, cellSize);
  const sx = x / safeCellSize;
  const sy = y / safeCellSize;

  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const tx = smoothStep01(sx - x0);
  const ty = smoothStep01(sy - y0);

  const v00 = hashNoise(seed, x0, y0);
  const v10 = hashNoise(seed, x1, y0);
  const v01 = hashNoise(seed, x0, y1);
  const v11 = hashNoise(seed, x1, y1);

  const top = lerp(v00, v10, tx);
  const bottom = lerp(v01, v11, tx);
  return lerp(top, bottom, ty);
}

function blendedNoise(seed, x, y, options = {}) {
  const coarseScale = Number.isFinite(options.coarseScale) ? options.coarseScale : 20;
  const coarseWeight = Number.isFinite(options.coarseWeight) ? options.coarseWeight : 0.35;
  const clampedWeight = Math.max(0, Math.min(1, coarseWeight));

  const fine = hashNoise(seed, x, y);
  const coarse = coherentValueNoise(seed + 997, x, y, Math.max(1, coarseScale));
  if (FORCE_COARSE_NOISE_ONLY) {
    return coarse;
  }
  return fine * (1 - clampedWeight) + coarse * clampedWeight;
}

function createTile(x, y, seed, width, height) {
  const mapSpan = Math.max(width, height);
  const macroScale = Math.max(12, Math.round(mapSpan * 0.24));
  const regionalScale = Math.max(6, Math.round(mapSpan * 0.12));

  const elevation = blendedNoise(seed, x, y, { coarseScale: macroScale, coarseWeight: 0.9 });
  const baseShade = 0;
  const ph = 5.2 + blendedNoise(seed + 17, x, y, { coarseScale: regionalScale, coarseWeight: 0.58 }) * 2.8;
  const permeability = blendedNoise(seed + 73, x, y, { coarseScale: regionalScale, coarseWeight: 0.56 });

  return {
    x,
    y,
    elevation,
    permeability,
    moisture: 0,
    fertility: 0,
    avgSoilMatch: 0,
    maxSoilMatch: 0,
    baseShade,
    shade: baseShade,
    ph,
    drainage: 'moderate',
    waterType: null,
    waterDepth: null,
    waterCurrentStrength: 0,
    waterCurrentBand: null,
    waterFrozen: false,
    disturbed: false,
    plantIds: [],
    dormantSeeds: {},
    beehive: null,
    squirrelCache: null,
    sapTap: null,
    simpleSnare: null,
    deadfallTrap: null,
    fishTrap: null,
    autoRod: null,
    deadLog: null,
    groundFungusZone: null,
    rockType: null,
    flintCobbleRemaining: null,
  };
}

export function isRockTile(tile) {
  return Boolean(tile?.rockType);
}

export function tileIndex(x, y, width) {
  return y * width + x;
}

export function inBounds(x, y, width, height) {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function computeSoilMatch(plant, tile, options = {}) {
  const includeShade = options.includeShade !== false;
  const includeDrainage = options.includeDrainage !== false;
  const includeFertility = options.includeFertility !== false;
  const includeMoisture = options.includeMoisture !== false;
  const [minPh, maxPh] = plant.soil.ph_range;
  let phScore = 0;

  if (tile.ph >= minPh && tile.ph <= maxPh) {
    phScore = 1;
  } else {
    const distance = tile.ph < minPh ? minPh - tile.ph : tile.ph - maxPh;
    phScore = Math.max(0, 1 - distance);
  }

  const [drainageMin, drainageMax] = plant.soil.drainage?.tolerance_range || [0, 1];
  const tileDrainageIndex = drainageToIndex(tile.drainage);
  let drainageScore = 1;
  if (includeDrainage) {
    drainageScore = tileDrainageIndex >= drainageMin && tileDrainageIndex <= drainageMax ? 1 : 0;
  }

  const [fertilityMin, fertilityMax] = plant.soil.fertility?.tolerance_range || [0, 1];
  let fertilityScore = 1;
  if (includeFertility) {
    fertilityScore = tile.fertility >= fertilityMin && tile.fertility <= fertilityMax ? 1 : 0;
  }

  const [moistureMin, moistureMax] = plant.soil.moisture?.tolerance_range || [0, 1];
  let moistureScore = 1;
  if (includeMoisture) {
    moistureScore = tile.moisture >= moistureMin && tile.moisture <= moistureMax ? 1 : 0;
  }

  let shadeScore = 1;
  if (includeShade) {
    const [shadeMin, shadeMax] = plant.soil.shade?.tolerance_range || [0, 1];
    if (tile.shade >= shadeMin && tile.shade <= shadeMax) {
      shadeScore = 1;
    } else {
      shadeScore = 0;
    }
  }

  return phScore * drainageScore * fertilityScore * moistureScore * shadeScore;
}

export function isPlantWithinEnvironmentalTolerance(species, tile) {
  const [minPh, maxPh] = species.soil.ph_range;
  if (tile.ph < minPh || tile.ph > maxPh) {
    return false;
  }

  const [drainageMin, drainageMax] = species.soil.drainage?.tolerance_range || [0, 1];
  const drainageIndex = drainageToIndex(tile.drainage);
  if (drainageIndex < drainageMin || drainageIndex > drainageMax) {
    return false;
  }

  const [fertilityMin, fertilityMax] = species.soil.fertility?.tolerance_range || [0, 1];
  if (tile.fertility < fertilityMin || tile.fertility > fertilityMax) {
    return false;
  }

  const [moistureMin, moistureMax] = species.soil.moisture?.tolerance_range || [0, 1];
  if (tile.moisture < moistureMin || tile.moisture > moistureMax) {
    return false;
  }

  const [shadeMin, shadeMax] = species.soil.shade?.tolerance_range || [0, 1];
  const effectiveShade = Number.isFinite(tile.effectiveShadeForOccupant)
    ? tile.effectiveShadeForOccupant
    : tile.shade;
  if (effectiveShade < shadeMin || effectiveShade > shadeMax) {
    return false;
  }

  return true;
}

function classifyDrainage(tile, options = {}) {
  const nearestWaterDistance = Number.isFinite(options.nearestWaterDistance)
    ? options.nearestWaterDistance
    : null;
  const riparianLeveeBonus = nearestWaterDistance === 1 ? 0.12 : 0;
  const drainageScore = Math.max(
    0,
    Math.min(
      1,
      0.18
        + tile.permeability * 0.5
        + tile.elevation * 0.22
        + riparianLeveeBonus
        - tile.moisture * 0.32,
    ),
  );

  if (drainageScore < 0.24) {
    tile.drainage = 'poor';
  } else if (drainageScore < 0.49) {
    tile.drainage = 'moderate';
  } else if (drainageScore < 0.74) {
    tile.drainage = 'well';
  } else {
    tile.drainage = 'excellent';
  }
}

function pickTopCandidatesByScore(candidates, targetCount) {
  if (targetCount <= 0 || candidates.length === 0) {
    return [];
  }

  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  return sorted.slice(0, Math.min(targetCount, sorted.length));
}

function placeRockTiles(tiles, seed) {
  const landTiles = tiles.filter((tile) => !tile.waterType);
  if (landTiles.length === 0) {
    return;
  }

  const rng = mulberry32(seed * 53 + 19);
  const erraticRatio = 0.003 + rng() * 0.002;
  const flintRatio = 0.0005 + rng() * 0.0005;
  const erraticTarget = Math.max(0, Math.round(landTiles.length * erraticRatio));
  const flintTarget = Math.max(0, Math.round(landTiles.length * flintRatio));

  const erraticCandidates = landTiles.map((tile) => ({
    tile,
    score: rng(),
  }));
  for (const candidate of pickTopCandidatesByScore(erraticCandidates, erraticTarget)) {
    candidate.tile.rockType = 'glacial_erratic';
  }

  const flintCandidates = landTiles
    .filter((tile) => !isRockTile(tile))
    .map((tile) => ({
      tile,
      score: rng(),
    }))
    .filter((candidate) => Number.isFinite(candidate.score));

  for (const candidate of pickTopCandidatesByScore(flintCandidates, flintTarget)) {
    candidate.tile.rockType = 'flint_cobble_scatter';
    candidate.tile.flintCobbleRemaining = 3 + Math.floor(rng() * 3);
  }
}

function calculateFertility(tile) {
  const phSweetSpot = Math.max(0, 1 - Math.abs(tile.ph - 6.6) / 1.8);
  const moistureSupport = tile.moisture;
  const elevationSupport = 1 - tile.elevation;
  return Math.max(
    0,
    Math.min(1, 0.15 + moistureSupport * 0.45 + phSweetSpot * 0.25 + elevationSupport * 0.15),
  );
}

export function calculateSoilSuitability(tile) {
  if (tile.waterType || isRockTile(tile)) {
    return { avgSoilMatch: 0, maxSoilMatch: 0 };
  }

  let total = 0;
  let max = 0;
  for (const species of PLANT_CATALOG) {
    const score = computeSoilMatch(species, tile);
    total += score;
    max = Math.max(max, score);
  }

  return {
    avgSoilMatch: total / PLANT_CATALOG.length,
    maxSoilMatch: max,
  };
}

function computeInitialDisturbance(tile, seed, nearestWaterDistance) {
  if (tile.waterType) {
    return false;
  }

  const disturbanceNoise = hashNoise(seed + 211, tile.x, tile.y);
  const naturallyOpen = tile.fertility < 0.42 || tile.moisture < 0.28 || nearestWaterDistance <= 1;
  return naturallyOpen && disturbanceNoise > 0.88;
}

function carveTributaryFromEdge(tiles, width, height, startY, riverX, rng) {
  const fromLeft = rng() < 0.5;
  let x = fromLeft ? 0 : width - 1;
  let y = Math.max(0, Math.min(height - 1, startY + Math.floor((rng() - 0.5) * 4)));

  const maxSteps = width + height;
  for (let step = 0; step < maxSteps; step += 1) {
    const tile = tiles[tileIndex(x, y, width)];
    if (!tile.waterType) {
      tile.waterType = 'stream';
      tile.waterDepth = 'shallow';
    }

    if (Math.abs(x - riverX) <= 1) {
      return;
    }

    if (rng() < 0.35) {
      const driftToStart = startY - y;
      if (driftToStart !== 0 && rng() < 0.7) {
        y += Math.sign(driftToStart);
      } else {
        y += rng() < 0.5 ? -1 : 1;
      }
      y = Math.max(0, Math.min(height - 1, y));
    }

    x += fromLeft ? 1 : -1;
    x = Math.max(0, Math.min(width - 1, x));
  }
}

function buildMainRiverCenterline(width, height, rng) {
  const centerlineXByRow = new Array(height);
  const edgePadding = Math.max(3, Math.floor(width * 0.02));
  const moderateShift = Math.max(2, Math.round(width * 0.06));
  const largeShift = Math.max(moderateShift + 1, Math.round(width * 0.12));
  const minSegmentLength = 8;
  const segmentLengthVariance = 8;

  const controlPoints = [{ y: 0, x: Math.floor(width * 0.5) }];

  while (controlPoints[controlPoints.length - 1].y < height - 1) {
    const previous = controlPoints[controlPoints.length - 1];
    const segmentLength = minSegmentLength + Math.floor(rng() * (segmentLengthVariance + 1));
    const nextY = Math.min(height - 1, previous.y + segmentLength);
    const maxShift = rng() < 0.25 ? largeShift : moderateShift;
    const shift = Math.round((rng() - 0.5) * 2 * maxShift);
    const nextX = Math.max(edgePadding, Math.min(width - edgePadding - 1, previous.x + shift));
    controlPoints.push({ y: nextY, x: nextX });
  }

  function smoothStep(t) {
    return t * t * (3 - 2 * t);
  }

  let segmentIndex = 0;
  for (let y = 0; y < height; y += 1) {
    while (segmentIndex < controlPoints.length - 2 && y > controlPoints[segmentIndex + 1].y) {
      segmentIndex += 1;
    }

    const start = controlPoints[segmentIndex];
    const end = controlPoints[Math.min(segmentIndex + 1, controlPoints.length - 1)];

    if (end.y === start.y) {
      centerlineXByRow[y] = start.x;
      continue;
    }

    const t = (y - start.y) / (end.y - start.y);
    const eased = smoothStep(Math.max(0, Math.min(1, t)));
    centerlineXByRow[y] = Math.round(start.x + (end.x - start.x) * eased);
  }

  for (let y = 1; y < height; y += 1) {
    const previous = centerlineXByRow[y - 1];
    if (centerlineXByRow[y] > previous + 1) {
      centerlineXByRow[y] = previous + 1;
    } else if (centerlineXByRow[y] < previous - 1) {
      centerlineXByRow[y] = previous - 1;
    }
  }

  for (let y = 1; y < height - 1; y += 1) {
    const prev = centerlineXByRow[y - 1];
    const cur = centerlineXByRow[y];
    const next = centerlineXByRow[y + 1];
    if (prev === next && Math.abs(cur - prev) === 1) {
      centerlineXByRow[y] = prev;
    }
  }

  return centerlineXByRow;
}

function floodFillRiverDistance(width, height, centerlineXByRow, maxDistance) {
  const distances = new Array(width * height).fill(Number.POSITIVE_INFINITY);
  const queue = [];
  let head = 0;

  for (let y = 0; y < height; y += 1) {
    const x = centerlineXByRow[y];
    const index = tileIndex(x, y, width);
    if (distances[index] === 0) {
      continue;
    }
    distances[index] = 0;
    queue.push({ x, y });
  }

  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    const currentIndex = tileIndex(current.x, current.y, width);
    const currentDistance = distances[currentIndex];
    if (currentDistance >= maxDistance) {
      continue;
    }

    const nextDistance = currentDistance + 1;
    const neighbors = [
      [current.x - 1, current.y],
      [current.x + 1, current.y],
      [current.x, current.y - 1],
      [current.x, current.y + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (!inBounds(nx, ny, width, height)) {
        continue;
      }
      const neighborIndex = tileIndex(nx, ny, width);
      if (nextDistance >= distances[neighborIndex] || nextDistance > maxDistance) {
        continue;
      }
      distances[neighborIndex] = nextDistance;
      queue.push({ x: nx, y: ny });
    }
  }

  return distances;
}

function carveMainRiver(tiles, width, height, centerlineXByRow) {
  const maxRiverDistance = 2;
  const deepDistance = 1;
  const distances = floodFillRiverDistance(width, height, centerlineXByRow, maxRiverDistance);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = tileIndex(x, y, width);
      const distance = distances[index];
      if (!Number.isFinite(distance) || distance > maxRiverDistance) {
        continue;
      }

      const tile = tiles[index];
      tile.waterType = y < height * 0.35 ? 'fast_river' : 'slow_river';
      tile.waterDepth = distance <= deepDistance ? 'deep' : 'shallow';
    }
  }
}

function classifyCurrentBand(strength) {
  const value = Number.isFinite(Number(strength)) ? Number(strength) : 0;
  if (value >= 0.66) {
    return 'fast';
  }
  if (value >= 0.33) {
    return 'medium';
  }
  return 'slow';
}

function assignGeneratedWaterToTiles(tiles, width, height, waterResult) {
  const area = width * height;
  const waterMask = new Uint8Array(area);

  for (let i = 0; i < area; i += 1) {
    waterMask[i] = waterResult.moving[i] || waterResult.still[i] ? 1 : 0;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = tileIndex(x, y, width);
      const tile = tiles[index];
      const isStill = waterResult.still[index] === 1;
      const isMoving = waterResult.moving[index] === 1;

      if (!isStill && !isMoving) {
        tile.waterType = null;
        tile.waterDepth = null;
        tile.waterCurrentStrength = 0;
        tile.waterCurrentBand = null;
        tile.waterFrozen = false;
        continue;
      }

      tile.waterType = isStill ? 'pond' : 'river';
      if (isStill) {
        tile.waterCurrentStrength = 0;
        tile.waterCurrentBand = null;
      } else {
        const strength = Number(waterResult.currentStrength[index]) || 0;
        tile.waterCurrentStrength = Math.max(0, Math.min(1, strength));
        tile.waterCurrentBand = classifyCurrentBand(tile.waterCurrentStrength);
      }

      let nearbyWater = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (!inBounds(nx, ny, width, height)) {
            continue;
          }
          if (waterMask[tileIndex(nx, ny, width)]) {
            nearbyWater += 1;
          }
        }
      }
      tile.waterDepth = nearbyWater >= 6 ? 'deep' : 'shallow';
    }
  }
}

export function generateMap(seed, width, height) {
  const tiles = new Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      tiles[tileIndex(x, y, width)] = createTile(x, y, seed, width, height);
    }
  }

  const heightmap = new Float32Array(width * height);
  for (let i = 0; i < tiles.length; i += 1) {
    heightmap[i] = tiles[i].elevation;
  }

  const waterResult = generateWater(heightmap, width, height, { seed: String(seed) });
  assignGeneratedWaterToTiles(tiles, width, height, waterResult);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = tiles[tileIndex(x, y, width)];
      let nearestWaterDistance = 99;

      for (let oy = -2; oy <= 2; oy += 1) {
        for (let ox = -2; ox <= 2; ox += 1) {
          const nx = x + ox;
          const ny = y + oy;
          if (!inBounds(nx, ny, width, height)) {
            continue;
          }
          const neighbor = tiles[tileIndex(nx, ny, width)];
          if (!neighbor.waterType) {
            continue;
          }
          nearestWaterDistance = Math.min(nearestWaterDistance, Math.abs(ox) + Math.abs(oy));
        }
      }

      const nearWaterBoost = nearestWaterDistance <= 2 ? (3 - nearestWaterDistance) * 0.18 : 0;
      const elevationDryness = (tile.elevation - 0.45) * 0.35;
      tile.moisture = Math.max(0, Math.min(1, 0.45 + nearWaterBoost - elevationDryness));

      classifyDrainage(tile, { nearestWaterDistance });
      tile.fertility = calculateFertility(tile);
      tile.disturbed = computeInitialDisturbance(tile, seed, nearestWaterDistance);
      const soilSuitability = calculateSoilSuitability(tile);
      tile.avgSoilMatch = soilSuitability.avgSoilMatch;
      tile.maxSoilMatch = soilSuitability.maxSoilMatch;
    }
  }

  placeRockTiles(tiles, seed);

  return tiles;
}
