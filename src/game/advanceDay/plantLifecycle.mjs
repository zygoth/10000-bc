import { getTileForWrite } from '../simWorld.mjs';

export function updatePlantLifeImpl(state, plantInstance, rng, deps) {
  const {
    PLANT_BY_ID,
    stageForDay,
    maxLifeStageMinAge,
    maxLifecycleYearOrdinal,
    lifecycleYearOrdinal,
    getSeason,
    PERENNIAL_WINTER_DAILY_DEATH_RATE,
    syncPlantActiveSubStages,
    advanceActiveSubStageRegrowth,
    disperseSeeds,
  } = deps;
  const species = PLANT_BY_ID[plantInstance.speciesId];

  plantInstance.age += 1;
  let stage = stageForDay(species, plantInstance.age, state.dayOfYear);

  if (stage && species.longevity !== 'perennial') {
    const terminalMinAge = maxLifeStageMinAge(species);
    if (plantInstance.age > terminalMinAge) {
      const maxLifecycleYear = maxLifecycleYearOrdinal(species);
      if (Number.isFinite(maxLifecycleYear)) {
        const stageLifecycleYear = lifecycleYearOrdinal(stage.stage);
        if (!Number.isFinite(stageLifecycleYear) || stageLifecycleYear < maxLifecycleYear) {
          stage = null;
        }
      } else if (stage.min_age_days < terminalMinAge) {
        stage = null;
      }
    }
  }

  if (!stage && species.longevity !== 'perennial') {
    plantInstance.alive = false;
    return;
  }

  if (stage) {
    plantInstance.stageName = stage.stage;
  }

  const isOldPerennial = species.longevity === 'perennial'
    && Number.isFinite(species.ageOfMaturity)
    && plantInstance.age >= species.ageOfMaturity * 2;
  if (isOldPerennial && getSeason(state.dayOfYear) === 'winter' && rng() < PERENNIAL_WINTER_DAILY_DEATH_RATE) {
    plantInstance.alive = false;
    return;
  }

  syncPlantActiveSubStages(state, plantInstance);
  advanceActiveSubStageRegrowth(plantInstance, species, state.dayOfYear);

  disperseSeeds(state, plantInstance, species, rng);
}

export function processDormantSeedsImpl(state, rng, deps) {
  const {
    getSeason,
    isRockTile,
    PLANT_BY_ID,
    MAX_PLANTS_PER_TILE,
    isPlantWithinEnvironmentalTolerance,
    computeSoilMatch,
    findOpenSpot,
    tileIndex,
    isTileBlockedForPlantLife,
    addPlantInstance,
  } = deps;
  const currentSeason = getSeason(state.dayOfYear);

  const ensureSeasonBuckets = () => {
    if (!state.dormantSeedTilesBySeason || typeof state.dormantSeedTilesBySeason !== 'object') {
      state.dormantSeedTilesBySeason = {
        spring: Object.create(null),
        summer: Object.create(null),
        fall: Object.create(null),
        winter: Object.create(null),
      };
    }
    return state.dormantSeedTilesBySeason;
  };

  const buckets = ensureSeasonBuckets();
  let seedTileIndex = buckets?.[currentSeason] && typeof buckets[currentSeason] === 'object'
    ? buckets[currentSeason]
    : null;

  // Back-compat / test support: if seed pools were mutated directly without updating the index,
  // rebuild season buckets once from current tiles.
  if (!seedTileIndex) {
    buckets[currentSeason] = Object.create(null);
    seedTileIndex = buckets[currentSeason];
  }
  if (Object.keys(seedTileIndex).length === 0) {
    // Only do the expensive rebuild if we appear to be missing indexes entirely.
    // (This keeps the common-path fast.)
    let sawAnySeeds = false;
    for (let i = 0; i < state.tiles.length; i += 1) {
      const t = state.tiles[i];
      if (t && t.dormantSeeds && typeof t.dormantSeeds === 'object' && Object.keys(t.dormantSeeds).length > 0) {
        sawAnySeeds = true;
        for (const speciesId of Object.keys(t.dormantSeeds)) {
          const season = PLANT_BY_ID?.[speciesId]?.dispersal?.germination_season;
          if (season && buckets[season]) {
            buckets[season][i] = 1;
          }
        }
      }
    }
    if (sawAnySeeds) {
      seedTileIndex = buckets[currentSeason];
    }
  }

  for (const rawIndex of Object.keys(seedTileIndex)) {
    const idx = Math.floor(Number(rawIndex));
    if (!Number.isInteger(idx) || idx < 0 || idx >= state.tiles.length) {
      delete seedTileIndex[rawIndex];
      continue;
    }
    const tile = state.tiles[idx];
    if (isRockTile(tile)) {
      const rockTile = getTileForWrite(state, tile.x, tile.y);
      rockTile.dormantSeeds = {};
      delete seedTileIndex[rawIndex];
      continue;
    }

    const seedEntries = Object.entries(tile.dormantSeeds || {});
    if (seedEntries.length === 0) {
      delete seedTileIndex[rawIndex];
      continue;
    }

    const mt = getTileForWrite(state, tile.x, tile.y);
    let hasCurrentSeasonSeedsAfter = false;

    for (const [speciesId, entry] of seedEntries) {
      const species = PLANT_BY_ID[speciesId];
      if (!species) {
        delete mt.dormantSeeds[speciesId];
        continue;
      }

      const viableLifespan = species?.dispersal?.viable_lifespan_days;
      const season = species?.dispersal?.germination_season;

      // Lazy aging: store bornTotalDays; compute age on demand.
      if (!Number.isInteger(entry?.bornTotalDays)) {
        // No legacy support: dormant seed entries must be `{ bornTotalDays }`.
        delete mt.dormantSeeds[speciesId];
        continue;
      }
      const nowDays = Number.isInteger(state.totalDaysSimulated) ? state.totalDaysSimulated : 0;
      const ageDays = Math.max(0, nowDays - entry.bornTotalDays);

      if (Number.isFinite(viableLifespan) && ageDays > viableLifespan) {
        delete mt.dormantSeeds[speciesId];
        continue;
      }

      if (season !== currentSeason) {
        continue;
      }
      hasCurrentSeasonSeedsAfter = true;

      if (mt.plantIds.length >= MAX_PLANTS_PER_TILE) {
        continue;
      }

      const isDisturbed = mt.disturbed === true;
      if (!isPlantWithinEnvironmentalTolerance(species, mt)) {
        continue;
      }

      const soilMatch = computeSoilMatch(species, mt);
      const methodModifier = species.dispersal.method === 'animal_eaten' ? 0.7 : 1;
      const disturbanceModifier = species.dispersal.requires_disturbance && !isDisturbed ? 0.05 : 1;
      const pioneerModifier = species.dispersal.pioneer && isDisturbed ? 2 : 1;
      const chance = Math.min(
        1,
        species.dispersal.germination_rate * soilMatch * methodModifier * disturbanceModifier * pioneerModifier,
      );
      if (rng() > chance) {
        continue;
      }

      const spot = findOpenSpot(state.tiles, state.width, state.height, tile.x, tile.y);
      if (!spot) {
        continue;
      }

      const spotTile = state.tiles[tileIndex(spot.x, spot.y, state.width)];
      if (isTileBlockedForPlantLife(spotTile) || !isPlantWithinEnvironmentalTolerance(species, spotTile)) {
        continue;
      }

      addPlantInstance(state, speciesId, spot.x, spot.y, 0, 'seed');
      delete mt.dormantSeeds[speciesId];
      hasCurrentSeasonSeedsAfter = false;
    }

    if (!hasCurrentSeasonSeedsAfter) {
      // Re-check after mutations: keep the tile in the season bucket only if it still has a seed
      // for the current season.
      for (const [speciesId] of Object.entries(mt.dormantSeeds || {})) {
        const s = PLANT_BY_ID?.[speciesId];
        if (s?.dispersal?.germination_season === currentSeason) {
          hasCurrentSeasonSeedsAfter = true;
          break;
        }
      }
    }

    if (Object.keys(mt.dormantSeeds || {}).length === 0) {
      delete seedTileIndex[rawIndex];
      continue;
    }
    if (!hasCurrentSeasonSeedsAfter) {
      delete seedTileIndex[rawIndex];
    }
  }
}

export function cleanupDeadPlantsImpl(state, deps) {
  const { maybeCreateDeadLog, tileIndex, afterPlantRemovedForDynamicShade } = deps;
  let plantsMapCloned = false;
  for (const plantId of Object.keys(state.plants)) {
    const plant = state.plants[plantId];
    if (plant.alive) {
      continue;
    }

    if (typeof afterPlantRemovedForDynamicShade === 'function') {
      afterPlantRemovedForDynamicShade(state, plant);
    }

    maybeCreateDeadLog(state, plant);
    const tile = getTileForWrite(state, plant.x, plant.y);
    tile.plantIds = tile.plantIds.filter((id) => id !== plantId);
    if (!plantsMapCloned && typeof state.getMutablePlant === 'function') {
      state.plants = { ...state.plants };
      plantsMapCloned = true;
    }
    delete state.plants[plantId];
  }
}

export function reconcilePlantOccupancyImpl(state, deps) {
  // Disabled (perf): full-grid reconcile + getTileForWrite was very expensive. plantIds are
  // expected to stay consistent via add/remove writers. Restore the block below if desync bugs appear.
  void state;
  void deps;
  return;

  /*
  const { isRockTile, MAX_PLANTS_PER_TILE, inBounds, afterPlantRemovedForDynamicShade } = deps;
  for (const tile of state.tiles) {
    const t = getTileForWrite(state, tile.x, tile.y);
    if (isRockTile(t)) {
      t.plantIds = [];
      continue;
    }

    if (!Array.isArray(t.plantIds)) {
      t.plantIds = [];
      continue;
    }

    const validIds = [];
    for (const plantId of t.plantIds) {
      const plant = state.plants[plantId];
      if (!plant || !plant.alive) {
        continue;
      }
      if (plant.x !== t.x || plant.y !== t.y) {
        continue;
      }
      validIds.push(plantId);
      if (validIds.length >= MAX_PLANTS_PER_TILE) {
        break;
      }
    }
    t.plantIds = validIds;
  }

  for (const [plantId, plant] of Object.entries(state.plants)) {
    if (!plant || !plant.alive) {
      continue;
    }
    if (!inBounds(plant.x, plant.y, state.width, state.height)) {
      if (typeof afterPlantRemovedForDynamicShade === 'function') {
        afterPlantRemovedForDynamicShade(state, plant);
      }
      delete state.plants[plantId];
      continue;
    }

    const hostTile = getTileForWrite(state, plant.x, plant.y);
    if (isRockTile(hostTile)) {
      if (typeof afterPlantRemovedForDynamicShade === 'function') {
        afterPlantRemovedForDynamicShade(state, plant);
      }
      delete state.plants[plantId];
      continue;
    }

    if (!hostTile.plantIds.includes(plantId)) {
      if (hostTile.plantIds.length < MAX_PLANTS_PER_TILE) {
        hostTile.plantIds.push(plantId);
      } else {
        if (typeof afterPlantRemovedForDynamicShade === 'function') {
          afterPlantRemovedForDynamicShade(state, plant);
        }
        delete state.plants[plantId];
      }
    }
  }
  */
}
