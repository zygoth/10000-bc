import { inBounds, tileIndex } from './simWorld.mjs';

function normalizeRockType(rockType) {
  if (rockType === 'glacial_erratic' || rockType === 'flint_cobble_scatter') {
    return rockType;
  }
  return null;
}

function normalizeFlintCobbleRemaining(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor(parsed));
}

function normalizeWaterCurrentBand(band, fallbackStrength = 0) {
  if (band === 'slow' || band === 'medium' || band === 'fast') {
    return band;
  }
  const strength = Number(fallbackStrength);
  if (!Number.isFinite(strength)) {
    return 'medium';
  }
  if (strength >= 0.66) {
    return 'fast';
  }
  if (strength >= 0.33) {
    return 'medium';
  }
  return 'slow';
}

function normalizeWaterType(waterType) {
  if (!waterType) {
    return null;
  }
  if (waterType === 'pond') {
    return 'pond';
  }
  if (waterType === 'river') {
    return 'river';
  }
  if (waterType === 'stream' || waterType === 'slow_river' || waterType === 'fast_river') {
    return 'river';
  }
  if (waterType === 'bog') {
    return 'pond';
  }
  return null;
}

function legacyBandForWaterType(waterType) {
  if (waterType === 'fast_river') {
    return 'fast';
  }
  if (waterType === 'slow_river') {
    return 'medium';
  }
  if (waterType === 'stream') {
    return 'slow';
  }
  return null;
}

function normalizeDormantSeeds(dormantSeeds) {
  const normalized = {};
  for (const [speciesId, entry] of Object.entries(dormantSeeds || {})) {
    normalized[speciesId] = {
      ageDays: Number.isFinite(entry?.ageDays) ? entry.ageDays : 0,
    };
  }
  return normalized;
}

function normalizeTemperatureBand(band) {
  const value = typeof band === 'string' ? band.toLowerCase() : '';
  if (['freezing', 'cold', 'cool', 'mild', 'warm', 'hot'].includes(value)) {
    return value;
  }
  return 'mild';
}

function normalizeDailyWindVector(vector) {
  const strength = Number(vector?.strength);
  const angleRadians = Number(vector?.angleRadians);
  const x = Number(vector?.x);
  const y = Number(vector?.y);
  const clampedStrength = Number.isFinite(strength) ? Math.max(0, Math.min(1, strength)) : 0;
  const normalizedAngle = Number.isFinite(angleRadians) ? angleRadians : 0;
  const strengthLabel = typeof vector?.strengthLabel === 'string' ? vector.strengthLabel : 'calm';
  return {
    x: Number.isFinite(x) ? x : Number((Math.cos(normalizedAngle) * clampedStrength).toFixed(4)),
    y: Number.isFinite(y) ? y : Number((Math.sin(normalizedAngle) * clampedStrength).toFixed(4)),
    strength: clampedStrength,
    strengthLabel,
    angleRadians: normalizedAngle,
  };
}

function normalizeAutoRod(autoRod) {
  if (!autoRod || typeof autoRod !== 'object') {
    return null;
  }

  const state = typeof autoRod.state === 'string' ? autoRod.state : 'live';
  const normalizedState = (
    state === 'live'
    || state === 'triggered_catch'
    || state === 'triggered_escape'
    || state === 'broken'
  )
    ? state
    : 'live';

  const baitItemId = typeof autoRod.baitItemId === 'string' && autoRod.baitItemId
    ? autoRod.baitItemId
    : null;

  return {
    active: autoRod.active === true,
    state: normalizedState,
    baitItemId,
    pendingSpeciesIds: Array.isArray(autoRod.pendingSpeciesIds)
      ? autoRod.pendingSpeciesIds.filter((entry) => typeof entry === 'string' && entry)
      : [],
    placedYear: Number.isInteger(autoRod.placedYear) ? autoRod.placedYear : null,
    placedDay: Number.isInteger(autoRod.placedDay) ? autoRod.placedDay : null,
    placedDayTick: Number.isInteger(autoRod.placedDayTick) ? autoRod.placedDayTick : null,
    lastResolvedYear: Number.isInteger(autoRod.lastResolvedYear) ? autoRod.lastResolvedYear : null,
    lastResolvedDay: Number.isInteger(autoRod.lastResolvedDay) ? autoRod.lastResolvedDay : null,
    lastResolvedDayTick: Number.isInteger(autoRod.lastResolvedDayTick) ? autoRod.lastResolvedDayTick : null,
    lastSpeciesId: typeof autoRod.lastSpeciesId === 'string' && autoRod.lastSpeciesId
      ? autoRod.lastSpeciesId
      : null,
    lastCatchSuccess: autoRod.lastCatchSuccess === true,
    lastLineSnapped: autoRod.lastLineSnapped === true,
    lastBiteChance: Number.isFinite(Number(autoRod.lastBiteChance))
      ? Math.max(0, Math.min(1, Number(autoRod.lastBiteChance)))
      : null,
    lastBiteRoll: Number.isFinite(Number(autoRod.lastBiteRoll))
      ? Math.max(0, Math.min(1, Number(autoRod.lastBiteRoll)))
      : null,
    lastHookRate: Number.isFinite(Number(autoRod.lastHookRate))
      ? Math.max(0, Math.min(1, Number(autoRod.lastHookRate)))
      : null,
    lastHookRoll: Number.isFinite(Number(autoRod.lastHookRoll))
      ? Math.max(0, Math.min(1, Number(autoRod.lastHookRoll)))
      : null,
    lastSnapProbability: Number.isFinite(Number(autoRod.lastSnapProbability))
      ? Math.max(0, Math.min(1, Number(autoRod.lastSnapProbability)))
      : null,
    lastSnapRoll: Number.isFinite(Number(autoRod.lastSnapRoll))
      ? Math.max(0, Math.min(1, Number(autoRod.lastSnapRoll)))
      : null,
  };
}

function normalizeFishTrap(fishTrap) {
  if (!fishTrap || typeof fishTrap !== 'object') {
    return null;
  }

  return {
    active: fishTrap.active === true,
    sprung: fishTrap.sprung === true,
    reliability: Number.isFinite(Number(fishTrap.reliability))
      ? Math.max(0, Math.min(1, Number(fishTrap.reliability)))
      : 1,
    storedCatchSpeciesIds: Array.isArray(fishTrap.storedCatchSpeciesIds)
      ? fishTrap.storedCatchSpeciesIds.filter((entry) => typeof entry === 'string' && entry)
      : [],
    maxStoredCatch: Number.isInteger(fishTrap.maxStoredCatch) ? Math.max(1, fishTrap.maxStoredCatch) : 3,
    placedYear: Number.isInteger(fishTrap.placedYear) ? fishTrap.placedYear : null,
    placedDay: Number.isInteger(fishTrap.placedDay) ? fishTrap.placedDay : null,
    placedDayTick: Number.isInteger(fishTrap.placedDayTick) ? fishTrap.placedDayTick : null,
    lastResolvedYear: Number.isInteger(fishTrap.lastResolvedYear) ? fishTrap.lastResolvedYear : null,
    lastResolvedDay: Number.isInteger(fishTrap.lastResolvedDay) ? fishTrap.lastResolvedDay : null,
    lastCatchCount: Number.isInteger(fishTrap.lastCatchCount) ? Math.max(0, fishTrap.lastCatchCount) : 0,
  };
}

function normalizeDeadfallTrap(deadfallTrap) {
  if (!deadfallTrap || typeof deadfallTrap !== 'object') {
    return null;
  }

  return {
    active: deadfallTrap.active === true,
    hasCatch: deadfallTrap.hasCatch === true,
    poached: deadfallTrap.poached === true,
    sprung: deadfallTrap.sprung === true,
    reliability: Number.isFinite(Number(deadfallTrap.reliability))
      ? Math.max(0, Math.min(1, Number(deadfallTrap.reliability)))
      : 1,
    lastDensity: Number.isFinite(Number(deadfallTrap.lastDensity))
      ? Math.max(0, Math.min(1, Number(deadfallTrap.lastDensity)))
      : 0,
    caughtSpeciesId: typeof deadfallTrap.caughtSpeciesId === 'string' && deadfallTrap.caughtSpeciesId
      ? deadfallTrap.caughtSpeciesId
      : null,
    placedYear: Number.isInteger(deadfallTrap.placedYear) ? deadfallTrap.placedYear : null,
    placedDay: Number.isInteger(deadfallTrap.placedDay) ? deadfallTrap.placedDay : null,
    placedDayTick: Number.isInteger(deadfallTrap.placedDayTick) ? deadfallTrap.placedDayTick : null,
    catchResolvedTotalDays: Number.isInteger(deadfallTrap.catchResolvedTotalDays) ? deadfallTrap.catchResolvedTotalDays : null,
    daysSinceCatch: Number.isInteger(deadfallTrap.daysSinceCatch) ? Math.max(0, deadfallTrap.daysSinceCatch) : 0,
    lastResolvedYear: Number.isInteger(deadfallTrap.lastResolvedYear) ? deadfallTrap.lastResolvedYear : null,
    lastResolvedDay: Number.isInteger(deadfallTrap.lastResolvedDay) ? deadfallTrap.lastResolvedDay : null,
    lastRoll: Number.isFinite(Number(deadfallTrap.lastRoll)) ? Number(deadfallTrap.lastRoll) : null,
    lastPoachChance: Number.isFinite(Number(deadfallTrap.lastPoachChance))
      ? Math.max(0, Math.min(1, Number(deadfallTrap.lastPoachChance)))
      : null,
    lastPoachRoll: Number.isFinite(Number(deadfallTrap.lastPoachRoll))
      ? Math.max(0, Math.min(1, Number(deadfallTrap.lastPoachRoll)))
      : null,
  };
}

function normalizeSimpleSnare(simpleSnare) {
  if (!simpleSnare || typeof simpleSnare !== 'object') {
    return null;
  }

  return {
    active: simpleSnare.active === true,
    hasCatch: simpleSnare.hasCatch === true,
    poached: simpleSnare.poached === true,
    sprung: simpleSnare.sprung === true,
    reliability: Number.isFinite(Number(simpleSnare.reliability))
      ? Math.max(0, Math.min(1, Number(simpleSnare.reliability)))
      : 1,
    rabbitDensity: Number.isFinite(Number(simpleSnare.rabbitDensity))
      ? Math.max(0, Math.min(1, Number(simpleSnare.rabbitDensity)))
      : 0,
    placedYear: Number.isInteger(simpleSnare.placedYear) ? simpleSnare.placedYear : null,
    placedDay: Number.isInteger(simpleSnare.placedDay) ? simpleSnare.placedDay : null,
    placedDayTick: Number.isInteger(simpleSnare.placedDayTick) ? simpleSnare.placedDayTick : null,
    catchResolvedTotalDays: Number.isInteger(simpleSnare.catchResolvedTotalDays) ? simpleSnare.catchResolvedTotalDays : null,
    daysSinceCatch: Number.isInteger(simpleSnare.daysSinceCatch) ? Math.max(0, simpleSnare.daysSinceCatch) : 0,
    lastResolvedYear: Number.isInteger(simpleSnare.lastResolvedYear) ? simpleSnare.lastResolvedYear : null,
    lastResolvedDay: Number.isInteger(simpleSnare.lastResolvedDay) ? simpleSnare.lastResolvedDay : null,
    lastRoll: Number.isFinite(Number(simpleSnare.lastRoll)) ? Number(simpleSnare.lastRoll) : null,
    lastPoachChance: Number.isFinite(Number(simpleSnare.lastPoachChance))
      ? Math.max(0, Math.min(1, Number(simpleSnare.lastPoachChance)))
      : null,
    lastPoachRoll: Number.isFinite(Number(simpleSnare.lastPoachRoll))
      ? Math.max(0, Math.min(1, Number(simpleSnare.lastPoachRoll)))
      : null,
  };
}

function normalizeFishDensityByTile(input) {
  const normalized = {};
  for (const [speciesId, byTile] of Object.entries(input || {})) {
    const tileMap = {};
    for (const [tileKey, density] of Object.entries(byTile || {})) {
      const n = Number(density);
      tileMap[tileKey] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    }
    normalized[speciesId] = tileMap;
  }
  return normalized;
}

function normalizeAnimalDensityByZone(input) {
  const normalized = {};
  for (const [speciesId, byZone] of Object.entries(input || {})) {
    const zoneMap = {};
    for (const [zoneId, density] of Object.entries(byZone || {})) {
      const n = Number(density);
      zoneMap[zoneId] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    }
    normalized[speciesId] = zoneMap;
  }
  return normalized;
}

function normalizeAnimalZoneGrid(zoneGrid) {
  if (!zoneGrid || typeof zoneGrid !== 'object') {
    return null;
  }
  const zoneCols = Number(zoneGrid.zoneCols);
  const zoneRows = Number(zoneGrid.zoneRows);
  if (!Number.isInteger(zoneCols) || !Number.isInteger(zoneRows) || zoneCols < 1 || zoneRows < 1) {
    return null;
  }
  return { zoneCols, zoneRows };
}

function normalizeInventory(inventory) {
  const stacks = Array.isArray(inventory?.stacks)
    ? inventory.stacks.map((entry) => ({ ...(entry || {}) }))
    : [];

  return {
    gridWidth: Number.isInteger(inventory?.gridWidth) ? Math.max(1, inventory.gridWidth) : 6,
    gridHeight: Number.isInteger(inventory?.gridHeight) ? Math.max(1, inventory.gridHeight) : 4,
    maxCarryWeightKg: Number.isFinite(Number(inventory?.maxCarryWeightKg))
      ? Math.max(0, Number(inventory.maxCarryWeightKg))
      : 15,
    stacks,
  };
}

function normalizeTaskQueue(taskQueue) {
  return {
    active: taskQueue?.active && typeof taskQueue.active === 'object'
      ? { ...taskQueue.active }
      : null,
    queued: Array.isArray(taskQueue?.queued)
      ? taskQueue.queued.map((entry) => ({ ...(entry || {}) }))
      : [],
  };
}

function normalizeActors(actors, width, height) {
  const spawnX = Math.max(0, Math.floor(Number(width) / 2));
  const spawnY = Math.max(0, Math.floor(Number(height) / 2));
  const defaults = {
    player: {
      id: 'player',
      role: 'player',
      x: spawnX,
      y: spawnY,
      hunger: 1,
      thirst: 1,
      health: 1,
      tickBudgetBase: 200,
      tickBudgetCurrent: 200,
      overdraftTicks: 0,
      inventory: normalizeInventory(null),
    },
    partner: {
      id: 'partner',
      role: 'partner',
      x: spawnX,
      y: spawnY,
      hunger: 1,
      thirst: 1,
      health: 1,
      tickBudgetBase: 200,
      tickBudgetCurrent: 200,
      overdraftTicks: 0,
      inventory: normalizeInventory(null),
      taskQueue: normalizeTaskQueue(null),
    },
  };

  const normalized = {};
  for (const [actorId, actor] of Object.entries(actors || {})) {
    const base = defaults[actorId] || {
      id: actorId,
      role: actorId,
      x: spawnX,
      y: spawnY,
      hunger: 1,
      thirst: 1,
      health: 1,
      tickBudgetBase: 200,
      tickBudgetCurrent: 200,
      overdraftTicks: 0,
      inventory: normalizeInventory(null),
      taskQueue: normalizeTaskQueue(null),
    };

    normalized[actorId] = {
      ...base,
      ...actor,
      x: Number.isInteger(actor?.x) ? actor.x : base.x,
      y: Number.isInteger(actor?.y) ? actor.y : base.y,
      hunger: Number.isFinite(Number(actor?.hunger)) ? Math.max(0, Math.min(1, Number(actor.hunger))) : base.hunger,
      thirst: Number.isFinite(Number(actor?.thirst)) ? Math.max(0, Math.min(1, Number(actor.thirst))) : base.thirst,
      health: Number.isFinite(Number(actor?.health)) ? Math.max(0, Math.min(1, Number(actor.health))) : base.health,
      tickBudgetBase: Number.isFinite(Number(actor?.tickBudgetBase)) ? Math.max(0, Number(actor.tickBudgetBase)) : base.tickBudgetBase,
      tickBudgetCurrent: Number.isFinite(Number(actor?.tickBudgetCurrent)) ? Number(actor.tickBudgetCurrent) : base.tickBudgetCurrent,
      overdraftTicks: Number.isFinite(Number(actor?.overdraftTicks)) ? Math.max(0, Math.floor(Number(actor.overdraftTicks))) : base.overdraftTicks,
      inventory: normalizeInventory(actor?.inventory),
      taskQueue: normalizeTaskQueue(actor?.taskQueue),
    };
  }

  if (!normalized.player) {
    normalized.player = defaults.player;
  }
  if (!normalized.partner) {
    normalized.partner = defaults.partner;
  }

  return normalized;
}

function normalizeWorldItemsByTile(worldItemsByTile) {
  const normalized = {};
  for (const [tileKey, stacks] of Object.entries(worldItemsByTile || {})) {
    normalized[tileKey] = Array.isArray(stacks)
      ? stacks.map((entry) => ({ ...(entry || {}) }))
      : [];
  }
  return normalized;
}

function normalizeCampState(camp, width, height) {
  const fallbackX = Math.max(0, Math.floor(Number(width) / 2));
  const fallbackY = Math.max(0, Math.floor(Number(height) / 2));
  const dryingRackSlots = Array.isArray(camp?.dryingRack?.slots)
    ? camp.dryingRack.slots.map((entry) => ({ ...(entry || {}) }))
    : [];
  return {
    anchorX: Number.isInteger(camp?.anchorX) ? camp.anchorX : fallbackX,
    anchorY: Number.isInteger(camp?.anchorY) ? camp.anchorY : fallbackY,
    stockpile: {
      stacks: Array.isArray(camp?.stockpile?.stacks)
        ? camp.stockpile.stacks.map((entry) => ({ ...(entry || {}) }))
        : [],
    },
    stationsUnlocked: Array.isArray(camp?.stationsUnlocked)
      ? camp.stationsUnlocked.filter((entry) => typeof entry === 'string')
      : [],
    comforts: Array.isArray(camp?.comforts)
      ? camp.comforts.filter((entry) => typeof entry === 'string')
      : [],
    partnerTaskQueue: normalizeTaskQueue(camp?.partnerTaskQueue),
    dryingRack: {
      capacity: 4,
      slots: dryingRackSlots,
    },
  };
}

function normalizeActionLog(entries) {
  return Array.isArray(entries)
    ? entries.map((entry) => ({ ...(entry || {}) }))
    : [];
}

function normalizeGroundFungusZone(zone) {
  if (!zone || typeof zone !== 'object') {
    return null;
  }

  const annualFruitChance = Number(zone.annualFruitChance);
  const yieldCurrentGrams = Number(zone.yieldCurrentGrams);
  const normalizedWindows = Array.isArray(zone.fruitingWindows)
    ? zone.fruitingWindows
      .map((window) => {
        const startDay = Number(window?.startDay);
        const endDay = Number(window?.endDay);
        if (!Number.isInteger(startDay) || !Number.isInteger(endDay)) {
          return null;
        }
        return { startDay, endDay };
      })
      .filter(Boolean)
    : [];
  const normalizedYieldRange = Array.isArray(zone.perTileYieldRange) && zone.perTileYieldRange.length >= 2
    ? [Number(zone.perTileYieldRange[0]), Number(zone.perTileYieldRange[1])]
    : [1, 1];

  return {
    type: zone.type || 'ground_fungus_zone',
    speciesId: typeof zone.speciesId === 'string' ? zone.speciesId : 'unknown',
    zoneId: typeof zone.zoneId === 'string' ? zone.zoneId : 'unknown:0',
    annualFruitChance: Number.isFinite(annualFruitChance) ? Math.max(0, Math.min(1, annualFruitChance)) : 0,
    fruitingWindows: normalizedWindows,
    perTileYieldRange: normalizedYieldRange,
    yieldCurrentGrams: Number.isFinite(yieldCurrentGrams) ? Math.max(0, yieldCurrentGrams) : 0,
    rolledYearByWindow: { ...(zone.rolledYearByWindow || {}) },
  };
}

function normalizeBeehive(beehive) {
  if (!beehive || typeof beehive !== 'object') {
    return null;
  }

  const yieldCurrentHoneyGrams = Number(beehive.yieldCurrentHoneyGrams);
  const yieldCurrentLarvaeGrams = Number(beehive.yieldCurrentLarvaeGrams);
  const yieldCurrentBeeswaxGrams = Number(beehive.yieldCurrentBeeswaxGrams);

  return {
    speciesId: typeof beehive.speciesId === 'string' ? beehive.speciesId : 'bombus_pennsylvanicus_colony',
    yieldCurrentHoneyGrams: Number.isFinite(yieldCurrentHoneyGrams) ? Math.max(0, yieldCurrentHoneyGrams) : 0,
    yieldCurrentLarvaeGrams: Number.isFinite(yieldCurrentLarvaeGrams) ? Math.max(0, yieldCurrentLarvaeGrams) : 0,
    yieldCurrentBeeswaxGrams: Number.isFinite(yieldCurrentBeeswaxGrams) ? Math.max(0, yieldCurrentBeeswaxGrams) : 0,
    active: beehive.active === true,
    lastHarvestYear: Number.isInteger(beehive.lastHarvestYear) ? beehive.lastHarvestYear : null,
    lastHarvestDay: Number.isInteger(beehive.lastHarvestDay) ? beehive.lastHarvestDay : null,
  };
}

function normalizeSquirrelCache(squirrelCache) {
  if (!squirrelCache || typeof squirrelCache !== 'object') {
    return null;
  }

  const nutContentGrams = Number(squirrelCache.nutContentGrams);
  const placementType = squirrelCache.placementType === 'dead_tree' ? 'dead_tree' : 'ground';
  const cachedSpeciesId = typeof squirrelCache.cachedSpeciesId === 'string' ? squirrelCache.cachedSpeciesId : 'unknown';
  const cachedPartName = typeof squirrelCache.cachedPartName === 'string' ? squirrelCache.cachedPartName : 'unknown';
  const cachedSubStageId = typeof squirrelCache.cachedSubStageId === 'string' ? squirrelCache.cachedSubStageId : 'unknown';

  return {
    cachedSpeciesId,
    cachedPartName,
    cachedSubStageId,
    nutContentGrams: Number.isFinite(nutContentGrams) ? Math.max(0, nutContentGrams) : 0,
    placementType,
    discovered: squirrelCache.discovered === true,
  };
}

function normalizeSapTap(sapTap) {
  if (!sapTap || typeof sapTap !== 'object') {
    return null;
  }

  return {
    hasSpout: sapTap.hasSpout === true,
    insertedDay: Number.isInteger(sapTap.insertedDay) ? sapTap.insertedDay : null,
    insertedDayTick: Number.isInteger(sapTap.insertedDayTick) ? sapTap.insertedDayTick : null,
    hasVessel: sapTap.hasVessel === true,
    vesselPlacedDay: Number.isInteger(sapTap.vesselPlacedDay) ? sapTap.vesselPlacedDay : null,
    vesselPlacedDayTick: Number.isInteger(sapTap.vesselPlacedDayTick) ? sapTap.vesselPlacedDayTick : null,
    vesselSapUnits: Number.isInteger(sapTap.vesselSapUnits) ? Math.max(0, sapTap.vesselSapUnits) : null,
    vesselCapacityUnits: Number.isInteger(sapTap.vesselCapacityUnits) ? Math.max(1, sapTap.vesselCapacityUnits) : null,
  };
}

function normalizeDeadLog(deadLog) {
  if (!deadLog || typeof deadLog !== 'object') {
    return null;
  }

  const sizeAtDeath = Number(deadLog.sizeAtDeath);
  const fungi = Array.isArray(deadLog.fungi)
    ? deadLog.fungi.map((entry) => {
      const windows = Array.isArray(entry?.fruiting_windows)
        ? entry.fruiting_windows
          .map((window) => {
            const startDay = Number(window?.startDay);
            const endDay = Number(window?.endDay);
            if (!Number.isInteger(startDay) || !Number.isInteger(endDay)) {
              return null;
            }
            return { startDay, endDay };
          })
          .filter(Boolean)
        : [];
      const yieldRange = Array.isArray(entry?.per_log_yield_range) && entry.per_log_yield_range.length >= 2
        ? [Number(entry.per_log_yield_range[0]), Number(entry.per_log_yield_range[1])]
        : [1, 1];

      return {
        species_id: typeof entry?.species_id === 'string' ? entry.species_id : 'unknown',
        yield_current_grams: Number.isFinite(Number(entry?.yield_current_grams))
          ? Math.max(0, Number(entry.yield_current_grams))
          : 0,
        fruiting_windows: windows,
        per_log_yield_range: yieldRange,
        log_size_multiplier: Number.isFinite(Number(entry?.log_size_multiplier))
          ? Number(entry.log_size_multiplier)
          : 1,
        rolled_year_by_window: { ...(entry?.rolled_year_by_window || {}) },
      };
    })
    : [];

  return {
    sourceSpeciesId: typeof deadLog.sourceSpeciesId === 'string' ? deadLog.sourceSpeciesId : 'unknown',
    sizeAtDeath: Number.isFinite(sizeAtDeath) ? Math.max(1, Math.round(sizeAtDeath)) : 8,
    decayStage: Number.isFinite(deadLog.decayStage) ? Math.max(1, Math.min(4, Math.round(deadLog.decayStage))) : 1,
    createdYear: Number.isInteger(deadLog.createdYear) ? deadLog.createdYear : null,
    createdDayOfYear: Number.isInteger(deadLog.createdDayOfYear) ? deadLog.createdDayOfYear : null,
    fungi,
  };
}

function normalizeTileForLoad(tile) {
  const legacyWaterType = tile?.waterType;
  const normalizedWaterType = normalizeWaterType(legacyWaterType);
  const fallbackLegacyBand = legacyBandForWaterType(legacyWaterType);
  const normalized = {
    ...tile,
    waterType: normalizedWaterType,
    dormantSeeds: normalizeDormantSeeds(tile.dormantSeeds),
    beehive: normalizeBeehive(tile.beehive),
    squirrelCache: normalizeSquirrelCache(tile.squirrelCache),
    sapTap: normalizeSapTap(tile.sapTap),
    simpleSnare: normalizeSimpleSnare(tile.simpleSnare),
    deadfallTrap: normalizeDeadfallTrap(tile.deadfallTrap),
    fishTrap: normalizeFishTrap(tile.fishTrap),
    autoRod: normalizeAutoRod(tile.autoRod),
    deadLog: normalizeDeadLog(tile.deadLog),
    groundFungusZone: normalizeGroundFungusZone(tile.groundFungusZone),
    rockType: normalizeRockType(tile.rockType),
    flintCobbleRemaining: normalizeFlintCobbleRemaining(tile.flintCobbleRemaining),
  };

  if (normalized.rockType !== 'flint_cobble_scatter') {
    normalized.flintCobbleRemaining = null;
  }

  if (!normalized.waterType) {
    normalized.waterType = null;
    normalized.waterDepth = null;
    normalized.waterCurrentStrength = 0;
    normalized.waterCurrentBand = null;
    normalized.waterFrozen = false;
  } else if (!normalized.waterDepth) {
    normalized.waterDepth = 'shallow';
    normalized.waterCurrentStrength = Number.isFinite(Number(normalized.waterCurrentStrength))
      ? Math.max(0, Math.min(1, Number(normalized.waterCurrentStrength)))
      : 0;
    normalized.waterCurrentBand = normalized.waterType === 'river'
      ? normalizeWaterCurrentBand(
        normalized.waterCurrentBand || fallbackLegacyBand,
        normalized.waterCurrentStrength,
      )
      : null;
    normalized.waterFrozen = normalized.waterFrozen === true;
  } else {
    normalized.waterCurrentStrength = Number.isFinite(Number(normalized.waterCurrentStrength))
      ? Math.max(0, Math.min(1, Number(normalized.waterCurrentStrength)))
      : 0;
    normalized.waterCurrentBand = normalized.waterType === 'river'
      ? normalizeWaterCurrentBand(
        normalized.waterCurrentBand || fallbackLegacyBand,
        normalized.waterCurrentStrength,
      )
      : null;
    normalized.waterFrozen = normalized.waterFrozen === true;
  }

  return normalized;
}

function serializeTile(tile) {
  const serialized = {
    ...tile,
    dormantSeeds: normalizeDormantSeeds(tile.dormantSeeds),
    beehive: normalizeBeehive(tile.beehive),
    squirrelCache: normalizeSquirrelCache(tile.squirrelCache),
    sapTap: normalizeSapTap(tile.sapTap),
    simpleSnare: normalizeSimpleSnare(tile.simpleSnare),
    deadfallTrap: normalizeDeadfallTrap(tile.deadfallTrap),
    fishTrap: normalizeFishTrap(tile.fishTrap),
    autoRod: normalizeAutoRod(tile.autoRod),
    deadLog: normalizeDeadLog(tile.deadLog),
    groundFungusZone: normalizeGroundFungusZone(tile.groundFungusZone),
    rockType: normalizeRockType(tile.rockType),
    flintCobbleRemaining: normalizeFlintCobbleRemaining(tile.flintCobbleRemaining),
  };

  if (serialized.rockType !== 'flint_cobble_scatter') {
    serialized.flintCobbleRemaining = null;
  }

  if (!serialized.waterType) {
    delete serialized.waterType;
    delete serialized.waterDepth;
    delete serialized.waterCurrentStrength;
    delete serialized.waterCurrentBand;
    delete serialized.waterFrozen;
  } else {
    serialized.waterCurrentStrength = Number.isFinite(Number(serialized.waterCurrentStrength))
      ? Math.max(0, Math.min(1, Number(serialized.waterCurrentStrength)))
      : 0;
    serialized.waterCurrentBand = serialized.waterType === 'river'
      ? normalizeWaterCurrentBand(serialized.waterCurrentBand, serialized.waterCurrentStrength)
      : null;
    serialized.waterFrozen = serialized.waterFrozen === true;
  }

  if (!serialized.deadLog) {
    delete serialized.deadLog;
  }

  if (!serialized.beehive) {
    delete serialized.beehive;
  }

  if (!serialized.squirrelCache) {
    delete serialized.squirrelCache;
  }

  if (!serialized.sapTap || serialized.sapTap.hasSpout !== true) {
    delete serialized.sapTap;
  }

  if (!serialized.simpleSnare || serialized.simpleSnare.active !== true) {
    delete serialized.simpleSnare;
  }

  if (!serialized.deadfallTrap || serialized.deadfallTrap.active !== true) {
    delete serialized.deadfallTrap;
  }

  if (!serialized.fishTrap || serialized.fishTrap.active !== true) {
    delete serialized.fishTrap;
  }

  if (!serialized.autoRod || serialized.autoRod.active !== true) {
    delete serialized.autoRod;
  }

  if (!serialized.groundFungusZone) {
    delete serialized.groundFungusZone;
  }

  if (!serialized.rockType) {
    delete serialized.rockType;
  }

  if (!(serialized.rockType === 'flint_cobble_scatter' && Number.isInteger(serialized.flintCobbleRemaining))) {
    delete serialized.flintCobbleRemaining;
  }

  return serialized;
}

function normalizeStateForLoad(candidate) {
  const animalZoneGrid = normalizeAnimalZoneGrid(candidate.animalZoneGrid);
  const animalDensityByZone = normalizeAnimalDensityByZone(candidate.animalDensityByZone);
  const animalZonesGenerated = candidate.animalZonesGenerated === true
    && Object.keys(animalDensityByZone).length > 0;
  const fishDensityByTile = normalizeFishDensityByTile(candidate.fishDensityByTile);
  const fishEquilibriumByTile = normalizeFishDensityByTile(candidate.fishEquilibriumByTile);
  const fishWaterBodyByTile = { ...(candidate.fishWaterBodyByTile || {}) };
  const fishWaterBodies = { ...(candidate.fishWaterBodies || {}) };
  const fishPopulationsGenerated = candidate.fishPopulationsGenerated === true
    && Object.keys(fishDensityByTile).length > 0;
  const weatherTemperatureVarianceF = Number.isFinite(Number(candidate.weatherTemperatureVarianceF))
    ? Math.max(-6, Math.min(6, Number(candidate.weatherTemperatureVarianceF)))
    : 0;
  const weatherWindAngleRadians = Number.isFinite(Number(candidate.weatherWindAngleRadians))
    ? Number(candidate.weatherWindAngleRadians)
    : 0;
  const weatherWindStrength = Number.isFinite(Number(candidate.weatherWindStrength))
    ? Math.max(0, Math.min(1, Number(candidate.weatherWindStrength)))
    : 0;
  const dailyTemperatureF = Number.isFinite(Number(candidate.dailyTemperatureF))
    ? Number(candidate.dailyTemperatureF)
    : 0;
  const dailyTemperatureBand = normalizeTemperatureBand(candidate.dailyTemperatureBand);
  const dailyWindVector = normalizeDailyWindVector(candidate.dailyWindVector);
  const consecutiveFreezingDays = Number.isFinite(Number(candidate.consecutiveFreezingDays))
    ? Math.max(0, Math.floor(Number(candidate.consecutiveFreezingDays)))
    : 0;
  const runSquirrelCacheNutPool = Array.isArray(candidate.runSquirrelCacheNutPool)
    ? candidate.runSquirrelCacheNutPool.filter((entry) => typeof entry === 'string')
    : [];
  const beehivesGenerated = candidate.beehivesGenerated === true;
  const squirrelCachesGenerated = candidate.squirrelCachesGenerated === true;
  const dayTick = Number.isInteger(candidate.dayTick) ? Math.max(0, Math.min(399, candidate.dayTick)) : 0;
  const actors = normalizeActors(candidate.actors, candidate.width, candidate.height);
  const worldItemsByTile = normalizeWorldItemsByTile(candidate.worldItemsByTile);
  const camp = normalizeCampState(candidate.camp, candidate.width, candidate.height);
  const pendingActionQueue = normalizeActionLog(candidate.pendingActionQueue);
  const currentDayActionLog = normalizeActionLog(candidate.currentDayActionLog);

  return {
    ...candidate,
    tiles: candidate.tiles.map((tile) => normalizeTileForLoad(tile)),
    animalZonesGenerated,
    animalZoneGrid,
    animalDensityByZone,
    fishPopulationsGenerated,
    fishDensityByTile,
    fishEquilibriumByTile,
    fishWaterBodyByTile,
    fishWaterBodies,
    weatherTemperatureVarianceF,
    weatherWindAngleRadians,
    weatherWindStrength,
    dailyTemperatureF,
    dailyTemperatureBand,
    dailyWindVector,
    consecutiveFreezingDays,
    runSquirrelCacheNutPool,
    beehivesGenerated,
    squirrelCachesGenerated,
    dayTick,
    actors,
    worldItemsByTile,
    camp,
    pendingActionQueue,
    currentDayActionLog,
  };
}

function normalizeStateForSave(state) {
  const animalZoneGrid = normalizeAnimalZoneGrid(state.animalZoneGrid);
  const animalDensityByZone = normalizeAnimalDensityByZone(state.animalDensityByZone);
  const animalZonesGenerated = state.animalZonesGenerated === true
    && Object.keys(animalDensityByZone).length > 0;
  const fishDensityByTile = normalizeFishDensityByTile(state.fishDensityByTile);
  const fishEquilibriumByTile = normalizeFishDensityByTile(state.fishEquilibriumByTile);
  const fishWaterBodyByTile = { ...(state.fishWaterBodyByTile || {}) };
  const fishWaterBodies = { ...(state.fishWaterBodies || {}) };
  const fishPopulationsGenerated = state.fishPopulationsGenerated === true
    && Object.keys(fishDensityByTile).length > 0;
  const weatherTemperatureVarianceF = Number.isFinite(Number(state.weatherTemperatureVarianceF))
    ? Math.max(-6, Math.min(6, Number(state.weatherTemperatureVarianceF)))
    : 0;
  const weatherWindAngleRadians = Number.isFinite(Number(state.weatherWindAngleRadians))
    ? Number(state.weatherWindAngleRadians)
    : 0;
  const weatherWindStrength = Number.isFinite(Number(state.weatherWindStrength))
    ? Math.max(0, Math.min(1, Number(state.weatherWindStrength)))
    : 0;
  const dailyTemperatureF = Number.isFinite(Number(state.dailyTemperatureF))
    ? Number(state.dailyTemperatureF)
    : 0;
  const dailyTemperatureBand = normalizeTemperatureBand(state.dailyTemperatureBand);
  const dailyWindVector = normalizeDailyWindVector(state.dailyWindVector);
  const consecutiveFreezingDays = Number.isFinite(Number(state.consecutiveFreezingDays))
    ? Math.max(0, Math.floor(Number(state.consecutiveFreezingDays)))
    : 0;
  const runSquirrelCacheNutPool = Array.isArray(state.runSquirrelCacheNutPool)
    ? state.runSquirrelCacheNutPool.filter((entry) => typeof entry === 'string')
    : [];
  const beehivesGenerated = state.beehivesGenerated === true;
  const squirrelCachesGenerated = state.squirrelCachesGenerated === true;
  const dayTick = Number.isInteger(state.dayTick) ? Math.max(0, Math.min(399, state.dayTick)) : 0;
  const actors = normalizeActors(state.actors, state.width, state.height);
  const worldItemsByTile = normalizeWorldItemsByTile(state.worldItemsByTile);
  const camp = normalizeCampState(state.camp, state.width, state.height);
  const pendingActionQueue = normalizeActionLog(state.pendingActionQueue);
  const currentDayActionLog = normalizeActionLog(state.currentDayActionLog);

  return {
    ...state,
    tiles: state.tiles.map((tile) => serializeTile(tile)),
    animalZonesGenerated,
    animalZoneGrid,
    animalDensityByZone,
    fishPopulationsGenerated,
    fishDensityByTile,
    fishEquilibriumByTile,
    fishWaterBodyByTile,
    fishWaterBodies,
    weatherTemperatureVarianceF,
    weatherWindAngleRadians,
    weatherWindStrength,
    dailyTemperatureF,
    dailyTemperatureBand,
    dailyWindVector,
    consecutiveFreezingDays,
    runSquirrelCacheNutPool,
    beehivesGenerated,
    squirrelCachesGenerated,
    dayTick,
    actors,
    worldItemsByTile,
    camp,
    pendingActionQueue,
    currentDayActionLog,
  };
}

function isValidGameStateShape(candidate) {
  return Boolean(
    candidate
    && Number.isInteger(candidate.width)
    && Number.isInteger(candidate.height)
    && Array.isArray(candidate.tiles)
    && typeof candidate.plants === 'object'
    && typeof candidate.dayOfYear === 'number'
    && typeof candidate.year === 'number',
  );
}

function validateStateCompatibility(candidate, maxPlantsPerTile) {
  if (!Number.isFinite(candidate.nextPlantNumericId)) {
    throw new Error('Incompatible snapshot: missing nextPlantNumericId');
  }

  for (const tile of candidate.tiles) {
    if (!Array.isArray(tile.plantIds)) {
      throw new Error('Incompatible snapshot: tile.plantIds must be an array');
    }
    if (tile.plantIds.length > maxPlantsPerTile) {
      throw new Error('Incompatible snapshot: tile contains multiple plants, expected max 1');
    }

    for (const plantId of tile.plantIds) {
      const plant = candidate.plants[plantId];
      if (!plant) {
        throw new Error(`Incompatible snapshot: tile references missing plant ${plantId}`);
      }
      if (plant.x !== tile.x || plant.y !== tile.y) {
        throw new Error(`Incompatible snapshot: plant ${plantId} position does not match tile linkage`);
      }
    }
  }

  for (const [plantId, plant] of Object.entries(candidate.plants)) {
    if (!Number.isInteger(plant.x) || !Number.isInteger(plant.y)) {
      throw new Error(`Incompatible snapshot: plant ${plantId} has invalid coordinates`);
    }
    if (!inBounds(plant.x, plant.y, candidate.width, candidate.height)) {
      throw new Error(`Incompatible snapshot: plant ${plantId} is out of bounds`);
    }

    const tile = candidate.tiles[tileIndex(plant.x, plant.y, candidate.width)];
    if (!tile.plantIds.includes(plantId)) {
      throw new Error(`Incompatible snapshot: plant ${plantId} missing from host tile`);
    }
  }
}

export function serializeGameState(state) {
  const candidate = state && state.state ? state.state : state;
  const normalizedState = normalizeStateForSave(candidate);

  if (state && state.state) {
    return JSON.stringify({
      ...state,
      state: normalizedState,
    }, null, 2);
  }

  return JSON.stringify(normalizedState, null, 2);
}

export function deserializeGameState(input, options = {}) {
  const maxPlantsPerTile = Number.isInteger(options.maxPlantsPerTile) ? options.maxPlantsPerTile : 1;
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  const candidate = normalizeStateForLoad(parsed && parsed.state ? parsed.state : parsed);

  if (!isValidGameStateShape(candidate)) {
    throw new Error('Invalid game state snapshot');
  }

  validateStateCompatibility(candidate, maxPlantsPerTile);

  return candidate;
}
