export function updatePlantLifeImpl(state, plantInstance, rng, deps) {
  const {
    PLANT_BY_ID,
    stageForDay,
    maxLifeStageMinAge,
    maxLifecycleYearOrdinal,
    lifecycleYearOrdinal,
    getSeason,
    PERENNIAL_WINTER_DAILY_DEATH_RATE,
    buildActiveSubStages,
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

  plantInstance.activeSubStages = buildActiveSubStages(
    species,
    plantInstance.stageName,
    state.dayOfYear,
    plantInstance.activeSubStages,
  );
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
      tile.dormantSeeds = {};
      continue;
    }

    const seedEntries = Object.entries(tile.dormantSeeds);
    if (seedEntries.length === 0) {
      continue;
    }

    for (const [speciesId, entry] of seedEntries) {
      const species = PLANT_BY_ID[speciesId];
      entry.ageDays += 1;

      if (entry.ageDays > species.dispersal.viable_lifespan_days) {
        delete tile.dormantSeeds[speciesId];
        continue;
      }

      if (species.dispersal.germination_season !== currentSeason) {
        continue;
      }

      if (tile.plantIds.length >= MAX_PLANTS_PER_TILE) {
        continue;
      }

      const isDisturbed = tile.disturbed === true;
      if (!isPlantWithinEnvironmentalTolerance(species, tile)) {
        continue;
      }

      const soilMatch = computeSoilMatch(species, tile);
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
      delete tile.dormantSeeds[speciesId];
    }
  }
}

export function cleanupDeadPlantsImpl(state, deps) {
  const { maybeCreateDeadLog, tileIndex } = deps;
  for (const plantId of Object.keys(state.plants)) {
    const plant = state.plants[plantId];
    if (plant.alive) {
      continue;
    }

    maybeCreateDeadLog(state, plant);
    const tile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
    tile.plantIds = tile.plantIds.filter((id) => id !== plantId);
    delete state.plants[plantId];
  }
}

export function reconcilePlantOccupancyImpl(state, deps) {
  const { isRockTile, MAX_PLANTS_PER_TILE, inBounds, tileIndex } = deps;
  for (const tile of state.tiles) {
    if (isRockTile(tile)) {
      tile.plantIds = [];
      continue;
    }

    if (!Array.isArray(tile.plantIds)) {
      tile.plantIds = [];
      continue;
    }

    const validIds = [];
    for (const plantId of tile.plantIds) {
      const plant = state.plants[plantId];
      if (!plant || !plant.alive) {
        continue;
      }
      if (plant.x !== tile.x || plant.y !== tile.y) {
        continue;
      }
      validIds.push(plantId);
      if (validIds.length >= MAX_PLANTS_PER_TILE) {
        break;
      }
    }
    tile.plantIds = validIds;
  }

  for (const [plantId, plant] of Object.entries(state.plants)) {
    if (!plant || !plant.alive) {
      continue;
    }
    if (!inBounds(plant.x, plant.y, state.width, state.height)) {
      delete state.plants[plantId];
      continue;
    }

    const hostTile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
    if (isRockTile(hostTile)) {
      delete state.plants[plantId];
      continue;
    }

    if (!hostTile.plantIds.includes(plantId)) {
      if (hostTile.plantIds.length < MAX_PLANTS_PER_TILE) {
        hostTile.plantIds.push(plantId);
      } else {
        delete state.plants[plantId];
      }
    }
  }
}
