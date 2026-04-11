import { TOOL_RECIPES } from '../../game/simActions.mjs';
import { advanceTick, validateAction } from '../../game/simCore.mjs';
import { getTileContextMenuEntriesForTest } from '../../ui/gameModeChrome/tileContextMenuTestHelpers.js';
import { buildBaseGameState, withCampStation, withPlayerAt } from '../../../tests/fixtures/buildTestGameState.mjs';
import {
  advanceToolCraft,
  applyAllResearchUnlocks,
  boostPlayerForTests,
  inventoryQuantityForItem,
  prepareStateForToolRecipeCraft,
  toolRecipeIdsResolvableFromCatalog,
} from '../../../tests/fixtures/craftingTestFixtures.mjs';

function tileAt(state, x, y) {
  return state.tiles[y * state.width + x];
}

/** Two cardinal-adjacent dry land tiles in camp (forces land if map generated water on footprint). */
function twoLandTilesInCampForTests(state) {
  const ax = state.camp.anchorX;
  const ay = state.camp.anchorY;
  const land = tileAt(state, ax, ay);
  const adj = tileAt(state, ax + 1, ay);
  land.waterType = null;
  land.rockType = null;
  adj.waterType = null;
  adj.rockType = null;
  return { land, adj };
}

/** Player camp tile + cardinal-east shallow unfrozen river (for fish weir placement). */
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

describe('Tool craft then primary world action (e2e headless)', () => {
  const recipeIds = toolRecipeIdsResolvableFromCatalog().sort();

  test.each(recipeIds)('craft %s from stockpile path then output exists in inventory', (recipeId) => {
    let state = buildBaseGameState(62000 + recipeId.charCodeAt(0), { width: 28, height: 28 });
    state = prepareStateForToolRecipeCraft(state, recipeId);
    const outId = TOOL_RECIPES[recipeId].outputItemId;
    const before = inventoryQuantityForItem(state.actors.player, outId);
    expect(before).toBe(0);
    state = advanceToolCraft(state, recipeId);
    const after = inventoryQuantityForItem(state.actors.player, outId);
    expect(after).toBeGreaterThanOrEqual(1);
  });

  test('tool_craft tick cost drops when workbench qualifies (camp footprint)', () => {
    let state = buildBaseGameState(62050, { width: 24, height: 24 });
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    withPlayerAt(state, ax, ay);
    state = prepareStateForToolRecipeCraft(state, 'digging_stick');
    const full = validateAction(state, { actorId: 'player', kind: 'tool_craft', payload: { recipeId: 'digging_stick' } });
    expect(full.ok).toBe(true);
    withCampStation(state, 'workbench', { x: ax + 1, y: ay });
    const discounted = validateAction(state, { actorId: 'player', kind: 'tool_craft', payload: { recipeId: 'digging_stick' } });
    expect(discounted.ok).toBe(true);
    const low = Number(discounted.normalizedAction?.tickCost);
    expect(low).toBe(Math.max(1, Math.floor(TOOL_RECIPES.digging_stick.craftTicks * 0.8)));
  });

  test('hoe: tile menu includes hoe on adjacent land after craft', () => {
    let state = buildBaseGameState(62051, { width: 22, height: 22 });
    const pair = twoLandTilesInCampForTests(state);
    const { land, adj } = pair;
    adj.plantIds = [];
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'hoe');
    state = advanceToolCraft(state, 'hoe');
    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: adj.x,
      selectedTileY: adj.y,
      selectedTileEntity: adj,
    });
    expect(entries.some((e) => e.kind === 'hoe')).toBe(true);
  });

  test('simple_snare: place snare then trap_check appears on that tile', () => {
    let state = buildBaseGameState(62052, { width: 22, height: 22 });
    const pair = twoLandTilesInCampForTests(state);
    const { land, adj } = pair;
    adj.plantIds = [];
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'simple_snare');
    state = advanceToolCraft(state, 'simple_snare');
    const vPlace = validateAction(state, {
      actorId: 'player',
      kind: 'trap_place_snare',
      payload: { x: adj.x, y: adj.y },
    });
    expect(vPlace.ok).toBe(true);
    state = advanceTick(state, {
      actions: [
        {
          actionId: 'place-snare',
          actorId: 'player',
          kind: 'trap_place_snare',
          payload: vPlace.normalizedAction.payload,
        },
      ],
    });
    const t = tileAt(state, adj.x, adj.y);
    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: adj.x,
      selectedTileY: adj.y,
      selectedTileEntity: t,
    });
    expect(entries.some((e) => e.kind === 'trap_check')).toBe(true);
  });

  test('dead_fall_trap: place deadfall then trap_check appears on that tile', () => {
    let state = buildBaseGameState(62053, { width: 22, height: 22 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const pair = twoLandTilesInCampForTests(state);
    const { land, adj } = pair;
    adj.plantIds = [];
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'dead_fall_trap');
    state = advanceToolCraft(state, 'dead_fall_trap');
    const vPlace = validateAction(state, {
      actorId: 'player',
      kind: 'trap_place_deadfall',
      payload: { x: adj.x, y: adj.y },
    });
    expect(vPlace.ok).toBe(true);
    state = advanceTick(state, {
      actions: [
        {
          actionId: 'place-deadfall',
          actorId: 'player',
          kind: 'trap_place_deadfall',
          payload: vPlace.normalizedAction.payload,
        },
      ],
    });
    const t = tileAt(state, adj.x, adj.y);
    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: adj.x,
      selectedTileY: adj.y,
      selectedTileEntity: t,
    });
    expect(entries.some((e) => e.kind === 'trap_check')).toBe(true);
  });

  test('fish_trap_weir: place weir on adjacent river then trap_check appears on water tile', () => {
    let state = buildBaseGameState(62054, { width: 28, height: 28 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const { land, water } = landWithCardinalRiverNeighborInCamp(state);
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'fish_trap_weir');
    state = advanceToolCraft(state, 'fish_trap_weir');
    const vPlace = validateAction(state, {
      actorId: 'player',
      kind: 'trap_place_fish_weir',
      payload: { x: water.x, y: water.y },
    });
    expect(vPlace.ok).toBe(true);
    state = advanceTick(state, {
      actions: [
        {
          actionId: 'place-weir',
          actorId: 'player',
          kind: 'trap_place_fish_weir',
          payload: vPlace.normalizedAction.payload,
        },
      ],
    });
    const t = tileAt(state, water.x, water.y);
    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: water.x,
      selectedTileY: water.y,
      selectedTileEntity: t,
    });
    expect(entries.some((e) => e.kind === 'trap_check')).toBe(true);
  });

  test('digging_stick: craft then dig appears on adjacent land tile', () => {
    let state = buildBaseGameState(62055, { width: 22, height: 22 });
    const pair = twoLandTilesInCampForTests(state);
    const { land, adj } = pair;
    adj.plantIds = [];
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'digging_stick');
    state = advanceToolCraft(state, 'digging_stick');
    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: adj.x,
      selectedTileY: adj.y,
      selectedTileEntity: adj,
    });
    expect(entries.some((e) => e.kind === 'dig')).toBe(true);
  });

  /**
   * Camp footprint clears plants each advanceTick; tree must sit west of footprint with player
   * on the footprint edge tile (same pattern as tree-tapping e2e).
   */
  test('fell_tree: tile menu shows action with axe tick cost; hidden without axe', () => {
    let state = buildBaseGameState(62059, { width: 26, height: 26 });
    boostPlayerForTests(state);
    applyAllResearchUnlocks(state);
    const ax = state.camp.anchorX;
    const ay = state.camp.anchorY;
    const w = state.width;
    const tx = ax - 2;
    expect(tx).toBeGreaterThanOrEqual(0);
    const treeTile = state.tiles[ay * w + tx];
    treeTile.waterType = null;
    treeTile.rockType = null;
    const plantId = 'e2e_fell_tree_walnut';
    state.plants[plantId] = {
      id: plantId,
      speciesId: 'juglans_nigra',
      age: 500,
      x: treeTile.x,
      y: treeTile.y,
      stageName: 'mature_vegetative',
      alive: true,
      vitality: 1,
      activeSubStages: [],
      source: 'test',
    };
    treeTile.plantIds = [plantId];
    withPlayerAt(state, ax - 1, ay);
    state.actors.player.inventory.stacks = [];

    let entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: treeTile.x,
      selectedTileY: treeTile.y,
      selectedTileEntity: treeTile,
    });
    expect(entries.some((e) => e.kind === 'fell_tree')).toBe(false);

    state = prepareStateForToolRecipeCraft(state, 'axe');
    state = advanceToolCraft(state, 'axe');
    withPlayerAt(state, ax - 1, ay);
    entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: treeTile.x,
      selectedTileY: treeTile.y,
      selectedTileEntity: treeTile,
    });
    const fell = entries.find((e) => e.kind === 'fell_tree');
    expect(fell).toBeDefined();
    expect(fell.payload?.plantId).toBe(plantId);
    expect(fell.tickCost).toBe(130);
  });

  test('marker_stick: craft then marker_place appears on adjacent land tile', () => {
    let state = buildBaseGameState(62056, { width: 22, height: 22 });
    const pair = twoLandTilesInCampForTests(state);
    const { land, adj } = pair;
    adj.plantIds = [];
    withPlayerAt(state, land.x, land.y);
    state = prepareStateForToolRecipeCraft(state, 'marker_stick');
    state = advanceToolCraft(state, 'marker_stick');
    const entries = getTileContextMenuEntriesForTest(state, {
      player: state.actors.player,
      selectedTileX: adj.x,
      selectedTileY: adj.y,
      selectedTileEntity: adj,
    });
    expect(entries.some((e) => e.kind === 'marker_place')).toBe(true);
  });
});
