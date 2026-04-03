import { runDailyStep } from './dailyPipeline.mjs';
import { applyYearRollover } from './yearRollover.mjs';

export function advanceDayImpl(state, steps = 1, hooks) {
  const {
    clonePlant,
    cloneTile,
    cloneActors,
    createEmptyRecentDispersal,
    cloneAnimalDensityByZone,
    cloneFishDensityByTile,
    cloneWorldItemsByTile,
    cloneCampState,
    ensureDailyWeatherState,
    mulberry32,
  } = hooks;

  const clonedPlants = {};
  for (const [plantId, plant] of Object.entries(state.plants || {})) {
    clonedPlants[plantId] = clonePlant(plant);
  }

  const nextState = {
    ...state,
    plants: clonedPlants,
    tiles: Array.isArray(state.tiles) ? state.tiles.map(cloneTile) : [],
    recentDispersal: createEmptyRecentDispersal(state.dayOfYear),
    animalZoneGrid: state?.animalZoneGrid ? { ...state.animalZoneGrid } : null,
    animalDensityByZone: cloneAnimalDensityByZone(state?.animalDensityByZone),
    fishDensityByTile: cloneFishDensityByTile(state?.fishDensityByTile),
    fishEquilibriumByTile: state?.fishEquilibriumByTile || {},
    fishWaterBodyByTile: state?.fishWaterBodyByTile || {},
    fishWaterBodies: state?.fishWaterBodies || {},
    actors: cloneActors(state?.actors),
    worldItemsByTile: cloneWorldItemsByTile(state?.worldItemsByTile),
    camp: cloneCampState(state?.camp, Math.floor(state.width / 2), Math.floor(state.height / 2)),
    pendingActionQueue: Array.isArray(state?.pendingActionQueue)
      ? state.pendingActionQueue.map((action) => ({ ...(action || {}) }))
      : [],
    currentDayActionLog: Array.isArray(state?.currentDayActionLog)
      ? state.currentDayActionLog.map((entry) => ({ ...(entry || {}) }))
      : [],
  };

  ensureDailyWeatherState(nextState);
  const rng = mulberry32((nextState.seed + nextState.totalDaysSimulated + 1) * 13);

  for (let i = 0; i < steps; i += 1) {
    runDailyStep(nextState, rng, hooks);

    nextState.dayOfYear += 1;
    nextState.totalDaysSimulated += 1;

    if (nextState.dayOfYear > 40) {
      nextState.dayOfYear = 1;
      nextState.year += 1;
      applyYearRollover(nextState, hooks);
    }

    for (const actor of Object.values(nextState.actors || {})) {
      if (!actor || (Number(actor.health) || 0) <= 0) {
        continue;
      }
      if (actor.id !== 'player') {
        actor.thirst = 1;
      }
    }
  }

  return nextState;
}
