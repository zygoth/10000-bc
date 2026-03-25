import { PLANT_BY_ID, PLANT_CATALOG, getSeason, isDayInWindow } from './plantCatalog.mjs';
import { resolveEffectiveReachTier } from './harvestReachTier.mjs';
import { scaledUnitsPerHarvestActionMidpoint } from './harvestYieldResolve.mjs';
import { findPartAndSubStage, ensureHarvestEntryState } from './harvestEntryState.mjs';
import { GROUND_FUNGUS_CATALOG, GROUND_FUNGUS_BY_ID, isDayInSeasonWindow } from './groundFungusCatalog.mjs';
import { LOG_FUNGUS_CATALOG, LOG_FUNGUS_BY_ID, isDayInLogWindow } from './logFungusCatalog.mjs';
import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { ITEM_BY_ID } from './itemCatalog.mjs';
import { applyEnvironmentalVitality, recalculateDynamicShade } from './advanceDay/ecology.mjs';
import { clonePlant, cloneTile, createEmptyRecentDispersal } from './simState.mjs';
import {
  cloneActors,
  defaultActors,
  getActionTickCost as getActionTickCostDefinition,
  getAllActions as getAllAvailableActions,
  previewAction as previewActionDefinition,
  sortActionsDeterministically,
  validateAction as validateActionDefinition,
} from './simActions.mjs';
import {
  deserializeGameState as deserializeSnapshotState,
  serializeGameState as serializeSnapshotState,
} from './simSnapshot.mjs';
import {
  calculateSoilSuitability,
  computeSoilMatch,
  generateMap,
  inBounds,
  isRockTile,
  isPlantWithinEnvironmentalTolerance,
  mulberry32,
  tileIndex,
} from './simWorld.mjs';
import {
  applyDailyWaterFreezeState,
  ensureDailyWeatherState,
  initializeDailyWeatherState,
  rollDailyWeatherForCurrentDay,
  windStrengthLabel,
} from './advanceDay/weather.mjs';
import {
  animalTileDensityKey,
  canGenerateAnimalZonesInternal,
  getAnimalDensityAtTile,
} from './simAnimalZones.mjs';
import {
  generateAnimalZonesInternal,
} from './simAnimalZoneGeneration.mjs';
import {
  buildSquirrelDensityByTile,
  computeSquirrelCacheTargetCount,
} from './advanceDay/squirrelDensity.mjs';
import {
  canGenerateSquirrelCachesInternal,
  clearSquirrelCaches,
  resolveSquirrelCacheItemPool,
  selectSquirrelCacheCandidatesWithSpread,
} from './advanceDay/squirrelCaches.mjs';
import {
  applyFishPopulationRecovery,
  canGenerateFishPopulationsInternal,
  generateFishPopulationsInternal,
  getFishDensityAtTile,
} from './advanceDay/fishPopulation.mjs';
import {
  createInProgressActionEnvelope,
  isInProgressActionEnvelope,
  normalizeInProgressTicks,
} from './advanceTick/tickEnvelope.mjs';
import {
  AUTO_ROD_ATTRACTION_MULTIPLIER,
  AUTO_ROD_OVERNIGHT_ATTEMPTS,
  BEEHIVE_BEESWAX_RANGE_GRAMS,
  BEEHIVE_HONEY_RANGE_GRAMS,
  BEEHIVE_LARVAE_RANGE_GRAMS,
  BEEHIVE_SPECIES_ID,
  CAMP_COMFORT_STATION_IDS,
  COLD_EXPOSURE_HEALTH_DRAIN_PER_TICK,
  DEADFALL_DAILY_RELIABILITY_DECAY,
  DEADFALL_MAX_CATCH_WEIGHT_G,
  DEADFALL_MIN_RELIABILITY,
  DEADFALL_TRAP_CATCH_MODIFIER,
  DEAD_LOG_DECAY_FERTILITY_BONUS_ADJACENT,
  DEAD_LOG_DECAY_FERTILITY_BONUS_CENTER,
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  EARTHWORM_DECAY_DAYS,
  EARTHWORM_ITEM_ID,
  EQUIPPABLE_ITEM_TO_SLOT,
  FISH_TRAP_ATTEMPTS_PER_DAY,
  FISH_TRAP_DAILY_RELIABILITY_DECAY,
  FISH_TRAP_MAX_STORED_CATCH,
  FISH_TRAP_MIN_RELIABILITY,
  HARVEST_TOOL_INVENTORY_ALIASES,
  ITEM_FOOTPRINT_OVERRIDES,
  LINE_SNAP_BASE_PROBABILITY,
  LINE_SNAP_BASE_WEIGHT_G,
  LEACHING_BASKET_TANNIN_REDUCTION_POND_PER_DAY,
  LEACHING_BASKET_TANNIN_REDUCTION_RIVER_PER_DAY,
  MAX_LOG_FUNGI_PER_LOG,
  MAX_PLANTS_PER_TILE,
  MIN_DAYS_FOR_BEEHIVE_GENERATION,
  MIN_DAYS_FOR_GROUND_FUNGUS_ZONE_GENERATION,
  PERENNIAL_WINTER_DAILY_DEATH_RATE,
  RAISED_SLEEPING_PLATFORM_STATION_ID,
  ROTTING_ORGANIC_DECAY_DAYS,
  ROTTING_ORGANIC_FERTILITY_BONUS,
  ROTTING_ORGANIC_ITEM_ID,
  SAP_FILLED_VESSEL_ITEM_ID,
  SAP_TAP_DAILY_FILL_UNITS,
  SAP_TAP_VESSEL_CAPACITY_UNITS,
  SIMPLE_SNARE_BASE_CATCH_CHANCE,
  SIMPLE_SNARE_DAILY_RELIABILITY_DECAY,
  SIMPLE_SNARE_MIN_RELIABILITY,
  SIMPLE_SNARE_POACH_DAY_1_CHANCE,
  SIMPLE_SNARE_POACH_DAY_2_CHANCE,
  SIMPLE_SNARE_POACH_DAY_3_CHANCE,
  SIMPLE_SNARE_POACH_DAY_4_PLUS_CHANCE,
  SIMPLE_SNARE_RABBIT_DENSITY_WEIGHT,
  SUN_HAT_THIRST_MODIFIER_SCALE,
  TICKS_PER_DAY,
  THIRST_ACTIVITY_DRAIN_PER_TICK,
  THIRST_TEMPERATURE_MODIFIER_BY_BAND,
  WATERSKIN_DRINK_THIRST_GAIN,
  WATERSKIN_EMPTY_ITEM_ID,
  WATERSKIN_GUT_ILLNESS_CHANCE_POND,
  WATERSKIN_GUT_ILLNESS_CHANCE_RIVER,
  WINDBREAK_REFLECTOR_WALL_STATION_ID,
} from './simCore.constants.mjs';
import {
  cloneAnimalDensityByZone,
  cloneCampState,
  cloneFishDensityByTile,
  cloneStringArray,
  cloneWorldItemsByTile,
} from './simCore.shared.mjs';
import { advanceDayImpl } from './advanceDay/index.mjs';
import { advanceTickImpl } from './advanceTick/index.mjs';
import { applyActionEffectImpl } from './advanceTick/actionEffects.mjs';
import {
  addActorInventoryItemImpl,
  ensureActorInventoryImpl,
  extractActorInventoryItemWithMetadataImpl,
  normalizeStackFootprintValueImpl,
  removeActorInventoryItemImpl,
} from './advanceTick/inventory.mjs';
import {
  addActorInventoryItemWithOverflowDropImpl,
  addWorldItemNearbyImpl,
  removeWorldItemAtTileImpl,
} from './advanceTick/worldItems.mjs';
import {
  addCampDryingRackItemImpl,
  addCampStockpileItemImpl,
  removeCampStockpileItemImpl,
} from './advanceTick/campSystems.mjs';
import {
  cleanupDeadPlantsImpl,
  processDormantSeedsImpl,
  reconcilePlantOccupancyImpl,
  updatePlantLifeImpl,
} from './advanceDay/plantLifecycle.mjs';
import { applyHarvestActionImpl } from './advanceDay/plantHarvest.mjs';
import {
  applyGroundFungusFruitingImpl,
  assignGroundFungusZoneToTileImpl,
  generateGroundFungusZonesInternalImpl,
  rollGroundFungusYieldImpl,
} from './advanceDay/groundFungus.mjs';
import {
  applyLogFungusFruitingImpl,
  colonizeDeadLogFungiByYearImpl,
  ensureDeadLogFungusShapeImpl,
  logFungusHostCompatibleImpl,
  rollLogFungusYieldImpl,
} from './advanceDay/logFungus.mjs';
import {
  applyDailyDeadfallTrapResolutionImpl,
  applyDailyFishTrapResolutionImpl,
  applyDailySimpleSnareResolutionImpl,
  rollDeadfallCatchImpl,
  rollFishTrapCatchImpl,
  rollSimpleSnareCatchImpl,
} from './advanceDay/traps.mjs';
import {
  applyBeehiveSeasonalStateImpl,
  generateBeehivesInternalImpl,
  rollBeehiveYieldForDayImpl,
} from './advanceDay/beehiveSystems.mjs';
export { getAnimalDensityAtTile, getFishDensityAtTile };
const DEADFALL_CANDIDATE_SPECIES_IDS = Object.values(ANIMAL_BY_ID || {})
  .filter((species) => {
    const waterRequired = species?.waterRequired === true || species?.water_required === true;
    const animalClass = typeof species?.animalClass === 'string' ? species.animalClass : species?.animal_class;
    if (!species || waterRequired || animalClass === 'fish') {
      return false;
    }
    const weightRange = Array.isArray(species?.weightRangeGrams)
      ? species.weightRangeGrams
      : Array.isArray(species?.weight_range_g) ? species.weight_range_g : [];
    const minWeight = Number(weightRange[0]);
    return Number.isFinite(minWeight) && minWeight <= DEADFALL_MAX_CATCH_WEIGHT_G;
  })
  .map((species) => species.id)
  .filter((speciesId) => typeof speciesId === 'string' && speciesId)
  .sort();
const FISH_TRAP_CANDIDATE_SPECIES_IDS = Object.values(ANIMAL_BY_ID || {})
  .filter((species) => {
    const animalClass = typeof species?.animalClass === 'string' ? species.animalClass : species?.animal_class;
    const waterRequired = species?.waterRequired === true || species?.water_required === true;
    return animalClass === 'fish' && waterRequired;
  })
  .map((species) => species.id)
  .filter((speciesId) => typeof speciesId === 'string' && speciesId)
  .sort();
export const NATURE_SIGHT_OVERLAY_OPTIONS = Object.freeze([
  'calorie_heatmap',
  'animal_density',
  'mushroom_zones',
  'plant_compatibility',
  'fishing_hotspots',
]);
const NATURE_SIGHT_OVERLAY_OPTION_SET = new Set(NATURE_SIGHT_OVERLAY_OPTIONS);
const FUNGUS_CALORIES_PER_GRAM_ESTIMATE = 0.25;
const HONEY_CALORIES_PER_GRAM_ESTIMATE = 3.0;
const LARVAE_CALORIES_PER_GRAM_ESTIMATE = 2.0;
const NUT_CALORIES_PER_GRAM_ESTIMATE = 6.0;
function hasActorInventoryItem(actor, itemId, quantity = 1) {
  const normalizedQty = Math.max(1, Math.floor(Number(quantity) || 1));
  const stacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : [];
  return stacks.some((stack) => (
    stack?.itemId === itemId
    && Math.floor(Number(stack?.quantity) || 0) >= normalizedQty
  ));
}

function ensureInventoryEquipment(inventory) {
  if (!inventory || typeof inventory !== 'object') {
    return { gloves: null, coat: null, head: null };
  }

  if (!inventory.equipment || typeof inventory.equipment !== 'object') {
    inventory.equipment = { gloves: null, coat: null, head: null };
  }

  if (!Object.prototype.hasOwnProperty.call(inventory.equipment, 'gloves')) {
    inventory.equipment.gloves = null;
  }
  if (!Object.prototype.hasOwnProperty.call(inventory.equipment, 'coat')) {
    inventory.equipment.coat = null;
  }
  if (!Object.prototype.hasOwnProperty.call(inventory.equipment, 'head')) {
    inventory.equipment.head = null;
  }

  return inventory.equipment;
}

function hasEquippedItem(actor, itemId) {
  const slot = EQUIPPABLE_ITEM_TO_SLOT[itemId] || null;
  if (!slot) {
    return false;
  }

  const equipment = ensureInventoryEquipment(actor?.inventory || {});
  return equipment?.[slot]?.itemId === itemId;
}

function isActorAtCampAnchor(state, actor) {
  if (!state || !actor) {
    return false;
  }
  const campX = Number(state?.camp?.anchorX);
  const campY = Number(state?.camp?.anchorY);
  if (!Number.isInteger(campX) || !Number.isInteger(campY)) {
    return false;
  }
  return Number(actor.x) === campX && Number(actor.y) === campY;
}

function applyColdExposureTick(state) {
  const player = state?.actors?.player;
  if (!player || (Number(player.health) || 0) <= 0) {
    return;
  }

  if (isActorAtCampAnchor(state, player)) {
    return;
  }

  const band = typeof state?.dailyTemperatureBand === 'string'
    ? state.dailyTemperatureBand.toLowerCase()
    : 'mild';
  if (band !== 'cold' && band !== 'freezing') {
    return;
  }

  if (hasEquippedItem(player, 'tool:coat')) {
    return;
  }

  player.health = clamp01((Number(player.health) || 0) - COLD_EXPOSURE_HEALTH_DRAIN_PER_TICK);
}

function applyTemperatureThirstTick(state) {
  const player = state?.actors?.player;
  if (!player || (Number(player.health) || 0) <= 0) {
    return;
  }

  if (isActorAtCampAnchor(state, player)) {
    return;
  }

  const band = typeof state?.dailyTemperatureBand === 'string'
    ? state.dailyTemperatureBand.toLowerCase()
    : 'mild';
  const bandModifier = Number(THIRST_TEMPERATURE_MODIFIER_BY_BAND?.[band] || 0);
  const hasSunHat = hasEquippedItem(player, 'tool:sun_hat');
  const scaledModifier = (hasSunHat && (band === 'warm' || band === 'hot'))
    ? bandModifier * SUN_HAT_THIRST_MODIFIER_SCALE
    : bandModifier;
  const effectiveMultiplier = Math.max(0, 1 + scaledModifier);
  const drainPerTick = THIRST_ACTIVITY_DRAIN_PER_TICK * effectiveMultiplier;

  player.thirst = clamp01((Number(player.thirst) || 0) - drainPerTick);
}

function hasHarvestInjuryTool(actor, toolKey) {
  if (typeof toolKey !== 'string' || !toolKey) {
    return false;
  }

  const aliases = Array.isArray(HARVEST_TOOL_INVENTORY_ALIASES[toolKey])
    ? HARVEST_TOOL_INVENTORY_ALIASES[toolKey]
    : [];
  const candidateItemIds = [`tool:${toolKey}`, ...aliases];
  return candidateItemIds.some((itemId) => {
    if (EQUIPPABLE_ITEM_TO_SLOT[itemId]) {
      return hasEquippedItem(actor, itemId);
    }
    return hasActorInventoryItem(actor, itemId, 1);
  });
}

function resolveItemFootprint(itemId) {
  const override = ITEM_FOOTPRINT_OVERRIDES[itemId] || null;
  if (override) {
    return { footprintW: override.w, footprintH: override.h };
  }

  const item = ITEM_BY_ID[itemId] || null;
  const footprintW = Number.isInteger(item?.footprintW) && item.footprintW > 0 ? item.footprintW : 1;
  const footprintH = Number.isInteger(item?.footprintH) && item.footprintH > 0 ? item.footprintH : 1;
  return { footprintW, footprintH };
}

function resolvePlantSubStage(speciesId, partName, subStageId) {
  const species = PLANT_BY_ID[speciesId] || null;
  const part = (species?.parts || []).find((entry) => entry?.name === partName) || null;
  return (part?.subStages || []).find((entry) => entry?.id === subStageId) || null;
}

function createHarvestInjuryRng(state, actor, action) {
  const actorHash = String(actor?.id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const actionHash = String(action?.actionId || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const seed = (
    ((Number(state?.seed) || 0) * 173)
    + ((Number(state?.totalDaysSimulated) || 0) * 41)
    + ((Number(state?.dayTick) || 0) * 19)
    + actorHash
    + actionHash
  ) >>> 0;
  return mulberry32(seed);
}

function applyHarvestInjuryFromSubStage(state, actor, action, speciesId, partName, subStageId, appliedActions) {
  const count = Math.max(0, Math.floor(Number(appliedActions) || 0));
  if (count <= 0) {
    return;
  }

  const subStage = resolvePlantSubStage(speciesId, partName, subStageId);
  const injury = subStage?.on_harvest_injury;
  if (!injury || typeof injury !== 'object') {
    return;
  }

  const baseProbability = Math.max(0, Math.min(1, Number(injury.base_probability) || 0));
  if (baseProbability <= 0) {
    return;
  }

  const toolModifiers = injury?.tool_probability_modifiers && typeof injury.tool_probability_modifiers === 'object'
    ? injury.tool_probability_modifiers
    : {};
  let multiplier = 1;
  for (const [toolKey, modifierRaw] of Object.entries(toolModifiers)) {
    const modifier = Number(modifierRaw);
    if (!Number.isFinite(modifier) || modifier < 0) {
      continue;
    }
    if (hasHarvestInjuryTool(actor, toolKey)) {
      multiplier = Math.min(multiplier, modifier);
    }
  }

  const effectiveProbability = Math.max(0, Math.min(1, baseProbability * multiplier));
  if (effectiveProbability <= 0) {
    actor.lastHarvestInjury = {
      applied: false,
      type: injury.type || null,
      baseProbability,
      effectiveProbability,
      appliedActions: count,
      triggerCount: 0,
    };
    return;
  }

  const healthHit = Number(injury.health_hit);
  const healthDelta = Number.isFinite(healthHit) && healthHit > 0 ? healthHit : 0;
  const rng = createHarvestInjuryRng(state, actor, action);
  let triggerCount = 0;
  for (let idx = 0; idx < count; idx += 1) {
    const roll = rng();
    if (roll <= effectiveProbability) {
      triggerCount += 1;
      if (healthDelta > 0) {
        actor.health = clamp01((Number(actor.health) || 0) - healthDelta);
      }
    }
  }

  actor.lastHarvestInjury = {
    applied: triggerCount > 0,
    type: injury.type || null,
    baseProbability,
    effectiveProbability,
    appliedActions: count,
    triggerCount,
    healthHit: healthDelta,
  };
}

function collectFishableWaterTargetsAround(state, centerX, centerY) {
  const x0 = Number(centerX);
  const y0 = Number(centerY);
  if (!Number.isInteger(x0) || !Number.isInteger(y0)) {
    return [];
  }

  const targets = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const x = x0 + dx;
      const y = y0 + dy;
      if (!inBounds(x, y, state.width, state.height)) {
        continue;
      }

      const tile = state.tiles[tileIndex(x, y, state.width)];
      if (!tile || !tile.waterType || tile.waterFrozen === true) {
        continue;
      }

      targets.push({ x, y });
    }
  }

  return targets;
}

function collectFishRodWaterTargets(state, actor) {
  return collectFishableWaterTargetsAround(state, Number(actor?.x), Number(actor?.y));
}

function parseWaterskinStateItemId(itemId) {
  if (itemId === WATERSKIN_EMPTY_ITEM_ID) {
    return { sourceType: null, drinks: 0 };
  }
  if (typeof itemId !== 'string') {
    return null;
  }
  const match = /^tool:waterskin_(safe|river|pond)_([1-3])$/.exec(itemId);
  if (!match) {
    return null;
  }
  return {
    sourceType: match[1],
    drinks: Number(match[2]),
  };
}

function ensureActorConditionsList(actor) {
  if (!Array.isArray(actor?.conditions)) {
    actor.conditions = [];
  }
  return actor.conditions;
}

function createWaterskinOutcomeRng(state, actor, action, salt = 0) {
  const actorHash = String(actor?.id || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const actionHash = String(action?.actionId || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const seed = (
    ((Number(state?.seed) || 0) * 131)
    + ((Number(state?.totalDaysSimulated) || 0) * 37)
    + ((Number(state?.dayTick) || 0) * 17)
    + actorHash
    + actionHash
    + salt
  ) >>> 0;
  return mulberry32(seed);
}

function maybeApplyGutIllnessFromWaterskin(state, actor, action, sourceType) {
  let chance = 0;
  if (sourceType === 'river') {
    chance = WATERSKIN_GUT_ILLNESS_CHANCE_RIVER;
  } else if (sourceType === 'pond') {
    chance = WATERSKIN_GUT_ILLNESS_CHANCE_POND;
  }
  if (chance <= 0) {
    return null;
  }

  const rng = createWaterskinOutcomeRng(state, actor, action, sourceType === 'pond' ? 907 : 401);
  const roll = rng();
  if (roll > chance) {
    return {
      applied: false,
      chance,
      roll,
    };
  }

  const durationDaysRemaining = 2 + Math.floor(rng() * 3);
  const conditions = ensureActorConditionsList(actor);
  const sequence = conditions.filter((entry) => entry?.condition_id === 'gut_illness').length + 1;
  const dayContracted = Number(state?.totalDaysSimulated) || 0;
  conditions.push({
    condition_id: 'gut_illness',
    instance_id: `gut_illness_${dayContracted}_${sequence}`,
    day_contracted: dayContracted,
    duration_days_remaining: durationDaysRemaining,
    treated: false,
    effects: [
      { type: 'nausea_ceiling_cap', value: 0.5 },
    ],
    treatable_by: ['tannin_tea'],
    source_type: sourceType,
  });

  return {
    applied: true,
    chance,
    roll,
    durationDaysRemaining,
  };
}

function resolveSpeciesSeasonModifier(species, dayOfYear) {
  const season = getSeason(dayOfYear);
  const value = Number(species?.population?.seasonModifiers?.[season]);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function buildFishRodCandidateEntries(state, targets, options = {}) {
  const entries = [];
  const baited = options?.baited === true;
  const attractionMultiplierRaw = Number(options?.attractionMultiplier);
  const attractionMultiplier = Number.isFinite(attractionMultiplierRaw)
    ? Math.max(0, attractionMultiplierRaw)
    : 1;
  const baitMultiplier = baited ? 1.5 : 1;
  const baitHookBonus = baited ? 0.15 : 0;
  for (const target of targets) {
    const x = Number(target?.x);
    const y = Number(target?.y);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !inBounds(x, y, state.width, state.height)) {
      continue;
    }

    const tile = state.tiles[tileIndex(x, y, state.width)];
    if (!tile || !tile.waterType || tile.waterFrozen === true) {
      continue;
    }

    const currentStrength = clamp01(Number(tile.waterCurrentStrength) || 0);
    for (const speciesId of FISH_TRAP_CANDIDATE_SPECIES_IDS) {
      const species = ANIMAL_BY_ID[speciesId];
      if (!species || species.rodCompatible !== true) {
        continue;
      }

      const density = clamp01(getFishDensityAtTile(state, speciesId, x, y));
      if (density <= 0) {
        continue;
      }

      const baseCatchRate = clamp01(Number(species?.baseCatchRate) || 0);
      if (baseCatchRate <= 0) {
        continue;
      }

      const seasonModifier = resolveSpeciesSeasonModifier(species, state.dayOfYear);
      const currentSensitivity = clamp01(Number(species?.currentSensitivity) || 0);
      const currentAttractionPenalty = Math.max(0, 1 - (currentSensitivity * currentStrength));
      const biteAttraction = Math.max(
        0,
        baseCatchRate * density * seasonModifier * baitMultiplier * attractionMultiplier * currentAttractionPenalty,
      );
      if (biteAttraction <= 0) {
        continue;
      }

      const currentHookPenalty = currentStrength;
      const hookRate = clamp01((0.65 + baitHookBonus) * Math.max(0, 1 - (currentSensitivity * currentHookPenalty)));
      entries.push({
        speciesId,
        x,
        y,
        biteAttraction,
        hookRate,
        density,
      });
    }
  }

  return entries;
}

function applyFishDensityCatchDelta(state, speciesId, x, y) {
  if (!state.fishDensityByTile[speciesId]) {
    state.fishDensityByTile[speciesId] = {};
  }
  const tileKey = `${x},${y}`;
  const speciesDensityByTile = state.fishDensityByTile[speciesId];
  const currentDensity = clamp01(Number(speciesDensityByTile[tileKey]) || 0);
  const densityPerCatch = Number(ANIMAL_BY_ID[speciesId]?.population?.densityPerCatch);
  speciesDensityByTile[tileKey] = Number.isFinite(densityPerCatch)
    ? clamp01(currentDensity + densityPerCatch)
    : currentDensity;
}

function resolveFishWeightGrams(species, rng) {
  const range = Array.isArray(species?.weightRangeGrams) ? species.weightRangeGrams : null;
  const minRaw = Number(range?.[0]);
  const maxRaw = Number(range?.[1]);
  const minWeight = Number.isFinite(minRaw) ? Math.max(1, minRaw) : 100;
  const maxWeight = Number.isFinite(maxRaw) ? Math.max(minWeight, maxRaw) : minWeight;
  const roll = typeof rng === 'function' ? rng() : 0.5;
  return Math.max(minWeight, Math.round(minWeight + ((maxWeight - minWeight) * roll)));
}

function resolveLineSnapOutcome(species, rng) {
  const fishWeightGrams = resolveFishWeightGrams(species, rng);
  const snapProbability = clamp01(LINE_SNAP_BASE_PROBABILITY * (fishWeightGrams / LINE_SNAP_BASE_WEIGHT_G));
  const snapRoll = typeof rng === 'function' ? rng() : 1;
  return {
    fishWeightGrams,
    snapProbability,
    snapRoll,
    snapped: snapRoll <= snapProbability,
  };
}

function removeWorldItemAtTile(state, x, y, itemId, quantity) {
  return removeWorldItemAtTileImpl(state, x, y, itemId, quantity, {
    inBounds,
    findPreferredStackByItem,
    clamp01,
    normalizeStackFootprintValue,
  });
}

function resolveFishRodTickOutcome(state, action, actor, tickOrdinal) {
  const payloadTargets = Array.isArray(action?.payload?.fishableTargets) ? action.payload.fishableTargets : [];
  const targets = payloadTargets.length > 0 ? payloadTargets : collectFishRodWaterTargets(state, actor);
  const baitItemId = typeof action?.payload?.baitItemId === 'string' ? action.payload.baitItemId : null;
  const baited = baitItemId === EARTHWORM_ITEM_ID && hasActorInventoryItem(actor, EARTHWORM_ITEM_ID, 1);
  const candidates = buildFishRodCandidateEntries(state, targets, {
    baited,
    attractionMultiplier: 1,
  });
  if (candidates.length <= 0) {
    return { biteResolved: false };
  }

  const totalAttraction = candidates.reduce((sum, entry) => sum + entry.biteAttraction, 0);
  const biteChance = clamp01(totalAttraction);
  if (biteChance <= 0) {
    return { biteResolved: false };
  }

  const seed = (
    ((state.seed + 173) * 3251)
    + ((Number(state.totalDaysSimulated) || 0) * 911)
    + ((Number(state.year) || 1) * 197)
    + ((Number(state.dayOfYear) || 1) * 73)
    + ((Number(state.dayTick) || 0) * 389)
    + ((Number(action?.issuedAtTick) || 0) * 97)
    + ((Number(actor?.x) || 0) * 257)
    + ((Number(actor?.y) || 0) * 263)
    + (tickOrdinal * 479)
  ) >>> 0;
  const rng = mulberry32(seed);
  const biteRoll = rng();
  if (biteRoll > biteChance) {
    return { biteResolved: false, biteChance, biteRoll };
  }

  if (baited) {
    removeActorInventoryItem(actor, EARTHWORM_ITEM_ID, 1);
  }

  let selected = candidates[0];
  if (totalAttraction > 0) {
    let pick = rng() * totalAttraction;
    for (const entry of candidates) {
      pick -= entry.biteAttraction;
      if (pick <= 0) {
        selected = entry;
        break;
      }
    }
  }

  const hookRoll = rng();
  const catchSuccess = hookRoll <= selected.hookRate;
  let lineSnap = null;
  let lineSnapped = false;
  if (catchSuccess) {
    const species = ANIMAL_BY_ID[selected.speciesId] || null;
    lineSnap = resolveLineSnapOutcome(species, rng);
    lineSnapped = lineSnap.snapped;
    const fishMeatPart = (ANIMAL_BY_ID[selected.speciesId]?.parts || []).find((entry) => entry?.id === 'meat') || null;
    const decayDays = Number.isFinite(Number(fishMeatPart?.decay_days))
      ? Math.max(0, Math.floor(Number(fishMeatPart.decay_days)))
      : 2;
    addActorInventoryItemWithOverflowDrop(state, actor, `${selected.speciesId}:fish_carcass`, 1, {
      freshness: 1,
      decayDaysRemaining: decayDays,
    });
    applyFishDensityCatchDelta(state, selected.speciesId, selected.x, selected.y);

    if (lineSnapped) {
      removeActorInventoryItem(actor, 'tool:bone_hook', 1);
      removeActorInventoryItem(actor, 'cordage', 1);
    }
  }

  actor.lastFishing = {
    x: selected.x,
    y: selected.y,
    day: Number(state.totalDaysSimulated) || 0,
    dayTick: Number(state.dayTick) || 0,
    baited,
    baitItemId: baited ? EARTHWORM_ITEM_ID : null,
    biteChance: Number(biteChance.toFixed(4)),
    biteRoll: Number(biteRoll.toFixed(4)),
    hookRate: Number(selected.hookRate.toFixed(4)),
    hookRoll: Number(hookRoll.toFixed(4)),
    catchSuccess,
    lineSnapped,
    fishWeightGrams: lineSnap ? lineSnap.fishWeightGrams : null,
    snapProbability: lineSnap ? Number(lineSnap.snapProbability.toFixed(4)) : null,
    snapRoll: lineSnap ? Number(lineSnap.snapRoll.toFixed(4)) : null,
    speciesId: selected.speciesId,
  };

  return {
    biteResolved: true,
    catchSuccess,
    lineSnapped,
  };
}

function resolveAutoRodTickOutcome(state, tile, tickOrdinal, phaseSalt = 0) {
  const rod = tile?.autoRod;
  if (!rod || rod.active !== true || rod.state !== 'live') {
    return { biteResolved: false };
  }

  const targets = collectFishableWaterTargetsAround(state, tile.x, tile.y);
  const baited = rod.baitItemId === EARTHWORM_ITEM_ID;
  const candidates = buildFishRodCandidateEntries(state, targets, {
    baited,
    attractionMultiplier: AUTO_ROD_ATTRACTION_MULTIPLIER,
  });
  if (candidates.length <= 0) {
    return { biteResolved: false };
  }

  const totalAttraction = candidates.reduce((sum, entry) => sum + entry.biteAttraction, 0);
  const biteChance = clamp01(totalAttraction);
  if (biteChance <= 0) {
    return { biteResolved: false };
  }

  const seed = (
    ((state.seed + 401) * 4093)
    + ((Number(state.totalDaysSimulated) || 0) * 977)
    + ((Number(state.year) || 1) * 257)
    + ((Number(state.dayOfYear) || 1) * 89)
    + ((Number(state.dayTick) || 0) * 311)
    + ((Number(tile?.x) || 0) * 173)
    + ((Number(tile?.y) || 0) * 197)
    + (tickOrdinal * 487)
    + (phaseSalt * 991)
  ) >>> 0;
  const rng = mulberry32(seed);
  const biteRoll = rng();
  if (biteRoll > biteChance) {
    return { biteResolved: false, biteChance, biteRoll };
  }

  if (baited) {
    rod.baitItemId = null;
  }

  let selected = candidates[0];
  if (totalAttraction > 0) {
    let pick = rng() * totalAttraction;
    for (const entry of candidates) {
      pick -= entry.biteAttraction;
      if (pick <= 0) {
        selected = entry;
        break;
      }
    }
  }

  const hookRoll = rng();
  const catchSuccess = hookRoll <= selected.hookRate;
  let lineSnap = null;
  let lineSnapped = false;
  if (catchSuccess) {
    lineSnap = resolveLineSnapOutcome(ANIMAL_BY_ID[selected.speciesId], rng);
    lineSnapped = lineSnap.snapped;
    applyFishDensityCatchDelta(state, selected.speciesId, selected.x, selected.y);
    if (!Array.isArray(rod.pendingSpeciesIds)) {
      rod.pendingSpeciesIds = [];
    }
    rod.pendingSpeciesIds.push(selected.speciesId);
  }

  rod.state = catchSuccess
    ? (lineSnapped ? 'broken' : 'triggered_catch')
    : 'triggered_escape';
  rod.lastResolvedYear = Number(state.year) || 1;
  rod.lastResolvedDay = Number(state.dayOfYear) || 1;
  rod.lastResolvedDayTick = Number(state.dayTick) || 0;
  rod.lastSpeciesId = selected.speciesId;
  rod.lastCatchSuccess = catchSuccess;
  rod.lastLineSnapped = lineSnapped;
  rod.lastBiteChance = Number(biteChance.toFixed(4));
  rod.lastBiteRoll = Number(biteRoll.toFixed(4));
  rod.lastHookRate = Number(selected.hookRate.toFixed(4));
  rod.lastHookRoll = Number(hookRoll.toFixed(4));
  rod.lastSnapProbability = lineSnap ? Number(lineSnap.snapProbability.toFixed(4)) : null;
  rod.lastSnapRoll = lineSnap ? Number(lineSnap.snapRoll.toFixed(4)) : null;

  return {
    biteResolved: true,
    catchSuccess,
    lineSnapped,
    speciesId: selected.speciesId,
  };
}

function processAutoRodTickResolution(state) {
  let tileOrdinal = 0;
  for (const tile of state.tiles || []) {
    const rod = tile?.autoRod;
    if (!rod || rod.active !== true || rod.state !== 'live') {
      tileOrdinal += 1;
      continue;
    }

    resolveAutoRodTickOutcome(state, tile, tileOrdinal, 0);
    tileOrdinal += 1;
  }
}

function applyDailyAutoRodResolution(state) {
  for (const tile of state.tiles || []) {
    const rod = tile?.autoRod;
    if (!rod || rod.active !== true || rod.state !== 'live') {
      continue;
    }

    for (let attempt = 0; attempt < AUTO_ROD_OVERNIGHT_ATTEMPTS; attempt += 1) {
      const outcome = resolveAutoRodTickOutcome(state, tile, attempt, 1);
      if (outcome?.biteResolved === true) {
        break;
      }
    }
  }
}

function resolveDigEarthwormSpawnChance(tile) {
  const moisture = clamp01(Number(tile?.moisture) || 0);
  return clamp01(0.05 + (0.45 * moisture));
}

function trySpawnEarthwormFromDig(state, actor, tile, targetX, targetY) {
  if (!tile || tile.waterFrozen === true || state?.dailyTemperatureBand === 'freezing') {
    return null;
  }

  const chance = resolveDigEarthwormSpawnChance(tile);
  if (chance <= 0) {
    return null;
  }

  const seed = (
    ((state.seed + 211) * 4019)
    + ((Number(state.totalDaysSimulated) || 0) * 709)
    + ((Number(state.dayTick) || 0) * 293)
    + ((Number(targetX) || 0) * 181)
    + ((Number(targetY) || 0) * 313)
    + ((Number(actor?.x) || 0) * 131)
    + ((Number(actor?.y) || 0) * 173)
  ) >>> 0;
  const roll = mulberry32(seed)();
  if (roll > chance) {
    return null;
  }

  const droppedQuantity = addWorldItemNearby(state, targetX, targetY, EARTHWORM_ITEM_ID, 1, {
    freshness: 1,
    decayDaysRemaining: EARTHWORM_DECAY_DAYS,
  });
  if (droppedQuantity <= 0) {
    return null;
  }

  return {
    chance,
    roll,
    droppedQuantity,
  };
}

// Squirrel cache generation tuning:
// - Coverage constants control total cache count across all eligible tiles.
// - Spread constants soften local clustering after each pick (higher radius/lower factor = wider spread).
// - Nut-tree maturity constants ensure squirrel support is based on productive trees.
const SQUIRREL_CACHE_CONTENT_RANGE_GRAMS = [300, 1200];
const SQUIRREL_CACHE_GROUND_RATIO = 0.8;
// Tiles from a selected cache that receive strong local suppression.
const SQUIRREL_CACHE_SPREAD_RADIUS_NEAR = 3.2;
// Outer ring for lighter suppression to avoid hotspot saturation.
const SQUIRREL_CACHE_SPREAD_RADIUS_MID = 8.8;
// Multiplier applied to nearby candidate scores after a cache is selected.
const SQUIRREL_CACHE_SPREAD_NEAR_FACTOR = 0.88;
// Multiplier applied to mid-distance candidate scores after a cache is selected.
const SQUIRREL_CACHE_SPREAD_MID_FACTOR = 0.96;
// Minimum plant size treated as mature/productive for nut-tree squirrel support.
const SQUIRREL_NUT_TREE_MATURITY_SIZE = 8;
// Nut tree species that are maturity-gated for squirrel population contribution.
const SQUIRREL_NUT_TREE_SPECIES = new Set(['juglans_nigra', 'carya_ovata', 'quercus_alba', 'fagus_grandifolia', 'corylus_americana']);


function stageForDay(plant, age, dayOfYear) {
  let chosen = null;

  for (const stage of plant.lifeStages) {
    if (age < stage.min_age_days) {
      continue;
    }

    if (!isDayInWindow(dayOfYear, stage.seasonalWindow)) {
      continue;
    }
    chosen = stage;
  }

  return chosen;
}

function beehiveSeasonModifier(dayOfYear) {
  const season = getSeason(dayOfYear);
  switch (season) {
    case 'spring':
      return 0.3;
    case 'summer':
      return 1.0;
    case 'fall':
      return 0.5;
    case 'winter':
    default:
      return 0;
  }
}

function rollDeadfallCatch(state, tile, trap) {
  return rollDeadfallCatchImpl(state, tile, trap, {
    clamp01,
    DEADFALL_CANDIDATE_SPECIES_IDS,
    ANIMAL_BY_ID,
    getAnimalDensityAtTile,
    DEADFALL_TRAP_CATCH_MODIFIER,
    mulberry32,
    DEADFALL_MIN_RELIABILITY,
    DEADFALL_DAILY_RELIABILITY_DECAY,
  });
}

function applyDailyDeadfallTrapResolution(state) {
  return applyDailyDeadfallTrapResolutionImpl(state, {
    SIMPLE_SNARE_POACH_DAY_4_PLUS_CHANCE,
    SIMPLE_SNARE_POACH_DAY_1_CHANCE,
    SIMPLE_SNARE_POACH_DAY_2_CHANCE,
    SIMPLE_SNARE_POACH_DAY_3_CHANCE,
    mulberry32,
    rollDeadfallCatch,
  });
}

function rollFishTrapCatch(state, tile, trap, attemptOrdinal) {
  return rollFishTrapCatchImpl(state, tile, trap, attemptOrdinal, {
    clamp01,
    FISH_TRAP_CANDIDATE_SPECIES_IDS,
    ANIMAL_BY_ID,
    getFishDensityAtTile,
    mulberry32,
  });
}

function applyDailyFishTrapResolution(state) {
  return applyDailyFishTrapResolutionImpl(state, {
    FISH_TRAP_MAX_STORED_CATCH,
    FISH_TRAP_ATTEMPTS_PER_DAY,
    rollFishTrapCatch,
    clamp01,
    ANIMAL_BY_ID,
    FISH_TRAP_MIN_RELIABILITY,
    FISH_TRAP_DAILY_RELIABILITY_DECAY,
  });
}

function rollBeehiveYieldForDay(state, tile, range, salt) {
  return rollBeehiveYieldForDayImpl(state, tile, range, salt, {
    mulberry32,
    rangeRollIntRandom,
  });
}

function applyBeehiveSeasonalState(state) {
  return applyBeehiveSeasonalStateImpl(state, {
    beehiveSeasonModifier,
    rollBeehiveYieldForDay,
    BEEHIVE_HONEY_RANGE_GRAMS,
    BEEHIVE_LARVAE_RANGE_GRAMS,
    BEEHIVE_BEESWAX_RANGE_GRAMS,
  });
}

function refillSquirrelCachesByYear(state) {
  if (!state?.squirrelCachesGenerated) {
    return;
  }

  const rng = mulberry32((state.seed + state.year + 1) * 79);
  generateSquirrelCachesInternal(state, rng, { regenerate: true });
}

const RESUMABLE_PLAYER_ACTION_KINDS = new Set([
  'process_item',
  'tool_craft',
  'camp_station_build',
  'dig',
  'fish_rod_cast',
]);

function isResumablePlayerAction(action) {
  if (action?.actorId !== 'player') {
    return false;
  }
  return RESUMABLE_PLAYER_ACTION_KINDS.has(action?.kind);
}

function isTileBlockedForPlantLife(tile) {
  return !tile
    || tile.waterType
    || tile.deadLog
    || isRockTile(tile)
    || tile?.simpleSnare?.active === true
    || tile?.deadfallTrap?.active === true;
}

function rangeRollIntRandom(range, rng, fallback = 1) {
  if (!Array.isArray(range) || range.length < 2) {
    return Math.max(1, fallback);
  }

  const min = Math.floor(Number(range[0]));
  const max = Math.floor(Number(range[1]));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return Math.max(1, fallback);
  }

  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return low + Math.floor(rng() * (high - low + 1));
}

function moistureYieldMultiplier(moisture) {
  if (moisture > 0.9) {
    return 0.6;
  }
  if (moisture >= 0.7) {
    return 1.4;
  }
  if (moisture >= 0.4) {
    return 1.2;
  }
  if (moisture >= 0.15) {
    return 0.5;
  }
  return 0.1;
}

function computeGroundFungusSoilMatch(fungus, tile) {
  if (!fungus || !fungus.soilRequirements || tile.waterType || isRockTile(tile)) {
    return 0;
  }

  const pseudoSpecies = { soil: fungus.soilRequirements };
  return computeSoilMatch(pseudoSpecies, tile);
}

function canGenerateGroundFungusZones(state) {
  if (state?.groundFungusZonesGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_GROUND_FUNGUS_ZONE_GENERATION;
}

function canGenerateBeehivesInternal(state) {
  if (state?.beehivesGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_BEEHIVE_GENERATION;
}

function defaultCampState(width, height) {
  return {
    anchorX: Math.max(0, Math.floor(width / 2)),
    anchorY: Math.max(0, Math.floor(height / 2)),
    stockpile: { stacks: [] },
    stationsUnlocked: [],
    comforts: [],
    partnerTaskQueue: {
      active: null,
      queued: [],
    },
    partnerTaskHistory: [],
    dryingRack: {
      capacity: 4,
      slots: [],
    },
    mealPlan: {
      ingredients: [],
      preview: null,
    },
    nauseaByIngredient: {},
    lastMealResult: null,
    nextDayStewTickBonus: 0,
    debrief: {
      active: false,
      openedAtDay: null,
      medicineRequests: [],
      medicineNotifications: [],
      visionRequest: null,
      visionSelectionOptions: [],
      requiresVisionConfirmation: false,
      visionNotifications: [],
      visionUsesThisSeason: 0,
      visionSeasonKey: null,
      pendingVisionRevelation: null,
      pendingVisionChoices: [],
      chosenVisionRewards: [],
    },
  };
}

function ensureTickSystems(state) {
  const fallbackActors = defaultActors(state.width, state.height);
  state.actors = cloneActors(state?.actors || fallbackActors);
  if (Object.keys(state.actors).length === 0) {
    state.actors = fallbackActors;
  }

  state.worldItemsByTile = cloneWorldItemsByTile(state?.worldItemsByTile);
  state.camp = cloneCampState(state?.camp, Math.floor(state.width / 2), Math.floor(state.height / 2));
  state.dayTick = Number.isInteger(state?.dayTick)
    ? Math.max(0, Math.min(399, state.dayTick))
    : 0;
  state.pendingActionQueue = Array.isArray(state?.pendingActionQueue)
    ? state.pendingActionQueue.map((action) => ({ ...(action || {}) }))
    : [];
  state.currentDayActionLog = Array.isArray(state?.currentDayActionLog)
    ? state.currentDayActionLog.map((entry) => ({ ...(entry || {}) }))
    : [];
}

function consumeActorTickBudget(actor, ticks) {
  if (!actor || !Number.isFinite(ticks) || ticks <= 0) {
    return;
  }

  const current = Number.isFinite(actor.tickBudgetCurrent) ? actor.tickBudgetCurrent : Number(actor.tickBudgetBase) || 0;
  const next = current - ticks;
  actor.tickBudgetCurrent = next;
  actor.overdraftTicks = Math.max(0, Math.ceil(-next));
}

function hasCampStationUnlocked(state, stationId) {
  return Array.isArray(state?.camp?.stationsUnlocked)
    && state.camp.stationsUnlocked.includes(stationId);
}

function getDailyTickBudgetComfortBonus(state) {
  if (hasCampStationUnlocked(state, RAISED_SLEEPING_PLATFORM_STATION_ID)) {
    return 10;
  }
  return 0;
}

function getDailyTickBudgetRoleBonus(state, actor) {
  if (actor?.id !== 'partner') {
    return 0;
  }

  if (hasCampStationUnlocked(state, WINDBREAK_REFLECTOR_WALL_STATION_ID)) {
    return 10;
  }

  return 0;
}

function getActorDayStartTickBudgetBase(state, actor) {
  const intrinsicBase = Number.isFinite(actor?.tickBudgetBase)
    ? Number(actor.tickBudgetBase)
    : 0;
  return Math.max(0, intrinsicBase + getDailyTickBudgetComfortBonus(state) + getDailyTickBudgetRoleBonus(state, actor));
}

function normalizePartnerTask(task) {
  if (!task || typeof task !== 'object') {
    return null;
  }

  const taskId = typeof task.taskId === 'string' && task.taskId
    ? task.taskId
    : 'partner_task';
  const kind = typeof task.kind === 'string' ? task.kind : 'unknown';
  const ticksRequired = Number.isInteger(task.ticksRequired)
    ? task.ticksRequired
    : Math.max(1, Math.floor(Number(task.ticksRequired || 1)));
  const ticksRemaining = Number.isInteger(task.ticksRemaining)
    ? task.ticksRemaining
    : ticksRequired;
  const outputs = Array.isArray(task.outputs)
    ? task.outputs.map((entry) => ({ ...(entry || {}) }))
    : [];
  const inputs = Array.isArray(task.inputs)
    ? task.inputs.map((entry) => ({ ...(entry || {}) }))
    : [];
  const requirements = task.requirements && typeof task.requirements === 'object'
    ? {
      stations: Array.isArray(task.requirements.stations)
        ? task.requirements.stations.filter((entry) => typeof entry === 'string' && entry)
        : [],
      unlocks: Array.isArray(task.requirements.unlocks)
        ? task.requirements.unlocks.filter((entry) => typeof entry === 'string' && entry)
        : [],
    }
    : { stations: [], unlocks: [] };
  const status = typeof task.status === 'string' && task.status
    ? task.status
    : 'queued';
  const failureReason = typeof task.failureReason === 'string' && task.failureReason
    ? task.failureReason
    : null;

  return {
    taskId,
    kind,
    ticksRequired,
    ticksRemaining,
    inputs,
    requirements,
    outputs,
    status,
    failureReason,
    meta: task.meta && typeof task.meta === 'object' ? { ...task.meta } : null,
  };
}

function mirrorPartnerTaskQueueToActor(state) {
  const partner = state?.actors?.partner;
  const queue = state?.camp?.partnerTaskQueue;
  if (!partner || !queue) {
    return;
  }

  partner.taskQueue = {
    active: queue.active ? { ...queue.active } : null,
    queued: Array.isArray(queue.queued) ? queue.queued.map((task) => ({ ...(task || {}) })) : [],
  };
}

function addCampStockpileItem(camp, itemId, quantity, options = null) {
  return addCampStockpileItemImpl(camp, itemId, quantity, options, {
    normalizeStackFootprintValue,
    findCompatibleStackForAutoMerge,
    clamp01,
  });
}

function removeCampStockpileItem(camp, itemId, quantity) {
  return removeCampStockpileItemImpl(camp, itemId, quantity, {
    findPreferredStackByItem,
    clamp01,
    normalizeStackFootprintValue,
  });
}

function completePartnerTaskOutputs(state, task) {
  const outputs = Array.isArray(task?.outputs) ? task.outputs : [];
  for (const output of outputs) {
    const itemId = typeof output?.itemId === 'string' ? output.itemId : '';
    const quantity = Number(output?.quantity);
    addCampStockpileItem(state.camp, itemId, quantity, {
      freshness: Number(output?.freshness),
      decayDaysRemaining: Number(output?.decayDaysRemaining),
    });
  }
}

function appendPartnerTaskHistory(state, entry) {
  if (!state?.camp || typeof state.camp !== 'object') {
    return;
  }
  if (!Array.isArray(state.camp.partnerTaskHistory)) {
    state.camp.partnerTaskHistory = [];
  }
  state.camp.partnerTaskHistory.push({
    ...(entry || {}),
    day: Number(state.totalDaysSimulated) || 0,
    dayTick: Number(state.dayTick) || 0,
  });
  if (state.camp.partnerTaskHistory.length > 100) {
    state.camp.partnerTaskHistory = state.camp.partnerTaskHistory.slice(-100);
  }
}

function getCampStockpileQuantity(camp, itemId) {
  if (!camp || typeof itemId !== 'string' || !itemId) {
    return 0;
  }
  const stacks = Array.isArray(camp?.stockpile?.stacks) ? camp.stockpile.stacks : [];
  let total = 0;
  for (const stack of stacks) {
    if (stack?.itemId !== itemId) {
      continue;
    }
    total += Math.max(0, Math.floor(Number(stack?.quantity) || 0));
  }
  return total;
}

function getPartnerTaskInvalidationReason(state, task) {
  const normalizedTask = task && typeof task === 'object' ? task : null;
  if (!normalizedTask) {
    return 'invalid_task';
  }

  const requirements = normalizedTask.requirements && typeof normalizedTask.requirements === 'object'
    ? normalizedTask.requirements
    : { stations: [], unlocks: [] };
  for (const stationId of Array.isArray(requirements.stations) ? requirements.stations : []) {
    const built = Array.isArray(state?.camp?.stationsUnlocked)
      && state.camp.stationsUnlocked.includes(stationId);
    if (!built) {
      return `missing_station:${stationId}`;
    }
  }
  for (const unlockKey of Array.isArray(requirements.unlocks) ? requirements.unlocks : []) {
    if (state?.techUnlocks?.[unlockKey] === false) {
      return `missing_unlock:${unlockKey}`;
    }
  }

  const inputs = Array.isArray(normalizedTask.inputs) ? normalizedTask.inputs : [];
  for (const input of inputs) {
    if (input?.required === false) {
      continue;
    }
    const source = typeof input?.source === 'string' ? input.source : 'camp_stockpile';
    if (source !== 'camp_stockpile') {
      continue;
    }
    const itemId = typeof input?.itemId === 'string' ? input.itemId : '';
    const quantity = Math.max(1, Math.floor(Number(input?.quantity) || 0));
    if (!itemId || quantity <= 0) {
      continue;
    }
    if (getCampStockpileQuantity(state?.camp, itemId) < quantity) {
      return `missing_input:${itemId}`;
    }
  }

  return null;
}

function consumePartnerTaskInputs(state, task) {
  const inputs = Array.isArray(task?.inputs) ? task.inputs : [];
  for (const input of inputs) {
    if (input?.required === false) {
      continue;
    }
    const source = typeof input?.source === 'string' ? input.source : 'camp_stockpile';
    if (source !== 'camp_stockpile') {
      continue;
    }
    const itemId = typeof input?.itemId === 'string' ? input.itemId : '';
    const quantity = Math.max(1, Math.floor(Number(input?.quantity) || 0));
    if (!itemId || quantity <= 0) {
      continue;
    }
    const removed = removeCampStockpileItem(state.camp, itemId, quantity);
    if ((Number(removed?.consumed) || 0) < quantity) {
      return false;
    }
  }
  return true;
}

function ensureActorInventory(actor) {
  return ensureActorInventoryImpl(actor, { ensureInventoryEquipment });
}

function normalizeStackFootprintValue(value) {
  return normalizeStackFootprintValueImpl(value);
}

function getStackFootprint(stack) {
  return {
    footprintW: normalizeStackFootprintValue(stack?.footprintW),
    footprintH: normalizeStackFootprintValue(stack?.footprintH),
  };
}

function getStackUnitWeightKg(stack, fallback = 0) {
  const value = Number(stack?.unitWeightKg);
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  const normalizedFallback = Number(fallback);
  return Number.isFinite(normalizedFallback) && normalizedFallback >= 0 ? normalizedFallback : 0;
}

const FULLY_DRY_EPSILON = 1e-6;

function isDrynessAutoMergeCompatible(existingDryness, incomingDryness) {
  const existing = Number(existingDryness);
  const incoming = Number(incomingDryness);
  if (!Number.isFinite(existing) || !Number.isFinite(incoming)) {
    return true;
  }

  const existingFullyDry = clamp01(existing) >= (1 - FULLY_DRY_EPSILON);
  const incomingFullyDry = clamp01(incoming) >= (1 - FULLY_DRY_EPSILON);
  return existingFullyDry === incomingFullyDry;
}

function findCompatibleStackForAutoMerge(stacks, itemId, incomingDryness) {
  if (!Array.isArray(stacks)) {
    return null;
  }

  for (const stack of stacks) {
    if (stack?.itemId !== itemId) {
      continue;
    }
    if (!isDrynessAutoMergeCompatible(stack?.dryness, incomingDryness)) {
      continue;
    }
    return stack;
  }

  return null;
}

function findPreferredStackByItem(stacks, itemId, requestedQuantity) {
  if (!Array.isArray(stacks)) {
    return null;
  }

  const requested = Math.max(1, Math.floor(Number(requestedQuantity) || 1));
  let fallback = null;
  for (const stack of stacks) {
    if (stack?.itemId !== itemId) {
      continue;
    }

    const available = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
    if (available <= 0) {
      continue;
    }

    if (!fallback) {
      fallback = stack;
    }
    if (available >= requested) {
      return stack;
    }
  }

  return fallback;
}

function inventoryGridDimensions(inventory) {
  return {
    gridW: Math.max(1, Number.isInteger(inventory?.gridWidth) ? inventory.gridWidth : 6),
    gridH: Math.max(1, Number.isInteger(inventory?.gridHeight) ? inventory.gridHeight : 4),
  };
}

function rectOverlaps(a, b) {
  return a.x < (b.x + b.w)
    && (a.x + a.w) > b.x
    && a.y < (b.y + b.h)
    && (a.y + a.h) > b.y;
}

function canPlaceRect(rect, placedRects, gridW, gridH) {
  if (rect.x < 0 || rect.y < 0 || (rect.x + rect.w) > gridW || (rect.y + rect.h) > gridH) {
    return false;
  }
  for (const other of placedRects) {
    if (rectOverlaps(rect, other)) {
      return false;
    }
  }
  return true;
}

function findFirstFreePlacement(placedRects, w, h, gridW, gridH) {
  if (w > gridW || h > gridH) {
    return null;
  }

  for (let y = 0; y <= (gridH - h); y += 1) {
    for (let x = 0; x <= (gridW - w); x += 1) {
      const rect = { x, y, w, h };
      if (canPlaceRect(rect, placedRects, gridW, gridH)) {
        return rect;
      }
    }
  }

  return null;
}

function normalizeCurrentInventoryLayout(stacks, gridW, gridH) {
  const placed = [];
  const placementsByIndex = new Map();
  const unplaced = [];

  for (let idx = 0; idx < stacks.length; idx += 1) {
    const stack = stacks[idx];
    const qty = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
    if (qty <= 0) {
      continue;
    }

    const { footprintW, footprintH } = getStackFootprint(stack);
    const x = Number.isInteger(stack?.slotX) ? stack.slotX : null;
    const y = Number.isInteger(stack?.slotY) ? stack.slotY : null;

    if (x !== null && y !== null) {
      const rect = { x, y, w: footprintW, h: footprintH };
      if (canPlaceRect(rect, placed, gridW, gridH)) {
        placed.push(rect);
        placementsByIndex.set(idx, rect);
        continue;
      }
    }

    unplaced.push({ idx, footprintW, footprintH });
  }

  for (const candidate of unplaced) {
    const placement = findFirstFreePlacement(placed, candidate.footprintW, candidate.footprintH, gridW, gridH);
    if (!placement) {
      return null;
    }
    placed.push(placement);
    placementsByIndex.set(candidate.idx, placement);
  }

  return placementsByIndex;
}

function repackInventoryWithIncoming(stacks, incoming, gridW, gridH) {
  const existing = [];
  for (let idx = 0; idx < stacks.length; idx += 1) {
    const stack = stacks[idx];
    const qty = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
    if (qty <= 0) {
      continue;
    }
    const { footprintW, footprintH } = getStackFootprint(stack);
    existing.push({
      kind: 'existing',
      idx,
      itemId: typeof stack?.itemId === 'string' ? stack.itemId : '',
      footprintW,
      footprintH,
      area: footprintW * footprintH,
    });
  }

  const all = [
    ...existing,
    {
      kind: 'incoming',
      itemId: typeof incoming?.itemId === 'string' ? incoming.itemId : '',
      footprintW: incoming.footprintW,
      footprintH: incoming.footprintH,
      area: incoming.footprintW * incoming.footprintH,
    },
  ];

  all.sort((a, b) => {
    if (b.area !== a.area) {
      return b.area - a.area;
    }
    if (b.footprintH !== a.footprintH) {
      return b.footprintH - a.footprintH;
    }
    if (b.footprintW !== a.footprintW) {
      return b.footprintW - a.footprintW;
    }
    const idCompare = String(a.itemId || '').localeCompare(String(b.itemId || ''));
    if (idCompare !== 0) {
      return idCompare;
    }
    if (a.kind !== b.kind) {
      return a.kind === 'existing' ? -1 : 1;
    }
    return (a.idx ?? 0) - (b.idx ?? 0);
  });

  const placed = [];
  const placementsByExistingIndex = new Map();
  let incomingPlacement = null;
  for (const candidate of all) {
    const placement = findFirstFreePlacement(placed, candidate.footprintW, candidate.footprintH, gridW, gridH);
    if (!placement) {
      return null;
    }
    placed.push(placement);

    if (candidate.kind === 'existing') {
      placementsByExistingIndex.set(candidate.idx, placement);
    } else {
      incomingPlacement = placement;
    }
  }

  if (!incomingPlacement) {
    return null;
  }

  return {
    placementsByExistingIndex,
    incomingPlacement,
  };
}

function inventoryCurrentWeightKg(inventory) {
  const stacks = Array.isArray(inventory?.stacks) ? inventory.stacks : [];
  let total = 0;
  for (const stack of stacks) {
    const qty = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
    if (qty <= 0) {
      continue;
    }
    total += qty * getStackUnitWeightKg(stack, 0);
  }
  return total;
}

function maxQuantityByCarryWeight(inventory, unitWeightKg) {
  if (!Number.isFinite(unitWeightKg) || unitWeightKg <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const maxCarry = Number(inventory?.maxCarryWeightKg);
  if (!Number.isFinite(maxCarry) || maxCarry < 0) {
    return Number.POSITIVE_INFINITY;
  }

  const available = maxCarry - inventoryCurrentWeightKg(inventory);
  if (available <= 0) {
    return 0;
  }

  return Math.max(0, Math.floor(available / unitWeightKg));
}

function mergeStackMetadata(
  existing,
  priorQty,
  addedQty,
  incomingFreshness,
  incomingDecayDaysRemaining,
  incomingUnitWeightKg,
  incomingDryness,
  incomingTanninRemaining,
) {
  if (Number.isFinite(incomingFreshness)) {
    const priorFreshness = Number(existing.freshness);
    existing.freshness = Number.isFinite(priorFreshness)
      ? ((priorFreshness * priorQty) + (incomingFreshness * addedQty)) / Math.max(1, priorQty + addedQty)
      : incomingFreshness;
  }

  if (Number.isFinite(incomingDecayDaysRemaining) && incomingDecayDaysRemaining >= 0) {
    const priorDecayDaysRemaining = Number(existing.decayDaysRemaining);
    existing.decayDaysRemaining = Number.isFinite(priorDecayDaysRemaining) && priorDecayDaysRemaining >= 0
      ? ((priorDecayDaysRemaining * priorQty) + (incomingDecayDaysRemaining * addedQty)) / Math.max(1, priorQty + addedQty)
      : incomingDecayDaysRemaining;
  }

  if (Number.isFinite(incomingDryness)) {
    const priorDryness = Number(existing.dryness);
    existing.dryness = Number.isFinite(priorDryness)
      ? clamp01(((priorDryness * priorQty) + (incomingDryness * addedQty)) / Math.max(1, priorQty + addedQty))
      : clamp01(incomingDryness);
  }

  if (Number.isFinite(incomingTanninRemaining)) {
    const priorTanninRemaining = Number(existing.tanninRemaining);
    existing.tanninRemaining = Number.isFinite(priorTanninRemaining)
      ? clamp01(((priorTanninRemaining * priorQty) + (incomingTanninRemaining * addedQty)) / Math.max(1, priorQty + addedQty))
      : clamp01(incomingTanninRemaining);
  }

  const priorUnitWeightKg = Number(existing.unitWeightKg);
  if (Number.isFinite(priorUnitWeightKg) && priorUnitWeightKg >= 0) {
    return;
  }
  if (Number.isFinite(incomingUnitWeightKg) && incomingUnitWeightKg >= 0) {
    existing.unitWeightKg = incomingUnitWeightKg;
  }
}

function resolvePlantSubStageCanDry(itemId) {
  if (typeof itemId !== 'string' || !itemId.includes(':')) {
    return null;
  }

  const [speciesId, partName, subStageId] = itemId.split(':');
  if (!speciesId || !partName || !subStageId) {
    return null;
  }

  const plant = PLANT_BY_ID[speciesId];
  if (!plant) {
    return null;
  }

  const part = Array.isArray(plant.parts)
    ? plant.parts.find((entry) => entry?.name === partName)
    : null;
  const subStage = Array.isArray(part?.subStages)
    ? part.subStages.find((entry) => entry?.id === subStageId)
    : null;

  return subStage?.can_dry === true;
}

function resolveAnimalPartCanDry(itemId) {
  if (typeof itemId !== 'string' || !itemId.includes(':')) {
    return null;
  }

  const [speciesId, partId] = itemId.split(':');
  if (!speciesId || !partId) {
    return null;
  }

  const animal = ANIMAL_BY_ID[speciesId];
  if (!animal || !Array.isArray(animal.parts)) {
    return null;
  }

  const part = animal.parts.find((entry) => entry?.id === partId);
  return part?.can_dry === true;
}

function canItemStackDry(stack) {
  if (!stack || typeof stack !== 'object') {
    return false;
  }

  const decayDaysRemaining = Number(stack.decayDaysRemaining);
  if (!Number.isFinite(decayDaysRemaining) || decayDaysRemaining <= 0) {
    return false;
  }

  const itemId = typeof stack.itemId === 'string' ? stack.itemId : '';
  const plantCanDry = resolvePlantSubStageCanDry(itemId);
  if (plantCanDry !== null) {
    return plantCanDry;
  }

  const animalCanDry = resolveAnimalPartCanDry(itemId);
  if (animalCanDry !== null) {
    return animalCanDry;
  }

  return false;
}

function applyDryingToStackArray(stacks, dailyIncrement) {
  if (!Array.isArray(stacks) || !Number.isFinite(dailyIncrement) || dailyIncrement <= 0) {
    return Array.isArray(stacks) ? stacks : [];
  }

  return stacks.map((stack) => {
    if (!stack || typeof stack !== 'object' || !canItemStackDry(stack)) {
      return stack;
    }

    const priorDryness = clamp01(Number(stack.dryness) || 0);
    return {
      ...stack,
      dryness: clamp01(priorDryness + dailyIncrement),
    };
  });
}

function addWorldItemNearby(state, originX, originY, itemId, quantity, options = null) {
  return addWorldItemNearbyImpl(state, originX, originY, itemId, quantity, options, {
    normalizeStackFootprintValue,
    inBounds,
    tileIndex,
    isRockTile,
    mergeStackMetadata,
    clamp01,
  });
}

function addActorInventoryItemWithOverflowDrop(state, actor, itemId, quantity, options = null) {
  return addActorInventoryItemWithOverflowDropImpl(state, actor, itemId, quantity, options, {
    addActorInventoryItem,
    addWorldItemNearby,
  });
}

function applyDecayToStackArray(stacks, options = null) {
  if (!Array.isArray(stacks)) {
    return [];
  }

  const next = [];
  for (const stack of stacks) {
    if (!stack || typeof stack !== 'object') {
      continue;
    }

    const quantity = Math.max(0, Math.floor(Number(stack.quantity) || 0));
    if (quantity <= 0) {
      continue;
    }

    const decayDaysRemaining = Number(stack.decayDaysRemaining);
    if (!Number.isFinite(decayDaysRemaining) || decayDaysRemaining < 0) {
      next.push({ ...stack, quantity });
      continue;
    }

    const dryness = clamp01(Number(stack.dryness) || 0);
    const dailyDecayDelta = 1 - (0.95 * dryness);
    const nextDecay = decayDaysRemaining - dailyDecayDelta;
    if (nextDecay <= 0) {
      if (stack.itemId === EARTHWORM_ITEM_ID && options?.earthwormEscapeOnExpire === true) {
        continue;
      }

      if (stack.itemId === ROTTING_ORGANIC_ITEM_ID) {
        if (typeof options?.onRottingExpired === 'function') {
          options.onRottingExpired(stack);
        }
        continue;
      }

      const rottingStack = {
        itemId: ROTTING_ORGANIC_ITEM_ID,
        quantity: 1,
        decayDaysRemaining: ROTTING_ORGANIC_DECAY_DAYS,
        footprintW: 1,
        footprintH: 1,
      };
      if (Number.isInteger(stack.slotX)) {
        rottingStack.slotX = stack.slotX;
      }
      if (Number.isInteger(stack.slotY)) {
        rottingStack.slotY = stack.slotY;
      }
      next.push(rottingStack);
      continue;
    }

    next.push({
      ...stack,
      quantity,
      decayDaysRemaining: nextDecay,
      ...(dryness > 0 ? { dryness } : {}),
    });
  }

  return next;
}

function applyRottingOrganicFertilityBonusAtTile(state, tileKey) {
  if (typeof tileKey !== 'string') {
    return;
  }

  const [xRaw, yRaw] = tileKey.split(',');
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (!Number.isInteger(x) || !Number.isInteger(y) || !inBounds(x, y, state.width, state.height)) {
    return;
  }

  const tile = state.tiles[tileIndex(x, y, state.width)];
  if (!tile || tile.waterType) {
    return;
  }

  tile.fertility = clamp01((Number(tile.fertility) || 0) + ROTTING_ORGANIC_FERTILITY_BONUS);
  const soilSuitability = calculateSoilSuitability(tile);
  tile.avgSoilMatch = soilSuitability.avgSoilMatch;
  tile.maxSoilMatch = soilSuitability.maxSoilMatch;
}

function applyDailyItemDecay(state) {
  if (state?.camp?.dryingRack && Array.isArray(state.camp.dryingRack.slots)) {
    state.camp.dryingRack.slots = applyDryingToStackArray(state.camp.dryingRack.slots, 0.2);
  }

  if (state?.worldItemsByTile && typeof state.worldItemsByTile === 'object') {
    for (const [tileKey, stacks] of Object.entries(state.worldItemsByTile)) {
      state.worldItemsByTile[tileKey] = applyDryingToStackArray(stacks, 0.1);
    }
  }

  for (const actor of Object.values(state?.actors || {})) {
    if (!actor?.inventory) {
      continue;
    }
    actor.inventory.stacks = applyDecayToStackArray(actor.inventory.stacks);
  }

  if (state?.camp?.stockpile) {
    state.camp.stockpile.stacks = applyDecayToStackArray(state.camp.stockpile.stacks);
  }

  if (state?.camp?.dryingRack && Array.isArray(state.camp.dryingRack.slots)) {
    state.camp.dryingRack.slots = applyDecayToStackArray(state.camp.dryingRack.slots);
  }

  if (!state?.worldItemsByTile || typeof state.worldItemsByTile !== 'object') {
    state.worldItemsByTile = {};
    return;
  }

  const nextWorldItemsByTile = {};
  for (const [tileKey, stacks] of Object.entries(state.worldItemsByTile)) {
    const decayedStacks = applyDecayToStackArray(stacks, {
      earthwormEscapeOnExpire: true,
      onRottingExpired: (stack) => {
        if (stack?.itemId === ROTTING_ORGANIC_ITEM_ID) {
          applyRottingOrganicFertilityBonusAtTile(state, tileKey);
        }
      },
    });
    if (decayedStacks.length > 0) {
      nextWorldItemsByTile[tileKey] = decayedStacks;
    }
  }
  state.worldItemsByTile = nextWorldItemsByTile;
}

function applyDailySapTapFill(state) {
  for (const tile of state.tiles || []) {
    const sapTap = tile?.sapTap;
    if (!sapTap || sapTap.hasSpout !== true || sapTap.hasVessel !== true) {
      continue;
    }

    const vesselCapacityUnits = Number.isInteger(sapTap.vesselCapacityUnits) && sapTap.vesselCapacityUnits > 0
      ? sapTap.vesselCapacityUnits
      : SAP_TAP_VESSEL_CAPACITY_UNITS;
    const vesselSapUnits = Number.isInteger(sapTap.vesselSapUnits)
      ? Math.max(0, sapTap.vesselSapUnits)
      : 0;
    const nextSapUnits = Math.min(vesselCapacityUnits, vesselSapUnits + SAP_TAP_DAILY_FILL_UNITS);

    tile.sapTap = {
      ...sapTap,
      vesselSapUnits: nextSapUnits,
      vesselCapacityUnits,
    };
  }
}

function applyDailyLeachingBasketProgress(state) {
  for (const tile of state.tiles || []) {
    const basket = tile?.leachingBasket;
    if (!basket || basket.active !== true) {
      continue;
    }

    if (tile.waterFrozen === true) {
      continue;
    }

    const reduction = tile.waterType === 'river'
      ? LEACHING_BASKET_TANNIN_REDUCTION_RIVER_PER_DAY
      : LEACHING_BASKET_TANNIN_REDUCTION_POND_PER_DAY;
    const tanninRemaining = Number.isFinite(Number(basket.tanninRemaining))
      ? clamp01(Number(basket.tanninRemaining))
      : 0;
    tile.leachingBasket = {
      ...basket,
      tanninRemaining: clamp01(tanninRemaining - reduction),
      lastResolvedYear: Number(state.year) || 1,
      lastResolvedDay: Number(state.dayOfYear) || 1,
    };
  }
}

function rollSimpleSnareCatch(state, tile, snare) {
  return rollSimpleSnareCatchImpl(state, tile, snare, {
    mulberry32,
    getAnimalDensityAtTile,
    clamp01,
    SIMPLE_SNARE_BASE_CATCH_CHANCE,
    SIMPLE_SNARE_RABBIT_DENSITY_WEIGHT,
    SIMPLE_SNARE_MIN_RELIABILITY,
    SIMPLE_SNARE_DAILY_RELIABILITY_DECAY,
  });
}

function applyDailySimpleSnareResolution(state) {
  return applyDailySimpleSnareResolutionImpl(state, {
    SIMPLE_SNARE_POACH_DAY_4_PLUS_CHANCE,
    SIMPLE_SNARE_POACH_DAY_1_CHANCE,
    SIMPLE_SNARE_POACH_DAY_2_CHANCE,
    SIMPLE_SNARE_POACH_DAY_3_CHANCE,
    mulberry32,
    rollSimpleSnareCatch,
  });
}

function addActorInventoryItem(actor, itemId, quantity, options = null) {
  return addActorInventoryItemImpl(actor, itemId, quantity, options, {
    ensureActorInventory,
    getStackUnitWeightKg,
    maxQuantityByCarryWeight,
    normalizeStackFootprintValue,
    findCompatibleStackForAutoMerge,
    mergeStackMetadata,
    inventoryGridDimensions,
    normalizeCurrentInventoryLayout,
    findFirstFreePlacement,
    repackInventoryWithIncoming,
    getStackFootprint,
    clamp01,
  });
}

function removeActorInventoryItem(actor, itemId, quantity) {
  return removeActorInventoryItemImpl(actor, itemId, quantity, {
    ensureActorInventory,
    findPreferredStackByItem,
  });
}

function addCampDryingRackItem(camp, itemId, quantity, options = null) {
  return addCampDryingRackItemImpl(camp, itemId, quantity, options, {
    addActorInventoryItem,
  });
}

function extractActorInventoryItemWithMetadata(actor, itemId, quantity) {
  return extractActorInventoryItemWithMetadataImpl(actor, itemId, quantity, {
    findPreferredStackByItem,
    removeActorInventoryItem,
    normalizeStackFootprintValue,
  });
}

function progressPartnerTaskQueueOneTick(state) {
  const queue = state?.camp?.partnerTaskQueue;
  if (!queue) {
    return;
  }

  if (!Array.isArray(queue.queued)) {
    queue.queued = [];
  }

  const promoteNextTask = () => {
    if (queue.active) {
      return;
    }
    while (!queue.active && queue.queued.length > 0) {
      const nextTask = normalizePartnerTask(queue.queued.shift());
      if (!nextTask) {
        continue;
      }
      const invalidReason = getPartnerTaskInvalidationReason(state, nextTask);
      if (invalidReason) {
        appendPartnerTaskHistory(state, {
          taskId: nextTask.taskId,
          kind: nextTask.kind,
          status: 'failed',
          failureReason: invalidReason,
        });
        continue;
      }
      nextTask.status = 'active';
      nextTask.failureReason = null;
      queue.active = nextTask;
    }
  };

  promoteNextTask();

  if (!queue.active) {
    mirrorPartnerTaskQueueToActor(state);
    return;
  }

  while (queue.active) {
    const invalidReason = getPartnerTaskInvalidationReason(state, queue.active);
    if (!invalidReason) {
      break;
    }
    appendPartnerTaskHistory(state, {
      taskId: queue.active.taskId,
      kind: queue.active.kind,
      status: 'failed',
      failureReason: invalidReason,
    });
    queue.active = null;
    promoteNextTask();
  }

  if (!queue.active) {
    mirrorPartnerTaskQueueToActor(state);
    return;
  }

  queue.active.ticksRemaining = Math.max(0, Math.floor(Number(queue.active.ticksRemaining || 0)) - 1);
  if (queue.active.ticksRemaining === 0) {
    const didConsumeInputs = consumePartnerTaskInputs(state, queue.active);
    if (didConsumeInputs) {
      completePartnerTaskOutputs(state, queue.active);
      appendPartnerTaskHistory(state, {
        taskId: queue.active.taskId,
        kind: queue.active.kind,
        status: 'completed',
        failureReason: null,
      });
    } else {
      appendPartnerTaskHistory(state, {
        taskId: queue.active.taskId,
        kind: queue.active.kind,
        status: 'failed',
        failureReason: 'missing_input_at_completion',
      });
    }
    queue.active = null;
    promoteNextTask();
  }

  mirrorPartnerTaskQueueToActor(state);
}

function applyActionEffect(state, action) {
  return applyActionEffectImpl(state, action, {
    inBounds,
    tileIndex,
    removeWorldItemAtTile,
    addActorInventoryItemWithOverflowDrop,
    extractActorInventoryItemWithMetadata,
    addWorldItemNearby,
    trySpawnEarthwormFromDig,
    isRockTile,
    removeActorInventoryItem,
    parseWaterskinStateItemId,
    clamp01,
    WATERSKIN_DRINK_THIRST_GAIN,
    maybeApplyGutIllnessFromWaterskin,
    findPreferredStackByItem,
    normalizeStackFootprintValue,
    addCampStockpileItem,
    removeCampStockpileItem,
    addCampDryingRackItem,
    CAMP_COMFORT_STATION_IDS,
    getAnimalDensityAtTile,
    FISH_TRAP_MAX_STORED_CATCH,
    EARTHWORM_ITEM_ID,
    ANIMAL_BY_ID,
    SAP_TAP_VESSEL_CAPACITY_UNITS,
    SAP_FILLED_VESSEL_ITEM_ID,
    EQUIPPABLE_ITEM_TO_SLOT,
    ensureActorInventory,
    ensureInventoryEquipment,
    resolveItemFootprint,
    maybeCreateDeadLog,
    applyHarvestAction,
    applyHarvestInjuryFromSubStage,
    normalizePartnerTask,
    mirrorPartnerTaskQueueToActor,
    addActorInventoryItem,
  });
}

function rollGroundFungusYield(zone, targetTile, rng) {
  return rollGroundFungusYieldImpl(zone, targetTile, rng, { rangeRollIntRandom });
}

function applyGroundFungusFruiting(state, rng) {
  return applyGroundFungusFruitingImpl(state, rng, {
    isDayInSeasonWindow,
    rollGroundFungusYield,
  });
}

function assignGroundFungusZoneToTile(tile, fungus, zoneId) {
  return assignGroundFungusZoneToTileImpl(tile, fungus, zoneId);
}

function logFungusHostCompatible(logFungus, sourceSpeciesId) {
  return logFungusHostCompatibleImpl(logFungus, sourceSpeciesId);
}

function ensureDeadLogFungusShape(deadLog) {
  return ensureDeadLogFungusShapeImpl(deadLog);
}

function rollLogFungusYield(entry, tile, deadLog, rng) {
  return rollLogFungusYieldImpl(entry, tile, deadLog, rng, {
    rangeRollIntRandom,
    moistureYieldMultiplier,
  });
}

function applyLogFungusFruiting(state, rng) {
  return applyLogFungusFruitingImpl(state, rng, {
    ensureDeadLogFungusShape,
    isDayInLogWindow,
    rollLogFungusYield,
  });
}

function colonizeDeadLogFungiByYear(state, rng) {
  return colonizeDeadLogFungiByYearImpl(state, rng, {
    ensureDeadLogFungusShape,
    MAX_LOG_FUNGI_PER_LOG,
    LOG_FUNGUS_BY_ID,
    logFungusHostCompatible,
    clamp01,
    moistureYieldMultiplier,
  });
}

function generateGroundFungusZonesInternal(state, rng) {
  return generateGroundFungusZonesInternalImpl(state, rng, {
    GROUND_FUNGUS_CATALOG,
    computeGroundFungusSoilMatch,
    isRockTile,
    rangeRollIntRandom,
    tileIndex,
    inBounds,
    assignGroundFungusZoneToTile,
  });
}

function generateBeehivesInternal(state, rng) {
  return generateBeehivesInternalImpl(state, rng, {
    PLANT_BY_ID,
    lifeStageSize,
    tileIndex,
    isRockTile,
    BEEHIVE_SPECIES_ID,
    applyBeehiveSeasonalState,
  });
}

function generateSquirrelCachesInternal(state, rng, options = {}) {
  const regenerate = options.regenerate === true;
  if (state.squirrelCachesGenerated && !regenerate) {
    return;
  }

  if (regenerate) {
    clearSquirrelCaches(state);
  }

  const cacheItemPool = resolveSquirrelCacheItemPool(PLANT_CATALOG);
  const runSpeciesPool = [...new Set(cacheItemPool.map((item) => item.speciesId))];
  const squirrelDensityByTile = buildSquirrelDensityByTile(state, {
    lifeStageSize,
    squirrelNutTreeSpecies: SQUIRREL_NUT_TREE_SPECIES,
    squirrelNutTreeMaturitySize: SQUIRREL_NUT_TREE_MATURITY_SIZE,
  });
  const groundCandidates = [];
  const deadTreeCandidates = [];

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType || isRockTile(tile) || tile.squirrelCache || tile.beehive) {
      continue;
    }

    const fertility = Number(tile.fertility) || 0;
    const moisture = Number(tile.moisture) || 0;
    const tileKey = animalTileDensityKey(tile.x, tile.y);
    const squirrelDensity = clamp01(Number(squirrelDensityByTile[tileKey]) || 0);

    if (tile.deadLog) {
      deadTreeCandidates.push({
        tile,
        score: (moisture * 0.42) + (fertility * 0.24) + (squirrelDensity * 0.95) + rng() * 0.2,
      });
      continue;
    }

    if (tile.plantIds.length > 0) {
      continue;
    }

    groundCandidates.push({
      tile,
      score: (fertility * 0.35) + (moisture * 0.24) + (Number(tile.shade) || 0) * 0.12 + (squirrelDensity * 1.08) + rng() * 0.2,
    });
  }

  const totalCandidateCount = groundCandidates.length + deadTreeCandidates.length;
  if (totalCandidateCount === 0 || cacheItemPool.length === 0) {
    state.runSquirrelCacheNutPool = runSpeciesPool;
    state.squirrelCachesGenerated = true;
    return;
  }

  groundCandidates.sort((a, b) => b.score - a.score);
  deadTreeCandidates.sort((a, b) => b.score - a.score);

  const totalTarget = computeSquirrelCacheTargetCount(state, squirrelDensityByTile, totalCandidateCount);
  let groundTarget = Math.min(groundCandidates.length, Math.round(totalTarget * SQUIRREL_CACHE_GROUND_RATIO));
  let deadTarget = Math.min(deadTreeCandidates.length, totalTarget - groundTarget);

  const deficit = totalTarget - (groundTarget + deadTarget);
  if (deficit > 0) {
    const extraGround = Math.min(deficit, groundCandidates.length - groundTarget);
    groundTarget += extraGround;
    deadTarget += Math.min(deficit - extraGround, deadTreeCandidates.length - deadTarget);
  }

  const selectedCandidates = [
    ...selectSquirrelCacheCandidatesWithSpread(groundCandidates, groundTarget, {
      nearRadius: SQUIRREL_CACHE_SPREAD_RADIUS_NEAR,
      midRadius: SQUIRREL_CACHE_SPREAD_RADIUS_MID,
      nearFactor: SQUIRREL_CACHE_SPREAD_NEAR_FACTOR,
      midFactor: SQUIRREL_CACHE_SPREAD_MID_FACTOR,
    })
      .map((entry) => ({ ...entry, placementType: 'ground' })),
    ...selectSquirrelCacheCandidatesWithSpread(deadTreeCandidates, deadTarget, {
      nearRadius: SQUIRREL_CACHE_SPREAD_RADIUS_NEAR,
      midRadius: SQUIRREL_CACHE_SPREAD_RADIUS_MID,
      nearFactor: SQUIRREL_CACHE_SPREAD_NEAR_FACTOR,
      midFactor: SQUIRREL_CACHE_SPREAD_MID_FACTOR,
    })
      .map((entry) => ({ ...entry, placementType: 'dead_tree' })),
  ];

  for (const { tile, placementType } of selectedCandidates) {
    const cacheItem = cacheItemPool[Math.floor(rng() * cacheItemPool.length)];
    tile.squirrelCache = {
      cachedSpeciesId: cacheItem.speciesId,
      cachedPartName: cacheItem.partName,
      cachedSubStageId: cacheItem.subStageId,
      nutContentGrams: rangeRollIntRandom(SQUIRREL_CACHE_CONTENT_RANGE_GRAMS, rng, 600),
      placementType,
      discovered: false,
    };
  }

  state.runSquirrelCacheNutPool = runSpeciesPool;
  state.squirrelCachesGenerated = true;
}

export function generateGroundFungusZones(state) {
  if (state?.groundFungusZonesGenerated) {
    return state;
  }
  if (!canGenerateGroundFungusZones(state)) {
    return state;
  }

  const nextState = {
    ...state,
    tiles: Array.isArray(state.tiles) ? state.tiles.map(cloneTile) : [],
    runGroundFungusPool: Array.isArray(state.runGroundFungusPool) ? [...state.runGroundFungusPool] : [],
  };
  const rng = mulberry32((nextState.seed + nextState.totalDaysSimulated + 1) * 59);
  generateGroundFungusZonesInternal(nextState, rng);
  return nextState;
}

export function advanceTick(state, options = {}) {
  return advanceTickImpl(state, options, {
    advanceDay: (innerState, steps) => advanceDay(innerState, steps),
    ensureTickSystems,
    sortActionsDeterministically,
    isInProgressActionEnvelope,
    normalizeInProgressTicks,
    validateActionDefinition,
    isResumablePlayerAction,
    applyActionEffect,
    consumeActorTickBudget,
    resolveFishRodTickOutcome,
    inBounds,
    tileIndex,
    createInProgressActionEnvelope,
    progressPartnerTaskQueueOneTick,
    processAutoRodTickResolution,
    applyColdExposureTick,
    applyTemperatureThirstTick,
    TICKS_PER_DAY,
    getActorDayStartTickBudgetBase,
  });
}

export function validateAction(state, action, options = {}) {
  return validateActionDefinition(state, action, options);
}

export function getAllActions(state, actorId) {
  return getAllAvailableActions(state, actorId);
}

export function getActionTickCost(kind, payload = {}) {
  return getActionTickCostDefinition(kind, payload);
}

export function previewAction(state, action, options = {}) {
  return previewActionDefinition(state, action, options);
}

export function generateBeehives(state) {
  if (state?.beehivesGenerated) {
    return state;
  }
  if (!canGenerateBeehivesInternal(state)) {
    return state;
  }

  const nextState = {
    ...state,
    tiles: Array.isArray(state.tiles) ? state.tiles.map(cloneTile) : [],
  };
  const rng = mulberry32((nextState.seed + nextState.totalDaysSimulated + 1) * 67);
  generateBeehivesInternal(nextState, rng);
  return nextState;
}

export function generateSquirrelCaches(state) {
  if (state?.squirrelCachesGenerated) {
    return state;
  }
  if (!canGenerateSquirrelCachesInternal(state)) {
    return state;
  }

  const nextState = {
    ...state,
    tiles: Array.isArray(state.tiles) ? state.tiles.map(cloneTile) : [],
    runSquirrelCacheNutPool: cloneStringArray(state.runSquirrelCacheNutPool),
  };
  const rng = mulberry32((nextState.seed + nextState.totalDaysSimulated + 1) * 71);
  generateSquirrelCachesInternal(nextState, rng);
  return nextState;
}

export function generateFishPopulations(state) {
  if (state?.fishPopulationsGenerated) {
    return state;
  }
  if (!canGenerateFishPopulationsInternal(state)) {
    return state;
  }

  const nextState = {
    ...state,
    fishDensityByTile: cloneFishDensityByTile(state?.fishDensityByTile),
    fishEquilibriumByTile: state?.fishEquilibriumByTile || {},
    fishWaterBodyByTile: { ...(state?.fishWaterBodyByTile || {}) },
    fishWaterBodies: { ...(state?.fishWaterBodies || {}) },
    runSquirrelCacheNutPool: cloneStringArray(state?.runSquirrelCacheNutPool),
  };
  generateFishPopulationsInternal(nextState);
  return nextState;
}

export function canGenerateAnimalZones(state) {
  return canGenerateAnimalZonesInternal(state);
}

export function canGenerateFishPopulations(state) {
  return canGenerateFishPopulationsInternal(state);
}

export function generateAnimalZones(state) {
  if (state?.animalZonesGenerated) {
    return state;
  }
  if (!canGenerateAnimalZonesInternal(state)) {
    return state;
  }

  const nextState = {
    ...state,
    animalZoneGrid: state?.animalZoneGrid ? { ...state.animalZoneGrid } : null,
    animalDensityByZone: cloneAnimalDensityByZone(state?.animalDensityByZone),
  };
  generateAnimalZonesInternal(nextState);
  return nextState;
}

function maxLifeStageMinAge(species) {
  return species.lifeStages.reduce((maxAge, stage) => {
    if (!Number.isFinite(stage?.min_age_days)) {
      return maxAge;
    }
    return Math.max(maxAge, stage.min_age_days);
  }, 0);
}

function lifecycleYearOrdinal(stageName) {
  if (typeof stageName !== 'string') {
    return null;
  }
  if (stageName.startsWith('first_year_')) {
    return 1;
  }
  if (stageName.startsWith('second_year_')) {
    return 2;
  }
  if (stageName.startsWith('third_year_')) {
    return 3;
  }
  return null;
}

function maxLifecycleYearOrdinal(species) {
  let maxOrdinal = null;
  for (const stage of species.lifeStages) {
    const ordinal = lifecycleYearOrdinal(stage.stage);
    if (!Number.isFinite(ordinal)) {
      continue;
    }
    maxOrdinal = maxOrdinal === null ? ordinal : Math.max(maxOrdinal, ordinal);
  }
  return maxOrdinal;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function rangeRollInt(range, fallback = 1) {
  if (!Array.isArray(range) || range.length < 2) {
    return Math.max(1, fallback);
  }

  const min = Math.floor(Number(range[0]));
  const max = Math.floor(Number(range[1]));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return Math.max(1, fallback);
  }

  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.max(1, Math.round((low + high) / 2));
}

function perActionVitalityDamage(subStage, entry) {
  const harvestDamage = Number(subStage?.harvest_damage);
  if (!Number.isFinite(harvestDamage) || harvestDamage <= 0) {
    return 0;
  }

  const budget = Math.max(1, Number(entry?.initialActionsRoll) || 1);
  return harvestDamage / budget;
}

function advanceActiveSubStageRegrowth(plantInstance, species, dayOfYear) {
  if (!Array.isArray(plantInstance.activeSubStages)) {
    return;
  }

  for (const entry of plantInstance.activeSubStages) {
    if (!entry || !entry.partName || !entry.subStageId) {
      continue;
    }

    if (!Number.isInteger(entry.regrowthCountdown) || entry.regrowthCountdown <= 0) {
      continue;
    }

    const { subStage } = findPartAndSubStage(species, entry.partName, entry.subStageId);
    if (!subStage || !isDayInWindow(dayOfYear, subStage.seasonalWindow)) {
      continue;
    }

    ensureHarvestEntryState(entry, subStage, plantInstance, species);
    entry.regrowthCountdown -= 1;
    if (entry.regrowthCountdown <= 0) {
      entry.regrowthCountdown = null;
      entry.remainingActionsGround = Math.max(0, Math.floor(Number(entry.initialActionsGround) || 0));
      entry.remainingActionsElevated = Math.max(0, Math.floor(Number(entry.initialActionsElevated) || 0));
      entry.remainingActionsCanopy = Math.max(0, Math.floor(Number(entry.initialActionsCanopy) || 0));
      entry.remainingActions = entry.remainingActionsGround + entry.remainingActionsElevated + entry.remainingActionsCanopy;
    }
  }
}

function subStageMatchesLifecycleYear(species, stageName, subStageId) {
  if (!species || species.longevity !== 'biennial') {
    return true;
  }
  const stageYear = lifecycleYearOrdinal(stageName);
  if (!Number.isInteger(stageYear)) {
    return true;
  }
  if (typeof subStageId !== 'string' || !subStageId) {
    return true;
  }
  if (subStageId.startsWith('first_year_') || subStageId === 'first_year') {
    return stageYear === 1;
  }
  if (subStageId.startsWith('second_year_') || subStageId === 'second_year') {
    return stageYear === 2;
  }
  if (subStageId.startsWith('third_year_') || subStageId === 'third_year') {
    return stageYear === 3;
  }
  return true;
}

function buildActiveSubStages(species, stageName, dayOfYear, existing = []) {
  const activeByKey = new Map();
  for (const entry of existing) {
    if (!entry || !entry.partName || !entry.subStageId) {
      continue;
    }
    activeByKey.set(`${entry.partName}:${entry.subStageId}`, entry);
  }

  const nextActive = [];
  for (const part of species.parts || []) {
    if (!part.availableLifeStages?.includes(stageName)) {
      continue;
    }

    for (const subStage of part.subStages || []) {
      if (!isDayInWindow(dayOfYear, subStage.seasonalWindow)) {
        continue;
      }
      if (!subStageMatchesLifecycleYear(species, stageName, subStage.id)) {
        continue;
      }

      const key = `${part.name}:${subStage.id}`;
      const existingEntry = activeByKey.get(key);
      if (existingEntry) {
        nextActive.push(existingEntry);
        continue;
      }

      nextActive.push({
        partName: part.name,
        subStageId: subStage.id,
        regrowthCountdown: null,
        harvestsThisSeason: 0,
      });
    }
  }

  return nextActive;
}

function findOpenSpot(tiles, width, height, x, y) {
  const ringOrder = [
    [0, 0],
    [-1, 0], [1, 0], [0, -1], [0, 1],
    [-1, -1], [1, 1], [-1, 1], [1, -1],
    [2, 0], [-2, 0], [0, 2], [0, -2],
  ];

  for (const [ox, oy] of ringOrder) {
    const nx = x + ox;
    const ny = y + oy;
    if (!inBounds(nx, ny, width, height)) {
      continue;
    }
    const tile = tiles[tileIndex(nx, ny, width)];
    if (isTileBlockedForPlantLife(tile) || tile.plantIds.length >= MAX_PLANTS_PER_TILE) {
      continue;
    }
    return { x: nx, y: ny };
  }

  return null;
}

function addPlantInstance(state, speciesId, x, y, age, source = 'founder') {
  const tile = state.tiles[tileIndex(x, y, state.width)];
  if (isTileBlockedForPlantLife(tile) || tile.plantIds.length >= MAX_PLANTS_PER_TILE) {
    return null;
  }

  const species = PLANT_BY_ID[speciesId];
  const stage = stageForDay(species, age, state.dayOfYear);
  const stageName = stage ? stage.stage : species.lifeStages[0].stage;

  const id = `plant_${state.nextPlantNumericId}`;
  state.nextPlantNumericId += 1;

  const plantInstance = {
    id,
    speciesId,
    age,
    x,
    y,
    stageName,
    alive: true,
    vitality: 1,
    activeSubStages: buildActiveSubStages(species, stageName, state.dayOfYear),
    source,
  };

  state.plants[id] = plantInstance;
  tile.plantIds.push(id);
  return id;
}

function maxLifeStageSize(species) {
  return species.lifeStages.reduce((maxSize, stage) => {
    const size = Number.isFinite(stage?.size) ? stage.size : 1;
    return Math.max(maxSize, size);
  }, 1);
}

function lifeStageSize(species, stageName) {
  const stage = species?.lifeStages?.find((candidate) => candidate.stage === stageName);
  if (!Number.isFinite(stage?.size)) {
    return 1;
  }
  return Math.max(1, Math.round(stage.size));
}

function maybeCreateDeadLog(state, plant, options = {}) {
  const species = PLANT_BY_ID[plant.speciesId];
  if (!species || species.longevity !== 'perennial') {
    return;
  }

  const sizeAtDeath = lifeStageSize(species, plant.stageName);
  if (sizeAtDeath <= 7) {
    return;
  }

  const tile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
  if (!tile || tile.deadLog || isRockTile(tile)) {
    return;
  }

  const normalizedDecayStage = Number.isFinite(options.decayStage)
    ? Math.max(1, Math.min(4, Math.round(options.decayStage)))
    : 1;
  const createdYear = Number.isInteger(options.createdYear) ? options.createdYear : state.year;
  const createdDayOfYear = Number.isInteger(options.createdDayOfYear)
    ? options.createdDayOfYear
    : state.dayOfYear;

  tile.deadLog = {
    sourceSpeciesId: plant.speciesId,
    sizeAtDeath,
    decayStage: normalizedDecayStage,
    createdYear,
    createdDayOfYear,
    fungi: [],
  };
}

function rollInitialDeadLogDecayStage(rng) {
  const roll = rng();
  if (roll < 0.18) {
    return 1;
  }
  if (roll < 0.52) {
    return 2;
  }
  if (roll < 0.88) {
    return 3;
  }
  return 4;
}

function countAdjacentDeadLogs(state, x, y) {
  let count = 0;
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }
      const nx = x + ox;
      const ny = y + oy;
      if (!inBounds(nx, ny, state.width, state.height)) {
        continue;
      }
      const neighbor = state.tiles[tileIndex(nx, ny, state.width)];
      if (neighbor?.deadLog) {
        count += 1;
      }
    }
  }
  return count;
}

function generateInitialDeadTrees(state, rng) {
  const candidates = [];
  for (const plant of Object.values(state.plants)) {
    if (!plant?.alive) {
      continue;
    }

    const species = PLANT_BY_ID[plant.speciesId];
    if (!species || species.longevity !== 'perennial') {
      continue;
    }
    if (lifeStageSize(species, plant.stageName) <= 7) {
      continue;
    }

    const tile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
    if (!tile || tile.waterType || tile.deadLog || isRockTile(tile)) {
      continue;
    }

    candidates.push({ plant, tile, shuffle: rng() });
  }

  if (candidates.length === 0) {
    return;
  }

  candidates.sort((a, b) => a.shuffle - b.shuffle);
  let convertedCount = 0;

  for (const candidate of candidates) {
    const { plant, tile } = candidate;
    if (!plant.alive || tile.deadLog) {
      continue;
    }

    const moisture = Number(tile.moisture) || 0;
    let baseChance = 0.05;
    if (moisture >= 0.72) {
      baseChance = 0.09;
    } else if (moisture <= 0.3) {
      baseChance = 0.03;
    }

    const adjacentDeadCount = countAdjacentDeadLogs(state, tile.x, tile.y);
    const chance = clamp01(baseChance + adjacentDeadCount * 0.05);
    if (rng() > chance) {
      continue;
    }

    plant.alive = false;
    maybeCreateDeadLog(state, plant, {
      decayStage: rollInitialDeadLogDecayStage(rng),
      createdYear: state.year,
      createdDayOfYear: state.dayOfYear,
    });
    convertedCount += 1;
  }

  if (convertedCount === 0) {
    const fallback = candidates.reduce((best, candidate) => {
      if (!best) {
        return candidate;
      }
      return candidate.tile.moisture > best.tile.moisture ? candidate : best;
    }, null);

    if (fallback?.plant?.alive) {
      fallback.plant.alive = false;
      maybeCreateDeadLog(state, fallback.plant, {
        decayStage: rollInitialDeadLogDecayStage(rng),
        createdYear: state.year,
        createdDayOfYear: state.dayOfYear,
      });
    }
  }

  cleanupDeadPlants(state);
}

function advanceDeadLogDecayByYear(state) {
  function applyDeadLogDecayFertilityBonus(originX, originY) {
    for (let oy = -1; oy <= 1; oy += 1) {
      for (let ox = -1; ox <= 1; ox += 1) {
        const nx = originX + ox;
        const ny = originY + oy;
        if (!inBounds(nx, ny, state.width, state.height)) {
          continue;
        }

        const bonus = ox === 0 && oy === 0
          ? DEAD_LOG_DECAY_FERTILITY_BONUS_CENTER
          : DEAD_LOG_DECAY_FERTILITY_BONUS_ADJACENT;
        const tile = state.tiles[tileIndex(nx, ny, state.width)];
        if (!tile || tile.waterType) {
          continue;
        }

        tile.fertility = clamp01((Number(tile.fertility) || 0) + bonus);
        const soilSuitability = calculateSoilSuitability(tile);
        tile.avgSoilMatch = soilSuitability.avgSoilMatch;
        tile.maxSoilMatch = soilSuitability.maxSoilMatch;
      }
    }
  }

  colonizeDeadLogFungiByYear(state, mulberry32((state.seed + state.year + 1) * 97));

  for (const tile of state.tiles) {
    if (!tile?.deadLog) {
      continue;
    }

    const createdYear = Number.isInteger(tile.deadLog.createdYear) ? tile.deadLog.createdYear : null;
    if (createdYear !== null && createdYear >= state.year) {
      continue;
    }

    const currentStage = Number.isFinite(tile.deadLog.decayStage) ? tile.deadLog.decayStage : 1;
    if (currentStage >= 4) {
      applyDeadLogDecayFertilityBonus(tile.x, tile.y);
      tile.deadLog = null;
      tile.disturbed = true;
      continue;
    }

    tile.deadLog.decayStage = Math.max(1, Math.min(4, Math.round(currentStage + 1)));
    applyDeadLogDecayFertilityBonus(tile.x, tile.y);
  }
}

function placeFounders(state, rng) {
  const mapArea = state.width * state.height;
  const areaScale = mapArea / (DEFAULT_MAP_WIDTH * DEFAULT_MAP_HEIGHT);
  const speciesByCanopySize = [...PLANT_CATALOG].sort((a, b) => maxLifeStageSize(b) - maxLifeStageSize(a));

  for (const species of speciesByCanopySize) {
    const candidates = [];

    for (const tile of state.tiles) {
      if (tile.waterType || isRockTile(tile) || tile.plantIds.length >= MAX_PLANTS_PER_TILE) {
        continue;
      }

      if (!isPlantWithinEnvironmentalTolerance(species, tile)) {
        continue;
      }

      candidates.push(tile);
    }

    const placementPool = candidates;

    if (placementPool.length === 0) {
      continue;
    }

    const baseFounderCount = species.id === 'juglans_nigra' ? 28 : 45;
    const founderCount = Math.max(6, Math.floor(baseFounderCount * areaScale));

    for (let i = 0; i < founderCount; i += 1) {
      const tile = placementPool[Math.floor(rng() * placementPool.length)];
      if (tile.plantIds.length >= MAX_PLANTS_PER_TILE) {
        continue;
      }
      if (tile.deadLog) {
        continue;
      }

      const age = species.id === 'juglans_nigra'
        ? 360 + Math.floor(rng() * 30)
        : Math.floor(rng() * (species.ageOfMaturity + 4));

      addPlantInstance(state, species.id, tile.x, tile.y, age);
    }

    recalculateDynamicShade(state);
  }
}

function addDormantSeedToTile(tile, speciesId, amount = 1) {
  if (amount <= 0) {
    return;
  }
  tile.dormantSeeds[speciesId] = { ageDays: 0 };
}

function seasonalWindowLength(window) {
  if (!window) {
    return 40;
  }

  const { startDay, endDay } = window;
  if (!Number.isInteger(startDay) || !Number.isInteger(endDay)) {
    return 40;
  }

  if (endDay >= startDay) {
    return Math.max(1, endDay - startDay + 1);
  }

  return Math.max(1, (40 - startDay + 1) + endDay);
}

function recordDispersalEvent(state, x, y, method, amount = 1) {
  if (!state.recentDispersal || amount <= 0) {
    return;
  }

  const key = `${x},${y}`;
  const tileEvent = state.recentDispersal.byTile[key] || {
    x,
    y,
    total: 0,
    methods: {},
  };

  tileEvent.total += amount;
  tileEvent.methods[method] = (tileEvent.methods[method] || 0) + amount;
  state.recentDispersal.byTile[key] = tileEvent;
  state.recentDispersal.totalsByMethod[method] = (state.recentDispersal.totalsByMethod[method] || 0) + amount;
}

function radialTarget(originX, originY, radius, rng, angleOverride = null, nearWeighted = false) {
  const safeRadius = Math.max(1, Math.floor(radius));
  const angle = Number.isFinite(angleOverride) ? angleOverride : rng() * Math.PI * 2;
  const distanceRoll = nearWeighted ? rng() ** 2 : rng();
  const distance = Math.max(1, Math.ceil(distanceRoll * safeRadius));
  return {
    x: originX + Math.round(Math.cos(angle) * distance),
    y: originY + Math.round(Math.sin(angle) * distance),
  };
}

function nearestAdjacentWaterTile(state, x, y) {
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }
      const nx = x + ox;
      const ny = y + oy;
      if (!inBounds(nx, ny, state.width, state.height)) {
        continue;
      }
      const tile = state.tiles[tileIndex(nx, ny, state.width)];
      if (!tile.waterType) {
        continue;
      }
      const distance = Math.abs(ox) + Math.abs(oy);
      if (distance < bestDistance) {
        best = { x: nx, y: ny };
        bestDistance = distance;
      }
    }
  }

  return best;
}

function downstreamWaterStep(state, current, rng) {
  const options = [];
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }
      const nx = current.x + ox;
      const ny = current.y + oy;
      if (!inBounds(nx, ny, state.width, state.height)) {
        continue;
      }
      const tile = state.tiles[tileIndex(nx, ny, state.width)];
      if (!tile.waterType) {
        continue;
      }
      options.push({ x: nx, y: ny, flowScore: ny - current.y });
    }
  }

  if (options.length === 0) {
    return null;
  }

  const downstream = options.filter((option) => option.flowScore > 0);
  const pool = downstream.length > 0 ? downstream : options;
  return pool[Math.floor(rng() * pool.length)];
}

function nearestLandNeighbor(state, x, y) {
  const candidates = [];
  for (let oy = -1; oy <= 1; oy += 1) {
    for (let ox = -1; ox <= 1; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }
      const nx = x + ox;
      const ny = y + oy;
      if (!inBounds(nx, ny, state.width, state.height)) {
        continue;
      }
      const tile = state.tiles[tileIndex(nx, ny, state.width)];
      if (tile.waterType || isRockTile(tile)) {
        continue;
      }
      candidates.push({ x: nx, y: ny, distance: Math.abs(ox) + Math.abs(oy) });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return { x: candidates[0].x, y: candidates[0].y };
}

function depositWaterDispersedSeed(state, species, sourceX, sourceY, rng, methodLabel = 'water') {
  const startWater = nearestAdjacentWaterTile(state, sourceX, sourceY);
  if (!startWater) {
    return false;
  }

  const maxSteps = 1 + Math.floor((rng() ** 2) * 29);
  let current = startWater;
  for (let step = 0; step < maxSteps; step += 1) {
    const next = downstreamWaterStep(state, current, rng);
    if (!next) {
      break;
    }
    current = next;
    if (current.y === 0 || current.y === state.height - 1 || current.x === 0 || current.x === state.width - 1) {
      return false;
    }
  }

  const bank = nearestLandNeighbor(state, current.x, current.y);
  if (!bank) {
    return false;
  }

  const tile = state.tiles[tileIndex(bank.x, bank.y, state.width)];
  if (tile.waterType || isRockTile(tile)) {
    return false;
  }
  addDormantSeedToTile(tile, species.id, 1);
  recordDispersalEvent(state, bank.x, bank.y, methodLabel, 1);
  return true;
}

function placeDormantSeed(state, species, x, y, methodLabel = species.dispersal.method) {
  if (!inBounds(x, y, state.width, state.height)) {
    return false;
  }
  const tile = state.tiles[tileIndex(x, y, state.width)];
  if (isTileBlockedForPlantLife(tile)) {
    return false;
  }
  addDormantSeedToTile(tile, species.id, 1);
  recordDispersalEvent(state, x, y, methodLabel, 1);
  return true;
}

function applyRunnerSpread(state, plantInstance, species, rng) {
  const maxColonizations = Math.max(1, Math.floor(species.dispersal.base_radius_tiles * plantInstance.vitality));
  const radius = Math.max(1, species.dispersal.base_radius_tiles);
  const candidates = [];

  for (let oy = -radius; oy <= radius; oy += 1) {
    for (let ox = -radius; ox <= radius; ox += 1) {
      if (ox === 0 && oy === 0) {
        continue;
      }
      const tx = plantInstance.x + ox;
      const ty = plantInstance.y + oy;
      if (!inBounds(tx, ty, state.width, state.height)) {
        continue;
      }
      if (Math.abs(ox) + Math.abs(oy) > radius) {
        continue;
      }
      candidates.push({ x: tx, y: ty, shuffle: rng() });
    }
  }

  candidates.sort((a, b) => a.shuffle - b.shuffle);

  let colonized = 0;
  for (const candidate of candidates) {
    if (colonized >= maxColonizations) {
      break;
    }
    const tile = state.tiles[tileIndex(candidate.x, candidate.y, state.width)];
    if (isTileBlockedForPlantLife(tile) || tile.plantIds.length >= MAX_PLANTS_PER_TILE) {
      continue;
    }
    if (!isPlantWithinEnvironmentalTolerance(species, tile)) {
      continue;
    }
    if (addPlantInstance(state, species.id, candidate.x, candidate.y, 0, 'runner')) {
      recordDispersalEvent(state, candidate.x, candidate.y, 'runner', 1);
      colonized += 1;
    }
  }
}

function disperseSeeds(state, plantInstance, species, rng) {
  if (!species.seedingWindow || !isDayInWindow(state.dayOfYear, species.seedingWindow)) {
    return;
  }

  if (plantInstance.age < species.ageOfMaturity) {
    return;
  }

  if (species.dispersal.method === 'runner') {
    applyRunnerSpread(state, plantInstance, species, rng);
    return;
  }

  const [minSeeds, maxSeeds] = species.dispersal.seeds_per_mature_plant;
  const annualSeedRoll = minSeeds + Math.floor(rng() * Math.max(1, maxSeeds - minSeeds + 1));
  const seedingDays = seasonalWindowLength(species.seedingWindow);
  const seedsToDrop = Math.max(
    1,
    Math.round((annualSeedRoll / seedingDays) * Math.max(0.1, plantInstance.vitality)),
  );
  const baseRadius = Math.max(1, species.dispersal.base_radius_tiles || 1);
  const windBonus = Math.max(0, species.dispersal.wind_radius_bonus || 0);
  const windStrength = Number(state.dailyWindVector?.strength) || 0;
  const windLabel = windStrengthLabel(windStrength);
  const highWind = windLabel === 'high' || windLabel === 'very_high';
  const windAngle = Number.isFinite(Number(state.dailyWindVector?.angleRadians))
    ? Number(state.dailyWindVector.angleRadians)
    : (rng() * Math.PI * 2);

  if (species.dispersal.method === 'animal_cached') {
    let remaining = seedsToDrop;
    while (remaining > 0) {
      const cacheRadius = Math.max(2, Math.floor(baseRadius * (0.55 + rng() * 0.55)));
      const cacheCenter = radialTarget(plantInstance.x, plantInstance.y, cacheRadius, rng, null, true);
      const clusterSize = Math.min(remaining, 3 + Math.floor(rng() * 6));
      remaining -= clusterSize;

      for (let i = 0; i < clusterSize; i += 1) {
        const deposit = radialTarget(cacheCenter.x, cacheCenter.y, 2, rng, null, true);
        if (!placeDormantSeed(state, species, deposit.x, deposit.y, 'animal_cached') && species.dispersal.water_dispersed) {
          depositWaterDispersedSeed(state, species, plantInstance.x, plantInstance.y, rng, 'animal_cached');
        }
      }
    }
    return;
  }

  for (let i = 0; i < seedsToDrop; i += 1) {
    let deposited = false;
    const prefersWater = species.dispersal.method === 'water'
      || (species.dispersal.water_dispersed && rng() < 0.2);
    if (prefersWater) {
      deposited = depositWaterDispersedSeed(state, species, plantInstance.x, plantInstance.y, rng, species.dispersal.method);
      if (species.dispersal.method === 'water' && deposited) {
        continue;
      }
    }

    let target;
    if (species.dispersal.method === 'explosive') {
      const explosiveRadius = 2 + Math.floor(rng() * 3);
      target = radialTarget(plantInstance.x, plantInstance.y, explosiveRadius, rng);
    } else if (species.dispersal.method === 'animal_eaten' || (species.dispersal.animal_dispersed && rng() < 0.15)) {
      target = radialTarget(plantInstance.x, plantInstance.y, Math.max(2, Math.floor(baseRadius * 1.4)), rng);
    } else if (species.dispersal.method === 'wind') {
      const radius = baseRadius + windBonus + (highWind ? windBonus : 0);
      const angle = windAngle + (rng() - 0.5) * (Math.PI / 2);
      target = radialTarget(plantInstance.x, plantInstance.y, radius, rng, angle);
    } else {
      const radius = baseRadius + (highWind ? windBonus : 0);
      target = radialTarget(plantInstance.x, plantInstance.y, radius, rng, null, true);
    }

    if (!placeDormantSeed(state, species, target.x, target.y, species.dispersal.method)
      && !deposited
      && species.dispersal.water_dispersed) {
      depositWaterDispersedSeed(state, species, plantInstance.x, plantInstance.y, rng, species.dispersal.method);
    }
  }
}

function updatePlantLife(state, plantInstance, rng) {
  return updatePlantLifeImpl(state, plantInstance, rng, {
    PLANT_BY_ID,
    stageForDay,
    maxLifeStageMinAge,
    maxLifecycleYearOrdinal,
    lifecycleYearOrdinal,
    getSeason,
    PERENNIAL_WINTER_DAILY_DEATH_RATE,
    buildActiveSubStages,
    advanceActiveSubStageRegrowth,
    disperseSeeds,
  });
}

export function applyHarvestAction(state, plantId, partName, subStageId, options = {}) {
  return applyHarvestActionImpl(state, plantId, partName, subStageId, options, {
    PLANT_BY_ID,
    findPartAndSubStage,
    ensureHarvestEntryState,
    perActionVitalityDamage,
    clamp01,
  });
}

function processDormantSeeds(state, rng) {
  return processDormantSeedsImpl(state, rng, {
    getSeason,
    isRockTile,
    PLANT_BY_ID,
    MAX_PLANTS_PER_TILE,
    isPlantWithinEnvironmentalTolerance,
    computeSoilMatch,
    findOpenSpot,
    tileIndex,
    isTileBlockedForPlantLife,
    addPlantInstance,
  });
}

function cleanupDeadPlants(state) {
  return cleanupDeadPlantsImpl(state, {
    maybeCreateDeadLog,
    tileIndex,
  });
}

function reconcilePlantOccupancy(state) {
  return reconcilePlantOccupancyImpl(state, {
    isRockTile,
    MAX_PLANTS_PER_TILE,
    inBounds,
    tileIndex,
  });
}

export function createInitialGameState(seed = 10000, options = {}) {
  const normalizedSeed = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 10000;
  const width = Math.max(20, Math.min(300, Number.parseInt(options.width ?? DEFAULT_MAP_WIDTH, 10)));
  const height = Math.max(20, Math.min(300, Number.parseInt(options.height ?? DEFAULT_MAP_HEIGHT, 10)));
  const tiles = generateMap(normalizedSeed, width, height);
  const actors = defaultActors(width, height);
  const camp = defaultCampState(width, height);
  const state = {
    seed: normalizedSeed,
    width,
    height,
    dayOfYear: 5,
    year: 1,
    totalDaysSimulated: 0,
    tiles,
    plants: {},
    nextPlantNumericId: 1,
    recentDispersal: createEmptyRecentDispersal(5),
    runFungusPool: LOG_FUNGUS_CATALOG.map((fungus) => fungus.id),
    runGroundFungusPool: [],
    groundFungusZonesGenerated: false,
    beehivesGenerated: false,
    squirrelCachesGenerated: false,
    runSquirrelCacheNutPool: [],
    animalZonesGenerated: false,
    animalZoneGrid: null,
    animalDensityByZone: {},
    fishPopulationsGenerated: false,
    fishDensityByTile: {},
    fishEquilibriumByTile: {},
    fishWaterBodyByTile: {},
    fishWaterBodies: {},
    weatherTemperatureVarianceF: 0,
    weatherWindAngleRadians: 0,
    weatherWindStrength: 0,
    dailyTemperatureF: 0,
    dailyTemperatureBand: 'mild',
    dailyWindVector: { x: 0, y: 0, strength: 0, strengthLabel: 'calm', angleRadians: 0 },
    consecutiveFreezingDays: 0,
    dayTick: 0,
    actors,
    worldItemsByTile: {},
    camp,
    pendingActionQueue: [],
    currentDayActionLog: [],
  };

  placeFounders(state, mulberry32(normalizedSeed * 17 + 9));
  generateInitialDeadTrees(state, mulberry32(normalizedSeed * 29 + 13));
  recalculateDynamicShade(state);
  initializeDailyWeatherState(state);
  applyDailyWaterFreezeState(state);
  return state;
}

export function advanceDay(state, steps = 1) {
  return advanceDayImpl(state, steps, {
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
    applyDailyWaterFreezeState,
    reconcilePlantOccupancy,
    updatePlantLife,
    cleanupDeadPlants,
    recalculateDynamicShade,
    applyEnvironmentalVitality,
    processDormantSeeds,
    applyLogFungusFruiting,
    applyGroundFungusFruiting,
    applyBeehiveSeasonalState,
    applyFishPopulationRecovery,
    applyDailyItemDecay,
    applyDailySapTapFill,
    applyDailyLeachingBasketProgress,
    applyDailySimpleSnareResolution,
    applyDailyDeadfallTrapResolution,
    applyDailyFishTrapResolution,
    applyDailyAutoRodResolution,
    rollDailyWeatherForCurrentDay,
    advanceDeadLogDecayByYear,
    refillSquirrelCachesByYear,
  });
}

export function countDormantSeeds(state) {
  let total = 0;
  for (const tile of state.tiles) {
    for (const entry of Object.values(tile.dormantSeeds)) {
      if (entry && Number.isFinite(entry.ageDays)) {
        total += 1;
      }
    }
  }
  return total;
}

export function gatherSpeciesCounts(state) {
  const counts = {};

  for (const species of PLANT_CATALOG) {
    counts[species.id] = 0;
  }

  for (const plant of Object.values(state.plants)) {
    counts[plant.speciesId] += 1;
  }

  return counts;
}

export function getTileAt(state, x, y) {
  if (!inBounds(x, y, state.width, state.height)) {
    return null;
  }
  return state.tiles[tileIndex(x, y, state.width)];
}

export function getNatureSightOverlayOptions() {
  return [...NATURE_SIGHT_OVERLAY_OPTIONS];
}

export function getNatureSightOverlayData(state, options = {}) {
  const actorId = typeof options?.actorId === 'string' ? options.actorId : 'player';
  const actor = state?.actors?.[actorId] || null;
  const sightRemaining = Number.isInteger(actor?.natureSightDaysRemaining)
    ? actor.natureSightDaysRemaining
    : Math.floor(Number(actor?.natureSightDaysRemaining || 0));
  if (sightRemaining <= 0) {
    return {
      active: false,
      overlay: null,
      valuesByTile: {},
      minValue: 0,
      maxValue: 0,
      selectedPlantSpeciesId: null,
      selectedAnimalSpeciesId: null,
      selectedFishSpeciesId: null,
    };
  }

  const requestedOverlay = typeof options?.overlay === 'string' ? options.overlay.trim().toLowerCase() : '';
  const actorOverlay = typeof actor?.natureSightOverlayChoice === 'string'
    ? actor.natureSightOverlayChoice.trim().toLowerCase()
    : '';
  const overlay = NATURE_SIGHT_OVERLAY_OPTION_SET.has(requestedOverlay)
    ? requestedOverlay
    : NATURE_SIGHT_OVERLAY_OPTION_SET.has(actorOverlay)
      ? actorOverlay
      : 'calorie_heatmap';

  const selectedPlantSpeciesIdRaw = typeof options?.selectedPlantSpeciesId === 'string'
    ? options.selectedPlantSpeciesId
    : typeof options?.selectedSpeciesId === 'string'
      ? options.selectedSpeciesId
    : typeof actor?.natureSightPlantSpeciesId === 'string'
      ? actor.natureSightPlantSpeciesId
      : PLANT_CATALOG[0]?.id || null;
  const selectedPlantSpeciesId = typeof selectedPlantSpeciesIdRaw === 'string' && PLANT_BY_ID[selectedPlantSpeciesIdRaw]
    ? selectedPlantSpeciesIdRaw
    : null;
  const selectedAnimalSpeciesIdRaw = typeof options?.selectedAnimalSpeciesId === 'string'
    ? options.selectedAnimalSpeciesId
    : typeof actor?.natureSightAnimalSpeciesId === 'string'
      ? actor.natureSightAnimalSpeciesId
      : resolveDefaultAnimalSpeciesId();
  const selectedAnimalSpeciesId = typeof selectedAnimalSpeciesIdRaw === 'string' && ANIMAL_BY_ID[selectedAnimalSpeciesIdRaw]
    ? selectedAnimalSpeciesIdRaw
    : resolveDefaultAnimalSpeciesId();
  const selectedFishSpeciesIdRaw = typeof options?.selectedFishSpeciesId === 'string'
    ? options.selectedFishSpeciesId
    : typeof actor?.natureSightFishSpeciesId === 'string'
      ? actor.natureSightFishSpeciesId
      : resolveDefaultFishSpeciesId();
  const selectedFishSpeciesId = typeof selectedFishSpeciesIdRaw === 'string' && ANIMAL_BY_ID[selectedFishSpeciesIdRaw]
    ? selectedFishSpeciesIdRaw
    : resolveDefaultFishSpeciesId();

  const valuesByTile = {};
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;
  for (const tile of state?.tiles || []) {
    const tileKey = `${tile.x},${tile.y}`;
    const value = computeNatureSightOverlayValue(state, tile, overlay, {
      selectedPlantSpeciesId,
      selectedAnimalSpeciesId,
      selectedFishSpeciesId,
    });
    const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
    valuesByTile[tileKey] = normalized;
    minValue = Math.min(minValue, normalized);
    maxValue = Math.max(maxValue, normalized);
  }

  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    minValue = 0;
    maxValue = 0;
  }

  return {
    active: true,
    overlay,
    valuesByTile,
    minValue,
    maxValue,
    selectedPlantSpeciesId,
    selectedAnimalSpeciesId,
    selectedFishSpeciesId,
  };
}

function computeNatureSightOverlayValue(state, tile, overlay, selections) {
  if (!tile || !overlay) {
    return 0;
  }
  if (overlay === 'calorie_heatmap') {
    return estimateTileCalories(state, tile);
  }
  if (overlay === 'animal_density') {
    return estimateTileAnimalDensity(state, tile, selections?.selectedAnimalSpeciesId);
  }
  if (overlay === 'mushroom_zones') {
    return estimateTileMushroomZoneSignal(tile);
  }
  if (overlay === 'plant_compatibility') {
    return estimateTilePlantCompatibility(tile, selections?.selectedPlantSpeciesId);
  }
  if (overlay === 'fishing_hotspots') {
    return estimateTileFishingHotspot(state, tile, selections?.selectedFishSpeciesId);
  }
  return 0;
}

function estimateTileCalories(state, tile) {
  let total = 0;
  total += estimateTilePlantCalories(state, tile);
  total += estimateTileGroundFungusCalories(tile);
  total += estimateTileBeehiveCalories(tile);
  total += estimateTileSquirrelCacheCalories(tile);
  total += estimateTileTrapCalories(tile, state);
  return total;
}

function estimateTilePlantCalories(state, tile) {
  const plantIds = Array.isArray(tile?.plantIds) ? tile.plantIds : [];
  let total = 0;
  for (const plantId of plantIds) {
    const plant = state?.plants?.[plantId];
    if (!plant || plant.alive === false) {
      continue;
    }
    const species = PLANT_BY_ID[plant.speciesId] || null;
    if (!species) {
      continue;
    }
    for (const active of Array.isArray(plant.activeSubStages) ? plant.activeSubStages : []) {
      const part = (species.parts || []).find((entry) => entry?.name === active?.partName) || null;
      const subStage = (part?.subStages || []).find((entry) => entry?.id === active?.subStageId) || null;
      if (!subStage) {
        continue;
      }
      const calories = Number(subStage?.nutrition?.calories);
      if (!Number.isFinite(calories) || calories <= 0) {
        continue;
      }
      ensureHarvestEntryState(active, subStage, plant, species);
      const unitsPerAction = scaledUnitsPerHarvestActionMidpoint(subStage, species, plant);
      const remainingActions = Number.isFinite(Number(active?.remainingActions))
        ? Math.max(0, Math.floor(Number(active.remainingActions)))
        : 0;
      if (remainingActions <= 0) {
        continue;
      }
      total += calories * unitsPerAction * remainingActions;
    }
  }
  return total;
}

function estimateTileGroundFungusCalories(tile) {
  const grams = Number(tile?.groundFungusZone?.yieldCurrentGrams);
  if (!Number.isFinite(grams) || grams <= 0) {
    return 0;
  }
  return grams * FUNGUS_CALORIES_PER_GRAM_ESTIMATE;
}

function estimateTileBeehiveCalories(tile) {
  const honey = Number(tile?.beehive?.yieldCurrentHoneyGrams);
  const larvae = Number(tile?.beehive?.yieldCurrentLarvaeGrams);
  const honeyCalories = Number.isFinite(honey) && honey > 0 ? honey * HONEY_CALORIES_PER_GRAM_ESTIMATE : 0;
  const larvaeCalories = Number.isFinite(larvae) && larvae > 0 ? larvae * LARVAE_CALORIES_PER_GRAM_ESTIMATE : 0;
  return honeyCalories + larvaeCalories;
}

function estimateTileSquirrelCacheCalories(tile) {
  const grams = Number(tile?.squirrelCache?.nutContentGrams);
  if (!Number.isFinite(grams) || grams <= 0) {
    return 0;
  }
  return grams * NUT_CALORIES_PER_GRAM_ESTIMATE;
}

function estimateTileTrapCalories(tile, state) {
  let calories = 0;
  if (tile?.simpleSnare?.hasCatch === true) {
    calories += estimateAnimalCarcassCalories('sylvilagus_floridanus');
  } else if (tile?.simpleSnare?.active === true) {
    const density = Number(tile?.simpleSnare?.rabbitDensity);
    calories += Number.isFinite(density) ? Math.max(0, density) * 120 : 0;
  }
  if (tile?.deadfallTrap?.hasCatch === true) {
    calories += estimateAnimalCarcassCalories(tile?.deadfallTrap?.caughtSpeciesId);
  } else if (tile?.deadfallTrap?.active === true) {
    const density = Number(tile?.deadfallTrap?.lastDensity);
    calories += Number.isFinite(density) ? Math.max(0, density) * 150 : 0;
  }
  const fishStored = Array.isArray(tile?.fishTrap?.storedCatchSpeciesIds)
    ? tile.fishTrap.storedCatchSpeciesIds
    : [];
  for (const speciesId of fishStored) {
    calories += estimateAnimalCarcassCalories(speciesId);
  }
  if (fishStored.length <= 0 && tile?.fishTrap?.active === true) {
    calories += estimateTileFishingHotspot(state, tile, resolveDefaultFishSpeciesId()) * 120;
  }
  if (tile?.autoRod?.state === 'triggered_catch' && tile?.autoRod?.lastSpeciesId) {
    calories += estimateAnimalCarcassCalories(tile.autoRod.lastSpeciesId);
  }
  return calories;
}

function estimateAnimalCarcassCalories(speciesId) {
  if (typeof speciesId !== 'string' || !speciesId) {
    return 0;
  }
  const species = ANIMAL_BY_ID[speciesId] || null;
  const meatPart = (species?.parts || []).find((entry) => entry?.id === 'meat') || null;
  if (!meatPart) {
    return 0;
  }
  const calories = Number(meatPart?.nutrition?.calories);
  if (!Number.isFinite(calories) || calories <= 0) {
    return 0;
  }
  const yieldGrams = Number(meatPart?.yield_grams || meatPart?.yieldGrams || 100);
  const normalizedYield = Number.isFinite(yieldGrams) && yieldGrams > 0 ? (yieldGrams / 100) : 1;
  return calories * normalizedYield;
}

function estimateTileAnimalDensity(state, tile, speciesId) {
  if (typeof speciesId !== 'string' || !speciesId) {
    return 0;
  }
  const tileKey = `${tile.x},${tile.y}`;
  const density = Number(state?.animalDensityByZone?.[speciesId]?.[tileKey]);
  return Number.isFinite(density) ? Math.max(0, Math.min(1, density)) : 0;
}

function estimateTileMushroomZoneSignal(tile) {
  if (!tile?.groundFungusZone) {
    return 0;
  }
  const yieldCurrent = Number(tile.groundFungusZone.yieldCurrentGrams);
  if (!Number.isFinite(yieldCurrent) || yieldCurrent <= 0) {
    return 0.35;
  }
  return Math.min(1, 0.35 + (yieldCurrent / 100));
}

function estimateTilePlantCompatibility(tile, selectedSpeciesId) {
  if (!selectedSpeciesId) {
    return 0;
  }
  const species = PLANT_BY_ID[selectedSpeciesId] || null;
  if (!species || !tile || tile.waterType || isRockTile(tile)) {
    return 0;
  }
  const match = Number(computeSoilMatch(species, tile));
  return Number.isFinite(match) ? Math.max(0, Math.min(1, match)) : 0;
}

function estimateTileFishingHotspot(state, tile, speciesId) {
  if (typeof speciesId !== 'string' || !speciesId) {
    return 0;
  }
  const tileKey = `${tile.x},${tile.y}`;
  const density = Number(state?.fishDensityByTile?.[speciesId]?.[tileKey]);
  return Number.isFinite(density) ? Math.max(0, Math.min(1, density)) : 0;
}

function resolveDefaultAnimalSpeciesId() {
  for (const species of Object.values(ANIMAL_BY_ID || {})) {
    const animalClass = typeof species?.animalClass === 'string' ? species.animalClass : species?.animal_class;
    if (animalClass && animalClass !== 'fish' && typeof species?.id === 'string') {
      return species.id;
    }
  }
  return null;
}

function resolveDefaultFishSpeciesId() {
  for (const species of Object.values(ANIMAL_BY_ID || {})) {
    const animalClass = typeof species?.animalClass === 'string' ? species.animalClass : species?.animal_class;
    if (animalClass === 'fish' && typeof species?.id === 'string') {
      return species.id;
    }
  }
  return null;
}

export function getMetrics(state) {
  return {
    year: state.year,
    dayOfYear: state.dayOfYear,
    totalDaysSimulated: state.totalDaysSimulated,
    dailyTemperatureF: Number(state.dailyTemperatureF) || 0,
    dailyTemperatureBand: typeof state.dailyTemperatureBand === 'string' ? state.dailyTemperatureBand : 'mild',
    dailyWindVector: state.dailyWindVector
      ? { ...state.dailyWindVector }
      : { x: 0, y: 0, strength: 0, strengthLabel: 'calm', angleRadians: 0 },
    totalPlants: Object.keys(state.plants).length,
    totalDormantSeeds: countDormantSeeds(state),
    speciesCounts: gatherSpeciesCounts(state),
  };
}
export function serializeGameState(state) {
  return serializeSnapshotState(state);
}

export function deserializeGameState(input) {
  return deserializeSnapshotState(input, { maxPlantsPerTile: MAX_PLANTS_PER_TILE });
}

export function canGenerateMushroomZones(state) {
  return canGenerateGroundFungusZones(state);
}

export function canGenerateBeehives(state) {
  return canGenerateBeehivesInternal(state);
}

export function canGenerateSquirrelCaches(state) {
  return canGenerateSquirrelCachesInternal(state);
}

export function getGroundFungusById(id) {
  return GROUND_FUNGUS_BY_ID[id] || null;
}

export function simulateDays(seed, totalDays) {
  let state = createInitialGameState(seed);
  for (let i = 0; i < totalDays; i += 1) {
    state = advanceDay(state, 1);
  }
  return state;
}
