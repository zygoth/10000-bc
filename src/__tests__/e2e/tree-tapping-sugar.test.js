import { SAP_FILLED_VESSEL_ITEM_ID } from '../../game/simCore.constants.mjs';
import { advanceDay, advanceTick, validateAction } from '../../game/simCore.mjs';
import { getTileContextMenuEntriesForTest } from '../../ui/gameModeChrome/tileContextMenuTestHelpers.js';
import { buildBaseGameState, withCampStation, withPlayerAt } from '../../../tests/fixtures/buildTestGameState.mjs';
import {
  advanceToolCraft,
  applyAllResearchUnlocks,
  boostPlayerForTests,
  prepareStateForToolRecipeCraft,
} from '../../../tests/fixtures/craftingTestFixtures.mjs';

/**
 * Camp footprint is anchorX-1..anchorX+2. Every advanceTick runs clearPlantsFromCampFootprint via
 * ensureTickSystems, which strips plants on those tiles — so the tappable tree must sit outside
 * the footprint. Player stands on the footprint tile west-adjacent to the tree (in tap range).
 */
function addMatureTappableWalnutToTile(state, tile, plantId = 'test_tappable_walnut_e2e') {
  state.plants[plantId] = {
    id: plantId,
    speciesId: 'juglans_nigra',
    age: 500,
    x: tile.x,
    y: tile.y,
    stageName: 'mature_vegetative',
    alive: true,
    vitality: 1,
    activeSubStages: [],
    source: 'test',
  };
  tile.plantIds = [plantId];
}

describe('Tree tap → sap vessel → boil (e2e headless menus + sim)', () => {
  test('full pipeline surfaces tile actions and produces tree_sugar', () => {
    let state = buildBaseGameState(63001, { width: 26, height: 26 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    const w = state.width;
    const tx = ax - 2;
    const ty = ay;
    expect(tx).toBeGreaterThanOrEqual(0);

    const treeTile = state.tiles[ty * w + tx];
    treeTile.waterType = null;
    treeTile.rockType = null;
    addMatureTappableWalnutToTile(state, treeTile);

    state = prepareStateForToolRecipeCraft(state, 'carved_wooden_spout');
    state = advanceToolCraft(state, 'carved_wooden_spout');
    state = prepareStateForToolRecipeCraft(state, 'hide_vessel');
    state = advanceToolCraft(state, 'hide_vessel');

    boostPlayerForTests(state);
    withPlayerAt(state, ax - 1, ay);

    const treeIdx = ty * w + tx;
    expect(state.tiles[treeIdx].plantIds).toContain('test_tappable_walnut_e2e');
    expect(state.plants.test_tappable_walnut_e2e?.alive).toBe(true);

    const vTapProbe = validateAction(state, {
      actorId: 'player',
      kind: 'tap_insert_spout',
      payload: { x: tx, y: ty },
    });
    expect(vTapProbe.ok).toBe(true);

    let entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: tx,
      selectedTileY: ty,
      selectedTileEntity: state.tiles[treeIdx],
    });
    expect(entries.some((e) => e.kind === 'tap_insert_spout')).toBe(true);

    const vSpout = validateAction(state, {
      actorId: 'player',
      kind: 'tap_insert_spout',
      payload: { x: tx, y: ty },
    });
    expect(vSpout.ok).toBe(true);
    state = advanceTick(state, {
      actions: [{ actionId: 'tap-in', actorId: 'player', kind: 'tap_insert_spout', payload: vSpout.normalizedAction.payload }],
    });

    entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: tx,
      selectedTileY: ty,
      selectedTileEntity: state.tiles[treeIdx],
    });
    expect(entries.some((e) => e.kind === 'tap_place_vessel')).toBe(true);

    const vPlace = validateAction(state, {
      actorId: 'player',
      kind: 'tap_place_vessel',
      payload: { x: tx, y: ty },
    });
    expect(vPlace.ok).toBe(true);
    state = advanceTick(state, {
      actions: [{ actionId: 'tap-v', actorId: 'player', kind: 'tap_place_vessel', payload: vPlace.normalizedAction.payload }],
    });

    state = advanceDay(state, 1);

    const tileAfter = state.tiles[treeIdx];
    expect(tileAfter.sapTap?.vesselSapUnits).toBeGreaterThanOrEqual(1);

    withPlayerAt(state, ax - 1, ay);
    entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: tx,
      selectedTileY: ty,
      selectedTileEntity: tileAfter,
    });
    expect(entries.some((e) => e.kind === 'tap_retrieve_vessel')).toBe(true);

    const vRet = validateAction(state, {
      actorId: 'player',
      kind: 'tap_retrieve_vessel',
      payload: { x: tx, y: ty },
    });
    expect(vRet.ok).toBe(true);
    state = advanceTick(state, {
      actions: [{ actionId: 'tap-r', actorId: 'player', kind: 'tap_retrieve_vessel', payload: vRet.normalizedAction.payload }],
    });

    expect(
      state.actors.player.inventory.stacks.some((s) => s.itemId === SAP_FILLED_VESSEL_ITEM_ID && (s.quantity || 0) >= 1),
    ).toBe(true);

    withCampStation(state, 'sugar_boiling_station', { x: ax, y: ay });
    const vBoil = validateAction(state, {
      actorId: 'player',
      kind: 'process_item',
      payload: { itemId: SAP_FILLED_VESSEL_ITEM_ID, processId: 'boil_sap', quantity: 1 },
    });
    expect(vBoil.ok).toBe(true);
    state = advanceTick(state, {
      actions: [{ actionId: 'boil', actorId: 'player', kind: 'process_item', payload: vBoil.normalizedAction.payload }],
    });

    expect(state.actors.player.inventory.stacks.some((s) => s.itemId === 'tree_sugar' && (s.quantity || 0) >= 1)).toBe(true);
  });
});
