export function runDailyPlantStep(nextState, rng, hooks) {
  const {
    reconcilePlantOccupancy,
    updatePlantLife,
    cleanupDeadPlants,
    recalculateDynamicShade,
    applyEnvironmentalVitality,
    processDormantSeeds,
  } = hooks;

  reconcilePlantOccupancy(nextState);

  for (const plant of Object.values(nextState.plants)) {
    updatePlantLife(nextState, plant, rng);
  }

  cleanupDeadPlants(nextState);
  recalculateDynamicShade(nextState);
  applyEnvironmentalVitality(nextState);
  cleanupDeadPlants(nextState);
  processDormantSeeds(nextState, rng);
  reconcilePlantOccupancy(nextState);
}
