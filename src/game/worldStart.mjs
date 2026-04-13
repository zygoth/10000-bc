import {
  advanceDay,
  applyStarterPemmicanSupply,
  createInitialGameState,
  getTileAt,
} from './simCore.mjs';
import { mulberry32 } from './simWorld.mjs';

export const DEFAULT_WORLD_START_WIDTH = 80;
export const DEFAULT_WORLD_START_HEIGHT = 80;
export const DEFAULT_PREHISTORY_DAYS = 1000;

function yieldToUi() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function chebyshevDistance(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function candidateFootprintIsValid(state, anchorX, anchorY) {
  for (let oy = -1; oy <= 2; oy += 1) {
    for (let ox = -1; ox <= 2; ox += 1) {
      const tile = getTileAt(state, anchorX + ox, anchorY + oy);
      if (!tile || tile.waterType) {
        return false;
      }
    }
  }
  return true;
}

function nearestWaterDistance(waterTiles, x, y) {
  let best = Number.POSITIVE_INFINITY;
  for (const tile of waterTiles) {
    const dist = chebyshevDistance(x, y, tile.x, tile.y);
    if (dist < best) {
      best = dist;
    }
  }
  return best;
}

function clearPlantsFromCampFootprint(state) {
  const toRemove = new Set();
  for (let oy = -1; oy <= 2; oy += 1) {
    for (let ox = -1; ox <= 2; ox += 1) {
      const tile = getTileAt(state, state.camp.anchorX + ox, state.camp.anchorY + oy);
      if (!tile) {
        continue;
      }
      for (const plantId of Array.isArray(tile.plantIds) ? tile.plantIds : []) {
        toRemove.add(plantId);
      }
      tile.plantIds = [];
    }
  }
  for (const plantId of toRemove) {
    delete state.plants[plantId];
  }
}

function placeActorsAtCamp(state) {
  if (!state.actors || typeof state.actors !== 'object') {
    return;
  }
  for (const actorId of ['player', 'partner']) {
    const actor = state.actors[actorId];
    if (!actor || typeof actor !== 'object') {
      continue;
    }
    actor.x = state.camp.anchorX;
    actor.y = state.camp.anchorY;
  }
}

export function selectCampAnchorNearWater(state, options = {}) {
  const maxWaterDistance = Number.isFinite(options.maxWaterDistance) ? Math.max(1, Math.floor(options.maxWaterDistance)) : 10;
  const randomSeed = Number.isFinite(options.randomSeed) ? Math.floor(options.randomSeed) : (Number(state.seed) || 10000);
  const rng = mulberry32((randomSeed * 97) + 1337);
  const waterTiles = (state.tiles || []).filter((tile) => tile?.waterType);
  if (waterTiles.length === 0) {
    return {
      x: Math.max(1, Math.floor(state.width / 2)),
      y: Math.max(1, Math.floor(state.height / 2)),
      nearestWaterDistance: Number.POSITIVE_INFINITY,
    };
  }

  const candidates = [];
  for (let y = 1; y <= state.height - 3; y += 1) {
    for (let x = 1; x <= state.width - 3; x += 1) {
      if (!candidateFootprintIsValid(state, x, y)) {
        continue;
      }
      const dist = nearestWaterDistance(waterTiles, x, y);
      if (dist <= maxWaterDistance) {
        candidates.push({ x, y, dist, roll: rng() });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.dist !== b.dist) {
        return a.dist - b.dist;
      }
      return a.roll - b.roll;
    });
    const selected = candidates[Math.floor(rng() * candidates.length)] || candidates[0];
    return { x: selected.x, y: selected.y, nearestWaterDistance: selected.dist };
  }

  let fallback = null;
  const centerX = Math.floor(state.width / 2);
  const centerY = Math.floor(state.height / 2);
  for (let y = 1; y <= state.height - 3; y += 1) {
    for (let x = 1; x <= state.width - 3; x += 1) {
      if (!candidateFootprintIsValid(state, x, y)) {
        continue;
      }
      const centerDist = chebyshevDistance(x, y, centerX, centerY);
      if (!fallback || centerDist < fallback.centerDist) {
        fallback = { x, y, centerDist };
      }
    }
  }

  return {
    x: fallback?.x ?? Math.max(1, Math.floor(state.width / 2)),
    y: fallback?.y ?? Math.max(1, Math.floor(state.height / 2)),
    nearestWaterDistance: fallback ? nearestWaterDistance(waterTiles, fallback.x, fallback.y) : Number.POSITIVE_INFINITY,
  };
}

export async function generateWorldStartState(options = {}) {
  const seed = Number.isFinite(options.seed) ? Math.abs(Math.floor(options.seed)) : 10000;
  const width = DEFAULT_WORLD_START_WIDTH;
  const height = DEFAULT_WORLD_START_HEIGHT;
  const prehistoryDays = Number.isFinite(options.prehistoryDays)
    ? Math.max(0, Math.floor(options.prehistoryDays))
    : DEFAULT_PREHISTORY_DAYS;
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const maxWaterDistance = Number.isFinite(options.maxWaterDistance)
    ? Math.max(1, Math.floor(options.maxWaterDistance))
    : 10;

  if (onProgress) {
    onProgress({ stage: 'Generating terrain', progress: 0.02, detail: 'Preparing base map...' });
  }

  let state = createInitialGameState(seed, { width, height });

  if (onProgress) {
    onProgress({ stage: 'Simulating prehistory', progress: 0.05, detail: `Day 0 / ${prehistoryDays}` });
  }

  const chunkSize = 20;
  for (let day = 0; day < prehistoryDays; day += chunkSize) {
    const step = Math.min(chunkSize, prehistoryDays - day);
    state = advanceDay(state, step);
    if (onProgress) {
      const completed = day + step;
      onProgress({
        stage: 'Simulating prehistory',
        progress: 0.05 + (0.88 * (completed / Math.max(1, prehistoryDays))),
        detail: `Day ${completed} / ${prehistoryDays}`,
      });
    }
    await yieldToUi();
  }

  if (onProgress) {
    onProgress({ stage: 'Selecting camp', progress: 0.95, detail: 'Finding camp near water...' });
  }
  const camp = selectCampAnchorNearWater(state, {
    maxWaterDistance,
    randomSeed: (seed * 41) + prehistoryDays,
  });
  state.camp.anchorX = camp.x;
  state.camp.anchorY = camp.y;
  clearPlantsFromCampFootprint(state);
  placeActorsAtCamp(state);
  applyStarterPemmicanSupply(state);

  if (onProgress) {
    onProgress({ stage: 'Finalizing', progress: 1, detail: 'World ready.' });
  }

  return state;
}
