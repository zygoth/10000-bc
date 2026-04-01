import { validateAction } from './simActions.mjs';
import { advanceTick, createInitialGameState } from './simCore.mjs';

function stateWithMortarAndNut(decayDaysRemaining) {
  const state = createInitialGameState(4243, { width: 40, height: 40 });
  const ax = state.camp.anchorX;
  const ay = state.camp.anchorY;
  state.camp.stationsUnlocked = ['mortar_pestle'];
  state.camp.stationPlacements = { mortar_pestle: { x: ax + 1, y: ay } };
  state.actors.player.x = ax;
  state.actors.player.y = ay;
  state.actors.player.inventory.stacks = [{
    itemId: 'juglans_nigra:husked_nut:whole',
    quantity: 1,
    decayDaysRemaining,
    footprintW: 1,
    footprintH: 1,
    slotX: 0,
    slotY: 0,
  }];
  return state;
}

describe('resumable process_item execution order', () => {
  it('yields walnut meat + shell after multi-tick crack_shell (nut must survive decay during work ticks)', () => {
    // crack_shell costs 10 ticks; inventory decay runs each tick before the effect applies.
    let state = stateWithMortarAndNut(0.5);
    const v = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: 'juglans_nigra:husked_nut:whole',
        processId: 'crack_shell',
        quantity: 1,
      },
    });
    expect(v.ok).toBe(true);
    state.pendingActionQueue = [v.normalizedAction];
    state = advanceTick(state, {});
    const ids = state.actors.player.inventory.stacks.map((s) => s.itemId).sort();
    expect(ids).toEqual(['juglans_nigra:nutshell:broken', 'juglans_nigra:walnut_meat:raw']);
    const meat = state.actors.player.inventory.stacks.find((s) => s.itemId === 'juglans_nigra:walnut_meat:raw');
    expect(meat.decayDaysRemaining).toBeGreaterThan(100);
  });

  it('validateAction attaches catalog decay to crack_shell outputs', () => {
    const state = stateWithMortarAndNut(300);
    const v = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: 'juglans_nigra:husked_nut:whole',
        processId: 'crack_shell',
        quantity: 1,
      },
    });
    expect(v.ok).toBe(true);
    const outs = v.normalizedAction.payload.outputs;
    const meat = outs.find((o) => o.itemId === 'juglans_nigra:walnut_meat:raw');
    expect(meat.decayDaysRemaining).toBe(120);
  });

  it('camp_stockpile_remove with no stack metadata does not coerce null decay into 0 (would rot next tick)', () => {
    const nutId = 'juglans_nigra:husked_nut:whole';
    let state = createInitialGameState(4244, { width: 40, height: 40 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    state.actors.player.x = ax;
    state.actors.player.y = ay;
    state.camp.stockpile.stacks = [{ itemId: nutId, quantity: 1 }];
    state = advanceTick(state, {
      actions: [{
        actionId: 'w',
        actorId: 'player',
        kind: 'camp_stockpile_remove',
        payload: { itemId: nutId, quantity: 1 },
      }],
    });
    const nut = state.actors.player.inventory.stacks.find((s) => s.itemId === nutId);
    expect(nut).toBeTruthy();
    expect(nut.decayDaysRemaining === 0).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(nut, 'decayDaysRemaining')).toBe(false);
  });
});
