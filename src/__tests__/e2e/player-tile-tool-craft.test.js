import { validateAction } from '../../game/simCore.mjs';
import {
  listPlayerTileToolCraftEntries,
  listWorkbenchToolCraftStationEntries,
} from '../../ui/gameModeChrome/playerTileToolCraft.mjs';
import { getTileContextMenuEntriesForTest } from '../../ui/gameModeChrome/tileContextMenuTestHelpers.js';
import { buildBaseGameState, withPlayerAt } from '../../../tests/fixtures/buildTestGameState.mjs';
import {
  prepareStateForToolRecipeCraft,
  toolRecipeIdsResolvableFromCatalog,
} from '../../../tests/fixtures/craftingTestFixtures.mjs';

describe('Player tile tool_craft surfacing (e2e headless)', () => {
  test('listPlayerTileToolCraftEntries matches validateAction for each recipe after stockpile prep', () => {
    const recipeIds = toolRecipeIdsResolvableFromCatalog().sort();
    for (const recipeId of recipeIds) {
      let state = buildBaseGameState(61000 + recipeId.length * 31, { width: 26, height: 26 });
      state = prepareStateForToolRecipeCraft(state, recipeId);
      const fromHelper = listPlayerTileToolCraftEntries(state, state.actors.player);
      const row = fromHelper.find((e) => e.kind === 'tool_craft' && e.payload?.recipeId === recipeId);
      expect(row).toBeDefined();
      const v = validateAction(state, { actorId: 'player', kind: 'tool_craft', payload: { recipeId } });
      expect(v.ok).toBe(true);
      expect(row.payload).toEqual(expect.objectContaining({ recipeId, outputItemId: v.normalizedAction.payload.outputItemId }));
    }
  });

  test('getTileContextMenuEntriesForTest includes tool_craft on player tile when craftable', () => {
    let state = buildBaseGameState(61001, { width: 22, height: 22 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    withPlayerAt(state, ax, ay);
    state = prepareStateForToolRecipeCraft(state, 'digging_stick');
    const tile = state.tiles[ay * state.width + ax];
    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: ax,
      selectedTileY: ay,
      selectedTileEntity: tile,
    });
    const craft = entries.filter((e) => e.kind === 'tool_craft' && e.payload?.recipeId === 'digging_stick');
    expect(craft.length).toBe(1);
  });
});

describe('Workbench station tool_craft panel (headless)', () => {
  const recipeIds = toolRecipeIdsResolvableFromCatalog().sort();

  test.each(recipeIds)('workbench panel lists %s when materials are ready (matches validateAction)', (recipeId) => {
    let state = buildBaseGameState(61020 + recipeId.length * 17, { width: 26, height: 26 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    withPlayerAt(state, ax, ay);
    state = prepareStateForToolRecipeCraft(state, recipeId);
    const v = validateAction(state, { actorId: 'player', kind: 'tool_craft', payload: { recipeId } });
    expect(v.ok).toBe(true);
    const rows = listWorkbenchToolCraftStationEntries(state);
    const row = rows.find((r) => r.recipeId === recipeId);
    expect(row).toBeDefined();
    expect(row.toolCraftPayload).toEqual(expect.objectContaining({
      recipeId,
      outputItemId: v.normalizedAction.payload.outputItemId,
    }));
  });

  test('listWorkbenchToolCraftStationEntries mirrors craftable recipes for App station overlay', () => {
    let state = buildBaseGameState(61002, { width: 22, height: 22 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    withPlayerAt(state, ax, ay);
    state = prepareStateForToolRecipeCraft(state, 'digging_stick');
    const rows = listWorkbenchToolCraftStationEntries(state);
    const dig = rows.find((r) => r.recipeId === 'digging_stick');
    expect(dig).toMatchObject({
      actionKind: 'tool_craft',
      stationId: 'workbench',
      source: 'tool_recipe',
      maxQuantity: 1,
    });
    expect(typeof dig?.label).toBe('string');
    expect(dig?.toolCraftPayload?.recipeId).toBe('digging_stick');
  });
});
