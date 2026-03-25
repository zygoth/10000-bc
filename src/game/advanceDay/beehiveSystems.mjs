export function rollBeehiveYieldForDayImpl(state, tile, range, salt, deps) {
  const { mulberry32, rangeRollIntRandom } = deps;
  const seed = (
    ((state.seed + 1) * 1000003)
    + (state.year * 9176)
    + (state.dayOfYear * 131)
    + (tile.x * 37)
    + (tile.y * 73)
    + salt
  ) >>> 0;
  const rng = mulberry32(seed);
  return rangeRollIntRandom(range, rng, Math.round((range[0] + range[1]) / 2));
}

export function applyBeehiveSeasonalStateImpl(state, deps) {
  const {
    beehiveSeasonModifier,
    rollBeehiveYieldForDay,
    BEEHIVE_HONEY_RANGE_GRAMS,
    BEEHIVE_LARVAE_RANGE_GRAMS,
    BEEHIVE_BEESWAX_RANGE_GRAMS,
  } = deps;
  const seasonMultiplier = beehiveSeasonModifier(state.dayOfYear);

  for (const tile of state.tiles || []) {
    if (!tile?.beehive) {
      continue;
    }

    if (seasonMultiplier <= 0) {
      tile.beehive.active = false;
      tile.beehive.yieldCurrentHoneyGrams = 0;
      tile.beehive.yieldCurrentLarvaeGrams = 0;
      tile.beehive.yieldCurrentBeeswaxGrams = 0;
      continue;
    }

    tile.beehive.active = true;
    tile.beehive.yieldCurrentHoneyGrams = Math.max(
      1,
      Math.round(rollBeehiveYieldForDay(state, tile, BEEHIVE_HONEY_RANGE_GRAMS, 11) * seasonMultiplier),
    );
    tile.beehive.yieldCurrentLarvaeGrams = Math.max(
      1,
      Math.round(rollBeehiveYieldForDay(state, tile, BEEHIVE_LARVAE_RANGE_GRAMS, 23) * seasonMultiplier),
    );
    tile.beehive.yieldCurrentBeeswaxGrams = Math.max(
      1,
      Math.round(rollBeehiveYieldForDay(state, tile, BEEHIVE_BEESWAX_RANGE_GRAMS, 41) * seasonMultiplier),
    );
  }
}

export function generateBeehivesInternalImpl(state, rng, deps) {
  const {
    PLANT_BY_ID,
    lifeStageSize,
    tileIndex,
    isRockTile,
    BEEHIVE_SPECIES_ID,
    applyBeehiveSeasonalState,
  } = deps;
  if (state.beehivesGenerated) {
    return;
  }

  const candidates = [];
  for (const plant of Object.values(state.plants || {})) {
    if (!plant?.alive) {
      continue;
    }

    const species = PLANT_BY_ID[plant.speciesId];
    if (!species || species.longevity !== 'perennial') {
      continue;
    }
    if (lifeStageSize(species, plant.stageName) < 8) {
      continue;
    }

    const tile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
    if (!tile || tile.waterType || tile.deadLog || isRockTile(tile) || tile.beehive) {
      continue;
    }

    const moisture = Number(tile.moisture) || 0;
    const fertility = Number(tile.fertility) || 0;
    const shade = Number(tile.shade) || 0;
    const score = moisture * 0.45 + fertility * 0.4 + (1 - shade) * 0.15 + rng() * 0.35;
    candidates.push({ tile, score });
  }

  if (candidates.length === 0) {
    state.beehivesGenerated = true;
    return;
  }

  candidates.sort((a, b) => b.score - a.score);
  const targetCount = Math.max(1, Math.min(candidates.length, Math.round(candidates.length * 0.15)));
  for (const { tile } of candidates.slice(0, targetCount)) {
    tile.beehive = {
      speciesId: BEEHIVE_SPECIES_ID,
      yieldCurrentHoneyGrams: 0,
      yieldCurrentLarvaeGrams: 0,
      yieldCurrentBeeswaxGrams: 0,
      active: false,
      lastHarvestYear: null,
      lastHarvestDay: null,
    };
  }

  state.beehivesGenerated = true;
  applyBeehiveSeasonalState(state);
}
