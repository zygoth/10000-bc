import {
  buildBaseGameState,
  withCampStation,
  withPlayerAt,
  withPlayerInventory,
} from '../../../tests/fixtures/buildTestGameState.mjs';
import { buildInventoryQuickActionsMatrix, buildStockpileQuickActionsByItemId } from './actionContextWiring.mjs';

const NETTLE_STALK = 'urtica_dioica:stalk:green';

function fmtToken(v) {
  return String(v || '').replace(/_/g, ' ');
}

function stationLabel(id) {
  if (id === 'thread_spinner') return 'Spin Thread...';
  return `Use ${id}...`;
}

describe('Inventory context menu surfacing (headless)', () => {
  test('hand process_item entries include processId and optional processLocation in payload', () => {
    let state = buildBaseGameState(92001, { width: 20, height: 20 });
    withPlayerAt(state, 5, 5);
    withPlayerInventory(state, [{ itemId: NETTLE_STALK, quantity: 3 }]);

    const matrix = buildInventoryQuickActionsMatrix({
      gameState: state,
      playerActor: state.actors.player,
      playerInventoryEntries: [{ itemId: NETTLE_STALK, quantity: 3, name: 'Nettle' }],
      selectedTileX: 5,
      selectedTileY: 5,
      selectedTileEntity: state.tiles[5 * state.width + 5],
      selectedStockpileItemId: null,
      selectedStockpileQuantity: 1,
      selectedWorldItemId: null,
      selectedWorldItemQuantity: 1,
      selectedConditionInstanceId: null,
      selectedVisionItemId: null,
      selectedVisionCategory: null,
      selectedNatureOverlay: 'calorie_heatmap',
      formatTokenLabel: fmtToken,
      stationActionLabel: stationLabel,
    });

    const actions = matrix[0];
    const spin = actions.find((e) => e.kind === 'process_item' && e.payload?.processId === 'spin_cordage');
    expect(spin).toBeDefined();
    expect(spin.payload.itemId).toBe(NETTLE_STALK);
    expect(spin.payload.processLocation).toBe('hand');
    expect(spin.payload.quantity).toBe(1);
  });

  test('open_station_process_quantity carries stationId and itemId for thread spinner', () => {
    let state = buildBaseGameState(92002, { width: 20, height: 20 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    state = withCampStation(state, 'thread_spinner', { x: ax + 1, y: ay });
    withPlayerAt(state, ax, ay);
    withPlayerInventory(state, [{ itemId: NETTLE_STALK, quantity: 2 }]);

    const matrix = buildInventoryQuickActionsMatrix({
      gameState: state,
      playerActor: state.actors.player,
      playerInventoryEntries: [{ itemId: NETTLE_STALK, quantity: 2, name: 'Nettle' }],
      selectedTileX: ax,
      selectedTileY: ay,
      selectedTileEntity: state.tiles[ay * state.width + ax],
      selectedStockpileItemId: null,
      selectedStockpileQuantity: 1,
      selectedWorldItemId: null,
      selectedWorldItemQuantity: 1,
      selectedConditionInstanceId: null,
      selectedVisionItemId: null,
      selectedVisionCategory: null,
      selectedNatureOverlay: 'calorie_heatmap',
      formatTokenLabel: fmtToken,
      stationActionLabel: stationLabel,
    });

    const open = matrix[0].find((e) => e.kind === 'open_station_process_quantity');
    expect(open).toBeDefined();
    expect(open.payload.stationId).toBe('thread_spinner');
    expect(open.payload.itemId).toBe(NETTLE_STALK);
    expect(open.payload.source).toBe('inventory');
  });

  test('stockpile withdraw surfaces payload.itemId for the selected stockpile row', () => {
    const state = buildBaseGameState(92003, { width: 18, height: 18 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    withPlayerAt(state, ax, ay);
    const itemId = 'cordage';
    state.camp.stockpile.stacks = [{ itemId, quantity: 4 }];
    const row = { itemId, quantity: 4, name: 'Cordage' };

    const byId = buildStockpileQuickActionsByItemId({
      gameState: state,
      playerActor: state.actors.player,
      campStockpileEntries: [row],
      campStockpileStacks: state.camp.stockpile.stacks,
      selectedTileX: ax,
      selectedTileY: ay,
      selectedTileEntity: state.tiles[ay * state.width + ax],
      selectedInventoryItemId: null,
      selectedInventoryQuantity: 1,
      selectedWorldItemId: null,
      selectedWorldItemQuantity: 1,
      selectedConditionInstanceId: null,
      selectedVisionItemId: null,
      selectedVisionCategory: null,
      selectedNatureOverlay: 'calorie_heatmap',
    });

    const withdraw = byId[itemId].find((e) => e.kind === 'camp_stockpile_remove');
    expect(withdraw).toBeDefined();
    expect(withdraw.payload.itemId).toBe(itemId);
    expect(Number(withdraw.payload.quantity) >= 1).toBe(true);
  });
});
