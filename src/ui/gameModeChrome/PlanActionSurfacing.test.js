import {
  buildBaseGameState,
  withCampStation,
  withPlayerAt,
  withPlayerInventory,
  withRockTile,
} from '../../../tests/fixtures/buildTestGameState.mjs';
import { validateAction } from '../../game/simCore.mjs';
import { getTileContextMenuEntries } from './TileContextMenuDisplayLogic.js';

const NETTLE_STALK = 'urtica_dioica:stalk:green';

describe('Plan: surfacing + sim (fixtures)', () => {
  test('fixture builder produces valid butcher validation', () => {
    let state = buildBaseGameState(7001, { width: 20, height: 20 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    state = withCampStation(state, 'workbench', { x: ax + 1, y: ay });
    withPlayerAt(state, ax, ay);
    withPlayerInventory(state, [
      { itemId: 'tool:flint_knife', quantity: 1 },
      { itemId: 'sylvilagus_floridanus:carcass', quantity: 1 },
    ]);
    const base = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: 'sylvilagus_floridanus:carcass',
        processId: 'butcher',
        quantity: 1,
      },
    });
    expect(base.ok).toBe(true);
    expect(base.normalizedAction.tickCost).toBe(8);
  });

  test('butcher workbench bonus applies anywhere in camp when workbench is built (not only when adjacent)', () => {
    let state = buildBaseGameState(7010, { width: 20, height: 20 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    state = withCampStation(state, 'workbench', { x: ax - 1, y: ay - 1 });
    withPlayerAt(state, ax + 2, ay + 2);
    withPlayerInventory(state, [
      { itemId: 'tool:flint_knife', quantity: 1 },
      { itemId: 'sylvilagus_floridanus:carcass', quantity: 1 },
    ]);
    const v = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: 'sylvilagus_floridanus:carcass',
        processId: 'butcher',
        quantity: 1,
      },
    });
    expect(v.ok).toBe(true);
    expect(v.normalizedAction.tickCost).toBe(8);
  });

  test('research unlock alone does not grant workbench bonus without a built station', () => {
    const state = buildBaseGameState(7011, { width: 20, height: 20 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    state.camp.stationsUnlocked = ['workbench'];
    state.camp.stationPlacements = {};
    withPlayerAt(state, ax, ay);
    withPlayerInventory(state, [
      { itemId: 'tool:flint_knife', quantity: 1 },
      { itemId: 'sylvilagus_floridanus:carcass', quantity: 1 },
    ]);
    const v = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: 'sylvilagus_floridanus:carcass',
        processId: 'butcher',
        quantity: 1,
      },
    });
    expect(v.ok).toBe(true);
    expect(v.normalizedAction.tickCost).toBe(10);
  });

  test('butchering without workbench discount uses full tick cost', () => {
    let state = buildBaseGameState(7002, { width: 20, height: 20 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    withPlayerAt(state, ax, ay);
    withPlayerInventory(state, [
      { itemId: 'tool:flint_knife', quantity: 1 },
      { itemId: 'sylvilagus_floridanus:carcass', quantity: 1 },
    ]);
    const v = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: 'sylvilagus_floridanus:carcass',
        processId: 'butcher',
        quantity: 1,
      },
    });
    expect(v.ok).toBe(true);
    expect(v.normalizedAction.tickCost).toBe(10);
  });

  test('hand spin_cordage validates with higher tick cost than thread spinner', () => {
    let state = buildBaseGameState(7003, { width: 20, height: 20 });
    withPlayerAt(state, 5, 5);
    withPlayerInventory(state, [{ itemId: NETTLE_STALK, quantity: 3 }]);
    const hand = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: NETTLE_STALK,
        processId: 'spin_cordage',
        quantity: 1,
        processLocation: 'hand',
      },
    });
    expect(hand.ok).toBe(true);
    expect(hand.normalizedAction.tickCost).toBe(4);
    expect(hand.normalizedAction.payload.processLocation).toBe('hand');
  });

  test('hand process_item gets workbench tick reduction (e.g. spin_cordage)', () => {
    let state = buildBaseGameState(7012, { width: 20, height: 20 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    state = withCampStation(state, 'workbench', { x: ax + 1, y: ay });
    withPlayerAt(state, ax, ay);
    withPlayerInventory(state, [{ itemId: NETTLE_STALK, quantity: 3 }]);
    const v = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: {
        itemId: NETTLE_STALK,
        processId: 'spin_cordage',
        quantity: 1,
        processLocation: 'hand',
      },
    });
    expect(v.ok).toBe(true);
    expect(v.normalizedAction.tickCost).toBe(3);
  });

  test('glacial erratic tile menu surfaces heavy rock and flat stone harvests', () => {
    let state = buildBaseGameState(7004, { width: 20, height: 20 });
    const x = 8;
    const y = 8;
    withRockTile(state, x, y, 'glacial_erratic');
    withPlayerAt(state, x, y);

    const helpers = {
      inferTileContextActions: () => [],
      buildDefaultPayload: () => ({}),
      formatTokenLabel: (v) => String(v || ''),
      getStationIdAtTile: () => null,
      stationActionLabel: () => '',
    };
    const tile = state.tiles[y * state.width + x];
    const entries = getTileContextMenuEntries({
      gameState: state,
      playerActor: state.actors.player,
      selectedTileX: x,
      selectedTileY: y,
      selectedTileEntity: tile,
      selectedTileWorldItems: [],
      selectedTileWorldItemEntries: [],
      selectedContext: {},
      ...helpers,
    });
    const rockHarvests = entries.filter((e) => e.kind === 'harvest');
    expect(rockHarvests.map((e) => e.label).sort()).toEqual(['Harvest flat stone', 'Harvest heavy rock']);
    expect(rockHarvests.every((e) => Number.isFinite(e.tickCost) && e.tickCost >= 1)).toBe(true);
  });

  test('flint cobble scatter surfaces flint and flat stone harvests', () => {
    let state = buildBaseGameState(7005, { width: 20, height: 20 });
    const x = 9;
    const y = 9;
    withRockTile(state, x, y, 'flint_cobble_scatter', { flintCobbleRemaining: 3 });
    withPlayerAt(state, x, y);
    const helpers = {
      inferTileContextActions: () => [],
      buildDefaultPayload: () => ({}),
      formatTokenLabel: (v) => String(v || ''),
      getStationIdAtTile: () => null,
      stationActionLabel: () => '',
    };
    const tile = state.tiles[y * state.width + x];
    const entries = getTileContextMenuEntries({
      gameState: state,
      playerActor: state.actors.player,
      selectedTileX: x,
      selectedTileY: y,
      selectedTileEntity: tile,
      selectedTileWorldItems: [],
      selectedTileWorldItemEntries: [],
      selectedContext: {},
      ...helpers,
    });
    const labels = entries.filter((e) => e.kind === 'harvest').map((e) => e.label).sort();
    expect(labels).toEqual(['Harvest flat stone', 'Harvest flint cobbles']);
  });
});
