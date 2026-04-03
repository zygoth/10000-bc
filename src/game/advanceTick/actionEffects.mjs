import {
  resolveCurrentSeasonKey,
  resolveVisionRevelationChoices,
  runDebriefVisionConfirm,
  runDebriefMedicinePass,
  runDebriefVisionRequest,
} from '../medicineDebrief.mjs';
import { PLANT_BY_ID } from '../plantCatalog.mjs';
import { TECH_RESEARCHABLE_UNLOCK_KEYS, getTechResearchMeta } from '../techResearchCatalog.mjs';
import { getTechForestNode } from '../techForestGen.mjs';
import { parsePlantPartItemId } from '../plantPartDescriptors.mjs';
import {
  harvestYieldScaleFactor,
  scaledUnitsPerHarvestActionMidpoint,
} from '../harvestYieldResolve.mjs';
import { HUNGER_BAR_CALORIES } from '../simCore.constants.mjs';
import { isTileWithinCampFootprint } from '../campFootprint.mjs';
import {
  autoRodBaitStackFromInventoryStack,
  defaultLandTrapBaitStackFromItemId,
  landTrapBaitStackFromInventoryStack,
  landTrapHasBait,
} from '../trapBaitLand.mjs';

export function applyActionEffectImpl(state, action, deps) {
  const {
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
    applyActorInventoryRelocation,
    resolveItemFootprint,
    maybeCreateDeadLog,
    applyHarvestAction,
    applyHarvestInjuryFromSubStage,
    normalizePartnerTask,
    mirrorPartnerTaskQueueToActor,
    ensurePartnerCampMaintenanceQueued,
    addActorInventoryItem,
    maxQuantityActorInventoryCanAccept,
    pickupAddOptionsFromWorldStack,
  } = deps;

  const resolveLandTrapBaitStack = (trap) => {
    if (trap?.baitStack && (Number(trap.baitStack.quantity) || 0) > 0) {
      return trap.baitStack;
    }
    if (typeof trap?.baitItemId === 'string' && trap.baitItemId) {
      return defaultLandTrapBaitStackFromItemId(trap.baitItemId);
    }
    return null;
  };

  const isActorAtCampAnchor = (candidate) => {
    const campX = Number(state?.camp?.anchorX);
    const campY = Number(state?.camp?.anchorY);
    if (!Number.isInteger(campX) || !Number.isInteger(campY) || !candidate) {
      return false;
    }
    return Number(candidate.x) === campX && Number(candidate.y) === campY;
  };

  const refillActorWaterskinsToSafe = (candidate) => {
    const stacks = Array.isArray(candidate?.inventory?.stacks) ? candidate.inventory.stacks : null;
    if (!stacks) {
      return 0;
    }

    let converted = 0;
    for (const stack of stacks) {
      const itemId = typeof stack?.itemId === 'string' ? stack.itemId : '';
      const quantity = Math.floor(Number(stack?.quantity) || 0);
      if (!itemId || quantity <= 0) {
        continue;
      }
      if (!parseWaterskinStateItemId(itemId)) {
        continue;
      }
      if (itemId !== 'tool:waterskin_safe_3') {
        stack.itemId = 'tool:waterskin_safe_3';
        converted += 1;
      }
    }

    return converted;
  };

  const ensureDebriefState = () => {
    if (!state?.camp || typeof state.camp !== 'object') {
      return null;
    }
    if (!state.camp.debrief || typeof state.camp.debrief !== 'object') {
      state.camp.debrief = {
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
      };
    } else {
      if (!Array.isArray(state.camp.debrief.medicineRequests)) {
        state.camp.debrief.medicineRequests = [];
      }
      if (!Array.isArray(state.camp.debrief.medicineNotifications)) {
        state.camp.debrief.medicineNotifications = [];
      }
      if (!Array.isArray(state.camp.debrief.visionNotifications)) {
        state.camp.debrief.visionNotifications = [];
      }
      if (!state.camp.debrief.visionRequest || typeof state.camp.debrief.visionRequest !== 'object') {
        state.camp.debrief.visionRequest = null;
      }
      if (!Array.isArray(state.camp.debrief.visionSelectionOptions)) {
        state.camp.debrief.visionSelectionOptions = [];
      }
      if (typeof state.camp.debrief.requiresVisionConfirmation !== 'boolean') {
        state.camp.debrief.requiresVisionConfirmation = false;
      }
      if (state.camp.debrief.openedAtDay !== null && !Number.isInteger(state.camp.debrief.openedAtDay)) {
        state.camp.debrief.openedAtDay = null;
      }
      if (!Number.isInteger(state.camp.debrief.visionUsesThisSeason)) {
        state.camp.debrief.visionUsesThisSeason = 0;
      }
      if (typeof state.camp.debrief.visionSeasonKey !== 'string') {
        state.camp.debrief.visionSeasonKey = null;
      }
      if (!state.camp.debrief.pendingVisionRevelation || typeof state.camp.debrief.pendingVisionRevelation !== 'object') {
        state.camp.debrief.pendingVisionRevelation = null;
      }
      if (!Array.isArray(state.camp.debrief.pendingVisionChoices)) {
        state.camp.debrief.pendingVisionChoices = [];
      }
      if (!Array.isArray(state.camp.debrief.chosenVisionRewards)) {
        state.camp.debrief.chosenVisionRewards = [];
      }
      state.camp.debrief.active = state.camp.debrief.active === true;
    }
    return state.camp.debrief;
  };

  const ensureActorVisionState = (candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return;
    }
    if (!Number.isInteger(candidate.visionNextDayTickPenalty)) {
      candidate.visionNextDayTickPenalty = 0;
    }
    if (!Number.isInteger(candidate.natureSightDaysRemaining)) {
      candidate.natureSightDaysRemaining = 0;
    }
    if (!Number.isInteger(candidate.natureSightPendingDays)) {
      candidate.natureSightPendingDays = 0;
    }
    if (typeof candidate.natureSightOverlayChoice !== 'string') {
      candidate.natureSightOverlayChoice = null;
    }
    if (!Number.isInteger(candidate.natureSightOverlayChosenDay)) {
      candidate.natureSightOverlayChosenDay = null;
    }
    if (typeof candidate.natureSightPlantSpeciesId !== 'string') {
      candidate.natureSightPlantSpeciesId = null;
    }
    if (typeof candidate.natureSightAnimalSpeciesId !== 'string') {
      candidate.natureSightAnimalSpeciesId = null;
    }
    if (typeof candidate.natureSightFishSpeciesId !== 'string') {
      candidate.natureSightFishSpeciesId = null;
    }
    if (!candidate.visionRewardCounts || typeof candidate.visionRewardCounts !== 'object') {
      candidate.visionRewardCounts = {
        plant: 0,
        tech: 0,
        sight: 0,
      };
    }
  };

  const actor = state?.actors?.[action.actorId];
  if (!actor) {
    return;
  }

  if (action.kind === 'move') {
    const wasAtCamp = isActorAtCampAnchor(actor);
    const dx = Number(action.payload?.dx) || 0;
    const dy = Number(action.payload?.dy) || 0;
    const nextX = Number(actor.x) + dx;
    const nextY = Number(actor.y) + dy;
    if (!inBounds(nextX, nextY, state.width, state.height)) {
      return;
    }
    const destinationTile = state.tiles[tileIndex(nextX, nextY, state.width)];
    if (!destinationTile || isRockTile(destinationTile)) {
      return;
    }
    actor.x += dx;
    actor.y += dy;
    if ((actor.id === 'player' || action.actorId === 'player') && !wasAtCamp && isActorAtCampAnchor(actor)) {
      const converted = refillActorWaterskinsToSafe(actor);
      if (converted > 0) {
        actor.lastWaterskin = {
          type: 'auto_refill_camp',
          toItemId: 'tool:waterskin_safe_3',
          day: Number(state.totalDaysSimulated) || 0,
          dayTick: Number(state.dayTick) || 0,
        };
      }
    }
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

    const tileKey = `${targetX},${targetY}`;
    const worldStacks = Array.isArray(state.worldItemsByTile?.[tileKey]) ? state.worldItemsByTile[tileKey] : [];
    const worldStack = findPreferredStackByItem(worldStacks, itemId, requestedQty);
    const availableWorld = Math.max(0, Math.floor(Number(worldStack?.quantity) || 0));
    if (availableWorld <= 0) {
      return;
    }
    const wantQty = Math.min(requestedQty, availableWorld);
    const previewOpts = pickupAddOptionsFromWorldStack(worldStack);
    const takeQty = maxQuantityActorInventoryCanAccept(actor, itemId, wantQty, previewOpts);
    if (takeQty <= 0) {
      return;
    }

    const extracted = removeWorldItemAtTile(state, targetX, targetY, itemId, takeQty);
    if (extracted.consumed <= 0) {
      return;
    }

    const pickupOpts = {
      freshness: extracted.freshness,
      decayDaysRemaining: extracted.decayDaysRemaining,
      dryness: extracted.dryness,
      tanninRemaining: extracted.tanninRemaining,
      unitWeightKg: extracted.unitWeightKg,
      footprintW: extracted.footprintW,
      footprintH: extracted.footprintH,
    };
    addActorInventoryItem(actor, itemId, extracted.consumed, pickupOpts);

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
      tanninRemaining: extracted.tanninRemaining,
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

    const digUnearthedDelta = Math.max(0, Math.floor(Number(actor?.pendingDigUnearthedDelta) || 0));
    delete actor.pendingDigUnearthedDelta;

    tile.disturbed = true;
    const earthwormDrop = trySpawnEarthwormFromDig(state, actor, tile, targetX, targetY);
    actor.lastDig = {
      x: targetX,
      y: targetY,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
      interruptedBySquirrelCache: discoveredSquirrelCache,
      discoveredUndergroundTargetsCount: digUnearthedDelta,
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

    const plantsToRemove = (tile.plantIds || []).filter((plantId) => {
      const plant = state.plants[plantId];
      if (!plant?.alive) return false;
      const species = PLANT_BY_ID[plant.speciesId];
      const stage = species?.lifeStages?.find((s) => s.stage === plant.stageName);
      return Number.isFinite(stage?.size) && stage.size <= 4;
    });
    for (const plantId of plantsToRemove) {
      if (state.plants[plantId]) {
        state.plants[plantId].alive = false;
        delete state.plants[plantId];
      }
    }
    if (plantsToRemove.length > 0) {
      tile.plantIds = (tile.plantIds || []).filter((id) => !plantsToRemove.includes(id));
    }
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
        tanninRemaining: Number(output?.tanninRemaining),
      });
    }

    actor.hunger = clamp01((Number(actor.hunger) || 0) + (0.05 * consumedQty));
    actor.thirst = clamp01((Number(actor.thirst) || 0) + (0.015 * consumedQty));
    actor.health = clamp01((Number(actor.health) || 0) + (0.02 * consumedQty));
    return;
  }

  if (action.kind === 'waterskin_fill') {
    const fromItemId = typeof action.payload?.fromItemId === 'string' ? action.payload.fromItemId : '';
    const toItemId = typeof action.payload?.toItemId === 'string' ? action.payload.toItemId : '';
    const sourceType = typeof action.payload?.sourceType === 'string' ? action.payload.sourceType : null;
    if (!fromItemId || !toItemId) {
      return;
    }

    const fromState = parseWaterskinStateItemId(fromItemId);
    const toState = parseWaterskinStateItemId(toItemId);
    if (!fromState || !toState || toState.drinks <= fromState.drinks) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, fromItemId, 1);
    if (consumed <= 0) {
      return;
    }

    addActorInventoryItemWithOverflowDrop(state, actor, toItemId, 1);
    actor.lastWaterskin = {
      type: 'fill',
      fromItemId,
      toItemId,
      sourceType,
      waterX: Number.isInteger(action.payload?.waterX) ? action.payload.waterX : null,
      waterY: Number.isInteger(action.payload?.waterY) ? action.payload.waterY : null,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'waterskin_drink') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const toItemId = typeof action.payload?.toItemId === 'string' ? action.payload.toItemId : '';
    const sourceType = typeof action.payload?.sourceType === 'string' ? action.payload.sourceType : null;
    if (!itemId || !toItemId) {
      return;
    }

    const fromState = parseWaterskinStateItemId(itemId);
    const toState = parseWaterskinStateItemId(toItemId);
    if (!fromState || !toState || fromState.drinks <= toState.drinks) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, itemId, 1);
    if (consumed <= 0) {
      return;
    }

    addActorInventoryItemWithOverflowDrop(state, actor, toItemId, 1);
    actor.thirst = clamp01((Number(actor.thirst) || 0) + WATERSKIN_DRINK_THIRST_GAIN);

    const illness = maybeApplyGutIllnessFromWaterskin(state, actor, action, sourceType);
    actor.lastWaterskin = {
      type: 'drink',
      fromItemId: itemId,
      toItemId,
      sourceType,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
      gutIllness: illness,
    };
    return;
  }

  if (action.kind === 'water_drink') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const sourceType = typeof action.payload?.sourceType === 'string' ? action.payload.sourceType : null;

    if (sourceType === 'safe') {
      if (!isTileWithinCampFootprint(state, targetX, targetY)) {
        return;
      }
      actor.thirst = 1;
      const illness = maybeApplyGutIllnessFromWaterskin(state, actor, action, sourceType);
      actor.lastWaterDrink = {
        x: targetX,
        y: targetY,
        sourceType,
        day: Number(state.totalDaysSimulated) || 0,
        dayTick: Number(state.dayTick) || 0,
        gutIllness: illness,
      };
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || !tile.waterType || tile.waterFrozen === true) {
      return;
    }

    if (sourceType !== 'pond' && sourceType !== 'river') {
      return;
    }

    actor.thirst = 1;
    const illness = maybeApplyGutIllnessFromWaterskin(state, actor, action, sourceType);
    actor.lastWaterDrink = {
      x: targetX,
      y: targetY,
      sourceType,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
      gutIllness: illness,
    };
    return;
  }

  if (action.kind === 'leaching_basket_place') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || !tile.waterType || tile.waterFrozen === true || tile?.leachingBasket?.active === true) {
      return;
    }

    const basketConsumed = removeActorInventoryItem(actor, 'tool:leaching_basket', 1);
    if (basketConsumed <= 0) {
      return;
    }

    const sourceItemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const quantity = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    const extracted = sourceItemId && quantity > 0
      ? extractActorInventoryItemWithMetadata(actor, sourceItemId, quantity)
      : null;
    if (!extracted || extracted.quantity <= 0) {
      addActorInventoryItemWithOverflowDrop(state, actor, 'tool:leaching_basket', 1, {
        footprintW: 2,
        footprintH: 2,
      });
      return;
    }

    tile.leachingBasket = {
      active: true,
      itemId: extracted.itemId,
      quantity: extracted.quantity,
      freshness: extracted.freshness,
      decayDaysRemaining: extracted.decayDaysRemaining,
      dryness: extracted.dryness,
      tanninRemaining: Number.isFinite(Number(action.payload?.tanninRemaining))
        ? clamp01(Number(action.payload.tanninRemaining))
        : Number.isFinite(Number(extracted.tanninRemaining))
          ? clamp01(Number(extracted.tanninRemaining))
          : null,
      unitWeightKg: extracted.unitWeightKg,
      footprintW: extracted.footprintW,
      footprintH: extracted.footprintH,
      placedYear: Number(state.year) || 1,
      placedDay: Number(state.dayOfYear) || 1,
      placedDayTick: Number(state.dayTick) || 0,
      lastResolvedYear: null,
      lastResolvedDay: null,
    };
    actor.lastLeachingBasket = {
      type: 'place',
      x: targetX,
      y: targetY,
      itemId: extracted.itemId,
      quantity: extracted.quantity,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'leaching_basket_retrieve') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    const basketState = tile?.leachingBasket;
    if (!tile || !basketState || basketState.active !== true) {
      return;
    }

    addActorInventoryItemWithOverflowDrop(state, actor, 'tool:leaching_basket', 1, {
      footprintW: 2,
      footprintH: 2,
    });
    addActorInventoryItemWithOverflowDrop(
      state,
      actor,
      basketState.itemId,
      Math.max(1, Math.floor(Number(basketState.quantity) || 1)),
      {
        freshness: basketState.freshness,
        decayDaysRemaining: basketState.decayDaysRemaining,
        dryness: basketState.dryness,
        tanninRemaining: basketState.tanninRemaining,
        unitWeightKg: basketState.unitWeightKg,
        footprintW: basketState.footprintW,
        footprintH: basketState.footprintH,
      },
    );
    tile.leachingBasket = null;

    actor.lastLeachingBasket = {
      type: 'retrieve',
      x: targetX,
      y: targetY,
      itemId: basketState.itemId,
      quantity: basketState.quantity,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
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
        tanninRemaining: Number(output?.tanninRemaining),
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
        tanninRemaining: Number(output?.tanninRemaining),
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
    const tanninRemaining = Number.isFinite(Number(stack?.tanninRemaining))
      ? Number(stack.tanninRemaining)
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
      tanninRemaining,
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
      tanninRemaining: extracted.tanninRemaining,
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
        tanninRemaining: extracted.tanninRemaining,
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
      tanninRemaining: extracted.tanninRemaining,
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
        tanninRemaining: extracted.tanninRemaining,
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
      tanninRemaining: Number(slot.tanninRemaining),
      unitWeightKg: Number(slot.unitWeightKg),
      footprintW: Number(slot.footprintW),
      footprintH: Number(slot.footprintH),
    });

    state.camp.dryingRack.slots = state.camp.dryingRack.slots.filter((entry) => (Number(entry?.quantity) || 0) > 0);
    return;
  }

  if (action.kind === 'meal_plan_set') {
    if (!state?.camp || typeof state.camp !== 'object') {
      return;
    }
    const ingredients = Array.isArray(action.payload?.ingredients)
      ? action.payload.ingredients.map((entry) => ({ ...(entry || {}) }))
      : [];
    const preview = action.payload?.mealPlanPreview && typeof action.payload.mealPlanPreview === 'object'
      ? { ...action.payload.mealPlanPreview }
      : null;
    state.camp.mealPlan = {
      ingredients,
      preview,
    };
    return;
  }

  if (action.kind === 'meal_plan_commit') {
    if (!state?.camp || typeof state.camp !== 'object') {
      return;
    }

    const ingredients = Array.isArray(action.payload?.ingredients)
      ? action.payload.ingredients
      : (Array.isArray(state?.camp?.mealPlan?.ingredients) ? state.camp.mealPlan.ingredients : []);
    const preview = action.payload?.mealPlanPreview && typeof action.payload.mealPlanPreview === 'object'
      ? action.payload.mealPlanPreview
      : (state?.camp?.mealPlan?.preview && typeof state.camp.mealPlan.preview === 'object' ? state.camp.mealPlan.preview : null);

    for (const ingredient of ingredients) {
      const itemId = typeof ingredient?.itemId === 'string' ? ingredient.itemId : '';
      const quantity = Number.isInteger(ingredient?.quantity)
        ? ingredient.quantity
        : Math.floor(Number(ingredient?.quantity || 0));
      if (!itemId || quantity <= 0) {
        continue;
      }
      removeCampStockpileItem(state.camp, itemId, quantity);
    }

    const perActor = Array.isArray(preview?.perActor) ? preview.perActor : [];
    for (const allocation of perActor) {
      const targetActorId = typeof allocation?.actorId === 'string' ? allocation.actorId : '';
      const targetActor = state?.actors?.[targetActorId];
      if (!targetActor) {
        continue;
      }
      const effectiveCalories = Number(allocation?.effectiveCalories);
      if (!Number.isFinite(effectiveCalories) || effectiveCalories <= 0) {
        continue;
      }
      targetActor.hunger = clamp01((Number(targetActor.hunger) || 0) + (effectiveCalories / HUNGER_BAR_CALORIES));
      targetActor.lastMeal = {
        calories: effectiveCalories,
        day: Number(state.totalDaysSimulated) || 0,
        dayTick: Number(state.dayTick) || 0,
        source: 'stew',
      };
    }

    const existingNausea = state.camp.nauseaByIngredient && typeof state.camp.nauseaByIngredient === 'object'
      ? state.camp.nauseaByIngredient
      : {};
    const usedIngredientIds = new Set(
      ingredients
        .map((entry) => (typeof entry?.itemId === 'string' ? entry.itemId : ''))
        .filter(Boolean),
    );
    const allIngredientIds = new Set([...Object.keys(existingNausea), ...usedIngredientIds]);
    const nauseaGainPerUsedIngredient = Number.isFinite(Number(preview?.nauseaGainPerUsedIngredient))
      ? Number(preview.nauseaGainPerUsedIngredient)
      : 0;
    const nauseaDecayPerAbsent = Number.isFinite(Number(preview?.nauseaDecayPerAbsent))
      ? Number(preview.nauseaDecayPerAbsent)
      : 10;
    const nextNausea = {};
    for (const itemId of allIngredientIds) {
      const previous = Math.max(0, Math.min(100, Number(existingNausea[itemId]) || 0));
      const nextValue = usedIngredientIds.has(itemId)
        ? Math.min(100, previous + nauseaGainPerUsedIngredient)
        : Math.max(0, previous - nauseaDecayPerAbsent);
      if (nextValue > 0) {
        nextNausea[itemId] = nextValue;
      }
    }
    state.camp.nauseaByIngredient = nextNausea;

    state.camp.lastMealResult = preview
      ? {
        ...preview,
        committedAtDay: Number(state.totalDaysSimulated) || 0,
        committedAtDayTick: Number(state.dayTick) || 0,
      }
      : null;
    state.camp.nextDayStewTickBonus = preview?.bonusEligible === true
      ? Math.max(0, Math.floor(Number(preview?.nextDayTickBonus) || 0))
      : 0;
    state.camp.mealPlan = {
      ingredients: [],
      preview: null,
    };
    return;
  }

  if (action.kind === 'camp_stockpile_remove') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const requestedQty = Number.isInteger(action.payload?.quantity)
      ? action.payload.quantity
      : Math.floor(Number(action.payload?.quantity || 1));
    const stockStacks = Array.isArray(state.camp?.stockpile?.stacks) ? state.camp.stockpile.stacks : [];
    const stockStack = findPreferredStackByItem(stockStacks, itemId, requestedQty);
    const availableStock = Math.max(0, Math.floor(Number(stockStack?.quantity) || 0));
    if (availableStock <= 0) {
      return;
    }
    const wantQty = Math.min(requestedQty, availableStock);
    const previewOpts = pickupAddOptionsFromWorldStack(stockStack);
    const takeQty = maxQuantityActorInventoryCanAccept(actor, itemId, wantQty, previewOpts);
    if (takeQty <= 0) {
      return;
    }

    const extracted = removeCampStockpileItem(state.camp, itemId, takeQty);
    if (extracted.consumed <= 0) {
      return;
    }

    addActorInventoryItem(actor, itemId, extracted.consumed, {
      freshness: extracted.freshness,
      decayDaysRemaining: extracted.decayDaysRemaining,
      dryness: extracted.dryness,
      tanninRemaining: extracted.tanninRemaining,
      unitWeightKg: extracted.unitWeightKg,
      footprintW: extracted.footprintW,
      footprintH: extracted.footprintH,
    });
    return;
  }

  if (action.kind === 'camp_station_build') {
    const stationId = typeof action.payload?.stationId === 'string' ? action.payload.stationId : '';
    const placementX = Number.isInteger(action.payload?.x) ? action.payload.x : null;
    const placementY = Number.isInteger(action.payload?.y) ? action.payload.y : null;
    if (!stationId) {
      return;
    }

    if (!state.camp || typeof state.camp !== 'object') {
      return;
    }
    if (!Array.isArray(state.camp.stationsUnlocked)) {
      state.camp.stationsUnlocked = [];
    }
    if (!state.camp.stationPlacements || typeof state.camp.stationPlacements !== 'object') {
      state.camp.stationPlacements = {};
    }
    if (!state.camp.stationsUnlocked.includes(stationId)) {
      state.camp.stationsUnlocked.push(stationId);
    }
    if (Number.isInteger(placementX) && Number.isInteger(placementY)) {
      state.camp.stationPlacements[stationId] = { x: placementX, y: placementY };
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
      baitStack: null,
      baitItemId: null,
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
      baitStack: null,
      baitItemId: null,
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
      baitStack: null,
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
    const autoRodBase = autoRodPendingBefore.length > 0
      ? { ...activeAutoRod, baitStack: null, baitItemId: null }
      : activeAutoRod;
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
      let nextState = autoRodBase.state;
      const baitItemIdPayload = typeof action.payload?.baitItemId === 'string' ? action.payload.baitItemId : null;
      const repair = action.payload?.repair === true;

      if (repair && nextState === 'broken') {
        const consumedHook = removeActorInventoryItem(actor, 'tool:bone_hook', 1);
        const consumedCordage = removeActorInventoryItem(actor, 'cordage', 1);
        if (consumedHook > 0 && consumedCordage > 0) {
          nextState = 'triggered_escape';
        }
      }

      let nextBaitStack = null;
      let nextBaitItemId = null;
      const baseStack = autoRodBase.baitStack;
      if (
        baseStack
        && typeof baseStack === 'object'
        && (Number(baseStack.quantity) || 0) > 0
        && baseStack.itemId === EARTHWORM_ITEM_ID
      ) {
        nextBaitStack = { ...baseStack, dryness: 0 };
        nextBaitItemId = EARTHWORM_ITEM_ID;
      }

      if (baitItemIdPayload === EARTHWORM_ITEM_ID) {
        const invStacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : null;
        const sourceStack = invStacks ? findPreferredStackByItem(invStacks, EARTHWORM_ITEM_ID, 1) : null;
        const consumedBait = removeActorInventoryItem(actor, EARTHWORM_ITEM_ID, 1);
        if (consumedBait > 0 && sourceStack) {
          const placed = autoRodBaitStackFromInventoryStack(sourceStack, consumedBait);
          if (placed) {
            nextBaitStack = placed;
            nextBaitItemId = placed.itemId;
            if (nextState !== 'broken') {
              nextState = 'live';
            }
          }
        }
      }

      if (nextState === 'broken' && repair !== true) {
        nextBaitStack = null;
        nextBaitItemId = null;
      }

      if ((nextState === 'triggered_catch' || nextState === 'triggered_escape') && !nextBaitItemId) {
        nextState = 'triggered_escape';
      }

      tile.autoRod = {
        ...activeAutoRod,
        state: nextState,
        baitStack: nextBaitStack,
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

  if (action.kind === 'trap_retrieve') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    const activeSnare = tile?.simpleSnare?.active === true ? tile.simpleSnare : null;
    const activeDeadfall = tile?.deadfallTrap?.active === true ? tile.deadfallTrap : null;
    const activeFishTrap = tile?.fishTrap?.active === true ? tile.fishTrap : null;
    if (!tile || (!activeSnare && !activeDeadfall && !activeFishTrap)) {
      return;
    }

    const doSnare = activeSnare && activeSnare.hasCatch === true;
    const doDeadfall = activeDeadfall && activeDeadfall.hasCatch === true
      && typeof activeDeadfall.caughtSpeciesId === 'string' && activeDeadfall.caughtSpeciesId;
    const fishIds = activeFishTrap && Array.isArray(activeFishTrap.storedCatchSpeciesIds)
      ? activeFishTrap.storedCatchSpeciesIds.filter((entry) => typeof entry === 'string' && entry)
      : [];
    const doFish = fishIds.length > 0;

    if (!doSnare && !doDeadfall && !doFish) {
      return;
    }

    const wasPoachedSnare = doSnare && activeSnare.poached === true;
    const wasPoachedDeadfall = doDeadfall && activeDeadfall.poached === true;

    if (doSnare) {
      const speciesId = 'sylvilagus_floridanus';
      addActorInventoryItemWithOverflowDrop(state, actor, `${speciesId}:carcass`, 1, {
        freshness: 1,
        decayDaysRemaining: 3,
      });
    }

    if (doDeadfall) {
      addActorInventoryItemWithOverflowDrop(state, actor, `${activeDeadfall.caughtSpeciesId}:carcass`, 1, {
        freshness: 1,
        decayDaysRemaining: 3,
      });
    }

    if (doFish) {
      for (const speciesId of fishIds) {
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

    actor.lastTrapCheck = {
      kind: doSnare
        ? 'simple_snare'
        : doDeadfall
          ? 'dead_fall_trap'
          : 'fish_trap_weir',
      x: targetX,
      y: targetY,
      hadCatch: true,
      wasPoached: wasPoachedSnare || wasPoachedDeadfall,
      day: Number(state.totalDaysSimulated) || 0,
      dayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'trap_pickup') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile) {
      return;
    }

    if (tile.simpleSnare?.active === true) {
      const trap = tile.simpleSnare;
      const baitStack = resolveLandTrapBaitStack(trap);
      if (baitStack?.itemId) {
        addActorInventoryItemWithOverflowDrop(state, actor, baitStack.itemId, 1, pickupAddOptionsFromWorldStack(baitStack) ?? undefined);
      }
      delete tile.simpleSnare;
      addActorInventoryItemWithOverflowDrop(state, actor, 'tool:simple_snare', 1);
      return;
    }

    if (tile.deadfallTrap?.active === true) {
      const trap = tile.deadfallTrap;
      const baitStack = resolveLandTrapBaitStack(trap);
      if (baitStack?.itemId) {
        addActorInventoryItemWithOverflowDrop(state, actor, baitStack.itemId, 1, pickupAddOptionsFromWorldStack(baitStack) ?? undefined);
      }
      delete tile.deadfallTrap;
      addActorInventoryItemWithOverflowDrop(state, actor, 'tool:dead_fall_trap', 1);
      return;
    }

    if (tile.autoRod?.active === true) {
      const rod = tile.autoRod;
      const baitStack = rod.baitStack && (Number(rod.baitStack.quantity) || 0) > 0 ? rod.baitStack : null;
      if (baitStack?.itemId) {
        addActorInventoryItemWithOverflowDrop(state, actor, baitStack.itemId, 1, pickupAddOptionsFromWorldStack(baitStack) ?? undefined);
      }
      delete tile.autoRod;
      addActorInventoryItemWithOverflowDrop(state, actor, 'tool:auto_rod', 1);
      return;
    }

    if (tile.fishTrap?.active === true) {
      delete tile.fishTrap;
      addActorInventoryItemWithOverflowDrop(state, actor, 'tool:fish_trap_weir', 1);
    }
    return;
  }

  if (action.kind === 'trap_remove_bait') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile) {
      return;
    }

    const snare = tile.simpleSnare?.active === true ? tile.simpleSnare : null;
    const deadfall = tile.deadfallTrap?.active === true ? tile.deadfallTrap : null;
    const trap = snare || deadfall;
    if (!trap || !landTrapHasBait(trap)) {
      return;
    }

    const baitStack = resolveLandTrapBaitStack(trap);
    if (!baitStack?.itemId) {
      return;
    }

    addActorInventoryItemWithOverflowDrop(state, actor, baitStack.itemId, 1, pickupAddOptionsFromWorldStack(baitStack) ?? undefined);

    if (snare) {
      tile.simpleSnare = { ...snare, baitStack: null, baitItemId: null };
    } else {
      tile.deadfallTrap = { ...deadfall, baitStack: null, baitItemId: null };
    }
    return;
  }

  if (action.kind === 'trap_bait') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }

    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile) {
      return;
    }
    const baitItemId = typeof action.payload?.baitItemId === 'string' ? action.payload.baitItemId : null;
    if (!baitItemId) {
      return;
    }

    const activeSnare = tile?.simpleSnare?.active === true ? tile.simpleSnare : null;
    const activeDeadfall = tile?.deadfallTrap?.active === true ? tile.deadfallTrap : null;
    if (!activeSnare && !activeDeadfall) {
      return;
    }

    const invStacks = Array.isArray(actor?.inventory?.stacks) ? actor.inventory.stacks : null;
    const sourceStack = invStacks ? findPreferredStackByItem(invStacks, baitItemId, 1) : null;
    const available = Math.max(0, Math.floor(Number(sourceStack?.quantity) || 0));
    if (!sourceStack || available < 1) {
      return;
    }

    const baitStack = landTrapBaitStackFromInventoryStack(sourceStack, 1);
    if (!baitStack) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, baitItemId, 1);
    if (consumed <= 0) {
      return;
    }
    baitStack.quantity = consumed;

    if (activeSnare && !landTrapHasBait(activeSnare)) {
      tile.simpleSnare = { ...activeSnare, baitStack, baitItemId: baitStack.itemId };
    }
    if (activeDeadfall && !landTrapHasBait(activeDeadfall)) {
      tile.deadfallTrap = { ...activeDeadfall, baitStack, baitItemId: baitStack.itemId };
    }
    return;
  }

  if (action.kind === 'marker_place') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }
    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || tile.markerStick === true) {
      return;
    }
    const consumed = removeActorInventoryItem(actor, 'tool:marker_stick', 1);
    if (consumed <= 0) {
      return;
    }
    tile.markerStick = true;
    return;
  }

  if (action.kind === 'marker_remove') {
    const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
    const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
    if (!inBounds(targetX, targetY, state.width, state.height)) {
      return;
    }
    const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
    if (!tile || tile.markerStick !== true) {
      return;
    }
    tile.markerStick = false;
    addActorInventoryItemWithOverflowDrop(state, actor, 'tool:marker_stick', 1);
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

  if (action.kind === 'inventory_relocate_stack') {
    const stackIndex = Number.isInteger(action.payload?.stackIndex)
      ? action.payload.stackIndex
      : Math.floor(Number(action.payload?.stackIndex));
    const slotX = Number.isInteger(action.payload?.slotX)
      ? action.payload.slotX
      : Math.floor(Number(action.payload?.slotX));
    const slotY = Number.isInteger(action.payload?.slotY)
      ? action.payload.slotY
      : Math.floor(Number(action.payload?.slotY));
    if (
      !Number.isInteger(stackIndex)
      || !Number.isInteger(slotX)
      || !Number.isInteger(slotY)
    ) {
      return;
    }
    applyActorInventoryRelocation(actor, stackIndex, slotX, slotY);
    return;
  }

  if (action.kind === 'equip_item') {
    const itemId = typeof action.payload?.itemId === 'string' ? action.payload.itemId : '';
    const slot = EQUIPPABLE_ITEM_TO_SLOT[itemId] || null;
    if (!slot) {
      return;
    }

    ensureActorInventory(actor);
    const equipment = ensureInventoryEquipment(actor.inventory);
    if (equipment[slot]) {
      return;
    }

    const consumed = removeActorInventoryItem(actor, itemId, 1);
    if (consumed <= 0) {
      return;
    }

    equipment[slot] = {
      itemId,
      equippedAtDay: Number(state.totalDaysSimulated) || 0,
      equippedAtDayTick: Number(state.dayTick) || 0,
    };
    return;
  }

  if (action.kind === 'unequip_item') {
    const slot = typeof action.payload?.equipmentSlot === 'string'
      ? action.payload.equipmentSlot
      : typeof action.payload?.slot === 'string' ? action.payload.slot : '';
    if (slot !== 'gloves' && slot !== 'coat' && slot !== 'head') {
      return;
    }

    ensureActorInventory(actor);
    const equipment = ensureInventoryEquipment(actor.inventory);
    const equippedEntry = equipment[slot];
    const itemId = typeof equippedEntry?.itemId === 'string' ? equippedEntry.itemId : '';
    if (!itemId) {
      return;
    }

    equipment[slot] = null;
    const footprint = resolveItemFootprint(itemId);
    addActorInventoryItemWithOverflowDrop(state, actor, itemId, 1, {
      footprintW: footprint.footprintW,
      footprintH: footprint.footprintH,
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

    if (targetType === 'log_fungus') {
      const targetX = Number.isInteger(action.payload?.x) ? action.payload.x : Number(actor.x) || 0;
      const targetY = Number.isInteger(action.payload?.y) ? action.payload.y : Number(actor.y) || 0;
      if (!inBounds(targetX, targetY, state.width, state.height)) {
        return;
      }
      const tile = state.tiles[tileIndex(targetX, targetY, state.width)];
      const speciesId = typeof action.payload?.speciesId === 'string' ? action.payload.speciesId : '';
      const outputItemId = typeof action.payload?.outputItemId === 'string'
        ? action.payload.outputItemId
        : `log_fungus:${speciesId}:fruiting_body`;
      if (!tile?.deadLog || !speciesId || !outputItemId) {
        return;
      }
      const fungi = Array.isArray(tile.deadLog.fungi) ? tile.deadLog.fungi : [];
      const fungusEntry = fungi.find((entry) => entry?.species_id === speciesId) || null;
      const availableGrams = Math.max(0, Math.floor(Number(fungusEntry?.yield_current_grams) || 0));
      const requestedGrams = Math.max(1, Math.floor(Number(action.payload?.harvestGrams) || 0));
      const harvestedGrams = Math.min(availableGrams, requestedGrams);
      if (!fungusEntry || harvestedGrams <= 0) {
        return;
      }

      addActorInventoryItemWithOverflowDrop(state, actor, outputItemId, harvestedGrams, {
        unitWeightKg: Number(action.payload?.outputUnitWeightKg),
      });
      fungusEntry.yield_current_grams = Math.max(0, availableGrams - harvestedGrams);
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
      if (availableGrams <= 0) {
        return;
      }

      const plantPartItemId = typeof action.payload?.plantPartItemId === 'string' && action.payload.plantPartItemId
        ? action.payload.plantPartItemId
        : `${cache.cachedSpeciesId}:${cache.cachedPartName}:${cache.cachedSubStageId}`;
      const descriptor = parsePlantPartItemId(plantPartItemId);
      if (!descriptor) {
        return;
      }

      const gramsPerUnit = Number(descriptor.subStage?.unit_weight_g);
      if (!Number.isFinite(gramsPerUnit) || gramsPerUnit <= 0) {
        return;
      }

      const unitsHarvested = Math.floor(availableGrams / gramsPerUnit);
      if (unitsHarvested < 1) {
        return;
      }

      const unitWeightKg = gramsPerUnit / 1000;
      const decayDays = Number(descriptor.subStage?.decay_days);
      addActorInventoryItemWithOverflowDrop(state, actor, plantPartItemId, unitsHarvested, {
        footprintW: normalizeStackFootprintValue(action.payload?.inventoryFootprintW),
        footprintH: normalizeStackFootprintValue(action.payload?.inventoryFootprintH),
        unitWeightKg,
        ...(Number.isFinite(decayDays) && decayDays >= 0 ? { decayDaysRemaining: decayDays } : {}),
      });

      // One harvest clears the cache; any gram remainder is discarded as loose scatter.
      tile.squirrelCache = null;
      return;
    }

    const plantId = typeof action.payload?.plantId === 'string' ? action.payload.plantId : '';
    const partName = typeof action.payload?.partName === 'string' ? action.payload.partName : '';
    const subStageId = typeof action.payload?.subStageId === 'string' ? action.payload.subStageId : '';
    const requestedActions = Number.isInteger(action.payload?.actions)
      ? action.payload.actions
      : Math.floor(Number(action.payload?.actions || 1));

    const outcome = applyHarvestAction(state, plantId, partName, subStageId, {
      actions: requestedActions,
      reachTier: typeof action.payload?.reachTier === 'string' ? action.payload.reachTier : null,
      canAccessElevatedPool: action.payload?.canAccessElevatedPool === true,
      canAccessCanopyPool: action.payload?.canAccessCanopyPool === true,
    });
    if ((Number(outcome.appliedActions) || 0) > 0) {
      const plant = state.plants?.[plantId];
      const speciesId = typeof plant?.speciesId === 'string' ? plant.speciesId : 'unknown';
      const speciesDef = PLANT_BY_ID[speciesId] || null;
      const harvestPart = speciesDef
        ? (speciesDef.parts || []).find((p) => p?.name === partName) || null
        : null;
      const harvestSubStage = harvestPart
        ? (harvestPart.subStages || []).find((s) => s?.id === subStageId) || null
        : null;
      const perActionUnits = scaledUnitsPerHarvestActionMidpoint(harvestSubStage, speciesDef, plant);
      const stackQty = Math.max(1, Math.floor(Number(outcome.appliedActions) || 0) * perActionUnits);
      const itemId = `${speciesId}:${partName}:${subStageId}`;
      // Inventory weight depends on `stack.unitWeightKg`; plant-part harvest must compute it (payload doesn't).
      let unitWeightKg = null;
      const gramsPerUnit = Number(harvestSubStage?.unit_weight_g);
      if (Number.isFinite(gramsPerUnit) && gramsPerUnit > 0) {
        unitWeightKg = gramsPerUnit / 1000;
      } else {
        const descriptor = parsePlantPartItemId(itemId);
        const gramsPerUnitFromDescriptor = Number(descriptor?.subStage?.unit_weight_g);
        if (Number.isFinite(gramsPerUnitFromDescriptor) && gramsPerUnitFromDescriptor > 0) {
          unitWeightKg = gramsPerUnitFromDescriptor / 1000;
        } else if (Number.isFinite(Number(action.payload?.inventoryUnitWeightKg))) {
          unitWeightKg = Number(action.payload.inventoryUnitWeightKg);
        }
      }
      const scalesUnitWeight = harvestSubStage?.harvest_unit_weight_scales_with_age === true
        || harvestSubStage?.harvestUnitWeightScalesWithAge === true;
      if (scalesUnitWeight && Number.isFinite(unitWeightKg) && unitWeightKg > 0 && speciesDef && plant) {
        const scale = harvestYieldScaleFactor(plant, speciesDef, harvestSubStage);
        unitWeightKg *= scale;
      }
      addActorInventoryItemWithOverflowDrop(state, actor, itemId, stackQty, {
        freshness: Number(action.payload?.inventoryFreshness),
        decayDaysRemaining: Number(action.payload?.inventoryDecayDaysRemaining),
        footprintW: normalizeStackFootprintValue(action.payload?.inventoryFootprintW),
        footprintH: normalizeStackFootprintValue(action.payload?.inventoryFootprintH),
        unitWeightKg,
      });

      applyHarvestInjuryFromSubStage(
        state,
        actor,
        action,
        speciesId,
        partName,
        subStageId,
        outcome.appliedActions,
      );
    }
    return;
  }

  if (action.kind === 'debrief_enter') {
    const debrief = ensureDebriefState();
    if (!debrief) {
      return;
    }
    debrief.active = true;
    // Entering debrief snaps the player to the camp anchor; safe camp water refills
    // thirst and pauses field thirst drain until the next calendar morning.
    if (actor && actor.id === 'player') {
      const ax = Number(state?.camp?.anchorX);
      const ay = Number(state?.camp?.anchorY);
      if (Number.isInteger(ax) && Number.isInteger(ay)) {
        actor.x = ax;
        actor.y = ay;
      }
      actor.thirst = 1;
    }
    if (state.camp && typeof state.camp === 'object') {
      state.camp.nightlyPlayerSafeThirstUntilDawn = true;
    }
    debrief.openedAtDay = Number.isInteger(state?.totalDaysSimulated) ? state.totalDaysSimulated : null;
    const seasonKey = resolveCurrentSeasonKey(state);
    if (debrief.visionSeasonKey !== seasonKey) {
      debrief.visionSeasonKey = seasonKey;
      debrief.visionUsesThisSeason = 0;
    }
    const resolution = runDebriefMedicinePass(state, {
      removeCampStockpileItem,
    });
    debrief.medicineRequests = resolution.medicineRequests;
    debrief.medicineNotifications = resolution.medicineNotifications;
    debrief.visionRequest = null;
    debrief.visionSelectionOptions = [];
    debrief.requiresVisionConfirmation = false;
    debrief.visionNotifications = [];
    debrief.pendingVisionRevelation = null;
    debrief.pendingVisionChoices = [];
    debrief.chosenVisionRewards = [];
    ensurePartnerCampMaintenanceQueued(state);
    return;
  }

  if (action.kind === 'debrief_exit') {
    const debrief = ensureDebriefState();
    if (!debrief) {
      return;
    }
    debrief.active = false;
    debrief.openedAtDay = null;
    debrief.medicineRequests = [];
    debrief.medicineNotifications = [];
    debrief.visionRequest = null;
    debrief.visionSelectionOptions = [];
    debrief.requiresVisionConfirmation = false;
    debrief.visionNotifications = [];
    debrief.pendingVisionRevelation = null;
    debrief.pendingVisionChoices = [];
    debrief.chosenVisionRewards = [];
    return;
  }

  if (action.kind === 'partner_medicine_administer') {
    const debrief = ensureDebriefState();
    if (!debrief || debrief.active !== true) {
      return;
    }
    const resolution = runDebriefMedicinePass(state, {
      removeCampStockpileItem,
      targetConditionInstanceId: typeof action?.payload?.conditionInstanceId === 'string'
        ? action.payload.conditionInstanceId
        : null,
    });
    debrief.medicineRequests = resolution.medicineRequests;
    debrief.medicineNotifications = [
      ...debrief.medicineNotifications,
      ...resolution.medicineNotifications,
    ];
    return;
  }

  if (action.kind === 'partner_vision_request') {
    const debrief = ensureDebriefState();
    if (!debrief || debrief.active !== true) {
      return;
    }
    const resolution = runDebriefVisionRequest(state, {
      removeCampStockpileItem,
    });
    debrief.visionSeasonKey = resolution.seasonKey;
    if (resolution.visionConsumed) {
      debrief.visionUsesThisSeason = Math.max(0, Number(debrief.visionUsesThisSeason) || 0) + 1;
      const targetActor = state?.actors?.player || actor;
      ensureActorVisionState(targetActor);
      targetActor.visionNextDayTickPenalty += Math.max(0, Number(resolution?.nextDayTickPenalty) || 0);
    }
    debrief.visionRequest = resolution.visionRequest;
    debrief.visionSelectionOptions = resolution.visionSelectionOptions || [];
    debrief.requiresVisionConfirmation = resolution.requiresVisionConfirmation === true;
    debrief.visionNotifications = [
      ...debrief.visionNotifications,
      ...resolution.visionNotifications,
    ];
    debrief.pendingVisionRevelation = resolution.pendingVisionRevelation;
    debrief.pendingVisionChoices = resolveVisionRevelationChoices(resolution.pendingVisionRevelation);
    debrief.chosenVisionRewards = [];
    return;
  }

  if (action.kind === 'partner_vision_confirm') {
    const debrief = ensureDebriefState();
    if (!debrief || debrief.active !== true) {
      return;
    }
    const resolution = runDebriefVisionConfirm(state, {
      removeCampStockpileItem,
      selectedItemId: typeof action?.payload?.itemId === 'string' ? action.payload.itemId : '',
    });
    if (resolution.visionConsumed) {
      debrief.visionUsesThisSeason = Math.max(0, Number(debrief.visionUsesThisSeason) || 0) + 1;
      const targetActor = state?.actors?.player || actor;
      ensureActorVisionState(targetActor);
      targetActor.visionNextDayTickPenalty += Math.max(0, Number(resolution?.nextDayTickPenalty) || 0);
    }
    debrief.visionNotifications = [
      ...debrief.visionNotifications,
      ...resolution.visionNotifications,
    ];
    debrief.pendingVisionRevelation = resolution.pendingVisionRevelation;
    debrief.pendingVisionChoices = resolveVisionRevelationChoices(resolution.pendingVisionRevelation);
    debrief.chosenVisionRewards = [];
    debrief.visionSelectionOptions = [];
    debrief.requiresVisionConfirmation = false;
    debrief.visionRequest = null;
    return;
  }

  if (action.kind === 'partner_vision_choose') {
    const debrief = ensureDebriefState();
    if (!debrief || debrief.active !== true || !debrief.pendingVisionRevelation) {
      return;
    }
    const categoryRaw = typeof action?.payload?.category === 'string'
      ? action.payload.category
      : '';
    const category = categoryRaw.trim().toLowerCase();
    const choices = Array.isArray(debrief.pendingVisionChoices) ? debrief.pendingVisionChoices : [];
    const chosen = choices.find((entry) => String(entry?.category || '').toLowerCase() === category) || null;
    if (!chosen) {
      return;
    }

    const targetActor = state?.actors?.player || actor;
    ensureActorVisionState(targetActor);
    if (category === 'sight') {
      const duration = Math.max(
        1,
        Math.floor(Number(debrief?.pendingVisionRevelation?.sightDurationDays || 5)),
      );
      targetActor.natureSightPendingDays += duration;
    }

    let plantSpeciesRevealed = [];
    if (category === 'plant') {
      if (!Array.isArray(state.camp.identifiedPlantSpeciesIds)) {
        state.camp.identifiedPlantSpeciesIds = [];
      }
      const identified = new Set(state.camp.identifiedPlantSpeciesIds);
      const onMap = new Set();
      for (const plant of Object.values(state.plants || {})) {
        if (!plant || plant.alive === false) {
          continue;
        }
        const sid = plant.speciesId;
        if (typeof sid !== 'string' || !sid || !PLANT_BY_ID[sid]) {
          continue;
        }
        if (!identified.has(sid)) {
          onMap.add(sid);
        }
      }
      const sorted = [...onMap].sort();
      plantSpeciesRevealed = sorted.slice(0, 3);
      for (const sid of plantSpeciesRevealed) {
        if (!state.camp.identifiedPlantSpeciesIds.includes(sid)) {
          state.camp.identifiedPlantSpeciesIds.push(sid);
        }
      }
    }

    let techUnlockKey = null;
    if (category === 'tech') {
      const forest = state?.techForest;
      const unlocks = state?.techUnlocks && typeof state.techUnlocks === 'object' ? state.techUnlocks : {};
      const locked = TECH_RESEARCHABLE_UNLOCK_KEYS.filter(
        (k) => getTechForestNode(forest, k) && unlocks[k] !== true,
      );
      if (locked.length > 0) {
        const salt = Math.max(
          0,
          Math.floor(Number(targetActor?.visionRewardCounts?.tech || 0)),
        ) + 17;
        let h = Math.floor(Number(state?.seed) || 0) >>> 0;
        h = (Math.imul(h, 31) + (Math.floor(Number(state?.totalDaysSimulated) || 0) >>> 0)) >>> 0;
        h = (Math.imul(h, 31) + (salt >>> 0)) >>> 0;
        techUnlockKey = locked[h % locked.length];
        if (!state.techUnlocks || typeof state.techUnlocks !== 'object') {
          state.techUnlocks = {};
        }
        state.techUnlocks[techUnlockKey] = true;
        if (!state.techUnlockVisionGranted || typeof state.techUnlockVisionGranted !== 'object') {
          state.techUnlockVisionGranted = {};
        }
        state.techUnlockVisionGranted[techUnlockKey] = true;
      }
    }

    targetActor.visionRewardCounts[category] = Math.max(
      0,
      Math.floor(Number(targetActor?.visionRewardCounts?.[category] || 0)),
    ) + 1;

    const rewardEntry = {
      category,
      rewardId: chosen.rewardId,
      rewardLabel: chosen.rewardLabel,
    };
    if (category === 'plant') {
      rewardEntry.plantSpeciesIds = plantSpeciesRevealed;
      rewardEntry.plantNames = plantSpeciesRevealed.map((sid) => (PLANT_BY_ID[sid]?.name || sid));
    }
    if (category === 'tech') {
      rewardEntry.techUnlockKey = techUnlockKey;
      if (techUnlockKey) {
        rewardEntry.techUnlockLabel = getTechResearchMeta(techUnlockKey).label;
      }
    }

    debrief.chosenVisionRewards = [
      ...debrief.chosenVisionRewards,
      rewardEntry,
    ];
    debrief.pendingVisionRevelation = null;
    debrief.pendingVisionChoices = [];
    return;
  }

  if (action.kind === 'nature_sight_overlay_set') {
    ensureActorVisionState(actor);
    actor.natureSightOverlayChoice = typeof action?.payload?.overlay === 'string'
      ? action.payload.overlay
      : null;
    actor.natureSightOverlayChosenDay = Number.isInteger(state?.totalDaysSimulated)
      ? state.totalDaysSimulated
      : null;
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
      queue.active = {
        ...task,
        status: 'active',
        failureReason: null,
      };
      queue.queued = [];
      ensurePartnerCampMaintenanceQueued(state);
      return;
    }

    const debriefPlanning = state?.camp?.debrief?.active === true;

    if (debriefPlanning) {
      if (!Array.isArray(queue.queued)) {
        queue.queued = [];
      }
      queue.queued.push({
        ...task,
        status: 'queued',
        failureReason: null,
      });
    } else if (!queue.active) {
      queue.active = {
        ...task,
        status: 'active',
        failureReason: null,
      };
    } else {
      if (!Array.isArray(queue.queued)) {
        queue.queued = [];
      }
      queue.queued.push({
        ...task,
        status: 'queued',
        failureReason: null,
      });
    }

    ensurePartnerCampMaintenanceQueued(state);
  }

  if (action.kind === 'partner_queue_reorder') {
    const queue = state?.camp?.partnerTaskQueue;
    const ids = action.payload?.orderedTaskIds;
    if (!queue || !Array.isArray(ids) || !Array.isArray(queue.queued)) {
      return;
    }
    const byId = new Map(queue.queued.map((t) => [t?.taskId, t]));
    const next = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (!row) {
        return;
      }
      next.push({ ...row });
    }
    if (next.length !== queue.queued.length) {
      return;
    }
    queue.queued = next;
    mirrorPartnerTaskQueueToActor(state);
  }
}
