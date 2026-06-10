import { MIN_DAYS_FOR_SQUIRREL_CACHE_GENERATION } from '../simCore.constants.mjs';
import { getTileForWrite } from '../simWorld.mjs';

export function selectSquirrelCacheCandidatesWithSpread(candidates, targetCount, spreadConfig = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0 || targetCount <= 0) {
    return [];
  }

  const nearRadius = Number(spreadConfig?.nearRadius) || 3.2;
  const midRadius = Number(spreadConfig?.midRadius) || 8.8;
  const nearFactor = Number(spreadConfig?.nearFactor) || 0.88;
  const midFactor = Number(spreadConfig?.midFactor) || 0.96;

  const pool = candidates.map((entry) => ({
    ...entry,
    adjustedScore: Number(entry.score) || 0,
  }));
  const selected = [];

  while (selected.length < targetCount && pool.length > 0) {
    let bestIndex = 0;
    let bestScore = pool[0].adjustedScore;
    for (let i = 1; i < pool.length; i += 1) {
      if (pool[i].adjustedScore > bestScore) {
        bestScore = pool[i].adjustedScore;
        bestIndex = i;
      }
    }

    const chosen = pool[bestIndex];
    selected.push(chosen);
    pool.splice(bestIndex, 1);

    for (const candidate of pool) {
      const dx = candidate.tile.x - chosen.tile.x;
      const dy = candidate.tile.y - chosen.tile.y;
      const distance = Math.sqrt((dx * dx) + (dy * dy));
      if (distance <= nearRadius) {
        candidate.adjustedScore *= nearFactor;
      } else if (distance <= midRadius) {
        candidate.adjustedScore *= midFactor;
      }
    }
  }

  return selected;
}

export function resolveSquirrelCacheItemPool(plantCatalog) {
  const preferred = ['juglans_nigra', 'carya_ovata', 'quercus_alba', 'fagus_grandifolia', 'corylus_americana'];
  const items = [];

  for (const species of plantCatalog || []) {
    for (const part of species?.parts || []) {
      for (const subStage of part?.subStages || []) {
        if (subStage?.can_squirrel_cache !== true) {
          continue;
        }
        items.push({
          speciesId: species.id,
          partName: part.name,
          subStageId: subStage.id,
        });
      }
    }
  }

  if (items.length === 0) {
    return [];
  }

  const preferredSet = new Set(preferred);
  const preferredItems = items.filter((item) => preferredSet.has(item.speciesId));
  if (preferredItems.length > 0) {
    return preferredItems;
  }

  return items;
}

function maxLifeStageSize(species) {
  if (!Array.isArray(species?.lifeStages)) {
    return 1;
  }
  let maxSize = 1;
  for (const stage of species.lifeStages) {
    const s = Number(stage?.size);
    if (Number.isFinite(s)) {
      maxSize = Math.max(maxSize, s);
    }
  }
  return maxSize;
}

/**
 * Species IDs that have at least one living plant meeting "nut-bearing maturity":
 * same nominal threshold as squirrel nut-tree modeling (see simCore SQUIRREL_NUT_TREE_MATURITY_SIZE),
 * but capped by the species' maximum life-stage size so shrubs (e.g. hazel at size 6) still qualify.
 */
export function collectPresentNutCacheSourceSpeciesIds(state, options = {}) {
  const lifeStageSize =
    typeof options.lifeStageSize === 'function' ? options.lifeStageSize : () => 1;
  const maturityThreshold = Number(options.maturityThreshold) || 8;
  const plantById = options.plantById && typeof options.plantById === 'object' ? options.plantById : {};

  const present = new Set();
  for (const plant of Object.values(state?.plants || {})) {
    if (!plant?.alive) {
      continue;
    }
    const species = plantById[plant.speciesId];
    if (!species) {
      continue;
    }
    const size = lifeStageSize(species, plant.stageName);
    const threshold = Math.min(maturityThreshold, maxLifeStageSize(species));
    if (size < threshold) {
      continue;
    }
    present.add(plant.speciesId);
  }
  return present;
}

/**
 * When the world has mature nut-producing plants, restrict cache payloads to those species so new trees
 * (e.g. white oak) actually show up in caches instead of being drowned out by the global random pool.
 */
export function filterSquirrelCacheItemPoolByWorldNutSources(pool, presentSpeciesIds) {
  if (!Array.isArray(pool) || pool.length === 0) {
    return pool;
  }
  if (!(presentSpeciesIds instanceof Set) || presentSpeciesIds.size === 0) {
    return pool;
  }
  const filtered = pool.filter((item) => presentSpeciesIds.has(item.speciesId));
  return filtered.length > 0 ? filtered : pool;
}

export function clearSquirrelCaches(state) {
  for (const tile of state?.tiles || []) {
    if (tile?.squirrelCache) {
      getTileForWrite(state, tile.x, tile.y).squirrelCache = null;
    }
  }
}

export function canGenerateSquirrelCachesInternal(state) {
  if (state?.squirrelCachesGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_SQUIRREL_CACHE_GENERATION;
}
