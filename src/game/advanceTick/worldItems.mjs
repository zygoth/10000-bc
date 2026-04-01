import { coerceOptionalMetaNumber } from '../coerceOptionalMetaNumber.mjs';

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

function worldItemTileKey(x, y) {
  return `${x},${y}`;
}

export function removeWorldItemAtTileImpl(state, x, y, itemId, quantity, deps) {
  const { inBounds, findPreferredStackByItem, clamp01, normalizeStackFootprintValue } = deps;
  if (!inBounds(x, y, state.width, state.height)) {
    return { consumed: 0, freshness: null, decayDaysRemaining: null, dryness: null, tanninRemaining: null };
  }
  const tileKey = worldItemTileKey(x, y);
  const stacks = Array.isArray(state.worldItemsByTile?.[tileKey]) ? state.worldItemsByTile[tileKey] : [];
  const stack = findPreferredStackByItem(stacks, itemId, quantity);
  if (!stack) {
    return { consumed: 0, freshness: null, decayDaysRemaining: null, dryness: null, tanninRemaining: null };
  }

  const qty = Math.max(1, Math.floor(Number(quantity) || 1));
  const available = Math.max(0, Math.floor(Number(stack.quantity) || 0));
  const consumed = Math.min(available, qty);
  const freshness = Number.isFinite(Number(stack.freshness)) ? Number(stack.freshness) : null;
  const decayDaysRemaining = Number.isFinite(Number(stack.decayDaysRemaining))
    ? Number(stack.decayDaysRemaining)
    : null;
  const dryness = Number.isFinite(Number(stack.dryness))
    ? clamp01(Number(stack.dryness))
    : null;
  const tanninRemaining = Number.isFinite(Number(stack.tanninRemaining))
    ? clamp01(Number(stack.tanninRemaining))
    : null;
  const unitWeightKg = Number.isFinite(Number(stack.unitWeightKg)) ? Number(stack.unitWeightKg) : null;
  const footprintW = normalizeStackFootprintValue(stack.footprintW);
  const footprintH = normalizeStackFootprintValue(stack.footprintH);
  stack.quantity = available - consumed;

  const nextStacks = stacks.filter((entry) => (Number(entry?.quantity) || 0) > 0);
  if (nextStacks.length > 0) {
    state.worldItemsByTile[tileKey] = nextStacks;
  } else if (state.worldItemsByTile) {
    delete state.worldItemsByTile[tileKey];
  }

  return {
    consumed,
    freshness,
    decayDaysRemaining,
    dryness,
    tanninRemaining,
    unitWeightKg,
    footprintW,
    footprintH,
  };
}

export function addWorldItemNearbyImpl(state, originX, originY, itemId, quantity, options = null, deps) {
  const {
    normalizeStackFootprintValue,
    inBounds,
    tileIndex,
    isRockTile,
    mergeStackMetadata,
    clamp01,
  } = deps;
  if (!state || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return 0;
  }

  if (!state.worldItemsByTile || typeof state.worldItemsByTile !== 'object') {
    state.worldItemsByTile = {};
  }

  const qty = Math.max(1, Math.floor(quantity));
  const incomingFreshness = coerceOptionalMetaNumber(options?.freshness);
  const incomingDecayDaysRemaining = coerceOptionalMetaNumber(options?.decayDaysRemaining);
  const incomingUnitWeightKg = coerceOptionalMetaNumber(options?.unitWeightKg);
  const incomingDryness = coerceOptionalMetaNumber(options?.dryness);
  const incomingTanninRemaining = coerceOptionalMetaNumber(options?.tanninRemaining);
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
      if (Number.isFinite(incomingTanninRemaining)) {
        nextStack.tanninRemaining = clamp01(incomingTanninRemaining);
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
        incomingTanninRemaining,
      );
      state.worldItemsByTile[key] = [existing];
      return qty;
    }
  }

  return 0;
}

export function addActorInventoryItemWithOverflowDropImpl(state, actor, itemId, quantity, options = null, deps) {
  const { addActorInventoryItem, addWorldItemNearby } = deps;
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
