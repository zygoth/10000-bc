import { coerceOptionalMetaNumber } from '../coerceOptionalMetaNumber.mjs';

export function ensureActorInventoryImpl(actor, deps) {
  const { ensureInventoryEquipment } = deps;
  if (!actor.inventory || typeof actor.inventory !== 'object') {
    actor.inventory = {
      gridWidth: 6,
      gridHeight: 4,
      maxCarryWeightKg: 15,
      stacks: [],
      equipment: {
        gloves: null,
        coat: null,
        head: null,
      },
    };
    return;
  }

  if (!Array.isArray(actor.inventory.stacks)) {
    actor.inventory.stacks = [];
  }

  ensureInventoryEquipment(actor.inventory);
}

export function normalizeStackFootprintValueImpl(value) {
  if (Number.isInteger(value) && value > 0) {
    return value;
  }

  const parsed = Math.floor(Number(value || 1));
  return Math.max(1, parsed);
}

export function addActorInventoryItemImpl(actor, itemId, quantity, options = null, deps) {
  const {
    ensureActorInventory,
    getStackUnitWeightKg,
    getCatalogUnitWeightKgForItem,
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
  } = deps;
  if (!actor || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return { addedQuantity: 0, overflowQuantity: Math.max(0, Math.floor(Number(quantity) || 0)) };
  }

  ensureActorInventory(actor);
  const qtyRequested = Math.max(1, Math.floor(quantity));
  const catalogFallbackKg = typeof getCatalogUnitWeightKgForItem === 'function'
    ? getCatalogUnitWeightKgForItem(itemId)
    : 0;
  const unitWeightKg = getStackUnitWeightKg(options, catalogFallbackKg);
  const maxByWeight = maxQuantityByCarryWeight(actor.inventory, unitWeightKg);
  const qty = Math.min(qtyRequested, Number.isFinite(maxByWeight) ? maxByWeight : qtyRequested);
  if (qty <= 0) {
    return { addedQuantity: 0, overflowQuantity: qtyRequested };
  }

  const incomingFreshness = coerceOptionalMetaNumber(options?.freshness);
  const incomingDecayDaysRemaining = coerceOptionalMetaNumber(options?.decayDaysRemaining);
  const incomingDryness = coerceOptionalMetaNumber(options?.dryness);
  const incomingTanninRemaining = coerceOptionalMetaNumber(options?.tanninRemaining);
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
      incomingTanninRemaining,
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
  if (Number.isFinite(incomingTanninRemaining)) {
    nextStack.tanninRemaining = clamp01(incomingTanninRemaining);
  }

  actor.inventory.stacks.push(nextStack);
  return { addedQuantity: qty, overflowQuantity: qtyRequested - qty };
}

export function removeActorInventoryItemImpl(actor, itemId, quantity, deps) {
  const { ensureActorInventory, findPreferredStackByItem } = deps;
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

export function extractActorInventoryItemWithMetadataImpl(actor, itemId, quantity, deps) {
  const {
    findPreferredStackByItem,
    removeActorInventoryItem,
    normalizeStackFootprintValue,
  } = deps;
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
    tanninRemaining: Number.isFinite(Number(stack?.tanninRemaining)) ? Number(stack.tanninRemaining) : null,
    unitWeightKg: Number.isFinite(Number(stack?.unitWeightKg)) ? Number(stack.unitWeightKg) : null,
    footprintW: normalizeStackFootprintValue(stack?.footprintW),
    footprintH: normalizeStackFootprintValue(stack?.footprintH),
  };
}
