export function addCampStockpileItemImpl(camp, itemId, quantity, options = null, deps) {
  const {
    normalizeStackFootprintValue,
    findCompatibleStackForAutoMerge,
    clamp01,
  } = deps;

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
  const incomingTanninRemaining = Number(options?.tanninRemaining);
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
    if (Number.isFinite(incomingTanninRemaining)) {
      const priorTanninRemaining = Number(existing.tanninRemaining);
      existing.tanninRemaining = Number.isFinite(priorTanninRemaining)
        ? clamp01(((priorTanninRemaining * priorQty) + (incomingTanninRemaining * qty)) / Math.max(1, priorQty + qty))
        : clamp01(incomingTanninRemaining);
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
  if (Number.isFinite(incomingTanninRemaining)) {
    nextStack.tanninRemaining = clamp01(incomingTanninRemaining);
  }
  if (Number.isFinite(incomingUnitWeightKg) && incomingUnitWeightKg >= 0) {
    nextStack.unitWeightKg = incomingUnitWeightKg;
  }
  nextStack.footprintW = incomingFootprintW;
  nextStack.footprintH = incomingFootprintH;

  camp.stockpile.stacks.push(nextStack);
}

export function removeCampStockpileItemImpl(camp, itemId, quantity, deps) {
  const { findPreferredStackByItem, clamp01, normalizeStackFootprintValue } = deps;
  if (!camp || typeof itemId !== 'string' || !itemId || !Number.isFinite(quantity) || quantity <= 0) {
    return { consumed: 0, freshness: null, decayDaysRemaining: null, dryness: null, tanninRemaining: null };
  }

  const stacks = Array.isArray(camp?.stockpile?.stacks) ? camp.stockpile.stacks : [];
  const stack = findPreferredStackByItem(stacks, itemId, quantity);
  if (!stack) {
    return { consumed: 0, freshness: null, decayDaysRemaining: null, dryness: null, tanninRemaining: null };
  }

  const qty = Math.max(1, Math.floor(quantity));
  const available = Math.max(0, Math.floor(Number(stack.quantity) || 0));
  const consumed = Math.min(available, qty);
  if (consumed <= 0) {
    return { consumed: 0, freshness: null, decayDaysRemaining: null, dryness: null, tanninRemaining: null };
  }

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
  camp.stockpile.stacks = stacks.filter((entry) => (Number(entry?.quantity) || 0) > 0);
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

export function ensureCampDryingRackStateImpl(camp) {
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

export function addCampDryingRackItemImpl(camp, itemId, quantity, options = null, deps) {
  const { addActorInventoryItem } = deps;
  ensureCampDryingRackStateImpl(camp);
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
