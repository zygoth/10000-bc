import { tileIndex } from './simWorld.mjs';

export function cloneAnimalDensityByZone(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(input).map(([zoneId, speciesMap]) => [zoneId, { ...(speciesMap || {}) }]),
  );
}

export function cloneFishDensityByTile(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(input).map(([key, speciesMap]) => [key, { ...(speciesMap || {}) }]),
  );
}

export function cloneStringArray(input) {
  return Array.isArray(input) ? [...input] : [];
}

export function cloneWorldItemsByTile(input) {
  if (!input || typeof input !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(input).map(([key, stacks]) => [key, Array.isArray(stacks) ? stacks.map((stack) => ({ ...(stack || {}) })) : []]),
  );
}

/** Rebind tick COW accessors after `advanceDay` clones `tiles`/`plants` onto a new state object. */
export function refreshTickWorkingMutators(state, clonePlant) {
  const mutablePlantIds = new Set();
  state.getMutableTile = (x, y) => {
    const index = tileIndex(x, y, state.width);
    return state.tiles[index];
  };
  state.getMutablePlant = (plantId) => {
    if (!mutablePlantIds.has(plantId)) {
      state.plants = { ...state.plants };
      state.plants[plantId] = clonePlant(state.plants[plantId]);
      mutablePlantIds.add(plantId);
    }
    return state.plants[plantId];
  };
}

export function createTickWorkingState(state, cloneTile, clonePlant, cloneActors) {
  const workingState = {
    ...state,
    plants: state.plants || {}, // Share plants initially
    tiles: state.tiles || [], // Share tiles initially
    actors: cloneActors(state?.actors),
    camp: cloneCampState(state?.camp, Math.floor(state.width / 2), Math.floor(state.height / 2)),
    worldItemsByTile: cloneWorldItemsByTile(state?.worldItemsByTile),
    pendingActionQueue: Array.isArray(state?.pendingActionQueue)
      ? state.pendingActionQueue.map((action) => ({ ...(action || {}) }))
      : [],
    currentDayActionLog: Array.isArray(state?.currentDayActionLog)
      ? state.currentDayActionLog.map((entry) => ({ ...(entry || {}) }))
      : [],
  };

  // Temporary fix for backwards compatibility - eager clone tiles/plants until all mutators migrate
  workingState.tiles = Array.isArray(workingState.tiles) ? workingState.tiles.map(cloneTile) : [];
  workingState.plants = Object.fromEntries(Object.entries(state.plants || {}).map(([id, p]) => [id, clonePlant(p)]));
  // advanceDay(_, 0) used to shallow-clone these maps; tick actions mutate them and must not alias
  // the committed gameState (tests and snapshots compare before/after references).
  workingState.animalDensityByZone = cloneAnimalDensityByZone(state?.animalDensityByZone);
  workingState.fishDensityByTile = cloneFishDensityByTile(state?.fishDensityByTile);
  if (state?.animalZoneGrid && typeof state.animalZoneGrid === 'object') {
    workingState.animalZoneGrid = { ...state.animalZoneGrid };
  }

  refreshTickWorkingMutators(workingState, clonePlant);

  return workingState;
}

export function cloneCampState(camp, fallbackX = 0, fallbackY = 0) {
  const stockpileStacks = Array.isArray(camp?.stockpile?.stacks)
    ? camp.stockpile.stacks.map((entry) => ({ ...(entry || {}) }))
    : [];
  const stationsUnlocked = Array.isArray(camp?.stationsUnlocked)
    ? [...camp.stationsUnlocked]
    : [];
  const comforts = Array.isArray(camp?.comforts)
    ? [...camp.comforts]
    : [];
  const stationPlacements = camp?.stationPlacements && typeof camp.stationPlacements === 'object'
    ? Object.fromEntries(
      Object.entries(camp.stationPlacements)
        .filter(([stationId, placement]) => (
          typeof stationId === 'string'
          && stationId
          && Number.isInteger(placement?.x)
          && Number.isInteger(placement?.y)
        ))
        .map(([stationId, placement]) => [stationId, { x: placement.x, y: placement.y }]),
    )
    : {};
  const activeTask = camp?.partnerTaskQueue?.active
    ? { ...camp.partnerTaskQueue.active }
    : null;
  const queuedTasks = Array.isArray(camp?.partnerTaskQueue?.queued)
    ? camp.partnerTaskQueue.queued.map((task) => ({ ...(task || {}) }))
    : [];
  const partnerTaskHistory = Array.isArray(camp?.partnerTaskHistory)
    ? camp.partnerTaskHistory.map((entry) => ({ ...(entry || {}) }))
    : [];
  const dryingRackSlots = Array.isArray(camp?.dryingRack?.slots)
    ? camp.dryingRack.slots.map((entry) => ({ ...(entry || {}) }))
    : [];
  const mealPlanIngredients = Array.isArray(camp?.mealPlan?.ingredients)
    ? camp.mealPlan.ingredients.map((entry) => ({ ...(entry || {}) }))
    : [];
  const mealPlanPreview = camp?.mealPlan?.preview && typeof camp.mealPlan.preview === 'object'
    ? { ...camp.mealPlan.preview }
    : null;
  const debriefMedicineRequests = Array.isArray(camp?.debrief?.medicineRequests)
    ? camp.debrief.medicineRequests.map((entry) => ({ ...(entry || {}) }))
    : [];
  const debriefMedicineNotifications = Array.isArray(camp?.debrief?.medicineNotifications)
    ? camp.debrief.medicineNotifications.map((entry) => ({ ...(entry || {}) }))
    : [];
  const debriefVisionNotifications = Array.isArray(camp?.debrief?.visionNotifications)
    ? camp.debrief.visionNotifications.map((entry) => ({ ...(entry || {}) }))
    : [];
  const debriefVisionRequest = camp?.debrief?.visionRequest && typeof camp.debrief.visionRequest === 'object'
    ? { ...camp.debrief.visionRequest }
    : null;
  const debriefVisionSelectionOptions = Array.isArray(camp?.debrief?.visionSelectionOptions)
    ? camp.debrief.visionSelectionOptions.map((entry) => ({ ...(entry || {}) }))
    : [];
  const debriefPendingVisionRevelation = camp?.debrief?.pendingVisionRevelation
    && typeof camp.debrief.pendingVisionRevelation === 'object'
    ? { ...camp.debrief.pendingVisionRevelation }
    : null;
  const debriefPendingVisionChoices = Array.isArray(camp?.debrief?.pendingVisionChoices)
    ? camp.debrief.pendingVisionChoices.map((entry) => ({ ...(entry || {}) }))
    : [];
  const debriefChosenVisionRewards = Array.isArray(camp?.debrief?.chosenVisionRewards)
    ? camp.debrief.chosenVisionRewards.map((entry) => ({ ...(entry || {}) }))
    : [];

  return {
    anchorX: Number.isInteger(camp?.anchorX) ? camp.anchorX : fallbackX,
    anchorY: Number.isInteger(camp?.anchorY) ? camp.anchorY : fallbackY,
    stockpile: { stacks: stockpileStacks },
    stationsUnlocked,
    stationPlacements,
    comforts,
    partnerTaskQueue: {
      active: activeTask,
      queued: queuedTasks,
    },
    partnerTaskHistory,
    dryingRack: {
      capacity: 4,
      slots: dryingRackSlots,
    },
    mealPlan: {
      ingredients: mealPlanIngredients,
      preview: mealPlanPreview,
    },
    nauseaByIngredient: camp?.nauseaByIngredient && typeof camp.nauseaByIngredient === 'object'
      ? { ...camp.nauseaByIngredient }
      : {},
    lastMealResult: camp?.lastMealResult && typeof camp.lastMealResult === 'object'
      ? { ...camp.lastMealResult }
      : null,
    nextDayStewTickBonus: Number.isFinite(Number(camp?.nextDayStewTickBonus))
      ? Math.max(0, Math.floor(Number(camp.nextDayStewTickBonus)))
      : 0,
    lastPartnerMaintenanceDayCompleted: Number.isInteger(camp?.lastPartnerMaintenanceDayCompleted)
      ? camp.lastPartnerMaintenanceDayCompleted
      : null,
    nightlyPlayerSafeThirstUntilDawn: camp?.nightlyPlayerSafeThirstUntilDawn === true,
    identifiedPlantSpeciesIds: cloneStringArray(camp?.identifiedPlantSpeciesIds),
    debrief: {
      active: camp?.debrief?.active === true,
      openedAtDay: Number.isInteger(camp?.debrief?.openedAtDay) ? camp.debrief.openedAtDay : null,
      medicineRequests: debriefMedicineRequests,
      medicineNotifications: debriefMedicineNotifications,
      visionRequest: debriefVisionRequest,
      visionSelectionOptions: debriefVisionSelectionOptions,
      requiresVisionConfirmation: camp?.debrief?.requiresVisionConfirmation === true,
      visionNotifications: debriefVisionNotifications,
      visionUsesThisSeason: Number.isInteger(camp?.debrief?.visionUsesThisSeason)
        ? Math.max(0, camp.debrief.visionUsesThisSeason)
        : 0,
      visionSeasonKey: typeof camp?.debrief?.visionSeasonKey === 'string' ? camp.debrief.visionSeasonKey : null,
      pendingVisionRevelation: debriefPendingVisionRevelation,
      pendingVisionChoices: debriefPendingVisionChoices,
      chosenVisionRewards: debriefChosenVisionRewards,
    },
  };
}
