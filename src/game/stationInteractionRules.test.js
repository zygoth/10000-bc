import { createInitialGameState, previewCampDryingRackAdd, validateAction } from './simCore.mjs';

function buildStateWithStations() {
  const state = createInitialGameState(10000, { width: 40, height: 40 });
  const campX = Number(state?.camp?.anchorX) || 20;
  const campY = Number(state?.camp?.anchorY) || 20;
  state.camp.stationsUnlocked = ['mortar_pestle', 'drying_rack'];
  state.camp.stationPlacements = {
    mortar_pestle: { x: campX + 1, y: campY },
    drying_rack: { x: campX, y: campY + 1 },
  };
  state.actors.player.x = campX;
  state.actors.player.y = campY;
  return state;
}

describe('station interaction rules', () => {
  it('scales process_item tick cost by quantity', () => {
    const state = buildStateWithStations();
    state.actors.player.inventory.stacks = [
      { itemId: 'juglans_nigra:husked_nut:whole', quantity: 4 },
    ];
    const validation = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: 'juglans_nigra:husked_nut:whole',
        processId: 'crack_shell',
        quantity: 4,
      },
    });
    expect(validation.ok).toBe(true);
    expect(validation.normalizedAction.tickCost).toBe(40);
  });

  it('allows drying-rack add for can_dry walnut meat', () => {
    const state = buildStateWithStations();
    state.camp.stockpile.stacks = [
      { itemId: 'juglans_nigra:walnut_meat:raw', quantity: 2 },
    ];
    const validation = validateAction(state, {
      actorId: 'player',
      kind: 'camp_drying_rack_add',
      payload: {
        itemId: 'juglans_nigra:walnut_meat:raw',
        quantity: 1,
      },
    });
    expect(validation.ok).toBe(true);
  });

  it('previewCampDryingRackAdd clones slots and stacks merged quantity without mutating input', () => {
    const slots = [
      {
        itemId: 'juglans_nigra:walnut_meat:raw',
        quantity: 1,
        slotX: 0,
        slotY: 0,
        footprintW: 1,
        footprintH: 1,
        decayDaysRemaining: 5,
        dryness: 0.1,
      },
    ];
    const snapshot = JSON.stringify(slots);
    const preview = previewCampDryingRackAdd(slots, 'juglans_nigra:walnut_meat:raw', 1, {
      decayDaysRemaining: 5,
      dryness: 0.2,
      footprintW: 1,
      footprintH: 1,
    });
    expect(JSON.stringify(slots)).toBe(snapshot);
    const nutStacks = preview.nextSlots.filter((s) => s.itemId === 'juglans_nigra:walnut_meat:raw');
    const totalQty = nutStacks.reduce((n, s) => n + (Number(s.quantity) || 0), 0);
    expect(totalQty).toBe(2);
  });
});
