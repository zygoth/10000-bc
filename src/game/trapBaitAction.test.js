import { createInitialGameState, advanceTick, validateAction, pickupAddOptionsFromWorldStack } from './simCore.mjs';
import { ROTTING_ORGANIC_ITEM_ID } from './simCore.constants.mjs';

function tileAt(state, x, y) {
  return state.tiles[y * state.width + x];
}

describe('trap_bait action', () => {
  test('plant bait without stack decay metadata does not rot off the snare on the post-action tick', () => {
    const state = createInitialGameState(91021, { width: 20, height: 20 });
    state.actors.player.x = 5;
    state.actors.player.y = 5;
    const tx = 6;
    const ty = 5;
    const baitId = 'daucus_carota:leaf:green';
    state.actors.player.inventory.stacks = [
      { itemId: 'tool:simple_snare', quantity: 1 },
      { itemId: baitId, quantity: 1 },
    ];

    let s = advanceTick(state, {
      actions: [{ actionId: 'place', actorId: 'player', kind: 'trap_place_snare', payload: { x: tx, y: ty } }],
    });

    const v = validateAction(s, {
      actorId: 'player',
      kind: 'trap_bait',
      payload: { x: tx, y: ty, baitItemId: baitId },
    });
    expect(v.ok).toBe(true);

    s = advanceTick(s, {
      actions: [{ actionId: 'bait', actorId: 'player', kind: 'trap_bait', payload: v.normalizedAction.payload }],
    });

    const t = tileAt(s, tx, ty);
    const key = `${tx},${ty}`;
    const world = s.worldItemsByTile[key] || [];

    expect(t.simpleSnare?.baitItemId).toBe(baitId);
    expect(t.simpleSnare?.baitStack?.itemId).toBe(baitId);
    expect(world.some((st) => st.itemId === ROTTING_ORGANIC_ITEM_ID)).toBe(false);
  });

  test('trap bait preserves stack fields for return via pickup options', () => {
    const state = createInitialGameState(91022, { width: 20, height: 20 });
    state.actors.player.x = 5;
    state.actors.player.y = 5;
    const tx = 6;
    const ty = 5;
    const baitId = 'daucus_carota:leaf:green';
    state.actors.player.inventory.stacks = [
      { itemId: 'tool:simple_snare', quantity: 1 },
      {
        itemId: baitId,
        quantity: 1,
        decayDaysRemaining: 2.5,
        dryness: 0.15,
        unitWeightKg: 0.002,
        futureField: 'kept',
      },
    ];

    let s = advanceTick(state, {
      actions: [{ actionId: 'place', actorId: 'player', kind: 'trap_place_snare', payload: { x: tx, y: ty } }],
    });
    const v = validateAction(s, {
      actorId: 'player',
      kind: 'trap_bait',
      payload: { x: tx, y: ty, baitItemId: baitId },
    });
    s = advanceTick(s, {
      actions: [{ actionId: 'bait', actorId: 'player', kind: 'trap_bait', payload: v.normalizedAction.payload }],
    });

    const baitOnTrap = tileAt(s, tx, ty).simpleSnare?.baitStack;
    expect(baitOnTrap?.futureField).toBe('kept');
    expect(baitOnTrap?.dryness).toBe(0.15);
    expect(baitOnTrap?.decayDaysRemaining).toBeGreaterThan(2.4);
    expect(baitOnTrap?.decayDaysRemaining).toBeLessThanOrEqual(2.5);

    const opts = pickupAddOptionsFromWorldStack(baitOnTrap);
    expect(opts.dryness).toBe(0.15);
    expect(opts.unitWeightKg).toBe(0.002);
    expect(opts.decayDaysRemaining).toBeGreaterThan(2.4);
    expect(opts.decayDaysRemaining).toBeLessThanOrEqual(2.5);
  });
});
