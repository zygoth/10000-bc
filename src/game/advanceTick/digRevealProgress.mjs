import { PLANT_BY_ID } from '../plantCatalog.mjs';
import { inBounds, tileIndex } from '../simWorld.mjs';

function actorInventoryQuantity(actor, itemId) {
  if (!actor || typeof itemId !== 'string' || !itemId) {
    return 0;
  }
  let total = 0;
  for (const stack of actor.inventory?.stacks || []) {
    if (stack?.itemId === itemId) {
      total += Math.max(0, Math.floor(Number(stack.quantity) || 0));
    }
  }
  return total;
}

/**
 * Same multipliers as simActions `getDigToolModifier` (dig **tick cost** = base × this).
 * Lower multiplier ⇒ fewer ticks per dig action ⇒ tool digs faster.
 */
function getDigTickCostMultiplier(actor) {
  if (actorInventoryQuantity(actor, 'tool:shovel') > 0) {
    return 0.35;
  }
  if (actorInventoryQuantity(actor, 'tool:digging_stick') > 0) {
    return 0.6;
  }
  return 1;
}

/**
 * How much unearth progress toward `dig_ticks_to_discover` each **calendar tick** of digging adds.
 * Better tools (lower tick-cost multiplier) move more dirt per tick: progress = 1 / multiplier.
 */
export function getDigUnearthProgressPerTick(actor) {
  const m = getDigTickCostMultiplier(actor);
  if (!Number.isFinite(m) || m <= 0) {
    return 1;
  }
  return 1 / m;
}

function countUnearthedUndergroundSubStages(state, tile) {
  if (!tile || !Array.isArray(tile.plantIds)) {
    return 0;
  }
  let n = 0;
  for (const plantId of tile.plantIds) {
    const plant = state.plants?.[plantId];
    if (!plant?.alive || !Array.isArray(plant.activeSubStages)) {
      continue;
    }
    const species = PLANT_BY_ID[plant.speciesId] || null;
    if (!species) {
      continue;
    }
    for (const entry of plant.activeSubStages) {
      const partName = typeof entry?.partName === 'string' ? entry.partName : '';
      const subStageId = typeof entry?.subStageId === 'string' ? entry.subStageId : '';
      if (!partName || !subStageId) {
        continue;
      }
      const partDef = (species.parts || []).find((p) => p?.name === partName) || null;
      const subStageDef = (partDef?.subStages || []).find((s) => s?.id === subStageId) || null;
      const need = Number(subStageDef?.dig_ticks_to_discover);
      if (!Number.isFinite(need) || need <= 0) {
        continue;
      }
      const applied = Math.max(0, Number(entry.digRevealTicksApplied) || 0);
      if (applied + 1e-9 >= need) {
        n += 1;
      }
    }
  }
  return n;
}

export function countUnearthedUndergroundPartsOnTile(state, x, y) {
  if (!inBounds(x, y, state.width, state.height)) {
    return 0;
  }
  const tile = state.tiles[tileIndex(x, y, state.width)];
  return countUnearthedUndergroundSubStages(state, tile);
}

/**
 * Add unearth progress (from dig tick(s)) toward each underground sub-stage on this tile.
 * `progressDelta` may be fractional (tool effectiveness).
 */
export function applyDigRevealTicksToTile(state, x, y, progressDelta) {
  const dt = Number(progressDelta);
  if (!Number.isFinite(dt) || dt <= 0 || !inBounds(x, y, state.width, state.height)) {
    return;
  }
  const tile = state.tiles[tileIndex(x, y, state.width)];
  if (!tile || !Array.isArray(tile.plantIds)) {
    return;
  }
  for (const plantId of tile.plantIds) {
    const plant = state.plants?.[plantId];
    if (!plant?.alive || !Array.isArray(plant.activeSubStages)) {
      continue;
    }
    const species = PLANT_BY_ID[plant.speciesId] || null;
    if (!species) {
      continue;
    }
    for (const entry of plant.activeSubStages) {
      const partName = typeof entry?.partName === 'string' ? entry.partName : '';
      const subStageId = typeof entry?.subStageId === 'string' ? entry.subStageId : '';
      if (!partName || !subStageId) {
        continue;
      }
      const partDef = (species.parts || []).find((p) => p?.name === partName) || null;
      const subStageDef = (partDef?.subStages || []).find((s) => s?.id === subStageId) || null;
      const need = Number(subStageDef?.dig_ticks_to_discover);
      if (!Number.isFinite(need) || need <= 0) {
        continue;
      }
      const prev = Math.max(0, Number(entry.digRevealTicksApplied) || 0);
      entry.digRevealTicksApplied = Math.min(need, prev + dt);
    }
  }
}
