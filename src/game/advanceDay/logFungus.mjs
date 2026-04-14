import { getTileForWrite } from '../simWorld.mjs';

export function logFungusHostCompatibleImpl(logFungus, sourceSpeciesId) {
  if (!logFungus || !Array.isArray(logFungus.hostTrees) || logFungus.hostTrees.length === 0) {
    return false;
  }

  if (logFungus.hostTrees.includes(sourceSpeciesId)) {
    return true;
  }

  if (logFungus.hostTrees.includes('any_hardwood')) {
    return true;
  }

  return false;
}

export function ensureDeadLogFungusShapeImpl(deadLog) {
  if (!deadLog) {
    return;
  }
  if (!Array.isArray(deadLog.fungi)) {
    deadLog.fungi = [];
  }
}

export function rollLogFungusYieldImpl(entry, tile, deadLog, rng, deps) {
  const { rangeRollIntRandom, moistureYieldMultiplier } = deps;
  const baseYield = rangeRollIntRandom(entry.per_log_yield_range, rng, 1);
  const moistureMultiplier = moistureYieldMultiplier(Number(tile.moisture) || 0);
  const sizeMultiplier = Number.isFinite(entry.log_size_multiplier)
    ? entry.log_size_multiplier
    : Math.max(0.7, Math.min(1.8, (Number(deadLog.sizeAtDeath) || 8) / 8));
  return Math.max(1, Math.round(baseYield * moistureMultiplier * sizeMultiplier));
}

export function applyLogFungusFruitingImpl(state, rng, deps) {
  const { ensureDeadLogFungusShape, isDayInLogWindow, rollLogFungusYield } = deps;
  for (const tile of state.tiles) {
    if (!tile?.deadLog) {
      continue;
    }

    const mt = getTileForWrite(state, tile.x, tile.y);
    ensureDeadLogFungusShape(mt.deadLog);
    for (const fungusEntry of mt.deadLog.fungi) {
      const windows = Array.isArray(fungusEntry.fruiting_windows) ? fungusEntry.fruiting_windows : [];
      const activeWindowIndices = windows
        .map((window, index) => (isDayInLogWindow(state.dayOfYear, window) ? index : -1))
        .filter((index) => index >= 0);

      if (activeWindowIndices.length === 0) {
        fungusEntry.yield_current_grams = 0;
        continue;
      }

      for (const windowIndex of activeWindowIndices) {
        const window = windows[windowIndex];
        if (!window || state.dayOfYear !== window.startDay) {
          continue;
        }

        if (!fungusEntry.rolled_year_by_window) {
          fungusEntry.rolled_year_by_window = {};
        }
        const rolledYear = Number(fungusEntry.rolled_year_by_window[windowIndex]);
        if (rolledYear === state.year) {
          continue;
        }

        fungusEntry.rolled_year_by_window[windowIndex] = state.year;
        fungusEntry.yield_current_grams = rollLogFungusYield(fungusEntry, mt, mt.deadLog, rng);
      }
    }
  }
}

export function colonizeDeadLogFungiByYearImpl(state, rng, deps) {
  const {
    ensureDeadLogFungusShape,
    MAX_LOG_FUNGI_PER_LOG,
    LOG_FUNGUS_BY_ID,
    logFungusHostCompatible,
    clamp01,
    moistureYieldMultiplier,
  } = deps;
  for (const tile of state.tiles) {
    if (!tile?.deadLog) {
      continue;
    }

    const mt = getTileForWrite(state, tile.x, tile.y);
    ensureDeadLogFungusShape(mt.deadLog);
    const currentDecayStage = Number.isFinite(mt.deadLog.decayStage)
      ? Math.max(1, Math.min(4, Math.round(mt.deadLog.decayStage)))
      : 1;
    const existingSpecies = new Set(mt.deadLog.fungi.map((entry) => entry.species_id));

    for (const speciesId of state.runFungusPool || []) {
      if (mt.deadLog.fungi.length >= MAX_LOG_FUNGI_PER_LOG) {
        break;
      }
      if (existingSpecies.has(speciesId)) {
        continue;
      }

      const logFungus = LOG_FUNGUS_BY_ID[speciesId];
      if (!logFungus) {
        continue;
      }
      if (!logFungusHostCompatible(logFungus, mt.deadLog.sourceSpeciesId)) {
        continue;
      }
      if (!logFungus.preferredDecayStages.includes(currentDecayStage)) {
        continue;
      }

      const chance = clamp01((Number(logFungus.baseSpawnChance) || 0) * moistureYieldMultiplier(Number(mt.moisture) || 0));
      if (rng() > chance) {
        continue;
      }

      mt.deadLog.fungi.push({
        species_id: logFungus.id,
        yield_current_grams: 0,
        fruiting_windows: logFungus.fruitingWindows.map((window) => ({ ...window })),
        per_log_yield_range: [...logFungus.perLogYieldRange],
        log_size_multiplier: Math.max(0.7, Math.min(1.8, (Number(mt.deadLog.sizeAtDeath) || 8) / 8)),
        rolled_year_by_window: {},
      });
      existingSpecies.add(logFungus.id);
    }
  }
}
