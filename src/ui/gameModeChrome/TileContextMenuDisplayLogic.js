import { ANIMAL_BY_ID } from '../../game/animalCatalog.mjs';
import { ITEM_BY_ID } from '../../game/itemCatalog.mjs';
import { formatPlantPartLabel, parsePlantPartItemId } from '../../game/plantPartDescriptors.mjs';
import { PLANT_BY_ID } from '../../game/plantCatalog.mjs';
import { EARTHWORM_ITEM_ID } from '../../game/simCore.constants.mjs';
import { SIMPLE_SNARE_TARGET_SPECIES_ID } from '../../game/trapBaitLand.mjs';
import {
  getActionTickCost,
  getItemPickupInventoryBlockReason,
  listRockHarvestYieldChoices,
  pickupAddOptionsFromWorldStack,
  validateAction,
} from '../../game/simCore.mjs';
import { annotateContextEntryTickBudget } from './GameModeChromeDisplayLogic.js';

function inventoryQuantityForItem(player, itemId) {
  const stacks = player?.inventory?.stacks;
  if (!Array.isArray(stacks) || !itemId) {
    return 0;
  }
  let sum = 0;
  for (const stack of stacks) {
    if (stack?.itemId === itemId) {
      sum += Math.max(0, Math.floor(Number(stack.quantity) || 0));
    }
  }
  return sum;
}

function landTrapBaitMenuLabel(trapKind, itemId, formatTokenLabel) {
  const prefix = trapKind === 'snare' ? 'Bait snare' : 'Bait deadfall';
  const descriptor = parsePlantPartItemId(itemId);
  if (descriptor) {
    return `${prefix} (${formatPlantPartLabel(descriptor, { includeSubStage: true })})`;
  }
  const catalogName = ITEM_BY_ID[itemId]?.name;
  if (catalogName) {
    return `${prefix} (${catalogName})`;
  }
  return `${prefix} (${formatTokenLabel(itemId)})`;
}

function retrieveTrapMenuLabel(tile, formatTokenLabel) {
  const snare = tile?.simpleSnare?.active === true && tile.simpleSnare.hasCatch === true;
  const deadfall = tile?.deadfallTrap?.active === true && tile.deadfallTrap.hasCatch === true;
  const fishIds = tile?.fishTrap?.active === true && Array.isArray(tile.fishTrap.storedCatchSpeciesIds)
    ? tile.fishTrap.storedCatchSpeciesIds.filter((id) => typeof id === 'string' && id)
    : [];
  if (snare) {
    const name = ANIMAL_BY_ID[SIMPLE_SNARE_TARGET_SPECIES_ID]?.name || 'rabbit';
    return `Retrieve ${name} carcass`;
  }
  if (deadfall) {
    const sp = tile.deadfallTrap.caughtSpeciesId;
    const name = typeof sp === 'string' && sp
      ? (ANIMAL_BY_ID[sp]?.name || formatTokenLabel(sp))
      : 'animal';
    return `Retrieve ${name} carcass`;
  }
  if (fishIds.length === 1) {
    const name = ANIMAL_BY_ID[fishIds[0]]?.name || formatTokenLabel(fishIds[0]);
    return `Retrieve ${name} carcass`;
  }
  if (fishIds.length > 1) {
    return 'Retrieve fish catches';
  }
  return 'Retrieve catch';
}

function appendTrapInteractionEntries({
  entries,
  gameState,
  playerActor,
  selectedTileEntity,
  selectedTileX,
  selectedTileY,
  formatTokenLabel,
}) {
  if (!selectedTileEntity || selectedTileX === null || selectedTileY === null) {
    return;
  }
  const payload = { x: selectedTileX, y: selectedTileY };

  const vRetrieve = validateAction(gameState, { actorId: 'player', kind: 'trap_retrieve', payload });
  if (vRetrieve.ok) {
    entries.push({
      kind: 'trap_retrieve',
      label: retrieveTrapMenuLabel(selectedTileEntity, formatTokenLabel),
      tickCost: Number(vRetrieve.normalizedAction?.tickCost) || getActionTickCost('trap_retrieve', payload),
      payload: vRetrieve.normalizedAction.payload,
    });
  }

  const vRemoveBait = validateAction(gameState, { actorId: 'player', kind: 'trap_remove_bait', payload });
  if (vRemoveBait.ok) {
    entries.push({
      kind: 'trap_remove_bait',
      label: 'Remove bait',
      tickCost: Number(vRemoveBait.normalizedAction?.tickCost) || getActionTickCost('trap_remove_bait', payload),
      payload: vRemoveBait.normalizedAction.payload,
    });
  }

  const vPickup = validateAction(gameState, { actorId: 'player', kind: 'trap_pickup', payload });
  if (vPickup.ok) {
    let label = 'Pick up trap';
    if (selectedTileEntity.simpleSnare?.active === true) {
      label = 'Pick up snare';
    } else if (selectedTileEntity.deadfallTrap?.active === true) {
      label = 'Pick up deadfall';
    } else if (selectedTileEntity.fishTrap?.active === true) {
      label = 'Pick up fish weir';
    } else if (selectedTileEntity.autoRod?.active === true) {
      label = 'Pick up auto rod';
    }
    entries.push({
      kind: 'trap_pickup',
      label,
      tickCost: Number(vPickup.normalizedAction?.tickCost) || getActionTickCost('trap_pickup', payload),
      payload: vPickup.normalizedAction.payload,
    });
  }

  const autoRod = selectedTileEntity.autoRod?.active === true ? selectedTileEntity.autoRod : null;
  if (!autoRod) {
    return;
  }

  const vCheck = validateAction(gameState, { actorId: 'player', kind: 'trap_check', payload });
  if (vCheck.ok) {
    entries.push({
      kind: 'trap_check',
      label: 'Check auto rod',
      tickCost: Number(vCheck.normalizedAction?.tickCost) || getActionTickCost('trap_check', payload),
      payload: vCheck.normalizedAction.payload,
    });
  }

  if (inventoryQuantityForItem(playerActor, EARTHWORM_ITEM_ID) >= 1) {
    const pWorm = { ...payload, baitItemId: EARTHWORM_ITEM_ID };
    const vWorm = validateAction(gameState, { actorId: 'player', kind: 'trap_check', payload: pWorm });
    if (vWorm.ok) {
      entries.push({
        kind: 'trap_check',
        label: 'Check auto rod (re-bait with worm)',
        tickCost: Number(vWorm.normalizedAction?.tickCost) || getActionTickCost('trap_check', vWorm.normalizedAction?.payload || pWorm),
        payload: vWorm.normalizedAction.payload,
      });
    }
  }

  const pRepair = { ...payload, repair: true, baitItemId: EARTHWORM_ITEM_ID };
  const vRepair = validateAction(gameState, { actorId: 'player', kind: 'trap_check', payload: pRepair });
  if (vRepair.ok) {
    entries.push({
      kind: 'trap_check',
      label: 'Repair auto rod (re-bait with worm)',
      tickCost: Number(vRepair.normalizedAction?.tickCost) || getActionTickCost('trap_check', vRepair.normalizedAction?.payload || pRepair),
      payload: vRepair.normalizedAction.payload,
    });
  }
}

function appendLandTrapBaitEntries({
  entries,
  gameState,
  playerActor,
  selectedTileEntity,
  selectedTileX,
  selectedTileY,
  formatTokenLabel,
}) {
  if (!selectedTileEntity || selectedTileEntity.waterType) {
    return;
  }
  const hasSnare = selectedTileEntity.simpleSnare?.active === true;
  const hasDeadfall = selectedTileEntity.deadfallTrap?.active === true;
  if ((hasSnare && hasDeadfall) || (!hasSnare && !hasDeadfall)) {
    return;
  }
  const trapKind = hasSnare ? 'snare' : 'deadfall';
  const stacks = playerActor?.inventory?.stacks;
  if (!Array.isArray(stacks)) {
    return;
  }
  for (const stack of stacks) {
    const itemId = stack?.itemId;
    const qty = Number(stack?.quantity) || 0;
    if (!itemId || qty < 1) {
      continue;
    }
    const payload = { x: selectedTileX, y: selectedTileY, baitItemId: itemId };
    const v = validateAction(gameState, { actorId: 'player', kind: 'trap_bait', payload });
    if (!v.ok) {
      continue;
    }
    entries.push({
      kind: 'trap_bait',
      label: landTrapBaitMenuLabel(trapKind, itemId, formatTokenLabel),
      tickCost: Number(v.normalizedAction?.tickCost) || getActionTickCost('trap_bait', v.normalizedAction?.payload || payload),
      payload: v.normalizedAction.payload,
    });
  }
}

/**
 * Pure-ish (no React) tile context menu logic.
 * Caller supplies a handful of small helpers that still live in App for now.
 */
export function getTileContextMenuEntries({
  gameState,
  playerActor,
  selectedTileX,
  selectedTileY,
  selectedTileEntity,
  selectedTileWorldItems,
  selectedTileWorldItemEntries,
  selectedContext,
  inferTileContextActions,
  buildDefaultPayload,
  formatTokenLabel,
  getStationIdAtTile,
  stationActionLabel,
}) {
  if (!selectedTileEntity || selectedTileX === null || selectedTileY === null) {
    return [];
  }

  const entries = [];
  const baseContext = {
    selectedX: selectedTileX,
    selectedY: selectedTileY,
    tile: selectedTileEntity,
    player: playerActor,
    ...(selectedContext || {}),
  };

  // Expand harvest: one entry per activeSubStage per plant on the tile
  for (const plantId of (selectedTileEntity.plantIds || [])) {
    const plant = gameState.plants?.[plantId];
    if (!plant?.alive || !Array.isArray(plant.activeSubStages)) continue;
    for (const sub of plant.activeSubStages) {
      const payload = {
        plantId,
        partName: sub.partName,
        subStageId: sub.subStageId,
        actions: 1,
        x: selectedTileX,
        y: selectedTileY,
      };
      const v = validateAction(gameState, { actorId: 'player', kind: 'harvest', payload });
      if (v.ok) {
        entries.push({
          kind: 'harvest',
          label: `Harvest ${sub.partName} (${sub.subStageId})`,
          tickCost: Number(v?.normalizedAction?.tickCost) || getActionTickCost('harvest', payload),
          payload,
        });
      }
    }
  }

  // Rock tiles: one context entry per harvestable yield (heavy vs flat vs flint).
  if (selectedTileEntity.rockType) {
    const choices = listRockHarvestYieldChoices(selectedTileEntity.rockType);
    for (let ri = 0; ri < choices.length; ri += 1) {
      const choice = choices[ri];
      const payload = { x: selectedTileX, y: selectedTileY, rockYield: choice.rockYield };
      const v = validateAction(gameState, { actorId: 'player', kind: 'harvest', payload });
      if (v.ok) {
        entries.push({
          kind: 'harvest',
          label: choice.label,
          tickCost: Number(v.normalizedAction?.tickCost) || choice.tickCost,
          payload: v.normalizedAction?.payload || payload,
        });
      }
    }
  } else {
    // Tile-based harvest for squirrel cache / log fungus (not rock).
    const tileHarvestPayload = { x: selectedTileX, y: selectedTileY };
    const tileHarvestValidation = validateAction(gameState, { actorId: 'player', kind: 'harvest', payload: tileHarvestPayload });
    if (tileHarvestValidation.ok) {
      const targetType = tileHarvestValidation?.normalizedAction?.payload?.targetType;
      if (targetType === 'squirrel_cache' || targetType === 'log_fungus') {
        const fungusSpeciesId = tileHarvestValidation?.normalizedAction?.payload?.speciesId;
        entries.push({
          kind: 'harvest',
          label: targetType === 'squirrel_cache'
            ? 'Harvest squirrel cache'
            : `Harvest ${formatTokenLabel(fungusSpeciesId || 'log fungus')}`,
          tickCost: Number(tileHarvestValidation?.normalizedAction?.tickCost) || getActionTickCost('harvest', tileHarvestPayload),
          payload: tileHarvestValidation.normalizedAction?.payload || tileHarvestPayload,
        });
      }
    }
  }

  // Expand item_pickup: one entry per world item on tile
  for (let wi = 0; wi < selectedTileWorldItems.length; wi += 1) {
    const raw = selectedTileWorldItems[wi];
    const item = selectedTileWorldItemEntries[wi];
    if (!raw || !item) {
      continue;
    }
    const payload = { x: selectedTileX, y: selectedTileY, itemId: item.itemId, quantity: 1 };
    const v = validateAction(gameState, { actorId: 'player', kind: 'item_pickup', payload });
    if (!v.ok) {
      continue;
    }
    const pickupQty = Math.max(1, Math.floor(Number(v.normalizedAction?.payload?.quantity) || 1));
    const options = pickupAddOptionsFromWorldStack(raw);
    const blockReason = getItemPickupInventoryBlockReason(playerActor, item.itemId, pickupQty, options);
    entries.push({
      kind: 'item_pickup',
      label: `Pick Up ${item.name}`,
      tickCost: getActionTickCost('item_pickup', payload),
      payload,
      disabled: blockReason != null,
      disabledReason: blockReason,
    });
  }

  // All other context actions (not move, not harvest, not item_pickup — those are handled above)
  const hasInspectablePlant = Array.isArray(selectedTileEntity?.plantIds) && selectedTileEntity.plantIds.some((plantId) => {
    const plant = gameState?.plants?.[plantId];
    if (!plant || plant.alive !== true || !Array.isArray(plant.activeSubStages)) {
      return false;
    }
    const species = PLANT_BY_ID[plant.speciesId] || null;
    return plant.activeSubStages.some((entry) => {
      const partName = typeof entry?.partName === 'string' ? entry.partName : '';
      const subStageId = typeof entry?.subStageId === 'string' ? entry.subStageId : '';
      if (!partName || !subStageId) {
        return false;
      }
      const partDef = (species?.parts || []).find((candidate) => candidate?.name === partName) || null;
      const subStageDef = (partDef?.subStages || []).find((candidate) => candidate?.id === subStageId) || null;
      const digTicksToDiscover = Number(subStageDef?.dig_ticks_to_discover);
      return !(Number.isFinite(digTicksToDiscover) && digTicksToDiscover > 0);
    });
  });
  const hasInspectableTrap = Boolean(
    selectedTileEntity?.simpleSnare?.active
    || selectedTileEntity?.deadfallTrap?.active
    || selectedTileEntity?.fishTrap?.active
    || selectedTileEntity?.autoRod?.active,
  );
  const inferredTileKinds = inferTileContextActions(selectedTileEntity);
  const otherKinds = inferredTileKinds.filter(
    (k) => k !== 'move' && k !== 'harvest' && k !== 'item_pickup' && k !== 'trap_bait' && k !== 'fish_rod_cast',
  );
  for (const kind of otherKinds) {
    if (kind === 'inspect' && !hasInspectablePlant && !hasInspectableTrap) {
      continue;
    }
    const payload = buildDefaultPayload(kind, baseContext);
    const v = validateAction(gameState, { actorId: 'player', kind, payload });
    if (v.ok) {
      entries.push({
        kind,
        label: kind === 'water_drink'
          ? 'Drink from water'
          : kind === 'marker_place'
            ? 'Place marker stick'
            : kind === 'marker_remove'
              ? 'Remove marker stick'
              : kind.replace(/_/g, ' '),
        tickCost: Number(v.normalizedAction?.tickCost) || getActionTickCost(kind, payload),
        payload,
      });
    }
  }

  // fish_rod_cast: unbaited + optional earthworm variant (parameterized payload)
  if (inferredTileKinds.includes('fish_rod_cast')) {
    const basePayload = buildDefaultPayload('fish_rod_cast', baseContext);
    const variants = [{ labelSuffix: '', payload: { ...basePayload } }];
    if (inventoryQuantityForItem(playerActor, EARTHWORM_ITEM_ID) >= 1) {
      variants.push({ labelSuffix: ' (baited)', payload: { ...basePayload, baitItemId: EARTHWORM_ITEM_ID } });
    }
    for (const { labelSuffix, payload } of variants) {
      const v = validateAction(gameState, { actorId: 'player', kind: 'fish_rod_cast', payload });
      if (v.ok) {
        entries.push({
          kind: 'fish_rod_cast',
          label: `fish rod cast${labelSuffix}`,
          tickCost: Number(v.normalizedAction?.tickCost) || getActionTickCost('fish_rod_cast', payload),
          payload: v.normalizedAction?.payload || payload,
        });
      }
    }
  }

  appendTrapInteractionEntries({
    entries,
    gameState,
    playerActor,
    selectedTileEntity,
    selectedTileX,
    selectedTileY,
    formatTokenLabel,
  });

  appendLandTrapBaitEntries({
    entries,
    gameState,
    playerActor,
    selectedTileEntity,
    selectedTileX,
    selectedTileY,
    formatTokenLabel,
  });

  const campAX = gameState?.camp?.anchorX;
  const campAY = gameState?.camp?.anchorY;
  const isCampAnchorTile = Number.isInteger(campAX) && Number.isInteger(campAY)
    && selectedTileX === campAX && selectedTileY === campAY;
  const hasWaterDrinkEntry = entries.some((e) => e.kind === 'water_drink');
  if (isCampAnchorTile && !hasWaterDrinkEntry) {
    const payload = buildDefaultPayload('water_drink', baseContext);
    const v = validateAction(gameState, { actorId: 'player', kind: 'water_drink', payload });
    if (v.ok) {
      entries.push({
        kind: 'water_drink',
        label: 'Drink clean water (camp)',
        tickCost: Number(v.normalizedAction?.tickCost) || getActionTickCost('water_drink', payload),
        payload,
      });
    }
  }

  const stationAtTile = getStationIdAtTile(gameState?.camp, selectedTileX, selectedTileY);
  if (stationAtTile) {
    if (stationAtTile === 'drying_rack') {
      entries.push({
        kind: 'open_drying_rack_inspect',
        label: 'Inspect Drying Rack',
        tickCost: 0,
        payload: {},
      });
    }
    entries.push({
      kind: 'open_station_process_panel',
      label: stationActionLabel(stationAtTile),
      tickCost: 0,
      payload: {
        stationId: stationAtTile,
        source: 'tile',
      },
    });
  }

  return entries.map((e) => annotateContextEntryTickBudget(e, playerActor));
}

