import { MIN_DAYS_FOR_SQUIRREL_CACHE_GENERATION } from '../simCore.constants.mjs';

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

export function clearSquirrelCaches(state) {
  for (const tile of state?.tiles || []) {
    if (tile?.squirrelCache) {
      tile.squirrelCache = null;
    }
  }
}

export function canGenerateSquirrelCachesInternal(state) {
  if (state?.squirrelCachesGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_SQUIRREL_CACHE_GENERATION;
}
