import { advanceTick, validateAction } from '../../game/simCore.mjs';
import { buildBaseGameState, withPlayerAt } from '../../../tests/fixtures/buildTestGameState.mjs';
import { buildInventoryQuickActionsMatrix } from '../../ui/gameModeChrome/actionContextWiring.mjs';
import { getTileContextMenuEntriesForTest } from '../../ui/gameModeChrome/tileContextMenuTestHelpers.js';
import {
  advanceToolCraft,
  applyAllResearchUnlocks,
  boostPlayerForTests,
  prepareStateForToolRecipeCraft,
} from '../../../tests/fixtures/craftingTestFixtures.mjs';

function tileAt(state, x, y) {
  return state.tiles[y * state.width + x];
}

function fmtToken(v) {
  return String(v || '').replace(/_/g, ' ');
}

function stationLabel(id) {
  return `Use ${id}...`;
}

function landWithCardinalRiverNeighborInCamp(state) {
  const ax = state.camp.anchorX;
  const ay = state.camp.anchorY;
  const land = tileAt(state, ax, ay);
  const water = tileAt(state, ax + 1, ay);
  land.waterType = null;
  land.rockType = null;
  land.plantIds = [];
  water.rockType = null;
  water.waterType = 'river';
  water.waterDepth = 'shallow';
  water.waterCurrentStrength = 0.6;
  water.waterCurrentBand = 'medium';
  water.waterFrozen = false;
  return { land, water };
}

describe('Tools: craft → use → UI surfacing (e2e headless)', () => {
  test('waterskin: craft then waterskin_fill appears on adjacent unfrozen water', () => {
    let state = buildBaseGameState(62110, { width: 28, height: 28 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const { land, water } = landWithCardinalRiverNeighborInCamp(state);
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'waterskin');
    state = advanceToolCraft(state, 'waterskin');

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: water.x,
      selectedTileY: water.y,
      selectedTileEntity: water,
    });
    expect(entries.some((e) => e.kind === 'waterskin_fill')).toBe(true);
  });

  test('fishing_rod: craft then fish_rod_cast appears on adjacent water', () => {
    let state = buildBaseGameState(62111, { width: 28, height: 28 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const { land, water } = landWithCardinalRiverNeighborInCamp(state);
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'fishing_rod');
    state = advanceToolCraft(state, 'fishing_rod');

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: water.x,
      selectedTileY: water.y,
      selectedTileEntity: water,
    });
    expect(entries.some((e) => e.kind === 'fish_rod_cast')).toBe(true);
  });

  test('auto_rod: craft then auto_rod_place appears; placing enables trap_check on that tile', () => {
    let state = buildBaseGameState(62112, { width: 28, height: 28 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const { land, water } = landWithCardinalRiverNeighborInCamp(state);
    // Auto rod is placed on the land tile; water just needs to be adjacent.
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'auto_rod');
    state = advanceToolCraft(state, 'auto_rod');

    let entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: land.x,
      selectedTileY: land.y,
      selectedTileEntity: land,
    });
    expect(entries.some((e) => e.kind === 'auto_rod_place')).toBe(true);

    const vPlace = validateAction(state, { actorId: 'player', kind: 'auto_rod_place', payload: { x: land.x, y: land.y } });
    expect(vPlace.ok).toBe(true);
    state = advanceTick(state, {
      actions: [
        { actionId: 'ar', actorId: 'player', kind: 'auto_rod_place', payload: vPlace.normalizedAction.payload },
      ],
    });
    const placed = tileAt(state, land.x, land.y);
    entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: land.x,
      selectedTileY: land.y,
      selectedTileEntity: placed,
    });
    expect(entries.some((e) => e.kind === 'trap_check')).toBe(true);

    // Touch water to avoid unused warning in some bundlers (and asserts it stayed configured).
    expect(water.waterType).toBe('river');
  });

  test.each([
    ['tool:gloves', 'gloves'],
    ['tool:coat', 'coat'],
    ['tool:sun_hat', 'sun_hat'],
  ])('%s: craft then inventory quick actions include equip_item', (itemId, recipeId) => {
    let state = buildBaseGameState(62120 + recipeId.length * 5, { width: 24, height: 24 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    withPlayerAt(state, ax, ay);
    state = prepareStateForToolRecipeCraft(state, recipeId);
    state = advanceToolCraft(state, recipeId);

    const matrix = buildInventoryQuickActionsMatrix({
      gameState: state,
      playerActor: state.actors.player,
      playerInventoryEntries: [{ itemId, quantity: 1, name: recipeId }],
      selectedTileX: ax,
      selectedTileY: ay,
      selectedTileEntity: tileAt(state, ax, ay),
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
    const actions = matrix[0] || [];
    expect(actions.some((e) => e.kind === 'equip_item' && e.payload?.itemId === itemId)).toBe(true);
  });

  test('leaching_basket: craft then leaching_basket_place surfaces with selected tannin item', () => {
    let state = buildBaseGameState(62130, { width: 28, height: 28 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const { land, water } = landWithCardinalRiverNeighborInCamp(state);
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'leaching_basket');
    state = advanceToolCraft(state, 'leaching_basket');

    // Provide a tannin-bearing source stack via explicit tanninRemaining metadata.
    state.actors.player.inventory.stacks.push({
      itemId: 'debug:tannin_source',
      quantity: 1,
      tanninRemaining: 0.8,
    });

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: water.x,
      selectedTileY: water.y,
      selectedTileEntity: water,
      selectedContext: {
        selectedInventoryItemId: 'debug:tannin_source',
        selectedInventoryQuantity: 1,
      },
    });
    const place = entries.find((e) => e.kind === 'leaching_basket_place');
    expect(place).toBeDefined();
    expect(place.payload.itemId).toBe('debug:tannin_source');
    expect(place.payload.x).toBe(water.x);
    expect(place.payload.y).toBe(water.y);
  });

  test('basket: carrying basket expands inventory capacity without equip action', () => {
    let state = buildBaseGameState(62131, { width: 28, height: 28 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    withPlayerAt(state, ax, ay);
    state = prepareStateForToolRecipeCraft(state, 'basket');
    state = advanceToolCraft(state, 'basket');

    const matrix = buildInventoryQuickActionsMatrix({
      gameState: state,
      playerActor: state.actors.player,
      playerInventoryEntries: [{ itemId: 'tool:basket', quantity: 1, name: 'basket' }],
      selectedTileX: ax,
      selectedTileY: ay,
      selectedTileEntity: tileAt(state, ax, ay),
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
    const actions = matrix[0] || [];
    const equip = actions.find((e) => e.kind === 'equip_item' && e.payload?.itemId === 'tool:basket');
    expect(equip).toBeUndefined();

    const carried = advanceTick(state, {
      actions: [
        {
          actionId: 'pickup-basket-e2e',
          actorId: 'player',
          kind: 'item_pickup',
          payload: {
            x: ax,
            y: ay,
            itemId: 'tool:basket',
            quantity: 1,
          },
        },
      ],
    });
    expect(carried.actors.player.inventory.maxCarryWeightKg).toBe(25);
    expect(carried.actors.player.inventory.gridWidth).toBe(7);
  });

  test('sled: right-clicking ground sled and inventory sled surfaces attach; attach makes move cost 2', () => {
    let state = buildBaseGameState(62132, { width: 28, height: 28 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const pair = landWithCardinalRiverNeighborInCamp(state);
    const { land } = pair;
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'sled');
    state = advanceToolCraft(state, 'sled');

    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: land.x,
      selectedTileY: land.y,
      selectedTileEntity: land,
    });
    expect(entries.some((e) => e.kind === 'sled_attach')).toBe(true);

    const matrix = buildInventoryQuickActionsMatrix({
      gameState: state,
      playerActor: state.actors.player,
      playerInventoryEntries: [{ itemId: 'tool:sled', quantity: 1, name: 'sled' }],
      selectedTileX: land.x,
      selectedTileY: land.y,
      selectedTileEntity: land,
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
    const inventoryActions = matrix[0] || [];
    expect(inventoryActions.some((e) => e.kind === 'sled_attach')).toBe(true);

    const attached = advanceTick(state, {
      actions: [
        {
          actionId: 'attach-sled-e2e',
          actorId: 'player',
          kind: 'sled_attach',
          payload: { x: land.x, y: land.y },
        },
      ],
    });
    expect(attached.actors.player.sledAttached).toBe(true);

    const move = validateAction(attached, {
      actorId: 'player',
      kind: 'move',
      payload: { dx: 0, dy: 1 },
    });
    expect(move.ok).toBe(true);
    expect(move.normalizedAction.tickCost).toBe(2);
  });
});
