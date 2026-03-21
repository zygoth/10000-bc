import { PLANT_BY_ID, PLANT_CATALOG, getSeason, isDayInWindow } from './plantCatalog.mjs';
import { GROUND_FUNGUS_CATALOG, GROUND_FUNGUS_BY_ID, isDayInSeasonWindow } from './groundFungusCatalog.mjs';
import { LOG_FUNGUS_CATALOG, LOG_FUNGUS_BY_ID, isDayInLogWindow } from './logFungusCatalog.mjs';
import { ANIMAL_BY_ID } from './animalCatalog.mjs';
import { applyEnvironmentalVitality, recalculateDynamicShade } from './simEcology.mjs';
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

const DEFAULT_MAP_WIDTH = 80;
const DEFAULT_MAP_HEIGHT = 80;
const MAX_PLANTS_PER_TILE = 1;
const WINTER_DAYS_PER_YEAR = 10;
const PERENNIAL_ANNUAL_OLD_AGE_DEATH_RATE = 0.05;
const PERENNIAL_WINTER_DAILY_DEATH_RATE = 1 - Math.pow(
  1 - PERENNIAL_ANNUAL_OLD_AGE_DEATH_RATE,
  1 / WINTER_DAYS_PER_YEAR,
);
const DEAD_LOG_DECAY_FERTILITY_BONUS_CENTER = 0.06;
const DEAD_LOG_DECAY_FERTILITY_BONUS_ADJACENT = 0.03;
const MIN_DAYS_FOR_GROUND_FUNGUS_ZONE_GENERATION = 400;
const MIN_DAYS_FOR_BEEHIVE_GENERATION = 400;
const MIN_DAYS_FOR_SQUIRREL_CACHE_GENERATION = 400;
const MIN_DAYS_FOR_ANIMAL_ZONE_GENERATION = 400;
const MIN_DAYS_FOR_FISH_POPULATION_GENERATION = 0;
const FISH_DAILY_RECOVERY_RATIO = 0.07;
const FISH_DENSITY_VARIATION_MIN = 0.8;
const FISH_DENSITY_VARIATION_MAX = 1.2;
const FISH_LARGE_SCALE_CELL_SIZE = 8;
const FISH_LARGE_SCALE_WEIGHT = 0.65;
const MAX_LOG_FUNGI_PER_LOG = 3;
const ANIMAL_DENSITY_RADIUS_TILES = 5;
const ROTTING_ORGANIC_ITEM_ID = 'rotting_organic';
const ROTTING_ORGANIC_DECAY_DAYS = 2;
const ROTTING_ORGANIC_FERTILITY_BONUS = 0.02;
const RAISED_SLEEPING_PLATFORM_STATION_ID = 'raised_sleeping_platform';
const WINDBREAK_REFLECTOR_WALL_STATION_ID = 'windbreak_reflector_wall';
const CAMP_COMFORT_STATION_IDS = new Set([
  RAISED_SLEEPING_PLATFORM_STATION_ID,
  WINDBREAK_REFLECTOR_WALL_STATION_ID,
]);
const BEEHIVE_SPECIES_ID = 'bombus_pennsylvanicus_colony';
const BEEHIVE_HONEY_RANGE_GRAMS = [50, 200];
const BEEHIVE_LARVAE_RANGE_GRAMS = [50, 150];
const BEEHIVE_BEESWAX_RANGE_GRAMS = [20, 60];
const SAP_TAP_DAILY_FILL_UNITS = 1;
const SAP_TAP_VESSEL_CAPACITY_UNITS = 10;
const SAP_FILLED_VESSEL_ITEM_ID = 'tool:hide_pitch_vessel_filled_sap';
const EARTHWORM_ITEM_ID = 'earthworm';
const EARTHWORM_DECAY_DAYS = 1;
const SIMPLE_SNARE_BASE_CATCH_CHANCE = 0.1;
const SIMPLE_SNARE_RABBIT_DENSITY_WEIGHT = 0.55;
const SIMPLE_SNARE_DAILY_RELIABILITY_DECAY = 0.08;
const SIMPLE_SNARE_MIN_RELIABILITY = 0.35;
const SIMPLE_SNARE_POACH_DAY_1_CHANCE = 0;
const SIMPLE_SNARE_POACH_DAY_2_CHANCE = 0.2;
const SIMPLE_SNARE_POACH_DAY_3_CHANCE = 0.5;
const SIMPLE_SNARE_POACH_DAY_4_PLUS_CHANCE = 1;
const DEADFALL_MAX_CATCH_WEIGHT_G = 4000;
const DEADFALL_TRAP_CATCH_MODIFIER = 1.4;
const DEADFALL_DAILY_RELIABILITY_DECAY = 0.04;
const DEADFALL_MIN_RELIABILITY = 0.5;
const FISH_TRAP_ATTEMPTS_PER_DAY = 2;
const FISH_TRAP_MAX_STORED_CATCH = 3;
const FISH_TRAP_DAILY_RELIABILITY_DECAY = 0.03;
const FISH_TRAP_MIN_RELIABILITY = 0.55;
const AUTO_ROD_ATTRACTION_MULTIPLIER = 0.5;
const AUTO_ROD_OVERNIGHT_ATTEMPTS = 200;
const LINE_SNAP_BASE_PROBABILITY = 0.1;
const LINE_SNAP_BASE_WEIGHT_G = 500;
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

function hasActorInventoryItem(actor, itemId, quantity = 1) {
  const normalizedQty = Math.max(1, Math.floor(Number(quantity) || 1));
  const stacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : [];
  return stacks.some((stack) => (
    stack?.itemId === itemId
    && Math.floor(Number(stack?.quantity) || 0) >= normalizedQty
  ));
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
  if (!state || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return {
      consumed: 0,
      freshness: null,
      decayDaysRemaining: null,
      dryness: null,
      unitWeightKg: null,
      footprintW: 1,
      footprintH: 1,
    };
  }

  const key = worldItemTileKey(x, y);
  const stacks = Array.isArray(state?.worldItemsByTile?.[key]) ? state.worldItemsByTile[key] : [];
  const stack = findPreferredStackByItem(stacks, itemId, quantity);
  if (!stack) {
    return {
      consumed: 0,
      freshness: null,
      decayDaysRemaining: null,
      dryness: null,
      unitWeightKg: null,
      footprintW: 1,
      footprintH: 1,
    };
  }

  const requested = Math.max(1, Math.floor(quantity));
  const available = Math.max(0, Math.floor(Number(stack.quantity) || 0));
  const consumed = Math.min(requested, available);
  if (consumed <= 0) {
    return {
      consumed: 0,
      freshness: null,
      decayDaysRemaining: null,
      dryness: null,
      unitWeightKg: null,
      footprintW: 1,
      footprintH: 1,
    };
  }

  const freshness = Number.isFinite(Number(stack.freshness)) ? Number(stack.freshness) : null;
  const decayDaysRemaining = Number.isFinite(Number(stack.decayDaysRemaining))
    ? Number(stack.decayDaysRemaining)
    : null;
  const dryness = Number.isFinite(Number(stack.dryness)) ? Number(stack.dryness) : null;
  const unitWeightKg = Number.isFinite(Number(stack.unitWeightKg)) ? Number(stack.unitWeightKg) : null;
  const footprintW = normalizeStackFootprintValue(stack.footprintW);
  const footprintH = normalizeStackFootprintValue(stack.footprintH);

  stack.quantity = available - consumed;
  const nextStacks = stacks.filter((entry) => (Number(entry?.quantity) || 0) > 0);
  if (nextStacks.length > 0) {
    state.worldItemsByTile[key] = nextStacks;
  } else if (state?.worldItemsByTile && typeof state.worldItemsByTile === 'object') {
    delete state.worldItemsByTile[key];
  }

  return {
    consumed,
    freshness,
    decayDaysRemaining,
    dryness,
    unitWeightKg,
    footprintW,
    footprintH,
  };
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
// Baseline fraction of eligible tiles that can become caches (before density bonus).
const SQUIRREL_CACHE_BASE_COVERAGE = 0.0028;
// Additional coverage scaled by squirrel-density signal.
const SQUIRREL_CACHE_DENSITY_BONUS_COVERAGE = 0.009;
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

const YEAR_LENGTH_DAYS = 40;
const TEMPERATURE_MIN_F = 15;
const TEMPERATURE_MAX_F = 88;
const TEMPERATURE_VARIANCE_MIN_F = -6;
const TEMPERATURE_VARIANCE_MAX_F = 6;


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
    const effectiveChance = clamp01(baseCatchRate * density * DEADFALL_TRAP_CATCH_MODIFIER * reliability);
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

function applyDailyDeadfallTrapResolution(state) {
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

function rollFishTrapCatch(state, tile, trap, attemptOrdinal) {
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

function applyDailyFishTrapResolution(state) {
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

function selectSquirrelCacheCandidatesWithSpread(candidates, targetCount) {
  if (!Array.isArray(candidates) || candidates.length === 0 || targetCount <= 0) {
    return [];
  }

  const pool = candidates.map((entry) => ({
    ...entry,
    adjustedScore: Number(entry.score) || 0,
  }));
  const selected = [];

  while (selected.length < targetCount && pool.length > 0) {
    let bestIndex = 0;
    let bestScore = pool[0].adjustedScore;
    for (let i = 1; i < pool.length; i += 1) {
      if (pool[i].adjustedScore > bestScore) {
        bestScore = pool[i].adjustedScore;
        bestIndex = i;
      }
    }

    const chosen = pool[bestIndex];
    selected.push(chosen);
    pool.splice(bestIndex, 1);

    for (const candidate of pool) {
      const dx = candidate.tile.x - chosen.tile.x;
      const dy = candidate.tile.y - chosen.tile.y;
      const distance = Math.sqrt((dx * dx) + (dy * dy));
      if (distance <= SQUIRREL_CACHE_SPREAD_RADIUS_NEAR) {
        candidate.adjustedScore *= SQUIRREL_CACHE_SPREAD_NEAR_FACTOR;
      } else if (distance <= SQUIRREL_CACHE_SPREAD_RADIUS_MID) {
        candidate.adjustedScore *= SQUIRREL_CACHE_SPREAD_MID_FACTOR;
      }
    }
  }

  return selected;
}

function resolveSquirrelCacheItemPool(state) {
  const preferred = ['juglans_nigra', 'carya_ovata', 'quercus_alba', 'fagus_grandifolia', 'corylus_americana'];
  const items = [];

  for (const species of PLANT_CATALOG) {
    for (const part of species?.parts || []) {
      for (const subStage of part?.subStages || []) {
        if (subStage?.can_squirrel_cache !== true) {
          continue;
        }
        items.push({
          speciesId: species.id,
          partName: part.name,
          subStageId: subStage.id,
        });
      }
    }
  }

  if (items.length === 0) {
    return [];
  }

  const preferredSet = new Set(preferred);
  const preferredItems = items.filter((item) => preferredSet.has(item.speciesId));
  if (preferredItems.length > 0) {
    return preferredItems;
  }

  return items;
}

function rollBeehiveYieldForDay(state, tile, range, salt) {
  const seed = (
    ((state.seed + 1) * 1000003)
    + (state.year * 9176)
    + (state.dayOfYear * 131)
    + (tile.x * 37)
    + (tile.y * 73)
    + salt
  ) >>> 0;
  const rng = mulberry32(seed);
  return rangeRollIntRandom(range, rng, Math.round((range[0] + range[1]) / 2));
}

function applyBeehiveSeasonalState(state) {
  const seasonMultiplier = beehiveSeasonModifier(state.dayOfYear);

  for (const tile of state.tiles || []) {
    if (!tile?.beehive) {
      continue;
    }

    if (seasonMultiplier <= 0) {
      tile.beehive.active = false;
      tile.beehive.yieldCurrentHoneyGrams = 0;
      tile.beehive.yieldCurrentLarvaeGrams = 0;
      tile.beehive.yieldCurrentBeeswaxGrams = 0;
      continue;
    }

    tile.beehive.active = true;
    tile.beehive.yieldCurrentHoneyGrams = Math.max(
      1,
      Math.round(rollBeehiveYieldForDay(state, tile, BEEHIVE_HONEY_RANGE_GRAMS, 11) * seasonMultiplier),
    );
    tile.beehive.yieldCurrentLarvaeGrams = Math.max(
      1,
      Math.round(rollBeehiveYieldForDay(state, tile, BEEHIVE_LARVAE_RANGE_GRAMS, 23) * seasonMultiplier),
    );
    tile.beehive.yieldCurrentBeeswaxGrams = Math.max(
      1,
      Math.round(rollBeehiveYieldForDay(state, tile, BEEHIVE_BEESWAX_RANGE_GRAMS, 41) * seasonMultiplier),
    );
  }
}

function refillSquirrelCachesByYear(state) {
  if (!state?.squirrelCachesGenerated) {
    return;
  }

  const rng = mulberry32((state.seed + state.year + 1) * 79);
  generateSquirrelCachesInternal(state, rng, { regenerate: true });
}

function buildSquirrelDensityByTile(state) {
  const existingDensity = state?.animalDensityByZone?.sciurus_carolinensis;
  if (existingDensity && typeof existingDensity === 'object' && Object.keys(existingDensity).length > 0) {
    return existingDensity;
  }

  const alivePlants = [];
  for (const plant of Object.values(state.plants || {})) {
    if (!plant?.alive) {
      continue;
    }
    const species = PLANT_BY_ID[plant.speciesId];
    if (!species) {
      continue;
    }
    alivePlants.push({
      plant,
      species,
      size: lifeStageSize(species, plant.stageName),
    });
  }

  const rawByTile = {};
  let maxRaw = 0;

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType || isRockTile(tile)) {
      continue;
    }

    const tileKey = animalTileDensityKey(tile.x, tile.y);
    let support = 0;
    for (const { plant, species, size } of alivePlants) {
      const dx = plant.x - tile.x;
      const dy = plant.y - tile.y;
      const distance = Math.sqrt((dx * dx) + (dy * dy));
      const weight = distanceFalloffWeight(distance, ANIMAL_DENSITY_RADIUS_TILES);
      if (weight <= 0) {
        continue;
      }
      const contribution = computeAnimalPlantContribution('sciurus_carolinensis', plant, species, size);
      if (contribution <= 0) {
        continue;
      }
      support += contribution * weight;
    }
    rawByTile[tileKey] = support;
    maxRaw = Math.max(maxRaw, support);
  }

  const squirrel = ANIMAL_BY_ID.sciurus_carolinensis;
  const baseDensity = clamp01(Number(squirrel?.population?.startingDensity) || 0);
  const densityByTile = {};

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType || isRockTile(tile)) {
      continue;
    }
    const tileKey = animalTileDensityKey(tile.x, tile.y);
    const raw = Number(rawByTile[tileKey] || 0);
    const normalizedSupport = maxRaw > 0 ? raw / maxRaw : 0;
    densityByTile[tileKey] = clamp01(baseDensity * 0.2 + normalizedSupport * 0.8);
  }

  return densityByTile;
}

function computeSquirrelCacheTargetCount(state, squirrelDensityByTile, totalCandidateCount) {
  let densitySum = 0;
  let densityPeak = 0;
  let densitySamples = 0;

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType || isRockTile(tile)) {
      continue;
    }
    const tileKey = animalTileDensityKey(tile.x, tile.y);
    const density = clamp01(Number(squirrelDensityByTile[tileKey]) || 0);
    densitySum += density;
    densityPeak = Math.max(densityPeak, density);
    densitySamples += 1;
  }

  const avgDensity = densitySamples > 0 ? densitySum / densitySamples : 0;
  const densitySignal = clamp01(avgDensity * 0.62 + densityPeak * 0.38);
  const coverage = SQUIRREL_CACHE_BASE_COVERAGE + (SQUIRREL_CACHE_DENSITY_BONUS_COVERAGE * densitySignal);
  const desiredCount = Math.round(totalCandidateCount * coverage);
  return Math.max(1, Math.min(totalCandidateCount, desiredCount));
}

function clearSquirrelCaches(state) {
  for (const tile of state.tiles || []) {
    if (tile?.squirrelCache) {
      tile.squirrelCache = null;
    }
  }
}

function normalizeDayOfYear(dayOfYear) {
  const value = Number(dayOfYear);
  if (!Number.isFinite(value)) {
    return 1;
  }
  const normalized = Math.floor(value);
  if (normalized < 1) {
    return 1;
  }
  if (normalized > YEAR_LENGTH_DAYS) {
    return YEAR_LENGTH_DAYS;
  }
  return normalized;
}

function normalizeAngleRadians(radians) {
  const value = Number(radians);
  if (!Number.isFinite(value)) {
    return 0;
  }
  const fullTurn = Math.PI * 2;
  const normalized = value % fullTurn;
  return normalized < 0 ? normalized + fullTurn : normalized;
}

function temperatureBandFromFahrenheit(temperatureF) {
  if (temperatureF < 25) {
    return 'freezing';
  }
  if (temperatureF <= 40) {
    return 'cold';
  }
  if (temperatureF <= 55) {
    return 'cool';
  }
  if (temperatureF <= 75) {
    return 'mild';
  }
  if (temperatureF <= 85) {
    return 'warm';
  }
  return 'hot';
}

function windStrengthLabel(strength) {
  if (strength < 0.2) {
    return 'calm';
  }
  if (strength < 0.4) {
    return 'low';
  }
  if (strength < 0.65) {
    return 'medium';
  }
  if (strength < 0.82) {
    return 'high';
  }
  return 'very_high';
}

function seasonalTemperatureBaselineF(dayOfYear) {
  const day = normalizeDayOfYear(dayOfYear);
  const midpoint = (TEMPERATURE_MIN_F + TEMPERATURE_MAX_F) / 2;
  const amplitude = (TEMPERATURE_MAX_F - TEMPERATURE_MIN_F) / 2;
  const radians = ((day - 15) / YEAR_LENGTH_DAYS) * Math.PI * 2;
  return midpoint + (Math.cos(radians) * amplitude);
}

function seasonalWindStrengthBaseline(dayOfYear) {
  const season = getSeason(normalizeDayOfYear(dayOfYear));
  switch (season) {
    case 'spring':
      return 0.62;
    case 'summer':
      return 0.38;
    case 'fall':
      return 0.52;
    case 'winter':
    default:
      return 0.58;
  }
}

function buildWindVector(angleRadians, strength) {
  const normalizedAngle = normalizeAngleRadians(angleRadians);
  const normalizedStrength = clamp01(Number(strength) || 0);
  const x = Number((Math.cos(normalizedAngle) * normalizedStrength).toFixed(4));
  const y = Number((Math.sin(normalizedAngle) * normalizedStrength).toFixed(4));
  return {
    x,
    y,
    strength: Number(normalizedStrength.toFixed(4)),
    strengthLabel: windStrengthLabel(normalizedStrength),
    angleRadians: Number(normalizedAngle.toFixed(4)),
  };
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

function applyDailyWeatherState(state, weatherState) {
  state.weatherTemperatureVarianceF = weatherState.weatherTemperatureVarianceF;
  state.weatherWindAngleRadians = weatherState.weatherWindAngleRadians;
  state.weatherWindStrength = weatherState.weatherWindStrength;
  state.dailyTemperatureF = weatherState.dailyTemperatureF;
  state.dailyTemperatureBand = weatherState.dailyTemperatureBand;
  state.dailyWindVector = weatherState.dailyWindVector;
}

function buildWeatherForDay(dayOfYear, varianceOffsetF, windAngleRadians, windStrength) {
  const normalizedVariance = Math.max(
    TEMPERATURE_VARIANCE_MIN_F,
    Math.min(TEMPERATURE_VARIANCE_MAX_F, Number(varianceOffsetF) || 0),
  );
  const baseline = seasonalTemperatureBaselineF(dayOfYear);
  const dailyTemperatureF = baseline + normalizedVariance;
  const roundedDailyTemperatureF = Number(dailyTemperatureF.toFixed(1));
  return {
    weatherTemperatureVarianceF: Number(normalizedVariance.toFixed(2)),
    weatherWindAngleRadians: Number(normalizeAngleRadians(windAngleRadians).toFixed(4)),
    weatherWindStrength: Number(clamp01(Number(windStrength) || 0).toFixed(4)),
    dailyTemperatureF: roundedDailyTemperatureF,
    dailyTemperatureBand: temperatureBandFromFahrenheit(roundedDailyTemperatureF),
    dailyWindVector: buildWindVector(windAngleRadians, windStrength),
  };
}

function initializeDailyWeatherState(state) {
  const rng = mulberry32(state.seed * 97 + 19);
  const baselineStrength = seasonalWindStrengthBaseline(state.dayOfYear);
  const varianceOffsetF = (rng() - 0.5) * 4;
  const windAngleRadians = rng() * Math.PI * 2;
  const windStrength = clamp01(baselineStrength + ((rng() - 0.5) * 0.2));
  const weather = buildWeatherForDay(state.dayOfYear, varianceOffsetF, windAngleRadians, windStrength);
  applyDailyWeatherState(state, weather);
}

function rollDailyWeatherForCurrentDay(state, rng) {
  const currentVariance = Number.isFinite(Number(state.weatherTemperatureVarianceF))
    ? Number(state.weatherTemperatureVarianceF)
    : 0;
  const varianceDrift = (rng() - 0.5) * 6;
  const nextVariance = Math.max(
    TEMPERATURE_VARIANCE_MIN_F,
    Math.min(TEMPERATURE_VARIANCE_MAX_F, currentVariance + varianceDrift),
  );

  const currentAngle = Number.isFinite(Number(state.weatherWindAngleRadians))
    ? Number(state.weatherWindAngleRadians)
    : rng() * Math.PI * 2;
  const nextAngle = normalizeAngleRadians(currentAngle + ((rng() - 0.5) * (Math.PI / 2)));

  const baselineStrength = seasonalWindStrengthBaseline(state.dayOfYear);
  const currentStrength = Number.isFinite(Number(state.weatherWindStrength))
    ? Number(state.weatherWindStrength)
    : baselineStrength;
  const nextStrength = clamp01((currentStrength * 0.55) + (baselineStrength * 0.45) + ((rng() - 0.5) * 0.24));

  const weather = buildWeatherForDay(state.dayOfYear, nextVariance, nextAngle, nextStrength);
  applyDailyWeatherState(state, weather);
}

function ensureDailyWeatherState(state) {
  if (
    Number.isFinite(Number(state?.dailyTemperatureF))
    && typeof state?.dailyTemperatureBand === 'string'
    && state?.dailyWindVector
  ) {
    return;
  }
  initializeDailyWeatherState(state);
}

function isStillWaterType(waterType) {
  return waterType === 'pond';
}

function applyDailyWaterFreezeState(state) {
  const band = typeof state?.dailyTemperatureBand === 'string'
    ? state.dailyTemperatureBand.toLowerCase()
    : 'mild';
  const previousStreak = Number.isFinite(Number(state?.consecutiveFreezingDays))
    ? Math.max(0, Math.floor(Number(state.consecutiveFreezingDays)))
    : 0;
  const freezingStreak = band === 'freezing' ? previousStreak + 1 : 0;
  state.consecutiveFreezingDays = freezingStreak;

  for (const tile of state.tiles || []) {
    if (!tile?.waterType) {
      tile.waterFrozen = false;
      continue;
    }

    if (!isStillWaterType(tile.waterType)) {
      tile.waterFrozen = false;
      continue;
    }

    tile.waterFrozen = freezingStreak >= 2;
  }
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

function canGenerateSquirrelCachesInternal(state) {
  if (state?.squirrelCachesGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_SQUIRREL_CACHE_GENERATION;
}

function cloneAnimalDensityByZone(input) {
  const cloned = {};
  for (const [speciesId, byZone] of Object.entries(input || {})) {
    cloned[speciesId] = { ...(byZone || {}) };
  }
  return cloned;
}

function cloneFishDensityByTile(input) {
  const cloned = {};
  for (const [speciesId, byTile] of Object.entries(input || {})) {
    cloned[speciesId] = { ...(byTile || {}) };
  }
  return cloned;
}

function cloneStringArray(input) {
  return Array.isArray(input) ? [...input] : [];
}

function cloneWorldItemsByTile(input) {
  const cloned = {};
  for (const [tileKey, stacks] of Object.entries(input || {})) {
    cloned[tileKey] = Array.isArray(stacks)
      ? stacks.map((entry) => ({ ...(entry || {}) }))
      : [];
  }
  return cloned;
}

function cloneCampState(camp, fallbackX = 0, fallbackY = 0) {
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
    dryingRack: {
      capacity: 4,
      slots: [],
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

  return {
    taskId,
    kind,
    ticksRequired,
    ticksRemaining,
    outputs,
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
  if (!camp || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return;
  }

  if (!camp.stockpile || !Array.isArray(camp.stockpile.stacks)) {
    camp.stockpile = { stacks: [] };
  }

  const qty = Math.max(1, Math.floor(quantity));
  const incomingFreshness = Number(options?.freshness);
  const incomingDecayDaysRemaining = Number(options?.decayDaysRemaining);
  const incomingDryness = Number(options?.dryness);
  const incomingUnitWeightKg = Number(options?.unitWeightKg);
  const incomingFootprintW = normalizeStackFootprintValue(options?.footprintW);
  const incomingFootprintH = normalizeStackFootprintValue(options?.footprintH);
  const existing = findCompatibleStackForAutoMerge(camp.stockpile.stacks, itemId, incomingDryness);
  if (existing) {
    const priorQty = Math.max(0, Math.floor(Number(existing.quantity) || 0));
    existing.quantity = priorQty + qty;

    if (Number.isFinite(incomingFreshness)) {
      const priorFreshness = Number(existing.freshness);
      existing.freshness = Number.isFinite(priorFreshness)
        ? ((priorFreshness * priorQty) + (incomingFreshness * qty)) / Math.max(1, priorQty + qty)
        : incomingFreshness;
    }
    if (Number.isFinite(incomingDecayDaysRemaining) && incomingDecayDaysRemaining >= 0) {
      const priorDecayDaysRemaining = Number(existing.decayDaysRemaining);
      existing.decayDaysRemaining = Number.isFinite(priorDecayDaysRemaining) && priorDecayDaysRemaining >= 0
        ? ((priorDecayDaysRemaining * priorQty) + (incomingDecayDaysRemaining * qty)) / Math.max(1, priorQty + qty)
        : incomingDecayDaysRemaining;
    }
    if (Number.isFinite(incomingDryness)) {
      const priorDryness = Number(existing.dryness);
      existing.dryness = Number.isFinite(priorDryness)
        ? clamp01(((priorDryness * priorQty) + (incomingDryness * qty)) / Math.max(1, priorQty + qty))
        : clamp01(incomingDryness);
    }
    if (Number.isFinite(incomingUnitWeightKg) && incomingUnitWeightKg >= 0) {
      const priorUnitWeightKg = Number(existing.unitWeightKg);
      if (!Number.isFinite(priorUnitWeightKg) || priorUnitWeightKg < 0) {
        existing.unitWeightKg = incomingUnitWeightKg;
      }
    }
    existing.footprintW = normalizeStackFootprintValue(existing.footprintW || incomingFootprintW);
    existing.footprintH = normalizeStackFootprintValue(existing.footprintH || incomingFootprintH);
    return;
  }

  const nextStack = {
    itemId,
    quantity: qty,
  };
  if (Number.isFinite(incomingFreshness)) {
    nextStack.freshness = incomingFreshness;
  }
  if (Number.isFinite(incomingDecayDaysRemaining) && incomingDecayDaysRemaining >= 0) {
    nextStack.decayDaysRemaining = incomingDecayDaysRemaining;
  }
  if (Number.isFinite(incomingDryness)) {
    nextStack.dryness = clamp01(incomingDryness);
  }
  if (Number.isFinite(incomingUnitWeightKg) && incomingUnitWeightKg >= 0) {
    nextStack.unitWeightKg = incomingUnitWeightKg;
  }
  nextStack.footprintW = incomingFootprintW;
  nextStack.footprintH = incomingFootprintH;

  camp.stockpile.stacks.push(nextStack);
}

function removeCampStockpileItem(camp, itemId, quantity) {
  if (!camp || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return { consumed: 0, freshness: null, decayDaysRemaining: null, dryness: null };
  }

  const stacks = Array.isArray(camp?.stockpile?.stacks) ? camp.stockpile.stacks : [];
  const stack = findPreferredStackByItem(stacks, itemId, quantity);
  if (!stack) {
    return { consumed: 0, freshness: null, decayDaysRemaining: null, dryness: null };
  }

  const qty = Math.max(1, Math.floor(quantity));
  const available = Math.max(0, Math.floor(Number(stack.quantity) || 0));
  const consumed = Math.min(available, qty);
  if (consumed <= 0) {
    return { consumed: 0, freshness: null, decayDaysRemaining: null, dryness: null };
  }

  const freshness = Number.isFinite(Number(stack.freshness)) ? Number(stack.freshness) : null;
  const decayDaysRemaining = Number.isFinite(Number(stack.decayDaysRemaining))
    ? Number(stack.decayDaysRemaining)
    : null;
  const dryness = Number.isFinite(Number(stack.dryness))
    ? clamp01(Number(stack.dryness))
    : null;
  const unitWeightKg = Number.isFinite(Number(stack.unitWeightKg)) ? Number(stack.unitWeightKg) : null;
  const footprintW = normalizeStackFootprintValue(stack.footprintW);
  const footprintH = normalizeStackFootprintValue(stack.footprintH);

  stack.quantity = available - consumed;
  camp.stockpile.stacks = stacks.filter((entry) => (Number(entry?.quantity) || 0) > 0);
  return {
    consumed,
    freshness,
    decayDaysRemaining,
    dryness,
    unitWeightKg,
    footprintW,
    footprintH,
  };
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

function ensureActorInventory(actor) {
  if (!actor.inventory || typeof actor.inventory !== 'object') {
    actor.inventory = {
      gridWidth: 6,
      gridHeight: 4,
      maxCarryWeightKg: 15,
      stacks: [],
    };
    return;
  }

  if (!Array.isArray(actor.inventory.stacks)) {
    actor.inventory.stacks = [];
  }
}

function normalizeStackFootprintValue(value) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  const parsed = Math.floor(Number(value || 1));
  return Math.max(1, parsed);
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

function mergeStackMetadata(existing, priorQty, addedQty, incomingFreshness, incomingDecayDaysRemaining, incomingUnitWeightKg, incomingDryness) {
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

  const priorUnitWeightKg = Number(existing.unitWeightKg);
  if (Number.isFinite(priorUnitWeightKg) && priorUnitWeightKg >= 0) {
    return;
  }
  if (Number.isFinite(incomingUnitWeightKg) && incomingUnitWeightKg >= 0) {
    existing.unitWeightKg = incomingUnitWeightKg;
  }
}

function worldItemTileKey(x, y) {
  return `${x},${y}`;
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

function nearbyDropPositions(originX, originY, maxRadius = 3) {
  const positions = [];
  for (let radius = 0; radius <= maxRadius; radius += 1) {
    for (let y = originY - radius; y <= originY + radius; y += 1) {
      for (let x = originX - radius; x <= originX + radius; x += 1) {
        if (radius > 0 && Math.max(Math.abs(x - originX), Math.abs(y - originY)) !== radius) {
          continue;
        }
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

function addWorldItemNearby(state, originX, originY, itemId, quantity, options = null) {
  if (!state || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  if (!state.worldItemsByTile || typeof state.worldItemsByTile !== 'object') {
    state.worldItemsByTile = {};
  }

  const qty = Math.max(1, Math.floor(quantity));
  const incomingFreshness = Number(options?.freshness);
  const incomingDecayDaysRemaining = Number(options?.decayDaysRemaining);
  const incomingUnitWeightKg = Number(options?.unitWeightKg);
  const incomingDryness = Number(options?.dryness);
  const incomingFootprintW = normalizeStackFootprintValue(options?.footprintW);
  const incomingFootprintH = normalizeStackFootprintValue(options?.footprintH);
  const positions = nearbyDropPositions(originX, originY, 3);

  for (const { x, y } of positions) {
    if (!inBounds(x, y, state.width, state.height)) {
      continue;
    }

    const tile = state.tiles[tileIndex(x, y, state.width)];
    if (!tile || tile.waterType || isRockTile(tile)) {
      continue;
    }

    const key = worldItemTileKey(x, y);
    const stacks = Array.isArray(state.worldItemsByTile[key]) ? state.worldItemsByTile[key] : [];

    if (stacks.length === 0) {
      const nextStack = { itemId, quantity: qty, footprintW: incomingFootprintW, footprintH: incomingFootprintH };
      if (Number.isFinite(incomingFreshness)) {
        nextStack.freshness = incomingFreshness;
      }
      if (Number.isFinite(incomingDecayDaysRemaining) && incomingDecayDaysRemaining >= 0) {
        nextStack.decayDaysRemaining = incomingDecayDaysRemaining;
      }
      if (Number.isFinite(incomingUnitWeightKg) && incomingUnitWeightKg >= 0) {
        nextStack.unitWeightKg = incomingUnitWeightKg;
      }
      if (Number.isFinite(incomingDryness)) {
        nextStack.dryness = clamp01(incomingDryness);
      }
      state.worldItemsByTile[key] = [nextStack];
      return qty;
    }

    if (stacks.length === 1 && stacks[0]?.itemId === itemId) {
      const existing = stacks[0];
      const existingDryness = Number.isFinite(Number(existing.dryness)) ? Number(existing.dryness) : null;
      const incomingDrynessNormalized = Number.isFinite(incomingDryness) ? clamp01(incomingDryness) : null;
      const drynessCompatible =
        (existingDryness === null && incomingDrynessNormalized === null) ||
        (existingDryness !== null && incomingDrynessNormalized !== null && Math.abs(existingDryness - incomingDrynessNormalized) < 1e-6);
      if (!drynessCompatible) {
        continue;
      }
      const priorQty = Math.max(0, Math.floor(Number(existing.quantity) || 0));
      existing.quantity = priorQty + qty;
      existing.footprintW = normalizeStackFootprintValue(existing.footprintW || incomingFootprintW);
      existing.footprintH = normalizeStackFootprintValue(existing.footprintH || incomingFootprintH);
      mergeStackMetadata(
        existing,
        priorQty,
        qty,
        incomingFreshness,
        incomingDecayDaysRemaining,
        incomingUnitWeightKg,
        incomingDryness,
      );
      state.worldItemsByTile[key] = [existing];
      return qty;
    }
  }

  return 0;
}

function addActorInventoryItemWithOverflowDrop(state, actor, itemId, quantity, options = null) {
  const result = addActorInventoryItem(actor, itemId, quantity, options);
  const overflowQuantity = Math.max(0, Math.floor(Number(result?.overflowQuantity) || 0));
  if (overflowQuantity <= 0) {
    return {
      addedQuantity: Math.max(0, Math.floor(Number(result?.addedQuantity) || 0)),
      overflowQuantity: 0,
      droppedQuantity: 0,
    };
  }

  const originX = Number.isInteger(actor?.x) ? actor.x : 0;
  const originY = Number.isInteger(actor?.y) ? actor.y : 0;
  const droppedQuantity = addWorldItemNearby(state, originX, originY, itemId, overflowQuantity, options);
  return {
    addedQuantity: Math.max(0, Math.floor(Number(result?.addedQuantity) || 0)),
    overflowQuantity: Math.max(0, overflowQuantity - droppedQuantity),
    droppedQuantity,
  };
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

function rollSimpleSnareCatch(state, tile, snare) {
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
  const effectiveChance = clamp01(baseChance * reliability);
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

function applyDailySimpleSnareResolution(state) {
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

function addActorInventoryItem(actor, itemId, quantity, options = null) {
  if (!actor || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return { addedQuantity: 0, overflowQuantity: Math.max(0, Math.floor(Number(quantity) || 0)) };
  }

  ensureActorInventory(actor);
  const qtyRequested = Math.max(1, Math.floor(quantity));
  const unitWeightKg = getStackUnitWeightKg(options, 0);
  const maxByWeight = maxQuantityByCarryWeight(actor.inventory, unitWeightKg);
  const qty = Math.min(qtyRequested, Number.isFinite(maxByWeight) ? maxByWeight : qtyRequested);
  if (qty <= 0) {
    return { addedQuantity: 0, overflowQuantity: qtyRequested };
  }

  const incomingFreshness = Number(options?.freshness);
  const incomingDecayDaysRemaining = Number(options?.decayDaysRemaining);
  const incomingDryness = Number(options?.dryness);
  const incomingFootprintW = normalizeStackFootprintValue(options?.footprintW);
  const incomingFootprintH = normalizeStackFootprintValue(options?.footprintH);
  const existing = findCompatibleStackForAutoMerge(actor.inventory.stacks, itemId, incomingDryness);
  if (existing) {
    const priorQty = Math.max(0, Math.floor(Number(existing.quantity) || 0));
    existing.quantity = priorQty + qty;

    existing.footprintW = normalizeStackFootprintValue(existing.footprintW || incomingFootprintW);
    existing.footprintH = normalizeStackFootprintValue(existing.footprintH || incomingFootprintH);
    mergeStackMetadata(
      existing,
      priorQty,
      qty,
      incomingFreshness,
      incomingDecayDaysRemaining,
      unitWeightKg,
      incomingDryness,
    );
    return { addedQuantity: qty, overflowQuantity: qtyRequested - qty };
  }

  const { gridW, gridH } = inventoryGridDimensions(actor.inventory);
  if (incomingFootprintW > gridW || incomingFootprintH > gridH) {
    return { addedQuantity: 0, overflowQuantity: qtyRequested };
  }

  const currentLayout = normalizeCurrentInventoryLayout(actor.inventory.stacks, gridW, gridH);
  if (!currentLayout) {
    return { addedQuantity: 0, overflowQuantity: qtyRequested };
  }

  const placedRects = [];
  for (const placement of currentLayout.values()) {
    placedRects.push(placement);
  }
  const directPlacement = findFirstFreePlacement(placedRects, incomingFootprintW, incomingFootprintH, gridW, gridH);

  let incomingPlacement = directPlacement;
  if (!incomingPlacement) {
    const repacked = repackInventoryWithIncoming(
      actor.inventory.stacks,
      { itemId, footprintW: incomingFootprintW, footprintH: incomingFootprintH },
      gridW,
      gridH,
    );
    if (!repacked) {
      return { addedQuantity: 0, overflowQuantity: qtyRequested };
    }

    for (const [idx, placement] of repacked.placementsByExistingIndex.entries()) {
      const stack = actor.inventory.stacks[idx];
      if (!stack) {
        continue;
      }
      stack.slotX = placement.x;
      stack.slotY = placement.y;
      const footprint = getStackFootprint(stack);
      stack.footprintW = footprint.footprintW;
      stack.footprintH = footprint.footprintH;
    }
    incomingPlacement = repacked.incomingPlacement;
  } else {
    for (const [idx, placement] of currentLayout.entries()) {
      const stack = actor.inventory.stacks[idx];
      if (!stack) {
        continue;
      }
      const footprint = getStackFootprint(stack);
      stack.slotX = placement.x;
      stack.slotY = placement.y;
      stack.footprintW = footprint.footprintW;
      stack.footprintH = footprint.footprintH;
    }
  }

  const nextStack = {
    itemId,
    quantity: qty,
    footprintW: incomingFootprintW,
    footprintH: incomingFootprintH,
    slotX: incomingPlacement.x,
    slotY: incomingPlacement.y,
  };
  if (Number.isFinite(incomingFreshness)) {
    nextStack.freshness = incomingFreshness;
  }
  if (Number.isFinite(incomingDecayDaysRemaining) && incomingDecayDaysRemaining >= 0) {
    nextStack.decayDaysRemaining = incomingDecayDaysRemaining;
  }
  if (Number.isFinite(unitWeightKg) && unitWeightKg >= 0) {
    nextStack.unitWeightKg = unitWeightKg;
  }
  if (Number.isFinite(incomingDryness)) {
    nextStack.dryness = clamp01(incomingDryness);
  }

  actor.inventory.stacks.push(nextStack);
  return { addedQuantity: qty, overflowQuantity: qtyRequested - qty };
}

function removeActorInventoryItem(actor, itemId, quantity) {
  if (!actor || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  ensureActorInventory(actor);
  const qty = Math.max(1, Math.floor(quantity));
  const stack = findPreferredStackByItem(actor.inventory.stacks, itemId, quantity);
  if (!stack) {
    return 0;
  }

  const available = Math.max(0, Math.floor(Number(stack.quantity) || 0));
  const consumed = Math.min(available, qty);
  stack.quantity = available - consumed;
  actor.inventory.stacks = actor.inventory.stacks.filter((entry) => (Number(entry?.quantity) || 0) > 0);
  return consumed;
}

function ensureCampDryingRackState(camp) {
  if (!camp || typeof camp !== 'object') {
    return;
  }

  if (!camp.dryingRack || typeof camp.dryingRack !== 'object') {
    camp.dryingRack = { capacity: 4, slots: [] };
  }
  if (!Array.isArray(camp.dryingRack.slots)) {
    camp.dryingRack.slots = [];
  }
  camp.dryingRack.capacity = 4;
}

function addCampDryingRackItem(camp, itemId, quantity, options = null) {
  ensureCampDryingRackState(camp);
  if (!camp || !camp.dryingRack) {
    return { addedQuantity: 0, overflowQuantity: Math.max(0, Math.floor(Number(quantity) || 0)) };
  }

  const pseudoActor = {
    inventory: {
      gridWidth: 2,
      gridHeight: 2,
      maxCarryWeightKg: Number.POSITIVE_INFINITY,
      stacks: camp.dryingRack.slots.map((entry) => ({ ...(entry || {}) })),
    },
  };

  const result = addActorInventoryItem(pseudoActor, itemId, quantity, options);

  camp.dryingRack.slots = pseudoActor.inventory.stacks.map((entry) => ({ ...(entry || {}) }));
  return result;
}

function extractActorInventoryItemWithMetadata(actor, itemId, quantity) {
  const stack = Array.isArray(actor?.inventory?.stacks)
    ? findPreferredStackByItem(actor.inventory.stacks, itemId, quantity)
    : null;
  const available = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
  const requested = Math.max(1, Math.floor(Number(quantity) || 0));
  const consumedTarget = Math.min(available, requested);
  if (consumedTarget <= 0) {
    return null;
  }

  const consumed = removeActorInventoryItem(actor, itemId, consumedTarget);
  if (consumed <= 0) {
    return null;
  }

  return {
    itemId,
    quantity: consumed,
    freshness: Number.isFinite(Number(stack?.freshness)) ? Number(stack.freshness) : null,
    decayDaysRemaining: Number.isFinite(Number(stack?.decayDaysRemaining)) ? Number(stack.decayDaysRemaining) : null,
    dryness: Number.isFinite(Number(stack?.dryness)) ? Number(stack.dryness) : null,
    unitWeightKg: Number.isFinite(Number(stack?.unitWeightKg)) ? Number(stack.unitWeightKg) : null,
    footprintW: normalizeStackFootprintValue(stack?.footprintW),
    footprintH: normalizeStackFootprintValue(stack?.footprintH),
  };
}

function progressPartnerTaskQueueOneTick(state) {
  const queue = state?.camp?.partnerTaskQueue;
  if (!queue) {
    return;
  }

  if (!queue.active && Array.isArray(queue.queued) && queue.queued.length > 0) {
    queue.active = normalizePartnerTask(queue.queued.shift());
  }

  if (!queue.active) {
    mirrorPartnerTaskQueueToActor(state);
    return;
  }

  queue.active.ticksRemaining = Math.max(0, Math.floor(Number(queue.active.ticksRemaining || 0)) - 1);
  if (queue.active.ticksRemaining === 0) {
    completePartnerTaskOutputs(state, queue.active);
    queue.active = null;
    if (Array.isArray(queue.queued) && queue.queued.length > 0) {
      queue.active = normalizePartnerTask(queue.queued.shift());
    }
  }

  mirrorPartnerTaskQueueToActor(state);
}

function applyActionEffect(state, action) {
  const actor = state?.actors?.[action.actorId];
  if (!actor) {
    return;
  }

  if (action.kind === 'move') {
    const dx = Number(action.payload?.dx) || 0;
    const dy = Number(action.payload?.dy) || 0;
    actor.x += dx;
    actor.y += dy;
    return;
  }

  if (action.kind === 'item_pickup') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const requestedQty = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    if (!itemId || requestedQty <= 0) {
      return;
    }

    const extracted = removeWorldItemAtTile(state, targetX, targetY, itemId, requestedQty);
    if (extracted.consumed <= 0) {
      return;
    }

    addActorInventoryItemWithOverflowDrop(state, actor, itemId, extracted.consumed, {
      freshness: extracted.freshness,
      decayDaysRemaining: extracted.decayDaysRemaining,
      dryness: extracted.dryness,
      unitWeightKg: extracted.unitWeightKg,
      footprintW: extracted.footprintW,
      footprintH: extracted.footprintH,
    });

    actor.lastPickup = {
      x: targetX,
      y: targetY,
      itemId,
      quantity: extracted.consumed,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'item_drop') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const requestedQty = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    if (!itemId || requestedQty <= 0) {
      return;
    }

    const extracted = extractActorInventoryItemWithMetadata(actor, itemId, requestedQty);
    if (!extracted || extracted.quantity <= 0) {
      return;
    }

    addWorldItemNearby(state, targetX, targetY, itemId, extracted.quantity, {
      freshness: extracted.freshness,
      decayDaysRemaining: extracted.decayDaysRemaining,
      dryness: extracted.dryness,
      unitWeightKg: extracted.unitWeightKg,
      footprintW: extracted.footprintW,
      footprintH: extracted.footprintH,
    });

    actor.lastDrop = {
      x: targetX,
      y: targetY,
      itemId,
      quantity: extracted.quantity,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'inspect') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    const tile = inBounds(targetX, targetY, state.width, state.height)
      ? state.tiles[tileIndex(targetX, targetY, state.width)]
      : null;

    actor.lastInspection = {
      x: targetX,
      y: targetY,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
      hasPlant: Array.isArray(tile?.plantIds) ? tile.plantIds.length > 0 : false,
      waterType: tile?.waterType || null,
      rockType: tile?.rockType || null,
      disturbed: tile?.disturbed === true,
      moisture: Number.isFinite(Number(tile?.moisture)) ? Number(tile.moisture) : null,
      fertility: Number.isFinite(Number(tile?.fertility)) ? Number(tile.fertility) : null,
    };
    return;
  }

  if (action.kind === 'dig') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    const inDeepWater = tile?.waterType && tile.waterDepth !== 'shallow';
    if (!tile || inDeepWater || isRockTile(tile)) {
      return;
    }

    const discoveredSquirrelCache = tile?.squirrelCache && tile.squirrelCache.discovered !== true;
    if (discoveredSquirrelCache) {
      tile.squirrelCache.discovered = true;
    }

    tile.disturbed = true;
    const earthwormDrop = trySpawnEarthwormFromDig(state, actor, tile, targetX, targetY);
    actor.lastDig = {
      x: targetX,
      y: targetY,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
      interruptedBySquirrelCache: discoveredSquirrelCache,
      earthwormDrop: earthwormDrop ? {
        droppedQuantity: earthwormDrop.droppedQuantity,
        chance: Number(earthwormDrop.chance.toFixed(4)),
        roll: Number(earthwormDrop.roll.toFixed(4)),
      } : null,
    };
    return;
  }

  if (action.kind === 'hoe') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    const inDeepWater = tile?.waterType && tile.waterDepth !== 'shallow';
    if (!tile || inDeepWater || isRockTile(tile)) {
      return;
    }

    tile.disturbed = true;
    tile.dormantSeeds = {};
    return;
  }

  if (action.kind === 'eat') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const requestedQty = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    const consumedQty = removeActorInventoryItem(actor, itemId, requestedQty);
    if (consumedQty <= 0) {
      return;
    }

    const returnItems = Array.isArray(action.payload?.returnItems) ? action.payload.returnItems : [];
    const requestedNormalized = Math.max(1, requestedQty);
    for (const output of returnItems) {
      const outputItemId = typeof output?.itemId === 'string' ? output.itemId : '';
      if (!outputItemId) {
        continue;
      }

      const outputQtyBase = Number.isInteger(output?.quantity)
        ? output.quantity
        : Math.floor(Number(output?.quantity || 0));
      if (outputQtyBase <= 0) {
        continue;
      }

      const scaledOutputQty = Math.max(1, Math.floor((outputQtyBase * consumedQty) / requestedNormalized));
      addActorInventoryItemWithOverflowDrop(state, actor, outputItemId, scaledOutputQty, {
        freshness: Number(output?.freshness),
        decayDaysRemaining: Number(output?.decayDaysRemaining),
      });
    }

    actor.hunger = clamp01((Number(actor.hunger) || 0) + (0.05 * consumedQty));
    actor.thirst = clamp01((Number(actor.thirst) || 0) + (0.015 * consumedQty));
    actor.health = clamp01((Number(actor.health) || 0) + (0.02 * consumedQty));
    return;
  }

  if (action.kind === 'process_item') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const requestedQty = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    if (!itemId || requestedQty <= 0) {
      return;
    }

    const consumedQty = removeActorInventoryItem(actor, itemId, requestedQty);
    if (consumedQty <= 0) {
      return;
    }

    const outputs = Array.isArray(action.payload?.outputs) ? action.payload.outputs : [];
    const returnItems = Array.isArray(action.payload?.returnItems) ? action.payload.returnItems : [];
    const requestedNormalized = Math.max(1, requestedQty);
    for (const output of outputs) {
      const outputItemId = typeof output?.itemId === 'string' ? output.itemId : '';
      if (!outputItemId) {
        continue;
      }

      const outputQtyBase = Number.isInteger(output?.quantity)
        ? output.quantity
        : Math.floor(Number(output?.quantity || 0));
      if (outputQtyBase <= 0) {
        continue;
      }

      const scaledOutputQty = Math.max(1, Math.floor((outputQtyBase * consumedQty) / requestedNormalized));
      addActorInventoryItemWithOverflowDrop(state, actor, outputItemId, scaledOutputQty, {
        freshness: Number(output?.freshness),
        decayDaysRemaining: Number(output?.decayDaysRemaining),
      });
    }

    for (const output of returnItems) {
      const outputItemId = typeof output?.itemId === 'string' ? output.itemId : '';
      if (!outputItemId) {
        continue;
      }

      const outputQtyBase = Number.isInteger(output?.quantity)
        ? output.quantity
        : Math.floor(Number(output?.quantity || 0));
      if (outputQtyBase <= 0) {
        continue;
      }

      const scaledOutputQty = Math.max(1, Math.floor((outputQtyBase * consumedQty) / requestedNormalized));
      addActorInventoryItemWithOverflowDrop(state, actor, outputItemId, scaledOutputQty, {
        freshness: Number(output?.freshness),
        decayDaysRemaining: Number(output?.decayDaysRemaining),
      });
    }
    return;
  }

  if (action.kind === 'camp_stockpile_add') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const requestedQty = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    const stack = Array.isArray(actor.inventory?.stacks)
      ? findPreferredStackByItem(actor.inventory.stacks, itemId, requestedQty)
      : null;
    const available = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
    const movedQty = Math.min(available, Math.max(1, requestedQty));
    if (movedQty <= 0) {
      return;
    }

    const freshness = Number.isFinite(Number(stack?.freshness)) ? Number(stack.freshness) : null;
    const decayDaysRemaining = Number.isFinite(Number(stack?.decayDaysRemaining))
      ? Number(stack.decayDaysRemaining)
      : null;
    const dryness = Number.isFinite(Number(stack?.dryness))
      ? Number(stack.dryness)
      : null;
    const unitWeightKg = Number.isFinite(Number(stack?.unitWeightKg)) ? Number(stack.unitWeightKg) : null;
    const footprintW = normalizeStackFootprintValue(stack?.footprintW);
    const footprintH = normalizeStackFootprintValue(stack?.footprintH);
    const consumedQty = removeActorInventoryItem(actor, itemId, movedQty);
    if (consumedQty <= 0) {
      return;
    }

    addCampStockpileItem(state.camp, itemId, consumedQty, {
      freshness,
      decayDaysRemaining,
      dryness,
      unitWeightKg,
      footprintW,
      footprintH,
    });
    return;
  }

  if (action.kind === 'camp_drying_rack_add') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const quantity = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    if (!itemId || quantity <= 0 || !state?.camp) {
      return;
    }

    const extracted = removeCampStockpileItem(state.camp, itemId, quantity);
    if (extracted.consumed <= 0) {
      return;
    }

    const added = addCampDryingRackItem(state.camp, itemId, extracted.consumed, {
      freshness: extracted.freshness,
      decayDaysRemaining: extracted.decayDaysRemaining,
      dryness: extracted.dryness,
      footprintW: extracted.footprintW,
      footprintH: extracted.footprintH,
      unitWeightKg: extracted.unitWeightKg,
    });
    const overflow = Math.max(0, Math.floor(Number(added?.overflowQuantity) || 0));
    if (overflow > 0) {
      addCampStockpileItem(state.camp, itemId, overflow, {
        freshness: extracted.freshness,
        decayDaysRemaining: extracted.decayDaysRemaining,
        dryness: extracted.dryness,
      });
    }
    return;
  }

  if (action.kind === 'camp_drying_rack_add_inventory') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const quantity = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    if (!itemId || quantity <= 0 || !state?.camp) {
      return;
    }

    const extracted = extractActorInventoryItemWithMetadata(actor, itemId, quantity);
    if (!extracted || extracted.quantity <= 0) {
      return;
    }

    const added = addCampDryingRackItem(state.camp, extracted.itemId, extracted.quantity, {
      freshness: extracted.freshness,
      decayDaysRemaining: extracted.decayDaysRemaining,
      dryness: extracted.dryness,
      footprintW: extracted.footprintW,
      footprintH: extracted.footprintH,
      unitWeightKg: extracted.unitWeightKg,
    });
    const overflow = Math.max(0, Math.floor(Number(added?.overflowQuantity) || 0));
    if (overflow > 0) {
      addActorInventoryItem(actor, extracted.itemId, overflow, {
        freshness: extracted.freshness,
        decayDaysRemaining: extracted.decayDaysRemaining,
        dryness: extracted.dryness,
        footprintW: extracted.footprintW,
        footprintH: extracted.footprintH,
        unitWeightKg: extracted.unitWeightKg,
      });
    }
    return;
  }

  if (action.kind === 'camp_drying_rack_remove') {
    const slotIndex = Number.isInteger(action.payload?.slotIndex)
      ? action.payload.slotIndex
      : Math.floor(Number(action.payload?.slotIndex));
    const quantity = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    if (!state?.camp?.dryingRack || !Array.isArray(state.camp.dryingRack.slots)) {
      return;
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || quantity <= 0) {
      return;
    }

    const slot = state.camp.dryingRack.slots[slotIndex];
    const available = Math.max(0, Math.floor(Number(slot?.quantity) || 0));
    if (!slot || available <= 0) {
      return;
    }

    const consumed = Math.min(available, quantity);
    slot.quantity = available - consumed;
    addCampStockpileItem(state.camp, slot.itemId, consumed, {
      freshness: Number(slot.freshness),
      decayDaysRemaining: Number(slot.decayDaysRemaining),
      dryness: Number(slot.dryness),
      unitWeightKg: Number(slot.unitWeightKg),
      footprintW: Number(slot.footprintW),
      footprintH: Number(slot.footprintH),
    });

    state.camp.dryingRack.slots = state.camp.dryingRack.slots.filter((entry) => (Number(entry?.quantity) || 0) > 0);
    return;
  }

  if (action.kind === 'camp_stockpile_remove') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const requestedQty = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    const extracted = removeCampStockpileItem(state.camp, itemId, requestedQty);
    if (extracted.consumed <= 0) {
      return;
    }

    addActorInventoryItemWithOverflowDrop(state, actor, itemId, extracted.consumed, {
      freshness: extracted.freshness,
      decayDaysRemaining: extracted.decayDaysRemaining,
      dryness: extracted.dryness,
      unitWeightKg: extracted.unitWeightKg,
      footprintW: extracted.footprintW,
      footprintH: extracted.footprintH,
    });
    return;
  }

  if (action.kind === 'camp_station_build') {
    const stationId = typeof action.payload?.stationId === 'string' ? action.payload.stationId : '';
    if (!stationId) {
      return;
    }

    if (!state.camp || typeof state.camp !== 'object') {
      return;
    }
    if (!Array.isArray(state.camp.stationsUnlocked)) {
      state.camp.stationsUnlocked = [];
    }
    if (!state.camp.stationsUnlocked.includes(stationId)) {
      state.camp.stationsUnlocked.push(stationId);
    }

    if (CAMP_COMFORT_STATION_IDS.has(stationId)) {
      if (!Array.isArray(state.camp.comforts)) {
        state.camp.comforts = [];
      }
      if (!state.camp.comforts.includes(stationId)) {
        state.camp.comforts.push(stationId);
      }
    }

    if (stationId === 'drying_rack') {
      if (!state.camp.dryingRack || typeof state.camp.dryingRack !== 'object') {
        state.camp.dryingRack = { capacity: 4, slots: [] };
      }
      if (!Array.isArray(state.camp.dryingRack.slots)) {
        state.camp.dryingRack.slots = [];
      }
      state.camp.dryingRack.capacity = 4;
    }
    return;
  }

  if (action.kind === 'tap_insert_spout') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || tile?.sapTap?.hasSpout === true) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, 'tool:carved_wooden_spout', 1);
    if (consumed <= 0) {
      return;
    }

    tile.sapTap = {
      hasSpout: true,
      insertedDay: Number(state.totalDaysSimulated) || 0,
      insertedDayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'trap_place_snare') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (
      !tile
      || tile.rockType
      || tile.waterType
      || (Array.isArray(tile.plantIds) && tile.plantIds.length > 0)
      || tile?.simpleSnare?.active === true
      || tile?.deadfallTrap?.active === true
    ) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, 'tool:simple_snare', 1);
    if (consumed <= 0) {
      return;
    }

    tile.simpleSnare = {
      active: true,
      hasCatch: false,
      poached: false,
      sprung: false,
      reliability: 1,
      rabbitDensity: getAnimalDensityAtTile(state, 'sylvilagus_floridanus', targetX, targetY),
      placedYear: Number(state.year) || 1,
      placedDay: Number(state.dayOfYear) || 1,
      placedDayTick: Number(state.dayTick) || 0,
      catchResolvedTotalDays: null,
      daysSinceCatch: 0,
      lastResolvedYear: null,
      lastResolvedDay: null,
      lastRoll: null,
      lastPoachChance: null,
      lastPoachRoll: null,
    };

    actor.lastTrapPlacement = {
      kind: 'simple_snare',
      x: targetX,
      y: targetY,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'trap_place_deadfall') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (
      !tile
      || tile.rockType
      || tile.waterType
      || (Array.isArray(tile.plantIds) && tile.plantIds.length > 0)
      || tile?.simpleSnare?.active === true
      || tile?.deadfallTrap?.active === true
    ) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, 'tool:dead_fall_trap', 1);
    if (consumed <= 0) {
      return;
    }

    tile.deadfallTrap = {
      active: true,
      hasCatch: false,
      poached: false,
      sprung: false,
      reliability: 1,
      lastDensity: 0,
      caughtSpeciesId: null,
      placedYear: Number(state.year) || 1,
      placedDay: Number(state.dayOfYear) || 1,
      placedDayTick: Number(state.dayTick) || 0,
      catchResolvedTotalDays: null,
      daysSinceCatch: 0,
      lastResolvedYear: null,
      lastResolvedDay: null,
      lastRoll: null,
      lastPoachChance: null,
      lastPoachRoll: null,
    };

    actor.lastTrapPlacement = {
      kind: 'dead_fall_trap',
      x: targetX,
      y: targetY,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'trap_place_fish_weir') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || tile.waterType !== 'river' || tile.waterFrozen === true || tile?.fishTrap?.active === true) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, 'tool:fish_trap_weir', 1);
    if (consumed <= 0) {
      return;
    }

    tile.fishTrap = {
      active: true,
      sprung: false,
      reliability: 1,
      storedCatchSpeciesIds: [],
      maxStoredCatch: FISH_TRAP_MAX_STORED_CATCH,
      placedYear: Number(state.year) || 1,
      placedDay: Number(state.dayOfYear) || 1,
      placedDayTick: Number(state.dayTick) || 0,
      lastResolvedYear: null,
      lastResolvedDay: null,
      lastCatchCount: 0,
      lastDensity: 0,
      lastRoll: null,
    };

    actor.lastTrapPlacement = {
      kind: 'fish_trap_weir',
      x: targetX,
      y: targetY,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'auto_rod_place') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || tile.rockType || tile.waterType || tile?.autoRod?.active === true) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, 'tool:auto_rod', 1);
    if (consumed <= 0) {
      return;
    }

    tile.autoRod = {
      active: true,
      state: 'live',
      baitItemId: null,
      pendingSpeciesIds: [],
      placedYear: Number(state.year) || 1,
      placedDay: Number(state.dayOfYear) || 1,
      placedDayTick: Number(state.dayTick) || 0,
      lastResolvedYear: null,
      lastResolvedDay: null,
      lastResolvedDayTick: null,
      lastSpeciesId: null,
      lastCatchSuccess: false,
      lastLineSnapped: false,
      lastBiteChance: null,
      lastBiteRoll: null,
      lastHookRate: null,
      lastHookRoll: null,
      lastSnapProbability: null,
      lastSnapRoll: null,
    };

    actor.lastTrapPlacement = {
      kind: 'auto_rod',
      x: targetX,
      y: targetY,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'trap_check') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    const snare = tile?.simpleSnare;
    const deadfallTrap = tile?.deadfallTrap;
    const fishTrap = tile?.fishTrap;
    const autoRod = tile?.autoRod;
    const activeSnare = snare && snare.active === true ? snare : null;
    const activeDeadfall = deadfallTrap && deadfallTrap.active === true ? deadfallTrap : null;
    const activeFishTrap = fishTrap && fishTrap.active === true ? fishTrap : null;
    const activeAutoRod = autoRod && autoRod.active === true ? autoRod : null;
    if (!tile || (!activeSnare && !activeDeadfall && !activeFishTrap && !activeAutoRod)) {
      return;
    }

    if (activeSnare && activeSnare.hasCatch === true) {
      const speciesId = 'sylvilagus_floridanus';
      addActorInventoryItemWithOverflowDrop(state, actor, `${speciesId}:carcass`, 1, {
        freshness: 1,
        decayDaysRemaining: 3,
      });
    }

    if (activeDeadfall && activeDeadfall.hasCatch === true && typeof activeDeadfall.caughtSpeciesId === 'string' && activeDeadfall.caughtSpeciesId) {
      addActorInventoryItemWithOverflowDrop(state, actor, `${activeDeadfall.caughtSpeciesId}:carcass`, 1, {
        freshness: 1,
        decayDaysRemaining: 3,
      });
    }

    if (activeFishTrap && Array.isArray(activeFishTrap.storedCatchSpeciesIds)) {
      for (const speciesId of activeFishTrap.storedCatchSpeciesIds) {
        if (typeof speciesId !== 'string' || !speciesId) {
          continue;
        }
        const fishMeatPart = (ANIMAL_BY_ID[speciesId]?.parts || []).find((entry) => entry?.id === 'meat') || null;
        const decayDays = Number.isFinite(Number(fishMeatPart?.decay_days))
          ? Math.max(0, Math.floor(Number(fishMeatPart.decay_days)))
          : 2;
        addActorInventoryItemWithOverflowDrop(state, actor, `${speciesId}:fish_carcass`, 1, {
          freshness: 1,
          decayDaysRemaining: decayDays,
        });
      }
    }

    const autoRodPendingBefore = Array.isArray(activeAutoRod?.pendingSpeciesIds)
      ? activeAutoRod.pendingSpeciesIds.filter((entry) => typeof entry === 'string' && entry)
      : [];
    if (activeAutoRod && autoRodPendingBefore.length > 0) {
      for (const speciesId of autoRodPendingBefore) {
        const fishMeatPart = (ANIMAL_BY_ID[speciesId]?.parts || []).find((entry) => entry?.id === 'meat') || null;
        const decayDays = Number.isFinite(Number(fishMeatPart?.decay_days))
          ? Math.max(0, Math.floor(Number(fishMeatPart.decay_days)))
          : 2;
        addActorInventoryItemWithOverflowDrop(state, actor, `${speciesId}:fish_carcass`, 1, {
          freshness: 1,
          decayDaysRemaining: decayDays,
        });
      }
    }

    if (activeSnare) {
      tile.simpleSnare = {
        ...activeSnare,
        hasCatch: false,
        poached: false,
        sprung: false,
        catchResolvedTotalDays: null,
        daysSinceCatch: 0,
        lastPoachChance: null,
        lastPoachRoll: null,
        lastResolvedYear: state.year,
        lastResolvedDay: state.dayOfYear,
      };
    }

    if (activeDeadfall) {
      tile.deadfallTrap = {
        ...activeDeadfall,
        hasCatch: false,
        poached: false,
        sprung: false,
        caughtSpeciesId: null,
        catchResolvedTotalDays: null,
        daysSinceCatch: 0,
        lastPoachChance: null,
        lastPoachRoll: null,
        lastResolvedYear: state.year,
        lastResolvedDay: state.dayOfYear,
      };
    }

    if (activeFishTrap) {
      tile.fishTrap = {
        ...activeFishTrap,
        sprung: false,
        storedCatchSpeciesIds: [],
        lastCatchCount: 0,
        lastResolvedYear: state.year,
        lastResolvedDay: state.dayOfYear,
      };
    }

    if (activeAutoRod) {
      let nextState = activeAutoRod.state;
      const baitItemId = typeof action.payload?.baitItemId === 'string' ? action.payload.baitItemId : null;
      const repair = action.payload?.repair === true;

      if (repair && nextState === 'broken') {
        const consumedHook = removeActorInventoryItem(actor, 'tool:bone_hook', 1);
        const consumedCordage = removeActorInventoryItem(actor, 'cordage', 1);
        if (consumedHook > 0 && consumedCordage > 0) {
          nextState = 'triggered_escape';
        }
      }

      let nextBaitItemId = activeAutoRod.baitItemId === EARTHWORM_ITEM_ID
        ? EARTHWORM_ITEM_ID
        : null;
      if (baitItemId === EARTHWORM_ITEM_ID) {
        const consumedBait = removeActorInventoryItem(actor, EARTHWORM_ITEM_ID, 1);
        if (consumedBait > 0) {
          nextBaitItemId = EARTHWORM_ITEM_ID;
          if (nextState !== 'broken') {
            nextState = 'live';
          }
        }
      }

      if ((nextState === 'triggered_catch' || nextState === 'triggered_escape') && nextBaitItemId === null) {
        nextState = 'triggered_escape';
      }

      if (nextState === 'broken' && repair !== true) {
        nextBaitItemId = null;
      }

      tile.autoRod = {
        ...activeAutoRod,
        state: nextState,
        baitItemId: nextBaitItemId,
        pendingSpeciesIds: [],
      };
    }

    actor.lastTrapCheck = {
      kind: activeSnare
        ? 'simple_snare'
        : activeDeadfall
          ? 'dead_fall_trap'
          : activeFishTrap
            ? 'fish_trap_weir'
            : 'auto_rod',
      x: targetX,
      y: targetY,
      hadCatch: activeSnare
        ? activeSnare.hasCatch === true
        : activeDeadfall
          ? activeDeadfall.hasCatch === true
          : activeFishTrap
            ? Array.isArray(activeFishTrap?.storedCatchSpeciesIds) && activeFishTrap.storedCatchSpeciesIds.length > 0
            : autoRodPendingBefore.length > 0,
      wasPoached: activeSnare ? activeSnare.poached === true : activeDeadfall ? activeDeadfall.poached === true : false,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'tap_remove_spout') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || tile?.sapTap?.hasSpout !== true) {
      return;
    }

    tile.sapTap = null;
    addActorInventoryItemWithOverflowDrop(state, actor, 'tool:carved_wooden_spout', 1);
    return;
  }

  if (action.kind === 'tap_place_vessel') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || tile?.sapTap?.hasSpout !== true || tile?.sapTap?.hasVessel === true) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, 'tool:hide_pitch_vessel', 1);
    if (consumed <= 0) {
      return;
    }

    tile.sapTap = {
      ...tile.sapTap,
      hasVessel: true,
      vesselPlacedDay: Number(state.totalDaysSimulated) || 0,
      vesselPlacedDayTick: Number(state.dayTick) || 0,
      vesselSapUnits: 0,
      vesselCapacityUnits: SAP_TAP_VESSEL_CAPACITY_UNITS,
    };
    return;
  }

  if (action.kind === 'tap_retrieve_vessel') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || tile?.sapTap?.hasVessel !== true) {
      return;
    }

    const sapUnits = Number.isInteger(tile.sapTap.vesselSapUnits)
      ? Math.max(0, tile.sapTap.vesselSapUnits)
      : 0;

    const vesselItemId = sapUnits > 0 ? SAP_FILLED_VESSEL_ITEM_ID : 'tool:hide_pitch_vessel';
    addActorInventoryItemWithOverflowDrop(state, actor, vesselItemId, 1);

    tile.sapTap = {
      ...tile.sapTap,
      hasVessel: false,
      vesselPlacedDay: null,
      vesselPlacedDayTick: null,
      vesselSapUnits: null,
      vesselCapacityUnits: null,
    };
    actor.lastTapRetrieval = {
      x: targetX,
      y: targetY,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
      sapUnits,
    };
    return;
  }

  if (action.kind === 'tool_craft') {
    const outputItemId = typeof action.payload?.outputItemId === 'string' ? action.payload.outputItemId : '';
    const outputQuantity = Number.isInteger(action.payload?.outputQuantity)
      ? action.payload.outputQuantity
      : Math.floor(Number(action.payload?.outputQuantity || 1));
    const materialPlan = Array.isArray(action.payload?.materialPlan) ? action.payload.materialPlan : [];
    if (!outputItemId || outputQuantity <= 0) {
      return;
    }

    for (const material of materialPlan) {
      const materialItemId = typeof material?.itemId === 'string' ? material.itemId : '';
      const materialQuantity = Number.isInteger(material?.quantity)
        ? material.quantity
        : Math.floor(Number(material?.quantity || 0));
      if (!materialItemId || materialQuantity <= 0) {
        return;
      }

      const consumed = removeActorInventoryItem(actor, materialItemId, materialQuantity);
      if (consumed < materialQuantity) {
        return;
      }
    }

    addActorInventoryItemWithOverflowDrop(state, actor, outputItemId, outputQuantity, {
      footprintW: normalizeStackFootprintValue(action.payload?.outputFootprintW),
      footprintH: normalizeStackFootprintValue(action.payload?.outputFootprintH),
      unitWeightKg: Number(action.payload?.outputUnitWeightKg),
    });
    return;
  }

  if (action.kind === 'fell_tree') {
    const plantId = typeof action.payload?.plantId === 'string' ? action.payload.plantId : '';
    const plant = state?.plants?.[plantId];
    if (!plant || plant.alive !== true) {
      return;
    }

    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(plant.x);
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(plant.y);
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const poleYield = Number.isInteger(action.payload?.poleYield)
      ? action.payload.poleYield
      : Math.floor(Number(action.payload?.poleYield || 0));
    const normalizedPoleYield = Math.max(0, poleYield);

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    const speciesId = typeof plant.speciesId === 'string' ? plant.speciesId : 'unknown';

    if (normalizedPoleYield > 0) {
      addActorInventoryItemWithOverflowDrop(state, actor, 'pole', normalizedPoleYield, {
        unitWeightKg: 1,
      });
    }

    plant.alive = false;
    maybeCreateDeadLog(state, plant, {
      decayStage: 1,
      createdYear: state.year,
      createdDayOfYear: state.dayOfYear,
    });

    if (tile) {
      tile.plantIds = Array.isArray(tile.plantIds)
        ? tile.plantIds.filter((id) => id !== plantId)
        : [];
      tile.disturbed = true;
    }
    delete state.plants[plantId];

    actor.lastFellTree = {
      plantId,
      speciesId,
      x: targetX,
      y: targetY,
      poleYield: normalizedPoleYield,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'harvest') {
    const targetType = typeof action.payload?.targetType === 'string' ? action.payload.targetType : 'plant';

    if (targetType === 'rock') {
      const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
      const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
      if (!inBounds(targetX, targetY, state.width, state.height)) {
        return;
      }

      const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
      const rockType = typeof action.payload?.rockType === 'string' ? action.payload.rockType : tile?.rockType;
      const outputItemId = typeof action.payload?.outputItemId === 'string' ? action.payload.outputItemId : '';
      if (!tile || !rockType || !outputItemId) {
        return;
      }

      addActorInventoryItemWithOverflowDrop(state, actor, outputItemId, 1, {
        footprintW: normalizeStackFootprintValue(action.payload?.outputFootprintW),
        footprintH: normalizeStackFootprintValue(action.payload?.outputFootprintH),
      });
      return;
    }

    if (targetType === 'squirrel_cache') {
      const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
      const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
      if (!inBounds(targetX, targetY, state.width, state.height)) {
        return;
      }

      const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
      const cache = tile?.squirrelCache;
      if (!cache || cache.discovered !== true) {
        return;
      }

      const availableGrams = Math.max(0, Math.floor(Number(cache.nutContentGrams) || 0));
      const requestedGrams = Number.isInteger(action.payload?.cacheGrams)
        ? action.payload.cacheGrams
        : Math.floor(Number(action.payload?.cacheGrams || 100));
      const harvestedGrams = Math.min(availableGrams, Math.max(1, requestedGrams));
      if (harvestedGrams <= 0) {
        return;
      }

      const cacheItemId = `squirrel_cache:${cache.cachedSpeciesId}:${cache.cachedPartName}:${cache.cachedSubStageId}`;
      addActorInventoryItemWithOverflowDrop(state, actor, cacheItemId, harvestedGrams, {
        footprintW: normalizeStackFootprintValue(action.payload?.inventoryFootprintW),
        footprintH: normalizeStackFootprintValue(action.payload?.inventoryFootprintH),
        unitWeightKg: Number(action.payload?.inventoryUnitWeightKg),
      });
      cache.nutContentGrams = availableGrams - harvestedGrams;
      if (cache.nutContentGrams <= 0) {
        tile.squirrelCache = null;
      }
      return;
    }

    const plantId = typeof action.payload?.plantId === 'string' ? action.payload.plantId : '';
    const partName = typeof action.payload?.partName === 'string' ? action.payload.partName : '';
    const subStageId = typeof action.payload?.subStageId === 'string' ? action.payload.subStageId : '';
    const requestedActions = Number.isInteger(action.payload?.actions)
      ? action.payload.actions
      : Math.floor(Number(action.payload?.actions || 1));

    const outcome = applyHarvestAction(state, plantId, partName, subStageId, { actions: requestedActions });
    if ((Number(outcome.appliedActions) || 0) > 0) {
      const plant = state.plants?.[plantId];
      const speciesId = typeof plant?.speciesId === 'string' ? plant.speciesId : 'unknown';
      const itemId = `${speciesId}:${partName}:${subStageId}`;
      addActorInventoryItemWithOverflowDrop(state, actor, itemId, outcome.appliedActions, {
        freshness: Number(action.payload?.inventoryFreshness),
        decayDaysRemaining: Number(action.payload?.inventoryDecayDaysRemaining),
        footprintW: normalizeStackFootprintValue(action.payload?.inventoryFootprintW),
        footprintH: normalizeStackFootprintValue(action.payload?.inventoryFootprintH),
        unitWeightKg: Number(action.payload?.inventoryUnitWeightKg),
      });
    }
    return;
  }

  if (action.kind === 'partner_task_set') {
    const queue = state?.camp?.partnerTaskQueue;
    if (!queue) {
      return;
    }

    const task = normalizePartnerTask(action.payload?.task);
    if (!task) {
      return;
    }

    const queuePolicy = action.payload?.queuePolicy === 'replace' ? 'replace' : 'append';
    if (queuePolicy === 'replace') {
      queue.active = task;
      queue.queued = [];
      mirrorPartnerTaskQueueToActor(state);
      return;
    }

    if (!queue.active) {
      queue.active = task;
    } else {
      if (!Array.isArray(queue.queued)) {
        queue.queued = [];
      }
      queue.queued.push(task);
    }

    mirrorPartnerTaskQueueToActor(state);
  }
}

function advanceOneTick(state) {
  progressPartnerTaskQueueOneTick(state);
  processAutoRodTickResolution(state);
  state.dayTick += 1;
  if (state.dayTick < 400) {
    return state;
  }

  let rolled = advanceDay(state, 1);
  ensureTickSystems(rolled);
  rolled.dayTick = 0;
  rolled.currentDayActionLog = [];

  for (const actor of Object.values(rolled.actors || {})) {
    const base = getActorDayStartTickBudgetBase(rolled, actor);
    const carryOver = Number(actor.overdraftTicks) || 0;
    actor.tickBudgetCurrent = Math.max(0, base - carryOver);
    actor.overdraftTicks = 0;
  }

  return rolled;
}

function canGenerateAnimalZonesInternal(state) {
  if (state?.animalZonesGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_ANIMAL_ZONE_GENERATION;
}

function canGenerateFishPopulationsInternal(state) {
  if (state?.fishPopulationsGenerated) {
    return false;
  }
  return Number(state?.totalDaysSimulated) >= MIN_DAYS_FOR_FISH_POPULATION_GENERATION;
}

function animalTileDensityKey(x, y) {
  return `${x},${y}`;
}

function classifyWaterBody(tiles) {
  const counts = {};
  for (const tile of tiles) {
    if (!tile?.waterType) {
      continue;
    }
    counts[tile.waterType] = (counts[tile.waterType] || 0) + 1;
  }

  let dominantWaterType = 'pond';
  let maxCount = -1;
  for (const [waterType, count] of Object.entries(counts)) {
    if (count > maxCount) {
      dominantWaterType = waterType;
      maxCount = count;
    }
  }

  const waterBodyKind = dominantWaterType === 'pond' ? 'pond' : 'river';
  return { dominantWaterType, waterBodyKind };
}

function buildWaterBodyMap(state) {
  const width = state.width;
  const height = state.height;
  const visited = new Set();
  const tileToBodyId = {};
  const bodiesById = {};
  let bodyIndex = 1;

  for (const tile of state.tiles || []) {
    if (!tile?.waterType) {
      continue;
    }
    const key = animalTileDensityKey(tile.x, tile.y);
    if (visited.has(key)) {
      continue;
    }

    const queue = [{ x: tile.x, y: tile.y }];
    visited.add(key);
    const bodyTiles = [];

    while (queue.length > 0) {
      const current = queue.pop();
      const currentTile = state.tiles[tileIndex(current.x, current.y, width)];
      if (!currentTile?.waterType) {
        continue;
      }

      bodyTiles.push(currentTile);

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      for (const neighbor of neighbors) {
        if (!inBounds(neighbor.x, neighbor.y, width, height)) {
          continue;
        }
        const neighborTile = state.tiles[tileIndex(neighbor.x, neighbor.y, width)];
        if (!neighborTile?.waterType) {
          continue;
        }
        const neighborKey = animalTileDensityKey(neighbor.x, neighbor.y);
        if (visited.has(neighborKey)) {
          continue;
        }
        visited.add(neighborKey);
        queue.push(neighbor);
      }
    }

    const bodyId = `water_body_${bodyIndex}`;
    bodyIndex += 1;
    const classification = classifyWaterBody(bodyTiles);
    bodiesById[bodyId] = {
      bodyId,
      tileCount: bodyTiles.length,
      dominantWaterType: classification.dominantWaterType,
      waterBodyKind: classification.waterBodyKind,
      tileKeys: bodyTiles.map((waterTile) => animalTileDensityKey(waterTile.x, waterTile.y)),
    };
    for (const waterTile of bodyTiles) {
      tileToBodyId[animalTileDensityKey(waterTile.x, waterTile.y)] = bodyId;
    }
  }

  return { tileToBodyId, bodiesById };
}

function tileMatchesFishHabitat(fish, tile, waterBody) {
  if (!fish || !tile?.waterType || !waterBody) {
    return false;
  }

  const habitatSet = new Set(fish.habitat || []);
  if (tile.waterType === 'pond') {
    return habitatSet.has('pond')
      || habitatSet.has(waterBody.dominantWaterType)
      || habitatSet.has(waterBody.waterBodyKind);
  }

  if (tile.waterType !== 'river') {
    return false;
  }

  if (habitatSet.has('river')) {
    return true;
  }

  const allowedBands = new Set();
  if (habitatSet.has('stream')) {
    allowedBands.add('slow');
  }
  if (habitatSet.has('slow_river')) {
    allowedBands.add('medium');
  }
  if (habitatSet.has('fast_river')) {
    allowedBands.add('fast');
  }
  if (habitatSet.has('slow')) {
    allowedBands.add('slow');
  }
  if (habitatSet.has('medium')) {
    allowedBands.add('medium');
  }
  if (habitatSet.has('fast')) {
    allowedBands.add('fast');
  }

  if (allowedBands.size === 0) {
    return habitatSet.has(waterBody.dominantWaterType) || habitatSet.has(waterBody.waterBodyKind);
  }

  const band = typeof tile.waterCurrentBand === 'string' ? tile.waterCurrentBand : 'medium';
  return allowedBands.has(band);
}

function fishTileDensityMultiplier(tile) {
  let multiplier = tile.waterDepth === 'deep' ? 1.08 : 0.96;
  const band = typeof tile?.waterCurrentBand === 'string' ? tile.waterCurrentBand : null;
  if (band === 'fast') {
    multiplier *= 0.9;
  } else if (band === 'slow') {
    multiplier *= 0.88;
  } else if (band === 'medium') {
    multiplier *= 1.03;
  }
  return multiplier;
}

function fnv1aHash32(input) {
  const text = String(input ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }
  return hash >>> 0;
}

function hashToUnitFloat(input) {
  return fnv1aHash32(input) / 0xFFFFFFFF;
}

function lerp(a, b, t) {
  return a + ((b - a) * t);
}

function smoothStep01(value) {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0));
  return clamped * clamped * (3 - (2 * clamped));
}

function coherentFishNoise2D(seedToken, x, y, cellSize) {
  const safeCellSize = Math.max(1, Math.floor(Number(cellSize) || 1));
  const sx = x / safeCellSize;
  const sy = y / safeCellSize;

  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = x0 + 1;
  const y1 = y0 + 1;

  const tx = smoothStep01(sx - x0);
  const ty = smoothStep01(sy - y0);

  const v00 = hashToUnitFloat(`${seedToken}|${x0}|${y0}`);
  const v10 = hashToUnitFloat(`${seedToken}|${x1}|${y0}`);
  const v01 = hashToUnitFloat(`${seedToken}|${x0}|${y1}`);
  const v11 = hashToUnitFloat(`${seedToken}|${x1}|${y1}`);

  const top = lerp(v00, v10, tx);
  const bottom = lerp(v01, v11, tx);
  return lerp(top, bottom, ty);
}

function deterministicFishTileVariationFactor(state, fishId, tile) {
  const normalizedSeed = Number.isFinite(Number(state?.seed))
    ? Math.abs(Math.floor(Number(state.seed)))
    : 0;
  const speciesToken = fishId || 'unknown_fish';
  const x = Number(tile?.x) || 0;
  const y = Number(tile?.y) || 0;
  const largeScaleNoise = coherentFishNoise2D(
    `fish_large|${normalizedSeed}|${speciesToken}`,
    x,
    y,
    FISH_LARGE_SCALE_CELL_SIZE,
  );
  const smallScaleNoise = hashToUnitFloat(`fish_small|${normalizedSeed}|${speciesToken}|${x}|${y}`);
  const normalized = clamp01(
    (largeScaleNoise * FISH_LARGE_SCALE_WEIGHT)
      + (smallScaleNoise * (1 - FISH_LARGE_SCALE_WEIGHT)),
  );
  const span = FISH_DENSITY_VARIATION_MAX - FISH_DENSITY_VARIATION_MIN;
  return FISH_DENSITY_VARIATION_MIN + (span * normalized);
}

function computeAnimalPlantContribution(animalId, plant, plantSpecies, plantSize) {
  if (!animalId || !plant || !plantSpecies) {
    return 0;
  }

  const diet = ANIMAL_BY_ID[animalId]?.diet || [];
  const inDiet = diet.includes(plant.speciesId);

  if (animalId === 'sylvilagus_floridanus') {
    let contribution = inDiet ? 1 : 0;
    if (plant.speciesId === 'daucus_carota') {
      contribution += 4;
    }
    if (plantSize <= 3) {
      contribution += 0.35;
    }
    if (plant.speciesId === 'urtica_dioica') {
      contribution += 0.5;
    }
    return contribution;
  }

  if (animalId === 'sciurus_carolinensis') {
    if (SQUIRREL_NUT_TREE_SPECIES.has(plant.speciesId) && plantSize < SQUIRREL_NUT_TREE_MATURITY_SIZE) {
      return 0;
    }

    let contribution = inDiet ? 0.8 : 0;
    if (plantSize >= 6) {
      contribution += 0.4;
    }
    if (plantSize >= 8) {
      contribution += 2.4;
    }
    if (plant.speciesId === 'juglans_nigra') {
      contribution += 6;
    }
    return contribution;
  }

  return 0;
}

function distanceFalloffWeight(distance, radius) {
  if (distance > radius) {
    return 0;
  }
  return (radius - distance + 1) / (radius + 1);
}

function generateAnimalZonesInternal(state) {
  if (state.animalZonesGenerated) {
    return;
  }

  const animalIds = ['sylvilagus_floridanus', 'sciurus_carolinensis'].filter((id) => Boolean(ANIMAL_BY_ID[id]));
  const alivePlants = [];
  for (const plant of Object.values(state.plants || {})) {
    if (!plant?.alive) {
      continue;
    }
    const species = PLANT_BY_ID[plant.speciesId];
    if (!species) {
      continue;
    }
    alivePlants.push({
      plant,
      species,
      size: lifeStageSize(species, plant.stageName),
    });
  }

  const rawSupportBySpecies = {};
  const densityBySpecies = {};

  for (const animalId of animalIds) {
    rawSupportBySpecies[animalId] = {};
    densityBySpecies[animalId] = {};
  }

  for (const tile of state.tiles || []) {
    if (!tile || tile.waterType) {
      continue;
    }

    const tileKey = animalTileDensityKey(tile.x, tile.y);

    for (const animalId of animalIds) {
      let support = 0;
      for (const { plant, species, size } of alivePlants) {
        const dx = plant.x - tile.x;
        const dy = plant.y - tile.y;
        const distance = Math.sqrt((dx * dx) + (dy * dy));
        const weight = distanceFalloffWeight(distance, ANIMAL_DENSITY_RADIUS_TILES);
        if (weight <= 0) {
          continue;
        }
        const contribution = computeAnimalPlantContribution(animalId, plant, species, size);
        if (contribution <= 0) {
          continue;
        }
        support += contribution * weight;
      }
      rawSupportBySpecies[animalId][tileKey] = support;
    }
  }

  for (const animalId of animalIds) {
    const animal = ANIMAL_BY_ID[animalId];
    const baseDensity = clamp01(Number(animal?.population?.startingDensity) || 0);
    const rawByTile = rawSupportBySpecies[animalId] || {};
    const maxRaw = Math.max(0, ...Object.values(rawByTile).map((value) => Number(value) || 0));

    for (const tile of state.tiles || []) {
      if (!tile || tile.waterType) {
        continue;
      }
      const tileKey = animalTileDensityKey(tile.x, tile.y);
      const raw = Number(rawByTile[tileKey] || 0);
      const normalizedSupport = maxRaw > 0 ? raw / maxRaw : 0;
      const seededDensity = clamp01(baseDensity * 0.2 + normalizedSupport * 0.8);
      densityBySpecies[animalId][tileKey] = seededDensity;
    }
  }

  state.animalZoneGrid = null;
  state.animalDensityByZone = densityBySpecies;
  state.animalZonesGenerated = true;
}

function generateFishPopulationsInternal(state) {
  if (state.fishPopulationsGenerated) {
    return;
  }

  const fishSpecies = Object.values(ANIMAL_BY_ID).filter((animal) => animal.animalClass === 'fish');
  const waterBodies = buildWaterBodyMap(state);
  const densityBySpecies = {};

  for (const fish of fishSpecies) {
    const speciesDensity = {};
    const startingDensity = Math.max(0, Number(fish.population?.startingDensity ?? 0));

    for (const tile of state.tiles || []) {
      if (!tile?.waterType) {
        continue;
      }

      const tileKey = animalTileDensityKey(tile.x, tile.y);
      const bodyId = waterBodies.tileToBodyId[tileKey];
      const waterBody = waterBodies.bodiesById[bodyId];
      if (!waterBody || !tileMatchesFishHabitat(fish, tile, waterBody)) {
        speciesDensity[tileKey] = 0;
        continue;
      }

      const bodyBase = waterBody.waterBodyKind === 'pond'
        ? startingDensity * 0.8
        : startingDensity;
      const tileMultiplier = fishTileDensityMultiplier(tile);
      const variationFactor = deterministicFishTileVariationFactor(state, fish.id, tile);
      speciesDensity[tileKey] = clamp01(bodyBase * tileMultiplier * variationFactor);
    }

    densityBySpecies[fish.id] = speciesDensity;
  }

  state.fishWaterBodyByTile = waterBodies.tileToBodyId;
  state.fishWaterBodies = waterBodies.bodiesById;
  state.fishDensityByTile = densityBySpecies;
  state.fishEquilibriumByTile = cloneFishDensityByTile(densityBySpecies);
  state.fishPopulationsGenerated = true;
}

function applyFishPopulationRecovery(state) {
  if (!state?.fishPopulationsGenerated) {
    return;
  }

  const equilibriumBySpecies = state.fishEquilibriumByTile || {};
  for (const [speciesId, equilibriumByTile] of Object.entries(equilibriumBySpecies)) {
    if (!state.fishDensityByTile[speciesId]) {
      state.fishDensityByTile[speciesId] = {};
    }

    for (const [tileKey, equilibriumDensityRaw] of Object.entries(equilibriumByTile || {})) {
      const equilibriumDensity = clamp01(Number(equilibriumDensityRaw) || 0);
      if (equilibriumDensity <= 0) {
        state.fishDensityByTile[speciesId][tileKey] = 0;
        continue;
      }

      const currentDensity = clamp01(Number(state.fishDensityByTile[speciesId][tileKey]) || 0);
      const recoveredDensity = Math.min(
        equilibriumDensity,
        currentDensity + (equilibriumDensity * FISH_DAILY_RECOVERY_RATIO),
      );
      state.fishDensityByTile[speciesId][tileKey] = clamp01(recoveredDensity);
    }
  }
}

function rollGroundFungusYield(zone, targetTile, rng) {
  const baseYield = rangeRollIntRandom(zone.perTileYieldRange, rng, 1);
  const moisture = Number(targetTile?.moisture) || 0;

  let multiplier = 1;
  if (moisture > 0.9) {
    multiplier = 0.6;
  } else if (moisture >= 0.7) {
    multiplier = 1.4;
  } else if (moisture >= 0.4) {
    multiplier = 1.2;
  } else if (moisture >= 0.15) {
    multiplier = 0.5;
  } else {
    multiplier = 0.1;
  }

  return Math.max(1, Math.round(baseYield * multiplier));
}

function applyGroundFungusFruiting(state, rng) {
  const zoneTilesByZoneId = new Map();

  for (const tile of state.tiles) {
    const zone = tile.groundFungusZone;
    if (!zone?.zoneId) {
      continue;
    }
    if (!zoneTilesByZoneId.has(zone.zoneId)) {
      zoneTilesByZoneId.set(zone.zoneId, []);
    }
    zoneTilesByZoneId.get(zone.zoneId).push(tile);
  }

  for (const zoneTiles of zoneTilesByZoneId.values()) {
    if (zoneTiles.length === 0) {
      continue;
    }

    const sampleZone = zoneTiles[0].groundFungusZone;
    const windows = Array.isArray(sampleZone.fruitingWindows) ? sampleZone.fruitingWindows : [];
    const activeWindowIndices = windows
      .map((window, index) => (isDayInSeasonWindow(state.dayOfYear, window) ? index : -1))
      .filter((index) => index >= 0);

    if (activeWindowIndices.length === 0) {
      for (const tile of zoneTiles) {
        tile.groundFungusZone.yieldCurrentGrams = 0;
      }
      continue;
    }

    for (const windowIndex of activeWindowIndices) {
      const window = windows[windowIndex];
      if (!window || state.dayOfYear !== window.startDay) {
        continue;
      }

      const rolledYear = Number(sampleZone.rolledYearByWindow?.[windowIndex]);
      if (rolledYear === state.year) {
        continue;
      }

      for (const tile of zoneTiles) {
        tile.groundFungusZone.yieldCurrentGrams = 0;
        if (!tile.groundFungusZone.rolledYearByWindow) {
          tile.groundFungusZone.rolledYearByWindow = {};
        }
        tile.groundFungusZone.rolledYearByWindow[windowIndex] = state.year;
      }

      const availableTargetIndices = new Set(
        zoneTiles
          .map((tile, index) => (tile.plantIds.length === 0 ? index : -1))
          .filter((index) => index >= 0),
      );

      let pendingBlockedSuccesses = 0;
      for (let index = 0; index < zoneTiles.length; index += 1) {
        const tile = zoneTiles[index];
        const chance = Number(tile.groundFungusZone.annualFruitChance);
        const safeChance = Number.isFinite(chance) ? Math.max(0, Math.min(1, chance)) : 0;

        if (rng() > safeChance) {
          continue;
        }

        if (availableTargetIndices.has(index)) {
          tile.groundFungusZone.yieldCurrentGrams = rollGroundFungusYield(tile.groundFungusZone, tile, rng);
          availableTargetIndices.delete(index);
        } else {
          pendingBlockedSuccesses += 1;
        }
      }

      while (pendingBlockedSuccesses > 0 && availableTargetIndices.size > 0) {
        const candidates = [...availableTargetIndices];
        const targetIndex = candidates[Math.floor(rng() * candidates.length)];
        const targetTile = zoneTiles[targetIndex];
        targetTile.groundFungusZone.yieldCurrentGrams = rollGroundFungusYield(
          targetTile.groundFungusZone,
          targetTile,
          rng,
        );
        availableTargetIndices.delete(targetIndex);
        pendingBlockedSuccesses -= 1;
      }
    }
  }
}

function assignGroundFungusZoneToTile(tile, fungus, zoneId) {
  tile.groundFungusZone = {
    type: 'ground_fungus_zone',
    speciesId: fungus.id,
    zoneId,
    annualFruitChance: fungus.annualFruitChance,
    fruitingWindows: fungus.fruitingWindows.map((window) => ({ ...window })),
    perTileYieldRange: [...fungus.perTileYieldRange],
    yieldCurrentGrams: 0,
    rolledYearByWindow: {},
  };
}

function logFungusHostCompatible(logFungus, sourceSpeciesId) {
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

function ensureDeadLogFungusShape(deadLog) {
  if (!deadLog) {
    return;
  }
  if (!Array.isArray(deadLog.fungi)) {
    deadLog.fungi = [];
  }
}

function rollLogFungusYield(entry, tile, deadLog, rng) {
  const baseYield = rangeRollIntRandom(entry.per_log_yield_range, rng, 1);
  const moistureMultiplier = moistureYieldMultiplier(Number(tile.moisture) || 0);
  const sizeMultiplier = Number.isFinite(entry.log_size_multiplier)
    ? entry.log_size_multiplier
    : Math.max(0.7, Math.min(1.8, (Number(deadLog.sizeAtDeath) || 8) / 8));
  return Math.max(1, Math.round(baseYield * moistureMultiplier * sizeMultiplier));
}

function applyLogFungusFruiting(state, rng) {
  for (const tile of state.tiles) {
    if (!tile?.deadLog) {
      continue;
    }

    ensureDeadLogFungusShape(tile.deadLog);
    for (const fungusEntry of tile.deadLog.fungi) {
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
        fungusEntry.yield_current_grams = rollLogFungusYield(fungusEntry, tile, tile.deadLog, rng);
      }
    }
  }
}

function colonizeDeadLogFungiByYear(state, rng) {
  for (const tile of state.tiles) {
    if (!tile?.deadLog) {
      continue;
    }

    ensureDeadLogFungusShape(tile.deadLog);
    const currentDecayStage = Number.isFinite(tile.deadLog.decayStage)
      ? Math.max(1, Math.min(4, Math.round(tile.deadLog.decayStage)))
      : 1;
    const existingSpecies = new Set(tile.deadLog.fungi.map((entry) => entry.species_id));

    for (const speciesId of state.runFungusPool || []) {
      if (tile.deadLog.fungi.length >= MAX_LOG_FUNGI_PER_LOG) {
        break;
      }
      if (existingSpecies.has(speciesId)) {
        continue;
      }

      const logFungus = LOG_FUNGUS_BY_ID[speciesId];
      if (!logFungus) {
        continue;
      }
      if (!logFungusHostCompatible(logFungus, tile.deadLog.sourceSpeciesId)) {
        continue;
      }
      if (!logFungus.preferredDecayStages.includes(currentDecayStage)) {
        continue;
      }

      const chance = clamp01((Number(logFungus.baseSpawnChance) || 0) * moistureYieldMultiplier(Number(tile.moisture) || 0));
      if (rng() > chance) {
        continue;
      }

      tile.deadLog.fungi.push({
        species_id: logFungus.id,
        yield_current_grams: 0,
        fruiting_windows: logFungus.fruitingWindows.map((window) => ({ ...window })),
        per_log_yield_range: [...logFungus.perLogYieldRange],
        log_size_multiplier: Math.max(0.7, Math.min(1.8, (Number(tile.deadLog.sizeAtDeath) || 8) / 8)),
        rolled_year_by_window: {},
      });
      existingSpecies.add(logFungus.id);
    }
  }
}

function generateGroundFungusZonesInternal(state, rng) {
  if (state.groundFungusZonesGenerated) {
    return;
  }

  const eligibleSpecies = GROUND_FUNGUS_CATALOG.filter((fungus) => state.tiles.some(
    (tile) => computeGroundFungusSoilMatch(fungus, tile) > 0,
  ));
  if (eligibleSpecies.length === 0) {
    state.runGroundFungusPool = [];
    state.groundFungusZonesGenerated = true;
    return;
  }

  const shuffled = [...eligibleSpecies].sort(() => rng() - 0.5);
  const desiredPoolSize = 4 + Math.floor(rng() * 4);
  const poolSize = Math.max(1, Math.min(desiredPoolSize, shuffled.length));
  const runPool = shuffled.slice(0, poolSize);

  state.runGroundFungusPool = runPool.map((fungus) => fungus.id);

  for (const fungus of runPool) {
    const candidateTiles = state.tiles.filter(
      (tile) => !tile.waterType && !isRockTile(tile) && computeGroundFungusSoilMatch(fungus, tile) > 0,
    );
    if (candidateTiles.length === 0) {
      continue;
    }

    const zoneCount = rangeRollIntRandom(fungus.zoneCountRange, rng, 15);
    const placedCenters = [];

    for (let zoneIndex = 0; zoneIndex < zoneCount; zoneIndex += 1) {
      let centerTile = candidateTiles[Math.floor(rng() * candidateTiles.length)];
      if (placedCenters.length > 0) {
        const anchor = placedCenters[Math.floor(rng() * placedCenters.length)];
        let walkX = anchor.x;
        let walkY = anchor.y;
        const walkSteps = 3 + Math.floor(rng() * 12);

        for (let step = 0; step < walkSteps; step += 1) {
          const directionRoll = rng();
          if (directionRoll < 0.25) {
            walkX -= 1;
          } else if (directionRoll < 0.5) {
            walkX += 1;
          } else if (directionRoll < 0.75) {
            walkY -= 1;
          } else {
            walkY += 1;
          }
          walkX = Math.max(0, Math.min(state.width - 1, walkX));
          walkY = Math.max(0, Math.min(state.height - 1, walkY));
        }

        const walkedTile = state.tiles[tileIndex(walkX, walkY, state.width)];
        if (walkedTile && !walkedTile.waterType && !isRockTile(walkedTile)
          && computeGroundFungusSoilMatch(fungus, walkedTile) > 0) {
          centerTile = walkedTile;
        }
      }

      if (!centerTile) {
        continue;
      }

      placedCenters.push({ x: centerTile.x, y: centerTile.y });
      const zoneRadius = rangeRollIntRandom(fungus.zoneRadiusRange, rng, 3);
      const zoneId = `${fungus.id}:${zoneIndex + 1}`;

      for (let oy = -zoneRadius; oy <= zoneRadius; oy += 1) {
        for (let ox = -zoneRadius; ox <= zoneRadius; ox += 1) {
          const nx = centerTile.x + ox;
          const ny = centerTile.y + oy;
          if (!inBounds(nx, ny, state.width, state.height)) {
            continue;
          }
          if (Math.hypot(ox, oy) > zoneRadius) {
            continue;
          }

          const tile = state.tiles[tileIndex(nx, ny, state.width)];
          if (tile.waterType || isRockTile(tile)) {
            continue;
          }
          if (tile.groundFungusZone && tile.groundFungusZone.speciesId !== fungus.id) {
            continue;
          }
          if (tile.groundFungusZone && tile.groundFungusZone.speciesId === fungus.id) {
            continue;
          }
          if (computeGroundFungusSoilMatch(fungus, tile) <= 0) {
            continue;
          }

          assignGroundFungusZoneToTile(tile, fungus, zoneId);
        }
      }
    }
  }

  state.groundFungusZonesGenerated = true;
}

function generateBeehivesInternal(state, rng) {
  if (state.beehivesGenerated) {
    return;
  }

  const candidates = [];
  for (const plant of Object.values(state.plants || {})) {
    if (!plant?.alive) {
      continue;
    }

    const species = PLANT_BY_ID[plant.speciesId];
    if (!species || species.longevity !== 'perennial') {
      continue;
    }
    if (lifeStageSize(species, plant.stageName) < 8) {
      continue;
    }

    const tile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
    if (!tile || tile.waterType || tile.deadLog || isRockTile(tile) || tile.beehive) {
      continue;
    }

    const moisture = Number(tile.moisture) || 0;
    const fertility = Number(tile.fertility) || 0;
    const shade = Number(tile.shade) || 0;
    const score = moisture * 0.45 + fertility * 0.4 + (1 - shade) * 0.15 + rng() * 0.35;
    candidates.push({ tile, score });
  }

  if (candidates.length === 0) {
    state.beehivesGenerated = true;
    return;
  }

  candidates.sort((a, b) => b.score - a.score);
  const targetCount = Math.max(1, Math.min(candidates.length, Math.round(candidates.length * 0.15)));
  for (const { tile } of candidates.slice(0, targetCount)) {
    tile.beehive = {
      speciesId: BEEHIVE_SPECIES_ID,
      yieldCurrentHoneyGrams: 0,
      yieldCurrentLarvaeGrams: 0,
      yieldCurrentBeeswaxGrams: 0,
      active: false,
      lastHarvestYear: null,
      lastHarvestDay: null,
    };
  }

  state.beehivesGenerated = true;
  applyBeehiveSeasonalState(state);
}

function generateSquirrelCachesInternal(state, rng, options = {}) {
  const regenerate = options.regenerate === true;
  if (state.squirrelCachesGenerated && !regenerate) {
    return;
  }

  if (regenerate) {
    clearSquirrelCaches(state);
  }

  const cacheItemPool = resolveSquirrelCacheItemPool(state);
  const runSpeciesPool = [...new Set(cacheItemPool.map((item) => item.speciesId))];
  const squirrelDensityByTile = buildSquirrelDensityByTile(state);
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
    ...selectSquirrelCacheCandidatesWithSpread(groundCandidates, groundTarget)
      .map((entry) => ({ ...entry, placementType: 'ground' })),
    ...selectSquirrelCacheCandidatesWithSpread(deadTreeCandidates, deadTarget)
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

function normalizeInProgressTicks(value, fallback = 1) {
  const parsed = Number.isInteger(value)
    ? value
    : Math.floor(Number(value || 0));
  if (parsed > 0) {
    return parsed;
  }
  return Math.max(1, Math.floor(Number(fallback) || 1));
}

function isInProgressActionEnvelope(action) {
  return Boolean(
    action
      && action.__inProgressAction === true
      && action.normalizedAction
      && typeof action.normalizedAction === 'object',
  );
}

function createInProgressActionEnvelope(action, remainingTicks, totalTicks, budgetConsumed = false) {
  const normalizedAction = action && typeof action === 'object'
    ? {
      ...action,
      payload: action.payload && typeof action.payload === 'object'
        ? { ...action.payload }
        : {},
    }
    : {};

  const normalizedTotal = normalizeInProgressTicks(totalTicks, normalizedAction.tickCost);
  const normalizedRemaining = normalizeInProgressTicks(remainingTicks, normalizedTotal);

  return {
    __inProgressAction: true,
    actionId: typeof normalizedAction.actionId === 'string' ? normalizedAction.actionId : null,
    actorId: typeof normalizedAction.actorId === 'string' ? normalizedAction.actorId : null,
    kind: typeof normalizedAction.kind === 'string' ? normalizedAction.kind : null,
    issuedAtTick: Number.isInteger(normalizedAction.issuedAtTick)
      ? normalizedAction.issuedAtTick
      : 0,
    normalizedAction,
    remainingTicks: normalizedRemaining,
    totalTicks: normalizedTotal,
    budgetConsumed: budgetConsumed === true,
  };
}

export function advanceTick(state, options = {}) {
  let nextState = advanceDay(state, 0);
  ensureTickSystems(nextState);

  const incomingActions = Array.isArray(options?.actions)
    ? options.actions.map((action) => ({ ...(action || {}) }))
    : [];
  const idleTicks = Number.isInteger(options?.idleTicks) ? Math.max(0, options.idleTicks) : 0;

  nextState.pendingActionQueue = sortActionsDeterministically([
    ...(nextState.pendingActionQueue || []),
    ...incomingActions,
  ]);

  const processedLogEntries = [];
  const deferredActions = [];
  for (const rawAction of nextState.pendingActionQueue) {
    let action = null;
    let actor = null;
    let totalTicks = 1;
    let remainingTicks = 1;
    let budgetConsumed = false;

    if (isInProgressActionEnvelope(rawAction)) {
      action = rawAction.normalizedAction;
      actor = nextState.actors?.[action.actorId] || null;
      totalTicks = normalizeInProgressTicks(rawAction.totalTicks, action.tickCost);
      remainingTicks = normalizeInProgressTicks(rawAction.remainingTicks, totalTicks);
      budgetConsumed = rawAction.budgetConsumed === true;

      if (!actor) {
        processedLogEntries.push({
          actionId: typeof action?.actionId === 'string' ? action.actionId : null,
          actorId: typeof action?.actorId === 'string' ? action.actorId : null,
          kind: typeof action?.kind === 'string' ? action.kind : null,
          status: 'rejected',
          code: 'missing_actor',
          message: 'in-progress action actor does not exist',
          startedAtTick: nextState.dayTick,
          endedAtTick: nextState.dayTick,
        });
        continue;
      }
    } else {
      const validation = validateActionDefinition(nextState, rawAction, {
        fallbackIssuedAtTick: nextState.dayTick,
      });

      if (!validation.ok) {
        processedLogEntries.push({
          actionId: typeof rawAction?.actionId === 'string' ? rawAction.actionId : null,
          actorId: typeof rawAction?.actorId === 'string' ? rawAction.actorId : null,
          kind: typeof rawAction?.kind === 'string' ? rawAction.kind : null,
          status: 'rejected',
          code: validation.code,
          message: validation.message,
          startedAtTick: nextState.dayTick,
          endedAtTick: nextState.dayTick,
        });
        continue;
      }

      action = validation.normalizedAction;
      actor = nextState.actors[action.actorId] || null;
      totalTicks = Number.isInteger(action.tickCost) ? action.tickCost : 1;
      remainingTicks = totalTicks;
      budgetConsumed = false;
    }

    const startedAtTick = nextState.dayTick;
    const resumable = isResumablePlayerAction(action);
    if (!resumable) {
      applyActionEffect(nextState, action);
      if (actor) {
        consumeActorTickBudget(actor, totalTicks);
      }

      for (let i = 0; i < totalTicks; i += 1) {
        nextState = advanceOneTick(nextState);
      }

      processedLogEntries.push({
        actionId: action.actionId,
        actorId: action.actorId,
        kind: action.kind,
        status: 'applied',
        code: null,
        message: 'ok',
        tickCost: totalTicks,
        startedAtTick,
        endedAtTick: nextState.dayTick,
      });
      continue;
    }

    const isFishRodCast = action.kind === 'fish_rod_cast';
    if (!budgetConsumed && actor && !isFishRodCast) {
      consumeActorTickBudget(actor, totalTicks);
      budgetConsumed = true;
    }

    let ticksExecuted = 0;
    let interrupted = false;
    let fishBiteResolved = false;
    while (ticksExecuted < remainingTicks) {
      const currentActor = nextState.actors?.[action.actorId] || null;
      if (!currentActor || (Number(currentActor.health) || 0) <= 0) {
        interrupted = true;
        break;
      }

      if (isFishRodCast) {
        const fishTickOutcome = resolveFishRodTickOutcome(nextState, action, currentActor, ticksExecuted);
        consumeActorTickBudget(currentActor, 1);
        budgetConsumed = true;
        nextState = advanceOneTick(nextState);
        ticksExecuted += 1;
        if (fishTickOutcome?.biteResolved === true) {
          fishBiteResolved = true;
          break;
        }
        continue;
      }

      nextState = advanceOneTick(nextState);
      ticksExecuted += 1;
    }

    const ticksRemaining = Math.max(0, remainingTicks - ticksExecuted);
    if (interrupted && ticksRemaining > 0) {
      if (action.kind === 'dig') {
        const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : null;
        const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : null;
        const canMarkTile = Number.isInteger(targetX)
          && Number.isInteger(targetY)
          && inBounds(targetX, targetY, nextState.width, nextState.height);
        const digTicksRequired = Math.max(1, totalTicks);
        const digTicksCompleted = Math.max(0, digTicksRequired - ticksRemaining);
        const digCompletionRatio = Math.max(0, Math.min(1, digTicksCompleted / digTicksRequired));
        const digProgressSnapshot = {
          ticksRequired: digTicksRequired,
          ticksCompleted: digTicksCompleted,
          ticksRemaining,
          completionRatio: Number(digCompletionRatio.toFixed(4)),
          interrupted: true,
        };

        if (canMarkTile) {
          const tile = nextState.tiles[tileIndex(targetX, targetY, nextState.width)];
          if (tile) {
            tile.disturbed = true;
            tile.lastDigProgress = {
              ...digProgressSnapshot,
              actorId: action.actorId,
              x: targetX,
              y: targetY,
              day: Number(nextState.totalDaysSimulated) || 0,
              dayTick: Number(nextState.dayTick) || 0,
            };
          }
        }

        const digActor = nextState.actors?.[action.actorId] || null;
        if (digActor) {
          digActor.lastDig = {
            x: canMarkTile ? targetX : Number(action.payload?.x) || Number(digActor.x) || 0,
            y: canMarkTile ? targetY : Number(action.payload?.y) || Number(digActor.y) || 0,
            day: Number(nextState.totalDaysSimulated) || 0,
            dayTick: Number(nextState.dayTick) || 0,
            interruptedBySquirrelCache: false,
            ...digProgressSnapshot,
          };
        }
      }

      deferredActions.push(createInProgressActionEnvelope(action, ticksRemaining, totalTicks, budgetConsumed));
      processedLogEntries.push({
        actionId: action.actionId,
        actorId: action.actorId,
        kind: action.kind,
        status: 'interrupted',
        code: 'actor_unavailable',
        message: 'action interrupted; progress preserved for later resume',
        tickCost: totalTicks,
        ticksExecuted,
        ticksRemaining,
        startedAtTick,
        endedAtTick: nextState.dayTick,
      });
      continue;
    }

    if (!isFishRodCast) {
      applyActionEffect(nextState, action);
    }
    processedLogEntries.push({
      actionId: action.actionId,
      actorId: action.actorId,
      kind: action.kind,
      status: 'applied',
      code: null,
      message: fishBiteResolved ? 'ok (bite_resolved_early)' : 'ok',
      tickCost: isFishRodCast ? ticksExecuted : totalTicks,
      ticksExecuted,
      startedAtTick,
      endedAtTick: nextState.dayTick,
    });
  }

  nextState.pendingActionQueue = sortActionsDeterministically(deferredActions);

  for (let i = 0; i < idleTicks; i += 1) {
    nextState = advanceOneTick(nextState);
  }

  nextState.currentDayActionLog = [
    ...(nextState.currentDayActionLog || []),
    ...processedLogEntries,
  ];

  return nextState;
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

export function getAnimalDensityAtTile(state, animalId, x, y) {
  if (!state?.animalZonesGenerated || !animalId) {
    return 0;
  }
  if (!inBounds(x, y, state.width, state.height)) {
    return 0;
  }
  const tileKey = animalTileDensityKey(x, y);
  return clamp01(Number(state?.animalDensityByZone?.[animalId]?.[tileKey]) || 0);
}

export function getFishDensityAtTile(state, speciesId, x, y) {
  if (!state?.fishPopulationsGenerated || !speciesId) {
    return 0;
  }
  if (!inBounds(x, y, state.width, state.height)) {
    return 0;
  }
  const tile = state.tiles[tileIndex(x, y, state.width)];
  if (!tile?.waterType) {
    return 0;
  }
  const tileKey = animalTileDensityKey(x, y);
  return clamp01(Number(state?.fishDensityByTile?.[speciesId]?.[tileKey]) || 0);
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

function findPartAndSubStage(species, partName, subStageId) {
  const part = (species.parts || []).find((candidate) => candidate.name === partName);
  if (!part) {
    return { part: null, subStage: null };
  }

  const subStage = (part.subStages || []).find((candidate) => candidate.id === subStageId) || null;
  return { part, subStage };
}

function ensureHarvestEntryState(entry, subStage) {
  if (!entry || !subStage) {
    return;
  }

  const rolledActions = rangeRollInt(subStage.harvest_yield?.actions_until_depleted, entry.initialActionsRoll || 1);
  if (!Number.isInteger(entry.initialActionsRoll) || entry.initialActionsRoll < 1) {
    entry.initialActionsRoll = rolledActions;
  }

  const regrowthMax = Number.isInteger(subStage.regrowth_max_harvests) && subStage.regrowth_max_harvests > 0
    ? subStage.regrowth_max_harvests
    : 1;
  entry.seasonalHarvestBudgetActions = Math.max(1, entry.initialActionsRoll * regrowthMax);

  if (!Number.isInteger(entry.remainingActions) || entry.remainingActions < 0) {
    entry.remainingActions = entry.initialActionsRoll;
  }
  if (!Number.isInteger(entry.harvestsThisSeason) || entry.harvestsThisSeason < 0) {
    entry.harvestsThisSeason = 0;
  }
  if (!Number.isFinite(entry.vitalityDamageAppliedThisSeason) || entry.vitalityDamageAppliedThisSeason < 0) {
    entry.vitalityDamageAppliedThisSeason = 0;
  }
  if (entry.regrowthCountdown === undefined) {
    entry.regrowthCountdown = null;
  }
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

    ensureHarvestEntryState(entry, subStage);
    entry.regrowthCountdown -= 1;
    if (entry.regrowthCountdown <= 0) {
      entry.regrowthCountdown = null;
      entry.remainingActions = entry.initialActionsRoll;
    }
  }
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
  const species = PLANT_BY_ID[plantInstance.speciesId];

  plantInstance.age += 1;
  let stage = stageForDay(species, plantInstance.age, state.dayOfYear);

  if (stage && species.longevity !== 'perennial') {
    const terminalMinAge = maxLifeStageMinAge(species);
    if (plantInstance.age > terminalMinAge) {
      const maxLifecycleYear = maxLifecycleYearOrdinal(species);
      if (Number.isFinite(maxLifecycleYear)) {
        const stageLifecycleYear = lifecycleYearOrdinal(stage.stage);
        if (!Number.isFinite(stageLifecycleYear) || stageLifecycleYear < maxLifecycleYear) {
          stage = null;
        }
      } else if (stage.min_age_days < terminalMinAge) {
        stage = null;
      }
    }
  }

  if (!stage && species.longevity !== 'perennial') {
    plantInstance.alive = false;
    return;
  }

  if (stage) {
    plantInstance.stageName = stage.stage;
  }

  const isOldPerennial = species.longevity === 'perennial'
    && Number.isFinite(species.ageOfMaturity)
    && plantInstance.age >= species.ageOfMaturity * 2;
  if (isOldPerennial && getSeason(state.dayOfYear) === 'winter' && rng() < PERENNIAL_WINTER_DAILY_DEATH_RATE) {
    plantInstance.alive = false;
    return;
  }

  plantInstance.activeSubStages = buildActiveSubStages(
    species,
    plantInstance.stageName,
    state.dayOfYear,
    plantInstance.activeSubStages,
  );
  advanceActiveSubStageRegrowth(plantInstance, species, state.dayOfYear);

  disperseSeeds(state, plantInstance, species, rng);
}

export function applyHarvestAction(state, plantId, partName, subStageId, options = {}) {
  const plant = state?.plants?.[plantId];
  if (!plant || !plant.alive) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'missing_plant' };
  }

  const species = PLANT_BY_ID[plant.speciesId];
  if (!species) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'missing_species' };
  }

  const { part, subStage } = findPartAndSubStage(species, partName, subStageId);
  if (!part || !subStage) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'missing_part_or_sub_stage' };
  }

  const entry = (plant.activeSubStages || []).find(
    (candidate) => candidate.partName === partName && candidate.subStageId === subStageId,
  );
  if (!entry) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'inactive_sub_stage' };
  }

  if (Number.isInteger(entry.regrowthCountdown) && entry.regrowthCountdown > 0) {
    return { appliedActions: 0, vitalityLoss: 0, depleted: false, blocked: 'regrowing' };
  }

  const requestedActions = Math.max(1, Math.floor(options.actions ?? 1));
  ensureHarvestEntryState(entry, subStage);

  let appliedActions = 0;
  let vitalityLoss = 0;
  let depleted = false;

  while (appliedActions < requestedActions && plant.alive) {
    if (!Number.isInteger(entry.remainingActions) || entry.remainingActions <= 0) {
      break;
    }

    entry.remainingActions -= 1;
    appliedActions += 1;

    const actionDamage = perActionVitalityDamage(subStage, entry);
    if (actionDamage > 0) {
      plant.vitality = clamp01(plant.vitality - actionDamage);
      entry.vitalityDamageAppliedThisSeason += actionDamage;
      vitalityLoss += actionDamage;
      if (plant.vitality <= 0) {
        plant.alive = false;
      }
    }

    if (entry.remainingActions <= 0) {
      depleted = true;
      entry.harvestsThisSeason += 1;

      const regrowthDays = Number.isInteger(subStage.regrowth_days) ? subStage.regrowth_days : null;
      const regrowthMax = Number.isInteger(subStage.regrowth_max_harvests) ? subStage.regrowth_max_harvests : null;
      const canRegrow = Number.isInteger(regrowthDays)
        && regrowthDays > 0
        && Number.isInteger(regrowthMax)
        && regrowthMax > 0
        && entry.harvestsThisSeason < regrowthMax;

      if (canRegrow) {
        entry.regrowthCountdown = regrowthDays;
        break;
      }

      plant.activeSubStages = (plant.activeSubStages || []).filter(
        (candidate) => !(candidate.partName === partName && candidate.subStageId === subStageId),
      );
      break;
    }
  }

  return {
    appliedActions,
    vitalityLoss,
    depleted,
    blocked: appliedActions > 0 ? null : 'no_actions_remaining',
  };
}

function processDormantSeeds(state, rng) {
  const currentSeason = getSeason(state.dayOfYear);

  for (const tile of state.tiles) {
    if (isRockTile(tile)) {
      tile.dormantSeeds = {};
      continue;
    }

    const seedEntries = Object.entries(tile.dormantSeeds);
    if (seedEntries.length === 0) {
      continue;
    }

    for (const [speciesId, entry] of seedEntries) {
      const species = PLANT_BY_ID[speciesId];
      entry.ageDays += 1;

      if (entry.ageDays > species.dispersal.viable_lifespan_days) {
        delete tile.dormantSeeds[speciesId];
        continue;
      }

      if (species.dispersal.germination_season !== currentSeason) {
        continue;
      }

      if (tile.plantIds.length >= MAX_PLANTS_PER_TILE) {
        continue;
      }

      const isDisturbed = tile.disturbed === true;
      if (!isPlantWithinEnvironmentalTolerance(species, tile)) {
        continue;
      }

      const soilMatch = computeSoilMatch(species, tile);
      const methodModifier = species.dispersal.method === 'animal_eaten' ? 0.7 : 1;
      const disturbanceModifier = species.dispersal.requires_disturbance && !isDisturbed ? 0.05 : 1;
      const pioneerModifier = species.dispersal.pioneer && isDisturbed ? 2 : 1;
      const chance = Math.min(
        1,
        species.dispersal.germination_rate * soilMatch * methodModifier * disturbanceModifier * pioneerModifier,
      );
      if (rng() > chance) {
        continue;
      }

      const spot = findOpenSpot(state.tiles, state.width, state.height, tile.x, tile.y);
      if (!spot) {
        continue;
      }

      const spotTile = state.tiles[tileIndex(spot.x, spot.y, state.width)];
      if (isTileBlockedForPlantLife(spotTile) || !isPlantWithinEnvironmentalTolerance(species, spotTile)) {
        continue;
      }

      addPlantInstance(state, speciesId, spot.x, spot.y, 0, 'seed');
      delete tile.dormantSeeds[speciesId];
    }
  }
}

function cleanupDeadPlants(state) {
  for (const plantId of Object.keys(state.plants)) {
    const plant = state.plants[plantId];
    if (plant.alive) {
      continue;
    }

    maybeCreateDeadLog(state, plant);
    const tile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
    tile.plantIds = tile.plantIds.filter((id) => id !== plantId);
    delete state.plants[plantId];
  }
}

function reconcilePlantOccupancy(state) {
  for (const tile of state.tiles) {
    if (isRockTile(tile)) {
      tile.plantIds = [];
      continue;
    }

    if (!Array.isArray(tile.plantIds)) {
      tile.plantIds = [];
      continue;
    }

    const validIds = [];
    for (const plantId of tile.plantIds) {
      const plant = state.plants[plantId];
      if (!plant || !plant.alive) {
        continue;
      }
      if (plant.x !== tile.x || plant.y !== tile.y) {
        continue;
      }
      validIds.push(plantId);
      if (validIds.length >= MAX_PLANTS_PER_TILE) {
        break;
      }
    }
    tile.plantIds = validIds;
  }

  for (const [plantId, plant] of Object.entries(state.plants)) {
    if (!plant || !plant.alive) {
      continue;
    }
    if (!inBounds(plant.x, plant.y, state.width, state.height)) {
      delete state.plants[plantId];
      continue;
    }

    const hostTile = state.tiles[tileIndex(plant.x, plant.y, state.width)];
    if (isRockTile(hostTile)) {
      delete state.plants[plantId];
      continue;
    }

    if (!hostTile.plantIds.includes(plantId)) {
      if (hostTile.plantIds.length < MAX_PLANTS_PER_TILE) {
        hostTile.plantIds.push(plantId);
      } else {
        delete state.plants[plantId];
      }
    }
  }
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
    applyDailyWaterFreezeState(nextState);
    nextState.recentDispersal = createEmptyRecentDispersal(nextState.dayOfYear);
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
    applyLogFungusFruiting(nextState, rng);
    applyGroundFungusFruiting(nextState, rng);
    applyBeehiveSeasonalState(nextState);
    applyFishPopulationRecovery(nextState);
    applyDailyItemDecay(nextState);
    applyDailySapTapFill(nextState);
    applyDailySimpleSnareResolution(nextState);
    applyDailyDeadfallTrapResolution(nextState);
    applyDailyFishTrapResolution(nextState);
    applyDailyAutoRodResolution(nextState);

    nextState.dayOfYear += 1;
    nextState.totalDaysSimulated += 1;

    if (nextState.dayOfYear > 40) {
      nextState.dayOfYear = 1;
      nextState.year += 1;
      advanceDeadLogDecayByYear(nextState);
      refillSquirrelCachesByYear(nextState);
    }

    rollDailyWeatherForCurrentDay(nextState, rng);
  }

  return nextState;
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
