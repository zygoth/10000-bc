export function createEmptyRecentDispersal(dayOfYear = null) {
  return {
    dayOfYear,
    totalsByMethod: {},
    byTile: {},
  };
}

function cloneDormantSeeds(dormantSeeds) {
  const cloned = {};
  for (const [speciesId, entry] of Object.entries(dormantSeeds || {})) {
    cloned[speciesId] = {
      ageDays: Number.isFinite(entry?.ageDays) ? entry.ageDays : 0,
    };
  }
  return cloned;
}

export function cloneTile(tile) {
  const beehive = tile?.beehive
    ? {
      ...tile.beehive,
    }
    : null;

  const squirrelCache = tile?.squirrelCache
    ? {
      ...tile.squirrelCache,
    }
    : null;

  const sapTap = tile?.sapTap
    ? {
      ...tile.sapTap,
    }
    : null;

  const simpleSnare = tile?.simpleSnare
    ? {
      ...tile.simpleSnare,
    }
    : null;

  const deadfallTrap = tile?.deadfallTrap
    ? {
      ...tile.deadfallTrap,
    }
    : null;

  const fishTrap = tile?.fishTrap
    ? {
      ...tile.fishTrap,
      storedCatchSpeciesIds: Array.isArray(tile.fishTrap.storedCatchSpeciesIds)
        ? [...tile.fishTrap.storedCatchSpeciesIds]
        : [],
    }
    : null;

  const autoRod = tile?.autoRod
    ? {
      ...tile.autoRod,
      pendingSpeciesIds: Array.isArray(tile.autoRod.pendingSpeciesIds)
        ? [...tile.autoRod.pendingSpeciesIds]
        : [],
    }
    : null;

  const deadLog = tile?.deadLog
    ? {
      ...tile.deadLog,
      fungi: Array.isArray(tile.deadLog.fungi)
        ? tile.deadLog.fungi.map((entry) => ({
          ...entry,
          fruiting_windows: Array.isArray(entry.fruiting_windows)
            ? entry.fruiting_windows.map((window) => ({ ...window }))
            : [],
          per_log_yield_range: Array.isArray(entry.per_log_yield_range)
            ? [...entry.per_log_yield_range]
            : [1, 1],
          rolled_year_by_window: { ...(entry.rolled_year_by_window || {}) },
        }))
        : [],
    }
    : null;

  const groundFungusZone = tile?.groundFungusZone
    ? {
      ...tile.groundFungusZone,
      fruitingWindows: Array.isArray(tile.groundFungusZone.fruitingWindows)
        ? tile.groundFungusZone.fruitingWindows.map((window) => ({ ...window }))
        : [],
      perTileYieldRange: Array.isArray(tile.groundFungusZone.perTileYieldRange)
        ? [...tile.groundFungusZone.perTileYieldRange]
        : [1, 1],
      rolledYearByWindow: { ...(tile.groundFungusZone.rolledYearByWindow || {}) },
    }
    : null;

  return {
    ...tile,
    plantIds: Array.isArray(tile.plantIds) ? [...tile.plantIds] : [],
    dormantSeeds: cloneDormantSeeds(tile.dormantSeeds),
    beehive,
    squirrelCache,
    sapTap,
    simpleSnare,
    deadfallTrap,
    fishTrap,
    autoRod,
    deadLog,
    groundFungusZone,
  };
}

export function clonePlant(plant) {
  return {
    ...plant,
    activeSubStages: Array.isArray(plant.activeSubStages)
      ? plant.activeSubStages.map((entry) => ({ ...entry }))
      : [],
  };
}
