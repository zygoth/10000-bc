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

  for (const tile of state.tiles) {
    if (isRockTile(tile)) {
      const rockTile = getTileForWrite(state, tile.x, tile.y);
      rockTile.dormantSeeds = {};
      continue;
    }

    const seedEntries = Object.entries(tile.dormantSeeds || {});
    if (seedEntries.length === 0) {
      continue;
    }

    const mt = getTileForWrite(state, tile.x, tile.y);

    for (const [speciesId, entry] of seedEntries) {
      const species = PLANT_BY_ID[speciesId];
      entry.ageDays += 1;

      if (entry.ageDays > species.dispersal.viable_lifespan_days) {
        delete mt.dormantSeeds[speciesId];
        continue;
      }

      if (species.dispersal.germination_season !== currentSeason) {
        continue;
      }

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
    }
  }
}

export function cleanupDeadPlantsImpl(state, deps) {
  const { maybeCreateDeadLog, tileIndex, afterPlantRemovedForDynamicShade } = deps;
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
