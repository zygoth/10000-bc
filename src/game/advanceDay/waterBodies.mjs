import { inBounds, tileIndex } from '../simWorld.mjs';

function tileKey(x, y) {
  return `${x},${y}`;
}

function classifyWaterBody(tiles) {
  const counts = {};
  for (const tile of tiles) {
    if (!tile?.waterType) {
      continue;
    }
    counts[tile.waterType] = (counts[tile.waterType] || 0) + 1;
  }

  let dominantWaterType = 'pond';
  let maxCount = -1;
  for (const [waterType, count] of Object.entries(counts)) {
    if (count > maxCount) {
      dominantWaterType = waterType;
      maxCount = count;
    }
  }

  const waterBodyKind = dominantWaterType === 'pond' ? 'pond' : 'river';
  return { dominantWaterType, waterBodyKind };
}

export function buildWaterBodyMap(state) {
  const width = state.width;
  const height = state.height;
  const visited = new Set();
  const tileToBodyId = {};
  const bodiesById = {};
  let bodyIndex = 1;

  for (const tile of state.tiles || []) {
    if (!tile?.waterType) {
      continue;
    }
    const key = tileKey(tile.x, tile.y);
    if (visited.has(key)) {
      continue;
    }

    const queue = [{ x: tile.x, y: tile.y }];
    visited.add(key);
    const bodyTiles = [];

    while (queue.length > 0) {
      const current = queue.pop();
      const currentTile = state.tiles[tileIndex(current.x, current.y, width)];
      if (!currentTile?.waterType) {
        continue;
      }

      bodyTiles.push(currentTile);

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const neighbor of neighbors) {
        if (!inBounds(neighbor.x, neighbor.y, width, height)) {
          continue;
        }
        const neighborTile = state.tiles[tileIndex(neighbor.x, neighbor.y, width)];
        if (!neighborTile?.waterType) {
          continue;
        }
        const neighborKey = tileKey(neighbor.x, neighbor.y);
        if (visited.has(neighborKey)) {
          continue;
        }
        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }

    const bodyId = `water_body_${bodyIndex}`;
    bodyIndex += 1;
    const classification = classifyWaterBody(bodyTiles);
    bodiesById[bodyId] = {
      bodyId,
      tileCount: bodyTiles.length,
      dominantWaterType: classification.dominantWaterType,
      waterBodyKind: classification.waterBodyKind,
      tileKeys: bodyTiles.map((waterTile) => tileKey(waterTile.x, waterTile.y)),
    };
    for (const waterTile of bodyTiles) {
      tileToBodyId[tileKey(waterTile.x, waterTile.y)] = bodyId;
    }
  }

  return { tileToBodyId, bodiesById };
}

export function tileMatchesFishHabitat(fish, tile, waterBody) {
  if (!fish || !tile?.waterType || !waterBody) {
    return false;
  }

  const habitatSet = new Set(fish.habitat || []);
  if (tile.waterType === 'pond') {
    return habitatSet.has('pond')
      || habitatSet.has(waterBody.dominantWaterType)
      || habitatSet.has(waterBody.waterBodyKind);
  }

  if (tile.waterType !== 'river') {
    return false;
  }

  if (habitatSet.has('river')) {
    return true;
  }

  const allowedBands = new Set();
  if (habitatSet.has('stream')) {
    allowedBands.add('slow');
  }
  if (habitatSet.has('slow_river')) {
    allowedBands.add('medium');
  }
  if (habitatSet.has('fast_river')) {
    allowedBands.add('fast');
  }
  if (habitatSet.has('slow')) {
    allowedBands.add('slow');
  }
  if (habitatSet.has('medium')) {
    allowedBands.add('medium');
  }
  if (habitatSet.has('fast')) {
    allowedBands.add('fast');
  }

  if (allowedBands.size === 0) {
    return habitatSet.has(waterBody.dominantWaterType) || habitatSet.has(waterBody.waterBodyKind);
  }

  const band = typeof tile.waterCurrentBand === 'string' ? tile.waterCurrentBand : 'medium';
  return allowedBands.has(band);
}

export function fishTileDensityMultiplier(tile) {
  let multiplier = tile.waterDepth === 'deep' ? 1.08 : 0.96;
  const band = typeof tile?.waterCurrentBand === 'string' ? tile.waterCurrentBand : null;
  if (band === 'fast') {
    multiplier *= 0.9;
  } else if (band === 'slow') {
    multiplier *= 0.88;
  } else if (band === 'medium') {
    multiplier *= 1.03;
  }
  return multiplier;
}
