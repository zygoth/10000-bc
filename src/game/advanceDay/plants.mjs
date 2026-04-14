export function runDailyPlantStep(nextState, rng, hooks) {
  const {
    reconcilePlantOccupancy,
    updatePlantLife,
    cleanupDeadPlants,
    applyEnvironmentalVitality,
    processDormantSeeds,
  } = hooks;

  for (const plantId of Object.keys(nextState.plants || {})) {
    const plant = typeof nextState.getMutablePlant === 'function'
      ? nextState.getMutablePlant(plantId)
      : nextState.plants[plantId];
    if (!plant) {
      continue;
    }
    updatePlantLife(nextState, plant, rng);
  }

  cleanupDeadPlants(nextState);
  applyEnvironmentalVitality(nextState);
  cleanupDeadPlants(nextState);
  processDormantSeeds(nextState, rng);
  reconcilePlantOccupancy(nextState);
}
