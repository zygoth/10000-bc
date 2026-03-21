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
  const activeTask = camp?.partnerTaskQueue?.active
    ? { ...camp.partnerTaskQueue.active }
    : null;
  const queuedTasks = Array.isArray(camp?.partnerTaskQueue?.queued)
    ? camp.partnerTaskQueue.queued.map((task) => ({ ...(task || {}) }))
    : [];
  const dryingRackSlots = Array.isArray(camp?.dryingRack?.slots)
    ? camp.dryingRack.slots.map((entry) => ({ ...(entry || {}) }))
    : [];

  return {
    anchorX: Number.isInteger(camp?.anchorX) ? camp.anchorX : fallbackX,
    anchorY: Number.isInteger(camp?.anchorY) ? camp.anchorY : fallbackY,
    stockpile: { stacks: stockpileStacks },
    stationsUnlocked,
    comforts,
    partnerTaskQueue: {
      active: activeTask,
      queued: queuedTasks,
    },
    dryingRack: {
      capacity: 4,
      slots: dryingRackSlots,
    },
  };
}
