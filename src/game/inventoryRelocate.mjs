import { ensureActorInventoryImpl, normalizeStackFootprintValueImpl } from './advanceTick/inventory.mjs';

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

function ensureActorInventory(actor) {
  ensureActorInventoryImpl(actor, { ensureInventoryEquipment });
}

function inventoryGridDimensions(inventory) {
  return {
    gridW: Math.max(1, Number.isInteger(inventory?.gridWidth) ? inventory.gridWidth : 6),
    gridH: Math.max(1, Number.isInteger(inventory?.gridHeight) ? inventory.gridHeight : 4),
  };
}

function getStackFootprint(stack) {
  return {
    footprintW: normalizeStackFootprintValueImpl(stack?.footprintW),
    footprintH: normalizeStackFootprintValueImpl(stack?.footprintH),
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

export function checkActorInventoryRelocation(actor, stackIndex, newSlotX, newSlotY) {
  if (!actor || typeof actor !== 'object') {
    return { ok: false, code: 'missing_actor', message: 'inventory relocation requires an actor' };
  }
  ensureActorInventory(actor);
  const stacks = actor.inventory.stacks;
  if (!Array.isArray(stacks)) {
    return { ok: false, code: 'missing_inventory', message: 'actor has no inventory stacks' };
  }
  if (!Number.isInteger(stackIndex) || stackIndex < 0 || stackIndex >= stacks.length) {
    return { ok: false, code: 'invalid_stack_index', message: 'invalid inventory stack index' };
  }
  const stack = stacks[stackIndex];
  const qty = Math.max(0, Math.floor(Number(stack?.quantity) || 0));
  if (qty <= 0) {
    return { ok: false, code: 'empty_stack', message: 'cannot relocate an empty stack' };
  }
  if (!Number.isInteger(newSlotX) || !Number.isInteger(newSlotY)) {
    return { ok: false, code: 'invalid_slot', message: 'slotX and slotY must be integers' };
  }
  const { gridW, gridH } = inventoryGridDimensions(actor.inventory);
  const { footprintW, footprintH } = getStackFootprint(stack);
  const newRect = { x: newSlotX, y: newSlotY, w: footprintW, h: footprintH };
  const placedRects = [];
  for (let i = 0; i < stacks.length; i += 1) {
    if (i === stackIndex) {
      continue;
    }
    const s = stacks[i];
    const q = Math.max(0, Math.floor(Number(s?.quantity) || 0));
    if (q <= 0) {
      continue;
    }
    const sx = Number.isInteger(s?.slotX) ? s.slotX : null;
    const sy = Number.isInteger(s?.slotY) ? s.slotY : null;
    if (sx === null || sy === null) {
      continue;
    }
    const fp = getStackFootprint(s);
    placedRects.push({ x: sx, y: sy, w: fp.footprintW, h: fp.footprintH });
  }
  if (!canPlaceRect(newRect, placedRects, gridW, gridH)) {
    return {
      ok: false,
      code: 'inventory_relocation_blocked',
      message: 'target inventory cells are out of bounds or occupied',
    };
  }
  return { ok: true, code: null, message: 'ok' };
}

export function applyActorInventoryRelocation(actor, stackIndex, newSlotX, newSlotY) {
  const result = checkActorInventoryRelocation(actor, stackIndex, newSlotX, newSlotY);
  if (!result.ok) {
    return result;
  }
  const stack = actor.inventory.stacks[stackIndex];
  stack.slotX = newSlotX;
  stack.slotY = newSlotY;
  return result;
}
