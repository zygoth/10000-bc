import {
  createInitialGameState,
  getCampStockpileStackForWithdrawPreview,
  getItemPickupInventoryBlockReason,
  maxQuantityActorInventoryCanAccept,
} from './simCore.mjs';

describe('getItemPickupInventoryBlockReason', () => {
  it('returns null when inventory is empty and item fits', () => {
    const state = createInitialGameState(901, { width: 20, height: 20 });
    const player = state.actors.player;
    player.inventory.stacks = [];
    const reason = getItemPickupInventoryBlockReason(player, 'tool:flint_knife', 1, null);
    expect(reason).toBeNull();
  });

  it('returns carry message when over weight limit', () => {
    const state = createInitialGameState(902, { width: 20, height: 20 });
    const player = state.actors.player;
    player.inventory.maxCarryWeightKg = 0.001;
    player.inventory.stacks = [];
    const reason = getItemPickupInventoryBlockReason(player, 'tool:flint_knife', 1, null);
    expect(reason).toBe('Exceeds carry weight.');
  });
});

describe('maxQuantityActorInventoryCanAccept', () => {
  it('returns 0 when grid has no room for another wide stack', () => {
    const state = createInitialGameState(904, { width: 20, height: 20 });
    const player = state.actors.player;
    player.inventory.gridWidth = 2;
    player.inventory.gridHeight = 2;
    player.inventory.stacks = [
      { itemId: 'block', quantity: 1, footprintW: 2, footprintH: 2, slotX: 0, slotY: 0 },
    ];
    const n = maxQuantityActorInventoryCanAccept(player, 'other_big', 1, { footprintW: 2, footprintH: 2 });
    expect(n).toBe(0);
  });
});

describe('getCampStockpileStackForWithdrawPreview', () => {
  it('returns the matching stockpile stack for withdraw', () => {
    const state = createInitialGameState(903, { width: 20, height: 20 });
    state.camp.stockpile.stacks = [
      { itemId: 'tool:flint_knife', quantity: 1, footprintW: 1, footprintH: 1 },
    ];
    const stack = getCampStockpileStackForWithdrawPreview(state, 'tool:flint_knife', 1);
    expect(stack?.itemId).toBe('tool:flint_knife');
    expect(stack?.quantity).toBe(1);
  });
});
