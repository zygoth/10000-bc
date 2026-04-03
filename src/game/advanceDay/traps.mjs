import { getLandTrapBaitItemId } from '../trapBaitLand.mjs';

export function rollDeadfallCatchImpl(state, tile, trap, deps) {
  const {
    clamp01,
    DEADFALL_CANDIDATE_SPECIES_IDS,
    ANIMAL_BY_ID,
    getAnimalDensityAtTile,
    DEADFALL_TRAP_CATCH_MODIFIER,
    landTrapBaitMultiplierForTargetSpecies,
    mulberry32,
    DEADFALL_MIN_RELIABILITY,
    DEADFALL_DAILY_RELIABILITY_DECAY,
  } = deps;
  const seedBase = (
    ((state.seed + 71) * 2053)
    + (state.year * 307)
    + (state.dayOfYear * 37)
    + (tile.x * 131)
    + (tile.y * 271)
    + (Number(trap?.placedDay) || 0)
  ) >>> 0;

  const reliabilityRaw = Number(trap?.reliability);
  const reliability = Number.isFinite(reliabilityRaw)
    ? clamp01(reliabilityRaw)
    : 1;

  let bestCatch = null;
  let maxDensity = 0;
  for (let i = 0; i < DEADFALL_CANDIDATE_SPECIES_IDS.length; i += 1) {
    const speciesId = DEADFALL_CANDIDATE_SPECIES_IDS[i];
    const species = ANIMAL_BY_ID[speciesId];
    const density = clamp01(getAnimalDensityAtTile(state, speciesId, tile.x, tile.y));
    maxDensity = Math.max(maxDensity, density);
    const baseCatchRate = clamp01(Number(species?.base_catch_rate) || 0);
    const baitItemId = getLandTrapBaitItemId(trap);
    const baitMultiplier = baitItemId
      ? landTrapBaitMultiplierForTargetSpecies(baitItemId, speciesId)
      : 1;
    const effectiveChance = clamp01(baseCatchRate * density * DEADFALL_TRAP_CATCH_MODIFIER * reliability * baitMultiplier);
    const roll = mulberry32((seedBase + (i * 1291)) >>> 0)();

    if (roll <= effectiveChance) {
      if (!bestCatch || effectiveChance > bestCatch.effectiveChance) {
        bestCatch = {
          speciesId,
          density,
          effectiveChance,
          roll,
        };
      }
    }
  }

  const nextReliability = Math.max(DEADFALL_MIN_RELIABILITY, reliability - DEADFALL_DAILY_RELIABILITY_DECAY);
  return {
    hasCatch: Boolean(bestCatch),
    caughtSpeciesId: bestCatch?.speciesId || null,
    roll: Number.isFinite(Number(bestCatch?.roll)) ? Number(bestCatch.roll) : null,
    lastDensity: bestCatch ? bestCatch.density : maxDensity,
    nextReliability,
  };
}

export function applyDailyDeadfallTrapResolutionImpl(state, deps) {
  const {
    SIMPLE_SNARE_POACH_DAY_4_PLUS_CHANCE,
    SIMPLE_SNARE_POACH_DAY_1_CHANCE,
    SIMPLE_SNARE_POACH_DAY_2_CHANCE,
    SIMPLE_SNARE_POACH_DAY_3_CHANCE,
    mulberry32,
    rollDeadfallCatch,
  } = deps;
  for (const tile of state.tiles || []) {
    const trap = tile?.deadfallTrap;
    if (!trap || trap.active !== true) {
      continue;
    }

    if (trap.poached === true) {
      continue;
    }

    if (trap.hasCatch === true) {
      const catchResolvedTotalDays = Number.isInteger(trap.catchResolvedTotalDays)
        ? trap.catchResolvedTotalDays
        : Number(state.totalDaysSimulated) || 0;
      const daysSinceCatch = Math.max(0, (Number(state.totalDaysSimulated) || 0) - catchResolvedTotalDays);
      let poachChance = SIMPLE_SNARE_POACH_DAY_4_PLUS_CHANCE;
      if (daysSinceCatch <= 0) {
        poachChance = SIMPLE_SNARE_POACH_DAY_1_CHANCE;
      } else if (daysSinceCatch === 1) {
        poachChance = SIMPLE_SNARE_POACH_DAY_2_CHANCE;
      } else if (daysSinceCatch === 2) {
        poachChance = SIMPLE_SNARE_POACH_DAY_3_CHANCE;
      }

      const poachSeed = (
        ((state.seed + 101) * 7411)
        + (state.year * 419)
        + (state.dayOfYear * 79)
        + (tile.x * 173)
        + (tile.y * 263)
        + (Number(trap?.placedDay) || 0)
      ) >>> 0;
      const poachRoll = mulberry32(poachSeed)();
      const poached = poachRoll <= poachChance;

      tile.deadfallTrap = {
        ...trap,
        hasCatch: poached ? false : true,
        poached,
        sprung: true,
        caughtSpeciesId: poached ? null : trap.caughtSpeciesId,
        lastPoachChance: poachChance,
        lastPoachRoll: poachRoll,
        daysSinceCatch,
        lastResolvedYear: state.year,
        lastResolvedDay: state.dayOfYear,
      };
      continue;
    }

    const outcome = rollDeadfallCatch(state, tile, trap);
    tile.deadfallTrap = {
      ...trap,
      hasCatch: outcome.hasCatch,
      poached: false,
      sprung: outcome.hasCatch,
      reliability: outcome.nextReliability,
      caughtSpeciesId: outcome.caughtSpeciesId,
      lastDensity: outcome.lastDensity,
      lastRoll: outcome.roll,
      catchResolvedTotalDays: outcome.hasCatch ? (Number(state.totalDaysSimulated) || 0) : null,
      lastResolvedYear: state.year,
      lastResolvedDay: state.dayOfYear,
    };
  }
}

export function rollFishTrapCatchImpl(state, tile, trap, attemptOrdinal, deps) {
  const {
    clamp01,
    FISH_TRAP_CANDIDATE_SPECIES_IDS,
    ANIMAL_BY_ID,
    getFishDensityAtTile,
    mulberry32,
  } = deps;
  const seedBase = (
    ((state.seed + 131) * 2969)
    + (state.year * 521)
    + (state.dayOfYear * 97)
    + (tile.x * 181)
    + (tile.y * 313)
    + (Number(trap?.placedDay) || 0)
    + (attemptOrdinal * 733)
  ) >>> 0;

  const reliabilityRaw = Number(trap?.reliability);
  const reliability = Number.isFinite(reliabilityRaw)
    ? clamp01(reliabilityRaw)
    : 1;

  let bestCatch = null;
  let maxDensity = 0;
  for (let i = 0; i < FISH_TRAP_CANDIDATE_SPECIES_IDS.length; i += 1) {
    const speciesId = FISH_TRAP_CANDIDATE_SPECIES_IDS[i];
    const species = ANIMAL_BY_ID[speciesId];
    const density = clamp01(getFishDensityAtTile(state, speciesId, tile.x, tile.y));
    maxDensity = Math.max(maxDensity, density);
    if (density <= 0) {
      continue;
    }

    const baseCatchRate = clamp01(Number(species?.base_catch_rate) || 0);
    const effectiveChance = clamp01(baseCatchRate * density * reliability);
    const roll = mulberry32((seedBase + (i * 1453)) >>> 0)();
    if (roll <= effectiveChance) {
      if (!bestCatch || effectiveChance > bestCatch.effectiveChance) {
        bestCatch = {
          speciesId,
          density,
          effectiveChance,
          roll,
        };
      }
    }
  }

  return {
    caughtSpeciesId: bestCatch?.speciesId || null,
    roll: Number.isFinite(Number(bestCatch?.roll)) ? Number(bestCatch.roll) : null,
    lastDensity: bestCatch ? bestCatch.density : maxDensity,
  };
}

export function applyDailyFishTrapResolutionImpl(state, deps) {
  const {
    FISH_TRAP_MAX_STORED_CATCH,
    FISH_TRAP_ATTEMPTS_PER_DAY,
    rollFishTrapCatch,
    clamp01,
    ANIMAL_BY_ID,
    FISH_TRAP_MIN_RELIABILITY,
    FISH_TRAP_DAILY_RELIABILITY_DECAY,
  } = deps;
  for (const tile of state.tiles || []) {
    const trap = tile?.fishTrap;
    if (!trap || trap.active !== true) {
      continue;
    }

    if (tile.waterType !== 'river' || tile.waterFrozen === true) {
      continue;
    }

    const maxStoredCatch = Number.isInteger(trap.maxStoredCatch)
      ? Math.max(1, trap.maxStoredCatch)
      : FISH_TRAP_MAX_STORED_CATCH;
    const storedCatchSpeciesIds = Array.isArray(trap.storedCatchSpeciesIds)
      ? trap.storedCatchSpeciesIds.filter((entry) => typeof entry === 'string' && entry)
      : [];

    const availableSlots = Math.max(0, maxStoredCatch - storedCatchSpeciesIds.length);
    const attempts = Math.min(FISH_TRAP_ATTEMPTS_PER_DAY, availableSlots);
    const tileKey = `${tile.x},${tile.y}`;
    let catchesAdded = 0;
    let lastDensity = 0;
    let lastRoll = null;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const outcome = rollFishTrapCatch(state, tile, trap, attempt);
      lastDensity = outcome.lastDensity;
      lastRoll = outcome.roll;
      if (!outcome.caughtSpeciesId) {
        continue;
      }

      storedCatchSpeciesIds.push(outcome.caughtSpeciesId);
      catchesAdded += 1;

      if (!state.fishDensityByTile[outcome.caughtSpeciesId]) {
        state.fishDensityByTile[outcome.caughtSpeciesId] = {};
      }
      const speciesDensityByTile = state.fishDensityByTile[outcome.caughtSpeciesId];
      const currentDensity = clamp01(Number(speciesDensityByTile[tileKey]) || 0);
      const densityPerCatch = Number(ANIMAL_BY_ID[outcome.caughtSpeciesId]?.population?.density_per_catch);
      const nextDensity = Number.isFinite(densityPerCatch)
        ? clamp01(currentDensity + densityPerCatch)
        : currentDensity;
      speciesDensityByTile[tileKey] = nextDensity;
    }

    const reliabilityRaw = Number(trap?.reliability);
    const reliability = Number.isFinite(reliabilityRaw)
      ? clamp01(reliabilityRaw)
      : 1;

    tile.fishTrap = {
      ...trap,
      active: true,
      sprung: storedCatchSpeciesIds.length > 0,
      reliability: Math.max(FISH_TRAP_MIN_RELIABILITY, reliability - FISH_TRAP_DAILY_RELIABILITY_DECAY),
      storedCatchSpeciesIds,
      maxStoredCatch,
      lastCatchCount: catchesAdded,
      lastDensity,
      lastRoll,
      lastResolvedYear: state.year,
      lastResolvedDay: state.dayOfYear,
    };
  }
}

export function rollSimpleSnareCatchImpl(state, tile, snare, deps) {
  const {
    mulberry32,
    getAnimalDensityAtTile,
    clamp01,
    SIMPLE_SNARE_BASE_CATCH_CHANCE,
    SIMPLE_SNARE_RABBIT_DENSITY_WEIGHT,
    SIMPLE_SNARE_MIN_RELIABILITY,
    SIMPLE_SNARE_DAILY_RELIABILITY_DECAY,
    landTrapBaitMultiplierForTargetSpecies,
    SIMPLE_SNARE_TARGET_SPECIES_ID,
  } = deps;
  const seed = (
    ((state.seed + 11) * 4093)
    + (state.year * 233)
    + (state.dayOfYear * 29)
    + (tile.x * 97)
    + (tile.y * 193)
    + (Number(snare?.placedDay) || 0)
  ) >>> 0;
  const rng = mulberry32(seed);

  const rabbitDensity = getAnimalDensityAtTile(state, 'sylvilagus_floridanus', tile.x, tile.y);
  const reliabilityRaw = Number(snare?.reliability);
  const reliability = Number.isFinite(reliabilityRaw)
    ? clamp01(reliabilityRaw)
    : 1;

  const baseChance = clamp01(SIMPLE_SNARE_BASE_CATCH_CHANCE + (rabbitDensity * SIMPLE_SNARE_RABBIT_DENSITY_WEIGHT));
  const baitItemId = getLandTrapBaitItemId(snare);
  const baitMultiplier = baitItemId
    ? landTrapBaitMultiplierForTargetSpecies(baitItemId, SIMPLE_SNARE_TARGET_SPECIES_ID)
    : 1;
  const effectiveChance = clamp01(baseChance * reliability * baitMultiplier);
  const roll = rng();
  const hasCatch = roll <= effectiveChance;
  const nextReliability = Math.max(SIMPLE_SNARE_MIN_RELIABILITY, reliability - SIMPLE_SNARE_DAILY_RELIABILITY_DECAY);

  return {
    hasCatch,
    roll,
    rabbitDensity,
    nextReliability,
  };
}

export function applyDailySimpleSnareResolutionImpl(state, deps) {
  const {
    SIMPLE_SNARE_POACH_DAY_4_PLUS_CHANCE,
    SIMPLE_SNARE_POACH_DAY_1_CHANCE,
    SIMPLE_SNARE_POACH_DAY_2_CHANCE,
    SIMPLE_SNARE_POACH_DAY_3_CHANCE,
    mulberry32,
    rollSimpleSnareCatch,
  } = deps;
  for (const tile of state.tiles || []) {
    const snare = tile?.simpleSnare;
    if (!snare || snare.active !== true) {
      continue;
    }

    if (snare.poached === true) {
      continue;
    }

    if (snare.hasCatch === true) {
      const catchResolvedTotalDays = Number.isInteger(snare.catchResolvedTotalDays)
        ? snare.catchResolvedTotalDays
        : Number(state.totalDaysSimulated) || 0;
      const daysSinceCatch = Math.max(0, (Number(state.totalDaysSimulated) || 0) - catchResolvedTotalDays);
      let poachChance = SIMPLE_SNARE_POACH_DAY_4_PLUS_CHANCE;
      if (daysSinceCatch <= 0) {
        poachChance = SIMPLE_SNARE_POACH_DAY_1_CHANCE;
      } else if (daysSinceCatch === 1) {
        poachChance = SIMPLE_SNARE_POACH_DAY_2_CHANCE;
      } else if (daysSinceCatch === 2) {
        poachChance = SIMPLE_SNARE_POACH_DAY_3_CHANCE;
      }
      const poachSeed = (
        ((state.seed + 37) * 8191)
        + (state.year * 347)
        + (state.dayOfYear * 61)
        + (tile.x * 149)
        + (tile.y * 257)
        + (Number(snare?.placedDay) || 0)
      ) >>> 0;
      const poachRoll = mulberry32(poachSeed)();
      const poached = poachRoll <= poachChance;

      tile.simpleSnare = {
        ...snare,
        hasCatch: poached ? false : true,
        poached,
        sprung: true,
        lastPoachChance: poachChance,
        lastPoachRoll: poachRoll,
        daysSinceCatch,
        lastResolvedYear: state.year,
        lastResolvedDay: state.dayOfYear,
      };
      continue;
    }

    const outcome = rollSimpleSnareCatch(state, tile, snare);
    tile.simpleSnare = {
      ...snare,
      hasCatch: outcome.hasCatch,
      poached: false,
      sprung: outcome.hasCatch,
      rabbitDensity: outcome.rabbitDensity,
      reliability: outcome.nextReliability,
      lastRoll: outcome.roll,
      catchResolvedTotalDays: outcome.hasCatch ? (Number(state.totalDaysSimulated) || 0) : null,
      lastResolvedYear: state.year,
      lastResolvedDay: state.dayOfYear,
    };
  }
}
