import { createInitialGameState } from '../../game/simCore.mjs';
import { getTileContextMenuEntries } from './TileContextMenuDisplayLogic.js';

function tileAt(state, x, y) {
  const idx = (Number(y) * Number(state.width)) + Number(x);
  return state.tiles[idx];
}

const RABBIT_DIET_BAIT_PART = 'daucus_carota:root:first_year';

describe('TileContextMenuDisplayLogic', () => {
  test('surfaces marker stick place/remove appropriately (max one per tile)', () => {
    const state = createInitialGameState(123, { width: 10, height: 10 });
    state.actors.player.x = 5;
    state.actors.player.y = 5;
    state.actors.player.inventory.stacks = [{ itemId: 'tool:marker_stick', quantity: 1 }];

    const x = 6;
    const y = 5;
    const tile = tileAt(state, x, y);
    tile.markerStick = false;

    const helpers = {
      inferTileContextActions: () => ['marker_place', 'marker_remove'],
      buildDefaultPayload: (kind) => (kind === 'marker_place' || kind === 'marker_remove' ? { x, y } : {}),
      formatTokenLabel: (v) => String(v || ''),
      getStationIdAtTile: () => null,
      stationActionLabel: () => '',
    };

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
    const labels = entries.map((e) => e.label);
    expect(labels).toContain('Place marker stick');
    expect(labels).not.toContain('Remove marker stick');

    // Once placed: only remove surfaces (place is invalid)
    tile.markerStick = true;
    const entriesPlaced = getTileContextMenuEntries({
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
    const labelsPlaced = entriesPlaced.map((e) => e.label);
    expect(labelsPlaced).not.toContain('Place marker stick');
    expect(labelsPlaced).toContain('Remove marker stick');
  });

  test('surfaces land trap_bait only for plant-part items in target diet (GDD §12.1)', () => {
    const state = createInitialGameState(456, { width: 10, height: 10 });
    state.actors.player.x = 5;
    state.actors.player.y = 5;

    const x = 6;
    const y = 5;
    const tile = tileAt(state, x, y);
    tile.simpleSnare = { active: true, baitItemId: null };
    tile.deadfallTrap = null;

    const helpers = {
      inferTileContextActions: () => [],
      buildDefaultPayload: () => ({}),
      formatTokenLabel: (v) => String(v || ''),
      getStationIdAtTile: () => null,
      stationActionLabel: () => '',
    };

    // No bait in inventory → no trap_bait entries
    state.actors.player.inventory.stacks = [];
    const none = getTileContextMenuEntries({
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
    expect(none.some((e) => e.kind === 'trap_bait')).toBe(false);

    // Earthworm is fishing bait only in this codebase — not a valid land trap bait item
    state.actors.player.inventory.stacks = [{ itemId: 'earthworm', quantity: 1 }];
    const worm = getTileContextMenuEntries({
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
    expect(worm.some((e) => e.kind === 'trap_bait')).toBe(false);

    // Wild carrot root: in cottontail diet → surfaces
    state.actors.player.inventory.stacks = [{ itemId: RABBIT_DIET_BAIT_PART, quantity: 1 }];
    const yes = getTileContextMenuEntries({
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
    const baitEntries = yes.filter((e) => e.kind === 'trap_bait');
    expect(baitEntries.length).toBe(1);
    expect(baitEntries[0].label.startsWith('Bait snare (')).toBe(true);
    expect(baitEntries[0].payload?.baitItemId).toBe(RABBIT_DIET_BAIT_PART);

    // Already baited → no trap_bait entries
    tile.simpleSnare = { active: true, baitItemId: RABBIT_DIET_BAIT_PART };
    const baited = getTileContextMenuEntries({
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
    expect(baited.some((e) => e.kind === 'trap_bait')).toBe(false);
  });
});
