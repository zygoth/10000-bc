import { applyActorInventoryRelocation, checkActorInventoryRelocation } from './inventoryRelocate.mjs';

function makeActor(stacks) {
  return {
    inventory: {
      gridWidth: 6,
      gridHeight: 4,
      stacks,
      equipment: { gloves: null, coat: null, head: null },
    },
  };
}

describe('inventoryRelocate', () => {
  it('relocates 1x1 stack to empty cell', () => {
    const actor = makeActor([
      { itemId: 'a', quantity: 1, slotX: 0, slotY: 0, footprintW: 1, footprintH: 1 },
    ]);
    const r = applyActorInventoryRelocation(actor, 0, 3, 2);
    expect(r.ok).toBe(true);
    expect(actor.inventory.stacks[0].slotX).toBe(3);
    expect(actor.inventory.stacks[0].slotY).toBe(2);
  });

  it('rejects move when target overlaps another stack', () => {
    const actor = makeActor([
      { itemId: 'a', quantity: 1, slotX: 0, slotY: 0, footprintW: 1, footprintH: 1 },
      { itemId: 'b', quantity: 1, slotX: 2, slotY: 0, footprintW: 1, footprintH: 1 },
    ]);
    const r = checkActorInventoryRelocation(actor, 0, 2, 0);
    expect(r.ok).toBe(false);
  });

  it('rejects out-of-bounds placement for wide footprint', () => {
    const actor = makeActor([
      { itemId: 'big', quantity: 1, slotX: 0, slotY: 0, footprintW: 2, footprintH: 2 },
    ]);
    const r = checkActorInventoryRelocation(actor, 0, 5, 0);
    expect(r.ok).toBe(false);
  });

  it('allows valid 2x2 move into free region', () => {
    const actor = makeActor([
      { itemId: 'big', quantity: 1, slotX: 0, slotY: 0, footprintW: 2, footprintH: 2 },
      { itemId: 's', quantity: 1, slotX: 4, slotY: 0, footprintW: 1, footprintH: 1 },
    ]);
    const r = applyActorInventoryRelocation(actor, 0, 2, 2);
    expect(r.ok).toBe(true);
    expect(actor.inventory.stacks[0].slotX).toBe(2);
    expect(actor.inventory.stacks[0].slotY).toBe(2);
  });
});
